// OS VETORES DA ARTE, combinados com o Método Labs (spec da Etapa 4, "Dois donos"; a 48.5 do Labs): o
// formato do arquivo tests/vetores-da-arte.json, e a leitura e a escrita dele. O MESMO arquivo, byte a
// byte, mora nos dois repositórios, e cada lado confere o sha256 dele, o desenho no próprio Satori
// (tests/bonus-arte-desenho.test.ts) e a própria conta (tests/bonus-arte-vetores.test.ts).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { TipoDeSlide } from "@/lib/bonus/arte-slides";

export const ARQUIVO_DOS_VETORES = fileURLToPath(new URL("vetores-da-arte.json", import.meta.url));

/** Um vetor: o slide pedido, e o que o desenho responde. */
export type Vetor = {
  nome: string;
  categoria: string;
  texto: string;
  tipo: TipoDeSlide;
  titulo: string | null;
  comIlustracao: boolean;
  assinaturaNoPe: boolean;
  /** O texto só tem ponto de quebra no espaço, segundo o quebrador do Satori: a conta tem de dar o mesmo. */
  exato: boolean;
  /** O maior degrau do tipo em que o desenho cabe, ou o piso. */
  degrau: number;
  /** A altura da coluna do texto nesse degrau, medida no PNG. */
  alturaDesenhada: number;
  cabe: boolean;
};

export type ArquivoDosVetores = {
  sobre: string[];
  /**
   * COM O QUE OS VETORES FORAM DESENHADOS, NO MOMENTO DA GERAÇÃO (commit `9f4fbf3`, Etapa 4). O
   * `desenho` é o sha256 de `lib/bonus/arte-desenho.tsx` naquele commit (`06f967d8…`), e não o de hoje.
   * Na Etapa 5 (adendo da foto no espaço, `1d63f6d`), o arquivo passou a `f46b898b…`: ele ganhou a foto
   * dentro do espaço da imagem, só quando o slide tem foto. Sem foto, o PNG sai igual byte a byte ao de
   * antes (6 PNGs medidos no ensaio, antes e depois), e é só o slide sem foto que os vetores medem.
   * Por isso o arquivo dos vetores, e o sha256 dele combinado com o Labs, não mudaram. Os testes conferem
   * as `fontes`, que são as de hoje; o `desenho` é o registro da geração.
   */
  origem: { satori: string; og: string; fontes: Record<string, string>; desenho: Record<string, string> };
  normalizacao: string[];
  conta: string[];
  medida: string[];
  vetores: Vetor[];
};

/** O conteúdo em LF, que é o que o sha256 confere: o git pode entregar a cópia em CRLF. */
export function conteudoDosVetores(): string {
  return readFileSync(ARQUIVO_DOS_VETORES, "utf8").replace(/\r\n/g, "\n");
}

export function lerVetores(): ArquivoDosVetores {
  return JSON.parse(conteudoDosVetores()) as ArquivoDosVetores;
}

/**
 * O JSON SÓ EM ASCII: todo caractere acima de U+007E sai como escape de barra-u. O espaço sem quebra, a
 * quebra de parágrafo e o acento combinante dos vetores não se veem, e uma ferramenta que regrave o
 * arquivo pode trocá-los sem a tela mostrar; em ASCII, os bytes não dependem de quem gravou.
 */
function emAscii(json: string): string {
  const barra = String.fromCharCode(92);
  let saida = "";
  for (let i = 0; i < json.length; i++) {
    const u = json.charCodeAt(i);
    saida += u > 0x7e ? `${barra}u${u.toString(16).padStart(4, "0")}` : json[i];
  }
  return saida;
}

/** O texto do arquivo: o cabeçalho indentado, e um vetor por linha, para a diferença de um vetor ser uma linha. */
export function textoDosVetores(a: ArquivoDosVetores): string {
  const { vetores, ...cabecalho } = a;
  const topo = JSON.stringify(cabecalho, null, 2).replace(/\n}$/, "");
  return emAscii(`${topo},\n  "vetores": [\n${vetores.map((v) => `    ${JSON.stringify(v)}`).join(",\n")}\n  ]\n}\n`);
}

export const SOBRE = [
  "Vetores da arte do carrossel, combinados entre o Método Chat (Etapa 4 do gerador) e o Método Labs (Etapa 48). O mesmo arquivo, byte a byte, nos dois repositórios; cada um confere o sha256 dele.",
  "Cada vetor é um slide pedido (texto, tipo, titulo, comIlustracao, assinaturaNoPe) e o que o DESENHO responde: o maior degrau do tipo em que ele cabe (ou o piso), a altura da coluna do texto nesse degrau e se cabe. O valor esperado sai do desenho no Satori, e não de uma conta.",
  "exato: o texto normalizado só tem ponto de quebra no espaço, decidido pelo quebrador do Satori numa caixa de 1px (cada pedaço da conta dá uma linha, e cada linha dá tantas linhas quanto pedaços). Exato: a conta tem de dar o mesmo degrau, o mesmo cabe e a mesma altura. Conservador: o degrau da conta é menor ou igual, a conta nunca diz que cabe quando o desenho não cabe, e a altura dela no degrau do desenho é maior ou igual.",
  "Gerado pelo Método Chat: GERAR_VETORES_DA_ARTE=1 npx vitest run tests/bonus-arte-desenho.test.ts.",
];

export const NORMALIZACAO = [
  "Feita uma vez, na composição do slide; o desenho e a conta recebem o texto pronto.",
  "(a) NFC no texto inteiro.",
  "(b) \\r\\n, \\r, \\v, \\f, U+0085, U+2028 e U+2029 viram \\n.",
  "(c) Em cada linha, sequência de espaço e tab vira um espaço, e String.prototype.trim nas pontas.",
  "(d) Parágrafo: linhas não vazias seguidas, separadas por uma ou mais linhas vazias, contadas depois do (c).",
  "(e) Manchete: as quebras do (b) viram espaço, o (c), e manchete vazia é manchete nenhuma.",
  "Negrito: a manchete; e o último parágrafo, quando há mais de um, ou quando não há manchete. Espaçamento do negrito: -0,4px por glifo.",
  "Espaço acima: o primeiro corpo depois da manchete, max(0, 77 - round(fonte * 1,32)); o primeiro de cada parágrafo seguinte, 41.",
];

export const CONTA = [
  "Larguras em unidades da fonte (inteiros), 2048 por em, dos .ttf da Carlito (google/fonts 3dd7884402).",
  "Largura do grafema (Intl.Segmenter): para cada glifo, x += avanco * ((1 / 2048) * fonte); e, se o espaçamento não é zero, x += (espacamento / fonte) * fonte. Nesta ordem de operações, que é a do opentype.js do Satori.",
  "Grafema com algum caractere fora da fonte: vale a fonte (1em), sem espaçamento. Largura do texto: soma dos grafemas, da esquerda para a direita.",
  "Pedaços: quebra em cada U+0020, menos quando o caractere depois é um de ! ) , . / : ; ? ] }, quando o de antes é um de ( [ { ¡ ¿ „ ‚, quando o de antes é aspa (\" ' « » “ ” ‘ ’ ‹ ›) e o depois é um de ( [ { ¡ ¿ „ ‚, ou quando os dois são —. O espaço vai com o pedaço de antes.",
  "Quebra gulosa: o primeiro pedaço abre a linha; os outros descem quando linha + pedaço > 860 + (espaços do fim do pedaço). Igual cabe.",
  "Pedaço mais largo que 860 sem os espaços do fim: vaza, e o degrau não cabe.",
  "Altura: a soma de (espaço acima + linhas * round(fonte * 1,32)) de cada linha da composição. Cabe: não vaza e altura <= 334 com o espaço da imagem, <= 955 sem.",
  "Degraus, do maior ao menor, com o piso no fim: gancho 86 72 56 46 (piso 34); conteúdo 46 40 34; chamada e post 60 46 40 34. Sem o espaço da imagem, round(degrau * fator): gancho 1,35, conteúdo 1,6, chamada 1,35.",
];

export const MEDIDA = [
  "O slide é desenhado em 1080x1350 com a coluna do texto e o espaço da imagem pintados de preto (#000000); escuro é luminância < 250.",
  "Altura desenhada: a coluna, achada na coluna de pixels x = 965, do primeiro ao último escuro seguido, menos o respiro de 48 que ela carrega. A coluna que passa da peça é medida numa tela de 4000px.",
  "Vaza, com TOLERÂNCIA DECLARADA DE 10PX: a área útil termina em x = 970, e o desenho só conta como vazado com tinta em x >= 980, dentro da coluna. A tinta de uma letra pode passar um pouco do avanço dela sem que a linha tenha passado de 860. Por isso, no desenho, cabe não quer dizer dentro de 970 na horizontal. Na conta não há tolerância: vaza é avanço sem os espaços do fim > 860.",
  "Cabe: não vaza (com a tolerância acima) e a última linha com algum escuro na peça fica acima de 1240 (a margem de baixo).",
  "Emoji: o SVG do emoji vem de um fetch trocado no teste (a largura é 1em, seja qual for o desenho). Caractere sem glifo que não é emoji fica fora dos vetores: em produção, o desenho dele depende da rede.",
];
