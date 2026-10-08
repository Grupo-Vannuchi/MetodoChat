import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FormularioDoAvulso from "@/app/carrosseis/novo/formulario-do-avulso";
import type { AvisoDoAvulso } from "@/lib/bonus/avulso-textos";
import type { BonusDoLabs } from "@/lib/bonus/publicado";

// O "NOVO CARROSSEL" (spec da Etapa 7): de um bônus do Labs ou de um texto livre, pela IA ou escrito à
// mão. A recusa volta como estado e aparece junto do botão, e o que se escreveu fica na tela (achado
// 52). A action entra por propriedade, e aqui é uma falsa.

const BRUTAL: BonusDoLabs = {
  codigo: "conselheiro-brutalmente-honesto",
  palavra: "BRUTAL",
  titulo: "Conselheiro brutalmente honesto",
  tema: "Produtividade",
  descricao: "Um prompt que critica o seu plano sem dó.",
};
const SUMIDO: BonusDoLabs = {
  codigo: "reativar-clientes-whatsapp",
  palavra: "SUMIDO",
  titulo: "Mensagens para Reativar Clientes Sumidos no WhatsApp",
  tema: "Vendas",
  descricao: "Mensagens prontas para trazer de volta quem sumiu.",
};

function renderizar(
  respostas: AvisoDoAvulso[] = [],
  { restam = 10, falhaDaLista = null as string | null, bonus = [BRUTAL, SUMIDO], deFora = null as string | null } = {}
) {
  const recebidos: FormData[] = [];
  const acao = async (_anterior: AvisoDoAvulso | null, f: FormData) => {
    recebidos.push(f);
    return respostas.shift() ?? null;
  };
  render(<FormularioDoAvulso acao={acao} bonus={bonus} falhaDaLista={falhaDaLista} deFora={deFora} restam={restam} />);
  return recebidos;
}

const campo = (rotulo: string) => screen.getByLabelText(rotulo) as HTMLInputElement;
const escrever = (rotulo: string, valor: string) => fireEvent.change(campo(rotulo), { target: { value: valor } });
const botao = (nome: string) => screen.getByRole("button", { name: nome }) as HTMLButtonElement;
const opcoes = () => Array.from((campo("Bônus do Labs") as unknown as HTMLSelectElement).options).map((o) => o.value);
const doFormulario = (f: FormData) => Object.fromEntries([...f.entries()].filter(([, v]) => v !== ""));

async function clicar(nome: string) {
  await act(async () => {
    fireEvent.click(botao(nome));
  });
}

describe("o novo carrossel de um bônus do Labs", () => {
  it("começa no bônus do Labs, com a lista, e o escolhido mostra a palavra e o tema", () => {
    renderizar();
    expect((screen.getByLabelText("De um bônus do Labs") as HTMLInputElement).checked).toBe(true);
    expect(opcoes()).toEqual(["", BRUTAL.codigo, SUMIDO.codigo]);
    escrever("Bônus do Labs", BRUTAL.codigo);
    expect(screen.getByText("Palavra BRUTAL · Produtividade")).toBeTruthy();
  });

  it("Gerar com a IA manda a origem, o código, o destaque, o total e o jeito", async () => {
    const recebidos = renderizar();
    escrever("Bônus do Labs", BRUTAL.codigo);
    escrever("O que destacar (opcional)", "Mostre o antes e o depois.");
    escrever("Quantos slides?", "5");
    await clicar("Gerar com a IA");
    expect(recebidos.map(doFormulario)).toEqual([
      { origem: "labs", codigo: BRUTAL.codigo, destaque: "Mostre o antes e o depois.", total: "5", jeito: "ia" },
    ]);
  });

  it("a busca filtra pelo título, sem acento e sem maiúscula, e o escolhido fica na lista", () => {
    renderizar();
    escrever("Bônus do Labs", SUMIDO.codigo);
    escrever("Buscar pelo título", "CONSELHÉIRO");
    expect(opcoes()).toEqual(["", BRUTAL.codigo, SUMIDO.codigo]);
    escrever("Bônus do Labs", "");
    expect(opcoes()).toEqual(["", BRUTAL.codigo]);
  });

  it("a lista que não veio mostra a frase, e os botões ficam desligados", () => {
    renderizar([], { falhaDaLista: "Não consegui consultar o Labs agora. Recarregue a página em instantes." });
    expect(screen.getByText("Não consegui consultar o Labs agora. Recarregue a página em instantes.")).toBeTruthy();
    expect(screen.queryByLabelText("Bônus do Labs")).toBeNull();
    expect(botao("Gerar com a IA").disabled).toBe(true);
  });
});

describe("o novo carrossel de um texto livre", () => {
  it("manda o tema, a palavra e o conteúdo, e não o código", async () => {
    const recebidos = renderizar();
    fireEvent.click(screen.getByLabelText("De um texto livre"));
    expect(screen.queryByLabelText("Bônus do Labs")).toBeNull();
    escrever("Tema", "Produtividade");
    escrever("Palavra-chave", "brutal");
    escrever("Conteúdo", "Um prompt que critica o seu plano sem dó nenhum.");
    await clicar("Gerar com a IA");
    expect(recebidos.map(doFormulario)).toEqual([
      {
        origem: "livre",
        tema: "Produtividade",
        palavra: "brutal",
        conteudo: "Um prompt que critica o seu plano sem dó nenhum.",
        total: "10",
        jeito: "ia",
      },
    ]);
  });
});

describe("escrever à mão", () => {
  it("mostra os campos do número de slides escolhido, e trocar o número troca os campos", () => {
    renderizar();
    escrever("Quantos slides?", "3");
    fireEvent.click(botao("Escrever à mão"));
    expect(screen.getByLabelText("Gancho (slide 1)")).toBeTruthy();
    expect(screen.getByLabelText("Slide 2: título")).toBeTruthy();
    expect(screen.getByLabelText("Chamada (slide 3)")).toBeTruthy();
    expect(screen.queryByLabelText("Slide 3: título")).toBeNull();
    escrever("Quantos slides?", "1");
    expect(screen.getByLabelText("Texto da imagem")).toBeTruthy();
    expect(screen.queryByLabelText("Gancho (slide 1)")).toBeNull();
  });

  it("a chamada e a legenda avisam na hora quando falta a palavra do bônus escolhido, ou a digitada", () => {
    renderizar();
    escrever("Bônus do Labs", BRUTAL.codigo);
    escrever("Quantos slides?", "2");
    fireEvent.click(botao("Escrever à mão"));
    escrever("Chamada (slide 2)", "Comente e receba o prompt agora.");
    escrever("Legenda do post", "Quer ouvir a verdade? Comente BRUTAL.");
    expect(screen.getAllByText("Falta a palavra BRUTAL: sem ela, quem comentar não recebe o bônus.")).toHaveLength(1);
    fireEvent.click(screen.getByLabelText("De um texto livre"));
    escrever("Palavra-chave", "conselho");
    expect(screen.getAllByText("Falta a palavra CONSELHO: sem ela, quem comentar não recebe o bônus.")).toHaveLength(2);
  });

  it("Criar com este texto manda o jeito à mão e os campos; numa recusa, tudo fica e o motivo aparece", async () => {
    const recebidos = renderizar([{ tom: "erro", texto: "Corrija antes de criar. Gancho (slide 1): precisa de pelo menos 15 caracteres.", em: 1 }]);
    escrever("Bônus do Labs", BRUTAL.codigo);
    escrever("Quantos slides?", "2");
    fireEvent.click(botao("Escrever à mão"));
    escrever("Gancho (slide 1)", "Curto.");
    escrever("Chamada (slide 2)", "Comente BRUTAL e receba o prompt.");
    escrever("Legenda do post", "Quer ouvir a verdade? Comente BRUTAL.");
    await clicar("Criar com este texto");
    expect(recebidos.map(doFormulario)).toEqual([
      {
        origem: "labs",
        codigo: BRUTAL.codigo,
        total: "2",
        jeito: "mao",
        gancho: "Curto.",
        chamada: "Comente BRUTAL e receba o prompt.",
        legenda: "Quer ouvir a verdade? Comente BRUTAL.",
      },
    ]);
    expect(screen.getByRole("status").textContent).toContain("Gancho (slide 1): precisa de pelo menos 15 caracteres.");
    expect(campo("Gancho (slide 1)").value).toBe("Curto.");
    expect(campo("Quantos slides?").value).toBe("2");
    expect(campo("Bônus do Labs").value).toBe(BRUTAL.codigo);
  });

  it("com o limite do dia acabado, só a IA fica desligada", () => {
    renderizar([], { restam: 0 });
    expect(botao("Gerar com a IA").disabled).toBe(true);
    fireEvent.click(botao("Escrever à mão"));
    expect(botao("Criar com este texto").disabled).toBe(false);
    fireEvent.click(botao("Voltar para a IA"));
    expect(screen.queryByLabelText("Gancho (slide 1)")).toBeNull();
  });
});

// SEM PALAVRA-CHAVE (spec da Etapa 8): no texto livre, a caixa troca a palavra pela ação; o bônus do
// Labs sem palavra aparece marcado e pede a ação; os bônus que ficam de fora são contados.
describe("o novo carrossel sem palavra-chave", () => {
  const SEM_PALAVRA: BonusDoLabs = { ...SUMIDO, codigo: "bonus-sem-palavra", palavra: null, titulo: "Um bônus sem palavra" };
  const acoes = () => ["Salvar o post", "Compartilhar", "Seguir o perfil", "Comentar a opinião"].map((r) => campo(r));

  it("texto livre: a caixa esconde a palavra, pede a ação, e manda a caixa e a ação", async () => {
    const recebidos = renderizar();
    fireEvent.click(screen.getByLabelText("De um texto livre"));
    expect(screen.queryByText("O que a chamada pede")).toBeNull();
    fireEvent.click(screen.getByLabelText("Sem palavra-chave"));
    expect(screen.queryByLabelText("Palavra-chave")).toBeNull();
    expect(screen.getByText("O que a chamada pede")).toBeTruthy();
    expect(acoes().map((a) => a.checked)).toEqual([false, false, false, false]);
    escrever("Tema", "Vendas");
    escrever("Conteúdo", "Como vender sem parecer chato, em cinco passos.");
    fireEvent.click(screen.getByLabelText("Salvar o post"));
    await clicar("Gerar com a IA");
    expect(recebidos.map(doFormulario)).toEqual([
      {
        origem: "livre",
        tema: "Vendas",
        sem_palavra: "1",
        acao: "salvar",
        conteudo: "Como vender sem parecer chato, em cinco passos.",
        total: "10",
        jeito: "ia",
      },
    ]);
  });

  it("o bônus do Labs sem palavra aparece marcado, e pede a ação", async () => {
    const recebidos = renderizar([], { bonus: [BRUTAL, SEM_PALAVRA] });
    escrever("Bônus do Labs", SEM_PALAVRA.codigo);
    expect(screen.getByText("Sem palavra-chave · Vendas")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Comentar a opinião"));
    await clicar("Gerar com a IA");
    expect(recebidos.map(doFormulario)).toEqual([
      { origem: "labs", codigo: SEM_PALAVRA.codigo, acao: "comentar", total: "10", jeito: "ia" },
    ]);
  });

  it("o bônus do Labs com palavra não mostra a escolha da ação", () => {
    renderizar([], { bonus: [BRUTAL, SEM_PALAVRA] });
    escrever("Bônus do Labs", BRUTAL.codigo);
    expect(screen.queryByText("O que a chamada pede")).toBeNull();
  });

  it("a frase dos bônus que ficam de fora aparece embaixo da lista", () => {
    renderizar([], { deFora: "1 bônus do Labs não aparece: 1 sem tema." });
    expect(screen.getByText("1 bônus do Labs não aparece: 1 sem tema.")).toBeTruthy();
  });

  it("à mão, sem palavra: a chamada avisa a palavra gritada, e a legenda não pede palavra", () => {
    renderizar();
    fireEvent.click(screen.getByLabelText("De um texto livre"));
    fireEvent.click(screen.getByLabelText("Sem palavra-chave"));
    fireEvent.click(botao("Escrever à mão"));
    escrever("Chamada (slide 10)", "Comente GUIA e receba o roteiro.");
    escrever("Legenda do post", "Uma legenda que não pede palavra nenhuma, e tudo bem.");
    expect(
      screen.getByText("Tem GUIA em maiúsculas: este carrossel não tem palavra-chave, e quem comentar uma palavra não recebe nada.")
    ).toBeTruthy();
    expect(screen.queryByText(/Falta a palavra/)).toBeNull();
  });
});
