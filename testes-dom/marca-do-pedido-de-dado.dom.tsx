import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Previa from "@/app/automacoes/editor/previa";
import { ICONE_DO_CAMPO } from "@/app/icons";
import type { Passo } from "@/lib/steps";

// O DESENHO DA MARCA DE PARADA DA PRÉVIA — e por que ele precisa de um caso.
//
// A prévia foi consertada PELA METADE: o título da marca deixou de nomear o
// e-mail ("para aqui até a resposta chegar"), e o ÍCONE ficou `IconMail` fixo
// para os cinco campos. Resultado na tela: um ENVELOPE desenhado em cima de
// "Pedir telefone", contradizendo a faixa da paleta, que desenha um telefone
// naquele mesmo item, na mesma tela. `app/icons` escreve a doutrina que isso
// quebra: cada ícone é o desenho da COISA pedida.
//
// O CASO É DE DOM porque o que estava errado era o JSX: o roteiro (puro) já
// carrega o campo na marca, e `tests/editor-roteiro.test.ts` prende isso. O que
// nenhum caso puro alcança é a prévia IGNORAR esse campo e desenhar o envelope
// de novo — que é exatamente o defeito que existiu.

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

/** O `<svg>` de dentro da marca de parada do pedido de dado. */
function svgDaMarca() {
  const marca = screen.getByText(/para aqui até a resposta chegar/i).closest("p");
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

    expect(screen.queryByText(/para aqui até a resposta chegar/i)).toBeNull();
  });
});
