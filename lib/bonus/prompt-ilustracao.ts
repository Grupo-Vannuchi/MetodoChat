// AS REGRAS DA IMAGEM DO CHAT (spec da Etapa 6, adendo de 09/10, "As regras de estilo do Chat"). PURO,
// para ser testável fora do módulo que chama a API.
//
// ⚠️ ESTE ARQUIVO NASCEU DA CÓPIA DO LABS, E SE SEPAROU DELE EM 09/10. Até ali ele era, byte a byte, o
// `src/lib/ia/prompt-ilustracao.ts` do Labs (main 672ee71, blob d993e809), feito para as ilustrações do
// site. A primeira imagem real do Chat saiu com "cara de IA", e as seis referências que o Eduardo mandou
// dos carrosséis pediam o contrário daquelas regras: texto em português dentro da imagem, luz de cinema,
// a cena como metáfora do post. Ele decidiu, pela caixa, que o Chat tem regras próprias. Ficaram do Labs,
// sem mudar uma letra, a proibição de texto (quando não há aspas), a de pessoa real e de marca (o manual
// do perfil) e a cena de borda a borda; os atalhos de composição ficaram, com o `/grafico` ajustado.
// A tradução das recusas da OpenAI (`erro-ilustracao.ts`) continua cópia do Labs.
//
// A pessoa digita a CENA, e pode começar por um estilo e um atalho (`/cinema /antes-depois …`). O
// estilo, a composição, o fundo e as proibições são acrescentados aqui. O texto que deve aparecer na
// imagem vai ENTRE ASPAS, e só ele aparece.
//
// ⚠️ NÃO há chamada ao Claude para "melhorar" a descrição, como no Labs.

// A REGRA DO TEXTO, QUANDO A DESCRIÇÃO NÃO TEM ASPAS. O bloco abaixo é o do Labs, sem mudar uma letra
// (inclusive o comentário). No Chat, com trechos entre aspas, o lugar dela é de `textoExato`, que pede
// exatamente aqueles trechos e mais nenhum texto; as duas vão por último, pelo mesmo motivo.
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

// A REGRA DO MANUAL DO PERFIL, DO LABS, SEM MUDAR UMA LETRA. O Eduardo a manteve no Chat em 09/10:
// pessoa real, figura pública e marca continuam proibidas, e a tela a mostra junto do campo.
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

/** As chaves dos três estilos do Chat. */
export type ChaveDoEstilo = "cinema" | "ilustracao" | "comercial";

/** Um estilo da imagem: o que a tela mostra (`rotulo`, `resumo`) e o trecho que vai à OpenAI (`texto`). */
export type EstiloDaImagem = { chave: ChaveDoEstilo; rotulo: string; resumo: string; texto: string };

/**
 * OS TRÊS ESTILOS, escolhidos por slide (decisão do Eduardo em 09/10, depois das referências). O
 * "objeto 3D em fundo claro" ficou de fora.
 *
 * ⚠️ **O LABS TINHA UM ESTILO SÓ, E O MOTIVO VALE COMO HISTÓRICO:** "dez slides com dez estéticas leem
 * como colagem". As referências dos carrosséis do Chat mostram o contrário, um jeito por post, e o
 * Eduardo escolheu três. O que o Labs aprendeu continua dentro de cada um: descrever a luz e a ÓPTICA,
 * e não adjetivo de qualidade ("foto realista de alta qualidade" o modelo já acha que cumpre); pedir
 * pele com poros contra a pele de plástico; e pedir as mãos repousadas ou fora do primeiro plano, que é
 * a única coisa que o prompt faz pelos dedos ("modelo não obedece negativa; obedece enquadramento"). A
 * alavanca forte contra artefato é o modelo e a qualidade, escolhidos pela medição do adendo.
 *
 * Os textos são os da tabela da spec, e os pedidos medidos do apêndice saem deles: um teste confere.
 */
export const ESTILOS: EstiloDaImagem[] = [
  {
    chave: "cinema",
    rotulo: "Cena de cinema",
    resumo: "foto realista, luz dramática e contraste forte",
    texto:
      "Fotografia realista com cara de cena de cinema, num ambiente de trabalho brasileiro contemporâneo. " +
      "Luz dramática e quente, de abajur, de janela no fim da tarde ou de tela, com sombras profundas e " +
      "contraste forte; fundo levemente desfocado. Cores ricas e naturais. Pele com textura real, poros e " +
      "pequenas imperfeições, sem brilho oleoso e sem retoque. Expressões claras e postura natural, com as " +
      "mãos repousadas ou fora do primeiro plano. Sem aparência de render 3D, de desenho ou de banco de " +
      "imagens.",
  },
  {
    chave: "ilustracao",
    rotulo: "Ilustração conceitual",
    resumo: "uma metáfora desenhada, com textura",
    texto:
      "Ilustração conceitual digital, com acabamento de peça editorial: uma metáfora visual clara do " +
      "assunto, feita de objetos simbólicos, ícones simples, post-its, fios e setas, sobre fundo com " +
      "textura de papel. Cores vivas e harmônicas, sombras suaves, traço limpo e volume leve. Não é foto " +
      "nem render 3D realista.",
  },
  {
    chave: "comercial",
    rotulo: "Ambiente comercial brilhante",
    resumo: "loja, vitrine ou fachada iluminada",
    texto:
      "Fotografia realista de ambiente comercial bem iluminado: loja, vitrine, balcão ou fachada, com luz " +
      "quente de spots, reflexos no chão e no vidro, produtos organizados e brilho convidativo de vitrine. " +
      "Cores quentes e saturadas na medida, nitidez de foto profissional. Fachadas, caixas e produtos sem " +
      "nome, sem marca e sem logotipo visível.",
  },
];

/** Sem estilo na descrição, vale este; a tela sempre manda um. */
export const ESTILO_PADRAO: ChaveDoEstilo = "cinema";

// A CENA DE BORDA A BORDA, DO LABS, SEM MUDAR UMA LETRA.
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

// OS ATALHOS DE COMPOSIÇÃO, DO LABS. No Labs chamavam-se `ESTILOS` (era a única escolha); no Chat, o
// estilo é a estética e o atalho é a composição. Os textos são os do Labs, menos o do `/grafico`, que
// passa a aceitar os números e rótulos que o operador escreve entre aspas (adendo de 09/10).
/**
 * ATALHOS DE COMPOSIÇÃO, escritos com barra no começo da descrição: `/showcase uma caixa…`.
 *
 * Pedido pelo Eduardo em 02/09, com a pergunta certa junto: "não sei se tem como aplicar na
 * API". **Tem, e é mais simples do que parece.** No ChatGPT a barra não é recurso do
 * modelo: é um texto guardado que ele cola antes do seu. Pela API é a mesma coisa — o
 * atalho vira um trecho de prompt, e este arquivo já fazia isso com o estilo fixo.
 *
 * ⚠️ **O QUE O ATALHO MUDA É O ENQUADRAMENTO, NÃO A ESTÉTICA.** O estilo escolhido (`ESTILOS`, acima)
 * vale com qualquer atalho: a mesma luz, o mesmo acabamento. Isso é deliberado e contraria o impulso
 * de deixar cada atalho com a cara dele — dez slides com dez estéticas leem como colagem, e
 * a sequência precisa parecer uma coisa só. O atalho decide O QUE aparece e COMO está
 * composto; a linguagem visual não se mexe.
 *
 * Nenhum deles pede texto por conta própria: um atalho que pede o que a regra do texto proíbe
 * logo abaixo produz imagem confusa em vez de recusa. No Chat, o `/grafico` aceita os números e
 * rótulos que o operador escreve entre aspas, e só esses (adendo de 09/10).
 */
export type Atalho = {
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

export const ATALHOS: Atalho[] = [
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
    resumo: "Barras ou blocos comparando tamanhos; números e rótulos, só os que você puser entre aspas.",
    rotulo: "Dados e comparação",
    texto:
      "Composição de dado: barras, setas ou blocos de tamanhos diferentes representando " +
      "comparação ou crescimento, sem eixos nem escala; números e rótulos, só os que estiverem " +
      "entre aspas na descrição.",
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

const ESTILO_POR_CHAVE = new Map(ESTILOS.map((e) => [e.chave as string, e]));
const ATALHO_POR_CHAVE = new Map(ATALHOS.map((a) => [a.chave, a]));

/** A descrição lida: o estilo (o padrão, se não veio), o atalho, a cena e o que deu errado no começo. */
export type LeituraDaDescricao = {
  estilo: EstiloDaImagem;
  atalho: Atalho | null;
  /** A cena, já sem os atalhos do começo. É ela que passa pelas regras de tamanho. */
  cena: string;
  /** O que veio depois de uma barra e não é estilo nem atalho. */
  desconhecido: string | null;
  /** Dois estilos, ou dois atalhos, no começo. */
  repetido: "estilo" | "atalho" | null;
};

/**
 * Separa o estilo e o atalho da cena: no começo da descrição, até um de cada, em qualquer ordem.
 *
 * ⚠️ ATALHO DESCONHECIDO NÃO É IGNORADO nem vira cena (a lição do Labs): ignorar faz a pessoa achar que
 * o estilo foi aplicado, e virar cena manda o modelo desenhar a palavra.
 */
export function lerDescricao(descricao: string): LeituraDaDescricao {
  let resto = descricao.trim();
  let estilo: EstiloDaImagem | null = null;
  let atalho: Atalho | null = null;
  let desconhecido: string | null = null;
  let repetido: LeituraDaDescricao["repetido"] = null;
  for (;;) {
    const m = /^\/([a-z-]+)\s*([\s\S]*)$/i.exec(resto);
    if (!m) break;
    const chave = m[1].toLowerCase();
    const comoEstilo = ESTILO_POR_CHAVE.get(chave);
    const comoAtalho = ATALHO_POR_CHAVE.get(chave);
    if (comoEstilo) {
      if (estilo) repetido ??= "estilo";
      estilo = comoEstilo;
    } else if (comoAtalho) {
      if (atalho) repetido ??= "atalho";
      atalho = comoAtalho;
    } else {
      desconhecido ??= chave;
    }
    resto = m[2];
  }
  return { estilo: estilo ?? ESTILO_POR_CHAVE.get(ESTILO_PADRAO)!, atalho, cena: resto.trim(), desconhecido, repetido };
}

/**
 * Os trechos entre aspas da cena, retas (`"…"`) ou curvas (`“…”`), na ordem em que aparecem; e se
 * alguma aspa ficou sem par. Trecho vazio (`""`) não conta.
 */
export function trechosEntreAspas(cena: string): { trechos: string[]; semPar: boolean } {
  const trechos: string[] = [];
  let aberto: string | null = null;
  for (const c of cena) {
    if (aberto === null) {
      if (c === '"' || c === "“") aberto = "";
      else if (c === "”") return { trechos, semPar: true };
    } else if (c === '"' || c === "”") {
      if (aberto.length > 0) trechos.push(aberto);
      aberto = null;
    } else if (c === "“") {
      return { trechos, semPar: true };
    } else {
      aberto += c;
    }
  }
  return { trechos, semPar: aberto !== null };
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
  const cena = lerDescricao(descricao).cena;
  for (const termo of PEDIDOS_DE_TEXTO) {
    const re = new RegExp(`(^|[^\\wÀ-ÿ])${termo}(?=[^\\wÀ-ÿ]|$)`, "i");
    if (re.test(cena)) return termo;
  }
  return null;
}

export const MIN_DESCRICAO = 10;
export const MAX_DESCRICAO = 600;
/** O texto entre aspas, somado: mais do que isso, o modelo erra letras e a imagem vira cartaz. */
export const MAX_TEXTO_ENTRE_ASPAS = 120;

export type ErroDeDescricao = { ok: true } | { ok: false; mensagem: string };

/**
 * Confere a descrição ANTES de gastar uma chamada (spec, "A conferência da descrição"). Uma recusa aqui
 * custa zero; uma imagem inútil custa dinheiro e uma unidade do teto do dia.
 *
 * A CENA que se mede, para o mínimo, é a de sem os atalhos e sem o texto entre aspas: "/cinema "VENDAS""
 * passaria de raspão e geraria uma imagem vaga.
 */
export function validarDescricao(descricao: string): ErroDeDescricao {
  const lida = lerDescricao(descricao);
  if (lida.desconhecido) {
    return {
      ok: false,
      mensagem:
        `Não existe o atalho /${lida.desconhecido}. ` +
        `Os estilos: ${ESTILOS.map((e) => `/${e.chave}`).join(", ")}. ` +
        `Os atalhos: ${ATALHOS.map((a) => `/${a.chave}`).join(", ")}.`,
    };
  }
  if (lida.repetido === "estilo") return { ok: false, mensagem: "Escolha um estilo só para a imagem." };
  if (lida.repetido === "atalho") return { ok: false, mensagem: "Use um atalho de composição só." };
  if (descricao.trim().length > MAX_DESCRICAO) {
    return {
      ok: false,
      mensagem: `A descrição passou de ${MAX_DESCRICAO} caracteres. Descreva uma cena só — quanto mais coisa, menos o modelo acerta cada uma.`,
    };
  }
  const aspas = trechosEntreAspas(lida.cena);
  if (aspas.semPar) return { ok: false, mensagem: "Feche as aspas do texto que deve aparecer na imagem." };
  if (aspas.trechos.join("").length > MAX_TEXTO_ENTRE_ASPAS) {
    return {
      ok: false,
      mensagem: `O texto entre aspas passou de ${MAX_TEXTO_ENTRE_ASPAS} caracteres. Encurte: texto longo sai com erro e vira cartaz.`,
    };
  }
  const semAspas = lida.cena.replace(/["“][^"”]*["”]/g, " ").replace(/\s+/g, " ").trim();
  if (semAspas.length === 0) return { ok: false, mensagem: "Descreva o que a imagem deve mostrar." };
  if (semAspas.length < MIN_DESCRICAO) {
    return {
      ok: false,
      mensagem: `Descreva com um pouco mais de detalhe — pelo menos ${MIN_DESCRICAO} caracteres. Descrição vaga gera imagem vaga, e a chamada é paga.`,
    };
  }
  return { ok: true };
}

/**
 * A REGRA DO TEXTO, QUANDO HÁ ASPAS: escrever exatamente aqueles trechos, com os acentos, e mais nenhum
 * texto. O nome de marca entre aspas sai em letra simples, sem logo (decisão do Eduardo na revisão do
 * adendo): o Chat não reconhece toda marca, então não recusa; diz ao modelo como escrever.
 */
export function textoExato(trechos: string[]): string {
  return (
    "Escreva na imagem exatamente estes textos, em português do Brasil, com a grafia, as maiúsculas e os " +
    `acentos exatamente como estão entre aspas: ${trechos.map((t) => `"${t}"`).join("; ")}. Cada um aparece ` +
    "uma vez, legível, numa superfície que faça sentido na cena (placa, tela, papel, quadro, post-it ou " +
    "rótulo). Se um deles for o nome de uma marca ou de um produto, escreva-o em letras simples e comuns, " +
    "sem o logotipo, o ícone, as cores ou a fonte da marca. Nenhum outro texto, letra, número ou logotipo " +
    "em nenhuma parte da imagem."
  );
}

/**
 * MONTA O PEDIDO: estilo, atalho, cena, fundo, pessoa real e, por último, o texto (a ordem decidida pelo
 * Eduardo na revisão do adendo). O texto e as proibições ficam no fim porque "é a última coisa que o
 * modelo lê" (o Labs). Juntados por um espaço, a cena com ponto final, como no Labs.
 *
 * ⚠️ OS PEDIDOS DA MEDIÇÃO (o apêndice da spec) SAEM DAQUI BYTE A BYTE, e um teste confere: o que foi
 * medido é o que vai ao ar.
 */
export function montarPrompt(descricao: string): string {
  const lida = lerDescricao(descricao);
  const cena = lida.cena.replace(/\s+/g, " ").trim();
  const comPonto = /[.!?]$/.test(cena) ? cena : `${cena}.`;
  const { trechos } = trechosEntreAspas(cena);
  return [
    lida.estilo.texto,
    ...(lida.atalho ? [lida.atalho.texto] : []),
    comPonto,
    FUNDO,
    PROIBICAO_DE_PESSOA_REAL,
    trechos.length > 0 ? textoExato(trechos) : PROIBICAO_DE_TEXTO,
  ].join(" ");
}
