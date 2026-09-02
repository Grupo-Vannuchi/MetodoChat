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
// O QUE SOBRA NA ROTA é despachar o que esta função decidiu — e ISSO AINDA É
// MUTÁVEL EM SILÊNCIO. A frase que estava aqui ("não sobra condição nenhuma
// para alguém apagar dois tokens de dentro") era FALSA como escrita, e foi
// medida: trocar o literal `"motor"` por `"registrar"` no `if` da rota passa por
// tsc, eslint, 709 puros, varredura e integração, e mata TODO o tratamento de
// mensagens — não só a porta de entrada. Um comentário que promete uma garantia
// que não existe é pior que nenhum: é onde o próximo leitor para de olhar.
//
// O que esta função de fato entrega são duas coisas menores e verdadeiras:
//   1. o CONHECIMENTO saiu da fiação e tem caso para cada saída, aqui do lado;
//   2. `DestinoDoMessaging` é união NOMEADA de três, e o estreitamento do
//      segundo `if` da rota faz o `tsc` recusar sozinho a troca para
//      `"ignorar"` (TS2367). Metade das mutações restantes tem dono.
//
// A OUTRA METADE tem rede desde `testes-integracao/porta-do-webhook.integracao.ts`,
// que importa a rota e POSTa um corpo assinado: um caso por destino, e os três
// juntos prendem os três literais.
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

// ============================================================
// O AVISO DE APAGAMENTO — a forma que TEM `message` E NÃO É MENSAGEM.
//
// A MEDIÇÃO QUE O OBRIGOU, lida no banco de produção em 02/09/2026.
//
// Dois envios manuais para @eng.luishreis, da conta @thiagovannuchi, tomaram
// 403 (code 10, subcode 2534022 — "enviada fora do período permitido") em
// 28/08/2026, com o painel marcando 17,6h de janela ABERTA. A Meta estava
// certa: a última mensagem de verdade dela foi 26/08 às 18:28. O que o painel
// tinha lido como resposta, em 27/08 às 19:39, era isto:
//
//   {"sender":{"id":"985206161205789"},
//    "message":{"mid":"aWdfZAG1faXRlbTo...","is_deleted":true},
//    "recipient":{"id":"17841403483234337"},"timestamp":1787859579053}
//
// `is_deleted: true` — não é mensagem. É o aviso de que ela APAGOU uma mensagem
// antiga. O item tem `message` verdadeiro, então `destinoDoMessaging` o mandava
// para o motor, o motor o gravava como `message` e chamava `upsertContact` com
// `last_reply_at: new Date()`. A janela de 24h passou a contar de um instante em
// que ninguém falou.
//
// O ESCOPO, medido no mesmo dia:
//   12   avisos de apagamento no banco inteiro (7464 eventos, 28/07 a 02/09)
//    8   deles gravados como `message` — 8 de 1054 —, de 6 pessoas diferentes
//    4   gravados como `message_sent`, com `is_echo: true` (a conta apagando)
//    2   contatos com `last_reply_at` vindo de apagamento (@eng.luishreis e
//        @sarp.oddin786), e a hora do contato bate com a do evento em 15ms
//    0   deles com janela falsamente ABERTA hoje — o defeito está DORMINDO,
//        e é por isso que ele precisa de teste e não de conserto de dado
//
// POR QUE ISTO É MAIOR QUE OS DOIS 403: `last_reply_at` é a fonte ÚNICA da
// janela de 24h. O mesmo apagamento faz o ENVIO EM LOTE contar a pessoa em
// "recebem agora" (`lib/lote.ts`) e faz um item de lote `guardado` ACORDAR
// direto para uma janela fechada (`upsertContact`, lib/engine.ts:371) — o
// despertar mora justamente na chamada com `last_reply_at`.
//
// POR QUE NÃO ENTROU EM `FORMAS_CONHECIDAS_E_IGNORADAS`: não funcionaria. O ramo
// do motor vem PRIMEIRO, de propósito, e uma forma que o motor trata nunca cai
// na lista do silêncio — está escrito lá em cima, e é a regra certa. O conserto
// é o ramo do motor DEIXAR DE ACEITAR o que não é mensagem.
//
// -----------------------------------------------------------------------------
// REGISTRAR, E NÃO IGNORAR — a decisão, e o que a decidiu.
//
// Os dois argumentos deste arquivo puxavam para lados opostos: o de `read`
// ("conhecido, esperado, e não há nada a fazer com ele") para ignorar, e o de
// `num_edit > 0` ("ignorar a forma inteira seria trocar ruído por cegueira")
// para registrar. O que desempata é o que o aviso CARREGA, e isso foi medido,
// não suposto.
//
// Um apagamento traz três chaves e só três: `mid`, `is_deleted` e, no eco,
// `is_echo`. Nenhum texto — 0 dos 12 têm `text`. Parecia a referência inútil que
// justificaria ignorar. NÃO É: o `mid` do aviso casa com uma mensagem que ESTE
// banco já gravou em 12 DE 12 CASOS, e o par nunca é outro apagamento — é a
// mensagem original, com o texto dela. Amostras: "Você opina demais", apagada 30
// segundos depois; e, no caso do 403, um telefone ("11970829503"), apagado 25
// horas depois. Ou seja, o aviso é ACIONÁVEL: cruzado com o `mid`, ele diz qual
// mensagem sumiu — inclusive uma que a automação pode já ter respondido. É
// exatamente o caso do `num_edit > 0`, e ignorá-lo seria a mesma cegueira.
//
// O volume confirma o mesmo lado. `read` acompanha TODA mensagem lida e
// `message_edit` deu 6 linhas em 6 horas — esses são ruído que ensina o dono a
// ignorar a tela de diagnóstico. Apagamento deu 12 EM CINCO SEMANAS. Doze linhas
// que explicam por que um envio foi recusado não são ruído; são a única pista
// que sobra, já que os dois `last_reply_at` envenenados continuam no banco.
//
// E O ECO SAI TAMBÉM, pelo mesmo motivo e com um a mais: gravar um apagamento da
// própria conta como `message_sent` AFIRMA um envio que não houve. O texto
// original já está gravado no evento de verdade, então nada de conversa se perde
// — o argumento de "não existe importar histórico" vale para o texto, e o texto
// está a salvo.
//
// SÓ O BOOLEANO `true`, e isto é a doutrina deste arquivo aplicada ao detalhe:
// `jsonb_typeof` dos 12 é `boolean` nos 12, e o banco NUNCA viu `is_deleted:
// false`. Uma mensagem normal não traz a chave; uma que trouxesse com `false`
// seria mensagem de verdade e tem de continuar indo ao motor. Uma string
// `"true"` seria forma NOVA — e este arquivo não trata o que não observou.
// ============================================================

/**
 * `true` quando o item de `messaging` é SÓ o aviso de que uma mensagem foi
 * apagada — e que, por isso, NÃO é resposta da pessoa e não pode mover a janela
 * de 24h.
 *
 * "SÓ" está no nome e é metade da função: um item com `postback` continua sendo
 * do motor mesmo trazendo uma `message` apagada junto, porque tem postback para
 * o motor ler. O toque em PERGUNTA DE ABERTURA — a porta de entrada — chega sem
 * `message` nenhuma, e não pode morrer por causa deste conserto.
 */
export function ehSoApagamento(item: unknown): boolean {
  // A mesma guarda das duas funções acima, pela mesma razão: o que chega aqui é
  // JSON da Meta, e a única garantia é a assinatura do corpo — não o formato.
  if (typeof item !== "object" || item === null || Array.isArray(item)) return false;
  const registro = item as Record<string, unknown>;
  // Presença COM VALOR, e é o mesmo teste do ramo do motor logo abaixo: um
  // `{"postback": null}` não tem postback nenhum, e não segura o item aqui.
  if (registro.postback) return false;
  const mensagem = registro.message;
  if (typeof mensagem !== "object" || mensagem === null || Array.isArray(mensagem)) return false;
  return (mensagem as { is_deleted?: unknown }).is_deleted === true;
}

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
  // O AVISO DE APAGAMENTO TEM `message` VERDADEIRO E NÃO É MENSAGEM, e é por
  // isso que ele está DENTRO da condição do motor em vez de num ramo próprio
  // acima: o conserto não é dar um destino novo ao apagamento, é o ramo do motor
  // deixar de aceitar o que não é mensagem. O destino dele sai do PADRÃO, logo
  // abaixo — que é o padrão porque o silêncio é que precisa ser justificado.
  // O porquê inteiro, com a medição, está no cabeçalho de `ehSoApagamento`.
  if (!ehSoApagamento(registro) && FORMAS_DO_MOTOR.some((chave) => Boolean(registro[chave])))
    return "motor";
  if (ehConhecidoEIgnorado(registro)) return "ignorar";
  return "registrar";
}
