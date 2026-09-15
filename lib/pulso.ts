import { fmtRelative } from "./format";

// O PULSO — a prova de que o relógio anda.
//
// POR QUE ELE EXISTE, e o defeito que ele fecha: entre 08/09 e 14/09/2026 o
// motor passou SEIS DIAS sem disparar nada, enquanto ~40 comentários chegavam
// por dia. O painel, no mesmo período, anunciava "Automações ativas: 21" e "Na
// fila: 0" — dois números verdadeiros que, lidos juntos, pareciam saúde.
//
// A DIFERENÇA ESTÁ NO TIPO DO NÚMERO. "21 ativas" é contagem parada: continuaria
// 21 com tudo quebrado. "última entrega há 3 dias" é FATO COM CARIMBO DE HORA, e
// denuncia sozinha, sem ninguém precisar comparar com nada.
//
// ELE APARECE SEMPRE, inclusive quando está tudo bem. Silêncio não responde
// "está rodando?", porque silêncio é também o que aparece quando a medição
// quebrou — a linha positiva é o que distingue as duas coisas.
//
// MÓDULO PURO: nenhum import de servidor. Quem busca os números é a página.

/** "nada entregue hoje · última há 3 dias · fila vazia" */
export function fraseDoPulso(p: {
  entreguesHoje: number;
  ultimaEntrega: Date | string | null;
  naFila: number;
}): string {
  const hoje =
    p.entreguesHoje === 0
      ? "nada entregue hoje"
      : `${p.entreguesHoje} ${p.entreguesHoje === 1 ? "entregue" : "entregues"} hoje`;

  // CONTA NOVA NÃO TEM "ÚLTIMA": dizer "última há —" seria inventar um passado
  // que não houve, e `fmtRelative` devolve "—" para nulo.
  const ultima = p.ultimaEntrega ? `última ${fmtRelative(p.ultimaEntrega)}` : "nenhuma entrega ainda";

  const fila = p.naFila === 0 ? "fila vazia" : `${p.naFila} na fila`;

  return `${hoje} · ${ultima} · ${fila}`;
}

/**
 * "22 comentários · 13 mensagens · 3 respostas enviadas"
 *
 * ESTA FRASE E A DO PULSO FALAM DE COISAS DIFERENTES, e a spec escreve isso para
 * ninguém "consertar" a duplicação: o pulso conta só o que o MOTOR entregou
 * SOZINHO (a fila, menos os kinds manuais — `dm_manual` — e menos `publicacao`);
 * esta conta o MOVIMENTO DA CONTA inteiro, incluindo o que foi feito à mão.
 *
 * A RESPOSTA DIGITADA NA TELA NÃO "ESTÁ SÓ NOS EVENTOS" — ela passa pela MESMA
 * fila que o motor usa (`enqueueManualReply`, lib/engine.ts), com
 * `kind: 'dm_manual'`. O que separa as duas frases não é DE ONDE o dado vem,
 * é O QUE cada uma escolhe contar dali: o pulso filtra o manual para fora
 * porque quer responder "a máquina está viva?", e um envio manual não prova
 * isso; as 24h não filtram nada, porque querem responder "o que aconteceu com
 * a conta?", e uma resposta manual também é o que aconteceu. Em 14/09 a fila
 * do motor entregou zero e houve três respostas manuais — os dois números
 * divergem de propósito, e juntos dizem a verdade: ninguém foi respondido pela
 * automação, e três pessoas foram respondidas à mão.
 */
export function fraseDas24h(p: {
  comentarios: number;
  mensagens: number;
  enviadas: number;
}): string {
  // DIA PARADO É UMA FRASE, E NÃO TRÊS ZEROS. Três zeros em fila fazem o olho
  // procurar o que deu errado; a frase diz que nada deu errado, não aconteceu
  // nada mesmo.
  if (p.comentarios === 0 && p.mensagens === 0 && p.enviadas === 0) {
    return "nada aconteceu nas últimas 24h";
  }
  const c =
    p.comentarios === 0
      ? "nenhum comentário"
      : `${p.comentarios} ${p.comentarios === 1 ? "comentário" : "comentários"}`;
  const m =
    p.mensagens === 0
      ? "nenhuma mensagem"
      : `${p.mensagens} ${p.mensagens === 1 ? "mensagem" : "mensagens"}`;
  const e =
    p.enviadas === 0
      ? "nenhuma resposta enviada"
      : `${p.enviadas} ${p.enviadas === 1 ? "resposta enviada" : "respostas enviadas"}`;
  return `${c} · ${m} · ${e}`;
}
