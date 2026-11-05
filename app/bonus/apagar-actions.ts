"use server";
import { redirect } from "next/navigation";
import { FRASE_CARROSSEL_DE_OUTRA_CONTA } from "@/lib/logins-textos";
import { sessaoAtual } from "@/lib/sessao";
import { apagarCarrossel } from "@/lib/bonus/apagar-carrossel";
import { textoDoApagar, type AvisoDoApagar } from "@/lib/bonus/apagar-textos";
import { carrosselDeOutraConta } from "@/lib/bonus/carrossel-acesso";
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
//
// O CARROSSEL QUE JÁ TEM CONTA SÓ É APAGADO POR QUEM TEM A CONTA (docs/specs/2026-11-05-contas-por-login.md,
// seção 3): o de outra conta é recusado logo depois da validação do id. O carrossel sem conta qualquer login
// apaga (`carrosselDeOutraConta` diz falso para ele).

async function exigirSessao(): Promise<void> {
  if (!(await sessaoAtual())) redirect("/entrar");
}

/** APAGAR O CARROSSEL DA PÁGINA, depois da confirmação do botão. */
export async function apagarCarrosselDaPagina(_anterior: AvisoDoApagar | null, form: FormData): Promise<AvisoDoApagar> {
  await exigirSessao();
  const id = form.get("id");
  const em = Date.now();
  if (!ehIdDeBonus(id)) return { tom: "erro", texto: TEXTO_PEDIDO_INVALIDO, em };
  if (await carrosselDeOutraConta(id)) return { tom: "erro", texto: FRASE_CARROSSEL_DE_OUTRA_CONTA, em };
  const r = await apagarCarrossel(id);
  if (!r.ok) return { tom: "erro", texto: textoDoApagar(r.motivo), em };
  redirect(urlDepoisDeApagar());
}
