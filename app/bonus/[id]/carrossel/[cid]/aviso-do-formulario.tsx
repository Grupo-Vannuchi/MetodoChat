"use client";
import { useEffect, useRef, useState } from "react";
import { alertError, alertOk } from "@/app/ui";
import type { Aviso } from "@/lib/avisos";

// O RESULTADO DO "SALVAR REVISÃO", JUNTO DO BOTÃO (decisão do Eduardo, 01/10). Na prova real de
// 30/09 o aviso só aparecia no topo, longe do botão, e o verde "Revisão salva." continuava na
// tela enquanto se editava de novo: um salvamento antigo parecia novo. Este some no primeiro
// caractere digitado no formulário. Quem desenha passa `key` com o relógio do servidor: cada
// resposta nova remonta o aviso, mesmo com a mesma mensagem da anterior.
export default function AvisoDoFormulario({ aviso }: { aviso: Aviso }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [visivel, setVisivel] = useState(true);

  useEffect(() => {
    const formulario = caixa.current?.closest("form");
    if (!formulario) return;
    const esconder = () => setVisivel(false);
    formulario.addEventListener("input", esconder);
    return () => formulario.removeEventListener("input", esconder);
  }, []);

  return (
    <div ref={caixa} role="status" hidden={!visivel} className={aviso.tom === "ok" ? alertOk : alertError}>
      {aviso.texto}
    </div>
  );
}
