import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// A LISTA DE CONTAS DO MENU SÓ É LIDA COM SESSÃO (docs/specs/2026-10-26-sessao-conferida.md).
//
// O layout raiz roda em toda página, inclusive nas públicas (/entrar, /privacidade e
// /exclusao-de-dados), e passa a lista ao AppShell, que é componente de cliente: o que ele recebe vai no
// corpo da resposta. Este caso exige que a chamada a `listAccounts(` fique dentro de um `if` que confere
// a sessão, no ramo verdadeiro dele. Desde os logins (docs/specs/2026-11-04-logins.md), a conferência é
// `if (login)`, com `login` declarado como `await sessaoAtual()` (lib/sessao.ts), a sessão do banco.

const RAIZ = fileURLToPath(new URL("..", import.meta.url));

function analisar(fonte: string): ts.SourceFile {
  return ts.createSourceFile("layout.tsx", fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

/** Os nomes declarados como `const x = await sessaoAtual();`. */
function nomesDaSessao(sf: ts.SourceFile): Set<string> {
  const nomes = new Set<string>();
  const visitar = (n: ts.Node) => {
    if (
      ts.isVariableDeclaration(n) &&
      ts.isIdentifier(n.name) &&
      n.initializer &&
      ts.isAwaitExpression(n.initializer) &&
      ts.isCallExpression(n.initializer.expression) &&
      ts.isIdentifier(n.initializer.expression.expression) &&
      n.initializer.expression.expression.text === "sessaoAtual"
    ) {
      nomes.add(n.name.text);
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return nomes;
}

/** Cada chamada a `listAccounts(` e se ela está no ramo verdadeiro de um `if (<o login da sessão>)`. */
function chamadasGuardadas(sf: ts.SourceFile): boolean[] {
  const daSessao = nomesDaSessao(sf);
  const saida: boolean[] = [];
  const visitar = (n: ts.Node) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "listAccounts") {
      let filho: ts.Node = n;
      let guardada = false;
      for (let pai = n.parent; pai; filho = pai, pai = pai.parent) {
        if (
          ts.isIfStatement(pai) &&
          pai.thenStatement === filho &&
          ts.isIdentifier(pai.expression) &&
          daSessao.has(pai.expression.text)
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
      chamadasGuardadas(
        analisar("async function f() { const login = await sessaoAtual(); if (login) { const a = await listAccounts(); } }")
      )
    ).toEqual([true]);
    expect(
      chamadasGuardadas(
        analisar(
          "async function f() { const login = await sessaoAtual(); if (login) { t(); } else { const a = await listAccounts(); } }"
        )
      )
    ).toEqual([false]);
    // Um `if` sobre outro nome não é a sessão.
    expect(
      chamadasGuardadas(analisar("async function f() { const x = await outra(); if (x) { const a = await listAccounts(); } }"))
    ).toEqual([false]);
    // O nome antigo não vale mais.
    expect(
      chamadasGuardadas(analisar("async function f() { if (isValidSession(x)) { const a = await listAccounts(); } }"))
    ).toEqual([false]);
  });

  it("app/layout.tsx só chama listAccounts() com a sessão conferida", () => {
    const sf = analisar(readFileSync(`${RAIZ}/app/layout.tsx`, "utf8"));
    const chamadas = chamadasGuardadas(sf);
    expect(chamadas.length).toBeGreaterThan(0);
    expect(chamadas).toEqual(chamadas.map(() => true));
  });
});
