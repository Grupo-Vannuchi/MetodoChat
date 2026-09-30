import { describe, expect, it } from "vitest";
import type { LinhaDoBonus } from "@/lib/bonus/linha";
import {
  corpoCongelado,
  envioNaTela,
  quadroDaLinha,
  rotuloDaLinha,
  tituloDaLinha,
  valoresDoFormulario,
} from "@/lib/bonus/tela";
import { ENVIO_PARADO_MS, TRAVADA_MS } from "@/lib/bonus/tempos";

const T0 = Date.parse("2026-09-29T12:00:00Z");
const GERADO = {
  titulo: "Kit de lançamento em 7 dias",
  slug: "kit-de-lancamento",
  palavraChave: "EDUCAIA",
  descricao:
    "Um cronograma de sete dias para lançar um produto sem travar na véspera, com o que fazer e o que conferir em cada dia.",
  intro:
    "Use quando tiver data de lançamento marcada. Preencha o produto e o público, cole no ChatGPT e receba o cronograma dia a dia.",
  prompt: "Aja como um estrategista de lançamento. ".repeat(12),
};

function linha(troca: Partial<LinhaDoBonus> = {}): LinhaDoBonus {
  return {
    id: "0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f",
    criado_em: new Date(T0),
    tema: "Marketing",
    o_que_resolve: "Montar um cronograma de lançamento em 7 dias",
    palavra_digitada: null,
    estado: "pronto",
    gerado: GERADO,
    revisado: null,
    erro: null,
    medicao: null,
    gerado_em: new Date(T0),
    slug: null,
    corpo_enviado: null,
    envio_estado: null,
    incerto_pendente: false,
    conferido_pelo_operador: false,
    envio_resposta: null,
    tentativas: 0,
    envio_iniciado_em: null,
    enviado_em: null,
    ...troca,
  };
}

describe("envioNaTela e corpoCongelado", () => {
  it("envio recente continua enviando; preso vira incerto, e o corpo já aparece travado", () => {
    const recente = linha({ envio_estado: "enviando", envio_iniciado_em: new Date(T0) });
    expect(envioNaTela(recente, T0 + 1_000)).toBe("enviando");
    expect(envioNaTela(recente, T0 + ENVIO_PARADO_MS + 1)).toBe("incerto");
    expect(corpoCongelado(recente)).toBe(true);
  });

  it("sem envio, nada congelado", () => {
    expect(envioNaTela(linha(), T0)).toBe("nao_enviado");
    expect(corpoCongelado(linha())).toBe(false);
  });
});

describe("valoresDoFormulario", () => {
  it("do gerado, com a palavra DIGITADA vencendo a da IA", () => {
    const v = valoresDoFormulario(linha({ palavra_digitada: "IAKIDS" }));
    expect(v?.palavra).toBe("IAKIDS");
    expect(v?.tema).toBe("Marketing");
  });

  it("sem digitada, a da IA", () => {
    expect(valoresDoFormulario(linha())?.palavra).toBe("EDUCAIA");
  });

  it("o revisado (o que foi ao Labs) vence o gerado", () => {
    const revisado = { titulo: "Editado", slug: "editado", palavra: "EDITADO", descricao: "d", intro: "", prompt: "p", tema: "Vendas" };
    expect(valoresDoFormulario(linha({ revisado }))).toEqual(revisado);
  });

  it("gerado fora da forma: nada, e a tela diz isso", () => {
    expect(valoresDoFormulario(linha({ gerado: { titulo: 1 } }))).toBeNull();
  });
});

describe("quadroDaLinha", () => {
  it("sem envio, sem quadro", () => {
    expect(quadroDaLinha(linha(), T0)).toBeNull();
  });

  it("envio preso: diz que não se sabe, e que reenviar é seguro", () => {
    const q = quadroDaLinha(linha({ envio_estado: "enviando", envio_iniciado_em: new Date(T0) }), T0 + ENVIO_PARADO_MS + 1);
    expect(q?.texto).toContain("Enviar de novo é seguro");
  });

  it("lê o motivo gravado", () => {
    const q = quadroDaLinha(linha({ envio_estado: "colisao", slug: "kit", envio_resposta: { motivo: "colisao", status: 200 } }), T0);
    expect(q?.tom).toBe("erro");
    expect(q?.texto).toContain("kit");
  });
});

describe("rotuloDaLinha e tituloDaLinha", () => {
  it("geração travada aparece como travou", () => {
    expect(rotuloDaLinha(linha({ estado: "gerando" }), T0 + TRAVADA_MS + 1)).toEqual({ texto: "Travou", tipo: "erro" });
  });

  it("criado aparece como criado no Labs, sem afirmar que segue oculto", () => {
    expect(rotuloDaLinha(linha({ envio_estado: "criado" }), T0)).toEqual({ texto: "Criado no Labs", tipo: "ok" });
  });

  it("o título vem do gerado, e sem ele, do tema", () => {
    expect(tituloDaLinha(linha())).toBe("Kit de lançamento em 7 dias");
    expect(tituloDaLinha(linha({ gerado: null }))).toBe("Marketing");
  });
});
