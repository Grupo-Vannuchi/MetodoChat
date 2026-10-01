# Gerador de bônus — Plano de implementação da Etapa 3: a arte do carrossel

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: `superpowers:subagent-driven-development`
> (recomendada) ou `superpowers:executing-plans`, fase por fase. Os passos usam caixa de
> seleção (`- [ ]`) para acompanhar.

**Objetivo:** na página do carrossel pronto, cada slide aparece desenhado como no Método Labs (a
"capa branca com os textos", PNG de 1080×1350, com o cabeçalho da conta do Instagram), o operador
escolhe "com espaço para a imagem" ou "só texto" em cada slide, vê o aviso "não cabe" enquanto
edita, e baixa os slides, um a um ou todos, para pôr as imagens no Canva. A etapa abre com os
achados 57 e 58.

**Arquitetura:** a arte é desenhada no servidor, por uma rota GET (`/bonus/[id]/carrossel/[cid]/arte?slide=N`)
que confere a sessão, lê o texto salvo e as escolhas da coluna nova `arte` (migração 015), busca
a foto da conta com travas e devolve o PNG pelo `ImageResponse` de `next/og`, com a Carlito lida
do disco e `Cache-Control: private, no-store`. A geometria, os degraus de fonte e o desenho vêm do
Labs, com quatro diferenças. Na tela, um componente de navegador junta o editor da Etapa 2 e a
grade das miniaturas: o "não cabe" é a mesma conta da arte, feita sobre o que está nos campos, e a
miniatura troca pela versão na URL, sem redirect nem `router.refresh`.

**Stack:** a das etapas anteriores, no Next.js 16.3.8 (PR #4): App Router, Server Actions com
`useActionState`, `next/og` (Satori + Resvg), React 19, Postgres (postgres.js via `lib/db.ts`),
`zod` 4, Vitest (três suítes), Tailwind v4 com os tokens de `app/ui.ts`.

**Spec:** `docs/specs/2026-10-01-arte-do-carrossel.md` (commits `969abfd`, `f44767c` e `8572859`,
rebaseados sobre `dd54ca5`). Leia antes de começar: este plano não repete o porquê das regras, só
como construí-las.

**Ensaio do plano (01/10):** o código deste plano foi escrito e testado fase a fase numa cópia
isolada do repositório (`git worktree`, branch local `ensaio-arte-2`, sem push), e todo bloco de
código abaixo foi tirado do git dessa cópia por um gerador, sem cópia à mão. Os números do ensaio:
- lint e `tsc` limpos; 89 arquivos e 2 398 casos puros; 19 arquivos e 114 casos de tela;
- `next build --webpack` limpo, com `ƒ /bonus/[id]/carrossel/[cid]/arte` na lista;
- integração no container: 37 arquivos, 308 passaram e 8 pularam. Na cópia, o
  `registro-de-migracoes` só passou com um `.env.local` **vazio**: o `migrar.mjs --a-mao` exige o
  arquivo como prova de estar na máquina de alguém, e lê a URL do banco do ambiente antes dele. Na
  árvore do projeto o `.env.local` existe, e nada disso muda;
- as 19 provas de mutação do Apêndice A derrubaram, cada uma, o caso esperado;
- os PNGs de amostra foram olhados: Carlito, hierarquia por peso, lista de hífens uma por linha, a
  tag no pé do último slide, o espaço da imagem em branco.

O ensaio achou quatro coisas, já resolvidas neste plano:
1. **O aviso "não cabe" do Labs media só o corpo, e a arte media a manchete e o corpo.** O aviso
   calava com a peça cortando (8 linhas de 20 caracteres: 359px no aviso, 404px na arte, limite de
   382). Aqui os dois medem `textoMedido`. O DEV do Labs reproduziu com as funções de lá e
   consertou na `dev` deles (`1254847`), com a mesma forma e aparando a manchete; o Chat apara
   também.
2. **O pior caso do schema de um slide de conteúdo não cabe em modo nenhum** (manchete de 70 e
   corpo de 300, em caixa alta): sem o espaço da imagem o piso também sobe (34 × 1,6 = 54px), e dá
   998px dos 955. O aviso diz "corta sempre", e o operador encurta. Um slide do tamanho que a
   instrução pede cabe com folga.
3. **A guarda de achado 60 lia os comentários.** Os arquivos citam `listAccounts` e
   `getSelectedAccount` para dizer por que não os usam; a guarda ignora linhas de comentário.
4. **As recusas da rota com sessão não tinham teste.** O harness da integração não forja cookie
   (de propósito), então a rota só se prova sem sessão. O dono, o "pronto" e a faixa do slide
   passaram para `conferirPedidoDaArte` (arte-tela.ts), com um caso por recusa e uma mutação.

## Restrições globais

Valem para todas as fases, sem precisar repetir em cada uma.

- **Branch:** `arte-do-carrossel`, rebaseada sobre a `main` em `dd54ca5` (o PR #4, Next 16.3.8, e
  o PR #5 já mergeados). Nunca commitar nem empurrar na `main`: ela não tem proteção e um push
  dispara deploy de produção. Conferir `git branch --show-current` antes de cada commit, e
  `git ls-remote origin refs/heads/main` no começo de cada fase.
- **`git add` com caminho explícito.** Nunca `-A` nem `.`: mais de uma sessão usa esta árvore.
- **Conventional Commits, em português.** Sem `Co-Authored-By` e sem rodapé de IA. Autor:
  Eduardo Kobal <162614913+Eduardokobal@users.noreply.github.com>.
- **Antes de cada commit**, varrer os arquivos de TEXTO tocados com
  `node "$SCRATCH/varrer-texto.mjs" <arquivos>`, em que `$SCRATCH` é o scratchpad da sessão. Os
  `.ttf` são binários e ficam fora da varredura. Se o scratchpad não existir mais, recrie o script
  a partir do apêndice A do plano da Etapa 1 (`docs/plans/2026-09-29-gerador-de-bonus.md`).
- **Fim de linha:** com `core.autocrlf=true`, a cópia de trabalho dos arquivos que já existem está
  em CRLF. Os diffs deste plano estão em LF: aplique com `git apply --ignore-whitespace` ou à mão,
  e varra depois. Se a varredura acusar fim de linha misturado, converta a cópia inteira para LF.
- **Pasta própria:** `app/bonus/` e `lib/bonus/`. Fora delas, só: `migrations/015-arte-do-carrossel.sql`,
  `lib/esquema.ts` (1 entrada em `naoObservaveis`), testes novos e `docs/`. Os arquivos das etapas
  anteriores que mudam estão no Mapa dos arquivos, com a fase.
- **Sufixo de teste é o que decide se ele roda:** `tests/**/*.test.ts` (puro, entra no `verify`),
  `testes-integracao/**/*.integracao.ts` (banco, fora do `verify`), `testes-dom/**/*.dom.tsx`
  (tela, entra no `verify`). Linha de base em `dd54ca5`: 80 arquivos / 2 235 casos puros; 17 / 103
  de tela; 36 arquivos de integração (302 e 8 pulados).
- **A suíte de integração só roda com `DATABASE_URL_TESTES`** apontando para o container
  (`127.0.0.1:5434`, `npm run banco:teste`). Toda rodada tem de imprimir
  `[rede-global] ALVO: banco de TESTE`. Se imprimir outra coisa, pare. Nunca rode com a variável
  vazia: ela cai na `DATABASE_URL`, que é **produção**.
- **`next dev` sem as variáveis de agente.** Na 16.3, o `next dev` reescreve o bloco gerenciado do
  `AGENTS.md` quando detecta um agente de IA (`generate-agent-files.js`). Rode com
  `env -u CLAUDECODE -u AI_AGENT ...` e confira `git diff AGENTS.md` depois: ele não muda.
- **Telas:** só os tokens de `app/ui.ts` e os degraus de `app/escala.ts`; nada de `indigo`,
  `violet` nem `purple`. `tests/escala.test.ts` e `tests/paleta.test.ts` varrem todo `app/`.
- **Segredo** nunca vai para código, log, mensagem, commit ou saída de terminal.
- **Escrita em produção só com o OK do Eduardo:** a `015` (FASE 3.10) e qualquer gravação da prova
  real. O preview usa o banco de produção: lá, "Salvar revisão", "Existe / Não existe" e as
  escolhas da arte gravam em produção.
- **Ao fechar cada fase**, avisar o auditor (sessão `metodochat-cd` em 01/10; conferir o nome no
  `ListAgents`, porque ele muda a cada reinício) com o hash e o que conferir. Não esperar a
  resposta para seguir.

## Mapa dos arquivos

| arquivo | responsabilidade | fase |
|---|---|---|
| `lib/bonus/publicado.ts`, `lib/bonus/carrossel-textos.ts` | `sem_palavra`, `sem_tema`, `palavra_fora_do_padrao` e as frases (achados 57 e 58) | 3.1 |
| `lib/bonus/arte-geometria.ts` | a geometria da peça, do Labs, sem mudar uma linha | 3.2 |
| `lib/bonus/arte-slides.ts` | os slides, os degraus e o "não cabe", do Labs, medindo `textoMedido` | 3.2 |
| `lib/bonus/fonte/` (2 `.ttf` e `OFL.txt`) | a Carlito, sem modificação, com a licença | 3.3 |
| `lib/bonus/arte-fonte.ts` | a fonte lida do disco (`server-only`) | 3.3 |
| `migrations/015-arte-do-carrossel.sql`, `lib/esquema.ts` (1 entrada) | a coluna `arte` | 3.4 |
| `lib/bonus/arte-escolhas.ts` | as escolhas da arte: ler do banco e do formulário | 3.4, 3.7 |
| `lib/bonus/arte-conta.ts` | qual conta vai no cabeçalho, e as iniciais | 3.4 |
| `lib/bonus/carrossel-linha.ts`, `lib/bonus/carrossel-repositorio.ts` | a coluna na linha; a conta no pedido; gravar as escolhas; ler as contas sem o token | 3.4 |
| `app/bonus/carrossel-actions.ts` | a conta no pedido (3.4); `salvarArteDoCarrossel` (3.7) | 3.4, 3.7 |
| `lib/bonus/arte-foto.ts` | a foto da conta, com as travas | 3.5 |
| `lib/bonus/arte-tela.ts`, `lib/bonus/arte-textos.ts` | o que a rota e a tela decidem; as frases | 3.6 a 3.8 |
| `lib/bonus/arte-desenho.tsx`, `lib/bonus/arte-resposta.tsx` | o desenho do slide; o PNG com a fonte e os cabeçalhos | 3.6 |
| `app/bonus/[id]/carrossel/[cid]/arte/route.tsx` | a rota da arte | 3.6 |
| `lib/bonus/arte-cabimento.ts` | o "não cabe" sobre os campos | 3.8 |
| `app/bonus/[id]/carrossel/[cid]/arte-do-carrossel.tsx`, `.../editor-do-carrossel.tsx` | a seção da arte; o editor que junta tudo | 3.8 |
| `.../formulario-da-revisao.tsx`, `.../campo.tsx`, `.../page.tsx` | os avisos novos no formulário e no campo; a página usa o editor | 3.8 |

---

## ETAPA 3 — a arte do carrossel

### FASE 3.0 — Começar da main certa

- [ ] **Passo 1: conferir a main e a branch**

```bash
git ls-remote origin refs/heads/main
git switch arte-do-carrossel
git log --oneline -4
node -e 'console.log(require("./node_modules/next/package.json").version)'
```

Esperado: a `main` em `dd54ca5` (ou depois dele); a branch com os três commits da spec e este
plano sobre `dd54ca5`; o `node_modules` na 16.3.8. Se a `main` andou, rebaseie a branch nela antes
de seguir (`git fetch origin main && git rebase origin/main`), e rode `npm ci` se o lock mudou.

- [ ] **Passo 2: a linha de base**

```bash
npm test
npm run test:dom
npm run banco:teste
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npm run test:integracao
```

Esperado: 80 arquivos / 2 235 casos puros; 17 / 103 de tela; `[rede-global] ALVO: banco de
TESTE`, 36 arquivos, 302 passaram e 8 pularam.

---

### FASE 3.1 — Os achados 57 e 58

**Arquivos:**
- Modificar: `lib/bonus/publicado.ts`, `lib/bonus/carrossel-textos.ts`
- Testar: `tests/bonus-publicado.test.ts`, `tests/bonus-carrossel-textos.test.ts`

**Interfaces:**
- Produz: `SituacaoNoLabs` ganha `{ tipo: "sem_palavra" }`, `{ tipo: "sem_tema" }` e
  `{ tipo: "palavra_fora_do_padrao"; palavra: string }`; `TEMA_DO_LABS_MAX = 120`;
  `quadroDaSituacao` dá frase em tom de atenção a cada um.

- [ ] **Passo 1: os testes**

Em `tests/bonus-publicado.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-publicado.test.ts b/tests/bonus-publicado.test.ts
index 23a3095..76080df 100644
--- a/tests/bonus-publicado.test.ts
+++ b/tests/bonus-publicado.test.ts
@@ -30,18 +30,54 @@ describe("a situação de um bônus na lista pública do Labs", () => {
   });
 
   it.each([
-    ["palavra minúscula", { palavraChave: "sumido" }],
-    ["palavra com espaço", { palavraChave: "SUMI DO" }],
-    ["palavra longa demais", { palavraChave: "X".repeat(31) }],
-    ["sem palavra", { palavraChave: undefined }],
+    ["palavra que não é texto", { palavraChave: 7 }],
+    ["palavra além do teto do Labs (80)", { palavraChave: "X".repeat(81) }],
     ["sem título", { titulo: "" }],
-    ["tema longo demais", { tema: "x".repeat(81) }],
+    ["tema além do teto do Labs (120)", { tema: "x".repeat(121) }],
+    ["tema que não é texto", { tema: 7 }],
     ["descrição que não é texto", { descricao: 7 }],
   ])("%s é formato estranho, e nunca publicado", (_nome, troca) => {
     expect(situacaoNaLista({ items: [{ ...ITEM, ...troca }] }, ITEM.codigo)).toEqual({ tipo: "formato_estranho" });
   });
 });
 
+// O LABS PUBLICA BÔNUS SEM PALAVRA OU SEM TEMA (achado 57): os dois campos são opcionais no
+// contrato e vêm como chave AUSENTE (site-ia 7971720). E aceita palavra de até 80 caracteres, com
+// espaço ou hífen, que o Chat recusa (achado 58). Quem resolve é o operador, no /admin do Labs, e
+// a tela diz isso em vez de "formato estranho". Nenhum dos três libera o carrossel.
+describe("o bônus publicado que o Chat não consegue usar", () => {
+  it.each([
+    ["chave ausente", { palavraChave: undefined }],
+    ["texto vazio", { palavraChave: "" }],
+    ["só espaço", { palavraChave: "   " }],
+    ["sem palavra E sem tema", { palavraChave: undefined, tema: undefined }],
+  ])("sem palavra-chave (%s)", (_nome, troca) => {
+    expect(situacaoNaLista({ items: [{ ...ITEM, ...troca }] }, ITEM.codigo)).toEqual({ tipo: "sem_palavra" });
+  });
+
+  it.each([
+    ["chave ausente", { tema: undefined }],
+    ["texto vazio", { tema: "" }],
+  ])("sem tema (%s)", (_nome, troca) => {
+    expect(situacaoNaLista({ items: [{ ...ITEM, ...troca }] }, ITEM.codigo)).toEqual({ tipo: "sem_tema" });
+  });
+
+  it.each(["SUMI DO", "SEM-DOR", "X".repeat(31), "sumido", "AB"])("palavra fora do padrão do Chat: %s", (palavra) => {
+    expect(situacaoNaLista({ items: [{ ...ITEM, palavraChave: palavra }] }, ITEM.codigo)).toEqual({
+      tipo: "palavra_fora_do_padrao",
+      palavra,
+    });
+  });
+
+  it("o tema de 120 caracteres, o teto do Labs, passa: no carrossel ele só vai para a mensagem à IA", () => {
+    const tema = "t".repeat(120);
+    expect(situacaoNaLista({ items: [{ ...ITEM, tema }] }, ITEM.codigo)).toEqual({
+      tipo: "publicado",
+      bonus: { palavra: "SUMIDO", titulo: ITEM.titulo, tema, descricao: ITEM.descricao },
+    });
+  });
+});
+
 describe("a leitura da lista pelo Chat", () => {
   const resposta = (status: number, corpo: unknown) =>
     new Response(typeof corpo === "string" ? corpo : JSON.stringify(corpo), { status });
```

Em `tests/bonus-carrossel-textos.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-carrossel-textos.test.ts b/tests/bonus-carrossel-textos.test.ts
index 2f864d4..5ce3514 100644
--- a/tests/bonus-carrossel-textos.test.ts
+++ b/tests/bonus-carrossel-textos.test.ts
@@ -26,6 +26,9 @@ describe("as frases do carrossel", () => {
     const situacoes: SituacaoNoLabs[] = [
       { tipo: "publicado", bonus: { palavra: "SUMIDO", titulo: "t", descricao: "d", tema: "Vendas" } },
       { tipo: "nao_publicado" },
+      { tipo: "sem_palavra" },
+      { tipo: "sem_tema" },
+      { tipo: "palavra_fora_do_padrao", palavra: "SEM DOR" },
       { tipo: "sem_resposta" },
       { tipo: "formato_estranho" },
       { tipo: "sem_config" },
@@ -38,6 +41,24 @@ describe("as frases do carrossel", () => {
     expect(quadroDaSituacao(situacoes[0]).texto).toContain("SUMIDO");
   });
 
+  // ACHADOS 57 E 58: o Labs respondeu no formato do contrato, e quem resolve é o operador, no
+  // /admin do Labs. A frase diz ONDE agir, e não "avise quem cuida do Labs".
+  it("o bônus sem palavra, sem tema ou com palavra fora do padrão diz o que fazer no /admin do Labs", () => {
+    expect(quadroDaSituacao({ tipo: "sem_palavra" })).toEqual({
+      tom: "atencao",
+      texto: "Este bônus está publicado no Labs sem palavra-chave. Cadastre uma no /admin do Labs para gerar carrossel.",
+    });
+    expect(quadroDaSituacao({ tipo: "sem_tema" })).toEqual({
+      tom: "atencao",
+      texto: "Este bônus está publicado no Labs sem tema. Cadastre um no /admin do Labs para gerar carrossel.",
+    });
+    expect(quadroDaSituacao({ tipo: "palavra_fora_do_padrao", palavra: "SEM DOR" })).toEqual({
+      tom: "atencao",
+      texto:
+        "A palavra-chave deste bônus no Labs é SEM DOR, e o Chat só aceita letras e números, sem espaço, de 3 a 30. Troque no /admin do Labs para gerar carrossel.",
+    });
+  });
+
   it("cada falha da conferência diz o que fazer", () => {
     expect(textoDaConferencia({ motivo: "slides", vieram: 7, esperados: 8 }, "SUMIDO")).toContain(
       "Vieram 7 slides de conteúdo, e o pedido era 8"
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-publicado.test.ts tests/bonus-carrossel-textos.test.ts
```

Esperado: 14 casos caem (os 12 novos da situação e os 2 das frases). Os casos de
`formato_estranho` que ficaram passam, inclusive o da palavra além de 80.

- [ ] **Passo 3: o código**

Em `lib/bonus/publicado.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/publicado.ts b/lib/bonus/publicado.ts
index ae09d89..c66578e 100644
--- a/lib/bonus/publicado.ts
+++ b/lib/bonus/publicado.ts
@@ -9,7 +9,7 @@
 // lá depois do envio (o primeiro bônus de 30/09 foi enviado com ZZTESTECHAT e publicado com
 // SUMIDO).
 import { lerAteOTeto, urlDaPorta } from "./labs";
-import { palavraValida, TEMA_MAX } from "./pedido";
+import { palavraValida } from "./pedido";
 
 /**
  * O TETO DA LISTA, próprio. A lista de produção tinha 20 158 bytes em 30/09 (58 bônus, uns 337
@@ -22,11 +22,27 @@ export const LISTA_MAX_BYTES = 512 * 1024;
 const TITULO_MAX = 220;
 const DESCRICAO_MAX = 1200;
 
+/**
+ * Os tetos do Labs para a palavra e o tema de um bônus (site-ia, src/lib/bonus-escrita.ts:68-69:
+ * `keyword` até 80, `theme` até 120). São MAIORES que os do pedido do Chat (30 e 80), e um bônus
+ * publicado lá dentro deles está no formato certo (achado 58).
+ */
+const PALAVRA_DO_LABS_MAX = 80;
+export const TEMA_DO_LABS_MAX = 120;
+
 export type BonusPublicado = { palavra: string; titulo: string; descricao: string; tema: string };
 
+/**
+ * `sem_palavra`, `sem_tema` e `palavra_fora_do_padrao` são bônus publicados no FORMATO DO CONTRATO
+ * que o Chat não consegue usar (achados 57 e 58): quem resolve é o operador, no /admin do Labs, e
+ * a tela diz isso. Nenhum deles libera o carrossel.
+ */
 export type SituacaoNoLabs =
   | { tipo: "publicado"; bonus: BonusPublicado }
   | { tipo: "nao_publicado" }
+  | { tipo: "sem_palavra" }
+  | { tipo: "sem_tema" }
+  | { tipo: "palavra_fora_do_padrao"; palavra: string }
   | { tipo: "sem_resposta" }
   | { tipo: "formato_estranho" }
   | { tipo: "sem_config" };
@@ -37,6 +53,14 @@ function textoAte(v: unknown, max: number): string | null {
   return t && t.length <= max ? t : null;
 }
 
+/**
+ * O Labs manda o campo opcional sem valor como chave AUSENTE (contrato, site-ia 7971720). Texto em
+ * branco conta como ausente. `null` não é o contrato, e fica em `formato_estranho`.
+ */
+function ausente(v: unknown): boolean {
+  return v === undefined || (typeof v === "string" && v.trim() === "");
+}
+
 export function situacaoNaLista(corpo: unknown, slug: string): SituacaoNoLabs {
   const itens =
     corpo !== null && typeof corpo === "object" && !Array.isArray(corpo)
@@ -50,12 +74,23 @@ export function situacaoNaLista(corpo: unknown, slug: string): SituacaoNoLabs {
   );
   if (!item) return { tipo: "nao_publicado" };
 
-  // A palavra entra EXATAMENTE como o Labs a tem: a chamada tem de pedir essa grafia.
-  const palavra = typeof item.palavraChave === "string" ? item.palavraChave : "";
+  // Faltando a palavra e o tema, vale a palavra: sem ela, nenhuma chamada tem o que pedir.
+  if (ausente(item.palavraChave)) return { tipo: "sem_palavra" };
+  if (typeof item.palavraChave !== "string" || item.palavraChave.length > PALAVRA_DO_LABS_MAX) {
+    return { tipo: "formato_estranho" };
+  }
+  // A palavra entra EXATAMENTE como o Labs a tem: a chamada tem de pedir essa grafia. A
+  // conferência da chamada depende de letras e números sem espaço (`palavraValida`).
+  const palavra = item.palavraChave;
+  if (!palavraValida(palavra)) return { tipo: "palavra_fora_do_padrao", palavra };
+  if (ausente(item.tema)) return { tipo: "sem_tema" };
+
+  // O tema vai até o teto do Labs, e não até o do pedido do Chat: no carrossel ele só entra
+  // como contexto na mensagem à IA (carrossel-ia-parametros.ts).
+  const tema = textoAte(item.tema, TEMA_DO_LABS_MAX);
   const titulo = textoAte(item.titulo, TITULO_MAX);
   const descricao = textoAte(item.descricao, DESCRICAO_MAX);
-  const tema = textoAte(item.tema, TEMA_MAX);
-  if (!palavraValida(palavra) || !titulo || !descricao || !tema) return { tipo: "formato_estranho" };
+  if (!titulo || !descricao || !tema) return { tipo: "formato_estranho" };
   return { tipo: "publicado", bonus: { palavra, titulo, descricao, tema } };
 }
 
```

Em `lib/bonus/carrossel-textos.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/carrossel-textos.ts b/lib/bonus/carrossel-textos.ts
index e183163..30950a0 100644
--- a/lib/bonus/carrossel-textos.ts
+++ b/lib/bonus/carrossel-textos.ts
@@ -3,6 +3,7 @@
 import type { Aviso } from "@/lib/avisos";
 import { SLIDES_MAX, SLIDES_MIN, TETO_CARROSSEL_DIARIO, type RecusaDoPedidoDeCarrossel } from "./carrossel-pedido";
 import { camposDoFormulario, type FalhaDaConferencia } from "./carrossel-texto";
+import { PALAVRA_MAX, PALAVRA_MIN } from "./pedido";
 import type { SituacaoNoLabs } from "./publicado";
 import type { TomDoQuadro } from "./textos";
 
@@ -55,6 +56,23 @@ export function quadroDaSituacao(s: SituacaoNoLabs): { tom: TomDoQuadro; texto:
         tom: "atencao",
         texto: "Criado no Labs como oculto. Publique no /admin do Labs para gerar e usar carrossel.",
       };
+    // ACHADOS 57 E 58: o Labs respondeu no formato do contrato, e quem resolve é o operador. A
+    // frase diz onde agir, e não "avise quem cuida do Labs".
+    case "sem_palavra":
+      return {
+        tom: "atencao",
+        texto: "Este bônus está publicado no Labs sem palavra-chave. Cadastre uma no /admin do Labs para gerar carrossel.",
+      };
+    case "sem_tema":
+      return {
+        tom: "atencao",
+        texto: "Este bônus está publicado no Labs sem tema. Cadastre um no /admin do Labs para gerar carrossel.",
+      };
+    case "palavra_fora_do_padrao":
+      return {
+        tom: "atencao",
+        texto: `A palavra-chave deste bônus no Labs é ${s.palavra}, e o Chat só aceita letras e números, sem espaço, de ${PALAVRA_MIN} a ${PALAVRA_MAX}. Troque no /admin do Labs para gerar carrossel.`,
+      };
     case "sem_resposta":
       return { tom: "atencao", texto: "Não consegui consultar o Labs agora. Recarregue a página em instantes." };
     case "formato_estranho":
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx vitest run tests/bonus-publicado.test.ts tests/bonus-carrossel-textos.test.ts
```

Esperado: `tsc` limpo (o `switch` de `quadroDaSituacao` cobre os três tipos novos) e 44 casos
passam. As mutações desta fase estão no Apêndice A (as três primeiras).

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/publicado.ts lib/bonus/carrossel-textos.ts tests/bonus-publicado.test.ts tests/bonus-carrossel-textos.test.ts
test "$(git branch --show-current)" = "arte-do-carrossel"
git add lib/bonus/publicado.ts lib/bonus/carrossel-textos.ts tests/bonus-publicado.test.ts tests/bonus-carrossel-textos.test.ts
git commit -m "fix(bonus): o bônus publicado sem palavra, sem tema ou com palavra fora do padrão tem frase própria"
```

---

### FASE 3.2 — A geometria e os slides do Labs

**Arquivos:**
- Criar: `lib/bonus/arte-geometria.ts`, `lib/bonus/arte-slides.ts`
- Testar: `tests/bonus-arte-slides.test.ts`

**Interfaces:**
- Consome: `TextoDeCarrossel`, `TextoDePost`, `TextoDoCarrossel` de `lib/bonus/carrossel-texto.ts`.
- Produz: de `arte-geometria.ts`, `LARGURA`, `ALTURA`, `MARGEM`, `ENTRELINHA`,
  `ALTURA_ILUSTRACAO`, `ALTURA_TEXTO_SEM_ILUSTRACAO`, `alturaEstimada(texto, fonte)`,
  `alturaDisponivel(comIlustracao)`; de `arte-slides.ts`, `type TipoDeSlide`,
  `type SlideParaArte`, `slidesDoTexto(t): SlideParaArte[]`, `textoMedido(s): string`,
  `tamanhoDoTexto(tipo, texto, comIlustracao = true): number`,
  `slidesQueNaoCabem(slides): SlideQueNaoCabe[]`.

- [ ] **Passo 1: o teste, adaptado do `slides.test.ts` do Labs**

Crie `tests/bonus-arte-slides.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  slidesDoTexto,
  slidesQueNaoCabem,
  tamanhoDoTexto,
  textoMedido,
  type SlideParaArte,
  type TipoDeSlide,
} from "@/lib/bonus/arte-slides";
import { ALTURA_TEXTO_SEM_ILUSTRACAO, alturaDisponivel, alturaEstimada } from "@/lib/bonus/arte-geometria";
import { CarrosselDoChatSchema, PostDoChatSchema, SlideSchema } from "@/lib/bonus/carrossel-schema";
import type { TextoDeCarrossel, TextoDePost } from "@/lib/bonus/carrossel-texto";

// OS TESTES DOS SLIDES DA ARTE, trazidos do Labs (site-ia, src/lib/ia/slides.test.ts, 45bc973) e
// adaptados à forma do texto do Chat (carrossel-texto.ts). O que muda de lá está dito em cada
// bloco. Os números dos degraus e da geometria são os de lá: se um caso daqui cair, a régua mudou
// num dos dois lados, e o outro precisa saber ("Dois donos", na spec da Etapa 3).

const carrossel = (conteudo: number): TextoDeCarrossel => ({
  tipo: "carrossel",
  titulo: "Nome interno da geração para o operador reconhecer",
  gancho: "Sua planilha está mentindo sobre o seu lucro",
  slides: Array.from({ length: conteudo }, (_, i) => ({
    titulo: `Título do slide ${i + 1}`,
    texto: `Texto do slide ${i + 1}, com duas ou três linhas de conteúdo real.`,
  })),
  chamada: "Comente SUMIDO e eu te mando o prompt completo, de graça.",
  legenda: "x".repeat(120),
});

const POST: TextoDePost = {
  tipo: "post",
  titulo: "rotulo interno da peca",
  texto: "Descanse bem e recarregue as energias.\n\nAmanha sera mais um dia produtivo.",
  chamada: "Comente SUMIDO que eu te mando o banco.",
  legenda: "x".repeat(100),
};

describe("os slides do texto do carrossel", () => {
  // O Chat pede de 2 a 10 slides (0 a 8 de conteúdo); o Labs, de 8 a 11. Os totais pequenos são
  // novos para esta arte, e é por isso que a lista inteira é conferida.
  it.each([0, 1, 2, 8])("junta gancho, %i de conteúdo e chamada numa lista só, numerada sem buraco", (n) => {
    const s = slidesDoTexto(carrossel(n));
    expect(s.map((x) => x.numero)).toEqual(Array.from({ length: n + 2 }, (_, i) => i + 1));
    expect(new Set(s.map((x) => x.total))).toEqual(new Set([n + 2]));
    expect(s[0].tipo).toBe("gancho");
    expect(s[s.length - 1].tipo).toBe("cta");
    expect(s.slice(1, -1).every((x) => x.tipo === "conteudo")).toBe(true);
  });

  it("só o ÚLTIMO slide do carrossel assina no pé", () => {
    const s = slidesDoTexto(carrossel(6));
    expect(s[s.length - 1].assinaturaNoPe).toBe(true);
    expect(s.slice(0, -1).every((x) => x.assinaturaNoPe === false)).toBe(true);
  });

  it("só os slides do meio têm título, e o texto vai como está", () => {
    const c = carrossel(6);
    const s = slidesDoTexto(c);
    expect(s[0]).toMatchObject({ titulo: null, texto: c.gancho });
    expect(s[1]).toMatchObject({ titulo: "Título do slide 1", texto: c.slides[0].texto });
    expect(s[s.length - 1]).toMatchObject({ titulo: null, texto: c.chamada });
  });
});

describe("o post de uma imagem", () => {
  it("vira um slide só, do tipo `cta` pelos degraus de fonte, assinado no TOPO", () => {
    expect(slidesDoTexto(POST)).toEqual([
      { numero: 1, total: 1, tipo: "cta", titulo: null, texto: `${POST.texto}\n\n${POST.chamada}`, assinaturaNoPe: false },
    ]);
  });

  // A chamada entra como ÚLTIMO BLOCO separado por linha em branco, que é como a arte reconhece a
  // linha de fechamento em negrito. No Chat, todo post tem chamada (carrossel-schema.ts).
  it("a chamada vira o último bloco", () => {
    const blocos = slidesDoTexto(POST)[0].texto.split(/\n{2,}/);
    expect(blocos[blocos.length - 1]).toBe(POST.chamada);
  });
});

describe("tamanhoDoTexto", () => {
  it("nunca cresce conforme o texto cresce, e desce quando precisa", () => {
    const tamanhos = [40, 60, 100, 150, 200, 260, 320].map((n) => tamanhoDoTexto("conteudo", "x".repeat(n)));
    for (let i = 1; i < tamanhos.length; i++) {
      expect(tamanhos[i], `${i}: cresceu com texto maior`).toBeLessThanOrEqual(tamanhos[i - 1]);
    }
    expect(tamanhos[tamanhos.length - 1]).toBeLessThan(tamanhos[0]);
  });

  it("o gancho é sempre maior que o texto de conteúdo do mesmo tamanho", () => {
    for (const n of [30, 70, 110]) {
      const t = "x".repeat(n);
      expect(tamanhoDoTexto("gancho", t)).toBeGreaterThan(tamanhoDoTexto("conteudo", t));
    }
  });

  it("nunca desce abaixo de 34px", () => {
    for (const tipo of ["gancho", "conteudo", "cta"] as const) {
      expect(tamanhoDoTexto(tipo, "x".repeat(400))).toBeGreaterThanOrEqual(34);
    }
  });

  it("cresce sem o espaço da imagem, nos três tipos, sem fração de pixel", () => {
    for (const tipo of ["gancho", "conteudo", "cta"] as const) {
      const t = "x".repeat(50);
      expect(tamanhoDoTexto(tipo, t, false)).toBeGreaterThan(tamanhoDoTexto(tipo, t, true));
      expect(Number.isInteger(tamanhoDoTexto(tipo, t, false))).toBe(true);
    }
  });

  it("o padrão é COM o espaço da imagem", () => {
    const t = "x".repeat(100);
    expect(tamanhoDoTexto("conteudo", t)).toBe(tamanhoDoTexto("conteudo", t, true));
  });

  // O CONTRAPESO da descida: ela só pode ser acionada por quem NÃO CABE. Sem este caso, devolver
  // sempre o piso passaria em todos os outros.
  it("a descida não encolhe texto que já cabia, e os degraus do cta são os decididos", () => {
    expect(tamanhoDoTexto("gancho", "x".repeat(30))).toBe(86);
    expect(tamanhoDoTexto("conteudo", "x".repeat(60))).toBe(46);
    expect(tamanhoDoTexto("cta", "x".repeat(70))).toBe(60);
    expect(tamanhoDoTexto("cta", "x".repeat(200))).toBe(46);
    expect(tamanhoDoTexto("cta", "x".repeat(350))).toBe(34);
  });
});

// O TEXTO QUE A ARTE MEDE É O QUE ELA DESENHA: o título e o corpo (a rota do Labs mede assim, em
// src/app/admin/carrossel/arte/route.tsx). ⚠️ DIFERENTE DO LABS, de propósito: lá o aviso de
// `slidesQueNaoCabem` mede só o corpo, e um slide de conteúdo com título comprido podia cortar na
// imagem com o aviso calado. Aqui o aviso e a arte medem o mesmo `textoMedido`.
describe("o texto medido", () => {
  const slide = (titulo: string | null, texto: string): SlideParaArte => ({
    numero: 2,
    total: 3,
    tipo: "conteudo",
    titulo,
    texto,
    assinaturaNoPe: false,
  });

  it("com título, é o título e o corpo em linhas separadas; sem, é só o corpo", () => {
    expect(textoMedido(slide("Título", "Corpo"))).toBe("Título\nCorpo");
    expect(textoMedido(slide(null, "Corpo"))).toBe("Corpo");
  });

  // O conserto do Labs (dev 1254847, 01/10) também apara a manchete: só de espaços, ela não é linha.
  it("o título só de espaços não conta, e o com espaço nas pontas conta aparado", () => {
    expect(textoMedido(slide("   ", "Corpo"))).toBe("Corpo");
    expect(textoMedido(slide("  Título  ", "Corpo"))).toBe("Título\nCorpo");
  });

  // 8 linhas no piso de 34 dão 359px dos 382 com o espaço da imagem; a manchete é a 9ª, e dá 404.
  it("o título conta: o mesmo corpo que cabe sozinho deixa de caber com um título", () => {
    const corpo = Array(8).fill("x".repeat(20)).join("\n");
    expect(slidesQueNaoCabem([slide(null, corpo)])).toEqual([]);
    expect(slidesQueNaoCabem([slide("Um título de slide de conteúdo", corpo)])).toHaveLength(1);
  });
});

describe("o texto cabe na peça", () => {
  const TETOS: Record<TipoDeSlide, number> = {
    gancho: CarrosselDoChatSchema.shape.gancho.maxLength!,
    conteudo: SlideSchema.shape.texto.maxLength!,
    cta: CarrosselDoChatSchema.shape.chamadaParaAcao.maxLength!,
  };
  const TITULO_MAX = SlideSchema.shape.titulo.maxLength!;

  it("os tetos vieram mesmo do schema", () => {
    for (const n of [...Object.values(TETOS), TITULO_MAX]) {
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThan(0);
    }
  });

  it("o gancho e a chamada cabem nos dois modos, no pior caso que o schema permite", () => {
    for (const tipo of ["gancho", "cta"] as const) {
      for (const comIlustracao of [true, false]) {
        const t = "x".repeat(TETOS[tipo]);
        expect(alturaEstimada(t, tamanhoDoTexto(tipo, t, comIlustracao)), `${tipo} ${comIlustracao}`).toBeLessThanOrEqual(
          alturaDisponivel(comIlustracao)
        );
      }
    }
  });

  // ⚠️ DIFERENTE DO LABS: com a manchete medida, o slide de conteúdo no PIOR caso do schema
  // (manchete de 70 e corpo de 300, em caixa alta) não cabe em modo nenhum: sem o espaço da imagem
  // o piso também sobe (34 × 1,6 = 54px), e dá 998px dos 955. O aviso existe para isto, e diz
  // "corta sempre": o operador encurta. Um slide do tamanho que a instrução pede cabe com folga.
  it("o conteúdo no pior caso do schema é acusado como 'corta sempre', e o tamanho comum cabe com o espaço", () => {
    const slideDe = (titulo: string, texto: string): SlideParaArte => ({
      numero: 2,
      total: 3,
      tipo: "conteudo",
      titulo,
      texto,
      assinaturaNoPe: false,
    });
    const pior = slideDe("x".repeat(TITULO_MAX), "x".repeat(TETOS.conteudo));
    expect(slidesQueNaoCabem([pior])).toEqual([{ numero: 1, tipo: "conteudo", linhas: 2, cortaSempre: true }]);
    expect(slidesQueNaoCabem([slideDe("x".repeat(40), "x".repeat(200))])).toEqual([]);
  });

  it("o post de uma imagem cabe no pior caso: texto, linha em branco e chamada", () => {
    const pior = "x".repeat(PostDoChatSchema.shape.texto.maxLength! + TETOS.cta + 2);
    expect(alturaEstimada(pior, tamanhoDoTexto("cta", pior, false))).toBeLessThanOrEqual(ALTURA_TEXTO_SEM_ILUSTRACAO);
  });
});

describe("a previsão de altura conta as quebras de linha", () => {
  it("um texto quebrado ocupa MAIS que o mesmo texto corrido", () => {
    expect(alturaEstimada("x".repeat(50) + "\n" + "x".repeat(50), 40)).toBeGreaterThan(alturaEstimada("x".repeat(100), 40));
  });

  it("cada bloco ocupa ao menos uma linha, e a linha em branco também", () => {
    expect(alturaEstimada(Array(5).fill("ok").join("\n"), 40)).toBe(5 * 40 * 1.32);
    expect(alturaEstimada(["um", "dois", "tres", "quatro", "cinco"].join("\n\n"), 40)).toBe(9 * 40 * 1.32);
  });
});

describe("slidesQueNaoCabem", () => {
  const slide = (texto: string): SlideParaArte[] => [
    { numero: 1, total: 1, tipo: "conteudo", titulo: null, texto, assinaturaNoPe: false },
  ];

  it("silencia quando cabe", () => {
    expect(slidesQueNaoCabem(slide("x".repeat(200)))).toEqual([]);
  });

  it("acusa o que não cabe nem no piso, e distingue 'corta só com o espaço' de 'corta sempre'", () => {
    const dez = Array(10).fill("x".repeat(17)).join("\n");
    expect(slidesQueNaoCabem(slide(dez))).toEqual([{ numero: 1, tipo: "conteudo", linhas: 10, cortaSempre: false }]);
    const trinta = Array(30).fill("x".repeat(17)).join("\n");
    expect(slidesQueNaoCabem(slide(trinta))[0].cortaSempre).toBe(true);
  });

  it("cala no que passou a caber porque a fonte desce um degrau", () => {
    const oito = Array(8).fill("x".repeat(22)).join("\n");
    expect(tamanhoDoTexto("conteudo", oito)).toBe(34);
    expect(slidesQueNaoCabem(slide(oito))).toEqual([]);
  });
});
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-arte-slides.test.ts
```

Esperado: o arquivo cai sem rodar caso nenhum, com `Cannot find package '@/lib/bonus/arte-slides'`.

- [ ] **Passo 3: a geometria, sem mudar uma linha do Labs**

O corpo (da linha 7 em diante) é o `src/lib/ia/geometria-da-arte.ts` do site-ia em `45bc973`,
igual em `a56459b`. Confira com `diff <(tail -n +7 lib/bonus/arte-geometria.ts) <(git -C ../site-ia show 45bc973:src/lib/ia/geometria-da-arte.ts)`, que não imprime nada.

Crie `lib/bonus/arte-geometria.ts`:

```ts
// TRAZIDO DO MÉTODO LABS COMO ESTÁ (site-ia, src/lib/ia/geometria-da-arte.ts, mudado por último
// em 19d25be, igual em 45bc973 e em a56459b). DOIS DONOS: mudança aqui se avisa ao Labs, e a de
// lá se traz para cá (docs/specs/2026-10-01-arte-do-carrossel.md, "Dois donos"). Abaixo, o
// arquivo de lá sem mudar uma linha; os caminhos citados nos comentários são os do Labs. No Chat,
// a "ilustração" é o espaço em branco que o operador reserva para pôr a imagem no Canva.
//
// A GEOMETRIA DA PEÇA — fonte única dos números que a arte desenha e o teste prevê.
//
// ⚠️ **EXISTE PORQUE ESTES NÚMEROS ESTAVAM EM DOIS LUGARES.** Até 04/09 a rota da arte
// (`admin/carrossel/arte/route.tsx`) e a asserção de cabimento (`slides.test.ts`) declaravam
// cada uma a sua cópia: 1080, 1350, 110 e `1.32`. Nada obrigava as duas a concordarem.
//
// O estrago dessa duplicação é específico e silencioso: a asserção de cabimento existe para
// dizer "este texto NÃO corta o PNG". Ela chega a esse veredito calculando com a SUA cópia
// dos números. Se alguém mudasse a margem na arte para 120 e não aqui, o teste continuaria
// verde prevendo com 110 — dando garantia sobre uma peça que já não é a que se desenha.
//
// Não é hipótese distante: a régua de largura do caractere já esteve errada por horas em
// 03/09 (achado 22.13), e o sintoma foi exatamente esse — verde que cobria mais casos e
// garantia menos.

/** 1080×1350 é o 4:5 do feed: o formato mais alto que o Instagram aceita, e portanto o que
 *  ocupa mais tela no celular de quem rola. É também a tela do pipeline dele. */
export const LARGURA = 1080;
export const ALTURA = 1350;

/**
 * A margem dos quatro lados.
 *
 * ⚠️ **110, e não 64.** É número do manual da casa, não gosto — a margem larga é o que faz a
 * peça respirar no feed, e é visível na comparação lado a lado. Encolher aqui aproxima o
 * slide de "panfleto" e afasta do que já está publicado no perfil.
 */
export const MARGEM = 110;

/** Entrelinha. Quem precisar da altura de uma linha multiplica por isto. */
export const ENTRELINHA = 1.32;

/** O que sobra de largura entre as margens. */
export const LARGURA_UTIL = LARGURA - MARGEM * 2;

/**
 * A ilustração ocupa 3:2 — a proporção que a API de imagem gera.
 *
 * Se alguém "arredondar" este valor, a imagem volta a ser cortada. Mudou a proporção que a
 * API oferece? Mude aqui junto.
 */
export const ALTURA_ILUSTRACAO = Math.round((LARGURA_UTIL * 2) / 3);

/**
 * ⚠️ **ESTIMATIVA, e a única desta lista.** O cabeçalho (avatar + nome + respiro) não tem
 * constante na arte: a altura dele é o que o Satori renderiza. 175 é a medida observada, e
 * está aqui para a previsão de cabimento ter de onde descontar.
 *
 * Consequência: um cabeçalho que cresça de verdade sem este número acompanhar faz a previsão
 * ficar OTIMISTA — ela acha que há mais espaço do que há. É por isso que ela é estimativa
 * declarada e não constante compartilhada: ninguém deve confiar nela como fato.
 */
export const CABECALHO_ESTIMADO = 175;

/** Altura útil para texto quando o slide NÃO tem ilustração. */
export const ALTURA_TEXTO_SEM_ILUSTRACAO = ALTURA - MARGEM * 2 - CABECALHO_ESTIMADO;

/** Altura útil quando tem — menos de metade da anterior, e é aí que o texto corta. */
export const ALTURA_TEXTO_COM_ILUSTRACAO = ALTURA_TEXTO_SEM_ILUSTRACAO - ALTURA_ILUSTRACAO;

/**
 * Largura média de um caractere, em `em`, para prever quantos cabem numa linha.
 *
 * ⚠️ **0,5538 É A LARGURA DE MAIÚSCULAS, E O PIOR CASO É DE PROPÓSITO.** Medida no TTF da
 * Carlito: prosa média dá 0,4183, minúsculas 0,4559, MAIÚSCULAS 0,5538.
 *
 * Em 03/09 este número foi trocado por 0,4183 — a média medida — e o efeito foi um teste que
 * cobria mais casos e garantia menos: um gancho de 120 caracteres com ilustração dava 317px
 * de 382 pela média, e 396 na largura real de maiúsculas. Ou seja, **passava no teste e
 * cortava o PNG**.
 *
 * A lição não é "medir é ruim". É que medição responde *quanto costuma ser*, e previsão de
 * cabimento precisa de *quanto pode ser no pior caso plausível*. São perguntas diferentes.
 * Gancho de Instagram em caixa alta é plausível, e a aba de colar aceita qualquer texto.
 */
export const LARGURA_DO_CARACTERE = 0.5538;

/**
 * Quantos pixels de altura um texto ocupa nesta fonte — a previsão que decide se corta.
 *
 * É uma ESTIMATIVA, não o que o Satori faz: ele quebra em palavras, não em caracteres, então
 * o valor real varia. Ela erra para o lado seguro por usar a largura de maiúsculas.
 */
export function alturaEstimada(texto: string, fonte: number): number {
  const porLinha = LARGURA_UTIL / (fonte * LARGURA_DO_CARACTERE);

  // ⚠️ **CONTA CADA BLOCO SEPARADO, e não o texto inteiro de uma vez.** Uma quebra de linha
  // força o fim da linha antes de ela encher — dividir o total de caracteres pela capacidade
  // de uma linha ignora isso e devolve MENOS linhas do que se desenha.
  //
  // Medido em 04/09 na fase 22.4, contra uma geração real do modelo: em 7 dos 8 slides com
  // quebra a conta antiga errava para baixo, e no pior (uma lista de cinco marcadores) dizia
  // 5 linhas onde havia 7 — 264px previstos contra 370 reais, num limite de 382. Passou por
  // doze pixels.
  //
  // O erro era todo para o lado OTIMISTA, que é o lado que deixa cortar. E não era caso
  // raro: o modelo escreveu com quebra em 8 dos 10 slides, porque lista e frase de efeito
  // isolada são o formato natural de carrossel.
  // ⚠️ `split("\n")` E NÃO `/\n+/` — o `+` colapsaria quebras consecutivas, e **a linha em
  // branco ocupa altura na peça**. Uma lista de cinco itens separados por linha em branco tem
  // 9 linhas e 5 pelo `+`: 475px reais contra 264 previstos, num limite de 382.
  //
  // ⚠️ **O QUE ELA OCUPA NÃO É UMA LINHA CHEIA, e este comentário dizia que era.** A arte
  // quebra o texto em blocos por `\n{2,}` e separa cada um por `GAP_PARAGRAFO` (41px), então
  // a linha em branco vira 41 e não `fonte × 1.32` (52,8 em corpo 40). A conta aqui segue
  // cobrando a linha cheia **de propósito**: a diferença é de ~12px por parágrafo e cai toda
  // para o lado conservador, que é o lado que não deixa cortar.
  //
  // A justificativa velha citava `whiteSpace: "pre-wrap"` desenhando a linha vazia — e isso
  // nunca aconteceu: o `split(/\n{2,}/)` consumia a quebra dupla antes de o `pre-wrap` ver.
  // A conta estava certa pelo motivo errado, e o motivo errado foi corrigido em 21/09, junto
  // do conserto da sobreposição que tirou o `pre-wrap` da arte.
  //
  // O `Math.max(1, …)` é o que faz o bloco vazio contar 1: `Math.ceil(0 / porLinha)` é 0.
  const linhas = texto
    .split("\n")
    .reduce((total, bloco) => total + Math.max(1, Math.ceil(bloco.length / porLinha)), 0);

  return linhas * fonte * ENTRELINHA;
}

/** A altura disponível para texto, conforme o slide tenha ou não ilustração. */
export function alturaDisponivel(comIlustracao: boolean): number {
  return comIlustracao ? ALTURA_TEXTO_COM_ILUSTRACAO : ALTURA_TEXTO_SEM_ILUSTRACAO;
}
```

- [ ] **Passo 4: os slides**

Trazido do `src/lib/ia/slides.ts` do site-ia em `45bc973`, com as trocas ditas no cabeçalho: os
tipos do Chat, `chamada`, `slidesDoTexto` e `textoMedido` (aparando a manchete, como o conserto
do Labs em `1254847`).

Crie `lib/bonus/arte-slides.ts`:

```ts
// TRAZIDO DO MÉTODO LABS (site-ia, src/lib/ia/slides.ts, mudado por último em 19d25be, igual em
// 45bc973 e em a56459b). DOIS DONOS: mudança aqui se avisa ao Labs, e a de lá se traz para cá
// (docs/specs/2026-10-01-arte-do-carrossel.md, "Dois donos"). Os degraus, o piso e o fator sem
// ilustração são os de lá, sem mudar um número. O que muda:
// - a entrada é o texto do Chat (carrossel-texto.ts): `chamada` no lugar de `chamadaParaAcao`, e
//   `slidesDoTexto` escolhe entre o carrossel e o post;
// - `slidesQueNaoCabem` mede `textoMedido` (a manchete e o corpo), como a arte desenha.
// No Chat, a "ilustração" é o espaço em branco que o operador reserva para a imagem do Canva.
//
import { alturaDisponivel, alturaEstimada } from "./arte-geometria";
import type { TextoDeCarrossel, TextoDePost, TextoDoCarrossel } from "./carrossel-texto";

// O carrossel gerado vira uma LISTA DE SLIDES para desenhar.
//
// POR QUE EXISTE: o schema guarda o conteúdo em três formatos diferentes — `gancho` é uma
// string solta, `slides` é uma lista com título e texto, e `chamadaParaAcao` é outra string
// solta. Quem desenha precisa de UMA lista homogênea, com o número e o total em cada peça.
//
// Sem isto, a numeração viveria espalhada: a tela já calculava `slides.length + 2` em três
// lugares para saber o total, e cada um poderia divergir. Agora a conta acontece uma vez.
//
// PURO, sem `server-only`: é a mesma lista que a tela usa para listar e que a rota de
// imagem usa para desenhar. Duas leituras da mesma fonte, não duas fontes.

export type TipoDeSlide = "gancho" | "conteudo" | "cta";

export type SlideParaArte = {
  /** 1-based, como a pessoa conta ao publicar. */
  numero: number;
  total: number;
  tipo: TipoDeSlide;
  /** O gancho e a chamada para ação não têm título — o texto É a peça. */
  titulo: string | null;
  texto: string;
  /**
   * A assinatura (foto, nome e arroba) vai no PÉ da peça, e não no topo.
   *
   * ⚠️ **EXISTE PORQUE O `tipo` CARREGAVA DOIS SIGNIFICADOS.** Até 21/09 a arte decidia isso
   * com `tipo === "cta"`, e o post de uma imagem usa `tipo: "cta"` para escolher o TAMANHO DA
   * FONTE — os degraus dele são os únicos que chegam a 550 caracteres. O post herdou a
   * assinatura no pé de carona, sem ninguém decidir isso.
   *
   * Em 21/09 o Eduardo comparou a peça do dev com quatro publicadas e viu a diferença: nas
   * dele o autor está no topo. Um campo por decisão é o que impede a próxima carona.
   */
  assinaturaNoPe: boolean;
};

export function slidesParaArte(carrossel: TextoDeCarrossel): SlideParaArte[] {
  const total = carrossel.slides.length + 2;

  return [
    { numero: 1, total, tipo: "gancho" as const, titulo: null, texto: carrossel.gancho, assinaturaNoPe: false },
    ...carrossel.slides.map((s, i) => ({
      numero: i + 2,
      total,
      tipo: "conteudo" as const,
      titulo: s.titulo,
      texto: s.texto,
      assinaturaNoPe: false,
    })),
    // ⚠️ O ÚLTIMO SLIDE DO CARROSSEL CONTINUA COM A ASSINATURA NO PÉ. Foi o desenho aprovado
    // em 02/09, e as quatro referências de 21/09 são de POST — nenhuma é slide final, então
    // não há medição que contrarie este aqui. Decidido pelo Eduardo em 21/09: muda só o que
    // ele viu errado.
    { numero: total, total, tipo: "cta" as const, titulo: null, texto: carrossel.chamada, assinaturaNoPe: true },
  ];
}

/**
 * O POST DE UMA IMAGEM vira uma lista de UM slide.
 *
 * Mesmo tipo de saída do carrossel de propósito: quem desenha, quem baixa e quem confere
 * ortografia passam a não precisar saber qual formato estão olhando. Sem isto, cada uma
 * dessas telas ganharia um `if` — e um `if` esquecido num deles é um post que sai errado
 * sem ninguém ver.
 *
 * ⚠️ O tipo é `"cta"` pelos DEGRAUS DE FONTE, e só por isso. Os degraus de `cta` são os
 * únicos que descem até 34px, que é o que um post de ~550 caracteres exige — os de `conteudo`
 * param em 34 mas partem de 46, e os de `gancho` são grandes de propósito.
 *
 * ⚠️ **ATÉ 21/09 ESTE COMENTÁRIO DIZIA OUTRA COISA**, e a outra coisa era uma decisão real:
 * "`cta` é o slide que a arte desenha com a assinatura NO PÉ, que é exatamente a composição
 * da peça única de referência". Era verdade em 02/09 e vinha de uma peça publicada. Em 21/09
 * o Eduardo trouxe quatro, todas com o autor NO TOPO, e escolheu o topo para o post.
 *
 * O que sobra de lição é o formato, não o gosto: um campo (`tipo`) decidia duas coisas sem
 * relação (tamanho da fonte e posição da assinatura), então mudar uma exigia mexer na outra.
 * `assinaturaNoPe` separa as duas, e o carrossel segue com o desenho de 02/09.
 *
 * A chamada para ação, quando existe, entra como último bloco separado por linha em branco
 * — que é como a arte reconhece a linha de fechamento em negrito. Não há segundo slide
 * onde pô-la.
 */
export function slidesDoPost(post: TextoDePost): SlideParaArte[] {
  const texto = post.chamada
    ? `${post.texto.trim()}\n\n${post.chamada.trim()}`
    : post.texto.trim();

  return [{ numero: 1, total: 1, tipo: "cta", titulo: null, texto, assinaturaNoPe: false }];
}

/** O texto do Chat, carrossel ou post, vira a lista de slides que a arte desenha. */
export function slidesDoTexto(t: TextoDoCarrossel): SlideParaArte[] {
  return t.tipo === "post" ? slidesDoPost(t) : slidesParaArte(t);
}

/**
 * O TEXTO QUE A ARTE MEDE, que é o que ela desenha: a manchete e o corpo, no mesmo corpo
 * tipográfico (a rota do Labs mede assim). ⚠️ DIFERENTE DO LABS, de propósito: lá
 * `slidesQueNaoCabem` mede só o corpo, e um slide de conteúdo com manchete comprida podia cortar
 * na imagem com o aviso calado. Aqui a fonte da arte e o aviso medem este mesmo texto. A manchete
 * vai aparada, e só de espaços não conta: o conserto do Labs fez o mesmo (dev 1254847, 01/10).
 */
export function textoMedido(s: SlideParaArte): string {
  const titulo = s.titulo?.trim();
  return titulo ? `${titulo}\n${s.texto}` : s.texto;
}

/**
 * Quanto o texto cresce quando o slide NÃO tem ilustração — **por tipo de slide**.
 *
 * A conta vem da geometria, não do gosto: sem a ilustração, a área de texto passa de ~374px
 * para ~947. Crescer na mesma proporção deixaria o texto gigante; o fator usa a folga sem
 * transformar o slide numa placa.
 *
 * ⚠️ **ERA UM NÚMERO SÓ PARA OS TRÊS TIPOS, e por isso ficava travado no menor deles.**
 * O gancho já parte de 86px e a chamada para ação de 60: crescer muito ali vira placa. O
 * slide de CONTEÚDO parte de 34 a 46, e com o mesmo 1,35 sobrava um terço da peça em branco
 * — foi o que o Eduardo viu em 02/09 ("fica muito espaço em branco onde seria a imagem").
 *
 * O conteúdo cresce mais porque tinha mais folga para crescer. Os outros dois ficam onde
 * estavam, que é onde já enchiam.
 *
 * ⚠️ O respiro que SOBRA num slide curto é inevitável e não é defeito: um slide de duas
 * linhas não enche 947px sem virar cartaz. A alternativa seria empurrar o bloco para o meio
 * da peça, e isso o Eduardo descartou na mesma mensagem ("não deixe tão no meio").
 */
const FATOR_SEM_ILUSTRACAO: Record<TipoDeSlide, number> = {
  gancho: 1.35,
  conteudo: 1.6,
  cta: 1.35,
};

/**
 * Tamanho da fonte do texto, em pixels, para o slide 1080×1350.
 *
 * ⚠️ `comIlustracao` decide se o texto divide o slide com a imagem ou fica com ele inteiro.
 * Antes o espaço da ilustração era reservado SEMPRE, mesmo vazio: um slide só de texto
 * desperdiçava 635px de altura e ficava com a fonte pequena sem motivo. Achado pelo Eduardo
 * em 02/09.
 *
 * POR QUE NÃO É FIXO: o gancho tem até 120 caracteres e o texto de um slide até ~280. Com
 * um tamanho só, ou o gancho fica pequeno demais para o que ele precisa fazer (parar o
 * dedo em menos de um segundo), ou o texto longo transborda a arte — e transbordar não dá
 * erro, só corta a frase no meio sem avisar.
 *
 * Os degraus são largos de propósito: variação suave por caractere deixaria cada slide com
 * um tamanho ligeiramente diferente, e a sequência inteira pareceria trêmula ao passar.
 */
/**
 * Todos os tamanhos que a escada abaixo pode devolver, do maior ao menor.
/**
 * Os degraus de cada tipo, do maior ao menor. **A escolha e o MAIOR QUE COUBER.**
 *
 * ⚠️ **ATE 22/09 A ESCOLHA ERA UMA CASCATA POR NUMERO DE CARACTERES**, e esta lista existia
 * so para a DESCIDA da fase 38.2. A cascata errava nos dois sentidos pelo mesmo motivo: ela
 * conta CARACTERE onde o limite e LINHA.
 *
 * Para baixo, o erro cortava (38.2). Para cima, ele deixava buraco: o post que o Eduardo
 * publicou em 22/09 tem 91 caracteres, caia no degrau de 46 e ocupava 3 linhas — sobrando
 * **213px entre o texto e a imagem**, medidos varrendo a peca linha a linha. Em 60 o mesmo
 * texto ocupa 4 linhas e enche o espaco. "O texto ficou muito pra baixo, temos que rever
 * como fazer ele se adaptar ao texto."
 *
 * Com a escolha por cabimento, subir e descer viram O MESMO MECANISMO — e nao duas regras
 * que precisam concordar.
 *
 * ⚠️ **CADA TIPO TEM A SUA LISTA, E ISSO E O QUE PROTEGE A HIERARQUIA.** Uma lista unica
 * deixaria um slide de conteudo curto subir ate 86px, que e o corpo do GANCHO — e o gancho
 * tem um trabalho que o conteudo nao tem (parar o dedo em menos de um segundo). O teto de
 * cada tipo continua sendo uma decisao de desenho; o que mudou e como se escolhe dentro dele.
 *
 * Os VALORES nao se mexeram, e o porque de cada um esta logo abaixo, no lugar onde foi
 * medido.
 */
const DEGRAUS_POR_TIPO: Record<TipoDeSlide, readonly number[]> = {
  // 86 para o gancho curto, 72 ate 80 caracteres.
  //
  // ⚠️ O MENOR ERA 60 E CORTAVA (22.13): com a ilustracao no slide sobram 382px, e um gancho
  // de 120 caracteres em caixa alta ocupa 5 linhas de 60px = 396. O PNG saia cortado sem erro
  // nenhum. Em 56 a mesma frase ocupa 370.
  gancho: [86, 72, 56],

  // O slide do meio parte de 46 — e nunca foi maior: manchete e corpo tem o MESMO corpo
  // tipografico nas pecas publicadas, e a hierarquia da casa e por PESO.
  conteudo: [46, 40, 34],

  // ⚠️ 46 E NAO 48, pelo mesmo motivo do gancho: 200 caracteres em caixa alta ocupavam 7
  // linhas de 48px = 443, contra 382 disponiveis. Em 46 cabem em 6 linhas = 364. O degrau e
  // sensivel — 47 ja volta para 7 linhas e transborda.
  //
  // ⚠️ OS DOIS MENORES SO O POST DE UMA IMAGEM ALCANCA. A chamada de um carrossel para em 200
  // caracteres (schema); o post unico chega a ~550 contando o pedido opcional.
  //
  // ⚠️ 40 ERA 42 E CORTAVA (22.13): sem ilustracao o fator 1,35 levava a 57, e 350 caracteres
  // ocupavam 978px contra 955. Em 40 ficam 927.
  cta: [60, 46, 40, 34],
};
/**
 * O menor corpo que o projeto aceita, e ele NÃO é negociável por cabimento.
 *
 * Decidido em 03/09 contra a saída fácil: um post de 550 caracteres cortava, baixar para 32
 * resolveria a conta, e em vez disso o teto de `PostUnicoSchema.texto` caiu de 350 para 300.
 * "Cabe" resolvido encolhendo até ninguém ler não é cabimento, é o defeito com outro nome.
 */
const PISO_DE_LEGIBILIDADE = 34;

export function tamanhoDoTexto(tipo: TipoDeSlide, texto: string, comIlustracao = true): number {
  // ⚠️ **O MAIOR DEGRAU DO TIPO QUE COUBER, e nada mais decide isto.**
  //
  // Duas reguas viviam aqui e discordavam. Uma escada por NUMERO DE CARACTERES escolhia o
  // corpo; depois a altura estimada corrigia para baixo quando nao cabia (38.2). O que enche
  // a peca e LINHA, e caractere so e um palpite sobre linha — uma quebra termina a linha
  // antes de ela encher, e uma frase curta ocupa menos do que o contador sugere.
  //
  // O erro tinha os dois sentidos, e cada um apareceu numa peca publicada:
  //
  //   PARA BAIXO — 197 caracteres com 4 quebras caiam no degrau de 46 e precisavam de 546px
  //   contra 382 disponiveis. A imagem comia a ultima linha (21/09).
  //
  //   PARA CIMA — 91 caracteres caiam no degrau de 46, ocupavam 3 linhas e deixavam **213px
  //   de buraco** entre o texto e a imagem, medidos varrendo a peca linha a linha. Em 60 o
  //   mesmo texto ocupa 4 linhas e enche o espaco (22/09).
  //
  // Medir a altura e perguntar "cabe?" responde os dois de uma vez. A escada por caractere
  // saiu; os DEGRAUS dela ficaram, em `DEGRAUS_POR_TIPO`, porque os valores foram medidos e
  // continuam sendo decisao de desenho.
  //
  // ⚠️ **CONTINUA EM DEGRAUS, NUNCA DE 1 EM 1.** Variacao suave deixaria cada slide com um
  // tamanho ligeiramente diferente e a sequencia pareceria tremula ao passar o dedo. E a
  // lista e a DO TIPO: um conteudo curto nao sobe ate 86px, que e o corpo do gancho.
  //
  // ⚠️ **E PARA NO PISO DE 34, sem furar.** Se nem no piso couber, devolve o piso e quem avisa
  // e `slidesQueNaoCabem`. Resolver "cabe" encolhendo ate ninguem ler e o que a decisao de
  // 03/09 recusou — ela preferiu baixar o teto do schema de 350 para 300.
  const escala = (d: number) => (comIlustracao ? d : Math.round(d * FATOR_SEM_ILUSTRACAO[tipo]));
  const limite = alturaDisponivel(comIlustracao);

  const coube = DEGRAUS_POR_TIPO[tipo]
    .map(escala)
    .find((f) => alturaEstimada(texto, f) <= limite);

  return coube ?? escala(PISO_DE_LEGIBILIDADE);
}

/** Um slide que não cabe na arte, com o diagnóstico do porquê. */
export type SlideQueNaoCabe = {
  numero: number;
  tipo: TipoDeSlide;
  linhas: number;
  /** Corta mesmo SEM ilustração — o caso grave, não há o que remover para resolver. */
  cortaSempre: boolean;
};

/**
 * Quais slides não cabem na arte — a conferência que a tela mostra.
 *
 * ⚠️ **EXISTE PORQUE O TETO DE CARACTERES NÃO É SUFICIENTE.** O schema limita o slide de
 * conteúdo a 200 caracteres, e a asserção de cabimento prova que 200 caracteres cabem — mas
 * ela prova isso para 200 caracteres numa linha só. **Quebra de linha é forçada**, e um slide
 * dentro do teto com muitas linhas curtas transborda: medido em 04/09, 8 marcadores dão 422px
 * contra os 382 disponíveis quando há ilustração.
 *
 * ⚠️ **E BAIXAR A FONTE NÃO RESOLVE**, o que elimina a saída óbvia: fonte menor não junta duas
 * linhas em uma. No piso de legibilidade de 34px cabem 8 linhas com ilustração — um slide com
 * 9 quebras não cabe em tamanho nenhum que este projeto aceite. Por isso a saída é limitar a
 * quantidade de linhas (na instrução) e AVISAR quem está na tela (aqui).
 *
 * ⚠️ **AVISA, NUNCA IMPEDE** — mesmo critério do painel de acentuação. A previsão é uma
 * estimativa (conta caracteres, o Satori quebra por palavra), então vai errar às vezes.
 * Aviso que trava publicação é aviso que alguém desliga, e aí para de pegar o caso real.
 */
export function slidesQueNaoCabem(slides: SlideParaArte[]): SlideQueNaoCabe[] {
  const fora: SlideQueNaoCabe[] = [];

  slides.forEach((s, i) => {
    const medido = textoMedido(s);
    const comIlustracao = alturaEstimada(medido, tamanhoDoTexto(s.tipo, medido, true)) > alturaDisponivel(true);
    const semIlustracao = alturaEstimada(medido, tamanhoDoTexto(s.tipo, medido, false)) > alturaDisponivel(false);

    if (comIlustracao || semIlustracao) {
      fora.push({
        numero: i + 1,
        tipo: s.tipo,
        linhas: medido.split("\n").length,
        cortaSempre: semIlustracao,
      });
    }
  });

  return fora;
}
```

- [ ] **Passo 5: ver passar**

```bash
npx tsc --noEmit
npx vitest run tests/bonus-arte-slides.test.ts
```

Esperado: `tsc` limpo e 26 casos passam.

- [ ] **Passo 6: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/arte-geometria.ts lib/bonus/arte-slides.ts tests/bonus-arte-slides.test.ts
test "$(git branch --show-current)" = "arte-do-carrossel"
git add lib/bonus/arte-geometria.ts lib/bonus/arte-slides.ts tests/bonus-arte-slides.test.ts
git commit -m "feat(bonus): a geometria e os slides da arte, trazidos do Labs, medindo a manchete"
```

---

### FASE 3.3 — A fonte

**Arquivos:**
- Criar: `lib/bonus/fonte/Carlito-Regular.ttf`, `lib/bonus/fonte/Carlito-Bold.ttf`,
  `lib/bonus/fonte/OFL.txt`, `lib/bonus/arte-fonte.ts`
- Testar: `tests/bonus-arte-fonte.test.ts`

**Interfaces:**
- Produz: `FAMILIA_DA_ARTE = "Carlito"`, `type FonteDaArte`, `fontesDaArte(): Promise<FonteDaArte[]>`
  (`server-only`; recusa se a leitura falhar, sem fonte de reserva).

- [ ] **Passo 1: o teste**

Crie `tests/bonus-arte-fonte.test.ts`:

```ts
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FAMILIA_DA_ARTE, fontesDaArte } from "@/lib/bonus/arte-fonte";

// A FONTE DA ARTE: a Carlito Regular e Bold, SEM MODIFICAÇÃO, com a licença ao lado. "Sem
// modificação" é conferível: o hash do git de cada arquivo é o que o repositório do Google Fonts
// publica (google/fonts, commit 3dd7884402, ofl/carlito). Mexer num byte do .ttf derruba o caso.

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const PASTA = `${RAIZ}/lib/bonus/fonte`;

/** O hash que o git dá a um arquivo: sha1 de "blob <tamanho>\0" seguido dos bytes. */
function hashDoGit(bytes: Buffer): string {
  return createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
}

const ARQUIVOS = [
  { nome: "Carlito-Regular.ttf", hash: "427b95989fee609ab683d800ad00e22a4b14ecad" },
  { nome: "Carlito-Bold.ttf", hash: "67543b5a1efe4b910317116b02e8e9e01659692e" },
];

describe("os arquivos da fonte", () => {
  it.each(ARQUIVOS)("$nome é TrueType e é o do Google Fonts, byte a byte", ({ nome, hash }) => {
    const bytes = readFileSync(`${PASTA}/${nome}`);
    expect([...bytes.subarray(0, 4)]).toEqual([0x00, 0x01, 0x00, 0x00]);
    expect(hashDoGit(bytes)).toBe(hash);
  });

  // A licença vai junto (SIL OFL 1.1): é ela que permite levar os arquivos. O git pode entregar a
  // cópia de trabalho em CRLF (core.autocrlf), e o hash é o do conteúdo em LF, que é o guardado.
  it("a licença OFL está ao lado, a mesma do Google Fonts, com o nome reservado", () => {
    const texto = readFileSync(`${PASTA}/OFL.txt`, "utf8").replace(/\r\n/g, "\n");
    expect(texto).toContain('with Reserved Font Name "Carlito"');
    expect(texto).toContain("SIL OPEN FONT LICENSE Version 1.1");
    expect(hashDoGit(Buffer.from(texto, "utf8"))).toBe("8d6b170e4d9a5580a34471dc4ac3e8fc5fbbd712");
  });
});

describe("as fontes que a arte entrega ao ImageResponse", () => {
  it("são os dois pesos da casa, lidos dos arquivos inteiros", async () => {
    const fontes = await fontesDaArte();
    expect(fontes.map((f) => [f.name, f.weight, f.style, f.data.length])).toEqual([
      [FAMILIA_DA_ARTE, 400, "normal", readFileSync(`${PASTA}/Carlito-Regular.ttf`).length],
      [FAMILIA_DA_ARTE, 700, "normal", readFileSync(`${PASTA}/Carlito-Bold.ttf`).length],
    ]);
    expect(FAMILIA_DA_ARTE).toBe("Carlito");
  });
});
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-arte-fonte.test.ts
```

Esperado: o arquivo cai sem rodar caso nenhum, com `Cannot find package '@/lib/bonus/arte-fonte'`.

- [ ] **Passo 3: os arquivos da fonte, do commit fixado do Google Fonts**

```bash
mkdir -p lib/bonus/fonte
for f in Carlito-Regular.ttf Carlito-Bold.ttf OFL.txt; do
  curl -sSL -o "lib/bonus/fonte/$f" "https://raw.githubusercontent.com/google/fonts/3dd7884402/ofl/carlito/$f"
done
git hash-object lib/bonus/fonte/Carlito-Regular.ttf lib/bonus/fonte/Carlito-Bold.ttf lib/bonus/fonte/OFL.txt
```

Esperado, na ordem: `427b95989fee609ab683d800ad00e22a4b14ecad`,
`67543b5a1efe4b910317116b02e8e9e01659692e` e `8d6b170e4d9a5580a34471dc4ac3e8fc5fbbd712`, os
mesmos que `gh api repos/google/fonts/contents/ofl/carlito` lista. Se algum diferir, pare.

- [ ] **Passo 4: a leitura da fonte**

Crie `lib/bonus/arte-fonte.ts`:

```ts
import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// A FONTE DA ARTE: a Carlito, Regular (400) e Bold (700), os dois únicos pesos do manual de arte do
// perfil (trazido ao Labs em 02/09; site-ia, src/lib/ia/fonte-da-arte.ts). A hierarquia da peça é
// por PESO: sem os dois pesos entregues ao ImageResponse, o negrito do gancho sai fino.
//
// OS .ttf MORAM EM lib/bonus/fonte/, SEM MODIFICAÇÃO, com a licença OFL ao lado: o hash do git de
// cada um é o do Google Fonts (google/fonts, commit 3dd7884402, ofl/carlito), e
// tests/bonus-arte-fonte.test.ts confere. O Labs busca a fonte no Google Fonts a cada processo;
// aqui ela é lida do disco, uma vez, com o caminho por extenso em cada `readFile`, que é o padrão
// da documentação do Next 16 (image-response.md) e o que o rastreio de arquivos da Vercel enxerga.
// Só o preview da Vercel prova que os arquivos entraram na função. Se não entrarem, o conserto é
// `outputFileTracingIncludes` no next.config.ts.
//
// SEM FONTE DE RESERVA, de propósito: um slide na fonte errada sairia publicável e fora da
// identidade do perfil, sem erro nenhum. Se a leitura falhar, a promessa recusa e a rota responde
// com erro, que aparece na prévia. A próxima chamada tenta ler de novo.

export const FAMILIA_DA_ARTE = "Carlito";

export type FonteDaArte = { name: string; data: Buffer; weight: 400 | 700; style: "normal" };

let carregadas: Promise<FonteDaArte[]> | null = null;

export function fontesDaArte(): Promise<FonteDaArte[]> {
  carregadas ??= Promise.all([
    readFile(join(process.cwd(), "lib/bonus/fonte/Carlito-Regular.ttf")),
    readFile(join(process.cwd(), "lib/bonus/fonte/Carlito-Bold.ttf")),
  ]).then(
    ([regular, negrito]): FonteDaArte[] => [
      { name: FAMILIA_DA_ARTE, data: regular, weight: 400, style: "normal" },
      { name: FAMILIA_DA_ARTE, data: negrito, weight: 700, style: "normal" },
    ],
    (erro: unknown) => {
      carregadas = null;
      throw erro;
    }
  );
  return carregadas;
}
```

- [ ] **Passo 5: ver passar**

```bash
npx tsc --noEmit
npx vitest run tests/bonus-arte-fonte.test.ts
```

Esperado: 4 casos passam.

- [ ] **Passo 6: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/arte-fonte.ts lib/bonus/fonte/OFL.txt tests/bonus-arte-fonte.test.ts
test "$(git branch --show-current)" = "arte-do-carrossel"
git add lib/bonus/fonte/Carlito-Regular.ttf lib/bonus/fonte/Carlito-Bold.ttf lib/bonus/fonte/OFL.txt lib/bonus/arte-fonte.ts tests/bonus-arte-fonte.test.ts
git commit -m "feat(bonus): a fonte Carlito, sem modificação e com a licença, lida do disco"
```

---

### FASE 3.4 — A coluna `arte` e a conta no pedido

**Arquivos:**
- Criar: `migrations/015-arte-do-carrossel.sql`, `lib/bonus/arte-escolhas.ts`, `lib/bonus/arte-conta.ts`
- Modificar: `lib/esquema.ts` (1 entrada), `lib/bonus/carrossel-linha.ts`,
  `lib/bonus/carrossel-repositorio.ts`, `app/bonus/carrossel-actions.ts`,
  `tests/bonus-carrossel-tela.test.ts` (a linha de exemplo ganha `arte`)
- Testar: `tests/bonus-arte-escolhas.test.ts`, `tests/bonus-arte-conta.test.ts`,
  `testes-integracao/bonus-carrossel-tabela.integracao.ts`,
  `testes-integracao/bonus-carrossel-processo.integracao.ts`

**Interfaces:**
- Produz: a coluna `carrosseis_gerados.arte jsonb not null default '{}'`;
  `type EscolhasDaArte = { conta: string | null; soTexto: number[] }`,
  `escolhasDaArte(v, total)`, `comEspaco(e, numero)`;
  `type ContaDoCabecalho`, `type OrigemDaConta`, `resolverConta(contas, gravada, doCookie)`,
  `iniciais(nome, padrao)`; no repositório, `criarPedidoDeCarrossel({ ..., conta })`,
  `salvarEscolhasDaArte(id, escolhas): Promise<boolean>`, `contasParaArte(): Promise<ContaDoCabecalho[]>`.

- [ ] **Passo 1: os testes puros**

Crie `tests/bonus-arte-escolhas.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { comEspaco, escolhasDaArte } from "@/lib/bonus/arte-escolhas";

// AS ESCOLHAS DA ARTE lidas da coluna `arte` (migrations/015-arte-do-carrossel.sql). O que vem do
// banco não é confiável por forma: uma linha antiga tem `{}`, e uma escrita errada não pode quebrar
// a página. O que não tiver a forma certa volta ao padrão, que é "com espaço" e sem conta gravada.
describe("as escolhas da arte de um carrossel", () => {
  it("a linha antiga, sem nada, é a conta selecionada no Chat e todo slide com espaço", () => {
    expect(escolhasDaArte({}, 5)).toEqual({ conta: null, soTexto: [] });
  });

  it("lê a conta gravada e os slides só de texto, em ordem e sem repetir", () => {
    expect(escolhasDaArte({ conta: "17841400000000001", soTexto: [4, 2, 2] }, 5)).toEqual({
      conta: "17841400000000001",
      soTexto: [2, 4],
    });
  });

  it.each([null, "texto", [], 7])("forma errada inteira volta ao padrão: %j", (v) => {
    expect(escolhasDaArte(v, 5)).toEqual({ conta: null, soTexto: [] });
  });

  it("descarta o slide fora do total, o que não é inteiro e a conta vazia", () => {
    expect(escolhasDaArte({ conta: "", soTexto: [0, 1, 6, 2.5, "3", 5] }, 5)).toEqual({ conta: null, soTexto: [1, 5] });
  });

  it("com espaço é o padrão, e só texto é o que foi marcado", () => {
    const e = escolhasDaArte({ soTexto: [2] }, 3);
    expect([1, 2, 3].map((n) => comEspaco(e, n))).toEqual([true, false, true]);
  });
});
```

Crie `tests/bonus-arte-conta.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { iniciais, resolverConta, type ContaDoCabecalho } from "@/lib/bonus/arte-conta";

// A CONTA DO CABEÇALHO DA ARTE (decisões do Eduardo em 01/10): a gravada no carrossel; sem ela, a
// selecionada no Chat agora; e a gravada que foi desconectada cai na selecionada, com aviso
// (achado 61). A selecionada segue a regra do painel (lib/account.ts): o cookie, e sem ele a
// primeira conectada.

const conta = (id: string, username: string): ContaDoCabecalho => ({
  ig_user_id: id,
  username,
  name: `Nome de ${username}`,
  profile_picture_url: null,
});
const A = conta("1001", "thiagovannuchi");
const B = conta("1002", "outraconta");
const CONTAS = [A, B];

describe("qual conta vai no cabeçalho", () => {
  it("a gravada no carrossel, quando ela ainda está conectada", () => {
    expect(resolverConta(CONTAS, "1002", "1001")).toEqual({ conta: B, origem: "gravada" });
  });

  it("sem gravada, a selecionada pelo cookie do painel", () => {
    expect(resolverConta(CONTAS, null, "1002")).toEqual({ conta: B, origem: "selecionada" });
  });

  it("sem gravada e sem cookie válido, a primeira conectada, como o painel faz", () => {
    expect(resolverConta(CONTAS, null, undefined)).toEqual({ conta: A, origem: "selecionada" });
    expect(resolverConta(CONTAS, null, "9999")).toEqual({ conta: A, origem: "selecionada" });
  });

  it("a gravada que foi desconectada cai na selecionada, e diz que saiu (achado 61)", () => {
    expect(resolverConta(CONTAS, "7777", "1002")).toEqual({ conta: B, origem: "gravada_saiu" });
  });

  it("sem conta nenhuma conectada, não há cabeçalho", () => {
    expect(resolverConta([], "1001", "1001")).toEqual({ conta: null, origem: "gravada_saiu" });
    expect(resolverConta([], null, undefined)).toEqual({ conta: null, origem: "selecionada" });
  });
});

// AS INICIAIS, quando a foto não vem: a mesma regra do Labs (site-ia, src/lib/foto-de-perfil.ts).
describe("as iniciais no lugar da foto", () => {
  it.each([
    ["Thiago Vannuchi", "TV"],
    ["Método Chat Oficial", "MO"],
    ["thiago", "TH"],
    ["  ", "IG"],
    [null, "IG"],
  ])("%j vira %s", (nome, esperado) => {
    expect(iniciais(nome, "IG")).toBe(esperado);
  });
});
```

- [ ] **Passo 2: os testes de integração**

Em `testes-integracao/bonus-carrossel-tabela.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/bonus-carrossel-tabela.integracao.ts b/testes-integracao/bonus-carrossel-tabela.integracao.ts
index ff40984..71a8eb7 100644
--- a/testes-integracao/bonus-carrossel-tabela.integracao.ts
+++ b/testes-integracao/bonus-carrossel-tabela.integracao.ts
@@ -23,6 +23,8 @@ const COLUNAS = [
   "medicao",
   "gerado_em",
   "revisado_em",
+  // A 015 (Etapa 3): as escolhas da arte.
+  "arte",
 ];
 
 let bonusId: string;
@@ -57,14 +59,14 @@ describe("a tabela carrosseis_gerados", () => {
     expect(linhas.map((l) => l.column_name)).toEqual(COLUNAS);
   });
 
-  it("uma linha nova nasce pendente, sem texto e sem revisão", async () => {
+  it("uma linha nova nasce pendente, sem texto, sem revisão e sem escolha de arte", async () => {
     const [linha] = (await banco
       .db()
       .sql()
       .query(
         `insert into carrosseis_gerados (bonus_id, total_slides, palavra, contexto)
          values ($1, 10, 'SUMIDO', $2::jsonb)
-         returning estado, gerado, revisado, revisado_em, contexto`,
+         returning estado, gerado, revisado, revisado_em, contexto, arte`,
         [bonusId, { tema: "Vendas" }]
       )) as Record<string, unknown>[];
     expect(linha).toEqual({
@@ -73,9 +75,22 @@ describe("a tabela carrosseis_gerados", () => {
       revisado: null,
       revisado_em: null,
       contexto: { tema: "Vendas" },
+      arte: {},
     });
   });
 
+  it("a arte não aceita null: a linha antiga ganha {} da 015", async () => {
+    await expect(
+      banco
+        .db()
+        .sql()
+        .query(
+          `insert into carrosseis_gerados (bonus_id, total_slides, palavra, contexto, arte) values ($1, 5, 'SUMIDO', '{}'::jsonb, null)`,
+          [bonusId]
+        )
+    ).rejects.toThrow(/null value in column "arte"/);
+  });
+
   it.each([0, 11])("o banco recusa total de %i slides", async (total) => {
     await expect(
       banco
```

Em `testes-integracao/bonus-carrossel-processo.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/bonus-carrossel-processo.integracao.ts b/testes-integracao/bonus-carrossel-processo.integracao.ts
index 6e22eb2..9895af1 100644
--- a/testes-integracao/bonus-carrossel-processo.integracao.ts
+++ b/testes-integracao/bonus-carrossel-processo.integracao.ts
@@ -56,7 +56,13 @@ beforeEach(async () => {
   bonusId = b.id;
 });
 
-const pedido = (total: number) => ({ bonusId, total, palavra: "SUMIDO", contexto: CONTEXTO });
+const pedido = (total: number, conta: string | null = null) => ({
+  bonusId,
+  total,
+  palavra: "SUMIDO",
+  contexto: CONTEXTO,
+  conta,
+});
 
 async function criado(total: number): Promise<string> {
   const r = await repo.criarPedidoDeCarrossel(pedido(total));
@@ -215,3 +221,51 @@ describe("a revisão e a lista", () => {
     expect(await repo.lerCarrossel("nao-e-uuid")).toBeNull();
   });
 });
+
+// A ARTE (Etapa 3): a conta do cabeçalho gravada no pedido, as escolhas gravadas só em carrossel
+// pronto, e as contas lidas SÓ pelas colunas do cabeçalho: a tabela `accounts` guarda o token de
+// acesso de cada conta, e ele nunca sai daqui (achado 60).
+describe("a arte", () => {
+  it("o pedido grava a conta do cabeçalho; sem conta, a arte nasce vazia", async () => {
+    const r = await repo.criarPedidoDeCarrossel(pedido(5, "17841400000000001"));
+    const semConta = await criado(3);
+    if (!r.ok) throw new Error("teto no meio do teste");
+    expect((await repo.lerCarrossel(r.id))?.arte).toEqual({ conta: "17841400000000001" });
+    expect((await repo.lerCarrossel(semConta))?.arte).toEqual({});
+  });
+
+  it("as escolhas só se gravam em carrossel pronto, e gravam inteiras", async () => {
+    const pronto = await criado(5);
+    await processo.processarCarrossel(pronto, devolve(TEXTO));
+    const escolhas = { conta: "17841400000000002", soTexto: [2, 4] };
+    expect(await repo.salvarEscolhasDaArte(pronto, escolhas)).toBe(true);
+    expect((await repo.lerCarrossel(pronto))?.arte).toEqual(escolhas);
+
+    const pendente = await criado(5);
+    expect(await repo.salvarEscolhasDaArte(pendente, escolhas)).toBe(false);
+    expect((await repo.lerCarrossel(pendente))?.arte).toEqual({});
+  });
+
+  it("as contas do cabeçalho vêm só com as quatro colunas, na ordem do painel, e nunca com o token", async () => {
+    await banco.db().sql().query(`delete from accounts`);
+    await banco
+      .db()
+      .sql()
+      .query(
+        `insert into accounts (ig_user_id, username, name, profile_picture_url, access_token, created_at) values
+         ('1002', 'segunda', 'Segunda Conta', null, 'token-de-teste-2', now()),
+         ('1001', 'primeira', 'Primeira Conta', 'https://scontent-gru2-1.cdninstagram.com/v/foto.jpg', 'token-de-teste-1', now() - interval '1 day')`
+      );
+    const contas = await repo.contasParaArte();
+    expect(contas).toEqual([
+      {
+        ig_user_id: "1001",
+        username: "primeira",
+        name: "Primeira Conta",
+        profile_picture_url: "https://scontent-gru2-1.cdninstagram.com/v/foto.jpg",
+      },
+      { ig_user_id: "1002", username: "segunda", name: "Segunda Conta", profile_picture_url: null },
+    ]);
+    expect(JSON.stringify(contas)).not.toContain("token-de-teste");
+  });
+});
```

- [ ] **Passo 3: ver falhar**

```bash
npx vitest run tests/bonus-arte-escolhas.test.ts tests/bonus-arte-conta.test.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-carrossel-tabela.integracao.ts testes-integracao/bonus-carrossel-processo.integracao.ts
```

Esperado: os dois puros caem sem rodar caso nenhum (`Cannot find package`); na integração, a
coluna `arte` não existe (`column "arte" does not exist`) e `salvarEscolhasDaArte` e
`contasParaArte` não são funções.

- [ ] **Passo 4: a migração e a declaração**

Crie `migrations/015-arte-do-carrossel.sql`:

```sql
-- A ARTE DO CARROSSEL (Etapa 3 do gerador de bônus): as escolhas do operador para desenhar os
-- slides em PNG. O desenho inteiro está em docs/specs/2026-10-01-arte-do-carrossel.md.
--
-- `arte` guarda a conta do Instagram do cabeçalho (`conta`, o ig_user_id) e os slides marcados
-- como "só texto" (`soTexto`, números de 1 ao total). Nenhum PNG é guardado: cada slide é
-- desenhado na hora, a partir do texto salvo.
--
-- COLUNA DE FEATURE, como a 014: entra em `naoObservaveis` de lib/esquema.ts, e quem confere é
-- testes-integracao/bonus-carrossel-tabela.integracao.ts.
--
-- Os carrosséis que já existem ganham `{}`: até o operador escolher, a arte usa a conta
-- selecionada no Chat. IDEMPOTENTE, como toda migração desta pasta: `add column if not exists`.
alter table carrosseis_gerados
  add column if not exists arte jsonb not null default '{}'::jsonb;
```

Rode só a tabela e a partida, para ver a guarda do dono enxergar a migração nova:

```bash
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/esquema-de-partida.integracao.ts
```

Esperado: `esquema-de-partida` cai no caso "a MARCA D'ÁGUA cobre a pasta inteira", nomeando
`015-arte-do-carrossel.sql`. Declare:

Em `lib/esquema.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/esquema.ts b/lib/esquema.ts
index c267e13..2910b55 100644
--- a/lib/esquema.ts
+++ b/lib/esquema.ts
@@ -224,6 +224,15 @@ const MARCA_DAGUA = {
       porque:
         "tabela de FEATURE (carrosseis_gerados): a partida do painel não depende dela, de propósito",
     },
+    {
+      de: "015-arte-do-carrossel.sql",
+      // A COLUNA `arte` DA MESMA TABELA DE FEATURE, pelo mesmo motivo da 014: só a arte do
+      // carrossel (app/bonus/) a lê, e ela não pode impedir o painel inteiro de subir. Quem
+      // confere é testes-integracao/bonus-carrossel-tabela.integracao.ts. Decidido pelo Eduardo
+      // em 01/10/2026 (docs/specs/2026-10-01-arte-do-carrossel.md).
+      porque:
+        "coluna de FEATURE (carrosseis_gerados.arte): a partida do painel não depende dela, de propósito",
+    },
   ],
   // A migração que cria as oito tabelas de `tabelas`, acima.
   base: "000-esquema-base.sql",
```

- [ ] **Passo 5: os dois módulos puros**

Crie `lib/bonus/arte-escolhas.ts`:

```ts
// AS ESCOLHAS DA ARTE de um carrossel: a coluna `arte` (migrations/015-arte-do-carrossel.sql).
//
// PURO. `conta` é o ig_user_id da conta do cabeçalho (null: a selecionada no Chat). `soTexto` são
// os slides sem o espaço da imagem; os outros saem "com espaço", que é o padrão, como no Labs.
//
// ⚠️ GRAVAR O "SÓ TEXTO" É DIFERENTE DO LABS, de propósito (spec da Etapa 3): lá a escolha não é
// gravada, porque a presença da ilustração já a responde (ROADMAP do Labs, 22.6). No Chat não há
// ilustração guardada, e o PNG baixado amanhã tem de sair igual à prévia de hoje.

export type EscolhasDaArte = { conta: string | null; soTexto: number[] };

/**
 * As escolhas lidas do banco. O que não tiver a forma certa volta ao padrão, e não quebra a
 * página: uma linha anterior à 015 tem `{}`.
 */
export function escolhasDaArte(v: unknown, total: number): EscolhasDaArte {
  const o = v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const conta = typeof o.conta === "string" && o.conta ? o.conta : null;
  const lista = Array.isArray(o.soTexto) ? o.soTexto : [];
  const soTexto = [...new Set(lista.filter((n): n is number => Number.isInteger(n) && n >= 1 && n <= total))].sort(
    (a, b) => a - b
  );
  return { conta, soTexto };
}

/** "Com espaço" é o padrão; "só texto" é o que o operador marcou. */
export function comEspaco(e: EscolhasDaArte, numero: number): boolean {
  return !e.soTexto.includes(numero);
}
```

Crie `lib/bonus/arte-conta.ts`:

```ts
// A CONTA DO CABEÇALHO DA ARTE: qual conta do Instagram assina os slides. PURO.
//
// A regra é do Eduardo (01/10): a conta gravada no carrossel; sem ela, a selecionada no Chat agora;
// e a gravada que foi desconectada cai na selecionada, com aviso na tela (achado 61). A
// selecionada segue a regra do painel (lib/account.ts, `getSelectedAccount`): a do cookie, e sem
// ela a primeira conectada. Esta função não lê o cookie nem o banco: recebe os dois.

/** Só as colunas que o cabeçalho usa, e nunca o token (achado 60). */
export type ContaDoCabecalho = {
  ig_user_id: string;
  username: string | null;
  name: string | null;
  profile_picture_url: string | null;
};

export type OrigemDaConta = "gravada" | "selecionada" | "gravada_saiu";

export function resolverConta(
  contas: ContaDoCabecalho[],
  gravada: string | null,
  doCookie: string | undefined
): { conta: ContaDoCabecalho | null; origem: OrigemDaConta } {
  const achada = gravada ? contas.find((c) => c.ig_user_id === gravada) : undefined;
  if (achada) return { conta: achada, origem: "gravada" };
  const selecionada = contas.find((c) => c.ig_user_id === doCookie) ?? contas[0] ?? null;
  return { conta: selecionada, origem: gravada ? "gravada_saiu" : "selecionada" };
}

/**
 * As iniciais no lugar da foto, com a regra do Labs (site-ia, src/lib/foto-de-perfil.ts): duas
 * letras do nome de uma palavra, ou a primeira e a última de duas ou mais. `padrao` é o que sai
 * sem nome nenhum.
 */
export function iniciais(nome: string | null | undefined, padrao: string): string {
  const partes = (nome ?? "").trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return padrao;
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}
```

- [ ] **Passo 6: a linha, o repositório, a action e a linha de exemplo do teste da tela**

Em `lib/bonus/carrossel-linha.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/carrossel-linha.ts b/lib/bonus/carrossel-linha.ts
index c73d493..2c81a06 100644
--- a/lib/bonus/carrossel-linha.ts
+++ b/lib/bonus/carrossel-linha.ts
@@ -16,4 +16,6 @@ export type LinhaDoCarrossel = {
   medicao: unknown;
   gerado_em: Date | null;
   revisado_em: Date | null;
+  /** As escolhas da arte (migrations/015-arte-do-carrossel.sql), lidas por `escolhasDaArte`. */
+  arte: unknown;
 };
```

Em `lib/bonus/carrossel-repositorio.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/carrossel-repositorio.ts b/lib/bonus/carrossel-repositorio.ts
index d2f90fd..c87c4d7 100644
--- a/lib/bonus/carrossel-repositorio.ts
+++ b/lib/bonus/carrossel-repositorio.ts
@@ -1,5 +1,7 @@
 import "server-only";
 import { sql } from "@/lib/db";
+import type { ContaDoCabecalho } from "./arte-conta";
+import type { EscolhasDaArte } from "./arte-escolhas";
 import type { ContextoDoCarrossel } from "./carrossel-ia-parametros";
 import type { LinhaDoCarrossel } from "./carrossel-linha";
 import { TETO_CARROSSEL_DIARIO } from "./carrossel-pedido";
@@ -25,12 +27,17 @@ export async function carrosseisNasUltimas24h(): Promise<number> {
   return linha?.n ?? 0;
 }
 
-/** CONTAR E INSERIR NA MESMA TRANSAÇÃO, COM TRAVA: dois cliques com 9 no dia não fazem 11. */
+/**
+ * CONTAR E INSERIR NA MESMA TRANSAÇÃO, COM TRAVA: dois cliques com 9 no dia não fazem 11.
+ * `conta` é a conta do cabeçalho da arte, gravada no pedido (spec da Etapa 3): sem conta, a arte
+ * nasce `{}` e usa a selecionada no Chat.
+ */
 export async function criarPedidoDeCarrossel(p: {
   bonusId: string;
   total: number;
   palavra: string;
   contexto: ContextoDoCarrossel;
+  conta: string | null;
 }): Promise<{ ok: true; id: string } | { ok: false }> {
   return sql().begin(async (tx) => {
     await tx.query(`select pg_advisory_xact_lock($1::bigint)`, [TRAVA_DO_TETO_DO_CARROSSEL]);
@@ -39,9 +46,9 @@ export async function criarPedidoDeCarrossel(p: {
     )) as { n: number }[];
     if ((contagem?.n ?? 0) >= TETO_CARROSSEL_DIARIO) return { ok: false as const };
     const [criada] = (await tx.query(
-      `insert into carrosseis_gerados (bonus_id, total_slides, palavra, contexto)
-       values ($1, $2, $3, $4::jsonb) returning id`,
-      [p.bonusId, p.total, p.palavra, p.contexto]
+      `insert into carrosseis_gerados (bonus_id, total_slides, palavra, contexto, arte)
+       values ($1, $2, $3, $4::jsonb, $5::jsonb) returning id`,
+      [p.bonusId, p.total, p.palavra, p.contexto, p.conta ? { conta: p.conta } : {}]
     )) as { id: string }[];
     return { ok: true as const, id: criada.id };
   });
@@ -98,3 +105,24 @@ export async function salvarRevisaoDoCarrossel(id: string, texto: TextoDoCarross
   )) as { id: string }[];
   return linhas.length > 0;
 }
+
+/** As escolhas da arte só valem para carrossel pronto. Devolve falso quando a linha não estava pronta. */
+export async function salvarEscolhasDaArte(id: string, escolhas: EscolhasDaArte): Promise<boolean> {
+  const linhas = (await sql().query(
+    `update carrosseis_gerados set arte = $2::jsonb where id = $1 and estado = 'pronto' returning id`,
+    [id, escolhas]
+  )) as { id: string }[];
+  return linhas.length > 0;
+}
+
+/**
+ * AS CONTAS PARA O CABEÇALHO DA ARTE, NA ORDEM DO PAINEL (lib/account.ts cai na primeira por
+ * `created_at`). SÓ AS QUATRO COLUNAS, de propósito (achado 60): `accounts` guarda o token de
+ * acesso de cada conta, e `listAccounts` (lib/db.ts) lê `*`. tests/bonus-arte-paginas.test.ts
+ * cobra que a arte não lê a tabela por outro caminho.
+ */
+export async function contasParaArte(): Promise<ContaDoCabecalho[]> {
+  return (await sql().query(
+    `select ig_user_id, username, name, profile_picture_url from accounts order by created_at asc`
+  )) as ContaDoCabecalho[];
+}
```

Em `app/bonus/carrossel-actions.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/carrossel-actions.ts b/app/bonus/carrossel-actions.ts
index d0f8862..f934cbd 100644
--- a/app/bonus/carrossel-actions.ts
+++ b/app/bonus/carrossel-actions.ts
@@ -2,11 +2,18 @@
 import { after } from "next/server";
 import { cookies } from "next/headers";
 import { redirect } from "next/navigation";
+import { ACCOUNT_COOKIE } from "@/lib/account";
 import { isValidSession, SESSION_COOKIE } from "@/lib/auth";
+import { resolverConta } from "@/lib/bonus/arte-conta";
 import type { ContextoDoCarrossel } from "@/lib/bonus/carrossel-ia-parametros";
 import { lerPedidoDeCarrossel } from "@/lib/bonus/carrossel-pedido";
 import { processarCarrossel } from "@/lib/bonus/carrossel-processo";
-import { criarPedidoDeCarrossel, lerCarrossel, salvarRevisaoDoCarrossel as gravarRevisao } from "@/lib/bonus/carrossel-repositorio";
+import {
+  contasParaArte,
+  criarPedidoDeCarrossel,
+  lerCarrossel,
+  salvarRevisaoDoCarrossel as gravarRevisao,
+} from "@/lib/bonus/carrossel-repositorio";
 import { textoDaLinhaDoCarrossel } from "@/lib/bonus/carrossel-tela";
 import { camposDoFormulario, lerRevisaoDoCarrossel } from "@/lib/bonus/carrossel-texto";
 import {
@@ -44,6 +51,15 @@ async function exigirSessao(): Promise<void> {
   if (!isValidSession(jarra.get(SESSION_COOKIE)?.value)) redirect("/entrar");
 }
 
+/**
+ * A CONTA DO CABEÇALHO DA ARTE, gravada no pedido: a selecionada no Chat agora (spec da Etapa 3).
+ * Gravar na primeira visita seria uma escrita dentro de um GET; o pedido já é uma escrita.
+ */
+async function contaDoPedido(): Promise<string | null> {
+  const jarra = await cookies();
+  return resolverConta(await contasParaArte(), null, jarra.get(ACCOUNT_COOKIE)?.value).conta?.ig_user_id ?? null;
+}
+
 /** O bônus pronto para carrossel: criado no Labs e publicado lá. Qualquer outra coisa é recusa. */
 async function bonusParaCarrossel(
   bonusId: string
@@ -89,6 +105,7 @@ export async function pedirCarrossel(
     total: lido.pedido.total,
     palavra: bonus.palavra,
     contexto: bonus.contexto,
+    conta: await contaDoPedido(),
   });
   if (!criado.ok) return recusa(textoDoTetoDoCarrossel());
   const id = criado.id;
@@ -116,6 +133,7 @@ export async function gerarCarrosselDeNovo(form: FormData): Promise<void> {
     total: linha.total_slides,
     palavra: bonus.palavra,
     contexto: bonus.contexto,
+    conta: await contaDoPedido(),
   });
   if (!criado.ok) redirect(urlDoCarrosselComAviso(linha.bonus_id, id, { tom: "erro", texto: textoDoTetoDoCarrossel() }));
   const novo = criado.id;
```

Em `tests/bonus-carrossel-tela.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-carrossel-tela.test.ts b/tests/bonus-carrossel-tela.test.ts
index d914a5a..64f1948 100644
--- a/tests/bonus-carrossel-tela.test.ts
+++ b/tests/bonus-carrossel-tela.test.ts
@@ -28,6 +28,7 @@ function linha(troca: Partial<LinhaDoCarrossel>): LinhaDoCarrossel {
     medicao: null,
     gerado_em: new Date(T0),
     revisado_em: null,
+    arte: {},
     ...troca,
   };
 }
```

- [ ] **Passo 7: ver passar**

```bash
npx tsc --noEmit
npx vitest run tests/bonus-arte-escolhas.test.ts tests/bonus-arte-conta.test.ts tests/bonus-carrossel-tela.test.ts tests/bonus-carrossel-paginas.test.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-carrossel-tabela.integracao.ts testes-integracao/bonus-carrossel-processo.integracao.ts testes-integracao/esquema-de-partida.integracao.ts
```

Esperado: `tsc` limpo; os puros passam; `[rede-global] ALVO: banco de TESTE` e 30 casos de
integração passam.

- [ ] **Passo 8: varrer e commitar**

```bash
F="migrations/015-arte-do-carrossel.sql lib/esquema.ts lib/bonus/carrossel-linha.ts lib/bonus/arte-escolhas.ts lib/bonus/arte-conta.ts lib/bonus/carrossel-repositorio.ts app/bonus/carrossel-actions.ts tests/bonus-arte-escolhas.test.ts tests/bonus-arte-conta.test.ts tests/bonus-carrossel-tela.test.ts testes-integracao/bonus-carrossel-tabela.integracao.ts testes-integracao/bonus-carrossel-processo.integracao.ts"
node "$SCRATCH/varrer-texto.mjs" $F
test "$(git branch --show-current)" = "arte-do-carrossel"
git add $F
git commit -m "feat(bonus): a coluna arte, e a conta do cabeçalho gravada no pedido do carrossel"
```

---

### FASE 3.5 — A foto da conta

**Arquivos:**
- Criar: `lib/bonus/arte-foto.ts`
- Testar: `tests/bonus-arte-foto.test.ts`

**Interfaces:**
- Produz: `FOTO_MAX_BYTES = 512 * 1024`, `FOTO_TEMPO_MS = 3_000`, `urlDeFotoAceita(bruta): URL | null`,
  `fotoDaConta(url, fetchImpl = fetch): Promise<string | null>` (um `data:` URI, ou null).

- [ ] **Passo 1: o teste**

Crie `tests/bonus-arte-foto.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { FOTO_MAX_BYTES, FOTO_TEMPO_MS, fotoDaConta, urlDeFotoAceita } from "@/lib/bonus/arte-foto";

// A FOTO DA CONTA NO CABEÇALHO DA ARTE, buscada pela própria rota. A URL vem do banco (a Meta a dá),
// e a rota é um servidor buscando um endereço: as travas são o que impede essa busca de ir a outro
// lugar (spec da Etapa 3, "O cabeçalho e a foto"). Toda falha devolve null: o cabeçalho sai com as
// iniciais, e a peça sai.

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 1]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48]);
const FOTO = "https://scontent-gru2-1.cdninstagram.com/v/t51.2885-19/foto.jpg?stp=dst-jpg";

const resposta = (status: number, corpo: Uint8Array | string = new Uint8Array()) =>
  new Response(typeof corpo === "string" ? corpo : Buffer.from(corpo), { status });
const buscador = (f: () => Promise<Response>) => vi.fn(f) as unknown as typeof fetch & ReturnType<typeof vi.fn>;

describe("a URL da foto aceita", () => {
  it.each([
    FOTO,
    "https://scontent-gru1-2.cdninstagram.com/v/foto.jpg",
    "https://instagram.fgru5-1.fna.fbcdn.net/v/foto.jpg",
  ])("aceita o CDN da Meta em https: %s", (url) => {
    expect(urlDeFotoAceita(url)?.toString()).toBe(new URL(url).toString());
  });

  it.each([
    ["http, sem o s", "http://scontent-gru2-1.cdninstagram.com/v/foto.jpg"],
    ["o domínio de outro, com o da Meta no começo", "https://cdninstagram.com.exemplo.com/foto.jpg"],
    ["o domínio de outro, colado no da Meta", "https://falsocdninstagram.com/foto.jpg"],
    ["usuário e senha na URL", "https://usuario:senha@scontent-gru2-1.cdninstagram.com/foto.jpg"],
    ["outra porta", "https://scontent-gru2-1.cdninstagram.com:8443/foto.jpg"],
    ["endereço interno", "https://169.254.169.254/latest/meta-data"],
    ["outro esquema", "file:///etc/passwd"],
    ["não é URL", "foto.jpg"],
  ])("recusa %s", (_nome, url) => {
    expect(urlDeFotoAceita(url)).toBeNull();
  });
});

describe("a busca da foto", () => {
  it("JPEG vira data: URI, buscado sem seguir redirect, sem cache e com prazo", async () => {
    const f = buscador(async () => resposta(200, JPEG));
    expect(await fotoDaConta(FOTO, f)).toBe(`data:image/jpeg;base64,${Buffer.from(JPEG).toString("base64")}`);
    expect(f).toHaveBeenCalledTimes(1);
    const [url, opcoes] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(new URL(FOTO).toString());
    expect(opcoes).toMatchObject({ method: "GET", redirect: "manual", cache: "no-store" });
    expect(opcoes.signal).toBeInstanceOf(AbortSignal);
  });

  it("PNG também", async () => {
    expect(await fotoDaConta(FOTO, buscador(async () => resposta(200, PNG)))).toBe(
      `data:image/png;base64,${Buffer.from(PNG).toString("base64")}`
    );
  });

  it("sem URL, ou com URL recusada, nem busca", async () => {
    const f = buscador(async () => resposta(200, JPEG));
    expect(await fotoDaConta(null, f)).toBeNull();
    expect(await fotoDaConta("https://exemplo.com/foto.jpg", f)).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  it.each([301, 302, 404, 500])("status %i é sem foto, e o redirect não é seguido", async (status) => {
    const f = buscador(async () => resposta(status, JPEG));
    expect(await fotoDaConta(FOTO, f)).toBeNull();
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("erro de rede ou prazo esgotado é sem foto", async () => {
    const f = buscador(async () => {
      throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    });
    expect(await fotoDaConta(FOTO, f)).toBeNull();
  });

  it("passar do teto de bytes é sem foto", async () => {
    const gorda = new Uint8Array(FOTO_MAX_BYTES + 1);
    gorda.set(JPEG);
    expect(await fotoDaConta(FOTO, buscador(async () => resposta(200, gorda)))).toBeNull();
  });

  // O formato vem dos BYTES, e não do Content-Type, que quem responde escolhe. O Satori derruba a
  // peça inteira com formato que não desenha (a lição do WebP no Labs, 03/09).
  it.each([
    ["WebP", "RIFF\u0000\u0000\u0000\u0000WEBPVP8 "],
    ["SVG", "<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"],
    ["GIF", "GIF89a\u0001\u0000\u0001\u0000"],
    ["HTML", "<html>não é foto</html>"],
  ])("%s é sem foto", async (_nome, corpo) => {
    expect(await fotoDaConta(FOTO, buscador(async () => resposta(200, corpo)))).toBeNull();
  });

  it("o prazo e o teto são os da spec", () => {
    expect(FOTO_TEMPO_MS).toBe(3_000);
    expect(FOTO_MAX_BYTES).toBe(512 * 1024);
  });
});
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-arte-foto.test.ts
```

Esperado: o arquivo cai sem rodar caso nenhum, com `Cannot find package '@/lib/bonus/arte-foto'`.

- [ ] **Passo 3: o código**

A lista de domínios vem de uma medição só leitura de 01/10 (as 4 contas conectadas têm a foto em
`scontent-*.cdninstagram.com`). Nenhuma URL foi impressa.

Crie `lib/bonus/arte-foto.ts`:

```ts
// A FOTO DA CONTA NO CABEÇALHO DA ARTE, buscada pela própria rota da arte.
//
// A URL vem de `accounts.profile_picture_url` (a Meta a dá, e o cron diário a renova), e NUNCA do
// formulário. Mesmo assim, a rota é um servidor buscando um endereço, e as travas são o que impede
// essa busca de ir a outro lugar (spec da Etapa 3, "O cabeçalho e a foto"):
// - só `https`, sem usuário nem senha na URL, na porta padrão;
// - só os domínios do CDN da Meta. Medido em 01/10, só leitura: as 4 contas conectadas têm a foto
//   em `scontent-*.cdninstagram.com`. O `fbcdn.net` é o outro CDN de imagem da Meta;
// - sem seguir redirect, com prazo de 3 s e teto de 512 KiB;
// - só JPEG e PNG, reconhecidos pelos BYTES, e não pelo Content-Type, que quem responde escolhe. O
//   Satori derruba a peça inteira com formato que não desenha (o WebP, no Labs, em 03/09).
//
// A IMAGEM ENTRA NO SATORI COMO `data:` URI, DEPOIS desta busca. Com a URL no `<img>`, o Satori
// buscaria sozinho, por fora das travas.
//
// Toda falha devolve null, e o cabeçalho sai com as iniciais: perder o rosto é pequeno, perder a
// peça é perder o trabalho (a regra do Labs, src/lib/foto-de-perfil.ts).

export const FOTO_MAX_BYTES = 512 * 1024;
export const FOTO_TEMPO_MS = 3_000;

const DOMINIOS_DA_META = ["cdninstagram.com", "fbcdn.net"];

/** A URL, se ela for de foto aceita; null em qualquer outro caso. */
export function urlDeFotoAceita(bruta: string): URL | null {
  let u: URL;
  try {
    u = new URL(bruta);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.username || u.password || (u.port && u.port !== "443")) return null;
  const host = u.hostname.toLowerCase();
  return DOMINIOS_DA_META.some((d) => host === d || host.endsWith(`.${d}`)) ? u : null;
}

/** JPEG ou PNG pelos bytes iniciais, que o formato define e o remetente não escolhe. */
function tipoDaFoto(b: Uint8Array): "jpeg" | "png" | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (b.length >= 8 && png.every((v, i) => b[i] === v)) return "png";
  return null;
}

/** Lê o corpo inteiro, ou null se ele passar do teto (o leitor é cancelado). */
async function bytesAteOTeto(res: Response, teto: number): Promise<Uint8Array | null> {
  if (!res.body) return new Uint8Array();
  const leitor = res.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.byteLength;
    if (total > teto) {
      await leitor.cancel();
      return null;
    }
    partes.push(value);
  }
  return new Uint8Array(Buffer.concat(partes));
}

export async function fotoDaConta(url: string | null, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  const aceita = url ? urlDeFotoAceita(url) : null;
  if (!aceita) return null;
  let res: Response;
  try {
    res = await fetchImpl(aceita.toString(), {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(FOTO_TEMPO_MS),
    });
  } catch {
    return null;
  }
  if (res.status !== 200) return null;
  let bytes: Uint8Array | null;
  try {
    bytes = await bytesAteOTeto(res, FOTO_MAX_BYTES);
  } catch {
    return null;
  }
  const tipo = bytes ? tipoDaFoto(bytes) : null;
  if (!bytes || !tipo) return null;
  return `data:image/${tipo};base64,${Buffer.from(bytes).toString("base64")}`;
}
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx vitest run tests/bonus-arte-foto.test.ts
```

Esperado: 25 casos passam, inclusive o endereço interno (`169.254.169.254`) e o domínio colado no
da Meta, recusados.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/arte-foto.ts tests/bonus-arte-foto.test.ts
test "$(git branch --show-current)" = "arte-do-carrossel"
git add lib/bonus/arte-foto.ts tests/bonus-arte-foto.test.ts
git commit -m "feat(bonus): a foto da conta, buscada só do CDN da Meta, com prazo, teto e formato pelos bytes"
```

---

### FASE 3.6 — O desenho e a rota

**Arquivos:**
- Criar: `lib/bonus/arte-tela.ts`, `lib/bonus/arte-textos.ts`, `lib/bonus/arte-desenho.tsx`,
  `lib/bonus/arte-resposta.tsx`, `app/bonus/[id]/carrossel/[cid]/arte/route.tsx`
- Testar: `tests/bonus-arte-tela.test.ts`, `tests/bonus-arte-resposta.test.ts`,
  `tests/bonus-arte-paginas.test.ts`, `testes-integracao/bonus-arte-rota.integracao.ts`

**Interfaces:**
- Consome: `slidesDoTexto`, `textoMedido`, `tamanhoDoTexto` (3.2); `fontesDaArte` (3.3);
  `escolhasDaArte`, `comEspaco`, `resolverConta`, `contasParaArte` (3.4); `fotoDaConta` (3.5).
- Produz: de `arte-tela.ts`, `type CabecalhoDaArte`, `numeroDoSlide`, `nomeDoArquivo`,
  `cabecalhosDaArte`, `cabecalhoDaConta`, `versaoDaArte`, `urlDaArte(bonusId, carrosselId, numero, versao, baixar = false)`,
  `conferirPedidoDaArte(linha, bonusId, slide)` (o dono, o "pronto" e a faixa do slide);
  de `arte-textos.ts`, as recusas da rota; `desenhoDoSlide({ slide, fonte, comEspaco, cabecalho, familia })`;
  `respostaDaArte({ slide, comEspaco, cabecalho, baixar, nomeDoArquivo }): Promise<Response>`; e a rota `GET`.

- [ ] **Passo 1: os testes**

Crie `tests/bonus-arte-tela.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  cabecalhoDaConta,
  cabecalhosDaArte,
  conferirPedidoDaArte,
  nomeDoArquivo,
  numeroDoSlide,
  urlDaArte,
  versaoDaArte,
} from "@/lib/bonus/arte-tela";
import { TEXTO_ARTE_NAO_ENCONTRADA, TEXTO_ARTE_NAO_PRONTA, TEXTO_ARTE_SLIDE_INVALIDO } from "@/lib/bonus/arte-textos";
import type { LinhaDoCarrossel } from "@/lib/bonus/carrossel-linha";

// O QUE A ROTA DA ARTE E A TELA DECIDEM, fora do JSX e da rota: o número do slide pedido, o nome do
// arquivo baixado, os cabeçalhos da resposta, o cabeçalho da peça e a versão da prévia.

const BONUS = "0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f";
const CARROSSEL = "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d";

describe("o número do slide pedido", () => {
  it.each([
    ["1", 10, 1],
    ["10", 10, 10],
    ["3", 3, 3],
  ])("%s de %i é o slide %i", (v, total, esperado) => {
    expect(numeroDoSlide(v, total)).toBe(esperado);
  });

  it.each([[null], [""], ["0"], ["11"], ["2.5"], ["-1"], ["1e1"], [" 2"], ["02"], ["abc"]])("%j de 10 é recusado", (v) => {
    expect(numeroDoSlide(v, 10)).toBeNull();
  });
});

describe("o arquivo baixado", () => {
  it("leva o endereço do bônus e o número do slide com dois dígitos", () => {
    expect(nomeDoArquivo("reativar-clientes-whatsapp", 3)).toBe("reativar-clientes-whatsapp-slide-03.png");
    expect(nomeDoArquivo("reativar-clientes-whatsapp", 10)).toBe("reativar-clientes-whatsapp-slide-10.png");
  });

  // O nome vai para dentro de um cabeçalho HTTP: só letras minúsculas, números e hífen passam.
  it("sem endereço, ou com caractere fora do padrão, não deixa nada passar para o cabeçalho", () => {
    expect(nomeDoArquivo(null, 1)).toBe("carrossel-slide-01.png");
    expect(nomeDoArquivo('ruim"; filename=x.exe', 2)).toBe("ruimfilenamexexe-slide-02.png");
  });
});

// ⚠️ A RESPOSTA NUNCA SAI COMO `public` (achado 59): fora do desenvolvimento, o ImageResponse de
// next/og responde `public, max-age=0, must-revalidate` (node_modules/next/dist/server/og/
// image-response.js), e os `headers` que se passam a ele sobrescrevem esse padrão. Imagem com
// texto do painel, atrás de sessão, não fica em cache nenhum.
describe("os cabeçalhos da resposta", () => {
  it("a prévia abre no navegador, sem cache", () => {
    expect(cabecalhosDaArte(false, "x-slide-01.png")).toEqual({
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline",
    });
  });

  it("o baixar vira download, com o nome do arquivo", () => {
    expect(cabecalhosDaArte(true, "x-slide-01.png")).toEqual({
      "Cache-Control": "private, no-store",
      "Content-Disposition": 'attachment; filename="x-slide-01.png"',
    });
  });
});

describe("o cabeçalho da peça", () => {
  const conta = { ig_user_id: "1001", username: "thiagovannuchi", name: "Thiago Vannuchi", profile_picture_url: null };

  it("o nome, o @ e a foto da conta", () => {
    expect(cabecalhoDaConta(conta, "data:image/jpeg;base64,AAAA")).toEqual({
      nome: "Thiago Vannuchi",
      arroba: "thiagovannuchi",
      foto: "data:image/jpeg;base64,AAAA",
      iniciais: "TV",
    });
  });

  it("sem nome, o @ faz as vezes de nome; sem foto, ficam as iniciais", () => {
    expect(cabecalhoDaConta({ ...conta, name: null }, null)).toEqual({
      nome: "thiagovannuchi",
      arroba: "thiagovannuchi",
      foto: null,
      iniciais: "TH",
    });
  });
});

// A VERSÃO DA PRÉVIA leva TUDO o que muda a imagem: a `<img>` só pede de novo quando a URL muda, e
// a rota responde `no-store`, então quem decide se a miniatura troca é esta versão.
describe("a versão da prévia", () => {
  it("é a mesma para as mesmas partes, e muda quando qualquer uma muda", () => {
    const partes = ["2026-10-01T12:00:00.000Z", '{"soTexto":[2]}', "Thiago Vannuchi", "thiagovannuchi", "https://foto"];
    const v = versaoDaArte(partes);
    expect(versaoDaArte([...partes])).toBe(v);
    for (let i = 0; i < partes.length; i++) {
      const outra = [...partes];
      outra[i] = `${outra[i]}!`;
      expect(versaoDaArte(outra), `parte ${i}`).not.toBe(v);
    }
    expect(v).toMatch(/^[0-9a-f]{8}$/);
  });

  it("o endereço da miniatura e o do baixar", () => {
    expect(urlDaArte(BONUS, CARROSSEL, 2, "abcd1234")).toBe(`/bonus/${BONUS}/carrossel/${CARROSSEL}/arte?slide=2&v=abcd1234`);
    expect(urlDaArte(BONUS, CARROSSEL, 2, "abcd1234", true)).toBe(
      `/bonus/${BONUS}/carrossel/${CARROSSEL}/arte?slide=2&v=abcd1234&baixar=1`
    );
  });
});

// O QUE A ROTA CONFERE ANTES DE DESENHAR, depois da sessão e dos ids: o carrossel existe e é do
// bônus da URL, está pronto com texto de forma válida, e o slide pedido existe nele. A rota só se
// prova sem sessão na integração (o harness não forja cookie); estas recusas se provam aqui.
describe("o que a rota confere antes de desenhar", () => {
  const TEXTO = {
    tipo: "carrossel" as const,
    titulo: "Nome interno",
    gancho: "Seu cliente sumiu? Não é culpa dele.",
    slides: [{ titulo: "O que fazer primeiro", texto: "Mande uma mensagem curta, lembrando do que ele comprou." }],
    chamada: "Comente SUMIDO e receba as mensagens prontas.",
    legenda: "x".repeat(100),
  };
  const linha = (troca: Partial<LinhaDoCarrossel> = {}): LinhaDoCarrossel => ({
    id: CARROSSEL,
    bonus_id: BONUS,
    criado_em: new Date(0),
    total_slides: 3,
    palavra: "SUMIDO",
    contexto: {},
    estado: "pronto",
    gerado: TEXTO,
    revisado: null,
    erro: null,
    medicao: null,
    gerado_em: new Date(0),
    revisado_em: null,
    arte: {},
    ...troca,
  });

  it("o carrossel pronto e o slide que existe: os slides e o número", () => {
    const r = conferirPedidoDaArte(linha(), BONUS, "2");
    expect(r.ok && [r.numero, r.slides.length, r.slides[1].titulo]).toEqual([2, 3, "O que fazer primeiro"]);
  });

  it("o revisado vale sobre o gerado", () => {
    const revisado = { ...TEXTO, gancho: "O gancho revisado pelo operador." };
    const r = conferirPedidoDaArte(linha({ revisado }), BONUS, "1");
    expect(r.ok && r.slides[0].texto).toBe("O gancho revisado pelo operador.");
  });

  it.each([
    ["o carrossel que não existe", null as LinhaDoCarrossel | null, BONUS, "1", 404, TEXTO_ARTE_NAO_ENCONTRADA],
    ["o carrossel de outro bônus", linha({ bonus_id: "9f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f" }), BONUS, "1", 404, TEXTO_ARTE_NAO_ENCONTRADA],
    ["o carrossel ainda gerando", linha({ estado: "gerando", gerado: null }), BONUS, "1", 409, TEXTO_ARTE_NAO_PRONTA],
    ["o pronto com texto de forma errada", linha({ gerado: { tipo: "carrossel" } }), BONUS, "1", 409, TEXTO_ARTE_NAO_PRONTA],
    ["o slide além do total", linha(), BONUS, "4", 400, TEXTO_ARTE_SLIDE_INVALIDO],
    ["o slide que não é número", linha(), BONUS, "x", 400, TEXTO_ARTE_SLIDE_INVALIDO],
  ])("recusa %s", (_nome, l, bonus, slide, status, texto) => {
    expect(conferirPedidoDaArte(l, bonus, slide)).toEqual({ ok: false, status, texto });
  });
});
```

Crie `tests/bonus-arte-resposta.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { respostaDaArte } from "@/lib/bonus/arte-resposta";
import { slidesDoTexto, type SlideParaArte } from "@/lib/bonus/arte-slides";
import type { CabecalhoDaArte } from "@/lib/bonus/arte-tela";
import type { TextoDeCarrossel, TextoDePost } from "@/lib/bonus/carrossel-texto";

// O PNG DE VERDADE: o desenho passa pelo Satori e pelo Resvg, com a Carlito lida do disco. Os
// cabeçalhos conferidos são os que SAEM da resposta, e não os que o código pede (achado 59: o
// next/og tem um padrão próprio, e só os `headers` passados o sobrescrevem). Se o desenho tiver um
// `div` de vários filhos sem `display: flex`, o Satori recusa, e o caso cai aqui.

const PNG_1X1 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const CABECALHO: CabecalhoDaArte = { nome: "Thiago Vannuchi", arroba: "thiagovannuchi", foto: null, iniciais: "TV" };

const CARROSSEL: TextoDeCarrossel = {
  tipo: "carrossel",
  titulo: "Nome interno",
  gancho: "Seu cliente sumiu? Não é culpa dele.",
  slides: [
    { titulo: "O que fazer primeiro", texto: "- Mande uma mensagem curta\n- Lembre do que ele comprou\n\nE espere a resposta." },
  ],
  chamada: "Comente SUMIDO e receba as mensagens prontas.",
  legenda: "x".repeat(100),
};
const POST: TextoDePost = {
  tipo: "post",
  titulo: "Nome interno",
  texto: "Quem sumiu ainda pode voltar, se a mensagem certa chegar na hora certa.",
  chamada: "Comente SUMIDO e receba as mensagens prontas.",
  legenda: "x".repeat(100),
};

/** A largura e a altura gravadas no IHDR do PNG, depois da assinatura de 8 bytes. */
function tamanhoDoPng(b: Buffer): { assinatura: string; largura: number; altura: number } {
  return { assinatura: b.subarray(0, 8).toString("hex"), largura: b.readUInt32BE(16), altura: b.readUInt32BE(20) };
}

async function desenhar(slide: SlideParaArte, extra: Partial<Parameters<typeof respostaDaArte>[0]> = {}) {
  const r = await respostaDaArte({
    slide,
    comEspaco: true,
    cabecalho: CABECALHO,
    baixar: false,
    nomeDoArquivo: "reativar-clientes-whatsapp-slide-01.png",
    ...extra,
  });
  return { r, png: Buffer.from(await r.arrayBuffer()) };
}

const [GANCHO, CONTEUDO, CHAMADA] = slidesDoTexto(CARROSSEL);
const [UNICO] = slidesDoTexto(POST);

describe("o PNG de um slide", () => {
  it("sai 1080×1350, em PNG, aberto no navegador e sem cache", async () => {
    const { r, png } = await desenhar(CONTEUDO);
    expect(tamanhoDoPng(png)).toEqual({ assinatura: "89504e470d0a1a0a", largura: 1080, altura: 1350 });
    expect(r.headers.get("content-type")).toBe("image/png");
    expect(r.headers.get("cache-control")).toBe("private, no-store");
    expect(r.headers.get("content-disposition")).toBe("inline");
  }, 60_000);

  it("o baixar sai como arquivo, com o nome", async () => {
    const { r } = await desenhar(CONTEUDO, { baixar: true });
    expect(r.headers.get("content-disposition")).toBe('attachment; filename="reativar-clientes-whatsapp-slide-01.png"');
    expect(r.headers.get("cache-control")).toBe("private, no-store");
  }, 60_000);

  it.each([
    ["o gancho", GANCHO],
    ["a chamada, com a tag no pé", CHAMADA],
    ["o post de uma imagem", UNICO],
  ])("%s também desenha", async (_nome, slide) => {
    expect(tamanhoDoPng((await desenhar(slide)).png)).toMatchObject({ largura: 1080, altura: 1350 });
  }, 60_000);

  it("com a foto da conta, e só texto, também desenha", async () => {
    const { png } = await desenhar(CONTEUDO, { comEspaco: false, cabecalho: { ...CABECALHO, foto: PNG_1X1 } });
    expect(tamanhoDoPng(png)).toMatchObject({ largura: 1080, altura: 1350 });
  }, 60_000);

  it("com o espaço da imagem e só texto, a peça sai diferente", async () => {
    const com = (await desenhar(CONTEUDO, { comEspaco: true })).png;
    const sem = (await desenhar(CONTEUDO, { comEspaco: false })).png;
    expect(com.equals(sem)).toBe(false);
  }, 60_000);
});
```

Crie `tests/bonus-arte-paginas.test.ts`:

```ts
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// AS GUARDAS DA ROTA DA ARTE que nenhum tipo pega: a sessão conferida antes de tudo, o caminho que
// não escapa do proxy, e a tabela de contas lida só pelas colunas do cabeçalho.

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const ler = (rel: string) => readFileSync(`${RAIZ}/${rel}`, "utf8");
const ROTA = "app/bonus/[id]/carrossel/[cid]/arte/route.tsx";

describe("a rota da arte", () => {
  // A rota é um GET com endereço próprio: o proxy.ts deixa passar sem sessão o que termina em
  // .png, .jpg, .svg e .ico. Por isso o caminho termina em /arte, e a rota confere a sessão ela
  // mesma, como primeira coisa.
  it("mora em /arte, e não num caminho que termina em .png", () => {
    expect(existsSync(`${RAIZ}/${ROTA}`)).toBe(true);
    expect(readdirSync(`${RAIZ}/app/bonus/[id]/carrossel/[cid]`).some((n) => /\.(png|jpe?g|svg|ico)$/.test(n))).toBe(false);
  });

  it("o GET confere a sessão antes de qualquer outra coisa", () => {
    const fonte = ler(ROTA);
    const inicio = fonte.indexOf("export async function GET(");
    const corpo = fonte.slice(inicio);
    const linhas = corpo
      .split("\n")
      .slice(1)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("//"));
    expect(inicio).toBeGreaterThan(-1);
    expect(linhas.slice(0, 2)).toEqual([
      "const jarra = await cookies();",
      "if (!isValidSession(jarra.get(SESSION_COOKIE)?.value)) return erro(401, TEXTO_ARTE_SEM_SESSAO);",
    ]);
  });

  it("os cabeçalhos da resposta saem de cabecalhosDaArte, que nunca diz public", () => {
    expect(ler("lib/bonus/arte-resposta.tsx")).toContain("headers: cabecalhosDaArte(baixar, nomeDoArquivo)");
  });
});

// O TOKEN DE ACESSO DA CONTA NÃO SAI DA TABELA (achado 60): `accounts` guarda o `access_token`, e
// `listAccounts`, `getAccount` e `getSelectedAccount` (do dono) leem a linha inteira. A arte lê
// por `contasParaArte`, que seleciona só as quatro colunas do cabeçalho.
describe("a arte não lê a tabela de contas inteira", () => {
  const ARQUIVOS = [
    ROTA,
    "lib/bonus/arte-resposta.tsx",
    "lib/bonus/arte-desenho.tsx",
    "lib/bonus/arte-conta.ts",
    "lib/bonus/arte-foto.ts",
    "lib/bonus/carrossel-repositorio.ts",
    "app/bonus/carrossel-actions.ts",
  ];

  /** O código sem as linhas de comentário: os comentários citam essas funções para dizer por que não. */
  const semComentarios = (arquivo: string) =>
    ler(arquivo)
      .split("\n")
      .filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l))
      .join("\n");

  it.each(ARQUIVOS)("%s não usa as leituras de conta que trazem o token", (arquivo) => {
    expect(semComentarios(arquivo)).not.toMatch(/\b(listAccounts|getAccount|getSelectedAccount|getSelectedAccountId)\b/);
  });

  it("e o repositório não faz `select *` em accounts", () => {
    expect(semComentarios("lib/bonus/carrossel-repositorio.ts")).not.toMatch(/select\s+\*\s+from\s+accounts/i);
  });
});
```

Crie `testes-integracao/bonus-arte-rota.integracao.ts`:

```ts
// A ROTA DA ARTE RECUSA SEM SESSÃO, dentro do contexto de requisição do Next
// (./semear-requisicao.ts), que monta a jarra de cookies VAZIA. Nenhum cookie é forjado: a sessão
// ausente é o caso medido. O desenho com sessão é medido uma camada abaixo, em
// tests/bonus-arte-resposta.test.ts, e de ponta a ponta na prova real.
import { beforeAll, describe, expect, it } from "vitest";
import { bancoDescartavel } from "./harness";
import { comoNumaRequisicao } from "./semear-requisicao";

type ModuloRota = typeof import("@/app/bonus/[id]/carrossel/[cid]/arte/route");

bancoDescartavel();
let rota: ModuloRota;

beforeAll(async () => {
  rota = await import("@/app/bonus/[id]/carrossel/[cid]/arte/route");
});

const BONUS = "0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f";
const CARROSSEL = "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d";

describe("sem sessão, a arte não desenha", () => {
  it("responde 401 sem cache, antes de olhar o carrossel, o slide ou o banco", async () => {
    const caminho = `/bonus/${BONUS}/carrossel/${CARROSSEL}/arte`;
    const { valor } = await comoNumaRequisicao(caminho, async () => {
      const r = await rota.GET(new Request(`http://127.0.0.1${caminho}?slide=1`), {
        params: Promise.resolve({ id: BONUS, cid: CARROSSEL }),
      });
      return { status: r.status, cache: r.headers.get("cache-control"), corpo: await r.json() };
    });
    expect(valor).toEqual({
      status: 401,
      cache: "private, no-store",
      corpo: { ok: false, erro: "Entre no painel para ver a arte." },
    });
  });
});
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-arte-tela.test.ts tests/bonus-arte-resposta.test.ts tests/bonus-arte-paginas.test.ts
```

Esperado: os dois primeiros caem sem rodar caso nenhum (`Cannot find package`); em
`bonus-arte-paginas`, os casos da rota caem (`ENOENT`, a rota não existe).

- [ ] **Passo 3: o que a rota e a tela decidem, e as frases**

Crie `lib/bonus/arte-tela.ts`:

```ts
// O QUE A ROTA DA ARTE E A TELA DECIDEM, fora do JSX e da rota. PURO.
import { iniciais, type ContaDoCabecalho } from "./arte-conta";
import { slidesDoTexto, type SlideParaArte } from "./arte-slides";
import { TEXTO_ARTE_NAO_ENCONTRADA, TEXTO_ARTE_NAO_PRONTA, TEXTO_ARTE_SLIDE_INVALIDO } from "./arte-textos";
import type { LinhaDoCarrossel } from "./carrossel-linha";
import { textoDaLinhaDoCarrossel } from "./carrossel-tela";

/** O cabeçalho da peça: a "tag" do manual de arte (foto redonda, nome e @). */
export type CabecalhoDaArte = { nome: string; arroba: string; foto: string | null; iniciais: string };

/** O número do slide pedido na URL: só dígitos, sem zero à esquerda, de 1 ao total. */
export function numeroDoSlide(v: string | null, total: number): number | null {
  if (!v || !/^[1-9]\d*$/.test(v)) return null;
  const n = Number(v);
  return n <= total ? n : null;
}

/**
 * O QUE A ROTA CONFERE ANTES DE DESENHAR, depois da sessão e dos ids: o carrossel existe e é do
 * bônus da URL; está pronto, com texto de forma válida (o revisado, ou o gerado); e o slide pedido
 * existe nele. Fora da rota para cada recusa ter teste: a integração só alcança a rota sem sessão.
 */
export function conferirPedidoDaArte(
  linha: LinhaDoCarrossel | null,
  bonusId: string,
  slide: string | null
):
  | { ok: true; linha: LinhaDoCarrossel; slides: SlideParaArte[]; numero: number }
  | { ok: false; status: 400 | 404 | 409; texto: string } {
  if (!linha || linha.bonus_id !== bonusId) return { ok: false, status: 404, texto: TEXTO_ARTE_NAO_ENCONTRADA };
  const texto = linha.estado === "pronto" ? textoDaLinhaDoCarrossel(linha) : null;
  if (!texto) return { ok: false, status: 409, texto: TEXTO_ARTE_NAO_PRONTA };
  const slides = slidesDoTexto(texto);
  const numero = numeroDoSlide(slide, slides.length);
  if (!numero) return { ok: false, status: 400, texto: TEXTO_ARTE_SLIDE_INVALIDO };
  return { ok: true, linha, slides, numero };
}

/**
 * O nome do arquivo baixado: o endereço do bônus e o número do slide com dois dígitos, para os
 * arquivos ficarem em ordem na pasta. Ele vai para dentro de um cabeçalho HTTP, então só passam
 * letras minúsculas, números e hífen.
 */
export function nomeDoArquivo(slug: string | null, numero: number): string {
  const limpo = (slug ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "");
  return `${limpo || "carrossel"}-slide-${String(numero).padStart(2, "0")}.png`;
}

/**
 * ⚠️ NUNCA `public` (achado 59): fora do desenvolvimento, o ImageResponse de next/og responde
 * `public, max-age=0, must-revalidate`, e os `headers` passados a ele sobrescrevem esse padrão.
 * A imagem tem texto do painel e está atrás de sessão: não fica em cache nenhum.
 */
export function cabecalhosDaArte(baixar: boolean, nome: string): Record<string, string> {
  return {
    "Cache-Control": "private, no-store",
    "Content-Disposition": baixar ? `attachment; filename="${nome}"` : "inline",
  };
}

/** Sem nome, o @ faz as vezes de nome. As iniciais saem do que estiver no nome. */
export function cabecalhoDaConta(c: ContaDoCabecalho, foto: string | null): CabecalhoDaArte {
  const nome = c.name?.trim() || c.username || "";
  return { nome, arroba: c.username ?? "", foto, iniciais: iniciais(nome, "IG") };
}

/**
 * A VERSÃO DA PRÉVIA: um resumo curto (FNV-1a de 32 bits) de TUDO o que muda a imagem. A `<img>` só
 * pede de novo quando a URL muda, e a rota responde `no-store`, então é esta versão que decide se a
 * miniatura troca. A rota ignora o parâmetro.
 */
export function versaoDaArte(partes: (string | number | null)[]): string {
  let h = 0x811c9dc5;
  for (const ch of JSON.stringify(partes)) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export function urlDaArte(bonusId: string, carrosselId: string, numero: number, versao: string, baixar = false): string {
  return `/bonus/${bonusId}/carrossel/${carrosselId}/arte?slide=${numero}&v=${versao}${baixar ? "&baixar=1" : ""}`;
}
```

Crie `lib/bonus/arte-textos.ts`:

```ts
// AS FRASES DA ARTE DO CARROSSEL, fora do JSX e da rota (o princípio de lib/bonus/textos.ts): uma
// saída muda é indistinguível de sucesso, e cada saída tem frase, testada.

// As recusas da rota. Elas aparecem no lugar da miniatura, e na aba quando se abre o endereço.
export const TEXTO_ARTE_SEM_SESSAO = "Entre no painel para ver a arte.";
export const TEXTO_ARTE_NAO_ENCONTRADA = "Esse carrossel não existe, ou o endereço está errado.";
export const TEXTO_ARTE_NAO_PRONTA = "A arte só existe para carrossel pronto, com o texto conferido.";
export const TEXTO_ARTE_SLIDE_INVALIDO = "Esse slide não existe neste carrossel.";
export const TEXTO_ARTE_SEM_CONTA =
  "Nenhuma conta do Instagram está conectada no Chat, e o cabeçalho da arte precisa de uma.";
export const TEXTO_ARTE_SEM_FONTE =
  "A arte não pôde ser desenhada: a fonte Carlito não foi encontrada no servidor. Avise quem cuida do Chat.";
```

- [ ] **Passo 4: o desenho, trazido do JSX do Labs com as quatro diferenças**

Crie `lib/bonus/arte-desenho.tsx`:

```tsx
// O DESENHO DE UM SLIDE, em JSX para o Satori (o ImageResponse de next/og). PURO: recebe tudo
// pronto, e quem busca a foto e lê a fonte é a rota.
//
// TRAZIDO DO MÉTODO LABS (site-ia, src/app/admin/carrossel/arte/route.tsx, mudado por último em
// 19d25be, igual em 45bc973 e em a56459b). DOIS DONOS: mudança aqui se avisa ao Labs, e a de lá se
// traz para cá (docs/specs/2026-10-01-arte-do-carrossel.md, "Dois donos"). O layout é o do manual
// de arte do perfil que o Eduardo levou ao Labs em 02/09: fundo branco, texto 100% preto, margem de
// 110, Carlito Regular e Bold, texto ancorado no topo, hierarquia por PESO e não por tamanho, e a
// linha de fechamento em negrito. As QUATRO diferenças, todas da spec:
// 1. sem ilustração: o espaço reservado sai EM BRANCO, sem a moldura tracejada nem o escrito do
//    Labs, para receber a imagem no Canva;
// 2. "só texto" é o `semIlustracao` do Labs: o bloco do espaço some;
// 3. sem tema escuro e sem selo de verificado;
// 4. o cabeçalho vem da conta do carrossel (arte-tela.ts), e não da foto do admin.
//
// ⚠️ O QUE NÃO SE MEXE, cada item com um defeito datado atrás no ROADMAP do Labs: uma caixa por
// LINHA, e nunca `whiteSpace: "pre-wrap"` (o Satori desenha o `\n` e não o conta na altura, e as
// linhas se sobrepunham: Etapa 38.1); `flexShrink: 0` no texto e no espaço da imagem (sem ele o
// corte fica escondido em vez de visível); e o espaçador DEPOIS do espaço da imagem, que põe a
// sobra na base (39.2).
//
// ⚠️ O Satori entende um subconjunto de flexbox com estilo em linha: todo `div` com mais de um
// filho precisa de `display: "flex"`. Por isso as cores estão escritas aqui.
import type { ReactElement } from "react";
import { ALTURA_ILUSTRACAO, ENTRELINHA, MARGEM } from "./arte-geometria";
import type { SlideParaArte } from "./arte-slides";
import type { CabecalhoDaArte } from "./arte-tela";

/** Do fim do cabeçalho até a primeira linha de texto. Número do Labs. */
const GAP_CABECALHO = 48;
/** Da manchete ao corpo, medido como AVANÇO TOTAL, e não como espaço extra. Número do Labs. */
const AVANCO_MANCHETE = 77;
/** Entre parágrafos do corpo, inclusive antes da linha de fechamento. Número do Labs. */
const GAP_PARAGRAFO = 41;
/** Do fim do texto até o topo do espaço da imagem: o mesmo do cabeçalho, pela simetria (Labs, 39.2). */
const GAP_ILUSTRACAO = 48;
/** O fundo das iniciais quando a foto não vem: o azul do Instagram, como no Labs. */
const AZUL_DAS_INICIAIS = "#3797F0";
/** A paleta clara do Labs, a única aqui: texto 100% preto em fundo branco. */
const FUNDO = "#FFFFFF";
const TEXTO = "#000000";

export function desenhoDoSlide({
  slide,
  fonte,
  comEspaco,
  cabecalho,
  familia,
}: {
  slide: SlideParaArte;
  fonte: number;
  comEspaco: boolean;
  cabecalho: CabecalhoDaArte;
  familia: string;
}): ReactElement {
  // OS BLOCOS do corpo: a linha em branco separa o parágrafo, e o último bloco é a linha de
  // fechamento, em negrito, quando há mais de um.
  const blocos = slide.texto
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  const noPe = slide.assinaturaNoPe;

  const tag = (
    <div style={{ display: "flex", alignItems: "center" }}>
      {cabecalho.foto ? (
        /* eslint-disable-next-line @next/next/no-img-element -- JSX do Satori, e não HTML de
           página: `next/image` renderiza um componente que ele não sabe ler. */
        <img src={cabecalho.foto} width={127} height={127} style={{ borderRadius: 999, objectFit: "cover" }} alt="" />
      ) : (
        <div
          style={{
            display: "flex",
            width: 127,
            height: 127,
            borderRadius: 999,
            background: AZUL_DAS_INICIAIS,
            color: "#FFFFFF",
            fontSize: 48,
            fontWeight: 700,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {cabecalho.iniciais}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", marginLeft: 26 }}>
        <div style={{ display: "flex", fontSize: 46, fontWeight: 700, letterSpacing: -0.5 }}>{cabecalho.nome}</div>
        {cabecalho.arroba && <div style={{ display: "flex", fontSize: 34, marginTop: 4 }}>@{cabecalho.arroba}</div>}
      </div>
    </div>
  );

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: FUNDO,
        color: TEXTO,
        fontFamily: familia,
        padding: MARGEM,
      }}
    >
      {!noPe && tag}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          justifyContent: "flex-start",
          paddingTop: noPe ? 0 : GAP_CABECALHO,
          paddingBottom: noPe ? GAP_CABECALHO : 0,
        }}
      >
        {slide.titulo && (
          <div
            style={{
              display: "flex",
              fontSize: fonte,
              fontWeight: 700,
              lineHeight: ENTRELINHA,
              letterSpacing: -0.4,
              marginBottom: Math.max(0, AVANCO_MANCHETE - Math.round(fonte * ENTRELINHA)),
            }}
          >
            {slide.titulo}
          </div>
        )}

        {blocos.map((bloco, i) => {
          const ultimo = i === blocos.length - 1;
          // Negrito no ÚLTIMO bloco quando há fechamento (mais de um bloco), e no bloco único sem
          // manchete acima: o gancho e a chamada, em que o texto É a peça.
          const negrito = ultimo && (blocos.length > 1 || !slide.titulo);
          return (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                fontSize: fonte,
                fontWeight: negrito ? 700 : 400,
                lineHeight: ENTRELINHA,
                letterSpacing: negrito ? -0.4 : 0,
                marginBottom: ultimo ? 0 : GAP_PARAGRAFO,
              }}
            >
              {bloco.split("\n").map((linha, j) => (
                <div key={j} style={{ display: "flex" }}>
                  {linha}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* O ESPAÇO DA IMAGEM, EM BRANCO: é onde o operador põe a imagem no Canva. Some no "só texto". */}
      {comEspaco && <div style={{ display: "flex", marginTop: GAP_ILUSTRACAO, height: ALTURA_ILUSTRACAO, flexShrink: 0 }} />}

      {/* O ESPAÇADOR: cresce com o que sobra, e põe a folga na base (ou entre o espaço e a tag no pé). */}
      <div style={{ display: "flex", flex: 1 }} />

      {noPe && tag}
    </div>
  );
}
```

- [ ] **Passo 5: o PNG com a fonte e os cabeçalhos**

Crie `lib/bonus/arte-resposta.tsx`:

```tsx
import "server-only";
import { ImageResponse } from "next/og";
import { desenhoDoSlide } from "./arte-desenho";
import { fontesDaArte, FAMILIA_DA_ARTE } from "./arte-fonte";
import { ALTURA, LARGURA } from "./arte-geometria";
import { tamanhoDoTexto, textoMedido, type SlideParaArte } from "./arte-slides";
import { cabecalhosDaArte, type CabecalhoDaArte } from "./arte-tela";

// O PNG DE UM SLIDE: o desenho, a fonte e os cabeçalhos da resposta, juntos. A rota decide o que
// desenhar; isto desenha. Separado da rota para o teste desenhar de verdade sem sessão nem banco
// (tests/bonus-arte-resposta.test.ts).
//
// A FONTE DO TEXTO É ESCOLHIDA SOBRE O TEXTO MEDIDO (a manchete e o corpo), o mesmo que o aviso
// "não cabe" mede (arte-slides.ts). `comEspaco` é o `!semIlustracao` do Labs.
export async function respostaDaArte({
  slide,
  comEspaco,
  cabecalho,
  baixar,
  nomeDoArquivo,
}: {
  slide: SlideParaArte;
  comEspaco: boolean;
  cabecalho: CabecalhoDaArte;
  baixar: boolean;
  nomeDoArquivo: string;
}): Promise<Response> {
  const fontes = await fontesDaArte();
  const fonte = tamanhoDoTexto(slide.tipo, textoMedido(slide), comEspaco);
  return new ImageResponse(desenhoDoSlide({ slide, fonte, comEspaco, cabecalho, familia: FAMILIA_DA_ARTE }), {
    width: LARGURA,
    height: ALTURA,
    fonts: fontes,
    headers: cabecalhosDaArte(baixar, nomeDoArquivo),
  });
}
```

- [ ] **Passo 6: a rota**

Crie `app/bonus/[id]/carrossel/[cid]/arte/route.tsx`:

```tsx
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCOUNT_COOKIE } from "@/lib/account";
import { isValidSession, SESSION_COOKIE } from "@/lib/auth";
import { resolverConta } from "@/lib/bonus/arte-conta";
import { comEspaco, escolhasDaArte } from "@/lib/bonus/arte-escolhas";
import { fotoDaConta } from "@/lib/bonus/arte-foto";
import { respostaDaArte } from "@/lib/bonus/arte-resposta";
import { cabecalhoDaConta, conferirPedidoDaArte, nomeDoArquivo } from "@/lib/bonus/arte-tela";
import {
  TEXTO_ARTE_NAO_ENCONTRADA,
  TEXTO_ARTE_SEM_CONTA,
  TEXTO_ARTE_SEM_FONTE,
  TEXTO_ARTE_SEM_SESSAO,
} from "@/lib/bonus/arte-textos";
import { contasParaArte, lerCarrossel } from "@/lib/bonus/carrossel-repositorio";
import { ehIdDeBonus } from "@/lib/bonus/pedido";
import { lerLinha } from "@/lib/bonus/repositorio";

// A ARTE DE UM SLIDE DO CARROSSEL, em PNG de 1080×1350: um slide por pedido, desenhado na hora a
// partir do texto salvo (o revisado, ou o gerado). Nada é guardado. O desenho inteiro está em
// docs/specs/2026-10-01-arte-do-carrossel.md.
//
// A SESSÃO É CONFERIDA AQUI, e não só no proxy.ts: o caminho termina em /arte, e não em .png (o
// proxy deixa passar sem sessão o que termina em .png, .jpg, .svg e .ico), mas a rota não depende
// disso. Sem sessão, 401 (e não um redirect, que viraria imagem quebrada sem explicação).
// tests/bonus-arte-paginas.test.ts confere que isto é a primeira coisa do GET.
//
// `?slide=N` escolhe o slide (1 ao total); `?baixar=1` vira download com nome de arquivo; `?v=` é a
// versão da prévia, que esta rota ignora (arte-tela.ts, `versaoDaArte`).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function erro(status: number, texto: string): NextResponse {
  return NextResponse.json({ ok: false, erro: texto }, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string; cid: string }> }) {
  const jarra = await cookies();
  if (!isValidSession(jarra.get(SESSION_COOKIE)?.value)) return erro(401, TEXTO_ARTE_SEM_SESSAO);
  const { id, cid } = await params;
  if (!ehIdDeBonus(id) || !ehIdDeBonus(cid)) return erro(404, TEXTO_ARTE_NAO_ENCONTRADA);
  const pedido = new URL(request.url).searchParams;
  // O dono, o "pronto" e o slide: arte-tela.ts, `conferirPedidoDaArte`, com um caso por recusa.
  const conferido = conferirPedidoDaArte(await lerCarrossel(cid), id, pedido.get("slide"));
  if (!conferido.ok) return erro(conferido.status, conferido.texto);
  const { linha, slides, numero } = conferido;

  // A conta do cabeçalho: a gravada no carrossel; sem ela, ou desconectada, a selecionada no Chat.
  const escolhas = escolhasDaArte(linha.arte, slides.length);
  const { conta } = resolverConta(await contasParaArte(), escolhas.conta, jarra.get(ACCOUNT_COOKIE)?.value);
  if (!conta) return erro(409, TEXTO_ARTE_SEM_CONTA);
  const [foto, bonus] = await Promise.all([fotoDaConta(conta.profile_picture_url), lerLinha(id)]);

  try {
    return await respostaDaArte({
      slide: slides[numero - 1],
      comEspaco: comEspaco(escolhas, numero),
      cabecalho: cabecalhoDaConta(conta, foto),
      baixar: pedido.get("baixar") === "1",
      nomeDoArquivo: nomeDoArquivo(bonus?.slug ?? null, numero),
    });
  } catch {
    // A única falha antes do desenho é a leitura da fonte (arte-fonte.ts, sem fonte de reserva).
    return erro(500, TEXTO_ARTE_SEM_FONTE);
  }
}
```

- [ ] **Passo 7: ver passar, e olhar a peça**

```bash
npx tsc --noEmit
npx vitest run tests/bonus-arte-tela.test.ts tests/bonus-arte-resposta.test.ts tests/bonus-arte-paginas.test.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-arte-rota.integracao.ts
```

Esperado: 29, 7 e 11 casos passam; a rota sem sessão responde 401 com `private, no-store`, e a
integração passa (1 caso). Depois, gere PNGs de amostra (um teste descartável que grava a saída de
`respostaDaArte` no scratchpad, e que NÃO entra no repositório) e OLHE: a Carlito, o negrito na
manchete e na linha de fechamento, a lista de hífens uma por linha, a tag no pé do último slide e o
espaço da imagem em branco abaixo do texto.

- [ ] **Passo 8: varrer e commitar**

```bash
F="lib/bonus/arte-tela.ts lib/bonus/arte-textos.ts lib/bonus/arte-desenho.tsx lib/bonus/arte-resposta.tsx app/bonus/[id]/carrossel/[cid]/arte/route.tsx tests/bonus-arte-tela.test.ts tests/bonus-arte-resposta.test.ts tests/bonus-arte-paginas.test.ts testes-integracao/bonus-arte-rota.integracao.ts"
node "$SCRATCH/varrer-texto.mjs" $F
test "$(git branch --show-current)" = "arte-do-carrossel"
git add $F
git commit -m "feat(bonus): a rota que desenha cada slide em PNG, com sessão e sem cache"
```

---

### FASE 3.7 — A action da arte

**Arquivos:**
- Modificar: `lib/bonus/arte-escolhas.ts`, `lib/bonus/arte-textos.ts`, `app/bonus/carrossel-actions.ts`
- Testar: `tests/bonus-arte-escolhas.test.ts`, `tests/bonus-carrossel-paginas.test.ts`,
  `testes-integracao/bonus-carrossel-acoes.integracao.ts`

**Interfaces:**
- Produz: `type RecusaDaArte`, `lerEscolhasDoFormulario(bruto, total, conectadas)`;
  `type AvisoDaArte`, `TEXTO_ARTE_SALVA`, `textoDaRecusaDaArte(motivo)`;
  `salvarArteDoCarrossel(_anterior, form): Promise<AvisoDaArte | null>` (campos `id`, `conta` e
  `so_texto`, um por slide).

- [ ] **Passo 1: os testes**

Em `tests/bonus-arte-escolhas.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-arte-escolhas.test.ts b/tests/bonus-arte-escolhas.test.ts
index d1d87f9..787f72b 100644
--- a/tests/bonus-arte-escolhas.test.ts
+++ b/tests/bonus-arte-escolhas.test.ts
@@ -1,5 +1,5 @@
 import { describe, expect, it } from "vitest";
-import { comEspaco, escolhasDaArte } from "@/lib/bonus/arte-escolhas";
+import { comEspaco, escolhasDaArte, lerEscolhasDoFormulario } from "@/lib/bonus/arte-escolhas";
 
 // AS ESCOLHAS DA ARTE lidas da coluna `arte` (migrations/015-arte-do-carrossel.sql). O que vem do
 // banco não é confiável por forma: uma linha antiga tem `{}`, e uma escrita errada não pode quebrar
@@ -29,3 +29,34 @@ describe("as escolhas da arte de um carrossel", () => {
     expect([1, 2, 3].map((n) => comEspaco(e, n))).toEqual([true, false, true]);
   });
 });
+
+// O QUE O FORMULÁRIO DA ARTE MANDA não é confiável: o navegador manda o que quiser. A conta tem de
+// ser uma das conectadas, e cada slide "só texto" tem de existir no carrossel.
+describe("as escolhas mandadas pelo formulário da arte", () => {
+  const CONECTADAS = ["1001", "1002"];
+
+  it("a conta conectada e os slides marcados, em ordem e sem repetir", () => {
+    expect(lerEscolhasDoFormulario({ conta: "1002", soTexto: ["4", "2", "2"] }, 5, CONECTADAS)).toEqual({
+      ok: true,
+      escolhas: { conta: "1002", soTexto: [2, 4] },
+    });
+  });
+
+  it("nenhum slide marcado é todos com espaço", () => {
+    expect(lerEscolhasDoFormulario({ conta: "1001", soTexto: [] }, 5, CONECTADAS)).toEqual({
+      ok: true,
+      escolhas: { conta: "1001", soTexto: [] },
+    });
+  });
+
+  it.each([["9999"], [""], [null]])("conta que não está conectada é recusada: %j", (conta) => {
+    expect(lerEscolhasDoFormulario({ conta, soTexto: [] }, 5, CONECTADAS)).toEqual({ ok: false, motivo: "conta" });
+  });
+
+  it.each([["0"], ["6"], ["2.5"], ["02"], ["x"], [7]])("slide fora do carrossel é recusado: %j", (slide) => {
+    expect(lerEscolhasDoFormulario({ conta: "1001", soTexto: [slide] }, 5, CONECTADAS)).toEqual({
+      ok: false,
+      motivo: "slide",
+    });
+  });
+});
```

Em `tests/bonus-carrossel-paginas.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-carrossel-paginas.test.ts b/tests/bonus-carrossel-paginas.test.ts
index 93bda30..afe84bd 100644
--- a/tests/bonus-carrossel-paginas.test.ts
+++ b/tests/bonus-carrossel-paginas.test.ts
@@ -56,6 +56,21 @@ describe("o pedido de carrossel responde sem recriar a página na recusa", () =>
   });
 });
 
+// AS ESCOLHAS DA ARTE TAMBÉM NÃO REDIRECIONAM (Etapa 3): a seção da arte fica na mesma página que
+// o editor, e recriar a página apagaria o que o operador estiver editando (achado 52). A resposta
+// volta como estado, e a miniatura troca pela versão da prévia.
+describe("o salvar da arte responde sem recriar a página", () => {
+  it("salvarArteDoCarrossel não redireciona para a página do carrossel", () => {
+    const fonte = ler("app/bonus/carrossel-actions.ts");
+    const inicio = fonte.indexOf("export async function salvarArteDoCarrossel(");
+    const fim = fonte.indexOf("\nexport ", inicio + 1);
+    const corpo = fonte.slice(inicio, fim === -1 ? undefined : fim);
+    expect(inicio).toBeGreaterThan(-1);
+    expect(corpo).not.toMatch(/urlDoCarrosselComAviso\(/);
+    expect(corpo).not.toMatch(/redirect\(`\/bonus\/\$\{/);
+  });
+});
+
 /** As funções exportadas de um arquivo e a primeira instrução de cada uma. */
 function primeirasInstrucoes(fonte: string): { nome: string; primeira: string }[] {
   const achados: { nome: string; primeira: string }[] = [];
@@ -67,11 +82,12 @@ function primeirasInstrucoes(fonte: string): { nome: string; primeira: string }[
 // A SESSÃO É CONFERIDA DENTRO DE CADA ACTION, e não só no proxy.ts: Server Action tem endereço
 // próprio. O mesmo leitor de tests/bonus-paginas.test.ts, para o arquivo novo.
 describe("toda action do carrossel confere a sessão antes de qualquer coisa", () => {
-  it("as três actions começam por `await exigirSessao();`", () => {
+  it("as quatro actions começam por `await exigirSessao();`", () => {
     const achados = primeirasInstrucoes(ler("app/bonus/carrossel-actions.ts"));
     expect(achados.map((a) => a.nome).sort()).toEqual([
       "gerarCarrosselDeNovo",
       "pedirCarrossel",
+      "salvarArteDoCarrossel",
       "salvarRevisaoDoCarrossel",
     ]);
     for (const a of achados) expect(a.primeira, a.nome).toBe("await exigirSessao();");
```

Em `testes-integracao/bonus-carrossel-acoes.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/bonus-carrossel-acoes.integracao.ts b/testes-integracao/bonus-carrossel-acoes.integracao.ts
index 0d8b4b9..d1d8440 100644
--- a/testes-integracao/bonus-carrossel-acoes.integracao.ts
+++ b/testes-integracao/bonus-carrossel-acoes.integracao.ts
@@ -65,6 +65,17 @@ describe("sem sessão, nenhuma action do carrossel age", () => {
     expect(destino).toBe("/entrar");
   });
 
+  // O salvar da arte também recebe o estado anterior (useActionState).
+  it("salvarArteDoCarrossel vai para /entrar e não grava nada", async () => {
+    const destino = await destinoDe(
+      async (f) => {
+        await acoes.salvarArteDoCarrossel(null, f);
+      },
+      formulario({ id: "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d", conta: "1001" })
+    );
+    expect(destino).toBe("/entrar");
+  });
+
   // O salvar da revisão recebe o estado anterior do formulário (useActionState, achado 52).
   it("salvarRevisaoDoCarrossel vai para /entrar", async () => {
     const destino = await destinoDe(
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-arte-escolhas.test.ts tests/bonus-carrossel-paginas.test.ts
```

Esperado: os casos novos de `lerEscolhasDoFormulario` caem (`is not a function`), e em
`bonus-carrossel-paginas` caem "salvarArteDoCarrossel não redireciona" e "as quatro actions
começam por `await exigirSessao();`".

- [ ] **Passo 3: o código**

Em `lib/bonus/arte-escolhas.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/arte-escolhas.ts b/lib/bonus/arte-escolhas.ts
index ab0402b..d10eff5 100644
--- a/lib/bonus/arte-escolhas.ts
+++ b/lib/bonus/arte-escolhas.ts
@@ -27,3 +27,26 @@ export function escolhasDaArte(v: unknown, total: number): EscolhasDaArte {
 export function comEspaco(e: EscolhasDaArte, numero: number): boolean {
   return !e.soTexto.includes(numero);
 }
+
+export type RecusaDaArte = "conta" | "slide";
+
+/**
+ * O que o formulário da arte mandou. O navegador manda o que quiser: a conta tem de ser uma das
+ * conectadas (spec da Etapa 3, "Segurança"), e cada slide "só texto" tem de existir no carrossel.
+ * O número vem como texto, só dígitos e sem zero à esquerda.
+ */
+export function lerEscolhasDoFormulario(
+  bruto: { conta: unknown; soTexto: unknown[] },
+  total: number,
+  conectadas: string[]
+): { ok: true; escolhas: EscolhasDaArte } | { ok: false; motivo: RecusaDaArte } {
+  const conta = typeof bruto.conta === "string" ? bruto.conta : "";
+  if (!conectadas.includes(conta)) return { ok: false, motivo: "conta" };
+  const soTexto: number[] = [];
+  for (const v of bruto.soTexto) {
+    const n = typeof v === "string" && /^[1-9]\d*$/.test(v) ? Number(v) : 0;
+    if (n < 1 || n > total) return { ok: false, motivo: "slide" };
+    if (!soTexto.includes(n)) soTexto.push(n);
+  }
+  return { ok: true, escolhas: { conta, soTexto: soTexto.sort((a, b) => a - b) } };
+}
```

Em `lib/bonus/arte-textos.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/arte-textos.ts b/lib/bonus/arte-textos.ts
index 6651c4d..ba1c798 100644
--- a/lib/bonus/arte-textos.ts
+++ b/lib/bonus/arte-textos.ts
@@ -1,3 +1,6 @@
+import type { Aviso } from "@/lib/avisos";
+import type { RecusaDaArte } from "./arte-escolhas";
+
 // AS FRASES DA ARTE DO CARROSSEL, fora do JSX e da rota (o princípio de lib/bonus/textos.ts): uma
 // saída muda é indistinguível de sucesso, e cada saída tem frase, testada.
 
@@ -10,3 +13,21 @@ export const TEXTO_ARTE_SEM_CONTA =
   "Nenhuma conta do Instagram está conectada no Chat, e o cabeçalho da arte precisa de uma.";
 export const TEXTO_ARTE_SEM_FONTE =
   "A arte não pôde ser desenhada: a fonte Carlito não foi encontrada no servidor. Avise quem cuida do Chat.";
+
+/**
+ * A resposta do salvar da arte (a conta e o "só texto"), que volta como ESTADO e não por redirect:
+ * a seção da arte fica na página do editor, e recriar a página apagaria a edição (achado 52). `em`
+ * muda a cada resposta, e é o que troca a versão das miniaturas depois de salvar.
+ */
+export type AvisoDaArte = Aviso & { em: number };
+
+export const TEXTO_ARTE_SALVA = "Arte salva.";
+
+export function textoDaRecusaDaArte(motivo: RecusaDaArte): string {
+  switch (motivo) {
+    case "conta":
+      return "Essa conta não está conectada no Chat. Escolha uma das contas da lista.";
+    case "slide":
+      return "Esse slide não existe neste carrossel. Recarregue a página.";
+  }
+}
```

Em `app/bonus/carrossel-actions.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/carrossel-actions.ts b/app/bonus/carrossel-actions.ts
index f934cbd..4284930 100644
--- a/app/bonus/carrossel-actions.ts
+++ b/app/bonus/carrossel-actions.ts
@@ -5,6 +5,8 @@ import { redirect } from "next/navigation";
 import { ACCOUNT_COOKIE } from "@/lib/account";
 import { isValidSession, SESSION_COOKIE } from "@/lib/auth";
 import { resolverConta } from "@/lib/bonus/arte-conta";
+import { lerEscolhasDoFormulario } from "@/lib/bonus/arte-escolhas";
+import { TEXTO_ARTE_NAO_PRONTA, TEXTO_ARTE_SALVA, textoDaRecusaDaArte, type AvisoDaArte } from "@/lib/bonus/arte-textos";
 import type { ContextoDoCarrossel } from "@/lib/bonus/carrossel-ia-parametros";
 import { lerPedidoDeCarrossel } from "@/lib/bonus/carrossel-pedido";
 import { processarCarrossel } from "@/lib/bonus/carrossel-processo";
@@ -12,6 +14,7 @@ import {
   contasParaArte,
   criarPedidoDeCarrossel,
   lerCarrossel,
+  salvarEscolhasDaArte,
   salvarRevisaoDoCarrossel as gravarRevisao,
 } from "@/lib/bonus/carrossel-repositorio";
 import { textoDaLinhaDoCarrossel } from "@/lib/bonus/carrossel-tela";
@@ -170,3 +173,28 @@ export async function salvarRevisaoDoCarrossel(
   const salvou = await gravarRevisao(id, lido.texto);
   return salvou ? resposta("ok", TEXTO_REVISAO_SALVA) : resposta("erro", TEXTO_CARROSSEL_NAO_REVISAVEL);
 }
+
+/**
+ * AS ESCOLHAS DA ARTE: a conta do cabeçalho e os slides "só texto". A resposta volta como ESTADO
+ * (useActionState), e nunca por redirect, pelo mesmo motivo do salvar da revisão (achado 52): a
+ * seção da arte fica na página do editor, e recriar a página apagaria o que se estiver editando.
+ * A conta tem de ser uma das conectadas, e só carrossel pronto guarda escolha.
+ */
+export async function salvarArteDoCarrossel(_anterior: AvisoDaArte | null, form: FormData): Promise<AvisoDaArte | null> {
+  await exigirSessao();
+  const id = form.get("id");
+  if (!ehIdDeBonus(id)) redirect(urlDoBonusComAviso(null, { tom: "erro", texto: TEXTO_CARROSSEL_NAO_ENCONTRADO }));
+  const linha = await lerCarrossel(id);
+  if (!linha) redirect(urlDoBonusComAviso(null, { tom: "erro", texto: TEXTO_CARROSSEL_NAO_ENCONTRADO }));
+  const resposta = (tom: AvisoDaArte["tom"], texto: string): AvisoDaArte => ({ tom, texto, em: Date.now() });
+  if (linha.estado !== "pronto" || !textoDaLinhaDoCarrossel(linha)) return resposta("erro", TEXTO_ARTE_NAO_PRONTA);
+  const conectadas = (await contasParaArte()).map((c) => c.ig_user_id);
+  const lido = lerEscolhasDoFormulario(
+    { conta: form.get("conta"), soTexto: form.getAll("so_texto") },
+    linha.total_slides,
+    conectadas
+  );
+  if (!lido.ok) return resposta("erro", textoDaRecusaDaArte(lido.motivo));
+  const salvou = await salvarEscolhasDaArte(id, lido.escolhas);
+  return salvou ? resposta("ok", TEXTO_ARTE_SALVA) : resposta("erro", TEXTO_ARTE_NAO_PRONTA);
+}
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx vitest run tests/bonus-arte-escolhas.test.ts tests/bonus-carrossel-paginas.test.ts tests/bonus-arte-paginas.test.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-carrossel-acoes.integracao.ts
```

Esperado: 39 casos puros passam; na integração, 4 (o caso novo: sem sessão, `/entrar`).

- [ ] **Passo 5: varrer e commitar**

```bash
F="lib/bonus/arte-escolhas.ts lib/bonus/arte-textos.ts app/bonus/carrossel-actions.ts tests/bonus-arte-escolhas.test.ts tests/bonus-carrossel-paginas.test.ts testes-integracao/bonus-carrossel-acoes.integracao.ts"
node "$SCRATCH/varrer-texto.mjs" $F
test "$(git branch --show-current)" = "arte-do-carrossel"
git add $F
git commit -m "feat(bonus): a action que grava a conta e o só texto da arte"
```

---

### FASE 3.8 — A tela

**Arquivos:**
- Criar: `lib/bonus/arte-cabimento.ts`, `app/bonus/[id]/carrossel/[cid]/arte-do-carrossel.tsx`,
  `app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx`
- Modificar: `lib/bonus/arte-textos.ts`, `app/bonus/[id]/carrossel/[cid]/formulario-da-revisao.tsx`,
  `app/bonus/[id]/carrossel/[cid]/campo.tsx`, `app/bonus/[id]/carrossel/[cid]/page.tsx`
- Testar: `tests/bonus-arte-cabimento.test.ts`, `testes-dom/bonus-arte-do-carrossel.dom.tsx`,
  `testes-dom/bonus-editor-do-carrossel.dom.tsx`, `tests/bonus-carrossel-paginas.test.ts`,
  `tests/bonus-paginas.test.ts`

**Interfaces:**
- Consome: tudo das fases 3.2 a 3.7.
- Produz: `textoDosCampos`, `campoDoAviso`, `avisosDeCabimento(total, valores, soTexto)`; as
  frases `textoNaoCabeComEspaco`, `textoNaoCabeNunca`, `textoDaOrigemDaConta`, `rotuloDaConta`,
  `textoDoBaixarTodos`; os componentes `ArteDoCarrossel` e `EditorDoCarrossel`; e três props
  opcionais no `FormularioDaRevisao` (`avisosDeCabimento`, `aoEditar`, `aoSalvar`) e uma no
  `Campo` (`avisoDeCabimento`).

- [ ] **Passo 1: os testes**

Crie `tests/bonus-arte-cabimento.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { avisosDeCabimento, campoDoAviso, textoDosCampos } from "@/lib/bonus/arte-cabimento";
import {
  rotuloDaConta,
  textoDaOrigemDaConta,
  textoDaRecusaDaArte,
  textoDoBaixarTodos,
  textoNaoCabeComEspaco,
  textoNaoCabeNunca,
} from "@/lib/bonus/arte-textos";

// O "NÃO CABE" ENQUANTO SE DIGITA (spec da Etapa 3, "A prévia e o não cabe"): a mesma conta da arte
// (arte-slides.ts), feita sobre o que está nos campos AGORA, e não sobre o texto salvo. Avisa,
// nunca impede: a previsão é uma estimativa (a regra do Labs).

const VALORES = {
  gancho: "Seu cliente sumiu? Não é culpa dele.",
  slide_1_titulo: "O que fazer primeiro",
  slide_1_texto: "Mande uma mensagem curta, lembrando do que ele comprou.",
  chamada: "Comente SUMIDO e receba as mensagens prontas.",
  legenda: "x".repeat(100),
};
/** Um corpo que cabe sozinho e não cabe com a manchete e o espaço da imagem (arte-slides). */
const OITO_LINHAS = Array(8).fill("x".repeat(20)).join("\n");
/** Um corpo que não cabe nem sem o espaço da imagem. */
const TRINTA_LINHAS = Array(30).fill("x".repeat(17)).join("\n");

describe("o texto montado com o que está nos campos", () => {
  it("carrossel: o gancho, os slides e a chamada, sem o \\r\\n do textarea e sem as pontas em branco", () => {
    expect(textoDosCampos(3, { ...VALORES, slide_1_texto: "  linha um\r\nlinha dois  " })).toEqual({
      tipo: "carrossel",
      titulo: "",
      gancho: VALORES.gancho,
      slides: [{ titulo: VALORES.slide_1_titulo, texto: "linha um\nlinha dois" }],
      chamada: VALORES.chamada,
      legenda: VALORES.legenda,
    });
  });

  it("post: o texto e a chamada", () => {
    expect(textoDosCampos(1, { texto: "O texto do post.", chamada: VALORES.chamada, legenda: VALORES.legenda })).toEqual({
      tipo: "post",
      titulo: "",
      texto: "O texto do post.",
      chamada: VALORES.chamada,
      legenda: VALORES.legenda,
    });
  });
});

describe("o campo onde aparece o aviso de cada slide", () => {
  it.each([
    [1, 5, "gancho"],
    [2, 5, "slide_1_texto"],
    [4, 5, "slide_3_texto"],
    [5, 5, "chamada"],
    [1, 1, "texto"],
  ])("slide %i de %i: %s", (numero, total, campo) => {
    expect(campoDoAviso(numero, total)).toBe(campo);
  });
});

describe("os avisos de cabimento", () => {
  it("cala quando tudo cabe", () => {
    expect(avisosDeCabimento(3, VALORES, [])).toEqual({});
  });

  it("com o espaço da imagem, diz para marcar só texto ou encurtar", () => {
    expect(avisosDeCabimento(3, { ...VALORES, slide_1_texto: OITO_LINHAS }, [])).toEqual({
      slide_1_texto: textoNaoCabeComEspaco(2),
    });
  });

  it("marcado só texto, o mesmo slide cabe, e o aviso cala", () => {
    expect(avisosDeCabimento(3, { ...VALORES, slide_1_texto: OITO_LINHAS }, [2])).toEqual({});
  });

  it("o que não cabe nem sem o espaço diz para encurtar, nos dois modos", () => {
    const valores = { ...VALORES, slide_1_texto: TRINTA_LINHAS };
    expect(avisosDeCabimento(3, valores, [])).toEqual({ slide_1_texto: textoNaoCabeNunca(2) });
    expect(avisosDeCabimento(3, valores, [2])).toEqual({ slide_1_texto: textoNaoCabeNunca(2) });
  });

  it("no post, o aviso vai no texto", () => {
    expect(avisosDeCabimento(1, { texto: TRINTA_LINHAS, chamada: VALORES.chamada, legenda: VALORES.legenda }, [])).toEqual({
      texto: textoNaoCabeNunca(1),
    });
  });
});

describe("as frases da tela da arte", () => {
  it("o não cabe diz o slide e o que fazer", () => {
    expect(textoNaoCabeComEspaco(2)).toBe('O slide 2 não cabe com o espaço da imagem. Marque "só texto" nele, ou encurte.');
    expect(textoNaoCabeNunca(2)).toBe("O slide 2 não cabe nem sem o espaço da imagem. Encurte o texto.");
  });

  it("a conta diz de onde veio, e cala quando é a gravada", () => {
    expect(textoDaOrigemDaConta("gravada", "thiagovannuchi")).toBeNull();
    expect(textoDaOrigemDaConta("selecionada", "thiagovannuchi")).toBe(
      "A arte usa a conta selecionada no Chat agora (@thiagovannuchi). Escolha uma conta acima para gravar neste carrossel."
    );
    expect(textoDaOrigemDaConta("gravada_saiu", "thiagovannuchi")).toBe(
      "A conta gravada neste carrossel foi desconectada do Chat. A arte usa a selecionada agora (@thiagovannuchi)."
    );
  });

  it("o rótulo da conta no seletor tem o nome e o @", () => {
    expect(rotuloDaConta({ ig_user_id: "1", username: "thiagovannuchi", name: "Thiago Vannuchi", profile_picture_url: null })).toBe(
      "Thiago Vannuchi (@thiagovannuchi)"
    );
    expect(rotuloDaConta({ ig_user_id: "1", username: "thiagovannuchi", name: null, profile_picture_url: null })).toBe(
      "@thiagovannuchi"
    );
  });

  it("o baixar todos avisa a permissão do navegador antes", () => {
    expect(textoDoBaixarTodos(10)).toBe(
      "O navegador pode pedir permissão para baixar vários arquivos de uma vez. Aceite para receber os 10 slides."
    );
  });

  it("cada recusa do salvar da arte tem frase", () => {
    expect(textoDaRecusaDaArte("conta")).toContain("não está conectada");
    expect(textoDaRecusaDaArte("slide")).toContain("não existe");
  });
});
```

Crie `testes-dom/bonus-arte-do-carrossel.dom.tsx`:

```tsx
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ArteDoCarrossel from "@/app/bonus/[id]/carrossel/[cid]/arte-do-carrossel";
import { urlDaArte } from "@/lib/bonus/arte-tela";
import type { AvisoDaArte } from "@/lib/bonus/arte-textos";

// A SEÇÃO DA ARTE (spec da Etapa 3, "As telas"): a conta do cabeçalho, as miniaturas com o "só
// texto" e o "Baixar" de cada slide, e o "Baixar todos". As escolhas se gravam na hora, pela
// action, e a resposta volta como ESTADO (nunca redirect: achado 52). A action entra por
// propriedade, e aqui é uma falsa.

const BONUS = "0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f";
const CARROSSEL = "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d";
const CONTAS = [
  { id: "1001", rotulo: "Thiago Vannuchi (@thiagovannuchi)" },
  { id: "1002", rotulo: "@outraconta" },
];

afterEach(() => {
  vi.restoreAllMocks();
});

/** A seção como a página a usa: o pai guarda a conta e o "só texto". */
function Secao({
  acao,
  avisos = {},
  avisoDaConta = null,
}: {
  acao: (a: AvisoDaArte | null, f: FormData) => Promise<AvisoDaArte | null>;
  avisos?: Record<number, string>;
  avisoDaConta?: string | null;
}) {
  const [conta, setConta] = useState<string | null>("1001");
  const [soTexto, setSoTexto] = useState<number[]>([]);
  return (
    <ArteDoCarrossel
      acao={acao}
      bonusId={BONUS}
      carrosselId={CARROSSEL}
      total={3}
      contas={CONTAS}
      conta={conta}
      aoMudarConta={setConta}
      soTexto={soTexto}
      aoMudarSoTexto={setSoTexto}
      avisoDaConta={avisoDaConta}
      avisos={avisos}
      versaoBase="abcd1234-0"
      pausaMs={0}
    />
  );
}

function renderizar(respostas: AvisoDaArte[], extra: { avisos?: Record<number, string>; avisoDaConta?: string | null } = {}) {
  const recebidos: FormData[] = [];
  const acao = async (_a: AvisoDaArte | null, f: FormData) => {
    recebidos.push(f);
    return respostas.shift() ?? null;
  };
  render(<Secao acao={acao} {...extra} />);
  return recebidos;
}

const miniatura = (n: number) => screen.getByAltText(`Slide ${n} de 3`) as HTMLImageElement;
const soTexto = (n: number) => screen.getByLabelText(`Slide ${n}: só texto, sem o espaço da imagem`) as HTMLInputElement;
const caminhoDe = (img: HTMLImageElement) => img.getAttribute("src");

describe("a seção da arte", () => {
  it("mostra cada slide pela rota da arte, com a versão, e um baixar por slide", () => {
    renderizar([]);
    for (const n of [1, 2, 3]) {
      expect(caminhoDe(miniatura(n))).toBe(`${urlDaArte(BONUS, CARROSSEL, n, "abcd1234-0")}-0`);
      const baixar = screen.getByRole("link", { name: `Baixar o slide ${n}` });
      expect(baixar.getAttribute("href")).toBe(`${urlDaArte(BONUS, CARROSSEL, n, "abcd1234-0")}-0&baixar=1`);
      expect(baixar.hasAttribute("download")).toBe(true);
    }
  });

  it("marcar só texto grava na hora a conta e os slides marcados", async () => {
    const recebidos = renderizar([{ tom: "ok", texto: "Arte salva.", em: 7 }]);
    await act(async () => {
      fireEvent.click(soTexto(2));
    });
    expect(recebidos.map((f) => [f.get("id"), f.get("conta"), f.getAll("so_texto")])).toEqual([[CARROSSEL, "1001", ["2"]]]);
    expect(soTexto(2).checked).toBe(true);
  });

  it("depois de gravar, as miniaturas trocam de versão e são pedidas de novo", async () => {
    renderizar([{ tom: "ok", texto: "Arte salva.", em: 7 }]);
    const antes = caminhoDe(miniatura(1));
    await act(async () => {
      fireEvent.click(soTexto(2));
    });
    expect(caminhoDe(miniatura(1))).not.toBe(antes);
    expect(caminhoDe(miniatura(1))).toContain("abcd1234-0-7");
  });

  it("trocar a conta grava a conta nova", async () => {
    const recebidos = renderizar([{ tom: "ok", texto: "Arte salva.", em: 8 }]);
    await act(async () => {
      fireEvent.change(screen.getByLabelText("Conta do cabeçalho"), { target: { value: "1002" } });
    });
    expect(recebidos.map((f) => f.get("conta"))).toEqual(["1002"]);
  });

  it("a recusa aparece na seção, e a miniatura não troca", async () => {
    renderizar([{ tom: "erro", texto: "Essa conta não está conectada no Chat.", em: 9 }]);
    const antes = caminhoDe(miniatura(1));
    await act(async () => {
      fireEvent.click(soTexto(1));
    });
    expect(screen.getByRole("status").textContent).toBe("Essa conta não está conectada no Chat.");
    expect(caminhoDe(miniatura(1))).toBe(antes);
  });

  it("o aviso de cabimento aparece embaixo do slide dele, e o da conta embaixo do seletor", () => {
    renderizar([], {
      avisos: { 2: "O slide 2 não cabe com o espaço da imagem." },
      avisoDaConta: "A arte usa a conta selecionada no Chat agora (@thiagovannuchi).",
    });
    expect(screen.getByText("O slide 2 não cabe com o espaço da imagem.")).toBeTruthy();
    expect(screen.getByText("A arte usa a conta selecionada no Chat agora (@thiagovannuchi).")).toBeTruthy();
  });

  it("baixar todos baixa um arquivo por slide, em ordem, com o aviso de permissão antes", async () => {
    renderizar([]);
    expect(screen.getByText(/pode pedir permissão para baixar vários arquivos/)).toBeTruthy();
    const baixados: { href: string; download: boolean }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      baixados.push({ href: this.getAttribute("href") ?? "", download: this.hasAttribute("download") });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Baixar todos" }));
    });
    // Um download por vez, com uma pausa entre eles: espera o último.
    await waitFor(() => expect(baixados).toHaveLength(3));
    expect(baixados).toEqual(
      [1, 2, 3].map((n) => ({ href: `${urlDaArte(BONUS, CARROSSEL, n, "abcd1234-0")}-0&baixar=1`, download: true }))
    );
  });
});
```

Crie `testes-dom/bonus-editor-do-carrossel.dom.tsx`:

```tsx
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import EditorDoCarrossel from "@/app/bonus/[id]/carrossel/[cid]/editor-do-carrossel";
import { textoNaoCabeComEspaco } from "@/lib/bonus/arte-textos";
import type { AvisoDaArte } from "@/lib/bonus/arte-textos";
import { camposDoFormulario } from "@/lib/bonus/carrossel-texto";
import type { AvisoDaRevisao } from "@/lib/bonus/carrossel-textos";

// O EDITOR E A ARTE NUM COMPONENTE SÓ (spec da Etapa 3): o aviso "não cabe" acompanha o que se
// digita, e a miniatura troca depois de "Revisão salva.", sem redirect nem `router.refresh` (a
// lição dos achados 52 e 54: recriar a página apaga o que estava na tela).

const BONUS = "0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f";
const CARROSSEL = "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d";
const VALORES = {
  gancho: "Seu cliente sumiu? Não é culpa dele.",
  slide_1_titulo: "O que fazer primeiro",
  slide_1_texto: "Mande uma mensagem curta, lembrando do que ele comprou.",
  chamada: "Comente SUMIDO e receba as mensagens prontas.",
  legenda: "Quem sumiu ainda pode voltar. Comente SUMIDO que eu te mando as mensagens prontas.",
};
/** Cabe sozinho, e não cabe com a manchete e o espaço da imagem (arte-slides). */
const OITO_LINHAS = Array(8).fill("x".repeat(20)).join("\n");

function renderizar({ revisao = [] as AvisoDaRevisao[], arte = [] as AvisoDaArte[] } = {}) {
  render(
    <EditorDoCarrossel
      acaoDaRevisao={async () => revisao.shift() ?? null}
      acaoDaArte={async () => arte.shift() ?? null}
      bonusId={BONUS}
      carrosselId={CARROSSEL}
      palavra="SUMIDO"
      total={3}
      campos={camposDoFormulario(3)}
      valores={VALORES}
      contas={[{ id: "1001", rotulo: "Thiago Vannuchi (@thiagovannuchi)" }]}
      contaInicial="1001"
      avisoDaConta={null}
      soTextoInicial={[]}
      versaoBase="abcd1234"
    />
  );
}

const textoDoSlide2 = () => screen.getByLabelText("Slide 2: texto") as HTMLTextAreaElement;
const miniatura2 = () => screen.getByAltText("Slide 2 de 3") as HTMLImageElement;

describe("o editor do carrossel", () => {
  it("o não cabe aparece enquanto se digita, junto do campo e embaixo da miniatura", () => {
    renderizar();
    expect(screen.queryAllByText(textoNaoCabeComEspaco(2))).toHaveLength(0);
    fireEvent.input(textoDoSlide2(), { target: { value: OITO_LINHAS } });
    expect(screen.getAllByText(textoNaoCabeComEspaco(2))).toHaveLength(2);
  });

  it("marcado só texto, o mesmo slide cabe, e o aviso some", async () => {
    renderizar({ arte: [{ tom: "ok", texto: "Arte salva.", em: 5 }] });
    fireEvent.input(textoDoSlide2(), { target: { value: OITO_LINHAS } });
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Slide 2: só texto, sem o espaço da imagem"));
    });
    expect(screen.queryAllByText(textoNaoCabeComEspaco(2))).toHaveLength(0);
  });

  it("depois de Revisão salva., as miniaturas trocam de versão, sem a página ser recriada", async () => {
    renderizar({ revisao: [{ tom: "ok", texto: "Revisão salva.", em: 42 }] });
    const antes = miniatura2().getAttribute("src");
    fireEvent.input(textoDoSlide2(), { target: { value: "Um texto revisado do slide dois, mais curto." } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Salvar revisão" }));
    });
    expect(miniatura2().getAttribute("src")).not.toBe(antes);
    expect(miniatura2().getAttribute("src")).toContain("v=abcd1234-42-0");
    expect(textoDoSlide2().value).toBe("Um texto revisado do slide dois, mais curto.");
  });

  it("a recusa da revisão não troca a miniatura", async () => {
    renderizar({ revisao: [{ tom: "erro", texto: "Corrija antes de salvar.", em: 43 }] });
    const antes = miniatura2().getAttribute("src");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Salvar revisão" }));
    });
    expect(miniatura2().getAttribute("src")).toBe(antes);
  });
});
```

Em `tests/bonus-carrossel-paginas.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-carrossel-paginas.test.ts b/tests/bonus-carrossel-paginas.test.ts
index afe84bd..eb3a766 100644
--- a/tests/bonus-carrossel-paginas.test.ts
+++ b/tests/bonus-carrossel-paginas.test.ts
@@ -16,8 +16,12 @@ describe("a página do carrossel", () => {
     expect(ler("app/bonus/[id]/carrossel/[cid]/page.tsx")).toContain('import Acompanhar from "../../acompanhar";');
   });
 
-  it("entrega a action de salvar ao formulário da revisão, que mostra a resposta junto do botão", () => {
-    expect(ler("app/bonus/[id]/carrossel/[cid]/page.tsx")).toContain("acao={salvarRevisaoDoCarrossel}");
+  // Na Etapa 3, a página entrega as duas actions ao editor (editor-do-carrossel.tsx), que leva a
+  // da revisão ao formulário e a da arte à seção da arte.
+  it("entrega a action de salvar a revisão e a de salvar a arte ao editor do carrossel", () => {
+    const pagina = ler("app/bonus/[id]/carrossel/[cid]/page.tsx");
+    expect(pagina).toContain("acaoDaRevisao={salvarRevisaoDoCarrossel}");
+    expect(pagina).toContain("acaoDaArte={salvarArteDoCarrossel}");
   });
 });
 
```

Em `tests/bonus-paginas.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-paginas.test.ts b/tests/bonus-paginas.test.ts
index 12e17c5..1dcee29 100644
--- a/tests/bonus-paginas.test.ts
+++ b/tests/bonus-paginas.test.ts
@@ -66,6 +66,8 @@ describe("nenhum campo de revisão do bônus volta a ser não controlado", () =>
     "app/bonus/[id]/carrossel/[cid]/page.tsx",
     "app/bonus/[id]/carrossel/[cid]/campo.tsx",
     "app/bonus/[id]/carrossel/[cid]/formulario-da-revisao.tsx",
+    "app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx",
+    "app/bonus/[id]/carrossel/[cid]/arte-do-carrossel.tsx",
   ])("%s não usa defaultValue", (arquivo) => {
     const semComentarios = ler(arquivo)
       .split("\n")
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-arte-cabimento.test.ts tests/bonus-carrossel-paginas.test.ts tests/bonus-paginas.test.ts
npx vitest run --config vitest.dom.config.ts testes-dom/bonus-arte-do-carrossel.dom.tsx testes-dom/bonus-editor-do-carrossel.dom.tsx
```

Esperado: os arquivos novos caem sem rodar caso nenhum (`Cannot find package`); a página ainda
não entrega `acaoDaRevisao` nem `acaoDaArte`; e os componentes novos ainda não existem para a
guarda de `defaultValue` (`ENOENT`).

- [ ] **Passo 3: o "não cabe" e as frases da tela**

Crie `lib/bonus/arte-cabimento.ts`:

```ts
// O "NÃO CABE" ENQUANTO SE DIGITA: a mesma conta da arte (arte-slides.ts), feita sobre o que está
// nos campos do editor AGORA, e não sobre o texto salvo (spec da Etapa 3, "A prévia e o não cabe").
//
// PURO, e roda no navegador. AVISA, NUNCA IMPEDE: a previsão conta caracteres na largura das
// maiúsculas, e o Satori quebra por palavra (a regra do Labs, `slidesQueNaoCabem`). A prova real
// confere a imagem de verdade com textos no limite de cada degrau.
import { slidesDoTexto, slidesQueNaoCabem } from "./arte-slides";
import { textoNaoCabeComEspaco, textoNaoCabeNunca } from "./arte-textos";
import { slidesDeConteudo } from "./carrossel-pedido";
import type { TextoDoCarrossel } from "./carrossel-texto";

/** O \r\n do textarea volta a ser \n, e as pontas em branco saem: é como a revisão grava. */
function limpo(v: string | undefined): string {
  return (v ?? "").replace(/\r\n?/g, "\n").trim();
}

/** O texto do carrossel montado com os campos (os nomes de `camposDoFormulario`). */
export function textoDosCampos(total: number, valores: Record<string, string>): TextoDoCarrossel {
  if (total === 1) {
    return {
      tipo: "post",
      titulo: "",
      texto: limpo(valores.texto),
      chamada: limpo(valores.chamada),
      legenda: limpo(valores.legenda),
    };
  }
  return {
    tipo: "carrossel",
    titulo: "",
    gancho: limpo(valores.gancho),
    slides: Array.from({ length: slidesDeConteudo(total) }, (_, i) => ({
      titulo: limpo(valores[`slide_${i + 1}_titulo`]),
      texto: limpo(valores[`slide_${i + 1}_texto`]),
    })),
    chamada: limpo(valores.chamada),
    legenda: limpo(valores.legenda),
  };
}

/** O campo do editor onde aparece o aviso do slide: o corpo dele. */
export function campoDoAviso(numero: number, total: number): string {
  if (total === 1) return "texto";
  if (numero === 1) return "gancho";
  if (numero === total) return "chamada";
  return `slide_${numero - 1}_texto`;
}

/**
 * Os avisos, por campo. Com o espaço da imagem, o slide que não cabe pede "só texto" ou um texto
 * menor; o que não cabe nem sem o espaço pede um texto menor; o "só texto" que cabe cala.
 */
export function avisosDeCabimento(total: number, valores: Record<string, string>, soTexto: number[]): Record<string, string> {
  const avisos: Record<string, string> = {};
  for (const f of slidesQueNaoCabem(slidesDoTexto(textoDosCampos(total, valores)))) {
    if (f.cortaSempre) avisos[campoDoAviso(f.numero, total)] = textoNaoCabeNunca(f.numero);
    else if (!soTexto.includes(f.numero)) avisos[campoDoAviso(f.numero, total)] = textoNaoCabeComEspaco(f.numero);
  }
  return avisos;
}
```

Em `lib/bonus/arte-textos.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/arte-textos.ts b/lib/bonus/arte-textos.ts
index ba1c798..cf5253d 100644
--- a/lib/bonus/arte-textos.ts
+++ b/lib/bonus/arte-textos.ts
@@ -1,4 +1,5 @@
 import type { Aviso } from "@/lib/avisos";
+import type { ContaDoCabecalho, OrigemDaConta } from "./arte-conta";
 import type { RecusaDaArte } from "./arte-escolhas";
 
 // AS FRASES DA ARTE DO CARROSSEL, fora do JSX e da rota (o princípio de lib/bonus/textos.ts): uma
@@ -31,3 +32,33 @@ export function textoDaRecusaDaArte(motivo: RecusaDaArte): string {
       return "Esse slide não existe neste carrossel. Recarregue a página.";
   }
 }
+
+// O "não cabe", junto do campo do editor e embaixo da miniatura.
+export function textoNaoCabeComEspaco(numero: number): string {
+  return `O slide ${numero} não cabe com o espaço da imagem. Marque "só texto" nele, ou encurte.`;
+}
+
+export function textoNaoCabeNunca(numero: number): string {
+  return `O slide ${numero} não cabe nem sem o espaço da imagem. Encurte o texto.`;
+}
+
+/** De onde veio a conta do cabeçalho. A gravada não precisa de aviso. */
+export function textoDaOrigemDaConta(origem: OrigemDaConta, arroba: string): string | null {
+  switch (origem) {
+    case "gravada":
+      return null;
+    case "selecionada":
+      return `A arte usa a conta selecionada no Chat agora (@${arroba}). Escolha uma conta acima para gravar neste carrossel.`;
+    case "gravada_saiu":
+      return `A conta gravada neste carrossel foi desconectada do Chat. A arte usa a selecionada agora (@${arroba}).`;
+  }
+}
+
+export function rotuloDaConta(c: ContaDoCabecalho): string {
+  return c.name ? `${c.name} (@${c.username ?? ""})` : `@${c.username ?? ""}`;
+}
+
+/** Antes do "Baixar todos": o navegador costuma pedir permissão para vários downloads. */
+export function textoDoBaixarTodos(total: number): string {
+  return `O navegador pode pedir permissão para baixar vários arquivos de uma vez. Aceite para receber os ${total} slides.`;
+}
```

- [ ] **Passo 4: a seção da arte e o editor**

Crie `app/bonus/[id]/carrossel/[cid]/arte-do-carrossel.tsx`:

```tsx
"use client";
import { useActionState, useState, useTransition } from "react";
import { alertError, btnPrimary, btnSecondary, card, hint, input, label } from "@/app/ui";
import { urlDaArte } from "@/lib/bonus/arte-tela";
import { textoDoBaixarTodos, type AvisoDaArte } from "@/lib/bonus/arte-textos";

// A SEÇÃO DA ARTE DO CARROSSEL (spec da Etapa 3, "As telas"): a conta do cabeçalho, a grade das
// miniaturas com o "só texto" e o "Baixar" de cada slide, e o "Baixar todos".
//
// AS ESCOLHAS SE GRAVAM NA HORA, pela action, e a resposta volta como ESTADO (useActionState), e
// nunca por redirect: a seção fica na página do editor, e recriar a página apagaria a edição
// (achado 52). O formulário é montado aqui, a partir do estado, e despachado numa transição: sem
// `<form action>`, não há o reinício de formulário que o React 19 faz depois da action, e que um
// `<select>` controlado não aguenta (medido no PR #5).
//
// A MINIATURA SÓ É PEDIDA DE NOVO QUANDO A URL MUDA: a rota responde `no-store`, mas a `<img>` não
// refaz o pedido com o mesmo `src`. A versão leva o que veio do servidor (`versaoBase`, com a
// revisão salva somada pelo pai) e a hora da última escolha gravada aqui.
//
// A conta e o "só texto" moram no pai (editor-do-carrossel.tsx), que precisa do "só texto" para o
// aviso de cabimento do editor. A action entra por propriedade, para o teste de tela usar uma falsa.
export default function ArteDoCarrossel({
  acao,
  bonusId,
  carrosselId,
  total,
  contas,
  conta,
  aoMudarConta,
  soTexto,
  aoMudarSoTexto,
  avisoDaConta,
  avisos,
  versaoBase,
  pausaMs = 400,
}: {
  acao: (anterior: AvisoDaArte | null, form: FormData) => Promise<AvisoDaArte | null>;
  bonusId: string;
  carrosselId: string;
  total: number;
  contas: { id: string; rotulo: string }[];
  conta: string | null;
  aoMudarConta: (id: string) => void;
  soTexto: number[];
  aoMudarSoTexto: (slides: number[]) => void;
  avisoDaConta: string | null;
  avisos: Record<number, string>;
  versaoBase: string;
  pausaMs?: number;
}) {
  const [gravadaEm, setGravadaEm] = useState(0);
  const [resposta, despachar, pendente] = useActionState(async (anterior: AvisoDaArte | null, form: FormData) => {
    const r = await acao(anterior, form);
    if (r?.tom === "ok") setGravadaEm(r.em);
    return r;
  }, null);
  const [, iniciar] = useTransition();
  const [baixando, setBaixando] = useState(false);
  const versao = `${versaoBase}-${gravadaEm}`;
  const slides = Array.from({ length: total }, (_, i) => i + 1);

  function gravar(contaNova: string | null, soTextoNovo: number[]) {
    const form = new FormData();
    form.set("id", carrosselId);
    if (contaNova) form.set("conta", contaNova);
    for (const n of soTextoNovo) form.append("so_texto", String(n));
    iniciar(() => despachar(form));
  }

  async function baixarTodos() {
    setBaixando(true);
    for (const n of slides) {
      const a = document.createElement("a");
      a.href = urlDaArte(bonusId, carrosselId, n, versao, true);
      a.setAttribute("download", "");
      document.body.appendChild(a);
      a.click();
      a.remove();
      if (n < total) await new Promise((pronto) => setTimeout(pronto, pausaMs));
    }
    setBaixando(false);
  }

  return (
    <section className={`${card} space-y-4 p-6`}>
      <h2 className="text-base font-semibold">Arte dos slides</h2>
      <div>
        <label htmlFor="conta-da-arte" className={label}>
          Conta do cabeçalho
        </label>
        <select
          id="conta-da-arte"
          value={conta ?? ""}
          disabled={pendente}
          onChange={(e) => {
            aoMudarConta(e.target.value);
            gravar(e.target.value, soTexto);
          }}
          className={input}
        >
          {contas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.rotulo}
            </option>
          ))}
        </select>
        {avisoDaConta && gravadaEm === 0 && <p className={hint}>{avisoDaConta}</p>}
      </div>

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {slides.map((n) => (
          <li key={n} className="space-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- a arte está atrás de sessão, e o
                otimizador de imagem do Next buscaria a URL sem o cookie: a miniatura voltaria 401. */}
            <img
              src={urlDaArte(bonusId, carrosselId, n, versao)}
              alt={`Slide ${n} de ${total}`}
              width={216}
              height={270}
              className="w-full rounded-lg border border-traco dark:border-traco-escuro"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                aria-label={`Slide ${n}: só texto, sem o espaço da imagem`}
                checked={soTexto.includes(n)}
                disabled={pendente}
                onChange={(e) => {
                  const novo = e.target.checked ? [...soTexto, n].sort((a, b) => a - b) : soTexto.filter((s) => s !== n);
                  aoMudarSoTexto(novo);
                  gravar(conta, novo);
                }}
              />
              Só texto
            </label>
            {avisos[n] && <p className="text-xs font-medium text-fecha dark:text-fecha-escuro">{avisos[n]}</p>}
            <a href={urlDaArte(bonusId, carrosselId, n, versao, true)} download className={btnSecondary}>
              Baixar o slide {n}
            </a>
          </li>
        ))}
      </ul>

      {resposta?.tom === "erro" && (
        <p role="status" className={alertError}>
          {resposta.texto}
        </p>
      )}

      <div className="space-y-2">
        <p className={hint}>{textoDoBaixarTodos(total)}</p>
        <button type="button" onClick={baixarTodos} disabled={baixando} className={btnPrimary}>
          Baixar todos
        </button>
      </div>
    </section>
  );
}
```

Crie `app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx`:

```tsx
"use client";
import { useMemo, useState } from "react";
import { avisosDeCabimento, campoDoAviso } from "@/lib/bonus/arte-cabimento";
import type { AvisoDaArte } from "@/lib/bonus/arte-textos";
import type { CampoDoCarrossel } from "@/lib/bonus/carrossel-texto";
import type { AvisoDaRevisao } from "@/lib/bonus/carrossel-textos";
import ArteDoCarrossel from "./arte-do-carrossel";
import FormularioDaRevisao from "./formulario-da-revisao";

// O EDITOR E A ARTE DO CARROSSEL NUM COMPONENTE SÓ (spec da Etapa 3, "A prévia e o não cabe").
//
// Ele guarda o que é dos dois: o que está nos campos agora (para o "não cabe" acompanhar a
// digitação), o "só texto" de cada slide, a conta do cabeçalho e a hora da última "Revisão
// salva.". Quando a revisão salva, a versão das miniaturas muda, e elas são pedidas de novo. Nada
// disso usa redirect nem `router.refresh`: a lição dos achados 52 e 54 é que recriar a página
// apaga o que estava na tela.
export default function EditorDoCarrossel({
  acaoDaRevisao,
  acaoDaArte,
  bonusId,
  carrosselId,
  palavra,
  total,
  campos,
  valores,
  contas,
  contaInicial,
  avisoDaConta,
  soTextoInicial,
  versaoBase,
}: {
  acaoDaRevisao: (anterior: AvisoDaRevisao | null, form: FormData) => Promise<AvisoDaRevisao | null>;
  acaoDaArte: (anterior: AvisoDaArte | null, form: FormData) => Promise<AvisoDaArte | null>;
  bonusId: string;
  carrosselId: string;
  palavra: string;
  total: number;
  campos: CampoDoCarrossel[];
  valores: Record<string, string>;
  contas: { id: string; rotulo: string }[];
  contaInicial: string | null;
  avisoDaConta: string | null;
  soTextoInicial: number[];
  versaoBase: string;
}) {
  const [atuais, setAtuais] = useState(valores);
  const [soTexto, setSoTexto] = useState(soTextoInicial);
  const [conta, setConta] = useState(contaInicial);
  const [revisaoEm, setRevisaoEm] = useState(0);

  const porCampo = useMemo(() => avisosDeCabimento(total, atuais, soTexto), [total, atuais, soTexto]);
  const porSlide = useMemo(() => {
    const r: Record<number, string> = {};
    for (let n = 1; n <= total; n++) {
      const aviso = porCampo[campoDoAviso(n, total)];
      if (aviso) r[n] = aviso;
    }
    return r;
  }, [porCampo, total]);

  return (
    <div className="space-y-6">
      <ArteDoCarrossel
        acao={acaoDaArte}
        bonusId={bonusId}
        carrosselId={carrosselId}
        total={total}
        contas={contas}
        conta={conta}
        aoMudarConta={setConta}
        soTexto={soTexto}
        aoMudarSoTexto={setSoTexto}
        avisoDaConta={avisoDaConta}
        avisos={porSlide}
        versaoBase={`${versaoBase}-${revisaoEm}`}
      />
      <FormularioDaRevisao
        acao={acaoDaRevisao}
        carrosselId={carrosselId}
        palavra={palavra}
        campos={campos}
        valores={valores}
        avisosDeCabimento={porCampo}
        aoEditar={setAtuais}
        aoSalvar={setRevisaoEm}
      />
    </div>
  );
}
```

- [ ] **Passo 5: o formulário, o campo e a página**

Em `app/bonus/[id]/carrossel/[cid]/formulario-da-revisao.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/[id]/carrossel/[cid]/formulario-da-revisao.tsx b/app/bonus/[id]/carrossel/[cid]/formulario-da-revisao.tsx
index 1d7e764..39f9a40 100644
--- a/app/bonus/[id]/carrossel/[cid]/formulario-da-revisao.tsx
+++ b/app/bonus/[id]/carrossel/[cid]/formulario-da-revisao.tsx
@@ -16,23 +16,44 @@ import Campo from "./campo";
 // A action entra por propriedade (a página passa `salvarRevisaoDoCarrossel`), para o teste de tela
 // usar uma falsa. `em` muda a cada resposta, e a key faz o aviso aparecer de novo mesmo quando a
 // mensagem repete.
+//
+// NA ETAPA 3, o editor da arte (editor-do-carrossel.tsx) usa três avisos deste formulário:
+// `aoEditar` recebe o que está nos campos a cada tecla (para o "não cabe"), `aoSalvar` recebe a
+// hora de cada "Revisão salva." (para a miniatura trocar), e `avisosDeCabimento` volta, por campo.
 export default function FormularioDaRevisao({
   acao,
   carrosselId,
   palavra,
   campos,
   valores,
+  avisosDeCabimento,
+  aoEditar,
+  aoSalvar,
 }: {
   acao: (anterior: AvisoDaRevisao | null, form: FormData) => Promise<AvisoDaRevisao | null>;
   carrosselId: string;
   palavra: string;
   campos: CampoDoCarrossel[];
   valores: Record<string, string>;
+  avisosDeCabimento?: Record<string, string>;
+  aoEditar?: (valores: Record<string, string>) => void;
+  aoSalvar?: (em: number) => void;
 }) {
-  const [resposta, enviar] = useActionState(acao, null);
+  const [resposta, enviar] = useActionState(async (anterior: AvisoDaRevisao | null, form: FormData) => {
+    const r = await acao(anterior, form);
+    if (r?.tom === "ok") aoSalvar?.(r.em);
+    return r;
+  }, null);
 
   return (
-    <form action={enviar} className={`${card} space-y-4 p-6`}>
+    <form
+      action={enviar}
+      onInput={(e) => {
+        const dados = new FormData(e.currentTarget);
+        aoEditar?.(Object.fromEntries(campos.map((c) => [c.nome, String(dados.get(c.nome) ?? "")])));
+      }}
+      className={`${card} space-y-4 p-6`}
+    >
       <input type="hidden" name="id" value={carrosselId} />
       <p className={hint}>
         A chamada pede a palavra <strong>{palavra}</strong>. Ela vem do bônus e não se edita aqui.
@@ -47,6 +68,7 @@ export default function FormularioDaRevisao({
           linhas={c.linhas}
           palavra={c.pedePalavra ? palavra : undefined}
           soAPalavra={c.soAPalavra}
+          avisoDeCabimento={avisosDeCabimento?.[c.nome]}
         />
       ))}
       {resposta && <AvisoDoFormulario key={resposta.em} aviso={resposta} />}
```

Em `app/bonus/[id]/carrossel/[cid]/campo.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/[id]/carrossel/[cid]/campo.tsx b/app/bonus/[id]/carrossel/[cid]/campo.tsx
index bb0d74a..6157783 100644
--- a/app/bonus/[id]/carrossel/[cid]/campo.tsx
+++ b/app/bonus/[id]/carrossel/[cid]/campo.tsx
@@ -20,6 +20,9 @@ import { textoDaFaltaDaPalavra, textoDeOutrasPalavras } from "@/lib/bonus/carros
 // como está (achado 53, decisão do Eduardo: copiar continua, com o aviso ao lado). Com
 // `soAPalavra` (só a chamada), avisa também a palavra gritada A MAIS (decisão do Eduardo,
 // 01/10). As regras e a ordem são as de `lerRevisaoDoCarrossel`: primeiro a falta, depois a mais.
+//
+// `avisoDeCabimento` (Etapa 3) é o "não cabe" do slide deste campo, calculado pelo editor da arte
+// sobre o que está nos campos agora. Ele avisa e nunca impede: o salvar não olha para ele.
 export default function Campo({
   nome,
   rotulo,
@@ -28,6 +31,7 @@ export default function Campo({
   linhas,
   palavra,
   soAPalavra,
+  avisoDeCabimento,
 }: {
   nome: string;
   rotulo: string;
@@ -36,6 +40,7 @@ export default function Campo({
   linhas: number;
   palavra?: string;
   soAPalavra?: boolean;
+  avisoDeCabimento?: string;
 }) {
   const [texto, setTexto] = useState(valorInicial);
   const [copiado, setCopiado] = useState(false);
@@ -63,6 +68,7 @@ export default function Campo({
         className={input}
       />
       {aviso && <p className={fieldError}>{aviso}</p>}
+      {avisoDeCabimento && <p className="mt-1.5 text-xs font-medium text-fecha dark:text-fecha-escuro">{avisoDeCabimento}</p>}
       <div className="mt-1 flex items-center justify-between gap-3">
         <p className={hint}>
           {texto.length} de {max} caracteres
```

Em `app/bonus/[id]/carrossel/[cid]/page.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/[id]/carrossel/[cid]/page.tsx b/app/bonus/[id]/carrossel/[cid]/page.tsx
index 8fb497a..a83b65c 100644
--- a/app/bonus/[id]/carrossel/[cid]/page.tsx
+++ b/app/bonus/[id]/carrossel/[cid]/page.tsx
@@ -1,10 +1,16 @@
 import Link from "next/link";
+import { cookies } from "next/headers";
 import { notFound } from "next/navigation";
 import { alertError, alertOk, alertWarn, btnPrimary, card, hint, link, pageSubtitle, pageTitle, skeleton } from "@/app/ui";
-import { gerarCarrosselDeNovo, salvarRevisaoDoCarrossel } from "@/app/bonus/carrossel-actions";
+import { gerarCarrosselDeNovo, salvarArteDoCarrossel, salvarRevisaoDoCarrossel } from "@/app/bonus/carrossel-actions";
+import { ACCOUNT_COOKIE } from "@/lib/account";
 import { avisoDaUrl } from "@/lib/avisos";
+import { resolverConta } from "@/lib/bonus/arte-conta";
+import { escolhasDaArte } from "@/lib/bonus/arte-escolhas";
+import { versaoDaArte } from "@/lib/bonus/arte-tela";
+import { TEXTO_ARTE_SEM_CONTA, rotuloDaConta, textoDaOrigemDaConta } from "@/lib/bonus/arte-textos";
 import type { LinhaDoCarrossel } from "@/lib/bonus/carrossel-linha";
-import { lerCarrossel } from "@/lib/bonus/carrossel-repositorio";
+import { contasParaArte, lerCarrossel } from "@/lib/bonus/carrossel-repositorio";
 import { descricaoDoCarrossel, textoDaLinhaDoCarrossel } from "@/lib/bonus/carrossel-tela";
 import { camposDoFormulario, valoresPorCampo } from "@/lib/bonus/carrossel-texto";
 import {
@@ -19,7 +25,7 @@ import { lerLinha } from "@/lib/bonus/repositorio";
 import { geracaoNaTela } from "@/lib/bonus/tempos";
 import { TEXTO_TRAVOU, type TomDoQuadro } from "@/lib/bonus/textos";
 import Acompanhar from "../../acompanhar";
-import FormularioDaRevisao from "./formulario-da-revisao";
+import EditorDoCarrossel from "./editor-do-carrossel";
 
 // O teto de lib/bonus/tempos.ts (MAX_DURATION_S). O Next exige literal aqui, e
 // tests/bonus-carrossel-paginas.test.ts confere que é o mesmo número. O "Gerar de novo" desta
@@ -118,17 +124,43 @@ async function situacaoDoBonus(bonusId: string): Promise<SituacaoNoLabs> {
   return bonus?.slug ? situacaoNoLabs(process.env.LABS_URL, bonus.slug) : { tipo: "nao_publicado" };
 }
 
-function Revisao({ carrossel }: { carrossel: LinhaDoCarrossel }) {
+/**
+ * O CARROSSEL PRONTO: a arte e o editor, num componente só (editor-do-carrossel.tsx). A conta do
+ * cabeçalho é a gravada no carrossel; sem ela, ou desconectada, a selecionada no Chat agora, e a
+ * tela diz isso (achado 61). A versão das miniaturas leva TUDO o que muda a imagem: a data do
+ * texto, as escolhas da arte, e o nome, o @ e a foto da conta (arte-tela.ts, `versaoDaArte`).
+ */
+async function Revisao({ carrossel }: { carrossel: LinhaDoCarrossel }) {
   const texto = textoDaLinhaDoCarrossel(carrossel);
   if (!texto) return <div className={alertError}>{TEXTO_CARROSSEL_SEM_TEXTO}</div>;
 
+  const contas = await contasParaArte();
+  const escolhas = escolhasDaArte(carrossel.arte, carrossel.total_slides);
+  const { conta, origem } = resolverConta(contas, escolhas.conta, (await cookies()).get(ACCOUNT_COOKIE)?.value);
+  const versaoBase = versaoDaArte([
+    (carrossel.revisado_em ?? carrossel.gerado_em)?.toISOString() ?? "",
+    JSON.stringify(carrossel.arte ?? {}),
+    conta?.ig_user_id ?? "",
+    conta?.name ?? "",
+    conta?.username ?? "",
+    conta?.profile_picture_url ?? "",
+  ]);
+
   return (
-    <FormularioDaRevisao
-      acao={salvarRevisaoDoCarrossel}
+    <EditorDoCarrossel
+      acaoDaRevisao={salvarRevisaoDoCarrossel}
+      acaoDaArte={salvarArteDoCarrossel}
+      bonusId={carrossel.bonus_id}
       carrosselId={carrossel.id}
       palavra={carrossel.palavra}
+      total={carrossel.total_slides}
       campos={camposDoFormulario(carrossel.total_slides)}
       valores={valoresPorCampo(texto)}
+      contas={contas.map((c) => ({ id: c.ig_user_id, rotulo: rotuloDaConta(c) }))}
+      contaInicial={conta?.ig_user_id ?? null}
+      avisoDaConta={conta ? textoDaOrigemDaConta(origem, conta.username ?? "") : TEXTO_ARTE_SEM_CONTA}
+      soTextoInicial={escolhas.soTexto}
+      versaoBase={versaoBase}
     />
   );
 }
```

- [ ] **Passo 6: ver passar**

```bash
npx tsc --noEmit
npm run lint
npx vitest run tests/bonus-arte-cabimento.test.ts tests/bonus-carrossel-paginas.test.ts tests/bonus-paginas.test.ts
npx vitest run --config vitest.dom.config.ts testes-dom/bonus-arte-do-carrossel.dom.tsx testes-dom/bonus-editor-do-carrossel.dom.tsx testes-dom/bonus-carrossel-formulario.dom.tsx testes-dom/bonus-carrossel-campo.dom.tsx testes-dom/bonus-carrossel-aviso.dom.tsx
```

Esperado: `tsc` e lint limpos; 17 casos de cabimento e 30 das guardas das páginas; nas telas, 7
da arte, 4 do editor, e os da revisão da Etapa 2 continuam verdes (26 ao todo nesses cinco).

- [ ] **Passo 7: varrer e commitar**

```bash
F="lib/bonus/arte-cabimento.ts lib/bonus/arte-textos.ts app/bonus/[id]/carrossel/[cid]/arte-do-carrossel.tsx app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx app/bonus/[id]/carrossel/[cid]/formulario-da-revisao.tsx app/bonus/[id]/carrossel/[cid]/campo.tsx app/bonus/[id]/carrossel/[cid]/page.tsx tests/bonus-arte-cabimento.test.ts testes-dom/bonus-arte-do-carrossel.dom.tsx testes-dom/bonus-editor-do-carrossel.dom.tsx tests/bonus-carrossel-paginas.test.ts tests/bonus-paginas.test.ts"
node "$SCRATCH/varrer-texto.mjs" $F
test "$(git branch --show-current)" = "arte-do-carrossel"
git add $F
git commit -m "feat(bonus): a seção da arte na página do carrossel, com o não cabe ao digitar"
```

---

### FASE 3.9 — A verificação completa

- [ ] **Passo 1: o verify**

```bash
npm run verify
```

Esperado: lint e tipos limpos; 89 arquivos / 2 398 casos puros; 19 / 114 de tela; varredura sem
vazamento; build com "MIGRAÇÃO PULADA" e a rota `ƒ /bonus/[id]/carrossel/[cid]/arte` na lista.

- [ ] **Passo 2: a integração inteira**

```bash
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npm run test:integracao
```

Esperado: `[rede-global] ALVO: banco de TESTE`, 37 arquivos, 308 passaram e 8 pularam. O
`registro-de-migracoes` aplica a `015` num schema descartável e a anota.

- [ ] **Passo 3: as provas de mutação**

Copie o Apêndice A para `$SCRATCH/mutar-arte.mjs` e rode da raiz:

```bash
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" node "$SCRATCH/mutar-arte.mjs"
git status --short
```

Esperado: as 19 linhas com ✓, e a árvore limpa depois (cada arquivo volta byte a byte).

- [ ] **Passo 4: conferir o plano contra o código**

Cada arquivo criado ou modificado tem de ser o do bloco deste plano. Extraia os blocos `Crie`
numa pasta à parte (`node "$SCRATCH/extrair.mjs" <plano> <caminho>`) e compare com `git show HEAD:<caminho>`.

---

### FASE 3.10 — A 015 na produção e a prova real (cada escrita só com o OK do Eduardo)

- [ ] **Passo 1: o ensaio a seco da 015**

```bash
node scripts/migrar.mjs
```

Esperado: lista só `015-arte-do-carrossel.sql` como pendente, sem aplicar nada.

- [ ] **Passo 2: aplicar à mão, com o OK do Eduardo**

Pergunte pela caixa. Com o OK:

```bash
node scripts/migrar.mjs --aplicar --a-mao
node scripts/migrar.mjs
```

Esperado: a primeira aplica e anota a `015`; a segunda diz "já aplicada".

- [ ] **Passo 3: o PR, com o OK do Eduardo, e o preview**

Empurre só a branch (`git push origin refs/heads/arte-do-carrossel:refs/heads/arte-do-carrossel`)
e abra o PR para a `main`. No log do build do preview, confira o commit, "Detected Next.js version:
16.3.8", "MIGRAÇÃO PULADA" e a rota da arte na lista.

- [ ] **Passo 4: a prova real no preview, com o Eduardo**

O preview usa o banco de produção, e os carrosséis da prova da Etapa 2 (totais 1, 2, 3, 4 e 10)
estão lá. Com o Eduardo na tela:
1. a arte desenha com a Carlito de verdade (não a de reserva), e com a foto da conta buscada da
   região da Vercel (`gru1`); uma conta sem foto sai com as iniciais;
2. os carrosséis de 1, 2, 3, 4 e 10 slides desenham, e cada "Baixar" baixa o PNG com o nome certo;
3. textos no limite de cada degrau, nos dois modos, com a imagem conferida para ver se cortou (a
   revisão grava em produção: só com o OK);
4. "Baixar todos" num navegador de verdade, com os arquivos contados;
5. trocar a conta e o espaço de um slide, e ver a miniatura mudar sem a página ser recriada (grava
   em produção: só com o OK).

Se a fonte não entrar na função (a peça sai em outra fonte, ou a rota responde a frase da fonte),
o conserto é `outputFileTracingIncludes` no `next.config.ts`, num commit próprio e com o OK do
Eduardo (o arquivo é do dono).

---

### FASE 3.11 — O PR (só quando o Eduardo mandar)

O corpo diz: o que a etapa faz; o que muda fora da pasta (a `015`, `lib/esquema.ts`) e nos arquivos
das etapas anteriores (o Mapa); a `015` já aplicada; os números do verify e da integração; as
mutações; a prova real; e o que fica de fora (o gerador de imagem, publicar e devolver do Canva, o
carrossel avulso). Pré-condições do merge, da spec: a `015` aplicada; o preview desenhando a arte
com a Carlito; nenhum `next dev` apontado para a produção durante o deploy; recarregar as abas
depois.

---

## Apêndice A — as provas de mutação (`mutar-arte.mjs`)

```js
// Provas de mutação da Etapa 3 (a arte), rodadas na cópia de ensaio. Cada arquivo volta byte a byte.
// Uso, da raiz da cópia: node mutar-arte.mjs [filtro]
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const PURA = (f) => `npx vitest run ${f}`;
const TELA = (f) => `npx vitest run --config vitest.dom.config.ts ${f}`;
const INTEG = (f) =>
  `npx vitest run --config vitest.integracao.config.ts ${f}`;
const ROTA = "app/bonus/[id]/carrossel/[cid]/arte/route.tsx";

const MUTACOES = [
  { nome: "57: sem a recusa da palavra ausente", arq: "lib/bonus/publicado.ts",
    de: '  if (ausente(item.palavraChave)) return { tipo: "sem_palavra" };\n', para: "",
    cmd: PURA("tests/bonus-publicado.test.ts"), caso: "sem palavra-chave (chave ausente)" },
  { nome: "58: o tema volta ao teto do pedido do Chat", arq: "lib/bonus/publicado.ts",
    de: "export const TEMA_DO_LABS_MAX = 120;", para: "export const TEMA_DO_LABS_MAX = 80;",
    cmd: PURA("tests/bonus-publicado.test.ts"), caso: "o tema de 120 caracteres" },
  { nome: "58: a palavra fora do padrão vira formato estranho", arq: "lib/bonus/publicado.ts",
    de: '  if (!palavraValida(palavra)) return { tipo: "palavra_fora_do_padrao", palavra };\n',
    para: '  if (!palavraValida(palavra)) return { tipo: "formato_estranho" };\n',
    cmd: PURA("tests/bonus-publicado.test.ts"), caso: "palavra fora do padrão do Chat: SUMI DO" },
  { nome: "o texto medido esquece a manchete (o defeito do Labs)", arq: "lib/bonus/arte-slides.ts",
    de: "  return titulo ? `${titulo}\\n${s.texto}` : s.texto;\n", para: "  return s.texto;\n",
    cmd: PURA("tests/bonus-arte-slides.test.ts"), caso: "o título conta" },
  { nome: "a fonte entrega um peso só", arq: "lib/bonus/arte-fonte.ts",
    de: '      { name: FAMILIA_DA_ARTE, data: negrito, weight: 700, style: "normal" },',
    para: '      { name: FAMILIA_DA_ARTE, data: negrito, weight: 400, style: "normal" },',
    cmd: PURA("tests/bonus-arte-fonte.test.ts"), caso: "são os dois pesos da casa" },
  { nome: "a foto aceita domínio colado no da Meta", arq: "lib/bonus/arte-foto.ts",
    de: "host.endsWith(`.${d}`)", para: "host.endsWith(d)",
    cmd: PURA("tests/bonus-arte-foto.test.ts"), caso: "o domínio de outro, colado no da Meta" },
  { nome: "a foto segue redirect", arq: "lib/bonus/arte-foto.ts",
    de: '      redirect: "manual",\n', para: '      redirect: "follow",\n',
    cmd: PURA("tests/bonus-arte-foto.test.ts"), caso: "JPEG vira data: URI" },
  { nome: "a foto aceita qualquer formato", arq: "lib/bonus/arte-foto.ts",
    de: "  const tipo = bytes ? tipoDaFoto(bytes) : null;\n", para: '  const tipo = bytes ? "jpeg" : null;\n',
    cmd: PURA("tests/bonus-arte-foto.test.ts"), caso: "WebP é sem foto" },
  { nome: "a resposta volta a ser public", arq: "lib/bonus/arte-tela.ts",
    de: '    "Cache-Control": "private, no-store",\n', para: '    "Cache-Control": "public, max-age=0, must-revalidate",\n',
    cmd: PURA("tests/bonus-arte-tela.test.ts"), caso: "a prévia abre no navegador, sem cache" },
  { nome: "o ImageResponse sem os headers (o padrão do next/og)", arq: "lib/bonus/arte-resposta.tsx",
    de: "    headers: cabecalhosDaArte(baixar, nomeDoArquivo),\n", para: "",
    cmd: PURA("tests/bonus-arte-resposta.test.ts"), caso: "sai 1080×1350, em PNG" },
  { nome: "a rota desenha o carrossel de outro bônus", arq: "lib/bonus/arte-tela.ts",
    de: "  if (!linha || linha.bonus_id !== bonusId) return", para: "  if (!linha) return",
    cmd: PURA("tests/bonus-arte-tela.test.ts"), caso: "recusa o carrossel de outro bônus" },
  { nome: "a rota olha o carrossel antes da sessão", arq: ROTA,
    de: "  const jarra = await cookies();\n  if (!isValidSession(jarra.get(SESSION_COOKIE)?.value)) return erro(401, TEXTO_ARTE_SEM_SESSAO);\n  const { id, cid } = await params;\n",
    para: "  const { id, cid } = await params;\n  const jarra = await cookies();\n  if (!isValidSession(jarra.get(SESSION_COOKIE)?.value)) return erro(401, TEXTO_ARTE_SEM_SESSAO);\n",
    cmd: PURA("tests/bonus-arte-paginas.test.ts"), caso: "o GET confere a sessão antes de qualquer outra coisa" },
  { nome: "o formulário da arte aceita conta não conectada", arq: "lib/bonus/arte-escolhas.ts",
    de: '  if (!conectadas.includes(conta)) return { ok: false, motivo: "conta" };\n', para: "",
    cmd: PURA("tests/bonus-arte-escolhas.test.ts"), caso: 'conta que não está conectada é recusada: "9999"' },
  { nome: "o não cabe ignora o só texto", arq: "lib/bonus/arte-cabimento.ts",
    de: "    else if (!soTexto.includes(f.numero))", para: "    else if (soTexto.length >= 0)",
    cmd: PURA("tests/bonus-arte-cabimento.test.ts"), caso: "marcado só texto, o mesmo slide cabe" },
  { nome: "a miniatura não troca depois de gravar a arte", arq: "app/bonus/[id]/carrossel/[cid]/arte-do-carrossel.tsx",
    de: "  const versao = `${versaoBase}-${gravadaEm}`;\n", para: "  const versao = `${versaoBase}-0`;\n",
    cmd: TELA("testes-dom/bonus-arte-do-carrossel.dom.tsx"), caso: "depois de gravar, as miniaturas trocam" },
  { nome: "a miniatura não troca depois de Revisão salva.", arq: "app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx",
    de: "        aoSalvar={setRevisaoEm}\n", para: "",
    cmd: TELA("testes-dom/bonus-editor-do-carrossel.dom.tsx"), caso: "depois de Revisão salva., as miniaturas trocam" },
  { nome: "as escolhas se gravam em carrossel que não está pronto", arq: "lib/bonus/carrossel-repositorio.ts",
    de: "`update carrosseis_gerados set arte = $2::jsonb where id = $1 and estado = 'pronto' returning id`",
    para: "`update carrosseis_gerados set arte = $2::jsonb where id = $1 returning id`",
    cmd: INTEG("testes-integracao/bonus-carrossel-processo.integracao.ts"), caso: "as escolhas só se gravam em carrossel pronto" },
  { nome: "as contas da arte trazem a linha inteira", arq: "lib/bonus/carrossel-repositorio.ts",
    de: "`select ig_user_id, username, name, profile_picture_url from accounts order by created_at asc`",
    para: "`select * from accounts order by created_at asc`",
    cmd: INTEG("testes-integracao/bonus-carrossel-processo.integracao.ts"), caso: "nunca com o token" },
  { nome: "a 015 fora da conferência de partida", arq: "lib/esquema.ts",
    de: '      de: "015-arte-do-carrossel.sql",', para: '      de: "015-arte-do-carrossel.sql.fora",',
    cmd: INTEG("testes-integracao/esquema-de-partida.integracao.ts"), caso: "MARCA D'ÁGUA" },
];

const filtro = process.argv[2];
let ruins = 0;
for (const m of MUTACOES.filter((x) => !filtro || x.nome.includes(filtro))) {
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
    saida = execSync(`${m.cmd} 2>&1`, { encoding: "utf8", stdio: "pipe", env: { ...process.env } });
  } catch (e) {
    caiu = true;
    saida = `${e.stdout ?? ""}${e.stderr ?? ""}`;
  } finally {
    writeFileSync(m.arq, original);
  }
  const casoCaiu = saida.split("\n").some((l) => /FAIL|×/.test(l) && l.includes(m.caso));
  if (!(caiu && casoCaiu)) ruins++;
  console.log(`${caiu && casoCaiu ? "✓" : "✗"} ${m.nome}: o caso "${m.caso}" ${casoCaiu ? "caiu" : "NÃO caiu"}`);
}
process.exit(ruins ? 1 : 0);
```
