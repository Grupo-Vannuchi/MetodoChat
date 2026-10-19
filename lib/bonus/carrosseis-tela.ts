// O QUE A LISTA "CARROSSÉIS" MOSTRA DE CADA CARROSSEL (spec da Etapa 7, "O menu Carrosséis"; spec da
// Etapa 10, "A lista"), decidido fora do JSX, com teste. PURO: a página lê as linhas, o estado da fila e
// as contas, e estas funções decidem a aba, a ordem, o selo e a capa.
import { fmtDate } from "@/lib/format";
import { resolverConta, type ContaDoCabecalho } from "./arte-conta";
import { escolhasDaArte } from "./arte-escolhas";
import { slidesDoTexto } from "./arte-slides";
import { cabecalhoParaVersao, urlDaArte, versoesDosSlides } from "./arte-tela";
import { TEXTO_CARROSSEL_APAGADO } from "./apagar-textos";
import { textoDaOrigem } from "./avulso-textos";
import { caminhoDoCarrossel } from "./carrossel-caminho";
import type { LinhaDoCarrossel } from "./carrossel-linha";
import { descricaoDoCarrossel, rotuloDoCarrossel, textoDaLinhaDoCarrossel } from "./carrossel-tela";
import type { EstadoDaPublicacao } from "./publicar-estado";
import { fotosDaArte, imagensDaArte, jeitoDoCaminho } from "./publicar-regras";
import { rotuloDaPublicacao } from "./publicar-textos";
import type { TipoDoRotulo } from "./tela";
import { geracaoNaTela } from "./tempos";

export type RotuloDaLista = { texto: string; tipo: TipoDoRotulo };

/** As abas da lista, pelo estado da publicação de hoje (spec da Etapa 10, "A lista"). */
export type AbaDosCarrosseis = "rascunhos" | "agendados" | "publicados";

export const ABAS: { aba: AbaDosCarrosseis; rotulo: string; vazia: string }[] = [
  { aba: "rascunhos", rotulo: "Rascunhos", vazia: "Nenhum rascunho." },
  { aba: "agendados", rotulo: "Agendados", vazia: "Nenhum carrossel agendado." },
  { aba: "publicados", rotulo: "Publicados", vazia: "Nenhum carrossel publicado." },
];

/**
 * A ABA DE UM CARROSSEL. O que está na fila (o agendado e o que está saindo) é "Agendados"; o que saiu
 * é "Publicados"; todo o resto é rascunho, inclusive o que falhou ao publicar e o estado que o Chat não
 * reconhece (esse com o selo dele). `null` é o carrossel sem publicação guardada.
 */
export function abaDoCarrossel(estado: EstadoDaPublicacao | null): AbaDosCarrosseis {
  if (estado?.tipo === "agendado" || estado?.tipo === "publicando") return "agendados";
  if (estado?.tipo === "publicado") return "publicados";
  return "rascunhos";
}

/** A aba do `?aba=`: o endereço é digitável, e um valor desconhecido abre "Rascunhos". */
export function abaDoEndereco(v: string | string[] | undefined): AbaDosCarrosseis {
  return ABAS.find((a) => a.aba === v)?.aba ?? "rascunhos";
}

export function urlDaAba(aba: AbaDosCarrosseis): string {
  return `/carrosseis?aba=${aba}`;
}

/**
 * DEPOIS DE APAGAR, a lista na aba "Rascunhos", com o aviso em verde. Sem `tom=ok`, `avisoDaUrl` pinta o
 * aviso de vermelho (lib/avisos.ts), e o sucesso pareceria falha (achado 92).
 */
export function urlDepoisDeApagar(): string {
  return `${urlDaAba("rascunhos")}&aviso=${encodeURIComponent(TEXTO_CARROSSEL_APAGADO)}&tom=ok`;
}

/** "16/10, 10:00", no horário de Brasília: o selo é curto, e o ano é o de agora. */
const DIA_E_HORA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * O SELO DE CADA ABA: em "Agendados", quando sai; em "Publicados", quando saiu; em "Rascunhos", só o que
 * pede algo (a publicação que não foi ao ar, e a geração que não está revisada). O "Revisado" sai.
 */
function selosDoCarrossel(l: LinhaDoCarrossel, estado: EstadoDaPublicacao | null, agoraMs: number): RotuloDaLista[] {
  switch (estado?.tipo) {
    case "agendado":
      return [{ texto: `Agendado para ${DIA_E_HORA.format(estado.quando)}`, tipo: "neutro" }];
    case "publicando":
      return [{ texto: "Publicando…", tipo: "neutro" }];
    case "publicado":
      return [{ texto: estado.em ? `Publicado em ${DIA_E_HORA.format(estado.em)}` : "Publicado", tipo: "ok" }];
  }
  const daPublicacao = estado && estado.tipo !== "livre" && estado.tipo !== "cancelado" ? rotuloDaPublicacao(estado) : null;
  const revisado = geracaoNaTela(l.estado, l.criado_em, agoraMs) === "pronto" && l.revisado_em !== null;
  return [daPublicacao, revisado ? null : rotuloDoCarrossel(l, agoraMs)].filter((s): s is RotuloDaLista => s !== null);
}

/**
 * Uma linha da lista. `href` é a página do carrossel: a de bônus, embaixo do bônus; a do avulso, em
 * /carrosseis. `detalhe` é a conta (o @ guardado no carrossel) e o número de slides; `criado`, a data.
 */
export type ItemDaListaDeCarrosseis = {
  id: string;
  href: string;
  titulo: string;
  origem: string;
  detalhe: string;
  criado: string;
  selos: RotuloDaLista[];
};

/** `estado` é o da fila, só para o carrossel que tem publicação; null nos outros. */
export function itemDaListaDeCarrosseis(l: LinhaDoCarrossel, estado: EstadoDaPublicacao | null, agoraMs: number): ItemDaListaDeCarrosseis {
  const { arroba } = escolhasDaArte(l.arte, l.total_slides);
  return {
    id: l.id,
    href: caminhoDoCarrossel(l),
    titulo: textoDaLinhaDoCarrossel(l)?.titulo ?? descricaoDoCarrossel(l),
    origem: textoDaOrigem(l),
    detalhe: [arroba ? `@${arroba}` : null, descricaoDoCarrossel(l)].filter((x): x is string => x !== null).join(" · "),
    criado: fmtDate(l.criado_em),
    selos: selosDoCarrossel(l, estado, agoraMs),
  };
}

export type EntradaDaLista = { linha: LinhaDoCarrossel; estado: EstadoDaPublicacao | null };

/** Compara dois números, com o infinito negativo de "sem hora" no lugar certo (sem `NaN`). */
const comparar = (x: number, y: number) => (x === y ? 0 : x < y ? -1 : 1);

/**
 * AS ENTRADAS DE UMA ABA, na ordem dela, e a contagem das três: em "Rascunhos", o mais novo primeiro
 * (pela criação); em "Agendados", o que está saindo antes de todos, e depois o próximo a sair; em
 * "Publicados", o mais recente primeiro (pela hora em que saiu), e o sem hora no fim (achado 93).
 */
export function separarPorAba<T extends EntradaDaLista>(
  entradas: T[],
  aba: AbaDosCarrosseis
): { contagem: Record<AbaDosCarrosseis, number>; daAba: T[] } {
  const contagem: Record<AbaDosCarrosseis, number> = { rascunhos: 0, agendados: 0, publicados: 0 };
  for (const e of entradas) contagem[abaDoCarrossel(e.estado)]++;
  const criado = (e: T) => e.linha.criado_em.getTime();
  const quando = (e: T) => (e.estado?.tipo === "agendado" ? e.estado.quando.getTime() : -Infinity);
  const em = (e: T) => (e.estado?.tipo === "publicado" && e.estado.em ? e.estado.em.getTime() : -Infinity);
  const daAba = entradas.filter((e) => abaDoCarrossel(e.estado) === aba);
  const ordem: Record<AbaDosCarrosseis, (a: T, b: T) => number> = {
    rascunhos: (a, b) => comparar(criado(b), criado(a)),
    agendados: (a, b) => comparar(quando(a), quando(b)) || comparar(criado(b), criado(a)),
    publicados: (a, b) => comparar(em(b), em(a)) || comparar(criado(b), criado(a)),
  };
  return { contagem, daAba: daAba.sort(ordem[aba]) };
}

/** O que a capa precisa de fora: as contas do cabeçalho, o cookie da conta e o endereço público do bucket. */
export type ContextoDaCapa = {
  contas: ContaDoCabecalho[];
  doCookie: string | undefined;
  urlPublica: (caminho: string) => string | null;
};

/**
 * A CAPA: a miniatura do slide 1, a mesma que a página do carrossel mostra (revisao.tsx e
 * card-da-parte.tsx): a imagem do "Slide pronto do Canva", se o slide 1 tiver uma e não for "Só texto";
 * senão a arte do slide 1, pela rota da arte, com a versão que a página calcula. `null` é o quadro vazio:
 * o carrossel ainda gerando, travado, falhado, ou sem texto.
 */
export function capaDoCarrossel(l: LinhaDoCarrossel, agoraMs: number, c: ContextoDaCapa): string | null {
  if (geracaoNaTela(l.estado, l.criado_em, agoraMs) !== "pronto") return null;
  const texto = textoDaLinhaDoCarrossel(l);
  if (!texto) return null;
  const escolhas = escolhasDaArte(l.arte, l.total_slides);
  const imagem = escolhas.soTexto.includes(1) ? undefined : imagensDaArte(l.arte, l.total_slides)[1];
  const pronto = imagem && jeitoDoCaminho(imagem.caminho) === "slide" ? c.urlPublica(imagem.caminho) : null;
  if (pronto) return pronto;
  const { conta } = resolverConta(c.contas, escolhas, c.doCookie);
  const [versao] = versoesDosSlides(slidesDoTexto(texto), escolhas.soTexto, cabecalhoParaVersao(conta), fotosDaArte(l.arte, l.total_slides));
  return urlDaArte(caminhoDoCarrossel(l), 1, versao);
}
