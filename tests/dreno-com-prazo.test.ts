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
