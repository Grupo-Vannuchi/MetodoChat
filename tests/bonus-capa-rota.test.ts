import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { slidesDoTexto } from "@/lib/bonus/arte-slides";
import type { LinhaDoCarrossel } from "@/lib/bonus/carrossel-linha";
import type { TextoDeCarrossel } from "@/lib/bonus/carrossel-texto";
import { versaoDoDesenho } from "@/lib/bonus/publicar-regras";

// A ROTA DA ARTE ESCOLHE A CAPA (spec da Etapa 11, "Onde ela fica" e "Por dentro"): no slide 1 em capa, ela
// busca só a imagem do jeito capa (`fotoDaCapa`), desenha a capa e manda a versão do desenho com o
// caminho dela; a imagem de outro jeito não conta, e nada é buscado. O desenho é o comum às duas rotas da
// arte (lib/bonus/arte-rota.ts, a do bônus e a do avulso). As contas e as buscas são falsas aqui: a rota
// lê o banco e o bucket, e o que se confere é a escolha. O desenho de verdade está em
// tests/bonus-capa-desenho.test.ts.

const CONTA = "17841400000000001";
const UUID = "0b2f4c1e-7a9d-4e3b-9c5f-1d2e3f4a5b6c";
const CAPA = `${CONTA}/bonus-capa/${UUID}.jpg`;
const FOTO = `${CONTA}/bonus-foto/${UUID}.jpg`;
const IMAGEM = `data:image/svg+xml;base64,${Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350"><rect width="1080" height="1350" fill="#FF0000"/></svg>'
).toString("base64")}`;

const buscas = vi.hoisted(() => ({ capa: [] as string[], espaco: [] as string[] }));
vi.mock("@/lib/bonus/carrossel-repositorio", () => ({
  contasParaArte: async () => [{ ig_user_id: "17841400000000001", username: "thiagovannuchi", name: "Thiago Vannuchi", profile_picture_url: null }],
}));
vi.mock("@/lib/bonus/arte-foto", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/bonus/arte-foto")>();
  return {
    ...real,
    fotoDaCapa: async (caminho: string) => {
      buscas.capa.push(caminho);
      return IMAGEM;
    },
    fotoDoEspaco: async (caminho: string) => {
      buscas.espaco.push(caminho);
      return IMAGEM;
    },
  };
});

const { desenharSlide } = await import("@/lib/bonus/arte-rota");

const TEXTO: TextoDeCarrossel = {
  tipo: "carrossel",
  titulo: "",
  gancho: "Seu cliente sumiu? Não é culpa dele.",
  slides: [{ titulo: "Um", texto: "Texto do slide." }],
  chamada: "Comente SUMIDO e receba as mensagens.",
  legenda: "x".repeat(100),
};
const SLIDES = slidesDoTexto(TEXTO);

const linha = (arte: Record<string, unknown>): LinhaDoCarrossel => ({
  id: "c0000000-0000-4000-8000-000000000001",
  bonus_id: null,
  criado_em: new Date(),
  total_slides: SLIDES.length,
  palavra: "SUMIDO",
  contexto: {},
  estado: "pronto",
  gerado: TEXTO,
  revisado: null,
  erro: null,
  medicao: null,
  gerado_em: new Date(),
  revisado_em: null,
  arte: { conta: CONTA, nome: "Thiago Vannuchi", arroba: "thiagovannuchi", ...arte },
  origem: "livre",
  labs_codigo: null,
  texto_a_mao: true,
  acao_da_chamada: null,
});

const desenhar = (arte: Record<string, unknown>, numero = 1) =>
  desenharSlide({ linha: linha(arte), slides: SLIDES, numero, doCookie: undefined, baixar: false, slug: async () => null });

beforeEach(() => {
  buscas.capa.length = 0;
  buscas.espaco.length = 0;
});

describe("a rota da arte com a capa", () => {
  it("a capa com a imagem dela: busca só a da capa, e manda a versão do desenho com o caminho", async () => {
    const r = await desenhar({ capa: true, imagens: { "1": { caminho: CAPA, versao: "v" } } });
    expect(r.status).toBe(200);
    expect(buscas).toEqual({ capa: [CAPA], espaco: [] });
    expect(r.headers.get("x-arte-foto")).toBe("sim");
    expect(r.headers.get("x-arte-versao")).toBe(versaoDoDesenho(SLIDES[0], CAPA));
  }, 60_000);

  it("a capa sem imagem desenha o fundo escuro, sem busca e sem versão: ela não se publica", async () => {
    const r = await desenhar({ capa: true });
    expect(r.status).toBe(200);
    expect(buscas).toEqual({ capa: [], espaco: [] });
    expect(r.headers.get("x-arte-foto")).toBeNull();
    expect(r.headers.get("x-arte-versao")).toBeNull();
  }, 60_000);

  it("a foto do espaço guardada no slide 1 não conta com a capa ligada", async () => {
    const r = await desenhar({ capa: true, imagens: { "1": { caminho: FOTO, versao: "v" } } });
    expect(buscas).toEqual({ capa: [], espaco: [] });
    expect(r.headers.get("x-arte-versao")).toBeNull();
  }, 60_000);

  it("a imagem da capa guardada no slide 1 não conta com a capa desligada: o espaço sai em branco", async () => {
    const r = await desenhar({ imagens: { "1": { caminho: CAPA, versao: "v" } } });
    expect(buscas).toEqual({ capa: [], espaco: [] });
    expect(r.headers.get("x-arte-foto")).toBeNull();
    expect(r.headers.get("x-arte-versao")).toBeNull();
  }, 60_000);

  it("os outros slides não mudam com a capa: a foto do slide 2 é a foto do espaço", async () => {
    const r = await desenhar({ capa: true, imagens: { "2": { caminho: FOTO, versao: "v" } } }, 2);
    expect(buscas).toEqual({ capa: [], espaco: [FOTO] });
    expect(r.headers.get("x-arte-versao")).toBe(versaoDoDesenho(SLIDES[1], FOTO));
  }, 60_000);
});

// AS GUARDAS DA CAPA, no molde das de tests/bonus-arte-paginas.test.ts: a imagem da capa vem de
// `capaDaArte` e de `fotoDaCapa` (a conferência do caminho e a memória), e nenhuma das duas rotas da
// arte a busca por conta própria.
describe("de onde a rota tira a imagem da capa", () => {
  const ler = (f: string) => readFileSync(f, "utf8");
  it("o desenho comum a tira de capaDaArte e de fotoDaCapa", () => {
    const desenho = ler("lib/bonus/arte-rota.ts");
    expect(desenho).toContain("capaDaArte(");
    expect(desenho).toContain("fotoDaCapa(");
  });

  it("nenhuma rota da arte busca a capa por conta própria", () => {
    for (const rota of ["app/bonus/[id]/carrossel/[cid]/arte/route.tsx", "app/carrosseis/[cid]/arte/route.tsx"]) {
      expect(ler(rota), rota).not.toMatch(/\b(fotoDaCapa|capaDaArte)\b/);
    }
  });
});
