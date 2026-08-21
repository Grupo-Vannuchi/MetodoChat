// O fluxo de uma automação, como dado.
//
// Antes a sequência morava dentro do lib/engine.ts: advanceFlow chamava
// followGate, que chamava enqueueFollowups, nessa ordem e só nessa. Isso punha
// um teto na tela — um editor de blocos sobre aquele motor só poderia arrastar
// dois blocos, e arrastar os outros mostraria uma ordem que o motor não executa.
//
// Este arquivo é FUNÇÃO PURA de propósito: não toca banco, não chama a Meta, não
// conhece a fila. É a peça mais arriscada da mudança, e assim ela é a única
// testável sem banco — o que importa num projeto cuja suíte não abre conexão.

// O `id` é a identidade do bloco, e ele é OPCIONAL de propósito.
//
// O motivo NÃO é execução, e vale dizer porque a explicação anterior dizia que
// era: `conferir` nunca lê `o.id` — ela valida `tipo`, `texto`, `minutos`,
// `textos` e `emoji` —, e o `steps` chega do banco como `unknown[]`, ou seja,
// nada confere este tipo em runtime. Exigir `id` não recusaria bloco antigo
// nenhum; seria mudança só de tipo, sem efeito em execução.
//
// O motivo real é de TIPO, e é concreto: `Passo` é o que todo literal de passo
// precisa satisfazer, aqui e nos testes. Com `id` obrigatório, cada lista
// escrita à mão em tests/steps.test.ts — dezenas delas, que existem para fixar
// decisão de FLUXO e para as quais a identidade do bloco é irrelevante —
// deixaria de compilar, e o `tsc` do `npm run verify` só voltaria ao verde
// depois de inventar um id em cada uma.
//
// E o bloco antigo segue valendo de qualquer jeito: `identidadeDoPasso` lhe dá
// a identidade que ele sempre teve na prática, o índice.
//
// `pos` é a posição no quadro, e ela é OPCIONAL pelo mesmo motivo: bloco
// gravado antes da Fase 1b não tem, e `arranjoAutomatico` (editor/modelos.ts)
// lhe dá uma na primeira abertura.
type ComId = { id?: string; pos?: Posicao };

// A `dm` tem tipo próprio porque `envioDaDm` (abaixo) precisa recebê-la sozinha,
// já estreitada. É o MESMO membro que sempre esteve dentro da união — só ganhou
// nome.
export type PassoDm = {
  tipo: "dm";
  texto: string;
  botao_label?: string;
  url?: string;
  botoes?: Botao[];
};

export type Passo = ComId &
  (
    | { tipo: "resposta_publica"; textos: string[] }
    | PassoDm
    | { tipo: "esperar"; minutos: number }
    | { tipo: "reagir_story"; emoji: string }
    | { tipo: "pedir_follow"; texto: string; botao_label: string }
    | { tipo: "pedir_email"; texto: string }
  );

// A posição no quadro é gravada junto, e NÃO participa de decisão nenhuma —
// nem de ordem, nem de validação, nem de execução. Quem define a ordem é o
// array. Isto está aqui só para o editor reabrir do jeito que foi deixado.
export type Posicao = { x: number; y: number };

// EM QUE FORMA UMA `dm` SAI. É a única resposta a essa pergunta em todo o
// sistema, e é de propósito que ela seja uma só.
//
// QUATRO LEITORES, e cada um já decidiu por conta própria — o inventário é
// HISTÓRICO, e hoje nenhum deles reescreve a regra (a lista de quem PERGUNTA a
// esta função está mais abaixo, em "O QUE NÃO SE DUPLICA"):
//
//   `enfileirarPasso` (lib/engine.ts) escrevia
//     `const respostaRapida = Boolean(p.botao_label) && !p.url` para escolher o
//     `kind` e o payload da fila;
//   a prévia (app/automacoes/editor/roteiro.ts) lia `passo.url` no ramo de link
//     e afirmava `passo.botao_label!` no de resposta rápida;
//   o painel do bloco (app/automacoes/editor/painel.tsx) decidia se mostrava o
//     aviso "o fluxo para aqui" com `Boolean(passo.botao_label)` — a última
//     cópia solta, que só saiu na Tarefa 4, e cuja correção seguinte está
//     registrada lá: trocada por `envioDaDm(passo).forma === "resposta_rapida"`,
//     ela ficou errada no commit seguinte (o menu de `botoes` passou a parar) e
//     hoje pergunta pela PARADA, `esperaResposta(passo)`;
//   `esperaResposta` (logo abaixo) decidia se o fluxo PARA no bloco.
//
// O QUE A SEGUNDA CÓPIA CUSTOU, medido: quando `esperaResposta` passou a dizer
// sim a um `dm` com `botoes`, a linha do motor não mudou junto. Um bloco com
// `botoes` e sem `botao_label` fazia `interpretar` parar nele e o cursor ser
// gravado, enquanto `enfileirarPasso` montava a mensagem como TEXTO PURO, sem
// botão nenhum — o motor parava esperando um toque que ele não entregou. Junto,
// o `passo.botao_label!` da prévia virou mentira: a asserção não-nula seguia
// compilando sobre um campo que podia não existir.
//
// A REGRA, e ela tem QUATRO formas desde a Tarefa 4 — DUAS PARAM. A versão
// anterior deste parágrafo listava três e chamava a resposta rápida de "o
// único caminho do dreno que monta `quick_replies`" e "o único bloco `dm` que
// espera": as duas frases são falsas desde que o menu de `botoes` existe, e
// quem lesse até aqui e parasse sairia com a regra errada.
//
//   `botoes` não vazio e SEM url → MENU. Monta `quick_replies` pelo ramo
//     PLURAL do dreno (lib/queue-drain.ts) e ESPERA: o menu existe para ser
//     tocado. Entra ANTES do ramo de `botao_label` — ver o parágrafo de
//     `botoes`, mais abaixo.
//   rótulo e SEM url → resposta rápida. Monta `quick_replies` pelo ramo
//     SINGULAR do mesmo dreno, e também ESPERA: resposta rápida existe para
//     ser tocada.
//   COM url → botão de link, mesmo sem rótulo (aí `linkMessage`, lib/ig.ts, usa
//     "Abrir link"). A pessoa abre e a vida segue; não há toque a esperar.
//   nem uma coisa nem outra → texto puro.
//
// A distinção não foi inventada aqui: é exatamente como o formulário gravava —
// boas-vindas com rótulo e sem url, link com rótulo e com url —, e é a mesma
// que a paleta do quadro nomeia em "Mensagem com botão" e "Mensagem com link"
// (app/automacoes/editor/modelos.ts).
//
// `botoes` GANHA RAMO AQUI NA TAREFA 4 — a ausência acima era a metade
// importante da correção anterior, e ela era temporária de propósito: "QUEM
// DEVOLVE A PARADA AOS `botoes` É A TAREFA 4" já estava escrito aqui antes de
// esta função existir. O ramo entra ANTES do de `botao_label`, e a ordem
// decide o caso em que um bloco tem as duas coisas: sai como MENU, não como
// resposta rápida de um botão só.
//
// A CONFERÊNCIA É DE FORMA, não de conteúdo — `Array.isArray` e `.length`, não
// o tipo estático `Botao[]` — pelo mesmo motivo de todo outro campo lido nesta
// função: `conferir` não olha `botoes` (é comentário dela, mais abaixo), então
// o que chega aqui é `jsonb` cru, e nada garante que seja de fato uma lista.
// Sem a conferência, um `botoes` de outro tipo (string, número, objeto solto)
// entraria em `{forma: "botoes"}` e quebraria todo mundo que confia em ler
// `.botoes` dali como lista.
//
// E ELA VALIDA A LISTA, NÃO OS ELEMENTOS — o que sai daqui é tipado `Botao[]`
// por CAST, e nada garante que cada item tenha `id` e `rotulo` de texto. Quem
// lê `b.rotulo`/`b.id` crus é `enfileirarPasso` (lib/engine.ts), e o que um
// elemento quebrado produz depende de QUAL elemento — a descrição anterior
// juntava os dois casos num só, e errava o pior deles. Medido:
//
//   `null` ou `undefined` na lista → `[null].map(b => b.rotulo)` estoura
//     `TypeError`. Não é "aparado tarde", é QUEDA: `enfileirarPasso` morre
//     antes de o item chegar à fila, a caminhada aborta no meio (nada mais é
//     enfileirado, e o cursor, gravado depois do laço, não é gravado), e o
//     `try/catch` do webhook (app/api/webhook/route.ts) engole a exceção e
//     grava um `error` genérico — que derruba junto o resto do lote de eventos
//     daquela requisição, porque o catch está fora dos dois laços.
//   objeto sem os campos, texto, número → aí sim o que a versão anterior
//     descrevia: rótulo ausente e `undefined` no lugar do id dentro do
//     payload. Essa metade é aparada tarde, na saída do dreno, por
//     `botoesDaMensagem` (mais abaixo) — e, quando ela apara TODOS, o menu sai
//     vazio, que é o caso que `lib/queue-drain.ts` registra como
//     `menu_sem_botoes`.
//
// A distinção importa para quem for priorizar a Tarefa 5: o primeiro caso é
// perda de entrega para todo mundo daquela requisição, não um botão feio.
//
// ISSO FOI FECHADO NA TAREFA 5, e o registro fica aqui — e não só num relatório
// — porque é aqui que quem mexer vai ler: a conferência de CONTEÚDO de `botoes`
// (cada elemento é objeto, com `id` e `rotulo` de texto não vazios, sem
// dois-pontos no id, ids distintos dentro do bloco) mora em `conferirLista`, que
// é o lugar que TRAVA O SALVAR, e a peça que a executa é `botoesCrus`, no fim
// deste arquivo. Esta função continua não recusando bloco nenhum de propósito —
// recusar aqui faria `interpretar` IGNORAR o bloco, que é a troca cara descrita
// no comentário do rótulo do portão, em `conferir`.
//
// A QUARTA FORMA OBRIGA `esperaResposta` A LISTÁ-LA, e isso é o contrário do
// que este parágrafo prometeu até a revisão da Tarefa 4. Ele dizia "a parada
// volta sem `esperaResposta` mudar" — e o commit que escreveu essa frase mudou
// `esperaResposta` vinte linhas abaixo, trocando `forma === "resposta_rapida"`
// por `forma === "resposta_rapida" || forma === "botoes"`. Fica registrado
// porque previsão errada é o tipo de frase que alguém repete sem medir, e esta
// já tinha sido repetida em dois testes.
//
// E ela não podia sair certa: criar uma forma NOVA obriga alguém a dizer se ela
// para. Das quatro, duas param e duas não (`link` e `texto` não esperam toque
// nenhum), e nada na forma em si permite deduzir de que lado a nova cai — é
// decisão de produto, e alguém tem que escrevê-la.
//
// O QUE NÃO SE DUPLICA É A DECISÃO DA FORMA, e é essa a diferença entre uma
// regra e duas. "O que este bloco entrega" é respondido AQUI e só aqui:
// `esperaResposta` (abaixo), o motor (`enfileirarPasso`, lib/engine.ts) e a
// prévia da conversa (app/automacoes/editor/roteiro.ts) PERGUNTAM a esta
// função, e o painel do bloco (app/automacoes/editor/painel.tsx) pergunta a
// `esperaResposta`, que pergunta a esta — nenhum dos quatro reescreve
// `Boolean(p.botao_label) && !p.url`. O que
// `esperaResposta` acrescenta é uma linha sobre o RESULTADO dela, e essa linha
// não some de vista: o teste "A PARADA E A ENTREGA SÃO A MESMA PERGUNTA"
// (tests/steps.test.ts) exige que "para" e "entrega algo tocável" sejam a mesma
// resposta em toda forma que ele percorra.
//
// E O QUE ELE PERCORRE VEM DAQUI, do TIPO — as fixtures moram num
// `Record<EnvioDaDm["forma"], …>`, e `Record` sobre uma união exige todas as
// chaves. Acrescentar um membro a `EnvioDaDm` sem levar fixture para lá NÃO
// COMPILA.
//
// ONDE ISSO ACENDE, dito com precisão porque a versão anterior desta frase era
// FALSA e era load-bearing (ela dizia que o teste percorre "TODA forma que este
// projeto sabe produzir", e a revisão mediu o contrário: uma quinta forma
// plantada, que parava sem entregar nada, deixou a suíte 217/217 VERDE, porque
// a lista era um literal escrito à mão): quem acende é o `tsc`
// — `npm run typecheck`, dentro do `npm run verify` —, e NÃO o `vitest`
// sozinho, que apaga os tipos. O vitest cobre a metade de baixo: balde vazio e
// fixture que não sai na forma sob a qual foi escrita.
//
// O que a versão anterior descrevia bem, e continua valendo, é a MEDIÇÃO: antes
// desta tarefa `esperaResposta` dizia sim a um `dm` com `botoes`,
// `enfileirarPasso` (lib/engine.ts) só sabia montar um rótulo, e a mensagem saía
// como texto puro enquanto o motor gravava o cursor esperando um toque que nunca
// chegaria. O que fecha isso é o motor e o dreno terem aprendido a entregar
// vários botões (`lib/engine.ts`, `lib/queue-drain.ts`) no mesmo commit desta
// função — não a ausência de uma linha em `esperaResposta`.
//
// O RÓTULO VEM JUNTO nos dois ramos que entregam algo tocável, e não como um
// campo à parte para o chamador reler: era o `botao_label!` da prévia que
// provava a necessidade, para `resposta_rapida`. Para `botoes` a mesma ideia
// vale por lista: quem recebe `{forma: "botoes"}` recebe os botões inteiros,
// id e rótulo juntos, não um rótulo solto que o chamador teria de casar com
// `p.botoes` de novo.
export type EnvioDaDm =
  | { forma: "resposta_rapida"; rotulo: string }
  | { forma: "botoes"; botoes: Botao[] }
  | { forma: "link"; rotulo: string | null; url: string }
  | { forma: "texto" };

export function envioDaDm(p: PassoDm): EnvioDaDm {
  if (Array.isArray(p.botoes) && p.botoes.length && !p.url) {
    return { forma: "botoes", botoes: p.botoes };
  }
  if (p.botao_label && !p.url) return { forma: "resposta_rapida", rotulo: p.botao_label };
  if (p.url) return { forma: "link", rotulo: p.botao_label || null, url: p.url };
  return { forma: "texto" };
}

// Um passo espera resposta quando ele PEDE alguma coisa.
//
// `dm` espera quando, e só quando, ela SAI com algo tocável — resposta rápida
// OU menu de `botoes`, desde a Tarefa 4 — e a pergunta é feita a `envioDaDm`
// (acima), e não respondida de novo aqui. Assim "o fluxo para neste bloco" e
// "este bloco entrega algo para tocar" não são duas afirmações que podem
// discordar: são a mesma, para as duas formas.
//
// EXPORTADA desde a prévia da conversa (app/automacoes/editor/roteiro.ts), e a
// alternativa era pior: a prévia precisa dizer QUAIS BLOCOS PARAM O FLUXO —
// essa é metade da razão de ela existir —, e reescrever a regra lá dentro poria
// a regra mais importante da tela numa segunda cópia. O dia em que as duas
// discordassem, a prévia mostraria uma conversa que o motor não executa, sem
// nada acusar.
export function esperaResposta(p: Passo): boolean {
  if (p.tipo === "pedir_follow" || p.tipo === "pedir_email") return true;
  if (p.tipo === "dm") {
    const forma = envioDaDm(p).forma;
    return forma === "resposta_rapida" || forma === "botoes";
  }
  return false;
}

// O BLOCO QUE ESPERA E QUE SÓ DESTRAVA PELA SETA `sempre`.
//
// `esperaResposta` (acima) diz que o fluxo PARA no bloco. Esta diz por ONDE ele
// volta a andar, e as duas perguntas não têm a mesma resposta: o motor tem dois
// jeitos de retomar um bloco de espera, e cada um consulta uma seta diferente.
//
//   `pedir_follow`, `pedir_email` e a `dm` de RESPOSTA RÁPIDA retomam pela
//     `sempre`: sem ela o destino é null, `interpretar` sai calada e a pessoa
//     não recebe nada. Mas isso NÃO É um mapa único de três-tipos-para-três-
//     funções — cada tipo bate nessa parede pelo SEU ponto de chamada, não os
//     três pelos mesmos três ramos. Só a `dm` de resposta rápida consulta
//     `seguinteDe` nas três (`retomadaDoTexto`, `retomadaDoBotao`,
//     `retomadaDoEmailConhecido`). `pedir_follow` NUNCA consulta `seguinteDe`
//     em `retomadaDoTexto` (:2130) nem em `retomadaDoBotao` (:1989) — as duas
//     devolvem o PRÓPRIO bloco, porque ali quem retoma é o PORTÃO, e o portão
//     se reavalia. O `seguinteDe` que de fato destrava o portão mora em
//     lib/engine.ts:711, no ramo `resolverFollow === "passou"`. `pedir_email`
//     também não consulta `seguinteDe` em `retomadaDoBotao` (:1989) — devolve
//     o bloco —, mas consulta em `retomadaDoTexto` (:2130) e em
//     `retomadaDoEmailConhecido` (:2195), que é o único desses cinco pontos
//     dedicado a um tipo só. A regra continua valendo para os três: cada um
//     vira beco sem saída quando `seguinteDe` é null, só que cada um no SEU
//     lugar, não nos três ramos citados de uma vez.
//   A `dm` de `botoes` NÃO: o toque é resolvido por
//     `ligacaoEscolhida(..., {tipo:"botao"})` (`caminhoDoBotao`), uma seta POR
//     BOTÃO. Um menu inteiramente ligado não tem `sempre` nenhuma saindo, e
//     perguntar `seguinteDe` a ele acusaria de beco sem saída todo menu certo
//     do produto. Quem cobre esse caso é a regra do BOTÃO SEM DESTINO, em
//     `conferirLista`, que faz a mesma pergunta que o motor faz no toque.
//
// E "NÃO RETOMA PELA `sempre`" NÃO QUER DIZER "NÃO RETOMA": desde a Tarefa 7b quem
// DIGITA num menu retoma pela `senao` (`retomadaDoTexto`, lá embaixo). Esta
// função continua respondendo só pela `sempre`, que é o que a conferência do beco
// sem saída pergunta — mas quem ler o parágrafo acima procurando "por onde um
// menu volta a andar" tem hoje DUAS respostas, e o toque é só uma delas.
//
// EXISTE SEPARADA DE `esperaResposta` E NÃO DENTRO DELA porque as duas têm
// donos diferentes: `esperaResposta` é lida pelo motor, pela prévia e pelas
// paradas duras, e todas as três querem "para aqui" sem se importar com a seta.
// Esta é a pergunta da CONFERÊNCIA, e ela é a de retomada.
function retomaPelaSempre(p: Passo): boolean {
  if (!esperaResposta(p)) return false;
  return p.tipo !== "dm" || envioDaDm(p).forma !== "botoes";
}

export type AcaoEnfileirar = {
  passo: Passo;
  indice: number;
  // Atraso acumulado pelos `esperar` que vieram antes deste passo.
  atrasoSegundos: number;
};

export type Resultado = {
  enfileirar: AcaoEnfileirar[];
  // A IDENTIDADE do bloco que espera resposta, ou null quando o caminho acabou.
  //
  // Era o ÍNDICE, e virou identidade porque é isso que o chamador faz com ele: o
  // único leitor (`executarFluxo`, lib/engine.ts) o convertia em identidade na
  // linha seguinte, com `identidadeDoPasso((steps as unknown[])[pararEm],
  // pararEm)`, só para gravar o cursor. O cast sem conferência que aquela linha
  // exigia sai junto.
  pararEm: string | null;
  ignorados: { indice: number; motivo: string }[];
  // O que fazer com o cursor do contato QUANDO a caminhada não parou em ninguém
  // (`pararEm` nulo). Com `pararEm` não nulo esta resposta não é consultada: o
  // cursor é aquele bloco.
  //
  //   "limpar" — o caminho ACABOU. Não há mais nada a entregar, e a pessoa não
  //     está no meio de nada: é o fim normal do fluxo.
  //   "manter" — a caminhada foi INTERROMPIDA por dado quebrado (coluna que não
  //     é lista, ligação pendurada, teto estourado). Onde a pessoa estava
  //     continua valendo, e o cursor é o único registro disso; apagá-lo por
  //     causa de uma seta quebrada a deixaria PIOR do que estava, que é a
  //     preferência oposta à que lib/engine.ts já registra para o portão não
  //     avaliado — "deixando-o intacto ela não fica pior do que estava".
  //     Arrumado o dado, a interação seguinte continua de onde parou.
  //
  // O CRITÉRIO É DADO QUEBRADO → "manter", FIM NORMAL → "limpar", e ele vale
  // para os três ramos de dado quebrado sem exceção. "A automação não tem lista
  // de passos" mantém junto com os outros dois, e a razão que ele já teve para
  // limpar ("ali não existe bloco nenhum na lista") não é sabível: com `steps`
  // fora de forma esta função não sabe se a lista está vazia ou ilegível, e
  // coluna corrompida e depois restaurada é exatamente o cenário que o "manter"
  // existe para atender. Quem continua LIMPANDO é "não tem nenhum passo": ali a
  // coluna está íntegra e diz, sem ambiguidade, que a lista não tem bloco algum.
  //
  // O PREÇO DO "manter", inteiro, porque ele é o argumento de quem um dia quiser
  // reverter esta decisão. Ele tem duas metades, e a segunda é a cara:
  //
  //   REENFILEIRAMENTO. Enquanto o dado não for arrumado, cada mensagem da
  //     pessoa refaz a mesma caminhada e reenfileira o trecho ANTES da quebra. A
  //     `passoKey` colapsa isso dentro do dia; virado o balde, o trecho sai de
  //     novo. É o preço que lib/engine.ts já nomeia.
  //   CAPTURA DO CONTATO. Cursor não nulo faz `handleMessagingEvent`
  //     (lib/engine.ts) ler toda mensagem da pessoa como resposta ao passo
  //     parado — é a mesma regra que aquele arquivo escreve como "automação
  //     desativada não pode sequestrar o contato". Com "manter", uma seta
  //     quebrada prende a pessoa por tempo INDETERMINADO: nenhuma outra
  //     automação a alcança, e a única fuga é `interrompeOFluxo`, que só cede a
  //     vez quando o bloco parado é `dm`. Parada num `pedir_follow` ou num
  //     `pedir_email`, ela não sai até alguém arrumar a automação.
  //
  // A escolha continua sendo "manter" porque o outro lado é perder o lugar da
  // pessoa em silêncio, e o dado quebrado tem conserto — mas ela é uma escolha,
  // não uma obviedade.
  cursorNoFim: "limpar" | "manter";
};

// Quantos blocos uma caminhada pode percorrer antes de ser interrompida.
//
// ELE EXISTE CONTRA DADO QUE ENTROU POR FORA DO EDITOR, e não contra o dono do
// painel. `conferirLista` protege quem monta a automação na tela, mas `ligacoes`
// é uma coluna `jsonb` e nada impede que ela seja escrita por um script, por uma
// restauração de backup ou por uma consulta à mão. A Fase 1b já registrou isso
// como premissa: o que chega do banco não tem forma garantida, e quem valida é
// este arquivo.
//
// O TETO JÁ FOI A ÚNICA DEFESA QUE EXISTIA, e desde a Tarefa 5 não é mais:
// `conferirLista` (lá embaixo) chama `temCicloDeSempre` e TRAVA O SALVAR de um
// anel de `sempre`. Este parágrafo já prometeu essa ligação antes de ela existir
// — a função foi escrita na Tarefa 2 e passou três tarefas sem um único chamador
// fora dos testes —, e a correção que apontava a mentira fica registrada aqui
// para ninguém reescrevê-la de memória.
//
// O QUE O TETO CONTINUA SEGURANDO, e é por isso que ele não sai: o anel que
// chega pela TELA agora é barrado no salvar, mas `ligacoes` é uma coluna `jsonb`
// e o anel escrito por um script, por uma restauração de backup ou por uma
// consulta à mão não passa por conferência nenhuma. Para ele, este teto é a
// defesa, e continua sendo a única.
//
// Sem o teto, um anel de `sempre` faz a caminhada não retornar NUNCA: a fila
// cresce até a memória acabar, dentro de um webhook que a Meta reenvia por 36
// horas. É a falha mais cara que este arquivo pode produzir, e ela custa uma
// linha para não existir.
//
// 100 é folga grande de propósito. O maior fluxo montável na tela não chega
// perto disso, então bater no teto é sinal de anel, não de fluxo comprido —
// e é por isso que o motivo registrado em `ignorados` fala de volta no caminho.
export const TETO_DE_PASSOS = 100;

// Um botão de escolha. O `id` é o que viaja no payload, e é ele que
// `ligacaoEscolhida` (mais abaixo) casa com a ligação — NÃO o rótulo, que o dono
// pode reescrever a qualquer momento sem querer trocar de caminho.
export type Botao = { id: string; rotulo: string };

// A pergunta feita na bifurcação.
//
// `sempre` é o caso comum: um bloco que não bifurca tem uma saída só, e ela vale
// sem condição. `botao` casa com o toque. `senao` recebe quem respondeu
// DIGITANDO em vez de tocar — é opcional, e sem ela o fluxo simplesmente para.
//
// As outras duas ramificações do produto entram AQUI, sem tocar em mais nada:
// `{tipo:"texto", palavras:[…]}` e `{tipo:"segue"}`. É por isso que `quando` é
// um objeto com discriminante em vez de uma string.
export type Quando =
  | { tipo: "sempre" }
  | { tipo: "botao"; botao: string }
  | { tipo: "senao" };

export type Ligacao = { de: string; quando: Quando; para: string };

// Comprimento FIXO, pelo mesmo motivo de `novoIdDeBloco`: um id curto demais
// seria recusado pela forma e o botão deixaria de casar com a ligação, em
// silêncio.
//
// O alfabeto é o mesmo de `novoIdDeBloco` (`ALFABETO_DO_ID`, declarado mais
// abaixo, junto de `FORMA_DO_ID`) — reaproveitado em vez de repetido, para as
// duas gerações nunca poderem divergir sobre o que é um caractere válido.
export function novoIdDeBotao(): string {
  let id = "op_";
  for (let i = 0; i < 6; i++)
    id += ALFABETO_DO_ID[Math.floor(Math.random() * ALFABETO_DO_ID.length)];
  return id;
}

// Valida e normaliza uma ligação. Devolve o motivo quando não dá para usar.
//
// Ligação quebrada é caminho que não existe. Ignorar em silêncio faria a pessoa
// parar no meio do fluxo sem nada em Atividade — a mesma falha muda que o
// `step_ignorado` existe para evitar do lado dos blocos.
export function conferirLigacao(l: unknown): { ligacao?: Ligacao; motivo?: string } {
  if (!l || typeof l !== "object") return { motivo: "ligação não é um objeto" };
  const o = l as Record<string, unknown>;
  if (typeof o.de !== "string" || !o.de) return { motivo: "ligação sem bloco de origem" };
  if (typeof o.para !== "string" || !o.para) return { motivo: "ligação sem bloco de destino" };
  const q = o.quando as Record<string, unknown> | undefined;
  if (!q || typeof q !== "object") return { motivo: "ligação sem condição" };
  if (q.tipo === "sempre" || q.tipo === "senao") return { ligacao: l as Ligacao };
  if (q.tipo === "botao") {
    if (typeof q.botao !== "string" || !q.botao) return { motivo: "ligação de botão sem o botão" };
    return { ligacao: l as Ligacao };
  }
  return { motivo: `condição desconhecida: ${String(q.tipo)}` };
}

// As saídas VÁLIDAS de um bloco, na ordem em que foram gravadas.
//
// A ordem importa em um caso só, e ele está em `ligacaoEscolhida`: havendo mais
// de uma que sirva, ganha a primeira. Fora disso, ordem de ligação não quer
// dizer nada — quem manda é a condição.
export function ligacoesDe(ligacoes: unknown, bloco: string): Ligacao[] {
  if (!Array.isArray(ligacoes)) return [];
  const saidas: Ligacao[] = [];
  for (const bruta of ligacoes) {
    const { ligacao } = conferirLigacao(bruta);
    if (ligacao && ligacao.de === bloco) saidas.push(ligacao);
  }
  return saidas;
}

// O SEGUINTE. É a seta `sempre` que sai deste bloco, e nada mais.
//
// ELA SUBSTITUI `indice + 1`, e essa é a mudança inteira da Tarefa 3b. "O
// seguinte" já foi a posição de baixo no array, e isso funcionava enquanto o
// fluxo era uma fila: a migração (`scripts/ligar-passos-existentes.mjs`) grava
// exatamente a corrente `bloco i → bloco i+1`, então as duas respostas coincidem
// em toda automação já gravada. Elas deixam de coincidir no dia em que o dono
// desenhar um braço de verdade — e aí `indice + 1` responde por um caminho que o
// motor não percorre.
//
// NÃO RECEBE `passos`, e a ausência é o ponto: sem a lista não há índice em que
// somar, então a aritmética de posição não é só desaconselhada aqui dentro, ela
// é impossível de escrever. É a mesma propriedade que `caminhoDoBotao` (mais
// abaixo) tem em relação ao cursor.
//
// Null quando não há seta `sempre` saindo: o caminho ACABOU ali. Quem recebe o
// null trata como fim de fluxo — é o mesmo lugar em que `indice + 1` caía quando
// passava do fim da lista.
//
// Havendo mais de uma `sempre` (lista montada fora do editor), ganha a primeira
// gravada, que é a regra de desempate de `ligacoesDe`.
export function seguinteDe(ligacoes: unknown, bloco: string): string | null {
  const l = ligacoesDe(ligacoes, bloco).find((s) => s.quando.tipo === "sempre");
  return l ? l.para : null;
}

// DÁ PARA CHEGAR DE UM BLOCO A OUTRO SEGUINDO AS SETAS?
//
// É a peça que a regra do portão (`atravessandoOPortao`, mais abaixo) passou a
// usar no lugar da comparação de índices. A pergunta que ela responde é "o
// destino está DEPOIS do portão no fluxo", e num grafo a única forma de
// responder isso é caminhando.
//
// TODAS AS CONDIÇÕES CONTAM, não só a `sempre`, e a diferença é de segurança:
// um bloco alcançável a partir do portão por um braço de `botao` é tão "depois
// do portão" quanto um alcançável pela `sempre`. Contar só a `sempre` deixaria
// de fora exatamente o caso que esta tarefa existe para fechar — a seta de um
// botão que salta por cima do portão.
//
// NÃO RECEBE `passos`, pelo mesmo motivo de `seguinteDe`: alcançabilidade é
// pergunta sobre as SETAS, e a lista de blocos não participa dela. Sem `passos`
// aqui dentro não há índice a comparar, e a comparação posicional que esta
// tarefa removeu não tem como voltar por esta porta.
//
// A CONSEQUÊNCIA disso, dita porque ela é escolha e não descuido: uma ligação
// que atravessa um id que NÃO está na lista conta como caminho. `interpretar`
// pararia naquele bloco inexistente, então é um caminho que a execução não
// percorre — e contá-lo faz esta função dizer "há portão" onde a execução não
// chegaria. O erro cai para o lado de atravessar um portão a mais, que custa uma
// consulta à Meta; o outro lado custa o link entregue a quem não segue.
//
// `de` e `para` IGUAIS devolvem true só quando há um anel que volta ao ponto de
// partida — a busca começa nas saídas de `de`, não nele mesmo. Quem chama trata
// o caso "portão é o próprio destino" antes, e o porquê está lá.
//
// O CONJUNTO DE VISITADOS é o que segura o anel, e ele basta: cada bloco entra
// na fila uma vez só, então a busca termina em no máximo tantos passos quantas
// forem as ligações válidas. Não precisa de teto como `interpretar` — o teto de
// lá existe porque a caminhada de ENTREGA pode legitimamente repetir bloco (um
// menu que volta a si mesmo), e aqui repetir não acrescenta resposta nenhuma.
//
// `evitar` FECHA UM BLOCO, e é assim que se pergunta "dá para chegar lá SEM
// passar por este". Ele existe para a conferência do portão contornável
// (`conferirLista`, lá embaixo): fechando o portão, o que ainda alcança o link é
// exatamente o caminho que não passa por ele.
//
// FECHA O BLOCO PELA CHEGADA, e não pela saída, e a diferença importa: descartar
// as setas que SAEM dele deixaria a busca entrar no bloco e parar ali, contando
// como "não alcança" um caminho que de fato atravessa o portão. Descartando as
// que CHEGAM, o bloco nunca é pisado, que é o que "sem passar por ele" quer
// dizer. O ponto de partida é a única exceção possível, e quem chama trata dela
// antes — partir do próprio portão é partir de dentro dele.
//
// É O MESMO PARÂMETRO que o BFS independente da varredura
// (`scripts/varredura-portao.mjs`) já tem com o nome `sem`. Os dois continuam
// separados de propósito — a varredura não pergunta ao réu se o crime aconteceu
// —, mas a pergunta que eles respondem é a mesma, e é bom que se pareçam.
export function haCaminho(
  ligacoes: unknown,
  de: string,
  para: string,
  evitar?: string
): boolean {
  const vistos = new Set<string>([de]);
  const fila: string[] = [de];
  while (fila.length) {
    for (const l of ligacoesDe(ligacoes, fila.shift()!)) {
      if (l.para === evitar) continue;
      if (l.para === para) return true;
      if (!vistos.has(l.para)) {
        vistos.add(l.para);
        fila.push(l.para);
      }
    }
  }
  return false;
}

// QUAL LIGAÇÃO O TOQUE ESCOLHE. É a bifurcação em si: `interpretar` caminha
// pela `sempre` sozinha, e é esta função que decide o próximo passo quando
// quem decide é a PESSOA — tocando um botão, ou respondendo por texto.
//
// A REGRA, uma linha por motivo:
//
//   BOTÃO casa com a ligação `{tipo:"botao", botao: <id>}` DAQUELE botão, por
//     ID — não pelo rótulo. O dono reescreve o rótulo de um botão o tempo
//     todo (é texto solto no painel), e trocar o texto exibido não pode
//     trocar o caminho que a pessoa percorre. O ID é gerado uma vez
//     (`novoIdDeBotao`) e nunca muda; é a única coisa nesse botão que o dono
//     não edita.
//   TEXTO cai na `senao`, quando ela existe. É a ligação para quem respondeu
//     digitando em vez de tocar. QUEM PERGUNTA ASSIM É `retomadaDoTexto` (mais
//     abaixo), e só ela — desde a Tarefa 7b, porque até lá esta variante não
//     tinha chamador nenhum em produção e a promessa da spec era só o teste
//     desta função passando. Quando não há `senao`, o null volta e o chamador
//     cai na `sempre`, que é o que ele sempre fez.
//   BOTÃO SEM LIGAÇÃO devolve null, e NÃO cai na `senao` — a `senao` é para
//     quem DIGITOU. Um botão sem destino é defeito de montagem, e desde a
//     Tarefa 5 `conferirLista` o recusa — no ATIVAR, e não no salvar, porque
//     menu pela metade é trabalho normal de quem está desenhando; ligação
//     gravada fora do editor continua podendo chegar quebrada. Mandá-lo para a
//     `senao` esconderia esse defeito atrás de um caminho que não é o dele.
//     ESTE null NÃO É SILÊNCIO, e é `caminhoDoBotao` (mais abaixo) quem o
//     impede de virar um: ela recebe o null desta função e devolve um
//     `motivo`, que o motor grava em Atividade. Sem aquele registro, o
//     argumento acima seria falso — recusar a `senao` para não esconder o
//     defeito e depois não entregar nada, calado, esconde o defeito do mesmo
//     jeito, só por outra porta.
//   HAVENDO MAIS DE UMA que sirva — dado de fora do editor, que a
//     conferência não viu —, ganha a primeira, que é a ordem que
//     `ligacoesDe` já devolve.
export function ligacaoEscolhida(
  ligacoes: unknown,
  deBloco: string,
  oQueAconteceu: { tipo: "botao"; botao: string } | { tipo: "texto" }
): string | null {
  const saidas = ligacoesDe(ligacoes, deBloco);
  const l =
    oQueAconteceu.tipo === "botao"
      ? saidas.find((s) => s.quando.tipo === "botao" && s.quando.botao === oQueAconteceu.botao)
      : saidas.find((s) => s.quando.tipo === "senao");
  return l ? l.para : null;
}

// ---------------------------------------------------------------------------
// AS TRÊS EDIÇÕES DE SETA QUE O QUADRO FAZ. Elas moram aqui, e não no editor,
// pelo mesmo motivo de `conferirLista`: são DECISÕES sobre o grafo, e decisão
// escrita dentro de um componente é decisão sem teste.
//
// AS TRÊS RECEBEM `Ligacao[]` JÁ VÁLIDO, e não `unknown` como `ligacoesDe` e
// `haCaminho`. A diferença é de porta: aquelas leem o que o BANCO tem, e o
// banco não promete forma nenhuma; estas editam a lista que o quadro segura, e
// quem a normaliza na entrada é `ligacoesValidas`, logo abaixo. Tolerar lixo
// aqui dentro seria uma segunda validação, com outra régua, sobre o mesmo dado.
// ---------------------------------------------------------------------------

// A CHAVE DE UMA CONDIÇÃO — a mesma string nos dois lados do editor.
//
// Ela é o id da ALÇA no quadro (`no.tsx` desenha uma alça por condição, e o
// React Flow devolve esse id ao criar a ligação) e é o critério de "duas setas
// para a mesma condição" de `conferirLista`, que a escrevia à mão logo abaixo.
// Uma cópia só, porque as duas perguntas são a mesma: quantas setas saem
// DAQUELA saída do bloco.
//
// O PREFIXO EM `botao:` NÃO É ENFEITE: sem ele, um botão cujo id fosse
// literalmente `sempre` ou `senao` teria a chave de outra condição, e a seta
// dele grudaria na alça errada. `novoIdDeBotao` nunca produz esses dois, mas
// `botoes` pode chegar de fora do painel.
export function chaveDoQuando(q: Quando): string {
  return q.tipo === "botao" ? `botao:${q.botao}` : q.tipo;
}

// A volta de `chaveDoQuando`: o id da alça de onde o gesto partiu vira a
// condição da ligação nova. Null para qualquer coisa que não seja uma das três
// formas — o `sourceHandle` do React Flow é `string | null | undefined`, e uma
// alça sem id não decide caminho nenhum.
export function quandoDaChave(chave: unknown): Quando | null {
  if (chave === "sempre") return { tipo: "sempre" };
  if (chave === "senao") return { tipo: "senao" };
  if (typeof chave !== "string" || !chave.startsWith("botao:")) return null;
  const botao = chave.slice("botao:".length);
  return botao ? { tipo: "botao", botao } : null;
}

// O QUE O QUADRO SEGURA, a partir do que o banco tem.
//
// Descarta o que `conferirLigacao` recusa, e NADA MAIS. A diferença para
// `passosDoBanco` (app/automacoes/[id]/page.tsx), que se recusa a descartar
// bloco por conteúdo, é que ali existe um nó a desenhar e um dono a consertá-lo:
// o bloco quebrado aparece na tela, `conferirLista` acende a frase, e o salvar
// trava até alguém resolver. Uma ligação quebrada não tem nó, não tem painel e
// não tem gesto que a conserte — `ligacoesDe` já a ignora, então o motor
// caminha hoje exatamente como caminhará depois de ela sumir.
//
// A LIGAÇÃO QUE APONTA PARA UM BLOCO QUE NÃO EXISTE PASSA, e a permissão é
// deliberada: ela é VÁLIDA na forma, `haCaminho` a percorre, e é `conferirLista`
// quem fala sobre o que ela causa. Descartá-la aqui mudaria a resposta da
// conferência no primeiro salvamento, calada.
export function ligacoesValidas(ligacoes: unknown): Ligacao[] {
  if (!Array.isArray(ligacoes)) return [];
  const boas: Ligacao[] = [];
  for (const bruta of ligacoes) {
    const { ligacao } = conferirLigacao(bruta);
    if (ligacao) boas.push(ligacao);
  }
  return boas;
}

// LIGAR: a seta nova SUBSTITUI a que já saía daquela alça.
//
// Não é conveniência — é a única regra que não produz, com um gesto normal, um
// estado que o próprio salvar recusa. `conferirLista` trata duas setas da mesma
// condição para destinos diferentes como ERRO DE SALVAR ("só a primeira é
// percorrida"), e uma alça é um ponto só na tela: arrastar dela de novo é dizer
// "o caminho daqui passa a ser este", não "somei um segundo caminho".
//
// A seta trocada SOME DA TELA no mesmo render, então a substituição não é
// silenciosa: o desenho é o retrato do dado.
//
// Ela vai para o FIM da lista, e a posição importa em um caso só — o desempate
// de `ligacoesDe`, que fica com a primeira. Como não sobra nenhuma outra com
// esta condição, não há desempate a fazer.
export function ligar(ligacoes: Ligacao[], de: string, quando: Quando, para: string): Ligacao[] {
  const chave = chaveDoQuando(quando);
  const restantes = ligacoes.filter(
    (l) => l.de !== de || chaveDoQuando(l.quando) !== chave
  );
  return [...restantes, { de, quando, para }];
}

// APAGAR UM BLOCO APAGA AS SETAS QUE ENTRAM E SAEM DELE.
//
// Sem isto, apagar um bloco deixaria ligações apontando para um id que não
// existe mais: nada as desenha (não há nó), `conferirLista` continua as vendo, e
// `interpretar` para no bloco inexistente. O dono ficaria com um fluxo que morre
// num lugar que a tela não mostra.
//
// AS DUAS PONTAS, e não só as de saída: a seta que CHEGAVA nele é a que
// deixaria o bloco anterior com um caminho para lugar nenhum.
//
// ELA SOZINHA NÃO DÁ A GARANTIA ACIMA, e a ressalva não é teórica: ela vale
// para o bloco cuja identidade é o `id`. Para bloco SEM `id` a identidade É a
// POSIÇÃO (`identidadeDoPasso`), então apagar um bloco RENOMEIA todos os que
// vêm depois dele, e as setas que os citavam passam a citar o vizinho — ou
// ninguém. Quem fecha esse caso é `desligarERenumerar`, logo abaixo, e é ela
// que o editor chama; esta continua sendo a metade "apaga as duas pontas".
export function desligarBloco(ligacoes: Ligacao[], bloco: string): Ligacao[] {
  return ligacoes.filter((l) => l.de !== bloco && l.para !== bloco);
}

// APAGAR UM BOTÃO APAGA A SETA DELE. É a metade do gesto do painel (Tarefa 7)
// que não mexe na lista de blocos.
//
// SEM ISTO A LIGAÇÃO FICA ÓRFÃ, e o estrago é o OPOSTO do que o plano desta
// tarefa previa. Ele dizia que a órfã "faria a conferência acusar um botão que
// não existe mais", e isso está MEDIDO E É FALSO: a regra de BOTÃO SEM DESTINO
// (`conferirLista`) caminha da lista de `botoes` para as setas, e não ao
// contrário — botão apagado não é botão, e nenhuma regra desta função olha uma
// ligação de `botao` procurando o botão dela. A conferência fica CALADA sobre a
// sobra.
//
// O QUE ELA FAZ DE FATO É APAGAR UM ERRO VERDADEIRO, e por isso a órfã é pior
// do que uma sobra inofensiva. `haCaminho` conta TODAS as condições, então a
// seta do botão apagado continua valendo como caminho para o BLOCO INALCANÇÁVEL
// — que é erro de ativar. Medido, com `[menu(op_a), dois, tres]`, a seta de
// `op_a` para `dois` e uma órfã de `op_b` (que não está mais no menu) para
// `tres`:
//
//   COM a órfã .. `conferirLista` devolve só o aviso do menu de um botão só.
//   SEM a órfã .. devolve o mesmo aviso MAIS "Nenhuma seta chega neste bloco a
//                 partir do começo do fluxo, então ele nunca é entregue",
//                 sobre `tres`.
//
// Ou seja: deixando a órfã, o bloco que ficou solto some da conferência, e o
// dono publica um fluxo com um pedaço que ninguém alcança. `haCaminho` também
// responde `true` para `tres` com a órfã e `false` sem ela — a diferença inteira
// vem dela.
//
// E O DESENHO MENTIA JUNTO, até esta onda: `indiceDaAlca` devolvia a PRIMEIRA
// alça para a condição sem alça, e a seta órfã era desenhada saindo do PRIMEIRO
// botão do menu — dois caminhos do mesmo ponto, um deles de um botão que não
// existe. Hoje ela ganha uma alça própria, rotulada "botão apagado"
// (`alcasDoQuadro`, app/automacoes/editor/modelos.ts), e é por isso que APAGÁ-LA
// aqui continua sendo o gesto certo e não uma correção de desenho: o que a órfã
// estraga é a CONFERÊNCIA, acima — `ligacaoEscolhida` casa por id, nenhum toque
// produz aquele id, e ela segue valendo como caminho para o bloco inalcançável.
//
// DUAS SETAS DO MESMO BOTÃO somem juntas, e não só a primeira: a forma é
// produzível fora do editor, `conferirLista` a acusa como "duas setas saindo
// para blocos diferentes", e deixar a segunda para trás faria o gesto consertar
// o desenho e não o erro.
//
// SÓ AS DE SAÍDA DAQUELE BOTÃO, e nada mais. As setas que CHEGAM no bloco não
// têm nada com o botão que saiu — quem apaga as duas pontas é `desligarBloco`,
// acima, e ela responde a outro gesto (o bloco inteiro sumiu).
export function desligarBotao(ligacoes: Ligacao[], bloco: string, botao: string): Ligacao[] {
  return ligacoes.filter(
    (l) => !(l.de === bloco && l.quando.tipo === "botao" && l.quando.botao === botao)
  );
}

// APAGAR A `senao` DE UM BLOCO. É a outra metade do gesto de apagar botão, e ela
// só é chamada quando o botão apagado era o ÚLTIMO — quando o bloco deixou de
// ter a alça do "digitou".
//
// SEM ELA, DOIS CLIQUES NO ✕ REPRODUZEM O MASCARAMENTO QUE `desligarBotao`
// ACABOU DE CONSERTAR, e a medida é a mesma daquela função, com a `senao` no
// lugar da órfã de botão. Lista `[dm "oi", menu(botoes: []), tres]`, ligações
// `sempre(oi→menu)` e `senao(menu→tres)`:
//
//   COM a `senao` .. `conferirLista` devolve `[]`.
//   SEM ela ....... devolve "Nenhuma seta chega neste bloco a partir do começo
//                   do fluxo, então ele nunca é entregue", sobre `tres`.
//
// `haCaminho` conta TODAS as condições, então a `senao` de um menu que não tem
// mais botão nenhum continua valendo como caminho para o BLOCO INALCANÇÁVEL —
// erro de ativar que some da conferência enquanto ela estiver lá. É o mesmo
// estrago da órfã de botão, pela mesma porta.
//
// E O DESENHO MENTIA JUNTO, e aqui pior do que lá: sem botões, `alcasDeSaida`
// (app/automacoes/editor/modelos.ts) devolve a ALÇA DE CONTINUAÇÃO e mais nada,
// a chave `senao` não era achada e caía na primeira — a seta era desenhada
// saindo da alça da `sempre`, e `seguinteDe(ligacoes, menu)` daquele mesmo bloco
// é null: o quadro prometia uma continuação que o motor não percorre. Hoje ela
// ganha alça própria (`alcasDoQuadro`), e o que sobra para esta função é o
// estrago na CONFERÊNCIA, que é o de cima.
//
// O PREÇO, dito porque é escolha: quem esvazia o menu e põe botões de volta
// perde a seta do "digitou" junto. É o mesmo preço das setas dos botões, e pela
// mesma razão — a alça de onde ela saía deixou de existir.
//
// SEPARADA DE `desligarBotao` E NÃO DENTRO DELA: aquela recebe o botão que saiu
// e responde sobre ele; a pergunta desta é sobre o que SOBROU na lista, e a
// lista não é argumento de nenhuma das duas. Quem tem as duas metades é o gesto
// (`apagarBotao`, app/automacoes/editor/quadro.tsx), e é lá que a pergunta "o
// bloco ainda tem alça de `senao`?" é feita — a `alcasDeSaida`, que é a função
// que DESENHA a alça. Perguntar a ela é o que impede a regra daqui e o desenho
// de discordarem um dia.
//
// NÃO É "APAGAR A `senao` SEMPRE QUE NÃO HÁ BOTÕES": ela apaga a `senao` DAQUELE
// bloco, e só quando chamada. Um bloco que nunca teve botões e tem uma `senao`
// gravada por fora do editor continua com ela, e continua sendo `conferirLista`
// quem fala sobre o que ela causa — como em `ligacoesValidas`.
export function desligarSenao(ligacoes: Ligacao[], bloco: string): Ligacao[] {
  return ligacoes.filter((l) => !(l.de === bloco && l.quando.tipo === "senao"));
}

// APAGAR O BLOCO DE ÍNDICE `indice`: as setas das duas pontas somem E as que
// sobram são RENUMERADAS.
//
// A renumeração é a metade que faltava, e a medida está registrada porque o
// defeito era silencioso de ponta a ponta. Lista sem `id` — toda automação
// anterior à Fase 1b —, três blocos, identidades `["0","1","2"]`, setas
// `0→1` e `1→2`. `desligarBloco` sozinho, apagando o bloco "0", deixava
// `[{de:"1", para:"2"}]` sobre uma lista que agora tem identidades `["0","1"]`:
// a seta SAI do último bloco e VAI para um bloco que não existe. Ela não é
// desenhada (o quadro descarta seta sem os dois nós), passa por
// `ligacoesValidas` (a forma é válida), `conferirLista` só a vê de lado — o
// bloco vira "inalcançável", que é erro de ATIVAR e não trava o salvar — e ela
// é GRAVADA no banco.
//
// COMO A RENUMERAÇÃO É FEITA, e por que não há um `if` de "a lista é
// posicional": o nome novo de cada sobrevivente é `identidadeDoPasso` do mesmo
// bloco no ÍNDICE novo. Bloco COM `id` devolve o mesmo id nos dois índices e
// não entra no mapa — listas com id não pagam nada por esta função. Bloco SEM
// `id` devolve o índice em texto, e é exatamente aí que o nome muda. Numa lista
// MISTA os dois casos convivem sem regra extra, porque a pergunta é feita à
// mesma função que dá a identidade em todo o resto do sistema.
//
// A ORDEM IMPORTA: primeiro apagam-se as setas do bloco que sai (pelo nome
// ANTIGO dele, que é o que está gravado nelas), depois renomeia-se o que sobrou.
// Invertida, o bloco apagado já teria sido renomeado e as setas dele
// sobreviveriam com o nome de outro.
export function desligarERenumerar(
  passos: unknown,
  ligacoes: Ligacao[],
  indice: number
): Ligacao[] {
  const lista = Array.isArray(passos) ? passos : [];
  if (indice < 0 || indice >= lista.length) return ligacoes;

  const sem = desligarBloco(ligacoes, identidadeDoPasso(lista[indice], indice));

  // Só os que vêm DEPOIS do apagado mudam de índice, e só os sem `id` mudam de
  // nome com isso.
  const nomeNovo = new Map<string, string>();
  for (let j = indice + 1; j < lista.length; j++) {
    const antes = identidadeDoPasso(lista[j], j);
    const depois = identidadeDoPasso(lista[j], j - 1);
    if (antes !== depois) nomeNovo.set(antes, depois);
  }
  if (!nomeNovo.size) return sem;

  return sem.map((l) => {
    const de = nomeNovo.get(l.de) ?? l.de;
    const para = nomeNovo.get(l.para) ?? l.para;
    return de === l.de && para === l.para ? l : { ...l, de, para };
  });
}

// APAGAR SETAS PELO ÍNDICE — o gesto que faltava no quadro, e a única saída de
// um estado que o salvar recusa.
//
// Redesenhar uma alça TROCA o destino (`ligar`, acima) e nunca tira a seta.
// Enquanto apagar não existiu, um bloco que devia TERMINAR o fluxo não tinha
// como perder a saída dele, e uma seta desenhada por engano — a que fecha um
// anel de `sempre` é o caso caro — só saía apagando o bloco (perde o conteúdo)
// ou recarregando a página (perde tudo desde o último salvamento).
//
// UMA LISTA DE ÍNDICES E NÃO UM SÓ, e não é generalidade de graça: a seleção do
// quadro é múltipla (a caixa de seleção pega várias setas de uma vez), e apagar
// uma por vez faria o segundo índice apontar para a seta errada assim que o
// primeiro saísse. Aqui todos são resolvidos contra a MESMA lista.
//
// Índice fora da lista é ignorado, pelo mesmo motivo de `partirLigacao`: quem
// chama é um gesto, e uma seta que sumiu entre o apontar e o soltar não é
// motivo para estourar.
export function apagarLigacoes(ligacoes: Ligacao[], indices: number[]): Ligacao[] {
  const fora = new Set(indices);
  return ligacoes.filter((_, i) => !fora.has(i));
}

// PARTIR UMA LIGAÇÃO EM DUAS, com um bloco no meio. É o que soltar um bloco em
// cima de uma seta passou a significar.
//
// Era REORDENAR o array, e reordenar deixou de querer dizer alguma coisa quando
// as setas viraram o fluxo. O gesto continua o mesmo na mão de quem usa; o que
// muda é o dado que ele escreve.
//
// `A -q-> B` vira `A -q-> MEIO` e `MEIO -sempre-> B`. A condição original fica
// na primeira metade — é ela que decide quem entra no desvio — e a segunda é
// sempre uma continuação, porque um bloco recém-posto no meio não pergunta nada.
//
// AS DUAS METADES PASSAM POR `ligar`, e é daí que sai a única sutileza: se o
// bloco do meio JÁ tinha uma seta de continuação, ela é substituída pela nova. O
// contrário produziria duas `sempre` saindo do mesmo bloco, que é ERRO DE
// SALVAR — ou seja, um gesto normal deixaria o dono sem conseguir gravar.
//
// Índice fora da lista devolve a lista como estava: quem chama é o gesto do
// quadro, e uma seta que sumiu entre o apontar e o soltar não é motivo para
// estourar.
export function partirLigacao(ligacoes: Ligacao[], indice: number, meio: string): Ligacao[] {
  const l = ligacoes[indice];
  if (!l) return ligacoes;
  const sem = ligacoes.filter((_, i) => i !== indice);
  return ligar(ligar(sem, l.de, l.quando, meio), meio, { tipo: "sempre" }, l.para);
}

// Valida e normaliza um passo. Devolve o motivo quando não dá para usar.
//
// DOIS textos para a mesma falha, e não um, porque eles têm dois leitores.
//
// `motivo` é técnico e nomeia o campo: ele vai para os `ignorados` de
// `interpretar`, que são diagnóstico — quem os lê está atrás do defeito e
// conhece o código.
//
// `paraODono` é a mesma falha na língua de quem monta a automação, e é o que
// `conferirLista` mostra na tela. Antes a tela mostrava o `motivo` cru, e o dono
// do painel lia "Bloco incompleto: pedir_email sem texto." — nome de tipo
// interno, num painel em que todo o resto fala de "pedido de e-mail".
//
// Os dois saem do MESMO `return` de propósito. Numa tabela à parte, ligada por
// chave, uma falha nova ganharia entrada de um lado e não do outro, e a tela
// voltaria a vazar jargão — ou pior, mostraria a frase de outra falha.
//
// EXPORTADA desde a prévia da conversa (app/automacoes/editor/roteiro.ts).
// `conferirLista` não serve para o que a prévia precisa, e a diferença é de
// significado: ela devolve ERRO para coisas que o motor ENVIA — o `dm` de link
// sem endereço é enviado (e trava o fluxo, que é o motivo do erro) —, enquanto
// a prévia precisa saber exatamente o que `interpretar` IGNORA, para não
// desenhar como mensagem um bloco que nunca sai. Quem responde isso é esta
// função, e o `paraODono` já vem na língua de quem monta a automação.
export function conferir(p: unknown): { passo?: Passo; motivo?: string; paraODono?: string } {
  if (!p || typeof p !== "object") {
    return {
      motivo: "passo não é um objeto",
      paraODono: "Este bloco está corrompido e não vai ser enviado.",
    };
  }
  const o = p as Record<string, unknown>;
  const tipo = o.tipo;

  if (tipo === "dm") {
    if (typeof o.texto !== "string" || !o.texto.trim()) {
      return { motivo: "dm sem texto", paraODono: "Esta mensagem está sem texto." };
    }
    return { passo: p as Passo };
  }
  if (tipo === "esperar") {
    if (typeof o.minutos !== "number" || !Number.isFinite(o.minutos) || o.minutos < 0) {
      return {
        motivo: "esperar com minutos inválido",
        paraODono: "Esta espera está sem um tempo válido em minutos.",
      };
    }
    return { passo: p as Passo };
  }
  if (tipo === "resposta_publica") {
    if (!Array.isArray(o.textos) || !o.textos.length) {
      return {
        motivo: "resposta pública vazia",
        paraODono: "Esta resposta pública não tem nenhum texto para publicar.",
      };
    }
    return { passo: p as Passo };
  }
  if (tipo === "reagir_story") {
    if (typeof o.emoji !== "string" || !o.emoji) {
      return { motivo: "reagir_story sem emoji", paraODono: "Este coraçãozinho está sem emoji." };
    }
    return { passo: p as Passo };
  }
  // O RÓTULO DO BOTÃO NÃO É CONFERIDO AQUI, e a ausência é DECISÃO MEDIDA — não
  // esquecimento. Quem recusa o portão sem rótulo é `conferirLista`, lá embaixo,
  // e o motivo é o que este bloco de comentário existe para registrar.
  //
  // O buraco é real e está medido: com `botao_label: ""`, `resolverFollow`
  // (lib/engine.ts) enfileira `quick_reply_label: ""`, e `lib/queue-drain.ts`
  // exige `quick_reply_label && quick_reply_payload` — falso — e cai no `else`
  // de texto puro. A mensagem sai SEM BOTÃO NENHUM, e o fluxo para no portão.
  //
  // A pergunta é ONDE fechá-lo, e as duas respostas não custam a mesma coisa:
  //
  //   RECUSANDO AQUI, o portão vira bloco inválido, e `interpretar` IGNORA bloco
  //     inválido — ele segue o laço e enfileira TUDO o que vem depois, o link
  //     inclusive. `indiceDoPortao` deixa de achá-lo, então `atravessandoOPortao`
  //     não marca passagem nenhuma, e `passoEsperado` devolve undefined no
  //     cursor. Somadas, essas três fazem exatamente o que esta fase gastou duas
  //     ondas para impedir: ENTREGAR O LINK A QUEM NÃO SEGUE. Calado, sem erro,
  //     sem linha em Atividade.
  //
  //   NÃO RECUSANDO, o portão continua portão: `interpretar` para nele,
  //     `resolverFollow` reconsulta a Meta, e ninguém passa sem seguir. O preço
  //     é a pessoa receber o pedido sem botão para tocar — e ele NÃO é uma
  //     parada sem saída: o ramo de texto de lib/engine.ts leva
  //     `retomadaDoTexto` a devolver o próprio portão, então quem seguir e
  //     mandar qualquer mensagem atravessa. É armadilha de usabilidade, não
  //     entrega indevida.
  //
  // Ignorar o portão é PIOR do que não conseguir atravessá-lo: a segunda deixa a
  // promessa central do produto de pé, a primeira a quebra. Por isso a recusa
  // mora em `conferirLista`, que TRAVA O SALVAR e nunca muda o que o motor faz
  // com uma lista já gravada.
  //
  // E o alcance de uma lista já gravada é conhecido: o formulário, enquanto
  // existiu, escrevia o rótulo do portão sobre um valor já defaultado, então
  // NENHUMA lista gravada por ele tem portão sem rótulo. Quem produz o caso é o
  // painel do bloco (app/automacoes/editor/painel.tsx), que deixa apagar o
  // campo — e é justamente ele que `conferirLista` barra, travando o salvar.
  if (tipo === "pedir_follow") {
    if (typeof o.texto !== "string" || !o.texto.trim()) {
      return {
        motivo: "pedir_follow sem texto",
        paraODono: "Este pedido de follow está sem texto.",
      };
    }
    return { passo: p as Passo };
  }
  if (tipo === "pedir_email") {
    if (typeof o.texto !== "string" || !o.texto.trim()) {
      return {
        motivo: "pedir_email sem texto",
        paraODono: "Este pedido de e-mail está sem texto.",
      };
    }
    return { passo: p as Passo };
  }
  return {
    motivo: `tipo desconhecido: ${String(tipo)}`,
    paraODono: "Este bloco é de um tipo que o sistema não reconhece e não vai ser enviado.",
  };
}

// A forma do id, e por que ela é conferida em vez de aceita.
//
// A identidade entra na `dedupe_key`. Um id como "2" colidiria com a chave por
// índice de um OUTRO bloco — a chave é a mesma string —, e colisão em
// `dedupe_key` não dá erro: o `on conflict do nothing` engole o segundo item e
// a pessoa deixa de receber uma mensagem, sem nada aparecer em lugar nenhum.
// O prefixo `b_` torna isso impossível por construção.
const FORMA_DO_ID = /^b_[0-9a-z]{6,}$/;

// O id de um bloco novo, e ele mora AQUI, coladinho na forma que o valida.
//
// Ele já existiu em três cópias — `app/automacoes/actions.ts`,
// `app/automacoes/editor/modelos.ts` e `scripts/dar-ids-aos-passos.mjs` —, e as
// três carregavam o MESMO defeito: `Math.random().toString(36).slice(2, 10)`
// devolve menos de 6 caracteres quando o sorteio cai num número de
// representação curta (0.5 vira "0.i", e a fatia sai com 1 caractere). Aí
// `FORMA_DO_ID` recusa o id, `identidadeDoPasso` cai no ÍNDICE, e desde a
// Tarefa 4 `conferirLista` acende "identidade inválida" e TRAVA O SALVAR de uma
// automação que a pessoa acabou de montar. Nada disso é cosmético, e sortear
// menos que 6 caracteres é raro, não impossível: é o modo de falhar que só
// aparece em produção, num cliente, uma vez.
//
// Duas cópias viravam dois consertos, e é por isso que agora é uma só. O
// alfabeto é escrito à mão e o comprimento é FIXO em 8: `toString(36)` amarra o
// tamanho da saída à representação decimal do sorteio, e é essa amarra que
// produzia o id curto. Aqui não há o que torcer — 8 caracteres sempre, todos
// dentro do `[0-9a-z]` que `FORMA_DO_ID` exige.
//
// A terceira cópia, a do script `.mjs`, continua sendo uma cópia porque o script
// é JavaScript solto e não importa TypeScript (o motivo está escrito lá, junto
// do regex que ele também repete). Ela foi corrigida do mesmo jeito, e o
// comentário de lá aponta para cá.
//
// Curto de propósito: o id entra na `dedupe_key`, que é uma coluna UNIQUE
// consultada a cada envio. 36^8 é aleatoriedade de sobra para não colidir dentro
// de UMA automação, que é o único escopo em que ele precisa ser único — tudo que
// o consome já é qualificado pelo id da automação.
const ALFABETO_DO_ID = "0123456789abcdefghijklmnopqrstuvwxyz";

export function novoIdDeBloco(): string {
  let id = "b_";
  for (let i = 0; i < 8; i++) {
    id += ALFABETO_DO_ID[Math.floor(Math.random() * ALFABETO_DO_ID.length)];
  }
  return id;
}

// Quem este passo é, para efeito de deduplicação e de cursor.
//
// Com id, é o id: ele acompanha o bloco quando ele é arrastado, e é isso que
// faz reordenar deixar de reenviar mensagem.
//
// Sem id, é o índice — e isso não é remendo. Um bloco gravado antes da Fase 1b
// JÁ tem itens na fila com a chave por índice; devolver o índice é o que faz
// essas chaves continuarem casando. Se devolvesse outra coisa, o primeiro
// deploy reentregaria tudo que já saiu hoje.
export function identidadeDoPasso(passo: unknown, indice: number): string {
  const id = (passo as { id?: unknown } | null | undefined)?.id;
  return typeof id === "string" && FORMA_DO_ID.test(id) ? id : String(indice);
}

// A identidade do bloco que está NESTA posição da lista. Null quando a posição
// não existe.
//
// É a volta de `indiceDoId`, e ela é a ponte entre as duas metades do sistema
// nesta fase: `interpretar` passou a falar em IDENTIDADE, e quem decide de onde
// retomar (`retomadaDoBotao`, `retomadaDoFollow`, `retomadaDoTexto`) ainda fala
// em POSIÇÃO. Enquanto as duas metades convivem, a conversão precisa acontecer
// em algum lugar — e o lugar é aqui, numa função pura com teste, não numa
// expressão solta dentro de `server-only`.
//
// O null NÃO é detalhe defensivo: `destino` pode legitimamente cair além do fim
// da lista (é o `+1` de quem estava parado no último bloco), e antes desta fase
// esse caso era absorvido pelo laço de `interpretar`, que simplesmente não
// iterava. Com a caminhada por identidade não há índice em que não iterar, e
// devolver `String(indice)` para uma posição que não existe seria pior do que
// null: inventaria uma identidade que `indiceDoId` não acha, e o motivo
// registrado falaria de um bloco que nunca esteve lá.
export function identidadeNoIndice(passos: unknown, indice: number): string | null {
  if (!Array.isArray(passos) || indice < 0 || indice >= passos.length) return null;
  return identidadeDoPasso(passos[indice], indice);
}

// O que o portão faz com quem NÃO segue.
//
// A REGRA É UMA SÓ: cinco pedidos por contato, NA VIDA. `pedir` enquanto ainda
// cabe pedido; `soltar` a partir do limite — e soltar é a mudança: antes o
// portão parava de pedir e CONTINUAVA segurando o cursor, o que capturava a
// pessoa sem lhe dar explicação nenhuma. O ramo de texto lê toda mensagem de
// quem está parado num portão como resposta a ele, e `interrompeOFluxo` só cede
// a vez a outra automação quando o passo parado é `dm` — então nem a
// palavra-chave de outra automação a alcançava.
//
// `feitas` são os pedidos JÁ SAÍDOS antes deste, e o chamador
// (`resolverFollow`, lib/engine.ts) o obtém do `returning` do incremento menos
// um. Com `maximo` = 5 os valores são estes, percorridos e conferidos:
// `returning` 1 a 5 dão `feitas` 0 a 4 e mandam pedido; `returning` 6 dá
// `feitas` 5 e é o PRIMEIRO que solta. Cinco pedidos, soltura no sexto.
//
// NÃO HÁ CONTADOR POR DIA, e a ausência é decisão medida: um contador que
// reinicia todo dia nunca chega ao limite para quem manda uma mensagem por dia,
// então a soltura nunca aconteceria e a pessoa ficaria presa para sempre
// recebendo um DM diário. O contador zera num caso só — quando a pessoa PASSA
// pelo portão (`zerarTentativasFollow`, lib/engine.ts).
//
// Soltar não entrega o link: quem não segue continua sem receber. O que ela
// devolve é a liberdade de ser alcançada por qualquer outra automação — e a
// segunda chance de verdade, que é seguir o perfil: `checkFollowsAccount` roda
// ANTES de o contador ser olhado, então quem seguir depois passa na hora, com o
// contador esgotado ou não.
export function oQuePortaoFaz(feitas: number, maximo: number): "pedir" | "soltar" {
  return feitas < maximo ? "pedir" : "soltar";
}

// Onde, na lista de hoje, está o bloco com esta identidade.
//
// COM ID, a garantia é firme, e é a razão desta fase existir: null quando o
// bloco não existe mais — o dono o apagou —, e reordenar NÃO cai aqui, porque o
// bloco continua na lista e só mudou de lugar. É isso que faz o cursor
// sobreviver à reordenação.
//
// SEM ID a garantia NÃO VALE, e o modo de falhar é o pior possível: a identidade
// É a posição, então ela não acompanha o bloco. Apagar ou inserir na lista faz a
// mesma identidade resolver para OUTRO bloco, calado — não devolve null:
//
//   [ {id:b_aaa}, {sem id: dois}, {sem id: três} ]   identidades: b_aaa, "1", "2"
//   apaga o primeiro:
//   [ {sem id: dois}, {sem id: três} ]               identidades: "0", "1"
//   indiceDoId(lista, "1") → 1                       que agora é "três", OUTRO bloco
//
// Repare que são precisos DOIS blocos sem id para o erro aparecer. Com um só, a
// identidade procurada some da lista e a função devolve null — errado também,
// mas barulhento. É a vizinhança de blocos sem id que troca um pelo outro em
// silêncio, e silêncio é o que custa caro.
//
// Isso importa porque o cursor (Tarefa 2) é montado em cima desta função, e
// retomar do bloco errado é o defeito que a fase anterior gastou duas ondas para
// matar — entregar o link a quem não segue.
//
// O que segura o caso na prática é o DADO, não esta função: o script
// `scripts/dar-ids-aos-passos.mjs` dá id a todo bloco de toda automação já
// gravada, e `blocoNovo` (app/automacoes/editor/modelos.ts) chama
// `novoIdDeBloco` em todo bloco que a paleta cria, `esperar` inclusive. Depois
// disso, lista com bloco sem id não é produzida por caminho nenhum do sistema.
// O teste em tests/steps.test.ts fixa a limitação para ela não voltar em
// silêncio se essa premissa mudar.
export function indiceDoId(passos: unknown, id: string): number | null {
  if (!Array.isArray(passos)) return null;
  for (let i = 0; i < passos.length; i++) {
    if (identidadeDoPasso(passos[i], i) === id) return i;
  }
  return null;
}

// O passo em que o cursor de um contato está parado — validado, e confirmado
// como passo de espera.
//
// Existe porque quem lê o cursor (lib/engine.ts) lê `steps[i]` CRU do banco, e
// confiar no `tipo` sem passar pela mesma validação do interpretador diverge do
// que o fluxo faz: um `pedir_email` sem texto é ignorado por `interpretar` — e
// portanto nunca foi enviado —, mas o ramo do cursor o trataria como pedido de
// e-mail e consumiria a mensagem da pessoa como endereço.
//
// Devolve undefined quando o índice não existe mais, quando o passo não passa
// na validação, ou quando ele não espera resposta nenhuma. Esse último caso é
// cursor obsoleto: a lista foi editada depois de o cursor ser gravado, e não há
// resposta a esperar naquele índice.
export function passoEsperado(passos: unknown, indice: number): Passo | undefined {
  if (!Array.isArray(passos)) return undefined;
  const { passo } = conferir(passos[indice]);
  if (!passo || !esperaResposta(passo)) return undefined;
  return passo;
}

// CAMINHA O GRAFO a partir de `deBloco` e diz o que fazer.
//
// ELA ANDAVA `i++` PELO ARRAY, e essa era a tese antiga: a ordem da lista ERA o
// caminho. Agora quem diz o que vem depois é a ligação `sempre` que sai do bloco
// atual (`ligacoesDe`, acima), e a ordem do array deixa de significar o próximo.
//
// A ORDEM GUARDA EXATAMENTE UM SIGNIFICADO, e ele não mora aqui: `steps[0]` é a
// entrada do fluxo — onde a caminhada começa quando o gatilho dispara. Quem
// afirma isso é o chamador, passando a identidade do primeiro bloco; esta função
// só recebe um ponto de partida e anda. A alternativa considerada — "a entrada é
// o bloco que ninguém aponta" — não serve: um menu que volta para si mesmo tem
// seta chegando na entrada, e o fluxo ficaria sem começo.
//
// O PONTO DE PARTIDA É IDENTIDADE, não índice, e isso não é troca de tipo por
// gosto: com ligações, "a posição 3" não quer dizer nada — nada garante que o
// bloco 3 seja alcançável, nem que ele venha depois do 2. O cursor já guarda
// identidade desde a Fase 1b, então é o argumento que o chamador já tem na mão.
//
// `esperar` NÃO é enfileirado: ele soma no atraso dos passos seguintes. É assim
// que a fila já funciona — cada item carrega o próprio atraso —, então espera
// como passo custa zero mudança no dreno. O atraso acumula ao longo do CAMINHO
// PERCORRIDO, e não da fatia do array: duas esperas em braços diferentes nunca
// se somam, porque a caminhada passa por um braço só.
//
// ---------------------------------------------------------------------------
// LISTA SEM LIGAÇÃO NENHUMA ENTREGA UM BLOCO SÓ, e isto é a consequência mais
// cara desta mudança. Vale escrito porque ela é INVISÍVEL no código:
//
// `ligacoes` tem `default '[]'::jsonb` (lib/db.ts), então toda automação gravada
// antes desta fase chega aqui com a lista de setas VAZIA. O array de `steps`
// continua com os cinco blocos na ordem certa — só que a ordem não é mais o
// caminho, e não há seta nenhuma a seguir. A automação passa a entregar o
// primeiro bloco e parar, sem erro e sem nada em Atividade além do fim normal
// do fluxo.
//
// O que fecha isso é DADO, não código: `scripts/ligar-passos-existentes.mjs
// --aplicar` escreve a corrente `bloco i → bloco i+1` que a ordem já expressava.
// A ordem de implantação é, portanto, obrigatória e nesta sequência:
//
//   1. a coluna `ligacoes` existir no banco (`ensureSchema`, lib/db.ts);
//   2. a migração rodar com `--aplicar`;
//   3. só então este motor entrar no ar.
//
// Inverter 2 e 3 não quebra nada de forma barulhenta — é o pior tipo de falha
// que este arquivo pode produzir. O teste "LISTA SEM LIGAÇÃO NENHUMA ENTREGA UM
// BLOCO SÓ" (tests/steps.test.ts) fixa o comportamento para ele não ser
// descoberto num cliente.
// ---------------------------------------------------------------------------
export function interpretar(passos: unknown, ligacoes: unknown, deBloco: string | null): Resultado {
  const r: Resultado = {
    enfileirar: [],
    pararEm: null,
    ignorados: [],
    cursorNoFim: "limpar",
  };

  // `steps` NÃO É LISTA: é o dado mais quebrado que chega aqui, e por isso ele
  // MANTÉM o cursor, como a ligação pendurada e o teto. O critério inteiro, com
  // o preço, está no comentário de `cursorNoFim` (acima).
  if (!Array.isArray(passos)) {
    r.ignorados.push({ indice: -1, motivo: "a automação não tem lista de passos" });
    r.cursorNoFim = "manter";
    return r;
  }

  // Lista VAZIA tem que dar sinal, e por um motivo que não é simetria: é a
  // única forma de falha do produto que passaria sem deixar rastro nenhum.
  //
  // O laço abaixo simplesmente não itera, e o resultado sai
  // `{enfileirar: [], pararEm: null, ignorados: []}` — indistinguível de uma
  // lista que terminou. O motor então limpa o cursor e ninguém recebe nada,
  // sem uma linha em Atividade dizendo por quê.
  //
  // E não é caso hipotético: `[]` é o `default '[]'::jsonb` da coluna, ou
  // seja, é o que toda automação criada ANTES desta branch teve até alguém
  // salvá-la de novo — e é também o que `criarAutomacao`
  // (app/automacoes/actions.ts) grava numa automação recém-criada, antes de o
  // primeiro bloco ser arrastado.
  //
  // O motivo é próprio, e não o mesmo de "não é lista", porque as duas causas
  // são diferentes: aqui a coluna está íntegra e o conteúdo é que falta.
  if (!passos.length) {
    r.ignorados.push({ indice: -1, motivo: "a automação não tem nenhum passo" });
    return r;
  }

  // SEM BLOCO DE PARTIDA, e a saída é CALADA: nem `ignorados`, nem sinalizador
  // para o chamador registrar. É um fim de fluxo, e o motor limpa o cursor.
  //
  // Ele já saiu de duas formas, e as duas erravam. Como `ignorado` com o motivo
  // "o fluxo não tem por onde começar" ele AFIRMAVA o que não aconteceu, e ainda
  // gastava a janela de 10 minutos que `logEventThrottled` (lib/engine.ts) dá ao
  // tipo `step_ignorado` por automação — a linha benigna suprimia os avisos de
  // passo mal montado de VERDADE. Depois virou `fluxo_sem_partida`, tipo e
  // janela próprios, e o defeito que sobrou é o que fecha a questão:
  //
  // ELE DISPARA SE E SÓ SE O CAMINHO ACABOU. O null chega aqui de `seguinteDe`
  // (acima) — o bloco de onde a pessoa saiu não tem seta `sempre` — ou de
  // `identidadeNoIndice` sobre uma posição que não existe. Era o `indice + 1` do
  // último bloco antes da Tarefa 3b, e é o mesmo fim de caminho. Isso junta três
  // casos que o payload não separa: o último bloco era `pedir_email` e o e-mail
  // foi capturado (fim CERTO, e a forma mais comum de terminar um fluxo de
  // captura); era uma `dm` de resposta rápida cujo botão não tem destino; era um
  // `pedir_follow` e quem seguiu não recebeu nada. O primeiro gravaria linha em
  // toda conta saudável, e uma linha que aparece em operação normal treina o
  // dono a ignorar Atividade.
  //
  // Os outros dois são diagnóstico de verdade, e o lugar deles NÃO é o tempo de
  // entrega: são defeitos de MONTAGEM, que a conferência da automação pega no
  // salvar ou no ativar — quando o dono está com o editor aberto e pode
  // consertar. Avisar na entrega é avisar tarde e para a pessoa errada.
  if (deBloco === null) return r;

  let atrasoSegundos = 0;
  let atual: string = deBloco;

  // O TETO CONTA PASSOS DA CAMINHADA, não blocos da lista, e a diferença é o
  // ponto: uma junção legítima faz dois braços chegarem ao mesmo bloco, mas UMA
  // caminhada passa por ele uma vez só — quem passa duas vezes está num anel.
  // Contar visitas em vez de manter um conjunto de visitados é deliberado: o
  // conjunto PROIBIRIA a volta, e a volta é padrão legítimo ("menu → opção →
  // volta ao menu"), só que ela sempre atravessa uma parada. O teto deixa a volta
  // acontecer e só interrompe o que não para nunca.
  for (let voltas = 0; voltas < TETO_DE_PASSOS; voltas++) {
    const i = indiceDoId(passos, atual);

    // Uma ligação pode apontar para um id que sumiu — o dono apagou o bloco e a
    // seta que chegava nele ficou. PARA em vez de estourar, e registra: seguir
    // não há para onde, e o silêncio esconderia um fluxo cortado no meio.
    //
    // NA PRIMEIRA VOLTA A CAUSA É OUTRA, e o motivo tem que dizer qual: aqui
    // `atual` ainda é o bloco de partida, e quem o nomeou foi o CHAMADOR — não
    // há ligação nenhuma no caminho a acusar. Culpar a ligação seria afirmar o
    // que esta função não sabe.
    if (i === null) {
      r.ignorados.push({
        indice: -1,
        motivo: voltas
          ? `a ligação aponta para um bloco que não existe: ${atual}`
          : `o bloco de partida não está na lista: ${atual}`,
      });
      // O cursor fica como está nos dois casos: a lista existe, o bloco em que
      // a pessoa parou quase sempre continua nela, e o que quebrou foi o
      // caminho até aqui. Ver `cursorNoFim`, acima.
      r.cursorNoFim = "manter";
      return r;
    }

    const { passo, motivo } = conferir(passos[i]);

    if (!passo) {
      // Bloco inválido é ignorado, mas a CAMINHADA SEGUE pela seta que sai dele:
      // a ligação é do bloco, não do conteúdo dele, e cortar o caminho aqui
      // perderia tudo o que vem depois por causa de um texto em branco.
      r.ignorados.push({ indice: i, motivo: motivo! });
    } else if (passo.tipo === "esperar") {
      atrasoSegundos += passo.minutos * 60;
    } else {
      r.enfileirar.push({ passo, indice: i, atrasoSegundos });
      if (esperaResposta(passo)) {
        r.pararEm = atual;
        return r;
      }
    }

    // SÓ a `sempre` move a caminhada sozinha. `botao` e `senao` são respostas de
    // alguém, e quem as case com o toque é `ligacaoEscolhida` (acima) — seguir
    // uma delas aqui seria entregar o braço de uma pergunta que ninguém
    // respondeu.
    //
    // A pergunta é feita a `seguinteDe` (acima), e não respondida de novo aqui:
    // é a MESMA pergunta que as retomadas fazem desde a Tarefa 3b, e ela existe
    // num lugar só para as duas metades nunca discordarem sobre o que é "o
    // seguinte".
    const seguinte = seguinteDe(ligacoes, atual);
    if (seguinte === null) return r;
    atual = seguinte;
  }

  // BATEU NO TETO: NADA É ENTREGUE, e o descarte é o ponto desta linha.
  //
  // A caminhada chegou aqui com até `TETO_DE_PASSOS` ações montadas, e devolvê-las
  // fazia o motor chamar `enfileirarPasso` cem vezes DENTRO do webhook que a Meta
  // reenvia por 36 horas. Mensagem repetida não saía — a `passoKey` colapsa as
  // ações do mesmo bloco no mesmo dia —, mas cada uma é uma escrita e uma
  // latência, pagas por um caminho que a própria função acabou de declarar
  // quebrado. Cem ações que não deviam ser executadas custam mais do que zero.
  //
  // E o que fica no lugar não é silêncio: o motivo abaixo vira linha em
  // Atividade, e o cursor não é tocado — a pessoa continua exatamente onde
  // estava, e um anel arrumado no editor volta a andar dali.
  r.enfileirar = [];
  r.cursorNoFim = "manter";
  r.ignorados.push({
    indice: -1,
    motivo: `o fluxo passou de ${TETO_DE_PASSOS} blocos e foi interrompido: há uma volta no caminho`,
  });
  return r;
}

// Existe um anel de ligações `sempre` neste fluxo?
//
// A DISTINÇÃO QUE DECIDE A REGRA, e ela é a razão de esta função olhar SÓ as
// `sempre`:
//
//   CICLO QUE PASSA POR UMA PARADA É LEGÍTIMO, e é um dos padrões mais úteis que
//     a ramificação traz: "menu → opção A → volta ao menu". Cada volta custa um
//     toque da pessoa, e acusar isso recusaria o fluxo que o produto existe para
//     permitir.
//
//     QUAL DAS DUAS GUARDAS SEGURA ESSE ANEL DEPENDE DE COMO O MENU FOI MONTADO,
//     e vale dito porque a versão anterior deste comentário afirmava sempre a
//     mesma guarda. ANTES DA TAREFA 4, um menu de `botoes` sem `botao_label` não
//     era parada: nada no sistema entregava vários botões, `envioDaDm` o mandava
//     como texto puro e `esperaResposta` dizia não. Quem segurava o anel nesse
//     caso era só o FILTRO DE CONDIÇÃO — as setas que saem do menu para as
//     opções são `botao`, e não `sempre`, então não há `sempre` a seguir.
//     DESDE A TAREFA 4 a PARADA também trabalha nesse caso: `envioDaDm`
//     reconhece `botoes` e `esperaResposta` para no menu sem rótulo nenhum, então
//     as duas guardas seguram esse anel ao mesmo tempo, e nenhuma precisa mais
//     bastar sozinha. As duas continuam medidas uma a uma em
//     tests/steps.test.ts, e o comportamento é o mesmo nos dois casos: `false`.
//   CICLO SÓ DE `sempre` É INFINITO. Nada nele espera resposta, então nada
//     interrompe a caminhada: ela anda até o teto a cada disparo, e o dono não
//     tem como descobrir por quê olhando a tela.
//
// É por isso que a caminhada aqui para em toda PARADA DURA: um caminho que
// atravessa uma parada dessas não é um caminho que a execução percorre de uma
// vez, e ele não pode fechar anel nenhum.
//
// ---------------------------------------------------------------------------
// PARADA DURA, E NÃO `esperaResposta`, E ISSO É A CORREÇÃO DA TAREFA 5.
//
// A caminhada quebrava em `esperaResposta`, e `esperaResposta` diz sim ao
// PORTÃO — `pedir_follow` e `pedir_email`. Só que o portão NÃO segura anel
// nenhum: quem o destrava não é a pessoa, é a própria execução. Medido pela
// revisão da Tarefa 3b, com `passos: [pedir_follow G, dm X]` e as setas
// `G --sempre--> X --sempre--> G`: esta função devolvia FALSE e o motor deu
// 201 VOLTAS antes de a medição ser interrompida por teto próprio.
//
// O MECANISMO, e ele é pior do que travar: em `executarFluxo` (lib/engine.ts) o
// ramo `pedir_follow` faz `return executarFluxo(…)` quando `resolverFollow`
// devolve "passou", e o ramo `pedir_email` faz o mesmo quando o endereço já é
// conhecido. Os dois estão dentro de uma `async`, então a recursão NÃO estoura a
// pilha — ela simplesmente nunca retorna. O webhook fica pendurado, e a Meta
// reenvia o evento por 36 horas. O comentário do ramo `pedir_email` de lá já
// nomeava este anel como "o único laço infinito que existe nessa vizinhança" e
// o registrava para esta tarefa.
//
// A LINHA CERTA, então, é a mesma de `contarParadasDuras` (logo abaixo), e por
// isso as duas perguntam à mesma função: quem interrompe uma volta é a `dm` que
// espera, porque só o toque de uma PESSOA a destrava. Portão a execução
// reavalia sozinha — reconsulta a Meta, pula o e-mail já conhecido —, e por
// isso ele não interrompe volta nenhuma.
//
// O QUE NÃO MUDOU: um anel que atravessa um menu, ou uma resposta rápida,
// continua devolvendo `false`. É o padrão legítimo "menu → opção → volta ao
// menu", e cada volta dele custa um toque.
// ---------------------------------------------------------------------------
//
// PERCORRE A PARTIR DE CADA BLOCO, e não só da entrada: um anel pendurado num
// braço que a entrada não alcança hoje trava do mesmo jeito no dia em que uma
// seta chegar nele — e o dono está justamente montando essas setas quando esta
// conferência roda.
export function temCicloDeSempre(passos: unknown, ligacoes: unknown): boolean {
  if (!Array.isArray(passos)) return false;

  for (let i = 0; i < passos.length; i++) {
    const vistos = new Set<string>();
    let atual: string | null = identidadeDoPasso(passos[i], i);

    while (atual !== null) {
      // Achou o mesmo bloco duas vezes NO MESMO CAMINHO: é anel. O conjunto é
      // por caminhada, e não compartilhado entre as partidas, porque encontrar o
      // mesmo bloco a partir de duas entradas diferentes é junção, não ciclo.
      if (vistos.has(atual)) return true;
      vistos.add(atual);

      const j = indiceDoId(passos, atual);
      if (j === null) break;

      const { passo } = conferir(passos[j]);
      if (passo && paradaDura(passo)) break;

      atual = seguinteDe(ligacoes, atual);
    }
  }

  return false;
}

// Quantos passos da lista PARAM o fluxo de vez.
//
// Só a `dm` que espera entra nesta conta — resposta rápida OU `botoes`, desde a
// Tarefa 4, porque as duas passam pela mesma pergunta em `esperaResposta` — e a
// distinção não é decorativa: `pedir_follow` e `pedir_email` são portões que a
// própria execução reavalia (o portão reconsulta a Meta; o pedido de e-mail é
// pulado quando o endereço já é conhecido), então o fluxo pode atravessá-los
// sozinho. A `dm` que espera não: nada além do toque da pessoa a destrava.
//
// Passo inválido não conta, pelo mesmo motivo de `passoEsperado`: `interpretar`
// o ignora, então ele nunca foi enviado e nunca parou nada.
function contarParadasDuras(passos: unknown[]): number {
  let n = 0;
  for (const p of passos) {
    const { passo } = conferir(p);
    if (passo && paradaDura(passo)) n++;
  }
  return n;
}

// A PERGUNTA ACIMA, ISOLADA, porque ela tem DOIS donos e eles não podem
// discordar.
//
// `contarParadasDuras` (acima) a usa para dizer de onde o fallback pode partir;
// `temCicloDeSempre` (acima) a usa para dizer o que interrompe uma volta. As
// duas querem a mesma coisa — "isto só destrava com um toque de PESSOA" —, e
// enquanto foram duas expressões, uma delas estava escrita errado: a de
// `temCicloDeSempre` era `esperaResposta` PELADA, sem a guarda `p.tipo === "dm"`
// — quatro tokens de diferença, e não uma palavra —, e `esperaResposta` inclui
// o portão.
//
// O QUE ESSA DIFERENÇA EXPLICA, com a medida certa: por que a FUNÇÃO calava. Com
// o portão contando como parada, a caminhada de `temCicloDeSempre` quebrava
// nele e o anel `[pedir_follow, dm]` não fechava — ela respondia `false` para um
// anel de verdade. NÃO explica por que o anel passava no salvar: até a Tarefa 5
// o salvar NÃO CONSULTAVA esta função, que passou três tarefas sem um único
// chamador fora dos testes (é o que o comentário do teto de passos e o da
// chamada em `conferirLista` registram). Fosse a expressão certa desde o
// começo, o anel teria passado no salvar do mesmo jeito — não havia quem
// perguntasse.
//
// A REGRA, e o porquê do recorte em `dm`: `pedir_follow` e `pedir_email` são
// portões que a PRÓPRIA EXECUÇÃO reavalia — o portão reconsulta a Meta e segue
// sozinho quando a pessoa já segue; o pedido de e-mail é pulado quando o
// endereço já é conhecido. A `dm` que espera não tem nada disso: nada além do
// toque a destrava.
function paradaDura(p: Passo): boolean {
  return p.tipo === "dm" && esperaResposta(p);
}

// O índice do PRIMEIRO portão de follow da lista. Null quando não há nenhum.
//
// Existe para o toque em "Já sigo!" ter um ponto de partida quando o cursor não
// serve — e o ponto de partida afirmável, nesse caso, é o portão: o payload
// `FOLLOW:<id>` só existe porque o portão daquela automação foi entregue, então
// o toque AFIRMA onde a pessoa está.
//
// Sem isto, o motor caía no zero, e o zero era inútil para toda lista que o
// formulário gravou: a boas-vindas vinha sempre antes do portão e sempre com
// rótulo e sem url (`esperaResposta` → parada dura), então `interpretar` a
// partir do zero parava NELA e o portão nunca era alcançado. O toque no botão
// não fazia nada. Essas listas continuam no banco, e o quadro produz outras
// iguais sempre que a boas-vindas vier na frente.
//
// Passo inválido não conta, pela mesma regra de `contarParadasDuras` e
// `passoEsperado`: `interpretar` o ignora, logo ele nunca foi enviado e não é
// portão nenhum. Retomar de um `pedir_follow` sem texto entregaria a quem não
// segue tudo o que vem depois dele.
//
// COM MAIS DE UM PORTÃO, o primeiro vence, e o preço precisa estar dito — mas
// ele encolheu, e a data importa. O payload `FOLLOW:<automação>` nomeava só a
// automação: quem estava parado no SEGUNDO portão e tocava em "Já sigo!" sem
// cursor desta automação retomava no primeiro, e tudo o que houvesse entre os
// dois era reentregue. Desde a Fase 1b o payload leva o BLOCO junto
// (`FOLLOW:<automação>:<bloco>`), e o toque nomeia o portão em que a pessoa
// tocou — `retomadaDoFollow` acha aquele bloco e nem chega aqui.
//
// Esta função continua sendo o ponto afirmável dos casos em que o bloco não
// resolve, e todos eles são reais e permanentes: botão entregue ANTES da Fase 1b
// (que vive na conversa para sempre), e botão cujo bloco não está mais na lista.
// Nesses, com dois portões, o primeiro ainda vence e a reentrega descrita acima
// ainda vale. Nenhuma lista gravada pelo formulário chegou a isso — ele emitia
// um portão só —, e o quadro deixa arrastar quantos o dono quiser: quem o
// impede de gravar é `conferirLista`, lá embaixo, com ERRO no segundo portão.
// Continua alcançável por lista escrita fora do editor.
export function indiceDoPortao(passos: unknown): number | null {
  if (!Array.isArray(passos)) return null;
  for (let i = 0; i < passos.length; i++) {
    const { passo } = conferir(passos[i]);
    if (passo && passo.tipo === "pedir_follow") return i;
  }
  return null;
}

// O cursor, como ele sai do banco: qual bloco e de qual automação.
//
// Recebe os dois porque um sem o outro não quer dizer nada — o id é único
// dentro de UMA automação, e o mesmo id pode existir em outra.
export type Cursor = { passoId: string | null; automationId: string | null };

// O BLOCO do cursor, mas SÓ quando ele é desta automação. Null nos demais
// casos — inclusive quando existe um cursor, de outra.
//
// Veio de lib/engine.ts pelo mesmo motivo de `retomadaDoFallback`: é decisão
// pura, e ela segura o bloqueador mais grave desta onda — a identidade só é
// única dentro de UMA lista, e cada automação tem a sua. Aplicar o cursor de B à
// lista de A pula passos de A (o portão de follow inclusive, entregando o link a
// quem não segue) ou aponta para bloco nenhum.
//
// Guardar o BLOCO em vez da posição não dispensa esta conferência, e chega a
// aumentar a chance de ela ser necessária: a identidade de um bloco sem id é o
// índice em texto (`identidadeDoPasso`), então o cursor "1" de B casa com o
// segundo bloco de A sem nada acusar. Para bloco com id o encontro é
// improvável, mas ele não é impossível por construção — nada impede a mesma
// automação ser duplicada com os ids dentro.
//
// Recebe o cursor já lido do banco, e não o contato inteiro, para não arrastar
// o tipo `Contact` (lib/db.ts, `server-only`) para dentro deste arquivo.
//
// Quem chama decide o que fazer com o null, e a resposta não é a mesma nos dois
// ramos: o toque numa resposta rápida (`AUTO:`) não afirma posição nenhuma e
// começa do zero; o toque no "Já sigo!" (`FOLLOW:`) afirma o portão, e usa
// `indiceDoPortao`.
export function cursorDesta(cursor: Cursor, automationId: string): string | null {
  return cursor.automationId === automationId ? cursor.passoId : null;
}

// O que um botão de resposta rápida carrega: de qual automação ele é, de qual
// BLOCO (desde a Fase 1b), e — desde a Tarefa 3 — de qual BOTÃO daquele bloco,
// para bloco com mais de um.
export type Payload = {
  prefixo: "AUTO" | "FOLLOW";
  automationId: string;
  passoId: string | null;
  botaoId: string | null;
};

// Lê o payload de um botão de resposta rápida.
//
// TRÊS FORMAS, e as três são finais — CONVIVEM PARA SEMPRE, não é dívida a
// limpar:
//
//   `AUTO:<automação>`                    entregue antes da Fase 1b
//   `AUTO:<automação>:<bloco>`            entregue a partir dela
//   `AUTO:<automação>:<bloco>:<botão>`    entregue a partir da Tarefa 3
//
// Um botão entregue vive na conversa da pessoa indefinidamente, e ela pode
// tocar nele meses ou anos depois — apagar qualquer um destes ramos quebraria
// todo botão já enviado daquela forma, de uma vez, e o sintoma seria "o botão
// não faz mais nada" sem erro nenhum em lugar algum: `lerPayload` devolveria
// null, `handleMessagingEvent` não faria nada, e não há linha em Atividade
// para um toque que não decide nada. Não há data em que nenhum destes ramos
// pare de ser alcançado.
//
// O `<bloco>` é a identidade que `identidadeDoPasso` dá ao passo, e ela é o id
// (`b_...`) ou o ÍNDICE EM TEXTO, para bloco sem id. Nada aqui confere a forma
// dela de propósito: exigir o prefixo `b_` recusaria o botão de toda automação
// que a migração (`scripts/dar-ids-aos-passos.mjs`) não alcançou. Quem confere
// se aquele bloco ainda existe é `indiceDoId`, na hora de usar.
//
// O `<botão>` é o id que `novoIdDeBotao` dá ao botão (`op_...`), e por isso
// mesmo não tem a barreira do `b_` para conferir — a forma vale, mas não é
// exigida aqui pela mesma razão do bloco: quem confere se aquele botão ainda
// tem ligação é `ligacaoEscolhida`, na hora de usar.
//
// O id da automação é um uuid: ele tem hífen, e não tem dois-pontos. É por isso
// que separar por `:` basta, e que mais de quatro partes é payload que não é
// nosso, e não automação com nome esquisito.
//
// Devolve null para qualquer outra coisa, e isso é obrigatório: o webhook recebe
// o que a Meta manda, e a Meta manda o que o cliente digitou.
export function lerPayload(payload: unknown): Payload | null {
  if (typeof payload !== "string") return null;
  const partes = payload.split(":");
  // Só o limite de cima é conferido aqui. O de baixo ("AUTO" sozinho, uma
  // parte) não precisa de guarda própria: `automationId` sai `undefined`
  // dessa desestruturação, e `!automationId`, logo abaixo, já mata o caso.
  // Uma guarda para `partes.length < 2` seria redundante — nenhuma mutação a
  // mataria, porque ela não decide nada que outra linha já não decida.
  if (partes.length > 4) return null;
  const [prefixo, automationId, passoId, botaoId] = partes;
  if (prefixo !== "AUTO" && prefixo !== "FOLLOW") return null;
  if (!automationId) return null;
  // Bloco em branco (`AUTO:auto-1:` ou `AUTO:auto-1::op_aaaaaa`) não é "bloco
  // vazio", é payload malformado — nos dois casos por igual, porque a forma de
  // quatro partes também precisa saber de qual bloco o botão é. Aceitar poria
  // `passoId: ""` no ramo do payload, e "" não é identidade de bloco nenhum:
  // `indiceDoId` devolveria null e o toque cairia no zero, reenviando a
  // boas-vindas. Como null, ele usa o cursor.
  if (partes.length >= 3 && !passoId) return null;
  // Botão em branco (`AUTO:auto-1:b_men001:`) é o mesmo defeito, uma parte
  // adiante: "" não é identidade de botão nenhuma, e `ligacaoEscolhida` não
  // acharia ligação para ela mesmo que aceitasse.
  if (partes.length === 4 && !botaoId) return null;
  return { prefixo, automationId, passoId: passoId ?? null, botaoId: botaoId ?? null };
}

// A METADE ESCRITORA do payload, coladinha na leitora. TRÊS funções, uma por
// forma que o sistema EMITE — e as três nasceram do mesmo achado.
//
// ELA ESTAVA EM `lib/engine.ts`, dentro de `enfileirarPasso`, como uma
// interpolação solta — e é o achado principal da revisão da Tarefa 4: um
// `server-only` que NENHUM teste desta suíte alcança, e que a varredura
// (`scripts/varredura-portao.mjs`) também não importa. A revisão trocou o id do
// botão pelo id do bloco naquela linha e mediu: 485/485 testes verdes,
// typecheck limpo, varredura idêntica. Ninguém pegava, porque a regra "como se
// escreve um payload" não rodava em harness nenhum.
//
// A MESMA REGRA EM DOIS LUGARES já puniu este projeto três vezes (o id de
// bloco em três cópias, a forma da `dm` em três leitores, a regra do portão no
// motor e na varredura), e aqui a segunda cópia era pior que as outras: ela
// morava justamente do lado que nada executa. `lerPayload` está a três linhas
// daqui, e é o teste de ida e volta entre as duas — escrever e ler de novo —
// que fixa a ordem dos campos.
//
// A ORDEM DOS ARGUMENTOS É A ORDEM DO PAYLOAD, de propósito: automação, bloco,
// botão, na mesma sequência em que `lerPayload` os desestrutura. Trocar dois
// deles ainda compila — os três são `string` —, e é por isso que o teste
// afirma o CONTEÚDO de cada parte, e não só o formato.
//
// NÃO CONFERE NADA, e a ausência é a mesma de `lerPayload`: o `<bloco>` pode
// ser um id `b_...` ou o ÍNDICE EM TEXTO (`identidadeDoPasso`), e exigir
// prefixo aqui recusaria o botão de toda automação que a migração não
// alcançou. O que impede um payload malformado de virar toque perdido é o lado
// leitor, que devolve null.
export function payloadDoBotao(automacaoId: string, blocoId: string, botaoId: string): string {
  return `AUTO:${automacaoId}:${blocoId}:${botaoId}`;
}

// AS OUTRAS DUAS, e elas são o caminho MUITO mais comum: toda resposta rápida
// de um botão só, e todo portão de seguidor. Elas ficaram para trás quando
// `payloadDoBotao` saiu de lib/engine.ts — a correção fechou a forma de quatro
// partes e deixou as de três escritas à mão, como interpolações soltas de
// "AUTO:" e de "FOLLOW:" dentro do mesmo arquivo `server-only` que nenhum teste
// alcança.
//
// O ARGUMENTO DE `payloadDoBotao` VALE PALAVRA POR PALAVRA PARA ELAS, e por
// isso a decisão foi trazê-las junto em vez de registrar exceção: `lerPayload`
// tem teste, elas não tinham nenhum, e a varredura (`scripts/varredura-portao.mjs`)
// forja os toques por outro caminho — ela nunca passava por aquelas linhas.
// Eram a última cópia da regra "como se escreve um payload", e a única sem
// dono escrito.
//
// SÃO DUAS FUNÇÕES, E NÃO UMA COM O PREFIXO POR ARGUMENTO. O prefixo não é
// parâmetro de formatação: ele é a PERGUNTA que o toque responde —
// `AUTO:` é "de onde continuar", `FOLLOW:` é "eu já sigo, confere de novo" —, e
// `handleMessagingEvent` (lib/engine.ts) ramifica por ele. Com o prefixo como
// argumento, trocar um pelo outro no chamador continuaria compilando e o toque
// no portão viraria retomada comum, sem reconsultar a Meta: exatamente a classe
// de troca silenciosa que esta separação existe para impedir.
//
// A FORMA DE DUAS PARTES (`AUTO:<automação>`, sem bloco) NÃO GANHA ESCRITORA,
// e a ausência é decisão: `lerPayload` a LÊ para sempre — botão entregue antes
// da Fase 1b vive na conversa da pessoa —, mas nada neste sistema a EMITE desde
// então. Uma escritora para ela seria um convite a voltar a emiti-la.
export function payloadDaRespostaRapida(automacaoId: string, blocoId: string): string {
  return `AUTO:${automacaoId}:${blocoId}`;
}

export function payloadDoPortao(automacaoId: string, blocoId: string): string {
  return `FOLLOW:${automacaoId}:${blocoId}`;
}

// O limite da Meta para respostas rápidas numa única mensagem.
//
// 13, lido no guia oficial ao implementar a Tarefa 4 (developers.facebook.com/
// documentation/business-messaging/instagram-messaging/features/quick-replies):
// "A maximum of 13 quick replies are supported". Não é o número da memória de
// ninguém — é o que o guia diz.
//
// ELE MORA AQUI, e não no dreno, porque quem corta é a função abaixo. E a
// conferência do editor precisa do MESMO número: desde a Tarefa 5,
// `conferirLista` recusa ATIVAR um bloco com mais botões do que isto, para o
// dono saber antes de publicar em vez de descobrir pelos botões que sumiram da
// mensagem. Um número só, num arquivo que os dois já importam.
export const LIMITE_DE_BOTOES = 13;

// O MENU QUE VAI NA MENSAGEM: pareia rótulos com payloads e corta no limite.
//
// ELA ESTAVA EM `lib/queue-drain.ts`, e sai de lá pelo mesmo motivo de
// `payloadDoBotao`: é `server-only`, nenhum teste a alcança, e a revisão da
// Tarefa 4 mediu isso plantando os rótulos pareados AO CONTRÁRIO dos payloads
// — 485/485 verdes, typecheck limpo, varredura idêntica. Cada botão do menu
// levaria a pessoa ao destino de OUTRO botão, e nada no projeto tinha como
// dizer isso.
//
// RECEBE `unknown` NOS DOIS LADOS de propósito. As duas listas chegam de uma
// coluna `jsonb` (`queue.payload`), que é editável por fora do painel e
// sobrevive a restauração de backup: nada garante que sejam listas, nem que
// tenham o mesmo tamanho, nem que os elementos sejam texto. `enfileirarPasso`
// (lib/engine.ts) sempre escreve as duas do mesmo tamanho — o que esta função
// faz é não DEPENDER disso.
//
// O PAREAMENTO É POR ÍNDICE, e é a única correspondência que existe: o rótulo
// da posição i é o do botão cujo payload está na posição i. Sobra de um lado é
// descartada em silêncio (não há botão a montar sem as duas metades).
//
// PAR SEM RÓTULO É DESCARTADO, e esta é decisão nova da revisão — antes o
// dreno mandava `title: rotulos[i] ?? ""`. O motivo é o mesmo do corte em 13:
// a Meta recusa a mensagem INTEIRA quando uma resposta rápida está malformada,
// e título é campo obrigatório. Um rótulo em branco no meio de cinco botões
// derrubaria os outros quatro E o texto — ninguém receberia nada. Descartando,
// sai o que está inteiro. É também o que o ramo SINGULAR do dreno já fazia
// desde sempre (`quick_reply_label && quick_reply_payload`, senão texto puro):
// o plural é que não exigia nada.
//
// E O DESCARTE NÃO É CALADO: `descartados` volta para o chamador justamente
// para virar linha em Atividade (lib/queue-drain.ts). Botão que some da
// mensagem sem registro é o defeito que este projeto passou a fase inteira
// fechando.
//
// O CORTE VEM DEPOIS DO DESCARTE, e a ordem importa: cortar antes deixaria um
// rótulo em branco ocupar uma das 13 vagas e ainda derrubar um botão bom para
// fora da mensagem.
export type BotaoDaMensagem = { rotulo: string; payload: string };

export function botoesDaMensagem(
  rotulos: unknown,
  payloads: unknown
): { botoes: BotaoDaMensagem[]; pareados: number; descartados: number } {
  const rs = Array.isArray(rotulos) ? rotulos : [];
  const ps = Array.isArray(payloads) ? payloads : [];
  const pares: BotaoDaMensagem[] = [];
  let descartados = 0;
  for (let i = 0; i < Math.min(rs.length, ps.length); i++) {
    const rotulo = rs[i];
    const payload = ps[i];
    if (typeof rotulo !== "string" || !rotulo.trim() || typeof payload !== "string" || !payload) {
      descartados++;
      continue;
    }
    pares.push({ rotulo, payload });
  }
  return { botoes: pares.slice(0, LIMITE_DE_BOTOES), pareados: pares.length, descartados };
}

// PARA ONDE VAI UM TOQUE EM BOTÃO — do payload até o índice, numa função só.
//
// Devolve `null` quando o toque NÃO é da forma de quatro partes: aí a pergunta
// é a antiga ("de qual bloco continuar"), e quem responde é `cursorDaRetomada`
// (logo abaixo) com `retomadaDoBotao`/`retomadaDoFollow`. Devolve `{indice}`
// quando há caminho, e `{motivo}` quando não há — e o motivo existe porque
// nada a entregar não pode virar nada a dizer (ver o final deste comentário).
//
// AQUI O PAYLOAD MANDA, E O CURSOR NEM É ARGUMENTO. É o oposto de
// `cursorDaRetomada`, e a inversão é medida, não gosto:
//
//   "O CURSOR MANDA; o payload é RESERVA" foi escrita para a FILA. Ali o
//   payload só respondia "de qual bloco continuar", e toda resposta rápida
//   avançava pela MESMA aritmética (`indice + 1`) — a resposta não dependia de
//   QUAL botão foi tocado. Nesse mundo preferir o cursor era estritamente
//   melhor: ele é a informação mais recente, e não custava nada.
//
//   Com bifurcação a pergunta muda: não é mais "de onde continuar", é "qual
//   ligação sai DESTE botão". E uma ligação de botão é `{de: <bloco que o
//   emitiu>, quando: {botao: <este id>}}` — o `de` só pode ser o bloco que
//   desenhou aquele botão, porque o id do botão é escopado ao bloco, não é
//   global. Essa informação existe num lugar só: no payload, gravado no
//   momento do envio. O cursor não a tem — ele diz onde a pessoa ESTÁ, não
//   qual bloco mandou qual botão no passado.
//
//   Usar o cursor aqui buscaria a ligação no bloco ERRADO sempre que a pessoa
//   já tivesse seguido em frente antes de tocar: `ligacoesDe` do bloco de
//   agora não tem aquele id, e o toque não faria nada, calado. Um botão
//   visível e tocável que parou de funcionar. No pior caso — colisão de id de
//   botão entre blocos, que os 6 caracteres não impedem — acertaria a ligação
//   ERRADA.
//
// O QUE SE PERDEU NA INVERSÃO, E AINDA NÃO TEM SUBSTITUTO. "O cursor manda"
// fazia DUAS coisas, e só uma delas foi derrubada pela medição acima. A outra
// era AFERIÇÃO DE FRESCOR: passando pelo cursor, um botão VELHO não
// teleportava quem já tinha seguido adiante — a retomada saía de onde a pessoa
// está, não de onde o botão foi emitido. Essa segunda função foi descartada
// junto com a primeira, e nada a substituiu: hoje um toque atrasado num botão
// antigo é honrado incondicionalmente. Quem lê o parágrafo de cima sozinho
// conclui que nada se perdeu, e conclui errado.
//
// Isso importa porque é justamente o toque atrasado que cai longe na lista, e
// era ele que entregava o link sem portão. MEDIDO, com [dm com botão,
// pedir_follow, dm com url] e a seta do botão apontando do primeiro para o
// terceiro: `caminhoDoBotao` devolvia `{indice: 2}`, o motor passava esse número
// cru a `executarFluxo`, a `Retomada` saía `{portao: null, destino: 2}` e a url
// era enfileirada com o `pedir_follow` do meio nunca avaliado.
//
// O SUBSTITUTO NÃO É restaurar "o cursor manda" — isso quebraria os botões
// legítimos que a medição acima defende —, e também não era aplicar a guarda
// posicional ao destino: ela tem falso-negativo próprio (portão no índice 2,
// link no índice 1, `2 < 1` falso), e o comentário da REGRA DO PORTÃO, abaixo,
// traz o caso. É a regra POR CAMINHO da Tarefa 3b, e é por isso que esta função
// passou a devolver uma `Retomada` em vez de um índice: com um índice, o motor
// tinha como pular a regra, e pulou. Com uma `Retomada`, não tem.
//
// O `motivo` fecha o outro buraco, o do botão órfão. Sem ligação (ou com o
// bloco de destino apagado da lista) não há o que entregar, e não entregar
// nada sem dizer nada deixa o defeito invisível: a pessoa toca, não acontece
// coisa nenhuma, e não há erro em lugar nenhum. Botão órfão não é operação
// normal — é montagem errada, e ligação gravada fora do editor é justamente a
// que a conferência da Tarefa 5 não vê. Por isso vira linha em Atividade
// (`botao_sem_caminho`, lib/engine.ts), e por isso são DOIS motivos e não um:
// "sem ligação" e "destino apagado" se arrumam em lugares diferentes do
// editor.
export function caminhoDoBotao(
  p: Payload,
  passos: unknown,
  ligacoes: unknown
): { retomada?: Retomada; motivo?: string } | null {
  if (p.prefixo !== "AUTO" || p.botaoId === null || p.passoId === null) return null;
  const destino = ligacaoEscolhida(ligacoes, p.passoId, { tipo: "botao", botao: p.botaoId });
  if (destino === null) {
    return { motivo: `o botão ${p.botaoId}, do bloco ${p.passoId}, não tem ligação de saída` };
  }
  // O destino continua sendo conferido contra a LISTA, e o índice é descartado
  // logo em seguida: o que ele responde aqui é "esse bloco ainda existe?", que é
  // o segundo dos dois motivos de botão órfão. Sem a conferência, o toque cairia
  // num `interpretar` que para no primeiro passo por bloco inexistente — sem
  // linha em Atividade dizendo qual botão levou até lá.
  if (indiceDoId(passos, destino) === null) {
    return { motivo: `o botão ${p.botaoId} leva a um bloco que não está na lista: ${destino}` };
  }
  return { retomada: atravessandoOPortao(passos, ligacoes, destino) };
}

// Qual cursor vale no toque de um botão: o REAL do contato, ou o bloco que veio
// no payload do botão.
//
// O CURSOR MANDA; o payload é reserva. A ordem não é detalhe, e a versão
// anterior desta fase tinha a ordem invertida.
//
// O payload nomeia o BOTÃO em que a pessoa tocou. O cursor diz onde ela
// realmente ESTÁ — e ele é sempre a informação mais recente dos dois, porque o
// botão fica congelado na conversa desde o dia em que foi entregue e continua
// tocável para sempre.
//
// Preferir o payload rebobinava quem já tinha avançado: quem atravessou o portão
// de follow e está parado num bloco adiante, ao tocar num "Já sigo!" antigo,
// voltava ao portão — e `executarFluxo` (lib/engine.ts) reenfileira tudo entre o
// portão e onde a pessoa estava, deduplicado só dentro do dia. Trocava um
// problema por reentrega, que é exatamente o preço que a onda anterior recusou
// pagar quando decidiu não pôr guarda no `retomadaDoBotao`.
//
// O que o payload continua resolvendo, e é por isso que ele não é inútil:
//
//   CURSOR DE OUTRA AUTOMAÇÃO — tocar num botão antigo da automação A enquanto
//     se está no meio da B recomeçava a A do ZERO, porque `cursorDesta` descarta
//     o cursor de B e não sobrava nada a afirmar. Com o payload, o toque diz de
//     qual automação e de qual ponto ele fala.
//   NENHUM CURSOR — mesma coisa, sem o cursor emprestado.
//   BLOCO DO CURSOR QUE SUMIU DA LISTA — `indiceDoId` devolve null, o cursor não
//     afirma nada, e o bloco do botão é o que sobra.
//
// A conferência com `indiceDoId` é o que torna a reserva alcançável, e ela não é
// simetria: um cursor desta automação apontando para bloco que não está mais na
// lista é tão mudo quanto cursor nenhum. Sem ela, esse caso cairia no cursor e o
// payload nunca seria usado com cursor desta automação presente.
//
// SEM BLOCO NO PAYLOAD (botão entregue antes da Fase 1b, `AUTO:<automação>`) a
// reserva é o cursor VAZIO, e não "o payload": não há bloco nenhum a afirmar.
// Daí `retomadaDoBotao` cai no zero e `retomadaDoFollow` cai no portão, que é o
// que eles já faziam com cursor nulo — a compatibilidade com o botão antigo sai
// de graça, sem ramo próprio.
//
// ---------------------------------------------------------------------------
// UM AVISO PARA QUEM MEXER AQUI DEPOIS, e ele custou uma onda para ser aprendido:
//
//   TESTE DE FUNÇÃO PURA NÃO VÊ O MOTOR TROCAR O ARGUMENTO QUE PASSA PARA ELA.
//
// O teste "cursor DESTA num bloco DEPOIS do portão retoma DELE, não do portão"
// (tests/steps.test.ts) existe justamente para impedir que quem já atravessou o
// portão volte a ele. Quando a fase anterior passou a alimentar
// `retomadaDoFollow` com o bloco do PAYLOAD em vez do cursor do contato, esse
// teste continuou VERDE — a função não mudou, o argumento é que mudou. O defeito
// atravessou a suíte inteira sem acender uma luz.
//
// É por isso que a escolha do cursor mora AQUI, numa função pura com teste, e
// não como expressão solta dentro de `server-only`: enquanto ela estiver aqui, o
// teste que compõe `cursorDaRetomada` com `retomadaDoBotao`/`retomadaDoFollow`
// pega a troca. Quem voltar a decidir isto em lib/engine.ts reabre a classe de
// defeito que esta suíte, estruturalmente, não pega.
// ---------------------------------------------------------------------------
export function cursorDaRetomada(
  real: Cursor,
  automationId: string,
  passoIdDoBotao: string | null,
  passos: unknown
): Cursor {
  const id = cursorDesta(real, automationId);
  if (id !== null && indiceDoId(passos, id) !== null) return real;
  return passoIdDoBotao === null
    ? { passoId: null, automationId: null }
    : { passoId: passoIdDoBotao, automationId };
}

// ---------------------------------------------------------------------------
// A REGRA DO PORTÃO, e ela é UMA SÓ: as três funções de retomada abaixo terminam
// nela.
//
//   NINGUÉM ATRAVESSA UM PORTÃO SEM ELE SER AVALIADO, E VENCER O PORTÃO NÃO
//   CUSTA O RESTO DO FLUXO.
//
// O portão é PONTO DE PASSAGEM. Quando o destino decidido cai DEPOIS de um
// `pedir_follow`, o fluxo atravessa esse portão primeiro e, vencido, continua
// para o DESTINO ORIGINAL — não para o passo seguinte ao portão.
//
// POR QUE A REGRA EXISTE, com as duas entradas medidas. Até a Fase 1b toda `dm`
// de resposta rápida da lista vinha ANTES do portão, porque era o formulário que
// montava a lista: uma resposta rápida só, a boas-vindas, e ela é a primeira. O
// quadro de blocos livres acaba com essa garantia, e o `+1` das retomadas soma
// sobre a POSIÇÃO, não sobre o tipo — some a garantia, e ele passa a cair do
// outro lado do portão.
//
//   [portão, boas-vindas(resposta rápida), link] — reordenação que o quadro
//     permite. Quem está parado na boas-vindas manda um texto qualquer, o ramo
//     de texto retoma do `indiceParado + 1`, que é o LINK, e o portão nunca foi
//     avaliado.
//   [resposta rápida, portão, resposta rápida, link] — o toque no botão do
//     bloco 2 retoma do 3, que é o link, pelo mesmo `+1` e pelo mesmo motivo.
//
// Nos dois, o link — a promessa central do produto — sai para quem não segue.
//
// POR QUE O DESTINO É PRESERVADO, e não `portão + 1`. Esta é a metade que custou
// uma rodada de medição, e ela não é detalhe de forma: `portão + 1` REINTERPRETA
// a lista e para na primeira parada dura do caminho. Na segunda lista acima,
// essa parada é a PRÓPRIA resposta rápida do índice 2 — vencido o portão,
// `interpretar(2)` para nela de novo e regrava o cursor ali; o toque seguinte
// repete o ciclo inteiro. Para sempre, e não para uma pessoa: para TODAS, porque
// o ramo de texto clampa igual e não sobra saída nenhuma. O bloco 3 deixaria de
// ser entregue a todo mundo.
//
// Preservando o destino isso some, e some junto o outro preço: `interpretar`
// começa em `destino`, então NADA entre o portão e o destino é reenfileirado. A
// regra não cobra mensagem repetida de ninguém.
//
// "HÁ PORTÃO NO CAMINHO?" É A PERGUNTA, e ela substituiu "o portão está antes no
// array?". A troca é a Tarefa 3b inteira, e o motivo é que a segunda pergunta
// deixou de responder a primeira quando o fluxo virou grafo.
//
// `portao < destino` foi a comparação por duas fases, e ela era CERTA enquanto a
// ordem do array era o caminho: numa corrente `bloco i → bloco i+1`, "o portão
// tem índice menor" e "dá para chegar do portão ao destino" são a mesma
// afirmação. Com bifurcação elas se separam, e erram para os DOIS lados:
//
//   PORTÃO NOUTRO BRAÇO, com índice menor. A posição diz "atravesse"; o caminho
//     diz que a pessoa nunca passaria por ali. Ela é mandada a um portão que não
//     é dela — uma consulta à Meta e, para quem não segue, um pedido de follow
//     que o fluxo dela não exigia.
//   PORTÃO NO CAMINHO, com índice MAIOR. A posição diz "não atravesse", e ela
//     está errada: o destino está depois do portão no fluxo, e a pessoa recebe o
//     que houver lá — o link inclusive — SEM SEGUIR. É a única falha do produto
//     que não tem conserto depois, e é ela que esta regra existe para fechar.
//
// O CASO MEDIDO que fecha a questão, e ele é o que torna a adaptação da
// comparação impossível: portão no índice 2, link no índice 1, seta do portão
// para o link. `portao < destino` é `2 < 1`, falso — a guarda posicional não vê
// portão nenhum, e o link sai. Não há como consertar isso comparando posições,
// porque a posição simplesmente não carrega mais a informação.
//
// QUEM RESPONDE A PERGUNTA CERTA é `haCaminho` (acima), que caminha as setas do
// portão até o destino. Ela não recebe `passos`, então a comparação posicional
// não tem por onde voltar.
//
// TODAS AS SETAS contam nessa caminhada, e não só a `sempre`. É por isso que a
// seta de um botão que salta por cima do portão passa a ser vista: o destino
// dela é alcançável a partir do portão, então o portão está no caminho.
//
// Os dois limites de antes continuam valendo, com o motivo intacto:
//
//   IGUAL não é passagem. Quem está parado NO portão retoma DELE, e
//     `interpretar` o encontra sozinho no primeiro passo que lê. Marcar
//     passagem aqui faria `resolverFollow` consultar a Meta duas vezes no mesmo
//     toque, e a segunda consulta decidiria sobre um portão já decidido. Ele é
//     conferido à parte porque `haCaminho` diria SIM para um portão que fecha
//     anel consigo mesmo.
//   PORTÃO ADIANTE DO DESTINO não é passagem pelo mesmo motivo de sempre: ele
//     está no caminho que `interpretar` vai percorrer, e ela para nele. Agora
//     isso sai de graça — se o portão está adiante, o destino não o alcança, e
//     `haCaminho(portão, destino)` é falso.
//
// O QUE A TROCA CUSTA, e ela custa: onde há ANEL, tudo alcança tudo, e o portão
// passa a estar "no caminho" de destinos que a pessoa alcançaria sem passar por
// ele — o zero de uma retomada sem cursor, por exemplo, num fluxo de menu que
// volta a si mesmo. O preço é a consulta a mais à Meta já descrita mais abaixo, e
// a escolha é deliberada: errar para o lado de atravessar um portão a mais custa
// latência; errar para o outro custa o link entregue a quem não segue.
//
// COM MAIS DE UM PORTÃO atravessa-se o PRIMEIRO, porque é o que `indiceDoPortao`
// devolve, e isso basta: o que um portão pergunta — "esta pessoa segue o perfil?"
// — é a mesma pergunta em todos eles, e `resolverFollow` não distingue um do
// outro. O que muda é só o TEXTO do pedido enviado a quem é barrado, que será o
// do primeiro. Lista com dois portões já é ERRO em `conferirLista`, e o resto do
// preço está escrito no comentário de `indiceDoPortao`.
//
// O QUE A REGRA CUSTA, e ela custa. Isto é consequência legítima da decisão, não
// defeito, mas não estava escrito em lugar nenhum:
//
//   UMA CONSULTA A MAIS À META por interação. Todo toque de botão — e todo texto
//     — que retome ADIANTE de um portão passa a atravessá-lo, e atravessar é
//     `checkFollowsAccount` (lib/engine.ts). Antes da regra o portão que ficava
//     para trás não era consultado nenhuma vez; agora é consultado toda vez.
//   O CONTADOR SOBE em quem deixou de seguir. Quem passou pelo portão e depois
//     deu unfollow é empurrado de volta a ele com `follow_attempts`
//     incrementado. O contador é por CONTATO e na VIDA — quem gastou os pedidos
//     numa automação gastou em todas —, e o preço parou aqui: esgotadas as
//     tentativas, o portão SOLTA o cursor em vez de gravá-lo (`oQuePortaoFaz`,
//     abaixo). A armadilha silenciosa que este parágrafo descrevia — parar de
//     pedir e continuar segurando — não existe mais, e o que ela era está
//     escrito em `zerarTentativasFollow` (lib/engine.ts). Quem seguir o perfil
//     passa na hora e tem o contador zerado, esgotado ou não.
//   A POSIÇÃO DE QUEM ESTÁ ADIANTE se perde quando o portão barra ou solta, e é
//     o único preço que a regra cobra de quem já tinha passado: o cursor vira o
//     portão (barrado) ou nada (solto). Ele não é novo — barrar já sobrescrevia
//     o cursor desde que a regra existe.
// ---------------------------------------------------------------------------
export type Retomada = {
  // O portão a atravessar antes, ou null quando não há nenhum no caminho.
  //
  // Continua sendo ÍNDICE porque é isso que o chamador faz com ele: `executarFluxo`
  // (lib/engine.ts) precisa do passo (`passoEsperado`) e da identidade
  // (`identidadeDoPasso`), e as duas saem do índice que `indiceDoPortao`
  // devolveu. Convertê-lo aqui só empurraria a volta para lá.
  portao: number | null;
  // Onde o fluxo continua — depois de vencer o portão, ou direto se não há.
  //
  // É IDENTIDADE, e era número. A troca é o outro lado da Tarefa 3b: enquanto
  // ele fosse um índice, `indice + 1` continuava sendo uma expressão escrevível
  // — e foi ela, em seis lugares, que fez "o seguinte" responder por um caminho
  // que o grafo não percorre. Com identidade, somar um não compila.
  //
  // Null quando não há para onde ir: o bloco não tem seta `sempre` saindo, ou a
  // posição de partida não existe na lista. `interpretar` trata o null saindo
  // calada e o motor limpa o cursor — é o mesmo fim de fluxo em que `indice + 1`
  // caía ao passar do fim da lista.
  destino: string | null;
};

// A REGRA DO PORTÃO aplicada a um destino. O comentário acima é o porquê; aqui
// está só o como.
//
// AS LIGAÇÕES SÃO ARGUMENTO desde a Tarefa 3b, e sem elas esta função não tem
// como responder a pergunta que ela faz — "há portão no caminho?" é pergunta
// sobre setas.
function atravessandoOPortao(
  passos: unknown,
  ligacoes: unknown,
  destino: string | null
): Retomada {
  const portao = indiceDoPortao(passos);
  if (portao === null || destino === null) return { portao: null, destino };
  const id = identidadeNoIndice(passos, portao);
  // `id` nulo é obrigação de tipo e não caso alcançável: o índice acabou de sair
  // de `indiceDoPortao`, que o achou nesta mesma lista.
  if (id === null || id === destino) return { portao: null, destino };
  return { portao: haCaminho(ligacoes, id, destino) ? portao : null, destino };
}

// De qual passo o toque num botão de RESPOSTA RÁPIDA (`AUTO:`) retoma.
//
// Veio de lib/engine.ts inteira, e não em pedaços, porque era a composição — e
// não as peças — que estava sem teste. `cursorDesta`, `indiceDoPortao` e
// `passoEsperado` sempre foram puras e cobertas; a ESCOLHA entre elas morava
// dentro de `server-only`, onde nenhum teste chega, e foi essa escolha que
// produziu defeito nas duas ondas anteriores.
//
// O `cursor` que chega aqui tem DUAS procedências, e quem escolhe entre elas é
// `cursorDaRetomada` (acima), não lib/engine.ts:
//
//   CURSOR DO CONTATO, lido do banco — o caso NORMAL. Onde a pessoa realmente
//     parou. Vale sempre que for desta automação e o bloco ainda estiver na
//     lista.
//   BLOCO DO PAYLOAD (`AUTO:<automação>:<bloco>`) — a RESERVA, só quando o
//     cursor não serve: nulo, de outra automação, ou apontando para bloco que
//     sumiu. Aí a automação é sempre esta por construção, `cursorDesta` nunca o
//     descarta, e o bloco é sempre uma `dm` de resposta rápida, porque é o
//     único passo que emite esse payload (`enfileirarPasso`, lib/engine.ts).
//
//     ISSO NÃO BASTAVA para garantir que o `+1` nunca pulasse um portão: ele
//     somava sobre a POSIÇÃO do bloco na lista, não sobre o tipo dele. A conta
//     só fechava ENQUANTO TODA `dm` de resposta rápida da lista viesse ANTES de
//     qualquer portão — é o que o formulário garantia (uma só, e é a
//     boas-vindas, que vinha primeiro) e o que o quadro de blocos livres NÃO
//     garante. Havendo uma `dm` de resposta rápida DEPOIS de um portão, o `+1`
//     caía depois dele e o portão não era reavaliado.
//
//     O `+1` NÃO EXISTE MAIS: o destino é a seta `sempre` que sai do bloco
//     (`seguinteDe`, acima), e a REGRA DO PORTÃO (`atravessandoOPortao`, acima)
//     pergunta se o portão está no CAMINHO até ele. As duas juntas fecham o
//     buraco pelos dois lados — o destino deixa de ser uma posição, e a guarda
//     deixa de comparar posições.
//
// O botão ANTIGO (`AUTO:<automação>`) não traz bloco: a reserva dele é o cursor
// vazio, e ele cai no ramo do zero, abaixo. Não tem prazo para acabar — botão
// entregue antes da Fase 1b continua tocável para sempre.
//
// Os ramos de PORTÃO, por isso, não são código morto nem quando a reserva ganha.
// Um bloco `dm` editado depois da entrega do botão pode ter virado `pedir_follow`
// ou `pedir_email`, e aí o toque cai neles com a mesma razão de sempre: o toque
// não é a resposta que um portão espera. E pelo cursor do contato eles são o
// caminho COMUM: quem está parado num portão está parado nele.
//
// Com cursor DESTA automação, a regra tem dois ramos:
//
//   `dm` de resposta rápida → retoma do SEGUINTE, e "o seguinte" é a seta
//     `sempre` que sai dela. O toque É a resposta que ela esperava, exatamente
//     como no ramo de texto de lib/engine.ts.
//   PORTÃO — `pedir_follow` ou `pedir_email` → retoma DELE MESMO. Avançar aqui
//     era o defeito: quem está parado no portão de A continua podendo tocar no
//     botão antigo da boas-vindas de A, que segue tocável na mensagem já
//     entregue. O cursor é o do portão, o `+1` o pulava. A alcançabilidade é a
//     MESMA do botão "Já sigo!" antigo: se botão antigo não fosse tocável, o
//     defeito que a onda passada corrigiu no ramo `FOLLOW:` também não
//     existiria.
//
// Os DOIS tipos entram, e a `dm` de resposta rápida não, porque a diferença
// está no que o toque significa em cada um. Na `dm` o toque É a resposta
// esperada — avançar é atender a pessoa. No portão não é: o que o portão espera
// é o follow ou o endereço, e o toque não os entrega, então avançar é dar por
// respondido o que ninguém respondeu.
//
//   `pedir_follow`: pular entregava o link e os lembretes a quem NÃO SEGUE — a
//     promessa central do produto. Retomando dele, `resolverFollow` reconsulta
//     a Meta e quem não segue continua barrado.
//   `pedir_email`: pular esvaziava a opção que o dono marcou justamente para
//     capturar o endereço — o pedido some em silêncio e o e-mail nunca chega.
//
// Retomar do pedido de e-mail é seguro e idempotente: `executarFluxo` já pula o
// passo sozinho quando o e-mail do contato é conhecido (o ramo `pedir_email`
// consulta `contacts.email` e segue para o índice seguinte), então quem já
// respondeu não fica preso; e quem não respondeu recebe o pedido de novo,
// deduplicado por `emailAskKey` no balde do dia.
//
// Com isso os três ramos param nos mesmos portões: o de texto, o `FOLLOW:` e
// este.
//
// SEM cursor desta automação — nulo, ou de outra —, retoma de 0. Cursor de
// outra automação é bloco de outra lista, e o zero é o único ponto afirmável
// para o null: ele tanto pode ser "nunca começou" quanto "o fluxo TERMINOU"
// (`executarFluxo` limpa o cursor no fim da lista), e a coluna não separa os
// dois. Repetir a lista é recuperável — ela para na primeira parada dura, e a
// `passoKey` segura o dia; começar no meio às cegas não é.
//
// CURSOR OBSOLETO tem DUAS formas, e elas não caem no mesmo lugar.
//
// BLOCO QUE SUMIU da lista — `indiceDoId` devolve null — retoma do ZERO. Antes
// desta fase o equivalente era "índice obsoleto", que caía no `+1`; agora não
// há índice em que somar, e o zero é o único ponto afirmável — o mesmo
// raciocínio do cursor nulo, logo acima.
//
// Quem chega aqui com bloco sumido é, agora, quem tem os DOIS sumidos:
// `cursorDaRetomada` (acima) só entrega o bloco do payload quando o cursor do
// contato não resolve, então cair no zero exige que o cursor não sirva E que o
// bloco do botão também não esteja mais na lista. Uma versão anterior desta fase
// preferia o payload, e aí bastava o bloco do BOTÃO ter sumido para a pessoa
// perder um lugar que o cursor sabia — o cursor se recupera na primeira
// interação seguinte, o bloco congelado no botão não se recupera nunca. A
// inversão fechou isso.
//
// O caso dos dois sumidos FOI COMUM e hoje é raro, e a diferença é o editor.
// Enquanto o formulário existiu, ele sorteava id novo para todo bloco a cada
// salvamento: um save órfanava o cursor e todos os botões entregues de uma vez,
// e este ramo era alcançado o tempo todo. O quadro grava a lista COMO ELA VEIO,
// preservando os ids, então chegar aqui exige que os dois blocos tenham sido
// APAGADOS de verdade — o do cursor e o do botão.
//
// BLOCO QUE CONTINUA na lista mas não espera mais nada — foi editado e virou
// botão de link, ou ficou inválido — SEGUE A SETA, como antes seguia o `+1`, e a
// escolha segue deliberada. Passo que não espera não é portão, e avançar não
// pula portão nenhum: a regra do portão olha o caminho até o destino, e os que
// vierem depois continuam sendo interpretados normalmente. Do zero, a
// alternativa, a boas-vindas sairia de novo. Quando não há seta `sempre` saindo,
// `interpretar` não enfileira nada e `executarFluxo` limpa o cursor: o toque não
// faz nada, e a pessoa destrava mandando qualquer mensagem.
//
// A diferença que esta fase pretendia JÁ VALE, e vale a pena dizer o que a
// fechou: com id, o bloco some só quando o dono o apaga, e reordenar não conta.
//
// A JANELA ESTEVE ABERTA e está registrada aqui porque o comportamento do banco
// de produção depende de quando cada automação foi salva pela última vez.
// Enquanto o formulário foi o editor, ele sorteava id novo para todo bloco a
// cada save e gravava o `steps` inteiro sem casar com os ids antigos: todo
// salvamento reescrevia as identidades e ÓRFANAVA o cursor de todo mundo que
// estivesse em fluxo, reordenação ou não.
//
// E o estrago não parava no cursor órfão: a identidade entra na `passoKey`,
// então a boas-vindas já enviada ficava gravada com `passo:A:C:b_ANTIGO:dia`, o
// recomeço do zero enfileirava com `passo:A:C:b_NOVO:dia`, o `on conflict` não
// pegava, e a pessoa recebia a boas-vindas DUAS VEZES. Com cursor por índice o
// mesmo save não causava nada disso.
//
// O QUE FECHOU A JANELA foi o formulário sair. Quem grava a lista agora é
// `salvarAutomacao` (app/automacoes/actions.ts), que escreve o `steps` COMO ELE VEIO
// do quadro, e o quadro espalha cada bloco preservando o `id` — `arranjoAutomatico`
// só acrescenta `pos` e `moverBloco` só mexe em posição, e o painel troca
// campos do bloco sem tocar na identidade. (`moverPara`, que também reordenava
// o array, saiu na Tarefa 6 junto com a ordem significar "o próximo".) Só a
// partir daí "o bloco só some quando o dono o apaga" descreve o sistema.
// `lib/db.ts` afirma o mesmo no comentário da coluna `flow_step_id`.
//
// Com a medida certa, porém: isso vale para bloco COM id. Para bloco SEM id a
// identidade É a posição (`identidadeDoPasso`), então ela não acompanha o
// bloco, e editar a lista faz o cursor resolver para OUTRO bloco em silêncio,
// sem passar por este null — o comentário de `indiceDoId`, acima, descreve o
// caso por inteiro. O que segura isso é o DADO, não esta função: depois da
// migração (`scripts/dar-ids-aos-passos.mjs`) e com `blocoNovo`
// (app/automacoes/editor/modelos.ts) dando id a todo bloco que a paleta cria,
// lista com bloco sem id não é produzida por caminho nenhum do sistema.
export function retomadaDoBotao(
  cursor: Cursor,
  automationId: string,
  passos: unknown,
  ligacoes: unknown
): Retomada {
  const id = cursorDesta(cursor, automationId);
  const indice = id === null ? null : indiceDoId(passos, id);
  // A ENTRADA DO FLUXO é `steps[0]`, e é o único significado que a ordem do
  // array guarda depois da caminhada por grafo. O "zero" deste ramo sempre foi
  // isso; só passou a ser dito por identidade.
  if (indice === null || id === null) {
    return atravessandoOPortao(passos, ligacoes, identidadeNoIndice(passos, 0));
  }
  const tipo = passoEsperado(passos, indice)?.tipo;
  const destino =
    tipo === "pedir_follow" || tipo === "pedir_email" ? id : seguinteDe(ligacoes, id);
  return atravessandoOPortao(passos, ligacoes, destino);
}

// De qual passo o toque em "Já sigo!" (`FOLLOW:`) retoma.
//
// Mesma mudança de casa de `retomadaDoBotao`, e pelo mesmo motivo: o
// comportamento é o que a onda passada instalou, o que faltava era teste.
//
// O `cursor` tem as mesmas duas procedências de `retomadaDoBotao`, escolhidas
// por `cursorDaRetomada` (acima): o cursor do CONTATO manda, o bloco do PAYLOAD
// é reserva. Aqui essa ordem tem consequência de produto, e vale escrevê-la.
//
// O GANHO da reserva: o bloco do payload de um "Já sigo!" é o do PORTÃO que
// entregou aquele botão. Numa lista com dois portões, quem não tem cursor útil
// desta automação passa a retomar do portão CERTO em vez do primeiro — é a
// dívida que o comentário de `indiceDoPortao` (acima) registrava como adiada.
//
// E o que a ordem PROTEGE: quem JÁ atravessou o portão e está parado adiante, na
// mesma automação, toca de novo no "Já sigo!" antigo e CONTINUA onde estava. Uma
// versão anterior desta fase preferia o payload e o mandava de volta ao portão,
// reenfileirando tudo entre os dois — a `passoKey` só segura isso dentro do dia.
// É esse caso que o teste "cursor DESTA num bloco DEPOIS do portão retoma DELE"
// (tests/steps.test.ts) sempre pretendeu impedir; ele não pegou a regressão
// porque o que mudou não foi a função, foi quem alimentava o argumento dela. O
// aviso inteiro está no comentário de `cursorDaRetomada`.
//
// Com cursor DESTA automação, retoma DELE, seja ele qual for. A promessa "o
// portão é reavaliado, não pulado" vale QUANDO O BLOCO DO CURSOR É O PORTÃO —
// aí retomar dele é reconsultar a Meta, que é o ponto do botão.
//
// QUANDO NÃO É, o toque não faz nada, e isso precisa estar dito. Com o cursor
// na boas-vindas, a função devolve o índice DELA; `interpretar` a partir daí
// para na mesma parada dura e `executarFluxo` regrava o cursor no mesmo lugar.
// Nada avança, nada é enfileirado, e tocar em "Já sigo!" de novo repete o nada.
//
// Não é regressão desta tarefa — o comportamento é o que a onda passada
// instalou — e a pessoa destrava por outro caminho: mandando qualquer texto (o
// ramo de fallback) ou tocando no botão de resposta rápida, que avança do
// SEGUINTE. Fica anotado, não consertado aqui.
//
// A não ser que o BLOCO tenha sumido da lista, e esse ramo é novo desta fase:
// com índice, um número sempre resolvia para alguma coisa, então cursor desta
// automação nunca chegava ao `??`. Agora `indiceDoId` sabe dizer "esse bloco
// não está mais aqui", e aí o cursor não afirma nada — cai no portão, junto com
// o caso de não haver cursor desta, e pelo mesmo motivo.
//
// Sem cursor desta, o ponto de partida NÃO é o zero, e é aqui que este ramo
// difere do `AUTO:`: o payload `FOLLOW:<id>` só existe porque o portão desta
// automação foi entregue, então o toque AFIRMA onde a pessoa está. O zero era
// no-op para toda lista que o formulário gravou, e por construção: a boas-vindas
// era obrigatória, vinha antes do portão e sempre com rótulo e sem url — parada
// dura. `interpretar` do zero parava NELA, nunca chegava ao portão, e ainda
// gravava o cursor na boas-vindas, de modo que o toque seguinte encontrava esse
// cursor (agora desta automação) e parava no mesmo lugar: o "Já sigo!" nunca
// mais funcionava. Essas listas continuam no banco, e o quadro produz outras
// com a mesma forma sempre que a boas-vindas vier antes do portão.
//
// O PREÇO de retomar do portão, por inteiro, porque ele NÃO é o mesmo do zero
// no ramo `AUTO:`: se o fluxo já tinha terminado (cursor limpo), o `AUTO:` do
// zero esbarra na parada dura da boas-vindas e o estrago é UMA mensagem
// repetida. Do portão não há parada dura depois dele numa lista com a forma que
// o formulário gravava — o que vem é o link e os lembretes, nenhum deles
// resposta rápida —, então `interpretar` enfileira a CAUDA INTEIRA e devolve
// `pararEm: null`. A `passoKey` só segura dentro do dia; virado o balde, um
// toque num "Já sigo!" antigo reentrega tudo de novo. A decisão continua
// valendo, porque a alternativa é não responder nada a quem acabou de tocar no
// botão, mas ela se paga em mensagens repetidas, não em uma.
//
// O `?? 0` final é alcançável PELA TELA, e não só por lista montada fora dela:
// basta o dono apagar o bloco de portão no quadro e salvar. Os botões
// `FOLLOW:<id>` já entregues continuam tocáveis nas conversas antigas, e a
// lista deixou de ter portão. É "lista que não tem portão AGORA", e aí o zero é
// mesmo o único ponto afirmável.
export function retomadaDoFollow(
  cursor: Cursor,
  automationId: string,
  passos: unknown,
  ligacoes: unknown
): Retomada {
  const id = cursorDesta(cursor, automationId);
  const indice = id === null ? null : indiceDoId(passos, id);
  // Não há "seguinte" nenhum aqui — este ramo sempre retomou DO bloco, nunca do
  // próximo —, então a Tarefa 3b não mexeu no destino. O que ele ganhou foram as
  // ligações, que a regra do portão passou a exigir.
  //
  // O `?? 0` continua sendo posição, e é o único lugar em que ela ainda decide
  // alguma coisa: `steps[0]` é a ENTRADA do fluxo, o significado que a ordem do
  // array guarda depois do grafo.
  const destino =
    indice !== null && id !== null ? id : identidadeNoIndice(passos, indiceDoPortao(passos) ?? 0);
  return atravessandoOPortao(passos, ligacoes, destino);
}

// De qual passo o TEXTO SOLTO de quem está parado num passo de espera retoma.
//
// O QUARTO ponto de retomada, e o último a mudar de casa. Ele era uma expressão
// solta em lib/engine.ts — `passo.tipo === "pedir_follow" ? indiceParado :
// indiceParado + 1` —, calculada por conta própria, sem passar por nenhuma das
// outras três. Expressão de controle de fluxo dentro de `server-only` é
// exatamente a classe de código que o comentário de `cursorDaRetomada` (acima)
// descreve como a que nenhum teste alcança, e nesta branch já saíram três de lá
// pelo mesmo motivo. Esta é a quarta.
//
// E ela não vem de graça: é por ELA que a primeira das duas entradas da regra do
// portão é alcançável. Com a lista reordenada para `[portão, boas-vindas, link]`,
// quem está parado na boas-vindas e manda qualquer texto caía em `+1` = o link,
// com o portão nunca avaliado. Enquanto o cálculo morasse no motor, a regra
// escrita aqui não o alcançaria.
//
// O `indice` que chega é o do bloco em que a pessoa está parada, já resolvido
// por `indiceDoId` e já confirmado por `passoEsperado` lá no motor — este ramo
// só é alcançado quando há um passo de espera de verdade naquele índice. A
// releitura do tipo aqui dentro é de propósito: a decisão fica INTEIRA numa
// função com teste, em vez de metade aqui e metade no argumento que o motor
// escolhe passar.
//
// A regra por tipo é a mesma dos outros ramos, e o motivo também:
//
//   `pedir_follow` → retoma DELE MESMO. A mensagem de texto não é o follow, e
//     avançar entregaria o link a quem não segue — bastaria mandar "ok".
//   `pedir_email` → retoma do SEGUINTE, e aqui a diferença em relação ao
//     `AUTO:` é real: o motor acabou de EXTRAIR o e-mail desta mensagem e
//     gravá-lo em `contacts.email`. O pedido foi atendido; repeti-lo seria pedir
//     de novo o que a pessoa acabou de mandar.
//   `dm` de resposta rápida → retoma do SEGUINTE. O texto vale como resposta,
//     do mesmo jeito que no fallback.
//
// "O SEGUINTE" É A SETA `sempre` (`seguinteDe`, acima), e não a posição de baixo
// no array. Enquanto foi `indice + 1`, esta função respondia por uma ordem que o
// motor deixou de percorrer — e ela é o ramo mais alcançável dos seis que a
// Tarefa 3b converteu: toda mensagem de texto de quem está parado passa por aqui.
//
// A SETA DO "digitou" VEM ANTES DO SEGUINTE, e é isto que a Tarefa 7b liga.
//
// A spec desta fase promete, com todas as letras, que o "senão" "recebe quem
// responde digitando em vez de tocar". `ligacaoEscolhida(..., {tipo:"texto"})`
// devolve exatamente esse destino desde a Tarefa 3b, TEM TESTE, e passou várias
// tarefas sem um único CHAMADOR em produção — medido em todo o `lib/` e o
// `app/`: DUAS chamadas com `{tipo:"botao"}` (`caminhoDoBotao`, :1900, e a regra
// do botão sem destino em `conferirLista`, :3318), nenhuma com `{tipo:"texto"}`.
// Quem decidia o destino de quem digita era `seguinteDe`, ou seja, a seta
// `sempre`.
//
// O QUE ISSO CUSTAVA, e o pior caso é justamente o do menu: um menu inteiramente
// ligado NÃO TEM `sempre` saindo — `retomaPelaSempre` (lá em cima) diz isso com
// todas as letras, e o quadro nem desenha a alça de continuação para ele
// (`alcasDeSaida`, app/automacoes/editor/modelos.ts). Então quem digitava num
// menu caía em `seguinteDe` → null, `interpretar` saía calada e o cursor era
// limpo. O dono desenhava a seta do "digitou", nomeava, salvava, `conferirLista`
// validava — e a pessoa não recebia nada. O editor prometia um caminho que o
// motor não percorria, que é a mesma falha que a Tarefa 7 fechou do outro lado.
//
// NENHUMA PEÇA NOVA, e a ausência é o ponto: a regra já estava inteira em
// `ligacaoEscolhida`, com o desempate e o teste do caso de texto. O que faltava
// era o chamador — e chamador que não existe não aparece em teste de função
// pura, que é a forma exata do buraco estrutural desta fase.
//
// COM AS DUAS SETAS SAINDO DO MESMO BLOCO, GANHA A `senao`. A decisão é medida, e
// não é preferência:
//
//   A `senao` FOI DESENHADA PARA ESTE CASO. A alça dela se chama literalmente
//     "digitou" (`alcasDeSaida`), e só existe em bloco que é menu. A `sempre` é
//     a saída que vale SEM CONDIÇÃO — ela responde por todo o resto, não por
//     este caso. Havendo as duas, o dono disse duas coisas, e só uma delas fala
//     do texto. É a mesma ordem que `envioDaDm` (lá em cima) já usa no bloco que
//     tem `botoes` E `botao_label`: o ramo mais específico entra antes, e é essa
//     ordem que "decide o caso em que um bloco tem as duas coisas".
//   E A `sempre` É, DAS DUAS, A QUE TEM COMO SOBRAR. Medido nos dois sentidos:
//     do lado da `senao`, o editor a APAGA sozinho quando o bloco perde a alça
//     dela — `apagarBotao` (app/automacoes/editor/quadro.tsx) chama
//     `desligarSenao` quando o último botão sai. Do lado da `sempre`, NADA A
//     APAGA quando uma `dm` de resposta rápida com seta já desenhada ganha
//     `botoes` e vira menu: ela fica e perde a alça do TIPO — o quadro passou a
//     lhe dar uma alça própria, rotulada "continuação" (`alcasDoQuadro`,
//     app/automacoes/editor/modelos.ts), em vez de desenhá-la saindo do primeiro
//     botão. Ou seja, "tem os dois" é produzível PELA TELA, e o caminho que o
//     produz deixa a `sempre` órfã, não a `senao`. Preferir a `sempre` seria
//     fazer a seta que o dono não consegue mais ver ganhar da que ele acabou de
//     desenhar.
//
// O PREÇO DESSA ORDEM, medido, porque precedência incondicional cobra num caso:
// com a `senao` apontando para um bloco QUE NÃO EXISTE e a `sempre` apontando
// para um bloco válido, esta função devolve o destino inexistente — antes desta
// tarefa devolvia o da `sempre`, e a pessoa recebia alguma coisa. NÃO É
// SILÊNCIO: `interpretar` registra em `ignorados` "o bloco de partida não está
// na lista: <id>", que é a linha que quem for atrás do defeito lê. E só é
// produzível por dado gravado FORA do painel — a mesma ressalva que esta função
// já carrega para a `senao` em `pedir_follow`, logo abaixo. Preferir a `sempre`
// nesse caso seria pôr um desempate por validade dentro de uma regra que hoje é
// só "o mais específico entra antes"; não vale a segunda regra.
//
// `pedir_follow` FICA DE FORA DISSO, e a exceção é anterior à pergunta: ele
// retoma DELE MESMO, com ou sem `senao`, porque a mensagem de texto não é o
// follow. Uma `senao` gravada nele — só produzível fora do editor, que não lhe
// dá a alça — não pode virar a porta dos fundos do portão: bastaria mandar
// "ok" para receber o link sem seguir. Há teste fixando isso.
//
// A VARREDURA VÊ ESTE CAMINHO, DESDE A TAREFA 7c, e as duas metades disto
// precisam estar escritas onde quem mexer vai ler: o que a rede pega hoje, e a
// lacuna que ela fechou — porque é a lacuna que explica por que a rede existe.
//
// HOJE ELA PEGA. `topologiasDoMenu()` (scripts/varredura-portao.mjs) emite
// ligações `senao`, com a ORIGEM varrendo os cinco papéis. Plantando o defeito
// óbvio — o destino da `senao` devolvido como `{portao: null, destino}`, sem
// passar por `atravessandoOPortao` —, `npm run varredura` sai com CÓDIGO 1 e
// acusa C 99.726 na varredura do menu, apontando "texto parado em <i>" como o
// salto que vazou. Medido, e é o mesmo plantio que a tabela daquele arquivo
// registra.
//
// MAS SÓ A SEGUNDA VARREDURA PEGA, e isso importa para quem for medir. Com esse
// plantio a EXAUSTIVA fica byte a byte idêntica à linha de base — A 73.720
// casos / 2.088.628 saltos / 0; C 954.160 / 11.333.976 / 0; B 261.536 —, porque
// `topologias()` não emite `senao`, de propósito. Rodar só a exaustiva não
// responde NADA sobre esta função.
//
// ANTES DA TAREFA 7c NENHUMA DAS DUAS VIA, e a lacuna não era suposta: este
// comentário registrava, com os números da época, que o mesmo plantio deixava a
// varredura imprimindo "SEM VAZAMENTO" com os contadores intactos. O que
// sustentava esta função naquele período era uma amostra independente sobre
// fluxos COM `senao` — 2.000.000 de sorteios, 1.708.044 com uma `senao`
// sorteada; 491.094 saltos de texto no grupo A e 2.712.195 no C —, que dava
// zero vazamentos com o código desta função e acusava com o plantio. Aquela
// amostra não está no repositório; a varredura do menu tomou o lugar dela, e
// tem a vantagem de rodar no `verify`.
//
// E O NÚMERO DEPENDE DE ONDE O PLANTIO ENTRA, que é a parte reaproveitável e
// segue valendo. É a diferença entre medir a fiação da `senao` e medir a quebra
// do portão:
//
//   DEPOIS do ramo `pedir_follow` — o plantio descrito acima, em que só a
//     fiação nova sai sem portão. A fica em ZERO, e o zero é ESTRUTURAL, não
//     sorte: em fluxo gateado toda seta que chega no link sai do portão, e o
//     ramo `pedir_follow` não consulta a `senao`, então a retomada do próprio
//     portão continua saindo por `atravessandoOPortao`.
//   ANTES do ramo `pedir_follow` — quebra TAMBÉM a retomada do portão, porque
//     uma `senao` gravada nele passa a sair crua, e aí A acende.
//
// Na amostra da época os dois deram A 0 / C 87.313 e A 19.097 / C 144.614. A
// varredura de hoje mede o PRIMEIRO em C 99.726; o segundo não foi refeito
// nela, e a afirmação que sobrevive dele é a qualitativa — um número em A só
// aparece quando o plantio derruba o portão, que é outro defeito.
//
// O que segura o portão aqui é ESTRUTURAL: o destino, venha da `senao` ou da
// `sempre`, é uma identidade que sai por `atravessandoOPortao` na última linha,
// e ela não pergunta de onde ele veio. "Estrutural" era argumento, e este
// projeto prefere medida — agora há as duas coisas, e a medida roda sozinha.
//
// O ÍNDICE CONTINUA SENDO O ARGUMENTO porque é o que lib/engine.ts tem na mão
// (`indiceParado`, já resolvido por `indiceDoId`) e porque `passoEsperado` fala
// em posição. A conversão para identidade acontece aqui dentro, uma vez, e o
// destino sai como identidade — que é o que impede o `+1` de voltar.
export function retomadaDoTexto(passos: unknown, ligacoes: unknown, indice: number): Retomada {
  const id = identidadeNoIndice(passos, indice);
  const tipo = passoEsperado(passos, indice)?.tipo;
  const destino =
    id === null
      ? null
      : tipo === "pedir_follow"
        ? id
        : (ligacaoEscolhida(ligacoes, id, { tipo: "texto" }) ?? seguinteDe(ligacoes, id));
  return atravessandoOPortao(passos, ligacoes, destino);
}

// De onde o fluxo continua quando o pedido de e-mail é RESOLVIDO SEM PERGUNTAR,
// porque o endereço do contato já está em `contacts.email`.
//
// O QUINTO ponto de retomada, e o último a sair de lib/engine.ts. Ele era a
// última das seis conversões da Tarefa 3b que continuava escapando da regra do
// portão: a aritmética `acao.indice + 1` foi trocada por `seguinteDe` na hora,
// mas o resultado seguia saindo como STRING CRUA para `executarFluxo`, que
// embrulha string em `{ portao: null, destino }` — e `atravessandoOPortao` nunca
// era chamada. O destino deixou de ser uma posição errada e passou a ser a
// posição certa SEM PORTÃO, que é o mesmo vazamento por outra porta.
//
// A MEDIÇÃO que fechou a questão, e ela não é hipotética — é o grafo mais banal
// que se monta no quadro, uma JUNÇÃO no bloco de link:
//
//   blocos: [dm "oi", pedir_email, dm com url, pedir_follow]
//   setas:  oi -sempre-> e-mail -sempre-> LINK ;  portão -sempre-> LINK
//
// Quem já tinha e-mail gravado recebia o LINK sem o portão ser avaliado uma
// única vez. E no MESMO grafo, para o MESMO destino, `retomadaDoFallback`
// devolvia `{ portao: 3, destino: "b_lnk00003" }` — a regra aplicada. Dois
// caminhos de código, o mesmo bloco de chegada, respostas opostas. É essa
// inconsistência que esta função apaga.
//
// A REGRA É A MESMA das outras quatro, sem exceção nenhuma: "o portão está a
// montante do destino?". Não há aqui nenhuma razão de grafo para dispensá-la —
// e havia uma escrita em lib/engine.ts, que dizia que os destinos das chamadas
// que o motor faz a si mesmo são sempre "o VIZINHO imediato" e que "vizinho não
// salta por cima de ninguém". A primeira metade continua verdadeira; a segunda
// é a forma exata da demonstração que `retomadaDoFallback` (abaixo) registra
// como CAÍDA COM O GRAFO. Vizinho não salta por cima de ninguém, mas o portão
// pode alcançar esse vizinho por OUTRO braço — uma junção basta, e é a junção
// medida acima.
//
// O PREÇO, dito por inteiro, porque ele é cobrado no caminho mais comum que
// existe: numa lista em corrente `portão -> pedido de e-mail -> link`, quem já
// tem e-mail gravado e ACABOU de vencer o portão volta a atravessá-lo aqui — o
// portão alcança o link através deste mesmo bloco. `resolverFollow` reconsulta a
// Meta, a pessoa passa de novo, e o fluxo segue para o mesmo destino. Custa UMA
// consulta à Meta por passagem, e não altera o que é entregue.
//
// A alternativa examinada era perguntar se o portão alcança o destino SEM passar
// por este bloco, o que zeraria esse custo. Ela foi recusada porque reabre o
// vazamento na forma espelhada: com `E -sempre-> e-mail -sempre-> LINK` e
// `portão -sempre-> e-mail`, o portão só alcança o link ATRAVÉS deste bloco, e
// excluí-lo devolveria o link a quem não segue. Errar para o lado da consulta a
// mais é a direção já escolhida e registrada nesta fase (ver `atravessandoOPortao`).
//
// O ÍNDICE é o argumento pelo mesmo motivo de `retomadaDoTexto`: é o que
// lib/engine.ts tem na mão (`acao.indice`, vindo de `interpretar`). A conversão
// para identidade acontece aqui dentro, uma vez, e o destino sai identidade.
//
// NÃO CONFERE O TIPO do bloco de propósito. Quem chama já sabe que está num
// `pedir_email` — foi `interpretar` que parou nele e o motor que consultou o
// banco. Reconferir aqui só criaria um segundo lugar onde a resposta pode
// divergir; o que esta função decide é UMA coisa, o destino e o portão dele.
export function retomadaDoEmailConhecido(
  passos: unknown,
  ligacoes: unknown,
  indice: number
): Retomada {
  const id = identidadeNoIndice(passos, indice);
  const destino = id === null ? null : seguinteDe(ligacoes, id);
  return atravessandoOPortao(passos, ligacoes, destino);
}

// De qual passo o fallback retoma. Null quando não dá para afirmar.
//
// Veio de lib/engine.ts, onde era pura e por isso não testável — e onde esteve
// no centro de dois defeitos. Aqui ela é coberta por teste.
//
// O contexto: `shouldFallbackFollowup` (lib/engine.ts) respondeu "já houve
// boas-vindas e o link não saiu", e a intenção sempre foi MANDAR O LINK — não
// recomeçar a conversa.
//
// A dedução: `interpretar` a partir do zero enfileira tudo até o primeiro passo
// de espera e para NELE. Como a boas-vindas comprovadamente saiu, tudo até esse
// passo já foi entregue, e o que veio depois nunca chegou a ser enfileirado.
//
//   `dm` de resposta rápida → retoma do SEGUINTE. O que ela esperava era o
//     toque no botão, que não veio; o texto que a pessoa mandou vale como
//     resposta, do mesmo jeito que no ramo do cursor.
//   portão de follow ou pedido de e-mail → retoma DELE MESMO, para o portão
//     reconsultar a Meta e o e-mail ser reavaliado. Pular entregaria o link a
//     quem não segue.
//
// O CRITÉRIO CONSERVADOR, e por que ele existe: a dedução acima só vale
// enquanto houver no máximo UMA parada dura na lista (ver `contarParadasDuras`).
// É o que toda lista gravada pelo formulário tem — a boas-vindas era a única
// `dm` com rótulo e sem url —, mas o quadro deixa montar a lista livremente, e
// com duas `dm` de resposta rápida seguidas a dedução vira mentira: a pessoa
// pode ter tocado no primeiro botão, recebido a segunda `dm` e travado ALI. Como
// nenhuma dessas duas é `dm_link`, `shouldFallbackFollowup` continua dizendo sim
// a cada mensagem, e retomar do índice deduzido REENVIA a segunda — mensagem
// repetida para pessoa real.
//
// Havendo mais de uma, não retoma nada. Mandar nada é recuperável: a pessoa
// manda outra mensagem, ou toca no botão que ainda está lá. Mandar de novo o que
// já foi mandado não é.
//
// Os portões ficam fora da conta de propósito: o fallback retoma DELES MESMOS,
// sem afirmar nada sobre o que veio depois, e reenviá-los é o comportamento
// pretendido — o portão só é portão se cada tentativa reconsultar.
//
// Sem passo de espera nenhum, a lista teria sido enfileirada inteira — link
// incluído — e `shouldFallbackFollowup` não teria dito sim. Se ainda assim
// acontecer, também não retoma nada: repetir a lista manda mensagem repetida.
//
// ELA PASSOU A RECEBER A REGRA DO PORTÃO, e era a única das quatro que não
// recebia. A dispensa tinha demonstração escrita, ela era CORRETA para uma fila,
// e o grafo a derrubou — vale registrar as duas metades, porque foi a mudança de
// premissa e não um erro de então.
//
// A DEMONSTRAÇÃO ANTIGA: `interpretar` a partir da entrada para no PRIMEIRO
// passo que espera resposta, e `pedir_follow` espera resposta; logo nenhum
// portão precede `pararEm`. Numa fila, "não precede" é "tem índice maior", e
// `portao < destino` era falso em toda entrada possível — a regra não tinha como
// mudar coisa alguma.
//
// O QUE MUDOU: "há portão no caminho?" não é mais a mesma pergunta que "o portão
// tem índice menor?". Um portão que a caminhada da entrada não encontra pode
// mesmo assim alcançar o destino por OUTRO braço — uma junção basta: o bloco de
// link recebendo uma seta do portão e outra de um braço sem portão. Aí o destino
// deduzido está depois do portão no fluxo, e entregá-lo sem avaliar o portão é
// exatamente o vazamento que esta tarefa fecha.
//
// NÃO É MAIS INALCANÇÁVEL, portanto, e a linha é coberta: o teste do braço com
// junção (tests/steps.test.ts) a exercita. A demonstração antiga fica registrada
// porque quem a ler no histórico precisa saber que ela não estava errada — ela
// falava de um sistema que deixou de existir.
//
// AS LIGAÇÕES JÁ ERAM ARGUMENTO, e não por simetria: esta função DEDUZ onde a
// pessoa parou reexecutando a caminhada, e a caminhada depende delas.
//
// DEVOLVE `Retomada`, como as outras três, e null continua querendo dizer "não
// dá para afirmar nada" — que é diferente de "afirmo que não há para onde ir"
// (`destino: null`). O chamador (lib/engine.ts) só executa no segundo caso, e
// não faz nada no primeiro.
//
// ELA NÃO PERGUNTA PELA `senao`, e a ausência é REGISTRO, não decisão tomada. A
// Tarefa 7b ligou a seta do "digitou" em `retomadaDoTexto` (acima) e deixou este
// ponto como estava, de propósito: aqui a pessoa TAMBÉM respondeu digitando, mas
// onde ela parou é DEDUZIDO por uma recaminhada, não sabido por cursor — e
// mandar quem talvez nem esteja naquele bloco pelo braço do "digitou" é uma
// decisão de produto que ninguém tomou ainda.
//
// O BURACO É REAL E ESTÁ MEDIDO, com `[menu(op_aaaaaa), b_opa002, b_sen003]`,
// `botao(menu→b_opa002)` e `senao(menu→b_sen003)` — o mesmo grafo nas duas:
//
//   `retomadaDoTexto(passos, ls, 0)` .. `{portao: null, destino: "b_sen003"}`
//   `retomadaDoFallback(passos, ls)` .. `{portao: null, destino: null}`
//
// Dois caminhos de código, a mesma pessoa digitando no mesmo menu, respostas
// opostas — que é a forma exata da inconsistência que `retomadaDoEmailConhecido`
// (acima) registra ter apagado. Fica anotado, não consertado aqui.
//
// E A DIVERGÊNCIA FOI CRIADA PELA PRÓPRIA TAREFA 7b — dito por extenso porque é
// o que o registro tem de valer para quem chegar aqui pelo histórico. ANTES de
// 7b os dois pontos perguntavam `seguinteDe` e davam a MESMA resposta: no grafo
// acima, `{portao: null, destino: null}` nos dois, e num grafo com `sempre`
// saindo do menu, o destino DELA nos dois. Não há aqui uma inconsistência
// antiga que ninguém tinha notado; há uma inconsistência INTRODUZIDA, de
// propósito, com o motivo escrito no parágrafo anterior. Quem for fechá-la está
// desfazendo uma escolha desta tarefa, não consertando um esquecimento.
export function retomadaDoFallback(passos: unknown, ligacoes: unknown): Retomada | null {
  const { pararEm } = interpretar(passos, ligacoes, identidadeNoIndice(passos, 0));
  if (pararEm === null) return null;
  if (Array.isArray(passos) && contarParadasDuras(passos) > 1) return null;
  // `pararEm` saiu da própria caminhada, que só o produz depois de `indiceDoId`
  // ter achado o bloco — o null é obrigação de tipo, não caso alcançável.
  const indice = indiceDoId(passos, pararEm);
  if (indice === null) return null;
  const passo = passoEsperado(passos, indice);
  const destino = passo?.tipo === "dm" ? seguinteDe(ligacoes, pararEm) : pararEm;
  return atravessandoOPortao(passos, ligacoes, destino);
}

// Quem está parado esperando o toque num botão pode ser interrompido por outra
// automação? Só quando duas coisas valem ao mesmo tempo.
//
// Veio de lib/engine.ts pelo mesmo motivo de `retomadaDoFallback`: é decisão
// pura, e decisão pura sem teste é onde os defeitos apareceram. Recebe só
// `{ id, match_type }` — o bastante para decidir, e nada que arraste o tipo
// `Automation` (lib/db.ts, `server-only`) para dentro deste arquivo.
//
// A PRIMEIRA é que a automação casada seja OUTRA. Comparar por id, e não só
// perguntar "casou com alguma?", é o ponto: quando a pessoa repete a palavra-
// chave da automação em que ela já está parada, isso não é pedido de outra
// coisa, é a mesma conversa continuando — e ela tem que retomar do cursor. Sem
// a comparação, esse caso caía no fluxo normal e reinterpretava a lista do
// índice 0: parava de novo na boas-vindas, regravava o cursor em 0 e não
// enfileirava nada, porque a boas-vindas do dia já estava na fila com a mesma
// `passoKey` e o `on conflict do nothing` engolia o item. Nenhuma mensagem
// saía, o cursor não andava, e cada nova mensagem repetia o mesmo nada — até
// virar o dia, quando a chave mudava de balde e a boas-vindas saía OUTRA VEZ
// para uma pessoa real, com o link ainda sem sair. Basta a pessoa repetir a
// palavra-chave para cair nisso, e a palavra-chave é justamente o que ela
// acabou de ler na boas-vindas.
//
// A SEGUNDA é que a automação nova NÃO seja `match_type: "any"`. A distinção é
// entre "pediu outra coisa" e "caiu na rede": palavra-chave específica é um
// pedido explícito — a pessoa digitou aquilo, e interromper é atendê-la. Já
// "Qualquer texto" não é escolha de ninguém, é rede de arrasto: casa com toda
// mensagem, de todo mundo, sempre. Se ela pudesse interromper, sequestraria
// todo contato parado no meio de qualquer outro fluxo, e ninguém chegaria ao
// link. Pega-tudo serve para quem não tem dono; quem está no meio de uma
// conversa já tem.
export function interrompeOFluxo(
  casada: { id: string; match_type: string } | undefined,
  parada: { id: string }
): boolean {
  if (!casada) return false;
  if (casada.id === parada.id) return false;
  return casada.match_type !== "any";
}

export type Problema = {
  nivel: "erro" | "aviso";
  // EM QUAL PORTA ESTE PROBLEMA TRAVA, e a linha entre as duas é de PRODUTO.
  //
  //   "salvar" — DADO QUE O MOTOR NÃO CONSEGUE LER. Ele cai (`botoes: [null]`
  //     estoura `TypeError` dentro de `enfileirarPasso` e derruba o resto do
  //     lote de eventos daquela requisição), ou anda sem parar (o anel de
  //     `sempre`, que faz a recursão de `executarFluxo` nunca retornar).
  //     Nenhuma tela deve conseguir gravar isso, então trava as DUAS portas: o
  //     salvar recusa, e o ativar também.
  //   "ativar" — FLUXO QUE ENTREGA ERRADO, mas que o motor lê perfeitamente e
  //     cuja causa é MONTAGEM PELA METADE. Montar um menu de três opções, ligar
  //     duas e voltar amanhã é trabalho normal; travar o salvar nisso seria
  //     hostil, e o dono ficaria sem onde guardar o meio do trabalho. O que não
  //     pode é isso ir ao ar: publicar um botão que não faz nada é a falha
  //     silenciosa que este projeto combate desde a Fase 1a.
  //
  // POR QUE NÃO BASTA `nivel`: os dois eixos são independentes. `nivel` diz se
  // o problema TRAVA alguma coisa (erro) ou só explica (aviso); `quando` diz
  // QUAL porta ele tranca. Fundir os dois num campo só ("erro", "aviso",
  // "erro_de_ativar") faria todo leitor que hoje filtra por `nivel === "erro"`
  // — a borda vermelha do nó, o recado da barra, os dois Server Actions —
  // precisar aprender um terceiro valor de uma vez, e quem esquecesse um deles
  // passaria a deixar erro passar em silêncio.
  //
  // AVISO NÃO TRANCA PORTA NENHUMA, então o `quando` dele não decide nada. Ele
  // vem preenchido porque o tipo exige um valor, e o valor é `"ativar"` por ser
  // o mais fraco dos dois: se um aviso um dia virar erro por engano de edição,
  // ele vira o erro que só impede publicar, e não o que tranca o salvar.
  quando: "salvar" | "ativar";
  // Qual bloco. Null quando o problema é da lista inteira.
  indice: number | null;
  mensagem: string;
};

// Os três tipos de que a lista só pode ter UM, e o motivo de cada um.
//
// A regra é a mesma dos dois portões de follow — bloquear o que o motor
// engoliria em silêncio —, mas o MECANISMO não é o mesmo nos três, e a mensagem
// precisa dizer o certo porque é ela que o dono lê para decidir o que fazer com
// o bloco.
//
// `reagir_story` e `resposta_publica`: é a CHAVE de deduplicação, e ela não
// conhece o bloco. `storyReactionKey(mid)` é a mesma string para as duas
// reações à mesma story, `commentReplyKey(comment_id)` a mesma para as duas
// respostas ao mesmo comentário (lib/dedupe.ts), e o `on conflict do nothing`
// do enqueue engole o segundo item sem erro nenhum.
//
// `pedir_email`: quem engole o segundo é o próprio MOTOR, antes de a chave
// entrar em jogo. O ramo `pedir_email` de lib/engine.ts pula o bloco quando o
// e-mail do contato já é conhecido (`if (rows[0]?.email) return
// executarFluxo(..., seguinteDe(...), ...)`), e depois de o primeiro pedido ser
// respondido o endereço já está gravado — então o segundo normalmente nem chega
// a ser enfileirado. `emailAskKey(auto, pessoa, dia)` só decide no caso restante:
// os dois enfileirados no mesmo dia sem que o e-mail tenha sido respondido entre
// eles. Aí sim a chave, igual para os dois, é quem engole o segundo.
//
// `passoKey` ganhou a identidade do bloco na Tarefa 1; estas três não. A regra
// sai daqui no dia em que ganharem. `followGateKey` tem o mesmo buraco e não
// precisa de entrada própria: o bloqueio dos dois portões já o torna
// inalcançável pelo editor.
const SO_UM_POR_LISTA: Record<string, string> = {
  pedir_email:
    "Só pode haver um pedido de e-mail. O segundo nunca é entregue: quando o endereço já foi respondido, o motor pula o bloco; quando não foi, ele sai com a mesma chave de envio do primeiro.",
  reagir_story:
    "Só pode haver uma reação à story. A segunda sai com a mesma chave de envio da primeira, e por isso nunca é entregue.",
  resposta_publica:
    "Só pode haver uma resposta pública. A segunda sai com a mesma chave de envio da primeira, e por isso nunca é entregue.",
};

// Confere a lista montada no quadro.
//
// Roda em DOIS lugares: no navegador, para desabilitar o salvar e dizer por
// quê; e no Server Action, porque nada vindo do navegador é confiável. É por
// isso que ela mora aqui e é pura — escrever a regra duas vezes é como as duas
// versões passam a discordar.
//
// ERRO trava uma porta; AVISO explica e deixa passar. QUAL porta cada erro
// tranca é o campo `quando` (ver `Problema`, acima), e a linha entre as duas foi
// decidida com o dono do produto: trava o SALVAR o que o motor não consegue LER,
// e trava só o ATIVAR o fluxo que ele lê e entrega errado por montagem pela
// metade. Avisa o que é incomum mas coerente.
//
// `esperar` com `minutos: 0` NÃO entra aqui, e isso é DECISÃO, não esquecimento:
// uma espera de zero minutos não atrasa nada, mas também não quebra nada, e o
// aviso de "espera no fim da lista" (mais abaixo) já pega o caso em que ela é
// de fato inútil. Um erro ou aviso aqui, sobre o valor em si, seria ruído.
//
// ---------------------------------------------------------------------------
// AS LIGAÇÕES SÃO ARGUMENTO desde a Tarefa 5, porque metade das regras desta
// função é sobre SETAS e nenhuma delas é respondível sem elas: "há anel", "este
// botão leva a algum lugar", "este bloco é alcançável", "dá para chegar no link
// sem passar pelo portão".
//
// O PADRÃO `[]` EXISTE POR UMA RAZÃO NOMEADA, e ela tem data para acabar: o
// quadro (app/automacoes/editor/quadro.tsx) ainda não tem as ligações no estado
// dele — quem as põe lá é a Tarefa 6, e é ela que passa a mandá-las por aqui.
// Enquanto isso, a chamada de duas partes que já existe continua compilando e,
// pela regra do parágrafo seguinte, continua respondendo o mesmo que respondia.
//
// SEM SETA NENHUMA, AS REGRAS DE GRAFO FICAM CALADAS, e isso NÃO é uma exceção
// para o padrão do parâmetro: é a resposta para toda lista sem setas, venha ela
// de onde vier. O motivo está escrito em `interpretar`: `ligacoes` tem
// `default '[]'::jsonb`, então TODA automação gravada antes desta fase chega
// aqui sem uma seta sequer, e quem as escreve é a migração
// (`scripts/ligar-passos-existentes.mjs --aplicar`), que é DADO e não montagem.
// Acusar essa lista aqui trancaria o dono fora do painel de toda automação
// antiga — o mesmo estrago que os comentários do bloco sem `id` e do link legado
// já recusaram duas vezes neste arquivo.
//
// O PREÇO, dito inteiro: uma lista com blocos e nenhuma seta entrega UM BLOCO SÓ
// (é o parágrafo de `interpretar` com esse título), e esta função não diz nada
// sobre isso. Quem fecha esse caso é a ordem de implantação registrada lá —
// coluna, migração, motor —, e não a conferência.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// A CHAVE `entregaSemPortao` É ARGUMENTO, E TEM QUE SER (Tarefa 9).
//
// Ela é uma COLUNA — `automations.entrega_sem_portao`, `false` de padrão —, e
// mesmo assim chega por parâmetro, porque este arquivo é puro e não conhece
// banco. Ler configuração aqui dentro faria a única regra testável sem banco
// depender de uma coisa que só existe com banco, e a suíte que segura esta
// função pararia de segurá-la.
//
// QUEM A LÊ DO BANCO são `app/automacoes/[id]/page.tsx` (que a manda para o
// quadro, que a devolve no salvar) e `toggleAutomation`
// (app/automacoes/actions.ts), que é a porta de publicar.
//
// O PADRÃO É `false` E ISSO É A REGRA DE HOJE: com ela desligada, esta função
// responde exatamente o que respondia antes desta tarefa. É o que faz uma
// automação gravada antes da coluna existir — e uma chamada de três argumentos
// que ninguém atualizou — não mudar de veredicto.
//
// ELA DESLIGA UMA REGRA SÓ, e a estreiteza é o produto inteiro desta tarefa:
// botão sem destino, bloco inalcançável, menu grande demais, portão sem saída e
// o anel de `sempre` continuam falando com ela ligada. Uma chave que cala mais
// de uma é um "ignorar tudo" com nome bonito, e aí o dono que queria dizer
// "entrego sem exigir follow" acabou dizendo "não me conte mais nada".
// ---------------------------------------------------------------------------
export function conferirLista(
  passos: unknown,
  gatilho: string,
  ligacoes: unknown = [],
  entregaSemPortao: boolean = false
): Problema[] {
  const r: Problema[] = [];

  // Os dois motivos são separados porque as causas são diferentes: aqui a
  // coluna está quebrada; abaixo ela está íntegra e o conteúdo é que falta. É a
  // mesma distinção que `interpretar` faz nos seus `ignorados`.
  if (!Array.isArray(passos)) {
    return [
      {
        nivel: "erro",
        quando: "salvar",
        indice: null,
        mensagem: "A automação não tem lista de blocos.",
      },
    ];
  }
  if (!passos.length) {
    return [
      {
        nivel: "erro",
        quando: "salvar",
        indice: null,
        mensagem: "Sem nenhum bloco, a automação não envia nada.",
      },
    ];
  }

  // A ENTRADA DO FLUXO É `steps[0]`, e é a partir dela que "alcançável" quer
  // dizer alguma coisa. O porquê está por extenso em `interpretar`: com as
  // ligações a ordem do array deixa de significar o próximo, mas guarda
  // EXATAMENTE UM significado, que é este. A alternativa — "a entrada é o bloco
  // que ninguém aponta" — não serve: um menu que volta para si mesmo tem seta
  // chegando na entrada, e o fluxo ficaria sem começo.
  const entrada = identidadeDoPasso(passos[0], 0);

  // HÁ ALGUMA SETA DESENHADA? É a guarda das regras de grafo, e o motivo inteiro
  // está no cabeçalho desta função.
  //
  // Conta LIGAÇÃO VÁLIDA, e não `ligacoes.length`, porque uma coluna com lixo
  // dentro não é uma lista de setas: `ligacoesDe` descarta o que
  // `conferirLigacao` recusa, então uma lista só de lixo caminha exatamente como
  // uma lista vazia, e as regras têm que responder a mesma coisa nas duas.
  const temSeta = Array.isArray(ligacoes) && ligacoes.some((l) => Boolean(conferirLigacao(l).ligacao));

  let portoes = 0;
  // `indiceDoLinkAntesDoPortao` MORAVA AQUI, e saiu junto com o aviso posicional
  // que era o seu único leitor (Tarefa 9 — o porquê está no lugar em que o aviso
  // estava). Deixá-lo vivo seria uma varredura da lista inteira alimentando
  // ninguém, e o próximo a ler este arquivo procurando por quem a consome.
  //
  // `portoes` FICA, e não é o mesmo caso: quem o lê é a regra de "só pode haver
  // um portão de follow" e a condição da regra do caminho, lá embaixo.
  const jaVistos = new Set<string>();
  const idsVistos = new Set<string>();

  for (let i = 0; i < passos.length; i++) {
    const { passo, paraODono } = conferir(passos[i]);

    // Bloco inválido é ignorado pelo interpretador — quem montou acha que
    // mandou e não mandou. É a falha mais silenciosa que existe aqui.
    //
    // A mensagem é a do DONO, não o `motivo` técnico: esta lista é lida na tela
    // por quem monta a automação. O `motivo` continua saindo, para diagnóstico,
    // nos `ignorados` de `interpretar`, que é onde alguém atrás do defeito olha.
    if (!passo) {
      r.push({ nivel: "erro", quando: "salvar", indice: i, mensagem: paraODono! });
      continue;
    }

    // Bloco que não pode disparar naquele gatilho. A paleta não o oferece, mas
    // lista vinda de fora do editor pode trazê-lo.
    //
    // AS DUAS METADES TÊM MECANISMOS DIFERENTES, e por isso níveis diferentes.
    // Elas já estiveram sob uma afirmação só — "bloco que não pode disparar
    // naquele gatilho nunca roda" —, e essa afirmação só era verdade para uma.
    //
    // `resposta_publica` precisa do id do COMENTÁRIO, e só o gatilho de
    // comentário o conhece: `handleComment` (lib/engine.ts) chama `executarFluxo`
    // com `{ commentId }`, e nenhum outro caminho o preenche. O ramo
    // `resposta_publica` de `enfileirarPasso` faz `if (!contexto.commentId)
    // return`. Em qualquer outro gatilho o bloco NUNCA roda, e travar o que o
    // motor não consegue executar é exatamente o que ERRO quer dizer aqui.
    //
    // `reagir_story` precisa do id da MENSAGEM, e DOIS gatilhos o fornecem. É o
    // mesmo `handleMessage` (lib/engine.ts) que atende a resposta de story e a
    // DM comum — `const trigger = isStoryReply ? "story" : "dm"` decide só qual
    // automação casa —, e ele chama `executarFluxo(..., { messageId: msg.mid })`
    // nos dois. `enfileirarPasso` não exige mais nada, e `lib/queue-drain.ts`
    // entrega: o comentário de lá diz literalmente "reação na mensagem que a
    // pessoa mandou". No gatilho `dm` o coraçãozinho RODA, então travar o salvar
    // travaria uma lista que o motor executa — é AVISO, e o texto diz o que vai
    // acontecer de fato, porque é incomum e o dono pode ter querido outra coisa.
    //
    // No gatilho de comentário não há mensagem nenhuma a que reagir, e aí o
    // bloco volta a nunca rodar: ERRO, pelo mesmo critério da metade de cima.
    if (passo.tipo === "reagir_story" && gatilho === "dm") {
      r.push({
        nivel: "aviso",
        quando: "ativar",
        indice: i,
        mensagem:
          "Neste gatilho o coraçãozinho não vai para a story: ele reage à mensagem que a pessoa mandou.",
      });
    }
    if (passo.tipo === "reagir_story" && gatilho !== "dm" && gatilho !== "story") {
      r.push({
        nivel: "erro",
        quando: "salvar",
        indice: i,
        mensagem:
          "O coraçãozinho precisa de uma mensagem para reagir, e neste gatilho não chega nenhuma.",
      });
    }
    if (passo.tipo === "resposta_publica" && gatilho !== "comment") {
      r.push({
        nivel: "erro",
        quando: "salvar",
        indice: i,
        mensagem: "A resposta pública só funciona no gatilho de comentário.",
      });
    }

    // Resposta pública com todos os textos em branco não é publicada, e o motor
    // documenta isso: `enfileirarPasso` (lib/engine.ts) sorteia um dos textos e
    // faz `if (!texto?.trim()) return` — sem enfileirar, sem `step_ignorado`,
    // sem nada em Atividade. `conferir`, acima, só exige que a lista não esteja
    // VAZIA, então `{textos:[""]}` passa por ela inteira.
    //
    // Basta UM texto aproveitável para a regra calar, e isso é deliberado: com
    // uma mistura de textos cheios e vazios o sorteio às vezes cai no vazio e a
    // resposta some naquela vez. É perda real, mas é intermitente e não trava
    // nada — travar o salvar por causa dela recusaria lista que funciona na
    // maioria dos disparos. Fica registrado aqui para quem quiser transformá-lo
    // num aviso próprio depois.
    if (
      passo.tipo === "resposta_publica" &&
      !passo.textos.some((t) => typeof t === "string" && t.trim())
    ) {
      r.push({
        nivel: "erro",
        quando: "salvar",
        indice: i,
        mensagem:
          "Esta resposta pública está em branco, e por isso não é publicada: o motor sorteia um dos textos e desiste quando ele não tem nada escrito.",
      });
    }

    // A IDENTIDADE DO BLOCO, e por que ela é conferida aqui.
    //
    // Esta validação existe porque o `id` PASSA A VIR DE FORA. Até a Tarefa 6 só
    // o formulário e o script de migração o produziam, os dois no servidor com
    // `novoIdDeBloco()`, e a forma era certa por construção. A partir dela o id
    // é montado no NAVEGADOR (`blocoNovo`, app/automacoes/editor/modelos.ts) e
    // chega pelo Server Action — e nada vindo do navegador é confiável.
    // `conferirLista` é a única validação do lado do servidor, então o que ela
    // não pegar não é pego por ninguém.
    //
    // O que quebra nos dois casos é a `dedupe_key`, e ela quebra CALADA: o `on
    // conflict do nothing` do enqueue engole o item repetido sem erro nenhum, e
    // a pessoa deixa de receber uma mensagem sem que nada apareça em lugar
    // nenhum.
    //
    // ID REPETIDO: dois blocos com o mesmo id têm a mesma `passoKey`, e o
    // segundo envio some. Duplicar um bloco no editor é exatamente o gesto que
    // produz isso, e é um gesto que o quadro vai oferecer.
    //
    // ID FORA DA FORMA: `identidadeDoPasso` recusa o id e cai no ÍNDICE, e aí a
    // chave colide com a de outro bloco que também esteja sem id válido — a
    // colisão que `FORMA_DO_ID` foi criada para tornar impossível. Um id "2" é
    // a mesma string que o índice 2 de um bloco vizinho.
    //
    // SEM `id` NENHUM não é erro, e isso é decisão. Bloco sem id é o que toda
    // automação anterior à Fase 1b tem gravado, e `identidadeDoPasso` lhe dá a
    // identidade que ele sempre teve na prática, o índice. Recusá-lo trancaria o
    // dono fora do painel de toda lista antiga — o mesmo estrago que a condição
    // pela metade do link sem endereço causou.
    const idBruto = (passos[i] as { id?: unknown }).id;
    if (idBruto !== undefined) {
      if (typeof idBruto !== "string" || !FORMA_DO_ID.test(idBruto)) {
        r.push({
          nivel: "erro",
          quando: "salvar",
          indice: i,
          mensagem:
            "Este bloco tem uma identidade inválida. Ela é o que separa um envio do outro, e com essa identidade uma das mensagens da automação deixa de ser entregue, sem aviso.",
        });
      } else if (idsVistos.has(idBruto)) {
        r.push({
          nivel: "erro",
          quando: "salvar",
          indice: i,
          mensagem:
            "Dois blocos têm a mesma identidade. Só o primeiro é entregue — o segundo é descartado no envio, sem aviso.",
        });
      } else {
        idsVistos.add(idBruto);
      }
    }

    // PORTÃO SEM RÓTULO NÃO É PORTÃO: é uma parada sem o que tocar.
    //
    // O mecanismo, por inteiro: `resolverFollow` (lib/engine.ts) enfileira
    // `quick_reply_label: passo.botao_label`, e `lib/queue-drain.ts` só monta a
    // resposta rápida quando `quick_reply_label && quick_reply_payload`. Com o
    // rótulo vazio a condição é falsa e a mensagem cai no `else`: sai TEXTO
    // PURO, sem botão nenhum. O fluxo para no portão — `esperaResposta` diz sim
    // a todo `pedir_follow` — e a pessoa fica olhando um pedido sem o botão que
    // ele promete. É a mesma classe de armadilha do "link sem endereço", logo
    // abaixo, e por isso tem o mesmo nível.
    //
    // ELA MORA AQUI E NÃO EM `conferir`, e o porquê está escrito por extenso no
    // comentário do ramo `pedir_follow` de lá: recusar em `conferir` faria
    // `interpretar` IGNORAR o portão e entregar o link a quem não segue. Travar
    // o salvar impede que a lista nasça; ignorar o portão quebraria a promessa
    // central do produto em toda lista que já nasceu.
    //
    // O `dm` de resposta rápida NÃO precisa de regra igual: sem rótulo,
    // `esperaResposta` diz não, o motor manda texto puro e o fluxo SEGUE. Não
    // há parada a destravar. É a assimetria entre os dois, e ela é do motor.
    if (passo.tipo === "pedir_follow" && !passo.botao_label) {
      r.push({
        nivel: "erro",
        quando: "salvar",
        indice: i,
        mensagem:
          "Este pedido de follow está sem o texto do botão, e sem ele o Instagram não entrega botão nenhum: a mensagem sai como texto puro e o fluxo para aqui, sem nada para a pessoa tocar.",
      });
    }

    if (passo.tipo === "pedir_follow") {
      portoes++;
      if (portoes > 1) {
        r.push({
          nivel: "erro",
          quando: "salvar",
          indice: i,
          mensagem:
            "Só pode haver um pedido de follow. Com dois, o botão “Já sigo!” não sabe a qual voltar.",
        });
      }
    }

    // Aponta o SEGUNDO, não o primeiro: o primeiro é o que vai ser entregue, e
    // é o segundo que o dono precisa apagar ou trocar de lugar.
    const soUm = SO_UM_POR_LISTA[passo.tipo];
    if (soUm) {
      if (jaVistos.has(passo.tipo))
        r.push({ nivel: "erro", quando: "salvar", indice: i, mensagem: soUm });
      jaVistos.add(passo.tipo);
    }

    // "Mensagem com link" (Tarefa 5) semeia SEMPRE a chave `url`, mesmo vazia
    // — é a convenção que o editor tem que manter para esta regra funcionar.
    // "Mensagem" e "Mensagem com botão" NUNCA gravam essa chave.
    //
    // O MECANISMO por inteiro: um bloco `dm_link` sem endereço salva
    // `{tipo:"dm", texto, botao_label:"Abrir link", url:""}`. `esperaResposta`
    // faz `Boolean(botao_label) && !url` — `""` é falso, então `!url` é
    // verdadeiro — e o bloco vira resposta rápida aos olhos do motor: o fluxo
    // ENFILEIRA esse passo e PARA nele, esperando o toque num botão que não
    // tem endereço nenhum para abrir. É parada dura, calada, para sempre — o
    // mesmo defeito que a fase anterior registrou (lembrete salvo sem link).
    //
    // A VERDADE MORA NA CHAVE `url`, e as outras duas peças se alinham a ela.
    // Esta linha é a segunda das três, e o alinhamento precisa estar escrito
    // porque as três já discordaram entre si:
    //
    //   O TÍTULO (`resumoDoBloco`, app/automacoes/editor/modelos.ts) classifica
    //     pela CHAVE: com ela presente, o nó diz MENSAGEM COM LINK.
    //   ESTA CONFERÊNCIA, agora, acusa toda chave presente sem endereço.
    //   O MOTOR não tem como discordar e não muda: sem url não sai link. Com
    //     rótulo, `esperaResposta` faz o bloco virar resposta rápida e o fluxo
    //     PARA nele; sem rótulo, `enfileirarPasso` (lib/engine.ts) o manda como
    //     `dm_link` e `linkMessage` devolve TEXTO PURO. Nos dois a promessa do
    //     título não é cumprida — o que muda é o preço.
    //
    // A CONDIÇÃO ESPELHAVA `esperaResposta` (`Boolean(botao_label) && !url`), e
    // é essa metade que saiu. O motivo de ela ter entrado está registrado e era
    // razoável: sem rótulo não há parada dura, e a versão ANTERIOR à dela
    // recusava `{tipo:"dm", texto, url:""}` chamando-o de armadilha, que ele não
    // é. Mas a conclusão tirada dali — "é DM comum, e ela funciona" — não se
    // sustenta: a chave `url` presente é o que faz o nó dizer MENSAGEM COM LINK,
    // e uma mensagem sem link nem botão não é o que aquele nó promete. Calar
    // aqui deixava o dono salvar, ativar e entregar uma promessa quebrada, com a
    // tela dizendo que estava tudo certo. Não travar o fluxo não é estar certo.
    //
    // O DONO NÃO FICA TRANCADO FORA, que era o risco daquela decisão, e a razão
    // é a mesma que faz `blocoNovo("dm_link")` (editor/modelos.ts) NASCER COM
    // ERRO de propósito: o único jeito de chegar a esta forma pela tela é criar
    // um bloco de link e não digitar o endereço (apagando ou não o rótulo). O
    // erro é a instrução do que fazer em seguida, e ele apaga na primeira letra
    // digitada no campo Endereço. Quem não quer link nenhum apaga o bloco e
    // arrasta uma "Mensagem" — o painel não tira a chave `url`, e é essa mesma
    // convenção que mantém o erro visível.
    //
    // A MENSAGEM MUDA COM O RÓTULO porque a consequência muda, e é ela que o
    // dono lê para decidir o que fazer:
    //
    //   COM rótulo — `esperaResposta` diz sim, o fluxo PARA ali esperando o
    //     toque num botão sem destino. Armadilha, e nada depois é entregue.
    //   SEM rótulo — `linkMessage(texto, "Abrir link", "")` devolve só o texto.
    //     O fluxo SEGUE, e o que se perde é o link. Promessa quebrada.
    //
    // AS DUAS SÃO ERRO, e o critério é o mesmo do resto da função: ERRO trava o
    // que o motor não consegue executar COMO MONTADO. Um bloco que a tela chama
    // de "mensagem com link" e que sai sem link nenhum não é executável como
    // montado, mesmo sem travar ninguém.
    //
    // As outras duas partes da condição continuam, e cada uma exclui uma forma
    // legítima:
    //
    //   `url` DIFERENTE de `undefined` — e esta parte é a que não se enxerga
    //     olhando só o banco. Uma lista pode ser conferida EM MEMÓRIA, antes de
    //     virar jsonb, e nela um campo montado como `url: algo || undefined`
    //     mantém a CHAVE presente com valor `undefined` — o `undefined` só some
    //     no `JSON.stringify` da serialização. Era assim que o formulário
    //     montava a lista, e conferir a chave por `"url" in passo` dava `true`
    //     nela: qualquer conferência anterior à serialização recusaria toda
    //     automação sem link. Testar contra `undefined` cobre de uma vez esse
    //     caso e o do bloco sem a chave — em `{tipo:"dm", texto, botao_label}` a
    //     leitura de `passo.url` também dá `undefined`.
    //
    //   `url` FALSY — o bloco com endereço não tem o que ser acusado.
    //
    // ISTO SÓ VALE enquanto o editor mantiver a convenção. Se ele passar a
    // semear `url` (mesmo vazia) num bloco de resposta rápida, todo bloco
    // desse tipo passaria a acender este erro à toa; se ele apagar a chave de
    // um `dm_link` sem endereço, esta regra deixa de disparar em silêncio e o
    // defeito volta a passar batido.
    //
    // E A REGRA É CEGA PARA A FORMA QUE JÁ ESTÁ GRAVADA, o que precisa estar
    // dito porque é justamente o defeito que ela existe para pegar. O formulário
    // gravava `url: fu.url || undefined`, e o `undefined` sumia na serialização:
    // o que ficou no banco de quem salvou um link sem endereço é
    // `{tipo:"dm", texto, botao_label:"Abrir link"}` — rótulo, SEM a chave. É
    // parada dura de verdade, e `conferirLista` devolve `[]` para ela.
    //
    // Não há heurística a inventar aqui, e a ausência dela é decisão: esse bloco
    // é GENUINAMENTE ambíguo. A mesma forma exata — rótulo, sem chave `url` — é
    // o bloco de resposta rápida legítimo que a paleta oferece, e nada no dado
    // separa os dois. Adivinhar erraria em cima de listas boas.
    //
    // Esta regra vale, portanto, para lista NOVA, montada sob a convenção. O que
    // fazer com o que o formulário gravou já foi decidido por quem ABRE a
    // automação no quadro (`quadro.tsx`): tratar como resposta rápida, que é o
    // que o motor já faz, e não mexer na chave. O preço e a saída em aberto —
    // perguntar ao dono no painel do bloco — estão escritos lá.
    if (passo.tipo === "dm" && passo.url !== undefined && !passo.url) {
      r.push({
        nivel: "erro",
        quando: "salvar",
        indice: i,
        mensagem: passo.botao_label
          ? "Mensagem com link sem endereço trava o fluxo para sempre: ele para aqui esperando o toque num botão que não leva a lugar nenhum."
          : "Esta mensagem com link está sem endereço e sem texto de botão: chega só o texto, sem link e sem botão nenhum. O bloco promete um link e entrega uma mensagem comum.",
      });
    }

    // -----------------------------------------------------------------------
    // OS BOTÕES DO BLOCO.
    //
    // A CONFERÊNCIA DE CONTEÚDO DE `botoes` MORA AQUI, e o pedido está escrito
    // no comentário de `envioDaDm` desde a Tarefa 4, com a medição: aquela
    // função valida a LISTA (`Array.isArray` e `.length`) e não os ELEMENTOS,
    // porque recusar lá faria `interpretar` IGNORAR o bloco — a troca cara que o
    // ramo `pedir_follow` de `conferir` descreve. Aqui a recusa TRAVA O SALVAR e
    // não muda nada do que o motor faz com uma lista já gravada.
    //
    // A PORTA É `botoesCrus` QUEM DIZ, uma causa de cada vez: quatro das cinco
    // travam o SALVAR porque o motor CAI ou não lê, e a quinta — rótulo em
    // branco — só o ATIVAR. O critério de cada uma está por extenso lá.
    //
    // UM EFEITO DE MASCARAMENTO, CONHECIDO E ACEITO: `cru` truthy pula o
    // `else` inteiro, abaixo — inclusive a checagem de BOTÃO SEM DESTINO, que
    // mora dentro dele. Então quando `botoesCrus` acusa RÓTULO EM BRANCO num
    // botão do bloco, a checagem de destino dos OUTROS botões do mesmo bloco
    // nem roda. Não há buraco de bloqueio nisso — as duas são erro de ATIVAR,
    // e o ativar já recusava na primeira causa que achasse, estruturalmente
    // igual antes desta fase. O que É novo: agora existe uma causa de
    // `botoesCrus` que NÃO trava o salvar, então o dono chega até a porta de
    // ativar, conserta o rótulo, tenta de novo, e pode levar uma recusa
    // DIFERENTE (botão sem destino) que a primeira tentativa nunca revelou.
    // É experiência de uso esperada, não comportamento a consertar aqui.
    //
    // Medido na Tarefa 4, para a mais cara delas: `[null].map(b => b.rotulo)`
    // estoura `TypeError` dentro de `enfileirarPasso` (lib/engine.ts), a
    // caminhada aborta no meio, o cursor — gravado depois do laço — não é
    // gravado, e o `try/catch` do webhook, que está FORA dos dois laços, derruba
    // junto o resto do lote de eventos daquela requisição. Não é "botão aparado
    // tarde": é perda de entrega para todo mundo que chegou naquele POST.
    // `conferir`, no ramo `dm`, valida só `texto` — este é o único lugar que
    // olha `botoes`.
    //
    // ELA RODA MESMO QUANDO O MOTOR IGNORA `botoes`, e isto fica REGISTRADO e
    // não consertado: em `{tipo:"dm", url:"…", botoes:[null]}` a chave `url`
    // manda, `envioDaDm` devolve `{forma:"link"}` e o motor nunca toca em
    // `botoes` — mas o `botoesCrus` acima trava o salvar assim mesmo. É excesso
    // de rigor sobre lixo que ninguém lê, inofensivo, e a forma não é produzida
    // pelo painel (nenhum bloco da paleta semeia as duas chaves). Filtrar por
    // `envioDaDm(passo).forma === "botoes"` mudaria a resposta dessa lista sem
    // consertar defeito nenhum; está aqui para não virar surpresa em quem medir.
    if (passo.tipo === "dm") {
      const brutos = (passos[i] as { botoes?: unknown }).botoes;
      const cru = brutos === undefined ? null : botoesCrus(brutos);
      if (cru) {
        r.push({ nivel: "erro", quando: cru.quando, indice: i, mensagem: cru.mensagem });
      } else {
        const envio = envioDaDm(passo);
        if (envio.forma === "botoes") {
          // O TETO DA META (Tarefa 4). `botoesDaMensagem` corta em
          // `LIMITE_DE_BOTOES` e o dreno registra `menu_cortado`, então nada
          // quebra — o que acontece é que os botões de baixo SOMEM da mensagem,
          // e com eles os braços do fluxo que só eles alcançam. O motor lê a
          // lista sem dificuldade nenhuma; o que ela entrega é que não é o que a
          // tela mostra. É a definição de erro de ATIVAR.
          if (envio.botoes.length > LIMITE_DE_BOTOES) {
            r.push({
              nivel: "erro",
              quando: "ativar",
              indice: i,
              mensagem: `Uma mensagem do Instagram cabe ${LIMITE_DE_BOTOES} botões, e este menu tem ${envio.botoes.length}. Os de baixo não são entregues, e quem só chegaria por eles não recebe nada.`,
            });
          }

          // BIFURCAÇÃO COM UM BOTÃO SÓ é AVISO, e não erro, porque ela FUNCIONA:
          // a mensagem sai com um botão, o toque casa com a ligação e o fluxo
          // segue. O que ela não faz é escolher — todo mundo vai para o mesmo
          // lugar —, e isso costuma ser um menu que ficou pela metade. Quem
          // decide é o dono.
          if (envio.botoes.length === 1) {
            r.push({
              nivel: "aviso",
              quando: "ativar",
              indice: i,
              mensagem:
                "Esta bifurcação tem um botão só, então ela não escolhe nada: todo mundo segue pelo mesmo caminho.",
            });
          }

          // BOTÃO SEM DESTINO é ERRO DE ATIVAR, e a colocação é a decisão de
          // produto desta tarefa. Montar um menu de três opções, ligar duas e
          // voltar amanhã é trabalho normal, e travar o salvar nisso seria
          // hostil — o dono ficaria sem onde guardar o meio do trabalho.
          // Publicar um botão que não faz nada é outra coisa: a pessoa toca,
          // `ligacaoEscolhida` devolve null, e o que sai é uma linha
          // `botao_sem_caminho` em Atividade que ela nunca vê.
          //
          // A pergunta é feita a `ligacaoEscolhida` e não respondida de novo
          // aqui: é a MESMA que o motor faz no toque, e duas cópias dela
          // discordariam no dia em que o desempate mudasse.
          if (temSeta) {
            const id = identidadeDoPasso(passos[i], i);
            const orfaos = envio.botoes.filter(
              (b) => ligacaoEscolhida(ligacoes, id, { tipo: "botao", botao: b.id }) === null
            );
            if (orfaos.length) {
              r.push({
                nivel: "erro",
                quando: "ativar",
                indice: i,
                mensagem:
                  orfaos.length === 1
                    ? `O botão “${orfaos[0].rotulo}” não leva a lugar nenhum: quem tocar nele não recebe nada.`
                    : `${orfaos.length} botões deste menu não levam a lugar nenhum: quem tocar neles não recebe nada.`,
              });
            }

            // MENU COM AS DUAS SETAS — a `sempre` deixa de ser o caminho de
            // quem digita, e ninguém contava isso ao dono. É a conferência que
            // faltava depois da Tarefa 7b.
            //
            // O QUE ESTA REGRA NÃO DIZ, porque foi MEDIDO e é o contrário do
            // que parece: a `sempre` de um menu com `senao` NÃO É SETA MORTA.
            // No grafo `[menu(op_aaaaaa) → b_opa002 por botão, → b_sen003 por
            // senão, → b_smp004 por sempre]`, os cinco pontos de retomada dão:
            //
            //   toque em "Quero"        `caminhoDoBotao`         b_opa002
            //   digita COM cursor       `retomadaDoTexto`        b_sen003
            //   payload sem botão       `retomadaDoBotao`        b_smp004
            //   digita SEM cursor       `retomadaDoFallback`     b_smp004
            //
            // Ou seja, ela continua sendo percorrida pelos dois pontos que não
            // sabem qual foi o gesto. O que a Tarefa 7b tirou dela foi UM
            // caminho: quem digita e TEM cursor. Chamar isso de seta morta
            // seria escrever de novo um número que a medição não produz.
            //
            // E É POR ISSO QUE É AVISO, pelo critério desta fase. Não trava o
            // SALVAR: o estado é produzido por edição normal — uma `dm` de
            // resposta rápida com `sempre` já desenhada que ganha `botoes` e
            // vira menu deixa a `sempre` para trás (`apagarBotao`,
            // app/automacoes/editor/quadro.tsx, só apaga a `senao`) —, e travar
            // o salvar no meio de um trabalho é hostil, o mesmo critério do
            // botão sem destino, acima. Não trava o ATIVAR: nada é entregue
            // errado, cada gesto vai para onde a seta DELE manda. O que sobra é
            // o dono acreditar numa coisa que não é, e isso é o que aviso é.
            //
            // A PERGUNTA É FEITA ÀS DUAS FUNÇÕES DO MOTOR, `ligacaoEscolhida` e
            // `seguinteDe`, pelo mesmo motivo do botão sem destino: é a mesma
            // dupla que `retomadaDoTexto` consulta, na mesma ordem, e uma
            // terceira cópia da regra discordaria no dia em que o desempate
            // mudar.
            //
            // NO QUADRO essa seta APARECIA SAINDO DO PRIMEIRO BOTÃO —
            // `indiceDaAlca` (app/automacoes/editor/modelos.ts) devolvia 0 para
            // uma condição sem alça, e o menu não tem alça de `sempre`. Desde a
            // onda que fechou aquele Crítico ela tem alça própria, rotulada
            // "continuação" (`alcasDoQuadro`). A mensagem não diz isso porque é
            // a tela que decide onde desenhar, e repetir aqui a decisão dela
            // seria a cópia que este arquivo evita.
            if (
              ligacaoEscolhida(ligacoes, id, { tipo: "texto" }) !== null &&
              seguinteDe(ligacoes, id) !== null
            ) {
              r.push({
                nivel: "aviso",
                quando: "ativar",
                indice: i,
                mensagem:
                  "Este menu tem a seta “digitou” e também uma seta de continuação. Quem digita segue a do “digitou”: a de continuação só vale quando o fluxo é retomado sem saber onde a pessoa parou.",
              });
            }
          }
        }
      }
    }

    // -----------------------------------------------------------------------
    // O QUE SÓ AS SETAS RESPONDEM.
    // -----------------------------------------------------------------------
    if (temSeta) {
      const id = identidadeDoPasso(passos[i], i);

      // BLOCO INALCANÇÁVEL. Nenhuma seta chega nele partindo da entrada, então
      // ele nunca é entregue — está na tela, ocupa espaço no quadro, e o dono
      // acha que mandou.
      //
      // O BLOCO DE PARTIDA NUNCA ENTRA AQUI, e essa linha é a mais importante
      // desta regra: nada aponta para a entrada POR DEFINIÇÃO, e sem o `i > 0`
      // a conferência acusaria a própria entrada de toda automação — nenhuma
      // poderia mais ser ativada. `haCaminho` começa nas SAÍDAS de `de`, então
      // ela só diz sim à própria entrada quando existe um anel que volta nela.
      //
      // É ERRO DE ATIVAR pelo mesmo critério do botão sem destino: um bloco
      // ainda solto no quadro é o estado normal de quem está montando.
      if (i > 0 && !haCaminho(ligacoes, entrada, id)) {
        r.push({
          nivel: "erro",
          quando: "ativar",
          indice: i,
          mensagem:
            "Nenhuma seta chega neste bloco a partir do começo do fluxo, então ele nunca é entregue.",
        });
      }

      // O BECO SEM SAÍDA: o bloco PEDE alguma coisa, a pessoa faz exatamente o
      // que foi pedido — e não recebe nada. `interpretar` sai calada e o cursor
      // é limpo. É o pior fim possível para um fluxo, e é sempre o MESMO
      // mecanismo: a retomada pergunta `seguinteDe` e leva null de volta.
      //
      // COM UMA `senao` GRAVADA a frase acima fica imprecisa, e continua
      // bastando: desde a Tarefa 7b quem DIGITA retoma pela `senao`
      // (`retomadaDoTexto`), então um bloco com `senao` e sem `sempre` deixou de
      // ser beco PARA O TEXTO. Ele continua sendo para todo o resto —
      // `retomadaDoBotao` e `retomadaDoEmailConhecido` só perguntam `seguinteDe`
      // —, e é disso que a frase fala. Nenhum tipo que ENTRA nesta regra ganha
      // alça de `senao` no editor (`alcasDeSaida` só a dá ao menu, e o menu está
      // fora daqui), então o caso exige ligação gravada por fora do painel.
      //
      // ESTA REGRA NASCEU SÓ PARA O PORTÃO e passou dois commits assim, o que é
      // um recorte e não uma decisão: o mesmo beco no tipo de bloco mais comum
      // do produto — a `dm` de resposta rápida — não era acusado por ninguém.
      // Medido, com seta e tudo: `[dm "oi", dm "Quer?" botao_label:"Quero"]` com
      // `sempre(oi → Quer?)` devolvia `[]`. A pessoa toca "Quero" e não recebe
      // nada, nem erro nem aviso. `pedir_email` sem saída era idêntico.
      //
      // QUEM ENTRA está em `retomaPelaSempre` (lá em cima), e o recorte é o do
      // MOTOR, não o desta função: o menu de `botoes` fica de fora porque a
      // retomada dele é por botão, e é a regra do BOTÃO SEM DESTINO, acima, que
      // faz aquela pergunta.
      //
      // UMA FRASE POR TIPO, e não uma só: quem toca um botão, quem manda o
      // e-mail e quem segue o perfil consertam isso de jeitos diferentes, e a
      // mensagem é o que o dono lê para saber qual é o seu caso.
      //
      // É ERRO DE ATIVAR e não de salvar, pelo mesmo critério do botão sem
      // destino: o bloco recém-arrastado ainda sem seta de saída é o estado
      // normal de quem acabou de arrastá-lo.
      if (retomaPelaSempre(passo) && seguinteDe(ligacoes, id) === null) {
        // O RÓTULO SAI DE `envioDaDm` e não de `passo.botao_label` pelo motivo
        // de sempre neste arquivo: é aquela função que decide o que a mensagem
        // entrega, e reler o campo cru aqui seria a segunda cópia da regra.
        const envio = passo.tipo === "dm" ? envioDaDm(passo) : null;
        r.push({
          nivel: "erro",
          quando: "ativar",
          indice: i,
          mensagem:
            passo.tipo === "pedir_email"
              ? "Não há nenhum bloco depois deste pedido de e-mail: quem mandar o endereço não recebe mais nada."
              : envio?.forma === "resposta_rapida"
                ? `Não há nenhum bloco depois desta mensagem: quem tocar em “${envio.rotulo}” não recebe nada.`
                : "Não há nenhum bloco depois deste pedido de follow: quem seguir o perfil não recebe mais nada.",
        });
      }
    }
  }

  // O AVISO POSICIONAL — "o link sai antes do pedido de follow" — ESTAVA AQUI, e
  // saiu na Tarefa 9. Ele não foi substituído: foi APAGADO, e o registro fica
  // porque a ausência dele é uma decisão, não um esquecimento.
  //
  // ELE LIA A ORDEM DO ARRAY (`indiceDoLinkAntesDoPortao`, acima, que contava
  // links vistos antes do primeiro portão), e a Tarefa 3b tirou a ordem de
  // circulação: quem decide o próximo bloco é a SETA. "Link antes do portão na
  // lista" deixou de significar "link antes do portão no fluxo" — a MESMA lista,
  // com as setas desenhadas ao contrário, entrega o link depois do portão, e ele
  // acendia assim mesmo.
  //
  // E ELE ERA A TERCEIRA VOZ. Sobre o mesmo bloco da mesma lista, ele dizia
  // "pode ser estratégia, quem decide é o dono" enquanto o erro de ativar do
  // portão contornável (lá embaixo) dizia "você não pode publicar". A
  // contradição foi medida e levada ao dono do produto, e a saída dele não foi
  // nenhuma das duas: virou a chave `entregaSemPortao`, por automação. Com duas
  // vozes — a regra e a chave que a cala — não sobra lugar para uma terceira.
  const ultimo = conferir(passos[passos.length - 1]).passo;
  if (ultimo?.tipo === "esperar") {
    r.push({
      nivel: "aviso",
      quando: "ativar",
      indice: passos.length - 1,
      mensagem: "Não há nenhum bloco depois desta espera, então ela não atrasa nada.",
    });
  }

  // -------------------------------------------------------------------------
  // O ANEL DE `sempre`: A CAMINHADA QUE NÃO TERMINA.
  //
  // `temCicloDeSempre` FOI ESCRITA NA TAREFA 2 E NUNCA TINHA SIDO CHAMADA. Até
  // esta linha, o único lugar do sistema que a mencionava fora dos testes era um
  // comentário — o do teto de passos, que já teve de ser corrigido uma vez por
  // prometer que ela estava ligada. É esta linha que torna aquele parágrafo
  // verdadeiro.
  //
  // E O TETO NÃO ERA SUBSTITUTO: ele interrompe UMA caminhada de `interpretar`
  // depois de 100 blocos, e a caminhada de entrega não é a única que anda. Quem
  // não retorna nunca é `executarFluxo` (lib/engine.ts), que chama a si mesmo a
  // cada portão vencido — o teto de `interpretar` não conta essas voltas, porque
  // cada uma delas é uma interpretação NOVA.
  //
  // É ERRO DE SALVAR porque é dado que o motor não consegue ler: com o anel
  // gravado, o webhook fica pendurado e a Meta reenvia o evento por 36 horas.
  // Nenhuma tela deve conseguir produzir isso, ativada ou não.
  //
  // `indice: null` porque o anel é da LISTA: ele tem dois ou mais blocos e
  // nenhum deles é "o culpado" — o que está errado é o desenho entre eles.
  if (temCicloDeSempre(passos, ligacoes)) {
    r.push({
      nivel: "erro",
      quando: "salvar",
      indice: null,
      mensagem:
        "Há uma volta no fluxo que o motor percorre sozinho, sem parar em nenhuma pergunta: a automação nunca termina de responder. Faça a volta passar por uma mensagem com botão, que é o que espera a pessoa.",
    });
  }

  // -------------------------------------------------------------------------
  // DUAS SAÍDAS PARA A MESMA CONDIÇÃO.
  //
  // `ligacoesDe` devolve as saídas na ordem em que foram gravadas, e tanto
  // `seguinteDe` quanto `ligacaoEscolhida` ficam com a PRIMEIRA que serve. A
  // segunda, então, é uma seta desenhada na tela que a execução nunca percorre —
  // e nada acusa. É ERRO DE SALVAR pelo mesmo critério de "identidade repetida":
  // o motor não consegue ler o que o desenho diz, porque o desenho diz duas
  // coisas.
  //
  // A REGRA É POR CONDIÇÃO, e não só por botão, porque o mecanismo é o mesmo nos
  // três casos — o desempate de `ligacoesDe` não conhece o tipo da condição.
  // Duas `sempre` saindo do mesmo bloco e duas `senao` são a mesma ambiguidade
  // que dois destinos para o mesmo botão, e a mensagem é que muda.
  //
  // DESTINOS IGUAIS NÃO CONTAM: duas setas para o mesmo lugar são redundância,
  // não ambiguidade — a execução segue para onde as duas mandam, e não há
  // decisão perdida.
  //
  // UM POR BLOCO: com três setas do mesmo botão, o dono conserta o bloco, não
  // cada par.
  for (let i = 0; i < passos.length; i++) {
    const id = identidadeDoPasso(passos[i], i);
    const primeiroDestino = new Map<string, string>();
    for (const l of ligacoesDe(ligacoes, id)) {
      // A MESMA CHAVE que o id da alça do quadro usa (`chaveDoQuando`, mais
      // acima). Ela era escrita à mão aqui.
      const chave = chaveDoQuando(l.quando);
      const ja = primeiroDestino.get(chave);
      if (ja === undefined) {
        primeiroDestino.set(chave, l.para);
        continue;
      }
      if (ja === l.para) continue;
      r.push({
        nivel: "erro",
        quando: "salvar",
        indice: i,
        mensagem:
          l.quando.tipo === "botao"
            ? "Um dos botões deste bloco tem duas setas saindo para blocos diferentes. Só a primeira leva alguém a algum lugar; a outra nunca é percorrida."
            : l.quando.tipo === "sempre"
              ? "Este bloco tem duas setas de continuação para blocos diferentes. Só a primeira é percorrida."
              : "Este bloco tem duas setas de “respondeu digitando” para blocos diferentes. Só a primeira é percorrida.",
      });
      break;
    }
  }

  // -------------------------------------------------------------------------
  // O PORTÃO CONTORNÁVEL POR DESENHO.
  //
  // O caso que a Tarefa 3b fechou no motor e NÃO pôde fechar no gatilho, com a
  // medição escrita lá e em `scripts/varredura-portao.mjs`: aplicar a regra do
  // portão na porta da frente faz uma seta de volta (um "quero outro" que
  // devolve ao menu) pôr o pedido de "me siga" como PRIMEIRA mensagem que todo
  // mundo recebe, sem nunca ver a boas-vindas. A porta da frente é o único ponto
  // em que "não há nada antes por onde passar" continua verdadeiro depois do
  // grafo.
  //
  // Sobra, então, o caso que só a MONTAGEM resolve: o dono põe um portão no
  // fluxo E desenha um caminho da entrada até o link que não passa por ele. O
  // motor obedece — é o desenho dele —, e o sintoma é o pior possível: o link
  // sai para quem não segue, e nada acusa.
  //
  // NÃO IMPEDE SALVAR — montar por partes é trabalho normal, e o portão que
  // ainda não foi ligado no meio do caminho é um estado de meio de desenho.
  // IMPEDE ATIVAR, que é o momento em que o dono diz "pode valer para o
  // público".
  //
  // COMO SE PERGUNTA: fechando o portão (`haCaminho` com `evitar`), o que ainda
  // alcança o link é exatamente o caminho que não passa por ele. É a mesma
  // pergunta que o BFS independente da varredura faz com o parâmetro `sem`.
  //
  // O LINK QUE É A PRÓPRIA ENTRADA entra pela primeira metade da condição, e
  // sem ela escaparia: `haCaminho` começa nas SAÍDAS da entrada, então um link
  // em `steps[0]` só seria "alcançável" se houvesse um anel voltando nele. Ele é
  // o caso mais óbvio de todos — sai no disparo, antes de qualquer portão.
  //
  // O PORTÃO QUE É A ENTRADA não produz caso nenhum: todo caminho começa dentro
  // dele, e não há como contorná-lo.
  //
  // A CHAVE DO DONO É QUEM CALA ESTA REGRA, E SÓ ESTA (Tarefa 9).
  //
  // A REGRA POSICIONAL QUE MORAVA ACIMA ("o link sai antes do pedido de follow")
  // CONTRADIZIA ESTA, e a contradição era MEDIDA, não uma preocupação de estilo.
  // Na lista `[boas-vindas, link, portão]` com a corrente que a migração grava
  // (`sempre` de cada bloco para o seguinte), `conferirLista` devolvia as duas
  // sobre O MESMO BLOCO — `indice: 1`, o link — com veredictos opostos:
  //
  //   AVISO: "O link sai antes do pedido de follow, então quem não segue recebe
  //     o link mesmo assim." Aviso não tranca porta nenhuma; a decisão ficava com
  //     o dono, e a razão escrita para isso era que aquilo pode ser estratégia —
  //     entregar primeiro e pedir o follow depois.
  //   ERRO DE ATIVAR (esta regra): "Dá para chegar neste link sem passar pelo
  //     pedido de follow." Ou seja: o dono NÃO pode publicar.
  //
  // Uma dizia "você decide", a outra diz "você não pode". Não era uma falar da
  // ordem e a outra do desenho — na corrente que a migração grava, ordem e
  // desenho são a mesma coisa, e é por isso que as duas acendiam juntas.
  //
  // LEVADA AO DONO DO PRODUTO, a contradição não foi resolvida por nenhum dos
  // dois lados: nem sempre é engano, nem sempre é estratégia, DEPENDE DA
  // AUTOMAÇÃO. Virou uma chave por automação — para o dono, "entregar o link sem
  // exigir que a pessoa siga" —, desligada por padrão. O aviso posicional foi
  // apagado (ver o lugar em que ele estava), e esta regra passou a ter um
  // interruptor com nome e dono.
  //
  // O QUE A CHAVE NÃO FAZ, e o limite é o que a torna honesta: o portão continua
  // funcionando NO MOTOR. Ela diz "não me impeça de publicar", e não "ignore o
  // portão em tempo de entrega" — `lib/engine.ts` nunca a lê, e um caminho
  // desenhado passando pelo portão continua passando por ele. O que muda é
  // exatamente uma coisa: o `push` abaixo deixa de acontecer.
  //
  // E O PREÇO, que o rótulo na tela diz junto: com ela ligada, esta era a ÚNICA
  // voz que avisaria que o link sai para quem não segue. Ninguém mais avisa.
  //
  // ELA NÃO ENCOSTA EM MAIS NADA. As outras regras de ativar — botão sem
  // destino, bloco inalcançável, menu grande demais, portão sem saída — e todos
  // os erros de salvar continuam iguais, porque a condição está SÓ aqui e não
  // num filtro no fim da função. Um filtro por mensagem, ou por `quando`, é como
  // isto viraria um "ignorar tudo" sem ninguém decidir que virou.
  //
  // E ISSO É MEDIDO, não deduzido: as quatro regras nomeadas acima, um erro de
  // salvar (o anel de `sempre`) e os avisos têm um teste cada, com a chave
  // LIGADA, em `tests/steps.test.ts` — o bloco "A CHAVE É ESTREITA" do describe
  // "conferirLista — a chave de entregar sem portão". Eles nasceram porque esta
  // frase já esteve escrita com só duas das regras medidas, e duas mutações
  // passaram por baixo dela sem deixar um teste vermelho: calar TAMBÉM o portão
  // sem saída, e o tal filtro de avisos no `return`. Quem acrescentar regra
  // nesta função e quiser citá-la aqui, acrescente o teste junto.
  const iPortao = indiceDoPortao(passos);
  if (!entregaSemPortao && temSeta && iPortao !== null) {
    const idPortao = identidadeDoPasso(passos[iPortao], iPortao);
    if (idPortao !== entrada) {
      for (let i = 0; i < passos.length; i++) {
        const { passo } = conferir(passos[i]);
        if (!passo || passo.tipo !== "dm" || !passo.url) continue;
        const id = identidadeDoPasso(passos[i], i);
        if (id === idPortao) continue;
        if (id === entrada || haCaminho(ligacoes, entrada, id, idPortao)) {
          r.push({
            nivel: "erro",
            quando: "ativar",
            indice: i,
            mensagem:
              "Dá para chegar neste link sem passar pelo pedido de follow, então ele sai para quem não segue. O portão só segura o que só é alcançável através dele.",
          });
        }
      }
    }
  }

  return r;
}

// SE A LISTA PODE FICAR ATIVA — verdadeiro quando não há nenhum `nivel: "erro"`
// com `quando: "ativar"` no resultado de `conferirLista`.
//
// A TAREFA 6b A ACHOU, e não estava no plano: `salvarAutomacao`
// (app/automacoes/actions.ts) gravava a coluna `active` filtrando só os erros
// de `quando === "salvar"`, e o painel do gatilho tem a caixa "Ativa" bem ao
// lado do botão Salvar. Ou seja: publicar um fluxo com botão sem destino, bloco
// inalcançável ou link contornando o portão não exigia clicar em "Ativar" —
// bastava marcar a caixa e salvar. A porta que a Tarefa 5 construiu
// (`toggleAutomation`, que recusa os dois níveis) tinha um jeito de nunca ser
// usada.
//
// A LISTA ACIMA É A DE HOJE, e não a que a Tarefa 6b escreveu: lá o terceiro
// item era "link antes do portão", o AVISO POSICIONAL, apagado na Tarefa 9 (o
// registro da morte dele está em `conferirLista`, no lugar em que ele ficava).
// Ele nunca chegou a barrar nada, porque era aviso e esta função só olha erro —
// então nada do que este parágrafo conta muda com a troca. O que sobrou no lugar
// dele é o erro de ativar do portão CONTORNÁVEL, que olha o caminho e não a
// ordem, e que a chave `entregaSemPortao` cala por automação.
//
// POR QUE ISTO MORA AQUI e não em `app/automacoes/actions.ts`, apesar de ser
// uma linha só: aquele arquivo tem `"use server"` no topo, e é o motivo desta
// fase inteira — regra escrita ali não é testável sem banco. A suíte que este
// arquivo tem hoje é o que garante que a decisão continua a mesma depois de
// qualquer mudança em `conferirLista`; movida para o Server Action, a mesma
// mudança só apareceria quebrada em produção.
//
// NÃO FILTRA POR `quando === "salvar"` DE PROPÓSITO: um erro dessa porta já
// travou o salvar mais acima, em `salvarAutomacao` — chegar aqui com um deles
// presente não muda esta resposta, porque quem barra o salvar já barrou antes.
export function podeFicarAtiva(problemas: Problema[]): boolean {
  return !problemas.some((p) => p.nivel === "erro" && p.quando === "ativar");
}

// O CONTEÚDO DE `botoes`, conferido elemento a elemento. Devolve a frase do DONO
// para UMA coisa errada, com a porta em que ela trava, ou null quando a lista
// está inteira.
//
// UMA FRASE POR BLOCO, e não uma por botão: as cinco causas abaixo se consertam
// no mesmo lugar — o menu daquele bloco —, e cinco linhas vermelhas sobre o
// mesmo nó só escondem qual é o bloco culpado.
//
// AS CINCO CAUSAS, e cada uma tem um mecanismo próprio no motor:
//
//   NÃO É LISTA — `envioDaDm` faz `Array.isArray` e não reconhece o menu, então
//     a mensagem sai como texto puro (ou como resposta rápida, se houver
//     rótulo). A tela promete um menu e a pessoa recebe outra coisa.
//   ELEMENTO NULO OU QUE NÃO É OBJETO — é a QUEDA, e é o caso caro:
//     `enfileirarPasso` (lib/engine.ts) faz `envio.botoes.map(b => b.rotulo)`, e
//     `null.rotulo` estoura `TypeError`. O comentário do bloco de botões, lá em
//     cima, tem o estrago inteiro.
//   ID COM DOIS-PONTOS — o id viaja dentro do payload
//     (`AUTO:<automação>:<bloco>:<botão>`), e `lerPayload` separa por `:` e
//     recusa mais de quatro partes. O botão é entregue, é tocável, e o toque
//     não faz absolutamente nada — sem erro em lugar nenhum, porque não há
//     linha em Atividade para um toque que não decide nada.
//   IDS REPETIDOS DENTRO DO BLOCO — `ligacaoEscolhida` casa pelo id e fica com a
//     primeira ligação que serve, então os dois botões levam ao mesmo destino,
//     por mais diferentes que sejam os rótulos.
//   RÓTULO EM BRANCO — `botoesDaMensagem` descarta o par, e o botão some da
//     mensagem. Descartando TODOS, o menu sai vazio, que é o
//     `menu_sem_botoes` de lib/queue-drain.ts.
//
// AS QUATRO PRIMEIRAS TRAVAM O SALVAR; A QUINTA SÓ O ATIVAR, e a linha entre
// elas é a do tipo `Problema`: salvar é dado que o motor NÃO CONSEGUE LER,
// ativar é fluxo que ele lê perfeitamente e ENTREGA ERRADO por montagem pela
// metade.
//
//   As quatro primeiras são inalcançáveis pelo editor, e por um motivo mais
//     forte do que "a tela não edita o id de um botão": o editor não escreve
//     `botoes` NENHUM ainda. `blocoNovo` (app/automacoes/editor/modelos.ts)
//     nunca semeia essa chave, em nenhum dos nove ramos, e
//     `grep -rn botoes app/automacoes/editor/` só acha duas linhas de
//     comentário, nenhuma de código. `novoIdDeBotao` já existe (lib/steps.ts),
//     mas ninguém no editor o chama. Chegar nas quatro primeiras é lista
//     montada fora do painel — dado, não montagem.
//   O RÓTULO EM BRANCO vai ser o estado mais normal de menu pela metade quando
//     o editor ganhar o botão "adicionar botão" (Tarefa 6/7): o dono clica, o
//     painel grava `{id:"op_…", rotulo:""}` e ele sai para o almoço. Travar o
//     salvar aí seria hostil — ele ficaria sem onde guardar o meio do trabalho
//     —, e o sintoma é "entrega errado" (o botão some da mensagem), não "o
//     motor não lê". Ela nasceu em "salvar" junto com as outras quatro e foi
//     movida por decisão de produto, com o critério que a própria Tarefa 5
//     escreveu.
//
// A ORDEM DE PRECEDÊNCIA NÃO É A DA LISTA, e essa é a parte que a separação
// custou. Com uma frase por bloco e duas portas, "a primeira coisa errada"
// deixou de servir: num menu `[{rotulo:""}, null]` a varredura por ordem
// devolveria o rótulo em branco (ativar), e a QUEDA — que derruba o lote inteiro
// de eventos daquela requisição — passaria no salvar. Por isso o rótulo em
// branco é GUARDADO e a varredura continua: quem sai é a primeira causa de
// SALVAR que houver na lista toda, e o rótulo só é devolvido quando não há
// nenhuma. A porta mais forte ganha, venha ela de qual posição vier.
//
// A FORMA `op_……` NÃO É EXIGIDA, e a diferença para `FORMA_DO_ID` (a dos blocos)
// é de mecanismo, não de rigor: a do bloco é exigida porque a identidade entra
// na `dedupe_key` e um id fora da forma COLIDE com a chave por índice de outro
// bloco, em silêncio. O id de botão não entra em chave nenhuma — ele só precisa
// atravessar o payload e casar com a ligação, e é isso que as duas linhas acima
// conferem. `lerPayload` registra a mesma escolha para o lado leitor.
function botoesCrus(bruto: unknown): { quando: "salvar" | "ativar"; mensagem: string } | null {
  if (!Array.isArray(bruto)) {
    return {
      quando: "salvar",
      mensagem:
        "A lista de botões deste bloco não é uma lista, e por isso ela não é entregue: a mensagem sai sem botão nenhum.",
    };
  }
  const vistos = new Set<string>();
  let semTexto: { quando: "ativar"; mensagem: string } | null = null;
  for (const b of bruto) {
    if (!b || typeof b !== "object") {
      return {
        quando: "salvar",
        mensagem:
          "Um dos botões deste bloco está corrompido, e ele derruba o envio da automação inteira naquele momento.",
      };
    }
    const o = b as Record<string, unknown>;
    if (typeof o.id !== "string" || !o.id || o.id.includes(":")) {
      return {
        quando: "salvar",
        mensagem:
          "Um dos botões deste bloco tem uma identidade inválida: ele é entregue, mas o toque nele não faz nada.",
      };
    }
    if (vistos.has(o.id)) {
      return {
        quando: "salvar",
        mensagem:
          "Dois botões deste bloco têm a mesma identidade, e por isso os dois levam ao mesmo lugar.",
      };
    }
    vistos.add(o.id);
    if (!semTexto && (typeof o.rotulo !== "string" || !o.rotulo.trim())) {
      semTexto = {
        quando: "ativar",
        mensagem:
          "Um dos botões deste bloco está sem texto, e botão sem texto não é entregue: ele some da mensagem.",
      };
    }
  }
  return semTexto;
}
