import { formatWindowLeft } from "./inbox-window";
import {
  DIAS_DE_AVISO_DA_PUBLICACAO,
  HORAS_DE_AVISO_DA_MENSAGEM,
} from "./publicacao";
import { fmtRelative } from "./format";

// O QUE A TELA INICIAL MOSTRA — e por que ela quer ficar vazia.
//
// A spec da linguagem visual (docs/specs/2026-09-10-linguagem-visual.md) separa
// três perguntas que estavam empilhadas numa tela só, e dá a cada uma o seu
// lugar e o seu ritmo:
//
//   precisa de mim?    -> Início      dez vezes por dia; quer estar vazia
//   o que aconteceu?   -> Atividade   diário, em ordem de tempo
//   está funcionando?  -> Desempenho  semanal, quer profundidade
//
// Este arquivo responde a PRIMEIRA. Ele devolve a lista do que precisa do dono
// agora, já na ordem em que ele tem de olhar — e devolve `[]` quando não
// precisa de nada, que é o desfecho comum e é a resposta, não um buraco.
//
// NENHUM IMPORT DE SERVIDOR. É aritmética e são frases; a decisão sai do JSX
// porque a suíte não testa componente, e ordem que ninguém mede é ordem que
// ninguém garante.

/** Quanto tempo restando torna uma conversa URGENTE e não só aberta. */
export const HORAS_QUE_TORNAM_URGENTE = 3;

/** Quantas conversas cabem na tela inicial antes de ela virar outra tela. */
export const MAX_CONVERSAS_NO_INICIO = 5;

const MS_DO_CORTE = HORAS_QUE_TORNAM_URGENTE * 3_600_000;

/**
 * UM POST QUE ESTÁ RECEBENDO COMENTÁRIO E NÃO TEM AUTOMAÇÃO ESCUTANDO.
 *
 * A terceira forma de "precisa de mim", e a de maior volume: medido em
 * 14/09/2026, 331 dos 332 comentários da semana caíram em post sem automação
 * ativa, e o maior deles juntou CEM pessoas sem resposta.
 *
 * NÃO É DEFEITO DO MOTOR, e por isso não é `parou`: ele não responde porque não
 * há nada configurado para aquele post. É trabalho de configuração — do
 * marketing, não nosso —, e o que cabe ao painel é DIZER.
 */
export type Oportunidade = {
  /** o id do post no Instagram, que vira parâmetro de URL */
  mediaId: string;
  comentarios: number;
  /** quando chegou o último comentário; `null` quando não se sabe */
  ultimo: Date | string | null;
  /**
   * A legenda do post, quando a página conseguiu buscar na Meta.
   *
   * OPCIONAL DE PROPÓSITO, e é a fronteira de camada: esta função é pura e não
   * sabe que existe uma API do outro lado. Quem preenche é `app/page.tsx`, e
   * quando a chamada falha ou demora o campo simplesmente não vem — a linha
   * renderiza inteira sem ele.
   */
  nome?: string | null;
};

/** Quantas oportunidades cabem na tela antes de ela virar uma lista de posts. */
export const MAX_OPORTUNIDADES = 3;

/**
 * Quantos comentários um post precisa juntar para virar linha.
 *
 * SEM PISO A TELA DE CHAMADOS VIRA RUÍDO: medido na conta em 14/09, com piso 1
 * seriam DOZE linhas — a cauda é feita de posts antigos com 4, 5 e 6
 * comentários perdidos. Com piso 5, três linhas, e as três valem o clique.
 */
export const MIN_COMENTARIOS_DA_OPORTUNIDADE = 5;

/**
 * O tom da linha, e ele é o MESMO vocabulário de cor do resto do produto
 * (`app/globals.css`): `aberto` é a janela que ainda tem tempo, `fecha` é o
 * prazo curto, `parou` é o que falhou. `quieto` é o convite — não é estado de
 * nada, e por isso não gasta cor.
 */
export type Urgencia = "aberto" | "fecha" | "parou" | "quieto";

/** Uma pessoa que falou e ainda não teve resposta, com o que resta da janela. */
export type ConversaEsperando = {
  igId: string;
  /** o @ dela; pode ser nulo (só comentou, ou perfil sem username lido) */
  quem: string | null;
  msLeft: number;
};

export type FatosDoInicio = {
  esperando: ConversaEsperando[];
  falhasPublicacao: number;
  falhasMensagem: number;
  automacoesAtivas: number;
  /** posts recebendo comentário sem automação — ver `Oportunidade` */
  oportunidades: Oportunidade[];
};

export type ItemDoInicio = {
  /** identidade estável da linha: chave de lista, e o que os testes prendem */
  chave: string;
  /** "conversa" ganha o traço da janela; "aviso" ganha um ponto */
  tipo: "conversa" | "aviso";
  titulo: string;
  detalhe: string;
  href: string;
  urgencia: Urgencia;
  /** só nas linhas com prazo: quanto resta, para o traço e para a legenda */
  msLeft?: number;
};

/**
 * O TOM DE UMA JANELA, pelo que resta dela.
 *
 * Ela existe SEPARADA da lista porque duas telas a usam — a tela inicial e a
 * lista de conversas — e as duas têm de pintar a mesma janela com a mesma cor.
 * Enquanto a regra morava dentro de `oQuePrecisaDeVoce`, a lista de conversas
 * não tinha como concordar com ela a não ser copiando o `3` — e é assim que
 * duas telas passam a discordar sobre o mesmo fato.
 *
 * FECHADA É `quieto`, E NÃO `fecha`. `fecha` quer dizer "corre, está acabando";
 * depois que acabou não há o que correr. O traço dessa linha fica vazio de
 * qualquer jeito, mas a cor do ponto e de qualquer outro uso não pode dizer
 * urgência sobre uma coisa que já passou.
 */
export function urgenciaDaJanela(msLeft: number): Urgencia {
  if (msLeft <= 0) return "quieto";
  return msLeft < MS_DO_CORTE ? "fecha" : "aberto";
}

/**
 * As oportunidades que merecem linha, das maiores para as menores.
 *
 * ORDENA ANTES DE CORTAR, pelo mesmo motivo que `oQuePrecisaDeVoce` ordena as
 * conversas antes: cortar cru deixaria de fora justamente o post com mais gente
 * esperando, que é o único que esta tela não pode perder.
 *
 * O DESEMPATE PELO ID não é capricho — sem ele, dois posts com a mesma contagem
 * trocariam de lugar entre um render e outro, e a tela mudaria de ordem sozinha
 * a cada F5.
 */
export function recorteDasOportunidades(lista: Oportunidade[]): Oportunidade[] {
  return lista
    .filter((o) => o.comentarios >= MIN_COMENTARIOS_DA_OPORTUNIDADE)
    .sort((a, b) => b.comentarios - a.comentarios || a.mediaId.localeCompare(b.mediaId))
    .slice(0, MAX_OPORTUNIDADES);
}

/**
 * O TÍTULO DA LINHA DE OPORTUNIDADE — e ele mora fora de `oQuePrecisaDeVoce`
 * por um motivo que uma revisão achou em 14/09/2026.
 *
 * Enquanto o singular e o plural eram um ternário DENTRO do laço, o ramo do
 * singular era INALCANÇÁVEL: `recorteDasOportunidades` corta tudo abaixo de
 * `MIN_COMENTARIOS_DA_OPORTUNIDADE` (5) antes de o laço rodar, então nenhum
 * chamador conseguia pedir "1 comentário". O caso que tentava prendê-lo teve de
 * trocar o 1 por 5 para passar, e passou a afirmar plural sob um nome que
 * prometia singular — um teste que mente é pior que um teste que falta.
 *
 * Aqui o singular tem porta de entrada, tem caso, e continua valendo no dia em
 * que o piso mudar. Frase derivada de um número é função pura, e função pura
 * tem caso.
 */
export function tituloDaOportunidade(comentarios: number): string {
  return comentarios === 1
    ? "1 comentário sem automação"
    : `${comentarios} comentários sem automação`;
}

/**
 * A LISTA DO QUE PRECISA DE VOCÊ, NA ORDEM EM QUE PRECISA.
 *
 * A REGRA DA ORDEM, e ela não é por gravidade: **vem primeiro o que desaparece
 * se ninguém agir na próxima hora.** Só a janela de 24h faz isso. Depois que
 * ela fecha, a Meta recusa a resposta e não há como reabrir — a chance some, e
 * some por relógio, sem ninguém decidir. Uma publicação que falhou às 3h da
 * manhã continua exatamente tão falhada às 9h: é mais grave e é menos urgente,
 * e a tela que confunde as duas coisas manda o dono resolver o que podia
 * esperar enquanto o que não podia expira ao lado.
 *
 * Daí saem as quatro faixas:
 *
 *   1. conversa com menos de HORAS_QUE_TORNAM_URGENTE — a mais apertada antes
 *   2. publicação que não saiu — já é pública, e o perfil está errado agora
 *   3. mensagem que não saiu — não é pública, e por isso vem depois
 *   4. conversa com o dia pela frente — a mais apertada antes, de novo
 *   5. o convite de criar automação — não é pendência, e fecha a lista
 *
 * O QUE NÃO ENTRA AQUI: contagem, gráfico e histórico. Eles respondem "está
 * funcionando?" e "o que aconteceu?", e têm as telas deles. Empilhá-los nesta é
 * o que produzia o amontoado que a auditoria mediu.
 */
export function oQuePrecisaDeVoce(f: FatosDoInicio): ItemDoInicio[] {
  // A JANELA FECHADA SAI ANTES DE QUALQUER COISA. Não há resposta a mandar
  // depois dela, e uma tela de chamados que lista o que não tem ação deixa de
  // ser uma tela de chamados. `msLeft <= 0` cobre o zero e o negativo — a fonte
  // é `windowState`, que satura em zero, mas quem chama pode não passar por ela.
  const abertas = f.esperando
    .filter((c) => c.msLeft > 0)
    .sort((a, b) => a.msLeft - b.msLeft);

  // O CORTE É DAS MAIS APERTADAS, e por isso vem DEPOIS da ordenação: cortar
  // antes deixaria de fora justamente quem fecha primeiro, que é a única pessoa
  // que esta tela não pode perder.
  const mostradas = abertas.slice(0, MAX_CONVERSAS_NO_INICIO);
  const naoMostradas = abertas.slice(MAX_CONVERSAS_NO_INICIO);
  const escondidas = naoMostradas.length;

  const linhaDaConversa = (c: ConversaEsperando): ItemDoInicio => ({
    chave: "conversa:" + c.igId,
    tipo: "conversa",
    // SEM @ AINDA APARECE: quem só comentou pode não ter username lido, e a
    // janela dessa pessoa fecha igual. "alguém" é honesto; "@null" é defeito.
    titulo: c.quem ? "@" + c.quem : "alguém sem nome ainda",
    detalhe: "esperando resposta",
    // O id vem do banco e vira caminho de URL. Um id com barra inventaria um
    // segmento de rota — o mesmo cuidado de `urlDaConversaComAviso`.
    href: "/conversas/" + encodeURIComponent(c.igId),
    urgencia: urgenciaDaJanela(c.msLeft),
    msLeft: c.msLeft,
  });

  const urgentes = mostradas.filter((c) => c.msLeft < MS_DO_CORTE).map(linhaDaConversa);
  const calmas = mostradas.filter((c) => c.msLeft >= MS_DO_CORTE).map(linhaDaConversa);

  const itens: ItemDoInicio[] = [...urgentes];

  // A OPORTUNIDADE ENTRA AQUI, E O LUGAR É A DECISÃO.
  //
  // Abaixo da conversa apertada: aquela expira por relógio, em minutos, e some.
  // Acima das falhas: a publicação que falhou às 3h continuará falhada às 9h —
  // é mais grave e é menos urgente —, enquanto o post sem automação junta mais
  // gente a cada hora que passa.
  for (const o of recorteDasOportunidades(f.oportunidades)) {
    itens.push({
      chave: "oportunidade:" + o.mediaId,
      tipo: "aviso",
      titulo: tituloDaOportunidade(o.comentarios),
      // O NOME DO POST QUANDO ELE VEIO, e a frase inteira quando não veio. Quem
      // lê "100 comentários em 'Carrossel ChatGPT'" sabe o que vai fazer; quem
      // lê um número sozinho, não.
      //
      // `nome` PASSA POR `trim()` AQUI, e não antes: uma legenda vinda da Meta
      // só de espaços é "sem nome" na prática, mas sobrevivia ao
      // `.filter(Boolean)` (string não vazia é truthy) e virava um " · " colado
      // em nada — o separador aparecendo sem o texto que ele deveria separar.
      detalhe: [o.nome?.trim() || null, o.ultimo ? "último " + fmtRelative(o.ultimo) : null]
        .filter(Boolean)
        .join(" · ") || "nenhuma automação escuta este post",
      // O id vem do banco e vira parâmetro de URL — o mesmo cuidado que
      // `linhaDaConversa` toma com o `igId`.
      href: "/automacoes/nova?post=" + encodeURIComponent(o.mediaId),
      // `fecha` e não `parou`: nada quebrou, e nada está vermelho. Mas também
      // não é `aberto` — o volume cresce enquanto ninguém age.
      urgencia: "fecha",
    });
  }

  if (f.falhasPublicacao > 0) {
    const n = f.falhasPublicacao;
    itens.push({
      chave: "falha-publicacao",
      tipo: "aviso",
      titulo: n === 1 ? "1 publicação não saiu" : n + " publicações não saíram",
      // A JANELA VAI NO TEXTO, e vem da MESMA constante que a consulta usa
      // (app/page.tsx). Ela estava na frase antiga e some com facilidade numa
      // reescrita — foi o que aconteceu aqui, e um caso de integração pegou.
      // Sem ela, o dia em que alguém mudar 7 para 3 a tela continuará dizendo a
      // mesma coisa sobre um recorte diferente.
      detalhe: "nos últimos " + DIAS_DE_AVISO_DA_PUBLICACAO + " dias",
      href: "/publicar",
      urgencia: "parou",
    });
  }

  if (f.falhasMensagem > 0) {
    const n = f.falhasMensagem;
    itens.push({
      chave: "falha-mensagem",
      tipo: "aviso",
      titulo: n === 1 ? "1 mensagem não saiu" : n + " mensagens não saíram",
      detalhe: "nas últimas " + HORAS_DE_AVISO_DA_MENSAGEM + "h",
      href: "/eventos",
      urgencia: "parou",
    });
  }

  itens.push(...calmas);

  // A LINHA DO RESTO EXISTE PARA NÃO ESCONDER NINGUÉM. Cortar em cinco e calar
  // sobre o corte faria a tela dizer "cinco pessoas esperam" quando são nove —
  // e o número menor é o que dá permissão para fechar o painel.
  if (escondidas > 0) {
    itens.push({
      chave: "mais-conversas",
      tipo: "aviso",
      titulo:
        escondidas === 1
          ? "mais 1 pessoa esperando"
          : "mais " + escondidas + " pessoas esperando",
      detalhe: "com a janela ainda aberta",
      href: "/conversas",
      // A URGÊNCIA VEM DE QUEM ELA ESCONDE, e não de um literal. Achado por
      // revisão em 11/09/2026: a linha cravava "aberto" (verde de calma) mesmo
      // quando TODAS as escondidas estavam abaixo do corte de urgência — ou
      // seja, anunciava em verde que quatro pessoas cujas janelas fecham em
      // minutos "ainda têm a janela aberta". Tecnicamente verdade, e a cor
      // dizia o contrário do que importava.
      urgencia: naoMostradas.some((c) => c.msLeft < MS_DO_CORTE) ? "fecha" : "aberto",
    });
  }

  // O CONVITE FECHA A LISTA, SEMPRE. Ele não é pendência: nada quebrou e nada
  // expira. Numa conta nova ele é a única linha, e aí é exatamente o que a
  // pessoa precisa ler.
  if (f.automacoesAtivas === 0) {
    itens.push({
      chave: "sem-automacao",
      tipo: "aviso",
      titulo: "Nenhuma automação ativa",
      detalhe: "ninguém está sendo respondido sozinho",
      href: "/automacoes/nova",
      urgencia: "quieto",
    });
  }

  return itens;
}

/**
 * A legenda de tempo da linha da conversa — "fecha em 2h10", "fechada".
 *
 * Feita SOBRE `formatWindowLeft`, e não ao lado dela: o número que a tela
 * inicial mostra tem de ser o mesmo que a lista de conversas mostra, e o mesmo
 * que o motor usa para recusar o envio. Uma segunda régua de tempo neste
 * produto seria a segunda régua a divergir.
 */
export function legendaDoPrazo(msLeft: number): string {
  const resta = formatWindowLeft(msLeft);
  return resta === "fechada" ? "fechada" : "fecha em " + resta;
}
