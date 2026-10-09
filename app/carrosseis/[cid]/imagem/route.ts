import { cookies } from "next/headers";
import { ACCOUNT_COOKIE } from "@/lib/account";
import { isValidSession, SESSION_COOKIE } from "@/lib/auth";
import { conferirPedidoDaArte } from "@/lib/bonus/arte-tela";
import { TEXTO_ARTE_NAO_ENCONTRADA, TEXTO_ARTE_SEM_SESSAO } from "@/lib/bonus/arte-textos";
import { lerCarrossel } from "@/lib/bonus/carrossel-repositorio";
import { consultarImagem, respostaDaConsulta } from "@/lib/bonus/imagem-consulta";
import { ehIdDeBonus } from "@/lib/bonus/pedido";

// A CONSULTA DA IMAGEM DE UM SLIDE DO CARROSSEL AVULSO (spec da Etapa 6, "O acompanhar"): a mesma da rota
// do carrossel de bônus (lib/bonus/imagem-consulta.ts), com a mesma sessão conferida antes de tudo. Esta
// rota só serve o avulso: o carrossel de bônus dá 404 aqui (carrossel-caminho.ts, `ehDaRota`). SÓ LÊ.
//
// É uma rota GET, e não uma action, para nunca entrar na fila das actions da página (achado 88).
// tests/bonus-imagem-paginas.test.ts confere que a sessão é a primeira coisa do GET.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ cid: string }> }) {
  const jarra = await cookies();
  if (!isValidSession(jarra.get(SESSION_COOKIE)?.value)) return respostaDaConsulta({ erro: TEXTO_ARTE_SEM_SESSAO }, 401);
  const { cid } = await params;
  if (!ehIdDeBonus(cid)) return respostaDaConsulta({ erro: TEXTO_ARTE_NAO_ENCONTRADA }, 404);
  const conferido = conferirPedidoDaArte(await lerCarrossel(cid), { tipo: "avulso" }, new URL(request.url).searchParams.get("slide"));
  if (!conferido.ok) return respostaDaConsulta({ erro: conferido.texto }, conferido.status);
  return respostaDaConsulta(await consultarImagem({ linha: conferido.linha, numero: conferido.numero, doCookie: jarra.get(ACCOUNT_COOKIE)?.value }));
}
