// O CALENDÁRIO DE PUBLICAÇÕES — a grade, o fuso e a navegação, como aritmética.
//
// POR QUE ELE EXISTE: a tela de agendados era uma lista vertical, e a pergunta
// que ela precisa responder é de CALENDÁRIO — "em que dias o perfil vai falar, e
// onde estão os buracos". Lista não mostra buraco; só mostra o que existe.
//
// O FUSO É COMPORTAMENTO, E NÃO EXIBIÇÃO, e é a decisão central deste arquivo.
// `not_before` é um instante em UTC, e a Vercel roda em UTC: um post marcado
// para 11/09 às 21:00 de Brasília é 12/09 às 00:00 em UTC. Agrupado pelo dia de
// UTC ele cairia na célula do dia SEGUINTE — a tela mostraria o post no dia
// errado, e ninguém desconfiaria, porque o horário ao lado estaria certo.
//
// É o mesmo motivo pelo qual `lib/lote.ts` e `lib/dedupe.ts` já carregam este
// fuso: aqui ele decide em que quadrado a coisa aparece.
//
// NENHUM IMPORT. É data e aritmética.

/** Brasília, o mesmo de `FUSO_DO_PRAZO` (lib/lote.ts) e `diaDaChave`. */
export const FUSO = "America/Sao_Paulo";

/** Quantos posts cabem num quadrado do mês antes de virar "+N". */
export const MAX_POR_DIA_NO_MES = 3;

/** O mês tem seis semanas de grade: 31 dias começando no sábado precisam de 6. */
const SEMANAS_NO_MES = 6;

const DIAS_DA_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
] as const;

/**
 * O dia a que um instante pertence, no fuso de Brasília — "YYYY-MM-DD".
 *
 * `en-CA` é o locale que formata nesse formato; é a mesma escolha de
 * `hojeNoFusoDoPrazo` (lib/lote.ts) e de `diaDaChave` (lib/dedupe.ts), e vale a
 * pena serem três: cada uma responde a uma pergunta diferente, e juntá-las num
 * utilitário genérico faria mudar o fuso de uma mudar o das outras.
 */
export function chaveDoDia(instante: Date | string | number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(instante));
}

/** A hora do dia no fuso de Brasília — "09:59". */
export function horaDoDia(instante: Date | string | number): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(instante));
}

/**
 * A chave de um dia, somando `passo` dias — e ela NÃO usa `Date`.
 *
 * SOMAR DIAS COM `setDate` É ONDE CALENDÁRIO COSTUMA QUEBRAR: o objeto `Date`
 * vive num fuso, e somar 24 horas atravessa horário de verão errado. O Brasil
 * não tem horário de verão desde 2019, mas escrever a conta certa custa o mesmo
 * e não depende de uma lei continuar como está.
 *
 * Aqui a chave é tratada como o que ela é — três números —, convertida para
 * UTC ao meio-dia (longe de qualquer borda de fuso), somada, e formatada de
 * volta em UTC. Nenhuma etapa passa pelo fuso local da máquina.
 */
export function diaSomado(chave: string, passo: number): string {
  const [a, m, d] = chave.split("-").map(Number);
  const t = Date.UTC(a, m - 1, d, 12) + passo * 86_400_000;
  const x = new Date(t);
  return [
    x.getUTCFullYear(),
    String(x.getUTCMonth() + 1).padStart(2, "0"),
    String(x.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

/** Em que dia da semana cai a chave: 0 = domingo. */
export function diaDaSemana(chave: string): number {
  const [a, m, d] = chave.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d, 12)).getUTCDay();
}

export type Casa = {
  /** "2026-09-11" */
  chave: string;
  /** o número do dia, para desenhar */
  dia: number;
  /** `false` nas casas que vieram do mês vizinho para fechar a grade */
  doMes: boolean;
  hoje: boolean;
};

export type Grade = {
  visao: "mes" | "semana";
  /** "setembro 2026" no mês; "7 – 13 de setembro" na semana */
  titulo: string;
  /** os rótulos das sete colunas */
  colunas: readonly string[];
  casas: Casa[];
  /** para os botões de navegação */
  anterior: string;
  seguinte: string;
  /** a âncora desta grade, para o botão "hoje" saber se já estamos nele */
  ancora: string;
};

/**
 * A GRADE DO MÊS — sempre 6×7, e sempre começando no domingo.
 *
 * SEIS SEMANAS SEMPRE, E NÃO "as que precisar": uma grade que muda de altura
 * conforme o mês faz a página pular ao navegar, e o olho perde a referência de
 * onde estava. O custo é uma linha a mais em alguns meses; o ganho é a tela não
 * se mexer embaixo de quem está lendo.
 *
 * AS CASAS DO MÊS VIZINHO ENTRAM, marcadas com `doMes: false`. Escondê-las
 * deixaria buracos no canto da grade, e um buraco lê como "não há dia" em vez
 * de "é outro mês".
 */
export function gradeDoMes(chaveDoMes: string, hoje: string): Grade {
  const [ano, mes] = chaveDoMes.split("-").map(Number);
  const primeiro = `${ano}-${String(mes).padStart(2, "0")}-01`;
  // Recua até o domingo da semana do dia 1.
  const inicio = diaSomado(primeiro, -diaDaSemana(primeiro));

  const casas: Casa[] = [];
  for (let i = 0; i < SEMANAS_NO_MES * 7; i++) {
    const chave = diaSomado(inicio, i);
    casas.push({
      chave,
      dia: Number(chave.slice(8)),
      doMes: chave.slice(0, 7) === chaveDoMes,
      hoje: chave === hoje,
    });
  }

  return {
    visao: "mes",
    titulo: `${MESES[mes - 1]} ${ano}`,
    colunas: DIAS_DA_SEMANA,
    casas,
    anterior: mesVizinho(chaveDoMes, -1),
    seguinte: mesVizinho(chaveDoMes, 1),
    ancora: chaveDoMes,
  };
}

/** A GRADE DA SEMANA — sete casas, do domingo ao sábado que contêm a chave. */
export function gradeDaSemana(chaveDoDia: string, hoje: string): Grade {
  const domingo = diaSomado(chaveDoDia, -diaDaSemana(chaveDoDia));
  const casas: Casa[] = [];
  for (let i = 0; i < 7; i++) {
    const chave = diaSomado(domingo, i);
    casas.push({
      chave,
      dia: Number(chave.slice(8)),
      // Na semana TODA casa é "do mês": não há casa de enchimento, e marcá-las
      // como de fora apagaria a semana que atravessa a virada do mês.
      doMes: true,
      hoje: chave === hoje,
    });
  }
  const fim = casas[6].chave;
  const mesInicio = Number(domingo.slice(5, 7));
  const mesFim = Number(fim.slice(5, 7));
  // A SEMANA QUE ATRAVESSA A VIRADA DO MÊS diz os dois meses: "30 de agosto – 5
  // de setembro". Dizer só um deles seria mentir sobre metade da linha.
  const titulo =
    mesInicio === mesFim
      ? `${Number(domingo.slice(8))} – ${Number(fim.slice(8))} de ${MESES[mesInicio - 1]}`
      : `${Number(domingo.slice(8))} de ${MESES[mesInicio - 1]} – ${Number(fim.slice(8))} de ${MESES[mesFim - 1]}`;

  return {
    visao: "semana",
    titulo,
    colunas: DIAS_DA_SEMANA,
    casas,
    anterior: diaSomado(domingo, -7),
    seguinte: diaSomado(domingo, 7),
    ancora: domingo,
  };
}

/** O mês vizinho — "2026-01" menos um é "2025-12", e a conta não usa `Date`. */
export function mesVizinho(chaveDoMes: string, passo: number): string {
  const [ano, mes] = chaveDoMes.split("-").map(Number);
  const total = ano * 12 + (mes - 1) + passo;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/**
 * A visão pedida pela URL. Qualquer coisa que não seja "semana" é o mês.
 *
 * O PADRÃO É O MÊS, e foi escolha do dono: a equipe agenda alguns posts por
 * mês, e é no mês inteiro que se vê onde estão os buracos.
 */
export function visaoDaUrl(bruto: string | string[] | undefined): "mes" | "semana" {
  const v = Array.isArray(bruto) ? bruto[0] : bruto;
  return v === "semana" ? "semana" : "mes";
}

/**
 * A âncora pedida pela URL, ou hoje.
 *
 * A URL É DIGITÁVEL, então o formato é conferido antes de virar conta. Um
 * `?em=banana` não pode produzir `NaN-NaN` e uma grade de casas vazias: ele cai
 * em hoje, que é o que a pessoa veria se não tivesse digitado nada.
 */
export function ancoraDaUrl(
  bruto: string | string[] | undefined,
  visao: "mes" | "semana",
  hoje: string
): string {
  const v = Array.isArray(bruto) ? bruto[0] : bruto;
  if (typeof v !== "string") return visao === "mes" ? hoje.slice(0, 7) : hoje;
  if (visao === "mes") {
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(v) ? v : hoje.slice(0, 7);
  }
  return /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(v) ? v : hoje;
}

/**
 * Os itens de cada dia, agrupados pela chave do FUSO.
 *
 * `extrairData` existe porque a data de um item de publicação não é uma coluna
 * só: `dataDaLinhaDeEnvio` (lib/publicacao.ts) já decide qual coluna vale para
 * cada status, e reimplementar essa escolha aqui seria a segunda fonte para a
 * mesma pergunta.
 */
export function agruparPorDia<T>(
  itens: T[],
  extrairData: (item: T) => Date | string | number
): Map<string, T[]> {
  const mapa = new Map<string, T[]>();
  for (const item of itens) {
    const chave = chaveDoDia(extrairData(item));
    const lista = mapa.get(chave);
    if (lista) lista.push(item);
    else mapa.set(chave, [item]);
  }
  return mapa;
}

/**
 * O que cabe num quadrado, e quantos ficaram de fora.
 *
 * MESMA DISCIPLINA DA TABELA DE CONTATOS: quem corta tem de contar. Um quadrado
 * que mostra três de cinco e cala faz a tela dizer que o dia tem três posts.
 */
export function recorteDoDia<T>(
  itens: T[],
  limite: number = MAX_POR_DIA_NO_MES
): { mostrados: T[]; escondidos: number } {
  const teto = Math.max(1, Math.floor(limite));
  return {
    mostrados: itens.slice(0, teto),
    escondidos: Math.max(0, itens.length - teto),
  };
}
