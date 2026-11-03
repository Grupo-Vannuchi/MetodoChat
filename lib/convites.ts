// O LINK DE CONVITE PARA O CLIENTE CONECTAR A PRÓPRIA CONTA (docs/specs/2026-11-03-link-de-convite.md):
// as regras puras. O código do link e o hash que o banco guarda no lugar dele, o estado de cada convite,
// o "para quem", o motivo que o cliente lê quando dá errado e o texto do erro que só o painel lê.
import { createHash, randomBytes } from "node:crypto";
import { semSegredo } from "./steps";

export const VALIDADE_DO_CONVITE_DIAS = 7;
export const LIMITE_DO_PARA_QUEM = 60;

// O MESMO CORTE DO `avisoAssinatura` da volta do Instagram (app/api/oauth/callback/route.ts): o texto é
// para o dono ler numa linha da lista, e não para arquivar o corpo da Meta.
export const LIMITE_DO_ERRO = 160;

// 32 bytes em base64url são 43 caracteres, sem `=`. Um código fora desse formato nem chega ao banco.
const CODIGO = /^[A-Za-z0-9_-]{43}$/;

export function novoCodigoDeConvite(): string {
  return randomBytes(32).toString("base64url");
}

export function codigoBemFormado(codigo: string): boolean {
  return CODIGO.test(codigo);
}

// O BANCO GUARDA SÓ O HASH: quem lê a tabela não ganha um link que ainda vale. Por isso o link não pode
// ser mostrado de novo depois de gerado.
export function hashDoCodigo(codigo: string): string {
  return createHash("sha256").update(codigo).digest("hex");
}

export type EstadoDoConvite = "pendente" | "usado" | "vencido" | "cancelado";

type DatasDoConvite = {
  cancelado_em: Date | string | null;
  usado_em: Date | string | null;
  expira_em: Date | string;
};

/** Nesta ordem: o cancelado vence o usado, o usado vence o vencido, e o prazo vence no próprio instante. */
export function estadoDoConvite(c: DatasDoConvite, agoraMs: number): EstadoDoConvite {
  if (c.cancelado_em) return "cancelado";
  if (c.usado_em) return "usado";
  if (new Date(c.expira_em).getTime() <= agoraMs) return "vencido";
  return "pendente";
}

// CONTA CARACTERE, E NÃO PEDAÇO DE UTF-16: é o que o `char_length` da restrição da tabela conta, e um
// emoji não pode passar aqui e ser recusado lá.
export function paraQuemDoFormulario(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const texto = valor.trim();
  const tamanho = Array.from(texto).length;
  return tamanho >= 1 && tamanho <= LIMITE_DO_PARA_QUEM ? texto : null;
}

// O MOTIVO VEM DE UMA LISTA FECHADA. A página do cliente é aberta, e nada do texto da Meta chega até ela.
export const MOTIVOS_DO_ERRO = ["negado", "vencido", "falhou"] as const;
export type MotivoDoErro = (typeof MOTIVOS_DO_ERRO)[number];

export function motivoDoErro(valor: unknown): MotivoDoErro {
  return (MOTIVOS_DO_ERRO as readonly unknown[]).includes(valor) ? (valor as MotivoDoErro) : "falhou";
}

export const FRASE_DO_MOTIVO: Record<MotivoDoErro, string> = {
  negado: "A autorização foi recusada no Instagram, e a conta não foi conectada.",
  vencido: "Este link não vale mais.",
  falhou: "Não deu certo conectar a conta.",
};

export const PECA_UM_NOVO_LINK = "Se precisar, peça um novo link a quem te mandou.";

// A MESMA FRASE PARA O VENCIDO, O USADO, O CANCELADO E O QUE NÃO EXISTE: a página não diz qual é o caso.
export const FRASE_DO_LINK_QUE_NAO_VALE = "Este link não vale mais. Peça um novo a quem te mandou.";

export const FRASE_DO_PRONTO = "Pronto, sua conta do Instagram foi conectada. Pode fechar esta página.";

/**
 * O texto do erro que vai para o `ultimo_erro` do convite (achado 159). Passa pela limpeza de sempre
 * (`semSegredo`, a query da Meta), troca por OCULTO cada segredo da volta (o `code`, o token e o código
 * do convite) e só depois corta, para o corte não deixar um pedaço de segredo no fim.
 */
export function textoParaOPainel(texto: string, segredos: (string | null | undefined)[]): string {
  let limpo = semSegredo(texto);
  for (const segredo of segredos) if (segredo) limpo = limpo.split(segredo).join("OCULTO");
  return limpo.length > LIMITE_DO_ERRO ? limpo.slice(0, LIMITE_DO_ERRO) : limpo;
}
