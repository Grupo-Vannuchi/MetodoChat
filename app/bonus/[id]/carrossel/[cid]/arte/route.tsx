import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCOUNT_COOKIE } from "@/lib/account";
import { isValidSession, SESSION_COOKIE } from "@/lib/auth";
import { resolverConta } from "@/lib/bonus/arte-conta";
import { comEspaco, escolhasDaArte } from "@/lib/bonus/arte-escolhas";
import { fotosDaInstancia } from "@/lib/bonus/arte-foto";
import { respostaDaArte } from "@/lib/bonus/arte-resposta";
import { cabecalhoDaConta, conferirPedidoDaArte, nomeDoArquivo } from "@/lib/bonus/arte-tela";
import {
  TEXTO_ARTE_NAO_ENCONTRADA,
  TEXTO_ARTE_SEM_CONTA,
  TEXTO_ARTE_SEM_DESENHO,
  TEXTO_ARTE_SEM_FONTE,
  TEXTO_ARTE_SEM_SESSAO,
} from "@/lib/bonus/arte-textos";
import { contasParaArte, lerCarrossel } from "@/lib/bonus/carrossel-repositorio";
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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function erro(status: number, texto: string): NextResponse {
  return NextResponse.json({ ok: false, erro: texto }, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string; cid: string }> }) {
  const jarra = await cookies();
  if (!isValidSession(jarra.get(SESSION_COOKIE)?.value)) return erro(401, TEXTO_ARTE_SEM_SESSAO);
  const { id, cid } = await params;
  if (!ehIdDeBonus(id) || !ehIdDeBonus(cid)) return erro(404, TEXTO_ARTE_NAO_ENCONTRADA);
  const pedido = new URL(request.url).searchParams;
  // O dono, o "pronto" e o slide: arte-tela.ts, `conferirPedidoDaArte`, com um caso por recusa.
  const conferido = conferirPedidoDaArte(await lerCarrossel(cid), id, pedido.get("slide"));
  if (!conferido.ok) return erro(conferido.status, conferido.texto);
  const { linha, slides, numero } = conferido;

  // A conta do cabeçalho é a do carrossel (arte-conta.ts): conectada, os dados atuais; desconectada,
  // o nome e o @ guardados, com as iniciais; sem conta gravada, a logada no Chat.
  const escolhas = escolhasDaArte(linha.arte, slides.length);
  const { conta } = resolverConta(await contasParaArte(), escolhas, jarra.get(ACCOUNT_COOKIE)?.value);
  if (!conta) return erro(409, TEXTO_ARTE_SEM_CONTA);
  // A foto vem da memória desta instância (arte-foto.ts): as miniaturas chegam juntas, e uma busca
  // só atende todas.
  const [foto, bonus] = await Promise.all([fotosDaInstancia.foto(conta.profile_picture_url), lerLinha(id)]);

  // O PNG já sai lido inteiro (arte-resposta.tsx, achado 65): uma falha do desenho vira 500 com
  // frase, e não um 200 com o corpo quebrado. Emoji no texto faz o desenho buscar o emoji em
  // cdn.jsdelivr.net (achado 66); sem essa rede, o slide com emoji cai nesta frase.
  const arte = await respostaDaArte({
    slide: slides[numero - 1],
    comEspaco: comEspaco(escolhas, numero),
    cabecalho: cabecalhoDaConta(conta, foto),
    baixar: pedido.get("baixar") === "1",
    nomeDoArquivo: nomeDoArquivo(bonus?.slug ?? null, numero),
  });
  if (!arte.ok) return erro(500, arte.falha === "fonte" ? TEXTO_ARTE_SEM_FONTE : TEXTO_ARTE_SEM_DESENHO);
  return arte.resposta;
}
