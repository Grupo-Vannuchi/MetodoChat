import { describe, expect, it } from "vitest";
import {
  avisoDoPostNoLinkedin,
  disponibilidadeDoLinkedin,
  LIMITE_DO_TEXTO_DO_LINKEDIN,
  novoIdDoEnvio,
  recusaDoPedidoNoLinkedin,
  tamanhoDoTextoNoLinkedin,
  textoDaRecusaNoLinkedin,
  textoDoProblemaDoCarrosselNoLinkedin,
} from "@/lib/linkedin-publicacao";

// O COMPOR DO POST NO LINKEDIN (docs/specs/2026-11-06-linkedin-no-perfil.md, §7; a parte 2a). A tela confere o
// pedido antes de subir o arquivo, e a action confere de novo no servidor, pela MESMA função
// (`recusaDoPedidoNoLinkedin`), que conta o texto pela mesma `tamanhoDoTextoNoLinkedin` do contador.

const ENVIO = "9f1c2e3d-0000-4000-8000-000000000001";
const pedido = (p: Partial<Parameters<typeof recusaDoPedidoNoLinkedin>[0]> = {}) =>
  recusaDoPedidoNoLinkedin({ forma: "texto", caminhos: [], texto: "Olá #mundo", idDoEnvio: ENVIO, ...p });

describe("as recusas do pedido de publicar no LinkedIn", () => {
  it("o pedido certo passa, nas três formas", () => {
    expect(pedido()).toBeNull();
    expect(pedido({ forma: "imagem", caminhos: ["conta/foto.jpg"] })).toBeNull();
    expect(pedido({ forma: "carrossel", caminhos: ["conta/a.jpg", "conta/b.jpg"] })).toBeNull();
  });

  it("a forma que não é do LinkedIn", () => {
    expect(pedido({ forma: null })).toBe("forma_desconhecida");
  });

  it("a quantidade de arquivos é a da forma: o só texto não leva arquivo, a imagem leva um", () => {
    expect(pedido({ caminhos: ["conta/foto.jpg"] })).toBe("quantidade");
    expect(pedido({ forma: "imagem", caminhos: [] })).toBe("quantidade");
    expect(pedido({ forma: "imagem", caminhos: ["conta/a.jpg", "conta/b.jpg"] })).toBe("quantidade");
  });

  it("o carrossel leva de 2 a 10 fotos", () => {
    expect(pedido({ forma: "carrossel", caminhos: ["conta/a.jpg"] })).toBe("quantidade");
    expect(pedido({ forma: "carrossel", caminhos: Array(11).fill("conta/a.jpg") })).toBe("quantidade");
    expect(pedido({ forma: "carrossel", caminhos: Array(10).fill("conta/a.jpg") })).toBeNull();
  });

  // O PDF DO CARROSSEL SÓ LEVA FOTOS (a parte 3a). O carrossel do Instagram aceita vídeo nos itens; o do LinkedIn não.
  // O vídeo é reconhecido pela extensão do caminho, como o dreno do Instagram decide (`pareceVideo`, lib/publicacao.ts).
  it("o carrossel com vídeo não vai ao LinkedIn, com a frase da tela", () => {
    expect(pedido({ forma: "carrossel", caminhos: ["conta/a.jpg", "conta/b.mp4"] })).toBe("carrossel_com_video");
    expect(pedido({ forma: "carrossel", caminhos: ["conta/a.mov", "conta/b.jpg"] })).toBe("carrossel_com_video");
    // A quantidade vem antes: um vídeo sozinho já não é carrossel.
    expect(pedido({ forma: "carrossel", caminhos: ["conta/b.mp4"] })).toBe("quantidade");
    expect(textoDaRecusaNoLinkedin("carrossel_com_video")).toBe(textoDoProblemaDoCarrosselNoLinkedin("video"));
  });

  it("o texto vazio, nas duas formas", () => {
    expect(pedido({ texto: "   " })).toBe("texto_vazio");
    expect(pedido({ forma: "imagem", caminhos: ["conta/foto.jpg"], texto: "" })).toBe("texto_vazio");
  });

  it("o texto longo é contado depois das hashtags e dos escapes, como o contador da tela", () => {
    // 2.990 letras e duas hashtags: 2.998 caracteres digitados, e bem mais de 3.000 no LinkedIn.
    const texto = `${"a".repeat(2990)} #ab #cd`;
    expect(Array.from(texto).length).toBeLessThanOrEqual(LIMITE_DO_TEXTO_DO_LINKEDIN);
    expect(tamanhoDoTextoNoLinkedin(texto)).toBeGreaterThan(LIMITE_DO_TEXTO_DO_LINKEDIN);
    expect(pedido({ texto })).toBe("texto_longo");
    expect(pedido({ texto: "a".repeat(LIMITE_DO_TEXTO_DO_LINKEDIN) })).toBeNull();
  });

  it("o envio sem o id que a tela gera", () => {
    expect(pedido({ idDoEnvio: "" })).toBe("envio_sem_id");
    expect(pedido({ idDoEnvio: "nao-e-um-id" })).toBe("envio_sem_id");
  });

  it("o id que a tela gera passa, e cada formulário tem o seu", () => {
    const ids = Array.from({ length: 50 }, novoIdDoEnvio);
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(pedido({ idDoEnvio: id })).toBeNull();
    }
    expect(new Set(ids).size).toBe(50);
  });

  it("cada recusa tem a sua frase, e a do texto longo diz por que conta mais", () => {
    const frases = (
      ["forma_desconhecida", "quantidade", "carrossel_com_video", "texto_vazio", "texto_longo", "envio_sem_id"] as const
    ).map(textoDaRecusaNoLinkedin);
    expect(new Set(frases).size).toBe(6);
    expect(textoDaRecusaNoLinkedin("texto_longo")).toContain("3.000");
    expect(textoDaRecusaNoLinkedin("texto_longo")).toContain("hashtags");
    expect(textoDaRecusaNoLinkedin("forma_desconhecida")).toBe("Escolha a forma do post no LinkedIn: só texto, imagem ou carrossel.");
    expect(textoDaRecusaNoLinkedin("quantidade")).toBe(
      "O post do LinkedIn com imagem leva uma imagem, o carrossel leva de 2 a 10 fotos, e o só texto não leva arquivo."
    );
  });
});

describe("o LinkedIn da conta, na tela de compor", () => {
  const agora = Date.parse("2026-11-10T12:00:00Z");

  it("sem conexão, ele fica desligado, com o motivo", () => {
    const d = disponibilidadeDoLinkedin(null, agora);
    expect(d.disponivel).toBe(false);
    expect(!d.disponivel && d.motivo).toContain("não tem LinkedIn conectado");
  });

  it("vencido, ele fica desligado, com o nome e o que fazer", () => {
    const d = disponibilidadeDoLinkedin({ nome: "Dra. Ana", expira_em: new Date(agora - 1000) }, agora);
    expect(d.disponivel).toBe(false);
    expect(!d.disponivel && d.motivo).toContain("Dra. Ana");
    expect(!d.disponivel && d.motivo).toContain("venceu");
  });

  it("dentro da validade, ele fica ligado, com o nome", () => {
    expect(disponibilidadeDoLinkedin({ nome: "Dra. Ana", expira_em: "2026-12-10T12:00:00Z" }, agora)).toEqual({
      disponivel: true,
      nome: "Dra. Ana",
    });
  });
});

describe("o aviso depois de publicar no LinkedIn", () => {
  it("agora, publicado", () => {
    expect(avisoDoPostNoLinkedin({ desfecho: "publicado", agendadoPara: null })).toEqual({
      tom: "ok",
      texto: "Post publicado no LinkedIn.",
    });
  });

  it("agora, na fila: vai sair em instantes (também quando outro dreno o pegou antes)", () => {
    for (const desfecho of ["aguardando", null] as const) {
      const a = avisoDoPostNoLinkedin({ desfecho, agendadoPara: null });
      expect(a.tom).toBe("ok");
      expect(a.texto).toContain("vai sair em instantes");
    }
  });

  it("agora, falhou: o motivo vai junto", () => {
    const a = avisoDoPostNoLinkedin({ desfecho: "falhou", motivo: "LinkedIn 403: sem permissão", agendadoPara: null });
    expect(a.tom).toBe("erro");
    expect(a.texto).toContain("LinkedIn 403: sem permissão");
  });

  it("agendado: a hora escolhida, com dois dígitos", () => {
    expect(avisoDoPostNoLinkedin({ desfecho: null, agendadoPara: { dia: 5, mes: 12, hora: 9, minuto: 7 } })).toEqual({
      tom: "ok",
      texto: "Post do LinkedIn agendado para 05/12 às 09:07. Acompanhe em Publicações.",
    });
  });
});
