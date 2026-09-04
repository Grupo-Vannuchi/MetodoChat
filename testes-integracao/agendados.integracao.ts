// O CAMINHO DE VER, CANCELAR E REMARCAR O AGENDADO — `app/publicar/agendados/actions.ts`.
//
// -----------------------------------------------------------------------------
// POR QUE ELE EXISTE, E POR QUE É AQUI QUE O DEFEITO MORA
//
// As duas ações desta entrega são `update` CONDICIONAIS, e as três condições do
// `where` de cada uma são três defesas diferentes:
//
//   `status = 'pending'`  fecha a corrida com o dreno
//   `account_id`          impede cancelar o post de OUTRA conta
//   `kind = 'publicacao'` impede que um identificador trocado atinja uma MENSAGEM
//
// NENHUMA DAS TRÊS É VISÍVEL PARA OS QUATRO PORTÕES. Apagar qualquer uma delas
// passa por lint, typecheck, a suíte pura e a varredura — é a mesma cegueira que
// `enviarLote` mediu em 02/09, quando três perguntas soltas no corpo de uma ação
// eram invisíveis, e uma delas mandava a ficha "sem categoria" para a conta
// INTEIRA. Só um caminho que fale com o banco de verdade acusa.
//
// A CORRIDA COM O DRENO É A PEÇA CENTRAL DA ENTREGA. O dreno reivindica o item
// com `update ... set status='sending' where status='pending' and not_before <=
// now() ... for update skip locked`, e ele roda DENTRO do webhook — a qualquer
// instante. Entre a lista ser desenhada e o clique em cancelar, o item pode já
// estar em voo. Responder "cancelado" nesse caso seria a pior mentira que este
// painel pode contar: o dono fecharia a tela achando que impediu um post que já
// está no ar, e a API do Instagram NÃO APAGA MÍDIA (medido em 03/09 —
// `DELETE /{ig-media-id}` só existe no caminho do Login do Facebook).
//
// -----------------------------------------------------------------------------
// A MAQUINARIA É A DE `publicar-fala.integracao.ts`, e este arquivo não inventa
// nenhuma. `comoNumaRequisicao` (./semear-requisicao.ts) monta o contexto de
// requisição do Next SEM FORJAR COOKIE NENHUM — leia o cabeçalho de lá antes de
// mexer aqui. `desfechoDe` e `avisoDaUrlDeVolta` são a mesma leitura do `digest`
// daquele arquivo, copiada e não importada, pelo mesmo motivo de lá.
//
// A META FALSA E O BUCKET FALSO são os mesmos: um servidor HTTP na própria
// máquina para cada ponta, com `IG_GRAPH_BASE` e `SUPABASE_URL` presas ao
// loopback por guardas que falham ANTES de qualquer requisição sair.
// **NADA É PUBLICADO NO INSTAGRAM DE VERDADE, E NADA É ESCRITO NO BUCKET DE
// VERDADE POR ESTE ARQUIVO.**
//
// -----------------------------------------------------------------------------
// NENHUM COOKIE É FORJADO. A jarra sai vazia, e `getSelectedAccount` cai na
// PRIMEIRA conta do schema — o tombo DECLARADO da própria função. Por isso as
// contas nascem em ORDEM: CONTA_A primeiro, CONTA_B depois, e é essa ordem — não
// um cookie — que faz CONTA_A ser "a conta selecionada". O bloco confere essa
// precondição antes de medir.
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { bancoDescartavel } from "./harness";
import { comoNumaRequisicao } from "./semear-requisicao";

type ModuloAcoes = typeof import("@/app/publicar/agendados/actions");
type ModuloDreno = typeof import("@/lib/queue-drain");
type ModuloIg = typeof import("@/lib/ig");
type ModuloConta = typeof import("@/lib/account");

const banco = bancoDescartavel();

const CONTA_A = "17800000000002001";
const CONTA_B = "17800000000002002";
// Valores inventados. Nenhuma credencial de verdade entra em teste.
const TOKEN_A = "token-da-conta-a-dos-agendados-que-nao-vale-nada";
const TOKEN_B = "token-da-conta-b-dos-agendados-que-nao-vale-nada";
const CHAVE_DO_BUCKET_FALSO = "chave-de-servico-inventada-para-o-teste";
const BUCKET = "MetodoChatDeTeste";

const meta = {
  containers: [] as { igUserId: string; token: string }[],
  publicacoes: [] as { igUserId: string; token: string }[],
  desconhecidos: [] as string[],
};

let servidorMeta: Server;
let servidorBucket: Server;
let acoes: ModuloAcoes;
let dreno: ModuloDreno;
let ig: ModuloIg;
let conta: ModuloConta;

function responderJson(res: ServerResponse, corpo: unknown) {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify(corpo));
}

function corpoDe(req: IncomingMessage): Promise<string> {
  return new Promise((pronto) => {
    const pedacos: Buffer[] = [];
    req.on("data", (d: Buffer) => pedacos.push(d));
    req.on("end", () => pronto(Buffer.concat(pedacos).toString("utf8")));
  });
}

beforeAll(async () => {
  servidorMeta = createServer(async (req, res) => {
    const u = new URL(req.url ?? "/", "http://127.0.0.1");
    const token = u.searchParams.get("access_token") ?? "";
    const partes = u.pathname.split("/").filter(Boolean);
    const ultimo = partes[partes.length - 1] ?? "";
    const penultimo = partes[partes.length - 2] ?? "";

    if (req.method === "POST" && ultimo === "media") {
      meta.containers.push({ igUserId: penultimo, token });
      return responderJson(res, { id: `container-${meta.containers.length}` });
    }
    if (req.method === "POST" && ultimo === "media_publish") {
      await corpoDe(req);
      meta.publicacoes.push({ igUserId: penultimo, token });
      return responderJson(res, { id: `media-${meta.publicacoes.length}` });
    }
    if (req.method === "GET" && ultimo === "content_publishing_limit") {
      return responderJson(res, {
        config: { quota_total: 100, quota_duration: 86400 },
        quota_usage: 0,
      });
    }
    if (req.method === "GET" && (u.searchParams.get("fields") ?? "").includes("status_code")) {
      return responderJson(res, { id: ultimo, status_code: "FINISHED" });
    }
    meta.desconhecidos.push(`${req.method} ${u.pathname}`);
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: { message: `a Meta falsa nao conhece ${u.pathname}` } }));
  });

  servidorBucket = createServer((req, res) => {
    const u = new URL(req.url ?? "/", "http://127.0.0.1");
    const prefixo = `/storage/v1/object/${BUCKET}/`;
    if (req.method === "DELETE" && u.pathname.startsWith(prefixo)) {
      return responderJson(res, { message: "ok" });
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ message: "o bucket falso nao conhece esse caminho" }));
  });

  await new Promise<void>((pronto) => servidorMeta.listen(0, "127.0.0.1", pronto));
  await new Promise<void>((pronto) => servidorBucket.listen(0, "127.0.0.1", pronto));

  process.env.IG_GRAPH_BASE = `http://127.0.0.1:${(servidorMeta.address() as AddressInfo).port}`;
  process.env.SUPABASE_URL = `http://127.0.0.1:${(servidorBucket.address() as AddressInfo).port}`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = CHAVE_DO_BUCKET_FALSO;
  process.env.SUPABASE_BUCKET = BUCKET;
  // A SEGUNDA FRONTEIRA, herdada de `publicacao.integracao.ts`: sem token,
  // `scheduleTick` não sai da máquina.
  delete process.env.QSTASH_TOKEN;

  acoes = (await import("@/app/publicar/agendados/actions")) as ModuloAcoes;
  dreno = (await import("@/lib/queue-drain")) as ModuloDreno;
  ig = (await import("@/lib/ig")) as ModuloIg;
  conta = (await import("@/lib/account")) as ModuloConta;

  // AS DUAS GUARDAS, ANTES DE QUALQUER REQUISIÇÃO.
  if (ig.baseDoGraph() !== process.env.IG_GRAPH_BASE) {
    throw new Error(
      `RECUSADO: a base do Graph é ${ig.baseDoGraph()}, e tinha de ser a desta ` +
        `rodada (${process.env.IG_GRAPH_BASE}). Sem o desvio, este teste tentaria ` +
        `PUBLICAR no Instagram de verdade.`
    );
  }
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(process.env.SUPABASE_URL ?? "")) {
    throw new Error(
      "RECUSADO: a SUPABASE_URL desta rodada não é loopback. Sem isso, este " +
        "teste apagaria arquivos do bucket de verdade."
    );
  }

  // AS CONTAS NASCEM EM ORDEM. CONTA_A primeiro — ver o cabeçalho.
  for (const [id, token, nome] of [
    [CONTA_A, TOKEN_A, "conta_a_dos_agendados"],
    [CONTA_B, TOKEN_B, "conta_b_dos_agendados"],
  ] as const) {
    await banco.db().upsertAccount({
      ig_user_id: id,
      username: nome,
      name: nome,
      profile_picture_url: null,
      access_token: token,
      token_expires_at: null,
    });
  }
});

afterAll(async () => {
  delete process.env.IG_GRAPH_BASE;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_BUCKET;
  await new Promise<void>((pronto) => servidorMeta.close(() => pronto()));
  await new Promise<void>((pronto) => servidorBucket.close(() => pronto()));
});

// ---------------------------------------------------------------------------
// O DESFECHO DE UM SERVER ACTION — cópia local da leitura de
// `publicar-fala.integracao.ts`. `redirect()` funciona LANÇANDO, e é isso que
// torna a saída assertável: uma ação que VOLTA (sem lançar) vira `digest: null`,
// e não um teste que morre com a mensagem de outra pessoa. É essa distinção que
// mata o plantio do `redirect` movido para dentro de um `try/catch`.
// ---------------------------------------------------------------------------

type Desfecho = { digest: string | null; url: string | null };

function urlDoDigest(digest: string | null): string | null {
  if (digest === null || !digest.startsWith("NEXT_REDIRECT;")) return null;
  return digest.split(";").slice(2, -2).join(";");
}

async function desfechoDe(
  acao: (form: FormData) => Promise<void>,
  form: FormData
): Promise<Desfecho> {
  const { valor } = await comoNumaRequisicao("/publicar/agendados", async () => {
    try {
      await acao(form);
      return null as string | null;
    } catch (e) {
      const digest = (e as { digest?: unknown }).digest;
      if (typeof digest === "string") return digest;
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
// Semear e ler. Nada aqui decide nada.
// ---------------------------------------------------------------------------

let semente = 0;

/** Um item de fila, gravado direto. O `not_before` e o `status` são
 *  PARÂMETRO porque é justamente sobre eles que as três defesas decidem. */
async function semear(item: {
  conta: string;
  kind?: string;
  status?: string;
  /** Segundos a partir de agora. Negativo é passado — o que o dreno reivindica. */
  emSegundos?: number;
}): Promise<string> {
  semente++;
  const kind = item.kind ?? "publicacao";
  const payload =
    kind === "publicacao"
      ? { forma: "imagem", caminhos: [`${item.conta}/agendado-${semente}.jpg`] }
      : { text: "uma mensagem qualquer" };
  const linhas = (await banco
    .db()
    .sql()
    .query(
      `insert into queue (account_id, kind, contact_ig_id, payload, dedupe_key, status,
                          not_before)
       values ($1, $2, $3, $4, $5, $6, now() + make_interval(secs => $7::int))
       returning id`,
      [
        item.conta,
        kind,
        kind === "publicacao" ? null : "99000000000001",
        payload,
        `agendados-teste-${semente}`,
        item.status ?? "pending",
        item.emSegundos ?? 3600,
      ]
    )) as { id: string }[];
  return linhas[0].id;
}

type LinhaDaFila = { id: string; status: string; error: string | null; not_before: Date };

async function lerItem(id: string): Promise<LinhaDaFila> {
  const linhas = (await banco
    .db()
    .sql()
    .query(`select id, status, error, not_before from queue where id = $1`, [id])) as LinhaDaFila[];
  return linhas[0];
}

/** O formulário de cancelar, com os mesmos `name` do JSX da tela. */
function pedidoDeCancelar(id: string, confirmo: string | null = "1"): FormData {
  const form = new FormData();
  form.set("id", id);
  if (confirmo !== null) form.set("confirmo", confirmo);
  return form;
}

/** O formulário de remarcar. `fuso` "0" é UTC, para o instante escrito no campo
 *  ser o mesmo que o banco guarda — sem conta nenhuma no meio para errar. */
function pedidoDeRemarcar(id: string, dataHora: string): FormData {
  const form = new FormData();
  form.set("id", id);
  form.set("data_hora", dataHora);
  form.set("fuso", "0");
  return form;
}

/** Um instante em UTC, escrito como o `<input type="datetime-local">` o manda. */
function campoDeDataHora(instante: number): string {
  return new Date(instante).toISOString().slice(0, 16);
}

describe("com a conta selecionada pelo tombo declarado (a primeira do schema)", () => {
  test("a condição deste bloco é CONTA_A vir sem cookie nenhum — e ele confere isso antes de medir", async () => {
    const { valor } = await comoNumaRequisicao("/publicar/agendados", () =>
      conta.getSelectedAccountId()
    );
    expect(valor).toBe(CONTA_A);
  });

  // =========================================================================
  // O CONTROLE POSITIVO, E ELE VEM PRIMEIRO DE PROPOSITO.
  //
  // O caso seguinte prova que um post CANCELADO nao sai no dreno. Sozinho, ele
  // nao distingue "o cancelamento funcionou" de "este harness nao publica
  // nada" — que e a forma classica de um instrumento passar sem medir. Este
  // caso fixa o outro lado: um item pendente e vencido SAI, pela Meta falsa,
  // com o token da conta certa.
  //
  // A HORA VENCIDA VEM DO RELOGIO DO BANCO (`now() + make_interval(...)` em
  // `semear`), e nao do da maquina: os dois estao a ~50 segundos de distancia
  // aqui, e a condicao do dreno (`not_before <= now()`) e julgada pelo do
  // banco. E a mesma licao que `drainQueue` ja documenta.
  // =========================================================================
  test("o controle positivo: um item pendente e vencido SAI no dreno", async () => {
    const id = await semear({ conta: CONTA_A, emSegundos: -30 });

    await comoNumaRequisicao("/publicar/agendados", () => dreno.drainQueue());

    expect((await lerItem(id)).status).toBe("sent");
    expect(meta.publicacoes.at(-1)).toEqual({ igUserId: CONTA_A, token: TOKEN_A });
  });

  // =========================================================================
  // O CASO CENTRAL DO CANCELAR, e o PLANTIO 4 mora aqui: o item está `pending`
  // e a hora dele JÁ CHEGOU, ou seja o dreno o levaria na próxima passada.
  // Cancelar tem de tirá-lo de circulação, e o dreno seguinte não pode publicar
  // nada — que é a única prova que interessa a quem clicou.
  // =========================================================================
  test("cancelar um item pendente funciona, e ele NÃO sai no dreno seguinte", async () => {
    const id = await semear({ conta: CONTA_A, emSegundos: -30 });
    const containersAntes = meta.containers.length;

    const d = await desfechoDe(acoes.cancelarPublicacao, pedidoDeCancelar(id));

    // A AÇÃO LANÇOU. Sem esta linha, o plantio do `redirect` movido para dentro
    // de um `try/catch` continuaria verde: uma ação que volta calada é
    // indistinguível de uma que concluiu.
    expect(d.digest ?? "").toMatch(/^NEXT_REDIRECT/);
    const aviso = avisoDaUrlDeVolta(d.url);
    expect(aviso.tom).toBe("ok");
    expect(aviso.texto).toContain("Post cancelado");

    const antes = await lerItem(id);
    expect(antes.status).toBe("skipped");
    expect(antes.error).toBe("cancelado por voce");

    // E O DRENO SEGUINTE NÃO O PUBLICA. É aqui que "cancelado" deixa de ser uma
    // palavra na tela e vira um fato.
    await comoNumaRequisicao("/publicar/agendados", () => dreno.drainQueue());
    expect((await lerItem(id)).status).toBe("skipped");
    expect(meta.containers.length).toBe(containersAntes);
  });

  // =========================================================================
  // A CORRIDA COM O DRENO, e o PLANTIO 1 mora aqui.
  //
  // O item já foi reivindicado (`sending`). Tirar `status = 'pending'` do
  // `where` faria esta ação cancelar um post EM VOO — e responder "cancelado"
  // sobre um post que já está a caminho do perfil público.
  // =========================================================================
  test("cancelar um item já em voo NÃO o cancela, e a frase diz que ele saiu", async () => {
    const id = await semear({ conta: CONTA_A, status: "sending", emSegundos: -30 });

    const d = await desfechoDe(acoes.cancelarPublicacao, pedidoDeCancelar(id));

    expect(d.digest ?? "").toMatch(/^NEXT_REDIRECT/);
    const aviso = avisoDaUrlDeVolta(d.url);
    // O TOM É VERMELHO. A faixa é lida antes da frase, e um "tarde demais"
    // pintado de verde contaria a mentira central só pela cor.
    expect(aviso.tom).toBe("erro");
    // A FRASE DIZ QUE O POST SAIU, e não só que o cancelamento falhou: são
    // fatos diferentes, e o segundo sozinho manda tentar de novo.
    expect((aviso.texto ?? "").toLowerCase()).toMatch(/saiu|saindo|publicad/);

    // E O ITEM CONTINUA EM VOO — nada foi tocado.
    const depois = await lerItem(id);
    expect(depois.status).toBe("sending");
    expect(depois.error).toBe(null);
  });

  // =========================================================================
  // A CONTA VEM DO COOKIE, NUNCA DO FORMULÁRIO, e o PLANTIO 2 mora aqui.
  //
  // O item é de CONTA_B, que NÃO é a selecionada. Tirar `account_id` do `where`
  // faria esta ação cancelar o post de outra conta a partir de um
  // `<input type="hidden">` trocado à mão.
  // =========================================================================
  test("cancelar um item de OUTRA conta não faz nada, e não conta sobre a fila alheia", async () => {
    // O ITEM DE CONTA_B NASCE NO FUTURO, e isso e do instrumento e nao do
    // caso: com a hora vencida, o dreno de um teste seguinte publicaria o post
    // DELA — legitimamente, porque e a fila dela — e sujaria a leitura de
    // `meta.publicacoes` no ultimo caso deste arquivo.
    const id = await semear({ conta: CONTA_B, emSegundos: 3600 });

    const d = await desfechoDe(acoes.cancelarPublicacao, pedidoDeCancelar(id));

    expect(d.digest ?? "").toMatch(/^NEXT_REDIRECT/);
    const aviso = avisoDaUrlDeVolta(d.url);
    expect(aviso.tom).toBe("erro");
    // "NÃO ACHEI", e não "já saiu": a segunda consulta também filtra por
    // `account_id`, então a tela não afirma nada sobre o post de outra conta.
    expect(aviso.texto).toContain("Não achei este post agendado nesta conta");
    expect((aviso.texto ?? "").toLowerCase()).not.toMatch(/saiu|saindo/);

    // O ITEM DE CONTA_B CONTINUA INTEIRO.
    const depois = await lerItem(id);
    expect(depois.status).toBe("pending");
    expect(depois.error).toBe(null);
  });

  // =========================================================================
  // O `kind` É A TERCEIRA DEFESA, e o PLANTIO 3 mora aqui.
  //
  // O `id` de `queue` é `uuid` e a tabela é a MESMA para os onze tipos: sem
  // `kind = 'publicacao'` no `where`, um identificador trocado atingiria uma
  // MENSAGEM da fila — que sairia da fila com "cancelado por voce" sem ninguém
  // ter pedido nada disso.
  // =========================================================================
  test("cancelar um dm_manual pelo identificador não faz nada", async () => {
    const id = await semear({ conta: CONTA_A, kind: "dm_manual", emSegundos: 3600 });

    const d = await desfechoDe(acoes.cancelarPublicacao, pedidoDeCancelar(id));

    expect(d.digest ?? "").toMatch(/^NEXT_REDIRECT/);
    const aviso = avisoDaUrlDeVolta(d.url);
    expect(aviso.tom).toBe("erro");
    expect(aviso.texto).toContain("Não achei este post agendado nesta conta");

    // A MENSAGEM CONTINUA NA FILA, e vai sair como sempre.
    const depois = await lerItem(id);
    expect(depois.status).toBe("pending");
    expect(depois.error).toBe(null);
  });

  test("cancelar sem marcar a confirmação não cancela nada", async () => {
    const id = await semear({ conta: CONTA_A, emSegundos: 3600 });

    const d = await desfechoDe(acoes.cancelarPublicacao, pedidoDeCancelar(id, null));

    expect(d.digest ?? "").toMatch(/^NEXT_REDIRECT/);
    const aviso = avisoDaUrlDeVolta(d.url);
    expect(aviso.tom).toBe("erro");
    // A FRASE DIZ QUE NADA ACONTECEU. O pior desfecho aqui é a pessoa achar que
    // cancelou por ter clicado no botão.
    expect(aviso.texto).toContain("Nada foi cancelado");
    expect((await lerItem(id)).status).toBe("pending");
  });

  test("um identificador que não é uuid vira 'não achei', e não uma tela de erro", async () => {
    // Sem `identificadorDaFila`, este texto iria cru para uma coluna `uuid` e o
    // POSTGRES é quem recusaria — com uma exceção subindo pela ação.
    const d = await desfechoDe(acoes.cancelarPublicacao, pedidoDeCancelar("nao-sou-uuid"));
    expect(d.digest ?? "").toMatch(/^NEXT_REDIRECT/);
    expect(avisoDaUrlDeVolta(d.url).texto).toContain("Não achei este post agendado");
  });

  // =========================================================================
  // REMARCAR
  // =========================================================================

  // =========================================================================
  // "O ITEM SAI NA HORA NOVA" É MEDIDO PELA METADE QUE ESTA MÁQUINA CONSEGUE
  // MEDIR, e a outra metade está NOMEADA em vez de fingida.
  //
  // O plano pedia um caso de ponta a ponta: remarcar e ver o post sair na hora
  // nova. Ele NÃO é alcançável aqui, e a razão foi medida, não suposta: o
  // relógio desta máquina está ~49,8 s À FRENTE do banco (o mesmo desvio que
  // `drainQueue` já documenta, lá em 53,9 s). As duas barreiras julgam por
  // relógios diferentes:
  //
  //   `momentoDaPublicacao` recusa o que estiver mais de 60 s no passado — pelo
  //      relógio da APLICAÇÃO;
  //   o dreno reivindica o que tiver `not_before <= now()` — pelo relógio do
  //      BANCO, ~50 s atrás.
  //
  // A janela em que um `datetime-local` satisfaz as duas tem ~10 segundos, e
  // uma borda de minuto raramente cai dentro dela. Um caso escrito assim
  // passaria ou falharia pelo RELÓGIO, e não pelo código — que é pior do que
  // não existir. Em produção o desvio é de milissegundos (Vercel e banco no
  // mesmo lado), então o caminho de ponta a ponta é real lá e não aqui.
  //
  // O QUE SOBRA É PROVÁVEL, E É PROVADO: a hora nova é gravada EXATAMENTE, e o
  // dreno OBEDECE a ela — não publica antes dela. Com o controle positivo lá em
  // cima (um item vencido sai), a corrente fica fechada nos dois sentidos.
  // =========================================================================
  test("remarcar troca a hora do item, e o dreno obedece a hora NOVA", async () => {
    // Ele nasce marcado para daqui a um mês.
    const id = await semear({ conta: CONTA_A, emSegundos: 30 * 24 * 3600 });
    const alvo = Math.floor((Date.now() + 3 * 24 * 3600 * 1000) / 60000) * 60000;
    const containersAntes = meta.containers.length;

    const d = await desfechoDe(
      acoes.remarcarPublicacao,
      pedidoDeRemarcar(id, campoDeDataHora(alvo))
    );

    expect(d.digest ?? "").toMatch(/^NEXT_REDIRECT/);
    const aviso = avisoDaUrlDeVolta(d.url);
    expect(aviso.tom).toBe("ok");
    expect(aviso.texto).toContain("Post remarcado");

    // A HORA NOVA ESTÁ GRAVADA, ao minuto — e não "por volta de".
    const depois = await lerItem(id);
    expect(depois.not_before.getTime()).toBe(alvo);
    expect(depois.status).toBe("pending");

    // E O DRENO NÃO O PUBLICA ANTES DELA. O item continua na fila, e nenhum
    // contêiner nasceu deste pedido.
    await comoNumaRequisicao("/publicar/agendados", () => dreno.drainQueue());
    expect((await lerItem(id)).status).toBe("pending");
    expect(meta.containers.length).toBe(containersAntes);
  });

  test("remarcar para o passado é recusado, com a frase que já existe", async () => {
    const id = await semear({ conta: CONTA_A, emSegundos: 3600 });
    const antes = await lerItem(id);

    const d = await desfechoDe(
      acoes.remarcarPublicacao,
      pedidoDeRemarcar(id, "2020-01-01T10:00")
    );

    expect(d.digest ?? "").toMatch(/^NEXT_REDIRECT/);
    const aviso = avisoDaUrlDeVolta(d.url);
    expect(aviso.tom).toBe("erro");
    // A MESMA FRASE DA TELA DE COMPOR, palavra por palavra: uma segunda redação
    // faria quem lê achar que apareceu um problema novo.
    expect(aviso.texto).toBe(
      "A hora escolhida já passou. Escolha um horário à frente — publicar agora é a outra opção, e ela é a que não dá para desfazer."
    );
    // E A HORA NÃO SE MEXEU.
    expect((await lerItem(id)).not_before.getTime()).toBe(antes.not_before.getTime());
  });

  test("remarcar uma data que não existe é recusado, e não transborda para março", async () => {
    const id = await semear({ conta: CONTA_A, emSegundos: 3600 });
    const antes = await lerItem(id);

    const d = await desfechoDe(acoes.remarcarPublicacao, pedidoDeRemarcar(id, "2027-02-30T10:00"));

    expect(avisoDaUrlDeVolta(d.url).texto).toBe(
      "A data e a hora escolhidas não formam um dia que existe. Confira e tente de novo."
    );
    expect((await lerItem(id)).not_before.getTime()).toBe(antes.not_before.getTime());
  });

  // O REMARCAR TEM AS MESMAS TRÊS DEFESAS, e elas não são as do cancelar: são
  // outro `update`, no mesmo arquivo, e apagar uma condição de um não apaga a do
  // outro. Estes dois casos são o par mínimo que prende as duas mais caras.
  test("remarcar um item de OUTRA conta não faz nada", async () => {
    const id = await semear({ conta: CONTA_B, emSegundos: 3600 });
    const antes = await lerItem(id);
    const alvo = Math.floor((Date.now() + 5 * 24 * 3600 * 1000) / 60000) * 60000;

    const d = await desfechoDe(acoes.remarcarPublicacao, pedidoDeRemarcar(id, campoDeDataHora(alvo)));

    expect(avisoDaUrlDeVolta(d.url).tom).toBe("erro");
    expect((await lerItem(id)).not_before.getTime()).toBe(antes.not_before.getTime());
  });

  test("remarcar um item já em voo NÃO o remarca, e a frase diz que ele saiu", async () => {
    const id = await semear({ conta: CONTA_A, status: "sending", emSegundos: -30 });
    const antes = await lerItem(id);
    const alvo = Math.floor((Date.now() + 5 * 24 * 3600 * 1000) / 60000) * 60000;

    const d = await desfechoDe(acoes.remarcarPublicacao, pedidoDeRemarcar(id, campoDeDataHora(alvo)));

    const aviso = avisoDaUrlDeVolta(d.url);
    expect(aviso.tom).toBe("erro");
    expect((aviso.texto ?? "").toLowerCase()).toMatch(/saiu|saindo|publicad/);
    expect((await lerItem(id)).not_before.getTime()).toBe(antes.not_before.getTime());
  });

  test("a Meta falsa não viu nenhum caminho que este arquivo não conheça", () => {
    expect(meta.desconhecidos).toEqual([]);
    // E NUNCA O TOKEN DE CONTA_B: nenhuma ação desta rodada a selecionou.
    expect(JSON.stringify(meta.publicacoes)).not.toContain(TOKEN_B);
  });
});
