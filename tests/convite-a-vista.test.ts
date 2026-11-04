import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// O BLOCO DO LINK DE CONVITE À VISTA (achado 163, decidido pelo Eduardo em 03/11/2026). Com a instalação toda
// concluída, as etapas da Configuração nascem recolhidas num <details> "Instalação" (app/setup/page.tsx), e o
// convite, que estava na etapa 6, ficava escondido lá dentro: para gerar um link, era preciso abrir o bloco. O
// convite passou a morar numa seção própria, fora de qualquer <details>, e este teste lê a página pela árvore do
// TypeScript para isso não voltar sem ninguém ver.
const PAGINA = fileURLToPath(new URL("../app/setup/page.tsx", import.meta.url));

function jsxDoConvite(fonte: string, arquivo = "page.tsx"): { quantos: number; dentroDeDetails: number } {
  const sf = ts.createSourceFile(arquivo, fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let quantos = 0;
  let dentroDeDetails = 0;
  const nome = (n: ts.Node) =>
    ts.isJsxSelfClosingElement(n) || ts.isJsxOpeningElement(n) ? n.tagName.getText(sf) : null;
  const visitar = (n: ts.Node) => {
    if (nome(n) === "Convites") {
      quantos++;
      for (let p = n.parent; p; p = p.parent) {
        if (ts.isJsxElement(p) && p.openingElement.tagName.getText(sf) === "details") {
          dentroDeDetails++;
          break;
        }
      }
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return { quantos, dentroDeDetails };
}

describe("o bloco do convite na Configuração (achado 163)", () => {
  it("o leitor acusa o convite dentro de um <details>, e não acusa o de fora", () => {
    expect(jsxDoConvite("const a = <details><summary>x</summary><div><Convites linhas={[]} /></div></details>;")).toEqual({
      quantos: 1,
      dentroDeDetails: 1,
    });
    expect(jsxDoConvite("const a = <section><Convites linhas={[]} /></section>;")).toEqual({ quantos: 1, dentroDeDetails: 0 });
  });

  it("a página desenha o convite uma vez só, fora do bloco Instalação recolhido", () => {
    expect(jsxDoConvite(readFileSync(PAGINA, "utf8"))).toEqual({ quantos: 1, dentroDeDetails: 0 });
  });
});
