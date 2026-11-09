// A CONEXÃO DO LINKEDIN NO BANCO (a 024, docs/specs/2026-11-06-linkedin-no-perfil.md, §1 e §2; a parte 1 da
// entrega, a conexão): a tabela `linkedin_conexoes`, a rede e a conta-alvo do convite, e os dois repositórios
// que as tocam (lib/linkedin-conexoes.ts e lib/convites-repositorio.ts), no banco de verdade (o container).
//
// Como a 021, a 024 está em `naoObservaveis` de lib/esquema.ts (a partida do painel não depende dela), e é
// este arquivo que a confere. A peça central é a reivindicação do convite do LinkedIn: o convite só é usado
// na mesma transação que grava a conexão, a conexão vai para a conta-alvo do convite (e não para uma conta
// que venha de fora), e o convite de uma rede nunca é usado pela volta da outra.
import { beforeEach, describe, expect, it } from "vitest";
import { bancoDescartavel } from "./harness";
import { migracoesEmOrdem } from "./migracoes";

type ModuloConexoes = typeof import("@/lib/linkedin-conexoes");
type ModuloConvites = typeof import("@/lib/convites-repositorio");

const banco = bancoDescartavel();

/** A ordem das colunas é a da migração; o código lê por nome, e a lista inteira é o contrato. */
const COLUNAS = ["account_id", "pessoa_id", "nome", "access_token", "expira_em", "conectado_em"];

// Valores inventados. Nenhuma credencial de verdade entra em teste.
const CONTA = "17800000000024001";
const OUTRA = "17800000000024002";
const DAQUI_A_60_DIAS = () => new Date(Date.now() + 60 * 86_400_000);

const pessoa = (token: string, pessoaId = "pessoaDoLinkedinA1") => ({
  pessoa_id: pessoaId,
  nome: "Dra. Ana Souza",
  access_token: token,
  expira_em: DAQUI_A_60_DIAS(),
});

const contaDoInstagram = (token: string) => ({
  ig_user_id: OUTRA,
  username: "outra_conta",
  name: null,
  profile_picture_url: null,
  access_token: token,
  token_expires_at: null,
});

let conexoes: ModuloConexoes;
let convites: ModuloConvites;

const sql = () => banco.db().sql();

beforeEach(async () => {
  conexoes ??= await import("@/lib/linkedin-conexoes");
  convites ??= await import("@/lib/convites-repositorio");
  await sql().query(`delete from linkedin_conexoes`);
  await sql().query(`delete from convites_de_conexao`);
  await sql().query(`delete from accounts where ig_user_id in ($1, $2)`, [CONTA, OUTRA]);
  await sql().query(`insert into accounts (ig_user_id, username, access_token) values ($1, 'conta_da_ana', 'ig-token-de-teste')`, [
    CONTA,
  ]);
});

const conexaoNoBanco = async (conta: string) =>
  ((await sql().query(`select * from linkedin_conexoes where account_id = $1`, [conta])) as Record<string, unknown>[])[0] ?? null;

const conviteNoBanco = async (id: string) =>
  ((await sql().query(`select * from convites_de_conexao where id = $1`, [id])) as Record<string, unknown>[])[0] ?? null;

describe("a tabela linkedin_conexoes", () => {
  it("nasce da 024 com as colunas que o código lê, e com o RLS ligado", async () => {
    const colunas = (await sql().query(
      `select column_name from information_schema.columns
        where table_schema = current_schema() and table_name = 'linkedin_conexoes'
        order by ordinal_position`
    )) as { column_name: string }[];
    expect(colunas.map((c) => c.column_name)).toEqual(COLUNAS);
    const [rls] = (await sql().query(
      `select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = current_schema() and c.relname = 'linkedin_conexoes'`
    )) as { relrowsecurity: boolean }[];
    expect(rls.relrowsecurity).toBe(true);
  });

  it("uma conexão por conta, só de conta que existe, e ela sai junto com a conta", async () => {
    const inserir = (conta: string) =>
      sql().query(
        `insert into linkedin_conexoes (account_id, pessoa_id, nome, access_token, expira_em)
         values ($1, 'p', 'n', 't', now() + interval '60 days')`,
        [conta]
      );
    await expect(inserir("17800000000029999")).rejects.toThrow(/linkedin_conexoes_account_id_fkey/);
    await inserir(CONTA);
    await expect(inserir(CONTA)).rejects.toThrow(/linkedin_conexoes_pkey/);
    await sql().query(`delete from accounts where ig_user_id = $1`, [CONTA]);
    expect(await conexaoNoBanco(CONTA)).toBeNull();
  });

  it("a 024 roda duas vezes sem erro, e o convite do LinkedIn que já existe continua de pé", async () => {
    const m024 = migracoesEmOrdem().find((m) => m.nome === "024-linkedin-conexoes.sql");
    if (!m024) throw new Error("a 024 não está na pasta");
    const { id } = await convites.criarConvite("@conta_da_ana", { rede: "linkedin", contaAlvo: CONTA });
    await sql().query(m024.comandos);
    await sql().query(m024.comandos);
    expect(await conviteNoBanco(id)).toMatchObject({ rede: "linkedin", conta_alvo: CONTA });
    const restricoes = (await sql().query(
      `select conname from pg_constraint where conrelid = 'convites_de_conexao'::regclass and conname like '%alvo%'
        order by conname`
    )) as { conname: string }[];
    expect(restricoes.map((r) => r.conname)).toEqual(["convites_de_conexao_alvo_check", "convites_de_conexao_conta_alvo_fkey"]);
  });
});

describe("a rede e a conta-alvo do convite", () => {
  it("o convite de hoje fica instagram e sem alvo; o do LinkedIn exige o alvo; o do Instagram não aceita alvo", async () => {
    const { id } = await convites.criarConvite("Dr. Marcus");
    expect(await conviteNoBanco(id)).toMatchObject({ rede: "instagram", conta_alvo: null });

    const inserir = (rede: string, alvo: string | null) =>
      sql().query(
        `insert into convites_de_conexao (codigo_hash, para_quem, expira_em, rede, conta_alvo)
         values (md5(random()::text) || md5(random()::text), 'x', now() + interval '1 day', $1, $2)`,
        [rede, alvo]
      );
    await expect(inserir("linkedin", null)).rejects.toThrow(/convites_de_conexao_alvo_check/);
    await expect(inserir("instagram", CONTA)).rejects.toThrow(/convites_de_conexao_alvo_check/);
    await expect(inserir("tiktok", null)).rejects.toThrow(/convites_de_conexao_rede_check/);
    await expect(inserir("linkedin", "17800000000029999")).rejects.toThrow(/convites_de_conexao_conta_alvo_fkey/);
    await inserir("linkedin", CONTA);
  });

  it("o convite do LinkedIn sai junto com a conta-alvo", async () => {
    const { id } = await convites.criarConvite("@conta_da_ana", { rede: "linkedin", contaAlvo: CONTA });
    expect(await conviteNoBanco(id)).toMatchObject({ rede: "linkedin", conta_alvo: CONTA });
    await sql().query(`delete from accounts where ig_user_id = $1`, [CONTA]);
    expect(await conviteNoBanco(id)).toBeNull();
  });

  it("o convite lido pelo código e pelo id traz a rede e a conta-alvo", async () => {
    const { id, codigo } = await convites.criarConvite("@conta_da_ana", { rede: "linkedin", contaAlvo: CONTA });
    expect(await convites.conviteDoCodigo(codigo)).toMatchObject({ id, rede: "linkedin", conta_alvo: CONTA });
    expect(await convites.conviteDoId(id)).toMatchObject({ rede: "linkedin", conta_alvo: CONTA });
  });
});

describe("o repositório das conexões", () => {
  it("gravar cria, e gravar de novo troca a pessoa, o nome, o token e o vencimento da mesma conta", async () => {
    await conexoes.gravarConexao({ account_id: CONTA, ...pessoa("token-1") });
    const primeira = await conexaoNoBanco(CONTA);
    expect(primeira).toMatchObject({ pessoa_id: "pessoaDoLinkedinA1", nome: "Dra. Ana Souza", access_token: "token-1" });
    await sql().query(`update linkedin_conexoes set conectado_em = now() - interval '1 day' where account_id = $1`, [CONTA]);

    const outraPessoa = { ...pessoa("token-2", "pessoaDoLinkedinB2"), nome: "Dr. Bruno Lima" };
    await conexoes.gravarConexao({ account_id: CONTA, ...outraPessoa });
    const segunda = await conexaoNoBanco(CONTA);
    expect(segunda).toMatchObject({ pessoa_id: "pessoaDoLinkedinB2", nome: "Dr. Bruno Lima", access_token: "token-2" });
    expect((segunda!.conectado_em as Date).getTime()).toBeGreaterThan(Date.now() - 60_000);
    expect(((await sql().query(`select count(*)::int as n from linkedin_conexoes`)) as { n: number }[])[0].n).toBe(1);
  });

  it("a conexão inteira (com o token) é só da conexaoDaConta; o resumo leva só o nome e o vencimento", async () => {
    const dados = pessoa("token-1");
    await conexoes.gravarConexao({ account_id: CONTA, ...dados });
    expect(await conexoes.conexaoDaConta(CONTA)).toMatchObject({ account_id: CONTA, access_token: "token-1" });

    const resumo = await conexoes.resumoDaConexao(CONTA);
    expect(Object.keys(resumo ?? {}).sort()).toEqual(["expira_em", "nome"]);
    expect(resumo?.nome).toBe("Dra. Ana Souza");
    expect(resumo?.expira_em.getTime()).toBe(dados.expira_em.getTime());

    const todos = await conexoes.resumosDasConexoes();
    expect([...todos.keys()]).toEqual([CONTA]);
    expect(Object.keys(todos.get(CONTA) ?? {}).sort()).toEqual(["expira_em", "nome"]);

    expect(await conexoes.conexaoDaConta(OUTRA)).toBeNull();
    expect(await conexoes.resumoDaConexao(OUTRA)).toBeNull();
  });

  it("apagar apaga a da conta, uma vez", async () => {
    await conexoes.gravarConexao({ account_id: CONTA, ...pessoa("token-1") });
    expect(await conexoes.apagarConexao(CONTA)).toBe(true);
    expect(await conexaoNoBanco(CONTA)).toBeNull();
    expect(await conexoes.apagarConexao(CONTA)).toBe(false);
  });
});

describe("a reivindicação do convite do LinkedIn", () => {
  it("usa o convite e grava a conexão na conta-alvo, na mesma transação, uma vez só", async () => {
    const { id } = await convites.criarConvite("@conta_da_ana", { rede: "linkedin", contaAlvo: CONTA });
    expect(await convites.reivindicarEGravarConexao(id, pessoa("token-1"))).toBe(CONTA);
    expect(await conexaoNoBanco(CONTA)).toMatchObject({ access_token: "token-1" });
    const linha = await conviteNoBanco(id);
    expect(linha?.usado_em).toBeInstanceOf(Date);
    expect(linha?.conta_conectada).toBe(CONTA);
    // A segunda aba com o mesmo link: não reivindica, e não regrava a conexão.
    expect(await convites.reivindicarEGravarConexao(id, pessoa("token-2"))).toBeNull();
    expect(await conexaoNoBanco(CONTA)).toMatchObject({ access_token: "token-1" });
  });

  it("não reivindica o cancelado nem o vencido, e não grava a conexão", async () => {
    const cancelado = await convites.criarConvite("@conta_da_ana", { rede: "linkedin", contaAlvo: CONTA });
    await convites.cancelarConvite(cancelado.id);
    expect(await convites.reivindicarEGravarConexao(cancelado.id, pessoa("token-1"))).toBeNull();
    const vencido = await convites.criarConvite("@conta_da_ana", { rede: "linkedin", contaAlvo: CONTA });
    await sql().query(`update convites_de_conexao set expira_em = now() - interval '1 second' where id = $1`, [vencido.id]);
    expect(await convites.reivindicarEGravarConexao(vencido.id, pessoa("token-1"))).toBeNull();
    expect(await conexaoNoBanco(CONTA)).toBeNull();
  });

  it("se a conexão falha ao gravar, o convite volta a ficar pendente", async () => {
    const { id } = await convites.criarConvite("@conta_da_ana", { rede: "linkedin", contaAlvo: CONTA });
    // `access_token` é not null: a gravação falha DEPOIS da reivindicação.
    const quebrada = { ...pessoa("x"), access_token: null as unknown as string };
    await expect(convites.reivindicarEGravarConexao(id, quebrada)).rejects.toThrow();
    expect(await conviteNoBanco(id)).toMatchObject({ usado_em: null, conta_conectada: null });
    expect(await convites.reivindicarEGravarConexao(id, pessoa("token-1"))).toBe(CONTA);
  });

  it("o convite de uma rede nunca é usado pela volta da outra", async () => {
    const doInstagram = await convites.criarConvite("Dr. Marcus");
    expect(await convites.reivindicarEGravarConexao(doInstagram.id, pessoa("token-1"))).toBeNull();
    expect(await conviteNoBanco(doInstagram.id)).toMatchObject({ usado_em: null });

    const doLinkedin = await convites.criarConvite("@conta_da_ana", { rede: "linkedin", contaAlvo: CONTA });
    expect(await convites.reivindicarEGravarConta(doLinkedin.id, contaDoInstagram("ig-2"))).toBe(false);
    expect(await conviteNoBanco(doLinkedin.id)).toMatchObject({ usado_em: null });
    expect(((await sql().query(`select 1 from accounts where ig_user_id = $1`, [OUTRA])) as unknown[]).length).toBe(0);
  });
});
