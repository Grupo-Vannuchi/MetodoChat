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

  // Na Etapa 3, a página entrega as duas actions ao editor (editor-do-carrossel.tsx), que leva a
  // da revisão ao formulário e a da arte à seção da arte.
  it("entrega a action de salvar a revisão e a de salvar a arte ao editor do carrossel", () => {
    const pagina = ler("app/bonus/[id]/carrossel/[cid]/page.tsx");
    expect(pagina).toContain("acaoDaRevisao={salvarRevisaoDoCarrossel}");
    expect(pagina).toContain("acaoDaArte={salvarArteDoCarrossel}");
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

// O PEDIDO DE CARROSSEL TAMBÉM NÃO REDIRECIONA NA RECUSA (pelo mesmo motivo dos achados 52 e 54):
// o redirect para a página do bônus, com o aviso na URL, recriava a página e voltava o "Quantos
// slides?" para 10. As recusas não gravam nada e voltam como estado. Saem por redirect só o id de
// bônus inválido, para a lista, e o pedido criado, para a página do carrossel novo.
describe("o pedido de carrossel responde sem recriar a página na recusa", () => {
  it("pedirCarrossel não redireciona para a página do bônus com aviso", () => {
    const fonte = ler("app/bonus/carrossel-actions.ts");
    const inicio = fonte.indexOf("export async function pedirCarrossel(");
    const fim = fonte.indexOf("\nexport ", inicio + 1);
    const corpo = fonte.slice(inicio, fim === -1 ? undefined : fim);
    expect(inicio).toBeGreaterThan(-1);
    expect(corpo).not.toMatch(/urlDoBonusComAviso\(bonusId,/);
  });

  it("a seção do bônus no Labs entrega pedirCarrossel ao pedido de carrossel", () => {
    expect(ler("app/bonus/[id]/no-labs.tsx")).toContain("acao={pedirCarrossel}");
  });
});

// AS ESCOLHAS DA ARTE TAMBÉM NÃO REDIRECIONAM (Etapa 3): a seção da arte fica na mesma página que
// o editor, e recriar a página apagaria o que o operador estiver editando (achado 52). A resposta
// volta como estado, e a miniatura troca pela versão da prévia.
describe("o salvar da arte responde sem recriar a página", () => {
  it.each(["salvarArteDoCarrossel", "fixarContaDoCarrossel", "salvarSlideDoCarrossel"])("%s não redireciona para a página do carrossel", (nome) => {
    const fonte = ler("app/bonus/carrossel-actions.ts");
    const inicio = fonte.indexOf(`export async function ${nome}(`);
    const fim = fonte.indexOf("\nexport ", inicio + 1);
    const corpo = fonte.slice(inicio, fim === -1 ? undefined : fim);
    expect(inicio).toBeGreaterThan(-1);
    expect(corpo).not.toMatch(/urlDoCarrosselComAviso\(/);
    expect(corpo).not.toMatch(/redirect\(`\/bonus\/\$\{/);
  });
});

// A CONTA DO CARROSSEL (spec da Etapa 4): ele é da conta em que nasceu, e nunca vira de outra. A
// conta nunca vem do formulário, e o "Gerar de novo" herda a do original. O harness da integração não
// forja sessão (de propósito), então as actions com sessão se provam pelas funções puras
// (tests/bonus-arte-conta.test.ts) e por estas guardas.
describe("a conta do carrossel nunca vem do formulário", () => {
  it("nenhuma action lê um campo `conta` do formulário", () => {
    expect(ler("app/bonus/carrossel-actions.ts")).not.toMatch(/form\.get(All)?\(\s*["']conta["']/);
  });

  it("o Gerar de novo herda a conta do original, e o pedido grava a logada com o nome", () => {
    const fonte = ler("app/bonus/carrossel-actions.ts");
    const inicio = fonte.indexOf("export async function gerarCarrosselDeNovo(");
    const corpo = fonte.slice(inicio, fonte.indexOf("\nexport ", inicio + 1));
    expect(corpo).toContain("contaParaGerarDeNovo(");
    expect(corpo).not.toContain("contaDoPedido(");
    expect(fonte).toMatch(/async function contaDoPedido\(\)[\s\S]*?contaParaGuardar\(/);
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
  it("as seis actions começam por `await exigirSessao();`", () => {
    const achados = primeirasInstrucoes(ler("app/bonus/carrossel-actions.ts"));
    expect(achados.map((a) => a.nome).sort()).toEqual([
      "fixarContaDoCarrossel",
      "gerarCarrosselDeNovo",
      "pedirCarrossel",
      "salvarArteDoCarrossel",
      "salvarRevisaoDoCarrossel",
      "salvarSlideDoCarrossel",
    ]);
    for (const a of achados) expect(a.primeira, a.nome).toBe("await exigirSessao();");
  });

  it("nenhum export escapa do leitor: num arquivo 'use server', todo export é action", () => {
    const fonte = ler("app/bonus/carrossel-actions.ts");
    expect((fonte.match(/^export /gm) ?? []).length).toBe(primeirasInstrucoes(fonte).length);
  });
});
