import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// AS GUARDAS DA ROTA DA ARTE que nenhum tipo pega: a sessão conferida antes de tudo, o caminho que
// não escapa do proxy, e a tabela de contas lida só pelas colunas do cabeçalho.

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const ler = (rel: string) => readFileSync(`${RAIZ}/${rel}`, "utf8");
const ROTA = "app/bonus/[id]/carrossel/[cid]/arte/route.tsx";

describe("a rota da arte", () => {
  // A rota é um GET com endereço próprio: o proxy.ts deixa passar sem sessão o que termina em
  // .png, .jpg, .svg e .ico. Por isso o caminho termina em /arte, e a rota confere a sessão ela
  // mesma, como primeira coisa.
  it("mora em /arte, e não num caminho que termina em .png", () => {
    expect(existsSync(`${RAIZ}/${ROTA}`)).toBe(true);
    expect(readdirSync(`${RAIZ}/app/bonus/[id]/carrossel/[cid]`).some((n) => /\.(png|jpe?g|svg|ico)$/.test(n))).toBe(false);
  });

  it("o GET confere a sessão antes de qualquer outra coisa", () => {
    const fonte = ler(ROTA);
    const inicio = fonte.indexOf("export async function GET(");
    const corpo = fonte.slice(inicio);
    const linhas = corpo
      .split("\n")
      .slice(1)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("//"));
    expect(inicio).toBeGreaterThan(-1);
    expect(linhas.slice(0, 2)).toEqual([
      "const jarra = await cookies();",
      "if (!isValidSession(jarra.get(SESSION_COOKIE)?.value)) return erro(401, TEXTO_ARTE_SEM_SESSAO);",
    ]);
  });

  it("os cabeçalhos da resposta saem de cabecalhosDaArte, que nunca diz public", () => {
    expect(ler("lib/bonus/arte-resposta.tsx")).toContain("headers: cabecalhosDaArte(baixar, nomeDoArquivo)");
  });

  // A foto passa pela memória da instância (spec da Etapa 4): as miniaturas chegam juntas, e a
  // memória faz delas uma busca só. Chamar `fotoDaConta` direto voltaria a uma busca por miniatura.
  it("a foto da conta vem da memória da instância, e não de uma busca por miniatura", () => {
    const rota = ler(ROTA);
    expect(rota).toContain("fotosDaInstancia.foto(");
    expect(rota).not.toMatch(/\bfotoDaConta\(/);
  });
});

// O TOKEN DE ACESSO DA CONTA NÃO SAI DA TABELA (achado 60): `accounts` guarda o `access_token`, e
// `listAccounts`, `getAccount` e `getSelectedAccount` (do dono) leem a linha inteira. A arte lê
// por `contasParaArte`, que seleciona só as quatro colunas do cabeçalho.
describe("a arte não lê a tabela de contas inteira", () => {
  const ARQUIVOS = [
    ROTA,
    "lib/bonus/arte-resposta.tsx",
    "lib/bonus/arte-desenho.tsx",
    "lib/bonus/arte-conta.ts",
    "lib/bonus/arte-foto.ts",
    "lib/bonus/carrossel-repositorio.ts",
    "app/bonus/carrossel-actions.ts",
  ];

  /** O código sem as linhas de comentário: os comentários citam essas funções para dizer por que não. */
  const semComentarios = (arquivo: string) =>
    ler(arquivo)
      .split("\n")
      .filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l))
      .join("\n");

  it.each(ARQUIVOS)("%s não usa as leituras de conta que trazem o token", (arquivo) => {
    expect(semComentarios(arquivo)).not.toMatch(/\b(listAccounts|getAccount|getSelectedAccount|getSelectedAccountId)\b/);
  });

  it("e o repositório não faz `select *` em accounts", () => {
    expect(semComentarios("lib/bonus/carrossel-repositorio.ts")).not.toMatch(/select\s+\*\s+from\s+accounts/i);
  });
});
