import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// A SENHA ÚNICA SAIU DO CÓDIGO (docs/specs/2026-11-05-contas-por-login.md, seção 5). Até a entrega 2 dos
// logins, um login sem senha entrava uma vez pela `ADMIN_PASSWORD` do ambiente, e a entrada gravava ali a
// senha própria dele (a passagem). Desde a entrega 2, todo login tem senha própria, e a variável deixa de ser
// lida: apagá-la da Vercel fica para depois do merge, com o OK do Eduardo.
//
// ESTE ARQUIVO VALE PARA O QUE AINDA NÃO EXISTE: ele lê todo arquivo de `app/` e de `lib/` pelo analisador do
// TypeScript, e acusa a leitura da variável (por `process.env.ADMIN_PASSWORD`, por `process.env["…"]`, pela
// desestruturação de `process.env` ou pelo nome dela num texto) e os nomes das duas peças da passagem. Um
// comentário que cita a variável, para contar a história, não conta.

const RAIZ = fileURLToPath(new URL("..", import.meta.url));

function arquivosDe(pasta: string): string[] {
  const saida: string[] = [];
  const andar = (abs: string) => {
    for (const nome of readdirSync(abs)) {
      const caminho = join(abs, nome);
      if (statSync(caminho).isDirectory()) andar(caminho);
      else if (/\.tsx?$/.test(nome)) saida.push(relative(RAIZ, caminho).split(sep).join("/"));
    }
  };
  andar(join(RAIZ, pasta));
  return saida.sort();
}

function analisar(rel: string, fonte = readFileSync(join(RAIZ, rel), "utf8")): ts.SourceFile {
  const tipo = rel.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(rel, fonte, ts.ScriptTarget.Latest, true, tipo);
}

const VARIAVEL = "ADMIN_PASSWORD";
const PECAS_DA_PASSAGEM = new Set(["senhaUnicaConfere", "gravarSenhaDaPassagem"]);

/** Se a expressão é `process.env`. */
const ehProcessEnv = (e: ts.Expression) =>
  ts.isPropertyAccessExpression(e) && e.name.text === "env" && ts.isIdentifier(e.expression) && e.expression.text === "process";

/** O que o arquivo tem da senha única, com a linha de cada achado. */
function achados(sf: ts.SourceFile): string[] {
  const saida: string[] = [];
  const anotar = (n: ts.Node, o: string) => saida.push(`${sf.fileName}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1} ${o}`);
  const andar = (n: ts.Node) => {
    if (ts.isPropertyAccessExpression(n) && n.name.text === VARIAVEL && ehProcessEnv(n.expression)) anotar(n, "process.env.ADMIN_PASSWORD");
    else if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && n.text === VARIAVEL) anotar(n, `"${VARIAVEL}"`);
    else if (ts.isBindingElement(n) && (n.propertyName ?? n.name).getText(sf) === VARIAVEL) anotar(n, `{ ${VARIAVEL} }`);
    else if (ts.isIdentifier(n) && PECAS_DA_PASSAGEM.has(n.text)) anotar(n, n.text);
    ts.forEachChild(n, andar);
  };
  andar(sf);
  return saida;
}

describe("a senha única saiu do código", () => {
  it("o leitor acusa quando há o que acusar", () => {
    const a = (fonte: string) => achados(analisar("x.ts", fonte));
    expect(a("const s = process.env.ADMIN_PASSWORD;")).toEqual(["x.ts:1 process.env.ADMIN_PASSWORD"]);
    expect(a('const s = process.env["ADMIN_PASSWORD"];')).toEqual(['x.ts:1 "ADMIN_PASSWORD"']);
    expect(a("const { ADMIN_PASSWORD } = process.env;")).toEqual(["x.ts:1 { ADMIN_PASSWORD }"]);
    expect(a("const { ADMIN_PASSWORD: s } = process.env;")).toEqual(["x.ts:1 { ADMIN_PASSWORD }"]);
    expect(a('import { senhaUnicaConfere } from "./auth";\nif (senhaUnicaConfere(x)) y();')).toEqual([
      "x.ts:1 senhaUnicaConfere",
      "x.ts:2 senhaUnicaConfere",
    ]);
    expect(a("export async function gravarSenhaDaPassagem() {}")).toEqual(["x.ts:1 gravarSenhaDaPassagem"]);
    // O comentário que conta a história não conta, nem outra variável do ambiente.
    expect(a("// a ADMIN_PASSWORD saiu\nconst s = process.env.CRON_SECRET;")).toEqual([]);
  });

  it("o leitor acha os arquivos de app/ e de lib/, inclusive os da entrada", () => {
    const todos = [...arquivosDe("app"), ...arquivosDe("lib")];
    for (const rel of ["lib/entrada.ts", "lib/auth.ts", "lib/logins-repositorio.ts", "app/entrar/actions.ts"]) {
      expect(todos, rel).toContain(rel);
    }
  });

  it("nenhum arquivo de app/ e de lib/ lê a ADMIN_PASSWORD, nem tem as peças da passagem", () => {
    expect([...arquivosDe("app"), ...arquivosDe("lib")].flatMap((rel) => achados(analisar(rel)))).toEqual([]);
  });
});
