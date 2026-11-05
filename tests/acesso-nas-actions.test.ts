import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// TODA ACTION E TODA ROTA PASSA PELA REGRA DAS CONTAS (docs/specs/2026-11-05-contas-por-login.md, "Os testes").
// A regra mora em lib/acesso.ts, e o carrossel pergunta a ela por lib/bonus/carrossel-acesso.ts. Cada action
// exportada de um arquivo "use server" de `app/` e de `lib/`, e cada handler exportado de rota de `app/`, faz
// uma de três coisas:
//
//   1. chama `exigirAdministrador(` no corpo (lib/exigir-sessao.ts);
//   2. chama uma das funções da regra no corpo, direto ou por uma função local do mesmo arquivo que chame
//      (seguidas até o fim, sem laço);
//   3. está na lista fechada de baixo, com o motivo.
//
// ESTE ARQUIVO VALE PARA O QUE AINDA NÃO EXISTE, no molde de tests/sessao-nas-actions.test.ts: ele procura
// os arquivos em vez de uma lista. Uma action nova sem conferência faz este arquivo cair no `npm test`.
//
// O CÓDIGO É LIDO PELO ANALISADOR DO TYPESCRIPT, e o nome conta só quando é importado do módulo da regra:
// uma função local com o nome de uma da regra não passa por ela.

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

/** As funções da regra, pelo módulo de onde têm de vir. */
const DA_REGRA: Record<string, string[]> = {
  "@/lib/account": ["getSelectedAccount", "getSelectedAccountId"],
  "@/lib/acesso": ["contasDoLogin", "podeVerConta", "contaEscolhida", "soAsDoLogin"],
  // A CONTA DO MENU DO CARROSSEL não passa pela `getSelectedAccountId`, que lê a linha com o token (achado 60):
  // ela escolhe nas contas do login (`cabecalhosDoLogin`), com a mesma escolha pura.
  "@/lib/bonus/carrossel-acesso": ["cabecalhosDoLogin", "carrosselDeOutraConta", "contaDoMenuNoCarrossel"],
};
const DO_ADMINISTRADOR: Record<string, string[]> = { "@/lib/exigir-sessao": ["exigirAdministrador"] };

/** Os nomes locais que o arquivo importou de um destes módulos, com o nome de lá numa destas listas. */
function importados(sf: ts.SourceFile, modulos: Record<string, string[]>): Set<string> {
  const nomes = new Set<string>();
  for (const s of sf.statements) {
    if (!ts.isImportDeclaration(s) || !ts.isStringLiteral(s.moduleSpecifier)) continue;
    const aceitos = modulos[s.moduleSpecifier.text];
    const ligados = s.importClause?.namedBindings;
    if (!aceitos || !ligados || !ts.isNamedImports(ligados)) continue;
    for (const e of ligados.elements) {
      if (aceitos.includes((e.propertyName ?? e.name).text)) nomes.add(e.name.text);
    }
  }
  return nomes;
}

/** As funções declaradas no topo do arquivo, pelo nome: as `function` e as `const x = () => …`. */
function funcoesDoArquivo(sf: ts.SourceFile): Map<string, ts.Node> {
  const mapa = new Map<string, ts.Node>();
  for (const s of sf.statements) {
    if (ts.isFunctionDeclaration(s) && s.name && s.body) mapa.set(s.name.text, s.body);
    if (ts.isVariableStatement(s)) {
      for (const d of s.declarationList.declarations) {
        const i = d.initializer;
        if (ts.isIdentifier(d.name) && i && (ts.isArrowFunction(i) || ts.isFunctionExpression(i))) mapa.set(d.name.text, i.body);
      }
    }
  }
  return mapa;
}

/** Os nomes chamados como `nome(` em qualquer ponto do nó. */
function chamados(no: ts.Node): Set<string> {
  const nomes = new Set<string>();
  const andar = (n: ts.Node) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) nomes.add(n.expression.text);
    ts.forEachChild(n, andar);
  };
  andar(no);
  return nomes;
}

type Leitura = { regra: Set<string>; administrador: Set<string>; locais: Map<string, ts.Node> };

const leitura = (sf: ts.SourceFile): Leitura => ({
  regra: importados(sf, DA_REGRA),
  administrador: importados(sf, DO_ADMINISTRADOR),
  locais: funcoesDoArquivo(sf),
});

/** Se o corpo chega a uma função da regra, direto ou pelas funções locais, seguidas até o fim e sem laço. */
function chegaNaRegra(corpo: ts.Node, l: Leitura, visto = new Set<string>()): boolean {
  for (const nome of chamados(corpo)) {
    if (l.regra.has(nome)) return true;
    const local = l.locais.get(nome);
    if (local && !visto.has(nome)) {
      visto.add(nome);
      if (chegaNaRegra(local, l, visto)) return true;
    }
  }
  return false;
}

/** Como o corpo confere: pelo administrador, pela regra, ou não confere. */
function comoConfere(corpo: ts.Node, l: Leitura): "administrador" | "regra" | null {
  if ([...chamados(corpo)].some((n) => l.administrador.has(n))) return "administrador";
  return chegaNaRegra(corpo, l) ? "regra" : null;
}

/** Se o corpo lê `.administrador` de alguma coisa (o papel do login da sessão). */
function leOPapel(corpo: ts.Node): boolean {
  let achou = false;
  const andar = (n: ts.Node) => {
    if (ts.isPropertyAccessExpression(n) && n.name.text === "administrador") achou = true;
    ts.forEachChild(n, andar);
  };
  andar(corpo);
  return achou;
}

type Ponto = { chave: string; corpo: ts.Node | null; sf: ts.SourceFile };

/** Cada export de um arquivo "use server": num arquivo desses todo export é action. Sem corpo, `corpo: null`. */
function acoesDe(rel: string, sf: ts.SourceFile): Ponto[] {
  const pontos: Ponto[] = [];
  for (const s of sf.statements) {
    if (!exportado(s) || ts.isInterfaceDeclaration(s) || ts.isTypeAliasDeclaration(s)) continue;
    if (ts.isFunctionDeclaration(s) && s.name && s.body) pontos.push({ chave: `${rel} ${s.name.text}`, corpo: s.body, sf });
    else pontos.push({ chave: `${rel} ${s.getText(sf).split("\n")[0]}`, corpo: null, sf });
  }
  return pontos;
}

const METODOS_HTTP = new Set(["GET", "HEAD", "OPTIONS", "POST", "PUT", "DELETE", "PATCH"]);

/** Cada handler exportado como função de uma rota. As outras formas de export são cobradas por sessao-nas-actions. */
function handlersDe(rel: string, sf: ts.SourceFile): Ponto[] {
  return sf.statements
    .filter((s): s is ts.FunctionDeclaration => ts.isFunctionDeclaration(s) && exportado(s) && !!s.name && METODOS_HTTP.has(s.name.text))
    .map((f) => ({ chave: `${rel} ${f.name!.text}`, corpo: f.body ?? null, sf }));
}

const arquivosUseServer = () => [...arquivosDe("app"), ...arquivosDe("lib")].filter((rel) => ehUseServer(analisar(rel)));
const rotas = () => arquivosDe("app").filter((rel) => /\/route\.tsx?$/.test(rel));

const todasAsAcoes = () => arquivosUseServer().flatMap((rel) => acoesDe(rel, analisar(rel)));
const todosOsHandlers = () => rotas().flatMap((rel) => handlersDe(rel, analisar(rel)));

// A LISTA FECHADA: o que não passa pela regra, e por quê. Um item que deixe de existir derruba o teste, para a
// lista não envelhecer. `leOPapel` exige, no corpo, a leitura do `administrador` do login da sessão.
const FORA_DA_REGRA: Record<string, { motivo: string; leOPapel?: true }> = {
  "app/bonus/actions.ts pedirBonus": { motivo: "o bônus é do painel inteiro (decisão de 03/11)" },
  "app/bonus/actions.ts gerarDeNovo": { motivo: "o bônus é do painel inteiro (decisão de 03/11)" },
  "app/bonus/actions.ts enviarAoLabs": { motivo: "o bônus é do painel inteiro (decisão de 03/11)" },
  "app/bonus/actions.ts conferirNoLabs": { motivo: "o bônus é do painel inteiro (decisão de 03/11)" },
  "app/entrar/actions.ts login": { motivo: "é a ação que cria a sessão" },
  "app/minha-conta/actions.ts trocarMinhaSenha": { motivo: "só mexe no próprio login" },
  "app/minha-conta/actions.ts sair": { motivo: "só mexe no próprio login" },
  "app/api/cron/daily/route.ts GET": { motivo: "rota por segredo, sem login" },
  "app/api/queue/tick/route.ts POST": { motivo: "rota por segredo, sem login" },
  "app/api/webhook/route.ts GET": { motivo: "rota por segredo (o verify token da Meta), sem login" },
  "app/api/webhook/route.ts POST": { motivo: "rota por segredo (a assinatura da Meta), sem login" },
  "app/api/oauth/callback/route.ts GET": {
    motivo: "a volta do OAuth, pelo state: só chega do começo de um administrador ou de um convite",
  },
  "app/api/oauth/convite/[codigo]/route.ts GET": { motivo: "o começo do convite, público, pelo código" },
  "app/api/oauth/login/route.ts GET": {
    motivo: "confere o papel no login da sessão que a rota lê (login.administrador)",
    leOPapel: true,
  },
};

/** As falhas de uma lista de pontos: o que não confere e não está na lista fechada. */
function falhasDe(pontos: Ponto[]): string[] {
  const falhas: string[] = [];
  for (const p of pontos) {
    const fora = FORA_DA_REGRA[p.chave];
    if (fora) {
      if (fora.leOPapel && !(p.corpo && leOPapel(p.corpo))) falhas.push(`${p.chave}: está na lista e não lê o papel`);
      continue;
    }
    if (!p.corpo || !comoConfere(p.corpo, leitura(p.sf))) falhas.push(p.chave);
  }
  return falhas;
}

describe("toda action e toda rota passa pela regra das contas", () => {
  it("o leitor acusa quando há o que acusar", () => {
    const ponto = (fonte: string) => {
      const sf = analisar("x.ts", fonte);
      const f = sf.statements.find((s): s is ts.FunctionDeclaration => ts.isFunctionDeclaration(s) && s.name?.text === "acao")!;
      return comoConfere(f.body!, leitura(sf));
    };
    const regra = 'import { getSelectedAccountId } from "@/lib/account";\n';
    const carrossel = 'import { cabecalhosDoLogin } from "@/lib/bonus/carrossel-acesso";\n';
    // Nada da regra: acusa.
    expect(ponto("export async function acao() { await lerCarrossel(1); }")).toBe(null);
    // A regra direto, e por uma função local, e por duas.
    expect(ponto(`${regra}export async function acao() { return getSelectedAccountId(); }`)).toBe("regra");
    expect(ponto(`${carrossel}async function contas() { return cabecalhosDoLogin(); }\nexport async function acao() { await contas(); }`)).toBe(
      "regra"
    );
    expect(
      ponto(
        `${regra}const a = async () => getSelectedAccountId();\nasync function b() { return a(); }\nexport async function acao() { after(() => b()); }`
      )
    ).toBe("regra");
    // Funções locais em laço, sem a regra no fim: acusa, e não trava.
    expect(ponto("async function a() { return b(); }\nasync function b() { return a(); }\nexport async function acao() { await a(); }")).toBe(
      null
    );
    // O nome da regra sem o import dela não vale: uma função local com o mesmo nome não é a regra.
    expect(ponto("async function getSelectedAccountId() { return 1; }\nexport async function acao() { await getSelectedAccountId(); }")).toBe(
      null
    );
    // E o nome que vem de outro módulo também não.
    expect(ponto('import { getSelectedAccountId } from "./outro";\nexport async function acao() { await getSelectedAccountId(); }')).toBe(null);
    // O import com outro nome vale pelo nome de lá.
    expect(ponto('import { podeVerConta as pode } from "@/lib/acesso";\nexport async function acao() { await pode(l, c); }')).toBe("regra");
    // O administrador, direto; num comentário ou num texto, não.
    expect(ponto('import { exigirAdministrador } from "@/lib/exigir-sessao";\nexport async function acao() { await exigirAdministrador(); }')).toBe(
      "administrador"
    );
    expect(ponto('export async function acao() { // exigirAdministrador()\n const t = "exigirAdministrador()"; }')).toBe(null);
    // O papel lido no corpo.
    const papel = (fonte: string) => leOPapel(analisar("r.ts", fonte));
    expect(papel("export async function GET() { if (!login.administrador) return x; }")).toBe(true);
    expect(papel('export async function GET() { const administrador = "sim"; return x; }')).toBe(false);
  });

  it("a lista fechada não envelhece: cada item dela é uma action ou um handler que existe", () => {
    const existentes = new Set([...todasAsAcoes(), ...todosOsHandlers()].map((p) => p.chave));
    const sumidos = Object.keys(FORA_DA_REGRA).filter((chave) => {
      const rel = chave.slice(0, chave.lastIndexOf(" "));
      return !existsSync(join(RAIZ, rel)) || !existentes.has(chave);
    });
    expect(sumidos).toEqual([]);
  });

  it("o leitor acha as actions e as rotas do carrossel", () => {
    const chaves = [...todasAsAcoes(), ...todosOsHandlers()].map((p) => p.chave);
    for (const chave of [
      "app/bonus/carrossel-actions.ts pedirCarrossel",
      "app/bonus/imagem-actions.ts pedirImagemDoSlide",
      "app/bonus/publicar-actions.ts publicarCarrossel",
      "app/bonus/apagar-actions.ts apagarCarrosselDaPagina",
      "app/carrosseis/actions.ts gerarAvulsoDeNovo",
      "app/bonus/[id]/carrossel/[cid]/arte/route.tsx GET",
      "app/carrosseis/[cid]/imagem/route.ts GET",
      "app/account-actions.ts selectAccount",
      "app/setup/actions.ts reassinarWebhooks",
    ]) {
      expect(chaves, chave).toContain(chave);
    }
  });

  it("cada action exportada chama o administrador ou a regra, ou está na lista fechada", () => {
    expect(falhasDe(todasAsAcoes())).toEqual([]);
  });

  it("cada handler exportado de rota chama o administrador ou a regra, ou está na lista fechada", () => {
    expect(falhasDe(todosOsHandlers())).toEqual([]);
  });
});
