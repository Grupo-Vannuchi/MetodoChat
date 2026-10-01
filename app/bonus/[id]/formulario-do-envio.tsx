"use client";
import { useActionState } from "react";
import { btnPrimary, card, hint, label } from "@/app/ui";
import type { CampoRevisado, Revisado } from "@/lib/bonus/contrato";
import type { AvisoDoEnvio } from "@/lib/bonus/textos";
import CampoDoEnvio from "./campo-do-envio";
import AvisoDoFormulario from "./carrossel/[cid]/aviso-do-formulario";

// O FORMULÁRIO DO ENVIO AO LABS (a revisão do bônus).
//
// A RECUSA QUE NÃO GRAVA NADA VOLTA COMO ESTADO (useActionState), E NÃO POR REDIRECT (achado 54,
// medido em 01/10 num navegador de verdade): todo redirect de Server Action recria a página no
// Next 16, e o que o operador tinha editado voltava ao texto com que a página abriu. A regra de
// cada resultado mora em `respostaDoEnvio` (lib/bonus/textos.ts); o que grava segue redirecionando.
//
// A action entra por propriedade (a página passa `enviarAoLabs`), para o teste de tela usar uma
// falsa. Os rótulos vêm da página, para este arquivo não puxar lib/bonus/textos.ts em tempo de
// execução para o navegador.
export default function FormularioDoEnvio({
  acao,
  id,
  campos,
  valores,
  congelado,
  temas,
}: {
  acao: (anterior: AvisoDoEnvio | null, form: FormData) => Promise<AvisoDoEnvio | null>;
  id: string;
  campos: { nome: CampoRevisado; rotulo: string; max: number; linhas?: number }[];
  valores: Revisado;
  congelado: boolean;
  temas: string[];
}) {
  const [resposta, enviar] = useActionState(acao, null);

  return (
    <form action={enviar} className={`${card} space-y-4 p-6`}>
      <input type="hidden" name="id" value={id} />
      {congelado && (
        <p className={hint}>
          Os campos estão travados: uma tentativa anterior pode ter chegado ao Labs, e o reenvio tem de levar o mesmo
          conteúdo.
        </p>
      )}
      {campos.map((c) => (
        <div key={c.nome}>
          <label htmlFor={c.nome} className={label}>
            {c.rotulo}
          </label>
          <CampoDoEnvio
            key={`${c.nome}:${valores[c.nome]}`}
            nome={c.nome}
            valorInicial={valores[c.nome]}
            max={c.max}
            linhas={c.linhas}
            travado={congelado}
            lista={c.nome === "tema" ? "temas-do-bonus" : undefined}
          />
          <p className={hint}>
            {valores[c.nome].length} de {c.max} caracteres ao abrir a página.
          </p>
        </div>
      ))}
      <datalist id="temas-do-bonus">
        {temas.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      <p className={hint}>O bônus nasce oculto no Labs. O link só funciona depois que alguém o publicar no /admin de lá.</p>
      {resposta && <AvisoDoFormulario key={resposta.em} aviso={resposta} />}
      <button type="submit" className={btnPrimary}>
        {congelado ? "Enviar de novo, com o mesmo conteúdo" : "Enviar ao Labs"}
      </button>
    </form>
  );
}
