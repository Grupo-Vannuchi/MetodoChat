"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isValidSession, SESSION_COOKIE } from "@/lib/auth";
import { apagarCarrossel } from "@/lib/bonus/apagar-carrossel";
import { textoDoApagar, type AvisoDoApagar } from "@/lib/bonus/apagar-textos";
import { urlDepoisDeApagar } from "@/lib/bonus/carrosseis-tela";
import { ehIdDeBonus } from "@/lib/bonus/pedido";
import { TEXTO_PEDIDO_INVALIDO } from "@/lib/bonus/publicar-textos";

// A ACTION DO APAGAR (spec da Etapa 10, "A página do carrossel").
//
// TODA ACTION COMEÇA CONFERINDO A SESSÃO, e não confia só no proxy.ts: Server Action tem endereço
// próprio. tests/bonus-apagar-paginas.test.ts confere que a primeira instrução é `await exigirSessao();`.
//
// A RECUSA VOLTA COMO ESTADO DO BOTÃO (useActionState), e nunca por redirect (achado 52): o carrossel
// agendado em outra aba, por exemplo. Sai por redirect só o sucesso, para a lista na aba "Rascunhos", com
// o aviso em verde (`urlDepoisDeApagar`, achado 92). Do formulário vem só o id: a regra e a trava são as
// do servidor (lib/bonus/apagar-carrossel.ts).

async function exigirSessao(): Promise<void> {
  const jarra = await cookies();
  if (!isValidSession(jarra.get(SESSION_COOKIE)?.value)) redirect("/entrar");
}

/** APAGAR O CARROSSEL DA PÁGINA, depois da confirmação do botão. */
export async function apagarCarrosselDaPagina(_anterior: AvisoDoApagar | null, form: FormData): Promise<AvisoDoApagar> {
  await exigirSessao();
  const id = form.get("id");
  const em = Date.now();
  if (!ehIdDeBonus(id)) return { tom: "erro", texto: TEXTO_PEDIDO_INVALIDO, em };
  const r = await apagarCarrossel(id);
  if (!r.ok) return { tom: "erro", texto: textoDoApagar(r.motivo), em };
  redirect(urlDepoisDeApagar());
}
