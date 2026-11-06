"use server";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { FRASE_CARROSSEL_DE_OUTRA_CONTA } from "@/lib/logins-textos";
import { sessaoAtual } from "@/lib/sessao";
import { cabecalhosDoLogin, carrosselDeOutraConta } from "@/lib/bonus/carrossel-acesso";
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
//
// SÓ NAS CONTAS DO LOGIN (docs/specs/2026-11-05-contas-por-login.md, seção 3): o carrossel de uma conta que
// o login não tem é recusado logo depois da validação do id, antes de qualquer custo ou reserva. O processo
// recebe as contas do login (`cabecalhosDoLogin`), e não todas, como rede: a conta gravada fora delas
// também seria recusada lá dentro.

async function exigirSessao(): Promise<void> {
  if (!(await sessaoAtual())) redirect("/entrar");
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
  if (await carrosselDeOutraConta(id)) return { tom: "erro", texto: FRASE_CARROSSEL_DE_OUTRA_CONTA, em };
  const numero = inteiro(p.numero);
  const descricao = p.descricao;
  const contas = await cabecalhosDoLogin();
  const r = await pedirImagem({ id, numero, descricao, contas });
  if (!r.ok) return { tom: "erro", texto: textoDaRecusaDaImagem(r.recusa), em, ...(r.hoje === undefined ? {} : { hoje: r.hoje }) };
  const { reservaId, formato } = r;
  after(() => gerarImagem({ reservaId, id, numero, descricao, contas, formato }));
  return { tom: "ok", texto: TEXTO_GERANDO_A_IMAGEM, em, hoje: r.hoje };
}
