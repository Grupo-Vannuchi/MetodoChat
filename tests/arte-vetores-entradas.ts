// AS ENTRADAS DOS VETORES combinados com o Labs (tests/vetores-da-arte.json): o que se pede ao
// desenho. A resposta (o degrau, a altura e o cabe) sai do DESENHO, em tests/bonus-arte-desenho.test.ts,
// e nunca daqui. Daqui sai só a pergunta, e algumas perguntas são achadas com a conta (o maior texto
// que ela aceita em cada degrau, a linha que encosta em 860), para o desenho conferir a fronteira.
//
// As categorias que o Labs pediu (02/10): emoji, pontuação com espaço antes, \n\n, linha encostando em
// 860, palavra mais larga que a linha, acento em NFD; os 4 casos da comparação desenhada por ele; e
// um caso conservador em que a conta erra para o lado seguro por uma linha inteira.
//
// ⚠️ Os caracteres especiais são escritos pelo código (String.fromCodePoint), e não à mão: um espaço
// sem quebra ou uma quebra de parágrafo colados no arquivo não se veem na revisão.
import { composicaoDoSlide, type LinhaDaArte } from "@/lib/bonus/arte-composicao";
import { LARGURA_UTIL } from "@/lib/bonus/arte-geometria";
import { larguraDoTexto, medidaDaComposicao, pedacosDaLinha, quebraDaLinha } from "@/lib/bonus/arte-medida";
import { tamanhoDoSlide, type SlideParaArte, type TipoDeSlide } from "@/lib/bonus/arte-slides";
import { slideDoVetor, type EntradaDoVetor } from "./arte-desenhada";

const c = (...codigos: number[]) => String.fromCodePoint(...codigos);
const NBSP = c(0xa0);
const SEPARADOR_DE_LINHA = c(0x2028);
const SEPARADOR_DE_PARAGRAFO = c(0x2029);
const ACENTO_AGUDO = c(0x301);
const CIRCUNFLEXO = c(0x302);
const TRAVESSAO = c(0x2014);
const ABRE_ASPAS = c(0x201c);
const FECHA_ASPAS = c(0x201d);
const CHORO = c(0x1f622);
const APONTA = c(0x1f447);
const FOGO = c(0x1f525);
const CHECK = c(0x2705);

const FRASE =
  "mande uma mensagem curta para o cliente que sumiu e lembre do que ele comprou na última vez porque quem some ainda pode voltar se a conversa certa chegar".split(
    " "
  );

/** O texto de `n` palavras num dos três estilos da régua: frase, caixa alta e lista de quatro palavras por item. */
function textoNoEstilo(estilo: "frase" | "caixa" | "lista", n: number): string {
  const ps = Array.from({ length: n }, (_, i) => FRASE[i % FRASE.length]);
  if (estilo === "frase") return ps.join(" ");
  if (estilo === "caixa") return ps.join(" ").toUpperCase();
  const itens: string[] = [];
  for (let i = 0; i < ps.length; i += 4) itens.push(`- ${ps.slice(i, i + 4).join(" ")}`);
  return itens.join("\n");
}

const entrada = (
  nome: string,
  categoria: string,
  tipo: TipoDeSlide,
  titulo: string | null,
  texto: string,
  comIlustracao = true,
  assinaturaNoPe = false
): EntradaDoVetor => ({ nome, categoria, texto, tipo, titulo, comIlustracao, assinaturaNoPe });

/** Os 4 casos que o Labs desenhou na comparação de 02/10, todos com o espaço da imagem. */
function casosDoLabs(): EntradaDoVetor[] {
  const capa = "VOCÊ ESTÁ PERDENDO CLIENTES TODOS OS DIAS POR CAUSA DE UM ERRO QUE QUASE NINGUÉM PERCEBE NA HORA DE RESPONDER";
  return [
    entrada(
      "labs-1-geracao-real",
      "labs",
      "conteudo",
      "Os 5 erros que travam suas vendas",
      "Antes de culpar o mercado, confira:\nResponder o cliente horas depois\nMandar preço sem entender a dor\nNão fazer follow-up depois do não\nCopiar a abordagem do concorrente\nFalar mais do produto que do cliente"
    ),
    entrada(
      "labs-2-sete-linhas",
      "labs",
      "conteudo",
      "Checklist antes de publicar",
      "Revise o título\nConfira a ortografia\nTeste o link do bônus\nAjuste a palavra-chave\nEscolha a imagem certa\nLeia em voz alta\nAgende o melhor horário"
    ),
    entrada("labs-3-capa-109", "labs", "gancho", null, capa),
    entrada("labs-4-capa-120", "labs", "gancho", null, `${capa} O WHATSAPP`),
  ];
}

/**
 * A RÉGUA: o maior texto que a conta aceita em cada degrau, por tipo, modo e estilo. A manchete de 1
 * e de 2 linhas, em caixa alta, e o gancho nos quatro degraus.
 */
function limites(): EntradaDoVetor[] {
  const casos: { nome: string; tipo: TipoDeSlide; titulo: string | null; noPe: boolean }[] = [
    { nome: "gancho", tipo: "gancho", titulo: null, noPe: false },
    { nome: "conteudo", tipo: "conteudo", titulo: "O que fazer primeiro", noPe: false },
    { nome: "conteudo-manchete-2", tipo: "conteudo", titulo: "O QUE FAZER PRIMEIRO COM O CLIENTE QUE SUMIU DE VEZ", noPe: false },
    { nome: "chamada", tipo: "cta", titulo: null, noPe: true },
    { nome: "post", tipo: "cta", titulo: null, noPe: false },
  ];
  const vetores: EntradaDoVetor[] = [];
  for (const caso of casos) {
    for (const comIlustracao of [true, false]) {
      for (const estilo of ["frase", "caixa", "lista"] as const) {
        const porDegrau = new Map<number, string>();
        for (let n = 1; n < 400; n++) {
          const texto = textoNoEstilo(estilo, n);
          const t = tamanhoDoSlide(slideDoVetor(entrada("", "", caso.tipo, caso.titulo, texto, comIlustracao, caso.noPe)), comIlustracao);
          if (!t.cabe) break;
          porDegrau.set(t.fonte, texto);
        }
        for (const [degrau, texto] of porDegrau) {
          const modo = comIlustracao ? "com" : "sem";
          vetores.push(entrada(`limite-${caso.nome}-${modo}-${estilo}-${degrau}`, "limite", caso.tipo, caso.titulo, texto, comIlustracao, caso.noPe));
        }
      }
    }
  }
  return vetores;
}

const VOCABULARIO = (
  "a o e de do da em um uma que se para com sem por mais menos hoje agora nunca sempre cliente clientes venda vendas " +
  "mensagem conversa resposta prazo preço produto marca loja ideia plano passo prova dia semana mês lucro margem meta " +
  "rápido certo pronto curto longo novo velho bom forte simples claro útil antes depois volta ainda já só bem"
).split(" ");

/** A largura de uma linha da composição numa fonte, pela conta. */
function largura(l: LinhaDaArte, fonte: number): number {
  return larguraDoTexto(l.texto, fonte, l.negrito, l.espacamento);
}

/**
 * Uma linha que a conta mede bem perto de 860, de um lado (`dentro`: até 860) ou do outro (`fora`:
 * passa de 860 por menos de 0,05px). Busca determinística no vocabulário. O desenho confere se o
 * Satori soma igual: dentro dá uma linha, fora dá duas.
 */
function linhaNaFronteira(fonte: number, negrito: boolean, lado: "dentro" | "fora"): string {
  const como = (texto: string): LinhaDaArte => composicaoDoSlide(negrito ? null : "Manchete", texto).at(-1)!;
  for (let i = 0; i < VOCABULARIO.length; i++) {
    for (let j = 0; j < VOCABULARIO.length; j++) {
      const palavras: string[] = [];
      for (let k = 0; ; k++) {
        const proxima = VOCABULARIO[(i + k * 7 + j * 3) % VOCABULARIO.length];
        const tentativa = [...palavras, proxima].join(" ");
        if (largura(como(tentativa), fonte) > LARGURA_UTIL - 120) break;
        palavras.push(proxima);
      }
      for (const fim of VOCABULARIO) {
        for (const fim2 of VOCABULARIO) {
          const texto = [...palavras, fim, fim2].join(" ");
          const w = largura(como(texto), fonte);
          if (lado === "dentro" && w <= LARGURA_UTIL && w > LARGURA_UTIL - 0.05) return texto;
          if (lado === "fora" && w > LARGURA_UTIL && w < LARGURA_UTIL + 0.05) return texto;
        }
      }
    }
  }
  throw new Error(`não achei linha ${lado} de 860 a ${fonte}px`);
}

/**
 * Um gancho de duas linhas a 86px que só cabe por causa do espaçamento do negrito (−0,4px por letra):
 * sem ele, a segunda linha passa de 860 e a terceira linha não cabe nos 334.
 */
function ganchoQueSoCabePeloNegrito(): string {
  const sem = (t: string) => larguraDoTexto(t, 86, true, 0);
  const com = (t: string) => larguraDoTexto(t, 86, true, -0.4);
  const caixa = VOCABULARIO.map((p) => p.toUpperCase());
  for (const a of caixa) for (const b of caixa) for (const d of caixa) {
    const segunda = `${a} ${b} ${d}`;
    if (com(segunda) <= LARGURA_UTIL && sem(segunda) > LARGURA_UTIL) {
      const texto = `VOCÊ PERDE ${segunda}`;
      const linhas = composicaoDoSlide(null, texto);
      if (medidaDaComposicao(linhas, 86).altura === 228 && com(`VOCÊ PERDE ${a}`) > LARGURA_UTIL) return texto;
    }
  }
  throw new Error("não achei o gancho do negrito");
}

/**
 * O CONSERVADOR POR UMA LINHA INTEIRA (pedido do Labs): um "palavra-chave" no fim da linha, que o
 * Satori parte no hífen e a conta leva inteiro para baixo. A busca simula a quebra do hífen só para
 * achar o caso; quem confirma é o desenho.
 */
function conteudoComHifenNoFim(): string {
  const simulada = (texto: string, fonte: number) => {
    // A mesma quebra gulosa da conta, com um ponto de quebra a mais depois de cada hífen entre letras.
    const linha = composicaoDoSlide("Manchete", texto).at(-1)!;
    const pedacos = pedacosDaLinha(linha.texto).flatMap((p) => p.split(/(?<=\p{L}-)(?=\p{L})/u));
    let linhas = 0;
    let ocupado = 0;
    for (const p of pedacos) {
      const w = larguraDoTexto(p, fonte, false, 0);
      const semFim = larguraDoTexto(p.trimEnd(), fonte, false, 0);
      if (linhas > 0 && ocupado + w > LARGURA_UTIL + (w - semFim)) {
        linhas++;
        ocupado = w;
      } else {
        linhas = Math.max(linhas, 1);
        ocupado += w;
      }
    }
    return linhas;
  };
  for (let n = 3; n < 30; n++) {
    for (let depois = 1; depois < 25; depois++) {
      for (const p of ["palavra-chave", "follow-up", "pós-venda", "bem-vindo", "e-mail"]) {
        const texto = `${FRASE.slice(0, n).join(" ")} ${p} ${FRASE.slice(n, n + depois).join(" ")}`;
        const conta = quebraDaLinha(composicaoDoSlide("Manchete", texto).at(-1)!, 46).linhas;
        if (simulada(texto, 46) < conta) return texto;
      }
    }
  }
  throw new Error("não achei o hífen no fim da linha");
}

/** As categorias pedidas, escritas à mão (e achadas pela conta onde é fronteira). */
function categorias(): EntradaDoVetor[] {
  const dentro46 = linhaNaFronteira(46, false, "dentro");
  const fora46 = linhaNaFronteira(46, false, "fora");
  const dentro86 = linhaNaFronteira(86, true, "dentro");
  const fora86 = linhaNaFronteira(86, true, "fora");
  const nfd = `VOCE${CIRCUNFLEXO} ESTA${ACENTO_AGUDO} PERDENDO CLIENTES TODOS OS DIAS`;
  return [
    entrada("emoji-com-espaco", "emoji", "gancho", null, `Seu cliente sumiu? ${CHORO} Ele ainda pode voltar ${APONTA}`),
    entrada("emoji-varios", "emoji", "conteudo", "Os três sinais", `${CHECK} Responde no mesmo dia\n${CHECK} Lembra do que ele comprou\n${CHECK} Fecha com uma pergunta ${FOGO}`),
    entrada("emoji-colado", "emoji", "gancho", null, `VENDAS${FOGO}${FOGO}${FOGO} QUE VOLTAM${APONTA}`),
    entrada("pontuacao-com-espaco-antes", "pontuacao", "gancho", null, "VOCÊ RESPONDE RÁPIDO ? ENTÃO PROVE ! HOJE , SEM DESCULPA ; SEM DEMORA : E SEM MEDO ."),
    entrada("pontuacao-parenteses", "pontuacao", "conteudo", "Antes de responder", `Leia a mensagem ( toda ) e pense [ de verdade ] no que ele quer . ${ABRE_ASPAS}Já comprei${FECHA_ASPAS} (mas sumiu) não é um não .`),
    entrada("pontuacao-travessoes", "pontuacao", "conteudo", null, `Responda rápido ${TRAVESSAO} ${TRAVESSAO} mesmo que curto ${TRAVESSAO} e lembre do pedido.`),
    entrada("travessao-colado", "pontuacao", "gancho", null, `O CLIENTE SUMIU${TRAVESSAO}E VOLTOU${TRAVESSAO}QUANDO VOCÊ RESPONDEU CERTO`),
    entrada("paragrafos", "paragrafos", "conteudo", "Três passos", "Responda no mesmo dia.\n\nLembre do que ele comprou.\n\n\nFeche com uma pergunta."),
    entrada("paragrafos-crlf", "paragrafos", "conteudo", null, "Linha um do bloco.\r\nLinha dois do bloco.\r\n\r\nO fechamento."),
    entrada("paragrafos-linha-de-espacos", "paragrafos", "conteudo", null, "Primeiro bloco.\n \t \nSegundo bloco, o fechamento."),
    entrada("quebras-obrigatorias", "paragrafos", "cta", null, `Comente SUMIDO${SEPARADOR_DE_LINHA}e receba as mensagens${SEPARADOR_DE_PARAGRAFO}${SEPARADOR_DE_PARAGRAFO}de graça.`, true, true),
    entrada("linha-860-dentro-regular", "860", "conteudo", "Manchete", dentro46),
    entrada("linha-860-fora-regular", "860", "conteudo", "Manchete", fora46),
    entrada("linha-860-dentro-negrito", "860", "gancho", null, dentro86),
    entrada("linha-860-fora-negrito", "860", "gancho", null, fora86),
    entrada("negrito-decide-o-degrau", "negrito", "gancho", null, ganchoQueSoCabePeloNegrito()),
    entrada("palavra-maior-que-a-linha", "palavra-longa", "gancho", null, "INCONSTITUCIONALISSIMAMENTE CERTO"),
    entrada("arroba-maior-que-a-linha", "palavra-longa", "conteudo", "Siga o perfil", "Todo dia uma ideia nova em @metodovannuchioficialdasvendasonline para você"),
    entrada("url-maior-que-a-linha", "palavra-longa", "gancho", null, "Pegue em https://metodolabs.com.br/bonus/planilha-de-precificacao"),
    entrada("acento-nfd", "nfd", "gancho", null, nfd),
    entrada("espaco-sem-quebra", "nbsp", "conteudo", null, `Custa só R$${NBSP}100 por mês, sem taxa e sem fidelidade, e você cancela quando quiser.`),
    entrada("hifen-no-fim-da-linha", "conservador", "conteudo", "Manchete", conteudoComHifenNoFim()),
  ];
}

export function entradasDosVetores(): EntradaDoVetor[] {
  const todas = [...casosDoLabs(), ...categorias(), ...limites()];
  const nomes = new Set(todas.map((e) => e.nome));
  if (nomes.size !== todas.length) throw new Error("dois vetores com o mesmo nome");
  return todas;
}

export type { SlideParaArte };
