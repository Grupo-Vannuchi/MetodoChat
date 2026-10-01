"use client";
import { useState } from "react";
import { input } from "@/app/ui";

// UM CAMPO DO ENVIO AO LABS (o formulário de revisão do bônus).
//
// O CAMPO É CONTROLADO, DE PROPÓSITO (achado 54, 01/10), pelo mesmo motivo do campo do
// carrossel (carrossel/[cid]/campo.tsx, achado 52): depois que a action do formulário termina,
// o React 19 reinicia o formulário, e um campo com `defaultValue` voltava ao texto com que a
// página abriu. Numa recusa feita pelo próprio Chat (`invalido`, que não grava nada), a edição
// sumia da tela, e o "Enviar ao Labs" seguinte mandava o texto anterior. Com `value` em estado,
// o React mantém o `defaultValue` do elemento igual ao valor, e o reinício não apaga nada.
//
// Quem desenha passa `key` com o valor do servidor: quando ele muda (o corpo congelado depois
// de uma tentativa incerta), o campo recomeça dele; numa recusa ele não muda, e a edição fica.
export default function CampoDoEnvio({
  nome,
  valorInicial,
  max,
  linhas,
  travado,
  lista,
}: {
  nome: string;
  valorInicial: string;
  max: number;
  linhas?: number;
  travado: boolean;
  lista?: string;
}) {
  const [texto, setTexto] = useState(valorInicial);

  if (linhas) {
    return (
      <textarea
        id={nome}
        name={nome}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        maxLength={max}
        rows={linhas}
        readOnly={travado}
        className={input}
      />
    );
  }
  return (
    <input
      id={nome}
      name={nome}
      value={texto}
      onChange={(e) => setTexto(e.target.value)}
      maxLength={max}
      readOnly={travado}
      list={lista}
      className={input}
    />
  );
}
