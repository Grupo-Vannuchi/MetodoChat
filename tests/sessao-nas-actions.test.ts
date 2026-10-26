import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// A SESSÃO É CONFERIDA DENTRO DE CADA SERVER ACTION E DE CADA ROTA, e não só no proxy.ts
// (docs/specs/2026-10-26-sessao-conferida.md). A doc do Next desta versão diz que uma Server Function é
// chamada por POST na rota em que é usada, e que um caminho fora do matcher pula também a chamada
// dela; a varredura de 26/10 achou vinte ações que confiavam só no porteiro.
//
// ESTE ARQUIVO VALE PARA O QUE AINDA NÃO EXISTE: ele procura todo arquivo "use server" de `app/` e de
// `lib/`, e toda rota de `app/`, em vez de uma lista. Uma ação ou rota nova sem a conferência faz este
// arquivo cair no `npm test`, que está no `verify`.
//
// O CÓDIGO É LIDO PELO ANALISADOR DO TYPESCRIPT, e não por expressão regular: a assinatura de
// `sendReply` tem `{` antes do corpo e enganaria o molde de tests/bonus-paginas.test.ts.

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const ler = (rel: string) => readFileSync(join(RAIZ, rel), "utf8");

/** Todo arquivo .ts/.tsx debaixo de `pasta`, com o caminho relativo à raiz e barras normais. */
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

function analisar(rel: string, fonte = ler(rel)): ts.SourceFile {
  const tipo = rel.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(rel, fonte, ts.ScriptTarget.Latest, true, tipo);
}

const exportado = (s: ts.Statement) =>
  ts.canHaveModifiers(s) && (ts.getModifiers(s) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);

function ehUseServer(sf: ts.SourceFile): boolean {
  const primeira = sf.statements[0];
  return (
    !!primeira &&
    ts.isExpressionStatement(primeira) &&
    ts.isStringLiteral(primeira.expression) &&
    primeira.expression.text === "use server"
  );
}

type Achado = { nome: string; primeira: string | null };

/**
 * Cada export de um arquivo "use server" e a primeira instrução dele. Num arquivo desses todo export é
 * ação; o que não for `export async function` com corpo volta com `primeira: null`, e cai igual.
 */
function primeirasDasAcoes(sf: ts.SourceFile): Achado[] {
  const achados: Achado[] = [];
  for (const s of sf.statements) {
    if (!exportado(s) || ts.isInterfaceDeclaration(s) || ts.isTypeAliasDeclaration(s)) continue;
    if (ts.isFunctionDeclaration(s) && s.name && s.body) {
      achados.push({ nome: s.name.text, primeira: s.body.statements[0]?.getText(sf) ?? "" });
    } else {
      achados.push({ nome: s.getText(sf).split("\n")[0], primeira: null });
    }
  }
  return achados;
}

/** De onde vem o `exigirSessao` de um arquivo, e se ele confere de verdade. */
function exigirSessaoConfere(sf: ts.SourceFile): boolean {
  for (const s of sf.statements) {
    if (
      ts.isImportDeclaration(s) &&
      ts.isStringLiteral(s.moduleSpecifier) &&
      s.moduleSpecifier.text === "@/lib/exigir-sessao"
    ) {
      const nomes = s.importClause?.namedBindings;
      if (nomes && ts.isNamedImports(nomes) && nomes.elements.some((e) => e.name.text === "exigirSessao" && !e.propertyName)) {
        return true;
      }
    }
    if (ts.isFunctionDeclaration(s) && s.name?.text === "exigirSessao" && s.body) {
      return corpoConfere(s.body.getText(sf));
    }
  }
  return false;
}

const corpoConfere = (corpo: string) => /!isValidSession\(/.test(corpo) && corpo.includes('redirect("/entrar")');

// A AÇÃO DE ENTRAR É PÚBLICA POR DEFINIÇÃO: é ela que cria a sessão.
const ACOES_PUBLICAS = new Set(["app/entrar/actions.ts"]);

const arquivosUseServer = () =>
  [...arquivosDe("app"), ...arquivosDe("lib")].filter((rel) => ehUseServer(analisar(rel)));

describe("toda Server Action confere a sessão antes de qualquer coisa", () => {
  it("o leitor acusa quando há o que acusar", () => {
    const sf = analisar(
      "x.ts",
      '"use server";\nexport async function a(p: { b?: string }): Promise<{ c: 1 }> {\n  const d = 1;\n  return { c: 1 };\n}\nexport const e = async () => {};\n'
    );
    expect(ehUseServer(sf)).toBe(true);
    expect(primeirasDasAcoes(sf)).toEqual([
      { nome: "a", primeira: "const d = 1;" },
      { nome: "export const e = async () => {};", primeira: null },
    ]);
    expect(exigirSessaoConfere(analisar("y.ts", "async function exigirSessao() {}\n"))).toBe(false);
  });

  it("o leitor acha os arquivos de ação, inclusive os vinte da varredura de 26/10", () => {
    const achados = arquivosUseServer();
    for (const rel of [
      "app/account-actions.ts",
      "app/automacoes/actions.ts",
      "app/contatos/actions.ts",
      "app/conversas/[id]/actions.ts",
      "app/conversas/[id]/marcar-visto.ts",
      "app/publicar/actions.ts",
      "app/publicar/post/actions.ts",
      "app/setup/actions.ts",
      "app/bonus/actions.ts",
      "app/carrosseis/actions.ts",
      "app/entrar/actions.ts",
    ]) {
      expect(achados, rel).toContain(rel);
    }
  });

  it("cada ação começa por `await exigirSessao();`, e o `exigirSessao` dela confere", () => {
    const falhas: string[] = [];
    for (const rel of arquivosUseServer()) {
      if (ACOES_PUBLICAS.has(rel)) continue;
      const sf = analisar(rel);
      for (const a of primeirasDasAcoes(sf)) {
        if (a.primeira !== "await exigirSessao();") falhas.push(`${rel} ${a.nome}: ${a.primeira}`);
      }
      if (!exigirSessaoConfere(sf)) falhas.push(`${rel}: o exigirSessao não vem de @/lib/exigir-sessao nem confere`);
    }
    expect(falhas).toEqual([]);
  });

  it("o `exigirSessao` compartilhado confere a sessão e não é ele mesmo uma ação", () => {
    const sf = analisar("lib/exigir-sessao.ts");
    expect(ehUseServer(sf)).toBe(false);
    const f = sf.statements.find(
      (s): s is ts.FunctionDeclaration => ts.isFunctionDeclaration(s) && s.name?.text === "exigirSessao"
    );
    expect(f && exportado(f)).toBe(true);
    expect(corpoConfere(f!.body!.getText(sf))).toBe(true);
  });
});

/** Os prefixos públicos do proxy.ts, lidos do próprio arquivo. */
function prefixosPublicos(): string[] {
  const sf = analisar("proxy.ts");
  for (const s of sf.statements) {
    if (!ts.isVariableStatement(s)) continue;
    for (const d of s.declarationList.declarations) {
      if (ts.isIdentifier(d.name) && d.name.text === "PUBLIC_PREFIXES" && d.initializer && ts.isArrayLiteralExpression(d.initializer)) {
        return d.initializer.elements.filter(ts.isStringLiteral).map((e) => e.text);
      }
    }
  }
  throw new Error("PUBLIC_PREFIXES não encontrada em proxy.ts");
}

/** O caminho de URL de uma rota: `app/api/media/route.ts` → `/api/media`. */
const caminhoDaRota = (rel: string) => "/" + rel.replace(/^app\//, "").replace(/\/?route\.tsx?$/, "");

const ehPublica = (caminho: string, prefixos: string[]) =>
  prefixos.some((p) => caminho === p || caminho.startsWith(`${p}/`));

const leCookies = (s: ts.Statement, sf: ts.SourceFile) => /^const \w+ = await cookies\(\);$/.test(s.getText(sf));

function retorna(s: ts.Statement): boolean {
  if (ts.isReturnStatement(s)) return true;
  if (ts.isBlock(s)) {
    const ultima = s.statements[s.statements.length - 1];
    return !!ultima && ts.isReturnStatement(ultima);
  }
  return false;
}

/**
 * A conferência de um handler de rota: a primeira instrução que não seja `const x = await cookies();`
 * tem de ser `if (!isValidSession(...))` com um ramo que RETORNA. Presença não basta (achado 127 da
 * auditoria): uma conferência depois do trabalho, ou com o resultado ignorado, passaria.
 */
function handlerConfere(f: ts.FunctionDeclaration, sf: ts.SourceFile): boolean {
  const instrucoes = f.body?.statements ?? ts.factory.createNodeArray<ts.Statement>();
  const primeira = instrucoes.find((s) => !leCookies(s, sf));
  if (!primeira || !ts.isIfStatement(primeira)) return false;
  const c = primeira.expression;
  const negaASessao =
    ts.isPrefixUnaryExpression(c) &&
    c.operator === ts.SyntaxKind.ExclamationToken &&
    ts.isCallExpression(c.operand) &&
    ts.isIdentifier(c.operand.expression) &&
    c.operand.expression.text === "isValidSession";
  return negaASessao && retorna(primeira.thenStatement);
}

const rotas = () => arquivosDe("app").filter((rel) => /\/route\.tsx?$/.test(rel));

const METODOS_HTTP = new Set(["GET", "HEAD", "OPTIONS", "POST", "PUT", "DELETE", "PATCH"]);

/**
 * Os handlers de uma rota que NÃO estão escritos como `export function`: um `export const POST = …`,
 * um `export { GET }` ou um `export *`. O leitor de `handlerConfere` só enxerga funções, e um handler
 * desses passaria sem conferência nenhuma (achado 132 da auditoria). Hoje nenhuma rota tem essa forma.
 */
function handlersForaDeFuncao(sf: ts.SourceFile): string[] {
  const nomes: string[] = [];
  for (const s of sf.statements) {
    if (ts.isVariableStatement(s) && exportado(s)) {
      for (const d of s.declarationList.declarations) {
        if (ts.isIdentifier(d.name) && METODOS_HTTP.has(d.name.text)) nomes.push(d.name.text);
      }
    }
    if (ts.isExportDeclaration(s)) {
      if (!s.exportClause) nomes.push("*");
      else if (ts.isNamedExports(s.exportClause)) {
        for (const e of s.exportClause.elements) if (METODOS_HTTP.has(e.name.text)) nomes.push(e.name.text);
      }
    }
  }
  return nomes;
}

describe("toda rota fora das públicas confere a sessão antes de qualquer trabalho", () => {
  it("o leitor acusa quando há o que acusar", () => {
    const casos: [string, boolean][] = [
      ["export async function GET(r) {\n  if (!isValidSession(x)) return y;\n  t();\n}", true],
      ["export async function GET(r) {\n  const j = await cookies();\n  if (!isValidSession(x)) {\n    return y;\n  }\n}", true],
      ["export async function GET(r) {\n  t();\n  if (!isValidSession(x)) return y;\n}", false],
      ["export async function GET(r) {\n  if (!isValidSession(x)) {\n    log();\n  }\n  t();\n}", false],
      ["export async function GET(r) {\n  isValidSession(x);\n  t();\n}", false],
    ];
    for (const [fonte, esperado] of casos) {
      const sf = analisar("r.ts", fonte);
      const f = sf.statements[0] as ts.FunctionDeclaration;
      expect(handlerConfere(f, sf), fonte).toBe(esperado);
    }
    expect(caminhoDaRota("app/bonus/[id]/carrossel/[cid]/arte/route.tsx")).toBe("/bonus/[id]/carrossel/[cid]/arte");
    expect(
      handlersForaDeFuncao(
        analisar(
          "r.ts",
          'export const runtime = "nodejs";\nexport const POST = async () => new Response();\nexport { GET } from "./x";\nexport * from "./y";\nexport async function PUT() {}\n'
        )
      )
    ).toEqual(["POST", "GET", "*"]);
  });

  it("as públicas são as do proxy.ts, e as protegidas incluem as oito de 26/10", () => {
    const prefixos = prefixosPublicos();
    const publicas = rotas().filter((rel) => ehPublica(caminhoDaRota(rel), prefixos));
    expect(publicas).toEqual([
      "app/api/cron/daily/route.ts",
      "app/api/oauth/callback/route.ts",
      "app/api/oauth/login/route.ts",
      "app/api/queue/tick/route.ts",
      "app/api/webhook/route.ts",
    ]);
    expect(rotas().length - publicas.length).toBeGreaterThanOrEqual(8);
  });

  it("cada handler exportado de rota protegida começa conferindo a sessão", () => {
    const prefixos = prefixosPublicos();
    const falhas: string[] = [];
    for (const rel of rotas()) {
      if (ehPublica(caminhoDaRota(rel), prefixos)) continue;
      const sf = analisar(rel);
      const handlers = sf.statements.filter(
        (s): s is ts.FunctionDeclaration => ts.isFunctionDeclaration(s) && exportado(s)
      );
      if (handlers.length === 0) falhas.push(`${rel}: nenhum handler exportado como function`);
      for (const f of handlers) if (!handlerConfere(f, sf)) falhas.push(`${rel} ${f.name?.text}`);
      for (const nome of handlersForaDeFuncao(sf)) {
        falhas.push(`${rel} ${nome}: handler fora de "export async function", que este leitor não confere`);
      }
    }
    expect(falhas).toEqual([]);
  });
});
