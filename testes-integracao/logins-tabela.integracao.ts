// AS TABELAS DOS LOGINS E DAS SESSÕES (a 022, docs/specs/2026-11-04-logins.md) e o repositório delas
// (lib/logins-repositorio.ts), conferidos no banco de verdade (o container).
//
// Ao contrário da 021, a 022 é observável: lib/esquema.ts a exige na partida (testes-integracao/
// esquema-de-partida.integracao.ts). Este arquivo confere as colunas, os `check`, o RLS e as regras do
// repositório, com a peça mais delicada no fim: a trava do último administrador com duas desativações ao
// mesmo tempo (achado 168).
import { beforeEach, describe, expect, it } from "vitest";
import { bancoDescartavel } from "./harness";

type ModuloRepositorio = typeof import("@/lib/logins-repositorio");
type ModuloLogins = typeof import("@/lib/logins");

const banco = bancoDescartavel();

const COLUNAS_DE_LOGINS = ["id", "email", "nome", "senha_hash", "administrador", "criado_em", "desativado_em"];
const COLUNAS_DE_SESSOES = ["id", "token_hash", "login_id", "criada_em", "expira_em"];

// Um hash com o formato certo, sem pagar o scrypt: o repositório não confere senha, só guarda.
const HASH = `scrypt$131072$8$1$${Buffer.alloc(16, 1).toString("base64")}$${Buffer.alloc(64, 2).toString("base64")}`;

let repo: ModuloRepositorio;
let logins: ModuloLogins;

beforeEach(async () => {
  repo ??= await import("@/lib/logins-repositorio");
  logins ??= await import("@/lib/logins");
  await banco.db().sql().query(`delete from sessoes`);
  await banco.db().sql().query(`delete from logins`);
});

const q = (texto: string, params: unknown[] = []) => banco.db().sql().query(texto, params) as Promise<Record<string, unknown>[]>;

async function novoLogin(email: string, senhaHash: string | null = HASH): Promise<string> {
  const r = await repo.criarLogin({ email, nome: email.split("@")[0], senhaHash });
  if ("erro" in r) throw new Error(r.erro);
  return r.id;
}

const sessoesDo = async (loginId: string) =>
  Number((await q(`select count(*)::int as n from sessoes where login_id = $1`, [loginId]))[0].n);

describe("as tabelas logins e sessoes", () => {
  it("nascem da 022 com as colunas que o código lê, e com o RLS ligado", async () => {
    for (const [tabela, esperadas] of [
      ["logins", COLUNAS_DE_LOGINS],
      ["sessoes", COLUNAS_DE_SESSOES],
    ] as const) {
      const colunas = await q(
        `select column_name from information_schema.columns
          where table_schema = current_schema() and table_name = $1 order by ordinal_position`,
        [tabela]
      );
      expect(colunas.map((c) => c.column_name), tabela).toEqual(esperadas);
      const [rls] = await q(
        `select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = current_schema() and c.relname = $1`,
        [tabela]
      );
      expect(rls.relrowsecurity, tabela).toBe(true);
    }
  });

  it("recusa o e-mail fora de minúsculas, o nome com espaço na ponta, o hash torto e o e-mail repetido", async () => {
    const inserir = (email: string, nome: string, hash: string | null) =>
      q(`insert into logins (email, nome, senha_hash) values ($1, $2, $3)`, [email, nome, hash]);
    await expect(inserir("Fulano@exemplo.invalid", "Fulano", HASH)).rejects.toThrow(/logins_email_check/);
    await expect(inserir(" fulano@exemplo.invalid", "Fulano", HASH)).rejects.toThrow(/logins_email_check/);
    await expect(inserir("fulano@exemplo.invalid", " Fulano", HASH)).rejects.toThrow(/logins_nome_check/);
    await expect(inserir("fulano@exemplo.invalid", "x".repeat(61), HASH)).rejects.toThrow(/logins_nome_check/);
    await expect(inserir("fulano@exemplo.invalid", "Fulano", "senha-em-claro")).rejects.toThrow(/logins_senha_hash_check/);
    await inserir("fulano@exemplo.invalid", "Fulano", null);
    await expect(inserir("fulano@exemplo.invalid", "Outro", HASH)).rejects.toThrow(/logins_email_key/);
    const [linha] = await q(`select administrador from logins where email = 'fulano@exemplo.invalid'`);
    expect(linha.administrador).toBe(true);
  });

  it("recusa o hash de sessão fora do formato, e apagar o login apaga as sessões", async () => {
    const id = await novoLogin("sessao@exemplo.invalid");
    await expect(
      q(`insert into sessoes (token_hash, login_id, expira_em) values ($1, $2, now())`, ["x".repeat(64), id])
    ).rejects.toThrow(/sessoes_token_hash_check/);
    await repo.criarSessao(id);
    expect(await sessoesDo(id)).toBe(1);
    await q(`delete from logins where id = $1`, [id]);
    expect(Number((await q(`select count(*)::int as n from sessoes`))[0].n)).toBe(0);
  });
});

describe("o repositório dos logins", () => {
  it("criar devolve o id, e o e-mail repetido volta como erro, e não como exceção", async () => {
    const r = await repo.criarLogin({ email: "a@exemplo.invalid", nome: "A", senhaHash: HASH });
    expect("id" in r).toBe(true);
    expect(await repo.criarLogin({ email: "a@exemplo.invalid", nome: "Outra A", senhaHash: HASH })).toEqual({
      erro: "email_repetido",
    });
  });

  it("a entrada lê o id, o hash e a desativação pelo e-mail", async () => {
    const id = await novoLogin("entrada@exemplo.invalid");
    expect(await repo.loginParaEntrar("entrada@exemplo.invalid")).toEqual({ id, senha_hash: HASH, desativado: false });
    expect(await repo.loginParaEntrar("ninguem@exemplo.invalid")).toBeNull();
  });

  it("a passagem grava o hash só no login ativo sem senha, uma vez", async () => {
    const semSenha = await novoLogin("passagem@exemplo.invalid", null);
    const comSenha = await novoLogin("com-senha@exemplo.invalid");
    expect(await repo.gravarSenhaDaPassagem(comSenha, HASH)).toBe(false);
    expect(await repo.gravarSenhaDaPassagem(semSenha, HASH)).toBe(true);
    expect(await repo.gravarSenhaDaPassagem(semSenha, HASH)).toBe(false);
    const desativadoSemSenha = await novoLogin("desativado-sem-senha@exemplo.invalid", null);
    await q(`update logins set desativado_em = now() where id = $1`, [desativadoSemSenha]);
    expect(await repo.gravarSenhaDaPassagem(desativadoSemSenha, HASH)).toBe(false);
  });

  it("a lista vem do mais velho para o mais novo, sem o hash", async () => {
    await novoLogin("primeiro@exemplo.invalid");
    await novoLogin("segundo@exemplo.invalid");
    const lista = await repo.listarLogins();
    expect(lista.map((l) => l.email)).toEqual(["primeiro@exemplo.invalid", "segundo@exemplo.invalid"]);
    expect(Object.keys(lista[0]).sort()).toEqual(["administrador", "criado_em", "desativado_em", "email", "id", "nome"]);
  });

  it("a senha nova do administrador derruba TODAS as sessões daquele login", async () => {
    const id = await novoLogin("esqueceu@exemplo.invalid");
    const outro = await novoLogin("outro@exemplo.invalid");
    await repo.criarSessao(id);
    await repo.criarSessao(id);
    await repo.criarSessao(outro);
    expect(await repo.definirSenha(id, HASH.replace("$131072$", "$16384$"))).toBe(true);
    expect(await sessoesDo(id)).toBe(0);
    expect(await sessoesDo(outro)).toBe(1);
    expect((await repo.loginParaEntrar("esqueceu@exemplo.invalid"))?.senha_hash).toContain("$16384$");
  });

  it("a troca da própria senha mantém a sessão de quem trocou e derruba as outras", async () => {
    const id = await novoLogin("troca@exemplo.invalid");
    const fica = await repo.sessaoPorCodigo(await repo.criarSessao(id));
    const vai = await repo.criarSessao(id);
    expect(await repo.trocarPropriaSenha(id, HASH, fica!.sessao_id)).toBe(true);
    expect(await sessoesDo(id)).toBe(1);
    expect(await repo.sessaoPorCodigo(vai)).toBeNull();
  });

  it("desativar derruba as sessões, e reativar volta a deixar a sessão nova valer", async () => {
    const quem = await novoLogin("admin@exemplo.invalid");
    const alvo = await novoLogin("alvo@exemplo.invalid");
    const codigo = await repo.criarSessao(alvo);
    expect(await repo.desativarLogin(alvo, quem)).toBe("desativado");
    expect(await sessoesDo(alvo)).toBe(0);
    expect(await repo.sessaoPorCodigo(codigo)).toBeNull();
    expect(await repo.desativarLogin(alvo, quem)).toBe("nao_encontrado");
    expect(await repo.reativarLogin(alvo)).toBe(true);
    expect(await repo.reativarLogin(alvo)).toBe(false);
    expect(await repo.sessaoPorCodigo(await repo.criarSessao(alvo))).not.toBeNull();
  });

  it("ninguém desativa o próprio login, e o último administrador ativo fica", async () => {
    const a = await novoLogin("a@exemplo.invalid");
    const b = await novoLogin("b@exemplo.invalid");
    expect(await repo.desativarLogin(a, a)).toBe("proprio");
    expect(await repo.desativarLogin(b, a)).toBe("desativado");
    // Com B fora, A é o último administrador ativo. O pedido sai em nome de B só para passar da 1ª trava:
    // o repositório não confere quem pede, e a 2ª trava tem de segurar sozinha.
    expect(await repo.desativarLogin(a, b)).toBe("ultimo_administrador");
    expect(Number((await q(`select count(*)::int as n from logins where desativado_em is null`))[0].n)).toBe(1);
  });

  it("duas desativações ao mesmo tempo deixam 1 administrador ativo, e não 0 (achado 168)", async () => {
    const a = await novoLogin("a@exemplo.invalid");
    const b = await novoLogin("b@exemplo.invalid");
    // O ACERTO DO TEMPO É FEITO PELO BANCO, e não pela sorte: uma transação de fora segura as linhas dos
    // administradores, as duas desativações saem enquanto ela segura, e só então ela solta. Com o `for
    // update`, as duas esperam na contagem e a segunda conta de novo depois da primeira; sem ele, as duas
    // contam 2 antes de esperar, e cada uma desativa a outra.
    let juntas: Promise<string[]> | undefined;
    await banco
      .db()
      .sql()
      .begin(async (tx) => {
        await tx.query(`select id from logins where administrador and desativado_em is null for update`);
        juntas = Promise.all([repo.desativarLogin(b, a), repo.desativarLogin(a, b)]);
        // As duas saem e param nas linhas travadas. A transação de fora termina sem esperá-las, e é o fim
        // dela que solta as linhas.
        await new Promise((r) => setTimeout(r, 400));
      });
    const resultados = await juntas!;
    expect([...resultados].sort()).toEqual(["desativado", "ultimo_administrador"]);
    expect(Number((await q(`select count(*)::int as n from logins where desativado_em is null`))[0].n)).toBe(1);
  });
});

describe("o repositório das sessões", () => {
  it("criar grava o hash do código, nunca o código, com 30 dias de prazo", async () => {
    const id = await novoLogin("prazo@exemplo.invalid");
    const codigo = await repo.criarSessao(id);
    expect(logins.codigoDeSessaoBemFormado(codigo)).toBe(true);
    const [linha] = await q(
      `select token_hash, extract(epoch from expira_em - criada_em)::int as segundos from sessoes where login_id = $1`,
      [id]
    );
    expect(linha.token_hash).toBe(logins.hashDoCodigoDeSessao(codigo));
    expect(linha.token_hash).not.toContain(codigo);
    expect(linha.segundos).toBe(30 * 86_400);
  });

  it("a sessão válida devolve o login; a vencida, a de login desativado e a desconhecida não", async () => {
    const id = await novoLogin("valida@exemplo.invalid");
    const codigo = await repo.criarSessao(id);
    expect(await repo.sessaoPorCodigo(codigo)).toMatchObject({
      id,
      email: "valida@exemplo.invalid",
      nome: "valida",
      administrador: true,
    });
    expect(await repo.sessaoPorCodigo(logins.novoCodigoDeSessao())).toBeNull();
    expect(await repo.sessaoPorCodigo("v2.1790000000.abcdef")).toBeNull();
    expect(await repo.sessaoPorCodigo(undefined)).toBeNull();

    await q(`update sessoes set expira_em = now() - interval '1 second' where login_id = $1`, [id]);
    expect(await repo.sessaoPorCodigo(codigo)).toBeNull();

    const outro = await repo.criarSessao(id);
    expect(await repo.sessaoPorCodigo(outro)).not.toBeNull();
    await q(`update logins set desativado_em = now() where id = $1`, [id]);
    expect(await repo.sessaoPorCodigo(outro)).toBeNull();
  });

  it("criar uma sessão limpa as vencidas", async () => {
    const id = await novoLogin("limpeza@exemplo.invalid");
    await repo.criarSessao(id);
    await q(`update sessoes set expira_em = now() - interval '1 second'`);
    await repo.criarSessao(id);
    expect(await sessoesDo(id)).toBe(1);
  });

  it("o Sair apaga a sessão no banco", async () => {
    const id = await novoLogin("sair@exemplo.invalid");
    const codigo = await repo.criarSessao(id);
    await repo.apagarSessao(codigo);
    expect(await repo.sessaoPorCodigo(codigo)).toBeNull();
    expect(await sessoesDo(id)).toBe(0);
  });
});
