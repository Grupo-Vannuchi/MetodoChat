import { describe, it, expect } from "vitest";
import {
  chaveDoDia,
  horaDoDia,
  diaSomado,
  diaDaSemana,
  gradeDoMes,
  gradeDaSemana,
  mesVizinho,
  visaoDaUrl,
  ancoraDaUrl,
  agruparPorDia,
  recorteDoDia,
  MAX_POR_DIA_NO_MES,
} from "@/lib/calendario";

// O QUE ESTE ARQUIVO PROTEGE: em que quadrado cada post aparece.
//
// O RISCO CENTRAL É O FUSO, e ele é silencioso: `not_before` é UTC, a Vercel
// roda em UTC, e um post das 21:00 de Brasília é meia-noite do dia SEGUINTE em
// UTC. Agrupado pelo dia de UTC ele cai na célula errada — e ninguém desconfia,
// porque o horário escrito ao lado dele continua certo.

describe("o fuso, que é o risco central", () => {
  // 11/09/2026 às 21:00 em Brasília = 12/09 às 00:00 em UTC.
  const noiteDeBrasilia = new Date("2026-09-12T00:00:00.000Z");

  it("21:00 de Brasília pertence ao dia de Brasília, e não ao de UTC", () => {
    expect(chaveDoDia(noiteDeBrasilia)).toBe("2026-09-11");
  });

  it("e a hora mostrada é a de Brasília", () => {
    expect(horaDoDia(noiteDeBrasilia)).toBe("21:00");
  });

  it("a virada do dia em Brasília é às 03:00 UTC", () => {
    expect(chaveDoDia(new Date("2026-09-12T02:59:00.000Z"))).toBe("2026-09-11");
    expect(chaveDoDia(new Date("2026-09-12T03:00:00.000Z"))).toBe("2026-09-12");
  });

  it("o post real de 11/09 cai no dia 11", () => {
    // O que saiu de verdade: 13:02:59Z, que é 10:02 em Brasília.
    expect(chaveDoDia(new Date("2026-09-11T13:02:59.899Z"))).toBe("2026-09-11");
    expect(horaDoDia(new Date("2026-09-11T13:02:59.899Z"))).toBe("10:02");
  });
});

describe("diaSomado — a conta que não passa por `Date` local", () => {
  it("soma e subtrai dentro do mês", () => {
    expect(diaSomado("2026-09-11", 1)).toBe("2026-09-12");
    expect(diaSomado("2026-09-11", -1)).toBe("2026-09-10");
  });

  it("atravessa a virada do mês e do ano", () => {
    expect(diaSomado("2026-09-30", 1)).toBe("2026-10-01");
    expect(diaSomado("2026-12-31", 1)).toBe("2027-01-01");
    expect(diaSomado("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("acerta fevereiro de ano bissexto", () => {
    expect(diaSomado("2028-02-28", 1)).toBe("2028-02-29");
    expect(diaSomado("2028-02-29", 1)).toBe("2028-03-01");
    expect(diaSomado("2026-02-28", 1)).toBe("2026-03-01");
  });

  it("somar zero devolve o mesmo dia", () => {
    expect(diaSomado("2026-09-11", 0)).toBe("2026-09-11");
  });
});

describe("diaDaSemana", () => {
  it("11/09/2026 é sexta", () => {
    expect(diaDaSemana("2026-09-11")).toBe(5);
  });
  it("domingo é zero", () => {
    expect(diaDaSemana("2026-09-06")).toBe(0);
  });
});

describe("a grade do mês", () => {
  const g = gradeDoMes("2026-09", "2026-09-11");

  it("tem sempre seis semanas — a página não pode pular ao navegar", () => {
    // Uma grade que muda de altura conforme o mês faz a tela se mexer embaixo
    // de quem está lendo. O custo é uma linha a mais em alguns meses.
    expect(g.casas).toHaveLength(42);
  });

  it("começa no domingo da semana do dia 1", () => {
    // 01/09/2026 é terça, então a grade abre em 30/08 (domingo).
    expect(g.casas[0].chave).toBe("2026-08-30");
    expect(diaDaSemana(g.casas[0].chave)).toBe(0);
  });

  it("as casas do mês vizinho entram, e vêm marcadas", () => {
    // Escondê-las deixaria buracos no canto, e buraco lê como "não há dia".
    expect(g.casas[0].doMes).toBe(false);
    expect(g.casas.find((c) => c.chave === "2026-09-01")!.doMes).toBe(true);
    expect(g.casas.filter((c) => c.doMes)).toHaveLength(30);
  });

  it("marca o hoje, e só ele", () => {
    expect(g.casas.filter((c) => c.hoje).map((c) => c.chave)).toEqual(["2026-09-11"]);
  });

  it("o título é o mês por extenso", () => {
    expect(g.titulo).toBe("setembro 2026");
  });

  it("as casas são contíguas, sem pulo nem repetição", () => {
    // A invariante que pega qualquer erro de soma de dias de uma vez.
    for (let i = 1; i < g.casas.length; i++) {
      expect(g.casas[i].chave, `casa ${i}`).toBe(diaSomado(g.casas[i - 1].chave, 1));
    }
  });

  it("um mês que começa no sábado ainda cabe nas seis semanas", () => {
    // 01/08/2026 é sábado: é o caso que precisa das seis linhas.
    const agosto = gradeDoMes("2026-08", "2026-09-11");
    expect(agosto.casas).toHaveLength(42);
    expect(agosto.casas.some((c) => c.chave === "2026-08-31")).toBe(true);
  });
});

describe("a grade da semana", () => {
  it("vai de domingo a sábado, contendo o dia pedido", () => {
    const g = gradeDaSemana("2026-09-11", "2026-09-11");
    expect(g.casas).toHaveLength(7);
    expect(g.casas[0].chave).toBe("2026-09-06");
    expect(g.casas[6].chave).toBe("2026-09-12");
  });

  it("a semana que atravessa a virada do mês diz os DOIS meses", () => {
    // Dizer só um deles seria mentir sobre metade da linha.
    const g = gradeDaSemana("2026-09-01", "2026-09-11");
    expect(g.titulo).toContain("agosto");
    expect(g.titulo).toContain("setembro");
  });

  it("dentro do mesmo mês, o título não repete o nome", () => {
    const g = gradeDaSemana("2026-09-08", "2026-09-11");
    expect(g.titulo).toBe("6 – 12 de setembro");
  });

  it("navegar anda sete dias, não um mês", () => {
    const g = gradeDaSemana("2026-09-11", "2026-09-11");
    expect(g.anterior).toBe("2026-08-30");
    expect(g.seguinte).toBe("2026-09-13");
  });

  it("nenhuma casa é de enchimento — a semana não tem canto vazio", () => {
    const g = gradeDaSemana("2026-09-01", "2026-09-11");
    expect(g.casas.every((c) => c.doMes)).toBe(true);
  });
});

describe("mesVizinho", () => {
  it("anda dentro do ano", () => {
    expect(mesVizinho("2026-09", 1)).toBe("2026-10");
    expect(mesVizinho("2026-09", -1)).toBe("2026-08");
  });

  it("atravessa a virada do ano nos dois sentidos", () => {
    expect(mesVizinho("2026-12", 1)).toBe("2027-01");
    expect(mesVizinho("2026-01", -1)).toBe("2025-12");
  });
});

describe("o que a URL manda, e ela é digitável", () => {
  const HOJE = "2026-09-11";

  it("o padrão é o MÊS — foi escolha do dono", () => {
    expect(visaoDaUrl(undefined)).toBe("mes");
    expect(visaoDaUrl("qualquer coisa")).toBe("mes");
    expect(visaoDaUrl("semana")).toBe("semana");
  });

  it("sem âncora, é o mês de hoje ou o dia de hoje", () => {
    expect(ancoraDaUrl(undefined, "mes", HOJE)).toBe("2026-09");
    expect(ancoraDaUrl(undefined, "semana", HOJE)).toBe(HOJE);
  });

  it("lixo cai em hoje, e nunca vira `NaN` numa grade vazia", () => {
    expect(ancoraDaUrl("banana", "mes", HOJE)).toBe("2026-09");
    expect(ancoraDaUrl("2026-13", "mes", HOJE)).toBe("2026-09");
    expect(ancoraDaUrl("2026-09-32", "semana", HOJE)).toBe(HOJE);
    expect(ancoraDaUrl("2026-9-1", "semana", HOJE)).toBe(HOJE);
  });

  it("um pedido legítimo passa inteiro", () => {
    expect(ancoraDaUrl("2027-03", "mes", HOJE)).toBe("2027-03");
    expect(ancoraDaUrl("2027-03-15", "semana", HOJE)).toBe("2027-03-15");
  });

  it("parâmetro repetido lê o primeiro", () => {
    expect(ancoraDaUrl(["2027-03", "2030-01"], "mes", HOJE)).toBe("2027-03");
  });

  it("uma âncora de mês pedida na visão de semana não passa", () => {
    // `?v=semana&em=2026-09` não tem dia; cair em hoje é melhor que inventar o
    // dia 1, que levaria a pessoa a uma semana que ela não pediu.
    expect(ancoraDaUrl("2026-09", "semana", HOJE)).toBe(HOJE);
  });
});

describe("agruparPorDia", () => {
  it("junta pelo dia de Brasília, e não pelo de UTC", () => {
    const itens = [
      { id: "noite", quando: new Date("2026-09-12T00:30:00Z") }, // 11/09 21:30 BRT
      { id: "manha", quando: new Date("2026-09-11T13:00:00Z") }, // 11/09 10:00 BRT
      { id: "outro", quando: new Date("2026-09-12T15:00:00Z") }, // 12/09 12:00 BRT
    ];
    const mapa = agruparPorDia(itens, (i) => i.quando);
    expect(mapa.get("2026-09-11")!.map((i) => i.id)).toEqual(["noite", "manha"]);
    expect(mapa.get("2026-09-12")!.map((i) => i.id)).toEqual(["outro"]);
  });

  it("dia sem item simplesmente não existe no mapa", () => {
    expect(agruparPorDia([], () => new Date()).size).toBe(0);
  });
});

describe("recorteDoDia — quem corta tem de contar", () => {
  it("dentro do limite não esconde nada", () => {
    const r = recorteDoDia([1, 2]);
    expect(r.mostrados).toHaveLength(2);
    expect(r.escondidos).toBe(0);
  });

  it("acima do limite corta e diz quantos", () => {
    const r = recorteDoDia([1, 2, 3, 4, 5]);
    expect(r.mostrados).toHaveLength(MAX_POR_DIA_NO_MES);
    expect(r.escondidos).toBe(5 - MAX_POR_DIA_NO_MES);
  });

  it("mostrados + escondidos é sempre o total", () => {
    for (const n of [0, 1, 3, 4, 20]) {
      const r = recorteDoDia(Array.from({ length: n }, (_, i) => i));
      expect(r.mostrados.length + r.escondidos, `com ${n}`).toBe(n);
    }
  });
});
