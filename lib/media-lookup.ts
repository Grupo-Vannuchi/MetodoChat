import "server-only";
import { unstable_cache } from "next/cache";
import { getMedia, getMediaById } from "./ig";

// Capa e link do post ficam SÓ aqui, buscados na hora de exibir — nunca no
// banco. As URLs de miniatura do CDN do Instagram expiram, então um link salvo
// vira imagem quebrada semanas depois.

// Uma listagem cobre os posts recentes, que é de onde vem quase todo
// comentário. O resto (post antigo) vira busca avulsa, com teto para uma lista
// cheia de posts diferentes não virar uma enxurrada de chamadas.
const RECENT_MEDIA_LIMIT = 40;

// O TETO DAS BUSCAS AVULSAS — hoje ele é OUTRA COISA do que era.
//
// ELE ERA UM TETO DE CUSTO POR CHAMADA. Cada busca avulsa saía à rede a cada
// carregamento das quatro telas, e 8 delas em paralelo custavam 509 ms (medido
// em 15/09/2026). Oito era o que cabia no orçamento de um render.
//
// O QUE ESSE PREÇO COMPRAVA: na mesma medição, 21 das 27 automações desta conta
// apontavam para post FORA dos 40 recentes. O teto de 8 atendia oito delas e
// deixava as outras 13 SEM CAPA PARA SEMPRE — não intermitente, não lenta: sem
// capa em todo carregamento, porque o corte é por `.slice` sobre uma lista que
// chega na mesma ordem toda vez. As mesmas 13 sempre.
//
// O QUE MUDOU: com os embrulhos cacheados abaixo, a REPETIÇÃO ficou de graça —
// 32 buscas em paralelo uma vez a cada 6 h é um perfil de rede menor que 8 a
// cada carregamento, e não maior. O custo que justificava o 8 saiu do caminho.
//
// O QUE O TETO É AGORA: proteção contra LISTA PATOLÓGICA — uma tela que peça
// centenas de posts distintos não pode virar centenas de chamadas de uma vez.
// 32 cobre as 27 de hoje com folga; não é orçamento de tempo, é limite de
// enxurrada. Exportado porque `testes-integracao/capa-do-post.integracao.ts`
// conta requisições contra ele, em vez de repetir o número na mão.
export const MAX_INDIVIDUAL_LOOKUPS = 32;

export type PostRef = {
  id: string;
  permalink: string | null;
  thumb: string | null;
  caption: string | null;
};

type Json = Record<string, unknown>;

function texto(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

function toPostRef(m: Json): PostRef | null {
  const id = texto(m.id);
  if (!id) return null;
  return {
    id,
    permalink: texto(m.permalink),
    // vídeo e reels só têm thumbnail_url; foto só tem media_url
    thumb: texto(m.thumbnail_url) ?? texto(m.media_url),
    caption: texto(m.caption),
  };
}

// ---------------------------------------------------------------------------
// O CACHE DA CAPA — por que ele está AQUI, e não no `fetch`
//
// (a) No `fetch` ele seria anulado em silêncio. As quatro telas que chamam
//     `resolvePosts` (`app/page.tsx`, `app/automacoes/page.tsx`,
//     `app/automacoes/[id]/page.tsx`, `app/eventos/page.tsx`) declaram
//     `export const dynamic = "force-dynamic"`, e isso faz todo `fetch` da
//     página virar `no-store`: um `cache: "force-cache"` dentro de
//     `graphFetch` (lib/ig.ts) pareceria certo e não guardaria nada. Fora
//     disso, `graphFetch` também é o caminho de ENVIO — semântica de cache não
//     tem o que fazer lá.
//
// (b) `unstable_cache` SOBREVIVE ao `force-dynamic`. Isso foi lido na fonte do
//     Next 16.2.10, não na doc (que diz que os dois se equivalem):
//     - node_modules/next/dist/server/app-render/create-component-tree.js:151
//       — `dynamic === 'force-dynamic'` seta SÓ `workStore.forceDynamic = true`.
//     - node_modules/next/dist/server/web/spec-extension/unstable-cache.js:146
//       — o ramo que LÊ do cache pergunta `workStore.fetchCache !==
//       'force-no-store'` e NUNCA olha `forceDynamic`.
//     - node_modules/next/dist/server/lib/patch-fetch.js:353 — é o `fetch` que
//       trata `workStore.forceDynamic` à parte; por isso os dois divergem.
//     Nenhuma tela desta base declara `fetchCache` (conferido). Se alguém
//     declarar `fetchCache = 'force-no-store'` numa delas, este cache morre
//     calado — por isso existe o guarda em `tests/cache-da-capa.test.ts`.
//
// (c) O TOKEN FICA FORA DA CHAVE, de propósito. `unstable_cache` monta a chave
//     com os argumentos mais o `keyParts`; aqui o token entra por fechamento,
//     fora dos dois. Não é descuido: o token não é parte da identidade de "os
//     40 posts recentes da conta X" — dois tokens da mesma conta descrevem o
//     mesmo resultado. E ele é renovado a cada ~60 dias: na chave, a renovação
//     jogaria fora o cache inteiro sem que nada tivesse mudado, e ainda poria
//     um segredo num lugar que persiste entre implantações. Não "conserte"
//     isto movendo o token para `keyParts`.
//
// (d) As duas vidas. A lista dos recentes vive 120 s porque é ela que alimenta
//     o seletor de post: quem acabou de publicar precisa ver o post ali, e dois
//     minutos é o máximo de mentira tolerável. O post pelo id vive 6 h porque
//     post antigo não muda; a miniatura do CDN vale ~2 semanas (medido em
//     15/09/2026: URL de 14/09 -> 200; de 31/08 e 24/08 -> 403), então 6 h fica
//     muito abaixo do prazo de expiração.
//
// (e) SOB O VITEST, `unstable_cache` NÃO GUARDA NADA — medido em 15/09/2026,
//     inclusive entre duas chamadas dentro da mesma requisição simulada: o
//     harness monta um `IncrementalCache` novo por requisição, com
//     `maxMemoryCacheSize: 0`, e a função embrulhada é chamada direto. Logo
//     NENHUM teste desta base prova que o cache guarda — um teste que afirmasse
//     "a segunda chamada não foi à rede" passaria verde medindo o nada. O que
//     os testes medem é a CHAVE (onde moraria o vazamento do token) e as vidas;
//     a prova de que guarda é a medição em produção, registrada no fechamento
//     deste plano.
//
// DÍVIDA DECLARADA: `use cache` (Next 16) exigiria `cacheComponents: true`, que
// é migração de aplicação inteira (todo acesso dinâmico atrás de `Suspense`) —
// grande demais para uma base `force-dynamic` em produção com usuário real.
// `unstable_cache` segue documentado em
// node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md.
// Quando a migração para Cache Components acontecer, estas duas funções são o
// primeiro lugar a trocar.
// ---------------------------------------------------------------------------

export const VIDA_DA_LISTA_S = 120;
export const VIDA_DO_POST_S = 21600;

export function chaveDaLista(igUserId: string): string[] {
  return ["ig", "lista-recente", igUserId];
}
export function chaveDoPost(mediaId: string): string[] {
  return ["ig", "post", mediaId];
}

// Os embrulhos são criados POR CHAMADA porque o token entra por fechamento —
// ver (c) acima. A chave não depende dele, então duas chamadas com tokens
// diferentes da mesma conta acertam a mesma entrada, que é o que se quer.
function listaRecenteCacheada(igUserId: string, token: string) {
  return unstable_cache(
    () => getMedia(igUserId, token, RECENT_MEDIA_LIMIT),
    chaveDaLista(igUserId),
    { revalidate: VIDA_DA_LISTA_S, tags: [`ig:lista:${igUserId}`] }
  )();
}

function postCacheado(mediaId: string, token: string) {
  return unstable_cache(
    () => getMediaById(mediaId, token),
    chaveDoPost(mediaId),
    { revalidate: VIDA_DO_POST_S, tags: [`ig:post:${mediaId}`] }
  )();
}

// Devolve o que conseguiu resolver. Nunca lança: se o Instagram estiver fora do
// ar ou o token vencido, volta um mapa vazio e quem chama mostra a lista sem as
// capas.
export async function resolvePosts(
  igUserId: string,
  token: string,
  mediaIds: string[]
): Promise<Map<string, PostRef>> {
  const mapa = new Map<string, PostRef>();
  const procurados = new Set(mediaIds.filter(Boolean));
  if (!procurados.size) return mapa;

  try {
    for (const m of await listaRecenteCacheada(igUserId, token)) {
      const ref = toPostRef(m);
      if (ref && procurados.has(ref.id)) mapa.set(ref.id, ref);
    }
  } catch {
    // segue para as buscas avulsas: elas podem dar certo mesmo assim
  }

  const faltando = [...procurados].filter((id) => !mapa.has(id)).slice(0, MAX_INDIVIDUAL_LOOKUPS);
  if (faltando.length) {
    const buscas = await Promise.allSettled(faltando.map((id) => postCacheado(id, token)));
    for (const b of buscas) {
      if (b.status !== "fulfilled") continue;
      const ref = toPostRef(b.value);
      if (ref) mapa.set(ref.id, ref);
    }
  }

  return mapa;
}
