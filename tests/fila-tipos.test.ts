import { describe, expect, expectTypeOf, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { TIPOS_QUE_O_DRENO_CONHECE, type TipoDaFila } from "@/lib/fila-tipos";
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
    expect(arquivo).toBe("010-fila-publicacao.sql");
    expect([...TIPOS_QUE_O_DRENO_CONHECE].sort()).toEqual([...tipos].sort());
  });

  it("não têm repetição", () => {
    expect(new Set(TIPOS_QUE_O_DRENO_CONHECE).size).toBe(TIPOS_QUE_O_DRENO_CONHECE.length);
  });

  it("são o tipo do kind da linha da fila (QueueItem), e não uma segunda lista", () => {
    expectTypeOf<QueueItem["kind"]>().toEqualTypeOf<TipoDaFila>();
  });
});
