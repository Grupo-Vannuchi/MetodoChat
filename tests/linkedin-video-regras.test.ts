import { describe, expect, it } from "vitest";
import {
  avisoDoPostNoLinkedin,
  AVISO_DO_VIDEO_NA_FILA,
  desfechoDoErroDaParte,
  oVideoVaiAoLinkedin,
  progressoDoVideo,
  proximaEtapaDoVideo,
  recusaDoPedidoNoLinkedin,
  rotuloDoPostNoLinkedin,
  TEXTO_DO_VIDEO_QUE_NAO_E_MP4,
  textoDaRecusaNoLinkedin,
  tetoDePassadasDoVideo,
  tetoDoVideoAtingido,
  IDADE_MAXIMA_DO_VIDEO_MS,
  type EstadoDoEnvioDoVideo,
} from "@/lib/linkedin-publicacao";

// AS REGRAS PURAS DO VÍDEO EM PARTES NO LINKEDIN (a parte 3b; o desenho, scratchpad/desenho-li3b.md, v3): a forma e o
// rótulo, o "só MP4", o progresso e a próxima etapa (o 230), os dois tetos (o 230 e o 237) e o erro da parte, que vai
// sem o token (o 234 e o 238). Elas não mudam nada do que já sai: o vídeo só entra na lista das formas com o ramo
// dele na fila.

const ID = "3f1c2b7a-9d4e-4f6a-8b1c-2d3e4f5a6b7c";
const vazio: EstadoDoEnvioDoVideo = { reservado: false, partes: 0, etags: 0, finalizado: false };

describe("a forma do vídeo no LinkedIn", () => {
  it("o rótulo nas Publicações é LinkedIn · Vídeo", () => {
    expect(rotuloDoPostNoLinkedin({ forma: "video" })).toBe("LinkedIn · Vídeo");
  });

  it("o pedido de vídeo leva um arquivo só, MP4 pela extensão do caminho; o MOV é recusado com a frase do MP4", () => {
    const pedido = (caminhos: string[]) => recusaDoPedidoNoLinkedin({ forma: "video", caminhos, texto: "Um vídeo novo", idDoEnvio: ID });
    expect(pedido(["conta/a.mp4"])).toBeNull();
    expect(pedido(["conta/a.MP4"])).toBeNull();
    expect(pedido([])).toBe("quantidade");
    expect(pedido(["conta/a.mp4", "conta/b.mp4"])).toBe("quantidade");
    expect(pedido(["conta/a.mov"])).toBe("video_nao_mp4");
    expect(pedido(["conta/a.jpg"])).toBe("video_nao_mp4");
    expect(textoDaRecusaNoLinkedin("video_nao_mp4")).toBe(TEXTO_DO_VIDEO_QUE_NAO_E_MP4);
  });
});

describe("só MP4 (Videos API: \"File format: MP4.\")", () => {
  it("o MP4 vai; o MOV do iPhone e o resto não", () => {
    expect(oVideoVaiAoLinkedin("video/mp4")).toBe(true);
    expect(oVideoVaiAoLinkedin("video/quicktime")).toBe(false);
    expect(oVideoVaiAoLinkedin("video/webm")).toBe(false);
    expect(oVideoVaiAoLinkedin("")).toBe(false);
  });

  it("a frase diz o porquê", () => {
    expect(TEXTO_DO_VIDEO_QUE_NAO_E_MP4).toBe("O LinkedIn só aceita vídeo MP4.");
  });
});

describe("o progresso e a próxima etapa (o 230)", () => {
  it("a ordem é a reserva, cada parte, o fim e o post", () => {
    expect(proximaEtapaDoVideo(vazio)).toBe("reserva");
    expect(proximaEtapaDoVideo({ reservado: true, partes: 3, etags: 0, finalizado: false })).toBe("parte");
    expect(proximaEtapaDoVideo({ reservado: true, partes: 3, etags: 2, finalizado: false })).toBe("parte");
    expect(proximaEtapaDoVideo({ reservado: true, partes: 3, etags: 3, finalizado: false })).toBe("fim");
    expect(proximaEtapaDoVideo({ reservado: true, partes: 3, etags: 3, finalizado: true })).toBe("post");
  });

  it("o progresso conta a reserva, cada ETag gravado e o fim, e só cresce ao longo das etapas", () => {
    const caminho: EstadoDoEnvioDoVideo[] = [
      vazio,
      { reservado: true, partes: 3, etags: 0, finalizado: false },
      { reservado: true, partes: 3, etags: 1, finalizado: false },
      { reservado: true, partes: 3, etags: 2, finalizado: false },
      { reservado: true, partes: 3, etags: 3, finalizado: false },
      { reservado: true, partes: 3, etags: 3, finalizado: true },
    ];
    expect(caminho.map(progressoDoVideo)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("ETags a mais que as partes (um payload torto) não passam do número de partes", () => {
    const torto = { reservado: true, partes: 2, etags: 5, finalizado: false };
    expect(progressoDoVideo(torto)).toBe(3);
    expect(proximaEtapaDoVideo(torto)).toBe("fim");
  });
});

describe("os dois tetos do vídeo (o 230 e o 237)", () => {
  const T0 = Date.UTC(2026, 10, 16, 12, 0, 0);

  it("o teto das passadas é o número de partes, mais a reserva, o fim e o post, mais 6 de folga", () => {
    expect(tetoDePassadasDoVideo(13)).toBe(22);
    expect(tetoDePassadasDoVideo(1)).toBe(10);
  });

  it("encerra só quando PASSA do teto das passadas", () => {
    const base = { partes: 13, primeiraPassadaEmMs: T0, agoraMs: T0 + 60_000 };
    expect(tetoDoVideoAtingido({ ...base, passadas: 22 })).toBeNull();
    expect(tetoDoVideoAtingido({ ...base, passadas: 23 })).toBe("passadas");
  });

  it("a idade: 2 horas desde a primeira passada encerram, mesmo com passadas sobrando", () => {
    expect(IDADE_MAXIMA_DO_VIDEO_MS).toBe(2 * 60 * 60 * 1000);
    const base = { partes: 13, passadas: 5, primeiraPassadaEmMs: T0 };
    expect(tetoDoVideoAtingido({ ...base, agoraMs: T0 + IDADE_MAXIMA_DO_VIDEO_MS - 1 })).toBeNull();
    expect(tetoDoVideoAtingido({ ...base, agoraMs: T0 + IDADE_MAXIMA_DO_VIDEO_MS })).toBe("idade");
  });

  it("sem a primeira passada gravada, só o teto das passadas vale", () => {
    expect(tetoDoVideoAtingido({ partes: 3, passadas: 1, primeiraPassadaEmMs: null, agoraMs: T0 })).toBeNull();
  });
});

describe("o erro de uma parte, que vai sem o token (o 234 e o 238)", () => {
  it("o 401 e o 403 são a parte recusada, com texto próprio, e não a autorização da conexão", () => {
    expect(desfechoDoErroDaParte(401)).toBe("recusada");
    expect(desfechoDoErroDaParte(403)).toBe("recusada");
  });

  it("a rede, o 409, o 429 e os 5xx passam, como hoje", () => {
    for (const s of [0, 409, 429, 500, 502, 503]) expect(desfechoDoErroDaParte(s)).toBe("passageiro");
  });

  it("os outros 4xx não passam sozinhos", () => {
    for (const s of [400, 404, 413, 422]) expect(desfechoDoErroDaParte(s)).toBe("permanente");
  });
});

// O AVISO DO VÍDEO (a parte 3b): na fila, ele diz que o vídeo sobe em partes e sai em minutos, e não "em instantes". O
// publicado, o que falhou e o agendado são os de sempre.
describe("o aviso do vídeo no LinkedIn", () => {
  it("na fila, o vídeo tem a frase própria; as outras formas, a de sempre", () => {
    expect(avisoDoPostNoLinkedin({ desfecho: null, agendadoPara: null, forma: "video" })).toEqual({ tom: "ok", texto: AVISO_DO_VIDEO_NA_FILA });
    expect(avisoDoPostNoLinkedin({ desfecho: "aguardando", agendadoPara: null, forma: "video" })).toEqual({ tom: "ok", texto: AVISO_DO_VIDEO_NA_FILA });
    expect(AVISO_DO_VIDEO_NA_FILA).toBe("O vídeo do LinkedIn está na fila e sobe em partes; ele sai em alguns minutos. Acompanhe em Publicações.");
    expect(avisoDoPostNoLinkedin({ desfecho: null, agendadoPara: null, forma: "carrossel" }).texto).toBe(
      "O post do LinkedIn está na fila e vai sair em instantes. Acompanhe em Publicações."
    );
  });

  it("o publicado, o que falhou e o agendado do vídeo são os de sempre", () => {
    expect(avisoDoPostNoLinkedin({ desfecho: "publicado", agendadoPara: null, forma: "video" }).texto).toBe("Post publicado no LinkedIn.");
    expect(avisoDoPostNoLinkedin({ desfecho: "falhou", motivo: "x", agendadoPara: null, forma: "video" })).toMatchObject({ tom: "erro" });
    expect(avisoDoPostNoLinkedin({ desfecho: null, agendadoPara: { dia: 1, mes: 12, hora: 9, minuto: 5 }, forma: "video" }).texto).toBe(
      "Post do LinkedIn agendado para 01/12 às 09:05. Acompanhe em Publicações."
    );
  });
});
