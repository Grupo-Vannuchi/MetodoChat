import { describe, expect, it } from "vitest";
import { itemDaListaDeCarrosseis } from "@/lib/bonus/carrosseis-tela";
import type { LinhaDoCarrossel } from "@/lib/bonus/carrossel-linha";
import type { TextoDoCarrossel } from "@/lib/bonus/carrossel-texto";

// O QUE A LISTA "CARROSSÉIS" MOSTRA DE CADA CARROSSEL (spec da Etapa 7, "O menu Carrosséis"): os de
// bônus e os avulsos, cada um com o endereço da página dele, a origem, a conta, os slides, o estado
// da geração e, quando há, o da publicação. A página é de servidor; quem decide é esta função.

const T0 = Date.parse("2026-10-07T12:00:00Z");
const BONUS = "0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f";
const CARROSSEL = "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d";
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

describe("o item da lista Carrosséis", () => {
  // A lista não mostra a palavra, e não passa a mostrar a ação (decisão do Eduardo em 08/10, spec da
  // Etapa 8): o item é o mesmo com e sem palavra.
  it("o item é o mesmo com e sem palavra-chave", () => {
    expect(itemDaListaDeCarrosseis(linha({ palavra: null, acao_da_chamada: "salvar" }), null, T0)).toEqual(
      itemDaListaDeCarrosseis(linha({}), null, T0)
    );
  });

  it("o do texto livre: a página do avulso, o título do texto, a origem, a conta e os slides", () => {
    const item = itemDaListaDeCarrosseis(linha({ arte: { conta: "1001", arroba: "thiagovannuchi" } }), null, T0);
    expect(item).toEqual({
      id: CARROSSEL,
      href: `/carrosseis/${CARROSSEL}`,
      titulo: "Conselheiro brutalmente honesto",
      origem: "Texto livre: Produtividade",
      detalhe: "@thiagovannuchi · Carrossel de 5 slides",
      geracao: { texto: "Pronto para revisar", tipo: "neutro" },
      publicacao: null,
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
    expect([item.href, item.titulo, item.origem, item.detalhe, item.geracao.texto]).toEqual([
      `/carrosseis/${CARROSSEL}`,
      "Carrossel de 5 slides",
      "Bônus do Labs: Conselheiro brutalmente honesto",
      "Carrossel de 5 slides",
      "Gerando",
    ]);
  });

  it("o de bônus do Chat: a página de hoje, embaixo do bônus, com o estado da publicação", () => {
    const item = itemDaListaDeCarrosseis(
      linha({ origem: "bonus", bonus_id: BONUS, contexto: {}, revisado_em: new Date(T0) }),
      { tipo: "agendado", quando: new Date(T0 + 3_600_000), filaId: "f1" },
      T0
    );
    expect([item.href, item.origem, item.geracao, item.publicacao]).toEqual([
      `/bonus/${BONUS}/carrossel/${CARROSSEL}`,
      "Bônus do Chat",
      { texto: "Revisado", tipo: "ok" },
      { texto: "Agendado", tipo: "neutro" },
    ]);
  });
});
