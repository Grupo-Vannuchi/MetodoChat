import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// AS GUARDAS DO APAGAR que nenhum tipo pega (spec da Etapa 10, "A página do carrossel"). O harness da
// integração não forja sessão (de propósito): o apagar se prova pelo servidor, que a integração alcança
// (testes-integracao/bonus-apagar-carrossel.integracao.ts), e por estas leituras do código.

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const ler = (rel: string) => readFileSync(`${RAIZ}/${rel}`, "utf8").replace(/\r\n/g, "\n");
const ACTIONS = "app/bonus/apagar-actions.ts";
const PAGINAS = ["app/bonus/[id]/carrossel/[cid]/page.tsx", "app/carrosseis/[cid]/page.tsx"];

/** As funções exportadas de um arquivo e a primeira instrução de cada uma. */
function primeirasInstrucoes(fonte: string): { nome: string; primeira: string }[] {
  const achados: { nome: string; primeira: string }[] = [];
  const re = /export async function (\w+)\([^)]*\)[^{]*\{\s*([^\n;]+;)/g;
  for (const m of fonte.matchAll(re)) achados.push({ nome: m[1], primeira: m[2].trim() });
  return achados;
}

describe("a action do apagar", () => {
  it("é uma só, e começa por `await exigirSessao();`", () => {
    const achados = primeirasInstrucoes(ler(ACTIONS));
    expect(achados.map((a) => a.nome)).toEqual(["apagarCarrosselDaPagina"]);
    for (const a of achados) expect(a.primeira, a.nome).toBe("await exigirSessao();");
  });

  it("nenhum export escapa do leitor: num arquivo 'use server', todo export é action", () => {
    const fonte = ler(ACTIONS);
    expect(fonte.startsWith('"use server";')).toBe(true);
    expect((fonte.match(/^export /gm) ?? []).length).toBe(primeirasInstrucoes(fonte).length);
  });

  // ACHADO 52: a recusa volta como estado do botão. Sai por redirect só a sessão e o sucesso, este pela
  // lista com o aviso em verde (achado 92).
  it("a recusa volta como estado: os redirects são o da sessão e o do sucesso", () => {
    expect([...ler(ACTIONS).matchAll(/\bredirect\((.*)\);/g)].map((m) => m[1])).toEqual(['"/entrar"', "urlDepoisDeApagar()"]);
  });

  it("o id vem do formulário, e quem apaga é o servidor, com a linha travada", () => {
    const fonte = ler(ACTIONS);
    expect(fonte).toContain('form.get("id")');
    expect(fonte).toContain("await apagarCarrossel(id)");
    expect(fonte).not.toMatch(/delete from|sql\(\)/);
  });
});

describe.each(PAGINAS)("a página %s", (pagina) => {
  // O "Apagar carrossel" vale também no carrossel que falhou ou travou na geração (spec, "A página do
  // carrossel"): ele fica fora das três seções da geração, no fim da página.
  it("desenha o apagar no fim, fora das seções da geração", () => {
    expect(ler(pagina)).toMatch(/\n {6}<Apagar carrossel=\{carrossel\} geracao=\{geracao\} \/>\n {4}<\/div>\n {2}\);\n\}/);
  });
});

describe("o apagar na página", () => {
  it("lê o que pode pelo servidor e entrega a action ao botão", () => {
    const fonte = ler("app/bonus/[id]/carrossel/[cid]/apagar.tsx");
    expect(fonte).toContain("apagarNaPagina(await podeApagarAgora(carrossel, geracao))");
    expect(fonte).toContain("acao={apagarCarrosselDaPagina}");
  });
});
