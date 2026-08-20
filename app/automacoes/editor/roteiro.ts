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
  ligacoesDe,
  seguinteDe,
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
  // NENHUM `escolhido` é caso normal, e são três: menu sem ligação de botão
  // nenhuma (quem está montando), botão cujo braço volta para um bloco já
  // desenhado (o anel), e menu que é o fim do caminho mostrado.
  | { tipo: "botoes"; botoes: { rotulo: string; escolhido: boolean }[] }
  // A MARCA DA PARADA. É a informação mais valiosa da prévia: daqui não sai
  // nada até a pessoa fazer alguma coisa.
  | { tipo: "parada"; motivo: "toque" | "follow" | "email" }
  | { tipo: "resposta"; texto: string }
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
// segue, e por qual botão — `null` quando não passa por botão nenhum.
type Saida = { para: string; botao: string | null };

// POR ONDE A CONVERSA DESENHADA PODE SEGUIR, na ordem em que as setas foram
// gravadas.
//
// É a peça que decide o formato do caminho, e ela tem UMA regra por tipo de
// bloco — a mesma divisão que `retomaPelaSempre` (lib/steps.ts) faz no motor:
//
//   MENU (`dm` com `botoes`) → as ligações de BOTÃO, todas, em ordem. Um menu
//     inteiramente ligado não tem `sempre` nenhuma saindo, e perguntar
//     `seguinteDe` a ele diria "acabou aqui" sobre todo menu certo do produto.
//     Quem resolve o toque no motor é `ligacaoEscolhida(..., {tipo:"botao"})`,
//     e são essas setas que ela consulta.
//   QUALQUER OUTRO → a `sempre`, por `seguinteDe`. É a mesma seta que
//     `interpretar` percorre sozinha.
//
// A `senao` FICA DE FORA DOS DOIS, e essa é a única exclusão desta função. Ela
// é a seta de quem RESPONDEU DIGITANDO (`retomadaDoTexto`, lib/steps.ts), e a
// prévia desenha a conversa de quem TOCA: não há como pôr no balão da direita um
// texto que a pessoa ainda não escreveu, e inventá-lo seria a prévia mostrando
// uma mensagem que ninguém mandou. A consequência, dita porque é escolha: um
// bloco alcançável SÓ pela `senao` aparece como bloco solto quando aberto no
// painel — só ele, sem tronco.
//
// O BLOCO QUE `conferir` RECUSA cai no ramo da `sempre`, e é o certo: um bloco
// incompleto não tem `botoes` em que confiar, mas a seta que ATRAVESSA ele
// continua existindo, e cortar o caminho ali esconderia toda a cauda do fluxo
// por causa de um campo vazio.
function saidasMostradas(passos: unknown, ligacoes: unknown, id: string): Saida[] {
  const i = indiceDoId(passos, id);
  const passo = i === null ? undefined : conferir((passos as unknown[])[i]).passo;
  if (passo && passo.tipo === "dm" && envioDaDm(passo).forma === "botoes") {
    const saidas: Saida[] = [];
    for (const l of ligacoesDe(ligacoes, id)) {
      if (l.quando.tipo === "botao") saidas.push({ para: l.para, botao: l.quando.botao });
    }
    return saidas;
  }
  const sempre = seguinteDe(ligacoes, id);
  return sempre === null ? [] : [{ para: sempre, botao: null }];
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
// concreto: o comprimento de um braço muda quando o dono acrescenta um bloco no
// meio dele, então a conversa mostrada num bloco de junção trocaria de braço
// sozinha ao se editar OUTRO braço. Em ordem de ligação ela só muda quando as
// setas mudam.
//
// OS VISITADOS SÃO O QUE SEGURA O ANEL, e um menu que volta para si mesmo é
// padrão legítimo do produto — `temCicloDeSempre` (lib/steps.ts) só recusa o
// anel de `sempre`. Sem eles a busca não termina, e o que trava não é um teste:
// é a tela de quem está editando.
//
// Cada bloco entra uma vez só, então a recursão é tão funda quanto o número de
// blocos distintos alcançáveis — e `TETO_DE_PASSOS` (lib/steps.ts) é 100.
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

// QUAL BOTÃO LEVA DAQUI PARA O PRÓXIMO BLOCO DO CAMINHO. `null` quando a
// conversa não segue por botão nenhum.
//
// Dois botões ligados ao mesmo destino devolvem o primeiro — a mesma regra de
// desempate de tudo o mais aqui, e o caso é produzível pela tela: duas opções
// que dão no mesmo lugar.
function botaoDaSaida(
  passos: unknown,
  ligacoes: unknown,
  de: string,
  para: string | null
): string | null {
  if (para === null) return null;
  for (const s of saidasMostradas(passos, ligacoes, de)) if (s.para === para) return s.botao;
  return null;
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

    // Para onde a conversa segue DEPOIS deste bloco. É o que diz qual botão de
    // um menu está sendo mostrado — e `null` no último bloco do caminho.
    const proximo = caminho[k + 1] ?? null;

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
          const escolhido = botaoDaSaida(passos, ligacoes, id, proximo);
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
          itens.push({ tipo: "resposta", texto: envio.rotulo });
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

    cenas.push({ id, itens });
  }

  return cenas;
}
