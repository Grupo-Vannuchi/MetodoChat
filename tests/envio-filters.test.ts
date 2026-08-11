import { describe, it, expect } from "vitest";
import {
  parseEnvioFilters,
  toEnvioQueryString,
  hasEnvioFilters,
  origemDoKind,
  resumoSituacoes,
  totalDeEnvios,
  NO_ENVIO_FILTERS,
  SITUACOES,
  KINDS_MANUAIS,
} from "@/lib/envio-filters";
import { PERIODS } from "@/lib/event-filters";

// parseEnvioFilters é a fronteira entre a URL, que qualquer um edita, e a
// consulta à fila. O que passar daqui vira SQL.

describe("parseEnvioFilters", () => {
  // As CHAVES de entrada são os nomes que aparecem na URL, em português e com o
  // prefixo `envios_`; as do objeto devolvido são as propriedades do código.
  it("aceita os valores válidos", () => {
    expect(
      parseEnvioFilters({
        envios_periodo: "7d",
        envios_origem: "voce",
        envios_situacao: "failed",
      })
    ).toEqual({ period: "7d", origem: "voce", situacao: "failed" });
  });

  it("sem parâmetro nenhum, devolve o estado sem filtro", () => {
    expect(parseEnvioFilters({})).toEqual(NO_ENVIO_FILTERS);
  });

  describe("lista branca", () => {
    it("descarta origem desconhecida", () => {
      expect(parseEnvioFilters({ envios_origem: "inventada" }).origem).toBeNull();
    });

    it("descarta situação desconhecida", () => {
      expect(parseEnvioFilters({ envios_situacao: "entregue" }).situacao).toBeNull();
    });

    it("período desconhecido volta para 'tudo' em vez de virar SQL", () => {
      expect(parseEnvioFilters({ envios_periodo: "1 year" }).period).toBe("tudo");
      expect(parseEnvioFilters({ envios_periodo: "7d; delete from queue" }).period).toBe("tudo");
    });

    it("descarta tentativa de injeção em cada campo", () => {
      const f = parseEnvioFilters({
        envios_origem: "voce' or '1'='1",
        envios_situacao: "';drop table queue;--",
      });
      expect(f.origem).toBeNull();
      expect(f.situacao).toBeNull();
    });
  });

  it("não lê os parâmetros da outra seção da página", () => {
    // `periodo` sem prefixo é da lista de interações. Se ele vazasse para cá,
    // mexer num filtro moveria os dois recortes de uma vez.
    expect(parseEnvioFilters({ periodo: "7d", tipo: "comment", q: "oi" })).toEqual(
      NO_ENVIO_FILTERS
    );
  });

  it("com parâmetro repetido na URL, usa o primeiro", () => {
    expect(parseEnvioFilters({ envios_origem: ["voce", "robo"] }).origem).toBe("voce");
  });

  it("ignora valores que não são texto", () => {
    expect(parseEnvioFilters({ envios_origem: undefined }).origem).toBeNull();
  });
});

describe("toEnvioQueryString", () => {
  it("sem filtro, devolve string vazia — a URL fica só /eventos", () => {
    expect(toEnvioQueryString(NO_ENVIO_FILTERS)).toBe("");
  });

  it("omite o período padrão", () => {
    expect(toEnvioQueryString({ ...NO_ENVIO_FILTERS, origem: "robo" })).toBe(
      "envios_origem=robo"
    );
  });

  it("mantém sempre a mesma ordem, para a URL não mudar à toa", () => {
    expect(
      toEnvioQueryString({ period: "7d", origem: "voce", situacao: "failed" })
    ).toBe("envios_periodo=7d&envios_origem=voce&envios_situacao=failed");
  });

  it("o que sai daqui volta igual pelo parseEnvioFilters", () => {
    const f = { period: "30d", origem: "voce", situacao: "pending" } as const;
    const params = Object.fromEntries(new URLSearchParams(toEnvioQueryString(f)));
    expect(parseEnvioFilters(params)).toEqual(f);
  });

  it("todo período de PERIODS sobrevive à ida e à volta", () => {
    for (const p of PERIODS) {
      const params = Object.fromEntries(
        new URLSearchParams(toEnvioQueryString({ ...NO_ENVIO_FILTERS, period: p.key }))
      );
      expect(parseEnvioFilters(params).period).toBe(p.key);
    }
  });
});

describe("hasEnvioFilters", () => {
  it("é falso só no estado inicial", () => {
    expect(hasEnvioFilters(NO_ENVIO_FILTERS)).toBe(false);
  });

  it("qualquer campo preenchido conta", () => {
    expect(hasEnvioFilters({ ...NO_ENVIO_FILTERS, period: "24h" })).toBe(true);
    expect(hasEnvioFilters({ ...NO_ENVIO_FILTERS, origem: "robo" })).toBe(true);
    expect(hasEnvioFilters({ ...NO_ENVIO_FILTERS, situacao: "sent" })).toBe(true);
  });
});

// O que era `juntarQuery` — colar a metade de uma barra na metade da outra —
// virou queryDaPagina, em lib/eventos-url.ts, e está testado lá: a página
// inteira passou a ter um dono só da URL, então não há mais metades para colar.

describe("origemDoKind", () => {
  it("o que a pessoa digitou na caixa de entrada é 'voce'", () => {
    for (const k of KINDS_MANUAIS) expect(origemDoKind(k)).toBe("voce");
  });

  it("todo o resto é do robô", () => {
    for (const k of [
      "private_reply",
      "comment_reply",
      "dm_welcome",
      "dm_link",
      "dm_reminder",
      "dm_follow_gate",
      "dm_email_ask",
      "story_reaction",
    ]) {
      expect(origemDoKind(k)).toBe("robo");
    }
  });

  it("kind desconhecido conta como robô, e não como envio da pessoa", () => {
    // Errar para o lado do robô é o lado seguro: um kind novo nasce do motor.
    expect(origemDoKind("kind_que_ainda_nao_existe")).toBe("robo");
  });
});

describe("resumoSituacoes", () => {
  it("sem envio nenhum, não há frase", () => {
    expect(resumoSituacoes([])).toBeNull();
  });

  it("concorda o singular", () => {
    expect(resumoSituacoes([{ situacao: "sent", total: 1 }])).toBe("1 entregue");
    expect(resumoSituacoes([{ situacao: "failed", total: 1 }])).toBe("1 não saiu");
  });

  it("concorda o plural", () => {
    expect(resumoSituacoes([{ situacao: "sent", total: 28 }])).toBe("28 entregues");
    expect(resumoSituacoes([{ situacao: "failed", total: 2 }])).toBe("2 não saíram");
  });

  it("lista na ordem declarada, não na ordem que o banco devolveu", () => {
    expect(
      resumoSituacoes([
        { situacao: "failed", total: 1 },
        { situacao: "sent", total: 24 },
        { situacao: "pending", total: 3 },
      ])
    ).toBe("24 entregues, 3 na fila, 1 não saiu");
  });

  it("situação com zero não entra na frase", () => {
    expect(
      resumoSituacoes([
        { situacao: "sent", total: 5 },
        { situacao: "failed", total: 0 },
      ])
    ).toBe("5 entregues");
  });

  it("situação fora do previsto entra sem vazar o nome técnico", () => {
    // O total tem que continuar fechando com a lista, mesmo num caso que o
    // `check` da tabela não deveria permitir.
    const r = resumoSituacoes([
      { situacao: "sent", total: 2 },
      { situacao: "inventada", total: 3 },
    ]);
    expect(r).toBe("2 entregues, 3 em outra situação");
    expect(r).not.toContain("inventada");
  });

  it("cobre todas as situações declaradas", () => {
    for (const s of SITUACOES) {
      expect(resumoSituacoes([{ situacao: s.key, total: 2 }])).toBe(`2 ${s.muitos}`);
    }
  });
});

describe("totalDeEnvios", () => {
  it("é a soma das situações — o mesmo recorte da lista", () => {
    expect(
      totalDeEnvios([
        { situacao: "sent", total: 24 },
        { situacao: "pending", total: 3 },
        { situacao: "failed", total: 1 },
      ])
    ).toBe(28);
  });

  it("sem linha nenhuma, é zero", () => {
    expect(totalDeEnvios([])).toBe(0);
  });

  it("o total nunca é menor que a soma mostrada no resumo", () => {
    // O resumo e o total nascem da MESMA lista: se um dia divergirem, o número
    // grande passa a mentir. Este teste é o que impede isso.
    const c = [
      { situacao: "sent", total: 4 },
      { situacao: "inventada", total: 6 },
    ];
    const numeros = (resumoSituacoes(c) ?? "").match(/\d+/g)?.map(Number) ?? [];
    expect(numeros.reduce((a, b) => a + b, 0)).toBe(totalDeEnvios(c));
  });
});
