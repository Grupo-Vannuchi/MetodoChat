import { describe, expect, it } from "vitest";
import { configDoEnvio, temChaveDaIA } from "@/lib/bonus/config";

describe("configDoEnvio: falha fechada", () => {
  it("sem segredo, recusa", () => {
    expect(configDoEnvio({ LABS_URL: "https://metodolabs.metodotia.com" })).toEqual({ ok: false, motivo: "sem_segredo" });
  });

  it("segredo vazio conta como ausente", () => {
    expect(configDoEnvio({ BONUS_INTAKE_SECRET: "", LABS_URL: "https://x.invalid" })).toEqual({ ok: false, motivo: "sem_segredo" });
  });

  it("sem URL, recusa", () => {
    expect(configDoEnvio({ BONUS_INTAKE_SECRET: "s" })).toEqual({ ok: false, motivo: "sem_url" });
  });

  it("URL insegura, recusa", () => {
    expect(configDoEnvio({ BONUS_INTAKE_SECRET: "s", LABS_URL: "http://metodolabs.metodotia.com" })).toEqual({ ok: false, motivo: "url_invalida" });
  });

  it("com as duas, devolve a porta montada", () => {
    expect(configDoEnvio({ BONUS_INTAKE_SECRET: "s", LABS_URL: "https://metodolabs.metodotia.com" })).toEqual({
      ok: true,
      url: "https://metodolabs.metodotia.com/api/bonus",
      segredo: "s",
    });
  });
});

describe("temChaveDaIA", () => {
  it("só com a chave preenchida", () => {
    expect(temChaveDaIA({})).toBe(false);
    expect(temChaveDaIA({ ANTHROPIC_API_KEY: "" })).toBe(false);
    expect(temChaveDaIA({ ANTHROPIC_API_KEY: "chave-inventada" })).toBe(true);
  });
});
