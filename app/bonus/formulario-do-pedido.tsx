"use client";
import { useActionState, useState } from "react";
import { btnPrimary, hint, input, label } from "@/app/ui";
import { O_QUE_RESOLVE_MAX, O_QUE_RESOLVE_MIN, PALAVRA_MAX, TEMA_MAX } from "@/lib/bonus/pedido";
import type { AvisoDoPedido } from "@/lib/bonus/textos";
import AvisoDoFormulario from "./aviso-do-formulario";

// O FORMULÁRIO DO PEDIDO DE BÔNUS.
//
// A RECUSA VOLTA COMO ESTADO (useActionState), E NÃO POR REDIRECT, pelo mesmo motivo do envio ao
// Labs e da revisão do carrossel (achados 52 e 54, medidos em 01/10 num navegador de verdade): todo
// redirect de Server Action recria a página no Next 16, e o tema, o "O que o bônus resolve" e a
// palavra digitados sumiam numa recusa. Os campos são controlados pelo mesmo motivo: depois que a
// action termina, o React 19 reinicia o formulário, e um campo sem estado voltaria vazio.
//
// A action entra por propriedade (a página passa `pedirBonus`), para o teste de tela usar uma falsa.
export default function FormularioDoPedido({
  acao,
  temas,
  restam,
}: {
  acao: (anterior: AvisoDoPedido | null, form: FormData) => Promise<AvisoDoPedido | null>;
  temas: string[];
  restam: number;
}) {
  const [resposta, enviar] = useActionState(acao, null);
  const [tema, setTema] = useState("");
  const [oQueResolve, setOQueResolve] = useState("");
  const [palavra, setPalavra] = useState("");

  return (
    <form action={enviar} className="mt-4 space-y-4">
      <div>
        <label htmlFor="tema" className={label}>
          Tema
        </label>
        <input
          id="tema"
          name="tema"
          required
          maxLength={TEMA_MAX}
          list="temas-do-labs"
          value={tema}
          onChange={(e) => setTema(e.target.value)}
          className={input}
        />
        <datalist id="temas-do-labs">
          {temas.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <p className={hint}>Tem de existir no catálogo do Labs. As sugestões vêm de lá.</p>
      </div>
      <div>
        <label htmlFor="o_que_resolve" className={label}>
          O que o bônus resolve
        </label>
        <textarea
          id="o_que_resolve"
          name="o_que_resolve"
          required
          minLength={O_QUE_RESOLVE_MIN}
          maxLength={O_QUE_RESOLVE_MAX}
          rows={4}
          value={oQueResolve}
          onChange={(e) => setOQueResolve(e.target.value)}
          className={input}
        />
      </div>
      <div>
        <label htmlFor="palavra" className={label}>
          Palavra-chave (opcional)
        </label>
        <input
          id="palavra"
          name="palavra"
          maxLength={PALAVRA_MAX}
          value={palavra}
          onChange={(e) => setPalavra(e.target.value)}
          className={input}
        />
        <p className={hint}>
          A que a pessoa comenta no post. Se ficar em branco, a IA sugere uma e você confere antes de enviar.
        </p>
      </div>
      {resposta && <AvisoDoFormulario key={resposta.em} aviso={resposta} />}
      <button type="submit" className={btnPrimary} disabled={restam === 0}>
        Gerar bônus
      </button>
    </form>
  );
}
