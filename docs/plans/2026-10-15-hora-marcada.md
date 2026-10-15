# A hora marcada da publicação — Plano de implementação (achados 91, 99, 101 e 102)

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: `superpowers:subagent-driven-development`
> (recomendada) ou `superpowers:executing-plans`, fase por fase. Os passos usam caixa de
> seleção (`- [ ]`) para acompanhar.

**Objetivo:** a publicação agendada grava a hora marcada como veio, e não uma duração medida pelo relógio da
aplicação; o post que já vale pelo banco sai na hora, no compor, no gerador e no remarcar; um erro no tique
depois do insert não desfaz o que entrou; e todo tique respeita o horizonte de um dia.

**Arquitetura:** a decisão do tique é pura (`atrasoDoTiqueDaPublicacao(falta, horizonte)`, em
`lib/publicacao.ts`) e recebe os segundos que o banco mediu. `enqueuePublicacao` (`lib/engine.ts`) ganha um
INSERT próprio, que grava `greatest(now(), coalesce($4::timestamptz, now()))` e devolve, no mesmo statement,
`ja_vale` e `falta`; o tique sai dentro de um `try`. O `enqueue` das mensagens não muda o INSERT, e uma guarda
pura lê o arquivo para as duas regras não se misturarem; ele só ganha o teto no tique. O compor, o gerador e o
remarcar drenam o que já vale; o remarcar grava `greatest(now(), $3)` com o mesmo `returning`. Sem migração.

**Stack:** a do projeto, no Next.js 16.3.8: App Router, Server Actions, React 19, Postgres (postgres.js via
`lib/db.ts`), Vitest (três suítes), QStash.

**Spec:** `docs/specs/2026-10-15-hora-marcada.md` (commits `5df6053` e `ab4e442`; revisada e liberada pela
auditoria sem achado novo, com cinco ajustes de texto; lida pelo Eduardo em 15/10; `1f9de7f` registra o que o
ensaio acertou, itens 2 e 3 abaixo). Leia antes de começar: este plano não repete o porquê das regras, só
como construí-las.

**Ensaio do plano (15/10):** o código deste plano foi escrito e testado fase a fase numa cópia isolada do
repositório (`git worktree`, branch local `ensaio-hora`, sem push, saída de `ab4e442`), e todo bloco de código
abaixo foi tirado do git dessa cópia por um gerador, sem cópia à mão. Os números do ensaio:
- lint e `tsc` limpos em cada fase; no fim, 117 arquivos e 3 212 casos puros (116 arquivos e 3 209 na base) e
  23 arquivos e 203 de tela (iguais à base: nenhuma tela muda);
- `next build --webpack` limpo, e o `AGENTS.md` intacto (item 8 abaixo);
- integração no container: 45 arquivos, 505 passaram e 8 pularam (na base, 45 arquivos, 493 passaram e 8 pularam), com o `.env.local` vazio na cópia
  (item 8 abaixo);
- cada fase foi vista falhar antes do código e passar depois, na ordem deste plano, com os números de cada
  uma no passo dela;
- as 23 provas de mutação do Apêndice A derrubaram, cada uma, o caso esperado;
- o plano, aplicado do zero numa cópia limpa, dá os 16 arquivos iguais ao fim do ensaio, byte a byte;
- a guarda do diff (FASE 5, passo 5) mostrou só os arquivos do mapa abaixo, e nenhum `agendarTique` sobrou.

O ensaio achou estas coisas, já resolvidas neste plano:
1. **O id de bloco de uma automação tem a forma `b_` e seis ou mais letras e números** (`FORMA_DO_ID`,
   `lib/steps.ts:1299`). O primeiro rascunho do caso das mensagens com espera usava `d_…`, e a caminhada
   parava no primeiro bloco, sem seguir a seta: o caso caía por isso, e não pelo tique. O editor só gera ids
   nessa forma; o caso usa `b_agora02`, `b_doisdia` e `b_espera2`, no molde de "a espera do editor"
   (`gatilho-entrega.integracao.ts`), que já mede essa caminhada.
2. **O remarcar só aceita minutos inteiros** (o campo `datetime-local`): a integração não alcança o
   "remarcar para daqui a 10 s" da tabela de testes da spec (T8). O buraco dos 15 s fica provado pela função
   pura (FASE 1, o caso "perto arma"), e no remarcar a integração prova o minuto corrente (que drena) e o
   erro do tique.
3. **O retorno de `publicarNaFila` ganha `jaVale`, e um teste do criador de imagem o compara inteiro**
   (`testes-integracao/bonus-imagem-processo.integracao.ts:293`). Ele entra na FASE 3, com `jaVale: false`
   (o agendado para amanhã).
4. **Dois casos do gerador dependem só do motor e ficam na FASE 2:** a hora exata do agendado (a tolerância
   de 120 s vira igualdade) e o erro do tique que não apaga a mídia (achado 101).
5. **O tique-do-rodape monta a hora pelo relógio do banco** (`daquiPeloBanco`, e `daquiAHoras` passa a ser
   assíncrona): com a hora gravada exata, um caso montado pelo relógio da máquina dependeria de a máquina
   estar em dia com o container.
6. **O remarcar também tem `greatest(now(), …)`**, fora de `lib/engine.ts`, e por isso fora da conta da
   guarda. Quem o protege é o caso do minuto corrente (`not_before` maior que o minuto) e a mutação "4: o
   remarcar grava a hora vencida".
7. **A mutação da duração de antes tem duas trocas**: o SQL (`now() + make_interval(…)`) e o parâmetro
   (`Math.round` contra `Date.now()`). Só uma delas não devolve o defeito do achado 91 inteiro; o script do
   Apêndice A aceita várias trocas por mutação.
8. **A cópia de ensaio derruba `registro-de-migracoes`** (o script recusa `--a-mao` sem o `.env.local`; com
   um `.env.local` VAZIO os casos passam), e o `next build` do `verify` (Turbopack) não roda na cópia, que
   tem o `node_modules` por junção: lá rodou `next build --webpack`. Na árvore do projeto os dois rodam
   (FASE 5).
9. **Uma integração de cada vez.** Duas rodadas ao mesmo tempo no mesmo container derrubam o schema uma da
   outra.

**Fora deste plano, anotado:** o achado 100 (o post em retentativa aparece como "Agendado para" no gerador)
vai num PR do gerador; o achado 103 (um "Esperar" antes de `pedir_follow` ou de `pedir_dado` é descartado)
fica anotado; o `sent_at = new Date()` do dreno continua no relógio da aplicação.

## Restrições globais

Valem para todas as fases, sem precisar repetir em cada uma.

- **Branch:** `hora-marcada`, saída da `main` em `af714d3`, **sem upstream** (o `git worktree add -b` sobre
  `origin/main` liga a branch à `main`: desligue com `git branch --unset-upstream hora-marcada` antes do
  primeiro commit). Nunca commitar nem empurrar na `main`: ela não tem proteção e um push dispara deploy de
  produção. Conferir `git branch --show-current` antes de cada commit, e `git ls-remote origin
  refs/heads/main` no começo de cada fase.
- **`git add` com caminho explícito.** Nunca `-A` nem `.`: mais de uma sessão usa esta árvore.
- **Commit no estilo do Vinícius:** uma frase em português dizendo o efeito, sem prefixo, com o porquê no
  corpo. Sem `Co-Authored-By` e sem rodapé de IA. Autor: Eduardo Kobal
  <162614913+Eduardokobal@users.noreply.github.com>. As mensagens de cada fase estão no passo dela.
- **Antes de cada commit**, varrer os arquivos de TEXTO tocados com
  `node "$SCRATCH/varrer-texto.mjs" <arquivos>`, em que `$SCRATCH` é o scratchpad da sessão. Se o
  scratchpad não existir mais, recrie o script a partir do apêndice A do plano da Etapa 1
  (`docs/plans/2026-09-29-gerador-de-bonus.md`).
- **O commit é um comando à parte**, depois de ler a saída dos testes: nunca encadeado com `&&` atrás
  deles.
- **Escape de barra-u:** a ferramenta de escrita grava o caractere no lugar do escape. Os blocos deste
  plano não têm escape de barra-u; se algum aparecer, a varredura acusa.
- **Fim de linha:** com `core.autocrlf=true`, a cópia de trabalho dos arquivos que já existem está em CRLF.
  Os diffs deste plano estão em LF: converta antes os arquivos que a fase toca (`node "$SCRATCH/para-lf.mjs"
  <arquivo>`; o `git diff` continua vazio, porque o índice é LF) e aplique com `git apply`, ou aplique à mão.
  Se a varredura acusar fim de linha misturado, converta a cópia inteira para LF.
- **Os arquivos desta etapa são os do mapa abaixo**, e mais nenhum. O motor era do Vinícius, que saiu da
  empresa em 15/10; por decisão do Eduardo, ele é mexido no jeito do Vinícius: o comentário diz o porquê e a
  medição, a regra vira função pura com teste, cada proteção tem a mutação que a derruba. **Nenhuma tela, nenhuma
  migração, nenhum `scripts` e nenhum `package` muda** (a FASE 5 confere).
- **Sem migração.** O build do merge tem de dizer "Nada a aplicar: as 19 migrações".
- **Sufixo de teste é o que decide se ele roda:** `tests/**/*.test.ts` (puro, entra no `verify`),
  `testes-integracao/**/*.integracao.ts` (banco, fora do `verify`), `testes-dom/**/*.dom.tsx` (tela, entra no
  `verify`).
- **Uma rodada de integração de cada vez** (item 9 do ensaio).
- **A suíte de integração só roda com `DATABASE_URL_TESTES`** apontando para o container
  (`127.0.0.1:5434`, `npm run banco:teste`). Toda rodada tem de imprimir `[rede-global] ALVO: banco de
  TESTE`. Se imprimir outra coisa, pare. Nunca rode com a variável vazia: ela cai na `DATABASE_URL`, que é
  **produção**.
- **`next dev` e `next build` sem as variáveis de agente.** Rode com `env -u CLAUDECODE -u AI_AGENT ...` e
  confira `git diff AGENTS.md` depois: ele não muda.
- **Segredo** nunca vai para código, log, mensagem, commit ou saída de terminal.
- **Escrita em produção só com o OK do Eduardo**, e o script que grava vai antes à auditoria (achado 77). O
  preview usa o banco e o bucket de produção: lá, compor, agendar, remarcar, cancelar e apagar gravam em
  produção. Avisar o auditor com a hora antes de cada gravação.
- **Ao fechar cada fase**, avisar o auditor (sessão `metodochat-20` em 15/10; conferir o nome no
  `ListAgents`, porque ele muda a cada reinício) com o hash e o que conferir. Não esperar a resposta para
  seguir.

## Mapa dos arquivos

| arquivo | responsabilidade | fase |
|---|---|---|
| `lib/publicacao.ts` | `atrasoDoTiqueDaPublicacao` (nova); o comentário de `momentoDaPublicacao`; a saída de `atrasoDoTiqueDoRemarcar` | 1, 2 e 4 |
| `lib/engine.ts` | o INSERT próprio de `enqueuePublicacao`, `ResultadoDaPublicacao`, o tique com `try`; o teto e a saída do `agendarTique` no `enqueue` | 2 |
| `app/publicar/actions.ts` | o compor lê `r.entrou` (FASE 2) e drena o que já vale, com a frase do "agora" (FASE 3) | 2 e 3 |
| `lib/bonus/publicar-processo.ts`, `app/bonus/publicar-actions.ts` | o gerador lê o retorno novo (FASE 2), drena o que já vale e devolve `jaVale` para a frase (FASE 3) | 2 e 3 |
| `app/publicar/post/actions.ts` | o remarcar grava `greatest(now(), $3)`, drena o que já vale e arma o tique pela distância do banco, com `try` | 4 |
| `lib/qstash.ts` | o comentário dos cinco lugares que pedem tique | 5 |
| `tests/publicacao.test.ts`, `tests/hora-marcada-guarda.test.ts` (novo), `tests/bonus-publicar-paginas.test.ts` | a função pura, a guarda que lê o motor, a frase do gerador | 1 a 4 |
| `testes-integracao/tique-do-rodape.integracao.ts`, `publicacao.integracao.ts`, `bonus-publicar-processo.integracao.ts`, `bonus-imagem-processo.integracao.ts`, `publicar-fala.integracao.ts`, `agendados.integracao.ts` | a hora exata, o relógio adiantado, o já vale, a borda de um dia, os 15 s, o erro do tique, a mensagem de dois dias, o minuto corrente no compor, no gerador e no remarcar | 2 a 4 |

---

## A HORA MARCADA

### FASE 0 — Começar da main certa

- [ ] **Passo 1: conferir a main e a branch**

```bash
git ls-remote origin refs/heads/main
git switch hora-marcada
git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null || echo "sem upstream"
git log --oneline -4
node -e 'console.log(require("./node_modules/next/package.json").version)'
```

Esperado: a `main` em `af714d3` (ou depois dele); "sem upstream"; a branch com os commits da spec e este
plano sobre `af714d3`; o `node_modules` na 16.3.8. Se a `main` andou, rebaseie a branch nela antes de seguir
(`git fetch origin main && git rebase origin/main`), e rode `npm ci` se o lock mudou.

- [ ] **Passo 2: a linha de base**

```bash
npm test
npm run test:dom
npm run banco:teste
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npm run test:integracao
```

Esperado: 116 arquivos e 3 209 casos puros; 23 arquivos e 203 de tela; `[rede-global] ALVO: banco de TESTE`,
45 arquivos, 493 passaram e 8 pularam.

---

### FASE 1 — A decisão pura do tique

**Arquivos:**
- Modificar: `lib/publicacao.ts` (a função nova, depois de `atrasoDoTiqueDoRemarcar`)
- Testar: `tests/publicacao.test.ts`

**Interfaces:**
- Produz: `atrasoDoTiqueDaPublicacao(falta: number, horizonteEmSegundos: number): number | null` —
  `null` para `falta <= 0`, não finita ou acima do horizonte; senão `Math.min(falta + 5, horizonte)`.

- [ ] **Passo 1: o teste**

Em `tests/publicacao.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/publicacao.test.ts b/tests/publicacao.test.ts
index 24afa93..c74c480 100644
--- a/tests/publicacao.test.ts
+++ b/tests/publicacao.test.ts
@@ -37,6 +37,7 @@ import {
   recusaDaQuantidade,
   moverNaOrdem,
   rotuloDoEnvio,
+  atrasoDoTiqueDaPublicacao,
   atrasoDoTiqueDoRemarcar,
   avisoDoAtrasoNaLista,
   fraseSobreAMidia,
@@ -1934,6 +1935,51 @@ describe("atrasoDoTiqueDoRemarcar", () => {
   });
 });
 
+// =============================================================================
+// O TIQUE DA HORA MARCADA (15/10/2026, spec docs/specs/2026-10-15-hora-marcada.md)
+//
+// A distancia vem do BANCO, medida no mesmo statement que gravou a hora: nenhum
+// relogio da aplicacao entra na conta. E o piso de 15 s do `enqueue` nao vale:
+// o "agora" nascia com atraso zero e era drenado na hora, mas o post marcado
+// para daqui a 10 s ficava sem tique e sem dreno (achado 99).
+// =============================================================================
+describe("atrasoDoTiqueDaPublicacao", () => {
+  // O QUE JA VALE NAO ARMA: quem enfileirou drena na hora, e um tique para "ja"
+  // acordaria uma drenagem depois da que ja levou o post.
+  it("o que ja vale NAO arma: quem drena e quem enfileirou", () => {
+    expect(atrasoDoTiqueDaPublicacao(0, UM_DIA)).toBe(null);
+    expect(atrasoDoTiqueDaPublicacao(-30, UM_DIA)).toBe(null);
+  });
+
+  // O BURACO DO ACHADO 99: de 1 a 15 s o `enqueue` nao armava, e so o "agora"
+  // drenava. O post ficava parado ate a proxima drenagem de outra coisa.
+  it("perto arma, sem o piso de 15 s (achado 99)", () => {
+    expect(atrasoDoTiqueDaPublicacao(1, UM_DIA)).toBe(6);
+    expect(atrasoDoTiqueDaPublicacao(10, UM_DIA)).toBe(15);
+    expect(atrasoDoTiqueDaPublicacao(15, UM_DIA)).toBe(20);
+  });
+
+  it("duas horas a frente arma o tique, com os cinco segundos de folga", () => {
+    expect(atrasoDoTiqueDaPublicacao(7200, UM_DIA)).toBe(7205);
+  });
+
+  // A BORDA EXATA, com o teto aplicado DEPOIS da folga: o `enqueue` entregava
+  // 86405 s aqui, cinco segundos alem do horizonte (achado 102).
+  it("na borda do horizonte o atraso NAO passa de um dia (achado 102)", () => {
+    expect(atrasoDoTiqueDaPublicacao(UM_DIA, UM_DIA)).toBe(UM_DIA);
+  });
+
+  it("alem do horizonte NAO arma: quem arma e o cron diario", () => {
+    expect(atrasoDoTiqueDaPublicacao(UM_DIA + 1, UM_DIA)).toBe(null);
+    expect(atrasoDoTiqueDaPublicacao(30 * UM_DIA, UM_DIA)).toBe(null);
+  });
+
+  it("numero ilegivel NAO arma, e nao vira NaN entregue ao QStash", () => {
+    expect(atrasoDoTiqueDaPublicacao(Number.NaN, UM_DIA)).toBe(null);
+    expect(atrasoDoTiqueDaPublicacao(Number.POSITIVE_INFINITY, UM_DIA)).toBe(null);
+  });
+});
+
 describe("textoDoDesfecho", () => {
   // A FRASE DE "tarde demais" TEM DE DIZER QUE O POST SAIU, e nao so que o
   // cancelamento falhou: sao fatos diferentes, e o segundo sozinho deixa o dono
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/publicacao.test.ts -t "atrasoDoTiqueDaPublicacao"
```

Esperado: os 6 casos de `atrasoDoTiqueDaPublicacao` caem (`atrasoDoTiqueDaPublicacao is not a function`), e os
outros 269 do arquivo ficam pulados pelo `-t`.

- [ ] **Passo 3: o código**

Em `lib/publicacao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/publicacao.ts b/lib/publicacao.ts
index bf66efd..4851bcc 100644
--- a/lib/publicacao.ts
+++ b/lib/publicacao.ts
@@ -1817,6 +1817,39 @@ export function atrasoDoTiqueDoRemarcar(
   return Math.min(distancia + 5, horizonteEmSegundos);
 }
 
+/**
+ * O ATRASO, EM SEGUNDOS, DO TIQUE DE UMA PUBLICAÇÃO GRAVADA PELA HORA MARCADA —
+ * ou `null` quando não há tique a armar (spec `docs/specs/2026-10-15-hora-marcada.md`).
+ *
+ * `falta` SÃO OS SEGUNDOS QUE O BANCO MEDIU entre a hora gravada e o `now()`
+ * dele, no mesmo statement que a gravou. Nenhum relógio da aplicação entra na
+ * conta: foi um `Date.now()` convertendo a hora marcada em duração, arredondada,
+ * que gravou as 10:00 como 12:59:59.670Z (achado 91, medido em 3 de 7
+ * agendamentos reais).
+ *
+ *   `<= 0`        não arma: o item já vale, e quem drena é quem enfileirou.
+ *   `> horizonte` não arma: além de um dia, quem arma é o cron diário
+ *                 (`armarTiquesDoDia`, lib/queue-drain.ts).
+ *   o resto       `falta + 5`, com o teto aplicado DEPOIS da folga, pela lição
+ *                 de `armarTiquesDoDia` e do rodapé do dreno: na borda exata,
+ *                 `falta + 5` passaria cinco segundos do horizonte (achado 102).
+ *
+ * O PISO DE 15 s DO `enqueue` NÃO VALE AQUI (achado 99). Ele existe porque a
+ * mensagem com atraso zero sai na drenagem que já está a caminho. A publicação
+ * marcada para daqui a 10 s não tem drenagem a caminho: sem tique, ela ficava
+ * parada até a próxima drenagem de outra coisa — um webhook, ou o cron do dia
+ * seguinte.
+ *
+ * O `horizonteEmSegundos` É PARÂMETRO pelo mesmo motivo de
+ * `atrasoDoTiqueDoRemarcar`: a constante mora em `lib/qstash.ts`, que é
+ * `server-only`, e este arquivo é lido no NAVEGADOR.
+ */
+export function atrasoDoTiqueDaPublicacao(falta: number, horizonteEmSegundos: number): number | null {
+  if (!Number.isFinite(falta) || falta <= 0) return null;
+  if (falta > horizonteEmSegundos) return null;
+  return Math.min(falta + 5, horizonteEmSegundos);
+}
+
 /**
  * A frase de cada desfecho, por ação.
  *
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx eslint lib/publicacao.ts tests/publicacao.test.ts
npx vitest run tests/publicacao.test.ts
```

Esperado: `tsc` e lint limpos; os 275 do arquivo passam.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/publicacao.ts tests/publicacao.test.ts
test "$(git branch --show-current)" = "hora-marcada"
git add lib/publicacao.ts tests/publicacao.test.ts
```

```bash
git commit -F - <<'MSG'
O tique da publicação vira função pura, pela distância que o banco mediu

A decisão de armar o tique de uma publicação passa a receber os segundos
que faltam, medidos pelo banco no mesmo statement que grava a hora, e
nenhum relógio da aplicação entra na conta. O piso de 15 segundos do
enqueue não vale aqui: o post marcado para daqui a 10 segundos ficava sem
tique e sem dreno (achado 99). Na borda do horizonte, o teto vem depois
da folga, como no rodapé do dreno (achado 102).
MSG
```

---

### FASE 2 — O motor grava a hora marcada

**Arquivos:**
- Criar: `tests/hora-marcada-guarda.test.ts`
- Modificar: `lib/engine.ts`, `lib/publicacao.ts` (o comentário de `momentoDaPublicacao`),
  `app/publicar/actions.ts` e `lib/bonus/publicar-processo.ts` (o mínimo: ler `.entrou`)
- Testar: `testes-integracao/tique-do-rodape.integracao.ts`, `testes-integracao/publicacao.integracao.ts`,
  `testes-integracao/bonus-publicar-processo.integracao.ts`

**Interfaces:**
- Consome: `atrasoDoTiqueDaPublicacao` (FASE 1); `HORIZONTE_DO_TIQUE_EM_SEGUNDOS` e `scheduleTick`
  (`lib/qstash.ts`); `getConfig` (`lib/db.ts`).
- Produz: `type ResultadoDaPublicacao = { entrou: false } | { entrou: true; jaVale: boolean; falta: number }`
  e `enqueuePublicacao(accountId, pedido, quando: Date | null): Promise<ResultadoDaPublicacao>`, em
  `lib/engine.ts`. O `enqueue` perde o parâmetro `agendarTique`.

- [ ] **Passo 1: os testes**

Crie `tests/hora-marcada-guarda.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// A FRONTEIRA DA HORA MARCADA (spec docs/specs/2026-10-15-hora-marcada.md), lida no código.
//
// A publicação grava a hora marcada como veio, e as mensagens continuam com o atraso em segundos,
// somado pelo banco (o contrato de `enqueue`, do commit 6cd8d6d). As duas regras moram no mesmo
// arquivo, e a única coisa que as separa é cada uma ter o seu INSERT. Uma regra nova que vazasse
// para as mensagens apagaria a espera do editor de automações: "esperar 5 minutos" viraria "agora".
//
// ESTA GUARDA É PURA DE PROPÓSITO. O `npm run verify` não roda a integração, e o caso que mede a
// espera das mensagens no banco (`gatilho-entrega.integracao.ts`) só roda com o container. Lida
// aqui, a fronteira cai no portão de todo commit.

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const MOTOR = readFileSync(`${RAIZ}/lib/engine.ts`, "utf8").replace(/\r\n/g, "\n");

/** O corpo de uma função exportada do motor: da assinatura até a primeira chave que fecha na coluna 0. */
function corpoDe(nome: string): string {
  const inicio = MOTOR.indexOf(`export async function ${nome}(`);
  if (inicio < 0) throw new Error(`${nome} não está em lib/engine.ts`);
  const fim = MOTOR.indexOf("\n}\n", inicio);
  return MOTOR.slice(inicio, fim + 2);
}

describe("a fronteira entre a hora marcada e o atraso das mensagens", () => {
  it("o INSERT das mensagens continua somando o atraso no relógio do banco", () => {
    expect(MOTOR).toContain(
      "values ($1, $2, $3, $4, $5, $6, $7, now() + make_interval(secs => $8::int))"
    );
  });

  it("só a publicação grava a hora absoluta, e uma vez só no motor", () => {
    expect(MOTOR.split("greatest(now()").length - 1).toBe(1);
    expect(corpoDe("enqueuePublicacao")).toContain(
      "greatest(now(), coalesce($4::timestamptz, now()))"
    );
  });
});
```

Em `testes-integracao/tique-do-rodape.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/tique-do-rodape.integracao.ts b/testes-integracao/tique-do-rodape.integracao.ts
index 8e474c5..47d5eb8 100644
--- a/testes-integracao/tique-do-rodape.integracao.ts
+++ b/testes-integracao/tique-do-rodape.integracao.ts
@@ -64,7 +64,7 @@ import {
   type ServerResponse,
 } from "node:http";
 import type { AddressInfo } from "node:net";
-import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
+import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
 import { bancoDescartavel } from "./harness";
 import { comoNumaRequisicao } from "./semear-requisicao";
 
@@ -209,20 +209,37 @@ beforeEach(async () => {
 /**
  * Semeia um post agendado e ZERA o contador.
  *
- * O `enqueue` publica o tique dele quando a hora cabe no horizonte
- * (`agendarTique`, lib/engine.ts), e esse tique é do CAMINHO DE ENTRADA — não é
- * o do rodapé. Contá-lo junto misturaria dois mecanismos num número só.
+ * `enqueuePublicacao` publica o tique dele quando a hora cabe no horizonte
+ * (`atrasoDoTiqueDaPublicacao`, lib/publicacao.ts), e esse tique é do CAMINHO DE
+ * ENTRADA — não é o do rodapé. Contá-lo junto misturaria dois mecanismos num
+ * número só.
  */
 async function agendarPostDaqui(segundos: number) {
-  const entrou = await engine.enqueuePublicacao(
+  const r = await engine.enqueuePublicacao(
     CONTA,
     { forma: "imagem", caminhos: [`${CONTA}/post-${segundos}s.jpg`] },
-    new Date(Date.now() + segundos * 1000)
+    await daquiPeloBanco(segundos)
   );
-  expect(entrou).toBe(true);
+  expect(r.entrou).toBe(true);
   publicados = [];
 }
 
+/**
+ * Um instante daqui a N segundos PELO RELÓGIO DO BANCO, que é o que compara a
+ * hora gravada (spec `docs/specs/2026-10-15-hora-marcada.md`). Montado pelo
+ * relógio da máquina, o caso dependeria de a máquina estar em dia com o
+ * container — e a hora gravada passou a ser exatamente a que entra aqui.
+ */
+async function daquiPeloBanco(segundos: number): Promise<Date> {
+  const [linha] = (await banco
+    .db()
+    .sql()
+    .query(`select now() + make_interval(secs => $1::float8) as instante`, [segundos])) as {
+    instante: Date;
+  }[];
+  return linha.instante;
+}
+
 // ---------------------------------------------------------------------------
 // O DESFECHO DE UM SERVER ACTION — a mesma leitura do `digest` de
 // `agendados.integracao.ts` e de `publicar-fala.integracao.ts`, copiada e nao
@@ -273,9 +290,11 @@ async function idDoUnicoItem(): Promise<string> {
 }
 
 /** Um instante daqui a N horas, truncado ao minuto — que e o que o
- *  `<input type="datetime-local">` manda. */
-function daquiAHoras(horas: number): number {
-  return Math.floor((Date.now() + horas * 60 * 60 * 1000) / 60000) * 60000;
+ *  `<input type="datetime-local">` manda. A hora de partida e a do banco, pelo
+ *  mesmo motivo de `daquiPeloBanco`. */
+async function daquiAHoras(horas: number): Promise<number> {
+  const agora = (await daquiPeloBanco(0)).getTime();
+  return Math.floor((agora + horas * 60 * 60 * 1000) / 60000) * 60000;
 }
 
 // =============================================================================
@@ -284,8 +303,8 @@ function daquiAHoras(horas: number): number {
 //
 // Ate 09/09/2026 remarcar nao armava tique NENHUM, e o comentario que
 // justificava a ausencia lia errado o codigo que citava: ele dizia que
-// `enqueuePublicacao` passa `agendarTique: false` de proposito. Ela passa
-// `agendarTique: atraso <= HORIZONTE` (lib/engine.ts).
+// `enqueuePublicacao` nao armava tique de proposito. Ela armava sempre que a
+// hora cabia no horizonte (lib/engine.ts).
 //
 // E O CRON DIARIO NAO COBRIA O BURACO. `armarTiquesDoDia` so e honesta para
 // `not_before` escrito ANTES da passagem dela — e remarcar move a hora para
@@ -304,7 +323,7 @@ describe("o tique da hora nova, e o par de controle que o mede", () => {
     await engine.enqueuePublicacao(
       CONTA,
       { forma: "imagem", caminhos: [`${CONTA}/compor-daqui-a-duas-horas.jpg`] },
-      new Date(Date.now() + 2 * 60 * 60 * 1000)
+      await daquiPeloBanco(2 * 60 * 60)
     );
     expect(publicados.length).toBe(1);
 
@@ -316,13 +335,13 @@ describe("o tique da hora nova, e o par de controle que o mede", () => {
     await engine.enqueuePublicacao(
       CONTA,
       { forma: "imagem", caminhos: [`${CONTA}/remarcado-de-um-mes-para-duas-horas.jpg`] },
-      new Date(Date.now() + 30 * UM_DIA_EM_SEGUNDOS * 1000)
+      await daquiPeloBanco(30 * UM_DIA_EM_SEGUNDOS)
     );
     expect(publicados.length).toBe(0);
     const id = await idDoUnicoItem();
     publicados = [];
 
-    const aviso = await avisoDe(acoes.remarcarPublicacao, pedidoDeRemarcar(id, daquiAHoras(2)));
+    const aviso = await avisoDe(acoes.remarcarPublicacao, pedidoDeRemarcar(id, await daquiAHoras(2)));
     expect(aviso.tom).toBe("ok");
     expect(aviso.texto).toContain("Post remarcado");
 
@@ -345,14 +364,14 @@ describe("o tique da hora nova, e o par de controle que o mede", () => {
     await engine.enqueuePublicacao(
       CONTA,
       { forma: "imagem", caminhos: [`${CONTA}/remarcado-para-o-mes-que-vem.jpg`] },
-      new Date(Date.now() + 2 * 60 * 60 * 1000)
+      await daquiPeloBanco(2 * 60 * 60)
     );
     const id = await idDoUnicoItem();
     publicados = [];
 
     const aviso = await avisoDe(
       acoes.remarcarPublicacao,
-      pedidoDeRemarcar(id, daquiAHoras(30 * 24))
+      pedidoDeRemarcar(id, await daquiAHoras(30 * 24))
     );
     expect(aviso.tom).toBe("ok");
     expect(aviso.texto).toContain("Post remarcado");
@@ -367,13 +386,13 @@ describe("o tique da hora nova, e o par de controle que o mede", () => {
     await engine.enqueuePublicacao(
       CONTA,
       { forma: "imagem", caminhos: [`${CONTA}/nao-vai-ser-remarcado.jpg`] },
-      new Date(Date.now() + 2 * 60 * 60 * 1000)
+      await daquiPeloBanco(2 * 60 * 60)
     );
     await banco.db().sql().query(`update queue set kind = 'dm_manual'`);
     const id = await idDoUnicoItem();
     publicados = [];
 
-    const aviso = await avisoDe(acoes.remarcarPublicacao, pedidoDeRemarcar(id, daquiAHoras(2)));
+    const aviso = await avisoDe(acoes.remarcarPublicacao, pedidoDeRemarcar(id, await daquiAHoras(2)));
     expect(aviso.tom).toBe("erro");
     expect(aviso.texto).toContain("Não achei este post agendado nesta conta");
 
@@ -448,7 +467,7 @@ describe("a varredura do cron e o horizonte que ela nunca pode passar", () => {
       // os cinco segundos de folga o levariam a 86405. Uma folga de 30 s abaixo
       // da borda NÃO serve de caso: ela deixa o plantio sobreviver, e isso foi
       // medido antes de este número virar o que é.
-      new Date(Date.now() + UM_DIA_EM_SEGUNDOS * 1000)
+      await daquiPeloBanco(UM_DIA_EM_SEGUNDOS)
     );
     publicados = [];
 
@@ -467,7 +486,7 @@ describe("a varredura do cron e o horizonte que ela nunca pode passar", () => {
     await engine.enqueuePublicacao(
       CONTA,
       { forma: "imagem", caminhos: [`${CONTA}/daqui-a-duas-horas.jpg`] },
-      new Date(Date.now() + 2 * 60 * 60 * 1000)
+      await daquiPeloBanco(2 * 60 * 60)
     );
     publicados = [];
 
@@ -479,3 +498,186 @@ describe("a varredura do cron e o horizonte que ela nunca pode passar", () => {
     expect(segundos).toBeLessThanOrEqual(2 * 60 * 60 + 10);
   });
 });
+
+/** Os segundos que um tique pediu ao QStash falso, lidos do cabeçalho `Upstash-Delay`. */
+function segundosDoTique(i: number): number {
+  return Number((publicados[i].atraso ?? "").replace(/s$/, ""));
+}
+
+/** O `not_before` do único item da fila. O `beforeEach` a esvazia, então há exatamente um. */
+async function notBeforeDoUnicoItem(): Promise<Date> {
+  const linhas = (await banco.db().sql().query(`select not_before from queue`)) as { not_before: Date }[];
+  expect(linhas.length).toBe(1);
+  return linhas[0].not_before;
+}
+
+// =============================================================================
+// A HORA MARCADA (15/10/2026, spec docs/specs/2026-10-15-hora-marcada.md)
+//
+// `enqueuePublicacao` transformava a hora marcada numa DURAÇÃO pelo relógio da
+// aplicação, com `Math.round`, e o banco somava a duração ao relógio dele: as
+// 10:00 foram gravadas como 12:59:59.670Z, e a tela mostrou "09:59" (achado 91,
+// em 3 de 7 agendamentos reais). Agora a hora é gravada como veio, e o banco
+// mede o que falta no mesmo statement que a grava.
+//
+// ESTE ARQUIVO É O LUGAR porque é o único que conta tiques: os outros apagam a
+// QSTASH_TOKEN.
+// =============================================================================
+describe("a hora marcada da publicação", () => {
+  test("a hora gravada é a marcada, ao milissegundo", async () => {
+    // A FRAÇÃO É O CASO. Com 120,67 s, o `Math.round` de antes gravava 121 s
+    // depois do `now()` do insert, e não a hora pedida.
+    const quando = await daquiPeloBanco(120.67);
+    const r = await engine.enqueuePublicacao(
+      CONTA,
+      { forma: "imagem", caminhos: [`${CONTA}/hora-exata.jpg`] },
+      quando
+    );
+    expect(r.entrou).toBe(true);
+    expect((await notBeforeDoUnicoItem()).getTime()).toBe(quando.getTime());
+  });
+
+  test("o relógio da aplicação adiantado não muda a hora gravada", async () => {
+    // TRINTA SEGUNDOS À FRENTE, como uma máquina fora de sincronia. Antes, a
+    // duração era medida contra `Date.now()`, e o post nascia 30 s mais cedo.
+    const quando = await daquiPeloBanco(2 * 60 * 60);
+    const real = Date.now();
+    const relogio = vi.spyOn(Date, "now").mockReturnValue(real + 30_000);
+    try {
+      await engine.enqueuePublicacao(
+        CONTA,
+        { forma: "imagem", caminhos: [`${CONTA}/relogio-adiantado.jpg`] },
+        quando
+      );
+    } finally {
+      relogio.mockRestore();
+    }
+    expect((await notBeforeDoUnicoItem()).getTime()).toBe(quando.getTime());
+  });
+
+  test("o banco diz se o item já vale e quanto falta, e o passado vira agora", async () => {
+    const r = await engine.enqueuePublicacao(
+      CONTA,
+      { forma: "imagem", caminhos: [`${CONTA}/daqui-a-duas-horas.jpg`] },
+      await daquiPeloBanco(2 * 60 * 60)
+    );
+    expect(r).toEqual({ entrou: true, jaVale: false, falta: 2 * 60 * 60 });
+
+    await banco.db().sql().query(`delete from queue`);
+    publicados = [];
+    // TRINTA SEGUNDOS NO PASSADO, como o "depois" no minuto corrente que a
+    // tolerância de `momentoDaPublicacao` deixa passar. Ele vira "agora": o
+    // `not_before` é o `now()` do insert, e não a hora velha.
+    const passado = await daquiPeloBanco(-30);
+    const agora = await engine.enqueuePublicacao(
+      CONTA,
+      { forma: "imagem", caminhos: [`${CONTA}/trinta-segundos-atras.jpg`] },
+      passado
+    );
+    expect(agora).toEqual({ entrou: true, jaVale: true, falta: 0 });
+    expect((await notBeforeDoUnicoItem()).getTime()).toBeGreaterThan(passado.getTime());
+    expect(publicados).toEqual([]);
+  });
+
+  test("na borda de um dia, o tique pedido é o horizonte, e não 86405 s (achado 102)", async () => {
+    await engine.enqueuePublicacao(
+      CONTA,
+      { forma: "imagem", caminhos: [`${CONTA}/borda-de-um-dia.jpg`] },
+      await daquiPeloBanco(UM_DIA_EM_SEGUNDOS)
+    );
+    expect(publicados.length).toBe(1);
+    expect(segundosDoTique(0)).toBe(UM_DIA_EM_SEGUNDOS);
+  });
+
+  test("a menos de 15 s, o tique sai: o post não fica parado (achado 99)", async () => {
+    await engine.enqueuePublicacao(
+      CONTA,
+      { forma: "imagem", caminhos: [`${CONTA}/daqui-a-dez-segundos.jpg`] },
+      await daquiPeloBanco(10)
+    );
+    expect(publicados.length).toBe(1);
+    // DEZ SEGUNDOS MAIS A FOLGA. O `ceil` do banco dá 10 enquanto o insert leva
+    // menos de um segundo; a faixa aceita a rodada lenta, e não aceita o zero.
+    expect(segundosDoTique(0)).toBeGreaterThanOrEqual(14);
+    expect(segundosDoTique(0)).toBeLessThanOrEqual(15);
+  });
+
+  test("um erro no tique depois do insert não desfaz o que entrou (achado 101)", async () => {
+    // A CONFIG FORA DO AR, só neste schema descartável: `getConfig` lança, como
+    // lançaria com o banco caindo entre o insert e o tique. O post já está na
+    // fila, e responder "falhou" levaria o gerador a apagar a mídia dele.
+    await banco.db().sql().query(`alter table config rename to config_fora_do_ar`);
+    try {
+      const r = await engine.enqueuePublicacao(
+        CONTA,
+        { forma: "imagem", caminhos: [`${CONTA}/config-fora-do-ar.jpg`] },
+        await daquiPeloBanco(2 * 60 * 60)
+      );
+      expect(r.entrou).toBe(true);
+    } finally {
+      await banco.db().sql().query(`alter table config_fora_do_ar rename to config`);
+    }
+    await idDoUnicoItem();
+    expect(publicados).toEqual([]);
+  });
+});
+
+// =============================================================================
+// O TETO TAMBÉM NAS MENSAGENS (achado 102, escolha do Eduardo em 15/10).
+//
+// O bloco "Esperar" do editor não tem teto (`app/automacoes/editor/painel.tsx`,
+// só `min={0}`), e o cron diário só arma posts (`armarTiquesDoDia` filtra
+// `kind = 'publicacao'`). Uma espera de dois dias pedia ao QStash 172805 s, um
+// horizonte que ninguém conferiu, e a recusa dele seria engolida. Com o teto, o
+// tique sai em um dia, e o rodapé do dreno leva a mensagem até a hora.
+// =============================================================================
+describe("o tique das mensagens com espera", () => {
+  const PESSOA = "9300000000000102";
+
+  test("a mensagem que espera dois dias pede o tique do horizonte, e não 172805 s", async () => {
+    await banco
+      .db()
+      .sql()
+      .query(
+        `insert into automations
+           (account_id, name, active, triggers, keywords, match_type, steps, ligacoes)
+         values ($1, 'espera de dois dias', true, array['dm'], array['quero-dois-dias'], 'contains',
+                 $2::text::jsonb, $3::text::jsonb)`,
+        [
+          CONTA,
+          // O MOLDE DE `gatilho-entrega.integracao.ts` ("a espera do editor"): uma
+          // mensagem agora, a espera, e a mensagem que ela segura. O id de bloco tem
+          // a forma `b_` e seis ou mais letras e numeros (`FORMA_DO_ID`, lib/steps.ts).
+          JSON.stringify([
+            { id: "b_agora02", tipo: "dm", texto: "Isto sai agora." },
+            { id: "b_doisdia", tipo: "dm", texto: "Isto sai em dois dias." },
+            { id: "b_espera2", tipo: "esperar", minutos: 2 * 24 * 60 },
+          ]),
+          JSON.stringify([
+            { de: "b_agora02", quando: { tipo: "sempre" }, para: "b_espera2" },
+            { de: "b_espera2", quando: { tipo: "sempre" }, para: "b_doisdia" },
+          ]),
+        ]
+      );
+
+    await engine.handleMessagingEvent(CONTA, {
+      sender: { id: PESSOA },
+      message: { mid: "m-dois-dias", text: "quero-dois-dias" },
+    });
+
+    // A SEGUNDA MENSAGEM ESTÁ NA FILA COM OS DOIS DIAS INTEIROS: o teto é do
+    // tique, e não da espera. A primeira sai agora, e não pede tique.
+    const fila = (await banco
+      .db()
+      .sql()
+      .query(
+        `select ceil(extract(epoch from (not_before - now())))::int as falta from queue order by not_before`
+      )) as { falta: number }[];
+    expect(fila.length).toBe(2);
+    expect(fila[0].falta).toBeLessThanOrEqual(0);
+    expect(fila[1].falta).toBeGreaterThan(2 * UM_DIA_EM_SEGUNDOS - 60);
+
+    expect(publicados.length).toBe(1);
+    expect(segundosDoTique(0)).toBe(UM_DIA_EM_SEGUNDOS);
+  });
+});
```

Em `testes-integracao/publicacao.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/publicacao.integracao.ts b/testes-integracao/publicacao.integracao.ts
index e2a19d1..d4753f4 100644
--- a/testes-integracao/publicacao.integracao.ts
+++ b/testes-integracao/publicacao.integracao.ts
@@ -394,7 +394,7 @@ async function semearEnviadosNaUltimaHora(conta: string, kind: string, quantas:
 describe("o motor publica no perfil, e na ordem certa", () => {
   test("o caminho inteiro: cria o container, ve FINISHED, publica, e SO ENTAO apaga o arquivo", async () => {
     const caminho = `${CONTA_A}/um.jpg`;
-    expect(await engine.enqueuePublicacao(CONTA_A, { forma: "imagem", caminhos: [caminho] }, null)).toBe(true);
+    expect((await engine.enqueuePublicacao(CONTA_A, { forma: "imagem", caminhos: [caminho] }, null)).entrou).toBe(true);
 
     await drenar();
 
@@ -808,11 +808,13 @@ describe("o carrossel: os filhos primeiro, o pai depois, e um post so", () => {
 
   test("tres filhos, um pai, um media_publish, e os tres arquivos apagados", async () => {
     expect(
-      await engine.enqueuePublicacao(
-        CONTA_A,
-        { forma: "carrossel", caminhos: TRES, legenda: "a legenda mora no pai" },
-        null
-      )
+      (
+        await engine.enqueuePublicacao(
+          CONTA_A,
+          { forma: "carrossel", caminhos: TRES, legenda: "a legenda mora no pai" },
+          null
+        )
+      ).entrou
     ).toBe(true);
 
     await drenar();
@@ -890,11 +892,13 @@ describe("o carrossel: os filhos primeiro, o pai depois, e um post so", () => {
   test("filho de VIDEO leva media_type VIDEO, e o de imagem no mesmo pai nao leva", async () => {
     const MISTO = [`${CONTA_A}/carrossel-foto.jpg`, `${CONTA_A}/carrossel-clipe.mp4`];
     expect(
-      await engine.enqueuePublicacao(
-        CONTA_A,
-        { forma: "carrossel", caminhos: MISTO, legenda: "foto e clipe" },
-        null
-      )
+      (
+        await engine.enqueuePublicacao(
+          CONTA_A,
+          { forma: "carrossel", caminhos: MISTO, legenda: "foto e clipe" },
+          null
+        )
+      ).entrou
     ).toBe(true);
 
     await drenar();
```

Em `testes-integracao/bonus-publicar-processo.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/bonus-publicar-processo.integracao.ts b/testes-integracao/bonus-publicar-processo.integracao.ts
index 9547758..73da0ae 100644
--- a/testes-integracao/bonus-publicar-processo.integracao.ts
+++ b/testes-integracao/bonus-publicar-processo.integracao.ts
@@ -485,10 +485,30 @@ describe("publicar", () => {
     const quando = new Date(Date.now() + 86_400_000);
     expect((await processo.publicarNaFila({ id, quando, artes: await artesDe(id), contas, drenar })).ok).toBe(true);
     const [item] = await fila();
-    expect(Math.abs(item.not_before.getTime() - quando.getTime())).toBeLessThan(120_000);
+    // A HORA EXATA, e não "a menos de dois minutos" (spec da hora marcada): o motor grava a hora pedida.
+    expect(item.not_before.getTime()).toBe(quando.getTime());
     expect(drenagens).toBe(0);
   });
 
+  it("um erro no tique depois de enfileirar não apaga a mídia do post (achado 101)", async () => {
+    const { id } = await comImagens();
+    const artes = await artesDe(id);
+    // A CONFIG FORA DO AR, só neste schema descartável: `getConfig` lança no tique, como lançaria com o
+    // banco caindo entre o insert e o tique. Antes, o erro voltava do enfileirar, e o `catch` daqui
+    // desfazia a reserva e apagava as cópias de um post que já estava na fila.
+    await banco.db().sql().query(`alter table config rename to config_fora_do_ar`);
+    let r: Awaited<ReturnType<typeof processo.publicarNaFila>>;
+    try {
+      r = await processo.publicarNaFila({ id, quando: new Date(Date.now() + 2 * 60 * 60 * 1000), artes, contas, drenar });
+    } finally {
+      await banco.db().sql().query(`alter table config_fora_do_ar rename to config`);
+    }
+    expect(r.ok).toBe(true);
+    const [item] = await fila();
+    expect(item.payload.caminhos.every((c) => bucket.objetos.has(c))).toBe(true);
+    expect(regras.publicacaoDaArte(await arteDe(id))).not.toBeNull();
+  });
+
   it("o post de um slide sai como imagem única", async () => {
     const id = await carrossel({ ...ARTE, soTexto: [] }, POST);
     const caminho = await subir(id, 1, "slide");
@@ -557,7 +577,7 @@ describe("publicar", () => {
 
   it("a fila que recusa desfaz a reserva e apaga as cópias e as artes", async () => {
     const { id } = await comImagens();
-    const r = await processo.publicarNaFila({ id, quando: null, artes: await artesDe(id), contas, drenar, enfileirar: async () => false });
+    const r = await processo.publicarNaFila({ id, quando: null, artes: await artesDe(id), contas, drenar, enfileirar: async () => ({ entrou: false as const }) });
     expect(r.ok ? null : r.recusa.motivo).toBe("fila");
     expect(regras.publicacaoDaArte(await arteDe(id))).toBeNull();
     expect(daFila()).toEqual([]);
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/hora-marcada-guarda.test.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/tique-do-rodape.integracao.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-publicar-processo.integracao.ts -t "agendado: entra com a hora pedida|achado 101"
```

Esperado: na guarda, 1 cai e 1 passa (2): o INSERT das mensagens já é o de hoje, e o `greatest(now()` ainda
não existe no motor. No tique-do-rodape, `[rede-global] ALVO: banco de TESTE`, 9 caem e 6 passam (15): os
7 novos, e os 2 do rodapé que semeiam por `agendarPostDaqui`, que lê `r.entrou` (no código de antes, o
retorno é `true`). No gerador, os 2 filtrados caem: a hora sai alguns milissegundos diferente da pedida, e o
publicar com a config fora do ar recusa com `fila`.

- [ ] **Passo 3: o código**

Em `lib/engine.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/engine.ts b/lib/engine.ts
index 15b4229..fb6c3a1 100644
--- a/lib/engine.ts
+++ b/lib/engine.ts
@@ -103,7 +103,7 @@ import {
 // `payloadDaPublicacao` monta o que vai no `jsonb`, e `FormaDePublicacao` é a
 // união das quatro formas — as duas de `lib/publicacao.ts`, que não tem import
 // nenhum e roda também no navegador.
-import { payloadDaPublicacao, type FormaDePublicacao } from "./publicacao";
+import { atrasoDoTiqueDaPublicacao, payloadDaPublicacao, type FormaDePublicacao } from "./publicacao";
 // A DEFINIÇÃO DE "FILA VIVA" TEM UM DONO SÓ, e não é escrita à mão de novo
 // aqui: ver o comentário em `enqueueLote`, onde ela substitui
 // `status in ('pending','guardado')`.
@@ -288,6 +288,14 @@ function findMatch(
 // resposta manual ficava presa quase um minuto. Na Vercel os relógios são
 // sincronizados e a diferença é de milissegundos, e foi por isso que isso nunca
 // apareceu em produção.
+//
+// ISTO É O CONTRATO DAS MENSAGENS, e só delas: "mande daqui a N minutos" é uma
+// duração, e duração não tem hora no relógio de ninguém. A PUBLICAÇÃO NÃO PASSA
+// POR AQUI. A hora marcada é absoluta, e convertê-la em duração trazia de volta
+// o relógio da aplicação que este comentário tirou: as 10:00 foram gravadas
+// como 12:59:59.670Z (achado 91). Ela tem o INSERT dela, em `enqueuePublicacao`,
+// e `tests/hora-marcada-guarda.test.ts` lê este arquivo para as duas regras não
+// se misturarem.
 async function enqueue(item: {
   account_id: string;
   kind: QueueItem["kind"];
@@ -297,19 +305,6 @@ async function enqueue(item: {
   payload: Record<string, unknown>;
   dedupe_key: string;
   delaySeconds?: number;
-  // O TIQUE DO QSTASH É OPCIONAL, E SÓ A PUBLICAÇÃO DESLIGA.
-  //
-  // Todo item de MENSAGEM continua armando o seu, como sempre: o padrão é
-  // ligado, e nenhum chamador antigo mudou de comportamento. A publicação é o
-  // primeiro tipo que se agenda para semanas à frente, e um atraso de 30 dias
-  // entregue ao QStash depende de um horizonte que NÃO foi verificado — se ele
-  // recusar, `scheduleTick` engole o erro (e está certo em engolir) e o post
-  // não sai, calado.
-  //
-  // Quem arma o tique dela é `armarTiquesDoDia` (lib/queue-drain.ts), no cron
-  // diário, quando a hora chega a menos de um dia de distância. Ver
-  // `HORIZONTE_DO_TIQUE_EM_SEGUNDOS` (lib/qstash.ts) para o desenho inteiro.
-  agendarTique?: boolean;
 }): Promise<boolean> {
   const atraso = Math.max(0, Math.round(item.delaySeconds ?? 0));
   const rows = (await sql().query(
@@ -334,9 +329,17 @@ async function enqueue(item: {
   const inserted = rows.length > 0;
 
   // item com atraso: pede pro QStash acordar o app na hora certa
-  if (inserted && atraso > 15 && item.agendarTique !== false) {
+  //
+  // O TETO É O HORIZONTE, aplicado depois da folga (achado 102, escolha do
+  // Eduardo em 15/10). O "Esperar" do editor não tem teto, e o cron diário só
+  // arma posts (`armarTiquesDoDia` filtra `kind = 'publicacao'`): uma espera de
+  // dois dias pedia ao QStash 172805 s, um horizonte que ninguém conferiu, e a
+  // recusa dele seria engolida por `scheduleTick`. Com o teto, o tique acorda o
+  // dreno em um dia, e o rodapé do dreno arma o seguinte, já dentro do
+  // horizonte, até a hora (lib/queue-drain.ts).
+  if (inserted && atraso > 15) {
     const config = await getConfig();
-    await scheduleTick(config.app_url ?? "", atraso + 5);
+    await scheduleTick(config.app_url ?? "", Math.min(atraso + 5, HORIZONTE_DO_TIQUE_EM_SEGUNDOS));
   }
   return inserted;
 }
@@ -2574,6 +2577,26 @@ export async function enqueueLote(
 // `upsertContact`, a janela de 24 h, as variáveis de `{{first_name}}`) deixa de
 // alcançar este item por consequência disso, e não por uma exceção escrita em
 // cada um.
+//
+// =============================================================================
+// A HORA MARCADA É GRAVADA COMO VEIO (spec docs/specs/2026-10-15-hora-marcada.md)
+//
+// Até 15/10/2026 a hora marcada virava uma DURAÇÃO aqui, medida contra
+// `Date.now()` e arredondada, e `enqueue` a somava ao `now()` do banco. A
+// duração era medida por um relógio e somada por outro, e o arredondamento
+// tirava até meio segundo: as 10:00 foram gravadas como 12:59:59.670Z, e a tela
+// mostrou "09:59" (achado 91, em 3 de 7 agendamentos reais, de 10 a 330 ms
+// antes do minuto). O remarcar já gravava a hora absoluta
+// (app/publicar/post/actions.ts), e o dreno obedece a ela.
+//
+// O RESULTADO É MEDIDO PELO BANCO, no mesmo statement que grava: `ja_vale` diz
+// se a hora não está no futuro, e `falta` quantos segundos faltam. Quem
+// enfileirou drena o que já vale (achado 99), e o tique sai pela distância que o
+// banco mediu (`atrasoDoTiqueDaPublicacao`, lib/publicacao.ts).
+export type ResultadoDaPublicacao =
+  | { entrou: false }
+  | { entrou: true; jaVale: boolean; falta: number };
+
 export async function enqueuePublicacao(
   accountId: string,
   pedido: {
@@ -2584,37 +2607,56 @@ export async function enqueuePublicacao(
     nomeDoAudio?: string;
   },
   quando: Date | null
-): Promise<boolean> {
+): Promise<ResultadoDaPublicacao> {
   // SEM ARQUIVO NÃO HÁ POST. `lerPayloadDaPublicacao` recusaria a lista vazia
   // depois, no dreno, e o item viraria um `failed` com motivo escrito — mas
   // gastando uma linha de fila e uma passada para dizer o que dá para dizer
   // aqui, antes de gravar nada.
-  if (!pedido.caminhos.length) return false;
+  if (!pedido.caminhos.length) return { entrou: false };
 
-  // O ATRASO VEM EM SEGUNDOS, e a conta de "agora" quem faz é o BANCO — é o
-  // contrato de `enqueue`, e o comentário dela tem a medição que o justifica
-  // (53,9 segundos de diferença entre os dois relógios NESTA máquina). O que
-  // sai daqui é uma DURAÇÃO, e duração não depende de qual relógio a mediu.
+  // `quando: null` é agora, pelo `now()` do banco. Data no passado também é
+  // agora, e não um erro: quem agendou para as 14h e confirmou às 14h01 quer
+  // publicar. O `coalesce` é escrito mesmo com o `greatest` ignorando NULL, para
+  // ninguém precisar conhecer a armadilha ao ler a linha.
   //
-  // `quando: null` é agora. Data no passado também é agora, e não um atraso
-  // negativo: quem agendou para as 14h e confirmou às 14h01 quer publicar, não
-  // quer um erro.
-  const atraso = quando ? Math.max(0, Math.round((quando.getTime() - Date.now()) / 1000)) : 0;
-
-  return enqueue({
-    account_id: accountId,
-    kind: "publicacao",
-    // A CHAVE LEVA A CONTA, pelo mesmo motivo que a de `enqueueLote` leva:
-    // `dedupe_key` é `unique` na tabela inteira. O resto dela é a FORMA e a
-    // lista INTEIRA de caminhos, em ordem — cada caminho é único por upload, e
-    // a ordem do carrossel é conteúdo. Ver `publicacaoKey` (lib/dedupe.ts), que
-    // tem as duas medições que obrigaram as duas partes.
-    dedupe_key: publicacaoKey(accountId, pedido.forma, pedido.caminhos),
-    payload: payloadDaPublicacao(pedido),
-    delaySeconds: atraso,
-    // O TIQUE SÓ SAI DAQUI QUANDO A HORA CABE NO HORIZONTE QUE CONFERIMOS. Ver
-    // `HORIZONTE_DO_TIQUE_EM_SEGUNDOS` (lib/qstash.ts): além de um dia, quem
-    // arma é o cron diário, e não uma promessa do QStash que ninguém verificou.
-    agendarTique: atraso <= HORIZONTE_DO_TIQUE_EM_SEGUNDOS,
-  });
+  // O QUE O INSERT DE `enqueue` FAZ, ESTE REPETE: o `on conflict` da
+  // `dedupe_key`, o payload cru (o motivo está em `enqueue`), e as colunas de
+  // contato, automação e comentário nulas.
+  const linhas = (await sql().query(
+    `insert into queue (account_id, kind, payload, dedupe_key, not_before)
+     values ($1, 'publicacao', $2, $3, greatest(now(), coalesce($4::timestamptz, now())))
+     on conflict (dedupe_key) do nothing
+     returning id,
+               (not_before <= now()) as ja_vale,
+               greatest(0, ceil(extract(epoch from (not_before - now()))))::int as falta`,
+    [
+      accountId,
+      payloadDaPublicacao(pedido),
+      // A CHAVE LEVA A CONTA, pelo mesmo motivo que a de `enqueueLote` leva:
+      // `dedupe_key` é `unique` na tabela inteira. O resto dela é a FORMA e a
+      // lista INTEIRA de caminhos, em ordem — cada caminho é único por upload, e
+      // a ordem do carrossel é conteúdo. Ver `publicacaoKey` (lib/dedupe.ts), que
+      // tem as duas medições que obrigaram as duas partes.
+      publicacaoKey(accountId, pedido.forma, pedido.caminhos),
+      quando,
+    ]
+  )) as { id: string; ja_vale: boolean; falta: number }[];
+  if (!linhas.length) return { entrou: false };
+  const { ja_vale: jaVale, falta } = linhas[0];
+
+  // O TIQUE NÃO DERRUBA O QUE JÁ ENTROU (achado 101). Daqui para baixo o post
+  // está na fila: um erro na config ou no QStash que voltasse como falha faria o
+  // /publicar dizer "erro" de um post que vai sair, e o gerador apagar a mídia
+  // dele (lib/bonus/publicar-processo.ts). Sem tique o post ainda sai — pelo
+  // rodapé do dreno, por um webhook ou pelo cron —, só mais tarde.
+  const atrasoDoTique = jaVale ? null : atrasoDoTiqueDaPublicacao(falta, HORIZONTE_DO_TIQUE_EM_SEGUNDOS);
+  if (atrasoDoTique !== null) {
+    try {
+      const config = await getConfig();
+      await scheduleTick(config.app_url ?? "", atrasoDoTique);
+    } catch {
+      // Calado de propósito: o post está na fila, e é isso que a tela diz.
+    }
+  }
+  return { entrou: true, jaVale, falta };
 }
```

Em `lib/publicacao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/publicacao.ts b/lib/publicacao.ts
index 4851bcc..53b5f98 100644
--- a/lib/publicacao.ts
+++ b/lib/publicacao.ts
@@ -1397,7 +1397,7 @@ const TOLERANCIA_DO_MINUTO_EM_MS = 60_000;
  * =============================================================================
  * DIA PASSADO NÃO É ADIANTAMENTO
  *
- * `enqueuePublicacao` (lib/engine.ts) trata atraso negativo como zero — ou
+ * `enqueuePublicacao` (lib/engine.ts) grava `greatest(now(), quando)` — ou
  * seja, o post agendado para ontem sairia NA HORA. Quem escolheu a data errada
  * publicaria agora, no perfil público, sem desfazer. Recusar aqui é o que
  * transforma um engano de digitação num aviso, em vez de num post.
```

Em `app/publicar/actions.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/publicar/actions.ts b/app/publicar/actions.ts
index 8266c41..8f3deb0 100644
--- a/app/publicar/actions.ts
+++ b/app/publicar/actions.ts
@@ -112,7 +112,7 @@ export async function publicar(formData: FormData): Promise<void> {
     );
   }
 
-  const entrou = await enqueuePublicacao(
+  const r = await enqueuePublicacao(
     conta.ig_user_id,
     {
       forma,
@@ -124,10 +124,11 @@ export async function publicar(formData: FormData): Promise<void> {
     momento.quando
   );
 
-  if (!entrou) {
-    // `enqueue` DEVOLVE `false` QUANDO A `dedupe_key` JÁ EXISTE, e isso não é
-    // falha: o post está na fila. Dizer "deu erro" faria alguém subir o arquivo
-    // de novo e publicar duas vezes — no perfil público, sem desfazer.
+  if (!r.entrou) {
+    // `enqueuePublicacao` DEVOLVE `entrou: false` QUANDO A `dedupe_key` JÁ
+    // EXISTE, e isso não é falha: o post está na fila. Dizer "deu erro" faria
+    // alguém subir o arquivo de novo e publicar duas vezes — no perfil público,
+    // sem desfazer.
     redirect(
       urlDePublicarComAviso({ tom: "erro", texto: textoDaRecusaDaPublicacao("ja_enfileirado") })
     );
```

Em `lib/bonus/publicar-processo.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/publicar-processo.ts b/lib/bonus/publicar-processo.ts
index ed908c7..579294d 100644
--- a/lib/bonus/publicar-processo.ts
+++ b/lib/bonus/publicar-processo.ts
@@ -277,7 +277,7 @@ export async function publicarNaFila(p: {
 
   let entrou = false;
   try {
-    entrou = await enfileirar(c.conta, { forma, caminhos, legenda: reserva.legenda }, p.quando);
+    entrou = (await enfileirar(c.conta, { forma, caminhos, legenda: reserva.legenda }, p.quando)).entrou;
   } catch {
     entrou = false;
   }
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx eslint lib/engine.ts lib/publicacao.ts app/publicar/actions.ts lib/bonus/publicar-processo.ts tests/hora-marcada-guarda.test.ts testes-integracao/tique-do-rodape.integracao.ts testes-integracao/publicacao.integracao.ts testes-integracao/bonus-publicar-processo.integracao.ts
npx vitest run tests/hora-marcada-guarda.test.ts tests/publicacao.test.ts tests/bonus-publicar-paginas.test.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/tique-do-rodape.integracao.ts testes-integracao/publicacao.integracao.ts testes-integracao/bonus-publicar-processo.integracao.ts testes-integracao/publicar-fala.integracao.ts testes-integracao/agendados.integracao.ts testes-integracao/gatilho-entrega.integracao.ts
```

Esperado: `tsc` e lint limpos; os 285 dos três arquivos puros passam; nos seis de integração, `[rede-global] ALVO: banco de TESTE`,
6 arquivos e os 135 passam.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/engine.ts lib/publicacao.ts app/publicar/actions.ts lib/bonus/publicar-processo.ts tests/hora-marcada-guarda.test.ts testes-integracao/tique-do-rodape.integracao.ts testes-integracao/publicacao.integracao.ts testes-integracao/bonus-publicar-processo.integracao.ts
test "$(git branch --show-current)" = "hora-marcada"
git add lib/engine.ts lib/publicacao.ts app/publicar/actions.ts lib/bonus/publicar-processo.ts tests/hora-marcada-guarda.test.ts testes-integracao/tique-do-rodape.integracao.ts testes-integracao/publicacao.integracao.ts testes-integracao/bonus-publicar-processo.integracao.ts
```

```bash
git commit -F - <<'MSG'
A publicação agendada grava a hora marcada, e não uma duração do relógio da aplicação

O enqueuePublicacao convertia a hora marcada em duração contra Date.now(),
com arredondamento, e o banco a somava ao relógio dele: as 10:00 foram
gravadas como 12:59:59.670Z (achado 91). A publicação ganha um INSERT
próprio, que grava greatest(now(), quando) e devolve, medidos pelo banco,
se o item já vale e quanto falta. O INSERT das mensagens não muda, e uma
guarda lê o arquivo para as duas regras não se misturarem. O tique depois
do insert não derruba mais o que entrou (achado 101), e o das mensagens
ganha o teto do horizonte (achado 102).
MSG
```

---

### FASE 3 — O compor e o gerador drenam o que já vale

**Arquivos:**
- Modificar: `app/publicar/actions.ts`, `lib/bonus/publicar-processo.ts`, `app/bonus/publicar-actions.ts`
- Testar: `testes-integracao/publicar-fala.integracao.ts`, `testes-integracao/bonus-publicar-processo.integracao.ts`,
  `testes-integracao/bonus-imagem-processo.integracao.ts` (item 3 do ensaio), `tests/bonus-publicar-paginas.test.ts`

**Interfaces:**
- Consome: `ResultadoDaPublicacao` (FASE 2).
- Produz: `publicarNaFila(...)`: `Promise<{ ok: true; quando: Date | null; jaVale: boolean } | Recusa>`.

- [ ] **Passo 1: os testes**

Em `testes-integracao/publicar-fala.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/publicar-fala.integracao.ts b/testes-integracao/publicar-fala.integracao.ts
index 4cfdfc0..9deefad 100644
--- a/testes-integracao/publicar-fala.integracao.ts
+++ b/testes-integracao/publicar-fala.integracao.ts
@@ -420,6 +420,37 @@ describe("com a conta selecionada pelo tombo declarado (a primeira do schema)",
     expect(item?.no_futuro).toBe(true);
   });
 
+  // =========================================================================
+  // O "DEPOIS" NO MINUTO CORRENTE (achado 99, spec da hora marcada).
+  //
+  // `momentoDaPublicacao` aceita até 60 s no passado — a tolerância do minuto
+  // que o campo `datetime-local` obriga —, e o post nascia vencido. Só o
+  // "agora" drenava, e o `enqueue` não armava tique abaixo de 15 s: o post
+  // ficava parado até a próxima drenagem de outra coisa. Agora quem decide é o
+  // banco (`jaVale`), e o post sai na hora, como o "agora".
+  // =========================================================================
+  test("o 'depois' no minuto corrente sai na hora, como o 'agora'", async () => {
+    const minuto = new Date(Math.floor(Date.now() / 60000) * 60000).toISOString().slice(0, 16);
+    const caminho = `${CONTA_A}/depois-no-minuto-corrente.jpg`;
+    const d = await desfechoDe(
+      pedidoDePublicar({ forma: "imagem", caminhos: caminho, quando: "depois", dataHora: minuto, fuso: "0" })
+    );
+
+    expect(d.digest ?? "").toMatch(/^NEXT_REDIRECT/);
+    const aviso = avisoDaUrlDeVolta(d.url);
+    expect(aviso.tom).toBe("ok");
+    // A FRASE DO "AGORA": a hora escolhida já chegou, e ecoá-la prometeria uma
+    // espera que não existe.
+    expect(aviso.texto).toBe(
+      "Publicação na fila. Ela sai em instantes — acompanhe o desfecho em Atividade."
+    );
+
+    const itens = await itensDaFila(CONTA_A);
+    const item = itens.find((i) => i.dedupe_key.endsWith(caminho));
+    expect(item?.status).toBe("sent");
+    expect(meta.publicacoes.at(-1)?.igUserId).toBe(CONTA_A);
+  });
+
   test("forma desconhecida recusa antes de gravar", async () => {
     // "video" É A PALAVRA QUE O PRODUTO NÃO TEM, e ela é o caso real: a
     // especificação mediu que `VIDEO` não existe como `media_type` na Meta —
```

Em `testes-integracao/bonus-publicar-processo.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/bonus-publicar-processo.integracao.ts b/testes-integracao/bonus-publicar-processo.integracao.ts
index 73da0ae..4974397 100644
--- a/testes-integracao/bonus-publicar-processo.integracao.ts
+++ b/testes-integracao/bonus-publicar-processo.integracao.ts
@@ -389,7 +389,7 @@ describe("publicar com foto no espaço", () => {
       { numero: 5, caminho: await subir(id, 5, "fila"), versao: desenho(5, null) },
     ];
     bucket.chamadas = [];
-    expect(await processo.publicarNaFila({ id, quando: null, artes, contas, drenar })).toEqual({ ok: true, quando: null });
+    expect(await processo.publicarNaFila({ id, quando: null, artes, contas, drenar })).toEqual({ ok: true, quando: null, jaVale: true });
     const [item] = await fila();
     expect(item.payload.caminhos[1]).toBe(artes[1].caminho);
     expect(item.payload.caminhos).not.toContain(foto);
@@ -431,7 +431,7 @@ describe("publicar com foto no espaço", () => {
     const artes = await Promise.all(
       [1, 2, 5].map(async (n) => ({ numero: n, caminho: await subir(id, n, "fila"), versao: desenho(n, null) }))
     );
-    expect(await processo.publicarNaFila({ id, quando: null, artes, contas, drenar })).toEqual({ ok: true, quando: null });
+    expect(await processo.publicarNaFila({ id, quando: null, artes, contas, drenar })).toEqual({ ok: true, quando: null, jaVale: true });
     const [item] = await fila();
     expect(item.payload.caminhos[1]).toBe(artes[1].caminho);
   });
@@ -455,7 +455,7 @@ describe("publicar", () => {
     const { id, guardadas } = await comImagens();
     const artes = await artesDe(id);
     const r = await processo.publicarNaFila({ id, quando: null, artes, contas, drenar });
-    expect(r).toEqual({ ok: true, quando: null });
+    expect(r).toEqual({ ok: true, quando: null, jaVale: true });
 
     const [item, ...resto] = await fila();
     expect(resto).toEqual([]);
@@ -490,6 +490,19 @@ describe("publicar", () => {
     expect(drenagens).toBe(0);
   });
 
+  it("no minuto corrente: entra valendo, e drena como o agora (achado 99)", async () => {
+    const { id } = await comImagens();
+    // TRINTA SEGUNDOS NO PASSADO, como o "depois" no minuto corrente que a tolerância de
+    // `momentoDaPublicacao` deixa passar. Antes, só `quando === null` drenava, e o post ficava parado.
+    const quando = new Date(Date.now() - 30_000);
+    expect(await processo.publicarNaFila({ id, quando, artes: await artesDe(id), contas, drenar })).toEqual({
+      ok: true,
+      quando,
+      jaVale: true,
+    });
+    expect(drenagens).toBe(1);
+  });
+
   it("um erro no tique depois de enfileirar não apaga a mídia do post (achado 101)", async () => {
     const { id } = await comImagens();
     const artes = await artesDe(id);
@@ -742,7 +755,7 @@ describe("publicar com um slide que sai cortado", () => {
     const artes = await Promise.all(
       [1, 5].map(async (n) => ({ numero: n, caminho: await subir(id, n, "fila"), versao: desenho(CORTADO, n, null) }))
     );
-    expect(await processo.publicarNaFila({ id, quando: null, artes, contas, drenar })).toEqual({ ok: true, quando: null });
+    expect(await processo.publicarNaFila({ id, quando: null, artes, contas, drenar })).toEqual({ ok: true, quando: null, jaVale: true });
     expect(await fila()).toHaveLength(1);
   });
 
@@ -752,7 +765,7 @@ describe("publicar com um slide que sai cortado", () => {
     const artes = await Promise.all(
       [1, 2, 5].map(async (n) => ({ numero: n, caminho: await subir(id, n, "fila"), versao: desenho(CORTADO, n, null) }))
     );
-    expect(await processo.publicarNaFila({ id, quando: null, artes, contas, drenar })).toEqual({ ok: true, quando: null });
+    expect(await processo.publicarNaFila({ id, quando: null, artes, contas, drenar })).toEqual({ ok: true, quando: null, jaVale: true });
     expect(await fila()).toHaveLength(1);
   });
 
```

Em `testes-integracao/bonus-imagem-processo.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/bonus-imagem-processo.integracao.ts b/testes-integracao/bonus-imagem-processo.integracao.ts
index d65faca..2d526f6 100644
--- a/testes-integracao/bonus-imagem-processo.integracao.ts
+++ b/testes-integracao/bonus-imagem-processo.integracao.ts
@@ -293,6 +293,8 @@ describe("gerar a imagem", () => {
     expect(await publicar.publicarNaFila({ id, quando: new Date(Date.now() + 86_400_000), artes, contas, drenar: async () => {} })).toEqual({
       ok: true,
       quando: expect.any(Date),
+      // AGENDADO PARA AMANHÃ, ainda não vale pelo banco (spec da hora marcada).
+      jaVale: false,
     });
     const [item] = (await banco.db().sql().query(`select payload from queue`)) as { payload: { caminhos: string[] } }[];
     expect(item.payload.caminhos[1]).toBe(artes[1].caminho);
```

Em `tests/bonus-publicar-paginas.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-publicar-paginas.test.ts b/tests/bonus-publicar-paginas.test.ts
index aa5c479..f3c4d7e 100644
--- a/tests/bonus-publicar-paginas.test.ts
+++ b/tests/bonus-publicar-paginas.test.ts
@@ -73,6 +73,14 @@ describe("as frases das actions", () => {
     expect(textoDaPublicacaoMandada(false)).not.toMatch(/^Publicado/);
     expect(textoDaPublicacaoMandada(true)).toMatch(/^Agendado/);
   });
+
+  // A FRASE SEGUE O QUE O BANCO MEDIU (spec da hora marcada): o "depois" no minuto corrente já vale e
+  // sai na hora, e dizer "Agendado" prometeria uma espera que não existe.
+  it("a frase de agendado vem do jaVale do banco, e não da hora pedida", () => {
+    const fonte = ler(ACTIONS);
+    expect(fonte).toContain("textoDaPublicacaoMandada(!r.jaVale)");
+    expect(fonte).not.toContain("textoDaPublicacaoMandada(r.quando !== null)");
+  });
 });
 
 describe("a página do carrossel entrega a publicação ao editor", () => {
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-publicar-paginas.test.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/publicar-fala.integracao.ts testes-integracao/bonus-publicar-processo.integracao.ts testes-integracao/bonus-imagem-processo.integracao.ts
```

Esperado: nas páginas do gerador, 1 cai e 8 passam (9): a action ainda decide a frase por `r.quando`. Na
integração, `[rede-global] ALVO: banco de TESTE`, 8 caem e 80 passam (88): o "depois" no minuto corrente do
compor (a frase ainda é a da hora marcada), o do gerador (não drena), e 6 que comparam o retorno do
gerador, que ainda não tem `jaVale`.

- [ ] **Passo 3: o código**

Em `app/publicar/actions.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/publicar/actions.ts b/app/publicar/actions.ts
index 8f3deb0..a12c6a0 100644
--- a/app/publicar/actions.ts
+++ b/app/publicar/actions.ts
@@ -135,10 +135,14 @@ export async function publicar(formData: FormData): Promise<void> {
   }
 
   // ENFILEIRAR NÃO ENVIA, e esta linha é a mesma que faltava no lote até 02/09.
-  // `enqueue` (lib/engine.ts:321) só pede um tique ao QStash quando o atraso
-  // passa de 15 segundos — e "agora" nasce com atraso ZERO, ou seja não agenda
-  // nada. Sem esta drenagem, o post sairia quando chegasse um webhook de fora,
-  // ou às 09:00 do dia seguinte.
+  // O que já vale não ganha tique (`atrasoDoTiqueDaPublicacao`, lib/publicacao.ts):
+  // sem esta drenagem, o post sairia quando chegasse um webhook de fora, ou no
+  // cron do dia seguinte.
+  //
+  // QUEM DIZ QUE JÁ VALE É O BANCO (`r.jaVale`), e não a palavra "agora". O
+  // "depois" no minuto corrente passa pela tolerância de `momentoDaPublicacao`
+  // e nasce vencido: até 15/10/2026 só o "agora" drenava, o `enqueue` não
+  // armava tique abaixo de 15 s, e esse post ficava parado (achado 99).
   //
   // A DRENAGEM NÃO ESPERA A META. O ramo da publicação (Tarefa 4) cria o
   // contêiner, consulta o `status_code` UMA vez e devolve o item à fila com
@@ -146,10 +150,10 @@ export async function publicar(formData: FormData): Promise<void> {
   // segundos (medido), então a segunda passada é o caso normal. Quem clicou
   // espera pela ida, não pela publicação.
   //
-  // O AGENDADO NÃO DRENA: o item tem `not_before` no futuro, a drenagem não o
-  // pegaria, e o que ela faria era gastar o tempo de quem clicou drenando os
-  // itens dos outros.
-  if (momento.quando === null) {
+  // O QUE AINDA NÃO VALE NÃO DRENA: o item tem `not_before` no futuro, a
+  // drenagem não o pegaria, e o que ela faria era gastar o tempo de quem clicou
+  // drenando os itens dos outros.
+  if (r.jaVale) {
     try {
       await drainQueue();
     } catch {
@@ -169,6 +173,7 @@ export async function publicar(formData: FormData): Promise<void> {
   //
   // A HORA ECOADA VEM DOS CAMPOS ESCOLHIDOS, e não do `Date`: este servidor
   // roda em UTC, e formatar o instante aqui mostraria três horas a mais do que
-  // a pessoa digitou.
-  redirect(urlDePublicarComAviso(avisoDaPublicacaoEnfileirada(momento.quando ? campos : null)));
+  // a pessoa digitou. O QUE JÁ VALE LEVA A FRASE DO "AGORA": ecoar a hora do
+  // minuto corrente prometeria uma espera que não existe.
+  redirect(urlDePublicarComAviso(avisoDaPublicacaoEnfileirada(r.jaVale ? null : campos)));
 }
```

Em `lib/bonus/publicar-processo.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/publicar-processo.ts b/lib/bonus/publicar-processo.ts
index 579294d..c3e76d2 100644
--- a/lib/bonus/publicar-processo.ts
+++ b/lib/bonus/publicar-processo.ts
@@ -1,7 +1,7 @@
 import "server-only";
 import { pastaDaConta, tetoDoBucket } from "@/lib/bucket";
 import { publicacaoKey } from "@/lib/dedupe";
-import { enqueuePublicacao } from "@/lib/engine";
+import { enqueuePublicacao, type ResultadoDaPublicacao } from "@/lib/engine";
 import {
   decisaoDeAssinatura,
   problemaDaLegenda,
@@ -152,9 +152,9 @@ export type ArteSubida = { numero: number; caminho: unknown; versao: unknown };
 /**
  * PUBLICAR OU AGENDAR (spec, "Publicar"): confere tudo antes de tocar o bucket; copia os slides
  * prontos guardados para a fila, fora de qualquer transação; reserva com a linha travada, conferindo
- * de novo; enfileira na conta do carrossel; marca a reserva como enfileirada (achado 75); e, com
- * "agora", drena a fila como o /publicar. Em qualquer recusa depois do navegador ter subido as artes,
- * as artes e as cópias desta tentativa saem do bucket.
+ * de novo; enfileira na conta do carrossel; marca a reserva como enfileirada (achado 75); e, com o
+ * post que já vale pelo banco, drena a fila como o /publicar. Em qualquer recusa depois do navegador
+ * ter subido as artes, as artes e as cópias desta tentativa saem do bucket.
  *
  * O SLIDE COM FOTO PUBLICA A ARTE DESENHADA, e não a foto (adendo da Etapa 5): ele vai com as artes
  * "Só texto", que o navegador baixou da rota e subiu em `bonus-fila`, com a versão do desenho (o
@@ -169,7 +169,7 @@ export async function publicarNaFila(p: {
   contas: ContaDoCabecalho[];
   enfileirar?: typeof enqueuePublicacao;
   drenar?: () => Promise<unknown>;
-}): Promise<{ ok: true; quando: Date | null } | Recusa> {
+}): Promise<{ ok: true; quando: Date | null; jaVale: boolean } | Recusa> {
   const enfileirar = p.enfileirar ?? enqueuePublicacao;
   const drenar = p.drenar ?? drainQueue;
   const c = await conferirCarrossel(p.id, p.contas);
@@ -275,13 +275,15 @@ export async function publicarNaFila(p: {
     await apagarSemDerrubar(reserva.velha.caminhos.filter((x) => !daVelhaNaFila.includes(x) && !caminhos.includes(x)));
   }
 
-  let entrou = false;
+  let r: ResultadoDaPublicacao = { entrou: false };
   try {
-    entrou = (await enfileirar(c.conta, { forma, caminhos, legenda: reserva.legenda }, p.quando)).entrou;
+    r = await enfileirar(c.conta, { forma, caminhos, legenda: reserva.legenda }, p.quando);
   } catch {
-    entrou = false;
+    // SÓ O ERRO DE ANTES DO INSERT CHEGA AQUI: o do tique fica dentro de `enqueuePublicacao`
+    // (achado 101), e desfazer a reserva com o post na fila apagaria a mídia dele.
+    r = { entrou: false };
   }
-  if (!entrou) {
+  if (!r.entrou) {
     await desfazerReserva(p.id, chave);
     await descartar(Object.values(copiadas.copias));
     return recusa({ motivo: "fila" });
@@ -295,14 +297,16 @@ export async function publicarNaFila(p: {
     // O resíduo está escrito na spec: a marca falhar E a conta ser desconectada depois.
   }
 
-  // ENFILEIRAR NÃO ENVIA (app/publicar/actions.ts:136-159): "agora" nasce com atraso zero, e sem a
-  // drenagem o post sairia no próximo tique. O agendado não drena.
-  if (p.quando === null) {
+  // ENFILEIRAR NÃO ENVIA (app/publicar/actions.ts, o bloco "ENFILEIRAR NÃO ENVIA"): o que já vale pelo
+  // banco não ganha tique, e sem a drenagem o post sairia no próximo tique de outra coisa. Quem diz que
+  // já vale é o banco, e não `quando === null`: o "depois" no minuto corrente nasce vencido (achado
+  // 99). O que ainda não vale não drena.
+  if (r.jaVale) {
     try {
       await drenar();
     } catch {
       // A trava atômica do dreno garante que o próximo recupera; o estado na página diz "publicando".
     }
   }
-  return { ok: true, quando: p.quando };
+  return { ok: true, quando: p.quando, jaVale: r.jaVale };
 }
```

Em `app/bonus/publicar-actions.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/publicar-actions.ts b/app/bonus/publicar-actions.ts
index 6bfc05b..e33bc29 100644
--- a/app/bonus/publicar-actions.ts
+++ b/app/bonus/publicar-actions.ts
@@ -92,6 +92,6 @@ export async function publicarCarrossel(pedido: unknown): Promise<AvisoDaPublica
   });
   const r = await publicarNaFila({ id: p.id, quando: momento.quando, artes, contas: await contasParaArte() });
   return r.ok
-    ? { tom: "ok", texto: textoDaPublicacaoMandada(r.quando !== null), em }
+    ? { tom: "ok", texto: textoDaPublicacaoMandada(!r.jaVale), em }
     : { tom: "erro", texto: textoDaRecusaDaPublicacaoDoCarrossel(r.recusa), em };
 }
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx eslint app/publicar/actions.ts lib/bonus/publicar-processo.ts app/bonus/publicar-actions.ts testes-integracao/publicar-fala.integracao.ts testes-integracao/bonus-publicar-processo.integracao.ts testes-integracao/bonus-imagem-processo.integracao.ts tests/bonus-publicar-paginas.test.ts
npx vitest run tests/bonus-publicar-paginas.test.ts tests/hora-marcada-guarda.test.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/publicar-fala.integracao.ts testes-integracao/bonus-publicar-processo.integracao.ts testes-integracao/bonus-imagem-processo.integracao.ts
```

Esperado: `tsc` e lint limpos; os 11 dos dois arquivos puros passam; na integração, os 88 passam.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" app/publicar/actions.ts lib/bonus/publicar-processo.ts app/bonus/publicar-actions.ts testes-integracao/publicar-fala.integracao.ts testes-integracao/bonus-publicar-processo.integracao.ts testes-integracao/bonus-imagem-processo.integracao.ts tests/bonus-publicar-paginas.test.ts
test "$(git branch --show-current)" = "hora-marcada"
git add app/publicar/actions.ts lib/bonus/publicar-processo.ts app/bonus/publicar-actions.ts testes-integracao/publicar-fala.integracao.ts testes-integracao/bonus-publicar-processo.integracao.ts testes-integracao/bonus-imagem-processo.integracao.ts tests/bonus-publicar-paginas.test.ts
```

```bash
git commit -F - <<'MSG'
O compor e o gerador drenam o post que já vale pelo banco, e não só o agora

O "depois" no minuto corrente passa pela tolerância de momentoDaPublicacao
e nasce vencido. Só o "agora" drenava, e o enqueue não armava tique abaixo
de 15 segundos: o post ficava parado até a próxima drenagem de outra coisa
(achado 99). Quem decide agora é o jaVale que o banco mediu no insert, e a
frase de sucesso segue o mesmo sinal: o que já vale leva a frase do agora.
MSG
```

---

### FASE 4 — O remarcar pela mesma regra

**Arquivos:**
- Modificar: `app/publicar/post/actions.ts`, `lib/publicacao.ts` (sai `atrasoDoTiqueDoRemarcar`)
- Testar: `testes-integracao/agendados.integracao.ts`, `testes-integracao/tique-do-rodape.integracao.ts`,
  `tests/publicacao.test.ts` (sai o teste da função antiga)

**Interfaces:**
- Consome: `atrasoDoTiqueDaPublicacao` (FASE 1); `drainQueue` (`lib/queue-drain.ts`).
- Remove: `atrasoDoTiqueDoRemarcar`, de `lib/publicacao.ts`.

- [ ] **Passo 1: os testes**

Em `testes-integracao/agendados.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/agendados.integracao.ts b/testes-integracao/agendados.integracao.ts
index 3656c66..3f7418e 100644
--- a/testes-integracao/agendados.integracao.ts
+++ b/testes-integracao/agendados.integracao.ts
@@ -669,6 +669,31 @@ describe("com a conta selecionada pelo tombo declarado (a primeira do schema)",
     expect(meta.containers.length).toBe(containersAntes);
   });
 
+  // =========================================================================
+  // O MINUTO CORRENTE (achado 99, spec da hora marcada).
+  //
+  // A tolerância de `momentoDaPublicacao` aceita até 60 s no passado, e o
+  // remarcar para o minuto corrente gravava uma hora já vencida sem drenar e
+  // sem tique (`atrasoDoTiqueDoRemarcar` não armava até 15 s). O post ficava
+  // parado até a próxima drenagem de outra coisa. Agora o banco diz que já
+  // vale, e o remarcar drena, como o compor.
+  // =========================================================================
+  test("remarcar para o minuto corrente sai no dreno, como o compor", async () => {
+    const id = await semear({ conta: CONTA_A, emSegundos: 3600 });
+    const minuto = Math.floor(Date.now() / 60000) * 60000;
+
+    const d = await desfechoDe(acoes.remarcarPublicacao, pedidoDeRemarcar(id, campoDeDataHora(minuto)));
+
+    expect(d.digest ?? "").toMatch(/^NEXT_REDIRECT/);
+    expect(avisoDaUrlDeVolta(d.url).tom).toBe("ok");
+    const item = await lerItem(id);
+    expect(item.status).toBe("sent");
+    // A HORA GRAVADA É A DO BANCO, e não o minuto que já passou: o `greatest` do
+    // remarcar é o mesmo de `enqueuePublicacao`.
+    expect(item.not_before.getTime()).toBeGreaterThan(minuto);
+    expect(meta.publicacoes.at(-1)).toEqual({ igUserId: CONTA_A, token: TOKEN_A });
+  });
+
   // =========================================================================
   // O FUSO, E O QUE A TELA DE VERDADE MANDA.
   //
```

Em `testes-integracao/tique-do-rodape.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/tique-do-rodape.integracao.ts b/testes-integracao/tique-do-rodape.integracao.ts
index 47d5eb8..c9ea2d6 100644
--- a/testes-integracao/tique-do-rodape.integracao.ts
+++ b/testes-integracao/tique-do-rodape.integracao.ts
@@ -379,6 +379,32 @@ describe("o tique da hora nova, e o par de controle que o mede", () => {
     expect(publicados).toEqual([]);
   });
 
+  // O ERRO DO TIQUE NAO DERRUBA O REMARCAR (achado 101). A hora nova ja esta
+  // gravada quando o tique e pedido: um erro ali que subisse faria a acao
+  // voltar sem o `redirect`, e a tela nao diria que o post foi remarcado.
+  test("um erro no tique nao derruba o remarcar (achado 101)", async () => {
+    await engine.enqueuePublicacao(
+      CONTA,
+      { forma: "imagem", caminhos: [`${CONTA}/remarcado-com-a-config-fora.jpg`] },
+      await daquiPeloBanco(30 * UM_DIA_EM_SEGUNDOS)
+    );
+    const id = await idDoUnicoItem();
+    const alvo = await daquiAHoras(2);
+    publicados = [];
+
+    await banco.db().sql().query(`alter table config rename to config_fora_do_ar`);
+    let aviso: { texto: string | null; tom: string | null };
+    try {
+      aviso = await avisoDe(acoes.remarcarPublicacao, pedidoDeRemarcar(id, alvo));
+    } finally {
+      await banco.db().sql().query(`alter table config_fora_do_ar rename to config`);
+    }
+    expect(aviso.tom).toBe("ok");
+    expect(aviso.texto).toContain("Post remarcado");
+    expect((await notBeforeDoUnicoItem()).getTime()).toBe(alvo);
+    expect(publicados).toEqual([]);
+  });
+
   // E UM REMARCAR RECUSADO NAO ARMA NADA. Sem esta linha, o tique poderia ter
   // sido posto fora do `if (desfecho === "feito")` e ninguem veria: um tique
   // para uma hora que nao foi gravada acorda o app para nada.
```

Em `tests/publicacao.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/publicacao.test.ts b/tests/publicacao.test.ts
index c74c480..c05cac5 100644
--- a/tests/publicacao.test.ts
+++ b/tests/publicacao.test.ts
@@ -38,7 +38,6 @@ import {
   moverNaOrdem,
   rotuloDoEnvio,
   atrasoDoTiqueDaPublicacao,
-  atrasoDoTiqueDoRemarcar,
   avisoDoAtrasoNaLista,
   fraseSobreAMidia,
   fraseDaDataDaLinha,
@@ -1879,62 +1878,6 @@ describe("desfechoDaMudanca", () => {
   });
 });
 
-// =============================================================================
-// O TIQUE DA HORA NOVA (09/09/2026)
-//
-// Remarcar nao armava tique nenhum, e o comentario que justificava a ausencia
-// lia errado o codigo que citava: `enqueuePublicacao` passa
-// `agendarTique: atraso <= HORIZONTE`, e nao `false`. Medido com um QStash
-// falso: compor para +2h gerava 1 tique, remarcar gerava 0 — e o cron diario
-// nao cobria o buraco, porque remarcar move o `not_before` para dentro de uma
-// janela JA VARRIDA. O post podia sair ~23h depois, calado.
-// =============================================================================
-const UM_DIA = 24 * 60 * 60;
-
-describe("atrasoDoTiqueDoRemarcar", () => {
-  const agora = Date.UTC(2026, 8, 9, 12, 0, 0);
-
-  it("duas horas a frente arma o tique, com os cinco segundos de folga", () => {
-    const daqui2h = new Date(agora + 2 * 60 * 60 * 1000);
-    expect(atrasoDoTiqueDoRemarcar(daqui2h, agora, UM_DIA)).toBe(7205);
-  });
-
-  // A METADE QUE IMPEDE O CONSERTO DE VIRAR "arma sempre". Um mes de atraso
-  // entregue ao QStash depende de um horizonte que NUNCA foi verificado, e se
-  // ele recusasse `scheduleTick` engoliria o erro — o post nao sairia, calado.
-  it("alem do horizonte NAO arma: quem arma e o cron diario", () => {
-    const daqui30d = new Date(agora + 30 * UM_DIA * 1000);
-    expect(atrasoDoTiqueDoRemarcar(daqui30d, agora, UM_DIA)).toBe(null);
-  });
-
-  // A BORDA EXATA, e o teto e aplicado DEPOIS da folga: sem o `Math.min`, a
-  // hora na borda entregaria 86405 s, cinco segundos alem do horizonte que este
-  // projeto declarou nunca ultrapassar. E a mesma licao de `armarTiquesDoDia`.
-  it("na borda do horizonte o atraso NAO passa de um dia", () => {
-    const naBorda = new Date(agora + UM_DIA * 1000);
-    expect(atrasoDoTiqueDoRemarcar(naBorda, agora, UM_DIA)).toBe(UM_DIA);
-  });
-
-  // O `atraso > 15` de `enqueue`, com o mesmo numero: um tique para daqui a
-  // nada e uma volta ao app sem serventia — o item sai na drenagem a caminho.
-  it("perto demais NAO arma", () => {
-    expect(atrasoDoTiqueDoRemarcar(new Date(agora + 10_000), agora, UM_DIA)).toBe(null);
-    expect(atrasoDoTiqueDoRemarcar(new Date(agora + 15_000), agora, UM_DIA)).toBe(null);
-    expect(atrasoDoTiqueDoRemarcar(new Date(agora + 16_000), agora, UM_DIA)).toBe(21);
-  });
-
-  // O PASSADO NAO ARMA. `momentoDaPublicacao` ja recusa antes de chegar aqui,
-  // mas um atraso negativo entregue ao QStash e a coisa que ele recusaria — e a
-  // recusa dele e muda.
-  it("hora no passado NAO arma", () => {
-    expect(atrasoDoTiqueDoRemarcar(new Date(agora - 60_000), agora, UM_DIA)).toBe(null);
-  });
-
-  it("data ilegivel NAO arma, e nao vira NaN entregue ao QStash", () => {
-    expect(atrasoDoTiqueDoRemarcar(new Date("nao sou data"), agora, UM_DIA)).toBe(null);
-  });
-});
-
 // =============================================================================
 // O TIQUE DA HORA MARCADA (15/10/2026, spec docs/specs/2026-10-15-hora-marcada.md)
 //
@@ -1942,7 +1885,16 @@ describe("atrasoDoTiqueDoRemarcar", () => {
 // relogio da aplicacao entra na conta. E o piso de 15 s do `enqueue` nao vale:
 // o "agora" nascia com atraso zero e era drenado na hora, mas o post marcado
 // para daqui a 10 s ficava sem tique e sem dreno (achado 99).
+//
+// A MESMA FUNCAO SERVE AO COMPOR E AO REMARCAR. Ate 09/09/2026 remarcar nao
+// armava tique nenhum: compor para +2h gerava 1 tique, remarcar gerava 0, e o
+// cron diario nao cobria o buraco, porque remarcar move o `not_before` para
+// dentro de uma janela JA VARRIDA. O post podia sair ~23h depois, calado. A
+// funcao daquele conserto (`atrasoDoTiqueDoRemarcar`) media a distancia pelo
+// relogio da aplicacao, e saiu com esta.
 // =============================================================================
+const UM_DIA = 24 * 60 * 60;
+
 describe("atrasoDoTiqueDaPublicacao", () => {
   // O QUE JA VALE NAO ARMA: quem enfileirou drena na hora, e um tique para "ja"
   // acordaria uma drenagem depois da que ja levou o post.
```

- [ ] **Passo 2: ver falhar**

```bash
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/agendados.integracao.ts testes-integracao/tique-do-rodape.integracao.ts
```

Esperado: `[rede-global] ALVO: banco de TESTE`, 2 caem e 46 passam (48): o remarcar para o minuto corrente fica
`pending`, e o remarcar com a config fora do ar sobe `relation "config" does not exist`.

- [ ] **Passo 3: o código**

Em `app/publicar/post/actions.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/publicar/post/actions.ts b/app/publicar/post/actions.ts
index d9a8825..835c4fb 100644
--- a/app/publicar/post/actions.ts
+++ b/app/publicar/post/actions.ts
@@ -4,9 +4,9 @@ import { redirect } from "next/navigation";
 import { getSelectedAccount } from "@/lib/account";
 import { getConfig, sql } from "@/lib/db";
 import { HORIZONTE_DO_TIQUE_EM_SEGUNDOS, scheduleTick } from "@/lib/qstash";
-import { limparOBucket } from "@/lib/queue-drain";
+import { drainQueue, limparOBucket } from "@/lib/queue-drain";
 import {
-  atrasoDoTiqueDoRemarcar,
+  atrasoDoTiqueDaPublicacao,
   camposDaDataHora,
   confirmouOCancelamento,
   desfechoDaMudanca,
@@ -244,12 +244,19 @@ export async function remarcarPublicacao(formData: FormData): Promise<void> {
     redirect(urlDeAgendadosComAviso(avisoDoDesfecho("data_invalida", "remarcar")));
   }
 
-  const afetadas = await sql().query(
-    `update queue set not_before = $3
+  // A HORA NOVA É GRAVADA COMO VEIO, e o `greatest` é o mesmo de
+  // `enqueuePublicacao` (lib/engine.ts): a tolerância de `momentoDaPublicacao`
+  // aceita o minuto corrente, que já passou, e ele vira "agora" pelo relógio do
+  // banco. O `returning` devolve o que o banco mediu no mesmo statement: se o
+  // item já vale, e quantos segundos faltam (spec da hora marcada).
+  const afetadas = (await sql().query(
+    `update queue set not_before = greatest(now(), $3::timestamptz)
      ${ALVO_DA_MUDANCA}
-     returning id`,
+     returning id,
+               (not_before <= now()) as ja_vale,
+               greatest(0, ceil(extract(epoch from (not_before - now()))))::int as falta`,
     [id, conta.ig_user_id, momento.quando]
-  );
+  )) as { id: string; ja_vale: boolean; falta: number }[];
 
   const desfecho = desfechoDaMudanca(
     afetadas.length,
@@ -260,33 +267,44 @@ export async function remarcarPublicacao(formData: FormData): Promise<void> {
   //
   // ATÉ 09/09/2026 NÃO HAVIA TIQUE AQUI, e o comentário que justificava a
   // ausência LIA ERRADO o código que citava: ele afirmava que
-  // `enqueuePublicacao` passa `agendarTique: false` de propósito. Ela não
-  // passa — `lib/engine.ts` passa `agendarTique: atraso <= HORIZONTE`. Compor
-  // arma o tique sempre que a hora cabe em 24 h; remarcar não armava nunca.
+  // `enqueuePublicacao` não armava tique de propósito. Ela armava sempre que a
+  // hora cabia em 24 h; remarcar não armava nunca.
   //
   // E O CRON DIÁRIO NÃO COBRIA O BURACO: `armarTiquesDoDia` só é honesta para
   // `not_before` escrito ANTES da passagem dela, e remarcar move a hora para
   // dentro de uma janela JÁ VARRIDA. Medido: compor para +2 h gera 1 tique;
   // remarcar para +2 h gerava 0, e o post podia sair ~23 h depois, calado.
   //
-  // A DECISÃO É DE `atrasoDoTiqueDoRemarcar` (lib/publicacao.ts), com caso de
-  // teste, e não de um `if` escrito aqui — a mesma disciplina de todo o resto
-  // deste arquivo. Ela respeita as três regras de `enqueue`: nada abaixo de
-  // 15 s, nada além do horizonte (além de um dia quem arma é o cron), e cinco
+  // O QUE JÁ VALE DRENA, como no compor (achado 99): o remarcar para o minuto
+  // corrente gravava uma hora vencida sem dreno e sem tique, e o post ficava
+  // parado até a próxima drenagem de outra coisa.
+  //
+  // O QUE AINDA NÃO VALE GANHA O TIQUE pela distância que o banco mediu
+  // (`atrasoDoTiqueDaPublicacao`, lib/publicacao.ts), a mesma regra do compor:
+  // nada além do horizonte (além de um dia quem arma é o cron), e cinco
   // segundos de folga com o teto aplicado depois.
   //
-  // ELE NÃO PODE DERRUBAR A AÇÃO, e não derruba: `scheduleTick` (lib/qstash.ts)
-  // engole todo erro por desenho. Sem tique o post ainda sai — pelo próximo
-  // webhook ou pelo cron —, só mais tarde; com uma exceção subindo daqui, o
-  // `redirect` de baixo nunca aconteceria e a ação voltaria muda.
+  // NADA DISTO PODE DERRUBAR A AÇÃO (achado 101): a hora nova já está gravada.
+  // Sem tique o post ainda sai — pelo próximo webhook ou pelo cron —, só mais
+  // tarde; com uma exceção subindo daqui, o `redirect` de baixo nunca
+  // aconteceria e a ação voltaria muda.
   if (desfecho === "feito") {
-    const atrasoDoTique = atrasoDoTiqueDoRemarcar(
-      momento.quando,
-      Date.now(),
-      HORIZONTE_DO_TIQUE_EM_SEGUNDOS
-    );
-    if (atrasoDoTique !== null) {
-      await scheduleTick((await getConfig()).app_url ?? "", atrasoDoTique);
+    const { ja_vale, falta } = afetadas[0];
+    if (ja_vale) {
+      try {
+        await drainQueue();
+      } catch {
+        // A trava atômica garante que o próximo dreno recupera, como no compor.
+      }
+    } else {
+      const atrasoDoTique = atrasoDoTiqueDaPublicacao(falta, HORIZONTE_DO_TIQUE_EM_SEGUNDOS);
+      if (atrasoDoTique !== null) {
+        try {
+          await scheduleTick((await getConfig()).app_url ?? "", atrasoDoTique);
+        } catch {
+          // Calado de propósito: a hora nova está gravada, e é isso que a tela diz.
+        }
+      }
     }
   }
 
```

Em `lib/publicacao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/publicacao.ts b/lib/publicacao.ts
index 53b5f98..ef4fc78 100644
--- a/lib/publicacao.ts
+++ b/lib/publicacao.ts
@@ -1752,71 +1752,6 @@ export function desfechoDaMudanca(
   return "nao_encontrado";
 }
 
-/**
- * O ATRASO, EM SEGUNDOS, DO TIQUE QUE UM REMARCAR TEM DE ARMAR — ou `null`
- * quando não há tique a armar.
- *
- * =============================================================================
- * O DEFEITO QUE ELA FECHA, medido em 09/09/2026
- *
- * Remarcar não armava tique nenhum, e o comentário que justificava a ausência
- * LIA ERRADO o código que citava: ele dizia que `enqueuePublicacao` "passa
- * `agendarTique: false` de propósito". Ela não passa —
- * `lib/engine.ts` passa `agendarTique: atraso <= HORIZONTE_DO_TIQUE_EM_SEGUNDOS`.
- * Ou seja, COMPOR ARMA O TIQUE sempre que a hora cabe em 24 h; só além de um dia
- * é que o cron diário assume.
- *
- * Medido com um QStash falso, o mesmo post e a mesma distância de 2 h:
- * **compor gera 1 tique, remarcar gerava 0.**
- *
- * E A GARANTIA DO CRON NÃO COBRIA O BURACO. `armarTiquesDoDia`
- * (lib/queue-drain.ts) é honesta enquanto o `not_before` for escrito ANTES da
- * passagem do cron — é isso que faz "todo post que vence em T teve uma passagem
- * nas 24 h anteriores a T". Remarcar quebra a premissa: ele move o `not_before`
- * para dentro de uma janela cuja passagem JÁ ACONTECEU. O cron é diário
- * (`vercel.json`: `0 9 * * *`), então um post remarcado para daqui a duas horas
- * podia sair ~23 h depois, CALADO — depois de a tela ter dito "Ele sai na hora
- * nova".
- *
- * =============================================================================
- * AS TRÊS REGRAS SÃO AS DE `enqueue` (lib/engine.ts), e nenhuma é nova
- *
- *   `<= 15 s`   não arma: o item sai na drenagem que já está a caminho, e um
- *               tique para daqui a nada é uma volta ao app sem serventia. É o
- *               `atraso > 15` de `enqueue`, escrito com o mesmo número.
- *   `> horizonte` não arma: além de um dia, quem arma é o cron diário. Entregar
- *               um mês de atraso ao QStash depende de um horizonte que NUNCA foi
- *               verificado — e se ele recusasse, `scheduleTick` engoliria o erro
- *               (está certo em engolir) e o post não sairia, calado. É o
- *               `agendarTique: atraso <= HORIZONTE` de `enqueuePublicacao`.
- *   `+ 5 s`     de folga: o tique tem de chegar DEPOIS de o item ficar elegível,
- *               e não no instante exato — a seleção do dreno pede
- *               `not_before <= now()`, e um tique adiantado por um milissegundo
- *               é uma drenagem que não acha nada.
- *
- * O TETO É APLICADO DEPOIS DA FOLGA, e essa é a única diferença para o
- * `enqueue` — de propósito, e pela lição já escrita em `armarTiquesDoDia` e no
- * rodapé do dreno: com a hora nova na borda exata do horizonte, `distância + 5`
- * entregaria 86405 s, CINCO SEGUNDOS além do horizonte que este projeto declarou
- * nunca ultrapassar. Os cinco segundos não se perdem — um tique cinco segundos
- * cedo acorda uma drenagem que não acha nada, e a seguinte acha.
- *
- * O `horizonteEmSegundos` É PARÂMETRO porque a constante mora em `lib/qstash.ts`,
- * que é `server-only`, e este arquivo é lido pelo enviador no NAVEGADOR (ver o
- * cabeçalho). Quem passa o número é a ação, que já é servidor.
- */
-export function atrasoDoTiqueDoRemarcar(
-  quando: Date,
-  agora: number,
-  horizonteEmSegundos: number
-): number | null {
-  const distancia = Math.round((quando.getTime() - agora) / 1000);
-  if (!Number.isFinite(distancia)) return null;
-  if (distancia <= 15) return null;
-  if (distancia > horizonteEmSegundos) return null;
-  return Math.min(distancia + 5, horizonteEmSegundos);
-}
-
 /**
  * O ATRASO, EM SEGUNDOS, DO TIQUE DE UMA PUBLICAÇÃO GRAVADA PELA HORA MARCADA —
  * ou `null` quando não há tique a armar (spec `docs/specs/2026-10-15-hora-marcada.md`).
@@ -1840,9 +1775,18 @@ export function atrasoDoTiqueDoRemarcar(
  * parada até a próxima drenagem de outra coisa — um webhook, ou o cron do dia
  * seguinte.
  *
- * O `horizonteEmSegundos` É PARÂMETRO pelo mesmo motivo de
- * `atrasoDoTiqueDoRemarcar`: a constante mora em `lib/qstash.ts`, que é
- * `server-only`, e este arquivo é lido no NAVEGADOR.
+ * O COMPOR E O REMARCAR USAM A MESMA FUNÇÃO. Até 09/09/2026 remarcar não
+ * armava tique nenhum: medido com um QStash falso, compor para +2 h gerava 1
+ * tique e remarcar gerava 0. O cron diário não cobria o buraco, porque
+ * `armarTiquesDoDia` só é honesta para `not_before` escrito ANTES da passagem
+ * dela, e remarcar move a hora para dentro de uma janela JÁ VARRIDA: o post
+ * podia sair ~23 h depois, calado. A função daquele conserto
+ * (`atrasoDoTiqueDoRemarcar`) media a distância pelo relógio da aplicação, e
+ * deu lugar a esta.
+ *
+ * O `horizonteEmSegundos` É PARÂMETRO porque a constante mora em
+ * `lib/qstash.ts`, que é `server-only`, e este arquivo é lido pelo enviador no
+ * NAVEGADOR (ver o cabeçalho). Quem passa o número é o servidor.
  */
 export function atrasoDoTiqueDaPublicacao(falta: number, horizonteEmSegundos: number): number | null {
   if (!Number.isFinite(falta) || falta <= 0) return null;
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx eslint app/publicar/post/actions.ts lib/publicacao.ts tests/publicacao.test.ts testes-integracao/agendados.integracao.ts testes-integracao/tique-do-rodape.integracao.ts
npx vitest run tests/publicacao.test.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/agendados.integracao.ts testes-integracao/tique-do-rodape.integracao.ts
```

Esperado: `tsc` e lint limpos; os 269 do arquivo puro passam (os 6 da função antiga saíram com ela); na integração, os 48 passam.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" app/publicar/post/actions.ts lib/publicacao.ts tests/publicacao.test.ts testes-integracao/agendados.integracao.ts testes-integracao/tique-do-rodape.integracao.ts
test "$(git branch --show-current)" = "hora-marcada"
git add app/publicar/post/actions.ts lib/publicacao.ts tests/publicacao.test.ts testes-integracao/agendados.integracao.ts testes-integracao/tique-do-rodape.integracao.ts
```

```bash
git commit -F - <<'MSG'
O remarcar grava a hora nova pela mesma regra do compor, e drena o que já vale

Remarcar para o minuto corrente gravava uma hora vencida sem dreno e sem
tique, e o post ficava parado (achado 99). O update passa a gravar
greatest(now(), hora nova) e a devolver o que o banco mediu: o que já vale
drena, como no compor, e o resto ganha o tique pela distância do banco. A
função antiga do tique do remarcar media pelo relógio da aplicação, e sai.
O erro do tique não derruba mais a ação depois da hora gravada (achado 101).
MSG
```

---

### FASE 5 — O comentário do horizonte, e a verificação inteira

**Arquivos:**
- Modificar: `lib/qstash.ts` (o comentário dos cinco lugares que pedem tique)

- [ ] **Passo 1: o comentário**

Em `lib/qstash.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/qstash.ts b/lib/qstash.ts
index 87364aa..66b374c 100644
--- a/lib/qstash.ts
+++ b/lib/qstash.ts
@@ -25,8 +25,12 @@ export function qstashEnabled(): boolean {
  * atrasos de até um dia — que é a faixa em que ele já funciona hoje, todo dia,
  * em produção.
  *
- * Quem respeita esta constante são os dois lugares que pedem tique com atraso
- * escolhido: `enqueue` (lib/engine.ts) e o rodapé de `drainQueue`.
+ * Quem respeita esta constante são os cinco lugares que pedem tique com atraso
+ * escolhido: `enqueue` e `enqueuePublicacao` (lib/engine.ts), o remarcar
+ * (app/publicar/post/actions.ts), o rodapé de `drainQueue` e
+ * `armarTiquesDoDia` (lib/queue-drain.ts). O `enqueue` foi o último a ganhar o
+ * teto, em 15/10/2026: a mensagem com espera de dois dias pedia 172805 s
+ * (achado 102).
  */
 export const HORIZONTE_DO_TIQUE_EM_SEGUNDOS = 24 * 60 * 60;
 
```

```bash
npx eslint lib/qstash.ts
node "$SCRATCH/varrer-texto.mjs" lib/qstash.ts
test "$(git branch --show-current)" = "hora-marcada"
git add lib/qstash.ts
```

```bash
git commit -F - <<'MSG'
O horizonte do QStash diz os cinco lugares que pedem tique com atraso

O comentário falava em dois lugares, e já eram quatro antes desta etapa: o
remarcar e a varredura do cron também pedem tique com atraso escolhido. A
publicação passou a ter o próprio, e o enqueue das mensagens foi o último a
respeitar o teto (achado 102).
MSG
```

- [ ] **Passo 2: o verify, na árvore do projeto**

```bash
env -u CLAUDECODE -u AI_AGENT npm run verify
git diff --stat AGENTS.md
```

Esperado: lint e `tsc` limpos; 117 arquivos e 3 212 casos puros e 23 arquivos e 203 de tela; a varredura "SEM VAZAMENTO
em A nem em C"; o build (Turbopack) com "MIGRAÇÃO PULADA" e as rotas `ƒ /publicar` e
`ƒ /publicar/agendados`; o `AGENTS.md` sem diferença.

- [ ] **Passo 3: a integração inteira, no container**

```bash
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npm run test:integracao
```

Esperado: `[rede-global] ALVO: banco de TESTE`; 45 arquivos, 505 passaram e 8 pularam (na base, 45 arquivos, 493 passaram e 8 pularam).

- [ ] **Passo 4: as provas de mutação**

Copie o script do Apêndice A para `$SCRATCH/mutar-hora.mjs` e rode, da raiz:

```bash
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" node "$SCRATCH/mutar-hora.mjs"
git status --short
```

Esperado: as 23 com ✓, "23 mutações, 0 ruins", e a árvore limpa depois (cada arquivo volta byte
a byte).

- [ ] **Passo 5: a guarda do diff e o `agendarTique`**

```bash
git diff --name-only af714d3 -- . ':!docs'
git grep -n "agendarTique" -- . ':!docs'
```

Esperado: a primeira lista só os 16 arquivos do mapa:

```text
app/bonus/publicar-actions.ts
app/publicar/actions.ts
app/publicar/post/actions.ts
lib/bonus/publicar-processo.ts
lib/engine.ts
lib/publicacao.ts
lib/qstash.ts
testes-integracao/agendados.integracao.ts
testes-integracao/bonus-imagem-processo.integracao.ts
testes-integracao/bonus-publicar-processo.integracao.ts
testes-integracao/publicacao.integracao.ts
testes-integracao/publicar-fala.integracao.ts
testes-integracao/tique-do-rodape.integracao.ts
tests/bonus-publicar-paginas.test.ts
tests/hora-marcada-guarda.test.ts
tests/publicacao.test.ts
```

e a segunda sai vazia (nenhum `agendarTique` no código nem nos testes).

- [ ] **Passo 6: avisar o auditor**, com o hash, os números e o pedido de conferir a branch antes do push.
  O push da branch e o PR só com o OK do Eduardo.

---

### FASE 6 — A prova real, no preview, com o Eduardo

Cada escrita em produção tem o OK do Eduardo, pela caixa, e a auditoria lê o banco antes e depois (avisada
com a hora). O preview usa o banco e o bucket de produção. **Sem post real e sem custo de IA. Sem migração.**
Os textos sugeridos para digitar passam antes pelo schema de cada campo (o mínimo e o máximo) e pela
auditoria.

- [ ] **Passo 1: a linha de base da auditoria**, só de leitura (a fila de publicação pendente, os
  carrosséis que existem e o registro das migrações, com 19).

- [ ] **Passo 2: o push da branch e o preview, com o OK do Eduardo**

Empurre só a branch (`git push origin refs/heads/hora-marcada:refs/heads/hora-marcada`). No log do build do
preview, confira o commit e "MIGRAÇÃO PULADA".

- [ ] **Passo 3: a prova, com o Eduardo na tela** (os passos da spec, "A prova real")

1. No `/publicar`, compor um post de imagem e agendar para daqui a 2 dias, às 10:00 (grava a imagem e a
   linha da fila). A auditoria confere que `not_before` é 13:00:00.000Z, exato.
2. Na lista de agendados, remarcar para o dia seguinte, às 10:00 (grava). A auditoria confere que a hora
   nova está exata.
3. Cancelar (grava `skipped`).
4. No gerador, criar um carrossel à mão ("Novo carrossel" → texto livre → "Escrever à mão", 1 slide em "Só
   texto", sem imagem e sem custo de IA) e agendar para daqui a 2 dias, às 10:00 (gravam). A auditoria
   confere que `not_before` é exato e que a frase é a de "agendado".
5. Cancelar no calendário (grava `skipped`).

No fim, o que a prova criou sai do banco e do bucket: o carrossel pela tela, se a Etapa 10 já estiver na
`main`, ou por um script, e o post do `/publicar` por um script. O Eduardo dá o OK, e a auditoria lê cada
script antes de ele rodar. Depois: o corpo do PR, conferido pela auditoria, e o PR com o OK do Eduardo. **O
merge é do Eduardo**, no GitHub, e o build do merge diz "Nada a aplicar: as 19 migrações".

---

## Apêndice A — as provas de mutação

O script roda da raiz do repositório, com a `DATABASE_URL_TESTES` do container (ele recusa sem ela). Cada
mutação tira uma proteção, roda o teste que a cobre e confere que o caso nomeado caiu; cada arquivo volta
byte a byte. Uma mutação pode ter mais de uma troca (`trocas`), quando a proteção mora em dois lugares do
mesmo arquivo (item 7 do ensaio).

```js
// Provas de mutação da hora marcada (achados 91, 99, 101 e 102). Cada mutação tira uma proteção e roda o
// teste que a cobre; o caso nomeado tem de cair. Cada arquivo volta byte a byte.
// Uso, da raiz do repositório: DATABASE_URL_TESTES=<container> node mutar-hora.mjs [filtro]
// As mutações INTEG rodam a suíte de integração, que sem DATABASE_URL_TESTES cai na DATABASE_URL, a da
// PRODUÇÃO (achado 68): sem a variável, o script recusa antes de mutar, e uma rodada INTEG que não imprime
// "ALVO: banco de TESTE" conta como ✗. Nenhuma mutação grava fora do container e dos servidores falsos.
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const PURA = (f) => `npx vitest run ${f}`;
const INTEG = (f) => `npx vitest run --config vitest.integracao.config.ts ${f}`;

const PUBLICACAO = "lib/publicacao.ts";
const MOTOR = "lib/engine.ts";
const COMPOR = "app/publicar/actions.ts";
const REMARCAR = "app/publicar/post/actions.ts";
const PROCESSO = "lib/bonus/publicar-processo.ts";
const ACOES_DO_GERADOR = "app/bonus/publicar-actions.ts";

const T_PURA = PURA("tests/publicacao.test.ts");
const T_GUARDA = PURA("tests/hora-marcada-guarda.test.ts");
const T_PAGINAS = PURA("tests/bonus-publicar-paginas.test.ts");
const T_TIQUE = INTEG("testes-integracao/tique-do-rodape.integracao.ts");
const T_PROCESSO = INTEG("testes-integracao/bonus-publicar-processo.integracao.ts");
const T_FALA = INTEG("testes-integracao/publicar-fala.integracao.ts");
const T_AGENDADOS = INTEG("testes-integracao/agendados.integracao.ts");
const T_GATILHO = INTEG("testes-integracao/gatilho-entrega.integracao.ts");

// O CÓDIGO DE ANTES DE 15/10, as duas metades: o SQL soma uma duração ao now() do banco, e a duração é medida
// contra Date.now() e arredondada. É a mutação que devolve o defeito do achado 91 inteiro.
const DURACAO_DE_ANTES = [
  ["greatest(now(), coalesce($4::timestamptz, now()))", "now() + make_interval(secs => $4::int)"],
  [
    "      quando,\n    ]\n  )) as { id: string; ja_vale: boolean; falta: number }[];",
    "      quando ? Math.max(0, Math.round((quando.getTime() - Date.now()) / 1000)) : 0,\n    ]\n  )) as { id: string; ja_vale: boolean; falta: number }[];",
  ],
];

const MUTACOES = [
  // FASE 1: a decisão pura do tique
  { nome: "1: volta o piso de 15 s (achado 99)", arq: PUBLICACAO,
    de: "  if (!Number.isFinite(falta) || falta <= 0) return null;",
    para: "  if (!Number.isFinite(falta) || falta <= 15) return null;",
    cmd: T_PURA, caso: "perto arma, sem o piso de 15 s (achado 99)" },
  { nome: "1: o teto antes da folga some (achado 102)", arq: PUBLICACAO,
    de: "  return Math.min(falta + 5, horizonteEmSegundos);",
    para: "  return falta + 5;",
    cmd: T_PURA, caso: "na borda do horizonte o atraso NAO passa de um dia (achado 102)" },
  { nome: "1: o que já vale arma", arq: PUBLICACAO,
    de: "  if (!Number.isFinite(falta) || falta <= 0) return null;",
    para: "  if (!Number.isFinite(falta) || falta < 0) return null;",
    cmd: T_PURA, caso: "o que ja vale NAO arma: quem drena e quem enfileirou" },
  // FASE 2: o motor
  { nome: "2: o greatest vaza para o INSERT das mensagens (a guarda)", arq: MOTOR,
    de: "values ($1, $2, $3, $4, $5, $6, $7, now() + make_interval(secs => $8::int))",
    para: "values ($1, $2, $3, $4, $5, $6, $7, greatest(now(), now() + make_interval(secs => $8::int)))",
    cmd: T_GUARDA, caso: "o INSERT das mensagens continua somando o atraso no relógio do banco" },
  { nome: "2: as mensagens perdem a espera (T7)", arq: MOTOR,
    de: "values ($1, $2, $3, $4, $5, $6, $7, now() + make_interval(secs => $8::int))",
    para: "values ($1, $2, $3, $4, $5, $6, $7, greatest(now(), now() + make_interval(secs => $8::int) * 0))",
    cmd: T_GATILHO, caso: "A ESPERA DO EDITOR SEGURA O QUE VEM DEPOIS" },
  { nome: "2: a publicação sem o greatest (a guarda)", arq: MOTOR,
    de: "greatest(now(), coalesce($4::timestamptz, now()))",
    para: "coalesce($4::timestamptz, now())",
    cmd: T_GUARDA, caso: "só a publicação grava a hora absoluta, e uma vez só no motor" },
  { nome: "2: o passado não vira agora", arq: MOTOR,
    de: "greatest(now(), coalesce($4::timestamptz, now()))",
    para: "coalesce($4::timestamptz, now())",
    cmd: T_TIQUE, caso: "o banco diz se o item já vale e quanto falta, e o passado vira agora" },
  { nome: "2: a duração de antes, pelo relógio da aplicação (T1)", arq: MOTOR, trocas: DURACAO_DE_ANTES,
    cmd: T_TIQUE, caso: "a hora gravada é a marcada, ao milissegundo" },
  { nome: "2: a duração de antes, pelo relógio da aplicação (T2)", arq: MOTOR, trocas: DURACAO_DE_ANTES,
    cmd: T_TIQUE, caso: "o relógio da aplicação adiantado não muda a hora gravada" },
  { nome: "2: a duração de antes, pelo relógio da aplicação (o gerador)", arq: MOTOR, trocas: DURACAO_DE_ANTES,
    cmd: T_PROCESSO, caso: "agendado: entra com a hora pedida, e não drena" },
  { nome: "2: o tique da publicação sem o teto (achado 102)", arq: MOTOR,
    de: "jaVale ? null : atrasoDoTiqueDaPublicacao(falta, HORIZONTE_DO_TIQUE_EM_SEGUNDOS)",
    para: "jaVale ? null : falta + 5",
    cmd: T_TIQUE, caso: "na borda de um dia, o tique pedido é o horizonte, e não 86405 s (achado 102)" },
  { nome: "2: o tique da publicação volta ao piso (achado 99)", arq: MOTOR,
    de: "jaVale ? null : atrasoDoTiqueDaPublicacao(falta, HORIZONTE_DO_TIQUE_EM_SEGUNDOS)",
    para: "jaVale || falta <= 15 ? null : atrasoDoTiqueDaPublicacao(falta, HORIZONTE_DO_TIQUE_EM_SEGUNDOS)",
    cmd: T_TIQUE, caso: "a menos de 15 s, o tique sai: o post não fica parado (achado 99)" },
  { nome: "2: sem o try do tique (achado 101, o motor)", arq: MOTOR,
    de: "    try {\n      const config = await getConfig();\n      await scheduleTick(config.app_url ?? \"\", atrasoDoTique);\n    } catch {\n      // Calado de propósito: o post está na fila, e é isso que a tela diz.\n    }",
    para: "    const config = await getConfig();\n    await scheduleTick(config.app_url ?? \"\", atrasoDoTique);",
    cmd: T_TIQUE, caso: "um erro no tique depois do insert não desfaz o que entrou (achado 101)" },
  { nome: "2: sem o try do tique (achado 101, o gerador)", arq: MOTOR,
    de: "    try {\n      const config = await getConfig();\n      await scheduleTick(config.app_url ?? \"\", atrasoDoTique);\n    } catch {\n      // Calado de propósito: o post está na fila, e é isso que a tela diz.\n    }",
    para: "    const config = await getConfig();\n    await scheduleTick(config.app_url ?? \"\", atrasoDoTique);",
    cmd: T_PROCESSO, caso: "um erro no tique depois de enfileirar não apaga a mídia do post (achado 101)" },
  { nome: "2: o tique das mensagens sem o teto (achado 102)", arq: MOTOR,
    de: "Math.min(atraso + 5, HORIZONTE_DO_TIQUE_EM_SEGUNDOS)",
    para: "atraso + 5",
    cmd: T_TIQUE, caso: "a mensagem que espera dois dias pede o tique do horizonte, e não 172805 s" },
  // FASE 3: os chamadores
  { nome: "3: o compor drena só o agora (achado 99)", arq: COMPOR,
    de: "  if (r.jaVale) {\n    try {\n      await drainQueue();",
    para: "  if (momento.quando === null) {\n    try {\n      await drainQueue();",
    cmd: T_FALA, caso: "o 'depois' no minuto corrente sai na hora, como o 'agora'" },
  { nome: "3: a frase do compor ecoa a hora que já passou", arq: COMPOR,
    de: "avisoDaPublicacaoEnfileirada(r.jaVale ? null : campos)",
    para: "avisoDaPublicacaoEnfileirada(momento.quando ? campos : null)",
    cmd: T_FALA, caso: "o 'depois' no minuto corrente sai na hora, como o 'agora'" },
  { nome: "3: o gerador drena só o agora (achado 99)", arq: PROCESSO,
    de: "  if (r.jaVale) {\n    try {\n      await drenar();",
    para: "  if (p.quando === null) {\n    try {\n      await drenar();",
    cmd: T_PROCESSO, caso: "no minuto corrente: entra valendo, e drena como o agora (achado 99)" },
  { nome: "3: a frase do gerador volta à hora pedida", arq: ACOES_DO_GERADOR,
    de: "textoDaPublicacaoMandada(!r.jaVale)",
    para: "textoDaPublicacaoMandada(r.quando !== null)",
    cmd: T_PAGINAS, caso: "a frase de agendado vem do jaVale do banco, e não da hora pedida" },
  // FASE 4: o remarcar
  { nome: "4: o remarcar não drena (achado 99)", arq: REMARCAR,
    de: "        await drainQueue();\n      } catch {\n        // A trava atômica garante que o próximo dreno recupera, como no compor.",
    para: "        await Promise.resolve();\n      } catch {\n        // A trava atômica garante que o próximo dreno recupera, como no compor.",
    cmd: T_AGENDADOS, caso: "remarcar para o minuto corrente sai no dreno, como o compor" },
  { nome: "4: o remarcar grava a hora vencida", arq: REMARCAR,
    de: "set not_before = greatest(now(), $3::timestamptz)",
    para: "set not_before = $3::timestamptz",
    cmd: T_AGENDADOS, caso: "remarcar para o minuto corrente sai no dreno, como o compor" },
  { nome: "4: sem o try do tique do remarcar (achado 101)", arq: REMARCAR,
    de: "        try {\n          await scheduleTick((await getConfig()).app_url ?? \"\", atrasoDoTique);\n        } catch {\n          // Calado de propósito: a hora nova está gravada, e é isso que a tela diz.\n        }",
    para: "        await scheduleTick((await getConfig()).app_url ?? \"\", atrasoDoTique);",
    cmd: T_TIQUE, caso: "um erro no tique nao derruba o remarcar (achado 101)" },
  { nome: "4: o tique do remarcar ignora o horizonte", arq: REMARCAR,
    de: "      const atrasoDoTique = atrasoDoTiqueDaPublicacao(falta, HORIZONTE_DO_TIQUE_EM_SEGUNDOS);",
    para: "      const atrasoDoTique = falta + 5;",
    cmd: T_TIQUE, caso: "remarcar para alem do horizonte NAO arma tique — quem arma e o cron" },
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
  // UMA MUTAÇÃO PODE TER MAIS DE UMA TROCA (`trocas`), quando a proteção mora em dois lugares do mesmo
  // arquivo: a duração de antes é o SQL e o parâmetro juntos.
  let mutado = texto;
  let achou = true;
  for (const [de, para] of m.trocas ?? [[m.de, m.para]]) {
    const n = mutado.split(fim(de)).length - 1;
    if (n !== 1) {
      console.log(`✗ ${m.nome}: o trecho aparece ${n} vez(es): ${de.slice(0, 60)}`);
      achou = false;
      break;
    }
    mutado = mutado.replace(fim(de), () => fim(para));
  }
  if (!achou) {
    ruins++;
    continue;
  }
  writeFileSync(m.arq, mutado, "utf8");
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
