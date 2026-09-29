import { describe, expect, it } from "vitest";
import { detalheDe, MOTIVOS_DO_ENVIO } from "@/lib/bonus/desfecho";
import {
  quadroDoEnvio,
  textoDaConfig,
  textoDaRecusaDoPedido,
  textoDoEnvioRecusado,
  textoDoTeto,
  urlDoBonusComAviso,
} from "@/lib/bonus/textos";

describe("urlDoBonusComAviso", () => {
  it("leva texto E tom, senão todo aviso chega pintado de falha (lib/avisos.ts)", () => {
    expect(urlDoBonusComAviso(null, { tom: "ok", texto: "feito & pronto" })).toBe(
      "/bonus?aviso=feito%20%26%20pronto&tom=ok"
    );
    expect(urlDoBonusComAviso("0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f", { tom: "erro", texto: "x" })).toBe(
      "/bonus/0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f?aviso=x&tom=erro"
    );
  });
});

describe("toda saída tem frase", () => {
  it("cada motivo do envio tem título e texto", () => {
    for (const m of MOTIVOS_DO_ENVIO) {
      const q = quadroDoEnvio(m, detalheDe(null), "kit-de-lancamento");
      expect(q.titulo.length, m).toBeGreaterThan(5);
      expect(q.texto.length, m).toBeGreaterThan(10);
    }
  });

  it("o sucesso manda publicar ANTES de pôr o link numa automação", () => {
    const q = quadroDoEnvio("criado", detalheDe(null), "kit");
    expect(q.tom).toBe("ok");
    expect(q.texto).toContain("/admin do Labs");
    expect(q.texto).toMatch(/antes/i);
  });

  // O `duplicate` é um fato sobre o banco do Labs, e não sobre quem chama (contrato,
  // site-ia 485573e). Nenhuma frase pode afirmar que a nossa tentativa chegou, nem que
  // nada nosso foi criado: um "Não existe" clicado cedo demais solta a incerteza antes
  // de a tentativa incerta terminar de gravar (apontado pelo auditor).
  it("o criado pela duplicata é sucesso, manda conferir o conteúdo e não afirma a chegada", () => {
    const q = quadroDoEnvio("criado_pela_duplicata", detalheDe({ id: 7 }), "kit");
    expect(q.tom).toBe("ok");
    expect(q.texto).toContain("quase certamente");
    expect(q.texto).toContain("confira no /admin do Labs");
    expect(q.texto).toMatch(/antes/i);
    expect(q.texto).not.toMatch(/chegou/i);
  });

  it("o slug ocupado manda trocar o slug", () => {
    const q = quadroDoEnvio("slug_ocupado", detalheDe(null), "kit");
    expect(q.tom).toBe("erro");
    expect(q.texto).toContain("kit");
    expect(q.texto).toContain("outro título");
    expect(q.texto).toContain("Troque o slug");
  });

  it("nem a colisão nem o slug ocupado afirmam que nada foi criado", () => {
    for (const m of ["colisao", "slug_ocupado"] as const) {
      expect(quadroDoEnvio(m, detalheDe(null), "kit").texto, m).not.toMatch(/nada deste bônus foi criado/i);
    }
  });

  it("a incerteza diz que reenviar é seguro", () => {
    for (const m of ["timeout", "rede", "resposta_grande", "erro_do_labs", "fora_do_contrato"] as const) {
      expect(quadroDoEnvio(m, detalheDe(null), "kit").texto).toContain("Enviar de novo é seguro");
    }
  });

  it("o tema fora do catálogo lista os válidos", () => {
    const q = quadroDoEnvio("tema_fora_do_catalogo", detalheDe({ temasValidos: ["Marketing", "Vendas"] }), "kit");
    expect(q.texto).toContain("Marketing, Vendas");
  });

  it("recusas do pedido, teto, configuração e envio têm frase", () => {
    expect(textoDaRecusaDoPedido("palavra_invalida")).toContain("uma palavra só");
    expect(textoDoTeto()).toContain("5");
    expect(textoDaConfig("sem_segredo")).toContain("BONUS_INTAKE_SECRET");
    expect(textoDoEnvioRecusado({ tipo: "invalido", problemas: [{ campo: "slug", erro: "curto" }] })).toContain(
      "Endereço (slug): curto"
    );
  });
});
