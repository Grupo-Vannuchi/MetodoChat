import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MAX_DURATION_S } from "@/lib/bonus/tempos";

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

// A GERAÇÃO RODA NO `after()` DA ACTION, sob o teto de tempo da página que a chamou: o Next exige
// literal no `maxDuration`, e o número tem de ser o de lib/bonus/tempos.ts.
describe("a página do novo carrossel", () => {
  it("declara o mesmo maxDuration de lib/bonus/tempos.ts", () => {
    const m = /export const maxDuration = (\d+);/.exec(ler("app/carrosseis/novo/page.tsx"));
    expect(m?.[1]).toBe(String(MAX_DURATION_S));
  });

  it("entrega pedirCarrosselAvulso ao formulário", () => {
    expect(ler("app/carrosseis/novo/page.tsx")).toContain("acao={pedirCarrosselAvulso}");
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

// A PÁGINA DO AVULSO (spec da Etapa 7, "A página do carrossel avulso"): a mesma parte de dentro da
// página do carrossel de bônus, e só o topo muda.
describe("a página do carrossel avulso", () => {
  const PAGINA = "app/carrosseis/[cid]/page.tsx";

  it("declara o mesmo maxDuration de lib/bonus/tempos.ts: o Gerar de novo roda no after() dela", () => {
    const m = /export const maxDuration = (\d+);/.exec(ler(PAGINA));
    expect(m?.[1]).toBe(String(MAX_DURATION_S));
  });

  it("só serve o avulso: o carrossel de bônus dá 404 aqui", () => {
    expect(ler(PAGINA)).toContain('if (!carrossel || !ehDaRota(carrossel, { tipo: "avulso" })) notFound();');
  });

  it("acompanha a geração com o componente da Etapa 1, e gera de novo pela action do avulso", () => {
    const pagina = ler(PAGINA);
    expect(pagina).toContain('import Acompanhar from "@/app/bonus/[id]/acompanhar";');
    expect(pagina).toContain("<form action={gerarAvulsoDeNovo}>");
  });
});

// O MENU "CARROSSÉIS" E A LISTA (spec da Etapa 7): um item novo no menu, ao lado do "Bônus", com todos
// os carrosséis e o botão "Novo carrossel". O item é uma linha em app/app-shell.tsx, como o "Bônus" foi
// na FASE 1.9.
describe("o menu Carrosséis", () => {
  it("o item mora no menu, logo depois do Bônus", () => {
    const menu = ler("app/app-shell.tsx");
    const bonus = menu.indexOf('{ href: "/bonus", label: "Bônus"');
    const carrosseis = menu.indexOf('{ href: "/carrosseis", label: "Carrosséis"');
    expect(bonus).toBeGreaterThan(-1);
    expect(carrosseis).toBeGreaterThan(bonus);
    expect(menu.slice(bonus, carrosseis).split("\n")).toHaveLength(2);
  });

  it("a lista lê todos os carrosséis, monta cada item fora do JSX e leva ao Novo carrossel", () => {
    const lista = ler("app/carrosseis/page.tsx");
    expect(lista).toContain("await listarCarrosseis()");
    expect(lista).toContain("itemDaListaDeCarrosseis(");
    expect(lista).toContain('href="/carrosseis/novo"');
  });

  it("a página do carrossel entrega o aviso do funil, decidido pelo estado da fila", () => {
    expect(ler("app/bonus/[id]/carrossel/[cid]/revisao.tsx")).toContain("avisoDoFunil: textoDoFunil(estado, carrossel.palavra)");
  });

  // O CARROSSEL SEM PALAVRA-CHAVE (spec da Etapa 8): o topo diz a palavra ou a ação, e a palavra no Labs
  // é comparada pelos dois lados, nas duas páginas. A revisão leva a ação ao editor.
  it.each(["app/carrosseis/[cid]/page.tsx", "app/bonus/[id]/carrossel/[cid]/page.tsx"])(
    "%s: o topo diz a palavra ou a ação, e a palavra no Labs vem de avisoDaPalavraNoLabs",
    (pagina) => {
      const fonte = ler(pagina);
      expect(fonte).toContain("{textoDoPedidoDaChamada(carrossel)}");
      expect(fonte).toContain("avisoDaPalavraNoLabs(situacao.bonus.palavra, carrossel.palavra)");
      expect(fonte).not.toContain("palavra {carrossel.palavra}");
    }
  );

  it("a revisão leva a ação da chamada ao editor", () => {
    expect(ler("app/bonus/[id]/carrossel/[cid]/revisao.tsx")).toContain("acaoDaChamada={carrossel.acao_da_chamada}");
  });
});

// AS DUAS REGRAS DO LABS NAS PÁGINAS E NAS ACTIONS (spec da Etapa 8, achado 85): o avulso lê o Labs pela
// regra dele, que aceita o bônus sem palavra; o carrossel de bônus do Chat continua com a de hoje.
describe("quem usa cada regra do Labs", () => {
  it("as actions do avulso leem a caixa sem palavra, a ação e o Labs pela regra do avulso", () => {
    const acoes = ler("app/carrosseis/actions.ts");
    expect(acoes).toContain('semPalavra: form.get("sem_palavra")');
    expect(acoes).toContain('acao: form.get("acao")');
    expect(acoes).toContain("situacaoDoAvulsoNoLabs(process.env.LABS_URL, codigo)");
    expect(acoes).not.toContain("situacaoNoLabs(");
  });

  it("a página do avulso lê o Labs pela regra do avulso", () => {
    expect(ler("app/carrosseis/[cid]/page.tsx")).toContain("situacaoDoAvulsoNoLabs(process.env.LABS_URL, codigo)");
  });

  it("o carrossel de bônus do Chat continua com a regra de hoje", () => {
    expect(ler("app/bonus/carrossel-actions.ts")).toContain("situacaoNoLabs(process.env.LABS_URL");
    expect(ler("app/bonus/[id]/carrossel/[cid]/page.tsx")).toContain("situacaoNoLabs(process.env.LABS_URL");
    expect(ler("app/bonus/carrossel-actions.ts")).not.toContain("situacaoDoAvulsoNoLabs");
  });
});

// OS BÔNUS DO LABS QUE FICAM DE FORA (spec da Etapa 8, achado 84): a página do Novo carrossel entrega a
// frase, montada fora do JSX, ao formulário.
describe("o Novo carrossel e os bônus que ficam de fora", () => {
  it("a página entrega a frase dos bônus de fora ao formulário", () => {
    expect(ler("app/carrosseis/novo/page.tsx")).toContain("deFora={lista.ok ? textoDosBonusDeFora(lista.deFora) : null}");
  });
});

// O CONTRATO DA LISTA DO LABS (achado 83): a lista está no contrato desde 01/10 (site-ia,
// docs/contrato-metodo-chat.md, seção do GET /api/bonus). Nenhum comentário diz o contrário, e a spec
// da Etapa 7 ganhou a nota de correção.
describe("a lista do Labs está no contrato", () => {
  it.each(["lib/bonus/publicado.ts", "lib/bonus/temas.ts", "app/carrosseis/novo/page.tsx"])("%s não diz que ela está fora", (arquivo) => {
    expect(ler(arquivo)).not.toMatch(/n[ãa]o est[áa] no contrato/i);
  });

  it("a spec da Etapa 7 tem a nota de correção", () => {
    expect(ler("docs/specs/2026-10-06-carrossel-avulso.md")).toContain("**Correção de 08/10 (achado 83):**");
  });
});
