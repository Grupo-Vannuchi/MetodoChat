import { readFileSync } from "node:fs";
import { join } from "node:path";
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

// O "AGORA" DAS DUAS REDES (`publicarNasDuasRedes`, a parte 2b): o mesmo começo vai ao LinkedIn e ao dreno de hoje,
// que publica o Instagram, para outra linha do LinkedIn que esse dreno pegue respeitar o prazo (nota da auditoria
// sobre o desenho da 2b). E o LinkedIn vem antes (a escolha (a)): só a própria linha, com o tempo inteiro.
describe("a action das duas redes passa o começo da função ao LinkedIn e ao dreno do Instagram", () => {
  it("app/publicar/actions.ts, publicarNasDuasRedes", () => {
    const fonte = readFileSync(join(RAIZ, "app/publicar/actions.ts"), "utf8").replace(/\r\n/g, "\n");
    const inicio = fonte.indexOf("export async function publicarNasDuasRedes(");
    expect(inicio).toBeGreaterThan(-1);
    const fim = fonte.indexOf("\nexport ", inicio + 1);
    const corpo = fonte.slice(inicio, fim === -1 ? undefined : fim);
    expect(corpo).toMatch(/\{\n {2}await exigirSessao\(\);\n {2}const inicioDaFuncaoMs = Date\.now\(\);\n/);
    expect(corpo).toMatch(/drenarUmaPublicacaoDoLinkedin\(\s*[\w.]+,\s*inicioDaFuncaoMs\s*\)/);
    expect(corpo).toMatch(/drainQueue\(\{\s*inicioDaFuncaoMs\s*\}\)/);
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
