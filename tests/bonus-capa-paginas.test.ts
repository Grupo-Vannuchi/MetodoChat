import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { textoDaRecusaDaArte } from "@/lib/bonus/arte-textos";

// O QUE AS ACTIONS DA CAPA LEEM DO NAVEGADOR (spec da Etapa 11), conferido no arquivo, no molde de
// tests/bonus-arte-paginas.test.ts: a action da arte lê a capa pelo `lerCapaDoFormulario`, e a grava na
// mesma escrita do "só texto". O harness da integração não forja sessão, de propósito, e por isso a action
// se confere aqui; o repositório é conferido no container (testes-integracao/bonus-capa-escolhas).

const ACTIONS = "app/bonus/carrossel-actions.ts";
const ler = (f: string) => readFileSync(f, "utf8");

/** O corpo da função exportada, do nome até a próxima `export`. */
function corpo(fonte: string, nome: string): string {
  const inicio = fonte.indexOf(`export async function ${nome}(`);
  if (inicio < 0) throw new Error(`${nome} não está em ${ACTIONS}`);
  const fim = fonte.indexOf("\nexport ", inicio + 1);
  return fonte.slice(inicio, fim < 0 ? undefined : fim);
}

describe("a action da arte com a capa", () => {
  const salvar = corpo(ler(ACTIONS), "salvarArteDoCarrossel");

  it("lê a capa do formulário pela regra pura, com o só texto já lido e o total do carrossel", () => {
    expect(salvar).toContain('lerCapaDoFormulario(form.get("capa"), lido.soTexto, linha.total_slides)');
  });

  it("grava a capa lida, e não a do banco, na mesma escrita do só texto", () => {
    expect(salvar).toMatch(/salvarSoTextoDaArte\(id, lido\.soTexto, [^)]*\), capa\.capa\)/);
  });

  it("devolve as versões com a capa nova", () => {
    expect(salvar).toContain("capaDaArte(arteNova, linha.total_slides)");
  });
});

describe("as frases das recusas da capa", () => {
  it("cada recusa tem a sua frase, e nenhuma é vazia", () => {
    const frases = (["capa", "capa_no_post", "capa_e_so_texto"] as const).map(textoDaRecusaDaArte);
    expect(new Set(frases).size).toBe(3);
    for (const f of frases) expect(f.length).toBeGreaterThan(20);
  });

  it("a capa junto do Só texto diz o que fazer", () => {
    expect(textoDaRecusaDaArte("capa_e_so_texto")).toBe('O slide 1 não pode ser capa e "Só texto" ao mesmo tempo. Desmarque um dos dois.');
  });
});

// AS DUAS ROTAS DA CONSULTA DA IMAGEM (a do bônus e a do avulso) aceitam a capa porque não decidem jeito:
// elas conferem a sessão e o slide, e chamam a consulta comum (lib/bonus/imagem-consulta.ts), que a
// integração confere com a capa (testes-integracao/bonus-imagem-processo, "a imagem da capa"). E a action
// do pedido manda à geração o formato que o pedido decidiu, e nunca o deduz de novo.
describe("as rotas da consulta e a action do pedido, com a capa", () => {
  const ROTAS = ["app/bonus/[id]/carrossel/[cid]/imagem/route.ts", "app/carrosseis/[cid]/imagem/route.ts"];

  it.each(ROTAS)("%s confere o slide e chama a consulta comum, sem decidir o jeito", (rota) => {
    const fonte = ler(rota);
    expect(fonte).toContain("conferirPedidoDaArte(");
    expect(fonte).toContain("consultarImagem(");
    expect(fonte).not.toMatch(/\b(comEspaco|ehCapa|escolhasDaArte|soTexto|capaDaArte)\b/);
  });

  it("a action do pedido passa à geração o formato que o pedido decidiu", () => {
    const fonte = ler("app/bonus/imagem-actions.ts");
    expect(fonte).toContain("const { reservaId, formato } = r;");
    expect(fonte).toContain("gerarImagem({ reservaId, id, numero, descricao, contas, formato })");
  });
});
