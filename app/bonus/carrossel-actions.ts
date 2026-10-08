"use server";
import { after } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACCOUNT_COOKIE } from "@/lib/account";
import { isValidSession, SESSION_COOKIE } from "@/lib/auth";
import {
  contaParaGerarDeNovo,
  contaParaGuardar,
  contaSelecionada,
  nomeQueFalta,
  resolverConta,
  type ContaGuardada,
} from "@/lib/bonus/arte-conta";
import { escolhasDaArte, lerSoTextoDoFormulario } from "@/lib/bonus/arte-escolhas";
import { slidesDoTexto } from "@/lib/bonus/arte-slides";
import { cabecalhoParaVersao, versoesDosSlides } from "@/lib/bonus/arte-tela";
import {
  TEXTO_ARTE_NAO_PRONTA,
  TEXTO_ARTE_SALVA,
  TEXTO_CONTA_FIXADA,
  textoDaRecusaDaArte,
  type AvisoDaArte,
} from "@/lib/bonus/arte-textos";
import { caminhoDoCarrossel } from "@/lib/bonus/carrossel-caminho";
import type { ContextoDoCarrossel } from "@/lib/bonus/carrossel-ia-parametros";
import { lerPedidoDeCarrossel } from "@/lib/bonus/carrossel-pedido";
import { processarCarrossel } from "@/lib/bonus/carrossel-processo";
import {
  contasParaArte,
  criarPedidoDeCarrossel,
  fixarContaDoCarrossel as gravarContaFixada,
  lerCarrossel,
  salvarParteDoCarrossel,
  salvarSoTextoDaArte,
} from "@/lib/bonus/carrossel-repositorio";
import { textoDaLinhaDoCarrossel } from "@/lib/bonus/carrossel-tela";
import { camposDaParte, lerParte } from "@/lib/bonus/carrossel-texto";
import {
  TEXTO_CARROSSEL_NAO_ENCONTRADO,
  TEXTO_CARROSSEL_NAO_REVISAVEL,
  TEXTO_NAO_DA_PARA_GERAR_CARROSSEL_DE_NOVO,
  TEXTO_PARTE_INVALIDA,
  TEXTO_SO_BONUS_CRIADO,
  quadroDaSituacao,
  textoDaParteSalva,
  textoDaRecusaDoPedidoDeCarrossel,
  textoDoTetoDoCarrossel,
  textoDosProblemasDoCarrossel,
  urlDoCarrosselComAviso,
  type AvisoDoPedidoDeCarrossel,
  type AvisoDoSlide,
} from "@/lib/bonus/carrossel-textos";
import { temChaveDaIA } from "@/lib/bonus/config";
import { ehIdDeBonus } from "@/lib/bonus/pedido";
import { situacaoNoLabs } from "@/lib/bonus/publicado";
import { fotosDaArte, versaoDoTextoDoSlide } from "@/lib/bonus/publicar-regras";
import { textoDaTrava } from "@/lib/bonus/publicar-textos";
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
 * A CONTA DO CARROSSEL, gravada no pedido: a logada no Chat agora, com o nome e o @ (spec da Etapa
 * 4). O carrossel é dela, e nunca vira de outra. Gravar na primeira visita seria uma escrita dentro
 * de um GET; o pedido já é uma escrita.
 */
async function contaDoPedido(): Promise<ContaGuardada | null> {
  const logada = contaSelecionada(await contasParaArte(), await contaDoCookie());
  return logada ? contaParaGuardar(logada) : null;
}

async function contaDoCookie(): Promise<string | undefined> {
  return (await cookies()).get(ACCOUNT_COOKIE)?.value;
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
  // O avulso (Etapa 7) gera de novo pela action dele (app/carrosseis/actions.ts): esta só conhece o
  // carrossel de bônus.
  const bonusId = linha?.bonus_id;
  if (!linha || !bonusId) redirect(urlDoBonusComAviso(null, { tom: "erro", texto: TEXTO_CARROSSEL_NAO_ENCONTRADO }));
  const caminho = caminhoDoCarrossel(linha);
  const naTela = geracaoNaTela(linha.estado, linha.criado_em, Date.now());
  if (naTela !== "falhou" && naTela !== "travou") {
    redirect(urlDoCarrosselComAviso(caminho, { tom: "erro", texto: TEXTO_NAO_DA_PARA_GERAR_CARROSSEL_DE_NOVO }));
  }
  if (!temChaveDaIA(process.env)) {
    redirect(urlDoCarrosselComAviso(caminho, { tom: "erro", texto: textoDaConfig("sem_chave_ia") }));
  }
  const bonus = await bonusParaCarrossel(bonusId);
  if (!bonus.ok) redirect(urlDoCarrosselComAviso(caminho, { tom: "erro", texto: bonus.texto }));
  // O novo herda a conta do original, mesmo desconectada (decisão do Eduardo em 02/10): gerar de
  // novo um carrossel do Thiago com o Chat na N8X faz outro do Thiago.
  const criado = await criarPedidoDeCarrossel({
    bonusId,
    total: linha.total_slides,
    palavra: bonus.palavra,
    contexto: bonus.contexto,
    conta: contaParaGerarDeNovo(
      await contasParaArte(),
      escolhasDaArte(linha.arte, linha.total_slides),
      await contaDoCookie()
    ),
  });
  if (!criado.ok) redirect(urlDoCarrosselComAviso(caminho, { tom: "erro", texto: textoDoTetoDoCarrossel() }));
  const novo = criado.id;
  after(() => processarCarrossel(novo));
  redirect(`/bonus/${bonusId}/carrossel/${novo}`);
}

/**
 * O "SALVAR SLIDE N" E O "SALVAR LEGENDA" (spec da Etapa 4): grava só a parte, juntada ao texto
 * salvo numa transação com a linha travada (carrossel-repositorio.ts), e recusa só pelos problemas
 * dela. Os campos que o formulário trouxer fora da parte são ignorados.
 *
 * A RESPOSTA VOLTA COMO ESTADO DO CARD (useActionState), E NUNCA POR REDIRECT PARA A PRÓPRIA PÁGINA
 * (achado 52, medido em 01/10 num navegador de verdade): todo redirect de Server Action recria a
 * página no Next 16, e o que o operador tinha digitado voltava ao texto com que a página abriu. Ela
 * leva a versão nova da miniatura do slide salvo, e só ela é pedida de novo. Só a sessão e o
 * carrossel inexistente saem por redirect, para outra página.
 */
export async function salvarSlideDoCarrossel(_anterior: AvisoDoSlide | null, form: FormData): Promise<AvisoDoSlide | null> {
  await exigirSessao();
  const id = form.get("id");
  if (!ehIdDeBonus(id)) redirect(urlDoBonusComAviso(null, { tom: "erro", texto: TEXTO_CARROSSEL_NAO_ENCONTRADO }));
  const linha = await lerCarrossel(id);
  if (!linha) redirect(urlDoBonusComAviso(null, { tom: "erro", texto: TEXTO_CARROSSEL_NAO_ENCONTRADO }));
  const resposta = (tom: AvisoDoSlide["tom"], texto: string, versao: string | null = null): AvisoDoSlide => ({
    tom,
    texto,
    em: Date.now(),
    versao,
  });
  const total = linha.total_slides;
  const parte = lerParte(form.get("parte"), total);
  if (!parte) return resposta("erro", TEXTO_PARTE_INVALIDA);
  const bruto = Object.fromEntries(camposDaParte(total, parte).map((c) => [c, form.get(c)]));
  const contas = await contasParaArte();
  const escolhas = escolhasDaArte(linha.arte, total);
  const r = await salvarParteDoCarrossel(id, parte, bruto, nomeQueFalta(contas, escolhas));
  if (!r.ok && r.motivo === "nao_pronto") return resposta("erro", TEXTO_CARROSSEL_NAO_REVISAVEL);
  if (!r.ok && r.motivo === "travado") return resposta("erro", textoDaTrava(r.estado));
  if (!r.ok) return resposta("erro", `Corrija antes de salvar. ${textoDosProblemasDoCarrossel(total, r.problemas)}`);
  const texto = textoDaParteSalva(parte, total, r.avisos);
  if (parte.tipo === "legenda") return resposta("ok", texto);
  const { conta } = resolverConta(contas, escolhas, await contaDoCookie());
  const slides = slidesDoTexto(r.texto);
  const versoes = versoesDosSlides(slides, escolhas.soTexto, cabecalhoParaVersao(conta), fotosDaArte(linha.arte, total));
  // A versão do texto salvo vai junto (Etapa 5): o card compara com a da imagem do Canva guardada.
  const doSlide = slides[parte.numero - 1];
  return { ...resposta("ok", texto, versoes[parte.numero - 1] ?? null), versaoDoTexto: doSlide ? versaoDoTextoDoSlide(doSlide) : null };
}

/**
 * O "SÓ TEXTO" DA ARTE. A resposta volta como ESTADO (useActionState), e nunca por redirect, pelo
 * mesmo motivo do salvar do slide (achado 52), com as versões novas das miniaturas. Só carrossel
 * pronto guarda escolha. A conta não vem do formulário (spec da Etapa 4): o carrossel é da conta em
 * que nasceu. Gravar aqui completa o nome e o @ da conta gravada na Etapa 3 sem eles.
 */
export async function salvarArteDoCarrossel(_anterior: AvisoDaArte | null, form: FormData): Promise<AvisoDaArte | null> {
  await exigirSessao();
  const id = form.get("id");
  if (!ehIdDeBonus(id)) redirect(urlDoBonusComAviso(null, { tom: "erro", texto: TEXTO_CARROSSEL_NAO_ENCONTRADO }));
  const linha = await lerCarrossel(id);
  if (!linha) redirect(urlDoBonusComAviso(null, { tom: "erro", texto: TEXTO_CARROSSEL_NAO_ENCONTRADO }));
  const resposta = (tom: AvisoDaArte["tom"], texto: string, versoes?: string[]): AvisoDaArte => ({
    tom,
    texto,
    em: Date.now(),
    ...(versoes ? { versoes } : {}),
  });
  const texto = linha.estado === "pronto" ? textoDaLinhaDoCarrossel(linha) : null;
  if (!texto) return resposta("erro", TEXTO_ARTE_NAO_PRONTA);
  const lido = lerSoTextoDoFormulario(form.getAll("so_texto"), linha.total_slides);
  if (!lido.ok) return resposta("erro", textoDaRecusaDaArte(lido.motivo));
  const contas = await contasParaArte();
  const escolhas = escolhasDaArte(linha.arte, linha.total_slides);
  const salvou = await salvarSoTextoDaArte(id, lido.soTexto, nomeQueFalta(contas, escolhas));
  if (!salvou.ok) return resposta("erro", salvou.motivo === "travado" ? textoDaTrava(salvou.estado) : TEXTO_ARTE_NAO_PRONTA);
  const { conta } = resolverConta(contas, escolhas, await contaDoCookie());
  return resposta(
    "ok",
    TEXTO_ARTE_SALVA,
    versoesDosSlides(slidesDoTexto(texto), lido.soTexto, cabecalhoParaVersao(conta), fotosDaArte(linha.arte, linha.total_slides))
  );
}

/**
 * "FIXAR NESTA CONTA" (decisão do Eduardo em 02/10): o carrossel de antes da 015, sem conta gravada,
 * passa a ser da conta logada agora, com o nome e o @, uma vez só. A resposta volta como estado,
 * como as outras da página.
 */
export async function fixarContaDoCarrossel(_anterior: AvisoDaArte | null, form: FormData): Promise<AvisoDaArte | null> {
  await exigirSessao();
  const id = form.get("id");
  if (!ehIdDeBonus(id)) redirect(urlDoBonusComAviso(null, { tom: "erro", texto: TEXTO_CARROSSEL_NAO_ENCONTRADO }));
  const linha = await lerCarrossel(id);
  if (!linha) redirect(urlDoBonusComAviso(null, { tom: "erro", texto: TEXTO_CARROSSEL_NAO_ENCONTRADO }));
  const resposta = (tom: AvisoDaArte["tom"], texto: string): AvisoDaArte => ({ tom, texto, em: Date.now() });
  if (linha.estado !== "pronto" || !textoDaLinhaDoCarrossel(linha)) return resposta("erro", TEXTO_ARTE_NAO_PRONTA);
  if (escolhasDaArte(linha.arte, linha.total_slides).conta) return resposta("erro", textoDaRecusaDaArte("ja_tem_conta"));
  const logada = contaSelecionada(await contasParaArte(), await contaDoCookie());
  if (!logada) return resposta("erro", textoDaRecusaDaArte("sem_conta"));
  // O `where` do repositório recusa quem já tem conta: outra aba pode ter fixado no meio.
  const fixou = await gravarContaFixada(id, contaParaGuardar(logada));
  return fixou ? resposta("ok", TEXTO_CONTA_FIXADA) : resposta("erro", textoDaRecusaDaArte("ja_tem_conta"));
}
