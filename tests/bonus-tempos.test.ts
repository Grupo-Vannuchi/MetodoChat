import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CONEXAO_MAX_MS,
  DESISTIR_MS,
  ENVIO_PARADO_MS,
  MAX_DURATION_S,
  TIMEOUT_ENVIO_MS,
  TIMEOUT_IA_MS,
  TRAVADA_MS,
  geracaoNaTela,
} from "@/lib/bonus/tempos";

// A ORDEM ENTRE OS RELÓGIOS É O INVARIANTE. No Labs ela quebrou calada em 27/08:
// o cliente desistia no mesmo instante em que a API estourava, e o ramo "travou"
// da tela era inalcançável (site-ia, src/lib/ia/tempos.ts).
describe("a ordem dos relógios", () => {
  it("a chamada de IA termina antes de a linha ser dada como travada", () => {
    expect(TIMEOUT_IA_MS).toBeLessThan(TRAVADA_MS);
  });

  it("a tela desiste depois de a linha virar travada, senão 'travou' nunca aparece", () => {
    expect(TRAVADA_MS).toBeLessThan(DESISTIR_MS);
  });

  it("a chamada cabe no teto da página, com 30 s para o after() começar e gravar", () => {
    expect(TIMEOUT_IA_MS + 30_000).toBeLessThanOrEqual(MAX_DURATION_S * 1000);
  });

  it("o envio só é dado como preso depois de a action inteira poder ter terminado", () => {
    // Conexão para gravar o corpo, o POST, conexão para gravar o desfecho. Medir só
    // o POST deixava 35 s de pior caso contra 30 s de reserva (achado do auditor).
    expect(CONEXAO_MAX_MS + TIMEOUT_ENVIO_MS + CONEXAO_MAX_MS).toBeLessThan(ENVIO_PARADO_MS);
  });

  it("a conexão máxima é a mesma de lib/db.ts", () => {
    // `connect_timeout` é literal em lib/db.ts, que é do dono e não exporta nada
    // disso; este caso lê o arquivo para os dois não divergirem calados.
    const fonte = readFileSync(fileURLToPath(new URL("../lib/db.ts", import.meta.url)), "utf8");
    const m = /connect_timeout:\s*(\d+)/.exec(fonte);
    expect(Number(m?.[1]) * 1000).toBe(CONEXAO_MAX_MS);
  });
});

describe("geracaoNaTela", () => {
  const criado = new Date("2026-09-29T12:00:00Z");
  const t0 = criado.getTime();

  it("pronto e falhou passam direto, qualquer que seja o relógio", () => {
    expect(geracaoNaTela("pronto", criado, t0 + 10 * TRAVADA_MS)).toBe("pronto");
    expect(geracaoNaTela("falhou", criado, t0)).toBe("falhou");
  });

  it("gerando dentro do prazo continua gerando", () => {
    expect(geracaoNaTela("gerando", criado, t0 + TRAVADA_MS)).toBe("gerando");
    expect(geracaoNaTela("pendente", criado, t0 + 1)).toBe("gerando");
  });

  it("um milissegundo além do prazo vira travou, inclusive a linha que nem começou", () => {
    expect(geracaoNaTela("gerando", criado, t0 + TRAVADA_MS + 1)).toBe("travou");
    expect(geracaoNaTela("pendente", criado, t0 + TRAVADA_MS + 1)).toBe("travou");
  });
});
