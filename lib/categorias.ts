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
