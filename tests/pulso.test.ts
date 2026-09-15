import { describe, it, expect } from "vitest";
import { fraseDoPulso, fraseDas24h } from "../lib/pulso";

// O QUE ESTE ARQUIVO FIXA: o pulso conta FATO COM CARIMBO DE HORA, e nunca
// contagem parada. "21 automações ativas" continuaria 21 com tudo quebrado —
// foi exatamente o que aconteceu entre 08/09 e 14/09/2026, seis dias sem um
// disparo, com o painel anunciando 21 ativas e fila zero.

describe("fraseDoPulso", () => {
  const TRES_DIAS = new Date(Date.now() - 3 * 24 * 3_600_000);

  it("sem entrega hoje, DIZ que não houve — e não escreve zero", () => {
    // "0 entregues hoje" faz o olho ler um número e seguir. "nada entregue
    // hoje" faz ler uma frase. É a mesma informação e não é a mesma leitura.
    expect(fraseDoPulso({ entreguesHoje: 0, ultimaEntrega: TRES_DIAS, naFila: 0 })).toBe(
      "nada entregue hoje · última há 3 dias · fila vazia"
    );
  });

  it("com entrega, conta e diz quando foi a última", () => {
    const agoraMesmo = new Date(Date.now() - 12 * 60_000);
    expect(fraseDoPulso({ entreguesHoje: 4, ultimaEntrega: agoraMesmo, naFila: 0 })).toBe(
      "4 entregues hoje · última há 12 min · fila vazia"
    );
  });

  it("uma entrega só fala no singular", () => {
    const agoraMesmo = new Date(Date.now() - 12 * 60_000);
    expect(fraseDoPulso({ entreguesHoje: 1, ultimaEntrega: agoraMesmo, naFila: 0 })).toBe(
      "1 entregue hoje · última há 12 min · fila vazia"
    );
  });

  it("conta a fila quando há fila, no singular e no plural", () => {
    const d = new Date(Date.now() - 12 * 60_000);
    expect(fraseDoPulso({ entreguesHoje: 2, ultimaEntrega: d, naFila: 1 })).toContain(
      "1 na fila"
    );
    expect(fraseDoPulso({ entreguesHoje: 2, ultimaEntrega: d, naFila: 7 })).toContain(
      "7 na fila"
    );
  });

  it("conta nova, sem entrega nenhuma: não inventa uma última que não houve", () => {
    expect(fraseDoPulso({ entreguesHoje: 0, ultimaEntrega: null, naFila: 0 })).toBe(
      "nada entregue hoje · nenhuma entrega ainda · fila vazia"
    );
  });
});

describe("fraseDas24h", () => {
  it("junta os três números", () => {
    expect(fraseDas24h({ comentarios: 22, mensagens: 13, enviadas: 3 })).toBe(
      "22 comentários · 13 mensagens · 3 respostas enviadas"
    );
  });

  it("cada número tem singular", () => {
    expect(fraseDas24h({ comentarios: 1, mensagens: 1, enviadas: 1 })).toBe(
      "1 comentário · 1 mensagem · 1 resposta enviada"
    );
  });

  it("dia parado diz que ninguém apareceu, em vez de três zeros", () => {
    expect(fraseDas24h({ comentarios: 0, mensagens: 0, enviadas: 0 })).toBe(
      "nada aconteceu nas últimas 24h"
    );
  });

  it("zero em UM dos três não apaga os outros", () => {
    // O caso que separa "dia parado" de "parte parada": com 22 comentários e
    // nenhuma resposta, a frase TEM de dizer as duas coisas — é o retrato da
    // semana de 08/09 a 14/09, e some se o zero for tratado como ausência.
    expect(fraseDas24h({ comentarios: 22, mensagens: 0, enviadas: 0 })).toBe(
      "22 comentários · nenhuma mensagem · nenhuma resposta enviada"
    );
  });

  it("zero nos COMENTÁRIOS não apaga o resto — o ramo que faltava", () => {
    // Este caso nasceu de uma mutação que SOBREVIVEU: trocar o literal "nenhum
    // comentário" por lixo deixava os nove casos verdes. O caso vizinho ("zero
    // em UM dos três") zera `mensagens` e `enviadas` e cobre os dois ramos
    // deles — e deixava o de `comentarios` sem rede nenhuma.
    //
    // A CONCORDÂNCIA É O QUE ELE GUARDA: "nenhum comentário" é masculino e
    // "nenhuma mensagem" é feminino. Um copiar-e-colar entre os dois ramos
    // passaria por tipo, por lint e pela suite inteira.
    expect(fraseDas24h({ comentarios: 0, mensagens: 5, enviadas: 2 })).toBe(
      "nenhum comentário · 5 mensagens · 2 respostas enviadas"
    );
  });
});
