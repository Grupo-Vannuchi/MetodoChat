import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// O PRAZO DAS VARREDURAS (docs/specs/2026-11-18-testes-que-caem.md). Na primeira suíte de uma cópia nova, os
// casos que varrem a árvore estouravam o prazo padrão: a varredura de `tests/vocabulario-da-fila.test.ts`
// levou 5 714 ms contra os 5 s (achado 227; sozinha, 119 ms), e o `beforeAll` de `tests/proxy-matcher.test.ts`
// passou dos 10 s ao carregar o Next (achado 218). A família é de 11 arquivos, e não de três (achado 271). Em
// 18/11, numa worktree nova, as varreduras ficaram de 1,1 a 9 vezes mais lentas que na cópia quente. A causa
// da lentidão é hipótese (a primeira leitura de cada arquivo recém-escrito), e não medida.
//
// A REGRA: todo caso ou gancho que varre a árvore, e todo gancho que faz `import()`, declara prazo próprio,
// com um número literal de pelo menos 60_000 logo depois da função, como no `3c3aefd`. Um nome no lugar do
// número não vale. Os casos que leem arquivos de caminho conhecido (o maior levou 41 ms a frio) e os casos com
// `import()` (153 ms) ficam com o prazo padrão.
//
// "VARRE A ÁRVORE" é: (a) alcançar `readdirSync`, `opendirSync` ou `glob`/`globSync`, direto, por uma função
// do próprio arquivo (em qualquer nível) ou por uma função de um auxiliar de `tests/` importada pelo nome, por
// fecho; ou (b) ler o disco usando uma lista da árvore, que é uma variável cujo valor alcança uma varredura (a
// lista derivada de outra e a lista atribuída num gancho também contam). É o desenho do vocabulario: a lista
// no carregamento, a leitura no caso.
//
// CADA NOME É RESOLVIDO PELA DECLARAÇÃO VISÍVEL de onde ele é usado, pelo checker do TypeScript (achado 290):
// a casa repete nomes de função no mesmo arquivo (o `andar` de quem varre e o `andar` de quem só percorre a
// árvore do TypeScript), e juntá-los pelo nome marcava 6 casos que não leem disco. Quando a resolução falha,
// vale o nome, e o erro possível é um prazo a mais, nunca um a menos. A importação de "./aux" vai pelo nome
// local, porque o programa é montado sem resolver módulos.
//
// OS LIMITES: uma leitura dentro de uma função de `app/` ou de `lib/` não é vista; nem a importação por
// namespace ou por `default` de um auxiliar; o valor padrão que lê é guardado só para o primeiro parâmetro; a
// queda pelo nome não tem caso sintético (sem biblioteca e sem resolver módulos, um nome declarado no próprio
// arquivo sempre resolve; em 18/11 houve 0 quedas na árvore inteira); uma função global de um arquivo-script de
// `tests/` (sem `import` nem `export`), chamada de outro arquivo, não é vista (em 18/11 não havia nenhum: os 167
// arquivos importam ou exportam); e só o nível de cima de `tests/` é lido, por isso o caso que enxerga a árvore
// cai se aparecer uma subpasta.

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const PASTA = join(RAIZ, "tests");
const PRAZO_MINIMO = 60_000;

const LEITURAS_DO_FS = new Set([
  "readFileSync", "readdirSync", "statSync", "lstatSync", "existsSync", "opendirSync",
  "accessSync", "readFile", "readdir", "stat", "lstat", "access", "opendir", "globSync", "glob",
]);
// O `glob`/`globSync` do `node:fs` existe no Node 24 (achado 288): uma varredura por padrão também é varredura.
const VARREDURAS_DO_FS = new Set(["readdirSync", "opendirSync", "readdir", "opendir", "globSync", "glob"]);
const CASOS = new Set(["it", "test"]);
const GANCHOS = new Set(["beforeAll", "beforeEach", "afterAll", "afterEach"]);

type Funcao = ts.ArrowFunction | ts.FunctionExpression | ts.FunctionDeclaration;
/** Uma função que lê. `soSeOmitir = k`: ela só lê pelo valor padrão do parâmetro k, quando a chamada o omite. */
type Leitor = { varre: boolean; soSeOmitir: number | null };
type Leitura = { le: boolean; varre: boolean; importa: boolean; por: string };
type Ponto = { arquivo: string; linha: number; tipo: string; titulo: string; por: string; prazo: number | null };

const ehFuncao = (n: ts.Node | undefined): n is Funcao =>
  !!n && (ts.isArrowFunction(n) || ts.isFunctionExpression(n) || ts.isFunctionDeclaration(n));

/** O identificador está em posição de USO, e não de nome de propriedade, de declaração ou de importação. */
function ehUso(n: ts.Identifier): boolean {
  const p = n.parent;
  if (ts.isPropertyAccessExpression(p) && p.name === n) return false;
  if ((ts.isVariableDeclaration(p) || ts.isFunctionDeclaration(p) || ts.isParameter(p) || ts.isBindingElement(p)) && p.name === n) {
    return false;
  }
  return !ts.isImportSpecifier(p) && !ts.isImportClause(p);
}

/** Dos dois, o que pede mais: varrer vence ler, e ler sempre vence ler só pelo valor padrão. */
const maisForte = (a: Leitor | null, b: Leitor | null): Leitor | null =>
  !a ? b : !b ? a : (b.varre && !a.varre) || (a.soSeOmitir !== null && b.soSeOmitir === null) ? b : a;

/** Os casos e os ganchos que precisam de prazo próprio, em cada `*.test.ts` das fontes, com o prazo que têm. */
function pontos(fontes: Map<string, string>): Ponto[] {
  // Um programa do TypeScript só com as fontes, em memória, sem biblioteca e sem resolver módulos: o checker
  // serve aqui só para achar a declaração visível de cada nome.
  const DIR = "/t/";
  const nomeDe = (f: string) => (f.startsWith(DIR) ? f.slice(DIR.length) : f);
  const host: ts.CompilerHost = {
    getSourceFile: (f, versao) => {
      const texto = fontes.get(nomeDe(f));
      return texto === undefined ? undefined : ts.createSourceFile(f, texto, versao, true, ts.ScriptKind.TS);
    },
    getDefaultLibFileName: () => "lib.d.ts",
    writeFile: () => {},
    getCurrentDirectory: () => DIR,
    getCanonicalFileName: (f) => f,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => "\n",
    fileExists: (f) => fontes.has(nomeDe(f)),
    readFile: (f) => fontes.get(nomeDe(f)),
  };
  const nomes = [...fontes.keys()].sort();
  const programa = ts.createProgram(nomes.map((n) => DIR + n), { noLib: true, noResolve: true, types: [] }, host);
  const checker = programa.getTypeChecker();
  /** As declarações visíveis do nome, ou null se a resolução falhou (aí vale o nome). */
  const declaracoes = (id: ts.Identifier): readonly ts.Declaration[] | null => {
    const d = checker.getSymbolAtLocation(id)?.declarations;
    return d && d.length ? d : null;
  };

  function analisar(sf: ts.SourceFile, importados: Map<string, Leitor>) {
    // As funções, em qualquer nível, cada uma pelo nó da sua declaração.
    const funcoes: [ts.Declaration, Funcao, string][] = [];
    const juntar = (n: ts.Node): void => {
      if (ts.isFunctionDeclaration(n) && n.name) funcoes.push([n, n, n.name.text]);
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && ehFuncao(n.initializer)) funcoes.push([n, n.initializer, n.name.text]);
      ts.forEachChild(n, juntar);
    };
    juntar(sf);
    const nomesDeFuncao = new Set([...funcoes.map(([, , nome]) => nome), ...importados.keys()]);
    const porDeclaracao = new Map<ts.Declaration, Leitor>();

    const leitorDe = (id: ts.Identifier): Leitor | null => {
      if (!nomesDeFuncao.has(id.text)) return null;
      const ds = declaracoes(id);
      let l: Leitor | null = null;
      if (ds) {
        for (const d of ds) l = maisForte(l, ts.isImportSpecifier(d) ? importados.get(id.text) ?? null : porDeclaracao.get(d) ?? null);
        return l;
      }
      // A resolução falhou: vale o nome, juntando os homônimos (o lado do prazo a mais).
      l = importados.get(id.text) ?? null;
      for (const [d, , nome] of funcoes) if (nome === id.text) l = maisForte(l, porDeclaracao.get(d) ?? null);
      return l;
    };

    /** O que o nó faz com o disco: se lê, se varre e se faz `import()`, com o primeiro motivo de cada. */
    const leitura = (no: ts.Node): Leitura => {
      let porVarre = "";
      let porLe = "";
      let importa = false;
      const marcar = (por: string, varre: boolean) => {
        if (varre && !porVarre) porVarre = por;
        if (!porLe) porLe = por;
      };
      const andar = (n: ts.Node): void => {
        if (ts.isCallExpression(n)) {
          if (n.expression.kind === ts.SyntaxKind.ImportKeyword) importa = true;
          const alvo = n.expression;
          const nome = ts.isIdentifier(alvo) ? alvo.text : ts.isPropertyAccessExpression(alvo) ? alvo.name.text : null;
          if (nome && LEITURAS_DO_FS.has(nome)) marcar(nome, VARREDURAS_DO_FS.has(nome));
          const l = ts.isIdentifier(alvo) ? leitorDe(alvo) : null;
          if (l && ts.isIdentifier(alvo)) {
            if (l.soSeOmitir === null || n.arguments.length <= l.soSeOmitir) marcar(alvo.text, l.varre);
            n.arguments.forEach(andar);
            return;
          }
        } else if (ts.isIdentifier(n) && ehUso(n) && !(ts.isCallExpression(n.parent) && n.parent.expression === n)) {
          // Uma função que lê, passada como valor (ex.: arquivos.map(ler)): conta, sem saber os argumentos.
          const l = leitorDe(n);
          if (l) marcar(n.text, l.varre);
        }
        ts.forEachChild(n, andar);
      };
      andar(no);
      return { le: porLe !== "", varre: porVarre !== "", importa, por: porVarre || porLe || (importa ? "import()" : "") };
    };

    const leitorDaFuncao = (fn: Funcao): Leitor | null => {
      const doCorpo = fn.body ? leitura(fn.body) : null;
      if (doCorpo?.le) return { varre: doCorpo.varre, soSeOmitir: null };
      for (let k = 0; k < fn.parameters.length; k++) {
        const inicial = fn.parameters[k].initializer;
        const doPadrao = inicial ? leitura(inicial) : null;
        if (doPadrao?.le) return { varre: doPadrao.varre, soSeOmitir: k };
      }
      return null;
    };
    for (let mudou = true; mudou; ) {
      mudou = false;
      for (const [decl, fn] of funcoes) {
        const antes = porDeclaracao.get(decl) ?? null;
        const depois = maisForte(antes, leitorDaFuncao(fn));
        if (depois && depois !== antes) {
          porDeclaracao.set(decl, depois);
          mudou = true;
        }
      }
    }

    // As listas da árvore: variáveis declaradas ou atribuídas cujo valor varre, ou vem de outra lista, por fecho.
    const valores: [readonly ts.Declaration[] | null, string, ts.Expression][] = [];
    const juntarValores = (n: ts.Node): void => {
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && !ehFuncao(n.initializer)) {
        valores.push([[n], n.name.text, n.initializer]);
      }
      if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(n.left)) {
        valores.push([declaracoes(n.left), n.left.text, n.right]);
      }
      ts.forEachChild(n, juntarValores);
    };
    juntarValores(sf);
    const nomesDeValor = new Set(valores.map(([, nome]) => nome));
    const listas = new Set<ts.Declaration>();
    const listasPeloNome = new Set<string>();
    const usaLista = (no: ts.Node): string => {
      let achada = "";
      const andar = (n: ts.Node): void => {
        if (achada) return;
        if (ts.isIdentifier(n) && nomesDeValor.has(n.text) && ehUso(n)) {
          const ds = declaracoes(n);
          const eh = ds ? ds.some((d) => listas.has(d)) : listasPeloNome.has(n.text);
          if (eh) {
            achada = n.text;
            return;
          }
        }
        ts.forEachChild(n, andar);
      };
      andar(no);
      return achada;
    };
    for (let mudou = true; mudou; ) {
      mudou = false;
      for (const [ds, nome, valor] of valores) {
        const ja = ds ? ds.every((d) => listas.has(d)) : listasPeloNome.has(nome);
        if (!ja && (leitura(valor).varre || usaLista(valor))) {
          if (ds) ds.forEach((d) => listas.add(d));
          listasPeloNome.add(nome);
          mudou = true;
        }
      }
    }
    return { porDeclaracao, leitorDe, leitura, usaLista };
  }

  /** Os nomes locais importados de "./x" que, no auxiliar x, são leitores do topo. */
  const importadosQueLeem = (sf: ts.SourceFile, porModulo: Map<string, Map<string, Leitor>>) => {
    const locais = new Map<string, Leitor>();
    for (const st of sf.statements) {
      if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier)) continue;
      const m = /^\.\/([\w-]+?)(\.ts)?$/.exec(st.moduleSpecifier.text);
      const doModulo = m ? porModulo.get(m[1]) : undefined;
      const nomeados = st.importClause?.namedBindings;
      if (!doModulo || !nomeados || !ts.isNamedImports(nomeados)) continue;
      for (const el of nomeados.elements) {
        const l = doModulo.get((el.propertyName ?? el.name).text);
        if (l) locais.set(el.name.text, l);
      }
    }
    return locais;
  };

  // Os auxiliares de tests/ (sem .test.): os leitores do topo, pelo nome; duas voltas, para um que importa outro.
  const porModulo = new Map<string, Map<string, Leitor>>();
  for (let volta = 0; volta < 2; volta++) {
    for (const nome of nomes) {
      const sf = programa.getSourceFile(DIR + nome);
      if (/\.test\.ts$/.test(nome) || !sf) continue;
      const { porDeclaracao } = analisar(sf, importadosQueLeem(sf, porModulo));
      const doTopo = new Map<string, Leitor>();
      for (const st of sf.statements) {
        if (ts.isFunctionDeclaration(st) && st.name) {
          const l = porDeclaracao.get(st);
          if (l) doTopo.set(st.name.text, l);
        }
        if (ts.isVariableStatement(st)) {
          for (const d of st.declarationList.declarations) {
            const ld = porDeclaracao.get(d);
            if (ts.isIdentifier(d.name) && ld) doTopo.set(d.name.text, ld);
          }
        }
      }
      porModulo.set(nome.replace(/\.ts$/, ""), doTopo);
    }
  }

  const saida: Ponto[] = [];
  for (const nome of nomes) {
    const sf = programa.getSourceFile(DIR + nome);
    if (!/\.test\.ts$/.test(nome) || !sf) continue;
    const { leitorDe, leitura, usaLista } = analisar(sf, importadosQueLeem(sf, porModulo));
    const andar = (n: ts.Node): void => {
      if (ts.isCallExpression(n)) {
        // it(...), it.skip(...), it.each(T)(...), beforeAll(...)
        let base: ts.Expression = ts.isCallExpression(n.expression) ? n.expression.expression : n.expression;
        while (ts.isPropertyAccessExpression(base)) base = base.expression;
        const tipo = ts.isIdentifier(base) ? (CASOS.has(base.text) ? "caso" : GANCHOS.has(base.text) ? base.text : null) : null;
        // O corpo: a primeira função escrita ali, ou um leitor passado pelo nome no lugar dela.
        let i = tipo ? n.arguments.findIndex((a) => ehFuncao(a)) : -1;
        if (tipo && i < 0) i = n.arguments.findIndex((a) => ts.isIdentifier(a) && leitorDe(a) !== null);
        if (tipo && i >= 0) {
          const corpo = n.arguments[i];
          const l = ts.isIdentifier(corpo) ? leitorDe(corpo) : null;
          const r: Leitura = l && ts.isIdentifier(corpo) ? { le: true, varre: l.varre, importa: false, por: corpo.text } : leitura(corpo);
          const lista = r.le && !r.varre ? usaLista(corpo) : "";
          const varre = r.varre || lista !== "";
          if (varre || (tipo !== "caso" && r.importa)) {
            const depois = n.arguments[i + 1];
            const prazo = depois && ts.isNumericLiteral(depois) ? Number(depois.text.replace(/_/g, "")) : null;
            const primeiro = n.arguments[0];
            const titulo =
              tipo !== "caso" || !primeiro ? "" : ts.isStringLiteralLike(primeiro) ? primeiro.text : primeiro.getText(sf);
            const linha = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
            const por = lista ? `${r.por} sobre a lista ${lista}` : varre ? r.por : "import()";
            saida.push({ arquivo: `tests/${nome}`, linha, tipo, titulo, por, prazo });
          }
        }
      }
      ts.forEachChild(n, andar);
    };
    andar(sf);
  }
  return saida;
}

const texto = (p: Ponto) => `${p.arquivo}:${p.linha} ${p.tipo === "caso" ? `caso «${p.titulo}»` : p.tipo} (por ${p.por})`;
const semPrazo = (ps: Ponto[]) => ps.filter((p) => p.prazo === null || p.prazo < PRAZO_MINIMO).map(texto);

function fontesDeTests(): Map<string, string> {
  const fontes = new Map<string, string>();
  for (const nome of readdirSync(PASTA)) {
    if (/\.ts$/.test(nome)) fontes.set(nome, readFileSync(join(PASTA, nome), "utf8"));
  }
  return fontes;
}

const subpastasDeTests = () => readdirSync(PASTA).filter((nome) => statSync(join(PASTA, nome)).isDirectory());

describe("o prazo das varreduras", () => {
  const a = (fontes: Record<string, string>) => semPrazo(pontos(new Map(Object.entries(fontes))));
  const fs = 'import { readdirSync, readFileSync } from "node:fs";\n';

  it("o leitor acusa quando há o que acusar", () => {
    // um readdirSync no caso
    expect(a({ "x.test.ts": `${fs}it("a", () => { readdirSync("app"); });` })).toEqual([
      "tests/x.test.ts:2 caso «a» (por readdirSync)",
    ]);
    // dentro de uma função do arquivo, chamada pelo caso
    expect(a({ "x.test.ts": `${fs}function varrer() { return readdirSync("app"); }\nit("a", () => { varrer(); });` })).toEqual([
      "tests/x.test.ts:3 caso «a» (por varrer)",
    ]);
    // numa função de um auxiliar de tests/, importada pelo nome
    expect(
      a({
        "aux.ts": `${fs}export function varrer() { return readdirSync("app"); }`,
        "x.test.ts": 'import { varrer } from "./aux";\nit("a", () => { varrer(); });',
      })
    ).toEqual(["tests/x.test.ts:2 caso «a» (por varrer)"]);
    // uma varredura por padrão (glob)
    expect(a({ "x.test.ts": 'import { globSync } from "node:fs";\nit("a", () => { globSync("app/**/*.ts"); });' })).toEqual([
      "tests/x.test.ts:2 caso «a» (por globSync)",
    ]);
    // um leitor declarado dentro do describe, sobre uma lista do describe
    expect(
      a({
        "x.test.ts": `${fs}describe("d", () => {\n  const ler = (f: string) => readFileSync(f, "utf8");\n  const L = readdirSync("app");\n  it("a", () => { for (const f of L) ler(f); });\n});`,
      })
    ).toEqual(["tests/x.test.ts:5 caso «a» (por ler sobre a lista L)"]);
    // o nome visível varre, e o homônimo de outro escopo não
    expect(
      a({ "x.test.ts": `${fs}function outra() { const andar = () => 1; return andar(); }\nconst andar = () => readdirSync("app");\nit("a", () => { andar(); });` })
    ).toEqual(["tests/x.test.ts:4 caso «a» (por andar)"]);
    // a lista no topo, a leitura no caso
    expect(a({ "x.test.ts": `${fs}const L = readdirSync("app");\nit("a", () => { for (const f of L) readFileSync(f); });` })).toEqual([
      "tests/x.test.ts:3 caso «a» (por readFileSync sobre a lista L)",
    ]);
    // a lista derivada de outra lista
    expect(
      a({ "x.test.ts": `${fs}const L = readdirSync("app");\nconst M = L.filter((f) => f.endsWith(".ts"));\nit("a", () => { for (const f of M) readFileSync(f); });` })
    ).toEqual(["tests/x.test.ts:4 caso «a» (por readFileSync sobre a lista M)"]);
    // a lista atribuída num gancho (que tem o seu prazo)
    expect(
      a({ "x.test.ts": `${fs}let L: string[] = [];\nbeforeAll(() => { L = readdirSync("app"); }, 60_000);\nit("a", () => { for (const f of L) readFileSync(f); });` })
    ).toEqual(["tests/x.test.ts:4 caso «a» (por readFileSync sobre a lista L)"]);
    // um gancho que varre
    expect(a({ "x.test.ts": `${fs}beforeAll(() => { readdirSync("app"); });` })).toEqual(["tests/x.test.ts:2 beforeAll (por readdirSync)"]);
    // um gancho com import()
    expect(a({ "x.test.ts": 'beforeAll(async () => { await import("next/x"); });' })).toEqual(["tests/x.test.ts:1 beforeAll (por import())"]);
    // um prazo abaixo do mínimo
    expect(a({ "x.test.ts": `${fs}it("a", () => { readdirSync("app"); }, 5_000);` })).toEqual(["tests/x.test.ts:2 caso «a» (por readdirSync)"]);
    // um nome no lugar do número
    expect(a({ "x.test.ts": `${fs}const PRAZO = 60_000;\nit("a", () => { readdirSync("app"); }, PRAZO);` })).toEqual([
      "tests/x.test.ts:3 caso «a» (por readdirSync)",
    ]);
    // um leitor passado pelo nome no lugar do corpo
    expect(a({ "x.test.ts": `${fs}function lerTudo() { readdirSync("app"); }\nit("a", lerTudo);` })).toEqual([
      "tests/x.test.ts:3 caso «a» (por lerTudo)",
    ]);
  });

  it("não acusa o que não varre", () => {
    // um arquivo de caminho conhecido
    expect(a({ "x.test.ts": `${fs}it("a", () => { readFileSync("app/x.ts", "utf8"); });` })).toEqual([]);
    // a lista usada sem ler o disco
    expect(a({ "x.test.ts": `${fs}const L = readdirSync("app");\nit("a", () => { expect(L.length).toBeGreaterThan(0); });` })).toEqual([]);
    // o leitor que só lê pelo valor padrão, chamado com o texto: não lê nada
    expect(
      a({
        "x.test.ts": `${fs}const L = readdirSync("app");\nfunction analisar(rel: string, fonte = readFileSync(rel, "utf8")) { return fonte; }\nit("a", () => { for (const f of L) analisar(f, "const x = 1;"); });`,
      })
    ).toEqual([]);
    // um nome igual em outro escopo, que varre: o caso chama o visível, que não lê (o "andar" da casa)
    expect(
      a({
        "x.test.ts": `${fs}function varrer() {\n  const andar = () => readdirSync("app");\n  return andar();\n}\nfunction percorrer() {\n  const andar = () => 1;\n  return andar();\n}\nit("a", () => { percorrer(); });`,
      })
    ).toEqual([]);
    // o prazo no lugar certo, inclusive um maior
    expect(a({ "x.test.ts": `${fs}it("a", () => { readdirSync("app"); }, 60_000);\nit("b", () => { readdirSync("lib"); }, 900_000);` })).toEqual([]);
    // um caso (e não um gancho) com import(): fica com o prazo padrão
    expect(a({ "x.test.ts": 'it("a", async () => { await import("./x"); });' })).toEqual([]);
  });

  it("enxerga a árvore que diz enxergar", () => {
    // Um guarda que não acha nada passa por vacuidade. Este caso é o que impede isso.
    expect(subpastasDeTests(), "tests/ tem subpasta: o leitor lê só o nível de cima e precisa ser estendido").toEqual([]);
    const achados = pontos(fontesDeTests());
    const acha = (arquivo: string, tipo: string, inicio: string) =>
      achados.some((p) => p.arquivo === arquivo && p.tipo === tipo && p.titulo.startsWith(inicio));
    expect(acha("tests/vocabulario-da-fila.test.ts", "caso", "varre a árvore de verdade")).toBe(true);
    expect(acha("tests/proxy-matcher.test.ts", "beforeAll", "")).toBe(true);
    expect(acha("tests/prazo-das-varreduras.test.ts", "caso", "todo caso ou gancho que varre a árvore")).toBe(true);
  }, 60_000);

  it("todo caso ou gancho que varre a árvore, e todo gancho com import(), têm prazo próprio", () => {
    expect(semPrazo(pontos(fontesDeTests()))).toEqual([]);
  }, 60_000);
});
