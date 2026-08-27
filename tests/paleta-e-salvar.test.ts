import { describe, it, expect } from "vitest";
import { conferirLista, salvarRecusaOBloco } from "../lib/steps";
import {
  PALETA,
  blocoNovo,
  itensDaFaixa,
  motivoDeEstarFora,
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

// A quebra que separa a legenda do motivo dentro do `title`.
const BARRA_N = "\n";

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

  it("os níveis que `conferirLista` acende nos dois blocos, gatilho a gatilho", () => {
    // ESTE CASO ERA UMA TAUTOLOGIA, e a revisão a mediu. Ele comparava
    // `conferirLista(...).some(erro)` com `salvarRecusaOBloco(...)` DEPOIS de a
    // segunda ter saído de dentro da primeira: hoje `conferirLista` delega a
    // ela, então as duas não podem discordar. Confirmado plantando defeitos:
    // este caso nunca ficava vermelho — quem acusava eram os casos antigos de
    // `tests/steps.test.ts`. Ele media que a extração foi feita, não que ela
    // está certa.
    //
    // O QUE ELE MEDE AGORA É A TABELA, escrita por extenso, e nela está a
    // linha que sustenta duas frases da tela: em `dm` o coraçãozinho é AVISO, e
    // não erro — ele RODA ali, reagindo à mensagem que a pessoa mandou. É por
    // isso que o `title` da faixa não diz "só roda em story" naquele gatilho e
    // que a dica do painel fala em OFERECER. No dia em que esta linha virar
    // erro, as duas frases passam a mentir, e é aqui que isso aparece.
    const CORACAO = { id: "b_cor001", tipo: "reagir_story", emoji: "❤️" };
    const PUBLICA = { id: "b_pub001", tipo: "resposta_publica", textos: ["oi"] };
    const niveis = (passo: Record<string, unknown>, gatilho: string): string[] =>
      conferirLista([passo], gatilho, [])
        .map((p) => p.nivel)
        .sort();

    expect(niveis(CORACAO, "story"), "coração em story").toEqual([]);
    expect(niveis(CORACAO, "dm"), "coração em dm").toEqual(["aviso"]);
    expect(niveis(CORACAO, "comment"), "coração em comment").toEqual(["erro"]);
    expect(niveis(CORACAO, "abertura"), "coração em abertura").toEqual(["erro"]);

    expect(niveis(PUBLICA, "comment"), "pública em comment").toEqual([]);
    expect(niveis(PUBLICA, "dm"), "pública em dm").toEqual(["erro"]);
    expect(niveis(PUBLICA, "story"), "pública em story").toEqual(["erro"]);
    expect(niveis(PUBLICA, "abertura"), "pública em abertura").toEqual(["erro"]);
  });


  // -------------------------------------------------------------------------
  // A FAIXA JÁ DECIDIDA, e não só a regra que ela deveria perguntar.
  //
  // `paletaOferece` estava trancada, mas quem a CHAMAVA era o JSX, e o JSX é
  // rede zero: a revisão trocou a chamada pela lista à mão em linha e a suíte
  // deu 722 verdes. `itensDaFaixa` é a lista inteira decidida deste lado, e é
  // ela que `paleta.tsx` mapeia — sem importar `PALETA`.
  // -------------------------------------------------------------------------

  it("`itensDaFaixa` devolve a faixa inteira, na ordem, com `serve` pela regra", () => {
    for (const gatilho of GATILHOS) {
      const faixa = itensDaFaixa(gatilho);
      // INTEIRA e NA ORDEM: item que não serve continua vindo, apagado. Sumir
      // com ele é o desenho que a faixa deixou de ter de propósito.
      expect(
        faixa.map((f) => f.item.chave),
        gatilho
      ).toEqual(PALETA.map((i) => i.chave));
      for (const f of faixa) {
        expect(f.serve, `${f.item.chave} em ${gatilho}`).toBe(paletaOferece(f.item, gatilho));
      }
    }
  });

  it("o `titulo` leva sempre nome e descrição, e o motivo numa segunda linha", () => {
    // A composição também é decisão, e ela morava no JSX: o motivo ACRESCENTA
    // linha em vez de substituir o nome — saber que aquele desenho é o
    // coraçãozinho continua valendo quando ele não serve para este gatilho.
    for (const gatilho of GATILHOS) {
      for (const { item, serve, titulo } of itensDaFaixa(gatilho)) {
        const legenda = `${item.rotulo} — ${item.descricao}`;
        const linhas = titulo.split("\n");
        expect(linhas[0], `${item.chave} em ${gatilho}`).toBe(legenda);
        if (serve) {
          expect(linhas, `${item.chave} em ${gatilho} serve`).toHaveLength(1);
        } else {
          expect(linhas, `${item.chave} em ${gatilho} fora`).toHaveLength(2);
          expect(linhas[1]).toBe(motivoDeEstarFora(item, gatilho));
        }
      }
    }
  });

  it("as TRÊS frases do motivo, e a de `dm` não diz que o coraçãozinho não roda", () => {
    // ESTA É A TABELA QUE FALTAVA. A frase única dizia "Este bloco só roda no
    // gatilho de X" para todo item apagado, e em `dm` isso é FALSO sobre o
    // coraçãozinho: ali `conferirLista` só AVISA, o salvar aceita, o painel
    // documenta o bloco rodando e a prévia o desenha rodando. Quem apagou o
    // item naquele gatilho foi a LISTA À MÃO, não a regra — e é outra frase.
    const coracao = PALETA.find((i) => i.chave === "reagir_story")!;
    const publica = PALETA.find((i) => i.chave === "resposta_publica")!;

    // 1 · SÓ A LISTA À MÃO. Fala de OFERECER, e não de executar.
    expect(motivoDeEstarFora(coracao, "dm")).toBe(
      "A faixa oferece este bloco só no gatilho de resposta de story. Numa automação disparada por mensagem direta o salvar aceita quem já o tem, e o painel diz o que ele faz."
    );
    expect(salvarRecusaOBloco("reagir_story", "dm"), "o salvar aceita em dm").toBe(false);

    // 2 · O SALVAR RECUSA. Aqui a frase de sempre está certa: o bloco não roda.
    expect(motivoDeEstarFora(coracao, "comment")).toBe(
      "Este bloco só roda no gatilho de resposta de story, e esta automação é disparada por comentário."
    );
    expect(motivoDeEstarFora(coracao, "abertura")).toBe(
      "Este bloco só roda no gatilho de resposta de story, e esta automação é disparada por pergunta de abertura."
    );
    expect(motivoDeEstarFora(publica, "abertura")).toBe(
      "Este bloco só roda no gatilho de comentário, e esta automação é disparada por pergunta de abertura."
    );

    // 3 · SEM LISTA À MÃO — quem apagou foi a regra, e não há lista a citar.
    // Nenhum item real cai aqui hoje; é a forma exata do defeito da fase (item
    // que a lista oferece em todo gatilho sobre um tipo que o salvar recusa), e
    // a frase precisa existir antes de o dia chegar.
    const semLista: ItemDaPaleta = {
      chave: "reagir_story",
      rotulo: "item sem lista à mão",
      descricao: "serve em qualquer gatilho, pela lista",
      gatilhos: null,
    };
    expect(motivoDeEstarFora(semLista, "comment")).toBe(
      "O salvar recusa este bloco numa automação disparada por comentário."
    );
    // E ele APARECE APAGADO na faixa, com essa frase — as duas metades ligadas.
    expect(itensDaFaixa("comment").every((f) => f.serve || f.titulo.includes(BARRA_N))).toBe(true);
  });

  it("gatilho que a tabela de nomes não conhece entra na frase pelo nome cru", () => {
    // O `??` do nome existe para o motivo não sumir num gatilho novo: melhor a
    // chave crua do que um item apagado sem explicação nenhuma.
    const publica = PALETA.find((i) => i.chave === "resposta_publica")!;
    expect(motivoDeEstarFora(publica, "gatilho_novo")).toBe(
      "Este bloco só roda no gatilho de comentário, e esta automação é disparada por gatilho_novo."
    );
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
