"use server";
import { after } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isValidSession, SESSION_COOKIE } from "@/lib/auth";
import { temChaveDaIA } from "@/lib/bonus/config";
import { CAMPOS_REVISADOS } from "@/lib/bonus/contrato";
import { ehIdDeBonus, lerPedido } from "@/lib/bonus/pedido";
import { enviarLinha, processarGeracao } from "@/lib/bonus/processo";
import { criarPedido, gravarConferencia, lerLinha } from "@/lib/bonus/repositorio";
import { geracaoNaTela } from "@/lib/bonus/tempos";
import {
  TEXTO_BONUS_NAO_ENCONTRADO,
  TEXTO_CONFERENCIA_VENCIDA,
  TEXTO_NAO_DA_PARA_GERAR_DE_NOVO,
  textoDaConfig,
  textoDaRecusaDoPedido,
  respostaDoEnvio,
  type AvisoDoEnvio,
  type AvisoDoPedido,
  textoDoTeto,
  urlDoBonusComAviso,
} from "@/lib/bonus/textos";

// AS AÇÕES DO GERADOR DE BÔNUS.
//
// TODA ACTION COMEÇA CONFERINDO A SESSÃO, e não confia só no proxy.ts: Server
// Action tem endereço próprio. tests/bonus-paginas.test.ts confere que a primeira
// instrução de cada uma é `await exigirSessao();`.
//
// NENHUMA SAÍDA MUDA: a recusa que não grava nada volta como estado do formulário
// (pedirBonus e enviarAoLabs); as outras saem por redirect com aviso (texto e tom), e
// todo sucesso leva à tela do bônus, que mostra o estado gravado.

async function exigirSessao(): Promise<void> {
  const jarra = await cookies();
  if (!isValidSession(jarra.get(SESSION_COOKIE)?.value)) redirect("/entrar");
}

/**
 * A recusa volta como ESTADO do formulário (useActionState), e não por redirect, pelo mesmo motivo
 * do envio (achados 52 e 54): todo redirect de Server Action recria a página no Next 16, e o que o
 * operador tinha digitado sumia. As três recusas (sem a chave da IA, o pedido inválido e o teto do
 * dia) não gravam nada. Só o pedido criado sai por redirect, para a página do bônus novo.
 */
export async function pedirBonus(_anterior: AvisoDoPedido | null, form: FormData): Promise<AvisoDoPedido | null> {
  await exigirSessao();
  const recusa = (texto: string): AvisoDoPedido => ({ tom: "erro", texto, em: Date.now() });
  if (!temChaveDaIA(process.env)) return recusa(textoDaConfig("sem_chave_ia"));
  const lido = lerPedido({ tema: form.get("tema"), oQueResolve: form.get("o_que_resolve"), palavra: form.get("palavra") });
  if (!lido.ok) return recusa(textoDaRecusaDoPedido(lido.motivo));
  const criado = await criarPedido(lido.pedido);
  if (!criado.ok) return recusa(textoDoTeto());
  const id = criado.id;
  after(() => processarGeracao(id));
  redirect(`/bonus/${id}`);
}

export async function gerarDeNovo(form: FormData): Promise<void> {
  await exigirSessao();
  const id = form.get("id");
  if (!ehIdDeBonus(id)) redirect(urlDoBonusComAviso(null, { tom: "erro", texto: TEXTO_BONUS_NAO_ENCONTRADO }));
  const linha = await lerLinha(id);
  if (!linha) redirect(urlDoBonusComAviso(null, { tom: "erro", texto: TEXTO_BONUS_NAO_ENCONTRADO }));
  const naTela = geracaoNaTela(linha.estado, linha.criado_em, Date.now());
  if (naTela !== "falhou" && naTela !== "travou") {
    redirect(urlDoBonusComAviso(id, { tom: "erro", texto: TEXTO_NAO_DA_PARA_GERAR_DE_NOVO }));
  }
  if (!temChaveDaIA(process.env)) {
    redirect(urlDoBonusComAviso(id, { tom: "erro", texto: textoDaConfig("sem_chave_ia") }));
  }
  const criado = await criarPedido({
    tema: linha.tema,
    oQueResolve: linha.o_que_resolve,
    palavraDigitada: linha.palavra_digitada,
  });
  if (!criado.ok) redirect(urlDoBonusComAviso(id, { tom: "erro", texto: textoDoTeto() }));
  const novo = criado.id;
  after(() => processarGeracao(novo));
  redirect(`/bonus/${novo}`);
}

/**
 * A recusa que não grava nada volta como ESTADO do formulário (useActionState), e não por
 * redirect: todo redirect de Server Action recria a página no Next 16, e a edição na tela sumia
 * (achado 54). A regra de cada resultado mora em `respostaDoEnvio` (lib/bonus/textos.ts).
 */
export async function enviarAoLabs(_anterior: AvisoDoEnvio | null, form: FormData): Promise<AvisoDoEnvio | null> {
  await exigirSessao();
  const id = form.get("id");
  if (!ehIdDeBonus(id)) redirect(urlDoBonusComAviso(null, { tom: "erro", texto: TEXTO_BONUS_NAO_ENCONTRADO }));
  const revisadoBruto: Record<string, unknown> = Object.fromEntries(CAMPOS_REVISADOS.map((c) => [c, form.get(c)]));
  const resposta = respostaDoEnvio(id, await enviarLinha(id, revisadoBruto));
  if (resposta.tipo === "redirect") redirect(resposta.url);
  return { ...resposta.aviso, em: Date.now() };
}

export async function conferirNoLabs(form: FormData): Promise<void> {
  await exigirSessao();
  const id = form.get("id");
  if (!ehIdDeBonus(id)) redirect(urlDoBonusComAviso(null, { tom: "erro", texto: TEXTO_BONUS_NAO_ENCONTRADO }));
  const gravou = await gravarConferencia(id, form.get("existe") === "sim");
  if (!gravou) redirect(urlDoBonusComAviso(id, { tom: "erro", texto: TEXTO_CONFERENCIA_VENCIDA }));
  redirect(`/bonus/${id}`);
}
