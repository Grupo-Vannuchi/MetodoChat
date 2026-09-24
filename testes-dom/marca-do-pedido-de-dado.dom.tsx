import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Previa from "@/app/automacoes/editor/previa";
import { ICONE_DO_CAMPO } from "@/app/icons";
import type { Passo } from "@/lib/steps";
import { TETO_DE_TENTATIVAS } from "@/lib/campos";

// A MARCA DE PARADA DO PEDIDO DE DADO, NA PRÉVIA — o desenho dela e a promessa
// que ela faz.
//
// O DESENHO: a prévia foi consertada PELA METADE: o título da marca deixou de
// nomear o e-mail, e o ÍCONE ficou `IconMail` fixo para os cinco campos.
// Resultado na tela: um ENVELOPE desenhado em cima de "Pedir telefone",
// contradizendo a faixa da paleta, que desenha um telefone naquele mesmo item,
// na mesma tela. `app/icons` escreve a doutrina que isso quebra: cada ícone é o
// desenho da COISA pedida.
//
// A PROMESSA: o título era "para aqui até a resposta chegar", e isso é FALSO
// desde que a Tarefa 4 pôs teto no pedido — depois de `TETO_DE_TENTATIVAS`
// respostas que não servem o motor DESISTE e segue sem o dado. É literalmente a
// frase que já tinha sido consertada no painel; a prévia ficou com a promessa
// velha porque a revisão daquela tarefa olhava o painel. E a prévia é pior
// colocada: ela fica SEMPRE à vista enquanto se monta, o painel só quando o
// bloco é aberto.
//
// O CASO É DE DOM nos dois: o que estava errado era o JSX. O roteiro (puro) já
// carrega o campo na marca, e `tests/editor-roteiro.test.ts` prende isso; o que
// nenhum caso puro alcança é a prévia IGNORAR esse campo e desenhar o envelope
// de novo, ou a tabela `PARADAS` (que não é exportada) voltar a prometer uma
// espera que o motor não faz.
//
// O NÚMERO NÃO É CONFERIDO AQUI. Este arquivo lê `TETO_DE_TENTATIVAS` e a
// constante vale 3 nos dois lados, então nenhum caso daqui distingue a
// constante de um "3" digitado à mão na tela. Quem distingue é
// `testes-dom/teto-nas-telas.dom.tsx`, que troca o teto por outro número e
// cobra as DUAS telas — e foi ele que mediu que um "3" à mão sobrevive a tudo
// que está escrito aqui.

function desenharPrevia(passos: Passo[]) {
  return render(
    <Previa
      passos={passos}
      gatilho="dm"
      ligacoes={[]}
      palavras={["oi"]}
      correspondencia="contains"
      post={null}
      story={null}
      selecionado={null}
    />
  );
}

// O TÍTULO DA MARCA, NUM LUGAR SÓ. Ele é o que acha a marca na tela, e estava
// escrito em três pontos deste arquivo — a mudança do título deixava dois
// verdes e um vermelho, sem dizer que eram a mesma coisa.
const TITULO_DA_MARCA = /para aqui, mas não para sempre/i;

/** A caixa inteira da marca: o título e a linha que explica, juntos. */
function caixaDaMarca() {
  return screen.getByText(TITULO_DA_MARCA).closest("div")!;
}

/** O `<svg>` de dentro da marca de parada do pedido de dado. */
function svgDaMarca() {
  const marca = screen.getByText(TITULO_DA_MARCA).closest("p");
  return marca!.querySelector("svg");
}

/** O mesmo componente de ícone, desenhado à parte, para comparar traço a traço. */
function svgDoCampo(campo: string) {
  const Desenho = ICONE_DO_CAMPO[campo];
  const { container } = render(<Desenho className="h-3 w-3 shrink-0" />);
  return container.querySelector("svg");
}

describe("a marca de parada do pedido de dado", () => {
  it("desenha O CAMPO pedido, e não um envelope para todos", () => {
    desenharPrevia([
      { id: "b_tel001", tipo: "pedir_dado", campo: "telefone", texto: "Me manda seu WhatsApp 👇" },
    ]);
    const naMarca = svgDaMarca()!.innerHTML;

    // O DESENHO É O DO TELEFONE...
    expect(naMarca).toBe(svgDoCampo("telefone")!.innerHTML);
    // ...e NÃO o do e-mail, que é o que estava ali para os cinco campos.
    expect(naMarca).not.toBe(svgDoCampo("email")!.innerHTML);
  });

  it("cada campo leva o desenho dele — e o livre também tem o seu", () => {
    for (const campo of ["email", "nome_informado", "nascimento", "livre"]) {
      const tela = desenharPrevia([
        { id: "b_dad002", tipo: "pedir_dado", campo, texto: "?", chave: "cidade" } as Passo,
      ]);
      expect(svgDaMarca()!.innerHTML, campo).toBe(svgDoCampo(campo)!.innerHTML);
      tela.unmount();
    }
  });

  it("bloco de campo desconhecido não chega a ter marca — quem o barra é `conferir`", () => {
    // MEDIDO ao escrever estes casos, e vale registrar porque contraria o que
    // se espera: um `campo` que o catálogo não conhece NÃO produz uma marca sem
    // ícone. `conferir` (lib/steps.ts) recusa o bloco inteiro ("não diz qual
    // informação buscar") e o roteiro não o desenha — nem balão, nem parada.
    //
    // É por isso que o `Desenho ? ... : null` de `Parada` (./previa) não tem
    // caminho que o alcance a partir de um bloco aceito, e é por isso que o
    // dono dele é o caso puro que mantém `ICONE_DO_CAMPO` completo em relação
    // ao catálogo (tests/paleta-e-salvar.test.ts), e não um caso de tela.
    desenharPrevia([
      { id: "b_dad003", tipo: "pedir_dado", campo: "inventado", texto: "?" } as Passo,
    ]);

    expect(screen.queryByText(TITULO_DA_MARCA)).toBeNull();
  });
});

describe("o que a marca do pedido de dado PROMETE", () => {
  const PEDIDO: Passo[] = [
    { id: "b_tel004", tipo: "pedir_dado", campo: "telefone", texto: "Me manda seu WhatsApp 👇" },
  ];

  it("não promete mais que o fluxo espera até a resposta chegar", () => {
    // A PROMESSA VELHA NÃO PODE ESTAR NA TELA, e é a mesma cobrança que
    // `testes-dom/aviso-do-pedido-de-dado.dom.tsx` faz do painel: "espera aqui
    // até" era literalmente o contrário do que o motor passou a fazer, e "para
    // aqui até a resposta chegar" é a mesma frase com outras palavras.
    desenharPrevia(PEDIDO);

    expect(screen.queryByText(/at[ée] a resposta chegar/i)).toBeNull();
    expect(screen.queryByText(/espera aqui at[ée]/i)).toBeNull();
  });

  it("diz que o fluxo SEGUE sem o dado depois das chances que o motor dá", () => {
    desenharPrevia(PEDIDO);

    const marca = caixaDaMarca().textContent!;
    // AS DUAS METADES DA VERDADE, e uma sem a outra volta a mentir: "não para
    // sempre" sem o desfecho não diz o que acontece, e "segue sem o dado" sem a
    // espera faria parecer que o bloco não para nunca.
    expect(marca).toMatch(/não para sempre/i);
    expect(marca).toMatch(/segue sem o dado/i);
    expect(marca).toContain(String(TETO_DE_TENTATIVAS));
  });

  it("continua dizendo que NÃO é portão — quem chega adiante por outro caminho passa", () => {
    // A INFORMAÇÃO VELHA ERA VERDADEIRA E ÚTIL, e é ela que separa esta marca
    // (teal) das duas âmbar: a regra do portão (`atravessandoOPortao`,
    // lib/steps.ts) cobre `pedir_follow` e mais nada. Consertar o título
    // deixando-a cair trocaria uma mentira por um buraco.
    desenharPrevia(PEDIDO);

    const marca = caixaDaMarca().textContent!;
    expect(marca).toMatch(/não é portão/i);
    expect(marca).toMatch(/outro caminho/i);
  });

  it("o pedido de FOLLOW continua com a marca dele, que é a de portão de verdade", () => {
    // A CONTRAPROVA: as duas marcas param o fluxo, e só o follow é portão.
    // Trocar uma pela outra seria mentir na outra direção.
    desenharPrevia([
      { id: "b_fol005", tipo: "pedir_follow", texto: "Segue lá 👇", botao_label: "Já sigo!" },
    ]);

    expect(screen.getByText(/portão: para aqui até seguir/i)).toBeTruthy();
    expect(screen.queryByText(TITULO_DA_MARCA)).toBeNull();
    expect(screen.queryByText(/segue sem o dado/i)).toBeNull();
  });
});
