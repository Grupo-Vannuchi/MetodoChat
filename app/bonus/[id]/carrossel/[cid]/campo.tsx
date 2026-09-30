"use client";
import { useRef, useState } from "react";
import { btnSecondary, hint, input, label } from "@/app/ui";

// UM CAMPO DO CARROSSEL: edita, conta e copia. O botão copia o que está NO CAMPO agora, e não o
// que abriu na página: é esse texto que o operador leva para o Canva até a Etapa 3 existir.
export default function Campo({
  nome,
  rotulo,
  valorInicial,
  max,
  linhas,
}: {
  nome: string;
  rotulo: string;
  valorInicial: string;
  max: number;
  linhas: number;
}) {
  const campo = useRef<HTMLTextAreaElement>(null);
  const [tamanho, setTamanho] = useState(valorInicial.length);
  const [copiado, setCopiado] = useState(false);

  return (
    <div>
      <label htmlFor={nome} className={label}>
        {rotulo}
      </label>
      <textarea
        ref={campo}
        id={nome}
        name={nome}
        defaultValue={valorInicial}
        maxLength={max}
        rows={linhas}
        onChange={(e) => setTamanho(e.target.value.length)}
        className={input}
      />
      <div className="mt-1 flex items-center justify-between gap-3">
        <p className={hint}>
          {tamanho} de {max} caracteres
        </p>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(campo.current?.value ?? "");
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2000);
          }}
          className={btnSecondary}
        >
          {copiado ? "Copiado ✓" : "Copiar"}
        </button>
      </div>
    </div>
  );
}
