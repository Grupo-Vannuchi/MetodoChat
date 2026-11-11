# A preparação 3-0 da parte 3 do LinkedIn — Plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: `superpowers:subagent-driven-development`
> (recomendada) ou `superpowers:executing-plans`, fase por fase. Os passos usam caixa de
> seleção (`- [ ]`) para acompanhar.

**Objetivo:** antes da prova da parte 3a (o carrossel em PDF), deixar a `main` pronta para um post do LinkedIn de forma que ela ainda não publica. O dreno deixa de pegar, e de armar tique por, a linha `publicacao_linkedin` de forma desconhecida. O remarcar não finge que remarcou. E, no lote, o post do LinkedIn já adiado vai primeiro.

**Arquitetura:**
- **As formas e o predicado num lugar só, em `lib/linkedin-publicacao.ts` (puro).**
  - `FORMAS_NO_LINKEDIN` passa a ser exportada: são as formas que este código sabe publicar.
  - `soAFormaConhecidaDoLinkedin(marcador)` devolve o texto do predicado SQL. Ele deixa passar todo tipo que não é o post do LinkedIn, o post cuja forma não é texto (que continua indo a `failed`, como hoje) e a forma da lista. O marcador só aceita `$` e número.
- **Os quatro pontos do dreno usam esse predicado** (`lib/queue-drain.ts`): a seleção, nos dois lados do `or` (a pendente vencida e a presa em `sending`); o tique do rodapé; os tiques do dia; e o "agora" (`drenarUmaPublicacaoDoLinkedin`).
- **O laço do dreno percorre o lote na ordem de `naOrdemDoLote`** (`lib/fila-tipos.ts`, puro): o post do LinkedIn com `adiamentos ≥ 1` no payload vai primeiro, e o resto segue na ordem da seleção. Este código só lê o `adiamentos`; quem o grava é a parte 3a.
- **O remarcar** (`app/publicar/post/actions.ts`) grava a hora nova só no post de forma conhecida. Na forma nova, ele volta com o `AVISO_DO_REMARCAR_DA_FORMA_NOVA` (`lib/post-da-fila.ts`), sem gravar, sem drenar e sem tique. O cancelar não muda.

**Stack:** a do projeto, no Next.js 16.4.3: Vitest (puros e integração) e o Postgres no container para a integração.

**O desenho:** `scratchpad/desenho-li3.md` (d6ce6456), §4 e §6 (trava 1), revisado pela auditoria (`metodochat-43`) em 11/11. A spec é a `docs/specs/2026-11-06-linkedin-no-perfil.md` (a emenda de 09/11, parte 3).

**Por que a preparação vem antes, em uma frase:** o preview usa o banco de produção, e o dreno da produção, com o código de hoje, pega toda linha `publicacao_linkedin` vencida e manda a `failed`, por payload torto, a de forma que ele não lê (`lib/linkedin-fila.ts:226-228`, no `b9258ab`). Isso vale também para o "Remarcar" da produção.

**As decisões do Eduardo, pela caixa de 11/11, às 14:55:42.887Z:**
- **"Em 4 entregas (Recomendado)":** 3-0, 3a, 3b e 3c, nessa ordem. A pergunta dizia que a primeira mexe no motor da fila.
- As outras três (o PDF montado pelo painel, o título pelo começo do texto e o botão com as redes) são da 3a.

**A auditoria (`metodochat-43`, 11/11), sobre o desenho:**
- o predicado exclui só a forma PRESENTE e desconhecida (a linha sem forma continua indo a `failed`);
- os quatro pontos usam o mesmo predicado, de um lugar só, e um teste que lê o arquivo cobra isso;
- o remarcar da produção não grava nem drena, e diz por quê;
- a prioridade no lote vale só para a linha já adiada, e essa mudança do laço vem nesta entrega, que é a do motor;
- a regra de 15/10 vale: a análise de perigo da auditoria, a conversa com o DEV e os agentes;
- um agente independente procura outro caminho que pegue a linha (o relatório está abaixo).

**O agente independente (11/11):** uma busca só de leitura, minuciosa, na cópia do `b9258ab`. O relatório está em `scratchpad/caminhos-da-linha-li30.md`.
- **Fora dos cinco caminhos (a seleção, o tique, os tiques do dia, o "agora" e o remarcar), nenhum outro pega, encerra, muda o status ou o `not_before`, ou arma tique por uma linha `publicacao_linkedin`.**
- Toda outra escrita na fila cai num destes casos:
  - roda depois da reivindicação;
  - filtra por `dm_lote`;
  - age pelo id da linha que o próprio código acabou de inserir;
  - é o cancelar do dono;
  - é código morto (`deleteAccount`);
  - é script manual.
- Os cuidados que ele apontou, todos cobertos aqui:
  - o filtro no SQL, e não no `if` do ramo;
  - **o filtro nos dois lados do `or` da seleção** (a linha presa em `sending`): o predicado fica no nível do `kind = any($3)`, com um caso e a mutação F2-2;
  - o aviso próprio do remarcar, porque sem ele a tela diria "não encontrado";
  - o cancelar, que continua valendo e não limpa o bucket da forma nova (limite conhecido, abaixo).

**Ensaio do plano (11/11):** o código deste plano foi escrito e testado fase a fase numa cópia isolada (`git worktree`, sem push, branch local `ensaio-forma-conhecida`, saída de `b9258ab`, com `npm ci` próprio e `.env.local` vazio). Todo bloco de código abaixo foi tirado do git dessa cópia por um gerador, sem cópia à mão. Os commits do ensaio:
- FASE 1, `d033060` (patch-id `407df0d7d300`);
- FASE 2, `f1a266b` (patch-id `cd3fd1819bd0`);
- FASE 3, `be63d36` (patch-id `ee42da12b118`).
As mensagens são as deste plano. Os números de RED e de GREEN de cada passo são os do ensaio, guardados em arquivo na pasta de trabalho do DEV (`el30-f1-red.log`, `el30-f1-green.log`, `el30-f2-red-puros.log`, `el30-f2-red-integ.log`, `el30-f2-green-*.log`, `el30-f3-red-*.log`, `el30-f3-green-*.log`, `el30-verify-2.log`, `el30-integracao.log` e `el30-mutar.log`).

Os números do fim, no `be63d36` (entre parênteses, os da base `b9258ab`):
- lint e `tsc` limpos em cada fase;
- testes puros: 159 arquivos e 3 770 casos (158 e 3 757); testes de tela: 36 arquivos e 336 casos (36 e 336);
- a varredura sem vazamento e o build com o Next 16.4.3 ("MIGRAÇÃO PULADA", fora da produção);
- a integração no container: 77 arquivos, 938 passaram e 8 pularam (76, 927 e 8);
- as 16 mutações do Apêndice A (10 delas de integração) derrubaram, cada uma, o caso esperado: "16 mutações, 0 ruins; árvore no fim: limpa";
- a guarda do diff (FASE 4) mostra só os 10 arquivos do mapa, com 556 linhas a mais e 22 a menos, e nada em `migrations`, `scripts`, `package.json` nem `package-lock.json`;
- este plano, aplicado do zero numa cópia limpa do `b9258ab` (cada "Crie" gravado, cada "Em ... aplique" passado ao `git apply`), deu os 10 arquivos iguais aos do ensaio: "2 criados, 10 diffs aplicados, 0 apagados, 0 gerados; 10 arquivos conferidos, 0 diferentes".

**O que o ensaio achou:**
- **Um caso antigo usava "reels" como payload torto** (`testes-integracao/linkedin-publicacao.integracao.ts`, "o payload que não é do LinkedIn vai a failed com o motivo escrito"). Com esta entrega, "reels" é uma forma de texto desconhecida e fica intocada, como deve. O caso passou a usar uma imagem sem o caminho (a forma é da lista, e o resto é torto) e continua provando o "payload torto".
- **O tique do rodapé vencido passava antes por outro motivo**: no código de hoje, a linha de forma nova vai a `failed` e não deixa nada pendente. Por isso há também o caso "para daqui a pouco", que falha antes desta entrega.
- **A consulta do tique do rodapé passou da forma de modelo (o `sql` com crase) para o `query`**, porque o predicado é texto. Os valores continuam indo como parâmetro.
- **A primeira rodada do verify parou num caso de outro arquivo**: o `beforeAll` de `tests/proxy-matcher.test.ts` passou de 10 s ao carregar o Next pela primeira vez, na cópia recém-instalada. Sozinho, ele passou duas vezes (899 ms e 1,20 s), e a segunda rodada do verify inteiro passou (`el30-verify-2.log`). Nada desta entrega toca nele.

**Os limites conhecidos (sem código nesta entrega):**
- **O cancelar de um post de forma nova** deixa o arquivo dele no bucket, porque este código não lê os caminhos daquele payload (`caminhosDoPostDaFila` devolve null). O post sai da fila, e o arquivo fica sem dono. É o dono quem cancela, e a parte 3 é que traz a leitura.
- **O `armarOTiqueDaLinha` e o `desfazerLinhaDoLinkedin`** não ganham o predicado: os dois só recebem o id de uma linha que o próprio código acabou de inserir, ou que o "agora" já pegou. O agente independente os marcou como "opcional".
- **Uma forma de texto inventada à mão** (por um pedido montado, e não por um código mais novo) fica `pending`, intocada, como o tipo desconhecido da preparação de 06/11. Não há caminho de hoje que a escreva.

## Restrições globais

- **Branch:** `linkedin-forma-conhecida`, saída do `b9258ab` (a `main` com a parte 2b), sem upstream. Nunca commitar nem empurrar na `main`: ela não está protegida, e um push nela dispara o deploy na Vercel. Conferir `git branch --show-current` antes de cada commit.
- **`git add` com caminho explícito.** Nunca `-A` nem `.`.
- **Commit no estilo do Vinícius:** uma frase dizendo o efeito, sem prefixo, sem rodapé de IA. Autor: Eduardo Kobal <162614913+Eduardokobal@users.noreply.github.com>. Nunca `git config` numa worktree.
- **Antes de cada commit**, varrer os arquivos tocados atrás de caractere de controle e de fim de linha misturado.
- **O commit é um comando à parte**, depois de ler a saída dos testes.
- **Fim de linha:** os diffs deste plano estão em LF. Aplique com `git apply --ignore-whitespace`, ou numa cópia feita com `git -c core.autocrlf=false`.
- **Os arquivos desta entrega são os 10 do mapa abaixo, e mais nenhum.** É código do motor (`lib/queue-drain.ts`): o cuidado do motor vale (auditoria, DEV e agentes).
- **Nenhuma migração e nenhuma escrita em produção** nesta entrega, fora o merge do Eduardo e o deploy que ele dispara. O deploy tem de dizer "Nada a aplicar: as 26 migrações já constam no registro."
- **Uma rodada de integração de cada vez**, sempre com `DATABASE_URL_TESTES=postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes`. Toda rodada tem de imprimir `[rede-global] ALVO: banco de TESTE`. Nunca rode com a variável vazia: ela cai na `DATABASE_URL`, que é **produção**. Se o container estiver parado: `docker start metodochat-banco-de-teste`.
- **`npx --no-install`** sempre (achado 208), e o `npm ci` da FASE 0 antes de qualquer teste.
- **`next build` sem as variáveis de agente:** `env -u CLAUDECODE -u AI_AGENT ...`, e `git diff AGENTS.md` depois.
- **A ordem com a parte 3a:** o push da 3a só depois do deploy desta entrega, conferido.

## Mapa dos arquivos

| Arquivo | O que faz | Fase |
|---|---|---|
| `lib/linkedin-publicacao.ts` | exporta `FORMAS_NO_LINKEDIN` e ganha `soAFormaConhecidaDoLinkedin` | 1 |
| `lib/fila-tipos.ts` | ganha `naOrdemDoLote` | 1 |
| `lib/post-da-fila.ts` | ganha `AVISO_DO_REMARCAR_DA_FORMA_NOVA` | 1 |
| `tests/linkedin-forma-conhecida.test.ts` (novo) | as formas, o predicado, o aviso; e as guardas que leem o dreno e o remarcar | 1, 2 e 3 |
| `tests/fila-tipos.test.ts` | a ordem do lote | 1 |
| `lib/queue-drain.ts` | o predicado nos quatro pontos e a ordem no laço | 2 |
| `testes-integracao/dreno-forma-desconhecida.integracao.ts` (novo) | o dreno, o tique, os tiques do dia e o "agora" com a forma nova | 2 |
| `testes-integracao/linkedin-publicacao.integracao.ts` | o caso do payload torto deixa de usar "reels" | 2 |
| `app/publicar/post/actions.ts` | o remarcar só grava a forma conhecida, e recusa a nova com o aviso | 3 |
| `testes-integracao/linkedin-telas.integracao.ts` | o remarcar e o cancelar da forma nova | 3 |

São 10 arquivos. O `tests/linkedin-forma-conhecida.test.ts` nasce na FASE 1 e cresce nas FASES 2 e 3.

---

### FASE 0 — Começar da branch certa

- [ ] **Passo 1: a branch, saída da `main`**

```bash
git fetch origin
git rev-parse --short origin/main                 # tem de dar b9258ab
git worktree add -b linkedin-forma-conhecida <pasta-da-copia> b9258ab
cd <pasta-da-copia>
git rev-parse --abbrev-ref @{upstream} 2>/dev/null || echo "sem upstream"   # sem upstream: nada sobe sem querer
git branch --show-current                          # linkedin-forma-conhecida
: > .env.local                                     # vazio: nenhum banco de produção na cópia
npm ci
docker ps --format '{{.Names}} {{.Status}}' | grep metodochat-banco-de-teste   # healthy; senão, docker start
```

Se `origin/main` não estiver em `b9258ab`, pare: a base mudou, e o plano precisa ser conferido de novo.

- [ ] **Passo 2: o plano na branch.** O primeiro commit da branch é este plano, em `docs/plans/2026-11-11-linkedin-forma-conhecida.md`, com a mensagem "O plano da preparação 3-0 do LinkedIn: o dreno só pega o post de forma conhecida, o remarcar não finge e o lote põe o já adiado primeiro".

---

### FASE 1 — As formas, o predicado, a ordem do lote e o aviso, num lugar só

**Arquivos:** `lib/linkedin-publicacao.ts`, `lib/fila-tipos.ts`, `lib/post-da-fila.ts`, `tests/linkedin-forma-conhecida.test.ts` (novo), `tests/fila-tipos.test.ts`.

- [ ] **Passo 1: os testes**

Crie `tests/linkedin-forma-conhecida.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { FORMAS_NO_LINKEDIN, soAFormaConhecidaDoLinkedin } from "@/lib/linkedin-publicacao";
import { AVISO_DO_REMARCAR_DA_FORMA_NOVA } from "@/lib/post-da-fila";

// A FORMA DO POST DO LINKEDIN QUE ESTE CÓDIGO CONHECE (a preparação da parte 3 do LinkedIn;
// docs/plans/2026-11-11-linkedin-forma-conhecida.md).
//
// O banco é um só para a produção e os previews. A parte 3 grava posts do LinkedIn de forma nova (o carrossel em PDF,
// o vídeo), e o dreno da produção, com o código de antes, pegaria a linha e a mandaria a `failed` por payload torto.
// O predicado deste arquivo é o que os quatro pontos do dreno e o remarcar usam para deixar essa linha intocada; o
// efeito dele contra o Postgres de verdade está em testes-integracao/dreno-forma-desconhecida.integracao.ts.

describe("as formas do post do LinkedIn que este código conhece", () => {
  it("são as que o ramo do dreno publica hoje: só texto e imagem", () => {
    expect([...FORMAS_NO_LINKEDIN]).toEqual(["texto", "imagem"]);
  });
});

describe("o predicado da forma conhecida", () => {
  it("deixa passar todo tipo que não é o post do LinkedIn, o post cuja forma não é texto, e a forma da lista", () => {
    expect(soAFormaConhecidaDoLinkedin("$5")).toBe(
      "(kind <> 'publicacao_linkedin' or jsonb_typeof(payload->'forma') is distinct from 'string' or payload->>'forma' = any($5::text[]))"
    );
  });

  it("aceita só um marcador de parâmetro ($ e número), para nenhum texto de fora entrar no SQL", () => {
    expect(soAFormaConhecidaDoLinkedin("$12")).toContain("any($12::text[])");
    expect(() => soAFormaConhecidaDoLinkedin("$5; drop table queue")).toThrow();
    expect(() => soAFormaConhecidaDoLinkedin("5")).toThrow();
    expect(() => soAFormaConhecidaDoLinkedin("$0")).toThrow();
    expect(() => soAFormaConhecidaDoLinkedin("")).toThrow();
  });
});

describe("o aviso do remarcar de um post de forma nova", () => {
  it("é erro, diz que esta versão ainda não publica o formato, e que nada foi remarcado", () => {
    expect(AVISO_DO_REMARCAR_DA_FORMA_NOVA).toEqual({
      tom: "erro",
      texto: "Este post do LinkedIn é de um formato que esta versão do painel ainda não publica. Ele não foi remarcado.",
    });
  });
});
```

Em `tests/fila-tipos.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/fila-tipos.test.ts b/tests/fila-tipos.test.ts
index e0926a7..3a97d22 100644
--- a/tests/fila-tipos.test.ts
+++ b/tests/fila-tipos.test.ts
@@ -1,7 +1,7 @@
 import { describe, expect, expectTypeOf, it } from "vitest";
 import { readdirSync, readFileSync } from "node:fs";
 import { join } from "node:path";
-import { TIPOS_DE_PUBLICACAO, TIPOS_QUE_O_DRENO_CONHECE, type TipoDaFila } from "@/lib/fila-tipos";
+import { naOrdemDoLote, TIPOS_DE_PUBLICACAO, TIPOS_QUE_O_DRENO_CONHECE, type TipoDaFila } from "@/lib/fila-tipos";
 import type { QueueItem } from "@/lib/db";
 
 // A LISTA DOS TIPOS QUE O DRENO CONHECE É A DO BANCO (docs/specs/2026-11-06-linkedin-no-perfil.md, §0).
@@ -51,3 +51,53 @@ describe("os tipos que o dreno conhece", () => {
     for (const t of TIPOS_DE_PUBLICACAO) expect(TIPOS_QUE_O_DRENO_CONHECE).toContain(t);
   });
 });
+
+// A ORDEM DO LOTE (a preparação da parte 3 do LinkedIn; docs/plans/2026-11-11-linkedin-forma-conhecida.md). O post
+// do LinkedIn que já foi adiado por falta de tempo (o `adiamentos` do payload, que a parte 3 grava) vai primeiro no
+// lote, para começar com o prazo da função quase inteiro. SÓ O JÁ ADIADO: um carrossel novo à frente de todo lote
+// ocuparia quase a passada inteira, e as mensagens do mesmo lote iriam sempre para a seguinte.
+describe("a ordem do lote", () => {
+  const item = (id: string, kind: string, payload: unknown = {}) => ({ id, kind, payload });
+  const ids = (lote: { id: string }[]) => lote.map((i) => i.id);
+
+  it("sem post do LinkedIn já adiado, o lote fica na ordem de hoje", () => {
+    const lote = [item("a", "dm_manual"), item("b", "publicacao_linkedin", { forma: "texto" }), item("c", "publicacao")];
+    expect(ids(naOrdemDoLote(lote))).toEqual(["a", "b", "c"]);
+  });
+
+  it("o post do LinkedIn já adiado vai primeiro, na ordem em que veio, e o resto segue na ordem de hoje", () => {
+    const lote = [
+      item("a", "dm_manual"),
+      item("b", "publicacao_linkedin", { adiamentos: 0 }),
+      item("c", "comment_reply"),
+      item("d", "publicacao_linkedin", { adiamentos: 2 }),
+      item("e", "publicacao_linkedin", { adiamentos: 1 }),
+    ];
+    expect(ids(naOrdemDoLote(lote))).toEqual(["d", "e", "a", "b", "c"]);
+  });
+
+  it("só conta o adiamento que é número inteiro a partir de 1: zero, negativo, quebrado, texto, ausente e payload torto não movem", () => {
+    const lote = [
+      item("a", "dm_manual"),
+      item("b", "publicacao_linkedin", { adiamentos: 0 }),
+      item("c", "publicacao_linkedin", { adiamentos: -1 }),
+      item("d", "publicacao_linkedin", { adiamentos: 1.5 }),
+      item("e", "publicacao_linkedin", { adiamentos: "3" }),
+      item("f", "publicacao_linkedin", {}),
+      item("g", "publicacao_linkedin", null),
+    ];
+    expect(ids(naOrdemDoLote(lote))).toEqual(["a", "b", "c", "d", "e", "f", "g"]);
+  });
+
+  it("só o post do LinkedIn sobe: outro tipo com adiamentos no payload fica onde estava", () => {
+    const lote = [item("a", "dm_manual"), item("b", "publicacao", { adiamentos: 4 }), item("c", "dm_lote", { adiamentos: 1 })];
+    expect(ids(naOrdemDoLote(lote))).toEqual(["a", "b", "c"]);
+  });
+
+  it("não mexe no lote recebido", () => {
+    const lote = [item("a", "dm_manual"), item("b", "publicacao_linkedin", { adiamentos: 1 })];
+    const copia = [...lote];
+    naOrdemDoLote(lote);
+    expect(lote).toEqual(copia);
+  });
+});
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
npx --no-install vitest run tests/linkedin-forma-conhecida.test.ts tests/fila-tipos.test.ts
```

Esperado: "Test Files 2 failed (2)" e "Tests 9 failed | 4 passed (13)". Caem os 5 casos de "a ordem do lote" (`naOrdemDoLote` ainda não existe) e os 4 de `tests/linkedin-forma-conhecida.test.ts` (o predicado, a lista exportada e o aviso ainda não existem). Passam os 4 de antes de `tests/fila-tipos.test.ts`.

- [ ] **Passo 3: o código**

Em `lib/linkedin-publicacao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/linkedin-publicacao.ts b/lib/linkedin-publicacao.ts
index 28ec869..3a22131 100644
--- a/lib/linkedin-publicacao.ts
+++ b/lib/linkedin-publicacao.ts
@@ -47,13 +47,41 @@ export const TEXTO_DO_CONVITE_SEM_CONFIRMACAO =
 // ---------------------------------------------------------------------------------------------------------------
 
 export type FormaNoLinkedin = "texto" | "imagem";
-const FORMAS_NO_LINKEDIN: readonly FormaNoLinkedin[] = ["texto", "imagem"];
+
+/**
+ * AS FORMAS QUE ESTE CÓDIGO SABE PUBLICAR NO LINKEDIN, numa lista só: a do formulário, a do payload e a do dreno
+ * (`soAFormaConhecidaDoLinkedin`, abaixo). Uma forma acrescentada aqui é uma forma que o dreno passa a pegar.
+ */
+export const FORMAS_NO_LINKEDIN: readonly FormaNoLinkedin[] = ["texto", "imagem"];
 
 /** A forma que veio do formulário, de uma lista fechada. */
 export function formaNoLinkedinDoCampo(bruto: unknown): FormaNoLinkedin | null {
   return (FORMAS_NO_LINKEDIN as readonly unknown[]).includes(bruto) ? (bruto as FormaNoLinkedin) : null;
 }
 
+const MARCADOR_DE_PARAMETRO = /^\$[1-9]\d?$/;
+
+/**
+ * O PREDICADO DA FORMA CONHECIDA (a preparação da parte 3 do LinkedIn; docs/plans/2026-11-11-linkedin-forma-conhecida.md).
+ *
+ * O banco é um só para a produção e os previews, e a parte 3 grava posts do LinkedIn de forma nova (o carrossel em
+ * PDF, o vídeo). Este código não os sabe publicar: o ramo do dreno os mandaria a `failed` por payload torto. Com este
+ * predicado, a linha de forma que este código não conhece fica `pending`, intocada, e não arma tique, até o código
+ * que a conhece chegar, como o tipo desconhecido (`TIPOS_QUE_O_DRENO_CONHECE`, lib/fila-tipos.ts).
+ *
+ * SÓ A FORMA PRESENTE E DESCONHECIDA FICA DE FORA (nota da auditoria). A linha sem forma, ou com uma forma que não é
+ * texto, continua sendo pega e vai a `failed` como antes: ela não é de um código mais novo, é torta, e não pode
+ * ficar parada calada para sempre.
+ *
+ * UM TEXTO SÓ, usado nos quatro pontos do dreno (lib/queue-drain.ts: a seleção, o tique do rodapé, os tiques do dia e
+ * o "agora") e no remarcar (app/publicar/post/actions.ts). O marcador é o do parâmetro que leva `FORMAS_NO_LINKEDIN`;
+ * nenhum texto de fora entra no SQL.
+ */
+export function soAFormaConhecidaDoLinkedin(marcador: string): string {
+  if (!MARCADOR_DE_PARAMETRO.test(marcador)) throw new Error(`marcador de parâmetro inválido: ${JSON.stringify(marcador)}`);
+  return `(kind <> 'publicacao_linkedin' or jsonb_typeof(payload->'forma') is distinct from 'string' or payload->>'forma' = any(${marcador}::text[]))`;
+}
+
 export function rotuloDaFormaNoLinkedin(forma: FormaNoLinkedin): string {
   return forma === "texto" ? "Só texto" : "Imagem";
 }
```

Em `lib/fila-tipos.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/fila-tipos.ts b/lib/fila-tipos.ts
index 58b66f3..c636510 100644
--- a/lib/fila-tipos.ts
+++ b/lib/fila-tipos.ts
@@ -35,3 +35,25 @@ export type TipoDaFila = (typeof TIPOS_QUE_O_DRENO_CONHECE)[number];
 // os tiques do dia são armados só para post (lib/queue-drain.ts). Com um literal, o post do LinkedIn comeria a
 // cota de DM e ficaria parado atrás de um lote grande.
 export const TIPOS_DE_PUBLICACAO = ["publicacao", "publicacao_linkedin"] as const satisfies readonly TipoDaFila[];
+
+// A ORDEM DO LOTE (a preparação da parte 3 do LinkedIn; docs/plans/2026-11-11-linkedin-forma-conhecida.md). O laço do
+// dreno (lib/queue-drain.ts) percorre o lote nesta ordem: primeiro o post do LinkedIn que já foi adiado por falta de
+// tempo, e depois o resto, na ordem em que a seleção o trouxe.
+//
+// POR QUÊ: o ramo do LinkedIn só começa um passo se o prazo da função cobre o pior caso dele, e devolve a linha à fila
+// sem gastar a tentativa quando não cobre (lib/linkedin-fila.ts). Uma linha que sempre chega tarde no lote, depois
+// de outros itens, seria adiada para sempre. A parte 3 grava o `adiamentos` no payload; este código só o lê.
+//
+// SÓ O JÁ ADIADO SOBE (nota da auditoria): um post do LinkedIn novo à frente de todo lote ocuparia quase a passada
+// inteira, e as mensagens e as respostas a comentário do mesmo lote iriam sempre para a passada seguinte. O adiamento
+// que conta é um número inteiro a partir de 1; qualquer outra coisa no payload não move a linha.
+export function naOrdemDoLote<T extends { kind: string; payload: unknown }>(lote: readonly T[]): T[] {
+  const jaAdiado = (i: T) => i.kind === "publicacao_linkedin" && adiamentosDoPayload(i.payload) >= 1;
+  return [...lote.filter(jaAdiado), ...lote.filter((i) => !jaAdiado(i))];
+}
+
+function adiamentosDoPayload(payload: unknown): number {
+  if (!payload || typeof payload !== "object") return 0;
+  const v = (payload as Record<string, unknown>).adiamentos;
+  return typeof v === "number" && Number.isInteger(v) ? v : 0;
+}
```

Em `lib/post-da-fila.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/post-da-fila.ts b/lib/post-da-fila.ts
index 00eeae2..08b6f23 100644
--- a/lib/post-da-fila.ts
+++ b/lib/post-da-fila.ts
@@ -147,3 +147,14 @@ export function avisoDoDesfechoDoPost(
   }
   return avisoDoDesfecho(d, acao);
 }
+
+/**
+ * O AVISO DO REMARCAR DE UM POST DO LINKEDIN DE FORMA NOVA (a preparação da parte 3 do LinkedIn;
+ * docs/plans/2026-11-11-linkedin-forma-conhecida.md). Este código não publica a forma (`soAFormaConhecidaDoLinkedin`,
+ * lib/linkedin-publicacao.ts), então o remarcar não grava a hora nova nem drena: "feito" seria fingir, porque a linha
+ * ficaria parada, e "não encontrado" seria falso, porque o post está ali.
+ */
+export const AVISO_DO_REMARCAR_DA_FORMA_NOVA: Aviso = {
+  tom: "erro",
+  texto: "Este post do LinkedIn é de um formato que esta versão do painel ainda não publica. Ele não foi remarcado.",
+};
```

- [ ] **Passo 4: rodar e ver passar**

```bash
npx --no-install vitest run tests/linkedin-forma-conhecida.test.ts tests/fila-tipos.test.ts
npx --no-install tsc --noEmit
npx --no-install eslint lib/linkedin-publicacao.ts lib/fila-tipos.ts lib/post-da-fila.ts tests/linkedin-forma-conhecida.test.ts tests/fila-tipos.test.ts
```

Esperado: "Test Files 2 passed (2)" e "Tests 13 passed (13)"; o `tsc` e o lint sem saída.

- [ ] **Passo 5: o commit**

```bash
git add lib/linkedin-publicacao.ts lib/fila-tipos.ts lib/post-da-fila.ts tests/fila-tipos.test.ts tests/linkedin-forma-conhecida.test.ts
git commit -m "O post do LinkedIn ganha a lista das formas que este código conhece, o predicado que a leva ao SQL, a ordem do lote que põe o já adiado primeiro e o aviso do remarcar de forma nova"
```

O patch-id (`git show HEAD | git patch-id --stable`) tem de começar por `407df0d7d300`.

---

### FASE 2 — O dreno não pega nem arma tique pela forma nova, e percorre o lote com o já adiado primeiro

**Arquivos:** `lib/queue-drain.ts`, `tests/linkedin-forma-conhecida.test.ts`, `testes-integracao/dreno-forma-desconhecida.integracao.ts` (novo), `testes-integracao/linkedin-publicacao.integracao.ts`.

- [ ] **Passo 1: os testes**

Em `tests/linkedin-forma-conhecida.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/linkedin-forma-conhecida.test.ts b/tests/linkedin-forma-conhecida.test.ts
index b176fe0..bedf953 100644
--- a/tests/linkedin-forma-conhecida.test.ts
+++ b/tests/linkedin-forma-conhecida.test.ts
@@ -1,4 +1,6 @@
 import { describe, expect, it } from "vitest";
+import { readFileSync } from "node:fs";
+import { join } from "node:path";
 import { FORMAS_NO_LINKEDIN, soAFormaConhecidaDoLinkedin } from "@/lib/linkedin-publicacao";
 import { AVISO_DO_REMARCAR_DA_FORMA_NOVA } from "@/lib/post-da-fila";
 
@@ -40,3 +42,27 @@ describe("o aviso do remarcar de um post de forma nova", () => {
     });
   });
 });
+
+// OS QUATRO PONTOS DO DRENO USAM O MESMO PREDICADO (nota da auditoria): a seleção, o tique do rodapé, os tiques do
+// dia e o "agora". Um ponto sem ele pegaria, ou armaria tique por, a linha de forma nova. E o laço percorre o lote
+// na ordem de `naOrdemDoLote` (lib/fila-tipos.ts).
+describe("o dreno usa o predicado e a ordem do lote", () => {
+  const dreno = readFileSync(join(process.cwd(), "lib/queue-drain.ts"), "utf8");
+
+  it("o predicado da forma conhecida aparece nos quatro pontos, e só neles", () => {
+    expect(dreno.match(/soAFormaConhecidaDoLinkedin\(/g)?.length).toBe(4);
+    for (const ponto of [
+      /export async function drenarUmaPublicacaoDoLinkedin[\s\S]*?soAFormaConhecidaDoLinkedin\([\s\S]*?returning \*/,
+      /with lote as \([\s\S]*?soAFormaConhecidaDoLinkedin\([\s\S]*?for update skip locked/,
+      /min\(not_before\)[\s\S]*?soAFormaConhecidaDoLinkedin\(/,
+      /export async function armarTiquesDoDia[\s\S]*?soAFormaConhecidaDoLinkedin\(/,
+    ]) {
+      expect(dreno).toMatch(ponto);
+    }
+  });
+
+  it("o laço do dreno percorre o lote na ordem de naOrdemDoLote", () => {
+    expect(dreno.match(/for \(const item of naOrdemDoLote\(items\)\)/g)?.length).toBe(1);
+    expect(dreno).not.toMatch(/for \(const item of items\)/);
+  });
+});
```

Crie `testes-integracao/dreno-forma-desconhecida.integracao.ts`:

```ts
// O DRENO NÃO PEGA UM POST DO LINKEDIN DE FORMA QUE NÃO CONHECE (a preparação da parte 3 do LinkedIn;
// docs/plans/2026-11-11-linkedin-forma-conhecida.md).
//
// O PROBLEMA, medido no b9258ab: a seleção do dreno (lib/queue-drain.ts, `drainQueue`) pega toda linha
// `publicacao_linkedin` vencida, e o ramo dela (lib/linkedin-fila.ts, `publicarNoLinkedinDaFila`) manda a `failed`,
// por payload torto, a linha cuja forma ele não lê. O banco é um só para a produção e os previews: a parte 3 grava,
// pelo preview, posts de forma nova (o carrossel em PDF, o vídeo), e o dreno da produção, com o código de antes, os
// estragaria. Com o predicado `soAFormaConhecidaDoLinkedin` (lib/linkedin-publicacao.ts) nos quatro pontos — a
// seleção, o tique do rodapé, os tiques do dia e o "agora" —, a linha de forma nova fica `pending`, intocada, e não
// arma tique, até o código que a conhece chegar.
//
// SÓ A FORMA PRESENTE E DESCONHECIDA FICA DE FORA: a linha sem forma, ou com forma que não é texto, continua indo a
// `failed` como antes.
//
// SEM REDE: a conta existe (sem ela, o dreno volta logo no começo, e todo caso daqui passaria por engano), mas não
// tem LinkedIn conectado. A linha de forma conhecida é pega e vai a `failed` com "esta conta não tem LinkedIn
// conectado", antes de qualquer chamada. O LinkedIn e a Meta falsos contam pedidos, e a conta tem de ser zero.
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { bancoDescartavel } from "./harness";

type ModuloDreno = typeof import("@/lib/queue-drain");
type ModuloQstash = typeof import("@/lib/qstash");
type ModuloFila = typeof import("@/lib/linkedin-fila");

const banco = bancoDescartavel();

// Valores inventados. Nenhuma credencial de verdade entra em teste.
const CONTA = "17800000000030001";
const TOKEN_DO_QSTASH = "token-de-qstash-inventado-para-o-teste-da-forma";
const APP_URL = "https://exemplo.invalid";

let publicados: string[] = [];
let pedidosDeFora = 0;
let servidorQstash: Server;
let servidorDeFora: Server;
let dreno: ModuloDreno;
let qstash: ModuloQstash;
let fila: ModuloFila;

beforeAll(async () => {
  servidorQstash = createServer((req: IncomingMessage, res: ServerResponse) => {
    const caminho = req.url ?? "/";
    req.resume();
    if (req.method === "POST" && caminho.startsWith("/v2/publish/")) {
      publicados.push(caminho);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ messageId: `msg-${publicados.length}` }));
      return;
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "o qstash falso nao conhece esse caminho" }));
  });
  // O LINKEDIN E A META FALSOS SÃO UM SÓ: nenhum caso deste arquivo fala com nenhum dos dois.
  servidorDeFora = createServer((req: IncomingMessage, res: ServerResponse) => {
    pedidosDeFora++;
    req.resume();
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ message: "nenhum caso deste arquivo fala com o LinkedIn nem com a Meta" }));
  });
  await new Promise<void>((pronto) => servidorQstash.listen(0, "127.0.0.1", pronto));
  await new Promise<void>((pronto) => servidorDeFora.listen(0, "127.0.0.1", pronto));
  const deFora = `http://127.0.0.1:${(servidorDeFora.address() as AddressInfo).port}`;
  process.env.QSTASH_URL = `http://127.0.0.1:${(servidorQstash.address() as AddressInfo).port}`;
  process.env.QSTASH_TOKEN = TOKEN_DO_QSTASH;
  process.env.IG_GRAPH_BASE = deFora;
  process.env.LINKEDIN_API_BASE = deFora;

  dreno = await import("@/lib/queue-drain");
  qstash = await import("@/lib/qstash");
  fila = await import("@/lib/linkedin-fila");

  // A TRAVA DO INSTRUMENTO, a mesma de dreno-tipo-desconhecido.integracao.ts: um tique de prova tem de chegar ao
  // QStash falso. Sem isso, "nenhum tique" passaria por engano com o QStash desligado.
  if (!qstash.qstashEnabled()) throw new Error("RECUSADO: qstashEnabled() falso com a QSTASH_TOKEN posta.");
  publicados = [];
  await qstash.scheduleTick(APP_URL, 60);
  if (publicados.length !== 1) {
    throw new Error(`RECUSADO: o tique de prova não chegou ao QStash falso (chegaram ${publicados.length}).`);
  }

  await banco.db().updateConfig({ app_url: APP_URL });
  await banco.db().upsertAccount({
    ig_user_id: CONTA,
    username: "conta_da_forma_nova",
    name: "conta_da_forma_nova",
    profile_picture_url: null,
    access_token: "token-da-conta-da-forma-que-nao-vale-nada",
    token_expires_at: null,
  });
});

afterAll(async () => {
  for (const v of ["QSTASH_URL", "QSTASH_TOKEN", "IG_GRAPH_BASE", "LINKEDIN_API_BASE"]) delete process.env[v];
  await new Promise<void>((pronto) => servidorQstash.close(() => pronto()));
  await new Promise<void>((pronto) => servidorDeFora.close(() => pronto()));
});

beforeEach(async () => {
  await banco.db().sql().query(`delete from queue`);
  await banco.db().sql().query(`delete from linkedin_conexoes`);
  publicados = [];
  pedidosDeFora = 0;
});

let semente = 0;

/** Um post do LinkedIn na conta que existe, sem conexão, com o payload como veio. */
async function semear(
  payload: unknown,
  p: { emSegundos?: number; status?: "pending" | "sending"; reivindicadoHaSegundos?: number } = {}
): Promise<string> {
  semente++;
  const [linha] = (await banco.db().sql().query(
    `insert into queue (account_id, kind, payload, dedupe_key, status, not_before, claimed_at)
     values ($1, 'publicacao_linkedin', $2, $3, $4, now() + make_interval(secs => $5::int),
             case when $6::int is null then null else now() - make_interval(secs => $6::int) end)
     returning id`,
    [CONTA, payload, `forma-${semente}`, p.status ?? "pending", p.emSegundos ?? -60, p.reivindicadoHaSegundos ?? null]
  )) as { id: string }[];
  return linha.id;
}

async function linha(id: string) {
  const [l] = (await banco.db().sql().query(
    `select status, attempts, claimed_at, error, not_before from queue where id = $1`,
    [id]
  )) as { status: string; attempts: number; claimed_at: Date | null; error: string | null; not_before: Date }[];
  return l;
}

const CARROSSEL = { forma: "carrossel", caminhos: [`${CONTA}/a.jpg`, `${CONTA}/b.jpg`], texto: "um carrossel do futuro" };
const TEXTO = { forma: "texto", caminhos: [], texto: "um post só de texto" };
const IMAGEM = { forma: "imagem", caminhos: [`${CONTA}/c.jpg`], texto: "um post com imagem" };

describe("o dreno e um post do LinkedIn de forma que ele não conhece", () => {
  test("a linha de forma nova fica pending e intocada, e as de forma conhecida são pegas", async () => {
    const nova = await semear(CARROSSEL);
    const texto = await semear(TEXTO);
    const imagem = await semear(IMAGEM);
    const antes = await linha(nova);

    await dreno.drainQueue();

    const depois = await linha(nova);
    expect(depois.status).toBe("pending");
    expect(depois.attempts).toBe(0);
    expect(depois.claimed_at).toBeNull();
    expect(depois.error).toBeNull();
    expect(depois.not_before.getTime()).toBe(antes.not_before.getTime());

    for (const id of [texto, imagem]) {
      expect(await linha(id)).toMatchObject({ status: "failed", attempts: 1, error: fila.MOTIVO_SEM_CONEXAO });
    }
    expect(pedidosDeFora).toBe(0);
  });

  test("a linha sem forma, e a de forma que não é texto, continuam indo a failed por payload torto", async () => {
    const semForma = await semear({ caminhos: [], texto: "sem forma" });
    const formaNumero = await semear({ forma: 7, caminhos: [], texto: "forma número" });

    await dreno.drainQueue();

    for (const id of [semForma, formaNumero]) {
      expect(await linha(id)).toMatchObject({ status: "failed", error: fila.MOTIVO_DO_PAYLOAD_TORTO });
    }
    expect(pedidosDeFora).toBe(0);
  });

  test("a linha de forma nova presa em sending há mais de 3 minutos não é retomada", async () => {
    const presa = await semear(CARROSSEL, { status: "sending", reivindicadoHaSegundos: 600 });
    const antes = await linha(presa);

    await dreno.drainQueue();

    expect(await linha(presa)).toEqual(antes);
    expect(pedidosDeFora).toBe(0);
  });

  test("o rodapé não arma tique por uma linha de forma nova vencida, que fica pending (sem isso, um tique a cada 20 s)", async () => {
    await semear(CARROSSEL);

    await dreno.drainQueue();

    expect(publicados).toEqual([]);
  });

  test("o rodapé não arma tique por uma linha de forma nova para daqui a pouco", async () => {
    await semear(CARROSSEL, { emSegundos: 600 });

    await dreno.drainQueue();

    expect(publicados).toEqual([]);
  });

  test("o rodapé continua armando o tique por uma linha de forma conhecida para daqui a pouco", async () => {
    await semear(TEXTO, { emSegundos: 600 });

    await dreno.drainQueue();

    expect(publicados.length).toBe(1);
  });

  test("os tiques do dia não contam a linha de forma nova, e contam a de forma conhecida", async () => {
    await semear(CARROSSEL, { emSegundos: 7200 });
    expect(await dreno.armarTiquesDoDia()).toEqual({ armados: 0 });
    expect(publicados).toEqual([]);

    await semear(TEXTO, { emSegundos: 10800 });
    expect(await dreno.armarTiquesDoDia()).toEqual({ armados: 1 });
    expect(publicados.length).toBe(1);
  });

  test("o agora não pega a linha de forma nova, e pega a de forma conhecida", async () => {
    const nova = await semear(CARROSSEL);
    const texto = await semear(TEXTO);
    const antes = await linha(nova);

    expect(await dreno.drenarUmaPublicacaoDoLinkedin(nova)).toBeNull();
    expect(await linha(nova)).toEqual(antes);

    expect(await dreno.drenarUmaPublicacaoDoLinkedin(texto)).toBe("falhou");
    expect(await linha(texto)).toMatchObject({ status: "failed", error: fila.MOTIVO_SEM_CONEXAO });
    expect(pedidosDeFora).toBe(0);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
npx --no-install vitest run tests/linkedin-forma-conhecida.test.ts
DATABASE_URL_TESTES=postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes \
  npx --no-install vitest run --config vitest.integracao.config.ts testes-integracao/dreno-forma-desconhecida.integracao.ts
```

Esperado:
- nos puros, "Tests 2 failed | 4 passed (6)": caem as duas guardas que leem o dreno (o predicado nos quatro pontos e o laço com `naOrdemDoLote`);
- na integração, `ALVO: banco de TESTE` e "Tests 5 failed | 3 passed (8)". Caem:
  - "a linha de forma nova fica pending e intocada, e as de forma conhecida são pegas" (ela vai a `failed`);
  - "a linha de forma nova presa em sending há mais de 3 minutos não é retomada";
  - "o rodapé não arma tique por uma linha de forma nova para daqui a pouco";
  - "os tiques do dia não contam a linha de forma nova, e contam a de forma conhecida" (`armados: 1`);
  - "o agora não pega a linha de forma nova, e pega a de forma conhecida" (`falhou`, e não `null`).
- Passam já hoje, e continuam valendo como regressão: o payload torto (a linha sem forma e a de forma número vão a `failed`), o rodapé da forma conhecida e o rodapé da forma nova vencida. Este último passa hoje porque a linha vai a `failed` e não sobra nada pendente.

- [ ] **Passo 3: o código, e o caso antigo do payload torto**

Em `lib/queue-drain.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/queue-drain.ts b/lib/queue-drain.ts
index 47bf5d1..10d4bfc 100644
--- a/lib/queue-drain.ts
+++ b/lib/queue-drain.ts
@@ -22,10 +22,13 @@ import { renderVariables, type VariableContext } from "./variables";
 // coluna é `variableContext`, aqui embaixo; quem entende o `jsonb` é ele.
 import { lerCampos } from "./campos";
 import { lerPayloadDoLote, loteExpirou } from "./lote";
-import { TIPOS_DE_PUBLICACAO, TIPOS_QUE_O_DRENO_CONHECE } from "./fila-tipos";
+import { naOrdemDoLote, TIPOS_DE_PUBLICACAO, TIPOS_QUE_O_DRENO_CONHECE } from "./fila-tipos";
 // O POST DO LINKEDIN (a parte 2a). O arquivo dele não importa este: as três funções de que ele precisa vão como
 // parâmetro (`DEPENDENCIAS_DO_LINKEDIN`, lá embaixo).
 import { publicarNoLinkedinDaFila, type DependenciasDoDreno } from "./linkedin-fila";
+// A FORMA DO POST DO LINKEDIN QUE ESTE CÓDIGO CONHECE (a preparação da parte 3): um predicado só, nos quatro pontos
+// que pegam a linha ou armam tique por ela — a seleção, o tique do rodapé, os tiques do dia e o "agora".
+import { FORMAS_NO_LINKEDIN, soAFormaConhecidaDoLinkedin } from "./linkedin-publicacao";
 import {
   leituraDoContainer,
   lerPayloadDaPublicacao,
@@ -1020,7 +1023,7 @@ const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  * cron do dia seguinte (testes-integracao/tique-do-rodape.integracao.ts).
  *
  * Devolve o desfecho ("aguardando" quando a linha voltou à fila), ou null quando não pegou nada (id torto, outro
- * tipo, agendada, ou já pega).
+ * tipo, agendada, já pega, ou de uma forma que este código não conhece: `soAFormaConhecidaDoLinkedin`).
  */
 export async function drenarUmaPublicacaoDoLinkedin(
   id: string,
@@ -1030,8 +1033,9 @@ export async function drenarUmaPublicacaoDoLinkedin(
   const [item] = (await sql().query(
     `update queue set status = 'sending', claimed_at = now(), attempts = attempts + 1
       where id = $1 and kind = 'publicacao_linkedin' and status = 'pending' and not_before <= now()
+        and ${soAFormaConhecidaDoLinkedin("$2")}
       returning *`,
-    [id]
+    [id, Array.from(FORMAS_NO_LINKEDIN)]
   )) as QueueItem[];
   if (!item) return null;
   let desfecho: "publicado" | "aguardando" | "falhou";
@@ -1143,6 +1147,12 @@ export async function drainQueue(opcoes: { inicioDaFuncaoMs?: number } = {}): Pr
            -- (testes-integracao/dreno-tipo-desconhecido.integracao.ts). Sem crase
            -- neste comentario: ele mora DENTRO do template do SQL.
            and kind = any($3::text[])
+           -- E SO O POST DO LINKEDIN DE FORMA QUE ESTE CODIGO CONHECE (a preparacao
+           -- da parte 3; lib/linkedin-publicacao.ts, soAFormaConhecidaDoLinkedin). Vale
+           -- para os dois lados do or de cima: a pendente vencida e a presa em sending.
+           -- A forma nova fica pending, intocada, ate o codigo que a conhece chegar
+           -- (testes-integracao/dreno-forma-desconhecida.integracao.ts).
+           and ${soAFormaConhecidaDoLinkedin("$5")}
            -- A PUBLICACAO NAO E BLOQUEADA PELO TETO DE MENSAGEM. A conta que
            -- estourou as 190 DMs da hora sai INTEIRA do lote, e sem esta
            -- excecao um lote grande de mensagens -- que leva horas para sair --
@@ -1160,7 +1170,13 @@ export async function drainQueue(opcoes: { inicioDaFuncaoMs?: number } = {}): Pr
        returning q.*
      )
      select *, now() as agora_do_banco from lote order by created_at, id`,
-    [BATCH_SIZE, blocked, Array.from(TIPOS_QUE_O_DRENO_CONHECE), Array.from(TIPOS_DE_PUBLICACAO)]
+    [
+      BATCH_SIZE,
+      blocked,
+      Array.from(TIPOS_QUE_O_DRENO_CONHECE),
+      Array.from(TIPOS_DE_PUBLICACAO),
+      Array.from(FORMAS_NO_LINKEDIN),
+    ]
   )) as (QueueItem & { agora_do_banco: Date })[];
 
   // O RELOGIO QUE JULGA A VALIDADE É O DO BANCO, E NÃO O DA APLICAÇÃO.
@@ -1185,7 +1201,10 @@ export async function drainQueue(opcoes: { inicioDaFuncaoMs?: number } = {}): Pr
   const marcado = items[0]?.agora_do_banco;
   const agoraNoBanco = marcado instanceof Date ? marcado.getTime() : Date.now();
 
-  for (const item of items) {
+  // A ORDEM DO LOTE (a preparação da parte 3 do LinkedIn; `naOrdemDoLote`, lib/fila-tipos.ts): o post do LinkedIn
+  // que já foi adiado por falta de tempo vai primeiro, para começar com o prazo da função quase inteiro. Só ele; o
+  // resto segue na ordem da seleção.
+  for (const item of naOrdemDoLote(items)) {
     const account = item.account_id ? byId.get(item.account_id) : undefined;
     if (!account) {
       // conta desconectada (ou item órfão antigo): não há token para enviar
@@ -1398,12 +1417,19 @@ export async function drainQueue(opcoes: { inicioDaFuncaoMs?: number } = {}): Pr
   // que ele não conhece fica `pending` para sempre, e sem este filtro o `min(not_before)` dela, vencido,
   // armaria um tique a cada 20 s, sem fim — a cota do QStash acabaria, e com ela os tiques do produto
   // inteiro (testes-integracao/dreno-tipo-desconhecido.integracao.ts).
-  const nextRows = (await sql()`
-    select extract(epoch from (min(not_before) - now()))::float8 as secs
-    from queue where status = 'pending'
-      and kind = any(${Array.from(TIPOS_QUE_O_DRENO_CONHECE)}::text[])
-      and not_before <= now() + make_interval(secs => ${HORIZONTE_DO_TIQUE_EM_SEGUNDOS}::int)
-  `) as { secs: number | null }[];
+  //
+  // E SÓ O POST DO LINKEDIN DE FORMA QUE ESTE CÓDIGO CONHECE (a preparação da parte 3), pelo mesmo motivo: a linha
+  // de forma nova fica `pending`, e o `min(not_before)` dela, vencido, armaria o mesmo tique sem fim
+  // (testes-integracao/dreno-forma-desconhecida.integracao.ts). O predicado é texto, e por isso a consulta vai
+  // pelo `query`, com os valores como parâmetro.
+  const nextRows = (await sql().query(
+    `select extract(epoch from (min(not_before) - now()))::float8 as secs
+       from queue where status = 'pending'
+        and kind = any($1::text[])
+        and ${soAFormaConhecidaDoLinkedin("$3")}
+        and not_before <= now() + make_interval(secs => $2::int)`,
+    [Array.from(TIPOS_QUE_O_DRENO_CONHECE), HORIZONTE_DO_TIQUE_EM_SEGUNDOS, Array.from(FORMAS_NO_LINKEDIN)]
+  )) as { secs: number | null }[];
   const secs = nextRows[0]?.secs;
   if (secs !== null && secs !== undefined) {
     const config = await getConfig();
@@ -1461,11 +1487,12 @@ export async function armarTiquesDoDia(): Promise<{ armados: number }> {
     `select distinct ceil(extract(epoch from (not_before - now())))::int as secs
        from queue
       where kind = any($2::text[]) and status = 'pending'
+        and ${soAFormaConhecidaDoLinkedin("$3")}
         and not_before > now()
         and not_before <= now() + make_interval(secs => $1::int)
       order by secs
       limit 200`,
-    [HORIZONTE_DO_TIQUE_EM_SEGUNDOS, Array.from(TIPOS_DE_PUBLICACAO)]
+    [HORIZONTE_DO_TIQUE_EM_SEGUNDOS, Array.from(TIPOS_DE_PUBLICACAO), Array.from(FORMAS_NO_LINKEDIN)]
   )) as { secs: number }[];
   if (!linhas.length) return { armados: 0 };
 
```

O caso antigo usava "reels" como payload torto. Com o predicado, "reels" é uma forma desconhecida e fica intocada, então o caso passa a usar uma imagem sem o caminho:

Em `testes-integracao/linkedin-publicacao.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/linkedin-publicacao.integracao.ts b/testes-integracao/linkedin-publicacao.integracao.ts
index 9db893a..49594e5 100644
--- a/testes-integracao/linkedin-publicacao.integracao.ts
+++ b/testes-integracao/linkedin-publicacao.integracao.ts
@@ -427,9 +427,12 @@ describe("os erros do LinkedIn no dreno", () => {
     expect(linkedin.pedidos).toHaveLength(0);
   });
 
+  // A FORMA É DA LISTA, E O RESTO É TORTO (a imagem sem o caminho). Uma forma que não é da lista ("reels", que este
+  // caso usava antes) é de um código mais novo e fica intocada, pela preparação da parte 3
+  // (testes-integracao/dreno-forma-desconhecida.integracao.ts).
   it("o payload que não é do LinkedIn vai a failed com o motivo escrito", async () => {
     await q(
-      `insert into queue (account_id, kind, payload, dedupe_key) values ($1, 'publicacao_linkedin', '{"forma":"reels"}'::jsonb, 'pub-linkedin:torta')`,
+      `insert into queue (account_id, kind, payload, dedupe_key) values ($1, 'publicacao_linkedin', '{"forma":"imagem","caminhos":[],"texto":"sem a imagem"}'::jsonb, 'pub-linkedin:torta')`,
       [CONTA]
     );
     await dreno.drainQueue();
```

- [ ] **Passo 4: rodar e ver passar**

```bash
npx --no-install vitest run tests/linkedin-forma-conhecida.test.ts tests/fila-tipos.test.ts
DATABASE_URL_TESTES=postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes \
  npx --no-install vitest run --config vitest.integracao.config.ts \
  testes-integracao/dreno-forma-desconhecida.integracao.ts testes-integracao/dreno-tipo-desconhecido.integracao.ts \
  testes-integracao/tique-do-rodape.integracao.ts testes-integracao/linkedin-publicacao.integracao.ts \
  testes-integracao/linkedin-telas.integracao.ts
npx --no-install tsc --noEmit
npx --no-install eslint lib/queue-drain.ts tests/linkedin-forma-conhecida.test.ts testes-integracao/dreno-forma-desconhecida.integracao.ts testes-integracao/linkedin-publicacao.integracao.ts
```

Esperado:
- nos puros, "Test Files 2 passed (2)" e "Tests 15 passed (15)";
- na integração, `ALVO: banco de TESTE`, "Test Files 5 passed (5)" e "Tests 71 passed (71)";
- "nenhum schema teste_tmp_* no banco" antes e depois;
- o `tsc` e o lint sem saída.

- [ ] **Passo 5: o commit**

```bash
git add lib/queue-drain.ts tests/linkedin-forma-conhecida.test.ts testes-integracao/dreno-forma-desconhecida.integracao.ts testes-integracao/linkedin-publicacao.integracao.ts
git commit -m "O dreno não pega nem arma tique pelo post do LinkedIn de forma que não conhece, e percorre o lote com o já adiado primeiro"
```

O patch-id tem de começar por `cd3fd1819bd0`.

---

### FASE 3 — O remarcar não grava nem drena a forma nova, e diz por quê

**Arquivos:** `app/publicar/post/actions.ts`, `tests/linkedin-forma-conhecida.test.ts`, `testes-integracao/linkedin-telas.integracao.ts`.

- [ ] **Passo 1: os testes**

Em `tests/linkedin-forma-conhecida.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/linkedin-forma-conhecida.test.ts b/tests/linkedin-forma-conhecida.test.ts
index bedf953..4b2d777 100644
--- a/tests/linkedin-forma-conhecida.test.ts
+++ b/tests/linkedin-forma-conhecida.test.ts
@@ -66,3 +66,25 @@ describe("o dreno usa o predicado e a ordem do lote", () => {
     expect(dreno).not.toMatch(/for \(const item of items\)/);
   });
 });
+
+// O REMARCAR USA O MESMO PREDICADO (a preparação da parte 3): na gravação da hora nova e na leitura do status que
+// separa a forma nova do "não encontrado". O cancelar não o usa: cancelar é a ação do dono, e vale para toda forma.
+describe("o remarcar usa o predicado, e o cancelar não", () => {
+  const acoes = readFileSync(join(process.cwd(), "app/publicar/post/actions.ts"), "utf8");
+  const corpo = (nome: string) => {
+    const inicio = acoes.indexOf(`export async function ${nome}(`);
+    const fim = acoes.indexOf("\nexport async function ", inicio + 1);
+    return acoes.slice(inicio, fim === -1 ? undefined : fim);
+  };
+
+  it("o predicado aparece duas vezes no arquivo: no update do remarcar e na leitura do status", () => {
+    expect(acoes.match(/soAFormaConhecidaDoLinkedin\(/g)?.length).toBe(2);
+    expect(corpo("remarcarPublicacao")).toMatch(/update queue set not_before[\s\S]*?soAFormaConhecidaDoLinkedin\(/);
+    expect(acoes).toMatch(/async function statusNaConta[\s\S]*?soAFormaConhecidaDoLinkedin\([\s\S]*?\n\}/);
+  });
+
+  it("o remarcar recusa a forma nova com o aviso próprio, e o cancelar não fala dela", () => {
+    expect(corpo("remarcarPublicacao")).toContain("AVISO_DO_REMARCAR_DA_FORMA_NOVA");
+    expect(corpo("cancelarPublicacao")).not.toMatch(/soAFormaConhecidaDoLinkedin|AVISO_DO_REMARCAR_DA_FORMA_NOVA/);
+  });
+});
```

Em `testes-integracao/linkedin-telas.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/linkedin-telas.integracao.ts b/testes-integracao/linkedin-telas.integracao.ts
index 9cf944b..6f58296 100644
--- a/testes-integracao/linkedin-telas.integracao.ts
+++ b/testes-integracao/linkedin-telas.integracao.ts
@@ -374,6 +374,59 @@ describe("cancelar e remarcar valem para o post do LinkedIn", () => {
   });
 });
 
+// O POST DO LINKEDIN DE FORMA NOVA (a preparação da parte 3 do LinkedIn; docs/plans/2026-11-11-linkedin-forma-conhecida.md).
+// Este código não publica a forma: o remarcar não grava a hora nova nem drena, e diz por quê, em vez de "feito"
+// (a linha ficaria parada) ou de "não encontrado" (o post está ali). O cancelar continua valendo: é a ação do dono.
+describe("o remarcar e o cancelar de um post do LinkedIn de forma nova", () => {
+  async function semearFormaNova(emSegundos: number): Promise<{ id: string; notBefore: number }> {
+    semente++;
+    const [linha] = (await q(
+      `insert into queue (account_id, kind, payload, dedupe_key, not_before)
+       values ($1, 'publicacao_linkedin', $2, $3, now() + make_interval(secs => $4::int))
+       returning id, not_before`,
+      [
+        CONTA_A,
+        { forma: "carrossel", caminhos: [`${CONTA_A}/novo-${semente}-a.jpg`, `${CONTA_A}/novo-${semente}-b.jpg`], texto: "um carrossel do futuro" },
+        `telas-forma-nova-${semente}`,
+        emSegundos,
+      ]
+    )) as { id: string; not_before: Date }[];
+    return { id: linha.id, notBefore: new Date(linha.not_before).getTime() };
+  }
+
+  it("remarcar para o minuto corrente: nada muda, nada drena, e o aviso diz que esta versão não publica o formato", async () => {
+    await conectar();
+    const { id, notBefore } = await semearFormaNova(3600);
+    const minuto = Math.floor(Date.now() / 60000) * 60000;
+    const aviso = await avisoDe(acoes.remarcarPublicacao, formulario({ id, data_hora: campoDeDataHora(minuto), fuso: "0" }));
+    expect(aviso).toEqual({
+      tom: "erro",
+      texto: "Este post do LinkedIn é de um formato que esta versão do painel ainda não publica. Ele não foi remarcado.",
+    });
+    const depois = await lerItem(id);
+    expect(depois).toMatchObject({ status: "pending", attempts: 0, error: null });
+    expect(new Date(depois.not_before as Date).getTime()).toBe(notBefore);
+    expect(pedidos.linkedin).toEqual([]);
+    expect(pedidos.meta).toEqual([]);
+  });
+
+  it("remarcar para daqui a três horas: a hora não muda, e o aviso é o mesmo", async () => {
+    const { id, notBefore } = await semearFormaNova(3600);
+    const alvo = Math.floor((Date.now() + 3 * 3600 * 1000) / 60000) * 60000;
+    const aviso = await avisoDe(acoes.remarcarPublicacao, formulario({ id, data_hora: campoDeDataHora(alvo), fuso: "0" }));
+    expect(aviso.tom).toBe("erro");
+    expect(aviso.texto).toBe("Este post do LinkedIn é de um formato que esta versão do painel ainda não publica. Ele não foi remarcado.");
+    expect(new Date((await lerItem(id)).not_before as Date).getTime()).toBe(notBefore);
+  });
+
+  it("cancelar continua valendo: a linha fica skipped com o motivo do dono", async () => {
+    const { id } = await semearFormaNova(3600);
+    const aviso = await avisoDe(acoes.cancelarPublicacao, formulario({ id, confirmo: "1" }));
+    expect(aviso.tom).toBe("ok");
+    expect(await lerItem(id)).toMatchObject({ status: "skipped", error: publicacao.MOTIVO_CANCELADO_PELO_DONO });
+  });
+});
+
 describe("o Início e o gerador conhecem o post do LinkedIn", () => {
   it("o post do LinkedIn que falhou é aviso de publicação, e não de mensagem", async () => {
     await semear({ forma: "texto", status: "failed", emSegundos: -3600, reivindicadoEm: -3600, error: "falhou" });
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
npx --no-install vitest run tests/linkedin-forma-conhecida.test.ts
DATABASE_URL_TESTES=postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes \
  npx --no-install vitest run --config vitest.integracao.config.ts testes-integracao/linkedin-telas.integracao.ts
```

Esperado:
- nos puros, "Tests 2 failed | 6 passed (8)": caem as duas guardas do remarcar;
- na integração, `ALVO: banco de TESTE` e "Tests 2 failed | 15 passed (17)". Caem os dois remarcar da forma nova, com o aviso "ok" de hoje e a hora mudada. Passa o cancelar, que não muda.

- [ ] **Passo 3: o código**

Em `app/publicar/post/actions.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/publicar/post/actions.ts b/app/publicar/post/actions.ts
index 7abbdc1..1b852d2 100644
--- a/app/publicar/post/actions.ts
+++ b/app/publicar/post/actions.ts
@@ -24,7 +24,15 @@ import { exigirSessao } from "@/lib/exigir-sessao";
 // O POST DE QUALQUER REDE (a parte 2a do LinkedIn): as duas ações valem para os tipos de post da fila, os arquivos
 // a apagar e o aviso do "já saiu" saem do payload e da rede da linha.
 import { TIPOS_DE_PUBLICACAO } from "@/lib/fila-tipos";
-import { avisoDoDesfechoDoPost, caminhosDoPostDaFila, ehPostDoLinkedin } from "@/lib/post-da-fila";
+import {
+  AVISO_DO_REMARCAR_DA_FORMA_NOVA,
+  avisoDoDesfechoDoPost,
+  caminhosDoPostDaFila,
+  ehPostDoLinkedin,
+} from "@/lib/post-da-fila";
+// A FORMA DO POST DO LINKEDIN QUE ESTE CÓDIGO CONHECE (a preparação da parte 3): o remarcar não grava a hora nova de
+// um post de forma nova, que este código não publica.
+import { FORMAS_NO_LINKEDIN, soAFormaConhecidaDoLinkedin } from "@/lib/linkedin-publicacao";
 
 /**
  * CANCELAR E REMARCAR UM POST AGENDADO.
@@ -106,12 +114,18 @@ const ALVO_DA_MUDANCA =
  * responderia um status e faria a tela dizer que o post de outra pessoa já saiu —
  * que é contar sobre a fila alheia.
  */
-async function statusNaConta(id: string, contaId: string): Promise<{ status: string; kind: string } | null> {
-  // O `kind` VOLTA JUNTO (a parte 2a do LinkedIn): é ele que escolhe o aviso do "já saiu" de cada rede.
+async function statusNaConta(
+  id: string,
+  contaId: string
+): Promise<{ status: string; kind: string; forma_conhecida: boolean } | null> {
+  // O `kind` VOLTA JUNTO (a parte 2a do LinkedIn): é ele que escolhe o aviso do "já saiu" de cada rede. E se a forma
+  // é uma que este código conhece (a preparação da parte 3), pelo mesmo predicado do update do remarcar: é o que
+  // separa o post de forma nova, que está ali e não foi remarcado, do "não encontrado".
   const linhas = (await sql().query(
-    `select status, kind from queue where id = $1 and account_id = $2 and kind = any($3::text[])`,
-    [id, contaId, Array.from(TIPOS_DE_PUBLICACAO)]
-  )) as { status: string; kind: string }[];
+    `select status, kind, ${soAFormaConhecidaDoLinkedin("$4")} as forma_conhecida
+       from queue where id = $1 and account_id = $2 and kind = any($3::text[])`,
+    [id, contaId, Array.from(TIPOS_DE_PUBLICACAO), Array.from(FORMAS_NO_LINKEDIN)]
+  )) as { status: string; kind: string; forma_conhecida: boolean }[];
   return linhas[0] ?? null;
 }
 
@@ -259,16 +273,25 @@ export async function remarcarPublicacao(formData: FormData): Promise<void> {
   // aceita o minuto corrente, que já passou, e ele vira "agora" pelo relógio do
   // banco. O `returning` devolve o que o banco mediu no mesmo statement: se o
   // item já vale, e quantos segundos faltam (spec da hora marcada).
+  //
+  // SÓ O POST DE FORMA QUE ESTE CÓDIGO CONHECE (a preparação da parte 3 do LinkedIn): a forma nova não é publicada
+  // por este código, e gravar a hora dela, ou drenar, seria dizer "feito" com a linha parada.
   const afetadas = (await sql().query(
     `update queue set not_before = greatest(now(), $3::timestamptz)
      ${ALVO_DA_MUDANCA}
+       and ${soAFormaConhecidaDoLinkedin("$5")}
      returning id, kind,
                (not_before <= now()) as ja_vale,
                greatest(0, ceil(extract(epoch from (not_before - now()))))::int as falta`,
-    [id, conta.ig_user_id, momento.quando, Array.from(TIPOS_DE_PUBLICACAO)]
+    [id, conta.ig_user_id, momento.quando, Array.from(TIPOS_DE_PUBLICACAO), Array.from(FORMAS_NO_LINKEDIN)]
   )) as { id: string; kind: string; ja_vale: boolean; falta: number }[];
 
   const naConta = afetadas.length > 0 ? null : await statusNaConta(id, conta.ig_user_id);
+  // A FORMA NOVA TEM AVISO PRÓPRIO: o post está ali, pendente, e não foi remarcado. Nada foi gravado, nada drena e
+  // nenhum tique é armado (testes-integracao/linkedin-telas.integracao.ts).
+  if (naConta && naConta.status === "pending" && !naConta.forma_conhecida) {
+    redirect(urlDeAgendadosComAviso(AVISO_DO_REMARCAR_DA_FORMA_NOVA));
+  }
   const desfecho = desfechoDaMudanca(afetadas.length, naConta?.status ?? null);
 
   // O TIQUE DA HORA NOVA, e ele é o outro lado de "Ele sai na hora nova".
```

- [ ] **Passo 4: rodar e ver passar**

```bash
npx --no-install vitest run tests/linkedin-forma-conhecida.test.ts tests/fila-tipos.test.ts
DATABASE_URL_TESTES=postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes \
  npx --no-install vitest run --config vitest.integracao.config.ts \
  testes-integracao/linkedin-telas.integracao.ts testes-integracao/agendados.integracao.ts testes-integracao/nao-saiu.integracao.ts
npx --no-install tsc --noEmit
npx --no-install eslint app/publicar/post/actions.ts tests/linkedin-forma-conhecida.test.ts testes-integracao/linkedin-telas.integracao.ts
```

Esperado:
- nos puros, "Test Files 2 passed (2)" e "Tests 17 passed (17)";
- na integração, `ALVO: banco de TESTE`, "Test Files 3 passed (3)" e "Tests 65 passed (65)";
- o `tsc` e o lint sem saída.

O texto do aviso é conferido letra a letra em três lugares: no puro, no caso de integração do minuto corrente e no das três horas.

- [ ] **Passo 5: o commit**

```bash
git add app/publicar/post/actions.ts tests/linkedin-forma-conhecida.test.ts testes-integracao/linkedin-telas.integracao.ts
git commit -m "O remarcar não grava nem drena o post do LinkedIn de forma que este código não publica, e diz por quê"
```

O patch-id tem de começar por `ee42da12b118`.

---

### FASE 4 — A verificação inteira, as mutações e a guarda do diff

- [ ] **Passo 1: o verify**

```bash
env -u CLAUDECODE -u AI_AGENT npm run verify; echo "saída $?"; git diff --stat AGENTS.md
```

Esperado: saída 0; 159 arquivos e 3 770 casos puros; 36 e 336 de tela; "SEM VAZAMENTO em A nem em C, nas duas varreduras."; "MIGRAÇÃO PULADA — este não é um deploy de produção."; o build do Next 16.4.3; e o `git diff --stat AGENTS.md` vazio.

- [ ] **Passo 2: a integração inteira, uma rodada só**

```bash
DATABASE_URL_TESTES=postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes npm run test:integracao
```

Esperado: `ALVO: banco de TESTE`; "nenhum schema teste_tmp_* no banco" antes e depois; "Test Files 77 passed (77)" e "Tests 938 passed | 8 skipped (946)" (na base, 76 arquivos, 927 e 8).

- [ ] **Passo 3: as mutações (Apêndice A)**

```bash
node ../mutar-li30.mjs --conferir    # "16 mutações, 0 ruins; árvore no fim: limpa (só a conferência dos trechos)"
node ../mutar-li30.mjs
```

Esperado: as 16 como "MORTA", e "16 mutações, 0 ruins; árvore no fim: limpa". Se a rodada parar antes dessa linha, rode `git status` e `git diff` antes de qualquer outra coisa: o arquivo da mutação em curso pode ter ficado mutado, e só ele se restaura.

- [ ] **Passo 4: a guarda do diff**

```bash
git diff --stat b9258ab HEAD -- . ':!docs'
git diff --name-only b9258ab HEAD -- migrations scripts package.json package-lock.json   # vazio
git diff --name-only b9258ab HEAD -- docs                                                  # só este plano
```

Esperado: no primeiro, os 10 arquivos do mapa, e mais nenhum: "10 files changed, 556 insertions(+), 22 deletions(-)". O segundo, vazio. No terceiro, só este plano. O patch-id de cada fase (`git show <commit> | git patch-id --stable`) tem de bater com o do ensaio: `407df0d7d300`, `cd3fd1819bd0` e `ee42da12b118`.

---

### FASE 5 — O push, o preview, o PR e o deploy

Esta entrega não muda nada que se veja na tela, fora o aviso do remarcar de um post que hoje não existe. Por isso não há prova no navegador: provocar uma linha de forma nova seria gravar na produção. A prova é a integração, as mutações, a base lida pela auditoria antes e depois do merge, e o deploy.

- [ ] **Passo 1: o push da branch, com o OK do Eduardo pela caixa e a hora à auditoria**

```bash
git ls-remote origin refs/heads/linkedin-forma-conhecida   # vazio; se não estiver, pare
git push -u origin refs/heads/linkedin-forma-conhecida:refs/heads/linkedin-forma-conhecida
```

No log do build do preview, confira:
- o commit;
- nenhum aviso do Node 26;
- "Detected Next.js version: 16.4.3";
- "MIGRAÇÃO PULADA".

- [ ] **Passo 2: o PR, com o OK do Eduardo pela caixa.**
  - O corpo leva o que muda, os números deste plano, o que o ensaio achou e os limites conhecidos, sem nenhuma arroba solta nem nome de pessoa ou de conta.
  - A mensagem do merge vai à parte, e a auditoria lê os dois antes de o PR abrir.
  - **A caixa do PR diz que o merge espera a conferência da auditoria e uma caixa minha.**
  - O merge é do Eduardo. A caixa do merge é de resultado: sem "(Recomendado)" e com "Não fiz / não lembro".

- [ ] **Passo 3: o deploy do merge.**
  - No log, quatro coisas:
    - "Nada a aplicar: as 26 migrações já constam no registro.";
    - o `queue_kind_check` "existe e confere (025-fila-linkedin.sql)";
    - as outras conferências "CONFERIDO";
    - nenhum aviso do Node 26.
  - No site: o `/entrar` dá 200, e o cron sem senha dá 401.
  - A auditoria lê a base: igual à de antes do merge.
  - Os registros da produção da primeira hora, sem erro novo.

Com esta entrega em produção, a parte 3a (o carrossel em PDF) começa pelo plano dela.

---

## Apêndice A — As mutações

O roteiro roda da raiz da cópia, com a árvore commitada e limpa, e com o `node_modules` da cópia. Cada mutação troca um trecho que aparece uma vez só, roda o arquivo de teste que a cobre e confere que o caso nomeado cai, pelo nome inteiro. As de integração rodam contra o banco de TESTE, uma de cada vez. No fim, a árvore volta limpa.

Nas mutações do SQL, o predicado é trocado por `($N::text[] is not null)`, e não apagado: o parâmetro continua usado e a consulta continua válida, e o caso cai pelo efeito, e não por um erro de SQL.

```js
// AS MUTAÇÕES DA PREPARAÇÃO 3-0 DA PARTE 3 DO LINKEDIN (o dreno só pega o post do LinkedIn de forma conhecida; o
// remarcar não finge; no lote, o já adiado vai primeiro), no molde de mutar-li2b.mjs. Cada uma desfaz UMA trava,
// trocando um trecho exato de um arquivo (que tem de aparecer uma vez só), roda só o arquivo de teste que a cobre e
// confere que o caso NOMEADO cai, pelo nome inteiro. As de integração rodam contra o banco de TESTE, uma de cada
// vez. A árvore tem de estar commitada e limpa antes, e volta limpa no fim. O vitest roda por `npx --no-install`
// (achado 208), e a cópia tem de ter o node_modules dela.
//
// NAS MUTAÇÕES DO SQL, o predicado é trocado por `($N::text[] is not null)`, e não apagado: o parâmetro continua
// usado, e a consulta continua válida. Assim o caso cai pelo efeito (a linha pega, o tique armado), e não por um
// erro de SQL.
//
// Uso, da raiz da cópia: node ../mutar-li30.mjs [prefixo-do-nome]
//                        node ../mutar-li30.mjs --conferir   (só confere que cada trecho aparece uma vez)
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const TESTES_URL = "postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes";
if (process.env.DATABASE_URL) throw new Error("RECUSADO: DATABASE_URL no ambiente");
if (!existsSync("node_modules/.bin/vitest")) throw new Error("RECUSADO: sem node_modules/.bin/vitest nesta cópia");
const status = () => execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim();
if (status() !== "") throw new Error("RECUSADO: árvore suja antes das mutações");

const PURO = { config: null };
const INTEG = { config: "vitest.integracao.config.ts" };

const T_FORMA = { ...PURO, arquivo: "tests/linkedin-forma-conhecida.test.ts" };
const T_TIPOS = { ...PURO, arquivo: "tests/fila-tipos.test.ts" };
const T_DRENO = { ...INTEG, arquivo: "testes-integracao/dreno-forma-desconhecida.integracao.ts" };
const T_TELAS = { ...INTEG, arquivo: "testes-integracao/linkedin-telas.integracao.ts" };

const PUB = "lib/linkedin-publicacao.ts";
const TIPOS = "lib/fila-tipos.ts";
const DRENO = "lib/queue-drain.ts";
const ACOES = "app/publicar/post/actions.ts";

const MUTACOES = [
  // ---- F1: as regras puras ----
  {
    nome: "F1-1: o predicado sem a exceção da forma que não é texto",
    arq: PUB,
    de: "jsonb_typeof(payload->'forma') is distinct from 'string' or ",
    para: "",
    teste: T_DRENO,
    cai: "a linha sem forma, e a de forma que não é texto, continuam indo a failed por payload torto",
  },
  {
    nome: "F1-2: o predicado deixa toda forma passar",
    arq: PUB,
    de: "payload->>'forma' = any(${marcador}::text[]))`;",
    para: "${marcador}::text[] is not null)`;",
    teste: T_DRENO,
    cai: "a linha de forma nova fica pending e intocada, e as de forma conhecida são pegas",
  },
  {
    nome: "F1-3: a lista das formas ganha o carrossel",
    arq: PUB,
    de: 'export const FORMAS_NO_LINKEDIN: readonly FormaNoLinkedin[] = ["texto", "imagem"];',
    para: 'export const FORMAS_NO_LINKEDIN: readonly string[] = ["texto", "imagem", "carrossel"];',
    teste: T_FORMA,
    cai: "são as que o ramo do dreno publica hoje: só texto e imagem",
  },
  {
    nome: "F1-4: o marcador sem a trava",
    arq: PUB,
    de: "  if (!MARCADOR_DE_PARAMETRO.test(marcador)) throw new Error(`marcador de parâmetro inválido: ${JSON.stringify(marcador)}`);\n",
    para: "",
    teste: T_FORMA,
    cai: "aceita só um marcador de parâmetro ($ e número), para nenhum texto de fora entrar no SQL",
  },
  {
    nome: "F1-5: a ordem do lote conta o adiamento zero",
    arq: TIPOS,
    de: 'i.kind === "publicacao_linkedin" && adiamentosDoPayload(i.payload) >= 1;',
    para: 'i.kind === "publicacao_linkedin" && adiamentosDoPayload(i.payload) >= 0;',
    teste: T_TIPOS,
    cai: "sem post do LinkedIn já adiado, o lote fica na ordem de hoje",
  },
  {
    nome: "F1-6: a ordem do lote sobe outro tipo",
    arq: TIPOS,
    de: 'i.kind === "publicacao_linkedin" && adiamentosDoPayload(i.payload) >= 1;',
    para: "adiamentosDoPayload(i.payload) >= 1;",
    teste: T_TIPOS,
    cai: "só o post do LinkedIn sobe: outro tipo com adiamentos no payload fica onde estava",
  },
  {
    nome: "F1-7: o adiamento em texto ou quebrado conta",
    arq: TIPOS,
    de: 'return typeof v === "number" && Number.isInteger(v) ? v : 0;',
    para: "return Number(v) || 0;",
    teste: T_TIPOS,
    cai: "só conta o adiamento que é número inteiro a partir de 1: zero, negativo, quebrado, texto, ausente e payload torto não movem",
  },

  // ---- F2: o dreno ----
  {
    nome: "F2-1: a seleção sem o predicado",
    arq: DRENO,
    de: '           and ${soAFormaConhecidaDoLinkedin("$5")}\n',
    para: "           and ($5::text[] is not null)\n",
    teste: T_DRENO,
    cai: "a linha de forma nova fica pending e intocada, e as de forma conhecida são pegas",
  },
  {
    nome: "F2-2: o predicado da seleção só do lado da pendente",
    arq: DRENO,
    de: '           and ${soAFormaConhecidaDoLinkedin("$5")}\n',
    para: "           and (status = 'sending' or ${soAFormaConhecidaDoLinkedin(\"$5\")})\n",
    teste: T_DRENO,
    cai: "a linha de forma nova presa em sending há mais de 3 minutos não é retomada",
  },
  {
    nome: "F2-3: o agora sem o predicado",
    arq: DRENO,
    de: '        and ${soAFormaConhecidaDoLinkedin("$2")}\n',
    para: "        and ($2::text[] is not null)\n",
    teste: T_DRENO,
    cai: "o agora não pega a linha de forma nova, e pega a de forma conhecida",
  },
  {
    nome: "F2-4: o tique do rodapé sem o predicado",
    arq: DRENO,
    de: '        and kind = any($1::text[])\n        and ${soAFormaConhecidaDoLinkedin("$3")}\n',
    para: "        and kind = any($1::text[])\n        and ($3::text[] is not null)\n",
    teste: T_DRENO,
    cai: "o rodapé não arma tique por uma linha de forma nova para daqui a pouco",
  },
  {
    nome: "F2-5: os tiques do dia sem o predicado",
    arq: DRENO,
    de: "      where kind = any($2::text[]) and status = 'pending'\n        and ${soAFormaConhecidaDoLinkedin(\"$3\")}\n",
    para: "      where kind = any($2::text[]) and status = 'pending'\n        and ($3::text[] is not null)\n",
    teste: T_DRENO,
    cai: "os tiques do dia não contam a linha de forma nova, e contam a de forma conhecida",
  },
  {
    nome: "F2-6: o laço sem a ordem do lote",
    arq: DRENO,
    de: "  for (const item of naOrdemDoLote(items)) {\n",
    para: "  for (const item of items) {\n",
    teste: T_FORMA,
    cai: "o laço do dreno percorre o lote na ordem de naOrdemDoLote",
  },

  // ---- F3: o remarcar ----
  {
    nome: "F3-1: o update do remarcar sem o predicado",
    arq: ACOES,
    de: '       and ${soAFormaConhecidaDoLinkedin("$5")}\n',
    para: "       and ($5::text[] is not null)\n",
    teste: T_TELAS,
    cai: "remarcar para o minuto corrente: nada muda, nada drena, e o aviso diz que esta versão não publica o formato",
  },
  {
    nome: "F3-2: o status do remarcar sem a forma",
    arq: ACOES,
    de: '${soAFormaConhecidaDoLinkedin("$4")} as forma_conhecida',
    para: "($4::text[] is not null) as forma_conhecida",
    teste: T_TELAS,
    cai: "remarcar para daqui a três horas: a hora não muda, e o aviso é o mesmo",
  },
  {
    nome: "F3-3: o remarcar sem o aviso da forma nova",
    arq: ACOES,
    de: '  if (naConta && naConta.status === "pending" && !naConta.forma_conhecida) {\n',
    para: "  if (false) {\n",
    teste: T_TELAS,
    cai: "remarcar para o minuto corrente: nada muda, nada drena, e o aviso diz que esta versão não publica o formato",
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
    const args = ["--no-install", "vitest", "run", ...(m.teste.config ? ["--config", m.teste.config] : []), m.teste.arquivo];
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
