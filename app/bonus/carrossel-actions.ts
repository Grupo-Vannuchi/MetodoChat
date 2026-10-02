"use server";
import { after } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACCOUNT_COOKIE } from "@/lib/account";
import { isValidSession, SESSION_COOKIE } from "@/lib/auth";
import { resolverConta } from "@/lib/bonus/arte-conta";
import type { ContextoDoCarrossel } from "@/lib/bonus/carrossel-ia-parametros";
import { lerPedidoDeCarrossel } from "@/lib/bonus/carrossel-pedido";
import { processarCarrossel } from "@/lib/bonus/carrossel-processo";
import {
  contasParaArte,
  criarPedidoDeCarrossel,
  lerCarrossel,
  salvarRevisaoDoCarrossel as gravarRevisao,
} from "@/lib/bonus/carrossel-repositorio";
import { textoDaLinhaDoCarrossel } from "@/lib/bonus/carrossel-tela";
import { camposDoFormulario, lerRevisaoDoCarrossel } from "@/lib/bonus/carrossel-texto";
import {
  TEXTO_CARROSSEL_NAO_ENCONTRADO,
  TEXTO_CARROSSEL_NAO_REVISAVEL,
  TEXTO_NAO_DA_PARA_GERAR_CARROSSEL_DE_NOVO,
  TEXTO_REVISAO_SALVA,
  TEXTO_SO_BONUS_CRIADO,
  quadroDaSituacao,
  textoDaRecusaDoPedidoDeCarrossel,
  textoDoTetoDoCarrossel,
  textoDosProblemasDoCarrossel,
  urlDoCarrosselComAviso,
  type AvisoDaRevisao,
  type AvisoDoPedidoDeCarrossel,
} from "@/lib/bonus/carrossel-textos";
import { temChaveDaIA } from "@/lib/bonus/config";
import { ehIdDeBonus } from "@/lib/bonus/pedido";
import { situacaoNoLabs } from "@/lib/bonus/publicado";
import { lerLinha } from "@/lib/bonus/repositorio";
import { geracaoNaTela } from "@/lib/bonus/tempos";
import { TEXTO_BONUS_NAO_ENCONTRADO, textoDaConfig, urlDoBonusComAviso } from "@/lib/bonus/textos";

// AS AÇÕES DO CARROSSEL.
//
// TODA ACTION COMEÇA CONFERINDO A SESSÃO, e não confia só no proxy.ts: Server Action tem
// endereço próprio. tests/bonus-carrossel-paginas.test.ts confere que a primeira instrução de
// cada uma é `await exigirSessao();`.
//
// A PALAVRA E O CONTEXTO SÃO LIDOS DO LABS AQUI, NO SERVIDOR, a cada pedido, e nunca aceitos do
// formulário: a página aberta pode estar velha.

async function exigirSessao(): Promise<void> {
  const jarra = await cookies();
  if (!isValidSession(jarra.get(SESSION_COOKIE)?.value)) redirect("/entrar");
}

/**
 * A CONTA DO CABEÇALHO DA ARTE, gravada no pedido: a selecionada no Chat agora (spec da Etapa 3).
 * Gravar na primeira visita seria uma escrita dentro de um GET; o pedido já é uma escrita.
 */
async function contaDoPedido(): Promise<string | null> {
  const jarra = await cookies();
  return resolverConta(await contasParaArte(), null, jarra.get(ACCOUNT_COOKIE)?.value).conta?.ig_user_id ?? null;
}

/** O bônus pronto para carrossel: criado no Labs e publicado lá. Qualquer outra coisa é recusa. */
async function bonusParaCarrossel(
  bonusId: string
): Promise<{ ok: true; palavra: string; contexto: ContextoDoCarrossel } | { ok: false; texto: string }> {
  const linha = await lerLinha(bonusId);
  if (!linha) return { ok: false, texto: TEXTO_BONUS_NAO_ENCONTRADO };
  if (linha.envio_estado !== "criado" || !linha.slug) return { ok: false, texto: TEXTO_SO_BONUS_CRIADO };
  const situacao = await situacaoNoLabs(process.env.LABS_URL, linha.slug);
  if (situacao.tipo !== "publicado") return { ok: false, texto: quadroDaSituacao(situacao).texto };
  return {
    ok: true,
    palavra: situacao.bonus.palavra,
    contexto: {
      tema: situacao.bonus.tema,
      titulo: situacao.bonus.titulo,
      descricao: situacao.bonus.descricao,
      oQueResolve: linha.o_que_resolve,
    },
  };
}

/**
 * A recusa volta como ESTADO do formulário (useActionState), e não por redirect, pelo mesmo motivo
 * do salvar da revisão (achado 52): todo redirect de Server Action recria a página no Next 16, e o
 * "Quantos slides?" voltava para 10. As recusas não gravam nada. Saem por redirect só o id de bônus
 * inválido, para a lista, e o pedido criado, para a página do carrossel novo.
 */
export async function pedirCarrossel(
  _anterior: AvisoDoPedidoDeCarrossel | null,
  form: FormData
): Promise<AvisoDoPedidoDeCarrossel | null> {
  await exigirSessao();
  const bonusId = form.get("bonus_id");
  if (!ehIdDeBonus(bonusId)) redirect(urlDoBonusComAviso(null, { tom: "erro", texto: TEXTO_BONUS_NAO_ENCONTRADO }));
  const recusa = (texto: string): AvisoDoPedidoDeCarrossel => ({ tom: "erro", texto, em: Date.now() });
  const lido = lerPedidoDeCarrossel({ bonusId, total: form.get("total") });
  if (!lido.ok) return recusa(textoDaRecusaDoPedidoDeCarrossel(lido.motivo));
  if (!temChaveDaIA(process.env)) return recusa(textoDaConfig("sem_chave_ia"));
  const bonus = await bonusParaCarrossel(bonusId);
  if (!bonus.ok) return recusa(bonus.texto);
  const criado = await criarPedidoDeCarrossel({
    bonusId,
    total: lido.pedido.total,
    palavra: bonus.palavra,
    contexto: bonus.contexto,
    conta: await contaDoPedido(),
  });
  if (!criado.ok) return recusa(textoDoTetoDoCarrossel());
  const id = criado.id;
  after(() => processarCarrossel(id));
  redirect(`/bonus/${bonusId}/carrossel/${id}`);
}

export async function gerarCarrosselDeNovo(form: FormData): Promise<void> {
  await exigirSessao();
  const id = form.get("id");
  if (!ehIdDeBonus(id)) redirect(urlDoBonusComAviso(null, { tom: "erro", texto: TEXTO_CARROSSEL_NAO_ENCONTRADO }));
  const linha = await lerCarrossel(id);
  if (!linha) redirect(urlDoBonusComAviso(null, { tom: "erro", texto: TEXTO_CARROSSEL_NAO_ENCONTRADO }));
  const naTela = geracaoNaTela(linha.estado, linha.criado_em, Date.now());
  if (naTela !== "falhou" && naTela !== "travou") {
    redirect(urlDoCarrosselComAviso(linha.bonus_id, id, { tom: "erro", texto: TEXTO_NAO_DA_PARA_GERAR_CARROSSEL_DE_NOVO }));
  }
  if (!temChaveDaIA(process.env)) {
    redirect(urlDoCarrosselComAviso(linha.bonus_id, id, { tom: "erro", texto: textoDaConfig("sem_chave_ia") }));
  }
  const bonus = await bonusParaCarrossel(linha.bonus_id);
  if (!bonus.ok) redirect(urlDoCarrosselComAviso(linha.bonus_id, id, { tom: "erro", texto: bonus.texto }));
  const criado = await criarPedidoDeCarrossel({
    bonusId: linha.bonus_id,
    total: linha.total_slides,
    palavra: bonus.palavra,
    contexto: bonus.contexto,
    conta: await contaDoPedido(),
  });
  if (!criado.ok) redirect(urlDoCarrosselComAviso(linha.bonus_id, id, { tom: "erro", texto: textoDoTetoDoCarrossel() }));
  const novo = criado.id;
  after(() => processarCarrossel(novo));
  redirect(`/bonus/${linha.bonus_id}/carrossel/${novo}`);
}

/**
 * A RESPOSTA VOLTA COMO ESTADO DO FORMULÁRIO (useActionState), E NUNCA POR REDIRECT PARA A
 * PRÓPRIA PÁGINA (achado 52, medido em 01/10 num navegador de verdade): todo redirect de Server
 * Action recria a página no Next 16, e o que o operador tinha digitado voltava ao texto com que a
 * página abriu. Numa recusa, a edição sumia, e o clique seguinte gravava o texto velho. Só a
 * sessão e o carrossel inexistente saem por redirect, para outra página.
 */
export async function salvarRevisaoDoCarrossel(
  _anterior: AvisoDaRevisao | null,
  form: FormData
): Promise<AvisoDaRevisao | null> {
  await exigirSessao();
  const id = form.get("id");
  if (!ehIdDeBonus(id)) redirect(urlDoBonusComAviso(null, { tom: "erro", texto: TEXTO_CARROSSEL_NAO_ENCONTRADO }));
  const linha = await lerCarrossel(id);
  if (!linha) redirect(urlDoBonusComAviso(null, { tom: "erro", texto: TEXTO_CARROSSEL_NAO_ENCONTRADO }));
  const resposta = (tom: AvisoDaRevisao["tom"], texto: string): AvisoDaRevisao => ({ tom, texto, em: Date.now() });
  const atual = textoDaLinhaDoCarrossel(linha);
  if (linha.estado !== "pronto" || !atual) return resposta("erro", TEXTO_CARROSSEL_NAO_REVISAVEL);
  const bruto: Record<string, unknown> = Object.fromEntries(
    camposDoFormulario(linha.total_slides).map((c) => [c.nome, form.get(c.nome)])
  );
  const lido = lerRevisaoDoCarrossel(linha.total_slides, linha.palavra, atual.titulo, bruto);
  if (!lido.ok) {
    return resposta("erro", `Corrija antes de salvar. ${textoDosProblemasDoCarrossel(linha.total_slides, lido.problemas)}`);
  }
  const salvou = await gravarRevisao(id, lido.texto);
  return salvou ? resposta("ok", TEXTO_REVISAO_SALVA) : resposta("erro", TEXTO_CARROSSEL_NAO_REVISAVEL);
}
