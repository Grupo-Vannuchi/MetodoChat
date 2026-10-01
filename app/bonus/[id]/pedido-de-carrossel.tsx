"use client";
import { useActionState, useState, useTransition } from "react";
import { btnPrimary, hint, input, label } from "@/app/ui";
import { SLIDES_MAX, SLIDES_MIN, SLIDES_PADRAO, TETO_CARROSSEL_DIARIO } from "@/lib/bonus/carrossel-pedido";
import type { AvisoDoPedidoDeCarrossel } from "@/lib/bonus/carrossel-textos";
import AvisoDoFormulario from "@/app/bonus/aviso-do-formulario";

// O PEDIDO DE UM CARROSSEL.
//
// A RECUSA VOLTA COMO ESTADO (useActionState), E NÃO POR REDIRECT, pelo mesmo motivo do envio ao
// Labs e da revisão do carrossel (achados 52 e 54, medidos em 01/10 num navegador de verdade): todo
// redirect de Server Action recria a página no Next 16, e o "Quantos slides?" voltava para 10 numa
// recusa.
//
// ⚠️ ESTE FORMULÁRIO NÃO USA `action`, E É DE PROPÓSITO. Com `<form action>`, o React 19 reinicia o
// formulário depois que a action termina. Campo de texto controlado sobrevive, porque o React
// mantém o `defaultValue` dele igual ao valor; o `<select>` controlado, não: volta para a primeira
// opção, o "1", e o pedido seguinte iria com 1 slide (medido no teste de tela,
// testes-dom/bonus-pedido-de-carrossel.dom.tsx). Pelo `onSubmit`, dentro de uma transição, a mesma
// action roda sem o reinício.
//
// A action entra por propriedade (no-labs.tsx passa `pedirCarrossel`), para o teste de tela usar
// uma falsa.
export default function PedidoDeCarrossel({
  acao,
  bonusId,
  publicado,
  restam,
}: {
  acao: (anterior: AvisoDoPedidoDeCarrossel | null, form: FormData) => Promise<AvisoDoPedidoDeCarrossel | null>;
  bonusId: string;
  publicado: boolean;
  restam: number;
}) {
  const [resposta, enviar] = useActionState(acao, null);
  const [, iniciar] = useTransition();
  const [total, setTotal] = useState(String(SLIDES_PADRAO));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const dados = new FormData(e.currentTarget);
        iniciar(() => enviar(dados));
      }}
      className="space-y-3 border-t border-traco p-4 dark:border-traco-escuro"
    >
      <input type="hidden" name="bonus_id" value={bonusId} />
      <div>
        <label htmlFor="total" className={label}>
          Quantos slides?
        </label>
        <select id="total" name="total" value={total} onChange={(e) => setTotal(e.target.value)} className={input}>
          {Array.from({ length: SLIDES_MAX - SLIDES_MIN + 1 }, (_, i) => SLIDES_MIN + i).map((n) => (
            <option key={n} value={n}>
              {n === 1 ? "1 (post de imagem única)" : `${n} slides`}
            </option>
          ))}
        </select>
      </div>
      <p className={hint}>
        Restam {restam} de {TETO_CARROSSEL_DIARIO} gerações de carrossel nas últimas 24 horas.
      </p>
      {resposta && <AvisoDoFormulario key={resposta.em} aviso={resposta} />}
      <button type="submit" className={btnPrimary} disabled={!publicado || restam === 0}>
        Gerar carrossel
      </button>
    </form>
  );
}
