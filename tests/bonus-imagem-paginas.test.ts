import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { urlDaConsultaDaImagem } from "@/lib/bonus/imagem-regras";

// AS GUARDAS DO CRIADOR DE IMAGEM que nenhum tipo pega (spec da Etapa 6, "Pedir e acompanhar"). O harness
// da integração não forja sessão (de propósito): a action e a consulta se provam pelo processo, que a
// integração alcança, e por estas leituras do código.

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const ler = (rel: string) => readFileSync(`${RAIZ}/${rel}`, "utf8").replace(/\r\n/g, "\n");
const ACTIONS = "app/bonus/imagem-actions.ts";
const ROTAS = ["app/bonus/[id]/carrossel/[cid]/imagem/route.ts", "app/carrosseis/[cid]/imagem/route.ts"];
const CONSULTA = "lib/bonus/imagem-consulta.ts";

/** As funções exportadas de um arquivo e a primeira instrução de cada uma. */
function primeirasInstrucoes(fonte: string): { nome: string; primeira: string }[] {
  const achados: { nome: string; primeira: string }[] = [];
  const re = /export async function (\w+)\([^)]*\)[^{]*\{\s*([^\n;]+;)/g;
  for (const m of fonte.matchAll(re)) achados.push({ nome: m[1], primeira: m[2].trim() });
  return achados;
}

describe("a action do pedido de imagem", () => {
  it("é uma só, e começa por `await exigirSessao();`", () => {
    const achados = primeirasInstrucoes(ler(ACTIONS));
    expect(achados.map((a) => a.nome)).toEqual(["pedirImagemDoSlide"]);
    for (const a of achados) expect(a.primeira, a.nome).toBe("await exigirSessao();");
  });

  it("nenhum export escapa do leitor: num arquivo 'use server', todo export é action", () => {
    const fonte = ler(ACTIONS);
    expect(fonte.startsWith('"use server";')).toBe(true);
    expect((fonte.match(/^export /gm) ?? []).length).toBe(primeirasInstrucoes(fonte).length);
  });

  // ACHADO 88: o Next manda as actions de um cliente uma de cada vez. A action que esperasse a imagem
  // prenderia o salvar, o "Só texto" e o publicar da página inteira.
  it("não espera a imagem: a geração vai para o after()", () => {
    const fonte = ler(ACTIONS);
    expect(fonte).toContain("after(() => gerarImagem(");
    expect(fonte).not.toMatch(/await gerarImagem\(/);
  });

  it("responde como estado: o único redirect é o da sessão", () => {
    expect(ler(ACTIONS).match(/redirect\([^)]*\)/g) ?? []).toEqual(['redirect("/entrar")']);
  });

  it("não lê a conta do navegador, nem a chave da OpenAI", () => {
    const fonte = ler(ACTIONS);
    expect(fonte).not.toMatch(/\.conta\b|\["conta"\]|get\(\s*["']conta["']/);
    expect(fonte).not.toContain("OPENAI_API_KEY");
  });
});

describe.each(ROTAS)("a consulta %s", (rota) => {
  // A CONSULTA É UMA ROTA GET, E NÃO UMA ACTION (achado 88): o card pergunta a cada 2 s, e uma action
  // entraria na mesma fila do salvar e do publicar.
  it("é uma rota GET, fora da fila das actions", () => {
    const fonte = ler(rota);
    expect(fonte).not.toContain('"use server"');
    expect([...fonte.matchAll(/^export async function (\w+)/gm)].map((m) => m[1])).toEqual(["GET"]);
  });

  it("o GET confere a sessão antes de qualquer outra coisa", () => {
    const fonte = ler(rota);
    const inicio = fonte.indexOf("export async function GET(");
    const linhas = fonte
      .slice(inicio)
      .split("\n")
      .slice(1)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("//"));
    expect(inicio).toBeGreaterThan(-1);
    expect(linhas.slice(0, 2)).toEqual([
      "const jarra = await cookies();",
      "if (!isValidSession(jarra.get(SESSION_COOKIE)?.value)) return respostaDaConsulta({ erro: TEXTO_ARTE_SEM_SESSAO }, 401);",
    ]);
  });

  it("confere o pedido pela origem da rota, e responde pela consulta comum", () => {
    const fonte = ler(rota);
    expect(fonte).toContain("conferirPedidoDaArte(");
    expect(fonte).toContain("consultarImagem(");
  });
});

describe("a consulta comum", () => {
  it("nunca fica em cache: o estado muda a cada geração", () => {
    expect(ler(CONSULTA)).toContain('"Cache-Control": "private, no-store"');
  });

  it("a URL fica ao lado da arte, no caminho do carrossel", () => {
    expect(urlDaConsultaDaImagem("/carrosseis/c1", 2)).toBe("/carrosseis/c1/imagem?slide=2");
    expect(urlDaConsultaDaImagem("/bonus/b1/carrossel/c1", 3)).toBe("/bonus/b1/carrossel/c1/imagem?slide=3");
  });
});

// A PÁGINA ENTREGA O CRIADOR DE IMAGEM AO EDITOR (desde a Etapa 7, a parte de dentro da página é a revisão,
// comum às duas rotas do carrossel): a action do pedido e o que a tabela 018 diz de cada slide.
describe("a página do carrossel entrega o criador de imagem ao editor", () => {
  it("a action do pedido, a conta do dia e o que está gerando, pelo relógio do banco", () => {
    const fonte = ler("app/bonus/[id]/carrossel/[cid]/revisao.tsx");
    expect(fonte).toContain("acaoDoPedido: pedirImagemDoSlide,");
    expect(fonte).toContain("ultimasDoCarrossel(carrossel.id)");
    expect(fonte).toContain('estadoDaImagem(l, agora).tipo === "gerando"');
  });
});
