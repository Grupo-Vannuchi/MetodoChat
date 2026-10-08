import { cookies } from "next/headers";
import { ACCOUNT_COOKIE } from "@/lib/account";
import { isValidSession, SESSION_COOKIE } from "@/lib/auth";
import { desenharSlide, erroDaArte as erro } from "@/lib/bonus/arte-rota";
import { conferirPedidoDaArte } from "@/lib/bonus/arte-tela";
import { TEXTO_ARTE_NAO_ENCONTRADA, TEXTO_ARTE_SEM_SESSAO } from "@/lib/bonus/arte-textos";
import { lerCarrossel } from "@/lib/bonus/carrossel-repositorio";
import { ehIdDeBonus } from "@/lib/bonus/pedido";

// A ARTE DE UM SLIDE DO CARROSSEL AVULSO (spec da Etapa 7), em PNG de 1080×1350: o mesmo desenho da
// arte do carrossel de bônus (lib/bonus/arte-rota.ts), com a mesma sessão conferida antes de tudo. Esta
// rota só serve o avulso: o carrossel de bônus dá 404 aqui (carrossel-caminho.ts, `ehDaRota`).
//
// A SESSÃO É CONFERIDA AQUI, e não só no proxy.ts, pelo mesmo motivo da rota do bônus: o caminho
// termina em /arte, e um 401 é melhor que um redirect que viraria imagem quebrada.
// tests/bonus-arte-paginas.test.ts confere que isto é a primeira coisa do GET.
//
// O arquivo baixado leva o código do bônus do Labs, ou "carrossel" no texto livre (`nomeDoArquivo`).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ cid: string }> }) {
  const jarra = await cookies();
  if (!isValidSession(jarra.get(SESSION_COOKIE)?.value)) return erro(401, TEXTO_ARTE_SEM_SESSAO);
  const { cid } = await params;
  if (!ehIdDeBonus(cid)) return erro(404, TEXTO_ARTE_NAO_ENCONTRADA);
  const pedido = new URL(request.url).searchParams;
  const conferido = conferirPedidoDaArte(await lerCarrossel(cid), { tipo: "avulso" }, pedido.get("slide"));
  if (!conferido.ok) return erro(conferido.status, conferido.texto);
  return desenharSlide({
    ...conferido,
    doCookie: jarra.get(ACCOUNT_COOKIE)?.value,
    baixar: pedido.get("baixar") === "1",
    slug: async () => conferido.linha.labs_codigo,
  });
}
