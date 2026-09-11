// O RODAPÉ DO DRENO, E QUANTOS TIQUES ELE PUBLICA — a rede que faltava.
//
// -----------------------------------------------------------------------------
// O QUE ESTE ARQUIVO MEDE, E POR QUE NENHUM OUTRO MEDIA
//
// `drainQueue` termina perguntando `min(not_before)` entre os itens `pending` e
// publica um tique do QStash para esse instante (lib/queue-drain.ts, o bloco
// logo abaixo do laço). Enquanto a coisa mais distante da fila era um lembrete
// de algumas horas, esse rodapé era barato: o tique saía, o dreno acordava, o
// lembrete ia embora e a fila esvaziava.
//
// A PUBLICAÇÃO AGENDADA MUDOU A FILA. Um post marcado para o mês que vem é a
// primeira coisa deste produto que fica `pending` por SEMANAS, e um item que
// fica é um `min(not_before)` que sempre responde — então TODA drenagem passa a
// publicar um tique, e cada tique entregue chama `drainQueue()` de novo
// (`app/api/queue/tick/route.ts`), que publica outro. Somado ao dreno de cada
// webhook, o número por dia cresce em linha reta.
//
// É EXATAMENTE O CRESCIMENTO SEM FIM QUE A MIGRAÇÃO `009` FECHOU, voltando por
// porta nova. O comentário do próprio rodapé descreve o defeito antigo com
// estas palavras: "sempre havia um `min(not_before)` para devolver, então TODO
// webhook publicava um tique no QStash — indefinidamente".
//
// E O DANO NÃO É NA PUBLICAÇÃO. `scheduleTick` engole todo erro (lib/qstash.ts,
// e está certo em engolir). Estourada a cota do QStash, param CALADOS os tiques
// de TODO o produto — o lembrete de 2 h passa a chegar quando alguém mandar
// mensagem. A fila continua drenando por webhook e pelo cron, então nada se
// perde: só atrasa, e atrasa sem uma linha dizendo por quê.
//
// -----------------------------------------------------------------------------
// POR QUE UM ARQUIVO SÓ PARA ISTO
//
// Todos os outros arquivos de integração APAGAM a `QSTASH_TOKEN` no `beforeAll`
// — é a segunda fronteira herdada de `gatilho-entrega.integracao.ts`, e ela
// existe para que nenhum teste publique agendamento de verdade. Este arquivo
// precisa do contrário: precisa que `scheduleTick` CHEGUE a publicar, porque o
// que se mede aqui é QUANTOS tiques saem. Misturar as duas posturas no mesmo
// arquivo faria uma delas mentir.
//
// -----------------------------------------------------------------------------
// NADA SAI DESTA MÁQUINA, E A TRAVA É DUPLA
//
// O cliente do QStash resolve o endereço na ordem `config.baseUrl ?? QSTASH_URL
// ?? https://qstash.upstash.io`, e este arquivo põe `QSTASH_URL` num servidor
// HTTP do próprio processo. As duas travas do `beforeAll`, nesta ordem:
//
//   1. ANTES DE QUALQUER ENVIO, pergunta ao próprio cliente do QStash para onde
//      ele resolveu — e recusa rodar se não for loopback. Assim, no dia em que
//      o pacote deixar de ler `QSTASH_URL`, nada chega a sair: o arquivo morre
//      na montagem, e não depois de um POST para a Upstash de verdade.
//   2. DEPOIS, prova o EFEITO: um `scheduleTick` de mentira tem de aparecer no
//      servidor falso. Só a trava 1 não distingue "o desvio funciona" de "o
//      campo que eu li virou enfeite".
//
// O token é uma string inventada, como em todo arquivo desta pasta. A
// `IG_GRAPH_BASE` e a `SUPABASE_URL` também são presas ao loopback, pela mesma
// disciplina — nada neste arquivo chega a tocar a Meta nem o bucket (os itens
// semeados estão sempre no FUTURO, então o dreno não reivindica nenhum), e a
// amarra existe para o dia em que alguém mudar isso sem perceber.
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { bancoDescartavel } from "./harness";
import { comoNumaRequisicao } from "./semear-requisicao";

type ModuloEngine = typeof import("@/lib/engine");
type ModuloDreno = typeof import("@/lib/queue-drain");
type ModuloQstash = typeof import("@/lib/qstash");
type ModuloAcoes = typeof import("@/app/publicar/post/actions");

const banco = bancoDescartavel();

const CONTA = "17800000000001101";
// Valores inventados. Nenhuma credencial de verdade entra em teste.
const TOKEN_DA_CONTA = "token-da-conta-que-nao-vale-nada";
const TOKEN_DO_QSTASH = "token-de-qstash-inventado-para-o-teste";
const APP_URL = "https://exemplo.invalid";

const UM_DIA_EM_SEGUNDOS = 24 * 60 * 60;

/** Os `POST /v2/publish/...` que chegaram ao QStash falso. */
let publicados: { destino: string; atraso: string | null }[] = [];

let servidorQstash: Server;
let servidorMeta: Server;
let engine: ModuloEngine;
let dreno: ModuloDreno;
let qstash: ModuloQstash;
let acoes: ModuloAcoes;

function responderJson(res: ServerResponse, corpo: unknown) {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify(corpo));
}

beforeAll(async () => {
  // -------------------------------------------------------------------------
  // O QSTASH FALSO. Ele só precisa aceitar o `publish` e responder um JSON: o
  // cliente lê `messageId` e segue. O que interessa é o REGISTRO.
  // -------------------------------------------------------------------------
  servidorQstash = createServer((req: IncomingMessage, res: ServerResponse) => {
    const caminho = req.url ?? "/";
    if (req.method === "POST" && caminho.startsWith("/v2/publish/")) {
      req.resume();
      publicados.push({
        destino: caminho.slice("/v2/publish/".length),
        atraso: req.headers["upstash-delay"] as string | null,
      });
      return responderJson(res, { messageId: `msg-${publicados.length}` });
    }
    req.resume();
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "o qstash falso nao conhece esse caminho" }));
  });

  // A META FALSA existe só como amarra: nada neste arquivo publica post nenhum.
  servidorMeta = createServer((req: IncomingMessage, res: ServerResponse) => {
    req.resume();
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: { message: "nenhum teste deste arquivo fala com a Meta" } }));
  });

  await new Promise<void>((pronto) => servidorQstash.listen(0, "127.0.0.1", pronto));
  await new Promise<void>((pronto) => servidorMeta.listen(0, "127.0.0.1", pronto));
  const portaQstash = (servidorQstash.address() as AddressInfo).port;
  const portaMeta = (servidorMeta.address() as AddressInfo).port;

  process.env.QSTASH_URL = `http://127.0.0.1:${portaQstash}`;
  process.env.QSTASH_TOKEN = TOKEN_DO_QSTASH;
  process.env.IG_GRAPH_BASE = `http://127.0.0.1:${portaMeta}`;
  process.env.SUPABASE_URL = `http://127.0.0.1:${portaMeta}`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "chave-de-servico-inventada-para-o-teste";
  process.env.SUPABASE_BUCKET = "MetodoChatDeTeste";

  engine = await import("@/lib/engine");
  dreno = await import("@/lib/queue-drain");
  qstash = await import("@/lib/qstash");
  acoes = (await import("@/app/publicar/post/actions")) as ModuloAcoes;

  // --- TRAVA 1: para onde o cliente do QStash resolveu, ANTES de enviar ------
  const { Client } = await import("@upstash/qstash");
  const enderecoResolvido = (
    new Client({ token: TOKEN_DO_QSTASH }).http as unknown as { baseUrl?: unknown }
  ).baseUrl;
  if (
    typeof enderecoResolvido !== "string" ||
    !/^http:\/\/127\.0\.0\.1:\d+$/.test(enderecoResolvido)
  ) {
    throw new Error(
      `RECUSADO: o cliente do QStash resolveu para \`${String(enderecoResolvido)}\`, e ` +
        `tinha de ser o servidor falso desta rodada (${process.env.QSTASH_URL}). ` +
        `Sem o desvio, este arquivo publicaria agendamentos na Upstash de verdade. ` +
        `Confira se @upstash/qstash ainda lê a variável QSTASH_URL na versão instalada.`
    );
  }

  // --- TRAVA 2: o EFEITO, e não só a forma ----------------------------------
  if (!qstash.qstashEnabled()) {
    throw new Error(
      "RECUSADO: `qstashEnabled()` respondeu falso com a QSTASH_TOKEN posta. Sem " +
        "ela verdadeira, `scheduleTick` volta cedo e este arquivo contaria zero " +
        "tique em todo caso — passando sem medir nada."
    );
  }
  publicados = [];
  await qstash.scheduleTick(APP_URL, 60);
  if (publicados.length !== 1) {
    throw new Error(
      `RECUSADO: um \`scheduleTick\` de prova não chegou ao QStash falso ` +
        `(chegaram ${publicados.length}). O contador deste arquivo é o instrumento ` +
        `inteiro; se ele não registra o tique que eu mesmo mandei, todo caso daqui ` +
        `passaria contando zero por engano.`
    );
  }

  await banco.db().upsertAccount({
    ig_user_id: CONTA,
    username: "conta_do_tique",
    name: "conta_do_tique",
    profile_picture_url: null,
    access_token: TOKEN_DA_CONTA,
    token_expires_at: null,
  });
  // `scheduleTick` volta cedo com `app_url` vazia, e aí nada seria medido.
  await banco.db().updateConfig({ app_url: APP_URL });
});

afterAll(async () => {
  delete process.env.QSTASH_URL;
  delete process.env.QSTASH_TOKEN;
  delete process.env.IG_GRAPH_BASE;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_BUCKET;
  await new Promise<void>((pronto) => servidorQstash.close(() => pronto()));
  await new Promise<void>((pronto) => servidorMeta.close(() => pronto()));
});

beforeEach(async () => {
  await banco.db().sql().query(`delete from queue`);
  publicados = [];
});

/**
 * Semeia um post agendado e ZERA o contador.
 *
 * O `enqueue` publica o tique dele quando a hora cabe no horizonte
 * (`agendarTique`, lib/engine.ts), e esse tique é do CAMINHO DE ENTRADA — não é
 * o do rodapé. Contá-lo junto misturaria dois mecanismos num número só.
 */
async function agendarPostDaqui(segundos: number) {
  const entrou = await engine.enqueuePublicacao(
    CONTA,
    { forma: "imagem", caminhos: [`${CONTA}/post-${segundos}s.jpg`] },
    new Date(Date.now() + segundos * 1000)
  );
  expect(entrou).toBe(true);
  publicados = [];
}

// ---------------------------------------------------------------------------
// O DESFECHO DE UM SERVER ACTION — a mesma leitura do `digest` de
// `agendados.integracao.ts` e de `publicar-fala.integracao.ts`, copiada e nao
// importada pelo mesmo motivo de la: `redirect()` funciona LANCANDO, e e isso
// que torna a saida assertavel. Uma acao que VOLTA (sem lancar) vira
// `digest: null`, e nao um teste que morre com a mensagem de outra pessoa.
// ---------------------------------------------------------------------------
function urlDoDigest(digest: string | null): string | null {
  if (digest === null || !digest.startsWith("NEXT_REDIRECT;")) return null;
  return digest.split(";").slice(2, -2).join(";");
}

async function avisoDe(
  acao: (form: FormData) => Promise<void>,
  form: FormData
): Promise<{ texto: string | null; tom: string | null }> {
  const { valor } = await comoNumaRequisicao("/publicar", async () => {
    try {
      await acao(form);
      return null as string | null;
    } catch (e) {
      const digest = (e as { digest?: unknown }).digest;
      if (typeof digest === "string") return digest;
      throw e;
    }
  });
  const url = urlDoDigest(valor);
  if (url === null) return { texto: null, tom: null };
  const sp = new URL(url, "http://127.0.0.1").searchParams;
  return { texto: sp.get("aviso"), tom: sp.get("tom") };
}

/** O formulario de remarcar. `fuso` "0" e UTC, para o instante escrito no campo
 *  ser o mesmo que o banco guarda — sem conta nenhuma no meio para errar. */
function pedidoDeRemarcar(id: string, instante: number): FormData {
  const form = new FormData();
  form.set("id", id);
  form.set("data_hora", new Date(instante).toISOString().slice(0, 16));
  form.set("fuso", "0");
  return form;
}

/** O unico item da fila. O `beforeEach` a esvazia, entao ha exatamente um. */
async function idDoUnicoItem(): Promise<string> {
  const linhas = (await banco.db().sql().query(`select id from queue`)) as { id: string }[];
  expect(linhas.length).toBe(1);
  return linhas[0].id;
}

/** Um instante daqui a N horas, truncado ao minuto — que e o que o
 *  `<input type="datetime-local">` manda. */
function daquiAHoras(horas: number): number {
  return Math.floor((Date.now() + horas * 60 * 60 * 1000) / 60000) * 60000;
}

// =============================================================================
// O PAR DE CONTROLE DO REMARCAR — compor contra remarcar, o mesmo post e a
// mesma distancia.
//
// Ate 09/09/2026 remarcar nao armava tique NENHUM, e o comentario que
// justificava a ausencia lia errado o codigo que citava: ele dizia que
// `enqueuePublicacao` passa `agendarTique: false` de proposito. Ela passa
// `agendarTique: atraso <= HORIZONTE` (lib/engine.ts).
//
// E O CRON DIARIO NAO COBRIA O BURACO. `armarTiquesDoDia` so e honesta para
// `not_before` escrito ANTES da passagem dela — e remarcar move a hora para
// dentro de uma janela JA VARRIDA. O cron e diario (`vercel.json`: `0 9 * * *`),
// entao um post remarcado para daqui a duas horas podia sair ~23 h depois,
// CALADO, depois de a tela ter dito "Ele sai na hora nova".
//
// NENHUM PORTAO VIA ISSO: a suite pura nao chama a acao, e nenhum outro arquivo
// de integracao deixa `scheduleTick` chegar a publicar (todos apagam a
// QSTASH_TOKEN). So aqui o numero existe.
// =============================================================================
describe("o tique da hora nova, e o par de controle que o mede", () => {
  test("compor para +2h arma 1 tique, e remarcar para +2h arma 1 tambem", async () => {
    // O CONTROLE. Sem ele, "remarcar arma 1" nao distingue o conserto de um
    // instrumento que conta qualquer coisa.
    await engine.enqueuePublicacao(
      CONTA,
      { forma: "imagem", caminhos: [`${CONTA}/compor-daqui-a-duas-horas.jpg`] },
      new Date(Date.now() + 2 * 60 * 60 * 1000)
    );
    expect(publicados.length).toBe(1);

    // O MEDIDO. O post nasce marcado para o mes que vem — alem do horizonte,
    // entao compor NAO arma nada por ele — e e remarcado para a MESMA distancia
    // de duas horas do controle acima.
    await banco.db().sql().query(`delete from queue`);
    publicados = [];
    await engine.enqueuePublicacao(
      CONTA,
      { forma: "imagem", caminhos: [`${CONTA}/remarcado-de-um-mes-para-duas-horas.jpg`] },
      new Date(Date.now() + 30 * UM_DIA_EM_SEGUNDOS * 1000)
    );
    expect(publicados.length).toBe(0);
    const id = await idDoUnicoItem();
    publicados = [];

    const aviso = await avisoDe(acoes.remarcarPublicacao, pedidoDeRemarcar(id, daquiAHoras(2)));
    expect(aviso.tom).toBe("ok");
    expect(aviso.texto).toContain("Post remarcado");

    // O NUMERO QUE FALTAVA. Antes do conserto: 0.
    expect(publicados.length).toBe(1);
    expect(publicados[0].destino).toContain("/api/queue/tick");
    // A FAIXA, e nao a igualdade: o campo `datetime-local` e truncado ao minuto,
    // entao a distancia real fica entre 7140 e 7200 s, mais os cinco de folga.
    const segundos = Number((publicados[0].atraso ?? "").replace(/s$/, ""));
    expect(Number.isFinite(segundos)).toBe(true);
    expect(segundos).toBeGreaterThan(7100);
    expect(segundos).toBeLessThanOrEqual(7205);
  });

  // A METADE QUE IMPEDE O CONSERTO DE VIRAR "arma sempre". Um mes de atraso
  // entregue ao QStash depende de um horizonte que NUNCA foi verificado, e se
  // ele recusasse, `scheduleTick` engoliria o erro e o post nao sairia, calado.
  // Alem de um dia quem arma e `armarTiquesDoDia`, no dia certo.
  test("remarcar para alem do horizonte NAO arma tique — quem arma e o cron", async () => {
    await engine.enqueuePublicacao(
      CONTA,
      { forma: "imagem", caminhos: [`${CONTA}/remarcado-para-o-mes-que-vem.jpg`] },
      new Date(Date.now() + 2 * 60 * 60 * 1000)
    );
    const id = await idDoUnicoItem();
    publicados = [];

    const aviso = await avisoDe(
      acoes.remarcarPublicacao,
      pedidoDeRemarcar(id, daquiAHoras(30 * 24))
    );
    expect(aviso.tom).toBe("ok");
    expect(aviso.texto).toContain("Post remarcado");

    expect(publicados).toEqual([]);
  });

  // E UM REMARCAR RECUSADO NAO ARMA NADA. Sem esta linha, o tique poderia ter
  // sido posto fora do `if (desfecho === "feito")` e ninguem veria: um tique
  // para uma hora que nao foi gravada acorda o app para nada.
  test("remarcar RECUSADO (item de outro tipo) nao arma tique nenhum", async () => {
    await engine.enqueuePublicacao(
      CONTA,
      { forma: "imagem", caminhos: [`${CONTA}/nao-vai-ser-remarcado.jpg`] },
      new Date(Date.now() + 2 * 60 * 60 * 1000)
    );
    await banco.db().sql().query(`update queue set kind = 'dm_manual'`);
    const id = await idDoUnicoItem();
    publicados = [];

    const aviso = await avisoDe(acoes.remarcarPublicacao, pedidoDeRemarcar(id, daquiAHoras(2)));
    expect(aviso.tom).toBe("erro");
    expect(aviso.texto).toContain("Não achei este post agendado nesta conta");

    expect(publicados).toEqual([]);
  });
});

describe("o rodape do dreno e quantos tiques ele publica", () => {
  test("post agendado para +30 dias NAO faz o rodape armar um tique por drenagem", async () => {
    await agendarPostDaqui(30 * UM_DIA_EM_SEGUNDOS);

    // DEZ DRENAGENS, que é o que dez webhooks fazem numa manhã morna. O tráfego
    // medido em produção é de ~226 eventos por dia, com pico de 935.
    for (let i = 0; i < 10; i++) await dreno.drainQueue();

    // SEM TETO NA CONSULTA DO RODAPÉ, aqui chegam DEZ — um por drenagem, cada um
    // com 86400 s de atraso —, e cada um deles chamaria `drainQueue()` de novo.
    // Quem arma o tique de um post que vence daqui a semanas é o cron diário
    // (`armarTiquesDoDia`), no dia certo, e não este rodapé todo dia.
    expect(publicados).toEqual([]);
  });

  test("dentro de um dia o rodape CONTINUA armando: o teto nao fecha o caminho curto", async () => {
    // A METADE QUE IMPEDE O CONSERTO DE VIRAR UM `and false`. Sem este caso,
    // apagar o rodapé inteiro passaria pelo caso de cima — e o item que vence
    // daqui a duas horas ficaria esperando o próximo webhook aparecer.
    await agendarPostDaqui(2 * 60 * 60);

    await dreno.drainQueue();

    expect(publicados.length).toBe(1);
    expect(publicados[0].destino).toContain("/api/queue/tick");
    // O `Math.min` do rodapé corta o ATRASO em um dia; o que este arquivo mede é
    // a decisão de ARMAR, que é a que estava sem teto.
    //
    // A FAIXA, E NÃO A IGUALDADE, e a troca é de 09/09/2026. O número comparado é
    // `min(not_before) - now()` medido DEPOIS de o dreno inteiro rodar: ele
    // conta o tempo gasto entre semear e drenar. Sozinho o arquivo dava 7205;
    // sob a suíte completa (banco remoto, ~9 min de rodada) dava 7203, e o
    // portão de integração ficava vermelho por DOIS SEGUNDOS DE RELÓGIO.
    //
    // Um teste que falha por relógio ensina a ignorar vermelho, e isso custa
    // mais do que o que ele protege. A faixa continua matando os dois plantios
    // que este caso existe para matar: armar ZERO morre na linha de cima
    // (`publicados.length`), e armar COM O TETO daria 86400 s — quatro ordens de
    // grandeza acima do limite de cima, e não dois segundos.
    const segundos = Number((publicados[0].atraso ?? "").replace(/s$/, ""));
    expect(Number.isFinite(segundos)).toBe(true);
    expect(segundos).toBeGreaterThan(7100);
    expect(segundos).toBeLessThanOrEqual(7205);
  });

  test("fila vazia nao arma tique nenhum", async () => {
    await dreno.drainQueue();
    expect(publicados).toEqual([]);
  });
});

describe("a varredura do cron e o horizonte que ela nunca pode passar", () => {
  // O RODAPÉ DO DRENO TEM O `Math.min` DESDE SEMPRE; esta varredura não tinha.
  // A janela da consulta dela é `<= now() + 86400`, então o item mais distante
  // devolve ~86400 s — e os cinco segundos de folga o empurravam para 86405,
  // CINCO SEGUNDOS além do horizonte que este projeto declarou nunca
  // ultrapassar. Um atraso além do horizonte é exatamente o que `scheduleTick`
  // engoliria calado se o QStash o recusasse.
  test("o item na BORDA da janela nao entrega atraso alem de um dia", async () => {
    await engine.enqueuePublicacao(
      CONTA,
      { forma: "imagem", caminhos: [`${CONTA}/na-borda-da-janela.jpg`] },
      // EXATAMENTE UM DIA, que é a borda da janela desta varredura
      // (`not_before <= now() + 86400`). O item entra, e `secs` volta 86400 —
      // os cinco segundos de folga o levariam a 86405. Uma folga de 30 s abaixo
      // da borda NÃO serve de caso: ela deixa o plantio sobreviver, e isso foi
      // medido antes de este número virar o que é.
      new Date(Date.now() + UM_DIA_EM_SEGUNDOS * 1000)
    );
    publicados = [];

    expect(await dreno.armarTiquesDoDia()).toEqual({ armados: 1 });

    expect(publicados.length).toBe(1);
    const segundos = Number((publicados[0].atraso ?? "").replace(/s$/, ""));
    expect(Number.isFinite(segundos)).toBe(true);
    expect(segundos).toBeLessThanOrEqual(UM_DIA_EM_SEGUNDOS);
  });

  // A METADE QUE IMPEDE O TETO DE VIRAR UM `Math.min(..., 20)`: o que está
  // longe da borda continua sendo armado para a hora dele, e não para daqui a
  // pouco.
  test("longe da borda, o atraso continua sendo o do item", async () => {
    await engine.enqueuePublicacao(
      CONTA,
      { forma: "imagem", caminhos: [`${CONTA}/daqui-a-duas-horas.jpg`] },
      new Date(Date.now() + 2 * 60 * 60 * 1000)
    );
    publicados = [];

    expect(await dreno.armarTiquesDoDia()).toEqual({ armados: 1 });

    expect(publicados.length).toBe(1);
    const segundos = Number((publicados[0].atraso ?? "").replace(/s$/, ""));
    expect(segundos).toBeGreaterThan(2 * 60 * 60 - 60);
    expect(segundos).toBeLessThanOrEqual(2 * 60 * 60 + 10);
  });
});
