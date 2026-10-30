import { describe, expect, it } from "vitest";
import type { ContaDoCabecalho } from "@/lib/bonus/arte-conta";
import { slidesDoTexto } from "@/lib/bonus/arte-slides";
import { cabecalhoParaVersao, urlDaArte, versoesDosSlides, type CabecalhoDaArte } from "@/lib/bonus/arte-tela";
import { capaDoCarrossel } from "@/lib/bonus/carrosseis-tela";
import type { LinhaDoCarrossel } from "@/lib/bonus/carrossel-linha";
import type { TextoDeCarrossel } from "@/lib/bonus/carrossel-texto";
import { SEM_CAPA, capaDaArte } from "@/lib/bonus/publicar-regras";

// A VERSÃO DA MINIATURA COM A CAPA (spec da Etapa 11, "Por dentro"): ligar ou desligar a capa, e trocar a
// imagem dela, trocam a miniatura do slide 1, e só ela. No slide sem a capa, a versão é a de antes da
// Etapa 11, BYTE A BYTE: os valores abaixo foram medidos na `main` em 9b0c3e6, antes da capa, e uma
// mudança neles pediria de novo todas as miniaturas que já existem. A capa é parâmetro OBRIGATÓRIO de
// `versoesDosSlides` (seis chamadas): o `tsc` recusa a chamada que a esquecer.

const TEXTO: TextoDeCarrossel = {
  tipo: "carrossel",
  titulo: "",
  gancho: "Seu cliente sumiu? Não é culpa dele.",
  slides: [{ titulo: "Um", texto: "Texto do slide." }],
  chamada: "Comente SUMIDO e receba as mensagens.",
  legenda: "x".repeat(100),
};
const SLIDES = slidesDoTexto(TEXTO);
const CAB: CabecalhoDaArte = { nome: "Thiago Vannuchi", arroba: "thiagovannuchi", foto: "https://foto", iniciais: "TV" };
const CONTA = "17841400000000001";
const UUID = "0b2f4c1e-7a9d-4e3b-9c5f-1d2e3f4a5b6c";
const FOTO = `${CONTA}/bonus-foto/${UUID}.jpg`;
const CAPA = `${CONTA}/bonus-capa/${UUID}.jpg`;
const OUTRA_CAPA = `${CONTA}/bonus-capa/0b2f4c1e-7a9d-4e3b-9c5f-1d2e3f4a5b6d.jpg`;
const PRONTO = `${CONTA}/bonus/${UUID}.jpg`;

describe("a versão sem a capa é a de antes da Etapa 11", () => {
  it("medida na main 9b0c3e6: sem nada, com o Só texto no slide 1 e com a foto no slide 1", () => {
    expect(versoesDosSlides(SLIDES, [], CAB, {}, SEM_CAPA)).toEqual(["56507cb5", "24b49f51", "17a20ad3"]);
    expect(versoesDosSlides(SLIDES, [1], CAB, {}, SEM_CAPA)).toEqual(["ad202883", "24b49f51", "17a20ad3"]);
    expect(versoesDosSlides(SLIDES, [], CAB, { 1: FOTO }, SEM_CAPA)).toEqual(["9b58f1bc", "24b49f51", "17a20ad3"]);
  });
});

describe("a versão com a capa", () => {
  const base = versoesDosSlides(SLIDES, [], CAB, {}, SEM_CAPA);
  const comCapa = versoesDosSlides(SLIDES, [], CAB, {}, { ligada: true, caminho: CAPA });

  it("ligar a capa muda só a versão do slide 1", () => {
    expect([comCapa[0] === base[0], comCapa[1] === base[1], comCapa[2] === base[2]]).toEqual([false, true, true]);
  });

  it("trocar a imagem da capa, ou ficar sem ela, muda a versão do slide 1", () => {
    const outra = versoesDosSlides(SLIDES, [], CAB, {}, { ligada: true, caminho: OUTRA_CAPA });
    const semImagem = versoesDosSlides(SLIDES, [], CAB, {}, { ligada: true, caminho: null });
    expect(new Set([comCapa[0], outra[0], semImagem[0]]).size).toBe(3);
  });

  it("a foto do espaço guardada no slide 1 não entra na versão da capa", () => {
    expect(versoesDosSlides(SLIDES, [], CAB, { 1: FOTO }, { ligada: true, caminho: CAPA })).toEqual(comCapa);
  });

  it("a capa sem imagem não é o slide de hoje com o espaço em branco", () => {
    expect(versoesDosSlides(SLIDES, [], CAB, {}, { ligada: true, caminho: null })[0]).not.toBe(base[0]);
  });

  it("o cabeçalho continua mudando a versão da capa", () => {
    const outroCab = versoesDosSlides(SLIDES, [], { ...CAB, foto: null }, {}, { ligada: true, caminho: CAPA });
    expect(outroCab[0]).not.toBe(comCapa[0]);
  });
});

// A MINIATURA DA LISTA DE CARROSSÉIS (Etapa 10): a "capa" da lista é a miniatura do slide 1, e com a capa
// da Etapa 11 ligada ela é a arte da capa, com a versão da capa. O slide pronto guardado no slide 1 não
// vale com a capa ligada (a imagem de outro jeito conta como sem imagem).
describe("a miniatura da lista com a capa", () => {
  const T0 = Date.parse("2026-10-30T12:00:00Z");
  const CONTAS: ContaDoCabecalho[] = [
    { ig_user_id: CONTA, username: "thiagovannuchi", name: "Thiago Vannuchi", profile_picture_url: "https://cdn.exemplo/foto.jpg" },
  ];
  const linha = (arte: Record<string, unknown>): LinhaDoCarrossel => ({
    id: "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d",
    bonus_id: null,
    criado_em: new Date(T0),
    total_slides: SLIDES.length,
    palavra: "SUMIDO",
    contexto: {},
    estado: "pronto",
    gerado: TEXTO,
    revisado: null,
    erro: null,
    medicao: null,
    gerado_em: new Date(T0),
    revisado_em: null,
    arte: { conta: CONTA, ...arte },
    origem: "livre",
    labs_codigo: null,
    texto_a_mao: true,
    acao_da_chamada: null,
  });
  const urlPublica = (caminho: string) => `https://bucket.exemplo/${caminho}`;
  const naLista = (arte: Record<string, unknown>) => capaDoCarrossel(linha(arte), T0, { contas: CONTAS, doCookie: undefined, urlPublica });
  const arteDaCapa = (arte: Record<string, unknown>) => {
    const l = linha(arte);
    const conta = cabecalhoParaVersao(CONTAS[0]);
    const [v] = versoesDosSlides(SLIDES, [], conta, {}, capaDaArte(l.arte, l.total_slides));
    return urlDaArte(`/carrosseis/${l.id}`, 1, v);
  };

  it("a capa com imagem é a arte da capa, com a versão da capa", () => {
    const arte = { capa: true, imagens: { "1": { caminho: CAPA, versao: "v" } } };
    expect(naLista(arte)).toBe(arteDaCapa(arte));
    expect(naLista(arte)).not.toBe(naLista({}));
  });

  it("com a capa ligada, o slide pronto guardado no slide 1 não vira a miniatura", () => {
    const arte = { capa: true, imagens: { "1": { caminho: PRONTO, versao: "v" } } };
    expect(naLista(arte)).toBe(arteDaCapa(arte));
    expect(naLista({ imagens: { "1": { caminho: PRONTO, versao: "v" } } })).toBe(urlPublica(PRONTO));
  });
});
