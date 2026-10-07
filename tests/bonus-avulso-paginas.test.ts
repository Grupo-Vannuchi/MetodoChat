import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// AS GUARDAS DO CARROSSEL AVULSO que nenhum tipo pega (spec da Etapa 7, "Segurança"): a sessão
// conferida dentro de cada action, a conta que nunca vem do formulário, e a recusa do pedido como
// estado, sem recriar a página (achado 52). O harness da integração não forja sessão, então as actions
// com sessão se provam pelo processo (testes-integracao/bonus-avulso-processo.integracao.ts) e por
// estas guardas.

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const ler = (rel: string) => readFileSync(`${RAIZ}/${rel}`, "utf8");
const ACOES = "app/carrosseis/actions.ts";

/** As funções exportadas de um arquivo e a primeira instrução de cada uma. */
function primeirasInstrucoes(fonte: string): { nome: string; primeira: string }[] {
  const achados: { nome: string; primeira: string }[] = [];
  const re = /export async function (\w+)\([^)]*\)[^{]*\{\s*([^\n;]+;)/g;
  for (const m of fonte.matchAll(re)) achados.push({ nome: m[1], primeira: m[2].trim() });
  return achados;
}

/** O corpo de uma action exportada, até o próximo export. */
function corpoDe(fonte: string, nome: string): string {
  const inicio = fonte.indexOf(`export async function ${nome}(`);
  expect(inicio, nome).toBeGreaterThan(-1);
  const fim = fonte.indexOf("\nexport ", inicio + 1);
  return fonte.slice(inicio, fim === -1 ? undefined : fim);
}

describe("toda action do carrossel avulso confere a sessão antes de qualquer coisa", () => {
  it("as duas actions começam por `await exigirSessao();`", () => {
    const achados = primeirasInstrucoes(ler(ACOES));
    expect(achados.map((a) => a.nome).sort()).toEqual(["gerarAvulsoDeNovo", "pedirCarrosselAvulso"]);
    for (const a of achados) expect(a.primeira, a.nome).toBe("await exigirSessao();");
  });

  it("nenhum export escapa do leitor: num arquivo 'use server', todo export é action", () => {
    const fonte = ler(ACOES);
    expect(fonte.startsWith('"use server";')).toBe(true);
    expect((fonte.match(/^export /gm) ?? []).length).toBe(primeirasInstrucoes(fonte).length);
  });
});

describe("o que vem do formulário", () => {
  it("a conta nunca vem do formulário", () => {
    expect(ler(ACOES)).not.toMatch(/form\.get(All)?\(\s*["']conta["']/);
  });

  it("o título, a descrição e o tema do bônus do Labs nunca vêm do formulário", () => {
    expect(ler(ACOES)).not.toMatch(/form\.get\(\s*["'](titulo|descricao)["']/);
  });

  it("o pedido grava a conta logada com o nome, e o Gerar de novo herda a do original", () => {
    const fonte = ler(ACOES);
    expect(corpoDe(fonte, "pedirCarrosselAvulso")).toContain("contaParaGuardar(");
    expect(corpoDe(fonte, "gerarAvulsoDeNovo")).toContain("contaParaGerarDeNovo(");
  });
});

// A RECUSA DO PEDIDO VOLTA COMO ESTADO (achado 52): todo redirect de Server Action recria a página, e
// o que o operador escreveu, à mão inclusive, sumiria. Sai por redirect só o carrossel criado.
describe("o pedido do avulso responde sem recriar a página na recusa", () => {
  it("pedirCarrosselAvulso não redireciona com aviso", () => {
    const corpo = corpoDe(ler(ACOES), "pedirCarrosselAvulso");
    expect(corpo).not.toMatch(/urlDoCarrosselComAviso\(/);
    expect(corpo.match(/redirect\(/g) ?? []).toHaveLength(1);
  });
});
