"use client";
import { useActionState } from "react";
import { btnPrimary, card, hint } from "@/app/ui";
import type { CampoDoCarrossel } from "@/lib/bonus/carrossel-texto";
import type { AvisoDaRevisao } from "@/lib/bonus/carrossel-textos";
import AvisoDoFormulario from "@/app/bonus/aviso-do-formulario";
import Campo from "./campo";

// O FORMULÁRIO DA REVISÃO DO CARROSSEL.
//
// A RESPOSTA DO "SALVAR REVISÃO" VOLTA COMO ESTADO (useActionState), E NÃO POR REDIRECT (achado
// 52, medido em 01/10 num navegador de verdade): todo redirect de Server Action recria a página
// no Next 16, e o que o operador tinha digitado voltava ao texto com que a página abriu. Sem
// redirect, nada é recriado: numa recusa a edição fica, e o motivo aparece junto do botão.
//
// A action entra por propriedade (a página passa `salvarRevisaoDoCarrossel`), para o teste de tela
// usar uma falsa. `em` muda a cada resposta, e a key faz o aviso aparecer de novo mesmo quando a
// mensagem repete.
export default function FormularioDaRevisao({
  acao,
  carrosselId,
  palavra,
  campos,
  valores,
}: {
  acao: (anterior: AvisoDaRevisao | null, form: FormData) => Promise<AvisoDaRevisao | null>;
  carrosselId: string;
  palavra: string;
  campos: CampoDoCarrossel[];
  valores: Record<string, string>;
}) {
  const [resposta, enviar] = useActionState(acao, null);

  return (
    <form action={enviar} className={`${card} space-y-4 p-6`}>
      <input type="hidden" name="id" value={carrosselId} />
      <p className={hint}>
        A chamada pede a palavra <strong>{palavra}</strong>. Ela vem do bônus e não se edita aqui.
      </p>
      {campos.map((c) => (
        <Campo
          key={c.nome}
          nome={c.nome}
          rotulo={c.rotulo}
          valorInicial={valores[c.nome] ?? ""}
          max={c.max}
          linhas={c.linhas}
          palavra={c.pedePalavra ? palavra : undefined}
          soAPalavra={c.soAPalavra}
        />
      ))}
      {resposta && <AvisoDoFormulario key={resposta.em} aviso={resposta} />}
      <button type="submit" className={btnPrimary}>
        Salvar revisão
      </button>
    </form>
  );
}
