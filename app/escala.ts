// A ESCALA DO SISTEMA — tamanhos de texto e raios de borda — e o verificador
// que a mantém fechada.
//
// POR QUE ESTE ARQUIVO EXISTE, e não só um comentário em `app/ui.ts`: a
// auditoria de 10/09 mediu **26 combinações de tipografia em 13 tamanhos** e
// **sete raios de borda**. Nenhum deles nasceu de uma decisão; nasceram de
// dezenas de decisões caso a caso, tomadas no JSX, em meses diferentes. Comentário não impede a 27ª. Uma lista
// com verificador impede, e é ele que `tests/escala.test.ts` roda sobre a
// árvore inteira.
//
// ESTE MÓDULO NÃO TEM NENHUM IMPORT, de propósito: ele é lido por um teste que
// varre arquivos, e um módulo puro nunca arrasta `server-only` nem React para
// dentro do que deveria ser uma lista.

/* ---------- tipografia ---------- */

/**
 * OS OITO TAMANHOS, em px. Eram treze — 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
 * 20, 24, 30 —, e cinco saíram por dois motivos distintos:
 *
 * PARES QUE O OLHO NÃO DISTINGUE, e que faziam toda manutenção escolher entre
 * dois valores iguais:
 *   13 -> 14  (o menu lateral, o alternador de tema, as abas de filtro)
 *   15 -> 16  (o nome da automação na lista)
 *   17 -> 16  (a marca no topo da barra)
 *   22 -> 20  (o título de página no celular; a partir de 640px já era 24)
 *
 * O PISO, que é o outro problema e não o mesmo:
 *   9 -> 11   (7 ocorrências na tela: rótulos do gráfico, contadores)
 *   10 -> 11  (276 ocorrências: todo selo, todo rótulo de seção, todo crédito)
 *
 * POR QUE O PISO É 11 E NÃO 12, e isto foi decidido contando: 12px é o cavalo
 * de trabalho da interface (627 ocorrências) e 11px é o degrau de MICRO-RÓTULO
 * — caixa alta, `tracking` aberto, selo. Subir o piso para 12 não subiria o
 * piso: apagaria o degrau, e todo selo passaria a ter o tamanho do corpo do
 * texto. 11px já era o menor tamanho que o sistema usava com intenção
 * (`eyebrow`, `thead`); o que 9 e 10 faziam era ficar abaixo dele sem motivo.
 */
export const TAMANHOS_PX = [11, 12, 14, 16, 18, 20, 24, 30] as const;

/** O nome que o Tailwind dá a cada degrau. `text-[11px]` é arbitrário porque a
 *  escala do Tailwind não tem 11px — mas arbitrário DECLARADO é escala; o que
 *  a auditoria achou eram treze arbitrários não declarados. */
export const CLASSE_POR_TAMANHO: Record<number, string> = {
  11: "text-[11px]",
  12: "text-xs",
  14: "text-sm",
  16: "text-base",
  18: "text-lg",
  20: "text-xl",
  24: "text-2xl",
  30: "text-3xl",
};

/* ---------- raios ---------- */

/**
 * O RITMO 8 / 12 / 16, mais `rounded-full`. A auditoria mediu sete raios na
 * tela e apontou três fora dele: **9px** (8 ocorrências), **10px** (3) e
 * `4px 4px 0px 0px` (14).
 *
 * DE ONDE VINHAM O 9 E O 10, porque não eram descuido: os dois são grupos de
 * abas — `/automacoes` e os dois filtros de `/eventos` — em que a caixa
 * externa tem 12px e `p-0.5`, e o miolo "deveria" ter 10px para o RAIO ficar
 * CONCÊNTRICO. A conta está certa, e mesmo assim os dois saíram: um ritmo de
 * três valores que ganha um quarto e um quinto para resolver dois casos deixa
 * de ser ritmo. A diferença entre 8px e 10px num botão de 28px de altura
 * ninguém vê; a diferença entre três raios e cinco, quem mantém vê toda vez.
 *
 * `4px 4px 0px 0px` é o `rounded-t` das barras do gráfico do painel. `rounded`
 * sem sufixo é o apelido herdado do Tailwind 3 e vale 4px — meio degrau abaixo
 * do menor do ritmo, e não um degrau. Virou `rounded-t-lg`: raio parcial de um
 * degrau da escala, que é a forma certa de arredondar só um lado.
 */
export const RAIOS_PX = [8, 12, 16] as const;

export const CLASSE_POR_RAIO: Record<number, string> = {
  8: "rounded-lg",
  12: "rounded-xl",
  16: "rounded-2xl",
};

// `rounded-full` é correto e a auditoria disse isso com todas as letras: um
// círculo não é um degrau da escala, é a ausência de canto.
const RAIOS_ACEITOS = new Set(["rounded-lg", "rounded-xl", "rounded-2xl", "rounded-full"]);

/* ---------- espaçamento ---------- */

/**
 * OS DEGRAUS DE ESPAÇAMENTO, em px — o achado M3, que mudou de forma quando foi
 * medido.
 *
 * A AUDITORIA ESCREVEU "dez espaçamentos distintos, passo de 2px, mais fino do
 * que qualquer ritmo perceptível". Contados na árvore em 11/09/2026 eram 703
 * ocorrências em DEZOITO valores não-nulos — e a conclusão é outra, porque dois
 * deles não são escolha:
 *
 * `pl-9` (36px) É DERIVADO E NÃO ARBITRÁRIO: é o recuo do campo que tem ícone à
 * esquerda, e sai da posição do ícone — `left-3` (12px) + 16px de ícone + 8 de
 * folga. Encostá-lo em 32px poria o texto em cima do ícone; em 40 abriria um
 * buraco. O número obedece ao ícone, não a um ritmo, e por isso 36 fica.
 *
 * `px-3.5` (14px) É PADDING HORIZONTAL DE CAMPO, e ritmo vertical não passa por
 * ali. É a medida do token `input`; mudá-la mudaria a espessura de todo campo do
 * produto para resolver um problema que aquele eixo não tem.
 *
 * O QUE SAIU foram três, todos de UMA ocorrência, todos em layout folgado:
 *   80 -> 64   (`mt-20`, o topo da tela de entrar)
 *   56 -> 64   (`py-14`, o cartão do estado calmo do Início)
 *   28 -> 32   (`mt-7`, a fileira de links desse mesmo cartão)
 *
 * E UM QUARTO NEM EXISTIA: a primeira contagem acusou `mt-24` em `/eventos`, e
 * era `scroll-mt-24` — deslocamento de âncora, que não é espaço entre nada. A
 * borda `(?<![\w-])` da varredura existe por causa dele.
 *
 * O QUE ESTA LISTA NÃO FAZ, e é escolha declarada: ela não normaliza 6, 10 e 14
 * para uma escala de dobra. São 110 ocorrências, várias em layouts MEDIDOS à
 * mão — a coluna de conversas tem 224px úteis, e o comentário dela conta pixel
 * a pixel onde cada um foi parar. Trocar `gap-1.5` por `gap-2` ali desfaz uma
 * medição para ganhar simetria num arquivo que ninguém lê.
 *
 * O QUE ELA FAZ É O QUE AS OUTRAS DUAS JÁ FAZEM: fechar a lista. A queixa era
 * "decisão caso a caso", e caso a caso é justamente o que um portão impede
 * daqui para frente.
 */
export const ESPACAMENTOS_PX = [2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 32, 36, 40, 48, 64] as const;

/** O degrau do Tailwind de cada um: 4px é `-1`, 6px é `-1.5`. Aqui o valor não
 *  é a classe inteira, como nas outras duas escalas, porque a mesma medida se
 *  escreve de vinte jeitos (`gap-`, `mt-`, `px-`…). O que a escala fixa é o
 *  NÚMERO; a família é assunto do layout. */
export const DEGRAU_POR_ESPACAMENTO: Record<number, string> = {
  2: "0.5",
  4: "1",
  6: "1.5",
  8: "2",
  10: "2.5",
  12: "3",
  14: "3.5",
  16: "4",
  20: "5",
  24: "6",
  32: "8",
  36: "9",
  40: "10",
  48: "12",
  64: "16",
};

/* ---------- o verificador ---------- */

/**
 * Um desvio encontrado numa string de classes.
 * `familia` diz qual das escalas foi furada; `classe` é o que estava lá.
 */
export type Desvio = { familia: "tamanho" | "raio" | "espacamento"; classe: string };

// `text-[13px]`, `sm:text-[22px]`, `text-[9px]`
const TAMANHO_ARBITRARIO = /(?:^|[\s"'`{])(?:[a-z]+:)*text-\[(\d+)px\]/g;

// Todo `rounded`: pelado, com lado (`rounded-t`, `rounded-bl`), com degrau
// (`rounded-lg`), com os dois (`rounded-t-lg`) e arbitrário (`rounded-[10px]`).
//
// O `(?![-\w])` do fim NÃO É ENFEITE, e custou o primeiro verde falso desta
// varredura: sem ele, `rounded-lg` casa como `rounded-l` (o lado "left") e o
// verificador acusa o próprio `btnGhost`. A âncora obriga a alternativa a
// terminar onde a classe termina, e aí o motor volta atrás e lê `-lg` como
// degrau, que é o que ele é.
const RAIO =
  /(?:^|[\s"'`{])(?:[a-z]+:)*(rounded(?:-(?:tl|tr|bl|br|ss|se|es|ee|t|b|l|r|s|e))?(?:-(?:xs|sm|md|lg|xl|2xl|3xl|4xl|none|full|\[[^\]]+\]))?)(?![-\w])/g;

// AS VINTE FAMÍLIAS QUE CARREGAM ESPAÇAMENTO. `space-x`/`space-y` entram porque
// são a mesma medida com outro nome, e a margem negativa entra com o `-?` —
// `-ml-1` é o mesmo degrau lido ao contrário, e não um valor novo.
//
// A BORDA DA ESQUERDA É `(?<![\w-])`, E NÃO ``, e ela custou o segundo verde
// falso desta varredura: com ``, `scroll-mt-24` casa como `mt-24` e a escala
// "ganha" um degrau de 96px que nenhum layout tem. `scroll-mt` é deslocamento
// de âncora; espaço entre coisas não é. A borda da direita recusa o ponto para
// `px-2.5` não ser lido como `px-2` seguido de sujeira.
const ESPACAMENTO =
  /(?<![\w-])-?(?:[a-z]+:)*(?:gap-x|gap-y|gap|space-x|space-y|px|py|pt|pb|pl|pr|p|mx|my|mt|mb|ml|mr|m)-(\d+(?:\.5)?)(?![\w.])/g;

/**
 * Os desvios de escala de uma string de classes do Tailwind. Função pura, sem
 * estado: a mesma string devolve sempre a mesma lista.
 *
 * O QUE ELA ACEITA de tamanho: os apelidos do Tailwind (`text-xs`, `text-sm`,
 * …), que são degraus por definição, e os arbitrários `text-[Npx]` cujo N está
 * em `TAMANHOS_PX`. O que ela acusa é o arbitrário fora da lista — que é
 * exatamente a forma que os cinco tamanhos mortos tinham.
 *
 * O QUE ELA ACEITA de raio: os três degraus e `rounded-full`. Qualquer outra
 * forma de `rounded` é desvio, incluindo o `rounded` pelado (4px, apelido do
 * Tailwind 3) e o parcial sem degrau (`rounded-t`), porque foi por essa porta
 * que o `4px 4px 0px 0px` do gráfico entrou. Um raio parcial de um degrau da
 * escala se escreve `rounded-t-lg`, e passa.
 */
export function desviosDeEscala(classes: string): Desvio[] {
  const achados: Desvio[] = [];
  const permitidos = new Set<number>(TAMANHOS_PX);

  for (const m of classes.matchAll(TAMANHO_ARBITRARIO)) {
    if (!permitidos.has(Number(m[1]))) {
      achados.push({ familia: "tamanho", classe: m[0].trim() });
    }
  }

  for (const m of classes.matchAll(RAIO)) {
    // `rounded-t-lg` -> o degrau é o sufixo, e o lado não muda o degrau.
    // `rounded-t` -> não tem degrau nenhum, e é o `4px 4px 0px 0px` do gráfico.
    //
    // `degrau` é `null` quando não há degrau, e NÃO a string do apelido pelado:
    // esta varredura lê o texto dos arquivos, e um literal com a cara de uma
    // classe dentro do próprio verificador seria um desvio a mais para ele
    // encontrar — em si mesmo.
    const comLado = m[1].match(/^rounded-(?:tl|tr|bl|br|ss|se|es|ee|t|b|l|r|s|e)(?:-(.+))?$/);
    const degrau = comLado ? (comLado[1] ? `rounded-${comLado[1]}` : null) : m[1];
    if (degrau === null || !RAIOS_ACEITOS.has(degrau)) {
      achados.push({ familia: "raio", classe: m[0].trim() });
    }
  }

  // `0` NÃO É DEGRAU, é a AUSÊNCIA de espaço: `gap-0` e `mt-0` são a forma de
  // DESFAZER um espaçamento herdado, e cobrá-los da régua seria pedir que
  // "nada" fosse um dos degraus.
  const degraus = new Set<string>(Object.values(DEGRAU_POR_ESPACAMENTO));
  for (const m of classes.matchAll(ESPACAMENTO)) {
    if (m[1] !== "0" && !degraus.has(m[1])) {
      achados.push({ familia: "espacamento", classe: m[0].trim() });
    }
  }

  return achados;
}
