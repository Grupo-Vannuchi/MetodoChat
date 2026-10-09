import "server-only";
import { mensagemDaOpenAI } from "./erro-ilustracao";
import { COMPRESSAO_DA_IMAGEM, TIMEOUT_IMAGEM_MS } from "./imagem-regras";
import {
  TEXTO_OPENAI_DEMOROU,
  TEXTO_OPENAI_SEM_IMAGEM,
  TEXTO_SEM_CHAVE_DA_IMAGEM,
  TEXTO_SEM_REDE_DA_OPENAI,
  tirarChave,
} from "./imagem-textos";
import { montarPrompt } from "./prompt-ilustracao";

// A CHAMADA À API DE IMAGEM DA OPENAI (spec da Etapa 6, "A chamada à OpenAI"). Molde:
// site-ia/src/lib/ia/ilustracao.ts, na main 672ee71, onde o caminho inteiro foi provado contra a API de
// verdade em 18/09.
//
// SEM SDK, com `fetch` direto, como o Labs: o endpoint é um POST com JSON, e a resposta tem um campo que
// interessa. Nada muda no package.json.
//
// O CORPO É O DO LABS, com uma diferença: `output_format: "jpeg"`, e não "png". O Chat guarda a imagem
// como a foto do espaço, e a rota da arte só a lê como JPEG e até 2 MB (lib/bonus/arte-foto.ts); o PNG do
// Labs passava de 2 MB. O resto (modelo, tamanho, qualidade, fundo) foi decidido e medido lá, e não muda
// aqui sem combinar.
//
// A CHAVE sai do ambiente, vai só no cabeçalho, e nunca para uma frase, um log ou o banco (`tirarChave`).

export const ENDERECO_DA_OPENAI = "https://api.openai.com/v1/images/generations";

/** O corpo, menos o prompt. 1536×1024 é o 3:2 deitado do espaço (860×573): a API só aceita três tamanhos. */
export const CORPO_FIXO = {
  model: "gpt-image-1",
  size: "1536x1024",
  quality: "medium",
  n: 1,
  background: "opaque",
  output_format: "jpeg",
  output_compression: COMPRESSAO_DA_IMAGEM,
} as const;

export type RespostaDaOpenAI = { ok: true; bytes: Uint8Array } | { ok: false; erro: string };

/** A assinatura que o processo recebe por parâmetro: a de verdade em produção, uma falsa no teste. */
export type GerarNaOpenAI = (descricao: string) => Promise<RespostaDaOpenAI>;

/**
 * Gera a imagem da descrição que o operador digitou. O embrulho nas regras (estilo, fundo, proibições) é
 * o `montarPrompt` do Labs. `ambiente` e `buscar` entram por parâmetro só para o teste.
 */
export async function gerarNaOpenAI(
  descricao: string,
  ambiente: Readonly<Record<string, string | undefined>> = process.env,
  buscar: typeof fetch = fetch
): Promise<RespostaDaOpenAI> {
  const chave = ambiente.OPENAI_API_KEY?.trim();
  if (!chave) return { ok: false, erro: TEXTO_SEM_CHAVE_DA_IMAGEM };

  let resposta: Response;
  try {
    resposta = await buscar(ENDERECO_DA_OPENAI, {
      method: "POST",
      headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...CORPO_FIXO, prompt: montarPrompt(descricao) }),
      signal: AbortSignal.timeout(TIMEOUT_IMAGEM_MS),
    });
  } catch (e) {
    const nome = e instanceof Error ? e.name : "";
    return { ok: false, erro: nome === "TimeoutError" || nome === "AbortError" ? TEXTO_OPENAI_DEMOROU : TEXTO_SEM_REDE_DA_OPENAI };
  }

  const corpo = await resposta.json().catch(() => null);
  if (!resposta.ok) return { ok: false, erro: tirarChave(mensagemDaOpenAI(resposta.status, corpo), chave) };

  const b64 = (corpo as { data?: { b64_json?: unknown }[] } | null)?.data?.[0]?.b64_json;
  if (typeof b64 !== "string" || !b64) return { ok: false, erro: TEXTO_OPENAI_SEM_IMAGEM };
  return { ok: true, bytes: new Uint8Array(Buffer.from(b64, "base64")) };
}
