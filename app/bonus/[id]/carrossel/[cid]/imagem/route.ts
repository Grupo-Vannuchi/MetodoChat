import { cookies } from "next/headers";
import { ACCOUNT_COOKIE } from "@/lib/account";
import { isValidSession, SESSION_COOKIE } from "@/lib/auth";
import { conferirPedidoDaArte } from "@/lib/bonus/arte-tela";
import { TEXTO_ARTE_NAO_ENCONTRADA, TEXTO_ARTE_SEM_SESSAO } from "@/lib/bonus/arte-textos";
import { lerCarrossel } from "@/lib/bonus/carrossel-repositorio";
import { consultarImagem, respostaDaConsulta } from "@/lib/bonus/imagem-consulta";
import { ehIdDeBonus } from "@/lib/bonus/pedido";

// A CONSULTA DA IMAGEM DE UM SLIDE DO CARROSSEL DE BÔNUS (spec da Etapa 6, "O acompanhar"), em JSON: o
// card pergunta a cada 2 s enquanto a imagem gera. É uma rota GET, e não uma action, para nunca entrar na
// fila das actions da página (achado 88). SÓ LÊ.
//
// A SESSÃO É CONFERIDA AQUI, como na rota da arte ao lado, e não só no proxy.ts. Sem sessão, 401.
// tests/bonus-imagem-paginas.test.ts confere que isto é a primeira coisa do GET.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; cid: string }> }) {
  const jarra = await cookies();
  if (!isValidSession(jarra.get(SESSION_COOKIE)?.value)) return respostaDaConsulta({ erro: TEXTO_ARTE_SEM_SESSAO }, 401);
  const { id, cid } = await params;
  if (!ehIdDeBonus(id) || !ehIdDeBonus(cid)) return respostaDaConsulta({ erro: TEXTO_ARTE_NAO_ENCONTRADA }, 404);
  // O dono, o "pronto" e o slide, pela mesma conferência da rota da arte.
  const conferido = conferirPedidoDaArte(await lerCarrossel(cid), { tipo: "bonus", bonusId: id }, new URL(request.url).searchParams.get("slide"));
  if (!conferido.ok) return respostaDaConsulta({ erro: conferido.texto }, conferido.status);
  return respostaDaConsulta(await consultarImagem({ linha: conferido.linha, numero: conferido.numero, doCookie: jarra.get(ACCOUNT_COOKIE)?.value }));
}
