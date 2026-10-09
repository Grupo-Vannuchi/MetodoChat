import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EditorDoCarrossel from "@/app/bonus/[id]/carrossel/[cid]/editor-do-carrossel";
import type { ImagemGeradaNaTela, PublicacaoNaTela } from "@/app/bonus/[id]/carrossel/[cid]/publicacao-na-tela";
import { urlDaArte } from "@/lib/bonus/arte-tela";
import { camposDoFormulario } from "@/lib/bonus/carrossel-texto";
import type { ConsultaDaImagem } from "@/lib/bonus/imagem-consulta";
import { urlDaConsultaDaImagem } from "@/lib/bonus/imagem-regras";
import {
  TEXTO_CONFIRA_A_GRAFIA,
  TEXTO_ESCREVA_ENTRE_ASPAS,
  TEXTO_GERANDO_A_IMAGEM,
  TEXTO_IMAGEM_GERADA,
  TEXTO_REGRAS_DA_IMAGEM,
  textoDaRecusaDaImagem,
  textoDoContador,
  type AvisoDoPedidoDeImagem,
} from "@/lib/bonus/imagem-textos";
import { ATALHOS } from "@/lib/bonus/prompt-ilustracao";

// O CRIADOR DE IMAGEM NA TELA (spec da Etapa 6, "A tela" e "Pedir e acompanhar"): o botão em cada slide com
// espaço, o campo com o estilo (adendo de 09/10), os atalhos, as regras do manual do perfil, o aviso de
// texto, o contador do dia, o pedido que volta na hora, e a consulta que acompanha até a imagem entrar no
// espaço. A action e a consulta são falsas: nada sai para a rede, e nada chama a OpenAI.

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const BONUS = "0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f";
const CARROSSEL = "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d";
const CAMINHO = `/bonus/${BONUS}/carrossel/${CARROSSEL}`;
const VALORES = {
  gancho: "Seu cliente sumiu? Não é culpa dele.",
  slide_1_titulo: "O que fazer primeiro",
  slide_1_texto: "Mande uma mensagem curta, lembrando do que ele comprou.",
  chamada: "Comente SUMIDO e receba as mensagens prontas.",
  legenda: "Quem sumiu ainda pode voltar. Comente SUMIDO que eu te mando as mensagens prontas.",
};
const CENA = "/marketing uma pessoa usando o celular numa loja de roupas";

/** As respostas da consulta, em ordem; a última se repete. */
let consultas: ConsultaDaImagem[];
let urls: string[];

beforeEach(() => {
  consultas = [];
  urls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      urls.push(String(url));
      const c = consultas.length > 1 ? consultas.shift() : (consultas[0] ?? { estado: "gerando", hoje: 4 });
      return new Response(JSON.stringify(c), { status: 200 });
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderizar(p: { gerada?: Partial<ImagemGeradaNaTela>; respostas?: AvisoDoPedidoDeImagem[]; soTexto?: number[]; travado?: string | null } = {}) {
  const pedidos: unknown[] = [];
  const salvos: string[] = [];
  const respostas = p.respostas ?? [];
  const imagemGerada: ImagemGeradaNaTela = {
    acaoDoPedido: async (pedido: unknown) => {
      pedidos.push(pedido);
      return respostas.shift() ?? { tom: "ok", texto: TEXTO_GERANDO_A_IMAGEM, em: 1, hoje: 4 };
    },
    hoje: 3,
    descricoes: {},
    gerando: [],
    ...p.gerada,
  };
  const publicacao: PublicacaoNaTela = {
    acaoDaAssinatura: async () => ({ ok: false, texto: "não devia assinar" }),
    acaoDaImagem: async () => ({ tom: "erro", texto: "não devia guardar", em: 1 }),
    acaoDaPublicacao: async () => ({ tom: "ok", texto: "Na fila.", em: 1 }),
    imagens: {},
    versoesDoTexto: ["t1", "t2", "t3"],
    travado: p.travado ?? null,
    origem: "gravada",
    arroba: "thiagovannuchi",
    estado: { texto: null, tom: null, filaId: null, livre: true },
    avisoDoCalendario: null,
    imagemGerada,
  };
  render(
    <EditorDoCarrossel
      acaoDoSlide={async (_anterior, form) => {
        salvos.push(String(form.get("parte")));
        return { tom: "ok", texto: "Slide salvo.", em: Date.now(), versao: "c2", versaoDoTexto: "t3-novo" };
      }}
      acaoDaArte={async () => null}
      acaoDaConta={async () => null}
      caminho={CAMINHO}
      carrosselId={CARROSSEL}
      palavra="SUMIDO"
      total={3}
      campos={camposDoFormulario(3)}
      valores={VALORES}
      rotuloDaConta="Thiago Vannuchi (@thiagovannuchi)"
      avisoDaConta={null}
      podeFixar={false}
      soTextoInicial={p.soTexto ?? [1]}
      versoes={["a1", "b1", "c1"]}
      pausaMs={0}
      intervaloDaConsultaMs={5}
      publicacao={publicacao}
    />
  );
  return { pedidos, salvos };
}

const card = (n: number) => screen.getAllByRole("listitem")[n - 1];
const campo = (n: number) => screen.getByLabelText(`Slide ${n}: descreva a cena`) as HTMLTextAreaElement;
const miniatura = (n: number) => screen.getByAltText(`Slide ${n} de 3`) as HTMLImageElement;
const gerar = (n: number) => within(card(n)).getByRole("button", { name: "Gerar" }) as HTMLButtonElement;

function abrir(n: number, rotulo = "Gerar imagem") {
  fireEvent.click(within(card(n)).getByRole("button", { name: rotulo }));
}

async function pedir(n: number, descricao = CENA) {
  abrir(n);
  fireEvent.change(campo(n), { target: { value: descricao } });
  await act(async () => {
    fireEvent.click(gerar(n));
  });
}

describe("o botão Gerar imagem", () => {
  it("aparece no slide com espaço, e não no só texto", () => {
    renderizar();
    expect(within(card(1)).queryByRole("button", { name: "Gerar imagem" })).toBeNull();
    expect(within(card(2)).getByRole("button", { name: "Gerar imagem" })).toBeTruthy();
    expect(within(card(3)).getByRole("button", { name: "Gerar imagem" })).toBeTruthy();
  });

  it("não aparece com o carrossel na fila", () => {
    renderizar({ travado: "Agendado: para mudar, cancele no calendário." });
    expect(screen.queryByRole("button", { name: "Gerar imagem" })).toBeNull();
  });
});

describe("o campo da cena", () => {
  it("traz os atalhos do Labs e o contador do dia", () => {
    renderizar();
    abrir(2);
    expect(campo(2)).toBeTruthy();
    for (const a of ATALHOS) expect(within(card(2)).getByText(`/${a.chave}`)).toBeTruthy();
    expect(within(card(2)).getByText(textoDoContador(3))).toBeTruthy();
  });

  // O aviso, e não o bloqueio (decisão do Eduardo no Labs em 21/09), em dois casos pelo adendo de 09/10.
  it("avisa para pôr o texto entre aspas, e depois para conferir a grafia, sem travar o botão", () => {
    renderizar();
    abrir(2);
    fireEvent.change(campo(2), { target: { value: "uma placa com o nome da loja na entrada" } });
    expect(within(card(2)).getByText(TEXTO_ESCREVA_ENTRE_ASPAS)).toBeTruthy();
    expect(gerar(2).disabled).toBe(false);
    fireEvent.change(campo(2), { target: { value: 'uma placa com "LOJA ABERTA" na entrada' } });
    expect(within(card(2)).getByText(TEXTO_CONFIRA_A_GRAFIA)).toBeTruthy();
    expect(within(card(2)).queryByText(TEXTO_ESCREVA_ENTRE_ASPAS)).toBeNull();
    fireEvent.change(campo(2), { target: { value: "uma loja de roupas cheia de gente" } });
    expect(within(card(2)).queryByText(TEXTO_CONFIRA_A_GRAFIA)).toBeNull();
  });

  it("mostra a regra do manual do perfil junto do campo", () => {
    renderizar();
    abrir(2);
    expect(within(card(2)).getByText(TEXTO_REGRAS_DA_IMAGEM)).toBeTruthy();
  });

  it("o estilo começa em Cena de cinema e vai para o começo da descrição", async () => {
    const { pedidos } = renderizar();
    abrir(2);
    expect((within(card(2)).getByRole("radio", { name: /^Cena de cinema/ }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(within(card(2)).getByRole("radio", { name: /^Ilustração conceitual/ }));
    fireEvent.change(campo(2), { target: { value: CENA } });
    await act(async () => {
      fireEvent.click(gerar(2));
    });
    expect(pedidos).toEqual([{ id: CARROSSEL, numero: 2, descricao: `/ilustracao ${CENA}` }]);
  });

  it("no teto do dia, o Gerar trava com a frase do teto", () => {
    renderizar({ gerada: { hoje: 10 } });
    abrir(2);
    expect(gerar(2).disabled).toBe(true);
    expect(within(card(2)).getByText(textoDaRecusaDaImagem({ motivo: "teto" }))).toBeTruthy();
  });

  it("o Gerar de novo volta com o estilo e a última descrição do slide", () => {
    renderizar({ gerada: { descricoes: { 2: "/comercial /showcase a primeira descrição da cena" } } });
    abrir(2, "Gerar de novo");
    expect(campo(2).value).toBe("/showcase a primeira descrição da cena");
    expect((within(card(2)).getByRole("radio", { name: /^Ambiente comercial brilhante/ }) as HTMLInputElement).checked).toBe(true);
  });
});

describe("pedir e acompanhar", () => {
  it("o pedido volta na hora, e a consulta põe a imagem no espaço com a miniatura nova", async () => {
    consultas = [
      { estado: "gerando", hoje: 4 },
      { estado: "pronta", hoje: 4, versao: "t2", versaoDaMiniatura: "b9" },
    ];
    const { pedidos } = renderizar();
    await pedir(2);
    expect(pedidos).toEqual([{ id: CARROSSEL, numero: 2, descricao: `/cinema ${CENA}` }]);
    expect(within(card(2)).getByText(TEXTO_GERANDO_A_IMAGEM)).toBeTruthy();
    await waitFor(() => expect(miniatura(2).getAttribute("src")).toBe(urlDaArte(CAMINHO, 2, "b9")));
    expect(urls[0]).toBe(urlDaConsultaDaImagem(CAMINHO, 2));
    expect(within(card(2)).getByText(TEXTO_IMAGEM_GERADA)).toBeTruthy();
    expect(within(card(2)).getByText("Trocar foto")).toBeTruthy();
    expect(within(card(2)).getByText(textoDoContador(4))).toBeTruthy();
  });

  // ACHADO 88: enquanto a imagem gera, o resto da página funciona. O pedido já voltou, e a consulta é uma
  // rota GET; nada prende o salvar de outro slide.
  it("outra action sai enquanto a imagem gera", async () => {
    const { salvos } = renderizar();
    await pedir(3);
    fireEvent.click(within(card(2)).getByRole("button", { name: "Editar" }));
    fireEvent.input(screen.getByLabelText("Slide 2: texto"), { target: { value: "Um texto novo para o slide dois, enquanto o três gera." } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Salvar slide 2" }));
    });
    expect(salvos).toEqual(["slide_2"]);
    expect(within(card(3)).getByText(TEXTO_GERANDO_A_IMAGEM)).toBeTruthy();
  });

  it("enquanto gera, os outros botões da imagem daquele slide ficam desligados", async () => {
    renderizar();
    await pedir(2);
    expect((screen.getByLabelText("Slide 2: foto para o espaço da arte") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText("Slide 2: slide pronto do Canva") as HTMLInputElement).disabled).toBe(true);
    expect(gerar(2).disabled).toBe(true);
  });

  it("a página que abre com a geração em andamento começa o card em Gerando…, e acompanha", async () => {
    consultas = [{ estado: "pronta", hoje: 3, versao: "t2", versaoDaMiniatura: "b7" }];
    renderizar({ gerada: { gerando: [2], descricoes: { 2: CENA } } });
    expect(within(card(2)).getByText(TEXTO_GERANDO_A_IMAGEM)).toBeTruthy();
    await waitFor(() => expect(miniatura(2).getAttribute("src")).toBe(urlDaArte(CAMINHO, 2, "b7")));
  });

  it("a recusa do pedido aparece com a frase, e nada é consultado", async () => {
    renderizar({ respostas: [{ tom: "erro", texto: "Descreva com um pouco mais de detalhe.", em: 2 }] });
    await pedir(2, "uma loja de roupas cheia de gente");
    expect(within(card(2)).getByText("Descreva com um pouco mais de detalhe.")).toBeTruthy();
    expect(urls).toEqual([]);
  });

  it("a falha da geração aparece com a frase, e o Gerar volta", async () => {
    consultas = [{ estado: "falhou", hoje: 4, texto: "A OpenAI recusou o pedido." }];
    renderizar();
    await pedir(2);
    await waitFor(() => expect(within(card(2)).getByText("A OpenAI recusou o pedido.")).toBeTruthy());
    expect(gerar(2).disabled).toBe(false);
  });
});
