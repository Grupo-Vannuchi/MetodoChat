"use server";
import { redirect } from "next/navigation";
import { FRASE_CARROSSEL_DE_OUTRA_CONTA } from "@/lib/logins-textos";
import { sessaoAtual } from "@/lib/sessao";
import { urlPublicaSeDerParaMontar } from "@/lib/bucket";
import { cabecalhosDoLogin, carrosselDeOutraConta } from "@/lib/bonus/carrossel-acesso";
import { ehIdDeBonus } from "@/lib/bonus/pedido";
import { assinarImagem, guardarImagem, publicarNaFila, type ArteSubida } from "@/lib/bonus/publicar-processo";
import {
  TEXTO_IMAGEM_GUARDADA,
  TEXTO_PEDIDO_INVALIDO,
  textoDaPublicacaoMandada,
  textoDaRecusaDaPublicacaoDoCarrossel,
  type AvisoDaImagem,
  type AvisoDaPublicacao,
  type RespostaDaAssinatura,
} from "@/lib/bonus/publicar-textos";
import { camposDaDataHora, fusoDoCampo, instanteDoAgendamento, momentoDaPublicacao, textoDaRecusaDaPublicacao } from "@/lib/publicacao";

// AS ACTIONS DA PUBLICAÇÃO DO CARROSSEL (spec da Etapa 5).
//
// TODA ACTION COMEÇA CONFERINDO A SESSÃO, e não confia só no proxy.ts: Server Action tem endereço
// próprio. tests/bonus-publicar-paginas.test.ts confere que a primeira instrução de cada uma é
// `await exigirSessao();`.
//
// Elas só leem o que o navegador mandou, sem confiar no tipo, e chamam o processo
// (lib/bonus/publicar-processo.ts), onde mora tudo o que decide e grava. A CONTA NUNCA VEM DO
// NAVEGADOR: é a gravada no carrossel. A resposta volta como estado, e nunca por redirect (achado 52):
// recriar a página apagaria o que está digitado nos outros cards.
//
// SÓ NAS CONTAS DO LOGIN (docs/specs/2026-11-05-contas-por-login.md, seção 3): o carrossel de uma conta que
// o login não tem é recusado logo depois da validação do id, antes do bucket e da fila. O processo recebe as
// contas do login (`cabecalhosDoLogin`), e não todas, como rede.

async function exigirSessao(): Promise<void> {
  if (!(await sessaoAtual())) redirect("/entrar");
}

const registro = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const inteiro = (v: unknown): number => (typeof v === "number" && Number.isInteger(v) ? v : 0);

/**
 * A PERMISSÃO PARA SUBIR UMA IMAGEM: no destino `slide`, o slide pronto do Canva de um slide com
 * espaço; no destino `foto`, a foto do espaço da arte (adendo da Etapa 5); no destino `fila`, a arte
 * desenhada, convertida na hora de publicar; no destino `capa`, a foto da capa do slide 1 (Etapa 11). O
 * navegador sobe direto ao bucket, pela URL assinada, porque a Vercel recusa corpo acima de 4,5 MB
 * (lib/bucket.ts).
 */
export async function assinarImagemDoCarrossel(pedido: unknown): Promise<RespostaDaAssinatura> {
  await exigirSessao();
  const p = registro(pedido);
  const destino =
    p.destino === "slide" || p.destino === "foto" || p.destino === "fila" || p.destino === "capa" ? p.destino : null;
  if (!ehIdDeBonus(p.id) || !destino) return { ok: false, texto: TEXTO_PEDIDO_INVALIDO };
  if (await carrosselDeOutraConta(p.id)) return { ok: false, texto: FRASE_CARROSSEL_DE_OUTRA_CONTA };
  const r = await assinarImagem({ id: p.id, numero: inteiro(p.numero), destino, arquivo: p.arquivo, contas: await cabecalhosDoLogin() });
  return r.ok ? { ok: true, caminho: r.caminho, url: r.url } : { ok: false, texto: textoDaRecusaDaPublicacaoDoCarrossel(r.recusa) };
}

/**
 * GUARDAR A IMAGEM SUBIDA NO SLIDE. A resposta leva a versão do texto, o endereço da imagem, o jeito
 * (que o servidor leu do caminho) e a versão nova da miniatura.
 */
export async function guardarImagemDoSlide(pedido: unknown): Promise<AvisoDaImagem> {
  await exigirSessao();
  const p = registro(pedido);
  const em = Date.now();
  if (!ehIdDeBonus(p.id) || typeof p.caminho !== "string") return { tom: "erro", texto: TEXTO_PEDIDO_INVALIDO, em };
  if (await carrosselDeOutraConta(p.id)) return { tom: "erro", texto: FRASE_CARROSSEL_DE_OUTRA_CONTA, em };
  const r = await guardarImagem({ id: p.id, numero: inteiro(p.numero), caminho: p.caminho, contas: await cabecalhosDoLogin() });
  if (!r.ok) return { tom: "erro", texto: textoDaRecusaDaPublicacaoDoCarrossel(r.recusa), em };
  return {
    tom: "ok",
    texto: TEXTO_IMAGEM_GUARDADA,
    em,
    versao: r.versao,
    imagem: urlPublicaSeDerParaMontar(p.caminho),
    jeito: r.jeito,
    versaoDaMiniatura: r.versaoDaMiniatura,
  };
}

/**
 * PUBLICAR OU AGENDAR. A hora é lida pelas mesmas funções puras do /publicar (o "agora" ou a data e
 * hora com o fuso do navegador), e o resto é o processo.
 */
export async function publicarCarrossel(pedido: unknown): Promise<AvisoDaPublicacao> {
  await exigirSessao();
  const inicioDaFuncaoMs = Date.now();
  const p = registro(pedido);
  const em = Date.now();
  if (!ehIdDeBonus(p.id)) return { tom: "erro", texto: TEXTO_PEDIDO_INVALIDO, em };
  if (await carrosselDeOutraConta(p.id)) return { tom: "erro", texto: FRASE_CARROSSEL_DE_OUTRA_CONTA, em };
  const campos = camposDaDataHora(p.dataHora);
  const momento = momentoDaPublicacao(p.quando, campos ? instanteDoAgendamento(campos, fusoDoCampo(p.fuso)) : null, Date.now());
  if (!momento.ok) return { tom: "erro", texto: textoDaRecusaDaPublicacao(momento.motivo), em };
  const artes: ArteSubida[] = (Array.isArray(p.artes) ? p.artes : []).map((a) => {
    const r = registro(a);
    return { numero: inteiro(r.numero), caminho: r.caminho, versao: r.versao };
  });
  const r = await publicarNaFila({ id: p.id, quando: momento.quando, artes, contas: await cabecalhosDoLogin(), inicioDaFuncaoMs });
  return r.ok
    ? { tom: "ok", texto: textoDaPublicacaoMandada(!r.jaVale), em }
    : { tom: "erro", texto: textoDaRecusaDaPublicacaoDoCarrossel(r.recusa), em };
}
