"use client";
import { useCallback, useSyncExternalStore } from "react";

// A ÚNICA PEÇA DE CLIENTE DE `/contatos`, e ela é pequena de propósito.
//
// POR QUE ELA PRECISA EXISTIR: CSS LÊ estado (`:has(input:checked)`) e não
// ESCREVE. Marcar vinte e cinco caixas de uma vez não tem forma declarativa —
// ou há JavaScript, ou não há "selecionar todas".
//
// POR QUE ELA NÃO TOMA CONTA DA TABELA: as linhas continuam renderizadas no
// SERVIDOR. Este componente alcança as caixas pelo DOM do formulário em vez de
// as possuir, então nenhuma linha de contato atravessa a fronteira de
// serialização — e a página não paga hidratação por 143 linhas para ganhar uma
// caixa no cabeçalho.
//
// SEM JAVASCRIPT ela não faz nada, e isso é aceitável: a caixa do cabeçalho não
// tem `name`, então nunca vai no POST, e marcar linha por linha continua
// funcionando. O que se perde é o atalho, não a função.

function caixas(alvo: string): HTMLInputElement[] {
  const form = document.getElementById(alvo);
  if (!(form instanceof HTMLFormElement)) return [];
  return Array.from(form.querySelectorAll<HTMLInputElement>('input[name="ig_id"]'));
}

type Selecao = { n: number; total: number };

// A LEITURA FORA DA ÁRVORE DO REACT, com o retrato guardado.
//
// `useSyncExternalStore` EXIGE que o retrato seja o MESMO OBJETO enquanto nada
// muda: ele compara por identidade, e um objeto novo a cada leitura vira laço
// infinito ("The result of getSnapshot should be cached"). Este mapa é essa
// exigência, e é o mesmo bail-out que a versão anterior fazia à mão dentro do
// `setEstado` — só que agora ele é obrigação da API, e não disciplina de quem
// escreve.
//
// O mapa é por `alvo` (o id do formulário) e nunca é limpo: são dois
// formulários nesta tela, e a chave é uma string curta. Não há o que crescer.
const ULTIMO = new Map<string, Selecao>();
const VAZIO: Selecao = { n: 0, total: 0 };

function lerSelecao(alvo: string): Selecao {
  const cs = caixas(alvo);
  const n = cs.filter((c) => c.checked).length;
  const total = cs.length;
  // VAZIO É A MESMA CONSTANTE QUE O RETRATO DO SERVIDOR devolve, e devolvê-la
  // aqui faz os dois caminhos concordarem POR IDENTIDADE. Sem esta linha, a
  // primeira leitura de um formulário de fato vazio construía um objeto novo
  // com os mesmos zeros, e o React re-renderizava uma vez à toa — saída
  // idêntica, trabalho inútil.
  if (n === 0 && total === 0) return VAZIO;
  const anterior = ULTIMO.get(alvo);
  if (anterior && anterior.n === n && anterior.total === total) return anterior;
  const agora = { n, total };
  ULTIMO.set(alvo, agora);
  return agora;
}

/** Quantas caixas há e quantas estão marcadas, lidas do DOM.
 *
 * POR QUE `useSyncExternalStore` E NÃO `useState` + `useEffect`, e isto mudou em
 * 16/09/2026: a versão anterior tinha DOIS efeitos que chamavam `setState`
 * síncrono, e `eslint-plugin-react-hooks` 7.1.1 os acusa com
 * `react-hooks/set-state-in-effect` ("Calling setState synchronously within an
 * effect can trigger cascading renders"). Eram os dois únicos erros de lint da
 * base que NÃO eram falso positivo de Server Component — e a regra estava certa:
 * o padrão renderizava, lia o DOM e renderizava de novo, toda vez.
 *
 * `useSyncExternalStore` é exatamente a API para isto — "uma fonte de verdade
 * fora do React, com assinatura e retrato" —, e ela entrega de graça as duas
 * coisas que os comentários antigos explicavam com cuidado: reler a cada render
 * (era o efeito sem dependências, para o caso das linhas voltarem DESMARCADAS do
 * servidor depois do redirect) e não entrar em laço (era o bail-out à mão).
 *
 * O TERCEIRO ARGUMENTO É O RETRATO DO SERVIDOR, e ele tem de ser `VAZIO`: no
 * servidor não há DOM para contar, e é o mesmo zero com que a versão anterior
 * inicializava o `useState`. Sem ele, a hidratação estoura.
 */
function useSelecao(alvo: string): Selecao {
  const assinar = useCallback(
    (avisar: () => void) => {
      const form = document.getElementById(alvo);
      if (!form) return () => {};
      // `change` BORBULHA de `<input>` até o `<form>`, então um ouvinte no
      // formulário cobre as 25 caixas sem pendurar 25 ouvintes.
      form.addEventListener("change", avisar);
      return () => form.removeEventListener("change", avisar);
    },
    [alvo]
  );
  return useSyncExternalStore(
    assinar,
    () => lerSelecao(alvo),
    () => VAZIO
  );
}

export function MarcarTodas({ alvo }: { alvo: string }) {
  const { n, total } = useSelecao(alvo);
  return (
    <input
      type="checkbox"
      // SEM `name`, E DE PROPÓSITO: esta caixa comanda as outras e não é um
      // dado. Com `name`, ela viraria um campo a mais no POST e
      // `idsSelecionados` teria de aprender a ignorá-la.
      aria-label="Selecionar todas as linhas mostradas"
      checked={total > 0 && n === total}
      // O TRAÇO DO "ALGUMAS": estado indeterminado não existe como atributo de
      // React, só como propriedade do elemento.
      ref={(el) => {
        if (el) el.indeterminate = n > 0 && n < total;
      }}
      onChange={(e) => {
        const marcar = e.target.checked;
        for (const c of caixas(alvo)) c.checked = marcar;
        // MUDAR `.checked` POR CÓDIGO NÃO DISPARA `change` — isso é verdade e
        // foi medido em jsdom cru. O que NÃO é verdade é a conclusão que estava
        // escrita aqui: a de que sem este evento à mão o contador ficaria parado.
        //
        // MEDIDO EM 21/09/2026, por um plantio que SOBREVIVEU: tirando esta
        // linha, os 15 casos de `testes-dom/marcacao-em-lote.dom.tsx` continuam
        // verdes. O motivo é a ordem — o `onChange` do React para caixa de
        // seleção é guiado pelo `click`, e o `change` NATIVO do próprio
        // cabeçalho só dispara DEPOIS deste manipulador. Quando ele borbulha
        // até o `<form>`, as linhas já estão mudadas e a recontagem vem certa.
        //
        // A LINHA FICA, e como DÍVIDA DECLARADA e não como convicção: o que
        // sustenta a conclusão acima é jsdom mais um modelo do React, e não
        // medição no navegador de verdade — `scripts/conferir-no-navegador.mjs`
        // hoje clica linha a linha e não exercita o "marcar todas". Custo de
        // manter: uma recontagem a mais que sai pelo bail-out do retrato. Custo
        // de tirar por engano: o número parado em zero na tela de quem usa.
        e.target.form?.dispatchEvent(new Event("change", { bubbles: true }));
      }}
      className="h-4 w-4 cursor-pointer"
    />
  );
}

export function ContadorDaSelecao({ alvo }: { alvo: string }) {
  const { n } = useSelecao(alvo);
  if (n === 0) return null;
  return (
    <span className="text-xs font-semibold tabular-nums">
      {n} {n === 1 ? "selecionado" : "selecionados"}
    </span>
  );
}
