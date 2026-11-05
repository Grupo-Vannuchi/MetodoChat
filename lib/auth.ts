import "server-only";
import { randomBytes } from "node:crypto";
import { safeEqualHex } from "./crypto";

// O COOKIE DA SESSÃO. Até 04/11/2026 o valor era `v2.<expira>.<assinatura>`, assinado com uma chave derivada
// da ADMIN_PASSWORD. Desde os logins (docs/specs/2026-11-04-logins.md) ele leva um código sorteado, e a
// sessão mora no banco (lib/sessao.ts). O nome e o prazo ficaram.
export const SESSION_COOKIE = "metodochat_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 dias

// O STATE DO OAUTH É NOVO A CADA CONEXÃO (docs/specs/2026-10-27-cron-e-oauth.md). Até 27/10/2026 ele era
// um HMAC fixo da senha, entregue por uma rota pública e válido até a próxima troca da senha: com ele,
// dava para levar o dono a terminar uma conexão começada por outra pessoa. Agora `/api/oauth/login`
// (que exige a sessão) sorteia um, guarda no cookie abaixo, e a volta só aceita o mesmo valor, uma vez.
export const OAUTH_STATE_COOKIE = "metodochat_oauth_state";
export const OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60;

// O COOKIE DO CONVITE (docs/specs/2026-11-03-link-de-convite.md): o começo pelo link de convite
// (`/api/oauth/convite/[codigo]`) grava o id do convite ao lado do `state`, com as mesmas opções e o mesmo
// prazo, e é ele que diz à volta que a conexão é do cliente, e não de alguém do painel. O começo de hoje
// (`/api/oauth/login`) o apaga.
export const OAUTH_CONVITE_COOKIE = "metodochat_oauth_convite";
const STATE_HEX = /^[0-9a-f]{64}$/;

export function novoOauthState(): string {
  return randomBytes(32).toString("hex");
}

/** O state que voltou do Instagram é o mesmo que o começo guardou no cookie? */
export function oauthStateConfere(doCookie: string | undefined, daVolta: string | null): boolean {
  if (!doCookie || !daVolta || !STATE_HEX.test(doCookie) || !STATE_HEX.test(daVolta)) return false;
  return safeEqualHex(doCookie, daVolta);
}
