// AS TRÊS PÁGINAS ABERTAS DO LINK DE CONVITE (docs/specs/2026-11-03-link-de-convite.md): a do link
// (`/convite/[codigo]`), a do "Pronto" e a do erro, desenhadas em HTML de verdade contra o banco
// descartável. Elas são o que o cliente vê sem a senha do painel, então o que importa é também o que NÃO
// aparece: o "para quem", as contas, o motivo de verdade de um erro e qual dos quatro casos fez o link não
// valer.
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bancoDescartavel } from "./harness";

type ModuloPagina = typeof import("@/app/convite/[codigo]/page");
type ModuloPronto = typeof import("@/app/convite/pronto/page");
type ModuloErro = typeof import("@/app/convite/erro/page");
type ModuloRepositorio = typeof import("@/lib/convites-repositorio");

const banco = bancoDescartavel();

let pagina: ModuloPagina;
let pronto: ModuloPronto;
let erro: ModuloErro;
let repo: ModuloRepositorio;

beforeAll(async () => {
  pagina = await import("@/app/convite/[codigo]/page");
  pronto = await import("@/app/convite/pronto/page");
  erro = await import("@/app/convite/erro/page");
  repo = await import("@/lib/convites-repositorio");
});

beforeEach(async () => {
  await banco.db().sql().query(`delete from convites_de_conexao`);
});

const html = async (codigo: string) =>
  renderToStaticMarkup(await pagina.default({ params: Promise.resolve({ codigo }) }));

const htmlDoErro = async (motivo: string | string[] | undefined) =>
  renderToStaticMarkup(await erro.default({ searchParams: Promise.resolve({ motivo }) }));

const FRASE_QUE_NAO_VALE = "Este link não vale mais. Peça um novo a quem te mandou.";

describe("a página do link", () => {
  it("com o convite pendente, mostra os três passos e o botão de conectar", async () => {
    const { codigo } = await repo.criarConvite("Dr. Marcus");
    const h = await html(codigo);
    expect(h).toContain("Conectar seu Instagram");
    expect(h).toContain("Profissional");
    expect(h).toContain("Convites de testador");
    expect(h).toContain("não aparece no aplicativo do Instagram no celular");
    expect(h).toContain(`href="/api/oauth/convite/${codigo}"`);
    expect(h).toContain("Conectar meu Instagram");
    // O link de fora sai sem o Referer, para o endereço com o código não ir junto (achado 157).
    expect(h).toMatch(
      /<a href="https:\/\/www\.instagram\.com\/accounts\/manage_access\/" target="_blank" rel="noreferrer"/
    );
    // Nada do painel: nem o "para quem".
    expect(h).not.toContain("Dr. Marcus");
  });

  it("o cancelado, o usado, o vencido, o inexistente e o torto têm a mesma frase, e nada mais", async () => {
    const cancelado = await repo.criarConvite("cancelado");
    await repo.cancelarConvite(cancelado.id);
    const usado = await repo.criarConvite("usado");
    await repo.reivindicarEGravarConta(usado.id, {
      ig_user_id: "17800000000021701",
      username: "u",
      name: null,
      profile_picture_url: null,
      access_token: "t",
      token_expires_at: null,
    });
    const vencido = await repo.criarConvite("vencido");
    await banco
      .db()
      .sql()
      .query(`update convites_de_conexao set expira_em = now() - interval '1 second' where id = $1`, [vencido.id]);

    const paginas = await Promise.all(
      [cancelado.codigo, usado.codigo, vencido.codigo, "a".repeat(43), "torto"].map(html)
    );
    for (const h of paginas) {
      expect(h).toContain(FRASE_QUE_NAO_VALE);
      expect(h).not.toContain("Conectar meu Instagram");
      expect(h).not.toContain("/api/oauth/convite/");
    }
    expect(new Set(paginas).size).toBe(1);
  });
});

describe("as páginas do fim", () => {
  it("o \"Pronto\" diz que a conta foi conectada", async () => {
    const h = renderToStaticMarkup(await pronto.default());
    expect(h).toContain("Pronto, sua conta do Instagram foi conectada. Pode fechar esta página.");
  });

  it("o erro tem uma frase por motivo, sempre com o pedido de um link novo", async () => {
    expect(await htmlDoErro("negado")).toContain("A autorização foi recusada no Instagram");
    expect(await htmlDoErro("vencido")).toContain("Este link não vale mais.");
    expect(await htmlDoErro("falhou")).toContain("Não deu certo conectar a conta.");
    for (const motivo of ["negado", "vencido", "falhou"]) {
      expect(await htmlDoErro(motivo)).toContain("Se precisar, peça um novo link a quem te mandou.");
    }
  });

  it("um motivo fora da lista vira \"falhou\", e o texto que veio na URL nunca aparece", async () => {
    const texto = "Instagram API 400: access_token=vazado";
    const h = await htmlDoErro(texto);
    expect(h).toContain("Não deu certo conectar a conta.");
    expect(h).not.toContain("vazado");
    expect(await htmlDoErro(["negado", "vencido"])).toContain("Não deu certo conectar a conta.");
    expect(await htmlDoErro(undefined)).toContain("Não deu certo conectar a conta.");
  });
});
