import { describe, it, expect } from "vitest";
import {
  btnLinha,
  btnLinhaDanger,
  btnDanger,
  acoesDaLinha,
  linhaOcupada,
} from "../app/ui";

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
  MINIMO,
  type Rgb,
} from "./medidor";

// OS FUNDOS REAIS DA LINHA, e não um branco/preto de conveniência:
// claro  — `body` é `bg-papel`, o cartão da linha é `bg-white`.
// escuro — `body` é `dark:bg-papel-escuro`, o cartão é `dark:bg-zinc-900/70`.
const FUNDO_CLARO = BRANCO;
const FUNDO_ESCURO = misturar(tom("zinc-900"), tom("papel-escuro"), 0.7);

// O FUNDO DA LINHA OCUPADA, que na Parte 1 deixou de ser opacidade e passou a
// ser cor: `bg-traco/40!` no claro e `dark:bg-traco-escuro/40!` no escuro. O `!`
// substitui o fundo do cartão, então o que está ATRÁS é a página.
const OCUPADO_CLARO = misturar(tom("traco"), tom("papel"), 0.4);
const OCUPADO_ESCURO = misturar(tom("traco-escuro"), tom("papel-escuro"), 0.7);


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
    const destrutiva = contraste(tom("parou"), FUNDO_CLARO);
    const irma = contraste(tom("quieto"), FUNDO_CLARO);
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
    const destrutiva = contraste(tom("parou-escuro"), FUNDO_ESCURO);
    const antes = contraste(tom("zinc-500"), FUNDO_ESCURO);
    expect(antes).toBeLessThan(MINIMO); // 3,91:1 — o defeito
    expect(destrutiva).toBeGreaterThan(MINIMO); // 6,53:1 — o conserto
  });

  it("continua legível SOBRE o fundo do hover, nos dois temas", () => {
    // É o estado em que a pessoa está prestes a clicar em apagar; ele não pode
    // ser o mais fraco dos dois. Foi por aqui que `red-600` caiu no claro:
    // sobre `bg-red-50` ele dá 4,36:1, abaixo do mínimo.
    // O FUNDO DO HOVER TAMBÉM TROCOU DE NOME: era `bg-red-50` / `bg-red-950/40`,
    // e passou a ser a própria cor do estado a 8% e a 10%. É a mesma ideia com
    // menos dependência: o hover deixa de depender de uma rampa que a paleta não
    // nomeia. Medido, ele fica em 5,66:1 no claro e 5,84:1 no escuro.
    const hoverClaro = misturar(tom("parou"), FUNDO_CLARO, 0.08);
    expect(contraste(tom("parou"), hoverClaro)).toBeGreaterThan(MINIMO);
    const hoverEscuro = misturar(tom("parou-escuro"), FUNDO_ESCURO, 0.1);
    expect(contraste(tom("parou-escuro"), hoverEscuro)).toBeGreaterThan(MINIMO);
  });
});

/* ---------- a forma, que é a metade "sem gritar" ---------- */

// AS CLASSES DE COR SAEM, E SÓ ELAS. O filtro passou a conhecer os nomes da
// paleta (`text-quieto`, `text-parou`, e o par `-escuro` de cada um) além da
// rampa `zinc`/`red` que ele já conhecia — sem isso ele deixaria `text-quieto`
// passar por geometria e o caso abaixo compararia tom com tom.
const CLASSE_DE_COR =
  /(^|:)(text-(zinc|red)-|text-(quieto|parou)(-escuro)?(\/|$)|bg-|border-)/;

const geometria = (classe: string) =>
  classe
    .split(/\s+/)
    .filter((c) => !CLASSE_DE_COR.test(c))
    .sort();

describe("os dois tratamentos de ação de linha", () => {
  it("compartilham a geometria: a diferença entre eles é SÓ o tom", () => {
    expect(geometria(btnLinhaDanger)).toEqual(geometria(btnLinha));
  });

  it("a destrutiva não usa o tom quieto das irmãs", () => {
    expect(btnLinhaDanger).not.toMatch(/(^|\s)(dark:)?text-zinc-/);
    expect(btnLinhaDanger).not.toMatch(/(^|\s)(dark:)?text-quieto/);
  });

  it("a destrutiva declara tom nos DOIS temas", () => {
    // O defeito original era exatamente uma cor só para os dois temas
    // (`text-zinc-500 dark:text-zinc-500`), que é a raiz do achado D3.
    // O par deixou de ser `red-700`/`red-400` e passou a ser
    // `parou`/`parou-escuro` — os MESMOS vermelhos, agora com o nome do estado.
    expect(btnLinhaDanger).toMatch(/(^|\s)text-parou(\s|$)/);
    expect(btnLinhaDanger).toMatch(/(^|\s)dark:text-parou-escuro(\s|$)/);
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

/* ---------- D11: a opacidade, que derrubava a linha inteira ---------- */

// O ACHADO, medido em produção a >=640px com o auditor CONSERTADO (o antigo não
// acumulava a opacidade dos ancestrais, e foi por isso que a auditoria original
// não pegou): o contêiner das quatro ações tinha `sm:opacity-60`. A cor
// declarada passava; a cor VISTA não.
//
// `opacity` multiplica o galho inteiro, então o que chega ao olho é o tom
// misturado com o fundo. É essa mistura que se mede aqui.
const comOpacidade = (tomNome: string, fundo: Rgb, alfa: number) =>
  contraste(misturar(tom(tomNome), fundo, alfa), fundo);

// As QUATRO ações da linha, cada uma no seu tema e no seu fundo.
const AS_QUATRO: [string, string, Rgb][] = [
  ["Pausar/Editar/Duplicar, claro", "quieto", FUNDO_CLARO],
  ["Pausar/Editar/Duplicar, escuro", "quieto-escuro", FUNDO_ESCURO],
  ["Excluir, claro", "parou", FUNDO_CLARO],
  ["Excluir, escuro", "parou-escuro", FUNDO_ESCURO],
];

const piorDasQuatro = (alfa: number) =>
  Math.min(...AS_QUATRO.map(([, t, f]) => comOpacidade(t, f, alfa)));

describe("a opacidade que revelava as ações no hover", () => {
  it("reproduz o 2,90:1 que a auditoria mediu no navegador", () => {
    // É a prova de que esta conta mede o mesmo que o Chrome mediu na tela.
    expect(comOpacidade("zinc-600", FUNDO_CLARO, 0.6)).toBeCloseTo(2.9, 1);
  });

  it("em 0,60 reprova as QUATRO, e não só a destrutiva", () => {
    for (const [nome, t, f] of AS_QUATRO) {
      expect(comOpacidade(t, f, 0.6), nome).toBeLessThan(MINIMO);
    }
  });

  it("NENHUMA opacidade que se veja aprova as quatro — é por isso que ela caiu", () => {
    // COM O TOM NOMEADO A CONTA FICOU AINDA MAIS DURA, e é isso que o número
    // mostra: com `zinc-600` o menor valor que aprovava era 0,80, cravado em
    // 4,50. Com `quieto` (#6B6862, 25 pontos mais claro), nem 0,90 aprova —
    // 4,46:1 —, e o primeiro que passa é 0,95, que ninguém enxerga.
    expect(piorDasQuatro(0.75)).toBeLessThan(MINIMO);
    expect(piorDasQuatro(0.8)).toBeLessThan(MINIMO);
    expect(piorDasQuatro(0.9)).toBeLessThan(MINIMO);
    expect(piorDasQuatro(0.95)).toBeGreaterThanOrEqual(MINIMO);
  });

  it("o contêiner das ações não declara opacidade nenhuma", () => {
    expect(acoesDaLinha).not.toMatch(/opacity-/);
    // e nem por um atalho de tamanho de tela, que era a forma exata do defeito
    expect(acoesDaLinha).not.toMatch(/(sm|md|lg):/);
  });

  it("as ações continuam sem opacidade própria, fora do estado desativado", () => {
    // `disabled:opacity-50` fica: controle desativado é o caso em que a WCAG
    // não cobra contraste, e é o único `opacity-` que sobra na linha.
    for (const classe of [btnLinha, btnLinhaDanger]) {
      const opacidades = classe.match(/[a-z:-]*opacity-\d+/g) ?? [];
      expect(opacidades).toEqual(["disabled:opacity-50"]);
    }
  });
});

describe("a linha enquanto a ação corre", () => {
  // A OPACIDADE CAIU AQUI TAMBÉM, três ondas depois de o D11 ter derrubado a
  // irmã dela, e pela MESMA regra: o único valor que aprovava (0,80, com
  // `zinc-600`, em 4,50 cravado) deixou de aprovar quando o tom quieto passou a
  // ser `quieto`. O sinal de "esta linha está trabalhando" passou a ser o FUNDO.
  it("não dim nenhum: o sinal deixou de ser opacidade", () => {
    expect(linhaOcupada).not.toMatch(/opacity-/);
    expect(linhaOcupada).toMatch(/(^|\s)bg-/);
    expect(linhaOcupada).toMatch(/(^|\s)dark:bg-/);
  });

  it("o `!` está lá, porque `card` já declara `bg-*` e a ordem na string não decide", () => {
    // Sem ele, quem desempata é a ordem na FOLHA que o Tailwind gera — que é
    // exatamente o defeito medido no aviso de `input`, em app/ui.ts.
    for (const classe of linhaOcupada.split(/\s+/).filter((c) => /(^|:)bg-/.test(c))) {
      expect(classe, classe).toMatch(/!$/);
    }
  });

  it("as quatro ações continuam legíveis sobre o fundo da linha ocupada", () => {
    // É o que a opacidade não conseguia entregar: o fundo muda, o texto não, e
    // as quatro continuam acima do mínimo.
    expect(contraste(tom("quieto"), OCUPADO_CLARO)).toBeGreaterThan(MINIMO);
    expect(contraste(tom("parou"), OCUPADO_CLARO)).toBeGreaterThan(MINIMO);
    expect(contraste(tom("quieto-escuro"), OCUPADO_ESCURO)).toBeGreaterThan(MINIMO);
    expect(contraste(tom("parou-escuro"), OCUPADO_ESCURO)).toBeGreaterThan(MINIMO);
  });

  it("e o fundo novo SE VÊ, que é o que a opacidade legível não conseguia", () => {
    // Um sinal de estado que não se distingue do repouso não é sinal. O cartão
    // claro é branco; a linha ocupada tem de sair dele.
    expect(contraste(OCUPADO_CLARO, FUNDO_CLARO)).toBeGreaterThan(1.05);
    expect(contraste(OCUPADO_ESCURO, FUNDO_ESCURO)).toBeGreaterThan(1.05);
  });

  it("o número do defeito não se perde: 0,60 dava 2,90:1 com o tom de então", () => {
    expect(comOpacidade("zinc-600", FUNDO_CLARO, 0.6)).toBeLessThan(MINIMO);
    expect(comOpacidade("zinc-600", FUNDO_CLARO, 0.6)).toBeCloseTo(2.9, 1);
  });
});
