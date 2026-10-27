// SEMEAR O CONTEXTO DE REQUISIÇÃO DO NEXT — a peça que faltava para exercitar
// um Server Action sem servidor e sem sessão.
//
// POR QUE ISTO EXISTE. Os quatro primeiros caminhos da Frente 2 entram pelo
// motor (`lib/engine.ts`, `lib/queue-drain.ts`), e o nó deles era o banco. As
// duas portas de `app/automacoes/actions.ts` têm outro nó: elas passam por
// `getSelectedAccountId` (lib/account.ts), que chama `cookies()` de
// `next/headers`, e fora de uma requisição isso estoura com
// "`cookies` was called outside a request scope". Enquanto esse nó não se
// desatou, aquele arquivo não tinha NENHUM teste que o importasse — e dois dos
// oito defeitos que sobreviviam a tudo moravam exatamente lá.
//
// -----------------------------------------------------------------------------
// ISTO NÃO É MOCK, e a distinção não é retórica.
//
// Nenhum módulo é substituído por imitação. As quatro peças abaixo são todas do
// pacote `next` instalado, chamadas pelo nome que o próprio Next usa quando
// atende uma requisição de verdade:
//
//   next/dist/server/node-environment-baseline.js   -> planta globalThis.AsyncLocalStorage
//   next/dist/server/async-storage/request-store.js -> createRequestStoreForAPI
//   next/dist/server/async-storage/work-store.js    -> createWorkStore
//   next/dist/server/lib/incremental-cache/index.js -> IncrementalCache (real, em memória)
//
// O que se semeia é o ARMAZENAMENTO, não o comportamento: `cookies()` continua
// sendo o `cookies()` do Next, e é ele quem lê o que está aqui. Os dois
// armazenamentos são `AsyncLocalStorage` DO NODE — conferido abaixo com
// `instanceof` —, exportados pelos módulos `.external.js` do próprio pacote,
// que existem justamente para serem uma instância só, compartilhada.
//
// -----------------------------------------------------------------------------
// A JARRA DE COOKIES SAI VAZIA, E ISSO É O PONTO.
//
// NENHUM COOKIE É FORJADO — nem o de sessão, nem o de conta. Não há
// `metodochat_session` (lib/auth.ts) e não há `metodochat_account`
// (lib/account.ts) nesta montagem, e não é descuido: é a única forma honesta.
//
// `getSelectedAccount` (lib/account.ts) cai na PRIMEIRA conta quando o cookie
// está ausente, e o schema descartável tem exatamente uma. Esse tombo é o
// COMPORTAMENTO DECLARADO da própria função, escrito no comentário que está em
// cima dela desde sempre — não é brecha, não é atalho, e não é uma sessão
// inventada. A conta do teste é a conta do teste por construção do schema.
//
// Se algum dia alguém precisar de DUAS contas neste caminho, a saída NÃO é
// forjar o cookie: é medir de novo. Forjar cookie de sessão é regra do dono, e
// esta fundação existe sem quebrá-la.
//
// -----------------------------------------------------------------------------
// E QUANDO A AÇÃO EXIGE SESSÃO (26/10/2026, docs/specs/2026-10-26-sessao-conferida.md).
//
// Desde a varredura de segurança desse dia, toda Server Action do painel começa
// por `await exigirSessao()`, e com a jarra vazia ela vai para /entrar antes de
// fazer qualquer coisa. A jarra CONTINUA VAZIA POR PADRÃO: `comoNumaRequisicao`
// não mudou, e é com ela que se mede o "sem sessão, nada acontece".
//
// Para medir o CORPO de uma ação, há a variante opt-in
// `comoNumaRequisicaoComSessao`, e ela também NÃO FORJA NADA. Ela entra pela ação
// de entrar de verdade (app/entrar/actions.ts), com a SENHA DE TESTE abaixo, e
// leva na requisição seguinte o cookie que essa ação emitiu. O cookie de conta
// continua ausente, e o tombo para a primeira conta continua valendo. Decidido
// pelo Eduardo pela caixa em 26/10/2026, com as condições da auditoria (achado 131).
//
// -----------------------------------------------------------------------------
// A ORDEM É OBRIGATÓRIA, e é a armadilha que quase matou este caminho.
//
// `createAsyncLocalStorage` (next/dist/server/app-render/async-local-storage.js)
// lê `globalThis.AsyncLocalStorage` UMA VEZ, na avaliação do módulo. Em Node
// puro esse global não existe (medido: Node v24.16.0 -> `undefined`), e sem ele
// o Next cai no `FakeAsyncLocalStorage`, cujo `run()` LANÇA. Quem carregar os
// módulos de armazenamento antes do baseline não tem conserto depois.
//
// -----------------------------------------------------------------------------
// O LIMITE HONESTO. Sob o vitest o `"use server"` é inerte, então a função é
// chamada DIRETO. Isto exercita o CORPO do Server Action, e não a fronteira de
// serialização do POST — a mesma fronteira que os outros quatro caminhos da
// Frente 2 também não testam.
//
// -----------------------------------------------------------------------------
// E SERVE PARA ROUTE HANDLER TAMBÉM — foi para isso que o `after()` entrou.
//
// Um `POST` de `app/api/.../route.ts` é uma função exportada que recebe um
// `Request`: não há fronteira de serialização nenhuma no caminho, então chamá-lo
// aqui exercita a rota INTEIRA — corpo cru, conferência de assinatura, parse e
// despacho. O que faltava era só o fim: `after()` (next/server) EXIGE `waitUntil`
// e `onClose` no `renderOpts`, e com os dois `undefined` a última linha do
// handler estourava com "after() will not work correctly, because waitUntil is
// not available in the current environment".
//
// Os dois campos abaixo são o que uma plataforma serverless faz, e nada além:
// `onClose` é "a resposta foi entregue" e `waitUntil` é "segure o processo vivo
// até esta promessa terminar". Aqui a resposta é dada quando `corpo` retorna, e
// então este arquivo fecha a requisição e espera o trabalho de fundo — a MESMA
// ordem da plataforma, e não uma imitação dela: quem roda o `after` continua
// sendo o `AfterContext` do Next, com a fila dele.
//
// NENHUM COOKIE ENTROU JUNTO. A jarra continua vazia (ver acima), e o webhook
// nem a consultaria: ele autentica por assinatura HMAC do corpo.
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, createHmac } from "node:crypto";
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// A SENHA DE TESTE, posta ANTES de qualquer coisa derivar a chave da sessão.
//
// A chave é sha256("metodochat-session:" + ADMIN_PASSWORD) (lib/auth.ts), guardada
// em cache POR PROCESSO. O `.env.local` tem a senha de verdade, e este harness
// nunca a lê (banco-descartavel.ts). Mas se ela chegasse ao `process.env` por
// outro caminho (o shell, um `vercel env pull`), o login da variante com sessão
// emitiria um cookie que vale 30 dias no painel de produção. Por isso a senha é
// um LITERAL, e SOBRESCREVE o que vier do ambiente, como tests/session.test.ts
// já faz. E a variante confere a assinatura do cookie contra este literal
// (`assinadoComASenhaDeTeste`) antes de usá-lo: se algo no processo derivou a
// chave antes com outra senha, a assinatura não bate, e o caminho morre em
// vermelho. O valor do cookie nunca é impresso.
export const SENHA_DE_TESTE = "senha-de-teste-que-nao-vale-nada";
process.env.ADMIN_PASSWORD = SENHA_DE_TESTE;

/** O cookie `v2.<expira>.<assinatura>` foi assinado com a chave da SENHA DE TESTE? */
export function assinadoComASenhaDeTeste(valor: string): boolean {
  const [versao, expira, assinatura] = valor.split(".");
  if (versao !== "v2" || !expira || !assinatura) return false;
  const chave = createHash("sha256").update(`metodochat-session:${SENHA_DE_TESTE}`).digest();
  return createHmac("sha256", chave).update(`${versao}.${expira}`).digest("hex") === assinatura;
}

// ---------------------------------------------------------------------------
// A GUARDA — e ela é a razão de este arquivo ter mais comentário que código.
//
// ESTE CAMINHO DEPENDE DE CAMINHOS INTERNOS DO NEXT (`next/dist/server/...`),
// que não são API pública e podem se mexer numa atualização. Sem proteção, uma
// atualização do Next não transformaria este caminho em teste VERMELHO — o que
// seria ótimo. Ela poderia transformá-lo em teste que PASSA SEM MEDIR NADA, que
// é o pior defeito possível num instrumento.
//
// E esta base já foi mordida por isso DUAS VEZES, as duas registradas em
// `scripts/varredura-portao.mjs`:
//
//   1. a contraprova da varredura ficou MUDA por três pontos de chamada sem
//      ramo, e o único sinal foi "CONTRAPROVA MUDA" — indistinguível de "o
//      código de hoje ficou parecido com o de ontem";
//   2. a guarda do instrumento perguntava `=== 0` onde devia perguntar `> 0`, e
//      assim ela calava justamente quando o contador SUMIA (`undefined === 0` é
//      falso), que é a forma que a quebra de verdade tem.
//
// A lição das duas é a mesma: a guarda não pode depender de o instrumento ainda
// estar inteiro o bastante para responder. Por isso aqui não se pergunta "o
// valor mudou?", e sim "a peça está onde eu afirmo que está, e ela fez o que eu
// afirmo que ela faz?" — e a resposta errada estoura NA IMPORTAÇÃO deste
// módulo, antes de qualquer teste ter chance de passar.
//
// São três níveis, e nenhum é redundante com o outro:
//
//   A. A PEÇA RESOLVE       -> `pecaDoNext`: o caminho interno ainda existe
//   B. A EXPORTAÇÃO EXISTE  -> `fabricaDoNext` / `alsDoNext`: e é do tipo certo
//   C. O CONTEXTO FUNCIONA  -> `provarOEfeito`: montado, ele muda o mundo do
//                              jeito esperado — e, NÃO montado, `cookies()`
//                              continua estourando. As duas metades, porque só
//                              a positiva não distingue "o contexto chegou" de
//                              "o Next parou de exigir contexto".
//
// Toda mensagem NOMEIA A PEÇA e diz o que fazer, na mesma disciplina de
// `baseDoGraph()` (lib/ig.ts) e da guarda de assinatura da varredura.
const ONDE_OLHAR =
  "Confira o que mudou em node_modules/next/dist/server/ na versão instalada e " +
  "atualize testes-integracao/semear-requisicao.ts. NÃO troque a peça por uma " +
  "imitação: se ela não existir mais em forma alcançável, este caminho deve " +
  "MORRER em vermelho, e não continuar passando sem medir nada.";

function pecaDoNext(caminho: string, papel: string): Record<string, unknown> {
  try {
    return req(caminho) as Record<string, unknown>;
  } catch (erro) {
    const cru = erro instanceof Error ? erro.message : String(erro);
    throw new Error(
      `PEÇA DO NEXT NÃO RESOLVE: \`${caminho}\`. É ela que ${papel}. ` +
        `Este caminho de teste a carrega por caminho interno do pacote, que não é ` +
        `API pública — uma atualização do Next pode tê-la movido ou renomeado. ` +
        `${ONDE_OLHAR} (erro cru: ${cru})`
    );
  }
}

function fabricaDoNext(
  modulo: Record<string, unknown>,
  nome: string,
  caminho: string,
  papel: string
): unknown {
  const valor = modulo[nome];
  if (typeof valor !== "function") {
    throw new Error(
      `EXPORTAÇÃO DO NEXT AUSENTE: \`${nome}\` não é função em \`${caminho}\` ` +
        `(veio \`${typeof valor}\`). É ela que ${papel}. Sem ela o contexto de ` +
        `requisição não se monta, e um teste que seguisse mesmo assim mediria o nada. ` +
        `${ONDE_OLHAR} ` +
        `(o módulo exporta hoje: ${Object.keys(modulo).join(", ") || "nada"})`
    );
  }
  return valor;
}

function alsDoNext(
  modulo: Record<string, unknown>,
  nome: string,
  caminho: string
): AsyncLocalStorage<unknown> {
  const valor = modulo[nome];
  // `instanceof` contra o AsyncLocalStorage do `node:async_hooks`, e não
  // "tem `.run`?": o FakeAsyncLocalStorage do Next TEM `.run` — ele só lança
  // quando chamado. Um teste de forma passaria por ele e morreria depois, com a
  // mensagem do Next em vez da nossa. A pergunta certa é de IDENTIDADE.
  if (!(valor instanceof AsyncLocalStorage)) {
    const construtor =
      typeof valor === "object" && valor !== null
        ? ` (${(valor as { constructor?: { name?: string } }).constructor?.name ?? "sem construtor"})`
        : "";
    throw new Error(
      `ARMAZENAMENTO DO NEXT NÃO É O DO NODE: \`${nome}\` de \`${caminho}\` não é ` +
        `um AsyncLocalStorage de \`node:async_hooks\` — veio \`${typeof valor}\`${construtor}. ` +
        `Se veio um FakeAsyncLocalStorage, o baseline não plantou ` +
        `\`globalThis.AsyncLocalStorage\` ANTES de este módulo ser avaliado: ` +
        `\`createAsyncLocalStorage\` (next/dist/server/app-render/async-local-storage.js) ` +
        `lê esse global uma vez só, na avaliação, e depois não tem conserto. ` +
        `A ordem dos \`req()\` no topo deste arquivo é obrigatória. ${ONDE_OLHAR}`
    );
  }
  return valor;
}

// --- Nível A e B: as peças, na ordem obrigatória ---------------------------

pecaDoNext(
  "next/dist/server/node-environment-baseline.js",
  "planta `globalThis.AsyncLocalStorage` — sem ela o Next cai no " +
    "FakeAsyncLocalStorage, cujo `run()` lança"
);

// O EFEITO do baseline, e não só o fato de ele ter carregado: a peça pode
// resolver e ter parado de plantar o global. Perguntar `typeof` aqui custa uma
// linha e é a diferença entre estourar agora, com nome, e estourar três módulos
// adiante com a mensagem de outra pessoa.
const globalDoNode = globalThis as { AsyncLocalStorage?: unknown };
if (typeof globalDoNode.AsyncLocalStorage !== "function") {
  throw new Error(
    "BASELINE DO NEXT NÃO FEZ EFEITO: `next/dist/server/node-environment-baseline.js` " +
      "carregou, mas `globalThis.AsyncLocalStorage` continua " +
      `\`${typeof globalDoNode.AsyncLocalStorage}\`. ` +
      "É esse global que `createAsyncLocalStorage` lê — uma vez, na avaliação do " +
      "módulo — para decidir entre o AsyncLocalStorage de verdade e o " +
      "FakeAsyncLocalStorage, que lança em `run()`. Seguir daqui monta um contexto " +
      `que não guarda nada. ${ONDE_OLHAR}`
  );
}

const CAMINHO_WORK = "next/dist/server/app-render/work-async-storage.external.js";
const CAMINHO_WORK_UNIT = "next/dist/server/app-render/work-unit-async-storage.external.js";
const CAMINHO_REQUEST_STORE = "next/dist/server/async-storage/request-store.js";
const CAMINHO_WORK_STORE = "next/dist/server/async-storage/work-store.js";
const CAMINHO_CACHE = "next/dist/server/lib/incremental-cache/index.js";

const workAsyncStorage = alsDoNext(
  pecaDoNext(CAMINHO_WORK, "guarda o work store que `cookies()` consulta"),
  "workAsyncStorage",
  CAMINHO_WORK
);

const workUnitAsyncStorage = alsDoNext(
  pecaDoNext(CAMINHO_WORK_UNIT, "guarda o request store, de onde saem os cookies"),
  "workUnitAsyncStorage",
  CAMINHO_WORK_UNIT
);

const criarRequestStore = fabricaDoNext(
  pecaDoNext(CAMINHO_REQUEST_STORE, "monta o request store a partir de headers reais"),
  "createRequestStoreForAPI",
  CAMINHO_REQUEST_STORE,
  "monta o request store — a jarra de cookies e os headers da requisição"
) as (
  entrada: { headers: Record<string, string> },
  url: URL,
  tagsAnteriores: string[],
  a: undefined,
  b: undefined
) => unknown;

const criarWorkStore = fabricaDoNext(
  pecaDoNext(CAMINHO_WORK_STORE, "monta o work store"),
  "createWorkStore",
  CAMINHO_WORK_STORE,
  "monta o work store — sem ele `revalidatePath` não acha `incrementalCache`"
) as (opcoes: Record<string, unknown>) => { pendingRevalidatedTags?: unknown[] };

const CacheDoNext = fabricaDoNext(
  pecaDoNext(CAMINHO_CACHE, "é o cache incremental que `revalidatePath` exige presente"),
  "IncrementalCache",
  CAMINHO_CACHE,
  "é o cache incremental de verdade, em memória"
) as new (opcoes: Record<string, unknown>) => unknown;

function cacheDeVerdade(): unknown {
  // O IncrementalCache do Next, sem `fs` e sem `serverDistDir`: sem esses dois
  // ele não escolhe manipulador de disco e fica em memória. `revalidatePath`
  // (next/dist/server/web/spec-extension/revalidate.js) exige que este campo
  // exista; no ramo `type: 'request'` ele nunca é chamado — só empilha a tag em
  // `store.pendingRevalidatedTags`. Não há nem um objeto de mentira aqui.
  //
  // O MANIFESTO VAI COMO OBJETO, E O `previewProps` À PARTE, DESDE O NEXT 16.4 (medido em 27/10/2026, na
  // atualização para a 16.4.3). Até a 16.3, o construtor recebia `getPrerenderManifest`, uma função; na
  // 16.4 ele passou a receber `prerenderManifest` (o objeto) e `previewProps`, e lê
  // `previewProps.previewModeId` logo no começo
  // (next/dist/server/lib/incremental-cache/index.js, no `constructor`). Com o formato antigo, todo
  // contexto semeado estourava com "Cannot read properties of undefined (reading 'previewModeId')".
  const preview = { previewModeId: "", previewModeSigningKey: "", previewModeEncryptionKey: "" };
  return new CacheDoNext({
    fs: undefined,
    dev: true,
    flushToDisk: false,
    minimalMode: false,
    serverDistDir: undefined,
    requestHeaders: {},
    maxMemoryCacheSize: 0,
    previewProps: preview,
    prerenderManifest: {
      version: 4,
      routes: {},
      dynamicRoutes: {},
      notFoundRoutes: [],
      preview,
    },
    fetchCacheKeyPrefix: "",
    CurCacheHandler: undefined,
    allowedRevalidateHeaderKeys: [],
  });
}

export type DentroDaRequisicao<T> = {
  /** O que o corpo devolveu. */
  valor: T;
  /** As tags que `revalidatePath` empilhou — a prova de que a revalidação foi pedida. */
  tags: unknown[];
  /**
   * Quantas promessas o handler entregou ao `waitUntil` — a prova de que o
   * `after()` do fim da rota rodou, e não morreu calado. Zero para quem não usa
   * `after`, que é o caso dos Server Actions.
   */
  depois: number;
};

async function rodarNoContexto<T>(
  rota: string,
  corpo: () => Promise<T>,
  // Só `comoNumaRequisicaoComSessao` passa algo aqui: o cookie que a ação de
  // entrar emitiu. Ver o cabeçalho.
  cabecalhos: Record<string, string> = {}
): Promise<DentroDaRequisicao<T>> {
  const requestStore = criarRequestStore(
    { headers: cabecalhos }, // VAZIO POR PADRÃO: nada é forjado. Ver o cabeçalho.
    new URL(`http://127.0.0.1${rota}`),
    [],
    undefined,
    undefined
  );
  // O TRABALHO DE FUNDO desta requisição. Ver o cabeçalho: `after()` só existe
  // com estes dois, e os dois são do tamanho do que a plataforma promete.
  const pendentes: Promise<unknown>[] = [];
  const aoFechar: (() => void)[] = [];
  let fechada = false;
  let entregues = 0;

  const workStore = criarWorkStore({
    page: rota,
    renderOpts: {
      supportsDynamicResponse: true,
      isPossibleServerAction: true,
      incrementalCache: cacheDeVerdade(),
      // "Segure o processo vivo até isto terminar." Guardar a promessa é
      // exatamente a promessa que o nome faz; quem a espera é o fim desta
      // função, depois de a resposta estar pronta.
      waitUntil: (p: Promise<unknown>) => {
        entregues++;
        pendentes.push(p);
      },
      // "Avise quando a resposta tiver sido entregue." O `AfterContext` do Next
      // registra aqui o gatilho da fila dele. Se alguém registrar depois de a
      // resposta já ter fechado, dispara na hora — senão a fila ficaria parada
      // para sempre e o teste travaria sem dizer por quê.
      onClose: (cb: () => void) => {
        if (fechada) cb();
        else aoFechar.push(cb);
      },
      onAfterTaskError: undefined,
      // A 16.3 lê `renderOpts.experimental.useCacheTimeout` sem `?.`
      // (next/dist/server/async-storage/work-store.js): sem este objeto, toda
      // requisição semeada cai com TypeError antes de o corpo rodar. Vazio, o
      // `use cache` fica no padrão do Next, e este painel não usa `use cache`.
      experimental: {},
    },
    isPrefetchRequest: false,
    buildId: "teste-integracao",
    deploymentId: undefined,
    previouslyRevalidatedTags: [],
    nonce: undefined,
  });

  const valor = await workAsyncStorage.run(workStore, () =>
    workUnitAsyncStorage.run(requestStore, corpo)
  );

  // A RESPOSTA ESTÁ PRONTA: é aqui que a plataforma fecha a requisição e só
  // depois deixa o trabalho de fundo correr. A ordem é a dela, e não uma
  // conveniência daqui.
  fechada = true;
  for (const cb of aoFechar.splice(0)) cb();
  // Em laço porque o trabalho de fundo pode pedir mais trabalho de fundo — é o
  // que o próprio `AfterContext` faz ao empilhar a fila de callbacks.
  // `allSettled` e não `all`: uma tarefa que rejeita é assunto do teste que a
  // provocou, e não motivo para esta fundação estourar por cima dela.
  let rodadas = 0;
  while (pendentes.length) {
    if (++rodadas > 20) {
      throw new Error(
        "TRABALHO DE FUNDO SEM FIM: o `after()` desta requisição continua pedindo " +
          "`waitUntil` depois de 20 rodadas. Alguma tarefa está se reagendando em " +
          "laço — pare de esperar por ela aqui e meça o que a reagenda."
      );
    }
    await Promise.allSettled(pendentes.splice(0));
  }

  return { valor, tags: workStore.pendingRevalidatedTags ?? [], depois: entregues };
}

// --- Nível C: o EFEITO, com as duas metades --------------------------------

let efeitoProvado = false;

async function provarOEfeito(): Promise<void> {
  if (efeitoProvado) return;
  // Marcado ANTES de provar: a metade positiva usa `rodarNoContexto`, e este
  // sinal é o que impede a prova de se chamar de novo em laço.
  efeitoProvado = true;

  const { cookies } = await import("next/headers");

  // METADE NEGATIVA — e ela é a que quase ninguém escreve.
  //
  // Sem ela, o dia em que o Next parasse de exigir contexto de requisição para
  // `cookies()` (ou passasse a devolver uma jarra vazia de consolo) este caminho
  // continuaria VERDE, e ninguém saberia que o contexto semeado virou enfeite. A
  // metade positiva sozinha não distingue "o contexto chegou" de "o contexto
  // deixou de ser necessário": nos dois casos `cookies()` responde.
  let estourouForaDeEscopo = false;
  try {
    await cookies();
  } catch {
    estourouForaDeEscopo = true;
  }
  if (!estourouForaDeEscopo) {
    throw new Error(
      "O CONTEXTO DO NEXT DEIXOU DE SER EXIGIDO: `cookies()` de `next/headers` " +
        "respondeu FORA de qualquer requisição, quando deveria estourar com " +
        '"`cookies` was called outside a request scope". Este arquivo inteiro existe ' +
        "para semear esse contexto; se ele não é mais necessário, os testes que o " +
        "usam podem estar passando sem exercitar nada. Meça o que mudou no Next " +
        `antes de confiar num único resultado verde daqui. ${ONDE_OLHAR}`
    );
  }

  // METADE POSITIVA — o contexto montado responde, e a jarra sai VAZIA.
  const { valor } = await rodarNoContexto("/automacoes", async () => {
    const jarra = await cookies();
    return jarra.getAll().length;
  });
  if (valor !== 0) {
    throw new Error(
      `CONTEXTO SEMEADO COM COOKIE DENTRO: a jarra veio com ${valor} cookie(s), e ` +
        "esta fundação promete que ela sai VAZIA — é dessa promessa que sai o " +
        "direito de dizer que nenhuma sessão é forjada aqui. Alguém pôs header de " +
        "cookie na montagem de `createRequestStoreForAPI`. Tire, ou o caminho passa " +
        "a medir uma sessão inventada em vez do tombo declarado de " +
        "`getSelectedAccount` para a primeira conta do schema."
    );
  }
}

/**
 * Roda `corpo` dentro do mesmo par de armazenamentos que o Next monta para uma
 * requisição — que é o que um Server Action enxerga.
 *
 * Na PRIMEIRA chamada, prova o efeito das duas peças antes de rodar coisa
 * alguma: sem contexto `cookies()` estoura, com contexto ele responde de jarra
 * vazia. A prova é parte do caminho, e não um teste ao lado que dá para apagar
 * sem ninguém notar.
 */
export async function comoNumaRequisicao<T>(
  rota: string,
  corpo: () => Promise<T>
): Promise<DentroDaRequisicao<T>> {
  await provarOEfeito();
  return rodarNoContexto(rota, corpo);
}

// O cabeçalho `cookie` da sessão de teste, depois do primeiro login deste arquivo.
let cookieDaSessaoDeTeste: string | null = null;

/**
 * Entra pela AÇÃO DE ENTRAR DE VERDADE, com a senha de teste, e devolve o
 * cabeçalho `cookie` com o que ela emitiu. Não monta sessão nenhuma à mão.
 *
 * Duas conferências antes de devolver, e as duas estouram sem imprimir o cookie:
 * o login mandou para "/" (o caminho do sucesso, e não só "gravou algo"), e o
 * cookie foi assinado com a SENHA DE TESTE (ver o topo deste arquivo).
 */
async function entrarDeVerdade(): Promise<string> {
  if (cookieDaSessaoDeTeste) return cookieDaSessaoDeTeste;
  const { login } = await import("@/app/entrar/actions");
  const { cookies } = await import("next/headers");
  const { SESSION_COOKIE } = await import("@/lib/auth");

  const { valor } = await rodarNoContexto("/entrar", async () => {
    const form = new FormData();
    form.set("password", SENHA_DE_TESTE);
    let digest: string | null = null;
    try {
      await login(undefined, form);
    } catch (e) {
      const d = (e as { digest?: unknown }).digest;
      if (typeof d !== "string") throw e;
      digest = d;
    }
    return { digest, cookie: (await cookies()).get(SESSION_COOKIE)?.value ?? null };
  });

  const destino = valor.digest?.startsWith("NEXT_REDIRECT;")
    ? valor.digest.split(";").slice(2, -2).join(";")
    : null;
  if (destino !== "/") {
    throw new Error(
      `O LOGIN DE TESTE NÃO ENTROU: a ação de entrar devia mandar para "/", e ` +
        `${destino === null ? "voltou sem redirect" : `mandou para "${destino}"`}. ` +
        "Sem isso, a variante com sessão mediria uma sessão que o painel não emitiu."
    );
  }
  if (!valor.cookie || !assinadoComASenhaDeTeste(valor.cookie)) {
    throw new Error(
      "O COOKIE DO LOGIN NÃO É DE TESTE: ele não foi assinado com a SENHA_DE_TESTE " +
        "(o valor não é impresso). Algo no processo derivou a chave da sessão com " +
        "outra senha antes deste arquivo; um cookie desses poderia valer no painel " +
        "de produção. Ache quem leu a ADMIN_PASSWORD antes do topo de " +
        "testes-integracao/semear-requisicao.ts."
    );
  }
  cookieDaSessaoDeTeste = `${SESSION_COOKIE}=${valor.cookie}`;
  return cookieDaSessaoDeTeste;
}

/**
 * Como `comoNumaRequisicao`, mas com a sessão que a ação de entrar emitiu para a
 * senha de teste. É para medir o CORPO de uma Server Action que começa por
 * `await exigirSessao()`; o "sem sessão" se mede com `comoNumaRequisicao`.
 */
export async function comoNumaRequisicaoComSessao<T>(
  rota: string,
  corpo: () => Promise<T>
): Promise<DentroDaRequisicao<T>> {
  await provarOEfeito();
  const cookie = await entrarDeVerdade();
  return rodarNoContexto(rota, corpo, { cookie });
}

/** A sessão de teste está de pé: um booleano, para nenhum teste ver o valor do cookie. */
export async function sessaoDeTesteConfere(): Promise<boolean> {
  const cookie = await entrarDeVerdade();
  const [, valor] = cookie.split("=");
  const { isValidSession } = await import("@/lib/auth");
  return assinadoComASenhaDeTeste(valor) && isValidSession(valor);
}
