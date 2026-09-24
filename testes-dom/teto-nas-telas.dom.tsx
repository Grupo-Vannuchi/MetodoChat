import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// AS DUAS TELAS CONTAM AS MESMAS CHANCES QUE O MOTOR — e este é o único arquivo
// que consegue provar isso.
//
// O PROBLEMA QUE ELE RESOLVE: `testes-dom/aviso-do-pedido-de-dado.dom.tsx` já
// cobrava `toContain(String(TETO_DE_TENTATIVAS))` do painel, e o comentário de
// lá dizia que assim "a tela acompanha sozinha". MEDIDO em 24/09/2026 e falso
// como guarda do dia a dia: com a constante valendo 3, um "3" digitado à mão no
// JSX passa por aquele caso inteiro — o teste lê 3 da constante, a tela mostra 3
// escrito à mão, e a cor é verde. O caso só acusaria no dia (que pode nunca
// chegar) em que alguém mudasse o teto.
//
// O QUE ESTE FAZ DE DIFERENTE: troca o teto por OUTRO número antes de a tela
// carregar. Com `TETO_DE_TENTATIVAS` valendo 7, a tela que lê a constante mostra
// 7 e a que escreve "3" à mão mostra 3 — e aí a diferença é medível. É o que
// torna verdadeira a frase "o número vem da constante, nunca escrito à mão".
//
// O NÚMERO FALSO NÃO É 3 NEM 5 DE PROPÓSITO: 3 é o teto de verdade e 5 é o
// `pedir_follow`, e um deles como fingimento faria o caso passar por coincidência
// se a tela lesse a constante errada.
//
// AS DUAS TELAS NO MESMO ARQUIVO porque a regra é UMA: o painel só aparece com o
// bloco aberto, a prévia fica sempre à vista, e as duas falam do mesmo teto. Uma
// coberta e a outra não é exatamente como a prévia ficou com a promessa velha
// por uma tarefa inteira.
//
// A TROCA É PARCIAL (`importOriginal` e espalha): `CAMPOS`, `formaDaChave`,
// `normalizarChaveLivre` e as frases continuam sendo as de verdade — quem muda é
// UM número. Trocar o módulo inteiro faria o catálogo sumir e as duas telas
// quebrariam por outro motivo, que é o jeito mais fácil de um caso destes ficar
// verde sem medir nada.
const TETO_FINGIDO = 7;

vi.mock("@/lib/campos", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/campos")>();
  return { ...real, TETO_DE_TENTATIVAS: TETO_FINGIDO };
});

// OS IMPORTS DAS TELAS VÊM DEPOIS do `vi.mock` na leitura, mas o vitest iça a
// chamada para antes de todos eles — é por isso que a prévia e o painel já
// nascem com o teto trocado.
const { default: Previa } = await import("@/app/automacoes/editor/previa");
const { default: Painel } = await import("@/app/automacoes/editor/painel");
type Configuracao = import("@/app/automacoes/editor/painel").Configuracao;
type Passo = import("@/lib/steps").Passo;

const CONFIGURACAO: Configuracao = {
  nome: "automação de teste",
  ativo: false,
  gatilho: "dm",
  palavras: ["oi"],
  correspondencia: "contains",
  post: null,
  story: null,
  entregaSemPortao: false,
};

const PEDIDO = {
  id: "b_tel007",
  tipo: "pedir_dado",
  campo: "telefone",
  texto: "Me manda seu WhatsApp 👇",
};

describe("o teto das tentativas, nas duas telas que o dono lê", () => {
  it("a marca da prévia mostra o teto da constante, e não um número escrito à mão", () => {
    render(
      <Previa
        passos={[PEDIDO as Passo]}
        gatilho="dm"
        ligacoes={[]}
        palavras={["oi"]}
        correspondencia="contains"
        post={null}
        story={null}
        selecionado={null}
      />
    );

    const marca = screen.getByText(/para aqui, mas não para sempre/i).closest("div")!;
    expect(marca.textContent).toContain(String(TETO_FINGIDO));
    // E O 3 NÃO PODE ESTAR LÁ: é o que acusa o número à mão, e é a metade que
    // nenhum outro caso desta base tem.
    expect(marca.textContent).not.toContain("3");
  });

  it("o aviso do painel mostra o mesmo teto, pela mesma razão", () => {
    render(
      <Painel
        passo={PEDIDO as never}
        indice={0}
        configuracao={CONFIGURACAO}
        editandoGatilho={false}
        problemas={[]}
        aoMudar={() => {}}
        aoApagarBotao={() => {}}
        aoMudarConfiguracao={() => {}}
        aoFechar={() => {}}
      />
    );

    const aviso = screen.getByText(/segue sem o dado/i).closest("p, div")!;
    expect(aviso.textContent).toContain(String(TETO_FINGIDO));
    expect(aviso.textContent).not.toContain("3");
  });
});
