import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FAMILIA_DA_ARTE, fontesDaArte } from "@/lib/bonus/arte-fonte";

// A FONTE DA ARTE: a Carlito Regular e Bold, SEM MODIFICAÇÃO, com a licença ao lado. "Sem
// modificação" é conferível: o hash do git de cada arquivo é o que o repositório do Google Fonts
// publica (google/fonts, commit 3dd7884402, ofl/carlito). Mexer num byte do .ttf derruba o caso.

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const PASTA = `${RAIZ}/lib/bonus/fonte`;

/** O hash que o git dá a um arquivo: sha1 de "blob <tamanho>\0" seguido dos bytes. */
function hashDoGit(bytes: Buffer): string {
  return createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
}

const ARQUIVOS = [
  { nome: "Carlito-Regular.ttf", hash: "427b95989fee609ab683d800ad00e22a4b14ecad" },
  { nome: "Carlito-Bold.ttf", hash: "67543b5a1efe4b910317116b02e8e9e01659692e" },
];

describe("os arquivos da fonte", () => {
  it.each(ARQUIVOS)("$nome é TrueType e é o do Google Fonts, byte a byte", ({ nome, hash }) => {
    const bytes = readFileSync(`${PASTA}/${nome}`);
    expect([...bytes.subarray(0, 4)]).toEqual([0x00, 0x01, 0x00, 0x00]);
    expect(hashDoGit(bytes)).toBe(hash);
  });

  // A licença vai junto (SIL OFL 1.1): é ela que permite levar os arquivos. O git pode entregar a
  // cópia de trabalho em CRLF (core.autocrlf), e o hash é o do conteúdo em LF, que é o guardado.
  it("a licença OFL está ao lado, a mesma do Google Fonts, com o nome reservado", () => {
    const texto = readFileSync(`${PASTA}/OFL.txt`, "utf8").replace(/\r\n/g, "\n");
    expect(texto).toContain('with Reserved Font Name "Carlito"');
    expect(texto).toContain("SIL OPEN FONT LICENSE Version 1.1");
    expect(hashDoGit(Buffer.from(texto, "utf8"))).toBe("8d6b170e4d9a5580a34471dc4ac3e8fc5fbbd712");
  });
});

describe("as fontes que a arte entrega ao ImageResponse", () => {
  it("são os dois pesos da casa, lidos dos arquivos inteiros", async () => {
    const fontes = await fontesDaArte();
    expect(fontes.map((f) => [f.name, f.weight, f.style, f.data.length])).toEqual([
      [FAMILIA_DA_ARTE, 400, "normal", readFileSync(`${PASTA}/Carlito-Regular.ttf`).length],
      [FAMILIA_DA_ARTE, 700, "normal", readFileSync(`${PASTA}/Carlito-Bold.ttf`).length],
    ]);
    expect(FAMILIA_DA_ARTE).toBe("Carlito");
  });
});
