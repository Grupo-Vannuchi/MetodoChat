import { describe, it, expect } from "vitest";
import { btnLinha, btnLinhaDanger, btnDanger } from "../app/ui";

// O QUE ESTE ARQUIVO FIXA: a ação que APAGA nunca volta a ser a mais apagada
// da linha.
//
// O defeito media assim, em `/automacoes`: "Excluir" era `zinc-500` nos dois
// temas; "Pausar", "Editar" e "Duplicar" eram `zinc-600` (claro) e `zinc-400`
// (escuro). A ação irreversível era a MENOS legível das quatro, e no escuro
// ficava em 3,91:1 — abaixo do mínimo de 4,5:1. A barreira contra o clique
// acidental (o `confirm`) já existia e continua existindo; o que faltava era o
// AVISO, antes do hover.
//
// A SUÍTE NÃO TESTA COMPONENTE, então o que este arquivo tranca são os TOKENS
// e a MEDIÇÃO deles — que é o portão real desta rodada. A conta de cor está
// aqui embaixo, e ela não é chute: reproduz byte a byte os valores que o
// navegador devolveu na auditoria (`zinc-400` = rgb(159,159,169), `zinc-500` =
// rgb(113,113,123)), o que é a prova de que este medidor mede o mesmo que o
// Chrome mediu.

/* ---------- o medidor ---------- */

// oklch -> sRGB, a mesma conversão do CSS Color 4. O Tailwind 4 declara a
// paleta em oklch (`node_modules/tailwindcss/theme.css`), então é daí que os
// números precisam sair.
function oklchParaRgb(L: number, C: number, hGraus: number): [number, number, number] {
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

// Os tons que esta linha usa, copiados de `tailwindcss/theme.css`.
const PALETA: Record<string, [number, number, number]> = {
  "zinc-400": [70.5, 0.015, 286.067],
  "zinc-500": [55.2, 0.016, 285.938],
  "zinc-600": [44.2, 0.017, 285.786],
  "zinc-900": [21, 0.006, 285.885],
  "red-50": [97.1, 0.013, 17.38],
  "red-400": [70.4, 0.191, 22.216],
  "red-700": [50.5, 0.213, 27.518],
  "red-950": [25.8, 0.092, 26.042],
};

const tom = (nome: string): [number, number, number] => {
  const t = PALETA[nome];
  return oklchParaRgb(t[0] / 100, t[1], t[2]);
};

// `bg-zinc-900/70` e `bg-red-950/40` são translúcidos: a cor que chega ao olho
// é a mistura com o que está atrás, e é ela que entra na conta.
const misturar = (
  frente: [number, number, number],
  fundo: [number, number, number],
  alfa: number
): [number, number, number] => [
  Math.round(frente[0] * alfa + fundo[0] * (1 - alfa)),
  Math.round(frente[1] * alfa + fundo[1] * (1 - alfa)),
  Math.round(frente[2] * alfa + fundo[2] * (1 - alfa)),
];

function luminancia([r, g, b]: [number, number, number]): number {
  const canal = (v: number) => {
    const u = v / 255;
    return u <= 0.03928 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

function contraste(a: [number, number, number], b: [number, number, number]): number {
  const [alto, baixo] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (alto + 0.05) / (baixo + 0.05);
}

const BRANCO: [number, number, number] = [255, 255, 255];
const PRETO: [number, number, number] = [0, 0, 0];

// OS FUNDOS REAIS DA LINHA, e não um branco/preto de conveniência:
// claro  — `body` é `bg-zinc-100`, o cartão da linha é `bg-white`.
// escuro — `body` é `dark:bg-black`, o cartão é `dark:bg-zinc-900/70`.
const FUNDO_CLARO = BRANCO;
const FUNDO_ESCURO = misturar(tom("zinc-900"), PRETO, 0.7);

const MINIMO = 4.5;

/* ---------- o que o medidor precisa provar antes de medir ---------- */

describe("o medidor de contraste bate com o navegador", () => {
  it("reproduz os dois valores que a auditoria mediu no Chrome", () => {
    expect(tom("zinc-400")).toEqual([159, 159, 169]);
    expect(tom("zinc-500")).toEqual([113, 113, 123]);
  });
});

/* ---------- a medição ---------- */

describe("a ação destrutiva da linha de automação", () => {
  it("é MAIS legível que as irmãs no claro, em repouso", () => {
    const destrutiva = contraste(tom("red-700"), FUNDO_CLARO);
    const irma = contraste(tom("zinc-600"), FUNDO_CLARO);
    // Números medidos: 6,42:1 contra 7,72:1. A destrutiva fica ABAIXO da irmã
    // em luminância de propósito — passar por cima dela faria o vermelho virar
    // o elemento mais pesado da linha, e a lista de 18 automações gritaria. O
    // que este caso tranca é o piso: ela não pode voltar a ficar perto do
    // 4,83:1 do `zinc-500` que estava lá.
    expect(destrutiva).toBeGreaterThan(MINIMO);
    expect(destrutiva).toBeGreaterThan(contraste(tom("zinc-500"), FUNDO_CLARO) + 1);
    expect(irma).toBeGreaterThan(MINIMO);
  });

  it("passa o mínimo no ESCURO, que é onde ela falhava", () => {
    const destrutiva = contraste(tom("red-400"), FUNDO_ESCURO);
    const antes = contraste(tom("zinc-500"), FUNDO_ESCURO);
    expect(antes).toBeLessThan(MINIMO); // 3,91:1 — o defeito
    expect(destrutiva).toBeGreaterThan(MINIMO); // 6,53:1 — o conserto
  });

  it("continua legível SOBRE o fundo do hover, nos dois temas", () => {
    // É o estado em que a pessoa está prestes a clicar em apagar; ele não pode
    // ser o mais fraco dos dois. Foi por aqui que `red-600` caiu no claro:
    // sobre `bg-red-50` ele dá 4,36:1, abaixo do mínimo.
    expect(contraste(tom("red-700"), tom("red-50"))).toBeGreaterThan(MINIMO);
    const hoverEscuro = misturar(tom("red-950"), FUNDO_ESCURO, 0.4);
    expect(contraste(tom("red-400"), hoverEscuro)).toBeGreaterThan(MINIMO);
  });
});

/* ---------- a forma, que é a metade "sem gritar" ---------- */

const geometria = (classe: string) =>
  classe
    .split(/\s+/)
    .filter((c) => !/(^|:)(text-(zinc|red)-|bg-|border-)/.test(c))
    .sort();

describe("os dois tratamentos de ação de linha", () => {
  it("compartilham a geometria: a diferença entre eles é SÓ o tom", () => {
    expect(geometria(btnLinhaDanger)).toEqual(geometria(btnLinha));
  });

  it("a destrutiva não usa o tom quieto das irmãs", () => {
    expect(btnLinhaDanger).not.toMatch(/(^|\s)(dark:)?text-zinc-/);
  });

  it("a destrutiva declara tom nos DOIS temas", () => {
    // O defeito original era exatamente uma cor só para os dois temas
    // (`text-zinc-500 dark:text-zinc-500`), que é a raiz do achado D3.
    expect(btnLinhaDanger).toMatch(/(^|\s)text-red-\d{3}(\s|$)/);
    expect(btnLinhaDanger).toMatch(/(^|\s)dark:text-red-\d{3}(\s|$)/);
  });

  it("não vira `btnDanger`: ação de texto em linha não desenha caixa", () => {
    // `btnDanger` é botão solto de cartão, e traz borda e `px-3`. Numa linha de
    // quatro ações de texto ele seria a única caixa desenhada — o elemento mais
    // chamativo, e não o mais claro.
    expect(btnDanger).toMatch(/(^|\s)border(\s|$)/);
    expect(btnLinhaDanger).not.toMatch(/(^|\s)border(\s|$)/);
    expect(btnLinha).not.toMatch(/(^|\s)border(\s|$)/);
  });
});
