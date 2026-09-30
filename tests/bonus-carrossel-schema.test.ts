import { describe, expect, it } from "vitest";
import { CarrosselDoChatSchema, PostDoChatSchema } from "@/lib/bonus/carrossel-schema";

const slide = (i: number) => ({
  titulo: `Título do slide ${i}`,
  texto: `Texto do slide ${i}, com mais de trinta caracteres.`,
});
const CARROSSEL = {
  titulo: "Mensagens para reativar clientes",
  gancho: "Seu cliente sumiu? Não é culpa dele.",
  slides: Array.from({ length: 8 }, (_, i) => slide(i)),
  chamadaParaAcao: "Comente SUMIDO e receba as mensagens prontas.",
  legenda: "L".repeat(100),
};
const POST = {
  titulo: "Mensagens para reativar clientes",
  texto: "T".repeat(80),
  chamadaParaAcao: "Comente SUMIDO e receba as mensagens prontas.",
  legenda: "L".repeat(100),
};

describe("o formato do carrossel no Chat", () => {
  it.each([0, 1, 8])("aceita %i slides de conteúdo (total de 2 a 10)", (n) => {
    expect(CarrosselDoChatSchema.safeParse({ ...CARROSSEL, slides: CARROSSEL.slides.slice(0, n) }).success).toBe(true);
  });

  it("recusa 9 slides de conteúdo: passaria de 10 no total", () => {
    expect(CarrosselDoChatSchema.safeParse({ ...CARROSSEL, slides: [...CARROSSEL.slides, slide(9)] }).success).toBe(
      false
    );
  });

  it("mantém os tetos do Labs, que vêm da arte", () => {
    expect(CarrosselDoChatSchema.safeParse({ ...CARROSSEL, gancho: "g".repeat(121) }).success).toBe(false);
    expect(
      CarrosselDoChatSchema.safeParse({ ...CARROSSEL, slides: [{ titulo: "t".repeat(71), texto: slide(0).texto }] })
        .success
    ).toBe(false);
    expect(
      CarrosselDoChatSchema.safeParse({ ...CARROSSEL, slides: [{ titulo: slide(0).titulo, texto: "x".repeat(301) }] })
        .success
    ).toBe(false);
  });
});

describe("o formato do post de imagem única no Chat", () => {
  it("aceita o post com a chamada", () => {
    expect(PostDoChatSchema.safeParse(POST).success).toBe(true);
  });

  it("recusa o post sem chamada: aqui todo post leva a um bônus", () => {
    const semChamada = { titulo: POST.titulo, texto: POST.texto, legenda: POST.legenda };
    expect(PostDoChatSchema.safeParse(semChamada).success).toBe(false);
  });

  it("o texto da imagem tem o teto de 300 do Labs", () => {
    expect(PostDoChatSchema.safeParse({ ...POST, texto: "T".repeat(301) }).success).toBe(false);
  });
});
