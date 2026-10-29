import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// A GUARDA DO CLIQUE DE PUBLICAR (spec 2026-10-19-enquadrar-imagens, achados 107 a 109, 115 e 116). O
// teste de tela (testes-dom/publicar-compositor.dom.tsx) cobra o comportamento com uma action falsa; o que
// ele NÃO alcança é o `redirect` da action de verdade nem a transição do roteador. Uma sonda mediu em
// 19/10/2026, no Next 16.3.8, que a espera da action REJEITA com `NEXT_REDIRECT` quando ela redireciona,
// inclusive no sucesso. Um `catch` em volta da chamada trataria o sucesso como falha, e o jsdom não
// reproduz o `NEXT_REDIRECT`. Então a guarda lê o arquivo, no jeito das guardas do Vinícius.

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
// O FIM DE LINHA SAI ANTES DE PROCURAR: na cópia do Windows, com `core.autocrlf`, o arquivo chega em
// CRLF, e uma expressão que espera `\n` logo depois da chave de fechamento não acharia a função.
const ler = (rel: string) => readFileSync(`${RAIZ}/${rel}`, "utf8").replace(/\r\n/g, "\n");
const funcao = (fonte: string, cabeca: string) =>
  new RegExp(`\\n {2}${cabeca} \\{[\\s\\S]*?\\n {2}\\}\\n`).exec(fonte)?.[0] ?? "";

describe("o compositor do /publicar", () => {
  const fonte = ler("app/publicar/enviador.tsx");
  const publicar = funcao(fonte, "async function publicar\\(\\)");
  const montar = funcao(fonte, "async function montarOPedido\\(\\): Promise<FormData \\| null>");
  const liberar = funcao(fonte, "function liberar\\(\\)");

  it("acha as funções do clique", () => {
    expect(publicar).toContain("await acao(dados);");
    expect(montar).toContain("await subirTodos(");
    expect(liberar).toContain("trava.current = false;");
  });

  it("a chamada da action não tem catch em volta: só try/finally, e o finally solta a trava", () => {
    expect(publicar).not.toMatch(/\bcatch\b/);
    expect(publicar).toMatch(/\} finally \{\s*liberar\(\);/);
  });

  // O ACHADO 116: a subida dentro da transição prenderia a navegação do menu até ela acabar. Dentro do
  // `iniciar` fica só a espera da action, que é o que a sonda mediu.
  it("dentro da transição fica só a action, e a subida corre fora dela", () => {
    expect(publicar).toMatch(/iniciar\(async \(\) => \{\s*try \{\s*await acao\(dados\);\s*\} finally \{\s*liberar\(\);\s*\}\s*\}\);/);
    expect(publicar.indexOf("await montarOPedido()")).toBeGreaterThan(-1);
    expect(publicar.indexOf("await montarOPedido()")).toBeLessThan(publicar.indexOf("iniciar("));
  });

  it("a trava é ligada antes de qualquer espera (achado 107)", () => {
    const trava = publicar.indexOf("trava.current = true;");
    const sai = publicar.indexOf("if (trava.current) return;");
    expect(trava).toBeGreaterThan(-1);
    // A SAÍDA TEM DE EXISTIR, e não só vir antes: sem ela, `indexOf` dá -1, que também é "antes".
    expect(sai).toBeGreaterThan(-1);
    expect(sai).toBeLessThan(trava);
    expect(trava).toBeLessThan(publicar.indexOf("iniciar("));
    expect(trava).toBeLessThan(publicar.indexOf("await"));
  });

  // O ACHADO 115: lido depois da subida, o formulário vinha sem a legenda, que a tela desabilita.
  it("o formulário é lido antes de qualquer espera, e é ele que vai à action", () => {
    const leitura = montar.indexOf("const pedido = new FormData(form);");
    expect(leitura).toBeGreaterThan(-1);
    expect(leitura).toBeLessThan(montar.indexOf("await"));
    expect(montar.match(/new FormData\(/g)).toHaveLength(1);
    expect(montar).toContain("return pedido;");
  });

  it("o formulário não tem action, e o envio nativo cai no mesmo caminho", () => {
    expect(fonte).not.toMatch(/<form[^>]*\baction=/);
    expect(fonte).toMatch(/onSubmit=\{\(ev\) => \{\s*ev\.preventDefault\(\);\s*void publicar\(\);/);
  });

  it("o botão de publicar é type=button, e chama o mesmo caminho", () => {
    expect(fonte).toMatch(/<button type="button" className=\{btnPrimary\} disabled=\{ocupado\} onClick=\{\(\) => void publicar\(\)\}>/);
  });
});

describe("a página de compor", () => {
  const pagina = ler("app/publicar/novo/page.tsx");

  it("entrega a action ao compositor, e não monta o formulário dela", () => {
    expect(pagina).toContain("acao={publicar}");
    expect(pagina).not.toContain("<form action={publicar}");
  });
});
