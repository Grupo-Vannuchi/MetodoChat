import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// A LISTA DE CONTAS DO MENU SÓ É LIDA COM SESSÃO (docs/specs/2026-10-26-sessao-conferida.md).
//
// O layout raiz roda em toda página, inclusive nas públicas (/entrar, /privacidade e
// /exclusao-de-dados), e passa a lista ao AppShell, que é componente de cliente: o que ele recebe vai no
// corpo da resposta. Este caso exige que a chamada que monta a lista fique dentro de um `if` que confere
// a sessão, no ramo verdadeiro dele. Desde os logins (docs/specs/2026-11-04-logins.md), a conferência é
// `if (login)`, com `login` declarado como `await sessaoAtual()` (lib/sessao.ts), a sessão do banco.
//
// DESDE AS CONTAS POR LOGIN (docs/specs/2026-11-05-contas-por-login.md, seção 2), a lista é a do login:
// `contasDoLogin(login)` (lib/acesso.ts, o único lugar que sabe quem vê qual conta). O layout não chama
// mais `listAccounts(` nenhuma vez: com ela de volta, o seletor do login comum mostraria todas as contas.

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

/** Cada chamada a `<funcao>(` e se ela está no ramo verdadeiro de um `if (<o login da sessão>)`. */
function chamadasGuardadas(sf: ts.SourceFile, funcao: string): boolean[] {
  const daSessao = nomesDaSessao(sf);
  const saida: boolean[] = [];
  const visitar = (n: ts.Node) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === funcao) {
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
    const c = (fonte: string, funcao = "contasDoLogin") => chamadasGuardadas(analisar(fonte), funcao);
    expect(c("async function f() { const a = await contasDoLogin(login); }")).toEqual([false]);
    expect(
      c("async function f() { const login = await sessaoAtual(); if (login) { const a = await contasDoLogin(login); } }")
    ).toEqual([true]);
    expect(
      c(
        "async function f() { const login = await sessaoAtual(); if (login) { t(); } else { const a = await contasDoLogin(login); } }"
      )
    ).toEqual([false]);
    // Um `if` sobre outro nome não é a sessão.
    expect(c("async function f() { const x = await outra(); if (x) { const a = await contasDoLogin(x); } }")).toEqual([
      false,
    ]);
    // O nome antigo não vale mais.
    expect(c("async function f() { if (isValidSession(x)) { const a = await contasDoLogin(x); } }")).toEqual([false]);
    // E A `listAccounts(` É ACHADA ONDE ESTIVER, guardada ou não: o caso de baixo exige que não haja nenhuma.
    expect(
      c("async function f() { const login = await sessaoAtual(); if (login) { const a = await listAccounts(); } }", "listAccounts")
    ).toEqual([true]);
    expect(c("async function f() { const a = await listAccounts(); }", "listAccounts")).toEqual([false]);
  });

  it("app/layout.tsx só chama contasDoLogin() com a sessão conferida", () => {
    const sf = analisar(readFileSync(`${RAIZ}/app/layout.tsx`, "utf8"));
    const chamadas = chamadasGuardadas(sf, "contasDoLogin");
    expect(chamadas.length).toBeGreaterThan(0);
    expect(chamadas).toEqual(chamadas.map(() => true));
  });

  it("app/layout.tsx não chama listAccounts(): o seletor mostra só as contas do login", () => {
    const sf = analisar(readFileSync(`${RAIZ}/app/layout.tsx`, "utf8"));
    expect(chamadasGuardadas(sf, "listAccounts")).toEqual([]);
  });
});
