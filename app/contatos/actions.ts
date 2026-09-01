"use server";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { getSelectedAccount } from "@/lib/account";
import { getUserProfile } from "@/lib/ig";
import { enqueueLote } from "@/lib/engine";
import { alvoDoLote, filtroDoCampo, urlDeLoteValida, validadeDoDia } from "@/lib/lote";

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
 * QUEM DECIDE QUEM RECEBE É `alvoDoLote` (lib/lote.ts), E NÃO ESTA FUNÇÃO. As
 * três perguntas que ela responde — o recorte, a confirmação e a conta — moravam
 * aqui soltas, e as três eram invisíveis para os portões: apagar cada uma
 * passava por lint, typecheck, 938 testes puros e 70 de integração sem uma linha
 * vermelha. Uma delas mandava a ficha "sem categoria" para a conta INTEIRA.
 * Agora elas têm caso em `tests/lote.test.ts`.
 *
 * O `account_id` do `where` continua vindo do cookie, nunca do formulário — o
 * mesmo cuidado de `definirCategoria` —, e `alvoDoLote` o confere DE NOVO sobre
 * a linha que voltou.
 */
export async function enviarLote(formData: FormData): Promise<void> {
  const account = await getSelectedAccount();
  if (!account) return;

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
  // O CAMPO NÃO CARREGA MAIS O VALOR CRU DA URL: `?categoria=` ausente e
  // `?categoria=` vazio são pedidos DIFERENTES, e um `<input type="hidden">`
  // sempre existe no DOM — os dois chegavam aqui como `""`. Ver `campoDoFiltro`
  // (lib/lote.ts) para a medição.
  const filtro = filtroDoCampo(formData.get("categoria"));

  const linhas = (await sql().query(
    `select c.ig_id, c.account_id, c.categoria, c.last_reply_at,
            (select count(*)::int from events e
              where e.account_id = c.account_id
                and e.payload->'sender'->>'id' = c.ig_id
                and e.type in ('message','story_reply','abertura','quick_reply')) as recebidas
       from contacts c where c.account_id = $1`,
    [account.ig_user_id]
  )) as {
    ig_id: string;
    account_id: string;
    categoria: string | null;
    last_reply_at: Date | null;
    recebidas: number;
  }[];

  const alvo = alvoDoLote(linhas, {
    conta: account.ig_user_id,
    filtro,
    confirmado: formData.get("confirmado") === "1",
  });
  if (!alvo.length) return;

  await enqueueLote(account.ig_user_id, crypto.randomUUID(), alvo.map((c) => c.ig_id), {
    text: texto,
    url: url || undefined,
    buttonLabel: rotulo || undefined,
    // O DIA ESCOLHIDO VALE INTEIRO, e quem sabe disso é `validadeDoDia`
    // (lib/lote.ts): `new Date("2026-09-07")` é meia-noite UTC, ou seja 06/09 às
    // 21:00 em Brasília — o prazo vencia 27 horas antes do que o dono pediu.
    // Data vazia (e data impossível) continua sendo "sem prazo".
    validoAte: validadeDoDia(prazo),
  });

  revalidatePath("/contatos");
  revalidatePath("/eventos");
}
