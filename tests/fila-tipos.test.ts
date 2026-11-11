import { describe, expect, expectTypeOf, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { naOrdemDoLote, TIPOS_DE_PUBLICACAO, TIPOS_QUE_O_DRENO_CONHECE, type TipoDaFila } from "@/lib/fila-tipos";
import type { QueueItem } from "@/lib/db";

// A LISTA DOS TIPOS QUE O DRENO CONHECE É A DO BANCO (docs/specs/2026-11-06-linkedin-no-perfil.md, §0).
//
// O `queue_kind_check` do banco e a lista do código são duas listas da mesma coisa, e o comentário do
// `QueueItem` (lib/db.ts) já registrou uma vez que elas se separaram. Este teste lê a ÚLTIMA migração da
// pasta que escreve o `queue_kind_check` e exige que os tipos dela sejam exatamente os da lista. Quem
// acrescentar um tipo numa migração nova e esquecer o código (ou o contrário) cai aqui.
function tiposDaUltimaMigracaoDoCheck(): { arquivo: string; tipos: string[] } {
  const pasta = join(process.cwd(), "migrations");
  const arquivos = readdirSync(pasta)
    .filter((a) => a.endsWith(".sql"))
    .sort();
  let achado: { arquivo: string; tipos: string[] } | null = null;
  for (const arquivo of arquivos) {
    const texto = readFileSync(join(pasta, arquivo), "utf8");
    const m = /add constraint queue_kind_check check \(kind in \(([\s\S]*?)\)\)/i.exec(texto);
    if (!m) continue;
    const tipos = [...m[1].matchAll(/'([a-z_]+)'/g)].map((t) => t[1]);
    achado = { arquivo, tipos };
  }
  if (!achado) throw new Error("nenhuma migração escreve o queue_kind_check");
  return achado;
}

describe("os tipos que o dreno conhece", () => {
  it("são exatamente os do queue_kind_check da última migração que o escreve", () => {
    const { arquivo, tipos } = tiposDaUltimaMigracaoDoCheck();
    // A 025 (a parte 2a do LinkedIn) alargou o check com o `publicacao_linkedin`, e o dreno ganhou o ramo dele.
    expect(arquivo).toBe("025-fila-linkedin.sql");
    expect([...TIPOS_QUE_O_DRENO_CONHECE].sort()).toEqual([...tipos].sort());
  });

  it("não têm repetição", () => {
    expect(new Set(TIPOS_QUE_O_DRENO_CONHECE).size).toBe(TIPOS_QUE_O_DRENO_CONHECE.length);
  });

  it("são o tipo do kind da linha da fila (QueueItem), e não uma segunda lista", () => {
    expectTypeOf<QueueItem["kind"]>().toEqualTypeOf<TipoDaFila>();
  });

  // OS TIPOS DE PUBLICAÇÃO (docs/specs/2026-11-06-linkedin-no-perfil.md, §6): os pontos que dizem "post, e não
  // mensagem" (a cota de DM, a exceção da seleção, os tiques do dia, as contagens do Início, as telas) perguntam
  // a esta lista, e não a um literal.
  it("os de publicação são o post do Instagram e o do LinkedIn, e os dois o dreno conhece", () => {
    expect([...TIPOS_DE_PUBLICACAO]).toEqual(["publicacao", "publicacao_linkedin"]);
    for (const t of TIPOS_DE_PUBLICACAO) expect(TIPOS_QUE_O_DRENO_CONHECE).toContain(t);
  });
});

// A ORDEM DO LOTE (a preparação da parte 3 do LinkedIn; docs/plans/2026-11-11-linkedin-forma-conhecida.md). O post
// do LinkedIn que já foi adiado por falta de tempo (o `adiamentos` do payload, que a parte 3 grava) vai primeiro no
// lote, para começar com o prazo da função quase inteiro. SÓ O JÁ ADIADO: um carrossel novo à frente de todo lote
// ocuparia quase a passada inteira, e as mensagens do mesmo lote iriam sempre para a seguinte.
describe("a ordem do lote", () => {
  const item = (id: string, kind: string, payload: unknown = {}) => ({ id, kind, payload });
  const ids = (lote: { id: string }[]) => lote.map((i) => i.id);

  it("sem post do LinkedIn já adiado, o lote fica na ordem de hoje", () => {
    const lote = [item("a", "dm_manual"), item("b", "publicacao_linkedin", { forma: "texto" }), item("c", "publicacao")];
    expect(ids(naOrdemDoLote(lote))).toEqual(["a", "b", "c"]);
  });

  it("o post do LinkedIn já adiado vai primeiro, na ordem em que veio, e o resto segue na ordem de hoje", () => {
    const lote = [
      item("a", "dm_manual"),
      item("b", "publicacao_linkedin", { adiamentos: 0 }),
      item("c", "comment_reply"),
      item("d", "publicacao_linkedin", { adiamentos: 2 }),
      item("e", "publicacao_linkedin", { adiamentos: 1 }),
    ];
    expect(ids(naOrdemDoLote(lote))).toEqual(["d", "e", "a", "b", "c"]);
  });

  it("só conta o adiamento que é número inteiro a partir de 1: zero, negativo, quebrado, texto, ausente e payload torto não movem", () => {
    const lote = [
      item("a", "dm_manual"),
      item("b", "publicacao_linkedin", { adiamentos: 0 }),
      item("c", "publicacao_linkedin", { adiamentos: -1 }),
      item("d", "publicacao_linkedin", { adiamentos: 1.5 }),
      item("e", "publicacao_linkedin", { adiamentos: "3" }),
      item("f", "publicacao_linkedin", {}),
      item("g", "publicacao_linkedin", null),
    ];
    expect(ids(naOrdemDoLote(lote))).toEqual(["a", "b", "c", "d", "e", "f", "g"]);
  });

  it("só o post do LinkedIn sobe: outro tipo com adiamentos no payload fica onde estava", () => {
    const lote = [item("a", "dm_manual"), item("b", "publicacao", { adiamentos: 4 }), item("c", "dm_lote", { adiamentos: 1 })];
    expect(ids(naOrdemDoLote(lote))).toEqual(["a", "b", "c"]);
  });

  it("não mexe no lote recebido", () => {
    const lote = [item("a", "dm_manual"), item("b", "publicacao_linkedin", { adiamentos: 1 })];
    const copia = [...lote];
    naOrdemDoLote(lote);
    expect(lote).toEqual(copia);
  });
});
