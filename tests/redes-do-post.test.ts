import { describe, expect, it } from "vitest";
import {
  CAIXINHAS_DE_PARTIDA,
  NOTA_DA_LEGENDA_NO_LINKEDIN,
  avisoDasDuasRedes,
  estadoDasCaixinhas,
  formasDaTela,
  redeAceitaAForma,
  redesDoPedido,
  textoQueVaiAoLinkedin,
} from "@/lib/redes-do-post";
import { avisoDaPublicacaoEnfileirada } from "@/lib/avisos";
import { avisoDoPostNoLinkedin } from "@/lib/linkedin-publicacao";
import { textoDaRecusaDaPublicacao } from "@/lib/publicacao";

// AS DUAS REDES NO MESMO POST (docs/specs/2026-11-06-linkedin-no-perfil.md, §6 e §7; a parte 2b). As regras puras
// que a tela e a action leem: o que cada rede aceita, as caixinhas, o texto que vai ao LinkedIn e o aviso.

const ligado = { disponivel: true as const, nome: "Ana Souza" };
const desligado = {
  disponivel: false as const,
  motivo: "Esta conta não tem LinkedIn conectado. Quem administra o painel manda o convite pela Configuração.",
};
const as2 = { instagram: true, linkedin: true };

describe("o que cada rede aceita", () => {
  it("o Instagram aceita as quatro formas dele, e não o só texto", () => {
    for (const forma of ["imagem", "carrossel", "reels", "story"] as const) {
      expect(redeAceitaAForma("instagram", forma)).toBeNull();
    }
    expect(redeAceitaAForma("instagram", "texto")).toContain("só de texto");
  });

  it("o LinkedIn aceita o só texto e a imagem; o carrossel e o reels chegam na próxima entrega, e o story nunca", () => {
    expect(redeAceitaAForma("linkedin", "texto")).toBeNull();
    expect(redeAceitaAForma("linkedin", "imagem")).toBeNull();
    expect(redeAceitaAForma("linkedin", "carrossel")).toContain("próxima entrega");
    expect(redeAceitaAForma("linkedin", "reels")).toContain("próxima entrega");
    expect(redeAceitaAForma("linkedin", "story")).toContain("não tem story");
  });
});

describe("as formas da tela", () => {
  it("sem o LinkedIn disponível, são as quatro do Instagram, sem o só texto", () => {
    expect(formasDaTela(null)).toEqual(["imagem", "carrossel", "reels", "story"]);
    expect(formasDaTela(desligado)).toEqual(["imagem", "carrossel", "reels", "story"]);
  });

  it("com o LinkedIn disponível, o só texto entra no fim", () => {
    expect(formasDaTela(ligado)).toEqual(["imagem", "carrossel", "reels", "story", "texto"]);
  });
});

describe("as caixinhas", () => {
  it("começam só com o Instagram marcado (a decisão do Eduardo, 10/11)", () => {
    expect(CAIXINHAS_DE_PARTIDA).toEqual({ instagram: true, linkedin: false });
  });

  it("sem o LinkedIn na página, não há caixinha do LinkedIn, e o Instagram é como antes", () => {
    const e = estadoDasCaixinhas({ forma: "imagem", marcadas: as2, linkedin: null });
    expect(e.linkedin).toBeNull();
    expect(e.instagram).toEqual({ ligada: true, marcada: true, motivo: null });
  });

  it("na imagem, com o LinkedIn ligado, as duas podem ser marcadas", () => {
    const e = estadoDasCaixinhas({ forma: "imagem", marcadas: as2, linkedin: ligado });
    expect(e.instagram).toEqual({ ligada: true, marcada: true, motivo: null });
    expect(e.linkedin).toEqual({ ligada: true, marcada: true, motivo: null });
  });

  it("o que não foi marcado fica desmarcado", () => {
    const e = estadoDasCaixinhas({ forma: "imagem", marcadas: CAIXINHAS_DE_PARTIDA, linkedin: ligado });
    expect(e.linkedin).toEqual({ ligada: true, marcada: false, motivo: null });
  });

  it("o LinkedIn desligado (sem conexão ou vencido) fica desmarcado, com o motivo da conexão, mesmo se veio marcado", () => {
    const e = estadoDasCaixinhas({ forma: "imagem", marcadas: as2, linkedin: desligado });
    expect(e.linkedin).toEqual({ ligada: false, marcada: false, motivo: desligado.motivo });
  });

  it("o story, o carrossel e o reels desligam o LinkedIn, com o motivo da forma", () => {
    for (const forma of ["story", "carrossel", "reels"] as const) {
      const e = estadoDasCaixinhas({ forma, marcadas: as2, linkedin: ligado });
      expect(e.linkedin).toEqual({ ligada: false, marcada: false, motivo: redeAceitaAForma("linkedin", forma) });
      expect(e.instagram.marcada).toBe(true);
    }
  });

  it("o só texto desliga o Instagram, com o motivo", () => {
    const e = estadoDasCaixinhas({ forma: "texto", marcadas: as2, linkedin: ligado });
    expect(e.instagram).toEqual({ ligada: false, marcada: false, motivo: redeAceitaAForma("instagram", "texto") });
    expect(e.linkedin).toEqual({ ligada: true, marcada: true, motivo: null });
  });
});

describe("as redes do pedido", () => {
  it("só o valor '1' marca a rede", () => {
    expect(redesDoPedido({ instagram: "1", linkedin: null })).toEqual({ instagram: true, linkedin: false });
    expect(redesDoPedido({ instagram: "1", linkedin: "1" })).toEqual(as2);
    expect(redesDoPedido({ instagram: "on", linkedin: "true" })).toEqual({ instagram: false, linkedin: false });
    expect(redesDoPedido({ instagram: undefined, linkedin: "1" })).toEqual({ instagram: false, linkedin: true });
  });
});

describe("o texto que vai ao LinkedIn", () => {
  it("o texto próprio, quando há, sem os espaços das pontas", () => {
    expect(textoQueVaiAoLinkedin({ legenda: "A legenda #ig", textoProprio: "  O texto do LinkedIn  " })).toBe(
      "O texto do LinkedIn"
    );
  });

  it("sem o texto próprio (vazio ou só espaços), vai a legenda", () => {
    expect(textoQueVaiAoLinkedin({ legenda: " A legenda #ig ", textoProprio: "" })).toBe("A legenda #ig");
    expect(textoQueVaiAoLinkedin({ legenda: "A legenda", textoProprio: "   " })).toBe("A legenda");
  });

  it("sem os dois, vai o vazio, que a recusa do LinkedIn pega (texto_vazio)", () => {
    expect(textoQueVaiAoLinkedin({ legenda: "  ", textoProprio: "" })).toBe("");
  });

  it("a nota da tela diz que a menção vira texto e que a hashtag vira clicável", () => {
    expect(NOTA_DA_LEGENDA_NO_LINKEDIN).toContain("@");
    expect(NOTA_DA_LEGENDA_NO_LINKEDIN).toContain("hashtags");
  });
});

describe("o aviso das duas redes", () => {
  const campos = { dia: 12, mes: 11, hora: 9, minuto: 5 };
  const ig = (texto: string) => `Instagram: ${texto}`;
  const li = (texto: string) => `LinkedIn: ${texto}`;

  it("agora nas duas: uma frase por rede, tirada da função de cada rede", () => {
    const a = avisoDasDuasRedes({
      tipo: "entrou",
      campos,
      instagram: { entrou: true, jaVale: true },
      linkedin: { entrou: true, jaVale: true, desfecho: "publicado" },
    });
    expect(a.tom).toBe("ok");
    expect(a.texto).toBe(
      `${ig(avisoDaPublicacaoEnfileirada(null).texto)} ${li(avisoDoPostNoLinkedin({ desfecho: "publicado", agendadoPara: null }).texto)}`
    );
  });

  it("agendado nas duas: a hora escolhida nas duas frases", () => {
    const a = avisoDasDuasRedes({
      tipo: "entrou",
      campos,
      instagram: { entrou: true, jaVale: false },
      linkedin: { entrou: true, jaVale: false, desfecho: null },
    });
    expect(a.tom).toBe("ok");
    expect(a.texto).toBe(
      `${ig(avisoDaPublicacaoEnfileirada(campos).texto)} ${li(avisoDoPostNoLinkedin({ desfecho: null, agendadoPara: campos }).texto)}`
    );
    expect(a.texto.match(/12\/11 às 09:05/g)).toHaveLength(2);
  });

  it("o LinkedIn que não saiu deixa o aviso em erro, com o motivo, e o Instagram é dito igual", () => {
    const a = avisoDasDuasRedes({
      tipo: "entrou",
      campos,
      instagram: { entrou: true, jaVale: true },
      linkedin: { entrou: true, jaVale: true, desfecho: "falhou", motivo: "o LinkedIn recusou a imagem" },
    });
    expect(a.tom).toBe("erro");
    expect(a.texto).toContain(ig(avisoDaPublicacaoEnfileirada(null).texto));
    expect(a.texto).toContain("o LinkedIn recusou a imagem");
  });

  it("uma rede que já existia é dita como tal, e a nova segue com o aviso de sempre", () => {
    const soONovoNoLinkedin = avisoDasDuasRedes({
      tipo: "entrou",
      campos,
      instagram: { entrou: false },
      linkedin: { entrou: true, jaVale: true, desfecho: "publicado" },
    });
    expect(soONovoNoLinkedin.tom).toBe("ok");
    expect(soONovoNoLinkedin.texto).toContain(ig(textoDaRecusaDaPublicacao("ja_enfileirado")));
    expect(soONovoNoLinkedin.texto).toContain(li("Post publicado no LinkedIn."));

    const soONovoNoInstagram = avisoDasDuasRedes({
      tipo: "entrou",
      campos,
      instagram: { entrou: true, jaVale: true },
      linkedin: { entrou: false },
    });
    expect(soONovoNoInstagram.tom).toBe("ok");
    expect(soONovoNoInstagram.texto).toContain(li("O post do LinkedIn já estava na fila. Nada foi duplicado."));
  });

  it("as duas que já existiam: o aviso é de erro, e diz que nada foi duplicado", () => {
    const a = avisoDasDuasRedes({ tipo: "entrou", campos, instagram: { entrou: false }, linkedin: { entrou: false } });
    expect(a.tom).toBe("erro");
    expect(a.texto.match(/Nada foi duplicado/g)).toHaveLength(2);
  });

  it("o Instagram não entrou e o LinkedIn foi desfeito: nada foi agendado", () => {
    const a = avisoDasDuasRedes({ tipo: "instagram_nao_entrou", linkedin: "desfeito" });
    expect(a.tom).toBe("erro");
    expect(a.texto).toContain("Nada foi agendado");
  });

  it("o Instagram não entrou e o LinkedIn já tinha começado a sair: a tela diz que ele segue", () => {
    const a = avisoDasDuasRedes({ tipo: "instagram_nao_entrou", linkedin: "seguiu" });
    expect(a.tom).toBe("erro");
    expect(a.texto).toContain("não entrou na fila do Instagram");
    expect(a.texto).toContain("LinkedIn já tinha começado a sair");
    expect(a.texto).not.toContain("Nada foi agendado");
  });

  it("o Instagram não entrou e o LinkedIn já estava na fila antes: ele segue, e não foi mexido", () => {
    const a = avisoDasDuasRedes({ tipo: "instagram_nao_entrou", linkedin: "ja_existia" });
    expect(a.tom).toBe("erro");
    expect(a.texto).toContain("LinkedIn já estava na fila");
  });

  it("cada saída tem a sua frase", () => {
    const frases = [
      avisoDasDuasRedes({ tipo: "instagram_nao_entrou", linkedin: "desfeito" }).texto,
      avisoDasDuasRedes({ tipo: "instagram_nao_entrou", linkedin: "seguiu" }).texto,
      avisoDasDuasRedes({ tipo: "instagram_nao_entrou", linkedin: "ja_existia" }).texto,
    ];
    expect(new Set(frases).size).toBe(3);
  });
});
