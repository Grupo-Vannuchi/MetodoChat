// Separa, dentro de `entry.messaging[]`, o que é CONHECIDO-E-IGNORADO do que é
// GENUINAMENTE DESCONHECIDO.
//
// POR QUE ESTE ARQUIVO EXISTE, com a medição que o obrigou.
//
// O registro `webhook_messaging_nao_tratado` nasceu para que nada chegasse no
// webhook e sumisse calado. Ele funcionou — e imediatamente mostrou que estava
// LARGO DEMAIS. Lido no banco de produção em 26/08/2026, o histórico inteiro do
// tipo eram **3 linhas, e as 3 da mesma forma**:
//
//   {"read":{"mid":"..."},"sender":{...},"recipient":{...},"timestamp":...}
//
// Confirmação de leitura. Toda mensagem lida gera uma. Isso não é "não
// entendi": é conhecido, é esperado, e não há nada a fazer com ele. Gravado em
// Atividade, vira ruído na tela que o dono usa para diagnosticar — e ruído numa
// tela de diagnóstico é pior do que nada, porque ensina a ignorá-la.
//
// O valor da mudança original é o OUTRO lado: `messaging_referral` e
// `messaging_postbacks` — as formas que o experimento de primeiro contato está
// esperando — continuam virando evento, porque continuam sendo desconhecidas.
//
// A LISTA ABAIXO É DO QUE FOI **OBSERVADO**, NÃO DO QUE A DOCUMENTAÇÃO PROMETE.
//
// Esta distinção é a regra deste arquivo, e ela é deliberada. Escrever aqui
// `delivery`, `reaction`, `message_edit` e o resto do catálogo da Meta — que a
// documentação lista e que este banco NUNCA viu — reconstruiria o silêncio que
// o registro veio acabar: a primeira forma nova a chegar cairia numa entrada
// escrita de antemão, seria descartada sem uma linha, e ninguém saberia. Uma
// forma só entra nesta lista DEPOIS de aparecer em `webhook_messaging_nao_tratado`
// e de alguém decidir que ela é para ignorar.
//
// Quem for acrescentar a próxima: rode a leitura do histórico primeiro, e deixe
// a data e a contagem escritas na entrada, como as de baixo estão.

/**
 * As formas que o banco de produção JÁ VIU e que são para ignorar de propósito.
 *
 * `chave` é a chave de topo do item de `messaging` que identifica a forma — é
 * assim que a Meta discrimina esses eventos, e é o mesmo teste que o ramo de
 * `message` já fazia logo acima.
 */
export const FORMAS_CONHECIDAS_E_IGNORADAS = [
  {
    chave: "read",
    porque:
      "confirmação de leitura: toda mensagem lida gera uma, e não há nada a fazer com ela",
    // 3 linhas em `webhook_messaging_nao_tratado`, o histórico inteiro do tipo,
    // lidas em 26/08/2026 — todas da conta @thiagovannuchi.
    observado_em: "2026-08-26",
  },
  {
    chave: "message_edit",
    porque:
      "acompanha toda mensagem com `num_edit: 0`, e nesse caso não houve edição nenhuma",
    // 6 linhas em 6 horas, contra 226 eventos no mesmo período, lidas em
    // 26/08/2026 depois que o dono ligou os campos que faltavam no painel da
    // Meta. Todas com `num_edit: 0`.
    observado_em: "2026-08-26",
    // E ESTA É A METADE QUE NÃO SE IGNORA.
    //
    // `num_edit: 0` é o companheiro silencioso de uma mensagem comum — ruído.
    // `num_edit` MAIOR QUE ZERO é outra coisa inteiramente: a pessoa MUDOU o
    // texto depois de mandá-lo, e o motor pode já ter agido sobre o original.
    // Uma automação que respondeu à palavra-chave "quero" e viu o texto virar
    // outra coisa é exatamente o tipo de fato que o dono precisa poder ver em
    // Atividade.
    //
    // Ignorar a forma inteira seria trocar ruído por cegueira. Nunca vimos um
    // `num_edit` maior que zero neste banco — e é por isso que ele continua
    // caindo no registro, em vez de numa entrada escrita de antemão.
    soQuando: (valor: unknown) =>
      typeof valor === "object" &&
      valor !== null &&
      (valor as { num_edit?: unknown }).num_edit === 0,
  },
] as const;

/**
 * `true` quando o item de `messaging` é uma forma conhecida que se ignora de
 * propósito — e que, por isso, NÃO deve virar linha em Atividade.
 *
 * `false` para tudo o mais, inclusive o que ainda não tem nome: o padrão é
 * registrar, e o silêncio é que precisa ser justificado, uma forma por vez.
 */
export function ehConhecidoEIgnorado(item: unknown): boolean {
  // Vale para qualquer objeto que não seja nulo nem lista. Não é firula: o que
  // chega aqui é JSON da Meta, e a única garantia é a assinatura do corpo — não
  // o formato dele. Um `null` no meio do array derrubaria o `in`.
  if (typeof item !== "object" || item === null || Array.isArray(item)) return false;
  const registro = item as Record<string, unknown>;
  return FORMAS_CONHECIDAS_E_IGNORADAS.some((f) => {
    if (!(f.chave in registro)) return false;
    // A ENTRADA PODE IGNORAR A FORMA INTEIRA OU SÓ UM RECORTE DELA, e o recorte
    // é o caso mais interessante: `message_edit` é ruído quando `num_edit` é 0 e
    // é notícia quando não é. Sem `soQuando`, a entrada vale para a forma toda —
    // que é o caso de `read`, onde não há metade que interesse.
    const so = (f as { soQuando?: (valor: unknown) => boolean }).soQuando;
    return so ? so(registro[f.chave]) : true;
  });
}
