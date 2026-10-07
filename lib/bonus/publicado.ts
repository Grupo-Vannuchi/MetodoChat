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
import { palavraValida } from "./pedido";

/**
 * O TETO DA LISTA, próprio. A lista de produção tinha 20 158 bytes em 30/09 (58 bônus, uns 337
 * bytes cada), e o teto de 16 KiB da resposta do envio já não a comportaria (achado 44 do
 * auditor). 512 KiB cobre perto de 1 500 bônus.
 */
export const LISTA_MAX_BYTES = 512 * 1024;

/** Os tetos do contrato do Labs para título e descrição (lib/bonus/contrato.ts, `LIMITES`). */
const TITULO_MAX = 220;
const DESCRICAO_MAX = 1200;

/**
 * Os tetos do Labs para a palavra e o tema de um bônus (site-ia, src/lib/bonus-escrita.ts:68-69:
 * `keyword` até 80, `theme` até 120). São MAIORES que os do pedido do Chat (30 e 80), e um bônus
 * publicado lá dentro deles está no formato certo (achado 58).
 */
const PALAVRA_DO_LABS_MAX = 80;
export const TEMA_DO_LABS_MAX = 120;

export type BonusPublicado = { palavra: string; titulo: string; descricao: string; tema: string };

/**
 * `sem_palavra`, `sem_tema` e `palavra_fora_do_padrao` são bônus publicados no FORMATO DO CONTRATO
 * que o Chat não consegue usar (achados 57 e 58): quem resolve é o operador, no /admin do Labs, e
 * a tela diz isso. Nenhum deles libera o carrossel.
 */
export type SituacaoNoLabs =
  | { tipo: "publicado"; bonus: BonusPublicado }
  | { tipo: "nao_publicado" }
  | { tipo: "sem_palavra" }
  | { tipo: "sem_tema" }
  | { tipo: "palavra_fora_do_padrao"; palavra: string }
  | { tipo: "sem_resposta" }
  | { tipo: "formato_estranho" }
  | { tipo: "sem_config" };

function textoAte(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t && t.length <= max ? t : null;
}

/**
 * O Labs manda o campo opcional sem valor como chave AUSENTE (contrato, site-ia 7971720). Texto em
 * branco conta como ausente. `null` não é o contrato, e fica em `formato_estranho`.
 */
function ausente(v: unknown): boolean {
  return v === undefined || (typeof v === "string" && v.trim() === "");
}

/** Os itens da lista, ou null quando a resposta não tem a forma de lista. */
function itensDaLista(corpo: unknown): unknown[] | null {
  const itens =
    corpo !== null && typeof corpo === "object" && !Array.isArray(corpo)
      ? (corpo as { items?: unknown }).items
      : undefined;
  return Array.isArray(itens) ? itens : null;
}

const ehItem = (i: unknown): i is Record<string, unknown> => i !== null && typeof i === "object";

export function situacaoNaLista(corpo: unknown, slug: string): SituacaoNoLabs {
  const itens = itensDaLista(corpo);
  if (!itens) return { tipo: "formato_estranho" };
  const item = itens.find((i): i is Record<string, unknown> => ehItem(i) && i.codigo === slug);
  return item ? situacaoDoItem(item) : { tipo: "nao_publicado" };
}

/** A REGRA DE CADA ITEM, a mesma para a situação de um bônus e para a lista de escolha do avulso. */
function situacaoDoItem(item: Record<string, unknown>): SituacaoNoLabs {
  // Faltando a palavra e o tema, vale a palavra: sem ela, nenhuma chamada tem o que pedir.
  if (ausente(item.palavraChave)) return { tipo: "sem_palavra" };
  if (typeof item.palavraChave !== "string" || item.palavraChave.length > PALAVRA_DO_LABS_MAX) {
    return { tipo: "formato_estranho" };
  }
  // A palavra entra EXATAMENTE como o Labs a tem: a chamada tem de pedir essa grafia. A
  // conferência da chamada depende de letras e números sem espaço (`palavraValida`).
  const palavra = item.palavraChave;
  if (!palavraValida(palavra)) return { tipo: "palavra_fora_do_padrao", palavra };
  if (ausente(item.tema)) return { tipo: "sem_tema" };

  // O tema vai até o teto do Labs, e não até o do pedido do Chat: no carrossel ele só entra
  // como contexto na mensagem à IA (carrossel-ia-parametros.ts).
  const tema = textoAte(item.tema, TEMA_DO_LABS_MAX);
  const titulo = textoAte(item.titulo, TITULO_MAX);
  const descricao = textoAte(item.descricao, DESCRICAO_MAX);
  if (!titulo || !descricao || !tema) return { tipo: "formato_estranho" };
  return { tipo: "publicado", bonus: { palavra, titulo, descricao, tema } };
}

/** Um bônus da lista do Labs que o Chat consegue usar, com o código (o slug) dele. */
export type BonusDoLabs = BonusPublicado & { codigo: string };

/** O teto do código que o Chat guarda (`carrosseis_gerados.labs_codigo`) e aceita do formulário. */
export const CODIGO_MAX = 200;

/**
 * A LISTA DE ESCOLHA DO CARROSSEL AVULSO (spec da Etapa 7): só os bônus "publicado" pela regra de cada
 * item, do mais novo para o mais velho (a lista do Labs vem na ordem de criação, a crescente). Null
 * quando a resposta não tem a forma de lista.
 */
export function bonusDaLista(corpo: unknown): BonusDoLabs[] | null {
  const itens = itensDaLista(corpo);
  if (!itens) return null;
  const bonus: BonusDoLabs[] = [];
  for (const item of itens) {
    if (!ehItem(item) || typeof item.codigo !== "string" || !item.codigo || item.codigo.length > CODIGO_MAX) continue;
    const s = situacaoDoItem(item);
    if (s.tipo === "publicado") bonus.push({ codigo: item.codigo, ...s.bonus });
  }
  return bonus.reverse();
}

type FalhaDaLeitura = { tipo: "sem_config" } | { tipo: "sem_resposta" } | { tipo: "formato_estranho" };

/** O GET da lista pública, com teto de tempo e de tamanho: o corpo já em JSON, ou o motivo da falha. */
async function lerListaDoLabs(
  base: string | undefined,
  fetchImpl: typeof fetch
): Promise<{ ok: true; corpo: unknown } | ({ ok: false } & FalhaDaLeitura)> {
  const porta = urlDaPorta(base);
  if (porta === null) return { ok: false, tipo: "sem_config" };
  let res: Response;
  try {
    res = await fetchImpl(porta, {
      method: "GET",
      signal: AbortSignal.timeout(3_000),
      redirect: "manual",
      cache: "no-store",
    });
  } catch {
    return { ok: false, tipo: "sem_resposta" };
  }
  if (res.status !== 200) return { ok: false, tipo: "sem_resposta" };

  let texto: string | null;
  try {
    texto = await lerAteOTeto(res, LISTA_MAX_BYTES);
  } catch {
    return { ok: false, tipo: "sem_resposta" };
  }
  if (texto === null) return { ok: false, tipo: "formato_estranho" };
  try {
    return { ok: true, corpo: JSON.parse(texto) };
  } catch {
    return { ok: false, tipo: "formato_estranho" };
  }
}

export async function situacaoNoLabs(
  base: string | undefined,
  slug: string,
  fetchImpl: typeof fetch = fetch
): Promise<SituacaoNoLabs> {
  const lida = await lerListaDoLabs(base, fetchImpl);
  return lida.ok ? situacaoNaLista(lida.corpo, slug) : { tipo: lida.tipo };
}

export type ListaDoLabs = { ok: true; bonus: BonusDoLabs[] } | ({ ok: false } & FalhaDaLeitura);

/** A lista de escolha, lida agora. A falha diz o motivo (a tela usa `quadroDaSituacao`). */
export async function listaDoLabs(base: string | undefined, fetchImpl: typeof fetch = fetch): Promise<ListaDoLabs> {
  const lida = await lerListaDoLabs(base, fetchImpl);
  if (!lida.ok) return lida;
  const bonus = bonusDaLista(lida.corpo);
  return bonus ? { ok: true, bonus } : { ok: false, tipo: "formato_estranho" };
}
