import { describe, it, expect } from "vitest";
import {
  JANELA_DAS_FOTOS,
  MARGEM_DA_FOTO_MS,
  RENOVACOES_POR_CONTA,
  escolherParaRenovar,
  fotoDepoisDaFalha,
  fotoDepoisDaResposta,
  venceEm,
} from "@/lib/fotos-dos-contatos";
import { IgError, IgTimeoutError } from "@/lib/ig";

// O RELÓGIO É FIXO. A fronteira das 25 h é medida em milissegundos, e um `Date.now()` aqui faria o caso
// de 24 h 59 min virar 25 h 01 min numa máquina lenta.
const AGORA = Date.UTC(2026, 10, 3, 9, 30, 0);
const H = 3_600_000;

// A URL do CDN do Instagram traz o vencimento em `oe`, em hexadecimal de segundos unix. O host e os outros
// parâmetros são inventados: só o `oe` importa.
function fotoQueVence(ms: number, oe = Math.floor(ms / 1000).toString(16)): string {
  return `https://cdn-de-teste.invalid/v/foto.jpg?stp=dst-jpg&oh=00_abc&oe=${oe}&_nc_sid=1`;
}

describe("a data de vencimento da foto", () => {
  it("lê o `oe` em hexadecimal de segundos, em minúsculas ou maiúsculas", () => {
    const vence = AGORA + 4 * 24 * H;
    expect(venceEm(fotoQueVence(vence))).toBe(Math.floor(vence / 1000) * 1000);
    expect(venceEm(fotoQueVence(vence, Math.floor(vence / 1000).toString(16).toUpperCase()))).toBe(
      Math.floor(vence / 1000) * 1000
    );
  });

  it("não inventa data: sem `oe`, `oe` que não é hex, URL inválida ou nula dão null", () => {
    expect(venceEm("https://cdn-de-teste.invalid/v/foto.jpg?oh=00_abc")).toBeNull();
    expect(venceEm("https://cdn-de-teste.invalid/v/foto.jpg?oe=6730zz12")).toBeNull();
    expect(venceEm("https://cdn-de-teste.invalid/v/foto.jpg?oe=")).toBeNull();
    expect(venceEm("isto não é uma url")).toBeNull();
    expect(venceEm(null)).toBeNull();
  });
});

describe("os números da regra", () => {
  it("são os combinados: 25 h de margem, 20 por conta e uma janela de 500", () => {
    // 25 h é o maior intervalo entre duas passagens do cron: o `vercel.json` marca "0 9 * * *", e o
    // Hobby roda em qualquer minuto da hora 9. Mudar um destes números é mudar a decisão do Eduardo.
    expect(MARGEM_DA_FOTO_MS).toBe(25 * H);
    expect(RENOVACOES_POR_CONTA).toBe(20);
    expect(JANELA_DAS_FOTOS).toBe(500);
  });
});

describe("quem é renovado", () => {
  const contato = (ig_id: string, profile_pic: string | null) => ({ ig_id, profile_pic });

  it("pega a vencida, a sem data e a que vence dentro da margem, e deixa a válida", () => {
    const escolhidos = escolherParaRenovar(
      [
        contato("vencida", fotoQueVence(AGORA - H)),
        contato("valida", fotoQueVence(AGORA + 3 * 24 * H)),
        contato("sem-oe", "https://cdn-de-teste.invalid/v/foto.jpg?oh=00_abc"),
        contato("na-margem", fotoQueVence(AGORA + 12 * H)),
      ],
      AGORA
    );
    expect(escolhidos.map((c) => c.ig_id)).toEqual(["vencida", "sem-oe", "na-margem"]);
  });

  it("a fronteira é a margem inteira: 25 h ainda é devida, 25 h e 1 s não", () => {
    // O `oe` tem resolução de segundo, então a fronteira é medida em segundos inteiros.
    const escolhidos = escolherParaRenovar(
      [
        contato("24h59", fotoQueVence(AGORA + 25 * H - 60_000)),
        contato("25h", fotoQueVence(AGORA + 25 * H)),
        contato("25h-e-1s", fotoQueVence(AGORA + 25 * H + 1000)),
        contato("25h01", fotoQueVence(AGORA + 25 * H + 60_000)),
      ],
      AGORA
    );
    expect(escolhidos.map((c) => c.ig_id)).toEqual(["24h59", "25h"]);
  });

  it("deixa de fora quem não tem foto: a tela já mostra a inicial e não há o que renovar", () => {
    const escolhidos = escolherParaRenovar(
      [contato("nula", null), contato("vazia", ""), contato("vencida", fotoQueVence(AGORA - H))],
      AGORA
    );
    expect(escolhidos.map((c) => c.ig_id)).toEqual(["vencida"]);
  });

  it("mantém a ordem de chegada, que é a da recência, e corta nas 20", () => {
    const entrada = Array.from({ length: 25 }, (_, i) => contato(`c${i}`, fotoQueVence(AGORA - (i + 1) * H)));
    // Uma válida no meio, para o corte contar só as devidas.
    entrada.splice(3, 0, contato("valida-no-meio", fotoQueVence(AGORA + 3 * 24 * H)));
    const escolhidos = escolherParaRenovar(entrada, AGORA);
    expect(escolhidos).toHaveLength(20);
    expect(escolhidos.map((c) => c.ig_id)).toEqual(Array.from({ length: 20 }, (_, i) => `c${i}`));
  });

  it("devolve os próprios objetos, com os campos que vieram", () => {
    const um = { ig_id: "x", profile_pic: fotoQueVence(AGORA - H), outro: 7 };
    expect(escolherParaRenovar([um], AGORA)[0]).toBe(um);
  });
});

describe("a foto depois de uma falha da Meta", () => {
  const vencida = fotoQueVence(AGORA - H);
  const naMargem = fotoQueVence(AGORA + 12 * H);
  const semOe = "https://cdn-de-teste.invalid/v/foto.jpg?oh=00_abc";
  const recusa = new IgError(400, '{"error":{"message":"Unsupported get request","code":100}}');

  it("anula a foto JÁ vencida quando a Meta recusa (4xx) e a conta foi lida nesta passagem", () => {
    expect(fotoDepoisDaFalha(vencida, recusa, true, AGORA)).toBe("anular");
    expect(fotoDepoisDaFalha(vencida, new IgError(404, "{}"), true, AGORA)).toBe("anular");
    expect(fotoDepoisDaFalha(vencida, new IgError(499, "{}"), true, AGORA)).toBe("anular");
    expect(fotoDepoisDaFalha(semOe, recusa, true, AGORA)).toBe("anular");
  });

  it("a fronteira do vencimento: vencida no próprio instante anula, um segundo antes de vencer não", () => {
    expect(fotoDepoisDaFalha(fotoQueVence(AGORA), recusa, true, AGORA)).toBe("anular");
    expect(fotoDepoisDaFalha(fotoQueVence(AGORA + 1000), recusa, true, AGORA)).toBe("manter");
  });

  it("mantém a foto que ainda vale, mesmo dentro da margem: uma falha não apaga foto boa", () => {
    expect(fotoDepoisDaFalha(naMargem, recusa, true, AGORA)).toBe("manter");
  });

  it("mantém quando a conta não foi lida: com o token inválido, a Meta recusa todo mundo", () => {
    expect(fotoDepoisDaFalha(vencida, recusa, false, AGORA)).toBe("manter");
  });

  it("mantém na falha passageira: limite de chamadas, erro da Meta, teto de tempo e rede", () => {
    expect(fotoDepoisDaFalha(vencida, new IgError(429, "{}"), true, AGORA)).toBe("manter");
    expect(fotoDepoisDaFalha(vencida, new IgError(500, "{}"), true, AGORA)).toBe("manter");
    expect(fotoDepoisDaFalha(vencida, new IgError(503, "{}"), true, AGORA)).toBe("manter");
    expect(fotoDepoisDaFalha(vencida, new IgError(399, "{}"), true, AGORA)).toBe("manter");
    expect(fotoDepoisDaFalha(vencida, new IgTimeoutError("/123", 8000), true, AGORA)).toBe("manter");
    expect(fotoDepoisDaFalha(vencida, new TypeError("fetch failed"), true, AGORA)).toBe("manter");
    expect(fotoDepoisDaFalha(vencida, "qualquer coisa", true, AGORA)).toBe("manter");
  });
});

describe("a foto depois de uma resposta da Meta", () => {
  const vencida = fotoQueVence(AGORA - H);
  const valida = fotoQueVence(AGORA + 12 * H);
  const nova = fotoQueVence(AGORA + 4 * 24 * H);

  it("grava a nova quando ela vem", () => {
    expect(fotoDepoisDaResposta(vencida, nova, AGORA)).toBe(nova);
    expect(fotoDepoisDaResposta(valida, nova, AGORA)).toBe(nova);
  });

  it("sem foto na resposta, anula a vencida (senão ela fica devida para sempre) e mantém a válida", () => {
    expect(fotoDepoisDaResposta(vencida, undefined, AGORA)).toBeNull();
    expect(fotoDepoisDaResposta(vencida, null, AGORA)).toBeNull();
    expect(fotoDepoisDaResposta(vencida, "", AGORA)).toBeNull();
    expect(fotoDepoisDaResposta(valida, undefined, AGORA)).toBe(valida);
  });
});
