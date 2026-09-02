"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { ACCOUNT_COOKIE } from "@/lib/account";

// Troca a conta ativa do painel (server action chamada pelo seletor).
export async function selectAccount(formData: FormData): Promise<void> {
  const id = String(formData.get("account_id") ?? "");
  // ESTE `return;` FICA MUDO DE PROPÓSITO, e não é o esquecimento que o resto
  // desta branch existe para fechar. Duas razões, e as duas precisam ser
  // verdade juntas:
  //
  //   1. É GUARDA DE FORMULÁRIO MALFORMADO, não recusa de pedido legítimo. O
  //      seletor de conta é um MENU DE BOTÕES (`app/account-switcher.tsx`),
  //      montado por `accounts.map`: cada botão chama `selectAccount` com um
  //      `FormData` cujo `account_id` sai de `a.ig_user_id`, nunca de campo
  //      livre — não há caminho na UI para submeter isto vazio. Só chega aqui
  //      vazio por um POST montado à mão, e nesse caso não há "conta que o
  //      dono queria" para relatar: nenhuma escolha foi feita.
  //
  //      (Aqui se lia "um `<select>` cujas opções são as próprias contas". O
  //      argumento estava certo e o widget, errado — e uma varredura futura
  //      procuraria um `<select>` que não existe.)
  //   2. QUANDO A CONTA TROCA DE VERDADE, O RESULTADO JÁ É VISÍVEL — a conta
  //      muda na tela (o `revalidatePath` abaixo cuida disso). Um aviso aqui
  //      só teria trabalho a fazer no caminho vazio, que é justamente o
  //      caminho inatingível pela UI.
  //
  // Este comentário existe para a próxima varredura não tratar este `return;`
  // como um dos mudos desta branch.
  if (!id) return;
  (await cookies()).set(ACCOUNT_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  // revalida todo o layout: dashboard, automações e contatos mudam de conta
  revalidatePath("/", "layout");
}
