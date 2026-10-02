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

// OS CAMPOS DE REVISÃO SÃO CONTROLADOS (achados 52 e 54, 01/10). Depois que a action do
// formulário termina, o React 19 reinicia o formulário, e um campo com `defaultValue` volta ao
// texto com que a página abriu: numa recusa, a edição sumia, e o clique seguinte mandava o texto
// velho. Os testes de tela provam os dois componentes; este pega um campo cru com
// `defaultValue` recolocado direto numa das páginas.
describe("nenhum campo de revisão do bônus volta a ser não controlado", () => {
  it.each([
    "app/bonus/page.tsx",
    "app/bonus/formulario-do-pedido.tsx",
    "app/bonus/[id]/page.tsx",
    "app/bonus/[id]/no-labs.tsx",
    "app/bonus/[id]/pedido-de-carrossel.tsx",
    "app/bonus/[id]/campo-do-envio.tsx",
    "app/bonus/[id]/formulario-do-envio.tsx",
    "app/bonus/[id]/carrossel/[cid]/page.tsx",
    "app/bonus/[id]/carrossel/[cid]/campo.tsx",
    "app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx",
    "app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx",
  ])("%s não usa defaultValue", (arquivo) => {
    const semComentarios = ler(arquivo)
      .split("\n")
      .filter((l) => !l.trim().startsWith("//"))
      .join("\n");
    expect(semComentarios).not.toMatch(/defaultValue=/);
  });
});

// O ENVIO AO LABS RESPONDE PELA REGRA DE `respostaDoEnvio` (achado 54, causa medida em 01/10 num
// navegador de verdade): todo redirect de Server Action recria a página, e a recusa que não grava
// nada tem de voltar como estado. Um redirect direto para a página do bônus, como era antes,
// apagaria de novo a edição.
describe("o envio ao Labs responde sem recriar a página na recusa", () => {
  it("enviarAoLabs decide por respostaDoEnvio, e não redireciona direto com o aviso", () => {
    const fonte = ler("app/bonus/actions.ts");
    const inicio = fonte.indexOf("export async function enviarAoLabs(");
    const fim = fonte.indexOf("\nexport ", inicio + 1);
    const corpo = fonte.slice(inicio, fim === -1 ? undefined : fim);
    expect(inicio).toBeGreaterThan(-1);
    expect(corpo).toContain("respostaDoEnvio(");
    expect(corpo).not.toMatch(/redirect\(urlDoBonusComAviso\(id,/);
  });

  it("a página entrega enviarAoLabs ao formulário do envio", () => {
    expect(ler("app/bonus/[id]/page.tsx")).toContain("acao={enviarAoLabs}");
  });
});

// O PEDIDO DE BÔNUS TAMBÉM NÃO REDIRECIONA NA RECUSA (pelo mesmo motivo dos achados 52 e 54): o
// redirect para a própria página, com o aviso na URL, recriava a página e apagava o tema, o "O que
// o bônus resolve" e a palavra. As três recusas não gravam nada e voltam como estado. Só o pedido
// criado sai por redirect, para a página do bônus novo.
describe("o pedido de bônus responde sem recriar a página na recusa", () => {
  it("pedirBonus não redireciona com aviso", () => {
    const fonte = ler("app/bonus/actions.ts");
    const inicio = fonte.indexOf("export async function pedirBonus(");
    const fim = fonte.indexOf("\nexport ", inicio + 1);
    const corpo = fonte.slice(inicio, fim === -1 ? undefined : fim);
    expect(inicio).toBeGreaterThan(-1);
    expect(corpo).not.toMatch(/urlDoBonusComAviso\(/);
  });

  it("a página entrega pedirBonus ao formulário do pedido", () => {
    expect(ler("app/bonus/page.tsx")).toContain("acao={pedirBonus}");
  });
});
