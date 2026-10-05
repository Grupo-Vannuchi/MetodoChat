import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TEXTO_PEDIDO_INVALIDO, textoDaPublicacaoMandada } from "@/lib/bonus/publicar-textos";

// AS GUARDAS DA PUBLICAÇÃO DO CARROSSEL (spec da Etapa 5, "Segurança"). O harness da integração não
// forja sessão (de propósito): as actions se provam pelo processo, que a integração alcança, e por
// estas leituras do código.

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const ler = (rel: string) => readFileSync(`${RAIZ}/${rel}`, "utf8").replace(/\r\n/g, "\n");
const ACTIONS = "app/bonus/publicar-actions.ts";
const PROCESSO = "lib/bonus/publicar-processo.ts";

/** As funções exportadas de um arquivo e a primeira instrução de cada uma. */
function primeirasInstrucoes(fonte: string): { nome: string; primeira: string }[] {
  const achados: { nome: string; primeira: string }[] = [];
  const re = /export async function (\w+)\([^)]*\)[^{]*\{\s*([^\n;]+;)/g;
  for (const m of fonte.matchAll(re)) achados.push({ nome: m[1], primeira: m[2].trim() });
  return achados;
}

describe("toda action da publicação confere a sessão antes de qualquer coisa", () => {
  it("as três actions começam por `await exigirSessao();`", () => {
    const achados = primeirasInstrucoes(ler(ACTIONS));
    expect(achados.map((a) => a.nome).sort()).toEqual(["assinarImagemDoCarrossel", "guardarImagemDoSlide", "publicarCarrossel"]);
    for (const a of achados) expect(a.primeira, a.nome).toBe("await exigirSessao();");
  });

  it("nenhum export escapa do leitor: num arquivo 'use server', todo export é action", () => {
    const fonte = ler(ACTIONS);
    expect(fonte.startsWith('"use server";')).toBe(true);
    expect((fonte.match(/^export /gm) ?? []).length).toBe(primeirasInstrucoes(fonte).length);
  });
});

describe("a conta é sempre a do carrossel", () => {
  it("as actions não leem conta do que o navegador manda", () => {
    expect(ler(ACTIONS)).not.toMatch(/\.conta\b|\["conta"\]|get\(\s*["']conta["']/);
  });

  // A rota de assinar do /publicar e a publicação dele usam a conta do COOKIE, de propósito. Aqui a
  // conta é a gravada no carrossel: o cookie não entra nem na pasta do bucket, nem na fila.
  it("nem as actions nem o processo leem o cookie da conta selecionada", () => {
    for (const arquivo of [ACTIONS, PROCESSO, "lib/bonus/publicar-bucket.ts", "lib/bonus/publicar-repositorio.ts"]) {
      const fonte = ler(arquivo);
      expect(fonte, arquivo).not.toContain("getSelectedAccount");
      expect(fonte, arquivo).not.toContain("ACCOUNT_COOKIE");
      expect(fonte, arquivo).not.toContain("/api/midia/assinar");
    }
  });

  it("o processo enfileira e copia com a conta conferida do carrossel", () => {
    const fonte = ler(PROCESSO);
    expect(fonte).toContain("enfileirar(c.conta, { forma, caminhos, legenda: reserva.legenda }, p.quando)");
    expect(fonte).toContain("copiarTodasParaAFila(origens, c.conta)");
    expect(fonte).toContain('if (origem !== "gravada" || !escolhas.conta) return recusa({ motivo: "conta_desconectada" });');
  });
});

// A RESPOSTA VOLTA COMO ESTADO, e nunca por redirect para a própria página (achado 52): o redirect
// recria a página, e o que estava digitado nos outros cards se perderia.
describe("as actions da publicação respondem sem recriar a página", () => {
  it("o único redirect é o da sessão, para /entrar", () => {
    const redirects = ler(ACTIONS).match(/redirect\([^)]*\)/g) ?? [];
    expect(redirects).toEqual(['redirect("/entrar")']);
  });
});

describe("as frases das actions", () => {
  it("o pedido inválido e o sucesso, que não diz publicado: enfileirar não é publicar", () => {
    expect(TEXTO_PEDIDO_INVALIDO).toMatch(/Recarregue a página/);
    expect(textoDaPublicacaoMandada(false)).not.toMatch(/^Publicado/);
    expect(textoDaPublicacaoMandada(true)).toMatch(/^Agendado/);
  });
});
