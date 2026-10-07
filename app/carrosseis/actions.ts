"use server";
import { after } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACCOUNT_COOKIE } from "@/lib/account";
import { isValidSession, SESSION_COOKIE } from "@/lib/auth";
import { contaParaGerarDeNovo, contaParaGuardar, contaSelecionada } from "@/lib/bonus/arte-conta";
import { escolhasDaArte } from "@/lib/bonus/arte-escolhas";
import { lerPedidoAvulso } from "@/lib/bonus/avulso-pedido";
import { gerarAvulsoDeNovo as gerarDeNovo, pedirAvulso } from "@/lib/bonus/avulso-processo";
import { textoDaRecusaDoPedidoAvulso, type AvisoDoAvulso } from "@/lib/bonus/avulso-textos";
import { caminhoDoCarrossel, ehDaRota } from "@/lib/bonus/carrossel-caminho";
import { processarCarrossel } from "@/lib/bonus/carrossel-processo";
import { contasParaArte, lerCarrossel } from "@/lib/bonus/carrossel-repositorio";
import { camposDoFormulario } from "@/lib/bonus/carrossel-texto";
import { TEXTO_CARROSSEL_NAO_ENCONTRADO, urlDoCarrosselComAviso } from "@/lib/bonus/carrossel-textos";
import { temChaveDaIA } from "@/lib/bonus/config";
import { ehIdDeBonus } from "@/lib/bonus/pedido";
import { situacaoNoLabs } from "@/lib/bonus/publicado";
import { textoDaConfig } from "@/lib/bonus/textos";

// AS AÇÕES DO CARROSSEL AVULSO (spec da Etapa 7). O carrossel pronto usa as actions de sempre
// (app/bonus/carrossel-actions.ts e publicar-actions.ts), que trabalham pelo id do carrossel; aqui só
// o pedido e o "Gerar de novo".
//
// TODA ACTION COMEÇA CONFERINDO A SESSÃO, e não confia só no proxy.ts: Server Action tem endereço
// próprio. tests/bonus-avulso-paginas.test.ts confere que a primeira instrução de cada uma é
// `await exigirSessao();`.
//
// O BÔNUS DO LABS É LIDO AQUI, NO SERVIDOR, a cada pedido (avulso-processo.ts): do formulário vem só o
// código, e a palavra e o contexto vêm da lista pública. A conta é a do cookie, e nunca do formulário.

async function exigirSessao(): Promise<void> {
  const jarra = await cookies();
  if (!isValidSession(jarra.get(SESSION_COOKIE)?.value)) redirect("/entrar");
}

const lerSituacao = (codigo: string) => situacaoNoLabs(process.env.LABS_URL, codigo);

async function contaDoCookie(): Promise<string | undefined> {
  return (await cookies()).get(ACCOUNT_COOKIE)?.value;
}

/**
 * O "NOVO CARROSSEL". A recusa volta como ESTADO do formulário (useActionState), e nunca por redirect
 * (achado 52): recriar a página apagaria o que o operador escreveu, à mão inclusive. As recusas não
 * gravam nada. Sai por redirect só o carrossel criado, para a página dele; o da IA dispara a geração
 * no `after()`, como o pedido de carrossel de bônus.
 */
export async function pedirCarrosselAvulso(_anterior: AvisoDoAvulso | null, form: FormData): Promise<AvisoDoAvulso | null> {
  await exigirSessao();
  const recusa = (texto: string): AvisoDoAvulso => ({ tom: "erro", texto, em: Date.now() });
  const lido = lerPedidoAvulso({
    origem: form.get("origem"),
    codigo: form.get("codigo"),
    destaque: form.get("destaque"),
    tema: form.get("tema"),
    palavra: form.get("palavra"),
    conteudo: form.get("conteudo"),
    total: form.get("total"),
    jeito: form.get("jeito"),
  });
  if (!lido.ok) return recusa(textoDaRecusaDoPedidoAvulso(lido.motivo));
  if (lido.pedido.jeito === "ia" && !temChaveDaIA(process.env)) return recusa(textoDaConfig("sem_chave_ia"));
  // Os campos do texto escrito à mão, pelos nomes da tela (a fonte única deles, carrossel-texto.ts).
  const bruto = Object.fromEntries(camposDoFormulario(lido.pedido.total).map((c) => [c.nome, form.get(c.nome)]));
  const logada = contaSelecionada(await contasParaArte(), await contaDoCookie());
  const r = await pedirAvulso({ pedido: lido.pedido, bruto, conta: logada ? contaParaGuardar(logada) : null, lerSituacao });
  if (!r.ok) return recusa(r.texto);
  const id = r.id;
  if (r.gerar) after(() => processarCarrossel(id));
  redirect(`/carrosseis/${id}`);
}

/**
 * O "GERAR DE NOVO" DO AVULSO, na página dele. Um carrossel novo, da mesma origem, com a conta do
 * original (decisão do Eduardo em 02/10, a mesma do de bônus). As recusas voltam à página do carrossel
 * com o aviso na URL, como as do "Gerar de novo" do carrossel de bônus.
 */
export async function gerarAvulsoDeNovo(form: FormData): Promise<void> {
  await exigirSessao();
  const naoAchado = urlDoCarrosselComAviso("/carrosseis", { tom: "erro", texto: TEXTO_CARROSSEL_NAO_ENCONTRADO });
  const id = form.get("id");
  if (!ehIdDeBonus(id)) redirect(naoAchado);
  const linha = await lerCarrossel(id);
  if (!linha || !ehDaRota(linha, { tipo: "avulso" })) redirect(naoAchado);
  const caminho = caminhoDoCarrossel(linha);
  if (!temChaveDaIA(process.env)) redirect(urlDoCarrosselComAviso(caminho, { tom: "erro", texto: textoDaConfig("sem_chave_ia") }));
  const conta = contaParaGerarDeNovo(await contasParaArte(), escolhasDaArte(linha.arte, linha.total_slides), await contaDoCookie());
  const r = await gerarDeNovo({ linha, conta, lerSituacao, agora: Date.now() });
  if (!r.ok) redirect(urlDoCarrosselComAviso(caminho, { tom: "erro", texto: r.texto }));
  const novo = r.id;
  after(() => processarCarrossel(novo));
  redirect(`/carrosseis/${novo}`);
}
