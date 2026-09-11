import { describe, it, expect } from "vitest";
import {
  normalizarBusca,
  casaComBusca,
  recorteDaTabela,
  LIMITE_DA_TABELA,
  BUSCA_MAX,
} from "@/lib/busca-de-contatos";

// O QUE ESTE ARQUIVO PROTEGE: a busca que torna possível cortar a tabela de
// `/contatos` sem esconder ninguém (achado M6, 8477px = catorze telas).
//
// O termo vem da barra de endereço, que qualquer um edita, então vale aqui a
// mesma disciplina de `parseFilters`: o que passa daqui decide o que a tela
// mostra.

const quem = (username: string | null, name: string | null, email: string | null = null) => ({
  username,
  name,
  email,
});

describe("normalizarBusca", () => {
  it("sem parâmetro não há busca", () => {
    expect(normalizarBusca(undefined)).toBeNull();
    expect(normalizarBusca("")).toBeNull();
    expect(normalizarBusca("   ")).toBeNull();
  });

  it("tira acento, porque num produto brasileiro isso não é detalhe", () => {
    // Sem isto a busca serve a quem já sabe escrever o nome exatamente como a
    // pessoa escreveu — ou seja, a quem não precisa buscar.
    expect(normalizarBusca("Natália")).toBe("natalia");
    expect(normalizarBusca("VITÓRIA")).toBe("vitoria");
    expect(normalizarBusca("Construções")).toBe("construcoes");
  });

  it("corta no teto: a barra de endereço é digitável", () => {
    const gigante = "a".repeat(BUSCA_MAX + 50);
    expect(normalizarBusca(gigante)).toHaveLength(BUSCA_MAX);
  });

  it("parâmetro repetido lê o primeiro, e não quebra", () => {
    expect(normalizarBusca(["ana", "bia"])).toBe("ana");
  });

  it("valor que não é texto não vira busca", () => {
    expect(normalizarBusca([] as unknown as string[])).toBeNull();
  });
});

describe("casaComBusca", () => {
  it("acha pelo @, pelo nome e pelo e-mail", () => {
    // OS TRÊS SÃO OS TRÊS JEITOS DE ALGUÉM SER LEMBRADO. Procurar só pelo @
    // obrigaria a saber o @, que é o que não se sabe de cor.
    const c = quem("eng.luishreis", "Luis Henrique", "luis.henriquesilva@hotmail.com");
    expect(casaComBusca(c, "luishreis")).toBe(true);
    expect(casaComBusca(c, "henrique")).toBe(true);
    expect(casaComBusca(c, "hotmail")).toBe(true);
    expect(casaComBusca(c, "jonas")).toBe(false);
  });

  it("acha no MEIO do texto, e não só no começo", () => {
    // Ninguém lembra do começo de um @ de empresa.
    const c = quem("alliancejiujitsusantos", "Alliance Jiu Jitsu | Ponta da Praia");
    expect(casaComBusca(c, "jiujitsu")).toBe(true);
    expect(casaComBusca(c, "praia")).toBe(true);
  });

  it("o acento sai dos DOIS lados", () => {
    const c = quem("natvarandas", "Natália Varandas");
    expect(casaComBusca(c, "natalia")).toBe(true);
    expect(casaComBusca(c, "Natália")).toBe(true);
  });

  it("campo nulo não quebra nem casa por acidente", () => {
    // Contato que chegou por comentário pode não ter nome nem e-mail.
    const c = quem(null, null, null);
    expect(casaComBusca(c, "ana")).toBe(false);
    expect(() => casaComBusca(c, "ana")).not.toThrow();
  });

  it("termo vazio casa com todo mundo — é a tela sem busca", () => {
    expect(casaComBusca(quem(null, null), "")).toBe(true);
  });
});

describe("recorteDaTabela — quem corta tem de contar", () => {
  const lista = (n: number) => Array.from({ length: n }, (_, i) => i);

  it("com menos que o limite, não esconde nada", () => {
    const r = recorteDaTabela(lista(10));
    expect(r.mostradas).toHaveLength(10);
    expect(r.escondidas).toBe(0);
  });

  it("com mais, corta e DIZ quantas ficaram", () => {
    // O NÚMERO DE ESCONDIDAS É O PONTO: um corte calado faz a tela dizer "estes
    // são os contatos" quando são os primeiros vinte e cinco. Foi exatamente o
    // defeito do `limit 200` que a consulta desta página removeu.
    const r = recorteDaTabela(lista(127));
    expect(r.mostradas).toHaveLength(LIMITE_DA_TABELA);
    expect(r.escondidas).toBe(127 - LIMITE_DA_TABELA);
  });

  it("exatamente no limite não esconde nada", () => {
    expect(recorteDaTabela(lista(LIMITE_DA_TABELA)).escondidas).toBe(0);
  });

  it("mostradas + escondidas é sempre o total", () => {
    // A igualdade que impede o número de virar decoração.
    for (const n of [0, 1, 24, 25, 26, 127, 1000]) {
      const r = recorteDaTabela(lista(n));
      expect(r.mostradas.length + r.escondidas, `com ${n}`).toBe(n);
    }
  });

  it("limite absurdo não produz tabela vazia com contagem cheia", () => {
    const r = recorteDaTabela(lista(50), 0);
    expect(r.mostradas.length).toBeGreaterThan(0);
    expect(r.mostradas.length + r.escondidas).toBe(50);
  });
});
