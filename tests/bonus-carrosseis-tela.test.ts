import { describe, expect, it } from "vitest";
import { avisoDaUrl } from "@/lib/avisos";
import { resolverConta, type ContaDoCabecalho } from "@/lib/bonus/arte-conta";
import { escolhasDaArte } from "@/lib/bonus/arte-escolhas";
import { slidesDoTexto } from "@/lib/bonus/arte-slides";
import { cabecalhoParaVersao, urlDaArte, versoesDosSlides } from "@/lib/bonus/arte-tela";
import {
  ABAS,
  abaDoCarrossel,
  abaDoEndereco,
  capaDoCarrossel,
  itemDaListaDeCarrosseis,
  separarPorAba,
  urlDaAba,
  urlDepoisDeApagar,
  type AbaDosCarrosseis,
} from "@/lib/bonus/carrosseis-tela";
import type { LinhaDoCarrossel } from "@/lib/bonus/carrossel-linha";
import type { TextoDoCarrossel } from "@/lib/bonus/carrossel-texto";
import type { EstadoDaPublicacao } from "@/lib/bonus/publicar-estado";
import { fotosDaArte } from "@/lib/bonus/publicar-regras";
import { TRAVADA_MS } from "@/lib/bonus/tempos";

// O QUE A LISTA "CARROSSÉIS" MOSTRA DE CADA CARROSSEL (spec da Etapa 7, "O menu Carrosséis"; spec da
// Etapa 10, "A lista"): os de bônus e os avulsos, cada um com o endereço da página dele, a origem, a
// conta e os slides; a aba de cada um pelo estado da publicação; a ordem dentro da aba; o selo que diz o
// que importa naquela aba; e a capa, a miniatura do slide 1. A página é de servidor; quem decide é daqui.

const T0 = Date.parse("2026-10-07T12:00:00Z");
const BONUS = "0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f";
const CARROSSEL = "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d";
const CONTA = "17841400000000001";
const FOTO = `${CONTA}/bonus-foto/2b3c4d5e-6f70-4a1b-8c2d-3e4f5a6b7c8d.jpg`;
const PRONTO = `${CONTA}/bonus/3c4d5e6f-7081-4a1b-8c2d-3e4f5a6b7c8d.jpg`;
const TEXTO: TextoDoCarrossel = {
  tipo: "post",
  titulo: "Conselheiro brutalmente honesto",
  texto: "T".repeat(80),
  chamada: "Comente BRUTAL e receba.",
  legenda: "L".repeat(100),
};

function linha(troca: Partial<LinhaDoCarrossel>): LinhaDoCarrossel {
  return {
    id: CARROSSEL,
    bonus_id: null,
    criado_em: new Date(T0),
    total_slides: 5,
    palavra: "BRUTAL",
    contexto: { tipo: "livre", tema: "Produtividade", conteudo: "Um prompt." },
    estado: "pronto",
    gerado: TEXTO,
    revisado: null,
    erro: null,
    medicao: null,
    gerado_em: new Date(T0),
    revisado_em: null,
    arte: {},
    origem: "livre",
    labs_codigo: null,
    texto_a_mao: true,
    acao_da_chamada: null,
    ...troca,
  };
}

/** Os nove estados da publicação, um de cada. */
const ESTADOS: Record<EstadoDaPublicacao["tipo"], EstadoDaPublicacao> = {
  livre: { tipo: "livre" },
  agendado: { tipo: "agendado", quando: new Date("2026-10-16T13:00:00Z"), filaId: "f1" },
  publicando: { tipo: "publicando", filaId: "f2" },
  publicado: { tipo: "publicado", em: new Date("2026-10-09T18:30:00Z"), filaId: "f3" },
  falhou: { tipo: "falhou", motivo: "A Meta recusou.", filaId: "f4" },
  cancelado: { tipo: "cancelado", filaId: "f5" },
  nao_entrou: { tipo: "nao_entrou" },
  saiu_da_fila: { tipo: "saiu_da_fila" },
  desconhecido: { tipo: "desconhecido", status: "guardado" },
};

describe("o item da lista Carrosséis", () => {
  // A lista não mostra a palavra, e não passa a mostrar a ação (decisão do Eduardo em 08/10, spec da
  // Etapa 8): o item é o mesmo com e sem palavra.
  it("o item é o mesmo com e sem palavra-chave", () => {
    expect(itemDaListaDeCarrosseis(linha({ palavra: null, acao_da_chamada: "salvar" }), null, T0)).toEqual(
      itemDaListaDeCarrosseis(linha({}), null, T0)
    );
  });

  it("o do texto livre: a página do avulso, o título do texto, a origem, a conta, os slides e a data", () => {
    const item = itemDaListaDeCarrosseis(linha({ arte: { conta: "1001", arroba: "thiagovannuchi" } }), null, T0);
    expect(item).toEqual({
      id: CARROSSEL,
      href: `/carrosseis/${CARROSSEL}`,
      titulo: "Conselheiro brutalmente honesto",
      origem: "Texto livre: Produtividade",
      detalhe: "@thiagovannuchi · Carrossel de 5 slides",
      criado: "07/10/2026, 09:00",
      selos: [{ texto: "Pronto para revisar", tipo: "neutro" }],
    });
  });

  it("o do bônus do Labs, sem conta e ainda gerando: o título fica a descrição", () => {
    const item = itemDaListaDeCarrosseis(
      linha({
        origem: "labs",
        labs_codigo: "conselheiro-brutalmente-honesto",
        contexto: { tema: "Produtividade", titulo: "Conselheiro brutalmente honesto", descricao: "d", oQueResolve: "o" },
        estado: "gerando",
        gerado: null,
        texto_a_mao: false,
      }),
      null,
      T0
    );
    expect([item.href, item.titulo, item.origem, item.detalhe, item.selos]).toEqual([
      `/carrosseis/${CARROSSEL}`,
      "Carrossel de 5 slides",
      "Bônus do Labs: Conselheiro brutalmente honesto",
      "Carrossel de 5 slides",
      [{ texto: "Gerando", tipo: "neutro" }],
    ]);
  });

  it("o de bônus do Chat: a página de hoje, embaixo do bônus", () => {
    const item = itemDaListaDeCarrosseis(linha({ origem: "bonus", bonus_id: BONUS, contexto: {}, revisado_em: new Date(T0) }), null, T0);
    expect([item.href, item.origem]).toEqual([`/bonus/${BONUS}/carrossel/${CARROSSEL}`, "Bônus do Chat"]);
  });
});

describe("a aba de cada carrossel", () => {
  const ABA_DE: Record<EstadoDaPublicacao["tipo"], AbaDosCarrosseis> = {
    livre: "rascunhos",
    agendado: "agendados",
    publicando: "agendados",
    publicado: "publicados",
    falhou: "rascunhos",
    cancelado: "rascunhos",
    nao_entrou: "rascunhos",
    saiu_da_fila: "rascunhos",
    desconhecido: "rascunhos",
  };

  it.each(Object.keys(ESTADOS) as EstadoDaPublicacao["tipo"][])("%s", (tipo) => {
    expect(abaDoCarrossel(ESTADOS[tipo])).toBe(ABA_DE[tipo]);
  });

  it("o carrossel sem publicação guardada (estado nulo) é rascunho", () => {
    expect(abaDoCarrossel(null)).toBe("rascunhos");
  });

  it("as três abas, nesta ordem, com o nome e a frase da aba vazia", () => {
    expect(ABAS).toEqual([
      { aba: "rascunhos", rotulo: "Rascunhos", vazia: "Nenhum rascunho." },
      { aba: "agendados", rotulo: "Agendados", vazia: "Nenhum carrossel agendado." },
      { aba: "publicados", rotulo: "Publicados", vazia: "Nenhum carrossel publicado." },
    ]);
  });
});

describe("a aba do endereço", () => {
  it.each(["rascunhos", "agendados", "publicados"] as const)("?aba=%s abre ela", (aba) => {
    expect(abaDoEndereco(aba)).toBe(aba);
    expect(urlDaAba(aba)).toBe(`/carrosseis?aba=${aba}`);
  });

  it.each([undefined, "", "Agendados", "lixeira", ["agendados", "publicados"]])("%j abre Rascunhos", (v) => {
    expect(abaDoEndereco(v)).toBe("rascunhos");
  });
});

describe("o selo de cada aba", () => {
  const selos = (estado: EstadoDaPublicacao | null, troca: Partial<LinhaDoCarrossel> = {}) =>
    itemDaListaDeCarrosseis(linha(troca), estado, T0).selos;

  it("em Agendados: a hora em que sai, no horário de Brasília, ou o Publicando…", () => {
    expect(selos(ESTADOS.agendado)).toEqual([{ texto: "Agendado para 16/10, 10:00", tipo: "neutro" }]);
    expect(selos(ESTADOS.publicando)).toEqual([{ texto: "Publicando…", tipo: "neutro" }]);
  });

  it("em Publicados: a hora em que saiu, no horário de Brasília; sem a hora, só Publicado (achado 93)", () => {
    expect(selos(ESTADOS.publicado)).toEqual([{ texto: "Publicado em 09/10, 15:30", tipo: "ok" }]);
    expect(selos({ tipo: "publicado", em: null, filaId: "f3" })).toEqual([{ texto: "Publicado", tipo: "ok" }]);
  });

  it("em Rascunhos, o Revisado sai: o revisado nunca agendado, e o cancelado, ficam sem selo", () => {
    expect(selos(null, { revisado_em: new Date(T0) })).toEqual([]);
    expect(selos(ESTADOS.livre, { revisado_em: new Date(T0) })).toEqual([]);
    expect(selos(ESTADOS.cancelado, { revisado_em: new Date(T0) })).toEqual([]);
  });

  it("em Rascunhos, a geração que pede algo fica: Pronto para revisar, Gerando, Travou e Falhou", () => {
    expect(selos(null)).toEqual([{ texto: "Pronto para revisar", tipo: "neutro" }]);
    expect(selos(null, { estado: "gerando", gerado: null })).toEqual([{ texto: "Gerando", tipo: "neutro" }]);
    expect(selos(null, { estado: "gerando", gerado: null, criado_em: new Date(T0 - TRAVADA_MS - 1) })).toEqual([
      { texto: "Travou", tipo: "erro" },
    ]);
    expect(selos(null, { estado: "falhou", gerado: null, erro: "A IA não respondeu." })).toEqual([{ texto: "Falhou", tipo: "erro" }]);
  });

  it("em Rascunhos, a publicação que não foi ao ar: Não publicou em vermelho, e os rótulos de hoje", () => {
    const revisado = { revisado_em: new Date(T0) };
    expect(selos(ESTADOS.falhou, revisado)).toEqual([{ texto: "Não publicou", tipo: "erro" }]);
    expect(selos(ESTADOS.nao_entrou, revisado)).toEqual([{ texto: "Não entrou na fila", tipo: "atencao" }]);
    expect(selos(ESTADOS.saiu_da_fila, revisado)).toEqual([{ texto: "Saiu da fila", tipo: "atencao" }]);
    expect(selos(ESTADOS.desconhecido, revisado)).toEqual([{ texto: "Estado desconhecido", tipo: "atencao" }]);
  });

  it("os dois selos juntos: o da publicação antes do da geração", () => {
    expect(selos(ESTADOS.falhou)).toEqual([
      { texto: "Não publicou", tipo: "erro" },
      { texto: "Pronto para revisar", tipo: "neutro" },
    ]);
  });

  it("nenhum selo diz Revisado, em estado nenhum", () => {
    for (const estado of [null, ...Object.values(ESTADOS)]) {
      expect(selos(estado, { revisado_em: new Date(T0) }).map((s) => s.texto)).not.toContain("Revisado");
    }
  });
});

describe("a separação e a ordem das abas", () => {
  const H = 3_600_000;
  const entrada = (nome: string, criadoH: number, estado: EstadoDaPublicacao | null) => ({
    nome,
    linha: linha({ id: nome, criado_em: new Date(T0 + criadoH * H) }),
    estado,
  });
  const ENTRADAS = [
    entrada("velho-livre", -48, null),
    entrada("novo-livre", -1, null),
    entrada("falhou", -24, ESTADOS.falhou),
    entrada("agendado-depois", -30, { tipo: "agendado", quando: new Date(T0 + 72 * H), filaId: "a1" }),
    entrada("agendado-antes", -2, { tipo: "agendado", quando: new Date(T0 + 24 * H), filaId: "a2" }),
    entrada("publicando", -50, ESTADOS.publicando),
    entrada("publicado-velho", -10, { tipo: "publicado", em: new Date(T0 - 96 * H), filaId: "p1" }),
    entrada("publicado-sem-hora", -3, { tipo: "publicado", em: null, filaId: "p2" }),
    entrada("publicado-novo", -60, { tipo: "publicado", em: new Date(T0 - 5 * H), filaId: "p3" }),
  ];

  it("a contagem das três abas é a mesma, qualquer que seja a aba aberta", () => {
    for (const aba of ["rascunhos", "agendados", "publicados"] as const) {
      expect(separarPorAba(ENTRADAS, aba).contagem).toEqual({ rascunhos: 3, agendados: 3, publicados: 3 });
    }
  });

  it("Rascunhos: o mais novo primeiro, pela criação", () => {
    expect(separarPorAba(ENTRADAS, "rascunhos").daAba.map((e) => e.nome)).toEqual(["novo-livre", "falhou", "velho-livre"]);
  });

  it("Agendados: o Publicando antes de todos, e depois o próximo a sair", () => {
    expect(separarPorAba(ENTRADAS, "agendados").daAba.map((e) => e.nome)).toEqual(["publicando", "agendado-antes", "agendado-depois"]);
  });

  it("Publicados: o mais recente primeiro, pela hora em que saiu; o sem hora no fim (achado 93)", () => {
    expect(separarPorAba(ENTRADAS, "publicados").daAba.map((e) => e.nome)).toEqual([
      "publicado-novo",
      "publicado-velho",
      "publicado-sem-hora",
    ]);
  });

  it("a lista vazia dá zero nas três", () => {
    expect(separarPorAba([], "rascunhos")).toEqual({ contagem: { rascunhos: 0, agendados: 0, publicados: 0 }, daAba: [] });
  });
});

describe("a capa: a miniatura do slide 1, como a página do carrossel a mostra", () => {
  const CONTAS: ContaDoCabecalho[] = [
    { ig_user_id: CONTA, username: "thiagovannuchi", name: "Thiago Vannuchi", profile_picture_url: "https://cdn.exemplo/foto.jpg" },
  ];
  const urlPublica = (caminho: string) => `https://bucket.exemplo/${caminho}`;
  const capa = (troca: Partial<LinhaDoCarrossel>, publica: (c: string) => string | null = urlPublica) =>
    capaDoCarrossel(linha(troca), T0, { contas: CONTAS, doCookie: undefined, urlPublica: publica });
  /** A versão que a página do carrossel calcula para o slide 1 (revisao.tsx), com a conta do cabeçalho. */
  const versaoDaPagina = (l: LinhaDoCarrossel) => {
    const escolhas = escolhasDaArte(l.arte, l.total_slides);
    const { conta } = resolverConta(CONTAS, escolhas, undefined);
    return versoesDosSlides(slidesDoTexto(TEXTO), escolhas.soTexto, cabecalhoParaVersao(conta), fotosDaArte(l.arte, l.total_slides))[0];
  };

  it("sem imagem no slide 1: a arte do slide 1, com a versão que a página calcula", () => {
    const l = linha({ arte: { conta: CONTA, nome: "Thiago Vannuchi", arroba: "thiagovannuchi" } });
    expect(capa({ arte: l.arte })).toBe(urlDaArte(`/carrosseis/${CARROSSEL}`, 1, versaoDaPagina(l)));
  });

  it("o carrossel de bônus: a arte mora embaixo do bônus", () => {
    expect(capa({ origem: "bonus", bonus_id: BONUS, contexto: {} })).toMatch(new RegExp(`^/bonus/${BONUS}/carrossel/${CARROSSEL}/arte\\?slide=1&v=`));
  });

  it("com a foto no espaço do slide 1: a arte, com a foto na versão", () => {
    const l = linha({ arte: { conta: CONTA, imagens: { "1": { caminho: FOTO, versao: "v1" } } } });
    expect(capa({ arte: l.arte })).toBe(urlDaArte(`/carrosseis/${CARROSSEL}`, 1, versaoDaPagina(l)));
    expect(capa({ arte: l.arte })).not.toBe(capa({ arte: { conta: CONTA } }));
  });

  it("com o slide pronto do Canva no slide 1: a imagem dele", () => {
    expect(capa({ arte: { conta: CONTA, imagens: { "1": { caminho: PRONTO, versao: "v1" } } } })).toBe(urlPublica(PRONTO));
  });

  it("o slide pronto num slide 1 marcado Só texto não conta: a arte", () => {
    expect(capa({ arte: { conta: CONTA, soTexto: [1], imagens: { "1": { caminho: PRONTO, versao: "v1" } } } })).toMatch(
      /\/arte\?slide=1&v=/
    );
  });

  it("o slide pronto sem endereço público (o bucket fora do ar na montagem): a arte", () => {
    expect(capa({ arte: { conta: CONTA, imagens: { "1": { caminho: PRONTO, versao: "v1" } } } }, () => null)).toMatch(
      /\/arte\?slide=1&v=/
    );
  });

  it("o slide pronto de outro slide não muda a capa", () => {
    expect(capa({ arte: { conta: CONTA, imagens: { "2": { caminho: PRONTO, versao: "v1" } } } })).toBe(capa({ arte: { conta: CONTA } }));
  });

  it("ainda gerando, travado ou falhado: o quadro vazio (null)", () => {
    expect(capa({ estado: "gerando", gerado: null })).toBeNull();
    expect(capa({ estado: "gerando", gerado: null, criado_em: new Date(T0 - TRAVADA_MS - 1) })).toBeNull();
    expect(capa({ estado: "falhou", gerado: null, erro: "A IA não respondeu." })).toBeNull();
  });

  it("pronto, mas sem texto legível: o quadro vazio", () => {
    expect(capa({ gerado: { lixo: true } as unknown as TextoDoCarrossel })).toBeNull();
  });
});

describe("o endereço depois de apagar (achado 92)", () => {
  it("vai para Rascunhos, com o aviso em verde: sem tom=ok, o aviso sairia vermelho", () => {
    expect(urlDepoisDeApagar()).toBe("/carrosseis?aba=rascunhos&aviso=Carrossel%20apagado.&tom=ok");
  });

  it("a página lê dele a aba e o aviso verde", () => {
    const sp = new URL(urlDepoisDeApagar(), "https://chat.exemplo").searchParams;
    expect(abaDoEndereco(sp.get("aba") ?? undefined)).toBe("rascunhos");
    expect(avisoDaUrl(sp.get("aviso") ?? undefined, sp.get("tom") ?? undefined)).toEqual({ tom: "ok", texto: "Carrossel apagado." });
  });
});
