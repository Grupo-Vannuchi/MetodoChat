// O OITAVO CAMINHO DA FRENTE 2: `app/publicar/actions.ts` — a ação nova que a
// Tarefa 5 escreveu e que NENHUM teste importava.
//
// -----------------------------------------------------------------------------
// POR QUE ELE EXISTE
//
// O relatório da Tarefa 5 (`t5-publicacao-report.md`) mediu o buraco e o
// nomeou em vez de escondê-lo: "Nenhum teste importa `app/publicar/actions.ts`
// — mas a maquinaria existe (`comoNumaRequisicao`, e o precedente
// `acoes-que-falam.integracao.ts`). Fica como pendência nomeada". Este arquivo
// fecha essa pendência.
//
// O plantio do dia mediu o mesmo defeito que fechou `app/contatos/actions.ts`
// em 02/09 (ver o cabeçalho de `acoes-que-falam.integracao.ts`, P9): mover o
// `redirect` de sucesso para DENTRO do `try { await drainQueue(); } catch {}`
// sobrevive aos quatro portões. `redirect()` funciona LANÇANDO — é assim que
// o Next corta a renderização e manda o navegador para outro lugar — e um
// `catch` vazio que devia só proteger a drenagem engole esse lançamento junto.
// A ação volta muda: a tela recarrega igual, e ninguém fica sabendo de nada.
//
// -----------------------------------------------------------------------------
// A MAQUINARIA JÁ EXISTIA, e este arquivo não inventa nenhuma.
//
// `comoNumaRequisicao` (./semear-requisicao.ts) monta o contexto de requisição
// do Next SEM FORJAR COOKIE NENHUM — leia o cabeçalho de lá antes de mexer
// aqui. `desfechoDe` e `avisoDaUrlDeVolta`, logo abaixo, são a mesma leitura do
// `digest` de `acoes-que-falam.integracao.ts` — não exportada de lá, por isso
// copiada aqui, e não importada.
//
// A META FALSA E O BUCKET FALSO são os de `publicacao.integracao.ts`: mesmo
// servidor HTTP na própria máquina para cada ponta, mesma `IG_GRAPH_BASE` e
// `SUPABASE_URL` presas ao loopback pelas guardas que falham ANTES de
// qualquer requisição sair. **NADA É PUBLICADO NO INSTAGRAM DE VERDADE, E
// NADA É ESCRITO NO BUCKET DE VERDADE POR ESTE ARQUIVO.**
//
// -----------------------------------------------------------------------------
// NENHUM COOKIE É FORJADO. A jarra de cookies sai vazia (ver
// `semear-requisicao.ts`), e `getSelectedAccount` cai na PRIMEIRA conta do
// schema — o tombo DECLARADO da própria função. Por isso as contas nascem em
// ORDEM: CONTA_A primeiro, CONTA_B depois, e é essa ordem — não um cookie —
// que faz CONTA_A ser "a conta selecionada" nos casos abaixo. O bloco que
// mede "conta certa" confere essa precondição antes de medir, pela mesma
// disciplina de `acoes-que-falam.integracao.ts`.
//
// -----------------------------------------------------------------------------
// O SEGUNDO PLANTIO OBRIGATÓRIO — a conta vinda do FORMULÁRIO, e não do cookie.
//
// `caminhosDoCampo` (lib/publicacao.ts) recebe a pasta da conta SELECIONADA
// (`pastaDaConta(conta.ig_user_id)`) e descarta todo caminho que não comece
// por ela — é a mesma porta que `alvoDoLote` (lib/lote.ts) fecha no envio em
// lote, filtrando por `pedido.conta` em vez de confiar no que a tela mandou.
// O teste "a conta certa" deste arquivo planta CONTA_B (não selecionada) e
// manda um caminho da pasta DELA: a ação tem de recusar (`sem_arquivo`), e
// nada pode entrar na fila apontando para o arquivo de outra conta. Um
// defeito que trocasse a pasta de referência por algo lido do FormData (em
// vez do `conta.ig_user_id` que veio do cookie) deixaria esse caminho passar
// — e é isso que este caso mede.
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

type ModuloAcoes = typeof import("@/app/publicar/actions");
type ModuloIg = typeof import("@/lib/ig");
type ModuloConta = typeof import("@/lib/account");

const banco = bancoDescartavel();

const CONTA_A = "17800000000001001";
const CONTA_B = "17800000000001002";
// Valores inventados. Nenhuma credencial de verdade entra em teste.
const TOKEN_A = "token-da-conta-a-que-nao-vale-nada";
const TOKEN_B = "token-da-conta-b-que-nao-vale-nada";
const CHAVE_DO_BUCKET_FALSO = "chave-de-servico-inventada-para-o-teste";
const BUCKET = "MetodoChatDeTeste";

const meta = {
  containers: [] as { igUserId: string; token: string }[],
  publicacoes: [] as { igUserId: string; token: string; creationId: string }[],
  desconhecidos: [] as string[],
};

const bucketFalso = {
  apagados: [] as string[],
};

let servidorMeta: Server;
let servidorBucket: Server;
let acoes: ModuloAcoes;
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
  // -------------------------------------------------------------------------
  // A META FALSA — sempre responde FINISHED e cota livre: o sucesso "agora"
  // precisa atravessar o dreno inteiro para chegar a `sent`.
  // -------------------------------------------------------------------------
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
      const params = new URLSearchParams(await corpoDe(req));
      meta.publicacoes.push({
        igUserId: penultimo,
        token,
        creationId: params.get("creation_id") ?? "",
      });
      return responderJson(res, { id: `media-${meta.publicacoes.length}` });
    }
    if (req.method === "GET" && ultimo === "content_publishing_limit") {
      return responderJson(res, { config: { quota_total: 100, quota_duration: 86400 }, quota_usage: 0 });
    }
    if (req.method === "GET" && (u.searchParams.get("fields") ?? "").includes("status_code")) {
      return responderJson(res, { id: ultimo, status_code: "FINISHED" });
    }
    meta.desconhecidos.push(`${req.method} ${u.pathname}?${u.searchParams.toString()}`);
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: { message: `a Meta falsa nao conhece ${u.pathname}` } }));
  });

  // -------------------------------------------------------------------------
  // O BUCKET FALSO — só o `DELETE`, a única chamada que o dreno faz depois de
  // publicar.
  // -------------------------------------------------------------------------
  servidorBucket = createServer((req, res) => {
    const u = new URL(req.url ?? "/", "http://127.0.0.1");
    const prefixo = `/storage/v1/object/${BUCKET}/`;
    if (req.method === "DELETE" && u.pathname.startsWith(prefixo)) {
      if (req.headers["apikey"] !== CHAVE_DO_BUCKET_FALSO) {
        res.writeHead(401, { "content-type": "application/json" });
        return res.end(JSON.stringify({ message: "sem apikey" }));
      }
      bucketFalso.apagados.push(decodeURIComponent(u.pathname.slice(prefixo.length)));
      return responderJson(res, { message: "ok" });
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ message: "o bucket falso nao conhece esse caminho" }));
  });

  await new Promise<void>((pronto) => servidorMeta.listen(0, "127.0.0.1", pronto));
  await new Promise<void>((pronto) => servidorBucket.listen(0, "127.0.0.1", pronto));
  const portaMeta = (servidorMeta.address() as AddressInfo).port;
  const portaBucket = (servidorBucket.address() as AddressInfo).port;

  process.env.IG_GRAPH_BASE = `http://127.0.0.1:${portaMeta}`;
  process.env.SUPABASE_URL = `http://127.0.0.1:${portaBucket}`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = CHAVE_DO_BUCKET_FALSO;
  process.env.SUPABASE_BUCKET = BUCKET;
  // A SEGUNDA FRONTEIRA, herdada de `publicacao.integracao.ts`: sem token,
  // `scheduleTick` não sai da máquina.
  delete process.env.QSTASH_TOKEN;

  // O IMPORT VEM DEPOIS de o harness ter apontado a DATABASE_URL para o schema
  // temporário e de os desvios de rede estarem no ambiente: `app/publicar/actions`
  // puxa `lib/db`, `lib/bucket` e `lib/engine`, e cada um lê o ambiente na
  // primeira chamada.
  acoes = (await import("@/app/publicar/actions")) as ModuloAcoes;
  ig = (await import("@/lib/ig")) as ModuloIg;
  conta = (await import("@/lib/account")) as ModuloConta;

  // AS DUAS GUARDAS, ANTES DE QUALQUER REQUISIÇÃO — a mesma disciplina de
  // `publicacao.integracao.ts`.
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
// `acoes-que-falam.integracao.ts` (não exportada de lá). Ver o cabeçalho
// daquele arquivo para a explicação inteira do porquê `redirect()` lançar é o
// que torna isto assertável.
// ---------------------------------------------------------------------------

type Desfecho = {
  digest: string | null;
  url: string | null;
};

function urlDoDigest(digest: string | null): string | null {
  if (digest === null || !digest.startsWith("NEXT_REDIRECT;")) return null;
  const partes = digest.split(";");
  return partes.slice(2, -2).join(";");
}

/**
 * Roda `publicar` dentro do contexto de requisição e devolve o que ela
 * publicou. NÃO deixa a exceção passar: uma ação que VOLTA (sem lançar) vira
 * `digest: null`, e não um teste que morre com a mensagem de outra pessoa. É
 * essa distinção que mata o plantio do `redirect` movido para dentro do
 * `try/catch`.
 */
async function desfechoDe(form: FormData): Promise<Desfecho> {
  const { valor } = await comoNumaRequisicao("/publicar", async () => {
    try {
      await acoes.publicar(form);
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

/** O pedido que o enviador (`app/publicar/enviador.tsx`) e a tela
 *  (`app/publicar/page.tsx`) mandam, campo por campo — os mesmos `name`. */
function pedidoDePublicar(campos: {
  forma?: string;
  caminhos?: string;
  legenda?: string;
  quando?: string;
  dataHora?: string;
  fuso?: string;
}): FormData {
  const form = new FormData();
  if (campos.forma !== undefined) form.set("forma", campos.forma);
  if (campos.caminhos !== undefined) form.set("caminhos", campos.caminhos);
  form.set("legenda", campos.legenda ?? "");
  form.set("quando", campos.quando ?? "agora");
  if (campos.dataHora !== undefined) form.set("data_hora", campos.dataHora);
  if (campos.fuso !== undefined) form.set("fuso", campos.fuso);
  return form;
}

type LinhaDaFila = {
  status: string;
  account_id: string;
  payload: Record<string, unknown>;
  dedupe_key: string;
  no_futuro: boolean;
};

async function itensDaFila(conta_id: string): Promise<LinhaDaFila[]> {
  return (await banco
    .db()
    .sql()
    .query(
      `select status, account_id, payload, dedupe_key, (not_before > now()) as no_futuro
         from queue where kind = 'publicacao' and account_id = $1
        order by created_at desc, id desc`,
      [conta_id]
    )) as LinhaDaFila[];
}

// ===========================================================================
// PRIMEIRO BLOCO: o schema ainda não tem conta nenhuma.
//
// O único jeito honesto de alcançar "sem_conta" sem tocar em cookie: sem
// conta nenhuma, `listAccounts()` volta vazia e `getSelectedAccount` devolve
// `null` — o tombo declarado da própria função.
// ===========================================================================
describe("a recusa de quem ainda não conectou conta nenhuma", () => {
  test("a condição deste bloco é o schema SEM conta — e ele confere isso antes de medir", async () => {
    const { valor } = await comoNumaRequisicao("/publicar", () => conta.getSelectedAccountId());
    expect(valor).toBe(null);
  });

  test("publicar recusa sem conta com a frase que diz o que fazer, e não em silêncio", async () => {
    const d = await desfechoDe(pedidoDePublicar({ forma: "imagem", caminhos: "qualquer/coisa.jpg" }));
    expect(d.digest ?? "").toMatch(/^NEXT_REDIRECT/);
    const aviso = avisoDaUrlDeVolta(d.url);
    expect(aviso.texto).toBe(
      "Nenhuma conta do Instagram está selecionada. Conecte ou escolha uma conta antes de publicar."
    );
    expect(aviso.tom).toBe("erro");
  });
});

// ===========================================================================
// SEGUNDO BLOCO: CONTA_A e CONTA_B existem. CONTA_A nasce PRIMEIRO, e é por
// isso — e não por cookie nenhum — que ela é "a conta selecionada" daqui em
// diante.
// ===========================================================================
describe("com a conta selecionada pelo tombo declarado (a primeira do schema)", () => {
  beforeAll(async () => {
    for (const [id, token, nome] of [
      [CONTA_A, TOKEN_A, "conta_a_do_publicar"],
      [CONTA_B, TOKEN_B, "conta_b_do_publicar"],
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

  test("a condição deste bloco é CONTA_A vir sem cookie nenhum — e ele confere isso antes de medir", async () => {
    const { valor } = await comoNumaRequisicao("/publicar", () => conta.getSelectedAccountId());
    expect(valor).toBe(CONTA_A);
  });

  // -------------------------------------------------------------------------
  // O CASO CENTRAL — o PRIMEIRO PLANTIO OBRIGATÓRIO mora aqui.
  //
  // Mover este `redirect` para dentro do `try { await drainQueue(); } catch {}`
  // faz a ação VOLTAR sem lançar: `digest` vem nulo, e é essa a diferença que
  // este caso prende. Ele também mede o resto do caminho de sucesso — o item
  // chegou a `sent` pela Meta falsa, com o token da conta certa, e o arquivo
  // saiu do bucket — porque um `redirect` que sobrevive por acidente (por
  // exemplo, por o dreno nunca ter sido chamado) não seria a mesma prova.
  // -------------------------------------------------------------------------
  test("o sucesso 'agora' redireciona com aviso, e o post sai pela Meta falsa", async () => {
    const caminho = `${CONTA_A}/sucesso-agora.jpg`;
    const d = await desfechoDe(
      pedidoDePublicar({ forma: "imagem", caminhos: caminho, quando: "agora" })
    );

    // A AÇÃO LANÇOU. Sem esta linha, o plantio do redirect-dentro-do-catch
    // continuaria verde: uma ação que volta calada é indistinguível de uma
    // que concluiu.
    expect(d.digest ?? "").toMatch(/^NEXT_REDIRECT/);

    const aviso = avisoDaUrlDeVolta(d.url);
    expect(aviso.tom).toBe("ok");
    expect(aviso.texto).toBe(
      "Publicação na fila. Ela sai em instantes — acompanhe o desfecho em Atividade."
    );

    // E SAIU DE VERDADE, pela conta CERTA: o item, o container e a publicação
    // levam o token de CONTA_A — nunca o de CONTA_B.
    const itens = await itensDaFila(CONTA_A);
    expect(itens.length).toBe(1);
    expect(itens[0].status).toBe("sent");
    expect(itens[0].account_id).toBe(CONTA_A);
    expect(meta.containers).toEqual([{ igUserId: CONTA_A, token: TOKEN_A }]);
    expect(meta.publicacoes.map((p) => p.igUserId)).toEqual([CONTA_A]);
    expect(meta.publicacoes.map((p) => p.token)).toEqual([TOKEN_A]);
    expect(bucketFalso.apagados).toContain(caminho);
    expect(meta.desconhecidos).toEqual([]);
  });

  test("o sucesso 'depois' agenda e ecoa a hora escolhida, sem tocar a Meta", async () => {
    const daqui5Dias = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    const dia = String(daqui5Dias.getUTCDate()).padStart(2, "0");
    const mes = String(daqui5Dias.getUTCMonth() + 1).padStart(2, "0");
    const dataHora = `${daqui5Dias.getUTCFullYear()}-${mes}-${dia}T12:00`;

    const containersAntes = meta.containers.length;
    const caminho = `${CONTA_A}/sucesso-agendado.jpg`;
    const d = await desfechoDe(
      pedidoDePublicar({ forma: "imagem", caminhos: caminho, quando: "depois", dataHora })
    );

    expect(d.digest ?? "").toMatch(/^NEXT_REDIRECT/);
    const aviso = avisoDaUrlDeVolta(d.url);
    expect(aviso.tom).toBe("ok");
    // OS CAMPOS ESCOLHIDOS, ecoados — e não a hora do relógio do servidor
    // (ver o comentário de `avisoDaPublicacaoEnfileirada`).
    expect(aviso.texto).toBe(`Publicação agendada para ${dia}/${mes} às 12:00. Acompanhe o desfecho em Atividade.`);

    // O AGENDADO NÃO DRENA: nenhuma ida à Meta nasceu deste pedido.
    expect(meta.containers.length).toBe(containersAntes);

    const itens = await itensDaFila(CONTA_A);
    const item = itens.find((i) => i.dedupe_key.endsWith(caminho));
    expect(item?.status).toBe("pending");
    expect(item?.no_futuro).toBe(true);
  });

  test("forma desconhecida (inclusive carrossel) recusa antes de gravar", async () => {
    const d = await desfechoDe(
      pedidoDePublicar({ forma: "carrossel", caminhos: `${CONTA_A}/nao-importa.jpg` })
    );
    expect(d.digest ?? "").toMatch(/^NEXT_REDIRECT/);
    const aviso = avisoDaUrlDeVolta(d.url);
    expect(aviso.tom).toBe("erro");
    expect(aviso.texto).toBe("Escolha entre imagem, reels e story. O carrossel ainda não publica por aqui.");
  });

  test("sem arquivo (campo vazio) recusa com o que fazer", async () => {
    const d = await desfechoDe(pedidoDePublicar({ forma: "imagem", caminhos: "" }));
    expect(d.digest ?? "").toMatch(/^NEXT_REDIRECT/);
    const aviso = avisoDaUrlDeVolta(d.url);
    expect(aviso.tom).toBe("erro");
    expect(aviso.texto).toBe("Escolha um arquivo e espere o envio terminar antes de publicar.");
  });

  test("legenda longa demais recusa com a MESMA frase que a tela já mostrava", async () => {
    const d = await desfechoDe(
      pedidoDePublicar({
        forma: "imagem",
        caminhos: `${CONTA_A}/legenda-longa.jpg`,
        legenda: "x".repeat(2201),
      })
    );
    expect(d.digest ?? "").toMatch(/^NEXT_REDIRECT/);
    const aviso = avisoDaUrlDeVolta(d.url);
    expect(aviso.tom).toBe("erro");
    expect(aviso.texto).toBe(
      "A legenda passa de 2.200 caracteres, que é o limite do Instagram. Encurte o texto."
    );
  });

  test("quando ilegível recusa, e NÃO cai em 'agora' por omissão", async () => {
    const d = await desfechoDe(
      pedidoDePublicar({ forma: "imagem", caminhos: `${CONTA_A}/quando-ilegivel.jpg`, quando: "ontem" })
    );
    expect(d.digest ?? "").toMatch(/^NEXT_REDIRECT/);
    const aviso = avisoDaUrlDeVolta(d.url);
    expect(aviso.tom).toBe("erro");
    expect(aviso.texto).toBe(
      "Diga se a publicação sai agora ou em outra hora. O pedido não foi entendido, e nada foi publicado."
    );
  });

  test("data que não existe (30 de fevereiro) recusa, e não transborda para março", async () => {
    const d = await desfechoDe(
      pedidoDePublicar({
        forma: "imagem",
        caminhos: `${CONTA_A}/data-invalida.jpg`,
        quando: "depois",
        dataHora: "2026-02-30T10:00",
      })
    );
    expect(d.digest ?? "").toMatch(/^NEXT_REDIRECT/);
    const aviso = avisoDaUrlDeVolta(d.url);
    expect(aviso.tom).toBe("erro");
    expect(aviso.texto).toBe("A data e a hora escolhidas não formam um dia que existe. Confira e tente de novo.");
  });

  test("hora que já passou recusa, e não publica AGORA por engano", async () => {
    const d = await desfechoDe(
      pedidoDePublicar({
        forma: "imagem",
        caminhos: `${CONTA_A}/data-no-passado.jpg`,
        quando: "depois",
        dataHora: "2020-01-01T10:00",
      })
    );
    expect(d.digest ?? "").toMatch(/^NEXT_REDIRECT/);
    const aviso = avisoDaUrlDeVolta(d.url);
    expect(aviso.tom).toBe("erro");
    expect(aviso.texto).toBe(
      "A hora escolhida já passou. Escolha um horário à frente — publicar agora é a outra opção, e ela é a que não dá para desfazer."
    );
  });

  test("o mesmo arquivo mandado duas vezes não duplica, e a segunda diz por quê", async () => {
    const caminho = `${CONTA_A}/repetido.jpg`;
    const primeira = await desfechoDe(pedidoDePublicar({ forma: "imagem", caminhos: caminho }));
    expect(avisoDaUrlDeVolta(primeira.url).tom).toBe("ok");

    const segunda = await desfechoDe(pedidoDePublicar({ forma: "imagem", caminhos: caminho }));
    expect(segunda.digest ?? "").toMatch(/^NEXT_REDIRECT/);
    const aviso = avisoDaUrlDeVolta(segunda.url);
    expect(aviso.tom).toBe("erro");
    expect(aviso.texto).toBe("Este arquivo já está na fila de publicação. Nada foi duplicado.");

    // UM ITEM SÓ para este caminho, e não dois.
    const itens = await itensDaFila(CONTA_A);
    expect(itens.filter((i) => i.dedupe_key.endsWith(caminho)).length).toBe(1);
  });

  // -------------------------------------------------------------------------
  // O SEGUNDO PLANTIO OBRIGATÓRIO mora aqui — "a conta certa", e nunca a que
  // vier do formulário.
  //
  // CONTA_A é a selecionada (ver a precondição deste bloco). O caminho abaixo
  // é da PASTA DE CONTA_B — o que um `<input type="hidden">` alterado à mão
  // mandaria para tentar publicar o arquivo de outra conta. `caminhosDoCampo`
  // filtra pela pasta de CONTA_A (a do cookie/tombo, não a do formulário) e
  // descarta o que não bate: o caminho de CONTA_B não sobra nenhum, e a ação
  // recusa por `sem_arquivo` — a MESMA recusa de um campo vazio, porque para
  // quem chamou é exatamente isso que sobrou.
  // -------------------------------------------------------------------------
  test("um caminho da pasta de OUTRA conta é descartado, e nada entra na fila dela", async () => {
    const caminhoDaContaB = `${CONTA_B}/arquivo-que-nao-e-meu.jpg`;
    const antesA = (await itensDaFila(CONTA_A)).length;

    const d = await desfechoDe(
      pedidoDePublicar({ forma: "imagem", caminhos: caminhoDaContaB })
    );

    expect(d.digest ?? "").toMatch(/^NEXT_REDIRECT/);
    const aviso = avisoDaUrlDeVolta(d.url);
    // A MESMA RECUSA DE CAMPO VAZIO: depois do filtro pela pasta do cookie,
    // não sobrou caminho nenhum — e é essa a verdade que a frase conta.
    expect(aviso.tom).toBe("erro");
    expect(aviso.texto).toBe("Escolha um arquivo e espere o envio terminar antes de publicar.");

    // NADA ENTROU NA FILA DE CONTA_A apontando para o arquivo de CONTA_B —
    // nem um item a mais em CONTA_A, nem qualquer item para CONTA_B (nenhuma
    // ação desta conta a selecionou).
    expect((await itensDaFila(CONTA_A)).length).toBe(antesA);
    const itensDeContaB = (await banco
      .db()
      .sql()
      .query(`select 1 from queue where kind = 'publicacao' and account_id = $1`, [CONTA_B])) as unknown[];
    expect(itensDeContaB.length).toBe(0);

    // E A META FALSA NUNCA VIU O TOKEN DE CONTA_B.
    expect(JSON.stringify(meta.containers)).not.toContain(TOKEN_B);
    expect(JSON.stringify(meta.publicacoes)).not.toContain(TOKEN_B);
  });
});
