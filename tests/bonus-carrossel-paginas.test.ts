import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MAX_DURATION_S } from "@/lib/bonus/tempos";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const ler = (rel: string) => readFileSync(`${RAIZ}/${rel}`, "utf8");

describe("a página do carrossel", () => {
  it("declara o mesmo maxDuration de lib/bonus/tempos.ts: o Gerar de novo roda no after() dela", () => {
    const m = /export const maxDuration = (\d+);/.exec(ler("app/bonus/[id]/carrossel/[cid]/page.tsx"));
    expect(m?.[1]).toBe(String(MAX_DURATION_S));
  });

  it("acompanha a geração com o componente da Etapa 1, e não com um segundo", () => {
    expect(ler("app/bonus/[id]/carrossel/[cid]/page.tsx")).toContain('import Acompanhar from "../../acompanhar";');
  });

  it("entrega a palavra aos campos que a pedem, para o aviso na hora (achado 53)", () => {
    expect(ler("app/bonus/[id]/carrossel/[cid]/page.tsx")).toContain(
      "palavra={c.pedePalavra ? carrossel.palavra : undefined}"
    );
  });
});

/** As funções exportadas de um arquivo e a primeira instrução de cada uma. */
function primeirasInstrucoes(fonte: string): { nome: string; primeira: string }[] {
  const achados: { nome: string; primeira: string }[] = [];
  const re = /export async function (\w+)\([^)]*\)[^{]*\{\s*([^\n;]+;)/g;
  for (const m of fonte.matchAll(re)) achados.push({ nome: m[1], primeira: m[2].trim() });
  return achados;
}

// A SESSÃO É CONFERIDA DENTRO DE CADA ACTION, e não só no proxy.ts: Server Action tem endereço
// próprio. O mesmo leitor de tests/bonus-paginas.test.ts, para o arquivo novo.
describe("toda action do carrossel confere a sessão antes de qualquer coisa", () => {
  it("as três actions começam por `await exigirSessao();`", () => {
    const achados = primeirasInstrucoes(ler("app/bonus/carrossel-actions.ts"));
    expect(achados.map((a) => a.nome).sort()).toEqual([
      "gerarCarrosselDeNovo",
      "pedirCarrossel",
      "salvarRevisaoDoCarrossel",
    ]);
    for (const a of achados) expect(a.primeira, a.nome).toBe("await exigirSessao();");
  });

  it("nenhum export escapa do leitor: num arquivo 'use server', todo export é action", () => {
    const fonte = ler("app/bonus/carrossel-actions.ts");
    expect((fonte.match(/^export /gm) ?? []).length).toBe(primeirasInstrucoes(fonte).length);
  });
});
