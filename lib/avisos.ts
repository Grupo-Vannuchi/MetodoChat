import { urlComFiltro, type FiltroDeCategoria } from "./categorias";

// AS FRASES E AS DECISOES DE AVISO, fora do JSX.
//
// Uma acao de servidor que recusa ou conclui em silencio e indistinguivel de
// sucesso: a tela recarrega igual. Este arquivo e a fonte unica do TEXTO e do
// TOM de cada aviso, e da URL que os carrega pelo redirect ate a tela. As
// telas (Tarefas 2 e 3) so leem o que sai daqui — nenhuma decisao mora no JSX,
// porque a suite nao testa componente.

export type TomDoAviso = "ok" | "erro";
export type Aviso = { tom: TomDoAviso; texto: string };

/**
 * Por que o lote saiu vazio — as cinco saidas mudas de `enviarLote` viram
 * quatro motivos aqui (a de sucesso nao e recusa, e sai por outra funcao).
 *
 * "sem_conta" e "sem_texto" e "url_invalida" nao moram nesta funcao: elas sao
 * decididas antes de chegar em `alvoDoLote`, direto no corpo da acao (Tarefa
 * 2), porque so ali se sabe se ha conta, se ha texto e se a URL do botao e
 * valida. Esta funcao resolve o caso que `alvoDoLote` deixa ambiguo: alvo
 * vazio pode ser "ninguem confirmou" ou "ninguem no filtro", e as duas
 * checagens (`confirmado`, `filtroEntendido`) sao o que ela ja distingue
 * internamente — o aviso so precisa repetir a distincao para quem chamou.
 */
export type RecusaDoLote =
  | "sem_conta" | "sem_texto" | "url_invalida"
  | "sem_confirmacao" | "ninguem_no_filtro";

/**
 * O motivo do lote vazio, quando `alvo.length === 0`.
 *
 * A ORDEM DOS DOIS PRIMEIROS RAMOS IMPORTA, e nao e estetica: sem confirmacao
 * E sem ninguem no filtro podem ser verdade ao mesmo tempo (o dono nao marcou
 * a caixa E filtrou por uma categoria vazia), e so uma frase pode aparecer.
 * "Marque a confirmacao" e a frase que diz o que FAZER; "ninguem nesta
 * categoria" descreve um filtro que, sem a confirmacao, nem chegou a ser
 * avaliado de verdade — por isso sem_confirmacao vem primeiro.
 *
 * `filtroEntendido` e `quantosNaConta` entram na assinatura porque sao os
 * dois fatos que `alvoDoLote` (lib/lote.ts) ja tem no momento de decidir, e
 * que o motivo unico "ninguem_no_filtro" hoje nao separa: filtro que bateu em
 * zero pessoas e filtro que nao foi entendido (`filtroDoCampo` devolveu
 * `null`) recebem a MESMA frase de proposito — as duas dizem "nada foi
 * enfileirado", e nenhuma delas e culpa de quem clicou. Um motivo a mais so
 * se justificaria se a frase precisasse mudar; ela nao precisa, entao os dois
 * parametros ficam aqui documentados, prontos para o dia em que precisar.
 */
export function motivoDoLoteVazio(
  confirmado: boolean,
  filtroEntendido: boolean,
  quantosNaConta: number
): RecusaDoLote {
  if (!confirmado) return "sem_confirmacao";
  return "ninguem_no_filtro";
}

/** A frase de cada recusa — spec §3, nomeando o que fazer, nunca "falhou". */
export function textoDaRecusaDoLote(motivo: RecusaDoLote): string {
  switch (motivo) {
    case "sem_conta":
      return "Conecte uma conta do Instagram primeiro.";
    case "sem_texto":
      return "Escreva a mensagem antes de mandar.";
    case "url_invalida":
      return "O endereço do botão não é uma URL válida — confira e mande de novo.";
    case "ninguem_no_filtro":
      return "Ninguém nesta categoria; nada foi enfileirado.";
    case "sem_confirmacao":
      return "Marque a confirmação antes de mandar.";
  }
}

/**
 * O aviso de sucesso do lote: quantos receberam AGORA e quantos ficaram
 * GUARDADOS para quando a janela abrir de novo.
 *
 * `agora` e `guardadas` vem de uma consulta pelos itens do PROPRIO lote — a
 * Tarefa 2 e quem garante isso, contando pelo identificador que `enqueueLote`
 * gera. Esta funcao so formata o que ja foi contado direito; ela nao pode
 * consertar uma contagem errada.
 */
export function textoDoLoteEnviado(agora: number, guardadas: number): string {
  const partes: string[] = [];
  // "0 pessoas" e "0 receberam" nao aparecem: quando ninguem recebeu agora, a
  // frase nao afirma um recebimento que nao aconteceu.
  if (agora > 0) {
    partes.push(`${agora} ${agora === 1 ? "pessoa recebeu" : "pessoas receberam"} agora`);
  } else {
    partes.push("ninguém recebeu agora");
  }
  partes.push(
    `${guardadas} ${guardadas === 1 ? "guardada" : "guardadas"} para quando voltarem a falar`
  );
  return partes.join(" · ");
}

/**
 * A URL de volta, com o aviso pendurado nela.
 *
 * TEM de ser construida sobre `urlComFiltro` (`lib/categorias.ts`), nunca
 * remontando `?categoria=` por conta propria: a distincao entre `?categoria=`
 * AUSENTE ("tudo") e PRESENTE-E-VAZIO ("sem categoria") foi o Critico de
 * 01/09, e recair nele por uma porta nova — concatenando string a mao aqui —
 * e exatamente o que este desenho existe para impedir.
 *
 * A escolha entre "?" e "&" nao e um `if (filtro.tipo === "tudo")` duplicado:
 * ela olha se `urlComFiltro` ja devolveu um "?" (filtro "uma" sempre devolve;
 * filtro "tudo" nunca devolve). Duplicar a checagem do tipo seria confiar
 * duas vezes na mesma decisao por caminhos diferentes — e um dia divergirem.
 */
export function urlComAviso(base: string, filtro: FiltroDeCategoria, aviso: string): string {
  const comFiltro = urlComFiltro(base, filtro);
  const separador = comFiltro.includes("?") ? "&" : "?";
  return `${comFiltro}${separador}aviso=${encodeURIComponent(aviso)}`;
}

/**
 * O aviso vindo dos `searchParams` do redirect, ja tipado.
 *
 * `bruto` e `tomBruto` sao texto de URL — DIGITAVEL por qualquer um — e por
 * isso um tom desconhecido cai em "erro" em vez de virar classe de CSS
 * montada com o que veio de fora. `null` (nao "ok" por omissao) e o caso de
 * nenhum aviso: a tela so mostra a faixa quando ha aviso de fato.
 */
export function avisoDaUrl(bruto: string | undefined, tomBruto: string | undefined): Aviso | null {
  if (bruto === undefined) return null;
  const tom: TomDoAviso = tomBruto === "ok" ? "ok" : "erro";
  return { tom, texto: bruto };
}
