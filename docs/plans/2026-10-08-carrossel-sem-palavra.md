# Gerador de bônus — Plano de implementação da Etapa 8: o carrossel sem palavra-chave

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: `superpowers:subagent-driven-development`
> (recomendada) ou `superpowers:executing-plans`, fase por fase. Os passos usam caixa de
> seleção (`- [ ]`) para acompanhar.

**Objetivo:** o carrossel sem palavra-chave, do texto livre ou de um bônus do Labs que não tem palavra,
cuja chamada final pede uma de quatro ações escolhidas pelo operador (salvar o post, compartilhar,
seguir o perfil ou comentar a opinião), sem funil; e os achados 83 e 84 (o comentário do contrato da
lista do Labs e o bônus que some da lista de escolha sem aviso).

**Arquitetura:** a migração 017 deixa `carrosseis_gerados.palavra` aceitar nulo e acrescenta
`acao_da_chamada`, com quatro `check` que amarram a palavra e a ação. Um módulo puro novo
(`acao-da-chamada.ts`) tem as quatro ações, o rótulo, a frase do pedido à IA e `pedidoDaChamada`, que
lê as duas colunas. Os módulos puros passam a aceitar a palavra nula antes de o tipo da linha mudar: a
conferência do texto (sem palavra, nenhuma palavra gritada na chamada), o pedido à IA (a ação no lugar
da palavra) e os textos da página (o topo com a ação, o funil que some, os avisos da palavra no Labs).
Depois o tipo da linha muda, e o compilador aponta o repositório, a geração, o "Gerar de novo" e as
páginas. A regra que lê um bônus na lista do Labs vira duas (achado 85): a do bônus do Chat, a de
hoje, e a do avulso, que aceita o bônus sem palavra; a lista de escolha usa a do avulso e conta os que
ficam de fora (achado 84). O pedido do "Novo carrossel" ganha a caixa "Sem palavra-chave" e a ação.

**Stack:** a das etapas anteriores, no Next.js 16.3.8: App Router, Server Actions com
`useActionState`, React 19, Postgres (postgres.js via `lib/db.ts`), Vitest (três suítes), Tailwind
v4 com os tokens de `app/ui.ts`.

**Spec:** `docs/specs/2026-10-08-carrossel-sem-palavra.md` (commits `3316b82` e `7fbae51`, liberada
pela auditoria com o achado 85 absorvido, e lida pelo Eduardo). Leia antes de começar: este plano não
repete o porquê das regras, só como construí-las.

**Ensaio do plano (08/10):** o código deste plano foi escrito e testado fase a fase numa cópia isolada
do repositório (`git worktree`, branch local `ensaio-sem-palavra`, sem push, saída de `7fbae51`), e
todo bloco de código abaixo foi tirado do git dessa cópia por um gerador, sem cópia à mão. Os números
do ensaio:
- lint e `tsc` limpos em cada fase; no fim, 107 arquivos e 3 095 casos puros (103 e 3 006 na base), 22
  e 184 de tela (22 e 177 na base);
- `next build --webpack` limpo (com `ƒ /carrosseis`, `ƒ /carrosseis/[cid]`, `ƒ /carrosseis/[cid]/arte` e `ƒ /carrosseis/novo` na lista), e o `AGENTS.md` intacto (o Turbopack, ver o item 7 abaixo);
- integração no container: 42 arquivos; 434 passaram, 8 pularam e 7 caíram, só os de
  `registro-de-migracoes`, pelo item 7 abaixo. Na árvore do projeto, a conta esperada é 42 arquivos,
  441 passaram e 8 pularam (FASE 8.11);
- cada fase foi vista falhar antes do código e passar depois, na ordem deste plano, com os números de
  cada uma no passo dela;
- as 45 provas de mutação do Apêndice A derrubaram, cada uma, o caso esperado;
- o plano, aplicado do zero sobre `7fbae51` numa cópia limpa, dá os 44 arquivos iguais ao fim
  do ensaio, byte a byte;
- a guarda do diff (FASE 8.11, passo 4) saiu vazia: nada do `/publicar`, das automações, do
  `scripts/migrar.mjs`, do proxy nem das dependências, e nada fora das pastas da etapa.

O ensaio achou estas coisas, já resolvidas neste plano:
1. **O teste da 016 apagava junto um `check` da 017.** Para provar a 016 sobre linhas antigas, o caso
   da Etapa 7 apaga a coluna `origem` e reaplica a 016; o Postgres apaga junto todo `check` que usa a
   coluna, e a 017 tem um (`carrosseis_gerados_bonus_palavra_check`). O caso passa a reaplicar também
   as migrações seguintes (FASE 8.1).
2. **As duas regras do Labs compartilham as partes** (`palavraDoItem` e `textosDoItem`, FASE 8.7): com
   palavra, a regra do avulso diz o mesmo que a do Chat (um teste confere caso a caso), e o sem tema
   fica de fora com ou sem palavra. O teste da regra do Chat (`tests/bonus-publicado.test.ts:53-55`)
   não muda.
3. **Os módulos puros aceitam a palavra nula antes de o tipo da linha mudar** (FASES 8.2 a 8.5). Na
   FASE 8.6, o tipo muda e o compilador aponta 9 lugares em 6 arquivos, cada um decidido ali.
4. **`criarCarrosselAvulso` recebe a palavra OU a ação**, num tipo que não deixa as duas juntas; os
   ajudantes dos testes de integração, que trocam campos soltos, usam `as` (FASE 8.6).
5. **A lista "Carrosséis" não muda** (decisão do Eduardo): um teste puro prova que o item é o mesmo
   com e sem palavra, e ele passa antes do código, de propósito (FASE 8.6).
6. **O publicar não muda.** O caso novo (FASE 8.10) passa direto, e a mutação que faz o publicar exigir
   a palavra o derruba (Apêndice A), como na FASE 7.12.
7. **A cópia de ensaio derruba `registro-de-migracoes`** (7 casos: o script recusa `--a-mao` sem o
   `.env.local`, que a cópia não tem), e o **`next build` do `verify` (Turbopack) não roda na cópia**,
   que tem o `node_modules` por junção. Na árvore do projeto os dois rodam (FASE 8.11).
8. **Uma integração de cada vez.** Duas rodadas ao mesmo tempo no mesmo container derrubam o schema
   uma da outra (o item 11 do plano da Etapa 7).

## Restrições globais

Valem para todas as fases, sem precisar repetir em cada uma.

- **Branch:** `carrossel-sem-palavra`, saída da `main` em `3d96638` (o PR #9 mergeado), sem upstream.
  Nunca commitar nem empurrar na `main`: ela não tem proteção e um push dispara deploy de produção.
  Conferir `git branch --show-current` antes de cada commit, e `git ls-remote origin refs/heads/main`
  no começo de cada fase.
- **`git add` com caminho explícito.** Nunca `-A` nem `.`: mais de uma sessão usa esta árvore.
- **Conventional Commits, em português.** Sem `Co-Authored-By` e sem rodapé de IA. Autor:
  Eduardo Kobal <162614913+Eduardokobal@users.noreply.github.com>.
- **Antes de cada commit**, varrer os arquivos de TEXTO tocados com
  `node "$SCRATCH/varrer-texto.mjs" <arquivos>`, em que `$SCRATCH` é o scratchpad da sessão. Se o
  scratchpad não existir mais, recrie o script a partir do apêndice A do plano da Etapa 1
  (`docs/plans/2026-09-29-gerador-de-bonus.md`).
- **O commit é um comando à parte**, depois de ler a saída dos testes: nunca encadeado com `&&` atrás
  deles.
- **Escape de barra-u:** a ferramenta de escrita grava o caractere no lugar do escape. Os blocos
  deste plano não têm escape de barra-u; se algum aparecer, a varredura acusa.
- **Fim de linha:** com `core.autocrlf=true`, a cópia de trabalho dos arquivos que já existem está
  em CRLF. Os diffs deste plano estão em LF: aplique com `git apply --ignore-whitespace` ou à mão,
  e varra depois. Se a varredura acusar fim de linha misturado, converta a cópia inteira para LF.
- **Pastas da etapa:** `app/bonus/`, `app/carrosseis/` e `lib/bonus/`; fora delas, só
  `migrations/017-carrossel-sem-palavra.sql`, a declaração da 017 em `lib/esquema.ts`, testes e
  `docs/` (a nota de correção na spec da Etapa 7). **Nenhum arquivo do `/publicar`, das automações, do
  `scripts/migrar.mjs`, do proxy nem das dependências muda** (achado 82; a FASE 8.11 confere).
- **Os comandos da 017 não mudam depois de aplicada** (FASE 8.12): a soma registrada é a dos comandos,
  e um comando mudado para o build do merge.
- **Sufixo de teste é o que decide se ele roda:** `tests/**/*.test.ts` (puro, entra no `verify`),
  `testes-integracao/**/*.integracao.ts` (banco, fora do `verify`), `testes-dom/**/*.dom.tsx`
  (tela, entra no `verify`).
- **Uma rodada de integração de cada vez** (item 8 do ensaio).
- **A suíte de integração só roda com `DATABASE_URL_TESTES`** apontando para o container
  (`127.0.0.1:5434`, `npm run banco:teste`). Toda rodada tem de imprimir
  `[rede-global] ALVO: banco de TESTE`. Se imprimir outra coisa, pare. Nunca rode com a variável
  vazia: ela cai na `DATABASE_URL`, que é **produção**.
- **`next dev` e `next build` sem as variáveis de agente.** Rode com `env -u CLAUDECODE -u AI_AGENT ...`
  e confira `git diff AGENTS.md` depois: ele não muda. Se o build local cair com erros de
  `next/font/google` ("queries have exactly one entry"), apague o `.next` (cache local) e rode de novo.
- **Telas:** só os tokens de `app/ui.ts` e os degraus de `app/escala.ts`; nada de `indigo`,
  `violet` nem `purple`.
- **Segredo** nunca vai para código, log, mensagem, commit ou saída de terminal.
- **Escrita em produção só com o OK do Eduardo**, e o script que grava vai antes à auditoria (achado
  77). A 017 é aplicada à mão antes da prova (FASE 8.12). O preview usa o banco e o bucket de
  produção: lá, criar um carrossel, salvar, subir imagem, agendar e cancelar gravam em produção.
  Avisar o auditor com a hora antes de cada gravação.
- **Ao fechar cada fase**, avisar o auditor (sessão `metodochat-ba` em 08/10; conferir o nome no
  `ListAgents`, porque ele muda a cada reinício) com o hash e o que conferir. Não esperar a
  resposta para seguir.

## Mapa dos arquivos

| arquivo | responsabilidade | fase |
|---|---|---|
| `migrations/017-carrossel-sem-palavra.sql`, `lib/esquema.ts` | a palavra que pode faltar, a ação, os quatro `check`, a declaração em `naoObservaveis` | 8.1 |
| `lib/bonus/acao-da-chamada.ts` | as quatro ações, o rótulo, a frase da IA, o pedido da chamada lido da linha | 8.2 |
| `lib/bonus/carrossel-texto.ts`, `lib/bonus/carrossel-textos.ts`, `app/bonus/[id]/carrossel/[cid]/campo.tsx` | a conferência sem palavra: nenhuma palavra gritada na chamada | 8.3 |
| `lib/bonus/carrossel-ia-parametros.ts` | o pedido à IA com a ação | 8.4 |
| `lib/bonus/carrossel-textos.ts`, `lib/bonus/publicar-textos.ts` | o topo com a ação, os avisos da palavra no Labs, o funil que some | 8.5 |
| `lib/bonus/carrossel-linha.ts`, `carrossel-repositorio.ts`, `carrossel-processo.ts`, `avulso-processo.ts`, as duas páginas, a revisão, o editor e o card | a linha sem palavra, gravada, gerada e mostrada | 8.6 |
| `lib/bonus/publicado.ts`, `lib/bonus/avulso-textos.ts`, `lib/bonus/carrossel-textos.ts` | as duas regras do Labs, a lista com o sem palavra e a contagem dos de fora | 8.7 |
| `lib/bonus/avulso-pedido.ts`, `avulso-processo.ts`, `avulso-textos.ts`, `app/carrosseis/actions.ts`, `app/carrosseis/[cid]/page.tsx` | o pedido com a caixa e a ação, o avulso pela regra nova do Labs | 8.8 |
| `app/carrosseis/novo/formulario-do-avulso.tsx`, `app/carrosseis/novo/page.tsx` | a tela do "Novo carrossel" sem palavra | 8.9 |
| `lib/bonus/publicado.ts`, `lib/bonus/temas.ts`, `app/carrosseis/novo/page.tsx`, a spec da Etapa 7; `testes-integracao/bonus-publicar-processo.integracao.ts` | os comentários do contrato (achado 83); o publicar sem palavra (só teste) | 8.10 |

---

## ETAPA 8 — o carrossel sem palavra-chave

### FASE 8.0 — Começar da main certa

- [ ] **Passo 1: conferir a main e a branch**

```bash
git ls-remote origin refs/heads/main
git switch carrossel-sem-palavra
git log --oneline -5
node -e 'console.log(require("./node_modules/next/package.json").version)'
```

Esperado: a `main` em `3d96638` (ou depois dele); a branch com os commits da spec e este plano sobre
`3d96638`; o `node_modules` na 16.3.8. Se a `main` andou, rebaseie a branch nela antes de seguir
(`git fetch origin main && git rebase origin/main`), e rode `npm ci` se o lock mudou.

- [ ] **Passo 2: a linha de base**

```bash
npm test
npm run test:dom
npm run banco:teste
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npm run test:integracao
```

Esperado: 103 arquivos e 3 006 casos puros; 22 e 177 de tela; `[rede-global] ALVO: banco de TESTE`,
42 arquivos, 418 passaram e 8 pularam.

---

### FASE 8.1 — A migração 017

**Arquivos:**
- Criar: `migrations/017-carrossel-sem-palavra.sql`
- Modificar: `lib/esquema.ts` (só a declaração da 017 em `naoObservaveis`)
- Testar: `testes-integracao/bonus-carrossel-tabela.integracao.ts`, `testes-integracao/esquema-de-partida.integracao.ts` (sem mudar)

**Interfaces:**
- Produz, no banco: `carrosseis_gerados.palavra` nulável; `acao_da_chamada text`, nula nas linhas de
  hoje; `carrosseis_gerados_acao_check` (`salvar`, `compartilhar`, `seguir`, `comentar`),
  `carrosseis_gerados_palavra_ou_acao_check` (`(palavra is null) = (acao_da_chamada is not null)`),
  `carrosseis_gerados_bonus_palavra_check` (`origem <> 'bonus' or palavra is not null`) e
  `carrosseis_gerados_palavra_vazia_check` (`palavra <> ''`). A migração é idempotente (o molde da 009).

- [ ] **Passo 1: o teste**

O caso da 016 que reaplica a migração passa a reaplicar também as seguintes (item 1 do ensaio).

Em `testes-integracao/bonus-carrossel-tabela.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/bonus-carrossel-tabela.integracao.ts b/testes-integracao/bonus-carrossel-tabela.integracao.ts
index fb08106..5d8e859 100644
--- a/testes-integracao/bonus-carrossel-tabela.integracao.ts
+++ b/testes-integracao/bonus-carrossel-tabela.integracao.ts
@@ -30,6 +30,8 @@ const COLUNAS = [
   "origem",
   "labs_codigo",
   "texto_a_mao",
+  // A 017 (Etapa 8): o carrossel sem palavra-chave.
+  "acao_da_chamada",
 ];
 
 let bonusId: string;
@@ -64,14 +66,14 @@ describe("a tabela carrosseis_gerados", () => {
     expect(linhas.map((l) => l.column_name)).toEqual(COLUNAS);
   });
 
-  it("uma linha nova nasce pendente, sem texto, sem revisão, sem escolha de arte, e de bônus", async () => {
+  it("uma linha nova nasce pendente, sem texto, sem revisão, sem escolha de arte, de bônus e sem ação", async () => {
     const [linha] = (await banco
       .db()
       .sql()
       .query(
         `insert into carrosseis_gerados (bonus_id, total_slides, palavra, contexto)
          values ($1, 10, 'SUMIDO', $2::jsonb)
-         returning estado, gerado, revisado, revisado_em, contexto, arte, origem, labs_codigo, texto_a_mao`,
+         returning estado, gerado, revisado, revisado_em, contexto, arte, origem, labs_codigo, texto_a_mao, acao_da_chamada`,
         [bonusId, { tema: "Vendas" }]
       )) as Record<string, unknown>[];
     expect(linha).toEqual({
@@ -84,6 +86,7 @@ describe("a tabela carrosseis_gerados", () => {
       origem: "bonus",
       labs_codigo: null,
       texto_a_mao: false,
+      acao_da_chamada: null,
     });
   });
 
@@ -216,8 +219,84 @@ describe("a 016: o carrossel avulso", () => {
       ])) as Record<string, unknown>[];
       expect(lida).toEqual({ origem: "bonus", labs_codigo: null, texto_a_mao: false, estado: "pronto" });
     } finally {
-      // Se algo cair no meio, a tabela volta à forma da pasta para o arquivo seguinte.
+      // Se algo cair no meio, a tabela volta à forma da pasta para o arquivo seguinte. As migrações
+      // depois da 016 também rodam de novo: apagar a coluna `origem` apaga junto todo `check` que a
+      // usa, e a 017 tem um (`carrosseis_gerados_bonus_palavra_check`).
       await sql.query(m016!.comandos);
+      for (const m of migracoesEmOrdem().filter((m) => m.nome > "016-carrossel-avulso.sql")) await sql.query(m.comandos);
+    }
+  });
+});
+
+// O CARROSSEL SEM PALAVRA-CHAVE (a 017, spec da Etapa 8): a palavra pode faltar, e então a chamada pede
+// uma ação. O banco amarra as duas: ou palavra, ou ação; o carrossel de bônus do Chat sempre tem
+// palavra; a ação é uma das quatro; e a palavra vazia não é um terceiro jeito de dizer "sem palavra".
+describe("a 017: o carrossel sem palavra-chave", () => {
+  const inserir = (colunas: string, valores: string, params: unknown[] = []) =>
+    banco
+      .db()
+      .sql()
+      .query(`insert into carrosseis_gerados (total_slides, contexto, ${colunas}) values (5, '{}'::jsonb, ${valores}) returning id`, params);
+
+  it("o texto livre e o avulso do Labs entram sem palavra e com a ação", async () => {
+    await inserir("origem, palavra, acao_da_chamada", "'livre', null, 'salvar'");
+    await inserir("origem, labs_codigo, palavra, acao_da_chamada", "'labs', 'sem-palavra', null, 'comentar'");
+    await inserir("origem, palavra, acao_da_chamada, texto_a_mao", "'livre', null, 'seguir', true");
+    await inserir("origem, palavra, acao_da_chamada", "'livre', null, 'compartilhar'");
+    expect(await contar()).toBe(4);
+  });
+
+  it.each([
+    ["a palavra e a ação juntas", "origem, palavra, acao_da_chamada", "'livre', 'BRUTAL', 'salvar'"],
+    ["nem palavra nem ação", "origem, palavra", "'livre', null"],
+  ])("o banco recusa %s", async (_nome, colunas, valores) => {
+    await expect(inserir(colunas, valores)).rejects.toThrow(/carrosseis_gerados_palavra_ou_acao_check/);
+  });
+
+  it("o banco recusa o carrossel de bônus do Chat sem palavra, mesmo com a ação", async () => {
+    await expect(inserir("bonus_id, palavra, acao_da_chamada", "$1, null, 'salvar'", [bonusId])).rejects.toThrow(
+      /carrosseis_gerados_bonus_palavra_check/
+    );
+  });
+
+  it("o banco recusa a ação fora das quatro", async () => {
+    await expect(inserir("origem, palavra, acao_da_chamada", "'livre', null, 'curtir'")).rejects.toThrow(
+      /carrosseis_gerados_acao_check/
+    );
+  });
+
+  it("o banco recusa a palavra vazia", async () => {
+    await expect(inserir("origem, palavra", "'livre', ''")).rejects.toThrow(/carrosseis_gerados_palavra_vazia_check/);
+  });
+
+  // AS LINHAS QUE JÁ EXISTIAM: como na 016, o caso desfaz a 017, grava uma linha como as de produção
+  // hoje (com palavra), e aplica a 017 de novo, duas vezes. A linha velha fica com a palavra e sem ação.
+  it("aplicada sobre as linhas que já existiam, todas ficam com a palavra e sem ação, e ela roda duas vezes", async () => {
+    const m017 = migracoesEmOrdem().find((m) => m.nome === "017-carrossel-sem-palavra.sql");
+    expect(m017).toBeDefined();
+    const sql = banco.db().sql();
+    try {
+      await sql.query(
+        `alter table carrosseis_gerados
+           drop constraint carrosseis_gerados_palavra_vazia_check,
+           drop constraint carrosseis_gerados_bonus_palavra_check,
+           drop constraint carrosseis_gerados_palavra_ou_acao_check,
+           drop constraint carrosseis_gerados_acao_check,
+           drop column acao_da_chamada,
+           alter column palavra set not null`
+      );
+      const [velha] = (await sql.query(
+        `insert into carrosseis_gerados (bonus_id, total_slides, palavra, contexto, estado) values ($1, 4, 'SUMIDO', '{}'::jsonb, 'pronto') returning id`,
+        [bonusId]
+      )) as { id: string }[];
+      await sql.query(m017!.comandos);
+      await sql.query(m017!.comandos);
+      const [lida] = (await sql.query(`select palavra, acao_da_chamada, origem, estado from carrosseis_gerados where id = $1`, [
+        velha.id,
+      ])) as Record<string, unknown>[];
+      expect(lida).toEqual({ palavra: "SUMIDO", acao_da_chamada: null, origem: "bonus", estado: "pronto" });
+    } finally {
+      await sql.query(m017!.comandos);
     }
   });
 });
```

- [ ] **Passo 2: ver falhar**

```bash
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-carrossel-tabela.integracao.ts testes-integracao/esquema-de-partida.integracao.ts
```

Esperado: `[rede-global] ALVO: banco de TESTE`; 9 caem e 21 passam (30): a coluna nova e os `check`
não existem.

- [ ] **Passo 3: o código**

Crie `migrations/017-carrossel-sem-palavra.sql`:

```sql
-- O CARROSSEL SEM PALAVRA-CHAVE (Etapa 8 do gerador de bônus): a chamada final pede uma ação
-- escolhida pelo operador (salvar o post, compartilhar, seguir o perfil ou comentar a opinião), e não
-- há funil de palavra. Vale no texto livre e no bônus do Labs que não tem palavra. O desenho inteiro
-- está em docs/specs/2026-10-08-carrossel-sem-palavra.md.
--
-- `palavra` passa a aceitar nulo, e `acao_da_chamada` guarda a ação. Os quatro `check` de baixo
-- amarram as duas: ou palavra, ou ação, nunca as duas e nunca nenhuma; o carrossel de bônus do Chat
-- sempre tem palavra; a ação é uma das quatro; e a palavra vazia não é um terceiro jeito de dizer
-- "sem palavra" (o nulo passa nesse, e nos outros dois que olham uma coluna só).
--
-- COLUNA DE FEATURE, como a 014, a 015 e a 016: entra em `naoObservaveis` de lib/esquema.ts, e quem
-- confere é testes-integracao/bonus-carrossel-tabela.integracao.ts. O scripts/migrar.mjs não muda
-- (achado 82 da auditoria).
--
-- SEGURA NA JANELA DO DEPLOY: o código antigo grava sempre a palavra e nunca a ação, e lê com
-- `select *`, que ignora coluna nova. As linhas que já existem têm palavra e ficam sem ação, e passam
-- nos quatro `check`.
--
-- IDEMPOTENTE, como toda migração desta pasta: `add column if not exists`, e cada `check` é
-- derrubado se existir e criado de novo (o molde da 009).
alter table carrosseis_gerados alter column palavra drop not null;

alter table carrosseis_gerados add column if not exists acao_da_chamada text;

alter table carrosseis_gerados drop constraint if exists carrosseis_gerados_acao_check;
alter table carrosseis_gerados add constraint carrosseis_gerados_acao_check
  check (acao_da_chamada in ('salvar', 'compartilhar', 'seguir', 'comentar'));

alter table carrosseis_gerados drop constraint if exists carrosseis_gerados_palavra_ou_acao_check;
alter table carrosseis_gerados add constraint carrosseis_gerados_palavra_ou_acao_check
  check ((palavra is null) = (acao_da_chamada is not null));

alter table carrosseis_gerados drop constraint if exists carrosseis_gerados_bonus_palavra_check;
alter table carrosseis_gerados add constraint carrosseis_gerados_bonus_palavra_check
  check (origem <> 'bonus' or palavra is not null);

alter table carrosseis_gerados drop constraint if exists carrosseis_gerados_palavra_vazia_check;
alter table carrosseis_gerados add constraint carrosseis_gerados_palavra_vazia_check
  check (palavra <> '');
```

Em `lib/esquema.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/esquema.ts b/lib/esquema.ts
index 4c3e3b2..249d6f1 100644
--- a/lib/esquema.ts
+++ b/lib/esquema.ts
@@ -243,6 +243,16 @@ const MARCA_DAGUA = {
       porque:
         "colunas de FEATURE (carrosseis_gerados.origem, labs_codigo e texto_a_mao): a partida do painel não depende delas, de propósito",
     },
+    {
+      de: "017-carrossel-sem-palavra.sql",
+      // A PALAVRA QUE PODE FALTAR E A AÇÃO DA CHAMADA (`acao_da_chamada`) na mesma tabela de feature,
+      // pelo mesmo motivo da 014, da 015 e da 016: só o gerador (app/bonus/ e app/carrosseis/) as lê,
+      // e elas não podem impedir o painel inteiro de subir. Quem confere é
+      // testes-integracao/bonus-carrossel-tabela.integracao.ts. Decidido pelo Eduardo em
+      // 08/10/2026 (docs/specs/2026-10-08-carrossel-sem-palavra.md).
+      porque:
+        "coluna de FEATURE (carrosseis_gerados.acao_da_chamada, e a palavra que pode faltar): a partida do painel não depende dela, de propósito",
+    },
   ],
   // A migração que cria as oito tabelas de `tabelas`, acima.
   base: "000-esquema-base.sql",
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-carrossel-tabela.integracao.ts testes-integracao/esquema-de-partida.integracao.ts
```

Esperado: `tsc` limpo; `[rede-global] ALVO: banco de TESTE`, e os 30 passam. Sem a declaração em
`lib/esquema.ts`, cai o caso "a MARCA D'ÁGUA cobre a pasta inteira" de `esquema-de-partida`.

- [ ] **Passo 5: a soma da 017**, para conferir depois com o registro da produção (FASE 8.12)

```bash
node --input-type=module -e 'import { readFileSync } from "node:fs"; const m = await import("./scripts/migracoes.mjs"); console.log(m.somaDoTexto(m.comandosDoArquivo(readFileSync("migrations/017-carrossel-sem-palavra.sql", "utf8"))).slice(0, 12));'
```

Esperado: `1d202571d8db`.

- [ ] **Passo 6: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" migrations/017-carrossel-sem-palavra.sql lib/esquema.ts testes-integracao/bonus-carrossel-tabela.integracao.ts
test "$(git branch --show-current)" = "carrossel-sem-palavra"
git add migrations/017-carrossel-sem-palavra.sql lib/esquema.ts testes-integracao/bonus-carrossel-tabela.integracao.ts
git commit -m "feat(bonus): a migração 017, a palavra que pode faltar e a ação da chamada"
```

---

### FASE 8.2 — As quatro ações da chamada

**Arquivos:**
- Criar: `lib/bonus/acao-da-chamada.ts`
- Testar: `tests/bonus-acao-da-chamada.test.ts`

**Interfaces:**
- Produz: `ACOES_DA_CHAMADA` (`["salvar", "compartilhar", "seguir", "comentar"] as const`); `type
  AcaoDaChamada`; `ehAcaoDaChamada(v): v is AcaoDaChamada`; `rotuloDaAcao(a): string` ("Salvar o
  post", "Compartilhar", "Seguir o perfil", "Comentar a opinião"); `pedidoDaAcao(a): string` (a frase da
  IA, sem o ponto final); `type PedidoDaChamada = { palavra: string; acao: null } | { palavra: null;
  acao: AcaoDaChamada }`; `pedidoDaChamada({ palavra, acao_da_chamada }): PedidoDaChamada | null` (null
  na linha fora da regra do banco).

- [ ] **Passo 1: o teste**

Crie `tests/bonus-acao-da-chamada.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ACOES_DA_CHAMADA,
  ehAcaoDaChamada,
  pedidoDaAcao,
  pedidoDaChamada,
  rotuloDaAcao,
  type AcaoDaChamada,
} from "@/lib/bonus/acao-da-chamada";

// A AÇÃO DA CHAMADA DO CARROSSEL SEM PALAVRA-CHAVE (spec da Etapa 8): o que o slide final pede quando
// não há palavra. São quatro, o banco confere de novo, e a linha tem palavra OU ação, nunca as duas.

describe("as quatro ações", () => {
  it("são as do Eduardo, na ordem da tela", () => {
    expect([...ACOES_DA_CHAMADA]).toEqual(["salvar", "compartilhar", "seguir", "comentar"]);
  });

  it("são as mesmas do check da 017 no banco", () => {
    const sql = readFileSync("migrations/017-carrossel-sem-palavra.sql", "utf8").replace(/\r\n/g, "\n");
    const lista = /acao_da_chamada in \(([^)]*)\)/.exec(sql)?.[1] ?? "";
    expect(lista.split(",").map((v) => v.trim().replace(/'/g, ""))).toEqual([...ACOES_DA_CHAMADA]);
  });

  it.each(ACOES_DA_CHAMADA)("aceita %s", (acao) => {
    expect(ehAcaoDaChamada(acao)).toBe(true);
  });

  it.each([["curtir"], ["Salvar"], [" salvar"], [""], [null], [undefined], [1]])("recusa %j", (v) => {
    expect(ehAcaoDaChamada(v)).toBe(false);
  });
});

describe("o nome na tela e o pedido à IA", () => {
  const casos: [AcaoDaChamada, string, string][] = [
    ["salvar", "Salvar o post", "peça para salvar o post"],
    ["compartilhar", "Compartilhar", "peça para compartilhar o post com quem precisa ver"],
    ["seguir", "Seguir o perfil", "peça para seguir o perfil"],
    ["comentar", "Comentar a opinião", "peça para comentar a opinião, sem palavra-chave"],
  ];

  it.each(casos)("%s: %s, e %s", (acao, rotulo, pedido) => {
    expect(rotuloDaAcao(acao)).toBe(rotulo);
    expect(pedidoDaAcao(acao)).toBe(pedido);
  });

  it("nenhum pedido manda escrever uma palavra em maiúsculas", () => {
    for (const a of ACOES_DA_CHAMADA) expect(pedidoDaAcao(a)).not.toMatch(/\b[A-Z]{3,}\b/);
  });
});

describe("o que a chamada pede, lido da linha", () => {
  it("com palavra, a palavra", () => {
    expect(pedidoDaChamada({ palavra: "BRUTAL", acao_da_chamada: null })).toEqual({ palavra: "BRUTAL", acao: null });
  });

  it("sem palavra, a ação", () => {
    expect(pedidoDaChamada({ palavra: null, acao_da_chamada: "seguir" })).toEqual({ palavra: null, acao: "seguir" });
  });

  it.each([
    ["as duas juntas", { palavra: "BRUTAL", acao_da_chamada: "salvar" }],
    ["nenhuma das duas", { palavra: null, acao_da_chamada: null }],
    ["a ação fora das quatro", { palavra: null, acao_da_chamada: "curtir" }],
    ["a palavra vazia", { palavra: "", acao_da_chamada: null }],
  ])("a linha fora da regra do banco (%s) não pede nada", (_nome, linha) => {
    expect(pedidoDaChamada(linha)).toBeNull();
  });
});
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-acao-da-chamada.test.ts
```

Esperado: o arquivo cai sem casos: o módulo não existe.

- [ ] **Passo 3: o código**

Crie `lib/bonus/acao-da-chamada.ts`:

```ts
// A AÇÃO DA CHAMADA DO CARROSSEL SEM PALAVRA-CHAVE (spec da Etapa 8). PURO.
//
// Sem palavra, o slide final pede uma de quatro ações, escolhida pelo operador no "Novo carrossel".
// A lista é a do `check` da 017 (`carrosseis_gerados_acao_check`), e um teste confere as duas. A
// linha tem palavra OU ação, nunca as duas e nunca nenhuma (`carrosseis_gerados_palavra_ou_acao_check`).

export const ACOES_DA_CHAMADA = ["salvar", "compartilhar", "seguir", "comentar"] as const;

export type AcaoDaChamada = (typeof ACOES_DA_CHAMADA)[number];

/** O valor que veio do formulário (ou do banco) é uma das quatro? */
export function ehAcaoDaChamada(v: unknown): v is AcaoDaChamada {
  return typeof v === "string" && (ACOES_DA_CHAMADA as readonly string[]).includes(v);
}

/** O nome da ação na tela: o "Novo carrossel" e o topo da página do carrossel. */
export function rotuloDaAcao(a: AcaoDaChamada): string {
  switch (a) {
    case "salvar":
      return "Salvar o post";
    case "compartilhar":
      return "Compartilhar";
    case "seguir":
      return "Seguir o perfil";
    case "comentar":
      return "Comentar a opinião";
  }
}

/**
 * O pedido à IA, sem o ponto final (`pedidoExtra`, carrossel-ia-parametros.ts). Nenhum deles tem
 * palavra em maiúsculas: a chamada sem palavra não pode ter nenhuma (carrossel-texto.ts).
 */
export function pedidoDaAcao(a: AcaoDaChamada): string {
  switch (a) {
    case "salvar":
      return "peça para salvar o post";
    case "compartilhar":
      return "peça para compartilhar o post com quem precisa ver";
    case "seguir":
      return "peça para seguir o perfil";
    case "comentar":
      return "peça para comentar a opinião, sem palavra-chave";
  }
}

/** O que a chamada pede: a palavra do funil, ou, sem palavra, a ação. */
export type PedidoDaChamada = { palavra: string; acao: null } | { palavra: null; acao: AcaoDaChamada };

/**
 * O pedido da chamada lido das colunas da linha. Null quando a linha está fora da regra do banco (as
 * duas juntas, nenhuma, a ação fora das quatro, a palavra vazia): quem chama trata como falha, e
 * nunca inventa um dos dois lados.
 */
export function pedidoDaChamada(l: { palavra: string | null; acao_da_chamada: unknown }): PedidoDaChamada | null {
  if (typeof l.palavra === "string") {
    return l.palavra && l.acao_da_chamada === null ? { palavra: l.palavra, acao: null } : null;
  }
  return ehAcaoDaChamada(l.acao_da_chamada) ? { palavra: null, acao: l.acao_da_chamada } : null;
}
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx vitest run tests/bonus-acao-da-chamada.test.ts
```

Esperado: `tsc` limpo; os 24 passam.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/acao-da-chamada.ts tests/bonus-acao-da-chamada.test.ts
test "$(git branch --show-current)" = "carrossel-sem-palavra"
git add lib/bonus/acao-da-chamada.ts tests/bonus-acao-da-chamada.test.ts
git commit -m "feat(bonus): as quatro ações da chamada sem palavra-chave, iguais às do banco"
```

---

### FASE 8.3 — Sem palavra-chave, a chamada não pode ter palavra gritada

**Arquivos:**
- Modificar: `lib/bonus/carrossel-texto.ts`, `lib/bonus/carrossel-textos.ts`,
  `app/bonus/[id]/carrossel/[cid]/campo.tsx`
- Testar: `tests/bonus-carrossel-sem-palavra.test.ts` (novo), `testes-dom/bonus-carrossel-campo.dom.tsx`

**Interfaces:**
- Muda: `outrasGritadas(texto, palavra: string | null)`; `conferirGerado(total, palavra: string |
  null, t)`, com a falha nova `{ motivo: "gritada"; palavras }`; `lerRevisaoDoCarrossel` e
  `juntarParte` com `palavra: string | null`; `textoDaConferencia(f, palavra: string | null)`; o
  `Campo` com `palavra?: string | null` (nula: a chamada avisa toda palavra gritada).
- Produz: `textoDaGritadaSemPalavra(gritadas): string`.

- [ ] **Passo 1: os testes**

Crie `tests/bonus-carrossel-sem-palavra.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  conferirGerado,
  juntarParte,
  lerRevisaoDoCarrossel,
  outrasGritadas,
  valoresPorCampo,
  type TextoDeCarrossel,
  type TextoDePost,
} from "@/lib/bonus/carrossel-texto";
import { textoDaConferencia, textoDaGritadaSemPalavra } from "@/lib/bonus/carrossel-textos";

// A CONFERÊNCIA DO TEXTO SEM PALAVRA-CHAVE (spec da Etapa 8, "A conferência do texto"): sem palavra, a
// chamada não pode ter NENHUMA palavra gritada (fora as permitidas, como o VENCE do bordão), porque
// um "Comente GUIA" sem automação deixaria quem comentou sem resposta. A legenda fica livre. O Chat
// não confere se a chamada pede a ação escolhida: isso fica com o operador.

const slide = (i: number) => ({
  titulo: `Título do slide ${i}`,
  texto: `Texto do slide ${i}, com mais de trinta caracteres.`,
});
const SEM: TextoDeCarrossel = {
  tipo: "carrossel",
  titulo: "Como vender sem parecer chato",
  gancho: "Você vende como quem pede desculpa?",
  slides: [slide(1), slide(2), slide(3)],
  chamada: "Salve este post para reler antes da próxima venda.",
  legenda:
    "Vender não é incomodar. Salve este post e leia de novo antes da próxima conversa com um cliente.",
};
const POST: TextoDePost = {
  tipo: "post",
  titulo: SEM.titulo,
  texto: "T".repeat(80),
  chamada: SEM.chamada,
  legenda: SEM.legenda,
};
const COM_GUIA = "Comente GUIA e receba o roteiro da venda.";

describe("as palavras gritadas, sem palavra-chave", () => {
  it("toda palavra gritada conta, fora as permitidas", () => {
    expect(outrasGritadas("Comente GUIA ou PDF AGORA, e Quem vende, VENCE.", null)).toEqual(["GUIA"]);
  });
});

describe("a conferência do que a IA devolveu, sem palavra-chave", () => {
  it("passa sem a palavra na chamada e na legenda", () => {
    expect(conferirGerado(5, null, SEM)).toBeNull();
    expect(conferirGerado(1, null, POST)).toBeNull();
  });

  it("acusa a chamada com palavra gritada", () => {
    expect(conferirGerado(5, null, { ...SEM, chamada: COM_GUIA })).toEqual({ motivo: "gritada", palavras: ["GUIA"] });
  });

  it("o bordão VENCE pode", () => {
    expect(conferirGerado(5, null, { ...SEM, chamada: "Salve este post. Quem vende, VENCE." })).toBeNull();
  });

  it("a legenda não tem regra de palavra", () => {
    expect(conferirGerado(5, null, { ...SEM, legenda: `${SEM.legenda} Vale a LEITURA.` })).toBeNull();
  });

  it("as regras do formato continuam", () => {
    expect(conferirGerado(6, null, SEM)).toEqual({ motivo: "slides", vieram: 3, esperados: 4 });
    expect(conferirGerado(1, null, SEM)).toEqual({ motivo: "tipo_errado" });
  });

  it("a falha diz o que fazer", () => {
    expect(textoDaConferencia({ motivo: "gritada", palavras: ["GUIA", "ROTEIRO"] }, null)).toBe(
      "A chamada tem GUIA, ROTEIRO em maiúsculas, e este carrossel não tem palavra-chave. Gere de novo."
    );
  });
});

describe("a revisão do operador, sem palavra-chave", () => {
  const bruto = valoresPorCampo(SEM);

  it("aceita a chamada e a legenda sem palavra", () => {
    expect(lerRevisaoDoCarrossel(5, null, SEM.titulo, bruto)).toEqual({ ok: true, texto: SEM });
  });

  it("recusa a chamada com palavra gritada, com o motivo", () => {
    expect(lerRevisaoDoCarrossel(5, null, SEM.titulo, { ...bruto, chamada: COM_GUIA })).toEqual({
      ok: false,
      problemas: [{ campo: "chamada", erro: "não pode ter palavra em maiúsculas (GUIA): este carrossel não tem palavra-chave" }],
    });
  });

  it("salvar só a chamada (o último slide) passa pela mesma regra", () => {
    const parte = { tipo: "slide" as const, numero: 5 };
    expect(juntarParte(5, null, SEM, parte, { chamada: COM_GUIA })).toEqual({
      ok: false,
      problemas: [{ campo: "chamada", erro: "não pode ter palavra em maiúsculas (GUIA): este carrossel não tem palavra-chave" }],
    });
    const nova = "Siga o perfil para ver a próxima parte.";
    expect(juntarParte(5, null, SEM, parte, { chamada: nova })).toEqual({ ok: true, texto: { ...SEM, chamada: nova }, avisos: [] });
  });

  it("a legenda sem palavra se salva", () => {
    const legenda = "Vender é ajudar quem precisa a decidir. Leia de novo antes da próxima conversa com um cliente.";
    expect(juntarParte(5, null, SEM, { tipo: "legenda" }, { legenda })).toEqual({ ok: true, texto: { ...SEM, legenda }, avisos: [] });
  });
});

describe("o aviso na hora, embaixo da chamada", () => {
  it("diz quais palavras estão gritadas e por que não pode", () => {
    expect(textoDaGritadaSemPalavra(["GUIA"])).toBe(
      "Tem GUIA em maiúsculas: este carrossel não tem palavra-chave, e quem comentar uma palavra não recebe nada."
    );
  });
});
```

Em `testes-dom/bonus-carrossel-campo.dom.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-dom/bonus-carrossel-campo.dom.tsx b/testes-dom/bonus-carrossel-campo.dom.tsx
index e9cdc8b..828366d 100644
--- a/testes-dom/bonus-carrossel-campo.dom.tsx
+++ b/testes-dom/bonus-carrossel-campo.dom.tsx
@@ -121,6 +121,31 @@ describe("o campo do carrossel", () => {
     expect(screen.queryByText(/Falta a palavra/)).toBeNull();
   });
 
+  // O CARROSSEL SEM PALAVRA-CHAVE (spec da Etapa 8): `palavra` nula. Na chamada, toda palavra gritada
+  // é acusada na hora; na legenda, nada.
+  it("sem palavra-chave, a chamada avisa a palavra gritada, e a legenda não avisa nada", () => {
+    render(
+      <>
+        <Campo
+          nome="chamada"
+          rotulo="Chamada (slide 3)"
+          valorInicial="Salve este post. Quem vende, VENCE."
+          max={200}
+          linhas={3}
+          palavra={null}
+          soAPalavra
+        />
+        <Campo nome="legenda" rotulo="Legenda do post" valorInicial="Uma legenda sem PALAVRA nenhuma." max={900} linhas={8} palavra={null} />
+      </>
+    );
+    expect(screen.queryByText(/em maiúsculas/)).toBeNull();
+    expect(screen.queryByText(/Falta a palavra/)).toBeNull();
+    fireEvent.change(screen.getByLabelText("Chamada (slide 3)"), { target: { value: "Comente GUIA e receba." } });
+    expect(
+      screen.getByText("Tem GUIA em maiúsculas: este carrossel não tem palavra-chave, e quem comentar uma palavra não recebe nada.")
+    ).toBeTruthy();
+  });
+
   it("campo que não pede a palavra nunca avisa", () => {
     render(<Campo nome="gancho" rotulo="Gancho (slide 1)" valorInicial="Sem palavra nenhuma." max={120} linhas={2} />);
     expect(screen.queryByText(/Falta a palavra/)).toBeNull();
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-carrossel-sem-palavra.test.ts tests/bonus-carrossel-texto.test.ts tests/bonus-carrossel-textos.test.ts tests/bonus-carrossel-partes.test.ts
npx vitest run --config vitest.dom.config.ts testes-dom/bonus-carrossel-campo.dom.tsx
```

Esperado: os puros: 10 caem e 85 passam (95); a tela: 1 cai e 8 passam (9).

- [ ] **Passo 3: o código**

Em `lib/bonus/carrossel-texto.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/carrossel-texto.ts b/lib/bonus/carrossel-texto.ts
index 0ada357..81cf8a9 100644
--- a/lib/bonus/carrossel-texto.ts
+++ b/lib/bonus/carrossel-texto.ts
@@ -93,9 +93,10 @@ export const GRITADAS_PERMITIDAS: ReadonlySet<string> = new Set([
 /**
  * As OUTRAS palavras gritadas: todas em maiúsculas, de 3 caracteres ou mais, com pelo menos uma
  * letra (número não é palavra-chave), fora a palavra do bônus e as permitidas. Decisão do
- * Eduardo em 30/09: "Comente SUMIDO ou GUIA" é recusada.
+ * Eduardo em 30/09: "Comente SUMIDO ou GUIA" é recusada. Sem palavra-chave (`null`, spec da Etapa
+ * 8), TODA palavra gritada conta, fora as permitidas.
  */
-export function outrasGritadas(texto: string, palavra: string): string[] {
+export function outrasGritadas(texto: string, palavra: string | null): string[] {
   const achadas = texto.match(/(?<![\p{L}\p{N}])[\p{Lu}\p{N}]{3,}(?![\p{L}\p{N}])/gu) ?? [];
   return [...new Set(achadas)].filter((w) => /\p{Lu}/u.test(w) && w !== palavra && !GRITADAS_PERMITIDAS.has(w));
 }
@@ -104,7 +105,8 @@ export type FalhaDaConferencia =
   | { motivo: "tipo_errado" }
   | { motivo: "slides"; vieram: number; esperados: number }
   | { motivo: "palavra"; onde: "chamada" | "legenda" }
-  | { motivo: "outra_palavra"; palavras: string[] };
+  | { motivo: "outra_palavra"; palavras: string[] }
+  | { motivo: "gritada"; palavras: string[] };
 
 /**
  * O que a IA devolveu serve? `null` é que serve.
@@ -113,12 +115,20 @@ export type FalhaDaConferencia =
  * Decisão do Eduardo em 30/09 (achado 49 do auditor): o Labs também só confere a chamada, e uma
  * legenda de até 900 caracteres tem ênfases em maiúsculas que recusariam gerações boas. O
  * operador revisa a legenda antes de usar.
+ *
+ * SEM PALAVRA-CHAVE (`palavra` nula, spec da Etapa 8): a chamada não pode ter nenhuma palavra
+ * gritada, porque um "Comente GUIA" sem automação deixaria quem comentou sem resposta; a legenda
+ * fica livre. Se a chamada pede a ação escolhida, quem confere é o operador.
  */
-export function conferirGerado(total: number, palavra: string, t: TextoDoCarrossel): FalhaDaConferencia | null {
+export function conferirGerado(total: number, palavra: string | null, t: TextoDoCarrossel): FalhaDaConferencia | null {
   if ((total === 1) !== (t.tipo === "post")) return { motivo: "tipo_errado" };
   if (t.tipo === "carrossel" && t.slides.length !== slidesDeConteudo(total)) {
     return { motivo: "slides", vieram: t.slides.length, esperados: slidesDeConteudo(total) };
   }
+  if (palavra === null) {
+    const gritadas = outrasGritadas(t.chamada, null);
+    return gritadas.length ? { motivo: "gritada", palavras: gritadas } : null;
+  }
   if (!temPalavra(t.chamada, palavra)) return { motivo: "palavra", onde: "chamada" };
   if (!temPalavra(t.legenda, palavra)) return { motivo: "palavra", onde: "legenda" };
   const outras = outrasGritadas(t.chamada, palavra);
@@ -195,7 +205,7 @@ export type ProblemaDoCampo = { campo: string; erro: string };
  */
 export function lerRevisaoDoCarrossel(
   total: number,
-  palavra: string,
+  palavra: string | null,
   titulo: string,
   bruto: Record<string, unknown>
 ): { ok: true; texto: TextoDoCarrossel } | { ok: false; problemas: ProblemaDoCampo[] } {
@@ -206,7 +216,7 @@ export function lerRevisaoDoCarrossel(
 /** Os campos limpos (o \r\n e as pontas), e os problemas de cada um, na ordem da tela. */
 function conferirCampos(
   total: number,
-  palavra: string,
+  palavra: string | null,
   bruto: Record<string, unknown>
 ): { valores: Record<string, string>; problemas: ProblemaDoCampo[] } {
   const v: Record<string, string> = {};
@@ -217,6 +227,18 @@ function conferirCampos(
     if (t.length < c.min) problemas.push({ campo: c.nome, erro: `precisa de pelo menos ${c.min} caracteres` });
     else if (t.length > c.max) problemas.push({ campo: c.nome, erro: `passa de ${c.max} caracteres` });
   }
+  // Sem palavra-chave (spec da Etapa 8), a mesma regra de `conferirGerado`: nenhuma gritada na
+  // chamada, e a legenda livre.
+  if (palavra === null) {
+    const gritadas = v.chamada ? outrasGritadas(v.chamada, null) : [];
+    if (gritadas.length) {
+      problemas.push({
+        campo: "chamada",
+        erro: `não pode ter palavra em maiúsculas (${gritadas.join(", ")}): este carrossel não tem palavra-chave`,
+      });
+    }
+    return { valores: v, problemas };
+  }
   // As mesmas regras de `conferirGerado`, e na mesma ordem: sem a palavra, é isso que se diz da
   // chamada; com ela, as outras gritadas. Na legenda, só a presença (achado 49).
   if (v.chamada && !temPalavra(v.chamada, palavra)) {
@@ -279,7 +301,7 @@ export function lerParte(bruta: unknown, total: number): ParteDoCarrossel | null
  */
 export function juntarParte(
   total: number,
-  palavra: string,
+  palavra: string | null,
   atual: TextoDoCarrossel,
   parte: ParteDoCarrossel,
   bruto: Record<string, unknown>
```

Em `lib/bonus/carrossel-textos.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/carrossel-textos.ts b/lib/bonus/carrossel-textos.ts
index 7c2af8e..1da2ff3 100644
--- a/lib/bonus/carrossel-textos.ts
+++ b/lib/bonus/carrossel-textos.ts
@@ -100,7 +100,8 @@ export function quadroDaSituacao(s: SituacaoNoLabs): { tom: TomDoQuadro; texto:
   }
 }
 
-export function textoDaConferencia(f: FalhaDaConferencia, palavra: string): string {
+/** `palavra` nula é o carrossel sem palavra-chave (spec da Etapa 8): a falha dele é a "gritada". */
+export function textoDaConferencia(f: FalhaDaConferencia, palavra: string | null): string {
   switch (f.motivo) {
     case "tipo_errado":
       return "A IA devolveu um formato diferente do pedido. Gere de novo.";
@@ -110,9 +111,16 @@ export function textoDaConferencia(f: FalhaDaConferencia, palavra: string): stri
       return `A IA não pôs a palavra ${palavra} na ${f.onde}. Gere de novo.`;
     case "outra_palavra":
       return `A chamada pede também ${f.palavras.join(", ")}, além de ${palavra}. Gere de novo.`;
+    case "gritada":
+      return `A chamada tem ${f.palavras.join(", ")} em maiúsculas, e este carrossel não tem palavra-chave. Gere de novo.`;
   }
 }
 
+/** O aviso embaixo da chamada do carrossel sem palavra-chave, quando ela tem palavra gritada. */
+export function textoDaGritadaSemPalavra(gritadas: string[]): string {
+  return `Tem ${gritadas.join(", ")} em maiúsculas: este carrossel não tem palavra-chave, e quem comentar uma palavra não recebe nada.`;
+}
+
 export function textoDosProblemasDoCarrossel(total: number, problemas: { campo: string; erro: string }[]): string {
   const rotulos = new Map(camposDoFormulario(total).map((c) => [c.nome, c.rotulo]));
   return `${problemas.map((p) => `${rotulos.get(p.campo) ?? p.campo}: ${p.erro}`).join(". ")}.`;
```

Em `app/bonus/[id]/carrossel/[cid]/campo.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/[id]/carrossel/[cid]/campo.tsx b/app/bonus/[id]/carrossel/[cid]/campo.tsx
index 6157783..477d03a 100644
--- a/app/bonus/[id]/carrossel/[cid]/campo.tsx
+++ b/app/bonus/[id]/carrossel/[cid]/campo.tsx
@@ -2,7 +2,7 @@
 import { useState } from "react";
 import { btnSecondary, fieldError, hint, input, label } from "@/app/ui";
 import { outrasGritadas, temPalavra } from "@/lib/bonus/carrossel-texto";
-import { textoDaFaltaDaPalavra, textoDeOutrasPalavras } from "@/lib/bonus/carrossel-textos";
+import { textoDaFaltaDaPalavra, textoDaGritadaSemPalavra, textoDeOutrasPalavras } from "@/lib/bonus/carrossel-textos";
 
 // UM CAMPO DO CARROSSEL: edita, conta e copia. O botão copia o que está NO CAMPO agora, e não o
 // que abriu na página: é esse texto que o operador leva para o Canva até a Etapa 3 existir.
@@ -20,6 +20,8 @@ import { textoDaFaltaDaPalavra, textoDeOutrasPalavras } from "@/lib/bonus/carros
 // como está (achado 53, decisão do Eduardo: copiar continua, com o aviso ao lado). Com
 // `soAPalavra` (só a chamada), avisa também a palavra gritada A MAIS (decisão do Eduardo,
 // 01/10). As regras e a ordem são as de `lerRevisaoDoCarrossel`: primeiro a falta, depois a mais.
+// `palavra` NULA é o carrossel sem palavra-chave (spec da Etapa 8): a chamada avisa toda palavra
+// gritada, e a legenda não avisa nada.
 //
 // `avisoDeCabimento` (Etapa 3) é o "não cabe" do slide deste campo, calculado pelo editor da arte
 // sobre o que está nos campos agora. Ele avisa e nunca impede: o salvar não olha para ele.
@@ -38,7 +40,7 @@ export default function Campo({
   valorInicial: string;
   max: number;
   linhas: number;
-  palavra?: string;
+  palavra?: string | null;
   soAPalavra?: boolean;
   avisoDeCabimento?: string;
 }) {
@@ -46,7 +48,10 @@ export default function Campo({
   const [copiado, setCopiado] = useState(false);
 
   let aviso: string | null = null;
-  if (palavra && !temPalavra(texto, palavra)) {
+  if (palavra === null) {
+    const gritadas = soAPalavra ? outrasGritadas(texto, null) : [];
+    if (gritadas.length) aviso = textoDaGritadaSemPalavra(gritadas);
+  } else if (palavra && !temPalavra(texto, palavra)) {
     aviso = textoDaFaltaDaPalavra(palavra);
   } else if (palavra && soAPalavra) {
     const outras = outrasGritadas(texto, palavra);
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx vitest run tests/bonus-carrossel-sem-palavra.test.ts tests/bonus-carrossel-texto.test.ts tests/bonus-carrossel-textos.test.ts tests/bonus-carrossel-partes.test.ts
npx vitest run --config vitest.dom.config.ts testes-dom/bonus-carrossel-campo.dom.tsx
```

Esperado: `tsc` limpo; 95 casos puros e 9 de tela passam.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/carrossel-texto.ts lib/bonus/carrossel-textos.ts "app/bonus/[id]/carrossel/[cid]/campo.tsx" tests/bonus-carrossel-sem-palavra.test.ts testes-dom/bonus-carrossel-campo.dom.tsx
test "$(git branch --show-current)" = "carrossel-sem-palavra"
git add lib/bonus/carrossel-texto.ts lib/bonus/carrossel-textos.ts "app/bonus/[id]/carrossel/[cid]/campo.tsx" tests/bonus-carrossel-sem-palavra.test.ts testes-dom/bonus-carrossel-campo.dom.tsx
git commit -m "feat(bonus): sem palavra-chave, a chamada não pode ter palavra gritada"
```

---

### FASE 8.4 — Sem palavra-chave, a IA recebe a ação da chamada

**Arquivos:**
- Modificar: `lib/bonus/carrossel-ia-parametros.ts`
- Testar: `tests/bonus-carrossel-ia-parametros.test.ts`

**Interfaces:**
- Muda: `type PedidoParaIA = { total; palavra: string; contexto } | { total; palavra: null; acao:
  AcaoDaChamada; contexto }`; `pedidoExtra(total, chamada: ChamadaDoPedido)`, com `type ChamadaDoPedido
  = string | { acao: AcaoDaChamada }`. A instrução do sistema (a do Labs) não muda.

- [ ] **Passo 1: o teste**

Em `tests/bonus-carrossel-ia-parametros.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-carrossel-ia-parametros.test.ts b/tests/bonus-carrossel-ia-parametros.test.ts
index 65f5779..d244776 100644
--- a/tests/bonus-carrossel-ia-parametros.test.ts
+++ b/tests/bonus-carrossel-ia-parametros.test.ts
@@ -128,3 +128,42 @@ describe("o contexto gravado na linha", () => {
     expect(contextoGravado(v)).toBeNull();
   });
 });
+
+// SEM PALAVRA-CHAVE (spec da Etapa 8, "O pedido à IA"): a instrução do Labs não muda, e o pedido extra
+// do Chat pede a ação escolhida no lugar da palavra, e manda não pedir palavra nenhuma.
+describe("o pedido sem palavra-chave", () => {
+  const LIVRE = { tipo: "livre" as const, tema: "Vendas", conteudo: "Como vender sem parecer chato, em cinco passos." };
+
+  it.each([1, 2, 10])("pede a ação e proíbe a palavra (%i slide(s))", (total) => {
+    const e = pedidoExtra(total, { acao: "salvar" });
+    expect(e).toContain("Na chamada para ação, peça para salvar o post.");
+    expect(e).toContain("Este post não tem palavra-chave: não peça para comentar uma palavra.");
+    expect(e).toContain("Na chamada, nenhuma palavra vai toda em maiúsculas, fora VENCE do bordão.");
+    expect(e).toContain("Termine a legenda no mesmo pedido.");
+    expect(e).not.toMatch(/comentar a palavra [A-Z]/);
+  });
+
+  it("cada ação vai com a frase dela", () => {
+    expect(pedidoExtra(4, { acao: "compartilhar" })).toContain("peça para compartilhar o post com quem precisa ver.");
+    expect(pedidoExtra(4, { acao: "seguir" })).toContain("peça para seguir o perfil.");
+    expect(pedidoExtra(4, { acao: "comentar" })).toContain("peça para comentar a opinião, sem palavra-chave.");
+  });
+
+  it("o total e o teto do post continuam os de hoje", () => {
+    expect(pedidoExtra(10, { acao: "salvar" })).toContain("8 slides de conteúdo");
+    expect(pedidoExtra(1, { acao: "salvar" })).toContain("no máximo 300 caracteres");
+  });
+
+  it("a mensagem leva o pedido da ação, no texto livre e no bônus do Labs", () => {
+    const livre: PedidoParaIA = { total: 4, palavra: null, acao: "seguir", contexto: LIVRE };
+    expect(mensagemDoCarrossel(livre).endsWith(pedidoExtra(4, { acao: "seguir" }))).toBe(true);
+    const labs: PedidoParaIA = { total: 1, palavra: null, acao: "comentar", contexto: CONTEXTO };
+    expect(mensagemDoCarrossel(labs).endsWith(pedidoExtra(1, { acao: "comentar" }))).toBe(true);
+  });
+
+  it("a instrução do sistema é a mesma, com ou sem palavra", () => {
+    const sem: PedidoParaIA = { total: 4, palavra: null, acao: "salvar", contexto: LIVRE };
+    expect(parametrosDoCarrossel(sem).system).toBe(INSTRUCAO_CARROSSEL);
+    expect(parametrosDoPost({ ...sem, total: 1 }).system).toBe(INSTRUCAO_POST);
+  });
+});
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-carrossel-ia-parametros.test.ts
```

Esperado: 5 caem e 22 passam (27).

- [ ] **Passo 3: o código**

Em `lib/bonus/carrossel-ia-parametros.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/carrossel-ia-parametros.ts b/lib/bonus/carrossel-ia-parametros.ts
index 72af162..66cd2e6 100644
--- a/lib/bonus/carrossel-ia-parametros.ts
+++ b/lib/bonus/carrossel-ia-parametros.ts
@@ -4,8 +4,9 @@
 // deve resolver" e o pedido extra no fim.
 //
 // O QUE MUDA A CADA PEDIDO VAI NA MENSAGEM, E NUNCA NA INSTRUÇÃO: a instrução é a do Labs,
-// intacta. O total, a palavra e o bônus mudam; ela não.
+// intacta. O total, a palavra (ou, sem ela, a ação) e o bônus mudam; ela não.
 import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
+import { pedidoDaAcao, type AcaoDaChamada } from "./acao-da-chamada";
 import { slidesDeConteudo } from "./carrossel-pedido";
 import { CarrosselDoChatSchema, PostDoChatSchema } from "./carrossel-schema";
 import { BETA_DO_FALLBACK, MODELO } from "./ia-parametros";
@@ -23,7 +24,16 @@ export type ContextoLivre = { tipo: "livre"; tema: string; conteudo: string };
 
 export type ContextoDoCarrossel = ContextoDeBonus | ContextoLivre;
 
-export type PedidoParaIA = { total: number; palavra: string; contexto: ContextoDoCarrossel };
+/**
+ * O pedido de uma geração. Com palavra, a chamada pede a palavra; sem palavra (spec da Etapa 8), a
+ * ação escolhida pelo operador.
+ */
+export type PedidoParaIA =
+  | { total: number; palavra: string; contexto: ContextoDoCarrossel }
+  | { total: number; palavra: null; acao: AcaoDaChamada; contexto: ContextoDoCarrossel };
+
+/** O que a chamada pede, no pedido extra: a palavra, ou a ação. */
+export type ChamadaDoPedido = string | { acao: AcaoDaChamada };
 
 /**
  * O contexto como a action o gravou em `carrosseis_gerados.contexto`. Forma errada → null. O de
@@ -61,17 +71,33 @@ function pedirPalavra(palavra: string): string {
   );
 }
 
+/**
+ * SEM PALAVRA-CHAVE (spec da Etapa 8): a instrução do Labs diz que o pedido padrão da chamada é
+ * comentar uma palavra-chave (instrucao-carrossel.ts), e este trecho a contradiz, como o total já
+ * contradiz a faixa de 6 a 9. Nenhuma palavra em maiúsculas: é a regra da conferência sem palavra.
+ */
+function pedirAcao(acao: AcaoDaChamada): string {
+  return (
+    `Na chamada para ação, ${pedidoDaAcao(acao)}. Este post não tem palavra-chave: não peça para comentar uma palavra. ` +
+    "Na chamada, nenhuma palavra vai toda em maiúsculas, fora VENCE do bordão. Termine a legenda no mesmo pedido."
+  );
+}
+
+function pedirChamada(c: ChamadaDoPedido): string {
+  return typeof c === "string" ? pedirPalavra(c) : pedirAcao(c.acao);
+}
+
 /**
  * O pedido que muda a cada geração. O TOTAL SUBSTITUI a faixa de 6 a 9 que a instrução do
  * carrossel escreve (no parágrafo dos slides do meio e no campo `slides`), porque aqui o total vai
  * de 2 a 10; e o post único leva o teto de 300 que o formato impõe (a instrução do post fala em
  * "~350" no campo `texto`). Achado 47 do auditor.
  */
-export function pedidoExtra(total: number, palavra: string): string {
+export function pedidoExtra(total: number, chamada: ChamadaDoPedido): string {
   if (total === 1) {
     return (
       "Este post PEDE uma ação: preencha `chamadaParaAcao`. " +
-      pedirPalavra(palavra) +
+      pedirChamada(chamada) +
       " O texto da imagem tem no máximo 300 caracteres."
     );
   }
@@ -82,7 +108,7 @@ export function pedidoExtra(total: number, palavra: string): string {
       : `Ou seja, ${conteudo} slides de conteúdo entre os dois.`;
   return (
     `Este post precisa ter ${total} slides no total, contando o gancho e a chamada para ação. ${meio} ` +
-    `Esse número substitui a faixa de 6 a 9 da instrução. ${pedirPalavra(palavra)}`
+    `Esse número substitui a faixa de 6 a 9 da instrução. ${pedirChamada(chamada)}`
   );
 }
 
@@ -92,11 +118,12 @@ export function pedidoExtra(total: number, palavra: string): string {
  */
 export function mensagemDoCarrossel(p: PedidoParaIA): string {
   const c = p.contexto;
-  if ("tipo" in c) return `Tema: ${c.tema}\n\nO conteúdo que este post divulga:\n${c.conteudo}\n\n` + pedidoExtra(p.total, p.palavra);
+  const chamada: ChamadaDoPedido = p.palavra === null ? { acao: p.acao } : p.palavra;
+  if ("tipo" in c) return `Tema: ${c.tema}\n\nO conteúdo que este post divulga:\n${c.conteudo}\n\n` + pedidoExtra(p.total, chamada);
   return (
     `Tema: ${c.tema}\n\nO que deve resolver:\n${c.oQueResolve}\n\n` +
     `O bônus que este post divulga: "${c.titulo}". ${c.descricao}\n\n` +
-    pedidoExtra(p.total, p.palavra)
+    pedidoExtra(p.total, chamada)
   );
 }
 
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx vitest run tests/bonus-carrossel-ia-parametros.test.ts
```

Esperado: `tsc` limpo; os 27 passam.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/carrossel-ia-parametros.ts tests/bonus-carrossel-ia-parametros.test.ts
test "$(git branch --show-current)" = "carrossel-sem-palavra"
git add lib/bonus/carrossel-ia-parametros.ts tests/bonus-carrossel-ia-parametros.test.ts
git commit -m "feat(bonus): sem palavra-chave, a IA recebe a ação da chamada"
```

---

### FASE 8.5 — Os textos da página sem palavra-chave, e o funil que some

**Arquivos:**
- Modificar: `lib/bonus/carrossel-textos.ts`, `lib/bonus/publicar-textos.ts`
- Testar: `tests/bonus-carrossel-chamada-tela.test.ts` (novo), `tests/bonus-publicar-estado.test.ts`

**Interfaces:**
- Muda: `textoDoFunil(e, palavra: string | null)` (nula: nada).
- Produz: `avisoDaPalavraNoLabs(noLabs: string | null, noCarrossel: string | null): string | null`;
  `textoDoPedidoDaChamada({ palavra, acao_da_chamada }): string` ("palavra X", ou "sem palavra-chave ·
  a chamada pede: salvar o post").

- [ ] **Passo 1: os testes**

Crie `tests/bonus-carrossel-chamada-tela.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { avisoDaPalavraNoLabs, avisoDePalavraTrocada, textoDoPedidoDaChamada } from "@/lib/bonus/carrossel-textos";

// O TOPO DA PÁGINA E OS AVISOS DA PALAVRA NO LABS (spec da Etapa 8, "A página do carrossel"): com
// palavra, a página diz a palavra, como hoje; sem palavra, diz a ação que a chamada pede.

describe("o que a chamada pede, no topo da página", () => {
  it("com palavra, a palavra", () => {
    expect(textoDoPedidoDaChamada({ palavra: "BRUTAL", acao_da_chamada: null })).toBe("palavra BRUTAL");
  });

  it.each([
    ["salvar", "sem palavra-chave · a chamada pede: salvar o post"],
    ["compartilhar", "sem palavra-chave · a chamada pede: compartilhar"],
    ["seguir", "sem palavra-chave · a chamada pede: seguir o perfil"],
    ["comentar", "sem palavra-chave · a chamada pede: comentar a opinião"],
  ])("sem palavra, a ação (%s)", (acao, texto) => {
    expect(textoDoPedidoDaChamada({ palavra: null, acao_da_chamada: acao })).toBe(texto);
  });

  it("sem palavra e com a ação fora das quatro, só diz que não tem palavra", () => {
    expect(textoDoPedidoDaChamada({ palavra: null, acao_da_chamada: "curtir" })).toBe("sem palavra-chave");
  });
});

describe("a palavra do bônus no Labs, comparada com a do carrossel", () => {
  it("igual, nada a avisar", () => {
    expect(avisoDaPalavraNoLabs("BRUTAL", "BRUTAL")).toBeNull();
    expect(avisoDaPalavraNoLabs(null, null)).toBeNull();
  });

  it("trocada, o aviso de hoje", () => {
    expect(avisoDaPalavraNoLabs("SUMIDO", "ZZTESTECHAT")).toBe(avisoDePalavraTrocada("SUMIDO", "ZZTESTECHAT"));
  });

  it("feito sem palavra, e o bônus agora tem palavra no Labs", () => {
    expect(avisoDaPalavraNoLabs("BRUTAL", null)).toBe(
      "No Labs, este bônus agora tem a palavra BRUTAL. Este carrossel foi feito sem palavra-chave; para usar a palavra, crie um carrossel novo."
    );
  });

  it("feito com palavra, e o bônus perdeu a palavra no Labs", () => {
    expect(avisoDaPalavraNoLabs(null, "BRUTAL")).toBe(
      "No Labs, este bônus não tem mais palavra-chave. Este carrossel pede a palavra BRUTAL: confira se a automação dela ainda existe."
    );
  });
});
```

Em `tests/bonus-publicar-estado.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-publicar-estado.test.ts b/tests/bonus-publicar-estado.test.ts
index 0e41ede..6192ab6 100644
--- a/tests/bonus-publicar-estado.test.ts
+++ b/tests/bonus-publicar-estado.test.ts
@@ -325,6 +325,13 @@ describe("o aviso do funil", () => {
   ] as EstadoDaPublicacao[])("sem post a caminho, nada: %j", (e) => {
     expect(textoDoFunil(e, "BRUTAL")).toBeNull();
   });
+
+  // SEM PALAVRA-CHAVE (spec da Etapa 8): não há automação para criar, e o aviso não aparece.
+  it("sem palavra-chave, nada, nem depois de agendar ou publicar", () => {
+    expect(textoDoFunil({ tipo: "agendado", quando: AGORA, filaId: "f" }, null)).toBeNull();
+    expect(textoDoFunil({ tipo: "publicando", filaId: null }, null)).toBeNull();
+    expect(textoDoFunil({ tipo: "publicado", em: AGORA, filaId: "f" }, null)).toBeNull();
+  });
 });
 
 // O ESTADO DA PUBLICAÇÃO NA LISTA "CARROSSÉIS" (spec da Etapa 7): uma palavra e a cor, quando há
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-carrossel-chamada-tela.test.ts tests/bonus-publicar-estado.test.ts
```

Esperado: 11 caem e 43 passam (54).

- [ ] **Passo 3: o código**

Em `lib/bonus/carrossel-textos.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/carrossel-textos.ts b/lib/bonus/carrossel-textos.ts
index 1da2ff3..5c29fa6 100644
--- a/lib/bonus/carrossel-textos.ts
+++ b/lib/bonus/carrossel-textos.ts
@@ -1,6 +1,7 @@
 // AS FRASES DO CARROSSEL, fora do JSX (mesmo princípio de lib/bonus/textos.ts): uma saída muda
 // é indistinguível de sucesso, e o texto de cada saída vem de função pura, com teste.
 import type { Aviso } from "@/lib/avisos";
+import { ehAcaoDaChamada, rotuloDaAcao } from "./acao-da-chamada";
 import { SLIDES_MAX, SLIDES_MIN, TETO_CARROSSEL_DIARIO, type RecusaDoPedidoDeCarrossel } from "./carrossel-pedido";
 import { camposDoFormulario, type FalhaDaConferencia, type ParteDoCarrossel, type ProblemaDoCampo } from "./carrossel-texto";
 import { PALAVRA_MAX, PALAVRA_MIN } from "./pedido";
@@ -139,3 +140,26 @@ export function textoDaFaltaDaPalavra(palavra: string): string {
 export function avisoDePalavraTrocada(noLabs: string, noCarrossel: string): string {
   return `No Labs, a palavra deste bônus agora é ${noLabs}, e este carrossel pede ${noCarrossel}. Gere outro carrossel para usar a palavra nova.`;
 }
+
+/**
+ * A PALAVRA DO BÔNUS NO LABS COMPARADA COM A DO CARROSSEL (avulso do Labs), com os dois lados do
+ * carrossel sem palavra-chave (spec da Etapa 8). Igual, nada; trocada, o aviso de hoje.
+ */
+export function avisoDaPalavraNoLabs(noLabs: string | null, noCarrossel: string | null): string | null {
+  if (noLabs === noCarrossel) return null;
+  if (noCarrossel === null) {
+    return `No Labs, este bônus agora tem a palavra ${noLabs}. Este carrossel foi feito sem palavra-chave; para usar a palavra, crie um carrossel novo.`;
+  }
+  if (noLabs === null) {
+    return `No Labs, este bônus não tem mais palavra-chave. Este carrossel pede a palavra ${noCarrossel}: confira se a automação dela ainda existe.`;
+  }
+  return avisoDePalavraTrocada(noLabs, noCarrossel);
+}
+
+/** O que a chamada pede, no topo da página do carrossel: a palavra, ou, sem ela, a ação (Etapa 8). */
+export function textoDoPedidoDaChamada(l: { palavra: string | null; acao_da_chamada: unknown }): string {
+  if (l.palavra !== null) return `palavra ${l.palavra}`;
+  if (!ehAcaoDaChamada(l.acao_da_chamada)) return "sem palavra-chave";
+  const rotulo = rotuloDaAcao(l.acao_da_chamada);
+  return `sem palavra-chave · a chamada pede: ${rotulo[0].toLowerCase()}${rotulo.slice(1)}`;
+}
```

Em `lib/bonus/publicar-textos.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/publicar-textos.ts b/lib/bonus/publicar-textos.ts
index b5a01b7..c5f4ef3 100644
--- a/lib/bonus/publicar-textos.ts
+++ b/lib/bonus/publicar-textos.ts
@@ -62,9 +62,11 @@ export function tomDoEstadoDaPublicacao(e: EstadoDaPublicacao): TomDoQuadro | nu
 /**
  * O AVISO DO FUNIL (spec da Etapa 7), depois de agendar ou publicar: o post é novo, e a automação da
  * palavra que já existe está presa a outro post (lib/engine.ts:269). Quem liga é o operador, no
- * /automacoes. Antes de mandar, e depois de cancelar ou de falhar, não há post a caminho.
+ * /automacoes. Antes de mandar, e depois de cancelar ou de falhar, não há post a caminho. Sem
+ * palavra-chave (spec da Etapa 8), não há automação para criar, e não há aviso.
  */
-export function textoDoFunil(e: EstadoDaPublicacao, palavra: string): string | null {
+export function textoDoFunil(e: EstadoDaPublicacao, palavra: string | null): string | null {
+  if (palavra === null) return null;
   return e.tipo === "agendado" || e.tipo === "publicando" || e.tipo === "publicado"
     ? `O funil não liga sozinho: depois que o post sair, crie no /automacoes a automação da palavra ${palavra} para este post.`
     : null;
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx vitest run tests/bonus-carrossel-chamada-tela.test.ts tests/bonus-publicar-estado.test.ts
```

Esperado: `tsc` limpo; os 54 passam.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/carrossel-textos.ts lib/bonus/publicar-textos.ts tests/bonus-carrossel-chamada-tela.test.ts tests/bonus-publicar-estado.test.ts
test "$(git branch --show-current)" = "carrossel-sem-palavra"
git add lib/bonus/carrossel-textos.ts lib/bonus/publicar-textos.ts tests/bonus-carrossel-chamada-tela.test.ts tests/bonus-publicar-estado.test.ts
git commit -m "feat(bonus): os textos da página sem palavra-chave, e o funil que some"
```

---

### FASE 8.6 — O carrossel sem palavra-chave na linha, na geração e nas páginas

**Arquivos:**
- Modificar: `lib/bonus/carrossel-linha.ts`, `lib/bonus/carrossel-repositorio.ts`,
  `lib/bonus/carrossel-processo.ts`, `lib/bonus/avulso-processo.ts`, `app/carrosseis/[cid]/page.tsx`, e
  em `app/bonus/[id]/carrossel/[cid]/`: `page.tsx`, `revisao.tsx`, `editor-do-carrossel.tsx`,
  `card-da-parte.tsx`
- Testar: `tests/bonus-avulso-paginas.test.ts`, `tests/bonus-carrosseis-tela.test.ts`,
  `tests/bonus-arte-tela.test.ts`, `tests/bonus-carrossel-tela.test.ts` (as linhas de exemplo ganham
  `acao_da_chamada: null`), `testes-dom/bonus-editor-do-carrossel.dom.tsx`,
  `testes-integracao/bonus-carrossel-avulso.integracao.ts`,
  `testes-integracao/bonus-avulso-processo.integracao.ts`

**Interfaces:**
- Muda: `LinhaDoCarrossel.palavra: string | null` e `acao_da_chamada: AcaoDaChamada | null`;
  `criarCarrosselAvulso({ ..., palavra: string, acao?: null } | { ..., palavra: null, acao })`; o
  `EditorDoCarrossel` com `palavra: string | null` e `acaoDaChamada?`; o `CardDaParte` com `palavra:
  string | null`. A geração (`processarCarrossel`) lê `pedidoDaChamada(linha)`; a linha fora da regra
  vira falha com frase. As duas páginas dizem no topo `textoDoPedidoDaChamada(carrossel)` e avisam
  `avisoDaPalavraNoLabs(...)`.

- [ ] **Passo 1: os testes**

O teste do item da lista passa antes do código, de propósito (item 5 do ensaio).

Em `tests/bonus-avulso-paginas.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-avulso-paginas.test.ts b/tests/bonus-avulso-paginas.test.ts
index a29a10b..8af7a63 100644
--- a/tests/bonus-avulso-paginas.test.ts
+++ b/tests/bonus-avulso-paginas.test.ts
@@ -126,4 +126,20 @@ describe("o menu Carrosséis", () => {
   it("a página do carrossel entrega o aviso do funil, decidido pelo estado da fila", () => {
     expect(ler("app/bonus/[id]/carrossel/[cid]/revisao.tsx")).toContain("avisoDoFunil: textoDoFunil(estado, carrossel.palavra)");
   });
+
+  // O CARROSSEL SEM PALAVRA-CHAVE (spec da Etapa 8): o topo diz a palavra ou a ação, e a palavra no Labs
+  // é comparada pelos dois lados, nas duas páginas. A revisão leva a ação ao editor.
+  it.each(["app/carrosseis/[cid]/page.tsx", "app/bonus/[id]/carrossel/[cid]/page.tsx"])(
+    "%s: o topo diz a palavra ou a ação, e a palavra no Labs vem de avisoDaPalavraNoLabs",
+    (pagina) => {
+      const fonte = ler(pagina);
+      expect(fonte).toContain("{textoDoPedidoDaChamada(carrossel)}");
+      expect(fonte).toContain("avisoDaPalavraNoLabs(situacao.bonus.palavra, carrossel.palavra)");
+      expect(fonte).not.toContain("palavra {carrossel.palavra}");
+    }
+  );
+
+  it("a revisão leva a ação da chamada ao editor", () => {
+    expect(ler("app/bonus/[id]/carrossel/[cid]/revisao.tsx")).toContain("acaoDaChamada={carrossel.acao_da_chamada}");
+  });
 });
```

Em `tests/bonus-carrosseis-tela.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-carrosseis-tela.test.ts b/tests/bonus-carrosseis-tela.test.ts
index 0ebb67e..012795d 100644
--- a/tests/bonus-carrosseis-tela.test.ts
+++ b/tests/bonus-carrosseis-tela.test.ts
@@ -37,11 +37,20 @@ function linha(troca: Partial<LinhaDoCarrossel>): LinhaDoCarrossel {
     origem: "livre",
     labs_codigo: null,
     texto_a_mao: true,
+    acao_da_chamada: null,
     ...troca,
   };
 }
 
 describe("o item da lista Carrosséis", () => {
+  // A lista não mostra a palavra, e não passa a mostrar a ação (decisão do Eduardo em 08/10, spec da
+  // Etapa 8): o item é o mesmo com e sem palavra.
+  it("o item é o mesmo com e sem palavra-chave", () => {
+    expect(itemDaListaDeCarrosseis(linha({ palavra: null, acao_da_chamada: "salvar" }), null, T0)).toEqual(
+      itemDaListaDeCarrosseis(linha({}), null, T0)
+    );
+  });
+
   it("o do texto livre: a página do avulso, o título do texto, a origem, a conta e os slides", () => {
     const item = itemDaListaDeCarrosseis(linha({ arte: { conta: "1001", arroba: "thiagovannuchi" } }), null, T0);
     expect(item).toEqual({
```

Em `tests/bonus-arte-tela.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-arte-tela.test.ts b/tests/bonus-arte-tela.test.ts
index f8c06e5..7d433e5 100644
--- a/tests/bonus-arte-tela.test.ts
+++ b/tests/bonus-arte-tela.test.ts
@@ -209,6 +209,7 @@ describe("o que a rota confere antes de desenhar", () => {
     origem: "bonus",
     labs_codigo: null,
     texto_a_mao: false,
+    acao_da_chamada: null,
     ...troca,
   });
   const DO_BONUS = { tipo: "bonus" as const, bonusId: BONUS };
```

Em `tests/bonus-carrossel-tela.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-carrossel-tela.test.ts b/tests/bonus-carrossel-tela.test.ts
index 1a3b227..2bd7ec9 100644
--- a/tests/bonus-carrossel-tela.test.ts
+++ b/tests/bonus-carrossel-tela.test.ts
@@ -32,6 +32,7 @@ function linha(troca: Partial<LinhaDoCarrossel>): LinhaDoCarrossel {
     origem: "bonus",
     labs_codigo: null,
     texto_a_mao: false,
+    acao_da_chamada: null,
     ...troca,
   };
 }
```

Em `testes-dom/bonus-editor-do-carrossel.dom.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-dom/bonus-editor-do-carrossel.dom.tsx b/testes-dom/bonus-editor-do-carrossel.dom.tsx
index 05a078a..8460d2a 100644
--- a/testes-dom/bonus-editor-do-carrossel.dom.tsx
+++ b/testes-dom/bonus-editor-do-carrossel.dom.tsx
@@ -1,6 +1,7 @@
 import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
 import { afterEach, describe, expect, it, vi } from "vitest";
 import EditorDoCarrossel from "@/app/bonus/[id]/carrossel/[cid]/editor-do-carrossel";
+import type { AcaoDaChamada } from "@/lib/bonus/acao-da-chamada";
 import { urlDaArte } from "@/lib/bonus/arte-tela";
 import type { AvisoDaArte } from "@/lib/bonus/arte-textos";
 import { camposDoFormulario } from "@/lib/bonus/carrossel-texto";
@@ -32,6 +33,8 @@ function renderizar({
   conta = [] as AvisoDaArte[],
   podeFixar = false,
   avisoDaConta = null as string | null,
+  palavra = "SUMIDO" as string | null,
+  acaoDaChamada = null as AcaoDaChamada | null,
 } = {}) {
   const recebidos = { slide: [] as FormData[], arte: [] as FormData[], conta: [] as FormData[] };
   render(
@@ -50,7 +53,8 @@ function renderizar({
       }}
       caminho={CAMINHO}
       carrosselId={CARROSSEL}
-      palavra="SUMIDO"
+      palavra={palavra}
+      acaoDaChamada={acaoDaChamada}
       total={3}
       campos={camposDoFormulario(3)}
       valores={VALORES}
@@ -70,6 +74,19 @@ const soTexto = (n: number) => screen.getByLabelText(`Slide ${n}: só texto, sem
 const cards = () => screen.getAllByRole("listitem");
 
 describe("o editor do carrossel, slide a slide", () => {
+  // O CARROSSEL SEM PALAVRA-CHAVE (spec da Etapa 8): a dica diz a ação, e a chamada que abriu com uma
+  // palavra gritada já avisa, pela regra sem palavra.
+  it("sem palavra-chave, a dica diz a ação, e a chamada avisa a palavra gritada", () => {
+    renderizar({ palavra: null, acaoDaChamada: "salvar" });
+    expect(screen.getByText(/Este carrossel não tem palavra-chave: a chamada pede/).textContent).toBe(
+      "Este carrossel não tem palavra-chave: a chamada pede salvar o post, e não pode ter palavra em maiúsculas."
+    );
+    expect(screen.queryByText(/A chamada pede a palavra/)).toBeNull();
+    expect(
+      screen.getByText("Tem SUMIDO em maiúsculas: este carrossel não tem palavra-chave, e quem comentar uma palavra não recebe nada.")
+    ).toBeTruthy();
+  });
+
   it("um card por slide, na ordem, e o da legenda por último", () => {
     renderizar();
     expect(cards().map((c) => within(c).getByRole("heading").textContent)).toEqual(["Slide 1", "Slide 2", "Slide 3", "Legenda"]);
```

Em `testes-integracao/bonus-carrossel-avulso.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/bonus-carrossel-avulso.integracao.ts b/testes-integracao/bonus-carrossel-avulso.integracao.ts
index 7e3f329..a78f0ff 100644
--- a/testes-integracao/bonus-carrossel-avulso.integracao.ts
+++ b/testes-integracao/bonus-carrossel-avulso.integracao.ts
@@ -48,26 +48,30 @@ beforeEach(async () => {
 });
 
 type PedidoAvulso = Parameters<ModuloRepo["criarCarrosselAvulso"]>[0];
-const doLabs = (troca: Partial<PedidoAvulso> = {}): PedidoAvulso => ({
-  origem: "labs",
-  labsCodigo: CODIGO,
-  total: 5,
-  palavra: "BRUTAL",
-  contexto: DO_LABS,
-  conta: null,
-  texto: null,
-  ...troca,
-});
-const livre = (troca: Partial<PedidoAvulso> = {}): PedidoAvulso => ({
-  origem: "livre",
-  labsCodigo: null,
-  total: 5,
-  palavra: "BRUTAL",
-  contexto: LIVRE,
-  conta: null,
-  texto: null,
-  ...troca,
-});
+// A palavra e a ação são uma união (com palavra, ou sem palavra e com a ação, Etapa 8): a troca parcial
+// não sabe disso, e o resultado é conferido pelo banco.
+const doLabs = (troca: Partial<PedidoAvulso> = {}): PedidoAvulso =>
+  ({
+    origem: "labs",
+    labsCodigo: CODIGO,
+    total: 5,
+    palavra: "BRUTAL",
+    contexto: DO_LABS,
+    conta: null,
+    texto: null,
+    ...troca,
+  }) as PedidoAvulso;
+const livre = (troca: Partial<PedidoAvulso> = {}): PedidoAvulso =>
+  ({
+    origem: "livre",
+    labsCodigo: null,
+    total: 5,
+    palavra: "BRUTAL",
+    contexto: LIVRE,
+    conta: null,
+    texto: null,
+    ...troca,
+  }) as PedidoAvulso;
 
 async function criado(p: PedidoAvulso): Promise<string> {
   const r = await repo.criarCarrosselAvulso(p);
@@ -206,3 +210,75 @@ describe("a lista de todos os carrosséis", () => {
     ]);
   });
 });
+
+// O CARROSSEL SEM PALAVRA-CHAVE (spec da Etapa 8): a palavra nula e a ação gravadas, a IA recebendo a
+// ação, a conferência sem palavra gritada na chamada, e o salvar de cada slide pela mesma regra.
+describe("o carrossel sem palavra-chave", () => {
+  const SEM: TextoDeCarrossel = {
+    ...TEXTO,
+    chamada: "Salve este post para reler antes de mostrar o plano a alguém.",
+    legenda: "Antes de mostrar o seu plano a alguém, leia de novo estes pontos e salve para não esquecer.",
+  };
+
+  it("do texto livre e do Labs, pela IA: a palavra nula e a ação gravadas", async () => {
+    expect(await repo.lerCarrossel(await criado(livre({ palavra: null, acao: "salvar" })))).toMatchObject({
+      origem: "livre",
+      palavra: null,
+      acao_da_chamada: "salvar",
+      estado: "pendente",
+    });
+    expect(await repo.lerCarrossel(await criado(doLabs({ palavra: null, acao: "comentar" })))).toMatchObject({
+      origem: "labs",
+      labs_codigo: CODIGO,
+      palavra: null,
+      acao_da_chamada: "comentar",
+    });
+  });
+
+  it("com a palavra, a ação fica nula, como hoje", async () => {
+    expect(await repo.lerCarrossel(await criado(livre()))).toMatchObject({ palavra: "BRUTAL", acao_da_chamada: null });
+  });
+
+  it("escrito à mão: nasce pronto, sem palavra e com a ação", async () => {
+    expect(await repo.lerCarrossel(await criado(livre({ palavra: null, acao: "seguir", texto: SEM })))).toMatchObject({
+      estado: "pronto",
+      texto_a_mao: true,
+      palavra: null,
+      acao_da_chamada: "seguir",
+      gerado: SEM,
+    });
+  });
+
+  it("a IA recebe a ação, e a chamada sem palavra gritada fica pronta", async () => {
+    const id = await criado(livre({ palavra: null, acao: "seguir" }));
+    let recebido: unknown = null;
+    await processo.processarCarrossel(id, async (p) => {
+      recebido = p;
+      return { ok: true as const, texto: SEM, medicao: MEDICAO };
+    });
+    expect(recebido).toEqual({ total: 5, palavra: null, acao: "seguir", contexto: LIVRE });
+    expect(await repo.lerCarrossel(id)).toMatchObject({ estado: "pronto", gerado: SEM });
+  });
+
+  it("a chamada com palavra gritada falha, com a frase", async () => {
+    const id = await criado(livre({ palavra: null, acao: "salvar" }));
+    await processo.processarCarrossel(id, async () => ({ ok: true as const, texto: TEXTO, medicao: MEDICAO }));
+    expect(await repo.lerCarrossel(id)).toMatchObject({
+      estado: "falhou",
+      erro: "A chamada tem BRUTAL em maiúsculas, e este carrossel não tem palavra-chave. Gere de novo.",
+    });
+  });
+
+  it("salvar a chamada (o último slide) segue a regra sem palavra", async () => {
+    const id = await criado(livre({ palavra: null, acao: "salvar", texto: SEM }));
+    const ultimo = { tipo: "slide" as const, numero: 5 };
+    expect(await repo.salvarParteDoCarrossel(id, ultimo, { chamada: "Comente GUIA e receba o roteiro." }, null)).toEqual({
+      ok: false,
+      motivo: "problemas",
+      problemas: [{ campo: "chamada", erro: "não pode ter palavra em maiúsculas (GUIA): este carrossel não tem palavra-chave" }],
+    });
+    const nova = "Compartilhe com quem precisa ouvir isso hoje.";
+    const r = await repo.salvarParteDoCarrossel(id, ultimo, { chamada: nova }, null);
+    expect(r.ok && r.texto.chamada).toBe(nova);
+  });
+});
```

Em `testes-integracao/bonus-avulso-processo.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/bonus-avulso-processo.integracao.ts b/testes-integracao/bonus-avulso-processo.integracao.ts
index 98b27a9..1acc005 100644
--- a/testes-integracao/bonus-avulso-processo.integracao.ts
+++ b/testes-integracao/bonus-avulso-processo.integracao.ts
@@ -240,3 +240,26 @@ describe("gerar de novo o carrossel avulso", () => {
     expect(await contar()).toBe(1);
   });
 });
+
+// O "GERAR DE NOVO" SEM PALAVRA-CHAVE (spec da Etapa 8): o do texto livre repete a ação gravada.
+describe("gerar de novo o carrossel avulso sem palavra-chave", () => {
+  it("o do texto livre repete a palavra nula e a ação gravadas", async () => {
+    const criado = await repo.criarCarrosselAvulso({
+      origem: "livre",
+      labsCodigo: null,
+      total: 4,
+      palavra: null,
+      acao: "compartilhar",
+      contexto: { tipo: "livre", tema: "Vendas", conteudo: "Como vender sem parecer chato, em cinco passos." },
+      conta: THIAGO,
+      texto: null,
+    });
+    if (!criado.ok) throw new Error("teto no meio do teste");
+    await banco.db().sql().query(`update carrosseis_gerados set estado = 'falhou', erro = 'A API recusou.' where id = $1`, [criado.id]);
+    const l = labs(publicado());
+    const r = await processo.gerarAvulsoDeNovo({ linha: (await repo.lerCarrossel(criado.id))!, conta: THIAGO, lerSituacao: l.lerSituacao, agora: Date.now() });
+    if (!r.ok) throw new Error(r.texto);
+    expect(l.perguntados).toEqual([]);
+    expect(await repo.lerCarrossel(r.id)).toMatchObject({ origem: "livre", estado: "pendente", palavra: null, acao_da_chamada: "compartilhar", total_slides: 4 });
+  });
+});
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-avulso-paginas.test.ts tests/bonus-carrosseis-tela.test.ts tests/bonus-arte-tela.test.ts tests/bonus-carrossel-tela.test.ts
npx vitest run --config vitest.dom.config.ts testes-dom/bonus-editor-do-carrossel.dom.tsx
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-carrossel-avulso.integracao.ts testes-integracao/bonus-avulso-processo.integracao.ts
```

Esperado: os puros: 3 caem e 70 passam (73); a tela: 1 cai e 8 passam (9); na integração,
`[rede-global] ALVO: banco de TESTE`, 6 caem e 23 passam (29).

- [ ] **Passo 3: o código**

Em `lib/bonus/carrossel-linha.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/carrossel-linha.ts b/lib/bonus/carrossel-linha.ts
index 19b0922..9932cb1 100644
--- a/lib/bonus/carrossel-linha.ts
+++ b/lib/bonus/carrossel-linha.ts
@@ -1,5 +1,6 @@
 // A LINHA DE `carrosseis_gerados` como o driver a devolve (migrations/014-carrosseis-gerados.sql).
 // Só tipos: é o que carrossel-repositorio.ts (server-only) e carrossel-tela.ts (puro) compartilham.
+import type { AcaoDaChamada } from "./acao-da-chamada";
 import type { EstadoDaGeracao } from "./tempos";
 
 /**
@@ -14,7 +15,8 @@ export type LinhaDoCarrossel = {
   bonus_id: string | null;
   criado_em: Date;
   total_slides: number;
-  palavra: string;
+  /** Nula no carrossel sem palavra-chave (migrations/017-carrossel-sem-palavra.sql). */
+  palavra: string | null;
   contexto: unknown;
   estado: EstadoDaGeracao;
   gerado: unknown;
@@ -30,4 +32,6 @@ export type LinhaDoCarrossel = {
   labs_codigo: string | null;
   /** Escrito à mão pelo operador: não gastou IA e não conta no teto. */
   texto_a_mao: boolean;
+  /** O que a chamada pede quando não há palavra (a 017): o banco garante palavra OU ação. */
+  acao_da_chamada: AcaoDaChamada | null;
 };
```

Em `lib/bonus/carrossel-repositorio.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/carrossel-repositorio.ts b/lib/bonus/carrossel-repositorio.ts
index 29b5925..fb28a16 100644
--- a/lib/bonus/carrossel-repositorio.ts
+++ b/lib/bonus/carrossel-repositorio.ts
@@ -1,5 +1,6 @@
 import "server-only";
 import { sql } from "@/lib/db";
+import type { AcaoDaChamada } from "./acao-da-chamada";
 import type { ContaDoCabecalho, ContaGuardada } from "./arte-conta";
 import type { ContextoDoCarrossel } from "./carrossel-ia-parametros";
 import type { LinhaDoCarrossel } from "./carrossel-linha";
@@ -86,30 +87,35 @@ export async function criarPedidoDeCarrossel(p: {
  * Escrito à mão (`texto`, já conferido por quem chama), ele nasce pronto, marcado à mão, e fica fora
  * do teto e da trava: não gasta IA. A conta é gravada como no pedido de bônus. O banco recusa a
  * origem que não combina com o código (migrations/016-carrossel-avulso.sql).
+ *
+ * SEM PALAVRA-CHAVE (spec da Etapa 8), a palavra é nula e a ação vai junto; com a palavra, a ação fica
+ * nula. O banco recusa as duas juntas, e nenhuma das duas (migrations/017-carrossel-sem-palavra.sql).
  */
-export async function criarCarrosselAvulso(p: {
-  origem: "labs" | "livre";
-  labsCodigo: string | null;
-  total: number;
-  palavra: string;
-  contexto: ContextoDoCarrossel;
-  conta: ContaGuardada | null;
-  texto: TextoDoCarrossel | null;
-}): Promise<{ ok: true; id: string } | { ok: false }> {
+export async function criarCarrosselAvulso(
+  p: {
+    origem: "labs" | "livre";
+    labsCodigo: string | null;
+    total: number;
+    contexto: ContextoDoCarrossel;
+    conta: ContaGuardada | null;
+    texto: TextoDoCarrossel | null;
+  } & ({ palavra: string; acao?: null } | { palavra: null; acao: AcaoDaChamada })
+): Promise<{ ok: true; id: string } | { ok: false }> {
   const arte = p.conta?.conta ? chavesDaConta(p.conta) : {};
+  const acao = p.palavra === null ? p.acao : null;
   if (p.texto) {
     const [criada] = (await sql().query(
-      `insert into carrosseis_gerados (origem, labs_codigo, total_slides, palavra, contexto, arte, estado, gerado, gerado_em, texto_a_mao)
-       values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, 'pronto', $7::jsonb, now(), true) returning id`,
-      [p.origem, p.labsCodigo, p.total, p.palavra, p.contexto, arte, p.texto]
+      `insert into carrosseis_gerados (origem, labs_codigo, total_slides, palavra, acao_da_chamada, contexto, arte, estado, gerado, gerado_em, texto_a_mao)
+       values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, 'pronto', $8::jsonb, now(), true) returning id`,
+      [p.origem, p.labsCodigo, p.total, p.palavra, acao, p.contexto, arte, p.texto]
     )) as { id: string }[];
     return { ok: true, id: criada.id };
   }
   return comTeto(async (tx) => {
     const [criada] = (await tx.query(
-      `insert into carrosseis_gerados (origem, labs_codigo, total_slides, palavra, contexto, arte)
-       values ($1, $2, $3, $4, $5::jsonb, $6::jsonb) returning id`,
-      [p.origem, p.labsCodigo, p.total, p.palavra, p.contexto, arte]
+      `insert into carrosseis_gerados (origem, labs_codigo, total_slides, palavra, acao_da_chamada, contexto, arte)
+       values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb) returning id`,
+      [p.origem, p.labsCodigo, p.total, p.palavra, acao, p.contexto, arte]
     )) as { id: string }[];
     return criada.id;
   });
```

Em `lib/bonus/carrossel-processo.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/carrossel-processo.ts b/lib/bonus/carrossel-processo.ts
index 2bf1f81..e0adff5 100644
--- a/lib/bonus/carrossel-processo.ts
+++ b/lib/bonus/carrossel-processo.ts
@@ -1,4 +1,5 @@
 import "server-only";
+import { pedidoDaChamada } from "./acao-da-chamada";
 import { gerarTextoDoCarrossel, type ResultadoDoCarrossel } from "./carrossel-ia";
 import { contextoGravado, type PedidoParaIA } from "./carrossel-ia-parametros";
 import { gravarCarrosselPronto, gravarFalhaDoCarrossel, reivindicarCarrossel } from "./carrossel-repositorio";
@@ -21,13 +22,23 @@ export async function processarCarrossel(id: string, gerar: GeradorDeCarrossel =
       await gravarFalhaDoCarrossel(id, "O pedido deste carrossel foi gravado sem o contexto do bônus. Gere de novo.", null);
       return;
     }
-    const r = await gerar({ total: linha.total_slides, palavra: linha.palavra, contexto });
+    // A palavra, ou, sem ela, a ação (spec da Etapa 8). O banco garante uma das duas; a linha fora da
+    // regra vira falha com frase, e nunca uma geração sem saber o que a chamada pede.
+    const chamada = pedidoDaChamada(linha);
+    if (!chamada) {
+      await gravarFalhaDoCarrossel(id, "O pedido deste carrossel foi gravado sem a palavra e sem a ação da chamada. Gere de novo.", null);
+      return;
+    }
+    const total = linha.total_slides;
+    const r = await gerar(
+      chamada.palavra === null ? { total, palavra: null, acao: chamada.acao, contexto } : { total, palavra: chamada.palavra, contexto }
+    );
     if (!r.ok) {
       await gravarFalhaDoCarrossel(id, r.erro, r.medicao);
       return;
     }
-    const falha = conferirGerado(linha.total_slides, linha.palavra, r.texto);
-    if (falha) await gravarFalhaDoCarrossel(id, textoDaConferencia(falha, linha.palavra), r.medicao);
+    const falha = conferirGerado(total, chamada.palavra, r.texto);
+    if (falha) await gravarFalhaDoCarrossel(id, textoDaConferencia(falha, chamada.palavra), r.medicao);
     else await gravarCarrosselPronto(id, r.texto, r.medicao);
   } catch (e) {
     try {
```

Em `lib/bonus/avulso-processo.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/avulso-processo.ts b/lib/bonus/avulso-processo.ts
index be9ca71..196a2ca 100644
--- a/lib/bonus/avulso-processo.ts
+++ b/lib/bonus/avulso-processo.ts
@@ -1,4 +1,5 @@
 import "server-only";
+import { pedidoDaChamada, type PedidoDaChamada } from "./acao-da-chamada";
 import type { ContaGuardada } from "./arte-conta";
 import { contextoDoLabs, contextoLivre, tituloInterno, type PedidoAvulso } from "./avulso-pedido";
 import { contextoGravado, type ContextoDoCarrossel } from "./carrossel-ia-parametros";
@@ -35,10 +36,15 @@ async function doLabs(
   codigo: string,
   oQueResolve: string,
   lerSituacao: LerSituacao
-): Promise<{ ok: true; palavra: string; contexto: ContextoDoCarrossel } | Recusa> {
+): Promise<{ ok: true; chamada: PedidoDaChamada; contexto: ContextoDoCarrossel } | Recusa> {
   const s = await lerSituacao(codigo);
   if (s.tipo !== "publicado") return { ok: false, texto: quadroDaSituacao(s).texto };
-  return { ok: true, palavra: s.bonus.palavra, contexto: contextoDoLabs({ codigo, ...s.bonus }, oQueResolve) };
+  return { ok: true, chamada: { palavra: s.bonus.palavra, acao: null }, contexto: contextoDoLabs({ codigo, ...s.bonus }, oQueResolve) };
+}
+
+/** As colunas da palavra e da ação, para gravar (`criarCarrosselAvulso`). */
+function colunasDaChamada(c: PedidoDaChamada) {
+  return c.palavra === null ? { palavra: null, acao: c.acao } : { palavra: c.palavra };
 }
 
 /**
@@ -58,12 +64,12 @@ export async function pedirAvulso(p: {
   const origem =
     pedido.origem === "labs"
       ? await doLabs(pedido.codigo, pedido.destaque, p.lerSituacao)
-      : { ok: true as const, palavra: pedido.palavra, contexto: contextoLivre(pedido) };
+      : { ok: true as const, chamada: { palavra: pedido.palavra, acao: null } as PedidoDaChamada, contexto: contextoLivre(pedido) };
   if (!origem.ok) return origem;
 
   let texto: TextoDoCarrossel | null = null;
   if (pedido.jeito === "mao") {
-    const lido = lerRevisaoDoCarrossel(pedido.total, origem.palavra, tituloInterno(origem.contexto), p.bruto);
+    const lido = lerRevisaoDoCarrossel(pedido.total, origem.chamada.palavra, tituloInterno(origem.contexto), p.bruto);
     if (!lido.ok) return { ok: false, texto: `Corrija antes de criar. ${textoDosProblemasDoCarrossel(pedido.total, lido.problemas)}` };
     texto = lido.texto;
   }
@@ -72,7 +78,7 @@ export async function pedirAvulso(p: {
     origem: pedido.origem,
     labsCodigo: pedido.origem === "labs" ? pedido.codigo : null,
     total: pedido.total,
-    palavra: origem.palavra,
+    ...colunasDaChamada(origem.chamada),
     contexto: origem.contexto,
     conta: p.conta,
     texto,
@@ -84,8 +90,8 @@ export async function pedirAvulso(p: {
 /**
  * O "GERAR DE NOVO" DO AVULSO: um carrossel novo, da mesma origem e com o mesmo total, a partir do que
  * falhou ou travou. O do Labs relê o Labs pelo código, como o de bônus faz (`gerarCarrosselDeNovo`), e
- * mantém o destaque gravado; o do texto livre reaproveita o tema, o conteúdo e a palavra gravados,
- * porque não há outro lugar de onde lê-los. A conta é a do original (`contaParaGerarDeNovo`, na action).
+ * mantém o destaque gravado; o do texto livre reaproveita o tema, o conteúdo e a palavra gravados (ou,
+ * sem palavra, a ação: spec da Etapa 8), porque não há outro lugar de onde lê-los. A conta é a do original (`contaParaGerarDeNovo`, na action).
  */
 export async function gerarAvulsoDeNovo(p: {
   linha: LinhaDoCarrossel;
@@ -98,12 +104,13 @@ export async function gerarAvulsoDeNovo(p: {
   if (naTela !== "falhou" && naTela !== "travou") return { ok: false, texto: TEXTO_NAO_DA_PARA_GERAR_CARROSSEL_DE_NOVO };
 
   const gravado = contextoGravado(linha.contexto);
-  let origem: { ok: true; palavra: string; contexto: ContextoDoCarrossel } | Recusa;
+  let origem: { ok: true; chamada: PedidoDaChamada; contexto: ContextoDoCarrossel } | Recusa;
   if (linha.origem === "labs" && linha.labs_codigo) {
     const destaque = gravado && !("tipo" in gravado) ? gravado.oQueResolve : "";
     origem = await doLabs(linha.labs_codigo, destaque, p.lerSituacao);
   } else if (linha.origem === "livre" && gravado && "tipo" in gravado) {
-    origem = { ok: true, palavra: linha.palavra, contexto: gravado };
+    const chamada = pedidoDaChamada(linha);
+    origem = chamada ? { ok: true, chamada, contexto: gravado } : { ok: false, texto: TEXTO_AVULSO_SEM_CONTEXTO };
   } else {
     origem = { ok: false, texto: TEXTO_AVULSO_SEM_CONTEXTO };
   }
@@ -113,7 +120,7 @@ export async function gerarAvulsoDeNovo(p: {
     origem: linha.origem === "labs" ? "labs" : "livre",
     labsCodigo: linha.origem === "labs" ? linha.labs_codigo : null,
     total: linha.total_slides,
-    palavra: origem.palavra,
+    ...colunasDaChamada(origem.chamada),
     contexto: origem.contexto,
     conta: p.conta,
     texto: null,
```

Em `app/carrosseis/[cid]/page.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/carrosseis/[cid]/page.tsx b/app/carrosseis/[cid]/page.tsx
index 7e0f3ee..c9730c4 100644
--- a/app/carrosseis/[cid]/page.tsx
+++ b/app/carrosseis/[cid]/page.tsx
@@ -9,7 +9,12 @@ import { ehDaRota } from "@/lib/bonus/carrossel-caminho";
 import type { LinhaDoCarrossel } from "@/lib/bonus/carrossel-linha";
 import { lerCarrossel } from "@/lib/bonus/carrossel-repositorio";
 import { descricaoDoCarrossel, textoDaLinhaDoCarrossel } from "@/lib/bonus/carrossel-tela";
-import { TEXTO_TABELA_CARROSSEL_AUSENTE, avisoDePalavraTrocada, quadroDaSituacao } from "@/lib/bonus/carrossel-textos";
+import {
+  TEXTO_TABELA_CARROSSEL_AUSENTE,
+  avisoDaPalavraNoLabs,
+  quadroDaSituacao,
+  textoDoPedidoDaChamada,
+} from "@/lib/bonus/carrossel-textos";
 import { ehTabelaAusente } from "@/lib/bonus/erros";
 import { urlPublicaDoBonus } from "@/lib/bonus/labs";
 import { situacaoNoLabs } from "@/lib/bonus/publicado";
@@ -62,8 +67,8 @@ export default async function PaginaDoAvulso({
   const codigo = carrossel.origem === "labs" ? carrossel.labs_codigo : null;
   const situacao = codigo && geracao !== "gerando" ? await situacaoNoLabs(process.env.LABS_URL, codigo) : null;
   const quadro = situacao ? quadroDaSituacao(situacao) : null;
-  const trocada =
-    situacao?.tipo === "publicado" && situacao.bonus.palavra !== carrossel.palavra ? situacao.bonus.palavra : null;
+  // A palavra no Labs comparada com a do carrossel, com os dois lados do sem palavra-chave (Etapa 8).
+  const avisoDaPalavra = situacao?.tipo === "publicado" ? avisoDaPalavraNoLabs(situacao.bonus.palavra, carrossel.palavra) : null;
   const publico = codigo ? urlPublicaDoBonus(process.env.LABS_URL, codigo) : null;
 
   return (
@@ -74,7 +79,7 @@ export default async function PaginaDoAvulso({
         </Link>
         <h1 className={`mt-2 ${pageTitle}`}>{texto?.titulo ?? descricaoDoCarrossel(carrossel)}</h1>
         <p className={pageSubtitle}>
-          {textoDaOrigem(carrossel)} · {descricaoDoCarrossel(carrossel)} · palavra {carrossel.palavra}
+          {textoDaOrigem(carrossel)} · {descricaoDoCarrossel(carrossel)} · {textoDoPedidoDaChamada(carrossel)}
         </p>
         {publico && (
           <a href={publico} target="_blank" rel="noreferrer" className={`mt-1 inline-block text-sm ${link}`}>
@@ -85,7 +90,7 @@ export default async function PaginaDoAvulso({
 
       {aviso && <div className={aviso.tom === "ok" ? alertOk : alertError}>{aviso.texto}</div>}
       {quadro && <div className={QUADRO[quadro.tom]}>{quadro.texto}</div>}
-      {trocada && <div className={alertWarn}>{avisoDePalavraTrocada(trocada, carrossel.palavra)}</div>}
+      {avisoDaPalavra && <div className={alertWarn}>{avisoDaPalavra}</div>}
 
       {geracao === "gerando" && (
         <section className={`${card} space-y-3 p-6`}>
```

Em `app/bonus/[id]/carrossel/[cid]/page.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/[id]/carrossel/[cid]/page.tsx b/app/bonus/[id]/carrossel/[cid]/page.tsx
index 812b361..257cd78 100644
--- a/app/bonus/[id]/carrossel/[cid]/page.tsx
+++ b/app/bonus/[id]/carrossel/[cid]/page.tsx
@@ -7,7 +7,12 @@ import { ehDaRota } from "@/lib/bonus/carrossel-caminho";
 import type { LinhaDoCarrossel } from "@/lib/bonus/carrossel-linha";
 import { lerCarrossel } from "@/lib/bonus/carrossel-repositorio";
 import { descricaoDoCarrossel, textoDaLinhaDoCarrossel } from "@/lib/bonus/carrossel-tela";
-import { TEXTO_TABELA_CARROSSEL_AUSENTE, avisoDePalavraTrocada, quadroDaSituacao } from "@/lib/bonus/carrossel-textos";
+import {
+  TEXTO_TABELA_CARROSSEL_AUSENTE,
+  avisoDaPalavraNoLabs,
+  quadroDaSituacao,
+  textoDoPedidoDaChamada,
+} from "@/lib/bonus/carrossel-textos";
 import { ehTabelaAusente } from "@/lib/bonus/erros";
 import { situacaoNoLabs, type SituacaoNoLabs } from "@/lib/bonus/publicado";
 import { lerLinha } from "@/lib/bonus/repositorio";
@@ -60,8 +65,8 @@ export default async function PaginaDoCarrossel({
   // Labs de novo, sem nada a mostrar ainda.
   const situacao = geracao === "gerando" ? null : await situacaoDoBonus(id);
   const quadro = situacao ? quadroDaSituacao(situacao) : null;
-  const trocada =
-    situacao?.tipo === "publicado" && situacao.bonus.palavra !== carrossel.palavra ? situacao.bonus.palavra : null;
+  // A palavra no Labs comparada com a do carrossel, com os dois lados do sem palavra-chave (Etapa 8).
+  const avisoDaPalavra = situacao?.tipo === "publicado" ? avisoDaPalavraNoLabs(situacao.bonus.palavra, carrossel.palavra) : null;
 
   return (
     <div className="space-y-6">
@@ -71,13 +76,13 @@ export default async function PaginaDoCarrossel({
         </Link>
         <h1 className={`mt-2 ${pageTitle}`}>{texto?.titulo ?? descricaoDoCarrossel(carrossel)}</h1>
         <p className={pageSubtitle}>
-          {descricaoDoCarrossel(carrossel)} · palavra {carrossel.palavra}
+          {descricaoDoCarrossel(carrossel)} · {textoDoPedidoDaChamada(carrossel)}
         </p>
       </div>
 
       {aviso && <div className={aviso.tom === "ok" ? alertOk : alertError}>{aviso.texto}</div>}
       {quadro && <div className={QUADRO[quadro.tom]}>{quadro.texto}</div>}
-      {trocada && <div className={alertWarn}>{avisoDePalavraTrocada(trocada, carrossel.palavra)}</div>}
+      {avisoDaPalavra && <div className={alertWarn}>{avisoDaPalavra}</div>}
 
       {geracao === "gerando" && (
         <section className={`${card} space-y-3 p-6`}>
```

Em `app/bonus/[id]/carrossel/[cid]/revisao.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/[id]/carrossel/[cid]/revisao.tsx b/app/bonus/[id]/carrossel/[cid]/revisao.tsx
index 4bd3bb0..046529f 100644
--- a/app/bonus/[id]/carrossel/[cid]/revisao.tsx
+++ b/app/bonus/[id]/carrossel/[cid]/revisao.tsx
@@ -87,6 +87,7 @@ export default async function Revisao({ carrossel }: { carrossel: LinhaDoCarross
       caminho={caminhoDoCarrossel(carrossel)}
       carrosselId={carrossel.id}
       palavra={carrossel.palavra}
+      acaoDaChamada={carrossel.acao_da_chamada}
       total={carrossel.total_slides}
       campos={camposDoFormulario(carrossel.total_slides)}
       valores={valoresPorCampo(texto)}
```

Em `app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx b/app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx
index 52b8084..7121cf2 100644
--- a/app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx
+++ b/app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx
@@ -1,6 +1,7 @@
 "use client";
 import { useActionState, useCallback, useRef, useState, useTransition } from "react";
 import { alertError, alertOk, alertWarn, btnPrimary, btnSecondary, card, hint } from "@/app/ui";
+import { rotuloDaAcao, type AcaoDaChamada } from "@/lib/bonus/acao-da-chamada";
 import { urlDaArte } from "@/lib/bonus/arte-tela";
 import { textoDoBaixarTodos, type AvisoDaArte } from "@/lib/bonus/arte-textos";
 import { camposDaParte, type CampoDoCarrossel, type ParteDoCarrossel } from "@/lib/bonus/carrossel-texto";
@@ -40,6 +41,7 @@ export default function EditorDoCarrossel({
   caminho,
   carrosselId,
   palavra,
+  acaoDaChamada = null,
   total,
   campos,
   valores,
@@ -56,7 +58,9 @@ export default function EditorDoCarrossel({
   acaoDaConta: (anterior: AvisoDaArte | null, form: FormData) => Promise<AvisoDaArte | null>;
   caminho: string;
   carrosselId: string;
-  palavra: string;
+  /** Nula no carrossel sem palavra-chave (spec da Etapa 8), que traz a ação em `acaoDaChamada`. */
+  palavra: string | null;
+  acaoDaChamada?: AcaoDaChamada | null;
   total: number;
   campos: CampoDoCarrossel[];
   valores: Record<string, string>;
@@ -174,9 +178,17 @@ export default function EditorDoCarrossel({
             </p>
           )}
         </div>
-        <p className={hint}>
-          A chamada pede a palavra <strong>{palavra}</strong>. Ela vem do bônus e não se edita aqui.
-        </p>
+        {palavra !== null ? (
+          <p className={hint}>
+            A chamada pede a palavra <strong>{palavra}</strong>. Ela vem do bônus e não se edita aqui.
+          </p>
+        ) : (
+          <p className={hint}>
+            Este carrossel não tem palavra-chave: a chamada pede{" "}
+            <strong>{acaoDaChamada ? rotuloDaAcao(acaoDaChamada).toLowerCase() : "outra ação"}</strong>, e não pode ter
+            palavra em maiúsculas.
+          </p>
+        )}
 
         <ul className="space-y-4">
           {slides.map((n) => (
```

Em `app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx b/app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx
index 121e468..c8c376d 100644
--- a/app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx
+++ b/app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx
@@ -59,7 +59,8 @@ export default function CardDaParte({
   acao: (anterior: AvisoDoSlide | null, form: FormData) => Promise<AvisoDoSlide | null>;
   caminho: string;
   carrosselId: string;
-  palavra: string;
+  /** Nula no carrossel sem palavra-chave (spec da Etapa 8): a chamada avisa toda palavra gritada. */
+  palavra: string | null;
   total: number;
   parte: ParteDoCarrossel;
   campos: CampoDoCarrossel[];
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx vitest run tests/bonus-avulso-paginas.test.ts tests/bonus-carrosseis-tela.test.ts tests/bonus-arte-tela.test.ts tests/bonus-carrossel-tela.test.ts
npx vitest run --config vitest.dom.config.ts testes-dom/bonus-editor-do-carrossel.dom.tsx
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-carrossel-avulso.integracao.ts testes-integracao/bonus-avulso-processo.integracao.ts
```

Esperado: `tsc` limpo; 73 casos puros e 9 de tela passam; na integração, `[rede-global] ALVO: banco de
TESTE` e os 29 passam.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/carrossel-linha.ts lib/bonus/carrossel-repositorio.ts lib/bonus/carrossel-processo.ts lib/bonus/avulso-processo.ts "app/carrosseis/[cid]/page.tsx" "app/bonus/[id]/carrossel/[cid]/page.tsx" "app/bonus/[id]/carrossel/[cid]/revisao.tsx" "app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx" "app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx" tests/bonus-avulso-paginas.test.ts tests/bonus-carrosseis-tela.test.ts tests/bonus-arte-tela.test.ts tests/bonus-carrossel-tela.test.ts testes-dom/bonus-editor-do-carrossel.dom.tsx testes-integracao/bonus-carrossel-avulso.integracao.ts testes-integracao/bonus-avulso-processo.integracao.ts
test "$(git branch --show-current)" = "carrossel-sem-palavra"
git add lib/bonus/carrossel-linha.ts lib/bonus/carrossel-repositorio.ts lib/bonus/carrossel-processo.ts lib/bonus/avulso-processo.ts "app/carrosseis/[cid]/page.tsx" "app/bonus/[id]/carrossel/[cid]/page.tsx" "app/bonus/[id]/carrossel/[cid]/revisao.tsx" "app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx" "app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx" tests/bonus-avulso-paginas.test.ts tests/bonus-carrosseis-tela.test.ts tests/bonus-arte-tela.test.ts tests/bonus-carrossel-tela.test.ts testes-dom/bonus-editor-do-carrossel.dom.tsx testes-integracao/bonus-carrossel-avulso.integracao.ts testes-integracao/bonus-avulso-processo.integracao.ts
git commit -m "feat(bonus): o carrossel sem palavra-chave na linha, na geração e nas páginas"
```

---

### FASE 8.7 — A regra do avulso do Labs, separada da do bônus do Chat

**Arquivos:**
- Modificar: `lib/bonus/publicado.ts`, `lib/bonus/avulso-textos.ts`, `lib/bonus/carrossel-textos.ts`
- Testar: `tests/bonus-publicado.test.ts`, `tests/bonus-lista-do-labs-textos.test.ts` (novo)

**Interfaces:**
- Produz: `type BonusDoAvulso` (a palavra `string | null`); `type SituacaoDoAvulso`;
  `situacaoNaListaDoAvulso(corpo, codigo)`; `situacaoDoAvulsoNoLabs(base, codigo, fetchImpl?)`; `type
  BonusDeFora = { semTema; palavraForaDoPadrao; formatoEstranho }`; `textoDosBonusDeFora(d): string |
  null`.
- Muda: `type BonusDoLabs = BonusDoAvulso & { codigo }`; `bonusDaLista(corpo): { bonus; deFora } |
  null`; `ListaDoLabs` com `deFora`; `quadroDaSituacao(s: SituacaoNoLabs | SituacaoDoAvulso)` ("Publicado
  no Labs · sem palavra-chave"). `situacaoNaLista` e `situacaoNoLabs` (a regra do bônus do Chat) não
  mudam.

- [ ] **Passo 1: os testes**

Em `tests/bonus-publicado.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-publicado.test.ts b/tests/bonus-publicado.test.ts
index 6c5f58f..b065757 100644
--- a/tests/bonus-publicado.test.ts
+++ b/tests/bonus-publicado.test.ts
@@ -1,5 +1,13 @@
 import { describe, expect, it, vi } from "vitest";
-import { LISTA_MAX_BYTES, bonusDaLista, listaDoLabs, situacaoNaLista, situacaoNoLabs } from "@/lib/bonus/publicado";
+import {
+  LISTA_MAX_BYTES,
+  bonusDaLista,
+  listaDoLabs,
+  situacaoDoAvulsoNoLabs,
+  situacaoNaLista,
+  situacaoNaListaDoAvulso,
+  situacaoNoLabs,
+} from "@/lib/bonus/publicado";
 
 // O item como a lista pública do Labs o devolve (medido ao vivo em 30/09).
 const ITEM = {
@@ -150,22 +158,33 @@ describe("a lista de escolha do carrossel avulso", () => {
     tema: "Produtividade",
   };
 
-  it("traz só os bônus que o Chat consegue usar, do mais novo para o mais velho", () => {
+  // Desde a Etapa 8, o bônus sem palavra entra (com a palavra nula), e os que ficam de fora são
+  // contados por motivo, para a tela dizer quantos e por quê (achado 84).
+  it("traz os bônus que o Chat consegue usar, do mais novo para o mais velho, e conta os de fora", () => {
     const lista = {
       items: [
         ITEM,
         { ...ITEM, codigo: "sem-palavra", palavraChave: undefined },
         { ...ITEM, codigo: "palavra-de-fora", palavraChave: "SEM-DOR" },
         { ...ITEM, codigo: "sem-tema", tema: "" },
+        { ...ITEM, codigo: "sem-palavra-nem-tema", palavraChave: undefined, tema: undefined },
         { ...ITEM, codigo: 7 },
         { ...ITEM, codigo: "" },
         BRUTAL,
       ],
     };
-    expect(bonusDaLista(lista)).toEqual([
-      { codigo: BRUTAL.codigo, palavra: "BRUTAL", titulo: BRUTAL.titulo, tema: "Produtividade", descricao: ITEM.descricao },
-      { codigo: ITEM.codigo, palavra: "SUMIDO", titulo: ITEM.titulo, tema: "Vendas", descricao: ITEM.descricao },
-    ]);
+    expect(bonusDaLista(lista)).toEqual({
+      bonus: [
+        { codigo: BRUTAL.codigo, palavra: "BRUTAL", titulo: BRUTAL.titulo, tema: "Produtividade", descricao: ITEM.descricao },
+        { codigo: "sem-palavra", palavra: null, titulo: ITEM.titulo, tema: "Vendas", descricao: ITEM.descricao },
+        { codigo: ITEM.codigo, palavra: "SUMIDO", titulo: ITEM.titulo, tema: "Vendas", descricao: ITEM.descricao },
+      ],
+      deFora: { semTema: 2, palavraForaDoPadrao: 1, formatoEstranho: 2 },
+    });
+  });
+
+  it("sem nenhum de fora, a contagem é zero", () => {
+    expect(bonusDaLista({ items: [ITEM, BRUTAL] })?.deFora).toEqual({ semTema: 0, palavraForaDoPadrao: 0, formatoEstranho: 0 });
   });
 
   it.each([null, {}, { items: "x" }, [], "texto"])("resposta sem lista de itens não é lista: %j", (corpo) => {
@@ -176,6 +195,7 @@ describe("a lista de escolha do carrossel avulso", () => {
     const f = buscador(async () => resposta(200, { items: [ITEM, BRUTAL] }));
     const r = await listaDoLabs(LABS, f);
     expect(r.ok && r.bonus.map((b) => b.codigo)).toEqual([BRUTAL.codigo, ITEM.codigo]);
+    expect(r.ok && r.deFora).toEqual({ semTema: 0, palavraForaDoPadrao: 0, formatoEstranho: 0 });
   });
 
   it("a falha da leitura diz o motivo", async () => {
@@ -185,3 +205,52 @@ describe("a lista de escolha do carrossel avulso", () => {
     expect(await listaDoLabs(LABS, buscador(async () => resposta(200, { items: 1 })))).toEqual({ ok: false, tipo: "formato_estranho" });
   });
 });
+
+// AS DUAS REGRAS DO LABS (spec da Etapa 8, achado 85): a do bônus do Chat continua a de hoje (o sem
+// palavra é "sem_palavra", acima); a do avulso aceita o bônus sem palavra e com tema, com a palavra
+// nula. Com palavra, as duas dizem o mesmo.
+describe("a regra do avulso do Labs", () => {
+  const avulso = (troca: Record<string, unknown>) => situacaoNaListaDoAvulso({ items: [{ ...ITEM, ...troca }] }, ITEM.codigo);
+
+  it.each([
+    ["chave ausente", { palavraChave: undefined }],
+    ["texto vazio", { palavraChave: "" }],
+    ["só espaço", { palavraChave: "   " }],
+  ])("sem palavra (%s) e com tema, é publicado com a palavra nula", (_nome, troca) => {
+    expect(avulso(troca)).toEqual({
+      tipo: "publicado",
+      bonus: { palavra: null, titulo: ITEM.titulo, descricao: ITEM.descricao, tema: "Vendas" },
+    });
+  });
+
+  it("sem palavra e sem tema, fica de fora pelo tema", () => {
+    expect(avulso({ palavraChave: undefined, tema: undefined })).toEqual({ tipo: "sem_tema" });
+  });
+
+  it("sem palavra e com o título fora do formato, é formato estranho", () => {
+    expect(avulso({ palavraChave: undefined, titulo: "" })).toEqual({ tipo: "formato_estranho" });
+  });
+
+  it.each([
+    ["publicado", {}],
+    ["palavra fora do padrão", { palavraChave: "SEM-DOR" }],
+    ["palavra que não é texto", { palavraChave: null }],
+    ["sem tema", { tema: "" }],
+  ])("com palavra, diz o mesmo que a regra do bônus do Chat (%s)", (_nome, troca) => {
+    const corpo = { items: [{ ...ITEM, ...troca }] };
+    expect(situacaoNaListaDoAvulso(corpo, ITEM.codigo)).toEqual(situacaoNaLista(corpo, ITEM.codigo));
+  });
+
+  it("fora da lista e lista estranha, como a regra do Chat", () => {
+    expect(situacaoNaListaDoAvulso(LISTA, "zz-teste")).toEqual({ tipo: "nao_publicado" });
+    expect(situacaoNaListaDoAvulso({ items: "x" }, ITEM.codigo)).toEqual({ tipo: "formato_estranho" });
+  });
+
+  it("a leitura do avulso pergunta ao Labs e usa a regra dele", async () => {
+    const corpo = { items: [{ ...ITEM, palavraChave: undefined }] };
+    const f = vi.fn(async () => new Response(JSON.stringify(corpo), { status: 200 })) as unknown as typeof fetch;
+    expect(await situacaoDoAvulsoNoLabs(LABS, ITEM.codigo, f)).toMatchObject({ tipo: "publicado", bonus: { palavra: null } });
+    expect(await situacaoNoLabs(LABS, ITEM.codigo, f)).toEqual({ tipo: "sem_palavra" });
+    expect(await situacaoDoAvulsoNoLabs(undefined, ITEM.codigo, f)).toEqual({ tipo: "sem_config" });
+  });
+});
```

Crie `tests/bonus-lista-do-labs-textos.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { textoDosBonusDeFora } from "@/lib/bonus/avulso-textos";
import { quadroDaSituacao } from "@/lib/bonus/carrossel-textos";

// AS FRASES DA LISTA DO LABS NO AVULSO (spec da Etapa 8, achado 84): o bônus publicado sem palavra é
// verde e diz que não tem palavra; os que ficam de fora da escolha são contados, com o motivo.

describe("o bônus publicado sem palavra-chave", () => {
  it("é verde e diz que não tem palavra", () => {
    expect(
      quadroDaSituacao({ tipo: "publicado", bonus: { palavra: null, titulo: "t", descricao: "d", tema: "Vendas" } })
    ).toEqual({ tom: "ok", texto: "Publicado no Labs · sem palavra-chave" });
  });

  it("com palavra, a frase de hoje", () => {
    expect(
      quadroDaSituacao({ tipo: "publicado", bonus: { palavra: "BRUTAL", titulo: "t", descricao: "d", tema: "Vendas" } })
    ).toEqual({ tom: "ok", texto: "Publicado no Labs · palavra BRUTAL" });
  });
});

describe("os bônus do Labs que ficam de fora da escolha", () => {
  it("nenhum de fora, nada a dizer", () => {
    expect(textoDosBonusDeFora({ semTema: 0, palavraForaDoPadrao: 0, formatoEstranho: 0 })).toBeNull();
  });

  it("um só, no singular", () => {
    expect(textoDosBonusDeFora({ semTema: 1, palavraForaDoPadrao: 0, formatoEstranho: 0 })).toBe(
      "1 bônus do Labs não aparece: 1 sem tema."
    );
  });

  it("os três motivos, com o padrão da palavra", () => {
    expect(textoDosBonusDeFora({ semTema: 2, palavraForaDoPadrao: 1, formatoEstranho: 3 })).toBe(
      "6 bônus do Labs não aparecem: 2 sem tema, 1 com a palavra fora do padrão do Chat (de 3 a 30 letras maiúsculas ou números) e 3 num formato que o Chat não lê."
    );
  });

  it("só as partes que existem", () => {
    expect(textoDosBonusDeFora({ semTema: 0, palavraForaDoPadrao: 2, formatoEstranho: 1 })).toBe(
      "3 bônus do Labs não aparecem: 2 com a palavra fora do padrão do Chat (de 3 a 30 letras maiúsculas ou números) e 1 num formato que o Chat não lê."
    );
  });
});
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-publicado.test.ts tests/bonus-lista-do-labs-textos.test.ts
```

Esperado: 19 caem e 42 passam (61): em `bonus-publicado`, 14 caem e 41 passam; em
`bonus-lista-do-labs-textos`, 5 caem e 1 passa.

- [ ] **Passo 3: o código**

Em `lib/bonus/publicado.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/publicado.ts b/lib/bonus/publicado.ts
index 8bca110..063362d 100644
--- a/lib/bonus/publicado.ts
+++ b/lib/bonus/publicado.ts
@@ -47,6 +47,17 @@ export type SituacaoNoLabs =
   | { tipo: "formato_estranho" }
   | { tipo: "sem_config" };
 
+/** O bônus que o AVULSO consegue usar: o sem palavra entra, com a palavra nula (spec da Etapa 8). */
+export type BonusDoAvulso = Omit<BonusPublicado, "palavra"> & { palavra: string | null };
+
+/**
+ * A SITUAÇÃO PELA REGRA DO AVULSO (spec da Etapa 8, achado 85): a do bônus do Chat, menos o
+ * `sem_palavra`, que vira "publicado" com a palavra nula quando o resto do bônus está no formato.
+ */
+export type SituacaoDoAvulso =
+  | { tipo: "publicado"; bonus: BonusDoAvulso }
+  | Exclude<SituacaoNoLabs, { tipo: "publicado" } | { tipo: "sem_palavra" }>;
+
 function textoAte(v: unknown, max: number): string | null {
   if (typeof v !== "string") return null;
   const t = v.trim();
@@ -72,56 +83,121 @@ function itensDaLista(corpo: unknown): unknown[] | null {
 
 const ehItem = (i: unknown): i is Record<string, unknown> => i !== null && typeof i === "object";
 
-export function situacaoNaLista(corpo: unknown, slug: string): SituacaoNoLabs {
+type SemItem = { tipo: "formato_estranho" } | { tipo: "nao_publicado" };
+
+/** O item da lista com esse código, ou o motivo de não haver um. */
+function itemDaLista(corpo: unknown, slug: string): { item: Record<string, unknown> } | SemItem {
   const itens = itensDaLista(corpo);
   if (!itens) return { tipo: "formato_estranho" };
   const item = itens.find((i): i is Record<string, unknown> => ehItem(i) && i.codigo === slug);
-  return item ? situacaoDoItem(item) : { tipo: "nao_publicado" };
+  return item ? { item } : { tipo: "nao_publicado" };
 }
 
-/** A REGRA DE CADA ITEM, a mesma para a situação de um bônus e para a lista de escolha do avulso. */
-function situacaoDoItem(item: Record<string, unknown>): SituacaoNoLabs {
-  // Faltando a palavra e o tema, vale a palavra: sem ela, nenhuma chamada tem o que pedir.
-  if (ausente(item.palavraChave)) return { tipo: "sem_palavra" };
+/** A REGRA DO BÔNUS DO CHAT (`situacaoNoLabs`), a de antes da Etapa 8, sem mudança. */
+export function situacaoNaLista(corpo: unknown, slug: string): SituacaoNoLabs {
+  const achado = itemDaLista(corpo, slug);
+  return "item" in achado ? situacaoDoItem(achado.item) : achado;
+}
+
+/**
+ * A REGRA DO AVULSO DO LABS (spec da Etapa 8): o pedido pelo código, o "Gerar de novo" e o topo da
+ * página do avulso.
+ */
+export function situacaoNaListaDoAvulso(corpo: unknown, slug: string): SituacaoDoAvulso {
+  const achado = itemDaLista(corpo, slug);
+  return "item" in achado ? situacaoDoItemDoAvulso(achado.item) : achado;
+}
+
+/**
+ * A palavra de um item que TEM palavra, EXATAMENTE como o Labs a tem: a chamada tem de pedir essa
+ * grafia. A conferência da chamada depende de letras e números sem espaço (`palavraValida`).
+ */
+function palavraDoItem(
+  item: Record<string, unknown>
+): { palavra: string } | { tipo: "formato_estranho" } | { tipo: "palavra_fora_do_padrao"; palavra: string } {
   if (typeof item.palavraChave !== "string" || item.palavraChave.length > PALAVRA_DO_LABS_MAX) {
     return { tipo: "formato_estranho" };
   }
-  // A palavra entra EXATAMENTE como o Labs a tem: a chamada tem de pedir essa grafia. A
-  // conferência da chamada depende de letras e números sem espaço (`palavraValida`).
   const palavra = item.palavraChave;
-  if (!palavraValida(palavra)) return { tipo: "palavra_fora_do_padrao", palavra };
-  if (ausente(item.tema)) return { tipo: "sem_tema" };
+  return palavraValida(palavra) ? { palavra } : { tipo: "palavra_fora_do_padrao", palavra };
+}
 
-  // O tema vai até o teto do Labs, e não até o do pedido do Chat: no carrossel ele só entra
-  // como contexto na mensagem à IA (carrossel-ia-parametros.ts).
+/**
+ * O tema, o título e a descrição de um item. O tema vai até o teto do Labs, e não até o do pedido
+ * do Chat: no carrossel ele só entra como contexto na mensagem à IA (carrossel-ia-parametros.ts).
+ */
+function textosDoItem(
+  item: Record<string, unknown>
+): { titulo: string; descricao: string; tema: string } | { tipo: "sem_tema" } | { tipo: "formato_estranho" } {
+  if (ausente(item.tema)) return { tipo: "sem_tema" };
   const tema = textoAte(item.tema, TEMA_DO_LABS_MAX);
   const titulo = textoAte(item.titulo, TITULO_MAX);
   const descricao = textoAte(item.descricao, DESCRICAO_MAX);
   if (!titulo || !descricao || !tema) return { tipo: "formato_estranho" };
-  return { tipo: "publicado", bonus: { palavra, titulo, descricao, tema } };
+  return { titulo, descricao, tema };
 }
 
-/** Um bônus da lista do Labs que o Chat consegue usar, com o código (o slug) dele. */
-export type BonusDoLabs = BonusPublicado & { codigo: string };
+/** A REGRA DE CADA ITEM PARA O BÔNUS DO CHAT: sem palavra é `sem_palavra`, antes do tema. */
+function situacaoDoItem(item: Record<string, unknown>): SituacaoNoLabs {
+  // Faltando a palavra e o tema, vale a palavra: sem ela, nenhuma chamada tem o que pedir.
+  if (ausente(item.palavraChave)) return { tipo: "sem_palavra" };
+  const p = palavraDoItem(item);
+  if ("tipo" in p) return p;
+  const t = textosDoItem(item);
+  if ("tipo" in t) return t;
+  return { tipo: "publicado", bonus: { palavra: p.palavra, ...t } };
+}
+
+/**
+ * A REGRA DE CADA ITEM PARA O AVULSO (spec da Etapa 8): com palavra, a mesma do bônus do Chat; sem
+ * palavra, o tema e o resto pela mesma régua, e "publicado" com a palavra nula. O sem tema fica de
+ * fora com ou sem palavra.
+ */
+function situacaoDoItemDoAvulso(item: Record<string, unknown>): SituacaoDoAvulso {
+  let palavra: string | null = null;
+  if (!ausente(item.palavraChave)) {
+    const p = palavraDoItem(item);
+    if ("tipo" in p) return p;
+    palavra = p.palavra;
+  }
+  const t = textosDoItem(item);
+  if ("tipo" in t) return t;
+  return { tipo: "publicado", bonus: { palavra, ...t } };
+}
+
+/** Um bônus da lista do Labs que o avulso consegue usar, com o código (o slug) dele. */
+export type BonusDoLabs = BonusDoAvulso & { codigo: string };
+
+/** Os bônus da lista que ficaram de fora da escolha, por motivo (achado 84). */
+export type BonusDeFora = { semTema: number; palavraForaDoPadrao: number; formatoEstranho: number };
 
 /** O teto do código que o Chat guarda (`carrosseis_gerados.labs_codigo`) e aceita do formulário. */
 export const CODIGO_MAX = 200;
 
 /**
- * A LISTA DE ESCOLHA DO CARROSSEL AVULSO (spec da Etapa 7): só os bônus "publicado" pela regra de cada
- * item, do mais novo para o mais velho (a lista do Labs vem na ordem de criação, a crescente). Null
- * quando a resposta não tem a forma de lista.
+ * A LISTA DE ESCOLHA DO CARROSSEL AVULSO (spec da Etapa 7): só os bônus "publicado" pela regra do
+ * avulso, do mais novo para o mais velho (a lista do Labs vem na ordem de criação, a crescente).
+ * Desde a Etapa 8, o sem palavra entra (com a palavra nula), e os que ficam de fora são contados por
+ * motivo; o item sem código válido conta como formato que o Chat não lê. Null quando a resposta não
+ * tem a forma de lista.
  */
-export function bonusDaLista(corpo: unknown): BonusDoLabs[] | null {
+export function bonusDaLista(corpo: unknown): { bonus: BonusDoLabs[]; deFora: BonusDeFora } | null {
   const itens = itensDaLista(corpo);
   if (!itens) return null;
   const bonus: BonusDoLabs[] = [];
+  const deFora: BonusDeFora = { semTema: 0, palavraForaDoPadrao: 0, formatoEstranho: 0 };
   for (const item of itens) {
-    if (!ehItem(item) || typeof item.codigo !== "string" || !item.codigo || item.codigo.length > CODIGO_MAX) continue;
-    const s = situacaoDoItem(item);
+    if (!ehItem(item) || typeof item.codigo !== "string" || !item.codigo || item.codigo.length > CODIGO_MAX) {
+      deFora.formatoEstranho++;
+      continue;
+    }
+    const s = situacaoDoItemDoAvulso(item);
     if (s.tipo === "publicado") bonus.push({ codigo: item.codigo, ...s.bonus });
+    else if (s.tipo === "sem_tema") deFora.semTema++;
+    else if (s.tipo === "palavra_fora_do_padrao") deFora.palavraForaDoPadrao++;
+    else deFora.formatoEstranho++;
   }
-  return bonus.reverse();
+  return { bonus: bonus.reverse(), deFora };
 }
 
 type FalhaDaLeitura = { tipo: "sem_config" } | { tipo: "sem_resposta" } | { tipo: "formato_estranho" };
@@ -169,12 +245,22 @@ export async function situacaoNoLabs(
   return lida.ok ? situacaoNaLista(lida.corpo, slug) : { tipo: lida.tipo };
 }
 
-export type ListaDoLabs = { ok: true; bonus: BonusDoLabs[] } | ({ ok: false } & FalhaDaLeitura);
+/** A situação pela regra do avulso (spec da Etapa 8), lida agora pelo código. */
+export async function situacaoDoAvulsoNoLabs(
+  base: string | undefined,
+  codigo: string,
+  fetchImpl: typeof fetch = fetch
+): Promise<SituacaoDoAvulso> {
+  const lida = await lerListaDoLabs(base, fetchImpl);
+  return lida.ok ? situacaoNaListaDoAvulso(lida.corpo, codigo) : { tipo: lida.tipo };
+}
+
+export type ListaDoLabs = { ok: true; bonus: BonusDoLabs[]; deFora: BonusDeFora } | ({ ok: false } & FalhaDaLeitura);
 
 /** A lista de escolha, lida agora. A falha diz o motivo (a tela usa `quadroDaSituacao`). */
 export async function listaDoLabs(base: string | undefined, fetchImpl: typeof fetch = fetch): Promise<ListaDoLabs> {
   const lida = await lerListaDoLabs(base, fetchImpl);
   if (!lida.ok) return lida;
-  const bonus = bonusDaLista(lida.corpo);
-  return bonus ? { ok: true, bonus } : { ok: false, tipo: "formato_estranho" };
+  const lista = bonusDaLista(lida.corpo);
+  return lista ? { ok: true, ...lista } : { ok: false, tipo: "formato_estranho" };
 }
```

Em `lib/bonus/avulso-textos.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/avulso-textos.ts b/lib/bonus/avulso-textos.ts
index 1252415..c2b90a5 100644
--- a/lib/bonus/avulso-textos.ts
+++ b/lib/bonus/avulso-textos.ts
@@ -6,6 +6,7 @@ import { contextoGravado } from "./carrossel-ia-parametros";
 import type { LinhaDoCarrossel } from "./carrossel-linha";
 import { SLIDES_MAX, SLIDES_MIN } from "./carrossel-pedido";
 import { PALAVRA_MAX, PALAVRA_MIN, TEMA_MAX } from "./pedido";
+import type { BonusDeFora } from "./publicado";
 
 /** A recusa do "Novo carrossel", que volta como estado do formulário (achado 52), e nunca por redirect. */
 export type AvisoDoAvulso = Aviso & { em: number };
@@ -42,3 +43,21 @@ export function textoDaOrigem(l: Pick<LinhaDoCarrossel, "origem" | "contexto">):
   if (l.origem === "labs") return c && !("tipo" in c) ? `Bônus do Labs: ${c.titulo}` : "Bônus do Labs";
   return c && "tipo" in c ? `Texto livre: ${c.tema}` : "Texto livre";
 }
+
+/**
+ * OS BÔNUS DO LABS QUE FICAM DE FORA DA ESCOLHA (spec da Etapa 8, achado 84), contados por motivo, só
+ * as partes que existem. Nenhum de fora, nada.
+ */
+export function textoDosBonusDeFora(d: BonusDeFora): string | null {
+  const total = d.semTema + d.palavraForaDoPadrao + d.formatoEstranho;
+  if (total === 0) return null;
+  const partes = [
+    d.semTema ? `${d.semTema} sem tema` : null,
+    d.palavraForaDoPadrao
+      ? `${d.palavraForaDoPadrao} com a palavra fora do padrão do Chat (de ${PALAVRA_MIN} a ${PALAVRA_MAX} letras maiúsculas ou números)`
+      : null,
+    d.formatoEstranho ? `${d.formatoEstranho} num formato que o Chat não lê` : null,
+  ].filter((p): p is string => p !== null);
+  const lista = partes.length > 1 ? `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}` : partes[0];
+  return `${total === 1 ? "1 bônus do Labs não aparece" : `${total} bônus do Labs não aparecem`}: ${lista}.`;
+}
```

Em `lib/bonus/carrossel-textos.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/carrossel-textos.ts b/lib/bonus/carrossel-textos.ts
index 5c29fa6..1295ea0 100644
--- a/lib/bonus/carrossel-textos.ts
+++ b/lib/bonus/carrossel-textos.ts
@@ -5,7 +5,7 @@ import { ehAcaoDaChamada, rotuloDaAcao } from "./acao-da-chamada";
 import { SLIDES_MAX, SLIDES_MIN, TETO_CARROSSEL_DIARIO, type RecusaDoPedidoDeCarrossel } from "./carrossel-pedido";
 import { camposDoFormulario, type FalhaDaConferencia, type ParteDoCarrossel, type ProblemaDoCampo } from "./carrossel-texto";
 import { PALAVRA_MAX, PALAVRA_MIN } from "./pedido";
-import type { SituacaoNoLabs } from "./publicado";
+import type { SituacaoDoAvulso, SituacaoNoLabs } from "./publicado";
 import type { TomDoQuadro } from "./textos";
 
 /** A recusa do "Gerar carrossel", que também volta como estado do formulário. */
@@ -59,11 +59,17 @@ export const TEXTO_TABELA_CARROSSEL_AUSENTE =
   "Falta a tabela dos carrosséis neste banco. Aplique a migração 014 (migrations/014-carrosseis-gerados.sql) e recarregue.";
 export const TEXTO_CARROSSEL_SEM_TEXTO = "O texto deste carrossel não passou na conferência de formato. Gere de novo.";
 
-/** A situação do bônus no Labs, lida agora. Só "publicado" é verde. */
-export function quadroDaSituacao(s: SituacaoNoLabs): { tom: TomDoQuadro; texto: string } {
+/**
+ * A situação do bônus no Labs, lida agora. Só "publicado" é verde. Pela regra do avulso (Etapa 8), o
+ * publicado pode vir sem palavra.
+ */
+export function quadroDaSituacao(s: SituacaoNoLabs | SituacaoDoAvulso): { tom: TomDoQuadro; texto: string } {
   switch (s.tipo) {
     case "publicado":
-      return { tom: "ok", texto: `Publicado no Labs · palavra ${s.bonus.palavra}` };
+      return {
+        tom: "ok",
+        texto: s.bonus.palavra === null ? "Publicado no Labs · sem palavra-chave" : `Publicado no Labs · palavra ${s.bonus.palavra}`,
+      };
     case "nao_publicado":
       return {
         tom: "atencao",
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx vitest run tests/bonus-publicado.test.ts tests/bonus-lista-do-labs-textos.test.ts
```

Esperado: `tsc` limpo; os 61 passam.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/publicado.ts lib/bonus/avulso-textos.ts lib/bonus/carrossel-textos.ts tests/bonus-publicado.test.ts tests/bonus-lista-do-labs-textos.test.ts
test "$(git branch --show-current)" = "carrossel-sem-palavra"
git add lib/bonus/publicado.ts lib/bonus/avulso-textos.ts lib/bonus/carrossel-textos.ts tests/bonus-publicado.test.ts tests/bonus-lista-do-labs-textos.test.ts
git commit -m "feat(bonus): a regra do avulso do Labs, separada da do bônus do Chat"
```

---

### FASE 8.8 — O pedido sem palavra-chave, e o avulso pela regra nova do Labs

**Arquivos:**
- Modificar: `lib/bonus/avulso-pedido.ts`, `lib/bonus/avulso-processo.ts`, `lib/bonus/avulso-textos.ts`,
  `app/carrosseis/actions.ts`, `app/carrosseis/[cid]/page.tsx`
- Testar: `tests/bonus-avulso-pedido.test.ts`, `tests/bonus-avulso-paginas.test.ts`,
  `testes-integracao/bonus-avulso-processo.integracao.ts`

**Interfaces:**
- Muda: `PedidoAvulso` com `acao: AcaoDaChamada | null` nas duas origens e, no texto livre, `palavra:
  string | null`; `lerPedidoAvulso({ ..., semPalavra?, acao? })`, com a recusa nova `sem_acao` ("Escolha
  o que a chamada pede."); `type LerSituacao = (codigo) => Promise<SituacaoDoAvulso>`.
- Produz: `TEXTO_LABS_SEM_ACAO` e `TEXTO_LABS_PERDEU_A_PALAVRA` (`avulso-processo.ts`). As actions leem
  `sem_palavra` e `acao` do formulário e o Labs por `situacaoDoAvulsoNoLabs`; a página do avulso
  também. O carrossel de bônus do Chat continua com `situacaoNoLabs`.

- [ ] **Passo 1: os testes**

Em `tests/bonus-avulso-pedido.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-avulso-pedido.test.ts b/tests/bonus-avulso-pedido.test.ts
index 2784042..ac4bf6f 100644
--- a/tests/bonus-avulso-pedido.test.ts
+++ b/tests/bonus-avulso-pedido.test.ts
@@ -39,7 +39,7 @@ describe("o pedido do carrossel avulso", () => {
   it("do Labs: o código, o destaque, o total e o jeito", () => {
     expect(lerPedidoAvulso(DO_LABS)).toEqual({
       ok: true,
-      pedido: { origem: "labs", codigo: "conselheiro-brutalmente-honesto", destaque: "", total: 5, jeito: "ia" },
+      pedido: { origem: "labs", codigo: "conselheiro-brutalmente-honesto", destaque: "", total: 5, jeito: "ia", acao: null },
     });
   });
 
@@ -51,13 +51,14 @@ describe("o pedido do carrossel avulso", () => {
       destaque: "Mostre o antes\ne o depois.",
       total: 5,
       jeito: "ia",
+      acao: null,
     });
   });
 
   it("do texto livre: a palavra na forma que o Labs grava, sem acento e em maiúscula", () => {
     expect(lerPedidoAvulso(LIVRE)).toEqual({
       ok: true,
-      pedido: { origem: "livre", tema: "Produtividade", palavra: "BRUTAL", conteudo: LIVRE.conteudo, total: 4, jeito: "mao" },
+      pedido: { origem: "livre", tema: "Produtividade", palavra: "BRUTAL", acao: null, conteudo: LIVRE.conteudo, total: 4, jeito: "mao" },
     });
     const r = lerPedidoAvulso({ ...LIVRE, palavra: " Brútal " });
     expect(r.ok && r.pedido.origem === "livre" && r.pedido.palavra).toBe("BRUTAL");
@@ -65,7 +66,7 @@ describe("o pedido do carrossel avulso", () => {
 
   it("os campos da outra origem não entram no pedido", () => {
     const r = lerPedidoAvulso({ ...DO_LABS, tema: "Vendas", palavra: "OUTRA", conteudo: "x".repeat(50) });
-    expect(r.ok && r.pedido).toEqual({ origem: "labs", codigo: DO_LABS.codigo, destaque: "", total: 5, jeito: "ia" });
+    expect(r.ok && r.pedido).toEqual({ origem: "labs", codigo: DO_LABS.codigo, destaque: "", total: 5, jeito: "ia", acao: null });
   });
 
   it("o conteúdo nos limites passa", () => {
@@ -173,3 +174,41 @@ describe("a origem na tela", () => {
     expect(textoDaOrigem({ origem: "livre", contexto: { tema: "t", titulo: "x", descricao: "d", oQueResolve: "o" } })).toBe("Texto livre");
   });
 });
+
+// SEM PALAVRA-CHAVE (spec da Etapa 8): no texto livre, a caixa "Sem palavra-chave" troca a palavra pela
+// ação da chamada; no bônus do Labs, a ação vem do formulário e só vale se o bônus não tiver palavra,
+// o que só o processo sabe, depois de ler o Labs.
+describe("o pedido sem palavra-chave", () => {
+  it("texto livre com a caixa marcada: a palavra nula e a ação", () => {
+    expect(lerPedidoAvulso({ ...LIVRE, semPalavra: "1", acao: "salvar" })).toEqual({
+      ok: true,
+      pedido: { origem: "livre", tema: "Produtividade", palavra: null, acao: "salvar", conteudo: LIVRE.conteudo, total: 4, jeito: "mao" },
+    });
+  });
+
+  it("com a caixa marcada, o que estava no campo da palavra não entra, nem inválido", () => {
+    const r = lerPedidoAvulso({ ...LIVRE, palavra: "duas palavras", semPalavra: "1", acao: "seguir" });
+    expect(r.ok && r.pedido.origem === "livre" && [r.pedido.palavra, r.pedido.acao]).toEqual([null, "seguir"]);
+  });
+
+  it.each([[undefined], [""], ["curtir"], ["Salvar"]])("com a caixa marcada, sem uma das quatro ações (%j), é recusado", (acao) => {
+    expect(lerPedidoAvulso({ ...LIVRE, semPalavra: "1", acao })).toEqual({ ok: false, motivo: "sem_acao" });
+  });
+
+  it("sem a caixa, a palavra de hoje, e a ação do formulário não entra", () => {
+    const r = lerPedidoAvulso({ ...LIVRE, acao: "salvar" });
+    expect(r.ok && r.pedido.origem === "livre" && [r.pedido.palavra, r.pedido.acao]).toEqual(["BRUTAL", null]);
+    expect(lerPedidoAvulso({ ...LIVRE, palavra: "" })).toEqual({ ok: false, motivo: "palavra_invalida" });
+  });
+
+  it("do Labs: a ação do formulário vai junto, e a que não é uma das quatro vira nula", () => {
+    const r = lerPedidoAvulso({ ...DO_LABS, acao: "comentar" });
+    expect(r.ok && r.pedido.acao).toBe("comentar");
+    const outra = lerPedidoAvulso({ ...DO_LABS, acao: "curtir" });
+    expect(outra.ok && outra.pedido.acao).toBeNull();
+  });
+
+  it("a recusa diz o que fazer", () => {
+    expect(textoDaRecusaDoPedidoAvulso("sem_acao")).toBe("Escolha o que a chamada pede.");
+  });
+});
```

Em `tests/bonus-avulso-paginas.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-avulso-paginas.test.ts b/tests/bonus-avulso-paginas.test.ts
index 8af7a63..f7b9614 100644
--- a/tests/bonus-avulso-paginas.test.ts
+++ b/tests/bonus-avulso-paginas.test.ts
@@ -143,3 +143,25 @@ describe("o menu Carrosséis", () => {
     expect(ler("app/bonus/[id]/carrossel/[cid]/revisao.tsx")).toContain("acaoDaChamada={carrossel.acao_da_chamada}");
   });
 });
+
+// AS DUAS REGRAS DO LABS NAS PÁGINAS E NAS ACTIONS (spec da Etapa 8, achado 85): o avulso lê o Labs pela
+// regra dele, que aceita o bônus sem palavra; o carrossel de bônus do Chat continua com a de hoje.
+describe("quem usa cada regra do Labs", () => {
+  it("as actions do avulso leem a caixa sem palavra, a ação e o Labs pela regra do avulso", () => {
+    const acoes = ler("app/carrosseis/actions.ts");
+    expect(acoes).toContain('semPalavra: form.get("sem_palavra")');
+    expect(acoes).toContain('acao: form.get("acao")');
+    expect(acoes).toContain("situacaoDoAvulsoNoLabs(process.env.LABS_URL, codigo)");
+    expect(acoes).not.toContain("situacaoNoLabs(");
+  });
+
+  it("a página do avulso lê o Labs pela regra do avulso", () => {
+    expect(ler("app/carrosseis/[cid]/page.tsx")).toContain("situacaoDoAvulsoNoLabs(process.env.LABS_URL, codigo)");
+  });
+
+  it("o carrossel de bônus do Chat continua com a regra de hoje", () => {
+    expect(ler("app/bonus/carrossel-actions.ts")).toContain("situacaoNoLabs(process.env.LABS_URL");
+    expect(ler("app/bonus/[id]/carrossel/[cid]/page.tsx")).toContain("situacaoNoLabs(process.env.LABS_URL");
+    expect(ler("app/bonus/carrossel-actions.ts")).not.toContain("situacaoDoAvulsoNoLabs");
+  });
+});
```

Em `testes-integracao/bonus-avulso-processo.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/bonus-avulso-processo.integracao.ts b/testes-integracao/bonus-avulso-processo.integracao.ts
index 1acc005..32dbd18 100644
--- a/testes-integracao/bonus-avulso-processo.integracao.ts
+++ b/testes-integracao/bonus-avulso-processo.integracao.ts
@@ -5,7 +5,7 @@
 import { beforeAll, beforeEach, describe, expect, it } from "vitest";
 import type { ContaGuardada } from "@/lib/bonus/arte-conta";
 import type { PedidoAvulso } from "@/lib/bonus/avulso-pedido";
-import type { SituacaoNoLabs } from "@/lib/bonus/publicado";
+import type { SituacaoDoAvulso } from "@/lib/bonus/publicado";
 import { bancoDescartavel } from "./harness";
 
 type ModuloProcesso = typeof import("@/lib/bonus/avulso-processo");
@@ -20,7 +20,10 @@ const NO_LABS = {
   descricao: "Um prompt que critica o seu plano sem dó.",
   tema: "Produtividade",
 };
-const publicado = (troca: Partial<typeof NO_LABS> = {}): SituacaoNoLabs => ({ tipo: "publicado", bonus: { ...NO_LABS, ...troca } });
+const publicado = (troca: Partial<{ palavra: string | null; titulo: string; descricao: string; tema: string }> = {}): SituacaoDoAvulso => ({
+  tipo: "publicado",
+  bonus: { ...NO_LABS, ...troca },
+});
 const THIAGO: ContaGuardada = { conta: "17841400000000001", nome: "Thiago Vannuchi", arroba: "thiagovannuchi" };
 
 /** Os campos do carrossel de 5 slides escritos à mão, na forma que o formulário manda. */
@@ -42,12 +45,14 @@ const doLabs = (troca: Partial<Extract<PedidoAvulso, { origem: "labs" }>> = {}):
   destaque: "Mostre o antes e o depois.",
   total: 5,
   jeito: "ia",
+  acao: null,
   ...troca,
 });
 const livre = (troca: Partial<Extract<PedidoAvulso, { origem: "livre" }>> = {}): PedidoAvulso => ({
   origem: "livre",
   tema: "Produtividade",
   palavra: "BRUTAL",
+  acao: null,
   conteudo: "Um prompt que critica o seu plano sem dó nenhum.",
   total: 5,
   jeito: "ia",
@@ -72,7 +77,7 @@ async function contar(): Promise<number> {
 }
 
 /** Quem lê a situação no Labs, falso, e o que ele foi perguntado. */
-function labs(situacao: SituacaoNoLabs) {
+function labs(situacao: SituacaoDoAvulso) {
   const perguntados: string[] = [];
   return {
     perguntados,
@@ -101,9 +106,9 @@ describe("pedir o carrossel avulso", () => {
   });
 
   it.each([
-    ["despublicado", { tipo: "nao_publicado" } as SituacaoNoLabs, "Criado no Labs como oculto"],
-    ["com a palavra fora do padrão", { tipo: "palavra_fora_do_padrao", palavra: "SEM-DOR" } as SituacaoNoLabs, "SEM-DOR"],
-    ["sem resposta", { tipo: "sem_resposta" } as SituacaoNoLabs, "Não consegui consultar o Labs"],
+    ["despublicado", { tipo: "nao_publicado" } as SituacaoDoAvulso, "Criado no Labs como oculto"],
+    ["com a palavra fora do padrão", { tipo: "palavra_fora_do_padrao", palavra: "SEM-DOR" } as SituacaoDoAvulso, "SEM-DOR"],
+    ["sem resposta", { tipo: "sem_resposta" } as SituacaoDoAvulso, "Não consegui consultar o Labs"],
   ])("o bônus do Labs %s é recusado com a frase, sem gravar nada", async (_nome, situacao, frase) => {
     const r = await processo.pedirAvulso({ pedido: doLabs(), bruto: {}, conta: null, lerSituacao: labs(situacao).lerSituacao });
     expect(r.ok).toBe(false);
@@ -263,3 +268,85 @@ describe("gerar de novo o carrossel avulso sem palavra-chave", () => {
     expect(await repo.lerCarrossel(r.id)).toMatchObject({ origem: "livre", estado: "pendente", palavra: null, acao_da_chamada: "compartilhar", total_slides: 4 });
   });
 });
+
+// PEDIR SEM PALAVRA-CHAVE (spec da Etapa 8): o texto livre com a ação do formulário; o bônus do Labs
+// sem palavra, pela regra do avulso, com a ação exigida; o bônus com palavra ignora a ação.
+describe("pedir o carrossel avulso sem palavra-chave", () => {
+  const SEM_A_MAO = {
+    ...A_MAO,
+    chamada: "Salve este post para reler antes de mostrar o plano a alguém.",
+    legenda: "Antes de mostrar o seu plano a alguém, leia de novo estes pontos e salve para não esquecer.",
+  };
+
+  it("do texto livre, pela IA: a palavra nula e a ação, sem perguntar ao Labs", async () => {
+    const l = labs(publicado());
+    const r = await processo.pedirAvulso({ pedido: livre({ palavra: null, acao: "salvar" }), bruto: {}, conta: THIAGO, lerSituacao: l.lerSituacao });
+    if (!r.ok) throw new Error(r.texto);
+    expect(l.perguntados).toEqual([]);
+    expect(await repo.lerCarrossel(r.id)).toMatchObject({ origem: "livre", palavra: null, acao_da_chamada: "salvar", estado: "pendente" });
+  });
+
+  it("do texto livre, à mão: nasce pronto sem palavra, e a chamada com palavra gritada é recusada", async () => {
+    const pedido = livre({ palavra: null, acao: "seguir", jeito: "mao" });
+    const recusa = await processo.pedirAvulso({ pedido, bruto: { ...SEM_A_MAO, chamada: "Comente GUIA e receba o roteiro." }, conta: THIAGO, lerSituacao: labs(publicado()).lerSituacao });
+    expect(!recusa.ok && recusa.texto).toContain("não pode ter palavra em maiúsculas (GUIA)");
+    expect(await contar()).toBe(0);
+    const r = await processo.pedirAvulso({ pedido, bruto: SEM_A_MAO, conta: THIAGO, lerSituacao: labs(publicado()).lerSituacao });
+    if (!r.ok) throw new Error(r.texto);
+    expect(await repo.lerCarrossel(r.id)).toMatchObject({ estado: "pronto", texto_a_mao: true, palavra: null, acao_da_chamada: "seguir" });
+  });
+
+  it("do Labs sem palavra, com a ação: a palavra nula e a ação", async () => {
+    const r = await processo.pedirAvulso({ pedido: doLabs({ acao: "comentar" }), bruto: {}, conta: null, lerSituacao: labs(publicado({ palavra: null })).lerSituacao });
+    if (!r.ok) throw new Error(r.texto);
+    expect(await repo.lerCarrossel(r.id)).toMatchObject({ origem: "labs", labs_codigo: CODIGO, palavra: null, acao_da_chamada: "comentar" });
+  });
+
+  it("do Labs sem palavra e sem a ação, é recusado com a frase, sem gravar nada", async () => {
+    const r = await processo.pedirAvulso({ pedido: doLabs(), bruto: {}, conta: null, lerSituacao: labs(publicado({ palavra: null })).lerSituacao });
+    expect(r).toEqual({ ok: false, texto: "Escolha o que a chamada pede: este bônus do Labs não tem palavra-chave." });
+    expect(await contar()).toBe(0);
+  });
+
+  it("do Labs com palavra, a ação do formulário não entra", async () => {
+    const r = await processo.pedirAvulso({ pedido: doLabs({ acao: "salvar" }), bruto: {}, conta: null, lerSituacao: labs(publicado()).lerSituacao });
+    if (!r.ok) throw new Error(r.texto);
+    expect(await repo.lerCarrossel(r.id)).toMatchObject({ palavra: "BRUTAL", acao_da_chamada: null });
+  });
+});
+
+// O "GERAR DE NOVO" DO LABS SEM PALAVRA (spec da Etapa 8): segue o Labs de agora.
+describe("gerar de novo o avulso do Labs, pela palavra de agora", () => {
+  async function falhouDoLabs(pedido: PedidoAvulso, situacao: SituacaoDoAvulso): Promise<string> {
+    const r = await processo.pedirAvulso({ pedido, bruto: {}, conta: THIAGO, lerSituacao: labs(situacao).lerSituacao });
+    if (!r.ok) throw new Error(r.texto);
+    await banco.db().sql().query(`update carrosseis_gerados set estado = 'falhou', erro = 'A API recusou.' where id = $1`, [r.id]);
+    return r.id;
+  }
+  const deNovo = async (id: string, situacao: SituacaoDoAvulso) =>
+    processo.gerarAvulsoDeNovo({ linha: (await repo.lerCarrossel(id))!, conta: THIAGO, lerSituacao: labs(situacao).lerSituacao, agora: Date.now() });
+
+  it("feito sem palavra, e o Labs continua sem: sai com a ação gravada", async () => {
+    const id = await falhouDoLabs(doLabs({ acao: "seguir" }), publicado({ palavra: null }));
+    const r = await deNovo(id, publicado({ palavra: null }));
+    if (!r.ok) throw new Error(r.texto);
+    expect(await repo.lerCarrossel(r.id)).toMatchObject({ palavra: null, acao_da_chamada: "seguir" });
+  });
+
+  it("feito sem palavra, e o Labs agora tem palavra: sai com a palavra", async () => {
+    const id = await falhouDoLabs(doLabs({ acao: "seguir" }), publicado({ palavra: null }));
+    const r = await deNovo(id, publicado());
+    if (!r.ok) throw new Error(r.texto);
+    expect(await repo.lerCarrossel(r.id)).toMatchObject({ palavra: "BRUTAL", acao_da_chamada: null });
+  });
+
+  it("feito com palavra, e o Labs perdeu a palavra: recusado com a frase, sem gravar nada", async () => {
+    const id = await falhouDoLabs(doLabs(), publicado());
+    const antes = await contar();
+    expect(await deNovo(id, publicado({ palavra: null }))).toEqual({
+      ok: false,
+      texto: "No Labs, este bônus não tem mais palavra-chave. Crie um carrossel novo e escolha o que a chamada pede.",
+    });
+    expect(await contar()).toBe(antes);
+  });
+});
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-avulso-pedido.test.ts tests/bonus-avulso-paginas.test.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-avulso-processo.integracao.ts
```

Esperado: os puros: 15 caem e 44 passam (59); na integração, `[rede-global] ALVO: banco de TESTE`, 7
caem e 15 passam (22).

- [ ] **Passo 3: o código**

Em `lib/bonus/avulso-pedido.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/avulso-pedido.ts b/lib/bonus/avulso-pedido.ts
index f745c26..7a39c28 100644
--- a/lib/bonus/avulso-pedido.ts
+++ b/lib/bonus/avulso-pedido.ts
@@ -4,6 +4,11 @@
 // PURO, como lib/bonus/pedido.ts: quem decide o que é pedido válido é esta função, e não o corpo da
 // action. Do bônus do Labs, o formulário só traz o código: o título, a descrição, o tema e a palavra
 // são lidos da lista pública na hora do pedido, e nunca aceitos do formulário.
+//
+// SEM PALAVRA-CHAVE (spec da Etapa 8): no texto livre, a caixa "Sem palavra-chave" troca a palavra
+// pela ação da chamada, que passa a ser exigida. No bônus do Labs, a ação vem junto e só vale se o
+// bônus não tiver palavra, o que só o processo sabe, depois de ler o Labs (avulso-processo.ts).
+import { ehAcaoDaChamada, type AcaoDaChamada } from "./acao-da-chamada";
 import type { ContextoDeBonus, ContextoDoCarrossel, ContextoLivre } from "./carrossel-ia-parametros";
 import { lerTotalDeSlides } from "./carrossel-pedido";
 import { O_QUE_RESOLVE_MAX, TEMA_MAX, normalizarPalavra, palavraValida } from "./pedido";
@@ -18,9 +23,21 @@ export const DESTAQUE_MAX = O_QUE_RESOLVE_MAX;
 /** A IA escreve, ou o operador escreve à mão (sem IA e fora do teto). */
 export type JeitoDoTexto = "ia" | "mao";
 
+/**
+ * No texto livre, ou a palavra, ou (sem palavra-chave) a ação: nunca as duas, e nunca nenhuma. No
+ * bônus do Labs, a ação do formulário, que o processo usa só se o bônus não tiver palavra.
+ */
 export type PedidoAvulso =
-  | { origem: "labs"; codigo: string; destaque: string; total: number; jeito: JeitoDoTexto }
-  | { origem: "livre"; tema: string; palavra: string; conteudo: string; total: number; jeito: JeitoDoTexto };
+  | { origem: "labs"; codigo: string; destaque: string; total: number; jeito: JeitoDoTexto; acao: AcaoDaChamada | null }
+  | {
+      origem: "livre";
+      tema: string;
+      palavra: string | null;
+      acao: AcaoDaChamada | null;
+      conteudo: string;
+      total: number;
+      jeito: JeitoDoTexto;
+    };
 
 export type RecusaDoPedidoAvulso =
   | "origem_invalida"
@@ -31,6 +48,7 @@ export type RecusaDoPedidoAvulso =
   | "tema_vazio"
   | "tema_longo"
   | "palavra_invalida"
+  | "sem_acao"
   | "conteudo_curto"
   | "conteudo_longo";
 
@@ -48,6 +66,9 @@ export function lerPedidoAvulso(bruto: {
   conteudo: unknown;
   total: unknown;
   jeito: unknown;
+  /** A caixa "Sem palavra-chave" do texto livre: marcada, vem "1". */
+  semPalavra?: unknown;
+  acao?: unknown;
 }): { ok: true; pedido: PedidoAvulso } | { ok: false; motivo: RecusaDoPedidoAvulso } {
   const origem = bruto.origem;
   if (origem !== "labs" && origem !== "livre") return { ok: false, motivo: "origem_invalida" };
@@ -55,24 +76,30 @@ export function lerPedidoAvulso(bruto: {
   if (jeito !== "ia" && jeito !== "mao") return { ok: false, motivo: "jeito_invalido" };
   const total = lerTotalDeSlides(bruto.total);
   if (total === null) return { ok: false, motivo: "total_invalido" };
+  const acao = ehAcaoDaChamada(bruto.acao) ? bruto.acao : null;
 
   if (origem === "labs") {
     const codigo = texto(bruto.codigo);
     if (!codigo || codigo.length > CODIGO_MAX) return { ok: false, motivo: "sem_bonus" };
     const destaque = texto(bruto.destaque);
     if (destaque.length > DESTAQUE_MAX) return { ok: false, motivo: "destaque_longo" };
-    return { ok: true, pedido: { origem, codigo, destaque, total, jeito } };
+    return { ok: true, pedido: { origem, codigo, destaque, total, jeito, acao } };
   }
 
   const tema = texto(bruto.tema);
   if (!tema) return { ok: false, motivo: "tema_vazio" };
   if (tema.length > TEMA_MAX) return { ok: false, motivo: "tema_longo" };
-  const palavra = normalizarPalavra(texto(bruto.palavra));
-  if (!palavraValida(palavra)) return { ok: false, motivo: "palavra_invalida" };
+  let palavra: string | null = null;
+  if (bruto.semPalavra === "1") {
+    if (acao === null) return { ok: false, motivo: "sem_acao" };
+  } else {
+    palavra = normalizarPalavra(texto(bruto.palavra));
+    if (!palavraValida(palavra)) return { ok: false, motivo: "palavra_invalida" };
+  }
   const conteudo = texto(bruto.conteudo);
   if (conteudo.length < CONTEUDO_MIN) return { ok: false, motivo: "conteudo_curto" };
   if (conteudo.length > CONTEUDO_MAX) return { ok: false, motivo: "conteudo_longo" };
-  return { ok: true, pedido: { origem, tema, palavra, conteudo, total, jeito } };
+  return { ok: true, pedido: { origem, tema, palavra, acao: palavra === null ? acao : null, conteudo, total, jeito } };
 }
 
 /** O contexto do avulso do Labs: o que o Labs diz do bônus, e o destaque (ou a descrição) para a IA. */
```

Em `lib/bonus/avulso-processo.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/avulso-processo.ts b/lib/bonus/avulso-processo.ts
index 196a2ca..c5c4dc6 100644
--- a/lib/bonus/avulso-processo.ts
+++ b/lib/bonus/avulso-processo.ts
@@ -1,7 +1,8 @@
 import "server-only";
-import { pedidoDaChamada, type PedidoDaChamada } from "./acao-da-chamada";
+import { pedidoDaChamada, type AcaoDaChamada, type PedidoDaChamada } from "./acao-da-chamada";
 import type { ContaGuardada } from "./arte-conta";
 import { contextoDoLabs, contextoLivre, tituloInterno, type PedidoAvulso } from "./avulso-pedido";
+import { textoDaRecusaDoPedidoAvulso } from "./avulso-textos";
 import { contextoGravado, type ContextoDoCarrossel } from "./carrossel-ia-parametros";
 import type { LinhaDoCarrossel } from "./carrossel-linha";
 import { criarCarrosselAvulso } from "./carrossel-repositorio";
@@ -12,7 +13,7 @@ import {
   textoDoTetoDoCarrossel,
   textoDosProblemasDoCarrossel,
 } from "./carrossel-textos";
-import type { SituacaoNoLabs } from "./publicado";
+import type { SituacaoDoAvulso } from "./publicado";
 import { geracaoNaTela } from "./tempos";
 
 // O CARROSSEL AVULSO DE PONTA A PONTA (spec da Etapa 7), fora da action: as actions só conferem a
@@ -20,26 +21,42 @@ import { geracaoNaTela } from "./tempos";
 // caminho daqui para baixo. As decisões moram nas funções puras (avulso-pedido.ts); aqui se costura a
 // ordem: o Labs, o texto à mão, o teto e a linha.
 
-/** Quem lê a situação de um bônus no Labs: `situacaoNoLabs` com a LABS_URL; o teste passa uma falsa. */
-export type LerSituacao = (codigo: string) => Promise<SituacaoNoLabs>;
+/**
+ * Quem lê a situação de um bônus no Labs, pela regra do avulso (spec da Etapa 8):
+ * `situacaoDoAvulsoNoLabs` com a LABS_URL; o teste passa uma falsa.
+ */
+export type LerSituacao = (codigo: string) => Promise<SituacaoDoAvulso>;
 
 export const TEXTO_AVULSO_SEM_CONTEXTO =
   "O pedido deste carrossel foi gravado sem o tema e o conteúdo. Crie outro em Novo carrossel.";
 
+/** O bônus do Labs sem palavra, pedido sem a ação da chamada (spec da Etapa 8). */
+export const TEXTO_LABS_SEM_ACAO = "Escolha o que a chamada pede: este bônus do Labs não tem palavra-chave.";
+
+/** O "Gerar de novo" de um carrossel com palavra, cujo bônus perdeu a palavra no Labs (spec da Etapa 8). */
+export const TEXTO_LABS_PERDEU_A_PALAVRA =
+  "No Labs, este bônus não tem mais palavra-chave. Crie um carrossel novo e escolha o que a chamada pede.";
+
 type Recusa = { ok: false; texto: string };
 
 /**
  * A palavra e o contexto do bônus do Labs, lidos agora pelo código, e nunca do formulário: só um
- * bônus "publicado", com palavra e tema no formato que o Chat usa, passa (`situacaoNaLista`).
+ * bônus "publicado" pela regra do avulso passa (`situacaoNaListaDoAvulso`, spec da Etapa 8). Com
+ * palavra no Labs, a chamada pede a palavra, e a ação é ignorada; sem palavra, a chamada pede a ação,
+ * e sem ela a recusa é `semAcao`.
  */
 async function doLabs(
   codigo: string,
   oQueResolve: string,
+  acao: AcaoDaChamada | null,
+  semAcao: string,
   lerSituacao: LerSituacao
 ): Promise<{ ok: true; chamada: PedidoDaChamada; contexto: ContextoDoCarrossel } | Recusa> {
   const s = await lerSituacao(codigo);
   if (s.tipo !== "publicado") return { ok: false, texto: quadroDaSituacao(s).texto };
-  return { ok: true, chamada: { palavra: s.bonus.palavra, acao: null }, contexto: contextoDoLabs({ codigo, ...s.bonus }, oQueResolve) };
+  const contexto = contextoDoLabs({ codigo, ...s.bonus }, oQueResolve);
+  if (s.bonus.palavra !== null) return { ok: true, chamada: { palavra: s.bonus.palavra, acao: null }, contexto };
+  return acao ? { ok: true, chamada: { palavra: null, acao }, contexto } : { ok: false, texto: semAcao };
 }
 
 /** As colunas da palavra e da ação, para gravar (`criarCarrosselAvulso`). */
@@ -61,10 +78,15 @@ export async function pedirAvulso(p: {
   lerSituacao: LerSituacao;
 }): Promise<{ ok: true; id: string; gerar: boolean } | Recusa> {
   const { pedido } = p;
-  const origem =
-    pedido.origem === "labs"
-      ? await doLabs(pedido.codigo, pedido.destaque, p.lerSituacao)
-      : { ok: true as const, chamada: { palavra: pedido.palavra, acao: null } as PedidoDaChamada, contexto: contextoLivre(pedido) };
+  let origem: { ok: true; chamada: PedidoDaChamada; contexto: ContextoDoCarrossel } | Recusa;
+  if (pedido.origem === "labs") {
+    origem = await doLabs(pedido.codigo, pedido.destaque, pedido.acao, TEXTO_LABS_SEM_ACAO, p.lerSituacao);
+  } else {
+    const chamada = pedidoDaChamada({ palavra: pedido.palavra, acao_da_chamada: pedido.acao });
+    origem = chamada
+      ? { ok: true, chamada, contexto: contextoLivre(pedido) }
+      : { ok: false, texto: textoDaRecusaDoPedidoAvulso("sem_acao") };
+  }
   if (!origem.ok) return origem;
 
   let texto: TextoDoCarrossel | null = null;
@@ -107,7 +129,7 @@ export async function gerarAvulsoDeNovo(p: {
   let origem: { ok: true; chamada: PedidoDaChamada; contexto: ContextoDoCarrossel } | Recusa;
   if (linha.origem === "labs" && linha.labs_codigo) {
     const destaque = gravado && !("tipo" in gravado) ? gravado.oQueResolve : "";
-    origem = await doLabs(linha.labs_codigo, destaque, p.lerSituacao);
+    origem = await doLabs(linha.labs_codigo, destaque, linha.acao_da_chamada, TEXTO_LABS_PERDEU_A_PALAVRA, p.lerSituacao);
   } else if (linha.origem === "livre" && gravado && "tipo" in gravado) {
     const chamada = pedidoDaChamada(linha);
     origem = chamada ? { ok: true, chamada, contexto: gravado } : { ok: false, texto: TEXTO_AVULSO_SEM_CONTEXTO };
```

Em `lib/bonus/avulso-textos.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/avulso-textos.ts b/lib/bonus/avulso-textos.ts
index c2b90a5..3aa07fa 100644
--- a/lib/bonus/avulso-textos.ts
+++ b/lib/bonus/avulso-textos.ts
@@ -29,6 +29,8 @@ export function textoDaRecusaDoPedidoAvulso(motivo: RecusaDoPedidoAvulso): strin
       return `O tema passa de ${TEMA_MAX} caracteres.`;
     case "palavra_invalida":
       return `A palavra-chave é uma palavra só, com letras e números, de ${PALAVRA_MIN} a ${PALAVRA_MAX}.`;
+    case "sem_acao":
+      return "Escolha o que a chamada pede.";
     case "conteudo_curto":
       return `Escreva ou cole o conteúdo do post, com pelo menos ${CONTEUDO_MIN} caracteres.`;
     case "conteudo_longo":
```

Em `app/carrosseis/actions.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/carrosseis/actions.ts b/app/carrosseis/actions.ts
index f6bf947..f9beb7c 100644
--- a/app/carrosseis/actions.ts
+++ b/app/carrosseis/actions.ts
@@ -16,7 +16,7 @@ import { camposDoFormulario } from "@/lib/bonus/carrossel-texto";
 import { TEXTO_CARROSSEL_NAO_ENCONTRADO, urlDoCarrosselComAviso } from "@/lib/bonus/carrossel-textos";
 import { temChaveDaIA } from "@/lib/bonus/config";
 import { ehIdDeBonus } from "@/lib/bonus/pedido";
-import { situacaoNoLabs } from "@/lib/bonus/publicado";
+import { situacaoDoAvulsoNoLabs } from "@/lib/bonus/publicado";
 import { textoDaConfig } from "@/lib/bonus/textos";
 
 // AS AÇÕES DO CARROSSEL AVULSO (spec da Etapa 7). O carrossel pronto usa as actions de sempre
@@ -35,7 +35,7 @@ async function exigirSessao(): Promise<void> {
   if (!isValidSession(jarra.get(SESSION_COOKIE)?.value)) redirect("/entrar");
 }
 
-const lerSituacao = (codigo: string) => situacaoNoLabs(process.env.LABS_URL, codigo);
+const lerSituacao = (codigo: string) => situacaoDoAvulsoNoLabs(process.env.LABS_URL, codigo);
 
 async function contaDoCookie(): Promise<string | undefined> {
   return (await cookies()).get(ACCOUNT_COOKIE)?.value;
@@ -56,6 +56,8 @@ export async function pedirCarrosselAvulso(_anterior: AvisoDoAvulso | null, form
     destaque: form.get("destaque"),
     tema: form.get("tema"),
     palavra: form.get("palavra"),
+    semPalavra: form.get("sem_palavra"),
+    acao: form.get("acao"),
     conteudo: form.get("conteudo"),
     total: form.get("total"),
     jeito: form.get("jeito"),
```

Em `app/carrosseis/[cid]/page.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/carrosseis/[cid]/page.tsx b/app/carrosseis/[cid]/page.tsx
index c9730c4..1db52e9 100644
--- a/app/carrosseis/[cid]/page.tsx
+++ b/app/carrosseis/[cid]/page.tsx
@@ -17,7 +17,7 @@ import {
 } from "@/lib/bonus/carrossel-textos";
 import { ehTabelaAusente } from "@/lib/bonus/erros";
 import { urlPublicaDoBonus } from "@/lib/bonus/labs";
-import { situacaoNoLabs } from "@/lib/bonus/publicado";
+import { situacaoDoAvulsoNoLabs } from "@/lib/bonus/publicado";
 import { geracaoNaTela } from "@/lib/bonus/tempos";
 import { TEXTO_TRAVOU, type TomDoQuadro } from "@/lib/bonus/textos";
 import { gerarAvulsoDeNovo } from "../actions";
@@ -65,7 +65,7 @@ export default async function PaginaDoAvulso({
   // pelo mesmo motivo: o bônus pode ser despublicado ou trocar de palavra no /admin do Labs depois de
   // gerar. Durante a geração não, porque a tela pergunta ao servidor a cada 2 s.
   const codigo = carrossel.origem === "labs" ? carrossel.labs_codigo : null;
-  const situacao = codigo && geracao !== "gerando" ? await situacaoNoLabs(process.env.LABS_URL, codigo) : null;
+  const situacao = codigo && geracao !== "gerando" ? await situacaoDoAvulsoNoLabs(process.env.LABS_URL, codigo) : null;
   const quadro = situacao ? quadroDaSituacao(situacao) : null;
   // A palavra no Labs comparada com a do carrossel, com os dois lados do sem palavra-chave (Etapa 8).
   const avisoDaPalavra = situacao?.tipo === "publicado" ? avisoDaPalavraNoLabs(situacao.bonus.palavra, carrossel.palavra) : null;
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx vitest run tests/bonus-avulso-pedido.test.ts tests/bonus-avulso-paginas.test.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-avulso-processo.integracao.ts
```

Esperado: `tsc` limpo; os 59 puros passam; na integração, `[rede-global] ALVO: banco de TESTE` e os 22
passam.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/avulso-pedido.ts lib/bonus/avulso-processo.ts lib/bonus/avulso-textos.ts app/carrosseis/actions.ts "app/carrosseis/[cid]/page.tsx" tests/bonus-avulso-pedido.test.ts tests/bonus-avulso-paginas.test.ts testes-integracao/bonus-avulso-processo.integracao.ts
test "$(git branch --show-current)" = "carrossel-sem-palavra"
git add lib/bonus/avulso-pedido.ts lib/bonus/avulso-processo.ts lib/bonus/avulso-textos.ts app/carrosseis/actions.ts "app/carrosseis/[cid]/page.tsx" tests/bonus-avulso-pedido.test.ts tests/bonus-avulso-paginas.test.ts testes-integracao/bonus-avulso-processo.integracao.ts
git commit -m "feat(bonus): o pedido sem palavra-chave, e o avulso pela regra nova do Labs"
```

---

### FASE 8.9 — O "Novo carrossel" sem palavra-chave, com a ação da chamada

**Arquivos:**
- Modificar: `app/carrosseis/novo/formulario-do-avulso.tsx`, `app/carrosseis/novo/page.tsx`
- Testar: `testes-dom/bonus-novo-carrossel.dom.tsx`, `tests/bonus-avulso-paginas.test.ts`

**Interfaces:**
- Muda: `FormularioDoAvulso` com `deFora?: string | null`; o formulário manda `sem_palavra=1` e `acao`
  (o rádio "O que a chamada pede"). A página entrega `textoDosBonusDeFora(lista.deFora)`.

- [ ] **Passo 1: os testes**

Em `testes-dom/bonus-novo-carrossel.dom.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-dom/bonus-novo-carrossel.dom.tsx b/testes-dom/bonus-novo-carrossel.dom.tsx
index 5a18ba0..3b6edf1 100644
--- a/testes-dom/bonus-novo-carrossel.dom.tsx
+++ b/testes-dom/bonus-novo-carrossel.dom.tsx
@@ -23,13 +23,16 @@ const SUMIDO: BonusDoLabs = {
   descricao: "Mensagens prontas para trazer de volta quem sumiu.",
 };
 
-function renderizar(respostas: AvisoDoAvulso[] = [], { restam = 10, falhaDaLista = null as string | null } = {}) {
+function renderizar(
+  respostas: AvisoDoAvulso[] = [],
+  { restam = 10, falhaDaLista = null as string | null, bonus = [BRUTAL, SUMIDO], deFora = null as string | null } = {}
+) {
   const recebidos: FormData[] = [];
   const acao = async (_anterior: AvisoDoAvulso | null, f: FormData) => {
     recebidos.push(f);
     return respostas.shift() ?? null;
   };
-  render(<FormularioDoAvulso acao={acao} bonus={[BRUTAL, SUMIDO]} falhaDaLista={falhaDaLista} restam={restam} />);
+  render(<FormularioDoAvulso acao={acao} bonus={bonus} falhaDaLista={falhaDaLista} deFora={deFora} restam={restam} />);
   return recebidos;
 }
 
@@ -166,3 +169,70 @@ describe("escrever à mão", () => {
     expect(screen.queryByLabelText("Gancho (slide 1)")).toBeNull();
   });
 });
+
+// SEM PALAVRA-CHAVE (spec da Etapa 8): no texto livre, a caixa troca a palavra pela ação; o bônus do
+// Labs sem palavra aparece marcado e pede a ação; os bônus que ficam de fora são contados.
+describe("o novo carrossel sem palavra-chave", () => {
+  const SEM_PALAVRA: BonusDoLabs = { ...SUMIDO, codigo: "bonus-sem-palavra", palavra: null, titulo: "Um bônus sem palavra" };
+  const acoes = () => ["Salvar o post", "Compartilhar", "Seguir o perfil", "Comentar a opinião"].map((r) => campo(r));
+
+  it("texto livre: a caixa esconde a palavra, pede a ação, e manda a caixa e a ação", async () => {
+    const recebidos = renderizar();
+    fireEvent.click(screen.getByLabelText("De um texto livre"));
+    expect(screen.queryByText("O que a chamada pede")).toBeNull();
+    fireEvent.click(screen.getByLabelText("Sem palavra-chave"));
+    expect(screen.queryByLabelText("Palavra-chave")).toBeNull();
+    expect(screen.getByText("O que a chamada pede")).toBeTruthy();
+    expect(acoes().map((a) => a.checked)).toEqual([false, false, false, false]);
+    escrever("Tema", "Vendas");
+    escrever("Conteúdo", "Como vender sem parecer chato, em cinco passos.");
+    fireEvent.click(screen.getByLabelText("Salvar o post"));
+    await clicar("Gerar com a IA");
+    expect(recebidos.map(doFormulario)).toEqual([
+      {
+        origem: "livre",
+        tema: "Vendas",
+        sem_palavra: "1",
+        acao: "salvar",
+        conteudo: "Como vender sem parecer chato, em cinco passos.",
+        total: "10",
+        jeito: "ia",
+      },
+    ]);
+  });
+
+  it("o bônus do Labs sem palavra aparece marcado, e pede a ação", async () => {
+    const recebidos = renderizar([], { bonus: [BRUTAL, SEM_PALAVRA] });
+    escrever("Bônus do Labs", SEM_PALAVRA.codigo);
+    expect(screen.getByText("Sem palavra-chave · Vendas")).toBeTruthy();
+    fireEvent.click(screen.getByLabelText("Comentar a opinião"));
+    await clicar("Gerar com a IA");
+    expect(recebidos.map(doFormulario)).toEqual([
+      { origem: "labs", codigo: SEM_PALAVRA.codigo, acao: "comentar", total: "10", jeito: "ia" },
+    ]);
+  });
+
+  it("o bônus do Labs com palavra não mostra a escolha da ação", () => {
+    renderizar([], { bonus: [BRUTAL, SEM_PALAVRA] });
+    escrever("Bônus do Labs", BRUTAL.codigo);
+    expect(screen.queryByText("O que a chamada pede")).toBeNull();
+  });
+
+  it("a frase dos bônus que ficam de fora aparece embaixo da lista", () => {
+    renderizar([], { deFora: "1 bônus do Labs não aparece: 1 sem tema." });
+    expect(screen.getByText("1 bônus do Labs não aparece: 1 sem tema.")).toBeTruthy();
+  });
+
+  it("à mão, sem palavra: a chamada avisa a palavra gritada, e a legenda não pede palavra", () => {
+    renderizar();
+    fireEvent.click(screen.getByLabelText("De um texto livre"));
+    fireEvent.click(screen.getByLabelText("Sem palavra-chave"));
+    fireEvent.click(botao("Escrever à mão"));
+    escrever("Chamada (slide 10)", "Comente GUIA e receba o roteiro.");
+    escrever("Legenda do post", "Uma legenda que não pede palavra nenhuma, e tudo bem.");
+    expect(
+      screen.getByText("Tem GUIA em maiúsculas: este carrossel não tem palavra-chave, e quem comentar uma palavra não recebe nada.")
+    ).toBeTruthy();
+    expect(screen.queryByText(/Falta a palavra/)).toBeNull();
+  });
+});
```

Em `tests/bonus-avulso-paginas.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-avulso-paginas.test.ts b/tests/bonus-avulso-paginas.test.ts
index f7b9614..17442e7 100644
--- a/tests/bonus-avulso-paginas.test.ts
+++ b/tests/bonus-avulso-paginas.test.ts
@@ -165,3 +165,11 @@ describe("quem usa cada regra do Labs", () => {
     expect(ler("app/bonus/carrossel-actions.ts")).not.toContain("situacaoDoAvulsoNoLabs");
   });
 });
+
+// OS BÔNUS DO LABS QUE FICAM DE FORA (spec da Etapa 8, achado 84): a página do Novo carrossel entrega a
+// frase, montada fora do JSX, ao formulário.
+describe("o Novo carrossel e os bônus que ficam de fora", () => {
+  it("a página entrega a frase dos bônus de fora ao formulário", () => {
+    expect(ler("app/carrosseis/novo/page.tsx")).toContain("deFora={lista.ok ? textoDosBonusDeFora(lista.deFora) : null}");
+  });
+});
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run --config vitest.dom.config.ts testes-dom/bonus-novo-carrossel.dom.tsx
npx vitest run tests/bonus-avulso-paginas.test.ts
```

Esperado: a tela: 4 caem e 10 passam (14); os puros: 1 cai e 20 passam (21).

- [ ] **Passo 3: o código**

Em `app/carrosseis/novo/formulario-do-avulso.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/carrosseis/novo/formulario-do-avulso.tsx b/app/carrosseis/novo/formulario-do-avulso.tsx
index 6a597ba..e3a764a 100644
--- a/app/carrosseis/novo/formulario-do-avulso.tsx
+++ b/app/carrosseis/novo/formulario-do-avulso.tsx
@@ -3,6 +3,7 @@ import { useActionState, useMemo, useState, useTransition } from "react";
 import { alertWarn, btnPrimary, btnSecondary, hint, input, label } from "@/app/ui";
 import AvisoDoFormulario from "@/app/bonus/aviso-do-formulario";
 import Campo from "@/app/bonus/[id]/carrossel/[cid]/campo";
+import { ACOES_DA_CHAMADA, rotuloDaAcao, type AcaoDaChamada } from "@/lib/bonus/acao-da-chamada";
 import { CONTEUDO_MAX, DESTAQUE_MAX, type JeitoDoTexto } from "@/lib/bonus/avulso-pedido";
 import type { AvisoDoAvulso } from "@/lib/bonus/avulso-textos";
 import { SLIDES_MAX, SLIDES_MIN, SLIDES_PADRAO, TETO_CARROSSEL_DIARIO } from "@/lib/bonus/carrossel-pedido";
@@ -23,6 +24,10 @@ import type { BonusDoLabs } from "@/lib/bonus/publicado";
 // action, e o `<select>` controlado volta para a opção do HTML do servidor. A recusa volta como estado
 // (achado 52), e o que se escreveu fica na tela. A action entra por propriedade, para o teste de tela
 // usar uma falsa.
+//
+// SEM PALAVRA-CHAVE (spec da Etapa 8): no texto livre, a caixa "Sem palavra-chave" esconde a palavra e
+// pede a ação da chamada; o bônus do Labs sem palavra aparece marcado e pede a ação também. Os campos
+// à mão, sem palavra, avisam a palavra gritada na chamada (`palavra` nula em campo.tsx).
 
 /** A busca pelo título, sem acento e sem diferença de maiúscula. */
 function semAcento(t: string): string {
@@ -33,6 +38,7 @@ export default function FormularioDoAvulso({
   acao,
   bonus,
   falhaDaLista,
+  deFora = null,
   restam,
 }: {
   acao: (anterior: AvisoDoAvulso | null, form: FormData) => Promise<AvisoDoAvulso | null>;
@@ -40,6 +46,8 @@ export default function FormularioDoAvulso({
   bonus: BonusDoLabs[];
   /** A frase da falha da leitura do Labs; null quando a lista veio. */
   falhaDaLista: string | null;
+  /** A frase dos bônus do Labs que ficaram de fora da escolha (achado 84); null quando nenhum. */
+  deFora?: string | null;
   restam: number;
 }) {
   // `pendente` desliga os botões enquanto o pedido roda: um clique duplo criaria dois carrosséis.
@@ -52,6 +60,8 @@ export default function FormularioDoAvulso({
   const [destaque, setDestaque] = useState("");
   const [tema, setTema] = useState("");
   const [palavra, setPalavra] = useState("");
+  const [semPalavra, setSemPalavra] = useState(false);
+  const [acaoDaChamada, setAcaoDaChamada] = useState<AcaoDaChamada | null>(null);
   const [conteudo, setConteudo] = useState("");
   const [total, setTotal] = useState(String(SLIDES_PADRAO));
 
@@ -63,6 +73,8 @@ export default function FormularioDoAvulso({
     return bonus.filter((b) => b === escolhido || !q || semAcento(b.titulo).includes(q));
   }, [bonus, busca, escolhido]);
   const palavraDoPost = origem === "labs" ? (escolhido?.palavra ?? "") : normalizarPalavra(palavra);
+  // Sem palavra: a caixa do texto livre, ou o bônus do Labs que não tem palavra. Aí a chamada pede a ação.
+  const semPalavraNoPost = origem === "livre" ? semPalavra : escolhido !== null && escolhido.palavra === null;
   const semLista = origem === "labs" && falhaDaLista !== null;
 
   return (
@@ -114,10 +126,11 @@ export default function FormularioDoAvulso({
               </select>
               {escolhido && (
                 <p className={hint}>
-                  Palavra {escolhido.palavra} · {escolhido.tema}
+                  {escolhido.palavra === null ? "Sem palavra-chave" : `Palavra ${escolhido.palavra}`} · {escolhido.tema}
                 </p>
               )}
-              {bonus.length === 0 && <p className={hint}>Nenhum bônus publicado no Labs com palavra-chave e tema.</p>}
+              {bonus.length === 0 && <p className={hint}>Nenhum bônus publicado no Labs que o Chat consiga usar.</p>}
+              {deFora && <p className={hint}>{deFora}</p>}
             </div>
             <div>
               <label htmlFor="destaque" className={label}>
@@ -145,20 +158,26 @@ export default function FormularioDoAvulso({
             </label>
             <input id="tema" name="tema" value={tema} maxLength={TEMA_MAX} onChange={(e) => setTema(e.target.value)} className={input} />
           </div>
-          <div>
-            <label htmlFor="palavra" className={label}>
-              Palavra-chave
-            </label>
-            <input
-              id="palavra"
-              name="palavra"
-              value={palavra}
-              maxLength={PALAVRA_MAX}
-              onChange={(e) => setPalavra(e.target.value)}
-              className={input}
-            />
-            <p className={hint}>A palavra que a pessoa comenta para receber. Uma palavra só, com letras e números.</p>
-          </div>
+          <label className="flex items-center gap-2 text-sm">
+            <input type="checkbox" name="sem_palavra" value="1" checked={semPalavra} onChange={(e) => setSemPalavra(e.target.checked)} />
+            Sem palavra-chave
+          </label>
+          {!semPalavra && (
+            <div>
+              <label htmlFor="palavra" className={label}>
+                Palavra-chave
+              </label>
+              <input
+                id="palavra"
+                name="palavra"
+                value={palavra}
+                maxLength={PALAVRA_MAX}
+                onChange={(e) => setPalavra(e.target.value)}
+                className={input}
+              />
+              <p className={hint}>A palavra que a pessoa comenta para receber. Uma palavra só, com letras e números.</p>
+            </div>
+          )}
           <div>
             <label htmlFor="conteudo" className={label}>
               Conteúdo
@@ -177,6 +196,21 @@ export default function FormularioDoAvulso({
         </div>
       )}
 
+      {semPalavraNoPost && (
+        <fieldset className="space-y-2">
+          <legend className={label}>O que a chamada pede</legend>
+          <div className="flex flex-wrap gap-4 text-sm">
+            {ACOES_DA_CHAMADA.map((a) => (
+              <label key={a} className="flex items-center gap-2">
+                <input type="radio" name="acao" value={a} checked={acaoDaChamada === a} onChange={() => setAcaoDaChamada(a)} />
+                {rotuloDaAcao(a)}
+              </label>
+            ))}
+          </div>
+          <p className={hint}>Sem palavra-chave, não há funil: a chamada pede só esta ação, sem palavra em maiúsculas.</p>
+        </fieldset>
+      )}
+
       <div>
         <label htmlFor="total" className={label}>
           Quantos slides?
@@ -201,7 +235,7 @@ export default function FormularioDoAvulso({
               valorInicial=""
               max={c.max}
               linhas={c.linhas}
-              palavra={c.pedePalavra && palavraDoPost ? palavraDoPost : undefined}
+              palavra={!c.pedePalavra ? undefined : semPalavraNoPost ? null : palavraDoPost || undefined}
               soAPalavra={c.soAPalavra}
             />
           ))}
```

Em `app/carrosseis/novo/page.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/carrosseis/novo/page.tsx b/app/carrosseis/novo/page.tsx
index cac2fbe..139c878 100644
--- a/app/carrosseis/novo/page.tsx
+++ b/app/carrosseis/novo/page.tsx
@@ -2,6 +2,7 @@ import Link from "next/link";
 import { alertError, card, link, pageSubtitle, pageTitle } from "@/app/ui";
 import { restamCarrosseisHoje } from "@/lib/bonus/carrossel-pedido";
 import { carrosseisNasUltimas24h } from "@/lib/bonus/carrossel-repositorio";
+import { textoDosBonusDeFora } from "@/lib/bonus/avulso-textos";
 import { TEXTO_TABELA_CARROSSEL_AUSENTE, quadroDaSituacao } from "@/lib/bonus/carrossel-textos";
 import { ehTabelaAusente } from "@/lib/bonus/erros";
 import { listaDoLabs } from "@/lib/bonus/publicado";
@@ -40,6 +41,7 @@ export default async function NovoCarrossel() {
           acao={pedirCarrosselAvulso}
           bonus={lista.ok ? lista.bonus : []}
           falhaDaLista={lista.ok ? null : quadroDaSituacao({ tipo: lista.tipo }).texto}
+          deFora={lista.ok ? textoDosBonusDeFora(lista.deFora) : null}
           restam={restamCarrosseisHoje(usadas)}
         />
       </section>
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx vitest run --config vitest.dom.config.ts testes-dom/bonus-novo-carrossel.dom.tsx
npx vitest run tests/bonus-avulso-paginas.test.ts
```

Esperado: `tsc` limpo; 14 de tela e 21 puros passam.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" app/carrosseis/novo/formulario-do-avulso.tsx app/carrosseis/novo/page.tsx testes-dom/bonus-novo-carrossel.dom.tsx tests/bonus-avulso-paginas.test.ts
test "$(git branch --show-current)" = "carrossel-sem-palavra"
git add app/carrosseis/novo/formulario-do-avulso.tsx app/carrosseis/novo/page.tsx testes-dom/bonus-novo-carrossel.dom.tsx tests/bonus-avulso-paginas.test.ts
git commit -m "feat(bonus): o Novo carrossel sem palavra-chave, com a ação da chamada"
```

---

### FASE 8.10 — A lista do Labs está no contrato, e o publicar sem palavra

**Arquivos:**
- Modificar: `lib/bonus/publicado.ts`, `lib/bonus/temas.ts`, `app/carrosseis/novo/page.tsx` (só
  comentários), `docs/specs/2026-10-06-carrossel-avulso.md` (a nota de correção)
- Testar: `tests/bonus-avulso-paginas.test.ts`, `testes-integracao/bonus-publicar-processo.integracao.ts`

- [ ] **Passo 1: os testes**

Em `tests/bonus-avulso-paginas.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-avulso-paginas.test.ts b/tests/bonus-avulso-paginas.test.ts
index 17442e7..220ee7f 100644
--- a/tests/bonus-avulso-paginas.test.ts
+++ b/tests/bonus-avulso-paginas.test.ts
@@ -173,3 +173,16 @@ describe("o Novo carrossel e os bônus que ficam de fora", () => {
     expect(ler("app/carrosseis/novo/page.tsx")).toContain("deFora={lista.ok ? textoDosBonusDeFora(lista.deFora) : null}");
   });
 });
+
+// O CONTRATO DA LISTA DO LABS (achado 83): a lista está no contrato desde 01/10 (site-ia,
+// docs/contrato-metodo-chat.md, seção do GET /api/bonus). Nenhum comentário diz o contrário, e a spec
+// da Etapa 7 ganhou a nota de correção.
+describe("a lista do Labs está no contrato", () => {
+  it.each(["lib/bonus/publicado.ts", "lib/bonus/temas.ts", "app/carrosseis/novo/page.tsx"])("%s não diz que ela está fora", (arquivo) => {
+    expect(ler(arquivo)).not.toMatch(/n[ãa]o est[áa] no contrato/i);
+  });
+
+  it("a spec da Etapa 7 tem a nota de correção", () => {
+    expect(ler("docs/specs/2026-10-06-carrossel-avulso.md")).toContain("**Correção de 08/10 (achado 83):**");
+  });
+});
```

Em `testes-integracao/bonus-publicar-processo.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/bonus-publicar-processo.integracao.ts b/testes-integracao/bonus-publicar-processo.integracao.ts
index f6b5b2d..f21145d 100644
--- a/testes-integracao/bonus-publicar-processo.integracao.ts
+++ b/testes-integracao/bonus-publicar-processo.integracao.ts
@@ -648,3 +648,32 @@ describe("publicar o carrossel avulso", () => {
     expect(travado.ok ? null : travado.recusa.motivo).toBe("travado");
   });
 });
+
+// O CARROSSEL SEM PALAVRA-CHAVE (spec da Etapa 8) publica pelo mesmo caminho: a publicação não olha a
+// palavra. Ele sai na conta dele, com a reserva antes da fila, e trava como os outros.
+describe("publicar o carrossel sem palavra-chave", () => {
+  it("agendado: entra na conta do carrossel, com a reserva, e trava", async () => {
+    const [c] = (await banco
+      .db()
+      .sql()
+      .query(
+        `insert into carrosseis_gerados (origem, total_slides, palavra, acao_da_chamada, contexto, estado, gerado, arte)
+         values ('livre', $1, null, 'salvar', $2::jsonb, 'pronto', $3::jsonb, $4::jsonb) returning id`,
+        [TEXTO.slides.length + 2, { tipo: "livre", tema: "Vendas", conteudo: "Como vender sem parecer chato, em cinco passos." }, TEXTO, ARTE]
+      )) as { id: string }[];
+    const id = c.id;
+    for (const n of [2, 3, 4]) {
+      const g = await processo.guardarImagem({ id, numero: n, caminho: await subir(id, n, "slide"), contas });
+      if (!g.ok) throw new Error(`guardar recusou: ${g.recusa.motivo}`);
+    }
+    const quando = new Date(Date.now() + 7 * 86_400_000);
+    expect((await processo.publicarNaFila({ id, quando, artes: await artesDe(id), contas, drenar })).ok).toBe(true);
+
+    const [item, ...resto] = await fila();
+    expect(resto).toEqual([]);
+    expect([item.account_id, item.payload.forma, item.status]).toEqual([CONTA, "carrossel", "pending"]);
+    expect((await arteDe(id)).publicacao).toMatchObject({ chave: item.dedupe_key });
+    const travado = await processo.assinarImagem({ id, numero: 2, destino: "slide", arquivo: DECLARADO, contas });
+    expect(travado.ok ? null : travado.recusa.motivo).toBe("travado");
+  });
+});
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-avulso-paginas.test.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-publicar-processo.integracao.ts
```

Esperado: os puros: 4 caem e 21 passam (25); na integração, `[rede-global] ALVO: banco de TESTE`, e
os 41 passam: o caso novo passa direto, porque a publicação não olha a palavra (item 6 do ensaio).

- [ ] **Passo 3: o código (só comentários e a nota da spec)**

Em `lib/bonus/publicado.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/publicado.ts b/lib/bonus/publicado.ts
index 063362d..a235bf6 100644
--- a/lib/bonus/publicado.ts
+++ b/lib/bonus/publicado.ts
@@ -1,9 +1,12 @@
 // A SITUAÇÃO DE UM BÔNUS NO LABS, lida da lista pública (`GET /api/bonus`).
 //
-// ⚠️ ESTA LEITURA NÃO ESTÁ NO CONTRATO (é a mesma de lib/bonus/temas.ts), e por isso FALHA
-// FECHADA: só "publicado" libera o carrossel. A lista traz só bônus ATIVOS, com `codigo` (o
-// slug), `palavraChave`, `titulo`, `tema` e `descricao` (medido em 30/09). Do lado do Labs ela
-// tem cache de 30 minutos, invalidado por toda ação do /admin e pelo POST (medido pelo auditor).
+// A LISTA ESTÁ NO CONTRATO DO LABS desde 01/10 (site-ia, docs/contrato-metodo-chat.md, seção do
+// `GET /api/bonus`; até a Etapa 8 este comentário dizia o contrário, achado 83). É a mesma leitura de
+// lib/bonus/temas.ts. A lista traz só bônus ATIVOS, em ordem de criação, sem o prompt, com `codigo` (o
+// slug), `titulo` e `descricao` sempre, e `palavraChave`, `tema` e `skillId` OPCIONAIS: sem valor, a
+// chave some do JSON. Por isso a leitura FALHA FECHADA: só "publicado" libera o carrossel. Do lado
+// do Labs ela tem cache de 30 minutos, invalidado por toda ação do /admin e pelo POST (medido pelo
+// auditor).
 //
 // A PALAVRA É A DO LABS, e nunca a que o Chat guardou: ela pode ter sido trocada no /admin de
 // lá depois do envio (o primeiro bônus de 30/09 foi enviado com ZZTESTECHAT e publicado com
@@ -65,7 +68,7 @@ function textoAte(v: unknown, max: number): string | null {
 }
 
 /**
- * O Labs manda o campo opcional sem valor como chave AUSENTE (contrato, site-ia 7971720). Texto em
+ * O Labs manda o campo opcional sem valor como chave AUSENTE (o contrato, seção do `GET /api/bonus`). Texto em
  * branco conta como ausente. `null` não é o contrato, e fica em `formato_estranho`.
  */
 function ausente(v: unknown): boolean {
```

Em `lib/bonus/temas.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/temas.ts b/lib/bonus/temas.ts
index e001748..b827f94 100644
--- a/lib/bonus/temas.ts
+++ b/lib/bonus/temas.ts
@@ -1,9 +1,10 @@
 // AS SUGESTÕES DE TEMA, lidas do catálogo público do Labs.
 //
-// ⚠️ ESTA LEITURA NÃO ESTÁ NO CONTRATO: o `GET /api/bonus` do Labs lista os bônus
-// ATIVOS, sem autenticação (site-ia, route.ts:20-32). Se ele mudar, só as sugestões
-// somem: a lista completa chega na recusa `tema_fora_do_catalogo`, que está no
-// contrato. Por isso toda falha aqui vira lista vazia, e nada mais para.
+// O `GET /api/bonus` do Labs lista os bônus ATIVOS, sem autenticação, e está no contrato
+// desde 01/10 (site-ia, docs/contrato-metodo-chat.md; até a Etapa 8 este comentário dizia o
+// contrário, achado 83), com o `tema` opcional. As sugestões são só ajuda: a lista completa
+// chega na recusa `tema_fora_do_catalogo`. Por isso toda falha aqui vira lista vazia, e nada
+// mais para.
 //
 // SEM CACHE, e de propósito dito: as páginas de app/bonus/ são `force-dynamic`
 // (o padrão do dono), e isso põe `no-store` em todo fetch da página
```

Em `app/carrosseis/novo/page.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/carrosseis/novo/page.tsx b/app/carrosseis/novo/page.tsx
index 139c878..9071a69 100644
--- a/app/carrosseis/novo/page.tsx
+++ b/app/carrosseis/novo/page.tsx
@@ -10,7 +10,8 @@ import { pedirCarrosselAvulso } from "../actions";
 import FormularioDoAvulso from "./formulario-do-avulso";
 
 // O "NOVO CARROSSEL" (spec da Etapa 7). A lista do Labs é lida a cada vez, como a situação do bônus na
-// página dele: ela não está no contrato, e a falha mostra a frase, e não uma lista vazia.
+// página dele, e a falha mostra a frase, e não uma lista vazia. A lista está no contrato do Labs desde
+// 01/10, com a palavra e o tema opcionais (achado 83): o bônus que fica de fora é contado na tela.
 //
 // O teto de lib/bonus/tempos.ts (MAX_DURATION_S): a geração pela IA roda no `after()` da action desta
 // página. O Next exige literal aqui, e tests/bonus-avulso-paginas.test.ts confere que é o mesmo número.
```

Em `docs/specs/2026-10-06-carrossel-avulso.md`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/docs/specs/2026-10-06-carrossel-avulso.md b/docs/specs/2026-10-06-carrossel-avulso.md
index 0e93e40..ba5cae4 100644
--- a/docs/specs/2026-10-06-carrossel-avulso.md
+++ b/docs/specs/2026-10-06-carrossel-avulso.md
@@ -186,6 +186,12 @@ pedido. A lista de escolha do "Novo carrossel" sai da mesma leitura, por uma fun
 de `situacaoNaLista`, com as mesmas regras por item: o bônus fora do formato não aparece. Uma falha
 da leitura mostra a frase da falha, e não a lista vazia.
 
+> **Correção de 08/10 (achado 83):** a lista do Labs está no contrato desde 01/10 (site-ia,
+> `docs/contrato-metodo-chat.md`, seção do `GET /api/bonus`), com `palavraChave` e `tema` opcionais.
+> A frase acima veio de um comentário do código de 30/09, anterior ao contrato. O comportamento não
+> muda: a leitura continua falhando fechada. O bônus sem palavra passou a ser usado na Etapa 8
+> (`docs/specs/2026-10-08-carrossel-sem-palavra.md`).
+
 ### As rotas
 
 Nenhum arquivo de `app/bonus/[id]/carrossel/` muda de lugar. As rotas novas reaproveitam os
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx vitest run tests/bonus-avulso-paginas.test.ts
```

Esperado: `tsc` limpo; os 25 passam.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/publicado.ts lib/bonus/temas.ts app/carrosseis/novo/page.tsx docs/specs/2026-10-06-carrossel-avulso.md tests/bonus-avulso-paginas.test.ts testes-integracao/bonus-publicar-processo.integracao.ts
test "$(git branch --show-current)" = "carrossel-sem-palavra"
git add lib/bonus/publicado.ts lib/bonus/temas.ts app/carrosseis/novo/page.tsx docs/specs/2026-10-06-carrossel-avulso.md tests/bonus-avulso-paginas.test.ts testes-integracao/bonus-publicar-processo.integracao.ts
git commit -m "fix(bonus): a lista do Labs está no contrato, e o publicar sem palavra"
```

---

### FASE 8.11 — O verify, a integração inteira, as mutações e a guarda do diff

- [ ] **Passo 1: o verify, na árvore do projeto**

```bash
env -u CLAUDECODE -u AI_AGENT npm run verify
git diff --stat AGENTS.md
```

Esperado: lint e `tsc` limpos; 107 arquivos e 3 095 casos puros e 22 e 184 de tela; a varredura "SEM
VAZAMENTO em A nem em C"; o build (Turbopack) com "MIGRAÇÃO PULADA" e as rotas `ƒ /carrosseis`,
`ƒ /carrosseis/[cid]`, `ƒ /carrosseis/[cid]/arte` e `ƒ /carrosseis/novo`; o `AGENTS.md` sem diferença.

- [ ] **Passo 2: a integração inteira, no container**

```bash
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npm run test:integracao
```

Esperado: `[rede-global] ALVO: banco de TESTE`; 42 arquivos, 441 passaram e 8 pularam (na base, 42,
418 e 8).

- [ ] **Passo 3: as provas de mutação**

Copie o script do Apêndice A para `$SCRATCH/mutar-sem-palavra.mjs` e rode, da raiz:

```bash
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" node "$SCRATCH/mutar-sem-palavra.mjs"
git status --short
```

Esperado: as 45 com ✓, "45 mutações, 0 ruins", e a árvore limpa depois (cada arquivo
volta byte a byte).

- [ ] **Passo 4: a guarda do diff (pedido da auditoria)**

```bash
git diff --stat 3d96638 -- app/publicar app/api app/automacoes lib/bucket.ts lib/queue-drain.ts lib/engine.ts lib/publicacao.ts lib/dedupe.ts scripts package.json package-lock.json next.config.ts proxy.ts
git diff --stat 3d96638 -- migrations
git diff --stat 3d96638 -- . ':!app/bonus' ':!app/carrosseis' ':!lib/bonus' ':!tests' ':!testes-dom' ':!testes-integracao' ':!docs' ':!migrations/017-carrossel-sem-palavra.sql' ':!lib/esquema.ts'
```

Esperado: a primeira e a terceira saídas vazias; a segunda, só `migrations/017-carrossel-sem-palavra.sql`.

- [ ] **Passo 5: avisar o auditor**, com o hash, os números e o pedido de conferir a branch antes do
  push. O push da branch e o PR só com o OK do Eduardo.

---

### FASE 8.12 — A 017 na produção e a prova real, no preview, com o Eduardo

Cada escrita em produção tem o OK do Eduardo, pela caixa, e a auditoria lê o banco antes e depois
(avisada com a hora). O preview usa o banco e o bucket de produção. **Sem post real.**

- [ ] **Passo 1: a linha de base da auditoria**, só de leitura, antes da 017 (as colunas de
  `carrosseis_gerados`, os carrosséis que existem e o registro das migrações).

- [ ] **Passo 2: o ensaio a seco da 017**

```bash
node scripts/migrar.mjs
```

Esperado: lista só `017-carrossel-sem-palavra.sql` como pendente, sem aplicar nada.

- [ ] **Passo 3: aplicar à mão, com o OK do Eduardo**

Pergunte pela caixa. Com o OK, e com o "pode rodar" da auditoria depois de ela ter a hora:

```bash
node scripts/migrar.mjs --aplicar --a-mao
node scripts/migrar.mjs
```

Esperado: a primeira aplica e anota a `017`; a segunda diz "já aplicada". A soma registrada é a do
passo 5 da FASE 8.1 (`1d202571d8db`). A auditoria lê de novo: a coluna, a palavra de todas as linhas que
já existiam, a ação nula nelas, e os quatro `check`.

- [ ] **Passo 4: o push da branch e o preview, com o OK do Eduardo**

Empurre só a branch (`git push origin refs/heads/carrossel-sem-palavra:refs/heads/carrossel-sem-palavra`).
No log do build do preview, confira o commit, "MIGRAÇÃO PULADA" e as rotas de `/carrosseis`.

- [ ] **Passo 5: a prova, com o Eduardo na tela** (os passos da spec, "A prova real")

1. "Novo carrossel" → texto livre → "Sem palavra-chave" → "Salvar o post" → "Escrever à mão": o
   carrossel nasce pronto, com a palavra nula e a ação `salvar`, sem gastar IA (grava em produção: só
   com o OK).
2. Na página dele: o topo com "sem palavra-chave · a chamada pede: salvar o post"; a chamada com uma
   palavra em maiúsculas recusada ao salvar.
3. Agendar para daqui a 7 dias e cancelar no calendário, sem o aviso do funil (gravam em produção: só
   com o OK).
4. Com o carrossel da prova ainda no banco, o Eduardo abre na produção (`metodochat.vercel.app`) a
   lista `/carrosseis` e a página do carrossel da prova, só olhando, sem salvar nada.

No fim, o que a prova criou sai do banco e do bucket, com o OK do Eduardo e o script lido pela
auditoria antes de rodar (achado 77). Depois: o corpo do PR, conferido pelo auditor, e o PR com o OK
do Eduardo. O merge é do Vinícius, e o build do merge diz "Nada a aplicar".

---

## Apêndice A — as provas de mutação

Cada mutação tira uma proteção e roda o teste que a cobre; o caso nomeado tem de cair. O arquivo
volta byte a byte depois de cada uma. Sem `DATABASE_URL_TESTES`, o script recusa antes de mutar.

```js
// Provas de mutação da Etapa 8 (o carrossel sem palavra-chave). Cada mutação tira uma proteção e roda o
// teste que a cobre; o caso nomeado tem de cair. Cada arquivo volta byte a byte.
// Uso, da raiz do repositório: DATABASE_URL_TESTES=<container> node mutar-sem-palavra.mjs [filtro]
// As mutações INTEG rodam a suíte de integração, que sem DATABASE_URL_TESTES cai na DATABASE_URL, a
// da PRODUÇÃO (achado 68): sem a variável, o script recusa antes de mutar, e uma rodada INTEG que
// não imprime "ALVO: banco de TESTE" conta como ✗.
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const PURA = (f) => `npx vitest run ${f}`;
const TELA = (f) => `npx vitest run --config vitest.dom.config.ts ${f}`;
const INTEG = (f) => `npx vitest run --config vitest.integracao.config.ts ${f}`;

const MIGRACAO = "migrations/017-carrossel-sem-palavra.sql";
const ESQUEMA = "lib/esquema.ts";
const ACAO = "lib/bonus/acao-da-chamada.ts";
const TEXTO = "lib/bonus/carrossel-texto.ts";
const CAMPO = "app/bonus/[id]/carrossel/[cid]/campo.tsx";
const IA = "lib/bonus/carrossel-ia-parametros.ts";
const PUBLICAR_TEXTOS = "lib/bonus/publicar-textos.ts";
const CARROSSEL_TEXTOS = "lib/bonus/carrossel-textos.ts";
const REPO = "lib/bonus/carrossel-repositorio.ts";
const PROCESSO = "lib/bonus/carrossel-processo.ts";
const AVULSO_PROCESSO = "lib/bonus/avulso-processo.ts";
const PAGINA_AVULSA = "app/carrosseis/[cid]/page.tsx";
const REVISAO = "app/bonus/[id]/carrossel/[cid]/revisao.tsx";
const EDITOR = "app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx";
const PUBLICADO = "lib/bonus/publicado.ts";
const AVULSO_TEXTOS = "lib/bonus/avulso-textos.ts";
const PEDIDO = "lib/bonus/avulso-pedido.ts";
const ACOES = "app/carrosseis/actions.ts";
const FORMULARIO = "app/carrosseis/novo/formulario-do-avulso.tsx";
const NOVO = "app/carrosseis/novo/page.tsx";
const PUBLICAR_PROCESSO = "lib/bonus/publicar-processo.ts";

const T_TABELA = INTEG("testes-integracao/bonus-carrossel-tabela.integracao.ts");
const T_PARTIDA = INTEG("testes-integracao/esquema-de-partida.integracao.ts");
const T_ACAO = PURA("tests/bonus-acao-da-chamada.test.ts");
const T_SEM_PALAVRA = PURA("tests/bonus-carrossel-sem-palavra.test.ts");
const T_CAMPO = TELA("testes-dom/bonus-carrossel-campo.dom.tsx");
const T_IA = PURA("tests/bonus-carrossel-ia-parametros.test.ts");
const T_ESTADO = PURA("tests/bonus-publicar-estado.test.ts");
const T_CHAMADA_TELA = PURA("tests/bonus-carrossel-chamada-tela.test.ts");
const T_AVULSO = INTEG("testes-integracao/bonus-carrossel-avulso.integracao.ts");
const T_AVULSO_PROCESSO = INTEG("testes-integracao/bonus-avulso-processo.integracao.ts");
const T_PAGINAS = PURA("tests/bonus-avulso-paginas.test.ts");
const T_EDITOR = TELA("testes-dom/bonus-editor-do-carrossel.dom.tsx");
const T_PUBLICADO = PURA("tests/bonus-publicado.test.ts");
const T_LISTA_TEXTOS = PURA("tests/bonus-lista-do-labs-textos.test.ts");
const T_PEDIDO = PURA("tests/bonus-avulso-pedido.test.ts");
const T_NOVO = TELA("testes-dom/bonus-novo-carrossel.dom.tsx");
const T_PUBLICAR = INTEG("testes-integracao/bonus-publicar-processo.integracao.ts");

const MUTACOES = [
  // 8.1 a migração 017
  { nome: "8.1: sem o check da palavra ou da ação", arq: MIGRACAO,
    de: "  check ((palavra is null) = (acao_da_chamada is not null));", para: "  check (true);",
    cmd: T_TABELA, caso: "o banco recusa a palavra e a ação juntas" },
  { nome: "8.1: sem o check da palavra do bônus do Chat", arq: MIGRACAO,
    de: "  check (origem <> 'bonus' or palavra is not null);", para: "  check (true);",
    cmd: T_TABELA, caso: "o banco recusa o carrossel de bônus do Chat sem palavra, mesmo com a ação" },
  { nome: "8.1: sem o check das quatro ações", arq: MIGRACAO,
    de: "  check (acao_da_chamada in ('salvar', 'compartilhar', 'seguir', 'comentar'));", para: "  check (true);",
    cmd: T_TABELA, caso: "o banco recusa a ação fora das quatro" },
  { nome: "8.1: sem o check da palavra vazia", arq: MIGRACAO,
    de: "  check (palavra <> '');", para: "  check (true);",
    cmd: T_TABELA, caso: "o banco recusa a palavra vazia" },
  { nome: "8.1: a palavra continua obrigatória", arq: MIGRACAO,
    de: "alter table carrosseis_gerados alter column palavra drop not null;\n", para: "",
    cmd: T_TABELA, caso: "o texto livre e o avulso do Labs entram sem palavra e com a ação" },
  { nome: "8.1: a 017 fora da marca d'água", arq: ESQUEMA,
    de: '      de: "017-carrossel-sem-palavra.sql",', para: '      de: "017-outra.sql",',
    cmd: T_PARTIDA, caso: "a MARCA D'ÁGUA cobre a pasta inteira" },
  // 8.2 a ação da chamada
  { nome: "8.2: uma quinta ação", arq: ACAO,
    de: 'export const ACOES_DA_CHAMADA = ["salvar", "compartilhar", "seguir", "comentar"] as const;',
    para: 'export const ACOES_DA_CHAMADA = ["salvar", "compartilhar", "seguir", "comentar", "curtir"] as const;',
    cmd: T_ACAO, caso: "são as mesmas do check da 017 no banco" },
  { nome: "8.2: a linha com as duas juntas pede a palavra", arq: ACAO,
    de: "    return l.palavra && l.acao_da_chamada === null ? { palavra: l.palavra, acao: null } : null;",
    para: "    return l.palavra ? { palavra: l.palavra, acao: null } : null;",
    cmd: T_ACAO, caso: "a linha fora da regra do banco (as duas juntas) não pede nada" },
  // 8.3 a conferência sem palavra
  { nome: "8.3: a IA sem palavra não confere as gritadas", arq: TEXTO,
    de: "    return gritadas.length ? { motivo: \"gritada\", palavras: gritadas } : null;",
    para: "    return null;",
    cmd: T_SEM_PALAVRA, caso: "acusa a chamada com palavra gritada" },
  { nome: "8.3: o salvar sem palavra não confere as gritadas", arq: TEXTO,
    de: "    const gritadas = v.chamada ? outrasGritadas(v.chamada, null) : [];",
    para: "    const gritadas: string[] = [];",
    cmd: T_SEM_PALAVRA, caso: "recusa a chamada com palavra gritada, com o motivo" },
  { nome: "8.3: o campo sem palavra não avisa", arq: CAMPO,
    de: "    const gritadas = soAPalavra ? outrasGritadas(texto, null) : [];",
    para: "    const gritadas: string[] = [];",
    cmd: T_CAMPO, caso: "sem palavra-chave, a chamada avisa a palavra gritada" },
  // 8.4 o pedido à IA
  { nome: "8.4: o pedido sem palavra não proíbe a palavra", arq: IA,
    de: "Este post não tem palavra-chave: não peça para comentar uma palavra. ",
    para: "",
    cmd: T_IA, caso: "pede a ação e proíbe a palavra" },
  { nome: "8.4: a mensagem ignora a ação", arq: IA,
    de: "  const chamada: ChamadaDoPedido = p.palavra === null ? { acao: p.acao } : p.palavra;",
    para: "  const chamada: ChamadaDoPedido = p.palavra ?? \"PALAVRA\";",
    cmd: T_IA, caso: "a mensagem leva o pedido da ação" },
  // 8.5 os textos da página
  { nome: "8.5: o funil aparece sem palavra", arq: PUBLICAR_TEXTOS,
    de: "  if (palavra === null) return null;\n", para: "",
    cmd: T_ESTADO, caso: "sem palavra-chave, nada, nem depois de agendar ou publicar" },
  { nome: "8.5: o aviso do bônus que ganhou palavra some", arq: CARROSSEL_TEXTOS,
    de: "  if (noCarrossel === null) {\n", para: "  if (noCarrossel === null && noLabs === null) {\n",
    cmd: T_CHAMADA_TELA, caso: "feito sem palavra, e o bônus agora tem palavra no Labs" },
  { nome: "8.5: o topo sem palavra diz a palavra", arq: CARROSSEL_TEXTOS,
    de: "  if (l.palavra !== null) return `palavra ${l.palavra}`;", para: "  return `palavra ${l.palavra}`;",
    cmd: T_CHAMADA_TELA, caso: "sem palavra, a ação" },
  // 8.6 a linha, o repositório, a geração e as páginas
  { nome: "8.6: o avulso não grava a ação", arq: REPO,
    de: "  const acao = p.palavra === null ? p.acao : null;", para: "  const acao = null;",
    cmd: T_AVULSO, caso: "do texto livre e do Labs, pela IA: a palavra nula e a ação gravadas" },
  { nome: "8.6: a geração não manda a ação", arq: PROCESSO,
    de: "      chamada.palavra === null ? { total, palavra: null, acao: chamada.acao, contexto } : { total, palavra: chamada.palavra, contexto }",
    para: "      { total, palavra: chamada.palavra as string, contexto }",
    cmd: T_AVULSO, caso: "a IA recebe a ação, e a chamada sem palavra gritada fica pronta" },
  { nome: "8.6: a geração confere sem palavra como se tivesse", arq: PROCESSO,
    de: "    const falha = conferirGerado(total, chamada.palavra, r.texto);",
    para: "    const falha = conferirGerado(total, chamada.palavra ?? \"PALAVRA\", r.texto);",
    cmd: T_AVULSO, caso: "a chamada com palavra gritada falha, com a frase" },
  { nome: "8.6: o salvar de um slide confere com palavra", arq: REPO,
    de: "    const r = juntarParte(linha.total_slides, linha.palavra, atual, parte, bruto);",
    para: "    const r = juntarParte(linha.total_slides, linha.palavra ?? \"PALAVRA\", atual, parte, bruto);",
    cmd: T_AVULSO, caso: "salvar a chamada (o último slide) segue a regra sem palavra" },
  { nome: "8.6: o Gerar de novo do livre perde a ação", arq: AVULSO_PROCESSO,
    de: "  return c.palavra === null ? { palavra: null, acao: c.acao } : { palavra: c.palavra };",
    para: "  return { palavra: c.palavra ?? \"NENHUMA\" };",
    cmd: T_AVULSO_PROCESSO, caso: "o do texto livre repete a palavra nula e a ação gravadas" },
  { nome: "8.6: o topo do avulso volta a dizer a palavra", arq: PAGINA_AVULSA,
    de: "{textoDoPedidoDaChamada(carrossel)}", para: "palavra {carrossel.palavra}",
    cmd: T_PAGINAS, caso: "o topo diz a palavra ou a ação" },
  { nome: "8.6: a revisão não leva a ação ao editor", arq: REVISAO,
    de: "      acaoDaChamada={carrossel.acao_da_chamada}\n", para: "",
    cmd: T_PAGINAS, caso: "a revisão leva a ação da chamada ao editor" },
  { nome: "8.6: o editor sem palavra mostra a dica da palavra", arq: EDITOR,
    de: "        {palavra !== null ? (", para: "        {true ? (",
    cmd: T_EDITOR, caso: "sem palavra-chave, a dica diz a ação" },
  // 8.7 as duas regras do Labs
  { nome: "8.7: as duas regras trocadas de lugar", arq: PUBLICADO,
    de: '  return "item" in achado ? situacaoDoItem(achado.item) : achado;',
    para: '  return "item" in achado ? (situacaoDoItemDoAvulso(achado.item) as SituacaoNoLabs) : achado;',
    cmd: T_PUBLICADO, caso: "sem palavra-chave (chave ausente)" },
  { nome: "8.7: a regra do avulso é a do Chat", arq: PUBLICADO,
    de: '  return "item" in achado ? situacaoDoItemDoAvulso(achado.item) : achado;',
    para: '  return "item" in achado ? (situacaoDoItem(achado.item) as SituacaoDoAvulso) : achado;',
    cmd: T_PUBLICADO, caso: "sem palavra (chave ausente) e com tema, é publicado com a palavra nula" },
  { nome: "8.7: a lista de escolha usa a regra do Chat", arq: PUBLICADO,
    de: "    const s = situacaoDoItemDoAvulso(item);", para: "    const s = situacaoDoItem(item);",
    cmd: T_PUBLICADO, caso: "traz os bônus que o Chat consegue usar" },
  { nome: "8.7: o sem palavra e sem tema entra", arq: PUBLICADO,
    de: "  let palavra: string | null = null;\n  if (!ausente(item.palavraChave)) {",
    para: "  let palavra: string | null = null;\n  if (ausente(item.palavraChave) && ausente(item.tema)) return { tipo: \"publicado\", bonus: { palavra: null, titulo: \"\", descricao: \"\", tema: \"\" } };\n  if (!ausente(item.palavraChave)) {",
    cmd: T_PUBLICADO, caso: "sem palavra e sem tema, fica de fora pelo tema" },
  { nome: "8.7: a contagem não conta o sem tema", arq: PUBLICADO,
    de: "    else if (s.tipo === \"sem_tema\") deFora.semTema++;\n", para: "    else if (s.tipo === \"sem_tema\") deFora.formatoEstranho++;\n",
    cmd: T_PUBLICADO, caso: "traz os bônus que o Chat consegue usar" },
  { nome: "8.7: o quadro sem palavra diz palavra null", arq: CARROSSEL_TEXTOS,
    de: "        texto: s.bonus.palavra === null ? \"Publicado no Labs · sem palavra-chave\" : `Publicado no Labs · palavra ${s.bonus.palavra}`,",
    para: "        texto: `Publicado no Labs · palavra ${s.bonus.palavra}`,",
    cmd: T_LISTA_TEXTOS, caso: "é verde e diz que não tem palavra" },
  { nome: "8.7: a frase dos de fora sem o singular", arq: AVULSO_TEXTOS,
    de: "  return `${total === 1 ? \"1 bônus do Labs não aparece\" : `${total} bônus do Labs não aparecem`}: ${lista}.`;",
    para: "  return `${total} bônus do Labs não aparecem: ${lista}.`;",
    cmd: T_LISTA_TEXTOS, caso: "um só, no singular" },
  // 8.8 o pedido e o processo
  { nome: "8.8: a caixa não exige a ação", arq: PEDIDO,
    de: "    if (acao === null) return { ok: false, motivo: \"sem_acao\" };\n", para: "",
    cmd: T_PEDIDO, caso: "com a caixa marcada, sem uma das quatro ações" },
  { nome: "8.8: sem a caixa, a ação entra", arq: PEDIDO,
    de: "acao: palavra === null ? acao : null,", para: "acao,",
    cmd: T_PEDIDO, caso: "sem a caixa, a palavra de hoje, e a ação do formulário não entra" },
  { nome: "8.8: a caixa é ignorada", arq: PEDIDO,
    de: "  if (bruto.semPalavra === \"1\") {", para: "  if (false) {",
    cmd: T_PEDIDO, caso: "texto livre com a caixa marcada: a palavra nula e a ação" },
  { nome: "8.8: o Labs sem palavra passa sem a ação", arq: AVULSO_PROCESSO,
    de: "  return acao ? { ok: true, chamada: { palavra: null, acao }, contexto } : { ok: false, texto: semAcao };",
    para: "  return { ok: true, chamada: { palavra: null, acao: acao ?? \"salvar\" }, contexto };",
    cmd: T_AVULSO_PROCESSO, caso: "do Labs sem palavra e sem a ação, é recusado com a frase" },
  { nome: "8.8: o Labs com palavra usa a ação", arq: AVULSO_PROCESSO,
    de: "  if (s.bonus.palavra !== null) return { ok: true, chamada: { palavra: s.bonus.palavra, acao: null }, contexto };",
    para: "  if (s.bonus.palavra !== null && !acao) return { ok: true, chamada: { palavra: s.bonus.palavra, acao: null }, contexto };",
    cmd: T_AVULSO_PROCESSO, caso: "do Labs com palavra, a ação do formulário não entra" },
  { nome: "8.8: o Gerar de novo do Labs que perdeu a palavra inventa a ação", arq: AVULSO_PROCESSO,
    de: "    origem = await doLabs(linha.labs_codigo, destaque, linha.acao_da_chamada, TEXTO_LABS_PERDEU_A_PALAVRA, p.lerSituacao);",
    para: "    origem = await doLabs(linha.labs_codigo, destaque, linha.acao_da_chamada ?? \"salvar\", TEXTO_LABS_PERDEU_A_PALAVRA, p.lerSituacao);",
    cmd: T_AVULSO_PROCESSO, caso: "feito com palavra, e o Labs perdeu a palavra" },
  { nome: "8.8: as actions leem o Labs pela regra do Chat", arq: ACOES,
    de: "const lerSituacao = (codigo: string) => situacaoDoAvulsoNoLabs(process.env.LABS_URL, codigo);",
    para: "const lerSituacao = (codigo: string) => situacaoNoLabs(process.env.LABS_URL, codigo);",
    cmd: T_PAGINAS, caso: "as actions do avulso leem a caixa sem palavra" },
  { nome: "8.8: a página do avulso lê pela regra do Chat", arq: PAGINA_AVULSA,
    de: "await situacaoDoAvulsoNoLabs(process.env.LABS_URL, codigo)", para: "await situacaoNoLabs(process.env.LABS_URL, codigo)",
    cmd: T_PAGINAS, caso: "a página do avulso lê o Labs pela regra do avulso" },
  // 8.9 a tela
  { nome: "8.9: o formulário não manda a ação", arq: FORMULARIO,
    de: '<input type="radio" name="acao" value={a}', para: '<input type="radio" value={a}',
    cmd: T_NOVO, caso: "texto livre: a caixa esconde a palavra, pede a ação" },
  { nome: "8.9: o bônus do Labs sem palavra não pede a ação", arq: FORMULARIO,
    de: '  const semPalavraNoPost = origem === "livre" ? semPalavra : escolhido !== null && escolhido.palavra === null;',
    para: '  const semPalavraNoPost = origem === "livre" ? semPalavra : false;',
    cmd: T_NOVO, caso: "o bônus do Labs sem palavra aparece marcado, e pede a ação" },
  { nome: "8.9: a frase dos de fora some", arq: FORMULARIO,
    de: "              {deFora && <p className={hint}>{deFora}</p>}\n", para: "",
    cmd: T_NOVO, caso: "a frase dos bônus que ficam de fora aparece" },
  { nome: "8.9: os campos à mão sem palavra conferem como com palavra", arq: FORMULARIO,
    de: "              palavra={!c.pedePalavra ? undefined : semPalavraNoPost ? null : palavraDoPost || undefined}",
    para: "              palavra={!c.pedePalavra ? undefined : palavraDoPost || undefined}",
    cmd: T_NOVO, caso: "à mão, sem palavra: a chamada avisa a palavra gritada" },
  { nome: "8.9: a página não entrega a frase dos de fora", arq: NOVO,
    de: "          deFora={lista.ok ? textoDosBonusDeFora(lista.deFora) : null}\n", para: "",
    cmd: T_PAGINAS, caso: "a página entrega a frase dos bônus de fora ao formulário" },
  // 8.10 o publicar sem palavra
  { nome: "8.10: o publicar exige a palavra", arq: PUBLICAR_PROCESSO,
    de: "  const c = await conferirCarrossel(p.id, p.contas);\n  if (!c.ok) return c;\n  const total = c.linha.total_slides;",
    para: '  const c = await conferirCarrossel(p.id, p.contas);\n  if (!c.ok) return c;\n  if (c.linha.palavra === null) return recusa({ motivo: "quantidade", texto: "só carrossel com palavra" });\n  const total = c.linha.total_slides;',
    cmd: T_PUBLICAR, caso: "publicar o carrossel sem palavra-chave > agendado" },
];

const filtro = process.argv[2];
const escolhidas = MUTACOES.filter((x) => !filtro || x.nome.includes(filtro));
const ehInteg = (m) => m.cmd.includes("vitest.integracao.config.ts");
if (escolhidas.some(ehInteg) && !process.env.DATABASE_URL_TESTES?.trim()) {
  console.log("✗ há mutação INTEG e DATABASE_URL_TESTES está vazia: a integração iria para a produção. Nada foi mutado.");
  process.exit(1);
}
let ruins = 0;
for (const m of escolhidas) {
  const original = readFileSync(m.arq);
  const texto = original.toString("utf8");
  const crlf = texto.includes("\r\n");
  const de = crlf ? m.de.replace(/\n/g, "\r\n") : m.de;
  const para = crlf ? m.para.replace(/\n/g, "\r\n") : m.para;
  const n = texto.split(de).length - 1;
  if (n !== 1) {
    console.log(`✗ ${m.nome}: o trecho aparece ${n} vez(es)`);
    ruins++;
    continue;
  }
  writeFileSync(m.arq, texto.replace(de, () => para), "utf8");
  let saida = "";
  let caiu = false;
  try {
    saida = execSync(`${m.cmd} 2>&1`, { encoding: "utf8", stdio: "pipe", env: { ...process.env }, maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    caiu = true;
    saida = `${e.stdout ?? ""}${e.stderr ?? ""}`;
  } finally {
    writeFileSync(m.arq, original);
  }
  if (ehInteg(m) && !saida.includes("ALVO: banco de TESTE")) {
    console.log(`✗ ${m.nome}: a integração não imprimiu "ALVO: banco de TESTE". Pare e confira o banco.`);
    ruins++;
    continue;
  }
  const casoCaiu = saida.split("\n").some((l) => /FAIL|×/.test(l) && l.includes(m.caso));
  if (!(caiu && casoCaiu)) ruins++;
  console.log(`${caiu && casoCaiu ? "✓" : "✗"} ${m.nome}: o caso "${m.caso}" ${casoCaiu ? "caiu" : "NÃO caiu"}`);
}
console.log(`${escolhidas.length} mutações, ${ruins} ruins`);
process.exit(ruins ? 1 : 0);
```
