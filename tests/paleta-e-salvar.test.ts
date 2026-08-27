import { describe, it, expect } from "vitest";
import { conferirLista, salvarRecusaOBloco } from "../lib/steps";
import {
  PALETA,
  blocoNovo,
  paletaOferece,
  tipoDoItem,
  type ItemDaPaleta,
} from "../app/automacoes/editor/modelos";

// O QUE ESTE ARQUIVO FIXA: a faixa de blocos do editor nunca oferece um bloco
// que o salvar vai recusar.
//
// A paleta (`app/automacoes/editor/paleta.tsx`) apaga item por gatilho, e até a
// fase das portas de entrada ela decidia isso sozinha, lendo o campo `gatilhos`
// de cada item — uma lista escrita à mão, item a item. `conferirLista`
// (lib/steps.ts) decidia a mesma coisa por outro caminho, com as suas próprias
// linhas de ERRO. Duas respostas para a mesma pergunta, sem nada as ligando.
//
// MEDIDO ao acrescentar o gatilho `abertura`: as duas concordavam nele por
// COINCIDÊNCIA. Nenhuma linha de `modelos.ts` sabe que `abertura` existe; o
// acerto vinha de `resposta_publica` listar só `comment` e `reagir_story` listar
// só `story`. O próximo gatilho podia cair do outro lado, e o dono descobriria
// montando o fluxo e apanhando no salvar.
//
// A LISTA À MÃO CONTINUA PODENDO SER MAIS RESTRITIVA — e é, hoje, num caso:
// em `dm` ela não oferece o coraçãozinho, e `conferirLista` ali só AVISA (o
// bloco roda; ele reage à mensagem que a pessoa mandou). Essa metade da
// diferença não fere ninguém. O que este arquivo tranca é a outra metade.
const GATILHOS = ["comment", "story", "dm", "abertura"];

// A CONTA VEM DE `paletaOferece`, E NÃO É REESCRITA AQUI — e a troca tem
// medição. Este arquivo tinha uma `function ofereceria` local, com a fórmula da
// faixa copiada, e o efeito foi medido apagando `&& !salvarRecusaOBloco(...)`
// da paleta: 721 verdes. O teste trancava a propriedade de uma CÓPIA da regra,
// e a tela podia voltar a decidir sozinha sem ninguém ficar sabendo. Agora a
// faixa (`paleta.tsx`) e este arquivo chamam a MESMA função.

describe("a paleta e as regras de publicar", () => {
  it("nada do que a faixa oferece é recusado pelo salvar", () => {
    for (const item of PALETA) {
      for (const gatilho of GATILHOS) {
        if (!paletaOferece(item, gatilho)) continue;
        expect(
          salvarRecusaOBloco(tipoDoItem(item.chave), gatilho),
          `${item.chave} em ${gatilho}`
        ).toBe(false);
      }
    }
  });

  it("a faixa pergunta a REGRA do salvar, e não só a lista à mão", () => {
    // O ITEM SINTÉTICO É O QUE MEDE A SEGUNDA PERGUNTA — e ele não é imitação
    // de nada: é um `ItemDaPaleta` de verdade, entregue à função de verdade.
    //
    // Nos NOVE itens de hoje as duas metades concordam por COINCIDÊNCIA de
    // desenho: `resposta_publica` lista `["comment"]` e `reagir_story` lista
    // `["story"]`, então a lista à mão já recusa sozinha todo par que a regra
    // recusaria. É essa coincidência que faz o caso acima passar mesmo com a
    // pergunta à regra apagada — medido, 721 verdes —, e é ela que este caso
    // tira do caminho.
    //
    // A FORMA DO ITEM É A FORMA DO DEFEITO QUE A FASE TEMIA: um item que a
    // lista à mão oferece em TODO gatilho (`gatilhos: null`, como os sete
    // primeiros da faixa) sobre um tipo que o salvar recusa em alguns. É o que
    // acontece sozinho no dia em que entra um gatilho novo e ninguém volta
    // àquela lista — e a partir daqui isso fica vermelho em vez de virar bloco
    // oferecido e recusado no salvar.
    for (const tipo of ["resposta_publica", "reagir_story"]) {
      const semLista: ItemDaPaleta = {
        chave: tipo,
        rotulo: "item sem lista à mão",
        descricao: "serve em qualquer gatilho, pela lista",
        gatilhos: null,
      };
      for (const gatilho of GATILHOS) {
        expect(paletaOferece(semLista, gatilho), `${tipo} em ${gatilho}`).toBe(
          !salvarRecusaOBloco(tipo, gatilho)
        );
      }
    }
  });

  it("no gatilho `abertura` a faixa apaga exatamente os dois que o salvar nega", () => {
    // Não é o resultado que mudou — é de onde ele vem. As duas asserções abaixo
    // passavam antes desta tarefa, pela lista à mão; agora elas passam pela
    // regra, e continuariam passando se aquela lista fosse apagada.
    const apagados = PALETA.filter((i) => !paletaOferece(i, "abertura")).map((i) => i.chave);
    expect(apagados).toEqual(["resposta_publica", "reagir_story"]);

    expect(salvarRecusaOBloco("resposta_publica", "abertura")).toBe(true);
    expect(salvarRecusaOBloco("reagir_story", "abertura")).toBe(true);
    expect(salvarRecusaOBloco("dm", "abertura")).toBe(false);
    expect(salvarRecusaOBloco("esperar", "abertura")).toBe(false);
    expect(salvarRecusaOBloco("pedir_follow", "abertura")).toBe(false);
    expect(salvarRecusaOBloco("pedir_email", "abertura")).toBe(false);
  });

  it("a regra responde o mesmo que `conferirLista` acende", () => {
    // `salvarRecusaOBloco` saiu de dentro de `conferirLista`, e é ela que as
    // duas linhas de ERRO de lá chamam. Isto mede que a extração não trocou o
    // veredito de nenhum dos dois blocos dependentes de gatilho.
    const casos: [Record<string, unknown>, string][] = [
      [{ id: "b_pub001", tipo: "resposta_publica", textos: ["oi"] }, "resposta_publica"],
      [{ id: "b_cor001", tipo: "reagir_story", emoji: "❤️" }, "reagir_story"],
    ];
    for (const [passo, tipo] of casos) {
      for (const gatilho of GATILHOS) {
        const temErro = conferirLista([passo], gatilho, []).some((p) => p.nivel === "erro");
        expect(temErro, `${tipo} em ${gatilho}`).toBe(salvarRecusaOBloco(tipo, gatilho));
      }
    }
  });

  it("o tipo que a paleta declara é o tipo que `blocoNovo` cria", () => {
    // `tipoDoItem` é uma segunda escrita do `switch` de `blocoNovo` — ela existe
    // porque a faixa se redesenha a cada tecla e não pode gerar identidades só
    // para descobrir um tipo. Item novo cujas duas escritas discordem derruba
    // aqui, em vez de aparecer como bloco apagado sem motivo na faixa.
    for (const item of PALETA) {
      expect(tipoDoItem(item.chave), item.chave).toBe(blocoNovo(item.chave).tipo);
    }
  });
});
