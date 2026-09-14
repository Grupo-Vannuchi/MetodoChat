"use client";
import { useEffect, useState } from "react";

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

/** Quantas caixas há e quantas estão marcadas, recontadas a cada `change`. */
function useSelecao(alvo: string): { n: number; total: number } {
  const [estado, setEstado] = useState({ n: 0, total: 0 });
  // Acessível aos dois efeitos abaixo sem recriar o ouvinte a cada render: o
  // efeito de `[alvo]` só registra o `change` uma vez (ou quando `alvo` muda) e
  // fecha sobre esta função; o efeito sem dependências só a CHAMA de novo a
  // cada render, sem mexer no ouvinte.
  const recontar = () => {
    const cs = caixas(alvo);
    const n = cs.filter((c) => c.checked).length;
    const total = cs.length;
    // O bail-out: devolver `p` quando nada mudou é o que impede o laço do
    // `useEffect` sem dependências logo abaixo.
    setEstado((p) => (p.n === n && p.total === total ? p : { n, total }));
  };
  useEffect(() => {
    const form = document.getElementById(alvo);
    if (!form) return;
    recontar();
    // `change` BORBULHA de `<input>` até o `<form>`, então um ouvinte no
    // formulário cobre as 25 caixas sem pendurar 25 ouvintes.
    form.addEventListener("change", recontar);
    return () => form.removeEventListener("change", recontar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alvo]);
  // A cada render o DOM é a verdade, e o estado tem de obedecer: depois do
  // redirect da ação (e de "Ver mais", e de trocar filtro) as linhas voltam do
  // servidor DESMARCADAS, mas este componente é o mesmo fiber — sem isto o
  // cabeçalho fica marcado sobre linhas vazias e o primeiro clique DESMARCA.
  // O bail-out (devolver `p` quando nada mudou) é o que impede o laço.
  useEffect(() => { recontar(); });
  return estado;
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
