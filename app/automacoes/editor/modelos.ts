import {
  chaveDoQuando,
  envioDaDm,
  ligacoesDe,
  novoIdDeBloco,
  novoIdDeBotao,
  type Ligacao,
  type Passo,
  type Quando,
} from "@/lib/steps";

// A paleta tem NOVE itens sobre SEIS tipos, e a diferença não é maquiagem.
//
// "Mensagem", "Mensagem com botão", "Mensagem com link" e "Mensagem com
// opções" salvam todas `tipo: "dm"`. O que separa uma DM que PARA o fluxo de
// uma que segue é ter rótulo de botão SEM url — uma diferença invisível no
// dado, que já causou defeito: um lembrete salvo sem link virou parada dura e
// o fluxo travou ali, sem ninguém ter pedido isso. Nomear os quatro casos faz a
// distinção aparecer na hora de criar, não depois.
//
// O QUARTO É O ÚNICO QUE BIFURCA, e ele é a razão desta fase inteira: um `dm`
// com `botoes` entrega um menu, PARA o fluxo (`envioDaDm` → `esperaResposta`,
// lib/steps.ts) e continua por uma seta POR BOTÃO. Até a Tarefa 7 nenhuma tela
// do sistema gravava essa chave — o motor, a conferência e as alças do quadro
// já a liam, e nada a escrevia.
//
// `gatilhos: null` = serve em qualquer um.
export type ItemDaPaleta = {
  chave: string;
  rotulo: string;
  descricao: string;
  gatilhos: string[] | null;
};

export const PALETA: ItemDaPaleta[] = [
  { chave: "dm", rotulo: "Mensagem", descricao: "texto simples", gatilhos: null },
  { chave: "dm_botao", rotulo: "Mensagem com botão", descricao: "o fluxo espera o toque", gatilhos: null },
  { chave: "dm_link", rotulo: "Mensagem com link", descricao: "botão que abre um endereço", gatilhos: null },
  { chave: "dm_opcoes", rotulo: "Mensagem com opções", descricao: "cada botão leva a um caminho", gatilhos: null },
  { chave: "esperar", rotulo: "Esperar", descricao: "atrasa o que vier depois", gatilhos: null },
  // "PORTÃO" É PALAVRA DE UM SÓ, e ela foi tirada do e-mail de propósito.
  //
  // Os dois param o fluxo esperando resposta, mas só o follow é REAVALIADO
  // quando alguém chega do outro lado por outro caminho: a regra do portão
  // (`atravessandoOPortao`, lib/steps.ts) cobre `pedir_follow` e mais nada.
  // Chamar os dois de portão fazia a paleta prometer, para o e-mail, uma
  // proteção que não existe — e o preço disso é o link saindo com o endereço
  // nunca capturado. A cor do bloco carrega a mesma distinção (ver `no.tsx`).
  { chave: "pedir_follow", rotulo: "Pedir follow", descricao: "portão: ninguém passa sem seguir", gatilhos: null },
  { chave: "pedir_email", rotulo: "Pedir e-mail", descricao: "espera o endereço (não é portão)", gatilhos: null },
  { chave: "resposta_publica", rotulo: "Resposta pública", descricao: "só no gatilho de comentário", gatilhos: ["comment"] },
  { chave: "reagir_story", rotulo: "Coraçãozinho", descricao: "só no gatilho de story", gatilhos: ["story"] },
];

// `novoIdDeBloco` vinha copiada de `app/automacoes/actions.ts` — as duas cópias
// tinham o mesmo defeito de comprimento ao mesmo tempo. Agora ela vem de
// `lib/steps.ts`, ao lado de `FORMA_DO_ID`, que é quem a valida.

// A CONVENÇÃO DA CHAVE `url`, que este arquivo é a origem de.
//
// "Mensagem com link" semeia SEMPRE a chave `url`, mesmo vazia; "Mensagem" e
// "Mensagem com botão" NUNCA a gravam. É a presença da CHAVE — não o valor —
// que diz "isto é um botão de link", e é dela que depende o erro "mensagem com
// link sem endereço" de `conferirLista` (lib/steps.ts), que tem o mecanismo
// inteiro escrito no comentário de lá.
//
// O caso que a convenção existe para separar é o `dm_link` sem endereço
// (`url: ""`): pelo VALOR ele é indistinguível de uma resposta rápida
// (`Boolean(botao_label) && !url` é verdade nos dois), e pela CHAVE ele é o que
// de fato é. Sem ela, `conferirLista` acenderia ERRO num bloco que a tela
// chamaria de "mensagem com botão" — o dono lê um diagnóstico sobre outra coisa.
//
// Ela vale em TRÊS lugares, e os três precisam usar o mesmo critério:
//   `blocoNovo` (aqui) ....... semeia `url: ""` só em `dm_link`
//   `resumoDoBloco` (aqui) ... classifica pela CHAVE, `p.url !== undefined`
//   painel do bloco .......... pela chave, e NUNCA apaga a chave: esvaziar o
//                              campo do endereço grava `""`, não remove `url`
//
// Removendo a chave, o bloco vira indistinguível de uma resposta rápida e o
// erro deixa de acender — em silêncio, que é o modo de falhar que esta
// convenção inteira existe para evitar.
//
// ---------------------------------------------------------------------------
// A VIZINHA, desde a Tarefa 7: UM BLOCO COM `botoes` NÃO TEM `botao_label` NEM
// `url`. As casas são as MESMAS três, e o critério de cada uma é o que muda de
// lugar para lugar — de propósito, e o porquê está dito em cada uma.
//
//   `blocoNovo` (aqui) ....... `botoes` só em `dm_opcoes`, e ele NÃO semeia
//                              `botao_label` nem `url` junto. As três chaves
//                              convivem no tipo `PassoDm`, e `envioDaDm`
//                              (lib/steps.ts) desempata entre elas — mas o
//                              desempate existe para o dado que veio de fora,
//                              não para a paleta produzir bloco ambíguo.
//   `resumoDoBloco` (aqui) ... pela FORMA (`envioDaDm`), e NÃO pela chave. É a
//                              diferença para o `url`, e ela tem motivo: a
//                              chave `url` vazia é ERRO ACESO, e o título tem de
//                              falar do mesmo bloco que o diagnóstico; a lista
//                              de botões VAZIA não acende nada — `botoesCrus`
//                              (lib/steps.ts) aceita `[]` — e o bloco entrega
//                              texto puro. Titulá-lo "MENSAGEM COM OPÇÕES" pela
//                              chave seria a tela prometendo um menu que o motor
//                              não manda, sem nada acusando.
//   painel do bloco .......... pela CHAVE, como no `url`, e aqui é a chave que
//                              serve: é ela que decide se a LISTA aparece para
//                              editar. Pela forma, o menu que ficou sem nenhum
//                              botão perderia o próprio editor, e o dono não
//                              teria como pôr o primeiro de volta.
// ---------------------------------------------------------------------------

// Um bloco novo. Os textos-padrão existem para que OITO dos nove itens da
// paleta nasçam válidos: sem eles, um `dm` recém-arrastado teria `texto: ""` e
// `conferirLista` (lib/steps.ts) travaria o salvar antes de a pessoa ter tido a
// chance de digitar qualquer coisa.
//
// OS DOIS BOTÕES DE `dm_opcoes` NASCEM COM RÓTULO ESCRITO, e não em branco, pelo
// mesmo motivo do "Quero!" do `dm_botao`: rótulo em branco é erro de ATIVAR
// (`botoesCrus`, lib/steps.ts), e um bloco que nasce acusado ensina que o
// diagnóstico é ruído. "Opção 1" e "Opção 2" são neutros porque não há frase
// honesta a inventar — o que cada braço oferece é a coisa mais específica da
// automação inteira —, e são visivelmente provisórios, que é o que se quer de um
// texto que PRECISA ser trocado. O rótulo em branco continua sendo estado
// normal, mas do botão ACRESCENTADO à mão no painel, não do bloco recém-criado.
//
// SÃO DOIS, e não um: um menu de um botão só não escolhe nada, e `conferirLista`
// avisa exatamente isso. Nascer avisado é o mesmo defeito de nascer acusado.
//
// O NONO — "Mensagem com link" — NASCE COM ERRO, e isso é de propósito.
// `url: ""` casa com a regra do link sem endereço e acende ERRO no instante da
// criação, apontando o campo que falta: o endereço. Não há padrão honesto a
// inventar aqui — não existe url plausível para semear —, e link sem endereço é
// erro por definição, não um estado que dê para adiar. Quem arrasta esse bloco
// arrastou justamente para digitar o endereço, então o erro é a instrução do que
// fazer em seguida, e ele apaga sozinho na primeira letra digitada.
//
// O que NÃO se pode fazer para "consertar" isso é omitir a chave `url`: sem ela
// o bloco vira indistinguível de uma resposta rápida, o erro deixa de acender, e
// o fluxo trava em silêncio na hora do envio (a convenção logo acima).
export function blocoNovo(chave: string): Passo {
  const id = novoIdDeBloco();
  switch (chave) {
    case "dm":
      return { id, tipo: "dm", texto: "Escreva a mensagem aqui" };
    case "dm_botao":
      return { id, tipo: "dm", texto: "Escreva a mensagem aqui", botao_label: "Quero!" };
    case "dm_link":
      return { id, tipo: "dm", texto: "Aqui está o seu link!", botao_label: "Abrir link", url: "" };
    // NEM `botao_label` NEM `url` — é a vizinha da convenção da chave `url`,
    // logo acima. Os ids saem de `novoIdDeBotao` (lib/steps.ts) e não de um
    // contador local: é o id que casa com a ligação do braço, e dois blocos
    // criados na mesma sessão não podem sair com os mesmos.
    case "dm_opcoes":
      return {
        id,
        tipo: "dm",
        texto: "Escolha uma opção 👇",
        botoes: [
          { id: novoIdDeBotao(), rotulo: "Opção 1" },
          { id: novoIdDeBotao(), rotulo: "Opção 2" },
        ],
      };
    case "esperar":
      return { id, tipo: "esperar", minutos: 60 };
    case "pedir_follow":
      return { id, tipo: "pedir_follow", texto: "Antes de te mandar o link, me segue lá no perfil 🙏", botao_label: "Já sigo! ✅" };
    case "pedir_email":
      return { id, tipo: "pedir_email", texto: "Me manda seu melhor e-mail que eu te envio o link 👇" };
    case "resposta_publica":
      return { id, tipo: "resposta_publica", textos: ["Te mandei no direct! 📩"] };
    case "reagir_story":
      return { id, tipo: "reagir_story", emoji: "❤️" };
    default:
      return { id, tipo: "dm", texto: "Escreva a mensagem aqui" };
  }
}

// O que o nó mostra fechado. O corpo é cortado por CSS, não aqui — cortar no
// dado esconderia da prévia o texto que a pessoa acabou de digitar.
//
// A `dm` é classificada pela CHAVE `url`, e não pelo valor dela. O MENU é o
// contrário — pela FORMA —, e as duas metades da vizinha da convenção estão
// escritas por extenso lá em cima, junto da convenção. `if (p.url)`
// seria a mesma leitura que `esperaResposta` (lib/steps.ts) faz, e por isso
// intitularia MENSAGEM COM BOTÃO justamente o bloco em que `conferirLista`
// acende ERRO de "mensagem com link sem endereço" — o `dm_link` com `url: ""`.
// Título e diagnóstico falariam de blocos diferentes na mesma tela.
//
// O teste é contra `undefined`, e não `"url" in p`, pelo mesmo motivo que
// `conferirLista` usa: a lista pode ser conferida ANTES de ser serializada para
// jsonb, e um campo gravado como `undefined` mantém a chave presente em memória
// — `"url" in p` diria `true` para toda mensagem sem link.
//
// ---------------------------------------------------------------------------
// O CORPO É LIDO COMO JSONB, e não como o campo tipado que a assinatura promete.
//
// `Passo` aqui é uma AFIRMAÇÃO de `passosDoBanco` (app/automacoes/[id]/page.tsx)
// sobre um `unknown` vindo do banco — não uma garantia de runtime. Um
// `{tipo:"resposta_publica"}` SEM `textos` tem tipo desenhável, passa por lá
// inteiro, e `p.textos.join(" · ")` derrubava o nó e, com ele, a página: o
// desfecho exato que aquela função existe para impedir.
//
// Coagir aqui é mais barato do que validar lá, e não custa dado nenhum: o bloco
// aparece com o corpo vazio, `conferir` (lib/steps.ts) o recusa, `conferirLista`
// acende a frase no painel e trava o salvar. O bloco quebrado vira uma coisa
// NOMEADA na tela em vez de uma página em branco.
//
// `esperar` fica de fora da coerção de propósito: `${p.minutos} minutos` é total
// para todo valor que o JSON produz — número, texto, nulo, lista ou objeto —, e
// escrever uma guarda ali seria linha que nenhum teste alcança.
//
// EXPORTADA desde o painel do bloco (`./painel`), e não copiada para lá: o
// painel tem o MESMO problema deste arquivo, com um desfecho pior. Ele passa
// `passo.texto` cru para o campo de mensagem (`../variable-picker`), que faz
// `value.includes("{{")` — um bloco vindo do jsonb sem `texto` string derruba a
// ROTA INTEIRA no instante em que alguém o SELECIONA. E selecionar o bloco
// incompleto para consertá-lo é exatamente o que `passosDoBanco`
// (app/automacoes/[id]/page.tsx) deixa acontecer de propósito, em vez de apagar
// o bloco em silêncio. Duas cópias da mesma coerção divergiriam; uma função
// exportada, não.
// ---------------------------------------------------------------------------
export function comoTexto(v: unknown): string {
  return typeof v === "string" ? v : "";
}

// O RAMO PADRÃO EXISTE PARA O BLOCO NÃO SER APAGADO EM SILÊNCIO, e ele é a outra
// metade da mesma decisão que deixa o bloco INCOMPLETO chegar até aqui.
//
// Sem ele, o `switch` devolvia `undefined` para um `tipo` fora dos seis, a
// desestruturação de `{ titulo, corpo }` derrubava a página, e a única saída era
// `passosDoBanco` filtrar esse bloco — ou seja, o primeiro salvamento o apagava
// do banco sem nada dizer. O argumento que já valia para o bloco incompleto vale
// igual aqui: com um ramo padrão o bloco APARECE, `conferir` o recusa,
// `conferirLista` acende "Este bloco é de um tipo que o sistema não reconhece" e
// TRAVA O SALVAR. A perda passa a ser nomeada, e o dono decide se apaga.
export function resumoDoBloco(p: Passo): { titulo: string; corpo: string } {
  switch (p.tipo) {
    case "dm":
      if (p.url !== undefined) return { titulo: "MENSAGEM COM LINK", corpo: comoTexto(p.texto) };
      // O MENU VEM ANTES DO RÓTULO, e a ordem é a MESMA de `envioDaDm`
      // (lib/steps.ts): num bloco que tem as duas chaves é o menu que sai, então
      // é o menu que o título tem de nomear. Perguntar à forma em vez de reler a
      // chave é o que mantém as duas ordens sendo uma só.
      if (envioDaDm(p).forma === "botoes")
        return { titulo: "MENSAGEM COM OPÇÕES", corpo: comoTexto(p.texto) };
      if (p.botao_label) return { titulo: "MENSAGEM COM BOTÃO", corpo: comoTexto(p.texto) };
      return { titulo: "MENSAGEM", corpo: comoTexto(p.texto) };
    case "esperar":
      return { titulo: "ESPERAR", corpo: `${p.minutos} minutos` };
    // Só o follow leva "PORTÃO" no título, pelo mesmo motivo da paleta logo
    // acima: é o único que a regra do portão reavalia. O e-mail espera resposta
    // como qualquer parada, e o rótulo diz isso — não que ele barre.
    case "pedir_follow":
      return { titulo: "PORTÃO · PEDIR FOLLOW", corpo: comoTexto(p.texto) };
    case "pedir_email":
      return { titulo: "PEDIR E-MAIL", corpo: comoTexto(p.texto) };
    case "resposta_publica":
      return {
        titulo: "RESPOSTA PÚBLICA",
        corpo: Array.isArray(p.textos) ? p.textos.map(comoTexto).join(" · ") : "",
      };
    case "reagir_story":
      return { titulo: "CORAÇÃOZINHO", corpo: comoTexto(p.emoji) };
    default: {
      // `p` é `never` aqui — o `switch` cobre os seis tipos de `Passo` —, e é
      // justamente por isso que o `tipo` é relido através de um molde: o que
      // chega neste ramo é um objeto do banco que o TypeScript nunca viu.
      const tipo = (p as { tipo?: unknown }).tipo;
      return { titulo: "BLOCO DESCONHECIDO", corpo: `tipo “${String(tipo)}”` };
    }
  }
}

// ---------------------------------------------------------------------------
// AS ALÇAS DE SAÍDA DE UM BLOCO — uma por caminho que pode sair dele.
//
// Ela mora aqui, junto de `resumoDoBloco`, porque é a MESMA pergunta: o que
// este bloco mostra no quadro. O título e o corpo são o que ele diz; as alças
// são por onde ele sai.
//
// A PERGUNTA "TEM BOTÕES?" É FEITA A `envioDaDm` (lib/steps.ts) e não relida
// aqui, e é a mesma razão de sempre neste projeto: é aquela função que decide o
// que a mensagem entrega. Ler `p.botoes` direto faria a tela desenhar três alças
// num bloco que o motor envia como LINK — a chave `url` manda, e `envioDaDm`
// devolve `{forma:"link"}` mesmo com `botoes` preenchido. Três alças ali seriam
// três caminhos que ninguém percorre.
//
// A ALÇA DO "SENÃO" VEM DEPOIS DOS BOTÕES, e ela é para quem respondeu
// DIGITANDO em vez de tocar (`ligacaoEscolhida`, lib/steps.ts). Ela é opcional
// no dado — sem a seta, quem digita simplesmente não recebe nada —, mas a alça
// existe sempre que há botões, porque é o único lugar da tela em que esse
// caminho pode ser desenhado.
//
// BLOCO SEM BOTÕES TEM UMA ALÇA SÓ, a de continuação (`sempre`), e ela não leva
// rótulo: não há o que distinguir quando o caminho é um.
//
// O BOTÃO CORROMPIDO NÃO DERRUBA A TELA, e a guarda é a mesma lição de
// `resumoDoBloco` logo acima: `envioDaDm` valida a LISTA (`Array.isArray` e
// `.length`) e NÃO os elementos, de propósito — o comentário de lá tem a
// medição —, então `botoes: [null]` chega aqui inteiro e um `b.id` cru
// derrubaria o nó e, com ele, a rota. `conferirLista` já trava o salvar dessa
// lista; o que este ramo garante é que o dono consiga ABRIR o quadro para
// apagá-la. Sem nenhum botão aproveitável, o bloco volta a ter a alça de
// continuação, que é o que ele de fato entrega.
export type Alca = {
  // O id da alça no React Flow, e a chave da condição no dado. Uma string só
  // para os dois, por `chaveDoQuando` (lib/steps.ts).
  chave: string;
  quando: Quando;
  // O que fica escrito ao lado da alça. Vazio na alça de continuação.
  rotulo: string;
  // ELA EXISTE SÓ PORQUE HÁ UMA SETA GRAVADA NELA (`alcasDoQuadro`, abaixo), e
  // não porque o bloco ofereça esta saída. A alça está ali para o dono VER e
  // APAGAR a seta que já existe; quem lê a marca para tirá-la do gesto é
  // `alcaAceitaArrasto`, logo abaixo.
  sobra?: true;
};

// ESTA ALÇA PODE SER PONTA DE UM ARRASTO?
//
// UMA PERGUNTA SÓ PARA AS DUAS PONTAS, e o motivo é o defeito que ela fecha. A
// guarda anterior morava direto no JSX e era de MÃO ÚNICA: `isConnectableStart`
// recusava a alça de sobra, `isConnectableEnd` não. Medido, com
// `menu --sempre--> Fim` gravada: começar o arrasto na alça de DESTINO de outro
// bloco (que tem `isConnectableStart`) e soltar sobre a alça "continuação" do
// menu produz `{source: menu, sourceHandle: "sempre", target: o outro}` — em
// modo Strict, uma conexão VÁLIDA; `setaPermitida` (./quadro) só recusa
// `source === target`; `ligar` (lib/steps.ts) SUBSTITUI a de mesma condição; e
// `seguinteDe(menu)` passa a devolver o outro bloco. A alça que "não começa seta
// nenhuma" REDIRECIONAVA a seta.
//
// E O QUE DECIDE NÃO É O DADO RESULTANTE — ele é válido, `menu --sempre--> X` é
// percorrida por `retomadaDoTexto` sem `senao`, por `retomadaDoBotao` e por
// `retomadaDoFallback`. O que decide é o gesto ser DE IDA SÓ: o editor não tem
// desfazer, não tem `onReconnect`, e `deleteKeyCode` só APAGA (./quadro). Depois
// de redirecionar sem querer — e `connectionRadius` é 20px, então a mira não
// precisa ser exata — o dono não tem por onde pôr a seta de volta, porque a alça
// recusa começar o arrasto. Mover sem poder devolver é pior do que não mover.
//
// UMA FUNÇÃO E NÃO DUAS, e é aqui que a classe do defeito fecha: com duas
// expressões no JSX, guardar uma e esquecer a outra é um descuido de uma linha,
// e foi exatamente o que aconteceu. Com uma resposta só alimentando as duas
// pontas, a assimetria deixa de ser escrivível por engano.
export function alcaAceitaArrasto(a: Alca): boolean {
  return !a.sobra;
}

const ALCA_DE_CONTINUACAO: Alca[] = [{ chave: "sempre", quando: { tipo: "sempre" }, rotulo: "" }];

export function alcasDeSaida(p: Passo): Alca[] {
  if (p.tipo !== "dm") return ALCA_DE_CONTINUACAO;
  const envio = envioDaDm(p);
  if (envio.forma !== "botoes") return ALCA_DE_CONTINUACAO;

  const alcas: Alca[] = [];
  for (const b of envio.botoes) {
    const id = (b as { id?: unknown } | null | undefined)?.id;
    if (typeof id !== "string" || !id) continue;
    const quando: Quando = { tipo: "botao", botao: id };
    alcas.push({
      chave: chaveDoQuando(quando),
      quando,
      // "sem texto" e não vazio: botão sem rótulo não é entregue
      // (`botoesDaMensagem`, lib/steps.ts), e `conferirLista` já acusa isso no
      // ativar. A alça precisa de um nome para o dono saber de qual botão ela é.
      rotulo: comoTexto((b as { rotulo?: unknown }).rotulo).trim() || "sem texto",
    });
  }
  if (!alcas.length) return ALCA_DE_CONTINUACAO;

  alcas.push({ chave: "senao", quando: { tipo: "senao" }, rotulo: "digitou" });
  return alcas;
}

// ESTE BLOCO PODE ENTRAR NO MEIO DE UMA SETA?
//
// Soltar um bloco em cima de uma seta quer dizer "põe este bloco NO MEIO deste
// caminho", e `partirLigacao` (lib/steps.ts) escreve a segunda metade como
// `sempre` — a CONTINUAÇÃO do bloco que entrou. Um bloco sem alça de `sempre`
// não tem essa saída para dar, e o gesto escrevia mesmo assim.
//
// O QUE ISSO PRODUZIA, medido com as funções puras e com o bloco-bandeira da
// fase: solta-se "Mensagem com opções" sobre `Bem-vindo --sempre--> Fim` e o
// dado gravado fica `menu --sempre--> Fim`. O menu não tem alça de `sempre`,
// `indiceDaAlca` (logo abaixo) cai no índice 0, e o quadro desenha essa seta
// SAINDO DA ALÇA "Opção 1" — duas setas do mesmo ponto, e o toque em "Opção 1"
// nunca percorre a segunda. `conferirLista` devolvia `[]`: salvava e ativava
// assim.
//
// A PERGUNTA É FEITA A `alcasDeSaida`, e não a `envioDaDm` de novo, pelo mesmo
// motivo de `apagarBotao` (./quadro): quem decide se a alça existe é a função
// que a DESENHA. Uma segunda cópia da regra discordaria no dia em que um tipo
// novo ganhasse ou perdesse a continuação, e o gesto voltaria a escrever uma
// seta que a tela não sabe mostrar.
//
// O QUE ELA NÃO FAZ: não apaga nem conserta `sempre` de menu já gravada. Aquela
// forma é dado VÁLIDO — a suíte tem um fluxo certo que depende dela, o "menu que
// volta" (`temCicloDeSempre`, tests/steps.test.ts), e o motor a percorre por
// `retomadaDoTexto` sem `senao`, `retomadaDoBotao` e `retomadaDoFallback`. Quem
// cuida de MOSTRÁ-LA sem mentir é `alcasDoQuadro`, logo abaixo. Esta função
// fecha só a porta de CRIAR mais uma.
export function podeEntrarNaSeta(p: Passo): boolean {
  return alcasDeSaida(p).some((a) => a.chave === "sempre");
}

// AS ALÇAS QUE O QUADRO DESENHA — as do TIPO do bloco (`alcasDeSaida`, acima)
// mais UMA para cada condição que está GRAVADA e perdeu a alça dela.
//
// AS DUAS FUNÇÕES TÊM PERGUNTAS DIFERENTES, e é por isso que são duas. Aquela
// responde "que saídas este bloco OFERECE" — é a pergunta do gesto
// (`podeEntrarNaSeta`, acima) e a de `apagarBotao` (./quadro), que decide se a
// `senao` ainda tem de onde sair. Esta responde "que alças esta tela precisa
// TER para desenhar o que está gravado sem mentir", e a resposta depende do
// dado, não só do tipo.
//
// O QUE ELA CONSERTA são os TRÊS casos que `indiceDaAlca` registrava como
// buraco conhecido, e nos três o dado é o mesmo — some a alça, fica a ligação:
//
//   a ligação de um BOTÃO APAGADO;
//   a `senao` num bloco que DEIXOU DE TER botões;
//   a `sempre` num MENU.
//
// Até aqui as três caíam no ÍNDICE 0 e eram desenhadas saindo da PRIMEIRA alça
// — num menu, a do primeiro botão. Duas setas do mesmo ponto, e o toque naquele
// botão percorre uma só. Era o quadro DESENHANDO um caminho que o motor não
// percorre, que é a regra que esta fase declara como invariante.
//
// APAGAR A SETA CONTINUA FORA DE QUESTÃO, e a razão não mudou: seria apagar dado
// do dono sem ele pedir, a partir de uma inferência da TELA sobre uma ligação que
// o motor ainda lê. E ESCONDÊ-LA também não serve — sem traço na tela não há o
// que selecionar, e o gesto de apagar (Delete numa seta) deixaria de alcançá-la.
// Desenhar numa alça PRÓPRIA é o que dá as duas coisas: a verdade e o gesto.
//
// A `sempre` DE UM MENU NÃO É SETA MORTA, e isso é medido e vale contra a
// tentação de tratar as três como lixo: o motor sai por ela em `retomadaDoTexto`
// (quando não há `senao`), `retomadaDoBotao` e `retomadaDoFallback`
// (lib/steps.ts), e a suíte tem um fluxo CERTO que depende dela — o "menu que
// volta" do teste do anel. Por isso o rótulo dela é "continuação", que é a
// palavra que `conferirLista` já usa com o dono, e não "sobra".
//
// A ORDEM É A DAS LIGAÇÕES GRAVADAS, e as repetidas entram uma vez só: duas
// setas da mesma condição são forma válida (`conferirLista` acusa quando os
// destinos diferem, e não a forma), e duas alças com a mesma chave fariam o
// React Flow ter dois `Handle` de mesmo id no mesmo nó.
//
// A CONTINUAÇÃO GANHA RÓTULO quando alguma sobra aparece ao lado dela. Ela nasce
// sem rótulo porque num bloco de uma alça só não há o que distinguir; com uma
// segunda alça na mesma borda, "sem nome" vira a alça que a tela não explica.
function rotuloDaSobra(q: Quando): string {
  if (q.tipo === "sempre") return "continuação";
  if (q.tipo === "senao") return "digitou";
  return "botão apagado";
}

export function alcasDoQuadro(p: Passo, ligacoes: Ligacao[], identidade: string): Alca[] {
  const base = alcasDeSaida(p);
  const chaves = new Set(base.map((a) => a.chave));
  const sobras: Alca[] = [];
  for (const l of ligacoesDe(ligacoes, identidade)) {
    const chave = chaveDoQuando(l.quando);
    if (chaves.has(chave)) continue;
    chaves.add(chave);
    sobras.push({ chave, quando: l.quando, rotulo: rotuloDaSobra(l.quando), sobra: true });
  }
  if (!sobras.length) return base;
  return [
    ...base.map((a) =>
      a.chave === "sempre" && !a.rotulo ? { ...a, rotulo: "continuação" } : a
    ),
    ...sobras,
  ];
}

// QUAL ALÇA DESENHA ESTA LIGAÇÃO. Devolve o ÍNDICE dentro da lista de alças que
// lhe é dada, porque é o índice — e não a chave — que decide a ALTURA da alça no
// bloco (`fracaoDaAlca`, ./geometria).
//
// RECEBE A LISTA E NÃO O PASSO, e a troca é estrutural: com o passo, cada
// chamador escolhia sozinho ENTRE `alcasDeSaida` e `alcasDoQuadro`, e bastava um
// escolher diferente para a seta ser desenhada de um ponto e o alvo do gesto
// medido em outro. Recebendo a lista pronta, a pergunta é sempre "onde, DENTRO
// DESTAS, fica esta condição".
//
// O -1 VIRA 0 e agora é inalcançável por construção — `alcasDoQuadro` acrescenta
// uma alça para toda condição gravada, então a chave está sempre lá. A linha
// fica porque o tipo não prova isso: quem passar `alcasDeSaida` aqui (o gesto de
// apagar botão tem razão para olhar só as do tipo) receberia um índice fora da
// lista, e um `alcas[-1]` derruba o nó e, com ele, a rota.
export function indiceDaAlca(alcas: Alca[], quando: Quando): number {
  const chave = chaveDoQuando(quando);
  const i = alcas.findIndex((a) => a.chave === chave);
  return i === -1 ? 0 : i;
}

// Onde pôr os blocos que não têm posição gravada — toda automação criada antes
// da Fase 1b, e todo bloco recém-inserido pela seta.
//
// Escada diagonal em vez de coluna reta: com as setas curvas do React Flow,
// blocos alinhados na vertical fazem a seta passar POR DENTRO do bloco de
// baixo. O deslocamento horizontal deixa a curva visível.
//
// Ela acrescenta `pos` e NADA MAIS. Em particular não semeia nem apaga a chave
// `url`: o espalhamento copia o bloco como ele veio do banco, e é isso que
// mantém a decisão sobre o bloco legado (ver `quadro.tsx`) sendo "não mexer".
const LARGURA = 250;
const ALTURA = 96;

export function arranjoAutomatico(passos: Passo[]): Passo[] {
  return passos.map((p, i) =>
    p.pos ? p : { ...p, pos: { x: 60 + i * LARGURA, y: 60 + i * ALTURA } }
  );
}
