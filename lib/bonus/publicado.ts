// A SITUAÇÃO DE UM BÔNUS NO LABS, lida da lista pública (`GET /api/bonus`).
//
// ⚠️ ESTA LEITURA NÃO ESTÁ NO CONTRATO (é a mesma de lib/bonus/temas.ts), e por isso FALHA
// FECHADA: só "publicado" libera o carrossel. A lista traz só bônus ATIVOS, com `codigo` (o
// slug), `palavraChave`, `titulo`, `tema` e `descricao` (medido em 30/09). Do lado do Labs ela
// tem cache de 30 minutos, invalidado por toda ação do /admin e pelo POST (medido pelo auditor).
//
// A PALAVRA É A DO LABS, e nunca a que o Chat guardou: ela pode ter sido trocada no /admin de
// lá depois do envio (o primeiro bônus de 30/09 foi enviado com ZZTESTECHAT e publicado com
// SUMIDO).
import { lerAteOTeto, urlDaPorta } from "./labs";
import { palavraValida, TEMA_MAX } from "./pedido";

/**
 * O TETO DA LISTA, próprio. A lista de produção tinha 20 158 bytes em 30/09 (58 bônus, uns 337
 * bytes cada), e o teto de 16 KiB da resposta do envio já não a comportaria (achado 44 do
 * auditor). 512 KiB cobre perto de 1 500 bônus.
 */
export const LISTA_MAX_BYTES = 512 * 1024;

/** Os tetos do contrato do Labs para título e descrição (lib/bonus/contrato.ts, `LIMITES`). */
const TITULO_MAX = 220;
const DESCRICAO_MAX = 1200;

export type BonusPublicado = { palavra: string; titulo: string; descricao: string; tema: string };

export type SituacaoNoLabs =
  | { tipo: "publicado"; bonus: BonusPublicado }
  | { tipo: "nao_publicado" }
  | { tipo: "sem_resposta" }
  | { tipo: "formato_estranho" }
  | { tipo: "sem_config" };

function textoAte(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t && t.length <= max ? t : null;
}

export function situacaoNaLista(corpo: unknown, slug: string): SituacaoNoLabs {
  const itens =
    corpo !== null && typeof corpo === "object" && !Array.isArray(corpo)
      ? (corpo as { items?: unknown }).items
      : undefined;
  if (!Array.isArray(itens)) return { tipo: "formato_estranho" };

  const item = itens.find(
    (i): i is Record<string, unknown> =>
      i !== null && typeof i === "object" && (i as { codigo?: unknown }).codigo === slug
  );
  if (!item) return { tipo: "nao_publicado" };

  // A palavra entra EXATAMENTE como o Labs a tem: a chamada tem de pedir essa grafia.
  const palavra = typeof item.palavraChave === "string" ? item.palavraChave : "";
  const titulo = textoAte(item.titulo, TITULO_MAX);
  const descricao = textoAte(item.descricao, DESCRICAO_MAX);
  const tema = textoAte(item.tema, TEMA_MAX);
  if (!palavraValida(palavra) || !titulo || !descricao || !tema) return { tipo: "formato_estranho" };
  return { tipo: "publicado", bonus: { palavra, titulo, descricao, tema } };
}

export async function situacaoNoLabs(
  base: string | undefined,
  slug: string,
  fetchImpl: typeof fetch = fetch
): Promise<SituacaoNoLabs> {
  const porta = urlDaPorta(base);
  if (porta === null) return { tipo: "sem_config" };
  let res: Response;
  try {
    res = await fetchImpl(porta, {
      method: "GET",
      signal: AbortSignal.timeout(3_000),
      redirect: "manual",
      cache: "no-store",
    });
  } catch {
    return { tipo: "sem_resposta" };
  }
  if (res.status !== 200) return { tipo: "sem_resposta" };

  let texto: string | null;
  try {
    texto = await lerAteOTeto(res, LISTA_MAX_BYTES);
  } catch {
    return { tipo: "sem_resposta" };
  }
  if (texto === null) return { tipo: "formato_estranho" };
  try {
    return situacaoNaLista(JSON.parse(texto), slug);
  } catch {
    return { tipo: "formato_estranho" };
  }
}
