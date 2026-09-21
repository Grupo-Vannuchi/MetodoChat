import { describe, expect, it } from "vitest";
import { campoPorChave } from "@/lib/campos";

const telefone = (t: string) => campoPorChave("telefone")!.extrair(t);

describe("extrair telefone", () => {
  it("acha o número dentro da frase, que é como as pessoas respondem", () => {
    expect(telefone("meu zap é (11) 99999-9999")).toBe("11999999999");
    expect(telefone("11999999999")).toBe("11999999999");
    expect(telefone("+55 11 99999 9999")).toBe("11999999999");
    expect(telefone("fixo: 1133334444")).toBe("1133334444");
  });

  it("recusa o que não tem 10 ou 11 dígitos — e isso descarta ano e CPF", () => {
    // A REGRA É POR QUANTIDADE DE DÍGITOS, e não por lista de exceções: "1990"
    // não é telefone porque tem 4 dígitos, e um CPF não é porque tem 11 mas
    // vem sem DDD válido. Lista de exceções sempre esquece um caso.
    expect(telefone("nasci em 1990")).toBe(null);
    expect(telefone("123")).toBe(null);
    expect(telefone("111.222.333-44")).toBe(null);
    expect(telefone("não tenho")).toBe(null);
  });

  it("guarda só os dígitos, sem DDI — é o que dá para exportar e discar", () => {
    expect(telefone("+5511999999999")).toBe("11999999999");
  });
});

const nome = (t: string) => campoPorChave("nome_informado")!.extrair(t);

describe("extrair nome informado", () => {
  it("tira o prefixo comum e devolve o nome", () => {
    expect(nome("Ana")).toBe("Ana");
    expect(nome("meu nome é Ana Souza")).toBe("Ana Souza");
    expect(nome("  Ana  ")).toBe("Ana");
  });

  it("tira o prefixo mesmo quando a pessoa escreve sem capricho", () => {
    expect(nome("sou a ana")).toBe("ana");
    expect(nome("me chamo Ana")).toBe("Ana");
  });

  it("aceita o desleixado que NÃO tem prefixo, em vez de recusar", () => {
    // A RECUSA É FRACA DE PROPÓSITO: uma lista de palavras proibidas sempre
    // erra alguém. O custo de aceitar "ana 😊" é menor que o de recusar um nome
    // de verdade porque veio com emoji junto.
    expect(nome("ana 😊")).toBe("ana 😊");
    expect(nome("Ana!")).toBe("Ana!");
  });

  it("recusa o que claramente não é nome", () => {
    expect(nome("")).toBe(null);
    expect(nome("   ")).toBe(null);
    expect(nome("🔥🔥🔥")).toBe(null);
    expect(nome("a".repeat(61))).toBe(null);
  });
});

const nasc = (t: string) => campoPorChave("nascimento")!.extrair(t);

describe("extrair nascimento", () => {
  it("aceita os formatos que as pessoas escrevem", () => {
    expect(nasc("01/02/1990")).toBe("1990-02-01");
    expect(nasc("1990-02-01")).toBe("1990-02-01");
    expect(nasc("nasci em 01/02/1990")).toBe("1990-02-01");
  });

  it("recusa data impossível e data no futuro", () => {
    // `new Date("2026-02-30")` NÃO lança: ele rola para 2 de março. Sem a
    // conferência de volta, "30/02" viraria uma data válida e errada.
    expect(nasc("30/02/1990")).toBe(null);
    expect(nasc("01/02/2099")).toBe(null);
  });
});
