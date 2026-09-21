import { describe, expect, it } from "vitest";
import { campoPorChave } from "@/lib/campos";
import { extractEmail } from "@/lib/match";

const telefone = (t: string) => campoPorChave("telefone")!.extrair(t);

describe("extrair telefone", () => {
  it("acha o número dentro da frase, que é como as pessoas respondem", () => {
    expect(telefone("meu zap é (11) 99999-9999")).toBe("11999999999");
    expect(telefone("11999999999")).toBe("11999999999");
    expect(telefone("+55 11 99999 9999")).toBe("11999999999");
    expect(telefone("fixo: 1133334444")).toBe("1133334444");
  });

  it("recusa o que não tem 10 ou 11 dígitos — e isso descarta ano", () => {
    // A REGRA É POR QUANTIDADE DE DÍGITOS, e não por lista de exceções: "1990"
    // não é telefone porque tem 4 dígitos, não porque "parece ano". O CPF NÃO
    // está nesta lista: ele também tem 11 dígitos, então contagem sozinha não
    // o distingue de celular — isso é o caso seguinte.
    expect(telefone("nasci em 1990")).toBe(null);
    expect(telefone("123")).toBe(null);
    expect(telefone("não tenho")).toBe(null);
  });

  it("recusa CPF de 11 dígitos pela forma, não pela quantidade", () => {
    // CPF tem 11 dígitos — o mesmo tanto que celular — e por isso CONTAR
    // dígitos não separa um do outro; o caso anterior só descarta o que tem
    // dígito de menos (ano, índice). O que separa é o plano de numeração:
    // todo celular brasileiro de 11 dígitos tem "9" como TERCEIRO dígito
    // (DDD + 9 + oito dígitos, regra vigente desde 2016), e CPF não segue essa
    // forma — não é lista de exceções, é a forma que todo celular tem. Cobre
    // o CPF pontuado (que agora é um bloco só, já que "." virou separador de
    // telefone — ver "aceita o ponto...") e o CPF sem pontuação nenhuma, que
    // sem esta regra passaria pela contagem de dígitos como se fosse celular.
    expect(telefone("111.222.333-44")).toBe(null);
    expect(telefone("meu cpf e 11122233344")).toBe(null);
  });

  it("aceita o ponto como separador — é escrita comum de celular no Brasil", () => {
    expect(telefone("11.99999-9999")).toBe("11999999999");
    expect(telefone("11.99999.9999")).toBe("11999999999");
  });

  it("tira o zero de discagem antigo grudado no DDD", () => {
    // "(011)" é o formato "0 + DDD" do prefixo de interurbano antigo — o zero
    // é prefixo de discagem, não dado. Nenhum DDD brasileiro começa com zero;
    // sem tirar esse zero o valor gravado teria 11 dígitos com um DDD de três
    // dígitos, que não disca nem exporta igual aos telefones dos outros
    // contatos.
    expect(telefone("tel (011) 3333-4444")).toBe("1133334444");
  });

  it("guarda só os dígitos, sem DDI — é o que dá para exportar e discar", () => {
    expect(telefone("+5511999999999")).toBe("11999999999");
  });

  it("não confunde DDD 55 (Rio Grande do Sul) com o DDI do Brasil", () => {
    // A guarda do DDI só corta quando SOBRA dígito demais para ser DDD+número
    // (`digitosBrutos.length > 11`). Sem essa condição, "55 3334-4444" — DDD
    // do Rio Grande do Sul, não DDI — perderia os dois primeiros dígitos à
    // toa, e todo contato gaúcho viraria `null` em silêncio. Este caso é o
    // que prende essa guarda: um refactor que apague a condição precisa
    // ficar vermelho aqui, não só sobreviver por acaso.
    expect(telefone("55 3334-4444")).toBe("5533344444");
    expect(telefone("55 99999-9999")).toBe("55999999999");
  });
});

describe("extrair e-mail", () => {
  it("é extractEmail de lib/match por IDENTIDADE, não uma regex nova", () => {
    // Prender por identidade, e não por comportamento: comparar resultado
    // contra alguns e-mails de exemplo deixaria passar uma regex nova que
    // imita os casos testados e diverge numa borda que ninguém pensou. Só
    // existe UMA função que decide o que é e-mail válido nesta base, e é
    // esta comparação — `toBe`, não `toEqual` — que garante que o catálogo
    // continua apontando para ELA, não para uma cópia parecida.
    expect(campoPorChave("email")!.extrair).toBe(extractEmail);
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

  it("aceita 'sou' sem artigo, e 'eu sou', sem comer nome parecido", () => {
    // "sou Ana", sem artigo, é forma tão comum quanto "sou a Ana" — e o
    // motivo do prefixo (não deixar `{{nome_informado}}` mandar "Oi sou a
    // ana") vale igual aqui: sem estender, "sou Ana" escapava e devolvia a
    // frase inteira.
    expect(nome("sou Ana")).toBe("Ana");
    expect(nome("eu sou a Ana")).toBe("Ana");
    expect(nome("eu sou Ana Souza")).toBe("Ana Souza");
    // "Sousa" começa com as mesmas quatro letras de "sou" + vogal, mas sem
    // espaço depois de "sou" — o prefixo só pode comer "sou"/"eu sou"
    // SEGUIDOS DE ESPAÇO, senão um sobrenome de verdade vira "sa".
    expect(nome("Sousa")).toBe("Sousa");
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
