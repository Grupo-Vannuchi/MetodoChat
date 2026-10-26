import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// A LISTA DE CONTAS DO MENU SÓ É LIDA COM SESSÃO (docs/specs/2026-10-26-sessao-conferida.md).
//
// O layout raiz roda em toda página, inclusive nas públicas (/entrar, /privacidade e
// /exclusao-de-dados), e passa a lista ao AppShell, que é componente de cliente: o que ele recebe vai no
// corpo da resposta. Este caso exige que a chamada a `listAccounts(` fique dentro de um `if` que confere
// `isValidSession`, no ramo verdadeiro dele.

const RAIZ = fileURLToPath(new URL("..", import.meta.url));

function analisar(fonte: string): ts.SourceFile {
  return ts.createSourceFile("layout.tsx", fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

/** Cada chamada a `listAccounts(` e se ela está no ramo verdadeiro de um `if (isValidSession(...))`. */
function chamadasGuardadas(sf: ts.SourceFile): boolean[] {
  const saida: boolean[] = [];
  const visitar = (n: ts.Node) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "listAccounts") {
      let filho: ts.Node = n;
      let guardada = false;
      for (let pai = n.parent; pai; filho = pai, pai = pai.parent) {
        if (
          ts.isIfStatement(pai) &&
          pai.thenStatement === filho &&
          ts.isCallExpression(pai.expression) &&
          ts.isIdentifier(pai.expression.expression) &&
          pai.expression.expression.text === "isValidSession"
        ) {
          guardada = true;
          break;
        }
      }
      saida.push(guardada);
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return saida;
}

describe("o layout raiz e a lista de contas", () => {
  it("o leitor acusa quando há o que acusar", () => {
    expect(chamadasGuardadas(analisar("async function f() { const a = await listAccounts(); }"))).toEqual([false]);
    expect(
      chamadasGuardadas(analisar("async function f() { if (isValidSession(x)) { const a = await listAccounts(); } }"))
    ).toEqual([true]);
    expect(
      chamadasGuardadas(
        analisar("async function f() { if (isValidSession(x)) { t(); } else { const a = await listAccounts(); } }")
      )
    ).toEqual([false]);
  });

  it("app/layout.tsx só chama listAccounts() com a sessão conferida", () => {
    const sf = analisar(readFileSync(`${RAIZ}/app/layout.tsx`, "utf8"));
    const chamadas = chamadasGuardadas(sf);
    expect(chamadas.length).toBeGreaterThan(0);
    expect(chamadas).toEqual(chamadas.map(() => true));
  });
});
