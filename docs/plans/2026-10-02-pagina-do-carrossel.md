# Gerador de bônus — Plano de implementação da Etapa 4: a página do carrossel, slide a slide

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: `superpowers:subagent-driven-development`
> (recomendada) ou `superpowers:executing-plans`, fase por fase. Os passos usam caixa de
> seleção (`- [ ]`) para acompanhar.

**Objetivo:** na página do carrossel pronto, cada slide vira um card com a miniatura e o editor
daquele slide ao lado, e um "Salvar slide N" que grava só ele e troca só a miniatura dele. Na mesma
etapa: o carrossel passa a ser da conta em que nasceu (o seletor sai), o aviso "não cabe" para de
errar no limite (achados 70 e 71, com o mesmo conserto no Labs) e a foto da conta fica em memória.

**Arquitetura:** a foto da conta passa a uma memória por instância e por URL (`arte-foto.ts`). O
"não cabe" passa a repetir o Satori: uma composição única do slide (`arte-composicao.ts`), que o
desenho desenha e a conta mede, e a conta exata (`arte-medida.ts`) sobre uma tabela de larguras
gerada dos `.ttf` (`arte-larguras.ts`). Um arquivo de vetores combinado com o Labs, gerado
desenhando no Satori, prova a conta contra o desenho nos dois projetos. Na tela, uma função decide
os campos de cada slide (`camposDaParte`); cada card tem o seu formulário e a sua action
(`salvarSlideDoCarrossel`, numa transação com a linha travada), e a miniatura tem versão por slide. A
conta do carrossel é a gravada ao nascer, com o nome e o @ guardados; o "Gerar de novo" a herda.

**Stack:** a das etapas anteriores, no Next.js 16.3.8: App Router, Server Actions com
`useActionState`, `next/og` (Satori 0.25.0 e Resvg, no og 0.11.1), React 19, Postgres (postgres.js
via `lib/db.ts`), `zod` 4, Vitest (três suítes), Tailwind v4 com os tokens de `app/ui.ts`.

**Spec:** `docs/specs/2026-10-02-pagina-do-carrossel.md` (commits `d6ed86c`, `fb71497`, `4f004f2`,
`d647e51` e `0d05223`). Leia antes de começar: este plano não repete o porquê das regras, só como
construí-las.

**Ensaio do plano (02/10):** o código deste plano foi escrito e testado fase a fase numa cópia
isolada do repositório (`git worktree`, branch local `ensaio-pagina-2`, sem push, saída de
`d647e51`), e todo bloco de código abaixo foi tirado do git dessa cópia por um gerador, sem cópia à
mão. Os números do ensaio, na ordem deste plano:
- lint e `tsc` limpos em cada fase; no fim, 95 arquivos e 2 774 casos puros, 18 arquivos e 117 casos
  de tela, e a varredura do dono sem vazamento;
- `next build --webpack` limpo, com `ƒ /bonus/[id]/carrossel/[cid]` e `ƒ /bonus/[id]/carrossel/[cid]/arte`
  na lista. O `next build` do `verify` (Turbopack) não roda na cópia de ensaio: ele recusa o
  `node_modules` ligado por junção ("points out of the filesystem root"). Na árvore do projeto o
  `node_modules` é de verdade, e o auditor roda o Turbopack numa cópia com `npm ci`;
- integração no container: 37 arquivos, 315 passaram e 8 pularam (na base, 308 e 8);
- cada fase foi vista falhar antes do código e passar depois, na ordem deste plano, com os números
  de cada uma no passo dela;
- as 42 provas de mutação do Apêndice A derrubaram, cada uma, o caso esperado. Duas não derrubavam
  na primeira rodada, e os testes delas foram reforçados (a linha de exatamente 860px e o espaço do
  fim da palavra);
- os 138 vetores: nos 132 exatos, a conta dá o mesmo degrau, o mesmo "cabe" e a mesma altura do
  desenho, ao pixel; nos 6 conservadores, ela erra só para o lado seguro. O Labs conferiu o arquivo
  (o sha256, o ASCII, os 138, e os 4 casos dele batem com a conta independente de lá);
- o plano, aplicado do zero sobre `d647e51` numa cópia limpa, com os dois gerados rodando de
  verdade, dá os 51 arquivos iguais ao fim do ensaio, byte a byte (15 criados, 48 diffs, 4 apagados
  e 2 gerados).

O ensaio achou estas coisas, já resolvidas neste plano:
1. **O quebrador do Satori não é "só no espaço".** Medido com a classe que ele usa (a do pacote
   `linebreak`, dentro do og), em todos os pares de 230 caracteres em volta de um espaço: o espaço
   não quebra em quatro casos (antes de `! ) , . / : ; ? ] }`, depois de `( [ { ¡ ¿ „ ‚`, entre aspa
   e um desses, e entre dois travessões), e o Satori também quebra DENTRO da palavra (hífen entre
   letras, travessão e emoji colados, URL). A conta só quebra no espaço, com os quatro casos, e erra
   só para o lado seguro onde há quebra dentro da palavra. Os vetores marcam isso, decidido pelo
   próprio quebrador.
2. **O texto que a conta media não era o que o desenho desenhava** em casos de borda: `\r\n\r\n` não
   separava parágrafo, a linha só de espaços virava uma linha de 0px, a manchete só de espaços
   ganhava margem no desenho e não na conta, e o NFD dava um glifo a mais. A normalização (a)–(e),
   combinada com o Labs, mora na composição e roda uma vez.
3. **A palavra mais larga que a linha não quebra por letra:** a arte não pede `wordBreak`, e o
   Satori a deixa vazar. O degrau em que isso acontece não cabe.
4. **A ferramenta de escrita troca o escape de barra-u pelo caractere de verdade.** Os blocos deste
   plano foram varridos depois de gerados; o arquivo dos vetores é todo em ASCII, e os casos com
   espaço sem quebra, quebra de parágrafo e acento combinante são escritos pelo código
   (`String.fromCodePoint`).
5. **A ordem do ensaio mudou para seguir a spec:** a margem e a foto vêm primeiro (decisão do
   Eduardo no fechamento da Etapa 3), antes da página. O código é o mesmo; a árvore final do ensaio
   na ordem nova é idêntica à da ordem antiga.
6. **`lerRevisaoDoCarrossel` fica sem uso em produção** depois da FASE 4.8, que tira o "Salvar
   revisão". Os testes dela cobrem a conferência dos campos que `juntarParte` usa, e ela fica: tirar
   é mudança fora do necessário. Um comentário na função diz isso (FASE 4.8).

A revisão do plano pelo auditor (02/10) trouxe o achado 73 (ANOTAR), resolvido aqui: o plano dizia 44
provas de mutação, e o Apêndice A tem 42; e o tamanho do arquivo dos vetores era o da versão de antes
da tolerância declarada (62 933 bytes), e o desta é 63 295. Os rótulos das mutações passaram à
numeração das fases deste plano, e `lerRevisaoDoCarrossel` ganhou o comentário do porquê.

## Restrições globais

Valem para todas as fases, sem precisar repetir em cada uma.

- **Branch:** `pagina-do-carrossel`, saída da `main` em `898e7df` (o PR #6 mergeado). Nunca
  commitar nem empurrar na `main`: ela não tem proteção e um push dispara deploy de produção.
  Conferir `git branch --show-current` antes de cada commit, e `git ls-remote origin
  refs/heads/main` no começo de cada fase.
- **`git add` com caminho explícito.** Nunca `-A` nem `.`: mais de uma sessão usa esta árvore.
- **Conventional Commits, em português.** Sem `Co-Authored-By` e sem rodapé de IA. Autor:
  Eduardo Kobal <162614913+Eduardokobal@users.noreply.github.com>.
- **Antes de cada commit**, varrer os arquivos de TEXTO tocados com
  `node "$SCRATCH/varrer-texto.mjs" <arquivos>`, em que `$SCRATCH` é o scratchpad da sessão. Se o
  scratchpad não existir mais, recrie o script a partir do apêndice A do plano da Etapa 1
  (`docs/plans/2026-09-29-gerador-de-bonus.md`).
- **Escape de barra-u:** a ferramenta de escrita grava o caractere no lugar do escape. Depois de
  aplicar um bloco que tenha `\u` dentro de string, a varredura acusa; troque pelo escape de novo.
- **Fim de linha:** com `core.autocrlf=true`, a cópia de trabalho dos arquivos que já existem está
  em CRLF. Os diffs deste plano estão em LF: aplique com `git apply --ignore-whitespace` ou à mão,
  e varra depois. Se a varredura acusar fim de linha misturado, converta a cópia inteira para LF.
- **Pasta própria:** `app/bonus/` e `lib/bonus/`. Fora delas, só testes novos e `docs/`. Os arquivos
  das etapas anteriores que mudam estão no Mapa dos arquivos, com a fase.
- **Sufixo de teste é o que decide se ele roda:** `tests/**/*.test.ts` (puro, entra no `verify`),
  `testes-integracao/**/*.integracao.ts` (banco, fora do `verify`), `testes-dom/**/*.dom.tsx`
  (tela, entra no `verify`). Os ajudantes de teste sem sufixo (`tests/arte-desenhada.tsx`,
  `tests/arte-vetores-entradas.ts`, `tests/vetores-da-arte.ts`) não rodam sozinhos.
- **A suíte de integração só roda com `DATABASE_URL_TESTES`** apontando para o container
  (`127.0.0.1:5434`, `npm run banco:teste`). Toda rodada tem de imprimir
  `[rede-global] ALVO: banco de TESTE`. Se imprimir outra coisa, pare. Nunca rode com a variável
  vazia: ela cai na `DATABASE_URL`, que é **produção**.
- **`next dev` sem as variáveis de agente.** Rode com `env -u CLAUDECODE -u AI_AGENT ...` e confira
  `git diff AGENTS.md` depois: ele não muda.
- **Telas:** só os tokens de `app/ui.ts` e os degraus de `app/escala.ts`; nada de `indigo`,
  `violet` nem `purple`.
- **Segredo** nunca vai para código, log, mensagem, commit ou saída de terminal.
- **Escrita em produção só com o OK do Eduardo.** A etapa não tem migração. O preview usa o banco de
  produção: lá, salvar um slide, gravar o "só texto" e o "Fixar nesta conta" gravam em produção.
- **A instrução do carrossel não muda antes do texto do Labs** (FASE 4.9).
- **Ao fechar cada fase**, avisar o auditor (sessão `metodochat-b7` em 02/10; conferir o nome no
  `ListAgents`, porque ele muda a cada reinício) com o hash e o que conferir. Não esperar a
  resposta para seguir. Ao fechar a FASE 4.4, mandar também ao Labs (`site-ia-83` em 02/10) o hash
  e o sha256 do arquivo dos vetores.

## Mapa dos arquivos

| arquivo | responsabilidade | fase |
|---|---|---|
| `lib/bonus/arte-foto.ts`, `.../arte/route.tsx` | a foto em memória, e a rota que a usa | 4.1 |
| `lib/bonus/arte-larguras-do-ttf.ts`, `lib/bonus/fonte/gerar-larguras.ts`, `lib/bonus/arte-larguras.ts` | ler as larguras do `.ttf`, o gerador, e a tabela gerada | 4.2 |
| `lib/bonus/arte-geometria.ts` | todo número que ocupa lugar na peça, e o espaço acima de cada linha | 4.3 |
| `lib/bonus/arte-composicao.ts` | as linhas do slide, normalizadas, para o desenho e a conta | 4.3 |
| `lib/bonus/arte-medida.ts` | a conta exata do "não cabe" | 4.3 |
| `lib/bonus/arte-slides.ts`, `arte-desenho.tsx`, `arte-resposta.tsx`, `arte-cabimento.ts` | a fonte do slide pela conta nova, o gancho com 46, o desenho da composição | 4.3 |
| `tests/vetores-da-arte.json` e os ajudantes `tests/arte-desenhada.tsx`, `tests/arte-vetores-entradas.ts`, `tests/vetores-da-arte.ts` | os vetores com o Labs, e o desenho medido no pixel | 4.4 |
| `lib/bonus/carrossel-texto.ts`, `lib/bonus/arte-tela.ts`, `arte-cabimento.ts` | as partes do carrossel; a versão de cada miniatura | 4.5 |
| `lib/bonus/arte-conta.ts`, `arte-escolhas.ts`, `arte-textos.ts`, `carrossel-repositorio.ts`, `app/bonus/carrossel-actions.ts`, `.../arte/route.tsx`, `.../page.tsx` | a conta do carrossel: guardada ao nascer, herdada, fixada | 4.6 |
| `lib/bonus/carrossel-repositorio.ts`, `carrossel-textos.ts`, `arte-tela.ts`, `app/bonus/carrossel-actions.ts` | salvar um slide | 4.7 |
| `.../card-da-parte.tsx` (novo), `.../editor-do-carrossel.tsx`, `.../page.tsx`; saem `.../arte-do-carrossel.tsx` e `.../formulario-da-revisao.tsx` | a página slide a slide | 4.8 |
| `lib/bonus/instrucao-carrossel.ts` | até 5 linhas de corpo, com o texto do Labs | 4.9 |

`...` é `app/bonus/[id]/carrossel/[cid]`.

---

## ETAPA 4 — a página do carrossel, slide a slide

### FASE 4.0 — Começar da main certa

- [ ] **Passo 1: conferir a main e a branch**

```bash
git ls-remote origin refs/heads/main
git switch pagina-do-carrossel
git log --oneline -7
node -e 'console.log(require("./node_modules/next/package.json").version)'
```

Esperado: a `main` em `898e7df` (ou depois dele); a branch com os cinco commits da spec e este
plano sobre `898e7df`; o `node_modules` na 16.3.8. Se a `main` andou, rebaseie a branch nela antes
de seguir (`git fetch origin main && git rebase origin/main`), e rode `npm ci` se o lock mudou.

- [ ] **Passo 2: a linha de base**

```bash
npm test
npm run test:dom
npm run banco:teste
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npm run test:integracao
```

Esperado: 89 arquivos / 2 401 casos puros; 19 / 116 de tela; `[rede-global] ALVO: banco de TESTE`, 37 arquivos, 308 passaram e 8 pularam.

---

### FASE 4.1 — A foto da conta em memória

**Arquivos:**
- Modificar: `lib/bonus/arte-foto.ts`, `app/bonus/[id]/carrossel/[cid]/arte/route.tsx`
- Testar: `tests/bonus-arte-foto.test.ts`, `tests/bonus-arte-paginas.test.ts`

**Interfaces:**
- Produz: `FOTO_GUARDADA_MS = 10 * 60_000`, `FALHA_GUARDADA_MS = 30_000`,
  `type MemoriaDasFotos = { foto(url: string | null): Promise<string | null>; quantas(): number }`,
  `memoriaDasFotos(buscar = fotoDaConta, agora = Date.now): MemoriaDasFotos` e
  `fotosDaInstancia`, a memória da instância. A rota chama `fotosDaInstancia.foto(url)`.

- [ ] **Passo 1: os testes**

Em `tests/bonus-arte-foto.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-arte-foto.test.ts b/tests/bonus-arte-foto.test.ts
index b5197de..50446ee 100644
--- a/tests/bonus-arte-foto.test.ts
+++ b/tests/bonus-arte-foto.test.ts
@@ -1,5 +1,13 @@
 import { describe, expect, it, vi } from "vitest";
-import { FOTO_MAX_BYTES, FOTO_TEMPO_MS, fotoDaConta, urlDeFotoAceita } from "@/lib/bonus/arte-foto";
+import {
+  FALHA_GUARDADA_MS,
+  FOTO_GUARDADA_MS,
+  FOTO_MAX_BYTES,
+  FOTO_TEMPO_MS,
+  fotoDaConta,
+  memoriaDasFotos,
+  urlDeFotoAceita,
+} from "@/lib/bonus/arte-foto";
 
 // A FOTO DA CONTA NO CABEÇALHO DA ARTE, buscada pela própria rota. A URL vem do banco (a Meta a dá),
 // e a rota é um servidor buscando um endereço: as travas são o que impede essa busca de ir a outro
@@ -96,3 +104,63 @@ describe("a busca da foto", () => {
     expect(FOTO_MAX_BYTES).toBe(512 * 1024);
   });
 });
+
+// A FOTO EM MEMÓRIA (spec da Etapa 4, "A foto da conta em memória"). As miniaturas de um carrossel
+// chegam juntas, e cada uma buscava a foto de novo na Meta, até 3 s cada. A memória guarda a PROMESSA
+// por URL: chamadas juntas esperam a mesma busca. O relógio e a busca entram por parâmetro.
+describe("a foto em memória", () => {
+  const DATA = "data:image/jpeg;base64,/9j/";
+  const memoria = (resultados: (string | null)[]) => {
+    let agora = 1_000_000;
+    const buscar = vi.fn(async (): Promise<string | null> => (resultados.length ? (resultados.shift() as string | null) : DATA));
+    const m = memoriaDasFotos(buscar, () => agora);
+    return { m, buscar, andar: (ms: number) => (agora += ms) };
+  };
+
+  it("as miniaturas que chegam juntas fazem uma busca só", async () => {
+    const { m, buscar } = memoria([DATA]);
+    const fotos = await Promise.all(Array.from({ length: 10 }, () => m.foto(FOTO)));
+    expect(fotos).toEqual(Array(10).fill(DATA));
+    expect(buscar).toHaveBeenCalledTimes(1);
+  });
+
+  it("a foto achada fica guardada 10 minutos, e depois é buscada de novo", async () => {
+    const { m, buscar, andar } = memoria([DATA, DATA]);
+    await m.foto(FOTO);
+    andar(FOTO_GUARDADA_MS - 1);
+    await m.foto(FOTO);
+    expect(buscar).toHaveBeenCalledTimes(1);
+    andar(1);
+    await m.foto(FOTO);
+    expect(buscar).toHaveBeenCalledTimes(2);
+    expect(FOTO_GUARDADA_MS).toBe(10 * 60_000);
+  });
+
+  it("a falha fica guardada só 30 segundos, para uma queda da Meta não grudar", async () => {
+    const { m, buscar, andar } = memoria([null, DATA]);
+    expect(await m.foto(FOTO)).toBeNull();
+    andar(FALHA_GUARDADA_MS - 1);
+    expect(await m.foto(FOTO)).toBeNull();
+    andar(1);
+    expect(await m.foto(FOTO)).toBe(DATA);
+    expect(buscar).toHaveBeenCalledTimes(2);
+    expect(FALHA_GUARDADA_MS).toBe(30_000);
+  });
+
+  it("as fotos vencidas saem da memória (a URL muda quando o cron renova a conta)", async () => {
+    const { m, andar } = memoria([DATA, DATA, DATA]);
+    await m.foto(`${FOTO}&v=1`);
+    await m.foto(`${FOTO}&v=2`);
+    expect(m.quantas()).toBe(2);
+    andar(FOTO_GUARDADA_MS);
+    await m.foto(`${FOTO}&v=3`);
+    expect(m.quantas()).toBe(1);
+  });
+
+  it("sem URL não busca nem guarda", async () => {
+    const { m, buscar } = memoria([]);
+    expect(await m.foto(null)).toBeNull();
+    expect(buscar).not.toHaveBeenCalled();
+    expect(m.quantas()).toBe(0);
+  });
+});
```

Em `tests/bonus-arte-paginas.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-arte-paginas.test.ts b/tests/bonus-arte-paginas.test.ts
index 7a6dd54..771844d 100644
--- a/tests/bonus-arte-paginas.test.ts
+++ b/tests/bonus-arte-paginas.test.ts
@@ -37,6 +37,14 @@ describe("a rota da arte", () => {
   it("os cabeçalhos da resposta saem de cabecalhosDaArte, que nunca diz public", () => {
     expect(ler("lib/bonus/arte-resposta.tsx")).toContain("headers: cabecalhosDaArte(baixar, nomeDoArquivo)");
   });
+
+  // A foto passa pela memória da instância (spec da Etapa 4): as miniaturas chegam juntas, e a
+  // memória faz delas uma busca só. Chamar `fotoDaConta` direto voltaria a uma busca por miniatura.
+  it("a foto da conta vem da memória da instância, e não de uma busca por miniatura", () => {
+    const rota = ler(ROTA);
+    expect(rota).toContain("fotosDaInstancia.foto(");
+    expect(rota).not.toMatch(/\bfotoDaConta\(/);
+  });
 });
 
 // O TOKEN DE ACESSO DA CONTA NÃO SAI DA TABELA (achado 60): `accounts` guarda o `access_token`, e
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-arte-foto.test.ts tests/bonus-arte-paginas.test.ts
```

Esperado: 6 casos caem e 36 passam (42): os da memória das fotos, que não existe ainda, e a guarda de que a rota a usa.

- [ ] **Passo 3: o código**

Em `lib/bonus/arte-foto.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/arte-foto.ts b/lib/bonus/arte-foto.ts
index bb2e0c8..7088ca4 100644
--- a/lib/bonus/arte-foto.ts
+++ b/lib/bonus/arte-foto.ts
@@ -86,3 +86,51 @@ export async function fotoDaConta(url: string | null, fetchImpl: typeof fetch =
   if (!bytes || !tipo) return null;
   return `data:image/${tipo};base64,${Buffer.from(bytes).toString("base64")}`;
 }
+
+// A FOTO EM MEMÓRIA, por instância do servidor e por URL (spec da Etapa 4). As miniaturas de um
+// carrossel chegam juntas, e cada uma buscava a foto de novo na Meta, até 3 s cada: trocar a conta,
+// na Etapa 3, pedia 10 buscas e pareceu lento no preview.
+// - Guarda a PROMESSA, e não só o resultado: as chamadas que chegam juntas, com a memória vazia,
+//   esperam a mesma busca.
+// - A foto achada vale 10 minutos; a falha (null) vale 30 s, para uma queda da Meta não grudar.
+// - As vencidas saem a cada chamada: a URL muda quando o cron renova a conta, e as chaves velhas se
+//   acumulariam.
+// As travas da busca são as de `fotoDaConta`, que continua sendo quem busca.
+
+export const FOTO_GUARDADA_MS = 10 * 60_000;
+export const FALHA_GUARDADA_MS = 30_000;
+
+export type MemoriaDasFotos = {
+  foto: (url: string | null) => Promise<string | null>;
+  /** Quantas URLs estão guardadas agora (para o teste da limpeza). */
+  quantas: () => number;
+};
+
+export function memoriaDasFotos(
+  buscar: (url: string) => Promise<string | null> = (url) => fotoDaConta(url),
+  agora: () => number = Date.now
+): MemoriaDasFotos {
+  const guardadas = new Map<string, { promessa: Promise<string | null>; vence: number }>();
+  return {
+    foto(url) {
+      if (!url) return Promise.resolve(null);
+      const t = agora();
+      for (const [chave, g] of guardadas) if (g.vence <= t) guardadas.delete(chave);
+      const achada = guardadas.get(url);
+      if (achada) return achada.promessa;
+      const guardada = { promessa: buscar(url), vence: t + FOTO_GUARDADA_MS };
+      guardadas.set(url, guardada);
+      guardada.promessa.then(
+        (foto) => {
+          if (foto === null) guardada.vence = agora() + FALHA_GUARDADA_MS;
+        },
+        () => guardadas.delete(url)
+      );
+      return guardada.promessa;
+    },
+    quantas: () => guardadas.size,
+  };
+}
+
+/** A memória desta instância do servidor, que a rota da arte usa. */
+export const fotosDaInstancia = memoriaDasFotos();
```

Em `app/bonus/[id]/carrossel/[cid]/arte/route.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/[id]/carrossel/[cid]/arte/route.tsx b/app/bonus/[id]/carrossel/[cid]/arte/route.tsx
index 15972ae..79f7aa5 100644
--- a/app/bonus/[id]/carrossel/[cid]/arte/route.tsx
+++ b/app/bonus/[id]/carrossel/[cid]/arte/route.tsx
@@ -4,7 +4,7 @@ import { ACCOUNT_COOKIE } from "@/lib/account";
 import { isValidSession, SESSION_COOKIE } from "@/lib/auth";
 import { resolverConta } from "@/lib/bonus/arte-conta";
 import { comEspaco, escolhasDaArte } from "@/lib/bonus/arte-escolhas";
-import { fotoDaConta } from "@/lib/bonus/arte-foto";
+import { fotosDaInstancia } from "@/lib/bonus/arte-foto";
 import { respostaDaArte } from "@/lib/bonus/arte-resposta";
 import { cabecalhoDaConta, conferirPedidoDaArte, nomeDoArquivo } from "@/lib/bonus/arte-tela";
 import {
@@ -52,7 +52,9 @@ export async function GET(request: Request, { params }: { params: Promise<{ id:
   const escolhas = escolhasDaArte(linha.arte, slides.length);
   const { conta } = resolverConta(await contasParaArte(), escolhas.conta, jarra.get(ACCOUNT_COOKIE)?.value);
   if (!conta) return erro(409, TEXTO_ARTE_SEM_CONTA);
-  const [foto, bonus] = await Promise.all([fotoDaConta(conta.profile_picture_url), lerLinha(id)]);
+  // A foto vem da memória desta instância (arte-foto.ts): as miniaturas chegam juntas, e uma busca
+  // só atende todas.
+  const [foto, bonus] = await Promise.all([fotosDaInstancia.foto(conta.profile_picture_url), lerLinha(id)]);
 
   // O PNG já sai lido inteiro (arte-resposta.tsx, achado 65): uma falha do desenho vira 500 com
   // frase, e não um 200 com o corpo quebrado. Emoji no texto faz o desenho buscar o emoji em
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx vitest run tests/bonus-arte-foto.test.ts tests/bonus-arte-paginas.test.ts
```

Esperado: `tsc` limpo e 42 casos passam.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/arte-foto.ts "app/bonus/[id]/carrossel/[cid]/arte/route.tsx" tests/bonus-arte-foto.test.ts tests/bonus-arte-paginas.test.ts
test "$(git branch --show-current)" = "pagina-do-carrossel"
git add lib/bonus/arte-foto.ts "app/bonus/[id]/carrossel/[cid]/arte/route.tsx" tests/bonus-arte-foto.test.ts tests/bonus-arte-paginas.test.ts
git commit -m "feat(bonus): a foto da conta fica em memória, por instância e por URL"
```

---

### FASE 4.2 — A tabela de larguras da Carlito

**Arquivos:**
- Criar: `lib/bonus/arte-larguras-do-ttf.ts`, `lib/bonus/fonte/gerar-larguras.ts`, e o gerado
  `lib/bonus/arte-larguras.ts`
- Testar: `tests/bonus-arte-larguras.test.ts`

**Interfaces:**
- Produz: `type LargurasDaFonte = { unidadesPorEm: number; avancos: Map<number, number> }`,
  `lerLarguras(ttf: Uint8Array): LargurasDaFonte` (cmap 3/1 de formato 4 e hmtx, como o opentype.js
  do Satori escolhe), `textoDaTabela(regular, negrito): string`; e, no arquivo gerado,
  `UNIDADES_POR_EM = 2048` e `FAIXAS_DE_LARGURA` (cada faixa: o primeiro código e, por código, o
  avanço no Regular e no Bold).

- [ ] **Passo 1: o teste**

Crie `tests/bonus-arte-larguras.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { lerLarguras, textoDaTabela } from "@/lib/bonus/arte-larguras-do-ttf";

// A TABELA DE LARGURAS do "não cabe" (spec da Etapa 4, "A largura real de cada letra") não é cópia
// à mão: sai dos .ttf versionados por lib/bonus/fonte/gerar-larguras.ts. Este teste a recalcula dos
// mesmos arquivos e compara com o versionado, byte a byte. Uma fonte trocada sem tabela nova, ou uma
// tabela editada à mão, derruba o caso.

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const ler = (rel: string) => readFileSync(`${RAIZ}/${rel}`);
const regular = lerLarguras(ler("lib/bonus/fonte/Carlito-Regular.ttf"));
const negrito = lerLarguras(ler("lib/bonus/fonte/Carlito-Bold.ttf"));

describe("a tabela de larguras", () => {
  it("é a que o gerador tira dos .ttf de hoje", () => {
    // O git pode entregar a cópia de trabalho em CRLF (core.autocrlf); o gerador escreve LF.
    const versionada = ler("lib/bonus/arte-larguras.ts").toString("utf8").replace(/\r\n/g, "\n");
    expect(versionada).toBe(textoDaTabela(regular, negrito));
  });

  // Números conferidos à parte, com o leitor descartável da auditoria (02/10): a Carlito é desenhada
  // em 2048 unidades por em, o espaço tem 463 nos dois pesos, e o negrito alarga as letras.
  it("lê os avanços da Carlito em unidades da fonte", () => {
    expect(regular.unidadesPorEm).toBe(2048);
    expect(regular.avancos.get(0x20)).toBe(463);
    expect(negrito.avancos.get(0x20)).toBe(463);
    expect(regular.avancos.get("M".codePointAt(0)!)).toBe(1751);
    expect(negrito.avancos.get("M".codePointAt(0)!)).toBeGreaterThan(regular.avancos.get("M".codePointAt(0)!)!);
  });

  it("não tem desenho para emoji nem para o que fica fora do plano básico", () => {
    expect(regular.avancos.has(0x2705)).toBe(false);
    expect([...regular.avancos.keys()].every((c) => c <= 0xffff)).toBe(true);
  });
});
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-arte-larguras.test.ts
```

Esperado: o arquivo cai sem rodar caso nenhum, com `Cannot find package '@/lib/bonus/arte-larguras-do-ttf'`.

- [ ] **Passo 3: o leitor e o gerador**

Crie `lib/bonus/arte-larguras-do-ttf.ts`:

```ts
// AS LARGURAS DE AVANÇO de cada caractere de um .ttf, em unidades da fonte, como o Satori as usa:
// o glifo vem do cmap (plataforma 3, codificação 1, formato 4, a subtabela que o opentype.js do
// Satori escolhe) e o avanço vem do hmtx. PURO, e sem import de pacote: o gerador da tabela
// (lib/bonus/fonte/gerar-larguras.ts) roda no `node` puro, e o teste
// (tests/bonus-arte-larguras.test.ts) recalcula a tabela com esta mesma função.

/** Os avanços de uma fonte: as unidades por em e, por código de caractere, o avanço em unidades. */
export type LargurasDaFonte = { unidadesPorEm: number; avancos: Map<number, number> };

export function lerLarguras(ttf: Uint8Array): LargurasDaFonte {
  const v = new DataView(ttf.buffer, ttf.byteOffset, ttf.byteLength);
  const tabelas = new Map<string, number>();
  for (let i = 0; i < v.getUint16(4); i++) {
    const o = 12 + i * 16;
    tabelas.set(String.fromCharCode(...ttf.subarray(o, o + 4)), v.getUint32(o + 8));
  }
  const exigir = (nome: string): number => {
    const o = tabelas.get(nome);
    if (o === undefined) throw new Error(`a fonte não tem a tabela ${nome}`);
    return o;
  };
  const head = exigir("head");
  const hhea = exigir("hhea");
  const hmtx = exigir("hmtx");
  const cmap = exigir("cmap");
  const nMetricas = v.getUint16(hhea + 34);
  const avancoDoGlifo = (g: number) => v.getUint16(hmtx + 4 * Math.min(g, nMetricas - 1));

  let formato4 = -1;
  for (let i = 0; i < v.getUint16(cmap + 2); i++) {
    const r = cmap + 4 + i * 8;
    const o = cmap + v.getUint32(r + 4);
    if (v.getUint16(r) === 3 && v.getUint16(r + 2) === 1 && v.getUint16(o) === 4) formato4 = o;
  }
  if (formato4 < 0) throw new Error("a fonte não tem o cmap 3/1 de formato 4");

  const segmentos = v.getUint16(formato4 + 6) / 2;
  const fins = formato4 + 14;
  const inicios = fins + segmentos * 2 + 2;
  const deltas = inicios + segmentos * 2;
  const desvios = deltas + segmentos * 2;
  const avancos = new Map<number, number>();
  for (let s = 0; s < segmentos; s++) {
    const inicio = v.getUint16(inicios + 2 * s);
    const fim = v.getUint16(fins + 2 * s);
    const delta = v.getInt16(deltas + 2 * s);
    const desvio = v.getUint16(desvios + 2 * s);
    for (let c = inicio; c <= fim && c !== 0xffff; c++) {
      let g: number;
      if (desvio === 0) g = (c + delta) & 0xffff;
      else {
        const bruto = v.getUint16(desvios + 2 * s + desvio + 2 * (c - inicio));
        g = bruto === 0 ? 0 : (bruto + delta) & 0xffff;
      }
      if (g !== 0) avancos.set(c, avancoDoGlifo(g));
    }
  }
  return { unidadesPorEm: v.getUint16(head + 18), avancos };
}

/**
 * O texto do arquivo lib/bonus/arte-larguras.ts, com o Regular e o Bold juntos: cada faixa é o
 * primeiro código e, para cada código seguido, o avanço no Regular e no Bold. O gerador escreve
 * este texto, e o teste o compara com o arquivo versionado.
 */
export function textoDaTabela(regular: LargurasDaFonte, negrito: LargurasDaFonte): string {
  if (regular.unidadesPorEm !== negrito.unidadesPorEm) throw new Error("os dois pesos têm unidades por em diferentes");
  const codigos = [...regular.avancos.keys()].sort((a, b) => a - b);
  const deNegrito = [...negrito.avancos.keys()].sort((a, b) => a - b);
  if (codigos.join() !== deNegrito.join()) throw new Error("os dois pesos não desenham os mesmos caracteres");

  const faixas: string[] = [];
  let atual: number[] = [];
  let inicio = -1;
  const fechar = () => {
    if (atual.length) faixas.push(`  [0x${inicio.toString(16)}, [${atual.join(", ")}]],`);
  };
  for (const c of codigos) {
    if (c !== inicio + atual.length / 2) {
      fechar();
      inicio = c;
      atual = [];
    }
    atual.push(regular.avancos.get(c)!, negrito.avancos.get(c)!);
  }
  fechar();

  return [
    "// GERADO por lib/bonus/fonte/gerar-larguras.ts a partir dos .ttf de lib/bonus/fonte, e não se",
    "// edita à mão: tests/bonus-arte-larguras.test.ts recalcula a tabela e reprova a diferença. Quem",
    "// troca a fonte roda `node lib/bonus/fonte/gerar-larguras.ts` e versiona o arquivo novo.",
    "",
    `export const UNIDADES_POR_EM = ${regular.unidadesPorEm};`,
    "",
    "/** Cada faixa: o primeiro código e, para cada código seguido, o avanço no Regular e no Bold. */",
    "export const FAIXAS_DE_LARGURA: readonly (readonly [number, readonly number[]])[] = [",
    ...faixas,
    "];",
    "",
  ].join("\n");
}
```

Crie `lib/bonus/fonte/gerar-larguras.ts`:

```ts
// GERA lib/bonus/arte-larguras.ts a partir dos .ttf desta pasta. Roda no `node` puro, da raiz do
// projeto: `node lib/bonus/fonte/gerar-larguras.ts`. O teste tests/bonus-arte-larguras.test.ts
// recalcula a mesma tabela e reprova se o arquivo versionado divergir.
import { readFileSync, writeFileSync } from "node:fs";
import { lerLarguras, textoDaTabela } from "../arte-larguras-do-ttf.ts";

const pasta = new URL(".", import.meta.url);
const regular = lerLarguras(readFileSync(new URL("Carlito-Regular.ttf", pasta)));
const negrito = lerLarguras(readFileSync(new URL("Carlito-Bold.ttf", pasta)));
writeFileSync(new URL("../arte-larguras.ts", pasta), textoDaTabela(regular, negrito));
console.log(`lib/bonus/arte-larguras.ts: ${regular.avancos.size} caracteres`);
```

- [ ] **Passo 4: a tabela, gerada e não escrita à mão**

O `node` lê `.ts` com a extensão explícita (o tsconfig tem `allowImportingTsExtensions`, pela
varredura do dono). Ele avisa `MODULE_TYPELESS_PACKAGE_JSON`, porque o `package.json` não diz
`"type"`; o aviso não muda nada, e o `package.json` é do dono.

Gere `lib/bonus/arte-larguras.ts` rodando, da raiz:

```bash
node lib/bonus/fonte/gerar-larguras.ts
```

Esperado: `lib/bonus/arte-larguras.ts: 2117 caracteres`, e um arquivo de 25 436 bytes com 123 faixas.

- [ ] **Passo 5: ver passar**

```bash
npx tsc --noEmit
npx vitest run tests/bonus-arte-larguras.test.ts
```

Esperado: `tsc` limpo e 3 casos passam.

- [ ] **Passo 6: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/arte-larguras-do-ttf.ts lib/bonus/fonte/gerar-larguras.ts lib/bonus/arte-larguras.ts tests/bonus-arte-larguras.test.ts
test "$(git branch --show-current)" = "pagina-do-carrossel"
git add lib/bonus/arte-larguras-do-ttf.ts lib/bonus/fonte/gerar-larguras.ts lib/bonus/arte-larguras.ts tests/bonus-arte-larguras.test.ts
git commit -m "feat(bonus): a tabela de larguras da Carlito, gerada dos .ttf"
```

---

### FASE 4.3 — A composição do slide e a conta exata do "não cabe" (achados 70 e 71)

**Arquivos:**
- Criar: `lib/bonus/arte-composicao.ts`, `lib/bonus/arte-medida.ts`
- Modificar: `lib/bonus/arte-geometria.ts`, `lib/bonus/arte-slides.ts`, `lib/bonus/arte-desenho.tsx`,
  `lib/bonus/arte-resposta.tsx`, `lib/bonus/arte-cabimento.ts` (só o comentário)
- Testar: `tests/bonus-arte-composicao.test.ts`, `tests/bonus-arte-medida.test.ts`,
  `tests/bonus-arte-slides.test.ts`

**Interfaces:**
- Consome: `UNIDADES_POR_EM` e `FAIXAS_DE_LARGURA` (FASE 4.2).
- Produz, de `arte-geometria.ts`: `LADO_DO_AVATAR = 127`, `GAP_CABECALHO = 48`,
  `GAP_ILUSTRACAO = 48`, `AVANCO_MANCHETE = 77`, `GAP_PARAGRAFO = 41`,
  `ESPACAMENTO_DO_NEGRITO = -0.4`, `ALTURA_DO_CABECALHO = 175`, `ALTURA_TEXTO_COM_ILUSTRACAO = 334`,
  `alturaDaLinha(fonte) = Math.round(fonte * 1.32)`, `type EspacoAntes = "nada" | "manchete" |
  "paragrafo"`, `espacoAntes(antes, fonte)`. Saem `CABECALHO_ESTIMADO`, `LARGURA_DO_CARACTERE` e
  `alturaEstimada`.
- Produz, de `arte-composicao.ts`: `type LinhaDaArte = { texto; negrito; espacamento; antes }` e
  `composicaoDoSlide(titulo, texto): LinhaDaArte[]`.
- Produz, de `arte-medida.ts`: `larguraDoTexto(texto, fonte, negrito, espacamento)`,
  `pedacosDaLinha(texto): string[]`, `quebraDaLinha(linha, fonte): { linhas; vaza }` e
  `medidaDaComposicao(linhas, fonte): { altura; vaza }`.
- Produz, de `arte-slides.ts`: `type TamanhoDoSlide = { fonte; cabe }`,
  `tamanhoDoSlide(s, comIlustracao)`, `degrausDoSlide(tipo, comIlustracao)` (com o piso no fim) e o
  gancho `[86, 72, 56, 46]`. Saem `textoMedido` e `tamanhoDoTexto`; `SlideQueNaoCabe` perde `linhas`.

- [ ] **Passo 1: os testes**

Crie `tests/bonus-arte-composicao.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { composicaoDoSlide, type LinhaDaArte } from "@/lib/bonus/arte-composicao";
import { ESPACAMENTO_DO_NEGRITO } from "@/lib/bonus/arte-geometria";

// A COMPOSIÇÃO DO SLIDE (spec da Etapa 4, "Dois donos"; a 48.1 e a 48.4 do Labs): as linhas que o
// desenho desenha e a conta mede, com o texto já normalizado. Nenhum dos dois normaliza por conta
// própria, e é isso que impede o aviso de medir um texto e o desenho desenhar outro.

const normal = (texto: string, antes: LinhaDaArte["antes"] = "nada"): LinhaDaArte => ({
  texto,
  negrito: false,
  espacamento: 0,
  antes,
});
const forte = (texto: string, antes: LinhaDaArte["antes"] = "nada"): LinhaDaArte => ({
  texto,
  negrito: true,
  espacamento: ESPACAMENTO_DO_NEGRITO,
  antes,
});

describe("as linhas e o negrito", () => {
  it("o gancho e a chamada, sem manchete e num bloco só, saem inteiros em negrito", () => {
    expect(composicaoDoSlide(null, "Seu cliente sumiu?\nNão é culpa dele.")).toEqual([
      forte("Seu cliente sumiu?"),
      forte("Não é culpa dele."),
    ]);
  });

  it("com manchete, a manchete é negrito, o corpo de um bloco é normal, e o corpo começa depois do avanço da manchete", () => {
    expect(composicaoDoSlide("O primeiro passo", "Responda no mesmo dia.\nMesmo que curto.")).toEqual([
      forte("O primeiro passo"),
      normal("Responda no mesmo dia.", "manchete"),
      normal("Mesmo que curto."),
    ]);
  });

  it("com mais de um bloco, o último é a linha de fechamento, em negrito, depois do intervalo de parágrafo", () => {
    expect(composicaoDoSlide("Manchete", "Um.\nDois.\n\nFechamento.")).toEqual([
      forte("Manchete"),
      normal("Um.", "manchete"),
      normal("Dois."),
      forte("Fechamento.", "paragrafo"),
    ]);
    expect(composicaoDoSlide(null, "Um.\n\nDois.\n\nTrês.")).toEqual([
      normal("Um."),
      normal("Dois.", "paragrafo"),
      forte("Três.", "paragrafo"),
    ]);
  });
});

describe("a normalização, feita uma vez, aqui", () => {
  it("as sete quebras obrigatórias viram \\n: \\r\\n, \\r, \\v, \\f, NEL, U+2028 e U+2029", () => {
    for (const q of ["\r\n", "\r", "\u000B", "\u000C", "\u0085", "\u2028", "\u2029"]) {
      expect(composicaoDoSlide(null, `a${q}b${q}${q}c`), JSON.stringify(q)).toEqual([
        normal("a"),
        normal("b"),
        forte("c", "paragrafo"),
      ]);
    }
  });

  it("espaços e tabs seguidos viram um espaço, e as pontas de cada linha saem", () => {
    expect(composicaoDoSlide(null, "  um \t  dois  \n\t três\t")).toEqual([forte("um dois"), forte("três")]);
  });

  it("a linha só de espaços separa parágrafo, como a linha vazia (antes, desenhava uma linha de 0px)", () => {
    expect(composicaoDoSlide(null, "a\n \t \nb")).toEqual([normal("a"), forte("b", "paragrafo")]);
  });

  it("três ou mais quebras seguidas dão um parágrafo só, e as quebras das pontas somem", () => {
    expect(composicaoDoSlide(null, "\n\n\na\n\n\n\nb\n\n")).toEqual([normal("a"), forte("b", "paragrafo")]);
  });

  it("o acento em NFD vira NFC: o desenho põe o espaçamento do negrito por glifo, e o NFD dá dois glifos", () => {
    const [linha] = composicaoDoSlide(null, "cafe\u0301");
    expect(linha.texto).toBe("café");
    expect(linha.texto).toHaveLength(4);
  });

  it("a manchete perde as quebras, como o desenho de hoje faz com ela, e só de espaços é manchete nenhuma", () => {
    expect(composicaoDoSlide("  Uma\r\nmanchete  ", "Corpo.")[0]).toEqual(forte("Uma manchete"));
    expect(composicaoDoSlide(" \n ", "Corpo.")).toEqual([forte("Corpo.")]);
  });

  it("o espaço sem quebra (U+00A0) do meio fica: ele cola as palavras no desenho", () => {
    expect(composicaoDoSlide(null, "R$\u00A0100")[0].texto).toBe("R$\u00A0100");
  });

  it("um corpo vazio não tem linha", () => {
    expect(composicaoDoSlide(null, " \n\n ")).toEqual([]);
    expect(composicaoDoSlide("Só manchete", "")).toEqual([forte("Só manchete")]);
  });
});
```

Crie `tests/bonus-arte-medida.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { LinhaDaArte } from "@/lib/bonus/arte-composicao";
import { ESPACAMENTO_DO_NEGRITO } from "@/lib/bonus/arte-geometria";
import { larguraDoTexto, medidaDaComposicao, pedacosDaLinha, quebraDaLinha } from "@/lib/bonus/arte-medida";

// A CONTA DO "NÃO CABE" (spec da Etapa 4, "A largura real de cada letra"): a mesma quebra gulosa que o
// Satori faz, com a largura de cada letra tirada da Carlito. Os números esperados aqui vêm da tabela
// (unidades da fonte, 2048 por em) em fontes que dão escala exata em ponto flutuante: 2048px dá
// escala 1, e 128px dá 1/16. Os vetores combinados com o Labs conferem a mesma conta contra o desenho.

const linha = (texto: string, negrito = false, antes: LinhaDaArte["antes"] = "nada"): LinhaDaArte => ({
  texto,
  negrito,
  espacamento: negrito ? ESPACAMENTO_DO_NEGRITO : 0,
  antes,
});

describe("a largura de um texto", () => {
  it("soma o avanço de cada letra, em unidades da fonte vezes a escala", () => {
    expect(larguraDoTexto(" ", 2048, false, 0)).toBe(463);
    expect(larguraDoTexto("MM", 2048, false, 0)).toBe(2 * 1751);
    expect(larguraDoTexto("txyam mmmmm", 128, false, 0)).toBe(860);
  });

  it("o negrito usa a tabela do Bold e tira o espaçamento de cada letra", () => {
    const m = larguraDoTexto("M", 2048, true, 0);
    expect(m).toBeGreaterThan(1751);
    expect(larguraDoTexto("MM", 2048, true, ESPACAMENTO_DO_NEGRITO)).toBeCloseTo(2 * m - 0.8, 9);
  });

  it("o emoji (e todo caractere sem desenho na fonte) vale 1em, sem o espaçamento", () => {
    expect(larguraDoTexto("✅", 50, true, ESPACAMENTO_DO_NEGRITO)).toBe(50);
    expect(larguraDoTexto("❤\uFE0F", 50, false, 0)).toBe(50);
    expect(larguraDoTexto("\u{1F525}", 50, false, 0)).toBe(50);
    expect(larguraDoTexto("a\u{1F525}", 2048, false, 0)).toBe(981 + 2048);
  });
});

describe("os pedaços que a linha pode quebrar", () => {
  it("quebra depois de cada espaço, e o espaço vai com a palavra de antes", () => {
    expect(pedacosDaLinha("um dois três")).toEqual(["um ", "dois ", "três"]);
  });

  // Medido no quebrador do Satori (o do pacote linebreak, dentro do og do Next 16.3.8), em 02/10:
  // em todos os pares de 230 caracteres, só estes quatro casos colam no espaço.
  it("não quebra antes de ! ) , . / : ; ? ] }", () => {
    for (const c of "!),./:;?]}") expect(pedacosDaLinha(`bem ${c} sim`), c).toEqual([`bem ${c} `, "sim"]);
  });

  it("não quebra depois de ( [ { ¡ ¿ „ ‚", () => {
    for (const c of "([{¡¿„‚") expect(pedacosDaLinha(`sim ${c} bem`), c).toEqual(["sim ", `${c} bem`]);
  });

  it("não quebra entre a aspa e o parêntese que abre, nem entre dois travessões", () => {
    expect(pedacosDaLinha("“texto” (nota) fim")).toEqual(["“texto” (nota) ", "fim"]);
    expect(pedacosDaLinha("a — — b")).toEqual(["a ", "— — ", "b"]);
  });

  // O Satori também quebra DENTRO da palavra (depois do hífen entre letras, em volta do travessão e
  // do emoji colados). A conta não: com menos pontos de quebra, ela nunca prevê menos linhas.
  it("o hífen, o travessão e o emoji colados não quebram na conta, que fica do lado seguro", () => {
    expect(pedacosDaLinha("palavra-chave e-mail")).toEqual(["palavra-chave ", "e-mail"]);
    expect(pedacosDaLinha("antes—depois")).toEqual(["antes—depois"]);
  });
});

describe("a quebra gulosa", () => {
  it("a linha que soma exatamente a largura útil cabe, e uma letra a mais desce", () => {
    expect(quebraDaLinha(linha("txyam mmmmm"), 128)).toEqual({ linhas: 1, vaza: false });
    expect(quebraDaLinha(linha("txyam mmmmmn"), 128)).toEqual({ linhas: 2, vaza: false });
  });

  // "txyam mmmmm " soma 860 mais o espaço do fim, e cabe: o espaço do fim da palavra não conta.
  // Contado, "mmmmm" desceria, e a linha de baixo também transbordaria: 3 linhas em vez de 2.
  it("o espaço do fim da última palavra da linha não conta", () => {
    expect(quebraDaLinha(linha("txyam mmmmm txyam mmmmm"), 128)).toEqual({ linhas: 2, vaza: false });
  });

  it("a palavra mais larga que a linha fica numa linha só e vaza pela direita", () => {
    const longa = "m".repeat(20);
    expect(quebraDaLinha(linha(`a ${longa} b`), 128)).toEqual({ linhas: 3, vaza: true });
    expect(quebraDaLinha(linha(longa), 128)).toEqual({ linhas: 1, vaza: true });
  });
});

describe("a altura da composição", () => {
  it("cada linha quebrada ocupa fonte × 1,32 arredondado", () => {
    expect(medidaDaComposicao([linha("Curto", true)], 86)).toEqual({ altura: 114, vaza: false });
    expect(medidaDaComposicao([linha("Um"), linha("Dois")], 34)).toEqual({ altura: 90, vaza: false });
  });

  // O desenho dá à manchete o avanço de 77 até o corpo: a 46px, a linha (61) e o espaço (16).
  it("o corpo começa no avanço da manchete, e o parágrafo seguinte depois de 41", () => {
    const linhas = [linha("Manchete", true), linha("Corpo", false, "manchete"), linha("Fecho", true, "paragrafo")];
    expect(medidaDaComposicao(linhas, 46)).toEqual({ altura: 77 + 61 + 41 + 61, vaza: false });
    expect(medidaDaComposicao(linhas, 86)).toEqual({ altura: 114 + 114 + 41 + 114, vaza: false });
  });

  it("vaza quando alguma linha vaza", () => {
    expect(medidaDaComposicao([linha("ok"), linha("m".repeat(20))], 128).vaza).toBe(true);
  });
});
```

Em `tests/bonus-arte-slides.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-arte-slides.test.ts b/tests/bonus-arte-slides.test.ts
index 6549c4a..57e488e 100644
--- a/tests/bonus-arte-slides.test.ts
+++ b/tests/bonus-arte-slides.test.ts
@@ -2,19 +2,17 @@ import { describe, expect, it } from "vitest";
 import {
   slidesDoTexto,
   slidesQueNaoCabem,
-  tamanhoDoTexto,
-  textoMedido,
+  tamanhoDoSlide,
   type SlideParaArte,
   type TipoDeSlide,
 } from "@/lib/bonus/arte-slides";
-import { ALTURA_TEXTO_SEM_ILUSTRACAO, alturaDisponivel, alturaEstimada } from "@/lib/bonus/arte-geometria";
 import { CarrosselDoChatSchema, PostDoChatSchema, SlideSchema } from "@/lib/bonus/carrossel-schema";
 import type { TextoDeCarrossel, TextoDePost } from "@/lib/bonus/carrossel-texto";
 
-// OS TESTES DOS SLIDES DA ARTE, trazidos do Labs (site-ia, src/lib/ia/slides.test.ts, 45bc973) e
-// adaptados à forma do texto do Chat (carrossel-texto.ts). O que muda de lá está dito em cada
-// bloco. Os números dos degraus e da geometria são os de lá: se um caso daqui cair, a régua mudou
-// num dos dois lados, e o outro precisa saber ("Dois donos", na spec da Etapa 3).
+// OS TESTES DOS SLIDES DA ARTE, vindos do Labs (site-ia, src/lib/ia/slides.test.ts, 45bc973) e
+// adaptados à forma do texto do Chat (carrossel-texto.ts). A escolha da fonte e o "não cabe" medem a
+// composição com a conta exata (Etapa 4): os números daqui são os da conta, e os vetores combinados
+// com o Labs (tests/bonus-arte-vetores.test.ts) conferem a conta contra o desenho.
 
 const carrossel = (conteudo: number): TextoDeCarrossel => ({
   tipo: "carrossel",
@@ -78,82 +76,89 @@ describe("o post de uma imagem", () => {
   });
 });
 
-describe("tamanhoDoTexto", () => {
+// Textos de palavras de verdade: a conta quebra por palavra, e "x".repeat(200) seria uma palavra só,
+// mais larga que a linha em qualquer degrau.
+const PALAVRAS =
+  "mande uma mensagem curta para o cliente que sumiu e lembre do que ele comprou na última vez porque quem some ainda pode voltar se a conversa certa chegar".split(
+    " "
+  );
+/** As palavras em ordem, até `n` caracteres sem cortar palavra. */
+function textoDe(n: number, caixaAlta = false): string {
+  const ps: string[] = [];
+  while (`${ps.join(" ")} ${PALAVRAS[ps.length % PALAVRAS.length]}`.trim().length <= n) ps.push(PALAVRAS[ps.length % PALAVRAS.length]);
+  const t = ps.join(" ");
+  return caixaAlta ? t.toUpperCase() : t;
+}
+const slide = (tipo: TipoDeSlide, texto: string, titulo: string | null = null): SlideParaArte => ({
+  numero: 2,
+  total: 3,
+  tipo,
+  titulo,
+  texto,
+  assinaturaNoPe: tipo === "cta",
+});
+const fonte = (s: SlideParaArte, comIlustracao = true) => tamanhoDoSlide(s, comIlustracao).fonte;
+
+describe("tamanhoDoSlide", () => {
   it("nunca cresce conforme o texto cresce, e desce quando precisa", () => {
-    const tamanhos = [40, 60, 100, 150, 200, 260, 320].map((n) => tamanhoDoTexto("conteudo", "x".repeat(n)));
+    const tamanhos = [40, 100, 200, 260, 300].map((n) => fonte(slide("conteudo", textoDe(n))));
     for (let i = 1; i < tamanhos.length; i++) {
       expect(tamanhos[i], `${i}: cresceu com texto maior`).toBeLessThanOrEqual(tamanhos[i - 1]);
     }
     expect(tamanhos[tamanhos.length - 1]).toBeLessThan(tamanhos[0]);
   });
 
-  it("o gancho é sempre maior que o texto de conteúdo do mesmo tamanho", () => {
-    for (const n of [30, 70, 110]) {
-      const t = "x".repeat(n);
-      expect(tamanhoDoTexto("gancho", t)).toBeGreaterThan(tamanhoDoTexto("conteudo", t));
+  it("o gancho é sempre maior que o conteúdo do mesmo texto", () => {
+    for (const n of [20, 60, 110]) {
+      const t = textoDe(n);
+      expect(fonte(slide("gancho", t))).toBeGreaterThan(fonte(slide("conteudo", t)));
     }
   });
 
-  it("nunca desce abaixo de 34px", () => {
+  it("nunca desce abaixo de 34px, e no piso diz que não cabe", () => {
     for (const tipo of ["gancho", "conteudo", "cta"] as const) {
-      expect(tamanhoDoTexto(tipo, "x".repeat(400))).toBeGreaterThanOrEqual(34);
+      expect(tamanhoDoSlide(slide(tipo, textoDe(900)), true)).toEqual({ fonte: 34, cabe: false });
     }
   });
 
   it("cresce sem o espaço da imagem, nos três tipos, sem fração de pixel", () => {
     for (const tipo of ["gancho", "conteudo", "cta"] as const) {
-      const t = "x".repeat(50);
-      expect(tamanhoDoTexto(tipo, t, false)).toBeGreaterThan(tamanhoDoTexto(tipo, t, true));
-      expect(Number.isInteger(tamanhoDoTexto(tipo, t, false))).toBe(true);
+      const t = textoDe(50);
+      expect(fonte(slide(tipo, t), false)).toBeGreaterThan(fonte(slide(tipo, t), true));
+      expect(Number.isInteger(fonte(slide(tipo, t), false))).toBe(true);
     }
   });
 
-  it("o padrão é COM o espaço da imagem", () => {
-    const t = "x".repeat(100);
-    expect(tamanhoDoTexto("conteudo", t)).toBe(tamanhoDoTexto("conteudo", t, true));
-  });
-
   // O CONTRAPESO da descida: ela só pode ser acionada por quem NÃO CABE. Sem este caso, devolver
   // sempre o piso passaria em todos os outros.
-  it("a descida não encolhe texto que já cabia, e os degraus do cta são os decididos", () => {
-    expect(tamanhoDoTexto("gancho", "x".repeat(30))).toBe(86);
-    expect(tamanhoDoTexto("conteudo", "x".repeat(60))).toBe(46);
-    expect(tamanhoDoTexto("cta", "x".repeat(70))).toBe(60);
-    expect(tamanhoDoTexto("cta", "x".repeat(200))).toBe(46);
-    expect(tamanhoDoTexto("cta", "x".repeat(350))).toBe(34);
-  });
-});
-
-// O TEXTO QUE A ARTE MEDE É O QUE ELA DESENHA: o título e o corpo (a rota do Labs mede assim, em
-// src/app/admin/carrossel/arte/route.tsx). ⚠️ DIFERENTE DO LABS, de propósito: lá o aviso de
-// `slidesQueNaoCabem` mede só o corpo, e um slide de conteúdo com título comprido podia cortar na
-// imagem com o aviso calado. Aqui o aviso e a arte medem o mesmo `textoMedido`.
-describe("o texto medido", () => {
-  const slide = (titulo: string | null, texto: string): SlideParaArte => ({
-    numero: 2,
-    total: 3,
-    tipo: "conteudo",
-    titulo,
-    texto,
-    assinaturaNoPe: false,
+  it("a descida não encolhe texto que já cabia", () => {
+    expect(fonte(slide("gancho", textoDe(20, true)))).toBe(86);
+    expect(fonte(slide("conteudo", textoDe(60)))).toBe(46);
+    expect(fonte(slide("cta", textoDe(70, true)))).toBe(60);
   });
 
-  it("com título, é o título e o corpo em linhas separadas; sem, é só o corpo", () => {
-    expect(textoMedido(slide("Título", "Corpo"))).toBe("Título\nCorpo");
-    expect(textoMedido(slide(null, "Corpo"))).toBe("Corpo");
+  // As capas que o Labs desenhou na comparação de 02/10 (site-ia-83): a de 109 caracteres cabe em 56 e
+  // tem de continuar lá; a de 120 só cabe no degrau de 46, que entrou nesta etapa (sem ele, ia ao piso).
+  it("o gancho longo desce para o degrau de 46, e a capa de 109 continua em 56", () => {
+    const capa = "VOCÊ ESTÁ PERDENDO CLIENTES TODOS OS DIAS POR CAUSA DE UM ERRO QUE QUASE NINGUÉM PERCEBE NA HORA DE RESPONDER";
+    expect(tamanhoDoSlide(slide("gancho", capa), true)).toEqual({ fonte: 56, cabe: true });
+    expect(tamanhoDoSlide(slide("gancho", `${capa} O WHATSAPP`), true)).toEqual({ fonte: 46, cabe: true });
   });
 
-  // O conserto do Labs (dev 1254847, 01/10) também apara a manchete: só de espaços, ela não é linha.
-  it("o título só de espaços não conta, e o com espaço nas pontas conta aparado", () => {
-    expect(textoMedido(slide("   ", "Corpo"))).toBe("Corpo");
-    expect(textoMedido(slide("  Título  ", "Corpo"))).toBe("Título\nCorpo");
+  // A arte não pede `wordBreak`: a palavra mais larga que a linha vaza pela direita. O degrau em que
+  // isso acontece não cabe, mesmo que a altura caiba.
+  it("o degrau em que uma palavra vaza pela direita não cabe", () => {
+    const url = "Pegue em https://metodolabs.com.br/bonus/planilha-de-precificacao";
+    expect(tamanhoDoSlide(slide("gancho", url), true)).toEqual({ fonte: 34, cabe: true });
   });
+});
 
-  // 8 linhas no piso de 34 dão 359px dos 382 com o espaço da imagem; a manchete é a 9ª, e dá 404.
-  it("o título conta: o mesmo corpo que cabe sozinho deixa de caber com um título", () => {
-    const corpo = Array(8).fill("x".repeat(20)).join("\n");
-    expect(slidesQueNaoCabem([slide(null, corpo)])).toEqual([]);
-    expect(slidesQueNaoCabem([slide("Um título de slide de conteúdo", corpo)])).toHaveLength(1);
+// A MANCHETE CONTA, e conta como o desenho a desenha: o corpo começa 77px abaixo do topo dela.
+describe("a manchete", () => {
+  it("o mesmo corpo que cabe sozinho deixa de caber com uma manchete", () => {
+    const sete = Array(7).fill("mande uma mensagem curta").join("\n");
+    expect(tamanhoDoSlide(slide("conteudo", sete), true)).toEqual({ fonte: 34, cabe: true });
+    expect(tamanhoDoSlide(slide("conteudo", sete, "O que fazer primeiro"), true)).toEqual({ fonte: 34, cabe: false });
   });
 });
 
@@ -172,71 +177,59 @@ describe("o texto cabe na peça", () => {
     }
   });
 
-  it("o gancho e a chamada cabem nos dois modos, no pior caso que o schema permite", () => {
+  it("o gancho e a chamada cabem nos dois modos no teto do schema, em caixa alta", () => {
     for (const tipo of ["gancho", "cta"] as const) {
       for (const comIlustracao of [true, false]) {
-        const t = "x".repeat(TETOS[tipo]);
-        expect(alturaEstimada(t, tamanhoDoTexto(tipo, t, comIlustracao)), `${tipo} ${comIlustracao}`).toBeLessThanOrEqual(
-          alturaDisponivel(comIlustracao)
-        );
+        expect(tamanhoDoSlide(slide(tipo, textoDe(TETOS[tipo], true)), comIlustracao).cabe, `${tipo} ${comIlustracao}`).toBe(true);
       }
     }
   });
 
-  // ⚠️ DIFERENTE DO LABS: com a manchete medida, o slide de conteúdo no PIOR caso do schema
-  // (manchete de 70 e corpo de 300, em caixa alta) não cabe em modo nenhum: sem o espaço da imagem
-  // o piso também sobe (34 × 1,6 = 54px), e dá 998px dos 955. O aviso existe para isto, e diz
-  // "corta sempre": o operador encurta. Um slide do tamanho que a instrução pede cabe com folga.
+  // Com a manchete medida, o slide de conteúdo no PIOR caso do schema (manchete de 70 e corpo de 300,
+  // em caixa alta) não cabe em modo nenhum. O aviso existe para isto, e diz "corta sempre": o operador
+  // encurta. Um slide do tamanho que a instrução pede cabe com o espaço.
   it("o conteúdo no pior caso do schema é acusado como 'corta sempre', e o tamanho comum cabe com o espaço", () => {
-    const slideDe = (titulo: string, texto: string): SlideParaArte => ({
-      numero: 2,
-      total: 3,
-      tipo: "conteudo",
-      titulo,
-      texto,
+    const pior = slide("conteudo", textoDe(TETOS.conteudo, true), textoDe(TITULO_MAX, true));
+    expect(slidesQueNaoCabem([pior])).toEqual([{ numero: 1, tipo: "conteudo", cortaSempre: true }]);
+    expect(slidesQueNaoCabem([slide("conteudo", textoDe(200), textoDe(40))])).toEqual([]);
+  });
+
+  // O post de uma imagem: texto, linha em branco e chamada. No teto do schema em caixa alta ele não
+  // cabe nem sem o espaço, e o aviso diz; em texto corrido, cabe sem o espaço.
+  it("o post no teto do schema cabe sem o espaço em texto corrido, e em caixa alta é acusado", () => {
+    const post = (caixaAlta: boolean): SlideParaArte => ({
+      numero: 1,
+      total: 1,
+      tipo: "cta",
+      titulo: null,
+      texto: `${textoDe(PostDoChatSchema.shape.texto.maxLength!, caixaAlta)}\n\n${textoDe(TETOS.cta, caixaAlta)}`,
       assinaturaNoPe: false,
     });
-    const pior = slideDe("x".repeat(TITULO_MAX), "x".repeat(TETOS.conteudo));
-    expect(slidesQueNaoCabem([pior])).toEqual([{ numero: 1, tipo: "conteudo", linhas: 2, cortaSempre: true }]);
-    expect(slidesQueNaoCabem([slideDe("x".repeat(40), "x".repeat(200))])).toEqual([]);
-  });
-
-  it("o post de uma imagem cabe no pior caso: texto, linha em branco e chamada", () => {
-    const pior = "x".repeat(PostDoChatSchema.shape.texto.maxLength! + TETOS.cta + 2);
-    expect(alturaEstimada(pior, tamanhoDoTexto("cta", pior, false))).toBeLessThanOrEqual(ALTURA_TEXTO_SEM_ILUSTRACAO);
-  });
-});
-
-describe("a previsão de altura conta as quebras de linha", () => {
-  it("um texto quebrado ocupa MAIS que o mesmo texto corrido", () => {
-    expect(alturaEstimada("x".repeat(50) + "\n" + "x".repeat(50), 40)).toBeGreaterThan(alturaEstimada("x".repeat(100), 40));
-  });
-
-  it("cada bloco ocupa ao menos uma linha, e a linha em branco também", () => {
-    expect(alturaEstimada(Array(5).fill("ok").join("\n"), 40)).toBe(5 * 40 * 1.32);
-    expect(alturaEstimada(["um", "dois", "tres", "quatro", "cinco"].join("\n\n"), 40)).toBe(9 * 40 * 1.32);
+    expect(tamanhoDoSlide(post(false), false).cabe).toBe(true);
+    expect(slidesQueNaoCabem([post(true)])).toEqual([{ numero: 1, tipo: "cta", cortaSempre: true }]);
   });
 });
 
 describe("slidesQueNaoCabem", () => {
-  const slide = (texto: string): SlideParaArte[] => [
+  const um = (texto: string): SlideParaArte[] => [
     { numero: 1, total: 1, tipo: "conteudo", titulo: null, texto, assinaturaNoPe: false },
   ];
 
   it("silencia quando cabe", () => {
-    expect(slidesQueNaoCabem(slide("x".repeat(200)))).toEqual([]);
+    expect(slidesQueNaoCabem(um(textoDe(200)))).toEqual([]);
   });
 
+  // No piso, com o espaço, cabem 7 linhas (7 × 45 = 315 de 334); a 8ª já não.
   it("acusa o que não cabe nem no piso, e distingue 'corta só com o espaço' de 'corta sempre'", () => {
-    const dez = Array(10).fill("x".repeat(17)).join("\n");
-    expect(slidesQueNaoCabem(slide(dez))).toEqual([{ numero: 1, tipo: "conteudo", linhas: 10, cortaSempre: false }]);
+    const oito = Array(8).fill("x".repeat(20)).join("\n");
+    expect(slidesQueNaoCabem(um(oito))).toEqual([{ numero: 1, tipo: "conteudo", cortaSempre: false }]);
     const trinta = Array(30).fill("x".repeat(17)).join("\n");
-    expect(slidesQueNaoCabem(slide(trinta))[0].cortaSempre).toBe(true);
+    expect(slidesQueNaoCabem(um(trinta))[0].cortaSempre).toBe(true);
   });
 
   it("cala no que passou a caber porque a fonte desce um degrau", () => {
-    const oito = Array(8).fill("x".repeat(22)).join("\n");
-    expect(tamanhoDoTexto("conteudo", oito)).toBe(34);
-    expect(slidesQueNaoCabem(slide(oito))).toEqual([]);
+    const sete = Array(7).fill("x".repeat(22)).join("\n");
+    expect(fonte(um(sete)[0])).toBe(34);
+    expect(slidesQueNaoCabem(um(sete))).toEqual([]);
   });
 });
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-arte-composicao.test.ts tests/bonus-arte-medida.test.ts tests/bonus-arte-slides.test.ts
```

Esperado: os três arquivos caem: os da composição e da conta sem rodar caso nenhum (`Cannot find package`), e o dos slides com 13 dos 23 casos (`tamanhoDoSlide` não existe).

- [ ] **Passo 3: a geometria conhece todo número que ocupa lugar**

Em `lib/bonus/arte-geometria.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/arte-geometria.ts b/lib/bonus/arte-geometria.ts
index 7ed743a..f328c02 100644
--- a/lib/bonus/arte-geometria.ts
+++ b/lib/bonus/arte-geometria.ts
@@ -1,131 +1,81 @@
-// TRAZIDO DO MÉTODO LABS COMO ESTÁ (site-ia, src/lib/ia/geometria-da-arte.ts, mudado por último
-// em 19d25be, igual em 45bc973 e em a56459b). DOIS DONOS: mudança aqui se avisa ao Labs, e a de
-// lá se traz para cá (docs/specs/2026-10-01-arte-do-carrossel.md, "Dois donos"). Abaixo, o
-// arquivo de lá sem mudar uma linha; os caminhos citados nos comentários são os do Labs. No Chat,
-// a "ilustração" é o espaço em branco que o operador reserva para pôr a imagem no Canva.
+// A GEOMETRIA DA PEÇA: todo número que ocupa lugar na arte, do qual o desenho (arte-desenho.tsx) e a
+// conta do "não cabe" (arte-medida.ts) leem. VEIO DO MÉTODO LABS (site-ia,
+// src/lib/ia/geometria-da-arte.ts, em 45bc973) e deixou de ser cópia na Etapa 4 do gerador
+// (docs/specs/2026-10-02-pagina-do-carrossel.md, "O não cabe"): os espaços que só o desenho
+// conhecia vieram para cá, e a conta passou a medir a largura real de cada letra. DOIS DONOS: o
+// mesmo resultado nos dois projetos é conferido pelos vetores (tests/vetores-da-arte.json), e não
+// por código igual. Mudança aqui que muda um vetor se combina com o Labs.
 //
-// A GEOMETRIA DA PEÇA — fonte única dos números que a arte desenha e o teste prevê.
-//
-// ⚠️ **EXISTE PORQUE ESTES NÚMEROS ESTAVAM EM DOIS LUGARES.** Até 04/09 a rota da arte
-// (`admin/carrossel/arte/route.tsx`) e a asserção de cabimento (`slides.test.ts`) declaravam
-// cada uma a sua cópia: 1080, 1350, 110 e `1.32`. Nada obrigava as duas a concordarem.
-//
-// O estrago dessa duplicação é específico e silencioso: a asserção de cabimento existe para
-// dizer "este texto NÃO corta o PNG". Ela chega a esse veredito calculando com a SUA cópia
-// dos números. Se alguém mudasse a margem na arte para 120 e não aqui, o teste continuaria
-// verde prevendo com 110 — dando garantia sobre uma peça que já não é a que se desenha.
-//
-// Não é hipótese distante: a régua de largura do caractere já esteve errada por horas em
-// 03/09 (achado 22.13), e o sintoma foi exatamente esse — verde que cobria mais casos e
-// garantia menos.
+// ⚠️ EXISTE PORQUE ESTES NÚMEROS JÁ ESTIVERAM EM DOIS LUGARES. No Labs, até 04/09, a rota da arte e o
+// teste de cabimento tinham cada um a sua cópia de 1080, 1350, 110 e 1,32; e até 02/10, os espaços
+// entre o texto, a manchete e o espaço da imagem viviam só no desenho, sem `export`. A conta os
+// ignorava, e o texto que ela aceitava no limite invadia a margem de baixo (achado 70).
 
-/** 1080×1350 é o 4:5 do feed: o formato mais alto que o Instagram aceita, e portanto o que
- *  ocupa mais tela no celular de quem rola. É também a tela do pipeline dele. */
+/** 1080×1350 é o 4:5 do feed: o formato mais alto que o Instagram aceita. */
 export const LARGURA = 1080;
 export const ALTURA = 1350;
 
-/**
- * A margem dos quatro lados.
- *
- * ⚠️ **110, e não 64.** É número do manual da casa, não gosto — a margem larga é o que faz a
- * peça respirar no feed, e é visível na comparação lado a lado. Encolher aqui aproxima o
- * slide de "panfleto" e afasta do que já está publicado no perfil.
- */
+/** A margem dos quatro lados. 110, e não 64: é número do manual da casa, e é o que faz a peça respirar. */
 export const MARGEM = 110;
 
-/** Entrelinha. Quem precisar da altura de uma linha multiplica por isto. */
+/** Entrelinha: o desenho a passa ao Satori, que a multiplica pela fonte e arredonda (`alturaDaLinha`). */
 export const ENTRELINHA = 1.32;
 
 /** O que sobra de largura entre as margens. */
 export const LARGURA_UTIL = LARGURA - MARGEM * 2;
 
-/**
- * A ilustração ocupa 3:2 — a proporção que a API de imagem gera.
- *
- * Se alguém "arredondar" este valor, a imagem volta a ser cortada. Mudou a proporção que a
- * API oferece? Mude aqui junto.
- */
+/** O espaço da imagem ocupa 3:2, a proporção que a API de imagem gera. */
 export const ALTURA_ILUSTRACAO = Math.round((LARGURA_UTIL * 2) / 3);
 
-/**
- * ⚠️ **ESTIMATIVA, e a única desta lista.** O cabeçalho (avatar + nome + respiro) não tem
- * constante na arte: a altura dele é o que o Satori renderiza. 175 é a medida observada, e
- * está aqui para a previsão de cabimento ter de onde descontar.
- *
- * Consequência: um cabeçalho que cresça de verdade sem este número acompanhar faz a previsão
- * ficar OTIMISTA — ela acha que há mais espaço do que há. É por isso que ela é estimativa
- * declarada e não constante compartilhada: ninguém deve confiar nela como fato.
- */
-export const CABECALHO_ESTIMADO = 175;
+/** O lado da foto (ou das iniciais) do cabeçalho: é o mais alto da tag, mais que o nome e o @ juntos. */
+export const LADO_DO_AVATAR = 127;
 
-/** Altura útil para texto quando o slide NÃO tem ilustração. */
-export const ALTURA_TEXTO_SEM_ILUSTRACAO = ALTURA - MARGEM * 2 - CABECALHO_ESTIMADO;
+/** Da tag ao texto: do fim do cabeçalho até a primeira linha, ou do texto até a tag no pé. */
+export const GAP_CABECALHO = 48;
 
-/** Altura útil quando tem — menos de metade da anterior, e é aí que o texto corta. */
-export const ALTURA_TEXTO_COM_ILUSTRACAO = ALTURA_TEXTO_SEM_ILUSTRACAO - ALTURA_ILUSTRACAO;
+/** Do fim do texto até o topo do espaço da imagem, pela simetria com o cabeçalho (Labs, 39.2). */
+export const GAP_ILUSTRACAO = 48;
 
-/**
- * Largura média de um caractere, em `em`, para prever quantos cabem numa linha.
- *
- * ⚠️ **0,5538 É A LARGURA DE MAIÚSCULAS, E O PIOR CASO É DE PROPÓSITO.** Medida no TTF da
- * Carlito: prosa média dá 0,4183, minúsculas 0,4559, MAIÚSCULAS 0,5538.
- *
- * Em 03/09 este número foi trocado por 0,4183 — a média medida — e o efeito foi um teste que
- * cobria mais casos e garantia menos: um gancho de 120 caracteres com ilustração dava 317px
- * de 382 pela média, e 396 na largura real de maiúsculas. Ou seja, **passava no teste e
- * cortava o PNG**.
- *
- * A lição não é "medir é ruim". É que medição responde *quanto costuma ser*, e previsão de
- * cabimento precisa de *quanto pode ser no pior caso plausível*. São perguntas diferentes.
- * Gancho de Instagram em caixa alta é plausível, e a aba de colar aceita qualquer texto.
- */
-export const LARGURA_DO_CARACTERE = 0.5538;
+/** Da manchete ao corpo, medido como AVANÇO TOTAL (a linha da manchete e o espaço dela), e não como espaço extra. */
+export const AVANCO_MANCHETE = 77;
+
+/** Entre parágrafos do corpo, inclusive antes da linha de fechamento. */
+export const GAP_PARAGRAFO = 41;
+
+/** O espaçamento das letras no negrito, em px por glifo: o negrito sai 0,4px mais apertado. */
+export const ESPACAMENTO_DO_NEGRITO = -0.4;
+
+/** A tag com o respiro até o texto. Nos dois lugares da tag, topo ou pé, ela tira esta altura do texto. */
+export const ALTURA_DO_CABECALHO = LADO_DO_AVATAR + GAP_CABECALHO;
+
+/** Altura útil para texto quando o slide NÃO tem o espaço da imagem. */
+export const ALTURA_TEXTO_SEM_ILUSTRACAO = ALTURA - MARGEM * 2 - ALTURA_DO_CABECALHO;
 
 /**
- * Quantos pixels de altura um texto ocupa nesta fonte — a previsão que decide se corta.
- *
- * É uma ESTIMATIVA, não o que o Satori faz: ele quebra em palavras, não em caracteres, então
- * o valor real varia. Ela erra para o lado seguro por usar a largura de maiúsculas.
+ * Altura útil quando tem: menos o espaço e menos o respiro de 48 que o desenho põe acima dele. 334,
+ * e não os 382 de antes: a conta não descontava o respiro, e o texto no limite invadia a margem.
  */
-export function alturaEstimada(texto: string, fonte: number): number {
-  const porLinha = LARGURA_UTIL / (fonte * LARGURA_DO_CARACTERE);
-
-  // ⚠️ **CONTA CADA BLOCO SEPARADO, e não o texto inteiro de uma vez.** Uma quebra de linha
-  // força o fim da linha antes de ela encher — dividir o total de caracteres pela capacidade
-  // de uma linha ignora isso e devolve MENOS linhas do que se desenha.
-  //
-  // Medido em 04/09 na fase 22.4, contra uma geração real do modelo: em 7 dos 8 slides com
-  // quebra a conta antiga errava para baixo, e no pior (uma lista de cinco marcadores) dizia
-  // 5 linhas onde havia 7 — 264px previstos contra 370 reais, num limite de 382. Passou por
-  // doze pixels.
-  //
-  // O erro era todo para o lado OTIMISTA, que é o lado que deixa cortar. E não era caso
-  // raro: o modelo escreveu com quebra em 8 dos 10 slides, porque lista e frase de efeito
-  // isolada são o formato natural de carrossel.
-  // ⚠️ `split("\n")` E NÃO `/\n+/` — o `+` colapsaria quebras consecutivas, e **a linha em
-  // branco ocupa altura na peça**. Uma lista de cinco itens separados por linha em branco tem
-  // 9 linhas e 5 pelo `+`: 475px reais contra 264 previstos, num limite de 382.
-  //
-  // ⚠️ **O QUE ELA OCUPA NÃO É UMA LINHA CHEIA, e este comentário dizia que era.** A arte
-  // quebra o texto em blocos por `\n{2,}` e separa cada um por `GAP_PARAGRAFO` (41px), então
-  // a linha em branco vira 41 e não `fonte × 1.32` (52,8 em corpo 40). A conta aqui segue
-  // cobrando a linha cheia **de propósito**: a diferença é de ~12px por parágrafo e cai toda
-  // para o lado conservador, que é o lado que não deixa cortar.
-  //
-  // A justificativa velha citava `whiteSpace: "pre-wrap"` desenhando a linha vazia — e isso
-  // nunca aconteceu: o `split(/\n{2,}/)` consumia a quebra dupla antes de o `pre-wrap` ver.
-  // A conta estava certa pelo motivo errado, e o motivo errado foi corrigido em 21/09, junto
-  // do conserto da sobreposição que tirou o `pre-wrap` da arte.
-  //
-  // O `Math.max(1, …)` é o que faz o bloco vazio contar 1: `Math.ceil(0 / porLinha)` é 0.
-  const linhas = texto
-    .split("\n")
-    .reduce((total, bloco) => total + Math.max(1, Math.ceil(bloco.length / porLinha)), 0);
-
-  return linhas * fonte * ENTRELINHA;
-}
+export const ALTURA_TEXTO_COM_ILUSTRACAO = ALTURA_TEXTO_SEM_ILUSTRACAO - ALTURA_ILUSTRACAO - GAP_ILUSTRACAO;
 
-/** A altura disponível para texto, conforme o slide tenha ou não ilustração. */
+/** A altura útil para texto, conforme o slide tenha ou não o espaço da imagem. */
 export function alturaDisponivel(comIlustracao: boolean): number {
   return comIlustracao ? ALTURA_TEXTO_COM_ILUSTRACAO : ALTURA_TEXTO_SEM_ILUSTRACAO;
 }
+
+/** A altura de uma linha de texto: o Satori arredonda fonte × entrelinha, linha a linha (46 → 61, 34 → 45). */
+export function alturaDaLinha(fonte: number): number {
+  return Math.round(fonte * ENTRELINHA);
+}
+
+/** O que vai acima de uma linha: nada, o que falta da manchete até o avanço dela, ou o intervalo de parágrafo. */
+export type EspacoAntes = "nada" | "manchete" | "paragrafo";
+
+/**
+ * O espaço acima de uma linha, em px. O da manchete completa o avanço de 77: numa manchete de uma
+ * linha, a linha e o espaço somam 77; a 86px a linha já passa de 77, e o espaço é zero.
+ */
+export function espacoAntes(antes: EspacoAntes, fonte: number): number {
+  if (antes === "paragrafo") return GAP_PARAGRAFO;
+  if (antes === "manchete") return Math.max(0, AVANCO_MANCHETE - alturaDaLinha(fonte));
+  return 0;
+}
```

- [ ] **Passo 4: a composição**

Crie `lib/bonus/arte-composicao.ts`:

```ts
// A COMPOSIÇÃO DO SLIDE: as linhas que o desenho desenha (arte-desenho.tsx) e a conta do "não cabe"
// mede (arte-medida.ts), cada uma com o texto, o peso, o espaçamento e o espaço acima. PURA, e roda
// no navegador. É a mesma função nos dois, e não duas leituras da mesma regra: antes, a regra do
// negrito vivia no desenho, e a conta media um texto montado à parte, que já divergiu do desenho no
// Labs (o aviso de 1254847). A 48.1 e a 48.4 do Labs fazem o mesmo do lado de lá.
//
// ⚠️ A NORMALIZAÇÃO MORA AQUI E RODA UMA VEZ, combinada com o Labs em 02/10 (spec da Etapa 4, "Dois
// donos"). O desenho e a conta recebem o texto pronto e não normalizam por conta própria:
// - NFC: o Satori põe o espaçamento do negrito por glifo, e o acento em NFD é um glifo a mais;
// - as sete quebras obrigatórias do quebrador do Satori (\r\n, \r, \v, \f, NEL, U+2028, U+2029)
//   viram \n: sem isso, ele quebraria a linha sem a conta ver;
// - em cada linha, espaços e tabs seguidos viram um espaço e as pontas saem (`trim`), que é o que o
//   Satori faria de qualquer jeito;
// - parágrafo é a linha vazia, contada DEPOIS disso: a linha só de espaços também separa;
// - a manchete perde as quebras (o Satori as trocaria por espaço), e só de espaços não é manchete.
import { ESPACAMENTO_DO_NEGRITO, type EspacoAntes } from "./arte-geometria";

/** Uma linha da arte, já normalizada: o Satori a quebra na largura, mas não muda o texto. */
export type LinhaDaArte = { texto: string; negrito: boolean; espacamento: number; antes: EspacoAntes };

const QUEBRAS = /\r\n|[\r\n\u000B\u000C\u0085\u2028\u2029]/g;

function normalizarLinha(linha: string): string {
  return linha.replace(/[ \t]+/g, " ").trim();
}

/** Os parágrafos do corpo: linhas não vazias seguidas, separadas por uma ou mais linhas vazias. */
function paragrafos(texto: string): string[][] {
  const blocos: string[][] = [];
  let atual: string[] = [];
  for (const linha of texto.normalize("NFC").replace(QUEBRAS, "\n").split("\n").map(normalizarLinha)) {
    if (linha) atual.push(linha);
    else if (atual.length) {
      blocos.push(atual);
      atual = [];
    }
  }
  if (atual.length) blocos.push(atual);
  return blocos;
}

export function composicaoDoSlide(titulo: string | null, texto: string): LinhaDaArte[] {
  const manchete = normalizarLinha((titulo ?? "").normalize("NFC").replace(QUEBRAS, " "));
  const blocos = paragrafos(texto);
  const linha = (t: string, negrito: boolean, antes: EspacoAntes): LinhaDaArte => ({
    texto: t,
    negrito,
    espacamento: negrito ? ESPACAMENTO_DO_NEGRITO : 0,
    antes,
  });

  const linhas: LinhaDaArte[] = manchete ? [linha(manchete, true, "nada")] : [];
  blocos.forEach((bloco, i) => {
    // O negrito vai no ÚLTIMO bloco quando há fechamento (mais de um bloco), e no bloco único sem
    // manchete: o gancho e a chamada, em que o texto É a peça.
    const negrito = i === blocos.length - 1 && (blocos.length > 1 || !manchete);
    bloco.forEach((t, j) => {
      const antes: EspacoAntes = j > 0 ? "nada" : i > 0 ? "paragrafo" : manchete ? "manchete" : "nada";
      linhas.push(linha(t, negrito, antes));
    });
  });
  return linhas;
}
```

- [ ] **Passo 5: a conta exata**

Crie `lib/bonus/arte-medida.ts`:

```ts
// A CONTA DO "NÃO CABE": quantas linhas o Satori dá a cada linha da composição (arte-composicao.ts) e
// quanto a composição ocupa de altura, sem desenhar. PURA, e roda no navegador (o aviso do editor).
//
// ⚠️ É A QUEBRA DO SATORI, REFEITA, e não uma estimativa (spec da Etapa 4, "A largura real de cada
// letra"; a 48.4 do Labs). A conta de antes media toda letra pela largura média das maiúsculas e não
// via a quebra por palavra; em caixa alta e fonte grande ela previa uma linha a menos, e o texto que
// ela aceitava no limite invadia a margem (achado 70). Lido no Satori 0.25.0 do og do Next 16.3.8
// (node_modules/next/dist/compiled/@vercel/og/index.node.js), e é isso que a conta repete:
// - a largura de um texto é a soma da largura de cada grafema, medido SOZINHO (por isso o kerning
//   nunca entra); a do grafema é, glifo a glifo, avanço × (1 / unidades por em × fonte), mais
//   (espaçamento / fonte) × fonte, nesta ordem de operações, que é a do opentype.js;
// - o grafema com algum caractere fora da fonte vale 1em, sem espaçamento: o emoji vira imagem do
//   tamanho da fonte. O caractere sem desenho que não é emoji vai buscar fonte na rede, e aí a conta
//   é aproximada;
// - a palavra que o quebrador entrega leva os espaços do fim, e cabe na linha quando
//   linha + palavra ≤ largura útil + espaços do fim dela (igual cabe);
// - a palavra mais larga que a linha não quebra (a arte não pede `wordBreak`) e vaza pela direita;
// - cada linha quebrada ocupa `alturaDaLinha`.
//
// ⚠️ ONDE A CONTA SÓ ERRA PARA O LADO SEGURO: o quebrador do Satori também quebra DENTRO da palavra,
// depois do hífen entre letras, em volta do travessão e do emoji colados, e depois de ? / … seguidos
// de letra. A conta só quebra no espaço. Com menos pontos de quebra, a quebra gulosa nunca termina
// uma linha antes, então a conta nunca prevê menos linhas que o desenho. Os vetores
// (tests/vetores-da-arte.json) marcam esses textos como "conservadores".
import type { LinhaDaArte } from "./arte-composicao";
import { alturaDaLinha, espacoAntes, LARGURA_UTIL } from "./arte-geometria";
import { FAIXAS_DE_LARGURA, UNIDADES_POR_EM } from "./arte-larguras";

type Avancos = Map<number, number>;
let avancos: { regular: Avancos; negrito: Avancos } | null = null;

function tabela(negrito: boolean): Avancos {
  if (!avancos) {
    const regular: Avancos = new Map();
    const deNegrito: Avancos = new Map();
    for (const [inicio, valores] of FAIXAS_DE_LARGURA) {
      for (let i = 0; i < valores.length / 2; i++) {
        regular.set(inicio + i, valores[2 * i]);
        deNegrito.set(inicio + i, valores[2 * i + 1]);
      }
    }
    avancos = { regular, negrito: deNegrito };
  }
  return negrito ? avancos.negrito : avancos.regular;
}

const grafemas = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** A largura que o Satori dá a um texto numa linha, em px. */
export function larguraDoTexto(texto: string, fonte: number, negrito: boolean, espacamento: number): number {
  const avancosDaFonte = tabela(negrito);
  const escala = (1 / UNIDADES_POR_EM) * fonte;
  let largura = 0;
  for (const { segment } of grafemas.segment(texto)) {
    let grafema = 0;
    for (const c of segment) {
      const unidades = avancosDaFonte.get(c.codePointAt(0)!);
      if (unidades === undefined) {
        grafema = fonte;
        break;
      }
      grafema += unidades * escala;
      if (espacamento) grafema += (espacamento / fonte) * fonte;
    }
    largura += grafema;
  }
  return largura;
}

/** Não quebra antes destes, mesmo depois de espaço (UAX#14, LB13). */
const COLAM_ANTES = new Set([..."!),./:;?]}"]);
/** Não quebra depois destes, mesmo antes de espaço (LB14). */
const ABREM = new Set([..."([{\u00A1\u00BF\u201E\u201A"]);
/** As aspas: entre elas e um dos que abrem, não quebra (LB15). */
const ASPAS = new Set([..."\"'\u00AB\u00BB\u201C\u201D\u2018\u2019\u2039\u203A"]);
const TRAVESSAO = "\u2014";

/**
 * O quebrador do Satori deixa quebrar neste espaço? Medido no quebrador dele (o do pacote linebreak,
 * dentro do og), em 02/10, com todos os pares de 230 caracteres em volta de um espaço: só estes quatro
 * casos colam.
 */
function quebraNoEspaco(antes: string, depois: string): boolean {
  if (COLAM_ANTES.has(depois) || ABREM.has(antes)) return false;
  if (ASPAS.has(antes) && ABREM.has(depois)) return false;
  return !(antes === TRAVESSAO && depois === TRAVESSAO);
}

/**
 * Os pedaços em que a linha pode quebrar, cada um com o espaço do fim, como o quebrador os entrega.
 * Recebe o texto da composição, que não tem espaço duplo nem nas pontas.
 */
export function pedacosDaLinha(texto: string): string[] {
  const partes = texto.split(" ");
  const pedacos: string[] = [];
  let atual = partes[0];
  for (const parte of partes.slice(1)) {
    if (quebraNoEspaco(Array.from(atual).at(-1) ?? "", Array.from(parte)[0] ?? "")) {
      pedacos.push(`${atual} `);
      atual = parte;
    } else atual += ` ${parte}`;
  }
  if (atual) pedacos.push(atual);
  return pedacos;
}

/** Em quantas linhas o Satori quebra uma linha da composição, e se alguma palavra vaza pela direita. */
export function quebraDaLinha(linha: LinhaDaArte, fonte: number): { linhas: number; vaza: boolean } {
  const medir = (t: string) => larguraDoTexto(t, fonte, linha.negrito, linha.espacamento);
  let linhas = 0;
  let ocupado = 0;
  let vaza = false;
  for (const pedaco of pedacosDaLinha(linha.texto)) {
    const largura = medir(pedaco);
    const semFim = pedaco.trimEnd() === pedaco ? largura : medir(pedaco.trimEnd());
    if (semFim > LARGURA_UTIL) vaza = true;
    if (linhas > 0 && ocupado + largura > LARGURA_UTIL + (largura - semFim)) {
      linhas++;
      ocupado = largura;
    } else {
      linhas = Math.max(linhas, 1);
      ocupado += largura;
    }
  }
  return { linhas, vaza };
}

/** A altura que o desenho dá à composição nesta fonte, e se alguma palavra vaza pela direita. */
export function medidaDaComposicao(linhas: LinhaDaArte[], fonte: number): { altura: number; vaza: boolean } {
  let altura = 0;
  let vaza = false;
  for (const linha of linhas) {
    const q = quebraDaLinha(linha, fonte);
    altura += espacoAntes(linha.antes, fonte) + q.linhas * alturaDaLinha(fonte);
    vaza ||= q.vaza;
  }
  return { altura, vaza };
}
```

- [ ] **Passo 6: os slides, o desenho e a resposta passam a usar a composição**

Em `lib/bonus/arte-slides.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/arte-slides.ts b/lib/bonus/arte-slides.ts
index 4ce5302..24d6965 100644
--- a/lib/bonus/arte-slides.ts
+++ b/lib/bonus/arte-slides.ts
@@ -1,13 +1,15 @@
-// TRAZIDO DO MÉTODO LABS (site-ia, src/lib/ia/slides.ts, mudado por último em 19d25be, igual em
-// 45bc973 e em a56459b). DOIS DONOS: mudança aqui se avisa ao Labs, e a de lá se traz para cá
-// (docs/specs/2026-10-01-arte-do-carrossel.md, "Dois donos"). Os degraus, o piso e o fator sem
-// ilustração são os de lá, sem mudar um número. O que muda:
+// VEIO DO MÉTODO LABS (site-ia, src/lib/ia/slides.ts, em 45bc973). DOIS DONOS: o mesmo resultado nos
+// dois projetos é conferido pelos vetores (tests/vetores-da-arte.json), e não por código igual
+// (spec da Etapa 4, "Dois donos"). O piso e o fator sem ilustração são os de lá. O que muda:
 // - a entrada é o texto do Chat (carrossel-texto.ts): `chamada` no lugar de `chamadaParaAcao`, e
 //   `slidesDoTexto` escolhe entre o carrossel e o post;
-// - `slidesQueNaoCabem` mede `textoMedido` (a manchete e o corpo), como a arte desenha.
+// - a escolha da fonte mede a composição (arte-composicao.ts), a mesma que a arte desenha, com a
+//   conta exata (arte-medida.ts), e o gancho tem o degrau de 46 (os dois, Etapa 4 aqui e 48 lá).
 // No Chat, a "ilustração" é o espaço em branco que o operador reserva para a imagem do Canva.
 //
-import { alturaDisponivel, alturaEstimada } from "./arte-geometria";
+import { composicaoDoSlide } from "./arte-composicao";
+import { alturaDisponivel } from "./arte-geometria";
+import { medidaDaComposicao } from "./arte-medida";
 import type { TextoDeCarrossel, TextoDePost, TextoDoCarrossel } from "./carrossel-texto";
 
 // O carrossel gerado vira uma LISTA DE SLIDES para desenhar.
@@ -105,18 +107,6 @@ export function slidesDoTexto(t: TextoDoCarrossel): SlideParaArte[] {
   return t.tipo === "post" ? slidesDoPost(t) : slidesParaArte(t);
 }
 
-/**
- * O TEXTO QUE A ARTE MEDE, que é o que ela desenha: a manchete e o corpo, no mesmo corpo
- * tipográfico (a rota do Labs mede assim). ⚠️ DIFERENTE DO LABS, de propósito: lá
- * `slidesQueNaoCabem` mede só o corpo, e um slide de conteúdo com manchete comprida podia cortar
- * na imagem com o aviso calado. Aqui a fonte da arte e o aviso medem este mesmo texto. A manchete
- * vai aparada, e só de espaços não conta: o conserto do Labs fez o mesmo (dev 1254847, 01/10).
- */
-export function textoMedido(s: SlideParaArte): string {
-  const titulo = s.titulo?.trim();
-  return titulo ? `${titulo}\n${s.texto}` : s.texto;
-}
-
 /**
  * Quanto o texto cresce quando o slide NÃO tem ilustração — **por tipo de slide**.
  *
@@ -142,24 +132,6 @@ const FATOR_SEM_ILUSTRACAO: Record<TipoDeSlide, number> = {
   cta: 1.35,
 };
 
-/**
- * Tamanho da fonte do texto, em pixels, para o slide 1080×1350.
- *
- * ⚠️ `comIlustracao` decide se o texto divide o slide com a imagem ou fica com ele inteiro.
- * Antes o espaço da ilustração era reservado SEMPRE, mesmo vazio: um slide só de texto
- * desperdiçava 635px de altura e ficava com a fonte pequena sem motivo. Achado pelo Eduardo
- * em 02/09.
- *
- * POR QUE NÃO É FIXO: o gancho tem até 120 caracteres e o texto de um slide até ~280. Com
- * um tamanho só, ou o gancho fica pequeno demais para o que ele precisa fazer (parar o
- * dedo em menos de um segundo), ou o texto longo transborda a arte — e transbordar não dá
- * erro, só corta a frase no meio sem avisar.
- *
- * Os degraus são largos de propósito: variação suave por caractere deixaria cada slide com
- * um tamanho ligeiramente diferente, e a sequência inteira pareceria trêmula ao passar.
- */
-/**
- * Todos os tamanhos que a escada abaixo pode devolver, do maior ao menor.
 /**
  * Os degraus de cada tipo, do maior ao menor. **A escolha e o MAIOR QUE COUBER.**
  *
@@ -187,24 +159,22 @@ const FATOR_SEM_ILUSTRACAO: Record<TipoDeSlide, number> = {
 const DEGRAUS_POR_TIPO: Record<TipoDeSlide, readonly number[]> = {
   // 86 para o gancho curto, 72 ate 80 caracteres.
   //
-  // ⚠️ O MENOR ERA 60 E CORTAVA (22.13): com a ilustracao no slide sobram 382px, e um gancho
-  // de 120 caracteres em caixa alta ocupa 5 linhas de 60px = 396. O PNG saia cortado sem erro
-  // nenhum. Em 56 a mesma frase ocupa 370.
-  gancho: [86, 72, 56],
+  // ⚠️ O MENOR ERA 60 E CORTAVA (22.13): um gancho de 120 caracteres em caixa alta ocupava 5
+  // linhas de 60px. O PNG saia cortado sem erro nenhum.
+  //
+  // ⚠️ O 46 ENTROU NA ETAPA 4 (decisao do Eduardo, 02/10): com os 334px que sobram de fato com o
+  // espaco da imagem, as 5 linhas de 56 do gancho longo nao cabem, e sem o 46 ele cairia direto
+  // no piso de 34.
+  gancho: [86, 72, 56, 46],
 
   // O slide do meio parte de 46 — e nunca foi maior: manchete e corpo tem o MESMO corpo
   // tipografico nas pecas publicadas, e a hierarquia da casa e por PESO.
   conteudo: [46, 40, 34],
 
-  // ⚠️ 46 E NAO 48, pelo mesmo motivo do gancho: 200 caracteres em caixa alta ocupavam 7
-  // linhas de 48px = 443, contra 382 disponiveis. Em 46 cabem em 6 linhas = 364. O degrau e
-  // sensivel — 47 ja volta para 7 linhas e transborda.
+  // ⚠️ 46 E NAO 48, e 40 E NAO 42: os dois cortavam no Labs com a conta de antes (22.13).
   //
   // ⚠️ OS DOIS MENORES SO O POST DE UMA IMAGEM ALCANCA. A chamada de um carrossel para em 200
   // caracteres (schema); o post unico chega a ~550 contando o pedido opcional.
-  //
-  // ⚠️ 40 ERA 42 E CORTAVA (22.13): sem ilustracao o fator 1,35 levava a 57, e 350 caracteres
-  // ocupavam 978px contra 955. Em 40 ficam 927.
   cta: [60, 46, 40, 34],
 };
 /**
@@ -216,7 +186,17 @@ const DEGRAUS_POR_TIPO: Record<TipoDeSlide, readonly number[]> = {
  */
 const PISO_DE_LEGIBILIDADE = 34;
 
-export function tamanhoDoTexto(tipo: TipoDeSlide, texto: string, comIlustracao = true): number {
+/** A fonte do slide, e se o texto cabe nela. Se nem no piso couber, a fonte é o piso. */
+export type TamanhoDoSlide = { fonte: number; cabe: boolean };
+
+/**
+ * Tamanho da fonte do slide, em pixels, para a peça 1080×1350, com ou sem o espaço da imagem.
+ *
+ * POR QUE NÃO É FIXO: o gancho tem até 120 caracteres e o texto de um slide até ~280. Com um tamanho
+ * só, ou o gancho fica pequeno demais para parar o dedo, ou o texto longo transborda a arte. Os
+ * degraus são largos de propósito: variação de 1 em 1 deixaria a sequência trêmula ao passar.
+ */
+export function tamanhoDoSlide(s: SlideParaArte, comIlustracao: boolean): TamanhoDoSlide {
   // ⚠️ **O MAIOR DEGRAU DO TIPO QUE COUBER, e nada mais decide isto.**
   //
   // Duas reguas viviam aqui e discordavam. Uma escada por NUMERO DE CARACTERES escolhia o
@@ -241,24 +221,41 @@ export function tamanhoDoTexto(tipo: TipoDeSlide, texto: string, comIlustracao =
   // tamanho ligeiramente diferente e a sequencia pareceria tremula ao passar o dedo. E a
   // lista e a DO TIPO: um conteudo curto nao sobe ate 86px, que e o corpo do gancho.
   //
-  // ⚠️ **E PARA NO PISO DE 34, sem furar.** Se nem no piso couber, devolve o piso e quem avisa
-  // e `slidesQueNaoCabem`. Resolver "cabe" encolhendo ate ninguem ler e o que a decisao de
-  // 03/09 recusou — ela preferiu baixar o teto do schema de 350 para 300.
-  const escala = (d: number) => (comIlustracao ? d : Math.round(d * FATOR_SEM_ILUSTRACAO[tipo]));
+  // ⚠️ **E PARA NO PISO DE 34, sem furar.** Se nem no piso couber, devolve o piso com `cabe: false`,
+  // e quem avisa e `slidesQueNaoCabem`. Resolver "cabe" encolhendo ate ninguem ler e o que a decisao
+  // de 03/09 recusou — ela preferiu baixar o teto do schema de 350 para 300.
+  //
+  // ⚠️ MEDE A COMPOSICAO, a mesma que o desenho desenha (arte-composicao.ts), com a conta exata
+  // (arte-medida.ts). Cabe quando a altura nao passa do disponivel e nenhuma palavra vaza pela
+  // direita: a palavra mais larga que a linha, num degrau, faz o degrau nao caber.
   const limite = alturaDisponivel(comIlustracao);
+  const linhas = composicaoDoSlide(s.titulo, s.texto);
+  const cabeEm = (fonte: number) => {
+    const m = medidaDaComposicao(linhas, fonte);
+    return !m.vaza && m.altura <= limite;
+  };
 
-  const coube = DEGRAUS_POR_TIPO[tipo]
-    .map(escala)
-    .find((f) => alturaEstimada(texto, f) <= limite);
+  const degraus = degrausDoSlide(s.tipo, comIlustracao);
+  const coube = degraus.find(cabeEm);
+  return coube !== undefined ? { fonte: coube, cabe: true } : { fonte: degraus[degraus.length - 1], cabe: false };
+}
 
-  return coube ?? escala(PISO_DE_LEGIBILIDADE);
+/**
+ * Os tamanhos que a escolha tenta, do maior ao menor, já na escala do modo, com o piso no fim (o
+ * gancho não tem o 34 na lista, e chega a ele quando nem o 46 cabe). Os vetores com o Labs desenham
+ * esta mesma escada (tests/arte-desenhada.tsx).
+ */
+export function degrausDoSlide(tipo: TipoDeSlide, comIlustracao: boolean): number[] {
+  const escala = (d: number) => (comIlustracao ? d : Math.round(d * FATOR_SEM_ILUSTRACAO[tipo]));
+  const degraus = DEGRAUS_POR_TIPO[tipo].map(escala);
+  const piso = escala(PISO_DE_LEGIBILIDADE);
+  return degraus.includes(piso) ? degraus : [...degraus, piso];
 }
 
 /** Um slide que não cabe na arte, com o diagnóstico do porquê. */
 export type SlideQueNaoCabe = {
   numero: number;
   tipo: TipoDeSlide;
-  linhas: number;
   /** Corta mesmo SEM ilustração — o caso grave, não há o que remover para resolver. */
   cortaSempre: boolean;
 };
@@ -273,30 +270,20 @@ export type SlideQueNaoCabe = {
  * contra os 382 disponíveis quando há ilustração.
  *
  * ⚠️ **E BAIXAR A FONTE NÃO RESOLVE**, o que elimina a saída óbvia: fonte menor não junta duas
- * linhas em uma. No piso de legibilidade de 34px cabem 8 linhas com ilustração — um slide com
- * 9 quebras não cabe em tamanho nenhum que este projeto aceite. Por isso a saída é limitar a
- * quantidade de linhas (na instrução) e AVISAR quem está na tela (aqui).
+ * linhas em uma. No piso de legibilidade de 34px, com o espaço da imagem, cabem 7 linhas sem
+ * manchete, e 5 de corpo com ela (77 + 5 × 45 = 302 de 334). Por isso a saída é limitar a quantidade
+ * de linhas (na instrução) e AVISAR quem está na tela (aqui).
  *
- * ⚠️ **AVISA, NUNCA IMPEDE** — mesmo critério do painel de acentuação. A previsão é uma
- * estimativa (conta caracteres, o Satori quebra por palavra), então vai errar às vezes.
- * Aviso que trava publicação é aviso que alguém desliga, e aí para de pegar o caso real.
+ * ⚠️ **AVISA, NUNCA IMPEDE** — mesmo critério do painel de acentuação. Aviso que trava publicação é
+ * aviso que alguém desliga, e aí para de pegar o caso real.
  */
 export function slidesQueNaoCabem(slides: SlideParaArte[]): SlideQueNaoCabe[] {
   const fora: SlideQueNaoCabe[] = [];
 
   slides.forEach((s, i) => {
-    const medido = textoMedido(s);
-    const comIlustracao = alturaEstimada(medido, tamanhoDoTexto(s.tipo, medido, true)) > alturaDisponivel(true);
-    const semIlustracao = alturaEstimada(medido, tamanhoDoTexto(s.tipo, medido, false)) > alturaDisponivel(false);
-
-    if (comIlustracao || semIlustracao) {
-      fora.push({
-        numero: i + 1,
-        tipo: s.tipo,
-        linhas: medido.split("\n").length,
-        cortaSempre: semIlustracao,
-      });
-    }
+    const comIlustracao = !tamanhoDoSlide(s, true).cabe;
+    const semIlustracao = !tamanhoDoSlide(s, false).cabe;
+    if (comIlustracao || semIlustracao) fora.push({ numero: i + 1, tipo: s.tipo, cortaSempre: semIlustracao });
   });
 
   return fora;
```

Em `lib/bonus/arte-desenho.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/arte-desenho.tsx b/lib/bonus/arte-desenho.tsx
index 84d1d97..cbce894 100644
--- a/lib/bonus/arte-desenho.tsx
+++ b/lib/bonus/arte-desenho.tsx
@@ -1,9 +1,9 @@
 // O DESENHO DE UM SLIDE, em JSX para o Satori (o ImageResponse de next/og). PURO: recebe tudo
 // pronto, e quem busca a foto e lê a fonte é a rota.
 //
-// TRAZIDO DO MÉTODO LABS (site-ia, src/app/admin/carrossel/arte/route.tsx, mudado por último em
-// 19d25be, igual em 45bc973 e em a56459b). DOIS DONOS: mudança aqui se avisa ao Labs, e a de lá se
-// traz para cá (docs/specs/2026-10-01-arte-do-carrossel.md, "Dois donos"). O layout é o do manual
+// VEIO DO MÉTODO LABS (site-ia, src/app/admin/carrossel/arte/route.tsx, em 45bc973). DOIS DONOS: o
+// mesmo desenho nos dois projetos é conferido pelos vetores (tests/vetores-da-arte.json), que cada
+// lado desenha no próprio Satori (spec da Etapa 4, "Dois donos"). O layout é o do manual
 // de arte do perfil que o Eduardo levou ao Labs em 02/09: fundo branco, texto 100% preto, margem de
 // 110, Carlito Regular e Bold, texto ancorado no topo, hierarquia por PESO e não por tamanho, e a
 // linha de fechamento em negrito. As QUATRO diferenças, todas da spec:
@@ -13,6 +13,10 @@
 // 3. sem tema escuro e sem selo de verificado;
 // 4. o cabeçalho vem da conta do carrossel (arte-tela.ts), e não da foto do admin.
 //
+// ⚠️ DESENHA A COMPOSIÇÃO (arte-composicao.ts), linha a linha, e não o texto cru: é a mesma lista que
+// a conta do "não cabe" mede (arte-medida.ts). O negrito, o espaçamento, a normalização e o espaço
+// acima de cada linha saem de lá, e nada disso se decide aqui. Os espaços são os da geometria.
+//
 // ⚠️ O QUE NÃO SE MEXE, cada item com um defeito datado atrás no ROADMAP do Labs: uma caixa por
 // LINHA, e nunca `whiteSpace: "pre-wrap"` (o Satori desenha o `\n` e não o conta na altura, e as
 // linhas se sobrepunham: Etapa 38.1); `flexShrink: 0` no texto e no espaço da imagem (sem ele o
@@ -22,18 +26,19 @@
 // ⚠️ O Satori entende um subconjunto de flexbox com estilo em linha: todo `div` com mais de um
 // filho precisa de `display: "flex"`. Por isso as cores estão escritas aqui.
 import type { ReactElement } from "react";
-import { ALTURA_ILUSTRACAO, ENTRELINHA, MARGEM } from "./arte-geometria";
+import { composicaoDoSlide } from "./arte-composicao";
+import {
+  ALTURA_ILUSTRACAO,
+  ENTRELINHA,
+  espacoAntes,
+  GAP_CABECALHO,
+  GAP_ILUSTRACAO,
+  LADO_DO_AVATAR,
+  MARGEM,
+} from "./arte-geometria";
 import type { SlideParaArte } from "./arte-slides";
 import type { CabecalhoDaArte } from "./arte-tela";
 
-/** Do fim do cabeçalho até a primeira linha de texto. Número do Labs. */
-const GAP_CABECALHO = 48;
-/** Da manchete ao corpo, medido como AVANÇO TOTAL, e não como espaço extra. Número do Labs. */
-const AVANCO_MANCHETE = 77;
-/** Entre parágrafos do corpo, inclusive antes da linha de fechamento. Número do Labs. */
-const GAP_PARAGRAFO = 41;
-/** Do fim do texto até o topo do espaço da imagem: o mesmo do cabeçalho, pela simetria (Labs, 39.2). */
-const GAP_ILUSTRACAO = 48;
 /** O fundo das iniciais quando a foto não vem: o azul do Instagram, como no Labs. */
 const AZUL_DAS_INICIAIS = "#3797F0";
 /** A paleta clara do Labs, a única aqui: texto 100% preto em fundo branco. */
@@ -53,12 +58,7 @@ export function desenhoDoSlide({
   cabecalho: CabecalhoDaArte;
   familia: string;
 }): ReactElement {
-  // OS BLOCOS do corpo: a linha em branco separa o parágrafo, e o último bloco é a linha de
-  // fechamento, em negrito, quando há mais de um.
-  const blocos = slide.texto
-    .split(/\n{2,}/)
-    .map((b) => b.trim())
-    .filter(Boolean);
+  const linhas = composicaoDoSlide(slide.titulo, slide.texto);
   const noPe = slide.assinaturaNoPe;
 
   const tag = (
@@ -66,13 +66,13 @@ export function desenhoDoSlide({
       {cabecalho.foto ? (
         /* eslint-disable-next-line @next/next/no-img-element -- JSX do Satori, e não HTML de
            página: `next/image` renderiza um componente que ele não sabe ler. */
-        <img src={cabecalho.foto} width={127} height={127} style={{ borderRadius: 999, objectFit: "cover" }} alt="" />
+        <img src={cabecalho.foto} width={LADO_DO_AVATAR} height={LADO_DO_AVATAR} style={{ borderRadius: 999, objectFit: "cover" }} alt="" />
       ) : (
         <div
           style={{
             display: "flex",
-            width: 127,
-            height: 127,
+            width: LADO_DO_AVATAR,
+            height: LADO_DO_AVATAR,
             borderRadius: 999,
             background: AZUL_DAS_INICIAIS,
             color: "#FFFFFF",
@@ -117,47 +117,21 @@ export function desenhoDoSlide({
           paddingBottom: noPe ? GAP_CABECALHO : 0,
         }}
       >
-        {slide.titulo && (
+        {linhas.map((linha, i) => (
           <div
+            key={i}
             style={{
               display: "flex",
               fontSize: fonte,
-              fontWeight: 700,
+              fontWeight: linha.negrito ? 700 : 400,
               lineHeight: ENTRELINHA,
-              letterSpacing: -0.4,
-              marginBottom: Math.max(0, AVANCO_MANCHETE - Math.round(fonte * ENTRELINHA)),
+              letterSpacing: linha.espacamento,
+              marginTop: espacoAntes(linha.antes, fonte),
             }}
           >
-            {slide.titulo}
+            {linha.texto}
           </div>
-        )}
-
-        {blocos.map((bloco, i) => {
-          const ultimo = i === blocos.length - 1;
-          // Negrito no ÚLTIMO bloco quando há fechamento (mais de um bloco), e no bloco único sem
-          // manchete acima: o gancho e a chamada, em que o texto É a peça.
-          const negrito = ultimo && (blocos.length > 1 || !slide.titulo);
-          return (
-            <div
-              key={i}
-              style={{
-                display: "flex",
-                flexDirection: "column",
-                fontSize: fonte,
-                fontWeight: negrito ? 700 : 400,
-                lineHeight: ENTRELINHA,
-                letterSpacing: negrito ? -0.4 : 0,
-                marginBottom: ultimo ? 0 : GAP_PARAGRAFO,
-              }}
-            >
-              {bloco.split("\n").map((linha, j) => (
-                <div key={j} style={{ display: "flex" }}>
-                  {linha}
-                </div>
-              ))}
-            </div>
-          );
-        })}
+        ))}
       </div>
 
       {/* O ESPAÇO DA IMAGEM, EM BRANCO: é onde o operador põe a imagem no Canva. Some no "só texto". */}
```

Em `lib/bonus/arte-resposta.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/arte-resposta.tsx b/lib/bonus/arte-resposta.tsx
index 688b098..770ef0b 100644
--- a/lib/bonus/arte-resposta.tsx
+++ b/lib/bonus/arte-resposta.tsx
@@ -3,15 +3,16 @@ import { ImageResponse } from "next/og";
 import { desenhoDoSlide } from "./arte-desenho";
 import { fontesDaArte, FAMILIA_DA_ARTE, type FonteDaArte } from "./arte-fonte";
 import { ALTURA, LARGURA } from "./arte-geometria";
-import { tamanhoDoTexto, textoMedido, type SlideParaArte } from "./arte-slides";
+import { tamanhoDoSlide, type SlideParaArte } from "./arte-slides";
 import { cabecalhosDaArte, type CabecalhoDaArte } from "./arte-tela";
 
 // O PNG DE UM SLIDE: o desenho, a fonte e os cabeçalhos da resposta, juntos. A rota decide o que
 // desenhar; isto desenha. Separado da rota para o teste desenhar de verdade sem sessão nem banco
 // (tests/bonus-arte-resposta.test.ts).
 //
-// A FONTE DO TEXTO É ESCOLHIDA SOBRE O TEXTO MEDIDO (a manchete e o corpo), o mesmo que o aviso
-// "não cabe" mede (arte-slides.ts). `comEspaco` é o `!semIlustracao` do Labs.
+// A FONTE DO TEXTO É ESCOLHIDA SOBRE A COMPOSIÇÃO DO SLIDE (arte-composicao.ts), a mesma que o desenho
+// desenha e que o aviso "não cabe" mede (arte-slides.ts, `tamanhoDoSlide`). `comEspaco` é o
+// `!semIlustracao` do Labs.
 //
 // O PNG É LIDO INTEIRO AQUI, antes de a rota responder (achado 65). O ImageResponse fixa o status
 // 200 antes de desenhar, porque o desenho roda dentro do stream do corpo: uma falha no meio sairia
@@ -44,7 +45,7 @@ export async function respostaDaArte({
   } catch {
     return { ok: false, falha: "fonte" };
   }
-  const fonte = tamanhoDoTexto(slide.tipo, textoMedido(slide), comEspaco);
+  const { fonte } = tamanhoDoSlide(slide, comEspaco);
 
   const desenhar = async (cab: CabecalhoDaArte): Promise<Response | null> => {
     const imagem = new ImageResponse(desenhoDoSlide({ slide, fonte, comEspaco, cabecalho: cab, familia: FAMILIA_DA_ARTE }), {
```

Em `lib/bonus/arte-cabimento.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/arte-cabimento.ts b/lib/bonus/arte-cabimento.ts
index 4f76414..95fd94d 100644
--- a/lib/bonus/arte-cabimento.ts
+++ b/lib/bonus/arte-cabimento.ts
@@ -1,9 +1,10 @@
 // O "NÃO CABE" ENQUANTO SE DIGITA: a mesma conta da arte (arte-slides.ts), feita sobre o que está
 // nos campos do editor AGORA, e não sobre o texto salvo (spec da Etapa 3, "A prévia e o não cabe").
 //
-// PURO, e roda no navegador. AVISA, NUNCA IMPEDE: a previsão conta caracteres na largura das
-// maiúsculas, e o Satori quebra por palavra (a regra do Labs, `slidesQueNaoCabem`). A prova real
-// confere a imagem de verdade com textos no limite de cada degrau.
+// PURO, e roda no navegador. AVISA, NUNCA IMPEDE (a regra do Labs, `slidesQueNaoCabem`). A conta é a
+// exata da Etapa 4 (arte-medida.ts), conferida contra o desenho pelos vetores combinados com o Labs
+// (tests/vetores-da-arte.json); onde o Satori também quebra dentro da palavra, ela só erra para o lado
+// seguro.
 import { slidesDoTexto, slidesQueNaoCabem } from "./arte-slides";
 import { textoNaoCabeComEspaco, textoNaoCabeNunca } from "./arte-textos";
 import { slidesDeConteudo } from "./carrossel-pedido";
```

- [ ] **Passo 7: ver passar**

```bash
npx tsc --noEmit
npx vitest run tests/bonus-arte-composicao.test.ts tests/bonus-arte-medida.test.ts tests/bonus-arte-slides.test.ts
npm test
npm run test:dom
```

Esperado: `tsc` limpo; 48 casos dos três arquivos passam; a suíte pura com 92 arquivos e 2 432 casos, e a de tela com 19 e 116.

- [ ] **Passo 8: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/arte-geometria.ts lib/bonus/arte-composicao.ts lib/bonus/arte-medida.ts lib/bonus/arte-slides.ts lib/bonus/arte-desenho.tsx lib/bonus/arte-resposta.tsx lib/bonus/arte-cabimento.ts tests/bonus-arte-composicao.test.ts tests/bonus-arte-medida.test.ts tests/bonus-arte-slides.test.ts
test "$(git branch --show-current)" = "pagina-do-carrossel"
git add lib/bonus/arte-geometria.ts lib/bonus/arte-composicao.ts lib/bonus/arte-medida.ts lib/bonus/arte-slides.ts lib/bonus/arte-desenho.tsx lib/bonus/arte-resposta.tsx lib/bonus/arte-cabimento.ts tests/bonus-arte-composicao.test.ts tests/bonus-arte-medida.test.ts tests/bonus-arte-slides.test.ts
git commit -m "fix(bonus): o não cabe mede como o Satori desenha, sobre a composição do slide"
```

---

### FASE 4.4 — Os vetores combinados com o Labs, e a régua

**Arquivos:**
- Criar: os ajudantes `tests/arte-desenhada.tsx`, `tests/arte-vetores-entradas.ts` e
  `tests/vetores-da-arte.ts`, e o gerado `tests/vetores-da-arte.json`
- Testar: `tests/bonus-arte-vetores.test.ts` (puro, a conta contra os vetores) e
  `tests/bonus-arte-desenho.test.ts` (o desenho de verdade, uns 20 segundos)

**Interfaces:**
- Consome: `composicaoDoSlide`, `pedacosDaLinha`, `medidaDaComposicao`, `tamanhoDoSlide` e
  `degrausDoSlide` (FASE 4.3); `desenhoDoSlide` e `fontesDaArte` (Etapa 3).
- Produz, de `tests/arte-desenhada.tsx`: `lerPng(png)`, `desenharSlide(slide, fonte, comEspaco):
  { altura; vaza; cabe }`, `cabeNaPeca(...)`, `soQuebraNoEspaco(slide)`, `respostaDoDesenho(entrada)`,
  `slideDoVetor(entrada)`, `CABECALHO`, `SVG_DO_EMOJI`; de `tests/vetores-da-arte.ts`, o tipo `Vetor`,
  `lerVetores()`, `conteudoDosVetores()` e `textoDosVetores(arquivo)` (em ASCII); de
  `tests/arte-vetores-entradas.ts`, `entradasDosVetores()`.

O arquivo dos vetores é o contrato com o Labs: o mesmo, byte a byte, nos dois repositórios. Ele é
gerado desenhando cada entrada (Passo 4), e o sha256 dele está no teste puro. Se o sha sair
diferente, pare: o desenho, a fonte ou o Satori não são os do ensaio.

- [ ] **Passo 1: os ajudantes do desenho medido e dos vetores**

Crie `tests/arte-desenhada.tsx`:

```tsx
// O DESENHO DE VERDADE, MEDIDO NO PIXEL: o ajudante da régua e dos vetores combinados com o Labs
// (tests/bonus-arte-desenho.test.ts e tests/vetores-da-arte.json). Desenha com o Satori do og do
// Next, com a Carlito do disco, e lê o PNG com um decodificador pequeno (zlib e os 5 filtros do PNG):
// o `sharp` só existe como dependência opcional do Next, e pô-lo no package.json mexeria num arquivo
// do dono.
//
// COMO SE MEDE (spec da Etapa 4, "A régua, como teste"):
// - a coluna do texto e o espaço da imagem são pintados de preto (o espaço é branco no branco, e a
//   última linha escura não o veria);
// - a altura desenhada é a da coluna, achada na borda direita da área útil, menos o respiro de 48;
// - a palavra que vaza aparece como tinta à direita da área útil (com folga de 10px: a tinta de uma
//   letra pode passar um pouco do avanço dela sem que a linha tenha passado da largura);
// - cabe quando a última linha escura da peça fica acima de 1240, onde começa a margem de baixo, e
//   nada vaza.
import { inflateSync } from "node:zlib";
import { ImageResponse } from "next/og";
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { composicaoDoSlide } from "@/lib/bonus/arte-composicao";
import { desenhoDoSlide } from "@/lib/bonus/arte-desenho";
import { FAMILIA_DA_ARTE, fontesDaArte } from "@/lib/bonus/arte-fonte";
import { ALTURA, ALTURA_ILUSTRACAO, GAP_CABECALHO, LARGURA, LARGURA_UTIL, MARGEM } from "@/lib/bonus/arte-geometria";
import { pedacosDaLinha } from "@/lib/bonus/arte-medida";
import { degrausDoSlide, type SlideParaArte, type TipoDeSlide } from "@/lib/bonus/arte-slides";
import type { CabecalhoDaArte } from "@/lib/bonus/arte-tela";

/** O cabeçalho dos desenhos medidos: sem foto (as iniciais), como uma conta desconectada. */
export const CABECALHO: CabecalhoDaArte = { nome: "Thiago Vannuchi", arroba: "thiagovannuchi", foto: null, iniciais: "TV" };

/** O SVG que o teste entrega no lugar do emoji da rede: a largura do emoji é 1em, seja qual for o desenho. */
export const SVG_DO_EMOJI = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="18" r="18" fill="#888888"/></svg>';

type Imagem = { largura: number; altura: number; rgba: Buffer };

/** O PNG em RGBA de 8 bits, sem entrelaçamento, que é o que o Resvg grava. Outro formato recusa. */
export function lerPng(png: Buffer): Imagem {
  const largura = png.readUInt32BE(16);
  const altura = png.readUInt32BE(20);
  if (png[24] !== 8 || png[25] !== 6 || png[28] !== 0) throw new Error("o PNG não é RGBA de 8 bits sem entrelaçamento");
  const partes: Buffer[] = [];
  for (let o = 8; o < png.length; ) {
    const n = png.readUInt32BE(o);
    if (png.toString("latin1", o + 4, o + 8) === "IDAT") partes.push(png.subarray(o + 8, o + 8 + n));
    o += 12 + n;
  }
  const cru = inflateSync(Buffer.concat(partes));
  const passo = largura * 4;
  const rgba = Buffer.alloc(passo * altura);
  // Os 5 filtros, um laço por filtro: a = o byte à esquerda (4 antes), b = o de cima, c = o de cima à esquerda.
  for (let y = 0; y < altura; y++) {
    const filtro = cru[y * (passo + 1)];
    const e = y * (passo + 1) + 1;
    const s = y * passo;
    const cima = s - passo;
    const a = (i: number) => (i >= 4 ? rgba[s + i - 4] : 0);
    const b = (i: number) => (y > 0 ? rgba[cima + i] : 0);
    const c = (i: number) => (i >= 4 && y > 0 ? rgba[cima + i - 4] : 0);
    if (filtro === 0) cru.copy(rgba, s, e, e + passo);
    else if (filtro === 1) for (let i = 0; i < passo; i++) rgba[s + i] = cru[e + i] + a(i);
    else if (filtro === 2) for (let i = 0; i < passo; i++) rgba[s + i] = cru[e + i] + b(i);
    else if (filtro === 3) for (let i = 0; i < passo; i++) rgba[s + i] = cru[e + i] + ((a(i) + b(i)) >> 1);
    else if (filtro === 4) {
      for (let i = 0; i < passo; i++) {
        const [va, vb, vc] = [a(i), b(i), c(i)];
        const p = va + vb - vc;
        const pa = Math.abs(p - va);
        const pb = Math.abs(p - vb);
        const pc = Math.abs(p - vc);
        rgba[s + i] = cru[e + i] + (pa <= pb && pa <= pc ? va : pb <= pc ? vb : vc);
      }
    } else throw new Error(`filtro de PNG desconhecido: ${filtro}`);
  }
  return { largura, altura, rgba };
}

/** Escuro é a luminância abaixo de 250 (a régua da auditoria). */
function escuro(img: Imagem, x: number, y: number): boolean {
  const o = (y * img.largura + x) * 4;
  return 0.299 * img.rgba[o] + 0.587 * img.rgba[o + 1] + 0.114 * img.rgba[o + 2] < 250;
}

/** A última linha da imagem com algum escuro (-1 se não houver). */
function ultimaLinhaEscura(img: Imagem): number {
  for (let y = img.altura - 1; y >= 0; y--) {
    for (let x = 0; x < img.largura; x++) if (escuro(img, x, y)) return y;
  }
  return -1;
}

async function desenharPng(el: ReactElement, altura: number, largura = LARGURA): Promise<Imagem> {
  const imagem = new ImageResponse(el, { width: largura, height: altura, fonts: await fontesDaArte() });
  return lerPng(Buffer.from(await imagem.arrayBuffer()));
}

type Estilo = { style?: Record<string, unknown>; children?: ReactNode };

/** O desenho do slide com a coluna do texto e o espaço da imagem pintados de preto. */
function pintado(slide: SlideParaArte, fonte: number, comEspaco: boolean): ReactElement {
  const raiz = desenhoDoSlide({ slide, fonte, comEspaco, cabecalho: CABECALHO, familia: FAMILIA_DA_ARTE }) as ReactElement<Estilo>;
  const filhos = ([] as ReactNode[]).concat(raiz.props.children).map((filho) => {
    if (!isValidElement<Estilo>(filho)) return filho;
    const s = filho.props.style ?? {};
    const ehColuna = s.flexDirection === "column" && s.flexShrink === 0;
    const ehEspaco = s.height === ALTURA_ILUSTRACAO;
    return ehColuna || ehEspaco ? cloneElement(filho, { style: { ...s, background: "#000000" } }) : filho;
  });
  return cloneElement(raiz, {}, ...filhos);
}

/** O que o desenho de um slide numa fonte mostra no pixel. */
export type Desenhado = { altura: number; vaza: boolean; cabe: boolean };

const BORDA = MARGEM + LARGURA_UTIL - 5;
const ALEM_DA_DIREITA = MARGEM + LARGURA_UTIL + 10;

/** A coluna pintada na imagem: do topo até a primeira linha clara na borda direita da área útil. */
function coluna(img: Imagem): { topo: number; fim: number | null } {
  let topo = 0;
  while (topo < img.altura && !escuro(img, BORDA, topo)) topo++;
  let fim = topo;
  while (fim < img.altura && escuro(img, BORDA, fim)) fim++;
  return { topo, fim: fim < img.altura ? fim : null };
}

function vazaNaColuna(img: Imagem, topo: number, fim: number): boolean {
  for (let y = topo; y < fim; y++) {
    for (let x = ALEM_DA_DIREITA; x < img.largura; x++) if (escuro(img, x, y)) return true;
  }
  return false;
}

/** Na peça de 1350: cabe quando a última linha com algum escuro fica acima de 1240 e nada vaza. */
function cabeNaImagem(img: Imagem, topo: number, fim: number): boolean {
  return ultimaLinhaEscura(img) < ALTURA - MARGEM && !vazaNaColuna(img, topo, fim);
}

/** Cabe na peça? A coluna que passa da peça não cabe, e não precisa de mais medida. */
export async function cabeNaPeca(slide: SlideParaArte, fonte: number, comEspaco: boolean): Promise<boolean> {
  const img = await desenharPng(pintado(slide, fonte, comEspaco), ALTURA);
  const { topo, fim } = coluna(img);
  return fim !== null && cabeNaImagem(img, topo, fim);
}

/**
 * A altura da coluna do texto, se alguma palavra vaza, e se cabe na peça. A coluna que passa da peça
 * não cabe, e é medida de novo numa tela mais alta até achar o fim: a altura dela não depende da tela
 * (flexShrink 0), e o resto só desce.
 */
export async function desenharSlide(slide: SlideParaArte, fonte: number, comEspaco: boolean): Promise<Desenhado> {
  const el = pintado(slide, fonte, comEspaco);
  for (const tela of [ALTURA, 4000, 16000]) {
    const img = await desenharPng(el, tela);
    const { topo, fim } = coluna(img);
    if (fim === null) continue;
    const vaza = vazaNaColuna(img, topo, fim);
    return { altura: fim - topo - GAP_CABECALHO, vaza, cabe: tela === ALTURA && cabeNaImagem(img, topo, fim) };
  }
  throw new Error("a coluna do texto passa até da tela de 16000px");
}

/**
 * Quantas linhas de 20px os textos dão, cada um numa caixa de 1px de largura: uma por pedaço do
 * quebrador. A tela tem lugar para o dobro do `esperado`; passando disso, a conta para no dobro, e
 * continua diferente do esperado.
 */
async function linhasNaCaixaEstreita(textos: { texto: string; negrito: boolean }[], esperado: number): Promise<number> {
  const el = (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#FFFFFF", fontFamily: FAMILIA_DA_ARTE }}>
      {textos.map((t, i) => (
        <div
          key={i}
          style={{ display: "flex", flexDirection: "column", width: 1, background: "#000000", color: "transparent", fontSize: 20, lineHeight: 1, fontWeight: t.negrito ? 700 : 400 }}
        >
          {t.texto}
        </div>
      ))}
    </div>
  );
  const img = await desenharPng(el, 20 * esperado * 2 + 40, 64);
  let y = 0;
  while (y < img.altura && escuro(img, 0, y)) y++;
  return y / 20;
}

/**
 * O VETOR É EXATO quando o texto normalizado só tem ponto de quebra no espaço, e quem decide é o
 * quebrador do próprio Satori, e não um rótulo à mão (pedido do Labs, 02/10). Numa caixa de 1px, ele
 * põe cada pedaço numa linha: cada pedaço da conta, sozinho, tem de dar uma linha (nada quebra
 * dentro dele), e cada linha da composição tem de dar tantas linhas quanto pedaços (todo ponto de
 * quebra dele é um da conta).
 */
export async function soQuebraNoEspaco(slide: SlideParaArte): Promise<boolean> {
  const linhas = composicaoDoSlide(slide.titulo, slide.texto);
  const pedacos = linhas.flatMap((l) => pedacosDaLinha(l.texto).map((texto) => ({ texto, negrito: l.negrito })));
  const n = pedacos.length;
  return (await linhasNaCaixaEstreita(pedacos, n)) === n && (await linhasNaCaixaEstreita(linhas, n)) === n;
}

/** O que um vetor pede: o slide, sem número. */
export type EntradaDoVetor = {
  nome: string;
  categoria: string;
  texto: string;
  tipo: TipoDeSlide;
  titulo: string | null;
  comIlustracao: boolean;
  assinaturaNoPe: boolean;
};

/** O que o desenho responde: o maior degrau em que cabe (ou o piso), a altura nele, e se cabe. */
export type RespostaDoDesenho = { degrau: number; alturaDesenhada: number; cabe: boolean };

export function slideDoVetor(e: EntradaDoVetor): SlideParaArte {
  return { numero: 2, total: 3, tipo: e.tipo, titulo: e.titulo, texto: e.texto, assinaturaNoPe: e.assinaturaNoPe };
}

/** O primeiro da lista para o qual a pergunta responde sim, perguntando em ordem. */
async function achar<T>(lista: T[], pergunta: (x: T) => Promise<boolean>): Promise<T | undefined> {
  for (const x of lista) if (await pergunta(x)) return x;
  return undefined;
}

/** Desce a escada de degraus do tipo, desenhando cada um, até o primeiro em que o desenho cabe. */
export async function respostaDoDesenho(e: EntradaDoVetor): Promise<RespostaDoDesenho> {
  const slide = slideDoVetor(e);
  const degraus = degrausDoSlide(e.tipo, e.comIlustracao);
  // Os degraus de cima só precisam do "cabe"; a altura é medida só no degrau da resposta.
  const degrau = (await achar(degraus, (d) => cabeNaPeca(slide, d, e.comIlustracao))) ?? degraus[degraus.length - 1];
  const d = await desenharSlide(slide, degrau, e.comIlustracao);
  return { degrau, alturaDesenhada: d.altura, cabe: d.cabe };
}
```

Crie `tests/vetores-da-arte.ts`:

```ts
// OS VETORES DA ARTE, combinados com o Método Labs (spec da Etapa 4, "Dois donos"; a 48.5 do Labs): o
// formato do arquivo tests/vetores-da-arte.json, e a leitura e a escrita dele. O MESMO arquivo, byte a
// byte, mora nos dois repositórios, e cada lado confere o sha256 dele, o desenho no próprio Satori
// (tests/bonus-arte-desenho.test.ts) e a própria conta (tests/bonus-arte-vetores.test.ts).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { TipoDeSlide } from "@/lib/bonus/arte-slides";

export const ARQUIVO_DOS_VETORES = fileURLToPath(new URL("vetores-da-arte.json", import.meta.url));

/** Um vetor: o slide pedido, e o que o desenho responde. */
export type Vetor = {
  nome: string;
  categoria: string;
  texto: string;
  tipo: TipoDeSlide;
  titulo: string | null;
  comIlustracao: boolean;
  assinaturaNoPe: boolean;
  /** O texto só tem ponto de quebra no espaço, segundo o quebrador do Satori: a conta tem de dar o mesmo. */
  exato: boolean;
  /** O maior degrau do tipo em que o desenho cabe, ou o piso. */
  degrau: number;
  /** A altura da coluna do texto nesse degrau, medida no PNG. */
  alturaDesenhada: number;
  cabe: boolean;
};

export type ArquivoDosVetores = {
  sobre: string[];
  origem: { satori: string; og: string; fontes: Record<string, string>; desenho: Record<string, string> };
  normalizacao: string[];
  conta: string[];
  medida: string[];
  vetores: Vetor[];
};

/** O conteúdo em LF, que é o que o sha256 confere: o git pode entregar a cópia em CRLF. */
export function conteudoDosVetores(): string {
  return readFileSync(ARQUIVO_DOS_VETORES, "utf8").replace(/\r\n/g, "\n");
}

export function lerVetores(): ArquivoDosVetores {
  return JSON.parse(conteudoDosVetores()) as ArquivoDosVetores;
}

/**
 * O JSON SÓ EM ASCII: todo caractere acima de U+007E sai como escape de barra-u. O espaço sem quebra, a
 * quebra de parágrafo e o acento combinante dos vetores não se veem, e uma ferramenta que regrave o
 * arquivo pode trocá-los sem a tela mostrar; em ASCII, os bytes não dependem de quem gravou.
 */
function emAscii(json: string): string {
  const barra = String.fromCharCode(92);
  let saida = "";
  for (let i = 0; i < json.length; i++) {
    const u = json.charCodeAt(i);
    saida += u > 0x7e ? `${barra}u${u.toString(16).padStart(4, "0")}` : json[i];
  }
  return saida;
}

/** O texto do arquivo: o cabeçalho indentado, e um vetor por linha, para a diferença de um vetor ser uma linha. */
export function textoDosVetores(a: ArquivoDosVetores): string {
  const { vetores, ...cabecalho } = a;
  const topo = JSON.stringify(cabecalho, null, 2).replace(/\n}$/, "");
  return emAscii(`${topo},\n  "vetores": [\n${vetores.map((v) => `    ${JSON.stringify(v)}`).join(",\n")}\n  ]\n}\n`);
}

export const SOBRE = [
  "Vetores da arte do carrossel, combinados entre o Método Chat (Etapa 4 do gerador) e o Método Labs (Etapa 48). O mesmo arquivo, byte a byte, nos dois repositórios; cada um confere o sha256 dele.",
  "Cada vetor é um slide pedido (texto, tipo, titulo, comIlustracao, assinaturaNoPe) e o que o DESENHO responde: o maior degrau do tipo em que ele cabe (ou o piso), a altura da coluna do texto nesse degrau e se cabe. O valor esperado sai do desenho no Satori, e não de uma conta.",
  "exato: o texto normalizado só tem ponto de quebra no espaço, decidido pelo quebrador do Satori numa caixa de 1px (cada pedaço da conta dá uma linha, e cada linha dá tantas linhas quanto pedaços). Exato: a conta tem de dar o mesmo degrau, o mesmo cabe e a mesma altura. Conservador: o degrau da conta é menor ou igual, a conta nunca diz que cabe quando o desenho não cabe, e a altura dela no degrau do desenho é maior ou igual.",
  "Gerado pelo Método Chat: GERAR_VETORES_DA_ARTE=1 npx vitest run tests/bonus-arte-desenho.test.ts.",
];

export const NORMALIZACAO = [
  "Feita uma vez, na composição do slide; o desenho e a conta recebem o texto pronto.",
  "(a) NFC no texto inteiro.",
  "(b) \\r\\n, \\r, \\v, \\f, U+0085, U+2028 e U+2029 viram \\n.",
  "(c) Em cada linha, sequência de espaço e tab vira um espaço, e String.prototype.trim nas pontas.",
  "(d) Parágrafo: linhas não vazias seguidas, separadas por uma ou mais linhas vazias, contadas depois do (c).",
  "(e) Manchete: as quebras do (b) viram espaço, o (c), e manchete vazia é manchete nenhuma.",
  "Negrito: a manchete; e o último parágrafo, quando há mais de um, ou quando não há manchete. Espaçamento do negrito: -0,4px por glifo.",
  "Espaço acima: o primeiro corpo depois da manchete, max(0, 77 - round(fonte * 1,32)); o primeiro de cada parágrafo seguinte, 41.",
];

export const CONTA = [
  "Larguras em unidades da fonte (inteiros), 2048 por em, dos .ttf da Carlito (google/fonts 3dd7884402).",
  "Largura do grafema (Intl.Segmenter): para cada glifo, x += avanco * ((1 / 2048) * fonte); e, se o espaçamento não é zero, x += (espacamento / fonte) * fonte. Nesta ordem de operações, que é a do opentype.js do Satori.",
  "Grafema com algum caractere fora da fonte: vale a fonte (1em), sem espaçamento. Largura do texto: soma dos grafemas, da esquerda para a direita.",
  "Pedaços: quebra em cada U+0020, menos quando o caractere depois é um de ! ) , . / : ; ? ] }, quando o de antes é um de ( [ { ¡ ¿ „ ‚, quando o de antes é aspa (\" ' « » “ ” ‘ ’ ‹ ›) e o depois é um de ( [ { ¡ ¿ „ ‚, ou quando os dois são —. O espaço vai com o pedaço de antes.",
  "Quebra gulosa: o primeiro pedaço abre a linha; os outros descem quando linha + pedaço > 860 + (espaços do fim do pedaço). Igual cabe.",
  "Pedaço mais largo que 860 sem os espaços do fim: vaza, e o degrau não cabe.",
  "Altura: a soma de (espaço acima + linhas * round(fonte * 1,32)) de cada linha da composição. Cabe: não vaza e altura <= 334 com o espaço da imagem, <= 955 sem.",
  "Degraus, do maior ao menor, com o piso no fim: gancho 86 72 56 46 (piso 34); conteúdo 46 40 34; chamada e post 60 46 40 34. Sem o espaço da imagem, round(degrau * fator): gancho 1,35, conteúdo 1,6, chamada 1,35.",
];

export const MEDIDA = [
  "O slide é desenhado em 1080x1350 com a coluna do texto e o espaço da imagem pintados de preto (#000000); escuro é luminância < 250.",
  "Altura desenhada: a coluna, achada na coluna de pixels x = 965, do primeiro ao último escuro seguido, menos o respiro de 48 que ela carrega. A coluna que passa da peça é medida numa tela de 4000px.",
  "Vaza, com TOLERÂNCIA DECLARADA DE 10PX: a área útil termina em x = 970, e o desenho só conta como vazado com tinta em x >= 980, dentro da coluna. A tinta de uma letra pode passar um pouco do avanço dela sem que a linha tenha passado de 860. Por isso, no desenho, cabe não quer dizer dentro de 970 na horizontal. Na conta não há tolerância: vaza é avanço sem os espaços do fim > 860.",
  "Cabe: não vaza (com a tolerância acima) e a última linha com algum escuro na peça fica acima de 1240 (a margem de baixo).",
  "Emoji: o SVG do emoji vem de um fetch trocado no teste (a largura é 1em, seja qual for o desenho). Caractere sem glifo que não é emoji fica fora dos vetores: em produção, o desenho dele depende da rede.",
];
```

Crie `tests/arte-vetores-entradas.ts`:

```ts
// AS ENTRADAS DOS VETORES combinados com o Labs (tests/vetores-da-arte.json): o que se pede ao
// desenho. A resposta (o degrau, a altura e o cabe) sai do DESENHO, em tests/bonus-arte-desenho.test.ts,
// e nunca daqui. Daqui sai só a pergunta, e algumas perguntas são achadas com a conta (o maior texto
// que ela aceita em cada degrau, a linha que encosta em 860), para o desenho conferir a fronteira.
//
// As categorias que o Labs pediu (02/10): emoji, pontuação com espaço antes, \n\n, linha encostando em
// 860, palavra mais larga que a linha, acento em NFD; os 4 casos da comparação desenhada por ele; e
// um caso conservador em que a conta erra para o lado seguro por uma linha inteira.
//
// ⚠️ Os caracteres especiais são escritos pelo código (String.fromCodePoint), e não à mão: um espaço
// sem quebra ou uma quebra de parágrafo colados no arquivo não se veem na revisão.
import { composicaoDoSlide, type LinhaDaArte } from "@/lib/bonus/arte-composicao";
import { LARGURA_UTIL } from "@/lib/bonus/arte-geometria";
import { larguraDoTexto, medidaDaComposicao, pedacosDaLinha, quebraDaLinha } from "@/lib/bonus/arte-medida";
import { tamanhoDoSlide, type SlideParaArte, type TipoDeSlide } from "@/lib/bonus/arte-slides";
import { slideDoVetor, type EntradaDoVetor } from "./arte-desenhada";

const c = (...codigos: number[]) => String.fromCodePoint(...codigos);
const NBSP = c(0xa0);
const SEPARADOR_DE_LINHA = c(0x2028);
const SEPARADOR_DE_PARAGRAFO = c(0x2029);
const ACENTO_AGUDO = c(0x301);
const CIRCUNFLEXO = c(0x302);
const TRAVESSAO = c(0x2014);
const ABRE_ASPAS = c(0x201c);
const FECHA_ASPAS = c(0x201d);
const CHORO = c(0x1f622);
const APONTA = c(0x1f447);
const FOGO = c(0x1f525);
const CHECK = c(0x2705);

const FRASE =
  "mande uma mensagem curta para o cliente que sumiu e lembre do que ele comprou na última vez porque quem some ainda pode voltar se a conversa certa chegar".split(
    " "
  );

/** O texto de `n` palavras num dos três estilos da régua: frase, caixa alta e lista de quatro palavras por item. */
function textoNoEstilo(estilo: "frase" | "caixa" | "lista", n: number): string {
  const ps = Array.from({ length: n }, (_, i) => FRASE[i % FRASE.length]);
  if (estilo === "frase") return ps.join(" ");
  if (estilo === "caixa") return ps.join(" ").toUpperCase();
  const itens: string[] = [];
  for (let i = 0; i < ps.length; i += 4) itens.push(`- ${ps.slice(i, i + 4).join(" ")}`);
  return itens.join("\n");
}

const entrada = (
  nome: string,
  categoria: string,
  tipo: TipoDeSlide,
  titulo: string | null,
  texto: string,
  comIlustracao = true,
  assinaturaNoPe = false
): EntradaDoVetor => ({ nome, categoria, texto, tipo, titulo, comIlustracao, assinaturaNoPe });

/** Os 4 casos que o Labs desenhou na comparação de 02/10, todos com o espaço da imagem. */
function casosDoLabs(): EntradaDoVetor[] {
  const capa = "VOCÊ ESTÁ PERDENDO CLIENTES TODOS OS DIAS POR CAUSA DE UM ERRO QUE QUASE NINGUÉM PERCEBE NA HORA DE RESPONDER";
  return [
    entrada(
      "labs-1-geracao-real",
      "labs",
      "conteudo",
      "Os 5 erros que travam suas vendas",
      "Antes de culpar o mercado, confira:\nResponder o cliente horas depois\nMandar preço sem entender a dor\nNão fazer follow-up depois do não\nCopiar a abordagem do concorrente\nFalar mais do produto que do cliente"
    ),
    entrada(
      "labs-2-sete-linhas",
      "labs",
      "conteudo",
      "Checklist antes de publicar",
      "Revise o título\nConfira a ortografia\nTeste o link do bônus\nAjuste a palavra-chave\nEscolha a imagem certa\nLeia em voz alta\nAgende o melhor horário"
    ),
    entrada("labs-3-capa-109", "labs", "gancho", null, capa),
    entrada("labs-4-capa-120", "labs", "gancho", null, `${capa} O WHATSAPP`),
  ];
}

/**
 * A RÉGUA: o maior texto que a conta aceita em cada degrau, por tipo, modo e estilo. A manchete de 1
 * e de 2 linhas, em caixa alta, e o gancho nos quatro degraus.
 */
function limites(): EntradaDoVetor[] {
  const casos: { nome: string; tipo: TipoDeSlide; titulo: string | null; noPe: boolean }[] = [
    { nome: "gancho", tipo: "gancho", titulo: null, noPe: false },
    { nome: "conteudo", tipo: "conteudo", titulo: "O que fazer primeiro", noPe: false },
    { nome: "conteudo-manchete-2", tipo: "conteudo", titulo: "O QUE FAZER PRIMEIRO COM O CLIENTE QUE SUMIU DE VEZ", noPe: false },
    { nome: "chamada", tipo: "cta", titulo: null, noPe: true },
    { nome: "post", tipo: "cta", titulo: null, noPe: false },
  ];
  const vetores: EntradaDoVetor[] = [];
  for (const caso of casos) {
    for (const comIlustracao of [true, false]) {
      for (const estilo of ["frase", "caixa", "lista"] as const) {
        const porDegrau = new Map<number, string>();
        for (let n = 1; n < 400; n++) {
          const texto = textoNoEstilo(estilo, n);
          const t = tamanhoDoSlide(slideDoVetor(entrada("", "", caso.tipo, caso.titulo, texto, comIlustracao, caso.noPe)), comIlustracao);
          if (!t.cabe) break;
          porDegrau.set(t.fonte, texto);
        }
        for (const [degrau, texto] of porDegrau) {
          const modo = comIlustracao ? "com" : "sem";
          vetores.push(entrada(`limite-${caso.nome}-${modo}-${estilo}-${degrau}`, "limite", caso.tipo, caso.titulo, texto, comIlustracao, caso.noPe));
        }
      }
    }
  }
  return vetores;
}

const VOCABULARIO = (
  "a o e de do da em um uma que se para com sem por mais menos hoje agora nunca sempre cliente clientes venda vendas " +
  "mensagem conversa resposta prazo preço produto marca loja ideia plano passo prova dia semana mês lucro margem meta " +
  "rápido certo pronto curto longo novo velho bom forte simples claro útil antes depois volta ainda já só bem"
).split(" ");

/** A largura de uma linha da composição numa fonte, pela conta. */
function largura(l: LinhaDaArte, fonte: number): number {
  return larguraDoTexto(l.texto, fonte, l.negrito, l.espacamento);
}

/**
 * Uma linha que a conta mede bem perto de 860, de um lado (`dentro`: até 860) ou do outro (`fora`:
 * passa de 860 por menos de 0,05px). Busca determinística no vocabulário. O desenho confere se o
 * Satori soma igual: dentro dá uma linha, fora dá duas.
 */
function linhaNaFronteira(fonte: number, negrito: boolean, lado: "dentro" | "fora"): string {
  const como = (texto: string): LinhaDaArte => composicaoDoSlide(negrito ? null : "Manchete", texto).at(-1)!;
  for (let i = 0; i < VOCABULARIO.length; i++) {
    for (let j = 0; j < VOCABULARIO.length; j++) {
      const palavras: string[] = [];
      for (let k = 0; ; k++) {
        const proxima = VOCABULARIO[(i + k * 7 + j * 3) % VOCABULARIO.length];
        const tentativa = [...palavras, proxima].join(" ");
        if (largura(como(tentativa), fonte) > LARGURA_UTIL - 120) break;
        palavras.push(proxima);
      }
      for (const fim of VOCABULARIO) {
        for (const fim2 of VOCABULARIO) {
          const texto = [...palavras, fim, fim2].join(" ");
          const w = largura(como(texto), fonte);
          if (lado === "dentro" && w <= LARGURA_UTIL && w > LARGURA_UTIL - 0.05) return texto;
          if (lado === "fora" && w > LARGURA_UTIL && w < LARGURA_UTIL + 0.05) return texto;
        }
      }
    }
  }
  throw new Error(`não achei linha ${lado} de 860 a ${fonte}px`);
}

/**
 * Um gancho de duas linhas a 86px que só cabe por causa do espaçamento do negrito (−0,4px por letra):
 * sem ele, a segunda linha passa de 860 e a terceira linha não cabe nos 334.
 */
function ganchoQueSoCabePeloNegrito(): string {
  const sem = (t: string) => larguraDoTexto(t, 86, true, 0);
  const com = (t: string) => larguraDoTexto(t, 86, true, -0.4);
  const caixa = VOCABULARIO.map((p) => p.toUpperCase());
  for (const a of caixa) for (const b of caixa) for (const d of caixa) {
    const segunda = `${a} ${b} ${d}`;
    if (com(segunda) <= LARGURA_UTIL && sem(segunda) > LARGURA_UTIL) {
      const texto = `VOCÊ PERDE ${segunda}`;
      const linhas = composicaoDoSlide(null, texto);
      if (medidaDaComposicao(linhas, 86).altura === 228 && com(`VOCÊ PERDE ${a}`) > LARGURA_UTIL) return texto;
    }
  }
  throw new Error("não achei o gancho do negrito");
}

/**
 * O CONSERVADOR POR UMA LINHA INTEIRA (pedido do Labs): um "palavra-chave" no fim da linha, que o
 * Satori parte no hífen e a conta leva inteiro para baixo. A busca simula a quebra do hífen só para
 * achar o caso; quem confirma é o desenho.
 */
function conteudoComHifenNoFim(): string {
  const simulada = (texto: string, fonte: number) => {
    // A mesma quebra gulosa da conta, com um ponto de quebra a mais depois de cada hífen entre letras.
    const linha = composicaoDoSlide("Manchete", texto).at(-1)!;
    const pedacos = pedacosDaLinha(linha.texto).flatMap((p) => p.split(/(?<=\p{L}-)(?=\p{L})/u));
    let linhas = 0;
    let ocupado = 0;
    for (const p of pedacos) {
      const w = larguraDoTexto(p, fonte, false, 0);
      const semFim = larguraDoTexto(p.trimEnd(), fonte, false, 0);
      if (linhas > 0 && ocupado + w > LARGURA_UTIL + (w - semFim)) {
        linhas++;
        ocupado = w;
      } else {
        linhas = Math.max(linhas, 1);
        ocupado += w;
      }
    }
    return linhas;
  };
  for (let n = 3; n < 30; n++) {
    for (let depois = 1; depois < 25; depois++) {
      for (const p of ["palavra-chave", "follow-up", "pós-venda", "bem-vindo", "e-mail"]) {
        const texto = `${FRASE.slice(0, n).join(" ")} ${p} ${FRASE.slice(n, n + depois).join(" ")}`;
        const conta = quebraDaLinha(composicaoDoSlide("Manchete", texto).at(-1)!, 46).linhas;
        if (simulada(texto, 46) < conta) return texto;
      }
    }
  }
  throw new Error("não achei o hífen no fim da linha");
}

/** As categorias pedidas, escritas à mão (e achadas pela conta onde é fronteira). */
function categorias(): EntradaDoVetor[] {
  const dentro46 = linhaNaFronteira(46, false, "dentro");
  const fora46 = linhaNaFronteira(46, false, "fora");
  const dentro86 = linhaNaFronteira(86, true, "dentro");
  const fora86 = linhaNaFronteira(86, true, "fora");
  const nfd = `VOCE${CIRCUNFLEXO} ESTA${ACENTO_AGUDO} PERDENDO CLIENTES TODOS OS DIAS`;
  return [
    entrada("emoji-com-espaco", "emoji", "gancho", null, `Seu cliente sumiu? ${CHORO} Ele ainda pode voltar ${APONTA}`),
    entrada("emoji-varios", "emoji", "conteudo", "Os três sinais", `${CHECK} Responde no mesmo dia\n${CHECK} Lembra do que ele comprou\n${CHECK} Fecha com uma pergunta ${FOGO}`),
    entrada("emoji-colado", "emoji", "gancho", null, `VENDAS${FOGO}${FOGO}${FOGO} QUE VOLTAM${APONTA}`),
    entrada("pontuacao-com-espaco-antes", "pontuacao", "gancho", null, "VOCÊ RESPONDE RÁPIDO ? ENTÃO PROVE ! HOJE , SEM DESCULPA ; SEM DEMORA : E SEM MEDO ."),
    entrada("pontuacao-parenteses", "pontuacao", "conteudo", "Antes de responder", `Leia a mensagem ( toda ) e pense [ de verdade ] no que ele quer . ${ABRE_ASPAS}Já comprei${FECHA_ASPAS} (mas sumiu) não é um não .`),
    entrada("pontuacao-travessoes", "pontuacao", "conteudo", null, `Responda rápido ${TRAVESSAO} ${TRAVESSAO} mesmo que curto ${TRAVESSAO} e lembre do pedido.`),
    entrada("travessao-colado", "pontuacao", "gancho", null, `O CLIENTE SUMIU${TRAVESSAO}E VOLTOU${TRAVESSAO}QUANDO VOCÊ RESPONDEU CERTO`),
    entrada("paragrafos", "paragrafos", "conteudo", "Três passos", "Responda no mesmo dia.\n\nLembre do que ele comprou.\n\n\nFeche com uma pergunta."),
    entrada("paragrafos-crlf", "paragrafos", "conteudo", null, "Linha um do bloco.\r\nLinha dois do bloco.\r\n\r\nO fechamento."),
    entrada("paragrafos-linha-de-espacos", "paragrafos", "conteudo", null, "Primeiro bloco.\n \t \nSegundo bloco, o fechamento."),
    entrada("quebras-obrigatorias", "paragrafos", "cta", null, `Comente SUMIDO${SEPARADOR_DE_LINHA}e receba as mensagens${SEPARADOR_DE_PARAGRAFO}${SEPARADOR_DE_PARAGRAFO}de graça.`, true, true),
    entrada("linha-860-dentro-regular", "860", "conteudo", "Manchete", dentro46),
    entrada("linha-860-fora-regular", "860", "conteudo", "Manchete", fora46),
    entrada("linha-860-dentro-negrito", "860", "gancho", null, dentro86),
    entrada("linha-860-fora-negrito", "860", "gancho", null, fora86),
    entrada("negrito-decide-o-degrau", "negrito", "gancho", null, ganchoQueSoCabePeloNegrito()),
    entrada("palavra-maior-que-a-linha", "palavra-longa", "gancho", null, "INCONSTITUCIONALISSIMAMENTE CERTO"),
    entrada("arroba-maior-que-a-linha", "palavra-longa", "conteudo", "Siga o perfil", "Todo dia uma ideia nova em @metodovannuchioficialdasvendasonline para você"),
    entrada("url-maior-que-a-linha", "palavra-longa", "gancho", null, "Pegue em https://metodolabs.com.br/bonus/planilha-de-precificacao"),
    entrada("acento-nfd", "nfd", "gancho", null, nfd),
    entrada("espaco-sem-quebra", "nbsp", "conteudo", null, `Custa só R$${NBSP}100 por mês, sem taxa e sem fidelidade, e você cancela quando quiser.`),
    entrada("hifen-no-fim-da-linha", "conservador", "conteudo", "Manchete", conteudoComHifenNoFim()),
  ];
}

export function entradasDosVetores(): EntradaDoVetor[] {
  const todas = [...casosDoLabs(), ...categorias(), ...limites()];
  const nomes = new Set(todas.map((e) => e.nome));
  if (nomes.size !== todas.length) throw new Error("dois vetores com o mesmo nome");
  return todas;
}

export type { SlideParaArte };
```

- [ ] **Passo 2: os testes**

Crie `tests/bonus-arte-vetores.test.ts`:

```ts
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { composicaoDoSlide } from "@/lib/bonus/arte-composicao";
import { alturaDaLinha } from "@/lib/bonus/arte-geometria";
import { medidaDaComposicao } from "@/lib/bonus/arte-medida";
import { tamanhoDoSlide } from "@/lib/bonus/arte-slides";
import { conteudoDosVetores, lerVetores, type Vetor } from "./vetores-da-arte";

// A CONTA CONTRA OS VETORES DESENHADOS (spec da Etapa 4, "Dois donos"; a 48.5 do Labs). O arquivo
// tests/vetores-da-arte.json é o mesmo, byte a byte, nos dois repositórios, e as respostas dele saem do
// desenho no Satori (tests/bonus-arte-desenho.test.ts), e não desta conta. Duas contas escritas pela
// mesma regra erram nos mesmos pontos; o desenho não.

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const sha256 = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
const { origem, vetores } = lerVetores();

/** O sha256 do arquivo em LF, o mesmo que o Labs confere do lado de lá. Muda quando o arquivo muda. */
const SHA256_DOS_VETORES = "a9e1d6a61196b45d172e9a64ab80fa1e8baee09e500356fc89ed0fcf91bd5040";

const conta = (v: Vetor) => {
  const slide = { numero: 2, total: 3, tipo: v.tipo, titulo: v.titulo, texto: v.texto, assinaturaNoPe: v.assinaturaNoPe };
  const t = tamanhoDoSlide(slide, v.comIlustracao);
  const noDegrauDoDesenho = medidaDaComposicao(composicaoDoSlide(v.titulo, v.texto), v.degrau);
  return { ...t, alturaNoDegrauDoDesenho: noDegrauDoDesenho.altura, vazaNoDegrauDoDesenho: noDegrauDoDesenho.vaza };
};

describe("o arquivo dos vetores", () => {
  it("é o combinado com o Labs, pelo sha256 do conteúdo em LF", () => {
    expect(sha256(conteudoDosVetores())).toBe(SHA256_DOS_VETORES);
  });

  it("foi desenhado com as fontes daqui", () => {
    for (const [nome, hash] of Object.entries(origem.fontes)) {
      expect(sha256(readFileSync(`${RAIZ}/lib/bonus/fonte/${nome}`)), nome).toBe(hash);
    }
  });

  // As categorias que o Labs pediu, e os 4 casos da comparação desenhada por ele.
  it("cobre as categorias combinadas", () => {
    const categorias = new Set(vetores.map((v) => v.categoria));
    for (const c of ["labs", "limite", "emoji", "pontuacao", "paragrafos", "860", "palavra-longa", "nfd", "negrito", "conservador"]) {
      expect(categorias, c).toContain(c);
    }
    expect(vetores.filter((v) => v.categoria === "labs")).toHaveLength(4);
    // A régua: o gancho nos quatro degraus e no piso, com o espaço da imagem.
    const degrausDoGancho = new Set(vetores.filter((v) => v.nome.startsWith("limite-gancho-com-")).map((v) => v.degrau));
    expect([...degrausDoGancho].sort((a, b) => b - a)).toEqual([86, 72, 56, 46, 34]);
  });
});

describe("os vetores exatos: a conta dá o que o desenho deu", () => {
  it.each(vetores.filter((v) => v.exato).map((v) => [v.nome, v] as const))("%s", (_, v) => {
    const c = conta(v);
    expect({ degrau: c.fonte, cabe: c.cabe, altura: c.alturaNoDegrauDoDesenho }).toEqual({
      degrau: v.degrau,
      cabe: v.cabe,
      altura: v.alturaDesenhada,
    });
  });
});

// Onde o Satori quebra também dentro da palavra (hífen, travessão e emoji colados, URL), a conta só
// quebra no espaço, e erra para o lado seguro: nunca um degrau maior, nunca "cabe" onde o desenho
// não cabe, e, no degrau do desenho, nunca menos altura (ou então ela recusa o degrau porque a
// palavra inteira vazaria, como a URL que o Satori parte na barra).
describe("os vetores conservadores: a conta erra só para o lado seguro", () => {
  it.each(vetores.filter((v) => !v.exato).map((v) => [v.nome, v] as const))("%s", (_, v) => {
    const c = conta(v);
    expect(c.fonte).toBeLessThanOrEqual(v.degrau);
    if (c.cabe) expect(v.cabe).toBe(true);
    if (!c.vazaNoDegrauDoDesenho) expect(c.alturaNoDegrauDoDesenho).toBeGreaterThanOrEqual(v.alturaDesenhada);
  });

  it("há um caso em que a conta erra por uma linha inteira", () => {
    const v = vetores.find((x) => x.categoria === "conservador")!;
    expect(v.exato).toBe(false);
    expect(conta(v).alturaNoDegrauDoDesenho - v.alturaDesenhada).toBeGreaterThanOrEqual(alturaDaLinha(v.degrau));
  });
});
```

Crie `tests/bonus-arte-desenho.test.ts`:

```ts
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { alturaDisponivel } from "@/lib/bonus/arte-geometria";
import { degrausDoSlide } from "@/lib/bonus/arte-slides";
import { desenharSlide, respostaDoDesenho, slideDoVetor, soQuebraNoEspaco, SVG_DO_EMOJI } from "./arte-desenhada";
import { entradasDosVetores } from "./arte-vetores-entradas";
import {
  ARQUIVO_DOS_VETORES,
  CONTA,
  lerVetores,
  MEDIDA,
  NORMALIZACAO,
  SOBRE,
  textoDosVetores,
  type Vetor,
} from "./vetores-da-arte";

// A RÉGUA E OS VETORES, DESENHADOS (spec da Etapa 4, "A régua, como teste" e "Dois donos"). Cada vetor
// de tests/vetores-da-arte.json é desenhado de novo no Satori daqui, com a coluna do texto e o espaço
// da imagem pintados (tests/arte-desenhada.tsx), e o PNG tem de responder o que o arquivo diz: a
// altura e o cabe no degrau dele, e o degrau de cima não cabe. É aqui que uma mudança no desenho, no
// Satori ou na fonte aparece. O Labs desenha o mesmo arquivo no Satori de lá.
//
// A RÉGUA está dentro: os vetores "limite-" são o maior texto que a conta aceita em cada degrau, por
// tipo, modo e estilo, e "cabe" no desenho é a última linha escura acima de 1240 sem nada vazar.
//
// GERAR o arquivo (quando o desenho muda de propósito, combinado com o Labs):
//   GERAR_VETORES_DA_ARTE=1 npx vitest run tests/bonus-arte-desenho.test.ts
// e atualizar o sha256 em tests/bonus-arte-vetores.test.ts.

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const sha256 = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");

// O emoji vem da rede no desenho (o og busca o SVG em cdn.jsdelivr.net). Aqui ele vem de um SVG fixo:
// a largura do emoji é 1em, seja qual for o desenho. O resto do `fetch` (os .wasm do og) segue o real.
beforeAll(() => {
  const real = globalThis.fetch;
  vi.stubGlobal("fetch", (u: RequestInfo | URL, i?: RequestInit) =>
    String(u).startsWith("https://cdn.jsdelivr.net/") ? Promise.resolve(new Response(SVG_DO_EMOJI)) : real(u, i)
  );
});
afterAll(() => {
  vi.unstubAllGlobals();
});

/** De onde o arquivo saiu: o Satori, as fontes e o desenho, cada um pelo sha256. */
function origem() {
  const require = createRequire(import.meta.url);
  const og = require.resolve("next/dist/compiled/@vercel/og/package.json").replace(/package\.json$/, "");
  const versaoDoOg = JSON.parse(readFileSync(`${og}package.json`, "utf8")).version as string;
  const versaoDoNext = JSON.parse(readFileSync(require.resolve("next/package.json"), "utf8")).version as string;
  return {
    satori: `o do @vercel/og ${versaoDoOg} compilado no Next ${versaoDoNext}`,
    og: `index.node.js sha256 ${sha256(readFileSync(`${og}index.node.js`))}`,
    fontes: Object.fromEntries(
      ["Carlito-Regular.ttf", "Carlito-Bold.ttf"].map((n) => [n, sha256(readFileSync(`${RAIZ}/lib/bonus/fonte/${n}`))])
    ),
    desenho: {
      "lib/bonus/arte-desenho.tsx": sha256(readFileSync(`${RAIZ}/lib/bonus/arte-desenho.tsx`, "utf8").replace(/\r\n/g, "\n")),
    },
  };
}

if (process.env.GERAR_VETORES_DA_ARTE === "1") {
  it("gera tests/vetores-da-arte.json desenhando cada entrada", async () => {
    const vetores: Vetor[] = [];
    for (const e of entradasDosVetores()) {
      const resposta = await respostaDoDesenho(e).catch((erro: unknown) => {
        throw new Error(`${e.nome}: ${String(erro)}`);
      });
      vetores.push({ ...e, exato: await soQuebraNoEspaco(slideDoVetor(e)), ...resposta });
    }
    writeFileSync(
      ARQUIVO_DOS_VETORES,
      textoDosVetores({ sobre: SOBRE, origem: origem(), normalizacao: NORMALIZACAO, conta: CONTA, medida: MEDIDA, vetores })
    );
  }, 900_000);
} else {
  const { vetores } = lerVetores();

  describe("cada vetor, desenhado de novo aqui", () => {
    it.each(vetores.map((v) => [v.nome, v] as const))("%s", async (_, v) => {
      const slide = slideDoVetor(v);
      const degraus = degrausDoSlide(v.tipo, v.comIlustracao);
      const i = degraus.indexOf(v.degrau);
      expect(i, "o degrau é da escada do tipo").toBeGreaterThanOrEqual(0);
      if (!v.cabe) expect(i, "o que não cabe está no piso").toBe(degraus.length - 1);

      const d = await desenharSlide(slide, v.degrau, v.comIlustracao);
      expect({ altura: d.altura, cabe: d.cabe }).toEqual({ altura: v.alturaDesenhada, cabe: v.cabe });
      // A geometria diz a verdade: o limite de 334 (ou 955) é o que o pixel mostra.
      expect(d.cabe).toBe(!d.vaza && d.altura <= alturaDisponivel(v.comIlustracao));
      if (i > 0) expect((await desenharSlide(slide, degraus[i - 1], v.comIlustracao)).cabe, "o degrau de cima não cabe").toBe(false);

      expect(await soQuebraNoEspaco(slide), "exato").toBe(v.exato);
    }, 60_000);
  });
}
```

- [ ] **Passo 3: ver falhar**

```bash
npx vitest run tests/bonus-arte-vetores.test.ts tests/bonus-arte-desenho.test.ts
```

Esperado: os dois arquivos caem sem rodar caso nenhum, com `ENOENT` de `tests/vetores-da-arte.json`.

- [ ] **Passo 4: os vetores, gerados desenhando**

Leva um pouco mais de um minuto: 138 entradas, cada uma desenhada degrau a degrau.

Gere `tests/vetores-da-arte.json` rodando, da raiz:

```bash
GERAR_VETORES_DA_ARTE=1 npx vitest run tests/bonus-arte-desenho.test.ts
```

Confira os bytes, e não o que a tela mostra:

```bash
node -e 'const b=require("fs").readFileSync("tests/vetores-da-arte.json"); console.log(b.length, [...b].filter((x)=>x>0x7e).length, [...b].filter((x)=>x===13).length, require("crypto").createHash("sha256").update(b).digest("hex"))'
```

Esperado: `63295 0 0 a9e1d6a61196b45d172e9a64ab80fa1e8baee09e500356fc89ed0fcf91bd5040`.

- [ ] **Passo 5: ver passar**

```bash
npx tsc --noEmit
npx vitest run tests/bonus-arte-vetores.test.ts tests/bonus-arte-desenho.test.ts
npm test
```

Esperado: `tsc` limpo; 280 casos passam (142 puros contra os vetores e 138 desenhados); a suíte pura com 94 arquivos e 2 712 casos.

- [ ] **Passo 6: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" tests/arte-desenhada.tsx tests/vetores-da-arte.ts tests/arte-vetores-entradas.ts tests/bonus-arte-vetores.test.ts tests/bonus-arte-desenho.test.ts tests/vetores-da-arte.json
test "$(git branch --show-current)" = "pagina-do-carrossel"
git add tests/arte-desenhada.tsx tests/vetores-da-arte.ts tests/arte-vetores-entradas.ts tests/bonus-arte-vetores.test.ts tests/bonus-arte-desenho.test.ts tests/vetores-da-arte.json
git commit -m "test(bonus): os vetores da arte combinados com o Labs, e a régua desenhada"
```

- [ ] **Passo 7: mandar ao Labs** o hash deste commit, o sha256 do arquivo e o do
  `lib/bonus/arte-desenho.tsx` em LF (os dois estão no cabeçalho do arquivo). O Labs desenha os
  mesmos vetores no Satori de lá na 48.5 dele.

---

### FASE 4.5 — As partes do carrossel e a versão de cada miniatura

**Arquivos:**
- Modificar: `lib/bonus/carrossel-texto.ts`, `lib/bonus/arte-tela.ts`, `lib/bonus/arte-cabimento.ts`
- Testar: `tests/bonus-carrossel-partes.test.ts` (novo), `tests/bonus-arte-tela.test.ts`

**Interfaces:**
- Produz, de `carrossel-texto.ts`: `type ProblemaDoCampo = { campo; erro }`,
  `type ParteDoCarrossel = { tipo: "slide"; numero } | { tipo: "legenda" }`,
  `camposDaParte(total, parte): string[]` (a regra única de quais campos formam cada slide),
  `lerParte(bruta, total)` (`"legenda"` ou `slide_N`), e
  `juntarParte(total, palavra, atual, parte, bruto)`, que recusa só pelos problemas da parte e
  devolve os outros como `avisos`. `lerRevisaoDoCarrossel` passa a usar as mesmas
  `conferirCampos` e `montarTexto`.
- Produz, de `arte-tela.ts`: `versoesDosSlides(slides, soTexto, cabecalho): string[]` (uma versão
  por slide) e `cabecalhoParaVersao(conta)`. `campoDoAviso` (arte-cabimento.ts) passa a sair de
  `camposDaParte`.

- [ ] **Passo 1: os testes**

Crie `tests/bonus-carrossel-partes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { campoDoAviso } from "@/lib/bonus/arte-cabimento";
import { slidesDoTexto } from "@/lib/bonus/arte-slides";
import {
  camposDaParte,
  camposDoFormulario,
  juntarParte,
  lerParte,
  type TextoDeCarrossel,
  type TextoDePost,
} from "@/lib/bonus/carrossel-texto";

// AS PARTES DO CARROSSEL (spec da Etapa 4, "Qual campo é o slide N" e "Salvar um slide"). Cada slide
// tem o seu card e o seu "Salvar slide N", e a legenda tem o dela. Uma função só diz quais campos
// formam cada parte, e o salvar junta a parte ao texto salvo e recusa só pelos problemas dela.

const slide = (i: number) => ({
  titulo: `Título do slide ${i}`,
  texto: `Texto do slide ${i}, com mais de trinta caracteres.`,
});
const CARROSSEL: TextoDeCarrossel = {
  tipo: "carrossel",
  titulo: "Mensagens para reativar clientes",
  gancho: "Seu cliente sumiu? Não é culpa dele.",
  slides: [slide(1), slide(2), slide(3)],
  chamada: "Comente SUMIDO e receba as mensagens prontas.",
  legenda:
    "Quem sumiu ainda pode voltar. Comente SUMIDO que eu te mando as mensagens prontas para usar hoje mesmo.",
};
const POST: TextoDePost = {
  tipo: "post",
  titulo: "Mensagens para reativar clientes",
  texto: "T".repeat(80),
  chamada: CARROSSEL.chamada,
  legenda: CARROSSEL.legenda,
};
const doSlide = (numero: number) => ({ tipo: "slide" as const, numero });

describe("qual campo é o slide N", () => {
  it.each([
    [1, 1, ["texto", "chamada"]],
    [2, 1, ["gancho"]],
    [2, 2, ["chamada"]],
    [3, 1, ["gancho"]],
    [3, 2, ["slide_1_titulo", "slide_1_texto"]],
    [3, 3, ["chamada"]],
    [10, 1, ["gancho"]],
    [10, 5, ["slide_4_titulo", "slide_4_texto"]],
    [10, 10, ["chamada"]],
  ])("total %i, slide %i: %j", (total, numero, campos) => {
    expect(camposDaParte(total, doSlide(numero))).toEqual(campos);
  });

  it("a legenda é parte própria, e slide fora do carrossel não tem campo", () => {
    expect(camposDaParte(5, { tipo: "legenda" })).toEqual(["legenda"]);
    expect(camposDaParte(5, doSlide(0))).toEqual([]);
    expect(camposDaParte(5, doSlide(6))).toEqual([]);
  });

  it.each([1, 2, 3, 4, 10])("total %i: os slides e a legenda cobrem os campos do formulário, uma vez cada, na ordem", (total) => {
    const partes = [
      ...Array.from({ length: total }, (_, i) => camposDaParte(total, doSlide(i + 1))).flat(),
      ...camposDaParte(total, { tipo: "legenda" }),
    ];
    expect(partes).toEqual(camposDoFormulario(total).map((c) => c.nome));
  });

  it.each([1, 2, 3, 10])("total %i: o aviso do não cabe de cada slide cai num campo daquele slide", (total) => {
    for (let n = 1; n <= total; n++) expect(camposDaParte(total, doSlide(n))).toContain(campoDoAviso(n, total));
  });

  it("os slides da arte são os mesmos: gancho, conteúdo e chamada, na ordem", () => {
    expect(slidesDoTexto(CARROSSEL).map((s) => s.tipo)).toEqual(["gancho", "conteudo", "conteudo", "conteudo", "cta"]);
    expect(slidesDoTexto(POST)).toHaveLength(1);
  });
});

describe("a parte que o formulário diz salvar", () => {
  it.each([
    ["slide_1", doSlide(1)],
    ["slide_5", doSlide(5)],
    ["legenda", { tipo: "legenda" }],
  ])("%s", (bruta, parte) => {
    expect(lerParte(bruta, 5)).toEqual(parte);
  });

  it.each(["slide_0", "slide_6", "slide_01", "slide_x", "gancho", "", null, 3])("recusa %j", (bruta) => {
    expect(lerParte(bruta, 5)).toBeNull();
  });
});

describe("juntar uma parte ao texto salvo", () => {
  it("troca só os campos da parte; o resto vem do texto salvo, mesmo se o formulário trouxer mais", () => {
    const r = juntarParte(5, "SUMIDO", CARROSSEL, doSlide(3), {
      slide_2_titulo: "Outro título do slide",
      slide_2_texto: "Outro texto do slide dois, com mais de trinta.",
      gancho: "isto não entra",
    });
    expect(r).toEqual({
      ok: true,
      texto: {
        ...CARROSSEL,
        slides: [slide(1), { titulo: "Outro título do slide", texto: "Outro texto do slide dois, com mais de trinta." }, slide(3)],
      },
      avisos: [],
    });
  });

  it("recusa pelo problema da parte salva", () => {
    expect(juntarParte(5, "SUMIDO", CARROSSEL, doSlide(5), { chamada: "Comente PROMPT e receba as mensagens." })).toEqual({
      ok: false,
      problemas: [{ campo: "chamada", erro: "precisa pedir a palavra SUMIDO" }],
    });
  });

  // Uma regra que mude num deploy pode deixar outro campo inválido no texto salvo. Sem isto, todo
  // "Salvar slide N" seria recusado por causa do outro campo, e sem "salvar tudo" não haveria saída.
  it("um problema em OUTRO campo vira aviso, e não impede o salvar", () => {
    const velho = { ...CARROSSEL, chamada: "Comente PROMPT e receba as mensagens." };
    const gancho = "Seu cliente sumiu? Traga ele de volta.";
    expect(juntarParte(5, "SUMIDO", velho, doSlide(1), { gancho })).toEqual({
      ok: true,
      texto: { ...velho, gancho },
      avisos: [{ campo: "chamada", erro: "precisa pedir a palavra SUMIDO" }],
    });
  });

  it("a parte é limpa como no salvar de tudo: o \\r\\n vira \\n, e as pontas saem", () => {
    const r = juntarParte(5, "SUMIDO", CARROSSEL, doSlide(1), { gancho: "  Seu cliente sumiu?\r\nNão é culpa dele.  " });
    expect(r.ok && r.texto.tipo === "carrossel" && r.texto.gancho).toBe("Seu cliente sumiu?\nNão é culpa dele.");
  });

  it("campo da parte que falta no formulário conta como vazio, e é recusado", () => {
    const r = juntarParte(5, "SUMIDO", CARROSSEL, doSlide(1), {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problemas.map((p) => p.campo)).toEqual(["gancho"]);
  });

  it("no post, o slide 1 é o texto e a chamada", () => {
    const texto = "U".repeat(90);
    expect(juntarParte(1, "SUMIDO", POST, doSlide(1), { texto, chamada: POST.chamada })).toEqual({
      ok: true,
      texto: { ...POST, texto },
      avisos: [],
    });
  });

  it("a legenda se salva sozinha, e sem a palavra é recusada", () => {
    const legenda = `${CARROSSEL.legenda} Vale para quem sumiu há meses.`;
    expect(juntarParte(5, "SUMIDO", CARROSSEL, { tipo: "legenda" }, { legenda })).toEqual({
      ok: true,
      texto: { ...CARROSSEL, legenda },
      avisos: [],
    });
    expect(juntarParte(5, "SUMIDO", CARROSSEL, { tipo: "legenda" }, { legenda: "x".repeat(100) }).ok).toBe(false);
  });
});
```

Em `tests/bonus-arte-tela.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-arte-tela.test.ts b/tests/bonus-arte-tela.test.ts
index 738246e..4e01252 100644
--- a/tests/bonus-arte-tela.test.ts
+++ b/tests/bonus-arte-tela.test.ts
@@ -7,9 +7,13 @@ import {
   numeroDoSlide,
   urlDaArte,
   versaoDaArte,
+  versoesDosSlides,
+  type CabecalhoDaArte,
 } from "@/lib/bonus/arte-tela";
+import { slidesDoTexto } from "@/lib/bonus/arte-slides";
 import { TEXTO_ARTE_NAO_ENCONTRADA, TEXTO_ARTE_NAO_PRONTA, TEXTO_ARTE_SLIDE_INVALIDO } from "@/lib/bonus/arte-textos";
 import type { LinhaDoCarrossel } from "@/lib/bonus/carrossel-linha";
+import type { TextoDeCarrossel } from "@/lib/bonus/carrossel-texto";
 
 // O QUE A ROTA DA ARTE E A TELA DECIDEM, fora do JSX e da rota: o número do slide pedido, o nome do
 // arquivo baixado, os cabeçalhos da resposta, o cabeçalho da peça e a versão da prévia.
@@ -109,6 +113,52 @@ describe("a versão da prévia", () => {
   });
 });
 
+// A VERSÃO DE CADA MINIATURA (spec da Etapa 4): o resumo de tudo o que a rota desenha NAQUELE slide.
+// Salvar o slide 2 muda só a versão 2, e só a miniatura 2 é pedida de novo; o cabeçalho é de todos.
+describe("a versão de cada miniatura", () => {
+  const texto: TextoDeCarrossel = {
+    tipo: "carrossel",
+    titulo: "Nome interno",
+    gancho: "Seu cliente sumiu? Não é culpa dele.",
+    slides: [{ titulo: "O que fazer primeiro", texto: "Mande uma mensagem curta, lembrando do que ele comprou." }],
+    chamada: "Comente SUMIDO e receba as mensagens prontas.",
+    legenda: "x".repeat(100),
+  };
+  const CAB: CabecalhoDaArte = { nome: "Thiago Vannuchi", arroba: "thiagovannuchi", foto: "https://foto", iniciais: "TV" };
+  const base = versoesDosSlides(slidesDoTexto(texto), [], CAB);
+
+  it("uma versão por slide, e a mesma para as mesmas entradas", () => {
+    expect(base).toHaveLength(3);
+    expect(versoesDosSlides(slidesDoTexto(texto), [], CAB)).toEqual(base);
+    expect(new Set(base).size).toBe(3);
+  });
+
+  it.each([
+    ["o texto do slide 2", () => versoesDosSlides(slidesDoTexto({ ...texto, slides: [{ ...texto.slides[0], texto: "Outro texto do slide, com mais de trinta." }] }), [], CAB)],
+    ["a manchete do slide 2", () => versoesDosSlides(slidesDoTexto({ ...texto, slides: [{ ...texto.slides[0], titulo: "Outra manchete" }] }), [], CAB)],
+    ["o só texto do slide 2", () => versoesDosSlides(slidesDoTexto(texto), [2], CAB)],
+  ])("%s muda só a versão do slide 2", (_nome, outra) => {
+    const v = outra();
+    expect([v[0] === base[0], v[1] === base[1], v[2] === base[2]]).toEqual([true, false, true]);
+  });
+
+  it.each([
+    ["o nome", { ...CAB, nome: "Outro nome" }],
+    ["o @", { ...CAB, arroba: "outra" }],
+    ["a foto", { ...CAB, foto: "https://outra-foto" }],
+    ["sem foto", { ...CAB, foto: null }],
+    ["as iniciais", { ...CAB, iniciais: "OU" }],
+  ])("%s do cabeçalho muda a versão de todos", (_nome, cab) => {
+    const v = versoesDosSlides(slidesDoTexto(texto), [], cab);
+    expect(v.map((x, i) => x === base[i])).toEqual([false, false, false]);
+  });
+
+  it("o número e o total de cada slide entram: o mesmo texto noutra posição tem outra versão", () => {
+    const com4 = versoesDosSlides(slidesDoTexto({ ...texto, slides: [texto.slides[0], texto.slides[0]] }), [], CAB);
+    expect(com4[0]).not.toBe(base[0]);
+  });
+});
+
 // O QUE A ROTA CONFERE ANTES DE DESENHAR, depois da sessão e dos ids: o carrossel existe e é do
 // bônus da URL, está pronto com texto de forma válida, e o slide pedido existe nele. A rota só se
 // prova sem sessão na integração (o harness não forja cookie); estas recusas se provam aqui.
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-carrossel-partes.test.ts tests/bonus-arte-tela.test.ts
```

Esperado: os dois arquivos caem: 37 casos caem e 1 passa (38).

- [ ] **Passo 3: o código**

Em `lib/bonus/carrossel-texto.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/carrossel-texto.ts b/lib/bonus/carrossel-texto.ts
index ba9dff4..57594ce 100644
--- a/lib/bonus/carrossel-texto.ts
+++ b/lib/bonus/carrossel-texto.ts
@@ -183,6 +183,8 @@ function texto(v: unknown): string {
   return typeof v === "string" ? v.replace(/\r\n?/g, "\n").trim() : "";
 }
 
+export type ProblemaDoCampo = { campo: string; erro: string };
+
 /**
  * A revisão do operador. O número de slides não muda (vem do pedido), o título interno não se
  * edita, e a palavra vem da linha, nunca do formulário.
@@ -192,9 +194,19 @@ export function lerRevisaoDoCarrossel(
   palavra: string,
   titulo: string,
   bruto: Record<string, unknown>
-): { ok: true; texto: TextoDoCarrossel } | { ok: false; problemas: { campo: string; erro: string }[] } {
+): { ok: true; texto: TextoDoCarrossel } | { ok: false; problemas: ProblemaDoCampo[] } {
+  const { valores, problemas } = conferirCampos(total, palavra, bruto);
+  return problemas.length ? { ok: false, problemas } : { ok: true, texto: montarTexto(total, titulo, valores) };
+}
+
+/** Os campos limpos (o \r\n e as pontas), e os problemas de cada um, na ordem da tela. */
+function conferirCampos(
+  total: number,
+  palavra: string,
+  bruto: Record<string, unknown>
+): { valores: Record<string, string>; problemas: ProblemaDoCampo[] } {
   const v: Record<string, string> = {};
-  const problemas: { campo: string; erro: string }[] = [];
+  const problemas: ProblemaDoCampo[] = [];
   for (const c of camposDoFormulario(total)) {
     const t = texto(bruto[c.nome]);
     v[c.nome] = t;
@@ -214,17 +226,65 @@ export function lerRevisaoDoCarrossel(
   if (v.legenda && !temPalavra(v.legenda, palavra)) {
     problemas.push({ campo: "legenda", erro: `precisa pedir a palavra ${palavra}` });
   }
-  if (problemas.length) return { ok: false, problemas };
+  return { valores: v, problemas };
+}
 
-  if (total === 1) {
-    return { ok: true, texto: { tipo: "post", titulo, texto: v.texto, chamada: v.chamada, legenda: v.legenda } };
-  }
+/** O texto do Chat a partir dos campos já limpos. */
+function montarTexto(total: number, titulo: string, v: Record<string, string>): TextoDoCarrossel {
+  if (total === 1) return { tipo: "post", titulo, texto: v.texto, chamada: v.chamada, legenda: v.legenda };
   const slides = Array.from({ length: slidesDeConteudo(total) }, (_, i) => ({
     titulo: v[`slide_${i + 1}_titulo`],
     texto: v[`slide_${i + 1}_texto`],
   }));
-  return {
-    ok: true,
-    texto: { tipo: "carrossel", titulo, gancho: v.gancho, slides, chamada: v.chamada, legenda: v.legenda },
-  };
+  return { tipo: "carrossel", titulo, gancho: v.gancho, slides, chamada: v.chamada, legenda: v.legenda };
+}
+
+/** Uma parte do carrossel que se salva sozinha: um slide, ou a legenda (spec da Etapa 4). */
+export type ParteDoCarrossel = { tipo: "slide"; numero: number } | { tipo: "legenda" };
+
+/**
+ * QUAL CAMPO É O SLIDE N: a regra única, usada pela tela, pelo aviso do "não cabe" (`campoDoAviso`)
+ * e pelo salvar de um slide. Ela segue a ordem da arte (`slidesDoTexto`): no carrossel, o slide 1 é
+ * o gancho, os do meio são os de conteúdo, e o último é a chamada; no post, o slide 1 junta o texto e
+ * a chamada. A legenda e o título interno nunca são slide. Slide fora do carrossel não tem campo.
+ */
+export function camposDaParte(total: number, parte: ParteDoCarrossel): string[] {
+  if (parte.tipo === "legenda") return ["legenda"];
+  const n = parte.numero;
+  if (!Number.isInteger(n) || n < 1 || n > total) return [];
+  if (total === 1) return ["texto", "chamada"];
+  if (n === 1) return ["gancho"];
+  if (n === total) return ["chamada"];
+  return [`slide_${n - 1}_titulo`, `slide_${n - 1}_texto`];
+}
+
+/** A parte que o formulário diz salvar ("slide_N" ou "legenda"), ou null. */
+export function lerParte(bruta: unknown, total: number): ParteDoCarrossel | null {
+  if (bruta === "legenda") return { tipo: "legenda" };
+  const m = typeof bruta === "string" ? /^slide_([1-9]\d*)$/.exec(bruta) : null;
+  const numero = m ? Number(m[1]) : 0;
+  return numero >= 1 && numero <= total ? { tipo: "slide", numero } : null;
+}
+
+/**
+ * JUNTA UMA PARTE AO TEXTO SALVO e confere o texto inteiro, como o salvar de tudo, mas RECUSA SÓ
+ * PELOS PROBLEMAS DA PARTE. Um problema em outro campo volta como aviso: uma regra que mude num
+ * deploy pode deixar outro campo inválido no texto salvo, e sem isto todo "Salvar slide N" seria
+ * recusado por causa dele, sem saída (spec da Etapa 4, "Salvar um slide"). Os campos que o
+ * formulário trouxer fora da parte são ignorados.
+ */
+export function juntarParte(
+  total: number,
+  palavra: string,
+  atual: TextoDoCarrossel,
+  parte: ParteDoCarrossel,
+  bruto: Record<string, unknown>
+): { ok: true; texto: TextoDoCarrossel; avisos: ProblemaDoCampo[] } | { ok: false; problemas: ProblemaDoCampo[] } {
+  const campos = camposDaParte(total, parte);
+  const junto: Record<string, unknown> = { ...valoresPorCampo(atual) };
+  for (const c of campos) junto[c] = bruto[c];
+  const { valores, problemas } = conferirCampos(total, palavra, junto);
+  const daParte = problemas.filter((p) => campos.includes(p.campo));
+  if (daParte.length) return { ok: false, problemas: daParte };
+  return { ok: true, texto: montarTexto(total, atual.titulo, valores), avisos: problemas };
 }
```

Em `lib/bonus/arte-tela.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/arte-tela.ts b/lib/bonus/arte-tela.ts
index 997bfdd..fb2486e 100644
--- a/lib/bonus/arte-tela.ts
+++ b/lib/bonus/arte-tela.ts
@@ -78,6 +78,28 @@ export function versaoDaArte(partes: (string | number | null)[]): string {
   return h.toString(16).padStart(8, "0");
 }
 
+/**
+ * A VERSÃO DE CADA MINIATURA (spec da Etapa 4): o resumo de tudo o que a rota desenha NAQUELE slide
+ * (o slide inteiro, com número, total, tipo, manchete e texto; se ele é só texto) e do cabeçalho, que é
+ * de todos. Salvar o slide 2 muda só a versão 2, e só a miniatura 2 é pedida de novo. Até a Etapa 3
+ * a versão era uma só, e qualquer gravação pedia as miniaturas todas.
+ *
+ * O `foto` do cabeçalho, aqui, é a URL da foto (a página não tem o `data:` que a rota desenha): a
+ * miniatura troca quando a Meta troca a foto.
+ */
+export function versoesDosSlides(slides: SlideParaArte[], soTexto: number[], cabecalho: CabecalhoDaArte): string[] {
+  return slides.map((s) =>
+    versaoDaArte([
+      JSON.stringify(s),
+      soTexto.includes(s.numero) ? "so_texto" : "com_espaco",
+      cabecalho.nome,
+      cabecalho.arroba,
+      cabecalho.foto,
+      cabecalho.iniciais,
+    ])
+  );
+}
+
 export function urlDaArte(bonusId: string, carrosselId: string, numero: number, versao: string, baixar = false): string {
   return `/bonus/${bonusId}/carrossel/${carrosselId}/arte?slide=${numero}&v=${versao}${baixar ? "&baixar=1" : ""}`;
 }
```

Em `lib/bonus/arte-cabimento.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/arte-cabimento.ts b/lib/bonus/arte-cabimento.ts
index 95fd94d..94d3c0c 100644
--- a/lib/bonus/arte-cabimento.ts
+++ b/lib/bonus/arte-cabimento.ts
@@ -8,7 +8,7 @@
 import { slidesDoTexto, slidesQueNaoCabem } from "./arte-slides";
 import { textoNaoCabeComEspaco, textoNaoCabeNunca } from "./arte-textos";
 import { slidesDeConteudo } from "./carrossel-pedido";
-import type { TextoDoCarrossel } from "./carrossel-texto";
+import { camposDaParte, type TextoDoCarrossel } from "./carrossel-texto";
 
 /** O \r\n do textarea volta a ser \n, e as pontas em branco saem: é como a revisão grava. */
 function limpo(v: string | undefined): string {
@@ -39,12 +39,14 @@ export function textoDosCampos(total: number, valores: Record<string, string>):
   };
 }
 
-/** O campo do editor onde aparece o aviso do slide: o corpo dele. */
+/**
+ * O campo do editor onde aparece o aviso do slide: o corpo dele. Sai de `camposDaParte`, a regra
+ * única de quais campos formam cada slide (spec da Etapa 4): no post, o primeiro (o texto, e não a
+ * chamada); nos outros, o último (o texto do slide de conteúdo, e não a manchete).
+ */
 export function campoDoAviso(numero: number, total: number): string {
-  if (total === 1) return "texto";
-  if (numero === 1) return "gancho";
-  if (numero === total) return "chamada";
-  return `slide_${numero - 1}_texto`;
+  const campos = camposDaParte(total, { tipo: "slide", numero });
+  return total === 1 ? campos[0] : campos[campos.length - 1];
 }
 
 /**
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx vitest run tests/bonus-carrossel-partes.test.ts tests/bonus-arte-tela.test.ts
```

Esperado: `tsc` limpo e 77 casos passam.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/carrossel-texto.ts lib/bonus/arte-tela.ts lib/bonus/arte-cabimento.ts tests/bonus-carrossel-partes.test.ts tests/bonus-arte-tela.test.ts
test "$(git branch --show-current)" = "pagina-do-carrossel"
git add lib/bonus/carrossel-texto.ts lib/bonus/arte-tela.ts lib/bonus/arte-cabimento.ts tests/bonus-carrossel-partes.test.ts tests/bonus-arte-tela.test.ts
git commit -m "feat(bonus): as partes do carrossel e a versão de cada miniatura"
```

---

### FASE 4.6 — A conta do carrossel

**Arquivos:**
- Modificar: `lib/bonus/arte-conta.ts`, `lib/bonus/arte-escolhas.ts`, `lib/bonus/arte-textos.ts`,
  `lib/bonus/carrossel-repositorio.ts`, `app/bonus/carrossel-actions.ts`,
  `app/bonus/[id]/carrossel/[cid]/arte/route.tsx`, `app/bonus/[id]/carrossel/[cid]/page.tsx`
- Testar: `tests/bonus-arte-conta.test.ts`, `tests/bonus-arte-escolhas.test.ts`,
  `tests/bonus-arte-cabimento.test.ts`, `tests/bonus-carrossel-paginas.test.ts`,
  `testes-integracao/bonus-carrossel-processo.integracao.ts`,
  `testes-integracao/bonus-carrossel-acoes.integracao.ts`

**Interfaces:**
- Produz, de `arte-conta.ts`: `type ContaGuardada = { conta; nome; arroba }`,
  `type OrigemDaConta = "gravada" | "guardada" | "selecionada" | "gravada_saiu"`,
  `contaSelecionada(contas, cookie)`, `contaParaGuardar(c)`, `resolverConta(contas, guardada,
  cookie)`, `contaParaGerarDeNovo(contas, original, cookie)` e `nomeQueFalta(contas, guardada)`.
- Produz, de `arte-escolhas.ts`: `type EscolhasDaArte = { conta; nome; arroba; soTexto }`,
  `type RecusaDaArte = "slide" | "ja_tem_conta" | "sem_conta"` e `lerSoTextoDoFormulario(bruto,
  total)` (sai `lerEscolhasDoFormulario`).
- Produz, de `carrossel-repositorio.ts`: `criarPedidoDeCarrossel({ ..., conta: ContaGuardada |
  null })`, `salvarSoTextoDaArte(id, soTexto, nomeQueFalta)` (`arte = arte || ...`, só em
  carrossel pronto) e `fixarContaDoCarrossel(id, conta)` (só sem conta: `not (arte ? 'conta')`).
  Sai `salvarEscolhasDaArte`.
- Produz, de `carrossel-actions.ts`: o pedido grava a conta logada com o nome e o @
  (`contaDoPedido`); o "Gerar de novo" herda a do original (`contaParaGerarDeNovo`);
  `salvarArteDoCarrossel` grava só o "só texto"; `fixarContaDoCarrossel(anterior, form)`, nova.
  Nenhuma action lê `conta` do formulário.

- [ ] **Passo 1: os testes**

Em `tests/bonus-arte-conta.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-arte-conta.test.ts b/tests/bonus-arte-conta.test.ts
index 462b0d8..060028f 100644
--- a/tests/bonus-arte-conta.test.ts
+++ b/tests/bonus-arte-conta.test.ts
@@ -1,42 +1,115 @@
 import { describe, expect, it } from "vitest";
-import { iniciais, resolverConta, type ContaDoCabecalho } from "@/lib/bonus/arte-conta";
+import {
+  contaParaGerarDeNovo,
+  contaParaGuardar,
+  contaSelecionada,
+  iniciais,
+  nomeQueFalta,
+  resolverConta,
+  type ContaDoCabecalho,
+  type ContaGuardada,
+} from "@/lib/bonus/arte-conta";
 
-// A CONTA DO CABEÇALHO DA ARTE (decisões do Eduardo em 01/10): a gravada no carrossel; sem ela, a
-// selecionada no Chat agora; e a gravada que foi desconectada cai na selecionada, com aviso
-// (achado 61). A selecionada segue a regra do painel (lib/account.ts): o cookie, e sem ele a
-// primeira conectada.
+// A CONTA DO CARROSSEL (decisões do Eduardo em 02/10, spec da Etapa 4): o carrossel é da conta
+// logada quando ele nasceu, e nunca vira de outra. Ele guarda o id, o nome e o @ dela. Conectada, a
+// arte usa os dados atuais (com a foto); desconectada, os guardados (com as iniciais). A conta
+// logada é a selecionada no painel (lib/account.ts): o cookie, e sem ele a primeira conectada.
 
 const conta = (id: string, username: string): ContaDoCabecalho => ({
   ig_user_id: id,
   username,
   name: `Nome de ${username}`,
-  profile_picture_url: null,
+  profile_picture_url: `https://scontent.cdninstagram.com/${username}.jpg`,
 });
 const A = conta("1001", "thiagovannuchi");
-const B = conta("1002", "outraconta");
+const B = conta("1002", "n8x");
 const CONTAS = [A, B];
+const guardada = (id: string | null, nome: string | null = null, arroba: string | null = null): ContaGuardada => ({
+  conta: id,
+  nome,
+  arroba,
+});
 
 describe("qual conta vai no cabeçalho", () => {
-  it("a gravada no carrossel, quando ela ainda está conectada", () => {
-    expect(resolverConta(CONTAS, "1002", "1001")).toEqual({ conta: B, origem: "gravada" });
+  it("a do carrossel, conectada: os dados atuais dela, com a foto", () => {
+    expect(resolverConta(CONTAS, guardada("1002", "Nome antigo", "antigo"), "1001")).toEqual({ conta: B, origem: "gravada" });
+  });
+
+  it("a do carrossel, desconectada, com o nome guardado: o nome e o @ guardados, sem foto", () => {
+    expect(resolverConta(CONTAS, guardada("7777", "N8X Oficial", "n8xoficial"), "1001")).toEqual({
+      conta: { ig_user_id: "7777", username: "n8xoficial", name: "N8X Oficial", profile_picture_url: null },
+      origem: "guardada",
+    });
+  });
+
+  it("a do carrossel, desconectada, sem o nome guardado (gravada na Etapa 3): a logada, e diz que saiu", () => {
+    expect(resolverConta(CONTAS, guardada("7777"), "1002")).toEqual({ conta: B, origem: "gravada_saiu" });
+  });
+
+  it("sem conta no carrossel: a logada, pelo cookie do painel", () => {
+    expect(resolverConta(CONTAS, guardada(null), "1002")).toEqual({ conta: B, origem: "selecionada" });
+  });
+
+  it("sem conta e sem cookie válido: a primeira conectada, como o painel faz", () => {
+    expect(resolverConta(CONTAS, guardada(null), undefined)).toEqual({ conta: A, origem: "selecionada" });
+    expect(resolverConta(CONTAS, guardada(null), "9999")).toEqual({ conta: A, origem: "selecionada" });
   });
 
-  it("sem gravada, a selecionada pelo cookie do painel", () => {
-    expect(resolverConta(CONTAS, null, "1002")).toEqual({ conta: B, origem: "selecionada" });
+  it("sem conta nenhuma conectada, só a guardada com nome desenha o cabeçalho", () => {
+    expect(resolverConta([], guardada("1001", "Thiago", "thiagovannuchi"), undefined).origem).toBe("guardada");
+    expect(resolverConta([], guardada("1001"), "1001")).toEqual({ conta: null, origem: "gravada_saiu" });
+    expect(resolverConta([], guardada(null), undefined)).toEqual({ conta: null, origem: "selecionada" });
   });
+});
 
-  it("sem gravada e sem cookie válido, a primeira conectada, como o painel faz", () => {
-    expect(resolverConta(CONTAS, null, undefined)).toEqual({ conta: A, origem: "selecionada" });
-    expect(resolverConta(CONTAS, null, "9999")).toEqual({ conta: A, origem: "selecionada" });
+describe("a conta que o carrossel guarda ao nascer", () => {
+  it("o id, o nome e o @ da conta", () => {
+    expect(contaParaGuardar(B)).toEqual(guardada("1002", "Nome de n8x", "n8x"));
   });
 
-  it("a gravada que foi desconectada cai na selecionada, e diz que saiu (achado 61)", () => {
-    expect(resolverConta(CONTAS, "7777", "1002")).toEqual({ conta: B, origem: "gravada_saiu" });
+  it("a logada: a do cookie, senão a primeira, senão nenhuma", () => {
+    expect(contaSelecionada(CONTAS, "1002")).toBe(B);
+    expect(contaSelecionada(CONTAS, "9999")).toBe(A);
+    expect(contaSelecionada([], "1001")).toBeNull();
   });
+});
 
-  it("sem conta nenhuma conectada, não há cabeçalho", () => {
-    expect(resolverConta([], "1001", "1001")).toEqual({ conta: null, origem: "gravada_saiu" });
-    expect(resolverConta([], null, undefined)).toEqual({ conta: null, origem: "selecionada" });
+// "GERAR DE NOVO" HERDA A CONTA DO ORIGINAL (decisão do Eduardo em 02/10), e não usa a logada agora:
+// gerar de novo um carrossel do Thiago com o Chat na N8X faz outro do Thiago.
+describe("a conta do Gerar de novo", () => {
+  it("o original com conta e nome: herda os três, mesmo com a conta desconectada", () => {
+    expect(contaParaGerarDeNovo(CONTAS, guardada("7777", "N8X Oficial", "n8xoficial"), "1001")).toEqual(
+      guardada("7777", "N8X Oficial", "n8xoficial")
+    );
+  });
+
+  it("o original com conta e sem nome, conectada: o nome e o @ vêm da tabela de contas", () => {
+    expect(contaParaGerarDeNovo(CONTAS, guardada("1002"), "1001")).toEqual(guardada("1002", "Nome de n8x", "n8x"));
+  });
+
+  it("o original com conta e sem nome, desconectada: herda a conta sem nome, como o original", () => {
+    expect(contaParaGerarDeNovo(CONTAS, guardada("7777"), "1001")).toEqual(guardada("7777"));
+  });
+
+  it("o original sem conta: a logada agora; sem conta nenhuma, nenhuma", () => {
+    expect(contaParaGerarDeNovo(CONTAS, guardada(null), "1002")).toEqual(guardada("1002", "Nome de n8x", "n8x"));
+    expect(contaParaGerarDeNovo([], guardada(null), undefined)).toBeNull();
+  });
+});
+
+// O NOME QUE FALTA: os carrosséis que ganharam conta na Etapa 3 a guardaram sem o nome. As actions
+// que já gravam num carrossel completam o nome e o @, quando a conta está conectada.
+describe("o nome que falta", () => {
+  it("conta conectada e sem nome: o nome e o @ da tabela", () => {
+    expect(nomeQueFalta(CONTAS, guardada("1002"))).toEqual({ nome: "Nome de n8x", arroba: "n8x" });
+  });
+
+  it.each([
+    ["com o nome já guardado", guardada("1002", "N8X", "n8x")],
+    ["com a conta desconectada", guardada("7777")],
+    ["sem conta", guardada(null)],
+  ])("%s: nada a completar", (_nome, g) => {
+    expect(nomeQueFalta(CONTAS, g)).toBeNull();
   });
 });
 
```

Em `tests/bonus-arte-escolhas.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-arte-escolhas.test.ts b/tests/bonus-arte-escolhas.test.ts
index 787f72b..5c50c8f 100644
--- a/tests/bonus-arte-escolhas.test.ts
+++ b/tests/bonus-arte-escolhas.test.ts
@@ -1,27 +1,36 @@
 import { describe, expect, it } from "vitest";
-import { comEspaco, escolhasDaArte, lerEscolhasDoFormulario } from "@/lib/bonus/arte-escolhas";
+import { comEspaco, escolhasDaArte, lerSoTextoDoFormulario } from "@/lib/bonus/arte-escolhas";
 
 // AS ESCOLHAS DA ARTE lidas da coluna `arte` (migrations/015-arte-do-carrossel.sql). O que vem do
 // banco não é confiável por forma: uma linha antiga tem `{}`, e uma escrita errada não pode quebrar
 // a página. O que não tiver a forma certa volta ao padrão, que é "com espaço" e sem conta gravada.
+// Desde a Etapa 4, a coluna guarda também o nome e o @ da conta, gravados quando o carrossel nasce.
 describe("as escolhas da arte de um carrossel", () => {
-  it("a linha antiga, sem nada, é a conta selecionada no Chat e todo slide com espaço", () => {
-    expect(escolhasDaArte({}, 5)).toEqual({ conta: null, soTexto: [] });
+  const VAZIA = { conta: null, nome: null, arroba: null, soTexto: [] };
+
+  it("a linha antiga, sem nada, não tem conta e tem todo slide com espaço", () => {
+    expect(escolhasDaArte({}, 5)).toEqual(VAZIA);
   });
 
-  it("lê a conta gravada e os slides só de texto, em ordem e sem repetir", () => {
-    expect(escolhasDaArte({ conta: "17841400000000001", soTexto: [4, 2, 2] }, 5)).toEqual({
-      conta: "17841400000000001",
-      soTexto: [2, 4],
-    });
+  it("lê a conta, o nome e o @ guardados, e os slides só de texto, em ordem e sem repetir", () => {
+    expect(
+      escolhasDaArte({ conta: "17841400000000001", nome: "Thiago Vannuchi", arroba: "thiagovannuchi", soTexto: [4, 2, 2] }, 5)
+    ).toEqual({ conta: "17841400000000001", nome: "Thiago Vannuchi", arroba: "thiagovannuchi", soTexto: [2, 4] });
+  });
+
+  it("a conta da Etapa 3, gravada sem o nome, volta sem o nome", () => {
+    expect(escolhasDaArte({ conta: "17841400000000001", soTexto: [] }, 5)).toEqual({ ...VAZIA, conta: "17841400000000001" });
   });
 
   it.each([null, "texto", [], 7])("forma errada inteira volta ao padrão: %j", (v) => {
-    expect(escolhasDaArte(v, 5)).toEqual({ conta: null, soTexto: [] });
+    expect(escolhasDaArte(v, 5)).toEqual(VAZIA);
   });
 
-  it("descarta o slide fora do total, o que não é inteiro e a conta vazia", () => {
-    expect(escolhasDaArte({ conta: "", soTexto: [0, 1, 6, 2.5, "3", 5] }, 5)).toEqual({ conta: null, soTexto: [1, 5] });
+  it("descarta o slide fora do total, o que não é inteiro, e a conta, o nome e o @ vazios ou de outro tipo", () => {
+    expect(escolhasDaArte({ conta: "", nome: 7, arroba: "", soTexto: [0, 1, 6, 2.5, "3", 5] }, 5)).toEqual({
+      ...VAZIA,
+      soTexto: [1, 5],
+    });
   });
 
   it("com espaço é o padrão, e só texto é o que foi marcado", () => {
@@ -30,33 +39,19 @@ describe("as escolhas da arte de um carrossel", () => {
   });
 });
 
-// O QUE O FORMULÁRIO DA ARTE MANDA não é confiável: o navegador manda o que quiser. A conta tem de
-// ser uma das conectadas, e cada slide "só texto" tem de existir no carrossel.
-describe("as escolhas mandadas pelo formulário da arte", () => {
-  const CONECTADAS = ["1001", "1002"];
-
-  it("a conta conectada e os slides marcados, em ordem e sem repetir", () => {
-    expect(lerEscolhasDoFormulario({ conta: "1002", soTexto: ["4", "2", "2"] }, 5, CONECTADAS)).toEqual({
-      ok: true,
-      escolhas: { conta: "1002", soTexto: [2, 4] },
-    });
+// O "SÓ TEXTO" MANDADO PELO FORMULÁRIO não é confiável: o navegador manda o que quiser. Cada slide
+// tem de existir no carrossel. A conta não vem mais do formulário (spec da Etapa 4): o carrossel é
+// da conta em que nasceu.
+describe("o só texto mandado pelo formulário da arte", () => {
+  it("os slides marcados, em ordem e sem repetir", () => {
+    expect(lerSoTextoDoFormulario(["4", "2", "2"], 5)).toEqual({ ok: true, soTexto: [2, 4] });
   });
 
   it("nenhum slide marcado é todos com espaço", () => {
-    expect(lerEscolhasDoFormulario({ conta: "1001", soTexto: [] }, 5, CONECTADAS)).toEqual({
-      ok: true,
-      escolhas: { conta: "1001", soTexto: [] },
-    });
-  });
-
-  it.each([["9999"], [""], [null]])("conta que não está conectada é recusada: %j", (conta) => {
-    expect(lerEscolhasDoFormulario({ conta, soTexto: [] }, 5, CONECTADAS)).toEqual({ ok: false, motivo: "conta" });
+    expect(lerSoTextoDoFormulario([], 5)).toEqual({ ok: true, soTexto: [] });
   });
 
   it.each([["0"], ["6"], ["2.5"], ["02"], ["x"], [7]])("slide fora do carrossel é recusado: %j", (slide) => {
-    expect(lerEscolhasDoFormulario({ conta: "1001", soTexto: [slide] }, 5, CONECTADAS)).toEqual({
-      ok: false,
-      motivo: "slide",
-    });
+    expect(lerSoTextoDoFormulario([slide], 5)).toEqual({ ok: false, motivo: "slide" });
   });
 });
```

Em `tests/bonus-arte-cabimento.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-arte-cabimento.test.ts b/tests/bonus-arte-cabimento.test.ts
index 795aacb..f3f1c81 100644
--- a/tests/bonus-arte-cabimento.test.ts
+++ b/tests/bonus-arte-cabimento.test.ts
@@ -94,13 +94,16 @@ describe("as frases da tela da arte", () => {
     expect(textoNaoCabeNunca(2)).toBe("O slide 2 não cabe nem sem o espaço da imagem. Encurte o texto.");
   });
 
-  it("a conta diz de onde veio, e cala quando é a gravada", () => {
+  it("a conta diz de onde veio, e cala quando é a do carrossel, conectada", () => {
     expect(textoDaOrigemDaConta("gravada", "thiagovannuchi")).toBeNull();
+    expect(textoDaOrigemDaConta("guardada", "n8x")).toBe(
+      "A conta deste carrossel (@n8x) foi desconectada do Chat. A arte segue com o nome dela, e as iniciais no lugar da foto."
+    );
     expect(textoDaOrigemDaConta("selecionada", "thiagovannuchi")).toBe(
-      "A arte usa a conta selecionada no Chat agora (@thiagovannuchi). Escolha uma conta acima para gravar neste carrossel."
+      'Este carrossel é de antes de a conta ser gravada, e a arte usa a conta logada agora (@thiagovannuchi). Use "Fixar nesta conta" para ele ficar com ela.'
     );
     expect(textoDaOrigemDaConta("gravada_saiu", "thiagovannuchi")).toBe(
-      "A conta gravada neste carrossel foi desconectada do Chat. A arte usa a selecionada agora (@thiagovannuchi)."
+      "A conta deste carrossel foi desconectada do Chat, e ele não guardou o nome dela. A arte usa a conta logada agora (@thiagovannuchi)."
     );
   });
 
@@ -119,8 +122,11 @@ describe("as frases da tela da arte", () => {
     );
   });
 
-  it("cada recusa do salvar da arte tem frase", () => {
-    expect(textoDaRecusaDaArte("conta")).toContain("não está conectada");
+  it("cada recusa da arte tem frase", () => {
     expect(textoDaRecusaDaArte("slide")).toContain("não existe");
+    expect(textoDaRecusaDaArte("ja_tem_conta")).toBe("Este carrossel já tem conta, e a conta de um carrossel não muda.");
+    expect(textoDaRecusaDaArte("sem_conta")).toBe(
+      "Nenhuma conta do Instagram está conectada no Chat, e o cabeçalho da arte precisa de uma."
+    );
   });
 });
```

Em `tests/bonus-carrossel-paginas.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-carrossel-paginas.test.ts b/tests/bonus-carrossel-paginas.test.ts
index eb3a766..c416e00 100644
--- a/tests/bonus-carrossel-paginas.test.ts
+++ b/tests/bonus-carrossel-paginas.test.ts
@@ -64,9 +64,9 @@ describe("o pedido de carrossel responde sem recriar a página na recusa", () =>
 // o editor, e recriar a página apagaria o que o operador estiver editando (achado 52). A resposta
 // volta como estado, e a miniatura troca pela versão da prévia.
 describe("o salvar da arte responde sem recriar a página", () => {
-  it("salvarArteDoCarrossel não redireciona para a página do carrossel", () => {
+  it.each(["salvarArteDoCarrossel", "fixarContaDoCarrossel"])("%s não redireciona para a página do carrossel", (nome) => {
     const fonte = ler("app/bonus/carrossel-actions.ts");
-    const inicio = fonte.indexOf("export async function salvarArteDoCarrossel(");
+    const inicio = fonte.indexOf(`export async function ${nome}(`);
     const fim = fonte.indexOf("\nexport ", inicio + 1);
     const corpo = fonte.slice(inicio, fim === -1 ? undefined : fim);
     expect(inicio).toBeGreaterThan(-1);
@@ -75,6 +75,25 @@ describe("o salvar da arte responde sem recriar a página", () => {
   });
 });
 
+// A CONTA DO CARROSSEL (spec da Etapa 4): ele é da conta em que nasceu, e nunca vira de outra. A
+// conta nunca vem do formulário, e o "Gerar de novo" herda a do original. O harness da integração não
+// forja sessão (de propósito), então as actions com sessão se provam pelas funções puras
+// (tests/bonus-arte-conta.test.ts) e por estas guardas.
+describe("a conta do carrossel nunca vem do formulário", () => {
+  it("nenhuma action lê um campo `conta` do formulário", () => {
+    expect(ler("app/bonus/carrossel-actions.ts")).not.toMatch(/form\.get(All)?\(\s*["']conta["']/);
+  });
+
+  it("o Gerar de novo herda a conta do original, e o pedido grava a logada com o nome", () => {
+    const fonte = ler("app/bonus/carrossel-actions.ts");
+    const inicio = fonte.indexOf("export async function gerarCarrosselDeNovo(");
+    const corpo = fonte.slice(inicio, fonte.indexOf("\nexport ", inicio + 1));
+    expect(corpo).toContain("contaParaGerarDeNovo(");
+    expect(corpo).not.toContain("contaDoPedido(");
+    expect(fonte).toMatch(/async function contaDoPedido\(\)[\s\S]*?contaParaGuardar\(/);
+  });
+});
+
 /** As funções exportadas de um arquivo e a primeira instrução de cada uma. */
 function primeirasInstrucoes(fonte: string): { nome: string; primeira: string }[] {
   const achados: { nome: string; primeira: string }[] = [];
@@ -86,9 +105,10 @@ function primeirasInstrucoes(fonte: string): { nome: string; primeira: string }[
 // A SESSÃO É CONFERIDA DENTRO DE CADA ACTION, e não só no proxy.ts: Server Action tem endereço
 // próprio. O mesmo leitor de tests/bonus-paginas.test.ts, para o arquivo novo.
 describe("toda action do carrossel confere a sessão antes de qualquer coisa", () => {
-  it("as quatro actions começam por `await exigirSessao();`", () => {
+  it("as cinco actions começam por `await exigirSessao();`", () => {
     const achados = primeirasInstrucoes(ler("app/bonus/carrossel-actions.ts"));
     expect(achados.map((a) => a.nome).sort()).toEqual([
+      "fixarContaDoCarrossel",
       "gerarCarrosselDeNovo",
       "pedirCarrossel",
       "salvarArteDoCarrossel",
```

Em `testes-integracao/bonus-carrossel-processo.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/bonus-carrossel-processo.integracao.ts b/testes-integracao/bonus-carrossel-processo.integracao.ts
index 9895af1..75ba807 100644
--- a/testes-integracao/bonus-carrossel-processo.integracao.ts
+++ b/testes-integracao/bonus-carrossel-processo.integracao.ts
@@ -4,6 +4,7 @@
 // visível para tsc, lint ou a suíte pura: apagar qualquer uma passa por todos. Só um caminho que
 // fale com o Postgres acusa. A IA é sempre um gerador falso: nada sai para a Anthropic.
 import { beforeAll, beforeEach, describe, expect, it } from "vitest";
+import type { ContaGuardada } from "@/lib/bonus/arte-conta";
 import type { TextoDeCarrossel } from "@/lib/bonus/carrossel-texto";
 import { bancoDescartavel } from "./harness";
 
@@ -56,7 +57,7 @@ beforeEach(async () => {
   bonusId = b.id;
 });
 
-const pedido = (total: number, conta: string | null = null) => ({
+const pedido = (total: number, conta: ContaGuardada | null = null) => ({
   bonusId,
   total,
   palavra: "SUMIDO",
@@ -222,28 +223,57 @@ describe("a revisão e a lista", () => {
   });
 });
 
-// A ARTE (Etapa 3): a conta do cabeçalho gravada no pedido, as escolhas gravadas só em carrossel
-// pronto, e as contas lidas SÓ pelas colunas do cabeçalho: a tabela `accounts` guarda o token de
-// acesso de cada conta, e ele nunca sai daqui (achado 60).
+// A ARTE (Etapas 3 e 4): a conta do carrossel, com o nome e o @, gravada no pedido; o "só texto"
+// gravado só em carrossel pronto e SEM apagar a conta; o "Fixar nesta conta" uma vez só; e as contas
+// lidas SÓ pelas colunas do cabeçalho: a tabela `accounts` guarda o token de acesso de cada conta, e
+// ele nunca sai daqui (achado 60).
 describe("a arte", () => {
-  it("o pedido grava a conta do cabeçalho; sem conta, a arte nasce vazia", async () => {
-    const r = await repo.criarPedidoDeCarrossel(pedido(5, "17841400000000001"));
-    const semConta = await criado(3);
+  const THIAGO: ContaGuardada = { conta: "17841400000000001", nome: "Thiago Vannuchi", arroba: "thiagovannuchi" };
+  const arte = async (id: string) => (await repo.lerCarrossel(id))?.arte;
+  async function pronto(conta: ContaGuardada | null = null): Promise<string> {
+    const r = await repo.criarPedidoDeCarrossel(pedido(5, conta));
     if (!r.ok) throw new Error("teto no meio do teste");
-    expect((await repo.lerCarrossel(r.id))?.arte).toEqual({ conta: "17841400000000001" });
-    expect((await repo.lerCarrossel(semConta))?.arte).toEqual({});
+    await processo.processarCarrossel(r.id, devolve(TEXTO));
+    return r.id;
+  }
+
+  it("o pedido grava a conta com o nome e o @; sem conta, a arte nasce vazia", async () => {
+    const r = await repo.criarPedidoDeCarrossel(pedido(5, THIAGO));
+    if (!r.ok) throw new Error("teto no meio do teste");
+    expect(await arte(r.id)).toEqual(THIAGO);
+    expect(await arte(await criado(3))).toEqual({});
   });
 
-  it("as escolhas só se gravam em carrossel pronto, e gravam inteiras", async () => {
-    const pronto = await criado(5);
-    await processo.processarCarrossel(pronto, devolve(TEXTO));
-    const escolhas = { conta: "17841400000000002", soTexto: [2, 4] };
-    expect(await repo.salvarEscolhasDaArte(pronto, escolhas)).toBe(true);
-    expect((await repo.lerCarrossel(pronto))?.arte).toEqual(escolhas);
+  it("gravar o só texto mantém a conta, e só vale em carrossel pronto", async () => {
+    const id = await pronto(THIAGO);
+    expect(await repo.salvarSoTextoDaArte(id, [2, 4], null)).toBe(true);
+    expect(await arte(id)).toEqual({ ...THIAGO, soTexto: [2, 4] });
+    expect(await repo.salvarSoTextoDaArte(id, [], null)).toBe(true);
+    expect(await arte(id)).toEqual({ ...THIAGO, soTexto: [] });
+
+    const pendente = await criado(5);
+    expect(await repo.salvarSoTextoDaArte(pendente, [2], null)).toBe(false);
+    expect(await arte(pendente)).toEqual({});
+  });
+
+  it("gravar o só texto completa o nome que falta da conta gravada na Etapa 3", async () => {
+    const id = await pronto();
+    await banco.db().sql().query(`update carrosseis_gerados set arte = '{"conta":"1001"}'::jsonb where id = $1`, [id]);
+    expect(await repo.salvarSoTextoDaArte(id, [3], { nome: "Thiago Vannuchi", arroba: "thiagovannuchi" })).toBe(true);
+    expect(await arte(id)).toEqual({ conta: "1001", nome: "Thiago Vannuchi", arroba: "thiagovannuchi", soTexto: [3] });
+  });
+
+  it("Fixar nesta conta grava uma vez, mantém o só texto, e recusa o carrossel que já tem conta", async () => {
+    const id = await pronto();
+    expect(await repo.salvarSoTextoDaArte(id, [2], null)).toBe(true);
+    expect(await repo.fixarContaDoCarrossel(id, THIAGO)).toBe(true);
+    expect(await arte(id)).toEqual({ ...THIAGO, soTexto: [2] });
+    expect(await repo.fixarContaDoCarrossel(id, { conta: "1002", nome: "N8X", arroba: "n8x" })).toBe(false);
+    expect(await arte(id)).toEqual({ ...THIAGO, soTexto: [2] });
 
     const pendente = await criado(5);
-    expect(await repo.salvarEscolhasDaArte(pendente, escolhas)).toBe(false);
-    expect((await repo.lerCarrossel(pendente))?.arte).toEqual({});
+    expect(await repo.fixarContaDoCarrossel(pendente, THIAGO)).toBe(false);
+    expect(await arte(pendente)).toEqual({});
   });
 
   it("as contas do cabeçalho vêm só com as quatro colunas, na ordem do painel, e nunca com o token", async () => {
```

Em `testes-integracao/bonus-carrossel-acoes.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/bonus-carrossel-acoes.integracao.ts b/testes-integracao/bonus-carrossel-acoes.integracao.ts
index d1d8440..f67bd6b 100644
--- a/testes-integracao/bonus-carrossel-acoes.integracao.ts
+++ b/testes-integracao/bonus-carrossel-acoes.integracao.ts
@@ -71,7 +71,17 @@ describe("sem sessão, nenhuma action do carrossel age", () => {
       async (f) => {
         await acoes.salvarArteDoCarrossel(null, f);
       },
-      formulario({ id: "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d", conta: "1001" })
+      formulario({ id: "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d", so_texto: "2" })
+    );
+    expect(destino).toBe("/entrar");
+  });
+
+  it("fixarContaDoCarrossel vai para /entrar", async () => {
+    const destino = await destinoDe(
+      async (f) => {
+        await acoes.fixarContaDoCarrossel(null, f);
+      },
+      formulario({ id: "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d" })
     );
     expect(destino).toBe("/entrar");
   });
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-arte-conta.test.ts tests/bonus-arte-escolhas.test.ts tests/bonus-arte-cabimento.test.ts tests/bonus-carrossel-paginas.test.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-carrossel-processo.integracao.ts testes-integracao/bonus-carrossel-acoes.integracao.ts
```

Esperado: os puros: 37 casos caem e 30 passam (67). A integração: `[rede-global] ALVO: banco de TESTE`, 5 caem e 18 passam (23).

- [ ] **Passo 3: o código**

Em `lib/bonus/arte-conta.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/arte-conta.ts b/lib/bonus/arte-conta.ts
index 891deae..5b4e33a 100644
--- a/lib/bonus/arte-conta.ts
+++ b/lib/bonus/arte-conta.ts
@@ -1,9 +1,10 @@
-// A CONTA DO CABEÇALHO DA ARTE: qual conta do Instagram assina os slides. PURO.
+// A CONTA DO CARROSSEL, que assina os slides no cabeçalho da arte. PURO.
 //
-// A regra é do Eduardo (01/10): a conta gravada no carrossel; sem ela, a selecionada no Chat agora;
-// e a gravada que foi desconectada cai na selecionada, com aviso na tela (achado 61). A
-// selecionada segue a regra do painel (lib/account.ts, `getSelectedAccount`): a do cookie, e sem
-// ela a primeira conectada. Esta função não lê o cookie nem o banco: recebe os dois.
+// A regra é do Eduardo (02/10, spec da Etapa 4): o carrossel é da conta logada quando ele nasceu,
+// e NUNCA vira de outra. Ele guarda o id, o nome e o @ dela. Conectada, a arte usa os dados atuais
+// (com a foto); desconectada, os guardados (com as iniciais, porque o Chat apaga a linha da conta).
+// A "conta logada" é a selecionada no painel (lib/account.ts, `getSelectedAccount`): a do cookie,
+// e sem ela a primeira conectada. Estas funções não leem o cookie nem o banco: recebem os dois.
 
 /** Só as colunas que o cabeçalho usa, e nunca o token (achado 60). */
 export type ContaDoCabecalho = {
@@ -13,17 +14,73 @@ export type ContaDoCabecalho = {
   profile_picture_url: string | null;
 };
 
-export type OrigemDaConta = "gravada" | "selecionada" | "gravada_saiu";
+/** O que o carrossel guarda da conta dele (a coluna `arte`). */
+export type ContaGuardada = { conta: string | null; nome: string | null; arroba: string | null };
+
+/**
+ * - `gravada`: a conta do carrossel, conectada;
+ * - `guardada`: a conta do carrossel, desconectada, com o nome e o @ guardados;
+ * - `gravada_saiu`: a conta do carrossel, desconectada, sem o nome guardado (gravada na Etapa 3):
+ *   a arte cai na logada, e a página avisa;
+ * - `selecionada`: o carrossel é de antes de a conta ser gravada: a arte usa a logada, e a página
+ *   oferece "Fixar nesta conta".
+ */
+export type OrigemDaConta = "gravada" | "guardada" | "selecionada" | "gravada_saiu";
+
+/** A conta logada: a do cookie, senão a primeira conectada, senão nenhuma. */
+export function contaSelecionada(contas: ContaDoCabecalho[], doCookie: string | undefined): ContaDoCabecalho | null {
+  return contas.find((c) => c.ig_user_id === doCookie) ?? contas[0] ?? null;
+}
+
+export function contaParaGuardar(c: ContaDoCabecalho): ContaGuardada {
+  return { conta: c.ig_user_id, nome: c.name, arroba: c.username };
+}
 
 export function resolverConta(
   contas: ContaDoCabecalho[],
-  gravada: string | null,
+  guardada: ContaGuardada,
   doCookie: string | undefined
 ): { conta: ContaDoCabecalho | null; origem: OrigemDaConta } {
-  const achada = gravada ? contas.find((c) => c.ig_user_id === gravada) : undefined;
-  if (achada) return { conta: achada, origem: "gravada" };
-  const selecionada = contas.find((c) => c.ig_user_id === doCookie) ?? contas[0] ?? null;
-  return { conta: selecionada, origem: gravada ? "gravada_saiu" : "selecionada" };
+  if (guardada.conta) {
+    const achada = contas.find((c) => c.ig_user_id === guardada.conta);
+    if (achada) return { conta: achada, origem: "gravada" };
+    if (guardada.nome || guardada.arroba) {
+      return {
+        conta: { ig_user_id: guardada.conta, username: guardada.arroba, name: guardada.nome, profile_picture_url: null },
+        origem: "guardada",
+      };
+    }
+    return { conta: contaSelecionada(contas, doCookie), origem: "gravada_saiu" };
+  }
+  return { conta: contaSelecionada(contas, doCookie), origem: "selecionada" };
+}
+
+/**
+ * A CONTA DO "GERAR DE NOVO": a do carrossel original, mesmo desconectada (decisão do Eduardo em
+ * 02/10). Sem o nome guardado e com a conta conectada, o nome e o @ vêm da tabela de contas. Só o
+ * original sem conta usa a logada agora.
+ */
+export function contaParaGerarDeNovo(
+  contas: ContaDoCabecalho[],
+  original: ContaGuardada,
+  doCookie: string | undefined
+): ContaGuardada | null {
+  if (original.conta) {
+    const falta = nomeQueFalta(contas, original);
+    return falta ? { conta: original.conta, ...falta } : original;
+  }
+  const logada = contaSelecionada(contas, doCookie);
+  return logada ? contaParaGuardar(logada) : null;
+}
+
+/**
+ * O NOME QUE FALTA: o carrossel tem conta, ela está conectada, e o nome não foi guardado (a Etapa 3
+ * gravava só o id). As actions que já gravam no carrossel completam o nome e o @ com isto.
+ */
+export function nomeQueFalta(contas: ContaDoCabecalho[], g: ContaGuardada): { nome: string | null; arroba: string | null } | null {
+  if (!g.conta || g.nome || g.arroba) return null;
+  const achada = contas.find((c) => c.ig_user_id === g.conta);
+  return achada ? { nome: achada.name, arroba: achada.username } : null;
 }
 
 /**
```

Em `lib/bonus/arte-escolhas.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/arte-escolhas.ts b/lib/bonus/arte-escolhas.ts
index d10eff5..08b2af6 100644
--- a/lib/bonus/arte-escolhas.ts
+++ b/lib/bonus/arte-escolhas.ts
@@ -1,26 +1,29 @@
 // AS ESCOLHAS DA ARTE de um carrossel: a coluna `arte` (migrations/015-arte-do-carrossel.sql).
 //
-// PURO. `conta` é o ig_user_id da conta do cabeçalho (null: a selecionada no Chat). `soTexto` são
-// os slides sem o espaço da imagem; os outros saem "com espaço", que é o padrão, como no Labs.
+// PURO. `conta` é o ig_user_id da conta do carrossel (null: ele é de antes de a conta ser gravada).
+// `nome` e `arroba` são os dela, guardados quando o carrossel nasce (spec da Etapa 4), para a arte
+// seguir com eles se a conta for desconectada do Chat. `soTexto` são os slides sem o espaço da
+// imagem; os outros saem "com espaço", que é o padrão, como no Labs.
 //
 // ⚠️ GRAVAR O "SÓ TEXTO" É DIFERENTE DO LABS, de propósito (spec da Etapa 3): lá a escolha não é
 // gravada, porque a presença da ilustração já a responde (ROADMAP do Labs, 22.6). No Chat não há
 // ilustração guardada, e o PNG baixado amanhã tem de sair igual à prévia de hoje.
 
-export type EscolhasDaArte = { conta: string | null; soTexto: number[] };
+export type EscolhasDaArte = { conta: string | null; nome: string | null; arroba: string | null; soTexto: number[] };
+
+const textoOuNulo = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
 
 /**
  * As escolhas lidas do banco. O que não tiver a forma certa volta ao padrão, e não quebra a
- * página: uma linha anterior à 015 tem `{}`.
+ * página: uma linha anterior à 015 tem `{}`, e uma da Etapa 3 tem a conta sem o nome.
  */
 export function escolhasDaArte(v: unknown, total: number): EscolhasDaArte {
   const o = v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
-  const conta = typeof o.conta === "string" && o.conta ? o.conta : null;
   const lista = Array.isArray(o.soTexto) ? o.soTexto : [];
   const soTexto = [...new Set(lista.filter((n): n is number => Number.isInteger(n) && n >= 1 && n <= total))].sort(
     (a, b) => a - b
   );
-  return { conta, soTexto };
+  return { conta: textoOuNulo(o.conta), nome: textoOuNulo(o.nome), arroba: textoOuNulo(o.arroba), soTexto };
 }
 
 /** "Com espaço" é o padrão; "só texto" é o que o operador marcou. */
@@ -28,25 +31,22 @@ export function comEspaco(e: EscolhasDaArte, numero: number): boolean {
   return !e.soTexto.includes(numero);
 }
 
-export type RecusaDaArte = "conta" | "slide";
+export type RecusaDaArte = "slide" | "ja_tem_conta" | "sem_conta";
 
 /**
- * O que o formulário da arte mandou. O navegador manda o que quiser: a conta tem de ser uma das
- * conectadas (spec da Etapa 3, "Segurança"), e cada slide "só texto" tem de existir no carrossel.
- * O número vem como texto, só dígitos e sem zero à esquerda.
+ * O "só texto" que o formulário da arte mandou. O navegador manda o que quiser: cada slide tem de
+ * existir no carrossel, e o número vem como texto, só dígitos e sem zero à esquerda. A conta não vem
+ * do formulário (spec da Etapa 4): o carrossel é da conta em que nasceu.
  */
-export function lerEscolhasDoFormulario(
-  bruto: { conta: unknown; soTexto: unknown[] },
-  total: number,
-  conectadas: string[]
-): { ok: true; escolhas: EscolhasDaArte } | { ok: false; motivo: RecusaDaArte } {
-  const conta = typeof bruto.conta === "string" ? bruto.conta : "";
-  if (!conectadas.includes(conta)) return { ok: false, motivo: "conta" };
+export function lerSoTextoDoFormulario(
+  bruto: unknown[],
+  total: number
+): { ok: true; soTexto: number[] } | { ok: false; motivo: "slide" } {
   const soTexto: number[] = [];
-  for (const v of bruto.soTexto) {
+  for (const v of bruto) {
     const n = typeof v === "string" && /^[1-9]\d*$/.test(v) ? Number(v) : 0;
     if (n < 1 || n > total) return { ok: false, motivo: "slide" };
     if (!soTexto.includes(n)) soTexto.push(n);
   }
-  return { ok: true, escolhas: { conta, soTexto: soTexto.sort((a, b) => a - b) } };
+  return { ok: true, soTexto: soTexto.sort((a, b) => a - b) };
 }
```

Em `lib/bonus/arte-textos.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/arte-textos.ts b/lib/bonus/arte-textos.ts
index 91354ee..c5878a5 100644
--- a/lib/bonus/arte-textos.ts
+++ b/lib/bonus/arte-textos.ts
@@ -18,20 +18,23 @@ export const TEXTO_ARTE_SEM_DESENHO =
   "A arte deste slide não pôde ser desenhada. Se o texto tem emoji, tente de novo em instantes: o desenho do emoji vem de fora do Chat. Se continuar, avise quem cuida do Chat.";
 
 /**
- * A resposta do salvar da arte (a conta e o "só texto"), que volta como ESTADO e não por redirect:
- * a seção da arte fica na página do editor, e recriar a página apagaria a edição (achado 52). `em`
- * muda a cada resposta, e é o que troca a versão das miniaturas depois de salvar.
+ * A resposta do salvar da arte (o "só texto") e do "Fixar nesta conta", que volta como ESTADO e não
+ * por redirect: a seção da arte fica na página do editor, e recriar a página apagaria a edição
+ * (achado 52). `em` muda a cada resposta, e é o que troca a versão das miniaturas depois de salvar.
  */
 export type AvisoDaArte = Aviso & { em: number };
 
 export const TEXTO_ARTE_SALVA = "Arte salva.";
+export const TEXTO_CONTA_FIXADA = "Conta fixada neste carrossel.";
 
 export function textoDaRecusaDaArte(motivo: RecusaDaArte): string {
   switch (motivo) {
-    case "conta":
-      return "Essa conta não está conectada no Chat. Escolha uma das contas da lista.";
     case "slide":
       return "Esse slide não existe neste carrossel. Recarregue a página.";
+    case "ja_tem_conta":
+      return "Este carrossel já tem conta, e a conta de um carrossel não muda.";
+    case "sem_conta":
+      return TEXTO_ARTE_SEM_CONTA;
   }
 }
 
@@ -44,15 +47,17 @@ export function textoNaoCabeNunca(numero: number): string {
   return `O slide ${numero} não cabe nem sem o espaço da imagem. Encurte o texto.`;
 }
 
-/** De onde veio a conta do cabeçalho. A gravada não precisa de aviso. */
+/** De onde veio a conta do cabeçalho (arte-conta.ts). A do carrossel, conectada, não precisa de aviso. */
 export function textoDaOrigemDaConta(origem: OrigemDaConta, arroba: string): string | null {
   switch (origem) {
     case "gravada":
       return null;
+    case "guardada":
+      return `A conta deste carrossel (@${arroba}) foi desconectada do Chat. A arte segue com o nome dela, e as iniciais no lugar da foto.`;
     case "selecionada":
-      return `A arte usa a conta selecionada no Chat agora (@${arroba}). Escolha uma conta acima para gravar neste carrossel.`;
+      return `Este carrossel é de antes de a conta ser gravada, e a arte usa a conta logada agora (@${arroba}). Use "Fixar nesta conta" para ele ficar com ela.`;
     case "gravada_saiu":
-      return `A conta gravada neste carrossel foi desconectada do Chat. A arte usa a selecionada agora (@${arroba}).`;
+      return `A conta deste carrossel foi desconectada do Chat, e ele não guardou o nome dela. A arte usa a conta logada agora (@${arroba}).`;
   }
 }
 
```

Em `lib/bonus/carrossel-repositorio.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/carrossel-repositorio.ts b/lib/bonus/carrossel-repositorio.ts
index c87c4d7..cc2c26d 100644
--- a/lib/bonus/carrossel-repositorio.ts
+++ b/lib/bonus/carrossel-repositorio.ts
@@ -1,7 +1,6 @@
 import "server-only";
 import { sql } from "@/lib/db";
-import type { ContaDoCabecalho } from "./arte-conta";
-import type { EscolhasDaArte } from "./arte-escolhas";
+import type { ContaDoCabecalho, ContaGuardada } from "./arte-conta";
 import type { ContextoDoCarrossel } from "./carrossel-ia-parametros";
 import type { LinhaDoCarrossel } from "./carrossel-linha";
 import { TETO_CARROSSEL_DIARIO } from "./carrossel-pedido";
@@ -27,17 +26,25 @@ export async function carrosseisNasUltimas24h(): Promise<number> {
   return linha?.n ?? 0;
 }
 
+/** A conta como a coluna `arte` a guarda: sem as chaves vazias. */
+function chavesDaConta(c: Partial<ContaGuardada> | null): Record<string, string> {
+  return Object.fromEntries(Object.entries(c ?? {}).filter(([, v]) => typeof v === "string" && v !== "")) as Record<
+    string,
+    string
+  >;
+}
+
 /**
  * CONTAR E INSERIR NA MESMA TRANSAÇÃO, COM TRAVA: dois cliques com 9 no dia não fazem 11.
- * `conta` é a conta do cabeçalho da arte, gravada no pedido (spec da Etapa 3): sem conta, a arte
- * nasce `{}` e usa a selecionada no Chat.
+ * `conta` é a conta do carrossel, com o nome e o @, gravada no pedido (spec da Etapa 4): o
+ * carrossel é dela, e nunca vira de outra. Sem conta, a arte nasce `{}`.
  */
 export async function criarPedidoDeCarrossel(p: {
   bonusId: string;
   total: number;
   palavra: string;
   contexto: ContextoDoCarrossel;
-  conta: string | null;
+  conta: ContaGuardada | null;
 }): Promise<{ ok: true; id: string } | { ok: false }> {
   return sql().begin(async (tx) => {
     await tx.query(`select pg_advisory_xact_lock($1::bigint)`, [TRAVA_DO_TETO_DO_CARROSSEL]);
@@ -48,7 +55,7 @@ export async function criarPedidoDeCarrossel(p: {
     const [criada] = (await tx.query(
       `insert into carrosseis_gerados (bonus_id, total_slides, palavra, contexto, arte)
        values ($1, $2, $3, $4::jsonb, $5::jsonb) returning id`,
-      [p.bonusId, p.total, p.palavra, p.contexto, p.conta ? { conta: p.conta } : {}]
+      [p.bonusId, p.total, p.palavra, p.contexto, p.conta?.conta ? chavesDaConta(p.conta) : {}]
     )) as { id: string }[];
     return { ok: true as const, id: criada.id };
   });
@@ -106,11 +113,35 @@ export async function salvarRevisaoDoCarrossel(id: string, texto: TextoDoCarross
   return linhas.length > 0;
 }
 
-/** As escolhas da arte só valem para carrossel pronto. Devolve falso quando a linha não estava pronta. */
-export async function salvarEscolhasDaArte(id: string, escolhas: EscolhasDaArte): Promise<boolean> {
+/**
+ * O "SÓ TEXTO" DA ARTE, só em carrossel pronto. Grava SÓ a chave `soTexto` (`arte || …` junta as
+ * chaves), e nunca o objeto inteiro: até a Etapa 3 a escrita trocava a coluna toda, e gravar o "só
+ * texto" sem a conta a apagaria (spec da Etapa 4). `nomeQueFalta` completa o nome e o @ da conta
+ * gravada na Etapa 3 sem eles (arte-conta.ts). Devolve falso quando a linha não estava pronta.
+ */
+export async function salvarSoTextoDaArte(
+  id: string,
+  soTexto: number[],
+  nomeQueFalta: { nome: string | null; arroba: string | null } | null
+): Promise<boolean> {
+  const linhas = (await sql().query(
+    `update carrosseis_gerados set arte = arte || $2::jsonb where id = $1 and estado = 'pronto' returning id`,
+    [id, { ...chavesDaConta(nomeQueFalta), soTexto }]
+  )) as { id: string }[];
+  return linhas.length > 0;
+}
+
+/**
+ * "FIXAR NESTA CONTA": grava a conta, com o nome e o @, no carrossel que ainda não tem conta (o de
+ * antes da 015). Uma vez só: o `where` recusa o carrossel que já tem conta, e a conta de um
+ * carrossel não muda. Só em carrossel pronto. Devolve falso quando não gravou.
+ */
+export async function fixarContaDoCarrossel(id: string, conta: ContaGuardada): Promise<boolean> {
   const linhas = (await sql().query(
-    `update carrosseis_gerados set arte = $2::jsonb where id = $1 and estado = 'pronto' returning id`,
-    [id, escolhas]
+    `update carrosseis_gerados set arte = arte || $2::jsonb
+      where id = $1 and estado = 'pronto' and not (arte ? 'conta')
+      returning id`,
+    [id, chavesDaConta(conta)]
   )) as { id: string }[];
   return linhas.length > 0;
 }
```

Em `app/bonus/carrossel-actions.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/carrossel-actions.ts b/app/bonus/carrossel-actions.ts
index 4284930..812f3d1 100644
--- a/app/bonus/carrossel-actions.ts
+++ b/app/bonus/carrossel-actions.ts
@@ -4,18 +4,31 @@ import { cookies } from "next/headers";
 import { redirect } from "next/navigation";
 import { ACCOUNT_COOKIE } from "@/lib/account";
 import { isValidSession, SESSION_COOKIE } from "@/lib/auth";
-import { resolverConta } from "@/lib/bonus/arte-conta";
-import { lerEscolhasDoFormulario } from "@/lib/bonus/arte-escolhas";
-import { TEXTO_ARTE_NAO_PRONTA, TEXTO_ARTE_SALVA, textoDaRecusaDaArte, type AvisoDaArte } from "@/lib/bonus/arte-textos";
+import {
+  contaParaGerarDeNovo,
+  contaParaGuardar,
+  contaSelecionada,
+  nomeQueFalta,
+  type ContaGuardada,
+} from "@/lib/bonus/arte-conta";
+import { escolhasDaArte, lerSoTextoDoFormulario } from "@/lib/bonus/arte-escolhas";
+import {
+  TEXTO_ARTE_NAO_PRONTA,
+  TEXTO_ARTE_SALVA,
+  TEXTO_CONTA_FIXADA,
+  textoDaRecusaDaArte,
+  type AvisoDaArte,
+} from "@/lib/bonus/arte-textos";
 import type { ContextoDoCarrossel } from "@/lib/bonus/carrossel-ia-parametros";
 import { lerPedidoDeCarrossel } from "@/lib/bonus/carrossel-pedido";
 import { processarCarrossel } from "@/lib/bonus/carrossel-processo";
 import {
   contasParaArte,
   criarPedidoDeCarrossel,
+  fixarContaDoCarrossel as gravarContaFixada,
   lerCarrossel,
-  salvarEscolhasDaArte,
   salvarRevisaoDoCarrossel as gravarRevisao,
+  salvarSoTextoDaArte,
 } from "@/lib/bonus/carrossel-repositorio";
 import { textoDaLinhaDoCarrossel } from "@/lib/bonus/carrossel-tela";
 import { camposDoFormulario, lerRevisaoDoCarrossel } from "@/lib/bonus/carrossel-texto";
@@ -55,12 +68,17 @@ async function exigirSessao(): Promise<void> {
 }
 
 /**
- * A CONTA DO CABEÇALHO DA ARTE, gravada no pedido: a selecionada no Chat agora (spec da Etapa 3).
- * Gravar na primeira visita seria uma escrita dentro de um GET; o pedido já é uma escrita.
+ * A CONTA DO CARROSSEL, gravada no pedido: a logada no Chat agora, com o nome e o @ (spec da Etapa
+ * 4). O carrossel é dela, e nunca vira de outra. Gravar na primeira visita seria uma escrita dentro
+ * de um GET; o pedido já é uma escrita.
  */
-async function contaDoPedido(): Promise<string | null> {
-  const jarra = await cookies();
-  return resolverConta(await contasParaArte(), null, jarra.get(ACCOUNT_COOKIE)?.value).conta?.ig_user_id ?? null;
+async function contaDoPedido(): Promise<ContaGuardada | null> {
+  const logada = contaSelecionada(await contasParaArte(), await contaDoCookie());
+  return logada ? contaParaGuardar(logada) : null;
+}
+
+async function contaDoCookie(): Promise<string | undefined> {
+  return (await cookies()).get(ACCOUNT_COOKIE)?.value;
 }
 
 /** O bônus pronto para carrossel: criado no Labs e publicado lá. Qualquer outra coisa é recusa. */
@@ -131,12 +149,18 @@ export async function gerarCarrosselDeNovo(form: FormData): Promise<void> {
   }
   const bonus = await bonusParaCarrossel(linha.bonus_id);
   if (!bonus.ok) redirect(urlDoCarrosselComAviso(linha.bonus_id, id, { tom: "erro", texto: bonus.texto }));
+  // O novo herda a conta do original, mesmo desconectada (decisão do Eduardo em 02/10): gerar de
+  // novo um carrossel do Thiago com o Chat na N8X faz outro do Thiago.
   const criado = await criarPedidoDeCarrossel({
     bonusId: linha.bonus_id,
     total: linha.total_slides,
     palavra: bonus.palavra,
     contexto: bonus.contexto,
-    conta: await contaDoPedido(),
+    conta: contaParaGerarDeNovo(
+      await contasParaArte(),
+      escolhasDaArte(linha.arte, linha.total_slides),
+      await contaDoCookie()
+    ),
   });
   if (!criado.ok) redirect(urlDoCarrosselComAviso(linha.bonus_id, id, { tom: "erro", texto: textoDoTetoDoCarrossel() }));
   const novo = criado.id;
@@ -175,10 +199,11 @@ export async function salvarRevisaoDoCarrossel(
 }
 
 /**
- * AS ESCOLHAS DA ARTE: a conta do cabeçalho e os slides "só texto". A resposta volta como ESTADO
- * (useActionState), e nunca por redirect, pelo mesmo motivo do salvar da revisão (achado 52): a
- * seção da arte fica na página do editor, e recriar a página apagaria o que se estiver editando.
- * A conta tem de ser uma das conectadas, e só carrossel pronto guarda escolha.
+ * O "SÓ TEXTO" DA ARTE. A resposta volta como ESTADO (useActionState), e nunca por redirect, pelo
+ * mesmo motivo do salvar da revisão (achado 52): a seção da arte fica na página do editor, e recriar
+ * a página apagaria o que se estiver editando. Só carrossel pronto guarda escolha. A conta não vem do
+ * formulário (spec da Etapa 4): o carrossel é da conta em que nasceu. Gravar aqui completa o nome e
+ * o @ da conta gravada na Etapa 3 sem eles.
  */
 export async function salvarArteDoCarrossel(_anterior: AvisoDaArte | null, form: FormData): Promise<AvisoDaArte | null> {
   await exigirSessao();
@@ -188,13 +213,30 @@ export async function salvarArteDoCarrossel(_anterior: AvisoDaArte | null, form:
   if (!linha) redirect(urlDoBonusComAviso(null, { tom: "erro", texto: TEXTO_CARROSSEL_NAO_ENCONTRADO }));
   const resposta = (tom: AvisoDaArte["tom"], texto: string): AvisoDaArte => ({ tom, texto, em: Date.now() });
   if (linha.estado !== "pronto" || !textoDaLinhaDoCarrossel(linha)) return resposta("erro", TEXTO_ARTE_NAO_PRONTA);
-  const conectadas = (await contasParaArte()).map((c) => c.ig_user_id);
-  const lido = lerEscolhasDoFormulario(
-    { conta: form.get("conta"), soTexto: form.getAll("so_texto") },
-    linha.total_slides,
-    conectadas
-  );
+  const lido = lerSoTextoDoFormulario(form.getAll("so_texto"), linha.total_slides);
   if (!lido.ok) return resposta("erro", textoDaRecusaDaArte(lido.motivo));
-  const salvou = await salvarEscolhasDaArte(id, lido.escolhas);
+  const falta = nomeQueFalta(await contasParaArte(), escolhasDaArte(linha.arte, linha.total_slides));
+  const salvou = await salvarSoTextoDaArte(id, lido.soTexto, falta);
   return salvou ? resposta("ok", TEXTO_ARTE_SALVA) : resposta("erro", TEXTO_ARTE_NAO_PRONTA);
 }
+
+/**
+ * "FIXAR NESTA CONTA" (decisão do Eduardo em 02/10): o carrossel de antes da 015, sem conta gravada,
+ * passa a ser da conta logada agora, com o nome e o @, uma vez só. A resposta volta como estado,
+ * como as outras da página.
+ */
+export async function fixarContaDoCarrossel(_anterior: AvisoDaArte | null, form: FormData): Promise<AvisoDaArte | null> {
+  await exigirSessao();
+  const id = form.get("id");
+  if (!ehIdDeBonus(id)) redirect(urlDoBonusComAviso(null, { tom: "erro", texto: TEXTO_CARROSSEL_NAO_ENCONTRADO }));
+  const linha = await lerCarrossel(id);
+  if (!linha) redirect(urlDoBonusComAviso(null, { tom: "erro", texto: TEXTO_CARROSSEL_NAO_ENCONTRADO }));
+  const resposta = (tom: AvisoDaArte["tom"], texto: string): AvisoDaArte => ({ tom, texto, em: Date.now() });
+  if (linha.estado !== "pronto" || !textoDaLinhaDoCarrossel(linha)) return resposta("erro", TEXTO_ARTE_NAO_PRONTA);
+  if (escolhasDaArte(linha.arte, linha.total_slides).conta) return resposta("erro", textoDaRecusaDaArte("ja_tem_conta"));
+  const logada = contaSelecionada(await contasParaArte(), await contaDoCookie());
+  if (!logada) return resposta("erro", textoDaRecusaDaArte("sem_conta"));
+  // O `where` do repositório recusa quem já tem conta: outra aba pode ter fixado no meio.
+  const fixou = await gravarContaFixada(id, contaParaGuardar(logada));
+  return fixou ? resposta("ok", TEXTO_CONTA_FIXADA) : resposta("erro", textoDaRecusaDaArte("ja_tem_conta"));
+}
```

Em `app/bonus/[id]/carrossel/[cid]/arte/route.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/[id]/carrossel/[cid]/arte/route.tsx b/app/bonus/[id]/carrossel/[cid]/arte/route.tsx
index 79f7aa5..a07200c 100644
--- a/app/bonus/[id]/carrossel/[cid]/arte/route.tsx
+++ b/app/bonus/[id]/carrossel/[cid]/arte/route.tsx
@@ -48,9 +48,10 @@ export async function GET(request: Request, { params }: { params: Promise<{ id:
   if (!conferido.ok) return erro(conferido.status, conferido.texto);
   const { linha, slides, numero } = conferido;
 
-  // A conta do cabeçalho: a gravada no carrossel; sem ela, ou desconectada, a selecionada no Chat.
+  // A conta do cabeçalho é a do carrossel (arte-conta.ts): conectada, os dados atuais; desconectada,
+  // o nome e o @ guardados, com as iniciais; sem conta gravada, a logada no Chat.
   const escolhas = escolhasDaArte(linha.arte, slides.length);
-  const { conta } = resolverConta(await contasParaArte(), escolhas.conta, jarra.get(ACCOUNT_COOKIE)?.value);
+  const { conta } = resolverConta(await contasParaArte(), escolhas, jarra.get(ACCOUNT_COOKIE)?.value);
   if (!conta) return erro(409, TEXTO_ARTE_SEM_CONTA);
   // A foto vem da memória desta instância (arte-foto.ts): as miniaturas chegam juntas, e uma busca
   // só atende todas.
```

Em `app/bonus/[id]/carrossel/[cid]/page.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/[id]/carrossel/[cid]/page.tsx b/app/bonus/[id]/carrossel/[cid]/page.tsx
index a83b65c..fce3f63 100644
--- a/app/bonus/[id]/carrossel/[cid]/page.tsx
+++ b/app/bonus/[id]/carrossel/[cid]/page.tsx
@@ -136,7 +136,7 @@ async function Revisao({ carrossel }: { carrossel: LinhaDoCarrossel }) {
 
   const contas = await contasParaArte();
   const escolhas = escolhasDaArte(carrossel.arte, carrossel.total_slides);
-  const { conta, origem } = resolverConta(contas, escolhas.conta, (await cookies()).get(ACCOUNT_COOKIE)?.value);
+  const { conta, origem } = resolverConta(contas, escolhas, (await cookies()).get(ACCOUNT_COOKIE)?.value);
   const versaoBase = versaoDaArte([
     (carrossel.revisado_em ?? carrossel.gerado_em)?.toISOString() ?? "",
     JSON.stringify(carrossel.arte ?? {}),
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx vitest run tests/bonus-arte-conta.test.ts tests/bonus-arte-escolhas.test.ts tests/bonus-arte-cabimento.test.ts tests/bonus-carrossel-paginas.test.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-carrossel-processo.integracao.ts testes-integracao/bonus-carrossel-acoes.integracao.ts
```

Esperado: `tsc` limpo; 67 casos puros passam; a integração, 23 passam.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/arte-conta.ts lib/bonus/arte-escolhas.ts lib/bonus/arte-textos.ts lib/bonus/carrossel-repositorio.ts app/bonus/carrossel-actions.ts "app/bonus/[id]/carrossel/[cid]/arte/route.tsx" "app/bonus/[id]/carrossel/[cid]/page.tsx" tests/bonus-arte-conta.test.ts tests/bonus-arte-escolhas.test.ts tests/bonus-arte-cabimento.test.ts tests/bonus-carrossel-paginas.test.ts testes-integracao/bonus-carrossel-processo.integracao.ts testes-integracao/bonus-carrossel-acoes.integracao.ts
test "$(git branch --show-current)" = "pagina-do-carrossel"
git add lib/bonus/arte-conta.ts lib/bonus/arte-escolhas.ts lib/bonus/arte-textos.ts lib/bonus/carrossel-repositorio.ts app/bonus/carrossel-actions.ts "app/bonus/[id]/carrossel/[cid]/arte/route.tsx" "app/bonus/[id]/carrossel/[cid]/page.tsx" tests/bonus-arte-conta.test.ts tests/bonus-arte-escolhas.test.ts tests/bonus-arte-cabimento.test.ts tests/bonus-carrossel-paginas.test.ts testes-integracao/bonus-carrossel-processo.integracao.ts testes-integracao/bonus-carrossel-acoes.integracao.ts
git commit -m "feat(bonus): o carrossel é da conta em que nasceu, com o nome e o @ guardados"
```

---

### FASE 4.7 — Salvar um slide

**Arquivos:**
- Modificar: `lib/bonus/carrossel-repositorio.ts`, `lib/bonus/carrossel-textos.ts`,
  `lib/bonus/arte-tela.ts`, `app/bonus/carrossel-actions.ts`
- Testar: `tests/bonus-carrossel-textos.test.ts`, `tests/bonus-arte-tela.test.ts`,
  `tests/bonus-carrossel-paginas.test.ts`, `testes-integracao/bonus-carrossel-processo.integracao.ts`,
  `testes-integracao/bonus-carrossel-acoes.integracao.ts`

**Interfaces:**
- Consome: `lerParte`, `juntarParte`, `camposDaParte` (FASE 4.5); `nomeQueFalta` (FASE 4.6).
- Produz, de `carrossel-repositorio.ts`: `salvarParteDoCarrossel(id, parte, bruto, nomeQueFalta)`,
  numa transação com `select ... for update`, que devolve `{ ok: true; texto; avisos }`,
  `{ ok: false; motivo: "nao_pronto" }` ou `{ ok: false; motivo: "problemas"; problemas }`.
- Produz, de `carrossel-textos.ts`: `type AvisoDoSlide = Aviso & { em; versao: string | null }`,
  `TEXTO_PARTE_INVALIDA` e `textoDaParteSalva(parte, total, avisos)`.
- Produz, de `carrossel-actions.ts`: `salvarSlideDoCarrossel(anterior, form): Promise<AvisoDoSlide |
  null>`, que começa por `await exigirSessao();` e devolve a versão nova só daquele slide.

- [ ] **Passo 1: os testes**

Em `tests/bonus-carrossel-textos.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-carrossel-textos.test.ts b/tests/bonus-carrossel-textos.test.ts
index 5ce3514..67f98f8 100644
--- a/tests/bonus-carrossel-textos.test.ts
+++ b/tests/bonus-carrossel-textos.test.ts
@@ -5,6 +5,7 @@ import {
   textoDeOutrasPalavras,
   quadroDaSituacao,
   textoDaConferencia,
+  textoDaParteSalva,
   textoDaRecusaDoPedidoDeCarrossel,
   textoDosProblemasDoCarrossel,
   textoDoTetoDoCarrossel,
@@ -96,3 +97,18 @@ describe("as frases do carrossel", () => {
     expect(t).toMatch(/não recebe o bônus/);
   });
 });
+
+// O "SALVAR SLIDE N" E O "SALVAR LEGENDA" (spec da Etapa 4): a resposta diz o que se salvou. Um
+// problema em outro campo não impede o salvar, e vai junto, para não sumir calado.
+describe("a resposta do salvar de uma parte", () => {
+  it("diz o slide ou a legenda que se salvou", () => {
+    expect(textoDaParteSalva({ tipo: "slide", numero: 3 }, 5, [])).toBe("Slide 3 salvo.");
+    expect(textoDaParteSalva({ tipo: "legenda" }, 5, [])).toBe("Legenda salva.");
+  });
+
+  it("o problema em outro campo vai junto, com o nome do campo", () => {
+    expect(textoDaParteSalva({ tipo: "slide", numero: 1 }, 5, [{ campo: "chamada", erro: "precisa pedir a palavra SUMIDO" }])).toBe(
+      "Slide 1 salvo. Atenção, em outro campo: Chamada (slide 5): precisa pedir a palavra SUMIDO."
+    );
+  });
+});
```

Em `tests/bonus-arte-tela.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-arte-tela.test.ts b/tests/bonus-arte-tela.test.ts
index 4e01252..25b33ec 100644
--- a/tests/bonus-arte-tela.test.ts
+++ b/tests/bonus-arte-tela.test.ts
@@ -1,6 +1,7 @@
 import { describe, expect, it } from "vitest";
 import {
   cabecalhoDaConta,
+  cabecalhoParaVersao,
   cabecalhosDaArte,
   conferirPedidoDaArte,
   nomeDoArquivo,
@@ -157,6 +158,14 @@ describe("a versão de cada miniatura", () => {
     const com4 = versoesDosSlides(slidesDoTexto({ ...texto, slides: [texto.slides[0], texto.slides[0]] }), [], CAB);
     expect(com4[0]).not.toBe(base[0]);
   });
+
+  // A página e a action de salvar calculam a versão do mesmo jeito: com a URL da foto no lugar do
+  // `data:` que só a rota tem.
+  it("o cabeçalho da versão é o da conta, com a URL da foto; sem conta, o vazio", () => {
+    const c = { ig_user_id: "1001", username: "thiagovannuchi", name: "Thiago Vannuchi", profile_picture_url: "https://foto" };
+    expect(cabecalhoParaVersao(c)).toEqual(CAB);
+    expect(cabecalhoParaVersao(null)).toEqual({ nome: "", arroba: "", foto: null, iniciais: "IG" });
+  });
 });
 
 // O QUE A ROTA CONFERE ANTES DE DESENHAR, depois da sessão e dos ids: o carrossel existe e é do
```

Em `tests/bonus-carrossel-paginas.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-carrossel-paginas.test.ts b/tests/bonus-carrossel-paginas.test.ts
index c416e00..50ec27b 100644
--- a/tests/bonus-carrossel-paginas.test.ts
+++ b/tests/bonus-carrossel-paginas.test.ts
@@ -64,7 +64,7 @@ describe("o pedido de carrossel responde sem recriar a página na recusa", () =>
 // o editor, e recriar a página apagaria o que o operador estiver editando (achado 52). A resposta
 // volta como estado, e a miniatura troca pela versão da prévia.
 describe("o salvar da arte responde sem recriar a página", () => {
-  it.each(["salvarArteDoCarrossel", "fixarContaDoCarrossel"])("%s não redireciona para a página do carrossel", (nome) => {
+  it.each(["salvarArteDoCarrossel", "fixarContaDoCarrossel", "salvarSlideDoCarrossel"])("%s não redireciona para a página do carrossel", (nome) => {
     const fonte = ler("app/bonus/carrossel-actions.ts");
     const inicio = fonte.indexOf(`export async function ${nome}(`);
     const fim = fonte.indexOf("\nexport ", inicio + 1);
@@ -105,7 +105,7 @@ function primeirasInstrucoes(fonte: string): { nome: string; primeira: string }[
 // A SESSÃO É CONFERIDA DENTRO DE CADA ACTION, e não só no proxy.ts: Server Action tem endereço
 // próprio. O mesmo leitor de tests/bonus-paginas.test.ts, para o arquivo novo.
 describe("toda action do carrossel confere a sessão antes de qualquer coisa", () => {
-  it("as cinco actions começam por `await exigirSessao();`", () => {
+  it("as seis actions começam por `await exigirSessao();`", () => {
     const achados = primeirasInstrucoes(ler("app/bonus/carrossel-actions.ts"));
     expect(achados.map((a) => a.nome).sort()).toEqual([
       "fixarContaDoCarrossel",
@@ -113,6 +113,7 @@ describe("toda action do carrossel confere a sessão antes de qualquer coisa", (
       "pedirCarrossel",
       "salvarArteDoCarrossel",
       "salvarRevisaoDoCarrossel",
+      "salvarSlideDoCarrossel",
     ]);
     for (const a of achados) expect(a.primeira, a.nome).toBe("await exigirSessao();");
   });
```

Em `testes-integracao/bonus-carrossel-processo.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/bonus-carrossel-processo.integracao.ts b/testes-integracao/bonus-carrossel-processo.integracao.ts
index 75ba807..b5f4ee0 100644
--- a/testes-integracao/bonus-carrossel-processo.integracao.ts
+++ b/testes-integracao/bonus-carrossel-processo.integracao.ts
@@ -223,6 +223,92 @@ describe("a revisão e a lista", () => {
   });
 });
 
+// SALVAR UMA PARTE (spec da Etapa 4): um slide, ou a legenda, juntado ao texto salvo numa transação
+// com a linha travada. A trava é o que impede dois salvamentos de slides diferentes de apagarem um
+// ao outro, e só um caminho que fale com o Postgres a acusa.
+describe("salvar uma parte do carrossel", () => {
+  const GANCHO = "Seu cliente sumiu? Traga ele de volta.";
+  const CHAMADA = "Comente SUMIDO e receba as mensagens agora.";
+  async function pronto(): Promise<string> {
+    const id = await criado(5);
+    await processo.processarCarrossel(id, devolve(TEXTO));
+    return id;
+  }
+
+  it("troca só a parte, junta ao texto salvo e grava quando", async () => {
+    const id = await pronto();
+    const r = await repo.salvarParteDoCarrossel(id, { tipo: "slide", numero: 1 }, { gancho: GANCHO }, null);
+    expect(r).toEqual({ ok: true, texto: { ...TEXTO, gancho: GANCHO }, avisos: [] });
+    const l = await repo.lerCarrossel(id);
+    expect(l?.revisado).toEqual({ ...TEXTO, gancho: GANCHO });
+    expect(l?.revisado_em).toBeInstanceOf(Date);
+
+    // A segunda parte junta sobre a primeira, e não sobre o gerado.
+    await repo.salvarParteDoCarrossel(id, { tipo: "slide", numero: 5 }, { chamada: CHAMADA }, null);
+    expect((await repo.lerCarrossel(id))?.revisado).toEqual({ ...TEXTO, gancho: GANCHO, chamada: CHAMADA });
+  });
+
+  it("recusa pelo problema da parte, e não grava nada", async () => {
+    const id = await pronto();
+    expect(await repo.salvarParteDoCarrossel(id, { tipo: "slide", numero: 5 }, { chamada: "Comente PROMPT agora." }, null)).toEqual({
+      ok: false,
+      motivo: "problemas",
+      problemas: [{ campo: "chamada", erro: "precisa pedir a palavra SUMIDO" }],
+    });
+    expect((await repo.lerCarrossel(id))?.revisado).toBeNull();
+  });
+
+  it("só carrossel pronto, e o que não existe também é recusado", async () => {
+    const pendente = await criado(5);
+    expect(await repo.salvarParteDoCarrossel(pendente, { tipo: "slide", numero: 1 }, { gancho: GANCHO }, null)).toEqual({
+      ok: false,
+      motivo: "nao_pronto",
+    });
+    expect(
+      await repo.salvarParteDoCarrossel("0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f", { tipo: "slide", numero: 1 }, { gancho: GANCHO }, null)
+    ).toEqual({ ok: false, motivo: "nao_pronto" });
+  });
+
+  it("completa o nome que falta da conta, na mesma gravação", async () => {
+    const id = await pronto();
+    await banco.db().sql().query(`update carrosseis_gerados set arte = '{"conta":"1001","soTexto":[2]}'::jsonb where id = $1`, [id]);
+    await repo.salvarParteDoCarrossel(id, { tipo: "slide", numero: 1 }, { gancho: GANCHO }, { nome: "Thiago Vannuchi", arroba: "thiagovannuchi" });
+    expect((await repo.lerCarrossel(id))?.arte).toEqual({ conta: "1001", nome: "Thiago Vannuchi", arroba: "thiagovannuchi", soTexto: [2] });
+  });
+
+  // A linha é travada por uma transação do próprio teste, e os dois salvamentos partem enquanto ela
+  // está presa. Com a trava (`for update`), cada um lê o texto DEPOIS de pegar a linha, e o segundo
+  // junta sobre o primeiro. Sem ela, os dois leem o texto velho antes da trava soltar, e o segundo
+  // apaga o primeiro.
+  it("dois salvamentos ao mesmo tempo, de slides diferentes, não apagam um ao outro", async () => {
+    const id = await pronto();
+    let soltar!: () => void;
+    const segurando = new Promise<void>((f) => (soltar = f));
+    let travou!: () => void;
+    const travado = new Promise<void>((f) => (travou = f));
+    const transacao = banco
+      .db()
+      .sql()
+      .begin(async (tx) => {
+        await tx.query(`select id from carrosseis_gerados where id = $1 for update`, [id]);
+        travou();
+        await segurando;
+      });
+    await travado;
+    const a = repo.salvarParteDoCarrossel(id, { tipo: "slide", numero: 1 }, { gancho: GANCHO }, null);
+    const b = repo.salvarParteDoCarrossel(id, { tipo: "slide", numero: 5 }, { chamada: CHAMADA }, null);
+    try {
+      await new Promise((f) => setTimeout(f, 300));
+    } finally {
+      // Solta a trava antes de qualquer `expect` (a lição do teste do teto, logo acima).
+      soltar();
+      await transacao;
+    }
+    await Promise.all([a, b]);
+    expect((await repo.lerCarrossel(id))?.revisado).toEqual({ ...TEXTO, gancho: GANCHO, chamada: CHAMADA });
+  });
+});
+
 // A ARTE (Etapas 3 e 4): a conta do carrossel, com o nome e o @, gravada no pedido; o "só texto"
 // gravado só em carrossel pronto e SEM apagar a conta; o "Fixar nesta conta" uma vez só; e as contas
 // lidas SÓ pelas colunas do cabeçalho: a tabela `accounts` guarda o token de acesso de cada conta, e
```

Em `testes-integracao/bonus-carrossel-acoes.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/bonus-carrossel-acoes.integracao.ts b/testes-integracao/bonus-carrossel-acoes.integracao.ts
index f67bd6b..b815b40 100644
--- a/testes-integracao/bonus-carrossel-acoes.integracao.ts
+++ b/testes-integracao/bonus-carrossel-acoes.integracao.ts
@@ -86,6 +86,16 @@ describe("sem sessão, nenhuma action do carrossel age", () => {
     expect(destino).toBe("/entrar");
   });
 
+  it("salvarSlideDoCarrossel vai para /entrar", async () => {
+    const destino = await destinoDe(
+      async (f) => {
+        await acoes.salvarSlideDoCarrossel(null, f);
+      },
+      formulario({ id: "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d", parte: "slide_1", gancho: "Seu cliente sumiu? Não é culpa dele." })
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
npx vitest run tests/bonus-carrossel-textos.test.ts tests/bonus-arte-tela.test.ts tests/bonus-carrossel-paginas.test.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-carrossel-processo.integracao.ts testes-integracao/bonus-carrossel-acoes.integracao.ts
```

Esperado: os puros: 5 casos caem e 59 passam (64). A integração: `[rede-global] ALVO: banco de TESTE`, 11 caem e 18 passam (29).

- [ ] **Passo 3: o código**

Em `lib/bonus/carrossel-repositorio.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/carrossel-repositorio.ts b/lib/bonus/carrossel-repositorio.ts
index cc2c26d..636d7c5 100644
--- a/lib/bonus/carrossel-repositorio.ts
+++ b/lib/bonus/carrossel-repositorio.ts
@@ -4,7 +4,8 @@ import type { ContaDoCabecalho, ContaGuardada } from "./arte-conta";
 import type { ContextoDoCarrossel } from "./carrossel-ia-parametros";
 import type { LinhaDoCarrossel } from "./carrossel-linha";
 import { TETO_CARROSSEL_DIARIO } from "./carrossel-pedido";
-import type { TextoDoCarrossel } from "./carrossel-texto";
+import { textoDaLinhaDoCarrossel } from "./carrossel-tela";
+import { juntarParte, type ParteDoCarrossel, type ProblemaDoCampo, type TextoDoCarrossel } from "./carrossel-texto";
 import type { Medicao } from "./ia-parametros";
 import { ehIdDeBonus } from "./pedido";
 
@@ -113,6 +114,38 @@ export async function salvarRevisaoDoCarrossel(id: string, texto: TextoDoCarross
   return linhas.length > 0;
 }
 
+/**
+ * SALVAR UMA PARTE (um slide, ou a legenda) NUMA TRANSAÇÃO, COM A LINHA TRAVADA (spec da Etapa 4):
+ * lê o texto salvo (o revisado, ou o gerado) DEPOIS de travar a linha, junta a parte
+ * (`juntarParte`, puro) e grava. Dois salvamentos ao mesmo tempo, de partes diferentes, não apagam um
+ * ao outro: o segundo espera o primeiro e junta sobre o texto dele. Só carrossel pronto.
+ * `nomeQueFalta` completa o nome e o @ da conta gravada na Etapa 3 sem eles, na mesma gravação.
+ */
+export async function salvarParteDoCarrossel(
+  id: string,
+  parte: ParteDoCarrossel,
+  bruto: Record<string, unknown>,
+  nomeQueFalta: { nome: string | null; arroba: string | null } | null
+): Promise<
+  | { ok: true; texto: TextoDoCarrossel; avisos: ProblemaDoCampo[] }
+  | { ok: false; motivo: "nao_pronto" }
+  | { ok: false; motivo: "problemas"; problemas: ProblemaDoCampo[] }
+> {
+  if (!ehIdDeBonus(id)) return { ok: false, motivo: "nao_pronto" };
+  return sql().begin(async (tx) => {
+    const [linha] = (await tx.query(`select * from carrosseis_gerados where id = $1 for update`, [id])) as LinhaDoCarrossel[];
+    const atual = linha?.estado === "pronto" ? textoDaLinhaDoCarrossel(linha) : null;
+    if (!linha || !atual) return { ok: false as const, motivo: "nao_pronto" as const };
+    const r = juntarParte(linha.total_slides, linha.palavra, atual, parte, bruto);
+    if (!r.ok) return { ok: false as const, motivo: "problemas" as const, problemas: r.problemas };
+    await tx.query(
+      `update carrosseis_gerados set revisado = $2::jsonb, revisado_em = now(), arte = arte || $3::jsonb where id = $1`,
+      [id, r.texto, chavesDaConta(nomeQueFalta)]
+    );
+    return { ok: true as const, texto: r.texto, avisos: r.avisos };
+  });
+}
+
 /**
  * O "SÓ TEXTO" DA ARTE, só em carrossel pronto. Grava SÓ a chave `soTexto` (`arte || …` junta as
  * chaves), e nunca o objeto inteiro: até a Etapa 3 a escrita trocava a coluna toda, e gravar o "só
```

Em `lib/bonus/carrossel-textos.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/carrossel-textos.ts b/lib/bonus/carrossel-textos.ts
index 30950a0..353f42b 100644
--- a/lib/bonus/carrossel-textos.ts
+++ b/lib/bonus/carrossel-textos.ts
@@ -2,7 +2,7 @@
 // é indistinguível de sucesso, e o texto de cada saída vem de função pura, com teste.
 import type { Aviso } from "@/lib/avisos";
 import { SLIDES_MAX, SLIDES_MIN, TETO_CARROSSEL_DIARIO, type RecusaDoPedidoDeCarrossel } from "./carrossel-pedido";
-import { camposDoFormulario, type FalhaDaConferencia } from "./carrossel-texto";
+import { camposDoFormulario, type FalhaDaConferencia, type ParteDoCarrossel, type ProblemaDoCampo } from "./carrossel-texto";
 import { PALAVRA_MAX, PALAVRA_MIN } from "./pedido";
 import type { SituacaoNoLabs } from "./publicado";
 import type { TomDoQuadro } from "./textos";
@@ -17,6 +17,21 @@ export type AvisoDaRevisao = Aviso & { em: number };
 /** A recusa do "Gerar carrossel", que também volta como estado do formulário. */
 export type AvisoDoPedidoDeCarrossel = Aviso & { em: number };
 
+/**
+ * A resposta do "Salvar slide N" e do "Salvar legenda" (spec da Etapa 4), como estado do card do
+ * slide, e nunca por redirect (achado 52). `versao` é a versão nova da miniatura do slide salvo, e só
+ * ela é pedida de novo; é null para a legenda e na recusa, quando a miniatura não muda.
+ */
+export type AvisoDoSlide = Aviso & { em: number; versao: string | null };
+
+export const TEXTO_PARTE_INVALIDA = "Essa parte não existe neste carrossel. Recarregue a página.";
+
+/** O que se salvou, e o problema que ficou em outro campo, que não impede o salvar mas não some calado. */
+export function textoDaParteSalva(parte: ParteDoCarrossel, total: number, avisos: ProblemaDoCampo[]): string {
+  const salvo = parte.tipo === "legenda" ? "Legenda salva." : `Slide ${parte.numero} salvo.`;
+  return avisos.length ? `${salvo} Atenção, em outro campo: ${textoDosProblemasDoCarrossel(total, avisos)}` : salvo;
+}
+
 /** O aviso vai pela URL com texto E tom: `avisoDaUrl` lê os dois, e sem tom tudo vira erro. */
 export function urlDoCarrosselComAviso(bonusId: string, carrosselId: string, aviso: Aviso): string {
   return `/bonus/${bonusId}/carrossel/${carrosselId}?aviso=${encodeURIComponent(aviso.texto)}&tom=${aviso.tom}`;
```

Em `lib/bonus/arte-tela.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/arte-tela.ts b/lib/bonus/arte-tela.ts
index fb2486e..89fad71 100644
--- a/lib/bonus/arte-tela.ts
+++ b/lib/bonus/arte-tela.ts
@@ -64,6 +64,14 @@ export function cabecalhoDaConta(c: ContaDoCabecalho, foto: string | null): Cabe
   return { nome, arroba: c.username ?? "", foto, iniciais: iniciais(nome, "IG") };
 }
 
+/**
+ * O cabeçalho que a versão das miniaturas resume: o da conta, com a URL da foto no lugar do `data:`
+ * que só a rota tem. A página e a action de salvar o usam, para as duas darem a mesma versão.
+ */
+export function cabecalhoParaVersao(conta: ContaDoCabecalho | null): CabecalhoDaArte {
+  return conta ? cabecalhoDaConta(conta, conta.profile_picture_url) : { nome: "", arroba: "", foto: null, iniciais: "IG" };
+}
+
 /**
  * A VERSÃO DA PRÉVIA: um resumo curto (FNV-1a de 32 bits) de TUDO o que muda a imagem. A `<img>` só
  * pede de novo quando a URL muda, e a rota responde `no-store`, então é esta versão que decide se a
```

Em `app/bonus/carrossel-actions.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/carrossel-actions.ts b/app/bonus/carrossel-actions.ts
index 812f3d1..6b89b9a 100644
--- a/app/bonus/carrossel-actions.ts
+++ b/app/bonus/carrossel-actions.ts
@@ -9,9 +9,12 @@ import {
   contaParaGuardar,
   contaSelecionada,
   nomeQueFalta,
+  resolverConta,
   type ContaGuardada,
 } from "@/lib/bonus/arte-conta";
 import { escolhasDaArte, lerSoTextoDoFormulario } from "@/lib/bonus/arte-escolhas";
+import { slidesDoTexto } from "@/lib/bonus/arte-slides";
+import { cabecalhoParaVersao, versoesDosSlides } from "@/lib/bonus/arte-tela";
 import {
   TEXTO_ARTE_NAO_PRONTA,
   TEXTO_ARTE_SALVA,
@@ -27,24 +30,28 @@ import {
   criarPedidoDeCarrossel,
   fixarContaDoCarrossel as gravarContaFixada,
   lerCarrossel,
+  salvarParteDoCarrossel,
   salvarRevisaoDoCarrossel as gravarRevisao,
   salvarSoTextoDaArte,
 } from "@/lib/bonus/carrossel-repositorio";
 import { textoDaLinhaDoCarrossel } from "@/lib/bonus/carrossel-tela";
-import { camposDoFormulario, lerRevisaoDoCarrossel } from "@/lib/bonus/carrossel-texto";
+import { camposDaParte, camposDoFormulario, lerParte, lerRevisaoDoCarrossel } from "@/lib/bonus/carrossel-texto";
 import {
   TEXTO_CARROSSEL_NAO_ENCONTRADO,
   TEXTO_CARROSSEL_NAO_REVISAVEL,
   TEXTO_NAO_DA_PARA_GERAR_CARROSSEL_DE_NOVO,
+  TEXTO_PARTE_INVALIDA,
   TEXTO_REVISAO_SALVA,
   TEXTO_SO_BONUS_CRIADO,
   quadroDaSituacao,
+  textoDaParteSalva,
   textoDaRecusaDoPedidoDeCarrossel,
   textoDoTetoDoCarrossel,
   textoDosProblemasDoCarrossel,
   urlDoCarrosselComAviso,
   type AvisoDaRevisao,
   type AvisoDoPedidoDeCarrossel,
+  type AvisoDoSlide,
 } from "@/lib/bonus/carrossel-textos";
 import { temChaveDaIA } from "@/lib/bonus/config";
 import { ehIdDeBonus } from "@/lib/bonus/pedido";
@@ -198,6 +205,40 @@ export async function salvarRevisaoDoCarrossel(
   return salvou ? resposta("ok", TEXTO_REVISAO_SALVA) : resposta("erro", TEXTO_CARROSSEL_NAO_REVISAVEL);
 }
 
+/**
+ * O "SALVAR SLIDE N" E O "SALVAR LEGENDA" (spec da Etapa 4): grava só a parte, juntada ao texto
+ * salvo numa transação com a linha travada (carrossel-repositorio.ts), e recusa só pelos problemas
+ * dela. A resposta volta como ESTADO do card (achado 52), com a versão nova da miniatura do slide
+ * salvo: só ela é pedida de novo. Os campos que o formulário trouxer fora da parte são ignorados.
+ */
+export async function salvarSlideDoCarrossel(_anterior: AvisoDoSlide | null, form: FormData): Promise<AvisoDoSlide | null> {
+  await exigirSessao();
+  const id = form.get("id");
+  if (!ehIdDeBonus(id)) redirect(urlDoBonusComAviso(null, { tom: "erro", texto: TEXTO_CARROSSEL_NAO_ENCONTRADO }));
+  const linha = await lerCarrossel(id);
+  if (!linha) redirect(urlDoBonusComAviso(null, { tom: "erro", texto: TEXTO_CARROSSEL_NAO_ENCONTRADO }));
+  const resposta = (tom: AvisoDoSlide["tom"], texto: string, versao: string | null = null): AvisoDoSlide => ({
+    tom,
+    texto,
+    em: Date.now(),
+    versao,
+  });
+  const total = linha.total_slides;
+  const parte = lerParte(form.get("parte"), total);
+  if (!parte) return resposta("erro", TEXTO_PARTE_INVALIDA);
+  const bruto = Object.fromEntries(camposDaParte(total, parte).map((c) => [c, form.get(c)]));
+  const contas = await contasParaArte();
+  const escolhas = escolhasDaArte(linha.arte, total);
+  const r = await salvarParteDoCarrossel(id, parte, bruto, nomeQueFalta(contas, escolhas));
+  if (!r.ok && r.motivo === "nao_pronto") return resposta("erro", TEXTO_CARROSSEL_NAO_REVISAVEL);
+  if (!r.ok) return resposta("erro", `Corrija antes de salvar. ${textoDosProblemasDoCarrossel(total, r.problemas)}`);
+  const texto = textoDaParteSalva(parte, total, r.avisos);
+  if (parte.tipo === "legenda") return resposta("ok", texto);
+  const { conta } = resolverConta(contas, escolhas, await contaDoCookie());
+  const versoes = versoesDosSlides(slidesDoTexto(r.texto), escolhas.soTexto, cabecalhoParaVersao(conta));
+  return resposta("ok", texto, versoes[parte.numero - 1] ?? null);
+}
+
 /**
  * O "SÓ TEXTO" DA ARTE. A resposta volta como ESTADO (useActionState), e nunca por redirect, pelo
  * mesmo motivo do salvar da revisão (achado 52): a seção da arte fica na página do editor, e recriar
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx vitest run tests/bonus-carrossel-textos.test.ts tests/bonus-arte-tela.test.ts tests/bonus-carrossel-paginas.test.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-carrossel-processo.integracao.ts testes-integracao/bonus-carrossel-acoes.integracao.ts
```

Esperado: `tsc` limpo; 64 casos puros passam; a integração, 29 passam.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/carrossel-repositorio.ts lib/bonus/carrossel-textos.ts lib/bonus/arte-tela.ts app/bonus/carrossel-actions.ts tests/bonus-carrossel-textos.test.ts tests/bonus-arte-tela.test.ts tests/bonus-carrossel-paginas.test.ts testes-integracao/bonus-carrossel-processo.integracao.ts testes-integracao/bonus-carrossel-acoes.integracao.ts
test "$(git branch --show-current)" = "pagina-do-carrossel"
git add lib/bonus/carrossel-repositorio.ts lib/bonus/carrossel-textos.ts lib/bonus/arte-tela.ts app/bonus/carrossel-actions.ts tests/bonus-carrossel-textos.test.ts tests/bonus-arte-tela.test.ts tests/bonus-carrossel-paginas.test.ts testes-integracao/bonus-carrossel-processo.integracao.ts testes-integracao/bonus-carrossel-acoes.integracao.ts
git commit -m "feat(bonus): salvar um slide, com a linha travada e a versão da miniatura dele"
```

---

### FASE 4.8 — A página, slide a slide

**Arquivos:**
- Criar: `app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx`
- Modificar: `.../editor-do-carrossel.tsx`, `.../page.tsx`, `app/bonus/carrossel-actions.ts`,
  `lib/bonus/carrossel-repositorio.ts`, `lib/bonus/carrossel-textos.ts`, `lib/bonus/arte-textos.ts`,
  `lib/bonus/carrossel-texto.ts` (só o comentário de `lerRevisaoDoCarrossel`, que fica sem uso na tela)
- Apagar: `.../arte-do-carrossel.tsx`, `.../formulario-da-revisao.tsx` e os testes de tela deles
- Testar: `testes-dom/bonus-card-da-parte.dom.tsx` (novo), `testes-dom/bonus-editor-do-carrossel.dom.tsx`,
  `tests/bonus-carrossel-paginas.test.ts`, `tests/bonus-paginas.test.ts`, e a integração do carrossel

**Interfaces:**
- Consome: `salvarSlideDoCarrossel` (FASE 4.7); `salvarArteDoCarrossel` e
  `fixarContaDoCarrossel` (FASE 4.6); `camposDaParte`, `versoesDosSlides`, `avisosDeCabimento`.
- Produz: `CardDaParte` (a miniatura, o "Só texto", o "Baixar", o "Editar" que abre os campos sem
  desmontá-los, o "não salvo", e o "Salvar slide N" ou "Salvar legenda"); `EditorDoCarrossel`, que
  recebe `acaoDoSlide`, `acaoDaArte` e `acaoDaConta` e guarda as versões, o "só texto" aceito e o
  "Fixar nesta conta". Saem `salvarRevisaoDoCarrossel` (action e repositório), `AvisoDaRevisao` e
  `TEXTO_REVISAO_SALVA`.

- [ ] **Passo 1: os testes**

Crie `testes-dom/bonus-card-da-parte.dom.tsx`:

```tsx
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import CardDaParte from "@/app/bonus/[id]/carrossel/[cid]/card-da-parte";
import { urlDaArte } from "@/lib/bonus/arte-tela";
import { textoNaoCabeComEspaco } from "@/lib/bonus/arte-textos";
import { camposDaParte, camposDoFormulario, type ParteDoCarrossel } from "@/lib/bonus/carrossel-texto";
import type { AvisoDoSlide } from "@/lib/bonus/carrossel-textos";

// O CARD DE UMA PARTE DO CARROSSEL (spec da Etapa 4): a miniatura do slide e, ao lado, o editor dele,
// que abre no "Editar" e grava só ele no "Salvar slide N". A resposta volta como ESTADO do card
// (achado 52): numa recusa a edição fica, e salvo, a miniatura troca pela versão que a action devolve.
// A action entra por propriedade, e aqui é uma falsa.

const BONUS = "0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f";
const CARROSSEL = "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d";
const VALORES = {
  gancho: "Seu cliente sumiu? Não é culpa dele.",
  slide_1_titulo: "O que fazer primeiro",
  slide_1_texto: "Mande uma mensagem curta, lembrando do que ele comprou.",
  chamada: "Comente SUMIDO e receba as mensagens prontas.",
  legenda: "Quem sumiu ainda pode voltar. Comente SUMIDO que eu te mando as mensagens prontas.",
};
/** Não cabe com a manchete e o espaço da imagem; cabe no só texto (arte-slides). */
const OITO_LINHAS = Array(8).fill("x".repeat(20)).join("\n");
const SLIDE_2: ParteDoCarrossel = { tipo: "slide", numero: 2 };

/** O card como o editor o usa: o pai guarda a versão da miniatura e o "só texto". */
function Card({ acao, parte, soTextoInicial = false }: { acao: (a: AvisoDoSlide | null, f: FormData) => Promise<AvisoDoSlide | null>; parte: ParteDoCarrossel; soTextoInicial?: boolean }) {
  const [versao, setVersao] = useState("v1");
  const [soTexto, setSoTexto] = useState(soTextoInicial);
  return (
    <CardDaParte
      acao={acao}
      bonusId={BONUS}
      carrosselId={CARROSSEL}
      palavra="SUMIDO"
      total={3}
      parte={parte}
      campos={camposDoFormulario(3).filter((c) => camposDaParte(3, parte).includes(c.nome))}
      valores={VALORES}
      versao={parte.tipo === "slide" ? versao : null}
      aoNovaVersao={setVersao}
      soTexto={soTexto}
      aoMudarSoTexto={setSoTexto}
      soTextoPendente={false}
    />
  );
}

function renderizar(respostas: AvisoDoSlide[], parte: ParteDoCarrossel = SLIDE_2) {
  const recebidos: FormData[] = [];
  render(
    <Card
      parte={parte}
      acao={async (_a, f) => {
        recebidos.push(f);
        return respostas.shift() ?? null;
      }}
    />
  );
  return recebidos;
}

const miniatura = () => screen.getByAltText("Slide 2 de 3") as HTMLImageElement;
const texto = () => screen.getByLabelText("Slide 2: texto") as HTMLTextAreaElement;
const editar = () => fireEvent.click(screen.getByRole("button", { name: "Editar" }));
async function salvar(nome = "Salvar slide 2") {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: nome }));
  });
}

describe("o card de um slide", () => {
  it("mostra a miniatura pela rota da arte, com a versão, e o baixar do slide", () => {
    renderizar([]);
    expect(miniatura().getAttribute("src")).toBe(urlDaArte(BONUS, CARROSSEL, 2, "v1"));
    const baixar = screen.getByRole("link", { name: "Baixar o slide 2" });
    expect(baixar.getAttribute("href")).toBe(urlDaArte(BONUS, CARROSSEL, 2, "v1", true));
    expect(baixar.hasAttribute("download")).toBe(true);
  });

  it("os campos do slide ficam fechados; o Editar abre só os dele", () => {
    renderizar([]);
    expect(texto().closest("[hidden]")).not.toBeNull();
    editar();
    expect(texto().closest("[hidden]")).toBeNull();
    expect(screen.getByLabelText("Slide 2: título")).toBeTruthy();
    expect(screen.queryByLabelText("Gancho (slide 1)")).toBeNull();
  });

  it("salvar manda o id, a parte e os campos dela", async () => {
    const recebidos = renderizar([{ tom: "ok", texto: "Slide 2 salvo.", em: 1, versao: "v2" }]);
    editar();
    fireEvent.change(texto(), { target: { value: "Um texto revisado do slide dois, mais curto." } });
    await salvar();
    expect(recebidos.map((f) => [f.get("id"), f.get("parte"), f.get("slide_1_titulo"), f.get("slide_1_texto")])).toEqual([
      [CARROSSEL, "slide_2", "O que fazer primeiro", "Um texto revisado do slide dois, mais curto."],
    ]);
  });

  it("salvo, a miniatura troca pela versão que a action devolveu, e a edição fica", async () => {
    renderizar([{ tom: "ok", texto: "Slide 2 salvo.", em: 1, versao: "v2" }]);
    editar();
    fireEvent.change(texto(), { target: { value: "Um texto revisado do slide dois, mais curto." } });
    await salvar();
    expect(miniatura().getAttribute("src")).toBe(urlDaArte(BONUS, CARROSSEL, 2, "v2"));
    expect(texto().value).toBe("Um texto revisado do slide dois, mais curto.");
    expect(screen.getByRole("status").textContent).toBe("Slide 2 salvo.");
  });

  it("numa recusa, a edição fica, o motivo aparece junto do botão, e a miniatura não troca", async () => {
    renderizar([{ tom: "erro", texto: "Corrija antes de salvar. Slide 2: texto: precisa de pelo menos 30 caracteres.", em: 1, versao: null }]);
    editar();
    fireEvent.change(texto(), { target: { value: "curto" } });
    await salvar();
    expect(texto().value).toBe("curto");
    expect(screen.getByRole("status").textContent).toMatch(/precisa de pelo menos 30/);
    expect(miniatura().getAttribute("src")).toBe(urlDaArte(BONUS, CARROSSEL, 2, "v1"));
  });

  it("não salvo aparece ao editar, some ao salvar, e fica na recusa", async () => {
    renderizar([
      { tom: "erro", texto: "Corrija antes de salvar.", em: 1, versao: null },
      { tom: "ok", texto: "Slide 2 salvo.", em: 2, versao: "v2" },
    ]);
    expect(screen.queryByText("não salvo")).toBeNull();
    editar();
    fireEvent.input(texto(), { target: { value: "Um texto revisado do slide dois, mais curto." } });
    expect(screen.getByText("não salvo")).toBeTruthy();
    await salvar();
    expect(screen.getByText("não salvo")).toBeTruthy();
    await salvar();
    expect(screen.queryByText("não salvo")).toBeNull();
  });

  it("fechar não apaga o que se digitou", () => {
    renderizar([]);
    editar();
    fireEvent.input(texto(), { target: { value: "Um texto que ainda não foi salvo, e não some." } });
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    editar();
    expect(texto().value).toBe("Um texto que ainda não foi salvo, e não some.");
    expect(screen.getByText("não salvo")).toBeTruthy();
  });

  it("o não cabe aparece enquanto se digita, junto do campo e embaixo da miniatura", () => {
    renderizar([]);
    editar();
    expect(screen.queryAllByText(textoNaoCabeComEspaco(2))).toHaveLength(0);
    fireEvent.input(texto(), { target: { value: OITO_LINHAS } });
    expect(screen.getAllByText(textoNaoCabeComEspaco(2))).toHaveLength(2);
  });

  it("marcado só texto, o mesmo slide cabe, e o aviso some", () => {
    renderizar([]);
    editar();
    fireEvent.input(texto(), { target: { value: OITO_LINHAS } });
    fireEvent.click(screen.getByLabelText("Slide 2: só texto, sem o espaço da imagem"));
    expect(screen.queryAllByText(textoNaoCabeComEspaco(2))).toHaveLength(0);
  });
});

describe("o card da legenda", () => {
  it("não tem miniatura, e salva a parte legenda", async () => {
    const recebidos = renderizar([{ tom: "ok", texto: "Legenda salva.", em: 1, versao: null }], { tipo: "legenda" });
    expect(screen.queryByRole("img")).toBeNull();
    editar();
    fireEvent.change(screen.getByLabelText("Legenda do post"), { target: { value: `${VALORES.legenda} E vale para quem sumiu há meses.` } });
    await salvar("Salvar legenda");
    expect(recebidos.map((f) => [f.get("parte"), f.get("legenda")])).toEqual([
      ["legenda", `${VALORES.legenda} E vale para quem sumiu há meses.`],
    ]);
    expect(screen.getByRole("status").textContent).toBe("Legenda salva.");
  });
});
```

Em `testes-dom/bonus-editor-do-carrossel.dom.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-dom/bonus-editor-do-carrossel.dom.tsx b/testes-dom/bonus-editor-do-carrossel.dom.tsx
index ffe5c97..572d40e 100644
--- a/testes-dom/bonus-editor-do-carrossel.dom.tsx
+++ b/testes-dom/bonus-editor-do-carrossel.dom.tsx
@@ -1,14 +1,15 @@
-import { act, fireEvent, render, screen } from "@testing-library/react";
-import { describe, expect, it } from "vitest";
+import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
+import { afterEach, describe, expect, it, vi } from "vitest";
 import EditorDoCarrossel from "@/app/bonus/[id]/carrossel/[cid]/editor-do-carrossel";
-import { textoNaoCabeComEspaco } from "@/lib/bonus/arte-textos";
+import { urlDaArte } from "@/lib/bonus/arte-tela";
 import type { AvisoDaArte } from "@/lib/bonus/arte-textos";
 import { camposDoFormulario } from "@/lib/bonus/carrossel-texto";
-import type { AvisoDaRevisao } from "@/lib/bonus/carrossel-textos";
+import type { AvisoDoSlide } from "@/lib/bonus/carrossel-textos";
 
-// O EDITOR E A ARTE NUM COMPONENTE SÓ (spec da Etapa 3): o aviso "não cabe" acompanha o que se
-// digita, e a miniatura troca depois de "Revisão salva.", sem redirect nem `router.refresh` (a
-// lição dos achados 52 e 54: recriar a página apaga o que estava na tela).
+// O EDITOR DO CARROSSEL, SLIDE A SLIDE (spec da Etapa 4): a conta do carrossel, um card por slide e o
+// da legenda, o "só texto" de cada slide e o "Baixar todos". Nada usa redirect nem `router.refresh`
+// (a lição dos achados 52 e 54: recriar a página apaga o que estava na tela). As actions entram por
+// propriedade, e aqui são falsas.
 
 const BONUS = "0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f";
 const CARROSSEL = "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d";
@@ -19,67 +20,138 @@ const VALORES = {
   chamada: "Comente SUMIDO e receba as mensagens prontas.",
   legenda: "Quem sumiu ainda pode voltar. Comente SUMIDO que eu te mando as mensagens prontas.",
 };
-/** Cabe sozinho, e não cabe com a manchete e o espaço da imagem (arte-slides). */
-const OITO_LINHAS = Array(8).fill("x".repeat(20)).join("\n");
 
-function renderizar({ revisao = [] as AvisoDaRevisao[], arte = [] as AvisoDaArte[] } = {}) {
+afterEach(() => {
+  vi.restoreAllMocks();
+});
+
+function renderizar({
+  slide = [] as AvisoDoSlide[],
+  arte = [] as AvisoDaArte[],
+  conta = [] as AvisoDaArte[],
+  podeFixar = false,
+  avisoDaConta = null as string | null,
+} = {}) {
+  const recebidos = { slide: [] as FormData[], arte: [] as FormData[], conta: [] as FormData[] };
   render(
     <EditorDoCarrossel
-      acaoDaRevisao={async () => revisao.shift() ?? null}
-      acaoDaArte={async () => arte.shift() ?? null}
+      acaoDoSlide={async (_a, f) => {
+        recebidos.slide.push(f);
+        return slide.shift() ?? null;
+      }}
+      acaoDaArte={async (_a, f) => {
+        recebidos.arte.push(f);
+        return arte.shift() ?? null;
+      }}
+      acaoDaConta={async (_a, f) => {
+        recebidos.conta.push(f);
+        return conta.shift() ?? null;
+      }}
       bonusId={BONUS}
       carrosselId={CARROSSEL}
       palavra="SUMIDO"
       total={3}
       campos={camposDoFormulario(3)}
       valores={VALORES}
-      contas={[{ id: "1001", rotulo: "Thiago Vannuchi (@thiagovannuchi)" }]}
-      contaInicial="1001"
-      avisoDaConta={null}
+      rotuloDaConta="Thiago Vannuchi (@thiagovannuchi)"
+      avisoDaConta={avisoDaConta}
+      podeFixar={podeFixar}
       soTextoInicial={[]}
-      versaoBase="abcd1234"
+      versoes={["a1", "b1", "c1"]}
+      pausaMs={0}
     />
   );
+  return recebidos;
 }
 
-const textoDoSlide2 = () => screen.getByLabelText("Slide 2: texto") as HTMLTextAreaElement;
-const miniatura2 = () => screen.getByAltText("Slide 2 de 3") as HTMLImageElement;
+const miniatura = (n: number) => screen.getByAltText(`Slide ${n} de 3`) as HTMLImageElement;
+const soTexto = (n: number) => screen.getByLabelText(`Slide ${n}: só texto, sem o espaço da imagem`) as HTMLInputElement;
+const cards = () => screen.getAllByRole("listitem");
+
+describe("o editor do carrossel, slide a slide", () => {
+  it("um card por slide, na ordem, e o da legenda por último", () => {
+    renderizar();
+    expect(cards().map((c) => within(c).getByRole("heading").textContent)).toEqual(["Slide 1", "Slide 2", "Slide 3", "Legenda"]);
+    expect([1, 2, 3].map((n) => miniatura(n).getAttribute("src"))).toEqual(
+      ["a1", "b1", "c1"].map((v, i) => urlDaArte(BONUS, CARROSSEL, i + 1, v))
+    );
+  });
 
-describe("o editor do carrossel", () => {
-  it("o não cabe aparece enquanto se digita, junto do campo e embaixo da miniatura", () => {
+  it("a conta do carrossel aparece pelo nome, e não há seletor de conta", () => {
     renderizar();
-    expect(screen.queryAllByText(textoNaoCabeComEspaco(2))).toHaveLength(0);
-    fireEvent.input(textoDoSlide2(), { target: { value: OITO_LINHAS } });
-    expect(screen.getAllByText(textoNaoCabeComEspaco(2))).toHaveLength(2);
+    expect(screen.getByText("Thiago Vannuchi (@thiagovannuchi)")).toBeTruthy();
+    expect(screen.queryByRole("combobox")).toBeNull();
+  });
+
+  it("salvar o slide 2 troca só a miniatura 2", async () => {
+    renderizar({ slide: [{ tom: "ok", texto: "Slide 2 salvo.", em: 1, versao: "b2" }] });
+    fireEvent.click(within(cards()[1]).getByRole("button", { name: "Editar" }));
+    await act(async () => {
+      fireEvent.click(screen.getByRole("button", { name: "Salvar slide 2" }));
+    });
+    expect([1, 2, 3].map((n) => miniatura(n).getAttribute("src"))).toEqual(
+      ["a1", "b2", "c1"].map((v, i) => urlDaArte(BONUS, CARROSSEL, i + 1, v))
+    );
+  });
+
+  it("marcar só texto grava os slides marcados, e a miniatura troca pela versão devolvida", async () => {
+    const recebidos = renderizar({ arte: [{ tom: "ok", texto: "Arte salva.", em: 7, versoes: ["a1", "b3", "c1"] }] });
+    await act(async () => {
+      fireEvent.click(soTexto(2));
+    });
+    expect(recebidos.arte.map((f) => [f.get("id"), f.getAll("so_texto"), f.get("conta")])).toEqual([[CARROSSEL, ["2"], null]]);
+    expect(soTexto(2).checked).toBe(true);
+    expect(miniatura(2).getAttribute("src")).toBe(urlDaArte(BONUS, CARROSSEL, 2, "b3"));
   });
 
-  it("marcado só texto, o mesmo slide cabe, e o aviso some", async () => {
-    renderizar({ arte: [{ tom: "ok", texto: "Arte salva.", em: 5 }] });
-    fireEvent.input(textoDoSlide2(), { target: { value: OITO_LINHAS } });
+  // A miniatura e o "Baixar" seguem o que está gravado. A caixa e o "não cabe" seguem a tela, e não
+  // podem mostrar uma escolha que o servidor recusou (achado 67): voltam para a última aceita.
+  it("na recusa, o só texto volta para a última escolha aceita", async () => {
+    renderizar({
+      arte: [
+        { tom: "ok", texto: "Arte salva.", em: 7, versoes: ["a1", "b3", "c1"] },
+        { tom: "erro", texto: "Esse slide não existe neste carrossel. Recarregue a página.", em: 9 },
+      ],
+    });
+    await act(async () => {
+      fireEvent.click(soTexto(2));
+    });
     await act(async () => {
-      fireEvent.click(screen.getByLabelText("Slide 2: só texto, sem o espaço da imagem"));
+      fireEvent.click(soTexto(1));
     });
-    expect(screen.queryAllByText(textoNaoCabeComEspaco(2))).toHaveLength(0);
+    expect(screen.getByText("Esse slide não existe neste carrossel. Recarregue a página.")).toBeTruthy();
+    expect([1, 2, 3].map((n) => soTexto(n).checked)).toEqual([false, true, false]);
   });
 
-  it("depois de Revisão salva., as miniaturas trocam de versão, sem a página ser recriada", async () => {
-    renderizar({ revisao: [{ tom: "ok", texto: "Revisão salva.", em: 42 }] });
-    const antes = miniatura2().getAttribute("src");
-    fireEvent.input(textoDoSlide2(), { target: { value: "Um texto revisado do slide dois, mais curto." } });
+  it("Fixar nesta conta: aparece com o aviso, grava o id, e some quando fixa", async () => {
+    const aviso = 'Este carrossel é de antes de a conta ser gravada. Use "Fixar nesta conta".';
+    const recebidos = renderizar({ podeFixar: true, avisoDaConta: aviso, conta: [{ tom: "ok", texto: "Conta fixada neste carrossel.", em: 3 }] });
+    expect(screen.getByText(aviso)).toBeTruthy();
     await act(async () => {
-      fireEvent.click(screen.getByRole("button", { name: "Salvar revisão" }));
+      fireEvent.click(screen.getByRole("button", { name: "Fixar nesta conta" }));
     });
-    expect(miniatura2().getAttribute("src")).not.toBe(antes);
-    expect(miniatura2().getAttribute("src")).toContain("v=abcd1234-42-0");
-    expect(textoDoSlide2().value).toBe("Um texto revisado do slide dois, mais curto.");
+    expect(recebidos.conta.map((f) => f.get("id"))).toEqual([CARROSSEL]);
+    expect(screen.queryByRole("button", { name: "Fixar nesta conta" })).toBeNull();
+    expect(screen.queryByText(aviso)).toBeNull();
+    expect(screen.getByText("Conta fixada neste carrossel.")).toBeTruthy();
+  });
+
+  it("sem conta a fixar, o botão não aparece", () => {
+    renderizar({ podeFixar: false, avisoDaConta: "A conta deste carrossel (@n8x) foi desconectada do Chat." });
+    expect(screen.queryByRole("button", { name: "Fixar nesta conta" })).toBeNull();
   });
 
-  it("a recusa da revisão não troca a miniatura", async () => {
-    renderizar({ revisao: [{ tom: "erro", texto: "Corrija antes de salvar.", em: 43 }] });
-    const antes = miniatura2().getAttribute("src");
+  it("baixar todos baixa um arquivo por slide, em ordem, com a versão de cada um", async () => {
+    renderizar();
+    expect(screen.getByText(/pode pedir permissão para baixar vários arquivos/)).toBeTruthy();
+    const baixados: string[] = [];
+    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
+      baixados.push(`${this.getAttribute("href")}|${this.hasAttribute("download")}`);
+    });
     await act(async () => {
-      fireEvent.click(screen.getByRole("button", { name: "Salvar revisão" }));
+      fireEvent.click(screen.getByRole("button", { name: "Baixar todos" }));
     });
-    expect(miniatura2().getAttribute("src")).toBe(antes);
+    await waitFor(() => expect(baixados).toHaveLength(3));
+    expect(baixados).toEqual(["a1", "b1", "c1"].map((v, i) => `${urlDaArte(BONUS, CARROSSEL, i + 1, v, true)}|true`));
   });
 });
```

Em `tests/bonus-carrossel-paginas.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-carrossel-paginas.test.ts b/tests/bonus-carrossel-paginas.test.ts
index 50ec27b..0314a9d 100644
--- a/tests/bonus-carrossel-paginas.test.ts
+++ b/tests/bonus-carrossel-paginas.test.ts
@@ -16,28 +16,13 @@ describe("a página do carrossel", () => {
     expect(ler("app/bonus/[id]/carrossel/[cid]/page.tsx")).toContain('import Acompanhar from "../../acompanhar";');
   });
 
-  // Na Etapa 3, a página entrega as duas actions ao editor (editor-do-carrossel.tsx), que leva a
-  // da revisão ao formulário e a da arte à seção da arte.
-  it("entrega a action de salvar a revisão e a de salvar a arte ao editor do carrossel", () => {
+  // Na Etapa 4, a página entrega as três actions ao editor (editor-do-carrossel.tsx): a do slide
+  // vai a cada card, a da arte grava o "só texto", e a da conta é o "Fixar nesta conta".
+  it("entrega a action do slide, a da arte e a da conta ao editor do carrossel", () => {
     const pagina = ler("app/bonus/[id]/carrossel/[cid]/page.tsx");
-    expect(pagina).toContain("acaoDaRevisao={salvarRevisaoDoCarrossel}");
+    expect(pagina).toContain("acaoDoSlide={salvarSlideDoCarrossel}");
     expect(pagina).toContain("acaoDaArte={salvarArteDoCarrossel}");
-  });
-});
-
-// O "SALVAR REVISÃO" NÃO REDIRECIONA (achado 52, causa medida em 01/10 num navegador de verdade):
-// todo redirect de Server Action recria a página no Next 16, e o que o operador tinha digitado
-// voltava ao texto com que a página abriu. A recusa e o "Revisão salva." voltam como estado do
-// formulário. Só a sessão e o carrossel inexistente saem por redirect, para OUTRA página.
-describe("o salvar da revisão responde sem recriar a página", () => {
-  it("salvarRevisaoDoCarrossel não redireciona para a página do carrossel", () => {
-    const fonte = ler("app/bonus/carrossel-actions.ts");
-    const inicio = fonte.indexOf("export async function salvarRevisaoDoCarrossel(");
-    const fim = fonte.indexOf("\nexport ", inicio + 1);
-    const corpo = fonte.slice(inicio, fim === -1 ? undefined : fim);
-    expect(inicio).toBeGreaterThan(-1);
-    expect(corpo).not.toMatch(/urlDoCarrosselComAviso\(/);
-    expect(corpo).not.toMatch(/redirect\(`\/bonus\/\$\{/);
+    expect(pagina).toContain("acaoDaConta={fixarContaDoCarrossel}");
   });
 });
 
@@ -105,14 +90,13 @@ function primeirasInstrucoes(fonte: string): { nome: string; primeira: string }[
 // A SESSÃO É CONFERIDA DENTRO DE CADA ACTION, e não só no proxy.ts: Server Action tem endereço
 // próprio. O mesmo leitor de tests/bonus-paginas.test.ts, para o arquivo novo.
 describe("toda action do carrossel confere a sessão antes de qualquer coisa", () => {
-  it("as seis actions começam por `await exigirSessao();`", () => {
+  it("as cinco actions começam por `await exigirSessao();`", () => {
     const achados = primeirasInstrucoes(ler("app/bonus/carrossel-actions.ts"));
     expect(achados.map((a) => a.nome).sort()).toEqual([
       "fixarContaDoCarrossel",
       "gerarCarrosselDeNovo",
       "pedirCarrossel",
       "salvarArteDoCarrossel",
-      "salvarRevisaoDoCarrossel",
       "salvarSlideDoCarrossel",
     ]);
     for (const a of achados) expect(a.primeira, a.nome).toBe("await exigirSessao();");
```

Em `tests/bonus-paginas.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-paginas.test.ts b/tests/bonus-paginas.test.ts
index 1dcee29..81335de 100644
--- a/tests/bonus-paginas.test.ts
+++ b/tests/bonus-paginas.test.ts
@@ -65,9 +65,8 @@ describe("nenhum campo de revisão do bônus volta a ser não controlado", () =>
     "app/bonus/[id]/formulario-do-envio.tsx",
     "app/bonus/[id]/carrossel/[cid]/page.tsx",
     "app/bonus/[id]/carrossel/[cid]/campo.tsx",
-    "app/bonus/[id]/carrossel/[cid]/formulario-da-revisao.tsx",
     "app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx",
-    "app/bonus/[id]/carrossel/[cid]/arte-do-carrossel.tsx",
+    "app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx",
   ])("%s não usa defaultValue", (arquivo) => {
     const semComentarios = ler(arquivo)
       .split("\n")
```

Em `testes-integracao/bonus-carrossel-processo.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/bonus-carrossel-processo.integracao.ts b/testes-integracao/bonus-carrossel-processo.integracao.ts
index b5f4ee0..533f282 100644
--- a/testes-integracao/bonus-carrossel-processo.integracao.ts
+++ b/testes-integracao/bonus-carrossel-processo.integracao.ts
@@ -196,21 +196,8 @@ describe("processarCarrossel", () => {
   });
 });
 
-describe("a revisão e a lista", () => {
-  it("só salva carrossel pronto, e grava quando", async () => {
-    const pronto = await criado(5);
-    await processo.processarCarrossel(pronto, devolve(TEXTO));
-    const revisado = { ...TEXTO, gancho: "Seu cliente sumiu? Traga ele de volta." };
-    expect(await repo.salvarRevisaoDoCarrossel(pronto, revisado)).toBe(true);
-    const l = await repo.lerCarrossel(pronto);
-    expect(l?.revisado).toEqual(revisado);
-    expect(l?.revisado_em).toBeInstanceOf(Date);
-
-    const falho = await criado(6);
-    await processo.processarCarrossel(falho, devolve(TEXTO));
-    expect(await repo.salvarRevisaoDoCarrossel(falho, revisado)).toBe(false);
-  });
-
+// A revisão se grava por parte (salvarParteDoCarrossel, mais abaixo), desde a Etapa 4.
+describe("a lista", () => {
   it("a lista do bônus vem do mais novo para o mais velho, e só dele", async () => {
     const velho = await criado(5);
     const novo = await criado(3);
```

Em `testes-integracao/bonus-carrossel-acoes.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/bonus-carrossel-acoes.integracao.ts b/testes-integracao/bonus-carrossel-acoes.integracao.ts
index b815b40..90246af 100644
--- a/testes-integracao/bonus-carrossel-acoes.integracao.ts
+++ b/testes-integracao/bonus-carrossel-acoes.integracao.ts
@@ -95,15 +95,4 @@ describe("sem sessão, nenhuma action do carrossel age", () => {
     );
     expect(destino).toBe("/entrar");
   });
-
-  // O salvar da revisão recebe o estado anterior do formulário (useActionState, achado 52).
-  it("salvarRevisaoDoCarrossel vai para /entrar", async () => {
-    const destino = await destinoDe(
-      async (f) => {
-        await acoes.salvarRevisaoDoCarrossel(null, f);
-      },
-      formulario({ id: "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d" })
-    );
-    expect(destino).toBe("/entrar");
-  });
 });
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run --config vitest.dom.config.ts testes-dom/bonus-card-da-parte.dom.tsx testes-dom/bonus-editor-do-carrossel.dom.tsx
npx vitest run tests/bonus-carrossel-paginas.test.ts tests/bonus-paginas.test.ts
```

Esperado: na tela, o arquivo do card cai sem rodar caso nenhum (`Failed to resolve import "@/app/bonus/[id]/carrossel/[cid]/card-da-parte"`) e o do editor perde os 8 casos; nos puros, 3 caem (o editor recebe as três actions, as cinco actions começam por `exigirSessao`, o card não usa `defaultValue`) e 29 passam.

- [ ] **Passo 3: o card e o editor**

Crie `app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx`:

```tsx
"use client";
import { useActionState, useMemo, useState } from "react";
import { badgeWarn, btnPrimary, btnSecondary, card, hint } from "@/app/ui";
import AvisoDoFormulario from "@/app/bonus/aviso-do-formulario";
import { avisosDeCabimento, campoDoAviso } from "@/lib/bonus/arte-cabimento";
import { urlDaArte } from "@/lib/bonus/arte-tela";
import type { CampoDoCarrossel, ParteDoCarrossel } from "@/lib/bonus/carrossel-texto";
import type { AvisoDoSlide } from "@/lib/bonus/carrossel-textos";
import Campo from "./campo";

// O CARD DE UMA PARTE DO CARROSSEL (spec da Etapa 4, "Um card por slide"): a miniatura do slide, o
// "Só texto" e o "Baixar" à esquerda, e ao lado o editor daquele slide, que abre no "Editar" e grava
// só ele no "Salvar slide N". A legenda tem um card igual, sem miniatura.
//
// A RESPOSTA VOLTA COMO ESTADO DO CARD (useActionState), E NUNCA POR REDIRECT (achado 52): numa
// recusa a edição fica, e o motivo aparece junto do botão. Salvo, a miniatura troca pela versão que
// a action devolve, e só ela é pedida de novo. Os campos são controlados (campo.tsx), e ficam
// montados com o card fechado: fechar não apaga o que se digitou.
//
// "NÃO SALVO" compara o que está nos campos com o que foi gravado por último neste card: sair da
// página perde o que não foi salvo. O "não cabe" é a conta da arte sobre o que está nos campos agora
// (arte-cabimento.ts), junto do campo e embaixo da miniatura.
//
// A versão da miniatura e o "só texto" moram no pai (editor-do-carrossel.tsx): o "só texto" se grava
// por outra action, que devolve as versões, e o "Baixar todos" precisa das versões de todos.
export default function CardDaParte({
  acao,
  bonusId,
  carrosselId,
  palavra,
  total,
  parte,
  campos,
  valores,
  versao,
  aoNovaVersao,
  soTexto,
  aoMudarSoTexto,
  soTextoPendente,
}: {
  acao: (anterior: AvisoDoSlide | null, form: FormData) => Promise<AvisoDoSlide | null>;
  bonusId: string;
  carrosselId: string;
  palavra: string;
  total: number;
  parte: ParteDoCarrossel;
  campos: CampoDoCarrossel[];
  valores: Record<string, string>;
  /** A versão da miniatura; null na legenda, que não tem. */
  versao: string | null;
  aoNovaVersao: (versao: string) => void;
  soTexto: boolean;
  aoMudarSoTexto: (marcado: boolean) => void;
  soTextoPendente: boolean;
}) {
  const doCard = (v: Record<string, string>) => Object.fromEntries(campos.map((c) => [c.nome, v[c.nome] ?? ""]));
  const [atuais, setAtuais] = useState(() => doCard(valores));
  const [salvos, setSalvos] = useState(() => doCard(valores));
  const [aberto, setAberto] = useState(false);
  const [resposta, enviar, pendente] = useActionState(async (anterior: AvisoDoSlide | null, form: FormData) => {
    const r = await acao(anterior, form);
    if (r?.tom === "ok") {
      setSalvos(Object.fromEntries(campos.map((c) => [c.nome, String(form.get(c.nome) ?? "")])));
      if (r.versao) aoNovaVersao(r.versao);
    }
    return r;
  }, null);

  const numero = parte.tipo === "slide" ? parte.numero : null;
  const naoSalvo = campos.some((c) => atuais[c.nome] !== salvos[c.nome]);
  const campoDoNaoCabe = numero ? campoDoAviso(numero, total) : null;
  const naoCabe = useMemo(
    () => (numero && campoDoNaoCabe ? avisosDeCabimento(total, atuais, soTexto ? [numero] : [])[campoDoNaoCabe] : undefined),
    [numero, campoDoNaoCabe, total, atuais, soTexto]
  );

  return (
    <li className={`${card} p-4`}>
      <div className="flex flex-col gap-4 sm:flex-row">
        {numero !== null && versao !== null && (
          <div className="w-full shrink-0 space-y-2 sm:w-56">
            {/* eslint-disable-next-line @next/next/no-img-element -- a arte está atrás de sessão, e o
                otimizador de imagem do Next buscaria a URL sem o cookie: a miniatura voltaria 401. */}
            <img
              src={urlDaArte(bonusId, carrosselId, numero, versao)}
              alt={`Slide ${numero} de ${total}`}
              width={216}
              height={270}
              className="w-full rounded-lg border border-traco dark:border-traco-escuro"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                aria-label={`Slide ${numero}: só texto, sem o espaço da imagem`}
                checked={soTexto}
                disabled={soTextoPendente}
                onChange={(e) => aoMudarSoTexto(e.target.checked)}
              />
              Só texto
            </label>
            {naoCabe && <p className="text-xs font-medium text-fecha dark:text-fecha-escuro">{naoCabe}</p>}
            <a href={urlDaArte(bonusId, carrosselId, numero, versao, true)} download className={btnSecondary}>
              Baixar o slide {numero}
            </a>
          </div>
        )}
        <form
          action={enviar}
          onInput={(e) => {
            const dados = new FormData(e.currentTarget);
            setAtuais(Object.fromEntries(campos.map((c) => [c.nome, String(dados.get(c.nome) ?? "")])));
          }}
          className="min-w-0 flex-1 space-y-3"
        >
          <input type="hidden" name="id" value={carrosselId} />
          <input type="hidden" name="parte" value={numero !== null ? `slide_${numero}` : "legenda"} />
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">{numero !== null ? `Slide ${numero}` : "Legenda"}</h3>
            <div className="flex items-center gap-2">
              {naoSalvo && <span className={badgeWarn}>não salvo</span>}
              <button type="button" aria-expanded={aberto} onClick={() => setAberto(!aberto)} className={btnSecondary}>
                {aberto ? "Fechar" : "Editar"}
              </button>
            </div>
          </div>
          {!aberto && <p className={`${hint} whitespace-pre-line`}>{campos.map((c) => atuais[c.nome]).join("\n")}</p>}
          <div hidden={!aberto} className="space-y-3">
            {campos.map((c) => (
              <Campo
                key={c.nome}
                nome={c.nome}
                rotulo={c.rotulo}
                valorInicial={valores[c.nome] ?? ""}
                max={c.max}
                linhas={c.linhas}
                palavra={c.pedePalavra ? palavra : undefined}
                soAPalavra={c.soAPalavra}
                avisoDeCabimento={c.nome === campoDoNaoCabe ? naoCabe : undefined}
              />
            ))}
            {resposta && <AvisoDoFormulario key={resposta.em} aviso={resposta} />}
            <button type="submit" disabled={pendente} className={btnPrimary}>
              {numero !== null ? `Salvar slide ${numero}` : "Salvar legenda"}
            </button>
          </div>
        </form>
      </div>
    </li>
  );
}
```

Em `app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx b/app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx
index 124111d..2546bee 100644
--- a/app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx
+++ b/app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx
@@ -1,89 +1,190 @@
 "use client";
-import { useMemo, useState } from "react";
-import { avisosDeCabimento, campoDoAviso } from "@/lib/bonus/arte-cabimento";
-import type { AvisoDaArte } from "@/lib/bonus/arte-textos";
-import type { CampoDoCarrossel } from "@/lib/bonus/carrossel-texto";
-import type { AvisoDaRevisao } from "@/lib/bonus/carrossel-textos";
-import ArteDoCarrossel from "./arte-do-carrossel";
-import FormularioDaRevisao from "./formulario-da-revisao";
+import { useActionState, useRef, useState, useTransition } from "react";
+import { alertError, alertOk, btnPrimary, btnSecondary, card, hint } from "@/app/ui";
+import { urlDaArte } from "@/lib/bonus/arte-tela";
+import { textoDoBaixarTodos, type AvisoDaArte } from "@/lib/bonus/arte-textos";
+import { camposDaParte, type CampoDoCarrossel, type ParteDoCarrossel } from "@/lib/bonus/carrossel-texto";
+import type { AvisoDoSlide } from "@/lib/bonus/carrossel-textos";
+import CardDaParte from "./card-da-parte";
 
-// O EDITOR E A ARTE DO CARROSSEL NUM COMPONENTE SÓ (spec da Etapa 3, "A prévia e o não cabe").
+// O EDITOR DO CARROSSEL, SLIDE A SLIDE (spec da Etapa 4, "A página"): a conta do carrossel, um card
+// por slide (a miniatura e, ao lado, o editor dele: card-da-parte.tsx), o card da legenda, e o
+// "Baixar todos". Nada disso usa redirect nem `router.refresh`: a lição dos achados 52 e 54 é que
+// recriar a página apaga o que estava na tela.
 //
-// Ele guarda o que é dos dois: o que está nos campos agora (para o "não cabe" acompanhar a
-// digitação), o "só texto" de cada slide, a conta do cabeçalho e a hora da última "Revisão
-// salva.". Quando a revisão salva, a versão das miniaturas muda, e elas são pedidas de novo. Nada
-// disso usa redirect nem `router.refresh`: a lição dos achados 52 e 54 é que recriar a página
-// apaga o que estava na tela.
+// A CONTA NÃO SE TROCA AQUI: o carrossel é da conta em que nasceu (decisão do Eduardo em 02/10). A
+// página mostra qual é, avisa quando ela foi desconectada, e oferece "Fixar nesta conta" ao carrossel
+// de antes de a conta ser gravada.
+//
+// O "SÓ TEXTO" se grava na hora, pela action da arte, e a resposta traz as versões das miniaturas. A
+// escolha muda na tela antes da resposta, para a caixa responder ao clique; numa recusa, volta para a
+// última aceita (achado 67), porque a miniatura e o "Baixar" seguem o que está gravado. O formulário é
+// montado aqui e despachado numa transição, sem `<form action>` (medido no PR #5).
+//
+// As actions entram por propriedade, para o teste de tela usar falsas.
 export default function EditorDoCarrossel({
-  acaoDaRevisao,
+  acaoDoSlide,
   acaoDaArte,
+  acaoDaConta,
   bonusId,
   carrosselId,
   palavra,
   total,
   campos,
   valores,
-  contas,
-  contaInicial,
+  rotuloDaConta,
   avisoDaConta,
+  podeFixar,
   soTextoInicial,
-  versaoBase,
+  versoes: versoesIniciais,
+  pausaMs = 400,
 }: {
-  acaoDaRevisao: (anterior: AvisoDaRevisao | null, form: FormData) => Promise<AvisoDaRevisao | null>;
+  acaoDoSlide: (anterior: AvisoDoSlide | null, form: FormData) => Promise<AvisoDoSlide | null>;
   acaoDaArte: (anterior: AvisoDaArte | null, form: FormData) => Promise<AvisoDaArte | null>;
+  acaoDaConta: (anterior: AvisoDaArte | null, form: FormData) => Promise<AvisoDaArte | null>;
   bonusId: string;
   carrosselId: string;
   palavra: string;
   total: number;
   campos: CampoDoCarrossel[];
   valores: Record<string, string>;
-  contas: { id: string; rotulo: string }[];
-  contaInicial: string | null;
+  rotuloDaConta: string | null;
   avisoDaConta: string | null;
+  podeFixar: boolean;
   soTextoInicial: number[];
-  versaoBase: string;
+  versoes: string[];
+  pausaMs?: number;
 }) {
-  const [atuais, setAtuais] = useState(valores);
+  const [versoes, setVersoes] = useState(versoesIniciais);
   const [soTexto, setSoTexto] = useState(soTextoInicial);
-  const [conta, setConta] = useState(contaInicial);
-  const [revisaoEm, setRevisaoEm] = useState(0);
+  const aceito = useRef(soTextoInicial);
+  const [respostaDaArte, despacharArte, artePendente] = useActionState(
+    async (anterior: AvisoDaArte | null, form: FormData) => {
+      const r = await acaoDaArte(anterior, form);
+      if (r?.tom === "ok") {
+        aceito.current = form.getAll("so_texto").map(Number);
+        if (r.versoes) setVersoes(r.versoes);
+      } else if (r?.tom === "erro") {
+        setSoTexto(aceito.current);
+      }
+      return r;
+    },
+    null
+  );
+  const [, iniciar] = useTransition();
+  const [respostaDaConta, fixar, contaPendente] = useActionState(acaoDaConta, null);
+  const [baixando, setBaixando] = useState(false);
+  const fixada = respostaDaConta?.tom === "ok";
+  const slides = Array.from({ length: total }, (_, i) => i + 1);
+
+  const camposDe = (parte: ParteDoCarrossel) => {
+    const nomes = camposDaParte(total, parte);
+    return campos.filter((c) => nomes.includes(c.nome));
+  };
 
-  const porCampo = useMemo(() => avisosDeCabimento(total, atuais, soTexto), [total, atuais, soTexto]);
-  const porSlide = useMemo(() => {
-    const r: Record<number, string> = {};
-    for (let n = 1; n <= total; n++) {
-      const aviso = porCampo[campoDoAviso(n, total)];
-      if (aviso) r[n] = aviso;
+  function mudarSoTexto(numero: number, marcado: boolean) {
+    const novo = marcado ? [...soTexto, numero].sort((a, b) => a - b) : soTexto.filter((n) => n !== numero);
+    setSoTexto(novo);
+    const form = new FormData();
+    form.set("id", carrosselId);
+    for (const n of novo) form.append("so_texto", String(n));
+    iniciar(() => despacharArte(form));
+  }
+
+  async function baixarTodos() {
+    setBaixando(true);
+    for (const n of slides) {
+      const a = document.createElement("a");
+      a.href = urlDaArte(bonusId, carrosselId, n, versoes[n - 1], true);
+      a.setAttribute("download", "");
+      document.body.appendChild(a);
+      a.click();
+      a.remove();
+      if (n < total) await new Promise((pronto) => setTimeout(pronto, pausaMs));
     }
-    return r;
-  }, [porCampo, total]);
+    setBaixando(false);
+  }
 
   return (
-    <div className="space-y-6">
-      <ArteDoCarrossel
-        acao={acaoDaArte}
-        bonusId={bonusId}
-        carrosselId={carrosselId}
-        total={total}
-        contas={contas}
-        conta={conta}
-        aoMudarConta={setConta}
-        soTexto={soTexto}
-        aoMudarSoTexto={setSoTexto}
-        avisoDaConta={avisoDaConta}
-        avisos={porSlide}
-        versaoBase={`${versaoBase}-${revisaoEm}`}
-      />
-      <FormularioDaRevisao
-        acao={acaoDaRevisao}
-        carrosselId={carrosselId}
-        palavra={palavra}
-        campos={campos}
-        valores={valores}
-        avisosDeCabimento={porCampo}
-        aoEditar={setAtuais}
-        aoSalvar={setRevisaoEm}
-      />
-    </div>
+    <section className={`${card} space-y-4 p-6`}>
+      <h2 className="text-base font-semibold">Arte e texto dos slides</h2>
+      <div>
+        <p className="text-sm">
+          Conta do carrossel: <strong>{rotuloDaConta ?? "nenhuma conta conectada"}</strong>
+        </p>
+        {avisoDaConta && !fixada && <p className={hint}>{avisoDaConta}</p>}
+        {podeFixar && !fixada && (
+          <button
+            type="button"
+            disabled={contaPendente}
+            onClick={() => {
+              const form = new FormData();
+              form.set("id", carrosselId);
+              iniciar(() => fixar(form));
+            }}
+            className={`${btnSecondary} mt-2`}
+          >
+            Fixar nesta conta
+          </button>
+        )}
+        {respostaDaConta && (
+          <p role="status" className={`${respostaDaConta.tom === "ok" ? alertOk : alertError} mt-2`}>
+            {respostaDaConta.texto}
+          </p>
+        )}
+      </div>
+      <p className={hint}>
+        A chamada pede a palavra <strong>{palavra}</strong>. Ela vem do bônus e não se edita aqui.
+      </p>
+
+      <ul className="space-y-4">
+        {slides.map((n) => (
+          <CardDaParte
+            key={n}
+            acao={acaoDoSlide}
+            bonusId={bonusId}
+            carrosselId={carrosselId}
+            palavra={palavra}
+            total={total}
+            parte={{ tipo: "slide", numero: n }}
+            campos={camposDe({ tipo: "slide", numero: n })}
+            valores={valores}
+            versao={versoes[n - 1]}
+            aoNovaVersao={(v) => setVersoes((vs) => vs.map((x, i) => (i === n - 1 ? v : x)))}
+            soTexto={soTexto.includes(n)}
+            aoMudarSoTexto={(marcado) => mudarSoTexto(n, marcado)}
+            soTextoPendente={artePendente}
+          />
+        ))}
+        <CardDaParte
+          acao={acaoDoSlide}
+          bonusId={bonusId}
+          carrosselId={carrosselId}
+          palavra={palavra}
+          total={total}
+          parte={{ tipo: "legenda" }}
+          campos={camposDe({ tipo: "legenda" })}
+          valores={valores}
+          versao={null}
+          aoNovaVersao={() => {}}
+          soTexto={false}
+          aoMudarSoTexto={() => {}}
+          soTextoPendente={false}
+        />
+      </ul>
+
+      {respostaDaArte?.tom === "erro" && (
+        <p role="status" className={alertError}>
+          {respostaDaArte.texto}
+        </p>
+      )}
+
+      <div className="space-y-2">
+        <p className={hint}>{textoDoBaixarTodos(total)}</p>
+        <button type="button" onClick={baixarTodos} disabled={baixando} className={btnPrimary}>
+          Baixar todos
+        </button>
+      </div>
+    </section>
   );
 }
```

Em `app/bonus/[id]/carrossel/[cid]/page.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/[id]/carrossel/[cid]/page.tsx b/app/bonus/[id]/carrossel/[cid]/page.tsx
index fce3f63..aab8d89 100644
--- a/app/bonus/[id]/carrossel/[cid]/page.tsx
+++ b/app/bonus/[id]/carrossel/[cid]/page.tsx
@@ -2,12 +2,18 @@ import Link from "next/link";
 import { cookies } from "next/headers";
 import { notFound } from "next/navigation";
 import { alertError, alertOk, alertWarn, btnPrimary, card, hint, link, pageSubtitle, pageTitle, skeleton } from "@/app/ui";
-import { gerarCarrosselDeNovo, salvarArteDoCarrossel, salvarRevisaoDoCarrossel } from "@/app/bonus/carrossel-actions";
+import {
+  fixarContaDoCarrossel,
+  gerarCarrosselDeNovo,
+  salvarArteDoCarrossel,
+  salvarSlideDoCarrossel,
+} from "@/app/bonus/carrossel-actions";
 import { ACCOUNT_COOKIE } from "@/lib/account";
 import { avisoDaUrl } from "@/lib/avisos";
 import { resolverConta } from "@/lib/bonus/arte-conta";
 import { escolhasDaArte } from "@/lib/bonus/arte-escolhas";
-import { versaoDaArte } from "@/lib/bonus/arte-tela";
+import { slidesDoTexto } from "@/lib/bonus/arte-slides";
+import { cabecalhoParaVersao, versoesDosSlides } from "@/lib/bonus/arte-tela";
 import { TEXTO_ARTE_SEM_CONTA, rotuloDaConta, textoDaOrigemDaConta } from "@/lib/bonus/arte-textos";
 import type { LinhaDoCarrossel } from "@/lib/bonus/carrossel-linha";
 import { contasParaArte, lerCarrossel } from "@/lib/bonus/carrossel-repositorio";
@@ -125,10 +131,10 @@ async function situacaoDoBonus(bonusId: string): Promise<SituacaoNoLabs> {
 }
 
 /**
- * O CARROSSEL PRONTO: a arte e o editor, num componente só (editor-do-carrossel.tsx). A conta do
- * cabeçalho é a gravada no carrossel; sem ela, ou desconectada, a selecionada no Chat agora, e a
- * tela diz isso (achado 61). A versão das miniaturas leva TUDO o que muda a imagem: a data do
- * texto, as escolhas da arte, e o nome, o @ e a foto da conta (arte-tela.ts, `versaoDaArte`).
+ * O CARROSSEL PRONTO, SLIDE A SLIDE (editor-do-carrossel.tsx, spec da Etapa 4). A conta é a do
+ * carrossel (arte-conta.ts): a página mostra qual é, avisa quando ela saiu do Chat, e oferece "Fixar
+ * nesta conta" ao carrossel de antes de a conta ser gravada. Cada miniatura tem a sua versão, o resumo
+ * de tudo o que a rota desenha naquele slide (arte-tela.ts, `versoesDosSlides`).
  */
 async function Revisao({ carrossel }: { carrossel: LinhaDoCarrossel }) {
   const texto = textoDaLinhaDoCarrossel(carrossel);
@@ -137,30 +143,23 @@ async function Revisao({ carrossel }: { carrossel: LinhaDoCarrossel }) {
   const contas = await contasParaArte();
   const escolhas = escolhasDaArte(carrossel.arte, carrossel.total_slides);
   const { conta, origem } = resolverConta(contas, escolhas, (await cookies()).get(ACCOUNT_COOKIE)?.value);
-  const versaoBase = versaoDaArte([
-    (carrossel.revisado_em ?? carrossel.gerado_em)?.toISOString() ?? "",
-    JSON.stringify(carrossel.arte ?? {}),
-    conta?.ig_user_id ?? "",
-    conta?.name ?? "",
-    conta?.username ?? "",
-    conta?.profile_picture_url ?? "",
-  ]);
 
   return (
     <EditorDoCarrossel
-      acaoDaRevisao={salvarRevisaoDoCarrossel}
+      acaoDoSlide={salvarSlideDoCarrossel}
       acaoDaArte={salvarArteDoCarrossel}
+      acaoDaConta={fixarContaDoCarrossel}
       bonusId={carrossel.bonus_id}
       carrosselId={carrossel.id}
       palavra={carrossel.palavra}
       total={carrossel.total_slides}
       campos={camposDoFormulario(carrossel.total_slides)}
       valores={valoresPorCampo(texto)}
-      contas={contas.map((c) => ({ id: c.ig_user_id, rotulo: rotuloDaConta(c) }))}
-      contaInicial={conta?.ig_user_id ?? null}
+      rotuloDaConta={conta ? rotuloDaConta(conta) : null}
       avisoDaConta={conta ? textoDaOrigemDaConta(origem, conta.username ?? "") : TEXTO_ARTE_SEM_CONTA}
+      podeFixar={origem === "selecionada" && conta !== null}
       soTextoInicial={escolhas.soTexto}
-      versaoBase={versaoBase}
+      versoes={versoesDosSlides(slidesDoTexto(texto), escolhas.soTexto, cabecalhoParaVersao(conta))}
     />
   );
 }
```

- [ ] **Passo 4: sai o "Salvar revisão"**

Em `app/bonus/carrossel-actions.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/carrossel-actions.ts b/app/bonus/carrossel-actions.ts
index 6b89b9a..154eec7 100644
--- a/app/bonus/carrossel-actions.ts
+++ b/app/bonus/carrossel-actions.ts
@@ -31,17 +31,15 @@ import {
   fixarContaDoCarrossel as gravarContaFixada,
   lerCarrossel,
   salvarParteDoCarrossel,
-  salvarRevisaoDoCarrossel as gravarRevisao,
   salvarSoTextoDaArte,
 } from "@/lib/bonus/carrossel-repositorio";
 import { textoDaLinhaDoCarrossel } from "@/lib/bonus/carrossel-tela";
-import { camposDaParte, camposDoFormulario, lerParte, lerRevisaoDoCarrossel } from "@/lib/bonus/carrossel-texto";
+import { camposDaParte, lerParte } from "@/lib/bonus/carrossel-texto";
 import {
   TEXTO_CARROSSEL_NAO_ENCONTRADO,
   TEXTO_CARROSSEL_NAO_REVISAVEL,
   TEXTO_NAO_DA_PARA_GERAR_CARROSSEL_DE_NOVO,
   TEXTO_PARTE_INVALIDA,
-  TEXTO_REVISAO_SALVA,
   TEXTO_SO_BONUS_CRIADO,
   quadroDaSituacao,
   textoDaParteSalva,
@@ -49,7 +47,6 @@ import {
   textoDoTetoDoCarrossel,
   textoDosProblemasDoCarrossel,
   urlDoCarrosselComAviso,
-  type AvisoDaRevisao,
   type AvisoDoPedidoDeCarrossel,
   type AvisoDoSlide,
 } from "@/lib/bonus/carrossel-textos";
@@ -175,41 +172,16 @@ export async function gerarCarrosselDeNovo(form: FormData): Promise<void> {
   redirect(`/bonus/${linha.bonus_id}/carrossel/${novo}`);
 }
 
-/**
- * A RESPOSTA VOLTA COMO ESTADO DO FORMULÁRIO (useActionState), E NUNCA POR REDIRECT PARA A
- * PRÓPRIA PÁGINA (achado 52, medido em 01/10 num navegador de verdade): todo redirect de Server
- * Action recria a página no Next 16, e o que o operador tinha digitado voltava ao texto com que a
- * página abriu. Numa recusa, a edição sumia, e o clique seguinte gravava o texto velho. Só a
- * sessão e o carrossel inexistente saem por redirect, para outra página.
- */
-export async function salvarRevisaoDoCarrossel(
-  _anterior: AvisoDaRevisao | null,
-  form: FormData
-): Promise<AvisoDaRevisao | null> {
-  await exigirSessao();
-  const id = form.get("id");
-  if (!ehIdDeBonus(id)) redirect(urlDoBonusComAviso(null, { tom: "erro", texto: TEXTO_CARROSSEL_NAO_ENCONTRADO }));
-  const linha = await lerCarrossel(id);
-  if (!linha) redirect(urlDoBonusComAviso(null, { tom: "erro", texto: TEXTO_CARROSSEL_NAO_ENCONTRADO }));
-  const resposta = (tom: AvisoDaRevisao["tom"], texto: string): AvisoDaRevisao => ({ tom, texto, em: Date.now() });
-  const atual = textoDaLinhaDoCarrossel(linha);
-  if (linha.estado !== "pronto" || !atual) return resposta("erro", TEXTO_CARROSSEL_NAO_REVISAVEL);
-  const bruto: Record<string, unknown> = Object.fromEntries(
-    camposDoFormulario(linha.total_slides).map((c) => [c.nome, form.get(c.nome)])
-  );
-  const lido = lerRevisaoDoCarrossel(linha.total_slides, linha.palavra, atual.titulo, bruto);
-  if (!lido.ok) {
-    return resposta("erro", `Corrija antes de salvar. ${textoDosProblemasDoCarrossel(linha.total_slides, lido.problemas)}`);
-  }
-  const salvou = await gravarRevisao(id, lido.texto);
-  return salvou ? resposta("ok", TEXTO_REVISAO_SALVA) : resposta("erro", TEXTO_CARROSSEL_NAO_REVISAVEL);
-}
-
 /**
  * O "SALVAR SLIDE N" E O "SALVAR LEGENDA" (spec da Etapa 4): grava só a parte, juntada ao texto
  * salvo numa transação com a linha travada (carrossel-repositorio.ts), e recusa só pelos problemas
- * dela. A resposta volta como ESTADO do card (achado 52), com a versão nova da miniatura do slide
- * salvo: só ela é pedida de novo. Os campos que o formulário trouxer fora da parte são ignorados.
+ * dela. Os campos que o formulário trouxer fora da parte são ignorados.
+ *
+ * A RESPOSTA VOLTA COMO ESTADO DO CARD (useActionState), E NUNCA POR REDIRECT PARA A PRÓPRIA PÁGINA
+ * (achado 52, medido em 01/10 num navegador de verdade): todo redirect de Server Action recria a
+ * página no Next 16, e o que o operador tinha digitado voltava ao texto com que a página abriu. Ela
+ * leva a versão nova da miniatura do slide salvo, e só ela é pedida de novo. Só a sessão e o
+ * carrossel inexistente saem por redirect, para outra página.
  */
 export async function salvarSlideDoCarrossel(_anterior: AvisoDoSlide | null, form: FormData): Promise<AvisoDoSlide | null> {
   await exigirSessao();
@@ -241,10 +213,9 @@ export async function salvarSlideDoCarrossel(_anterior: AvisoDoSlide | null, for
 
 /**
  * O "SÓ TEXTO" DA ARTE. A resposta volta como ESTADO (useActionState), e nunca por redirect, pelo
- * mesmo motivo do salvar da revisão (achado 52): a seção da arte fica na página do editor, e recriar
- * a página apagaria o que se estiver editando. Só carrossel pronto guarda escolha. A conta não vem do
- * formulário (spec da Etapa 4): o carrossel é da conta em que nasceu. Gravar aqui completa o nome e
- * o @ da conta gravada na Etapa 3 sem eles.
+ * mesmo motivo do salvar do slide (achado 52), com as versões novas das miniaturas. Só carrossel
+ * pronto guarda escolha. A conta não vem do formulário (spec da Etapa 4): o carrossel é da conta em
+ * que nasceu. Gravar aqui completa o nome e o @ da conta gravada na Etapa 3 sem eles.
  */
 export async function salvarArteDoCarrossel(_anterior: AvisoDaArte | null, form: FormData): Promise<AvisoDaArte | null> {
   await exigirSessao();
@@ -252,13 +223,22 @@ export async function salvarArteDoCarrossel(_anterior: AvisoDaArte | null, form:
   if (!ehIdDeBonus(id)) redirect(urlDoBonusComAviso(null, { tom: "erro", texto: TEXTO_CARROSSEL_NAO_ENCONTRADO }));
   const linha = await lerCarrossel(id);
   if (!linha) redirect(urlDoBonusComAviso(null, { tom: "erro", texto: TEXTO_CARROSSEL_NAO_ENCONTRADO }));
-  const resposta = (tom: AvisoDaArte["tom"], texto: string): AvisoDaArte => ({ tom, texto, em: Date.now() });
-  if (linha.estado !== "pronto" || !textoDaLinhaDoCarrossel(linha)) return resposta("erro", TEXTO_ARTE_NAO_PRONTA);
+  const resposta = (tom: AvisoDaArte["tom"], texto: string, versoes?: string[]): AvisoDaArte => ({
+    tom,
+    texto,
+    em: Date.now(),
+    ...(versoes ? { versoes } : {}),
+  });
+  const texto = linha.estado === "pronto" ? textoDaLinhaDoCarrossel(linha) : null;
+  if (!texto) return resposta("erro", TEXTO_ARTE_NAO_PRONTA);
   const lido = lerSoTextoDoFormulario(form.getAll("so_texto"), linha.total_slides);
   if (!lido.ok) return resposta("erro", textoDaRecusaDaArte(lido.motivo));
-  const falta = nomeQueFalta(await contasParaArte(), escolhasDaArte(linha.arte, linha.total_slides));
-  const salvou = await salvarSoTextoDaArte(id, lido.soTexto, falta);
-  return salvou ? resposta("ok", TEXTO_ARTE_SALVA) : resposta("erro", TEXTO_ARTE_NAO_PRONTA);
+  const contas = await contasParaArte();
+  const escolhas = escolhasDaArte(linha.arte, linha.total_slides);
+  const salvou = await salvarSoTextoDaArte(id, lido.soTexto, nomeQueFalta(contas, escolhas));
+  if (!salvou) return resposta("erro", TEXTO_ARTE_NAO_PRONTA);
+  const { conta } = resolverConta(contas, escolhas, await contaDoCookie());
+  return resposta("ok", TEXTO_ARTE_SALVA, versoesDosSlides(slidesDoTexto(texto), lido.soTexto, cabecalhoParaVersao(conta)));
 }
 
 /**
```

Em `lib/bonus/carrossel-repositorio.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/carrossel-repositorio.ts b/lib/bonus/carrossel-repositorio.ts
index 636d7c5..a40d317 100644
--- a/lib/bonus/carrossel-repositorio.ts
+++ b/lib/bonus/carrossel-repositorio.ts
@@ -103,17 +103,6 @@ export async function listarCarrosseisDoBonus(bonusId: string): Promise<LinhaDoC
   )) as LinhaDoCarrossel[];
 }
 
-/** A revisão só vale para carrossel pronto. Devolve falso quando a linha não estava pronta. */
-export async function salvarRevisaoDoCarrossel(id: string, texto: TextoDoCarrossel): Promise<boolean> {
-  const linhas = (await sql().query(
-    `update carrosseis_gerados set revisado = $2::jsonb, revisado_em = now()
-      where id = $1 and estado = 'pronto'
-      returning id`,
-    [id, texto]
-  )) as { id: string }[];
-  return linhas.length > 0;
-}
-
 /**
  * SALVAR UMA PARTE (um slide, ou a legenda) NUMA TRANSAÇÃO, COM A LINHA TRAVADA (spec da Etapa 4):
  * lê o texto salvo (o revisado, ou o gerado) DEPOIS de travar a linha, junta a parte
```

Em `lib/bonus/carrossel-textos.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/carrossel-textos.ts b/lib/bonus/carrossel-textos.ts
index 353f42b..92b900c 100644
--- a/lib/bonus/carrossel-textos.ts
+++ b/lib/bonus/carrossel-textos.ts
@@ -7,13 +7,6 @@ import { PALAVRA_MAX, PALAVRA_MIN } from "./pedido";
 import type { SituacaoNoLabs } from "./publicado";
 import type { TomDoQuadro } from "./textos";
 
-/**
- * A resposta do "Salvar revisão", que volta como ESTADO do formulário e não por redirect (achado
- * 52: todo redirect de Server Action recria a página no Next 16, e a edição na tela sumia).
- * `em` muda a cada resposta, para o aviso aparecer de novo mesmo com a mesma mensagem.
- */
-export type AvisoDaRevisao = Aviso & { em: number };
-
 /** A recusa do "Gerar carrossel", que também volta como estado do formulário. */
 export type AvisoDoPedidoDeCarrossel = Aviso & { em: number };
 
@@ -56,7 +49,6 @@ export const TEXTO_CARROSSEL_NAO_ENCONTRADO = "Esse carrossel não existe, ou o
 export const TEXTO_NAO_DA_PARA_GERAR_CARROSSEL_DE_NOVO =
   "Só dá para gerar de novo um carrossel cuja geração falhou ou travou.";
 export const TEXTO_CARROSSEL_NAO_REVISAVEL = "Esse carrossel não está pronto para revisar.";
-export const TEXTO_REVISAO_SALVA = "Revisão salva.";
 export const TEXTO_TABELA_CARROSSEL_AUSENTE =
   "Falta a tabela dos carrosséis neste banco. Aplique a migração 014 (migrations/014-carrosseis-gerados.sql) e recarregue.";
 export const TEXTO_CARROSSEL_SEM_TEXTO = "O texto deste carrossel não passou na conferência de formato. Gere de novo.";
```

Em `lib/bonus/arte-textos.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/arte-textos.ts b/lib/bonus/arte-textos.ts
index c5878a5..5785a8e 100644
--- a/lib/bonus/arte-textos.ts
+++ b/lib/bonus/arte-textos.ts
@@ -22,7 +22,7 @@ export const TEXTO_ARTE_SEM_DESENHO =
  * por redirect: a seção da arte fica na página do editor, e recriar a página apagaria a edição
  * (achado 52). `em` muda a cada resposta, e é o que troca a versão das miniaturas depois de salvar.
  */
-export type AvisoDaArte = Aviso & { em: number };
+export type AvisoDaArte = Aviso & { em: number; versoes?: string[] };
 
 export const TEXTO_ARTE_SALVA = "Arte salva.";
 export const TEXTO_CONTA_FIXADA = "Conta fixada neste carrossel.";
```

Em `lib/bonus/carrossel-texto.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/carrossel-texto.ts b/lib/bonus/carrossel-texto.ts
index 57594ce..0ada357 100644
--- a/lib/bonus/carrossel-texto.ts
+++ b/lib/bonus/carrossel-texto.ts
@@ -186,8 +186,12 @@ function texto(v: unknown): string {
 export type ProblemaDoCampo = { campo: string; erro: string };
 
 /**
- * A revisão do operador. O número de slides não muda (vem do pedido), o título interno não se
- * edita, e a palavra vem da linha, nunca do formulário.
+ * A revisão do operador, o carrossel inteiro de uma vez. O número de slides não muda (vem do
+ * pedido), o título interno não se edita, e a palavra vem da linha, nunca do formulário.
+ *
+ * ⚠️ SEM USO NA TELA DESDE A ETAPA 4: o "Salvar revisão" saiu, e cada slide se salva sozinho
+ * (`juntarParte`, abaixo). Ela fica porque os testes dela cobrem a conferência dos campos
+ * (`conferirCampos`), que `juntarParte` usa; tirá-la era mudança fora da etapa.
  */
 export function lerRevisaoDoCarrossel(
   total: number,
```

Apague `app/bonus/[id]/carrossel/[cid]/arte-do-carrossel.tsx`:

```bash
git rm -q "app/bonus/[id]/carrossel/[cid]/arte-do-carrossel.tsx"
```

Apague `app/bonus/[id]/carrossel/[cid]/formulario-da-revisao.tsx`:

```bash
git rm -q "app/bonus/[id]/carrossel/[cid]/formulario-da-revisao.tsx"
```

Apague `testes-dom/bonus-arte-do-carrossel.dom.tsx`:

```bash
git rm -q "testes-dom/bonus-arte-do-carrossel.dom.tsx"
```

Apague `testes-dom/bonus-carrossel-formulario.dom.tsx`:

```bash
git rm -q "testes-dom/bonus-carrossel-formulario.dom.tsx"
```

- [ ] **Passo 5: ver passar**

```bash
npx tsc --noEmit
npm run lint
npm test
npm run test:dom
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-carrossel-processo.integracao.ts testes-integracao/bonus-carrossel-acoes.integracao.ts
```

Esperado: `tsc` e lint limpos; 95 arquivos e 2 774 casos puros; 18 arquivos e 117 casos de tela (saem 2 arquivos de tela e entra 1); a integração do carrossel, 27 passam. O `git status --short` mostra os quatro apagados com `D`.

- [ ] **Passo 6: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" "app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx" "app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx" "app/bonus/[id]/carrossel/[cid]/page.tsx" app/bonus/carrossel-actions.ts lib/bonus/carrossel-repositorio.ts lib/bonus/carrossel-textos.ts lib/bonus/arte-textos.ts lib/bonus/carrossel-texto.ts testes-dom/bonus-card-da-parte.dom.tsx testes-dom/bonus-editor-do-carrossel.dom.tsx tests/bonus-carrossel-paginas.test.ts tests/bonus-paginas.test.ts testes-integracao/bonus-carrossel-processo.integracao.ts testes-integracao/bonus-carrossel-acoes.integracao.ts
test "$(git branch --show-current)" = "pagina-do-carrossel"
git add "app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx" "app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx" "app/bonus/[id]/carrossel/[cid]/page.tsx" app/bonus/carrossel-actions.ts lib/bonus/carrossel-repositorio.ts lib/bonus/carrossel-textos.ts lib/bonus/arte-textos.ts lib/bonus/carrossel-texto.ts testes-dom/bonus-card-da-parte.dom.tsx testes-dom/bonus-editor-do-carrossel.dom.tsx tests/bonus-carrossel-paginas.test.ts tests/bonus-paginas.test.ts testes-integracao/bonus-carrossel-processo.integracao.ts testes-integracao/bonus-carrossel-acoes.integracao.ts
git status --short
git commit -m "feat(bonus): a página do carrossel, slide a slide, com um salvar por slide"
```

O `git rm` do Passo 4 já pôs as quatro remoções no índice; o `git status --short` mostra as quatro
com `D` antes do commit.

---

### FASE 4.9 — A instrução do carrossel: até 5 linhas de corpo

**Espera o texto do Labs.** A instrução do carrossel é cópia da do Labs, e o prefixo dela é
cacheado. O Labs escreve o texto na 48.6 dele e o manda ao Chat byte a byte ANTES de publicar
(decisão do Eduardo na sessão do Labs). Esta fase não começa sem esse texto, e nada em
`lib/bonus/instrucao-carrossel.ts` muda antes dele. Ela não bloqueia as fases 4.10 e 4.11 nem a
revisão; bloqueia o merge (spec, "Pré-condições do merge").

Quando o texto chegar, a fase é: o teste da instrução (`tests/bonus-carrossel-instrucao.test.ts`)
passa a cobrar a frase nova das 5 linhas (4 com fechamento) e a ausência de "6 linhas"; ver falhar;
trocar o trecho da linha 73 de `lib/bonus/instrucao-carrossel.ts` pelo texto do Labs, conferido byte
a byte contra o que ele mandou; ver passar; varrer e commitar com
`feat(bonus): a instrução do carrossel pede até 5 linhas de corpo, como o Labs`. Esta fase vai ao
auditor como adendo, com o texto e o hash.

---

### FASE 4.10 — O verify, o build e a integração inteira

- [ ] **Passo 1: o verify e a integração**

```bash
npm run verify
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npm run test:integracao
git diff --stat AGENTS.md
```

Esperado: lint e tipos limpos; 95 arquivos / 2 774 casos puros; 18 / 117 de tela; a varredura do dono "SEM VAZAMENTO"; o build com "MIGRAÇÃO PULADA" e `ƒ /bonus/[id]/carrossel/[cid]` e `ƒ /bonus/[id]/carrossel/[cid]/arte` na lista. A integração: `[rede-global] ALVO: banco de TESTE`, 37 arquivos, 315 passaram e 8 pularam. O `git diff --stat AGENTS.md` não imprime nada.

- [ ] **Passo 2: as provas de mutação**, com o script do Apêndice A, da raiz:

```bash
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" node "$SCRATCH/mutar-pagina.mjs"
git status --short
```

Esperado: 42 linhas com ✓ e nenhuma com ✗; o `git status` vazio (cada arquivo volta byte a byte).

---

### FASE 4.11 — A prova real, no preview, com o Eduardo

O preview usa o banco de produção: **cada gravação com o OK dele, pela caixa**.

- [ ] **Passo 1:** empurrar só a branch (`git push -u origin pagina-do-carrossel`, com o OK do
  Eduardo) e mandar o link do preview.
- [ ] **Passo 2:** a página em lista, com o editor ao lado de cada miniatura, no computador e no
  celular.
- [ ] **Passo 3:** editar e salvar um slide (com o OK): só a miniatura dele troca, e o resto fica.
- [ ] **Passo 4:** o "não salvo" num slide editado e não salvo.
- [ ] **Passo 5:** "Fixar nesta conta" num dos carrosséis sem conta (com o OK).
- [ ] **Passo 6:** as miniaturas com a foto em memória, comparadas com a velocidade da Etapa 3.
- [ ] **Passo 7:** um slide no limite do degrau, baixado, com a margem de baixo livre.

---

## Apêndice A — as provas de mutação

Cada mutação tira uma proteção, roda o teste dela e espera ver o caso certo cair; o arquivo volta
byte a byte. As de integração só rodam com `DATABASE_URL_TESTES`, e uma rodada que não imprime
"ALVO: banco de TESTE" conta como ✗.

```js
// Provas de mutação da Etapa 4 (a página do carrossel, slide a slide). Cada arquivo volta byte a byte.
// Uso, da raiz do repositório: DATABASE_URL_TESTES=<container> node mutar-pagina.mjs [filtro]
// As mutações INTEG rodam a suíte de integração, que sem DATABASE_URL_TESTES cai na DATABASE_URL, a
// da PRODUÇÃO (achado 68): sem a variável, o script recusa antes de mutar, e uma rodada INTEG que
// não imprime "ALVO: banco de TESTE" conta como ✗.
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

/** A barra invertida, escrita por código: escrita à mão, ela some ou vira caractere no caminho. */
const B = String.fromCharCode(92);

const PURA = (f) => `npx vitest run ${f}`;
const TELA = (f) => `npx vitest run --config vitest.dom.config.ts ${f}`;
const INTEG = (f) => `npx vitest run --config vitest.integracao.config.ts ${f}`;
const CARD = "app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx";
const EDITOR = "app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx";
const ROTA = "app/bonus/[id]/carrossel/[cid]/arte/route.tsx";
const PROCESSO = "testes-integracao/bonus-carrossel-processo.integracao.ts";
const SO_TEXTO = "`update carrosseis_gerados set arte = arte || $2::jsonb where id = $1 and estado = 'pronto' returning id`";

const MUTACOES = [
  // 4.1 a foto em memória
  { nome: "4.1: a memória não guarda a promessa", arq: "lib/bonus/arte-foto.ts",
    de: "      if (achada) return achada.promessa;\n", para: "",
    cmd: PURA("tests/bonus-arte-foto.test.ts"), caso: "as miniaturas que chegam juntas fazem uma busca só" },
  { nome: "4.1: a falha fica guardada como a foto", arq: "lib/bonus/arte-foto.ts",
    de: "          if (foto === null) guardada.vence = agora() + FALHA_GUARDADA_MS;\n", para: "",
    cmd: PURA("tests/bonus-arte-foto.test.ts"), caso: "a falha fica guardada só 30 segundos" },
  { nome: "4.1: as vencidas ficam na memória", arq: "lib/bonus/arte-foto.ts",
    de: "      for (const [chave, g] of guardadas) if (g.vence <= t) guardadas.delete(chave);\n", para: "",
    cmd: PURA("tests/bonus-arte-foto.test.ts"), caso: "as fotos vencidas saem da memória" },
  { nome: "4.1: a rota busca a foto sem a memória", arq: ROTA,
    de: "fotosDaInstancia.foto(conta.profile_picture_url)", para: "fotosDaInstancia.quantas() ? null : fotoDaConta(conta.profile_picture_url)",
    cmd: PURA("tests/bonus-arte-paginas.test.ts"), caso: "a foto da conta vem da memória da instância" },
  // 4.5 as partes e a versão de cada miniatura
  { nome: "4.5: o slide 1 leva também a chamada", arq: "lib/bonus/carrossel-texto.ts",
    de: '  if (n === 1) return ["gancho"];\n', para: '  if (n === 1) return ["gancho", "chamada"];\n',
    cmd: PURA("tests/bonus-carrossel-partes.test.ts"), caso: "os slides e a legenda cobrem os campos do formulário" },
  { nome: "4.5: a parte grava o que o formulário trouxer a mais", arq: "lib/bonus/carrossel-texto.ts",
    de: "  for (const c of campos) junto[c] = bruto[c];\n", para: "  for (const c of Object.keys(bruto)) junto[c] = bruto[c];\n",
    cmd: PURA("tests/bonus-carrossel-partes.test.ts"), caso: "troca só os campos da parte" },
  { nome: "4.5: o problema de outro campo impede o salvar", arq: "lib/bonus/carrossel-texto.ts",
    de: "  if (daParte.length) return { ok: false, problemas: daParte };\n", para: "  if (problemas.length) return { ok: false, problemas };\n",
    cmd: PURA("tests/bonus-carrossel-partes.test.ts"), caso: "um problema em OUTRO campo vira aviso" },
  { nome: "4.5: a versão do slide esquece o só texto", arq: "lib/bonus/arte-tela.ts",
    de: '      soTexto.includes(s.numero) ? "so_texto" : "com_espaco",\n', para: '      "com_espaco",\n',
    cmd: PURA("tests/bonus-arte-tela.test.ts"), caso: "o só texto do slide 2 muda só a versão do slide 2" },
  { nome: "4.5: a versão esquece a foto do cabeçalho", arq: "lib/bonus/arte-tela.ts",
    de: "      cabecalho.foto,\n", para: "",
    cmd: PURA("tests/bonus-arte-tela.test.ts"), caso: "a foto do cabeçalho muda a versão de todos" },
  // 4.6 a conta do carrossel
  { nome: "4.6: a conta desconectada com nome cai na logada", arq: "lib/bonus/arte-conta.ts",
    de: "    if (guardada.nome || guardada.arroba) {", para: "    if (false) {",
    cmd: PURA("tests/bonus-arte-conta.test.ts"), caso: "desconectada, com o nome guardado" },
  { nome: "4.6: o Gerar de novo usa a logada", arq: "app/bonus/carrossel-actions.ts",
    de: "    conta: contaParaGerarDeNovo(", para: "    conta: (await contaDoPedido()) ?? contaParaGerarDeNovo(",
    cmd: PURA("tests/bonus-carrossel-paginas.test.ts"), caso: "o Gerar de novo herda a conta do original" },
  { nome: "4.6: o Fixar troca a conta de quem já tem", arq: "lib/bonus/carrossel-repositorio.ts",
    de: "      where id = $1 and estado = 'pronto' and not (arte ? 'conta')\n", para: "      where id = $1 and estado = 'pronto'\n",
    cmd: INTEG(PROCESSO), caso: "Fixar nesta conta grava uma vez" },
  { nome: "4.6: o só texto troca a coluna inteira e apaga a conta", arq: "lib/bonus/carrossel-repositorio.ts",
    de: SO_TEXTO, para: SO_TEXTO.replace("arte = arte || $2::jsonb", "arte = $2::jsonb"),
    cmd: INTEG(PROCESSO), caso: "gravar o só texto mantém a conta" },
  { nome: "4.6: o só texto grava em carrossel que não está pronto", arq: "lib/bonus/carrossel-repositorio.ts",
    de: SO_TEXTO, para: SO_TEXTO.replace(" and estado = 'pronto'", ""),
    cmd: INTEG(PROCESSO), caso: "gravar o só texto mantém a conta, e só vale em carrossel pronto" },
  // 4.7 salvar um slide
  { nome: "4.7: salvar sem a trava da linha", arq: "lib/bonus/carrossel-repositorio.ts",
    de: "`select * from carrosseis_gerados where id = $1 for update`", para: "`select * from carrosseis_gerados where id = $1`",
    cmd: INTEG(PROCESSO), caso: "dois salvamentos ao mesmo tempo" },
  { nome: "4.7: salvar o slide troca a arte inteira", arq: "lib/bonus/carrossel-repositorio.ts",
    de: "revisado_em = now(), arte = arte || $3::jsonb where id = $1`", para: "revisado_em = now(), arte = $3::jsonb where id = $1`",
    cmd: INTEG(PROCESSO), caso: "completa o nome que falta da conta, na mesma gravação" },
  // 4.8 a tela, slide a slide
  { nome: "4.8: salvo, a miniatura não troca", arq: CARD,
    de: "      if (r.versao) aoNovaVersao(r.versao);\n", para: "",
    cmd: TELA("testes-dom/bonus-card-da-parte.dom.tsx"), caso: "salvo, a miniatura troca pela versão" },
  { nome: "4.8: o não salvo não some ao salvar", arq: CARD,
    de: '      setSalvos(Object.fromEntries(campos.map((c) => [c.nome, String(form.get(c.nome) ?? "")])));\n', para: "",
    cmd: TELA("testes-dom/bonus-card-da-parte.dom.tsx"), caso: "não salvo aparece ao editar, some ao salvar" },
  { nome: "4.8: fechar desmonta os campos", arq: CARD,
    de: '<div hidden={!aberto} className="space-y-3">', para: '<div hidden={!aberto} className="space-y-3" key={String(aberto)}>',
    cmd: TELA("testes-dom/bonus-card-da-parte.dom.tsx"), caso: "fechar não apaga o que se digitou" },
  { nome: "4.8: na recusa, o só texto não volta", arq: EDITOR,
    de: "        setSoTexto(aceito.current);\n", para: "",
    cmd: TELA("testes-dom/bonus-editor-do-carrossel.dom.tsx"), caso: "na recusa, o só texto volta para a última escolha aceita" },
  { nome: "4.8: a escolha aceita não é lembrada", arq: EDITOR,
    de: '        aceito.current = form.getAll("so_texto").map(Number);\n', para: "",
    cmd: TELA("testes-dom/bonus-editor-do-carrossel.dom.tsx"), caso: "na recusa, o só texto volta para a última escolha aceita" },
  { nome: "4.8: o só texto não troca as miniaturas", arq: EDITOR,
    de: "        if (r.versoes) setVersoes(r.versoes);\n", para: "",
    cmd: TELA("testes-dom/bonus-editor-do-carrossel.dom.tsx"), caso: "marcar só texto grava os slides marcados" },
  { nome: "4.8: salvar um slide troca todas as miniaturas", arq: EDITOR,
    de: "(i === n - 1 ? v : x)", para: "v",
    cmd: TELA("testes-dom/bonus-editor-do-carrossel.dom.tsx"), caso: "salvar o slide 2 troca só a miniatura 2" },
  { nome: "4.8: o Fixar não some depois de fixar", arq: EDITOR,
    de: '  const fixada = respostaDaConta?.tom === "ok";\n', para: "  const fixada = false;\n",
    cmd: TELA("testes-dom/bonus-editor-do-carrossel.dom.tsx"), caso: "Fixar nesta conta: aparece com o aviso" },
  // 4.2 a 4.4 a tabela, a conta exata do não cabe e os vetores
  { nome: "4.3: a altura com o espaço não desconta o respiro de 48", arq: "lib/bonus/arte-geometria.ts",
    de: "ALTURA_TEXTO_SEM_ILUSTRACAO - ALTURA_ILUSTRACAO - GAP_ILUSTRACAO;", para: "ALTURA_TEXTO_SEM_ILUSTRACAO - ALTURA_ILUSTRACAO;",
    cmd: PURA("tests/bonus-arte-vetores.test.ts"), caso: "labs-4-capa-120" },
  { nome: "4.3: a manchete sem o avanço de 77", arq: "lib/bonus/arte-geometria.ts",
    de: '  if (antes === "manchete") return Math.max(0, AVANCO_MANCHETE - alturaDaLinha(fonte));\n', para: "",
    cmd: PURA("tests/bonus-arte-vetores.test.ts"), caso: "linha-860-dentro-regular" },
  { nome: "4.3: a linha sem arredondar", arq: "lib/bonus/arte-geometria.ts",
    de: "  return Math.round(fonte * ENTRELINHA);\n", para: "  return fonte * ENTRELINHA;\n",
    cmd: PURA("tests/bonus-arte-medida.test.ts"), caso: "cada linha quebrada ocupa fonte × 1,32 arredondado" },
  { nome: "4.3: o negrito sem o espaçamento (achado 71)", arq: "lib/bonus/arte-medida.ts",
    de: "      if (espacamento) grafema += (espacamento / fonte) * fonte;\n", para: "",
    cmd: PURA("tests/bonus-arte-vetores.test.ts"), caso: "negrito-decide-o-degrau" },
  { nome: "4.3: o emoji vale zero", arq: "lib/bonus/arte-medida.ts",
    de: "        grafema = fonte;\n", para: "        grafema = 0;\n",
    cmd: PURA("tests/bonus-arte-medida.test.ts"), caso: "o emoji (e todo caractere sem desenho na fonte) vale 1em" },
  { nome: "4.3: o igual a 860 não cabe", arq: "lib/bonus/arte-medida.ts",
    de: "ocupado + largura > LARGURA_UTIL + (largura - semFim)", para: "ocupado + largura >= LARGURA_UTIL + (largura - semFim)",
    cmd: PURA("tests/bonus-arte-medida.test.ts"), caso: "a linha que soma exatamente a largura útil cabe" },
  { nome: "4.3: o espaço do fim conta na linha", arq: "lib/bonus/arte-medida.ts",
    de: "ocupado + largura > LARGURA_UTIL + (largura - semFim)", para: "ocupado + largura > LARGURA_UTIL",
    cmd: PURA("tests/bonus-arte-medida.test.ts"), caso: "o espaço do fim da última palavra da linha não conta" },
  { nome: "4.3: quebra antes do ponto de interrogação", arq: "lib/bonus/arte-medida.ts",
    de: '[..."!),./:;?]}"]', para: '[..."!),./:;]}"]',
    cmd: PURA("tests/bonus-arte-medida.test.ts"), caso: "não quebra antes de ! ) , . / : ; ? ] }" },
  { nome: "4.3: quebra depois do parêntese que abre", arq: "lib/bonus/arte-medida.ts",
    de: 'const ABREM = new Set([..."([{', para: 'const ABREM = new Set([..."[{',
    cmd: PURA("tests/bonus-arte-medida.test.ts"), caso: "não quebra depois de ( [ { " },
  { nome: "4.3: a aspa antes do parêntese quebra", arq: "lib/bonus/arte-medida.ts",
    de: "  if (ASPAS.has(antes) && ABREM.has(depois)) return false;\n", para: "",
    cmd: PURA("tests/bonus-arte-medida.test.ts"), caso: "não quebra entre a aspa e o parêntese que abre" },
  { nome: "4.3: a palavra que vaza não derruba o degrau", arq: "lib/bonus/arte-medida.ts",
    de: "    if (semFim > LARGURA_UTIL) vaza = true;\n", para: "",
    cmd: PURA("tests/bonus-arte-vetores.test.ts"), caso: "palavra-maior-que-a-linha" },
  { nome: "4.3: o gancho sem o degrau de 46", arq: "lib/bonus/arte-slides.ts",
    de: "  gancho: [86, 72, 56, 46],\n", para: "  gancho: [86, 72, 56],\n",
    cmd: PURA("tests/bonus-arte-slides.test.ts"), caso: "o gancho longo desce para o degrau de 46" },
  { nome: "4.3: a composição sem NFC", arq: "lib/bonus/arte-composicao.ts",
    de: 'texto.normalize("NFC").replace(QUEBRAS', para: "texto.replace(QUEBRAS",
    cmd: PURA("tests/bonus-arte-composicao.test.ts"), caso: "o acento em NFD vira NFC" },
  { nome: "4.3: a linha só de espaços não separa parágrafo", arq: "lib/bonus/arte-composicao.ts",
    de: '" ").trim();\n', para: '" ");\n',
    cmd: PURA("tests/bonus-arte-composicao.test.ts"), caso: "a linha só de espaços separa parágrafo" },
  { nome: "4.3: U+2028 e U+2029 ficam no texto", arq: "lib/bonus/arte-composicao.ts",
    de: `${B}u0085${B}u2028${B}u2029]/g;`, para: `${B}u0085]/g;`,
    cmd: PURA("tests/bonus-arte-composicao.test.ts"), caso: "as sete quebras obrigatórias" },
  { nome: "4.3: o desenho sem o espaçamento do negrito", arq: "lib/bonus/arte-desenho.tsx",
    de: "              letterSpacing: linha.espacamento,\n", para: "              letterSpacing: 0,\n",
    cmd: PURA("tests/bonus-arte-desenho.test.ts"), caso: "negrito-decide-o-degrau" },
  { nome: "4.2: a tabela de larguras editada à mão", arq: "lib/bonus/arte-larguras.ts",
    de: "  [0x20, [463, 463, ", para: "  [0x20, [464, 463, ",
    cmd: PURA("tests/bonus-arte-larguras.test.ts"), caso: "é a que o gerador tira dos .ttf de hoje" },
  { nome: "4.4: o arquivo dos vetores mexido", arq: "tests/vetores-da-arte.json",
    de: '"nome":"labs-3-capa-109","categoria":"labs"', para: '"nome":"labs-3-capa-109","categoria":"labz"',
    cmd: PURA("tests/bonus-arte-vetores.test.ts"), caso: "é o combinado com o Labs, pelo sha256" },
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
process.exit(ruins ? 1 : 0);
```
