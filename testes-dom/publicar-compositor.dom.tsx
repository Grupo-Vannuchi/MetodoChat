import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import Enviador from "@/app/publicar/enviador";
import { lerEnvios, limparEnvios } from "@/app/publicar/envios";
import {
  TEMPO_PARA_MEDIR_VIDEO_EM_MS,
  navegadorDeVerdade,
  subirComProgresso,
  type Medidas,
  type Navegador,
} from "@/app/publicar/navegador";
import {
  geometriaDoEnquadramento,
  textoDaRecusaDaPublicacao,
  textoDaRecusaDaTela,
  textoDoProblemaDaLegenda,
  textoDoProblemaDaSaida,
  textoDoProblemaDoPrimeiroSlide,
} from "@/lib/publicacao";

// O COMPOSITOR DO /publicar (spec 2026-10-19-enquadrar-imagens): a proporção, a lista com a miniatura,
// o vermelho, as travas antes de subir, e o envio NO CLIQUE, com a trava contra o clique duplo (achado
// 107), a action chamada uma vez com os caminhos da subida (achado 108) e com tudo o que o formulário
// tinha no clique (achado 115), e a subida que para quando a tela sai (achado 116). O jsdom não tem
// `canvas`, `createImageBitmap` nem `URL.createObjectURL`, então o navegador é falso, como as actions
// falsas do gerador. A action também é falsa: a de verdade termina em `redirect`, e o que isso faz foi
// medido numa sonda (ver o cabeçalho do compositor).

const MIB = 1024 * 1024;
const PASTA = "17841400000000001";

type Falso = {
  nav: Navegador;
  assinados: string[];
  enquadrados: { nome: string; desenho: unknown }[];
  /** Os sinais que chegaram à subida e ao pedido da assinatura. */
  sinais: AbortSignal[];
  sinaisDaAssinatura: AbortSignal[];
  soltos: string[];
  /** A pasta dos caminhos que a assinatura devolve: muda com a conta. */
  pasta: string;
  /** Solta a assinatura segurada (`segurarAssinatura`), que ignora o sinal de propósito. */
  soltarAssinatura: () => void;
};

function navegadorFalso(
  medidas: Record<string, Medidas>,
  opcoes: {
    falharUmaVez?: string[];
    pendurar?: boolean;
    segurarAssinatura?: boolean;
    medirPendurado?: string[];
    antesDeSubir?: () => void;
    /** A orientação EXIF de cada arquivo; quem não está aqui tem 1. */
    orientacoes?: Record<string, number>;
  } = {}
): Falso {
  const falhar = new Set(opcoes.falharUmaVez ?? []);
  const jpg = (nome: string) => nome.replace(/\.\w+$/, ".jpg");
  const f: Falso = {
    nav: undefined as unknown as Navegador,
    assinados: [],
    enquadrados: [],
    sinais: [],
    sinaisDaAssinatura: [],
    soltos: [],
    pasta: PASTA,
    soltarAssinatura: () => {},
  };
  f.nav = {
    criarEndereco: (a) => `blob:${a.name}`,
    soltarEndereco: (e) => {
      f.soltos.push(e);
    },
    medir: (a) => (opcoes.medirPendurado?.includes(a.name) ? new Promise<Medidas>(() => {}) : Promise.resolve(medidas[a.name] ?? {})),
    lerOrientacao: async (a) => opcoes.orientacoes?.[a.name] ?? 1,
    enquadrar: async (a, desenho) => {
      f.enquadrados.push({ nome: a.name, desenho });
      return new File(["jpeg"], jpg(a.name), { type: "image/jpeg" });
    },
    converter: async (a) => new File(["jpeg"], jpg(a.name), { type: "image/jpeg" }),
    assinar: async (p, sinal) => {
      f.sinaisDaAssinatura.push(sinal);
      if (opcoes.segurarAssinatura) {
        await new Promise<void>((ok) => {
          f.soltarAssinatura = ok;
        });
      }
      f.assinados.push(p.nome);
      return { ok: true, caminho: `${f.pasta}/${p.nome}`, url: `https://bucket.test/${p.nome}` };
    },
    subir: async (_url, arquivo, aoAndar, sinal) => {
      f.sinais.push(sinal);
      opcoes.antesDeSubir?.();
      if (opcoes.pendurar) {
        return new Promise<void>((_ok, nao) => sinal.addEventListener("abort", () => nao(new Error("O envio foi interrompido."))));
      }
      if (falhar.delete(arquivo.name)) throw new Error("A conexão caiu durante o envio.");
      aoAndar(arquivo.size, arquivo.size);
    },
  };
  return f;
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

// AS OPÇÕES DO REELS COM OS MESMOS NOMES da página (`app/publicar/novo/page.tsx`): a action os lê
// (`app/publicar/actions.ts`), e o caso do achado 115 confere que eles chegam.
const OPCOES_DO_REELS = (
  <fieldset>
    <label>
      <input type="checkbox" name="compartilhar_no_feed" value="1" defaultChecked /> Mostrar também no feed
    </label>
    <label htmlFor="nome_do_audio">Nome do áudio</label>
    <input id="nome_do_audio" name="nome_do_audio" type="text" />
  </fieldset>
);

function renderizar(f: Falso, opcoes: { opcoesDoReels?: ReactNode } = {}) {
  const acao = vi.fn(async (_dados: FormData) => {});
  const elemento = (pasta: string) => (
    <Enviador
      teto={50 * MIB}
      pasta={pasta}
      acao={acao}
      navegador={f.nav}
      quando={QUANDO}
      opcoesDoReels={opcoes.opcoesDoReels ?? null}
      rodape={<p>rodapé</p>}
    />
  );
  const r = render(elemento(PASTA));
  /** A troca de conta no seletor: a página volta com outra pasta, e o compositor fica montado. */
  const trocarDeConta = (pasta: string) => r.rerender(elemento(pasta));
  return { acao, trocarDeConta, ...r };
}

const arquivo = (nome: string, tipo: string, bytes = 1000) => new File([new Uint8Array(bytes)], nome, { type: tipo });
const botao = () => screen.getByRole("button", { name: /^(Publicar|Enviando…)$/ }) as HTMLButtonElement;
const formulario = () => botao().closest("form") as HTMLFormElement;

function escolherForma(forma: string) {
  fireEvent.change(screen.getByLabelText("Forma"), { target: { value: forma } });
}

async function escolherSemEsperar(arquivos: File[]) {
  const campo = screen.getByLabelText(/^Arquivos?$/) as HTMLInputElement;
  await act(async () => {
    fireEvent.change(campo, { target: { files: arquivos } });
  });
}

async function escolher(arquivos: File[]) {
  await escolherSemEsperar(arquivos);
  await waitFor(() => expect(screen.queryByText("Lendo o arquivo…")).toBeNull());
}

/** A data e a hora no formato do `datetime-local`, na hora local, como a pessoa digita. */
function campoLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function marcarOutraHora(daquiAMs: number) {
  fireEvent.click(screen.getByLabelText(/Publicar em outra hora/));
  const valor = campoLocal(new Date(Date.now() + daquiAMs));
  fireEvent.change(screen.getByLabelText("Data e hora"), { target: { value: valor } });
  return valor;
}

/** O `beforeunload` que o navegador dispara ao fechar a aba: `defaultPrevented` é o pedido de confirmação. */
function fecharAAba(): boolean {
  const ev = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(ev);
  return ev.defaultPrevented;
}

const MEDIDAS: Record<string, Medidas> = {
  "celular.jpg": { largura: 1080, altura: 1920 },
  "arte.jpg": { largura: 1080, altura: 1350 },
  "print.png": { largura: 1920, altura: 1080 },
  "outra.jpg": { largura: 1080, altura: 1350 },
  "terceira.jpg": { largura: 1080, altura: 1350 },
  "deitado.mp4": { largura: 1920, altura: 1080, segundos: 10 },
  "reels.mp4": { largura: 1080, altura: 1920, segundos: 30 },
  "animado.gif": { largura: 500, altura: 500 },
};

afterEach(() => {
  limparEnvios();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("a montagem, antes do clique", () => {
  it("a proporção nasce em 4:5, e escolher não sobe nada", async () => {
    const f = navegadorFalso(MEDIDAS);
    renderizar(f);
    escolherForma("carrossel");
    expect((screen.getByLabelText("4:5 (em pé)") as HTMLInputElement).checked).toBe(true);
    await escolher([arquivo("celular.jpg", "image/jpeg"), arquivo("arte.jpg", "image/jpeg")]);
    expect(f.assinados).toEqual([]);
    expect(screen.getByText("O post vai sair com 2 slides. O primeiro decide o enquadramento de todos.")).toBeTruthy();
  });

  it("cada linha tem a miniatura, os dois modos, a ordem e o remover; remover solta a miniatura", async () => {
    const f = navegadorFalso(MEDIDAS);
    renderizar(f);
    escolherForma("carrossel");
    await escolher([arquivo("celular.jpg", "image/jpeg"), arquivo("arte.jpg", "image/jpeg")]);
    const linha = screen.getByRole("listitem", { name: "celular.jpg" });
    expect(linha.querySelector("img")?.getAttribute("src")).toBe("blob:celular.jpg");
    expect(within(linha).getByRole("button", { name: "Cortar" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(within(linha).getByRole("button", { name: "Inteira, com bordas" }));
    expect(within(linha).getByRole("button", { name: "Inteira, com bordas" }).getAttribute("aria-pressed")).toBe("true");
    expect(within(linha).getByRole("button", { name: "Descer celular.jpg" })).toBeTruthy();
    fireEvent.click(within(linha).getByRole("button", { name: "Remover celular.jpg" }));
    expect(screen.queryByRole("listitem", { name: "celular.jpg" })).toBeNull();
    expect(f.soltos).toContain("blob:celular.jpg");
  });

  it("o arquivo que não serve fica vermelho, com a frase, e não conta", async () => {
    renderizar(navegadorFalso(MEDIDAS));
    escolherForma("carrossel");
    await escolher([arquivo("animado.gif", "image/gif"), arquivo("arte.jpg", "image/jpeg"), arquivo("outra.jpg", "image/jpeg")]);
    const linha = screen.getByRole("listitem", { name: "animado.gif" });
    expect(within(linha).getByText(textoDoProblemaDaSaida("tipo_nao_suportado"))).toBeTruthy();
    expect(screen.getByText(/O post vai sair com 2 slides\./)).toBeTruthy();
  });

  it("na imagem única com o único arquivo vermelho, a frase aponta a lista, e não manda escolher um arquivo", async () => {
    const f = navegadorFalso(MEDIDAS);
    const { acao } = renderizar(f);
    await escolher([arquivo("animado.gif", "image/gif")]);
    const frase = "O arquivo escolhido não serve: o motivo está na lista. Escolha outro.";
    expect(screen.getByText(frase)).toBeTruthy();
    fireEvent.click(botao());
    expect((await screen.findByRole("alert")).textContent).toBe(frase);
    expect(f.assinados).toEqual([]);
    expect(acao).not.toHaveBeenCalled();
  });

  it("no carrossel, escolher de novo acrescenta ao fim; na imagem única, troca o arquivo", async () => {
    renderizar(navegadorFalso(MEDIDAS));
    escolherForma("carrossel");
    await escolher([arquivo("arte.jpg", "image/jpeg")]);
    await escolher([arquivo("outra.jpg", "image/jpeg")]);
    expect(screen.getAllByRole("listitem").map((l) => l.getAttribute("aria-label"))).toEqual(["arte.jpg", "outra.jpg"]);
    escolherForma("imagem");
    await escolher([arquivo("arte.jpg", "image/jpeg")]);
    await escolher([arquivo("outra.jpg", "image/jpeg")]);
    expect(screen.getAllByRole("listitem").map((l) => l.getAttribute("aria-label"))).toEqual(["outra.jpg"]);
  });

  it("o aviso de quem ficou de fora some ao remover um slide", async () => {
    renderizar(navegadorFalso(MEDIDAS));
    escolherForma("carrossel");
    await escolher(Array.from({ length: 11 }, (_, i) => arquivo(`f${i}.jpg`, "image/jpeg")));
    expect(screen.getByText(/1 arquivo ficou de fora/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remover f0.jpg" }));
    expect(screen.queryByText(/ficou de fora/)).toBeNull();
  });

  it("trocar a forma esvazia a lista, sem subir nada", async () => {
    const f = navegadorFalso(MEDIDAS);
    renderizar(f);
    escolherForma("carrossel");
    await escolher([arquivo("arte.jpg", "image/jpeg"), arquivo("outra.jpg", "image/jpeg")]);
    escolherForma("reels");
    expect(screen.queryAllByRole("listitem")).toEqual([]);
    expect(f.assinados).toEqual([]);
  });
});

describe("as travas antes de subir (achado 109)", () => {
  it("um slide só no carrossel trava, com a frase da action, e nada sobe", async () => {
    const f = navegadorFalso(MEDIDAS);
    const { acao } = renderizar(f);
    escolherForma("carrossel");
    await escolher([arquivo("arte.jpg", "image/jpeg")]);
    fireEvent.click(botao());
    expect((await screen.findByRole("alert")).textContent).toContain(textoDaRecusaDaPublicacao("carrossel_curto_demais"));
    expect(f.assinados).toEqual([]);
    expect(acao).not.toHaveBeenCalled();
  });

  it("o vídeo deitado em primeiro trava, e nada sobe", async () => {
    const f = navegadorFalso(MEDIDAS);
    renderizar(f);
    escolherForma("carrossel");
    await escolher([arquivo("deitado.mp4", "video/mp4"), arquivo("arte.jpg", "image/jpeg")]);
    fireEvent.click(botao());
    const frase = textoDoProblemaDoPrimeiroSlide({ motivo: "video_fora", proporcaoProxima: null });
    expect((await screen.findByRole("alert")).textContent).toContain(frase);
    expect(f.assinados).toEqual([]);
  });

  it("a legenda que passa do limite trava antes de subir", async () => {
    const f = navegadorFalso(MEDIDAS);
    renderizar(f);
    await escolher([arquivo("arte.jpg", "image/jpeg")]);
    fireEvent.change(screen.getByLabelText("Legenda"), { target: { value: "x".repeat(2201) } });
    fireEvent.click(botao());
    expect((await screen.findByRole("alert")).textContent).toContain(textoDoProblemaDaLegenda("longa"));
    expect(f.assinados).toEqual([]);
  });

  it("'outra hora' sem a data trava antes de subir", async () => {
    const f = navegadorFalso(MEDIDAS);
    renderizar(f);
    await escolher([arquivo("arte.jpg", "image/jpeg")]);
    fireEvent.click(screen.getByLabelText(/Publicar em outra hora/));
    fireEvent.click(botao());
    expect((await screen.findByRole("alert")).textContent).toContain(textoDaRecusaDaPublicacao("data_invalida"));
    expect(f.assinados).toEqual([]);
  });

  it("o clique antes de a tela terminar de ler os arquivos espera, e nada sobe", async () => {
    const f = navegadorFalso(MEDIDAS, { medirPendurado: ["arte.jpg"] });
    const { acao } = renderizar(f);
    await escolherSemEsperar([arquivo("arte.jpg", "image/jpeg")]);
    expect(screen.getByText("Lendo o arquivo…")).toBeTruthy();
    fireEvent.click(botao());
    expect((await screen.findByRole("alert")).textContent).toBe(textoDaRecusaDaTela("lendo_arquivos"));
    expect(f.assinados).toEqual([]);
    expect(acao).not.toHaveBeenCalled();
  });
});

describe("o envio no clique", () => {
  it("dois cliques e um envio nativo do formulário dão UMA leva de assinaturas e UMA chamada da action (achado 107)", async () => {
    const f = navegadorFalso(MEDIDAS);
    const { acao } = renderizar(f);
    escolherForma("carrossel");
    await escolher([arquivo("arte.jpg", "image/jpeg"), arquivo("outra.jpg", "image/jpeg")]);
    fireEvent.click(botao());
    fireEvent.click(botao());
    fireEvent.submit(formulario());
    await waitFor(() => expect(acao).toHaveBeenCalledTimes(1));
    expect(f.assinados).toEqual(["arte.jpg", "outra.jpg"]);
  });

  // NO MESMO QUADRO, O BOTÃO AINDA NÃO ESTÁ DESABILITADO: o React só desenha o "ocupado" depois. Quem
  // segura o segundo clique aqui é a referência da trava, e não o `disabled`.
  it("dois cliques no mesmo quadro, antes de qualquer desenho, também dão uma leva só", async () => {
    const f = navegadorFalso(MEDIDAS);
    const { acao } = renderizar(f);
    escolherForma("carrossel");
    await escolher([arquivo("arte.jpg", "image/jpeg"), arquivo("outra.jpg", "image/jpeg")]);
    const b = botao();
    await act(async () => {
      b.click();
      b.click();
    });
    await waitFor(() => expect(acao).toHaveBeenCalled());
    await act(async () => {});
    expect(acao).toHaveBeenCalledTimes(1);
    expect(f.assinados).toEqual(["arte.jpg", "outra.jpg"]);
  });

  // O MESMO, COM O ENVIO NATIVO. Depois de um desenho, o "Quando" já está travado (achado 119), e um segundo
  // envio sairia sem ele, recusado pela hora: é uma segunda defesa, mas não é a trava. No mesmo quadro, nada
  // está travado ainda, e só a referência segura o segundo pedido.
  it("um clique e um envio nativo no mesmo quadro também dão uma leva só", async () => {
    const f = navegadorFalso(MEDIDAS);
    const { acao } = renderizar(f);
    escolherForma("carrossel");
    await escolher([arquivo("arte.jpg", "image/jpeg"), arquivo("outra.jpg", "image/jpeg")]);
    const b = botao();
    const form = formulario();
    await act(async () => {
      b.click();
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await waitFor(() => expect(acao).toHaveBeenCalled());
    await act(async () => {});
    expect(acao).toHaveBeenCalledTimes(1);
    expect(f.assinados).toEqual(["arte.jpg", "outra.jpg"]);
  });

  // O ENTER NÃO ENVIA ESTE FORMULÁRIO no navegador: não há botão de `submit`, e a data e o nome do áudio
  // bloqueiam o envio implícito. O envio nativo continua segurado como defesa, venha de onde vier.
  it("o envio nativo cai no mesmo caminho: o formulário não tem action, e a recusa aparece", async () => {
    const f = navegadorFalso(MEDIDAS);
    const { acao } = renderizar(f);
    expect(formulario().getAttribute("action")).toBe(null);
    fireEvent.submit(formulario());
    expect((await screen.findByRole("alert")).textContent).toContain(textoDaRecusaDaPublicacao("sem_arquivo"));
    expect(acao).not.toHaveBeenCalled();
  });

  it("a subida segue a ordem da lista, e a action recebe os caminhos nessa ordem (achado 108)", async () => {
    const f = navegadorFalso(MEDIDAS);
    const { acao } = renderizar(f);
    escolherForma("carrossel");
    await escolher([arquivo("arte.jpg", "image/jpeg"), arquivo("outra.jpg", "image/jpeg"), arquivo("terceira.jpg", "image/jpeg")]);
    fireEvent.click(screen.getByRole("button", { name: "Descer arte.jpg" }));
    fireEvent.click(botao());
    await waitFor(() => expect(acao).toHaveBeenCalledTimes(1));
    expect(f.assinados).toEqual(["outra.jpg", "arte.jpg", "terceira.jpg"]);
    const dados = acao.mock.calls[0][0];
    expect(dados.get("forma")).toBe("carrossel");
    expect(dados.get("caminhos")).toBe(`${PASTA}/outra.jpg\n${PASTA}/arte.jpg\n${PASTA}/terceira.jpg`);
  });

  // O ACHADO 115: a legenda ficava `disabled` durante a subida, e o formulário era lido depois dela. Campo
  // desabilitado não entra no `FormData`, e o post saía sem legenda. O caso digita tudo o que a action lê
  // (`app/publicar/actions.ts`) e confere que tudo chega. Ele achou também o FUSO VAZIO: o campo escondido
  // voltava ao valor inicial a cada desenho, já na produção, e foi corrigido junto (decisão do Eduardo, 19/10).
  it("a action recebe tudo o que o formulário tinha no clique: legenda, hora, fuso e as opções do reels (achado 115)", async () => {
    const f = navegadorFalso(MEDIDAS);
    const { acao } = renderizar(f, { opcoesDoReels: OPCOES_DO_REELS });
    escolherForma("reels");
    await escolher([arquivo("reels.mp4", "video/mp4")]);
    fireEvent.change(screen.getByLabelText("Legenda"), { target: { value: "Legenda de prova" } });
    const dataHora = marcarOutraHora(3 * 24 * 60 * 60 * 1000);
    fireEvent.change(screen.getByLabelText("Nome do áudio"), { target: { value: "Áudio de prova" } });
    fireEvent.click(botao());
    await waitFor(() => expect(acao).toHaveBeenCalledTimes(1));
    const dados = acao.mock.calls[0][0];
    const lidos = ["forma", "caminhos", "legenda", "quando", "data_hora", "fuso", "compartilhar_no_feed", "nome_do_audio"];
    expect(Object.fromEntries(lidos.map((k) => [k, dados.get(k)]))).toEqual({
      forma: "reels",
      caminhos: `${PASTA}/reels.mp4`,
      legenda: "Legenda de prova",
      quando: "depois",
      data_hora: dataHora,
      fuso: String(new Date().getTimezoneOffset()),
      compartilhar_no_feed: "1",
      nome_do_audio: "Áudio de prova",
    });
  });

  // O JPEG JÁ EM 4:5 IRIA CRU, mas com a orientação 6 a Meta poderia mostrá-lo deitado: ele passa pelo
  // `canvas`, que sai com a orientação aplicada.
  it("o JPEG já em 4:5 com a orientação EXIF 6 passa pelo canvas, em vez de ir como veio", async () => {
    const f = navegadorFalso(MEDIDAS, { orientacoes: { "arte.jpg": 6 } });
    const { acao } = renderizar(f);
    await escolher([arquivo("arte.jpg", "image/jpeg")]);
    fireEvent.click(botao());
    await waitFor(() => expect(acao).toHaveBeenCalledTimes(1));
    const geometria = geometriaDoEnquadramento({ largura: 1080, altura: 1350, proporcao: "4:5", modo: "cortar" });
    expect(f.enquadrados).toEqual([{ nome: "arte.jpg", desenho: geometria }]);
  });

  it("a foto em pé passa pelo canvas com a geometria; o JPEG já em 4:5 vai como veio", async () => {
    const f = navegadorFalso(MEDIDAS);
    const { acao } = renderizar(f);
    escolherForma("carrossel");
    await escolher([arquivo("celular.jpg", "image/jpeg"), arquivo("arte.jpg", "image/jpeg")]);
    fireEvent.click(botao());
    await waitFor(() => expect(acao).toHaveBeenCalledTimes(1));
    const geometria = geometriaDoEnquadramento({ largura: 1080, altura: 1920, proporcao: "4:5", modo: "cortar" });
    expect(f.enquadrados).toEqual([{ nome: "celular.jpg", desenho: geometria }]);
  });

  it("o caminho só fica guardado depois do 2xx: a falha para tudo, e o novo clique só sobe o que faltou", async () => {
    const f = navegadorFalso(MEDIDAS, { falharUmaVez: ["outra.jpg"] });
    const { acao } = renderizar(f);
    escolherForma("carrossel");
    await escolher([arquivo("arte.jpg", "image/jpeg"), arquivo("outra.jpg", "image/jpeg"), arquivo("terceira.jpg", "image/jpeg")]);
    fireEvent.click(botao());
    expect((await screen.findByRole("alert")).textContent).toContain("O envio de 2/3 outra.jpg não foi.");
    expect(acao).not.toHaveBeenCalled();
    await waitFor(() => expect(botao().disabled).toBe(false));
    fireEvent.click(botao());
    await waitFor(() => expect(acao).toHaveBeenCalledTimes(1));
    expect(f.assinados).toEqual(["arte.jpg", "outra.jpg", "outra.jpg", "terceira.jpg"]);
    expect(acao.mock.calls[0][0].get("caminhos")).toBe(`${PASTA}/arte.jpg\n${PASTA}/outra.jpg\n${PASTA}/terceira.jpg`);
  });

  it("mudar o modo de um slide que já subiu descarta o caminho dele, e o novo clique o sobe de novo", async () => {
    const f = navegadorFalso(MEDIDAS, { falharUmaVez: ["outra.jpg"] });
    const { acao } = renderizar(f);
    escolherForma("carrossel");
    await escolher([arquivo("celular.jpg", "image/jpeg"), arquivo("outra.jpg", "image/jpeg")]);
    fireEvent.click(botao());
    await screen.findByRole("alert");
    await waitFor(() => expect(botao().disabled).toBe(false));
    const linha = screen.getByRole("listitem", { name: "celular.jpg" });
    fireEvent.click(within(linha).getByRole("button", { name: "Inteira, com bordas" }));
    fireEvent.click(botao());
    await waitFor(() => expect(acao).toHaveBeenCalledTimes(1));
    expect(f.assinados).toEqual(["celular.jpg", "outra.jpg", "celular.jpg", "outra.jpg"]);
    const inteira = geometriaDoEnquadramento({ largura: 1080, altura: 1920, proporcao: "4:5", modo: "inteira" });
    expect(f.enquadrados.map((e) => e.desenho)).toEqual([
      geometriaDoEnquadramento({ largura: 1080, altura: 1920, proporcao: "4:5", modo: "cortar" }),
      inteira,
    ]);
  });

  it("trocar de conta entre uma tentativa que falhou e a próxima sobe tudo de novo, na pasta nova", async () => {
    const f = navegadorFalso(MEDIDAS, { falharUmaVez: ["outra.jpg"] });
    const { acao, trocarDeConta } = renderizar(f);
    escolherForma("carrossel");
    await escolher([arquivo("arte.jpg", "image/jpeg"), arquivo("outra.jpg", "image/jpeg")]);
    fireEvent.click(botao());
    await screen.findByRole("alert");
    await waitFor(() => expect(botao().disabled).toBe(false));
    f.pasta = "17841400000000002";
    trocarDeConta("17841400000000002");
    fireEvent.click(botao());
    await waitFor(() => expect(acao).toHaveBeenCalledTimes(1));
    expect(f.assinados).toEqual(["arte.jpg", "outra.jpg", "arte.jpg", "outra.jpg"]);
    expect(acao.mock.calls[0][0].get("caminhos")).toBe("17841400000000002/arte.jpg\n17841400000000002/outra.jpg");
  });

  it("um caminho fora da pasta da conta recusa, sem chamar a action", async () => {
    const f = navegadorFalso(MEDIDAS);
    f.pasta = "outra-conta";
    const { acao } = renderizar(f);
    await escolher([arquivo("arte.jpg", "image/jpeg")]);
    fireEvent.click(botao());
    expect((await screen.findByRole("alert")).textContent).toBe(textoDaRecusaDaTela("conta_mudou"));
    expect(acao).not.toHaveBeenCalled();
  });

  it("a hora é conferida de novo depois da subida: a que passou durante ela recusa, sem chamar a action", async () => {
    const relogio = Date.now.bind(Date);
    let salto = 0;
    vi.spyOn(Date, "now").mockImplementation(() => relogio() + salto);
    const f = navegadorFalso(MEDIDAS, {
      antesDeSubir: () => {
        salto = 10 * 60 * 1000;
      },
    });
    const { acao } = renderizar(f);
    await escolher([arquivo("arte.jpg", "image/jpeg")]);
    marcarOutraHora(5 * 60 * 1000);
    fireEvent.click(botao());
    expect((await screen.findByRole("alert")).textContent).toBe(textoDaRecusaDaPublicacao("data_no_passado"));
    expect(f.assinados).toEqual(["arte.jpg"]);
    expect(acao).not.toHaveBeenCalled();
  });

  it("a trava solta depois da action, e a janelinha sai antes dela", async () => {
    const f = navegadorFalso(MEDIDAS);
    const { acao } = renderizar(f);
    await escolher([arquivo("arte.jpg", "image/jpeg")]);
    fireEvent.click(botao());
    await waitFor(() => expect(acao).toHaveBeenCalledTimes(1));
    expect(lerEnvios()).toEqual([]);
    await waitFor(() => expect(botao().disabled).toBe(false));
    expect(botao().textContent).toBe("Publicar");
  });

  // O ACHADO 119: o "Quando" e as opções do reels vêm prontos da página, e não travavam. No meio de um reels
  // de minutos, trocar "agora" por "outra hora" mudava a tela, e a action recebia o do clique.
  it("o Quando e as opções do reels travam durante a subida", async () => {
    const f = navegadorFalso(MEDIDAS, { pendurar: true });
    renderizar(f, { opcoesDoReels: OPCOES_DO_REELS });
    escolherForma("reels");
    await escolher([arquivo("reels.mp4", "video/mp4")]);
    const campos = () => [
      screen.getByLabelText(/Publicar agora/),
      screen.getByLabelText(/Publicar em outra hora/),
      screen.getByLabelText("Data e hora"),
      screen.getByLabelText(/Mostrar também no feed/),
      screen.getByLabelText("Nome do áudio"),
    ];
    expect(campos().map((c) => c.matches(":disabled"))).toEqual([false, false, false, false, false]);
    fireEvent.click(botao());
    await waitFor(() => expect(f.sinais).toHaveLength(1));
    expect(campos().map((c) => c.matches(":disabled"))).toEqual([true, true, true, true, true]);
  });

  it("fechar a aba no meio da subida pede confirmação; fora dela, não", async () => {
    const f = navegadorFalso(MEDIDAS, { pendurar: true });
    renderizar(f);
    await escolher([arquivo("arte.jpg", "image/jpeg")]);
    expect(fecharAAba()).toBe(false);
    fireEvent.click(botao());
    await waitFor(() => expect(f.sinais).toHaveLength(1));
    expect(fecharAAba()).toBe(true);
  });

  it("sair da tela no meio da subida interrompe, e a action não é chamada", async () => {
    const f = navegadorFalso(MEDIDAS, { pendurar: true });
    const { acao, unmount } = renderizar(f);
    await escolher([arquivo("arte.jpg", "image/jpeg")]);
    fireEvent.click(botao());
    await waitFor(() => expect(f.sinais).toHaveLength(1));
    unmount();
    expect(f.sinais[0].aborted).toBe(true);
    // O QUE A LEVA FAZ DEPOIS DE ABORTADA roda nas esperas seguintes: elas correm aqui, antes de conferir,
    // para um `catch` atrasado não ter como reescrever a frase depois do `expect`.
    await act(async () => {});
    expect(lerEnvios()[0]?.detalhe).toBe("A publicação não foi pedida.");
    expect(acao).not.toHaveBeenCalled();
  });

  it("sair da tela com a assinatura pendente interrompe o pedido, e a leva não segue quando ela responde (achado 116)", async () => {
    const f = navegadorFalso(MEDIDAS, { segurarAssinatura: true });
    const { acao, unmount } = renderizar(f);
    await escolher([arquivo("arte.jpg", "image/jpeg")]);
    fireEvent.click(botao());
    await waitFor(() => expect(f.sinaisDaAssinatura).toHaveLength(1));
    unmount();
    expect(f.sinaisDaAssinatura[0].aborted).toBe(true);
    // A ASSINATURA FALSA IGNORA O SINAL e responde depois da saída: é a leva que tem de parar.
    await act(async () => {
      f.soltarAssinatura();
    });
    await act(async () => {});
    expect(f.sinais).toEqual([]);
    expect(acao).not.toHaveBeenCalled();
    expect(lerEnvios()[0]?.detalhe).toBe("A publicação não foi pedida.");
  });
});

describe("o navegador de verdade", () => {
  /** O `createImageBitmap` de um navegador que não conhece "from-image": recusa a opção, e sem ela mede 300×400. */
  function bitmapQueRecusaAOpcao() {
    const opcoesPedidas: unknown[] = [];
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async (_a: Blob, opcoes?: ImageBitmapOptions) => {
        opcoesPedidas.push(opcoes);
        if (opcoes) throw new TypeError("opção desconhecida");
        return { width: 300, height: 400, close() {} };
      })
    );
    return opcoesPedidas;
  }

  // UM JPEG MÍNIMO COM O EXIF NA ORIENTAÇÃO 6 (Intel): SOI, um APP1 com uma entrada 0x0112 na IFD0, e EOI.
  const tiff6 = [0x49, 0x49, 0x2a, 0, 8, 0, 0, 0, 1, 0, 0x12, 0x01, 3, 0, 1, 0, 0, 0, 6, 0, 0, 0, 0, 0, 0, 0];
  const jpegGirado = () =>
    new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0, 34, 0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff6, 0xff, 0xd9])], "g.jpg", {
      type: "image/jpeg",
    });
  const jpegSemExif = () => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], "a.jpg", { type: "image/jpeg" });

  it("mede a imagem pelo bitmap com a orientação, e repete sem a opção no navegador que a recusa", async () => {
    const opcoesPedidas = bitmapQueRecusaAOpcao();
    expect(await navegadorDeVerdade.medir(jpegSemExif())).toEqual({ largura: 300, altura: 400 });
    expect(await navegadorDeVerdade.medir(arquivo("p.png", "image/png"))).toEqual({ largura: 300, altura: 400 });
    expect(opcoesPedidas).toEqual([{ imageOrientation: "from-image" }, undefined, { imageOrientation: "from-image" }, undefined]);
  });

  // O ACHADO 120: sem a opção, a rotação do EXIF não é garantida, e o JPEG em pé gravado deitado seria medido e
  // cortado deitado, e publicado assim. Ele não repete: fica sem medida, e a lista o marca como ilegível.
  it("o JPEG que precisa girar não repete sem a opção: fica sem medida, e não deitado", async () => {
    const opcoesPedidas = bitmapQueRecusaAOpcao();
    expect(await navegadorDeVerdade.lerOrientacao(jpegGirado())).toBe(6);
    expect(await navegadorDeVerdade.medir(jpegGirado())).toEqual({});
    expect(opcoesPedidas).toEqual([{ imageOrientation: "from-image" }]);
  });

  it("a orientação de um JPEG sem EXIF é 1, e a leitura que falha vale 0, sem deixar o slide lendo para sempre", async () => {
    const semExif = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], "a.jpg", { type: "image/jpeg" });
    expect(await navegadorDeVerdade.lerOrientacao(semExif)).toBe(1);
    const ilegivel = {
      type: "image/jpeg",
      slice: () => ({ arrayBuffer: () => Promise.reject(new Error("o arquivo sumiu do disco")) }),
    } as unknown as File;
    expect(await navegadorDeVerdade.lerOrientacao(ilegivel)).toBe(0);
  });

  it("o vídeo que o navegador não mede no tempo-limite fica sem medida, e o endereço é solto", async () => {
    vi.useFakeTimers();
    const soltos: string[] = [];
    const urlOriginal = { criar: URL.createObjectURL, soltar: URL.revokeObjectURL };
    URL.createObjectURL = () => "blob:video";
    URL.revokeObjectURL = (e: string) => {
      soltos.push(e);
    };
    try {
      let pronto = false;
      const medida = navegadorDeVerdade.medir(arquivo("v.mp4", "video/mp4")).then((m) => {
        pronto = true;
        return m;
      });
      await vi.advanceTimersByTimeAsync(TEMPO_PARA_MEDIR_VIDEO_EM_MS - 1);
      expect(pronto).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(await medida).toEqual({});
      expect(soltos).toEqual(["blob:video"]);
    } finally {
      URL.createObjectURL = urlOriginal.criar;
      URL.revokeObjectURL = urlOriginal.soltar;
    }
  });

  it("o pedido da assinatura leva o sinal da leva", async () => {
    const pedidos: RequestInit[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        pedidos.push(init);
        return new Response(JSON.stringify({ caminho: `${PASTA}/a.jpg`, url: "https://bucket.test/a.jpg" }), { status: 200 });
      })
    );
    const controle = new AbortController();
    const r = await navegadorDeVerdade.assinar({ forma: "imagem", nome: "a.jpg", mime: "image/jpeg", bytes: 1 }, controle.signal);
    expect(r).toEqual({ ok: true, caminho: `${PASTA}/a.jpg`, url: "https://bucket.test/a.jpg" });
    expect(pedidos[0].signal).toBe(controle.signal);
  });
});

describe("subirComProgresso: o PUT interrompível", () => {
  class XhrFalso {
    static ultimo: XhrFalso | null = null;
    upload: { onprogress: ((ev: { lengthComputable: boolean; loaded: number; total: number }) => void) | null } = { onprogress: null };
    status = 0;
    abortado = false;
    enviado = false;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onabort: (() => void) | null = null;
    open() {}
    setRequestHeader() {}
    send() {
      this.enviado = true;
      XhrFalso.ultimo = this;
    }
    abort() {
      this.abortado = true;
      this.onabort?.();
    }
  }

  const sobe = (sinal: AbortSignal, aoAndar: (enviados: number, total: number) => void = () => {}) =>
    subirComProgresso("https://bucket.test/x", new File(["x"], "x.jpg", { type: "image/jpeg" }), aoAndar, sinal);

  it("o 2xx resolve, e o progresso chega", async () => {
    vi.stubGlobal("XMLHttpRequest", XhrFalso);
    const andou: number[] = [];
    const p = sobe(new AbortController().signal, (e: number) => andou.push(e));
    XhrFalso.ultimo!.upload.onprogress!({ lengthComputable: true, loaded: 5, total: 10 });
    XhrFalso.ultimo!.status = 200;
    XhrFalso.ultimo!.onload!();
    await expect(p).resolves.toBeUndefined();
    expect(andou).toEqual([5]);
  });

  it("o 4xx rejeita com o código", async () => {
    vi.stubGlobal("XMLHttpRequest", XhrFalso);
    const p = sobe(new AbortController().signal);
    XhrFalso.ultimo!.status = 403;
    XhrFalso.ultimo!.onload!();
    await expect(p).rejects.toThrow("HTTP 403");
  });

  it("o sinal aborta o pedido, e a subida rejeita", async () => {
    vi.stubGlobal("XMLHttpRequest", XhrFalso);
    const controle = new AbortController();
    const p = sobe(controle.signal);
    controle.abort();
    await expect(p).rejects.toThrow("O envio foi interrompido.");
    expect(XhrFalso.ultimo!.abortado).toBe(true);
  });

  it("o sinal já abortado nem envia", async () => {
    vi.stubGlobal("XMLHttpRequest", XhrFalso);
    XhrFalso.ultimo = null;
    const controle = new AbortController();
    controle.abort();
    await expect(sobe(controle.signal)).rejects.toThrow("O envio foi interrompido.");
    expect(XhrFalso.ultimo).toBe(null);
  });
});
