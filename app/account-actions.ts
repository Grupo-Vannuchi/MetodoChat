"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { ACCOUNT_COOKIE } from "@/lib/account";
import { podeVerConta } from "@/lib/acesso";
import { exigirSessao } from "@/lib/exigir-sessao";
import { sessaoAtual } from "@/lib/sessao";

// Troca a conta ativa do painel (server action chamada pelo seletor).
export async function selectAccount(formData: FormData): Promise<void> {
  await exigirSessao();
  const id = String(formData.get("account_id") ?? "");
  const login = await sessaoAtual();
  // ESTE `return;` FICA MUDO DE PROPÓSITO, e não é o esquecimento que o resto
  // desta branch existe para fechar. Duas razões, e as duas precisam ser
  // verdade juntas:
  //
  //   1. É GUARDA DE FORMULÁRIO MALFORMADO, não recusa de pedido legítimo. O
  //      seletor de conta é um MENU DE BOTÕES (`app/account-switcher.tsx`),
  //      montado por `accounts.map`: cada botão chama `selectAccount` com um
  //      `FormData` cujo `account_id` sai de `a.ig_user_id`, nunca de campo
  //      livre — e, desde as contas por login
  //      (docs/specs/2026-11-05-contas-por-login.md, seção 2), `accounts` é a
  //      lista de `contasDoLogin` (app/layout.tsx): O SELETOR SÓ MOSTRA AS
  //      CONTAS DO LOGIN. Não há caminho na UI para submeter isto vazio, nem com
  //      uma conta que o login não vê (`podeVerConta`, lib/acesso.ts). Os dois só
  //      chegam aqui por um POST montado à mão, e nesse caso não há "conta que o
  //      dono queria" para relatar: nenhuma escolha do seletor foi feita.
  //
  //      (Aqui se lia "um `<select>` cujas opções são as próprias contas". O
  //      argumento estava certo e o widget, errado — e uma varredura futura
  //      procuraria um `<select>` que não existe.)
  //   2. QUANDO A CONTA TROCA DE VERDADE, O RESULTADO JÁ É VISÍVEL — a conta
  //      muda na tela (o `revalidatePath` abaixo cuida disso). Um aviso aqui
  //      só teria trabalho a fazer nos caminhos recusados, que são justamente
  //      os inatingíveis pela UI.
  //
  // E A RECUSA NÃO GRAVA NADA: um cookie de conta que o login não vê seria
  // ignorado pela conta escolhida de qualquer jeito (`contaEscolhida`), mas
  // gravá-lo deixaria no navegador uma escolha que ninguém fez.
  //
  // Este comentário existe para a próxima varredura não tratar este `return;`
  // como um dos mudos desta branch.
  if (!id || !login || !(await podeVerConta(login, id))) return;
  (await cookies()).set(ACCOUNT_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  // revalida todo o layout: dashboard, automações e contatos mudam de conta
  revalidatePath("/", "layout");
}
