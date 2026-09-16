import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { semComentariosNemTexto } from "./sem-comentarios";

// A SELEÇÃO EM LOTE NÃO PODE ENCOLHER SOZINHA — o portão da chave da lista.
//
// O DEFEITO, medido em produção em 16/09/2026: marquei três pessoas nas posições
// 4, 5 e 6 de `/contatos`, troquei o filtro, e sobrou UMA marcada. Ninguém
// errado foi marcado — o conjunto só encolhe — e o contador diz a verdade, então
// a tela não mente; mas duas seleções somem sem explicação, e quem aplicar a
// categoria aplica a UMA pessoa achando que aplicou a três.
//
// A CAUSA NÃO É O CONTADOR: as caixas são `<input>` NÃO-CONTROLADO, e o React
// reconcilia por POSIÇÃO. Trocando o filtro, a lista é SUBSTITUÍDA e sobrevive
// marcado só o que calha de cair no mesmo índice. O conserto é dar ao `<form>`
// uma `key` que muda quando a lista muda: lista nova, caixas novas, todas
// desmarcadas.
//
// E `linhas` FICA DE FORA DA CHAVE, medido no mesmo dia: "Ver mais"
// (`/contatos?linhas=50`) só ACRESCENTA linhas — as posições de cima não se
// mexem — e ali a seleção sobrevive INTEIRA (3 de 3, com a lista indo de 33 para
// 58). Pôr `linhas` na chave consertaria um caminho quebrando o outro.
//
// POR QUE O PORTÃO É TEXTUAL: a suíte padrão não tem DOM (`vitest.config.ts` diz
// isso, e não há jsdom nem testing-library), então nada aqui monta a tabela e
// troca o filtro. O que dá para prender é a chave e o que entra nela.

const TELA = "app/contatos/page.tsx";
const fonte = semComentariosNemTexto(
  readFileSync(new URL(`../${TELA}`, import.meta.url), "utf8")
);

/** A linha que monta a identidade da lista, isolada do resto do arquivo. */
function linhaDaIdentidade(): string {
  const i = fonte.indexOf("const identidadeDaLista");
  return i < 0 ? "" : fonte.slice(i, fonte.indexOf(";", i) + 1);
}

describe("a chave da lista de contatos", () => {
  it("enxerga a tela que diz enxergar", () => {
    // Uma varredura de arquivo vazio passa por vacuidade. Estas âncoras também
    // denunciam recorte comendo o meio do arquivo.
    expect(fonte).toContain("marcarCategoriaEmLote");
    expect(fonte).toContain("MarcarTodas");
    expect(fonte).toContain("ContadorDaSelecao");
  });

  it("o formulário do lote carrega uma `key`", () => {
    expect(
      fonte.includes("key={identidadeDaLista}"),
      `SELEÇÃO QUE ENCOLHE SOZINHA: o \`<form>\` de \`${TELA}\` perdeu ` +
        "`key={identidadeDaLista}`. Sem ela, trocar o filtro substitui a lista e " +
        "o React reconcilia as caixas por POSIÇÃO: quem marcou três pessoas fica " +
        "com uma marcada, sem aviso. Medido em produção em 16/09/2026."
    ).toBe(true);
  });

  it("a identidade é feita do FILTRO e da BUSCA — quem define QUEM aparece", () => {
    const linha = linhaDaIdentidade();
    expect(
      linha.includes("campoFiltro"),
      `IDENTIDADE SEM O FILTRO em \`${TELA}\`: \`identidadeDaLista\` precisa ` +
        "incluir `campoFiltro`, senão trocar de categoria não troca a chave e a " +
        "seleção volta a sobreviver por posição."
    ).toBe(true);
    expect(
      linha.includes("q"),
      `IDENTIDADE SEM A BUSCA em \`${TELA}\`: buscar também SUBSTITUI a lista, ` +
        "então `q` entra na chave pelo mesmo motivo que `campoFiltro`."
    ).toBe(true);
  });

  it("a identidade NÃO inclui `linhas` — é o que salva o `Ver mais`", () => {
    const linha = linhaDaIdentidade();
    expect(
      /\blinhas\b|\blimite\b/.test(linha),
      `CHAVE DEMAIS em \`${TELA}\`: \`identidadeDaLista\` NÃO pode depender de ` +
        "`linhas` nem de `limite`. 'Ver mais' só ACRESCENTA linhas — as posições " +
        "de cima não se mexem — e ali a seleção sobrevive inteira hoje (medido: " +
        "3 de 3, lista indo de 33 para 58). Pondo o número de linhas na chave, " +
        "cada 'Ver mais' apagaria a seleção inteira: o conserto de um caminho " +
        "quebrando o outro."
    ).toBe(false);
  });
});

describe("a contraprova do portão", () => {
  it("acha a linha da identidade, e não o arquivo inteiro", () => {
    const linha = linhaDaIdentidade();
    expect(linha.length).toBeGreaterThan(20);
    expect(linha.length).toBeLessThan(200);
    expect(linha.startsWith("const identidadeDaLista")).toBe(true);
  });

  it("menção em comentário não paga a conta", () => {
    const alibi = semComentariosNemTexto(
      "// key={identidadeDaLista} campoFiltro\nconst x = 1;\n"
    );
    expect(alibi).not.toContain("key={identidadeDaLista}");
  });
});
