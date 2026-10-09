import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// A TRADUÇÃO DAS RECUSAS DA OPENAI É A DO LABS, BYTE A BYTE (spec da Etapa 6, "As regras de estilo do
// Chat", adendo de 09/10).
//
// `erro-ilustracao.ts` é o da dev do Labs em `69c079d`, de 09/10, com o filtro do pedaço da chave que a
// OpenAI devolve no 401. A conferência é a soma do git do arquivo (a mesma de `git hash-object` e do
// GitHub), e por isso a cópia não ganha nem um cabeçalho: a origem está aqui.
//
// ⚠️ ATÉ O ADENDO, `prompt-ilustracao.ts` TAMBÉM ESTAVA AQUI (o da main do Labs em `672ee71`, blob
// `d993e809`). Em 09/10 o Eduardo decidiu que o Chat tem regras de estilo próprias, e ele saiu desta
// trava; as regras dele são conferidas em tests/bonus-prompt-ilustracao.test.ts. A recusa da OpenAI não é
// estilo, e continua igual nos dois lados.
//
// MUDAR A TRADUÇÃO NUM LADO SÓ DERRUBA ESTE TESTE, e é para derrubar. A mudança se combina com o Labs
// (acordo de 08/10) e se faz nos dois; quando o Labs mudar o dele, ele avisa, e a cópia nova troca a
// soma daqui.
const RAIZ = fileURLToPath(new URL("..", import.meta.url));

/** A soma do git de um arquivo: sha1 de "blob <tamanho>\0" seguido do conteúdo, com o fim de linha LF. */
function somaDoGit(relativo: string): string {
  const texto = readFileSync(`${RAIZ}/${relativo}`, "utf8").replace(/\r\n/g, "\n");
  const bytes = Buffer.from(texto, "utf8");
  return createHash("sha1")
    .update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`, "utf8"), bytes]))
    .digest("hex");
}

describe("a tradução das recusas, copiada do Labs", () => {
  it.each([["lib/bonus/erro-ilustracao.ts", "6a5e8f55c82a871563498c9e4622a8b3f27b3566"]])("%s é o arquivo do Labs, byte a byte", (arquivo, soma) => {
    expect(somaDoGit(arquivo)).toBe(soma);
  });
});
