// CÓPIA DO TESTE DO LABS (site-ia, src/lib/ia/erro-ilustracao.test.ts, commit 69c079d da dev, blob 9218a8ff),
// com só o caminho do import trocado para o do Chat (spec da Etapa 6, "As regras, copiadas do Labs"). Os
// casos são os mesmos de lá, de propósito: as regras são as mesmas, e a cópia delas é conferida em
// tests/bonus-ilustracao-copia.test.ts. As chaves deste arquivo são falsas, mascaradas ou curtas.
import { describe, expect, it } from "vitest";
import { mensagemDaOpenAI } from "@/lib/bonus/erro-ilustracao";

const corpo = (code: string | undefined, message?: string) => ({ error: { code, message } });

describe("mensagemDaOpenAI", () => {
  // ⚠️ **A ASSERÇÃO QUE MOTIVOU O ARQUIVO.** Em 18/09 a geração falhou em produção e a tela
  // mostrou só o texto genérico nosso; a OpenAI tinha dito qual era a causa em `message`, e o
  // código descartava esse campo no 401 e no 403. Um dia de diagnóstico às cegas.
  it("NUNCA descarta a mensagem da OpenAI, em nenhum status", () => {
    const detalhe = "Your organization must be verified to use the model `gpt-image-1`";
    for (const status of [400, 401, 403, 429, 500, 503]) {
      expect(mensagemDaOpenAI(status, corpo("x", detalhe))).toContain(detalhe);
    }
  });

  it("separa 401 (chave não reconhecida) de 403 (acesso ao modelo negado)", () => {
    const a = mensagemDaOpenAI(401, corpo(undefined));
    const b = mensagemDaOpenAI(403, corpo(undefined));
    expect(a).not.toBe(b);
    expect(a).toContain("não reconheceu a chave");
    expect(b).toContain("verificada");
  });

  // ⚠️ O 401 acontece com a chave PRESENTE no servidor. Sem esta frase, quem lê vai conferir a
  // variável de ambiente — que é o único lugar onde o problema comprovadamente não está.
  it("no 401, diz que a chave chegou ao servidor", () => {
    expect(mensagemDaOpenAI(401, corpo(undefined))).toContain("CHEGOU ao servidor");
  });

  it("trata falta de crédito pelo código, não pelo status", () => {
    for (const code of ["credit_balance_exhausted", "insufficient_quota", "billing_hard_limit_reached"]) {
      expect(mensagemDaOpenAI(400, corpo(code))).toContain("sem crédito");
    }
  });

  // ⚠️ REGRESSÃO: a versão anterior mandava "adicione fundos" para todo 429, e 429 sem código
  // de cobrança é limite de REQUISIÇÕES — quem só precisava esperar ia comprar crédito.
  it("429 sem código de cobrança é limite de requisições, não falta de crédito", () => {
    const m = mensagemDaOpenAI(429, corpo(undefined, "Rate limit reached"));
    expect(m).toContain("limite de requisições");
    expect(m).not.toContain("sem crédito");
  });

  it("não inventa parênteses vazios quando a OpenAI não manda detalhe", () => {
    expect(mensagemDaOpenAI(403, null)).not.toContain("OpenAI:");
    expect(mensagemDaOpenAI(500, {})).not.toContain("()");
  });

  it("inclui o status quando não há tradução específica", () => {
    expect(mensagemDaOpenAI(503, null)).toContain("503");
  });

  // ⚠️ **O 401 DA OPENAI TRAZ UM PEDAÇO DA CHAVE, mascarado no meio.** A frase vai para a tela
  // de quem opera e para `IlustracaoIA.erro`. Achado pelo DEV do Método Chat em 09/10.
  it("tira o pedaço da chave que a OpenAI põe na mensagem do 401", () => {
    const detalhe =
      "Incorrect API key provided: sk-proj-AbC1********************************************xY9z. You can find your API key at https://platform.openai.com/account/api-keys.";
    const m = mensagemDaOpenAI(401, corpo("invalid_api_key", detalhe));
    expect(m, "sobrou o começo da chave").not.toContain("AbC1");
    expect(m, "sobrou o fim da chave").not.toContain("xY9z");
    expect(m, "o marcador sumiu").toContain("sk-…");
    expect(m, "o resto da mensagem da OpenAI tem de continuar").toContain("You can find your API key");
  });

  it("tira toda chave da mensagem, e não só a primeira", () => {
    const m = mensagemDaOpenAI(400, corpo(undefined, "chaves sk-aaaa1111 e sk-proj-bbbb2222 recusadas"));
    expect(m).not.toMatch(/1111|2222/);
    expect(m.match(/sk-…/g)?.length).toBe(2);
  });
});
