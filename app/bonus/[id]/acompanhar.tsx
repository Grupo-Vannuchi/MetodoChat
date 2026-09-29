"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { muted } from "@/app/ui";
import { DESISTIR_MS, INTERVALO_CONSULTA_MS } from "@/lib/bonus/tempos";

// ACOMPANHA A GERAÇÃO PERGUNTANDO AO SERVIDOR (router.refresh), uma pergunta de
// cada vez: a próxima só é marcada depois de a anterior terminar (`consultando`).
// Quando a geração sai de "gerando", a página deixa de desenhar este componente,
// e ele para por desmontagem. Molde: app/conversas/atualizador.tsx.
export default function Acompanhar({ criadoEmMs }: { criadoEmMs: number }) {
  const router = useRouter();
  const [consultando, iniciar] = useTransition();
  const [desistiu, setDesistiu] = useState(false);
  const [rodada, setRodada] = useState(0);

  useEffect(() => {
    if (consultando || desistiu) return;
    const relogio = setTimeout(() => {
      if (Date.now() - criadoEmMs > DESISTIR_MS) {
        setDesistiu(true);
        return;
      }
      iniciar(() => router.refresh());
      setRodada((n) => n + 1);
    }, INTERVALO_CONSULTA_MS);
    return () => clearTimeout(relogio);
  }, [consultando, desistiu, rodada, criadoEmMs, router]);

  return (
    <p className={`text-sm ${muted}`}>
      {desistiu
        ? "Parei de conferir sozinho. Recarregue a página para ver se terminou."
        : "Leva de 30 segundos a 1 minuto. Esta página se atualiza sozinha."}
    </p>
  );
}
