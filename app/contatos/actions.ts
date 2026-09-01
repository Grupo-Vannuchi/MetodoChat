"use server";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { getSelectedAccount } from "@/lib/account";
import { getUserProfile } from "@/lib/ig";
import { enqueueLote } from "@/lib/engine";
import { contatosDoFiltro, filtroDaUrl } from "@/lib/categorias";
import { urlDeLoteValida } from "@/lib/lote";

// Preenche nome/@ dos contatos que ficaram salvos só com o número (IGSID),
// criados antes de o app buscar o perfil na hora do webhook.
export async function atualizarPerfis(): Promise<void> {
  const account = await getSelectedAccount();
  if (!account) return;

  const rows = (await sql().query(
    `select ig_id from contacts
     where account_id = $1 and username is null
     order by first_contact_at desc limit 30`,
    [account.ig_user_id]
  )) as { ig_id: string }[];

  for (const r of rows) {
    try {
      const p = await getUserProfile(r.ig_id, account.access_token);
      await sql().query(
        `update contacts set
           username = coalesce($3, username),
           name = coalesce($4, name),
           profile_pic = coalesce($5, profile_pic)
         where account_id = $1 and ig_id = $2`,
        [account.ig_user_id, r.ig_id, p.username ?? null, p.name ?? null, p.profile_pic ?? null]
      );
    } catch {
      // perfil indisponível (conta privada/apagada ou só comentou): pula
    }
  }
  revalidatePath("/contatos");
}

/**
 * Enfileira um lote para os contatos do filtro atual.
 *
 * A CONFIRMAÇÃO É A ÚLTIMA COISA entre um engano e quarenta pessoas, e por isso
 * ela é um campo do formulário e não um `confirm()` do navegador: sem o campo
 * marcado, esta função não faz nada.
 *
 * O `account_id` no `where` vem do cookie, nunca do formulário — o mesmo
 * cuidado de `definirCategoria`.
 */
export async function enviarLote(formData: FormData): Promise<void> {
  const account = await getSelectedAccount();
  if (!account) return;
  if (formData.get("confirmado") !== "1") return;

  const texto = String(formData.get("texto") ?? "").trim();
  if (!texto) return;

  const url = String(formData.get("url") ?? "").trim();
  // A URL ERRADA BARRA O PEDIDO INTEIRO, e não vira mensagem sem link: quem
  // digitou um endereço esperava um botão de verdade, e mandar o texto calado
  // sem avisar seria trocar o pedido do dono por outro que ele não fez. Ver o
  // porquê em `urlDeLoteValida` (lib/lote.ts).
  if (url && !urlDeLoteValida(url)) return;

  const rotulo = String(formData.get("rotulo") ?? "").trim();
  const prazo = String(formData.get("valido_ate") ?? "").trim();
  const filtro = filtroDaUrl(String(formData.get("categoria") ?? "") || undefined);

  const linhas = (await sql().query(
    `select c.ig_id, c.categoria, c.last_reply_at,
            (select count(*)::int from events e
              where e.account_id = c.account_id
                and e.payload->'sender'->>'id' = c.ig_id
                and e.type in ('message','story_reply','abertura','quick_reply')) as recebidas
       from contacts c where c.account_id = $1`,
    [account.ig_user_id]
  )) as { ig_id: string; categoria: string | null; last_reply_at: Date | null; recebidas: number }[];

  const alvo = contatosDoFiltro(linhas, filtro);
  if (!alvo.length) return;

  await enqueueLote(account.ig_user_id, crypto.randomUUID(), alvo.map((c) => c.ig_id), {
    text: texto,
    url: url || undefined,
    buttonLabel: rotulo || undefined,
    // Data vazia é "sem prazo", e não data inválida.
    validoAte: prazo ? new Date(prazo).toISOString() : null,
  });

  revalidatePath("/contatos");
  revalidatePath("/eventos");
}
