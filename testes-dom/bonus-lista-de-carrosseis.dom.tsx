import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ListaDeCarrosseis, { type LinhaDaLista } from "@/app/carrosseis/lista";
import { ABAS, type AbaDosCarrosseis } from "@/lib/bonus/carrosseis-tela";

// A LISTA "CARROSSÉIS" NA TELA (spec da Etapa 10, "A lista"): as três abas com a contagem, a aberta
// marcada, a capa à esquerda de cada linha (ou o quadro vazio), o selo da aba à direita, e a frase da aba
// vazia. O que cada linha diz é decidido fora do JSX (carrosseis-tela.ts); aqui, só o desenho.

const CAPA = "/carrosseis/1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d/arte?slide=1&v=0a1b2c3d";
const LINHAS: LinhaDaLista[] = [
  {
    item: {
      id: "c1",
      href: "/carrosseis/c1",
      titulo: "Conselheiro brutalmente honesto",
      origem: "Texto livre: Produtividade",
      detalhe: "@thiagovannuchi · Carrossel de 5 slides",
      criado: "07/10/2026, 09:00",
      selos: [{ texto: "Não publicou", tipo: "erro" }],
    },
    capa: CAPA,
  },
  {
    item: {
      id: "c2",
      href: "/bonus/b1/carrossel/c2",
      titulo: "Carrossel de 10 slides",
      origem: "Bônus do Chat",
      detalhe: "Carrossel de 10 slides",
      criado: "08/10/2026, 14:30",
      selos: [{ texto: "Gerando", tipo: "neutro" }],
    },
    capa: null,
  },
];
const CONTAGEM = { rascunhos: 2, agendados: 1, publicados: 0 };

const renderizar = (aba: AbaDosCarrosseis = "rascunhos", linhas = LINHAS) =>
  render(<ListaDeCarrosseis aba={aba} contagem={CONTAGEM} linhas={linhas} />);
const aba = (nome: string) => screen.getByRole("link", { name: nome });
const linha = (titulo: string) => screen.getByText(titulo).closest("a") as HTMLAnchorElement;

describe("as abas", () => {
  it("as três, com a contagem e o endereço de cada uma", () => {
    renderizar();
    expect(aba("Rascunhos (2)").getAttribute("href")).toBe("/carrosseis?aba=rascunhos");
    expect(aba("Agendados (1)").getAttribute("href")).toBe("/carrosseis?aba=agendados");
    expect(aba("Publicados (0)").getAttribute("href")).toBe("/carrosseis?aba=publicados");
  });

  it.each(["rascunhos", "agendados", "publicados"] as const)("a aberta (%s) fica marcada, e só ela", (aberta) => {
    renderizar(aberta, []);
    const marcadas = screen.getAllByRole("link").filter((l) => l.getAttribute("aria-current") === "page");
    expect(marcadas.map((l) => l.getAttribute("href"))).toEqual([`/carrosseis?aba=${aberta}`]);
  });
});

describe("as linhas", () => {
  it("cada linha leva à página do carrossel, com o título, a origem, a conta, os slides e a data", () => {
    renderizar();
    expect(linha("Conselheiro brutalmente honesto").getAttribute("href")).toBe("/carrosseis/c1");
    expect(linha("Carrossel de 10 slides").getAttribute("href")).toBe("/bonus/b1/carrossel/c2");
    expect(screen.getByText("Texto livre: Produtividade · @thiagovannuchi · Carrossel de 5 slides · 07/10/2026, 09:00")).toBeTruthy();
  });

  it("a capa à esquerda: a miniatura do slide 1, 4:5, carregada só quando aparece", () => {
    renderizar();
    const img = linha("Conselheiro brutalmente honesto").querySelector("img") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe(CAPA);
    expect(img.getAttribute("loading")).toBe("lazy");
    expect([img.getAttribute("width"), img.getAttribute("height")]).toEqual(["48", "60"]);
  });

  it("sem capa (gerando, travado ou falhado): o quadro vazio no lugar", () => {
    renderizar();
    const sem = linha("Carrossel de 10 slides");
    expect(sem.querySelector("img")).toBeNull();
    expect(sem.querySelector('[data-capa="vazia"]')).not.toBeNull();
  });

  it("o selo da aba à direita, com a cor do tipo", () => {
    renderizar();
    expect(within(linha("Conselheiro brutalmente honesto")).getByText("Não publicou").className).toMatch(/red/);
    expect(within(linha("Carrossel de 10 slides")).getByText("Gerando")).toBeTruthy();
  });
});

describe("a aba vazia", () => {
  it.each(ABAS.map((a) => [a.aba, a.vazia] as const))("%s diz: %s", (aberta, frase) => {
    renderizar(aberta, []);
    expect(screen.getByText(frase)).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
  });
});
