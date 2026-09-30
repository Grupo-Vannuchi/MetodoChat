import { describe, expect, it } from "vitest";
import { detalheDe } from "@/lib/bonus/desfecho";
import { quadroDoEnvio } from "@/lib/bonus/textos";

// ACHADO 43 DO AUDITOR (30/09): a tela afirmava "ainda oculto" de um bônus que o operador já
// tinha publicado no /admin do Labs. O que era verdade na criação continua podendo ser dito; o
// estado ATUAL só se afirma lendo o Labs (lib/bonus/publicado.ts).
describe("as frases de um bônus criado não afirmam o estado atual no Labs", () => {
  it.each(["criado", "criado_pelo_titulo", "criado_pela_duplicata", "conferido_existe"] as const)("%s", (motivo) => {
    const q = quadroDoEnvio(motivo, detalheDe(null), "kit");
    expect(`${q.titulo} ${q.texto}`).not.toMatch(/ainda oculto/i);
  });
});
