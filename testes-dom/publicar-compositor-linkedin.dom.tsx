import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Enviador from "@/app/publicar/enviador";
import { lerEnvios, limparEnvios } from "@/app/publicar/envios";
import type { Medidas, Navegador } from "@/app/publicar/navegador";
import {
  NOTA_DO_CARROSSEL_NO_LINKEDIN,
  NOTA_DO_CONTADOR_DO_LINKEDIN,
  tamanhoDoTextoNoLinkedin,
  textoDaRecusaNoLinkedin,
  textoDoProblemaDoCarrosselNoLinkedin,
  type DisponibilidadeDoLinkedin,
} from "@/lib/linkedin-publicacao";
import type { CabecalhoDoJpeg } from "@/lib/bonus/imagem-jpeg";
import { rotuloDaForma, rotuloDoEnvio, textoDoEnvioQueNaoFoi } from "@/lib/publicacao";
import { NOTA_DA_LEGENDA_NO_LINKEDIN, redeAceitaAForma, TEXTO_SEM_REDE } from "@/lib/redes-do-post";

// O COMPOR COM AS DUAS REDES (docs/specs/2026-11-06-linkedin-no-perfil.md, §7; a parte 2b). A tela tem as caixinhas
// "Instagram" e "LinkedIn", que começam só com o Instagram marcado (a decisão do Eduardo, 10/11). Cada forma liga e
// desliga as redes, com o motivo: o só texto é só do LinkedIn, o reels e o story não vão ao LinkedIn, e o carrossel
// vai como PDF, só com fotos (a parte 3a). Só no LinkedIn, o campo é o "Texto" da parte 2a; nas duas, a "Legenda" e o "Texto para o LinkedIn",
// opcional. O clique chama a action das redes marcadas, e só ela. O navegador e as actions são falsos, como no
// teste do compositor (testes-dom/publicar-compositor.dom.tsx).

const MIB = 1024 * 1024;
const PASTA = "17841400000000002";
const NA_MEDIDA = { largura: 1080, altura: 1350 };
const MEDIDAS: Record<string, Medidas> = {
  "arte.jpg": NA_MEDIDA,
  // O CARROSSEL DA PARTE 3a: fotos na medida exata do 4:5, que vão cruas pela regra do Instagram.
  "a.jpg": NA_MEDIDA,
  "b.jpg": NA_MEDIDA,
  "cmyk.jpg": NA_MEDIDA,
  "grande-1.jpg": NA_MEDIDA,
  "grande-2.jpg": NA_MEDIDA,
  "clipe.mp4": { largura: 1080, altura: 1920, segundos: 10 },
};

/** O cabeçalho que a tela lê com o LinkedIn marcado no carrossel: o de cor de tela, a não ser o que o caso pedir. */
const RGB: CabecalhoDoJpeg = { largura: 1080, altura: 1350, componentes: 3, precisao: 8, marcador: 0xc0 };
const CMYK: CabecalhoDoJpeg = { ...RGB, componentes: 4 };

type OpcoesDoNavegador = {
  cabecalhos?: Record<string, CabecalhoDoJpeg>;
  /** O navegador sem o leitor do cabeçalho (o método é opcional). */
  semCabecalho?: boolean;
  /** A subida destes arquivos falha uma vez. */
  falharSubidaDe?: Set<string>;
};

function navegadorFalso(opcoes: OpcoesDoNavegador = {}) {
  const f = { assinados: [] as { forma: string; nome: string }[], enquadrados: [] as string[], cabecalhosLidos: [] as string[] };
  const nav: Navegador = {
    criarEndereco: (a) => `blob:${a.name}`,
    soltarEndereco: () => {},
    medir: async (a) => MEDIDAS[a.name] ?? {},
    lerOrientacao: async () => 1,
    enquadrar: async (a) => {
      f.enquadrados.push(a.name);
      return new File(["jpeg"], a.name, { type: "image/jpeg" });
    },
    converter: async (a) => a,
    assinar: async (p) => {
      f.assinados.push({ forma: p.forma, nome: p.nome });
      return { ok: true, caminho: `${PASTA}/${p.nome.replace(/\.\w+$/, "")}.jpg`, url: `https://bucket.test/${p.nome}` };
    },
    subir: async (_url, arquivo, aoAndar) => {
      if (opcoes.falharSubidaDe?.delete(arquivo.name)) throw new Error("A conexão caiu durante o envio.");
      aoAndar(arquivo.size, arquivo.size);
    },
  };
  if (!opcoes.semCabecalho) {
    nav.lerCabecalho = async (a) => {
      f.cabecalhosLidos.push(a.name);
      return opcoes.cabecalhos?.[a.name] ?? RGB;
    };
  }
  return { f, nav };
}

const QUANDO = (
  <fieldset>
    <label>
      <input type="radio" name="quando" value="agora" defaultChecked /> Publicar agora
    </label>
    <label>
      <input type="radio" name="quando" value="depois" /> Publicar em outra hora
    </label>
    <label htmlFor="data_hora">Data e hora</label>
    <input id="data_hora" name="data_hora" type="datetime-local" />
  </fieldset>
);

const LIGADO: DisponibilidadeDoLinkedin = { disponivel: true, nome: "Dra. Ana Souza" };

function renderizar(linkedin: DisponibilidadeDoLinkedin | null, opcoes: OpcoesDoNavegador = {}) {
  const { f, nav } = navegadorFalso(opcoes);
  const acao = vi.fn(async (_dados: FormData) => {});
  const acaoDoLinkedin = vi.fn(async (_dados: FormData) => {});
  const acaoDasDuasRedes = vi.fn(async (_dados: FormData) => {});
  render(
    <Enviador
      teto={50 * MIB}
      pasta={PASTA}
      acao={acao}
      linkedin={linkedin}
      acaoDoLinkedin={acaoDoLinkedin}
      acaoDasDuasRedes={acaoDasDuasRedes}
      navegador={nav}
      quando={QUANDO}
      opcoesDoReels={<p>opções do reels</p>}
      rodape={<p>rodapé</p>}
    />
  );
  return { f, acao, acaoDoLinkedin, acaoDasDuasRedes };
}

// O BOTÃO DIZ AS REDES E O QUANDO (a parte 3a, o 215): "Publicar no Instagram", "Agendar no LinkedIn"...
const botao = () => screen.getByRole("button", { name: /^(Publicar|Agendar|Enviando…)/ }) as HTMLButtonElement;
const caixinha = (rede: "Instagram" | "LinkedIn") => screen.getByLabelText(rede) as HTMLInputElement;
const campoDoTexto = () => screen.getByLabelText("Texto") as HTMLTextAreaElement;
const campoDaLegenda = () => screen.getByLabelText("Legenda") as HTMLTextAreaElement;
const campoDoTextoProprio = () => screen.getByLabelText("Texto para o LinkedIn (opcional)") as HTMLTextAreaElement;
const escolherForma = (valor: string) => fireEvent.change(screen.getByLabelText("Forma"), { target: { value: valor } });

async function escolherAImagem() {
  await act(async () => {
    fireEvent.change(screen.getByLabelText("Arquivo"), {
      target: { files: [new File([new Uint8Array(1000)], "arte.jpg", { type: "image/jpeg" })] },
    });
  });
  await waitFor(() => expect(screen.queryByText("Lendo o arquivo…")).toBeNull());
}

/** Os arquivos do carrossel: o nome vira um JPEG de 1.000 bytes (ou um MP4, pela extensão), ou o arquivo pronto. */
async function escolherArquivos(arquivos: (string | File)[]) {
  await act(async () => {
    fireEvent.change(screen.getByLabelText("Arquivos"), {
      target: {
        files: arquivos.map((a) =>
          typeof a === "string" ? new File([new Uint8Array(1000)], a, { type: a.endsWith(".mp4") ? "video/mp4" : "image/jpeg" }) : a
        ),
      },
    });
  });
  await waitFor(() => expect(screen.queryByText("Lendo o arquivo…")).toBeNull());
}

async function clicarEmPublicar() {
  await act(async () => {
    fireEvent.click(botao());
  });
}

afterEach(() => {
  limparEnvios();
  vi.restoreAllMocks();
});

describe("as caixinhas das redes", () => {
  it("sem o LinkedIn na página, a tela é só do Instagram, como antes: sem caixinhas e sem o só texto", () => {
    renderizar(null);
    expect(screen.queryByLabelText("LinkedIn")).toBeNull();
    expect(screen.queryByLabelText("Instagram")).toBeNull();
    expect(campoDaLegenda()).toBeTruthy();
    const forma = screen.getByLabelText("Forma") as HTMLSelectElement;
    expect(Array.from(forma.options).map((o) => o.value)).toEqual(["imagem", "carrossel", "reels", "story"]);
  });

  it("com o LinkedIn ligado, começam só com o Instagram marcado, e a tela diz em qual perfil o LinkedIn sai", () => {
    renderizar(LIGADO);
    expect(caixinha("Instagram").checked).toBe(true);
    expect(caixinha("LinkedIn").checked).toBe(false);
    expect(caixinha("LinkedIn").disabled).toBe(false);
    expect(screen.getByText(/No LinkedIn, o post sai no perfil de Dra\. Ana Souza\./)).toBeTruthy();
    expect(campoDaLegenda()).toBeTruthy();
  });

  it("o LinkedIn desligado (sem conexão) aparece desligado, com o motivo, e não há o só texto", () => {
    renderizar({ disponivel: false, motivo: "Esta conta não tem LinkedIn conectado." });
    expect(caixinha("LinkedIn").disabled).toBe(true);
    expect(caixinha("LinkedIn").checked).toBe(false);
    expect(screen.getByText("Esta conta não tem LinkedIn conectado.")).toBeTruthy();
    const forma = screen.getByLabelText("Forma") as HTMLSelectElement;
    expect(Array.from(forma.options).map((o) => o.value)).not.toContain("texto");
  });

  it("o reels e o story desligam e desmarcam o LinkedIn, com o motivo da forma; o carrossel não (a parte 3a)", () => {
    renderizar(LIGADO);
    fireEvent.click(caixinha("LinkedIn"));
    expect(caixinha("LinkedIn").checked).toBe(true);
    escolherForma("carrossel");
    expect(caixinha("LinkedIn").disabled).toBe(false);
    expect(caixinha("LinkedIn").checked).toBe(true);
    for (const forma of ["reels", "story"] as const) {
      escolherForma(forma);
      expect(caixinha("LinkedIn").disabled).toBe(true);
      expect(caixinha("LinkedIn").checked).toBe(false);
      expect(screen.getByText(redeAceitaAForma("linkedin", forma) as string)).toBeTruthy();
      expect(caixinha("Instagram").checked).toBe(true);
    }
    // VOLTAR À IMAGEM NÃO REMARCA O LINKEDIN SOZINHO: o post sai público no perfil pessoal, e só vai quem marcar.
    escolherForma("imagem");
    expect(caixinha("LinkedIn").disabled).toBe(false);
    expect(caixinha("LinkedIn").checked).toBe(false);
  });

  it("o só texto desliga o Instagram, com o motivo, e não tem arquivo", () => {
    renderizar(LIGADO);
    const forma = screen.getByLabelText("Forma") as HTMLSelectElement;
    expect(Array.from(forma.options).map((o) => o.textContent)).toEqual([
      rotuloDaForma("imagem"),
      rotuloDaForma("carrossel"),
      rotuloDaForma("reels"),
      rotuloDaForma("story"),
      "Só texto",
    ]);
    escolherForma("texto");
    expect(caixinha("Instagram").disabled).toBe(true);
    expect(caixinha("Instagram").checked).toBe(false);
    expect(screen.getByText(redeAceitaAForma("instagram", "texto") as string)).toBeTruthy();
    expect(screen.queryByLabelText(/^Arquivos?$/)).toBeNull();
  });

  it("sem nenhuma rede marcada, o clique é recusado na tela, sem chamar nada", async () => {
    const { acao, acaoDoLinkedin, acaoDasDuasRedes } = renderizar(LIGADO);
    fireEvent.click(caixinha("Instagram"));
    await clicarEmPublicar();
    expect(screen.getByRole("alert").textContent).toBe(TEXTO_SEM_REDE);
    expect(acao).not.toHaveBeenCalled();
    expect(acaoDoLinkedin).not.toHaveBeenCalled();
    expect(acaoDasDuasRedes).not.toHaveBeenCalled();
  });
});

describe("só no Instagram (o padrão)", () => {
  it("o clique chama a action do Instagram, com a legenda, e as opções do reels aparecem", async () => {
    const { acao, acaoDoLinkedin, acaoDasDuasRedes } = renderizar(LIGADO);
    expect(screen.getByText("opções do reels")).toBeTruthy();
    await escolherAImagem();
    fireEvent.change(campoDaLegenda(), { target: { value: "Só no Instagram" } });
    await clicarEmPublicar();
    await waitFor(() => expect(acao).toHaveBeenCalledTimes(1));
    expect(acao.mock.calls[0][0].get("forma")).toBe("imagem");
    expect(String(acao.mock.calls[0][0].get("legenda"))).toBe("Só no Instagram");
    expect(acaoDoLinkedin).not.toHaveBeenCalled();
    expect(acaoDasDuasRedes).not.toHaveBeenCalled();
  });
});

describe("só no LinkedIn", () => {
  function soNoLinkedin() {
    fireEvent.click(caixinha("LinkedIn"));
    fireEvent.click(caixinha("Instagram"));
  }

  it("o campo é o Texto, com o contador que conta como o LinkedIn, e as opções do reels somem", () => {
    renderizar(LIGADO);
    soNoLinkedin();
    expect(screen.queryByLabelText("Legenda")).toBeNull();
    expect(screen.queryByText("opções do reels")).toBeNull();
    fireEvent.change(campoDoTexto(), { target: { value: "Olá #mundo" } });
    expect(screen.getByText(`${tamanhoDoTextoNoLinkedin("Olá #mundo")}/3000`)).toBeTruthy();
    expect(screen.getByText(NOTA_DO_CONTADOR_DO_LINKEDIN)).toBeTruthy();
  });

  it("o texto vazio é recusado na tela, sem chamar nada", async () => {
    const { acao, acaoDoLinkedin } = renderizar(LIGADO);
    soNoLinkedin();
    escolherForma("texto");
    await clicarEmPublicar();
    expect(screen.getByRole("alert").textContent).toBe(textoDaRecusaNoLinkedin("texto_vazio"));
    expect(acaoDoLinkedin).not.toHaveBeenCalled();
    expect(acao).not.toHaveBeenCalled();
  });

  it("só texto: a action do LinkedIn recebe a forma, o texto, o envio e o quando, uma vez só", async () => {
    const { f, acao, acaoDoLinkedin, acaoDasDuasRedes } = renderizar(LIGADO);
    escolherForma("texto");
    fireEvent.click(caixinha("LinkedIn"));
    fireEvent.change(campoDoTexto(), { target: { value: "  Olá #mundo  " } });
    await act(async () => {
      fireEvent.click(botao());
      fireEvent.click(botao());
    });
    await waitFor(() => expect(acaoDoLinkedin).toHaveBeenCalledTimes(1));
    const dados = acaoDoLinkedin.mock.calls[0][0];
    expect(dados.get("forma_linkedin")).toBe("texto");
    expect(String(dados.get("texto")).trim()).toBe("Olá #mundo");
    expect(dados.get("caminhos")).toBe("");
    expect(String(dados.get("id_do_envio"))).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(dados.get("quando")).toBe("agora");
    expect(dados.get("fuso")).not.toBeNull();
    expect(f.assinados).toEqual([]);
    expect(acao).not.toHaveBeenCalled();
    expect(acaoDasDuasRedes).not.toHaveBeenCalled();
  });

  it("imagem: sobe a imagem pelas regras da imagem do Instagram e manda o caminho", async () => {
    const { f, acao, acaoDoLinkedin } = renderizar(LIGADO);
    soNoLinkedin();
    await escolherAImagem();
    fireEvent.change(campoDoTexto(), { target: { value: "Com foto" } });
    await clicarEmPublicar();
    await waitFor(() => expect(acaoDoLinkedin).toHaveBeenCalledTimes(1));
    const dados = acaoDoLinkedin.mock.calls[0][0];
    expect(dados.get("forma_linkedin")).toBe("imagem");
    expect(dados.get("caminhos")).toBe(`${PASTA}/arte.jpg`);
    expect(f.assinados).toEqual([{ forma: "imagem", nome: "arte.jpg" }]);
    expect(acao).not.toHaveBeenCalled();
  });

  it("imagem sem arquivo é recusada na tela", async () => {
    const { acaoDoLinkedin } = renderizar(LIGADO);
    soNoLinkedin();
    fireEvent.change(campoDoTexto(), { target: { value: "Sem foto" } });
    await clicarEmPublicar();
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(acaoDoLinkedin).not.toHaveBeenCalled();
  });
});

describe("nas duas redes", () => {
  it("a imagem com as duas: a Legenda, o Texto para o LinkedIn opcional, a nota da legenda e o contador do texto que vai", () => {
    renderizar(LIGADO);
    fireEvent.click(caixinha("LinkedIn"));
    expect(caixinha("Instagram").checked).toBe(true);
    expect(caixinha("LinkedIn").checked).toBe(true);
    fireEvent.change(campoDaLegenda(), { target: { value: "A legenda #ig" } });
    expect(screen.getByText(NOTA_DA_LEGENDA_NO_LINKEDIN)).toBeTruthy();
    // SEM O TEXTO PRÓPRIO, o contador do LinkedIn conta a legenda, que é o que vai.
    expect(screen.getByText(`${tamanhoDoTextoNoLinkedin("A legenda #ig")}/3000`)).toBeTruthy();
    fireEvent.change(campoDoTextoProprio(), { target: { value: "Outro texto #carreira" } });
    expect(screen.getByText(`${tamanhoDoTextoNoLinkedin("Outro texto #carreira")}/3000`)).toBeTruthy();
    expect(screen.getByText("opções do reels")).toBeTruthy();
  });

  it("o clique chama a action das duas redes, e só ela, uma vez, com a imagem, a legenda, o texto próprio e o envio", async () => {
    const { f, acao, acaoDoLinkedin, acaoDasDuasRedes } = renderizar(LIGADO);
    fireEvent.click(caixinha("LinkedIn"));
    await escolherAImagem();
    fireEvent.change(campoDaLegenda(), { target: { value: "A legenda #ig" } });
    fireEvent.change(campoDoTextoProprio(), { target: { value: "Outro texto #carreira" } });
    await act(async () => {
      fireEvent.click(botao());
      fireEvent.click(botao());
    });
    await waitFor(() => expect(acaoDasDuasRedes).toHaveBeenCalledTimes(1));
    const dados = acaoDasDuasRedes.mock.calls[0][0];
    expect(dados.get("forma")).toBe("imagem");
    expect(dados.get("caminhos")).toBe(`${PASTA}/arte.jpg`);
    expect(dados.get("legenda")).toBe("A legenda #ig");
    expect(dados.get("texto_linkedin")).toBe("Outro texto #carreira");
    expect(dados.get("rede_instagram")).toBe("1");
    expect(dados.get("rede_linkedin")).toBe("1");
    expect(String(dados.get("id_do_envio"))).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(f.assinados).toEqual([{ forma: "imagem", nome: "arte.jpg" }]);
    expect(acao).not.toHaveBeenCalled();
    expect(acaoDoLinkedin).not.toHaveBeenCalled();
  });

  it("a legenda e o texto próprio vazios: o LinkedIn não teria texto, e a tela recusa antes de subir", async () => {
    const { f, acaoDasDuasRedes } = renderizar(LIGADO);
    fireEvent.click(caixinha("LinkedIn"));
    await escolherAImagem();
    await clicarEmPublicar();
    expect(screen.getByRole("alert").textContent).toBe(textoDaRecusaNoLinkedin("texto_vazio"));
    expect(f.assinados).toEqual([]);
    expect(acaoDasDuasRedes).not.toHaveBeenCalled();
  });

  it("o carrossel com as duas marcadas: as duas ficam, e o clique vai à action das duas, com a forma e as fotos na ordem", async () => {
    const { f, acao, acaoDasDuasRedes } = renderizar(LIGADO);
    fireEvent.click(caixinha("LinkedIn"));
    escolherForma("carrossel");
    expect(caixinha("LinkedIn").checked).toBe(true);
    expect(screen.getByLabelText("Texto para o LinkedIn (opcional)")).toBeTruthy();
    expect(screen.getByText(NOTA_DO_CARROSSEL_NO_LINKEDIN)).toBeTruthy();
    await escolherArquivos(["b.jpg", "a.jpg"]);
    fireEvent.change(campoDaLegenda(), { target: { value: "O carrossel #ig" } });
    await clicarEmPublicar();
    await waitFor(() => expect(acaoDasDuasRedes).toHaveBeenCalledTimes(1));
    const dados = acaoDasDuasRedes.mock.calls[0][0];
    expect(dados.get("forma")).toBe("carrossel");
    expect(dados.get("caminhos")).toBe(`${PASTA}/b.jpg\n${PASTA}/a.jpg`);
    expect(f.assinados).toEqual([
      { forma: "carrossel", nome: "b.jpg" },
      { forma: "carrossel", nome: "a.jpg" },
    ]);
    expect(acao).not.toHaveBeenCalled();
  });
});

// O CARROSSEL NO LINKEDIN (a parte 3a; scratchpad/desenho-li3.md, §6): ele vai como PDF, só com fotos, até 15 MB
// juntas. O vídeo na lista desliga o LinkedIn; com o LinkedIn marcado, o JPEG só vai cru se o PDF o leva como está
// (`vaiCruParaOLinkedin`), e o resto passa pelo canvas; o total é contado pelo que de fato sobe.
describe("o carrossel no LinkedIn (a parte 3a)", () => {
  it("só no LinkedIn: a action do LinkedIn recebe a forma carrossel e as fotos na ordem, com a nota do PDF", async () => {
    const { f, acao, acaoDoLinkedin } = renderizar(LIGADO);
    escolherForma("carrossel");
    fireEvent.click(caixinha("LinkedIn"));
    fireEvent.click(caixinha("Instagram"));
    expect(screen.getByText(NOTA_DO_CARROSSEL_NO_LINKEDIN)).toBeTruthy();
    await escolherArquivos(["b.jpg", "a.jpg"]);
    fireEvent.change(campoDoTexto(), { target: { value: "O carrossel" } });
    await clicarEmPublicar();
    await waitFor(() => expect(acaoDoLinkedin).toHaveBeenCalledTimes(1));
    const dados = acaoDoLinkedin.mock.calls[0][0];
    expect(dados.get("forma_linkedin")).toBe("carrossel");
    expect(dados.get("caminhos")).toBe(`${PASTA}/b.jpg\n${PASTA}/a.jpg`);
    expect(f.assinados.map((a) => a.forma)).toEqual(["carrossel", "carrossel"]);
    expect(acao).not.toHaveBeenCalled();
  });

  it("um vídeo no carrossel desliga e desmarca o LinkedIn, com o motivo do PDF, e tirar o vídeo não o remarca", async () => {
    renderizar(LIGADO);
    escolherForma("carrossel");
    fireEvent.click(caixinha("LinkedIn"));
    expect(caixinha("LinkedIn").checked).toBe(true);
    await escolherArquivos(["a.jpg", "clipe.mp4"]);
    expect(caixinha("LinkedIn").disabled).toBe(true);
    expect(caixinha("LinkedIn").checked).toBe(false);
    expect(screen.getByText(textoDoProblemaDoCarrosselNoLinkedin("video"))).toBeTruthy();
    expect(caixinha("Instagram").checked).toBe(true);
    // O POST SAI PÚBLICO NO PERFIL PESSOAL: tirar o vídeo liga a caixinha, mas só vai quem marcar de novo.
    fireEvent.click(screen.getByRole("button", { name: "Remover clipe.mp4" }));
    expect(caixinha("LinkedIn").disabled).toBe(false);
    expect(caixinha("LinkedIn").checked).toBe(false);
  });

  it("com o LinkedIn marcado, o JPEG que o PDF não leva como está (CMYK) passa pelo canvas, e o de cor de tela vai cru", async () => {
    const { f, acaoDasDuasRedes } = renderizar(LIGADO, { cabecalhos: { "cmyk.jpg": CMYK } });
    escolherForma("carrossel");
    fireEvent.click(caixinha("LinkedIn"));
    await escolherArquivos(["a.jpg", "cmyk.jpg"]);
    fireEvent.change(campoDaLegenda(), { target: { value: "O carrossel #ig" } });
    await clicarEmPublicar();
    await waitFor(() => expect(acaoDasDuasRedes).toHaveBeenCalledTimes(1));
    expect(f.cabecalhosLidos).toEqual(["a.jpg", "cmyk.jpg"]);
    expect(f.enquadrados).toEqual(["cmyk.jpg"]);
    expect(acaoDasDuasRedes.mock.calls[0][0].get("caminhos")).toBe(`${PASTA}/a.jpg\n${PASTA}/cmyk.jpg`);
  });

  it("sem o LinkedIn, a regra do Instagram não muda: o mesmo JPEG de 4 componentes vai cru, e o cabeçalho nem é lido", async () => {
    const { f, acao } = renderizar(LIGADO, { cabecalhos: { "cmyk.jpg": CMYK } });
    escolherForma("carrossel");
    await escolherArquivos(["a.jpg", "cmyk.jpg"]);
    fireEvent.change(campoDaLegenda(), { target: { value: "O carrossel #ig" } });
    await clicarEmPublicar();
    await waitFor(() => expect(acao).toHaveBeenCalledTimes(1));
    expect(f.cabecalhosLidos).toEqual([]);
    expect(f.enquadrados).toEqual([]);
  });

  it("o navegador que não lê o cabeçalho: com o LinkedIn marcado, toda foto passa pelo canvas", async () => {
    const { f, acaoDasDuasRedes } = renderizar(LIGADO, { semCabecalho: true });
    escolherForma("carrossel");
    fireEvent.click(caixinha("LinkedIn"));
    await escolherArquivos(["a.jpg", "b.jpg"]);
    fireEvent.change(campoDaLegenda(), { target: { value: "O carrossel #ig" } });
    await clicarEmPublicar();
    await waitFor(() => expect(acaoDasDuasRedes).toHaveBeenCalledTimes(1));
    expect(f.enquadrados).toEqual(["a.jpg", "b.jpg"]);
  });

  it("o total passa de 15 MB com o LinkedIn: a foto que passaria do teto não sobe, a lista diz por quê, e nada é publicado", async () => {
    const { f, acaoDasDuasRedes } = renderizar(LIGADO);
    escolherForma("carrossel");
    fireEvent.click(caixinha("LinkedIn"));
    // DUAS FOTOS DE 7,6 MiB, que vão cruas (até 8 MiB, na medida): 15,2 MiB juntas.
    const grande = (nome: string) => new File([new Uint8Array(Math.floor(7.6 * MIB))], nome, { type: "image/jpeg" });
    await escolherArquivos([grande("grande-1.jpg"), grande("grande-2.jpg")]);
    fireEvent.change(campoDaLegenda(), { target: { value: "O carrossel #ig" } });
    await clicarEmPublicar();
    const segunda = rotuloDoEnvio("grande-2.jpg", 1, 2);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(textoDoEnvioQueNaoFoi(segunda)));
    expect(lerEnvios().find((e) => e.nome === segunda)).toMatchObject({
      estado: "recusado",
      detalhe: textoDoProblemaDoCarrosselNoLinkedin("grande"),
    });
    expect(f.assinados).toEqual([{ forma: "carrossel", nome: "grande-1.jpg" }]);
    expect(acaoDasDuasRedes).not.toHaveBeenCalled();
  });

  it("sem o LinkedIn, as mesmas fotos grandes sobem: o teto é só do PDF", async () => {
    const { f, acao } = renderizar(LIGADO);
    escolherForma("carrossel");
    const grande = (nome: string) => new File([new Uint8Array(Math.floor(7.6 * MIB))], nome, { type: "image/jpeg" });
    await escolherArquivos([grande("grande-1.jpg"), grande("grande-2.jpg")]);
    fireEvent.change(campoDaLegenda(), { target: { value: "O carrossel #ig" } });
    await clicarEmPublicar();
    await waitFor(() => expect(acao).toHaveBeenCalledTimes(1));
    expect(f.assinados).toHaveLength(2);
  });

  it("a foto que subiu crua só para o Instagram sobe de novo pelo canvas quando o LinkedIn é marcado depois", async () => {
    const { f, acao, acaoDasDuasRedes } = renderizar(LIGADO, { cabecalhos: { "cmyk.jpg": CMYK }, falharSubidaDe: new Set(["b.jpg"]) });
    escolherForma("carrossel");
    await escolherArquivos(["cmyk.jpg", "b.jpg"]);
    fireEvent.change(campoDaLegenda(), { target: { value: "O carrossel #ig" } });
    // SÓ O INSTAGRAM: a foto CMYK sobe crua, e a segunda falha.
    await clicarEmPublicar();
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(textoDoEnvioQueNaoFoi(rotuloDoEnvio("b.jpg", 1, 2))));
    expect(f.enquadrados).toEqual([]);
    expect(acao).not.toHaveBeenCalled();
    // COM O LINKEDIN, o caminho guardado não vale: ela sobe de novo, pelo canvas.
    fireEvent.click(caixinha("LinkedIn"));
    await clicarEmPublicar();
    await waitFor(() => expect(acaoDasDuasRedes).toHaveBeenCalledTimes(1));
    expect(f.enquadrados).toEqual(["cmyk.jpg"]);
    expect(f.assinados.map((a) => a.nome)).toEqual(["cmyk.jpg", "b.jpg", "cmyk.jpg", "b.jpg"]);
  });
});

// O BOTÃO DIZ ONDE E QUANDO O POST SAI (o 215; a decisão do Eduardo de 11/11, "O botão diz as redes"): quem marcou só
// o LinkedIn lê isso no próprio clique. O "Quando" vem pronto da página, e o botão acompanha a escolha.
describe("o botão de publicar (215)", () => {
  it("diz as redes marcadas, e Agendar com a outra hora", () => {
    renderizar(LIGADO);
    expect(botao().textContent).toBe("Publicar no Instagram");
    fireEvent.click(caixinha("LinkedIn"));
    expect(botao().textContent).toBe("Publicar no Instagram e no LinkedIn");
    fireEvent.click(caixinha("Instagram"));
    expect(botao().textContent).toBe("Publicar no LinkedIn");
    fireEvent.click(screen.getByLabelText(/Publicar em outra hora/));
    expect(botao().textContent).toBe("Agendar no LinkedIn");
    fireEvent.click(screen.getByLabelText(/Publicar agora/));
    expect(botao().textContent).toBe("Publicar no LinkedIn");
  });

  it("sem o LinkedIn na página, o botão continua Publicar, como antes", () => {
    renderizar(null);
    expect(botao().textContent).toBe("Publicar");
  });
});
