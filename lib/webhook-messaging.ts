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

// ============================================================
// PARA QUAL RAMO VAI ESTE ITEM DE `messaging`? — a decisão inteira, aqui.
//
// POR QUE ELA MUDOU DE CASA, com a medição que a obrigou.
//
// A rota do webhook decidia isto sozinha, em três linhas suas:
//
//   if (messaging.message || messaging.postback) { ...motor...; continue; }
//   if (ehConhecidoEIgnorado(messaging)) continue;
//   await logEvent(..., "webhook_messaging_nao_tratado", messaging);
//
// A primeira delas é a única linha que faz a PORTA DE ENTRADA existir, e ela
// não estava protegida por nada. Medido: apagar os dois tokens `|| postback`
// deixa `tsc` limpo, `eslint` limpo, os 693 testes puros verdes, a varredura
// imprimindo SEM VAZAMENTO e os 46 de integração TODOS VERDES — com o toque em
// pergunta de abertura morto em produção, voltando a virar
// `webhook_messaging_nao_tratado`. Os casos de integração da porta de entrada
// não pegam: eles chamam `handleMessagingEvent` direto, e o defeito mora uma
// camada acima deles.
//
// É a mesma doença que esta base passou semanas fechando (os cinco `.destino`
// do commit 4ba91f7, com a mesma assinatura de gates verdes): A FIAÇÃO ENTRE
// CAMADAS É ONDE O DEFEITO SOBREVIVE. O conserto não é escrever um teste da
// rota — é a decisão não morar na fiação. Aqui ela é função pura, este arquivo
// não tem import nenhum, e cada ramo tem caso afirmando as duas formas.
//
// O QUE SOBRA NA ROTA é despachar o que esta função decidiu. Não sobra
// condição nenhuma para alguém apagar dois tokens de dentro.
// ============================================================

/**
 * As chaves de topo que o MOTOR trata (`lib/engine.ts`,
 * `handleMessagingEvent`).
 *
 * `postback` está ao lado de `message` e não num ramo próprio: os dois são a
 * mesma pergunta — "o que esta pessoa fez na conversa?" — e quem responde é a
 * mesma função. O toque numa PERGUNTA DE ABERTURA chega nesta forma, sem
 * `message`.
 */
export const FORMAS_DO_MOTOR = ["message", "postback"] as const;

/**
 * Para onde vai um item de `entry.messaging[]`:
 *
 *   `"motor"`      o motor trata (`handleMessagingEvent`).
 *   `"ignorar"`    forma conhecida que não vira linha, de propósito.
 *   `"registrar"`  tudo o mais — inclusive o que ainda não tem nome.
 *
 * A ORDEM É PARTE DA DECISÃO: o motor vem primeiro. Uma forma que o motor trata
 * nunca cai na lista do silêncio, mesmo que um dia alguém escreva `message` lá.
 *
 * `"registrar"` é o padrão, e é o padrão porque o silêncio é que precisa ser
 * justificado — uma forma por vez, depois de vista no banco.
 */
export type DestinoDoMessaging = "motor" | "ignorar" | "registrar";

export function destinoDoMessaging(item: unknown): DestinoDoMessaging {
  // Vale para qualquer objeto que não seja nulo nem lista, pela mesma razão de
  // `ehConhecidoEIgnorado`: o que chega aqui é JSON da Meta, e a única garantia
  // é a assinatura do corpo — não o formato dele. Um `null` no meio do array
  // derrubava a rota com TypeError; aqui ele vira uma linha em Atividade, que é
  // o que este registro existe para fazer.
  if (typeof item !== "object" || item === null || Array.isArray(item)) return "registrar";
  const registro = item as Record<string, unknown>;
  // Presença COM VALOR, e não `in`: era o teste que a rota fazia
  // (`messaging.message || messaging.postback`), e ele é o certo — um
  // `{"postback": null}` não tem postback nenhum para o motor ler.
  if (FORMAS_DO_MOTOR.some((chave) => Boolean(registro[chave]))) return "motor";
  if (ehConhecidoEIgnorado(registro)) return "ignorar";
  return "registrar";
}
