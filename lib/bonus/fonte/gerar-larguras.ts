// GERA lib/bonus/arte-larguras.ts a partir dos .ttf desta pasta. Roda no `node` puro, da raiz do
// projeto: `node lib/bonus/fonte/gerar-larguras.ts`. O teste tests/bonus-arte-larguras.test.ts
// recalcula a mesma tabela e reprova se o arquivo versionado divergir.
import { readFileSync, writeFileSync } from "node:fs";
import { lerLarguras, textoDaTabela } from "../arte-larguras-do-ttf.ts";

const pasta = new URL(".", import.meta.url);
const regular = lerLarguras(readFileSync(new URL("Carlito-Regular.ttf", pasta)));
const negrito = lerLarguras(readFileSync(new URL("Carlito-Bold.ttf", pasta)));
writeFileSync(new URL("../arte-larguras.ts", pasta), textoDaTabela(regular, negrito));
console.log(`lib/bonus/arte-larguras.ts: ${regular.avancos.size} caracteres`);
