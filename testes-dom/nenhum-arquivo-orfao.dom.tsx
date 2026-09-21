import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// O PORTÃO CONTRA O ARQUIVO ÓRFÃO — o modo mais barato de perder cobertura.
//
// O `include` desta categoria é `testes-dom/**/*.dom.tsx`. Um arquivo aqui que
// não case com esse padrão — `algo.dom.ts` sem o `x`, `algo.test.tsx`,
// `algo.dom.jsx` — NÃO RODA EM SUÍTE NENHUMA e ninguém é avisado: a suíte pura
// (`tests/**/*.test.ts`) não o alcança, a de integração
// (`testes-integracao/**/*.integracao.ts`) também não, e o `verify` fecha verde.
//
// A REVISÃO DE 21/09/2026 MEDIU ISSO: três arquivos com `expect(1).toBe(2)`
// dentro deste diretório, nenhum rodou, nenhum avisou. O caso mais provável é o
// `x` esquecido, porque um arquivo sem JSX é `.ts` por hábito.
//
// A SAÍDA NÃO É AFROUXAR O PADRÃO. Diretório e sufixo próprios são as duas
// travas que separam as três categorias — a mesma dupla que
// `vitest.integracao.config.ts` explica. O que faltava era alguém CONFERIR que
// nada ficou de fora delas.

// O CAMINHO VEM DA RAIZ DO PROJETO, e NÃO de `import.meta.url` — armadilha do
// ambiente `jsdom`, medida em 21/09/2026: ali `import.meta.url` não é `file://`
// e sim a URL da janela falsa, e `readdirSync` recusa com "The URL must be of
// scheme file". Os portões de `tests/` usam `import.meta.url` e funcionam
// porque aquela suíte roda em ambiente `node`. O vitest roda da raiz, então o
// caminho relativo é estável.
const DIRETORIO = resolve(process.cwd(), "testes-dom");

/** O que legitimamente não é um arquivo de caso: a montagem da suíte. */
const NAO_SAO_CASOS = new Set(["limpeza.ts"]);

describe("o diretório de testes de DOM", () => {
  const arquivos = readdirSync(DIRETORIO).filter((f) => /\.(ts|tsx|js|jsx|mts|cts)$/.test(f));

  it("enxerga o diretório que diz enxergar", () => {
    // Uma varredura vazia passa por vacuidade: se `readdirSync` mudar de alvo ou
    // o filtro comer tudo, é aqui que aparece — e não num silêncio verde.
    expect(arquivos).toContain("limpeza.ts");
    expect(arquivos.some((f) => f.endsWith(".dom.tsx"))).toBe(true);
  });

  it("não tem arquivo que nenhuma suíte roda", () => {
    const orfaos = arquivos.filter((f) => !f.endsWith(".dom.tsx") && !NAO_SAO_CASOS.has(f));
    expect(
      orfaos,
      `ARQUIVO ÓRFÃO em testes-dom/: ${orfaos.join(", ")}. O \`include\` desta ` +
        "categoria é `testes-dom/**/*.dom.tsx`, então este arquivo NÃO RODA em " +
        "suíte nenhuma e o `verify` fecha verde sem ele. O esquecimento comum é " +
        "o `x` do `.tsx`. Se o arquivo for montagem de suíte (e não casos), " +
        "acrescente-o a `NAO_SAO_CASOS` aqui, com o motivo."
    ).toEqual([]);
  });
});
