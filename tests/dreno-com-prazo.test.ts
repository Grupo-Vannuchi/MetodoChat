import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// AS ROTAS QUE DRENAM A FILA PASSAM O COMEÇO DA FUNÇÃO (nota da auditoria sobre a F2 da parte 2a do LinkedIn).
//
// O post do LinkedIn não pode começar um passo que a função não tem tempo de terminar: morta no meio, a linha fica
// em 'sending' e, depois da marca do POST, vira "pode ter saído". O ramo confere o tempo que resta
// (lib/linkedin-fila.ts) a partir do começo da FUNÇÃO, e não do começo do dreno. Nas três rotas abaixo, o dreno
// vem depois de outro trabalho (o cron arma os tiques do dia antes; o webhook trata a mensagem antes), então
// cada uma marca a hora na primeira linha do handler e a entrega ao `drainQueue`.

const RAIZ = process.cwd();
const ROTAS = ["app/api/queue/tick/route.ts", "app/api/webhook/route.ts", "app/api/cron/daily/route.ts"];

// O "AGORA" DA TELA DE COMPOR DO LINKEDIN (app/publicar/actions.ts, `publicarNoLinkedin`) também: a hora é marcada
// logo depois da sessão (a primeira linha de toda action é `await exigirSessao();`, tests/sessao-nas-actions.test.ts)
// e vai ao `drenarUmaPublicacaoDoLinkedin`, e não a hora de depois do enfileirar.
describe("a action de publicar no LinkedIn passa o começo da função ao \"agora\"", () => {
  it("app/publicar/actions.ts", () => {
    const fonte = readFileSync(join(RAIZ, "app/publicar/actions.ts"), "utf8").replace(/\r\n/g, "\n");
    const inicio = fonte.indexOf("export async function publicarNoLinkedin(");
    expect(inicio).toBeGreaterThan(-1);
    const fim = fonte.indexOf("\nexport ", inicio + 1);
    const corpo = fonte.slice(inicio, fim === -1 ? undefined : fim);
    expect(corpo).toMatch(/\{\n {2}await exigirSessao\(\);\n {2}const inicioDaFuncaoMs = Date\.now\(\);\n/);
    expect(corpo).toMatch(/drenarUmaPublicacaoDoLinkedin\(\s*[\w.]+,\s*inicioDaFuncaoMs\s*\)/);
  });
});

// O "AGORA" DAS DUAS REDES (`publicarNasDuasRedes`, a parte 2b): o LinkedIn vem antes (a escolha (a)), só a própria
// linha, e depois o dreno do clique publica o Instagram, com o começo da função e sem o post do LinkedIn (a 3a-0, o
// 224). NO CARROSSEL (a parte 3a, achado 222), o começo do LinkedIn vem com a reserva do Instagram
// (`comecoDoLinkedinNoAgoraDasDuas`, lib/linkedin-fila.ts), que na imagem devolve o próprio começo da função; os casos
// estão em testes-integracao/linkedin-duas-redes.integracao.ts.
describe("a action das duas redes passa o começo da função ao LinkedIn e ao dreno do Instagram", () => {
  it("app/publicar/actions.ts, publicarNasDuasRedes", () => {
    const fonte = readFileSync(join(RAIZ, "app/publicar/actions.ts"), "utf8").replace(/\r\n/g, "\n");
    const inicio = fonte.indexOf("export async function publicarNasDuasRedes(");
    expect(inicio).toBeGreaterThan(-1);
    const fim = fonte.indexOf("\nexport ", inicio + 1);
    const corpo = fonte.slice(inicio, fim === -1 ? undefined : fim);
    expect(corpo).toMatch(/\{\n {2}await exigirSessao\(\);\n {2}const inicioDaFuncaoMs = Date\.now\(\);\n/);
    expect(corpo).toMatch(/const inicioDoLinkedin = comecoDoLinkedinNoAgoraDasDuas\(\s*formaNoLinkedin,\s*inicioDaFuncaoMs\s*\);/);
    expect(corpo).toMatch(/drenarUmaPublicacaoDoLinkedin\(\s*[\w.]+,\s*inicioDoLinkedin\s*\)/);
    // O DRENO DO INSTAGRAM, NO CLIQUE, NÃO PEGA O POST DO LINKEDIN (a 3a-0, o 224): o da própria linha já saiu pelo
    // `drenarUmaPublicacaoDoLinkedin`, logo acima. Por isso a reserva do carrossel não vai a ele.
    expect(corpo).toMatch(/drainQueue\(\{\s*inicioDaFuncaoMs,\s*doClique:\s*true\s*\}\)/);
    expect(corpo).not.toMatch(/drainQueue\(\)/);
    expect(corpo.indexOf("drenarUmaPublicacaoDoLinkedin(")).toBeLessThan(corpo.indexOf("drainQueue("));
  });
});

describe("as rotas que drenam passam o começo da função ao dreno", () => {
  for (const rota of ROTAS) {
    it(rota, () => {
      const fonte = readFileSync(join(RAIZ, rota), "utf8");
      // O handler que drena: o último `export async function` antes da chamada (o webhook tem também o GET da
      // verificação, que não drena).
      const chamada = fonte.indexOf("drainQueue(");
      expect(chamada).toBeGreaterThan(-1);
      const handler = fonte.lastIndexOf("export async function", chamada);
      expect(handler).toBeGreaterThan(-1);
      const corpo = fonte.slice(fonte.indexOf("{", fonte.indexOf(")", handler)) + 1);
      // A hora é a primeira coisa do handler: antes de qualquer `await`.
      expect(corpo.trimStart().startsWith("const inicioDaFuncaoMs = Date.now();")).toBe(true);
      expect(fonte).toMatch(/drainQueue\(\{\s*inicioDaFuncaoMs\s*\}\)/);
      expect(fonte).not.toMatch(/drainQueue\(\)/);
    });
  }
});

// A 3a-0 (os achados 223 e 224; scratchpad/desenho-223.md, P3 e P4). TODO chamador do dreno passa o começo da função,
// porque a hora de parar é contada dele; e os seis drenos que rodam dentro de um clique de quem usa o painel pedem a
// seleção sem o post do LinkedIn (`doClique: true`), que pode levar uma passada inteira. A lista dos arquivos que
// importam o `drainQueue` é fechada: um chamador novo entra aqui, com a escolha dele.
const ler = (arquivo: string) => readFileSync(join(RAIZ, arquivo), "utf8").replace(/\r\n/g, "\n");

function arquivosDe(pasta: string): string[] {
  const saida: string[] = [];
  for (const nome of readdirSync(join(RAIZ, pasta))) {
    const caminho = join(RAIZ, pasta, nome);
    if (statSync(caminho).isDirectory()) saida.push(...arquivosDe(relative(RAIZ, caminho)));
    else if (/\.(ts|tsx)$/.test(nome)) saida.push(relative(RAIZ, caminho).replace(/\\/g, "/"));
  }
  return saida;
}

/** O corpo de uma função exportada: do `export async function nome(` até o próximo `export` do arquivo. */
function corpoDa(arquivo: string, funcao: string): string {
  const fonte = ler(arquivo);
  const inicio = fonte.indexOf(`export async function ${funcao}(`);
  expect(inicio).toBeGreaterThan(-1);
  const fim = fonte.indexOf("\nexport ", inicio + 1);
  return fonte.slice(inicio, fim === -1 ? undefined : fim);
}

const QUEM_IMPORTA_O_DRENO = [
  ...ROTAS,
  "app/contatos/actions.ts",
  "app/conversas/[id]/actions.ts",
  "app/publicar/actions.ts",
  "app/publicar/post/actions.ts",
  "lib/bonus/publicar-processo.ts",
].sort();

const DRENOS_DE_CLIQUE = [
  { arquivo: "app/publicar/actions.ts", funcao: "publicar" },
  { arquivo: "app/publicar/actions.ts", funcao: "publicarNasDuasRedes" },
  { arquivo: "app/contatos/actions.ts", funcao: "enviarLote" },
  { arquivo: "app/conversas/[id]/actions.ts", funcao: "sendReply" },
  { arquivo: "app/publicar/post/actions.ts", funcao: "remarcarPublicacao" },
  // O SEXTO É O "PUBLICAR" DO BÔNUS, que chega ao dreno pelo `publicarNaFila`: o caso dele vem abaixo.
];

const COMECO_DEPOIS_DA_SESSAO = /\{\n {2}await exigirSessao\(\);\n {2}const inicioDaFuncaoMs = Date\.now\(\);\n/;

// O 226 (a leitura independente): a lista pega TODO jeito de chegar ao dreno (o import com aspas duplas ou simples, o
// relativo, o `import * as` e o `await import`); nenhum arquivo dá outro nome ao dreno nem o guarda numa variável (fora
// o `drenar` do bônus, que tem caso próprio); e toda chamada é uma das DUAS formas exatas: a das rotas, e a do clique em
// todo o resto, inclusive numa action nova de um destes arquivos.
const CHEGA_AO_DRENO = /(?:\bfrom\s*|\bimport\s*\(\s*)["'](?:@\/lib\/|(?:\.{1,2}\/)+(?:[\w[\]-]+\/)*)queue-drain["']/;
const FORMA_DA_ROTA = "drainQueue({ inicioDaFuncaoMs })";
const FORMA_DO_CLIQUE = "drainQueue({ inicioDaFuncaoMs, doClique: true })";

/** O código sem as linhas de comentário (as de `//` e as de JSDoc), para o comentário que cita o dreno não contar. */
const soOCodigo = (arquivo: string) =>
  ler(arquivo)
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join("\n");

describe("os arquivos que chegam ao dreno (a 3a-0)", () => {
  it("são os 8 de sempre, por qualquer jeito de importar: as 3 rotas, as 4 actions de clique e o processo do bônus", () => {
    const achados = [...arquivosDe("app"), ...arquivosDe("lib")]
      .filter((f) => f !== "lib/queue-drain.ts" && CHEGA_AO_DRENO.test(ler(f)))
      .sort();
    expect(achados).toEqual(QUEM_IMPORTA_O_DRENO);
  });

  it("nenhum dá outro nome ao dreno nem o guarda numa variável (fora o drenar do bônus)", () => {
    for (const arquivo of QUEM_IMPORTA_O_DRENO) {
      const codigo = soOCodigo(arquivo)
        .replace(/import\s*\{[^}]*\}\s*from\s*["'][^"']+["'];?/g, "")
        .replace("p.drenar ?? drainQueue", "");
      expect(codigo).not.toMatch(/\bdrainQueue\s+as\b/);
      expect(codigo.match(/\bdrainQueue\b(?!\s*\()/g) ?? []).toEqual([]);
    }
  });

  it("toda chamada do dreno é uma das duas formas exatas: a das rotas nas 3 rotas, e a do clique em todo o resto", () => {
    for (const arquivo of QUEM_IMPORTA_O_DRENO) {
      const esperada = ROTAS.includes(arquivo) ? FORMA_DA_ROTA : FORMA_DO_CLIQUE;
      for (const chamada of soOCodigo(arquivo).match(/\bdrainQueue\s*\([^)]*\)/g) ?? []) expect(chamada).toBe(esperada);
    }
  });
});

describe("os drenos de clique passam o começo e pedem a seleção sem o post do LinkedIn (a 3a-0, o 224)", () => {
  for (const { arquivo, funcao } of DRENOS_DE_CLIQUE) {
    it(`${arquivo}, ${funcao}`, () => {
      const corpo = corpoDa(arquivo, funcao);
      expect(corpo).toMatch(COMECO_DEPOIS_DA_SESSAO);
      const chamadas = corpo.match(/drainQueue\([^)]*\)/g) ?? [];
      expect(chamadas.length).toBeGreaterThan(0);
      for (const c of chamadas) expect(c).toMatch(/^drainQueue\(\{\s*inicioDaFuncaoMs,\s*doClique:\s*true\s*\}\)$/);
      // O DRENO DE UMA LINHA SÓ, quando a action o chama, também recebe o começo.
      for (const c of corpo.match(/drenarUmaPublicacaoDoLinkedin\([^)]*\)/g) ?? []) {
        expect(c).toMatch(/drenarUmaPublicacaoDoLinkedin\(\s*[\w.]+,\s*inicio\w*\s*\)/);
      }
    });
  }

  it("o bônus: a action passa o começo ao publicarNaFila, e ele o passa ao drenar, com a seleção do clique", () => {
    const acao = corpoDa("app/bonus/publicar-actions.ts", "publicarCarrossel");
    expect(acao).toMatch(COMECO_DEPOIS_DA_SESSAO);
    expect(acao).toMatch(/publicarNaFila\(\{[^}]*\binicioDaFuncaoMs\b[^}]*\}\)/);
    const chamadas = ler("lib/bonus/publicar-processo.ts").match(/\bdrenar\([^)]*\)/g) ?? [];
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0]).toMatch(/^drenar\(\{\s*inicioDaFuncaoMs,\s*doClique:\s*true\s*\}\)$/);
  });

  it("as rotas não pedem a seleção do clique: o tique, o webhook e o cron drenam o post do LinkedIn", () => {
    for (const rota of ROTAS) expect(ler(rota)).not.toMatch(/doClique/);
  });
});
