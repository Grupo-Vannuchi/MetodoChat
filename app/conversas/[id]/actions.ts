"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSelectedAccount } from "@/lib/account";
import { enqueueManualReply } from "@/lib/engine";
import { drainQueue } from "@/lib/queue-drain";
import { windowState } from "@/lib/inbox-window";
import { sql } from "@/lib/db";
import { normalizarCategoria } from "@/lib/categorias";
import { urlDaConversaComAviso, avisoDaCategoriaSalva } from "@/lib/avisos";

export async function sendReply(
  _prev: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const account = await getSelectedAccount();
  if (!account) return { error: "Conecte uma conta do Instagram primeiro." };

  const contactIgId = String(formData.get("contact") ?? "");
  const text = String(formData.get("text") ?? "").trim();
  if (!/^\d{1,32}$/.test(contactIgId)) return { error: "Conversa inválida." };
  if (!text) return { error: "Escreva alguma coisa antes de enviar." };
  // Limite da Meta para o corpo da mensagem.
  if (text.length > 1000) return { error: "A mensagem passa de 1.000 caracteres." };

  // Confere a janela AQUI também, e não só na tela: entre carregar a página e
  // clicar em enviar podem ter passado horas.
  const rows = (await sql().query(
    `select last_reply_at from contacts where account_id = $1 and ig_id = $2`,
    [account.ig_user_id, contactIgId]
  )) as { last_reply_at: Date | null }[];
  if (!windowState(rows[0]?.last_reply_at ?? null).open) {
    return { error: "A janela de 24h fechou. Só é possível responder quem falou há menos de 24h." };
  }

  await enqueueManualReply(account.ig_user_id, contactIgId, text);

  // Enfileirar NÃO envia. O enqueue só agenda um toque do QStash para item com
  // atraso; uma resposta digitada agora não tem atraso nenhum. Sem esta
  // drenagem, a mensagem ficaria parada até o próximo evento do Instagram ou
  // até o cron diário das 9h — e a janela de 24h pode fechar antes disso, o que
  // faria o item ser descartado em silêncio DEPOIS de o atendente ver sucesso.
  //
  // AGUARDA o envio, e isso é deliberado. Antes ia em after(), como no webhook.
  // Mas os dois casos não são o mesmo: a Meta exige que o webhook responda
  // rápido; uma pessoa que clicou "Enviar" não precisa de resposta rápida, e sim
  // de resposta CERTA.
  //
  // Com after(), o revalidatePath abaixo rodava ANTES de o envio terminar, então
  // a tela voltava dizendo "enviando…" — verdade naquele instante, mentira dois
  // segundos depois. Sobrava ao navegador perceber sozinho, e isso falhou duas
  // vezes em produção: o balão ficava "enviando…" até alguém dar F5, com a
  // mensagem já entregue.
  //
  // Esperar custa os ~2s reais da entrega, com o botão em "Enviando…" — que é o
  // que um aplicativo de mensagem faz. Em troca, a tela que volta já mostra o
  // horário ou "não enviada", certa de primeira, sem depender de o JavaScript da
  // página estar de pé.
  try {
    await drainQueue();
  } catch {
    // A trava atômica garante que o próximo dreno recupera. O item fica
    // 'pending' e o balão mostra "enviando…", que aqui é verdade.
  }

  revalidatePath(`/conversas/${contactIgId}`);
  return {};
}

/**
 * Marca (ou desmarca) a categoria de um contato.
 *
 * QUEM DECIDE O NOME É `normalizarCategoria`, e não esta função: `Aluno` e
 * `aluno ` têm de gravar a MESMA coisa, senão o filtro da lista passa a mentir.
 * Campo em branco grava `null` — é o pedido legítimo de "tirar a categoria".
 *
 * O `account_id` no `where` é o que impede marcar contato de outra conta: o
 * identificador vem do formulário, e formulário é do navegador.
 *
 * OS TRÊS `return;` MUDOS VIRARAM `redirect` COM AVISO, no molde de
 * `enviarLote` (app/contatos/actions.ts) — inclusive o de sucesso, que antes
 * não existia nenhum: a tela recarregava igual estivesse a gravação certa,
 * errada ou nem tentada.
 *
 * A URL DE VOLTA NÃO É `/contatos`, e não tem `?categoria=` — é a própria
 * conversa (`urlDaConversaComAviso`, lib/avisos.ts). Esta tela não tem filtro
 * de categoria: forçar `urlDoAviso` aqui exigiria inventar um
 * `FiltroDeCategoria` que não representa nada desta tela, só para chegar a
 * uma URL (`/conversas/[id]?...`) que aquela função nunca foi desenhada para
 * produzir — por isso a função nova, com teste próprio.
 *
 * `contactIgId` É LIDO ANTES DE QUALQUER RECUSA, e não só depois de conferir a
 * conta como antes: os três caminhos de saída — sem conta, formato inválido,
 * sucesso — precisam dele para montar a URL de volta.
 */
export async function definirCategoria(formData: FormData): Promise<void> {
  const contactIgId = String(formData.get("contato") ?? "");

  const account = await getSelectedAccount();
  if (!account) {
    redirect(
      urlDaConversaComAviso(contactIgId, {
        tom: "erro",
        texto: "Conecte uma conta do Instagram primeiro.",
      })
    );
  }

  // Mesmo formato que `sendReply`, acima, já exige para este campo. Não é
  // brecha — o `and account_id = $1` do update abaixo fecha o escopo mesmo
  // sem isto —, mas sem validar, um id malformado gasta um update de zero
  // linhas e um revalidatePath num caminho que não existe. Mesma frase que
  // `sendReply` já usa para o mesmo defeito de formato.
  if (!/^\d{1,32}$/.test(contactIgId)) {
    redirect(
      urlDaConversaComAviso(contactIgId, {
        tom: "erro",
        texto: "Conversa inválida.",
      })
    );
  }

  const categoria = normalizarCategoria(formData.get("categoria"));

  await sql().query(
    `update contacts set categoria = $3 where account_id = $1 and ig_id = $2`,
    [account.ig_user_id, contactIgId, categoria]
  );

  revalidatePath(`/conversas/${contactIgId}`);
  revalidatePath("/contatos");

  redirect(urlDaConversaComAviso(contactIgId, avisoDaCategoriaSalva(categoria)));
}
