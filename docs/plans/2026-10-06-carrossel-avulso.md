# Gerador de bônus — Plano de implementação da Etapa 7: o carrossel avulso

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: `superpowers:subagent-driven-development`
> (recomendada) ou `superpowers:executing-plans`, fase por fase. Os passos usam caixa de
> seleção (`- [ ]`) para acompanhar.

**Objetivo:** o carrossel que nasce sem um bônus do Chat, de um bônus que já está no Método Labs ou de
um texto livre, pela IA ou escrito à mão, num item novo "Carrosséis" do menu, com a mesma página da
Etapa 5 (editar, foto, slide pronto, baixar, publicar e agendar).

**Arquitetura:** a migração 016 tira o `not null` de `carrosseis_gerados.bonus_id` e acrescenta a
`origem` (`bonus`, `labs`, `livre`), o `labs_codigo` e o `texto_a_mao`, amarrados por dois `check`. O
endereço de cada carrossel passa a vir da linha (`carrossel-caminho.ts`), e cada rota serve só a sua
origem. O pedido avulso é puro (`avulso-pedido.ts`); o repositório cria o avulso dentro do teto (pela
IA) ou fora dele (à mão); o processo (`avulso-processo.ts`) lê o Labs, confere o texto à mão e grava;
as actions (`app/carrosseis/actions.ts`) só conferem a sessão e leem o formulário. A arte do avulso e
a do carrossel de bônus desenham pelo mesmo módulo (`arte-rota.ts`), e a página do avulso usa a
mesma parte de dentro da página de bônus (`revisao.tsx`). O menu ganha "Carrosséis", com a lista de
todos, e o card "Publicar" ganha o aviso do funil.

**Stack:** a das etapas anteriores, no Next.js 16.3.8: App Router, Server Actions com
`useActionState`, React 19, Postgres (postgres.js via `lib/db.ts`), Vitest (três suítes), Tailwind
v4 com os tokens de `app/ui.ts`.

**Spec:** `docs/specs/2026-10-06-carrossel-avulso.md` (commits `c41fab1` e `15925d7`, liberada pela
auditoria com o achado 82 absorvido, e lida pelo Eduardo). Leia antes de começar: este plano não
repete o porquê das regras, só como construí-las.

**Ensaio do plano (06 e 07/10):** o código deste plano foi escrito e testado fase a fase numa cópia
isolada do repositório (`git worktree`, branch local `ensaio-avulso`, sem push, saída de `15925d7`), e
todo bloco de código abaixo foi tirado do git dessa cópia por um gerador, sem cópia à mão. Os números
do ensaio:
- lint e `tsc` limpos em cada fase; no fim, 103 arquivos e 3 006 casos puros (99 arquivos e 2 916 na base), 22 arquivos e 177
  de tela (21 arquivos e 166 na base);
- `next build --webpack` limpo, com `ƒ /carrosseis`, `ƒ /carrosseis/[cid]`, `ƒ /carrosseis/[cid]/arte`
  e `ƒ /carrosseis/novo` na lista, e o `AGENTS.md` intacto (o Turbopack, ver o item 9 abaixo);
- integração no container: 42 arquivos; 411 passaram, 8 pularam e 7 caíram, e caíram só os 7 de `registro-de-migracoes`, pelo item 9
  abaixo. Na árvore do projeto, a conta esperada é 42 arquivos, 418 passaram e 8 pularam (FASE 7.13);
- cada fase foi vista falhar antes do código e passar depois, na ordem deste plano, com os números de
  cada uma no passo dela;
- as 43 provas de mutação do Apêndice A derrubaram, cada uma, o caso esperado;
- o plano, aplicado do zero sobre `15925d7` numa cópia limpa, dá os 58 (22 criados e 36 mudados) arquivos iguais ao fim
  do ensaio, byte a byte;
- a guarda do diff (FASE 7.13, passo 4) saiu vazia: nada do `/publicar`, das automações, do
  `scripts/migrar.mjs` nem das dependências, e nada fora das pastas da etapa.

O ensaio achou estas coisas, já resolvidas neste plano:
1. **A 016 precisa estar na produção antes da prova no preview.** O preview usa o banco de produção, e
   o código novo lê as colunas novas (a contagem do teto, `and not texto_a_mao`, roda na página de
   todo bônus). A spec dizia que o build do merge aplica a 016; ela é aplicada à mão antes da prova,
   como a 015 na Etapa 3 (FASE 3.10), com a linha de base da auditoria antes e o OK do Eduardo, e o
   build do merge diz "Nada a aplicar". É seguro com o código de hoje no ar: ele grava sempre o
   `bonus_id`, nunca a `origem` (que nasce `'bonus'`), e lê com `select *`. A spec foi corrigida no
   mesmo dia (seção "A migração 016").
2. **A arte das duas rotas desenha por um módulo só** (`lib/bonus/arte-rota.ts`): a conta, a foto da
   conta, a foto do espaço e a versão (os achados 78, 80 e 81) moram num lugar. As guardas da rota
   (`tests/bonus-arte-paginas.test.ts`) passaram a valer para as duas rotas, e as da foto, para o
   módulo (FASE 7.9).
3. **A parte de dentro da página saiu por script, byte a byte** (`revisao.tsx`, FASE 7.10), e as três
   guardas que liam `page.tsx` passaram a ler `revisao.tsx`.
4. **O "Gerar de novo" do carrossel de bônus recusa o avulso** (manda para o `/bonus` com "não
   existe"): o avulso gera de novo pela action dele, e a do bônus não sabe ler o Labs pelo código.
5. **`lerTotalDeSlides`** saiu de `lerPedidoDeCarrossel`, para o pedido avulso usar a mesma regra do
   total (FASE 7.4).
6. **O conteúdo do texto livre é obrigatório também no "Escrever à mão"**, como a spec diz (de 20 a
   8 000 caracteres): ele fica gravado no contexto.
7. **O caminho do /automacoes no aviso do funil é um `Link`**: o lint do Next recusa `<a>` para uma
   página do app (`no-html-link-for-pages`).
8. **`avisoDoFunil` é opcional em `PublicacaoNaTela`**, para os testes de tela da Etapa 5 não mudarem.
   A lista "Carrosséis" com as três origens é provada por um teste puro (`itemDaListaDeCarrosseis`),
   porque a página é de servidor.
9. **A cópia de ensaio derruba `registro-de-migracoes`** (7 casos: o script recusa `--a-mao` sem o
   `.env.local`, que a cópia não tem, e imprime um aviso do Node sobre o `package.json` da cópia), e o
   **`next build` do `verify` (Turbopack) não roda na cópia**, que tem o `node_modules` por junção. Na
   árvore do projeto os dois rodam (FASE 7.13).
10. **O publicar do avulso ganhou um caso próprio** (FASE 7.12): a tabela de testes da spec pedia
    "publicar e agendar um avulso", e nenhuma fase o cobria. A publicação é do carrossel, pelo id,
    e não olha o bônus, então o código não muda: o caso passa direto, e a mutação que faz o publicar
    exigir o bônus o derruba.
11. **Uma integração de cada vez.** Duas rodadas ao mesmo tempo no mesmo container derrubam o schema
    uma da outra: o fim de cada rodada recolhe todo `teste_tmp_*` que achar (`rede-global.ts`). No
    ensaio, uma medição da base saiu contaminada por isso, e foi refeita sozinha.

## Restrições globais

Valem para todas as fases, sem precisar repetir em cada uma.

- **Branch:** `carrossel-avulso`, saída da `main` em `bf1bb32` (o PR #8 mergeado). Nunca commitar
  nem empurrar na `main`: ela não tem proteção e um push dispara deploy de produção. Conferir
  `git branch --show-current` antes de cada commit, e `git ls-remote origin refs/heads/main` no começo
  de cada fase.
- **`git add` com caminho explícito.** Nunca `-A` nem `.`: mais de uma sessão usa esta árvore.
- **Conventional Commits, em português.** Sem `Co-Authored-By` e sem rodapé de IA. Autor:
  Eduardo Kobal <162614913+Eduardokobal@users.noreply.github.com>.
- **Antes de cada commit**, varrer os arquivos de TEXTO tocados com
  `node "$SCRATCH/varrer-texto.mjs" <arquivos>`, em que `$SCRATCH` é o scratchpad da sessão. Se o
  scratchpad não existir mais, recrie o script a partir do apêndice A do plano da Etapa 1
  (`docs/plans/2026-09-29-gerador-de-bonus.md`).
- **O commit é um comando à parte**, depois de ler a saída dos testes: nunca encadeado com `&&` atrás
  deles (no ensaio, um commit saiu só com os testes por isso).
- **Escape de barra-u:** a ferramenta de escrita grava o caractere no lugar do escape. Os blocos
  deste plano não têm escape de barra-u; se algum aparecer, a varredura acusa.
- **Fim de linha:** com `core.autocrlf=true`, a cópia de trabalho dos arquivos que já existem está
  em CRLF. Os diffs deste plano estão em LF: aplique com `git apply --ignore-whitespace` ou à mão,
  e varra depois. Se a varredura acusar fim de linha misturado, converta a cópia inteira para LF.
- **Pastas da etapa:** `app/bonus/`, `app/carrosseis/` e `lib/bonus/`; fora delas, só
  `migrations/016-carrossel-avulso.sql`, a declaração da 016 em `lib/esquema.ts`, o item do menu em
  `app/app-shell.tsx` (uma linha e o ícone), testes e `docs/`. **Nenhum arquivo do `/publicar`, das
  automações, do `scripts/migrar.mjs` nem das dependências muda** (achado 82; a FASE 7.13 confere).
- **Sufixo de teste é o que decide se ele roda:** `tests/**/*.test.ts` (puro, entra no `verify`),
  `testes-integracao/**/*.integracao.ts` (banco, fora do `verify`), `testes-dom/**/*.dom.tsx`
  (tela, entra no `verify`).
- **Uma rodada de integração de cada vez** (item 11 do ensaio): nunca duas ao mesmo tempo no mesmo
  container.
- **A suíte de integração só roda com `DATABASE_URL_TESTES`** apontando para o container
  (`127.0.0.1:5434`, `npm run banco:teste`). Toda rodada tem de imprimir
  `[rede-global] ALVO: banco de TESTE`. Se imprimir outra coisa, pare. Nunca rode com a variável
  vazia: ela cai na `DATABASE_URL`, que é **produção**.
- **`next dev` e `next build` sem as variáveis de agente.** Rode com `env -u CLAUDECODE -u AI_AGENT ...`
  e confira `git diff AGENTS.md` depois: ele não muda.
- **Telas:** só os tokens de `app/ui.ts` e os degraus de `app/escala.ts`; nada de `indigo`,
  `violet` nem `purple`.
- **Segredo** nunca vai para código, log, mensagem, commit ou saída de terminal.
- **Escrita em produção só com o OK do Eduardo**, e o script que grava vai antes à auditoria (achado
  77). A 016 é aplicada à mão antes da prova (FASE 7.14). O preview usa o banco e o bucket de
  produção: lá, criar um carrossel, salvar, subir imagem, agendar e cancelar gravam em produção.
  Avisar o auditor com a hora antes de cada gravação.
- **Ao fechar cada fase**, avisar o auditor (sessão `metodochat-b4` em 07/10; conferir o nome no
  `ListAgents`, porque ele muda a cada reinício) com o hash e o que conferir. Não esperar a
  resposta para seguir.

## Mapa dos arquivos

| arquivo | responsabilidade | fase |
|---|---|---|
| `migrations/016-carrossel-avulso.sql`, `lib/esquema.ts` | as colunas da origem, os dois `check`, a declaração em `naoObservaveis` | 7.1 |
| `lib/bonus/carrossel-linha.ts`, `lib/bonus/carrossel-caminho.ts`; `arte-tela.ts`, `carrossel-textos.ts` e os componentes da página | a linha com a origem; o caminho de cada carrossel e a rota de cada origem | 7.2 |
| `lib/bonus/carrossel-ia-parametros.ts` | o contexto do texto livre e a mensagem dele à IA | 7.3 |
| `lib/bonus/publicado.ts`, `lib/bonus/avulso-pedido.ts`, `lib/bonus/avulso-textos.ts`, `lib/bonus/carrossel-pedido.ts` | a lista de escolha do Labs, o pedido avulso, o contexto, as frases | 7.4 |
| `lib/bonus/carrossel-repositorio.ts` | criar o avulso, o teto sem o escrito à mão, a lista de todos | 7.5 |
| `lib/bonus/avulso-processo.ts` | o pedido do avulso e o "Gerar de novo", de ponta a ponta | 7.6 |
| `app/carrosseis/actions.ts` | as duas actions, com a sessão conferida | 7.7 |
| `app/carrosseis/novo/page.tsx`, `.../formulario-do-avulso.tsx` | a tela do "Novo carrossel" | 7.8 |
| `lib/bonus/arte-rota.ts`, as duas rotas da arte | o desenho do slide comum às duas rotas; a arte do avulso | 7.9 |
| `app/bonus/[id]/carrossel/[cid]/revisao.tsx`, `app/carrosseis/[cid]/page.tsx` | a parte de dentro da página, comum; a página do avulso | 7.10 |
| `app/carrosseis/page.tsx`, `lib/bonus/carrosseis-tela.ts`, `app/app-shell.tsx`, `lib/bonus/publicar-textos.ts`, `card-publicar.tsx` | a lista "Carrosséis", o item do menu e o aviso do funil | 7.11 |
| `testes-integracao/bonus-publicar-processo.integracao.ts` | o avulso publica e agenda pelo mesmo caminho (só teste) | 7.12 |

---

## ETAPA 7 — o carrossel avulso

### FASE 7.0 — Começar da main certa

- [ ] **Passo 1: conferir a main e a branch**

```bash
git ls-remote origin refs/heads/main
git switch carrossel-avulso
git log --oneline -5
node -e 'console.log(require("./node_modules/next/package.json").version)'
```

Esperado: a `main` em `bf1bb32` (ou depois dele); a branch com os commits da spec e este plano sobre
`bf1bb32`; o `node_modules` na 16.3.8. Se a `main` andou, rebaseie a branch nela antes de seguir
(`git fetch origin main && git rebase origin/main`), e rode `npm ci` se o lock mudou.

- [ ] **Passo 2: a linha de base**

```bash
npm test
npm run test:dom
npm run banco:teste
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npm run test:integracao
```

Esperado: 99 arquivos e 2 916 casos puros; 21 arquivos e 166 de tela; `[rede-global] ALVO: banco de TESTE`,
39 arquivos, 383 passaram e 8 pularam.

---

### FASE 7.1 — A migração 016

**Arquivos:**
- Criar: `migrations/016-carrossel-avulso.sql`
- Modificar: `lib/esquema.ts` (só a declaração da 016 em `naoObservaveis`)
- Testar: `testes-integracao/bonus-carrossel-tabela.integracao.ts`, `testes-integracao/esquema-de-partida.integracao.ts` (sem mudar)

**Interfaces:**
- Produz, no banco: `carrosseis_gerados.bonus_id` nulável; `origem text not null default 'bonus'`
  (`carrosseis_gerados_origem_check`: `bonus`, `labs`, `livre`); `labs_codigo text`; `texto_a_mao
  boolean not null default false`; `carrosseis_gerados_origem_bonus_check` (`(origem = 'bonus') =
  (bonus_id is not null)`) e `carrosseis_gerados_origem_labs_check` (`(origem = 'labs') = (labs_codigo
  is not null)`). A migração é idempotente (o molde da 009).

- [ ] **Passo 1: o teste**

Em `testes-integracao/bonus-carrossel-tabela.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/bonus-carrossel-tabela.integracao.ts b/testes-integracao/bonus-carrossel-tabela.integracao.ts
index 71a8eb7..fb08106 100644
--- a/testes-integracao/bonus-carrossel-tabela.integracao.ts
+++ b/testes-integracao/bonus-carrossel-tabela.integracao.ts
@@ -5,6 +5,7 @@
 // arquivo, uma coluna apagada da migração só apareceria quando a tela quebrasse.
 import { beforeEach, describe, expect, it } from "vitest";
 import { bancoDescartavel } from "./harness";
+import { migracoesEmOrdem } from "./migracoes";
 
 const banco = bancoDescartavel();
 
@@ -25,6 +26,10 @@ const COLUNAS = [
   "revisado_em",
   // A 015 (Etapa 3): as escolhas da arte.
   "arte",
+  // A 016 (Etapa 7): o carrossel avulso.
+  "origem",
+  "labs_codigo",
+  "texto_a_mao",
 ];
 
 let bonusId: string;
@@ -59,14 +64,14 @@ describe("a tabela carrosseis_gerados", () => {
     expect(linhas.map((l) => l.column_name)).toEqual(COLUNAS);
   });
 
-  it("uma linha nova nasce pendente, sem texto, sem revisão e sem escolha de arte", async () => {
+  it("uma linha nova nasce pendente, sem texto, sem revisão, sem escolha de arte, e de bônus", async () => {
     const [linha] = (await banco
       .db()
       .sql()
       .query(
         `insert into carrosseis_gerados (bonus_id, total_slides, palavra, contexto)
          values ($1, 10, 'SUMIDO', $2::jsonb)
-         returning estado, gerado, revisado, revisado_em, contexto, arte`,
+         returning estado, gerado, revisado, revisado_em, contexto, arte, origem, labs_codigo, texto_a_mao`,
         [bonusId, { tema: "Vendas" }]
       )) as Record<string, unknown>[];
     expect(linha).toEqual({
@@ -76,6 +81,9 @@ describe("a tabela carrosseis_gerados", () => {
       revisado_em: null,
       contexto: { tema: "Vendas" },
       arte: {},
+      origem: "bonus",
+      labs_codigo: null,
+      texto_a_mao: false,
     });
   });
 
@@ -139,3 +147,77 @@ describe("a tabela carrosseis_gerados", () => {
     expect(await contar()).toBe(0);
   });
 });
+
+// O CARROSSEL AVULSO (a 016, spec da Etapa 7): sem bônus do Chat, de um bônus do Labs ou de um texto
+// livre. A origem amarra as colunas, e é o banco que recusa a combinação errada.
+describe("a 016: o carrossel avulso", () => {
+  const inserir = (colunas: string, valores: string, params: unknown[] = []) =>
+    banco
+      .db()
+      .sql()
+      .query(
+        `insert into carrosseis_gerados (total_slides, palavra, contexto, ${colunas}) values (5, 'BRUTAL', '{}'::jsonb, ${valores}) returning id`,
+        params
+      );
+
+  it("o avulso do Labs entra sem bônus e com o código, e o do texto livre sem nenhum dos dois", async () => {
+    await inserir("origem, labs_codigo", "'labs', 'conselheiro-brutalmente-honesto'");
+    await inserir("origem", "'livre'");
+    await inserir("origem, texto_a_mao", "'livre', true");
+    expect(await contar()).toBe(3);
+  });
+
+  it("o banco recusa origem fora da lista", async () => {
+    await expect(inserir("origem", "'notion'")).rejects.toThrow(/carrosseis_gerados_origem_check/);
+  });
+
+  it.each([
+    ["a origem 'bonus' sem bônus", "origem", "'bonus'", false],
+    ["o texto livre com bônus", "origem, bonus_id", "'livre', $1", true],
+    ["o avulso do Labs com bônus", "origem, labs_codigo, bonus_id", "'labs', 'x', $1", true],
+  ])("o banco recusa %s", async (_nome, colunas, valores, comBonus) => {
+    await expect(inserir(colunas, valores, comBonus ? [bonusId] : [])).rejects.toThrow(/carrosseis_gerados_origem_bonus_check/);
+  });
+
+  it.each([
+    ["o avulso do Labs sem código", "origem", "'labs'", false],
+    ["o texto livre com código", "origem, labs_codigo", "'livre', 'x'", false],
+    ["o carrossel de bônus com código", "bonus_id, labs_codigo", "$1, 'x'", true],
+  ])("o banco recusa %s", async (_nome, colunas, valores, comBonus) => {
+    await expect(inserir(colunas, valores, comBonus ? [bonusId] : [])).rejects.toThrow(/carrosseis_gerados_origem_labs_check/);
+  });
+
+  // AS LINHAS QUE JÁ EXISTIAM: o banco descartável nasce da pasta inteira, então o caso desfaz a 016,
+  // grava uma linha como as de produção hoje, e aplica a 016 de novo, duas vezes (ela é idempotente,
+  // como toda migração da pasta). A linha velha fica de bônus, sem código e fora do "à mão".
+  it("aplicada sobre as linhas que já existiam, todas ficam 'bonus', e ela roda duas vezes", async () => {
+    const m016 = migracoesEmOrdem().find((m) => m.nome === "016-carrossel-avulso.sql");
+    expect(m016).toBeDefined();
+    const sql = banco.db().sql();
+    try {
+      await sql.query(
+        `alter table carrosseis_gerados
+           drop constraint carrosseis_gerados_origem_labs_check,
+           drop constraint carrosseis_gerados_origem_bonus_check,
+           drop constraint carrosseis_gerados_origem_check,
+           drop column texto_a_mao,
+           drop column labs_codigo,
+           drop column origem,
+           alter column bonus_id set not null`
+      );
+      const [velha] = (await sql.query(
+        `insert into carrosseis_gerados (bonus_id, total_slides, palavra, contexto, estado) values ($1, 4, 'SUMIDO', '{}'::jsonb, 'pronto') returning id`,
+        [bonusId]
+      )) as { id: string }[];
+      await sql.query(m016!.comandos);
+      await sql.query(m016!.comandos);
+      const [lida] = (await sql.query(`select origem, labs_codigo, texto_a_mao, estado from carrosseis_gerados where id = $1`, [
+        velha.id,
+      ])) as Record<string, unknown>[];
+      expect(lida).toEqual({ origem: "bonus", labs_codigo: null, texto_a_mao: false, estado: "pronto" });
+    } finally {
+      // Se algo cair no meio, a tabela volta à forma da pasta para o arquivo seguinte.
+      await sql.query(m016!.comandos);
+    }
+  });
+});
```

- [ ] **Passo 2: ver falhar**

```bash
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-carrossel-tabela.integracao.ts testes-integracao/esquema-de-partida.integracao.ts
```

Esperado: `[rede-global] ALVO: banco de TESTE`; na tabela, 11 caem e 6 passam (17): as colunas novas e os `check` não existem; a partida passa (6), porque a 016 ainda não existe.

- [ ] **Passo 3: o código**

Crie `migrations/016-carrossel-avulso.sql`:

```sql
-- O CARROSSEL AVULSO (Etapa 7 do gerador de bônus): o carrossel que nasce sem um bônus do Chat,
-- de um bônus que já está no Método Labs ou de um texto livre. O desenho inteiro está em
-- docs/specs/2026-10-06-carrossel-avulso.md.
--
-- `origem` diz de onde o carrossel veio: 'bonus' (o bônus do Chat, `bonus_id`), 'labs' (o bônus
-- do Labs, pelo código dele, `labs_codigo`) ou 'livre'. Os dois `check` de baixo amarram as
-- colunas à origem: o banco recusa um avulso com bônus, ou um carrossel de bônus sem ele.
-- `texto_a_mao` marca o carrossel escrito pelo operador, que não gasta IA e não conta no teto.
--
-- COLUNAS DE FEATURE, como a 014 e a 015: entram em `naoObservaveis` de lib/esquema.ts, e quem
-- confere é testes-integracao/bonus-carrossel-tabela.integracao.ts. O scripts/migrar.mjs não
-- muda (achado 82 da auditoria): ele só aplica este arquivo, como aplicou os do bônus antes.
--
-- SEGURA NA JANELA DO DEPLOY: o código antigo grava sempre o `bonus_id` e nunca a `origem`, que
-- nasce 'bonus' pelo padrão, e lê com `select *`, que ignora coluna nova. As linhas que já existem
-- ganham 'bonus', `labs_codigo` nulo e `texto_a_mao` falso, e passam nos três `check`.
--
-- IDEMPOTENTE, como toda migração desta pasta: `add column if not exists`, e cada `check` é
-- derrubado se existir e criado de novo (o molde da 009).
alter table carrosseis_gerados alter column bonus_id drop not null;

alter table carrosseis_gerados add column if not exists origem text not null default 'bonus';
alter table carrosseis_gerados add column if not exists labs_codigo text;
alter table carrosseis_gerados add column if not exists texto_a_mao boolean not null default false;

alter table carrosseis_gerados drop constraint if exists carrosseis_gerados_origem_check;
alter table carrosseis_gerados add constraint carrosseis_gerados_origem_check
  check (origem in ('bonus', 'labs', 'livre'));

alter table carrosseis_gerados drop constraint if exists carrosseis_gerados_origem_bonus_check;
alter table carrosseis_gerados add constraint carrosseis_gerados_origem_bonus_check
  check ((origem = 'bonus') = (bonus_id is not null));

alter table carrosseis_gerados drop constraint if exists carrosseis_gerados_origem_labs_check;
alter table carrosseis_gerados add constraint carrosseis_gerados_origem_labs_check
  check ((origem = 'labs') = (labs_codigo is not null));
```

Em `lib/esquema.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/esquema.ts b/lib/esquema.ts
index 2910b55..4c3e3b2 100644
--- a/lib/esquema.ts
+++ b/lib/esquema.ts
@@ -233,6 +233,16 @@ const MARCA_DAGUA = {
       porque:
         "coluna de FEATURE (carrosseis_gerados.arte): a partida do painel não depende dela, de propósito",
     },
+    {
+      de: "016-carrossel-avulso.sql",
+      // AS COLUNAS DO CARROSSEL AVULSO (`origem`, `labs_codigo`, `texto_a_mao`) na mesma tabela de
+      // feature, pelo mesmo motivo da 014 e da 015: só o gerador (app/bonus/ e app/carrosseis/) as
+      // lê, e elas não podem impedir o painel inteiro de subir. Quem confere é
+      // testes-integracao/bonus-carrossel-tabela.integracao.ts. Decidido pelo Eduardo em
+      // 06/10/2026 (docs/specs/2026-10-06-carrossel-avulso.md).
+      porque:
+        "colunas de FEATURE (carrosseis_gerados.origem, labs_codigo e texto_a_mao): a partida do painel não depende delas, de propósito",
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

Esperado: `tsc` limpo; `[rede-global] ALVO: banco de TESTE`, e os 23 passam (17 da tabela e 6 da partida). Sem a declaração em
`lib/esquema.ts`, cai o caso "a MARCA D'ÁGUA cobre a pasta inteira" de `esquema-de-partida`.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" migrations/016-carrossel-avulso.sql lib/esquema.ts testes-integracao/bonus-carrossel-tabela.integracao.ts
test "$(git branch --show-current)" = "carrossel-avulso"
git add migrations/016-carrossel-avulso.sql lib/esquema.ts testes-integracao/bonus-carrossel-tabela.integracao.ts
git commit -m "feat(bonus): a migração 016, o carrossel avulso na tabela dos carrosséis"
```

---

### FASE 7.2 — O endereço de cada carrossel vem da linha, e cada rota serve só a sua origem

**Arquivos:**
- Criar: `lib/bonus/carrossel-caminho.ts`
- Modificar: `lib/bonus/carrossel-linha.ts`, `lib/bonus/arte-tela.ts`, `lib/bonus/carrossel-textos.ts`,
  `app/bonus/carrossel-actions.ts`, e em `app/bonus/[id]/carrossel/[cid]/`: `page.tsx`,
  `arte/route.tsx`, `card-da-parte.tsx`, `editor-do-carrossel.tsx`, `card-publicar.tsx`,
  `imagem-no-navegador.ts`
- Testar: `tests/bonus-carrossel-caminho.test.ts`, `tests/bonus-arte-tela.test.ts`,
  `tests/bonus-carrossel-textos.test.ts`, `tests/bonus-carrossel-tela.test.ts`, e os cinco testes de
  tela da página (`testes-dom/bonus-card-da-parte.dom.tsx`, `bonus-card-publicar.dom.tsx`,
  `bonus-editor-do-carrossel.dom.tsx`, `bonus-imagem-no-card.dom.tsx`, `bonus-publicar-imagem.dom.tsx`)

**Interfaces:**
- Produz, de `carrossel-linha.ts`: `type OrigemDoCarrossel = "bonus" | "labs" | "livre"`; em
  `LinhaDoCarrossel`, `bonus_id: string | null`, `origem`, `labs_codigo: string | null` e
  `texto_a_mao: boolean`.
- Produz, de `carrossel-caminho.ts`: `type RotaDoCarrossel = { tipo: "bonus"; bonusId } | { tipo:
  "avulso" }`; `caminhoDoCarrossel(l)` (`/bonus/<bonus_id>/carrossel/<id>` ou `/carrosseis/<id>`);
  `ehDaRota(l, rota): boolean`.
- Muda: `urlDaArte(caminho, numero, versao, baixar?)`; `urlDoCarrosselComAviso(caminho, aviso)`;
  `conferirPedidoDaArte(linha, rota, slide)`; os componentes `CardDaParte`, `EditorDoCarrossel` e
  `CardPublicar`, e `prepararArtes`/`publicarDaTela`, recebem `caminho` no lugar do `bonusId`. O
  "Gerar de novo" do carrossel de bônus recusa o avulso (item 4 do ensaio).

- [ ] **Passo 1: os testes**

Crie `tests/bonus-carrossel-caminho.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { caminhoDoCarrossel, ehDaRota, type RotaDoCarrossel } from "@/lib/bonus/carrossel-caminho";
import type { OrigemDoCarrossel } from "@/lib/bonus/carrossel-linha";

// O ENDEREÇO DE CADA CARROSSEL VEM DA LINHA (spec da Etapa 7, "As rotas"): o carrossel de bônus mora
// na página de hoje, e o avulso, em /carrosseis. Cada rota serve só a sua origem.

const BONUS = "0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f";
const OUTRO_BONUS = "9f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f";
const CARROSSEL = "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d";

const linha = (origem: OrigemDoCarrossel, bonus_id: string | null = null) => ({ id: CARROSSEL, origem, bonus_id });

describe("o caminho da página do carrossel", () => {
  it("o de bônus mora embaixo do bônus, como hoje", () => {
    expect(caminhoDoCarrossel(linha("bonus", BONUS))).toBe(`/bonus/${BONUS}/carrossel/${CARROSSEL}`);
  });

  it.each(["labs", "livre"] as const)("o avulso (%s) mora em /carrosseis", (origem) => {
    expect(caminhoDoCarrossel(linha(origem))).toBe(`/carrosseis/${CARROSSEL}`);
  });
});

describe("cada rota serve só a sua origem", () => {
  const DO_BONUS: RotaDoCarrossel = { tipo: "bonus", bonusId: BONUS };
  const AVULSA: RotaDoCarrossel = { tipo: "avulso" };

  it("a rota do bônus serve o carrossel daquele bônus", () => {
    expect(ehDaRota(linha("bonus", BONUS), DO_BONUS)).toBe(true);
  });

  it("a rota do bônus recusa o carrossel de outro bônus e o avulso", () => {
    expect(ehDaRota(linha("bonus", OUTRO_BONUS), DO_BONUS)).toBe(false);
    expect(ehDaRota(linha("labs"), DO_BONUS)).toBe(false);
    expect(ehDaRota(linha("livre"), DO_BONUS)).toBe(false);
  });

  it("a rota dos avulsos serve os dois avulsos, e recusa o de bônus", () => {
    expect(ehDaRota(linha("labs"), AVULSA)).toBe(true);
    expect(ehDaRota(linha("livre"), AVULSA)).toBe(true);
    expect(ehDaRota(linha("bonus", BONUS), AVULSA)).toBe(false);
  });
});
```

Em `tests/bonus-arte-tela.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-arte-tela.test.ts b/tests/bonus-arte-tela.test.ts
index 849fc3c..f8c06e5 100644
--- a/tests/bonus-arte-tela.test.ts
+++ b/tests/bonus-arte-tela.test.ts
@@ -21,6 +21,7 @@ import type { TextoDeCarrossel } from "@/lib/bonus/carrossel-texto";
 
 const BONUS = "0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f";
 const CARROSSEL = "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d";
+const CAMINHO = `/bonus/${BONUS}/carrossel/${CARROSSEL}`;
 
 describe("o número do slide pedido", () => {
   it.each([
@@ -106,11 +107,10 @@ describe("a versão da prévia", () => {
     expect(v).toMatch(/^[0-9a-f]{8}$/);
   });
 
-  it("o endereço da miniatura e o do baixar", () => {
-    expect(urlDaArte(BONUS, CARROSSEL, 2, "abcd1234")).toBe(`/bonus/${BONUS}/carrossel/${CARROSSEL}/arte?slide=2&v=abcd1234`);
-    expect(urlDaArte(BONUS, CARROSSEL, 2, "abcd1234", true)).toBe(
-      `/bonus/${BONUS}/carrossel/${CARROSSEL}/arte?slide=2&v=abcd1234&baixar=1`
-    );
+  it("o endereço da miniatura e o do baixar, a partir do caminho da página", () => {
+    expect(urlDaArte(CAMINHO, 2, "abcd1234")).toBe(`/bonus/${BONUS}/carrossel/${CARROSSEL}/arte?slide=2&v=abcd1234`);
+    expect(urlDaArte(CAMINHO, 2, "abcd1234", true)).toBe(`/bonus/${BONUS}/carrossel/${CARROSSEL}/arte?slide=2&v=abcd1234&baixar=1`);
+    expect(urlDaArte(`/carrosseis/${CARROSSEL}`, 3, "abcd1234")).toBe(`/carrosseis/${CARROSSEL}/arte?slide=3&v=abcd1234`);
   });
 });
 
@@ -206,28 +206,42 @@ describe("o que a rota confere antes de desenhar", () => {
     gerado_em: new Date(0),
     revisado_em: null,
     arte: {},
+    origem: "bonus",
+    labs_codigo: null,
+    texto_a_mao: false,
     ...troca,
   });
+  const DO_BONUS = { tipo: "bonus" as const, bonusId: BONUS };
+  const AVULSA = { tipo: "avulso" as const };
 
   it("o carrossel pronto e o slide que existe: os slides e o número", () => {
-    const r = conferirPedidoDaArte(linha(), BONUS, "2");
+    const r = conferirPedidoDaArte(linha(), DO_BONUS, "2");
     expect(r.ok && [r.numero, r.slides.length, r.slides[1].titulo]).toEqual([2, 3, "O que fazer primeiro"]);
   });
 
   it("o revisado vale sobre o gerado", () => {
     const revisado = { ...TEXTO, gancho: "O gancho revisado pelo operador." };
-    const r = conferirPedidoDaArte(linha({ revisado }), BONUS, "1");
+    const r = conferirPedidoDaArte(linha({ revisado }), DO_BONUS, "1");
     expect(r.ok && r.slides[0].texto).toBe("O gancho revisado pelo operador.");
   });
 
+  it("a rota dos avulsos desenha o avulso do Labs e o do texto livre", () => {
+    const doLabs = linha({ origem: "labs", bonus_id: null, labs_codigo: "conselheiro-brutalmente-honesto" });
+    const livre = linha({ origem: "livre", bonus_id: null });
+    expect(conferirPedidoDaArte(doLabs, AVULSA, "1").ok).toBe(true);
+    expect(conferirPedidoDaArte(livre, AVULSA, "3").ok).toBe(true);
+  });
+
   it.each([
-    ["o carrossel que não existe", null as LinhaDoCarrossel | null, BONUS, "1", 404, TEXTO_ARTE_NAO_ENCONTRADA],
-    ["o carrossel de outro bônus", linha({ bonus_id: "9f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f" }), BONUS, "1", 404, TEXTO_ARTE_NAO_ENCONTRADA],
-    ["o carrossel ainda gerando", linha({ estado: "gerando", gerado: null }), BONUS, "1", 409, TEXTO_ARTE_NAO_PRONTA],
-    ["o pronto com texto de forma errada", linha({ gerado: { tipo: "carrossel" } }), BONUS, "1", 409, TEXTO_ARTE_NAO_PRONTA],
-    ["o slide além do total", linha(), BONUS, "4", 400, TEXTO_ARTE_SLIDE_INVALIDO],
-    ["o slide que não é número", linha(), BONUS, "x", 400, TEXTO_ARTE_SLIDE_INVALIDO],
-  ])("recusa %s", (_nome, l, bonus, slide, status, texto) => {
-    expect(conferirPedidoDaArte(l, bonus, slide)).toEqual({ ok: false, status, texto });
+    ["o carrossel que não existe", null as LinhaDoCarrossel | null, DO_BONUS, "1", 404, TEXTO_ARTE_NAO_ENCONTRADA],
+    ["o carrossel de outro bônus", linha({ bonus_id: "9f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f" }), DO_BONUS, "1", 404, TEXTO_ARTE_NAO_ENCONTRADA],
+    ["o avulso na rota do bônus", linha({ origem: "livre", bonus_id: null }), DO_BONUS, "1", 404, TEXTO_ARTE_NAO_ENCONTRADA],
+    ["o de bônus na rota dos avulsos", linha(), AVULSA, "1", 404, TEXTO_ARTE_NAO_ENCONTRADA],
+    ["o carrossel ainda gerando", linha({ estado: "gerando", gerado: null }), DO_BONUS, "1", 409, TEXTO_ARTE_NAO_PRONTA],
+    ["o pronto com texto de forma errada", linha({ gerado: { tipo: "carrossel" } }), DO_BONUS, "1", 409, TEXTO_ARTE_NAO_PRONTA],
+    ["o slide além do total", linha(), DO_BONUS, "4", 400, TEXTO_ARTE_SLIDE_INVALIDO],
+    ["o slide que não é número", linha(), DO_BONUS, "x", 400, TEXTO_ARTE_SLIDE_INVALIDO],
+  ])("recusa %s", (_nome, l, rota, slide, status, texto) => {
+    expect(conferirPedidoDaArte(l, rota, slide)).toEqual({ ok: false, status, texto });
   });
 });
```

Em `tests/bonus-carrossel-textos.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-carrossel-textos.test.ts b/tests/bonus-carrossel-textos.test.ts
index 67f98f8..9cf7063 100644
--- a/tests/bonus-carrossel-textos.test.ts
+++ b/tests/bonus-carrossel-textos.test.ts
@@ -17,10 +17,13 @@ const BONUS = "0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f";
 const CARROSSEL = "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d";
 
 describe("as frases do carrossel", () => {
-  it("a URL de volta leva texto E tom", () => {
-    expect(urlDoCarrosselComAviso(BONUS, CARROSSEL, { tom: "ok", texto: "salvo & pronto" })).toBe(
+  it("a URL de volta leva texto E tom, no caminho da página do carrossel", () => {
+    expect(urlDoCarrosselComAviso(`/bonus/${BONUS}/carrossel/${CARROSSEL}`, { tom: "ok", texto: "salvo & pronto" })).toBe(
       `/bonus/${BONUS}/carrossel/${CARROSSEL}?aviso=salvo%20%26%20pronto&tom=ok`
     );
+    expect(urlDoCarrosselComAviso(`/carrosseis/${CARROSSEL}`, { tom: "erro", texto: "não deu" })).toBe(
+      `/carrosseis/${CARROSSEL}?aviso=n%C3%A3o%20deu&tom=erro`
+    );
   });
 
   it("cada situação no Labs tem frase, e só a publicada é verde e diz a palavra", () => {
```

Em `tests/bonus-carrossel-tela.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-carrossel-tela.test.ts b/tests/bonus-carrossel-tela.test.ts
index 64f1948..1a3b227 100644
--- a/tests/bonus-carrossel-tela.test.ts
+++ b/tests/bonus-carrossel-tela.test.ts
@@ -29,6 +29,9 @@ function linha(troca: Partial<LinhaDoCarrossel>): LinhaDoCarrossel {
     gerado_em: new Date(T0),
     revisado_em: null,
     arte: {},
+    origem: "bonus",
+    labs_codigo: null,
+    texto_a_mao: false,
     ...troca,
   };
 }
```

Em `testes-dom/bonus-card-da-parte.dom.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-dom/bonus-card-da-parte.dom.tsx b/testes-dom/bonus-card-da-parte.dom.tsx
index 47df597..564a5a4 100644
--- a/testes-dom/bonus-card-da-parte.dom.tsx
+++ b/testes-dom/bonus-card-da-parte.dom.tsx
@@ -14,6 +14,7 @@ import type { AvisoDoSlide } from "@/lib/bonus/carrossel-textos";
 
 const BONUS = "0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f";
 const CARROSSEL = "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d";
+const CAMINHO = `/bonus/${BONUS}/carrossel/${CARROSSEL}`;
 const VALORES = {
   gancho: "Seu cliente sumiu? Não é culpa dele.",
   slide_1_titulo: "O que fazer primeiro",
@@ -32,7 +33,7 @@ function Card({ acao, parte, soTextoInicial = false }: { acao: (a: AvisoDoSlide
   return (
     <CardDaParte
       acao={acao}
-      bonusId={BONUS}
+      caminho={CAMINHO}
       carrosselId={CARROSSEL}
       palavra="SUMIDO"
       total={3}
@@ -74,9 +75,9 @@ async function salvar(nome = "Salvar slide 2") {
 describe("o card de um slide", () => {
   it("mostra a miniatura pela rota da arte, com a versão, e o baixar do slide", () => {
     renderizar([]);
-    expect(miniatura().getAttribute("src")).toBe(urlDaArte(BONUS, CARROSSEL, 2, "v1"));
+    expect(miniatura().getAttribute("src")).toBe(urlDaArte(CAMINHO, 2, "v1"));
     const baixar = screen.getByRole("link", { name: "Baixar o slide 2" });
-    expect(baixar.getAttribute("href")).toBe(urlDaArte(BONUS, CARROSSEL, 2, "v1", true));
+    expect(baixar.getAttribute("href")).toBe(urlDaArte(CAMINHO, 2, "v1", true));
     expect(baixar.hasAttribute("download")).toBe(true);
   });
 
@@ -104,7 +105,7 @@ describe("o card de um slide", () => {
     editar();
     fireEvent.change(texto(), { target: { value: "Um texto revisado do slide dois, mais curto." } });
     await salvar();
-    expect(miniatura().getAttribute("src")).toBe(urlDaArte(BONUS, CARROSSEL, 2, "v2"));
+    expect(miniatura().getAttribute("src")).toBe(urlDaArte(CAMINHO, 2, "v2"));
     expect(texto().value).toBe("Um texto revisado do slide dois, mais curto.");
     expect(screen.getByRole("status").textContent).toBe("Slide 2 salvo.");
   });
@@ -116,7 +117,7 @@ describe("o card de um slide", () => {
     await salvar();
     expect(texto().value).toBe("curto");
     expect(screen.getByRole("status").textContent).toMatch(/precisa de pelo menos 30/);
-    expect(miniatura().getAttribute("src")).toBe(urlDaArte(BONUS, CARROSSEL, 2, "v1"));
+    expect(miniatura().getAttribute("src")).toBe(urlDaArte(CAMINHO, 2, "v1"));
   });
 
   it("não salvo aparece ao editar, some ao salvar, e fica na recusa", async () => {
```

Em `testes-dom/bonus-card-publicar.dom.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-dom/bonus-card-publicar.dom.tsx b/testes-dom/bonus-card-publicar.dom.tsx
index 9c02fc3..79eea56 100644
--- a/testes-dom/bonus-card-publicar.dom.tsx
+++ b/testes-dom/bonus-card-publicar.dom.tsx
@@ -15,6 +15,7 @@ vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
 
 const BONUS = "0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f";
 const CARROSSEL = "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d";
+const CAMINHO = `/bonus/${BONUS}/carrossel/${CARROSSEL}`;
 const TODAS = {
   1: { url: "u1", versao: "t1", jeito: "slide" as const },
   2: { url: "u2", versao: "t2", jeito: "slide" as const },
@@ -56,7 +57,7 @@ function renderizar(p: Partial<PublicacaoNaTela> = {}, extra: { naoSalvos?: numb
   render(
     <CardPublicar
       publicacao={completa}
-      bonusId={BONUS}
+      caminho={CAMINHO}
       carrosselId={CARROSSEL}
       total={3}
       soTexto={[]}
@@ -147,7 +148,7 @@ describe("o não salvo, pelo editor", () => {
         acaoDoSlide={async () => ({ tom: "ok", texto: "Slide 2 salvo.", em: 1, versao: "b2", versaoDoTexto: "t2" })}
         acaoDaArte={async () => null}
         acaoDaConta={async () => null}
-        bonusId={BONUS}
+        caminho={CAMINHO}
         carrosselId={CARROSSEL}
         palavra="SUMIDO"
         total={3}
@@ -221,7 +222,7 @@ describe("as artes que vão com o pedido", () => {
     render(
       <CardPublicar
         publicacao={completa}
-        bonusId={BONUS}
+        caminho={CAMINHO}
         carrosselId={CARROSSEL}
         total={3}
         soTexto={[3]}
@@ -274,7 +275,7 @@ describe("as artes que vão com o pedido", () => {
         acaoDoSlide={async () => ({ tom: "ok", texto: "Slide 1 salvo.", em: 1, versao: "a2", versaoDoTexto: "t1-novo" })}
         acaoDaArte={async () => null}
         acaoDaConta={async () => null}
-        bonusId={BONUS}
+        caminho={CAMINHO}
         carrosselId={CARROSSEL}
         palavra="SUMIDO"
         total={3}
```

Em `testes-dom/bonus-editor-do-carrossel.dom.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-dom/bonus-editor-do-carrossel.dom.tsx b/testes-dom/bonus-editor-do-carrossel.dom.tsx
index 572d40e..05a078a 100644
--- a/testes-dom/bonus-editor-do-carrossel.dom.tsx
+++ b/testes-dom/bonus-editor-do-carrossel.dom.tsx
@@ -13,6 +13,7 @@ import type { AvisoDoSlide } from "@/lib/bonus/carrossel-textos";
 
 const BONUS = "0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f";
 const CARROSSEL = "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d";
+const CAMINHO = `/bonus/${BONUS}/carrossel/${CARROSSEL}`;
 const VALORES = {
   gancho: "Seu cliente sumiu? Não é culpa dele.",
   slide_1_titulo: "O que fazer primeiro",
@@ -47,7 +48,7 @@ function renderizar({
         recebidos.conta.push(f);
         return conta.shift() ?? null;
       }}
-      bonusId={BONUS}
+      caminho={CAMINHO}
       carrosselId={CARROSSEL}
       palavra="SUMIDO"
       total={3}
@@ -73,7 +74,7 @@ describe("o editor do carrossel, slide a slide", () => {
     renderizar();
     expect(cards().map((c) => within(c).getByRole("heading").textContent)).toEqual(["Slide 1", "Slide 2", "Slide 3", "Legenda"]);
     expect([1, 2, 3].map((n) => miniatura(n).getAttribute("src"))).toEqual(
-      ["a1", "b1", "c1"].map((v, i) => urlDaArte(BONUS, CARROSSEL, i + 1, v))
+      ["a1", "b1", "c1"].map((v, i) => urlDaArte(CAMINHO, i + 1, v))
     );
   });
 
@@ -90,7 +91,7 @@ describe("o editor do carrossel, slide a slide", () => {
       fireEvent.click(screen.getByRole("button", { name: "Salvar slide 2" }));
     });
     expect([1, 2, 3].map((n) => miniatura(n).getAttribute("src"))).toEqual(
-      ["a1", "b2", "c1"].map((v, i) => urlDaArte(BONUS, CARROSSEL, i + 1, v))
+      ["a1", "b2", "c1"].map((v, i) => urlDaArte(CAMINHO, i + 1, v))
     );
   });
 
@@ -101,7 +102,7 @@ describe("o editor do carrossel, slide a slide", () => {
     });
     expect(recebidos.arte.map((f) => [f.get("id"), f.getAll("so_texto"), f.get("conta")])).toEqual([[CARROSSEL, ["2"], null]]);
     expect(soTexto(2).checked).toBe(true);
-    expect(miniatura(2).getAttribute("src")).toBe(urlDaArte(BONUS, CARROSSEL, 2, "b3"));
+    expect(miniatura(2).getAttribute("src")).toBe(urlDaArte(CAMINHO, 2, "b3"));
   });
 
   // A miniatura e o "Baixar" seguem o que está gravado. A caixa e o "não cabe" seguem a tela, e não
@@ -152,6 +153,6 @@ describe("o editor do carrossel, slide a slide", () => {
       fireEvent.click(screen.getByRole("button", { name: "Baixar todos" }));
     });
     await waitFor(() => expect(baixados).toHaveLength(3));
-    expect(baixados).toEqual(["a1", "b1", "c1"].map((v, i) => `${urlDaArte(BONUS, CARROSSEL, i + 1, v, true)}|true`));
+    expect(baixados).toEqual(["a1", "b1", "c1"].map((v, i) => `${urlDaArte(CAMINHO, i + 1, v, true)}|true`));
   });
 });
```

Em `testes-dom/bonus-imagem-no-card.dom.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-dom/bonus-imagem-no-card.dom.tsx b/testes-dom/bonus-imagem-no-card.dom.tsx
index 68754bf..1374645 100644
--- a/testes-dom/bonus-imagem-no-card.dom.tsx
+++ b/testes-dom/bonus-imagem-no-card.dom.tsx
@@ -17,6 +17,7 @@ vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
 
 const BONUS = "0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f";
 const CARROSSEL = "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d";
+const CAMINHO = `/bonus/${BONUS}/carrossel/${CARROSSEL}`;
 const VALORES = {
   gancho: "Seu cliente sumiu? Não é culpa dele.",
   slide_1_titulo: "O que fazer primeiro",
@@ -97,7 +98,7 @@ function renderizar({
       acaoDoSlide={async () => slide.shift() ?? null}
       acaoDaArte={async () => null}
       acaoDaConta={async () => null}
-      bonusId={BONUS}
+      caminho={CAMINHO}
       carrosselId={CARROSSEL}
       palavra="SUMIDO"
       total={3}
@@ -129,10 +130,10 @@ describe("a imagem no card", () => {
     expect(within(card(3)).getByText("Subir foto")).toBeTruthy();
     expect(within(card(3)).getByText("Trocar slide pronto")).toBeTruthy();
     expect(miniatura(3).getAttribute("src")).toBe(IMAGEM);
-    expect(miniatura(2).getAttribute("src")).toBe(urlDaArte(BONUS, CARROSSEL, 2, "b1"));
+    expect(miniatura(2).getAttribute("src")).toBe(urlDaArte(CAMINHO, 2, "b1"));
     expect(screen.queryByLabelText("Slide 1: foto para o espaço da arte")).toBeNull();
     expect(screen.queryByLabelText("Slide 1: slide pronto do Canva")).toBeNull();
-    expect(miniatura(1).getAttribute("src")).toBe(urlDaArte(BONUS, CARROSSEL, 1, "a1"));
+    expect(miniatura(1).getAttribute("src")).toBe(urlDaArte(CAMINHO, 1, "a1"));
   });
 
   // A miniatura do slide com foto é a própria arte da rota, com a foto no espaço, e não a foto do bucket.
@@ -140,7 +141,7 @@ describe("a imagem no card", () => {
     renderizar({ publicacao: { imagens: { 2: { url: FOTO, versao: "t2", jeito: "foto" } } } });
     expect(within(card(2)).getByText("Trocar foto")).toBeTruthy();
     expect(within(card(2)).getByText("Slide pronto do Canva")).toBeTruthy();
-    expect(miniatura(2).getAttribute("src")).toBe(urlDaArte(BONUS, CARROSSEL, 2, "b1"));
+    expect(miniatura(2).getAttribute("src")).toBe(urlDaArte(CAMINHO, 2, "b1"));
   });
 
   // Pedido do Eduardo na prova (05/10): o upload ao lado do "Baixar", na mesma linha. Com os dois
@@ -185,7 +186,7 @@ describe("a imagem no card", () => {
       { id: CARROSSEL, numero: 2, destino: "foto", arquivo: { nome: "foto-2.jpg", mime: "image/jpeg", bytes: 4, largura: 1720, altura: 1146 } },
     ]);
     expect(recebidos.guardar).toEqual([{ id: CARROSSEL, numero: 2, caminho: "178/bonus-foto/nova.jpg" }]);
-    expect(miniatura(2).getAttribute("src")).toBe(urlDaArte(BONUS, CARROSSEL, 2, "b2-foto"));
+    expect(miniatura(2).getAttribute("src")).toBe(urlDaArte(CAMINHO, 2, "b2-foto"));
     expect(within(card(2)).getByText("Trocar foto")).toBeTruthy();
     expect(within(card(2)).getByText("Slide pronto do Canva")).toBeTruthy();
   });
@@ -209,7 +210,7 @@ describe("a imagem no card", () => {
     });
     expect(recebidos.assinar).toEqual([]);
     expect(within(card(2)).getByText("A imagem do slide tem de ser 4:5, como a arte (1080×1350).")).toBeTruthy();
-    expect(miniatura(2).getAttribute("src")).toBe(urlDaArte(BONUS, CARROSSEL, 2, "b1"));
+    expect(miniatura(2).getAttribute("src")).toBe(urlDaArte(CAMINHO, 2, "b1"));
   });
 
   it("a foto pequena é recusada no card, sem pedir assinatura", async () => {
@@ -254,7 +255,7 @@ describe("a imagem no card", () => {
     renderizar({ publicacao: { imagens: { 2: { url: IMAGEM, versao: "t2", jeito: "slide" } } }, soTexto: [2] });
     expect(screen.queryByLabelText("Slide 2: foto para o espaço da arte")).toBeNull();
     expect(screen.queryByLabelText("Slide 2: slide pronto do Canva")).toBeNull();
-    expect(miniatura(2).getAttribute("src")).toBe(urlDaArte(BONUS, CARROSSEL, 2, "b1"));
+    expect(miniatura(2).getAttribute("src")).toBe(urlDaArte(CAMINHO, 2, "b1"));
   });
 });
 
```

Em `testes-dom/bonus-publicar-imagem.dom.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-dom/bonus-publicar-imagem.dom.tsx b/testes-dom/bonus-publicar-imagem.dom.tsx
index f136ebd..1a33c32 100644
--- a/testes-dom/bonus-publicar-imagem.dom.tsx
+++ b/testes-dom/bonus-publicar-imagem.dom.tsx
@@ -20,6 +20,7 @@ import type { AvisoDaImagem, RespostaDaAssinatura } from "@/lib/bonus/publicar-t
 
 const BONUS = "0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f";
 const CARROSSEL = "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d";
+const CAMINHO = `/bonus/${BONUS}/carrossel/${CARROSSEL}`;
 
 let medidas: { width: number; height: number };
 let pinceladas: string[];
@@ -247,7 +248,7 @@ describe("as artes do Chat, na hora de publicar", () => {
     return { ok: true, caminho: `178/bonus-fila/${n}.jpg`, url: `https://bucket/sign/${n}?token=t` };
   });
   const pedido = (desenhados: { numero: number; comFoto: boolean }[], a = assinar) => ({
-    bonusId: BONUS,
+    caminho: CAMINHO,
     carrosselId: CARROSSEL,
     desenhados,
     versoesDaMiniatura: ["m1", "m2", "m3", "m4", "m5"],
@@ -273,7 +274,7 @@ describe("as artes do Chat, na hora de publicar", () => {
         { numero: 5, caminho: "178/bonus-fila/5.jpg", versao: "desenho-5" },
       ],
     });
-    expect(artesPedidas).toEqual([urlDaArte(BONUS, CARROSSEL, 1, "m1"), urlDaArte(BONUS, CARROSSEL, 2, "m2"), urlDaArte(BONUS, CARROSSEL, 5, "m5")]);
+    expect(artesPedidas).toEqual([urlDaArte(CAMINHO, 1, "m1"), urlDaArte(CAMINHO, 2, "m2"), urlDaArte(CAMINHO, 5, "m5")]);
     expect(assinar.mock.calls.map((c) => (c[0] as { destino: string }).destino)).toEqual(["fila", "fila", "fila"]);
     expect(puts.map((p) => p.tipo)).toEqual(["image/jpeg", "image/jpeg", "image/jpeg"]);
     expect(toBlob).toHaveLength(3);
@@ -345,7 +346,7 @@ describe("publicar da tela", () => {
     return { ok: true, caminho: `178/bonus-fila/${n}.jpg`, url: `https://bucket/sign/${n}?token=t` };
   });
   const base = {
-    bonusId: BONUS,
+    caminho: CAMINHO,
     carrosselId: CARROSSEL,
     desenhados: [{ numero: 1, comFoto: false }],
     versoesDaMiniatura: ["m1", "m2"],
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-carrossel-caminho.test.ts tests/bonus-arte-tela.test.ts tests/bonus-carrossel-textos.test.ts tests/bonus-carrossel-tela.test.ts
npx vitest run --config vitest.dom.config.ts testes-dom/bonus-card-da-parte.dom.tsx testes-dom/bonus-card-publicar.dom.tsx testes-dom/bonus-editor-do-carrossel.dom.tsx testes-dom/bonus-imagem-no-card.dom.tsx testes-dom/bonus-publicar-imagem.dom.tsx
```

Esperado: os puros: 9 caem e 54 passam (63), e o arquivo do caminho cai sem casos (o módulo não existe); a tela: 13 caem e 54 passam (67), porque os componentes ainda não têm a propriedade `caminho`.

- [ ] **Passo 3: o código**

Em `lib/bonus/carrossel-linha.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/carrossel-linha.ts b/lib/bonus/carrossel-linha.ts
index 2c81a06..19b0922 100644
--- a/lib/bonus/carrossel-linha.ts
+++ b/lib/bonus/carrossel-linha.ts
@@ -2,9 +2,16 @@
 // Só tipos: é o que carrossel-repositorio.ts (server-only) e carrossel-tela.ts (puro) compartilham.
 import type { EstadoDaGeracao } from "./tempos";
 
+/**
+ * De onde o carrossel veio (migrations/016-carrossel-avulso.sql): do bônus do Chat (`bonus_id`), de
+ * um bônus do Labs (`labs_codigo`) ou de um texto livre. O banco amarra as colunas à origem.
+ */
+export type OrigemDoCarrossel = "bonus" | "labs" | "livre";
+
 export type LinhaDoCarrossel = {
   id: string;
-  bonus_id: string;
+  /** Só na origem "bonus" (a 016 tirou o `not null`). */
+  bonus_id: string | null;
   criado_em: Date;
   total_slides: number;
   palavra: string;
@@ -18,4 +25,9 @@ export type LinhaDoCarrossel = {
   revisado_em: Date | null;
   /** As escolhas da arte (migrations/015-arte-do-carrossel.sql), lidas por `escolhasDaArte`. */
   arte: unknown;
+  origem: OrigemDoCarrossel;
+  /** O código (o slug) do bônus do Labs, só na origem "labs". */
+  labs_codigo: string | null;
+  /** Escrito à mão pelo operador: não gastou IA e não conta no teto. */
+  texto_a_mao: boolean;
 };
```

Crie `lib/bonus/carrossel-caminho.ts`:

```ts
// O ENDEREÇO DE CADA CARROSSEL, decidido pela linha (spec da Etapa 7, "As rotas"). PURO.
//
// O carrossel de bônus mora na página de hoje, embaixo do bônus; o avulso, em /carrosseis. A arte, o
// "Baixar", o aviso na URL e os redirects montam o endereço a partir daqui, e não do id do bônus.
import type { LinhaDoCarrossel } from "./carrossel-linha";

/** A rota que pediu o carrossel: a do bônus, com o id dele na URL, ou a dos avulsos. */
export type RotaDoCarrossel = { tipo: "bonus"; bonusId: string } | { tipo: "avulso" };

/** O caminho da página do carrossel, sem a barra do fim. */
export function caminhoDoCarrossel(l: Pick<LinhaDoCarrossel, "id" | "origem" | "bonus_id">): string {
  return l.origem === "bonus" && l.bonus_id ? `/bonus/${l.bonus_id}/carrossel/${l.id}` : `/carrosseis/${l.id}`;
}

/** Cada rota serve só a sua origem: o carrossel da outra dá 404 nas duas. */
export function ehDaRota(l: Pick<LinhaDoCarrossel, "origem" | "bonus_id">, rota: RotaDoCarrossel): boolean {
  return rota.tipo === "bonus" ? l.origem === "bonus" && l.bonus_id === rota.bonusId : l.origem !== "bonus";
}
```

Em `lib/bonus/arte-tela.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/arte-tela.ts b/lib/bonus/arte-tela.ts
index 2e7d33c..53f3b4c 100644
--- a/lib/bonus/arte-tela.ts
+++ b/lib/bonus/arte-tela.ts
@@ -2,6 +2,7 @@
 import { iniciais, type ContaDoCabecalho } from "./arte-conta";
 import { slidesDoTexto, type SlideParaArte } from "./arte-slides";
 import { TEXTO_ARTE_NAO_ENCONTRADA, TEXTO_ARTE_NAO_PRONTA, TEXTO_ARTE_SLIDE_INVALIDO } from "./arte-textos";
+import { ehDaRota, type RotaDoCarrossel } from "./carrossel-caminho";
 import type { LinhaDoCarrossel } from "./carrossel-linha";
 import { textoDaLinhaDoCarrossel } from "./carrossel-tela";
 
@@ -16,18 +17,19 @@ export function numeroDoSlide(v: string | null, total: number): number | null {
 }
 
 /**
- * O QUE A ROTA CONFERE ANTES DE DESENHAR, depois da sessão e dos ids: o carrossel existe e é do
- * bônus da URL; está pronto, com texto de forma válida (o revisado, ou o gerado); e o slide pedido
- * existe nele. Fora da rota para cada recusa ter teste: a integração só alcança a rota sem sessão.
+ * O QUE A ROTA CONFERE ANTES DE DESENHAR, depois da sessão e dos ids: o carrossel existe e é da rota
+ * que o pediu (o do bônus da URL, ou um avulso: carrossel-caminho.ts, `ehDaRota`); está pronto, com
+ * texto de forma válida (o revisado, ou o gerado); e o slide pedido existe nele. Fora da rota para
+ * cada recusa ter teste: a integração só alcança a rota sem sessão.
  */
 export function conferirPedidoDaArte(
   linha: LinhaDoCarrossel | null,
-  bonusId: string,
+  rota: RotaDoCarrossel,
   slide: string | null
 ):
   | { ok: true; linha: LinhaDoCarrossel; slides: SlideParaArte[]; numero: number }
   | { ok: false; status: 400 | 404 | 409; texto: string } {
-  if (!linha || linha.bonus_id !== bonusId) return { ok: false, status: 404, texto: TEXTO_ARTE_NAO_ENCONTRADA };
+  if (!linha || !ehDaRota(linha, rota)) return { ok: false, status: 404, texto: TEXTO_ARTE_NAO_ENCONTRADA };
   const texto = linha.estado === "pronto" ? textoDaLinhaDoCarrossel(linha) : null;
   if (!texto) return { ok: false, status: 409, texto: TEXTO_ARTE_NAO_PRONTA };
   const slides = slidesDoTexto(texto);
@@ -129,6 +131,7 @@ export function versoesDosSlides(
   );
 }
 
-export function urlDaArte(bonusId: string, carrosselId: string, numero: number, versao: string, baixar = false): string {
-  return `/bonus/${bonusId}/carrossel/${carrosselId}/arte?slide=${numero}&v=${versao}${baixar ? "&baixar=1" : ""}`;
+/** `caminho` é o da página do carrossel (carrossel-caminho.ts): a arte mora embaixo dela. */
+export function urlDaArte(caminho: string, numero: number, versao: string, baixar = false): string {
+  return `${caminho}/arte?slide=${numero}&v=${versao}${baixar ? "&baixar=1" : ""}`;
 }
```

Em `lib/bonus/carrossel-textos.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/carrossel-textos.ts b/lib/bonus/carrossel-textos.ts
index e7f3f30..7c2af8e 100644
--- a/lib/bonus/carrossel-textos.ts
+++ b/lib/bonus/carrossel-textos.ts
@@ -27,9 +27,12 @@ export function textoDaParteSalva(parte: ParteDoCarrossel, total: number, avisos
   return avisos.length ? `${salvo} Atenção, em outro campo: ${textoDosProblemasDoCarrossel(total, avisos)}` : salvo;
 }
 
-/** O aviso vai pela URL com texto E tom: `avisoDaUrl` lê os dois, e sem tom tudo vira erro. */
-export function urlDoCarrosselComAviso(bonusId: string, carrosselId: string, aviso: Aviso): string {
-  return `/bonus/${bonusId}/carrossel/${carrosselId}?aviso=${encodeURIComponent(aviso.texto)}&tom=${aviso.tom}`;
+/**
+ * O aviso vai pela URL com texto E tom: `avisoDaUrl` lê os dois, e sem tom tudo vira erro. `caminho`
+ * é o da página do carrossel (carrossel-caminho.ts, `caminhoDoCarrossel`).
+ */
+export function urlDoCarrosselComAviso(caminho: string, aviso: Aviso): string {
+  return `${caminho}?aviso=${encodeURIComponent(aviso.texto)}&tom=${aviso.tom}`;
 }
 
 export function textoDaRecusaDoPedidoDeCarrossel(motivo: RecusaDoPedidoDeCarrossel): string {
```

Em `app/bonus/carrossel-actions.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/carrossel-actions.ts b/app/bonus/carrossel-actions.ts
index 35d0a06..2ae71d0 100644
--- a/app/bonus/carrossel-actions.ts
+++ b/app/bonus/carrossel-actions.ts
@@ -22,6 +22,7 @@ import {
   textoDaRecusaDaArte,
   type AvisoDaArte,
 } from "@/lib/bonus/arte-textos";
+import { caminhoDoCarrossel } from "@/lib/bonus/carrossel-caminho";
 import type { ContextoDoCarrossel } from "@/lib/bonus/carrossel-ia-parametros";
 import { lerPedidoDeCarrossel } from "@/lib/bonus/carrossel-pedido";
 import { processarCarrossel } from "@/lib/bonus/carrossel-processo";
@@ -145,20 +146,24 @@ export async function gerarCarrosselDeNovo(form: FormData): Promise<void> {
   const id = form.get("id");
   if (!ehIdDeBonus(id)) redirect(urlDoBonusComAviso(null, { tom: "erro", texto: TEXTO_CARROSSEL_NAO_ENCONTRADO }));
   const linha = await lerCarrossel(id);
-  if (!linha) redirect(urlDoBonusComAviso(null, { tom: "erro", texto: TEXTO_CARROSSEL_NAO_ENCONTRADO }));
+  // O avulso (Etapa 7) gera de novo pela action dele (app/carrosseis/actions.ts): esta só conhece o
+  // carrossel de bônus.
+  const bonusId = linha?.bonus_id;
+  if (!linha || !bonusId) redirect(urlDoBonusComAviso(null, { tom: "erro", texto: TEXTO_CARROSSEL_NAO_ENCONTRADO }));
+  const caminho = caminhoDoCarrossel(linha);
   const naTela = geracaoNaTela(linha.estado, linha.criado_em, Date.now());
   if (naTela !== "falhou" && naTela !== "travou") {
-    redirect(urlDoCarrosselComAviso(linha.bonus_id, id, { tom: "erro", texto: TEXTO_NAO_DA_PARA_GERAR_CARROSSEL_DE_NOVO }));
+    redirect(urlDoCarrosselComAviso(caminho, { tom: "erro", texto: TEXTO_NAO_DA_PARA_GERAR_CARROSSEL_DE_NOVO }));
   }
   if (!temChaveDaIA(process.env)) {
-    redirect(urlDoCarrosselComAviso(linha.bonus_id, id, { tom: "erro", texto: textoDaConfig("sem_chave_ia") }));
+    redirect(urlDoCarrosselComAviso(caminho, { tom: "erro", texto: textoDaConfig("sem_chave_ia") }));
   }
-  const bonus = await bonusParaCarrossel(linha.bonus_id);
-  if (!bonus.ok) redirect(urlDoCarrosselComAviso(linha.bonus_id, id, { tom: "erro", texto: bonus.texto }));
+  const bonus = await bonusParaCarrossel(bonusId);
+  if (!bonus.ok) redirect(urlDoCarrosselComAviso(caminho, { tom: "erro", texto: bonus.texto }));
   // O novo herda a conta do original, mesmo desconectada (decisão do Eduardo em 02/10): gerar de
   // novo um carrossel do Thiago com o Chat na N8X faz outro do Thiago.
   const criado = await criarPedidoDeCarrossel({
-    bonusId: linha.bonus_id,
+    bonusId,
     total: linha.total_slides,
     palavra: bonus.palavra,
     contexto: bonus.contexto,
@@ -168,10 +173,10 @@ export async function gerarCarrosselDeNovo(form: FormData): Promise<void> {
       await contaDoCookie()
     ),
   });
-  if (!criado.ok) redirect(urlDoCarrosselComAviso(linha.bonus_id, id, { tom: "erro", texto: textoDoTetoDoCarrossel() }));
+  if (!criado.ok) redirect(urlDoCarrosselComAviso(caminho, { tom: "erro", texto: textoDoTetoDoCarrossel() }));
   const novo = criado.id;
   after(() => processarCarrossel(novo));
-  redirect(`/bonus/${linha.bonus_id}/carrossel/${novo}`);
+  redirect(`/bonus/${bonusId}/carrossel/${novo}`);
 }
 
 /**
```

Em `app/bonus/[id]/carrossel/[cid]/page.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/[id]/carrossel/[cid]/page.tsx b/app/bonus/[id]/carrossel/[cid]/page.tsx
index f941539..be604b4 100644
--- a/app/bonus/[id]/carrossel/[cid]/page.tsx
+++ b/app/bonus/[id]/carrossel/[cid]/page.tsx
@@ -21,6 +21,7 @@ import { fotosDaArte, imagensDaArte, versaoDoTextoDoSlide } from "@/lib/bonus/pu
 import { estadoDoCarrossel } from "@/lib/bonus/publicar-repositorio";
 import { textoDaTrava, textoDoCalendario, textoDoEstadoDaPublicacao, tomDoEstadoDaPublicacao } from "@/lib/bonus/publicar-textos";
 import { TEXTO_ARTE_SEM_CONTA, rotuloDaConta, textoDaOrigemDaConta } from "@/lib/bonus/arte-textos";
+import { caminhoDoCarrossel, ehDaRota } from "@/lib/bonus/carrossel-caminho";
 import type { LinhaDoCarrossel } from "@/lib/bonus/carrossel-linha";
 import { contasParaArte, lerCarrossel } from "@/lib/bonus/carrossel-repositorio";
 import { descricaoDoCarrossel, textoDaLinhaDoCarrossel } from "@/lib/bonus/carrossel-tela";
@@ -66,7 +67,7 @@ export default async function PaginaDoCarrossel({
     if (!ehTabelaAusente(erro)) throw erro;
     return <div className={alertError}>{TEXTO_TABELA_CARROSSEL_AUSENTE}</div>;
   }
-  if (!carrossel || carrossel.bonus_id !== id) notFound();
+  if (!carrossel || !ehDaRota(carrossel, { tipo: "bonus", bonusId: id })) notFound();
 
   // Server Component `async` e `force-dynamic`: roda UMA vez por requisição, e ler o
   // relógio aqui é o comportamento pedido. A regra trata todo arquivo como cliente;
@@ -82,7 +83,7 @@ export default async function PaginaDoCarrossel({
   // /admin do Labs, e é esta leitura, feita também logo depois de salvar, que avisa. Durante a
   // geração a tela pergunta ao servidor a cada 2 s, e cada pergunta leria a lista inteira do
   // Labs de novo, sem nada a mostrar ainda.
-  const situacao = geracao === "gerando" ? null : await situacaoDoBonus(carrossel.bonus_id);
+  const situacao = geracao === "gerando" ? null : await situacaoDoBonus(id);
   const quadro = situacao ? quadroDaSituacao(situacao) : null;
   const trocada =
     situacao?.tipo === "publicado" && situacao.bonus.palavra !== carrossel.palavra ? situacao.bonus.palavra : null;
@@ -185,7 +186,7 @@ async function Revisao({ carrossel }: { carrossel: LinhaDoCarrossel }) {
       acaoDoSlide={salvarSlideDoCarrossel}
       acaoDaArte={salvarArteDoCarrossel}
       acaoDaConta={fixarContaDoCarrossel}
-      bonusId={carrossel.bonus_id}
+      caminho={caminhoDoCarrossel(carrossel)}
       carrosselId={carrossel.id}
       palavra={carrossel.palavra}
       total={carrossel.total_slides}
```

Em `app/bonus/[id]/carrossel/[cid]/arte/route.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/[id]/carrossel/[cid]/arte/route.tsx b/app/bonus/[id]/carrossel/[cid]/arte/route.tsx
index 1491ae8..a36cff6 100644
--- a/app/bonus/[id]/carrossel/[cid]/arte/route.tsx
+++ b/app/bonus/[id]/carrossel/[cid]/arte/route.tsx
@@ -45,7 +45,7 @@ export async function GET(request: Request, { params }: { params: Promise<{ id:
   if (!ehIdDeBonus(id) || !ehIdDeBonus(cid)) return erro(404, TEXTO_ARTE_NAO_ENCONTRADA);
   const pedido = new URL(request.url).searchParams;
   // O dono, o "pronto" e o slide: arte-tela.ts, `conferirPedidoDaArte`, com um caso por recusa.
-  const conferido = conferirPedidoDaArte(await lerCarrossel(cid), id, pedido.get("slide"));
+  const conferido = conferirPedidoDaArte(await lerCarrossel(cid), { tipo: "bonus", bonusId: id }, pedido.get("slide"));
   if (!conferido.ok) return erro(conferido.status, conferido.texto);
   const { linha, slides, numero } = conferido;
 
```

Em `app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx b/app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx
index 08f9e16..566d9f7 100644
--- a/app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx
+++ b/app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx
@@ -37,7 +37,7 @@ import type { ImagemNaTela } from "./publicacao-na-tela";
 // upload, e o "Só texto" desligado. A trava vale no servidor; aqui ela só se mostra.
 export default function CardDaParte({
   acao,
-  bonusId,
+  caminho,
   carrosselId,
   palavra,
   total,
@@ -56,7 +56,7 @@ export default function CardDaParte({
   aoMudarNaoSalvo,
 }: {
   acao: (anterior: AvisoDoSlide | null, form: FormData) => Promise<AvisoDoSlide | null>;
-  bonusId: string;
+  caminho: string;
   carrosselId: string;
   palavra: string;
   total: number;
@@ -151,7 +151,7 @@ export default function CardDaParte({
             {/* eslint-disable-next-line @next/next/no-img-element -- a arte está atrás de sessão, e o
                 otimizador de imagem do Next buscaria a URL sem o cookie: a miniatura voltaria 401. */}
             <img
-              src={(comImagem?.jeito === "slide" ? comImagem.url : null) ?? urlDaArte(bonusId, carrosselId, numero, versao)}
+              src={(comImagem?.jeito === "slide" ? comImagem.url : null) ?? urlDaArte(caminho, numero, versao)}
               alt={`Slide ${numero} de ${total}`}
               width={216}
               height={270}
@@ -175,7 +175,7 @@ export default function CardDaParte({
             <div className="flex flex-wrap gap-2">
               {podeSubir && botaoDeImagem("foto")}
               <a
-                href={urlDaArte(bonusId, carrosselId, numero, versao, true)}
+                href={urlDaArte(caminho, numero, versao, true)}
                 download
                 aria-label={`Baixar o slide ${numero}`}
                 className={`${btnSecondary} whitespace-nowrap`}
```

Em `app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx b/app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx
index 830340c..52b8084 100644
--- a/app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx
+++ b/app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx
@@ -37,7 +37,7 @@ export default function EditorDoCarrossel({
   acaoDoSlide,
   acaoDaArte,
   acaoDaConta,
-  bonusId,
+  caminho,
   carrosselId,
   palavra,
   total,
@@ -54,7 +54,7 @@ export default function EditorDoCarrossel({
   acaoDoSlide: (anterior: AvisoDoSlide | null, form: FormData) => Promise<AvisoDoSlide | null>;
   acaoDaArte: (anterior: AvisoDaArte | null, form: FormData) => Promise<AvisoDaArte | null>;
   acaoDaConta: (anterior: AvisoDaArte | null, form: FormData) => Promise<AvisoDaArte | null>;
-  bonusId: string;
+  caminho: string;
   carrosselId: string;
   palavra: string;
   total: number;
@@ -130,7 +130,7 @@ export default function EditorDoCarrossel({
     setBaixando(true);
     for (const n of slides) {
       const a = document.createElement("a");
-      a.href = urlDaArte(bonusId, carrosselId, n, versoes[n - 1], true);
+      a.href = urlDaArte(caminho, n, versoes[n - 1], true);
       a.setAttribute("download", "");
       document.body.appendChild(a);
       a.click();
@@ -183,7 +183,7 @@ export default function EditorDoCarrossel({
             <CardDaParte
               key={n}
               acao={acaoDoSlide}
-              bonusId={bonusId}
+              caminho={caminho}
               carrosselId={carrosselId}
               palavra={palavra}
               total={total}
@@ -204,7 +204,7 @@ export default function EditorDoCarrossel({
           ))}
           <CardDaParte
             acao={acaoDoSlide}
-            bonusId={bonusId}
+            caminho={caminho}
             carrosselId={carrosselId}
             palavra={palavra}
             total={total}
@@ -237,7 +237,7 @@ export default function EditorDoCarrossel({
       {publicacao && (
         <CardPublicar
           publicacao={publicacao}
-          bonusId={bonusId}
+          caminho={caminho}
           carrosselId={carrosselId}
           total={total}
           soTexto={soTexto}
```

Em `app/bonus/[id]/carrossel/[cid]/card-publicar.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/[id]/carrossel/[cid]/card-publicar.tsx b/app/bonus/[id]/carrossel/[cid]/card-publicar.tsx
index d651992..7ba856c 100644
--- a/app/bonus/[id]/carrossel/[cid]/card-publicar.tsx
+++ b/app/bonus/[id]/carrossel/[cid]/card-publicar.tsx
@@ -23,7 +23,7 @@ const QUADRO: Record<TomDoQuadro, string> = { ok: alertOk, atencao: alertWarn, e
 
 export default function CardPublicar({
   publicacao,
-  bonusId,
+  caminho,
   carrosselId,
   total,
   soTexto,
@@ -33,7 +33,7 @@ export default function CardPublicar({
   legendaNaoSalva,
 }: {
   publicacao: PublicacaoNaTela;
-  bonusId: string;
+  caminho: string;
   carrosselId: string;
   total: number;
   soTexto: number[];
@@ -54,7 +54,7 @@ export default function CardPublicar({
   function publicar() {
     iniciar(async () => {
       const r = await publicarDaTela({
-        bonusId,
+        caminho,
         carrosselId,
         desenhados: artesParaPublicar({ total, soTexto, imagens }),
         versoesDaMiniatura,
```

Em `app/bonus/[id]/carrossel/[cid]/imagem-no-navegador.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/[id]/carrossel/[cid]/imagem-no-navegador.ts b/app/bonus/[id]/carrossel/[cid]/imagem-no-navegador.ts
index 7178f8e..6e31aba 100644
--- a/app/bonus/[id]/carrossel/[cid]/imagem-no-navegador.ts
+++ b/app/bonus/[id]/carrossel/[cid]/imagem-no-navegador.ts
@@ -189,7 +189,7 @@ export async function enviarImagemDoSlide(p: {
  * banco, e a página pode estar velha (a foto subiu noutra aba). Com o cabeçalho, só o "sim" sobe.
  */
 export async function prepararArtes(p: {
-  bonusId: string;
+  caminho: string;
   carrosselId: string;
   desenhados: { numero: number; comFoto: boolean }[];
   versoesDaMiniatura: string[];
@@ -200,7 +200,7 @@ export async function prepararArtes(p: {
     let pronta: ImagemPronta;
     let versao: string | null;
     try {
-      const r = await fetch(urlDaArte(p.bonusId, p.carrosselId, numero, p.versoesDaMiniatura[numero - 1] ?? ""), { cache: "no-store" });
+      const r = await fetch(urlDaArte(p.caminho, numero, p.versoesDaMiniatura[numero - 1] ?? ""), { cache: "no-store" });
       if (!r.ok) return { ok: false, texto: textoDaArteQueNaoVeio(numero) };
       const foto = r.headers.get(CABECALHO_DA_FOTO);
       if ((comFoto || foto !== null) && foto !== "sim") return { ok: false, texto: textoDaFotoQueFaltou(numero) };
@@ -235,7 +235,7 @@ export async function prepararArtes(p: {
  * componente, para o relógio não ser lido durante o desenho da tela.
  */
 export async function publicarDaTela(p: {
-  bonusId: string;
+  caminho: string;
   carrosselId: string;
   desenhados: { numero: number; comFoto: boolean }[];
   versoesDaMiniatura: string[];
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx vitest run tests/bonus-carrossel-caminho.test.ts tests/bonus-arte-tela.test.ts tests/bonus-carrossel-textos.test.ts tests/bonus-carrossel-tela.test.ts
npx vitest run --config vitest.dom.config.ts testes-dom/bonus-card-da-parte.dom.tsx testes-dom/bonus-card-publicar.dom.tsx testes-dom/bonus-editor-do-carrossel.dom.tsx testes-dom/bonus-imagem-no-card.dom.tsx testes-dom/bonus-publicar-imagem.dom.tsx
```

Esperado: `tsc` limpo; 69 casos puros e 67 de tela passam.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/carrossel-linha.ts lib/bonus/carrossel-caminho.ts lib/bonus/arte-tela.ts lib/bonus/carrossel-textos.ts app/bonus/carrossel-actions.ts "app/bonus/[id]/carrossel/[cid]/page.tsx" "app/bonus/[id]/carrossel/[cid]/arte/route.tsx" "app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx" "app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx" "app/bonus/[id]/carrossel/[cid]/card-publicar.tsx" "app/bonus/[id]/carrossel/[cid]/imagem-no-navegador.ts" tests/bonus-carrossel-caminho.test.ts tests/bonus-arte-tela.test.ts tests/bonus-carrossel-textos.test.ts tests/bonus-carrossel-tela.test.ts testes-dom/bonus-card-da-parte.dom.tsx testes-dom/bonus-card-publicar.dom.tsx testes-dom/bonus-editor-do-carrossel.dom.tsx testes-dom/bonus-imagem-no-card.dom.tsx testes-dom/bonus-publicar-imagem.dom.tsx
test "$(git branch --show-current)" = "carrossel-avulso"
git add lib/bonus/carrossel-linha.ts lib/bonus/carrossel-caminho.ts lib/bonus/arte-tela.ts lib/bonus/carrossel-textos.ts app/bonus/carrossel-actions.ts "app/bonus/[id]/carrossel/[cid]/page.tsx" "app/bonus/[id]/carrossel/[cid]/arte/route.tsx" "app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx" "app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx" "app/bonus/[id]/carrossel/[cid]/card-publicar.tsx" "app/bonus/[id]/carrossel/[cid]/imagem-no-navegador.ts" tests/bonus-carrossel-caminho.test.ts tests/bonus-arte-tela.test.ts tests/bonus-carrossel-textos.test.ts tests/bonus-carrossel-tela.test.ts testes-dom/bonus-card-da-parte.dom.tsx testes-dom/bonus-card-publicar.dom.tsx testes-dom/bonus-editor-do-carrossel.dom.tsx testes-dom/bonus-imagem-no-card.dom.tsx testes-dom/bonus-publicar-imagem.dom.tsx
git commit -m "feat(bonus): o endereço de cada carrossel vem da linha, e cada rota serve só a sua origem"
```

---

### FASE 7.3 — O contexto do texto livre e a mensagem dele à IA

**Arquivos:**
- Modificar: `lib/bonus/carrossel-ia-parametros.ts`
- Testar: `tests/bonus-carrossel-ia-parametros.test.ts`

**Interfaces:**
- Produz: `type ContextoDeBonus = { tema; titulo; descricao; oQueResolve }` (a forma de hoje); `type
  ContextoLivre = { tipo: "livre"; tema; conteudo }`; `ContextoDoCarrossel = ContextoDeBonus |
  ContextoLivre`. `contextoGravado` aceita os dois e recusa um `tipo` desconhecido;
  `mensagemDoCarrossel` do livre é "Tema", "O conteúdo que este post divulga:" e o pedido extra.

- [ ] **Passo 1: o teste**

Em `tests/bonus-carrossel-ia-parametros.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-carrossel-ia-parametros.test.ts b/tests/bonus-carrossel-ia-parametros.test.ts
index d8989c4..65f5779 100644
--- a/tests/bonus-carrossel-ia-parametros.test.ts
+++ b/tests/bonus-carrossel-ia-parametros.test.ts
@@ -55,6 +55,23 @@ describe("a mensagem do carrossel", () => {
   });
 });
 
+// O TEXTO LIVRE (Etapa 7): o carrossel avulso sem bônus. A mensagem leva o tema e o conteúdo, e não
+// fala de um bônus nem do que ele resolve, que não existem.
+describe("a mensagem do carrossel do texto livre", () => {
+  const LIVRE = { tipo: "livre" as const, tema: "Produtividade", conteudo: "Um prompt que critica o seu plano sem dó." };
+
+  it("leva o tema e o conteúdo, e o mesmo pedido extra", () => {
+    const m = mensagemDoCarrossel({ total: 4, palavra: "BRUTAL", contexto: LIVRE });
+    expect(m).toBe(`Tema: Produtividade\n\nO conteúdo que este post divulga:\n${LIVRE.conteudo}\n\n${pedidoExtra(4, "BRUTAL")}`);
+  });
+
+  it("não fala de bônus nem do que deve resolver", () => {
+    const m = mensagemDoCarrossel({ total: 1, palavra: "BRUTAL", contexto: LIVRE });
+    expect(m).not.toContain("O bônus que");
+    expect(m).not.toContain("O que deve resolver");
+  });
+});
+
 describe("os parâmetros da chamada", () => {
   it("de 2 a 10: a instrução do carrossel, intacta, com a política do bônus", () => {
     const p = parametrosDoCarrossel(PEDIDO);
@@ -92,7 +109,22 @@ describe("o contexto gravado na linha", () => {
     expect(contextoGravado(CONTEXTO)).toEqual(CONTEXTO);
   });
 
-  it.each([null, {}, { ...CONTEXTO, tema: 1 }, "x"])("recusa o que não tem a forma: %j", (v) => {
+  // As linhas de antes da Etapa 7 não têm `tipo`, e continuam valendo como estão.
+  it("aceita o texto livre do avulso, e devolve só os campos dele", () => {
+    const livre = { tipo: "livre", tema: "Produtividade", conteudo: "Um prompt que critica o seu plano." };
+    expect(contextoGravado(livre)).toEqual(livre);
+    expect(contextoGravado({ ...livre, oQueResolve: "a mais" })).toEqual(livre);
+  });
+
+  it.each([
+    null,
+    {},
+    { ...CONTEXTO, tema: 1 },
+    "x",
+    { tipo: "livre", tema: "Produtividade" },
+    { tipo: "livre", conteudo: "sem tema" },
+    { ...CONTEXTO, tipo: "outro" },
+  ])("recusa o que não tem a forma: %j", (v) => {
     expect(contextoGravado(v)).toBeNull();
   });
 });
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-carrossel-ia-parametros.test.ts
```

Esperado: 4 caem e 16 passam (20).

- [ ] **Passo 3: o código**

Em `lib/bonus/carrossel-ia-parametros.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/carrossel-ia-parametros.ts b/lib/bonus/carrossel-ia-parametros.ts
index db0d35c..72af162 100644
--- a/lib/bonus/carrossel-ia-parametros.ts
+++ b/lib/bonus/carrossel-ia-parametros.ts
@@ -12,15 +12,31 @@ import { BETA_DO_FALLBACK, MODELO } from "./ia-parametros";
 import { INSTRUCAO_CARROSSEL } from "./instrucao-carrossel";
 import { INSTRUCAO_POST } from "./instrucao-post";
 
-/** O que o Labs dizia do bônus no momento do pedido, mais o que o operador pediu na Etapa 1. */
-export type ContextoDoCarrossel = { tema: string; titulo: string; descricao: string; oQueResolve: string };
+/**
+ * O que o Labs dizia do bônus no momento do pedido, mais o que o operador pediu na Etapa 1. O avulso
+ * de um bônus do Labs (Etapa 7) usa a mesma forma, com o "O que destacar" no `oQueResolve`.
+ */
+export type ContextoDeBonus = { tema: string; titulo: string; descricao: string; oQueResolve: string };
+
+/** O texto livre do carrossel avulso (Etapa 7): o tema e o conteúdo que o post divulga, sem bônus. */
+export type ContextoLivre = { tipo: "livre"; tema: string; conteudo: string };
+
+export type ContextoDoCarrossel = ContextoDeBonus | ContextoLivre;
 
 export type PedidoParaIA = { total: number; palavra: string; contexto: ContextoDoCarrossel };
 
-/** O contexto como a action o gravou em `carrosseis_gerados.contexto`. Forma errada → null. */
+/**
+ * O contexto como a action o gravou em `carrosseis_gerados.contexto`. Forma errada → null. O de
+ * bônus não tem `tipo` (as linhas de antes da Etapa 7 ficam como estão); um `tipo` desconhecido
+ * também é forma errada, e não vira bônus.
+ */
 export function contextoGravado(v: unknown): ContextoDoCarrossel | null {
   if (v === null || typeof v !== "object" || Array.isArray(v)) return null;
   const o = v as Record<string, unknown>;
+  if (o.tipo === "livre") {
+    return typeof o.tema === "string" && typeof o.conteudo === "string" ? { tipo: "livre", tema: o.tema, conteudo: o.conteudo } : null;
+  }
+  if (o.tipo !== undefined) return null;
   const { tema, titulo, descricao, oQueResolve } = o;
   if (
     typeof tema !== "string" ||
@@ -70,8 +86,13 @@ export function pedidoExtra(total: number, palavra: string): string {
   );
 }
 
+/**
+ * A mensagem do pedido. A do texto livre (Etapa 7) leva o tema e o conteúdo, e não fala de um bônus
+ * nem do que ele resolve: não há bônus.
+ */
 export function mensagemDoCarrossel(p: PedidoParaIA): string {
   const c = p.contexto;
+  if ("tipo" in c) return `Tema: ${c.tema}\n\nO conteúdo que este post divulga:\n${c.conteudo}\n\n` + pedidoExtra(p.total, p.palavra);
   return (
     `Tema: ${c.tema}\n\nO que deve resolver:\n${c.oQueResolve}\n\n` +
     `O bônus que este post divulga: "${c.titulo}". ${c.descricao}\n\n` +
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx vitest run tests/bonus-carrossel-ia-parametros.test.ts
```

Esperado: `tsc` limpo; os 20 passam.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/carrossel-ia-parametros.ts tests/bonus-carrossel-ia-parametros.test.ts
test "$(git branch --show-current)" = "carrossel-avulso"
git add lib/bonus/carrossel-ia-parametros.ts tests/bonus-carrossel-ia-parametros.test.ts
git commit -m "feat(bonus): o contexto do texto livre e a mensagem dele à IA"
```

---

### FASE 7.4 — A lista de escolha do Labs e o pedido do carrossel avulso

**Arquivos:**
- Criar: `lib/bonus/avulso-pedido.ts`, `lib/bonus/avulso-textos.ts`
- Modificar: `lib/bonus/publicado.ts`, `lib/bonus/carrossel-pedido.ts`
- Testar: `tests/bonus-avulso-pedido.test.ts`, `tests/bonus-publicado.test.ts`

**Interfaces:**
- Consome: `ContextoDeBonus`, `ContextoLivre` (FASE 7.3); `palavraValida`, `normalizarPalavra`,
  `TEMA_MAX`, `O_QUE_RESOLVE_MAX` (`pedido.ts`).
- Produz, de `publicado.ts`: `type BonusDoLabs = BonusPublicado & { codigo }`; `CODIGO_MAX = 200`;
  `bonusDaLista(corpo): BonusDoLabs[] | null` (só os bônus que a regra de cada item deixa passar, do
  mais novo para o mais velho); `type ListaDoLabs`; `listaDoLabs(base, fetchImpl?)`. `situacaoNoLabs`
  e `situacaoNaLista` não mudam de comportamento (a regra de cada item virou `situacaoDoItem`).
- Produz, de `carrossel-pedido.ts`: `lerTotalDeSlides(bruto): number | null`.
- Produz, de `avulso-pedido.ts`: `CONTEUDO_MIN = 20`, `CONTEUDO_MAX = 8000`, `DESTAQUE_MAX`; `type
  JeitoDoTexto = "ia" | "mao"`; `type PedidoAvulso`; `type RecusaDoPedidoAvulso`;
  `lerPedidoAvulso(bruto)`; `contextoDoLabs(b, destaque)`; `contextoLivre({ tema, conteudo })`;
  `tituloInterno(contexto)`.
- Produz, de `avulso-textos.ts`: `type AvisoDoAvulso`; `textoDaRecusaDoPedidoAvulso(motivo)`;
  `textoDaOrigem(l)`.

- [ ] **Passo 1: os testes**

Crie `tests/bonus-avulso-pedido.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  CONTEUDO_MAX,
  CONTEUDO_MIN,
  DESTAQUE_MAX,
  contextoDoLabs,
  contextoLivre,
  lerPedidoAvulso,
  tituloInterno,
} from "@/lib/bonus/avulso-pedido";
import { textoDaOrigem, textoDaRecusaDoPedidoAvulso } from "@/lib/bonus/avulso-textos";
import { lerTotalDeSlides } from "@/lib/bonus/carrossel-pedido";

// O PEDIDO DE UM CARROSSEL AVULSO (spec da Etapa 7): de um bônus do Labs ou de um texto livre, pela IA
// ou escrito à mão. Quem decide o que é pedido válido é a função pura, e não a action.

const DO_LABS = {
  origem: "labs",
  codigo: "conselheiro-brutalmente-honesto",
  destaque: "",
  tema: "",
  palavra: "",
  conteudo: "",
  total: "5",
  jeito: "ia",
};
const LIVRE = {
  origem: "livre",
  codigo: "",
  destaque: "",
  tema: "Produtividade",
  palavra: "brutal",
  conteudo: "Um prompt que critica o seu plano sem dó nenhum.",
  total: "4",
  jeito: "mao",
};

describe("o pedido do carrossel avulso", () => {
  it("do Labs: o código, o destaque, o total e o jeito", () => {
    expect(lerPedidoAvulso(DO_LABS)).toEqual({
      ok: true,
      pedido: { origem: "labs", codigo: "conselheiro-brutalmente-honesto", destaque: "", total: 5, jeito: "ia" },
    });
  });

  it("o código e o destaque chegam aparados, com a quebra do textarea em \\n", () => {
    const r = lerPedidoAvulso({ ...DO_LABS, codigo: "  conselheiro-brutalmente-honesto ", destaque: " Mostre o antes\r\ne o depois. " });
    expect(r.ok && r.pedido).toEqual({
      origem: "labs",
      codigo: "conselheiro-brutalmente-honesto",
      destaque: "Mostre o antes\ne o depois.",
      total: 5,
      jeito: "ia",
    });
  });

  it("do texto livre: a palavra na forma que o Labs grava, sem acento e em maiúscula", () => {
    expect(lerPedidoAvulso(LIVRE)).toEqual({
      ok: true,
      pedido: { origem: "livre", tema: "Produtividade", palavra: "BRUTAL", conteudo: LIVRE.conteudo, total: 4, jeito: "mao" },
    });
    const r = lerPedidoAvulso({ ...LIVRE, palavra: " Brútal " });
    expect(r.ok && r.pedido.origem === "livre" && r.pedido.palavra).toBe("BRUTAL");
  });

  it("os campos da outra origem não entram no pedido", () => {
    const r = lerPedidoAvulso({ ...DO_LABS, tema: "Vendas", palavra: "OUTRA", conteudo: "x".repeat(50) });
    expect(r.ok && r.pedido).toEqual({ origem: "labs", codigo: DO_LABS.codigo, destaque: "", total: 5, jeito: "ia" });
  });

  it("o conteúdo nos limites passa", () => {
    expect(lerPedidoAvulso({ ...LIVRE, conteudo: "x".repeat(CONTEUDO_MIN) }).ok).toBe(true);
    expect(lerPedidoAvulso({ ...LIVRE, conteudo: "x".repeat(CONTEUDO_MAX) }).ok).toBe(true);
    expect(lerPedidoAvulso({ ...DO_LABS, destaque: "x".repeat(DESTAQUE_MAX) }).ok).toBe(true);
  });

  it.each([
    ["a origem desconhecida", { ...DO_LABS, origem: "notion" }, "origem_invalida"],
    ["a origem ausente", { ...DO_LABS, origem: null }, "origem_invalida"],
    ["o jeito desconhecido", { ...DO_LABS, jeito: "copiar" }, "jeito_invalido"],
    ["0 slides", { ...DO_LABS, total: "0" }, "total_invalido"],
    ["11 slides", { ...LIVRE, total: "11" }, "total_invalido"],
    ["o total que não é número", { ...LIVRE, total: "dez" }, "total_invalido"],
    ["o Labs sem bônus escolhido", { ...DO_LABS, codigo: "  " }, "sem_bonus"],
    ["o código que não é texto", { ...DO_LABS, codigo: null }, "sem_bonus"],
    ["o código comprido demais", { ...DO_LABS, codigo: "x".repeat(201) }, "sem_bonus"],
    ["o destaque comprido", { ...DO_LABS, destaque: "x".repeat(DESTAQUE_MAX + 1) }, "destaque_longo"],
    ["o tema vazio", { ...LIVRE, tema: "   " }, "tema_vazio"],
    ["o tema comprido", { ...LIVRE, tema: "x".repeat(81) }, "tema_longo"],
    ["a palavra vazia", { ...LIVRE, palavra: "" }, "palavra_invalida"],
    ["a palavra com espaço", { ...LIVRE, palavra: "SEM DOR" }, "palavra_invalida"],
    ["a palavra curta", { ...LIVRE, palavra: "AB" }, "palavra_invalida"],
    ["o conteúdo curto", { ...LIVRE, conteudo: "x".repeat(CONTEUDO_MIN - 1) }, "conteudo_curto"],
    ["o conteúdo comprido", { ...LIVRE, conteudo: "x".repeat(CONTEUDO_MAX + 1) }, "conteudo_longo"],
  ])("recusa %s", (_nome, bruto, motivo) => {
    expect(lerPedidoAvulso(bruto)).toEqual({ ok: false, motivo });
  });

  it("cada recusa tem frase", () => {
    for (const motivo of [
      "origem_invalida",
      "jeito_invalido",
      "total_invalido",
      "sem_bonus",
      "destaque_longo",
      "tema_vazio",
      "tema_longo",
      "palavra_invalida",
      "conteudo_curto",
      "conteudo_longo",
    ] as const) {
      expect(textoDaRecusaDoPedidoAvulso(motivo), motivo).toMatch(/\.$/);
    }
    expect(textoDaRecusaDoPedidoAvulso("conteudo_curto")).toContain(String(CONTEUDO_MIN));
  });

  it("o total segue a regra do pedido de carrossel de bônus", () => {
    expect([lerTotalDeSlides(" 10 "), lerTotalDeSlides("1"), lerTotalDeSlides("0"), lerTotalDeSlides("5.5"), lerTotalDeSlides(null)]).toEqual([
      10,
      1,
      null,
      null,
      null,
    ]);
  });
});

describe("o contexto do carrossel avulso", () => {
  const BONUS = {
    codigo: "conselheiro-brutalmente-honesto",
    palavra: "BRUTAL",
    titulo: "Conselheiro brutalmente honesto",
    tema: "Produtividade",
    descricao: "Um prompt que critica o seu plano sem dó.",
  };

  it("do Labs: o título, a descrição e o tema de lá, e o destaque no lugar do que resolve", () => {
    expect(contextoDoLabs(BONUS, "Mostre o antes e o depois.")).toEqual({
      tema: "Produtividade",
      titulo: BONUS.titulo,
      descricao: BONUS.descricao,
      oQueResolve: "Mostre o antes e o depois.",
    });
  });

  it("do Labs sem destaque: a própria descrição", () => {
    expect(contextoDoLabs(BONUS, "").oQueResolve).toBe(BONUS.descricao);
  });

  it("do texto livre: o tema e o conteúdo", () => {
    expect(contextoLivre({ tema: "Produtividade", conteudo: "Um prompt." })).toEqual({ tipo: "livre", tema: "Produtividade", conteudo: "Um prompt." });
  });

  it("o título interno do escrito à mão: o do bônus do Labs, ou o tema", () => {
    expect(tituloInterno(contextoDoLabs(BONUS, ""))).toBe(BONUS.titulo);
    expect(tituloInterno(contextoLivre({ tema: "Produtividade", conteudo: "Um prompt." }))).toBe("Produtividade");
  });
});

describe("a origem na tela", () => {
  it("as três origens, com o título do Labs e o tema do livre", () => {
    expect(textoDaOrigem({ origem: "bonus", contexto: {} })).toBe("Bônus do Chat");
    expect(textoDaOrigem({ origem: "labs", contexto: { tema: "t", titulo: "Conselheiro", descricao: "d", oQueResolve: "o" } })).toBe(
      "Bônus do Labs: Conselheiro"
    );
    expect(textoDaOrigem({ origem: "livre", contexto: { tipo: "livre", tema: "Produtividade", conteudo: "c" } })).toBe(
      "Texto livre: Produtividade"
    );
  });

  it("com o contexto fora da forma, só a origem", () => {
    expect(textoDaOrigem({ origem: "labs", contexto: null })).toBe("Bônus do Labs");
    expect(textoDaOrigem({ origem: "livre", contexto: { tema: "t", titulo: "x", descricao: "d", oQueResolve: "o" } })).toBe("Texto livre");
  });
});
```

Em `tests/bonus-publicado.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-publicado.test.ts b/tests/bonus-publicado.test.ts
index 76080df..6c5f58f 100644
--- a/tests/bonus-publicado.test.ts
+++ b/tests/bonus-publicado.test.ts
@@ -1,5 +1,5 @@
 import { describe, expect, it, vi } from "vitest";
-import { LISTA_MAX_BYTES, situacaoNaLista, situacaoNoLabs } from "@/lib/bonus/publicado";
+import { LISTA_MAX_BYTES, bonusDaLista, listaDoLabs, situacaoNaLista, situacaoNoLabs } from "@/lib/bonus/publicado";
 
 // O item como a lista pública do Labs o devolve (medido ao vivo em 30/09).
 const ITEM = {
@@ -134,3 +134,54 @@ describe("a leitura da lista pelo Chat", () => {
     expect(await situacaoNoLabs(LABS, ITEM.codigo, gorda)).toEqual({ tipo: "formato_estranho" });
   });
 });
+
+// A LISTA DE ESCOLHA DO "NOVO CARROSSEL" (spec da Etapa 7): a mesma leitura, com as mesmas regras por
+// item. O bônus que o Chat não consegue usar não aparece, e a falha da leitura tem o motivo, e não
+// uma lista vazia.
+describe("a lista de escolha do carrossel avulso", () => {
+  const resposta = (status: number, corpo: unknown) =>
+    new Response(typeof corpo === "string" ? corpo : JSON.stringify(corpo), { status });
+  const buscador = (f: () => Promise<Response>) => vi.fn(f) as unknown as typeof fetch;
+  const BRUTAL = {
+    ...ITEM,
+    codigo: "conselheiro-brutalmente-honesto",
+    palavraChave: "BRUTAL",
+    titulo: "Conselheiro brutalmente honesto",
+    tema: "Produtividade",
+  };
+
+  it("traz só os bônus que o Chat consegue usar, do mais novo para o mais velho", () => {
+    const lista = {
+      items: [
+        ITEM,
+        { ...ITEM, codigo: "sem-palavra", palavraChave: undefined },
+        { ...ITEM, codigo: "palavra-de-fora", palavraChave: "SEM-DOR" },
+        { ...ITEM, codigo: "sem-tema", tema: "" },
+        { ...ITEM, codigo: 7 },
+        { ...ITEM, codigo: "" },
+        BRUTAL,
+      ],
+    };
+    expect(bonusDaLista(lista)).toEqual([
+      { codigo: BRUTAL.codigo, palavra: "BRUTAL", titulo: BRUTAL.titulo, tema: "Produtividade", descricao: ITEM.descricao },
+      { codigo: ITEM.codigo, palavra: "SUMIDO", titulo: ITEM.titulo, tema: "Vendas", descricao: ITEM.descricao },
+    ]);
+  });
+
+  it.each([null, {}, { items: "x" }, [], "texto"])("resposta sem lista de itens não é lista: %j", (corpo) => {
+    expect(bonusDaLista(corpo)).toBeNull();
+  });
+
+  it("a leitura devolve a lista inteira", async () => {
+    const f = buscador(async () => resposta(200, { items: [ITEM, BRUTAL] }));
+    const r = await listaDoLabs(LABS, f);
+    expect(r.ok && r.bonus.map((b) => b.codigo)).toEqual([BRUTAL.codigo, ITEM.codigo]);
+  });
+
+  it("a falha da leitura diz o motivo", async () => {
+    expect(await listaDoLabs(undefined, buscador(async () => resposta(200, LISTA)))).toEqual({ ok: false, tipo: "sem_config" });
+    expect(await listaDoLabs(LABS, buscador(async () => resposta(503, {})))).toEqual({ ok: false, tipo: "sem_resposta" });
+    expect(await listaDoLabs(LABS, buscador(async () => resposta(200, "<html>")))).toEqual({ ok: false, tipo: "formato_estranho" });
+    expect(await listaDoLabs(LABS, buscador(async () => resposta(200, { items: 1 })))).toEqual({ ok: false, tipo: "formato_estranho" });
+  });
+});
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-avulso-pedido.test.ts tests/bonus-publicado.test.ts
```

Esperado: em `bonus-publicado`, 8 caem e 35 passam (43), e `bonus-avulso-pedido` cai sem casos: os módulos novos não existem.

- [ ] **Passo 3: o código**

Em `lib/bonus/publicado.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/publicado.ts b/lib/bonus/publicado.ts
index c66578e..8bca110 100644
--- a/lib/bonus/publicado.ts
+++ b/lib/bonus/publicado.ts
@@ -61,19 +61,26 @@ function ausente(v: unknown): boolean {
   return v === undefined || (typeof v === "string" && v.trim() === "");
 }
 
-export function situacaoNaLista(corpo: unknown, slug: string): SituacaoNoLabs {
+/** Os itens da lista, ou null quando a resposta não tem a forma de lista. */
+function itensDaLista(corpo: unknown): unknown[] | null {
   const itens =
     corpo !== null && typeof corpo === "object" && !Array.isArray(corpo)
       ? (corpo as { items?: unknown }).items
       : undefined;
-  if (!Array.isArray(itens)) return { tipo: "formato_estranho" };
+  return Array.isArray(itens) ? itens : null;
+}
 
-  const item = itens.find(
-    (i): i is Record<string, unknown> =>
-      i !== null && typeof i === "object" && (i as { codigo?: unknown }).codigo === slug
-  );
-  if (!item) return { tipo: "nao_publicado" };
+const ehItem = (i: unknown): i is Record<string, unknown> => i !== null && typeof i === "object";
 
+export function situacaoNaLista(corpo: unknown, slug: string): SituacaoNoLabs {
+  const itens = itensDaLista(corpo);
+  if (!itens) return { tipo: "formato_estranho" };
+  const item = itens.find((i): i is Record<string, unknown> => ehItem(i) && i.codigo === slug);
+  return item ? situacaoDoItem(item) : { tipo: "nao_publicado" };
+}
+
+/** A REGRA DE CADA ITEM, a mesma para a situação de um bônus e para a lista de escolha do avulso. */
+function situacaoDoItem(item: Record<string, unknown>): SituacaoNoLabs {
   // Faltando a palavra e o tema, vale a palavra: sem ela, nenhuma chamada tem o que pedir.
   if (ausente(item.palavraChave)) return { tipo: "sem_palavra" };
   if (typeof item.palavraChave !== "string" || item.palavraChave.length > PALAVRA_DO_LABS_MAX) {
@@ -94,13 +101,38 @@ export function situacaoNaLista(corpo: unknown, slug: string): SituacaoNoLabs {
   return { tipo: "publicado", bonus: { palavra, titulo, descricao, tema } };
 }
 
-export async function situacaoNoLabs(
+/** Um bônus da lista do Labs que o Chat consegue usar, com o código (o slug) dele. */
+export type BonusDoLabs = BonusPublicado & { codigo: string };
+
+/** O teto do código que o Chat guarda (`carrosseis_gerados.labs_codigo`) e aceita do formulário. */
+export const CODIGO_MAX = 200;
+
+/**
+ * A LISTA DE ESCOLHA DO CARROSSEL AVULSO (spec da Etapa 7): só os bônus "publicado" pela regra de cada
+ * item, do mais novo para o mais velho (a lista do Labs vem na ordem de criação, a crescente). Null
+ * quando a resposta não tem a forma de lista.
+ */
+export function bonusDaLista(corpo: unknown): BonusDoLabs[] | null {
+  const itens = itensDaLista(corpo);
+  if (!itens) return null;
+  const bonus: BonusDoLabs[] = [];
+  for (const item of itens) {
+    if (!ehItem(item) || typeof item.codigo !== "string" || !item.codigo || item.codigo.length > CODIGO_MAX) continue;
+    const s = situacaoDoItem(item);
+    if (s.tipo === "publicado") bonus.push({ codigo: item.codigo, ...s.bonus });
+  }
+  return bonus.reverse();
+}
+
+type FalhaDaLeitura = { tipo: "sem_config" } | { tipo: "sem_resposta" } | { tipo: "formato_estranho" };
+
+/** O GET da lista pública, com teto de tempo e de tamanho: o corpo já em JSON, ou o motivo da falha. */
+async function lerListaDoLabs(
   base: string | undefined,
-  slug: string,
-  fetchImpl: typeof fetch = fetch
-): Promise<SituacaoNoLabs> {
+  fetchImpl: typeof fetch
+): Promise<{ ok: true; corpo: unknown } | ({ ok: false } & FalhaDaLeitura)> {
   const porta = urlDaPorta(base);
-  if (porta === null) return { tipo: "sem_config" };
+  if (porta === null) return { ok: false, tipo: "sem_config" };
   let res: Response;
   try {
     res = await fetchImpl(porta, {
@@ -110,20 +142,39 @@ export async function situacaoNoLabs(
       cache: "no-store",
     });
   } catch {
-    return { tipo: "sem_resposta" };
+    return { ok: false, tipo: "sem_resposta" };
   }
-  if (res.status !== 200) return { tipo: "sem_resposta" };
+  if (res.status !== 200) return { ok: false, tipo: "sem_resposta" };
 
   let texto: string | null;
   try {
     texto = await lerAteOTeto(res, LISTA_MAX_BYTES);
   } catch {
-    return { tipo: "sem_resposta" };
+    return { ok: false, tipo: "sem_resposta" };
   }
-  if (texto === null) return { tipo: "formato_estranho" };
+  if (texto === null) return { ok: false, tipo: "formato_estranho" };
   try {
-    return situacaoNaLista(JSON.parse(texto), slug);
+    return { ok: true, corpo: JSON.parse(texto) };
   } catch {
-    return { tipo: "formato_estranho" };
+    return { ok: false, tipo: "formato_estranho" };
   }
 }
+
+export async function situacaoNoLabs(
+  base: string | undefined,
+  slug: string,
+  fetchImpl: typeof fetch = fetch
+): Promise<SituacaoNoLabs> {
+  const lida = await lerListaDoLabs(base, fetchImpl);
+  return lida.ok ? situacaoNaLista(lida.corpo, slug) : { tipo: lida.tipo };
+}
+
+export type ListaDoLabs = { ok: true; bonus: BonusDoLabs[] } | ({ ok: false } & FalhaDaLeitura);
+
+/** A lista de escolha, lida agora. A falha diz o motivo (a tela usa `quadroDaSituacao`). */
+export async function listaDoLabs(base: string | undefined, fetchImpl: typeof fetch = fetch): Promise<ListaDoLabs> {
+  const lida = await lerListaDoLabs(base, fetchImpl);
+  if (!lida.ok) return lida;
+  const bonus = bonusDaLista(lida.corpo);
+  return bonus ? { ok: true, bonus } : { ok: false, tipo: "formato_estranho" };
+}
```

Em `lib/bonus/carrossel-pedido.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/carrossel-pedido.ts b/lib/bonus/carrossel-pedido.ts
index 3c43cd6..4d94bda 100644
--- a/lib/bonus/carrossel-pedido.ts
+++ b/lib/bonus/carrossel-pedido.ts
@@ -21,13 +21,19 @@ export function lerPedidoDeCarrossel(bruto: { bonusId: unknown; total: unknown }
   | { ok: true; pedido: PedidoDeCarrossel }
   | { ok: false; motivo: RecusaDoPedidoDeCarrossel } {
   if (!ehIdDeBonus(bruto.bonusId)) return { ok: false, motivo: "bonus_invalido" };
-  const texto = typeof bruto.total === "string" ? bruto.total.trim() : "";
-  if (!/^\d{1,2}$/.test(texto)) return { ok: false, motivo: "total_invalido" };
-  const total = Number(texto);
-  if (total < SLIDES_MIN || total > SLIDES_MAX) return { ok: false, motivo: "total_invalido" };
+  const total = lerTotalDeSlides(bruto.total);
+  if (total === null) return { ok: false, motivo: "total_invalido" };
   return { ok: true, pedido: { bonusId: bruto.bonusId, total } };
 }
 
+/** O total do formulário: só dígitos, de SLIDES_MIN a SLIDES_MAX. É a regra do avulso também (Etapa 7). */
+export function lerTotalDeSlides(bruto: unknown): number | null {
+  const texto = typeof bruto === "string" ? bruto.trim() : "";
+  if (!/^\d{1,2}$/.test(texto)) return null;
+  const total = Number(texto);
+  return total < SLIDES_MIN || total > SLIDES_MAX ? null : total;
+}
+
 export function restamCarrosseisHoje(usadas: number): number {
   return Math.max(0, TETO_CARROSSEL_DIARIO - usadas);
 }
```

Crie `lib/bonus/avulso-pedido.ts`:

```ts
// O PEDIDO DE UM CARROSSEL AVULSO (spec da Etapa 7): de um bônus que já está no Método Labs, ou de um
// texto livre, pela IA ou escrito à mão.
//
// PURO, como lib/bonus/pedido.ts: quem decide o que é pedido válido é esta função, e não o corpo da
// action. Do bônus do Labs, o formulário só traz o código: o título, a descrição, o tema e a palavra
// são lidos da lista pública na hora do pedido, e nunca aceitos do formulário.
import type { ContextoDeBonus, ContextoDoCarrossel, ContextoLivre } from "./carrossel-ia-parametros";
import { lerTotalDeSlides } from "./carrossel-pedido";
import { O_QUE_RESOLVE_MAX, TEMA_MAX, normalizarPalavra, palavraValida } from "./pedido";
import { CODIGO_MAX, type BonusDoLabs } from "./publicado";

/** O conteúdo do texto livre: o que o post divulga, escrito ou colado do Notion. */
export const CONTEUDO_MIN = 20;
export const CONTEUDO_MAX = 8000;
/** O "O que destacar" vai para a IA no lugar do "o que resolve" do bônus do Chat, com o mesmo teto. */
export const DESTAQUE_MAX = O_QUE_RESOLVE_MAX;

/** A IA escreve, ou o operador escreve à mão (sem IA e fora do teto). */
export type JeitoDoTexto = "ia" | "mao";

export type PedidoAvulso =
  | { origem: "labs"; codigo: string; destaque: string; total: number; jeito: JeitoDoTexto }
  | { origem: "livre"; tema: string; palavra: string; conteudo: string; total: number; jeito: JeitoDoTexto };

export type RecusaDoPedidoAvulso =
  | "origem_invalida"
  | "jeito_invalido"
  | "total_invalido"
  | "sem_bonus"
  | "destaque_longo"
  | "tema_vazio"
  | "tema_longo"
  | "palavra_invalida"
  | "conteudo_curto"
  | "conteudo_longo";

/** O \r\n do textarea volta a ser \n antes de contar (a lição da FASE 1.11-bis). */
function texto(v: unknown): string {
  return typeof v === "string" ? v.replace(/\r\n?/g, "\n").trim() : "";
}

export function lerPedidoAvulso(bruto: {
  origem: unknown;
  codigo: unknown;
  destaque: unknown;
  tema: unknown;
  palavra: unknown;
  conteudo: unknown;
  total: unknown;
  jeito: unknown;
}): { ok: true; pedido: PedidoAvulso } | { ok: false; motivo: RecusaDoPedidoAvulso } {
  const origem = bruto.origem;
  if (origem !== "labs" && origem !== "livre") return { ok: false, motivo: "origem_invalida" };
  const jeito = bruto.jeito;
  if (jeito !== "ia" && jeito !== "mao") return { ok: false, motivo: "jeito_invalido" };
  const total = lerTotalDeSlides(bruto.total);
  if (total === null) return { ok: false, motivo: "total_invalido" };

  if (origem === "labs") {
    const codigo = texto(bruto.codigo);
    if (!codigo || codigo.length > CODIGO_MAX) return { ok: false, motivo: "sem_bonus" };
    const destaque = texto(bruto.destaque);
    if (destaque.length > DESTAQUE_MAX) return { ok: false, motivo: "destaque_longo" };
    return { ok: true, pedido: { origem, codigo, destaque, total, jeito } };
  }

  const tema = texto(bruto.tema);
  if (!tema) return { ok: false, motivo: "tema_vazio" };
  if (tema.length > TEMA_MAX) return { ok: false, motivo: "tema_longo" };
  const palavra = normalizarPalavra(texto(bruto.palavra));
  if (!palavraValida(palavra)) return { ok: false, motivo: "palavra_invalida" };
  const conteudo = texto(bruto.conteudo);
  if (conteudo.length < CONTEUDO_MIN) return { ok: false, motivo: "conteudo_curto" };
  if (conteudo.length > CONTEUDO_MAX) return { ok: false, motivo: "conteudo_longo" };
  return { ok: true, pedido: { origem, tema, palavra, conteudo, total, jeito } };
}

/** O contexto do avulso do Labs: o que o Labs diz do bônus, e o destaque (ou a descrição) para a IA. */
export function contextoDoLabs(b: BonusDoLabs, destaque: string): ContextoDeBonus {
  return { tema: b.tema, titulo: b.titulo, descricao: b.descricao, oQueResolve: destaque || b.descricao };
}

export function contextoLivre(p: { tema: string; conteudo: string }): ContextoLivre {
  return { tipo: "livre", tema: p.tema, conteudo: p.conteudo };
}

/**
 * O TÍTULO INTERNO do carrossel escrito à mão: o campo `titulo` do texto, que a IA escreve quando gera
 * e que dá nome ao carrossel na lista. O do bônus do Labs, ou o tema do texto livre.
 */
export function tituloInterno(c: ContextoDoCarrossel): string {
  return "tipo" in c ? c.tema : c.titulo;
}
```

Crie `lib/bonus/avulso-textos.ts`:

```ts
// AS FRASES DO CARROSSEL AVULSO (spec da Etapa 7), fora do JSX, como as de carrossel-textos.ts: uma
// saída muda é indistinguível de sucesso, e o texto de cada saída vem de função pura, com teste.
import type { Aviso } from "@/lib/avisos";
import { CONTEUDO_MAX, CONTEUDO_MIN, DESTAQUE_MAX, type RecusaDoPedidoAvulso } from "./avulso-pedido";
import { contextoGravado } from "./carrossel-ia-parametros";
import type { LinhaDoCarrossel } from "./carrossel-linha";
import { SLIDES_MAX, SLIDES_MIN } from "./carrossel-pedido";
import { PALAVRA_MAX, PALAVRA_MIN, TEMA_MAX } from "./pedido";

/** A recusa do "Novo carrossel", que volta como estado do formulário (achado 52), e nunca por redirect. */
export type AvisoDoAvulso = Aviso & { em: number };

export function textoDaRecusaDoPedidoAvulso(motivo: RecusaDoPedidoAvulso): string {
  switch (motivo) {
    case "origem_invalida":
      return "Escolha de onde vem o carrossel: um bônus do Labs ou um texto livre.";
    case "jeito_invalido":
      return "Escolha se a IA escreve o texto ou se você escreve à mão.";
    case "total_invalido":
      return `Escolha de ${SLIDES_MIN} a ${SLIDES_MAX} slides.`;
    case "sem_bonus":
      return "Escolha um bônus do Labs.";
    case "destaque_longo":
      return `O que destacar passa de ${DESTAQUE_MAX} caracteres. Resuma.`;
    case "tema_vazio":
      return "Escreva o tema do post.";
    case "tema_longo":
      return `O tema passa de ${TEMA_MAX} caracteres.`;
    case "palavra_invalida":
      return `A palavra-chave é uma palavra só, com letras e números, de ${PALAVRA_MIN} a ${PALAVRA_MAX}.`;
    case "conteudo_curto":
      return `Escreva ou cole o conteúdo do post, com pelo menos ${CONTEUDO_MIN} caracteres.`;
    case "conteudo_longo":
      return `O conteúdo passa de ${CONTEUDO_MAX} caracteres. Resuma.`;
  }
}

/** De onde o carrossel veio, na lista "Carrosséis" e no topo da página do avulso. */
export function textoDaOrigem(l: Pick<LinhaDoCarrossel, "origem" | "contexto">): string {
  if (l.origem === "bonus") return "Bônus do Chat";
  const c = contextoGravado(l.contexto);
  if (l.origem === "labs") return c && !("tipo" in c) ? `Bônus do Labs: ${c.titulo}` : "Bônus do Labs";
  return c && "tipo" in c ? `Texto livre: ${c.tema}` : "Texto livre";
}
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx vitest run tests/bonus-avulso-pedido.test.ts tests/bonus-publicado.test.ts tests/bonus-carrossel-pedido.test.ts
```

Esperado: `tsc` limpo; os 98 passam (73 da fase e os 25 de `bonus-carrossel-pedido`, que provam o total sem mudar).

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/publicado.ts lib/bonus/carrossel-pedido.ts lib/bonus/avulso-pedido.ts lib/bonus/avulso-textos.ts tests/bonus-avulso-pedido.test.ts tests/bonus-publicado.test.ts
test "$(git branch --show-current)" = "carrossel-avulso"
git add lib/bonus/publicado.ts lib/bonus/carrossel-pedido.ts lib/bonus/avulso-pedido.ts lib/bonus/avulso-textos.ts tests/bonus-avulso-pedido.test.ts tests/bonus-publicado.test.ts
git commit -m "feat(bonus): a lista de escolha do Labs e o pedido do carrossel avulso"
```

---

### FASE 7.5 — Criar o carrossel avulso, com o escrito à mão fora do teto, e a lista de todos

**Arquivos:**
- Modificar: `lib/bonus/carrossel-repositorio.ts`
- Testar: `testes-integracao/bonus-carrossel-avulso.integracao.ts`, `testes-integracao/bonus-carrossel-processo.integracao.ts` (sem mudar)

**Interfaces:**
- Consome: `ContextoDoCarrossel` (FASE 7.3); `TextoDoCarrossel`.
- Produz: a contagem do teto com `and not texto_a_mao` (`carrosseisNasUltimas24h` e o pedido);
  `criarCarrosselAvulso({ origem: "labs" | "livre", labsCodigo, total, palavra, contexto, conta,
  texto })`, que devolve `{ ok: true; id }` ou `{ ok: false }` (o teto): com `texto`, nasce pronto,
  marcado à mão, sem a trava; sem ele, nasce pendente, dentro do teto e da trava;
  `listarCarrosseis(limite = 50)`. `criarPedidoDeCarrossel` não muda de assinatura.

- [ ] **Passo 1: o teste**

Crie `testes-integracao/bonus-carrossel-avulso.integracao.ts`:

```ts
// O CARROSSEL AVULSO CONTRA O BANCO DE VERDADE (o container), spec da Etapa 7: ele nasce sem bônus do
// Chat, pela IA (pendente, dentro do teto e da trava) ou escrito à mão (pronto, fora dos dois). A IA é
// sempre um gerador falso: nada sai para a Anthropic.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { ContaGuardada } from "@/lib/bonus/arte-conta";
import type { TextoDeCarrossel } from "@/lib/bonus/carrossel-texto";
import { bancoDescartavel } from "./harness";

type ModuloRepo = typeof import("@/lib/bonus/carrossel-repositorio");
type ModuloProcesso = typeof import("@/lib/bonus/carrossel-processo");

const banco = bancoDescartavel();

const CODIGO = "conselheiro-brutalmente-honesto";
const DO_LABS = {
  tema: "Produtividade",
  titulo: "Conselheiro brutalmente honesto",
  descricao: "Um prompt que critica o seu plano sem dó.",
  oQueResolve: "Mostre o antes e o depois.",
};
const LIVRE = { tipo: "livre" as const, tema: "Produtividade", conteudo: "Um prompt que critica o seu plano sem dó nenhum." };
const THIAGO: ContaGuardada = { conta: "17841400000000001", nome: "Thiago Vannuchi", arroba: "thiagovannuchi" };
const MEDICAO = { modelo: "claude-opus-5-5", tokensEntrada: 1, tokensSaida: 1, cacheCriado: 0, cacheLido: 0 };
const TEXTO: TextoDeCarrossel = {
  tipo: "carrossel",
  titulo: "Conselheiro brutalmente honesto",
  gancho: "Seu plano tem um furo. Você só não quer ver.",
  slides: [
    { titulo: "O que ele faz", texto: "Ele lê o seu plano e aponta o que você está evitando olhar." },
    { titulo: "Como usar", texto: "Cole o plano, peça a crítica e responda às perguntas dele." },
    { titulo: "O que esperar", texto: "Um texto duro, mas com o que fazer em cada ponto fraco." },
  ],
  chamada: "Comente BRUTAL e receba o prompt agora.",
  legenda: "Quer ouvir a verdade sobre o seu plano? Comente BRUTAL que eu te mando o prompt do conselheiro.",
};

let repo: ModuloRepo;
let processo: ModuloProcesso;

beforeAll(async () => {
  repo = await import("@/lib/bonus/carrossel-repositorio");
  processo = await import("@/lib/bonus/carrossel-processo");
});

beforeEach(async () => {
  await banco.db().sql().query(`delete from carrosseis_gerados`);
  await banco.db().sql().query(`delete from bonus_gerados`);
});

type PedidoAvulso = Parameters<ModuloRepo["criarCarrosselAvulso"]>[0];
const doLabs = (troca: Partial<PedidoAvulso> = {}): PedidoAvulso => ({
  origem: "labs",
  labsCodigo: CODIGO,
  total: 5,
  palavra: "BRUTAL",
  contexto: DO_LABS,
  conta: null,
  texto: null,
  ...troca,
});
const livre = (troca: Partial<PedidoAvulso> = {}): PedidoAvulso => ({
  origem: "livre",
  labsCodigo: null,
  total: 5,
  palavra: "BRUTAL",
  contexto: LIVRE,
  conta: null,
  texto: null,
  ...troca,
});

async function criado(p: PedidoAvulso): Promise<string> {
  const r = await repo.criarCarrosselAvulso(p);
  if (!r.ok) throw new Error("teto no meio do teste: o beforeEach devia ter limpado a tabela");
  return r.id;
}

describe("criar o carrossel avulso", () => {
  it("do Labs, pela IA: nasce pendente, sem bônus, com o código, a palavra, o contexto e a conta", async () => {
    const l = await repo.lerCarrossel(await criado(doLabs({ conta: THIAGO })));
    expect(l).toMatchObject({
      origem: "labs",
      bonus_id: null,
      labs_codigo: CODIGO,
      estado: "pendente",
      texto_a_mao: false,
      palavra: "BRUTAL",
      total_slides: 5,
      contexto: DO_LABS,
      arte: THIAGO,
      gerado: null,
    });
  });

  it("do texto livre, pela IA: sem bônus e sem código, e sem conta a arte nasce vazia", async () => {
    const l = await repo.lerCarrossel(await criado(livre()));
    expect(l).toMatchObject({ origem: "livre", bonus_id: null, labs_codigo: null, estado: "pendente", contexto: LIVRE, arte: {} });
  });

  it("escrito à mão: nasce pronto, com o texto e a hora, sem medição de IA, e marcado à mão", async () => {
    const l = await repo.lerCarrossel(await criado(livre({ texto: TEXTO, conta: THIAGO })));
    expect(l).toMatchObject({ origem: "livre", estado: "pronto", gerado: TEXTO, medicao: null, texto_a_mao: true, arte: THIAGO });
    expect(l?.gerado_em).toBeInstanceOf(Date);
  });

  it("a IA recebe o contexto do texto livre que a linha guardou", async () => {
    const id = await criado(livre());
    let recebido: unknown = null;
    await processo.processarCarrossel(id, async (p) => {
      recebido = p;
      return { ok: true as const, texto: { ...TEXTO, slides: TEXTO.slides }, medicao: MEDICAO };
    });
    expect(recebido).toEqual({ total: 5, palavra: "BRUTAL", contexto: LIVRE });
    expect((await repo.lerCarrossel(id))?.estado).toBe("pronto");
  });
});

// O TETO CONTA SÓ O QUE PEDIU A IA (spec da Etapa 7, "O teto"): as duas contagens, a da tela e a do
// pedido, dentro da trava. O escrito à mão não gasta IA, e não passa pela trava.
describe("o teto e o escrito à mão", () => {
  it("com 10 da IA no dia, o avulso pela IA é recusado, e o escrito à mão entra", async () => {
    for (let i = 0; i < 10; i++) await criado(doLabs());
    expect((await repo.criarCarrosselAvulso(livre())).ok).toBe(false);
    expect((await repo.criarCarrosselAvulso(livre({ texto: TEXTO }))).ok).toBe(true);
    expect(await repo.carrosseisNasUltimas24h()).toBe(10);
  });

  it("o pedido de carrossel de bônus também não conta o escrito à mão", async () => {
    for (let i = 0; i < 10; i++) await criado(livre({ texto: TEXTO }));
    expect(await repo.carrosseisNasUltimas24h()).toBe(0);
    const [b] = (await banco
      .db()
      .sql()
      .query(`insert into bonus_gerados (tema, o_que_resolve) values ('Vendas', 'um pedido de teste com mais de vinte letras') returning id`)) as {
      id: string;
    }[];
    const r = await repo.criarPedidoDeCarrossel({ bonusId: b.id, total: 5, palavra: "SUMIDO", contexto: DO_LABS, conta: null });
    expect(r.ok).toBe(true);
    expect(await repo.carrosseisNasUltimas24h()).toBe(1);
  });

  // O MOLDE DO TESTE DO TETO DA ETAPA 2 (bonus-carrossel-processo.integracao.ts): uma transação do teste
  // segura a trava. O avulso pela IA espera por ela; o escrito à mão não a pede, e termina antes.
  async function comATravaPresa<T>(linhasNaTrava: number, enquanto: () => Promise<T>): Promise<{ venceu: unknown; resultado: Promise<T> }> {
    let soltar!: () => void;
    const segurando = new Promise<void>((f) => (soltar = f));
    let travou!: () => void;
    const travado = new Promise<void>((f) => (travou = f));
    const transacao = banco
      .db()
      .sql()
      .begin(async (tx) => {
        await tx.query(`select pg_advisory_xact_lock($1::bigint)`, [repo.TRAVA_DO_TETO_DO_CARROSSEL]);
        for (let i = 0; i < linhasNaTrava; i++) {
          await tx.query(`insert into carrosseis_gerados (origem, total_slides, palavra, contexto) values ('livre', 5, 'BRUTAL', '{}'::jsonb)`);
        }
        travou();
        await segurando;
      });
    await travado;
    let resultado!: Promise<T>;
    let venceu: unknown;
    try {
      resultado = enquanto();
      venceu = await Promise.race([resultado.then(() => "pedido"), new Promise((f) => setTimeout(() => f("relogio"), 300))]);
    } finally {
      // Solta a trava antes de qualquer `expect` (a lição do teste do teto da Etapa 2).
      soltar();
      await transacao;
    }
    return { venceu, resultado };
  }

  it("o avulso pela IA espera a trava do teto: contar e inserir não correm em paralelo", async () => {
    const { venceu, resultado } = await comATravaPresa(10, () => repo.criarCarrosselAvulso(livre()));
    expect(venceu).toBe("relogio");
    expect((await resultado).ok).toBe(false);
  });

  it("o escrito à mão não pede a trava do teto", async () => {
    const { venceu, resultado } = await comATravaPresa(0, () => repo.criarCarrosselAvulso(livre({ texto: TEXTO })));
    expect(venceu).toBe("pedido");
    expect((await resultado).ok).toBe(true);
  });
});

describe("a lista de todos os carrosséis", () => {
  it("traz os de bônus e os avulsos, do mais novo para o mais velho", async () => {
    const [b] = (await banco
      .db()
      .sql()
      .query(`insert into bonus_gerados (tema, o_que_resolve) values ('Vendas', 'um pedido de teste com mais de vinte letras') returning id`)) as {
      id: string;
    }[];
    const r = await repo.criarPedidoDeCarrossel({ bonusId: b.id, total: 5, palavra: "SUMIDO", contexto: DO_LABS, conta: null });
    if (!r.ok) throw new Error("teto no meio do teste");
    const doLabsId = await criado(doLabs());
    const livreId = await criado(livre({ texto: TEXTO }));
    await banco.db().sql().query(`update carrosseis_gerados set criado_em = now() - interval '1 minute' where id = $1`, [r.id]);
    await banco.db().sql().query(`update carrosseis_gerados set criado_em = now() - interval '30 seconds' where id = $1`, [doLabsId]);
    const lista = await repo.listarCarrosseis();
    expect(lista.map((l) => [l.id, l.origem])).toEqual([
      [livreId, "livre"],
      [doLabsId, "labs"],
      [r.id, "bonus"],
    ]);
  });
});
```

- [ ] **Passo 2: ver falhar**

```bash
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-carrossel-avulso.integracao.ts testes-integracao/bonus-carrossel-processo.integracao.ts
```

Esperado: `[rede-global] ALVO: banco de TESTE`; os 9 novos caem; os 22 da Etapa 2 passam.

- [ ] **Passo 3: o código**

Em `lib/bonus/carrossel-repositorio.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/carrossel-repositorio.ts b/lib/bonus/carrossel-repositorio.ts
index aeb507e..29b5925 100644
--- a/lib/bonus/carrossel-repositorio.ts
+++ b/lib/bonus/carrossel-repositorio.ts
@@ -22,13 +22,21 @@ import { estadoDaPublicacaoNa } from "./publicar-repositorio";
  */
 export const TRAVA_DO_TETO_DO_CARROSSEL = 2026093001;
 
+/**
+ * O QUE O TETO CONTA: os pedidos das últimas 24 horas que chamaram a IA. O escrito à mão (Etapa 7)
+ * não gasta IA, e fica fora. A tela e o pedido contam pela mesma consulta.
+ */
+const CONTAGEM_DO_TETO = `select count(*)::int as n from carrosseis_gerados
+  where criado_em > now() - interval '24 hours' and not texto_a_mao`;
+
 export async function carrosseisNasUltimas24h(): Promise<number> {
-  const [linha] = (await sql().query(
-    `select count(*)::int as n from carrosseis_gerados where criado_em > now() - interval '24 hours'`
-  )) as { n: number }[];
+  const [linha] = (await sql().query(CONTAGEM_DO_TETO)) as { n: number }[];
   return linha?.n ?? 0;
 }
 
+/** A transação: só `query`, como lib/db.ts a entrega. */
+type Transacao = { query: (texto: string, params?: unknown[]) => Promise<unknown[]> };
+
 /** A conta como a coluna `arte` a guarda: sem as chaves vazias. */
 function chavesDaConta(c: Partial<ContaGuardada> | null): Record<string, string> {
   return Object.fromEntries(Object.entries(c ?? {}).filter(([, v]) => typeof v === "string" && v !== "")) as Record<
@@ -38,9 +46,22 @@ function chavesDaConta(c: Partial<ContaGuardada> | null): Record<string, string>
 }
 
 /**
- * CONTAR E INSERIR NA MESMA TRANSAÇÃO, COM TRAVA: dois cliques com 9 no dia não fazem 11.
- * `conta` é a conta do carrossel, com o nome e o @, gravada no pedido (spec da Etapa 4): o
- * carrossel é dela, e nunca vira de outra. Sem conta, a arte nasce `{}`.
+ * CONTAR E INSERIR NA MESMA TRANSAÇÃO, COM TRAVA: dois cliques com 9 no dia não fazem 11. Serve ao
+ * pedido de bônus e ao avulso pela IA; `inserir` grava a linha e devolve o id.
+ */
+async function comTeto(inserir: (tx: Transacao) => Promise<string>): Promise<{ ok: true; id: string } | { ok: false }> {
+  return sql().begin(async (tx) => {
+    await tx.query(`select pg_advisory_xact_lock($1::bigint)`, [TRAVA_DO_TETO_DO_CARROSSEL]);
+    const [contagem] = (await tx.query(CONTAGEM_DO_TETO)) as { n: number }[];
+    if ((contagem?.n ?? 0) >= TETO_CARROSSEL_DIARIO) return { ok: false as const };
+    return { ok: true as const, id: await inserir(tx) };
+  });
+}
+
+/**
+ * O PEDIDO DE CARROSSEL DE UM BÔNUS DO CHAT, dentro do teto. `conta` é a conta do carrossel, com o
+ * nome e o @, gravada no pedido (spec da Etapa 4): o carrossel é dela, e nunca vira de outra. Sem
+ * conta, a arte nasce `{}`.
  */
 export async function criarPedidoDeCarrossel(p: {
   bonusId: string;
@@ -49,18 +70,48 @@ export async function criarPedidoDeCarrossel(p: {
   contexto: ContextoDoCarrossel;
   conta: ContaGuardada | null;
 }): Promise<{ ok: true; id: string } | { ok: false }> {
-  return sql().begin(async (tx) => {
-    await tx.query(`select pg_advisory_xact_lock($1::bigint)`, [TRAVA_DO_TETO_DO_CARROSSEL]);
-    const [contagem] = (await tx.query(
-      `select count(*)::int as n from carrosseis_gerados where criado_em > now() - interval '24 hours'`
-    )) as { n: number }[];
-    if ((contagem?.n ?? 0) >= TETO_CARROSSEL_DIARIO) return { ok: false as const };
+  return comTeto(async (tx) => {
     const [criada] = (await tx.query(
       `insert into carrosseis_gerados (bonus_id, total_slides, palavra, contexto, arte)
        values ($1, $2, $3, $4::jsonb, $5::jsonb) returning id`,
       [p.bonusId, p.total, p.palavra, p.contexto, p.conta?.conta ? chavesDaConta(p.conta) : {}]
     )) as { id: string }[];
-    return { ok: true as const, id: criada.id };
+    return criada.id;
+  });
+}
+
+/**
+ * O CARROSSEL AVULSO (spec da Etapa 7): de um bônus do Labs (`labsCodigo`) ou de um texto livre, sem
+ * bônus do Chat. Pela IA, ele nasce pendente, dentro do teto e com a mesma trava do pedido de bônus.
+ * Escrito à mão (`texto`, já conferido por quem chama), ele nasce pronto, marcado à mão, e fica fora
+ * do teto e da trava: não gasta IA. A conta é gravada como no pedido de bônus. O banco recusa a
+ * origem que não combina com o código (migrations/016-carrossel-avulso.sql).
+ */
+export async function criarCarrosselAvulso(p: {
+  origem: "labs" | "livre";
+  labsCodigo: string | null;
+  total: number;
+  palavra: string;
+  contexto: ContextoDoCarrossel;
+  conta: ContaGuardada | null;
+  texto: TextoDoCarrossel | null;
+}): Promise<{ ok: true; id: string } | { ok: false }> {
+  const arte = p.conta?.conta ? chavesDaConta(p.conta) : {};
+  if (p.texto) {
+    const [criada] = (await sql().query(
+      `insert into carrosseis_gerados (origem, labs_codigo, total_slides, palavra, contexto, arte, estado, gerado, gerado_em, texto_a_mao)
+       values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, 'pronto', $7::jsonb, now(), true) returning id`,
+      [p.origem, p.labsCodigo, p.total, p.palavra, p.contexto, arte, p.texto]
+    )) as { id: string }[];
+    return { ok: true, id: criada.id };
+  }
+  return comTeto(async (tx) => {
+    const [criada] = (await tx.query(
+      `insert into carrosseis_gerados (origem, labs_codigo, total_slides, palavra, contexto, arte)
+       values ($1, $2, $3, $4, $5::jsonb, $6::jsonb) returning id`,
+      [p.origem, p.labsCodigo, p.total, p.palavra, p.contexto, arte]
+    )) as { id: string }[];
+    return criada.id;
   });
 }
 
@@ -105,6 +156,11 @@ export async function listarCarrosseisDoBonus(bonusId: string): Promise<LinhaDoC
   )) as LinhaDoCarrossel[];
 }
 
+/** Todos os carrosséis, os de bônus e os avulsos, do mais novo para o mais velho (o menu "Carrosséis"). */
+export async function listarCarrosseis(limite = 50): Promise<LinhaDoCarrossel[]> {
+  return (await sql().query(`select * from carrosseis_gerados order by criado_em desc limit $1`, [limite])) as LinhaDoCarrossel[];
+}
+
 /**
  * SALVAR UMA PARTE (um slide, ou a legenda) NUMA TRANSAÇÃO, COM A LINHA TRAVADA (spec da Etapa 4):
  * lê o texto salvo (o revisado, ou o gerado) DEPOIS de travar a linha, junta a parte
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-carrossel-avulso.integracao.ts testes-integracao/bonus-carrossel-processo.integracao.ts
```

Esperado: `tsc` limpo; `[rede-global] ALVO: banco de TESTE`, e os 31 passam (9 novos e 22 da Etapa 2).

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/carrossel-repositorio.ts testes-integracao/bonus-carrossel-avulso.integracao.ts
test "$(git branch --show-current)" = "carrossel-avulso"
git add lib/bonus/carrossel-repositorio.ts testes-integracao/bonus-carrossel-avulso.integracao.ts
git commit -m "feat(bonus): criar o carrossel avulso, com o escrito à mão fora do teto, e a lista de todos"
```

---

### FASE 7.6 — O processo do carrossel avulso, do pedido ao "Gerar de novo"

**Arquivos:**
- Criar: `lib/bonus/avulso-processo.ts`
- Testar: `testes-integracao/bonus-avulso-processo.integracao.ts`

**Interfaces:**
- Consome: as FASES 7.3 a 7.5; `lerRevisaoDoCarrossel` (Etapa 2); `quadroDaSituacao`,
  `textoDoTetoDoCarrossel`, `textoDosProblemasDoCarrossel`, `TEXTO_NAO_DA_PARA_GERAR_CARROSSEL_DE_NOVO`
  (`carrossel-textos.ts`); `geracaoNaTela` (`tempos.ts`).
- Produz: `type LerSituacao = (codigo) => Promise<SituacaoNoLabs>`; `TEXTO_AVULSO_SEM_CONTEXTO`;
  `pedirAvulso({ pedido, bruto, conta, lerSituacao })`, que devolve `{ ok: true; id; gerar }` ou `{
  ok: false; texto }`; `gerarAvulsoDeNovo({ linha, conta, lerSituacao, agora })`, que devolve `{ ok:
  true; id }` ou `{ ok: false; texto }`.

- [ ] **Passo 1: o teste**

Crie `testes-integracao/bonus-avulso-processo.integracao.ts`:

```ts
// O PROCESSO DO CARROSSEL AVULSO CONTRA O BANCO DE VERDADE (o container), spec da Etapa 7: o pedido
// lido, a situação do bônus no Labs (sempre uma falsa: nada sai para o Labs), o texto escrito à mão
// conferido, e o "Gerar de novo". As actions só conferem a sessão e chamam isto; o harness não forja
// sessão, então o caminho com sessão se prova aqui.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { ContaGuardada } from "@/lib/bonus/arte-conta";
import type { PedidoAvulso } from "@/lib/bonus/avulso-pedido";
import type { SituacaoNoLabs } from "@/lib/bonus/publicado";
import { bancoDescartavel } from "./harness";

type ModuloProcesso = typeof import("@/lib/bonus/avulso-processo");
type ModuloRepo = typeof import("@/lib/bonus/carrossel-repositorio");

const banco = bancoDescartavel();

const CODIGO = "conselheiro-brutalmente-honesto";
const NO_LABS = {
  palavra: "BRUTAL",
  titulo: "Conselheiro brutalmente honesto",
  descricao: "Um prompt que critica o seu plano sem dó.",
  tema: "Produtividade",
};
const publicado = (troca: Partial<typeof NO_LABS> = {}): SituacaoNoLabs => ({ tipo: "publicado", bonus: { ...NO_LABS, ...troca } });
const THIAGO: ContaGuardada = { conta: "17841400000000001", nome: "Thiago Vannuchi", arroba: "thiagovannuchi" };

/** Os campos do carrossel de 5 slides escritos à mão, na forma que o formulário manda. */
const A_MAO = {
  gancho: "Seu plano tem um furo. Você só não quer ver.",
  slide_1_titulo: "O que ele faz",
  slide_1_texto: "Ele lê o seu plano e aponta o que você está evitando olhar.",
  slide_2_titulo: "Como usar",
  slide_2_texto: "Cole o plano, peça a crítica e responda às perguntas dele.",
  slide_3_titulo: "O que esperar",
  slide_3_texto: "Um texto duro, mas com o que fazer em cada ponto fraco.",
  chamada: "Comente BRUTAL e receba o prompt agora.",
  legenda: "Quer ouvir a verdade sobre o seu plano? Comente BRUTAL que eu te mando o prompt do conselheiro.",
};

const doLabs = (troca: Partial<Extract<PedidoAvulso, { origem: "labs" }>> = {}): PedidoAvulso => ({
  origem: "labs",
  codigo: CODIGO,
  destaque: "Mostre o antes e o depois.",
  total: 5,
  jeito: "ia",
  ...troca,
});
const livre = (troca: Partial<Extract<PedidoAvulso, { origem: "livre" }>> = {}): PedidoAvulso => ({
  origem: "livre",
  tema: "Produtividade",
  palavra: "BRUTAL",
  conteudo: "Um prompt que critica o seu plano sem dó nenhum.",
  total: 5,
  jeito: "ia",
  ...troca,
});

let processo: ModuloProcesso;
let repo: ModuloRepo;

beforeAll(async () => {
  processo = await import("@/lib/bonus/avulso-processo");
  repo = await import("@/lib/bonus/carrossel-repositorio");
});

beforeEach(async () => {
  await banco.db().sql().query(`delete from carrosseis_gerados`);
});

async function contar(): Promise<number> {
  const [{ n }] = (await banco.db().sql().query(`select count(*)::int as n from carrosseis_gerados`)) as { n: number }[];
  return n;
}

/** Quem lê a situação no Labs, falso, e o que ele foi perguntado. */
function labs(situacao: SituacaoNoLabs) {
  const perguntados: string[] = [];
  return {
    perguntados,
    lerSituacao: async (codigo: string) => {
      perguntados.push(codigo);
      return situacao;
    },
  };
}

describe("pedir o carrossel avulso", () => {
  it("do Labs, pela IA: a palavra e o contexto vêm do Labs, com o destaque, e a geração é pedida", async () => {
    const l = labs(publicado());
    const r = await processo.pedirAvulso({ pedido: doLabs(), bruto: {}, conta: THIAGO, lerSituacao: l.lerSituacao });
    expect(l.perguntados).toEqual([CODIGO]);
    if (!r.ok) throw new Error(r.texto);
    expect(r.gerar).toBe(true);
    expect(await repo.lerCarrossel(r.id)).toMatchObject({
      origem: "labs",
      labs_codigo: CODIGO,
      palavra: "BRUTAL",
      estado: "pendente",
      contexto: { tema: "Produtividade", titulo: NO_LABS.titulo, descricao: NO_LABS.descricao, oQueResolve: "Mostre o antes e o depois." },
      arte: THIAGO,
    });
  });

  it.each([
    ["despublicado", { tipo: "nao_publicado" } as SituacaoNoLabs, "Criado no Labs como oculto"],
    ["com a palavra fora do padrão", { tipo: "palavra_fora_do_padrao", palavra: "SEM-DOR" } as SituacaoNoLabs, "SEM-DOR"],
    ["sem resposta", { tipo: "sem_resposta" } as SituacaoNoLabs, "Não consegui consultar o Labs"],
  ])("o bônus do Labs %s é recusado com a frase, sem gravar nada", async (_nome, situacao, frase) => {
    const r = await processo.pedirAvulso({ pedido: doLabs(), bruto: {}, conta: null, lerSituacao: labs(situacao).lerSituacao });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.texto).toContain(frase);
    expect(await contar()).toBe(0);
  });

  it("do texto livre, pela IA: o tema, o conteúdo e a palavra do formulário, sem perguntar ao Labs", async () => {
    const l = labs(publicado());
    const r = await processo.pedirAvulso({ pedido: livre(), bruto: {}, conta: null, lerSituacao: l.lerSituacao });
    expect(l.perguntados).toEqual([]);
    if (!r.ok) throw new Error(r.texto);
    expect(r.gerar).toBe(true);
    expect(await repo.lerCarrossel(r.id)).toMatchObject({
      origem: "livre",
      labs_codigo: null,
      palavra: "BRUTAL",
      contexto: { tipo: "livre", tema: "Produtividade", conteudo: "Um prompt que critica o seu plano sem dó nenhum." },
    });
  });

  it("escrito à mão, do texto livre: nasce pronto com o texto, o título é o tema, e a geração não é pedida", async () => {
    const r = await processo.pedirAvulso({ pedido: livre({ jeito: "mao" }), bruto: A_MAO, conta: null, lerSituacao: labs(publicado()).lerSituacao });
    if (!r.ok) throw new Error(r.texto);
    expect(r.gerar).toBe(false);
    const l = await repo.lerCarrossel(r.id);
    expect(l).toMatchObject({ estado: "pronto", texto_a_mao: true });
    expect(l?.gerado).toMatchObject({ tipo: "carrossel", titulo: "Produtividade", gancho: A_MAO.gancho, chamada: A_MAO.chamada });
  });

  it("escrito à mão, do Labs: o título é o do bônus, e a palavra conferida é a do Labs", async () => {
    const r = await processo.pedirAvulso({ pedido: doLabs({ jeito: "mao" }), bruto: A_MAO, conta: null, lerSituacao: labs(publicado()).lerSituacao });
    if (!r.ok) throw new Error(r.texto);
    expect((await repo.lerCarrossel(r.id))?.gerado).toMatchObject({ titulo: NO_LABS.titulo });

    const outra = await processo.pedirAvulso({
      pedido: doLabs({ jeito: "mao" }),
      bruto: A_MAO,
      conta: null,
      lerSituacao: labs(publicado({ palavra: "CONSELHO" })).lerSituacao,
    });
    expect(!outra.ok && outra.texto).toContain("precisa pedir a palavra CONSELHO");
  });

  it("o escrito à mão com problema é recusado com o campo e o motivo, sem gravar nada", async () => {
    const r = await processo.pedirAvulso({
      pedido: livre({ jeito: "mao" }),
      bruto: { ...A_MAO, chamada: "Comente e receba o prompt agora mesmo.", gancho: "curto" },
      conta: null,
      lerSituacao: labs(publicado()).lerSituacao,
    });
    expect(r).toEqual({
      ok: false,
      texto: "Corrija antes de criar. Gancho (slide 1): precisa de pelo menos 15 caracteres. Chamada (slide 5): precisa pedir a palavra BRUTAL.",
    });
    expect(await contar()).toBe(0);
  });

  it("com o teto cheio, o da IA é recusado com a frase do teto, e o escrito à mão entra", async () => {
    for (let i = 0; i < 10; i++) {
      const r = await processo.pedirAvulso({ pedido: livre(), bruto: {}, conta: null, lerSituacao: labs(publicado()).lerSituacao });
      expect(r.ok).toBe(true);
    }
    const ia = await processo.pedirAvulso({ pedido: livre(), bruto: {}, conta: null, lerSituacao: labs(publicado()).lerSituacao });
    expect(!ia.ok && ia.texto).toContain("que é o limite");
    const aMao = await processo.pedirAvulso({ pedido: livre({ jeito: "mao" }), bruto: A_MAO, conta: null, lerSituacao: labs(publicado()).lerSituacao });
    expect(aMao.ok).toBe(true);
  });
});

describe("gerar de novo o carrossel avulso", () => {
  const AGORA = () => Date.now();

  async function falhou(pedido: PedidoAvulso, situacao = publicado()): Promise<string> {
    const r = await processo.pedirAvulso({ pedido, bruto: {}, conta: THIAGO, lerSituacao: labs(situacao).lerSituacao });
    if (!r.ok) throw new Error(r.texto);
    await banco.db().sql().query(`update carrosseis_gerados set estado = 'falhou', erro = 'A API recusou.' where id = $1`, [r.id]);
    return r.id;
  }

  it("o do texto livre reaproveita o tema, o conteúdo, a palavra e o total gravados", async () => {
    const id = await falhou(livre({ total: 4 }));
    const l = labs(publicado());
    const r = await processo.gerarAvulsoDeNovo({ linha: (await repo.lerCarrossel(id))!, conta: THIAGO, lerSituacao: l.lerSituacao, agora: AGORA() });
    expect(l.perguntados).toEqual([]);
    if (!r.ok) throw new Error(r.texto);
    expect(r.id).not.toBe(id);
    expect(await repo.lerCarrossel(r.id)).toMatchObject({
      origem: "livre",
      estado: "pendente",
      total_slides: 4,
      palavra: "BRUTAL",
      contexto: { tipo: "livre", tema: "Produtividade", conteudo: "Um prompt que critica o seu plano sem dó nenhum." },
      arte: THIAGO,
    });
  });

  it("o do Labs relê o Labs pelo código, com a palavra de agora, e mantém o destaque", async () => {
    const id = await falhou(doLabs());
    const l = labs(publicado({ palavra: "CONSELHO" }));
    const r = await processo.gerarAvulsoDeNovo({ linha: (await repo.lerCarrossel(id))!, conta: null, lerSituacao: l.lerSituacao, agora: AGORA() });
    expect(l.perguntados).toEqual([CODIGO]);
    if (!r.ok) throw new Error(r.texto);
    expect(await repo.lerCarrossel(r.id)).toMatchObject({
      origem: "labs",
      labs_codigo: CODIGO,
      palavra: "CONSELHO",
      contexto: { oQueResolve: "Mostre o antes e o depois." },
    });
  });

  it("o do Labs que saiu do ar é recusado com a frase, sem gravar nada", async () => {
    const id = await falhou(doLabs());
    const r = await processo.gerarAvulsoDeNovo({
      linha: (await repo.lerCarrossel(id))!,
      conta: null,
      lerSituacao: labs({ tipo: "nao_publicado" }).lerSituacao,
      agora: AGORA(),
    });
    expect(!r.ok && r.texto).toContain("Criado no Labs como oculto");
    expect(await contar()).toBe(1);
  });

  it("só o que falhou ou travou gera de novo", async () => {
    const r = await processo.pedirAvulso({ pedido: livre(), bruto: {}, conta: null, lerSituacao: labs(publicado()).lerSituacao });
    if (!r.ok) throw new Error(r.texto);
    const novo = await processo.gerarAvulsoDeNovo({
      linha: (await repo.lerCarrossel(r.id))!,
      conta: null,
      lerSituacao: labs(publicado()).lerSituacao,
      agora: AGORA(),
    });
    expect(!novo.ok && novo.texto).toBe("Só dá para gerar de novo um carrossel cuja geração falhou ou travou.");
    expect(await contar()).toBe(1);
  });
});
```

- [ ] **Passo 2: ver falhar**

```bash
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-avulso-processo.integracao.ts
```

Esperado: `[rede-global] ALVO: banco de TESTE`; os 13 pulam, porque o processo não existe.

- [ ] **Passo 3: o código**

Crie `lib/bonus/avulso-processo.ts`:

```ts
import "server-only";
import type { ContaGuardada } from "./arte-conta";
import { contextoDoLabs, contextoLivre, tituloInterno, type PedidoAvulso } from "./avulso-pedido";
import { contextoGravado, type ContextoDoCarrossel } from "./carrossel-ia-parametros";
import type { LinhaDoCarrossel } from "./carrossel-linha";
import { criarCarrosselAvulso } from "./carrossel-repositorio";
import { lerRevisaoDoCarrossel, type TextoDoCarrossel } from "./carrossel-texto";
import {
  TEXTO_NAO_DA_PARA_GERAR_CARROSSEL_DE_NOVO,
  quadroDaSituacao,
  textoDoTetoDoCarrossel,
  textoDosProblemasDoCarrossel,
} from "./carrossel-textos";
import type { SituacaoNoLabs } from "./publicado";
import { geracaoNaTela } from "./tempos";

// O CARROSSEL AVULSO DE PONTA A PONTA (spec da Etapa 7), fora da action: as actions só conferem a
// sessão, leem o formulário e chamam isto, e o harness da integração (que não forja sessão) prova o
// caminho daqui para baixo. As decisões moram nas funções puras (avulso-pedido.ts); aqui se costura a
// ordem: o Labs, o texto à mão, o teto e a linha.

/** Quem lê a situação de um bônus no Labs: `situacaoNoLabs` com a LABS_URL; o teste passa uma falsa. */
export type LerSituacao = (codigo: string) => Promise<SituacaoNoLabs>;

export const TEXTO_AVULSO_SEM_CONTEXTO =
  "O pedido deste carrossel foi gravado sem o tema e o conteúdo. Crie outro em Novo carrossel.";

type Recusa = { ok: false; texto: string };

/**
 * A palavra e o contexto do bônus do Labs, lidos agora pelo código, e nunca do formulário: só um
 * bônus "publicado", com palavra e tema no formato que o Chat usa, passa (`situacaoNaLista`).
 */
async function doLabs(
  codigo: string,
  oQueResolve: string,
  lerSituacao: LerSituacao
): Promise<{ ok: true; palavra: string; contexto: ContextoDoCarrossel } | Recusa> {
  const s = await lerSituacao(codigo);
  if (s.tipo !== "publicado") return { ok: false, texto: quadroDaSituacao(s).texto };
  return { ok: true, palavra: s.bonus.palavra, contexto: contextoDoLabs({ codigo, ...s.bonus }, oQueResolve) };
}

/**
 * O PEDIDO DO AVULSO, já lido (`lerPedidoAvulso`). Do Labs, a palavra e o contexto vêm de lá; do texto
 * livre, do formulário. Escrito à mão, `bruto` são os campos do carrossel, conferidos inteiros contra
 * a palavra (`lerRevisaoDoCarrossel`, a conferência da Etapa 2), e o carrossel nasce pronto. Pela IA,
 * ele nasce pendente e quem chama dispara a geração (`gerar`). A conta é a logada, que a action lê
 * do cookie.
 */
export async function pedirAvulso(p: {
  pedido: PedidoAvulso;
  bruto: Record<string, unknown>;
  conta: ContaGuardada | null;
  lerSituacao: LerSituacao;
}): Promise<{ ok: true; id: string; gerar: boolean } | Recusa> {
  const { pedido } = p;
  const origem =
    pedido.origem === "labs"
      ? await doLabs(pedido.codigo, pedido.destaque, p.lerSituacao)
      : { ok: true as const, palavra: pedido.palavra, contexto: contextoLivre(pedido) };
  if (!origem.ok) return origem;

  let texto: TextoDoCarrossel | null = null;
  if (pedido.jeito === "mao") {
    const lido = lerRevisaoDoCarrossel(pedido.total, origem.palavra, tituloInterno(origem.contexto), p.bruto);
    if (!lido.ok) return { ok: false, texto: `Corrija antes de criar. ${textoDosProblemasDoCarrossel(pedido.total, lido.problemas)}` };
    texto = lido.texto;
  }

  const criado = await criarCarrosselAvulso({
    origem: pedido.origem,
    labsCodigo: pedido.origem === "labs" ? pedido.codigo : null,
    total: pedido.total,
    palavra: origem.palavra,
    contexto: origem.contexto,
    conta: p.conta,
    texto,
  });
  if (!criado.ok) return { ok: false, texto: textoDoTetoDoCarrossel() };
  return { ok: true, id: criado.id, gerar: texto === null };
}

/**
 * O "GERAR DE NOVO" DO AVULSO: um carrossel novo, da mesma origem e com o mesmo total, a partir do que
 * falhou ou travou. O do Labs relê o Labs pelo código, como o de bônus faz (`gerarCarrosselDeNovo`), e
 * mantém o destaque gravado; o do texto livre reaproveita o tema, o conteúdo e a palavra gravados,
 * porque não há outro lugar de onde lê-los. A conta é a do original (`contaParaGerarDeNovo`, na action).
 */
export async function gerarAvulsoDeNovo(p: {
  linha: LinhaDoCarrossel;
  conta: ContaGuardada | null;
  lerSituacao: LerSituacao;
  agora: number;
}): Promise<{ ok: true; id: string } | Recusa> {
  const { linha } = p;
  const naTela = geracaoNaTela(linha.estado, linha.criado_em, p.agora);
  if (naTela !== "falhou" && naTela !== "travou") return { ok: false, texto: TEXTO_NAO_DA_PARA_GERAR_CARROSSEL_DE_NOVO };

  const gravado = contextoGravado(linha.contexto);
  let origem: { ok: true; palavra: string; contexto: ContextoDoCarrossel } | Recusa;
  if (linha.origem === "labs" && linha.labs_codigo) {
    const destaque = gravado && !("tipo" in gravado) ? gravado.oQueResolve : "";
    origem = await doLabs(linha.labs_codigo, destaque, p.lerSituacao);
  } else if (linha.origem === "livre" && gravado && "tipo" in gravado) {
    origem = { ok: true, palavra: linha.palavra, contexto: gravado };
  } else {
    origem = { ok: false, texto: TEXTO_AVULSO_SEM_CONTEXTO };
  }
  if (!origem.ok) return origem;

  const criado = await criarCarrosselAvulso({
    origem: linha.origem === "labs" ? "labs" : "livre",
    labsCodigo: linha.origem === "labs" ? linha.labs_codigo : null,
    total: linha.total_slides,
    palavra: origem.palavra,
    contexto: origem.contexto,
    conta: p.conta,
    texto: null,
  });
  return criado.ok ? { ok: true, id: criado.id } : { ok: false, texto: textoDoTetoDoCarrossel() };
}
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-avulso-processo.integracao.ts
```

Esperado: `tsc` limpo; `[rede-global] ALVO: banco de TESTE`, e os 13 passam.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/avulso-processo.ts testes-integracao/bonus-avulso-processo.integracao.ts
test "$(git branch --show-current)" = "carrossel-avulso"
git add lib/bonus/avulso-processo.ts testes-integracao/bonus-avulso-processo.integracao.ts
git commit -m "feat(bonus): o processo do carrossel avulso, do pedido ao Gerar de novo"
```

---

### FASE 7.7 — As actions do carrossel avulso, com a sessão conferida

**Arquivos:**
- Criar: `app/carrosseis/actions.ts`
- Testar: `tests/bonus-avulso-paginas.test.ts`, `testes-integracao/bonus-avulso-acoes.integracao.ts`

**Interfaces:**
- Consome: `lerPedidoAvulso` (FASE 7.4); `pedirAvulso`, `gerarAvulsoDeNovo` (FASE 7.6);
  `situacaoNoLabs`; `processarCarrossel`; `contaParaGuardar`, `contaParaGerarDeNovo`,
  `contaSelecionada` (Etapa 4).
- Produz (`"use server"`, cada uma começa por `await exigirSessao();`):
  `pedirCarrosselAvulso(anterior, form): Promise<AvisoDoAvulso | null>` (a recusa volta como estado;
  o criado vai para `/carrosseis/<id>`, e o da IA dispara a geração no `after()`);
  `gerarAvulsoDeNovo(form): Promise<void>`.

- [ ] **Passo 1: os testes**

Crie `tests/bonus-avulso-paginas.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// AS GUARDAS DO CARROSSEL AVULSO que nenhum tipo pega (spec da Etapa 7, "Segurança"): a sessão
// conferida dentro de cada action, a conta que nunca vem do formulário, e a recusa do pedido como
// estado, sem recriar a página (achado 52). O harness da integração não forja sessão, então as actions
// com sessão se provam pelo processo (testes-integracao/bonus-avulso-processo.integracao.ts) e por
// estas guardas.

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const ler = (rel: string) => readFileSync(`${RAIZ}/${rel}`, "utf8");
const ACOES = "app/carrosseis/actions.ts";

/** As funções exportadas de um arquivo e a primeira instrução de cada uma. */
function primeirasInstrucoes(fonte: string): { nome: string; primeira: string }[] {
  const achados: { nome: string; primeira: string }[] = [];
  const re = /export async function (\w+)\([^)]*\)[^{]*\{\s*([^\n;]+;)/g;
  for (const m of fonte.matchAll(re)) achados.push({ nome: m[1], primeira: m[2].trim() });
  return achados;
}

/** O corpo de uma action exportada, até o próximo export. */
function corpoDe(fonte: string, nome: string): string {
  const inicio = fonte.indexOf(`export async function ${nome}(`);
  expect(inicio, nome).toBeGreaterThan(-1);
  const fim = fonte.indexOf("\nexport ", inicio + 1);
  return fonte.slice(inicio, fim === -1 ? undefined : fim);
}

describe("toda action do carrossel avulso confere a sessão antes de qualquer coisa", () => {
  it("as duas actions começam por `await exigirSessao();`", () => {
    const achados = primeirasInstrucoes(ler(ACOES));
    expect(achados.map((a) => a.nome).sort()).toEqual(["gerarAvulsoDeNovo", "pedirCarrosselAvulso"]);
    for (const a of achados) expect(a.primeira, a.nome).toBe("await exigirSessao();");
  });

  it("nenhum export escapa do leitor: num arquivo 'use server', todo export é action", () => {
    const fonte = ler(ACOES);
    expect(fonte.startsWith('"use server";')).toBe(true);
    expect((fonte.match(/^export /gm) ?? []).length).toBe(primeirasInstrucoes(fonte).length);
  });
});

describe("o que vem do formulário", () => {
  it("a conta nunca vem do formulário", () => {
    expect(ler(ACOES)).not.toMatch(/form\.get(All)?\(\s*["']conta["']/);
  });

  it("o título, a descrição e o tema do bônus do Labs nunca vêm do formulário", () => {
    expect(ler(ACOES)).not.toMatch(/form\.get\(\s*["'](titulo|descricao)["']/);
  });

  it("o pedido grava a conta logada com o nome, e o Gerar de novo herda a do original", () => {
    const fonte = ler(ACOES);
    expect(corpoDe(fonte, "pedirCarrosselAvulso")).toContain("contaParaGuardar(");
    expect(corpoDe(fonte, "gerarAvulsoDeNovo")).toContain("contaParaGerarDeNovo(");
  });
});

// A RECUSA DO PEDIDO VOLTA COMO ESTADO (achado 52): todo redirect de Server Action recria a página, e
// o que o operador escreveu, à mão inclusive, sumiria. Sai por redirect só o carrossel criado.
describe("o pedido do avulso responde sem recriar a página na recusa", () => {
  it("pedirCarrosselAvulso não redireciona com aviso", () => {
    const corpo = corpoDe(ler(ACOES), "pedirCarrosselAvulso");
    expect(corpo).not.toMatch(/urlDoCarrosselComAviso\(/);
    expect(corpo.match(/redirect\(/g) ?? []).toHaveLength(1);
  });
});
```

Crie `testes-integracao/bonus-avulso-acoes.integracao.ts`:

```ts
// AS ACTIONS DO CARROSSEL AVULSO RECUSAM SEM SESSÃO, dentro do contexto de requisição do Next
// (./semear-requisicao.ts), que monta a jarra de cookies VAZIA. O molde é
// bonus-carrossel-acoes.integracao.ts. O caminho com sessão é medido uma camada abaixo, em
// bonus-avulso-processo.integracao.ts.
import { beforeAll, describe, expect, it } from "vitest";
import { bancoDescartavel } from "./harness";
import { comoNumaRequisicao } from "./semear-requisicao";

type ModuloAcoes = typeof import("@/app/carrosseis/actions");

const banco = bancoDescartavel();
let acoes: ModuloAcoes;

beforeAll(async () => {
  acoes = await import("@/app/carrosseis/actions");
});

/** A URL do redirect que a action lançou, lida do `digest`. */
async function destinoDe(acao: (f: FormData) => Promise<void>, form: FormData): Promise<string | null> {
  const { valor } = await comoNumaRequisicao("/carrosseis", async () => {
    try {
      await acao(form);
      return null as string | null;
    } catch (e) {
      const digest = (e as { digest?: unknown }).digest;
      if (typeof digest === "string") return digest;
      throw e;
    }
  });
  if (valor === null || !valor.startsWith("NEXT_REDIRECT;")) return null;
  return valor.split(";").slice(2, -2).join(";");
}

function formulario(campos: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
}

async function contar(): Promise<number> {
  const [{ n }] = (await banco.db().sql().query(`select count(*)::int as n from carrosseis_gerados`)) as { n: number }[];
  return n;
}

describe("sem sessão, nenhuma action do carrossel avulso age", () => {
  it("pedirCarrosselAvulso vai para /entrar e não insere nada, mesmo com pedido válido e chave de IA", async () => {
    const antes = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "chave-inventada-para-o-teste";
    try {
      const destino = await destinoDe(
        async (f) => {
          await acoes.pedirCarrosselAvulso(null, f);
        },
        formulario({
          origem: "livre",
          tema: "Produtividade",
          palavra: "BRUTAL",
          conteudo: "Um prompt que critica o seu plano sem dó nenhum.",
          total: "5",
          jeito: "ia",
        })
      );
      expect(destino).toBe("/entrar");
    } finally {
      if (antes === undefined) delete process.env.ANTHROPIC_API_KEY;
      else process.env.ANTHROPIC_API_KEY = antes;
    }
    expect(await contar()).toBe(0);
  });

  it("gerarAvulsoDeNovo vai para /entrar e não insere nada", async () => {
    const destino = await destinoDe(acoes.gerarAvulsoDeNovo, formulario({ id: "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d" }));
    expect(destino).toBe("/entrar");
    expect(await contar()).toBe(0);
  });
});
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-avulso-paginas.test.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-avulso-acoes.integracao.ts
```

Esperado: os 6 puros caem, porque o arquivo das actions não existe; na integração, `[rede-global] ALVO: banco de TESTE`, e os 2 pulam.

- [ ] **Passo 3: o código**

Crie `app/carrosseis/actions.ts`:

```ts
"use server";
import { after } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACCOUNT_COOKIE } from "@/lib/account";
import { isValidSession, SESSION_COOKIE } from "@/lib/auth";
import { contaParaGerarDeNovo, contaParaGuardar, contaSelecionada } from "@/lib/bonus/arte-conta";
import { escolhasDaArte } from "@/lib/bonus/arte-escolhas";
import { lerPedidoAvulso } from "@/lib/bonus/avulso-pedido";
import { gerarAvulsoDeNovo as gerarDeNovo, pedirAvulso } from "@/lib/bonus/avulso-processo";
import { textoDaRecusaDoPedidoAvulso, type AvisoDoAvulso } from "@/lib/bonus/avulso-textos";
import { caminhoDoCarrossel, ehDaRota } from "@/lib/bonus/carrossel-caminho";
import { processarCarrossel } from "@/lib/bonus/carrossel-processo";
import { contasParaArte, lerCarrossel } from "@/lib/bonus/carrossel-repositorio";
import { camposDoFormulario } from "@/lib/bonus/carrossel-texto";
import { TEXTO_CARROSSEL_NAO_ENCONTRADO, urlDoCarrosselComAviso } from "@/lib/bonus/carrossel-textos";
import { temChaveDaIA } from "@/lib/bonus/config";
import { ehIdDeBonus } from "@/lib/bonus/pedido";
import { situacaoNoLabs } from "@/lib/bonus/publicado";
import { textoDaConfig } from "@/lib/bonus/textos";

// AS AÇÕES DO CARROSSEL AVULSO (spec da Etapa 7). O carrossel pronto usa as actions de sempre
// (app/bonus/carrossel-actions.ts e publicar-actions.ts), que trabalham pelo id do carrossel; aqui só
// o pedido e o "Gerar de novo".
//
// TODA ACTION COMEÇA CONFERINDO A SESSÃO, e não confia só no proxy.ts: Server Action tem endereço
// próprio. tests/bonus-avulso-paginas.test.ts confere que a primeira instrução de cada uma é
// `await exigirSessao();`.
//
// O BÔNUS DO LABS É LIDO AQUI, NO SERVIDOR, a cada pedido (avulso-processo.ts): do formulário vem só o
// código, e a palavra e o contexto vêm da lista pública. A conta é a do cookie, e nunca do formulário.

async function exigirSessao(): Promise<void> {
  const jarra = await cookies();
  if (!isValidSession(jarra.get(SESSION_COOKIE)?.value)) redirect("/entrar");
}

const lerSituacao = (codigo: string) => situacaoNoLabs(process.env.LABS_URL, codigo);

async function contaDoCookie(): Promise<string | undefined> {
  return (await cookies()).get(ACCOUNT_COOKIE)?.value;
}

/**
 * O "NOVO CARROSSEL". A recusa volta como ESTADO do formulário (useActionState), e nunca por redirect
 * (achado 52): recriar a página apagaria o que o operador escreveu, à mão inclusive. As recusas não
 * gravam nada. Sai por redirect só o carrossel criado, para a página dele; o da IA dispara a geração
 * no `after()`, como o pedido de carrossel de bônus.
 */
export async function pedirCarrosselAvulso(_anterior: AvisoDoAvulso | null, form: FormData): Promise<AvisoDoAvulso | null> {
  await exigirSessao();
  const recusa = (texto: string): AvisoDoAvulso => ({ tom: "erro", texto, em: Date.now() });
  const lido = lerPedidoAvulso({
    origem: form.get("origem"),
    codigo: form.get("codigo"),
    destaque: form.get("destaque"),
    tema: form.get("tema"),
    palavra: form.get("palavra"),
    conteudo: form.get("conteudo"),
    total: form.get("total"),
    jeito: form.get("jeito"),
  });
  if (!lido.ok) return recusa(textoDaRecusaDoPedidoAvulso(lido.motivo));
  if (lido.pedido.jeito === "ia" && !temChaveDaIA(process.env)) return recusa(textoDaConfig("sem_chave_ia"));
  // Os campos do texto escrito à mão, pelos nomes da tela (a fonte única deles, carrossel-texto.ts).
  const bruto = Object.fromEntries(camposDoFormulario(lido.pedido.total).map((c) => [c.nome, form.get(c.nome)]));
  const logada = contaSelecionada(await contasParaArte(), await contaDoCookie());
  const r = await pedirAvulso({ pedido: lido.pedido, bruto, conta: logada ? contaParaGuardar(logada) : null, lerSituacao });
  if (!r.ok) return recusa(r.texto);
  const id = r.id;
  if (r.gerar) after(() => processarCarrossel(id));
  redirect(`/carrosseis/${id}`);
}

/**
 * O "GERAR DE NOVO" DO AVULSO, na página dele. Um carrossel novo, da mesma origem, com a conta do
 * original (decisão do Eduardo em 02/10, a mesma do de bônus). As recusas voltam à página do carrossel
 * com o aviso na URL, como as do "Gerar de novo" do carrossel de bônus.
 */
export async function gerarAvulsoDeNovo(form: FormData): Promise<void> {
  await exigirSessao();
  const naoAchado = urlDoCarrosselComAviso("/carrosseis", { tom: "erro", texto: TEXTO_CARROSSEL_NAO_ENCONTRADO });
  const id = form.get("id");
  if (!ehIdDeBonus(id)) redirect(naoAchado);
  const linha = await lerCarrossel(id);
  if (!linha || !ehDaRota(linha, { tipo: "avulso" })) redirect(naoAchado);
  const caminho = caminhoDoCarrossel(linha);
  if (!temChaveDaIA(process.env)) redirect(urlDoCarrosselComAviso(caminho, { tom: "erro", texto: textoDaConfig("sem_chave_ia") }));
  const conta = contaParaGerarDeNovo(await contasParaArte(), escolhasDaArte(linha.arte, linha.total_slides), await contaDoCookie());
  const r = await gerarDeNovo({ linha, conta, lerSituacao, agora: Date.now() });
  if (!r.ok) redirect(urlDoCarrosselComAviso(caminho, { tom: "erro", texto: r.texto }));
  const novo = r.id;
  after(() => processarCarrossel(novo));
  redirect(`/carrosseis/${novo}`);
}
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx vitest run tests/bonus-avulso-paginas.test.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-avulso-acoes.integracao.ts
```

Esperado: `tsc` limpo; os 6 puros passam; na integração, `[rede-global] ALVO: banco de TESTE` e os 2 passam.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" app/carrosseis/actions.ts tests/bonus-avulso-paginas.test.ts testes-integracao/bonus-avulso-acoes.integracao.ts
test "$(git branch --show-current)" = "carrossel-avulso"
git add app/carrosseis/actions.ts tests/bonus-avulso-paginas.test.ts testes-integracao/bonus-avulso-acoes.integracao.ts
git commit -m "feat(bonus): as actions do carrossel avulso, com a sessão conferida"
```

---

### FASE 7.8 — A tela do "Novo carrossel", pela IA ou escrito à mão

**Arquivos:**
- Criar: `app/carrosseis/novo/page.tsx`, `app/carrosseis/novo/formulario-do-avulso.tsx`
- Testar: `testes-dom/bonus-novo-carrossel.dom.tsx`, `tests/bonus-avulso-paginas.test.ts`

**Interfaces:**
- Consome: `pedirCarrosselAvulso` (FASE 7.7); `listaDoLabs`, `BonusDoLabs` (FASE 7.4);
  `camposDoFormulario` e o `Campo` da página do carrossel (Etapa 4); `quadroDaSituacao`.
- Produz: `FormularioDoAvulso({ acao, bonus, falhaDaLista, restam })`, chamado pelo `onSubmit` numa
  transição (sem `<form action>`, a lição do PR #5); a página `/carrosseis/novo`, com
  `maxDuration = 300` (a geração roda no `after()` da action dela).

- [ ] **Passo 1: os testes**

Crie `testes-dom/bonus-novo-carrossel.dom.tsx`:

```tsx
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FormularioDoAvulso from "@/app/carrosseis/novo/formulario-do-avulso";
import type { AvisoDoAvulso } from "@/lib/bonus/avulso-textos";
import type { BonusDoLabs } from "@/lib/bonus/publicado";

// O "NOVO CARROSSEL" (spec da Etapa 7): de um bônus do Labs ou de um texto livre, pela IA ou escrito à
// mão. A recusa volta como estado e aparece junto do botão, e o que se escreveu fica na tela (achado
// 52). A action entra por propriedade, e aqui é uma falsa.

const BRUTAL: BonusDoLabs = {
  codigo: "conselheiro-brutalmente-honesto",
  palavra: "BRUTAL",
  titulo: "Conselheiro brutalmente honesto",
  tema: "Produtividade",
  descricao: "Um prompt que critica o seu plano sem dó.",
};
const SUMIDO: BonusDoLabs = {
  codigo: "reativar-clientes-whatsapp",
  palavra: "SUMIDO",
  titulo: "Mensagens para Reativar Clientes Sumidos no WhatsApp",
  tema: "Vendas",
  descricao: "Mensagens prontas para trazer de volta quem sumiu.",
};

function renderizar(respostas: AvisoDoAvulso[] = [], { restam = 10, falhaDaLista = null as string | null } = {}) {
  const recebidos: FormData[] = [];
  const acao = async (_anterior: AvisoDoAvulso | null, f: FormData) => {
    recebidos.push(f);
    return respostas.shift() ?? null;
  };
  render(<FormularioDoAvulso acao={acao} bonus={[BRUTAL, SUMIDO]} falhaDaLista={falhaDaLista} restam={restam} />);
  return recebidos;
}

const campo = (rotulo: string) => screen.getByLabelText(rotulo) as HTMLInputElement;
const escrever = (rotulo: string, valor: string) => fireEvent.change(campo(rotulo), { target: { value: valor } });
const botao = (nome: string) => screen.getByRole("button", { name: nome }) as HTMLButtonElement;
const opcoes = () => Array.from((campo("Bônus do Labs") as unknown as HTMLSelectElement).options).map((o) => o.value);
const doFormulario = (f: FormData) => Object.fromEntries([...f.entries()].filter(([, v]) => v !== ""));

async function clicar(nome: string) {
  await act(async () => {
    fireEvent.click(botao(nome));
  });
}

describe("o novo carrossel de um bônus do Labs", () => {
  it("começa no bônus do Labs, com a lista, e o escolhido mostra a palavra e o tema", () => {
    renderizar();
    expect((screen.getByLabelText("De um bônus do Labs") as HTMLInputElement).checked).toBe(true);
    expect(opcoes()).toEqual(["", BRUTAL.codigo, SUMIDO.codigo]);
    escrever("Bônus do Labs", BRUTAL.codigo);
    expect(screen.getByText("Palavra BRUTAL · Produtividade")).toBeTruthy();
  });

  it("Gerar com a IA manda a origem, o código, o destaque, o total e o jeito", async () => {
    const recebidos = renderizar();
    escrever("Bônus do Labs", BRUTAL.codigo);
    escrever("O que destacar (opcional)", "Mostre o antes e o depois.");
    escrever("Quantos slides?", "5");
    await clicar("Gerar com a IA");
    expect(recebidos.map(doFormulario)).toEqual([
      { origem: "labs", codigo: BRUTAL.codigo, destaque: "Mostre o antes e o depois.", total: "5", jeito: "ia" },
    ]);
  });

  it("a busca filtra pelo título, sem acento e sem maiúscula, e o escolhido fica na lista", () => {
    renderizar();
    escrever("Bônus do Labs", SUMIDO.codigo);
    escrever("Buscar pelo título", "CONSELHÉIRO");
    expect(opcoes()).toEqual(["", BRUTAL.codigo, SUMIDO.codigo]);
    escrever("Bônus do Labs", "");
    expect(opcoes()).toEqual(["", BRUTAL.codigo]);
  });

  it("a lista que não veio mostra a frase, e os botões ficam desligados", () => {
    renderizar([], { falhaDaLista: "Não consegui consultar o Labs agora. Recarregue a página em instantes." });
    expect(screen.getByText("Não consegui consultar o Labs agora. Recarregue a página em instantes.")).toBeTruthy();
    expect(screen.queryByLabelText("Bônus do Labs")).toBeNull();
    expect(botao("Gerar com a IA").disabled).toBe(true);
  });
});

describe("o novo carrossel de um texto livre", () => {
  it("manda o tema, a palavra e o conteúdo, e não o código", async () => {
    const recebidos = renderizar();
    fireEvent.click(screen.getByLabelText("De um texto livre"));
    expect(screen.queryByLabelText("Bônus do Labs")).toBeNull();
    escrever("Tema", "Produtividade");
    escrever("Palavra-chave", "brutal");
    escrever("Conteúdo", "Um prompt que critica o seu plano sem dó nenhum.");
    await clicar("Gerar com a IA");
    expect(recebidos.map(doFormulario)).toEqual([
      {
        origem: "livre",
        tema: "Produtividade",
        palavra: "brutal",
        conteudo: "Um prompt que critica o seu plano sem dó nenhum.",
        total: "10",
        jeito: "ia",
      },
    ]);
  });
});

describe("escrever à mão", () => {
  it("mostra os campos do número de slides escolhido, e trocar o número troca os campos", () => {
    renderizar();
    escrever("Quantos slides?", "3");
    fireEvent.click(botao("Escrever à mão"));
    expect(screen.getByLabelText("Gancho (slide 1)")).toBeTruthy();
    expect(screen.getByLabelText("Slide 2: título")).toBeTruthy();
    expect(screen.getByLabelText("Chamada (slide 3)")).toBeTruthy();
    expect(screen.queryByLabelText("Slide 3: título")).toBeNull();
    escrever("Quantos slides?", "1");
    expect(screen.getByLabelText("Texto da imagem")).toBeTruthy();
    expect(screen.queryByLabelText("Gancho (slide 1)")).toBeNull();
  });

  it("a chamada e a legenda avisam na hora quando falta a palavra do bônus escolhido, ou a digitada", () => {
    renderizar();
    escrever("Bônus do Labs", BRUTAL.codigo);
    escrever("Quantos slides?", "2");
    fireEvent.click(botao("Escrever à mão"));
    escrever("Chamada (slide 2)", "Comente e receba o prompt agora.");
    escrever("Legenda do post", "Quer ouvir a verdade? Comente BRUTAL.");
    expect(screen.getAllByText("Falta a palavra BRUTAL: sem ela, quem comentar não recebe o bônus.")).toHaveLength(1);
    fireEvent.click(screen.getByLabelText("De um texto livre"));
    escrever("Palavra-chave", "conselho");
    expect(screen.getAllByText("Falta a palavra CONSELHO: sem ela, quem comentar não recebe o bônus.")).toHaveLength(2);
  });

  it("Criar com este texto manda o jeito à mão e os campos; numa recusa, tudo fica e o motivo aparece", async () => {
    const recebidos = renderizar([{ tom: "erro", texto: "Corrija antes de criar. Gancho (slide 1): precisa de pelo menos 15 caracteres.", em: 1 }]);
    escrever("Bônus do Labs", BRUTAL.codigo);
    escrever("Quantos slides?", "2");
    fireEvent.click(botao("Escrever à mão"));
    escrever("Gancho (slide 1)", "Curto.");
    escrever("Chamada (slide 2)", "Comente BRUTAL e receba o prompt.");
    escrever("Legenda do post", "Quer ouvir a verdade? Comente BRUTAL.");
    await clicar("Criar com este texto");
    expect(recebidos.map(doFormulario)).toEqual([
      {
        origem: "labs",
        codigo: BRUTAL.codigo,
        total: "2",
        jeito: "mao",
        gancho: "Curto.",
        chamada: "Comente BRUTAL e receba o prompt.",
        legenda: "Quer ouvir a verdade? Comente BRUTAL.",
      },
    ]);
    expect(screen.getByRole("status").textContent).toContain("Gancho (slide 1): precisa de pelo menos 15 caracteres.");
    expect(campo("Gancho (slide 1)").value).toBe("Curto.");
    expect(campo("Quantos slides?").value).toBe("2");
    expect(campo("Bônus do Labs").value).toBe(BRUTAL.codigo);
  });

  it("com o limite do dia acabado, só a IA fica desligada", () => {
    renderizar([], { restam: 0 });
    expect(botao("Gerar com a IA").disabled).toBe(true);
    fireEvent.click(botao("Escrever à mão"));
    expect(botao("Criar com este texto").disabled).toBe(false);
    fireEvent.click(botao("Voltar para a IA"));
    expect(screen.queryByLabelText("Gancho (slide 1)")).toBeNull();
  });
});
```

Em `tests/bonus-avulso-paginas.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-avulso-paginas.test.ts b/tests/bonus-avulso-paginas.test.ts
index dad5e39..8579167 100644
--- a/tests/bonus-avulso-paginas.test.ts
+++ b/tests/bonus-avulso-paginas.test.ts
@@ -1,6 +1,7 @@
 import { readFileSync } from "node:fs";
 import { fileURLToPath } from "node:url";
 import { describe, expect, it } from "vitest";
+import { MAX_DURATION_S } from "@/lib/bonus/tempos";
 
 // AS GUARDAS DO CARROSSEL AVULSO que nenhum tipo pega (spec da Etapa 7, "Segurança"): a sessão
 // conferida dentro de cada action, a conta que nunca vem do formulário, e a recusa do pedido como
@@ -58,6 +59,19 @@ describe("o que vem do formulário", () => {
   });
 });
 
+// A GERAÇÃO RODA NO `after()` DA ACTION, sob o teto de tempo da página que a chamou: o Next exige
+// literal no `maxDuration`, e o número tem de ser o de lib/bonus/tempos.ts.
+describe("a página do novo carrossel", () => {
+  it("declara o mesmo maxDuration de lib/bonus/tempos.ts", () => {
+    const m = /export const maxDuration = (\d+);/.exec(ler("app/carrosseis/novo/page.tsx"));
+    expect(m?.[1]).toBe(String(MAX_DURATION_S));
+  });
+
+  it("entrega pedirCarrosselAvulso ao formulário", () => {
+    expect(ler("app/carrosseis/novo/page.tsx")).toContain("acao={pedirCarrosselAvulso}");
+  });
+});
+
 // A RECUSA DO PEDIDO VOLTA COMO ESTADO (achado 52): todo redirect de Server Action recria a página, e
 // o que o operador escreveu, à mão inclusive, sumiria. Sai por redirect só o carrossel criado.
 describe("o pedido do avulso responde sem recriar a página na recusa", () => {
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-avulso-paginas.test.ts
npx vitest run --config vitest.dom.config.ts testes-dom/bonus-novo-carrossel.dom.tsx
```

Esperado: os puros: 2 caem e 6 passam (8), os da página nova; a tela cai sem casos, porque o formulário não existe.

- [ ] **Passo 3: o código**

Crie `app/carrosseis/novo/formulario-do-avulso.tsx`:

```tsx
"use client";
import { useActionState, useMemo, useState, useTransition } from "react";
import { alertWarn, btnPrimary, btnSecondary, hint, input, label } from "@/app/ui";
import AvisoDoFormulario from "@/app/bonus/aviso-do-formulario";
import Campo from "@/app/bonus/[id]/carrossel/[cid]/campo";
import { CONTEUDO_MAX, DESTAQUE_MAX, type JeitoDoTexto } from "@/lib/bonus/avulso-pedido";
import type { AvisoDoAvulso } from "@/lib/bonus/avulso-textos";
import { SLIDES_MAX, SLIDES_MIN, SLIDES_PADRAO, TETO_CARROSSEL_DIARIO } from "@/lib/bonus/carrossel-pedido";
import { camposDoFormulario } from "@/lib/bonus/carrossel-texto";
import { PALAVRA_MAX, TEMA_MAX, normalizarPalavra } from "@/lib/bonus/pedido";
import type { BonusDoLabs } from "@/lib/bonus/publicado";

// O "NOVO CARROSSEL" (spec da Etapa 7): de um bônus que já está no Labs, ou de um texto livre; a IA
// escreve, ou o operador escreve à mão. Do bônus do Labs, o formulário só manda o código: a palavra e
// o contexto o servidor lê de lá (app/carrosseis/actions.ts).
//
// "ESCREVER À MÃO" mostra os campos do carrossel para o número de slides escolhido, os mesmos da
// página do carrossel (`camposDoFormulario` e campo.tsx), com o aviso da palavra na hora. A conferência
// de verdade é a do servidor, o carrossel inteiro de uma vez.
//
// ⚠️ SEM `<form action>`, E É DE PROPÓSITO, como o pedido de carrossel de bônus
// (app/bonus/[id]/pedido-de-carrossel.tsx): com `action`, o React 19 reinicia o formulário depois da
// action, e o `<select>` controlado volta para a opção do HTML do servidor. A recusa volta como estado
// (achado 52), e o que se escreveu fica na tela. A action entra por propriedade, para o teste de tela
// usar uma falsa.

/** A busca pelo título, sem acento e sem diferença de maiúscula. */
function semAcento(t: string): string {
  return t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

export default function FormularioDoAvulso({
  acao,
  bonus,
  falhaDaLista,
  restam,
}: {
  acao: (anterior: AvisoDoAvulso | null, form: FormData) => Promise<AvisoDoAvulso | null>;
  /** Os bônus do Labs que o Chat consegue usar (`listaDoLabs`), do mais novo para o mais velho. */
  bonus: BonusDoLabs[];
  /** A frase da falha da leitura do Labs; null quando a lista veio. */
  falhaDaLista: string | null;
  restam: number;
}) {
  // `pendente` desliga os botões enquanto o pedido roda: um clique duplo criaria dois carrosséis.
  const [resposta, enviar, pendente] = useActionState(acao, null);
  const [, iniciar] = useTransition();
  const [origem, setOrigem] = useState<"labs" | "livre">("labs");
  const [jeito, setJeito] = useState<JeitoDoTexto>("ia");
  const [busca, setBusca] = useState("");
  const [codigo, setCodigo] = useState("");
  const [destaque, setDestaque] = useState("");
  const [tema, setTema] = useState("");
  const [palavra, setPalavra] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [total, setTotal] = useState(String(SLIDES_PADRAO));

  const escolhido = bonus.find((b) => b.codigo === codigo) ?? null;
  // O escolhido fica na lista mesmo fora da busca: um `<select>` com o valor fora das opções mostraria
  // outro bônus do que o que vai.
  const filtrados = useMemo(() => {
    const q = semAcento(busca.trim());
    return bonus.filter((b) => b === escolhido || !q || semAcento(b.titulo).includes(q));
  }, [bonus, busca, escolhido]);
  const palavraDoPost = origem === "labs" ? (escolhido?.palavra ?? "") : normalizarPalavra(palavra);
  const semLista = origem === "labs" && falhaDaLista !== null;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const dados = new FormData(e.currentTarget);
        iniciar(() => enviar(dados));
      }}
      className="space-y-5"
    >
      <input type="hidden" name="jeito" value={jeito} />
      <fieldset className="space-y-2">
        <legend className={label}>De onde vem o carrossel</legend>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" name="origem" value="labs" checked={origem === "labs"} onChange={() => setOrigem("labs")} />
            De um bônus do Labs
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="origem" value="livre" checked={origem === "livre"} onChange={() => setOrigem("livre")} />
            De um texto livre
          </label>
        </div>
      </fieldset>

      {origem === "labs" &&
        (falhaDaLista !== null ? (
          <p className={alertWarn}>{falhaDaLista}</p>
        ) : (
          <div className="space-y-4">
            <div>
              <label htmlFor="busca" className={label}>
                Buscar pelo título
              </label>
              <input id="busca" type="search" value={busca} onChange={(e) => setBusca(e.target.value)} className={input} />
            </div>
            <div>
              <label htmlFor="codigo" className={label}>
                Bônus do Labs
              </label>
              <select id="codigo" name="codigo" value={codigo} onChange={(e) => setCodigo(e.target.value)} className={input}>
                <option value="">Escolha um bônus</option>
                {filtrados.map((b) => (
                  <option key={b.codigo} value={b.codigo}>
                    {b.titulo}
                  </option>
                ))}
              </select>
              {escolhido && (
                <p className={hint}>
                  Palavra {escolhido.palavra} · {escolhido.tema}
                </p>
              )}
              {bonus.length === 0 && <p className={hint}>Nenhum bônus publicado no Labs com palavra-chave e tema.</p>}
            </div>
            <div>
              <label htmlFor="destaque" className={label}>
                O que destacar (opcional)
              </label>
              <textarea
                id="destaque"
                name="destaque"
                value={destaque}
                maxLength={DESTAQUE_MAX}
                rows={3}
                onChange={(e) => setDestaque(e.target.value)}
                className={input}
              />
              <p className={hint}>Vai para a IA no lugar do que o bônus resolve. Vazio, ela parte da descrição do bônus.</p>
            </div>
          </div>
        ))}

      {origem === "livre" && (
        <div className="space-y-4">
          <div>
            <label htmlFor="tema" className={label}>
              Tema
            </label>
            <input id="tema" name="tema" value={tema} maxLength={TEMA_MAX} onChange={(e) => setTema(e.target.value)} className={input} />
          </div>
          <div>
            <label htmlFor="palavra" className={label}>
              Palavra-chave
            </label>
            <input
              id="palavra"
              name="palavra"
              value={palavra}
              maxLength={PALAVRA_MAX}
              onChange={(e) => setPalavra(e.target.value)}
              className={input}
            />
            <p className={hint}>A palavra que a pessoa comenta para receber. Uma palavra só, com letras e números.</p>
          </div>
          <div>
            <label htmlFor="conteudo" className={label}>
              Conteúdo
            </label>
            <textarea
              id="conteudo"
              name="conteudo"
              value={conteudo}
              maxLength={CONTEUDO_MAX}
              rows={8}
              onChange={(e) => setConteudo(e.target.value)}
              className={input}
            />
            <p className={hint}>O que o post divulga, escrito ou colado do Notion.</p>
          </div>
        </div>
      )}

      <div>
        <label htmlFor="total" className={label}>
          Quantos slides?
        </label>
        <select id="total" name="total" value={total} onChange={(e) => setTotal(e.target.value)} className={input}>
          {Array.from({ length: SLIDES_MAX - SLIDES_MIN + 1 }, (_, i) => SLIDES_MIN + i).map((n) => (
            <option key={n} value={n}>
              {n === 1 ? "1 (post de imagem única)" : `${n} slides`}
            </option>
          ))}
        </select>
      </div>

      {jeito === "mao" && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">O texto do carrossel</h3>
          {camposDoFormulario(Number(total)).map((c) => (
            <Campo
              key={c.nome}
              nome={c.nome}
              rotulo={c.rotulo}
              valorInicial=""
              max={c.max}
              linhas={c.linhas}
              palavra={c.pedePalavra && palavraDoPost ? palavraDoPost : undefined}
              soAPalavra={c.soAPalavra}
            />
          ))}
        </div>
      )}

      {resposta && <AvisoDoFormulario key={resposta.em} aviso={resposta} />}

      {jeito === "ia" ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={btnPrimary} disabled={pendente || restam === 0 || semLista}>
              Gerar com a IA
            </button>
            <button type="button" className={btnSecondary} disabled={semLista} onClick={() => setJeito("mao")}>
              Escrever à mão
            </button>
          </div>
          <p className={hint}>
            Restam {restam} de {TETO_CARROSSEL_DIARIO} gerações de carrossel nas últimas 24 horas.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={btnPrimary} disabled={pendente || semLista}>
              Criar com este texto
            </button>
            <button type="button" className={btnSecondary} onClick={() => setJeito("ia")}>
              Voltar para a IA
            </button>
          </div>
          <p className={hint}>Escrito à mão, o carrossel não gasta IA nem conta no limite do dia.</p>
        </div>
      )}
    </form>
  );
}
```

Crie `app/carrosseis/novo/page.tsx`:

```tsx
import Link from "next/link";
import { alertError, card, link, pageSubtitle, pageTitle } from "@/app/ui";
import { restamCarrosseisHoje } from "@/lib/bonus/carrossel-pedido";
import { carrosseisNasUltimas24h } from "@/lib/bonus/carrossel-repositorio";
import { TEXTO_TABELA_CARROSSEL_AUSENTE, quadroDaSituacao } from "@/lib/bonus/carrossel-textos";
import { ehTabelaAusente } from "@/lib/bonus/erros";
import { listaDoLabs } from "@/lib/bonus/publicado";
import { pedirCarrosselAvulso } from "../actions";
import FormularioDoAvulso from "./formulario-do-avulso";

// O "NOVO CARROSSEL" (spec da Etapa 7). A lista do Labs é lida a cada vez, como a situação do bônus na
// página dele: ela não está no contrato, e a falha mostra a frase, e não uma lista vazia.
//
// O teto de lib/bonus/tempos.ts (MAX_DURATION_S): a geração pela IA roda no `after()` da action desta
// página. O Next exige literal aqui, e tests/bonus-avulso-paginas.test.ts confere que é o mesmo número.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export default async function NovoCarrossel() {
  let usadas: number;
  try {
    usadas = await carrosseisNasUltimas24h();
  } catch (erro) {
    if (!ehTabelaAusente(erro)) throw erro;
    return <div className={alertError}>{TEXTO_TABELA_CARROSSEL_AUSENTE}</div>;
  }
  const lista = await listaDoLabs(process.env.LABS_URL);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/carrosseis" className={link}>
          Voltar para os carrosséis
        </Link>
        <h1 className={`mt-2 ${pageTitle}`}>Novo carrossel</h1>
        <p className={pageSubtitle}>De um bônus que já está no Labs, ou de um texto livre. A IA escreve, ou você escreve à mão.</p>
      </div>
      <section className={`${card} p-6`}>
        <FormularioDoAvulso
          acao={pedirCarrosselAvulso}
          bonus={lista.ok ? lista.bonus : []}
          falhaDaLista={lista.ok ? null : quadroDaSituacao({ tipo: lista.tipo }).texto}
          restam={restamCarrosseisHoje(usadas)}
        />
      </section>
    </div>
  );
}
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx vitest run tests/bonus-avulso-paginas.test.ts
npx vitest run --config vitest.dom.config.ts testes-dom/bonus-novo-carrossel.dom.tsx
```

Esperado: `tsc` limpo; 8 casos puros e 9 de tela passam.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" app/carrosseis/novo/page.tsx app/carrosseis/novo/formulario-do-avulso.tsx tests/bonus-avulso-paginas.test.ts testes-dom/bonus-novo-carrossel.dom.tsx
test "$(git branch --show-current)" = "carrossel-avulso"
git add app/carrosseis/novo/page.tsx app/carrosseis/novo/formulario-do-avulso.tsx tests/bonus-avulso-paginas.test.ts testes-dom/bonus-novo-carrossel.dom.tsx
git commit -m "feat(bonus): a tela do Novo carrossel, pela IA ou escrito à mão"
```

---

### FASE 7.9 — A arte do carrossel avulso, com o desenho do slide comum às duas rotas

**Arquivos:**
- Criar: `lib/bonus/arte-rota.ts`, `app/carrosseis/[cid]/arte/route.tsx`
- Modificar: `app/bonus/[id]/carrossel/[cid]/arte/route.tsx`
- Testar: `tests/bonus-arte-paginas.test.ts`, `testes-integracao/bonus-arte-rota.integracao.ts`

**Interfaces:**
- Consome: `conferirPedidoDaArte(linha, rota, slide)` (FASE 7.2); `respostaDaArte`, `fotoDoEspaco`,
  `fotosDaInstancia`, `fotosDaArte`, `versaoDoDesenho` (Etapas 3 a 5).
- Produz, de `arte-rota.ts`: `erroDaArte(status, texto)`; `desenharSlide({ linha, slides, numero,
  doCookie, baixar, slug })`, que devolve a resposta da arte. As duas rotas conferem a sessão como
  primeira coisa, os ids e a origem, e chamam `desenharSlide`; o arquivo baixado leva o slug do bônus
  do Chat, o código do Labs, ou "carrossel".

- [ ] **Passo 1: os testes**

Em `tests/bonus-arte-paginas.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-arte-paginas.test.ts b/tests/bonus-arte-paginas.test.ts
index c3666fb..ce5ae72 100644
--- a/tests/bonus-arte-paginas.test.ts
+++ b/tests/bonus-arte-paginas.test.ts
@@ -1,25 +1,30 @@
 import { existsSync, readdirSync, readFileSync } from "node:fs";
+import { dirname } from "node:path";
 import { fileURLToPath } from "node:url";
 import { describe, expect, it } from "vitest";
 
 // AS GUARDAS DA ROTA DA ARTE que nenhum tipo pega: a sessão conferida antes de tudo, o caminho que
-// não escapa do proxy, e a tabela de contas lida só pelas colunas do cabeçalho.
+// não escapa do proxy, e a tabela de contas lida só pelas colunas do cabeçalho. Desde a Etapa 7 são
+// duas rotas, a do carrossel de bônus e a do avulso, e as duas desenham pelo mesmo módulo
+// (lib/bonus/arte-rota.ts), que é onde moram a foto da conta e a foto do espaço.
 
 const RAIZ = fileURLToPath(new URL("..", import.meta.url));
 const ler = (rel: string) => readFileSync(`${RAIZ}/${rel}`, "utf8");
-const ROTA = "app/bonus/[id]/carrossel/[cid]/arte/route.tsx";
+const ROTAS = ["app/bonus/[id]/carrossel/[cid]/arte/route.tsx", "app/carrosseis/[cid]/arte/route.tsx"];
+const DESENHO = "lib/bonus/arte-rota.ts";
 
-describe("a rota da arte", () => {
+describe.each(ROTAS)("a rota da arte %s", (rota) => {
   // A rota é um GET com endereço próprio: o proxy.ts deixa passar sem sessão o que termina em
   // .png, .jpg, .svg e .ico. Por isso o caminho termina em /arte, e a rota confere a sessão ela
   // mesma, como primeira coisa.
   it("mora em /arte, e não num caminho que termina em .png", () => {
-    expect(existsSync(`${RAIZ}/${ROTA}`)).toBe(true);
-    expect(readdirSync(`${RAIZ}/app/bonus/[id]/carrossel/[cid]`).some((n) => /\.(png|jpe?g|svg|ico)$/.test(n))).toBe(false);
+    expect(existsSync(`${RAIZ}/${rota}`)).toBe(true);
+    const pagina = dirname(dirname(`${RAIZ}/${rota}`));
+    expect(readdirSync(pagina).some((n) => /\.(png|jpe?g|svg|ico)$/.test(n))).toBe(false);
   });
 
   it("o GET confere a sessão antes de qualquer outra coisa", () => {
-    const fonte = ler(ROTA);
+    const fonte = ler(rota);
     const inicio = fonte.indexOf("export async function GET(");
     const corpo = fonte.slice(inicio);
     const linhas = corpo
@@ -34,6 +39,14 @@ describe("a rota da arte", () => {
     ]);
   });
 
+  it("confere o pedido pela origem da rota, e desenha pelo módulo comum", () => {
+    const fonte = ler(rota);
+    expect(fonte).toContain("conferirPedidoDaArte(");
+    expect(fonte).toContain("desenharSlide(");
+  });
+});
+
+describe("o desenho do slide, comum às duas rotas", () => {
   it("os cabeçalhos da resposta saem de cabecalhosDaArte, que nunca diz public", () => {
     expect(ler("lib/bonus/arte-resposta.tsx")).toContain("headers: cabecalhosDaArte(baixar, nomeDoArquivo)");
   });
@@ -41,19 +54,23 @@ describe("a rota da arte", () => {
   // A foto passa pela memória da instância (spec da Etapa 4): as miniaturas chegam juntas, e a
   // memória faz delas uma busca só. Chamar `fotoDaConta` direto voltaria a uma busca por miniatura.
   it("a foto da conta vem da memória da instância, e não de uma busca por miniatura", () => {
-    const rota = ler(ROTA);
-    expect(rota).toContain("fotosDaInstancia.foto(");
-    expect(rota).not.toMatch(/\bfotoDaConta\(/);
+    const desenho = ler(DESENHO);
+    expect(desenho).toContain("fotosDaInstancia.foto(");
+    expect(desenho).not.toMatch(/\bfotoDaConta\(/);
   });
 
   // A FOTO DO ESPAÇO (adendo da Etapa 5) é só a do jeito "foto" (`fotosDaArte`), e passa pela
   // conferência do caminho na pasta da conta do carrossel e pela memória (`fotoDoEspaco`). Buscar
   // direto pularia as duas.
   it("a foto do espaço vem de fotosDaArte e de fotoDoEspaco, e nunca de uma busca direta", () => {
-    const rota = ler(ROTA);
-    expect(rota).toContain("fotosDaArte(");
-    expect(rota).toContain("fotoDoEspaco(");
-    expect(rota).not.toMatch(/\bbuscarFotoDoEspaco\(/);
+    const desenho = ler(DESENHO);
+    expect(desenho).toContain("fotosDaArte(");
+    expect(desenho).toContain("fotoDoEspaco(");
+    expect(desenho).not.toMatch(/\bbuscarFotoDoEspaco\(/);
+  });
+
+  it("nenhuma rota busca foto por conta própria", () => {
+    for (const rota of ROTAS) expect(ler(rota), rota).not.toMatch(/\b(fotoDaConta|buscarFotoDoEspaco|fotoDoEspaco|fotosDaInstancia)\b/);
   });
 });
 
@@ -62,13 +79,15 @@ describe("a rota da arte", () => {
 // por `contasParaArte`, que seleciona só as quatro colunas do cabeçalho.
 describe("a arte não lê a tabela de contas inteira", () => {
   const ARQUIVOS = [
-    ROTA,
+    ...ROTAS,
+    DESENHO,
     "lib/bonus/arte-resposta.tsx",
     "lib/bonus/arte-desenho.tsx",
     "lib/bonus/arte-conta.ts",
     "lib/bonus/arte-foto.ts",
     "lib/bonus/carrossel-repositorio.ts",
     "app/bonus/carrossel-actions.ts",
+    "app/carrosseis/actions.ts",
   ];
 
   /** O código sem as linhas de comentário: os comentários citam essas funções para dizer por que não. */
```

Em `testes-integracao/bonus-arte-rota.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/bonus-arte-rota.integracao.ts b/testes-integracao/bonus-arte-rota.integracao.ts
index 3a4e55d..4be976d 100644
--- a/testes-integracao/bonus-arte-rota.integracao.ts
+++ b/testes-integracao/bonus-arte-rota.integracao.ts
@@ -1,22 +1,31 @@
 // A ROTA DA ARTE RECUSA SEM SESSÃO, dentro do contexto de requisição do Next
 // (./semear-requisicao.ts), que monta a jarra de cookies VAZIA. Nenhum cookie é forjado: a sessão
 // ausente é o caso medido. O desenho com sessão é medido uma camada abaixo, em
-// tests/bonus-arte-resposta.test.ts, e de ponta a ponta na prova real.
+// tests/bonus-arte-resposta.test.ts, e de ponta a ponta na prova real. As duas rotas, a do
+// carrossel de bônus e a do avulso (Etapa 7), recusam do mesmo jeito.
 import { beforeAll, describe, expect, it } from "vitest";
 import { bancoDescartavel } from "./harness";
 import { comoNumaRequisicao } from "./semear-requisicao";
 
 type ModuloRota = typeof import("@/app/bonus/[id]/carrossel/[cid]/arte/route");
+type ModuloRotaAvulsa = typeof import("@/app/carrosseis/[cid]/arte/route");
 
 bancoDescartavel();
 let rota: ModuloRota;
+let rotaAvulsa: ModuloRotaAvulsa;
 
 beforeAll(async () => {
   rota = await import("@/app/bonus/[id]/carrossel/[cid]/arte/route");
+  rotaAvulsa = await import("@/app/carrosseis/[cid]/arte/route");
 });
 
 const BONUS = "0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f";
 const CARROSSEL = "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d";
+const SEM_SESSAO = {
+  status: 401,
+  cache: "private, no-store",
+  corpo: { ok: false, erro: "Entre no painel para ver a arte." },
+};
 
 describe("sem sessão, a arte não desenha", () => {
   it("responde 401 sem cache, antes de olhar o carrossel, o slide ou o banco", async () => {
@@ -27,10 +36,17 @@ describe("sem sessão, a arte não desenha", () => {
       });
       return { status: r.status, cache: r.headers.get("cache-control"), corpo: await r.json() };
     });
-    expect(valor).toEqual({
-      status: 401,
-      cache: "private, no-store",
-      corpo: { ok: false, erro: "Entre no painel para ver a arte." },
+    expect(valor).toEqual(SEM_SESSAO);
+  });
+
+  it("a arte do avulso também responde 401 sem cache", async () => {
+    const caminho = `/carrosseis/${CARROSSEL}/arte`;
+    const { valor } = await comoNumaRequisicao(caminho, async () => {
+      const r = await rotaAvulsa.GET(new Request(`http://127.0.0.1${caminho}?slide=1`), {
+        params: Promise.resolve({ cid: CARROSSEL }),
+      });
+      return { status: r.status, cache: r.headers.get("cache-control"), corpo: await r.json() };
     });
+    expect(valor).toEqual(SEM_SESSAO);
   });
 });
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-arte-paginas.test.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-arte-rota.integracao.ts
```

Esperado: os puros: 9 caem e 12 passam (21), os da rota nova e do módulo comum; na integração, `[rede-global] ALVO: banco de TESTE`, e os 2 pulam, porque a rota nova não existe.

- [ ] **Passo 3: o código**

Crie `lib/bonus/arte-rota.ts`:

```ts
import "server-only";
import { NextResponse } from "next/server";
import { resolverConta } from "./arte-conta";
import { comEspaco, escolhasDaArte } from "./arte-escolhas";
import { fotoDoEspaco, fotosDaInstancia } from "./arte-foto";
import { respostaDaArte } from "./arte-resposta";
import type { SlideParaArte } from "./arte-slides";
import { cabecalhoDaConta, nomeDoArquivo } from "./arte-tela";
import { TEXTO_ARTE_SEM_CONTA, TEXTO_ARTE_SEM_DESENHO, TEXTO_ARTE_SEM_FONTE } from "./arte-textos";
import type { LinhaDoCarrossel } from "./carrossel-linha";
import { contasParaArte } from "./carrossel-repositorio";
import { fotosDaArte, versaoDoDesenho } from "./publicar-regras";

// O DESENHO DE UM SLIDE, COMUM ÀS DUAS ROTAS DA ARTE (spec da Etapa 7): a do carrossel de bônus
// (app/bonus/[id]/carrossel/[cid]/arte/route.tsx) e a do avulso (app/carrosseis/[cid]/arte/route.tsx).
// Cada rota confere a sessão, a origem e o slide (`conferirPedidoDaArte`), e chama isto; o que a arte
// desenha, e como (a conta, a foto da conta, a foto do espaço, a versão), mora num lugar só.
// tests/bonus-arte-paginas.test.ts confere as guardas das duas rotas e deste arquivo.

export function erroDaArte(status: number, texto: string): NextResponse {
  return NextResponse.json({ ok: false, erro: texto }, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function desenharSlide(p: {
  linha: LinhaDoCarrossel;
  slides: SlideParaArte[];
  numero: number;
  /** A conta do cookie: a do cabeçalho quando o carrossel não tem conta gravada. */
  doCookie: string | undefined;
  baixar: boolean;
  /** O nome do arquivo baixado (`nomeDoArquivo`): o slug do bônus do Chat, ou o código do Labs. */
  slug: () => Promise<string | null>;
}): Promise<Response> {
  const { linha, slides, numero } = p;
  // A conta do cabeçalho é a do carrossel (arte-conta.ts): conectada, os dados atuais; desconectada,
  // o nome e o @ guardados, com as iniciais; sem conta gravada, a logada no Chat.
  const escolhas = escolhasDaArte(linha.arte, slides.length);
  const { conta } = resolverConta(await contasParaArte(), escolhas, p.doCookie);
  if (!conta) return erroDaArte(409, TEXTO_ARTE_SEM_CONTA);
  // A FOTO DO ESPAÇO (adendo da Etapa 5): só no slide com espaço, e só a do jeito "foto", que o
  // prefixo do caminho guardado diz (publicar-regras.ts). `fotoDoEspaco` confere o caminho na pasta da
  // conta do carrossel antes de buscar.
  const slide = slides[numero - 1];
  const espaco = comEspaco(escolhas, numero);
  const caminhoDaFoto = espaco ? (fotosDaArte(linha.arte, slides.length)[numero] ?? null) : null;
  // As fotos vêm da memória desta instância (arte-foto.ts): as miniaturas chegam juntas, e uma busca
  // só atende todas.
  const [foto, slug, daFoto] = await Promise.all([
    fotosDaInstancia.foto(conta.profile_picture_url),
    p.slug(),
    caminhoDaFoto ? fotoDoEspaco(caminhoDaFoto, escolhas.conta) : Promise.resolve(null),
  ]);

  // O PNG já sai lido inteiro (arte-resposta.tsx, achado 65): uma falha do desenho vira 500 com
  // frase, e não um 200 com o corpo quebrado. Emoji no texto faz o desenho buscar o emoji em
  // cdn.jsdelivr.net (achado 66); sem essa rede, o slide com emoji cai nesta frase.
  // A versão do desenho vai só no slide que sai com a arte do Chat: o "Só texto" e o com foto.
  const arte = await respostaDaArte({
    slide,
    comEspaco: espaco,
    cabecalho: cabecalhoDaConta(conta, foto),
    baixar: p.baixar,
    nomeDoArquivo: nomeDoArquivo(slug, numero),
    fotoDoEspaco: caminhoDaFoto ? { foto: daFoto } : null,
    versao: !espaco || caminhoDaFoto ? versaoDoDesenho(slide, caminhoDaFoto) : null,
  });
  if (!arte.ok) return erroDaArte(500, arte.falha === "fonte" ? TEXTO_ARTE_SEM_FONTE : TEXTO_ARTE_SEM_DESENHO);
  return arte.resposta;
}
```

Em `app/bonus/[id]/carrossel/[cid]/arte/route.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/[id]/carrossel/[cid]/arte/route.tsx b/app/bonus/[id]/carrossel/[cid]/arte/route.tsx
index a36cff6..1216fba 100644
--- a/app/bonus/[id]/carrossel/[cid]/arte/route.tsx
+++ b/app/bonus/[id]/carrossel/[cid]/arte/route.tsx
@@ -1,22 +1,11 @@
 import { cookies } from "next/headers";
-import { NextResponse } from "next/server";
 import { ACCOUNT_COOKIE } from "@/lib/account";
 import { isValidSession, SESSION_COOKIE } from "@/lib/auth";
-import { resolverConta } from "@/lib/bonus/arte-conta";
-import { comEspaco, escolhasDaArte } from "@/lib/bonus/arte-escolhas";
-import { fotoDoEspaco, fotosDaInstancia } from "@/lib/bonus/arte-foto";
-import { respostaDaArte } from "@/lib/bonus/arte-resposta";
-import { cabecalhoDaConta, conferirPedidoDaArte, nomeDoArquivo } from "@/lib/bonus/arte-tela";
-import {
-  TEXTO_ARTE_NAO_ENCONTRADA,
-  TEXTO_ARTE_SEM_CONTA,
-  TEXTO_ARTE_SEM_DESENHO,
-  TEXTO_ARTE_SEM_FONTE,
-  TEXTO_ARTE_SEM_SESSAO,
-} from "@/lib/bonus/arte-textos";
-import { contasParaArte, lerCarrossel } from "@/lib/bonus/carrossel-repositorio";
+import { desenharSlide, erroDaArte as erro } from "@/lib/bonus/arte-rota";
+import { conferirPedidoDaArte } from "@/lib/bonus/arte-tela";
+import { TEXTO_ARTE_NAO_ENCONTRADA, TEXTO_ARTE_SEM_SESSAO } from "@/lib/bonus/arte-textos";
+import { lerCarrossel } from "@/lib/bonus/carrossel-repositorio";
 import { ehIdDeBonus } from "@/lib/bonus/pedido";
-import { fotosDaArte, versaoDoDesenho } from "@/lib/bonus/publicar-regras";
 import { lerLinha } from "@/lib/bonus/repositorio";
 
 // A ARTE DE UM SLIDE DO CARROSSEL, em PNG de 1080×1350: um slide por pedido, desenhado na hora a
@@ -30,14 +19,13 @@ import { lerLinha } from "@/lib/bonus/repositorio";
 //
 // `?slide=N` escolhe o slide (1 ao total); `?baixar=1` vira download com nome de arquivo; `?v=` é a
 // versão da prévia, que esta rota ignora (arte-tela.ts, `versaoDaArte`).
+//
+// O DESENHO MORA EM lib/bonus/arte-rota.ts (Etapa 7), comum a esta rota e à do carrossel avulso
+// (app/carrosseis/[cid]/arte/route.tsx). Esta só serve o carrossel do bônus da URL.
 
 export const runtime = "nodejs";
 export const dynamic = "force-dynamic";
 
-function erro(status: number, texto: string): NextResponse {
-  return NextResponse.json({ ok: false, erro: texto }, { status, headers: { "Cache-Control": "private, no-store" } });
-}
-
 export async function GET(request: Request, { params }: { params: Promise<{ id: string; cid: string }> }) {
   const jarra = await cookies();
   if (!isValidSession(jarra.get(SESSION_COOKIE)?.value)) return erro(401, TEXTO_ARTE_SEM_SESSAO);
@@ -47,40 +35,11 @@ export async function GET(request: Request, { params }: { params: Promise<{ id:
   // O dono, o "pronto" e o slide: arte-tela.ts, `conferirPedidoDaArte`, com um caso por recusa.
   const conferido = conferirPedidoDaArte(await lerCarrossel(cid), { tipo: "bonus", bonusId: id }, pedido.get("slide"));
   if (!conferido.ok) return erro(conferido.status, conferido.texto);
-  const { linha, slides, numero } = conferido;
-
-  // A conta do cabeçalho é a do carrossel (arte-conta.ts): conectada, os dados atuais; desconectada,
-  // o nome e o @ guardados, com as iniciais; sem conta gravada, a logada no Chat.
-  const escolhas = escolhasDaArte(linha.arte, slides.length);
-  const { conta } = resolverConta(await contasParaArte(), escolhas, jarra.get(ACCOUNT_COOKIE)?.value);
-  if (!conta) return erro(409, TEXTO_ARTE_SEM_CONTA);
-  // A FOTO DO ESPAÇO (adendo da Etapa 5): só no slide com espaço, e só a do jeito "foto", que o
-  // prefixo do caminho guardado diz (publicar-regras.ts). `fotoDoEspaco` confere o caminho na pasta da
-  // conta do carrossel antes de buscar.
-  const slide = slides[numero - 1];
-  const espaco = comEspaco(escolhas, numero);
-  const caminhoDaFoto = espaco ? (fotosDaArte(linha.arte, slides.length)[numero] ?? null) : null;
-  // As fotos vêm da memória desta instância (arte-foto.ts): as miniaturas chegam juntas, e uma busca
-  // só atende todas.
-  const [foto, bonus, daFoto] = await Promise.all([
-    fotosDaInstancia.foto(conta.profile_picture_url),
-    lerLinha(id),
-    caminhoDaFoto ? fotoDoEspaco(caminhoDaFoto, escolhas.conta) : Promise.resolve(null),
-  ]);
-
-  // O PNG já sai lido inteiro (arte-resposta.tsx, achado 65): uma falha do desenho vira 500 com
-  // frase, e não um 200 com o corpo quebrado. Emoji no texto faz o desenho buscar o emoji em
-  // cdn.jsdelivr.net (achado 66); sem essa rede, o slide com emoji cai nesta frase.
-  // A versão do desenho vai só no slide que sai com a arte do Chat: o "Só texto" e o com foto.
-  const arte = await respostaDaArte({
-    slide,
-    comEspaco: espaco,
-    cabecalho: cabecalhoDaConta(conta, foto),
+  return desenharSlide({
+    ...conferido,
+    doCookie: jarra.get(ACCOUNT_COOKIE)?.value,
     baixar: pedido.get("baixar") === "1",
-    nomeDoArquivo: nomeDoArquivo(bonus?.slug ?? null, numero),
-    fotoDoEspaco: caminhoDaFoto ? { foto: daFoto } : null,
-    versao: !espaco || caminhoDaFoto ? versaoDoDesenho(slide, caminhoDaFoto) : null,
+    // O arquivo baixado leva o endereço do bônus no Labs.
+    slug: async () => (await lerLinha(id))?.slug ?? null,
   });
-  if (!arte.ok) return erro(500, arte.falha === "fonte" ? TEXTO_ARTE_SEM_FONTE : TEXTO_ARTE_SEM_DESENHO);
-  return arte.resposta;
 }
```

Crie `app/carrosseis/[cid]/arte/route.tsx`:

```tsx
import { cookies } from "next/headers";
import { ACCOUNT_COOKIE } from "@/lib/account";
import { isValidSession, SESSION_COOKIE } from "@/lib/auth";
import { desenharSlide, erroDaArte as erro } from "@/lib/bonus/arte-rota";
import { conferirPedidoDaArte } from "@/lib/bonus/arte-tela";
import { TEXTO_ARTE_NAO_ENCONTRADA, TEXTO_ARTE_SEM_SESSAO } from "@/lib/bonus/arte-textos";
import { lerCarrossel } from "@/lib/bonus/carrossel-repositorio";
import { ehIdDeBonus } from "@/lib/bonus/pedido";

// A ARTE DE UM SLIDE DO CARROSSEL AVULSO (spec da Etapa 7), em PNG de 1080×1350: o mesmo desenho da
// arte do carrossel de bônus (lib/bonus/arte-rota.ts), com a mesma sessão conferida antes de tudo. Esta
// rota só serve o avulso: o carrossel de bônus dá 404 aqui (carrossel-caminho.ts, `ehDaRota`).
//
// A SESSÃO É CONFERIDA AQUI, e não só no proxy.ts, pelo mesmo motivo da rota do bônus: o caminho
// termina em /arte, e um 401 é melhor que um redirect que viraria imagem quebrada.
// tests/bonus-arte-paginas.test.ts confere que isto é a primeira coisa do GET.
//
// O arquivo baixado leva o código do bônus do Labs, ou "carrossel" no texto livre (`nomeDoArquivo`).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ cid: string }> }) {
  const jarra = await cookies();
  if (!isValidSession(jarra.get(SESSION_COOKIE)?.value)) return erro(401, TEXTO_ARTE_SEM_SESSAO);
  const { cid } = await params;
  if (!ehIdDeBonus(cid)) return erro(404, TEXTO_ARTE_NAO_ENCONTRADA);
  const pedido = new URL(request.url).searchParams;
  const conferido = conferirPedidoDaArte(await lerCarrossel(cid), { tipo: "avulso" }, pedido.get("slide"));
  if (!conferido.ok) return erro(conferido.status, conferido.texto);
  return desenharSlide({
    ...conferido,
    doCookie: jarra.get(ACCOUNT_COOKIE)?.value,
    baixar: pedido.get("baixar") === "1",
    slug: async () => conferido.linha.labs_codigo,
  });
}
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx vitest run tests/bonus-arte-paginas.test.ts tests/bonus-arte-resposta.test.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-arte-rota.integracao.ts
```

Esperado: `tsc` limpo; os 37 puros passam (21 das guardas e 16 da resposta da arte); na integração, `[rede-global] ALVO: banco de TESTE` e os 2 passam.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/arte-rota.ts "app/bonus/[id]/carrossel/[cid]/arte/route.tsx" "app/carrosseis/[cid]/arte/route.tsx" tests/bonus-arte-paginas.test.ts testes-integracao/bonus-arte-rota.integracao.ts
test "$(git branch --show-current)" = "carrossel-avulso"
git add lib/bonus/arte-rota.ts "app/bonus/[id]/carrossel/[cid]/arte/route.tsx" "app/carrosseis/[cid]/arte/route.tsx" tests/bonus-arte-paginas.test.ts testes-integracao/bonus-arte-rota.integracao.ts
git commit -m "feat(bonus): a arte do carrossel avulso, com o desenho do slide comum às duas rotas"
```

---

### FASE 7.10 — A página do carrossel avulso, com a mesma revisão da página de bônus

**Arquivos:**
- Criar: `app/bonus/[id]/carrossel/[cid]/revisao.tsx` (o componente `Revisao`, tirado de `page.tsx`
  sem mudar o que faz), `app/carrosseis/[cid]/page.tsx`
- Modificar: `app/bonus/[id]/carrossel/[cid]/page.tsx`
- Testar: `tests/bonus-avulso-paginas.test.ts`, `tests/bonus-carrossel-paginas.test.ts`,
  `tests/bonus-publicar-paginas.test.ts`, `tests/bonus-paginas.test.ts`

**Interfaces:**
- Consome: `ehDaRota` (FASE 7.2); `textoDaOrigem` (FASE 7.4); `gerarAvulsoDeNovo` (FASE 7.7);
  `situacaoNoLabs`, `urlPublicaDoBonus`, `avisoDePalavraTrocada`, `quadroDaSituacao`.
- Produz: `Revisao({ carrossel })` (`revisao.tsx`, `export default`), usado pelas duas páginas; a
  página `/carrosseis/[cid]`, com `maxDuration = 300` e 404 para o carrossel de bônus.

- [ ] **Passo 1: os testes**

Em `tests/bonus-avulso-paginas.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-avulso-paginas.test.ts b/tests/bonus-avulso-paginas.test.ts
index 8579167..7a2b084 100644
--- a/tests/bonus-avulso-paginas.test.ts
+++ b/tests/bonus-avulso-paginas.test.ts
@@ -81,3 +81,24 @@ describe("o pedido do avulso responde sem recriar a página na recusa", () => {
     expect(corpo.match(/redirect\(/g) ?? []).toHaveLength(1);
   });
 });
+
+// A PÁGINA DO AVULSO (spec da Etapa 7, "A página do carrossel avulso"): a mesma parte de dentro da
+// página do carrossel de bônus, e só o topo muda.
+describe("a página do carrossel avulso", () => {
+  const PAGINA = "app/carrosseis/[cid]/page.tsx";
+
+  it("declara o mesmo maxDuration de lib/bonus/tempos.ts: o Gerar de novo roda no after() dela", () => {
+    const m = /export const maxDuration = (\d+);/.exec(ler(PAGINA));
+    expect(m?.[1]).toBe(String(MAX_DURATION_S));
+  });
+
+  it("só serve o avulso: o carrossel de bônus dá 404 aqui", () => {
+    expect(ler(PAGINA)).toContain('if (!carrossel || !ehDaRota(carrossel, { tipo: "avulso" })) notFound();');
+  });
+
+  it("acompanha a geração com o componente da Etapa 1, e gera de novo pela action do avulso", () => {
+    const pagina = ler(PAGINA);
+    expect(pagina).toContain('import Acompanhar from "@/app/bonus/[id]/acompanhar";');
+    expect(pagina).toContain("<form action={gerarAvulsoDeNovo}>");
+  });
+});
```

Em `tests/bonus-carrossel-paginas.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-carrossel-paginas.test.ts b/tests/bonus-carrossel-paginas.test.ts
index 0314a9d..b5a552f 100644
--- a/tests/bonus-carrossel-paginas.test.ts
+++ b/tests/bonus-carrossel-paginas.test.ts
@@ -17,12 +17,18 @@ describe("a página do carrossel", () => {
   });
 
   // Na Etapa 4, a página entrega as três actions ao editor (editor-do-carrossel.tsx): a do slide
-  // vai a cada card, a da arte grava o "só texto", e a da conta é o "Fixar nesta conta".
+  // vai a cada card, a da arte grava o "só texto", e a da conta é o "Fixar nesta conta". Desde a
+  // Etapa 7, quem entrega é a parte de dentro da página (revisao.tsx), comum às duas páginas.
   it("entrega a action do slide, a da arte e a da conta ao editor do carrossel", () => {
-    const pagina = ler("app/bonus/[id]/carrossel/[cid]/page.tsx");
-    expect(pagina).toContain("acaoDoSlide={salvarSlideDoCarrossel}");
-    expect(pagina).toContain("acaoDaArte={salvarArteDoCarrossel}");
-    expect(pagina).toContain("acaoDaConta={fixarContaDoCarrossel}");
+    const revisao = ler("app/bonus/[id]/carrossel/[cid]/revisao.tsx");
+    expect(revisao).toContain("acaoDoSlide={salvarSlideDoCarrossel}");
+    expect(revisao).toContain("acaoDaArte={salvarArteDoCarrossel}");
+    expect(revisao).toContain("acaoDaConta={fixarContaDoCarrossel}");
+  });
+
+  it("a página do carrossel de bônus e a do avulso desenham a mesma revisão", () => {
+    expect(ler("app/bonus/[id]/carrossel/[cid]/page.tsx")).toContain('import Revisao from "./revisao";');
+    expect(ler("app/carrosseis/[cid]/page.tsx")).toContain('import Revisao from "@/app/bonus/[id]/carrossel/[cid]/revisao";');
   });
 });
 
```

Em `tests/bonus-publicar-paginas.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-publicar-paginas.test.ts b/tests/bonus-publicar-paginas.test.ts
index f0525f0..aa5c479 100644
--- a/tests/bonus-publicar-paginas.test.ts
+++ b/tests/bonus-publicar-paginas.test.ts
@@ -76,8 +76,9 @@ describe("as frases das actions", () => {
 });
 
 describe("a página do carrossel entrega a publicação ao editor", () => {
+  // Desde a Etapa 7, a parte de dentro da página (revisao.tsx) é quem entrega, às duas páginas.
   it("as três actions da publicação, e o estado lido da fila", () => {
-    const pagina = ler("app/bonus/[id]/carrossel/[cid]/page.tsx");
+    const pagina = ler("app/bonus/[id]/carrossel/[cid]/revisao.tsx");
     expect(pagina).toContain("acaoDaAssinatura: assinarImagemDoCarrossel");
     expect(pagina).toContain("acaoDaImagem: guardarImagemDoSlide");
     expect(pagina).toContain("acaoDaPublicacao: publicarCarrossel");
```

Em `tests/bonus-paginas.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-paginas.test.ts b/tests/bonus-paginas.test.ts
index 81335de..202819d 100644
--- a/tests/bonus-paginas.test.ts
+++ b/tests/bonus-paginas.test.ts
@@ -64,9 +64,12 @@ describe("nenhum campo de revisão do bônus volta a ser não controlado", () =>
     "app/bonus/[id]/campo-do-envio.tsx",
     "app/bonus/[id]/formulario-do-envio.tsx",
     "app/bonus/[id]/carrossel/[cid]/page.tsx",
+    "app/bonus/[id]/carrossel/[cid]/revisao.tsx",
     "app/bonus/[id]/carrossel/[cid]/campo.tsx",
     "app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx",
     "app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx",
+    "app/carrosseis/novo/formulario-do-avulso.tsx",
+    "app/carrosseis/[cid]/page.tsx",
   ])("%s não usa defaultValue", (arquivo) => {
     const semComentarios = ler(arquivo)
       .split("\n")
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-avulso-paginas.test.ts tests/bonus-carrossel-paginas.test.ts tests/bonus-publicar-paginas.test.ts tests/bonus-paginas.test.ts
```

Esperado: 8 caem e 47 passam (55): a página nova e o `revisao.tsx` ainda não existem.

- [ ] **Passo 3: o código**

Crie `app/bonus/[id]/carrossel/[cid]/revisao.tsx`:

```tsx
import { cookies } from "next/headers";
import { alertError } from "@/app/ui";
import { fixarContaDoCarrossel, salvarArteDoCarrossel, salvarSlideDoCarrossel } from "@/app/bonus/carrossel-actions";
import { assinarImagemDoCarrossel, guardarImagemDoSlide, publicarCarrossel } from "@/app/bonus/publicar-actions";
import { ACCOUNT_COOKIE } from "@/lib/account";
import { urlPublicaSeDerParaMontar } from "@/lib/bucket";
import { contaSelecionada, resolverConta } from "@/lib/bonus/arte-conta";
import { escolhasDaArte } from "@/lib/bonus/arte-escolhas";
import { slidesDoTexto } from "@/lib/bonus/arte-slides";
import { cabecalhoParaVersao, versoesDosSlides } from "@/lib/bonus/arte-tela";
import { TEXTO_ARTE_SEM_CONTA, rotuloDaConta, textoDaOrigemDaConta } from "@/lib/bonus/arte-textos";
import { caminhoDoCarrossel } from "@/lib/bonus/carrossel-caminho";
import type { LinhaDoCarrossel } from "@/lib/bonus/carrossel-linha";
import { contasParaArte } from "@/lib/bonus/carrossel-repositorio";
import { textoDaLinhaDoCarrossel } from "@/lib/bonus/carrossel-tela";
import { camposDoFormulario, valoresPorCampo } from "@/lib/bonus/carrossel-texto";
import { TEXTO_CARROSSEL_SEM_TEXTO } from "@/lib/bonus/carrossel-textos";
import { publicacaoLivre } from "@/lib/bonus/publicar-estado";
import { fotosDaArte, imagensDaArte, versaoDoTextoDoSlide } from "@/lib/bonus/publicar-regras";
import { estadoDoCarrossel } from "@/lib/bonus/publicar-repositorio";
import { textoDaTrava, textoDoCalendario, textoDoEstadoDaPublicacao, tomDoEstadoDaPublicacao } from "@/lib/bonus/publicar-textos";
import EditorDoCarrossel from "./editor-do-carrossel";
import type { PublicacaoNaTela } from "./publicacao-na-tela";

// A PARTE DE DENTRO DA PÁGINA DO CARROSSEL, quando ele está pronto (a revisão slide a slide, a arte e a
// publicação). Até a Etapa 5 ela morava em page.tsx; na Etapa 7 veio para cá, sem mudar o que faz,
// para servir também à página do carrossel avulso (app/carrosseis/[cid]/page.tsx).

/**
 * O CARROSSEL PRONTO, SLIDE A SLIDE (editor-do-carrossel.tsx, spec da Etapa 4). A conta é a do
 * carrossel (arte-conta.ts): a página mostra qual é, avisa quando ela saiu do Chat, e oferece "Fixar
 * nesta conta" ao carrossel de antes de a conta ser gravada. Cada miniatura tem a sua versão, o resumo
 * de tudo o que a rota desenha naquele slide (arte-tela.ts, `versoesDosSlides`).
 *
 * A PUBLICAÇÃO (spec da Etapa 5) é decidida aqui, no servidor: as imagens do Canva guardadas, com o
 * endereço público delas; a versão do texto de cada slide; o estado lido da fila pela chave exata; a
 * trava; e o aviso do calendário, que só mostra a conta selecionada no menu.
 */
export default async function Revisao({ carrossel }: { carrossel: LinhaDoCarrossel }) {
  const texto = textoDaLinhaDoCarrossel(carrossel);
  if (!texto) return <div className={alertError}>{TEXTO_CARROSSEL_SEM_TEXTO}</div>;

  const contas = await contasParaArte();
  const escolhas = escolhasDaArte(carrossel.arte, carrossel.total_slides);
  const doCookie = (await cookies()).get(ACCOUNT_COOKIE)?.value;
  const { conta, origem } = resolverConta(contas, escolhas, doCookie);

  const estado = await estadoDoCarrossel(carrossel.arte);
  const filaId = "filaId" in estado ? estado.filaId : null;
  const noMenu = contaSelecionada(contas, doCookie);
  // O jeito de cada imagem é o prefixo do caminho (adendo da Etapa 5): as fotos são as de `bonus-foto`.
  const fotos = fotosDaArte(carrossel.arte, carrossel.total_slides);
  const publicacao: PublicacaoNaTela = {
    acaoDaAssinatura: assinarImagemDoCarrossel,
    acaoDaImagem: guardarImagemDoSlide,
    acaoDaPublicacao: publicarCarrossel,
    imagens: Object.fromEntries(
      Object.entries(imagensDaArte(carrossel.arte, carrossel.total_slides)).map(([n, i]) => [
        n,
        { url: urlPublicaSeDerParaMontar(i.caminho), versao: i.versao, jeito: Number(n) in fotos ? "foto" : "slide" },
      ])
    ),
    versoesDoTexto: slidesDoTexto(texto).map(versaoDoTextoDoSlide),
    travado: publicacaoLivre(estado) ? null : textoDaTrava(estado),
    origem,
    arroba: origem === "gravada" ? (conta?.username ?? null) : null,
    estado: { texto: textoDoEstadoDaPublicacao(estado), tom: tomDoEstadoDaPublicacao(estado), filaId, livre: publicacaoLivre(estado) },
    avisoDoCalendario:
      filaId && conta && escolhas.conta && noMenu?.ig_user_id !== escolhas.conta ? textoDoCalendario(rotuloDaConta(conta)) : null,
  };

  return (
    <EditorDoCarrossel
      acaoDoSlide={salvarSlideDoCarrossel}
      acaoDaArte={salvarArteDoCarrossel}
      acaoDaConta={fixarContaDoCarrossel}
      caminho={caminhoDoCarrossel(carrossel)}
      carrosselId={carrossel.id}
      palavra={carrossel.palavra}
      total={carrossel.total_slides}
      campos={camposDoFormulario(carrossel.total_slides)}
      valores={valoresPorCampo(texto)}
      rotuloDaConta={conta ? rotuloDaConta(conta) : null}
      avisoDaConta={conta ? textoDaOrigemDaConta(origem, conta.username ?? "") : TEXTO_ARTE_SEM_CONTA}
      podeFixar={origem === "selecionada" && conta !== null}
      soTextoInicial={escolhas.soTexto}
      versoes={versoesDosSlides(slidesDoTexto(texto), escolhas.soTexto, cabecalhoParaVersao(conta), fotos)}
      publicacao={publicacao}
    />
  );
}
```

Em `app/bonus/[id]/carrossel/[cid]/page.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/[id]/carrossel/[cid]/page.tsx b/app/bonus/[id]/carrossel/[cid]/page.tsx
index be604b4..812b361 100644
--- a/app/bonus/[id]/carrossel/[cid]/page.tsx
+++ b/app/bonus/[id]/carrossel/[cid]/page.tsx
@@ -1,45 +1,20 @@
 import Link from "next/link";
-import { cookies } from "next/headers";
 import { notFound } from "next/navigation";
 import { alertError, alertOk, alertWarn, btnPrimary, card, hint, link, pageSubtitle, pageTitle, skeleton } from "@/app/ui";
-import {
-  fixarContaDoCarrossel,
-  gerarCarrosselDeNovo,
-  salvarArteDoCarrossel,
-  salvarSlideDoCarrossel,
-} from "@/app/bonus/carrossel-actions";
-import { assinarImagemDoCarrossel, guardarImagemDoSlide, publicarCarrossel } from "@/app/bonus/publicar-actions";
-import { ACCOUNT_COOKIE } from "@/lib/account";
+import { gerarCarrosselDeNovo } from "@/app/bonus/carrossel-actions";
 import { avisoDaUrl } from "@/lib/avisos";
-import { urlPublicaSeDerParaMontar } from "@/lib/bucket";
-import { contaSelecionada, resolverConta } from "@/lib/bonus/arte-conta";
-import { escolhasDaArte } from "@/lib/bonus/arte-escolhas";
-import { slidesDoTexto } from "@/lib/bonus/arte-slides";
-import { cabecalhoParaVersao, versoesDosSlides } from "@/lib/bonus/arte-tela";
-import { publicacaoLivre } from "@/lib/bonus/publicar-estado";
-import { fotosDaArte, imagensDaArte, versaoDoTextoDoSlide } from "@/lib/bonus/publicar-regras";
-import { estadoDoCarrossel } from "@/lib/bonus/publicar-repositorio";
-import { textoDaTrava, textoDoCalendario, textoDoEstadoDaPublicacao, tomDoEstadoDaPublicacao } from "@/lib/bonus/publicar-textos";
-import { TEXTO_ARTE_SEM_CONTA, rotuloDaConta, textoDaOrigemDaConta } from "@/lib/bonus/arte-textos";
-import { caminhoDoCarrossel, ehDaRota } from "@/lib/bonus/carrossel-caminho";
+import { ehDaRota } from "@/lib/bonus/carrossel-caminho";
 import type { LinhaDoCarrossel } from "@/lib/bonus/carrossel-linha";
-import { contasParaArte, lerCarrossel } from "@/lib/bonus/carrossel-repositorio";
+import { lerCarrossel } from "@/lib/bonus/carrossel-repositorio";
 import { descricaoDoCarrossel, textoDaLinhaDoCarrossel } from "@/lib/bonus/carrossel-tela";
-import { camposDoFormulario, valoresPorCampo } from "@/lib/bonus/carrossel-texto";
-import {
-  TEXTO_CARROSSEL_SEM_TEXTO,
-  TEXTO_TABELA_CARROSSEL_AUSENTE,
-  avisoDePalavraTrocada,
-  quadroDaSituacao,
-} from "@/lib/bonus/carrossel-textos";
+import { TEXTO_TABELA_CARROSSEL_AUSENTE, avisoDePalavraTrocada, quadroDaSituacao } from "@/lib/bonus/carrossel-textos";
 import { ehTabelaAusente } from "@/lib/bonus/erros";
 import { situacaoNoLabs, type SituacaoNoLabs } from "@/lib/bonus/publicado";
 import { lerLinha } from "@/lib/bonus/repositorio";
 import { geracaoNaTela } from "@/lib/bonus/tempos";
 import { TEXTO_TRAVOU, type TomDoQuadro } from "@/lib/bonus/textos";
 import Acompanhar from "../../acompanhar";
-import EditorDoCarrossel from "./editor-do-carrossel";
-import type { PublicacaoNaTela } from "./publicacao-na-tela";
+import Revisao from "./revisao";
 
 // O teto de lib/bonus/tempos.ts (MAX_DURATION_S). O Next exige literal aqui, e
 // tests/bonus-carrossel-paginas.test.ts confere que é o mesmo número. O "Gerar de novo" desta
@@ -137,67 +112,3 @@ async function situacaoDoBonus(bonusId: string): Promise<SituacaoNoLabs> {
   const bonus = await lerLinha(bonusId);
   return bonus?.slug ? situacaoNoLabs(process.env.LABS_URL, bonus.slug) : { tipo: "nao_publicado" };
 }
-
-/**
- * O CARROSSEL PRONTO, SLIDE A SLIDE (editor-do-carrossel.tsx, spec da Etapa 4). A conta é a do
- * carrossel (arte-conta.ts): a página mostra qual é, avisa quando ela saiu do Chat, e oferece "Fixar
- * nesta conta" ao carrossel de antes de a conta ser gravada. Cada miniatura tem a sua versão, o resumo
- * de tudo o que a rota desenha naquele slide (arte-tela.ts, `versoesDosSlides`).
- *
- * A PUBLICAÇÃO (spec da Etapa 5) é decidida aqui, no servidor: as imagens do Canva guardadas, com o
- * endereço público delas; a versão do texto de cada slide; o estado lido da fila pela chave exata; a
- * trava; e o aviso do calendário, que só mostra a conta selecionada no menu.
- */
-async function Revisao({ carrossel }: { carrossel: LinhaDoCarrossel }) {
-  const texto = textoDaLinhaDoCarrossel(carrossel);
-  if (!texto) return <div className={alertError}>{TEXTO_CARROSSEL_SEM_TEXTO}</div>;
-
-  const contas = await contasParaArte();
-  const escolhas = escolhasDaArte(carrossel.arte, carrossel.total_slides);
-  const doCookie = (await cookies()).get(ACCOUNT_COOKIE)?.value;
-  const { conta, origem } = resolverConta(contas, escolhas, doCookie);
-
-  const estado = await estadoDoCarrossel(carrossel.arte);
-  const filaId = "filaId" in estado ? estado.filaId : null;
-  const noMenu = contaSelecionada(contas, doCookie);
-  // O jeito de cada imagem é o prefixo do caminho (adendo da Etapa 5): as fotos são as de `bonus-foto`.
-  const fotos = fotosDaArte(carrossel.arte, carrossel.total_slides);
-  const publicacao: PublicacaoNaTela = {
-    acaoDaAssinatura: assinarImagemDoCarrossel,
-    acaoDaImagem: guardarImagemDoSlide,
-    acaoDaPublicacao: publicarCarrossel,
-    imagens: Object.fromEntries(
-      Object.entries(imagensDaArte(carrossel.arte, carrossel.total_slides)).map(([n, i]) => [
-        n,
-        { url: urlPublicaSeDerParaMontar(i.caminho), versao: i.versao, jeito: Number(n) in fotos ? "foto" : "slide" },
-      ])
-    ),
-    versoesDoTexto: slidesDoTexto(texto).map(versaoDoTextoDoSlide),
-    travado: publicacaoLivre(estado) ? null : textoDaTrava(estado),
-    origem,
-    arroba: origem === "gravada" ? (conta?.username ?? null) : null,
-    estado: { texto: textoDoEstadoDaPublicacao(estado), tom: tomDoEstadoDaPublicacao(estado), filaId, livre: publicacaoLivre(estado) },
-    avisoDoCalendario:
-      filaId && conta && escolhas.conta && noMenu?.ig_user_id !== escolhas.conta ? textoDoCalendario(rotuloDaConta(conta)) : null,
-  };
-
-  return (
-    <EditorDoCarrossel
-      acaoDoSlide={salvarSlideDoCarrossel}
-      acaoDaArte={salvarArteDoCarrossel}
-      acaoDaConta={fixarContaDoCarrossel}
-      caminho={caminhoDoCarrossel(carrossel)}
-      carrosselId={carrossel.id}
-      palavra={carrossel.palavra}
-      total={carrossel.total_slides}
-      campos={camposDoFormulario(carrossel.total_slides)}
-      valores={valoresPorCampo(texto)}
-      rotuloDaConta={conta ? rotuloDaConta(conta) : null}
-      avisoDaConta={conta ? textoDaOrigemDaConta(origem, conta.username ?? "") : TEXTO_ARTE_SEM_CONTA}
-      podeFixar={origem === "selecionada" && conta !== null}
-      soTextoInicial={escolhas.soTexto}
-      versoes={versoesDosSlides(slidesDoTexto(texto), escolhas.soTexto, cabecalhoParaVersao(conta), fotos)}
-      publicacao={publicacao}
-    />
-  );
-}
```

Crie `app/carrosseis/[cid]/page.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { alertError, alertOk, alertWarn, btnPrimary, card, hint, link, pageSubtitle, pageTitle, skeleton } from "@/app/ui";
import Acompanhar from "@/app/bonus/[id]/acompanhar";
import Revisao from "@/app/bonus/[id]/carrossel/[cid]/revisao";
import { avisoDaUrl } from "@/lib/avisos";
import { textoDaOrigem } from "@/lib/bonus/avulso-textos";
import { ehDaRota } from "@/lib/bonus/carrossel-caminho";
import type { LinhaDoCarrossel } from "@/lib/bonus/carrossel-linha";
import { lerCarrossel } from "@/lib/bonus/carrossel-repositorio";
import { descricaoDoCarrossel, textoDaLinhaDoCarrossel } from "@/lib/bonus/carrossel-tela";
import { TEXTO_TABELA_CARROSSEL_AUSENTE, avisoDePalavraTrocada, quadroDaSituacao } from "@/lib/bonus/carrossel-textos";
import { ehTabelaAusente } from "@/lib/bonus/erros";
import { urlPublicaDoBonus } from "@/lib/bonus/labs";
import { situacaoNoLabs } from "@/lib/bonus/publicado";
import { geracaoNaTela } from "@/lib/bonus/tempos";
import { TEXTO_TRAVOU, type TomDoQuadro } from "@/lib/bonus/textos";
import { gerarAvulsoDeNovo } from "../actions";

// A PÁGINA DO CARROSSEL AVULSO (spec da Etapa 7): a mesma da Etapa 5, com a mesma parte de dentro
// (revisao.tsx: os cards, a legenda, o "Baixar todos", a foto, o slide pronto e o "Publicar"). Muda
// só o topo: a origem, a palavra e, no avulso do Labs, a situação do bônus lá.
//
// O teto de lib/bonus/tempos.ts (MAX_DURATION_S): o "Gerar de novo" desta página corre sob ele. O
// Next exige literal aqui, e tests/bonus-avulso-paginas.test.ts confere que é o mesmo número.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const QUADRO: Record<TomDoQuadro, string> = { ok: alertOk, atencao: alertWarn, erro: alertError };

export default async function PaginaDoAvulso({
  params,
  searchParams,
}: {
  params: Promise<{ cid: string }>;
  searchParams: Promise<{ aviso?: string; tom?: string }>;
}) {
  const { cid } = await params;
  const sp = await searchParams;
  const aviso = avisoDaUrl(sp.aviso, sp.tom);

  let carrossel: LinhaDoCarrossel | null;
  try {
    carrossel = await lerCarrossel(cid);
  } catch (erro) {
    if (!ehTabelaAusente(erro)) throw erro;
    return <div className={alertError}>{TEXTO_TABELA_CARROSSEL_AUSENTE}</div>;
  }
  if (!carrossel || !ehDaRota(carrossel, { tipo: "avulso" })) notFound();

  // Server Component `async` e `force-dynamic`: roda UMA vez por requisição, e ler o
  // relógio aqui é o comportamento pedido. A regra trata todo arquivo como cliente;
  // o dono silencia do mesmo jeito, com o motivo por extenso, em app/page.tsx:322-333.
  // eslint-disable-next-line react-hooks/purity
  const agora = Date.now();
  const geracao = geracaoNaTela(carrossel.estado, carrossel.criado_em, agora);
  const texto = textoDaLinhaDoCarrossel(carrossel);

  // NO AVULSO DO LABS, A SITUAÇÃO DO BÔNUS É LIDA A CADA VEZ, como na página do carrossel de bônus, e
  // pelo mesmo motivo: o bônus pode ser despublicado ou trocar de palavra no /admin do Labs depois de
  // gerar. Durante a geração não, porque a tela pergunta ao servidor a cada 2 s.
  const codigo = carrossel.origem === "labs" ? carrossel.labs_codigo : null;
  const situacao = codigo && geracao !== "gerando" ? await situacaoNoLabs(process.env.LABS_URL, codigo) : null;
  const quadro = situacao ? quadroDaSituacao(situacao) : null;
  const trocada =
    situacao?.tipo === "publicado" && situacao.bonus.palavra !== carrossel.palavra ? situacao.bonus.palavra : null;
  const publico = codigo ? urlPublicaDoBonus(process.env.LABS_URL, codigo) : null;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/carrosseis" className={link}>
          Voltar para os carrosséis
        </Link>
        <h1 className={`mt-2 ${pageTitle}`}>{texto?.titulo ?? descricaoDoCarrossel(carrossel)}</h1>
        <p className={pageSubtitle}>
          {textoDaOrigem(carrossel)} · {descricaoDoCarrossel(carrossel)} · palavra {carrossel.palavra}
        </p>
        {publico && (
          <a href={publico} target="_blank" rel="noreferrer" className={`mt-1 inline-block text-sm ${link}`}>
            Ver o bônus no Labs
          </a>
        )}
      </div>

      {aviso && <div className={aviso.tom === "ok" ? alertOk : alertError}>{aviso.texto}</div>}
      {quadro && <div className={QUADRO[quadro.tom]}>{quadro.texto}</div>}
      {trocada && <div className={alertWarn}>{avisoDePalavraTrocada(trocada, carrossel.palavra)}</div>}

      {geracao === "gerando" && (
        <section className={`${card} space-y-3 p-6`}>
          <div className={`h-4 w-2/3 ${skeleton}`} />
          <div className={`h-4 w-1/2 ${skeleton}`} />
          <div className={`h-24 ${skeleton}`} />
          <Acompanhar criadoEmMs={carrossel.criado_em.getTime()} />
        </section>
      )}

      {(geracao === "falhou" || geracao === "travou") && (
        <section className={`${card} space-y-4 p-6`}>
          <div className={alertError}>
            {geracao === "travou" ? TEXTO_TRAVOU : (carrossel.erro ?? "A geração falhou sem dizer o motivo.")}
          </div>
          <form action={gerarAvulsoDeNovo}>
            <input type="hidden" name="id" value={carrossel.id} />
            <button type="submit" className={btnPrimary}>
              Gerar de novo
            </button>
          </form>
          <p className={hint}>Conta como uma das gerações de carrossel do dia.</p>
        </section>
      )}

      {geracao === "pronto" && <Revisao carrossel={carrossel} />}
    </div>
  );
}
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx vitest run tests/bonus-avulso-paginas.test.ts tests/bonus-carrossel-paginas.test.ts tests/bonus-publicar-paginas.test.ts tests/bonus-paginas.test.ts
```

Esperado: `tsc` limpo; os 55 passam.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" "app/bonus/[id]/carrossel/[cid]/revisao.tsx" "app/bonus/[id]/carrossel/[cid]/page.tsx" "app/carrosseis/[cid]/page.tsx" tests/bonus-avulso-paginas.test.ts tests/bonus-carrossel-paginas.test.ts tests/bonus-publicar-paginas.test.ts tests/bonus-paginas.test.ts
test "$(git branch --show-current)" = "carrossel-avulso"
git add "app/bonus/[id]/carrossel/[cid]/revisao.tsx" "app/bonus/[id]/carrossel/[cid]/page.tsx" "app/carrosseis/[cid]/page.tsx" tests/bonus-avulso-paginas.test.ts tests/bonus-carrossel-paginas.test.ts tests/bonus-publicar-paginas.test.ts tests/bonus-paginas.test.ts
git commit -m "feat(bonus): a página do carrossel avulso, com a mesma revisão da página de bônus"
```

---

### FASE 7.11 — O menu Carrosséis, a lista de todos e o aviso do funil

**Arquivos:**
- Criar: `lib/bonus/carrosseis-tela.ts`, `app/carrosseis/page.tsx`
- Modificar: `lib/bonus/publicar-textos.ts`, `app/app-shell.tsx` (o item do menu e o ícone), e em
  `app/bonus/[id]/carrossel/[cid]/`: `publicacao-na-tela.ts`, `card-publicar.tsx`, `revisao.tsx`
- Testar: `tests/bonus-carrosseis-tela.test.ts`, `tests/bonus-publicar-estado.test.ts`,
  `tests/bonus-avulso-paginas.test.ts`, `testes-dom/bonus-card-publicar.dom.tsx`

**Interfaces:**
- Consome: `caminhoDoCarrossel` (FASE 7.2); `textoDaOrigem` (FASE 7.4); `listarCarrosseis` (FASE 7.5);
  `estadoDoCarrossel`, `publicacaoDaArte` (Etapa 5); `rotuloDoCarrossel`, `descricaoDoCarrossel`.
- Produz, de `publicar-textos.ts`: `textoDoFunil(estado, palavra): string | null` (só no agendado,
  publicando e publicado); `rotuloDaPublicacao(estado): { texto; tipo } | null`.
- Produz, de `carrosseis-tela.ts`: `type ItemDaListaDeCarrosseis`; `itemDaListaDeCarrosseis(l, estado,
  agoraMs)`.
- Muda: `PublicacaoNaTela` ganha `avisoDoFunil?: string | null`, preenchido em `revisao.tsx`; o
  `CardPublicar` mostra o aviso com o caminho "Abrir as automações" (`Link` para `/automacoes`); o
  menu ganha `{ href: "/carrosseis", label: "Carrosséis", icon: IconCamera }`, logo depois do "Bônus".

- [ ] **Passo 1: os testes**

Crie `tests/bonus-carrosseis-tela.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { itemDaListaDeCarrosseis } from "@/lib/bonus/carrosseis-tela";
import type { LinhaDoCarrossel } from "@/lib/bonus/carrossel-linha";
import type { TextoDoCarrossel } from "@/lib/bonus/carrossel-texto";

// O QUE A LISTA "CARROSSÉIS" MOSTRA DE CADA CARROSSEL (spec da Etapa 7, "O menu Carrosséis"): os de
// bônus e os avulsos, cada um com o endereço da página dele, a origem, a conta, os slides, o estado
// da geração e, quando há, o da publicação. A página é de servidor; quem decide é esta função.

const T0 = Date.parse("2026-10-07T12:00:00Z");
const BONUS = "0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f";
const CARROSSEL = "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d";
const TEXTO: TextoDoCarrossel = {
  tipo: "post",
  titulo: "Conselheiro brutalmente honesto",
  texto: "T".repeat(80),
  chamada: "Comente BRUTAL e receba.",
  legenda: "L".repeat(100),
};

function linha(troca: Partial<LinhaDoCarrossel>): LinhaDoCarrossel {
  return {
    id: CARROSSEL,
    bonus_id: null,
    criado_em: new Date(T0),
    total_slides: 5,
    palavra: "BRUTAL",
    contexto: { tipo: "livre", tema: "Produtividade", conteudo: "Um prompt." },
    estado: "pronto",
    gerado: TEXTO,
    revisado: null,
    erro: null,
    medicao: null,
    gerado_em: new Date(T0),
    revisado_em: null,
    arte: {},
    origem: "livre",
    labs_codigo: null,
    texto_a_mao: true,
    ...troca,
  };
}

describe("o item da lista Carrosséis", () => {
  it("o do texto livre: a página do avulso, o título do texto, a origem, a conta e os slides", () => {
    const item = itemDaListaDeCarrosseis(linha({ arte: { conta: "1001", arroba: "thiagovannuchi" } }), null, T0);
    expect(item).toEqual({
      id: CARROSSEL,
      href: `/carrosseis/${CARROSSEL}`,
      titulo: "Conselheiro brutalmente honesto",
      origem: "Texto livre: Produtividade",
      detalhe: "@thiagovannuchi · Carrossel de 5 slides",
      geracao: { texto: "Pronto para revisar", tipo: "neutro" },
      publicacao: null,
    });
  });

  it("o do bônus do Labs, sem conta e ainda gerando: o título fica a descrição", () => {
    const item = itemDaListaDeCarrosseis(
      linha({
        origem: "labs",
        labs_codigo: "conselheiro-brutalmente-honesto",
        contexto: { tema: "Produtividade", titulo: "Conselheiro brutalmente honesto", descricao: "d", oQueResolve: "o" },
        estado: "gerando",
        gerado: null,
        texto_a_mao: false,
      }),
      null,
      T0
    );
    expect([item.href, item.titulo, item.origem, item.detalhe, item.geracao.texto]).toEqual([
      `/carrosseis/${CARROSSEL}`,
      "Carrossel de 5 slides",
      "Bônus do Labs: Conselheiro brutalmente honesto",
      "Carrossel de 5 slides",
      "Gerando",
    ]);
  });

  it("o de bônus do Chat: a página de hoje, embaixo do bônus, com o estado da publicação", () => {
    const item = itemDaListaDeCarrosseis(
      linha({ origem: "bonus", bonus_id: BONUS, contexto: {}, revisado_em: new Date(T0) }),
      { tipo: "agendado", quando: new Date(T0 + 3_600_000), filaId: "f1" },
      T0
    );
    expect([item.href, item.origem, item.geracao, item.publicacao]).toEqual([
      `/bonus/${BONUS}/carrossel/${CARROSSEL}`,
      "Bônus do Chat",
      { texto: "Revisado", tipo: "ok" },
      { texto: "Agendado", tipo: "neutro" },
    ]);
  });
});
```

Em `tests/bonus-publicar-estado.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-publicar-estado.test.ts b/tests/bonus-publicar-estado.test.ts
index ecbff34..0e41ede 100644
--- a/tests/bonus-publicar-estado.test.ts
+++ b/tests/bonus-publicar-estado.test.ts
@@ -12,11 +12,13 @@ import {
 import type { PublicacaoGuardada } from "@/lib/bonus/publicar-regras";
 import {
   listaDeSlides,
+  rotuloDaPublicacao,
   textoDaFalta,
   textoDaRecusaDaPublicacaoDoCarrossel,
   textoDaTrava,
   textoDoCalendario,
   textoDoEstadoDaPublicacao,
+  textoDoFunil,
   textoDoProblemaDaFoto,
   tomDoEstadoDaPublicacao,
   type RecusaDaPublicacaoDoCarrossel,
@@ -301,3 +303,42 @@ describe("a cor do estado na página", () => {
     expect(tomDoEstadoDaPublicacao({ tipo: "desconhecido" })).toBe("erro");
   });
 });
+
+// O AVISO DO FUNIL (spec da Etapa 7): o post é novo, e a automação da palavra que já existe está presa
+// a outro post (lib/engine.ts:269). Vale para todo carrossel, o de bônus e o avulso.
+describe("o aviso do funil", () => {
+  it("depois de agendar ou publicar, diz a palavra", () => {
+    const frase =
+      "O funil não liga sozinho: depois que o post sair, crie no /automacoes a automação da palavra BRUTAL para este post.";
+    expect(textoDoFunil({ tipo: "agendado", quando: AGORA, filaId: "f" }, "BRUTAL")).toBe(frase);
+    expect(textoDoFunil({ tipo: "publicando", filaId: null }, "BRUTAL")).toBe(frase);
+    expect(textoDoFunil({ tipo: "publicado", em: AGORA, filaId: "f" }, "BRUTAL")).toBe(frase);
+  });
+
+  it.each([
+    { tipo: "livre" },
+    { tipo: "falhou", motivo: null, filaId: "f" },
+    { tipo: "cancelado", filaId: "f" },
+    { tipo: "nao_entrou" },
+    { tipo: "saiu_da_fila" },
+    { tipo: "desconhecido" },
+  ] as EstadoDaPublicacao[])("sem post a caminho, nada: %j", (e) => {
+    expect(textoDoFunil(e, "BRUTAL")).toBeNull();
+  });
+});
+
+// O ESTADO DA PUBLICAÇÃO NA LISTA "CARROSSÉIS" (spec da Etapa 7): uma palavra e a cor, quando há
+// publicação.
+describe("o rótulo da publicação na lista", () => {
+  it("cada estado tem rótulo, e o livre não tem", () => {
+    expect(rotuloDaPublicacao({ tipo: "livre" })).toBeNull();
+    expect(rotuloDaPublicacao({ tipo: "agendado", quando: AGORA, filaId: "f" })).toEqual({ texto: "Agendado", tipo: "neutro" });
+    expect(rotuloDaPublicacao({ tipo: "publicando", filaId: null })).toEqual({ texto: "Publicando", tipo: "neutro" });
+    expect(rotuloDaPublicacao({ tipo: "publicado", em: AGORA, filaId: "f" })).toEqual({ texto: "Publicado", tipo: "ok" });
+    expect(rotuloDaPublicacao({ tipo: "falhou", motivo: null, filaId: "f" })).toEqual({ texto: "Não publicou", tipo: "erro" });
+    expect(rotuloDaPublicacao({ tipo: "cancelado", filaId: "f" })).toEqual({ texto: "Cancelado", tipo: "neutro" });
+    expect(rotuloDaPublicacao({ tipo: "nao_entrou" })).toEqual({ texto: "Não entrou na fila", tipo: "atencao" });
+    expect(rotuloDaPublicacao({ tipo: "saiu_da_fila" })).toEqual({ texto: "Saiu da fila", tipo: "atencao" });
+    expect(rotuloDaPublicacao({ tipo: "desconhecido" })).toEqual({ texto: "Estado desconhecido", tipo: "atencao" });
+  });
+});
```

Em `tests/bonus-avulso-paginas.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-avulso-paginas.test.ts b/tests/bonus-avulso-paginas.test.ts
index 7a2b084..a29a10b 100644
--- a/tests/bonus-avulso-paginas.test.ts
+++ b/tests/bonus-avulso-paginas.test.ts
@@ -102,3 +102,28 @@ describe("a página do carrossel avulso", () => {
     expect(pagina).toContain("<form action={gerarAvulsoDeNovo}>");
   });
 });
+
+// O MENU "CARROSSÉIS" E A LISTA (spec da Etapa 7): um item novo no menu, ao lado do "Bônus", com todos
+// os carrosséis e o botão "Novo carrossel". O item é uma linha em app/app-shell.tsx, como o "Bônus" foi
+// na FASE 1.9.
+describe("o menu Carrosséis", () => {
+  it("o item mora no menu, logo depois do Bônus", () => {
+    const menu = ler("app/app-shell.tsx");
+    const bonus = menu.indexOf('{ href: "/bonus", label: "Bônus"');
+    const carrosseis = menu.indexOf('{ href: "/carrosseis", label: "Carrosséis"');
+    expect(bonus).toBeGreaterThan(-1);
+    expect(carrosseis).toBeGreaterThan(bonus);
+    expect(menu.slice(bonus, carrosseis).split("\n")).toHaveLength(2);
+  });
+
+  it("a lista lê todos os carrosséis, monta cada item fora do JSX e leva ao Novo carrossel", () => {
+    const lista = ler("app/carrosseis/page.tsx");
+    expect(lista).toContain("await listarCarrosseis()");
+    expect(lista).toContain("itemDaListaDeCarrosseis(");
+    expect(lista).toContain('href="/carrosseis/novo"');
+  });
+
+  it("a página do carrossel entrega o aviso do funil, decidido pelo estado da fila", () => {
+    expect(ler("app/bonus/[id]/carrossel/[cid]/revisao.tsx")).toContain("avisoDoFunil: textoDoFunil(estado, carrossel.palavra)");
+  });
+});
```

Em `testes-dom/bonus-card-publicar.dom.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-dom/bonus-card-publicar.dom.tsx b/testes-dom/bonus-card-publicar.dom.tsx
index 79eea56..598bc56 100644
--- a/testes-dom/bonus-card-publicar.dom.tsx
+++ b/testes-dom/bonus-card-publicar.dom.tsx
@@ -138,6 +138,23 @@ describe("o card Publicar, com o carrossel na fila", () => {
     expect(screen.getByText("Para ver no calendário, selecione thiagovannuchi no menu.")).toBeTruthy();
     expect(screen.queryByRole("button", { name: "Publicar" })).toBeNull();
   });
+
+  // O AVISO DO FUNIL (spec da Etapa 7): o post é novo, e a automação da palavra que já existe está
+  // presa a outro post. A página decide quando ele aparece (`textoDoFunil`); o card só o desenha.
+  it("o aviso do funil, com o caminho do /automacoes", () => {
+    renderizar({
+      estado: { texto: "Agendado para 06/10/2026, 18:00 (horário de Brasília).", tom: "ok", filaId: "f1", livre: false },
+      avisoDoFunil: "O funil não liga sozinho: depois que o post sair, crie no /automacoes a automação da palavra SUMIDO para este post.",
+    });
+    expect(screen.getByText(/O funil não liga sozinho/).textContent).toContain("da palavra SUMIDO para este post.");
+    expect(screen.getByRole("link", { name: "Abrir as automações" }).getAttribute("href")).toBe("/automacoes");
+  });
+
+  it("sem o aviso do funil, nem a frase nem o caminho", () => {
+    renderizar({ estado: { texto: null, tom: null, filaId: null, livre: true } });
+    expect(screen.queryByText(/O funil não liga sozinho/)).toBeNull();
+    expect(screen.queryByRole("link", { name: "Abrir as automações" })).toBeNull();
+  });
 });
 
 describe("o não salvo, pelo editor", () => {
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-carrosseis-tela.test.ts tests/bonus-publicar-estado.test.ts tests/bonus-avulso-paginas.test.ts
npx vitest run --config vitest.dom.config.ts testes-dom/bonus-card-publicar.dom.tsx
```

Esperado: os puros: 11 caem e 46 passam (57), e `bonus-carrosseis-tela` cai sem casos; a tela: 1 cai e 12 passam (13).

- [ ] **Passo 3: o código**

Em `lib/bonus/publicar-textos.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/publicar-textos.ts b/lib/bonus/publicar-textos.ts
index 5a37efc..b5a01b7 100644
--- a/lib/bonus/publicar-textos.ts
+++ b/lib/bonus/publicar-textos.ts
@@ -2,6 +2,7 @@ import type { Aviso } from "@/lib/avisos";
 import { fmtDate } from "@/lib/format";
 import type { EstadoDaPublicacao, FaltaParaPublicar } from "./publicar-estado";
 import type { JeitoDaImagem, ProblemaDaFoto, ProblemaDaProporcao } from "./publicar-regras";
+import type { TipoDoRotulo } from "./tela";
 import type { TomDoQuadro } from "./textos";
 
 // AS FRASES DA PUBLICAÇÃO DO CARROSSEL, fora do JSX e das actions (o princípio de
@@ -58,6 +59,41 @@ export function tomDoEstadoDaPublicacao(e: EstadoDaPublicacao): TomDoQuadro | nu
   }
 }
 
+/**
+ * O AVISO DO FUNIL (spec da Etapa 7), depois de agendar ou publicar: o post é novo, e a automação da
+ * palavra que já existe está presa a outro post (lib/engine.ts:269). Quem liga é o operador, no
+ * /automacoes. Antes de mandar, e depois de cancelar ou de falhar, não há post a caminho.
+ */
+export function textoDoFunil(e: EstadoDaPublicacao, palavra: string): string | null {
+  return e.tipo === "agendado" || e.tipo === "publicando" || e.tipo === "publicado"
+    ? `O funil não liga sozinho: depois que o post sair, crie no /automacoes a automação da palavra ${palavra} para este post.`
+    : null;
+}
+
+/** O estado da publicação na lista "Carrosséis" (Etapa 7): uma palavra e a cor. Livre, nada. */
+export function rotuloDaPublicacao(e: EstadoDaPublicacao): { texto: string; tipo: TipoDoRotulo } | null {
+  switch (e.tipo) {
+    case "livre":
+      return null;
+    case "agendado":
+      return { texto: "Agendado", tipo: "neutro" };
+    case "publicando":
+      return { texto: "Publicando", tipo: "neutro" };
+    case "publicado":
+      return { texto: "Publicado", tipo: "ok" };
+    case "falhou":
+      return { texto: "Não publicou", tipo: "erro" };
+    case "cancelado":
+      return { texto: "Cancelado", tipo: "neutro" };
+    case "nao_entrou":
+      return { texto: "Não entrou na fila", tipo: "atencao" };
+    case "saiu_da_fila":
+      return { texto: "Saiu da fila", tipo: "atencao" };
+    case "desconhecido":
+      return { texto: "Estado desconhecido", tipo: "atencao" };
+  }
+}
+
 /** Por que uma edição foi recusada: o carrossel está na fila, ou já saiu. */
 export function textoDaTrava(e: EstadoDaPublicacao): string {
   switch (e.tipo) {
```

Crie `lib/bonus/carrosseis-tela.ts`:

```ts
// O QUE A LISTA "CARROSSÉIS" MOSTRA DE CADA CARROSSEL (spec da Etapa 7, "O menu Carrosséis"), decidido
// fora do JSX, com teste. PURO: a página lê as linhas e o estado da fila, e esta função decide.
import { escolhasDaArte } from "./arte-escolhas";
import { textoDaOrigem } from "./avulso-textos";
import { caminhoDoCarrossel } from "./carrossel-caminho";
import type { LinhaDoCarrossel } from "./carrossel-linha";
import { descricaoDoCarrossel, rotuloDoCarrossel, textoDaLinhaDoCarrossel } from "./carrossel-tela";
import type { EstadoDaPublicacao } from "./publicar-estado";
import { rotuloDaPublicacao } from "./publicar-textos";
import type { TipoDoRotulo } from "./tela";

export type RotuloDaLista = { texto: string; tipo: TipoDoRotulo };

/**
 * Uma linha da lista. `href` é a página do carrossel: a de bônus, embaixo do bônus; a do avulso, em
 * /carrosseis. `detalhe` é a conta (o @ guardado no carrossel) e o número de slides; a data, a página
 * formata.
 */
export type ItemDaListaDeCarrosseis = {
  id: string;
  href: string;
  titulo: string;
  origem: string;
  detalhe: string;
  geracao: RotuloDaLista;
  publicacao: RotuloDaLista | null;
};

/** `estado` é o da fila, só para o carrossel que tem publicação; null nos outros. */
export function itemDaListaDeCarrosseis(l: LinhaDoCarrossel, estado: EstadoDaPublicacao | null, agoraMs: number): ItemDaListaDeCarrosseis {
  const { arroba } = escolhasDaArte(l.arte, l.total_slides);
  return {
    id: l.id,
    href: caminhoDoCarrossel(l),
    titulo: textoDaLinhaDoCarrossel(l)?.titulo ?? descricaoDoCarrossel(l),
    origem: textoDaOrigem(l),
    detalhe: [arroba ? `@${arroba}` : null, descricaoDoCarrossel(l)].filter((x): x is string => x !== null).join(" · "),
    geracao: rotuloDoCarrossel(l, agoraMs),
    publicacao: estado ? rotuloDaPublicacao(estado) : null,
  };
}
```

Em `app/bonus/[id]/carrossel/[cid]/publicacao-na-tela.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/[id]/carrossel/[cid]/publicacao-na-tela.ts b/app/bonus/[id]/carrossel/[cid]/publicacao-na-tela.ts
index 85dd3ef..6f7dc9d 100644
--- a/app/bonus/[id]/carrossel/[cid]/publicacao-na-tela.ts
+++ b/app/bonus/[id]/carrossel/[cid]/publicacao-na-tela.ts
@@ -29,4 +29,6 @@ export type PublicacaoNaTela = {
   estado: { texto: string | null; tom: TomDoQuadro | null; filaId: string | null; livre: boolean };
   /** "Para ver no calendário, selecione … no menu", quando a conta do menu é outra. */
   avisoDoCalendario: string | null;
+  /** O aviso do funil (Etapa 7, `textoDoFunil`), depois de agendar ou publicar. */
+  avisoDoFunil?: string | null;
 };
```

Em `app/bonus/[id]/carrossel/[cid]/card-publicar.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/[id]/carrossel/[cid]/card-publicar.tsx b/app/bonus/[id]/carrossel/[cid]/card-publicar.tsx
index 7ba856c..ab5964b 100644
--- a/app/bonus/[id]/carrossel/[cid]/card-publicar.tsx
+++ b/app/bonus/[id]/carrossel/[cid]/card-publicar.tsx
@@ -1,5 +1,6 @@
 "use client";
 import { useState, useTransition } from "react";
+import Link from "next/link";
 import { useRouter } from "next/navigation";
 import { alertError, alertOk, alertWarn, btnPrimary, card, hint, input, link } from "@/app/ui";
 import { artesParaPublicar, faltasParaPublicar } from "@/lib/bonus/publicar-estado";
@@ -19,6 +20,9 @@ import type { ImagemNaTela, PublicacaoNaTela } from "./publicacao-na-tela";
 //
 // O clique prepara as artes do Chat (o "Só texto" e o slide com foto, `artesParaPublicar`) e manda
 // cada uma com a versão que a rota desenhou (imagem-no-navegador.ts).
+//
+// DEPOIS DE AGENDAR OU PUBLICAR, O AVISO DO FUNIL (spec da Etapa 7), com o caminho do /automacoes: o
+// post é novo, e ninguém liga a automação da palavra nele sozinho. A página decide quando ele aparece.
 const QUADRO: Record<TomDoQuadro, string> = { ok: alertOk, atencao: alertWarn, erro: alertError };
 
 export default function CardPublicar({
@@ -78,6 +82,14 @@ export default function CardPublicar({
         </a>
       )}
       {publicacao.avisoDoCalendario && <p className={hint}>{publicacao.avisoDoCalendario}</p>}
+      {publicacao.avisoDoFunil && (
+        <p className={alertWarn}>
+          {publicacao.avisoDoFunil}{" "}
+          <Link href="/automacoes" className={link}>
+            Abrir as automações
+          </Link>
+        </p>
+      )}
       {estado.livre && (
         <div className="space-y-3">
           {publicacao.arroba && (
```

Em `app/bonus/[id]/carrossel/[cid]/revisao.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/[id]/carrossel/[cid]/revisao.tsx b/app/bonus/[id]/carrossel/[cid]/revisao.tsx
index 4bbff33..4bd3bb0 100644
--- a/app/bonus/[id]/carrossel/[cid]/revisao.tsx
+++ b/app/bonus/[id]/carrossel/[cid]/revisao.tsx
@@ -18,7 +18,13 @@ import { TEXTO_CARROSSEL_SEM_TEXTO } from "@/lib/bonus/carrossel-textos";
 import { publicacaoLivre } from "@/lib/bonus/publicar-estado";
 import { fotosDaArte, imagensDaArte, versaoDoTextoDoSlide } from "@/lib/bonus/publicar-regras";
 import { estadoDoCarrossel } from "@/lib/bonus/publicar-repositorio";
-import { textoDaTrava, textoDoCalendario, textoDoEstadoDaPublicacao, tomDoEstadoDaPublicacao } from "@/lib/bonus/publicar-textos";
+import {
+  textoDaTrava,
+  textoDoCalendario,
+  textoDoEstadoDaPublicacao,
+  textoDoFunil,
+  tomDoEstadoDaPublicacao,
+} from "@/lib/bonus/publicar-textos";
 import EditorDoCarrossel from "./editor-do-carrossel";
 import type { PublicacaoNaTela } from "./publicacao-na-tela";
 
@@ -35,6 +41,9 @@ import type { PublicacaoNaTela } from "./publicacao-na-tela";
  * A PUBLICAÇÃO (spec da Etapa 5) é decidida aqui, no servidor: as imagens do Canva guardadas, com o
  * endereço público delas; a versão do texto de cada slide; o estado lido da fila pela chave exata; a
  * trava; e o aviso do calendário, que só mostra a conta selecionada no menu.
+ *
+ * O AVISO DO FUNIL (spec da Etapa 7) também: depois de agendar ou publicar, a página lembra de ligar a
+ * automação da palavra no post novo, no /automacoes. Vale para o carrossel de bônus e para o avulso.
  */
 export default async function Revisao({ carrossel }: { carrossel: LinhaDoCarrossel }) {
   const texto = textoDaLinhaDoCarrossel(carrossel);
@@ -67,6 +76,7 @@ export default async function Revisao({ carrossel }: { carrossel: LinhaDoCarross
     estado: { texto: textoDoEstadoDaPublicacao(estado), tom: tomDoEstadoDaPublicacao(estado), filaId, livre: publicacaoLivre(estado) },
     avisoDoCalendario:
       filaId && conta && escolhas.conta && noMenu?.ig_user_id !== escolhas.conta ? textoDoCalendario(rotuloDaConta(conta)) : null,
+    avisoDoFunil: textoDoFunil(estado, carrossel.palavra),
   };
 
   return (
```

Crie `app/carrosseis/page.tsx`:

```tsx
import Link from "next/link";
import {
  alertError,
  alertOk,
  badgeErr,
  badgeNeutral,
  badgeOk,
  badgeWarn,
  btnPrimary,
  card,
  emptyWrap,
  muted,
  pageSubtitle,
  pageTitle,
  rowDivide,
  rowHover,
} from "@/app/ui";
import { avisoDaUrl } from "@/lib/avisos";
import { itemDaListaDeCarrosseis } from "@/lib/bonus/carrosseis-tela";
import type { LinhaDoCarrossel } from "@/lib/bonus/carrossel-linha";
import { listarCarrosseis } from "@/lib/bonus/carrossel-repositorio";
import { TEXTO_TABELA_CARROSSEL_AUSENTE } from "@/lib/bonus/carrossel-textos";
import { ehTabelaAusente } from "@/lib/bonus/erros";
import { publicacaoDaArte } from "@/lib/bonus/publicar-regras";
import { estadoDoCarrossel } from "@/lib/bonus/publicar-repositorio";
import type { TipoDoRotulo } from "@/lib/bonus/tela";
import { fmtDate } from "@/lib/format";

// O MENU "CARROSSÉIS" (spec da Etapa 7): todos os carrosséis, os dos bônus e os avulsos, do mais novo
// para o mais velho, e o botão "Novo carrossel". Cada linha leva à página do carrossel (a de bônus, ou
// a do avulso), e o que ela mostra é decidido fora do JSX (carrosseis-tela.ts).
//
// O ESTADO DA PUBLICAÇÃO é lido da fila só para o carrossel que tem publicação guardada: os outros
// não pagam a consulta.

export const dynamic = "force-dynamic";

const SELO: Record<TipoDoRotulo, string> = { neutro: badgeNeutral, ok: badgeOk, atencao: badgeWarn, erro: badgeErr };

export default async function Carrosseis({ searchParams }: { searchParams: Promise<{ aviso?: string; tom?: string }> }) {
  const sp = await searchParams;
  const aviso = avisoDaUrl(sp.aviso, sp.tom);

  let linhas: LinhaDoCarrossel[];
  try {
    linhas = await listarCarrosseis();
  } catch (erro) {
    if (!ehTabelaAusente(erro)) throw erro;
    return (
      <div className="space-y-6">
        <h1 className={pageTitle}>Carrosséis</h1>
        <div className={alertError}>{TEXTO_TABELA_CARROSSEL_AUSENTE}</div>
      </div>
    );
  }
  const estados = await Promise.all(linhas.map((l) => (publicacaoDaArte(l.arte) === null ? null : estadoDoCarrossel(l.arte))));
  // Server Component `async` e `force-dynamic`: roda UMA vez por requisição, e ler o
  // relógio aqui é o comportamento pedido. A regra trata todo arquivo como cliente;
  // o dono silencia do mesmo jeito, com o motivo por extenso, em app/page.tsx:322-333.
  // eslint-disable-next-line react-hooks/purity
  const agora = Date.now();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className={pageTitle}>Carrosséis</h1>
          <p className={pageSubtitle}>Os carrosséis dos bônus e os avulsos, de um bônus do Labs ou de um texto livre.</p>
        </div>
        <Link href="/carrosseis/novo" className={btnPrimary}>
          Novo carrossel
        </Link>
      </div>

      {aviso && <div className={aviso.tom === "ok" ? alertOk : alertError}>{aviso.texto}</div>}

      <section className={card}>
        {linhas.length === 0 ? (
          <div className={emptyWrap}>
            <p className={muted}>Nenhum carrossel ainda.</p>
          </div>
        ) : (
          <ul className={rowDivide}>
            {linhas.map((l, i) => {
              const item = itemDaListaDeCarrosseis(l, estados[i], agora);
              return (
                <li key={item.id}>
                  <Link href={item.href} className={`flex items-center justify-between gap-3 px-4 py-3 ${rowHover}`}>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{item.titulo}</span>
                      <span className={`block truncate text-xs ${muted}`}>
                        {item.origem} · {item.detalhe} · {fmtDate(l.criado_em)}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {item.publicacao && <span className={SELO[item.publicacao.tipo]}>{item.publicacao.texto}</span>}
                      <span className={SELO[item.geracao.tipo]}>{item.geracao.texto}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
```

Em `app/app-shell.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/app-shell.tsx b/app/app-shell.tsx
index 08be8d3..8fefb87 100644
--- a/app/app-shell.tsx
+++ b/app/app-shell.tsx
@@ -18,6 +18,7 @@ import {
   IconX,
   IconImage,
   IconMensagemLink,
+  IconCamera,
 } from "./icons";
 import Progresso from "./publicar/progresso";
 
@@ -43,6 +44,7 @@ const NAV_GROUPS: {
       // `app/publicar/page.tsx`.
       { href: "/publicar", label: "Publicações", icon: IconImage },
       { href: "/bonus", label: "Bônus", icon: IconMensagemLink },
+      { href: "/carrosseis", label: "Carrosséis", icon: IconCamera },
       { href: "/automacoes", label: "Automações", icon: IconZap },
       { href: "/contatos", label: "Contatos", icon: IconUsers },
       { href: "/eventos", label: "Atividade", icon: IconActivity },
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx vitest run tests/bonus-carrosseis-tela.test.ts tests/bonus-publicar-estado.test.ts tests/bonus-avulso-paginas.test.ts
npx vitest run --config vitest.dom.config.ts testes-dom/bonus-card-publicar.dom.tsx
```

Esperado: `tsc` limpo; 60 casos puros e 13 de tela passam.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/publicar-textos.ts lib/bonus/carrosseis-tela.ts "app/bonus/[id]/carrossel/[cid]/publicacao-na-tela.ts" "app/bonus/[id]/carrossel/[cid]/card-publicar.tsx" "app/bonus/[id]/carrossel/[cid]/revisao.tsx" app/carrosseis/page.tsx app/app-shell.tsx tests/bonus-carrosseis-tela.test.ts tests/bonus-publicar-estado.test.ts tests/bonus-avulso-paginas.test.ts testes-dom/bonus-card-publicar.dom.tsx
test "$(git branch --show-current)" = "carrossel-avulso"
git add lib/bonus/publicar-textos.ts lib/bonus/carrosseis-tela.ts "app/bonus/[id]/carrossel/[cid]/publicacao-na-tela.ts" "app/bonus/[id]/carrossel/[cid]/card-publicar.tsx" "app/bonus/[id]/carrossel/[cid]/revisao.tsx" app/carrosseis/page.tsx app/app-shell.tsx tests/bonus-carrosseis-tela.test.ts tests/bonus-publicar-estado.test.ts tests/bonus-avulso-paginas.test.ts testes-dom/bonus-card-publicar.dom.tsx
git commit -m "feat(bonus): o menu Carrosséis, a lista de todos e o aviso do funil depois de publicar"
```

---

### FASE 7.12 — O carrossel avulso publica e agenda pelo mesmo caminho do de bônus

**Arquivos:**
- Testar: `testes-integracao/bonus-publicar-processo.integracao.ts` (um caso novo; o código não muda)

**Interfaces:**
- Consome, sem mudar nada: `publicarNaFila`, `guardarImagem` e `assinarImagem` (Etapa 5). A publicação
  é do carrossel, pelo id, e não olha o bônus: o avulso do texto livre, sem `bonus_id`, sai na conta
  dele, com a reserva antes da fila, e trava como o de bônus.

- [ ] **Passo 1: o teste**

Em `testes-integracao/bonus-publicar-processo.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/bonus-publicar-processo.integracao.ts b/testes-integracao/bonus-publicar-processo.integracao.ts
index 44ab531..f6b5b2d 100644
--- a/testes-integracao/bonus-publicar-processo.integracao.ts
+++ b/testes-integracao/bonus-publicar-processo.integracao.ts
@@ -617,3 +617,34 @@ describe("publicar", () => {
     expect(bucket.objetos.has(artes[0].caminho)).toBe(true);
   });
 });
+
+// O CARROSSEL AVULSO (spec da Etapa 7) publica pelo mesmo caminho: a publicação é do carrossel, pelo
+// id, e não olha o bônus. Um avulso do texto livre, sem `bonus_id`, sai na conta dele, com a reserva
+// antes da fila, e trava como o de bônus.
+describe("publicar o carrossel avulso", () => {
+  it("agendado: entra na conta do carrossel, com a reserva, e trava", async () => {
+    const [c] = (await banco
+      .db()
+      .sql()
+      .query(
+        `insert into carrosseis_gerados (origem, total_slides, palavra, contexto, estado, gerado, arte)
+         values ('livre', $1, 'SUMIDO', $2::jsonb, 'pronto', $3::jsonb, $4::jsonb) returning id`,
+        [TEXTO.slides.length + 2, { tipo: "livre", tema: "Vendas", conteudo: "Mensagens para trazer de volta quem sumiu." }, TEXTO, ARTE]
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
+    expect(item.payload.caminhos).toHaveLength(5);
+    expect((await arteDe(id)).publicacao).toMatchObject({ chave: item.dedupe_key });
+    const travado = await processo.assinarImagem({ id, numero: 2, destino: "slide", arquivo: DECLARADO, contas });
+    expect(travado.ok ? null : travado.recusa.motivo).toBe("travado");
+  });
+});
```

- [ ] **Passo 2: ver passar, sem código novo**

```bash
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-publicar-processo.integracao.ts
```

Esperado: `[rede-global] ALVO: banco de TESTE`, e os 40 passam. O caso novo passa direto, porque nada
do publicar olha o bônus; quem prova que ele protege é a mutação "7.12: o publicar exige o bônus" do
Apêndice A, que o derruba.

- [ ] **Passo 3: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" testes-integracao/bonus-publicar-processo.integracao.ts
test "$(git branch --show-current)" = "carrossel-avulso"
git add testes-integracao/bonus-publicar-processo.integracao.ts
git commit -m "test(bonus): o carrossel avulso publica e agenda pelo mesmo caminho do de bônus"
```

---

### FASE 7.13 — O verify, a integração inteira, as mutações e a guarda do diff

- [ ] **Passo 1: o verify, na árvore do projeto**

```bash
env -u CLAUDECODE -u AI_AGENT npm run verify
git diff --stat AGENTS.md
```

Esperado: lint e `tsc` limpos; 103 arquivos e 3 006 casos puros e 22 arquivos e 177 de tela; a varredura "SEM
VAZAMENTO em A nem em C"; o build (Turbopack) com "MIGRAÇÃO PULADA" e as rotas `ƒ /carrosseis`,
`ƒ /carrosseis/[cid]`, `ƒ /carrosseis/[cid]/arte` e `ƒ /carrosseis/novo`; o `AGENTS.md` sem diferença.

- [ ] **Passo 2: a integração inteira, no container**

```bash
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npm run test:integracao
```

Esperado: `[rede-global] ALVO: banco de TESTE`; 42 arquivos, 418 passaram e 8 pularam (na base, 39 arquivos, 383 passaram e 8 pularam).

- [ ] **Passo 3: as provas de mutação**

Copie o script do Apêndice A para `$SCRATCH/mutar-avulso.mjs` e rode, da raiz:

```bash
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" node "$SCRATCH/mutar-avulso.mjs"
git status --short
```

Esperado: as 43 com ✓, "43 mutações, 0 ruins", e a árvore limpa depois (cada arquivo
volta byte a byte).

- [ ] **Passo 4: a guarda do diff (pedido da auditoria)**

```bash
git diff --stat bf1bb32 -- app/publicar app/api app/automacoes lib/bucket.ts lib/queue-drain.ts lib/engine.ts lib/publicacao.ts lib/dedupe.ts scripts package.json package-lock.json next.config.ts proxy.ts
git diff --stat bf1bb32 -- migrations
git diff --stat bf1bb32 -- . ':!app/bonus' ':!app/carrosseis' ':!lib/bonus' ':!tests' ':!testes-dom' ':!testes-integracao' ':!docs' ':!migrations/016-carrossel-avulso.sql' ':!lib/esquema.ts' ':!app/app-shell.tsx'
```

Esperado: a primeira e a terceira saídas vazias; a segunda, só `migrations/016-carrossel-avulso.sql`.

- [ ] **Passo 5: avisar o auditor**, com o hash, os números e o pedido de conferir a branch antes do
  push. O push da branch e o PR só com o OK do Eduardo.

---

### FASE 7.14 — A 016 na produção e a prova real, no preview, com o Eduardo

Cada escrita em produção tem o OK do Eduardo, pela caixa, e a auditoria lê o banco antes e depois
(avisada com a hora). O preview usa o banco e o bucket de produção. **Sem post real**, como na
Etapa 5.

- [ ] **Passo 1: a linha de base da auditoria**, só de leitura, antes da 016 (as colunas de
  `carrosseis_gerados`, os carrosséis que existem e o registro das migrações).

- [ ] **Passo 2: o ensaio a seco da 016**

```bash
node scripts/migrar.mjs
```

Esperado: lista só `016-carrossel-avulso.sql` como pendente, sem aplicar nada.

- [ ] **Passo 3: aplicar à mão, com o OK do Eduardo** (item 1 do ensaio)

Pergunte pela caixa. Com o OK, e com o auditor avisado da hora:

```bash
node scripts/migrar.mjs --aplicar --a-mao
node scripts/migrar.mjs
```

Esperado: a primeira aplica e anota a `016`; a segunda diz "já aplicada". A auditoria lê de novo: as
colunas, o `'bonus'` em todas as linhas que já existiam, e os dois `check`.

- [ ] **Passo 4: o push da branch e o preview, com o OK do Eduardo**

Empurre só a branch (`git push origin refs/heads/carrossel-avulso:refs/heads/carrossel-avulso`). No
log do build do preview, confira o commit, "MIGRAÇÃO PULADA" e as quatro rotas novas na lista.

- [ ] **Passo 5: a prova, com o Eduardo na tela** (os passos da spec, "A prova real")

1. O menu "Carrosséis" lista os carrosséis que já existem, todos como "Bônus do Chat", e cada um abre
   a página de hoje.
2. "Novo carrossel" → "Escrever à mão", de um bônus do Labs (o BRUTAL): o carrossel nasce pronto, com
   o texto escrito e a palavra BRUTAL lida do Labs, sem gastar IA (grava em produção: só com o OK).
3. Na página dele: a arte, a foto no espaço e o "Baixar" (o arquivo com o código do Labs); agendar
   para daqui a 7 dias, ver o aviso do funil, e cancelar no calendário (gravam em produção: só com o
   OK).
4. Quando o crédito da Anthropic entrar: "Gerar com a IA", de um texto livre, com 4 slides.

No fim, o que a prova criou sai do banco e do bucket, com o OK do Eduardo e o script lido pela
auditoria antes de rodar (achado 77). Depois: o corpo do PR, conferido pelo auditor, e o PR com o OK
do Eduardo. O merge é do Vinícius, e o build do merge diz "Nada a aplicar".

---

## Apêndice A — as provas de mutação

Cada mutação tira uma proteção e roda o teste que a cobre; o caso nomeado tem de cair. O arquivo
volta byte a byte depois de cada uma. Sem `DATABASE_URL_TESTES`, o script recusa antes de mutar.

```js
// Provas de mutação da Etapa 7 (o carrossel avulso). Cada mutação tira uma proteção e roda o teste que
// a cobre; o caso nomeado tem de cair. Cada arquivo volta byte a byte.
// Uso, da raiz do repositório: DATABASE_URL_TESTES=<container> node mutar-avulso.mjs [filtro]
// As mutações INTEG rodam a suíte de integração, que sem DATABASE_URL_TESTES cai na DATABASE_URL, a
// da PRODUÇÃO (achado 68): sem a variável, o script recusa antes de mutar, e uma rodada INTEG que
// não imprime "ALVO: banco de TESTE" conta como ✗.
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const PURA = (f) => `npx vitest run ${f}`;
const TELA = (f) => `npx vitest run --config vitest.dom.config.ts ${f}`;
const INTEG = (f) => `npx vitest run --config vitest.integracao.config.ts ${f}`;

const MIGRACAO = "migrations/016-carrossel-avulso.sql";
const ESQUEMA = "lib/esquema.ts";
const CAMINHO = "lib/bonus/carrossel-caminho.ts";
const ARTE_TELA = "lib/bonus/arte-tela.ts";
const IA = "lib/bonus/carrossel-ia-parametros.ts";
const PUBLICADO = "lib/bonus/publicado.ts";
const PEDIDO = "lib/bonus/avulso-pedido.ts";
const REPO = "lib/bonus/carrossel-repositorio.ts";
const PROCESSO = "lib/bonus/avulso-processo.ts";
const ACOES = "app/carrosseis/actions.ts";
const FORMULARIO = "app/carrosseis/novo/formulario-do-avulso.tsx";
const NOVO = "app/carrosseis/novo/page.tsx";
const ROTA_AVULSA = "app/carrosseis/[cid]/arte/route.tsx";
const DESENHO = "lib/bonus/arte-rota.ts";
const PAGINA_AVULSA = "app/carrosseis/[cid]/page.tsx";
const PUBLICAR_TEXTOS = "lib/bonus/publicar-textos.ts";
const CARD_PUBLICAR = "app/bonus/[id]/carrossel/[cid]/card-publicar.tsx";
const LISTA = "lib/bonus/carrosseis-tela.ts";
const MENU = "app/app-shell.tsx";
const PUBLICAR_PROCESSO = "lib/bonus/publicar-processo.ts";

const T_TABELA = INTEG("testes-integracao/bonus-carrossel-tabela.integracao.ts");
const T_PARTIDA = INTEG("testes-integracao/esquema-de-partida.integracao.ts");
const T_CAMINHO = PURA("tests/bonus-carrossel-caminho.test.ts");
const T_ARTE_TELA = PURA("tests/bonus-arte-tela.test.ts");
const T_IA = PURA("tests/bonus-carrossel-ia-parametros.test.ts");
const T_PUBLICADO = PURA("tests/bonus-publicado.test.ts");
const T_PEDIDO = PURA("tests/bonus-avulso-pedido.test.ts");
const T_AVULSO = INTEG("testes-integracao/bonus-carrossel-avulso.integracao.ts");
const T_PROCESSO = INTEG("testes-integracao/bonus-avulso-processo.integracao.ts");
const T_PAGINAS = PURA("tests/bonus-avulso-paginas.test.ts");
const T_NOVO = TELA("testes-dom/bonus-novo-carrossel.dom.tsx");
const T_ARTE_PAGINAS = PURA("tests/bonus-arte-paginas.test.ts");
const T_ARTE_ROTA = INTEG("testes-integracao/bonus-arte-rota.integracao.ts");
const T_ESTADO = PURA("tests/bonus-publicar-estado.test.ts");
const T_CARD = TELA("testes-dom/bonus-card-publicar.dom.tsx");
const T_LISTA = PURA("tests/bonus-carrosseis-tela.test.ts");
const T_PUBLICAR = INTEG("testes-integracao/bonus-publicar-processo.integracao.ts");

const MUTACOES = [
  // 7.1 a migração 016
  { nome: "7.1: sem o check da origem do bônus", arq: MIGRACAO,
    de: "alter table carrosseis_gerados add constraint carrosseis_gerados_origem_bonus_check\n  check ((origem = 'bonus') = (bonus_id is not null));",
    para: "alter table carrosseis_gerados add constraint carrosseis_gerados_origem_bonus_check\n  check (true);",
    cmd: T_TABELA, caso: "o banco recusa a origem 'bonus' sem bônus" },
  { nome: "7.1: sem o check do código do Labs", arq: MIGRACAO,
    de: "alter table carrosseis_gerados add constraint carrosseis_gerados_origem_labs_check\n  check ((origem = 'labs') = (labs_codigo is not null));",
    para: "alter table carrosseis_gerados add constraint carrosseis_gerados_origem_labs_check\n  check (true);",
    cmd: T_TABELA, caso: "o banco recusa o avulso do Labs sem código" },
  { nome: "7.1: a linha antiga nasce de outra origem", arq: MIGRACAO,
    de: "origem text not null default 'bonus';", para: "origem text not null default 'livre';",
    cmd: T_TABELA, caso: "uma linha nova nasce pendente" },
  { nome: "7.1: o bonus_id continua obrigatório", arq: MIGRACAO,
    de: "alter table carrosseis_gerados alter column bonus_id drop not null;\n", para: "",
    cmd: T_TABELA, caso: "o avulso do Labs entra sem bônus" },
  { nome: "7.1: a 016 fora da marca d'água", arq: ESQUEMA,
    de: '      de: "016-carrossel-avulso.sql",', para: '      de: "016-outro-nome.sql",',
    cmd: T_PARTIDA, caso: "a MARCA D'ÁGUA cobre a pasta inteira" },
  // 7.2 o endereço e a rota de cada origem
  { nome: "7.2: a rota dos avulsos serve o de bônus", arq: CAMINHO,
    de: ': l.origem !== "bonus";', para: ": true;",
    cmd: T_CAMINHO, caso: "a rota dos avulsos serve os dois avulsos, e recusa o de bônus" },
  { nome: "7.2: a rota do bônus não confere o id", arq: CAMINHO,
    de: 'l.origem === "bonus" && l.bonus_id === rota.bonusId', para: 'l.origem === "bonus"',
    cmd: T_CAMINHO, caso: "a rota do bônus recusa o carrossel de outro bônus e o avulso" },
  { nome: "7.2: o avulso mora embaixo de um bônus", arq: CAMINHO,
    de: ": `/carrosseis/${l.id}`;", para: ": `/bonus/${l.bonus_id}/carrossel/${l.id}`;",
    cmd: T_CAMINHO, caso: "mora em /carrosseis" },
  { nome: "7.2: a arte não confere a rota", arq: ARTE_TELA,
    de: "if (!linha || !ehDaRota(linha, rota)) return", para: "if (!linha) return",
    cmd: T_ARTE_TELA, caso: "recusa o avulso na rota do bônus" },
  // 7.3 o contexto do texto livre
  { nome: "7.3: um tipo desconhecido vira bônus", arq: IA,
    de: "  if (o.tipo !== undefined) return null;\n", para: "",
    cmd: T_IA, caso: "recusa o que não tem a forma" },
  { nome: "7.3: a mensagem do livre fala de bônus", arq: IA,
    de: "O conteúdo que este post divulga:", para: "O bônus que este post divulga:",
    cmd: T_IA, caso: "leva o tema e o conteúdo, e o mesmo pedido extra" },
  // 7.4 a lista do Labs e o pedido avulso
  { nome: "7.4: a lista aceita item sem código", arq: PUBLICADO,
    de: 'if (!ehItem(item) || typeof item.codigo !== "string" || !item.codigo || item.codigo.length > CODIGO_MAX) continue;',
    para: "if (!ehItem(item)) continue;",
    cmd: T_PUBLICADO, caso: "traz só os bônus que o Chat consegue usar" },
  { nome: "7.4: a lista na ordem do Labs", arq: PUBLICADO,
    de: "return bonus.reverse();", para: "return bonus;",
    cmd: T_PUBLICADO, caso: "do mais novo para o mais velho" },
  { nome: "7.4: a palavra do livre sem normalizar", arq: PEDIDO,
    de: "const palavra = normalizarPalavra(texto(bruto.palavra));", para: "const palavra = texto(bruto.palavra);",
    cmd: T_PEDIDO, caso: "do texto livre: a palavra na forma que o Labs grava" },
  { nome: "7.4: o conteúdo sem mínimo", arq: PEDIDO,
    de: '  if (conteudo.length < CONTEUDO_MIN) return { ok: false, motivo: "conteudo_curto" };\n', para: "",
    cmd: T_PEDIDO, caso: "recusa o conteúdo curto" },
  { nome: "7.4: o destaque não chega à IA", arq: PEDIDO,
    de: "oQueResolve: destaque || b.descricao", para: "oQueResolve: b.descricao",
    cmd: T_PEDIDO, caso: "e o destaque no lugar do que resolve" },
  { nome: "7.4: o título interno do livre é o conteúdo", arq: PEDIDO,
    de: 'return "tipo" in c ? c.tema : c.titulo;', para: 'return "tipo" in c ? c.conteudo : c.titulo;',
    cmd: T_PEDIDO, caso: "o título interno do escrito à mão" },
  // 7.5 o repositório
  { nome: "7.5: o teto conta o escrito à mão", arq: REPO,
    de: "where criado_em > now() - interval '24 hours' and not texto_a_mao`;", para: "where criado_em > now() - interval '24 hours'`;",
    cmd: T_AVULSO, caso: "com 10 da IA no dia, o avulso pela IA é recusado, e o escrito à mão entra" },
  { nome: "7.5: o teto sem a contagem", arq: REPO,
    de: "    if ((contagem?.n ?? 0) >= TETO_CARROSSEL_DIARIO) return { ok: false as const };\n", para: "",
    cmd: T_AVULSO, caso: "com 10 da IA no dia, o avulso pela IA é recusado, e o escrito à mão entra" },
  { nome: "7.5: o teto sem a trava", arq: REPO,
    de: "    await tx.query(`select pg_advisory_xact_lock($1::bigint)`, [TRAVA_DO_TETO_DO_CARROSSEL]);\n", para: "",
    cmd: T_AVULSO, caso: "o avulso pela IA espera a trava do teto" },
  { nome: "7.5: o escrito à mão sem a marca", arq: REPO,
    de: "'pronto', $7::jsonb, now(), true)", para: "'pronto', $7::jsonb, now(), false)",
    cmd: T_AVULSO, caso: "escrito à mão: nasce pronto" },
  { nome: "7.5: a lista do mais velho para o mais novo", arq: REPO,
    de: "select * from carrosseis_gerados order by criado_em desc limit $1", para: "select * from carrosseis_gerados order by criado_em asc limit $1",
    cmd: T_AVULSO, caso: "traz os de bônus e os avulsos, do mais novo para o mais velho" },
  // 7.6 o processo
  { nome: "7.6: o escrito à mão sem a conferência", arq: PROCESSO,
    de: "    if (!lido.ok) return { ok: false, texto: `Corrija antes de criar. ${textoDosProblemasDoCarrossel(pedido.total, lido.problemas)}` };\n",
    para: "",
    cmd: T_PROCESSO, caso: "o escrito à mão com problema é recusado" },
  { nome: "7.6: o escrito à mão pede a IA", arq: PROCESSO,
    de: "return { ok: true, id: criado.id, gerar: texto === null };", para: "return { ok: true, id: criado.id, gerar: true };",
    cmd: T_PROCESSO, caso: "e a geração não é pedida" },
  { nome: "7.6: o Gerar de novo do Labs perde o destaque", arq: PROCESSO,
    de: 'const destaque = gravado && !("tipo" in gravado) ? gravado.oQueResolve : "";', para: 'const destaque = "";',
    cmd: T_PROCESSO, caso: "o do Labs relê o Labs pelo código" },
  { nome: "7.6: o Gerar de novo sem conferir o estado", arq: PROCESSO,
    de: "  if (naTela !== \"falhou\" && naTela !== \"travou\") return { ok: false, texto: TEXTO_NAO_DA_PARA_GERAR_CARROSSEL_DE_NOVO };\n",
    para: "",
    cmd: T_PROCESSO, caso: "só o que falhou ou travou gera de novo" },
  // 7.7 as actions
  { nome: "7.7: o pedido sem a sessão primeiro", arq: ACOES,
    de: "Promise<AvisoDoAvulso | null> {\n  await exigirSessao();\n", para: "Promise<AvisoDoAvulso | null> {\n",
    cmd: T_PAGINAS, caso: "as duas actions começam por" },
  { nome: "7.7: a conta vem do formulário", arq: ACOES,
    de: "conta: logada ? contaParaGuardar(logada) : null,", para: 'conta: logada ? { conta: String(form.get("conta")), nome: null, arroba: null } : null,',
    cmd: T_PAGINAS, caso: "a conta nunca vem do formulário" },
  // 7.8 a tela do Novo carrossel
  { nome: "7.8: o jeito vai sempre como IA", arq: FORMULARIO,
    de: '<input type="hidden" name="jeito" value={jeito} />', para: '<input type="hidden" name="jeito" value="ia" />',
    cmd: T_NOVO, caso: "Criar com este texto manda o jeito à mão e os campos" },
  { nome: "7.8: a busca tira o escolhido da lista", arq: FORMULARIO,
    de: "b === escolhido || !q ||", para: "!q ||",
    cmd: T_NOVO, caso: "e o escolhido fica na lista" },
  { nome: "7.8: o limite do dia desliga o escrito à mão", arq: FORMULARIO,
    de: "disabled={pendente || semLista}>\n              Criar com este texto", para: "disabled={pendente || semLista || restam === 0}>\n              Criar com este texto",
    cmd: T_NOVO, caso: "com o limite do dia acabado, só a IA fica desligada" },
  { nome: "7.8: a palavra digitada sem normalizar no aviso", arq: FORMULARIO,
    de: ": normalizarPalavra(palavra);", para: ": palavra;",
    cmd: T_NOVO, caso: "a chamada e a legenda avisam na hora" },
  { nome: "7.8: a página nova com outro teto de tempo", arq: NOVO,
    de: "export const maxDuration = 300;", para: "export const maxDuration = 60;",
    cmd: T_PAGINAS, caso: "declara o mesmo maxDuration de lib/bonus/tempos.ts" },
  // 7.9 a arte do avulso
  { nome: "7.9: a arte do avulso olha o pedido antes da sessão", arq: ROTA_AVULSA,
    de: "  const jarra = await cookies();\n  if (!isValidSession(jarra.get(SESSION_COOKIE)?.value)) return erro(401, TEXTO_ARTE_SEM_SESSAO);\n  const { cid } = await params;\n",
    para: "  const { cid } = await params;\n  const jarra = await cookies();\n  if (!isValidSession(jarra.get(SESSION_COOKIE)?.value)) return erro(401, TEXTO_ARTE_SEM_SESSAO);\n",
    cmd: T_ARTE_PAGINAS, caso: "o GET confere a sessão antes de qualquer outra coisa" },
  { nome: "7.9: a arte do avulso sem a sessão", arq: ROTA_AVULSA,
    de: "  if (!isValidSession(jarra.get(SESSION_COOKIE)?.value)) return erro(401, TEXTO_ARTE_SEM_SESSAO);\n  const { cid }", para: "  const { cid }",
    cmd: T_ARTE_ROTA, caso: "a arte do avulso também responde 401 sem cache" },
  { nome: "7.9: o desenho busca a foto da conta direto", arq: DESENHO,
    de: "fotosDaInstancia.foto(conta.profile_picture_url)", para: "fotoDaConta(conta.profile_picture_url)",
    cmd: T_ARTE_PAGINAS, caso: "a foto da conta vem da memória da instância" },
  // 7.10 a página do avulso
  { nome: "7.10: a página do avulso serve o de bônus", arq: PAGINA_AVULSA,
    de: 'if (!carrossel || !ehDaRota(carrossel, { tipo: "avulso" })) notFound();', para: "if (!carrossel) notFound();",
    cmd: T_PAGINAS, caso: "só serve o avulso" },
  // 7.11 a lista, o menu e o funil
  { nome: "7.11: o funil aparece antes de mandar", arq: PUBLICAR_TEXTOS,
    de: 'return e.tipo === "agendado" || e.tipo === "publicando" || e.tipo === "publicado"', para: 'return e.tipo !== "livre"',
    cmd: T_ESTADO, caso: "sem post a caminho, nada" },
  { nome: "7.11: o livre ganha rótulo na lista", arq: PUBLICAR_TEXTOS,
    de: '    case "livre":\n      return null;\n    case "agendado":\n      return { texto: "Agendado", tipo: "neutro" };',
    para: '    case "livre":\n      return { texto: "Livre", tipo: "neutro" };\n    case "agendado":\n      return { texto: "Agendado", tipo: "neutro" };',
    cmd: T_ESTADO, caso: "cada estado tem rótulo, e o livre não tem" },
  { nome: "7.11: o aviso do funil sem o caminho do /automacoes", arq: CARD_PUBLICAR,
    de: '          <Link href="/automacoes" className={link}>\n            Abrir as automações\n          </Link>\n', para: "",
    cmd: T_CARD, caso: "o aviso do funil, com o caminho do /automacoes" },
  { nome: "7.11: a lista leva todo carrossel para baixo de um bônus", arq: LISTA,
    de: "href: caminhoDoCarrossel(l),", para: "href: `/bonus/${l.bonus_id}/carrossel/${l.id}`,",
    cmd: T_LISTA, caso: "o do texto livre: a página do avulso" },
  { nome: "7.11: o menu sem o item Carrosséis", arq: MENU,
    de: '      { href: "/carrosseis", label: "Carrosséis", icon: IconCamera },\n', para: "",
    cmd: T_PAGINAS, caso: "o item mora no menu" },
  // 7.12 o publicar do avulso
  { nome: "7.12: o publicar exige o bônus", arq: PUBLICAR_PROCESSO,
    de: "  const c = await conferirCarrossel(p.id, p.contas);\n  if (!c.ok) return c;\n  const total = c.linha.total_slides;",
    para: '  const c = await conferirCarrossel(p.id, p.contas);\n  if (!c.ok) return c;\n  if (!c.linha.bonus_id) return recusa({ motivo: "quantidade", texto: "só carrossel de bônus" });\n  const total = c.linha.total_slides;',
    cmd: T_PUBLICAR, caso: "agendado: entra na conta do carrossel, com a reserva, e trava" },
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
