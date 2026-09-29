import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MAX_DURATION_S } from "@/lib/bonus/tempos";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const ler = (rel: string) => readFileSync(`${RAIZ}/${rel}`, "utf8");

describe("o teto das páginas do bônus", () => {
  it.each(["app/bonus/page.tsx", "app/bonus/[id]/page.tsx"])(
    "%s declara o mesmo maxDuration de lib/bonus/tempos.ts",
    (arquivo) => {
      const m = /export const maxDuration = (\d+);/.exec(ler(arquivo));
      expect(m?.[1]).toBe(String(MAX_DURATION_S));
    }
  );
});

/** As funções exportadas de um arquivo e a primeira instrução de cada uma. */
function primeirasInstrucoes(fonte: string): { nome: string; primeira: string }[] {
  const achados: { nome: string; primeira: string }[] = [];
  const re = /export async function (\w+)\([^)]*\)[^{]*\{\s*([^\n;]+;)/g;
  for (const m of fonte.matchAll(re)) achados.push({ nome: m[1], primeira: m[2].trim() });
  return achados;
}

// A SESSÃO É CONFERIDA DENTRO DE CADA ACTION, e não só no proxy.ts: Server Action
// tem endereço próprio. Apagar a primeira linha de uma action passaria por tsc,
// lint e toda a suíte; este caso é o que acusa.
describe("toda action do bônus confere a sessão antes de qualquer coisa", () => {
  it("o leitor acusa quando há o que acusar", () => {
    expect(primeirasInstrucoes("export async function x(f: FormData): Promise<void> {\n  const a = 1;\n}")).toEqual([
      { nome: "x", primeira: "const a = 1;" },
    ]);
  });

  it("as quatro actions começam por `await exigirSessao();`", () => {
    const achados = primeirasInstrucoes(ler("app/bonus/actions.ts"));
    expect(achados.map((a) => a.nome).sort()).toEqual(["conferirNoLabs", "enviarAoLabs", "gerarDeNovo", "pedirBonus"]);
    for (const a of achados) expect(a.primeira, a.nome).toBe("await exigirSessao();");
  });

  it("nenhum export escapa do leitor: num arquivo 'use server', todo export é action", () => {
    // Uma quinta action escrita como `export const x = async (f) => {…}` não casa
    // com o leitor acima, e fugiria da lista E da conferência de sessão (achado do
    // auditor). Contar todo `export` do arquivo fecha essa porta.
    const fonte = ler("app/bonus/actions.ts");
    expect((fonte.match(/^export /gm) ?? []).length).toBe(primeirasInstrucoes(fonte).length);
  });
});
