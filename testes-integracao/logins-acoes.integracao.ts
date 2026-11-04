// A PÁGINA LOGINS E AS AÇÕES DELA (docs/specs/2026-11-04-logins.md, seção 4), com a sessão do login de
// teste, no contexto de requisição semeado e no banco descartável. E o convite, que passou a ser só do
// administrador.
//
// O login de teste nasce administrador (é o padrão da coluna). Para o caso de quem não é, ele perde o
// marcador no próprio caso e o recebe de volta no `beforeEach` seguinte.
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bancoDescartavel } from "./harness";
import { comoNumaRequisicaoComSessao, EMAIL_DE_TESTE } from "./semear-requisicao";

type ModuloAcoes = typeof import("@/app/logins/actions");
type ModuloPagina = typeof import("@/app/logins/page");
type ModuloSetup = typeof import("@/app/setup/actions");
type ModuloRepositorio = typeof import("@/lib/logins-repositorio");
type ModuloLogins = typeof import("@/lib/logins");
type ModuloTextos = typeof import("@/lib/logins-textos");

const banco = bancoDescartavel();
const q = (texto: string, params: unknown[] = []) => banco.db().sql().query(texto, params) as Promise<Record<string, unknown>[]>;

let acoes: ModuloAcoes;
let pagina: ModuloPagina;
let setup: ModuloSetup;
let repo: ModuloRepositorio;
let logins: ModuloLogins;
let textos: ModuloTextos;

beforeAll(async () => {
  acoes = await import("@/app/logins/actions");
  pagina = await import("@/app/logins/page");
  setup = await import("@/app/setup/actions");
  repo = await import("@/lib/logins-repositorio");
  logins = await import("@/lib/logins");
  textos = await import("@/lib/logins-textos");
});

beforeEach(async () => {
  await q(`delete from logins where email <> $1`, [EMAIL_DE_TESTE]);
  await q(`update logins set administrador = true, desativado_em = null where email = $1`, [EMAIL_DE_TESTE]);
  await q(`delete from convites_de_conexao`);
});

const form = (campos: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
};

/** Roda o corpo com a sessão de teste e devolve o destino do redirect (ou null) e o valor. */
async function comSessao<T>(rota: string, corpo: () => Promise<T>): Promise<{ destino: string | null; valor?: T }> {
  const { valor } = await comoNumaRequisicaoComSessao(rota, async () => {
    try {
      return { destino: null, valor: await corpo() };
    } catch (e) {
      const d = (e as { digest?: unknown }).digest;
      if (typeof d !== "string" || !d.startsWith("NEXT_REDIRECT;")) throw e;
      return { destino: d.split(";").slice(2, -2).join(";") };
    }
  });
  return valor;
}

async function outroLogin(email: string): Promise<string> {
  const r = await repo.criarLogin({ email, nome: "Outra pessoa", senhaHash: await logins.hashDaSenha("a senha da outra pessoa") });
  if ("erro" in r) throw new Error(r.erro);
  return r.id;
}

const idDoTeste = async () => String((await q(`select id from logins where email = $1`, [EMAIL_DE_TESTE]))[0].id);
const sessoesDo = async (id: string) => Number((await q(`select count(*)::int as n from sessoes where login_id = $1`, [id]))[0].n);

describe("criar um login", () => {
  it("grava o login com o hash da senha, e não a senha", async () => {
    const r = await comSessao("/logins", () =>
      acoes.criarLoginAction({}, form({ nome: "  Maria  ", email: " Maria@Exemplo.INVALID ", senha: "a senha inicial da maria" }))
    );
    expect(r.valor?.ok).toMatch(/Login de Maria criado/);
    const [linha] = await q(`select nome, senha_hash, administrador from logins where email = 'maria@exemplo.invalid'`);
    expect(linha.nome).toBe("Maria");
    expect(linha.administrador).toBe(true);
    expect(String(linha.senha_hash)).not.toContain("a senha inicial da maria");
    expect(await logins.senhaConfere("a senha inicial da maria", String(linha.senha_hash))).toBe(true);
  });

  it("recusa o e-mail repetido, o nome vazio, o e-mail torto e a senha curta, sem gravar", async () => {
    await outroLogin("repetido@exemplo.invalid");
    const casos: [Record<string, string>, string][] = [
      [{ nome: "X", email: "repetido@exemplo.invalid", senha: "uma senha comprida" }, textos.FRASE_DO_EMAIL_REPETIDO],
      [{ nome: "  ", email: "novo@exemplo.invalid", senha: "uma senha comprida" }, textos.FRASE_DO_NOME],
      [{ nome: "X", email: "novo.exemplo.invalid", senha: "uma senha comprida" }, textos.FRASE_DO_EMAIL],
      [{ nome: "X", email: "novo@exemplo.invalid", senha: "curta" }, textos.FRASE_DA_SENHA],
    ];
    for (const [campos, frase] of casos) {
      const r = await comSessao("/logins", () => acoes.criarLoginAction({}, form(campos)));
      expect(r.valor, JSON.stringify(campos)).toEqual({ erro: frase });
    }
    expect((await q(`select email from logins where email = 'novo@exemplo.invalid'`)).length).toBe(0);
  });
});

describe("a senha nova e a desativação", () => {
  it("a senha nova derruba as sessões daquele login, e a senha nova entra", async () => {
    const id = await outroLogin("esqueceu@exemplo.invalid");
    await repo.criarSessao(id);
    await repo.criarSessao(id);
    const r = await comSessao("/logins", () => acoes.definirSenhaAction({}, form({ id, senha: "a senha nova da pessoa" })));
    expect(r.valor).toEqual({ ok: textos.FRASE_DA_SENHA_NOVA_DEFINIDA });
    expect(await sessoesDo(id)).toBe(0);
    const hash = String((await q(`select senha_hash from logins where id = $1`, [id]))[0].senha_hash);
    expect(await logins.senhaConfere("a senha nova da pessoa", hash)).toBe(true);
  });

  it("desativar outro login derruba as sessões dele; reativar devolve a entrada", async () => {
    const id = await outroLogin("sai@exemplo.invalid");
    await repo.criarSessao(id);
    expect((await comSessao("/logins", () => acoes.desativarLoginAction(form({ id })))).destino).toBe("/logins?aviso=desativado");
    expect(await sessoesDo(id)).toBe(0);
    expect((await q(`select desativado_em from logins where id = $1`, [id]))[0].desativado_em).not.toBeNull();
    expect((await comSessao("/logins", () => acoes.reativarLoginAction(form({ id })))).destino).toBe("/logins?aviso=reativado");
    expect((await q(`select desativado_em from logins where id = $1`, [id]))[0].desativado_em).toBeNull();
  });

  it("ninguém desativa o próprio login pela página", async () => {
    await comSessao("/logins", async () => null); // garante que o login de teste já nasceu
    const id = await idDoTeste();
    expect((await comSessao("/logins", () => acoes.desativarLoginAction(form({ id })))).destino).toBe("/logins?aviso=proprio");
    expect((await q(`select desativado_em from logins where id = $1`, [id]))[0].desativado_em).toBeNull();
  });
});

describe("quem não é administrador", () => {
  it("volta para o início em cada ação da página Logins, sem gravar nada", async () => {
    const alvo = await outroLogin("alvo@exemplo.invalid");
    await q(`update logins set administrador = false where email = $1`, [EMAIL_DE_TESTE]);
    const tentativas: (() => Promise<unknown>)[] = [
      () => acoes.criarLoginAction({}, form({ nome: "X", email: "intruso@exemplo.invalid", senha: "uma senha comprida" })),
      () => acoes.definirSenhaAction({}, form({ id: alvo, senha: "uma senha comprida" })),
      () => acoes.desativarLoginAction(form({ id: alvo })),
      () => acoes.reativarLoginAction(form({ id: alvo })),
    ];
    for (const t of tentativas) expect((await comSessao("/logins", t)).destino).toBe("/");
    expect((await q(`select email from logins where email = 'intruso@exemplo.invalid'`)).length).toBe(0);
    expect((await q(`select desativado_em from logins where id = $1`, [alvo]))[0].desativado_em).toBeNull();
  });

  it("volta para o início no convite, sem gravar nada", async () => {
    await q(`update logins set administrador = false where email = $1`, [EMAIL_DE_TESTE]);
    expect((await comSessao("/setup", () => setup.gerarConvite(null, form({ para_quem: "Alguém" })))).destino).toBe("/");
    expect((await comSessao("/setup", () => setup.cancelarConvite(form({ id: "00000000-0000-0000-0000-000000000000" })))).destino).toBe("/");
    expect((await q(`select id from convites_de_conexao`)).length).toBe(0);
  });

  it("volta para o início na página Logins", async () => {
    await q(`update logins set administrador = false where email = $1`, [EMAIL_DE_TESTE]);
    expect((await comSessao("/logins", () => pagina.default({ searchParams: Promise.resolve({}) }))).destino).toBe("/");
  });
});

describe("a página Logins", () => {
  it("lista os logins, marca quem está usando e mostra só o aviso da lista fechada", async () => {
    await outroLogin("outra@exemplo.invalid");
    const desenhar = async (aviso: string) => {
      const r = await comSessao("/logins", async () =>
        renderToStaticMarkup(await pagina.default({ searchParams: Promise.resolve({ aviso }) }))
      );
      return String(r.valor);
    };
    const h = await desenhar("desativado");
    expect(h).toContain("outra@exemplo.invalid");
    expect(h).toContain(EMAIL_DE_TESTE);
    expect(h).toContain(">você<");
    expect(h).toContain(textos.AVISOS_DA_PAGINA.desativado);
    expect(h).not.toContain("scrypt$");
    // O próprio login não tem o botão de desativar: um só "Desativar", o da outra pessoa.
    expect(h.match(/>Desativar</g)?.length).toBe(1);
    // Nem a senha nova: ela derruba TODAS as sessões do login, e quem a usasse em si mesmo se derrubaria
    // (nota da auditoria ao plano, 04/11). Para a própria senha, a página aponta a Minha conta.
    expect(h).toContain("Senha nova para Outra pessoa");
    expect(h).not.toContain("Senha nova para Login de teste");
    expect(h).toContain('href="/minha-conta"');
    const torto = await desenhar("<b>vazado</b>");
    expect(torto).not.toContain("vazado");
  });
});
