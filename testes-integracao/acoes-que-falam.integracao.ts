// O SEXTO CAMINHO DA FRENTE 2: as ações de `app/contatos/actions.ts` — as que a
// branch `acoes-que-falam` fez PARAR DE RECUSAR EM SILÊNCIO — rodadas de
// verdade, contra o schema descartável e contra a Meta falsa.
//
// -----------------------------------------------------------------------------
// POR QUE ELE EXISTE — e a regra da Frente 2 continua sendo a mesma.
//
// "Um caminho novo entra só quando um defeito real escapou por ele." Escaparam
// TRÊS, medidos na revisão final de 02/09/2026 (12 plantios, 5 mortos, 7 vivos;
// os 6 plantados em `app/**` sobreviveram TODOS aos quatro portões):
//
//   P8 — apagar o `redirect` de sucesso de `enviarLote`. Desfaz a branch
//        inteira: a tela recarrega igual, e ninguém fica sabendo de nada.
//   P9 — mover esse mesmo `redirect` para DENTRO do `try { drainQueue() }
//        catch {}`. É a ARMADILHA Nº 2 DO PRÓPRIO PLANO: `redirect` funciona
//        LANÇANDO, então o `catch` vazio engole o desfecho e a ação volta muda —
//        exatamente o defeito que a branch veio fechar, reaberto por dentro.
//   P4 — a contagem do sucesso procurar `payload->>'loteId'` no lugar de
//        `payload->>'lote_id'`. Toda contagem zera e o aviso mente em TODO envio.
//
// Os três passavam por lint, por typecheck, pelos 987 testes puros e pelos 73 de
// integração sem uma linha vermelha, porque nenhum teste deste projeto importava
// as ações desta branch. A camada pura (`lib/avisos.ts`, `lib/lote.ts`) resistiu
// a 5 dos 6 defeitos plantados nela; a COSTURA — a lista de status da consulta,
// a escolha do filtro em cada `redirect`, a ordem entre `redirect` e `try/catch`
// — não tinha nada.
//
// -----------------------------------------------------------------------------
// A MAQUINARIA JÁ EXISTIA, e este arquivo não inventa nenhuma.
//
// `comoNumaRequisicao` (./semear-requisicao.ts) monta o contexto de requisição
// do Next com quatro peças do próprio pacote, SEM FORJAR COOKIE NENHUM. Leia o
// cabeçalho de lá antes de mexer aqui — em especial a parte da jarra vazia e o
// LIMITE HONESTO: sob o vitest o `"use server"` é inerte, então as ações são
// chamadas DIRETO. Isto exercita o CORPO do Server Action, e não a fronteira de
// serialização do POST.
//
// A Meta falsa e as duas travas de `baseDoGraph()` são as de
// `lote.integracao.ts`, pelas mesmas razões, e este arquivo não duplica o teste
// dedicado a elas.
//
// -----------------------------------------------------------------------------
// O DESFECHO DE UM SERVER ACTION É ASSERTÁVEL PORQUE `redirect` LANÇA.
//
// `redirect()` (next/navigation) marca a exceção no `digest`, no formato
// `NEXT_REDIRECT;<tipo>;<url>;<código>;` — a URL vai DENTRO do erro. É por isso
// que `desfechoDe`, abaixo, consegue ler o destino: ele é o único lugar onde
// estas ações publicam o que aconteceu.
//
// E é por isso que os três plantios acima morrem aqui: P8 e P9 fazem a ação
// voltar SEM LANÇAR (o `digest` vem nulo), e P4 faz a contagem zerar (a frase do
// destino deixa de dizer quem recebeu).
//
// -----------------------------------------------------------------------------
// NENHUMA SESSÃO É FORJADA AQUI. A jarra de cookies sai vazia, e
// `getSelectedAccount` (lib/account.ts) cai na PRIMEIRA conta do schema — o
// comportamento DECLARADO dela. A ORDEM DOS DOIS BLOCOS ABAIXO É PARTE DA
// MEDIDA: o primeiro roda quando o schema ainda não tem conta NENHUMA, e é isso
// que torna a recusa "Conecte uma conta do Instagram primeiro" alcançável sem
// mexer em cookie. O segundo cria a conta no `beforeAll` dele. Cada bloco
// confere a própria condição antes de medir, para que uma reordenação futura
// fique VERMELHA em vez de passar medindo outra coisa.
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { bancoDescartavel } from "./harness";
import { comoNumaRequisicao } from "./semear-requisicao";

type ModuloAcoes = typeof import("@/app/contatos/actions");
type ModuloIg = typeof import("@/lib/ig");
type ModuloConta = typeof import("@/lib/account");

const banco = bancoDescartavel();

const CONTA = "17841400000000606";
// Valor inventado. Nenhuma credencial de verdade entra em teste.
const TOKEN = "token-de-teste-que-nao-vale-nada";

let servidor: Server;
let acoes: ModuloAcoes;
let ig: ModuloIg;
let conta: ModuloConta;

// O que a Meta falsa recebeu. Só o envio de mensagem importa a este arquivo:
// todo contato nasce com `username`, então a busca de perfil nunca é chamada.
const meta = {
  enviadas: [] as { destinatario: string; texto: string }[],
  desconhecidos: [] as string[],
};

beforeAll(async () => {
  servidor = createServer((req, res) => {
    const u = new URL(req.url ?? "/", "http://127.0.0.1");
    if (req.method === "POST" && u.pathname.endsWith("/messages")) {
      const pedacos: Buffer[] = [];
      req.on("data", (d: Buffer) => pedacos.push(d));
      req.on("end", () => {
        const corpo = JSON.parse(Buffer.concat(pedacos).toString("utf8")) as {
          recipient: { id?: string };
          message: { text?: string };
        };
        meta.enviadas.push({
          destinatario: corpo.recipient.id ?? "",
          texto: corpo.message.text ?? "",
        });
        res.writeHead(200, { "content-type": "application/json" });
        res.end(
          JSON.stringify({ message_id: `mid-do-teste-${meta.enviadas.length}`, recipient_id: "r-1" })
        );
      });
      return;
    }
    meta.desconhecidos.push(`${req.method} ${u.pathname}?${u.searchParams.toString()}`);
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: { message: `a Meta falsa não conhece ${u.pathname}` } }));
  });

  await new Promise<void>((pronto) => servidor.listen(0, "127.0.0.1", pronto));
  const porta = (servidor.address() as AddressInfo).port;
  process.env.IG_GRAPH_BASE = `http://127.0.0.1:${porta}`;
  // A SEGUNDA FRONTEIRA (o cabeçalho de `lote.integracao.ts` a documenta):
  // `drainQueue` chama `scheduleTick` quando sobra item pendente, e quem a
  // segura é `qstashEnabled()`, falso sem `QSTASH_TOKEN`.
  delete process.env.QSTASH_TOKEN;

  // O import vem DEPOIS de o harness ter apontado a DATABASE_URL para o schema
  // temporário: `app/contatos/actions.ts` puxa `lib/db`, e o `_sql` de lá é
  // singleton de módulo que lê o ambiente na primeira chamada.
  acoes = (await import("@/app/contatos/actions")) as ModuloAcoes;
  ig = (await import("@/lib/ig")) as ModuloIg;
  conta = (await import("@/lib/account")) as ModuloConta;

  // FALHA ANTES DE QUALQUER REQUISIÇÃO, e não depois — a mesma guarda de
  // `portao-link.integracao.ts`, pela mesma razão.
  if (ig.baseDoGraph() !== process.env.IG_GRAPH_BASE) {
    throw new Error(
      `RECUSADO: a base do Graph é ${ig.baseDoGraph()}, e tinha de ser a desta ` +
        `rodada (${process.env.IG_GRAPH_BASE}). Sem o desvio, este teste tentaria ` +
        `ENVIAR pela Meta de verdade.`
    );
  }
});

afterAll(async () => {
  delete process.env.IG_GRAPH_BASE;
  await new Promise<void>((pronto) => servidor.close(() => pronto()));
});

// ---------------------------------------------------------------------------
// O DESFECHO DE UMA AÇÃO, lido do jeito que o Next o publica.
// ---------------------------------------------------------------------------

type Desfecho = {
  /** O `digest` da exceção de controle de fluxo, ou `null` se a ação VOLTOU. */
  digest: string | null;
  /** A URL de dentro do `redirect`, ou `null` quando não houve redirect. */
  url: string | null;
};

/**
 * O formato do `digest` é `NEXT_REDIRECT;<tipo>;<url>;<código>;` — a fatia do
 * meio é a URL, e ela é remontada com `;` para o caso de o próprio texto do
 * aviso conter um ponto e vírgula.
 *
 * Afirmar o PREFIXO é de propósito, como em `portas-de-publicar.integracao.ts`:
 * o dia em que o Next mudar essa marca, estes casos ficam VERMELHOS em vez de
 * passar a não medir nada.
 */
function urlDoDigest(digest: string | null): string | null {
  if (digest === null || !digest.startsWith("NEXT_REDIRECT;")) return null;
  const partes = digest.split(";");
  return partes.slice(2, -2).join(";");
}

/**
 * Roda a ação dentro do contexto de requisição e devolve o que ela publicou.
 *
 * NÃO deixa a exceção passar: uma ação que VOLTA (sem lançar) tem de virar
 * `digest: null` e uma asserção legível, e não um teste que morre com a
 * mensagem de outra pessoa. É essa distinção que mata P8 e P9.
 */
async function desfechoDe(rota: string, acao: () => Promise<unknown>): Promise<Desfecho> {
  const { valor } = await comoNumaRequisicao(rota, async () => {
    try {
      await acao();
      return null as string | null;
    } catch (e) {
      const digest = (e as { digest?: unknown }).digest;
      if (typeof digest === "string") return digest;
      // Erro de verdade: relançar. Engoli-lo aqui transformaria uma falha da
      // ação num `digest` nulo, indistinguível de P8.
      throw e;
    }
  });
  return { digest: valor, url: urlDoDigest(valor) };
}

/** O aviso que viajou na URL, já decodificado — texto e tom, como a tela os lê. */
function avisoDaUrlDeVolta(url: string | null): { texto: string | null; tom: string | null } {
  if (url === null) return { texto: null, tom: null };
  const sp = new URL(url, "http://127.0.0.1").searchParams;
  return { texto: sp.get("aviso"), tom: sp.get("tom") };
}

// ---------------------------------------------------------------------------
// Semear. Nada aqui decide nada.
// ---------------------------------------------------------------------------

/**
 * Um contato desta conta, já com `username` (nenhum caso precisa buscar perfil).
 *
 * `horasDesdeAResposta: 0` é a janela de 24h ABERTA — o dreno envia na hora.
 */
async function semearContato(
  igId: string,
  opts: { horasDesdeAResposta: number; categoria?: string | null }
) {
  await banco
    .db()
    .sql()
    .query(
      `insert into contacts (account_id, ig_id, username, last_reply_at, categoria)
       values ($1, $2, 'pessoa_de_teste', now() - make_interval(hours => $3::int), $4)
       on conflict (account_id, ig_id) do update
         set last_reply_at = excluded.last_reply_at, categoria = excluded.categoria`,
      [CONTA, igId, opts.horasDesdeAResposta, opts.categoria ?? null]
    );
}

/** O pedido que o formulário de `/contatos` manda, campo por campo. */
function pedidoDeLote(campos: {
  categoria: string;
  texto: string;
  url?: string;
  rotulo?: string;
  validoAte?: string;
  confirmado?: boolean;
}): FormData {
  const form = new FormData();
  form.set("categoria", campos.categoria);
  form.set("texto", campos.texto);
  if (campos.url !== undefined) form.set("url", campos.url);
  if (campos.rotulo !== undefined) form.set("rotulo", campos.rotulo);
  // O `<input type="date">` sempre existe no DOM — vazio ele manda "".
  form.set("valido_ate", campos.validoAte ?? "");
  if (campos.confirmado ?? true) form.set("confirmado", "1");
  return form;
}

/** Os status dos itens de fila deste contato, do mais novo para o mais velho. */
async function statusDosItens(igId: string): Promise<string[]> {
  const linhas = (await banco
    .db()
    .sql()
    .query(
      `select status from queue where account_id = $1 and contact_ig_id = $2
        order by created_at desc, id desc`,
      [CONTA, igId]
    )) as { status: string }[];
  return linhas.map((l) => l.status);
}

// ===========================================================================
// PRIMEIRO BLOCO: O SCHEMA AINDA NÃO TEM CONTA NENHUMA.
//
// Este é o único jeito honesto de alcançar a recusa "sem conta" sem tocar em
// cookie: `getSelectedAccount` devolve `null` quando `listAccounts()` volta
// vazia, e é isso — e não uma sessão inventada — que este bloco usa.
// ===========================================================================
describe("as recusas de quem ainda não conectou conta nenhuma", () => {
  test("a condição deste bloco é o schema SEM conta — e ele confere isso antes de medir", async () => {
    const { valor } = await comoNumaRequisicao("/contatos", () =>
      conta.getSelectedAccountId()
    );
    expect(valor).toBe(null);
  });

  test("enviarLote recusa sem conta com a frase que diz o que fazer, e não em silêncio", async () => {
    const d = await desfechoDe("/contatos", () =>
      acoes.enviarLote(pedidoDeLote({ categoria: "tudo", texto: "oi" }))
    );
    expect(d.digest ?? "").toMatch(/^NEXT_REDIRECT/);
    const aviso = avisoDaUrlDeVolta(d.url);
    expect(aviso.texto).toBe("Conecte uma conta do Instagram primeiro.");
    expect(aviso.tom).toBe("erro");
  });
});

// ===========================================================================
// SEGUNDO BLOCO: a conta existe, e as ações agem.
// ===========================================================================
describe("enviarLote termina falando, e o que ela diz é contado do lote certo", () => {
  beforeAll(async () => {
    await banco.db().upsertAccount({
      ig_user_id: CONTA,
      username: "conta_do_sexto_caminho",
      name: "Conta do sexto caminho",
      profile_picture_url: null,
      access_token: TOKEN,
      token_expires_at: null,
    });
  });

  test("a conta chega às ações sem cookie nenhum, pelo tombo declarado", async () => {
    const { valor } = await comoNumaRequisicao("/contatos", () =>
      conta.getSelectedAccountId()
    );
    expect(valor).toBe(CONTA);
  });

  // -------------------------------------------------------------------------
  // O CASO CENTRAL — e é ele que mata os TRÊS sobreviventes de uma vez.
  //
  //   P8 (apagar o `redirect` de sucesso) -> `digest` vem NULO.
  //   P9 (`redirect` dentro do `try/catch` que engole) -> `digest` vem NULO,
  //      porque `redirect` funciona LANÇANDO e o `catch {}` o come.
  //   P4 (`payload->>'loteId'` no lugar de `lote_id`) -> a contagem zera, e a
  //      frase deixa de dizer que alguém recebeu.
  //
  // A pessoa tem a janela ABERTA, então o dreno que `enviarLote` dispara envia
  // de verdade — pela Meta falsa, conferida no fim do caso. É esse envio que dá
  // à contagem um `sent` para achar; sem ele, P4 seria indistinguível do certo.
  // -------------------------------------------------------------------------
  test("o sucesso volta pelo redirect, e a frase conta quem recebeu AGORA", async () => {
    const CONTATO = "9100000000000201";
    await semearContato(CONTATO, { horasDesdeAResposta: 0 });

    const d = await desfechoDe("/contatos", () =>
      acoes.enviarLote(pedidoDeLote({ categoria: "tudo", texto: "A turma abre segunda" }))
    );

    // A AÇÃO LANÇOU. Sem esta linha, P8 e P9 continuariam verdes: uma ação que
    // volta calada é indistinguível de uma que concluiu, que é o defeito que
    // esta branch inteira existe para fechar.
    expect(d.digest ?? "").toMatch(/^NEXT_REDIRECT/);

    const aviso = avisoDaUrlDeVolta(d.url);
    expect(aviso.tom).toBe("ok");
    expect(aviso.texto).toContain("1 pessoa recebeu agora");

    // E SAIU DE VERDADE: a coluna que o motor escreve, e o pedido que chegou na
    // outra ponta do fio.
    expect(await statusDosItens(CONTATO)).toEqual(["sent"]);
    expect(meta.enviadas.map((e) => e.destinatario)).toContain(CONTATO);
    expect(meta.desconhecidos).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // O RECORTE ATRAVESSA A RECUSA — o Crítico de 01/09 pela porta do `redirect`.
  //
  // `?categoria=` AUSENTE ("tudo") e PRESENTE-E-VAZIO ("sem categoria") são
  // pedidos DIFERENTES, e a URL de volta tem de preservar a distinção. Aqui ela
  // é medida no caminho de RECUSA, que é onde é mais fácil de esquecer.
  // -------------------------------------------------------------------------
  test("a ficha sem categoria volta para a ficha sem categoria, e não para a conta inteira", async () => {
    const d = await desfechoDe("/contatos", () =>
      acoes.enviarLote(pedidoDeLote({ categoria: "uma:", texto: "oi", url: "quero entrar" }))
    );
    expect(d.digest ?? "").toMatch(/^NEXT_REDIRECT/);
    // PRESENTE-E-VAZIO: o parâmetro existe e não tem valor. `?aviso=` sozinho
    // não bastaria como prova — é a presença de `categoria=` que se mede.
    expect(d.url ?? "").toMatch(/^\/contatos\?categoria=&/);
    expect(avisoDaUrlDeVolta(d.url).texto).toContain("não é uma URL válida");
  });

  test("o lote sem a confirmação marcada não enfileira nada, e diz o que fazer", async () => {
    const CONTATO = "9100000000000202";
    await semearContato(CONTATO, { horasDesdeAResposta: 0 });

    const d = await desfechoDe("/contatos", () =>
      acoes.enviarLote(
        pedidoDeLote({ categoria: "tudo", texto: "sem confirmar", confirmado: false })
      )
    );
    expect(avisoDaUrlDeVolta(d.url).texto).toBe("Marque a confirmação antes de mandar.");
    expect(avisoDaUrlDeVolta(d.url).tom).toBe("erro");
    expect(await statusDosItens(CONTATO)).toEqual([]);
  });
});
