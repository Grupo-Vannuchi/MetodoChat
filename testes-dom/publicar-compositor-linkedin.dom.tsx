import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Enviador from "@/app/publicar/enviador";
import { limparEnvios } from "@/app/publicar/envios";
import type { Medidas, Navegador } from "@/app/publicar/navegador";
import {
  NOTA_DO_CONTADOR_DO_LINKEDIN,
  tamanhoDoTextoNoLinkedin,
  textoDaRecusaNoLinkedin,
  type DisponibilidadeDoLinkedin,
} from "@/lib/linkedin-publicacao";
import { rotuloDaForma } from "@/lib/publicacao";
import { NOTA_DA_LEGENDA_NO_LINKEDIN, redeAceitaAForma, TEXTO_SEM_REDE } from "@/lib/redes-do-post";

// O COMPOR COM AS DUAS REDES (docs/specs/2026-11-06-linkedin-no-perfil.md, §7; a parte 2b). A tela tem as caixinhas
// "Instagram" e "LinkedIn", que começam só com o Instagram marcado (a decisão do Eduardo, 10/11). Cada forma liga e
// desliga as redes, com o motivo: o só texto é só do LinkedIn, e o carrossel, o reels e o story não vão ao LinkedIn
// nesta entrega. Só no LinkedIn, o campo é o "Texto" da parte 2a; nas duas, a "Legenda" e o "Texto para o LinkedIn",
// opcional. O clique chama a action das redes marcadas, e só ela. O navegador e as actions são falsos, como no
// teste do compositor (testes-dom/publicar-compositor.dom.tsx).

const MIB = 1024 * 1024;
const PASTA = "17841400000000002";
const MEDIDAS: Record<string, Medidas> = { "arte.jpg": { largura: 1080, altura: 1350 } };

function navegadorFalso() {
  const f = { assinados: [] as { forma: string; nome: string }[] };
  const nav: Navegador = {
    criarEndereco: (a) => `blob:${a.name}`,
    soltarEndereco: () => {},
    medir: async (a) => MEDIDAS[a.name] ?? {},
    lerOrientacao: async () => 1,
    enquadrar: async (a) => new File(["jpeg"], a.name, { type: "image/jpeg" }),
    converter: async (a) => a,
    assinar: async (p) => {
      f.assinados.push({ forma: p.forma, nome: p.nome });
      return { ok: true, caminho: `${PASTA}/${p.nome.replace(/\.\w+$/, "")}.jpg`, url: `https://bucket.test/${p.nome}` };
    },
    subir: async (_url, arquivo, aoAndar) => {
      aoAndar(arquivo.size, arquivo.size);
    },
  };
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

function renderizar(linkedin: DisponibilidadeDoLinkedin | null) {
  const { f, nav } = navegadorFalso();
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

const botao = () => screen.getByRole("button", { name: /^(Publicar|Enviando…)$/ }) as HTMLButtonElement;
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

  it("o carrossel, o reels e o story desligam e desmarcam o LinkedIn, com o motivo da forma", () => {
    renderizar(LIGADO);
    fireEvent.click(caixinha("LinkedIn"));
    expect(caixinha("LinkedIn").checked).toBe(true);
    for (const forma of ["carrossel", "reels", "story"] as const) {
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

  it("trocar para o carrossel com as duas marcadas deixa só o Instagram, e o clique vai à action dele", async () => {
    const { acao, acaoDasDuasRedes } = renderizar(LIGADO);
    fireEvent.click(caixinha("LinkedIn"));
    escolherForma("carrossel");
    expect(caixinha("LinkedIn").checked).toBe(false);
    expect(screen.queryByLabelText("Texto para o LinkedIn (opcional)")).toBeNull();
    await act(async () => {
      fireEvent.change(screen.getByLabelText("Arquivos"), {
        target: {
          files: [
            new File([new Uint8Array(1000)], "arte.jpg", { type: "image/jpeg" }),
            new File([new Uint8Array(1000)], "arte.jpg", { type: "image/jpeg" }),
          ],
        },
      });
    });
    await waitFor(() => expect(screen.queryByText("Lendo o arquivo…")).toBeNull());
    await clicarEmPublicar();
    await waitFor(() => expect(acao).toHaveBeenCalledTimes(1));
    expect(acaoDasDuasRedes).not.toHaveBeenCalled();
  });
});
