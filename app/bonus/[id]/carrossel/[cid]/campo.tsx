"use client";
import { useState } from "react";
import { btnSecondary, fieldError, hint, input, label } from "@/app/ui";
import { outrasGritadas, temPalavra } from "@/lib/bonus/carrossel-texto";
import { textoDaFaltaDaPalavra, textoDaGritadaSemPalavra, textoDeOutrasPalavras } from "@/lib/bonus/carrossel-textos";

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
// como está (achado 53, decisão do Eduardo: copiar continua, com o aviso ao lado). Com
// `soAPalavra` (só a chamada), avisa também a palavra gritada A MAIS (decisão do Eduardo,
// 01/10). As regras e a ordem são as de `lerRevisaoDoCarrossel`: primeiro a falta, depois a mais.
// `palavra` NULA é o carrossel sem palavra-chave (spec da Etapa 8): a chamada avisa toda palavra
// gritada, e a legenda não avisa nada.
//
// `avisoDeCabimento` (Etapa 3) é o "não cabe" do slide deste campo, calculado pelo editor da arte
// sobre o que está nos campos agora. Ele avisa e nunca impede: o salvar não olha para ele.
export default function Campo({
  nome,
  rotulo,
  valorInicial,
  max,
  linhas,
  palavra,
  soAPalavra,
  avisoDeCabimento,
}: {
  nome: string;
  rotulo: string;
  valorInicial: string;
  max: number;
  linhas: number;
  palavra?: string | null;
  soAPalavra?: boolean;
  avisoDeCabimento?: string;
}) {
  const [texto, setTexto] = useState(valorInicial);
  const [copiado, setCopiado] = useState(false);

  let aviso: string | null = null;
  if (palavra === null) {
    const gritadas = soAPalavra ? outrasGritadas(texto, null) : [];
    if (gritadas.length) aviso = textoDaGritadaSemPalavra(gritadas);
  } else if (palavra && !temPalavra(texto, palavra)) {
    aviso = textoDaFaltaDaPalavra(palavra);
  } else if (palavra && soAPalavra) {
    const outras = outrasGritadas(texto, palavra);
    if (outras.length) aviso = textoDeOutrasPalavras(outras, palavra);
  }

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
      {aviso && <p className={fieldError}>{aviso}</p>}
      {avisoDeCabimento && <p className="mt-1.5 text-xs font-medium text-fecha dark:text-fecha-escuro">{avisoDeCabimento}</p>}
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
