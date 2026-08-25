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
// armazenamentos são `AsyncLocalStorage` do Node, exportados pelos módulos
// `.external.js` do próprio pacote, que existem justamente para serem uma
// instância só, compartilhada.
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
import { AsyncLocalStorage } from "node:async_hooks";
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);

// A ordem importa: o baseline tem de rodar ANTES de qualquer módulo que leia
// `globalThis.AsyncLocalStorage` no topo.
req("next/dist/server/node-environment-baseline.js");

const { workAsyncStorage } = req(
  "next/dist/server/app-render/work-async-storage.external.js"
) as { workAsyncStorage: AsyncLocalStorage<unknown> };
const { workUnitAsyncStorage } = req(
  "next/dist/server/app-render/work-unit-async-storage.external.js"
) as { workUnitAsyncStorage: AsyncLocalStorage<unknown> };
const { createRequestStoreForAPI } = req("next/dist/server/async-storage/request-store.js") as {
  createRequestStoreForAPI: (
    entrada: { headers: Record<string, string> },
    url: URL,
    tagsAnteriores: string[],
    a: undefined,
    b: undefined
  ) => unknown;
};
const { createWorkStore } = req("next/dist/server/async-storage/work-store.js") as {
  createWorkStore: (opcoes: Record<string, unknown>) => { pendingRevalidatedTags?: unknown[] };
};
const { IncrementalCache } = req("next/dist/server/lib/incremental-cache/index.js") as {
  IncrementalCache: new (opcoes: Record<string, unknown>) => unknown;
};

function cacheDeVerdade(): unknown {
  // O IncrementalCache do Next, sem `fs` e sem `serverDistDir`: sem esses dois
  // ele não escolhe manipulador de disco e fica em memória. `revalidatePath`
  // (next/dist/server/web/spec-extension/revalidate.js) exige que este campo
  // exista; no ramo `type: 'request'` ele nunca é chamado — só empilha a tag em
  // `store.pendingRevalidatedTags`. Não há nem um objeto de mentira aqui.
  return new IncrementalCache({
    fs: undefined,
    dev: true,
    flushToDisk: false,
    minimalMode: false,
    serverDistDir: undefined,
    requestHeaders: {},
    maxMemoryCacheSize: 0,
    getPrerenderManifest: () => ({
      version: 4,
      routes: {},
      dynamicRoutes: {},
      notFoundRoutes: [],
      preview: { previewModeId: "", previewModeSigningKey: "", previewModeEncryptionKey: "" },
    }),
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
};

/**
 * Roda `corpo` dentro do mesmo par de armazenamentos que o Next monta para uma
 * requisição — que é o que um Server Action enxerga.
 */
export async function comoNumaRequisicao<T>(
  rota: string,
  corpo: () => Promise<T>
): Promise<DentroDaRequisicao<T>> {
  const requestStore = createRequestStoreForAPI(
    { headers: {} }, // SEM COOKIE NENHUM: nada é forjado. Ver o cabeçalho.
    new URL(`http://127.0.0.1${rota}`),
    [],
    undefined,
    undefined
  );
  const workStore = createWorkStore({
    page: rota,
    renderOpts: {
      supportsDynamicResponse: true,
      isPossibleServerAction: true,
      incrementalCache: cacheDeVerdade(),
      waitUntil: undefined,
      onClose: undefined,
      onAfterTaskError: undefined,
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
  return { valor, tags: workStore.pendingRevalidatedTags ?? [] };
}
