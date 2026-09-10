// O MEDIDOR DE CONTRASTE DA SUÍTE — um só, e é o mesmo que a Onda 2 usou.
//
// POR QUE ELE EXISTE: a suíte não testa componente, então o portão de uma
// decisão de cor não pode ser um teste de tela. O que dá para trancar é a
// ARITMÉTICA: dado o tom e o fundo real, qual é o contraste. Foi assim que a
// Onda 2 escolheu `red-700`/`red-400` para a ação destrutiva, e é assim que a
// Onda 3 escolhe o tom do texto quieto.
//
// ESTE ARQUIVO NÃO É UM TESTE (não termina em `.test.ts`), então o `include` da
// suíte (`tests/**/*.test.ts`) não o recolhe. Ele é a biblioteca dos que são.
//
// A PALETA VEM DO TAILWIND, E NÃO DE UMA CÓPIA. A versão anterior deste medidor
// (dentro de `acoes-de-linha.test.ts`) trazia os oito tons de que precisava
// copiados à mão de `tailwindcss/theme.css`. Copiar funciona até o dia em que a
// paleta muda e a cópia não — e aí o teste continua verde medindo uma cor que a
// tela não usa mais. Ler o arquivo do pacote não tem esse modo de falhar.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

//
// E A PALETA NOMEADA VEM DE `app/globals.css` PELO MESMO MOTIVO. Ela é a que
// esta rodada introduziu (`papel`, `tinta`, `traco`, `quieto`, `aberto`,
// `fecha`, `parou`, e o par `-escuro` de cada uma), e os números que o
// comentário de cada cor declara lá são recalculados aqui. Se alguém trocar um
// hex e não o número ao lado, `tests/paleta.test.ts` reprova — que é a única
// forma de um comentário de cor não virar mentira com o tempo.
const CAMINHO_DA_PALETA = fileURLToPath(
  new URL("../node_modules/tailwindcss/theme.css", import.meta.url)
);

const CAMINHO_DAS_CORES_NOMEADAS = fileURLToPath(
  new URL("../app/globals.css", import.meta.url)
);

export type Rgb = [number, number, number];

/** oklch -> sRGB, a mesma conversão do CSS Color 4. O Tailwind 4 declara a
 *  paleta em oklch, então é daí que os números precisam sair. */
export function oklchParaRgb(L: number, C: number, hGraus: number): Rgb {
  const h = (hGraus * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  const lineares = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  const codificar = (u: number) => {
    const v = u <= 0.0031308 ? 12.92 * u : 1.055 * Math.pow(Math.max(u, 0), 1 / 2.4) - 0.055;
    return Math.min(255, Math.max(0, Math.round(v * 255)));
  };
  return [codificar(lineares[0]), codificar(lineares[1]), codificar(lineares[2])];
}

function lerPaleta(): Map<string, Rgb> {
  const css = readFileSync(CAMINHO_DA_PALETA, "utf8");
  const paleta = new Map<string, Rgb>();
  // `oklch(70.5% 0.015 286.067)`, e também `oklch(98.5% 0 none)` — o `none` do
  // zinc-50, que é croma e matiz ausentes e vale zero na conversão.
  const padrao = /--color-([a-z]+-\d+):\s*oklch\(([\d.]+)%\s+([\d.]+|none)\s+([\d.]+|none)\)/g;
  for (const m of css.matchAll(padrao)) {
    const numero = (v: string) => (v === "none" ? 0 : Number(v));
    paleta.set(m[1], oklchParaRgb(Number(m[2]) / 100, numero(m[3]), numero(m[4])));
  }
  if (paleta.size === 0) {
    throw new Error(`Paleta vazia: ${CAMINHO_DA_PALETA} não trouxe nenhum --color-*`);
  }
  return paleta;
}

/** `#fbfaf8` -> [251, 250, 248]. */
export function hexParaRgb(hex: string): Rgb {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** As cores nomeadas do `@theme` de `app/globals.css`, lidas do arquivo. Os
 *  nomes têm letra e hífen e nenhum dígito (`papel`, `quieto-escuro`), o que
 *  já as separa da rampa do Tailwind (`zinc-500`) sem nenhuma convenção extra. */
function lerCoresNomeadas(): Map<string, Rgb> {
  const css = readFileSync(CAMINHO_DAS_CORES_NOMEADAS, "utf8");
  const nomeadas = new Map<string, Rgb>();
  for (const m of css.matchAll(/--color-([a-z][a-z-]*):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    nomeadas.set(m[1], hexParaRgb(m[2]));
  }
  if (nomeadas.size === 0) {
    throw new Error(`Paleta nomeada vazia: ${CAMINHO_DAS_CORES_NOMEADAS}`);
  }
  return nomeadas;
}

const PALETA = lerPaleta();
const NOMEADAS = lerCoresNomeadas();

export const BRANCO: Rgb = [255, 255, 255];
export const PRETO: Rgb = [0, 0, 0];

/** Os nomes das cores do `@theme`, na ordem em que o arquivo as declara. */
export const CORES_NOMEADAS = [...NOMEADAS.keys()];

/** O tom pelo nome, em sRGB: tanto a rampa do Tailwind (`"zinc-500"`) quanto
 *  as cores nomeadas do produto (`"quieto"`, `"quieto-escuro"`). */
export function tom(nome: string): Rgb {
  if (nome === "white") return BRANCO;
  if (nome === "black") return PRETO;
  const v = NOMEADAS.get(nome) ?? PALETA.get(nome);
  if (!v) throw new Error(`tom desconhecido: ${nome}`);
  return v;
}

/** `bg-zinc-900/70` é translúcido: a cor que chega ao olho é a mistura com o
 *  que está atrás, e é ela que entra na conta. */
export function misturar(frente: Rgb, fundo: Rgb, alfa: number): Rgb {
  return [
    Math.round(frente[0] * alfa + fundo[0] * (1 - alfa)),
    Math.round(frente[1] * alfa + fundo[1] * (1 - alfa)),
    Math.round(frente[2] * alfa + fundo[2] * (1 - alfa)),
  ];
}

export function luminancia([r, g, b]: Rgb): number {
  const canal = (v: number) => {
    const u = v / 255;
    return u <= 0.03928 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

export function contraste(a: Rgb, b: Rgb): number {
  const [alto, baixo] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (alto + 0.05) / (baixo + 0.05);
}

/** O mínimo da WCAG AA para texto normal. Texto grande tem outro (3:1), e
 *  nenhum token medido aqui é grande. */
export const MINIMO = 4.5;

// OS FUNDOS REAIS DO PRODUTO, e não um branco/preto de conveniência. Cada um
// foi lido do CSS que o desenha; os translúcidos já vêm compostos com o que
// está atrás, porque é isso que o olho recebe.
//
// O QUE MUDOU NA PARTE 1 DA LINGUAGEM VISUAL, e é só isto: o `body` deixou de
// ser `bg-zinc-100`/`dark:bg-black` e passou a ser `bg-papel`/`bg-papel-escuro`
// (app/layout.tsx). As outras treze superfícies continuam onde estavam — a
// rampa de superfície não é desta entrega, e trocar quinze fundos sem poder
// renderizar nenhum deles seria mudança sem prova.
//
// AS DUAS QUE DEPENDEM DO CORPO MUDAM JUNTO, porque são translúcidas sobre ele:
// a barra lateral clara (`bg-zinc-50/50`) e o cartão escuro (`bg-zinc-900/70`).
const CARTAO_ESCURO = misturar(tom("zinc-900"), tom("papel-escuro"), 0.7);

export const FUNDOS: Record<string, Rgb> = {
  // claro — `body` é `bg-papel` (app/layout.tsx)
  "claro: corpo (bg-papel)": tom("papel"),
  "claro: cartao (bg-white)": BRANCO,
  "claro: barra lateral (bg-zinc-50/50)": misturar(tom("zinc-50"), tom("papel"), 0.5),
  "claro: cabecalho de tabela (bg-zinc-50/80)": misturar(tom("zinc-50"), BRANCO, 0.8),
  "claro: superficie interna (bg-zinc-50/60)": misturar(tom("zinc-50"), BRANCO, 0.6),
  "claro: grupo de filtros (bg-zinc-100/70)": misturar(tom("zinc-100"), BRANCO, 0.7),
  // O MAIS ESCURO DOS FUNDOS CLAROS, e por isso o que manda na escolha do tema
  // claro (app/conversas/[id], balão recebido).
  "claro: balao recebido (bg-zinc-100)": tom("zinc-100"),
  // escuro — `body` é `dark:bg-papel-escuro`
  "escuro: corpo (bg-papel-escuro)": tom("papel-escuro"),
  "escuro: cartao (bg-zinc-900/70)": CARTAO_ESCURO,
  "escuro: barra lateral (bg-zinc-950)": tom("zinc-950"),
  "escuro: cabecalho de tabela (bg-zinc-950/50)": misturar(tom("zinc-950"), CARTAO_ESCURO, 0.5),
  "escuro: superficie interna (bg-zinc-950/40)": misturar(tom("zinc-950"), CARTAO_ESCURO, 0.4),
  "escuro: painel de posts (bg-zinc-950/60)": misturar(tom("zinc-950"), CARTAO_ESCURO, 0.6),
  // O MAIS CLARO DOS FUNDOS ESCUROS, e por isso o que manda na escolha: é ele
  // que decide o piso do tema escuro (app/conversas/[id], balão recebido).
  "escuro: balao recebido (bg-zinc-800)": tom("zinc-800"),
};

export const FUNDOS_CLAROS = Object.entries(FUNDOS).filter(([n]) => n.startsWith("claro"));
export const FUNDOS_ESCUROS = Object.entries(FUNDOS).filter(([n]) => n.startsWith("escuro"));

// OS FUNDOS DE ANTES, CONGELADOS — e eles não são decoração histórica.
//
// Os três números do achado D3 e as três alternativas que a Onda 3 recusou por
// medição foram medidos contra `bg-zinc-100` (o corpo de então) e `bg-black`. O
// corpo mudou nesta entrega, e `zinc-500` sobre `bg-papel` dá 4,63:1 — ou seja,
// PASSA. Deixar aquelas asserções apontando para `FUNDOS` faria uma de duas
// coisas, e as duas são ruins: ou elas quebrariam e alguém as apagaria, levando
// junto o motivo da decisão, ou alguém as afrouxaria e o portão viraria enfeite.
//
// A saída é a honesta: `FUNDOS` é o produto de HOJE, e este mapa é o de ONTEM.
// As asserções sobre o defeito antigo continuam medindo o fundo em que o defeito
// existiu, e continuam verdadeiras para sempre.
const CARTAO_ESCURO_DA_ONDA3 = misturar(tom("zinc-900"), PRETO, 0.7);

export const FUNDOS_DA_ONDA3: Record<string, Rgb> = {
  "claro: corpo (bg-zinc-100)": tom("zinc-100"),
  "claro: cartao (bg-white)": BRANCO,
  "claro: barra lateral (bg-zinc-50/50)": misturar(tom("zinc-50"), tom("zinc-100"), 0.5),
  "claro: cabecalho de tabela (bg-zinc-50/80)": misturar(tom("zinc-50"), BRANCO, 0.8),
  "claro: superficie interna (bg-zinc-50/60)": misturar(tom("zinc-50"), BRANCO, 0.6),
  "claro: grupo de filtros (bg-zinc-100/70)": misturar(tom("zinc-100"), BRANCO, 0.7),
  "claro: balao recebido (bg-zinc-100)": tom("zinc-100"),
  "escuro: corpo (bg-black)": PRETO,
  "escuro: cartao (bg-zinc-900/70)": CARTAO_ESCURO_DA_ONDA3,
  "escuro: barra lateral (bg-zinc-950)": tom("zinc-950"),
  "escuro: cabecalho de tabela (bg-zinc-950/50)": misturar(
    tom("zinc-950"),
    CARTAO_ESCURO_DA_ONDA3,
    0.5
  ),
  "escuro: superficie interna (bg-zinc-950/40)": misturar(
    tom("zinc-950"),
    CARTAO_ESCURO_DA_ONDA3,
    0.4
  ),
  "escuro: painel de posts (bg-zinc-950/60)": misturar(
    tom("zinc-950"),
    CARTAO_ESCURO_DA_ONDA3,
    0.6
  ),
  "escuro: balao recebido (bg-zinc-800)": tom("zinc-800"),
};

export const FUNDOS_CLAROS_DA_ONDA3 = Object.entries(FUNDOS_DA_ONDA3).filter(([n]) =>
  n.startsWith("claro")
);
export const FUNDOS_ESCUROS_DA_ONDA3 = Object.entries(FUNDOS_DA_ONDA3).filter(([n]) =>
  n.startsWith("escuro")
);

/** O menor contraste de um tom entre uma lista de fundos — o "pior caso", que
 *  é o número que decide se uma cor entra ou não. */
export function piorCaso(nomeDoTom: string, fundos: [string, Rgb][]): number {
  return Math.min(...fundos.map(([, f]) => contraste(tom(nomeDoTom), f)));
}
