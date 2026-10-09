# Gerador de bônus — Plano de implementação da Etapa 10: a lista de carrosséis e o apagar

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: `superpowers:subagent-driven-development`
> (recomendada) ou `superpowers:executing-plans`, fase por fase. Os passos usam caixa de
> seleção (`- [ ]`) para acompanhar.

**Objetivo:** a lista "Carrosséis" separa os carrosséis em três abas pelo estado da publicação, mostra a
capa (o slide 1) e o selo que importa em cada aba, e a página do carrossel ganha o "Apagar carrossel",
com confirmação, para o rascunho.

**Arquitetura:** a regra é pura e testada fora do JSX: `lib/bonus/carrosseis-tela.ts` decide a aba, a
ordem, o selo e a capa de cada carrossel; `lib/bonus/apagar-regras.ts` decide quem pode ser apagado
(`podeApagar`, a mesma trava do publicar, mais a geração do texto e a da imagem) e quais arquivos saem do
bucket. O servidor (`lib/bonus/apagar-carrossel.ts`, novo) apaga numa transação com a linha travada
(`for update`), pelo relógio do banco, e tira os arquivos do bucket depois do commit; a reserva de uma
imagem que perde a corrida para o apagar devolve a recusa `nao_pronto` (achado 96). A action
(`app/bonus/apagar-actions.ts`) confere a sessão, devolve a recusa como estado e, no sucesso, vai para a
lista com o aviso em verde. A tela: o botão com dois cliques no fim das duas páginas do carrossel, e a
lista desenhada por um componente sem estado (`app/carrosseis/lista.tsx`). Sem migração.

**Stack:** a das etapas anteriores, no Next.js 16.3.8: App Router, Server Actions com
`useActionState`, React 19, Postgres (postgres.js via `lib/db.ts`), Vitest (três suítes), Tailwind
v4 com os tokens de `app/ui.ts`.

**Spec:** `docs/specs/2026-10-09-lista-de-carrosseis.md` (commits `d142ed8`, `a98b9ca` e `75861fe`,
liberada pela auditoria com os achados 92 a 96 e lida pelo Eduardo em 09/10; `7ebe02d` registra o que o
ensaio acertou, itens 1 a 3 abaixo). Leia antes de começar: este plano não repete o porquê das regras, só
como construí-las.

**Ensaio do plano (09/10):** o código deste plano foi escrito e testado fase a fase numa cópia isolada
do repositório (`git worktree`, branch local `ensaio-lista`, sem push, saída de `75861fe`), e todo bloco
de código abaixo foi tirado do git dessa cópia por um gerador, sem cópia à mão. Os números do ensaio:
- lint e `tsc` limpos em cada fase; no fim, 118 arquivos e 3 291 casos puros (116 arquivos e 3 209 na base) e
  25 arquivos e 220 de tela (23 arquivos e 203 na base);
- `next build --webpack` limpo, com `ƒ /carrosseis` e `ƒ /carrosseis/[cid]` na lista, e o `AGENTS.md`
  intacto (item 8 abaixo);
- integração no container: 46 arquivos, 515 passaram e 8 pularam (na base, 45 arquivos, 493 passaram e 8 pularam), com o `.env.local` vazio na cópia
  (item 8 abaixo);
- cada fase foi vista falhar antes do código e passar depois, na ordem deste plano, com os números de
  cada uma no passo dela;
- as 28 provas de mutação do Apêndice A derrubaram, cada uma, o caso esperado;
- o plano, aplicado do zero numa cópia limpa, dá os 20 arquivos iguais ao fim do ensaio, byte a byte;
- a guarda do diff (FASE 10.5, passo 4) saiu vazia: nada do `/publicar`, da fila, das automações, dos
  `scripts`, das migrações nem do `package`, e nada fora das pastas da etapa.

O ensaio achou estas coisas, já resolvidas neste plano:
1. **O carrossel escrito à mão nasce sem revisão** (`revisado_em` nulo, `carrossel-repositorio.ts:108-110`):
   em "Rascunhos" ele mostra "Pronto para revisar", e não "sem selo", como os passos 2 e 4 da prova
   diziam. O desenho aprovado mantém esse selo (só o "Revisado" sai); a spec corrigiu a prova em
   `7ebe02d`.
2. **O nome da action e a frase do publicado.** A action é `apagarCarrosselDaPagina` (o sufixo das
   outras actions do gerador, como `pedirImagemDoSlide`), e a transação é `apagarCarrossel`. A recusa do
   publicado, que a página não oferece, também tem frase, porque toda recusa tem: "Este carrossel já foi
   publicado, e fica como histórico." (spec, `7ebe02d`).
3. **Só saem do bucket os caminhos da pasta da conta do carrossel**, na forma exata de cada destino
   (`ehCaminhoDoDestino`): apagar não tem volta, e um caminho estranho guardado na linha não leva junto o
   arquivo de outro post (spec, `7ebe02d`; mutação "10.1: a cópia da fila de outra pasta vai junto").
4. **A FASE 10.1 mexe na página da lista**, o mínimo (os selos e a data vêm do item novo), para o `tsc`
   seguir limpo; a FASE 10.4 a reescreve com as abas e a capa.
5. **O raio da capa é `rounded-lg`**, o da miniatura do card: a guarda da escala
   (`tests/escala.test.ts`) recusa `rounded-md`.
6. **O teste de tela que segura a action tem de soltá-la antes de acabar:** o React 19 enreda as
   transições seguintes na action que ainda não respondeu, e o caso de depois esperava (medido no ensaio:
   o caso da recusa caía só quando rodava depois do caso do "Apagando…").
7. **O `catch` do 23503 envolve o `begin`** (nota da auditoria): o erro aborta a transação do
   postgres.js. A transação foi para uma função à parte (`reservarNaTransacao`), sem mudar o corpo dela, e o
   `catch` reconhece só o código `23503` com a restrição `imagens_geradas_carrossel_id_fkey`; outro erro
   sobe (caso "outro erro do insert não vira recusa").
8. **A cópia de ensaio derruba `registro-de-migracoes`** (7 casos: o script recusa `--a-mao` sem o
   `.env.local`, que a cópia não tem; com um `.env.local` VAZIO os 7 passam, porque a URL vem do
   ambiente), e o `next build` do `verify` (Turbopack) não roda na cópia, que tem o `node_modules` por
   junção: lá rodou `next build --webpack`. Na árvore do projeto os dois rodam (FASE 10.5).
9. **Casos que passam antes do código, de propósito**, porque o que eles provam não muda: na FASE 10.1,
   "o item é o mesmo com e sem palavra-chave" e "o de bônus do Chat"; na FASE 10.4, os casos que já
   existiam em `tests/bonus-avulso-paginas.test.ts`.
10. **Uma integração de cada vez.** Duas rodadas ao mesmo tempo no mesmo container derrubam o schema
   uma da outra (o item 11 do plano da Etapa 7).

**Um ponto para a auditoria conferir** (não muda o desenho aprovado): o apagar tira do bucket as cópias
da fila de uma publicação que falhou (`arte.publicacao.caminhos`), como a spec manda. O dono escreveu que
o item `failed` mantém o arquivo "porque quem for tentar de novo precisa da mídia"
(`app/publicar/post/actions.ts:179`, `lib/queue-drain.ts:301`), mas o calendário não tem "tentar de
novo" ("NÃO HÁ BOTÃO NENHUM", `app/publicar/page.tsx:606-610`), e o `failed` não volta à fila. Se um dia
o "tentar de novo" existir, o carrossel apagado não terá mais a mídia daquele post.

**Fora desta etapa, anotado:** a lista lê os 50 carrosséis mais novos (`listarCarrosseis`, como hoje); a
contagem das abas é desses 50.

## Restrições globais

Valem para todas as fases, sem precisar repetir em cada uma.

- **Branch:** `lista-de-carrosseis`, saída da `main` em `af714d3` (o PR #12 mergeado), sem upstream.
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
- **Pastas da etapa:** `app/bonus/`, `app/carrosseis/` e `lib/bonus/`; fora delas, só testes e `docs/`.
  **Nenhum arquivo do `/publicar`, da fila, das automações, dos `scripts`, das migrações nem do
  `package` muda**, e do `lib/bonus/publicar-*` nada muda também: o apagar só lê a trava do publicar
  (a FASE 10.5 confere).
- **Sem migração.** O build do merge tem de dizer "Nada a aplicar: as 19 migrações".
- **Sufixo de teste é o que decide se ele roda:** `tests/**/*.test.ts` (puro, entra no `verify`),
  `testes-integracao/**/*.integracao.ts` (banco, fora do `verify`), `testes-dom/**/*.dom.tsx`
  (tela, entra no `verify`).
- **Uma rodada de integração de cada vez** (item 10 do ensaio).
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
  77). O preview usa o banco e o bucket de produção: lá, criar um carrossel, agendar, cancelar e apagar
  gravam em produção. Avisar o auditor com a hora antes de cada gravação.
- **Ao fechar cada fase**, avisar o auditor (sessão `metodochat-8e` em 09/10; conferir o nome no
  `ListAgents`, porque ele muda a cada reinício) com o hash e o que conferir. Não esperar a
  resposta para seguir.

## Mapa dos arquivos

| arquivo | responsabilidade | fase |
|---|---|---|
| `lib/bonus/carrosseis-tela.ts` | a aba, a ordem, o selo e a capa de cada carrossel; a aba do endereço; o endereço depois de apagar (achado 92) | 10.1 |
| `lib/bonus/apagar-regras.ts`, `lib/bonus/apagar-textos.ts` | quem pode ser apagado (`podeApagar`), os arquivos que saem do bucket, as frases e o que a página mostra | 10.1 |
| `lib/bonus/apagar-carrossel.ts` | a transação do apagar, com a linha travada, e o bucket depois do commit; a leitura da página | 10.2 |
| `lib/bonus/imagem-repositorio.ts`, `lib/bonus/imagem-processo.ts` | a reserva da imagem que perde a corrida devolve `nao_pronto` (achado 96) | 10.2 |
| `app/bonus/apagar-actions.ts`, `app/bonus/[id]/carrossel/[cid]/apagar.tsx`, `botao-de-apagar.tsx`, as duas `page.tsx` do carrossel | a action, o fim da página e o botão com dois cliques | 10.3 |
| `app/carrosseis/lista.tsx`, `app/carrosseis/page.tsx` | a lista com as abas, a capa e o selo | 10.1 (o mínimo) e 10.4 |

---

## ETAPA 10 — a lista de carrosséis e o apagar

### FASE 10.0 — Começar da main certa

- [ ] **Passo 1: conferir a main e a branch**

```bash
git ls-remote origin refs/heads/main
git switch lista-de-carrosseis
git log --oneline -6
node -e 'console.log(require("./node_modules/next/package.json").version)'
```

Esperado: a `main` em `af714d3` (ou depois dele); a branch com os commits da spec e este plano sobre
`af714d3`; o `node_modules` na 16.3.8. Se a `main` andou, rebaseie a branch nela antes de seguir
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

### FASE 10.1 — As regras puras da lista e do apagar

**Arquivos:**
- Criar: `lib/bonus/apagar-regras.ts`, `lib/bonus/apagar-textos.ts`
- Modificar: `lib/bonus/carrosseis-tela.ts`, `app/carrosseis/page.tsx` (o mínimo, item 4 do ensaio)
- Testar: `tests/bonus-carrosseis-tela.test.ts`, `tests/bonus-apagar-regras.test.ts` (novo)

**Interfaces:**
- Consome: `EstadoDaPublicacao` e `publicacaoLivre` (`lib/bonus/publicar-estado.ts`); `rotuloDoCarrossel`
  (`carrossel-tela.ts`) e `rotuloDaPublicacao` (`publicar-textos.ts`); `geracaoNaTela` e `GeracaoNaTela`
  (`tempos.ts`); `imagensDaArte`, `fotosDaArte`, `jeitoDoCaminho`, `ehCaminhoDoDestino` e
  `publicacaoDaArte` (`publicar-regras.ts`); `resolverConta` e `ContaDoCabecalho` (`arte-conta.ts`);
  `versoesDosSlides`, `cabecalhoParaVersao` e `urlDaArte` (`arte-tela.ts`); `slidesDoTexto`; `fmtDate`
  (`lib/format.ts`); `TEXTO_CARROSSEL_NAO_ENCONTRADO` (`carrossel-textos.ts`).
- Produz, em `carrosseis-tela.ts`: `type AbaDosCarrosseis = "rascunhos" | "agendados" | "publicados"`;
  `ABAS: { aba; rotulo; vazia }[]`; `abaDoCarrossel(estado: EstadoDaPublicacao | null)`;
  `abaDoEndereco(v: string | string[] | undefined)`; `urlDaAba(aba)`; `urlDepoisDeApagar()`;
  `ItemDaListaDeCarrosseis = { id; href; titulo; origem; detalhe; criado; selos: RotuloDaLista[] }` (os
  campos `geracao` e `publicacao` saem); `separarPorAba<T extends EntradaDaLista>(entradas, aba):
  { contagem: Record<AbaDosCarrosseis, number>; daAba: T[] }`; `ContextoDaCapa = { contas; doCookie;
  urlPublica: (caminho: string) => string | null }`; `capaDoCarrossel(l, agoraMs, c): string | null`.
- Produz, em `apagar-regras.ts`: `type MotivoDoApagar = "agendado" | "publicado" | "desconhecido" |
  "geracao" | "imagem" | "nao_existe"`; `type PodeApagar = { ok: true } | { ok: false; motivo }`;
  `podeApagar({ publicacao, geracao, imagemGerando })`; `caminhosDoCarrossel(arte, total, pasta: string | null)`.
- Produz, em `apagar-textos.ts`: `AvisoDoApagar = Aviso & { em: number }`; `TEXTO_APAGAR_CARROSSEL`,
  `TEXTO_CONFIRMAR_APAGAR`, `TEXTO_SIM_APAGAR`, `TEXTO_CANCELAR_APAGAR`, `TEXTO_CARROSSEL_APAGADO`;
  `textoDoApagar(motivo)`; `apagarNaPagina(r: PodeApagar): { tipo: "botao" } | { tipo: "frase"; texto } |
  { tipo: "nada" }`.

- [ ] **Passo 1: os testes**

Em `tests/bonus-carrosseis-tela.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-carrosseis-tela.test.ts b/tests/bonus-carrosseis-tela.test.ts
index 012795d..f357070 100644
--- a/tests/bonus-carrosseis-tela.test.ts
+++ b/tests/bonus-carrosseis-tela.test.ts
@@ -1,15 +1,37 @@
 import { describe, expect, it } from "vitest";
-import { itemDaListaDeCarrosseis } from "@/lib/bonus/carrosseis-tela";
+import { avisoDaUrl } from "@/lib/avisos";
+import { resolverConta, type ContaDoCabecalho } from "@/lib/bonus/arte-conta";
+import { escolhasDaArte } from "@/lib/bonus/arte-escolhas";
+import { slidesDoTexto } from "@/lib/bonus/arte-slides";
+import { cabecalhoParaVersao, urlDaArte, versoesDosSlides } from "@/lib/bonus/arte-tela";
+import {
+  ABAS,
+  abaDoCarrossel,
+  abaDoEndereco,
+  capaDoCarrossel,
+  itemDaListaDeCarrosseis,
+  separarPorAba,
+  urlDaAba,
+  urlDepoisDeApagar,
+  type AbaDosCarrosseis,
+} from "@/lib/bonus/carrosseis-tela";
 import type { LinhaDoCarrossel } from "@/lib/bonus/carrossel-linha";
 import type { TextoDoCarrossel } from "@/lib/bonus/carrossel-texto";
+import type { EstadoDaPublicacao } from "@/lib/bonus/publicar-estado";
+import { fotosDaArte } from "@/lib/bonus/publicar-regras";
+import { TRAVADA_MS } from "@/lib/bonus/tempos";
 
-// O QUE A LISTA "CARROSSÉIS" MOSTRA DE CADA CARROSSEL (spec da Etapa 7, "O menu Carrosséis"): os de
-// bônus e os avulsos, cada um com o endereço da página dele, a origem, a conta, os slides, o estado
-// da geração e, quando há, o da publicação. A página é de servidor; quem decide é esta função.
+// O QUE A LISTA "CARROSSÉIS" MOSTRA DE CADA CARROSSEL (spec da Etapa 7, "O menu Carrosséis"; spec da
+// Etapa 10, "A lista"): os de bônus e os avulsos, cada um com o endereço da página dele, a origem, a
+// conta e os slides; a aba de cada um pelo estado da publicação; a ordem dentro da aba; o selo que diz o
+// que importa naquela aba; e a capa, a miniatura do slide 1. A página é de servidor; quem decide é daqui.
 
 const T0 = Date.parse("2026-10-07T12:00:00Z");
 const BONUS = "0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f";
 const CARROSSEL = "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d";
+const CONTA = "17841400000000001";
+const FOTO = `${CONTA}/bonus-foto/2b3c4d5e-6f70-4a1b-8c2d-3e4f5a6b7c8d.jpg`;
+const PRONTO = `${CONTA}/bonus/3c4d5e6f-7081-4a1b-8c2d-3e4f5a6b7c8d.jpg`;
 const TEXTO: TextoDoCarrossel = {
   tipo: "post",
   titulo: "Conselheiro brutalmente honesto",
@@ -42,6 +64,19 @@ function linha(troca: Partial<LinhaDoCarrossel>): LinhaDoCarrossel {
   };
 }
 
+/** Os nove estados da publicação, um de cada. */
+const ESTADOS: Record<EstadoDaPublicacao["tipo"], EstadoDaPublicacao> = {
+  livre: { tipo: "livre" },
+  agendado: { tipo: "agendado", quando: new Date("2026-10-16T13:00:00Z"), filaId: "f1" },
+  publicando: { tipo: "publicando", filaId: "f2" },
+  publicado: { tipo: "publicado", em: new Date("2026-10-09T18:30:00Z"), filaId: "f3" },
+  falhou: { tipo: "falhou", motivo: "A Meta recusou.", filaId: "f4" },
+  cancelado: { tipo: "cancelado", filaId: "f5" },
+  nao_entrou: { tipo: "nao_entrou" },
+  saiu_da_fila: { tipo: "saiu_da_fila" },
+  desconhecido: { tipo: "desconhecido", status: "guardado" },
+};
+
 describe("o item da lista Carrosséis", () => {
   // A lista não mostra a palavra, e não passa a mostrar a ação (decisão do Eduardo em 08/10, spec da
   // Etapa 8): o item é o mesmo com e sem palavra.
@@ -51,7 +86,7 @@ describe("o item da lista Carrosséis", () => {
     );
   });
 
-  it("o do texto livre: a página do avulso, o título do texto, a origem, a conta e os slides", () => {
+  it("o do texto livre: a página do avulso, o título do texto, a origem, a conta, os slides e a data", () => {
     const item = itemDaListaDeCarrosseis(linha({ arte: { conta: "1001", arroba: "thiagovannuchi" } }), null, T0);
     expect(item).toEqual({
       id: CARROSSEL,
@@ -59,8 +94,8 @@ describe("o item da lista Carrosséis", () => {
       titulo: "Conselheiro brutalmente honesto",
       origem: "Texto livre: Produtividade",
       detalhe: "@thiagovannuchi · Carrossel de 5 slides",
-      geracao: { texto: "Pronto para revisar", tipo: "neutro" },
-      publicacao: null,
+      criado: "07/10/2026, 09:00",
+      selos: [{ texto: "Pronto para revisar", tipo: "neutro" }],
     });
   });
 
@@ -77,26 +112,227 @@ describe("o item da lista Carrosséis", () => {
       null,
       T0
     );
-    expect([item.href, item.titulo, item.origem, item.detalhe, item.geracao.texto]).toEqual([
+    expect([item.href, item.titulo, item.origem, item.detalhe, item.selos]).toEqual([
       `/carrosseis/${CARROSSEL}`,
       "Carrossel de 5 slides",
       "Bônus do Labs: Conselheiro brutalmente honesto",
       "Carrossel de 5 slides",
-      "Gerando",
+      [{ texto: "Gerando", tipo: "neutro" }],
     ]);
   });
 
-  it("o de bônus do Chat: a página de hoje, embaixo do bônus, com o estado da publicação", () => {
-    const item = itemDaListaDeCarrosseis(
-      linha({ origem: "bonus", bonus_id: BONUS, contexto: {}, revisado_em: new Date(T0) }),
-      { tipo: "agendado", quando: new Date(T0 + 3_600_000), filaId: "f1" },
-      T0
-    );
-    expect([item.href, item.origem, item.geracao, item.publicacao]).toEqual([
-      `/bonus/${BONUS}/carrossel/${CARROSSEL}`,
-      "Bônus do Chat",
-      { texto: "Revisado", tipo: "ok" },
-      { texto: "Agendado", tipo: "neutro" },
+  it("o de bônus do Chat: a página de hoje, embaixo do bônus", () => {
+    const item = itemDaListaDeCarrosseis(linha({ origem: "bonus", bonus_id: BONUS, contexto: {}, revisado_em: new Date(T0) }), null, T0);
+    expect([item.href, item.origem]).toEqual([`/bonus/${BONUS}/carrossel/${CARROSSEL}`, "Bônus do Chat"]);
+  });
+});
+
+describe("a aba de cada carrossel", () => {
+  const ABA_DE: Record<EstadoDaPublicacao["tipo"], AbaDosCarrosseis> = {
+    livre: "rascunhos",
+    agendado: "agendados",
+    publicando: "agendados",
+    publicado: "publicados",
+    falhou: "rascunhos",
+    cancelado: "rascunhos",
+    nao_entrou: "rascunhos",
+    saiu_da_fila: "rascunhos",
+    desconhecido: "rascunhos",
+  };
+
+  it.each(Object.keys(ESTADOS) as EstadoDaPublicacao["tipo"][])("%s", (tipo) => {
+    expect(abaDoCarrossel(ESTADOS[tipo])).toBe(ABA_DE[tipo]);
+  });
+
+  it("o carrossel sem publicação guardada (estado nulo) é rascunho", () => {
+    expect(abaDoCarrossel(null)).toBe("rascunhos");
+  });
+
+  it("as três abas, nesta ordem, com o nome e a frase da aba vazia", () => {
+    expect(ABAS).toEqual([
+      { aba: "rascunhos", rotulo: "Rascunhos", vazia: "Nenhum rascunho." },
+      { aba: "agendados", rotulo: "Agendados", vazia: "Nenhum carrossel agendado." },
+      { aba: "publicados", rotulo: "Publicados", vazia: "Nenhum carrossel publicado." },
+    ]);
+  });
+});
+
+describe("a aba do endereço", () => {
+  it.each(["rascunhos", "agendados", "publicados"] as const)("?aba=%s abre ela", (aba) => {
+    expect(abaDoEndereco(aba)).toBe(aba);
+    expect(urlDaAba(aba)).toBe(`/carrosseis?aba=${aba}`);
+  });
+
+  it.each([undefined, "", "Agendados", "lixeira", ["agendados", "publicados"]])("%j abre Rascunhos", (v) => {
+    expect(abaDoEndereco(v)).toBe("rascunhos");
+  });
+});
+
+describe("o selo de cada aba", () => {
+  const selos = (estado: EstadoDaPublicacao | null, troca: Partial<LinhaDoCarrossel> = {}) =>
+    itemDaListaDeCarrosseis(linha(troca), estado, T0).selos;
+
+  it("em Agendados: a hora em que sai, no horário de Brasília, ou o Publicando…", () => {
+    expect(selos(ESTADOS.agendado)).toEqual([{ texto: "Agendado para 16/10, 10:00", tipo: "neutro" }]);
+    expect(selos(ESTADOS.publicando)).toEqual([{ texto: "Publicando…", tipo: "neutro" }]);
+  });
+
+  it("em Publicados: a hora em que saiu, no horário de Brasília; sem a hora, só Publicado (achado 93)", () => {
+    expect(selos(ESTADOS.publicado)).toEqual([{ texto: "Publicado em 09/10, 15:30", tipo: "ok" }]);
+    expect(selos({ tipo: "publicado", em: null, filaId: "f3" })).toEqual([{ texto: "Publicado", tipo: "ok" }]);
+  });
+
+  it("em Rascunhos, o Revisado sai: o revisado nunca agendado, e o cancelado, ficam sem selo", () => {
+    expect(selos(null, { revisado_em: new Date(T0) })).toEqual([]);
+    expect(selos(ESTADOS.livre, { revisado_em: new Date(T0) })).toEqual([]);
+    expect(selos(ESTADOS.cancelado, { revisado_em: new Date(T0) })).toEqual([]);
+  });
+
+  it("em Rascunhos, a geração que pede algo fica: Pronto para revisar, Gerando, Travou e Falhou", () => {
+    expect(selos(null)).toEqual([{ texto: "Pronto para revisar", tipo: "neutro" }]);
+    expect(selos(null, { estado: "gerando", gerado: null })).toEqual([{ texto: "Gerando", tipo: "neutro" }]);
+    expect(selos(null, { estado: "gerando", gerado: null, criado_em: new Date(T0 - TRAVADA_MS - 1) })).toEqual([
+      { texto: "Travou", tipo: "erro" },
     ]);
+    expect(selos(null, { estado: "falhou", gerado: null, erro: "A IA não respondeu." })).toEqual([{ texto: "Falhou", tipo: "erro" }]);
+  });
+
+  it("em Rascunhos, a publicação que não foi ao ar: Não publicou em vermelho, e os rótulos de hoje", () => {
+    const revisado = { revisado_em: new Date(T0) };
+    expect(selos(ESTADOS.falhou, revisado)).toEqual([{ texto: "Não publicou", tipo: "erro" }]);
+    expect(selos(ESTADOS.nao_entrou, revisado)).toEqual([{ texto: "Não entrou na fila", tipo: "atencao" }]);
+    expect(selos(ESTADOS.saiu_da_fila, revisado)).toEqual([{ texto: "Saiu da fila", tipo: "atencao" }]);
+    expect(selos(ESTADOS.desconhecido, revisado)).toEqual([{ texto: "Estado desconhecido", tipo: "atencao" }]);
+  });
+
+  it("os dois selos juntos: o da publicação antes do da geração", () => {
+    expect(selos(ESTADOS.falhou)).toEqual([
+      { texto: "Não publicou", tipo: "erro" },
+      { texto: "Pronto para revisar", tipo: "neutro" },
+    ]);
+  });
+
+  it("nenhum selo diz Revisado, em estado nenhum", () => {
+    for (const estado of [null, ...Object.values(ESTADOS)]) {
+      expect(selos(estado, { revisado_em: new Date(T0) }).map((s) => s.texto)).not.toContain("Revisado");
+    }
+  });
+});
+
+describe("a separação e a ordem das abas", () => {
+  const H = 3_600_000;
+  const entrada = (nome: string, criadoH: number, estado: EstadoDaPublicacao | null) => ({
+    nome,
+    linha: linha({ id: nome, criado_em: new Date(T0 + criadoH * H) }),
+    estado,
+  });
+  const ENTRADAS = [
+    entrada("velho-livre", -48, null),
+    entrada("novo-livre", -1, null),
+    entrada("falhou", -24, ESTADOS.falhou),
+    entrada("agendado-depois", -30, { tipo: "agendado", quando: new Date(T0 + 72 * H), filaId: "a1" }),
+    entrada("agendado-antes", -2, { tipo: "agendado", quando: new Date(T0 + 24 * H), filaId: "a2" }),
+    entrada("publicando", -50, ESTADOS.publicando),
+    entrada("publicado-velho", -10, { tipo: "publicado", em: new Date(T0 - 96 * H), filaId: "p1" }),
+    entrada("publicado-sem-hora", -3, { tipo: "publicado", em: null, filaId: "p2" }),
+    entrada("publicado-novo", -60, { tipo: "publicado", em: new Date(T0 - 5 * H), filaId: "p3" }),
+  ];
+
+  it("a contagem das três abas é a mesma, qualquer que seja a aba aberta", () => {
+    for (const aba of ["rascunhos", "agendados", "publicados"] as const) {
+      expect(separarPorAba(ENTRADAS, aba).contagem).toEqual({ rascunhos: 3, agendados: 3, publicados: 3 });
+    }
+  });
+
+  it("Rascunhos: o mais novo primeiro, pela criação", () => {
+    expect(separarPorAba(ENTRADAS, "rascunhos").daAba.map((e) => e.nome)).toEqual(["novo-livre", "falhou", "velho-livre"]);
+  });
+
+  it("Agendados: o Publicando antes de todos, e depois o próximo a sair", () => {
+    expect(separarPorAba(ENTRADAS, "agendados").daAba.map((e) => e.nome)).toEqual(["publicando", "agendado-antes", "agendado-depois"]);
+  });
+
+  it("Publicados: o mais recente primeiro, pela hora em que saiu; o sem hora no fim (achado 93)", () => {
+    expect(separarPorAba(ENTRADAS, "publicados").daAba.map((e) => e.nome)).toEqual([
+      "publicado-novo",
+      "publicado-velho",
+      "publicado-sem-hora",
+    ]);
+  });
+
+  it("a lista vazia dá zero nas três", () => {
+    expect(separarPorAba([], "rascunhos")).toEqual({ contagem: { rascunhos: 0, agendados: 0, publicados: 0 }, daAba: [] });
+  });
+});
+
+describe("a capa: a miniatura do slide 1, como a página do carrossel a mostra", () => {
+  const CONTAS: ContaDoCabecalho[] = [
+    { ig_user_id: CONTA, username: "thiagovannuchi", name: "Thiago Vannuchi", profile_picture_url: "https://cdn.exemplo/foto.jpg" },
+  ];
+  const urlPublica = (caminho: string) => `https://bucket.exemplo/${caminho}`;
+  const capa = (troca: Partial<LinhaDoCarrossel>, publica: (c: string) => string | null = urlPublica) =>
+    capaDoCarrossel(linha(troca), T0, { contas: CONTAS, doCookie: undefined, urlPublica: publica });
+  /** A versão que a página do carrossel calcula para o slide 1 (revisao.tsx), com a conta do cabeçalho. */
+  const versaoDaPagina = (l: LinhaDoCarrossel) => {
+    const escolhas = escolhasDaArte(l.arte, l.total_slides);
+    const { conta } = resolverConta(CONTAS, escolhas, undefined);
+    return versoesDosSlides(slidesDoTexto(TEXTO), escolhas.soTexto, cabecalhoParaVersao(conta), fotosDaArte(l.arte, l.total_slides))[0];
+  };
+
+  it("sem imagem no slide 1: a arte do slide 1, com a versão que a página calcula", () => {
+    const l = linha({ arte: { conta: CONTA, nome: "Thiago Vannuchi", arroba: "thiagovannuchi" } });
+    expect(capa({ arte: l.arte })).toBe(urlDaArte(`/carrosseis/${CARROSSEL}`, 1, versaoDaPagina(l)));
+  });
+
+  it("o carrossel de bônus: a arte mora embaixo do bônus", () => {
+    expect(capa({ origem: "bonus", bonus_id: BONUS, contexto: {} })).toMatch(new RegExp(`^/bonus/${BONUS}/carrossel/${CARROSSEL}/arte\\?slide=1&v=`));
+  });
+
+  it("com a foto no espaço do slide 1: a arte, com a foto na versão", () => {
+    const l = linha({ arte: { conta: CONTA, imagens: { "1": { caminho: FOTO, versao: "v1" } } } });
+    expect(capa({ arte: l.arte })).toBe(urlDaArte(`/carrosseis/${CARROSSEL}`, 1, versaoDaPagina(l)));
+    expect(capa({ arte: l.arte })).not.toBe(capa({ arte: { conta: CONTA } }));
+  });
+
+  it("com o slide pronto do Canva no slide 1: a imagem dele", () => {
+    expect(capa({ arte: { conta: CONTA, imagens: { "1": { caminho: PRONTO, versao: "v1" } } } })).toBe(urlPublica(PRONTO));
+  });
+
+  it("o slide pronto num slide 1 marcado Só texto não conta: a arte", () => {
+    expect(capa({ arte: { conta: CONTA, soTexto: [1], imagens: { "1": { caminho: PRONTO, versao: "v1" } } } })).toMatch(
+      /\/arte\?slide=1&v=/
+    );
+  });
+
+  it("o slide pronto sem endereço público (o bucket fora do ar na montagem): a arte", () => {
+    expect(capa({ arte: { conta: CONTA, imagens: { "1": { caminho: PRONTO, versao: "v1" } } } }, () => null)).toMatch(
+      /\/arte\?slide=1&v=/
+    );
+  });
+
+  it("o slide pronto de outro slide não muda a capa", () => {
+    expect(capa({ arte: { conta: CONTA, imagens: { "2": { caminho: PRONTO, versao: "v1" } } } })).toBe(capa({ arte: { conta: CONTA } }));
+  });
+
+  it("ainda gerando, travado ou falhado: o quadro vazio (null)", () => {
+    expect(capa({ estado: "gerando", gerado: null })).toBeNull();
+    expect(capa({ estado: "gerando", gerado: null, criado_em: new Date(T0 - TRAVADA_MS - 1) })).toBeNull();
+    expect(capa({ estado: "falhou", gerado: null, erro: "A IA não respondeu." })).toBeNull();
+  });
+
+  it("pronto, mas sem texto legível: o quadro vazio", () => {
+    expect(capa({ gerado: { lixo: true } as unknown as TextoDoCarrossel })).toBeNull();
+  });
+});
+
+describe("o endereço depois de apagar (achado 92)", () => {
+  it("vai para Rascunhos, com o aviso em verde: sem tom=ok, o aviso sairia vermelho", () => {
+    expect(urlDepoisDeApagar()).toBe("/carrosseis?aba=rascunhos&aviso=Carrossel%20apagado.&tom=ok");
+  });
+
+  it("a página lê dele a aba e o aviso verde", () => {
+    const sp = new URL(urlDepoisDeApagar(), "https://chat.exemplo").searchParams;
+    expect(abaDoEndereco(sp.get("aba") ?? undefined)).toBe("rascunhos");
+    expect(avisoDaUrl(sp.get("aviso") ?? undefined, sp.get("tom") ?? undefined)).toEqual({ tom: "ok", texto: "Carrossel apagado." });
   });
 });
```

Crie `tests/bonus-apagar-regras.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { caminhosDoCarrossel, podeApagar, type MotivoDoApagar } from "@/lib/bonus/apagar-regras";
import {
  TEXTO_APAGAR_CARROSSEL,
  TEXTO_CANCELAR_APAGAR,
  TEXTO_CARROSSEL_APAGADO,
  TEXTO_CONFIRMAR_APAGAR,
  TEXTO_SIM_APAGAR,
  apagarNaPagina,
  textoDoApagar,
} from "@/lib/bonus/apagar-textos";
import { TEXTO_CARROSSEL_NAO_ENCONTRADO } from "@/lib/bonus/carrossel-textos";
import type { EstadoDaPublicacao } from "@/lib/bonus/publicar-estado";
import type { GeracaoNaTela } from "@/lib/bonus/tempos";

// QUEM PODE SER APAGADO (spec da Etapa 10, "Quem pode ser apagado"): a mesma regra na tela e no
// servidor. A trava do publicar e a do apagar são uma só (`publicacaoLivre`); a geração do texto em
// andamento e uma imagem sendo gerada (achado 95) também seguram. E o que sai do bucket depois do commit.

const ESTADOS: Record<EstadoDaPublicacao["tipo"], EstadoDaPublicacao> = {
  livre: { tipo: "livre" },
  agendado: { tipo: "agendado", quando: new Date("2026-10-16T13:00:00Z"), filaId: "f1" },
  publicando: { tipo: "publicando", filaId: null },
  publicado: { tipo: "publicado", em: null, filaId: "f3" },
  falhou: { tipo: "falhou", motivo: null, filaId: "f4" },
  cancelado: { tipo: "cancelado", filaId: "f5" },
  nao_entrou: { tipo: "nao_entrou" },
  saiu_da_fila: { tipo: "saiu_da_fila" },
  desconhecido: { tipo: "desconhecido" },
};

const pode = (publicacao: EstadoDaPublicacao, geracao: GeracaoNaTela = "pronto", imagemGerando = false) =>
  podeApagar({ publicacao, geracao, imagemGerando });

describe("podeApagar", () => {
  it.each(["livre", "falhou", "cancelado", "nao_entrou"] as const)("a publicação %s, livre pela regra do publicar, pode", (tipo) => {
    expect(pode(ESTADOS[tipo])).toEqual({ ok: true });
  });

  it.each([
    ["agendado", "agendado"],
    ["publicando", "agendado"],
    ["publicado", "publicado"],
    ["saiu_da_fila", "desconhecido"],
    ["desconhecido", "desconhecido"],
  ] as const)("a publicação %s não pode (%s)", (tipo, motivo) => {
    expect(pode(ESTADOS[tipo])).toEqual({ ok: false, motivo });
  });

  it("a geração parada pode: pronta, travada ou falhada", () => {
    for (const geracao of ["pronto", "travou", "falhou"] as const) expect(pode(ESTADOS.livre, geracao)).toEqual({ ok: true });
  });

  it("a geração do texto em andamento não pode", () => {
    expect(pode(ESTADOS.livre, "gerando")).toEqual({ ok: false, motivo: "geracao" });
  });

  it("uma imagem do carrossel sendo gerada não pode (achado 95)", () => {
    expect(pode(ESTADOS.livre, "pronto", true)).toEqual({ ok: false, motivo: "imagem" });
  });

  it("a publicação trava antes de tudo: o agendado com uma imagem gerando diz o do calendário", () => {
    expect(pode(ESTADOS.agendado, "pronto", true)).toEqual({ ok: false, motivo: "agendado" });
  });

  it("um estado que a fila venha a ter trava, como no publicar", () => {
    expect(pode({ tipo: "novo_estado" } as unknown as EstadoDaPublicacao)).toEqual({ ok: false, motivo: "desconhecido" });
  });
});

describe("as frases do apagar", () => {
  const FRASES: Record<MotivoDoApagar, string> = {
    agendado: "Para apagar, cancele o agendamento no calendário antes.",
    publicado: "Este carrossel já foi publicado, e fica como histórico.",
    desconhecido: "Não consegui conferir a publicação deste carrossel; ele não pode ser apagado agora.",
    geracao: "Espere a geração terminar para apagar.",
    imagem: "Espere a imagem terminar para apagar.",
    nao_existe: TEXTO_CARROSSEL_NAO_ENCONTRADO,
  };

  it.each(Object.keys(FRASES) as MotivoDoApagar[])("%s tem frase", (motivo) => {
    expect(textoDoApagar(motivo)).toBe(FRASES[motivo]);
  });

  it("o botão, a pergunta e o aviso", () => {
    expect([TEXTO_APAGAR_CARROSSEL, TEXTO_CONFIRMAR_APAGAR, TEXTO_SIM_APAGAR, TEXTO_CANCELAR_APAGAR, TEXTO_CARROSSEL_APAGADO]).toEqual([
      "Apagar carrossel",
      "Apagar este carrossel e as imagens dele? Não tem volta.",
      "Sim, apagar",
      "Cancelar",
      "Carrossel apagado.",
    ]);
  });
});

describe("o que a página mostra no fim", () => {
  it("pode: o botão", () => {
    expect(apagarNaPagina({ ok: true })).toEqual({ tipo: "botao" });
  });

  it("o publicado: nada, porque fica como histórico", () => {
    expect(apagarNaPagina({ ok: false, motivo: "publicado" })).toEqual({ tipo: "nada" });
  });

  it.each(["agendado", "desconhecido", "geracao", "imagem"] as const)("%s: a frase no lugar do botão", (motivo) => {
    expect(apagarNaPagina({ ok: false, motivo })).toEqual({ tipo: "frase", texto: textoDoApagar(motivo) });
  });
});

describe("os arquivos que saem do bucket depois do commit", () => {
  const CONTA = "17841400000000001";
  const u = (n: number) => `${String(n).repeat(8)}-1111-4111-8111-111111111111`;
  const FOTO = `${CONTA}/bonus-foto/${u(1)}.jpg`;
  const PRONTO = `${CONTA}/bonus/${u(2)}.jpg`;
  const FILA_1 = `${CONTA}/bonus-fila/${u(3)}.jpg`;
  const FILA_2 = `${CONTA}/bonus-fila/${u(4)}.jpg`;
  const publicacao = (caminhos: string[]) => ({ chave: "k", caminhos, reservada_em: "2026-10-09T12:00:00Z" });

  it("as imagens dos slides (fotos e slides prontos) e as cópias da fila", () => {
    const arte = {
      conta: CONTA,
      imagens: { "1": { caminho: FOTO, versao: "v" }, "3": { caminho: PRONTO, versao: "v" } },
      publicacao: publicacao([FILA_1, FILA_2]),
    };
    expect(caminhosDoCarrossel(arte, 5, CONTA)).toEqual([FOTO, PRONTO, FILA_1, FILA_2]);
  });

  it("sem repetir um caminho", () => {
    const arte = { conta: CONTA, publicacao: publicacao([FILA_1, FILA_1]) };
    expect(caminhosDoCarrossel(arte, 5, CONTA)).toEqual([FILA_1]);
  });

  it("só os da pasta da conta do carrossel, na forma exata do destino: um caminho estranho fica", () => {
    const OUTRA = `99999/bonus-fila/${u(5)}.jpg`;
    const DO_PUBLICAR = `${CONTA}/post-123.jpg`;
    const FILA_COMO_FOTO = `${CONTA}/bonus-fila/${u(6)}.png`;
    const arte = {
      conta: CONTA,
      imagens: { "1": { caminho: `99999/bonus-foto/${u(7)}.jpg`, versao: "v" } },
      publicacao: publicacao([OUTRA, DO_PUBLICAR, FILA_COMO_FOTO, FILA_1]),
    };
    expect(caminhosDoCarrossel(arte, 5, CONTA)).toEqual([FILA_1]);
  });

  it("sem conta, sem imagens e sem publicação: nada", () => {
    expect(caminhosDoCarrossel({}, 5, null)).toEqual([]);
    expect(caminhosDoCarrossel({ conta: CONTA }, 5, CONTA)).toEqual([]);
  });

  it("a publicação estranha não apaga nada da fila", () => {
    expect(caminhosDoCarrossel({ conta: CONTA, publicacao: { chave: "k" } }, 5, CONTA)).toEqual([]);
  });
});
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-carrosseis-tela.test.ts
npx vitest run tests/bonus-apagar-regras.test.ts
```

Esperado: no `bonus-carrosseis-tela`, 44 caem e 2 passam (46): as funções novas não existem, e o item mudou de
forma; os 2 que passam são os do item que não muda (item 9 do ensaio). O `bonus-apagar-regras` cai sem
rodar caso nenhum, porque `lib/bonus/apagar-regras.ts` não existe.

- [ ] **Passo 3: o código**

Crie `lib/bonus/apagar-regras.ts`:

```ts
// AS REGRAS PURAS DO APAGAR (spec da Etapa 10, "Quem pode ser apagado" e "O apagar no servidor"). PURO:
// a página e o servidor decidem por aqui, e nenhuma regra mora no JSX nem no SQL.
import { publicacaoLivre, type EstadoDaPublicacao } from "./publicar-estado";
import { ehCaminhoDoDestino, imagensDaArte, jeitoDoCaminho, publicacaoDaArte } from "./publicar-regras";
import type { GeracaoNaTela } from "./tempos";

export type MotivoDoApagar = "agendado" | "publicado" | "desconhecido" | "geracao" | "imagem" | "nao_existe";

export type PodeApagar = { ok: true } | { ok: false; motivo: MotivoDoApagar };

/**
 * QUEM PODE SER APAGADO: a publicação livre pela regra do publicar (`publicacaoLivre`: a trava do
 * publicar e a do apagar são uma só), a geração do texto fora de andamento, e nenhuma imagem do
 * carrossel sendo gerada (achado 95: a imagem já paga à OpenAI não vai fora). A publicação decide
 * primeiro: o que está na fila diz o do calendário, mesmo com uma imagem gerando.
 */
export function podeApagar(p: { publicacao: EstadoDaPublicacao; geracao: GeracaoNaTela; imagemGerando: boolean }): PodeApagar {
  if (!publicacaoLivre(p.publicacao)) {
    switch (p.publicacao.tipo) {
      case "publicado":
        return { ok: false, motivo: "publicado" };
      case "agendado":
      case "publicando":
        return { ok: false, motivo: "agendado" };
      default:
        return { ok: false, motivo: "desconhecido" };
    }
  }
  if (p.geracao === "gerando") return { ok: false, motivo: "geracao" };
  if (p.imagemGerando) return { ok: false, motivo: "imagem" };
  return { ok: true };
}

/**
 * OS ARQUIVOS DO CARROSSEL NO BUCKET, que saem depois do commit: as imagens guardadas nos slides (as
 * fotos e as imagens geradas em `bonus-foto/`, os slides prontos em `bonus/`) e as cópias da fila que
 * tenham sobrado (`arte.publicacao.caminhos`, em `bonus-fila/`). Só os da pasta da conta do carrossel, na
 * forma exata do destino (`ehCaminhoDoDestino`): apagar não tem volta, e um caminho estranho guardado
 * na linha não leva junto o arquivo de outro post.
 */
export function caminhosDoCarrossel(arte: unknown, total: number, pasta: string | null): string[] {
  if (pasta === null) return [];
  const imagens = Object.values(imagensDaArte(arte, total))
    .map((i) => i.caminho)
    .filter((c) => {
      const jeito = jeitoDoCaminho(c);
      return jeito !== null && ehCaminhoDoDestino(c, pasta, jeito);
    });
  const publicacao = publicacaoDaArte(arte);
  const daFila = publicacao && publicacao !== "estranha" ? publicacao.caminhos.filter((c) => ehCaminhoDoDestino(c, pasta, "fila")) : [];
  const todos = [...imagens, ...daFila];
  return todos.filter((c, i) => todos.indexOf(c) === i);
}
```

Crie `lib/bonus/apagar-textos.ts`:

```ts
import type { Aviso } from "@/lib/avisos";
import type { MotivoDoApagar, PodeApagar } from "./apagar-regras";
import { TEXTO_CARROSSEL_NAO_ENCONTRADO } from "./carrossel-textos";

// AS FRASES DO APAGAR (spec da Etapa 10, "A página do carrossel"), fora do JSX e da action (o princípio
// de lib/bonus/textos.ts): uma saída muda é indistinguível de sucesso, e cada recusa tem frase, testada.

/** A resposta da action: só a recusa volta (o sucesso sai por redirect). `em` remonta o aviso. */
export type AvisoDoApagar = Aviso & { em: number };

export const TEXTO_APAGAR_CARROSSEL = "Apagar carrossel";
export const TEXTO_CONFIRMAR_APAGAR = "Apagar este carrossel e as imagens dele? Não tem volta.";
export const TEXTO_SIM_APAGAR = "Sim, apagar";
export const TEXTO_CANCELAR_APAGAR = "Cancelar";
export const TEXTO_CARROSSEL_APAGADO = "Carrossel apagado.";

export function textoDoApagar(motivo: MotivoDoApagar): string {
  switch (motivo) {
    case "agendado":
      return "Para apagar, cancele o agendamento no calendário antes.";
    case "publicado":
      return "Este carrossel já foi publicado, e fica como histórico.";
    case "desconhecido":
      return "Não consegui conferir a publicação deste carrossel; ele não pode ser apagado agora.";
    case "geracao":
      return "Espere a geração terminar para apagar.";
    case "imagem":
      return "Espere a imagem terminar para apagar.";
    case "nao_existe":
      return TEXTO_CARROSSEL_NAO_ENCONTRADO;
  }
}

/**
 * O QUE A PÁGINA MOSTRA NO FIM: o botão, quando pode; a frase no lugar dele, quando não pode; e nada no
 * publicado, que fica como histórico (decisão do Eduardo em 09/10).
 */
export function apagarNaPagina(r: PodeApagar): { tipo: "botao" } | { tipo: "frase"; texto: string } | { tipo: "nada" } {
  if (r.ok) return { tipo: "botao" };
  return r.motivo === "publicado" ? { tipo: "nada" } : { tipo: "frase", texto: textoDoApagar(r.motivo) };
}
```

Em `lib/bonus/carrosseis-tela.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/carrosseis-tela.ts b/lib/bonus/carrosseis-tela.ts
index ee7f76b..5010448 100644
--- a/lib/bonus/carrosseis-tela.ts
+++ b/lib/bonus/carrosseis-tela.ts
@@ -1,20 +1,91 @@
-// O QUE A LISTA "CARROSSÉIS" MOSTRA DE CADA CARROSSEL (spec da Etapa 7, "O menu Carrosséis"), decidido
-// fora do JSX, com teste. PURO: a página lê as linhas e o estado da fila, e esta função decide.
+// O QUE A LISTA "CARROSSÉIS" MOSTRA DE CADA CARROSSEL (spec da Etapa 7, "O menu Carrosséis"; spec da
+// Etapa 10, "A lista"), decidido fora do JSX, com teste. PURO: a página lê as linhas, o estado da fila e
+// as contas, e estas funções decidem a aba, a ordem, o selo e a capa.
+import { fmtDate } from "@/lib/format";
+import { resolverConta, type ContaDoCabecalho } from "./arte-conta";
 import { escolhasDaArte } from "./arte-escolhas";
+import { slidesDoTexto } from "./arte-slides";
+import { cabecalhoParaVersao, urlDaArte, versoesDosSlides } from "./arte-tela";
+import { TEXTO_CARROSSEL_APAGADO } from "./apagar-textos";
 import { textoDaOrigem } from "./avulso-textos";
 import { caminhoDoCarrossel } from "./carrossel-caminho";
 import type { LinhaDoCarrossel } from "./carrossel-linha";
 import { descricaoDoCarrossel, rotuloDoCarrossel, textoDaLinhaDoCarrossel } from "./carrossel-tela";
 import type { EstadoDaPublicacao } from "./publicar-estado";
+import { fotosDaArte, imagensDaArte, jeitoDoCaminho } from "./publicar-regras";
 import { rotuloDaPublicacao } from "./publicar-textos";
 import type { TipoDoRotulo } from "./tela";
+import { geracaoNaTela } from "./tempos";
 
 export type RotuloDaLista = { texto: string; tipo: TipoDoRotulo };
 
+/** As abas da lista, pelo estado da publicação de hoje (spec da Etapa 10, "A lista"). */
+export type AbaDosCarrosseis = "rascunhos" | "agendados" | "publicados";
+
+export const ABAS: { aba: AbaDosCarrosseis; rotulo: string; vazia: string }[] = [
+  { aba: "rascunhos", rotulo: "Rascunhos", vazia: "Nenhum rascunho." },
+  { aba: "agendados", rotulo: "Agendados", vazia: "Nenhum carrossel agendado." },
+  { aba: "publicados", rotulo: "Publicados", vazia: "Nenhum carrossel publicado." },
+];
+
+/**
+ * A ABA DE UM CARROSSEL. O que está na fila (o agendado e o que está saindo) é "Agendados"; o que saiu
+ * é "Publicados"; todo o resto é rascunho, inclusive o que falhou ao publicar e o estado que o Chat não
+ * reconhece (esse com o selo dele). `null` é o carrossel sem publicação guardada.
+ */
+export function abaDoCarrossel(estado: EstadoDaPublicacao | null): AbaDosCarrosseis {
+  if (estado?.tipo === "agendado" || estado?.tipo === "publicando") return "agendados";
+  if (estado?.tipo === "publicado") return "publicados";
+  return "rascunhos";
+}
+
+/** A aba do `?aba=`: o endereço é digitável, e um valor desconhecido abre "Rascunhos". */
+export function abaDoEndereco(v: string | string[] | undefined): AbaDosCarrosseis {
+  return ABAS.find((a) => a.aba === v)?.aba ?? "rascunhos";
+}
+
+export function urlDaAba(aba: AbaDosCarrosseis): string {
+  return `/carrosseis?aba=${aba}`;
+}
+
+/**
+ * DEPOIS DE APAGAR, a lista na aba "Rascunhos", com o aviso em verde. Sem `tom=ok`, `avisoDaUrl` pinta o
+ * aviso de vermelho (lib/avisos.ts), e o sucesso pareceria falha (achado 92).
+ */
+export function urlDepoisDeApagar(): string {
+  return `${urlDaAba("rascunhos")}&aviso=${encodeURIComponent(TEXTO_CARROSSEL_APAGADO)}&tom=ok`;
+}
+
+/** "16/10, 10:00", no horário de Brasília: o selo é curto, e o ano é o de agora. */
+const DIA_E_HORA = new Intl.DateTimeFormat("pt-BR", {
+  timeZone: "America/Sao_Paulo",
+  day: "2-digit",
+  month: "2-digit",
+  hour: "2-digit",
+  minute: "2-digit",
+});
+
+/**
+ * O SELO DE CADA ABA: em "Agendados", quando sai; em "Publicados", quando saiu; em "Rascunhos", só o que
+ * pede algo (a publicação que não foi ao ar, e a geração que não está revisada). O "Revisado" sai.
+ */
+function selosDoCarrossel(l: LinhaDoCarrossel, estado: EstadoDaPublicacao | null, agoraMs: number): RotuloDaLista[] {
+  switch (estado?.tipo) {
+    case "agendado":
+      return [{ texto: `Agendado para ${DIA_E_HORA.format(estado.quando)}`, tipo: "neutro" }];
+    case "publicando":
+      return [{ texto: "Publicando…", tipo: "neutro" }];
+    case "publicado":
+      return [{ texto: estado.em ? `Publicado em ${DIA_E_HORA.format(estado.em)}` : "Publicado", tipo: "ok" }];
+  }
+  const daPublicacao = estado && estado.tipo !== "livre" && estado.tipo !== "cancelado" ? rotuloDaPublicacao(estado) : null;
+  const revisado = geracaoNaTela(l.estado, l.criado_em, agoraMs) === "pronto" && l.revisado_em !== null;
+  return [daPublicacao, revisado ? null : rotuloDoCarrossel(l, agoraMs)].filter((s): s is RotuloDaLista => s !== null);
+}
+
 /**
  * Uma linha da lista. `href` é a página do carrossel: a de bônus, embaixo do bônus; a do avulso, em
- * /carrosseis. `detalhe` é a conta (o @ guardado no carrossel) e o número de slides; a data, a página
- * formata.
+ * /carrosseis. `detalhe` é a conta (o @ guardado no carrossel) e o número de slides; `criado`, a data.
  */
 export type ItemDaListaDeCarrosseis = {
   id: string;
@@ -22,8 +93,8 @@ export type ItemDaListaDeCarrosseis = {
   titulo: string;
   origem: string;
   detalhe: string;
-  geracao: RotuloDaLista;
-  publicacao: RotuloDaLista | null;
+  criado: string;
+  selos: RotuloDaLista[];
 };
 
 /** `estado` é o da fila, só para o carrossel que tem publicação; null nos outros. */
@@ -35,7 +106,61 @@ export function itemDaListaDeCarrosseis(l: LinhaDoCarrossel, estado: EstadoDaPub
     titulo: textoDaLinhaDoCarrossel(l)?.titulo ?? descricaoDoCarrossel(l),
     origem: textoDaOrigem(l),
     detalhe: [arroba ? `@${arroba}` : null, descricaoDoCarrossel(l)].filter((x): x is string => x !== null).join(" · "),
-    geracao: rotuloDoCarrossel(l, agoraMs),
-    publicacao: estado ? rotuloDaPublicacao(estado) : null,
+    criado: fmtDate(l.criado_em),
+    selos: selosDoCarrossel(l, estado, agoraMs),
+  };
+}
+
+export type EntradaDaLista = { linha: LinhaDoCarrossel; estado: EstadoDaPublicacao | null };
+
+/** Compara dois números, com o infinito negativo de "sem hora" no lugar certo (sem `NaN`). */
+const comparar = (x: number, y: number) => (x === y ? 0 : x < y ? -1 : 1);
+
+/**
+ * AS ENTRADAS DE UMA ABA, na ordem dela, e a contagem das três: em "Rascunhos", o mais novo primeiro
+ * (pela criação); em "Agendados", o que está saindo antes de todos, e depois o próximo a sair; em
+ * "Publicados", o mais recente primeiro (pela hora em que saiu), e o sem hora no fim (achado 93).
+ */
+export function separarPorAba<T extends EntradaDaLista>(
+  entradas: T[],
+  aba: AbaDosCarrosseis
+): { contagem: Record<AbaDosCarrosseis, number>; daAba: T[] } {
+  const contagem: Record<AbaDosCarrosseis, number> = { rascunhos: 0, agendados: 0, publicados: 0 };
+  for (const e of entradas) contagem[abaDoCarrossel(e.estado)]++;
+  const criado = (e: T) => e.linha.criado_em.getTime();
+  const quando = (e: T) => (e.estado?.tipo === "agendado" ? e.estado.quando.getTime() : -Infinity);
+  const em = (e: T) => (e.estado?.tipo === "publicado" && e.estado.em ? e.estado.em.getTime() : -Infinity);
+  const daAba = entradas.filter((e) => abaDoCarrossel(e.estado) === aba);
+  const ordem: Record<AbaDosCarrosseis, (a: T, b: T) => number> = {
+    rascunhos: (a, b) => comparar(criado(b), criado(a)),
+    agendados: (a, b) => comparar(quando(a), quando(b)) || comparar(criado(b), criado(a)),
+    publicados: (a, b) => comparar(em(b), em(a)) || comparar(criado(b), criado(a)),
   };
+  return { contagem, daAba: daAba.sort(ordem[aba]) };
+}
+
+/** O que a capa precisa de fora: as contas do cabeçalho, o cookie da conta e o endereço público do bucket. */
+export type ContextoDaCapa = {
+  contas: ContaDoCabecalho[];
+  doCookie: string | undefined;
+  urlPublica: (caminho: string) => string | null;
+};
+
+/**
+ * A CAPA: a miniatura do slide 1, a mesma que a página do carrossel mostra (revisao.tsx e
+ * card-da-parte.tsx): a imagem do "Slide pronto do Canva", se o slide 1 tiver uma e não for "Só texto";
+ * senão a arte do slide 1, pela rota da arte, com a versão que a página calcula. `null` é o quadro vazio:
+ * o carrossel ainda gerando, travado, falhado, ou sem texto.
+ */
+export function capaDoCarrossel(l: LinhaDoCarrossel, agoraMs: number, c: ContextoDaCapa): string | null {
+  if (geracaoNaTela(l.estado, l.criado_em, agoraMs) !== "pronto") return null;
+  const texto = textoDaLinhaDoCarrossel(l);
+  if (!texto) return null;
+  const escolhas = escolhasDaArte(l.arte, l.total_slides);
+  const imagem = escolhas.soTexto.includes(1) ? undefined : imagensDaArte(l.arte, l.total_slides)[1];
+  const pronto = imagem && jeitoDoCaminho(imagem.caminho) === "slide" ? c.urlPublica(imagem.caminho) : null;
+  if (pronto) return pronto;
+  const { conta } = resolverConta(c.contas, escolhas, c.doCookie);
+  const [versao] = versoesDosSlides(slidesDoTexto(texto), escolhas.soTexto, cabecalhoParaVersao(conta), fotosDaArte(l.arte, l.total_slides));
+  return urlDaArte(caminhoDoCarrossel(l), 1, versao);
 }
```

Em `app/carrosseis/page.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/carrosseis/page.tsx b/app/carrosseis/page.tsx
index 5a0849f..2ac9e53 100644
--- a/app/carrosseis/page.tsx
+++ b/app/carrosseis/page.tsx
@@ -24,7 +24,6 @@ import { ehTabelaAusente } from "@/lib/bonus/erros";
 import { publicacaoDaArte } from "@/lib/bonus/publicar-regras";
 import { estadoDoCarrossel } from "@/lib/bonus/publicar-repositorio";
 import type { TipoDoRotulo } from "@/lib/bonus/tela";
-import { fmtDate } from "@/lib/format";
 
 // O MENU "CARROSSÉIS" (spec da Etapa 7): todos os carrosséis, os dos bônus e os avulsos, do mais novo
 // para o mais velho, e o botão "Novo carrossel". Cada linha leva à página do carrossel (a de bônus, ou
@@ -89,12 +88,15 @@ export default async function Carrosseis({ searchParams }: { searchParams: Promi
                     <span className="min-w-0">
                       <span className="block truncate text-sm font-medium">{item.titulo}</span>
                       <span className={`block truncate text-xs ${muted}`}>
-                        {item.origem} · {item.detalhe} · {fmtDate(l.criado_em)}
+                        {item.origem} · {item.detalhe} · {item.criado}
                       </span>
                     </span>
                     <span className="flex shrink-0 items-center gap-2">
-                      {item.publicacao && <span className={SELO[item.publicacao.tipo]}>{item.publicacao.texto}</span>}
-                      <span className={SELO[item.geracao.tipo]}>{item.geracao.texto}</span>
+                      {item.selos.map((s) => (
+                        <span key={s.texto} className={SELO[s.tipo]}>
+                          {s.texto}
+                        </span>
+                      ))}
                     </span>
                   </Link>
                 </li>
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx eslint lib/bonus/carrosseis-tela.ts lib/bonus/apagar-regras.ts lib/bonus/apagar-textos.ts app/carrosseis/page.tsx tests/bonus-carrosseis-tela.test.ts tests/bonus-apagar-regras.test.ts
npx vitest run tests/bonus-carrosseis-tela.test.ts
npx vitest run tests/bonus-apagar-regras.test.ts
```

Esperado: `tsc` e lint limpos; os 46 e os 32 passam.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/carrosseis-tela.ts lib/bonus/apagar-regras.ts lib/bonus/apagar-textos.ts app/carrosseis/page.tsx tests/bonus-carrosseis-tela.test.ts tests/bonus-apagar-regras.test.ts
test "$(git branch --show-current)" = "lista-de-carrosseis"
git add lib/bonus/carrosseis-tela.ts lib/bonus/apagar-regras.ts lib/bonus/apagar-textos.ts app/carrosseis/page.tsx tests/bonus-carrosseis-tela.test.ts tests/bonus-apagar-regras.test.ts
git commit -m "feat(bonus): as regras puras da lista em abas e do apagar"
```

---

### FASE 10.2 — O apagar no servidor, e a reserva da imagem que perde a corrida

**Arquivos:**
- Criar: `lib/bonus/apagar-carrossel.ts`
- Modificar: `lib/bonus/imagem-repositorio.ts` (o 23503 da chave do carrossel vira recusa),
  `lib/bonus/imagem-processo.ts` (a recusa sem a conta do dia)
- Testar: `testes-integracao/bonus-apagar-carrossel.integracao.ts` (novo)

**Interfaces:**
- Consome: `podeApagar`, `caminhosDoCarrossel` e `PodeApagar` (FASE 10.1); `estadoDaPublicacaoNa(tx,
  arte)` e `estadoDoCarrossel(arte)` (`publicar-repositorio.ts`); `apagarSemDerrubar`
  (`publicar-bucket.ts`); `pastaDaConta` (`lib/bucket.ts`); `TRAVADA_IMAGEM_MS` (`imagem-regras.ts`);
  `ehIdDeBonus` (`pedido.ts`).
- Produz: `podeApagarAgora(l: LinhaDoCarrossel, geracao: GeracaoNaTela): Promise<PodeApagar>` (a
  leitura da página, fora de transação); `apagarCarrossel(id: string, apagar = apagarSemDerrubar):
  Promise<PodeApagar>` (a transação; `apagar` entra por parâmetro só para o teste); a variante
  `{ ok: false; motivo: "nao_pronto" }` em `ReservaDaImagem`, sem `hoje`.

- [ ] **Passo 1: o teste**

Crie `testes-integracao/bonus-apagar-carrossel.integracao.ts`:

```ts
// O APAGAR CONTRA O BANCO E UM BUCKET FALSO (spec da Etapa 10, "O apagar no servidor").
//
// A FORMA É A DE `bonus-imagem-processo.integracao.ts`: o bucket é um servidor HTTP nesta máquina, as
// três variáveis do Supabase apontam para ele, e o `beforeAll` recusa rodar se a `SUPABASE_URL` não for
// loopback. **A OpenAI é sempre uma função falsa: nada sai desta máquina.**
//
// O que este arquivo prende: a linha que some e o que fica (as linhas de `imagens_geradas` com o
// carrossel nulo, as da fila); os arquivos que saem do bucket, só depois do commit; as recusas, sem apagar
// nada nem tocar no bucket; e as duas corridas, com o agendar e com a reserva de uma imagem (achado 96),
// forçadas por uma transação do próprio teste que segura a linha.
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { TextoDeCarrossel } from "@/lib/bonus/carrossel-texto";
import { bancoDescartavel } from "./harness";

type ModuloApagar = typeof import("@/lib/bonus/apagar-carrossel");
type ModuloImagemRepo = typeof import("@/lib/bonus/imagem-repositorio");
type ModuloImagem = typeof import("@/lib/bonus/imagem-processo");
type ModuloPublicar = typeof import("@/lib/bonus/publicar-repositorio");
type ModuloCarrossel = typeof import("@/lib/bonus/carrossel-repositorio");
type ContaDoCabecalho = import("@/lib/bonus/arte-conta").ContaDoCabecalho;
type Tx = { query: (texto: string, params?: unknown[]) => Promise<unknown[]> };

const banco = bancoDescartavel();

const CONTA = "17841400000000001";
const CHAVE_DO_BUCKET_FALSO = "chave-de-servico-inventada-para-o-teste";
const BUCKET = "MetodoChatDeTeste";
const AMBIENTE = { OPENAI_API_KEY: "chave-inventada-para-o-teste" };
const CENA = "/marketing uma pessoa usando o celular numa loja de roupas";
const BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

const u = (n: number) => `${String(n).repeat(8)}-1111-4111-8111-111111111111`;
const FOTO = `${CONTA}/bonus-foto/${u(1)}.jpg`;
const PRONTO = `${CONTA}/bonus/${u(2)}.jpg`;
const FILA = `${CONTA}/bonus-fila/${u(3)}.jpg`;
/** O arquivo de outro carrossel, na mesma pasta: fica. */
const ALHEIO = `${CONTA}/bonus-foto/${u(9)}.jpg`;

const slide = (i: number) => ({ titulo: `Título do slide ${i}`, texto: `Texto do slide ${i}, com mais de trinta caracteres.` });
const TEXTO: TextoDeCarrossel = {
  tipo: "carrossel",
  titulo: "Mensagens para reativar clientes",
  gancho: "Seu cliente sumiu? Não é culpa dele.",
  slides: [slide(1), slide(2), slide(3)],
  chamada: "Comente SUMIDO e receba as mensagens prontas.",
  legenda: "Quem sumiu ainda pode voltar. Comente SUMIDO que eu te mando as mensagens prontas para usar hoje mesmo.",
};
const ARTE = { conta: CONTA, nome: "Thiago Vannuchi", arroba: "thiagovannuchi" };
const COM_ARQUIVOS = { ...ARTE, imagens: { "2": { caminho: FOTO, versao: "v" }, "3": { caminho: PRONTO, versao: "v" } } };

// O BUCKET FALSO: os objetos ficam num Map, e cada chamada fica anotada. `falhar` derruba o DELETE.
const bucket = { objetos: new Map<string, Uint8Array>(), chamadas: [] as string[], falhar: false };
let servidor: Server;
let apagar: ModuloApagar;
let imagemRepo: ModuloImagemRepo;
let imagem: ModuloImagem;
let publicar: ModuloPublicar;
let carrosselRepo: ModuloCarrossel;
let contas: ContaDoCabecalho[];

beforeAll(async () => {
  servidor = createServer(async (req, res) => {
    const u = new URL(req.url ?? "/", "http://127.0.0.1");
    for await (const _ of req) void _;
    const responder = (status: number, json: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(json));
    };
    const objeto = `/storage/v1/object/${BUCKET}/`;
    if (req.method === "DELETE" && u.pathname.startsWith(objeto)) {
      if (req.headers["apikey"] !== CHAVE_DO_BUCKET_FALSO) return responder(401, { message: "sem apikey" });
      const caminho = decodeURIComponent(u.pathname.slice(objeto.length));
      bucket.chamadas.push(`apagou ${caminho}`);
      if (bucket.falhar) return responder(500, { message: "o bucket falso caiu" });
      return bucket.objetos.delete(caminho) ? responder(200, {}) : responder(400, { message: "Object not found" });
    }
    responder(404, { message: `o bucket falso nao conhece ${req.method} ${u.pathname}` });
  });
  await new Promise<void>((pronto) => servidor.listen(0, "127.0.0.1", pronto));
  process.env.SUPABASE_URL = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = CHAVE_DO_BUCKET_FALSO;
  process.env.SUPABASE_BUCKET = BUCKET;
  delete process.env.QSTASH_TOKEN;
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(process.env.SUPABASE_URL ?? "")) {
    throw new Error("RECUSADO: a SUPABASE_URL desta rodada nao e loopback. Sem isso, este teste apagaria no bucket de verdade.");
  }
  apagar = await import("@/lib/bonus/apagar-carrossel");
  imagemRepo = await import("@/lib/bonus/imagem-repositorio");
  imagem = await import("@/lib/bonus/imagem-processo");
  publicar = await import("@/lib/bonus/publicar-repositorio");
  carrosselRepo = await import("@/lib/bonus/carrossel-repositorio");
  await banco.db().upsertAccount({
    ig_user_id: CONTA,
    username: "thiagovannuchi",
    name: "thiagovannuchi",
    profile_picture_url: null,
    access_token: "token-que-nao-vale-nada",
    token_expires_at: null,
  });
  contas = await carrosselRepo.contasParaArte();
});

afterAll(async () => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_BUCKET;
  await new Promise<void>((pronto) => servidor.close(() => pronto()));
});

beforeEach(async () => {
  await sql().query(`delete from queue`);
  await sql().query(`delete from imagens_geradas`);
  await sql().query(`delete from carrosseis_gerados`);
  bucket.objetos.clear();
  bucket.chamadas = [];
  bucket.falhar = false;
});

const sql = () => banco.db().sql();

/** O carrossel avulso do texto livre, com a arte dada; pronto, salvo pedido o contrário. */
async function carrossel(p: { arte?: Record<string, unknown>; estado?: "pronto" | "gerando" | "falhou"; criadoHaMs?: number } = {}) {
  const estado = p.estado ?? "pronto";
  const [c] = (await sql().query(
    `insert into carrosseis_gerados (origem, total_slides, palavra, contexto, estado, gerado, erro, arte, criado_em)
     values ('livre', 5, 'SUMIDO', $1::jsonb, $2, $3::jsonb, $4, $5::jsonb, now() - $6::int * interval '1 millisecond') returning id`,
    [
      { tipo: "livre", tema: "Vendas", conteudo: "Mensagens para trazer de volta quem sumiu." },
      estado,
      estado === "pronto" ? TEXTO : null,
      estado === "falhou" ? "A IA não respondeu." : null,
      p.arte ?? ARTE,
      p.criadoHaMs ?? 0,
    ]
  )) as { id: string }[];
  return c.id;
}

/** A publicação guardada na arte, como `reservarPublicacao` e `marcarEnfileirada` a gravam. */
const publicacao = (chave: string, p: { enfileirada?: boolean; reservadaHaMin?: number } = {}) => ({
  chave,
  caminhos: [FILA],
  reservada_em: new Date(Date.now() - (p.reservadaHaMin ?? 0) * 60_000).toISOString(),
  ...(p.enfileirada === false ? {} : { enfileirada_em: new Date().toISOString() }),
});

/** A linha da fila do /publicar, pela chave exata. */
async function fila(chave: string, status: string, adiante = "1 hour") {
  await sql().query(
    `insert into queue (account_id, kind, payload, dedupe_key, status, not_before)
     values ($1, 'publicacao', $2::jsonb, $3, $4, now() + $5::interval)`,
    [CONTA, { forma: "carrossel", caminhos: [FILA] }, chave, status, adiante]
  );
}

/** Uma linha de `imagens_geradas` do carrossel, no estado dado, criada há tantos ms. */
async function imagemGerada(id: string, estado: "gerando" | "pronta", criadoHaMs = 0) {
  await sql().query(
    `insert into imagens_geradas (carrossel_id, numero, descricao, estado, caminho, terminado_em, criado_em)
     values ($1, 2, 'uma cena', $2, $3, $4, now() - $5::int * interval '1 millisecond')`,
    [id, estado, estado === "pronta" ? FOTO : null, estado === "pronta" ? new Date() : null, criadoHaMs]
  );
}

async function existe(id: string): Promise<boolean> {
  return (await sql().query(`select 1 from carrosseis_gerados where id = $1`, [id])).length === 1;
}

const noBucket = (...caminhos: string[]) => caminhos.forEach((c) => bucket.objetos.set(c, BYTES));

/**
 * Uma transação do próprio teste que faz `passo` e segura a linha até o teste mandar soltar. A chamada
 * que corre contra ela fica DENTRO do `try` (achado 74): se ela lançar, o `finally` solta assim mesmo.
 */
async function segurando<T>(passo: (tx: Tx) => Promise<void>, corrida: () => Promise<T>): Promise<T> {
  let soltar!: () => void;
  const segura = new Promise<void>((f) => (soltar = f));
  let travou!: () => void;
  const travado = new Promise<void>((f) => (travou = f));
  const transacao = sql().begin(async (tx) => {
    await passo(tx);
    travou();
    await segura;
  });
  await travado;
  const corridas: Promise<T>[] = [];
  try {
    corridas.push(corrida());
    await new Promise((f) => setTimeout(f, 300));
  } finally {
    soltar();
    await transacao;
  }
  const [r] = await Promise.all(corridas);
  return r;
}

describe("apagar um rascunho", () => {
  it("a linha some; as imagens geradas ficam com o carrossel nulo; a fila fica; os arquivos dele saem do bucket", async () => {
    const id = await carrossel({ arte: { ...COM_ARQUIVOS, publicacao: publicacao("pub:falhou") } });
    await fila("pub:falhou", "failed");
    await imagemGerada(id, "pronta");
    noBucket(FOTO, PRONTO, FILA, ALHEIO);

    expect(await apagar.apagarCarrossel(id)).toEqual({ ok: true });

    expect(await existe(id)).toBe(false);
    expect(await sql().query(`select carrossel_id, caminho from imagens_geradas`)).toEqual([{ carrossel_id: null, caminho: FOTO }]);
    expect(await sql().query(`select dedupe_key, status from queue`)).toEqual([{ dedupe_key: "pub:falhou", status: "failed" }]);
    expect([...bucket.objetos.keys()]).toEqual([ALHEIO]);
    expect([...bucket.chamadas].sort()).toEqual([`apagou ${FILA}`, `apagou ${FOTO}`, `apagou ${PRONTO}`].sort());
  });

  it("o cancelado no calendário e o que não entrou na fila também se apagam", async () => {
    const cancelado = await carrossel({ arte: { ...ARTE, publicacao: publicacao("pub:cancelado") } });
    await fila("pub:cancelado", "skipped");
    const naoEntrou = await carrossel({ arte: { ...ARTE, publicacao: publicacao("pub:sem-linha", { enfileirada: false, reservadaHaMin: 11 }) } });
    expect(await apagar.apagarCarrossel(cancelado)).toEqual({ ok: true });
    expect(await apagar.apagarCarrossel(naoEntrou)).toEqual({ ok: true });
    expect([await existe(cancelado), await existe(naoEntrou)]).toEqual([false, false]);
  });

  it("o que falhou ou travou na geração também se apaga", async () => {
    const falhou = await carrossel({ estado: "falhou" });
    const travou = await carrossel({ estado: "gerando", criadoHaMs: 201_000 });
    expect(await apagar.apagarCarrossel(falhou)).toEqual({ ok: true });
    expect(await apagar.apagarCarrossel(travou)).toEqual({ ok: true });
  });

  it("a imagem travada pelo prazo não segura o apagar", async () => {
    const id = await carrossel();
    await imagemGerada(id, "gerando", 211_000);
    expect(await apagar.apagarCarrossel(id)).toEqual({ ok: true });
  });
});

describe("as recusas, sem apagar nada nem tocar no bucket", () => {
  it.each([
    ["agendado", "pending", "1 hour", "agendado"],
    ["publicando", "sending", "0 seconds", "agendado"],
    ["publicado", "sent", "0 seconds", "publicado"],
  ] as const)("a publicação %s", async (_nome, status, adiante, motivo) => {
    const id = await carrossel({ arte: { ...COM_ARQUIVOS, publicacao: publicacao("pub:k") } });
    await fila("pub:k", status, adiante);
    noBucket(FOTO, PRONTO, FILA);
    expect(await apagar.apagarCarrossel(id)).toEqual({ ok: false, motivo });
    expect(await existe(id)).toBe(true);
    expect(bucket.chamadas).toEqual([]);
  });

  it("a reserva que acabou de ser feita, ainda sem linha na fila (publicando)", async () => {
    const id = await carrossel({ arte: { ...ARTE, publicacao: publicacao("pub:agora", { enfileirada: false }) } });
    expect(await apagar.apagarCarrossel(id)).toEqual({ ok: false, motivo: "agendado" });
    expect(await existe(id)).toBe(true);
  });

  it("a publicação que saiu da fila (enfileirada, e sem linha)", async () => {
    const id = await carrossel({ arte: { ...ARTE, publicacao: publicacao("pub:sumiu") } });
    expect(await apagar.apagarCarrossel(id)).toEqual({ ok: false, motivo: "desconhecido" });
    expect(await existe(id)).toBe(true);
  });

  it("a geração do texto em andamento", async () => {
    const id = await carrossel({ estado: "gerando" });
    expect(await apagar.apagarCarrossel(id)).toEqual({ ok: false, motivo: "geracao" });
    expect(await existe(id)).toBe(true);
  });

  it("uma imagem do carrossel sendo gerada (achado 95)", async () => {
    const id = await carrossel({ arte: COM_ARQUIVOS });
    await imagemGerada(id, "gerando");
    noBucket(FOTO, PRONTO);
    expect(await apagar.apagarCarrossel(id)).toEqual({ ok: false, motivo: "imagem" });
    expect(await existe(id)).toBe(true);
    expect(bucket.chamadas).toEqual([]);
  });

  it("o carrossel que não existe, e o id que não é de carrossel", async () => {
    expect(await apagar.apagarCarrossel(u(7))).toEqual({ ok: false, motivo: "nao_existe" });
    expect(await apagar.apagarCarrossel("nao-e-uuid")).toEqual({ ok: false, motivo: "nao_existe" });
  });
});

describe("o bucket, depois do commit", () => {
  it("quem apaga os arquivos já não acha a linha", async () => {
    const id = await carrossel({ arte: COM_ARQUIVOS });
    const vistos: { caminhos: string[]; linhaAinda: boolean }[] = [];
    const r = await apagar.apagarCarrossel(id, async (caminhos) => {
      vistos.push({ caminhos, linhaAinda: await existe(id) });
    });
    expect(r).toEqual({ ok: true });
    expect(vistos).toEqual([{ caminhos: [FOTO, PRONTO], linhaAinda: false }]);
  });

  it("a recusa não chama quem apaga os arquivos", async () => {
    const id = await carrossel({ estado: "gerando" });
    const vistos: string[][] = [];
    await apagar.apagarCarrossel(id, async (caminhos) => void vistos.push(caminhos));
    expect(vistos).toEqual([]);
  });

  it("a falha do bucket não desfaz o banco: o carrossel já está apagado, e o arquivo fica sem dono", async () => {
    bucket.falhar = true;
    const id = await carrossel({ arte: COM_ARQUIVOS });
    noBucket(FOTO, PRONTO);
    expect(await apagar.apagarCarrossel(id)).toEqual({ ok: true });
    expect(await existe(id)).toBe(false);
    expect([...bucket.objetos.keys()].sort()).toEqual([FOTO, PRONTO].sort());
  });
});

describe("o apagar e o agendar ao mesmo tempo: um espera o outro", () => {
  // O AGENDAR TRAVA A LINHA (`for update`) e grava a reserva antes da fila (reservarPublicacao). Aqui o
  // cruzamento é forçado: a transação do teste é o agendar no meio do caminho. O apagar que trava a linha
  // espera, vê a reserva e recusa; o que lesse sem travar veria a linha sem reserva, e o `delete` dele
  // esperaria só para apagar o carrossel que acabou de ser agendado.
  it("o agendar passa antes: o apagar espera a linha, vê a reserva e recusa", async () => {
    const id = await carrossel();
    const r = await segurando(
      async (tx) => {
        await tx.query(`select id from carrosseis_gerados where id = $1 for update`, [id]);
        await tx.query(
          `update carrosseis_gerados set arte = arte || jsonb_build_object('publicacao',
             $2::jsonb || jsonb_build_object('reservada_em', now())) where id = $1`,
          [id, { chave: "pub:no-meio", caminhos: [FILA] }]
        );
      },
      () => apagar.apagarCarrossel(id)
    );
    expect(r).toEqual({ ok: false, motivo: "agendado" });
    expect(await existe(id)).toBe(true);
  });

  it("o apagar passa antes: o agendar espera a linha e não acha o carrossel", async () => {
    const id = await carrossel();
    const r = await segurando(
      async (tx) => {
        await tx.query(`select id from carrosseis_gerados where id = $1 for update`, [id]);
        await tx.query(`delete from carrosseis_gerados where id = $1`, [id]);
      },
      () => publicar.reservarPublicacao(id, { texto: JSON.stringify(TEXTO), soTexto: [], imagens: {} }, "pub:tarde", [FILA])
    );
    expect(r).toEqual({ ok: false, recusa: { motivo: "nao_pronto" } });
  });
});

describe("o apagar e a reserva de uma imagem ao mesmo tempo (achado 96)", () => {
  // A RESERVA DA IMAGEM TRAVA A LINHA DO CARROSSEL EM `key share`, pela chave estrangeira da 018, e o
  // `for update` do apagar espera por ela (e vice-versa).
  it("a reserva passa antes: o apagar espera, vê a imagem gerando e recusa", async () => {
    const id = await carrossel();
    const r = await segurando(
      async (tx) => {
        await tx.query(`insert into imagens_geradas (carrossel_id, numero, descricao) values ($1, 2, 'uma cena')`, [id]);
      },
      () => apagar.apagarCarrossel(id)
    );
    expect(r).toEqual({ ok: false, motivo: "imagem" });
    expect(await existe(id)).toBe(true);
  });

  it("o apagar passa antes: a reserva bate na chave estrangeira e devolve a recusa, sem linha nova", async () => {
    const id = await carrossel();
    const r = await segurando(
      async (tx) => {
        await tx.query(`select id from carrosseis_gerados where id = $1 for update`, [id]);
        await tx.query(`delete from carrosseis_gerados where id = $1`, [id]);
      },
      () => imagemRepo.reservarImagem({ carrosselId: id, numero: 2, descricao: CENA })
    );
    expect(r).toEqual({ ok: false, motivo: "nao_pronto" });
    expect(await sql().query(`select 1 from imagens_geradas`)).toEqual([]);
  });

  it("pelo pedido de imagem inteiro: a recusa de carrossel que não existe mais, com a frase dela, e não um erro", async () => {
    const id = await carrossel();
    const r = await segurando(
      async (tx) => {
        await tx.query(`select id from carrosseis_gerados where id = $1 for update`, [id]);
        await tx.query(`delete from carrosseis_gerados where id = $1`, [id]);
      },
      () => imagem.pedirImagem({ id, numero: 2, descricao: CENA, contas, ambiente: AMBIENTE })
    );
    expect(r).toEqual({ ok: false, recusa: { motivo: "nao_pronto" } });
    expect(await sql().query(`select 1 from imagens_geradas`)).toEqual([]);
  });

  it("outro erro do insert não vira recusa: sobe (só o 23503 da chave do carrossel é pego)", async () => {
    const id = await carrossel();
    await expect(imagemRepo.reservarImagem({ carrosselId: id, numero: 11, descricao: CENA })).rejects.toMatchObject({
      code: "23514",
      constraint_name: "imagens_geradas_numero_check",
    });
  });
});

describe("a leitura da página", () => {
  it("lê o mesmo que o servidor: a fila agendada e a imagem gerando travam; o rascunho parado pode", async () => {
    const livre = await carrossel();
    const agendado = await carrossel({ arte: { ...ARTE, publicacao: publicacao("pub:k") } });
    await fila("pub:k", "pending");
    const comImagem = await carrossel();
    await imagemGerada(comImagem, "gerando");
    const ler = async (id: string) => apagar.podeApagarAgora((await carrosselRepo.lerCarrossel(id))!, "pronto");
    expect(await ler(livre)).toEqual({ ok: true });
    expect(await ler(agendado)).toEqual({ ok: false, motivo: "agendado" });
    expect(await ler(comImagem)).toEqual({ ok: false, motivo: "imagem" });
  });
});
```

- [ ] **Passo 2: ver falhar**

```bash
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-apagar-carrossel.integracao.ts
```

Esperado: `[rede-global] ALVO: banco de TESTE`; o arquivo cai sem rodar caso nenhum (os 22 ficam pulados),
porque `lib/bonus/apagar-carrossel.ts` não existe.

- [ ] **Passo 3: o código**

Crie `lib/bonus/apagar-carrossel.ts`:

```ts
import "server-only";
import { pastaDaConta } from "@/lib/bucket";
import { sql } from "@/lib/db";
import { caminhosDoCarrossel, podeApagar, type PodeApagar } from "./apagar-regras";
import { escolhasDaArte } from "./arte-escolhas";
import type { LinhaDoCarrossel } from "./carrossel-linha";
import { TRAVADA_IMAGEM_MS } from "./imagem-regras";
import { ehIdDeBonus } from "./pedido";
import { apagarSemDerrubar } from "./publicar-bucket";
import { estadoDaPublicacaoNa, estadoDoCarrossel } from "./publicar-repositorio";
import { geracaoNaTela, type GeracaoNaTela } from "./tempos";

// O APAGAR NO SERVIDOR (spec da Etapa 10, "O apagar no servidor"). A linha é travada (`for update`),
// como no agendar e no salvar: o apagar e um agendar ao mesmo tempo não passam os dois. A reserva de uma
// imagem trava a linha em `key share`, pela chave estrangeira da 018, e espera pelo apagar (e vice-versa).
// testes-integracao/bonus-apagar-carrossel.integracao.ts é quem acusa se alguém tirar a trava.

/** `sql()` ou a transação: os dois têm `query`. */
type Consulta = { query: (texto: string, params?: unknown[]) => Promise<unknown[]> };

/**
 * Alguma imagem do carrossel sendo gerada (Etapa 6), pelo relógio do banco: a linha `gerando` dentro do
 * prazo. A que passou de `TRAVADA_IMAGEM_MS` é travada, e não segura o apagar (achado 95).
 */
async function imagemGerandoNa(consulta: Consulta, id: string): Promise<boolean> {
  const [r] = (await consulta.query(
    `select exists (
       select 1 from imagens_geradas
        where carrossel_id = $1 and estado = 'gerando'
          and criado_em > now() - $2::int * interval '1 millisecond') as gerando`,
    [id, TRAVADA_IMAGEM_MS]
  )) as { gerando: boolean }[];
  return r?.gerando === true;
}

/** O QUE A PÁGINA MOSTRA NO FIM, fora de transação: a mesma regra que o servidor confere ao apagar. */
export async function podeApagarAgora(l: LinhaDoCarrossel, geracao: GeracaoNaTela): Promise<PodeApagar> {
  const [publicacao, imagemGerando] = await Promise.all([estadoDoCarrossel(l.arte), imagemGerandoNa(sql(), l.id)]);
  return podeApagar({ publicacao, geracao, imagemGerando });
}

/**
 * APAGAR UM CARROSSEL, numa transação: trava a linha, lê a publicação e as imagens dela pelo relógio do
 * banco, confere `podeApagar` e apaga (`delete … returning`, exigindo a linha). As linhas de
 * `imagens_geradas` ficam com o carrossel nulo (`on delete set null`, a 018: são o histórico do teto), e
 * as da fila ficam, como histórico.
 *
 * DEPOIS DO COMMIT, os arquivos dele saem do bucket (`caminhosDoCarrossel`). Uma falha ali não desfaz o
 * banco: o carrossel já está apagado, e o arquivo fica sem dono. `apagar` entra por parâmetro só para o
 * teste: em produção é `apagarSemDerrubar`.
 */
export async function apagarCarrossel(id: string, apagar: (caminhos: string[]) => Promise<void> = apagarSemDerrubar): Promise<PodeApagar> {
  if (!ehIdDeBonus(id)) return { ok: false, motivo: "nao_existe" };
  const r = await sql().begin(async (tx) => {
    const [linha] = (await tx.query(`select * from carrosseis_gerados where id = $1 for update`, [id])) as LinhaDoCarrossel[];
    if (!linha) return { ok: false as const, motivo: "nao_existe" as const };
    const [relogio] = (await tx.query(`select now() as agora`)) as { agora: Date }[];
    const pode = podeApagar({
      publicacao: await estadoDaPublicacaoNa(tx, linha.arte),
      geracao: geracaoNaTela(linha.estado, linha.criado_em, relogio.agora.getTime()),
      imagemGerando: await imagemGerandoNa(tx, id),
    });
    if (!pode.ok) return pode;
    const apagadas = await tx.query(`delete from carrosseis_gerados where id = $1 returning id`, [id]);
    if (apagadas.length !== 1) return { ok: false as const, motivo: "nao_existe" as const };
    const { conta } = escolhasDaArte(linha.arte, linha.total_slides);
    return { ok: true as const, caminhos: caminhosDoCarrossel(linha.arte, linha.total_slides, conta ? pastaDaConta(conta) : null) };
  });
  if (!r.ok) return r;
  await apagar(r.caminhos);
  return { ok: true };
}
```

Em `lib/bonus/imagem-repositorio.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/imagem-repositorio.ts b/lib/bonus/imagem-repositorio.ts
index a6719ea..85058b1 100644
--- a/lib/bonus/imagem-repositorio.ts
+++ b/lib/bonus/imagem-repositorio.ts
@@ -24,15 +24,41 @@ export async function imagensNasUltimas24h(): Promise<number> {
   return linha?.n ?? 0;
 }
 
-export type ReservaDaImagem = { ok: true; id: string; hoje: number } | { ok: false; motivo: "teto" | "gerando"; hoje: number };
+export type ReservaDaImagem =
+  | { ok: true; id: string; hoje: number }
+  | { ok: false; motivo: "teto" | "gerando"; hoje: number }
+  | { ok: false; motivo: "nao_pronto" };
+
+/** A chave estrangeira da 018 (`imagens_geradas.carrossel_id`), pelo nome que o Postgres deu a ela. */
+const CHAVE_DO_CARROSSEL = "imagens_geradas_carrossel_id_fkey";
+
+/** O carrossel apagado no meio da reserva (achado 96): o 23503 desta chave, e nenhum outro erro. */
+function carrosselSumiu(erro: unknown): boolean {
+  const e = erro as { code?: unknown; constraint_name?: unknown } | null;
+  return e?.code === "23503" && e.constraint_name === CHAVE_DO_CARROSSEL;
+}
 
 /**
  * RESERVAR UM PEDIDO, NA MESMA TRANSAÇÃO E COM TRAVA: contar, conferir o slide e inserir não correm em
  * paralelo, e dois cliques com 9 no dia não fazem 11. O slide que já tem uma linha `gerando` dentro do
  * prazo recusa o segundo pedido: cada slide gera uma imagem de cada vez. `hoje` é a conta do dia, com
  * este pedido quando ele entra.
+ *
+ * O CARROSSEL APAGADO NO MEIO (spec da Etapa 10, achado 96): o `insert` trava a linha do carrossel em
+ * `key share` e espera o `for update` do apagar; se o apagar passou, a chave estrangeira recusa (23503),
+ * sem linha nova e sem chamar a OpenAI. O erro aborta a transação, por isso o `catch` envolve o `begin`,
+ * e não fica dentro dele. A recusa é a do carrossel que não está pronto (`nao_pronto`), com a frase dela.
  */
 export async function reservarImagem(p: { carrosselId: string; numero: number; descricao: string }): Promise<ReservaDaImagem> {
+  try {
+    return await reservarNaTransacao(p);
+  } catch (erro) {
+    if (carrosselSumiu(erro)) return { ok: false, motivo: "nao_pronto" };
+    throw erro;
+  }
+}
+
+function reservarNaTransacao(p: { carrosselId: string; numero: number; descricao: string }): Promise<ReservaDaImagem> {
   return sql().begin(async (tx) => {
     await tx.query(`select pg_advisory_xact_lock($1::bigint)`, [TRAVA_DO_TETO_DA_IMAGEM]);
     const [contagem] = (await tx.query(CONTAGEM_DO_TETO)) as { n: number }[];
```

Em `lib/bonus/imagem-processo.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/imagem-processo.ts b/lib/bonus/imagem-processo.ts
index 80c66c7..0e16a48 100644
--- a/lib/bonus/imagem-processo.ts
+++ b/lib/bonus/imagem-processo.ts
@@ -46,7 +46,9 @@ export async function pedirImagem(p: {
   if (!descricao.ok) return { ok: false, recusa: { motivo: "descricao", texto: descricao.mensagem } };
   if (!ambiente.OPENAI_API_KEY?.trim()) return { ok: false, recusa: { motivo: "sem_chave" } };
   const r = await reservarImagem({ carrosselId: c.linha.id, numero: p.numero, descricao: p.descricao.trim() });
-  return r.ok ? { ok: true, reservaId: r.id, hoje: r.hoje } : { ok: false, recusa: { motivo: r.motivo }, hoje: r.hoje };
+  if (r.ok) return { ok: true, reservaId: r.id, hoje: r.hoje };
+  // O carrossel apagado no meio (achado 96) não tem a conta do dia: a transação da reserva abortou.
+  return r.motivo === "nao_pronto" ? { ok: false, recusa: { motivo: "nao_pronto" } } : { ok: false, recusa: { motivo: r.motivo }, hoje: r.hoje };
 }
 
 /**
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx eslint lib/bonus/apagar-carrossel.ts lib/bonus/imagem-repositorio.ts lib/bonus/imagem-processo.ts testes-integracao/bonus-apagar-carrossel.integracao.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-apagar-carrossel.integracao.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-imagem-repositorio.integracao.ts testes-integracao/bonus-imagem-processo.integracao.ts
```

Esperado: `tsc` e lint limpos; `[rede-global] ALVO: banco de TESTE`, e os 22 passam. Nas duas da imagem que já existiam,
`[rede-global] ALVO: banco de TESTE`, 2 arquivos e os 35 passam.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/apagar-carrossel.ts lib/bonus/imagem-repositorio.ts lib/bonus/imagem-processo.ts testes-integracao/bonus-apagar-carrossel.integracao.ts
test "$(git branch --show-current)" = "lista-de-carrosseis"
git add lib/bonus/apagar-carrossel.ts lib/bonus/imagem-repositorio.ts lib/bonus/imagem-processo.ts testes-integracao/bonus-apagar-carrossel.integracao.ts
git commit -m "feat(bonus): o apagar do carrossel no servidor, com a linha travada"
```

---

### FASE 10.3 — O "Apagar carrossel" no fim da página

**Arquivos:**
- Criar: `app/bonus/apagar-actions.ts`, `app/bonus/[id]/carrossel/[cid]/apagar.tsx` (de servidor),
  `app/bonus/[id]/carrossel/[cid]/botao-de-apagar.tsx` (de cliente)
- Modificar: `app/bonus/[id]/carrossel/[cid]/page.tsx`, `app/carrosseis/[cid]/page.tsx`
- Testar: `tests/bonus-apagar-paginas.test.ts` (novo), `testes-dom/bonus-apagar-carrossel.dom.tsx` (novo)

**Interfaces:**
- Consome: `apagarCarrossel` e `podeApagarAgora` (FASE 10.2); `apagarNaPagina`, `textoDoApagar`, os
  textos e `AvisoDoApagar` (FASE 10.1); `urlDepoisDeApagar` (FASE 10.1); `TEXTO_PEDIDO_INVALIDO`
  (`publicar-textos.ts`).
- Produz: a action `apagarCarrosselDaPagina(_anterior: AvisoDoApagar | null, form: FormData):
  Promise<AvisoDoApagar>`; o componente `Apagar({ carrossel, geracao })`, desenhado nas duas páginas, no
  fim, fora das seções da geração; o `BotaoDeApagar({ id, frase, acao })`.

- [ ] **Passo 1: os testes**

Crie `tests/bonus-apagar-paginas.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// AS GUARDAS DO APAGAR que nenhum tipo pega (spec da Etapa 10, "A página do carrossel"). O harness da
// integração não forja sessão (de propósito): o apagar se prova pelo servidor, que a integração alcança
// (testes-integracao/bonus-apagar-carrossel.integracao.ts), e por estas leituras do código.

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const ler = (rel: string) => readFileSync(`${RAIZ}/${rel}`, "utf8").replace(/\r\n/g, "\n");
const ACTIONS = "app/bonus/apagar-actions.ts";
const PAGINAS = ["app/bonus/[id]/carrossel/[cid]/page.tsx", "app/carrosseis/[cid]/page.tsx"];

/** As funções exportadas de um arquivo e a primeira instrução de cada uma. */
function primeirasInstrucoes(fonte: string): { nome: string; primeira: string }[] {
  const achados: { nome: string; primeira: string }[] = [];
  const re = /export async function (\w+)\([^)]*\)[^{]*\{\s*([^\n;]+;)/g;
  for (const m of fonte.matchAll(re)) achados.push({ nome: m[1], primeira: m[2].trim() });
  return achados;
}

describe("a action do apagar", () => {
  it("é uma só, e começa por `await exigirSessao();`", () => {
    const achados = primeirasInstrucoes(ler(ACTIONS));
    expect(achados.map((a) => a.nome)).toEqual(["apagarCarrosselDaPagina"]);
    for (const a of achados) expect(a.primeira, a.nome).toBe("await exigirSessao();");
  });

  it("nenhum export escapa do leitor: num arquivo 'use server', todo export é action", () => {
    const fonte = ler(ACTIONS);
    expect(fonte.startsWith('"use server";')).toBe(true);
    expect((fonte.match(/^export /gm) ?? []).length).toBe(primeirasInstrucoes(fonte).length);
  });

  // ACHADO 52: a recusa volta como estado do botão. Sai por redirect só a sessão e o sucesso, este pela
  // lista com o aviso em verde (achado 92).
  it("a recusa volta como estado: os redirects são o da sessão e o do sucesso", () => {
    expect([...ler(ACTIONS).matchAll(/\bredirect\((.*)\);/g)].map((m) => m[1])).toEqual(['"/entrar"', "urlDepoisDeApagar()"]);
  });

  it("o id vem do formulário, e quem apaga é o servidor, com a linha travada", () => {
    const fonte = ler(ACTIONS);
    expect(fonte).toContain('form.get("id")');
    expect(fonte).toContain("await apagarCarrossel(id)");
    expect(fonte).not.toMatch(/delete from|sql\(\)/);
  });
});

describe.each(PAGINAS)("a página %s", (pagina) => {
  // O "Apagar carrossel" vale também no carrossel que falhou ou travou na geração (spec, "A página do
  // carrossel"): ele fica fora das três seções da geração, no fim da página.
  it("desenha o apagar no fim, fora das seções da geração", () => {
    expect(ler(pagina)).toMatch(/\n {6}<Apagar carrossel=\{carrossel\} geracao=\{geracao\} \/>\n {4}<\/div>\n {2}\);\n\}/);
  });
});

describe("o apagar na página", () => {
  it("lê o que pode pelo servidor e entrega a action ao botão", () => {
    const fonte = ler("app/bonus/[id]/carrossel/[cid]/apagar.tsx");
    expect(fonte).toContain("apagarNaPagina(await podeApagarAgora(carrossel, geracao))");
    expect(fonte).toContain("acao={apagarCarrosselDaPagina}");
  });
});
```

Crie `testes-dom/bonus-apagar-carrossel.dom.tsx`:

```tsx
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import BotaoDeApagar from "@/app/bonus/[id]/carrossel/[cid]/botao-de-apagar";
import {
  TEXTO_APAGAR_CARROSSEL,
  TEXTO_CANCELAR_APAGAR,
  TEXTO_CONFIRMAR_APAGAR,
  TEXTO_SIM_APAGAR,
  textoDoApagar,
  type AvisoDoApagar,
} from "@/lib/bonus/apagar-textos";

// O "APAGAR CARROSSEL" NA TELA (spec da Etapa 10, "A página do carrossel"): nada é apagado no primeiro
// clique; o segundo pergunta, com "Sim, apagar" e "Cancelar"; quando não pode, a frase fica no lugar do
// botão; e a recusa do servidor aparece no próprio botão, como estado (achado 52). A action entra por
// propriedade, e aqui é uma falsa: o sucesso, que sai por redirect, não volta para a tela.

const CARROSSEL = "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d";

/**
 * `segurar` prende a resposta da action até o caso soltar. O caso tem de soltar antes de acabar: o React
 * 19 enreda as transições seguintes na action que ainda não respondeu, e os casos de depois esperariam.
 */
function renderizar(p: { frase?: string | null; respostas?: AvisoDoApagar[]; segurar?: Promise<void> } = {}) {
  const recebidos: FormData[] = [];
  const respostas = p.respostas ?? [];
  const acao = async (_anterior: AvisoDoApagar | null, f: FormData) => {
    recebidos.push(f);
    await p.segurar;
    return respostas.shift() ?? null;
  };
  render(<BotaoDeApagar id={CARROSSEL} frase={p.frase ?? null} acao={acao} />);
  return recebidos;
}

const botao = (nome: string) => screen.getByRole("button", { name: nome }) as HTMLButtonElement;
const semBotao = (nome: string) => expect(screen.queryByRole("button", { name: nome })).toBeNull();

async function clicar(nome: string) {
  await act(async () => {
    fireEvent.click(botao(nome));
  });
}

describe("o Apagar carrossel", () => {
  it("o primeiro clique não apaga: pergunta, com Sim, apagar e Cancelar", async () => {
    const recebidos = renderizar();
    await clicar(TEXTO_APAGAR_CARROSSEL);
    expect(screen.getByText(TEXTO_CONFIRMAR_APAGAR)).toBeTruthy();
    expect(botao(TEXTO_SIM_APAGAR)).toBeTruthy();
    expect(botao(TEXTO_CANCELAR_APAGAR)).toBeTruthy();
    semBotao(TEXTO_APAGAR_CARROSSEL);
    expect(recebidos).toEqual([]);
  });

  it("o Cancelar volta ao botão, sem chamar a action", async () => {
    const recebidos = renderizar();
    await clicar(TEXTO_APAGAR_CARROSSEL);
    await clicar(TEXTO_CANCELAR_APAGAR);
    expect(botao(TEXTO_APAGAR_CARROSSEL)).toBeTruthy();
    expect(screen.queryByText(TEXTO_CONFIRMAR_APAGAR)).toBeNull();
    expect(recebidos).toEqual([]);
  });

  it("o Sim, apagar manda o id do carrossel, uma vez", async () => {
    const recebidos = renderizar();
    await clicar(TEXTO_APAGAR_CARROSSEL);
    await clicar(TEXTO_SIM_APAGAR);
    expect(recebidos.map((f) => Object.fromEntries(f.entries()))).toEqual([{ id: CARROSSEL }]);
  });

  it("enquanto o servidor apaga, o botão fica desligado e diz Apagando…", async () => {
    let soltar!: () => void;
    renderizar({ segurar: new Promise<void>((f) => (soltar = f)) });
    await clicar(TEXTO_APAGAR_CARROSSEL);
    await clicar(TEXTO_SIM_APAGAR);
    expect(botao("Apagando…").disabled).toBe(true);
    semBotao(TEXTO_SIM_APAGAR);
    await act(async () => soltar());
  });

  it("a recusa do servidor aparece no lugar, e o botão volta (achado 52)", async () => {
    const texto = textoDoApagar("agendado");
    renderizar({ respostas: [{ tom: "erro", texto, em: 1 }] });
    await clicar(TEXTO_APAGAR_CARROSSEL);
    await clicar(TEXTO_SIM_APAGAR);
    expect(screen.getByRole("status").textContent).toBe(texto);
    expect(botao(TEXTO_APAGAR_CARROSSEL).disabled).toBe(false);
  });

  it("quando não pode, a frase fica no lugar do botão", () => {
    renderizar({ frase: textoDoApagar("imagem") });
    expect(screen.getByText("Espere a imagem terminar para apagar.")).toBeTruthy();
    semBotao(TEXTO_APAGAR_CARROSSEL);
  });
});
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-apagar-paginas.test.ts
npx vitest run --config vitest.dom.config.ts testes-dom/bonus-apagar-carrossel.dom.tsx
```

Esperado: nos puros, os 7 caem: a action, o componente da página e o apagar nas duas páginas não existem. Na
tela, o arquivo cai sem rodar caso nenhum, porque `botao-de-apagar.tsx` não existe.

- [ ] **Passo 3: o código**

Crie `app/bonus/apagar-actions.ts`:

```ts
"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isValidSession, SESSION_COOKIE } from "@/lib/auth";
import { apagarCarrossel } from "@/lib/bonus/apagar-carrossel";
import { textoDoApagar, type AvisoDoApagar } from "@/lib/bonus/apagar-textos";
import { urlDepoisDeApagar } from "@/lib/bonus/carrosseis-tela";
import { ehIdDeBonus } from "@/lib/bonus/pedido";
import { TEXTO_PEDIDO_INVALIDO } from "@/lib/bonus/publicar-textos";

// A ACTION DO APAGAR (spec da Etapa 10, "A página do carrossel").
//
// TODA ACTION COMEÇA CONFERINDO A SESSÃO, e não confia só no proxy.ts: Server Action tem endereço
// próprio. tests/bonus-apagar-paginas.test.ts confere que a primeira instrução é `await exigirSessao();`.
//
// A RECUSA VOLTA COMO ESTADO DO BOTÃO (useActionState), e nunca por redirect (achado 52): o carrossel
// agendado em outra aba, por exemplo. Sai por redirect só o sucesso, para a lista na aba "Rascunhos", com
// o aviso em verde (`urlDepoisDeApagar`, achado 92). Do formulário vem só o id: a regra e a trava são as
// do servidor (lib/bonus/apagar-carrossel.ts).

async function exigirSessao(): Promise<void> {
  const jarra = await cookies();
  if (!isValidSession(jarra.get(SESSION_COOKIE)?.value)) redirect("/entrar");
}

/** APAGAR O CARROSSEL DA PÁGINA, depois da confirmação do botão. */
export async function apagarCarrosselDaPagina(_anterior: AvisoDoApagar | null, form: FormData): Promise<AvisoDoApagar> {
  await exigirSessao();
  const id = form.get("id");
  const em = Date.now();
  if (!ehIdDeBonus(id)) return { tom: "erro", texto: TEXTO_PEDIDO_INVALIDO, em };
  const r = await apagarCarrossel(id);
  if (!r.ok) return { tom: "erro", texto: textoDoApagar(r.motivo), em };
  redirect(urlDepoisDeApagar());
}
```

Crie `app/bonus/[id]/carrossel/[cid]/botao-de-apagar.tsx`:

```tsx
"use client";
import { useActionState, useState, useTransition } from "react";
import { alertError, btnDanger, btnSecondary, card, muted } from "@/app/ui";
import {
  TEXTO_APAGAR_CARROSSEL,
  TEXTO_CANCELAR_APAGAR,
  TEXTO_CONFIRMAR_APAGAR,
  TEXTO_SIM_APAGAR,
  type AvisoDoApagar,
} from "@/lib/bonus/apagar-textos";

// O "APAGAR CARROSSEL", NO FIM DA PÁGINA DO CARROSSEL (spec da Etapa 10). Nada é apagado no primeiro
// clique: ele dá lugar à pergunta, com "Sim, apagar" e "Cancelar". Quando não pode, quem desenha manda a
// frase, e ela fica no lugar do botão.
//
// A RECUSA DO SERVIDOR VOLTA COMO ESTADO (useActionState), e nunca por redirect (achado 52); o sucesso sai
// por redirect, para a lista. Sem `<form action>`, como o "Novo carrossel" (formulario-do-avulso.tsx): o
// pedido sai pela transição. A action entra por propriedade, para o teste de tela usar uma falsa.
export default function BotaoDeApagar({
  id,
  frase,
  acao,
}: {
  id: string;
  /** A frase no lugar do botão, quando o carrossel não pode ser apagado; null quando pode. */
  frase: string | null;
  acao: (anterior: AvisoDoApagar | null, form: FormData) => Promise<AvisoDoApagar | null>;
}) {
  // `pendente` desliga o botão enquanto o servidor apaga: um clique duplo não manda dois pedidos.
  const [resposta, enviar, pendente] = useActionState(acao, null);
  const [, iniciar] = useTransition();
  const [confirmando, setConfirmando] = useState(false);

  function apagar() {
    const dados = new FormData();
    dados.set("id", id);
    setConfirmando(false);
    iniciar(() => enviar(dados));
  }

  return (
    <section className={`${card} space-y-3 p-6`}>
      {frase !== null ? (
        <p className={`text-sm ${muted}`}>{frase}</p>
      ) : confirmando ? (
        <div className="space-y-3">
          <p className="text-sm font-medium">{TEXTO_CONFIRMAR_APAGAR}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnDanger} onClick={apagar}>
              {TEXTO_SIM_APAGAR}
            </button>
            <button type="button" className={btnSecondary} onClick={() => setConfirmando(false)}>
              {TEXTO_CANCELAR_APAGAR}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className={btnSecondary} disabled={pendente} onClick={() => setConfirmando(true)}>
          {pendente ? "Apagando…" : TEXTO_APAGAR_CARROSSEL}
        </button>
      )}
      {resposta && !pendente && (
        <div key={resposta.em} role="status" className={alertError}>
          {resposta.texto}
        </div>
      )}
    </section>
  );
}
```

Crie `app/bonus/[id]/carrossel/[cid]/apagar.tsx`:

```tsx
import { apagarCarrosselDaPagina } from "@/app/bonus/apagar-actions";
import { podeApagarAgora } from "@/lib/bonus/apagar-carrossel";
import { apagarNaPagina } from "@/lib/bonus/apagar-textos";
import type { LinhaDoCarrossel } from "@/lib/bonus/carrossel-linha";
import type { GeracaoNaTela } from "@/lib/bonus/tempos";
import BotaoDeApagar from "./botao-de-apagar";

// O FIM DA PÁGINA DO CARROSSEL (spec da Etapa 10), nas duas páginas e em todo estado da geração: o
// "Apagar carrossel", a frase de por que não pode, ou nada (o publicado fica como histórico). Quem decide
// é a regra do servidor (`podeApagarAgora`), a mesma que a action confere com a linha travada.
export default async function Apagar({ carrossel, geracao }: { carrossel: LinhaDoCarrossel; geracao: GeracaoNaTela }) {
  const tela = apagarNaPagina(await podeApagarAgora(carrossel, geracao));
  if (tela.tipo === "nada") return null;
  return <BotaoDeApagar id={carrossel.id} frase={tela.tipo === "frase" ? tela.texto : null} acao={apagarCarrosselDaPagina} />;
}
```

Em `app/bonus/[id]/carrossel/[cid]/page.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/[id]/carrossel/[cid]/page.tsx b/app/bonus/[id]/carrossel/[cid]/page.tsx
index 257cd78..63a425b 100644
--- a/app/bonus/[id]/carrossel/[cid]/page.tsx
+++ b/app/bonus/[id]/carrossel/[cid]/page.tsx
@@ -19,6 +19,7 @@ import { lerLinha } from "@/lib/bonus/repositorio";
 import { geracaoNaTela } from "@/lib/bonus/tempos";
 import { TEXTO_TRAVOU, type TomDoQuadro } from "@/lib/bonus/textos";
 import Acompanhar from "../../acompanhar";
+import Apagar from "./apagar";
 import Revisao from "./revisao";
 
 // O teto de lib/bonus/tempos.ts (MAX_DURATION_S). O Next exige literal aqui, e
@@ -109,6 +110,8 @@ export default async function PaginaDoCarrossel({
       )}
 
       {geracao === "pronto" && <Revisao carrossel={carrossel} />}
+
+      <Apagar carrossel={carrossel} geracao={geracao} />
     </div>
   );
 }
```

Em `app/carrosseis/[cid]/page.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/carrosseis/[cid]/page.tsx b/app/carrosseis/[cid]/page.tsx
index 1db52e9..67fef94 100644
--- a/app/carrosseis/[cid]/page.tsx
+++ b/app/carrosseis/[cid]/page.tsx
@@ -2,6 +2,7 @@ import Link from "next/link";
 import { notFound } from "next/navigation";
 import { alertError, alertOk, alertWarn, btnPrimary, card, hint, link, pageSubtitle, pageTitle, skeleton } from "@/app/ui";
 import Acompanhar from "@/app/bonus/[id]/acompanhar";
+import Apagar from "@/app/bonus/[id]/carrossel/[cid]/apagar";
 import Revisao from "@/app/bonus/[id]/carrossel/[cid]/revisao";
 import { avisoDaUrl } from "@/lib/avisos";
 import { textoDaOrigem } from "@/lib/bonus/avulso-textos";
@@ -117,6 +118,8 @@ export default async function PaginaDoAvulso({
       )}
 
       {geracao === "pronto" && <Revisao carrossel={carrossel} />}
+
+      <Apagar carrossel={carrossel} geracao={geracao} />
     </div>
   );
 }
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx eslint app/bonus/apagar-actions.ts "app/bonus/[id]/carrossel/[cid]/apagar.tsx" "app/bonus/[id]/carrossel/[cid]/botao-de-apagar.tsx" "app/bonus/[id]/carrossel/[cid]/page.tsx" "app/carrosseis/[cid]/page.tsx" tests/bonus-apagar-paginas.test.ts testes-dom/bonus-apagar-carrossel.dom.tsx
npx vitest run tests/bonus-apagar-paginas.test.ts tests/bonus-carrossel-paginas.test.ts tests/bonus-avulso-paginas.test.ts
npx vitest run --config vitest.dom.config.ts testes-dom/bonus-apagar-carrossel.dom.tsx
```

Esperado: `tsc` e lint limpos; os 45 dos três arquivos de páginas passam (os 7 novos entre eles), e os 6 de tela passam.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" app/bonus/apagar-actions.ts "app/bonus/[id]/carrossel/[cid]/apagar.tsx" "app/bonus/[id]/carrossel/[cid]/botao-de-apagar.tsx" "app/bonus/[id]/carrossel/[cid]/page.tsx" "app/carrosseis/[cid]/page.tsx" tests/bonus-apagar-paginas.test.ts testes-dom/bonus-apagar-carrossel.dom.tsx
test "$(git branch --show-current)" = "lista-de-carrosseis"
git add app/bonus/apagar-actions.ts "app/bonus/[id]/carrossel/[cid]/apagar.tsx" "app/bonus/[id]/carrossel/[cid]/botao-de-apagar.tsx" "app/bonus/[id]/carrossel/[cid]/page.tsx" "app/carrosseis/[cid]/page.tsx" tests/bonus-apagar-paginas.test.ts testes-dom/bonus-apagar-carrossel.dom.tsx
git commit -m "feat(bonus): o Apagar carrossel no fim da página, com confirmação"
```

---

### FASE 10.4 — A lista em abas, com a capa

**Arquivos:**
- Criar: `app/carrosseis/lista.tsx` (sem estado, desenhável no teste de tela)
- Modificar: `app/carrosseis/page.tsx` (a aba do endereço, as contas, a separação e a capa)
- Testar: `testes-dom/bonus-lista-de-carrosseis.dom.tsx` (novo), `tests/bonus-avulso-paginas.test.ts`
  (a guarda da lista ganha um caso)

**Interfaces:**
- Consome: `ABAS`, `urlDaAba`, `abaDoEndereco`, `separarPorAba`, `itemDaListaDeCarrosseis`,
  `capaDoCarrossel`, `ItemDaListaDeCarrosseis` e `AbaDosCarrosseis` (FASE 10.1); `contasParaArte`
  (`carrossel-repositorio.ts`); `urlPublicaSeDerParaMontar` (`lib/bucket.ts`); `ACCOUNT_COOKIE`
  (`lib/account.ts`).
- Produz: `ListaDeCarrosseis({ aba, contagem, linhas })` e `type LinhaDaLista = { item; capa: string | null }`.

- [ ] **Passo 1: os testes**

Crie `testes-dom/bonus-lista-de-carrosseis.dom.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ListaDeCarrosseis, { type LinhaDaLista } from "@/app/carrosseis/lista";
import { ABAS, type AbaDosCarrosseis } from "@/lib/bonus/carrosseis-tela";

// A LISTA "CARROSSÉIS" NA TELA (spec da Etapa 10, "A lista"): as três abas com a contagem, a aberta
// marcada, a capa à esquerda de cada linha (ou o quadro vazio), o selo da aba à direita, e a frase da aba
// vazia. O que cada linha diz é decidido fora do JSX (carrosseis-tela.ts); aqui, só o desenho.

const CAPA = "/carrosseis/1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d/arte?slide=1&v=0a1b2c3d";
const LINHAS: LinhaDaLista[] = [
  {
    item: {
      id: "c1",
      href: "/carrosseis/c1",
      titulo: "Conselheiro brutalmente honesto",
      origem: "Texto livre: Produtividade",
      detalhe: "@thiagovannuchi · Carrossel de 5 slides",
      criado: "07/10/2026, 09:00",
      selos: [{ texto: "Não publicou", tipo: "erro" }],
    },
    capa: CAPA,
  },
  {
    item: {
      id: "c2",
      href: "/bonus/b1/carrossel/c2",
      titulo: "Carrossel de 10 slides",
      origem: "Bônus do Chat",
      detalhe: "Carrossel de 10 slides",
      criado: "08/10/2026, 14:30",
      selos: [{ texto: "Gerando", tipo: "neutro" }],
    },
    capa: null,
  },
];
const CONTAGEM = { rascunhos: 2, agendados: 1, publicados: 0 };

const renderizar = (aba: AbaDosCarrosseis = "rascunhos", linhas = LINHAS) =>
  render(<ListaDeCarrosseis aba={aba} contagem={CONTAGEM} linhas={linhas} />);
const aba = (nome: string) => screen.getByRole("link", { name: nome });
const linha = (titulo: string) => screen.getByText(titulo).closest("a") as HTMLAnchorElement;

describe("as abas", () => {
  it("as três, com a contagem e o endereço de cada uma", () => {
    renderizar();
    expect(aba("Rascunhos (2)").getAttribute("href")).toBe("/carrosseis?aba=rascunhos");
    expect(aba("Agendados (1)").getAttribute("href")).toBe("/carrosseis?aba=agendados");
    expect(aba("Publicados (0)").getAttribute("href")).toBe("/carrosseis?aba=publicados");
  });

  it.each(["rascunhos", "agendados", "publicados"] as const)("a aberta (%s) fica marcada, e só ela", (aberta) => {
    renderizar(aberta, []);
    const marcadas = screen.getAllByRole("link").filter((l) => l.getAttribute("aria-current") === "page");
    expect(marcadas.map((l) => l.getAttribute("href"))).toEqual([`/carrosseis?aba=${aberta}`]);
  });
});

describe("as linhas", () => {
  it("cada linha leva à página do carrossel, com o título, a origem, a conta, os slides e a data", () => {
    renderizar();
    expect(linha("Conselheiro brutalmente honesto").getAttribute("href")).toBe("/carrosseis/c1");
    expect(linha("Carrossel de 10 slides").getAttribute("href")).toBe("/bonus/b1/carrossel/c2");
    expect(screen.getByText("Texto livre: Produtividade · @thiagovannuchi · Carrossel de 5 slides · 07/10/2026, 09:00")).toBeTruthy();
  });

  it("a capa à esquerda: a miniatura do slide 1, 4:5, carregada só quando aparece", () => {
    renderizar();
    const img = linha("Conselheiro brutalmente honesto").querySelector("img") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe(CAPA);
    expect(img.getAttribute("loading")).toBe("lazy");
    expect([img.getAttribute("width"), img.getAttribute("height")]).toEqual(["48", "60"]);
  });

  it("sem capa (gerando, travado ou falhado): o quadro vazio no lugar", () => {
    renderizar();
    const sem = linha("Carrossel de 10 slides");
    expect(sem.querySelector("img")).toBeNull();
    expect(sem.querySelector('[data-capa="vazia"]')).not.toBeNull();
  });

  it("o selo da aba à direita, com a cor do tipo", () => {
    renderizar();
    expect(within(linha("Conselheiro brutalmente honesto")).getByText("Não publicou").className).toMatch(/red/);
    expect(within(linha("Carrossel de 10 slides")).getByText("Gerando")).toBeTruthy();
  });
});

describe("a aba vazia", () => {
  it.each(ABAS.map((a) => [a.aba, a.vazia] as const))("%s diz: %s", (aberta, frase) => {
    renderizar(aberta, []);
    expect(screen.getByText(frase)).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
  });
});
```

Em `tests/bonus-avulso-paginas.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-avulso-paginas.test.ts b/tests/bonus-avulso-paginas.test.ts
index 220ee7f..8c9f8f0 100644
--- a/tests/bonus-avulso-paginas.test.ts
+++ b/tests/bonus-avulso-paginas.test.ts
@@ -123,6 +123,18 @@ describe("o menu Carrosséis", () => {
     expect(lista).toContain('href="/carrosseis/novo"');
   });
 
+  // AS ABAS E A CAPA (spec da Etapa 10): a aba vem do endereço, a separação e a ordem são da regra pura, e
+  // a capa é calculada com as contas lidas uma vez e o endereço público do bucket, como a página do
+  // carrossel calcula a miniatura.
+  it("a lista abre a aba do endereço, separa pela regra e calcula a capa como a página do carrossel", () => {
+    const lista = ler("app/carrosseis/page.tsx");
+    expect(lista).toContain("abaDoEndereco(sp.aba)");
+    expect(lista).toContain("separarPorAba(");
+    expect(lista).toContain("await contasParaArte()");
+    expect(lista).toContain("urlPublica: urlPublicaSeDerParaMontar");
+    expect(lista).toContain("capaDoCarrossel(");
+  });
+
   it("a página do carrossel entrega o aviso do funil, decidido pelo estado da fila", () => {
     expect(ler("app/bonus/[id]/carrossel/[cid]/revisao.tsx")).toContain("avisoDoFunil: textoDoFunil(estado, carrossel.palavra)");
   });
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run --config vitest.dom.config.ts testes-dom/bonus-lista-de-carrosseis.dom.tsx
npx vitest run tests/bonus-avulso-paginas.test.ts
```

Esperado: na tela, o arquivo cai sem rodar caso nenhum, porque `app/carrosseis/lista.tsx` não existe; na
guarda, 1 cai e 25 passam (26): a página ainda não lê a aba nem calcula a capa.

- [ ] **Passo 3: o código**

Crie `app/carrosseis/lista.tsx`:

```tsx
import Link from "next/link";
import { badgeErr, badgeNeutral, badgeOk, badgeWarn, card, emptyWrap, muted, rowDivide, rowHover } from "@/app/ui";
import { ABAS, urlDaAba, type AbaDosCarrosseis, type ItemDaListaDeCarrosseis } from "@/lib/bonus/carrosseis-tela";
import type { TipoDoRotulo } from "@/lib/bonus/tela";

// A LISTA "CARROSSÉIS", O DESENHO (spec da Etapa 10, "A lista"): as três abas, com a contagem e a aberta
// marcada; a capa à esquerda de cada linha, ou o quadro vazio; e o selo da aba à direita. Sem estado e
// sem efeito: a página (de servidor) lê e decide, e este componente só desenha, com teste de tela.
//
// AS ABAS SÃO `<Link>`, como a barra do calendário do /publicar: a aba vive no endereço, então o voltar do
// navegador e um link levam à mesma aba.

const SELO: Record<TipoDoRotulo, string> = { neutro: badgeNeutral, ok: badgeOk, atencao: badgeWarn, erro: badgeErr };

/** Uma linha: o que ela diz, e a capa (null: o quadro vazio). */
export type LinhaDaLista = { item: ItemDaListaDeCarrosseis; capa: string | null };

export default function ListaDeCarrosseis({
  aba,
  contagem,
  linhas,
}: {
  aba: AbaDosCarrosseis;
  contagem: Record<AbaDosCarrosseis, number>;
  linhas: LinhaDaLista[];
}) {
  const vazia = ABAS.find((a) => a.aba === aba)?.vazia;
  return (
    <section className={card}>
      <nav aria-label="Abas dos carrosséis" className="border-b border-traco px-4 py-3 dark:border-traco-escuro">
        <div className="inline-flex flex-wrap gap-0.5 rounded-xl border border-traco p-0.5 dark:border-traco-escuro">
          {ABAS.map((a) => (
            <Link
              key={a.aba}
              href={urlDaAba(a.aba)}
              aria-current={aba === a.aba ? "page" : undefined}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                aba === a.aba
                  ? "bg-acao text-papel dark:bg-acao-escuro dark:text-papel-escuro"
                  : "text-quieto hover:text-tinta dark:text-quieto-escuro dark:hover:text-tinta-escuro"
              }`}
            >
              {a.rotulo} ({contagem[a.aba]})
            </Link>
          ))}
        </div>
      </nav>

      {linhas.length === 0 ? (
        <div className={emptyWrap}>
          <p className={muted}>{vazia}</p>
        </div>
      ) : (
        <ul className={rowDivide}>
          {linhas.map(({ item, capa }) => (
            <li key={item.id}>
              <Link href={item.href} className={`flex items-center justify-between gap-3 px-4 py-3 ${rowHover}`}>
                <span className="flex min-w-0 items-center gap-3">
                  {capa ? (
                    /* eslint-disable-next-line @next/next/no-img-element -- a arte está atrás de sessão, e o
                       otimizador de imagem do Next buscaria a URL sem o cookie: a capa voltaria 401. */
                    <img
                      src={capa}
                      alt=""
                      width={48}
                      height={60}
                      loading="lazy"
                      className="aspect-[4/5] w-12 shrink-0 rounded-lg border border-traco object-cover dark:border-traco-escuro"
                    />
                  ) : (
                    <span
                      data-capa="vazia"
                      aria-hidden="true"
                      className="block aspect-[4/5] w-12 shrink-0 rounded-lg border border-dashed border-traco dark:border-traco-escuro"
                    />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{item.titulo}</span>
                    <span className={`block truncate text-xs ${muted}`}>
                      {item.origem} · {item.detalhe} · {item.criado}
                    </span>
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {item.selos.map((s) => (
                    <span key={s.texto} className={SELO[s.tipo]}>
                      {s.texto}
                    </span>
                  ))}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

Em `app/carrosseis/page.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/carrosseis/page.tsx b/app/carrosseis/page.tsx
index 2ac9e53..5380dd4 100644
--- a/app/carrosseis/page.tsx
+++ b/app/carrosseis/page.tsx
@@ -1,44 +1,39 @@
 import Link from "next/link";
-import {
-  alertError,
-  alertOk,
-  badgeErr,
-  badgeNeutral,
-  badgeOk,
-  badgeWarn,
-  btnPrimary,
-  card,
-  emptyWrap,
-  muted,
-  pageSubtitle,
-  pageTitle,
-  rowDivide,
-  rowHover,
-} from "@/app/ui";
+import { cookies } from "next/headers";
+import { alertError, alertOk, btnPrimary, pageSubtitle, pageTitle } from "@/app/ui";
+import { ACCOUNT_COOKIE } from "@/lib/account";
 import { avisoDaUrl } from "@/lib/avisos";
-import { itemDaListaDeCarrosseis } from "@/lib/bonus/carrosseis-tela";
+import { urlPublicaSeDerParaMontar } from "@/lib/bucket";
+import { abaDoEndereco, capaDoCarrossel, itemDaListaDeCarrosseis, separarPorAba } from "@/lib/bonus/carrosseis-tela";
 import type { LinhaDoCarrossel } from "@/lib/bonus/carrossel-linha";
-import { listarCarrosseis } from "@/lib/bonus/carrossel-repositorio";
+import { contasParaArte, listarCarrosseis } from "@/lib/bonus/carrossel-repositorio";
 import { TEXTO_TABELA_CARROSSEL_AUSENTE } from "@/lib/bonus/carrossel-textos";
 import { ehTabelaAusente } from "@/lib/bonus/erros";
 import { publicacaoDaArte } from "@/lib/bonus/publicar-regras";
 import { estadoDoCarrossel } from "@/lib/bonus/publicar-repositorio";
-import type { TipoDoRotulo } from "@/lib/bonus/tela";
+import ListaDeCarrosseis from "./lista";
 
-// O MENU "CARROSSÉIS" (spec da Etapa 7): todos os carrosséis, os dos bônus e os avulsos, do mais novo
-// para o mais velho, e o botão "Novo carrossel". Cada linha leva à página do carrossel (a de bônus, ou
-// a do avulso), e o que ela mostra é decidido fora do JSX (carrosseis-tela.ts).
+// O MENU "CARROSSÉIS" (spec da Etapa 7): todos os carrosséis, os dos bônus e os avulsos, e o botão "Novo
+// carrossel". Cada linha leva à página do carrossel (a de bônus, ou a do avulso), e o que ela mostra é
+// decidido fora do JSX (carrosseis-tela.ts).
+//
+// AS ABAS (spec da Etapa 10): "Rascunhos", "Agendados" e "Publicados", pelo estado da publicação de hoje,
+// com a aba no endereço (`?aba=`). A CAPA de cada linha é a miniatura do slide 1, calculada como a página
+// do carrossel calcula: as contas do cabeçalho são lidas uma vez, com o cookie da conta.
 //
 // O ESTADO DA PUBLICAÇÃO é lido da fila só para o carrossel que tem publicação guardada: os outros
 // não pagam a consulta.
 
 export const dynamic = "force-dynamic";
 
-const SELO: Record<TipoDoRotulo, string> = { neutro: badgeNeutral, ok: badgeOk, atencao: badgeWarn, erro: badgeErr };
-
-export default async function Carrosseis({ searchParams }: { searchParams: Promise<{ aviso?: string; tom?: string }> }) {
+export default async function Carrosseis({
+  searchParams,
+}: {
+  searchParams: Promise<{ aviso?: string; tom?: string; aba?: string | string[] }>;
+}) {
   const sp = await searchParams;
   const aviso = avisoDaUrl(sp.aviso, sp.tom);
+  const aba = abaDoEndereco(sp.aba);
 
   let linhas: LinhaDoCarrossel[];
   try {
@@ -53,11 +48,18 @@ export default async function Carrosseis({ searchParams }: { searchParams: Promi
     );
   }
   const estados = await Promise.all(linhas.map((l) => (publicacaoDaArte(l.arte) === null ? null : estadoDoCarrossel(l.arte))));
+  const contas = await contasParaArte();
+  const doCookie = (await cookies()).get(ACCOUNT_COOKIE)?.value;
   // Server Component `async` e `force-dynamic`: roda UMA vez por requisição, e ler o
   // relógio aqui é o comportamento pedido. A regra trata todo arquivo como cliente;
   // o dono silencia do mesmo jeito, com o motivo por extenso, em app/page.tsx:322-333.
   // eslint-disable-next-line react-hooks/purity
   const agora = Date.now();
+  const { contagem, daAba } = separarPorAba(
+    linhas.map((linha, i) => ({ linha, estado: estados[i] })),
+    aba
+  );
+  const contexto = { contas, doCookie, urlPublica: urlPublicaSeDerParaMontar };
 
   return (
     <div className="space-y-6">
@@ -73,38 +75,14 @@ export default async function Carrosseis({ searchParams }: { searchParams: Promi
 
       {aviso && <div className={aviso.tom === "ok" ? alertOk : alertError}>{aviso.texto}</div>}
 
-      <section className={card}>
-        {linhas.length === 0 ? (
-          <div className={emptyWrap}>
-            <p className={muted}>Nenhum carrossel ainda.</p>
-          </div>
-        ) : (
-          <ul className={rowDivide}>
-            {linhas.map((l, i) => {
-              const item = itemDaListaDeCarrosseis(l, estados[i], agora);
-              return (
-                <li key={item.id}>
-                  <Link href={item.href} className={`flex items-center justify-between gap-3 px-4 py-3 ${rowHover}`}>
-                    <span className="min-w-0">
-                      <span className="block truncate text-sm font-medium">{item.titulo}</span>
-                      <span className={`block truncate text-xs ${muted}`}>
-                        {item.origem} · {item.detalhe} · {item.criado}
-                      </span>
-                    </span>
-                    <span className="flex shrink-0 items-center gap-2">
-                      {item.selos.map((s) => (
-                        <span key={s.texto} className={SELO[s.tipo]}>
-                          {s.texto}
-                        </span>
-                      ))}
-                    </span>
-                  </Link>
-                </li>
-              );
-            })}
-          </ul>
-        )}
-      </section>
+      <ListaDeCarrosseis
+        aba={aba}
+        contagem={contagem}
+        linhas={daAba.map(({ linha, estado }) => ({
+          item: itemDaListaDeCarrosseis(linha, estado, agora),
+          capa: capaDoCarrossel(linha, agora, contexto),
+        }))}
+      />
     </div>
   );
 }
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npm run lint
npx vitest run --config vitest.dom.config.ts testes-dom/bonus-lista-de-carrosseis.dom.tsx
npx vitest run tests/bonus-avulso-paginas.test.ts tests/escala.test.ts
npm test
npm run test:dom
```

Esperado: `tsc` e lint limpos; os 11 de tela passam; os 26 da guarda e os 14 da escala passam (40). As suítes inteiras com 118 arquivos e 3 291 casos puros e
25 arquivos e 220 de tela.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" app/carrosseis/lista.tsx app/carrosseis/page.tsx testes-dom/bonus-lista-de-carrosseis.dom.tsx tests/bonus-avulso-paginas.test.ts
test "$(git branch --show-current)" = "lista-de-carrosseis"
git add app/carrosseis/lista.tsx app/carrosseis/page.tsx testes-dom/bonus-lista-de-carrosseis.dom.tsx tests/bonus-avulso-paginas.test.ts
git commit -m "feat(bonus): a lista de carrosséis em abas, com a capa de cada um"
```

---

### FASE 10.5 — O verify, a integração inteira, as mutações e a guarda do diff

- [ ] **Passo 1: o verify, na árvore do projeto**

```bash
env -u CLAUDECODE -u AI_AGENT npm run verify
git diff --stat AGENTS.md
```

Esperado: lint e `tsc` limpos; 118 arquivos e 3 291 casos puros e 25 arquivos e 220 de tela; a varredura "SEM
VAZAMENTO em A nem em C"; o build (Turbopack) com "MIGRAÇÃO PULADA" e as rotas `ƒ /carrosseis`,
`ƒ /carrosseis/[cid]` e `ƒ /bonus/[id]/carrossel/[cid]`; o `AGENTS.md` sem diferença.

- [ ] **Passo 2: a integração inteira, no container**

```bash
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npm run test:integracao
```

Esperado: `[rede-global] ALVO: banco de TESTE`; 46 arquivos, 515 passaram e 8 pularam (na base, 45 arquivos, 493 passaram e 8 pularam).

- [ ] **Passo 3: as provas de mutação**

Copie o script do Apêndice A para `$SCRATCH/mutar-lista.mjs` e rode, da raiz:

```bash
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" node "$SCRATCH/mutar-lista.mjs"
git status --short
```

Esperado: as 28 com ✓, "28 mutações, 0 ruins", e a árvore limpa depois (cada arquivo volta byte a
byte).

- [ ] **Passo 4: a guarda do diff**

```bash
git diff --stat af714d3 -- app/publicar app/api app/automacoes lib/bucket.ts lib/db.ts lib/queue-drain.ts lib/engine.ts lib/publicacao.ts lib/dedupe.ts lib/esquema.ts scripts migrations lib/bonus/publicar-estado.ts lib/bonus/publicar-regras.ts lib/bonus/publicar-repositorio.ts lib/bonus/publicar-processo.ts lib/bonus/publicar-bucket.ts lib/bonus/publicar-textos.ts package.json package-lock.json next.config.ts proxy.ts
git diff --stat af714d3 -- . ':!app/bonus' ':!app/carrosseis' ':!lib/bonus' ':!tests' ':!testes-dom' ':!testes-integracao' ':!docs'
```

Esperado: as duas saídas vazias.

- [ ] **Passo 5: avisar o auditor**, com o hash, os números e o pedido de conferir a branch antes do
  push. O push da branch e o PR só com o OK do Eduardo.

---

### FASE 10.6 — A prova real, no preview, com o Eduardo

Cada escrita em produção tem o OK do Eduardo, pela caixa, e a auditoria lê o banco antes e depois
(avisada com a hora). O preview usa o banco e o bucket de produção. **Sem custo e sem post real. Sem
migração.** Os textos sugeridos para digitar passam antes pelo schema de cada campo (o mínimo e o
máximo).

- [ ] **Passo 1: a linha de base da auditoria**, só de leitura (os carrosséis que existem, a fila, as
  linhas de `imagens_geradas` e o registro das migrações, com 19).

- [ ] **Passo 2: o push da branch e o preview, com o OK do Eduardo**

Empurre só a branch (`git push origin refs/heads/lista-de-carrosseis:refs/heads/lista-de-carrosseis`).
No log do build do preview, confira o commit e "MIGRAÇÃO PULADA".

- [ ] **Passo 3: a prova, com o Eduardo na tela** (os passos da spec, "A prova real")

1. A lista: as três abas com os carrosséis de hoje, a capa em cada linha e os selos novos, contra a
   medição da auditoria (os carrosséis de hoje em "Rascunhos").
2. "Novo carrossel" → texto livre → "Escrever à mão", com 1 slide (grava). Ele aparece em "Rascunhos",
   com a capa e o selo "Pronto para revisar" (item 1 do ensaio).
3. Agendar esse carrossel para daqui a 7 dias (grava; achado 94): a lista mostra "Agendados (1)", com o
   selo "Agendado para…", e a página dele mostra "Para apagar, cancele o agendamento no calendário
   antes." no lugar do botão.
4. Cancelar no calendário do `/publicar` (grava): ele volta a "Rascunhos", com o selo "Pronto para
   revisar", e o botão volta.
5. "Apagar carrossel" → "Cancelar" (nada muda) → "Apagar carrossel" → "Sim, apagar" (grava): a lista em
   "Rascunhos", com "Carrossel apagado." em verde, sem ele. A auditoria confere a linha apagada, as
   linhas da fila que ficam e o bucket.

"Publicados" não tem dado real para a prova (nenhum carrossel foi publicado, e a prova não publica):
fica coberto pelos testes, e o PR diz isso.

No fim, o que a prova deixou no banco (a linha da fila do agendamento cancelado, que o apagar mantém
como histórico) sai ou fica conforme o Eduardo decidir pela caixa; se sair, é por um script lido pela
auditoria antes de rodar (achado 77). Depois: o corpo do PR, conferido pelo auditor, e o PR com o OK do
Eduardo. O merge é do Vinícius, e o build do merge diz "Nada a aplicar: as 19 migrações".

---

## Apêndice A — as provas de mutação

Cada mutação tira uma proteção e roda o teste que a cobre; o caso nomeado tem de cair. O arquivo
volta byte a byte depois de cada uma. Sem `DATABASE_URL_TESTES`, o script recusa antes de mutar.

```js
// Provas de mutação da Etapa 10 (a lista de carrosséis e o apagar). Cada mutação tira uma proteção e roda o
// teste que a cobre; o caso nomeado tem de cair. Cada arquivo volta byte a byte.
// Uso, da raiz do repositório: DATABASE_URL_TESTES=<container> node mutar-lista.mjs [filtro]
// As mutações INTEG rodam a suíte de integração, que sem DATABASE_URL_TESTES cai na DATABASE_URL, a da
// PRODUÇÃO (achado 68): sem a variável, o script recusa antes de mutar, e uma rodada INTEG que não imprime
// "ALVO: banco de TESTE" conta como ✗. Nenhuma mutação apaga nada fora do container e do bucket falso.
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const PURA = (f) => `npx vitest run ${f}`;
const TELA = (f) => `npx vitest run --config vitest.dom.config.ts ${f}`;
const INTEG = (f) => `npx vitest run --config vitest.integracao.config.ts ${f}`;

const LISTA = "lib/bonus/carrosseis-tela.ts";
const REGRAS = "lib/bonus/apagar-regras.ts";
const APAGAR = "lib/bonus/apagar-carrossel.ts";
const REPO = "lib/bonus/imagem-repositorio.ts";
const ACAO = "app/bonus/apagar-actions.ts";
const BOTAO = "app/bonus/[id]/carrossel/[cid]/botao-de-apagar.tsx";
const PAGINA_BONUS = "app/bonus/[id]/carrossel/[cid]/page.tsx";
const LISTA_TELA = "app/carrosseis/lista.tsx";
const PAGINA_LISTA = "app/carrosseis/page.tsx";

const T_LISTA = PURA("tests/bonus-carrosseis-tela.test.ts");
const T_REGRAS = PURA("tests/bonus-apagar-regras.test.ts");
const T_APAGAR = INTEG("testes-integracao/bonus-apagar-carrossel.integracao.ts");
const T_PAGINAS = PURA("tests/bonus-apagar-paginas.test.ts");
const T_BOTAO = TELA("testes-dom/bonus-apagar-carrossel.dom.tsx");
const T_LISTA_TELA = TELA("testes-dom/bonus-lista-de-carrosseis.dom.tsx");
const T_GUARDA_LISTA = PURA("tests/bonus-avulso-paginas.test.ts");

const MUTACOES = [
  // 10.1 as regras puras
  { nome: "10.1: o publicando cai em Rascunhos", arq: LISTA,
    de: '  if (estado?.tipo === "agendado" || estado?.tipo === "publicando") return "agendados";',
    para: '  if (estado?.tipo === "agendado") return "agendados";',
    cmd: T_LISTA, caso: "a aba de cada carrossel > publicando" },
  { nome: "10.1: o Revisado volta", arq: LISTA,
    de: '  const revisado = geracaoNaTela(l.estado, l.criado_em, agoraMs) === "pronto" && l.revisado_em !== null;',
    para: "  const revisado = false;",
    cmd: T_LISTA, caso: "em Rascunhos, o Revisado sai" },
  { nome: "10.1: o publicado sem hora vai para o topo (achado 93)", arq: LISTA,
    de: '  const em = (e: T) => (e.estado?.tipo === "publicado" && e.estado.em ? e.estado.em.getTime() : -Infinity);',
    para: '  const em = (e: T) => (e.estado?.tipo === "publicado" && e.estado.em ? e.estado.em.getTime() : Infinity);',
    cmd: T_LISTA, caso: "o sem hora no fim (achado 93)" },
  { nome: "10.1: a URL sem tom=ok (achado 92)", arq: LISTA,
    de: "encodeURIComponent(TEXTO_CARROSSEL_APAGADO)}&tom=ok`;", para: "encodeURIComponent(TEXTO_CARROSSEL_APAGADO)}`;",
    cmd: T_LISTA, caso: "vai para Rascunhos, com o aviso em verde" },
  { nome: "10.1: a capa ignora o Só texto", arq: LISTA,
    de: "  const imagem = escolhas.soTexto.includes(1) ? undefined : imagensDaArte(l.arte, l.total_slides)[1];",
    para: "  const imagem = imagensDaArte(l.arte, l.total_slides)[1];",
    cmd: T_LISTA, caso: "o slide pronto num slide 1 marcado Só texto não conta" },
  { nome: "10.1: o agendado pode ser apagado", arq: REGRAS,
    de: "  if (!publicacaoLivre(p.publicacao)) {", para: '  if (p.publicacao.tipo === "publicado") {',
    cmd: T_REGRAS, caso: "a publicação agendado não pode" },
  { nome: "10.1: a imagem gerando não segura (achado 95)", arq: REGRAS,
    de: '  if (p.imagemGerando) return { ok: false, motivo: "imagem" };\n', para: "",
    cmd: T_REGRAS, caso: "uma imagem do carrossel sendo gerada não pode" },
  { nome: "10.1: a cópia da fila de outra pasta vai junto", arq: REGRAS,
    de: '.caminhos.filter((c) => ehCaminhoDoDestino(c, pasta, "fila"))', para: ".caminhos",
    cmd: T_REGRAS, caso: "só os da pasta da conta do carrossel" },
  // 10.2 o apagar no servidor
  { nome: "10.2: sem o for update (o agendar)", arq: APAGAR,
    de: "`select * from carrosseis_gerados where id = $1 for update`", para: "`select * from carrosseis_gerados where id = $1`",
    cmd: T_APAGAR, caso: "o agendar passa antes" },
  { nome: "10.2: sem o for update (a reserva da imagem)", arq: APAGAR,
    de: "`select * from carrosseis_gerados where id = $1 for update`", para: "`select * from carrosseis_gerados where id = $1`",
    cmd: T_APAGAR, caso: "a reserva passa antes" },
  { nome: "10.2: o servidor não confere a imagem gerando (achado 95)", arq: APAGAR,
    de: "      imagemGerando: await imagemGerandoNa(tx, id),", para: "      imagemGerando: false,",
    cmd: T_APAGAR, caso: "uma imagem do carrossel sendo gerada (achado 95)" },
  { nome: "10.2: o servidor não confere a geração do texto", arq: APAGAR,
    de: "      geracao: geracaoNaTela(linha.estado, linha.criado_em, relogio.agora.getTime()),", para: '      geracao: "pronto",',
    cmd: T_APAGAR, caso: "a geração do texto em andamento" },
  { nome: "10.2: o bucket antes do commit", arq: APAGAR,
    de: "    return { ok: true as const, caminhos: caminhosDoCarrossel(linha.arte, linha.total_slides, conta ? pastaDaConta(conta) : null) };",
    para: "    await apagar(caminhosDoCarrossel(linha.arte, linha.total_slides, conta ? pastaDaConta(conta) : null));\n    return { ok: true as const, caminhos: [] };",
    cmd: T_APAGAR, caso: "quem apaga os arquivos já não acha a linha" },
  { nome: "10.2: o 23503 sem tratar (achado 96)", arq: REPO,
    de: '    if (carrosselSumiu(erro)) return { ok: false, motivo: "nao_pronto" };\n', para: "",
    cmd: T_APAGAR, caso: "a reserva bate na chave estrangeira e devolve a recusa" },
  { nome: "10.2: a restrição trocada (achado 96)", arq: REPO,
    de: 'const CHAVE_DO_CARROSSEL = "imagens_geradas_carrossel_id_fkey";', para: 'const CHAVE_DO_CARROSSEL = "imagens_geradas_outra_fkey";',
    cmd: T_APAGAR, caso: "a reserva bate na chave estrangeira e devolve a recusa" },
  { nome: "10.2: todo erro do insert vira recusa", arq: REPO,
    de: '  return e?.code === "23503" && e.constraint_name === CHAVE_DO_CARROSSEL;', para: "  return e !== null;",
    cmd: T_APAGAR, caso: "outro erro do insert não vira recusa" },
  // 10.3 a action e o botão
  { nome: "10.3: a action sem conferir a sessão", arq: ACAO,
    de: '  await exigirSessao();\n  const id = form.get("id");', para: '  const id = form.get("id");',
    cmd: T_PAGINAS, caso: "é uma só, e começa por `await exigirSessao();`" },
  { nome: "10.3: a recusa por redirect (achado 52)", arq: ACAO,
    de: '  if (!r.ok) return { tom: "erro", texto: textoDoApagar(r.motivo), em };', para: "  if (!r.ok) redirect(urlDepoisDeApagar());",
    cmd: T_PAGINAS, caso: "a recusa volta como estado" },
  { nome: "10.3: apaga no primeiro clique", arq: BOTAO,
    de: "onClick={() => setConfirmando(true)}", para: "onClick={apagar}",
    cmd: T_BOTAO, caso: "o primeiro clique não apaga" },
  { nome: "10.3: o Cancelar apaga", arq: BOTAO,
    de: "onClick={() => setConfirmando(false)}", para: "onClick={apagar}",
    cmd: T_BOTAO, caso: "o Cancelar volta ao botão" },
  { nome: "10.3: o botão ligado enquanto apaga", arq: BOTAO,
    de: " disabled={pendente} onClick", para: " onClick",
    cmd: T_BOTAO, caso: "enquanto o servidor apaga, o botão fica desligado" },
  { nome: "10.3: a frase não aparece no lugar do botão", arq: BOTAO,
    de: "      {frase !== null ? (", para: "      {false ? (",
    cmd: T_BOTAO, caso: "quando não pode, a frase fica no lugar do botão" },
  { nome: "10.3: o que falhou na geração fica sem o botão", arq: PAGINA_BONUS,
    de: '      {geracao === "pronto" && <Revisao carrossel={carrossel} />}\n\n      <Apagar carrossel={carrossel} geracao={geracao} />',
    para: '      {geracao === "pronto" && <Revisao carrossel={carrossel} />}\n      {geracao === "pronto" && <Apagar carrossel={carrossel} geracao={geracao} />}',
    cmd: T_PAGINAS, caso: "desenha o apagar no fim, fora das seções da geração" },
  // 10.4 a lista com as abas e a capa
  { nome: "10.4: a aba aberta sem a marca", arq: LISTA_TELA,
    de: 'aria-current={aba === a.aba ? "page" : undefined}', para: "aria-current={undefined}",
    cmd: T_LISTA_TELA, caso: "fica marcada, e só ela" },
  { nome: "10.4: as abas sem a contagem", arq: LISTA_TELA,
    de: "{a.rotulo} ({contagem[a.aba]})", para: "{a.rotulo}",
    cmd: T_LISTA_TELA, caso: "as três, com a contagem e o endereço de cada uma" },
  { nome: "10.4: a capa carregada de uma vez", arq: LISTA_TELA,
    de: '                      loading="lazy"\n', para: "",
    cmd: T_LISTA_TELA, caso: "a capa à esquerda" },
  { nome: "10.4: a aba vazia sem a frase", arq: LISTA_TELA,
    de: "          <p className={muted}>{vazia}</p>", para: "          <p className={muted} />",
    cmd: T_LISTA_TELA, caso: "diz:" },
  { nome: "10.4: a página ignora a aba do endereço", arq: PAGINA_LISTA,
    de: "  const aba = abaDoEndereco(sp.aba);", para: '  const aba = abaDoEndereco("rascunhos");',
    cmd: T_GUARDA_LISTA, caso: "a lista abre a aba do endereço" },
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
