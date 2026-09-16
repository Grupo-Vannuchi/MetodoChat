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
        // MUDAR `.checked` POR CÓDIGO NÃO DISPARA `change`. O CSS da barra não
        // se importa (`:checked` acompanha a propriedade), mas o contador sim —
        // ele vive de eventos. Um evento à mão no formulário acorda os dois.
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
