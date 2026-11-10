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

// O COMPOR DO POST NO LINKEDIN (docs/specs/2026-11-06-linkedin-no-perfil.md, §7; a parte 2a: uma rede por post).
// A tela escolhe a rede; no LinkedIn, a forma é "Só texto" ou "Imagem", o campo é "Texto" com o contador que conta
// como o LinkedIn (achado 212), e o clique chama a action do LinkedIn, e só ela. O navegador e as actions são
// falsos, como no teste do compositor (testes-dom/publicar-compositor.dom.tsx).

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
  render(
    <Enviador
      teto={50 * MIB}
      pasta={PASTA}
      acao={acao}
      linkedin={linkedin}
      acaoDoLinkedin={acaoDoLinkedin}
      navegador={nav}
      quando={QUANDO}
      opcoesDoReels={<p>opções do reels</p>}
      rodape={<p>rodapé</p>}
    />
  );
  return { f, acao, acaoDoLinkedin };
}

const botao = () => screen.getByRole("button", { name: /^(Publicar|Enviando…)$/ }) as HTMLButtonElement;
const campoDoTexto = () => screen.getByLabelText("Texto") as HTMLTextAreaElement;

afterEach(() => {
  limparEnvios();
  vi.restoreAllMocks();
});

describe("a rede do post", () => {
  it("sem o LinkedIn na página, a tela é só do Instagram, como antes", () => {
    renderizar(null);
    expect(screen.queryByLabelText("LinkedIn")).toBeNull();
    expect(screen.getByLabelText("Legenda")).toBeTruthy();
  });

  it("o LinkedIn desligado aparece desligado, com o motivo", () => {
    renderizar({ disponivel: false, motivo: "Esta conta não tem LinkedIn conectado." });
    expect((screen.getByLabelText("LinkedIn") as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText("Esta conta não tem LinkedIn conectado.")).toBeTruthy();
  });

  it("no LinkedIn: as formas dele, o campo Texto, nada de arquivo no só texto e nada do reels", () => {
    renderizar(LIGADO);
    fireEvent.click(screen.getByLabelText("LinkedIn"));
    const forma = screen.getByLabelText("Forma") as HTMLSelectElement;
    expect(Array.from(forma.options).map((o) => o.textContent)).toEqual(["Só texto", "Imagem"]);
    expect(campoDoTexto()).toBeTruthy();
    expect(screen.queryByLabelText(/^Arquivos?$/)).toBeNull();
    expect(screen.queryByText("opções do reels")).toBeNull();
    expect(screen.getByText(/Dra\. Ana Souza/)).toBeTruthy();
  });
});

describe("o texto do LinkedIn", () => {
  it("o contador conta como o LinkedIn conta, e diz por quê", () => {
    renderizar(LIGADO);
    fireEvent.click(screen.getByLabelText("LinkedIn"));
    fireEvent.change(campoDoTexto(), { target: { value: "Olá #mundo" } });
    expect(screen.getByText(`${tamanhoDoTextoNoLinkedin("Olá #mundo")}/3000`)).toBeTruthy();
    expect(screen.getByText(NOTA_DO_CONTADOR_DO_LINKEDIN)).toBeTruthy();
  });

  it("o texto vazio é recusado na tela, sem chamar nada", async () => {
    const { acao, acaoDoLinkedin } = renderizar(LIGADO);
    fireEvent.click(screen.getByLabelText("LinkedIn"));
    await act(async () => {
      fireEvent.click(botao());
    });
    expect(screen.getByRole("alert").textContent).toBe(textoDaRecusaNoLinkedin("texto_vazio"));
    expect(acaoDoLinkedin).not.toHaveBeenCalled();
    expect(acao).not.toHaveBeenCalled();
  });
});

describe("publicar no LinkedIn", () => {
  it("só texto: a action do LinkedIn recebe a forma, o texto, o envio e o quando, uma vez só", async () => {
    const { f, acao, acaoDoLinkedin } = renderizar(LIGADO);
    fireEvent.click(screen.getByLabelText("LinkedIn"));
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
  });

  it("imagem: sobe a imagem pelas regras da imagem do Instagram e manda o caminho", async () => {
    const { f, acao, acaoDoLinkedin } = renderizar(LIGADO);
    fireEvent.click(screen.getByLabelText("LinkedIn"));
    fireEvent.change(screen.getByLabelText("Forma"), { target: { value: "imagem" } });
    await act(async () => {
      fireEvent.change(screen.getByLabelText("Arquivo"), {
        target: { files: [new File([new Uint8Array(1000)], "arte.jpg", { type: "image/jpeg" })] },
      });
    });
    await waitFor(() => expect(screen.queryByText("Lendo o arquivo…")).toBeNull());
    fireEvent.change(campoDoTexto(), { target: { value: "Com foto" } });
    await act(async () => {
      fireEvent.click(botao());
    });
    await waitFor(() => expect(acaoDoLinkedin).toHaveBeenCalledTimes(1));
    const dados = acaoDoLinkedin.mock.calls[0][0];
    expect(dados.get("forma_linkedin")).toBe("imagem");
    expect(dados.get("caminhos")).toBe(`${PASTA}/arte.jpg`);
    expect(f.assinados).toEqual([{ forma: "imagem", nome: "arte.jpg" }]);
    expect(acao).not.toHaveBeenCalled();
  });

  it("imagem sem arquivo é recusada na tela", async () => {
    const { acaoDoLinkedin } = renderizar(LIGADO);
    fireEvent.click(screen.getByLabelText("LinkedIn"));
    fireEvent.change(screen.getByLabelText("Forma"), { target: { value: "imagem" } });
    fireEvent.change(campoDoTexto(), { target: { value: "Sem foto" } });
    await act(async () => {
      fireEvent.click(botao());
    });
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(acaoDoLinkedin).not.toHaveBeenCalled();
  });

  it("voltar ao Instagram volta a chamar a action do Instagram, com a legenda", async () => {
    const { acao, acaoDoLinkedin } = renderizar(LIGADO);
    fireEvent.click(screen.getByLabelText("LinkedIn"));
    fireEvent.click(screen.getByLabelText("Instagram"));
    expect(screen.getByLabelText("Legenda")).toBeTruthy();
    expect(screen.getByText("opções do reels")).toBeTruthy();
    await act(async () => {
      fireEvent.change(screen.getByLabelText("Arquivo"), {
        target: { files: [new File([new Uint8Array(1000)], "arte.jpg", { type: "image/jpeg" })] },
      });
    });
    await waitFor(() => expect(screen.queryByText("Lendo o arquivo…")).toBeNull());
    await act(async () => {
      fireEvent.click(botao());
    });
    await waitFor(() => expect(acao).toHaveBeenCalledTimes(1));
    expect(acaoDoLinkedin).not.toHaveBeenCalled();
  });
});
