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

  it("entrega a action de salvar ao formulário da revisão, que mostra a resposta junto do botão", () => {
    expect(ler("app/bonus/[id]/carrossel/[cid]/page.tsx")).toContain("acao={salvarRevisaoDoCarrossel}");
  });
});

// O "SALVAR REVISÃO" NÃO REDIRECIONA (achado 52, causa medida em 01/10 num navegador de verdade):
// todo redirect de Server Action recria a página no Next 16, e o que o operador tinha digitado
// voltava ao texto com que a página abriu. A recusa e o "Revisão salva." voltam como estado do
// formulário. Só a sessão e o carrossel inexistente saem por redirect, para OUTRA página.
describe("o salvar da revisão responde sem recriar a página", () => {
  it("salvarRevisaoDoCarrossel não redireciona para a página do carrossel", () => {
    const fonte = ler("app/bonus/carrossel-actions.ts");
    const inicio = fonte.indexOf("export async function salvarRevisaoDoCarrossel(");
    const fim = fonte.indexOf("\nexport ", inicio + 1);
    const corpo = fonte.slice(inicio, fim === -1 ? undefined : fim);
    expect(inicio).toBeGreaterThan(-1);
    expect(corpo).not.toMatch(/urlDoCarrosselComAviso\(/);
    expect(corpo).not.toMatch(/redirect\(`\/bonus\/\$\{/);
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
