// A TABELA DOS CONVITES DE CONEXÃO (a 021, docs/specs/2026-11-03-link-de-convite.md) e o repositório dela
// (lib/convites-repositorio.ts), conferidos no banco de verdade (o container).
//
// Como a 013, a 014 e a 018, a 021 está em `naoObservaveis` de lib/esquema.ts (a partida do painel não
// depende dela), e é este arquivo que a confere. A peça central é a reivindicação: o convite só é usado na
// mesma transação que grava a conta, e uma conta que falha ao gravar deixa o convite como estava.
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { bancoDescartavel } from "./harness";

type ModuloRepositorio = typeof import("@/lib/convites-repositorio");

const banco = bancoDescartavel();

/** A ordem das colunas é a da migração; o código lê por nome, e a lista inteira é o contrato. */
const COLUNAS = [
  "id",
  "codigo_hash",
  "para_quem",
  "criado_em",
  "expira_em",
  "cancelado_em",
  "usado_em",
  "conta_conectada",
  "ultimo_erro",
  "ultimo_erro_em",
  // A 024 (a conexão do LinkedIn, docs/specs/2026-11-06-linkedin-no-perfil.md, §1): a rede do convite e a
  // conta do painel que ganha o LinkedIn. testes-integracao/linkedin-tabela.integracao.ts confere as regras.
  "rede",
  "conta_alvo",
];

const CONTA = "17800000000021001";
const conta = (token: string) => ({
  ig_user_id: CONTA,
  username: "conta_do_convite",
  name: "Conta do convite",
  profile_picture_url: null,
  access_token: token,
  token_expires_at: new Date(Date.now() + 60 * 86_400_000),
});

let repo: ModuloRepositorio;

beforeEach(async () => {
  repo ??= await import("@/lib/convites-repositorio");
  await banco.db().sql().query(`delete from convites_de_conexao`);
  await banco.db().sql().query(`delete from accounts where ig_user_id = $1`, [CONTA]);
});

const linhaDo = async (id: string) =>
  ((await banco.db().sql().query(`select * from convites_de_conexao where id = $1`, [id])) as Record<string, unknown>[])[0];

const tokenDaConta = async () =>
  ((await banco.db().sql().query(`select access_token from accounts where ig_user_id = $1`, [CONTA])) as {
    access_token: string;
  }[])[0]?.access_token ?? null;

describe("a tabela convites_de_conexao", () => {
  it("nasce da 021 com as colunas que o código lê, e com o RLS ligado", async () => {
    const colunas = (await banco
      .db()
      .sql()
      .query(
        `select column_name from information_schema.columns
          where table_schema = current_schema() and table_name = 'convites_de_conexao'
          order by ordinal_position`
      )) as { column_name: string }[];
    expect(colunas.map((c) => c.column_name)).toEqual(COLUNAS);
    const [rls] = (await banco
      .db()
      .sql()
      .query(
        `select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = current_schema() and c.relname = 'convites_de_conexao'`
      )) as { relrowsecurity: boolean }[];
    expect(rls.relrowsecurity).toBe(true);
  });

  it("recusa o hash fora do formato, o \"para quem\" de 61 caracteres e o uso sem a conta", async () => {
    const inserir = (hash: string, paraQuem: string) =>
      banco
        .db()
        .sql()
        .query(`insert into convites_de_conexao (codigo_hash, para_quem, expira_em) values ($1, $2, now())`, [
          hash,
          paraQuem,
        ]);
    await expect(inserir("x".repeat(64), "Dr. Marcus")).rejects.toThrow(/codigo_hash_check/);
    await expect(inserir("a".repeat(64), "x".repeat(61))).rejects.toThrow(/para_quem_check/);
    await expect(inserir("a".repeat(64), "")).rejects.toThrow(/para_quem_check/);
    await inserir("a".repeat(64), "😀".repeat(60));
    await expect(inserir("a".repeat(64), "outro")).rejects.toThrow(/codigo_hash_key/);
    await expect(
      banco.db().sql().query(`update convites_de_conexao set usado_em = now() where codigo_hash = $1`, ["a".repeat(64)])
    ).rejects.toThrow(/usado_check/);
  });
});

describe("o repositório dos convites", () => {
  it("criar grava o hash do código, nunca o código, com 7 dias de prazo", async () => {
    const { id, codigo } = await repo.criarConvite("Dr. Marcus");
    const linha = await linhaDo(id);
    expect(linha.codigo_hash).toBe(createHash("sha256").update(codigo).digest("hex"));
    expect(Object.values(linha).some((v) => typeof v === "string" && v.includes(codigo))).toBe(false);
    expect(linha.para_quem).toBe("Dr. Marcus");
    expect((linha.expira_em as Date).getTime() - (linha.criado_em as Date).getTime()).toBe(7 * 86_400_000);
    expect(linha).toMatchObject({ cancelado_em: null, usado_em: null, conta_conectada: null, ultimo_erro: null });
  });

  it("acha pelo código e pelo id, e devolve null para o que não existe ou não tem o formato", async () => {
    const { id, codigo } = await repo.criarConvite("Dr. Marcus");
    expect((await repo.conviteDoCodigo(codigo))?.id).toBe(id);
    expect((await repo.conviteDoId(id))?.para_quem).toBe("Dr. Marcus");
    expect(await repo.conviteDoCodigo("a".repeat(43))).toBeNull();
    expect(await repo.conviteDoCodigo("curto")).toBeNull();
    expect(await repo.conviteDoId("00000000-0000-4000-8000-000000000000")).toBeNull();
    expect(await repo.conviteDoId("não é uuid")).toBeNull();
  });

  it("a lista vem do mais novo para o mais velho, até 20", async () => {
    for (let i = 0; i < 22; i++) await repo.criarConvite(`cliente ${i}`);
    const lista = await repo.listarConvites();
    expect(lista).toHaveLength(20);
    expect(lista[0].para_quem).toBe("cliente 21");
    expect(lista[19].para_quem).toBe("cliente 2");
    expect(Object.keys(lista[0])).not.toContain("codigo_hash");
  });

  it("a lista traz o arroba da conta que entrou pelo convite", async () => {
    const { id } = await repo.criarConvite("Dr. Marcus");
    await repo.reivindicarEGravarConta(id, conta("token-1"));
    await repo.criarConvite("pendente");
    const lista = await repo.listarConvites();
    expect(lista.find((c) => c.id === id)).toMatchObject({ conta_conectada: CONTA, conta_username: "conta_do_convite" });
    expect(lista.find((c) => c.id !== id)).toMatchObject({ conta_conectada: null, conta_username: null });
  });

  it("cancelar vale só para o pendente, uma vez", async () => {
    const { id } = await repo.criarConvite("Dr. Marcus");
    expect(await repo.cancelarConvite(id)).toBe(true);
    expect((await linhaDo(id)).cancelado_em).toBeInstanceOf(Date);
    expect(await repo.cancelarConvite(id)).toBe(false);
    const usado = await repo.criarConvite("outro");
    expect(await repo.reivindicarEGravarConta(usado.id, conta("token-1"))).toBe(true);
    expect(await repo.cancelarConvite(usado.id)).toBe(false);
  });

  it("reivindicar usa o convite e grava a conta, na mesma transação, uma vez só", async () => {
    const { id } = await repo.criarConvite("Dr. Marcus");
    expect(await repo.reivindicarEGravarConta(id, conta("token-1"))).toBe(true);
    expect(await tokenDaConta()).toBe("token-1");
    const linha = await linhaDo(id);
    expect(linha.usado_em).toBeInstanceOf(Date);
    expect(linha.conta_conectada).toBe(CONTA);
    // A segunda aba com o mesmo link: não reivindica, e não regrava a conta.
    expect(await repo.reivindicarEGravarConta(id, conta("token-2"))).toBe(false);
    expect(await tokenDaConta()).toBe("token-1");
  });

  it("não reivindica o cancelado nem o vencido, e não grava a conta", async () => {
    const cancelado = await repo.criarConvite("cancelado");
    await repo.cancelarConvite(cancelado.id);
    expect(await repo.reivindicarEGravarConta(cancelado.id, conta("token-1"))).toBe(false);
    const vencido = await repo.criarConvite("vencido");
    await banco
      .db()
      .sql()
      .query(`update convites_de_conexao set expira_em = now() - interval '1 second' where id = $1`, [vencido.id]);
    expect(await repo.reivindicarEGravarConta(vencido.id, conta("token-1"))).toBe(false);
    expect(await tokenDaConta()).toBeNull();
  });

  it("se a conta falha ao gravar, o convite volta a ficar pendente", async () => {
    const { id } = await repo.criarConvite("Dr. Marcus");
    // `access_token` é not null na tabela accounts: o upsert falha DEPOIS da reivindicação.
    const quebrada = { ...conta("x"), access_token: null as unknown as string };
    await expect(repo.reivindicarEGravarConta(id, quebrada)).rejects.toThrow();
    const linha = await linhaDo(id);
    expect(linha.usado_em).toBeNull();
    expect(linha.conta_conectada).toBeNull();
    expect(await repo.reivindicarEGravarConta(id, conta("token-1"))).toBe(true);
  });

  it("o erro anotado vai só para o convite no estado pedido", async () => {
    const pendente = await repo.criarConvite("pendente");
    await repo.anotarErroDoConvite(pendente.id, "a Meta recusou", "pendente");
    expect(await linhaDo(pendente.id)).toMatchObject({ ultimo_erro: "a Meta recusou" });
    expect((await linhaDo(pendente.id)).ultimo_erro_em).toBeInstanceOf(Date);
    await repo.anotarErroDoConvite(pendente.id, "não entra", "usado");
    expect((await linhaDo(pendente.id)).ultimo_erro).toBe("a Meta recusou");

    const usado = await repo.criarConvite("usado");
    await repo.reivindicarEGravarConta(usado.id, conta("token-1"));
    await repo.anotarErroDoConvite(usado.id, "não entra", "pendente");
    expect((await linhaDo(usado.id)).ultimo_erro).toBeNull();
    await repo.anotarErroDoConvite(usado.id, "conectada, mas a assinatura dos webhooks falhou: x", "usado");
    expect((await linhaDo(usado.id)).ultimo_erro).toBe("conectada, mas a assinatura dos webhooks falhou: x");
  });
});
