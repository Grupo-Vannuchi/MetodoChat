"use client";
import { useState } from "react";
import { btnSecondary, hint, input, label } from "@/app/ui";

// UM CAMPO DO CARROSSEL: edita, conta e copia. O botão copia o que está NO CAMPO agora, e não o
// que abriu na página: é esse texto que o operador leva para o Canva até a Etapa 3 existir.
//
// O CAMPO É CONTROLADO, DE PROPÓSITO (achado 52, 01/10). Depois que a action do formulário
// termina, o React 19 reinicia o formulário, e um textarea com `defaultValue` voltava ao texto
// com que a página abriu: numa recusa, a edição sumia da tela, e o clique seguinte gravava o
// texto velho como "Revisão salva.". Com `value` em estado, o React mantém o `defaultValue` do
// elemento igual ao valor, e o reinício não apaga nada. O estado não vaza de um carrossel para
// outro: o Next separa a página pelo valor do `[cid]` (e não pelos parâmetros da URL, então o
// redirect com `?aviso=` mantém a edição).
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
  const [texto, setTexto] = useState(valorInicial);
  const [copiado, setCopiado] = useState(false);

  return (
    <div>
      <label htmlFor={nome} className={label}>
        {rotulo}
      </label>
      <textarea
        id={nome}
        name={nome}
        value={texto}
        maxLength={max}
        rows={linhas}
        onChange={(e) => setTexto(e.target.value)}
        className={input}
      />
      <div className="mt-1 flex items-center justify-between gap-3">
        <p className={hint}>
          {texto.length} de {max} caracteres
        </p>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(texto);
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
