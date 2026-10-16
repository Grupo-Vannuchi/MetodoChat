# O post em nova tentativa aparece como "publicando" no gerador — Plano de implementação (achado 100)

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: `superpowers:subagent-driven-development`
> (recomendada) ou `superpowers:executing-plans`, fase por fase. Os passos usam caixa de
> seleção (`- [ ]`) para acompanhar.

**Objetivo:** na página do carrossel, o post que já foi tentado e espera a nova tentativa aparece como
"publicando", e não como "Agendado para"; na espera da cota da conta, a frase diz o motivo e a hora da nova
tentativa, e a da trava aponta o calendário.

**Arquitetura:** a decisão é pura e mora no gerador. `estadoDaPublicacao` (`lib/bonus/publicar-estado.ts`)
passa a usar o `error` da linha da fila, que só a nova tentativa grava numa publicação pendente: pendente no
futuro sem `error` é `agendado`; com `error`, é `publicando`, e com o motivo da cota, `publicando` com a
espera e a hora. As frases (`lib/bonus/publicar-textos.ts`) leem a espera. Uma guarda lê o dreno para o
começo do motivo da cota não mudar sem o gerador saber. O motor, o repositório e o banco não mudam.

**Stack:** a do projeto, no Next.js 16.3.8: Vitest (as três suítes), Postgres no container para a
integração.

**Spec:** `docs/specs/2026-10-15-publicando-na-retentativa.md` (commits `bce1332` e `71788dc`; revisada e
liberada pela auditoria com quatro correções de texto; lida pelo Eduardo em 15/10). Leia antes de começar:
este plano não repete o porquê, só como construir.

**Ensaio do plano (15/10):** o código deste plano foi escrito e testado fase a fase numa cópia isolada do
repositório (`git worktree`, branch local `ensaio-retentativa`, sem push, saída de `71788dc`), e todo bloco
de código abaixo foi tirado do git dessa cópia por um gerador, sem cópia à mão. Os números do ensaio:
- lint e `tsc` limpos em cada fase; no fim, 117 arquivos e 3 218 casos puros (117 arquivos e 3 212 na base) e
  23 arquivos e 203 de tela (iguais à base: nenhuma tela muda);
- `next build --webpack` limpo, e o `AGENTS.md` intacto;
- integração no container: 45 arquivos, 506 passaram e 8 pularam (na base, 45 arquivos, 505 passaram e 8 pularam), com o `.env.local` vazio na cópia;
- cada fase foi vista falhar antes do código e passar depois, com os números no passo dela;
- as 9 provas de mutação do Apêndice A derrubaram, cada uma, o caso esperado;
- o plano, aplicado do zero numa cópia limpa, dá os 4 arquivos iguais ao fim do ensaio, byte a byte;
- a guarda do diff (FASE 3, passo 4) mostrou só os arquivos do mapa abaixo.

O ensaio achou estas coisas, já resolvidas neste plano:
1. **O caso "a cota com a hora vencida é publicando, sem espera" passa antes do código, de propósito:** o
   vencido já é `publicando` hoje. Ele prende o que não pode mudar (a espera só vale com a hora no futuro), e
   a mutação "1: a espera da cota vale com a hora vencida" o derruba.
2. **A guarda compara o texto do dreno por concatenação** (`"error: \`" + MOTIVO_DA_COTA + " ("`): a crase do
   template do dreno faz parte do que ela cobra.

## Restrições globais

- **Branch:** `publicando-na-retentativa`, saída da `main` em `fc16464`, **sem upstream** (o
  `git worktree add -b` sobre `origin/main` liga a branch à `main`: desligue com
  `git branch --unset-upstream publicando-na-retentativa`). Nunca commitar nem empurrar na `main`.
  Conferir `git branch --show-current` antes de cada commit.
- **`git add` com caminho explícito.** Nunca `-A` nem `.`.
- **Commit no estilo do Vinícius:** uma frase dizendo o efeito, sem prefixo, o porquê no corpo, sem
  rodapé de IA. Autor: Eduardo Kobal <162614913+Eduardokobal@users.noreply.github.com>.
- **Antes de cada commit**, varrer os arquivos tocados com `node "$SCRATCH/varrer-texto.mjs" <arquivos>`.
- **O commit é um comando à parte**, depois de ler a saída dos testes.
- **Fim de linha:** converta antes os arquivos que a fase toca (`node "$SCRATCH/para-lf.mjs" <arquivo>`) e
  aplique os diffs com `git apply`, ou à mão.
- **Os arquivos desta etapa são os do mapa abaixo, e mais nenhum.** Nada do motor (`lib/queue-drain.ts`,
  `lib/engine.ts`, `app/publicar/`), do repositório do gerador, das telas, das migrações nem do `package`.
- **Sem migração.** O build do merge tem de dizer "Nada a aplicar: as 19 migrações".
- **Uma rodada de integração de cada vez**, sempre com `DATABASE_URL_TESTES` apontando para o container
  (`127.0.0.1:5434`). Toda rodada tem de imprimir `[rede-global] ALVO: banco de TESTE`. Nunca rode com a
  variável vazia: ela cai na `DATABASE_URL`, que é **produção**.
- **`next build` sem as variáveis de agente:** `env -u CLAUDECODE -u AI_AGENT ...`, e `git diff AGENTS.md`
  depois.
- **Escrita em produção só com o OK do Eduardo**, a hora mandada à auditoria antes, e o script que grava
  lido por ela antes de rodar.
- **Ao fechar cada fase**, avisar o auditor (`metodochat-20` em 15/10; conferir o nome no `ListAgents`) com
  o hash.

## Mapa dos arquivos

| arquivo | responsabilidade | fase |
|---|---|---|
| `lib/bonus/publicar-estado.ts` | `MOTIVO_DA_COTA`; o `publicando` com `espera?`; o `case "pending"` que lê o `error` | 1 |
| `lib/bonus/publicar-textos.ts` | as frases do estado e da trava na espera da cota | 2 |
| `tests/bonus-publicar-estado.test.ts` | os casos do estado, a guarda do dreno e as frases | 1 e 2 |
| `testes-integracao/bonus-publicar-repositorio.integracao.ts` | o estado lido do banco: agendado, publicando e a espera da cota | 1 |

---

## O ACHADO 100

### FASE 0 — Começar da main certa

- [ ] **Passo 1: conferir a main e a branch**

```bash
git ls-remote origin refs/heads/main
git switch publicando-na-retentativa
git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null || echo "sem upstream"
git log --oneline -4
```

Esperado: a `main` em `fc16464` (ou depois dele); "sem upstream"; a branch com os commits da spec e este
plano sobre `fc16464`.

- [ ] **Passo 2: a linha de base**

```bash
npm test
npm run test:dom
npm run banco:teste
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npm run test:integracao
```

Esperado: 117 arquivos e 3 212 casos puros; 23 arquivos e 203 de tela; `[rede-global] ALVO: banco de TESTE`,
45 arquivos, 505 passaram e 8 pularam.

---

### FASE 1 — O estado lê o motivo da nova tentativa

**Arquivos:**
- Modificar: `lib/bonus/publicar-estado.ts`
- Testar: `tests/bonus-publicar-estado.test.ts`, `testes-integracao/bonus-publicar-repositorio.integracao.ts`

**Interfaces:**
- Produz: `MOTIVO_DA_COTA = "a cota de publicacoes da conta acabou"`; no tipo `EstadoDaPublicacao`, o
  `publicando` passa a `{ tipo: "publicando"; filaId: string | null; espera?: { motivo: "cota"; ate: Date } }`.

- [ ] **Passo 1: os testes**

Em `tests/bonus-publicar-estado.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-publicar-estado.test.ts b/tests/bonus-publicar-estado.test.ts
index 67bf302..e028acc 100644
--- a/tests/bonus-publicar-estado.test.ts
+++ b/tests/bonus-publicar-estado.test.ts
@@ -1,7 +1,10 @@
+import { readFileSync } from "node:fs";
+import { fileURLToPath } from "node:url";
 import { describe, expect, it } from "vitest";
 import { fmtDate } from "@/lib/format";
 import {
   ESPERA_DA_RESERVA_MS,
+  MOTIVO_DA_COTA,
   artesParaPublicar,
   estadoDaPublicacao,
   faltasParaPublicar,
@@ -66,6 +69,34 @@ describe("o estado da publicação, lido da fila", () => {
     });
   });
 
+  // A NOVA TENTATIVA NÃO É AGENDADO (achado 100, spec 2026-10-15-publicando-na-retentativa). O dreno
+  // empurra o not_before para a frente e grava o motivo no error, e só a nova tentativa grava error numa
+  // publicação pendente. Antes, o "Publicar agora" que esperava a Meta aparecia como "Agendado para".
+  it("pendente com o motivo de uma tentativa, e a hora no futuro, é publicando", () => {
+    for (const error of ["a Meta ainda esta processando a midia", "fetch failed", "a Meta respondeu 500"]) {
+      expect(estadoDaPublicacao(reserva(), linha({ not_before: depois(60_000), error }), AGORA)).toEqual({
+        tipo: "publicando",
+        filaId: "fila-1",
+      });
+    }
+  });
+
+  // A COTA ESPERA UMA HORA, e por isso diz o motivo e a hora da nova tentativa (decisão do Eduardo).
+  it("pendente esperando a cota da conta é publicando, com a espera e a hora da nova tentativa", () => {
+    const error = `${MOTIVO_DA_COTA} (25 de 25 em 24h); o post sai assim que ela virar`;
+    expect(estadoDaPublicacao(reserva(), linha({ not_before: depois(3_600_000), error }), AGORA)).toEqual({
+      tipo: "publicando",
+      filaId: "fila-1",
+      espera: { motivo: "cota", ate: depois(3_600_000) },
+    });
+  });
+
+  // VENCIDA, A COTA NÃO TEM MAIS O QUE ESPERAR: o dreno a pega na próxima passada.
+  it("a cota com a hora vencida é publicando, sem espera", () => {
+    const error = `${MOTIVO_DA_COTA} (25 de 25 em 24h); o post sai assim que ela virar`;
+    expect(estadoDaPublicacao(reserva(), linha({ not_before: AGORA, error }), AGORA)).toEqual({ tipo: "publicando", filaId: "fila-1" });
+  });
+
   it("enviado é publicado, com a hora do envio", () => {
     expect(estadoDaPublicacao(reserva(), linha({ status: "sent", sent_at: antes(60_000) }), AGORA)).toEqual({
       tipo: "publicado",
@@ -107,6 +138,17 @@ describe("o estado da publicação, lido da fila", () => {
   });
 });
 
+// O ACOPLAMENTO AO TEXTO DO DRENO (spec 2026-10-15-publicando-na-retentativa, "A guarda do
+// acoplamento"): o gerador reconhece a espera da cota pelo começo do error que o dreno grava. Se a frase
+// mudar lá, este caso cai no verify, e não na tela de quem espera.
+describe("o motivo da cota, como o dreno grava", () => {
+  it("o error da cota em lib/queue-drain.ts começa por MOTIVO_DA_COTA", () => {
+    const raiz = fileURLToPath(new URL("..", import.meta.url));
+    const dreno = readFileSync(`${raiz}/lib/queue-drain.ts`, "utf8");
+    expect(dreno).toContain("error: `" + MOTIVO_DA_COTA + " (");
+  });
+});
+
 describe("a trava: o que libera", () => {
   const estados: [EstadoDaPublicacao, boolean][] = [
     [{ tipo: "livre" }, true],
```

Em `testes-integracao/bonus-publicar-repositorio.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/bonus-publicar-repositorio.integracao.ts b/testes-integracao/bonus-publicar-repositorio.integracao.ts
index 18fe114..17dc235 100644
--- a/testes-integracao/bonus-publicar-repositorio.integracao.ts
+++ b/testes-integracao/bonus-publicar-repositorio.integracao.ts
@@ -246,6 +246,33 @@ describe("a trava nas gravações do carrossel", () => {
     const [linha] = (await banco.db().sql().query(`select * from carrosseis_gerados where id = $1`, [id])) as { arte: unknown }[];
     expect((await publicar.estadoDoCarrossel(linha.arte)).tipo).toBe("publicado");
   });
+
+  // A NOVA TENTATIVA, LIDA DO BANCO (achado 100): o repositório já lê o error da linha, e o estado
+  // separa o agendado do post que já foi tentado.
+  it("o pendente no futuro: sem motivo é agendado; com motivo é publicando; na cota, com a espera", async () => {
+    const id = await publicado(CHAVE);
+    await naFila(CHAVE, "pending");
+    const arte = async () =>
+      ((await banco.db().sql().query(`select arte from carrosseis_gerados where id = $1`, [id])) as { arte: unknown }[])[0].arte;
+    expect((await publicar.estadoDoCarrossel(await arte())).tipo).toBe("agendado");
+
+    await banco.db().sql().query(`update queue set error = 'a Meta ainda esta processando a midia' where dedupe_key = $1`, [CHAVE]);
+    expect(await publicar.estadoDoCarrossel(await arte())).toMatchObject({ tipo: "publicando" });
+    expect(await publicar.estadoDoCarrossel(await arte())).not.toHaveProperty("espera");
+
+    await banco
+      .db()
+      .sql()
+      .query(
+        `update queue set error = 'a cota de publicacoes da conta acabou (25 de 25 em 24h); o post sai assim que ela virar'
+          where dedupe_key = $1`,
+        [CHAVE]
+      );
+    const [{ not_before }] = (await banco.db().sql().query(`select not_before from queue where dedupe_key = $1`, [CHAVE])) as {
+      not_before: Date;
+    }[];
+    expect(await publicar.estadoDoCarrossel(await arte())).toMatchObject({ tipo: "publicando", espera: { motivo: "cota", ate: not_before } });
+  });
 });
 
 describe("a reserva da publicação", () => {
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-publicar-estado.test.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-publicar-repositorio.integracao.ts
```

Esperado: nos puros, 3 caem e 51 passam (54): os dois casos novos do estado e a guarda (`MOTIVO_DA_COTA` ainda
não existe); o da cota vencida passa antes, de propósito (item 1 do ensaio). Na integração,
`[rede-global] ALVO: banco de TESTE`, 1 cai e 29 passam (30): o pendente com motivo ainda é `agendado`.

- [ ] **Passo 3: o código**

Em `lib/bonus/publicar-estado.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/publicar-estado.ts b/lib/bonus/publicar-estado.ts
index 5403fb6..4436ca8 100644
--- a/lib/bonus/publicar-estado.ts
+++ b/lib/bonus/publicar-estado.ts
@@ -14,10 +14,17 @@ export type LinhaDaFila = { id: string; status: string; not_before: Date; sent_a
  */
 export const ESPERA_DA_RESERVA_MS = 10 * 60_000;
 
+/**
+ * O COMEÇO DO MOTIVO QUE O DRENO GRAVA QUANDO A CONTA CHEGA AO LIMITE DE POSTS DAS ÚLTIMAS 24 HORAS
+ * (lib/queue-drain.ts, a espera da cota de publicação). O gerador reconhece a espera pelo texto, e
+ * `tests/bonus-publicar-estado.test.ts` lê o dreno para a frase de lá não mudar sem este começo mudar junto.
+ */
+export const MOTIVO_DA_COTA = "a cota de publicacoes da conta acabou";
+
 export type EstadoDaPublicacao =
   | { tipo: "livre" }
   | { tipo: "agendado"; quando: Date; filaId: string }
-  | { tipo: "publicando"; filaId: string | null }
+  | { tipo: "publicando"; filaId: string | null; espera?: { motivo: "cota"; ate: Date } }
   | { tipo: "publicado"; em: Date | null; filaId: string }
   | { tipo: "falhou"; motivo: string | null; filaId: string }
   | { tipo: "cancelado"; filaId: string }
@@ -34,10 +41,22 @@ export function estadoDaPublicacao(
   if (publicacao === "estranha") return { tipo: "desconhecido" };
   if (linha) {
     switch (linha.status) {
-      case "pending":
-        return linha.not_before.getTime() > agora.getTime()
-          ? { tipo: "agendado", quando: linha.not_before, filaId: linha.id }
-          : { tipo: "publicando", filaId: linha.id };
+      case "pending": {
+        // A NOVA TENTATIVA NÃO É AGENDADO (achado 100, spec 2026-10-15-publicando-na-retentativa). O
+        // dreno empurra o `not_before` para a frente quando a Meta pede para esperar (+60 s), quando a
+        // conta chega ao limite de posts (+1 h) e numa falha passageira (+120 s), e grava o motivo no
+        // `error`. Só a nova tentativa grava `error` numa publicação pendente (medido pela auditoria em
+        // 15/10): um post agendado que ainda não foi tentado tem `error` nulo. Antes, o "Publicar agora"
+        // que esperava a Meta aparecia como "Agendado para" a hora seguinte.
+        const noFuturo = linha.not_before.getTime() > agora.getTime();
+        if (noFuturo && linha.error === null) return { tipo: "agendado", quando: linha.not_before, filaId: linha.id };
+        // A COTA ESPERA UMA HORA, repetida até a janela de 24 h virar, e por isso a tela diz o motivo e
+        // a hora da nova tentativa (decisão do Eduardo). As outras esperas saem em 1 ou 2 minutos.
+        if (noFuturo && linha.error?.startsWith(MOTIVO_DA_COTA)) {
+          return { tipo: "publicando", filaId: linha.id, espera: { motivo: "cota", ate: linha.not_before } };
+        }
+        return { tipo: "publicando", filaId: linha.id };
+      }
       case "sending":
         return { tipo: "publicando", filaId: linha.id };
       case "sent":
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx eslint lib/bonus/publicar-estado.ts tests/bonus-publicar-estado.test.ts testes-integracao/bonus-publicar-repositorio.integracao.ts
npx vitest run tests/bonus-publicar-estado.test.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-publicar-repositorio.integracao.ts
```

Esperado: `tsc` e lint limpos; os 54 puros passam; na integração, os 30 passam.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/publicar-estado.ts tests/bonus-publicar-estado.test.ts testes-integracao/bonus-publicar-repositorio.integracao.ts
test "$(git branch --show-current)" = "publicando-na-retentativa"
git add lib/bonus/publicar-estado.ts tests/bonus-publicar-estado.test.ts testes-integracao/bonus-publicar-repositorio.integracao.ts
```

```bash
git commit -F - <<'MSG'
O post já tentado deixa de aparecer como agendado no gerador

O dreno empurra o not_before para a frente a cada nova tentativa e grava o
motivo no error, e o gerador decidia o agendado só pelo not_before no
futuro: o "Publicar agora" que esperava a Meta aparecia como "Agendado
para" a hora seguinte (achado 100). Só a nova tentativa grava error numa
publicação pendente, e o estado passa a usá-lo como sinal. Na espera da
cota da conta, que dura uma hora, o estado leva o motivo e a hora, e uma
guarda lê o dreno para a frase de lá não mudar sem o gerador saber.
MSG
```

---

### FASE 2 — As frases da espera da cota

**Arquivos:**
- Modificar: `lib/bonus/publicar-textos.ts`
- Testar: `tests/bonus-publicar-estado.test.ts`

**Interfaces:**
- Consome: o `publicando` com `espera?` (FASE 1).

- [ ] **Passo 1: os testes**

Em `tests/bonus-publicar-estado.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-publicar-estado.test.ts b/tests/bonus-publicar-estado.test.ts
index e028acc..96680cb 100644
--- a/tests/bonus-publicar-estado.test.ts
+++ b/tests/bonus-publicar-estado.test.ts
@@ -191,6 +191,26 @@ describe("as frases do estado", () => {
     }
   });
 
+  // A ESPERA DA COTA DIZ O MOTIVO E A HORA (achado 100, decisão do Eduardo): ela dura uma hora, e
+  // repete até a janela de 24 h virar. O publicando sem espera fica com a frase de sempre.
+  it("o publicando na espera da cota diz o motivo e a hora da nova tentativa", () => {
+    const ate = depois(3_600_000);
+    expect(textoDoEstadoDaPublicacao({ tipo: "publicando", filaId: "f", espera: { motivo: "cota", ate } })).toBe(
+      `Publicando assim que o Instagram liberar: a conta chegou ao limite de posts das últimas 24 horas. Nova tentativa por volta de ${fmtDate(ate)} (horário de Brasília).`
+    );
+    expect(textoDoEstadoDaPublicacao({ tipo: "publicando", filaId: "f" })).toBe(
+      "Publicando. O Instagram leva até um minuto: recarregue a página para ver."
+    );
+  });
+
+  // A TRAVA APONTA O CALENDÁRIO NA ESPERA DA COTA (pedido da auditoria): o post que espera continua
+  // cancelável, e "não muda até o post sair" esconderia a saída que existe.
+  it("a trava na espera da cota aponta o calendário", () => {
+    expect(textoDaTrava({ tipo: "publicando", filaId: "f", espera: { motivo: "cota", ate: AGORA } })).toBe(
+      "Esperando o Instagram liberar: para mudar, cancele no calendário."
+    );
+  });
+
   it("a trava das edições diz por que o carrossel não muda", () => {
     expect(textoDaTrava({ tipo: "agendado", quando: AGORA, filaId: "f" })).toBe("Agendado: para mudar, cancele no calendário.");
     expect(textoDaTrava({ tipo: "publicando", filaId: null })).toBe("Publicando: o carrossel não muda até o post sair.");
@@ -389,6 +409,7 @@ describe("a cor do estado na página", () => {
     expect(tomDoEstadoDaPublicacao({ tipo: "agendado", quando: AGORA, filaId: "f" })).toBe("ok");
     expect(tomDoEstadoDaPublicacao({ tipo: "publicado", em: AGORA, filaId: "f" })).toBe("ok");
     expect(tomDoEstadoDaPublicacao({ tipo: "publicando", filaId: null })).toBe("atencao");
+    expect(tomDoEstadoDaPublicacao({ tipo: "publicando", filaId: "f", espera: { motivo: "cota", ate: AGORA } })).toBe("atencao");
     expect(tomDoEstadoDaPublicacao({ tipo: "cancelado", filaId: "f" })).toBe("atencao");
     expect(tomDoEstadoDaPublicacao({ tipo: "nao_entrou" })).toBe("atencao");
     expect(tomDoEstadoDaPublicacao({ tipo: "falhou", motivo: null, filaId: "f" })).toBe("erro");
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-publicar-estado.test.ts
```

Esperado: 2 caem e 54 passam (56): a frase do estado e a da trava na espera da cota.

- [ ] **Passo 3: o código**

Em `lib/bonus/publicar-textos.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/publicar-textos.ts b/lib/bonus/publicar-textos.ts
index 892474a..69fb0f8 100644
--- a/lib/bonus/publicar-textos.ts
+++ b/lib/bonus/publicar-textos.ts
@@ -25,7 +25,11 @@ export function textoDoEstadoDaPublicacao(e: EstadoDaPublicacao): string | null
     case "agendado":
       return `Agendado para ${fmtDate(e.quando)} (horário de Brasília).`;
     case "publicando":
-      return "Publicando. O Instagram leva até um minuto: recarregue a página para ver.";
+      // A ESPERA DA COTA DIZ O MOTIVO E A HORA (achado 100): ela dura uma hora, e repete até a janela
+      // de 24 h virar. As outras esperas saem em 1 ou 2 minutos, e ficam com a frase de sempre.
+      return e.espera
+        ? `Publicando assim que o Instagram liberar: a conta chegou ao limite de posts das últimas 24 horas. Nova tentativa por volta de ${fmtDate(e.espera.ate)} (horário de Brasília).`
+        : "Publicando. O Instagram leva até um minuto: recarregue a página para ver.";
     case "publicado":
       return e.em ? `Publicado em ${fmtDate(e.em)}.` : "Publicado.";
     case "falhou":
@@ -103,7 +107,12 @@ export function textoDaTrava(e: EstadoDaPublicacao): string {
     case "agendado":
       return "Agendado: para mudar, cancele no calendário.";
     case "publicando":
-      return "Publicando: o carrossel não muda até o post sair.";
+      // NA ESPERA DA COTA, O CALENDÁRIO (pedido da auditoria no achado 100): o post que espera continua
+      // cancelável (o cancelar só exige `status = 'pending'`), e "não muda até o post sair" esconderia
+      // a saída que existe.
+      return e.espera
+        ? "Esperando o Instagram liberar: para mudar, cancele no calendário."
+        : "Publicando: o carrossel não muda até o post sair.";
     case "publicado":
       return "Este carrossel já foi publicado, e fica só para leitura.";
     default:
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx eslint lib/bonus/publicar-textos.ts tests/bonus-publicar-estado.test.ts
npx vitest run tests/bonus-publicar-estado.test.ts
```

Esperado: `tsc` e lint limpos; os 56 passam.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/publicar-textos.ts tests/bonus-publicar-estado.test.ts
test "$(git branch --show-current)" = "publicando-na-retentativa"
git add lib/bonus/publicar-textos.ts tests/bonus-publicar-estado.test.ts
```

```bash
git commit -F - <<'MSG'
Na espera da cota, o gerador diz o motivo, a hora e o caminho para cancelar

A espera da cota de posts da conta dura uma hora e se repete até a janela
de 24 horas virar, e o "Publicando" de sempre não dizia por quê. A frase
do estado passa a dizer o limite e a hora da nova tentativa, e a da trava
aponta o calendário: o post que espera continua cancelável, e "não muda
até o post sair" escondia a saída que existe.
MSG
```

---

### FASE 3 — A verificação inteira

- [ ] **Passo 1: o verify, numa pasta com o `node_modules` próprio**

```bash
env -u CLAUDECODE -u AI_AGENT npm run verify
git diff --stat AGENTS.md
```

Esperado: lint e `tsc` limpos; 117 arquivos e 3 218 casos puros e 23 arquivos e 203 de tela; a varredura "SEM VAZAMENTO
em A nem em C"; o build (Turbopack) com "MIGRAÇÃO PULADA"; o `AGENTS.md` sem diferença.

- [ ] **Passo 2: a integração inteira, no container**

```bash
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npm run test:integracao
```

Esperado: `[rede-global] ALVO: banco de TESTE`; 45 arquivos, 506 passaram e 8 pularam (na base, 45 arquivos, 505 passaram e 8 pularam).

- [ ] **Passo 3: as provas de mutação**

Copie o script do Apêndice A para `$SCRATCH/mutar-retentativa.mjs` e rode, da raiz:

```bash
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" node "$SCRATCH/mutar-retentativa.mjs"
git status --short
```

Esperado: as 9 com ✓, "9 mutações, 0 ruins", e a árvore limpa depois.

- [ ] **Passo 4: a guarda do diff**

```bash
git diff --name-only fc16464 -- . ':!docs'
```

Esperado: só os 4 arquivos do mapa:

```text
lib/bonus/publicar-estado.ts
lib/bonus/publicar-textos.ts
testes-integracao/bonus-publicar-repositorio.integracao.ts
tests/bonus-publicar-estado.test.ts
```

- [ ] **Passo 5: avisar o auditor**, com o hash e os números. O push e o PR só com o OK do Eduardo.

---

### FASE 4 — A prova real, no preview, com o Eduardo

Cada escrita em produção tem o OK do Eduardo, pela caixa, e a auditoria lê o banco antes e depois (avisada
com a hora). O preview usa o banco e o bucket de produção. **Sem post real e sem linha forjada na fila. Sem
migração.** A nova tentativa fica coberta pelos testes; a prova mostra que o caminho comum não mudou.

- [ ] **Passo 1: a linha de base da auditoria**, só de leitura.

- [ ] **Passo 2: o push da branch e o preview, com o OK do Eduardo**

Empurre só a branch (`git push origin refs/heads/publicando-na-retentativa:refs/heads/publicando-na-retentativa`).
No log do build do preview, confira o commit e "MIGRAÇÃO PULADA".

- [ ] **Passo 3: a prova, com o Eduardo na tela** (os passos da spec, "A prova real")

1. No gerador, um carrossel escrito à mão, com 1 slide em "Só texto", agendado para daqui a 2 dias
   (grava). A página do carrossel mostra "Agendado para…", como hoje.
2. Cancelar no calendário (grava).

No fim, o carrossel de prova sai do banco por um script que a auditoria lê e ensaia em só leitura antes de
rodar. Depois: o corpo do PR e a mensagem do merge, conferidos pela auditoria, e o PR com o OK do Eduardo.
**O merge é do Eduardo**, com a mensagem colada nos dois campos (o título e a descrição), e o build do merge
diz "Nada a aplicar: as 19 migrações".

---

## Apêndice A — as provas de mutação

O script roda da raiz do repositório, com a `DATABASE_URL_TESTES` do container (ele recusa sem ela). Cada
mutação tira uma proteção, roda o teste que a cobre e confere que o caso nomeado caiu; cada arquivo volta
byte a byte.

```js
// Provas de mutação do achado 100 (o post em nova tentativa aparece como "publicando" no gerador). Cada
// mutação tira uma proteção e roda o teste que a cobre; o caso nomeado tem de cair. Cada arquivo volta byte
// a byte.
// Uso, da raiz do repositório: DATABASE_URL_TESTES=<container> node mutar-retentativa.mjs [filtro]
// As mutações INTEG rodam a suíte de integração, que sem DATABASE_URL_TESTES cai na DATABASE_URL, a da
// PRODUÇÃO (achado 68): sem a variável, o script recusa antes de mutar, e uma rodada INTEG que não imprime
// "ALVO: banco de TESTE" conta como ✗.
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const PURA = (f) => `npx vitest run ${f}`;
const INTEG = (f) => `npx vitest run --config vitest.integracao.config.ts ${f}`;

const ESTADO = "lib/bonus/publicar-estado.ts";
const TEXTOS = "lib/bonus/publicar-textos.ts";

const T_ESTADO = PURA("tests/bonus-publicar-estado.test.ts");
const T_REPO = INTEG("testes-integracao/bonus-publicar-repositorio.integracao.ts");

const SEM_O_ERROR = [
  `if (noFuturo && linha.error === null) return { tipo: "agendado"`,
  `if (noFuturo) return { tipo: "agendado"`,
];
const SEM_A_COTA = [`if (noFuturo && linha.error?.startsWith(MOTIVO_DA_COTA)) {`, `if (false) {`];

const MUTACOES = [
  // FASE 1: o estado
  { nome: "1: o error não conta, e a nova tentativa volta a ser agendado (o achado 100)", arq: ESTADO,
    de: SEM_O_ERROR[0], para: SEM_O_ERROR[1],
    cmd: T_ESTADO, caso: "pendente com o motivo de uma tentativa, e a hora no futuro, é publicando" },
  { nome: "1: o error não conta (o repositório)", arq: ESTADO,
    de: SEM_O_ERROR[0], para: SEM_O_ERROR[1],
    cmd: T_REPO, caso: "o pendente no futuro: sem motivo é agendado; com motivo é publicando; na cota, com a espera" },
  { nome: "1: a cota perde a espera", arq: ESTADO,
    de: SEM_A_COTA[0], para: SEM_A_COTA[1],
    cmd: T_ESTADO, caso: "pendente esperando a cota da conta é publicando, com a espera e a hora da nova tentativa" },
  { nome: "1: a cota perde a espera (o repositório)", arq: ESTADO,
    de: SEM_A_COTA[0], para: SEM_A_COTA[1],
    cmd: T_REPO, caso: "o pendente no futuro: sem motivo é agendado; com motivo é publicando; na cota, com a espera" },
  { nome: "1: a espera da cota vale com a hora vencida", arq: ESTADO,
    de: SEM_A_COTA[0], para: `if (linha.error?.startsWith(MOTIVO_DA_COTA)) {`,
    cmd: T_ESTADO, caso: "a cota com a hora vencida é publicando, sem espera" },
  { nome: "1: o começo do motivo da cota deixa de ser o do dreno (a guarda)", arq: ESTADO,
    de: `export const MOTIVO_DA_COTA = "a cota de publicacoes da conta acabou";`,
    para: `export const MOTIVO_DA_COTA = "a cota de publicações da conta acabou";`,
    cmd: T_ESTADO, caso: "o error da cota em lib/queue-drain.ts começa por MOTIVO_DA_COTA" },
  // FASE 2: as frases
  { nome: "2: a frase da cota volta à de sempre", arq: TEXTOS,
    de: "      return e.espera\n        ? `Publicando assim que",
    para: "      return false\n        ? `Publicando assim que",
    cmd: T_ESTADO, caso: "o publicando na espera da cota diz o motivo e a hora da nova tentativa" },
  { nome: "2: a hora da nova tentativa some da frase", arq: TEXTOS,
    de: "Nova tentativa por volta de ${fmtDate(e.espera.ate)} (horário de Brasília).",
    para: "Nova tentativa em breve.",
    cmd: T_ESTADO, caso: "o publicando na espera da cota diz o motivo e a hora da nova tentativa" },
  { nome: "2: a trava da cota volta a esconder o calendário", arq: TEXTOS,
    de: "      return e.espera\n        ? \"Esperando o Instagram liberar",
    para: "      return false\n        ? \"Esperando o Instagram liberar",
    cmd: T_ESTADO, caso: "a trava na espera da cota aponta o calendário" },
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
  const fim = (t) => (crlf ? t.replace(/\n/g, "\r\n") : t);
  const n = texto.split(fim(m.de)).length - 1;
  if (n !== 1) {
    console.log(`✗ ${m.nome}: o trecho aparece ${n} vez(es)`);
    ruins++;
    continue;
  }
  writeFileSync(m.arq, texto.replace(fim(m.de), () => fim(m.para)), "utf8");
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
  // As cores do vitest pintam o " > " das linhas FAIL num terminal com cor (nota da auditoria em 13/10): a
  // saída perde os códigos de cor antes de procurar o caso.
  saida = saida.replace(/\x1b\[[0-9;]*m/g, "");
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
