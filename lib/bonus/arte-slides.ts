// VEIO DO MÉTODO LABS (site-ia, src/lib/ia/slides.ts, em 45bc973). DOIS DONOS: o mesmo resultado nos
// dois projetos é conferido pelos vetores (tests/vetores-da-arte.json), e não por código igual
// (spec da Etapa 4, "Dois donos"). O piso e o fator sem ilustração são os de lá. O que muda:
// - a entrada é o texto do Chat (carrossel-texto.ts): `chamada` no lugar de `chamadaParaAcao`, e
//   `slidesDoTexto` escolhe entre o carrossel e o post;
// - a escolha da fonte mede a composição (arte-composicao.ts), a mesma que a arte desenha, com a
//   conta exata (arte-medida.ts), e o gancho tem o degrau de 46 (os dois, Etapa 4 aqui e 48 lá).
// No Chat, a "ilustração" é o espaço em branco que o operador reserva para a imagem do Canva.
//
import { composicaoDoSlide } from "./arte-composicao";
import { alturaDisponivel } from "./arte-geometria";
import { medidaDaComposicao } from "./arte-medida";
import type { TextoDeCarrossel, TextoDePost, TextoDoCarrossel } from "./carrossel-texto";

// O carrossel gerado vira uma LISTA DE SLIDES para desenhar.
//
// POR QUE EXISTE: o schema guarda o conteúdo em três formatos diferentes — `gancho` é uma
// string solta, `slides` é uma lista com título e texto, e `chamadaParaAcao` é outra string
// solta. Quem desenha precisa de UMA lista homogênea, com o número e o total em cada peça.
//
// Sem isto, a numeração viveria espalhada: a tela já calculava `slides.length + 2` em três
// lugares para saber o total, e cada um poderia divergir. Agora a conta acontece uma vez.
//
// PURO, sem `server-only`: é a mesma lista que a tela usa para listar e que a rota de
// imagem usa para desenhar. Duas leituras da mesma fonte, não duas fontes.

export type TipoDeSlide = "gancho" | "conteudo" | "cta";

export type SlideParaArte = {
  /** 1-based, como a pessoa conta ao publicar. */
  numero: number;
  total: number;
  tipo: TipoDeSlide;
  /** O gancho e a chamada para ação não têm título — o texto É a peça. */
  titulo: string | null;
  texto: string;
  /**
   * A assinatura (foto, nome e arroba) vai no PÉ da peça, e não no topo.
   *
   * ⚠️ **EXISTE PORQUE O `tipo` CARREGAVA DOIS SIGNIFICADOS.** Até 21/09 a arte decidia isso
   * com `tipo === "cta"`, e o post de uma imagem usa `tipo: "cta"` para escolher o TAMANHO DA
   * FONTE — os degraus dele são os únicos que chegam a 550 caracteres. O post herdou a
   * assinatura no pé de carona, sem ninguém decidir isso.
   *
   * Em 21/09 o Eduardo comparou a peça do dev com quatro publicadas e viu a diferença: nas
   * dele o autor está no topo. Um campo por decisão é o que impede a próxima carona.
   */
  assinaturaNoPe: boolean;
};

export function slidesParaArte(carrossel: TextoDeCarrossel): SlideParaArte[] {
  const total = carrossel.slides.length + 2;

  return [
    { numero: 1, total, tipo: "gancho" as const, titulo: null, texto: carrossel.gancho, assinaturaNoPe: false },
    ...carrossel.slides.map((s, i) => ({
      numero: i + 2,
      total,
      tipo: "conteudo" as const,
      titulo: s.titulo,
      texto: s.texto,
      assinaturaNoPe: false,
    })),
    // ⚠️ O ÚLTIMO SLIDE DO CARROSSEL CONTINUA COM A ASSINATURA NO PÉ. Foi o desenho aprovado
    // em 02/09, e as quatro referências de 21/09 são de POST — nenhuma é slide final, então
    // não há medição que contrarie este aqui. Decidido pelo Eduardo em 21/09: muda só o que
    // ele viu errado.
    { numero: total, total, tipo: "cta" as const, titulo: null, texto: carrossel.chamada, assinaturaNoPe: true },
  ];
}

/**
 * O POST DE UMA IMAGEM vira uma lista de UM slide.
 *
 * Mesmo tipo de saída do carrossel de propósito: quem desenha, quem baixa e quem confere
 * ortografia passam a não precisar saber qual formato estão olhando. Sem isto, cada uma
 * dessas telas ganharia um `if` — e um `if` esquecido num deles é um post que sai errado
 * sem ninguém ver.
 *
 * ⚠️ O tipo é `"cta"` pelos DEGRAUS DE FONTE, e só por isso. Os degraus de `cta` são os
 * únicos que descem até 34px, que é o que um post de ~550 caracteres exige — os de `conteudo`
 * param em 34 mas partem de 46, e os de `gancho` são grandes de propósito.
 *
 * ⚠️ **ATÉ 21/09 ESTE COMENTÁRIO DIZIA OUTRA COISA**, e a outra coisa era uma decisão real:
 * "`cta` é o slide que a arte desenha com a assinatura NO PÉ, que é exatamente a composição
 * da peça única de referência". Era verdade em 02/09 e vinha de uma peça publicada. Em 21/09
 * o Eduardo trouxe quatro, todas com o autor NO TOPO, e escolheu o topo para o post.
 *
 * O que sobra de lição é o formato, não o gosto: um campo (`tipo`) decidia duas coisas sem
 * relação (tamanho da fonte e posição da assinatura), então mudar uma exigia mexer na outra.
 * `assinaturaNoPe` separa as duas, e o carrossel segue com o desenho de 02/09.
 *
 * A chamada para ação, quando existe, entra como último bloco separado por linha em branco
 * — que é como a arte reconhece a linha de fechamento em negrito. Não há segundo slide
 * onde pô-la.
 */
export function slidesDoPost(post: TextoDePost): SlideParaArte[] {
  const texto = post.chamada
    ? `${post.texto.trim()}\n\n${post.chamada.trim()}`
    : post.texto.trim();

  return [{ numero: 1, total: 1, tipo: "cta", titulo: null, texto, assinaturaNoPe: false }];
}

/** O texto do Chat, carrossel ou post, vira a lista de slides que a arte desenha. */
export function slidesDoTexto(t: TextoDoCarrossel): SlideParaArte[] {
  return t.tipo === "post" ? slidesDoPost(t) : slidesParaArte(t);
}

/**
 * Quanto o texto cresce quando o slide NÃO tem ilustração — **por tipo de slide**.
 *
 * A conta vem da geometria, não do gosto: sem a ilustração, a área de texto passa de ~374px
 * para ~947. Crescer na mesma proporção deixaria o texto gigante; o fator usa a folga sem
 * transformar o slide numa placa.
 *
 * ⚠️ **ERA UM NÚMERO SÓ PARA OS TRÊS TIPOS, e por isso ficava travado no menor deles.**
 * O gancho já parte de 86px e a chamada para ação de 60: crescer muito ali vira placa. O
 * slide de CONTEÚDO parte de 34 a 46, e com o mesmo 1,35 sobrava um terço da peça em branco
 * — foi o que o Eduardo viu em 02/09 ("fica muito espaço em branco onde seria a imagem").
 *
 * O conteúdo cresce mais porque tinha mais folga para crescer. Os outros dois ficam onde
 * estavam, que é onde já enchiam.
 *
 * ⚠️ O respiro que SOBRA num slide curto é inevitável e não é defeito: um slide de duas
 * linhas não enche 947px sem virar cartaz. A alternativa seria empurrar o bloco para o meio
 * da peça, e isso o Eduardo descartou na mesma mensagem ("não deixe tão no meio").
 */
const FATOR_SEM_ILUSTRACAO: Record<TipoDeSlide, number> = {
  gancho: 1.35,
  conteudo: 1.6,
  cta: 1.35,
};

/**
 * Os degraus de cada tipo, do maior ao menor. **A escolha e o MAIOR QUE COUBER.**
 *
 * ⚠️ **ATE 22/09 A ESCOLHA ERA UMA CASCATA POR NUMERO DE CARACTERES**, e esta lista existia
 * so para a DESCIDA da fase 38.2. A cascata errava nos dois sentidos pelo mesmo motivo: ela
 * conta CARACTERE onde o limite e LINHA.
 *
 * Para baixo, o erro cortava (38.2). Para cima, ele deixava buraco: o post que o Eduardo
 * publicou em 22/09 tem 91 caracteres, caia no degrau de 46 e ocupava 3 linhas — sobrando
 * **213px entre o texto e a imagem**, medidos varrendo a peca linha a linha. Em 60 o mesmo
 * texto ocupa 4 linhas e enche o espaco. "O texto ficou muito pra baixo, temos que rever
 * como fazer ele se adaptar ao texto."
 *
 * Com a escolha por cabimento, subir e descer viram O MESMO MECANISMO — e nao duas regras
 * que precisam concordar.
 *
 * ⚠️ **CADA TIPO TEM A SUA LISTA, E ISSO E O QUE PROTEGE A HIERARQUIA.** Uma lista unica
 * deixaria um slide de conteudo curto subir ate 86px, que e o corpo do GANCHO — e o gancho
 * tem um trabalho que o conteudo nao tem (parar o dedo em menos de um segundo). O teto de
 * cada tipo continua sendo uma decisao de desenho; o que mudou e como se escolhe dentro dele.
 *
 * Os VALORES nao se mexeram, e o porque de cada um esta logo abaixo, no lugar onde foi
 * medido.
 */
const DEGRAUS_POR_TIPO: Record<TipoDeSlide, readonly number[]> = {
  // 86 para o gancho curto, 72 ate 80 caracteres.
  //
  // ⚠️ O MENOR ERA 60 E CORTAVA (22.13): um gancho de 120 caracteres em caixa alta ocupava 5
  // linhas de 60px. O PNG saia cortado sem erro nenhum.
  //
  // ⚠️ O 46 ENTROU NA ETAPA 4 (decisao do Eduardo, 02/10): com os 334px que sobram de fato com o
  // espaco da imagem, as 5 linhas de 56 do gancho longo nao cabem, e sem o 46 ele cairia direto
  // no piso de 34.
  gancho: [86, 72, 56, 46],

  // O slide do meio parte de 46 — e nunca foi maior: manchete e corpo tem o MESMO corpo
  // tipografico nas pecas publicadas, e a hierarquia da casa e por PESO.
  conteudo: [46, 40, 34],

  // ⚠️ 46 E NAO 48, e 40 E NAO 42: os dois cortavam no Labs com a conta de antes (22.13).
  //
  // ⚠️ OS DOIS MENORES SO O POST DE UMA IMAGEM ALCANCA. A chamada de um carrossel para em 200
  // caracteres (schema); o post unico chega a ~550 contando o pedido opcional.
  cta: [60, 46, 40, 34],
};
/**
 * O menor corpo que o projeto aceita, e ele NÃO é negociável por cabimento.
 *
 * Decidido em 03/09 contra a saída fácil: um post de 550 caracteres cortava, baixar para 32
 * resolveria a conta, e em vez disso o teto de `PostUnicoSchema.texto` caiu de 350 para 300.
 * "Cabe" resolvido encolhendo até ninguém ler não é cabimento, é o defeito com outro nome.
 */
const PISO_DE_LEGIBILIDADE = 34;

/** A fonte do slide, e se o texto cabe nela. Se nem no piso couber, a fonte é o piso. */
export type TamanhoDoSlide = { fonte: number; cabe: boolean };

/**
 * Tamanho da fonte do slide, em pixels, para a peça 1080×1350, com ou sem o espaço da imagem.
 *
 * POR QUE NÃO É FIXO: o gancho tem até 120 caracteres e o texto de um slide até ~280. Com um tamanho
 * só, ou o gancho fica pequeno demais para parar o dedo, ou o texto longo transborda a arte. Os
 * degraus são largos de propósito: variação de 1 em 1 deixaria a sequência trêmula ao passar.
 */
export function tamanhoDoSlide(s: SlideParaArte, comIlustracao: boolean): TamanhoDoSlide {
  // ⚠️ **O MAIOR DEGRAU DO TIPO QUE COUBER, e nada mais decide isto.**
  //
  // Duas reguas viviam aqui e discordavam. Uma escada por NUMERO DE CARACTERES escolhia o
  // corpo; depois a altura estimada corrigia para baixo quando nao cabia (38.2). O que enche
  // a peca e LINHA, e caractere so e um palpite sobre linha — uma quebra termina a linha
  // antes de ela encher, e uma frase curta ocupa menos do que o contador sugere.
  //
  // O erro tinha os dois sentidos, e cada um apareceu numa peca publicada:
  //
  //   PARA BAIXO — 197 caracteres com 4 quebras caiam no degrau de 46 e precisavam de 546px
  //   contra 382 disponiveis. A imagem comia a ultima linha (21/09).
  //
  //   PARA CIMA — 91 caracteres caiam no degrau de 46, ocupavam 3 linhas e deixavam **213px
  //   de buraco** entre o texto e a imagem, medidos varrendo a peca linha a linha. Em 60 o
  //   mesmo texto ocupa 4 linhas e enche o espaco (22/09).
  //
  // Medir a altura e perguntar "cabe?" responde os dois de uma vez. A escada por caractere
  // saiu; os DEGRAUS dela ficaram, em `DEGRAUS_POR_TIPO`, porque os valores foram medidos e
  // continuam sendo decisao de desenho.
  //
  // ⚠️ **CONTINUA EM DEGRAUS, NUNCA DE 1 EM 1.** Variacao suave deixaria cada slide com um
  // tamanho ligeiramente diferente e a sequencia pareceria tremula ao passar o dedo. E a
  // lista e a DO TIPO: um conteudo curto nao sobe ate 86px, que e o corpo do gancho.
  //
  // ⚠️ **E PARA NO PISO DE 34, sem furar.** Se nem no piso couber, devolve o piso com `cabe: false`,
  // e quem avisa e `slidesQueNaoCabem`. Resolver "cabe" encolhendo ate ninguem ler e o que a decisao
  // de 03/09 recusou — ela preferiu baixar o teto do schema de 350 para 300.
  //
  // ⚠️ MEDE A COMPOSICAO, a mesma que o desenho desenha (arte-composicao.ts), com a conta exata
  // (arte-medida.ts). Cabe quando a altura nao passa do disponivel e nenhuma palavra vaza pela
  // direita: a palavra mais larga que a linha, num degrau, faz o degrau nao caber.
  const limite = alturaDisponivel(comIlustracao);
  const linhas = composicaoDoSlide(s.titulo, s.texto);
  const cabeEm = (fonte: number) => {
    const m = medidaDaComposicao(linhas, fonte);
    return !m.vaza && m.altura <= limite;
  };

  const degraus = degrausDoSlide(s.tipo, comIlustracao);
  const coube = degraus.find(cabeEm);
  return coube !== undefined ? { fonte: coube, cabe: true } : { fonte: degraus[degraus.length - 1], cabe: false };
}

/**
 * Os tamanhos que a escolha tenta, do maior ao menor, já na escala do modo, com o piso no fim (o
 * gancho não tem o 34 na lista, e chega a ele quando nem o 46 cabe). Os vetores com o Labs desenham
 * esta mesma escada (tests/arte-desenhada.tsx).
 */
export function degrausDoSlide(tipo: TipoDeSlide, comIlustracao: boolean): number[] {
  const escala = (d: number) => (comIlustracao ? d : Math.round(d * FATOR_SEM_ILUSTRACAO[tipo]));
  const degraus = DEGRAUS_POR_TIPO[tipo].map(escala);
  const piso = escala(PISO_DE_LEGIBILIDADE);
  return degraus.includes(piso) ? degraus : [...degraus, piso];
}

/** Um slide que não cabe na arte, com o diagnóstico do porquê. */
export type SlideQueNaoCabe = {
  numero: number;
  tipo: TipoDeSlide;
  /** Corta mesmo SEM ilustração — o caso grave, não há o que remover para resolver. */
  cortaSempre: boolean;
};

/**
 * Quais slides não cabem na arte — a conferência que a tela mostra.
 *
 * ⚠️ **EXISTE PORQUE O TETO DE CARACTERES NÃO É SUFICIENTE.** O schema limita o slide de
 * conteúdo a 200 caracteres, e a asserção de cabimento prova que 200 caracteres cabem — mas
 * ela prova isso para 200 caracteres numa linha só. **Quebra de linha é forçada**, e um slide
 * dentro do teto com muitas linhas curtas transborda: medido em 04/09, 8 marcadores dão 422px
 * contra os 382 disponíveis quando há ilustração.
 *
 * ⚠️ **E BAIXAR A FONTE NÃO RESOLVE**, o que elimina a saída óbvia: fonte menor não junta duas
 * linhas em uma. No piso de legibilidade de 34px, com o espaço da imagem, cabem 7 linhas sem
 * manchete, e 5 de corpo com ela (77 + 5 × 45 = 302 de 334). Por isso a saída é limitar a quantidade
 * de linhas (na instrução) e AVISAR quem está na tela (aqui).
 *
 * ⚠️ **AVISA, NUNCA IMPEDE** — mesmo critério do painel de acentuação. Aviso que trava publicação é
 * aviso que alguém desliga, e aí para de pegar o caso real.
 */
export function slidesQueNaoCabem(slides: SlideParaArte[]): SlideQueNaoCabe[] {
  const fora: SlideQueNaoCabe[] = [];

  slides.forEach((s, i) => {
    const comIlustracao = !tamanhoDoSlide(s, true).cabe;
    const semIlustracao = !tamanhoDoSlide(s, false).cabe;
    if (comIlustracao || semIlustracao) fora.push({ numero: i + 1, tipo: s.tipo, cortaSempre: semIlustracao });
  });

  return fora;
}
