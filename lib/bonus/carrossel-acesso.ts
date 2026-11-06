import "server-only";
import { cookies } from "next/headers";
import { ACCOUNT_COOKIE } from "@/lib/account";
import { podeVerConta, soAsDoLogin } from "@/lib/acesso";
import { escolherConta } from "@/lib/acesso-escolha";
import { sessaoAtual } from "@/lib/sessao";
import type { ContaDoCabecalho } from "./arte-conta";
import { escolhasDaArte } from "./arte-escolhas";
import { contasParaArte, lerCarrossel } from "./carrossel-repositorio";

// O CARROSSEL E AS CONTAS DO LOGIN (docs/specs/2026-11-05-contas-por-login.md, seção 3, "Os carrosséis").
// Todo login vê e edita todos os carrosséis; escolher a conta de um carrossel, gerar e subir imagens,
// publicar e apagar um carrossel que já tem conta só valem nas contas que o login recebeu.
//
// ESTE ARQUIVO NÃO DECIDE NADA SOZINHO: ele pergunta à regra de lib/acesso.ts, o único lugar que sabe quem
// vê qual conta, com o login da sessão. Aqui só mora a forma que o carrossel precisa: a lista de cabeçalhos
// (só as quatro colunas, achado 60), a conta do menu nessa lista, e a pergunta "este carrossel é de uma
// conta que o login não tem?".

/** As contas do login, como o cabeçalho da arte as usa. Sem login, nenhuma. */
export async function cabecalhosDoLogin(): Promise<ContaDoCabecalho[]> {
  const login = await sessaoAtual();
  if (!login) return [];
  return soAsDoLogin(login, await contasParaArte());
}

/**
 * A CONTA DO MENU, PARA O CARROSSEL: a do cookie, se estiver entre as do login; senão, a primeira delas;
 * senão, nenhuma.
 *
 * POR QUE NÃO `getSelectedAccountId` (lib/account.ts): ela passa pela linha inteira da conta, com o
 * `access_token`, e a arte e as actions do carrossel leem só as quatro colunas do cabeçalho, nunca a linha
 * com o token (achado 60, tests/bonus-arte-paginas.test.ts). A ESCOLHA É A MESMA DELA: a mesma lista do login
 * (`soAsDoLogin`, a regra de lib/acesso.ts), na mesma ordem (`created_at`, a de `contasParaArte` e a de
 * `listAccounts`), e a mesma escolha pura (`escolherConta`, lib/acesso-escolha.ts).
 *
 * O COOKIE CRU DA CONTA É LIDO SÓ AQUI, e só desempata dentro das contas do login: um cookie de outra conta
 * no navegador não escolhe nada fora delas.
 */
export async function contaDoMenuNoCarrossel(): Promise<ContaDoCabecalho | null> {
  return escolherConta(await cabecalhosDoLogin(), (await cookies()).get(ACCOUNT_COOKIE)?.value);
}

/**
 * Se o carrossel tem conta gravada e o login não a vê: a recusa das ações que agem na conta do carrossel.
 * Sem login, sempre (a ação já teria ido para /entrar). O carrossel sem conta é de todos, e o que não existe
 * fica para o processo dizer o "não achado" dele.
 */
export async function carrosselDeOutraConta(id: string): Promise<boolean> {
  const login = await sessaoAtual();
  if (!login) return true;
  const linha = await lerCarrossel(id);
  if (!linha) return false;
  const { conta } = escolhasDaArte(linha.arte, linha.total_slides);
  if (!conta) return false;
  return !(await podeVerConta(login, conta));
}
