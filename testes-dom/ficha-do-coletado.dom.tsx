import { describe, expect, it } from "vitest";
import { render, within } from "@testing-library/react";
import { FichaDoColetado } from "@/app/conversas/[id]/ficha-do-coletado";
import { fichaDoColetado, type ContatoDaFicha } from "@/lib/ficha-do-coletado";
import { campoPorChave, type Campo } from "@/lib/campos";
import { fmtDate } from "@/lib/format";

// A FICHA DO QUE A AUTOMAÇÃO COLETOU — do lado da TELA.
//
// POR QUE ELA É UM COMPONENTE PRÓPRIO, e não um pedaço de
// `app/conversas/[id]/page.tsx`: aquela página é `async`, consulta o Postgres e
// lê a conta selecionada — `testes-dom/` roda offline, em jsdom, sem banco —, e
// um fragmento nessa posição não tem como ser montado por caso nenhum. É o mesmo
// movimento de `app/contatos/faixa-da-exportacao.tsx`, cujo cabeçalho conta o
// preço medido de não o ter feito antes.
//
// O QUE ESTES CASOS AFIRMAM, e é o que separa esta suíte da pura: o que a PESSOA
// LÊ. A suíte pura (tests/ficha-do-coletado.test.ts) prende quais campos entram,
// em que ordem, com que rótulo e se a data é real; aqui se prende que a tela não
// transforma um `em: null` numa promessa de data, que os rótulos chegam à tela
// como vieram do catálogo, e que a pessoa sem nada coletado lê uma frase em vez
// de uma caixa vazia.
//
// NADA AQUI É OBJETO LITERAL, e isso é metade do ponto: os itens saem de
// `fichaDoColetado`, a MESMA função que a página chama. Com itens montados à mão
// neste arquivo, a fiação entre a regra e a tela continuaria sem ninguém a
// exercitar — que é exatamente o buraco que estes casos existem para fechar.

const EM = "2026-09-20T10:00:00Z";

const coletado = (valor: string) => ({ valor, em: EM, automacao: "a-1" });
/** O registro que a migração `012` grava: sem a chave `automacao`. */
const migrado = (valor: string) => ({ valor, em: "2026-09-24T09:00:00Z" });

function montar(contato: Partial<ContatoDaFicha>, catalogo?: Campo[]) {
  const itens = fichaDoColetado({ email: null, campos: {}, ...contato }, catalogo);
  const { container } = render(<FichaDoColetado itens={itens} />);
  return { container, tela: within(container), itens };
}

/** Cada bloco da ficha, lido do DOM: o rótulo, o valor e a linha do quando. */
function blocos(container: HTMLElement): { rotulo: string; valor: string; quando: string }[] {
  return [...container.querySelectorAll("dl > div")].map((bloco) => {
    const dt = bloco.querySelector("dt");
    const dds = [...bloco.querySelectorAll("dd")];
    if (!dt || dds.length !== 2) {
      throw new Error(
        "cada bloco da ficha tem de ter um <dt> (o rótulo) e dois <dd> (o valor e " +
          `o quando) — este tem ${dds.length} <dd>. Se a marcação mudou, este leitor ` +
          "precisa acompanhar, senão os casos abaixo passam a medir o nada."
      );
    }
    return {
      rotulo: dt.textContent ?? "",
      valor: dds[0].textContent ?? "",
      quando: dds[1].textContent ?? "",
    };
  });
}

describe("o que a ficha mostra", () => {
  it("mostra rótulo, valor e quando — na ordem em que os itens chegaram", () => {
    const { container, itens } = montar({
      campos: {
        email: coletado("ana@email.com"),
        telefone: coletado("11999998888"),
        qual_sua_cidade: coletado("Osasco"),
      },
    });
    // A ordem é cobrada contra os ITENS, e não contra uma lista escrita aqui:
    // quem decide a ordem é `fichaDoColetado` (e a suíte pura a prende contra um
    // catálogo de mentira). O que este caso afirma é que a tela não reordena.
    expect(blocos(container).map((b) => b.rotulo)).toEqual(itens.map((i) => i.rotulo));
    expect(blocos(container).map((b) => b.valor)).toEqual(itens.map((i) => i.valor));
  });

  // O PLANTIO QUE ESTE CASO ACUSA: o rótulo escrito à mão dentro do componente.
  // Com um catálogo de mentira, quem escreve o nome no JSX devolve o nome de
  // sempre e fica vermelho aqui.
  it("o rótulo chega à tela como o catálogo o escreveu", () => {
    const telefone = campoPorChave("telefone")!;
    const { container } = montar({ campos: { telefone: coletado("11999998888") } }, [
      { ...telefone, rotulo: "RÓTULO QUE SÓ ESTE CASO CONHECE" },
    ]);
    expect(blocos(container)[0].rotulo).toBe("RÓTULO QUE SÓ ESTE CASO CONHECE");
  });

  it("a data é escrita no fuso do painel, e não como o banco a guardou", () => {
    const { container } = montar({ campos: { telefone: coletado("11999998888") } });
    // `fmtDate` é a MESMA função que o resto da conversa usa para a hora das
    // mensagens. Chamá-la aqui, em vez de cravar "20/09/2026, 07:00", é o que
    // impede este caso de apodrecer se o fuso de exibição mudar — e o que o
    // mantém medindo a tela, e não o `Intl`.
    expect(blocos(container)[0].quando).toBe(`coletado em ${fmtDate(EM)}`);
    expect(blocos(container)[0].quando).not.toContain(EM);
  });
});

describe("a data que não existe", () => {
  // O PLANTIO CENTRAL DESTA TAREFA, do lado da tela: escrever "coletado em"
  // sobre um item sem data. São nove contatos em produção com o e-mail migrado
  // pela `012`, cujo `em` é o instante em que a migração rodou — e uma ficha que
  // os mostrasse como coleta de verdade seria a sexta tela desta funcionalidade
  // a afirmar o contrário do que o dado diz.
  it("o e-mail MIGRADO não diz 'coletado em' — diz que não há data", () => {
    const { container } = montar({ campos: { email: migrado("ana@email.com") } });
    const bloco = blocos(container)[0];
    expect(bloco.valor).toBe("ana@email.com");
    expect(
      bloco.quando,
      "o registro migrado pela `012` não tem data de coleta: o `em` dele é o " +
        "instante em que a migração rodou. A ficha tem de dizer isso, e não " +
        "escolher uma data para pôr no lugar."
    ).toBe("sem data de coleta");
    expect(bloco.quando).not.toContain("coletado em");
  });

  it("o e-mail que só existe na coluna antiga também não promete data", () => {
    const { container } = montar({ email: "antigo@email.com" });
    expect(blocos(container)[0].valor).toBe("antigo@email.com");
    expect(blocos(container)[0].quando).toBe("sem data de coleta");
  });

  // A PONTA CONTRÁRIA, para o caso de cima não passar por vacuidade: se a tela
  // escrevesse "sem data de coleta" para todo mundo, ela também estaria mentindo
  // — e os dois casos juntos não deixam nenhuma das duas frases servir para o
  // outro lado.
  it("a coleta de verdade continua dizendo quando foi", () => {
    const { container } = montar({ campos: { telefone: coletado("11999998888") } });
    expect(blocos(container)[0].quando).toContain("coletado em");
  });
});

describe("a pessoa sem nada coletado", () => {
  // O VAZIO TEM DESENHO, e a decisão está escrita no componente: ela LÊ uma
  // frase, em vez de uma caixa vazia ou de um silêncio. O silêncio seria
  // indistinguível do defeito que esta tela existe para consertar — o dado
  // coletado que não aparecia em tela nenhuma —, e quem procura o telefone que a
  // automação pediu não teria como saber se ele não foi coletado ou se o painel
  // é que não o mostra.
  it("lê uma frase, e não uma caixa vazia", () => {
    const { container, tela, itens } = montar({});
    expect(itens).toEqual([]);
    expect(container.querySelector("dl")).toBe(null);
    expect(tela.getByText(/Nada coletado ainda/)).toBeTruthy();
  });

  it("com um campo coletado, a frase do vazio some", () => {
    const { tela } = montar({ campos: { telefone: coletado("11999998888") } });
    expect(tela.queryByText(/Nada coletado ainda/)).toBe(null);
  });
});
