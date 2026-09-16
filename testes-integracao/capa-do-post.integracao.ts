// A CAPA DO POST NÃO APODRECE — /automacoes para de ler do banco uma URL que
// expira.
//
// -----------------------------------------------------------------------------
// O DEFEITO MEDIDO EM 15/09/2026
//
// Em /automacoes: 22 imagens, 19 quebradas. `media_thumbnail_url` é uma URL
// assinada do CDN do Instagram, e ela expira em ~2 semanas — uma automação de
// 31/08 já devolvia 403 quando medida. `lib/media-lookup.ts` já resolvia esse
// mesmo problema para /eventos e para o Início: capa e link do post buscados
// NA HORA de exibir, nunca guardados. Esta suíte prende /automacoes na mesma
// regra.
//
// -----------------------------------------------------------------------------
// POR QUE ESTE CASO NÃO DEPENDE DE A META RESPONDER
//
// O token semeado abaixo é inventado — não vale nada contra a Graph API de
// verdade. Isso é DE PROPÓSITO, e não uma lacuna: `resolvePosts`
// (lib/media-lookup.ts) tem `try/catch` interno e devolve mapa vazio quando a
// busca falha, e é exatamente esse ramo que este caso mede. A pergunta não é
// "a Meta respondeu com a capa certa?" — é "quando a Meta NÃO responde, a URL
// podre do banco ainda assim vaza para a tela?". Se vazar, o caso fica
// vermelho. Se a tela ficar sem capa, o caso passa: sem capa é o desfecho
// certo, imagem quebrada não é.
//
// -----------------------------------------------------------------------------
// POR QUE ESTE ARQUIVO NÃO USA `textoDaArvore` PARA A ASSERÇÃO PRINCIPAL —
// E ISSO FOI MEDIDO, NÃO SUPOSTO.
//
// O padrão de `nao-saiu.integracao.ts` é chamar a página dentro de
// `comoNumaRequisicao` e ler o resultado com `textoDaArvore`. Tentei exatamente
// isso primeiro, e o `toContain("Carrossel de teste")` deu VERMELHO mesmo
// depois da correção — não por a correção estar errada, mas porque a asserção
// não conseguia enxergar a linha nenhuma.
//
// A CAUSA: `AutomationsList` (./list-client.tsx) é `"use client"`, e a página
// a invoca UMA VEZ, com a lista inteira num prop só — `<AutomationsList
// automations={rows} />`. `textoDaArvore` (ver o cabeçalho dela) NUNCA executa
// o componente filho — ela anda pelo ELEMENTO (`{ type, props }`) sem chamar
// `type` — e só imprime um prop se o valor for STRING ou NUMBER, ou desce
// quando a chave é `children`. `automations` não é nem uma coisa nem outra: é
// um ARRAY DE OBJETOS. Resultado: nenhuma miniatura, nenhuma legenda, nenhum
// `id` de linha chega a `textoDaArvore` — a URL podre "desaparece" tanto com o
// defeito quanto sem ele. Um `not.toContain(PODRE)` sobre esse texto passaria
// SEMPRE, vazando ou não — a mesma armadilha de asserção vazia que o cabeçalho
// de `nao-saiu.integracao.ts` describe alhures ("Nada precisa de você agora").
//
// A SAÍDA: `acharLinhas`, abaixo, anda pela MESMA árvore que `textoDaArvore`
// caminha — sem jamais tocar `type` de elemento nenhum, e por isso sem cruzar
// o `<Link>` que faz `JSON.stringify` estourar — só que, em vez de filtrar por
// tipo primitivo, ela procura o prop chamado `automations` e o devolve inteiro.
// O array em si não tem elemento React dentro (é dado de linha: id, thumb,
// legenda, string e boolean puros), então inspecioná-lo direto é seguro — o
// mesmo motivo que `textoDaArvore` já invoca para não estourar.
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo, Socket } from "node:net";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { bancoDescartavel } from "./harness";
import { comoNumaRequisicao } from "./semear-requisicao";
import type { AutomationRow } from "@/app/automacoes/list-client";
import type { Configuracao } from "@/app/automacoes/editor/painel";
import MediaPicker from "@/app/automacoes/media-picker";
import { MAX_INDIVIDUAL_LOOKUPS, TETO_DA_RESOLUCAO_MS, resolvePosts } from "@/lib/media-lookup";

const banco = bancoDescartavel();

const CONTA = "17900000000000901";
// Inventado, não vale nada — a mesma disciplina de `nao-saiu.integracao.ts`.
const TOKEN = "token-da-capa-que-nao-apodrece-que-nao-vale-nada";

// Movida para o topo do arquivo (era local ao primeiro `describe`) porque a
// Tarefa 2 a reusa no `describe` do editor, logo abaixo.
const PODRE = "https://scontent.cdninstagram.com/v/expirada-ha-semanas.jpg";

type ModuloTelaDeAutomacoes = typeof import("@/app/automacoes/page");
type ModuloEditorDaAutomacao = typeof import("@/app/automacoes/[id]/page");
type ModuloAcoes = typeof import("@/app/automacoes/actions");
let telaDeAutomacoes: ModuloTelaDeAutomacoes;
let editorDaAutomacao: ModuloEditorDaAutomacao;
let acoes: ModuloAcoes;

beforeAll(async () => {
  telaDeAutomacoes = (await import("@/app/automacoes/page")) as ModuloTelaDeAutomacoes;
  editorDaAutomacao = (await import("@/app/automacoes/[id]/page")) as ModuloEditorDaAutomacao;
  acoes = (await import("@/app/automacoes/actions")) as ModuloAcoes;

  await banco.db().upsertAccount({
    ig_user_id: CONTA,
    username: "conta_da_capa_que_nao_apodrece",
    name: "conta_da_capa_que_nao_apodrece",
    profile_picture_url: null,
    access_token: TOKEN,
    token_expires_at: null,
  });
});

// ---------------------------------------------------------------------------
// Semear e ler. Nada aqui decide nada — a decisão é da página.
// ---------------------------------------------------------------------------

let semente = 0;

/** Uma automação presa a um post, gravada direto — como o editor grava. */
async function semearAutomacao(item: {
  mediaId: string;
  thumb: string | null;
  // ACEITA `null` A PARTIR DA TAREFA 2: uma automação criada pelo Início
  // (`/automacoes/nova?post=…`) grava só `media_id` — `media_caption` nasce
  // NULO, não vazio. O caso que prova o segundo defeito ("id cru no lugar do
  // nome") precisa semear exatamente essa forma, e não uma string vazia
  // parecida com ela.
  caption: string | null;
}): Promise<string> {
  semente++;
  const linhas = (await banco
    .db()
    .sql()
    .query(
      `insert into automations
         (account_id, name, active, triggers, keywords, match_type,
          media_id, media_thumbnail_url, media_caption, steps, ligacoes)
       values ($1, $2, true, '{dm}'::text[], '{}'::text[], 'contains',
               $3, $4, $5, '[]'::jsonb, '[]'::jsonb)
       returning id`,
      [
        CONTA,
        `automação da capa que não apodrece ${semente}`,
        item.mediaId,
        item.thumb,
        item.caption,
      ]
    )) as { id: string }[];
  return linhas[0].id;
}

/** Acha o prop `automations` na árvore — ver o cabeçalho para o porquê. */
function acharLinhas(no: unknown): AutomationRow[] | null {
  if (no === null || no === undefined || typeof no !== "object") return null;
  if (Array.isArray(no)) {
    for (const filho of no) {
      const achado = acharLinhas(filho);
      if (achado) return achado;
    }
    return null;
  }
  const props = (no as { props?: Record<string, unknown> }).props;
  if (!props || typeof props !== "object") return null;
  if (Array.isArray(props.automations)) return props.automations as AutomationRow[];
  for (const valor of Object.values(props)) {
    const achado = acharLinhas(valor);
    if (achado) return achado;
  }
  return null;
}

async function linhasDasAutomacoes(): Promise<AutomationRow[]> {
  const { valor } = await comoNumaRequisicao("/automacoes", () =>
    telaDeAutomacoes.default({ searchParams: Promise.resolve({}) })
  );
  const linhas = acharLinhas(valor);
  if (!linhas) {
    throw new Error(
      "`acharLinhas` não achou o prop `automations` na árvore de /automacoes — " +
        "a estrutura da página (ou de AutomationsList) mudou, e este achador " +
        "precisa acompanhar."
    );
  }
  return linhas;
}

// -----------------------------------------------------------------------------
// A TAREFA 2: O EDITOR (/automacoes/[id]) — E A MESMA ARMADILHA, OUTRO NOME.
//
// `Quadro` (app/automacoes/editor/quadro.tsx) é `"use client"`, e a página o
// invoca UMA VEZ com a configuração inteira num prop só:
// `<Quadro configuracaoInicial={configuracaoInicial} … />`. Pela mesma razão
// que `acharLinhas` existe acima (ver o cabeçalho do arquivo): `textoDaArvore`
// nunca executa `Quadro`, e um objeto não é string nem number, então
// `configuracaoInicial` "some" do texto tanto com o defeito quanto sem ele —
// um `not.toContain(PODRE)` ingênuo passaria SEMPRE, vazando ou não.
//
// A SAÍDA é a mesma: um achador que anda pela MESMA árvore, sem tocar `type`
// de elemento nenhum, procurando o prop pelo NOME (`configuracaoInicial`) e
// devolvendo-o inteiro. É seguro inspecionar direto — é dado puro (nome,
// gatilho, post, story, …), sem elemento React dentro — e ele LANÇA quando não
// acha, para a vacuidade virar erro e não verde falso.
function acharConfiguracao(no: unknown): Configuracao | null {
  if (no === null || no === undefined || typeof no !== "object") return null;
  if (Array.isArray(no)) {
    for (const filho of no) {
      const achado = acharConfiguracao(filho);
      if (achado) return achado;
    }
    return null;
  }
  const props = (no as { props?: Record<string, unknown> }).props;
  if (!props || typeof props !== "object") return null;
  if (props.configuracaoInicial && typeof props.configuracaoInicial === "object") {
    return props.configuracaoInicial as Configuracao;
  }
  for (const valor of Object.values(props)) {
    const achado = acharConfiguracao(valor);
    if (achado) return achado;
  }
  return null;
}

/** A configuração que a página do editor passou para `Quadro`, para o id
 * dado. Lança quando `acharConfiguracao` não a acha — mesmo motivo do `throw`
 * em `linhasDasAutomacoes`, acima. */
async function configuracaoDoEditor(id: string): Promise<Configuracao> {
  const { valor } = await comoNumaRequisicao(`/automacoes/${id}`, () =>
    editorDaAutomacao.default({ params: Promise.resolve({ id }) })
  );
  const configuracao = acharConfiguracao(valor);
  if (!configuracao) {
    throw new Error(
      "`acharConfiguracao` não achou o prop `configuracaoInicial` na árvore do editor — " +
        "a estrutura de app/automacoes/[id]/page.tsx (ou de Quadro) mudou, e este achador " +
        "precisa acompanhar."
    );
  }
  return configuracao;
}

/** O post da configuração do editor, em texto — no formato `chave=valor` de
 * `textoDaArvore` (./texto-da-arvore.ts), para os casos poderem escrever
 * `.toContain`/`.not.toContain` do mesmo jeito que fariam contra aquela
 * leitura. */
async function arvoreDoEditor(id: string): Promise<string> {
  const { post } = await configuracaoDoEditor(id);
  return [`post.id=${post?.id ?? ""}`, `post.thumb=${post?.thumb ?? ""}`, `post.caption=${post?.caption ?? ""}`].join(
    "\n"
  );
}

/** Chama `salvarAutomacao` (app/automacoes/actions.ts) com o mínimo de
 * configuração válida para o post ser considerado — gatilho `"comment"` e
 * correspondência `"any"`, para não exigir palavra-chave —, dentro do
 * contexto de requisição que o Server Action precisa
 * (`comoNumaRequisicao`, ./semear-requisicao.ts). Lança se a ação recusar,
 * porque um caso que espera salvar com sucesso não tem o que fazer com uma
 * recusa silenciosa. */
async function salvarPelaAcao(args: {
  id: string;
  post: { id: string; thumb: string; caption: string };
}): Promise<void> {
  // Um bloco só, sem ligação nenhuma — o mínimo que `conferirLista`
  // (lib/steps.ts) aceita no nível "salvar": lista vazia é recusada
  // ("Sem nenhum bloco, a automação não envia nada."), e este arquivo não
  // está medindo o motor, então o conteúdo do bloco não importa.
  const PASSO_MINIMO = [{ id: "b_capa0001", tipo: "dm", texto: "Valeu por comentar!" }];
  const { valor } = await comoNumaRequisicao(`/automacoes/${args.id}`, () =>
    acoes.salvarAutomacao(args.id, PASSO_MINIMO, [], {
      nome: "automação da capa que não apodrece (editor)",
      ativo: false,
      gatilho: "comment",
      correspondencia: "any",
      palavras: [],
      entregaSemPortao: false,
      post: args.post,
    })
  );
  if (!valor.ok) {
    throw new Error(`salvarPelaAcao falhou: ${(valor as { erro: string }).erro}`);
  }
}

/** Igual a `salvarPelaAcao`, mas escolhendo o GATILHO — é o que o caso do alvo
 * mede. `correspondencia: "any"` de novo, para nenhum gatilho exigir palavra. */
async function salvarComGatilho(args: {
  id: string;
  gatilho: string;
  post: { id: string; thumb: string; caption: string };
  story?: { id: string; thumb: string };
}): Promise<void> {
  const PASSO_MINIMO = [{ id: "b_alvo0001", tipo: "dm", texto: "Oi!" }];
  const { valor } = await comoNumaRequisicao(`/automacoes/${args.id}`, () =>
    acoes.salvarAutomacao(args.id, PASSO_MINIMO, [], {
      nome: `automação de gatilho ${args.gatilho}`,
      ativo: false,
      gatilho: args.gatilho,
      correspondencia: "any",
      palavras: [],
      entregaSemPortao: false,
      post: args.post,
      story: args.story ?? null,
    })
  );
  if (!valor.ok) {
    throw new Error(`salvarComGatilho falhou: ${(valor as { erro: string }).erro}`);
  }
}

/** O alvo guardado, as duas colunas juntas: é o par que `findMatch`
 * (lib/engine.ts) consulta. */
async function alvoGravado(id: string): Promise<{ media_id: string | null; story_id: string | null }> {
  const linhas = (await banco
    .db()
    .sql()
    .query(`select media_id, story_id from automations where id = $1`, [id])) as {
    media_id: string | null;
    story_id: string | null;
  }[];
  return linhas[0];
}

/** As três colunas que este arquivo inteiro mede: o id, a URL que apodrece e
 * a legenda que não apodrece — lidas do banco, e não do que a ação devolveu. */
async function lerAutomacao(id: string): Promise<{
  media_id: string | null;
  media_thumbnail_url: string | null;
  media_caption: string | null;
}> {
  const linhas = (await banco
    .db()
    .sql()
    .query(
      `select media_id, media_thumbnail_url, media_caption from automations where id = $1`,
      [id]
    )) as { media_id: string | null; media_thumbnail_url: string | null; media_caption: string | null }[];
  return linhas[0];
}

describe("a capa de /automacoes não apodrece", () => {
  test("a URL guardada no banco NÃO chega na tela", async () => {
    // A prova do defeito de 15/09/2026: 19 de 22 imagens quebradas em
    // /automacoes, porque a tela lia uma URL assinada que expira em ~2 semanas.
    // Este caso não depende da Meta responder: ele exige que o valor PODRE do
    // banco não seja usado. Se a busca na hora falhar (e com o token inventado
    // acima ela vai falhar), a tela fica sem capa — que é o desfecho certo, e
    // não uma imagem quebrada.
    await semearAutomacao({
      mediaId: "17900000000000001",
      thumb: PODRE,
      caption: "Carrossel de teste",
    });

    const linhas = await linhasDasAutomacoes();

    expect(linhas.some((l) => l.thumb === PODRE)).toBe(false);
    // E a legenda CONTINUA aparecendo, porque legenda não apodrece: a busca
    // falhou, mas `media_caption` é o recuo guardado, e ele não tem prazo de
    // validade.
    expect(linhas.some((l) => l.postCaption === "Carrossel de teste")).toBe(true);
  });
});

describe("a capa do EDITOR (/automacoes/[id]) não apodrece", () => {
  test("o editor não usa a URL guardada, e mostra a legenda", async () => {
    const idDaAutomacao = await semearAutomacao({
      mediaId: "17900000000000002",
      thumb: PODRE,
      caption: "Carrossel Renner",
    });

    const arvore = await arvoreDoEditor(idDaAutomacao);

    expect(arvore).not.toContain(PODRE);
    expect(arvore).toContain("Carrossel Renner");
  });

  test("salvar NÃO grava mais a miniatura, e CONTINUA gravando a legenda", async () => {
    // A legenda fica porque não expira e é o nome que a pessoa reconhece. A
    // miniatura sai porque uma coluna que guarda coisa com prazo de validade
    // mente com o tempo -- e parecer preenchida é o que esconde o problema.
    const idDaAutomacao = await semearAutomacao({
      mediaId: "17900000000000002",
      thumb: null,
      caption: null,
    });

    await salvarPelaAcao({
      id: idDaAutomacao,
      post: { id: "17900000000000002", thumb: PODRE, caption: "Renner" },
    });

    const linha = await lerAutomacao(idDaAutomacao);
    expect(linha.media_thumbnail_url).toBeNull();
    expect(linha.media_caption).toBe("Renner");
    expect(linha.media_id).toBe("17900000000000002");
  });
});

// -----------------------------------------------------------------------------
// O SEGUNDO DEFEITO QUE A TAREFA 2 FECHA DE GRAÇA — E O ÚNICO BLOCO DESTE
// ARQUIVO EM QUE A META RESPONDE DE VERDADE.
//
// O resto do arquivo mede o que acontece quando a Meta FALHA (ver o cabeçalho
// no topo) — essa é a pergunta certa para a URL podre. Para este defeito a
// pergunta é a OPOSTA: quando a Meta RESPONDE com a legenda de verdade, o
// editor a usa em vez do id numérico cru que o Início
// (`app/automacoes/nova?post=…` → `criarAutomacao`, ../actions.ts) grava
// sozinho — aquela porta só grava `media_id`; `media_caption` e
// `media_thumbnail_url` nascem NULOS.
//
// SEM A META RESPONDER NÃO HÁ COMO PROVAR ISTO. `MediaPicker`
// (`selected.caption || selected.id`, ../media-picker.tsx) só cairia no id se
// a legenda chegasse vazia — e ela chega vazia TANTO COM o defeito QUANTO SEM
// ele quando a busca falha, porque `doPost?.caption ?? a.media_caption ?? ""`
// dá `""` nos dois casos quando `doPost` é `undefined`. Os dois ficam
// indistinguíveis nesse ramo — por isso o caso de cima ("a URL guardada")
// não serve para este defeito, e por isso este bloco precisa da OUTRA
// metade da promessa de `resolvePosts`: a que devolve dado de verdade.
//
// O MECANISMO é o mesmo de `testes-integracao/portao-link.integracao.ts`:
// `IG_GRAPH_BASE` (lib/ig.ts) desvia `graphFetch` para um servidor HTTP desta
// própria máquina, sob as duas travas descritas lá (`VITEST === "true"` e
// loopback). NÃO é mock: o `fetch` é o do Node, de verdade — só a outra ponta
// do fio muda, e só dentro deste `describe` (o `afterAll` a desfaz antes do
// arquivo terminar).
describe("a automação criada só com media_id (Início) não mostra o id cru", () => {
  const ID_DO_POST_DO_INICIO = "17900000000000777";
  const LEGENDA_DE_VERDADE = "Lançamento da coleção de verão";
  let servidor: Server;
  let pedidos: string[];

  beforeAll(async () => {
    pedidos = [];
    servidor = createServer((req, res) => {
      const u = new URL(req.url ?? "/", "http://127.0.0.1");
      pedidos.push(u.pathname);
      res.writeHead(200, { "content-type": "application/json" });
      // `getMedia` (lib/ig.ts), a listagem que `resolvePosts` tenta primeiro.
      if (u.pathname.endsWith(`/${CONTA}/media`)) {
        res.end(
          JSON.stringify({
            data: [
              {
                id: ID_DO_POST_DO_INICIO,
                media_type: "IMAGE",
                media_url: "https://exemplo-do-teste.invalid/foto.jpg",
                caption: LEGENDA_DE_VERDADE,
                permalink: "https://instagram.com/p/exemplo-do-teste",
              },
            ],
          })
        );
        return;
      }
      res.end(JSON.stringify({ data: [] }));
    });
    await new Promise<void>((pronto) => servidor.listen(0, "127.0.0.1", pronto));
    const porta = (servidor.address() as AddressInfo).port;
    process.env.IG_GRAPH_BASE = `http://127.0.0.1:${porta}`;
  });

  afterAll(async () => {
    delete process.env.IG_GRAPH_BASE;
    await new Promise<void>((pronto) => servidor.close(() => pronto()));
  });

  test("a legenda de verdade substitui o id cru quando a Meta responde", async () => {
    const idDaAutomacao = await semearAutomacao({
      mediaId: ID_DO_POST_DO_INICIO,
      thumb: null,
      caption: null,
    });

    const configuracao = await configuracaoDoEditor(idDaAutomacao);

    // A prova de que a busca de fato aconteceu, e não que o valor "por acaso"
    // já viria certo de outro jeito.
    expect(pedidos.some((p) => p.endsWith(`/${CONTA}/media`))).toBe(true);
    expect(configuracao.post?.caption).toBe(LEGENDA_DE_VERDADE);
    expect(configuracao.post?.caption).not.toBe(ID_DO_POST_DO_INICIO);
  });
});

// -----------------------------------------------------------------------------
// O CAMINHO DEGRADADO DO MESMO SEGUNDO DEFEITO — a Meta responde no describe
// acima; aqui ela NÃO responde, que é o estado PADRÃO deste arquivo (nenhum
// servidor desviando `graphFetch`, TOKEN inventado). É exatamente a automação
// do Início antes de a Meta responder: `media_id` sozinho, `media_caption`
// NULO — não vazio, NULO, a mesma forma que `criarAutomacao` grava.
//
// `doPost` fica `undefined` (a busca falha) e `a.media_caption` é `null`, então
// `configuracaoInicial.post.caption` chega `""` — IGUAL com o defeito e sem
// ele; ver o comentário grande antes do describe anterior sobre por que esse
// ramo não distingue os dois casos. A revisão de 15/09/2026 apontou que quem
// decide o que aparece NESSE ramo não é a página do editor: é `MediaPicker`
// (app/automacoes/media-picker.tsx), client component que os achadores acima
// (`acharConfiguracao`, `arvoreDoEditor`) NUNCA executam — a mesma armadilha
// documentada no topo do arquivo, por outra porta.
//
// A SAÍDA É RENDERIZAR `MediaPicker` DE VERDADE, com `react-dom/server`: não é
// mock nem reimplementação da regra — é o componente publicado, a receber
// exatamente o `post` que a página do editor produziria neste caminho
// degradado, e a devolver o HTML que a pessoa veria.
describe("o SELETOR (MediaPicker) não mostra o id cru quando a Meta está fora", () => {
  test("media_caption NULO + Meta fora → o HTML não contém o id, e diz 'Post selecionado'", async () => {
    const ID_SEM_META = "17900000000000779";
    const idDaAutomacao = await semearAutomacao({
      mediaId: ID_SEM_META,
      thumb: null,
      caption: null,
    });

    // Nenhum `IG_GRAPH_BASE` setado neste describe: `graphFetch` (lib/ig.ts)
    // sai para a Graph API de verdade com o TOKEN inventado do topo do
    // arquivo, e falha — o mesmo `resolvePosts` que devolve mapa vazio no
    // describe "a URL guardada não chega na tela", acima.
    const { post } = await configuracaoDoEditor(idDaAutomacao);
    expect(post?.id).toBe(ID_SEM_META);
    // As DUAS fontes de nome falharam: é a precondição exata do defeito.
    expect(post?.caption).toBe("");

    const html = renderToStaticMarkup(
      createElement(MediaPicker, { kind: "posts", selected: post, onSelect: () => {} })
    );

    expect(html).not.toContain(ID_SEM_META);
    expect(html).toContain("Post selecionado");
  });
});

// -----------------------------------------------------------------------------
// O TETO DE BUSCAS AVULSAS — "recentes + 8" era um teto de CUSTO, e o custo
// mudou.
//
// O DEFEITO, MEDIDO EM 15/09/2026: 21 das 27 automações desta conta apontam
// para post FORA dos 40 recentes, e `MAX_INDIVIDUAL_LOOKUPS = 8` atendia oito
// delas. As outras 13 ficavam SEM CAPA para sempre — não "lentas", não
// "quebradas": sem capa, carregamento após carregamento, porque o corte é por
// `.slice` e a mesma lista chega na mesma ordem toda vez. O teto de 8 existia
// porque cada busca avulsa custava rede a cada render (8 em paralelo = 509 ms).
// Com o cache da Tarefa 1 essa repetição saiu do caminho, e o teto passou a ser
// só o que ele ainda precisa ser: um limite contra lista patológica.
//
// O QUE ESTE BLOCO MEDE: a FORMA das chamadas — uma listagem mais N avulsas —,
// e NÃO o cache do Next, que sob o vitest não guarda nada (medido em
// 15/09/2026, dentro e fora de `comoNumaRequisicao`: o `IncrementalCache` desta
// fundação nasce com `maxMemoryCacheSize: 0` e sem manipulador de disco). É por
// isso que o contador aqui enxerga TODAS as chamadas — o que é bom para esta
// pergunta — e é por isso que NENHUMA asserção deste bloco fala sobre o cache
// guardar: ela passaria verde medindo o nada.
//
// POR QUE DENTRO DE `comoNumaRequisicao`: `unstable_cache`
// (next/dist/server/web/spec-extension/unstable-cache.js:60) LANÇA
// "Invariant: incrementalCache missing" quando não acha `workStore`. Fora do
// contexto de requisição, os dois embrulhos de `lib/media-lookup.ts` estourariam
// — e `resolvePosts` engole os dois (try/catch na listagem, `allSettled` nas
// avulsas). O contador veria ZERO pedidos e o caso ficaria vermelho falando de
// teto, quando o assunto seria outro.
//
// O MECANISMO é o de `testes-integracao/teto-da-meta.integracao.ts` (leia o
// cabeçalho dele: as duas travas de `baseDoGraph`, lib/ig.ts, e por que este
// caminho não usa mock). Lá o servidor local serve para PENDURAR; aqui ele
// serve para CONTAR, por rota.
describe("o teto de buscas avulsas para de ser 'recentes + 8'", () => {
  let servidorContador: Server;
  let listagens = 0;
  let avulsas = 0;

  beforeAll(async () => {
    servidorContador = createServer((req, res) => {
      const u = new URL(req.url ?? "/", "http://127.0.0.1");
      res.writeHead(200, { "content-type": "application/json" });
      // A LISTAGEM: `getMedia` (lib/ig.ts) bate em `/{versão}/{conta}/media`.
      // Devolve lista VAZIA de propósito — nenhum id procurado está nos
      // recentes, que é a situação das 21 automações de 15/09.
      if (u.pathname.endsWith(`/${CONTA}/media`)) {
        listagens++;
        res.end(JSON.stringify({ data: [] }));
        return;
      }
      // A AVULSA: `getMediaById` bate em `/{versão}/{id}`. Só estas duas rotas
      // existem no caminho de `resolvePosts`, então tudo que não é a listagem é
      // uma busca avulsa.
      avulsas++;
      res.end(JSON.stringify({ id: u.pathname.split("/").pop() ?? "" }));
    });
    await new Promise<void>((pronto) => servidorContador.listen(0, "127.0.0.1", pronto));
    const porta = (servidorContador.address() as AddressInfo).port;
    process.env.IG_GRAPH_BASE = `http://127.0.0.1:${porta}`;
  });

  afterAll(async () => {
    delete process.env.IG_GRAPH_BASE;
    await new Promise<void>((pronto) => servidorContador.close(() => pronto()));
  });

  /** Ids que NÃO estão nos recentes (a listagem deste servidor é vazia) e não
   * colidem com nenhum outro id semeado neste arquivo. */
  function idsDeTeste(quantos: number): string[] {
    return Array.from({ length: quantos }, (_, i) => `1890000000000${String(i).padStart(4, "0")}`);
  }

  /** Quantos pedidos de cada rota o corpo provocou. Zera os contadores antes,
   * porque o servidor é compartilhado pelos casos deste bloco. */
  async function contarPedidos(
    corpo: () => Promise<void>
  ): Promise<{ listagens: number; avulsas: number }> {
    listagens = 0;
    avulsas = 0;
    await comoNumaRequisicao("/automacoes", corpo);
    return { listagens, avulsas };
  }

  test("resolvePosts busca alem dos 8 antigos, e respeita o teto novo", async () => {
    const pedidos = await contarPedidos(async () => {
      await resolvePosts(CONTA, TOKEN, idsDeTeste(20)); // nenhum nos "recentes"
    });
    // UMA listagem: a primeira tentativa continua sendo a lista dos recentes,
    // e ela não se multiplica por id procurado.
    expect(pedidos.listagens).toBe(1);
    // E as VINTE avulsas: com o teto antigo isto parava em 8, e as 12 restantes
    // ficavam sem capa para sempre.
    expect(pedidos.avulsas).toBe(20);
  });

  test("o teto ainda existe, contra lista patologica", async () => {
    const pedidos = await contarPedidos(async () => {
      await resolvePosts(CONTA, TOKEN, idsDeTeste(100));
    });
    // O teto não sumiu, só mudou de motivo: não é mais custo por chamada, é
    // proteção contra uma lista absurda virar enxurrada de chamadas.
    expect(pedidos.avulsas).toBe(MAX_INDIVIDUAL_LOOKUPS);
  });
});

// -----------------------------------------------------------------------------
// O PRAZO PASSA A SER DO `resolvePosts` — E O QUE JÁ VEIO DE GRAÇA FICA.
//
// O DEFEITO, DE 16/09/2026: o `Promise.race` de `app/automacoes/page.tsx:114`
// devolve `new Map()` quando o prazo vence — jogando fora as capas que a
// listagem dos 40 recentes JÁ tinha resolvido, sem custo nenhum a mais. E
// `app/eventos/page.tsx:145` não tem corrida alguma: chama `resolvePosts` cru.
//
// POR QUE ISSO PIOROU AGORA: a Tarefa 2 subiu `MAX_INDIVIDUAL_LOOKUPS` de 8
// para 32, e as medições de 16/09/2026 contra a Meta de verdade (com o token da
// conta DONA de cada post) dizem o preço: listagem dos 40 = 498 ms; 8 avulsas
// em paralelo = 497 ms; 21 = 572 ms; 32 = 721 ms. O caminho frio saiu de ~1,0 s
// para ~1,2 s, e a folga sobre os 2500 ms do call site caiu de ~3x para ~1,5x.
// Vencer o prazo ficou mais provável, e o desfecho era tela SEM CAPA NENHUMA.
//
// O MECANISMO: o mesmo servidor local dos blocos acima, agora com as DUAS
// metades juntas — a rota da LISTAGEM responde na hora (como a listagem de
// verdade, que é rápida), e a rota da BUSCA AVULSA aceita a conexão e NUNCA
// responde. Essa segunda metade é o servidor mudo de
// `testes-integracao/teto-da-meta.integracao.ts` (leia o cabeçalho dele: por
// que não é mock, e por que `afterAll` precisa destruir os sockets à força —
// uma conexão que nunca responde também nunca fecha sozinha, e sem isso o
// vitest não sai deste arquivo).
//
// POR QUE DENTRO DE `comoNumaRequisicao`: o mesmo motivo do bloco do teto,
// acima — `unstable_cache` lança "Invariant: incrementalCache missing" sem
// `workStore`, e `resolvePosts` engoliria os dois estouros, medindo outra coisa.
describe("o prazo é do resolvePosts, e a capa de graça não é jogada fora", () => {
  // Fora das faixas usadas pelos outros blocos deste arquivo, para nenhum id
  // colidir com automação semeada ou com `idsDeTeste`.
  const ID_NA_LISTAGEM = "17900000000000881";
  const ID_FORA_DA_LISTAGEM = "17900000000000882";
  const CAPA_DA_LISTAGEM = "https://exemplo-do-teste.invalid/capa-de-graca.jpg";

  let servidor: Server;
  const socketsAbertos = new Set<Socket>();
  // QUANTAS AVULSAS CHEGARAM DE VERDADE. Sem este contador, o caso abaixo
  // passaria vazio: `mapa.get(ID_FORA_DA_LISTAGEM)` também é `undefined`
  // quando a busca avulsa nem sai do processo. É a mesma prova que `pedidos`
  // faz em `testes-integracao/teto-da-meta.integracao.ts`.
  let avulsasPresas = 0;

  beforeAll(async () => {
    servidor = createServer((req, res) => {
      const u = new URL(req.url ?? "/", "http://127.0.0.1");
      // A LISTAGEM (`getMedia`, lib/ig.ts) responde NA HORA, com o post que a
      // tela vai querer: é a capa que sai de graça e que o descarte jogava fora.
      if (u.pathname.endsWith(`/${CONTA}/media`)) {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            data: [
              {
                id: ID_NA_LISTAGEM,
                media_type: "IMAGE",
                media_url: CAPA_DA_LISTAGEM,
                caption: "veio da listagem, de graça",
                permalink: "https://instagram.com/p/capa-de-graca",
              },
            ],
          })
        );
        return;
      }
      // A AVULSA (`getMediaById`) FICA PRESA: nem `writeHead`, nem `write`, nem
      // `end`. Do lado do cliente é indistinguível de "a Meta aceitou e não
      // respondeu" — que é o caminho caro de 721 ms virando caminho infinito.
      avulsasPresas++;
    });
    servidor.on("connection", (socket) => {
      socketsAbertos.add(socket);
      socket.on("close", () => socketsAbertos.delete(socket));
    });
    await new Promise<void>((pronto) => servidor.listen(0, "127.0.0.1", pronto));
    const porta = (servidor.address() as AddressInfo).port;
    process.env.IG_GRAPH_BASE = `http://127.0.0.1:${porta}`;
  });

  afterAll(async () => {
    delete process.env.IG_GRAPH_BASE;
    // As conexões das avulsas presas nunca fecham sozinhas — ver o `afterAll`
    // de `testes-integracao/teto-da-meta.integracao.ts` para o porquê inteiro.
    servidor.closeAllConnections?.();
    for (const socket of socketsAbertos) socket.destroy();
    await new Promise<void>((pronto) => servidor.close(() => pronto()));
  });

  /** A listagem responde na hora; as avulsas ficam presas. Zera o contador
   * antes, porque o servidor é compartilhado pelos casos deste bloco. */
  async function comListagemRapidaEAvulsasPresas<T>(corpo: () => Promise<T>): Promise<T> {
    avulsasPresas = 0;
    const { valor } = await comoNumaRequisicao("/automacoes", corpo);
    return valor;
  }

  test("vencido o prazo, o que veio da listagem NAO e jogado fora", async () => {
    // O DEFEITO, medido em 16/09/2026: o `Promise.race` de
    // app/automacoes/page.tsx:114 devolve `new Map()` quando o prazo vence --
    // jogando fora as capas que a listagem ja tinha resolvido de graca. Com o
    // teto de avulsas em 32 (721ms medidos, contra 497ms de 8), vencer o prazo
    // ficou mais provavel, e o desfecho era tela SEM CAPA NENHUMA.
    //
    // Aqui a listagem responde na hora e as avulsas nunca respondem. O certo e
    // devolver o que a listagem deu.
    const mapa = await comListagemRapidaEAvulsasPresas(async () =>
      resolvePosts(CONTA, TOKEN, [ID_NA_LISTAGEM, ID_FORA_DA_LISTAGEM])
    );
    expect(mapa.get(ID_NA_LISTAGEM)).toBeTruthy();   // veio de graca, tem de ficar
    expect(mapa.get(ID_FORA_DA_LISTAGEM)).toBeUndefined(); // nao deu tempo, e tudo bem
    // E a avulsa SAIU MESMO: sem isto, um `resolvePosts` que nem tentasse a
    // segunda etapa passaria neste caso do mesmo jeito.
    expect(avulsasPresas).toBeGreaterThan(0);
  });

  test("resolvePosts desiste dentro do teto, e nao fica pendurado", async () => {
    const t0 = Date.now();
    await comListagemRapidaEAvulsasPresas(async () =>
      resolvePosts(CONTA, TOKEN, [ID_NA_LISTAGEM, ID_FORA_DA_LISTAGEM])
    );
    const gasto = Date.now() - t0;
    expect(gasto).toBeLessThan(TETO_DA_RESOLUCAO_MS + 700);
    // E o teto REAL, e nao uma copia encurtada para o teste: um teto que so
    // existe no teste e uma segunda verdade. Mesma disciplina do cabecalho de
    // testes-integracao/teto-da-meta.integracao.ts.
    //
    // O PISO, pelo mesmo motivo que aquele arquivo da um: sem ele este caso
    // passaria verde tambem se `resolvePosts` desistisse NA HORA, sem esperar
    // nada -- e ai o teto nao estaria sendo medido, so a ausencia de espera.
    expect(gasto).toBeGreaterThanOrEqual(TETO_DA_RESOLUCAO_MS - 300);
  });
  test("o gatilho decide o alvo: dm não guarda media_id, e story não guarda post", async () => {
    // O DEFEITO QUE ISTO PRENDE, e ele NÃO é "dado morto": três linhas depois do
    // recorte por post, `findMatch` (lib/engine.ts:263) desempata com
    // `candidates.find((a) => trigger === "story" ? a.story_id : a.media_id)`.
    // Para o gatilho `dm` esse `a.media_id` continua sendo consultado, então um
    // media_id sobrando faz a automação GANHAR o desempate de uma DM por causa
    // de um post que não tem nada a ver com a conversa. O sintoma seria "a
    // automação errada respondeu", e a causa moraria numa coluna que a tela de
    // DM nem mostra.
    //
    // MEDIDO em produção em 16/09/2026: 27 automações têm media_id e TODAS têm
    // o gatilho `comment`; NENHUMA usa `dm`. Latente hoje — e é justamente por
    // isso que precisa de portão: quando a primeira automação de DM nascer,
    // ninguém vai estar procurando por isto.
    //
    // ESTE CASO ATRAVESSA A AÇÃO DE VERDADE, e não a função pura. O teste puro
    // de `alvoDoGatilho` (tests/alvo-do-gatilho.test.ts) SOBREVIVEU ao plantio
    // que devolve `post?.id` direto no `salvarAutomacao` — a regra tinha dono e
    // ninguém provava que a gravação o usava.
    const POST = { id: "17900000000000501", thumb: "", caption: "post do alvo" };
    const STORY = { id: "17900000000000502", thumb: "" };

    const id = await semearAutomacao({ mediaId: "17900000000000500", thumb: null, caption: null });

    await salvarComGatilho({ id, gatilho: "comment", post: POST, story: STORY });
    expect(await alvoGravado(id)).toEqual({ media_id: POST.id, story_id: null });

    await salvarComGatilho({ id, gatilho: "story", post: POST, story: STORY });
    expect(await alvoGravado(id)).toEqual({ media_id: null, story_id: STORY.id });

    // O QUE IMPORTA: mesmo com a tela mandando post E story, o gatilho `dm` não
    // guarda nenhum dos dois.
    await salvarComGatilho({ id, gatilho: "dm", post: POST, story: STORY });
    expect(await alvoGravado(id)).toEqual({ media_id: null, story_id: null });
  });
});
