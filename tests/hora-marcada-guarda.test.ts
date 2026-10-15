import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// A FRONTEIRA DA HORA MARCADA (spec docs/specs/2026-10-15-hora-marcada.md), lida no código.
//
// A publicação grava a hora marcada como veio, e as mensagens continuam com o atraso em segundos,
// somado pelo banco (o contrato de `enqueue`, do commit 6cd8d6d). As duas regras moram no mesmo
// arquivo, e a única coisa que as separa é cada uma ter o seu INSERT. Uma regra nova que vazasse
// para as mensagens apagaria a espera do editor de automações: "esperar 5 minutos" viraria "agora".
//
// ESTA GUARDA É PURA DE PROPÓSITO. O `npm run verify` não roda a integração, e o caso que mede a
// espera das mensagens no banco (`gatilho-entrega.integracao.ts`) só roda com o container. Lida
// aqui, a fronteira cai no portão de todo commit.
//
// A CONTA É DO ARQUIVO INTEIRO, COMENTÁRIOS INCLUSIVE (nota da revisão do plano): um comentário em
// `lib/engine.ts` que escreva a expressão do `greatest` da publicação derruba a guarda. É rígido de
// propósito, no jeito das guardas do dono: quem escreve a expressão no motor tem de passar por aqui.

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const MOTOR = readFileSync(`${RAIZ}/lib/engine.ts`, "utf8").replace(/\r\n/g, "\n");

/** O corpo de uma função exportada do motor: da assinatura até a primeira chave que fecha na coluna 0. */
function corpoDe(nome: string): string {
  const inicio = MOTOR.indexOf(`export async function ${nome}(`);
  if (inicio < 0) throw new Error(`${nome} não está em lib/engine.ts`);
  const fim = MOTOR.indexOf("\n}\n", inicio);
  return MOTOR.slice(inicio, fim + 2);
}

describe("a fronteira entre a hora marcada e o atraso das mensagens", () => {
  it("o INSERT das mensagens continua somando o atraso no relógio do banco", () => {
    expect(MOTOR).toContain(
      "values ($1, $2, $3, $4, $5, $6, $7, now() + make_interval(secs => $8::int))"
    );
  });

  it("só a publicação grava a hora absoluta, e uma vez só no motor", () => {
    expect(MOTOR.split("greatest(now()").length - 1).toBe(1);
    expect(corpoDe("enqueuePublicacao")).toContain(
      "greatest(now(), coalesce($4::timestamptz, now()))"
    );
  });
});
