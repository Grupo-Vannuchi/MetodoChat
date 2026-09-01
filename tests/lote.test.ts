import { describe, it, expect } from "vitest";
import {
  destinoDoLote,
  lerPayloadDoLote,
  loteExpirou,
  payloadDoLote,
} from "@/lib/lote";

// ============================================================
// QUEM RECEBE AGORA E QUEM ESPERA — a decisão mais perigosa deste projeto.
//
// Este é o primeiro recurso do produto que manda mensagem para muita gente de
// uma vez. Um erro aqui não é uma mensagem errada, são quarenta, saindo do
// perfil de verdade para clientes de verdade.
//
// Medido em produção (01/09/2026): 126 contatos, 9 alcançáveis — 7,1%.
// ============================================================
const AGORA = new Date("2026-09-01T12:00:00Z").getTime();
const HORAS = (h: number) => new Date(AGORA - h * 3_600_000);

describe("destinoDoLote", () => {
  it("separa quem está na janela de quem vai esperar", () => {
    const d = destinoDoLote(
      [
        { ig_id: "a", last_reply_at: HORAS(1), recebidas: 5 },
        { ig_id: "b", last_reply_at: HORAS(30), recebidas: 5 },
        { ig_id: "c", last_reply_at: null, recebidas: 0 },
      ],
      AGORA
    );
    expect(d.agora).toEqual(["a"]);
    expect(d.esperam).toEqual(["b", "c"]);
  });

  // A MESMA MARGEM DO MOTOR. `windowState` fecha 5 minutos antes das 24h, e
  // `lib/queue-drain.ts` usa exatamente essa função para RECUSAR um envio. Uma
  // regra própria aqui faria a tela prometer alcance que o motor recusa.
  it("quem está nos últimos 5 minutos da janela ESPERA, não recebe agora", () => {
    const d = destinoDoLote(
      [{ ig_id: "a", last_reply_at: new Date(AGORA - (24 * 60 - 2) * 60_000), recebidas: 3 }],
      AGORA
    );
    expect(d.agora).toEqual([]);
    expect(d.esperam).toEqual(["a"]);
  });

  // O TERCEIRO NÚMERO É PALPITE, E A FUNÇÃO NÃO PODE FINGIR O CONTRÁRIO.
  // Medido: 48 de 120 pessoas falaram uma única vez na vida. Elas contam como
  // "provavelmente nunca" — mas continuam DENTRO de `esperam`, porque podem
  // voltar amanhã. O número é informativo, e não um terceiro balde.
  it("os improváveis são um subconjunto de quem espera, e não um balde à parte", () => {
    const d = destinoDoLote(
      [
        { ig_id: "a", last_reply_at: HORAS(30), recebidas: 1 },
        { ig_id: "b", last_reply_at: HORAS(30), recebidas: 9 },
      ],
      AGORA
    );
    expect(d.esperam).toEqual(["a", "b"]);
    expect(d.improvaveis).toBe(1);
    expect(d.agora.length + d.esperam.length).toBe(2);
  });

  it("quem recebe agora nunca conta como improvável, mesmo tendo falado uma vez", () => {
    const d = destinoDoLote([{ ig_id: "a", last_reply_at: HORAS(1), recebidas: 1 }], AGORA);
    expect(d.agora).toEqual(["a"]);
    expect(d.improvaveis).toBe(0);
  });

  it("lista vazia não estoura e não inventa ninguém", () => {
    expect(destinoDoLote([], AGORA)).toEqual({ agora: [], esperam: [], improvaveis: 0 });
  });
});

describe("loteExpirou", () => {
  it("sem prazo nunca expira", () => {
    expect(loteExpirou(null, AGORA)).toBe(false);
  });

  it("antes da data, vale; depois, não", () => {
    expect(loteExpirou("2026-09-02T12:00:00.000Z", AGORA)).toBe(false);
    expect(loteExpirou("2026-08-31T12:00:00.000Z", AGORA)).toBe(true);
  });

  // O CASO DA BORDA, e ele importa: a validade é o último instante em que a
  // mensagem ainda faz sentido. Expirar exatamente nela cancelaria um envio que
  // o dono considera válido.
  it("no instante exato da validade, ainda vale", () => {
    expect(loteExpirou(new Date(AGORA).toISOString(), AGORA)).toBe(false);
  });

  it("data inválida NÃO expira o lote, e isso é escolha", () => {
    // Tratar lixo como "expirado" cancelaria envios em silêncio. Tratar como
    // "sem prazo" mantém a mensagem viva, e o dono vê que ela não venceu.
    expect(loteExpirou("nao e uma data", AGORA)).toBe(false);
    expect(loteExpirou("", AGORA)).toBe(false);
  });
});

// ============================================================
// A COSTURA DO PAYLOAD, e ela mora aqui pelo mesmo motivo das portas de entrada:
// quem escreve e quem lê estão em arquivos diferentes, ligados por STRING. Um
// `s` a mais de um lado não é erro de tipo nem de lint — é um campo que volta
// vazio, e neste caso seria uma mensagem em branco para quarenta pessoas.
// ============================================================
describe("payloadDoLote e lerPayloadDoLote", () => {
  it("o que escreve, lê de volta igual", () => {
    const p = payloadDoLote({
      loteId: "L1",
      text: "A turma abre segunda",
      url: "https://exemplo.invalid/turma",
      buttonLabel: "Quero entrar",
      validoAte: "2026-09-10T00:00:00.000Z",
    });
    expect(lerPayloadDoLote(p)).toEqual({
      loteId: "L1",
      text: "A turma abre segunda",
      url: "https://exemplo.invalid/turma",
      buttonLabel: "Quero entrar",
      validoAte: "2026-09-10T00:00:00.000Z",
    });
  });

  it("sem link e sem prazo também volta igual", () => {
    const p = payloadDoLote({ loteId: "L2", text: "Segue o material", validoAte: null });
    const lido = lerPayloadDoLote(p);
    expect(lido?.text).toBe("Segue o material");
    expect(lido?.url).toBeUndefined();
    expect(lido?.validoAte).toBe(null);
  });

  // O DRENO LÊ `p.url` PARA DECIDIR O FORMATO DA MENSAGEM (lib/queue-drain.ts):
  // com url ele monta mensagem com botão; sem url, texto puro. Gravar a chave
  // com url vazia faria toda mensagem de lote virar botão para lugar nenhum.
  it("url em branco não vira chave `url` no payload", () => {
    const p = payloadDoLote({ loteId: "L3", text: "oi", url: "   ", validoAte: null });
    expect("url" in p).toBe(false);
  });

  it("payload que não é do lote devolve null em vez de meia informação", () => {
    expect(lerPayloadDoLote(null)).toBe(null);
    expect(lerPayloadDoLote({})).toBe(null);
    expect(lerPayloadDoLote({ text: "sem lote_id" })).toBe(null);
    expect(lerPayloadDoLote("texto")).toBe(null);
  });
});
