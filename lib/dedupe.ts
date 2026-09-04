// Chaves de deduplicação da fila.
//
// A coluna `dedupe_key` é UNIQUE: o `on conflict do nothing` do enqueue é o que
// garante que ninguém receba a mesma mensagem duas vezes. Ou seja, o formato
// destas strings é uma regra de negócio — não detalhe de implementação.
//
// Começaram como oito literais espalhados pelo motor. Hoje são ONZE funções
// neste arquivo: as oito de origem, mais `passoKey` (que nasceu com o fluxo por
// passos), `manualReplyKey` e `loteKey`. Juntas aqui por dois motivos: dá para
// ver de relance o que torna cada envio único, e dá para testar. Mudar qualquer
// formato abaixo faz itens já enfileirados deixarem de casar com os novos — na
// prática, autoriza envio em dobro. Os testes em tests/dedupe.test.ts (e
// tests/manual-reply-key.test.ts) existem para essa mudança nunca passar
// despercebida.
//
// DUAS NÃO TÊM MAIS CHAMADOR:
//
//   `followupKey` era a chave dos itens gerados a partir da tabela `followups`,
//     e desde que os lembretes viraram passos da lista ninguém a chama.
//   `welcomeMessageKey` era a do enfileiramento de boas-vindas lido da coluna
//     `welcome_text`, que saiu pelo mesmo motivo.
//
// As duas FICAM, e o motivo não é a fila: consultei a tabela — hoje ela só tem
// os prefixos `mr:` e `passo:`, ZERO linhas `fu:` e ZERO `wm:`. A justificativa
// que dizia o contrário estava errada.
//
// O motivo real é o desmonte pela metade: a tabela `followups` e as colunas
// órfãs de `automations` ainda existem, e a decisão foi tirá-las todas de uma
// vez depois do merge, não em pedaços dentro da branch que trocou o motor.
// Estas duas funções são o par dessas colunas e saem no mesmo movimento. Até
// lá são código morto com teste — o que custa nada e evita que alguém recrie
// um formato incompatível se as colunas voltarem à discussão.

// Resposta privada e resposta pública nascem de um comentário. O id do
// comentário é único e permanente, então basta ele.
export const privateReplyKey = (commentId: string) => `pr:${commentId}`;
export const commentReplyKey = (commentId: string) => `cr:${commentId}`;

// Que dia é "hoje" para efeito de deduplicação, em BRASÍLIA.
//
// O fuso não é detalhe de exibição aqui: este valor entra na `dedupe_key`, ou
// seja, é ele que decide quando a mesma automação pode entregar de novo.
//
// Era `new Date().toISOString().slice(0, 10)`, que é UTC, e isso fazia o dia
// virar às 21h de Brasília. Quem acionasse a automação às 20h e de novo às 22h
// da mesma noite caía em dois baldes diferentes e recebia a sequência DUAS
// VEZES — todo dia, entre 21h e meia-noite, que é justamente o horário de pico
// no Instagram. O resto do sistema já assumia Brasília (lib/format.ts na
// exibição, o `at time zone` do gráfico em app/page.tsx); só este ponto, o
// único em que o fuso muda comportamento e não aparência, estava em UTC.
//
// Recebe o instante em vez de ler o relógio para poder ser testada — é a
// mesma razão de tudo neste arquivo ser função pura.
//
// `en-CA` porque é o locale que formata como `YYYY-MM-DD`, que é o formato que
// as chaves já usavam. Trocar o formato reabriria envio em dobro em tudo que
// já está enfileirado.
export function diaDaChave(agora: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}

// Estes três repetem por pessoa e por dia: o `dia` é o balde que permite a
// mesma automação rodar de novo amanhã sem liberar duas vezes hoje.
export const followGateKey = (
  automationId: string,
  contactIgId: string,
  dia: string,
  tentativa: number
) => `fg:${automationId}:${contactIgId}:${dia}:${tentativa}`;

export const emailAskKey = (automationId: string, contactIgId: string, dia: string) =>
  `ea:${automationId}:${contactIgId}:${dia}`;

// MORTA: nenhum chamador fora dos testes. Ver a nota no topo do arquivo.
export const followupKey = (followupId: string, contactIgId: string, dia: string) =>
  `fu:${followupId}:${contactIgId}:${dia}`;

// Um passo por pessoa por dia. A IDENTIDADE do bloco entra na chave porque a
// mesma automação pode ter vários passos do mesmo tipo — dois lembretes, três
// DMs.
//
// Era o ÍNDICE, e a troca é o motivo da Fase 1b existir: arrastar um bloco
// mudava o índice de tudo que vinha depois dele, cada um virava chave nova, e
// a mensagem saía outra vez para quem já a tinha recebido. O id não muda de
// valor quando o bloco muda de lugar.
//
// O FORMATO da string não mudou, e isso é deliberado: para bloco sem id a
// identidade é o índice, então a chave sai idêntica à que já está gravada na
// fila. Sem isso, o deploy desta fase reentregaria o dia inteiro.
export function passoKey(
  automationId: string,
  contactIgId: string,
  identidade: string,
  bucket: string
): string {
  return `passo:${automationId}:${contactIgId}:${identidade}:${bucket}`;
}

// Os que nascem de uma mensagem recebida usam o id dela (mid). Quando a Meta
// não manda o mid, cai no par remetente+instante: não deduplica de verdade, mas
// é melhor que uma chave nula, que faria o UNIQUE barrar envios legítimos de
// pessoas diferentes.
const porMensagem = (prefixo: string, mid: string | undefined, senderId: string, agora: number) =>
  `${prefixo}:${mid ?? `${senderId}:${agora}`}`;

export const emailAnswerKey = (mid: string | undefined, senderId: string, agora: number) =>
  porMensagem("ear", mid, senderId, agora);

export const welcomeMessageKey = (mid: string | undefined, senderId: string, agora: number) =>
  porMensagem("wm", mid, senderId, agora);

// Reação a story só é enfileirada quando existe mid, então aqui ele é exigido.
export const storyReactionKey = (mid: string) => `rx:${mid}`;

// Resposta digitada por uma pessoa. Ao contrário das automáticas, ela PODE se
// repetir de propósito ("oi" duas vezes é legítimo), então o instante entra na
// chave e cada envio é único.
export const manualReplyKey = (contactIgId: string, agora: number) =>
  `mr:${contactIgId}:${agora}`;

// O envio em lote (`enqueueLote`, lib/engine.ts).
//
// LEVA O accountId, e as outras chaves deste arquivo não levam — a diferença
// não é descuido. `migrations/005-contatos-chave-composta.sql` registra que a
// MESMA pessoa pode falar com DUAS contas de Instagram conectadas com o mesmo
// ig_id: é por isso que a chave primária de `contacts` é composta
// (account_id, ig_id), e não só ig_id. A `dedupe_key` da fila, em contraste, é
// `unique` na TABELA INTEIRA (migrations/000-esquema-base.sql) — sem coluna de
// conta na restrição. Se duas contas gerassem o mesmo loteId para a mesma
// pessoa, a chave sem accountId colidiria entre contas, e o `on conflict do
// nothing` engoliria o segundo envio em silêncio, sem nenhum aviso na tela de
// Envios.
//
// `manualReplyKey`, o precedente mais próximo, tem o mesmo formato sem
// accountId e se protege com o relógio em milissegundos — dois cliques quase
// nunca caem no mesmo instante. O lote não tem esse amortecedor: `loteId` é
// dado de fora, sem garantia de ser único entre contas. Por isso aqui a defesa
// é estrutural, e não probabilística: o accountId entra na chave.
export const loteKey = (accountId: string, loteId: string, contactIgId: string) =>
  `lote:${accountId}:${loteId}:${contactIgId}`;

// A PUBLICAÇÃO NO INSTAGRAM (`enqueuePublicacao`, lib/engine.ts).
//
// O QUE TORNA UM POST ÚNICO É O CAMINHO DO OBJETO NO BUCKET, e não um
// identificador inventado na tela. `caminhoDoObjeto` (lib/bucket.ts) sorteia um
// `randomUUID` por upload, então dois posts jamais compartilham caminho — e o
// MESMO post pedido duas vezes (clique duplo em "publicar", a aba recarregada
// com o formulário preenchido) chega com o mesmo caminho e vira um item só.
//
// É a mesma escolha de `privateReplyKey`, que usa o id do comentário: quando o
// mundo já produziu um identificador único e permanente para a coisa, inventar
// outro é criar uma segunda verdade.
//
// A CONTA ENTRA PELO MESMO MOTIVO DE `loteKey`: `dedupe_key` é `unique` na
// TABELA INTEIRA (migrations/000-esquema-base.sql). O caminho do objeto já
// começa pela conta hoje (`caminhoDoObjeto` põe o ig_id no primeiro segmento),
// mas ele chega aqui vindo do payload — dado de fora —, e a defesa é
// estrutural em vez de confiar em como outro arquivo monta a string.
//
// A FORMA ENTRA NA CHAVE, e ela é a segunda face do mesmo defeito. MEDIDO na
// revisão: o mesmo arquivo pedido como "imagem" e depois como "story" batia na
// MESMA chave, e o segundo pedido era recusado com "já está na fila" — uma
// frase que não descreve o que aconteceu, sobre dois posts que são diferentes.
// Publicar a mesma peça no feed e no story é pedido legítimo, e comum.
//
// A LISTA INTEIRA ENTRA, EM ORDEM, e não só o primeiro caminho. A versão
// anterior levava `caminhos[0]`, e ela errava dos DOIS lados:
//
//   reordenar trocando o primeiro item  ->  chave nova, e o MESMO post entrava
//                                           duas vezes na fila
//   reordenar mantendo o primeiro item  ->  chave igual, e um post DIFERENTE
//                                           era engolido em silêncio
//
// Os dois são o mesmo engano: a ordem do carrossel é CONTEÚDO — todos os itens
// são cortados pela proporção do PRIMEIRO, e é por isso que a tela deixa a
// ordem editável (`moverNaOrdem`, lib/publicacao.ts). Com a lista inteira, a
// pergunta que a chave faz passa a ser a certa: "é este mesmo post, com estas
// mesmas peças, nesta mesma ordem?".
//
// A CHAVE NÃO FICA GIGANTE: são no máximo dez caminhos (`CARROSSEL_ITENS_MAX`),
// cada um do tamanho de `<conta>/<uuid>.<ext>` — cerca de 600 caracteres no
// pior caso, muito abaixo do que o índice único aguenta.
//
// MUDAR ESTE FORMATO NÃO AUTORIZA ENVIO EM DOBRO AQUI, e é o aviso do topo
// deste arquivo respondido: a fila não tem nenhum item `publicacao` antigo para
// deixar de casar — a migração que criou o tipo (`010`) entra junto com este
// código.
export const publicacaoKey = (accountId: string, forma: string, caminhos: string[]) =>
  `pub:${accountId}:${forma}:${caminhos.join(",")}`;
