import { describe, it, expect } from "vitest";
import {
  GATILHO_DE_ABERTURA,
  linhasDasPortas,
  opcoesDeAutomacao,
  perguntasDoFormulario,
  resumoDoLimite,
  type AutomacaoConhecida,
} from "@/app/setup/portas";
import { MAXIMO_DE_PERGUNTAS } from "@/lib/perguntas-de-abertura";
import { payloadDaPergunta } from "@/lib/steps";

// O QUE ESTE ARQUIVO PROTEGE é a tela das quatro portas de entrada.
//
// A suíte deste projeto NÃO TESTA COMPONENTE, e isso não vai mudar. Foi medido
// na fase: defeito plantado em três telas, 743 testes verdes. Toda decisão que
// mora no JSX é rede zero — então nenhuma decisão desta tela mora lá, e é este
// arquivo que as segura.

const OK: AutomacaoConhecida = {
  id: "a-viva",
  name: "Turma de setembro",
  active: true,
  triggers: [GATILHO_DE_ABERTURA],
};
const PAUSADA: AutomacaoConhecida = {
  id: "a-pausada",
  name: "Lista de espera",
  active: false,
  triggers: [GATILHO_DE_ABERTURA],
};
const OUTRO_GATILHO: AutomacaoConhecida = {
  id: "a-dm",
  name: "Palavra-chave preço",
  active: true,
  triggers: ["dm"],
};
const TODAS = [OK, PAUSADA, OUTRO_GATILHO];

describe("as quatro posições, na ordem em que o Instagram exibe", () => {
  it("conta vazia mostra as quatro posições livres, e não uma tela vazia", () => {
    const linhas = linhasDasPortas([], TODAS);
    expect(linhas).toHaveLength(MAXIMO_DE_PERGUNTAS);
    expect(linhas.map((l) => l.posicao)).toEqual([1, 2, 3, 4]);
    for (const l of linhas) {
      expect(l.texto).toBe("");
      expect(l.automacaoId).toBeNull();
      expect(l.aviso).toBeNull();
    }
  });

  it("preenche na ordem da Meta e completa o resto com posição livre", () => {
    const linhas = linhasDasPortas(
      [
        { question: "Primeira", payload: payloadDaPergunta(OK.id) },
        { question: "Segunda", payload: payloadDaPergunta(OK.id) },
      ],
      TODAS
    );
    // A ORDEM É O PRODUTO: é ela que a pessoa vê ao abrir a conversa. Ordenar
    // por texto ou por automação continuaria compilando.
    expect(linhas.map((l) => l.texto)).toEqual(["Primeira", "Segunda", "", ""]);
    expect(linhas).toHaveLength(MAXIMO_DE_PERGUNTAS);
  });

  it("conta com mais perguntas que o limite mostra TODAS, sem cortar", () => {
    // Uma conta com perguntas em vários idiomas tem quatro por idioma. Cortar
    // em quatro esconderia perguntas que estão no ar.
    const seis = Array.from({ length: 6 }, (_, i) => ({
      question: `p${i}`,
      payload: payloadDaPergunta(OK.id),
    }));
    expect(linhasDasPortas(seis, TODAS)).toHaveLength(6);
  });
});

describe("qual automação cada pergunta dispara — ou nenhuma", () => {
  it("aponta para automação viva com o gatilho certo: nome e nenhum aviso", () => {
    const [l] = linhasDasPortas([{ question: "Oi", payload: payloadDaPergunta(OK.id) }], TODAS);
    expect(l.automacaoId).toBe(OK.id);
    expect(l.dispara).toBe(OK.name);
    expect(l.aviso).toBeNull();
  });

  // O CASO QUE ESTÁ NO AR HOJE, em três contas de produção: as perguntas de
  // teste usam `abertura-...`, escolhido de propósito para que `lerPayload`
  // devolva null e nada dispare. A tela tem de lidar com elas sem quebrar, e
  // "não aponta para automação nenhuma" é a resposta CERTA — é o que elas
  // fazem. Uma tela que estourasse aqui, ou que as mostrasse como se
  // disparassem algo, seria pior que não existir.
  it("identificador de outro formato aparece como 'não dispara nada'", () => {
    const [l] = linhasDasPortas(
      [{ question: "Quais são os valores?", payload: "abertura-valores" }],
      TODAS
    );
    expect(l.automacaoId).toBeNull();
    expect(l.dispara).toBe("Não dispara nada");
    expect(l.aviso?.grau).toBe("aviso");
    // O TEXTO CRU SOBREVIVE: é ele que o formulário devolve intacto quando o
    // dono salva sem mexer nesta linha.
    expect(l.payload).toBe("abertura-valores");
  });

  it("automação apagada da conta vira erro, porque quem tocar não recebe nada", () => {
    const [l] = linhasDasPortas([{ question: "Oi", payload: payloadDaPergunta("sumiu") }], TODAS);
    expect(l.automacaoId).toBeNull();
    expect(l.dispara).toBe("Não dispara nada");
    expect(l.aviso?.grau).toBe("erro");
  });

  // `loadAutomation` (lib/engine.ts) exige `active = true`: pausada é silêncio
  // do mesmo jeito, e o dono precisa ver a diferença entre as duas causas.
  it("automação pausada mostra o nome e um erro que diz o motivo", () => {
    const [l] = linhasDasPortas([{ question: "Oi", payload: payloadDaPergunta(PAUSADA.id) }], TODAS);
    expect(l.automacaoId).toBe(PAUSADA.id);
    expect(l.dispara).toBe(PAUSADA.name);
    expect(l.aviso?.grau).toBe("erro");
    expect(l.aviso?.texto).toContain("pausada");
  });

  // O motor EXECUTA mesmo com o gatilho trocado, de propósito, e registra
  // `abertura_com_gatilho_trocado`. Marcar isto como erro faria a tela dizer
  // que não funciona uma coisa que funciona.
  it("gatilho trocado é aviso, não erro — ela roda assim mesmo", () => {
    const [l] = linhasDasPortas(
      [{ question: "Oi", payload: payloadDaPergunta(OUTRO_GATILHO.id) }],
      TODAS
    );
    expect(l.automacaoId).toBe(OUTRO_GATILHO.id);
    expect(l.dispara).toBe(OUTRO_GATILHO.name);
    expect(l.aviso?.grau).toBe("aviso");
  });

  it("os quatro problemas se distinguem — não é um sim/não", () => {
    const linhas = linhasDasPortas(
      [
        { question: "a", payload: payloadDaPergunta(OK.id) },
        { question: "b", payload: "abertura-antiga" },
        { question: "c", payload: payloadDaPergunta("sumiu") },
        { question: "d", payload: payloadDaPergunta(PAUSADA.id) },
      ],
      TODAS
    );
    const textos = linhas.map((l) => l.aviso?.texto ?? "sem aviso");
    expect(new Set(textos).size).toBe(4);
  });
});

describe("o limite de quatro é da CONTA, e a tela diz isso antes do erro da Meta", () => {
  it("conta vazia diz quantas posições existem no total", () => {
    const r = resumoDoLimite(0);
    expect(r.livres).toBe(MAXIMO_DE_PERGUNTAS);
    expect(r.cheio).toBe(false);
    expect(r.texto).toContain(String(MAXIMO_DE_PERGUNTAS));
  });

  it("conta o que sobra, no singular quando é uma", () => {
    expect(resumoDoLimite(3).livres).toBe(1);
    expect(resumoDoLimite(3).texto).toContain("1 livre");
    expect(resumoDoLimite(2).texto).toContain("2 livres");
  });

  it("cheia diz que não cabe mais nenhuma", () => {
    const r = resumoDoLimite(MAXIMO_DE_PERGUNTAS);
    expect(r.cheio).toBe(true);
    expect(r.livres).toBe(0);
    expect(r.acima).toBe(false);
  });

  it("acima do limite não afirma '0 livres', diz que está sobrando", () => {
    const r = resumoDoLimite(MAXIMO_DE_PERGUNTAS + 2);
    expect(r.acima).toBe(true);
    expect(r.cheio).toBe(false);
    expect(r.texto).toContain("acima do limite");
  });

  it("o número sai da constante, e não digitado no texto", () => {
    expect(resumoDoLimite(0).maximo).toBe(MAXIMO_DE_PERGUNTAS);
  });
});

describe("do formulário para a Meta", () => {
  const linha = (texto: string, automacaoId = "", payload = "") => ({ texto, automacaoId, payload });

  it("escolher automação escreve o identificador de verdade", () => {
    const { perguntas } = perguntasDoFormulario([linha("Quero saber mais", OK.id)]);
    expect(perguntas).toEqual([
      { question: "Quero saber mais", payload: payloadDaPergunta(OK.id) },
    ]);
  });

  it("linha em branco some, e é assim que se tira uma pergunta do ar", () => {
    const { perguntas } = perguntasDoFormulario([
      linha("Fica", OK.id),
      linha("   ", "", "abertura-antiga"),
      linha("", ""),
    ]);
    expect(perguntas).toEqual([{ question: "Fica", payload: payloadDaPergunta(OK.id) }]);
  });

  // A LINHA QUE PROTEGE PRODUÇÃO. Três contas têm perguntas `abertura-...` no
  // ar. Salvar a tela para mexer na posição 4 NÃO PODE reescrever nem apagar as
  // outras três — sem herdar o identificador, `payload` sairia vazio e a
  // gravação recusaria (ou, pior, escreveria uma pergunta sem destino).
  it("quem não escolheu automação fica com o identificador que já estava lá", () => {
    const { perguntas, motivo } = perguntasDoFormulario([
      linha("Quais são os valores?", "", "abertura-valores"),
      linha("Nova", OK.id),
    ]);
    expect(motivo).toBeUndefined();
    expect(perguntas).toEqual([
      { question: "Quais são os valores?", payload: "abertura-valores" },
      { question: "Nova", payload: payloadDaPergunta(OK.id) },
    ]);
  });

  it("escolher automação numa linha antiga TROCA o identificador antigo", () => {
    const { perguntas } = perguntasDoFormulario([
      linha("Quais são os valores?", OK.id, "abertura-valores"),
    ]);
    expect(perguntas).toEqual([
      { question: "Quais são os valores?", payload: payloadDaPergunta(OK.id) },
    ]);
  });

  it("texto sem identificador nenhum é recusado, e o recado nomeia a pergunta", () => {
    const { perguntas, motivo } = perguntasDoFormulario([linha("Pergunta solta")]);
    expect(perguntas).toBeUndefined();
    expect(motivo).toContain("Pergunta solta");
  });

  it("automação escolhida sem texto é recusada, e o recado diz a posição", () => {
    const { motivo } = perguntasDoFormulario([linha("Primeira", OK.id), linha("", OK.id)]);
    expect(motivo).toContain("posição 2");
  });

  it("apara o texto antes de mandar para a Meta", () => {
    const { perguntas } = perguntasDoFormulario([linha("  Oi  ", OK.id)]);
    expect(perguntas?.[0].question).toBe("Oi");
  });

  it("tudo em branco devolve lista vazia — que é o pedido de apagar", () => {
    expect(perguntasDoFormulario([linha(""), linha(""), linha(""), linha("")]).perguntas).toEqual([]);
  });
});

describe("o seletor oferece todas as automações, e marca as que divergem", () => {
  // Oferecer só as de gatilho `abertura` é a armadilha: o motor não confere
  // gatilho ao entrar por identificador, então uma automação de outro gatilho
  // apontada por engano continuaria disparando — e não estaria na lista para o
  // dono desapontar.
  it("nenhuma automação da conta fica de fora", () => {
    expect(opcoesDeAutomacao(TODAS).map((o) => o.id)).toEqual(TODAS.map((a) => a.id));
  });

  it("a pausada e a de outro gatilho vêm marcadas no rótulo", () => {
    const rotulos = new Map(opcoesDeAutomacao(TODAS).map((o) => [o.id, o.rotulo]));
    expect(rotulos.get(OK.id)).toBe(OK.name);
    expect(rotulos.get(PAUSADA.id)).toContain("pausada");
    expect(rotulos.get(OUTRO_GATILHO.id)).toContain("gatilho");
  });
});
