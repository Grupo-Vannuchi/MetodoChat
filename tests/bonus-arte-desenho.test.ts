import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { alturaDisponivel } from "@/lib/bonus/arte-geometria";
import { degrausDoSlide } from "@/lib/bonus/arte-slides";
import { desenharSlide, respostaDoDesenho, slideDoVetor, soQuebraNoEspaco, SVG_DO_EMOJI } from "./arte-desenhada";
import { entradasDosVetores } from "./arte-vetores-entradas";
import {
  ARQUIVO_DOS_VETORES,
  CONTA,
  lerVetores,
  MEDIDA,
  NORMALIZACAO,
  SOBRE,
  textoDosVetores,
  type Vetor,
} from "./vetores-da-arte";

// A RÉGUA E OS VETORES, DESENHADOS (spec da Etapa 4, "A régua, como teste" e "Dois donos"). Cada vetor
// de tests/vetores-da-arte.json é desenhado de novo no Satori daqui, com a coluna do texto e o espaço
// da imagem pintados (tests/arte-desenhada.tsx), e o PNG tem de responder o que o arquivo diz: a
// altura e o cabe no degrau dele, e o degrau de cima não cabe. É aqui que uma mudança no desenho, no
// Satori ou na fonte aparece. O Labs desenha o mesmo arquivo no Satori de lá.
//
// A RÉGUA está dentro: os vetores "limite-" são o maior texto que a conta aceita em cada degrau, por
// tipo, modo e estilo, e "cabe" no desenho é a última linha escura acima de 1240 sem nada vazar.
//
// GERAR o arquivo (quando o desenho muda de propósito, combinado com o Labs):
//   GERAR_VETORES_DA_ARTE=1 npx vitest run tests/bonus-arte-desenho.test.ts
// e atualizar o sha256 em tests/bonus-arte-vetores.test.ts.

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const sha256 = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");

// O emoji vem da rede no desenho (o og busca o SVG em cdn.jsdelivr.net). Aqui ele vem de um SVG fixo:
// a largura do emoji é 1em, seja qual for o desenho. O resto do `fetch` (os .wasm do og) segue o real.
beforeAll(() => {
  const real = globalThis.fetch;
  vi.stubGlobal("fetch", (u: RequestInfo | URL, i?: RequestInit) =>
    String(u).startsWith("https://cdn.jsdelivr.net/") ? Promise.resolve(new Response(SVG_DO_EMOJI)) : real(u, i)
  );
});
afterAll(() => {
  vi.unstubAllGlobals();
});

/** De onde o arquivo saiu: o Satori, as fontes e o desenho, cada um pelo sha256. */
function origem() {
  const require = createRequire(import.meta.url);
  const og = require.resolve("next/dist/compiled/@vercel/og/package.json").replace(/package\.json$/, "");
  const versaoDoOg = JSON.parse(readFileSync(`${og}package.json`, "utf8")).version as string;
  const versaoDoNext = JSON.parse(readFileSync(require.resolve("next/package.json"), "utf8")).version as string;
  return {
    satori: `o do @vercel/og ${versaoDoOg} compilado no Next ${versaoDoNext}`,
    og: `index.node.js sha256 ${sha256(readFileSync(`${og}index.node.js`))}`,
    fontes: Object.fromEntries(
      ["Carlito-Regular.ttf", "Carlito-Bold.ttf"].map((n) => [n, sha256(readFileSync(`${RAIZ}/lib/bonus/fonte/${n}`))])
    ),
    desenho: {
      "lib/bonus/arte-desenho.tsx": sha256(readFileSync(`${RAIZ}/lib/bonus/arte-desenho.tsx`, "utf8").replace(/\r\n/g, "\n")),
    },
  };
}

if (process.env.GERAR_VETORES_DA_ARTE === "1") {
  it("gera tests/vetores-da-arte.json desenhando cada entrada", async () => {
    const vetores: Vetor[] = [];
    for (const e of entradasDosVetores()) {
      const resposta = await respostaDoDesenho(e).catch((erro: unknown) => {
        throw new Error(`${e.nome}: ${String(erro)}`);
      });
      vetores.push({ ...e, exato: await soQuebraNoEspaco(slideDoVetor(e)), ...resposta });
    }
    writeFileSync(
      ARQUIVO_DOS_VETORES,
      textoDosVetores({ sobre: SOBRE, origem: origem(), normalizacao: NORMALIZACAO, conta: CONTA, medida: MEDIDA, vetores })
    );
  }, 900_000);
} else {
  const { vetores } = lerVetores();

  describe("cada vetor, desenhado de novo aqui", () => {
    it.each(vetores.map((v) => [v.nome, v] as const))("%s", async (_, v) => {
      const slide = slideDoVetor(v);
      const degraus = degrausDoSlide(v.tipo, v.comIlustracao);
      const i = degraus.indexOf(v.degrau);
      expect(i, "o degrau é da escada do tipo").toBeGreaterThanOrEqual(0);
      if (!v.cabe) expect(i, "o que não cabe está no piso").toBe(degraus.length - 1);

      const d = await desenharSlide(slide, v.degrau, v.comIlustracao);
      expect({ altura: d.altura, cabe: d.cabe }).toEqual({ altura: v.alturaDesenhada, cabe: v.cabe });
      // A geometria diz a verdade: o limite de 334 (ou 955) é o que o pixel mostra.
      expect(d.cabe).toBe(!d.vaza && d.altura <= alturaDisponivel(v.comIlustracao));
      if (i > 0) expect((await desenharSlide(slide, degraus[i - 1], v.comIlustracao)).cabe, "o degrau de cima não cabe").toBe(false);

      expect(await soQuebraNoEspaco(slide), "exato").toBe(v.exato);
    }, 60_000);
  });
}
