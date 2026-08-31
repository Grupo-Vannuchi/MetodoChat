// A PASTA `migrations/`, LIDA DO JEITO QUE `scripts/migrar.mjs` A LÊ.
//
// Este arquivo existe porque a MESMA leitura passou a ser feita em três lugares:
// o script que aplica de verdade (`scripts/migrar.mjs`), a fundação dos testes
// de integração (`harness.ts`, que monta o schema descartável) e o caminho do
// esquema base (`esquema-base.integracao.ts`). Três cópias da mesma leitura é
// como nasce a divergência que ninguém vê — e aqui ela seria pior do que em
// qualquer outro lugar, porque o que estes testes provam é justamente que o que
// `migrar.mjs` aplica produz o banco certo.
//
// O ESPELHO DE `scripts/migrar.mjs` DEIXOU DE SER DECLARADO E PASSOU A SER O
// MESMO CÓDIGO — e isso mudou em 31/08/2026, por uma divergência real.
//
// Aqui havia uma CÓPIA da leitura: split, filtra comentário, junta, apara. A
// frase antiga dizia que o espelho era "declarado, e não escondido", e que o
// script não podia importar daqui por ser `.mjs` sem TypeScript. A primeira
// metade virou mentira no dia em que a leitura do script passou a NORMALIZAR
// `\r\n` para `\n` e esta não: as duas liam o mesmo arquivo e produziam textos
// diferentes byte a byte, numa máquina Windows.
//
// A segunda metade tinha conserto óbvio, e ele é o inverso do que estava
// escrito: quem importa é ESTE arquivo, que roda sob o vitest e importa `.mjs`
// sem cerimônia. `scripts/migracoes.mjs` continua sendo puro `node`, sem
// TypeScript, importável de dentro do build — e agora é a ÚNICA leitura.
//
// ELE É A FONTE DA ESTRUTURA DOS TESTES DE INTEGRAÇÃO: o schema descartável de
// toda rodada nasce daqui, e não mais de `ensureSchema()`. Que ele leia
// exatamente o que o script aplica é o que dá sentido a esses testes — sem
// isso, eles provariam coisas sobre um texto que nunca chega ao banco.
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { comandosDoArquivo } from "../scripts/migracoes.mjs";

const PASTA = fileURLToPath(new URL("../migrations", import.meta.url));

export type Migracao = { nome: string; comandos: string };

/** Os arquivos de `migrations/`, em ordem de nome, já sem as linhas de comentário. */
export function migracoesEmOrdem(): Migracao[] {
  return readdirSync(PASTA)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((nome) => ({
      nome,
      comandos: comandosDoArquivo(readFileSync(join(PASTA, nome), "utf8")),
    }));
}

/**
 * Aplica a pasta inteira, na ordem, por onde quem chamou mandar.
 *
 * O executor é um parâmetro, e não uma conexão, porque os dois usos passam
 * coisas diferentes: o harness passa o `sql().query` do `lib/db` já apontado
 * para o schema descartável, e o caminho do esquema base passa o `unsafe` de um
 * cliente `postgres` próprio. Devolve os nomes aplicados — quem chama confere
 * que não foi uma pasta vazia.
 */
export async function aplicarMigracoes(
  executar: (comandos: string) => Promise<unknown>
): Promise<string[]> {
  const aplicadas: string[] = [];
  for (const { nome, comandos } of migracoesEmOrdem()) {
    if (!comandos) continue;
    await executar(comandos);
    aplicadas.push(nome);
  }
  return aplicadas;
}

/**
 * O PISO, e ele é asserção e não comentário: uma pasta que encolheu produz um
 * schema pela metade, e um schema pela metade faria os testes de integração
 * ficarem vermelhos longe da causa — ou, pior, verdes sobre menos do que
 * pensam. Quem monta estrutura chama isto logo depois de aplicar.
 */
export function exigirPastaInteira(aplicadas: string[]): void {
  if (aplicadas.length < 6) {
    throw new Error(
      `A pasta migrations/ aplicou só ${aplicadas.length} arquivo(s) ` +
        `(${aplicadas.join(", ") || "nenhum"}). Desde 26/08 ela tem, no mínimo, ` +
        `o esquema base e as cinco que vieram depois dele — e é dela que nasce ` +
        `o schema descartável de toda rodada.`
    );
  }
}
