import { windowState } from "./inbox-window";

// A CATEGORIA DO CONTATO, e as decisões dela fora do JSX.
//
// Este produto não tem tela para criar e renomear categorias, por decisão de
// desenho: a lista de categorias É o conjunto de valores distintos em uso —
// nasce quando alguém usa e some quando ninguém usa mais.
//
// ISSO SÓ SE SUSTENTA COM NORMALIZAÇÃO. Sem ela, `Aluno` e `aluno ` viram duas
// categorias, o filtro passa a mentir, e em três semanas ninguém confia mais na
// lista — que é exatamente o custo que a governança evitaria, pago de outro
// jeito. A função abaixo é o que compra a simplicidade da coluna única.

/** O tamanho máximo, para a coluna da tabela não virar um parágrafo. */
export const LIMITE_DA_CATEGORIA = 40;

/**
 * O nome canônico de uma categoria, ou `null` quando não há categoria.
 *
 * `null` e nunca `""`: texto vazio na coluna faria a ficha "sem categoria" ter
 * DUAS formas — o balde do nulo e o balde do vazio —, e as contagens da tela
 * deixariam de somar o total.
 *
 * Invisíveis também não sobram: marcadores de largura zero (zero-width
 * space, word joiner, soft hyphen — categoria Unicode Cf) que texto colado
 * do Instagram e de teclado de celular carrega nas pontas são tratados como
 * ruído, não como conteúdo — senão a ficha "sem categoria" ganharia uma
 * TERCEIRA forma, invisível, e duas categorias visualmente idênticas
 * virariam duas categorias diferentes.
 *
 * O ACENTO FICA. Isto é nome que gente lê ("não respondeu"), e não
 * identificador — tirar acento tornaria a categoria mais feia sem tornar nada
 * mais seguro.
 */
export function normalizarCategoria(bruto: unknown): string | null {
  if (typeof bruto !== "string") return null;
  // \s não cobre os invisíveis de largura zero (Cf); por isso saem num passo
  // à parte, ANTES de colapsar espaço — senão um Cf encaixado entre dois
  // espaços vira espaço duplo que sobra depois de removido.
  //
  // O QUE ISTO CUSTA, E POR QUE O CUSTO FOI ESCOLHIDO: `Cf` inclui o
  // `U+200D` (zero-width joiner), que é o que cola emojis em sequência. Uma
  // categoria escrita como "👨‍👩‍👧‍👦" vira "👨👩👧👦" — quatro figuras soltas.
  // Medido na revisão de 31/08/2026, e é sempre, não só na fronteira do corte.
  //
  // Poupar o `U+200D` REABRIRIA o defeito que este passo existe para fechar:
  // "al‍uno" voltaria a ser uma categoria diferente de "aluno", visualmente
  // idêntica a ela. Categoria invisível duplicada é a doença; emoji composto em
  // NOME DE CATEGORIA ("aluno", "interessado", "turma de setembro") é quase
  // impossível. A troca é deliberada, e fica escrita para não ser descoberta
  // como surpresa.
  const limpo = bruto
    .replace(/\p{Cf}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (!limpo) return null;
  // O CORTE É POR PONTO DE CÓDIGO, E NÃO POR GRAFEMA, e isso também é escolha:
  // uma bandeira (dois indicadores regionais), um tom de pele (base + modificador)
  // ou um acento combinante cortados exatamente no limite deixam a metade órfã —
  // código VÁLIDO, aparência estranha. Resolver exigiria `Intl.Segmenter`, e o
  // ganho seria cosmético numa fronteira de 40 caracteres que nome de categoria
  // não alcança. Medido na revisão de 31/08/2026.
  //
  // Cortar em pontos de código (Array.from), não em unidades UTF-16 (slice):
  // um caractere fora do plano básico (um emoji, por exemplo) ocupa duas
  // unidades UTF-16, e cortar no meio deixa um surrogate solto — que não é
  // espaço, então .trim() não o limpa, e vira "�" ao ser serializado.
  //
  // Aparar DEPOIS de cortar: o corte pode cair no meio de um espaço e deixar
  // a ponta suja.
  const cortado = Array.from(limpo).slice(0, LIMITE_DA_CATEGORIA).join("").trim();
  return cortado || null;
}

export type FichaDeCategoria = {
  /** `null` é a ficha "sem categoria" — um balde de verdade, não um buraco. */
  nome: string | null;
  total: number;
  alcancaveis: number;
};

/**
 * As fichas da lista de contatos: cada categoria, quantos tem, e quantos estão
 * ALCANÇÁVEIS agora.
 *
 * O ALCANCE VEM DE `windowState`, E ISSO NÃO É ESTILO. Essa é a mesma função que
 * `lib/queue-drain.ts` usa para RECUSAR um envio, e ela fecha a janela 5 minutos
 * antes das 24h (`WINDOW_MARGIN_MS`). Uma contagem escrita aqui como "menos de
 * 24 horas" seria QUASE sempre igual — medido em 31/08/2026, as duas davam 9 —
 * e erraria enquanto alguém estivesse naquela faixa de cinco minutos: cerca de
 * 7 vezes por dia, cinco minutos cada. A tela prometeria uma pessoa alcançável,
 * o envio a recusaria, e ao conferir já teria passado.
 *
 * `agora` é parâmetro para o teste poder fixar o relógio; em produção ninguém o
 * passa.
 */
export function resumoDasCategorias(
  contatos: { categoria: string | null; last_reply_at: Date | string | null }[],
  agora: number = Date.now()
): FichaDeCategoria[] {
  const baldes = new Map<string | null, FichaDeCategoria>();
  for (const c of contatos) {
    const nome = c.categoria ?? null;
    const ficha = baldes.get(nome) ?? { nome, total: 0, alcancaveis: 0 };
    ficha.total += 1;
    if (windowState(c.last_reply_at, agora).open) ficha.alcancaveis += 1;
    baldes.set(nome, ficha);
  }
  return [...baldes.values()].sort((a, b) => {
    // "Sem categoria" fica sempre no fim: ela não é uma categoria que alguém
    // escolheu, e disputar posição com as escolhidas a faria parecer uma.
    if (a.nome === null) return 1;
    if (b.nome === null) return -1;
    return b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR");
  });
}

export type CasoDaListaDeEmail = "filtro_vazio" | "sem_email_geral" | "sem_email_no_filtro" | "tem_email";

/**
 * Qual texto a seção "Com e-mail" mostra — e se "Sem e-mail" ainda faz
 * sentido na tela —, agora que as duas tabelas nascem de `visiveis` (o
 * filtrado por categoria) em vez de `rows` (a conta inteira).
 *
 * A MUDANÇA DE FONTE TROCOU O SIGNIFICADO DA FRASE, sem que a frase mudasse
 * uma vírgula. "Ninguém informou o e-mail ainda" era verdade sobre a CONTA
 * quando `rows` alimentava a tela; virou uma alegação sobre o FILTRO. Cenário
 * que prende o defeito: o dono filtra por "aluno" — ninguém em "aluno" deu
 * e-mail, mas 40 pessoas em "interessado" deram. A frase antiga diz
 * "ninguém" e manda ligar uma automação que já está ligada — por isso
 * `sem_email_no_filtro` larga o "ligue": com filtro ativo esta função não
 * sabe se a automação está ligada ou não, só sabe que ESTA categoria não
 * tem e-mail ainda.
 *
 * O CASO PIOR é filtro sem ninguém (`visiveis === 0`): uma categoria que
 * deixou de existir, por exemplo. Sem tratar isto antes de olhar `comEmail`,
 * zero-de-zero passaria pela checagem de "sem e-mail" como se fosse o caso
 * comum, a seção "Sem e-mail" sumiria inteira (só renderiza com gente), e a
 * tela nunca diria que o filtro não achou NINGUÉM — só a frase de "Com
 * e-mail", verdadeira por acidente e enganosa por omissão. Por isso
 * `filtro_vazio` é a PRIMEIRA checagem, não a última.
 */
export function casoDaListaDeEmail(args: {
  /** `visiveis.length` — contagem já filtrada por categoria. */
  visiveis: number;
  /** `comEmail.length` — subconjunto de `visiveis` que tem e-mail. */
  comEmail: number;
  /** Se há filtro de categoria ativo (`searchParams.categoria !== undefined`). */
  filtrado: boolean;
}): CasoDaListaDeEmail {
  if (args.visiveis === 0) return "filtro_vazio";
  if (args.comEmail > 0) return "tem_email";
  return args.filtrado ? "sem_email_no_filtro" : "sem_email_geral";
}
