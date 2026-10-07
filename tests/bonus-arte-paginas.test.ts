import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// AS GUARDAS DA ROTA DA ARTE que nenhum tipo pega: a sessão conferida antes de tudo, o caminho que
// não escapa do proxy, e a tabela de contas lida só pelas colunas do cabeçalho. Desde a Etapa 7 são
// duas rotas, a do carrossel de bônus e a do avulso, e as duas desenham pelo mesmo módulo
// (lib/bonus/arte-rota.ts), que é onde moram a foto da conta e a foto do espaço.

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const ler = (rel: string) => readFileSync(`${RAIZ}/${rel}`, "utf8");
const ROTAS = ["app/bonus/[id]/carrossel/[cid]/arte/route.tsx", "app/carrosseis/[cid]/arte/route.tsx"];
const DESENHO = "lib/bonus/arte-rota.ts";

describe.each(ROTAS)("a rota da arte %s", (rota) => {
  // A rota é um GET com endereço próprio: o proxy.ts deixa passar sem sessão o que termina em
  // .png, .jpg, .svg e .ico. Por isso o caminho termina em /arte, e a rota confere a sessão ela
  // mesma, como primeira coisa.
  it("mora em /arte, e não num caminho que termina em .png", () => {
    expect(existsSync(`${RAIZ}/${rota}`)).toBe(true);
    const pagina = dirname(dirname(`${RAIZ}/${rota}`));
    expect(readdirSync(pagina).some((n) => /\.(png|jpe?g|svg|ico)$/.test(n))).toBe(false);
  });

  it("o GET confere a sessão antes de qualquer outra coisa", () => {
    const fonte = ler(rota);
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

  it("confere o pedido pela origem da rota, e desenha pelo módulo comum", () => {
    const fonte = ler(rota);
    expect(fonte).toContain("conferirPedidoDaArte(");
    expect(fonte).toContain("desenharSlide(");
  });
});

describe("o desenho do slide, comum às duas rotas", () => {
  it("os cabeçalhos da resposta saem de cabecalhosDaArte, que nunca diz public", () => {
    expect(ler("lib/bonus/arte-resposta.tsx")).toContain("headers: cabecalhosDaArte(baixar, nomeDoArquivo)");
  });

  // A foto passa pela memória da instância (spec da Etapa 4): as miniaturas chegam juntas, e a
  // memória faz delas uma busca só. Chamar `fotoDaConta` direto voltaria a uma busca por miniatura.
  it("a foto da conta vem da memória da instância, e não de uma busca por miniatura", () => {
    const desenho = ler(DESENHO);
    expect(desenho).toContain("fotosDaInstancia.foto(");
    expect(desenho).not.toMatch(/\bfotoDaConta\(/);
  });

  // A FOTO DO ESPAÇO (adendo da Etapa 5) é só a do jeito "foto" (`fotosDaArte`), e passa pela
  // conferência do caminho na pasta da conta do carrossel e pela memória (`fotoDoEspaco`). Buscar
  // direto pularia as duas.
  it("a foto do espaço vem de fotosDaArte e de fotoDoEspaco, e nunca de uma busca direta", () => {
    const desenho = ler(DESENHO);
    expect(desenho).toContain("fotosDaArte(");
    expect(desenho).toContain("fotoDoEspaco(");
    expect(desenho).not.toMatch(/\bbuscarFotoDoEspaco\(/);
  });

  it("nenhuma rota busca foto por conta própria", () => {
    for (const rota of ROTAS) expect(ler(rota), rota).not.toMatch(/\b(fotoDaConta|buscarFotoDoEspaco|fotoDoEspaco|fotosDaInstancia)\b/);
  });
});

// O TOKEN DE ACESSO DA CONTA NÃO SAI DA TABELA (achado 60): `accounts` guarda o `access_token`, e
// `listAccounts`, `getAccount` e `getSelectedAccount` (do dono) leem a linha inteira. A arte lê
// por `contasParaArte`, que seleciona só as quatro colunas do cabeçalho.
describe("a arte não lê a tabela de contas inteira", () => {
  const ARQUIVOS = [
    ...ROTAS,
    DESENHO,
    "lib/bonus/arte-resposta.tsx",
    "lib/bonus/arte-desenho.tsx",
    "lib/bonus/arte-conta.ts",
    "lib/bonus/arte-foto.ts",
    "lib/bonus/carrossel-repositorio.ts",
    "app/bonus/carrossel-actions.ts",
    "app/carrosseis/actions.ts",
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
