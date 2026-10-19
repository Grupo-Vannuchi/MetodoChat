import { describe, expect, it } from "vitest";
import { caminhosDoCarrossel, podeApagar, type MotivoDoApagar } from "@/lib/bonus/apagar-regras";
import {
  TEXTO_APAGAR_CARROSSEL,
  TEXTO_CANCELAR_APAGAR,
  TEXTO_CARROSSEL_APAGADO,
  TEXTO_CONFIRMAR_APAGAR,
  TEXTO_SIM_APAGAR,
  apagarNaPagina,
  textoDoApagar,
} from "@/lib/bonus/apagar-textos";
import { TEXTO_CARROSSEL_NAO_ENCONTRADO } from "@/lib/bonus/carrossel-textos";
import type { EstadoDaPublicacao } from "@/lib/bonus/publicar-estado";
import type { GeracaoNaTela } from "@/lib/bonus/tempos";

// QUEM PODE SER APAGADO (spec da Etapa 10, "Quem pode ser apagado"): a mesma regra na tela e no
// servidor. A trava do publicar e a do apagar são uma só (`publicacaoLivre`); a geração do texto em
// andamento e uma imagem sendo gerada (achado 95) também seguram. E o que sai do bucket depois do commit.

const ESTADOS: Record<EstadoDaPublicacao["tipo"], EstadoDaPublicacao> = {
  livre: { tipo: "livre" },
  agendado: { tipo: "agendado", quando: new Date("2026-10-16T13:00:00Z"), filaId: "f1" },
  publicando: { tipo: "publicando", filaId: null },
  publicado: { tipo: "publicado", em: null, filaId: "f3" },
  falhou: { tipo: "falhou", motivo: null, filaId: "f4" },
  cancelado: { tipo: "cancelado", filaId: "f5" },
  nao_entrou: { tipo: "nao_entrou" },
  saiu_da_fila: { tipo: "saiu_da_fila" },
  desconhecido: { tipo: "desconhecido" },
};

const pode = (publicacao: EstadoDaPublicacao, geracao: GeracaoNaTela = "pronto", imagemGerando = false) =>
  podeApagar({ publicacao, geracao, imagemGerando });

describe("podeApagar", () => {
  it.each(["livre", "falhou", "cancelado", "nao_entrou"] as const)("a publicação %s, livre pela regra do publicar, pode", (tipo) => {
    expect(pode(ESTADOS[tipo])).toEqual({ ok: true });
  });

  it.each([
    ["agendado", "agendado"],
    ["publicando", "agendado"],
    ["publicado", "publicado"],
    ["saiu_da_fila", "desconhecido"],
    ["desconhecido", "desconhecido"],
  ] as const)("a publicação %s não pode (%s)", (tipo, motivo) => {
    expect(pode(ESTADOS[tipo])).toEqual({ ok: false, motivo });
  });

  it("a geração parada pode: pronta, travada ou falhada", () => {
    for (const geracao of ["pronto", "travou", "falhou"] as const) expect(pode(ESTADOS.livre, geracao)).toEqual({ ok: true });
  });

  it("a geração do texto em andamento não pode", () => {
    expect(pode(ESTADOS.livre, "gerando")).toEqual({ ok: false, motivo: "geracao" });
  });

  it("uma imagem do carrossel sendo gerada não pode (achado 95)", () => {
    expect(pode(ESTADOS.livre, "pronto", true)).toEqual({ ok: false, motivo: "imagem" });
  });

  it("a publicação trava antes de tudo: o agendado com uma imagem gerando diz o do calendário", () => {
    expect(pode(ESTADOS.agendado, "pronto", true)).toEqual({ ok: false, motivo: "agendado" });
  });

  it("um estado que a fila venha a ter trava, como no publicar", () => {
    expect(pode({ tipo: "novo_estado" } as unknown as EstadoDaPublicacao)).toEqual({ ok: false, motivo: "desconhecido" });
  });
});

describe("as frases do apagar", () => {
  const FRASES: Record<MotivoDoApagar, string> = {
    agendado: "Para apagar, cancele o agendamento no calendário antes.",
    publicado: "Este carrossel já foi publicado, e fica como histórico.",
    desconhecido: "Não consegui conferir a publicação deste carrossel; ele não pode ser apagado agora.",
    geracao: "Espere a geração terminar para apagar.",
    imagem: "Espere a imagem terminar para apagar.",
    nao_existe: TEXTO_CARROSSEL_NAO_ENCONTRADO,
  };

  it.each(Object.keys(FRASES) as MotivoDoApagar[])("%s tem frase", (motivo) => {
    expect(textoDoApagar(motivo)).toBe(FRASES[motivo]);
  });

  it("o botão, a pergunta e o aviso", () => {
    expect([TEXTO_APAGAR_CARROSSEL, TEXTO_CONFIRMAR_APAGAR, TEXTO_SIM_APAGAR, TEXTO_CANCELAR_APAGAR, TEXTO_CARROSSEL_APAGADO]).toEqual([
      "Apagar carrossel",
      "Apagar este carrossel e as imagens dele? Não tem volta.",
      "Sim, apagar",
      "Cancelar",
      "Carrossel apagado.",
    ]);
  });
});

describe("o que a página mostra no fim", () => {
  it("pode: o botão", () => {
    expect(apagarNaPagina({ ok: true })).toEqual({ tipo: "botao" });
  });

  it("o publicado: nada, porque fica como histórico", () => {
    expect(apagarNaPagina({ ok: false, motivo: "publicado" })).toEqual({ tipo: "nada" });
  });

  it.each(["agendado", "desconhecido", "geracao", "imagem"] as const)("%s: a frase no lugar do botão", (motivo) => {
    expect(apagarNaPagina({ ok: false, motivo })).toEqual({ tipo: "frase", texto: textoDoApagar(motivo) });
  });
});

describe("os arquivos que saem do bucket depois do commit", () => {
  const CONTA = "17841400000000001";
  const u = (n: number) => `${String(n).repeat(8)}-1111-4111-8111-111111111111`;
  const FOTO = `${CONTA}/bonus-foto/${u(1)}.jpg`;
  const PRONTO = `${CONTA}/bonus/${u(2)}.jpg`;
  const FILA_1 = `${CONTA}/bonus-fila/${u(3)}.jpg`;
  const FILA_2 = `${CONTA}/bonus-fila/${u(4)}.jpg`;
  const publicacao = (caminhos: string[]) => ({ chave: "k", caminhos, reservada_em: "2026-10-09T12:00:00Z" });

  it("as imagens dos slides (fotos e slides prontos) e as cópias da fila", () => {
    const arte = {
      conta: CONTA,
      imagens: { "1": { caminho: FOTO, versao: "v" }, "3": { caminho: PRONTO, versao: "v" } },
      publicacao: publicacao([FILA_1, FILA_2]),
    };
    expect(caminhosDoCarrossel(arte, 5, CONTA)).toEqual([FOTO, PRONTO, FILA_1, FILA_2]);
  });

  it("sem repetir um caminho", () => {
    const arte = { conta: CONTA, publicacao: publicacao([FILA_1, FILA_1]) };
    expect(caminhosDoCarrossel(arte, 5, CONTA)).toEqual([FILA_1]);
  });

  it("só os da pasta da conta do carrossel, na forma exata do destino: um caminho estranho fica", () => {
    const OUTRA = `99999/bonus-fila/${u(5)}.jpg`;
    const DO_PUBLICAR = `${CONTA}/post-123.jpg`;
    const FILA_COMO_FOTO = `${CONTA}/bonus-fila/${u(6)}.png`;
    const arte = {
      conta: CONTA,
      imagens: { "1": { caminho: `99999/bonus-foto/${u(7)}.jpg`, versao: "v" } },
      publicacao: publicacao([OUTRA, DO_PUBLICAR, FILA_COMO_FOTO, FILA_1]),
    };
    expect(caminhosDoCarrossel(arte, 5, CONTA)).toEqual([FILA_1]);
  });

  it("sem conta, sem imagens e sem publicação: nada", () => {
    expect(caminhosDoCarrossel({}, 5, null)).toEqual([]);
    expect(caminhosDoCarrossel({ conta: CONTA }, 5, CONTA)).toEqual([]);
  });

  it("a publicação estranha não apaga nada da fila", () => {
    expect(caminhosDoCarrossel({ conta: CONTA, publicacao: { chave: "k" } }, 5, CONTA)).toEqual([]);
  });
});
