import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MarcarTodas, ContadorDaSelecao } from "@/app/contatos/selecao-client";

// A MARCAÇÃO EM LOTE, exercitada de verdade — e não lida como texto.
//
// POR QUE ESTE ARQUIVO EXISTE: em 16/09/2026 reescrevi
// `app/contatos/selecao-client.tsx` de `useState` + dois `useEffect` para
// `useSyncExternalStore`, e NENHUM teste desta base tocava naquele arquivo. A
// suíte inteira passaria idêntica se eu tivesse quebrado o contador, o
// "selecionar todas" ou o traço de indeterminado. Foi reescrita às cegas, numa
// funcionalidade que o marketing usa.
//
// O QUE ELE NÃO COBRE, para ninguém vender demais: nem o defeito da foto
// vencida (tempo de hidratação, e jsdom não carrega imagem) nem o da seleção que
// encolhia (uma `key` num Server Component, que jsdom não renderiza). Quem pega
// esses dois é `scripts/conferir-no-navegador.mjs`. Este arquivo é a outra
// metade: ele impede que a PRÓXIMA mexida nesta lógica seja tão cega quanto a
// minha foi.

const ALVO = "lote-de-teste";

/** A TELA MÍNIMA, na mesma FORMA da de verdade — e a forma importa.
 *
 * O componente não possui as linhas: ele as alcança por
 * `document.getElementById(alvo)`. E em `app/contatos/page.tsx` tanto o
 * `MarcarTodas` quanto o `ContadorDaSelecao` são DESCENDENTES do próprio
 * `<form id={alvo}>` — é isso que garante que o formulário já existe no DOM
 * quando a assinatura roda. Montar aqui com o cabeçalho FORA do form passaria
 * a testar um arranjo que a tela não tem. */
function Tela({ linhas = 3 }: { linhas?: number }) {
  return (
    <form id={ALVO}>
      <MarcarTodas alvo={ALVO} />
      {Array.from({ length: linhas }, (_, i) => (
        <input key={i} type="checkbox" name="ig_id" value={`ig-${i}`} aria-label={`linha ${i}`} />
      ))}
      <ContadorDaSelecao alvo={ALVO} />
    </form>
  );
}

const cabecalho = () =>
  screen.getByLabelText("Selecionar todas as linhas mostradas") as HTMLInputElement;
const linha = (i: number) => screen.getByLabelText(`linha ${i}`) as HTMLInputElement;
const contador = () => screen.queryByText(/selecionado/);

describe("o contador", () => {
  it("não aparece com nada marcado — zero não vira '0 selecionados'", () => {
    render(<Tela />);
    expect(contador()).toBeNull();
  });

  it("conta uma", async () => {
    render(<Tela />);
    await userEvent.click(linha(0));
    expect(contador()?.textContent).toBe("1 selecionado");
  });

  it("concorda em número e em plural", async () => {
    render(<Tela />);
    await userEvent.click(linha(0));
    await userEvent.click(linha(1));
    expect(contador()?.textContent).toBe("2 selecionados");
  });

  it("desmarcar faz a conta voltar, e o contador some no zero", async () => {
    render(<Tela />);
    await userEvent.click(linha(0));
    expect(contador()?.textContent).toBe("1 selecionado");
    await userEvent.click(linha(0));
    expect(contador()).toBeNull();
  });
});

describe("o 'marcar todas'", () => {
  it("marca todas as linhas de uma vez", async () => {
    render(<Tela linhas={4} />);
    await userEvent.click(cabecalho());
    expect([0, 1, 2, 3].map((i) => linha(i).checked)).toEqual([true, true, true, true]);
    expect(contador()?.textContent).toBe("4 selecionados");
  });

  it("desmarca todas de uma vez", async () => {
    render(<Tela linhas={4} />);
    await userEvent.click(cabecalho());
    await userEvent.click(cabecalho());
    expect([0, 1, 2, 3].map((i) => linha(i).checked)).toEqual([false, false, false, false]);
    expect(contador()).toBeNull();
  });

  it("o contador acompanha o atalho", async () => {
    // ESTE CASO JÁ SE CHAMOU "e é isto que o evento à mão sustenta", E ERA
    // MENTIRA — descoberta por um plantio que SOBREVIVEU em 21/09/2026: tirei
    // do componente o `dispatchEvent(new Event("change"))` e os 15 casos
    // continuaram verdes.
    //
    // O PORQUÊ, medido: mudar `.checked` por código não dispara evento nenhum
    // (confirmado em jsdom cru). Mas o `onChange` do React para caixa de seleção
    // é guiado pelo `click`, e o `change` NATIVO do próprio cabeçalho só dispara
    // DEPOIS que esse manipulador terminou — quando ele borbulha até o `<form>`,
    // as linhas já foram mudadas, e a recontagem vem certa sem ajuda.
    //
    // O que este caso mede, então, é só o que o nome diz: marcar todas atualiza
    // o número. A necessidade do evento à mão é DÍVIDA DECLARADA no componente.
    render(<Tela linhas={4} />);
    await userEvent.click(cabecalho());
    expect(contador()?.textContent).toBe("4 selecionados");
  });
});

describe("o traço do 'algumas'", () => {
  it("nada marcado: nem marcado nem indeterminado", () => {
    render(<Tela linhas={3} />);
    expect(cabecalho().checked).toBe(false);
    expect(cabecalho().indeterminate).toBe(false);
  });

  it("parte marcada: indeterminado, e NÃO marcado", async () => {
    render(<Tela linhas={3} />);
    await userEvent.click(linha(0));
    expect(cabecalho().checked).toBe(false);
    expect(cabecalho().indeterminate).toBe(true);
  });

  it("todas marcadas: marcado, e NÃO indeterminado", async () => {
    render(<Tela linhas={3} />);
    await userEvent.click(linha(0));
    await userEvent.click(linha(1));
    await userEvent.click(linha(2));
    expect(cabecalho().checked).toBe(true);
    expect(cabecalho().indeterminate).toBe(false);
  });

  it("tirar uma de todas volta ao indeterminado", async () => {
    render(<Tela linhas={3} />);
    await userEvent.click(cabecalho());
    await userEvent.click(linha(1));
    expect(cabecalho().checked).toBe(false);
    expect(cabecalho().indeterminate).toBe(true);
  });
});

describe("o contrato com o servidor", () => {
  it("a caixa do cabeçalho NÃO tem `name`", () => {
    // ELA COMANDA AS OUTRAS E NÃO É UM DADO. Com `name`, viraria um campo a mais
    // no POST e `idsSelecionados` (app/contatos/actions.ts) teria de aprender a
    // ignorá-la — ou marcaria uma categoria num contato que não existe.
    render(<Tela />);
    expect(cabecalho().getAttribute("name")).toBe(null);
  });

  it("as linhas mantêm `name=ig_id`, que é o que o servidor lê", () => {
    // `formData.getAll("ig_id")` é o outro lado deste contrato. Trocar o nome
    // aqui quebraria o envio em lote sem quebrar nada visível na tela.
    render(<Tela linhas={2} />);
    expect(linha(0).name).toBe("ig_id");
    expect(linha(1).name).toBe("ig_id");
  });
});

describe("a fundação do `useSyncExternalStore`", () => {
  it("dois leitores do mesmo alvo veem o mesmo número", async () => {
    // `MarcarTodas` e `ContadorDaSelecao` chamam `useSelecao(alvo)` separados.
    // Se o retrato não fosse compartilhado, o traço e o número poderiam
    // discordar — o cabeçalho dizendo "todas" com o contador em outro valor.
    render(<Tela linhas={2} />);
    await userEvent.click(linha(0));
    await userEvent.click(linha(1));
    expect(cabecalho().checked).toBe(true);
    expect(contador()?.textContent).toBe("2 selecionados");
  });

  it("montar e mexer não entra em laço — o retrato é o MESMO objeto quando nada muda", async () => {
    // ESTE CASO PARECE BOBO E NÃO É. `useSyncExternalStore` compara o retrato
    // POR IDENTIDADE e chama `getSnapshot()` a cada render (e de novo depois do
    // commit). Um objeto novo a cada leitura vira laço infinito, e o React
    // estoura com "The result of getSnapshot should be cached to avoid an
    // infinite loop". Chegar vivo ao fim deste caso É a asserção; o `expect`
    // abaixo só a torna visível.
    render(<Tela linhas={3} />);
    for (let i = 0; i < 3; i++) {
      await userEvent.click(linha(i));
      await userEvent.click(linha(i));
    }
    expect(contador()).toBeNull();
    expect(cabecalho().indeterminate).toBe(false);
  });
});
