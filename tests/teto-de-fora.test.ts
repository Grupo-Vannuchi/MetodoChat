import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  FOLGA_DA_TELA_MS,
  TETO_DA_CAPA_NA_TELA_MS,
  TETO_DA_RESOLUCAO_MS,
} from "@/lib/media-lookup";

// O TETO DE FORA FICA ACIMA DO DE DENTRO — a relação, e o portão que impede as
// telas de voltarem a escrever o número à mão.
//
// POR QUE ISTO IMPORTA: os dois tetos vencem de formas diferentes. O de dentro
// (`TETO_DA_RESOLUCAO_MS`, lib/media-lookup.ts) devolve o mapa PARCIAL — as
// capas que a listagem dos 40 resolveu de graça ficam na tela. O de fora, o
// `Promise.race` de cada tela, devolve `new Map()`: descarte tudo ou nada, tela
// sem capa nenhuma. O de fora vencer é sempre pior, então ele precisa perder a
// corrida no caso normal.
//
// ATÉ 16/09/2026 essa relação era um literal `2500` escrito TRÊS VEZES, com
// três nomes locais diferentes, e afirmada em prosa nos três comentários.
// Baixar qualquer um deles para 1500 devolveria aquela tela ao descarte
// tudo-ou-nada com a suíte inteira verde.

describe("a relação entre os dois tetos", () => {
  it("o de fora fica ACIMA do de dentro", () => {
    // NÃO É TAUTOLOGIA por ser derivado: este caso continua valendo se alguém
    // trocar a derivação por um literal, que é justamente a mudança perigosa.
    expect(TETO_DA_CAPA_NA_TELA_MS).toBeGreaterThan(TETO_DA_RESOLUCAO_MS);
  });

  it("a folga é positiva e não é simbólica", () => {
    // Uma folga de 1 ms passaria no caso acima e não protegeria nada: o de fora
    // venceria junto com o de dentro, no mesmo tique do relógio.
    expect(FOLGA_DA_TELA_MS).toBeGreaterThanOrEqual(250);
  });

  it("o de dentro cabe no tempo que uma tela pode esperar", () => {
    // O outro lado da mesma conta: um teto de dentro folgado demais faria a
    // pessoa esperar por capa, e capa não vale espera — sem ela a tela serve,
    // sem a tela nada serve. Três segundos é o limite que este produto aceita.
    expect(TETO_DA_RESOLUCAO_MS).toBeLessThanOrEqual(3000);
  });
});

// ---------------------------------------------------------------------------
// O PORTÃO. Mesma forma de `tests/avatar-recuo.test.ts` e
// `tests/cache-da-capa.test.ts`: a suíte padrão não renderiza tela, então o que
// dá para prender é a fiação — que as telas LEEM o dono em vez de reescrever o
// número.
//
// O `semComentariosNemTexto` é de `tests/avatar-recuo.test.ts`, com crédito, e
// pela mesma razão: sem ele, o número citado numa explicação contaria como
// ocorrência e o portão acusaria o próprio comentário que documenta a decisão.
function semComentariosNemTexto(fonte: string): string {
  const semComentarios = fonte
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
  return (
    semComentarios
      .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
      .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
      // E OS TEMPLATE LITERALS TAMBÉM, com crase. Esta linha nasceu de um falso
      // positivo REAL: o caçador de número solto acusou `2026` em
      // `app/page.tsx`, e os dois estavam dentro de comentários de SQL (`--`)
      // numa consulta escrita entre crases. Comentário de SQL não é código, e um
      // portão que acusa a explicação de uma decisão treina quem mantém a apagar
      // explicação.
      .replace(/`(?:[^`\\]|\\.)*`/g, "``")
  );
}

// As telas que cercam `resolvePosts` com corrida própria.
const TELAS = [
  "app/page.tsx",
  "app/automacoes/page.tsx",
  "app/automacoes/[id]/page.tsx",
];

function ler(caminho: string): string {
  return semComentariosNemTexto(
    readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8")
  );
}

describe.each(TELAS)("%s usa o dono do teto de fora", (tela) => {
  const fonte = ler(tela);

  it("enxerga a tela que diz enxergar", () => {
    // Uma varredura de arquivo vazio passa por vacuidade.
    expect(fonte).toContain("resolvePosts");
    expect(fonte).toContain("Promise.race");
  });

  it("lê `TETO_DA_CAPA_NA_TELA_MS` em vez de escrever o número", () => {
    expect(
      fonte.includes("TETO_DA_CAPA_NA_TELA_MS"),
      `TETO SEM DONO em \`${tela}\`: a corrida precisa usar ` +
        "`TETO_DA_CAPA_NA_TELA_MS` (lib/media-lookup.ts), que é DERIVADO de " +
        "`TETO_DA_RESOLUCAO_MS` mais uma folga. Escrever o número aqui faz a " +
        "relação 'o de fora fica acima do de dentro' virar coincidência — e " +
        "quando o de fora vence, a tela perde TODAS as capas, inclusive as que a " +
        "listagem já tinha resolvido de graça."
    ).toBe(true);
  });

  it("não tem número de milissegundo solto na corrida", () => {
    // Qualquer literal de 4 ou 5 dígitos fora de comentário e de string. É
    // grosseiro de propósito: o que se quer impedir é a volta do `2500` à mão,
    // e um teto novo escrito à mão seria o mesmo defeito com outro valor.
    const soltos = fonte.match(/(?<![\w.])\d{4,5}(?![\w.])/g) ?? [];
    expect(
      soltos,
      `NÚMERO SOLTO em \`${tela}\`: ${soltos.join(", ")}. Se for teto de tempo, ` +
        "ele tem dono em lib/media-lookup.ts. Se for outra coisa, dê um nome a ela."
    ).toEqual([]);
  });
});

describe("a contraprova do portão", () => {
  it("menção em comentário ou em string não paga a conta", () => {
    const alibi = semComentariosNemTexto(
      "// TETO_DA_CAPA_NA_TELA_MS resolvePosts Promise.race\n" +
        'const NOTA = "TETO_DA_CAPA_NA_TELA_MS";\n'
    );
    expect(alibi).not.toContain("TETO_DA_CAPA_NA_TELA_MS");
  });

  it("o caçador de número solto acha o que promete achar", () => {
    const comLiteral = semComentariosNemTexto("const TETO = 2500;\n");
    expect(comLiteral.match(/(?<![\w.])\d{4,5}(?![\w.])/g)).toEqual(["2500"]);
  });
});
