import { describe, it, expect } from "vitest";
import {
  tom,
  contraste,
  MINIMO,
  FUNDOS,
  FUNDOS_CLAROS,
  FUNDOS_ESCUROS,
  FUNDOS_DA_ONDA3,
  FUNDOS_CLAROS_DA_ONDA3,
  FUNDOS_ESCUROS_DA_ONDA3,
} from "./medidor";
import { tomQuieto, muted, hint, thead, eyebrow, pageSubtitle } from "../app/ui";

// O QUE ESTE ARQUIVO FIXA (achado D3): texto quieto NUNCA volta a usar o mesmo
// tom nos dois temas.
//
// O DEFEITO, medido em produção no navegador, 10/09/2026:
//
//   rótulo de seção da barra lateral (10px)   2,49:1 claro   2,58:1 escuro
//   `hint` (12px)                             passa          3,67:1
//   `thead` (11px)                            passa          4,10:1
//
// O mínimo é 4,5:1. A raiz das três é a MESMA e não é o tom: é a regra. Elas
// escreviam uma cor só para os dois temas, então erravam sempre num dos dois —
// e `muted`, que troca (`zinc-600`/`zinc-400`), passava. O conserto foi
// transformar o tom de `muted` na regra do sistema (`tomQuieto`, app/ui.ts) e
// fazer os quatro tokens saírem dela.
//
// A SUÍTE NÃO TESTA COMPONENTE, então o portão aqui é o mesmo da Onda 2: a
// aritmética da cor contra os fundos REAIS do produto, e a forma da string.
//
// O QUE ESTE ARQUIVO NÃO PROVA: que a tela renderizada mudou. A Onda 3 não pôde
// rodar `next build` nem `npm run dev`, então o número DEPOIS é calculado, não
// medido no navegador.

/* ---------- o que o medidor precisa provar antes de medir ---------- */

describe("o medidor de contraste bate com o navegador", () => {
  it("reproduz os tons que a auditoria leu no Chrome", () => {
    // `zinc-400` e `zinc-500` são os dois valores que a auditoria imprimiu do
    // DOM; se a conversão oklch->sRGB errasse, errariam aqui primeiro.
    expect(tom("zinc-400")).toEqual([159, 159, 169]);
    expect(tom("zinc-500")).toEqual([113, 113, 123]);
    expect(tom("zinc-600")).toEqual([82, 82, 92]);
  });

  it("reproduz os três números do achado D3", () => {
    // ELES SE MEDEM CONTRA `FUNDOS_DA_ONDA3`, E NÃO CONTRA `FUNDOS`, e a
    // diferença não é detalhe: a Parte 1 da linguagem visual trocou o `body` de
    // `bg-zinc-100`/`bg-black` para `bg-papel`/`bg-papel-escuro`. Um número
    // medido em 10/09/2026 no navegador é um fato sobre a tela DAQUELE dia;
    // apontá-lo para o fundo de hoje o transformaria em ficção, e o primeiro
    // que quebrasse seria apagado junto com o motivo da decisão.
    // barra lateral clara = `bg-zinc-50/50` sobre o corpo `bg-zinc-100`
    expect(contraste(tom("zinc-400"), FUNDOS_DA_ONDA3["claro: barra lateral (bg-zinc-50/50)"])).toBeCloseTo(2.45, 1);
    // `hint` no escuro, sobre o cartão
    expect(contraste(tom("zinc-500"), FUNDOS_DA_ONDA3["escuro: cartao (bg-zinc-900/70)"])).toBeCloseTo(3.91, 1);
    // `thead` no escuro, sobre o próprio fundo do cabeçalho
    expect(contraste(tom("zinc-500"), FUNDOS_DA_ONDA3["escuro: cabecalho de tabela (bg-zinc-950/50)"])).toBeCloseTo(4.02, 1);
  });
});

/* ---------- a medição que escolheu o tom ---------- */

// Lê o tom de uma string de token: o claro é `text-<tom>`, o escuro é
// `dark:text-<tom>`. Sem o `dark:`, o token usa o MESMO tom nos dois — que é
// exatamente o defeito.
//
// ELE PASSOU A ENXERGAR AS CORES NOMEADAS, e não só a rampa `zinc-N`: a Parte 1
// da linguagem visual trocou `text-zinc-600 dark:text-zinc-400` por
// `text-quieto dark:text-quieto-escuro`. O padrão aceita as duas formas de
// propósito — o portão tem de continuar reprovando um token que volte a
// escrever `zinc-500` nos dois temas, e não só um que escreva `quieto` nos dois.
function tonsDe(classe: string): { claro: string | null; escuro: string | null } {
  const TOM = "(zinc-\\d{2,3}|[a-z]+(?:-escuro)?)";
  const claro = classe.match(new RegExp(`(?:^|\\s)text-${TOM}(?:\\s|$)`));
  const escuro = classe.match(new RegExp(`(?:^|\\s)dark:text-${TOM}(?:\\s|$)`));
  return { claro: claro?.[1] ?? null, escuro: escuro?.[1] ?? null };
}

const TOKENS_QUIETOS: [string, string][] = [
  ["tomQuieto", tomQuieto],
  ["muted", muted],
  ["hint", hint],
  ["thead", thead],
  ["eyebrow", eyebrow],
  ["pageSubtitle", pageSubtitle],
];

describe("o tom do texto quieto", () => {
  it("passa o mínimo sobre TODOS os fundos reais do produto", () => {
    const { claro, escuro } = tonsDe(tomQuieto);
    expect(claro).toBe("quieto");
    expect(escuro).toBe("quieto-escuro");
    for (const [nome, fundo] of FUNDOS_CLAROS) {
      expect(contraste(tom(claro!), fundo), nome).toBeGreaterThanOrEqual(MINIMO);
    }
    for (const [nome, fundo] of FUNDOS_ESCUROS) {
      expect(contraste(tom(escuro!), fundo), nome).toBeGreaterThanOrEqual(MINIMO);
    }
  });

  it("o pior caso de cada tema é o que o comentário do token declara", () => {
    // Se estes dois números mudarem, o comentário em `app/ui.ts` virou mentira.
    const piorClaro = Math.min(...FUNDOS_CLAROS.map(([, f]) => contraste(tom("quieto"), f)));
    const piorEscuro = Math.min(
      ...FUNDOS_ESCUROS.map(([, f]) => contraste(tom("quieto-escuro"), f))
    );
    expect(piorClaro).toBeCloseTo(5.05, 1); // sobre `bg-zinc-100`, o balão recebido
    expect(piorEscuro).toBeCloseTo(5.71, 1); // sobre `bg-zinc-800`, o balão recebido
  });

  it("no escuro a troca de tom não custou nada, e no claro custou margem", () => {
    // O NÚMERO QUE O COMENTÁRIO DE `tomQuieto` DECLARA, e o que ele custa. No
    // escuro o tom nomeado empata com o `zinc-400` que substituiu; no claro ele
    // desce de 7,02:1 para 5,05:1. Continua acima do mínimo, e a folga que
    // sobra passa a ser um número escrito e não uma suposição.
    const piorEscuroAntes = contraste(
      tom("zinc-400"),
      FUNDOS["escuro: balao recebido (bg-zinc-800)"]
    );
    const piorEscuroAgora = Math.min(
      ...FUNDOS_ESCUROS.map(([, f]) => contraste(tom("quieto-escuro"), f))
    );
    expect(piorEscuroAgora).toBeGreaterThanOrEqual(piorEscuroAntes);

    const piorClaroAgora = Math.min(...FUNDOS_CLAROS.map(([, f]) => contraste(tom("quieto"), f)));
    expect(piorClaroAgora).toBeGreaterThan(MINIMO);
    expect(piorClaroAgora - MINIMO).toBeCloseTo(0.55, 1);
  });

  it("as três alternativas mais baratas REPROVAM, e é por isso que caíram", () => {
    // TAMBÉM MEDIDO CONTRA OS FUNDOS DA ONDA 3, pelo mesmo motivo do caso lá em
    // cima — e aqui há um número que mostra por quê: sobre `bg-papel` (o corpo
    // de hoje) o `zinc-500` dá 4,63:1, ou seja PASSA. A recusa continua certa
    // sobre o fundo em que ela foi tomada, e é esse fundo que ela mede.
    // `zinc-500` nos dois temas — o que estava lá.
    const falhasDoAntigo = [...FUNDOS_CLAROS_DA_ONDA3, ...FUNDOS_ESCUROS_DA_ONDA3].filter(
      ([, f]) => contraste(tom("zinc-500"), f) < MINIMO
    );
    expect(falhasDoAntigo.length).toBe(9);

    // mexer SÓ no escuro (`zinc-500`/`zinc-400`): o corpo claro continua abaixo.
    expect(contraste(tom("zinc-500"), FUNDOS_DA_ONDA3["claro: corpo (bg-zinc-100)"])).toBeLessThan(MINIMO);

    // mexer SÓ no claro (`zinc-600`/`zinc-500`): os oito fundos escuros continuam abaixo.
    for (const [nome, fundo] of FUNDOS_ESCUROS_DA_ONDA3) {
      expect(contraste(tom("zinc-500"), fundo), nome).toBeLessThan(MINIMO);
    }
  });

  it("não vira o contraste do texto NORMAL: quieto que grita deixa de ser quieto", () => {
    // O limite de cima também é medido. O texto normal desta interface é a
    // `tinta`; o quieto tem de ficar claramente abaixo dela.
    const normalClaro = contraste(tom("tinta"), FUNDOS["claro: cartao (bg-white)"]);
    const quietoClaro = contraste(tom("quieto"), FUNDOS["claro: cartao (bg-white)"]);
    expect(quietoClaro).toBeLessThan(normalClaro - 3);
  });
});

/* ---------- a regra, que é o que impede a volta do defeito ---------- */

describe("todo token de texto quieto", () => {
  it("declara tom nos DOIS temas — nenhum repete a cor", () => {
    for (const [nome, classe] of TOKENS_QUIETOS) {
      const { claro, escuro } = tonsDe(classe);
      expect(claro, `${nome} sem tom claro`).not.toBeNull();
      expect(escuro, `${nome} sem \`dark:\``).not.toBeNull();
      expect(claro, `${nome} usa a mesma cor nos dois temas`).not.toBe(escuro);
    }
  });

  it("sai do MESMO tom: um só, e não seis parecidos", () => {
    // `tomQuieto` SAI DESTA ITERAÇÃO, e a razão é que ele é a própria régua:
    // `expect(tomQuieto).toContain(tomQuieto)` é `x.toContain(x)`, e uma das
    // seis voltas não media nada. Achado por revisão em 11/09/2026.
    //
    // ELE CONTINUA NA LISTA porque nos outros dois casos deste bloco — ter os
    // dois temas, e não usar `zinc-500` — a pergunta vale para ele também.
    const derivados = TOKENS_QUIETOS.filter(([nome]) => nome !== "tomQuieto");
    expect(derivados.length, "a lista não pode ficar só com a régua").toBeGreaterThan(3);
    for (const [nome, classe] of derivados) {
      expect(classe, nome).toContain(tomQuieto);
    }
  });

  it("nenhum deles usa `zinc-500`, que é a raiz do D3", () => {
    for (const [nome, classe] of TOKENS_QUIETOS) {
      expect(classe, nome).not.toMatch(/text-zinc-500/);
    }
  });

  it("nenhum deles voltou para a rampa `zinc`: o tom quieto agora tem nome", () => {
    // `zinc-600` não avisa ninguém de que é o tom quieto do sistema, e foi por
    // essa porta que seis tokens parecidos entraram. `quieto` avisa.
    for (const [nome, classe] of TOKENS_QUIETOS) {
      expect(classe, nome).not.toMatch(/(^|\s)(dark:)?text-zinc-/);
    }
  });
});
