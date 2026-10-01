"use client";
import { useState } from "react";
import { btnSecondary, fieldError, hint, input, label } from "@/app/ui";
import { temPalavra } from "@/lib/bonus/carrossel-texto";
import { textoDaFaltaDaPalavra } from "@/lib/bonus/carrossel-textos";

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
//
// `palavra` só vem na chamada e na legenda (`pedePalavra` em carrossel-texto.ts): sem ela no
// texto, o campo avisa NA HORA, e não só no "Salvar revisão", porque o "Copiar" leva o texto
// como está (achado 53, decisão do Eduardo: copiar continua, com o aviso ao lado).
export default function Campo({
  nome,
  rotulo,
  valorInicial,
  max,
  linhas,
  palavra,
}: {
  nome: string;
  rotulo: string;
  valorInicial: string;
  max: number;
  linhas: number;
  palavra?: string;
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
      {palavra && !temPalavra(texto, palavra) && <p className={fieldError}>{textoDaFaltaDaPalavra(palavra)}</p>}
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
