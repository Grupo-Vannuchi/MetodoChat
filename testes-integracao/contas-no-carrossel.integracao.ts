// OS CARROSSÉIS CONTINUAM DE TODOS, E A CONTA, AS IMAGENS, A PUBLICAÇÃO E O APAGAR SÓ NAS CONTAS DO LOGIN
// (docs/specs/2026-11-05-contas-por-login.md, seção 3, "Os carrosséis", e achado 179), contra o banco
// descartável, no contexto de requisição semeado (./semear-requisicao.ts).
//
// O CENÁRIO é o de contas-por-login.integracao.ts: duas contas, A e B, e o login comum de teste ligado só à
// A. O login de teste de sempre é administrador e vê as duas. O "cookie da B" é o que `selectAccount`
// emitiu para o administrador, nunca escrito à mão.
//
// NADA SAI DESTA MÁQUINA, e são três as portas:
//   - a OpenAI: a chave dela fica fora do ambiente, e o pedido de imagem para no "sem chave", antes de
//     reservar (lib/bonus/imagem-processo.ts);
//   - a Meta e o bucket: a publicação para no "faltam imagens", e a assinatura e o guardar param no tipo e
//     no caminho, antes do bucket;
//   - a IA do texto e o Labs: os pedidos e os gerar de novo chamam os dois. O Labs é a LABS_URL, e a IA a
//     ANTHROPIC_BASE_URL (lida pela SDK), as duas apontando para o servidor falso deste arquivo, que responde
//     a lista do Labs e recusa todo o resto. A geração do carrossel novo, no `after()`, falha ali, e o que
//     o caso mede (a conta gravada no pedido) já está no banco antes dela.
// E A CERCA da F3 por cima: o `fetch` global deixa passar só o 127.0.0.1, e o último caso exige zero
// pedidos para fora.
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { TextoDeCarrossel } from "@/lib/bonus/carrossel-texto";
import { bancoDescartavel } from "./harness";
import { comoNumaRequisicaoComoComum, comoNumaRequisicaoComSessao } from "./semear-requisicao";

const banco = bancoDescartavel();
const q = (texto: string, params: unknown[] = []) =>
  banco.db().sql().query(texto, params) as Promise<Record<string, unknown>[]>;

// Os ids deste arquivo. Valores inventados: nenhuma credencial de verdade entra em teste.
const CONTA_A = "17800000000041001";
const CONTA_B = "17800000000041002";
const SLUG = "bonus-das-contas-no-carrossel";
const CENA = "/marketing uma pessoa usando o celular numa loja de roupas";

const slide = (i: number) => ({ titulo: `Título do slide ${i}`, texto: `Texto do slide ${i}, com mais de trinta caracteres.` });
// O texto e a arte de bonus-imagem-processo.integracao.ts: 5 slides, o 1 e o 5 "só texto", o 2, o 3 e o 4
// com espaço de imagem.
const TEXTO: TextoDeCarrossel = {
  tipo: "carrossel",
  titulo: "Mensagens para reativar clientes",
  gancho: "Seu cliente sumiu? Não é culpa dele.",
  slides: [slide(1), slide(2), slide(3)],
  chamada: "Comente SUMIDO e receba as mensagens prontas.",
  legenda: "Quem sumiu ainda pode voltar. Comente SUMIDO que eu te mando as mensagens prontas para usar hoje mesmo.",
};
const arteDa = (conta: string | null) =>
  conta ? { conta, nome: `Nome da ${conta}`, arroba: `arroba_${conta}`, soTexto: [1, 5] } : { soTexto: [1, 5] };

let servidor: Server;
const pedidosAoFalso: string[] = [];
const pedidosParaFora: string[] = [];
let fetchDeVerdade: typeof fetch;
const AMBIENTE_GUARDADO: Record<string, string | undefined> = {};
const VARIAVEIS = ["LABS_URL", "ANTHROPIC_BASE_URL", "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "IG_GRAPH_BASE", "QSTASH_TOKEN"];

type ModuloCarrossel = typeof import("@/app/bonus/carrossel-actions");
type ModuloAvulso = typeof import("@/app/carrosseis/actions");
type ModuloImagem = typeof import("@/app/bonus/imagem-actions");
type ModuloPublicar = typeof import("@/app/bonus/publicar-actions");
type ModuloApagar = typeof import("@/app/bonus/apagar-actions");
let carrossel: ModuloCarrossel;
let avulso: ModuloAvulso;
let imagem: ModuloImagem;
let publicar: ModuloPublicar;
let apagar: ModuloApagar;
let FRASE_DE_OUTRA_CONTA = "";
let FRASE_SEM_CONTAS = "";
let bonusId = "";

beforeAll(async () => {
  servidor = createServer((req, res) => {
    const u = new URL(req.url ?? "/", "http://127.0.0.1");
    pedidosAoFalso.push(`${req.method} ${u.pathname}`);
    // A LISTA PÚBLICA DO LABS, no formato do contrato (lib/bonus/publicado.ts), com o bônus deste arquivo.
    if (req.method === "GET" && u.pathname === "/api/bonus") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          items: [
            {
              codigo: SLUG,
              palavraChave: "SUMIDO",
              tema: "Vendas",
              titulo: "Mensagens para reativar clientes",
              descricao: "As mensagens prontas para trazer de volta quem sumiu.",
            },
          ],
        })
      );
      return;
    }
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ type: "error", error: { type: "api_error", message: "o servidor falso deste arquivo não responde isto" } }));
  });
  await new Promise<void>((pronto) => servidor.listen(0, "127.0.0.1", pronto));
  const base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  for (const v of VARIAVEIS) AMBIENTE_GUARDADO[v] = process.env[v];
  process.env.LABS_URL = base;
  process.env.ANTHROPIC_BASE_URL = base;
  process.env.IG_GRAPH_BASE = base;
  process.env.ANTHROPIC_API_KEY = "chave-inventada-para-o-teste";
  delete process.env.OPENAI_API_KEY;
  delete process.env.QSTASH_TOKEN;

  fetchDeVerdade = globalThis.fetch;
  globalThis.fetch = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(entrada instanceof Request ? entrada.url : String(entrada));
    if (url.hostname !== "127.0.0.1") {
      pedidosParaFora.push(url.origin);
      throw new Error(`A CERCA DE contas-no-carrossel.integracao.ts recusou um pedido para ${url.origin}`);
    }
    return fetchDeVerdade(entrada, init);
  }) as typeof fetch;

  carrossel = await import("@/app/bonus/carrossel-actions");
  avulso = await import("@/app/carrosseis/actions");
  imagem = await import("@/app/bonus/imagem-actions");
  publicar = await import("@/app/bonus/publicar-actions");
  apagar = await import("@/app/bonus/apagar-actions");
  const textos = await import("@/lib/logins-textos");
  FRASE_DE_OUTRA_CONTA = textos.FRASE_CARROSSEL_DE_OUTRA_CONTA;
  FRASE_SEM_CONTAS = textos.FRASE_SEM_CONTAS;

  // AS DUAS CONTAS, A ANTES DA B (a ordem de `listAccounts` e de `contasParaArte`).
  for (const id of [CONTA_A, CONTA_B]) {
    await banco.db().upsertAccount({
      ig_user_id: id,
      username: `arroba_${id}`,
      name: `Nome da ${id}`,
      profile_picture_url: null,
      access_token: `token-da-${id}-que-nao-vale-nada`,
      token_expires_at: null,
    });
  }
  await q(`update accounts set created_at = now() - interval '2 hours' where ig_user_id = $1`, [CONTA_A]);
  await q(`update accounts set created_at = now() - interval '1 hour' where ig_user_id = $1`, [CONTA_B]);
  const [b] = (await q(
    `insert into bonus_gerados (tema, o_que_resolve, estado, slug, envio_estado)
     values ('Vendas', 'Reativar clientes que pararam de comprar pelo WhatsApp.', 'pronto', $1, 'criado')
     returning id`,
    [SLUG]
  )) as { id: string }[];
  bonusId = b.id;
});

afterAll(async () => {
  globalThis.fetch = fetchDeVerdade;
  for (const v of VARIAVEIS) {
    if (AMBIENTE_GUARDADO[v] === undefined) delete process.env[v];
    else process.env[v] = AMBIENTE_GUARDADO[v];
  }
  await new Promise<void>((pronto) => servidor.close(() => pronto()));
});

// ---------------------------------------------------------------------------------------------------
// Semear e ler. Nada aqui decide nada.
// ---------------------------------------------------------------------------------------------------

// OS CARROSSÉIS SEMEADOS NASCEM HÁ DOIS DIAS: o teto do pedido conta os das últimas 24 horas que chamaram a
// IA (lib/bonus/carrossel-repositorio.ts), e os pedidos deste arquivo não podem esbarrar nos semeados.
async function prontoDa(conta: string | null): Promise<string> {
  const [c] = (await q(
    `insert into carrosseis_gerados (origem, total_slides, palavra, contexto, estado, gerado, arte, criado_em)
     values ('livre', 5, 'SUMIDO', $1::jsonb, 'pronto', $2::jsonb, $3::jsonb, now() - interval '2 days') returning id`,
    [{ tipo: "livre", tema: "Vendas", conteudo: "Mensagens para trazer de volta quem sumiu." }, TEXTO, arteDa(conta)]
  )) as { id: string }[];
  return c.id;
}

/** Um carrossel que falhou e não tem conta: o original dos dois gerar de novo. */
async function falhouSemConta(tipo: "bonus" | "avulso"): Promise<string> {
  const [c] = (await (tipo === "bonus"
    ? q(
        `insert into carrosseis_gerados (bonus_id, total_slides, palavra, contexto, estado, erro, arte, criado_em)
         values ($1, 5, 'SUMIDO', '{}'::jsonb, 'falhou', 'A IA não respondeu.', '{}'::jsonb, now() - interval '2 days') returning id`,
        [bonusId]
      )
    : q(
        `insert into carrosseis_gerados (origem, total_slides, palavra, contexto, estado, erro, arte, criado_em)
         values ('livre', 5, 'SUMIDO', $1::jsonb, 'falhou', 'A IA não respondeu.', '{}'::jsonb, now() - interval '2 days') returning id`,
        [{ tipo: "livre", tema: "Vendas", conteudo: "Mensagens para trazer de volta quem sumiu." }]
      ))) as { id: string }[];
  return c.id;
}

const linhaDo = (id: string) => q(`select * from carrosseis_gerados where id = $1`, [id]);
const contaGravada = async (id: string) =>
  String(((await q(`select arte->>'conta' as conta from carrosseis_gerados where id = $1`, [id]))[0] ?? {}).conta ?? "");
const quantas = async (tabela: "queue" | "imagens_geradas") =>
  Number((await q(`select count(*)::int as n from ${tabela}`))[0].n);

/** O que as cinco ações mexeriam: a linha do carrossel, a fila e as reservas de imagem. */
const estadoDo = async (id: string) => ({ linha: await linhaDo(id), fila: await quantas("queue"), imagens: await quantas("imagens_geradas") });

const form = (campos: Record<string, string | string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) for (const x of Array.isArray(v) ? v : [v]) f.append(k, x);
  return f;
};

type Desfecho = { digest: string | null; destino: string | null; texto: string | null };

/** O corpo, com o redirect lido do `digest`, e o `texto` do estado que a action devolveu. */
function capturando(corpo: () => Promise<unknown>) {
  return async (): Promise<Desfecho> => {
    try {
      const v = await corpo();
      return { digest: null, destino: null, texto: (v as { texto?: string } | null)?.texto ?? null };
    } catch (e) {
      const d = (e as { digest?: unknown }).digest;
      if (typeof d !== "string") throw e;
      const destino = d.startsWith("NEXT_REDIRECT;") ? d.split(";").slice(2, -2).join(";") : null;
      return { digest: d, destino, texto: null };
    }
  };
}

const comoComum = async (corpo: () => Promise<unknown>, opcoes: { contas: string[]; contaDoCookie?: string } = { contas: [CONTA_A] }) =>
  (await comoNumaRequisicaoComoComum("/carrosseis", capturando(corpo), opcoes)).valor;
const comoAdministrador = async (corpo: () => Promise<unknown>) =>
  (await comoNumaRequisicaoComSessao("/carrosseis", capturando(corpo))).valor;

/** As cinco ações que agem na conta do carrossel, com um pedido que para logo depois da conferência. */
const ACOES: [string, (id: string) => () => Promise<unknown>][] = [
  ["pedirImagemDoSlide", (id) => () => imagem.pedirImagemDoSlide({ id, numero: 2, descricao: CENA })],
  [
    "assinarImagemDoCarrossel",
    (id) => () =>
      publicar.assinarImagemDoCarrossel({
        id,
        numero: 2,
        destino: "slide",
        arquivo: { nome: "slide.png", mime: "image/png", bytes: 1000, largura: 1080, altura: 1350 },
      }),
  ],
  ["guardarImagemDoSlide", (id) => () => publicar.guardarImagemDoSlide({ id, numero: 2, caminho: "fora/da/pasta.jpg" })],
  ["publicarCarrossel", (id) => () => publicar.publicarCarrossel({ id, quando: "agora", artes: [] })],
  ["apagarCarrosselDaPagina", (id) => () => apagar.apagarCarrosselDaPagina(null, form({ id }))],
];

// ---------------------------------------------------------------------------------------------------
// NUM CARROSSEL DA B, O COMUM É RECUSADO, E NADA MUDA
// ---------------------------------------------------------------------------------------------------

describe("num carrossel pronto da B, o comum é recusado e o banco não muda", () => {
  it.each(ACOES)("%s recusa com a frase, e o carrossel, a fila e as reservas ficam iguais", async (_nome, acao) => {
    const id = await prontoDa(CONTA_B);
    // A sessão do comum ANTES da foto, para a foto não depender da primeira entrada dele.
    await comoComum(async () => null);
    const antes = await estadoDo(id);
    const d = await comoComum(acao(id));
    expect(d.digest).toBe(null);
    expect(d.texto).toBe(FRASE_DE_OUTRA_CONTA);
    expect(await estadoDo(id)).toEqual(antes);
  });
});

// ---------------------------------------------------------------------------------------------------
// NUM CARROSSEL DA A, CADA UM PASSA DA CONFERÊNCIA
//
// O caso prova só que a recusa não é a da conta: cada ação para adiante pelo motivo de sempre (a chave da
// imagem, o tipo do arquivo, o caminho fora da pasta, as imagens que faltam), e o apagar apaga.
// ---------------------------------------------------------------------------------------------------

describe("num carrossel pronto da A, o comum passa da conferência", () => {
  it("o pedido de imagem para na chave da OpenAI, e não na conta", async () => {
    const { textoDaRecusaDaImagem } = await import("@/lib/bonus/imagem-textos");
    const d = await comoComum(ACOES[0][1](await prontoDa(CONTA_A)));
    expect(d.texto).toBe(textoDaRecusaDaImagem({ motivo: "sem_chave" }));
    expect(await quantas("imagens_geradas")).toBe(0);
  });

  it("o assinar, o guardar e o publicar param no motivo de sempre, e não na conta", async () => {
    const { textoDaRecusaDaPublicacaoDoCarrossel: frase } = await import("@/lib/bonus/publicar-textos");
    const id = await prontoDa(CONTA_A);
    expect((await comoComum(ACOES[1][1](id))).texto).toBe(frase({ motivo: "tipo" }));
    expect((await comoComum(ACOES[2][1](id))).texto).toBe(frase({ motivo: "caminho" }));
    expect((await comoComum(ACOES[3][1](id))).texto).toBe(frase({ motivo: "faltam_imagens", slides: [2, 3, 4] }));
    expect(await quantas("queue")).toBe(0);
  });

  it("o apagar apaga", async () => {
    const id = await prontoDa(CONTA_A);
    const d = await comoComum(ACOES[4][1](id));
    expect(d.digest ?? "").toMatch(/^NEXT_REDIRECT;/);
    expect(await linhaDo(id)).toEqual([]);
  });

  it("sem conta no carrossel, qualquer login apaga", async () => {
    const id = await prontoDa(null);
    const d = await comoComum(ACOES[4][1](id));
    expect(d.digest ?? "").toMatch(/^NEXT_REDIRECT;/);
    expect(await linhaDo(id)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------
// O TEXTO E A ARTE SÃO DE TODOS
// ---------------------------------------------------------------------------------------------------

describe("o comum salva slide e arte nos dois carrosséis", () => {
  it.each([
    ["da A", CONTA_A],
    ["da B", CONTA_B],
  ])("no carrossel %s", async (_nome, conta) => {
    const { TEXTO_ARTE_SALVA } = await import("@/lib/bonus/arte-textos");
    const id = await prontoDa(conta);
    const slide = await comoComum(() =>
      carrossel.salvarSlideDoCarrossel(null, form({ id, parte: "slide_1", gancho: "Seu cliente sumiu? A culpa não é dele." }))
    );
    expect(slide.texto).not.toBe(FRASE_DE_OUTRA_CONTA);
    expect(((await linhaDo(id))[0].revisado as { gancho?: string } | null)?.gancho).toBe("Seu cliente sumiu? A culpa não é dele.");
    const arte = await comoComum(() => carrossel.salvarArteDoCarrossel(null, form({ id, so_texto: ["1", "5"] })));
    expect(arte.texto).toBe(TEXTO_ARTE_SALVA);
  });
});

// ---------------------------------------------------------------------------------------------------
// A CONTA DE UM CARROSSEL NOVO É UMA DAS DO LOGIN (179)
//
// O comum, com o cookie da B no navegador: o pedido e o gerar de novo de um original sem conta gravam a A,
// e nunca a B. O destino do redirect diz qual é o carrossel novo.
// ---------------------------------------------------------------------------------------------------

describe("a conta de um carrossel novo do comum, com o cookie da B, é a A", () => {
  const COM_O_COOKIE_DA_B = { contas: [CONTA_A], contaDoCookie: CONTA_B };
  const novoDo = (destino: string | null) => (destino ?? "").split("/").pop() ?? "";

  it("o gerar de novo do carrossel de bônus sem conta grava a A", async () => {
    const original = await falhouSemConta("bonus");
    const d = await comoComum(() => carrossel.gerarCarrosselDeNovo(form({ id: original })), COM_O_COOKIE_DA_B);
    expect(d.destino ?? "").toMatch(new RegExp(`^/bonus/${bonusId}/carrossel/[0-9a-f-]{36}$`));
    expect(await contaGravada(novoDo(d.destino))).toBe(CONTA_A);
  });

  it("o gerar de novo do avulso sem conta grava a A", async () => {
    const original = await falhouSemConta("avulso");
    const d = await comoComum(() => avulso.gerarAvulsoDeNovo(form({ id: original })), COM_O_COOKIE_DA_B);
    expect(d.destino ?? "").toMatch(/^\/carrosseis\/[0-9a-f-]{36}$/);
    expect(await contaGravada(novoDo(d.destino))).toBe(CONTA_A);
  });

  it("o pedido de um carrossel de bônus grava a A", async () => {
    const d = await comoComum(() => carrossel.pedirCarrossel(null, form({ bonus_id: bonusId, total: "5" })), COM_O_COOKIE_DA_B);
    expect(d.destino ?? "").toMatch(new RegExp(`^/bonus/${bonusId}/carrossel/[0-9a-f-]{36}$`));
    expect(await contaGravada(novoDo(d.destino))).toBe(CONTA_A);
  });

  it("o pedido de um carrossel avulso grava a A", async () => {
    const d = await comoComum(
      () =>
        avulso.pedirCarrosselAvulso(
          null,
          form({
            origem: "livre",
            tema: "Produtividade",
            palavra: "BRUTAL",
            conteudo: "Um prompt que critica o seu plano sem dó nenhum.",
            total: "5",
            jeito: "ia",
          })
        ),
      COM_O_COOKIE_DA_B
    );
    expect(d.destino ?? "").toMatch(/^\/carrosseis\/[0-9a-f-]{36}$/);
    expect(await contaGravada(novoDo(d.destino))).toBe(CONTA_A);
  });
});

// A CONTA DO MENU NO CARROSSEL, lida direto: é ela que os pedidos e o fixar acima usam, e a revisão e as
// rotas também. O cookie da B não escolhe a B para o comum; para o administrador, que tem a B, escolhe.
describe("a conta do menu no carrossel", () => {
  const doMenu = async () => {
    const { contaDoMenuNoCarrossel } = await import("@/lib/bonus/carrossel-acesso");
    return (await contaDoMenuNoCarrossel())?.ig_user_id ?? null;
  };

  it("o comum com o cookie da B tem a A; sem contas, nenhuma", async () => {
    expect((await comoNumaRequisicaoComoComum("/carrosseis", doMenu, { contas: [CONTA_A], contaDoCookie: CONTA_B })).valor).toBe(CONTA_A);
    expect((await comoNumaRequisicaoComoComum("/carrosseis", doMenu, { contas: [], contaDoCookie: CONTA_B })).valor).toBe(null);
  });

  it("o administrador com o cookie da B tem a B", async () => {
    expect((await comoNumaRequisicaoComSessao("/carrosseis", doMenu, { contaDoCookie: CONTA_B })).valor).toBe(CONTA_B);
  });
});

describe("o fixar nesta conta", () => {
  it("num carrossel sem conta, o comum com o cookie da B fixa a A", async () => {
    const { TEXTO_CONTA_FIXADA } = await import("@/lib/bonus/arte-textos");
    const id = await prontoDa(null);
    const d = await comoComum(() => carrossel.fixarContaDoCarrossel(null, form({ id })), { contas: [CONTA_A], contaDoCookie: CONTA_B });
    expect(d.texto).toBe(TEXTO_CONTA_FIXADA);
    expect(await contaGravada(id)).toBe(CONTA_A);
  });

  it("o comum sem contas recebe a frase de quem não tem contas, e nada é gravado", async () => {
    const id = await prontoDa(null);
    const antes = await linhaDo(id);
    const d = await comoComum(() => carrossel.fixarContaDoCarrossel(null, form({ id })), { contas: [], contaDoCookie: CONTA_B });
    expect(d.texto).toBe(FRASE_SEM_CONTAS);
    expect(await linhaDo(id)).toEqual(antes);
  });
});

// ---------------------------------------------------------------------------------------------------
// O ADMINISTRADOR CONTINUA AGINDO NOS DOIS
// ---------------------------------------------------------------------------------------------------

describe("o administrador continua agindo nos dois carrosséis", () => {
  it.each([
    ["da A", CONTA_A],
    ["da B", CONTA_B],
  ])("no carrossel %s, as cinco passam da conferência", async (_nome, conta) => {
    const { textoDaRecusaDaImagem } = await import("@/lib/bonus/imagem-textos");
    const { textoDaRecusaDaPublicacaoDoCarrossel: frase } = await import("@/lib/bonus/publicar-textos");
    const id = await prontoDa(conta);
    expect((await comoAdministrador(ACOES[0][1](id))).texto).toBe(textoDaRecusaDaImagem({ motivo: "sem_chave" }));
    expect((await comoAdministrador(ACOES[1][1](id))).texto).toBe(frase({ motivo: "tipo" }));
    expect((await comoAdministrador(ACOES[2][1](id))).texto).toBe(frase({ motivo: "caminho" }));
    expect((await comoAdministrador(ACOES[3][1](id))).texto).toBe(frase({ motivo: "faltam_imagens", slides: [2, 3, 4] }));
    expect((await comoAdministrador(ACOES[4][1](id))).digest ?? "").toMatch(/^NEXT_REDIRECT;/);
    expect(await linhaDo(id)).toEqual([]);
  });
});

describe("a cerca da rede", () => {
  it("nenhum pedido deste arquivo saiu da máquina", () => {
    expect(pedidosParaFora).toEqual([]);
  });
});
