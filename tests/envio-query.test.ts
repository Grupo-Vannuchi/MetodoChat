import { describe, it, expect } from "vitest";
import { buildEnviosWhere, contagemPorSituacao, ENVIOS_QUANDO } from "@/lib/envio-query";
import { NO_ENVIO_FILTERS, KINDS_MANUAIS, type EnvioFilters } from "@/lib/envio-filters";

const filtros = (p: Partial<EnvioFilters> = {}): EnvioFilters => ({ ...NO_ENVIO_FILTERS, ...p });

describe("isolamento por conta", () => {
  it("sempre filtra pela conta, mesmo sem nenhum filtro", () => {
    const w = buildEnviosWhere("conta-1", filtros());
    expect(w.sql).toContain("q.account_id = $1");
    expect(w.params).toEqual(["conta-1"]);
  });

  it("a conta continua valendo com qualquer filtro ao lado", () => {
    const w = buildEnviosWhere("conta-1", filtros({ origem: "voce", situacao: "failed" }));
    expect(w.sql.startsWith("q.account_id = $1")).toBe(true);
    // Sem `or` em lugar nenhum, nenhuma condição pode escapar do `and` da conta.
    expect(w.sql).not.toMatch(/\bor\b/);
  });
});

describe("filtros viram parâmetro, nunca texto colado no SQL", () => {
  it("situação entra como $2", () => {
    const w = buildEnviosWhere("conta-1", filtros({ situacao: "failed" }));
    expect(w.sql).toContain("q.status = $2");
    expect(w.params).toEqual(["conta-1", "failed"]);
  });

  it("período vira um número de dias, não um trecho de SQL", () => {
    const w = buildEnviosWhere("conta-1", filtros({ period: "7d" }));
    expect(w.sql).toContain("make_interval(days => $2::int)");
    expect(w.params).toEqual(["conta-1", 7]);
  });

  it("'tudo' não acrescenta condição de data", () => {
    const w = buildEnviosWhere("conta-1", filtros({ period: "tudo" }));
    expect(w.sql).not.toContain("make_interval");
    expect(w.params).toHaveLength(1);
  });

  it("até os kinds, que são constante do código, entram como parâmetro", () => {
    const w = buildEnviosWhere("conta-1", filtros({ origem: "voce" }));
    expect(w.sql).not.toContain("dm_manual");
    expect(w.params).toEqual(["conta-1", ...KINDS_MANUAIS]);
  });

  it("numera os parâmetros na ordem em que aparecem no SQL", () => {
    const w = buildEnviosWhere("c", filtros({ origem: "robo", situacao: "sent", period: "30d" }));
    const usados = [...w.sql.matchAll(/\$(\d+)/g)].map((m) => Number(m[1]));
    expect(Math.max(...usados)).toBe(w.params.length);
    expect(w.params).toEqual(["c", ...KINDS_MANUAIS, "sent", 30]);
  });
});

describe("origem", () => {
  it("'voce' pede os kinds manuais", () => {
    const w = buildEnviosWhere("c", filtros({ origem: "voce" }));
    expect(w.sql).toContain("q.kind in (");
    expect(w.sql).not.toContain("not in");
  });

  it("'robo' pede o complemento exato de 'voce'", () => {
    // As duas metades têm que cobrir a fila inteira, sem sobra e sem repetição:
    // é o que garante que "seus" + "do robô" some o total.
    const w = buildEnviosWhere("c", filtros({ origem: "robo" }));
    expect(w.sql).toContain("q.kind not in (");
  });

  it("sem origem, nenhuma condição de kind", () => {
    const w = buildEnviosWhere("c", filtros());
    expect(w.sql).not.toContain("q.kind");
  });

  it("um marcador por kind manual, nem mais nem menos", () => {
    const w = buildEnviosWhere("c", filtros({ origem: "voce" }));
    const dentro = w.sql.match(/q\.kind in \(([^)]*)\)/)?.[1] ?? "";
    expect(dentro.split(",")).toHaveLength(KINDS_MANUAIS.length);
  });
});

describe("período usa a mesma data que a tela mostra", () => {
  it("filtra por sent_at caindo para created_at", () => {
    const w = buildEnviosWhere("c", filtros({ period: "24h" }));
    expect(w.sql).toContain(`${ENVIOS_QUANDO} >=`);
    expect(ENVIOS_QUANDO).toBe("coalesce(q.sent_at, q.created_at)");
  });
});

describe("contagemPorSituacao", () => {
  it("usa o mesmo where e os mesmos parâmetros da listagem", () => {
    const w = buildEnviosWhere("conta-1", filtros({ origem: "voce", period: "7d" }));
    const c = contagemPorSituacao(w);
    expect(c.params).toBe(w.params);
    expect(c.sql).toContain(w.sql);
  });

  it("agrupa por situação e devolve inteiro", () => {
    const c = contagemPorSituacao(buildEnviosWhere("c", filtros()));
    expect(c.sql).toContain("group by q.status");
    expect(c.sql).toContain("count(*)::int as total");
    expect(c.sql).toContain("q.status as situacao");
  });
});

describe("todos os filtros juntos", () => {
  it("combina as condições com and e não perde nenhum parâmetro", () => {
    const w = buildEnviosWhere("conta-1", {
      period: "24h",
      origem: "voce",
      situacao: "sent",
    });
    expect(w.params).toEqual(["conta-1", ...KINDS_MANUAIS, "sent", 1]);
    expect(w.sql.split("and").length - 1).toBeGreaterThanOrEqual(3);
  });
});
