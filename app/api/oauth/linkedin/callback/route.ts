import { NextRequest, NextResponse } from "next/server";
import { OAUTH_CONVITE_COOKIE, OAUTH_STATE_COOKIE, oauthStateConfere } from "@/lib/auth";
import { getConfig } from "@/lib/db";
import { canonicalAppUrl } from "@/lib/app-url";
import { estadoDoConvite, textoParaOPainel, type MotivoDoErro } from "@/lib/convites";
import { anotarErroDoConvite, conviteDoId, reivindicarEGravarConexao } from "@/lib/convites-repositorio";
import {
  ambienteDaVercel,
  baseDoPainelParaOLinkedin,
  CAMINHO_DA_VOLTA_DO_LINKEDIN,
  credenciaisDoLinkedin,
  pessoaDoLinkedin,
  temPermissaoDePublicar,
  trocarCodigoDoLinkedin,
} from "@/lib/linkedin";

export const maxDuration = 60;

// A VOLTA DO LINKEDIN PELO LINK DE CONVITE (docs/specs/2026-11-06-linkedin-no-perfil.md, §3; a parte 1, a
// conexão). É pública, porque `/api/oauth` está na PUBLIC_PREFIXES do proxy.ts: quem chega aqui é o cliente,
// vindo do LinkedIn, sem a senha do painel. Só o convite do LinkedIn conecta por aqui, e só por convite.
//
// QUEM CONECTOU É O CLIENTE: o fim é uma das duas páginas abertas do convite (`/convite/pronto` ou
// `/convite/erro`, com `rede=linkedin`), nunca o painel. Nada do texto do LinkedIn chega ao cliente: ele vai,
// limpo dos segredos e cortado, para o `ultimo_erro` do convite, que só o painel mostra.
//
// A ORDEM É A DA SPEC, a mesma da volta do Instagram (app/api/oauth/callback/convite.ts):
// 1. o `state` e o cookie do convite, antes de qualquer escrita: sem eles, a volta não é de ninguém;
// 2. a recusa no LinkedIn;
// 3. o convite pendente, do LinkedIn, antes de chamar o LinkedIn (a conta-alvo apagada leva o convite junto);
// 4. a troca do código, a permissão de publicar e o `userinfo`, fora da transação, para ela não ficar aberta
//    durante a rede;
// 5. a reivindicação e a conexão, numa transação só (`reivindicarEGravarConexao`), na conta-alvo do convite.
//    Uma reconexão com outra pessoa troca a pessoa e o nome;
// 6. os dois cookies apagados em toda saída.
export async function GET(req: NextRequest): Promise<NextResponse> {
  const appUrl = req.nextUrl.origin;
  const q = req.nextUrl.searchParams;
  const conviteId = req.cookies.get(OAUTH_CONVITE_COOKIE)?.value ?? "";

  // OS DOIS COOKIES SÃO APAGADOS EM TODA RESPOSTA, dê certo ou não: cada `state` e cada convite servem uma
  // tentativa.
  const fim = (caminho: string) => {
    const res = NextResponse.redirect(`${appUrl}${caminho}`);
    res.cookies.set(OAUTH_STATE_COOKIE, "", { path: "/api/oauth", maxAge: 0 });
    res.cookies.set(OAUTH_CONVITE_COOKIE, "", { path: "/api/oauth", maxAge: 0 });
    return res;
  };
  const erro = (motivo: MotivoDoErro) => fim(`/convite/erro?motivo=${motivo}&rede=linkedin`);
  // Anotar não pode derrubar a resposta: o cliente vê a frase do erro de qualquer jeito.
  const anotar = async (texto: string) => {
    try {
      await anotarErroDoConvite(conviteId, texto, "pendente");
    } catch {
      // banco fora do ar: a frase do erro ainda chega ao cliente
    }
  };

  if (!conviteId || !oauthStateConfere(req.cookies.get(OAUTH_STATE_COOKIE)?.value, q.get("state"))) {
    return erro("falhou");
  }

  if (q.get("error")) {
    await anotar("autorização negada no LinkedIn");
    return erro("negado");
  }

  const convite = await conviteDoId(conviteId);
  if (!convite || convite.rede !== "linkedin" || estadoDoConvite(convite, Date.now()) !== "pendente") {
    return erro("vencido");
  }

  const code = q.get("code");
  if (!code) {
    await anotar("código ausente");
    return erro("falhou");
  }
  const chaves = credenciaisDoLinkedin();
  if (!chaves) {
    await anotar("as chaves do app do LinkedIn não estão nas variáveis da Vercel");
    return erro("falhou");
  }

  // OS SEGREDOS DESTA VOLTA, que nunca vão para o `ultimo_erro` (achado 159).
  const segredos: (string | null | undefined)[] = [code, chaves.clientSecret];
  const mensagem = (err: unknown) => (err instanceof Error ? err.message : "erro desconhecido");

  let pessoa: Parameters<typeof reivindicarEGravarConexao>[1];
  try {
    const config = await getConfig();
    const troca = await trocarCodigoDoLinkedin({
      ...chaves,
      // precisa ser IDÊNTICO ao usado no começo (app/api/oauth/convite/[codigo]/route.ts)
      redirectUri: `${baseDoPainelParaOLinkedin(ambienteDaVercel(), canonicalAppUrl(config.app_url, appUrl))}${CAMINHO_DA_VOLTA_DO_LINKEDIN}`,
      code,
    });
    segredos.push(troca.accessToken);
    if (!temPermissaoDePublicar(troca.scope)) {
      await anotar("o LinkedIn não deu a permissão de publicar (w_member_social)");
      return erro("falhou");
    }
    const quem = await pessoaDoLinkedin(troca.accessToken);
    pessoa = {
      pessoa_id: quem.sub,
      nome: quem.nome,
      access_token: troca.accessToken,
      expira_em: new Date(Date.now() + troca.expiraEmSegundos * 1000),
    };
  } catch (err) {
    await anotar(textoParaOPainel(mensagem(err), segredos));
    return erro("falhou");
  }

  let conta: string | null;
  try {
    conta = await reivindicarEGravarConexao(conviteId, pessoa);
  } catch (err) {
    await anotar(textoParaOPainel(mensagem(err), segredos));
    return erro("falhou");
  }
  // Outra aba com o mesmo link, ou o convite cancelado no meio: a conexão não foi gravada.
  if (!conta) return erro("vencido");

  return fim("/convite/pronto?rede=linkedin");
}
