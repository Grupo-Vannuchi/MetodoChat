// O ROTEIRO DA CONVERSA: a lista de blocos virando a sequência de coisas a
// desenhar na prévia.
//
// Arquivo PURO de propósito — sem React, sem DOM, sem cor, sem classe de CSS.
// Recebe `Passo[]` e devolve uma lista de cenas. É pelo mesmo motivo de
// `./geometria`: nesta fase, o que virou função pura testada não deu defeito, e
// o que ficou solto dentro de um `.tsx` deu em toda tarefa.
//
// A DIVISÃO DE TRABALHO com `previa.tsx` é a regra deste arquivo: aqui mora
// QUEM FALA, EM QUE ORDEM e ONDE O FLUXO PARA; lá mora como isso aparece. Uma
// decisão de conteúdo escrita no JSX é uma decisão sem teste.
//
// AS REGRAS DE CONTEÚDO VÊM DE `lib/steps.ts`, e não são reescritas aqui:
// `conferir` diz se o bloco é enviado, `envioDaDm` diz em que forma uma `dm`
// sai, e `esperaResposta` diz se o bloco para o fluxo. Copiá-las para cá criaria
// uma segunda fonte de verdade justamente para as coisas que a prévia existe
// para contar — e a prévia mentindo sobre o fluxo é pior do que prévia nenhuma.
//
// E `esperaResposta` MANDA NOS TRÊS QUE PARAM, não só na `dm`. A versão
// anterior deste arquivo consultava `esperaResposta` no ramo `dm` e escrevia a
// parada À MÃO nos ramos `pedir_follow` e `pedir_email` — o cabeçalho prometia
// fonte única e ela valia em um terço dos casos. A revisão provou a divergência
// mutando `esperaResposta` para o `pedir_email` deixar de esperar:
// `tests/editor-roteiro.test.ts` continuava verde e a prévia continuava
// desenhando a parada. Hoje os três passam pela função, e a mesma mutação
// acende teste.
//
// SEM O TIPO `Passo` NA ASSINATURA de propósito — ver `roteiro`, lá embaixo: a
// entrada é `unknown`, e quem devolve o passo já tipado é `conferir`.
//
// E DESDE A TAREFA 8 ELE DECIDE MAIS UMA COISA: QUAL CAMINHO MOSTRAR. As
// ligações fizeram do fluxo um mapa, e um mapa não tem "a" conversa — tem uma
// por braço. Escolher o braço é decisão de conteúdo como todas as outras deste
// arquivo, e por isso mora aqui, com teste, e não dentro do `.tsx`.
//
// A TRAVESSIA DO GRAFO NÃO É REESCRITA AQUI: `ligacoesDe` e `seguinteDe`
// (lib/steps.ts) respondem "que setas saem daqui" e "qual é a `sempre`", e são
// as MESMAS que o motor consulta. O que este arquivo acrescenta é a escolha de
// braço — e ela está escrita em `saidasMostradas`, logo abaixo.
import {
  conferir,
  envioDaDm,
  esperaResposta,
  identidadeDoPasso,
  indiceDoId,
  ligacaoEscolhida,
  ligacoesDe,
  seguinteDe,
  type Quando,
} from "@/lib/steps";

// O que a prévia desenha. Cada item é uma coisa na tela, na ordem em que ela
// aparece na conversa.
//
// `balao` é o que A CONTA manda; `resposta` é o que A PESSOA manda de volta —
// o toque no botão (que no Instagram entra na conversa como mensagem dela) ou
// o endereço de e-mail digitado.
export type Bolha =
  // Uma mensagem da conta. `botao` é o rótulo, quando há; `link` diz se ele
  // abre um endereço (vai dentro do balão) ou se é resposta rápida (vira uma
  // pílula solta, que a pessoa toca).
  | { tipo: "balao"; texto: string; botao: string | null; link: boolean }
  // O MENU DE ESCOLHA — os botões de um `dm` com `botoes`, que o Instagram
  // entrega como respostas rápidas lado a lado.
  //
  // É TIPO PRÓPRIO, e não um `balao` com uma lista dentro, porque a pergunta
  // que ele responde é outra: o balão diz o que a conta MANDOU, e este diz o
  // que a pessoa PODE TOCAR. Enfiar a lista no balão faria a `dm` de resposta
  // rápida (um botão) e o menu (vários) virarem o mesmo caso na tela, quando o
  // que os separa é justamente haver mais de um caminho a partir dali.
  //
  // `escolhido` É A LIGAÇÃO ENTRE AS DUAS TELAS: é o botão pelo qual a conversa
  // desenhada segue — o braço que está sendo mostrado. Sem ele o menu apareceria
  // com dois botões e a conversa continuaria por um deles sem dizer qual, que é
  // a prévia mentindo por omissão sobre a única coisa que o menu decide.
  //
  // NENHUM `escolhido` É CASO NORMAL, e são CINCO. A lista já esteve errada
  // aqui — dizia "três" e omitia justamente o único que NÃO é fim de caminho:
  //
  //   MENU SEM LIGAÇÃO DE BOTÃO NENHUMA — quem está montando.
  //   MENU QUE É O FIM DO CAMINHO MOSTRADO.
  //   MENU CUJAS SAÍDAS TODAS VOLTAM para blocos já desenhados (o anel). É
  //     "todas", e não "a primeira": desde a revisão da Tarefa 8 a cauda pula a
  //     saída que repete e segue pela próxima (`seguindoDe`), então basta um
  //     braço novo para haver pílula marcada.
  //   MENU CUJO CAMINHO SAI PELA `senao` OU PELA `sempre` — ninguém tocou em
  //     botão nenhum, e o que conta isso é a marca `retomada`, logo abaixo.
  //   LIGAÇÃO DE BOTÃO CITANDO UM ID QUE NÃO ESTÁ EM `botoes`, e ESTE é o que
  //     não é fim de caminho nem tem marca. Medido: a conversa CONTINUA, e
  //     nenhuma pílula fica marcada — exatamente a omissão que `escolhido`
  //     existe para impedir. Ele é produzível apagando um botão e deixando a
  //     ligação dele para trás; `conferirLista` não diz nada sobre a ligação
  //     órfã — o QUADRO passou a desenhá-la numa alça própria, rotulada "botão
  //     apagado" (`alcasDoQuadro`, ./modelos), mas a prévia continua sem marca
  //     para ela. Fica anotado aqui em vez de voltar a ser premissa.
  //
  // E HÁ UM SEXTO CASO QUE NEM CHEGA A ESTA BOLHA, e ele é irmão do último: o
  // BLOCO QUE DEIXOU DE SER MENU. Um bloco com `url` E `botoes` faz
  // `envioDaDm` (lib/steps.ts) devolver `link`, as ligações de botão continuam
  // gravadas, e `caminhoDoBotao` continua entregando o braço delas — mas a cena
  // não desenha `botoes` nenhum, porque o bloco não é mais um menu. Então o braço
  // do botão APARECE no caminho, sem pílula alguma dizendo por qual botão ele
  // saiu. É o preço de a prévia não esconder o que o motor entrega, e é o certo:
  // a cena não mente, ela só não tem rótulo para mostrar. A cabeça de
  // `saidasMostradas` (abaixo) mede o caso por extenso.
  | { tipo: "botoes"; botoes: { rotulo: string; escolhido: boolean }[] }
  // A MARCA DA PARADA. É a informação mais valiosa da prévia: daqui não sai
  // nada até a pessoa fazer alguma coisa.
  | { tipo: "parada"; motivo: "toque" | "follow" | "email" }
  | { tipo: "resposta"; texto: string }
  // POR QUE A CONVERSA SEGUIU, quando ela não seguiu por um toque em botão.
  //
  // É MARCA, E NÃO BOLHA, e a diferença é a razão inteira de este tipo existir.
  // A prévia desenha à direita o que A PESSOA MANDA, e nestes dois casos ela não
  // mandou nada que esta tela conheça: no `digitou` ela escreveu um texto que só
  // ela sabe, e no `continuacao` não houve gesto nenhum. Pôr qualquer um dos
  // dois num balão azul inventaria uma mensagem que ninguém mandou — e deixá-los
  // de fora escondia o bloco inteiro, que é o defeito que este tipo veio
  // corrigir. A marca diz o caminho sem inventar o texto.
  //
  //   `digitou`     — a `senao` DE UM BLOCO QUE PARA, e a segunda metade é a
  //                   parte que já esteve errada aqui. Quem responde ESCREVENDO
  //                   em vez de tocar segue por aqui, e quem resolve isso no
  //                   motor é `retomadaDoTexto` (lib/steps.ts) — que só é
  //                   chamada do ramo do CURSOR, e o cursor só descansa onde
  //                   `esperaResposta` diz sim. Num bloco que NÃO para não há
  //                   ninguém parado para digitar, a marca afirmaria um gesto que
  //                   não existe, e `saidasMostradas` (abaixo) exclui essa
  //                   `senao` justamente por isso.
  //   `continuacao` — a `sempre` DE UM MENU, e só dela: num bloco sem botões a
  //                   `sempre` é a conversa simplesmente seguindo, e marcar toda
  //                   continuação encheria de ruído o fluxo mais comum que
  //                   existe. Num menu ela é outra coisa — o caminho das
  //                   retomadas que não sabem qual foi o gesto
  //                   (`retomadaDoBotao` e `retomadaDoFallback`, lib/steps.ts) —,
  //                   e é isso que a marca conta.
  | { tipo: "retomada"; via: "digitou" | "continuacao" }
  // `esperar` não é mensagem: é uma marca de tempo entre os balões.
  | { tipo: "tempo"; texto: string }
  // Estas duas NÃO são DM, e é por isso que têm tipo próprio em vez de virarem
  // balão: a resposta pública sai no comentário do post, e o coraçãozinho é
  // uma reação na mensagem que a pessoa mandou.
  //
  // AS DUAS CARREGAM O QUE O GATILHO DECIDE, e carregam aqui em vez de na tela.
  // A `resposta_publica` já era consciente do gatilho — mas pela prop `noPost`
  // de `previa.tsx`, ou seja, numa decisão de conteúdo escrita no JSX —, e o
  // `reagir_story` não era de jeito nenhum: com o gatilho de comentário o nó
  // ficava com borda vermelha (`conferirLista` acusa) e a prévia, logo abaixo do
  // mesmo erro, prometia "reage à mensagem que a pessoa mandou". Agora as duas
  // decidem no mesmo lugar, com teste.
  //
  // `situacao` da pública, e os três casos são os que `conferirLista` conhece:
  //   `publicada`      — sai mesmo. Só no gatilho de comentário, e só a
  //                      PRIMEIRA da lista.
  //   `fora_do_gatilho`— `enfileirarPasso` (lib/engine.ts) faz
  //                      `if (!contexto.commentId) return`, e só o comentário
  //                      traz o post a responder.
  //   `repetida`       — a segunda em diante. `commentReplyKey(comment_id)`
  //                      (lib/dedupe.ts) é a mesma string das duas, e o
  //                      `on conflict do nothing` engole a segunda.
  //
  // `vazias` é quantas das variações não têm nada escrito. O motor SORTEIA uma
  // delas a cada disparo e desiste quando a sorteada está em branco, então
  // "uma das 2 variações" sem essa contagem promete duas e entrega uma às
  // vezes — a perda intermitente que `conferirLista` decidiu não acusar, e que
  // a prévia PODE dizer porque ela é o lugar onde se vê o resultado.
  | {
      tipo: "publica";
      texto: string;
      variacoes: number;
      vazias: number;
      situacao: "publicada" | "fora_do_gatilho" | "repetida";
    }
  // `alvo` é a QUEM o coraçãozinho reage naquele gatilho, e o `nenhum` é o
  // ponto: no gatilho de comentário não chega mensagem nenhuma, o bloco não
  // roda, e a cena não pode prometer entrega.
  | { tipo: "reacao"; emoji: string; alvo: "story" | "mensagem" | "nenhum" }
  // Bloco que `conferir` recusa. Ele NÃO é enviado — `interpretar` o ignora —,
  // então ele não pode aparecer como se fosse uma mensagem.
  | { tipo: "incompleto"; mensagem: string };

// Uma cena é TUDO o que um bloco produz, junto com a identidade dele.
//
// O agrupamento por bloco não é organização: é o que permite destacar na
// prévia o bloco que está aberto no painel. Uma lista achatada de bolhas
// perderia a fronteira — a `dm` de resposta rápida produz três itens (o balão,
// a marca da parada e o toque da pessoa), e destacar só o primeiro deixaria a
// parada de fora justamente no bloco em que ela é a informação principal.
//
// PELA IDENTIDADE, E NÃO MAIS PELO ÍNDICE, desde a Tarefa 8. O índice era o que
// casava a cena com o bloco selecionado no quadro enquanto a prévia desenhava o
// array inteiro, na ordem dele. Agora ela desenha um CAMINHO, e um caminho salta
// posições — o índice deixaria de ser crescente, e o quadro teria de traduzir
// identidade↔posição só para acender uma cena. `selecionado` no quadro JÁ É uma
// identidade (`identidadeDoPasso`, lib/steps.ts): comparar identidade com
// identidade tira o tradutor do meio.
export type Cena = { id: string; itens: Bolha[] };

// O endereço de exemplo que a pessoa "responde" ao pedido de e-mail. Mora aqui,
// e não no JSX, para a prévia inteira ser decidida num arquivo com teste. É o
// mesmo exemplo que a prévia antiga usa.
const EMAIL_DE_EXEMPLO = "ana@email.com";

// O rótulo do botão de link quando ele está sem nome. `conferir` (lib/steps.ts)
// não exige `botao_label` em `dm` nenhuma, então este caso chega aqui.
//
// ELE FICA PORQUE É VERDADE, e a frase abaixo existe para ninguém "uniformizar"
// os dois padrões de novo — houve um `FOLLOW_PADRAO` irmão deste, e ele saiu.
//
// `linkMessage` (lib/ig.ts) monta o botão com
// `title: buttonLabel || "Abrir link"`: sem rótulo, o botão SAI, com esse texto
// exato. A prévia desenhando "Abrir link" está mostrando o que a pessoa vai
// receber.
//
// O PORTÃO NÃO TEM NADA DISSO, e é por isso que os dois só PARECEM simétricos.
// `resolverFollow` (lib/engine.ts) passa `quick_reply_label: passo.botao_label`
// sem default nenhum, e `lib/queue-drain.ts` exige
// `quick_reply_label && quick_reply_payload` para montar a resposta rápida —
// com o rótulo vazio a mensagem cai no `else` e sai como TEXTO PURO, sem botão.
// Um `FOLLOW_PADRAO` aqui desenharia uma pílula que o Instagram nunca entrega,
// escondendo justamente a armadilha. Quem recusa esse bloco é `conferirLista`
// (lib/steps.ts), com ERRO, e a prévia mostra a consequência: balão sem botão e
// a parada logo abaixo, sem ninguém para tocá-la.
const LINK_PADRAO = "Abrir link";

// A marca de tempo de um `esperar`, em português de gente.
//
// Arredonda porque `conferir` (lib/steps.ts) aceita qualquer número finito não
// negativo — inclusive `0.5`, que o campo de minutos do painel produz se alguém
// digitar isso. "0,5 minutos depois" não é frase.
//
// ZERO NÃO É ERRO e por isso não é acusado aqui: `conferirLista` (lib/steps.ts)
// decidiu de propósito não reclamar de `minutos: 0` — a espera não atrasa nada,
// mas também não quebra nada. A prévia diz o que acontece: nada de espera.
export function textoDoTempo(minutos: number): string {
  const m = Math.round(minutos);
  if (m <= 0) return "logo em seguida";
  if (m < 60) return `${m} ${m === 1 ? "minuto" : "minutos"} depois`;
  const horas = Math.floor(m / 60);
  const resto = m % 60;
  const parte = `${horas} ${horas === 1 ? "hora" : "horas"}`;
  return resto ? `${parte} e ${resto} min depois` : `${parte} depois`;
}

// ---------------------------------------------------------------------------
// O CAMINHO MOSTRADO — a escolha de braço, e ela é toda desta seção.
// ---------------------------------------------------------------------------

// Uma saída de um bloco DO PONTO DE VISTA DA PRÉVIA: para onde a conversa
// segue, e POR QUE GESTO ela segue.
//
// O `quando` É A CONDIÇÃO INTEIRA, e não mais só o id do botão. Ele passou a
// ser preciso quando a prévia deixou de percorrer apenas botão e `sempre`: a
// cena tem de DIZER por que a conversa continuou, e "tocou no botão X",
// "digitou alguma coisa" e "o fluxo foi retomado sem saber onde a pessoa parou"
// são três respostas diferentes que a tela não pode confundir numa só.
type Saida = { para: string; quando: Quando };

// POR ONDE A CONVERSA DESENHADA PODE SEGUIR, na ordem em que O MOTOR prefere as
// setas.
//
// A REGRA DESTA FUNÇÃO É A DA FASE, E ELA TEM DUAS DIREÇÕES. A Tarefa 7 fixou
// que o quadro não pode desenhar uma seta que promete um caminho que o motor não
// percorre; a revisão da Tarefa 8 fixou o espelho, e A PRÉVIA NÃO PODE ESCONDER
// UM CAMINHO QUE O MOTOR PERCORRE. Esta função já errou nos DOIS sentidos, e as
// duas versões erradas estão registradas por extenso mais abaixo — inclusive a
// que consertava o esconder e passava a desenhar seta morta no mesmo commit.
//
// ELA DEVOLVE AS SETAS QUE O MOTOR PERCORRE a partir do bloco, e nenhuma que ele
// não percorra. NENHUMA DELAS É REESCRITA AQUI: cada uma sai da MESMA função de
// lib/steps.ts que o motor consulta, que é a regra deste arquivo.
//
//   TOQUE -> as ligações de BOTÃO, todas, em ordem, E SEM PERGUNTAR SE O BLOCO
//     AINDA É UM MENU. Quem resolve o toque no motor é `caminhoDoBotao`
//     (lib/steps.ts): ela lê `ligacaoEscolhida(..., {tipo:"botao"})` do bloco que
//     veio no payload e confere só se o DESTINO está na lista — não olha
//     `botoes`, não olha `conferir`. O motivo está escrito em `cursorDaRetomada`,
//     ao lado dela: o botão fica congelado na conversa desde o dia em que foi
//     entregue e continua tocável para sempre. E um menu inteiramente ligado não
//     precisa de `sempre` nenhuma, então perguntar só `seguinteDe` a ele diria
//     "acabou aqui" sobre todo menu certo do produto.
//   DIGITOU -> a `senao`, por `ligacaoEscolhida(..., {tipo:"texto"})`, SÓ EM
//     BLOCO QUE PARA. É a PRIMEIRA escolha de `retomadaDoTexto`, e esta é a
//     mesma chamada — mas `retomadaDoTexto` só é chamada do ramo do CURSOR
//     (lib/engine.ts), e o cursor só descansa onde `interpretar` gravou
//     `pararEm`, que é onde `esperaResposta` diz sim.
//   CONTINUAÇÃO -> a `sempre`, por `seguinteDe`. É a seta que `interpretar`
//     percorre sozinha, é onde `retomadaDoTexto` cai pelo `?? seguinteDe`
//     quando não há `senao`, e é por onde saem `retomadaDoBotao` e
//     `retomadaDoFallback`.
//
// A ORDEM DEPENDE DE O BLOCO PARAR, e quem responde isso é `esperaResposta`,
// como em todo o resto deste arquivo, e não uma cópia da regra escrita aqui:
//
//   O BLOCO QUE PARA tem toque, depois `senao`, depois `sempre`. O `senao`
//     antes da `sempre` é a ordem do `?? seguinteDe` de `retomadaDoTexto`: quem
//     digita segue a `senao` sempre que ela existe. Todo menu para, então a
//     `sempre` de um menu é a ÚLTIMA da lista — que é o lugar dela, já que ela só
//     serve às retomadas que não sabem qual foi o gesto.
//   O BLOCO QUE NÃO PARA tem a `sempre` ANTES do toque, e não tem `senao`
//     nenhuma. A `sempre` vem antes porque `interpretar` a percorre sozinha, no
//     MESMO disparo, para todo mundo; o braço do botão dele só acende se alguém
//     tocar depois num botão congelado, o que é o caso raro e não o padrão. A
//     revisão sugeriu colapsar os dois ramos do `return` num só, e isso está
//     recusado de propósito: colapsar poria o braço do botão congelado na frente
//     da `sempre` que todo mundo percorre, e a prévia mostraria o caso raro como
//     se fosse a conversa.
//
// AS DUAS EXCLUSÕES, E AS DUAS SÃO `senao`. Esta lista já disse "a única" duas
// vezes, e nas duas estava errada — é o defeito desta fase na forma de contagem:
//
//   A `senao` DE UM `pedir_follow`. Ela não é escolha desta tela:
//     `retomadaDoTexto` retoma o portão DELE MESMO, com ou sem `senao`, e o
//     comentário dela diz por quê — bastaria mandar "ok" para receber o link sem
//     seguir. Uma prévia que desenhasse esse braço mostraria ao dono uma porta
//     dos fundos que o motor recusa, que é exatamente o defeito da Tarefa 7
//     acontecendo nesta tela em vez de no quadro.
//   A `senao` DE UM BLOCO QUE NÃO PARA. Ninguém fica parado ali para digitar, e
//     é o motor que diz isso: `interpretar` (lib/steps.ts) só grava `pararEm`
//     onde `esperaResposta` diz sim, e `retomadaDoTexto` só é chamada do ramo do
//     cursor. Medido, num `dm` de link com `senao` para `b_digit01`:
//     `interpretar` enfileira o bloco e devolve `pararEm: null` — o fluxo ACABA
//     ali, `b_digit01` não é entregue a pessoa nenhuma —, e a prévia desenhava
//     `["b_menu001","b_digit01"]` e ainda fechava a cena com a marca "quem
//     respondeu digitando", AFIRMANDO UM GESTO QUE NÃO EXISTE. Pô-la "no fim da
//     lista" não resolvia: no fim ainda é percorrida quando não sobra mais nada,
//     e num menu inteiramente ligado não há `sempre`.
//
// O QUE ELA JÁ ESCONDEU, e os três foram medidos antes de serem consertados:
//
//   A `sempre` DE UM MENU. O ramo do menu devolvia SÓ as ligações de botão, e o
//     comentário antigo afirmava que a `senao` era "a única exclusão desta
//     função" — a segunda exclusão estava no código e não estava escrita. E ela
//     não é seta morta: o comentário de `conferirLista` (lib/steps.ts) mede isso
//     por extenso, e `retomadaDoTexto` cai nela pelo `?? seguinteDe` quando não
//     há `senao`. Medido, com o menu INTEIRAMENTE ligado e uma `sempre` saindo
//     dele: o motor entrega `{portao:null, destino:"b_smp004"}` e a prévia
//     desenhava `["b_smp004"]`, um bloco solto — o motor entregava e a prévia
//     dizia que o bloco não era de fluxo nenhum.
//   A `senao` DE UM BLOCO QUE PARA. O comentário antigo dizia que inventar o
//     texto digitado "seria a prévia mostrando uma mensagem que ninguém mandou",
//     e aceitava em troca o bloco invisível. As duas metades caíram. A prévia não
//     precisa inventar mensagem nenhuma para desenhar esse passo, porque ele é
//     uma MARCA e não uma bolha (`Bolha.retomada`, lá em cima); e o argumento já
//     estava falsificado por ESTE arquivo, onde `EMAIL_DE_EXEMPLO` é empurrado
//     como `{tipo:"resposta"}` há tarefas. As outras três superfícies do MESMO
//     painel já tratavam o bloco da `senao` como parte do fluxo: o quadro
//     desenha a seta, na alça "digitou"; o motor entrega
//     (`retomadaDoTexto` -> o destino da `senao`); e a conferência o trata como
//     rio abaixo da entrada — ela NÃO diz "Nenhuma seta chega neste bloco",
//     porque `haCaminho` conta TODAS as condições. Três de quatro concordavam,
//     e a prévia era a dissidente na mesma tela.
//   O TOQUE DE UM BLOCO QUE DEIXOU DE SER MENU, e este é o mesmo defeito num
//     vizinho, encontrado depois de os dois de cima terem sido fechados. O ramo
//     do toque só existia sob `envioDaDm(passo).forma === "botoes"`, e o motor
//     não pergunta isso. O caso é um bloco com `url` E `botoes`: `envioDaDm`
//     (lib/steps.ts) dá precedência a `url` sobre `botoes`, `apagarBotao`
//     (./modelos) não roda, e as ligações de botão ficam para trás.
//
//     AQUI ESTEVE ESCRITO QUE UM GESTO O PRODUZ — "digitar uma URL num menu já
//     ligado" —, e isso é FALSO: não há onde digitar. O campo do endereço só
//     aparece sob `passo.url !== undefined` (./painel) e o editor de botões só
//     sob `passo.botoes !== undefined`; nenhum item da paleta semeia as duas
//     chaves (`blocoNovo`, ./modelos: `url: ""` só em `dm_link`, `botoes` só em
//     `dm_opcoes`). Chega-se lá por dado legado ou por POST direto — o mesmo
//     lugar de onde vem o caso de cima. A correção fica de pé sem a premissa:
//     ela fez a prévia mostrar MAIS, e o motor entrega esse braço venha o dado
//     de onde vier.
//     Medido, com o menu ligado a `b_toca001` e uma `senao` a `b_digit01`: a
//     prévia desenhava `["b_menu001","b_digit01"]` — o braço do botão SUMIU —,
//     abrir `b_toca001` mostrava um bloco solto, `caminhoDoBotao` entregava
//     `{portao:null, destino:"b_toca001"}` e `conferirLista` devolvia `[]`. O
//     motor entregava, a conferência calava, e a prévia escondia.
//
// O BLOCO QUE `conferir` RECUSA TAMBÉM TEM RAMO DE BOTÕES, e a versão anterior
// dizia o contrário com o argumento de que "um bloco incompleto não tem `botoes`
// em que confiar". O argumento é sobre o CONTEÚDO do bloco, e a seta não é
// conteúdo: `caminhoDoBotao` não chama `conferir` em lugar nenhum, então o toque
// num botão congelado de um bloco cujo texto foi apagado depois continua sendo
// entregue. O que ele não ganha é `senao` — ele não para, `interpretar` o ignora
// e segue pela `sempre` —, e é a mesma regra do bloco que não para, acima.
function saidasMostradas(passos: unknown, ligacoes: unknown, id: string): Saida[] {
  const i = indiceDoId(passos, id);
  const passo = i === null ? undefined : conferir((passos as unknown[])[i]).passo;
  // O BLOCO PARA AQUI? É a pergunta que decide a `senao` e a ordem, e ela é
  // feita UMA vez porque as duas respostas têm de ser a mesma.
  const para = passo ? esperaResposta(passo) : false;

  // SEM PERGUNTAR SE O BLOCO AINDA É UM MENU — `caminhoDoBotao` também não
  // pergunta. O porquê está no comentário acima.
  const porToque: Saida[] = [];
  for (const l of ligacoesDe(ligacoes, id)) {
    if (l.quando.tipo === "botao") porToque.push({ para: l.para, quando: l.quando });
  }

  const digitou =
    passo && para && passo.tipo !== "pedir_follow"
      ? ligacaoEscolhida(ligacoes, id, { tipo: "texto" })
      : null;
  const porTexto: Saida[] = digitou === null ? [] : [{ para: digitou, quando: { tipo: "senao" } }];

  const sempre = seguinteDe(ligacoes, id);
  const porContinuacao: Saida[] =
    sempre === null ? [] : [{ para: sempre, quando: { tipo: "sempre" } }];

  // O `return` É SÓ SOBRE ORDEM, e `...porTexto` aparece nos dois ramos de
  // propósito: no ramo de baixo ele é VAZIO POR CONSTRUÇÃO — `digitou` já disse
  // `null` para todo bloco que não para. A exclusão mora numa linha só, lá em
  // cima, e não metade lá e metade aqui. Ela chegou a estar nos dois lugares, e
  // o preço foi medido: com a guarda duplicada, apagar a de cima não acendia
  // teste nenhum, porque a de baixo segurava calada.
  return para
    ? [...porToque, ...porTexto, ...porContinuacao]
    : [...porContinuacao, ...porToque, ...porTexto];
}

// O CAMINHO DA ENTRADA ATÉ O BLOCO ABERTO NO PAINEL. `null` quando não há
// nenhum — o bloco está solto, ou só é alcançável pela `senao`.
//
// EM PROFUNDIDADE, E NÃO EM LARGURA, e a diferença é a regra do bloco de
// JUNÇÃO: um bloco em que dois braços se encontram tem mais de um caminho até
// ele, e algum tem que ganhar. Ganha o PRIMEIRO BRAÇO EM ORDEM DE LIGAÇÃO —
// desce inteiro pelo primeiro, e só volta atrás quando ele não chega. É a mesma
// regra de desempate que `ligacoesDe` (lib/steps.ts) já usa em todo o resto do
// grafo: havendo mais de uma que sirva, ganha a primeira gravada.
//
// Em largura a resposta seria "o braço mais CURTO", e isso é pior por um motivo
// concreto e MEDIDO: com braços de 3 e 2, acrescentar UM bloco no braço B faz a
// junção saltar para o A — o dono vê a conversa trocar por ter editado O OUTRO
// braço, que é a regra desta fase sendo violada. O comprimento de um braço muda
// quando se acrescenta um bloco no meio dele; a ordem das setas só muda quando
// as setas mudam.
//
// E O QUE A PROFUNDIDADE CUSTA, dito porque este arquivo não deixa escolha sem
// o preço escrito, e porque o contra-exemplo existe e foi medido: num menu com
// "Ver tudo" gravado primeiro e "Direto" segundo, os dois chegando no MESMO
// bloco, abrir esse bloco mostra o DESVIO DE CINCO e não o salto de um —
// `["b_menu01","b_ver0001","b_ver0002","b_ver0003","b_ver0004","b_alvo001"]`,
// com o braço "Direto" fora da tela. Os dois são caminhos de verdade, e o dono
// alcança o curto clicando no botão "Direto"; em largura ele viria de graça. O
// negócio continua valendo a pena — o custo da largura acima é pior, porque ele
// troca a tela sem ninguém ter mexido naquele braço —, mas ele não é de graça.
//
// OS VISITADOS SÃO O QUE SEGURA O ANEL, e um menu que volta para si mesmo é
// padrão legítimo do produto — `temCicloDeSempre` (lib/steps.ts) só recusa o
// anel de `sempre`. Sem eles a busca não termina, e o que trava não é um teste:
// é a tela de quem está editando.
//
// Cada bloco entra uma vez só, então a recursão é tão funda quanto o número de
// blocos DISTINTOS alcançáveis, e é o `Set` de visitados que garante isso.
//
// NENHUM NÚMERO A LIMITA, e a frase que estava aqui dizia o contrário: que "a
// recursão é tão funda quanto o número de blocos alcançáveis — e
// `TETO_DE_PASSOS` (lib/steps.ts) é 100". A segunda metade é um número
// emprestado que não limita nada disto. `TETO_DE_PASSOS` conta as VOLTAS da
// caminhada de `interpretar`, e mais nada: nem `roteiro` nem `caminhoAte`
// consultam a constante, e não há no projeto limite nenhum para `passos.length`
// — a revisão procurou. O que segura esta função é o conjunto de visitados; o
// teto de outro arquivo não é a rede dela, e citá-lo como se fosse era a forma
// numérica do defeito desta fase.
function caminhoAte(
  passos: unknown,
  ligacoes: unknown,
  entrada: string,
  alvo: string
): string[] | null {
  const vistos = new Set<string>();
  const trilha: string[] = [];
  const anda = (id: string): boolean => {
    if (vistos.has(id)) return false;
    vistos.add(id);
    trilha.push(id);
    if (id === alvo) return true;
    for (const s of saidasMostradas(passos, ligacoes, id)) if (anda(s.para)) return true;
    trilha.pop();
    return false;
  };
  return anda(entrada) ? trilha : null;
}

// O QUE SEGUE DALI. Do último bloco do caminho para a frente, pela primeira
// saída QUE AINDA NÃO ESTÁ DESENHADA — a `sempre` de quem tem uma, e o primeiro
// botão de um menu cujo destino seja novo.
//
// PULA A SAÍDA QUE REPETE, EM VEZ DE DESISTIR NELA, e essa é a mesma regra que
// `caminhoAte` já usa uma função acima. A versão anterior olhava só
// `saidasMostradas(...)[0]` e parava quando AQUELE destino já estava desenhado,
// sem tentar o segundo — e o grafo que isso esconde é o padrão legítimo que o
// comentário de `caminhoAte` nomeia, com o botão que VOLTA gravado primeiro:
//
//   b_um00001 --sempre--> b_menu01
//   b_menu01  --botao "Escolher de novo"--> b_um00001
//   b_menu01  --botao "Seguir"--> b_novo001
//
// Sem seleção nenhuma a prévia desenhava `['b_um00001','b_menu01']` — medido —,
// acabando no menu SEM PÍLULA MARCADA e escondendo o único braço que continua.
// É a regra desta fase pelo avesso: o quadro não pode desenhar uma seta que o
// motor não percorre, e a prévia não pode esconder um caminho que ele percorre.
//
// PARA QUANDO NÃO SOBRA SAÍDA NOVA, e `jaVistos` chega com o caminho inteiro
// dentro: desenhar de novo um bloco já lido não acrescenta nada — a pessoa já
// leu aquele balão — e num anel não acabaria nunca. Cada volta acrescenta um
// bloco a `jaVistos`, então o laço termina.
function seguindoDe(
  passos: unknown,
  ligacoes: unknown,
  de: string,
  jaVistos: Set<string>
): string[] {
  const cauda: string[] = [];
  let atual = de;
  for (;;) {
    const proxima = saidasMostradas(passos, ligacoes, atual).find((s) => !jaVistos.has(s.para));
    if (!proxima) return cauda;
    jaVistos.add(proxima.para);
    cauda.push(proxima.para);
    atual = proxima.para;
  }
}

// POR ONDE O CAMINHO SAI DAQUI PARA O PRÓXIMO BLOCO DELE. `null` no último
// bloco mostrado, e também quando o próximo bloco não é alcançável a partir
// deste — uma seta citando id que não está na lista, por exemplo.
//
// ELA DEVOLVE A SAÍDA INTEIRA, e não só o botão, desde a revisão da Tarefa 8. É
// o que diz qual pílula do menu aparece marcada, e é também o que diz à cena que
// a conversa seguiu SEM toque nenhum — por quem digitou, ou por uma retomada que
// não soube qual foi o gesto. As duas perguntas se respondem com a mesma busca,
// e separá-las em duas funções faria a tela consultar o grafo duas vezes para
// desenhar um bloco só.
//
// Duas saídas para o mesmo destino devolvem a primeira — a mesma regra de
// desempate de tudo o mais aqui, e o caso é produzível pela tela: duas opções
// que dão no mesmo lugar.
function saidaDoCaminho(
  passos: unknown,
  ligacoes: unknown,
  de: string,
  para: string | null
): Saida | null {
  if (para === null) return null;
  return saidasMostradas(passos, ligacoes, de).find((s) => s.para === para) ?? null;
}

// A conversa que este fluxo produz NO CAMINHO DO BLOCO SELECIONADO.
//
// ELA DEIXOU DE SER O ARRAY, e essa é a mudança da Tarefa 8. Enquanto o fluxo
// era uma fila, desenhar a lista de cabo a rabo ERA a conversa. Com bifurcação
// não é: uma lista com dois braços não é uma conversa que alguém tenha, são
// duas — e emendá-las mostra ao dono uma sequência que o motor nunca executa,
// que é a prévia mentindo sobre o fluxo.
//
// O QUE ELA MOSTRA são as três partes de um caminho só:
//
//   O TRONCO — de `steps[0]` até o bloco aberto no painel. É o que dá contexto:
//     a pessoa vê a conversa que leva ATÉ o que ela está editando.
//   O BLOCO SELECIONADO.
//   A CAUDA — o que segue dali, pela primeira saída de cada bloco.
//
// SEM BLOCO SELECIONADO o tronco é só a entrada, e o resto é cauda: a conversa
// do caminho padrão, que é o que a tela mostrava antes de haver braço nenhum.
//
// A ENTRADA É `steps[0]`, e é o único significado que a ordem do array guardou
// depois que as ligações passaram a dizer quem vem depois. "O bloco que ninguém
// aponta" não serve: um menu que volta para si mesmo tem seta chegando na
// entrada, e o fluxo ficaria sem começo.
//
// TODOS OS BLOCOS DO CAMINHO ENTRAM, inclusive os que vêm depois de uma parada
// dura. A prévia existe para quem está MONTANDO, e quem monta precisa ver onde o
// bloco que está editando cai — esconder a cauda depois da primeira parada faria
// a prévia sumir com metade da conversa justamente no fluxo mais comum, que
// começa com a boas-vindas de resposta rápida.
//
// O QUE NÃO ESTÁ NO CAMINHO NÃO APARECE, e é a única forma de a prévia continuar
// sendo uma conversa. Quem mostra o fluxo INTEIRO é o quadro, ao lado — as duas
// telas respondem perguntas diferentes, e é por isso que elas convivem.
//
// O que a parada faz é aparecer: a marca entra na cena, e logo depois vem o
// toque da pessoa. Assim a cauda continua visível SEM mentir sobre quando ela
// sai.
//
// `unknown` na entrada, e não `Passo[]`, pelo mesmo motivo de `interpretar`
// (lib/steps.ts): a lista também chega do banco, onde ela é `unknown[]` e nada
// confere o tipo em runtime. Uma lista que não é lista devolve roteiro vazio, e
// a tela mostra o vazio em vez de quebrar.
//
// O GATILHO É OBRIGATÓRIO, e não tem valor padrão de propósito. Dois dos seis
// tipos só rodam em alguns gatilhos, e um padrão faria a prévia prometer
// entrega no gatilho errado calada — que é exatamente o defeito que esta
// assinatura veio corrigir. Um chamador que não sabe o gatilho não sabe o
// suficiente para desenhar a conversa.
//
// `selecionado` É UMA IDENTIDADE, não uma posição — é o mesmo `selecionado` que
// o quadro guarda. `null` quando não há bloco aberto no painel, e o quadro
// também manda `null` quando quem está selecionado é o GATILHO: o gatilho não é
// bloco, não tem cena, e o caminho a mostrar é o da entrada.
//
// UMA IDENTIDADE QUE NÃO ESTÁ MAIS NA LISTA vale como `null`, e o caso é
// produzível: numa lista SEM `id` gravado a identidade É a posição
// (`identidadeDoPasso`, lib/steps.ts), então apagar um bloco RENOMEIA todos os
// que vêm depois e a seleção guardada pode apontar para uma posição que sumiu.
// Cair no caminho da entrada mostra uma conversa de verdade; inventar uma cena
// para um bloco que não existe mostraria um balão de nada.
export function roteiro(
  passos: unknown,
  gatilho: string,
  ligacoes: unknown,
  selecionado: string | null
): Cena[] {
  if (!Array.isArray(passos) || !passos.length) return [];

  const entrada = identidadeDoPasso(passos[0], 0);
  const alvo =
    selecionado !== null && indiceDoId(passos, selecionado) !== null ? selecionado : null;

  // O TRONCO. Sem alvo, começa e acaba na entrada. Com um alvo que a entrada não
  // alcança — bloco solto —, é só ele: emendar o tronco de outra conversa seria
  // costurar dois pedaços que não se encostam, e não mostrar nada esconderia o
  // bloco que a pessoa acabou de abrir.
  const caminho =
    alvo === null ? [entrada] : (caminhoAte(passos, ligacoes, entrada, alvo) ?? [alvo]);

  // A CAUDA, com os visitados do tronco já dentro: a conversa acaba quando
  // voltaria a um bloco que já está desenhado acima.
  const vistos = new Set(caminho);
  caminho.push(...seguindoDe(passos, ligacoes, caminho[caminho.length - 1], vistos));

  const cenas: Cena[] = [];
  // Só a PRIMEIRA resposta pública é publicada, e é preciso contar para saber
  // qual é: `commentReplyKey` (lib/dedupe.ts) não conhece o bloco, então a
  // segunda sai com a mesma chave e o `on conflict do nothing` a engole. É a
  // mesma razão pela qual `conferirLista` (lib/steps.ts) trata a segunda como
  // ERRO — e a prévia apontava a segunda para o texto da PRIMEIRA no cartão do
  // post, dizendo "sai no comentário do post, acima" sobre um texto que não é
  // o dela.
  //
  // A CONTAGEM É PELO CAMINHO, e não pelo array, desde que a prévia passou a
  // mostrar um braço. É a leitura certa do mecanismo: `commentReplyKey` engole a
  // segunda QUE EXECUTA, e num disparo só executa quem está no caminho
  // percorrido. Duas públicas em braços DIFERENTES nunca rodam juntas, e contar
  // pelo array marcaria a do segundo braço como repetida por causa de uma que
  // não saiu.
  let publicasVistas = 0;

  for (let k = 0; k < caminho.length; k++) {
    const id = caminho[k];
    const i = indiceDoId(passos, id);
    // UMA SETA PODE CITAR UM ID QUE NÃO ESTÁ NA LISTA — é o mesmo caso que
    // `haCaminho` (lib/steps.ts) documenta. Não há bloco a desenhar, e desenhar
    // um vazio inventaria uma mensagem que ninguém recebe.
    if (i === null) continue;
    const { passo, paraODono } = conferir(passos[i]);

    // A MENSAGEM É A DO DONO, e não o `motivo` técnico, pela mesma razão de
    // `conferirLista` (lib/steps.ts): quem lê a prévia é quem está montando a
    // automação, e "pedir_email sem texto" é nome de tipo interno.
    if (!passo) {
      cenas.push({ id, itens: [{ tipo: "incompleto", mensagem: paraODono! }] });
      continue;
    }

    // Para onde a conversa segue DEPOIS deste bloco, e POR QUE GESTO. É o que
    // diz qual botão de um menu está sendo mostrado, e — quando não foi por
    // toque — qual marca fecha a cena. `null` no último bloco do caminho.
    const proximo = caminho[k + 1] ?? null;
    const saida = saidaDoCaminho(passos, ligacoes, id, proximo);

    // SE ESTE BLOCO É UM MENU, e a pergunta é feita aqui porque as duas
    // respostas que dependem dela ficam em lugares diferentes: o ramo `dm`, logo
    // abaixo, e a marca da retomada, no fim do laço. `envioDaDm` é pura, e
    // chamá-la duas vezes custa menos do que carregar a resposta para fora do
    // `switch` num `let`.
    const ehMenu = passo.tipo === "dm" && envioDaDm(passo).forma === "botoes";

    const itens: Bolha[] = [];

    switch (passo.tipo) {
      case "dm": {
        // A FORMA DA MENSAGEM SAI DE `envioDaDm`, e não de condições escritas
        // aqui. É a MESMA chamada que `enfileirarPasso` (lib/engine.ts) faz para
        // escolher o `kind` e o payload da fila, e é dela que `esperaResposta`
        // deriva a parada — então o que a prévia desenha é, por construção, o
        // que a pessoa recebe.
        //
        // Este ramo tinha DUAS cópias da regra: `esperaResposta` seguida de
        // `passo.botao_label!`, e um `if (passo.url)` logo abaixo. A asserção
        // não-nula era a mais cara das duas — ela afirmava ao `tsc` uma
        // invariante de OUTRO arquivo, e quando `esperaResposta` passou a dizer
        // sim a um `dm` com `botoes` (sem rótulo nenhum) a afirmação virou
        // falsa sem nada acusar. Agora o rótulo vem do próprio `envio`, com
        // tipo, e não há o que afirmar.
        //
        // O "LINK SEM ENDEREÇO" (`url: ""` com rótulo) continua caindo na
        // resposta rápida, e continua sendo o ponto: pelo VALOR ele é
        // indistinguível de uma, o motor o envia como uma, e o fluxo para nele
        // para sempre esperando um toque que não leva a lugar nenhum. É o
        // defeito que esta base já teve — um lembrete salvo sem link virou
        // parada dura sem ninguém pedir —, e aqui ele fica visível na tela. Quem
        // diz que aquilo é ERRO é `conferirLista`, no painel, logo acima da
        // prévia; o que a prévia mostra é a consequência.
        const envio = envioDaDm(passo);
        // O MENU. Balão, os botões, a parada, e o toque no botão do braço que
        // está sendo mostrado.
        //
        // A PRÉVIA NÃO TINHA ESTE RAMO até a Tarefa 8, e a consequência estava
        // fixada em teste: um menu caía no `else` de texto puro e a tela
        // desenhava como mensagem solta uma parada que o motor executa — a
        // prévia mentindo sobre o bloco que ela existe para explicar.
        //
        // O RÓTULO É CONFERIDO AQUI, e não confiado ao tipo: `envioDaDm`
        // (lib/steps.ts) valida a LISTA e não os elementos (o comentário dela
        // diz isso por extenso), então o que chega em `botoes` é `jsonb` cru.
        // Quem recusa elemento quebrado é `conferirLista`, que trava o SALVAR;
        // aqui basta não estourar desenhando.
        //
        // A PARADA SAI DE `esperaResposta`, como nos outros ramos: quem diz que
        // um menu para o fluxo é lib/steps.ts, não uma cópia da regra escrita
        // nesta tela.
        if (envio.forma === "botoes") {
          // O BOTÃO PELO QUAL A CONVERSA SEGUE — e `null` quando ela segue por
          // outra coisa. Desde a revisão da Tarefa 8 a saída do caminho pode ser
          // a `senao` ou a `sempre` do menu, e nesses dois casos NENHUMA pílula
          // é marcada: não houve toque. Quem diz o que houve, então, é a marca
          // que fecha a cena, no fim do laço.
          const escolhido = saida?.quando.tipo === "botao" ? saida.quando.botao : null;
          itens.push({ tipo: "balao", texto: passo.texto, botao: null, link: false });
          itens.push({
            tipo: "botoes",
            botoes: envio.botoes.map((b) => ({
              rotulo: typeof b?.rotulo === "string" ? b.rotulo : "",
              escolhido: escolhido !== null && b?.id === escolhido,
            })),
          });
          if (esperaResposta(passo)) {
            itens.push({ tipo: "parada", motivo: "toque" });
            // O TOQUE SÓ APARECE QUANDO HÁ BRAÇO A MOSTRAR. Sem botão escolhido
            // não há o que a pessoa tenha tocado, e desenhar uma bolha azul aí
            // inventaria uma mensagem dela.
            //
            // E SEM RÓTULO TAMBÉM NÃO, pelo mesmo motivo do `pedir_follow` sem
            // rótulo, lá embaixo: a bolha da direita é o TEXTO que entra na
            // conversa quando o botão é tocado, e um botão sem rótulo não entrega
            // texto nenhum.
            const tocado = envio.botoes.find((b) => b?.id === escolhido)?.rotulo;
            if (typeof tocado === "string" && tocado) {
              itens.push({ tipo: "resposta", texto: tocado });
            }
          }
          break;
        }
        if (envio.forma === "resposta_rapida") {
          itens.push({ tipo: "balao", texto: passo.texto, botao: envio.rotulo, link: false });
          itens.push({ tipo: "parada", motivo: "toque" });
          // O TOQUE SÓ APARECE SE A CONVERSA SAIU POR ELE, e é a mesma guarda do
          // menu logo acima — este ramo é que tinha ficado para trás. A bolha da
          // direita é o que A PESSOA MANDA; num caminho que sai pela `senao` ela
          // NÃO tocou na pílula, ela DIGITOU. Medido, antes: a cena saía
          // `[balão "Toca ai"/Quero, parada, resposta "Quero", retomada digitou]`
          // — a tela mostrava a pessoa tocando em "Quero" e, logo abaixo, a marca
          // dizendo que ela respondeu digitando. Era a prévia inventando uma
          // mensagem que ninguém mandou, que é o argumento com que a marca
          // `retomada` (lá em cima) foi justificada.
          //
          // SEM SAÍDA NENHUMA a bolha FICA, e é o certo: no último bloco do
          // caminho não há `senao` a contradizer, e o toque é o gesto que a
          // parada logo acima está pedindo.
          if (saida?.quando.tipo !== "senao") {
            itens.push({ tipo: "resposta", texto: envio.rotulo });
          }
          break;
        }
        // Botão de link: a pessoa abre o endereço e a vida segue — não há o que
        // esperar, e por isso não há parada.
        //
        // O padrão de rótulo é da PRÉVIA, e não de `envioDaDm`: quem escreve
        // "Abrir link" numa mensagem sem rótulo é `linkMessage` (lib/ig.ts), na
        // hora de montar o template, e é isso que esta linha está desenhando.
        if (envio.forma === "link") {
          itens.push({
            tipo: "balao",
            texto: passo.texto,
            botao: envio.rotulo || LINK_PADRAO,
            link: true,
          });
          break;
        }
        itens.push({ tipo: "balao", texto: passo.texto, botao: null, link: false });
        break;
      }

      case "esperar":
        itens.push({ tipo: "tempo", texto: textoDoTempo(passo.minutos) });
        break;

      // OS DOIS PORTÕES PARAM O FLUXO — `esperaResposta` diz sim aos dois —,
      // e a prévia marca os dois. O que os separa é o MOTIVO, e ele não é
      // decoração: só o follow é reavaliado quando alguém chega do outro lado
      // por outro caminho (a regra do portão, `atravessandoOPortao` em
      // lib/steps.ts, cobre `pedir_follow` e mais nada). É a mesma distinção
      // que o painel escreve e que a cor do nó carrega.
      //
      // A PARADA SAI DE `esperaResposta` NOS DOIS, como no ramo `dm` acima. Ela
      // diz sim a todo `pedir_follow` e a todo `pedir_email` hoje, então a cena
      // não muda — o que muda é que a prévia deixa de ter uma cópia da regra: se
      // um dos dois deixar de esperar, a parada some daqui sozinha, em vez de
      // continuar desenhada por um `push` escrito à mão.
      case "pedir_follow": {
        // SEM PÍLULA QUANDO NÃO HÁ RÓTULO, e este é o caso que a prévia existe
        // para denunciar. Com `botao_label: ""` o motor manda TEXTO PURO —
        // `lib/queue-drain.ts` exige `quick_reply_label && quick_reply_payload`
        // — e o fluxo para no portão sem nada para tocar. Desenhar um "Já sigo!
        // ✅" inventado (o antigo `FOLLOW_PADRAO`) escondia exatamente isso. O
        // motivo por extenso, e por que o `LINK_PADRAO` fica, está lá em cima.
        //
        // E não há `resposta` nenhuma nesse caso: a bolha da direita é o TOQUE
        // da pessoa, e não há botão em que tocar. `conferirLista` (lib/steps.ts)
        // acusa ERRO nesse bloco, logo acima da prévia, no painel.
        const rotulo = passo.botao_label || null;
        itens.push({ tipo: "balao", texto: passo.texto, botao: rotulo, link: false });
        if (esperaResposta(passo)) {
          itens.push({ tipo: "parada", motivo: "follow" });
          if (rotulo) itens.push({ tipo: "resposta", texto: rotulo });
        }
        break;
      }

      // O E-MAIL DE EXEMPLO FICA, INCLUSIVE NO CAMINHO DA `senao`, e este é o
      // ramo que PARECE o da resposta rápida acima e não é. A revisão pediu a
      // mesma guarda aqui, apontando a contradição literal — `ana@email.com`
      // seguido da marca que diz "o texto é dela". A contradição é da REDAÇÃO da
      // marca (./previa.tsx), não da bolha, e a medição é do motor:
      //
      //   `handleMessage` (lib/engine.ts) só chega em `retomadaDoTexto` DEPOIS de
      //   `extractEmail(text)` ter dado certo — e-mail que não parece e-mail
      //   re-pergunta e RETORNA, sem sair do bloco.
      //
      // Ou seja: a `senao` de um `pedir_email` é o caminho de quem digitou um
      // e-mail VÁLIDO. A bolha da direita não está inventando um gesto — ela está
      // mostrando um EXEMPLO do que a pessoa digitou, que é a única coisa que
      // esta tela sabe sobre esse texto. Na resposta rápida é diferente: lá a
      // bolha afirma um TOQUE na pílula, e quem sai pela `senao` não tocou nela.
      case "pedir_email":
        itens.push({ tipo: "balao", texto: passo.texto, botao: null, link: false });
        if (esperaResposta(passo)) {
          itens.push({ tipo: "parada", motivo: "email" });
          itens.push({ tipo: "resposta", texto: EMAIL_DE_EXEMPLO });
        }
        break;

      // O MOTOR SORTEIA UMA DAS VARIAÇÕES a cada disparo (`enfileirarPasso`,
      // lib/engine.ts), então a prévia não tem como mostrar "a" resposta. Mostra
      // a primeira aproveitável e diz quantas existem — a contagem é o que
      // impede a prévia de prometer um texto fixo.
      //
      // A PRIMEIRA COM TEXTO, e não `textos[0]`: o painel guarda as linhas em
      // branco de propósito (sem `.filter()`, senão não dá para digitar a
      // segunda variação), então `textos[0]` é "" com frequência — e a prévia
      // mostraria vazio uma resposta pública que funciona.
      //
      // AS VAZIAS SÃO CONTADAS À PARTE porque o sorteio não as pula: o motor
      // sorteia e faz `if (!texto?.trim()) return`. Logo depois do Enter — o
      // gesto normal para criar a segunda variação — existe uma linha em branco,
      // e "uma das 2 variações, sorteada" prometia duas com uma que não publica
      // nada.
      case "resposta_publica": {
        publicasVistas++;
        itens.push({
          tipo: "publica",
          texto: passo.textos.find((t) => typeof t === "string" && t.trim()) ?? "",
          variacoes: passo.textos.length,
          vazias: passo.textos.filter((t) => typeof t !== "string" || !t.trim()).length,
          situacao:
            gatilho !== "comment"
              ? "fora_do_gatilho"
              : publicasVistas > 1
                ? "repetida"
                : "publicada",
        });
        break;
      }

      // O CORAÇÃOZINHO REAGE À MENSAGEM QUE A PESSOA MANDOU, e é o gatilho que
      // decide se existe alguma.
      //
      //   `story` — a mensagem é a resposta dela ao story. `handleMessage`
      //     (lib/engine.ts) chama `executarFluxo(..., { messageId: msg.mid })`.
      //   `dm` — o MESMO caminho, com a DM comum. O bloco roda, e é por isso que
      //     `conferirLista` (lib/steps.ts) dá AVISO aqui e não erro.
      //   qualquer outro (comentário) — não chega mensagem nenhuma, e
      //     `enfileirarPasso` desiste. O bloco NUNCA roda, `conferirLista` dá
      //     ERRO, e a cena não pode prometer entrega — era o que ela fazia.
      case "reagir_story":
        itens.push({
          tipo: "reacao",
          emoji: passo.emoji,
          alvo: gatilho === "story" ? "story" : gatilho === "dm" ? "mensagem" : "nenhum",
        });
        break;
    }

    // A MARCA DE COMO A CONVERSA SEGUIU, quando ela não seguiu por um toque.
    //
    // ELA FECHA A CENA, depois da parada, e a ordem é a informação: primeiro a
    // tela diz que o fluxo PARA ali, e só então por qual porta ele voltou a
    // andar. Sem ela o menu apareceria com a parada desenhada, nenhuma pílula
    // marcada, e a conversa continuando mesmo assim — a prévia mostrando o
    // caminho certo e calando o motivo dele, que é a metade do defeito que esta
    // correção veio resolver. A outra metade era o caminho não aparecer.
    //
    // A `sempre` DE QUEM NÃO É MENU NÃO GANHA MARCA, e é a única assimetria
    // daqui: num bloco comum ela é a conversa simplesmente seguindo, e marcar
    // toda continuação encheria de ruído o fluxo mais comum que existe — a
    // corrente que a migração gravou em toda automação que já existia. Num menu
    // ela é outra coisa, e o comentário de `Bolha.retomada` diz o quê.
    if (saida?.quando.tipo === "senao") {
      itens.push({ tipo: "retomada", via: "digitou" });
    } else if (saida?.quando.tipo === "sempre" && ehMenu) {
      itens.push({ tipo: "retomada", via: "continuacao" });
    }

    cenas.push({ id, itens });
  }

  return cenas;
}
