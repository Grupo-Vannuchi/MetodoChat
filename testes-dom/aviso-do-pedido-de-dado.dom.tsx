import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Painel, { type Configuracao } from "@/app/automacoes/editor/painel";
import { TETO_DE_TENTATIVAS } from "@/lib/campos";

// O QUE A TELA PROMETE AO DONO SOBRE O PEDIDO DE DADO — e por que isto virou
// teste em vez de ficar sendo só um texto.
//
// Até a Tarefa 4 o aviso deste bloco dizia: "O fluxo espera aqui até o endereço
// chegar". A tarefa mudou exatamente isso — o motor desiste na terceira
// resposta que não serve e SEGUE sem o dado —, e o aviso continuou afirmando o
// contrário na TELA QUE O MARKETING LÊ. Esta base já trata comentário que
// afirma o que o código não faz como defeito; um aviso na tela vale mais do que
// um comentário, porque quem o lê monta a automação em cima dele.
//
// O CASO NÃO LÊ O ARQUIVO COMO TEXTO: ele RENDERIZA o painel com um bloco de
// pedido selecionado, que é o único jeito de provar que a frase certa aparece
// para o bloco certo — o mesmo painel desenha o pedido de FOLLOW, cujo aviso
// ("ninguém passa deste ponto sem seguir") continua verdadeiro e não pode ser
// trocado por este.
//
// O NÚMERO VEM DE `TETO_DE_TENTATIVAS` (lib/campos.ts), e não de um "3" escrito
// na tela: é o mesmo número que o motor conta. Mudado o teto, a tela acompanha
// sozinha — e este caso confere que ela acompanha.

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

function abrirPainelCom(passo: { tipo: string; [k: string]: unknown }) {
  render(
    <Painel
      // O bloco vem CRU do banco em produção (`passosDoBanco`,
      // app/automacoes/[id]/page.tsx afirma `Passo` sobre um `unknown`), e é
      // por isso que o `as` aqui não é folga de teste: é a mesma afirmação que
      // a rota faz.
      passo={passo as never}
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
}

describe("o aviso do bloco `pedir_dado`", () => {
  it("diz que o fluxo SEGUE sem o dado depois das chances que o motor dá", () => {
    abrirPainelCom({ tipo: "pedir_dado", campo: "email", texto: "Qual é o seu e-mail?" });

    const aviso = screen.getByText(/segue sem o dado/i);
    expect(aviso).toBeTruthy();

    // A TELA CONTA AS MESMAS CHANCES QUE O MOTOR. `TETO_DE_TENTATIVAS` conta
    // RESPOSTAS, não reperguntas (o porquê está na constante), e é esse número
    // que o dono precisa ver para saber o que sua automação faz.
    const faixa = aviso.closest("p, div") ?? aviso;
    expect(faixa.textContent).toContain(String(TETO_DE_TENTATIVAS));

    // E A PROMESSA VELHA NÃO PODE ESTAR NA TELA: "espera aqui até" era
    // literalmente o contrário do que o motor passou a fazer.
    expect(screen.queryByText(/espera aqui at[ée]/i)).toBeNull();
  });

  it("fala de DADO e de RESPOSTA, e não de endereço — o bloco não é mais só de e-mail", () => {
    // O bloco pede telefone, nome, data de nascimento e campo livre desde a
    // Tarefa 1. Um aviso que fala em "endereço" e em "e-mail nunca capturado"
    // descreve um bloco que não existe mais.
    abrirPainelCom({ tipo: "pedir_dado", campo: "telefone", texto: "Me manda seu WhatsApp 👇" });

    expect(screen.queryByText(/endere[çc]o/i)).toBeNull();
  });

  it("o pedido de FOLLOW continua com o aviso dele", () => {
    // O contraprova do primeiro caso: os dois blocos param o fluxo, e só o
    // follow tem a regra do portão. Trocar um aviso pelo outro seria mentir na
    // outra direção.
    abrirPainelCom({ tipo: "pedir_follow", texto: "Segue lá 👇", botao_label: "Já sigo!" });

    expect(screen.getByText(/ningu[ée]m passa deste ponto sem seguir/i)).toBeTruthy();
    expect(screen.queryByText(/segue sem o dado/i)).toBeNull();
  });
});
