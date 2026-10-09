"use server";
import { after } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isValidSession, SESSION_COOKIE } from "@/lib/auth";
import { contasParaArte } from "@/lib/bonus/carrossel-repositorio";
import { gerarImagem, pedirImagem } from "@/lib/bonus/imagem-processo";
import { TEXTO_GERANDO_A_IMAGEM, textoDaRecusaDaImagem, type AvisoDoPedidoDeImagem } from "@/lib/bonus/imagem-textos";
import { ehIdDeBonus } from "@/lib/bonus/pedido";
import { TEXTO_PEDIDO_INVALIDO } from "@/lib/bonus/publicar-textos";

// A ACTION DO CRIADOR DE IMAGEM (spec da Etapa 6, "Pedir e acompanhar").
//
// TODA ACTION COMEÇA CONFERINDO A SESSÃO, e não confia só no proxy.ts: Server Action tem endereço
// próprio. tests/bonus-imagem-paginas.test.ts confere que a primeira instrução é `await exigirSessao();`.
//
// ELA NÃO ESPERA A IMAGEM (achado 88): o Next manda as actions de um cliente uma de cada vez, e esperar
// ~30 s prenderia o salvar, o "Só texto" e o publicar da página inteira. O pedido confere, reserva e
// responde na hora; a geração roda no `after()`, dentro do `maxDuration` da página, e o card acompanha
// pela rota GET da consulta. A resposta volta como estado, e nunca por redirect (achado 52).

async function exigirSessao(): Promise<void> {
  const jarra = await cookies();
  if (!isValidSession(jarra.get(SESSION_COOKIE)?.value)) redirect("/entrar");
}

const registro = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const inteiro = (v: unknown): number => (typeof v === "number" && Number.isInteger(v) ? v : 0);

/** PEDIR A IMAGEM DO ESPAÇO DE UM SLIDE, com a descrição da cena. A CONTA NUNCA VEM DO NAVEGADOR. */
export async function pedirImagemDoSlide(pedido: unknown): Promise<AvisoDoPedidoDeImagem> {
  await exigirSessao();
  const p = registro(pedido);
  const em = Date.now();
  if (!ehIdDeBonus(p.id) || typeof p.descricao !== "string") return { tom: "erro", texto: TEXTO_PEDIDO_INVALIDO, em };
  const id = p.id;
  const numero = inteiro(p.numero);
  const descricao = p.descricao;
  const contas = await contasParaArte();
  const r = await pedirImagem({ id, numero, descricao, contas });
  if (!r.ok) return { tom: "erro", texto: textoDaRecusaDaImagem(r.recusa), em, ...(r.hoje === undefined ? {} : { hoje: r.hoje }) };
  const { reservaId } = r;
  after(() => gerarImagem({ reservaId, id, numero, descricao, contas }));
  return { tom: "ok", texto: TEXTO_GERANDO_A_IMAGEM, em, hoje: r.hoje };
}
