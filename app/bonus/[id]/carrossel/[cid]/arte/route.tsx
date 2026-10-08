import { cookies } from "next/headers";
import { ACCOUNT_COOKIE } from "@/lib/account";
import { isValidSession, SESSION_COOKIE } from "@/lib/auth";
import { desenharSlide, erroDaArte as erro } from "@/lib/bonus/arte-rota";
import { conferirPedidoDaArte } from "@/lib/bonus/arte-tela";
import { TEXTO_ARTE_NAO_ENCONTRADA, TEXTO_ARTE_SEM_SESSAO } from "@/lib/bonus/arte-textos";
import { lerCarrossel } from "@/lib/bonus/carrossel-repositorio";
import { ehIdDeBonus } from "@/lib/bonus/pedido";
import { lerLinha } from "@/lib/bonus/repositorio";

// A ARTE DE UM SLIDE DO CARROSSEL, em PNG de 1080×1350: um slide por pedido, desenhado na hora a
// partir do texto salvo (o revisado, ou o gerado). Nada é guardado. O desenho inteiro está em
// docs/specs/2026-10-01-arte-do-carrossel.md.
//
// A SESSÃO É CONFERIDA AQUI, e não só no proxy.ts: o caminho termina em /arte, e não em .png (o
// proxy deixa passar sem sessão o que termina em .png, .jpg, .svg e .ico), mas a rota não depende
// disso. Sem sessão, 401 (e não um redirect, que viraria imagem quebrada sem explicação).
// tests/bonus-arte-paginas.test.ts confere que isto é a primeira coisa do GET.
//
// `?slide=N` escolhe o slide (1 ao total); `?baixar=1` vira download com nome de arquivo; `?v=` é a
// versão da prévia, que esta rota ignora (arte-tela.ts, `versaoDaArte`).
//
// O DESENHO MORA EM lib/bonus/arte-rota.ts (Etapa 7), comum a esta rota e à do carrossel avulso
// (app/carrosseis/[cid]/arte/route.tsx). Esta só serve o carrossel do bônus da URL.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; cid: string }> }) {
  const jarra = await cookies();
  if (!isValidSession(jarra.get(SESSION_COOKIE)?.value)) return erro(401, TEXTO_ARTE_SEM_SESSAO);
  const { id, cid } = await params;
  if (!ehIdDeBonus(id) || !ehIdDeBonus(cid)) return erro(404, TEXTO_ARTE_NAO_ENCONTRADA);
  const pedido = new URL(request.url).searchParams;
  // O dono, o "pronto" e o slide: arte-tela.ts, `conferirPedidoDaArte`, com um caso por recusa.
  const conferido = conferirPedidoDaArte(await lerCarrossel(cid), { tipo: "bonus", bonusId: id }, pedido.get("slide"));
  if (!conferido.ok) return erro(conferido.status, conferido.texto);
  return desenharSlide({
    ...conferido,
    doCookie: jarra.get(ACCOUNT_COOKIE)?.value,
    baixar: pedido.get("baixar") === "1",
    // O arquivo baixado leva o endereço do bônus no Labs.
    slug: async () => (await lerLinha(id))?.slug ?? null,
  });
}
