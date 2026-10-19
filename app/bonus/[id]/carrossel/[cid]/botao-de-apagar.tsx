"use client";
import { useActionState, useState, useTransition } from "react";
import { alertError, btnDanger, btnSecondary, card, muted } from "@/app/ui";
import {
  TEXTO_APAGAR_CARROSSEL,
  TEXTO_CANCELAR_APAGAR,
  TEXTO_CONFIRMAR_APAGAR,
  TEXTO_SIM_APAGAR,
  type AvisoDoApagar,
} from "@/lib/bonus/apagar-textos";

// O "APAGAR CARROSSEL", NO FIM DA PÁGINA DO CARROSSEL (spec da Etapa 10). Nada é apagado no primeiro
// clique: ele dá lugar à pergunta, com "Sim, apagar" e "Cancelar". Quando não pode, quem desenha manda a
// frase, e ela fica no lugar do botão.
//
// A RECUSA DO SERVIDOR VOLTA COMO ESTADO (useActionState), e nunca por redirect (achado 52); o sucesso sai
// por redirect, para a lista. Sem `<form action>`, como o "Novo carrossel" (formulario-do-avulso.tsx): o
// pedido sai pela transição. A action entra por propriedade, para o teste de tela usar uma falsa.
export default function BotaoDeApagar({
  id,
  frase,
  acao,
}: {
  id: string;
  /** A frase no lugar do botão, quando o carrossel não pode ser apagado; null quando pode. */
  frase: string | null;
  acao: (anterior: AvisoDoApagar | null, form: FormData) => Promise<AvisoDoApagar | null>;
}) {
  // `pendente` desliga o botão enquanto o servidor apaga: um clique duplo não manda dois pedidos.
  const [resposta, enviar, pendente] = useActionState(acao, null);
  const [, iniciar] = useTransition();
  const [confirmando, setConfirmando] = useState(false);

  function apagar() {
    const dados = new FormData();
    dados.set("id", id);
    setConfirmando(false);
    iniciar(() => enviar(dados));
  }

  return (
    <section className={`${card} space-y-3 p-6`}>
      {frase !== null ? (
        <p className={`text-sm ${muted}`}>{frase}</p>
      ) : confirmando ? (
        <div className="space-y-3">
          <p className="text-sm font-medium">{TEXTO_CONFIRMAR_APAGAR}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnDanger} onClick={apagar}>
              {TEXTO_SIM_APAGAR}
            </button>
            <button type="button" className={btnSecondary} onClick={() => setConfirmando(false)}>
              {TEXTO_CANCELAR_APAGAR}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className={btnSecondary} disabled={pendente} onClick={() => setConfirmando(true)}>
          {pendente ? "Apagando…" : TEXTO_APAGAR_CARROSSEL}
        </button>
      )}
      {resposta && !pendente && (
        <div key={resposta.em} role="status" className={alertError}>
          {resposta.texto}
        </div>
      )}
    </section>
  );
}
