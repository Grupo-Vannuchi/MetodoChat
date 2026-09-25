// A BUSCA DA TELA DE CONTATOS, e o corte que ela torna possível.
//
// POR QUE ELA EXISTE (achado M6): `/contatos` media 8477px — catorze telas de
// rolagem —, e o volume não era enfeite: eram 127 linhas de tabela, uma por
// contato. Densidade sozinha não resolve isso; o que resolve é mostrar menos e
// dar um jeito de achar quem se procura.
//
// E O CORTE DIZ O PRÓPRIO TAMANHO. O comentário da consulta em
// `app/contatos/page.tsx` já tinha escrito o caminho, ao explicar por que o
// `limit 200` anterior era um defeito: *"quando isto pesar, o caminho é uma
// paginação que diz o próprio tamanho, e não um corte calado com outro
// número"*. É o que este arquivo serve.
//
// A BUSCA RODA SOBRE AS LINHAS JÁ CARREGADAS, e não no SQL, pelo mesmo motivo
// que aquela consulta não tem `limit`: as fichas e a contagem de alcançáveis
// precisam da conta INTEIRA, e o alcance é decidido por `windowState` em JS.
// Filtrar no banco devolveria uma tela cujos números não fecham com as fichas.
//
// NENHUM IMPORT. É texto e aritmética.

/** Quantas linhas a tabela mostra de uma vez. */
export const LIMITE_DA_TABELA = 25;

/** O maior termo aceito — a barra de endereço é digitável por qualquer um. */
export const BUSCA_MAX = 80;

/**
 * O termo limpo, ou `null` quando não há busca.
 *
 * ACENTO É TIRADO DOS DOIS LADOS, e num produto brasileiro isso não é detalhe:
 * "Natália" tem de ser achada digitando "natalia", e "Vitória" digitando
 * "vitoria". Sem isso a busca funciona para quem já sabe escrever o nome
 * exatamente como a pessoa escreveu — ou seja, para quem não precisa buscar.
 *
 * `NFD` separa a letra do acento e a faixa `̀-ͯ` remove as marcas
 * combinantes; é a normalização que o resto deste produto não precisou até
 * aqui, e por isso ela nasce aqui e não num utilitário genérico.
 */
export function normalizarBusca(bruto: string | string[] | undefined): string | null {
  const texto = Array.isArray(bruto) ? bruto[0] : bruto;
  if (typeof texto !== "string") return null;
  const limpo = semAcento(texto).trim().slice(0, BUSCA_MAX);
  return limpo === "" ? null : limpo;
}

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Os campos pelos quais se procura alguém. Nulo em qualquer um é normal.
 *
 * `email` É O E-MAIL QUE VALE, JÁ RESOLVIDO — e não a coluna `contacts.email`.
 * Desde o Passo 1 da Parte 2, quem responde "qual é o e-mail desta pessoa" é
 * `emailDoContato` (lib/exportacao-de-contatos.ts), por dentro da regra de
 * lib/variables.ts: vale o valor COLETADO e, na falta dele, a coluna antiga.
 * Quem chama resolve ANTES — e quem chama é `peneirar`, num lugar só.
 *
 * A RESOLUÇÃO NÃO ENTROU AQUI DE PROPÓSITO, e o motivo é o cabeçalho deste
 * arquivo: ele é texto e aritmética, sem um import. Lendo o registro, ele
 * passaria a saber de `jsonb`, de catálogo e de variável para responder uma
 * pergunta que não é dele — e o e-mail teria uma SEGUNDA leitura, aqui dentro,
 * além da que o corte e o arquivo usam. A busca continua sendo "este texto casa
 * com estes três campos?", e é só isso que ela precisa saber.
 */
export type ContatoBuscavel = {
  username: string | null;
  name: string | null;
  email: string | null;
};

/**
 * Se o contato casa com o termo.
 *
 * OS TRÊS CAMPOS SÃO OS TRÊS JEITOS DE ALGUÉM SER LEMBRADO: o @ (que é como o
 * painel o mostra), o nome (que é como a pessoa se chama) e o e-mail (que é o
 * que a lista de e-mail usa). Procurar só pelo @ obrigaria a saber o @, que é
 * justamente o que não se sabe de cor.
 *
 * `includes` E NÃO "começa com": ninguém lembra do começo de um @ de empresa
 * ("alliancejiujitsusantos" se acha por "jiujitsu").
 */
export function casaComBusca(c: ContatoBuscavel, termo: string): boolean {
  const alvo = semAcento(termo);
  if (alvo === "") return true;
  return [c.username, c.name, c.email].some(
    (campo) => typeof campo === "string" && semAcento(campo).includes(alvo)
  );
}

/**
 * O recorte que a tabela mostra, com o que ficou de fora DECLARADO.
 *
 * O NÚMERO DE ESCONDIDAS É O PONTO. Um corte calado faz a tela dizer "estes são
 * os contatos" quando são os primeiros vinte e cinco — e foi exatamente esse o
 * defeito do `limit 200` que a consulta desta página removeu, com o motivo
 * escrito ao lado dela. Quem corta tem de contar.
 */
export function recorteDaTabela<T>(
  linhas: T[],
  limite: number = LIMITE_DA_TABELA
): { mostradas: T[]; escondidas: number } {
  // Limite não-positivo mostraria tabela vazia com "127 escondidas", que é uma
  // tela quebrada com aparência de informação.
  const teto = Math.max(1, Math.floor(limite));
  return {
    mostradas: linhas.slice(0, teto),
    escondidas: Math.max(0, linhas.length - teto),
  };
}

/**
 * QUANTAS LINHAS A TABELA MOSTRA, lido da barra de endereço.
 *
 * O DEFEITO QUE ISTO CONSERTA, achado por revisão em 11/09/2026: a tabela
 * cortava em 25 e o rodapé mandava *"use a busca acima, ou uma categoria, para
 * achar quem você procura"* — mas **não havia segunda página**. Quem buscava
 * "jiujitsu" e achava 40 pessoas via 25, e lia o conselho de usar a busca que
 * acabara de usar. **Os contatos 26 a 40 daquela busca deixaram de ser
 * alcançáveis pela tela.** Antes, com `limit 200` na consulta, todos estavam
 * na página.
 *
 * Encurtar a tela removendo o acesso ao conteúdo é exatamente o que o cabeçalho
 * deste arquivo diz estar evitando. O corte só é honesto com uma saída.
 *
 * É O MESMO DESENHO DE `quantosEventos` (lib/event-filters.ts): a página cresce
 * sob pedido, com teto, e o parâmetro vive FORA do estado do filtro — então
 * trocar de categoria ou de busca o descarta e a tabela volta ao começo, que é
 * o certo quando o recorte muda.
 */
export function quantasLinhas(bruto: string | string[] | undefined): number {
  const texto = Array.isArray(bruto) ? bruto[0] : bruto;
  const n = Number(texto);
  if (!Number.isFinite(n)) return LIMITE_DA_TABELA;
  return Math.min(MAX_DA_TABELA, Math.max(LIMITE_DA_TABELA, Math.floor(n)));
}

/** O teto: a barra de endereço é digitável, e `?linhas=99999` devolveria tudo. */
export const MAX_DA_TABELA = 500;
