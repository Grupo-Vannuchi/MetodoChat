import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// AS REGRAS DA IMAGEM SÃO AS DO LABS, BYTE A BYTE (spec da Etapa 6, "As regras, copiadas do Labs").
//
// O Chat copia os dois módulos puros da ilustração do Labs (site-ia, `src/lib/ia/`) sem mudar uma letra:
// o estilo, as proibições, os atalhos e a tradução das recusas da OpenAI foram decididos pelo Eduardo lá,
// entre 02/09 e 22/09. A conferência é a soma do git do arquivo (a mesma de `git hash-object` e do
// GitHub), e por isso a cópia não ganha nem um cabeçalho: a origem está aqui.
//
// - `prompt-ilustracao.ts` é o da main do Labs em `672ee71` (igual na dev);
// - `erro-ilustracao.ts` é o da dev do Labs em `69c079d`, de 09/10: o filtro do pedaço da chave que a
//   OpenAI devolve no 401, achado neste ensaio e decidido pelo Eduardo no Labs. Ele chega à main de lá no
//   próximo deploy deles.
//
// MUDAR UMA REGRA NUM LADO SÓ DERRUBA ESTE TESTE, e é para derrubar. A mudança se combina com o Labs
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

describe("as regras da imagem, copiadas do Labs", () => {
  it.each([
    ["lib/bonus/prompt-ilustracao.ts", "d993e8099f1b630ccd7e3ad5034f5552334b4f10"],
    ["lib/bonus/erro-ilustracao.ts", "6a5e8f55c82a871563498c9e4622a8b3f27b3566"],
  ])("%s é o arquivo do Labs, byte a byte", (arquivo, soma) => {
    expect(somaDoGit(arquivo)).toBe(soma);
  });
});
