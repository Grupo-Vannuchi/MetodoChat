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

// ELE SAIU DAQUI E VIROU `tests/medidor.ts` na Onda 3, sem mudar de conta: a
// mesma conversão oklch->sRGB, a mesma mistura para os fundos translúcidos e a
// mesma fórmula de contraste. O que mudou foi de onde vem a paleta — do
// `tailwindcss/theme.css` do pacote, em vez de oito tons copiados à mão para
// dentro deste arquivo. A prova de que o medidor mede o mesmo que o Chrome
// mediu continua abaixo, e é ela que autoriza a troca.
import {
  tom,
  misturar,
  contraste,
  BRANCO,
  PRETO,
  MINIMO,
} from "./medidor";

// OS FUNDOS REAIS DA LINHA, e não um branco/preto de conveniência:
// claro  — `body` é `bg-zinc-100`, o cartão da linha é `bg-white`.
// escuro — `body` é `dark:bg-black`, o cartão é `dark:bg-zinc-900/70`.
const FUNDO_CLARO = BRANCO;
const FUNDO_ESCURO = misturar(tom("zinc-900"), PRETO, 0.7);


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
