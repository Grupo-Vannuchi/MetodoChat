import { describe, it, expect } from "vitest";
import {
  nomeDoGatilho,
  resumoDasPalavras,
  resumoDoGatilho,
} from "../app/automacoes/editor/gatilho";

// O QUE ESTE ARQUIVO FIXA: o cartão do gatilho descreve o que o MOTOR faz.
//
// As duas funções são lidas em DOIS lugares — o nó do quadro (`gatilho.tsx`) e o
// cartão da lista de leitura no celular (`quadro.tsx`, a única forma de conferir
// o fluxo sem computador). Elas são exportadas justamente para os dois não
// divergirem; o que faltava era teste dizendo o que elas devem responder.
describe("resumoDasPalavras", () => {
  it("“Qualquer texto” manda, mesmo com palavras guardadas", () => {
    // O defeito que este teste tranca. Trocar a correspondência para "any" no
    // painel do gatilho DESABILITA o campo mas PRESERVA o que estava digitado, e
    // `salvarAutomacao` grava essas palavras do mesmo jeito. O cartão imprimia
    // "contém quero, link" enquanto `findMatch` (lib/engine.ts) casava TODA
    // mensagem, de todo mundo — e o cartão do celular existe justamente para
    // conferir o fluxo.
    expect(resumoDasPalavras(["quero", "link"], "any")).toBe("qualquer mensagem");
    expect(resumoDasPalavras([], "any")).toBe("qualquer mensagem");
  });

  it("“contém” e “texto exato” não são a mesma regra, e não dizem a mesma coisa", () => {
    // `match.ts` compara a mensagem INTEIRA no `exact`. Quem lê "contém quero"
    // espera que "eu quero!" dispare, e nesse tipo não dispara.
    expect(resumoDasPalavras(["quero", "link"], "contains")).toBe("contém quero, link");
    expect(resumoDasPalavras(["quero"], "exact")).toBe("texto exato: quero");
    expect(resumoDasPalavras(["quero"], "contains")).not.toBe(
      resumoDasPalavras(["quero"], "exact")
    );
  });

  it("sem palavra nenhuma fora do “any” não é “qualquer mensagem” — é o oposto", () => {
    // Era o que ele respondia, lendo só o tamanho da lista. Automação sem
    // palavra-chave e sem "any" não dispara com NADA, e `salvarAutomacao`
    // (app/automacoes/actions.ts) recusa gravá-la.
    expect(resumoDasPalavras([], "contains")).toBe("sem palavra-chave");
    expect(resumoDasPalavras([], "exact")).toBe("sem palavra-chave");
  });

  it("tipo de correspondência desconhecido cai em “contém”, não em “qualquer”", () => {
    // A coluna é texto livre no banco. Errar para o lado de "qualquer mensagem"
    // prometeria a rede de arrasto justamente onde não se sabe o que é; errar
    // para "contém" descreve o padrão do produto e do `match.ts`.
    expect(resumoDasPalavras(["quero"], "coisa_nova")).toBe("contém quero");
  });
});

describe("resumoDoGatilho", () => {
  // A pergunta que faltava ANTES de `resumoDasPalavras`. Os dois cartões
  // (`gatilho.tsx` no quadro, `quadro.tsx` na lista de leitura do celular)
  // passaram a chamar esta.
  it("abertura não fala de palavra-chave — ela não tem nenhuma", () => {
    // O defeito que este teste tranca: por `resumoDasPalavras`, uma automação de
    // abertura saudável lia "sem palavra-chave" — a frase que este arquivo
    // escolheu para dizer "não dispara com NADA, e o salvar recusa gravá-la". O
    // diagnóstico mais alarmante do cartão, sobre o caso normal.
    expect(resumoDoGatilho("abertura", [], "contains")).toBe(
      "toque numa pergunta de abertura da conta"
    );
    expect(resumoDoGatilho("abertura", [], "contains")).not.toBe("sem palavra-chave");
  });

  it("as palavras guardadas de um gatilho antigo não vazam para a abertura", () => {
    // Trocar o gatilho no painel PRESERVA o que estava digitado — é o mesmo
    // mecanismo que faz "Qualquer texto" guardar palavras. Em `abertura` elas
    // não valem nada, e o cartão não pode prometê-las.
    expect(resumoDoGatilho("abertura", ["quero", "link"], "contains")).toBe(
      "toque numa pergunta de abertura da conta"
    );
    expect(resumoDoGatilho("abertura", ["quero"], "any")).not.toBe("qualquer mensagem");
  });

  it("os três gatilhos de texto continuam respondendo o que sempre responderam", () => {
    for (const g of ["dm", "comment", "story"]) {
      expect(resumoDoGatilho(g, ["quero"], "contains")).toBe(
        resumoDasPalavras(["quero"], "contains")
      );
      expect(resumoDoGatilho(g, [], "any")).toBe("qualquer mensagem");
      expect(resumoDoGatilho(g, [], "exact")).toBe("sem palavra-chave");
    }
  });
});

describe("nomeDoGatilho", () => {
  it("os quatro gatilhos que o editor oferece", () => {
    expect(nomeDoGatilho("dm")).toBe("DM");
    expect(nomeDoGatilho("comment")).toBe("COMENTÁRIO");
    expect(nomeDoGatilho("story")).toBe("STORY");
    // Sem esta linha o cartão da abertura lia "GATILHO · ABERTURA" pelo
    // `toUpperCase()` do `??`, por acaso — e um gatilho cujo nome o mapa não
    // conhece é um gatilho que ninguém decidiu como chamar.
    expect(nomeDoGatilho("abertura")).toBe("ABERTURA");
  });

  it("gatilho desconhecido aparece em vez de sumir", () => {
    // A coluna `triggers` é um array de texto e já teve outros valores. Um
    // gatilho que a tabela não conhece precisa APARECER — sumir deixaria o
    // cartão dizendo "GATILHO ·" e mais nada.
    expect(nomeDoGatilho("outro")).toBe("OUTRO");
  });
});
