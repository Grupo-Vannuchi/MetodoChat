import { createHmac } from "node:crypto";

// A ASSINATURA DA PORTA DO LABS: HMAC-SHA256 sobre `<t>.<corpo cru>`, com `t` em
// SEGUNDOS (contrato, "O essencial"). Recebe a STRING, e nunca o objeto: quem
// serializa é `montarCorpo`, uma vez, e a mesma string vai para o `fetch`.
export function assinar(corpo: string, segredo: string, agoraMs: number): string {
  const t = Math.floor(agoraMs / 1000);
  const v1 = createHmac("sha256", segredo).update(`${t}.${corpo}`).digest("hex");
  return `t=${t},v1=${v1}`;
}
