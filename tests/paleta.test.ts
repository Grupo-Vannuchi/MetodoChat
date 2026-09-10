import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  tom,
  contraste,
  piorCaso,
  MINIMO,
  CORES_NOMEADAS,
  FUNDOS_CLAROS,
  FUNDOS_ESCUROS,
  FUNDOS,
} from "./medidor";

// O QUE ESTE ARQUIVO FIXA (Parte 1 da linguagem visual): a paleta nomeada é
// MEDIDA, e o número que cada cor declara em `app/globals.css` não vira mentira.
//
// POR QUE ELE EXISTE, e não bastava o comentário: `zinc-500` esteve nove dos
// quinze fundos do produto abaixo de 4,5:1 por meses, e ninguém viu — porque
// `zinc-500` não diz nada sobre contraste. O nome novo (`text-quieto`) diz o
// PAPEL; quem tem de dizer o NÚMERO é uma varredura que reprova.
//
// A SUÍTE NÃO TESTA COMPONENTE, então o portão aqui é o mesmo das Ondas 2 e 3:
// a aritmética da cor contra os fundos REAIS do produto (`tests/medidor.ts`).
//
// O QUE ESTE ARQUIVO NÃO PROVA: que a tela renderizada mudou. Esta entrega não
// pôde rodar `next build` nem `npm run dev`, então o número DEPOIS é calculado,
// e não medido no navegador.

const CSS = readFileSync(
  fileURLToPath(new URL("../app/globals.css", import.meta.url)),
  "utf8"
);

/* ---------- os sete papéis, e o par escuro de cada um ---------- */

const PAPEIS = ["papel", "tinta", "traco", "quieto", "aberto", "fecha", "parou"] as const;

// As duas que pintam SUPERFÍCIE e FIO, e por isso não respondem ao mínimo de
// texto: o 4,5:1 da WCAG é para texto. O que se cobra delas é serem declaradas
// como tais — ver o caso "declara o que cada cor é".
const NAO_SAO_TEXTO = new Set(["papel", "traco"]);

describe("a paleta nomeada", () => {
  it("tem os sete papéis, e cada um com o seu par do tema escuro", () => {
    for (const nome of PAPEIS) {
      expect(CORES_NOMEADAS, nome).toContain(nome);
      expect(CORES_NOMEADAS, `${nome}-escuro`).toContain(`${nome}-escuro`);
    }
    // catorze e nada mais: cor sem papel declarado é a porta por onde a paleta
    // volta a se acumular, que foi o diagnóstico da auditoria ("a identidade
    // não foi decidida, foi acumulada").
    expect(CORES_NOMEADAS.length).toBe(PAPEIS.length * 2);
  });

  it("NENHUM par usa o mesmo valor nos dois temas — é a regra da Onda 3", () => {
    // Texto que não troca de tema erra num dos dois SEMPRE: o fundo mudou e ele
    // não. A regra nasceu no `tomQuieto` e agora vale para a paleta inteira.
    for (const nome of PAPEIS) {
      expect(tom(nome), nome).not.toEqual(tom(`${nome}-escuro`));
    }
  });

  it("o índigo não está entre elas, em nenhuma forma", () => {
    // A cor de marca e de ação saiu; o que sobrou de cor tem significado de
    // estado. Se alguém a trouxer de volta pela porta do `@theme`, é aqui.
    expect(CSS).not.toMatch(/indigo|violet|purple|#(4f46e5|6366f1|818cf8)/i);
  });
});

/* ---------- o número que cada cor declara ao lado de si ---------- */

// `--color-quieto: #6b6862; /* pior 5,05 *␑/` -> ["quieto", 5.05]
// `--color-papel: #fbfaf8;  /* fundo *␑/`     -> ["papel", null]
function declaracoes(): [string, number | null][] {
  const achados: [string, number | null][] = [];
  const padrao = /--color-([a-z][a-z-]*):\s*#[0-9a-f]{6};\s*\/\*\s*(?:pior\s+([\d,]+)|fundo|fio)\s*\*\//gi;
  for (const m of CSS.matchAll(padrao)) {
    achados.push([m[1], m[2] ? Number(m[2].replace(",", ".")) : null]);
  }
  return achados;
}

describe("cada cor declara, ao lado de si, o número que tem de manter", () => {
  it("as catorze estão declaradas — nenhuma entra sem dizer o que é", () => {
    const nomes = declaracoes().map(([n]) => n);
    expect(nomes.sort()).toEqual([...CORES_NOMEADAS].sort());
  });

  it("declara o que cada cor é: superfície e fio não fingem ser texto", () => {
    for (const [nome, pior] of declaracoes()) {
      const raiz = nome.replace(/-escuro$/, "");
      if (NAO_SAO_TEXTO.has(raiz)) {
        expect(pior, `${nome} não é texto e não deve declarar pior caso`).toBeNull();
      } else {
        expect(pior, `${nome} é texto e tem de declarar o pior caso`).not.toBeNull();
      }
    }
  });

  it("o número declarado é o número MEDIDO, e não um número lembrado", () => {
    // É este caso que impede o comentário de virar mentira: trocar o hex sem
    // trocar o número reprova aqui.
    for (const [nome, declarado] of declaracoes()) {
      if (declarado === null) continue;
      const fundos = nome.endsWith("-escuro") ? FUNDOS_ESCUROS : FUNDOS_CLAROS;
      expect(piorCaso(nome, fundos), nome).toBeCloseTo(declarado, 1);
    }
  });
});

/* ---------- a medição que autoriza cada cor a entrar ---------- */

describe("toda cor de texto passa o mínimo sobre TODOS os fundos reais", () => {
  it("no tema claro", () => {
    for (const nome of PAPEIS) {
      if (NAO_SAO_TEXTO.has(nome)) continue;
      for (const [fundo, rgb] of FUNDOS_CLAROS) {
        expect(contraste(tom(nome), rgb), `${nome} sobre ${fundo}`).toBeGreaterThanOrEqual(
          MINIMO
        );
      }
    }
  });

  it("no tema escuro", () => {
    for (const nome of PAPEIS) {
      if (NAO_SAO_TEXTO.has(nome)) continue;
      for (const [fundo, rgb] of FUNDOS_ESCUROS) {
        expect(
          contraste(tom(`${nome}-escuro`), rgb),
          `${nome}-escuro sobre ${fundo}`
        ).toBeGreaterThanOrEqual(MINIMO);
      }
    }
  });

  it("os dois piores casos do produto são os balões da conversa", () => {
    // O fundo claro mais ESCURO e o fundo escuro mais CLARO são a mesma tela
    // (`app/conversas/[id]`, o balão recebido), e são eles que mandam nas duas
    // escolhas. Quem for propor uma cor nova mede contra estes dois primeiro.
    for (const nome of ["tinta", "quieto", "aberto", "fecha", "parou"]) {
      expect(
        contraste(tom(nome), FUNDOS["claro: balao recebido (bg-zinc-100)"]),
        nome
      ).toBeCloseTo(piorCaso(nome, FUNDOS_CLAROS), 2);
      expect(
        contraste(tom(`${nome}-escuro`), FUNDOS["escuro: balao recebido (bg-zinc-800)"]),
        `${nome}-escuro`
      ).toBeCloseTo(piorCaso(`${nome}-escuro`, FUNDOS_ESCUROS), 2);
    }
  });
});

/* ---------- o que a paleta NÃO pode fazer ---------- */

describe("a hierarquia entre normal e quieto", () => {
  it("o quieto não vira o contraste do texto NORMAL, nos dois temas", () => {
    // O limite de CIMA também é medido, e a razão é a mesma da Onda 3: texto
    // quieto que grita deixa de ser quieto, e o achado pedia legibilidade e não
    // hierarquia invertida.
    const cartaoClaro = FUNDOS["claro: cartao (bg-white)"];
    const cartaoEscuro = FUNDOS["escuro: cartao (bg-zinc-900/70)"];
    expect(contraste(tom("quieto"), cartaoClaro)).toBeLessThan(
      contraste(tom("tinta"), cartaoClaro) - 3
    );
    expect(contraste(tom("quieto-escuro"), cartaoEscuro)).toBeLessThan(
      contraste(tom("tinta-escuro"), cartaoEscuro) - 3
    );
  });

  it("o par escuro do quieto não regride o que a Onda 3 tinha conquistado", () => {
    // `zinc-400` dava 5,68:1 no pior fundo escuro. O tom novo é morno, e a
    // troca de temperatura não pode custar legibilidade.
    expect(piorCaso("quieto-escuro", FUNDOS_ESCUROS)).toBeGreaterThanOrEqual(
      contraste(tom("zinc-400"), FUNDOS["escuro: balao recebido (bg-zinc-800)"])
    );
  });
});
