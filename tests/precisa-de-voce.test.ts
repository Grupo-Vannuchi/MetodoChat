import { describe, it, expect } from "vitest";
import {
  oQuePrecisaDeVoce,
  HORAS_QUE_TORNAM_URGENTE,
  MAX_CONVERSAS_NO_INICIO,
  type FatosDoInicio,
} from "../lib/precisa-de-voce";
import { WINDOW_MS, WINDOW_MARGIN_MS } from "../lib/inbox-window";

// O QUE ESTE ARQUIVO FIXA: a decisão da tela inicial, que a spec da linguagem
// visual define como a resposta a UMA pergunta — "precisa de mim?" — e que
// **quer ficar vazia**. O vazio é a resposta, e não um espaço a preencher.
//
// POR QUE A DECISÃO SAI DO JSX: a suíte não testa componente. Uma tela que
// escolhe sozinha o que mostrar e em que ordem é uma tela cuja ordem ninguém
// mede — e ordem, aqui, é a diferença entre ver a tempo e ver depois.

const H = 3_600_000;

/** A janela de quem falou faz `horas` horas — a conta é a do produto, e não uma
 *  segunda régua escrita neste arquivo. */
const restam = (horas: number) => WINDOW_MS - WINDOW_MARGIN_MS - horas * H;

const NADA: FatosDoInicio = {
  esperando: [],
  falhasPublicacao: 0,
  falhasMensagem: 0,
  automacoesAtivas: 3,
};

const quem = (nome: string, horasDesdeQueFalou: number) => ({
  igId: "ig_" + nome,
  quem: nome,
  msLeft: restam(horasDesdeQueFalou),
});

describe("o vazio é a resposta", () => {
  it("com tudo em ordem, a tela inicial não tem NADA a mostrar", () => {
    expect(oQuePrecisaDeVoce(NADA)).toEqual([]);
  });

  // "NENHUMA AUTOMAÇÃO" É CONVITE, E NÃO PENDÊNCIA. Ele fica por último sempre,
  // porque uma conta recém-conectada precisa do empurrão e uma conta com um
  // post falhado precisa do post — o convite acima da falha seria ruído.
  it("conta sem automação nenhuma recebe o convite", () => {
    const r = oQuePrecisaDeVoce({ ...NADA, automacoesAtivas: 0 });
    expect(r).toHaveLength(1);
    expect(r[0].chave).toBe("sem-automacao");
    expect(r[0].urgencia).toBe("quieto");
  });
});

describe("a ordem, que é a decisão inteira", () => {
  // A REGRA: vem primeiro o que DESAPARECE se ninguém agir na próxima hora. Só
  // a janela de 24h faz isso — depois que ela fecha, a Meta recusa a resposta e
  // não há como reabrir. Uma publicação que falhou às 3h da manhã continua
  // falhada às 9h; ela é grave, e não é urgente no mesmo sentido.
  it("a janela que fecha em minutos vem antes da publicação que falhou", () => {
    const r = oQuePrecisaDeVoce({
      ...NADA,
      esperando: [quem("marcio", 22.5)], // restam 1h25
      falhasPublicacao: 1,
    });
    expect(r.map((i) => i.chave)).toEqual(["conversa:ig_marcio", "falha-publicacao"]);
  });

  // E O INVERSO, que é o que prova que a regra é sobre PRAZO e não sobre tipo:
  // a mesma conversa, com o dia inteiro pela frente, vai para depois.
  it("a janela com o dia inteiro pela frente vem DEPOIS da publicação", () => {
    const r = oQuePrecisaDeVoce({
      ...NADA,
      esperando: [quem("marcio", 2)], // restam quase 22h
      falhasPublicacao: 1,
    });
    expect(r.map((i) => i.chave)).toEqual(["falha-publicacao", "conversa:ig_marcio"]);
  });

  it("entre duas conversas, quem fecha primeiro aparece primeiro", () => {
    const r = oQuePrecisaDeVoce({
      ...NADA,
      esperando: [quem("calma", 4), quem("apertada", 23), quem("media", 21.5)],
    });
    expect(r.map((i) => i.chave)).toEqual([
      "conversa:ig_apertada",
      "conversa:ig_media",
      "conversa:ig_calma",
    ]);
  });

  it("publicação vem antes de mensagem — uma já é pública, a outra não", () => {
    const r = oQuePrecisaDeVoce({ ...NADA, falhasPublicacao: 1, falhasMensagem: 2 });
    expect(r.map((i) => i.chave)).toEqual(["falha-publicacao", "falha-mensagem"]);
  });

  it("o convite fica por último, mesmo com tudo mais pendente", () => {
    const r = oQuePrecisaDeVoce({
      esperando: [quem("alguem", 23)],
      falhasPublicacao: 1,
      falhasMensagem: 1,
      automacoesAtivas: 0,
    });
    expect(r[r.length - 1].chave).toBe("sem-automacao");
  });
});

describe("a janela fechada não é pendência", () => {
  // DEPOIS DE FECHADA NÃO HÁ O QUE FAZER, e listar o que não tem ação é o
  // oposto do que esta tela existe para ser. A pessoa continua na lista de
  // conversas; ela só não é mais um chamado.
  it("conversa com a janela já fechada some da tela inicial", () => {
    const r = oQuePrecisaDeVoce({ ...NADA, esperando: [{ igId: "x", quem: "tarde", msLeft: 0 }] });
    expect(r).toEqual([]);
  });

  it("msLeft negativo também some — a fonte pode devolver o passado", () => {
    const r = oQuePrecisaDeVoce({ ...NADA, esperando: [{ igId: "x", quem: "t", msLeft: -5000 }] });
    expect(r).toEqual([]);
  });
});

describe("a urgência de cada linha", () => {
  it("abaixo do corte a conversa é `fecha`", () => {
    const r = oQuePrecisaDeVoce({ ...NADA, esperando: [quem("x", 22)] });
    expect(HORAS_QUE_TORNAM_URGENTE).toBeGreaterThan(0);
    expect(r[0].urgencia).toBe("fecha");
  });

  it("acima do corte ela é `aberto` — há tempo, e a cor diz isso", () => {
    const r = oQuePrecisaDeVoce({ ...NADA, esperando: [quem("x", 2)] });
    expect(r[0].urgencia).toBe("aberto");
  });

  it("falha é sempre `parou`, nos dois tipos", () => {
    const r = oQuePrecisaDeVoce({ ...NADA, falhasPublicacao: 1, falhasMensagem: 1 });
    expect(r.map((i) => i.urgencia)).toEqual(["parou", "parou"]);
  });
});

describe("a lista não vira a tela de conversas", () => {
  const muitas = Array.from({ length: MAX_CONVERSAS_NO_INICIO + 4 }, (_, i) =>
    quem("p" + i, 23 - i * 0.1)
  );

  it("mostra no máximo o limite de conversas", () => {
    const r = oQuePrecisaDeVoce({ ...NADA, esperando: muitas });
    expect(r.filter((i) => i.tipo === "conversa")).toHaveLength(MAX_CONVERSAS_NO_INICIO);
  });

  it("e diz quantas ficaram de fora, em vez de escondê-las", () => {
    const r = oQuePrecisaDeVoce({ ...NADA, esperando: muitas });
    const resto = r.find((i) => i.chave === "mais-conversas");
    expect(resto, "a linha do resto tem de existir").toBeDefined();
    // O NÚMERO VAI NO TÍTULO, que é a parte que se lê de relance: é ele que
    // impede a tela de dizer "cinco esperam" quando são nove.
    expect(resto!.titulo).toContain("4");
    expect(resto!.href).toBe("/conversas");
  });

  it("com exatamente o limite, não há linha de resto", () => {
    const r = oQuePrecisaDeVoce({ ...NADA, esperando: muitas.slice(0, MAX_CONVERSAS_NO_INICIO) });
    expect(r.find((i) => i.chave === "mais-conversas")).toBeUndefined();
  });

  // O CORTE É DAS MAIS APERTADAS, e não das primeiras que chegaram: a lista
  // entra em qualquer ordem, e quem sobra tem de ser quem fecha antes.
  it("quem fica são as que fecham primeiro, mesmo com a entrada bagunçada", () => {
    const embaralhadas = [quem("folgada", 1), quem("apertada", 23), quem("media", 12)];
    const r = oQuePrecisaDeVoce({ ...NADA, esperando: embaralhadas });
    expect(r.map((i) => i.chave)).toEqual([
      "conversa:ig_apertada",
      "conversa:ig_media",
      "conversa:ig_folgada",
    ]);
  });
});

describe("as frases, que são a tela", () => {
  it("o singular e o plural saem inteiros nas duas falhas", () => {
    const uma = oQuePrecisaDeVoce({ ...NADA, falhasPublicacao: 1, falhasMensagem: 1 });
    expect(uma[0].titulo).not.toContain("publicações");
    expect(uma[1].titulo).not.toContain("mensagens");
    const varias = oQuePrecisaDeVoce({ ...NADA, falhasPublicacao: 3, falhasMensagem: 2 });
    expect(varias[0].titulo).toContain("publicações");
    expect(varias[1].titulo).toContain("mensagens");
  });

  // CADA LINHA LEVA A ALGUM LUGAR. Uma pendência sem destino é uma reclamação.
  it("toda linha tem destino, e o destino é a tela que resolve", () => {
    const r = oQuePrecisaDeVoce({
      esperando: [quem("marcio", 23)],
      falhasPublicacao: 1,
      falhasMensagem: 1,
      automacoesAtivas: 0,
    });
    const destinos = Object.fromEntries(r.map((i) => [i.chave, i.href]));
    expect(destinos["conversa:ig_marcio"]).toBe("/conversas/ig_marcio");
    expect(destinos["falha-publicacao"]).toBe("/publicar/agendados");
    expect(destinos["falha-mensagem"]).toBe("/eventos");
    expect(destinos["sem-automacao"]).toBe("/automacoes/nova");
  });

  // O id vem do banco e vira caminho de URL. Um id com barra inventaria um
  // segmento de rota; o mesmo cuidado que `urlDaConversaComAviso` já toma.
  it("o id da conversa vai codificado no caminho", () => {
    const r = oQuePrecisaDeVoce({
      ...NADA,
      esperando: [{ igId: "a/b?c", quem: "x", msLeft: restam(23) }],
    });
    expect(r[0].href).toBe("/conversas/a%2Fb%3Fc");
  });

  // QUEM NÃO TEM @ AINDA APARECE. O username pode ser nulo (contato que só
  // comentou, perfil privado): a linha não pode virar "@null" nem sumir, porque
  // a janela dessa pessoa fecha igual.
  it("conversa sem nome não vira `@null` nem some", () => {
    const r = oQuePrecisaDeVoce({
      ...NADA,
      esperando: [{ igId: "ig_x", quem: null, msLeft: restam(23) }],
    });
    expect(r).toHaveLength(1);
    expect(r[0].titulo.toLowerCase()).not.toContain("null");
    expect(r[0].titulo.length).toBeGreaterThan(0);
  });
});
