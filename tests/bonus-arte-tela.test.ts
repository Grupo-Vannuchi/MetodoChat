import { describe, expect, it } from "vitest";
import {
  cabecalhoDaConta,
  cabecalhosDaArte,
  conferirPedidoDaArte,
  nomeDoArquivo,
  numeroDoSlide,
  urlDaArte,
  versaoDaArte,
} from "@/lib/bonus/arte-tela";
import { TEXTO_ARTE_NAO_ENCONTRADA, TEXTO_ARTE_NAO_PRONTA, TEXTO_ARTE_SLIDE_INVALIDO } from "@/lib/bonus/arte-textos";
import type { LinhaDoCarrossel } from "@/lib/bonus/carrossel-linha";

// O QUE A ROTA DA ARTE E A TELA DECIDEM, fora do JSX e da rota: o número do slide pedido, o nome do
// arquivo baixado, os cabeçalhos da resposta, o cabeçalho da peça e a versão da prévia.

const BONUS = "0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f";
const CARROSSEL = "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d";

describe("o número do slide pedido", () => {
  it.each([
    ["1", 10, 1],
    ["10", 10, 10],
    ["3", 3, 3],
  ])("%s de %i é o slide %i", (v, total, esperado) => {
    expect(numeroDoSlide(v, total)).toBe(esperado);
  });

  it.each([[null], [""], ["0"], ["11"], ["2.5"], ["-1"], ["1e1"], [" 2"], ["02"], ["abc"]])("%j de 10 é recusado", (v) => {
    expect(numeroDoSlide(v, 10)).toBeNull();
  });
});

describe("o arquivo baixado", () => {
  it("leva o endereço do bônus e o número do slide com dois dígitos", () => {
    expect(nomeDoArquivo("reativar-clientes-whatsapp", 3)).toBe("reativar-clientes-whatsapp-slide-03.png");
    expect(nomeDoArquivo("reativar-clientes-whatsapp", 10)).toBe("reativar-clientes-whatsapp-slide-10.png");
  });

  // O nome vai para dentro de um cabeçalho HTTP: só letras minúsculas, números e hífen passam.
  it("sem endereço, ou com caractere fora do padrão, não deixa nada passar para o cabeçalho", () => {
    expect(nomeDoArquivo(null, 1)).toBe("carrossel-slide-01.png");
    expect(nomeDoArquivo('ruim"; filename=x.exe', 2)).toBe("ruimfilenamexexe-slide-02.png");
  });
});

// ⚠️ A RESPOSTA NUNCA SAI COMO `public` (achado 59): fora do desenvolvimento, o ImageResponse de
// next/og responde `public, max-age=0, must-revalidate` (node_modules/next/dist/server/og/
// image-response.js), e os `headers` que se passam a ele sobrescrevem esse padrão. Imagem com
// texto do painel, atrás de sessão, não fica em cache nenhum.
describe("os cabeçalhos da resposta", () => {
  it("a prévia abre no navegador, sem cache", () => {
    expect(cabecalhosDaArte(false, "x-slide-01.png")).toEqual({
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline",
    });
  });

  it("o baixar vira download, com o nome do arquivo", () => {
    expect(cabecalhosDaArte(true, "x-slide-01.png")).toEqual({
      "Cache-Control": "private, no-store",
      "Content-Disposition": 'attachment; filename="x-slide-01.png"',
    });
  });
});

describe("o cabeçalho da peça", () => {
  const conta = { ig_user_id: "1001", username: "thiagovannuchi", name: "Thiago Vannuchi", profile_picture_url: null };

  it("o nome, o @ e a foto da conta", () => {
    expect(cabecalhoDaConta(conta, "data:image/jpeg;base64,AAAA")).toEqual({
      nome: "Thiago Vannuchi",
      arroba: "thiagovannuchi",
      foto: "data:image/jpeg;base64,AAAA",
      iniciais: "TV",
    });
  });

  it("sem nome, o @ faz as vezes de nome; sem foto, ficam as iniciais", () => {
    expect(cabecalhoDaConta({ ...conta, name: null }, null)).toEqual({
      nome: "thiagovannuchi",
      arroba: "thiagovannuchi",
      foto: null,
      iniciais: "TH",
    });
  });
});

// A VERSÃO DA PRÉVIA leva TUDO o que muda a imagem: a `<img>` só pede de novo quando a URL muda, e
// a rota responde `no-store`, então quem decide se a miniatura troca é esta versão.
describe("a versão da prévia", () => {
  it("é a mesma para as mesmas partes, e muda quando qualquer uma muda", () => {
    const partes = ["2026-10-01T12:00:00.000Z", '{"soTexto":[2]}', "Thiago Vannuchi", "thiagovannuchi", "https://foto"];
    const v = versaoDaArte(partes);
    expect(versaoDaArte([...partes])).toBe(v);
    for (let i = 0; i < partes.length; i++) {
      const outra = [...partes];
      outra[i] = `${outra[i]}!`;
      expect(versaoDaArte(outra), `parte ${i}`).not.toBe(v);
    }
    expect(v).toMatch(/^[0-9a-f]{8}$/);
  });

  it("o endereço da miniatura e o do baixar", () => {
    expect(urlDaArte(BONUS, CARROSSEL, 2, "abcd1234")).toBe(`/bonus/${BONUS}/carrossel/${CARROSSEL}/arte?slide=2&v=abcd1234`);
    expect(urlDaArte(BONUS, CARROSSEL, 2, "abcd1234", true)).toBe(
      `/bonus/${BONUS}/carrossel/${CARROSSEL}/arte?slide=2&v=abcd1234&baixar=1`
    );
  });
});

// O QUE A ROTA CONFERE ANTES DE DESENHAR, depois da sessão e dos ids: o carrossel existe e é do
// bônus da URL, está pronto com texto de forma válida, e o slide pedido existe nele. A rota só se
// prova sem sessão na integração (o harness não forja cookie); estas recusas se provam aqui.
describe("o que a rota confere antes de desenhar", () => {
  const TEXTO = {
    tipo: "carrossel" as const,
    titulo: "Nome interno",
    gancho: "Seu cliente sumiu? Não é culpa dele.",
    slides: [{ titulo: "O que fazer primeiro", texto: "Mande uma mensagem curta, lembrando do que ele comprou." }],
    chamada: "Comente SUMIDO e receba as mensagens prontas.",
    legenda: "x".repeat(100),
  };
  const linha = (troca: Partial<LinhaDoCarrossel> = {}): LinhaDoCarrossel => ({
    id: CARROSSEL,
    bonus_id: BONUS,
    criado_em: new Date(0),
    total_slides: 3,
    palavra: "SUMIDO",
    contexto: {},
    estado: "pronto",
    gerado: TEXTO,
    revisado: null,
    erro: null,
    medicao: null,
    gerado_em: new Date(0),
    revisado_em: null,
    arte: {},
    ...troca,
  });

  it("o carrossel pronto e o slide que existe: os slides e o número", () => {
    const r = conferirPedidoDaArte(linha(), BONUS, "2");
    expect(r.ok && [r.numero, r.slides.length, r.slides[1].titulo]).toEqual([2, 3, "O que fazer primeiro"]);
  });

  it("o revisado vale sobre o gerado", () => {
    const revisado = { ...TEXTO, gancho: "O gancho revisado pelo operador." };
    const r = conferirPedidoDaArte(linha({ revisado }), BONUS, "1");
    expect(r.ok && r.slides[0].texto).toBe("O gancho revisado pelo operador.");
  });

  it.each([
    ["o carrossel que não existe", null as LinhaDoCarrossel | null, BONUS, "1", 404, TEXTO_ARTE_NAO_ENCONTRADA],
    ["o carrossel de outro bônus", linha({ bonus_id: "9f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f" }), BONUS, "1", 404, TEXTO_ARTE_NAO_ENCONTRADA],
    ["o carrossel ainda gerando", linha({ estado: "gerando", gerado: null }), BONUS, "1", 409, TEXTO_ARTE_NAO_PRONTA],
    ["o pronto com texto de forma errada", linha({ gerado: { tipo: "carrossel" } }), BONUS, "1", 409, TEXTO_ARTE_NAO_PRONTA],
    ["o slide além do total", linha(), BONUS, "4", 400, TEXTO_ARTE_SLIDE_INVALIDO],
    ["o slide que não é número", linha(), BONUS, "x", 400, TEXTO_ARTE_SLIDE_INVALIDO],
  ])("recusa %s", (_nome, l, bonus, slide, status, texto) => {
    expect(conferirPedidoDaArte(l, bonus, slide)).toEqual({ ok: false, status, texto });
  });
});
