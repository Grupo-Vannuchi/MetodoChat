// A SITUAÇÃO DE UM BÔNUS NO LABS, lida da lista pública (`GET /api/bonus`).
//
// A LISTA ESTÁ NO CONTRATO DO LABS desde 01/10 (site-ia, docs/contrato-metodo-chat.md, seção do
// `GET /api/bonus`; até a Etapa 8 este comentário dizia o contrário, achado 83). É a mesma leitura de
// lib/bonus/temas.ts. A lista traz só bônus ATIVOS, em ordem de criação, sem o prompt, com `codigo` (o
// slug), `titulo` e `descricao` sempre, e `palavraChave`, `tema` e `skillId` OPCIONAIS: sem valor, a
// chave some do JSON. Por isso a leitura FALHA FECHADA: só "publicado" libera o carrossel. Do lado
// do Labs ela tem cache de 30 minutos, invalidado por toda ação do /admin e pelo POST (medido pelo
// auditor).
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

/** O bônus que o AVULSO consegue usar: o sem palavra entra, com a palavra nula (spec da Etapa 8). */
export type BonusDoAvulso = Omit<BonusPublicado, "palavra"> & { palavra: string | null };

/**
 * A SITUAÇÃO PELA REGRA DO AVULSO (spec da Etapa 8, achado 85): a do bônus do Chat, menos o
 * `sem_palavra`, que vira "publicado" com a palavra nula quando o resto do bônus está no formato.
 */
export type SituacaoDoAvulso =
  | { tipo: "publicado"; bonus: BonusDoAvulso }
  | Exclude<SituacaoNoLabs, { tipo: "publicado" } | { tipo: "sem_palavra" }>;

function textoAte(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t && t.length <= max ? t : null;
}

/**
 * O Labs manda o campo opcional sem valor como chave AUSENTE (o contrato, seção do `GET /api/bonus`). Texto em
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

type SemItem = { tipo: "formato_estranho" } | { tipo: "nao_publicado" };

/** O item da lista com esse código, ou o motivo de não haver um. */
function itemDaLista(corpo: unknown, slug: string): { item: Record<string, unknown> } | SemItem {
  const itens = itensDaLista(corpo);
  if (!itens) return { tipo: "formato_estranho" };
  const item = itens.find((i): i is Record<string, unknown> => ehItem(i) && i.codigo === slug);
  return item ? { item } : { tipo: "nao_publicado" };
}

/** A REGRA DO BÔNUS DO CHAT (`situacaoNoLabs`), a de antes da Etapa 8, sem mudança. */
export function situacaoNaLista(corpo: unknown, slug: string): SituacaoNoLabs {
  const achado = itemDaLista(corpo, slug);
  return "item" in achado ? situacaoDoItem(achado.item) : achado;
}

/**
 * A REGRA DO AVULSO DO LABS (spec da Etapa 8): o pedido pelo código, o "Gerar de novo" e o topo da
 * página do avulso.
 */
export function situacaoNaListaDoAvulso(corpo: unknown, slug: string): SituacaoDoAvulso {
  const achado = itemDaLista(corpo, slug);
  return "item" in achado ? situacaoDoItemDoAvulso(achado.item) : achado;
}

/**
 * A palavra de um item que TEM palavra, EXATAMENTE como o Labs a tem: a chamada tem de pedir essa
 * grafia. A conferência da chamada depende de letras e números sem espaço (`palavraValida`).
 */
function palavraDoItem(
  item: Record<string, unknown>
): { palavra: string } | { tipo: "formato_estranho" } | { tipo: "palavra_fora_do_padrao"; palavra: string } {
  if (typeof item.palavraChave !== "string" || item.palavraChave.length > PALAVRA_DO_LABS_MAX) {
    return { tipo: "formato_estranho" };
  }
  const palavra = item.palavraChave;
  return palavraValida(palavra) ? { palavra } : { tipo: "palavra_fora_do_padrao", palavra };
}

/**
 * O tema, o título e a descrição de um item. O tema vai até o teto do Labs, e não até o do pedido
 * do Chat: no carrossel ele só entra como contexto na mensagem à IA (carrossel-ia-parametros.ts).
 */
function textosDoItem(
  item: Record<string, unknown>
): { titulo: string; descricao: string; tema: string } | { tipo: "sem_tema" } | { tipo: "formato_estranho" } {
  if (ausente(item.tema)) return { tipo: "sem_tema" };
  const tema = textoAte(item.tema, TEMA_DO_LABS_MAX);
  const titulo = textoAte(item.titulo, TITULO_MAX);
  const descricao = textoAte(item.descricao, DESCRICAO_MAX);
  if (!titulo || !descricao || !tema) return { tipo: "formato_estranho" };
  return { titulo, descricao, tema };
}

/** A REGRA DE CADA ITEM PARA O BÔNUS DO CHAT: sem palavra é `sem_palavra`, antes do tema. */
function situacaoDoItem(item: Record<string, unknown>): SituacaoNoLabs {
  // Faltando a palavra e o tema, vale a palavra: sem ela, nenhuma chamada tem o que pedir.
  if (ausente(item.palavraChave)) return { tipo: "sem_palavra" };
  const p = palavraDoItem(item);
  if ("tipo" in p) return p;
  const t = textosDoItem(item);
  if ("tipo" in t) return t;
  return { tipo: "publicado", bonus: { palavra: p.palavra, ...t } };
}

/**
 * A REGRA DE CADA ITEM PARA O AVULSO (spec da Etapa 8): com palavra, a mesma do bônus do Chat; sem
 * palavra, o tema e o resto pela mesma régua, e "publicado" com a palavra nula. O sem tema fica de
 * fora com ou sem palavra.
 */
function situacaoDoItemDoAvulso(item: Record<string, unknown>): SituacaoDoAvulso {
  let palavra: string | null = null;
  if (!ausente(item.palavraChave)) {
    const p = palavraDoItem(item);
    if ("tipo" in p) return p;
    palavra = p.palavra;
  }
  const t = textosDoItem(item);
  if ("tipo" in t) return t;
  return { tipo: "publicado", bonus: { palavra, ...t } };
}

/** Um bônus da lista do Labs que o avulso consegue usar, com o código (o slug) dele. */
export type BonusDoLabs = BonusDoAvulso & { codigo: string };

/** Os bônus da lista que ficaram de fora da escolha, por motivo (achado 84). */
export type BonusDeFora = { semTema: number; palavraForaDoPadrao: number; formatoEstranho: number };

/** O teto do código que o Chat guarda (`carrosseis_gerados.labs_codigo`) e aceita do formulário. */
export const CODIGO_MAX = 200;

/**
 * A LISTA DE ESCOLHA DO CARROSSEL AVULSO (spec da Etapa 7): só os bônus "publicado" pela regra do
 * avulso, do mais novo para o mais velho (a lista do Labs vem na ordem de criação, a crescente).
 * Desde a Etapa 8, o sem palavra entra (com a palavra nula), e os que ficam de fora são contados por
 * motivo; o item sem código válido conta como formato que o Chat não lê. Null quando a resposta não
 * tem a forma de lista.
 */
export function bonusDaLista(corpo: unknown): { bonus: BonusDoLabs[]; deFora: BonusDeFora } | null {
  const itens = itensDaLista(corpo);
  if (!itens) return null;
  const bonus: BonusDoLabs[] = [];
  const deFora: BonusDeFora = { semTema: 0, palavraForaDoPadrao: 0, formatoEstranho: 0 };
  for (const item of itens) {
    if (!ehItem(item) || typeof item.codigo !== "string" || !item.codigo || item.codigo.length > CODIGO_MAX) {
      deFora.formatoEstranho++;
      continue;
    }
    const s = situacaoDoItemDoAvulso(item);
    if (s.tipo === "publicado") bonus.push({ codigo: item.codigo, ...s.bonus });
    else if (s.tipo === "sem_tema") deFora.semTema++;
    else if (s.tipo === "palavra_fora_do_padrao") deFora.palavraForaDoPadrao++;
    else deFora.formatoEstranho++;
  }
  return { bonus: bonus.reverse(), deFora };
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

/** A situação pela regra do avulso (spec da Etapa 8), lida agora pelo código. */
export async function situacaoDoAvulsoNoLabs(
  base: string | undefined,
  codigo: string,
  fetchImpl: typeof fetch = fetch
): Promise<SituacaoDoAvulso> {
  const lida = await lerListaDoLabs(base, fetchImpl);
  return lida.ok ? situacaoNaListaDoAvulso(lida.corpo, codigo) : { tipo: lida.tipo };
}

export type ListaDoLabs = { ok: true; bonus: BonusDoLabs[]; deFora: BonusDeFora } | ({ ok: false } & FalhaDaLeitura);

/** A lista de escolha, lida agora. A falha diz o motivo (a tela usa `quadroDaSituacao`). */
export async function listaDoLabs(base: string | undefined, fetchImpl: typeof fetch = fetch): Promise<ListaDoLabs> {
  const lida = await lerListaDoLabs(base, fetchImpl);
  if (!lida.ok) return lida;
  const lista = bonusDaLista(lida.corpo);
  return lista ? { ok: true, ...lista } : { ok: false, tipo: "formato_estranho" };
}
