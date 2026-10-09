// O PROMPT da ilustração do slide. PURO, para ser testável fora do módulo que chama a API —
// mesmo padrão de `payment-logic` × `payments` e de `schemas` × `gerar`.
//
// A pessoa digita só a CENA ("uma lousa de sala de aula com um professor apontando"). Tudo
// o que faz a peça funcionar dentro do carrossel — estilo, fundo, e a proibição de texto —
// é acrescentado aqui, igual em toda ilustração. Se isso ficasse a cargo de quem digita,
// cada slide sairia de um mundo diferente e a sequência não leria como uma coisa só.
//
// ⚠️ NÃO há chamada ao Claude para "melhorar" a descrição. Seria uma segunda API paga no
// caminho de uma feature que já espera crédito em duas contas, para resolver algo que uma
// frase de estilo fixa resolve.

/**
 * A regra que não é opcional: PROIBIR TEXTO.
 *
 * ⚠️ **ELA COMEÇA AFIRMANDO, E ISSO NÃO É ESTILO DE REDAÇÃO — É O QUE FAZ A REGRA PEGAR.**
 *
 * Até 22/09 ela era só negação: *"Sem nenhum texto, sem letras, sem palavras…"*. Em 21/09 o
 * Eduardo gerou uma cena de reunião **sem pedir texto nenhum**, e a lousa saiu escrita
 * `VENDAS ORGANICAS` — sem o circunflexo. A proibição estava no prompt, no fim, e perdeu.
 *
 * **Modelo de imagem obedece mal a negação.** "Sem texto" compete com "lousa" e "gráfico", que
 * são superfícies que pedem escrita, e a superfície ganha: o modelo desenha a cena plausível e
 * a proibição vira um detalhe contra a física do quadro. A forma que funciona é dizer o que a
 * superfície DEVE ser — em branco, ou com linha e seta sem rótulo —, porque isso ele consegue
 * desenhar. A negação fica junto, como segunda linha, e não como única.
 *
 * ⚠️ E a lista de superfícies é NOMEADA de propósito. "Sem texto" genérico não diz ao modelo
 * ONDE ele está prestes a escrever; "a lousa aparece em branco" diz.
 *
 * Modelo de imagem escreve ilegível — troca letra, inventa acento, e é pior em português.
 * O carrossel inteiro foi desenhado para o texto ser composto por código justamente por
 * isso; deixar o modelo escrever aqui desfaria essa decisão dentro da própria peça, e do
 * jeito mais visível possível, porque a palavra torta fica no meio da arte.
 *
 * Vai no FIM do prompt de propósito: é a última coisa que o modelo lê.
 */
export const PROIBICAO_DE_TEXTO =
  "Toda superfície que poderia conter escrita — lousa, quadro branco, flip chart, projetor, " +
  "tela, cartaz, placa, papel — aparece EM BRANCO, ou apenas com linhas, barras e setas " +
  "desenhadas à mão, sem rótulo. Sem nenhum texto, sem letras, sem palavras, sem números e " +
  "sem logotipos em nenhuma parte da imagem.";

/**
 * A outra regra que não é opcional: NINGUÉM RECONHECÍVEL.
 *
 * Vem do manual do perfil, trazido pelo Eduardo em 02/09: foto de figura pública não pode
 * ser usada, e ilustração de ícone entra no lugar. É restrição de direito de imagem, não de
 * estética — e um post publicado com o rosto de alguém identificável é problema jurídico
 * que nenhum ajuste de arte desfaz depois.
 *
 * ⚠️ **PROÍBE PESSOA RECONHECÍVEL, NÃO PESSOA.** A distinção é obrigatória: o atalho
 * `/marketing` PEDE "uma pessoa em ação". Uma proibição escrita como "sem pessoas"
 * contradiria o próprio atalho logo acima dela no prompt, e o modelo entrega imagem confusa
 * em vez de recusar — o mesmo modo de falha de um atalho que pede o que a proibição de texto
 * veta.
 *
 * ⚠️ **A REDAÇÃO MUDOU EM 21/09, E A MUDANÇA AFROUXA UM POUCO — DE PROPÓSITO E COM CUSTO.**
 * Ela dizia "genéricas e estilizadas, **sem traços faciais identificáveis**", que fazia
 * sentido no estilo vetorial plano. Em fotografia, pedir rosto não identificável produz
 * gente borrada ou de costas, que é pior que o problema.
 *
 * O que a regra protege — **direito de imagem** — continua inteiro e ficou mais explícito:
 * pessoa fictícia e anônima, nenhuma semelhança com quem existe, e agora também **sem marca,
 * logotipo ou uniforme identificável**, que a redação antiga não cobria. O que se perdeu é a
 * proteção de segunda linha que o rosto sem traço dava de graça: hoje a peça sai com rostos
 * nítidos de pessoas inventadas, e quem confere se alguma saiu parecida com alguém é quem
 * revisa antes de publicar.
 *
 * Fica ao lado da proibição de texto, no fim: é o que não fazer, e é a última coisa lida.
 */
export const PROIBICAO_DE_PESSOA_REAL =
  "As pessoas retratadas devem ser fictícias e anônimas, sem semelhança com ninguém " +
  "existente. Nunca retrate pessoa real, figura pública, celebridade, político ou sósia de " +
  "alguém existente, e não reproduza marca, logotipo ou uniforme identificável.";

/**
 * O estilo, igual em toda ilustração.
 *
 * Fixo porque a sequência precisa parecer uma coisa só — dez slides com dez estéticas
 * diferentes leem como colagem.
 *
 * ⚠️ **ERA VETORIAL PLANO E AZUL ATÉ 21/09, e a troca foi decidida pelo Eduardo com as peças
 * publicadas na mão.** A frase antiga — *"vetorial plano e minimalista… azul vivo… sem
 * fotografia"* — foi escrita em **31/08, antes de as referências existirem**. Quando elas
 * apareceram, em 21/09, eram **três fotografias e uma capa desenhada**: o gerador produzia
 * exatamente o oposto do que a conta publica, e obedecendo a uma ordem nossa.
 *
 * ⚠️ **A PEÇA QUE ELE APROVOU NAQUELE DIA NÃO SAIU DAQUI** — era fotográfica e tinha texto
 * dentro do quadro, duas coisas que este prompt proíbe. Ela foi ENVIADA pela tela (38.1). O
 * caminho de envio continua sendo o de controle total; este é o de um clique.
 *
 * ⚠️ **O VOCABULÁRIO DE CÂMERA ENTROU EM 22/09** — distância focal, abertura, direção da luz,
 * e a recusa explícita de HDR, nitidez exagerada e vinheta. O Eduardo olhou uma peça em
 * produção e disse "a imagem está muito ruim ainda".
 *
 * **O motivo de descrever a ÓPTICA e não a qualidade:** pedir "foto realista de alta
 * qualidade" é adjetivo, e adjetivo o modelo já acha que está cumprindo. Dizer "35 mm a
 * f/2.8, luz de janela lateral" descreve uma CENA FÍSICA possível, e é isso que ele sabe
 * reproduzir — a mesma razão pela qual a proibição de texto só passou a funcionar quando
 * virou "a lousa aparece em branco".
 *
 * ⚠️ **E ISSO NÃO CONSERTA OBJETO QUE O MODELO NÃO SABE DESENHAR.** A peça que gerou a queixa
 * pedia "Manhattan inteira em 3D sobre a mesa" — uma maquete que não existe para ele copiar,
 * e que sai como aglomerado genérico de torres. As cenas de reunião saem bem porque são
 * comuns. Nenhuma frase de estilo alcança essa diferença; o caminho para cena difícil é o
 * envio.
 *
 * ⚠️ **A `PROIBICAO_DE_TEXTO` CONTINUA VALENDO, e isso é escolha separada, não descuido.**
 * A peça que ele gostou tem um gráfico rotulado, então a proibição custa alguma coisa — mas
 * modelo de imagem erra letra e acento em português, e aqui a imagem sai pronta para
 * publicar. Trocar isso é uma decisão dele, não uma consequência desta.
 *
 * ⚠️ **AS DUAS ÚLTIMAS FRASES SÃO CONTRA ARTEFATO, e entraram em 21/09 junto com a subida de
 * qualidade** — foram pedidas pelo mesmo feedback ("cara das pessoas muito plástica, 6 dedos,
 * mão branca e mão escura").
 *
 * *"Pele com textura natural, poros e pequenas imperfeições, sem retoque"* ataca a pele
 * plástica pedindo o oposto do que o modelo faz sozinho — ele tende ao rosto de catálogo.
 *
 * *"Enquadramento de meio corpo ou mais aberto, com as mãos repousadas e fora do primeiro
 * plano"* é a única coisa que se pode fazer pelos DEDOS por prompt, e é indireta: **não pede
 * mão correta — pede menos mão em destaque.** Modelo de imagem não obedece negativa
 * ("sem seis dedos" costuma piorar); obedece enquadramento. O lever forte contra artefato é a
 * qualidade, este é o fraco, e nenhum dos dois garante.
 */
export const ESTILO =
  "Fotografia editorial realista, em ambiente corporativo brasileiro contemporâneo. " +
  // ⚠️ VOCABULARIO DE CAMERA, acrescentado em 22/09. Ver o bloco acima: descrever a OPTICA
  // move o modelo para o territorio de fotografia de verdade; adjetivo de qualidade, nao.
  "Registrada com lente de 35 mm a f/2.8: foco nítido no rosto principal e fundo levemente " +
  "desfocado. Luz natural de janela vindo de lado, sombras suaves e contraste moderado. " +
  "Cores sóbrias e fiéis, sem filtro chamativo, sem HDR, sem nitidez exagerada, sem vinheta " +
  "e sem aparência de render 3D ou de desenho. Pele com textura natural, poros e pequenas " +
  "imperfeições, sem retoque e sem aparência de banco de imagens. Enquadramento de meio " +
  "corpo ou mais aberto, com as mãos repousadas e fora do primeiro plano.";

/**
 * O cenário, e ele OCUPA O RETÂNGULO INTEIRO.
 *
 * ⚠️ **CHAMAVA-SE `FUNDO_TRANSPARENTE` ATÉ 21/09, e a razão de então era boa:** o slide tem dois
 * fundos possíveis (claro e escuro) e a escolha acontece na hora de baixar, DEPOIS de a
 * ilustração existir. Com fundo opaco, gerar no claro e baixar no escuro deixaria um
 * retângulo branco colado no meio da arte.
 *
 * **A razão caiu junto com o estilo vetorial.** Fotografia preenche os 3:2 de ponta a ponta,
 * então não há fundo aparecendo atrás dela para brigar com o tema — é assim que as peças
 * publicadas da conta são. O que a transparência protegia deixou de existir.
 *
 * ⚠️ E ela cobrava um preço que só apareceu na tela: com fundo transparente o desenho flutua
 * na caixa, e quando o texto transborda os dois se sobrepõem. Foi o "mal posicionada" que o
 * Eduardo apontou em 21/09.
 */
export const FUNDO =
  "A cena deve preencher todo o quadro, de borda a borda, sem moldura, sem borda branca e " +
  "sem fundo liso sobrando.";

/**
 * ATALHOS DE ESTILO, escritos com barra no começo da descrição: `/showcase uma caixa…`.
 *
 * Pedido pelo Eduardo em 02/09, com a pergunta certa junto: "não sei se tem como aplicar na
 * API". **Tem, e é mais simples do que parece.** No ChatGPT a barra não é recurso do
 * modelo: é um texto guardado que ele cola antes do seu. Pela API é a mesma coisa — o
 * atalho vira um trecho de prompt, e este arquivo já fazia isso com o estilo fixo.
 *
 * ⚠️ **O QUE O ATALHO MUDA É O ENQUADRAMENTO, NÃO A ESTÉTICA.** O `ESTILO` acima continua
 * valendo em todos: a mesma fotografia editorial, a mesma luz. Isso é deliberado e contraria o impulso
 * de deixar cada atalho com a cara dele — dez slides com dez estéticas leem como colagem, e
 * a sequência precisa parecer uma coisa só. O atalho decide O QUE aparece e COMO está
 * composto; a linguagem visual não se mexe.
 *
 * Nenhum deles pode pedir texto, número ou rótulo: a `PROIBICAO_DE_TEXTO` vem depois e
 * venceria de qualquer forma, mas um atalho que pede o que o prompt proíbe logo abaixo
 * produz imagem confusa em vez de recusa.
 */
export type Estilo = {
  chave: string;
  /** Nome curto, para a lista. */
  rotulo: string;
  /**
   * O que o atalho faz, em uma frase, **para aparecer na tela**.
   *
   * ⚠️ Não é o `texto`: aquele é escrito para o modelo de imagem e tem 200 caracteres de
   * jargão de composição. Este é para a pessoa, e precisa caber numa linha.
   *
   * Existe porque a explicação estava só num `title` de hover — que não existe no celular, e
   * que este projeto já rejeitou por escrito duas vezes ("o motivo VISÍVEL, não num
   * tooltip"). `/showcase` até se adivinha; `/passo` e `/grafico` não dizem nada a quem
   * chega, e a instrução do projeto assume que quem opera esta tela não acompanha as
   * conversas onde os atalhos foram decididos.
   */
  resumo: string;
  /** O trecho que entra no prompt da imagem. Escrito para o modelo, não para a pessoa. */
  texto: string;
};

export const ESTILOS: Estilo[] = [
  {
    chave: "showcase",
    resumo: "O objeto centralizado e em destaque, com ar em volta e nada competindo.",
    rotulo: "Vitrine do produto",
    texto:
      "Composição de vitrine: o objeto principal centralizado e em destaque, visto de leve " +
      "perspectiva, com bastante ar em volta e nenhum elemento competindo com ele.",
  },
  {
    chave: "marketing",
    resumo: "Uma pessoa em ação junto do objeto, sugerindo uso e movimento.",
    rotulo: "Cena de divulgação",
    texto:
      "Composição de campanha: uma pessoa em ação junto do objeto principal, gestos claros e " +
      "legíveis em miniatura, sugerindo uso e movimento.",
  },
  {
    chave: "grafico",
    resumo: "Barras ou blocos comparando tamanhos — sem número e sem rótulo.",
    rotulo: "Dados e comparação",
    texto:
      "Composição de dado: barras, setas ou blocos de tamanhos diferentes representando " +
      "comparação ou crescimento, sem eixos, sem escala e sem rótulo de nenhum tipo.",
  },
  {
    chave: "passo",
    resumo: "Três ou quatro elementos ligados por setas, lidos da esquerda para a direita.",
    rotulo: "Sequência de etapas",
    texto:
      "Composição de fluxo: três ou quatro elementos na horizontal, ligados por setas " +
      "simples, lidos da esquerda para a direita como etapas de um processo.",
  },
  {
    chave: "antes-depois",
    resumo: "Duas metades: à esquerda o desorganizado, à direita o mesmo resolvido.",
    rotulo: "Antes e depois",
    texto:
      "Composição em duas metades separadas por uma linha vertical: à esquerda o estado " +
      "desorganizado, à direita o mesmo assunto resolvido e em ordem.",
  },
];

const POR_CHAVE = new Map(ESTILOS.map((e) => [e.chave, e]));

export type LeituraDoAtalho = {
  /** O atalho reconhecido, ou `null` quando a descrição não começa com barra. */
  estilo: Estilo | null;
  /** A cena, já sem o atalho. É ela que passa pela validação de tamanho. */
  cena: string;
  /** O que veio depois da barra e não existe. `null` quando não há problema. */
  desconhecido: string | null;
};

/**
 * Separa o atalho da cena.
 *
 * ⚠️ ATALHO DESCONHECIDO NÃO É IGNORADO nem tratado como parte da cena. As duas saídas
 * silenciosas são piores que a recusa: ignorar faz a pessoa achar que o estilo foi aplicado
 * quando não foi, e tratar como cena manda o modelo desenhar a palavra "/showkase". Quem
 * digita barra está pedindo um atalho — se ele não existe, isso precisa ser dito.
 */
export function separarEstilo(descricao: string): LeituraDoAtalho {
  const limpa = descricao.trim();
  const m = /^\/([a-z-]+)\s*([\s\S]*)$/i.exec(limpa);
  if (!m) return { estilo: null, cena: limpa, desconhecido: null };

  const chave = m[1].toLowerCase();
  const estilo = POR_CHAVE.get(chave);
  if (!estilo) return { estilo: null, cena: m[2].trim(), desconhecido: chave };

  return { estilo, cena: m[2].trim(), desconhecido: null };
}

/**
 * Termos que denunciam um pedido de TEXTO DENTRO da imagem.
 *
 * ⚠️ **ESTA LISTA NASCEU DE UM CASO REAL, em 21/09.** O Eduardo descreveu *"na lousa/projetor
 * (uma dessas opções, estar escrito, Analise queda ORGANICA)"*, e o prompt que saiu daqui
 * terminava com *"Sem nenhum texto, sem letras, sem palavras"*. **O prompt se contradiz**, o
 * modelo obedeceu a descrição, e a imagem saiu com `ORGÁNICA` — acento errado, que é
 * exatamente o que a proibição existe para evitar.
 *
 * ⚠️ **O CÓDIGO JÁ TINHA PREVISTO ESSA ARMADILHA, para o lado errado.** O comentário dos
 * `ESTILOS` diz: *"um atalho que pede o que o prompt proíbe logo abaixo produz imagem confusa
 * em vez de recusa"*. A regra valia para os atalhos que nós escrevemos e **nunca foi aplicada
 * à descrição que a pessoa digita** — que é a única das duas que muda todo dia.
 *
 * ⚠️ **E A TELA JÁ "AVISAVA", sem servir para nada.** Ela dizia *"a proibição de texto na
 * imagem já é acrescentada — não precisa pedir"*. Isso lê como **"nós cuidamos disso"**, não
 * como **"não funciona se você pedir"**. Aviso que descreve o mecanismo em vez da consequência
 * não muda comportamento nenhum.
 */
const PEDIDOS_DE_TEXTO = [
  "escrito",
  "escrita",
  "escritos",
  "escritas",
  "escreva",
  "escrever",
  "escrevendo",
  "texto",
  "letras",
  "palavra",
  "palavras",
  "números",
  "numeros",
  "título",
  "titulo",
  "legenda",
  "rótulo",
  "rotulo",
  "frase",
  "dizeres",
  "placa",
] as const;

/**
 * O termo que faz a descrição pedir texto na imagem, ou `null`.
 *
 * ⚠️ **NÃO É VALIDAÇÃO, é aviso — e a separação é deliberada.** `validarDescricao` decide se o
 * botão pode ser clicado; isto só explica um risco. Detecção por palavra erra, e travar quem
 * escreveu "a placa da porta" seria pior que a imagem torta que ela evita. Decidido pelo
 * Eduardo em 21/09, que pediu explicitamente um aviso e não um bloqueio.
 *
 * ⚠️ **A FRONTEIRA NÃO PODE SER `\b`.** O `\b` do JavaScript é ASCII: "órgão" e "título"
 * quebram nos acentos e o casamento sai onde não devia. Este projeto já perdeu 317 skills de
 * cobertura por isso. A forma que funciona é `[^\wÀ-ÿ]` dos dois lados — e é ela que faz
 * **"escritório" não casar com "escrito"**, que seria o falso positivo mais provável aqui.
 */
export function pedeTextoNaImagem(descricao: string): string | null {
  const cena = separarEstilo(descricao).cena;
  for (const termo of PEDIDOS_DE_TEXTO) {
    const re = new RegExp(`(^|[^\\wÀ-ÿ])${termo}(?=[^\\wÀ-ÿ]|$)`, "i");
    if (re.test(cena)) return termo;
  }
  return null;
}

export const MIN_DESCRICAO = 10;
export const MAX_DESCRICAO = 600;

export type ErroDeDescricao =
  | { ok: true }
  | { ok: false; mensagem: string };

/**
 * Confere a descrição ANTES de gastar uma chamada.
 *
 * O mínimo não é burocracia: "uma lousa" gera qualquer coisa, e a chamada é paga. Uma
 * recusa aqui custa zero; uma imagem inútil custa dinheiro e uma unidade da cota do dia.
 */
export function validarDescricao(descricao: string): ErroDeDescricao {
  const atalho = separarEstilo(descricao);

  if (atalho.desconhecido) {
    return {
      ok: false,
      mensagem: `Não existe o atalho /${atalho.desconhecido}. Os que existem: ${ESTILOS.map((e) => `/${e.chave}`).join(", ")}.`,
    };
  }

  // A CENA é o que se mede, não o texto digitado: com o atalho contando para o mínimo,
  // "/showcase uma" passaria de raspão e geraria uma imagem vaga — que é justamente o que
  // este limite existe para evitar, e a chamada é paga.
  const limpa = atalho.cena;

  if (limpa.length === 0) {
    return { ok: false, mensagem: "Descreva o que a ilustração deve mostrar." };
  }
  if (limpa.length < MIN_DESCRICAO) {
    return {
      ok: false,
      mensagem: `Descreva com um pouco mais de detalhe — pelo menos ${MIN_DESCRICAO} caracteres. Descrição vaga gera imagem vaga, e a chamada é paga.`,
    };
  }
  if (limpa.length > MAX_DESCRICAO) {
    return {
      ok: false,
      mensagem: `A descrição passou de ${MAX_DESCRICAO} caracteres. Descreva uma cena só — quanto mais coisa, menos o modelo acerta cada uma.`,
    };
  }
  return { ok: true };
}

/**
 * Monta o prompt final: a cena que a pessoa descreveu, embrulhada nas regras fixas.
 *
 * A ORDEM importa e não é decorativa — cena primeiro (é o assunto), estilo e fundo depois
 * (são como desenhar), proibição por último (é o que não fazer, e fica mais perto do fim
 * do que o modelo lê).
 */
export function montarPrompt(descricao: string): string {
  const atalho = separarEstilo(descricao);
  const cena = atalho.cena.replace(/\s+/g, " ");
  // O ponto final evita que a cena e o estilo virem uma frase só, o que costuma fazer o
  // modelo ler "minimalista" como parte do que foi pedido em vez de como instrução.
  const comPonto = /[.!?]$/.test(cena) ? cena : `${cena}.`;

  // O ENQUADRAMENTO vem logo depois da cena e ANTES do estilo: ele fala do assunto (o que
  // aparece, como está posto), e o estilo fala do traço. Invertido, o modelo tende a ler a
  // composição como mais uma característica visual e a diluí-la.
  return [
    comPonto,
    ...(atalho.estilo ? [atalho.estilo.texto] : []),
    ESTILO,
    FUNDO,
    PROIBICAO_DE_PESSOA_REAL,
    PROIBICAO_DE_TEXTO,
  ].join(" ");
}
