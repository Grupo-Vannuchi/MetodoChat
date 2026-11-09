# A conexão do LinkedIn (parte 1 de 3) — Plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: `superpowers:subagent-driven-development`
> (recomendada) ou `superpowers:executing-plans`, fase por fase. Os passos usam caixa de
> seleção (`- [ ]`) para acompanhar.

**Objetivo:** o dono do perfil conecta o próprio LinkedIn a uma conta do painel pelo link de convite, e o administrador vê na Configuração com quem cada conta está conectada e até quando, gera o convite e desconecta. Nada é publicado nesta parte.

**Arquitetura:**
- a 024 cria a `linkedin_conexoes` (uma linha por conta do painel, com o token em texto puro, como o do Instagram) e dá ao convite a `rede` e a `conta_alvo`. O tipo da fila do LinkedIn NÃO entra aqui: ele vem na 025, na parte 2, com o ramo do dreno;
- `lib/linkedin-conexoes.ts` é o único arquivo que lê a tabela. As telas recebem só o resumo (o nome e o vencimento);
- `lib/linkedin.ts` é o cliente do LinkedIn: a autorização, a troca do código e o `userinfo`, com as bases presas sob as duas travas da `baseDoGraph`. O endereço do painel para o LinkedIn é o canônico na produção e o da branch no preview (`VERCEL_BRANCH_URL`);
- o convite do LinkedIn usa o começo de hoje (`/api/oauth/convite/[codigo]`, que passa a ler a rede) e uma volta nova (`/api/oauth/linkedin/callback`), na ordem da volta do Instagram. A conexão vai para a conta-alvo do convite, na mesma transação que o usa;
- a Configuração ganha a seção "LinkedIn das contas", e a privacidade e a exclusão de dados ganham o texto do LinkedIn.

**Stack:** a do projeto, no Next.js 16.4.3: Vitest (puros, tela e integração) e o Postgres no container para a integração.

**Spec:** `docs/specs/2026-11-06-linkedin-no-perfil.md`, na `main` desde a `d23738b` (os commits `8c2be0e`, `7ef13ea` e `9e42566`, lidos pelo Eduardo em 06/11/2026: "Li, pode seguir"), mais a emenda de 09/11, que é o primeiro commit desta branch. Leia a emenda, o §1, o §2, o §3, o §4, o §5 (o vencimento), o §7 (a Configuração e a privacidade) e o §8 antes de começar: este plano não repete o porquê, só como construir.

**As decisões de 09/11/2026, pela caixa:**
- **"Deixar assim (Recomendado)"** (14:05:01.666Z): o token de teste da sonda fica sem anular. A documentação não traz endpoint de revogação;
- **"Três partes (Recomendado)"** (14:20:47.143Z): a entrega vai em três partes, cada uma com plano, prova e PR próprios. Esta é a parte 1, a conexão.

**A auditoria (`metodochat-3e`), antes do ensaio:**
- o desenho foi aprovado;
- o achado 205: a fila do LinkedIn passa a ser a 025 nos 7 pontos do código que diziam 024 (FASE 5);
- o achado 206: o "Desconectar" não promete revogar no LinkedIn. Isso vale na tela (FASE 4), na privacidade (FASE 5) e na emenda da spec;
- as notas: o `id_token` descartado (FASE 3); a proteção da Vercel e o redirect da branch só na prova (FASE 7); as decisões do Eduardo antes da prova; a base da `linkedin_conexoes` contada pela auditoria antes e depois da 024.

**Ensaio do plano (09/11):** o código deste plano foi escrito e testado fase a fase numa cópia isolada (`git worktree`, sem push, branch local `ensaio-linkedin-conexao`, saída de `d23738b`, com `npm ci` próprio e `.env.local` vazio). Todo bloco de código abaixo foi tirado do git dessa cópia por um gerador, sem cópia à mão. Os commits do ensaio:
- FASE 1, `9f5186a` (patch-id `9385580699d5`);
- FASE 2, `79fc763` (patch-id `bf25db6ef500`);
- FASE 3, `9a7ae58` (patch-id `6f01956a2251`);
- FASE 4, `0ca7673` (patch-id `0acfd37c3f10`);
- FASE 5, `c6869e7` (patch-id `fc73c5e36887`).
As mensagens são as deste plano. Os números de RED e de GREEN de cada passo foram medidos numa segunda cópia limpa saída de `d23738b`, fazendo o caminho de quem executa: os testes primeiro, o código depois e o commit com a mesma mensagem. As cinco fases deram o mesmo patch-id do ensaio. Os registros ficam na pasta de trabalho do DEV: `el1-*.log` (o ensaio), `ml1-*.log` (o RED e o GREEN de cada fase), `mv-*.log` (o verde ampliado), `el1-verify.log`, `el1-integ.log` e `el1-mutacoes.log`.

Os números do fim, no `08217dd` (entre parênteses, os da base `d23738b`):
- lint e `tsc` limpos;
- testes puros: 150 arquivos e 3 653 casos (147 e 3 631); testes de tela: 35 arquivos e 315 casos (34 e 308);
- a varredura sem vazamento e o build com o Next 16.4.3 ("MIGRAÇÃO PULADA", fora da produção);
- a integração no container: 72 arquivos, 835 passaram e 8 pularam (68, 791 e 8);
- as 16 mutações do Apêndice A derrubaram, cada uma, o caso esperado: "16 mutações, 0 ruins; árvore no fim: limpa";
- a guarda do diff (FASE 6): 36 arquivos fora de `docs`, com 2 048 linhas a mais e 46 a menos;
- este plano, aplicado do zero numa cópia limpa do `d23738b` (cada "Crie" gravado, cada "Em ... aplique" passado ao `git apply`), deu os 36 arquivos iguais aos do ensaio: "14 criados, 24 diffs aplicados; 36 arquivos conferidos, 0 diferentes".

**O que o ensaio achou:**
- **a volta do Instagram com um convite do LinkedIn chamava a Meta.** O `where` da reivindicação já recusava gravar, mas a troca do código acontecia antes. Por isso a volta do Instagram confere a rede antes de chamar a Meta (o caso cai no RED da FASE 3, com `meta.trocas` = 1), e a reivindicação também confere a rede no SQL. O mesmo vale para a volta do LinkedIn com um convite do Instagram;
- **a primeira rodada da FASE 3 rodou só a integração**, e a rota nova derrubava dois testes puros que listam toda rota pública (`tests/sessao-nas-actions.test.ts` e `tests/acesso-nas-actions.test.ts`). As duas listas entraram na própria FASE 3, e desde então toda fase roda também os puros;
- **o título da aba da página do convite** passou a ser "Conectar sua conta", para as duas redes: ele é fixo, e a rede só se sabe depois de ler o convite. O cartão diz a rede;
- **a página do convite do LinkedIn que já não vale é a mesma de todo link que não vale**, como no Instagram: ela não diz qual é o caso.

## Restrições globais

- **Branch:** `linkedin-conexao`, saída do `d23738b` (a `main` de hoje), sem upstream. O primeiro commit é a emenda da spec, e o segundo é este plano. Nunca commitar nem empurrar na `main`: ela não está protegida, e um push nela dispara o deploy na Vercel. Conferir `git branch --show-current` antes de cada commit.
- **`git add` com caminho explícito.** Nunca `-A` nem `.`.
- **Commit no estilo do Vinícius:** uma frase dizendo o efeito, sem prefixo, sem rodapé de IA. Autor: Eduardo Kobal <162614913+Eduardokobal@users.noreply.github.com>.
- **Antes de cada commit**, varrer os arquivos tocados atrás de caractere de controle e de fim de linha misturado.
- **O commit é um comando à parte**, depois de ler a saída dos testes.
- **Fim de linha:** os diffs deste plano estão em LF. Aplique com `git apply --ignore-whitespace`, ou numa cópia feita com `git -c core.autocrlf=false`.
- **Os arquivos desta parte são os 36 do mapa abaixo, e mais nenhum.**
- **A única escrita em produção é a 024, aplicada à mão na FASE 7**, com o OK do Eduardo pela caixa, a hora mandada à auditoria antes e o "pode" dela. Fora isso, só o merge do Eduardo e o deploy que ele dispara.
- **Uma rodada de integração de cada vez**, sempre com `DATABASE_URL_TESTES` apontando para o container (`127.0.0.1:5434`). Toda rodada tem de imprimir `[rede-global] ALVO: banco de TESTE`. Nunca rode com a variável vazia: ela cai na `DATABASE_URL`, que é **produção**. Se o container estiver parado: `docker start metodochat-banco-de-teste`.
- **`next build` sem as variáveis de agente:** `env -u CLAUDECODE -u AI_AGENT ...`, e `git diff AGENTS.md` depois.
- **As chaves do LinkedIn** (`LINKEDIN_CLIENT_ID` e `LINKEDIN_CLIENT_SECRET`) já estão na Vercel, Sensitive, em production e preview, desde 06/11 (17:58:22Z e 17:58:43Z, medido pela auditoria). Elas nunca entram no código, no banco, no chat nem em registro. Os testes usam valores inventados.

## Mapa dos arquivos

| Arquivo | O que faz | Fase |
|---|---|---|
| `migrations/024-linkedin-conexoes.sql` (novo) | a `linkedin_conexoes`; a `rede` e a `conta_alvo` do convite | 1 |
| `lib/linkedin-conexoes.ts` (novo) | o único que lê a tabela: a conexão inteira, o resumo, gravar e apagar | 1 |
| `lib/convites-repositorio.ts` | o convite com a rede; a reivindicação do LinkedIn; a do Instagram só para o convite do Instagram | 1 |
| `lib/convites.ts` | o tipo `Rede` (1); as frases por rede (3); a rede na linha da lista (4) | 1, 3, 4 |
| `lib/esquema.ts` | a 024 em `naoObservaveis`, como FEATURE | 1 |
| `testes-integracao/linkedin-tabela.integracao.ts` (novo) | a 024 e os dois repositórios | 1 |
| `testes-integracao/convites-tabela.integracao.ts` | as duas colunas novas na lista das colunas | 1 |
| `lib/linkedin.ts` (novo) | as bases, as chaves, o endereço do painel, a autorização, a troca e o `userinfo` | 2 |
| `lib/linkedin-publicacao.ts` (novo) | o vencimento (a parte 2 acrescenta as outras decisões puras) | 2 |
| `tests/linkedin.test.ts` (novo) | o que é puro no cliente do LinkedIn | 2 |
| `tests/linkedin-publicacao.test.ts` (novo) | o vencimento | 2 |
| `app/api/oauth/convite/[codigo]/route.ts` | o começo lê a rede e manda o convite do LinkedIn ao LinkedIn | 3 |
| `app/api/oauth/linkedin/callback/route.ts` (novo) | a volta do LinkedIn | 3 |
| `app/api/oauth/callback/convite.ts` | a volta do Instagram só aceita o convite do Instagram | 3 |
| `app/convite/cartao.tsx` | o título por rede | 3 |
| `app/convite/[codigo]/page.tsx` | os passos do LinkedIn; o título da aba neutro | 3 |
| `app/convite/pronto/page.tsx` e `app/convite/erro/page.tsx` | leem `?rede=linkedin` | 3 |
| `testes-integracao/linkedin-convite.integracao.ts` (novo) | o começo e a volta, contra um LinkedIn falso no loopback | 3 |
| `testes-integracao/convite-paginas.integracao.ts` e `testes-integracao/convite-volta.integracao.ts` | as páginas do LinkedIn; o convite do LinkedIn na volta do Instagram | 3 |
| `tests/sessao-nas-actions.test.ts` e `tests/acesso-nas-actions.test.ts` | a rota nova nas listas das rotas públicas | 3 |
| `app/setup/actions.ts` | `gerarConviteDoLinkedin` e `desconectarLinkedin`, só do administrador | 4 |
| `app/setup/linkedin-das-contas.tsx` (novo) | a seção "LinkedIn das contas", de cliente, sem token | 4 |
| `app/setup/page.tsx` | lê os resumos e desenha a seção | 4 |
| `tests/linkedin-token-fora-do-cliente.test.ts` (novo) | a guarda: o token nunca vai ao navegador | 4 |
| `tests/convites.test.ts` | a rede na linha da lista | 4 |
| `testes-dom/linkedin-no-setup.dom.tsx` (novo) | a seção, os quatro estados e o "Desconectar" do achado 206 | 4 |
| `testes-integracao/linkedin-acoes.integracao.ts` (novo) | as duas ações, com o administrador | 4 |
| `testes-integracao/contas-por-login.integracao.ts` | o login comum não chega às duas ações | 4 |
| `app/privacidade/page.tsx` e `app/exclusao-de-dados/page.tsx` | o texto do LinkedIn, com o achado 206 | 5 |
| `testes-integracao/privacidade-linkedin.integracao.ts` (novo) | as duas páginas, desenhadas | 5 |
| `scripts/migrar.mjs` e `testes-integracao/conferencia-do-kind.integracao.ts` | a fila do LinkedIn passa a ser a 025 (achado 205); as definições não mudam | 5 |

O que fica de fora, e por quê:
- **o tipo `publicacao_linkedin`, a versão `202610`, o `/rest` e tudo o que publica**: são da parte 2 (só texto e imagem) e da parte 3 (o carrossel em PDF e o vídeo);
- **a renovação automática**: o LinkedIn só dá refresh token a parceiros aprovados. Renovar é mandar um convite novo;
- **revogar a autorização no LinkedIn**: a documentação não traz endpoint para isso (achado 206). O "Desconectar" apaga a cópia do painel, e a tela diz isso;
- **o README**: a instalação do zero é outro trabalho.

---

### FASE 0 — Começar da branch certa

- [ ] **Passo 1: a branch**

A branch `linkedin-conexao` já existe, com dois commits só de `docs` sobre o `d23738b`: a emenda da spec e este plano. A execução continua nela.

```bash
git fetch origin
git rev-parse --short origin/main                 # tem de dar d23738b
git branch --show-current                          # linkedin-conexao
git log --oneline d23738b..HEAD                    # os dois commits de docs
git diff --name-only d23738b HEAD                  # só a spec e este plano
git status --porcelain                             # vazio
npm ci
```

Se `origin/main` não estiver em `d23738b`, pare: a base mudou, e o plano precisa ser conferido de novo.

---

### FASE 1 — A 024 e os repositórios

**Arquivos:** `migrations/024-linkedin-conexoes.sql` (novo), `lib/linkedin-conexoes.ts` (novo), `lib/convites-repositorio.ts`, `lib/convites.ts`, `lib/esquema.ts`, `testes-integracao/linkedin-tabela.integracao.ts` (novo), `testes-integracao/convites-tabela.integracao.ts`.

- [ ] **Passo 1: os testes**

Crie `testes-integracao/linkedin-tabela.integracao.ts`:

```ts
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
```

Em `testes-integracao/convites-tabela.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/convites-tabela.integracao.ts b/testes-integracao/convites-tabela.integracao.ts
index 917aa3d..aa38df7 100644
--- a/testes-integracao/convites-tabela.integracao.ts
+++ b/testes-integracao/convites-tabela.integracao.ts
@@ -24,6 +24,10 @@ const COLUNAS = [
   "conta_conectada",
   "ultimo_erro",
   "ultimo_erro_em",
+  // A 024 (a conexão do LinkedIn, docs/specs/2026-11-06-linkedin-no-perfil.md, §1): a rede do convite e a
+  // conta do painel que ganha o LinkedIn. testes-integracao/linkedin-tabela.integracao.ts confere as regras.
+  "rede",
+  "conta_alvo",
 ];
 
 const CONTA = "17800000000021001";
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" \
  npx vitest run --config vitest.integracao.config.ts \
  testes-integracao/linkedin-tabela.integracao.ts testes-integracao/convites-tabela.integracao.ts
```

Esperado: `[rede-global] ALVO: banco de TESTE`, e "Tests 14 failed | 10 passed (24)":
- os 13 casos do arquivo novo caem, porque ele não acha `@/lib/linkedin-conexoes`;
- "nasce da 021 com as colunas que o código lê, e com o RLS ligado" cai: a lista tem as duas colunas novas, e o banco ainda não.

- [ ] **Passo 3: o código**

Crie `migrations/024-linkedin-conexoes.sql`:

```sql
-- A CONEXÃO DO LINKEDIN (docs/specs/2026-11-06-linkedin-no-perfil.md, §1 e §2; a parte 1 de 3 da entrega
-- do LinkedIn, a conexão): o LinkedIn pessoal de uma conta do painel, conectado pelo link de convite.
--
-- `linkedin_conexoes`: uma linha por conta do painel, com a pessoa do LinkedIn (o `sub` do OpenID Connect),
-- o nome dela para a tela, a autorização e o vencimento (60 dias, sem renovação automática). O token fica em
-- texto puro, como o do Instagram em `accounts`, e protegido do mesmo jeito. A linha sai junto com a conta.
-- Quem lê a tabela é só lib/linkedin-conexoes.ts.
--
-- O CONVITE GANHA A REDE E A CONTA-ALVO: o convite do LinkedIn liga o LinkedIn a uma conta que já existe no
-- painel, e o do Instagram cria a conta. As linhas de hoje ficam `instagram` e sem conta-alvo, e passam no
-- check. O convite do LinkedIn sai junto com a conta-alvo.
--
-- O TIPO DA FILA DO LINKEDIN (`publicacao_linkedin`) NÃO ENTRA AQUI: ele vem na 025, na parte 2, junto com o
-- ramo do dreno que sabe drenar a linha (tests/fila-tipos.test.ts prende a lista do dreno à última migração
-- que escreve o `queue_kind_check`).
--
-- TABELA E COLUNAS DE FEATURE, como a 021: entram em `naoObservaveis` de lib/esquema.ts, e quem as confere é
-- testes-integracao/linkedin-tabela.integracao.ts.
--
-- O RLS É LIGADO AQUI, como na 021, na 022 e na 023. A permissão da API pública não precisa de linha: os
-- privilégios padrão da 020 já fazem a tabela nascer sem nada para `anon` e `authenticated`.
--
-- IDEMPOTENTE, como toda migração desta pasta: `if not exists` na tabela e nas colunas, o check da conta-alvo
-- apagado e escrito de novo, e ligar o RLS de novo não muda nada.

create table if not exists linkedin_conexoes (
  account_id text primary key
    constraint linkedin_conexoes_account_id_fkey references accounts (ig_user_id) on delete cascade,
  pessoa_id text not null,
  nome text not null,
  access_token text not null,
  expira_em timestamptz not null,
  conectado_em timestamptz not null default now()
);
alter table linkedin_conexoes enable row level security;

alter table convites_de_conexao
  add column if not exists rede text not null default 'instagram'
    constraint convites_de_conexao_rede_check check (rede in ('instagram', 'linkedin'));
alter table convites_de_conexao
  add column if not exists conta_alvo text
    constraint convites_de_conexao_conta_alvo_fkey references accounts (ig_user_id) on delete cascade;
alter table convites_de_conexao drop constraint if exists convites_de_conexao_alvo_check;
alter table convites_de_conexao
  add constraint convites_de_conexao_alvo_check check ((rede = 'linkedin') = (conta_alvo is not null));
```

Crie `lib/linkedin-conexoes.ts`:

```ts
import "server-only";
import { sql } from "./db";

// O LINKEDIN DE CADA CONTA DO PAINEL NO BANCO (a 024, docs/specs/2026-11-06-linkedin-no-perfil.md, §2). ESTE É
// O ÚNICO ARQUIVO QUE LÊ A `linkedin_conexoes`.
//
// O TOKEN NUNCA VAI AO NAVEGADOR: só `conexaoDaConta` devolve a linha inteira, e ela é do servidor (a volta do
// convite e, na parte 2, o dreno). As telas recebem só o resumo, o nome e o vencimento. tests/linkedin-token-
// fora-do-cliente.test.ts prende que nenhum componente de cliente importa este arquivo.

/** A conexão inteira, com a autorização. Só para o servidor. */
export type ConexaoDoLinkedin = {
  account_id: string;
  pessoa_id: string;
  nome: string;
  access_token: string;
  expira_em: Date;
  conectado_em: Date;
};

/** O que as telas podem ver: o nome da pessoa no LinkedIn e o vencimento. */
export type ResumoDaConexao = { nome: string; expira_em: Date };

/** O que a volta do convite grava. O `conectado_em` é o relógio do banco. */
export type NovaConexao = Omit<ConexaoDoLinkedin, "conectado_em">;

/** Quem grava: o `sql()` de sempre, ou a transação do convite (lib/convites-repositorio.ts). */
type Executor = Pick<ReturnType<typeof sql>, "query">;

export async function conexaoDaConta(accountId: string): Promise<ConexaoDoLinkedin | null> {
  const [linha] = (await sql().query(
    `select account_id, pessoa_id, nome, access_token, expira_em, conectado_em
       from linkedin_conexoes where account_id = $1`,
    [accountId]
  )) as ConexaoDoLinkedin[];
  return linha ?? null;
}

export async function resumoDaConexao(accountId: string): Promise<ResumoDaConexao | null> {
  const [linha] = (await sql().query(`select nome, expira_em from linkedin_conexoes where account_id = $1`, [
    accountId,
  ])) as ResumoDaConexao[];
  return linha ?? null;
}

/** Os resumos de todas as contas, pela conta. Para a Configuração, que é só do administrador. */
export async function resumosDasConexoes(): Promise<Map<string, ResumoDaConexao>> {
  const linhas = (await sql().query(`select account_id, nome, expira_em from linkedin_conexoes`)) as (ResumoDaConexao & {
    account_id: string;
  })[];
  return new Map(linhas.map(({ account_id, nome, expira_em }) => [account_id, { nome, expira_em }]));
}

/**
 * Grava a conexão da conta. Uma conta tem um LinkedIn só: gravar de novo troca a pessoa, o nome, a
 * autorização e o vencimento (a reconexão, inclusive com outra pessoa).
 */
export async function gravarConexao(c: NovaConexao, executor: Executor = sql()): Promise<void> {
  await executor.query(
    `insert into linkedin_conexoes (account_id, pessoa_id, nome, access_token, expira_em)
     values ($1, $2, $3, $4, $5)
     on conflict (account_id) do update set
       pessoa_id = excluded.pessoa_id,
       nome = excluded.nome,
       access_token = excluded.access_token,
       expira_em = excluded.expira_em,
       conectado_em = now()`,
    [c.account_id, c.pessoa_id, c.nome, c.access_token, c.expira_em.toISOString()]
  );
}

/** O "Desconectar" da Configuração. Devolve se apagou. */
export async function apagarConexao(accountId: string): Promise<boolean> {
  const linhas = await sql().query(`delete from linkedin_conexoes where account_id = $1 returning account_id`, [accountId]);
  return linhas.length > 0;
}
```

Em `lib/convites-repositorio.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/convites-repositorio.ts b/lib/convites-repositorio.ts
index bcefdea..7ba74a6 100644
--- a/lib/convites-repositorio.ts
+++ b/lib/convites-repositorio.ts
@@ -1,6 +1,7 @@
 import "server-only";
 import { sql, upsertAccount } from "./db";
-import { VALIDADE_DO_CONVITE_DIAS, codigoBemFormado, hashDoCodigo, novoCodigoDeConvite } from "./convites";
+import { VALIDADE_DO_CONVITE_DIAS, codigoBemFormado, hashDoCodigo, novoCodigoDeConvite, type Rede } from "./convites";
+import { gravarConexao, type NovaConexao } from "./linkedin-conexoes";
 
 // OS CONVITES DE CONEXÃO NO BANCO (a 021, docs/specs/2026-11-03-link-de-convite.md). O relógio é o do
 // banco, como no resto deste projeto: o prazo nasce de `now()`, e a reivindicação confere `expira_em >
@@ -17,10 +18,13 @@ export type Convite = {
   conta_conectada: string | null;
   ultimo_erro: string | null;
   ultimo_erro_em: Date | null;
+  /** A 024: o convite do LinkedIn liga o LinkedIn a uma conta do painel que já existe, a conta-alvo. */
+  rede: Rede;
+  conta_alvo: string | null;
 };
 
 const COLUNAS =
-  "id, para_quem, criado_em, expira_em, cancelado_em, usado_em, conta_conectada, ultimo_erro, ultimo_erro_em";
+  "id, para_quem, criado_em, expira_em, cancelado_em, usado_em, conta_conectada, ultimo_erro, ultimo_erro_em, rede, conta_alvo";
 const COLUNAS_DA_LISTA = COLUNAS.split(", ")
   .map((coluna) => `c.${coluna}`)
   .join(", ");
@@ -28,14 +32,20 @@ const COLUNAS_DA_LISTA = COLUNAS.split(", ")
 // O id chega da volta do Instagram num cookie, e um valor torto não pode virar erro de banco.
 const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 
-/** Grava o hash de um código novo e devolve o código, que só existe nesta resposta. */
-export async function criarConvite(paraQuem: string): Promise<{ id: string; codigo: string }> {
+/**
+ * Grava o hash de um código novo e devolve o código, que só existe nesta resposta. Sem o alvo, é o convite
+ * do Instagram de sempre; com ele, o do LinkedIn da conta-alvo (a 024).
+ */
+export async function criarConvite(
+  paraQuem: string,
+  alvo?: { rede: "linkedin"; contaAlvo: string }
+): Promise<{ id: string; codigo: string }> {
   const codigo = novoCodigoDeConvite();
   const [linha] = (await sql().query(
-    `insert into convites_de_conexao (codigo_hash, para_quem, expira_em)
-     values ($1, $2, now() + make_interval(days => $3))
+    `insert into convites_de_conexao (codigo_hash, para_quem, expira_em, rede, conta_alvo)
+     values ($1, $2, now() + make_interval(days => $3), $4, $5)
      returning id`,
-    [hashDoCodigo(codigo), paraQuem, VALIDADE_DO_CONVITE_DIAS]
+    [hashDoCodigo(codigo), paraQuem, VALIDADE_DO_CONVITE_DIAS, alvo?.rede ?? "instagram", alvo?.contaAlvo ?? null]
   )) as { id: string }[];
   return { id: linha.id, codigo };
 }
@@ -98,13 +108,16 @@ export async function anotarErroDoConvite(id: string, texto: string, estado: "pe
  * O USO DO CONVITE E A CONTA, NA MESMA TRANSAÇÃO. A reivindicação só volta a linha se o convite ainda
  * estiver pendente; sem ela, a conta não é gravada. Se a conta falhar ao gravar, a transação desfaz a
  * reivindicação, e o convite continua valendo. Devolve se conectou.
+ *
+ * SÓ O CONVITE DO INSTAGRAM (a 024): o do LinkedIn grava os mesmos cookies, e sem a rede no `where` ele
+ * serviria para pôr um Instagram qualquer no painel pela volta do Instagram.
  */
 export async function reivindicarEGravarConta(id: string, conta: Parameters<typeof upsertAccount>[0]): Promise<boolean> {
   if (!UUID.test(id)) return false;
   return sql().begin(async (tx) => {
     const reivindicado = await tx.query(
       `update convites_de_conexao set usado_em = now(), conta_conectada = $2
-        where id = $1 and usado_em is null and cancelado_em is null and expira_em > now()
+        where id = $1 and rede = 'instagram' and usado_em is null and cancelado_em is null and expira_em > now()
         returning id`,
       [id, conta.ig_user_id]
     );
@@ -113,3 +126,27 @@ export async function reivindicarEGravarConta(id: string, conta: Parameters<type
     return true;
   });
 }
+
+/**
+ * O USO DO CONVITE DO LINKEDIN E A CONEXÃO, NA MESMA TRANSAÇÃO (docs/specs/2026-11-06-linkedin-no-perfil.md,
+ * §3). A CONTA VEM DO CONVITE, e não de quem chama: a conexão vai para a `conta_alvo` que o administrador
+ * escolheu ao gerar o link. Só o convite do LinkedIn, e só o pendente. Se a conexão falhar ao gravar, a
+ * transação desfaz a reivindicação. Devolve a conta conectada, ou null.
+ */
+export async function reivindicarEGravarConexao(
+  id: string,
+  pessoa: Omit<NovaConexao, "account_id">
+): Promise<string | null> {
+  if (!UUID.test(id)) return null;
+  return sql().begin(async (tx) => {
+    const [reivindicado] = (await tx.query(
+      `update convites_de_conexao set usado_em = now(), conta_conectada = conta_alvo
+        where id = $1 and rede = 'linkedin' and usado_em is null and cancelado_em is null and expira_em > now()
+        returning conta_alvo`,
+      [id]
+    )) as { conta_alvo: string }[];
+    if (!reivindicado) return null;
+    await gravarConexao({ account_id: reivindicado.conta_alvo, ...pessoa }, tx);
+    return reivindicado.conta_alvo;
+  });
+}
```

Em `lib/convites.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/convites.ts b/lib/convites.ts
index 89654cc..103f8bd 100644
--- a/lib/convites.ts
+++ b/lib/convites.ts
@@ -30,6 +30,10 @@ export function hashDoCodigo(codigo: string): string {
 
 export type EstadoDoConvite = "pendente" | "usado" | "vencido" | "cancelado";
 
+// A REDE DO CONVITE (a 024, docs/specs/2026-11-06-linkedin-no-perfil.md, §1): o do Instagram cria a conta do
+// painel; o do LinkedIn liga o LinkedIn a uma conta que já existe, a conta-alvo.
+export type Rede = "instagram" | "linkedin";
+
 type DatasDoConvite = {
   cancelado_em: Date | string | null;
   usado_em: Date | string | null;
```

Em `lib/esquema.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/esquema.ts b/lib/esquema.ts
index 7f238ee..34259ce 100644
--- a/lib/esquema.ts
+++ b/lib/esquema.ts
@@ -298,6 +298,15 @@ const MARCA_DAGUA = {
       porque:
         "tabela de FEATURE (convites_de_conexao): a partida do painel não depende dela, de propósito",
     },
+    {
+      de: "024-linkedin-conexoes.sql",
+      // A QUINTA TABELA DE FEATURE, pelo mesmo motivo da 021: `linkedin_conexoes` e as colunas `rede` e
+      // `conta_alvo` do convite são do LinkedIn (docs/specs/2026-11-06-linkedin-no-perfil.md, §1), que só ele
+      // lê, e não podem impedir o painel inteiro de subir. Quem as confere é
+      // testes-integracao/linkedin-tabela.integracao.ts.
+      porque:
+        "tabela e colunas de FEATURE (linkedin_conexoes; convites_de_conexao.rede e conta_alvo): a partida do painel não depende delas, de propósito",
+    },
   ],
   // AS TABELAS QUE NASCEM DEPOIS DA BASE E QUE A PARTIDA EXIGE. A primeira é a dos logins (a 022,
   // docs/specs/2026-11-04-logins.md): ao contrário das tabelas de feature de `naoObservaveis`, sem
```

- [ ] **Passo 4: rodar e ver passar**

```bash
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" \
  npx vitest run --config vitest.integracao.config.ts \
  testes-integracao/linkedin-tabela.integracao.ts testes-integracao/convites-tabela.integracao.ts \
  testes-integracao/esquema-de-partida.integracao.ts testes-integracao/rls-nas-tabelas.integracao.ts \
  testes-integracao/sem-permissao-publica.integracao.ts testes-integracao/convite.integracao.ts \
  testes-integracao/convite-volta.integracao.ts
npx tsc --noEmit
npx eslint lib/linkedin-conexoes.ts lib/convites-repositorio.ts lib/convites.ts lib/esquema.ts \
  testes-integracao/linkedin-tabela.integracao.ts testes-integracao/convites-tabela.integracao.ts
```

Esperado: `ALVO: banco de TESTE`, "Test Files 7 passed (7)" e "Tests 56 passed (56)", e o `tsc` e o lint sem saída. A conferência de partida, o RLS e as permissões já cobrem a tabela nova sozinhos: os testes deles procuram toda tabela do schema.

- [ ] **Passo 5: o commit**

A mensagem do commit, gravada em `$SCRATCH/msg-li1-f1.txt`:

```text
O LinkedIn de cada conta ganha a tabela própria, e o convite ganha a rede e a conta-alvo
```

```bash
git add -- migrations/024-linkedin-conexoes.sql lib/linkedin-conexoes.ts lib/convites-repositorio.ts lib/convites.ts \
  lib/esquema.ts testes-integracao/linkedin-tabela.integracao.ts testes-integracao/convites-tabela.integracao.ts
git commit -F "$SCRATCH/msg-li1-f1.txt"
```

---

### FASE 2 — O cliente do LinkedIn e o vencimento

**Arquivos:** `lib/linkedin.ts` (novo), `lib/linkedin-publicacao.ts` (novo), `tests/linkedin.test.ts` (novo), `tests/linkedin-publicacao.test.ts` (novo).

- [ ] **Passo 1: os testes**

Crie `tests/linkedin.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  baseDoPainelParaOLinkedin,
  basesDoLinkedin,
  credenciaisDoLinkedin,
  ESCOPO_DO_LINKEDIN,
  temPermissaoDePublicar,
  urlDeAutorizacaoDoLinkedin,
} from "@/lib/linkedin";

// O CLIENTE DO LINKEDIN, NO QUE É PURO (docs/specs/2026-11-06-linkedin-no-perfil.md, §3 e §4; a parte 1, a
// conexão). As chamadas de rede (a troca do código e o userinfo) são provadas contra um LinkedIn falso no
// loopback, em testes-integracao/linkedin-convite.integracao.ts.

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("a autorização no LinkedIn", () => {
  it("vai a www.linkedin.com com o código pedido, o client_id, a volta, o state e o escopo fixo", () => {
    const url = new URL(urlDeAutorizacaoDoLinkedin("id-do-app", "https://painel.exemplo.com.br/api/oauth/linkedin/callback", "e".repeat(64)));
    expect(url.origin).toBe("https://www.linkedin.com");
    expect(url.pathname).toBe("/oauth/v2/authorization");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: "code",
      client_id: "id-do-app",
      redirect_uri: "https://painel.exemplo.com.br/api/oauth/linkedin/callback",
      state: "e".repeat(64),
      scope: "openid profile w_member_social",
    });
  });

  it("o escopo é um só para todo convite: um escopo diferente invalidaria a autorização de antes", () => {
    expect(ESCOPO_DO_LINKEDIN).toBe("openid profile w_member_social");
  });
});

describe("a permissão de publicar, no scope que o LinkedIn devolve", () => {
  it("aceita a vírgula (medida na troca de 09/11) e o espaço (o da documentação)", () => {
    expect(temPermissaoDePublicar("openid,profile,w_member_social")).toBe(true);
    expect(temPermissaoDePublicar("openid profile w_member_social")).toBe(true);
    expect(temPermissaoDePublicar("w_member_social")).toBe(true);
  });

  it("recusa o scope sem ela, com um nome parecido, vazio ou que não é texto", () => {
    expect(temPermissaoDePublicar("openid,profile")).toBe(false);
    expect(temPermissaoDePublicar("openid,profile,w_member_socialx")).toBe(false);
    expect(temPermissaoDePublicar("")).toBe(false);
    expect(temPermissaoDePublicar(undefined)).toBe(false);
    expect(temPermissaoDePublicar(["w_member_social"])).toBe(false);
  });
});

describe("o endereço do painel para o LinkedIn (o link do convite e a volta)", () => {
  const CANONICA = "https://metodochat.vercel.app";

  it("na produção e no computador é o canônico", () => {
    expect(baseDoPainelParaOLinkedin({ vercelEnv: "production", urlDaBranch: "x-git-y.vercel.app" }, CANONICA)).toBe(CANONICA);
    expect(baseDoPainelParaOLinkedin({ vercelEnv: "development", urlDaBranch: "x-git-y.vercel.app" }, CANONICA)).toBe(CANONICA);
    expect(baseDoPainelParaOLinkedin({}, CANONICA)).toBe(CANONICA);
  });

  it("no preview é o endereço da branch, que não muda a cada deploy e é o cadastrado no app para a prova", () => {
    expect(
      baseDoPainelParaOLinkedin({ vercelEnv: "preview", urlDaBranch: "metodochat-git-linkedin-conexao-time.vercel.app" }, CANONICA)
    ).toBe("https://metodochat-git-linkedin-conexao-time.vercel.app");
  });

  it("no preview sem o endereço da branch, cai no canônico", () => {
    expect(baseDoPainelParaOLinkedin({ vercelEnv: "preview" }, CANONICA)).toBe(CANONICA);
    expect(baseDoPainelParaOLinkedin({ vercelEnv: "preview", urlDaBranch: "" }, CANONICA)).toBe(CANONICA);
  });
});

describe("as chaves do app do LinkedIn", () => {
  it("vêm das duas variáveis, sem espaço em volta", () => {
    vi.stubEnv("LINKEDIN_CLIENT_ID", " id-do-app ");
    vi.stubEnv("LINKEDIN_CLIENT_SECRET", "segredo-de-teste");
    expect(credenciaisDoLinkedin()).toEqual({ clientId: "id-do-app", clientSecret: "segredo-de-teste" });
  });

  it("sem uma das duas, não há chave nenhuma", () => {
    vi.stubEnv("LINKEDIN_CLIENT_ID", "id-do-app");
    vi.stubEnv("LINKEDIN_CLIENT_SECRET", "  ");
    expect(credenciaisDoLinkedin()).toBeNull();
    vi.stubEnv("LINKEDIN_CLIENT_ID", "");
    vi.stubEnv("LINKEDIN_CLIENT_SECRET", "segredo-de-teste");
    expect(credenciaisDoLinkedin()).toBeNull();
  });
});

describe("as bases das chamadas ao LinkedIn só se movem sob as duas travas", () => {
  it("sem a variável, são as de verdade", () => {
    vi.stubEnv("LINKEDIN_API_BASE", "");
    expect(basesDoLinkedin()).toEqual({ oauth: "https://www.linkedin.com", api: "https://api.linkedin.com" });
  });

  it("com o vitest e o loopback, as duas vão juntas para o servidor falso", () => {
    vi.stubEnv("LINKEDIN_API_BASE", "http://127.0.0.1:4567");
    expect(basesDoLinkedin()).toEqual({ oauth: "http://127.0.0.1:4567", api: "http://127.0.0.1:4567" });
  });

  it("fora do loopback, ou fora do vitest, a variável é ignorada", () => {
    vi.stubEnv("LINKEDIN_API_BASE", "https://outro.exemplo.com");
    expect(basesDoLinkedin().api).toBe("https://api.linkedin.com");
    vi.stubEnv("LINKEDIN_API_BASE", "http://127.0.0.1:4567");
    vi.stubEnv("VITEST", "");
    expect(basesDoLinkedin()).toEqual({ oauth: "https://www.linkedin.com", api: "https://api.linkedin.com" });
  });
});
```

Crie `tests/linkedin-publicacao.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { AVISO_DO_VENCIMENTO_DIAS, vencimentoDoLinkedin } from "@/lib/linkedin-publicacao";

// O VENCIMENTO DA AUTORIZAÇÃO DO LINKEDIN (docs/specs/2026-11-06-linkedin-no-perfil.md, §5): 60 dias, sem
// renovação automática. "Vence em N dias", o aviso a partir de 7 dias e o vencido saem desta função só, para a
// Configuração (parte 1) e, na parte 2, para a tela de publicar e o dreno.

const AGORA = Date.parse("2026-11-09T12:00:00Z");
const DIA = 86_400_000;

describe("o vencimento do LinkedIn", () => {
  it("o aviso começa a 7 dias", () => {
    expect(AVISO_DO_VENCIMENTO_DIAS).toBe(7);
  });

  it("longe do fim, diz os dias que faltam, sem aviso", () => {
    expect(vencimentoDoLinkedin(new Date(AGORA + 60 * DIA), AGORA)).toEqual({ estado: "valido", dias: 60, frase: "vence em 60 dias" });
    expect(vencimentoDoLinkedin(new Date(AGORA + 8 * DIA), AGORA)).toEqual({ estado: "valido", dias: 8, frase: "vence em 8 dias" });
  });

  it("a 7 dias ou menos, avisa; um pedaço de dia conta como um dia inteiro", () => {
    expect(vencimentoDoLinkedin(new Date(AGORA + 7 * DIA), AGORA)).toEqual({ estado: "perto", dias: 7, frase: "vence em 7 dias" });
    expect(vencimentoDoLinkedin(new Date(AGORA + 7 * DIA + 1), AGORA).estado).toBe("valido");
    expect(vencimentoDoLinkedin(new Date(AGORA + 3 * 3_600_000), AGORA)).toEqual({ estado: "perto", dias: 1, frase: "vence em 1 dia" });
  });

  it("no próprio instante, e depois, venceu", () => {
    expect(vencimentoDoLinkedin(new Date(AGORA), AGORA)).toEqual({ estado: "vencido", dias: 0, frase: "venceu" });
    expect(vencimentoDoLinkedin(new Date(AGORA - DIA), AGORA)).toEqual({ estado: "vencido", dias: 0, frase: "venceu" });
  });

  it("aceita a data como texto, como ela chega de um componente de cliente", () => {
    expect(vencimentoDoLinkedin(new Date(AGORA + 30 * DIA).toISOString(), AGORA).dias).toBe(30);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
env -u CLAUDECODE -u AI_AGENT npx vitest run tests/linkedin.test.ts tests/linkedin-publicacao.test.ts
```

Esperado: os dois arquivos falham antes dos casos, com `Cannot find package '@/lib/linkedin'` e `Cannot find package '@/lib/linkedin-publicacao'` ("Test Files 2 failed (2)", "Tests no tests").

- [ ] **Passo 3: o código**

Crie `lib/linkedin.ts`:

```ts
import "server-only";

// O CLIENTE DO LINKEDIN (docs/specs/2026-11-06-linkedin-no-perfil.md, §3 e §4). NA PARTE 1 (a conexão), só o
// que o convite usa: a autorização, a troca do código pela autorização e o `userinfo`. A versão
// (`Linkedin-Version`) e as chamadas de `/rest` (a reserva, o envio e o post) vêm na parte 2, que publica.
//
// AS CHAVES DO APP (`LINKEDIN_CLIENT_ID` e `LINKEDIN_CLIENT_SECRET`) FICAM SÓ NAS VARIÁVEIS DA VERCEL, nunca no
// código nem no banco, porque o repositório é público (§8). Sem as duas, o LinkedIn fica desligado no painel.

const OAUTH = "https://www.linkedin.com";
const API = "https://api.linkedin.com";

/** O escopo de todo convite. Um escopo diferente invalidaria a autorização de antes (a documentação, §3). */
export const ESCOPO_DO_LINKEDIN = "openid profile w_member_social";

/** O caminho da volta do LinkedIn no painel (app/api/oauth/linkedin/callback/route.ts). */
export const CAMINHO_DA_VOLTA_DO_LINKEDIN = "/api/oauth/linkedin/callback";

/** O teto de tempo de cada chamada ao LinkedIn, como o da Graph (lib/ig.ts): para ela terminar algum dia. */
export const TETO_DO_LINKEDIN_MS = 10_000;

// AS BASES SÓ SE MOVEM NOS TESTES, sob as mesmas duas travas da `baseDoGraph` (lib/ig.ts): `VITEST=true`, que
// `next build` e a Vercel não definem, e o loopback, e só ele (a autorização viaja nestas chamadas, e uma base
// apontando para fora seria vazar a autorização por variável de ambiente). As duas bases vão juntas para o
// mesmo servidor falso. tests/linkedin.test.ts confere as duas travas.
const BASE_DE_TESTE = /^http:\/\/(?:127\.0\.0\.1|localhost|\[::1\]):\d{2,5}$/;

export function basesDoLinkedin(): { oauth: string; api: string } {
  const pedida = process.env.LINKEDIN_API_BASE;
  if (pedida && process.env.VITEST === "true" && BASE_DE_TESTE.test(pedida)) return { oauth: pedida, api: pedida };
  return { oauth: OAUTH, api: API };
}

/** As chaves do app, das variáveis da Vercel; sem uma das duas, nenhuma. */
export function credenciaisDoLinkedin(): { clientId: string; clientSecret: string } | null {
  const clientId = (process.env.LINKEDIN_CLIENT_ID ?? "").trim();
  const clientSecret = (process.env.LINKEDIN_CLIENT_SECRET ?? "").trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/**
 * O ENDEREÇO DO PAINEL PARA O LINKEDIN: a base do link do convite do LinkedIn e do `redirect_uri` do começo e
 * da volta (§3, medido no plano da parte 1).
 *
 * NA PRODUÇÃO, o canônico, o cadastrado no app do LinkedIn. NO PREVIEW, o endereço da branch
 * (`VERCEL_BRANCH_URL`, "Available at both build and runtime", sem o `https://`, na documentação da Vercel):
 * ele não muda a cada deploy da branch, e é o que o Eduardo cadastra no app só para a prova. Assim o link, o
 * começo, os cookies e a volta ficam todos no mesmo endereço, e o cookie do `state` volta junto (achado 136).
 * O convite do Instagram não passa por aqui.
 */
export function baseDoPainelParaOLinkedin(ambiente: { vercelEnv?: string; urlDaBranch?: string }, canonica: string): string {
  const branch = (ambiente.urlDaBranch ?? "").trim().replace(/\/+$/, "");
  if (ambiente.vercelEnv === "preview" && branch) return /^https?:\/\//i.test(branch) ? branch : `https://${branch}`;
  return canonica;
}

/** O ambiente da Vercel, lido do processo, para `baseDoPainelParaOLinkedin`. */
export function ambienteDaVercel(): { vercelEnv?: string; urlDaBranch?: string } {
  return { vercelEnv: process.env.VERCEL_ENV, urlDaBranch: process.env.VERCEL_BRANCH_URL };
}

export function urlDeAutorizacaoDoLinkedin(clientId: string, redirectUri: string, state: string): string {
  const p = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: ESCOPO_DO_LINKEDIN,
  });
  return `${OAUTH}/oauth/v2/authorization?${p.toString()}`;
}

/**
 * O scope devolvido tem a permissão de publicar? MEDIDO NA TROCA DE 09/11/2026: ele veio separado por VÍRGULA
 * ("openid,profile,w_member_social"), e a documentação diz espaço; os dois servem.
 */
export function temPermissaoDePublicar(scope: unknown): boolean {
  return typeof scope === "string" && scope.split(/[\s,]+/).includes("w_member_social");
}

export class LinkedinError extends Error {
  status: number;
  texto: string;
  constructor(status: number, texto: string) {
    super(`LinkedIn ${status}: ${texto}`);
    this.name = "LinkedinError";
    this.status = status;
    this.texto = texto;
  }
}

async function chamar(url: string, init: RequestInit): Promise<{ status: number; texto: string }> {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TETO_DO_LINKEDIN_MS) });
    return { status: res.status, texto: await res.text() };
  } catch (err) {
    // O endereço vai sem a query: nenhuma destas chamadas leva segredo nela, e assim continua.
    const onde = url.split("?")[0];
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new LinkedinError(0, `${onde} não respondeu em ${TETO_DO_LINKEDIN_MS}ms`);
    }
    throw new LinkedinError(0, `${onde} falhou na rede`);
  }
}

function json(texto: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(texto) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * A TROCA DO CÓDIGO PELA AUTORIZAÇÃO (`POST /oauth/v2/accessToken`, form urlencoded). DA RESPOSTA, SÓ TRÊS
 * CAMPOS SAEM DAQUI: a autorização, o prazo e o scope. O `id_token` (que veio na troca de 09/11) e o resto são
 * descartados aqui mesmo, e não chegam ao banco nem ao texto de erro.
 */
export async function trocarCodigoDoLinkedin(p: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
}): Promise<{ accessToken: string; expiraEmSegundos: number; scope: string }> {
  const r = await chamar(`${basesDoLinkedin().oauth}/oauth/v2/accessToken`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: p.code,
      client_id: p.clientId,
      client_secret: p.clientSecret,
      redirect_uri: p.redirectUri,
    }).toString(),
  });
  if (r.status !== 200) throw new LinkedinError(r.status, r.texto.slice(0, 300));
  const corpo = json(r.texto);
  const accessToken = corpo?.access_token;
  const expira = corpo?.expires_in;
  if (typeof accessToken !== "string" || !accessToken || typeof expira !== "number" || !(expira > 0)) {
    throw new LinkedinError(r.status, "a troca não devolveu a autorização e o prazo");
  }
  return { accessToken, expiraEmSegundos: expira, scope: typeof corpo?.scope === "string" ? corpo.scope : "" };
}

/** QUEM É A PESSOA (`GET /v2/userinfo`, do OpenID Connect): o `sub`, que vira o autor dos posts, e o nome. */
export async function pessoaDoLinkedin(accessToken: string): Promise<{ sub: string; nome: string }> {
  const r = await chamar(`${basesDoLinkedin().api}/v2/userinfo`, {
    method: "GET",
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (r.status !== 200) throw new LinkedinError(r.status, r.texto.slice(0, 300));
  const corpo = json(r.texto);
  const sub = corpo?.sub;
  if (typeof sub !== "string" || !sub) throw new LinkedinError(r.status, "o userinfo veio sem o sub");
  const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const nome = texto(corpo?.name) || [texto(corpo?.given_name), texto(corpo?.family_name)].filter(Boolean).join(" ");
  return { sub, nome: nome || "sem nome no LinkedIn" };
}
```

Crie `lib/linkedin-publicacao.ts`:

```ts
// AS DECISÕES PURAS DO LINKEDIN (docs/specs/2026-11-06-linkedin-no-perfil.md, §5), SEM IMPORT DE SERVIDOR: a
// tela de cliente e o servidor leem as mesmas regras. Na parte 1 (a conexão), só o vencimento; as formas, o
// texto e a classificação dos erros vêm na parte 2, que publica.

/** O aviso de que a autorização vai vencer começa a 7 dias. */
export const AVISO_DO_VENCIMENTO_DIAS = 7;

const DIA_MS = 86_400_000;

export type Vencimento = { estado: "valido" | "perto" | "vencido"; dias: number; frase: string };

/**
 * O VENCIMENTO DA AUTORIZAÇÃO DO LINKEDIN: 60 dias, sem renovação automática (renovar é mandar um convite
 * novo). Um pedaço de dia conta como um dia inteiro, e o prazo vence no próprio instante, como o do convite
 * (`estadoDoConvite`, lib/convites.ts). A data pode chegar como texto, de um componente de cliente.
 */
export function vencimentoDoLinkedin(expiraEm: Date | string, agoraMs: number): Vencimento {
  const falta = new Date(expiraEm).getTime() - agoraMs;
  if (!(falta > 0)) return { estado: "vencido", dias: 0, frase: "venceu" };
  const dias = Math.ceil(falta / DIA_MS);
  return {
    estado: dias <= AVISO_DO_VENCIMENTO_DIAS ? "perto" : "valido",
    dias,
    frase: dias === 1 ? "vence em 1 dia" : `vence em ${dias} dias`,
  };
}
```

A troca do código devolve só a autorização, o prazo e o scope: o `id_token`, que veio na troca de 09/11, é descartado ali mesmo (nota 1 da auditoria; a FASE 3 prova que ele não chega ao banco). O scope aceita a vírgula, medida na troca de 09/11, e o espaço, o da documentação.

- [ ] **Passo 4: rodar e ver passar**

```bash
env -u CLAUDECODE -u AI_AGENT npx vitest run tests/linkedin.test.ts tests/linkedin-publicacao.test.ts
npx tsc --noEmit
npx eslint lib/linkedin.ts lib/linkedin-publicacao.ts tests/linkedin.test.ts tests/linkedin-publicacao.test.ts
```

Esperado: "Test Files 2 passed (2)" e "Tests 17 passed (17)", e o `tsc` e o lint sem saída.

- [ ] **Passo 5: o commit**

A mensagem do commit, gravada em `$SCRATCH/msg-li1-f2.txt`:

```text
O cliente do LinkedIn troca o código pela autorização e lê quem é a pessoa, e o vencimento sai de uma regra só
```

```bash
git add -- lib/linkedin.ts lib/linkedin-publicacao.ts tests/linkedin.test.ts tests/linkedin-publicacao.test.ts
git commit -F "$SCRATCH/msg-li1-f2.txt"
```

---

### FASE 3 — O convite e a volta do LinkedIn

**Arquivos:** `lib/convites.ts`, `app/convite/cartao.tsx`, `app/convite/[codigo]/page.tsx`, `app/convite/pronto/page.tsx`, `app/convite/erro/page.tsx`, `app/api/oauth/convite/[codigo]/route.ts`, `app/api/oauth/callback/convite.ts`, `app/api/oauth/linkedin/callback/route.ts` (novo), `testes-integracao/linkedin-convite.integracao.ts` (novo), `testes-integracao/convite-paginas.integracao.ts`, `testes-integracao/convite-volta.integracao.ts`, `tests/sessao-nas-actions.test.ts`, `tests/acesso-nas-actions.test.ts`.

- [ ] **Passo 1: os testes**

Crie `testes-integracao/linkedin-convite.integracao.ts`:

```ts
// O CONVITE DO LINKEDIN DE PONTA A PONTA (docs/specs/2026-11-06-linkedin-no-perfil.md, §3; a parte 1, a
// conexão): o começo pelo link (`/api/oauth/convite/[codigo]`) com um convite do LinkedIn e a volta nova
// (`/api/oauth/linkedin/callback`), contra o banco descartável.
//
// O LINKEDIN FALSO: um servidor HTTP na própria máquina, para a troca do código e o `userinfo`. As duas bases
// do LinkedIn (lib/linkedin.ts) vão para ele sob as duas travas (`VITEST` e o loopback), e uma guarda confere
// isso ANTES de qualquer requisição. O `fetch` é interceptado só neste arquivo e RECUSA qualquer endereço que
// não seja o loopback. **NADA AQUI CHAMA O LINKEDIN DE VERDADE.** Valores inventados: nenhuma credencial de
// verdade entra em teste.
import { createServer, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { bancoDescartavel } from "./harness";

type ModuloComeco = typeof import("@/app/api/oauth/convite/[codigo]/route");
type ModuloVolta = typeof import("@/app/api/oauth/linkedin/callback/route");
type ModuloRepositorio = typeof import("@/lib/convites-repositorio");
type ModuloLinkedin = typeof import("@/lib/linkedin");

const banco = bancoDescartavel();

const APP_URL = "https://painel.exemplo.com.br";
const CLIENT_ID = "idDoAppDoLinkedinDeTeste";
const CLIENT_SECRET = "segredo-do-app-do-linkedin-de-teste-que-nao-vale-nada";
const CONTA = "17800000000024101";
const CODE = "AQTcodigoDaVoltaDoLinkedinDeTeste";
const STATE = "c".repeat(64);
const TOKEN = "AQVautorizacaoDoLinkedinDeTesteQueNaoValeNada";
const ID_TOKEN = "eyJidDoOpenIdDeTesteQueNaoPodeIrAoBanco";
const COOKIE_DO_STATE = "metodochat_oauth_state";
const COOKIE_DO_CONVITE = "metodochat_oauth_convite";
const VOLTA = `${APP_URL}/api/oauth/linkedin/callback`;

const linkedin = {
  troca: { status: 200, corpo: "" },
  userinfo: { status: 200, corpo: "" },
  /** Roda no meio da troca, antes de ela responder: é como o caso da disputa entra. */
  noMeioDaTroca: null as null | (() => Promise<void>),
  pedidosDeTroca: [] as URLSearchParams[],
  autorizacoesDoUserinfo: [] as string[],
  desconhecidos: [] as string[],
};

const trocaQueDaCerto = (scope = "openid,profile,w_member_social") =>
  JSON.stringify({ access_token: TOKEN, expires_in: 5_183_999, scope, token_type: "Bearer", id_token: ID_TOKEN });
const pessoaQueDaCerto = (sub = "pessoaDoLinkedinA1", name = "Dra. Ana Souza") =>
  JSON.stringify({ sub, name, given_name: "Ana", family_name: "Souza", locale: { country: "BR", language: "pt" } });

let servidor: Server;
let comeco: ModuloComeco;
let volta: ModuloVolta;
let repo: ModuloRepositorio;
let li: ModuloLinkedin;
let Pedido: typeof import("next/server").NextRequest;

function responder(res: ServerResponse, status: number, corpo: string) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(corpo);
}

beforeAll(async () => {
  servidor = createServer((req, res) => {
    const u = new URL(req.url ?? "/", "http://127.0.0.1");
    if (req.method === "POST" && u.pathname === "/oauth/v2/accessToken") {
      let corpo = "";
      req.on("data", (pedaco) => (corpo += pedaco));
      req.on("end", async () => {
        linkedin.pedidosDeTroca.push(new URLSearchParams(corpo));
        if (linkedin.noMeioDaTroca) await linkedin.noMeioDaTroca();
        responder(res, linkedin.troca.status, linkedin.troca.corpo);
      });
      return;
    }
    if (req.method === "GET" && u.pathname === "/v2/userinfo") {
      linkedin.autorizacoesDoUserinfo.push(String(req.headers.authorization ?? ""));
      return responder(res, linkedin.userinfo.status, linkedin.userinfo.corpo);
    }
    linkedin.desconhecidos.push(`${req.method} ${u.pathname}`);
    responder(res, 404, JSON.stringify({ message: "o LinkedIn falso não conhece esse caminho" }));
  });
  await new Promise<void>((pronto) => servidor.listen(0, "127.0.0.1", pronto));
  process.env.LINKEDIN_API_BASE = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;

  // O INTERCEPTADOR: só o loopback passa.
  const fetchDeVerdade = globalThis.fetch;
  vi.stubGlobal("fetch", async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof entrada === "string" ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
    if (url.hostname === "127.0.0.1") return fetchDeVerdade(entrada, init);
    throw new Error(`RECUSADO: este teste não chama ${url.origin}`);
  });

  li = await import("@/lib/linkedin");
  comeco = await import("@/app/api/oauth/convite/[codigo]/route");
  volta = await import("@/app/api/oauth/linkedin/callback/route");
  repo = await import("@/lib/convites-repositorio");
  Pedido = (await import("next/server")).NextRequest;

  // A GUARDA, ANTES DE QUALQUER REQUISIÇÃO.
  const bases = li.basesDoLinkedin();
  if (bases.api !== process.env.LINKEDIN_API_BASE || bases.oauth !== process.env.LINKEDIN_API_BASE) {
    throw new Error(
      `RECUSADO: as bases do LinkedIn são ${JSON.stringify(bases)}, e tinham de ser as desta rodada ` +
        `(${process.env.LINKEDIN_API_BASE}). Sem o desvio, este teste chamaria o LinkedIn de verdade.`
    );
  }
  await banco.db().sql().query(`insert into config (id) values (1) on conflict do nothing`);
});

afterAll(async () => {
  vi.unstubAllGlobals();
  delete process.env.LINKEDIN_API_BASE;
  await new Promise<void>((pronto) => servidor.close(() => pronto()));
});

beforeEach(async () => {
  vi.unstubAllEnvs();
  vi.stubEnv("LINKEDIN_CLIENT_ID", CLIENT_ID);
  vi.stubEnv("LINKEDIN_CLIENT_SECRET", CLIENT_SECRET);
  vi.stubEnv("VERCEL_ENV", "");
  vi.stubEnv("VERCEL_BRANCH_URL", "");
  linkedin.troca = { status: 200, corpo: trocaQueDaCerto() };
  linkedin.userinfo = { status: 200, corpo: pessoaQueDaCerto() };
  linkedin.noMeioDaTroca = null;
  linkedin.pedidosDeTroca.length = 0;
  linkedin.autorizacoesDoUserinfo.length = 0;
  linkedin.desconhecidos.length = 0;
  const sql = banco.db().sql();
  await sql.query(`delete from linkedin_conexoes`);
  await sql.query(`delete from convites_de_conexao`);
  await sql.query(`delete from accounts where ig_user_id = $1`, [CONTA]);
  await sql.query(`insert into accounts (ig_user_id, username, access_token) values ($1, 'conta_da_ana', 'ig-token-de-teste')`, [
    CONTA,
  ]);
  await sql.query(`update config set app_url = $1 where id = 1`, [APP_URL]);
});

const conviteDoLinkedin = () => repo.criarConvite("@conta_da_ana", { rede: "linkedin", contaAlvo: CONTA });

function cookies(resposta: Response): Map<string, string> {
  const todos = (resposta.headers as Headers & { getSetCookie(): string[] }).getSetCookie();
  return new Map(todos.map((c) => [c.slice(0, c.indexOf("=")), c]));
}

const destino = (resposta: Response) => new URL(resposta.headers.get("location") ?? "");
const apagado = (cookie: string | undefined) =>
  !!cookie && /=;/.test(cookie) && /(Max-Age=0|Expires=Thu, 01 Jan 1970)/i.test(cookie);

async function comecar(codigo: string): Promise<Response> {
  return comeco.GET(new Pedido(`${APP_URL}/api/oauth/convite/${codigo}`, { method: "GET" }), {
    params: Promise.resolve({ codigo }),
  });
}

/** A volta como o LinkedIn a chama, com os cookies que o começo gravou. */
async function voltar(opcoes: { convite?: string | null; state?: string; query?: string } = {}): Promise<Response> {
  const lista = [`${COOKIE_DO_STATE}=${opcoes.state ?? STATE}`];
  if (opcoes.convite) lista.push(`${COOKIE_DO_CONVITE}=${opcoes.convite}`);
  const query = opcoes.query ?? `code=${CODE}&state=${STATE}`;
  return volta.GET(new Pedido(`${VOLTA}?${query}`, { method: "GET", headers: { cookie: lista.join("; ") } }));
}

const conviteNoBanco = async (id: string) =>
  ((await banco.db().sql().query(`select * from convites_de_conexao where id = $1`, [id])) as Record<string, unknown>[])[0];

const conexaoNoBanco = async () =>
  ((await banco.db().sql().query(`select * from linkedin_conexoes where account_id = $1`, [CONTA])) as Record<
    string,
    unknown
  >[])[0] ?? null;

function oFim(resposta: Response, caminho: string, motivo?: string) {
  expect(destino(resposta).origin).toBe(APP_URL);
  expect(destino(resposta).pathname).toBe(caminho);
  expect(destino(resposta).searchParams.get("rede")).toBe("linkedin");
  expect(destino(resposta).searchParams.get("motivo")).toBe(motivo ?? null);
  const c = cookies(resposta);
  expect(apagado(c.get(COOKIE_DO_STATE))).toBe(true);
  expect(apagado(c.get(COOKIE_DO_CONVITE))).toBe(true);
}

const nenhumaChamada = () => {
  expect(linkedin.pedidosDeTroca).toHaveLength(0);
  expect(linkedin.autorizacoesDoUserinfo).toHaveLength(0);
};

// ---------------------------------------------------------------------------------------------------
// O COMEÇO
// ---------------------------------------------------------------------------------------------------

describe("o começo da conexão pelo convite do LinkedIn", () => {
  it("manda à autorização do LinkedIn, com a volta nova no endereço canônico, e grava os dois cookies", async () => {
    const { id, codigo } = await conviteDoLinkedin();
    const resposta = await comecar(codigo);
    const para = destino(resposta);
    expect(para.origin).toBe("https://www.linkedin.com");
    expect(para.pathname).toBe("/oauth/v2/authorization");
    expect(para.searchParams.get("client_id")).toBe(CLIENT_ID);
    expect(para.searchParams.get("redirect_uri")).toBe(VOLTA);
    expect(para.searchParams.get("scope")).toBe("openid profile w_member_social");
    const state = para.searchParams.get("state") ?? "";
    expect(state).toMatch(/^[0-9a-f]{64}$/);

    const c = cookies(resposta);
    expect(c.get(COOKIE_DO_STATE)?.startsWith(`${COOKIE_DO_STATE}=${state};`)).toBe(true);
    expect(c.get(COOKIE_DO_CONVITE)?.startsWith(`${COOKIE_DO_CONVITE}=${id};`)).toBe(true);
    for (const cookie of [c.get(COOKIE_DO_STATE) ?? "", c.get(COOKIE_DO_CONVITE) ?? ""]) {
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/Path=\/api\/oauth/i);
      expect(cookie).toMatch(/Max-Age=600/i);
      expect(cookie).toMatch(/SameSite=lax/i);
    }
    // A chave secreta nunca vai no endereço da autorização.
    expect(para.toString()).not.toContain(CLIENT_SECRET);
  });

  it("no preview, a volta é o endereço da branch (o cadastrado no app para a prova)", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_BRANCH_URL", "metodochat-git-linkedin-conexao-time.vercel.app");
    const { codigo } = await conviteDoLinkedin();
    expect(destino(await comecar(codigo)).searchParams.get("redirect_uri")).toBe(
      "https://metodochat-git-linkedin-conexao-time.vercel.app/api/oauth/linkedin/callback"
    );
  });

  it("sem as chaves do app nas variáveis, manda para o erro do LinkedIn, sem cookie", async () => {
    vi.stubEnv("LINKEDIN_CLIENT_SECRET", "");
    const { codigo } = await conviteDoLinkedin();
    const resposta = await comecar(codigo);
    expect(destino(resposta).pathname).toBe("/convite/erro");
    expect(destino(resposta).searchParams.get("motivo")).toBe("falhou");
    expect(destino(resposta).searchParams.get("rede")).toBe("linkedin");
    expect(cookies(resposta).size).toBe(0);
  });

  it("o convite do LinkedIn que já não vale volta para a página do link, sem cookie", async () => {
    const { id, codigo } = await conviteDoLinkedin();
    await repo.cancelarConvite(id);
    const resposta = await comecar(codigo);
    expect(destino(resposta).toString()).toBe(`${APP_URL}/convite/${codigo}`);
    expect(cookies(resposta).size).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------------------
// A VOLTA
// ---------------------------------------------------------------------------------------------------

describe("a volta do LinkedIn", () => {
  it("troca o código com a mesma volta do começo, lê a pessoa, grava a conexão na conta-alvo e usa o convite", async () => {
    const { id, codigo } = await conviteDoLinkedin();
    const redirectDoComeco = destino(await comecar(codigo)).searchParams.get("redirect_uri");
    const antes = Date.now();
    const resposta = await voltar({ convite: id });
    oFim(resposta, "/convite/pronto");

    expect(linkedin.pedidosDeTroca).toHaveLength(1);
    expect(Object.fromEntries(linkedin.pedidosDeTroca[0])).toEqual({
      grant_type: "authorization_code",
      code: CODE,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: redirectDoComeco,
    });
    expect(linkedin.autorizacoesDoUserinfo).toEqual([`Bearer ${TOKEN}`]);

    const conexao = await conexaoNoBanco();
    expect(conexao).toMatchObject({ pessoa_id: "pessoaDoLinkedinA1", nome: "Dra. Ana Souza", access_token: TOKEN });
    const expira = (conexao!.expira_em as Date).getTime();
    expect(expira).toBeGreaterThanOrEqual(antes + 5_183_999_000);
    expect(expira).toBeLessThanOrEqual(Date.now() + 5_183_999_000);

    const convite = await conviteNoBanco(id);
    expect(convite).toMatchObject({ conta_conectada: CONTA, ultimo_erro: null });
    expect(convite.usado_em).toBeInstanceOf(Date);
    expect(linkedin.desconhecidos).toEqual([]);
  });

  it("o id_token da troca é descartado: não vai a coluna nenhuma", async () => {
    const { id } = await conviteDoLinkedin();
    await voltar({ convite: id });
    const linhas = [await conexaoNoBanco(), await conviteNoBanco(id)];
    for (const linha of linhas) {
      for (const valor of Object.values(linha ?? {})) expect(String(valor)).not.toContain(ID_TOKEN);
    }
  });

  it("o state diferente, ou a volta sem o cookie do convite, recusa sem escrever nada e sem chamar o LinkedIn", async () => {
    const { id } = await conviteDoLinkedin();
    oFim(await voltar({ convite: id, state: "d".repeat(64) }), "/convite/erro", "falhou");
    oFim(await voltar({ convite: null }), "/convite/erro", "falhou");
    expect(await conviteNoBanco(id)).toMatchObject({ ultimo_erro: null, usado_em: null });
    expect(await conexaoNoBanco()).toBeNull();
    nenhumaChamada();
  });

  it("a recusa no LinkedIn anota \"autorização negada no LinkedIn\" e não chama o LinkedIn", async () => {
    const { id } = await conviteDoLinkedin();
    oFim(
      await voltar({ convite: id, query: `error=user_cancelled_authorize&error_description=x&state=${STATE}` }),
      "/convite/erro",
      "negado"
    );
    expect((await conviteNoBanco(id)).ultimo_erro).toBe("autorização negada no LinkedIn");
    nenhumaChamada();
  });

  it("o convite cancelado, usado ou vencido manda para o erro sem chamar o LinkedIn", async () => {
    const cancelado = await conviteDoLinkedin();
    await repo.cancelarConvite(cancelado.id);
    const vencido = await conviteDoLinkedin();
    await banco
      .db()
      .sql()
      .query(`update convites_de_conexao set expira_em = now() - interval '1 second' where id = $1`, [vencido.id]);
    const usado = await conviteDoLinkedin();
    await repo.reivindicarEGravarConexao(usado.id, {
      pessoa_id: "p",
      nome: "n",
      access_token: "t",
      expira_em: new Date(Date.now() + 86_400_000),
    });
    for (const convite of [cancelado.id, vencido.id, usado.id, "00000000-0000-4000-8000-000000000000", "torto"]) {
      oFim(await voltar({ convite }), "/convite/erro", "vencido");
    }
    nenhumaChamada();
  });

  it("o convite do Instagram na volta do LinkedIn não conecta nada e não chama o LinkedIn", async () => {
    const { id } = await repo.criarConvite("Dr. Marcus");
    oFim(await voltar({ convite: id }), "/convite/erro", "vencido");
    expect(await conviteNoBanco(id)).toMatchObject({ usado_em: null });
    expect(await conexaoNoBanco()).toBeNull();
    nenhumaChamada();
  });

  it("a conta-alvo apagada leva o convite junto, e a volta não grava nada", async () => {
    const { id } = await conviteDoLinkedin();
    await banco.db().sql().query(`delete from accounts where ig_user_id = $1`, [CONTA]);
    oFim(await voltar({ convite: id }), "/convite/erro", "vencido");
    nenhumaChamada();
  });

  it("sem a permissão de publicar no scope, não conecta, e o motivo fica no convite", async () => {
    const { id } = await conviteDoLinkedin();
    linkedin.troca = { status: 200, corpo: trocaQueDaCerto("openid,profile") };
    oFim(await voltar({ convite: id }), "/convite/erro", "falhou");
    const convite = await conviteNoBanco(id);
    expect(convite.usado_em).toBeNull();
    expect(String(convite.ultimo_erro)).toContain("w_member_social");
    expect(await conexaoNoBanco()).toBeNull();
  });

  it("o LinkedIn em erro na troca deixa o convite pendente, com o erro limpo do código e da chave", async () => {
    const { id } = await conviteDoLinkedin();
    linkedin.troca = {
      status: 400,
      corpo: JSON.stringify({ error: "invalid_request", error_description: `codigo ${CODE} com a chave ${CLIENT_SECRET}` }),
    };
    oFim(await voltar({ convite: id }), "/convite/erro", "falhou");
    const convite = await conviteNoBanco(id);
    expect(convite.usado_em).toBeNull();
    const erro = String(convite.ultimo_erro);
    expect(erro).toContain("OCULTO");
    expect(erro).not.toContain(CODE);
    expect(erro).not.toContain(CLIENT_SECRET);
    expect(erro.length).toBeLessThanOrEqual(160);
    expect(await conexaoNoBanco()).toBeNull();
  });

  it("o userinfo em erro não leva a autorização para o texto do erro", async () => {
    const { id } = await conviteDoLinkedin();
    linkedin.userinfo = { status: 401, corpo: JSON.stringify({ message: `token ${TOKEN} recusado` }) };
    oFim(await voltar({ convite: id }), "/convite/erro", "falhou");
    const erro = String((await conviteNoBanco(id)).ultimo_erro);
    expect(erro).toContain("OCULTO");
    expect(erro).not.toContain(TOKEN);
    expect(await conexaoNoBanco()).toBeNull();
  });

  it("o convite reivindicado no meio da troca (outra aba, ou cancelado) não grava a conexão", async () => {
    const { id } = await conviteDoLinkedin();
    linkedin.noMeioDaTroca = async () => {
      await repo.cancelarConvite(id);
    };
    oFim(await voltar({ convite: id }), "/convite/erro", "vencido");
    expect(linkedin.pedidosDeTroca).toHaveLength(1);
    expect(await conexaoNoBanco()).toBeNull();
  });

  it("a reconexão com outra pessoa troca a pessoa e o nome da conexão da conta", async () => {
    const primeiro = await conviteDoLinkedin();
    await voltar({ convite: primeiro.id });
    const segundo = await conviteDoLinkedin();
    linkedin.userinfo = { status: 200, corpo: pessoaQueDaCerto("pessoaDoLinkedinB2", "Dr. Bruno Lima") };
    oFim(await voltar({ convite: segundo.id }), "/convite/pronto");
    expect(await conexaoNoBanco()).toMatchObject({ pessoa_id: "pessoaDoLinkedinB2", nome: "Dr. Bruno Lima" });
    expect(((await banco.db().sql().query(`select count(*)::int as n from linkedin_conexoes`)) as { n: number }[])[0].n).toBe(1);
  });
});
```

Em `testes-integracao/convite-paginas.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/convite-paginas.integracao.ts b/testes-integracao/convite-paginas.integracao.ts
index 45413dc..6fd2199 100644
--- a/testes-integracao/convite-paginas.integracao.ts
+++ b/testes-integracao/convite-paginas.integracao.ts
@@ -112,6 +112,59 @@ describe("as páginas do fim", () => {
   });
 });
 
+// O CONVITE DO LINKEDIN (docs/specs/2026-11-06-linkedin-no-perfil.md, §3): a mesma página e as mesmas páginas
+// do fim, com os passos e as frases do LinkedIn. A rede do fim chega pela URL (`?rede=linkedin`), de uma lista
+// fechada, como o motivo.
+describe("as páginas do convite do LinkedIn", () => {
+  const CONTA = "17800000000024201";
+
+  beforeEach(async () => {
+    await banco.db().sql().query(`delete from accounts where ig_user_id = $1`, [CONTA]);
+    await banco
+      .db()
+      .sql()
+      .query(`insert into accounts (ig_user_id, username, access_token) values ($1, 'conta_da_ana', 'ig-token-de-teste')`, [
+        CONTA,
+      ]);
+  });
+
+  it("com o convite pendente, mostra os passos do LinkedIn e o botão, e nada do Instagram nem do painel", async () => {
+    const { codigo } = await repo.criarConvite("@conta_da_ana", { rede: "linkedin", contaAlvo: CONTA });
+    const h = await html(codigo);
+    expect(h).toContain("Conectar seu LinkedIn");
+    expect(h).toContain("Conectar meu LinkedIn");
+    expect(h).toContain(`href="/api/oauth/convite/${codigo}"`);
+    expect(h).toContain("o seu perfil pessoal");
+    expect(h).not.toContain("Instagram");
+    expect(h).not.toContain("conta_da_ana");
+  });
+
+  it("o convite do LinkedIn que já não vale tem a mesma página de todo link que não vale", async () => {
+    const { id, codigo } = await repo.criarConvite("@conta_da_ana", { rede: "linkedin", contaAlvo: CONTA });
+    await repo.cancelarConvite(id);
+    expect(await html(codigo)).toBe(await html("a".repeat(43)));
+  });
+
+  it("o \"Pronto\" e o erro dizem LinkedIn, com o título do LinkedIn", async () => {
+    const prontoDoLinkedin = renderToStaticMarkup(
+      await pronto.default({ searchParams: Promise.resolve({ rede: "linkedin" }) })
+    );
+    expect(prontoDoLinkedin).toContain("Pronto, seu LinkedIn foi conectado. Pode fechar esta página.");
+    expect(prontoDoLinkedin).toContain("Conectar seu LinkedIn");
+    const negado = renderToStaticMarkup(
+      await erro.default({ searchParams: Promise.resolve({ motivo: "negado", rede: "linkedin" }) })
+    );
+    expect(negado).toContain("A autorização foi recusada no LinkedIn");
+    expect(negado).toContain("Conectar seu LinkedIn");
+    expect(negado).not.toContain("Instagram");
+  });
+
+  it("uma rede fora da lista vira o Instagram de sempre", async () => {
+    const h = renderToStaticMarkup(await pronto.default({ searchParams: Promise.resolve({ rede: "tiktok" }) }));
+    expect(h).toContain("Pronto, sua conta do Instagram foi conectada.");
+  });
+});
+
 // O CARTÃO E O BOTÃO (o print do Eduardo, 04/11/2026). Na produção, o botão "Conectar meu Instagram" saiu
 // grudado no texto do passo 3: ele estava dentro do `<li>`, com `block` e com o `inline-flex` do btnPrimary
 // na mesma classe, e quem ganha entre duas utilidades de display é a ordem das regras no CSS gerado, e não a
```

Em `testes-integracao/convite-volta.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/convite-volta.integracao.ts b/testes-integracao/convite-volta.integracao.ts
index 501052a..01dabb7 100644
--- a/testes-integracao/convite-volta.integracao.ts
+++ b/testes-integracao/convite-volta.integracao.ts
@@ -226,6 +226,23 @@ describe("a volta do Instagram pelo convite", () => {
     expect(meta.trocas).toBe(0);
   });
 
+  // O CONVITE DO LINKEDIN GRAVA OS MESMOS COOKIES (docs/specs/2026-11-06-linkedin-no-perfil.md, §3). Na volta do
+  // Instagram, ele não pode servir para pôr um Instagram qualquer no painel.
+  it("o convite do LinkedIn na volta do Instagram não conecta conta nenhuma, e não chama a Meta", async () => {
+    const ALVO = "17800000000024301";
+    await banco.db().sql().query(`delete from accounts where ig_user_id = $1`, [ALVO]);
+    await banco
+      .db()
+      .sql()
+      .query(`insert into accounts (ig_user_id, username, access_token) values ($1, 'alvo', 'ig-token-de-teste')`, [ALVO]);
+    const { id } = await repo.criarConvite("@alvo", { rede: "linkedin", contaAlvo: ALVO });
+    const resposta = await voltar({ convite: id });
+    oFimDoConvite(resposta, "/convite/erro", "vencido");
+    expect(await conviteNoBanco(id)).toMatchObject({ usado_em: null, conta_conectada: null });
+    expect(await tokenDaConta()).toBeNull();
+    expect(meta.trocas).toBe(0);
+  });
+
   it("a assinatura dos webhooks que falha fica no convite usado (achado 158), e a conta fica", async () => {
     const { id } = await repo.criarConvite("Dr. Marcus");
     meta.assinatura = { status: 500, corpo: JSON.stringify({ error: { message: "a Meta caiu" } }) };
```

Em `tests/sessao-nas-actions.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/sessao-nas-actions.test.ts b/tests/sessao-nas-actions.test.ts
index 278cccc..5beca7b 100644
--- a/tests/sessao-nas-actions.test.ts
+++ b/tests/sessao-nas-actions.test.ts
@@ -286,6 +286,8 @@ describe("toda rota fora das públicas confere a sessão antes de qualquer traba
       "app/api/cron/daily/route.ts",
       "app/api/oauth/callback/route.ts",
       "app/api/oauth/convite/[codigo]/route.ts",
+      // A volta do LinkedIn (docs/specs/2026-11-06-linkedin-no-perfil.md, §3): pública como a do Instagram.
+      "app/api/oauth/linkedin/callback/route.ts",
       "app/api/oauth/login/route.ts",
       "app/api/queue/tick/route.ts",
       "app/api/webhook/route.ts",
```

Em `tests/acesso-nas-actions.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/acesso-nas-actions.test.ts b/tests/acesso-nas-actions.test.ts
index cfddb93..8acc3de 100644
--- a/tests/acesso-nas-actions.test.ts
+++ b/tests/acesso-nas-actions.test.ts
@@ -190,6 +190,9 @@ const FORA_DA_REGRA: Record<string, { motivo: string; leOPapel?: true }> = {
     motivo: "a volta do OAuth, pelo state: só chega do começo de um administrador ou de um convite",
   },
   "app/api/oauth/convite/[codigo]/route.ts GET": { motivo: "o começo do convite, público, pelo código" },
+  "app/api/oauth/linkedin/callback/route.ts GET": {
+    motivo: "a volta do LinkedIn, pelo state e pelo convite: a conexão vai para a conta-alvo que o administrador escolheu",
+  },
   "app/api/oauth/login/route.ts GET": {
     motivo: "confere o papel no login da sessão que a rota lê (login.administrador)",
     leOPapel: true,
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
env -u CLAUDECODE -u AI_AGENT npx vitest run tests/sessao-nas-actions.test.ts tests/acesso-nas-actions.test.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" \
  npx vitest run --config vitest.integracao.config.ts \
  testes-integracao/linkedin-convite.integracao.ts testes-integracao/convite-paginas.integracao.ts \
  testes-integracao/convite-volta.integracao.ts
```

Esperado nos puros: "Tests 2 failed | 10 passed (12)". Caem "as públicas são as do proxy.ts, e as protegidas incluem as oito de 26/10" e "a lista fechada não envelhece: cada item dela é uma action ou um handler que existe": as listas já nomeiam a rota nova, que ainda não existe.

Esperado na integração: `[rede-global] ALVO: banco de TESTE`, e "Tests 3 failed | 17 passed | 16 skipped (36)":
- o arquivo novo não acha `@/app/api/oauth/linkedin/callback/route`, e os 16 casos dele pulam;
- caem "com o convite pendente, mostra os passos do LinkedIn e o botão, e nada do Instagram nem do painel" e "o \"Pronto\" e o erro dizem LinkedIn, com o título do LinkedIn";
- cai "o convite do LinkedIn na volta do Instagram não conecta conta nenhuma, e não chama a Meta", com `expected 1 to be +0`: a volta de hoje chama a Meta antes de a reivindicação recusar.

- [ ] **Passo 3: o código**

Em `lib/convites.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/convites.ts b/lib/convites.ts
index 103f8bd..09b2d33 100644
--- a/lib/convites.ts
+++ b/lib/convites.ts
@@ -78,6 +78,31 @@ export const FRASE_DO_LINK_QUE_NAO_VALE = "Este link não vale mais. Peça um no
 
 export const FRASE_DO_PRONTO = "Pronto, sua conta do Instagram foi conectada. Pode fechar esta página.";
 
+// AS PÁGINAS ABERTAS DO CONVITE DO LINKEDIN (docs/specs/2026-11-06-linkedin-no-perfil.md, §3). A rede das
+// páginas do fim chega pela URL, e por isso vem de uma lista fechada, como o motivo: fora dela, é o Instagram de
+// sempre.
+export function redeDoParametro(valor: unknown): Rede {
+  return valor === "linkedin" ? "linkedin" : "instagram";
+}
+
+export const TITULO_DA_REDE: Record<Rede, string> = {
+  instagram: "Conectar seu Instagram",
+  linkedin: "Conectar seu LinkedIn",
+};
+
+export const FRASE_DO_PRONTO_DA_REDE: Record<Rede, string> = {
+  instagram: FRASE_DO_PRONTO,
+  linkedin: "Pronto, seu LinkedIn foi conectado. Pode fechar esta página.",
+};
+
+/** A frase do erro na rede do convite: só a recusa diz onde foi recusada. */
+export function fraseDoMotivo(motivo: MotivoDoErro, rede: Rede): string {
+  if (motivo === "negado" && rede === "linkedin") {
+    return "A autorização foi recusada no LinkedIn, e o LinkedIn não foi conectado.";
+  }
+  return FRASE_DO_MOTIVO[motivo];
+}
+
 /**
  * O texto do erro que vai para o `ultimo_erro` do convite (achado 159). Passa pela limpeza de sempre
  * (`semSegredo`, a query da Meta), troca por OCULTO cada segredo da volta (o `code`, o token e o código
```

Em `app/convite/cartao.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/convite/cartao.tsx b/app/convite/cartao.tsx
index 46264e3..7ddca6b 100644
--- a/app/convite/cartao.tsx
+++ b/app/convite/cartao.tsx
@@ -1,11 +1,21 @@
 import type { ReactNode } from "react";
 import { card, muted } from "@/app/ui";
+import { TITULO_DA_REDE, type Rede } from "@/lib/convites";
 
 // O CARTÃO DAS PÁGINAS DO LINK DE CONVITE (o print do Eduardo, 04/11/2026). É o invólucro da tela de entrar
 // (app/entrar/page.tsx): o cartão no centro, a pastilha "M" e o título. As três páginas do convite moram nele,
 // para o cliente ver o mesmo produto do painel, e não texto solto no fundo. A largura é a `max-w-md`, um
-// degrau acima da `max-w-sm` da tela de entrar, por causa dos três passos de texto.
-export default function CartaoDoConvite({ subtitulo, children }: { subtitulo?: string; children: ReactNode }) {
+// degrau acima da `max-w-sm` da tela de entrar, por causa dos três passos de texto. O título é o da rede do
+// convite (docs/specs/2026-11-06-linkedin-no-perfil.md, §3); sem a rede, é o do Instagram de sempre.
+export default function CartaoDoConvite({
+  subtitulo,
+  rede = "instagram",
+  children,
+}: {
+  subtitulo?: string;
+  rede?: Rede;
+  children: ReactNode;
+}) {
   return (
     <div className="mx-auto mt-16 max-w-md">
       <div className={`p-6 ${card}`}>
@@ -14,7 +24,7 @@ export default function CartaoDoConvite({ subtitulo, children }: { subtitulo?: s
             M
           </span>
           <div>
-            <h1 className="titulo text-lg font-bold leading-tight">Conectar seu Instagram</h1>
+            <h1 className="titulo text-lg font-bold leading-tight">{TITULO_DA_REDE[rede]}</h1>
             {subtitulo && <p className={`text-xs ${muted}`}>{subtitulo}</p>}
           </div>
         </div>
```

Em `app/convite/[codigo]/page.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/convite/[codigo]/page.tsx b/app/convite/[codigo]/page.tsx
index 83b1186..e367f10 100644
--- a/app/convite/[codigo]/page.tsx
+++ b/app/convite/[codigo]/page.tsx
@@ -12,7 +12,11 @@ import CartaoDoConvite from "../cartao";
 //
 // O CÓDIGO VIAJA NO CAMINHO DA URL, e os cabeçalhos do `next.config.ts` fecham o resto (achado 157). O link
 // de fora vai com `rel="noreferrer"`, para o endereço com o código não ir junto.
-export const metadata = { title: "Conectar seu Instagram", robots: { index: false, follow: false } };
+//
+// O CONVITE DO LINKEDIN (docs/specs/2026-11-06-linkedin-no-perfil.md, §3) tem os passos dele, no mesmo
+// cartão. O título da aba é o mesmo para as duas redes: ele é fixo, e a rede só se sabe depois de ler o
+// convite.
+export const metadata = { title: "Conectar sua conta", robots: { index: false, follow: false } };
 export const dynamic = "force-dynamic";
 
 const MANAGE_ACCESS = "https://www.instagram.com/accounts/manage_access/";
@@ -51,6 +55,32 @@ export default async function ConvitePage({ params }: { params: Promise<{ codigo
     );
   }
 
+  // O LINKEDIN: o cliente entra com o login dele e autoriza. Se ele já autorizou antes e está logado, o
+  // LinkedIn pula a tela de autorização e volta direto (a documentação, spec §3, "Renovar").
+  if (convite.rede === "linkedin") {
+    return (
+      <CartaoDoConvite rede="linkedin" subtitulo="Pelo navegador, em dois passos.">
+        <ol className="space-y-4">
+          <Passo n={1}>
+            Clique no botão abaixo e entre no LinkedIn com o <b>seu login</b>, o do seu perfil pessoal.
+          </Passo>
+          <Passo n={2}>
+            Na tela do LinkedIn, clique em <b>Permitir</b>. Com isso, o painel pode publicar no seu perfil o que for
+            agendado para ele.
+            <span className={`mt-1 block text-xs ${muted}`}>
+              Se você já autorizou antes, o LinkedIn pode pular esta tela e voltar direto.
+            </span>
+          </Passo>
+        </ol>
+        <div className="pt-2">
+          <a href={`/api/oauth/convite/${encodeURIComponent(codigo)}`} className={`${btnPrimary} w-full`}>
+            Conectar meu LinkedIn
+          </a>
+        </div>
+      </CartaoDoConvite>
+    );
+  }
+
   // O BOTÃO MORA FORA DA LISTA, numa linha só dele (o print do Eduardo, 04/11/2026). Dentro do passo 3, com
   // `block` e o `inline-flex` do btnPrimary na mesma classe, ele saiu grudado no texto: entre duas utilidades
   // de display, ganha a ordem das regras no CSS gerado. Aqui a classe leva uma só, a do btnPrimary.
```

Em `app/convite/pronto/page.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/convite/pronto/page.tsx b/app/convite/pronto/page.tsx
index ac80ea0..71e40bd 100644
--- a/app/convite/pronto/page.tsx
+++ b/app/convite/pronto/page.tsx
@@ -1,14 +1,22 @@
-import { FRASE_DO_PRONTO } from "@/lib/convites";
+import { FRASE_DO_PRONTO_DA_REDE, redeDoParametro } from "@/lib/convites";
 import CartaoDoConvite from "../cartao";
 
 // O FIM DA CONEXÃO PELO LINK DE CONVITE, quando deu certo (docs/specs/2026-11-03-link-de-convite.md). É
 // aberta e fixa: o cliente não entra no painel. Mora no mesmo cartão das outras páginas do convite.
+//
+// A REDE VEM DA URL (`?rede=linkedin`, a volta do LinkedIn, docs/specs/2026-11-06-linkedin-no-perfil.md, §3),
+// de uma lista fechada: fora dela, é o Instagram de sempre.
 export const metadata = { title: "Conta conectada", robots: { index: false, follow: false } };
 
-export default async function ConvitePronto() {
+export default async function ConvitePronto({
+  searchParams,
+}: {
+  searchParams?: Promise<{ rede?: string | string[] }>;
+} = {}) {
+  const rede = redeDoParametro((await searchParams)?.rede);
   return (
-    <CartaoDoConvite>
-      <p>{FRASE_DO_PRONTO}</p>
+    <CartaoDoConvite rede={rede}>
+      <p>{FRASE_DO_PRONTO_DA_REDE[rede]}</p>
     </CartaoDoConvite>
   );
 }
```

Em `app/convite/erro/page.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/convite/erro/page.tsx b/app/convite/erro/page.tsx
index d5ff3d0..a9b9c24 100644
--- a/app/convite/erro/page.tsx
+++ b/app/convite/erro/page.tsx
@@ -1,22 +1,26 @@
-import { FRASE_DO_MOTIVO, motivoDoErro, PECA_UM_NOVO_LINK } from "@/lib/convites";
+import { fraseDoMotivo, motivoDoErro, PECA_UM_NOVO_LINK, redeDoParametro } from "@/lib/convites";
 import CartaoDoConvite from "../cartao";
 
 // O FIM DA CONEXÃO PELO LINK DE CONVITE, quando deu errado (docs/specs/2026-11-03-link-de-convite.md). É
 // aberta, e o motivo vem de uma lista fechada: o que veio na URL nunca aparece, e o texto da Meta fica no
 // `ultimo_erro` do convite, para o painel. Mora no mesmo cartão das outras páginas do convite.
+//
+// A REDE VEM DA URL (`?rede=linkedin`, docs/specs/2026-11-06-linkedin-no-perfil.md, §3), de uma lista fechada,
+// como o motivo.
 export const metadata = { title: "Não deu certo", robots: { index: false, follow: false } };
 
 export default async function ConviteErro({
   searchParams,
 }: {
-  searchParams: Promise<{ motivo?: string | string[] }>;
+  searchParams: Promise<{ motivo?: string | string[]; rede?: string | string[] }>;
 }) {
-  const { motivo } = await searchParams;
+  const { motivo, rede: redeDaUrl } = await searchParams;
   const qual = motivoDoErro(motivo);
+  const rede = redeDoParametro(redeDaUrl);
   return (
-    <CartaoDoConvite>
+    <CartaoDoConvite rede={rede}>
       <p>
-        {FRASE_DO_MOTIVO[qual]} {PECA_UM_NOVO_LINK}
+        {fraseDoMotivo(qual, rede)} {PECA_UM_NOVO_LINK}
       </p>
     </CartaoDoConvite>
   );
```

Em `app/api/oauth/convite/[codigo]/route.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/api/oauth/convite/[codigo]/route.ts b/app/api/oauth/convite/[codigo]/route.ts
index 42fbd9e..37a676a 100644
--- a/app/api/oauth/convite/[codigo]/route.ts
+++ b/app/api/oauth/convite/[codigo]/route.ts
@@ -10,6 +10,13 @@ import { getConfig } from "@/lib/db";
 import { canonicalAppUrl } from "@/lib/app-url";
 import { estadoDoConvite } from "@/lib/convites";
 import { conviteDoCodigo } from "@/lib/convites-repositorio";
+import {
+  ambienteDaVercel,
+  baseDoPainelParaOLinkedin,
+  CAMINHO_DA_VOLTA_DO_LINKEDIN,
+  credenciaisDoLinkedin,
+  urlDeAutorizacaoDoLinkedin,
+} from "@/lib/linkedin";
 
 // O COMEÇO DA CONEXÃO PELO LINK DE CONVITE (docs/specs/2026-11-03-link-de-convite.md). É pública, porque
 // `/api/oauth` está na PUBLIC_PREFIXES do proxy.ts: quem abre é o cliente, sem a senha do painel, e quem
@@ -20,6 +27,11 @@ import { conviteDoCodigo } from "@/lib/convites-repositorio";
 // para a página do link, que mostra a frase do link que não vale, sem `state` nenhum.
 //
 // NÃO GRAVA O `app_url`, ao contrário do começo de hoje: uma rota aberta não escreve na configuração.
+//
+// O CONVITE DO LINKEDIN (docs/specs/2026-11-06-linkedin-no-perfil.md, §3) vai à autorização do LinkedIn, com
+// os mesmos dois cookies, e volta pela rota dele (app/api/oauth/linkedin/callback). As chaves do app vêm das
+// variáveis da Vercel, e a volta é a do endereço do painel para o LinkedIn (`baseDoPainelParaOLinkedin`): o
+// canônico na produção, o da branch no preview.
 export async function GET(req: NextRequest, { params }: { params: Promise<{ codigo: string }> }) {
   const { codigo } = await params;
   const convite = await conviteDoCodigo(codigo);
@@ -27,14 +39,25 @@ export async function GET(req: NextRequest, { params }: { params: Promise<{ codi
     return NextResponse.redirect(`${req.nextUrl.origin}/convite/${encodeURIComponent(codigo)}`);
   }
   const config = await getConfig();
-  if (!config.instagram_app_id) {
-    return NextResponse.redirect(`${req.nextUrl.origin}/convite/erro?motivo=falhou`);
-  }
-  // O MESMO `redirect_uri` canônico do começo de hoje: ele tem de bater com o cadastrado na Meta, e o
-  // cookie do `state` só volta junto se o começo acontecer no endereço da volta (achado 136).
-  const redirectUri = `${canonicalAppUrl(config.app_url, req.nextUrl.origin)}/api/oauth/callback`;
   const state = novoOauthState();
-  const res = NextResponse.redirect(authorizeUrl(config.instagram_app_id, redirectUri, state));
+  let destino: string;
+  if (convite.rede === "linkedin") {
+    const chaves = credenciaisDoLinkedin();
+    if (!chaves) {
+      return NextResponse.redirect(`${req.nextUrl.origin}/convite/erro?motivo=falhou&rede=linkedin`);
+    }
+    const base = baseDoPainelParaOLinkedin(ambienteDaVercel(), canonicalAppUrl(config.app_url, req.nextUrl.origin));
+    destino = urlDeAutorizacaoDoLinkedin(chaves.clientId, `${base}${CAMINHO_DA_VOLTA_DO_LINKEDIN}`, state);
+  } else {
+    if (!config.instagram_app_id) {
+      return NextResponse.redirect(`${req.nextUrl.origin}/convite/erro?motivo=falhou`);
+    }
+    // O MESMO `redirect_uri` canônico do começo de hoje: ele tem de bater com o cadastrado na Meta, e o
+    // cookie do `state` só volta junto se o começo acontecer no endereço da volta (achado 136).
+    const redirectUri = `${canonicalAppUrl(config.app_url, req.nextUrl.origin)}/api/oauth/callback`;
+    destino = authorizeUrl(config.instagram_app_id, redirectUri, state);
+  }
+  const res = NextResponse.redirect(destino);
   const opcoes = {
     httpOnly: true,
     secure: process.env.NODE_ENV === "production",
```

Em `app/api/oauth/callback/convite.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/api/oauth/callback/convite.ts b/app/api/oauth/callback/convite.ts
index e961ad0..3196359 100644
--- a/app/api/oauth/callback/convite.ts
+++ b/app/api/oauth/callback/convite.ts
@@ -55,8 +55,12 @@ export async function voltaDoConvite(req: NextRequest, conviteId: string): Promi
     return erro("negado");
   }
 
+  // SÓ O CONVITE DO INSTAGRAM (docs/specs/2026-11-06-linkedin-no-perfil.md, §3): o do LinkedIn grava os mesmos
+  // cookies, e aqui ele não chama a Meta nem conecta conta nenhuma.
   const convite = await conviteDoId(conviteId);
-  if (!convite || estadoDoConvite(convite, Date.now()) !== "pendente") return erro("vencido");
+  if (!convite || convite.rede !== "instagram" || estadoDoConvite(convite, Date.now()) !== "pendente") {
+    return erro("vencido");
+  }
 
   const code = q.get("code");
   if (!code) {
```

Crie `app/api/oauth/linkedin/callback/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { OAUTH_CONVITE_COOKIE, OAUTH_STATE_COOKIE, oauthStateConfere } from "@/lib/auth";
import { getConfig } from "@/lib/db";
import { canonicalAppUrl } from "@/lib/app-url";
import { estadoDoConvite, textoParaOPainel, type MotivoDoErro } from "@/lib/convites";
import { anotarErroDoConvite, conviteDoId, reivindicarEGravarConexao } from "@/lib/convites-repositorio";
import {
  ambienteDaVercel,
  baseDoPainelParaOLinkedin,
  CAMINHO_DA_VOLTA_DO_LINKEDIN,
  credenciaisDoLinkedin,
  pessoaDoLinkedin,
  temPermissaoDePublicar,
  trocarCodigoDoLinkedin,
} from "@/lib/linkedin";

export const maxDuration = 60;

// A VOLTA DO LINKEDIN PELO LINK DE CONVITE (docs/specs/2026-11-06-linkedin-no-perfil.md, §3; a parte 1, a
// conexão). É pública, porque `/api/oauth` está na PUBLIC_PREFIXES do proxy.ts: quem chega aqui é o cliente,
// vindo do LinkedIn, sem a senha do painel. Só o convite do LinkedIn conecta por aqui, e só por convite.
//
// QUEM CONECTOU É O CLIENTE: o fim é uma das duas páginas abertas do convite (`/convite/pronto` ou
// `/convite/erro`, com `rede=linkedin`), nunca o painel. Nada do texto do LinkedIn chega ao cliente: ele vai,
// limpo dos segredos e cortado, para o `ultimo_erro` do convite, que só o painel mostra.
//
// A ORDEM É A DA SPEC, a mesma da volta do Instagram (app/api/oauth/callback/convite.ts):
// 1. o `state` e o cookie do convite, antes de qualquer escrita: sem eles, a volta não é de ninguém;
// 2. a recusa no LinkedIn;
// 3. o convite pendente, do LinkedIn, antes de chamar o LinkedIn (a conta-alvo apagada leva o convite junto);
// 4. a troca do código, a permissão de publicar e o `userinfo`, fora da transação, para ela não ficar aberta
//    durante a rede;
// 5. a reivindicação e a conexão, numa transação só (`reivindicarEGravarConexao`), na conta-alvo do convite.
//    Uma reconexão com outra pessoa troca a pessoa e o nome;
// 6. os dois cookies apagados em toda saída.
export async function GET(req: NextRequest): Promise<NextResponse> {
  const appUrl = req.nextUrl.origin;
  const q = req.nextUrl.searchParams;
  const conviteId = req.cookies.get(OAUTH_CONVITE_COOKIE)?.value ?? "";

  // OS DOIS COOKIES SÃO APAGADOS EM TODA RESPOSTA, dê certo ou não: cada `state` e cada convite servem uma
  // tentativa.
  const fim = (caminho: string) => {
    const res = NextResponse.redirect(`${appUrl}${caminho}`);
    res.cookies.set(OAUTH_STATE_COOKIE, "", { path: "/api/oauth", maxAge: 0 });
    res.cookies.set(OAUTH_CONVITE_COOKIE, "", { path: "/api/oauth", maxAge: 0 });
    return res;
  };
  const erro = (motivo: MotivoDoErro) => fim(`/convite/erro?motivo=${motivo}&rede=linkedin`);
  // Anotar não pode derrubar a resposta: o cliente vê a frase do erro de qualquer jeito.
  const anotar = async (texto: string) => {
    try {
      await anotarErroDoConvite(conviteId, texto, "pendente");
    } catch {
      // banco fora do ar: a frase do erro ainda chega ao cliente
    }
  };

  if (!conviteId || !oauthStateConfere(req.cookies.get(OAUTH_STATE_COOKIE)?.value, q.get("state"))) {
    return erro("falhou");
  }

  if (q.get("error")) {
    await anotar("autorização negada no LinkedIn");
    return erro("negado");
  }

  const convite = await conviteDoId(conviteId);
  if (!convite || convite.rede !== "linkedin" || estadoDoConvite(convite, Date.now()) !== "pendente") {
    return erro("vencido");
  }

  const code = q.get("code");
  if (!code) {
    await anotar("código ausente");
    return erro("falhou");
  }
  const chaves = credenciaisDoLinkedin();
  if (!chaves) {
    await anotar("as chaves do app do LinkedIn não estão nas variáveis da Vercel");
    return erro("falhou");
  }

  // OS SEGREDOS DESTA VOLTA, que nunca vão para o `ultimo_erro` (achado 159).
  const segredos: (string | null | undefined)[] = [code, chaves.clientSecret];
  const mensagem = (err: unknown) => (err instanceof Error ? err.message : "erro desconhecido");

  let pessoa: Parameters<typeof reivindicarEGravarConexao>[1];
  try {
    const config = await getConfig();
    const troca = await trocarCodigoDoLinkedin({
      ...chaves,
      // precisa ser IDÊNTICO ao usado no começo (app/api/oauth/convite/[codigo]/route.ts)
      redirectUri: `${baseDoPainelParaOLinkedin(ambienteDaVercel(), canonicalAppUrl(config.app_url, appUrl))}${CAMINHO_DA_VOLTA_DO_LINKEDIN}`,
      code,
    });
    segredos.push(troca.accessToken);
    if (!temPermissaoDePublicar(troca.scope)) {
      await anotar("o LinkedIn não deu a permissão de publicar (w_member_social)");
      return erro("falhou");
    }
    const quem = await pessoaDoLinkedin(troca.accessToken);
    pessoa = {
      pessoa_id: quem.sub,
      nome: quem.nome,
      access_token: troca.accessToken,
      expira_em: new Date(Date.now() + troca.expiraEmSegundos * 1000),
    };
  } catch (err) {
    await anotar(textoParaOPainel(mensagem(err), segredos));
    return erro("falhou");
  }

  let conta: string | null;
  try {
    conta = await reivindicarEGravarConexao(conviteId, pessoa);
  } catch (err) {
    await anotar(textoParaOPainel(mensagem(err), segredos));
    return erro("falhou");
  }
  // Outra aba com o mesmo link, ou o convite cancelado no meio: a conexão não foi gravada.
  if (!conta) return erro("vencido");

  return fim("/convite/pronto?rede=linkedin");
}
```

- [ ] **Passo 4: rodar e ver passar**

```bash
env -u CLAUDECODE -u AI_AGENT npx vitest run
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" \
  npx vitest run --config vitest.integracao.config.ts \
  testes-integracao/linkedin-convite.integracao.ts testes-integracao/convite-paginas.integracao.ts \
  testes-integracao/convite-volta.integracao.ts testes-integracao/convite.integracao.ts
npx tsc --noEmit
npx eslint lib/convites.ts app/convite app/api/oauth testes-integracao/linkedin-convite.integracao.ts \
  testes-integracao/convite-paginas.integracao.ts testes-integracao/convite-volta.integracao.ts \
  tests/sessao-nas-actions.test.ts tests/acesso-nas-actions.test.ts
```

Esperado: nos puros, "Test Files 149 passed (149)" e "Tests 3648 passed (3648)"; na integração, `ALVO: banco de TESTE`, "Test Files 4 passed (4)" e "Tests 43 passed (43)"; e o `tsc` e o lint sem saída. Os puros rodam INTEIROS de propósito: é o tropeço do ensaio.

- [ ] **Passo 5: o commit**

A mensagem do commit, gravada em `$SCRATCH/msg-li1-f3.txt`:

```text
O cliente conecta o LinkedIn pelo link de convite, e a conexão vai para a conta que o convite escolheu
```

```bash
git add -- lib/convites.ts app/convite/cartao.tsx "app/convite/[codigo]/page.tsx" app/convite/pronto/page.tsx \
  app/convite/erro/page.tsx "app/api/oauth/convite/[codigo]/route.ts" app/api/oauth/callback/convite.ts \
  app/api/oauth/linkedin/callback/route.ts testes-integracao/linkedin-convite.integracao.ts \
  testes-integracao/convite-paginas.integracao.ts testes-integracao/convite-volta.integracao.ts \
  tests/sessao-nas-actions.test.ts tests/acesso-nas-actions.test.ts
git commit -F "$SCRATCH/msg-li1-f3.txt"
```

---

### FASE 4 — O LinkedIn das contas na Configuração

**Arquivos:** `lib/convites.ts`, `app/setup/actions.ts`, `app/setup/linkedin-das-contas.tsx` (novo), `app/setup/page.tsx`, `tests/linkedin-token-fora-do-cliente.test.ts` (novo), `tests/convites.test.ts`, `testes-dom/linkedin-no-setup.dom.tsx` (novo), `testes-integracao/linkedin-acoes.integracao.ts` (novo), `testes-integracao/contas-por-login.integracao.ts`.

- [ ] **Passo 1: os testes**

Crie `tests/linkedin-token-fora-do-cliente.test.ts`:

```ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// A AUTORIZAÇÃO DO LINKEDIN NUNCA VAI AO NAVEGADOR (docs/specs/2026-11-06-linkedin-no-perfil.md, §2), no molde
// do achado 60 (tests/bonus-arte-paginas.test.ts): a `linkedin_conexoes` guarda o token em texto puro, e só
// lib/linkedin-conexoes.ts a lê. As telas recebem o resumo (o nome e o vencimento), e nada mais.
//
// ESTE ARQUIVO VALE PARA O QUE AINDA NÃO EXISTE: ele procura os arquivos em vez de uma lista. Um componente de
// cliente novo que importe o repositório, ou um ponto novo que leia a linha inteira, faz ele cair.

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const ler = (rel: string) => readFileSync(join(RAIZ, rel), "utf8");

function arquivosDe(pasta: string): string[] {
  const saida: string[] = [];
  const andar = (abs: string) => {
    for (const nome of readdirSync(abs)) {
      const caminho = join(abs, nome);
      if (statSync(caminho).isDirectory()) andar(caminho);
      else if (/\.tsx?$/.test(nome)) saida.push(relative(RAIZ, caminho).split(sep).join("/"));
    }
  };
  andar(join(RAIZ, pasta));
  return saida.sort();
}

const CODIGO = [...arquivosDe("app"), ...arquivosDe("lib")];
const ehCliente = (fonte: string) => /^\s*(?:\/\/[^\n]*\n\s*)*["']use client["']/.test(fonte);
const IMPORTA_O_REPOSITORIO = /from\s+["'](?:@\/lib\/|\.{1,2}\/(?:[\w.-]+\/)*)linkedin-conexoes["']/;
const IMPORTA_O_CLIENTE = /from\s+["'](?:@\/lib\/|\.{1,2}\/(?:[\w.-]+\/)*)linkedin["']/;

describe("a autorização do LinkedIn fica no servidor", () => {
  it("nenhum componente de cliente importa o repositório da conexão nem o cliente do LinkedIn", () => {
    const clientes = CODIGO.filter((rel) => ehCliente(ler(rel)));
    expect(clientes.length).toBeGreaterThan(0);
    const errados = clientes.filter((rel) => IMPORTA_O_REPOSITORIO.test(ler(rel)) || IMPORTA_O_CLIENTE.test(ler(rel)));
    expect(errados).toEqual([]);
  });

  it("só estes arquivos importam o repositório da conexão", () => {
    const importam = CODIGO.filter((rel) => IMPORTA_O_REPOSITORIO.test(ler(rel)));
    expect(importam).toEqual(["app/setup/actions.ts", "app/setup/page.tsx", "lib/convites-repositorio.ts"]);
  });

  it("a linha inteira, com o token, só sai pela conexaoDaConta, e nesta parte ninguém a chama", () => {
    // Na parte 2, o dreno da publicação entra nesta lista: é o único que precisa da autorização.
    const chamam = CODIGO.filter((rel) => rel !== "lib/linkedin-conexoes.ts" && /\bconexaoDaConta\b/.test(ler(rel)));
    expect(chamam).toEqual([]);
  });

  it("a Configuração lê só os resumos, e o componente de cliente dela não fala de token", () => {
    const pagina = ler("app/setup/page.tsx");
    expect(pagina).toMatch(/\bresumosDasConexoes\(/);
    const tela = ler("app/setup/linkedin-das-contas.tsx");
    expect(ehCliente(tela)).toBe(true);
    expect(tela).not.toMatch(/access_token|accessToken|pessoa_id/);
  });
});
```

Em `tests/convites.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/convites.test.ts b/tests/convites.test.ts
index 620b160..e709663 100644
--- a/tests/convites.test.ts
+++ b/tests/convites.test.ts
@@ -206,4 +206,14 @@ describe("a linha do convite na etapa 6", () => {
       linhaDoConvite({ ...usado, ultimo_erro: "a Meta recusou", ultimo_erro_em: erro }, AGORA, quando).aviso
     ).toBeNull();
   });
+
+  // O CONVITE DO LINKEDIN (docs/specs/2026-11-06-linkedin-no-perfil.md, §3) aparece na mesma lista, e o
+  // detalhe diz a rede. O do Instagram fica como sempre, com a rede dita ou não.
+  it("o convite do LinkedIn diz a rede no detalhe", () => {
+    const doLinkedin = { ...base, para_quem: "@drmarcus", rede: "linkedin" as const };
+    expect(linhaDoConvite(doLinkedin, AGORA, quando).detalhe).toBe("LinkedIn · vence em [11-04T15:00]");
+    const usado = { ...doLinkedin, usado_em: new Date(AGORA - 60_000), conta_conectada: "178", conta_username: "drmarcus" };
+    expect(linhaDoConvite(usado, AGORA, quando).detalhe).toBe("LinkedIn · @drmarcus, em [11-03T14:59]");
+    expect(linhaDoConvite({ ...base, rede: "instagram" as const }, AGORA, quando).detalhe).toBe("vence em [11-04T15:00]");
+  });
 });
```

Crie `testes-dom/linkedin-no-setup.dom.tsx`:

```tsx
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// O `vi.mock` sobe para o topo do arquivo, antes de qualquer `const`: as duas ações de mentira nascem no
// `vi.hoisted`, que sobe junto.
const { gerarConviteDoLinkedin, desconectarLinkedin } = vi.hoisted(() => ({
  gerarConviteDoLinkedin: vi.fn(),
  desconectarLinkedin: vi.fn(),
}));
vi.mock("@/app/setup/actions", () => ({ gerarConviteDoLinkedin, desconectarLinkedin }));

import LinkedinDasContas, { type LinhaDoLinkedin } from "@/app/setup/linkedin-das-contas";

// O LINKEDIN DAS CONTAS NA CONFIGURAÇÃO (docs/specs/2026-11-06-linkedin-no-perfil.md, §7; a parte 1, a
// conexão): cada conta com o LinkedIn conectado, perto de vencer, vencido ou ausente; o convite, cujo link
// aparece uma vez; e o "Desconectar", que diz o que ele faz e o que ele não faz (achado 206). As ações são de
// mentira: o que elas gravam é conferido em testes-integracao/linkedin-acoes.integracao.ts.
const LINHAS: LinhaDoLinkedin[] = [
  { contaId: "1", arroba: "@conta_valida", conexao: { nome: "Dra. Ana Souza", estado: "valido", frase: "vence em 45 dias" } },
  { contaId: "2", arroba: "@conta_perto", conexao: { nome: "Dr. Bruno Lima", estado: "perto", frase: "vence em 3 dias" } },
  { contaId: "3", arroba: "@conta_vencida", conexao: { nome: "Dra. Carla", estado: "vencido", frase: "venceu" } },
  { contaId: "4", arroba: "@conta_sem", conexao: null },
];

const linhaDa = (arroba: string) => screen.getByText(arroba).closest("li")! as HTMLElement;

beforeEach(() => {
  gerarConviteDoLinkedin.mockReset();
  desconectarLinkedin.mockReset();
});

describe("o LinkedIn de cada conta", () => {
  it("diz como cada conta está: conectada, perto de vencer, vencida ou sem LinkedIn", () => {
    render(<LinkedinDasContas linhas={LINHAS} chavesOk />);
    expect(linhaDa("@conta_valida").textContent).toContain("LinkedIn conectado como Dra. Ana Souza, vence em 45 dias.");
    expect(linhaDa("@conta_valida").textContent).not.toContain("Falta pouco");
    expect(linhaDa("@conta_perto").textContent).toContain("LinkedIn conectado como Dr. Bruno Lima, vence em 3 dias.");
    expect(linhaDa("@conta_perto").textContent).toContain("Falta pouco para vencer: mande um convite novo.");
    expect(linhaDa("@conta_vencida").textContent).toContain("O LinkedIn de Dra. Carla venceu. Mande um convite novo.");
    expect(linhaDa("@conta_sem").textContent).toContain("Sem LinkedIn.");
  });

  it("o Desconectar só aparece na conta que tem LinkedIn", () => {
    render(<LinkedinDasContas linhas={LINHAS} chavesOk />);
    for (const arroba of ["@conta_valida", "@conta_perto", "@conta_vencida"]) {
      expect(within(linhaDa(arroba)).getByRole("button", { name: "Desconectar" })).toBeTruthy();
    }
    expect(within(linhaDa("@conta_sem")).queryByRole("button", { name: "Desconectar" })).toBeNull();
  });

  it("o convite mostra o link uma vez, com o copiar e o aviso de que ele não volta", async () => {
    gerarConviteDoLinkedin.mockResolvedValue({ link: "https://painel.exemplo.com.br/convite/xyz", paraQuem: "@conta_sem" });
    render(<LinkedinDasContas linhas={LINHAS} chavesOk />);
    await act(async () => {
      fireEvent.click(within(linhaDa("@conta_sem")).getByRole("button", { name: "Convidar a conectar o LinkedIn" }));
    });
    expect(gerarConviteDoLinkedin).toHaveBeenCalledTimes(1);
    expect((gerarConviteDoLinkedin.mock.calls[0][1] as FormData).get("conta")).toBe("4");
    const linha = linhaDa("@conta_sem");
    expect(within(linha).getByText("https://painel.exemplo.com.br/convite/xyz")).toBeTruthy();
    expect(within(linha).getByRole("button", { name: "Copiar" })).toBeTruthy();
    expect(linha.textContent).toContain("Este link aparece só agora. Se ele se perder, gere outro.");
    // Só na linha que pediu.
    expect(linhaDa("@conta_valida").textContent).not.toContain("convite/xyz");
  });

  it("mostra o erro da ação, sem link", async () => {
    gerarConviteDoLinkedin.mockResolvedValue({ erro: "Esta conta não está conectada neste painel." });
    render(<LinkedinDasContas linhas={LINHAS} chavesOk />);
    await act(async () => {
      fireEvent.click(within(linhaDa("@conta_valida")).getByRole("button", { name: "Convidar a conectar o LinkedIn" }));
    });
    expect(within(linhaDa("@conta_valida")).getByRole("alert").textContent).toBe("Esta conta não está conectada neste painel.");
  });

  it("sem as chaves do app, diz o motivo e desliga o convite, e o Desconectar continua", () => {
    render(<LinkedinDasContas linhas={LINHAS} chavesOk={false} />);
    expect(screen.getByText(/O LinkedIn está desligado: faltam as chaves do app do LinkedIn/)).toBeTruthy();
    for (const botao of screen.getAllByRole("button", { name: "Convidar a conectar o LinkedIn" })) {
      expect((botao as HTMLButtonElement).disabled).toBe(true);
    }
    expect((within(linhaDa("@conta_valida")).getByRole("button", { name: "Desconectar" }) as HTMLButtonElement).disabled).toBe(
      false
    );
  });
});

describe("o Desconectar (achado 206)", () => {
  it("pede confirmação, dizendo que o painel apaga a autorização e que, no LinkedIn, ela vence sozinha", () => {
    render(<LinkedinDasContas linhas={LINHAS} chavesOk />);
    const linha = linhaDa("@conta_valida");
    fireEvent.click(within(linha).getByRole("button", { name: "Desconectar" }));
    expect(linha.textContent).toContain(
      "O painel apaga a autorização do LinkedIn de Dra. Ana Souza e para de usá-la. No LinkedIn, ela vence sozinha em até 60 dias."
    );
    expect(desconectarLinkedin).not.toHaveBeenCalled();
    fireEvent.click(within(linha).getByRole("button", { name: "Cancelar" }));
    expect(linha.textContent).not.toContain("O painel apaga a autorização");
  });

  it("o \"Sim, desconectar\" manda a conta da linha", async () => {
    render(<LinkedinDasContas linhas={LINHAS} chavesOk />);
    const linha = linhaDa("@conta_perto");
    fireEvent.click(within(linha).getByRole("button", { name: "Desconectar" }));
    await act(async () => {
      fireEvent.click(within(linha).getByRole("button", { name: "Sim, desconectar" }));
    });
    expect(desconectarLinkedin).toHaveBeenCalledTimes(1);
    expect((desconectarLinkedin.mock.calls[0][0] as FormData).get("conta")).toBe("2");
  });
});
```

Crie `testes-integracao/linkedin-acoes.integracao.ts`:

```ts
// AS AÇÕES DO LINKEDIN NA CONFIGURAÇÃO (docs/specs/2026-11-06-linkedin-no-perfil.md, §3 e §7; a parte 1, a
// conexão): gerar o convite do LinkedIn de uma conta e desconectar, com a sessão do administrador de teste,
// contra o banco descartável. Que o login comum não chega a nenhuma das duas é conferido em
// testes-integracao/contas-por-login.integracao.ts, com as outras ações da Configuração.
//
// Nenhuma das duas fala com o LinkedIn. Valores inventados: nenhuma credencial de verdade entra em teste.
import { createHash } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { bancoDescartavel } from "./harness";
import { comoNumaRequisicaoComSessao } from "./semear-requisicao";

type ModuloAcoes = typeof import("@/app/setup/actions");

const banco = bancoDescartavel();
const q = (texto: string, params: unknown[] = []) =>
  banco.db().sql().query(texto, params) as Promise<Record<string, unknown>[]>;

const APP_URL = "https://painel.exemplo.com.br";
const CONTA = "17800000000024401";

let acoes: ModuloAcoes;

beforeAll(async () => {
  acoes = await import("@/app/setup/actions");
  await q(`insert into config (id) values (1) on conflict do nothing`);
});

beforeEach(async () => {
  vi.unstubAllEnvs();
  vi.stubEnv("LINKEDIN_CLIENT_ID", "idDoAppDoLinkedinDeTeste");
  vi.stubEnv("LINKEDIN_CLIENT_SECRET", "segredo-do-app-do-linkedin-de-teste");
  // A URL do app vem do ambiente antes do banco (`envAppUrl`, lib/app-url.ts).
  vi.stubEnv("APP_URL", "");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
  vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
  vi.stubEnv("VERCEL_ENV", "");
  vi.stubEnv("VERCEL_BRANCH_URL", "");
  await q(`delete from linkedin_conexoes`);
  await q(`delete from convites_de_conexao`);
  await q(`delete from accounts where ig_user_id = $1`, [CONTA]);
  await q(`insert into accounts (ig_user_id, username, access_token) values ($1, 'conta_da_ana', 'ig-token-de-teste')`, [CONTA]);
  await q(`update config set app_url = $1 where id = 1`, [APP_URL]);
});

const form = (campos: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
};

const gerar = (conta: string) =>
  comoNumaRequisicaoComSessao("/setup", () => acoes.gerarConviteDoLinkedin(null, form({ conta })));

describe("gerar o convite do LinkedIn de uma conta", () => {
  it("grava o convite do LinkedIn da conta, para o @ dela, e devolve o link no endereço canônico, uma vez", async () => {
    const { valor, tags } = await gerar(CONTA);
    expect(valor && "link" in valor).toBe(true);
    const { link, paraQuem } = valor as { link: string; paraQuem: string };
    expect(paraQuem).toBe("@conta_da_ana");
    expect(link).toMatch(new RegExp(`^${APP_URL}/convite/[A-Za-z0-9_-]{43}$`));
    const codigo = link.slice(link.lastIndexOf("/") + 1);
    const [linha] = await q(`select * from convites_de_conexao`);
    expect(linha).toMatchObject({ rede: "linkedin", conta_alvo: CONTA, para_quem: "@conta_da_ana", usado_em: null });
    expect(linha.codigo_hash).toBe(createHash("sha256").update(codigo).digest("hex"));
    expect(tags.length).toBeGreaterThan(0);
  });

  it("no preview, o link é o do endereço da branch, o mesmo da volta", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_BRANCH_URL", "metodochat-git-linkedin-conexao-time.vercel.app");
    const { valor } = await gerar(CONTA);
    expect((valor as { link: string }).link).toMatch(
      /^https:\/\/metodochat-git-linkedin-conexao-time\.vercel\.app\/convite\/[A-Za-z0-9_-]{43}$/
    );
  });

  it("a conta que não está no painel não gera convite", async () => {
    for (const conta of ["17800000000029999", ""]) {
      const { valor } = await gerar(conta);
      expect(valor).toEqual({ erro: "Esta conta não está conectada neste painel." });
    }
    expect(await q(`select 1 from convites_de_conexao`)).toHaveLength(0);
  });

  it("sem as chaves do app nas variáveis, não gera, e diz o motivo", async () => {
    vi.stubEnv("LINKEDIN_CLIENT_ID", "");
    const { valor } = await gerar(CONTA);
    expect(valor).toEqual({
      erro: "O LinkedIn está desligado: faltam as chaves do app do LinkedIn nas variáveis da Vercel.",
    });
    expect(await q(`select 1 from convites_de_conexao`)).toHaveLength(0);
  });

  it("o @ comprido é cortado nos 60 caracteres do \"para quem\"", async () => {
    await q(`update accounts set username = $2 where ig_user_id = $1`, [CONTA, "x".repeat(70)]);
    const { valor } = await gerar(CONTA);
    expect((valor as { paraQuem: string }).paraQuem).toBe(`@${"x".repeat(59)}`);
  });
});

describe("desconectar o LinkedIn de uma conta", () => {
  it("apaga a conexão da conta, e a conta fica", async () => {
    await q(
      `insert into linkedin_conexoes (account_id, pessoa_id, nome, access_token, expira_em)
       values ($1, 'p', 'Dra. Ana Souza', 't', now() + interval '60 days')`,
      [CONTA]
    );
    await comoNumaRequisicaoComSessao("/setup", () => acoes.desconectarLinkedin(form({ conta: CONTA })));
    expect(await q(`select 1 from linkedin_conexoes where account_id = $1`, [CONTA])).toHaveLength(0);
    expect(await q(`select 1 from accounts where ig_user_id = $1`, [CONTA])).toHaveLength(1);
  });
});
```

Em `testes-integracao/contas-por-login.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/contas-por-login.integracao.ts b/testes-integracao/contas-por-login.integracao.ts
index 3b1e5ad..3f15964 100644
--- a/testes-integracao/contas-por-login.integracao.ts
+++ b/testes-integracao/contas-por-login.integracao.ts
@@ -303,11 +303,12 @@ async function tamanhos(): Promise<Record<string, number>> {
   return saida;
 }
 
-/** O que as actions da Configuração mexeriam: a `config`, os convites e o tamanho de cada tabela. */
+/** O que as actions da Configuração mexeriam: a `config`, os convites, o LinkedIn e o tamanho de cada tabela. */
 async function estadoDaConfiguracao() {
   return {
     config: await q(`select * from config where id = 1`),
     convites: await q(`select * from convites_de_conexao order by criado_em, id`),
+    linkedin: await q(`select * from linkedin_conexoes order by account_id`),
     tamanhos: await tamanhos(),
   };
 }
@@ -315,8 +316,24 @@ async function estadoDaConfiguracao() {
 describe("a Configuração manda o login comum para o início, sem mudar nada", () => {
   let conviteId = "";
 
+  // O LINKEDIN (docs/specs/2026-11-06-linkedin-no-perfil.md, §2): a conta A, que o comum vê, já tem LinkedIn, e
+  // as chaves do app estão no ambiente. Assim, sem a conferência do administrador, o convite seria gravado e a
+  // conexão seria apagada, e a foto acusaria.
   beforeAll(async () => {
     conviteId = (await convites.criarConvite("convite do administrador")).id;
+    process.env.LINKEDIN_CLIENT_ID = "idDoAppDoLinkedinDeTeste";
+    process.env.LINKEDIN_CLIENT_SECRET = "segredo-do-app-do-linkedin-de-teste";
+    await q(
+      `insert into linkedin_conexoes (account_id, pessoa_id, nome, access_token, expira_em)
+       values ($1, 'p', 'Dra. Ana Souza', 't', now() + interval '60 days')
+       on conflict (account_id) do nothing`,
+      [CONTA_A]
+    );
+  });
+
+  afterAll(() => {
+    delete process.env.LINKEDIN_CLIENT_ID;
+    delete process.env.LINKEDIN_CLIENT_SECRET;
   });
 
   // A `config` VOLTA AO MESMO PONTO antes de cada caso: com o App ID e a URL do app (a Meta falsa), e sem
@@ -343,10 +360,12 @@ describe("a Configuração manda o login comum para o início, sem mudar nada",
     ["salvarPerguntasDeAbertura", () => setup.salvarPerguntasDeAbertura(form({ conta: CONTA_A }))],
     ["gerarConvite", () => setup.gerarConvite(null, form({ para_quem: "Dr. Comum" }))],
     ["cancelarConvite", () => setup.cancelarConvite(form({ id: conviteId }))],
+    ["gerarConviteDoLinkedin", () => setup.gerarConviteDoLinkedin(null, form({ conta: CONTA_A }))],
+    ["desconectarLinkedin", () => setup.desconectarLinkedin(form({ conta: CONTA_A }))],
   ];
 
-  it("a lista tem as 5 actions da Configuração e os 2 convites", () => {
-    expect(ACOES).toHaveLength(7);
+  it("a lista tem as 5 actions da Configuração, os 2 convites e as 2 do LinkedIn", () => {
+    expect(ACOES).toHaveLength(9);
   });
 
   it.each(ACOES)("%s vai para /, e nada muda", async (_nome, acao) => {
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
env -u CLAUDECODE -u AI_AGENT npx vitest run tests/linkedin-token-fora-do-cliente.test.ts tests/convites.test.ts
env -u CLAUDECODE -u AI_AGENT npx vitest run --config vitest.dom.config.ts testes-dom/linkedin-no-setup.dom.tsx
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" \
  npx vitest run --config vitest.integracao.config.ts \
  testes-integracao/linkedin-acoes.integracao.ts testes-integracao/contas-por-login.integracao.ts
```

Esperado:
- nos puros, "Tests 3 failed | 18 passed (21)". Caem "o convite do LinkedIn diz a rede no detalhe", "só estes arquivos importam o repositório da conexão" e "a Configuração lê só os resumos, e o componente de cliente dela não fala de token";
- na tela, o arquivo falha antes dos casos: `Failed to resolve import "@/app/setup/linkedin-das-contas"`;
- na integração, `ALVO: banco de TESTE` e "Tests 8 failed | 35 passed (43)": os 6 casos de `linkedin-acoes` e, no do login comum, "gerarConviteDoLinkedin vai para /, e nada muda" e "desconectarLinkedin vai para /, e nada muda".

- [ ] **Passo 3: o código**

Em `lib/convites.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/convites.ts b/lib/convites.ts
index 09b2d33..5b62e73 100644
--- a/lib/convites.ts
+++ b/lib/convites.ts
@@ -130,6 +130,8 @@ export type ConviteParaLinha = DatasDoConvite & {
   conta_username: string | null;
   ultimo_erro: string | null;
   ultimo_erro_em: Date | string | null;
+  /** A rede do convite (a 024); sem ela, o do Instagram. */
+  rede?: Rede;
 };
 
 export type LinhaDoConvite = {
@@ -144,7 +146,7 @@ export type LinhaDoConvite = {
 /**
  * Uma linha da lista da etapa 6. `quando` formata a data (no painel, o `fmtDate` de lib/format.ts). O
  * erro de uma tentativa ANTES da que deu certo não vira aviso no convite usado: ali, só a assinatura que
- * falhou depois da conexão importa.
+ * falhou depois da conexão importa. O convite do LinkedIn diz a rede no começo do detalhe.
  */
 export function linhaDoConvite(
   c: ConviteParaLinha,
@@ -153,13 +155,14 @@ export function linhaDoConvite(
 ): LinhaDoConvite {
   const estado = estadoDoConvite(c, agoraMs);
   const detalhe =
-    estado === "pendente"
+    (c.rede === "linkedin" ? "LinkedIn · " : "") +
+    (estado === "pendente"
       ? `vence em ${quando(c.expira_em)}`
       : estado === "usado"
         ? `@${c.conta_username ?? c.conta_conectada}, em ${quando(c.usado_em)}`
         : estado === "vencido"
           ? `venceu em ${quando(c.expira_em)}`
-          : `cancelado em ${quando(c.cancelado_em)}`;
+          : `cancelado em ${quando(c.cancelado_em)}`);
   let aviso: string | null = null;
   if (c.ultimo_erro && estado === "usado") {
     if (c.ultimo_erro.startsWith(PREFIXO_DA_ASSINATURA)) {
```

Em `app/setup/actions.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/setup/actions.ts b/app/setup/actions.ts
index 13d857e..cfcb010 100644
--- a/app/setup/actions.ts
+++ b/app/setup/actions.ts
@@ -14,8 +14,16 @@ import {
   type LinhaDoFormulario,
 } from "./portas";
 import { exigirAdministrador, exigirSessao } from "@/lib/exigir-sessao";
-import { FRASE_DO_PARA_QUEM_INVALIDO, paraQuemDoFormulario, type EstadoDoGerar } from "@/lib/convites";
+import {
+  FRASE_DO_PARA_QUEM_INVALIDO,
+  LIMITE_DO_PARA_QUEM,
+  paraQuemDoFormulario,
+  type EstadoDoGerar,
+} from "@/lib/convites";
 import { cancelarConvite as cancelarNoBanco, criarConvite } from "@/lib/convites-repositorio";
+import { podeVerConta } from "@/lib/acesso";
+import { apagarConexao } from "@/lib/linkedin-conexoes";
+import { ambienteDaVercel, baseDoPainelParaOLinkedin, credenciaisDoLinkedin } from "@/lib/linkedin";
 
 // TODA ACTION DESTE ARQUIVO É DO ADMINISTRADOR (docs/specs/2026-11-05-contas-por-login.md, seção 3: o login
 // comum faz tudo nas contas dele, menos a Configuração e os logins). Cada uma chama `exigirAdministrador`
@@ -366,3 +374,43 @@ export async function cancelarConvite(formData: FormData): Promise<void> {
   await cancelarNoBanco(String(formData.get("id") ?? ""));
   revalidatePath("/setup");
 }
+
+// O LINKEDIN DE UMA CONTA (docs/specs/2026-11-06-linkedin-no-perfil.md, §3 e §7; a parte 1, a conexão). O
+// administrador gera o convite do LinkedIn de uma conta do painel; o dono do perfil abre o link e autoriza com
+// o login dele, e a conexão vai para essa conta (a conta-alvo do convite). O link aparece UMA VEZ, como o do
+// Instagram, e nasce no endereço do painel para o LinkedIn (`baseDoPainelParaOLinkedin`): o canônico na
+// produção, o da branch no preview, o mesmo da volta.
+//
+// A CONTA VEM DO FORMULÁRIO, então ela é conferida pela regra (`podeVerConta`, lib/acesso.ts): para o
+// administrador, que ela existe no painel. Sem as chaves do app nas variáveis da Vercel (§8), não gera.
+export async function gerarConviteDoLinkedin(_anterior: EstadoDoGerar, formData: FormData): Promise<EstadoDoGerar> {
+  await exigirSessao();
+  const login = await exigirAdministrador();
+  if (!credenciaisDoLinkedin()) {
+    return { erro: "O LinkedIn está desligado: faltam as chaves do app do LinkedIn nas variáveis da Vercel." };
+  }
+  const contaId = String(formData.get("conta") ?? "");
+  const conta = (await podeVerConta(login, contaId)) ? await getAccount(contaId) : null;
+  if (!conta) return { erro: "Esta conta não está conectada neste painel." };
+  // O "para quem" é o @ da conta, cortado como o `char_length` da 021 conta: caractere, e não pedaço de UTF-16.
+  const paraQuem = Array.from(`@${conta.username ?? conta.ig_user_id}`).slice(0, LIMITE_DO_PARA_QUEM).join("");
+  const config = await getConfig();
+  const h = await headers();
+  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
+  const proto = h.get("x-forwarded-proto") ?? "https";
+  const base = baseDoPainelParaOLinkedin(ambienteDaVercel(), canonicalAppUrl(config.app_url, host ? `${proto}://${host}` : ""));
+  const { codigo } = await criarConvite(paraQuem, { rede: "linkedin", contaAlvo: conta.ig_user_id });
+  revalidatePath("/setup");
+  return { link: `${base}/convite/${codigo}`, paraQuem };
+}
+
+// O "DESCONECTAR" APAGA A AUTORIZAÇÃO DO PAINEL, E SÓ (achado 206): o LinkedIn não tem como revogar a
+// autorização de fora (a documentação não traz endpoint para isso), então ela continua valendo lá até vencer,
+// em até 60 dias, sem ninguém com cópia. A tela diz isso antes de confirmar.
+export async function desconectarLinkedin(formData: FormData): Promise<void> {
+  await exigirSessao();
+  const login = await exigirAdministrador();
+  const contaId = String(formData.get("conta") ?? "");
+  if (await podeVerConta(login, contaId)) await apagarConexao(contaId);
+  revalidatePath("/setup");
+}
```

Crie `app/setup/linkedin-das-contas.tsx`:

```tsx
"use client";
import { useActionState, useState } from "react";
import CopyField from "./copy-field";
import { desconectarLinkedin, gerarConviteDoLinkedin } from "./actions";
import type { EstadoDoGerar } from "@/lib/convites";
import { alertError, btnPrimary, btnSecondary, muted } from "../ui";

// O LINKEDIN DAS CONTAS NA CONFIGURAÇÃO (docs/specs/2026-11-06-linkedin-no-perfil.md, §7; a parte 1, a
// conexão). Cada conta do painel pode ter o LinkedIn pessoal do dono, conectado por ele mesmo pelo link de
// convite. A página (./page.tsx) manda só o nome e o vencimento já decidido (`vencimentoDoLinkedin`), e NUNCA a
// autorização: tests/linkedin-token-fora-do-cliente.test.ts prende isso.

export type LinhaDoLinkedin = {
  contaId: string;
  arroba: string;
  conexao: { nome: string; estado: "valido" | "perto" | "vencido"; frase: string } | null;
};

function LinhaDaConta({ linha, chavesOk }: { linha: LinhaDoLinkedin; chavesOk: boolean }) {
  const [estado, gerar, gerando] = useActionState<EstadoDoGerar, FormData>(gerarConviteDoLinkedin, null);
  const [confirmando, setConfirmando] = useState(false);
  const c = linha.conexao;

  return (
    <li className="space-y-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
      <p>
        <b>{linha.arroba}</b>
      </p>
      {!c ? (
        <p className={muted}>Sem LinkedIn.</p>
      ) : c.estado === "vencido" ? (
        <p>
          O LinkedIn de <b>{c.nome}</b> venceu. Mande um convite novo.
        </p>
      ) : (
        <>
          <p>
            LinkedIn conectado como <b>{c.nome}</b>, {c.frase}.
          </p>
          {c.estado === "perto" && <p className={`text-xs ${muted}`}>Falta pouco para vencer: mande um convite novo.</p>}
        </>
      )}
      <div className="flex flex-wrap gap-2">
        <form action={gerar}>
          <input type="hidden" name="conta" value={linha.contaId} />
          <button type="submit" disabled={!chavesOk || gerando} className={btnPrimary}>
            Convidar a conectar o LinkedIn
          </button>
        </form>
        {c && !confirmando && (
          <button type="button" onClick={() => setConfirmando(true)} className={btnSecondary}>
            Desconectar
          </button>
        )}
      </div>
      {c && confirmando && (
        // O QUE O DESCONECTAR FAZ, E O QUE ELE NÃO FAZ (achado 206): o LinkedIn não tem como revogar a autorização
        // de fora, então ela vence sozinha lá. A frase vem antes do botão que apaga.
        <div className="space-y-2 rounded-lg border border-zinc-200 p-2 dark:border-zinc-800">
          <p className="text-xs">
            O painel apaga a autorização do LinkedIn de {c.nome} e para de usá-la. No LinkedIn, ela vence sozinha em até
            60 dias.
          </p>
          <div className="flex gap-2">
            <form action={desconectarLinkedin}>
              <input type="hidden" name="conta" value={linha.contaId} />
              <button type="submit" className={btnPrimary}>
                Sim, desconectar
              </button>
            </form>
            <button type="button" onClick={() => setConfirmando(false)} className={btnSecondary}>
              Cancelar
            </button>
          </div>
        </div>
      )}
      {estado && "erro" in estado && (
        <p role="alert" className={alertError}>
          {estado.erro}
        </p>
      )}
      {estado && "link" in estado && (
        <div className="space-y-1">
          <CopyField label={`Link de convite do LinkedIn para ${estado.paraQuem}`} value={estado.link} />
          <p className={`text-xs ${muted}`}>Este link aparece só agora. Se ele se perder, gere outro.</p>
        </div>
      )}
    </li>
  );
}

export default function LinkedinDasContas({ linhas, chavesOk }: { linhas: LinhaDoLinkedin[]; chavesOk: boolean }) {
  return (
    <div className="space-y-3">
      <p className={`text-xs ${muted}`}>
        Cada conta pode ter o LinkedIn pessoal do dono, para publicar nele. Quem conecta é o próprio dono do perfil,
        pelo link de convite, com o login dele. A autorização vale 60 dias; para renovar, mande um convite novo.
      </p>
      {!chavesOk && (
        <p role="status" className={alertError}>
          O LinkedIn está desligado: faltam as chaves do app do LinkedIn (LINKEDIN_CLIENT_ID e LINKEDIN_CLIENT_SECRET)
          nas variáveis da Vercel.
        </p>
      )}
      <ul className="space-y-2">
        {linhas.map((l) => (
          <LinhaDaConta key={l.contaId} linha={l} chavesOk={chavesOk} />
        ))}
      </ul>
    </div>
  );
}
```

Em `app/setup/page.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/setup/page.tsx b/app/setup/page.tsx
index 9ea0bb6..21e6e18 100644
--- a/app/setup/page.tsx
+++ b/app/setup/page.tsx
@@ -18,6 +18,10 @@ import { fmtDate } from "@/lib/format";
 import { linhaDoConvite } from "@/lib/convites";
 import { listarConvites } from "@/lib/convites-repositorio";
 import Convites from "./convites";
+import { resumosDasConexoes } from "@/lib/linkedin-conexoes";
+import { credenciaisDoLinkedin } from "@/lib/linkedin";
+import { vencimentoDoLinkedin } from "@/lib/linkedin-publicacao";
+import LinkedinDasContas, { type LinhaDoLinkedin } from "./linkedin-das-contas";
 import { card, input, muted, btnPrimary, alertError, alertOk, link } from "../ui";
 
 export const dynamic = "force-dynamic";
@@ -114,6 +118,20 @@ export default async function SetupPage({
   // eslint-disable-next-line react-hooks/purity
   const agora = Date.now();
   const convites = (await listarConvites()).map((c) => linhaDoConvite(c, agora, fmtDate));
+  // O LINKEDIN DAS CONTAS (docs/specs/2026-11-06-linkedin-no-perfil.md, §7): só o resumo de cada conexão (o
+  // nome e o vencimento, já decidido aqui), nunca a autorização (tests/linkedin-token-fora-do-cliente.test.ts).
+  const resumosDoLinkedin = await resumosDasConexoes();
+  const linhasDoLinkedin: LinhaDoLinkedin[] = accounts.map((a) => {
+    const resumo = resumosDoLinkedin.get(a.ig_user_id);
+    const vencimento = resumo ? vencimentoDoLinkedin(resumo.expira_em, agora) : null;
+    return {
+      contaId: a.ig_user_id,
+      arroba: `@${a.username ?? a.ig_user_id}`,
+      conexao:
+        resumo && vencimento ? { nome: resumo.nome, estado: vencimento.estado, frase: vencimento.frase } : null,
+    };
+  });
+  const chavesDoLinkedin = credenciaisDoLinkedin() !== null;
 
   const inputCls = input;
 
@@ -227,6 +245,15 @@ export default async function SetupPage({
         <Convites linhas={convites} metaOk={metaOk} />
       </section>
 
+      {/* O LINKEDIN DAS CONTAS, À VISTA como o convite (achado 163): fora do <details> da instalação, que nasce
+          recolhido. Uma linha por conta do painel. */}
+      {connected && (
+        <section className={`p-5 ${card}`}>
+          <h3 className="mb-1 text-sm font-semibold text-zinc-800 dark:text-zinc-200">LinkedIn das contas</h3>
+          <LinkedinDasContas linhas={linhasDoLinkedin} chavesOk={chavesDoLinkedin} />
+        </section>
+      )}
+
       {/* A INSTALAÇÃO INTEIRA, RECOLHIDA QUANDO JÁ TERMINOU.
 
           Medido em 31/08/2026 nesta tela, em produção: 6341 px de página
```

O "Desconectar" pede confirmação e diz, com estas palavras, o que faz e o que não faz (achado 206): "O painel apaga a autorização do LinkedIn de <nome> e para de usá-la. No LinkedIn, ela vence sozinha em até 60 dias."

- [ ] **Passo 4: rodar e ver passar**

```bash
env -u CLAUDECODE -u AI_AGENT npx vitest run
env -u CLAUDECODE -u AI_AGENT npx vitest run --config vitest.dom.config.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" \
  npx vitest run --config vitest.integracao.config.ts \
  testes-integracao/linkedin-acoes.integracao.ts testes-integracao/contas-por-login.integracao.ts \
  testes-integracao/chave-fora-da-pagina.integracao.ts testes-integracao/logins-acoes.integracao.ts \
  testes-integracao/sessao-nas-acoes.integracao.ts testes-integracao/convite.integracao.ts \
  testes-integracao/convites-tabela.integracao.ts
npx tsc --noEmit
npx eslint lib/convites.ts app/setup tests/linkedin-token-fora-do-cliente.test.ts tests/convites.test.ts \
  testes-dom/linkedin-no-setup.dom.tsx testes-integracao/linkedin-acoes.integracao.ts \
  testes-integracao/contas-por-login.integracao.ts
```

Esperado: nos puros, "Test Files 150 passed (150)" e "Tests 3653 passed (3653)"; na tela, "Test Files 35 passed (35)" e "Tests 315 passed (315)"; na integração, `ALVO: banco de TESTE`, "Test Files 7 passed (7)" e "Tests 109 passed (109)"; e o `tsc` e o lint sem saída.

- [ ] **Passo 5: o commit**

A mensagem do commit, gravada em `$SCRATCH/msg-li1-f4.txt`:

```text
A Configuração mostra o LinkedIn de cada conta, gera o convite dele e desconecta dizendo o que o desconectar não faz
```

```bash
git add -- lib/convites.ts app/setup/actions.ts app/setup/linkedin-das-contas.tsx app/setup/page.tsx \
  tests/linkedin-token-fora-do-cliente.test.ts tests/convites.test.ts testes-dom/linkedin-no-setup.dom.tsx \
  testes-integracao/linkedin-acoes.integracao.ts testes-integracao/contas-por-login.integracao.ts
git commit -F "$SCRATCH/msg-li1-f4.txt"
```

---

### FASE 5 — A privacidade, a exclusão de dados e a fila na 025

**Arquivos:** `app/privacidade/page.tsx`, `app/exclusao-de-dados/page.tsx`, `testes-integracao/privacidade-linkedin.integracao.ts` (novo), `scripts/migrar.mjs`, `testes-integracao/conferencia-do-kind.integracao.ts`.

- [ ] **Passo 1: os testes**

Crie `testes-integracao/privacidade-linkedin.integracao.ts`:

```ts
// A POLÍTICA DE PRIVACIDADE E A EXCLUSÃO DE DADOS DIZEM O QUE O PAINEL GUARDA DO LINKEDIN
// (docs/specs/2026-11-06-linkedin-no-perfil.md, §7): o identificador, o nome e a autorização; para que serve;
// e como apagar. O app do LinkedIn pede o endereço da política, e as duas páginas falavam só do Instagram.
//
// O "DESCONECTAR" NÃO PROMETE O QUE NÃO FAZ (achado 206): o LinkedIn não tem como revogar a autorização de
// fora, então as duas páginas dizem que ela vence sozinha lá. As páginas são desenhadas em HTML de verdade,
// contra o banco descartável (elas leem a `config`).
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import { bancoDescartavel } from "./harness";

type ModuloPrivacidade = typeof import("@/app/privacidade/page");
type ModuloExclusao = typeof import("@/app/exclusao-de-dados/page");

bancoDescartavel();

let privacidade: ModuloPrivacidade;
let exclusao: ModuloExclusao;

beforeAll(async () => {
  privacidade = await import("@/app/privacidade/page");
  exclusao = await import("@/app/exclusao-de-dados/page");
});

// O `renderToStaticMarkup` troca as aspas por entidade; o texto lido é o que a pessoa vê.
const texto = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/\s+/g, " ");

describe("o LinkedIn nas páginas abertas de privacidade", () => {
  it("a política diz o que guarda do LinkedIn, para que serve e como apagar", async () => {
    const t = texto(renderToStaticMarkup(await privacidade.default()));
    expect(t).toContain("o identificador dele no LinkedIn, o nome e a autorização de publicar");
    expect(t).toContain("válida por 60 dias");
    expect(t).toContain("servem só para publicar no perfil dele o que for agendado no painel");
    expect(t).toContain('o administrador usa o "Desconectar" na Configuração, ou você faz o pedido de exclusão');
    expect(t).toContain("O aplicativo apaga a autorização e para de usá-la; no LinkedIn, ela vence sozinha em até 60 dias.");
  });

  it("a exclusão de dados diz o mesmo, sem prometer que o LinkedIn revoga", async () => {
    const t = texto(renderToStaticMarkup(await exclusao.default()));
    expect(t).toContain("o seu identificador no LinkedIn, o seu nome e a autorização de publicar");
    expect(t).toContain("no LinkedIn, ela vence sozinha em até 60 dias");
    expect(t).toContain('pelo "Desconectar" da Configuração');
    expect(t).not.toMatch(/revoga/i);
  });
});
```

Em `testes-integracao/conferencia-do-kind.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/conferencia-do-kind.integracao.ts b/testes-integracao/conferencia-do-kind.integracao.ts
index ec65d6f..371f075 100644
--- a/testes-integracao/conferencia-do-kind.integracao.ts
+++ b/testes-integracao/conferencia-do-kind.integracao.ts
@@ -2,10 +2,11 @@
 //
 // O `scripts/migrar.mjs` roda em todo deploy de produção e exige o texto EXATO de cada restrição conferida;
 // uma divergência derruba o build (saída 1). A entrega do LinkedIn alarga o `queue_kind_check` com o tipo
-// `publicacao_linkedin` (a migração 024), aplicada à mão antes do merge, como a 022 e a 023. Sem esta
-// preparação, todo deploy da `main` entre a 024 e o merge morreria no build.
+// `publicacao_linkedin` (a migração 025, na parte 2 da entrega; a 024 da parte 1 não toca a fila), aplicada à
+// mão antes do merge, como a 022 e a 023. Sem esta preparação, todo deploy da `main` entre a 025 e o merge
+// morreria no build.
 //
-// As duas formas aceitas são a da 010 (a de hoje) e a da 024. Qualquer terceira continua sendo divergência:
+// As duas formas aceitas são a da 010 (a de hoje) e a da 025. Qualquer terceira continua sendo divergência:
 // é o que este arquivo prova, rodando o script de verdade, como o build roda, contra um schema descartável.
 //
 // OS TEXTOS SÃO OS DO `pg_get_constraintdef`, medidos no banco de teste em 06/11/2026.
@@ -93,7 +94,7 @@ it("a forma da 010 confere", async () => {
   expect(r.saida).toContain(CONFERE);
 }, 120_000);
 
-it("a forma da 024, com o publicacao_linkedin, também confere", async () => {
+it("a forma da 025, com o publicacao_linkedin, também confere", async () => {
   await checkCom([...TIPOS_DA_010, "publicacao_linkedin"]);
   const r = await migrar("--a-mao");
   expect(r.codigo, r.saida).toBe(0);
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" \
  npx vitest run --config vitest.integracao.config.ts \
  testes-integracao/privacidade-linkedin.integracao.ts testes-integracao/conferencia-do-kind.integracao.ts
```

Esperado: `ALVO: banco de TESTE`, e "Tests 2 failed | 4 passed (6)": os dois casos da privacidade caem, e os 4 da conferência passam (lá só muda o número da migração nos comentários e no nome de um caso).

- [ ] **Passo 3: o código**

Em `app/privacidade/page.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/privacidade/page.tsx b/app/privacidade/page.tsx
index b904c92..65fcd5e 100644
--- a/app/privacidade/page.tsx
+++ b/app/privacidade/page.tsx
@@ -21,8 +21,22 @@ export default async function PrivacidadePage() {
       <p>
         Para funcionar, o aplicativo recebe da API oficial do Instagram (Meta Platforms) e armazena:
         o identificador público e o nome de usuário de quem interage com a conta conectada, o texto
-        de comentários e mensagens recebidos, e os horários dessas interações. Nenhum outro dado é
-        coletado. Não coletamos senhas, e-mails, telefones nem dados de navegação.
+        de comentários e mensagens recebidos, e os horários dessas interações. Nenhum outro dado do
+        Instagram é coletado. Não coletamos senhas, e-mails, telefones nem dados de navegação.
+      </p>
+
+      {/* O LINKEDIN (docs/specs/2026-11-06-linkedin-no-perfil.md, §7). O "Desconectar" diz o que faz e o que não
+          faz (achado 206): o LinkedIn não tem como revogar a autorização de fora, e ela vence sozinha lá. */}
+      <h2 className="titulo text-lg font-semibold text-zinc-900 dark:text-zinc-100">LinkedIn</h2>
+      <p>
+        Quando o dono de uma conta conecta o próprio LinkedIn pelo link de convite, o aplicativo guarda o
+        identificador dele no LinkedIn, o nome e a autorização de publicar que o LinkedIn entrega, válida por 60
+        dias. Esses dados servem só para publicar no perfil dele o que for agendado no painel.
+      </p>
+      <p>
+        Para apagar: o administrador usa o &quot;Desconectar&quot; na Configuração, ou você faz o pedido de
+        exclusão (abaixo). O aplicativo apaga a autorização e para de usá-la; no LinkedIn, ela vence sozinha em
+        até 60 dias.
       </p>
 
       <h2 className="titulo text-lg font-semibold text-zinc-900 dark:text-zinc-100">Uso dos dados</h2>
```

Em `app/exclusao-de-dados/page.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/exclusao-de-dados/page.tsx b/app/exclusao-de-dados/page.tsx
index 778b6e7..f171a04 100644
--- a/app/exclusao-de-dados/page.tsx
+++ b/app/exclusao-de-dados/page.tsx
@@ -22,6 +22,13 @@ export default async function ExclusaoDeDadosPage() {
         A exclusão é feita em até 7 dias e remove todos os registros associados ao seu usuário do
         banco de dados desta instância.
       </p>
+      {/* O LINKEDIN (docs/specs/2026-11-06-linkedin-no-perfil.md, §7; achado 206). */}
+      <p>
+        Se você conectou o seu LinkedIn a este aplicativo, ele guarda o seu identificador no LinkedIn, o seu
+        nome e a autorização de publicar, válida por 60 dias. A exclusão apaga esses dados, e o aplicativo para
+        de usar a autorização; no LinkedIn, ela vence sozinha em até 60 dias. O administrador também pode
+        apagá-los na hora, pelo &quot;Desconectar&quot; da Configuração.
+      </p>
     </article>
   );
 }
```

Em `scripts/migrar.mjs`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/scripts/migrar.mjs b/scripts/migrar.mjs
index 5842b9f..fc83e6f 100644
--- a/scripts/migrar.mjs
+++ b/scripts/migrar.mjs
@@ -830,10 +830,11 @@ const ESPERADAS_RESTRICOES = [
     // o `de` aponta para quem escreveu o texto que está no banco AGORA.
     //
     // E ELA ACEITA UMA SEGUNDA FORMA, a da entrega do LinkedIn
-    // (docs/specs/2026-11-06-linkedin-no-perfil.md, §0). A `024` alarga a
+    // (docs/specs/2026-11-06-linkedin-no-perfil.md, §0). A `025` (a parte 2 da
+    // entrega, a publicação; a `024` da parte 1 não toca a fila) alarga a
     // restrição com `publicacao_linkedin` e é aplicada à mão ANTES do merge
-    // daquela entrega, como a `022` e a `023`; sem `tambemAceitas`, todo deploy da
-    // `main` nessa janela morreria aqui. No merge do LinkedIn, a forma da `024`
+    // daquela parte, como a `022` e a `023`; sem `tambemAceitas`, todo deploy da
+    // `main` nessa janela morreria aqui. No merge da parte 2, a forma da `025`
     // vira a `definicao` desta linha, e a da `010` sai. Uma terceira forma
     // continua sendo divergência (testes-integracao/conferencia-do-kind.integracao.ts).
     // Os dois textos são os do `pg_get_constraintdef`, o segundo medido no banco
@@ -848,7 +849,7 @@ const ESPERADAS_RESTRICOES = [
       "'dm_manual'::text, 'dm_lote'::text, 'publicacao'::text])))",
     tambemAceitas: [
       {
-        de: "024 (a entrega do LinkedIn, aplicada à mão antes do merge dela)",
+        de: "025 (a fila do LinkedIn, parte 2 da entrega, aplicada à mão antes do merge dela)",
         definicao:
           "CHECK ((kind = ANY (ARRAY['private_reply'::text, 'comment_reply'::text, " +
           "'dm_welcome'::text, 'dm_link'::text, 'dm_reminder'::text, " +
```

No `scripts/migrar.mjs` só mudam comentários e o rótulo `de` da forma aceita (achado 205): o texto das duas definições é o mesmo, e a conferência é a mesma.

- [ ] **Passo 4: rodar e ver passar**

```bash
node --check scripts/migrar.mjs
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" \
  npx vitest run --config vitest.integracao.config.ts \
  testes-integracao/privacidade-linkedin.integracao.ts testes-integracao/conferencia-do-kind.integracao.ts \
  testes-integracao/registro-de-migracoes.integracao.ts
npx eslint app/privacidade app/exclusao-de-dados testes-integracao/privacidade-linkedin.integracao.ts \
  testes-integracao/conferencia-do-kind.integracao.ts
git grep -n "024" -- scripts/migrar.mjs testes-integracao/conferencia-do-kind.integracao.ts
```

Esperado: `ALVO: banco de TESTE`, "Test Files 3 passed (3)" e "Tests 13 passed (13)". O `git grep` só acha a 024 nas duas frases que dizem que ela não toca a fila.

- [ ] **Passo 5: o commit**

A mensagem do commit, gravada em `$SCRATCH/msg-li1-f5.txt`:

```text
A privacidade e a exclusão de dados dizem o que o painel guarda do LinkedIn, e a fila do LinkedIn passa a ser a 025
```

```bash
git add -- app/privacidade/page.tsx app/exclusao-de-dados/page.tsx testes-integracao/privacidade-linkedin.integracao.ts \
  scripts/migrar.mjs testes-integracao/conferencia-do-kind.integracao.ts
git commit -F "$SCRATCH/msg-li1-f5.txt"
```

---

### FASE 6 — A verificação inteira, as mutações e a guarda do diff

- [ ] **Passo 1: o verify**

```bash
env -u CLAUDECODE -u AI_AGENT npm run verify
git diff --name-only AGENTS.md   # vazio
git status --porcelain            # vazio
```

Esperado: saída 0; 150 arquivos e 3 653 casos puros; 35 e 315 de tela; "SEM VAZAMENTO em A nem em C, nas duas varreduras."; "MIGRAÇÃO PULADA"; o build do Next 16.4.3.

- [ ] **Passo 2: a integração inteira, uma rodada só**

```bash
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npm run test:integracao
```

Esperado: saída 0; `ALVO: banco de TESTE`; "nenhum schema teste_tmp_* no banco" antes e depois; 72 arquivos, 835 passaram e 8 pularam.

- [ ] **Passo 3: as mutações (Apêndice A)**

```bash
node <pasta>/mutar-li1.mjs --conferir   # 16 "ÚNICO"
node <pasta>/mutar-li1.mjs
```

Esperado: as 16 como "MORTA", e "16 mutações, 0 ruins; árvore no fim: limpa".

- [ ] **Passo 4: a guarda do diff**

```bash
git diff --stat d23738b HEAD -- . ':!docs'
git diff --name-only d23738b HEAD -- docs
```

Esperado: no primeiro, os 36 arquivos do mapa, e mais nenhum: "36 files changed, 2048 insertions(+), 46 deletions(-)". No segundo, só a spec e este plano. O patch-id de cada fase (`git show <commit> | git patch-id --stable`) tem de bater com o do ensaio: `9385580699d5`, `bf25db6ef500`, `6f01956a2251`, `0acfd37c3f10` e `fc73c5e36887`.

---

### FASE 7 — A 024 na produção, o push, a prova no preview, o PR e o deploy

Cada passo que sai da máquina, ou que grava, tem o OK do Eduardo pela caixa, a hora mandada à auditoria antes e o "pode" dela.

- [ ] **Passo 1: a 024 na produção, à mão, com o OK do Eduardo**

Antes: a auditoria tira a base da `linkedin_conexoes` e dos convites pelo lado dela (só contagens, nunca o token; nota 5). Depois do "pode":

```bash
node --env-file="<raiz do repositório principal>/.env.local" scripts/migrar.mjs --a-mao            # o ensaio a seco
node --env-file="<raiz do repositório principal>/.env.local" scripts/migrar.mjs --aplicar --a-mao  # grava
node --env-file="<raiz do repositório principal>/.env.local" scripts/migrar.mjs --a-mao            # nada a aplicar
```

Esperado: o ensaio a seco mostra só `►    024-linkedin-conexoes.sql`, com os comandos dela; a aplicação grava a 024 no registro; o terceiro diz "Nada a aplicar". Todas as conferências do script continuam "CONFERIDO". A auditoria lê a base depois: a tabela nova vazia, e os convites de hoje como `instagram`, sem conta-alvo.

Por que a `main` aguenta a 024 antes do merge: o código dela não lê a tabela nova nem as colunas novas; o convite que ela grava sem dizer a rede ganha `instagram`, sem conta-alvo, e passa no check; e o `scripts/migrar.mjs` da `main` não confere nada da 021 em diante, então o build só imprime a 024 como "está no registro e NÃO está em migrations/", sem falhar (medido pela auditoria no `d23738b`).

- [ ] **Passo 2: o push da branch, com o OK do Eduardo**

```bash
git ls-remote origin refs/heads/linkedin-conexao   # vazio; se não estiver, pare
git push -u origin refs/heads/linkedin-conexao:refs/heads/linkedin-conexao
```

No log do build do preview, confira: o commit, nenhum aviso do Node 26, "Detected Next.js version: 16.4.3", "MIGRAÇÃO PULADA" e a rota nova (`/api/oauth/linkedin/callback`). No deployment, meça o endereço da branch (o `alias` do `get_deployment`). Ele deve ser `metodochat-git-linkedin-conexao-moraesvannuchi-debugs-projects.vercel.app`, pelo padrão medido no preview das contas (`metodochat-git-contas-por-login-moraesvannuchi-debugs-projects.vercel.app`).

- [ ] **Passo 3: o endereço da volta do preview no app do LinkedIn, pelo Eduardo**

O Eduardo acrescenta, só para a prova, `https://<o endereço da branch>/api/oauth/linkedin/callback` nos "Authorized redirect URLs for your app" (aba Auth do app Método Chat) e manda o print. O da produção (`https://metodochat.vercel.app/api/oauth/linkedin/callback`) continua lá.

- [ ] **Passo 4: as decisões do Eduardo, pela caixa (nota 4)**
  - qual conta do painel recebe o LinkedIn dele;
  - se ele fica conectado no fim, ou se é desconectado.

A leitura, escrita antes: o token de teste de 09/11 segue válido e tem o mesmo escopo, então a tela de autorização do LinkedIn deve ser pulada, e o navegador volta direto (spec, "Renovar"). Isso é o esperado, e não um defeito.

- [ ] **Passo 5: a prova no preview, pelo Eduardo**

O roteiro vai à auditoria antes. A espera fica numa página só de texto, e nenhum formulário fica à vista durante uma espera (achados 176 e 186). O endereço da branch fica atrás do login da Vercel, por causa da proteção do projeto ("all_except_custom_domains"; nota 2). Por isso a volta do LinkedIn só passa no navegador de quem está logado na Vercel, que na prova é o do Eduardo. Os passos:
1. na Configuração do preview, a seção "LinkedIn das contas" lista as contas, cada uma com "Sem LinkedIn", e sem o aviso das chaves;
2. "Convidar a conectar o LinkedIn" na conta escolhida: o link aparece uma vez, no endereço da branch;
3. o link abre a página "Conectar seu LinkedIn"; o botão leva ao LinkedIn, que volta direto, e o fim é "Pronto, seu LinkedIn foi conectado.";
4. de volta na Configuração: "LinkedIn conectado como <nome>, vence em 60 dias.", e o convite aparece na lista como "LinkedIn · @<conta>, em <data>";
5. se a decisão foi desconectar: o "Desconectar" mostra a frase do achado 206, e o "Sim, desconectar" volta a conta para "Sem LinkedIn".

A auditoria lê a base depois de cada passo que grava (só contagens, o tamanho do `sub` e o vencimento; nunca o token).

- [ ] **Passo 6: o endereço da volta do preview sai do app do LinkedIn**, com o print, como o 13.

- [ ] **Passo 7: o PR, com o OK do Eduardo.** O corpo leva o que muda, os números deste plano, o que o ensaio achou, a nota de que nada publica nesta parte, a 024 já aplicada, e nenhuma arroba solta. A mensagem do merge vai à parte, e a auditoria lê os dois antes de o PR abrir. O merge é do Eduardo.

- [ ] **Passo 8: o deploy do merge.**
  - No log: "Nada a aplicar: as 25 migrações já constam no registro.", sem a 024 como órfã, as conferências "CONFERIDO", e sem o aviso do Node 26.
  - No site: o `/entrar` dá 200, o cron sem senha dá 401, e `/convite/<código que não existe>` mostra a frase do link que não vale.
  - Os registros da produção da primeira hora, sem erro novo.

Com a parte 1 em produção, a parte 2 (a 025, o ramo do dreno e a publicação de só texto e de imagem) começa pelo plano dela.

---

## Apêndice A — As mutações

O roteiro roda da raiz da cópia, com a árvore commitada e limpa. Cada mutação troca um trecho que aparece uma vez só, roda o arquivo de teste que a cobre e confere que o caso nomeado cai, pelo nome inteiro. As de integração rodam contra o banco de TESTE, uma de cada vez. No fim, a árvore volta limpa.

```js
// AS MUTAÇÕES DA PARTE 1 DO LINKEDIN (a conexão; docs/specs/2026-11-06-linkedin-no-perfil.md), no molde de
// mutar-preparacao.mjs. Cada uma desfaz UMA trava, trocando um trecho exato de um arquivo (que tem de aparecer
// uma vez só), roda só o arquivo de teste que a cobre e confere que o caso NOMEADO cai, pelo nome inteiro. As de
// integração rodam contra o banco de TESTE, uma de cada vez. A árvore tem de estar commitada e limpa antes, e
// volta limpa no fim.
//
// Uso, da raiz da cópia: node ../mutar-li1.mjs [prefixo-do-nome]
//                        node ../mutar-li1.mjs --conferir   (só confere que cada trecho aparece uma vez)
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const TESTES_URL = "postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes";
if (process.env.DATABASE_URL) throw new Error("RECUSADO: DATABASE_URL no ambiente");
const status = () => execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim();
if (status() !== "") throw new Error("RECUSADO: árvore suja antes das mutações");

const PURO = { config: null };
const TELA = { config: "vitest.dom.config.ts" };
const INTEG = { config: "vitest.integracao.config.ts" };

const T_VOLTA = { ...INTEG, arquivo: "testes-integracao/linkedin-convite.integracao.ts" };
const T_TABELA = { ...INTEG, arquivo: "testes-integracao/linkedin-tabela.integracao.ts" };
const T_VOLTA_IG = { ...INTEG, arquivo: "testes-integracao/convite-volta.integracao.ts" };
const T_COMUM = { ...INTEG, arquivo: "testes-integracao/contas-por-login.integracao.ts" };
const T_PARTIDA = { ...INTEG, arquivo: "testes-integracao/esquema-de-partida.integracao.ts" };
const T_CLIENTE = { ...PURO, arquivo: "tests/linkedin.test.ts" };
const T_GUARDA = { ...PURO, arquivo: "tests/linkedin-token-fora-do-cliente.test.ts" };
const T_TELA = { ...TELA, arquivo: "testes-dom/linkedin-no-setup.dom.tsx" };

const VOLTA = "app/api/oauth/linkedin/callback/route.ts";
const ACOES = "app/setup/actions.ts";
const REPO = "lib/convites-repositorio.ts";
const CLIENTE = "lib/linkedin.ts";
const SESSAO_SEM_PAPEL = 'const login = (await (await import("@/lib/sessao")).sessaoAtual())!;';

const MUTACOES = [
  {
    nome: "V1: a volta sem a conferência do state",
    arq: VOLTA,
    de: '  if (!conviteId || !oauthStateConfere(req.cookies.get(OAUTH_STATE_COOKIE)?.value, q.get("state"))) {\n',
    para: "  if (!conviteId) {\n",
    teste: T_VOLTA,
    cai: "o state diferente, ou a volta sem o cookie do convite, recusa sem escrever nada e sem chamar o LinkedIn",
  },
  {
    nome: "V2: a volta do LinkedIn aceita o convite do Instagram",
    arq: VOLTA,
    de: '  if (!convite || convite.rede !== "linkedin" || estadoDoConvite(convite, Date.now()) !== "pendente") {\n',
    para: '  if (!convite || estadoDoConvite(convite, Date.now()) !== "pendente") {\n',
    teste: T_VOLTA,
    cai: "o convite do Instagram na volta do LinkedIn não conecta nada e não chama o LinkedIn",
  },
  {
    nome: "V3: a volta sem a conferência da permissão de publicar",
    arq: VOLTA,
    de: "    if (!temPermissaoDePublicar(troca.scope)) {\n",
    para: "    if (troca.scope === null) {\n",
    teste: T_VOLTA,
    cai: "sem a permissão de publicar no scope, não conecta, e o motivo fica no convite",
  },
  {
    nome: "V4: a autorização fora dos segredos do texto de erro",
    arq: VOLTA,
    de: "    segredos.push(troca.accessToken);\n",
    para: "",
    teste: T_VOLTA,
    cai: "o userinfo em erro não leva a autorização para o texto do erro",
  },
  {
    nome: "V5: a volta do Instagram aceita o convite do LinkedIn",
    arq: "app/api/oauth/callback/convite.ts",
    de: '  if (!convite || convite.rede !== "instagram" || estadoDoConvite(convite, Date.now()) !== "pendente") {\n',
    para: '  if (!convite || estadoDoConvite(convite, Date.now()) !== "pendente") {\n',
    teste: T_VOLTA_IG,
    cai: "o convite do LinkedIn na volta do Instagram não conecta conta nenhuma, e não chama a Meta",
  },
  {
    nome: "R1: a reivindicação do LinkedIn sem a rede no where",
    arq: REPO,
    de: "        where id = $1 and rede = 'linkedin' and usado_em is null",
    para: "        where id = $1 and usado_em is null",
    teste: T_TABELA,
    cai: "o convite de uma rede nunca é usado pela volta da outra",
  },
  {
    nome: "R2: a reivindicação do Instagram sem a rede no where",
    arq: REPO,
    de: "        where id = $1 and rede = 'instagram' and usado_em is null",
    para: "        where id = $1 and usado_em is null",
    teste: T_TABELA,
    cai: "o convite de uma rede nunca é usado pela volta da outra",
  },
  {
    nome: "R3: a 024 sem o cascade da conta-alvo",
    arq: "migrations/024-linkedin-conexoes.sql",
    de: "    constraint convites_de_conexao_conta_alvo_fkey references accounts (ig_user_id) on delete cascade;",
    para: "    constraint convites_de_conexao_conta_alvo_fkey references accounts (ig_user_id);",
    teste: T_TABELA,
    cai: "o convite do LinkedIn sai junto com a conta-alvo",
  },
  {
    nome: "R4: a 024 fora da conferência de partida",
    arq: "lib/esquema.ts",
    de: '      de: "024-linkedin-conexoes.sql",',
    para: '      de: "024-outra-coisa.sql",',
    teste: T_PARTIDA,
    cai: "a MARCA D'ÁGUA cobre a pasta inteira: nenhuma migração passa sem ser decidida",
  },
  {
    nome: "A1: gerar o convite do LinkedIn sem a conferência do administrador",
    arq: ACOES,
    de: "  const login = await exigirAdministrador();\n  if (!credenciaisDoLinkedin()) {\n",
    para: `  ${SESSAO_SEM_PAPEL}\n  if (!credenciaisDoLinkedin()) {\n`,
    teste: T_COMUM,
    cai: "gerarConviteDoLinkedin vai para /, e nada muda",
  },
  {
    nome: "A2: desconectar sem a conferência do administrador",
    arq: ACOES,
    de: '  const login = await exigirAdministrador();\n  const contaId = String(formData.get("conta") ?? "");\n  if (await podeVerConta',
    para: `  ${SESSAO_SEM_PAPEL}\n  const contaId = String(formData.get("conta") ?? "");\n  if (await podeVerConta`,
    teste: T_COMUM,
    cai: "desconectarLinkedin vai para /, e nada muda",
  },
  {
    nome: "C1: o scope separado só por espaço",
    arq: CLIENTE,
    de: "scope.split(/[\\s,]+/)",
    para: "scope.split(/\\s+/)",
    teste: T_CLIENTE,
    cai: "aceita a vírgula (medida na troca de 09/11) e o espaço (o da documentação)",
  },
  {
    nome: "C2: as bases do LinkedIn sem a trava do vitest",
    arq: CLIENTE,
    de: '  if (pedida && process.env.VITEST === "true" && BASE_DE_TESTE.test(pedida))',
    para: "  if (pedida && BASE_DE_TESTE.test(pedida))",
    teste: T_CLIENTE,
    cai: "fora do loopback, ou fora do vitest, a variável é ignorada",
  },
  {
    nome: "C3: o preview sem o endereço da branch",
    arq: CLIENTE,
    de: '  if (ambiente.vercelEnv === "preview" && branch)',
    para: '  if (ambiente.vercelEnv === "nunca" && branch)',
    teste: T_CLIENTE,
    cai: "no preview é o endereço da branch, que não muda a cada deploy e é o cadastrado no app para a prova",
  },
  {
    nome: "G1: o componente de cliente importa o repositório da conexão",
    arq: "app/setup/linkedin-das-contas.tsx",
    de: 'import type { EstadoDoGerar } from "@/lib/convites";\n',
    para: 'import type { EstadoDoGerar } from "@/lib/convites";\nimport type { ConexaoDoLinkedin } from "@/lib/linkedin-conexoes";\n',
    teste: T_GUARDA,
    cai: "nenhum componente de cliente importa o repositório da conexão nem o cliente do LinkedIn",
  },
  {
    nome: "T1: o Desconectar sem dizer que, no LinkedIn, a autorização vence sozinha (achado 206)",
    arq: "app/setup/linkedin-das-contas.tsx",
    de: "            O painel apaga a autorização do LinkedIn de {c.nome} e para de usá-la. No LinkedIn, ela vence sozinha em até\n            60 dias.\n",
    para: "            Desconectar o LinkedIn de {c.nome}?\n",
    teste: T_TELA,
    cai: "pede confirmação, dizendo que o painel apaga a autorização e que, no LinkedIn, ela vence sozinha",
  },
];

const semCor = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");
/** Os nomes dos casos que caíram: as linhas do `×`, sem o sinal e sem a duração do fim. */
const casosQueCairam = (saida) =>
  saida
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("×"))
    .map((l) => l.replace(/^×\s*/, "").replace(/\s+\d+(\.\d+)?\s*m?s$/, "").trim());

const conferir = process.argv[2] === "--conferir";
const filtro = conferir ? undefined : process.argv[2];
const inicio = Date.now();
let ruins = 0;
let rodadas = 0;
for (const m of MUTACOES) {
  if (filtro && !m.nome.startsWith(filtro)) continue;
  rodadas++;
  const original = readFileSync(m.arq, "utf8");
  // A PASTA PODE ESTAR EM CRLF (autocrlf=true; o blob é LF). O trecho segue o fim de linha do arquivo.
  const crlf = original.includes("\r\n");
  const ajusta = (s) => (crlf ? s.replace(/\r?\n/g, "\r\n") : s);
  const de = ajusta(m.de);
  const vezes = original.split(de).length - 1;
  if (vezes !== 1) {
    console.log(`RUIM  ${m.nome}: o trecho aparece ${vezes} vez(es) em ${m.arq}`);
    ruins++;
    continue;
  }
  if (conferir) {
    console.log(`ÚNICO ${m.nome}`);
    continue;
  }
  const t0 = Date.now();
  let r;
  try {
    writeFileSync(m.arq, original.replace(de, () => ajusta(m.para)));
    const args = ["vitest", "run", ...(m.teste.config ? ["--config", m.teste.config] : []), m.teste.arquivo];
    const env = { ...process.env };
    delete env.CLAUDECODE;
    delete env.AI_AGENT;
    if (m.teste.config === INTEG.config) env.DATABASE_URL_TESTES = TESTES_URL;
    r = spawnSync("npx", args, { encoding: "utf8", shell: true, env, timeout: 10 * 60 * 1000, maxBuffer: 64 * 1024 * 1024 });
  } finally {
    writeFileSync(m.arq, original);
  }
  const saida = semCor(`${r.stdout}\n${r.stderr}`);
  const alvoOk = m.teste.config !== INTEG.config || saida.includes("ALVO: banco de TESTE");
  const cairam = casosQueCairam(saida);
  const caiu = cairam.includes(m.cai);
  const outros = cairam.filter((c) => c !== m.cai).length;
  const ok = alvoOk && r.status !== 0 && caiu;
  if (!ok) ruins++;
  const s = Math.round((Date.now() - t0) / 1000);
  console.log(
    `${ok ? "MORTA" : "RUIM "} ${m.nome}  (saída ${r.status}, alvo ok: ${alvoOk}, caiu o caso: ${caiu}, outros que caíram: ${outros}, ${s}s)`
  );
  if (!ok) console.log(`      casos que caíram: ${cairam.length ? cairam.join(" | ") : "nenhum"}`);
}
const total = Math.round((Date.now() - inicio) / 1000);
console.log(
  `${rodadas} mutações, ${ruins} ruins; árvore no fim: ${status() === "" ? "limpa" : "SUJA"}${conferir ? " (só a conferência dos trechos)" : `; ${Math.floor(total / 60)} min ${total % 60} s`}`
);
```
