import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// A GUARDA DO FUSO DO REMARCAR (spec 2026-10-19-enquadrar-imagens, achado 121). A página do post é de
// servidor e lê o banco, e o jsdom não roda o `<Script>` do Next: o comportamento do campo está em
// testes-dom/publicar-campo-do-fuso.dom.tsx, e aqui se cobra que o formulário do remarcar o usa, e não volta
// ao campo escondido preenchido por um `<Script>` de id fixo, que só roda uma vez por documento (medido).

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const ler = (rel: string) => readFileSync(`${RAIZ}/${rel}`, "utf8").replace(/\r\n/g, "\n");

describe("o remarcar da página do post", () => {
  const pagina = ler("app/publicar/post/[id]/page.tsx");

  it("o formulário do remarcar leva o campo do fuso de cliente", () => {
    expect(pagina).toMatch(/<form action=\{remarcarPublicacao\}(?:(?!<\/form>)[\s\S])*<CampoDoFuso name="fuso" \/>/);
  });

  it("e não o campo escondido preenchido pelo <Script>", () => {
    expect(pagina).not.toContain('<input type="hidden" name="fuso"');
    expect(pagina).not.toContain("next/script");
  });
});
