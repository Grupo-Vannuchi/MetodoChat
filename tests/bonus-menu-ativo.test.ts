import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { itemDoMenuAtivo } from "@/lib/bonus/menu-ativo";

// O ITEM MARCADO NO MENU (spec da Etapa 10, adendo de 13/10): o carrossel de bônus mora embaixo do bônus
// (`/bonus/<id>/carrossel/<cid>`), mas é do menu "Carrosséis", como o avulso. Todo o resto fica como era:
// "/" só na raiz, e os outros itens pelo começo do endereço.

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
/** Os endereços do menu, lidos do próprio app/app-shell.tsx: o teste acompanha o menu de verdade. */
const ITENS = [...readFileSync(`${RAIZ}/app/app-shell.tsx`, "utf8").matchAll(/\{ href: "([^"]+)", label:/g)].map((m) => m[1]);
const BONUS = "0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f";
const CARROSSEL = "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d";

const marcados = (pathname: string) => ITENS.filter((href) => itemDoMenuAtivo(href, pathname));

describe("o item marcado no menu", () => {
  it("o menu tem o Bônus e os Carrosséis (o teste lê os itens do app-shell)", () => {
    expect(ITENS).toEqual(expect.arrayContaining(["/", "/bonus", "/carrosseis", "/publicar"]));
    expect(ITENS.length).toBeGreaterThan(5);
  });

  it("o bônus e a página dele marcam Bônus", () => {
    expect(marcados("/bonus")).toEqual(["/bonus"]);
    expect(marcados(`/bonus/${BONUS}`)).toEqual(["/bonus"]);
  });

  it("o carrossel de bônus marca Carrosséis, e não Bônus", () => {
    expect(marcados(`/bonus/${BONUS}/carrossel/${CARROSSEL}`)).toEqual(["/carrosseis"]);
    expect(marcados(`/bonus/${BONUS}/carrossel/${CARROSSEL}/arte`)).toEqual(["/carrosseis"]);
    expect(marcados(`/bonus/${BONUS}/carrossel`)).toEqual(["/carrosseis"]);
  });

  it("o caminho que só começa igual não é carrossel: o segmento inteiro conta", () => {
    expect(marcados(`/bonus/${BONUS}/carrosselX`)).toEqual(["/bonus"]);
    expect(marcados(`/bonus/${BONUS}/carrosseis`)).toEqual(["/bonus"]);
    expect(marcados(`/bonus/carrossel/${CARROSSEL}`)).toEqual(["/bonus"]);
  });

  it("a lista, o novo carrossel e o avulso marcam Carrosséis", () => {
    for (const p of ["/carrosseis", "/carrosseis/novo", `/carrosseis/${CARROSSEL}`]) expect(marcados(p)).toEqual(["/carrosseis"]);
  });

  it('o "/" só marca na raiz', () => {
    expect(marcados("/")).toEqual(["/"]);
    expect(marcados("/contatos")).not.toContain("/");
  });

  it("os outros itens ficam como eram: pelo começo do endereço", () => {
    for (const href of ITENS.filter((h) => h !== "/")) {
      for (const p of [href, `${href}/x`, "/", "/outra-coisa"]) {
        expect(itemDoMenuAtivo(href, p), `${href} em ${p}`).toBe(p.startsWith(href));
      }
    }
  });

  it("nunca dois itens marcados ao mesmo tempo", () => {
    const caminhos = [...ITENS, ...ITENS.map((h) => `${h}/x`), `/bonus/${BONUS}/carrossel/${CARROSSEL}`, `/bonus/${BONUS}/carrosselX`];
    for (const p of caminhos) expect(marcados(p).length, p).toBeLessThanOrEqual(1);
  });
});
