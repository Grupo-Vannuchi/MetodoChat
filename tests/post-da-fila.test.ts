import { describe, expect, it } from "vitest";
import {
  avisoDoDesfechoDoPost,
  caminhosDoPostDaFila,
  cartaoDoPost,
  linhaDaFalhaDoPost,
  paginaDoPost,
} from "@/lib/post-da-fila";
import { rotuloDoPostNoLinkedin } from "@/lib/linkedin-publicacao";
import { avisoDoDesfecho } from "@/lib/avisos";
import { KINDS_FORA_DA_ENTREGA_DO_MOTOR } from "@/lib/envio-filters";
import { MOTIVO_NAO_REGISTRADO, fraseSobreAMidia } from "@/lib/publicacao";

// O POST DA FILA, DE QUALQUER REDE (docs/specs/2026-11-06-linkedin-no-perfil.md, §7; a parte 2a). As telas de
// Publicações (o calendário, "Não saíram" e a página do post) e as ações de cancelar e remarcar leem o post do
// Instagram e o do LinkedIn pelas mesmas funções, e o que muda por rede é decidido aqui, fora do JSX.

const IG = { kind: "publicacao", payload: { forma: "imagem", caminhos: ["conta/ig.jpg"], legenda: "A legenda" } };
const LI_TEXTO = { kind: "publicacao_linkedin", payload: { forma: "texto", caminhos: [], texto: "O texto do post" } };
const LI_IMAGEM = { kind: "publicacao_linkedin", payload: { forma: "imagem", caminhos: ["conta/li.jpg"], texto: "Com foto" } };
// O CARROSSEL DO LINKEDIN (a parte 3a): as fotos vão como PDF, e as telas mostram a primeira como capa.
const LI_CARROSSEL = {
  kind: "publicacao_linkedin",
  payload: { forma: "carrossel", caminhos: ["conta/c1.jpg", "conta/c2.jpg"], texto: "O carrossel" },
};

describe("o nome do post do LinkedIn", () => {
  it("leva a rede na frente, como o convite do LinkedIn", () => {
    expect(rotuloDoPostNoLinkedin({ forma: "texto" })).toBe("LinkedIn · Só texto");
    expect(rotuloDoPostNoLinkedin({ forma: "imagem" })).toBe("LinkedIn · Imagem");
    expect(rotuloDoPostNoLinkedin({ forma: "carrossel" })).toBe("LinkedIn · Carrossel (PDF)");
    expect(rotuloDoPostNoLinkedin(null)).toBe("LinkedIn · Forma não reconhecida");
  });
});

describe("o quadrado do calendário", () => {
  it("o do Instagram continua como era: o nome da forma e a capa enquanto não saiu", () => {
    expect(cartaoDoPost(IG, false)).toEqual({ rotulo: "Imagem no feed", capa: "conta/ig.jpg", soVideo: false });
    expect(cartaoDoPost(IG, true)).toEqual({ rotulo: "Imagem no feed", capa: null, soVideo: false });
  });

  it("o do Instagram com vídeo: a capa é a primeira imagem, e o só vídeo fica sem capa e com o ícone", () => {
    const carrossel = { kind: "publicacao", payload: { forma: "carrossel", caminhos: ["c/v.mp4", "c/f.jpg"] } };
    expect(cartaoDoPost(carrossel, false)).toEqual({ rotulo: "Carrossel", capa: "c/f.jpg", soVideo: false });
    const reels = { kind: "publicacao", payload: { forma: "reels", caminhos: ["c/r.mp4"] } };
    expect(cartaoDoPost(reels, false)).toEqual({ rotulo: "Reels", capa: null, soVideo: true });
    expect(cartaoDoPost(reels, true)).toEqual({ rotulo: "Reels", capa: null, soVideo: false });
  });

  it("o do LinkedIn leva a rede no nome, e a capa é a imagem, enquanto não saiu", () => {
    expect(cartaoDoPost(LI_IMAGEM, false)).toEqual({ rotulo: "LinkedIn · Imagem", capa: "conta/li.jpg", soVideo: false });
    expect(cartaoDoPost(LI_IMAGEM, true)).toEqual({ rotulo: "LinkedIn · Imagem", capa: null, soVideo: false });
    expect(cartaoDoPost(LI_TEXTO, false)).toEqual({ rotulo: "LinkedIn · Só texto", capa: null, soVideo: false });
  });

  it("o carrossel do LinkedIn: a capa é a primeira foto, enquanto não saiu (a parte 3a)", () => {
    expect(cartaoDoPost(LI_CARROSSEL, false)).toEqual({ rotulo: "LinkedIn · Carrossel (PDF)", capa: "conta/c1.jpg", soVideo: false });
    expect(cartaoDoPost(LI_CARROSSEL, true)).toEqual({ rotulo: "LinkedIn · Carrossel (PDF)", capa: null, soVideo: false });
  });

  it("o payload torto do LinkedIn não vira o do Instagram", () => {
    expect(cartaoDoPost({ kind: "publicacao_linkedin", payload: { forma: "reels" } }, false).rotulo).toBe(
      "LinkedIn · Forma não reconhecida"
    );
  });
});

describe("a linha de \"Não saíram\"", () => {
  const base = { not_before: new Date("2026-11-10T10:00:00Z"), claimed_at: new Date("2026-11-10T10:05:00Z") };

  it("a do LinkedIn tem a rede, o começo do texto e o motivo", () => {
    expect(linhaDaFalhaDoPost({ ...base, ...LI_TEXTO, error: " o motivo " })).toEqual({
      quando: base.claimed_at,
      motivo: "o motivo",
      forma: "LinkedIn · Só texto",
      legenda: "O texto do post",
    });
    expect(linhaDaFalhaDoPost({ ...base, ...LI_TEXTO, error: null }).motivo).toBe(MOTIVO_NAO_REGISTRADO);
  });

  it("a do Instagram continua como era", () => {
    expect(linhaDaFalhaDoPost({ ...base, ...IG, error: "x" })).toMatchObject({ forma: "Imagem no feed", legenda: "A legenda" });
  });
});

describe("os arquivos que o cancelar apaga", () => {
  it("saem do payload de cada rede, e o payload torto não apaga nada", () => {
    expect(caminhosDoPostDaFila(IG.kind, IG.payload)).toEqual(["conta/ig.jpg"]);
    expect(caminhosDoPostDaFila(LI_IMAGEM.kind, LI_IMAGEM.payload)).toEqual(["conta/li.jpg"]);
    expect(caminhosDoPostDaFila(LI_TEXTO.kind, LI_TEXTO.payload)).toEqual([]);
    expect(caminhosDoPostDaFila(LI_CARROSSEL.kind, LI_CARROSSEL.payload)).toEqual(["conta/c1.jpg", "conta/c2.jpg"]);
    expect(caminhosDoPostDaFila("publicacao_linkedin", { forma: "reels", caminhos: ["x"] })).toBeNull();
    expect(caminhosDoPostDaFila("publicacao", { forma: "nada" })).toBeNull();
  });
});

describe("a página de um post", () => {
  const agendado = { saiu: false, encerrado: false };
  const saiu = { saiu: true, encerrado: true };

  it("a do Instagram continua com a legenda, a mídia, o id para o \"Ver no Instagram\" e a nota do aplicativo", () => {
    const p = paginaDoPost({ ...IG, payload: { ...IG.payload, media_id: "17900000000000001" }, error: null }, saiu);
    expect(p).toMatchObject({
      titulo: "Imagem no feed",
      tituloDoTexto: "Legenda",
      texto: "A legenda",
      semTexto: "Sem legenda.",
      caminhos: ["conta/ig.jpg"],
      sobreAMidia: fraseSobreAMidia(saiu, null),
      mediaIdNoInstagram: "17900000000000001",
      linkNoLinkedin: null,
    });
    expect(p.notaDoCancelar).toContain("só o aplicativo do Instagram apaga");
  });

  it("a do LinkedIn tem o texto, o link para ver no LinkedIn depois de sair, e a nota de apagar por lá", () => {
    const publicado = { ...LI_TEXTO, payload: { ...LI_TEXTO.payload, post_urn: "urn:li:share:7001" }, error: null };
    const p = paginaDoPost(publicado, saiu);
    expect(p).toMatchObject({
      titulo: "LinkedIn · Só texto",
      tituloDoTexto: "Texto",
      texto: "O texto do post",
      semTexto: "Sem texto.",
      caminhos: [],
      // Só texto não tem mídia, e a frase sobre a mídia apagada mentiria.
      sobreAMidia: null,
      mediaIdNoInstagram: null,
      linkNoLinkedin: "https://www.linkedin.com/feed/update/urn:li:share:7001/",
    });
    expect(p.notaDoCancelar).toContain("apague pelo próprio LinkedIn");
    expect(p.notaDoCancelar).not.toContain("Instagram");
    // Antes de sair, não há link, mesmo com um URN no payload.
    expect(paginaDoPost(publicado, agendado).linkNoLinkedin).toBeNull();
  });

  it("a imagem do LinkedIn tem a mídia e a frase sobre ela, e nunca é vídeo", () => {
    const p = paginaDoPost({ ...LI_IMAGEM, error: null }, saiu);
    expect(p.caminhos).toEqual(["conta/li.jpg"]);
    expect(p.sobreAMidia).toBe(fraseSobreAMidia(saiu, null));
    expect(p.ehVideo("conta/li.mp4")).toBe(false);
  });

  it("o carrossel do LinkedIn tem todas as fotos e a frase sobre a mídia, e nunca é vídeo (a parte 3a)", () => {
    const agendadoComErro = paginaDoPost({ ...LI_CARROSSEL, error: "o LinkedIn recusou" }, agendado);
    expect(agendadoComErro.titulo).toBe("LinkedIn · Carrossel (PDF)");
    expect(agendadoComErro.caminhos).toEqual(["conta/c1.jpg", "conta/c2.jpg"]);
    expect(agendadoComErro.sobreAMidia).toBe(fraseSobreAMidia(agendado, "o LinkedIn recusou"));
    expect(paginaDoPost({ ...LI_CARROSSEL, error: null }, saiu).sobreAMidia).toBe(fraseSobreAMidia(saiu, null));
    expect(agendadoComErro.ehVideo("conta/c1.mp4")).toBe(false);
    // O SÓ TEXTO CONTINUA SEM A FRASE: ele não tem mídia.
    expect(paginaDoPost({ ...LI_TEXTO, error: null }, saiu).sobreAMidia).toBeNull();
  });
});

describe("o aviso do cancelar e do remarcar", () => {
  it("no LinkedIn, o \"já saiu\" do cancelar manda apagar por lá, e não pelo Instagram", () => {
    const aviso = avisoDoDesfechoDoPost("tarde_demais", "cancelar", "publicacao_linkedin");
    expect(aviso.tom).toBe("erro");
    expect(aviso.texto).toContain("apague por lá");
    expect(aviso.texto).not.toContain("Instagram");
  });

  it("o resto é o aviso de sempre, nas duas redes", () => {
    for (const kind of ["publicacao", "publicacao_linkedin", null]) {
      expect(avisoDoDesfechoDoPost("feito", "cancelar", kind)).toEqual(avisoDoDesfecho("feito", "cancelar"));
      expect(avisoDoDesfechoDoPost("tarde_demais", "remarcar", kind)).toEqual(avisoDoDesfecho("tarde_demais", "remarcar"));
    }
    expect(avisoDoDesfechoDoPost("tarde_demais", "cancelar", "publicacao")).toEqual(avisoDoDesfecho("tarde_demais", "cancelar"));
  });
});

describe("o que não conta como entrega do motor", () => {
  it("o post do LinkedIn também fica de fora, como o do Instagram", () => {
    expect(KINDS_FORA_DA_ENTREGA_DO_MOTOR).toContain("publicacao");
    expect(KINDS_FORA_DA_ENTREGA_DO_MOTOR).toContain("publicacao_linkedin");
  });
});
