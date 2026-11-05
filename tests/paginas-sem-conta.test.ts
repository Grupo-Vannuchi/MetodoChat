import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// AS PÁGINAS SEM CONTA DECIDEM PELO PAPEL (docs/specs/2026-11-05-contas-por-login.md, seção 3): "O comum sem
// contas vê, nas páginas de conta, a frase 'Você ainda não tem contas. Peça ao administrador.' no lugar do
// convite para conectar." O administrador continua vendo o de hoje: o texto e o link para a Configuração. O
// comum não conecta conta, e a Configuração o mandaria para o início.
//
// O CRITÉRIO, lido pelo analisador do TypeScript, e não por expressão regular:
//   1. todo pedaço do convite de hoje (o texto que manda conectar, o link para /setup e o link para
//      /api/oauth/login, o começo da conexão, que é do administrador desde a F3) está no ramo do
//      administrador: o segundo argumento de `textoSemConta(`, ou o ramo verdadeiro de um `?:`, de um `&&`
//      ou de um `if` cuja condição é o papel (`administrador`, ou `x.administrador`), ou o ramo falso quando a
//      condição é o papel negado;
//   2. a página usa a frase do comum: `FRASE_SEM_CONTAS` ou `textoSemConta`, importadas de
//      @/lib/logins-textos;
//   3. e a varredura vale para o que ainda não existe: nenhum arquivo de tela de `app/` tem o convite fora do
//      ramo do administrador. Ficam de fora a Configuração (app/setup, só do administrador), as actions e as
//      rotas, que não são páginas.

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const ler = (rel: string) => readFileSync(join(RAIZ, rel), "utf8");

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

/** O texto do convite de hoje: o que manda conectar uma conta, ou diz que não há conta. */
const CONVITE = /Conecte uma conta|Nenhuma conta (conectada|selecionada)|Comece conectando|Nenhuma conta do Instagram está conectada/;
/** As constantes que guardam o convite fora da página. */
const CONSTANTES_DO_CONVITE = new Set(["TEXTO_ARTE_SEM_CONTA"]);
/**
 * Os destinos que só o administrador alcança: a Configuração, e o começo da conexão de uma conta, que manda o
 * comum para o início (app/api/oauth/login/route.ts, F3). O "Reconectar" do Início é um deles.
 */
const DESTINOS_DO_ADMINISTRADOR = new Set(["/setup", "/api/oauth/login"]);

// O PAPEL, PELO NOME: `administrador` (o do login da sessão, ou a prop que o leva), e `podeConectar`, a prop do
// seletor de conta (app/account-switcher.tsx), que a casca enche com o papel (app/app-shell.tsx).
const NOMES_DO_PAPEL = new Set(["administrador", "podeConectar"]);

/** Se a expressão é o papel: `administrador`, `x.administrador` ou `x?.administrador`, com parênteses ou não. */
function ehOPapel(e: ts.Expression): boolean {
  while (ts.isParenthesizedExpression(e)) e = e.expression;
  if (ts.isIdentifier(e)) return NOMES_DO_PAPEL.has(e.text);
  if (ts.isPropertyAccessExpression(e)) return NOMES_DO_PAPEL.has(e.name.text);
  return false;
}

/**
 * O papel, ou o papel negado, ou nenhum dos dois. Uma cadeia de `&&` com o papel num dos lados também é o
 * papel: o que ela guarda só roda com todos os lados verdadeiros, o papel entre eles.
 */
function papelDa(e: ts.Expression): "sim" | "nao" | null {
  while (ts.isParenthesizedExpression(e)) e = e.expression;
  if (ts.isPrefixUnaryExpression(e) && e.operator === ts.SyntaxKind.ExclamationToken) return ehOPapel(e.operand) ? "nao" : null;
  if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
    return papelDa(e.left) === "sim" || papelDa(e.right) === "sim" ? "sim" : null;
  }
  return ehOPapel(e) ? "sim" : null;
}

const contem = (pai: ts.Node | undefined, filho: ts.Node) => !!pai && filho.pos >= pai.pos && filho.end <= pai.end;

/** Se o nó está no ramo do administrador, subindo pelos pais. */
function noRamoDoAdministrador(no: ts.Node): boolean {
  for (let p = no.parent; p; p = p.parent) {
    if (ts.isCallExpression(p) && ts.isIdentifier(p.expression) && p.expression.text === "textoSemConta") {
      if (contem(p.arguments[1], no)) return true;
    }
    if (ts.isConditionalExpression(p)) {
      const papel = papelDa(p.condition);
      if (papel === "sim" && contem(p.whenTrue, no)) return true;
      if (papel === "nao" && contem(p.whenFalse, no)) return true;
    }
    if (ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
      if (papelDa(p.left) === "sim" && contem(p.right, no)) return true;
    }
    if (ts.isIfStatement(p)) {
      const papel = papelDa(p.expression);
      if (papel === "sim" && contem(p.thenStatement, no)) return true;
      if (papel === "nao" && contem(p.elseStatement, no)) return true;
    }
  }
  return false;
}

/** Os pedaços do convite de hoje: o texto, a constante e os links do administrador, com a linha de cada um. */
function pedacosDoConvite(sf: ts.SourceFile): { no: ts.Node; linha: number; texto: string }[] {
  const achados: { no: ts.Node; linha: number; texto: string }[] = [];
  const anotar = (no: ts.Node, texto: string) =>
    achados.push({ no, linha: sf.getLineAndCharacterOfPosition(no.getStart(sf)).line + 1, texto });
  const andar = (n: ts.Node) => {
    if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isJsxText(n)) && CONVITE.test(n.text)) {
      anotar(n, n.text.trim());
    }
    if (ts.isIdentifier(n) && CONSTANTES_DO_CONVITE.has(n.text) && !ts.isImportSpecifier(n.parent)) anotar(n, n.text);
    if (
      ts.isJsxAttribute(n) &&
      n.name.getText(sf) === "href" &&
      n.initializer &&
      ts.isStringLiteral(n.initializer) &&
      DESTINOS_DO_ADMINISTRADOR.has(n.initializer.text)
    ) {
      anotar(n, `href="${n.initializer.text}"`);
    }
    ts.forEachChild(n, andar);
  };
  andar(sf);
  return achados;
}

/** Os pedaços do convite FORA do ramo do administrador: o que este arquivo acusa. */
const soltos = (sf: ts.SourceFile) =>
  pedacosDoConvite(sf)
    .filter((p) => !noRamoDoAdministrador(p.no))
    .map((p) => `${sf.fileName}:${p.linha} ${p.texto}`);

/** Se o arquivo importa de @/lib/logins-textos a frase do comum, e a usa. */
function usaAFraseDoComum(sf: ts.SourceFile): boolean {
  const nomes = new Set<string>();
  for (const s of sf.statements) {
    if (!ts.isImportDeclaration(s) || !ts.isStringLiteral(s.moduleSpecifier) || s.moduleSpecifier.text !== "@/lib/logins-textos") continue;
    const ligados = s.importClause?.namedBindings;
    if (!ligados || !ts.isNamedImports(ligados)) continue;
    for (const e of ligados.elements) {
      if (["FRASE_SEM_CONTAS", "textoSemConta"].includes((e.propertyName ?? e.name).text)) nomes.add(e.name.text);
    }
  }
  let usa = false;
  const andar = (n: ts.Node) => {
    if (ts.isIdentifier(n) && nomes.has(n.text) && !ts.isImportSpecifier(n.parent)) usa = true;
    ts.forEachChild(n, andar);
  };
  andar(sf);
  return usa;
}

// AS PÁGINAS DE CONTA COM O CONVITE DE HOJE, medidas no 606b743. A revisão do carrossel entrou pela constante
// `TEXTO_ARTE_SEM_CONTA` ("Nenhuma conta do Instagram está conectada no Chat"), que ela mostra quando não há
// conta para o cabeçalho.
const PAGINAS = [
  "app/page.tsx",
  "app/automacoes/page.tsx",
  "app/contatos/page.tsx",
  "app/conversas/[id]/page.tsx",
  "app/conversas/lista.tsx",
  "app/desempenho/page.tsx",
  "app/eventos/page.tsx",
  "app/publicar/page.tsx",
  "app/publicar/novo/page.tsx",
  "app/bonus/[id]/carrossel/[cid]/revisao.tsx",
];

// O QUE A VARREDURA DEIXA PASSAR, com o motivo. Não é o convite de quem não tem conta: é um link para a
// Configuração numa tela de conta, para o administrador escrever as perguntas de abertura.
const FORA_DA_VARREDURA = new Set([
  // O editor de uma automação de "pergunta de abertura" diz que as perguntas moram na Configuração.
  'app/automacoes/editor/painel.tsx href="/setup"',
]);

/** Os arquivos de tela de `app/`: fora a Configuração, as actions e as rotas. */
const arquivosDeTela = () =>
  arquivosDe("app").filter(
    (rel) =>
      !rel.startsWith("app/setup/") &&
      !/\/route\.tsx?$/.test(rel) &&
      !(() => {
        const primeira = analisar(rel).statements[0];
        return (
          !!primeira &&
          ts.isExpressionStatement(primeira) &&
          ts.isStringLiteral(primeira.expression) &&
          primeira.expression.text === "use server"
        );
      })()
  );

describe("as páginas sem conta decidem pelo papel", () => {
  it("o leitor acusa quando há o que acusar", () => {
    const s = (fonte: string) => soltos(analisar("x.tsx", fonte));
    // O convite solto: acusa o texto e o link.
    expect(s('const a = <p>Conecte uma conta do Instagram primeiro. <Link href="/setup">Configuração</Link></p>;')).toEqual([
      "x.tsx:1 Conecte uma conta do Instagram primeiro.",
      'x.tsx:1 href="/setup"',
    ]);
    // Uma condição que não é o papel não guarda.
    expect(s('const a = conta ? "x" : "Nenhuma conta selecionada.";')).toEqual(["x.tsx:1 Nenhuma conta selecionada."]);
    // O ramo do administrador guarda, nas quatro formas.
    expect(s('const a = login?.administrador ? <Link href="/setup">Nenhuma conta conectada ainda.</Link> : FRASE_SEM_CONTAS;')).toEqual([]);
    expect(s("const a = !administrador ? FRASE_SEM_CONTAS : <p>Nenhuma conta conectada ainda.</p>;")).toEqual([]);
    expect(s('const a = administrador && <Link href="/setup">Configuração</Link>;')).toEqual([]);
    expect(s('const a = podeConectar ? <Link href="/setup">Conectar Instagram</Link> : null;')).toEqual([]);
    // O começo da conexão também é do administrador: solto, acusa; no ramo dele, não.
    expect(s('const a = conta && <a href="/api/oauth/login">Reconectar</a>;')).toEqual(['x.tsx:1 href="/api/oauth/login"']);
    expect(s('const a = conta && administrador && <a href="/api/oauth/login">Reconectar</a>;')).toEqual([]);
    expect(s('function f() { if (quem.administrador) return <p>Conecte uma conta</p>; return null; }')).toEqual([]);
    expect(s('const a = textoSemConta(administrador, "Nenhuma conta selecionada.");')).toEqual([]);
    // O ramo do comum não guarda: o convite ali é o defeito.
    expect(s('const a = administrador ? FRASE_SEM_CONTAS : "Conecte uma conta do Instagram primeiro.";')).toEqual([
      "x.tsx:1 Conecte uma conta do Instagram primeiro.",
    ]);
    expect(s('const a = textoSemConta("Nenhuma conta selecionada.", x);')).toEqual(["x.tsx:1 Nenhuma conta selecionada."]);
    // A constante do convite conta; o import dela, não. O comentário não conta.
    expect(s('import { TEXTO_ARTE_SEM_CONTA } from "x";\n// Conecte uma conta\nconst a = TEXTO_ARTE_SEM_CONTA;')).toEqual([
      "x.tsx:3 TEXTO_ARTE_SEM_CONTA",
    ]);
    // A frase do comum: importada de @/lib/logins-textos e usada.
    expect(usaAFraseDoComum(analisar("x.tsx", 'import { FRASE_SEM_CONTAS } from "@/lib/logins-textos";\nconst a = FRASE_SEM_CONTAS;'))).toBe(true);
    expect(usaAFraseDoComum(analisar("x.tsx", 'import { FRASE_SEM_CONTAS } from "@/lib/logins-textos";\nconst a = 1;'))).toBe(false);
    expect(usaAFraseDoComum(analisar("x.tsx", 'import { textoSemConta } from "./outro";\nconst a = textoSemConta(x, "y");'))).toBe(false);
  });

  it.each(PAGINAS)("%s tem o convite de hoje, e ele está todo no ramo do administrador", (rel) => {
    const sf = analisar(rel);
    expect(pedacosDoConvite(sf).length, "a página tem de ter o convite de hoje, para o administrador").toBeGreaterThan(0);
    expect(soltos(sf)).toEqual([]);
  });

  it.each(PAGINAS)("%s usa a frase do comum", (rel) => {
    expect(usaAFraseDoComum(analisar(rel))).toBe(true);
  });

  it("o layout das conversas passa o papel à lista, que é de cliente", () => {
    const sf = analisar("app/conversas/layout.tsx");
    let passa = false;
    const andar = (n: ts.Node) => {
      if ((ts.isJsxSelfClosingElement(n) || ts.isJsxOpeningElement(n)) && n.tagName.getText(sf) === "Lista") {
        passa = n.attributes.properties.some((a) => ts.isJsxAttribute(a) && a.name.getText(sf) === "administrador");
      }
      ts.forEachChild(n, andar);
    };
    andar(sf);
    expect(passa).toBe(true);
  });

  it("nenhum arquivo de tela de app/ tem o convite fora do ramo do administrador", () => {
    const fora = (achado: string) => FORA_DA_VARREDURA.has(achado.replace(/:\d+ /, " "));
    expect(arquivosDeTela().flatMap((rel) => soltos(analisar(rel))).filter((a) => !fora(a))).toEqual([]);
  });

  it("a lista do que a varredura deixa passar não envelhece: cada item ainda existe", () => {
    const todos = new Set(arquivosDeTela().flatMap((rel) => soltos(analisar(rel)).map((a) => a.replace(/:\d+ /, " "))));
    expect([...FORA_DA_VARREDURA].filter((item) => !todos.has(item))).toEqual([]);
  });
});
