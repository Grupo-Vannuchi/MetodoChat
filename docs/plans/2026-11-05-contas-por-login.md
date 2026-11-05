# As contas por login (entrega 2 de 2 dos logins) — Plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: `superpowers:subagent-driven-development`
> (recomendada) ou `superpowers:executing-plans`, fase por fase. Os passos usam caixa de
> seleção (`- [ ]`) para acompanhar.

**Objetivo:** o login comum vê só as contas que o administrador der a ele, e o administrador continua vendo
todas. O comum faz tudo nas contas dele, menos a Configuração, a página Logins e conectar contas. Os bônus e os
carrosséis continuam de todos, mas escolher a conta de um carrossel, gerar e subir imagens, publicar e apagar um
carrossel com conta só valem nas contas do login. A página Logins dá as contas e troca o papel, e a senha única
sai do código.

**Arquitetura:**
- uma migração nova (a 023) cria a `logins_contas` e troca o padrão do papel para comum; a partida passa a
  exigir a tabela;
- a regra de quem vê qual conta mora num lugar só, `lib/acesso.ts`, com a escolha pura em
  `lib/acesso-escolha.ts`. A `getSelectedAccount` passa por ela, e por isso os 29 pontos que já usam a conta
  escolhida ficam presos às contas do login sem mudar uma linha deles;
- o carrossel pergunta à mesma regra por `lib/bonus/carrossel-acesso.ts`, que lê só as quatro colunas do
  cabeçalho (achado 60);
- a Configuração, o convite, o `/api/oauth/login` e a página Logins conferem o administrador no servidor;
- um teste lê toda action e toda rota pelo analisador do TypeScript e recusa a que não passa pela regra.

**Stack:** a do projeto, no Next.js 16.4.3: Vitest (as três suítes), Testing Library no jsdom e o Postgres no
container para a integração.

**Spec:** `docs/specs/2026-11-05-contas-por-login.md` (commits `8a90596` e `bc0c0ad`, auditada pela
`metodochat-c4`, com os achados 179, 180 e 181 resolvidos em `bc0c0ad`; liberada e lida pelo Eduardo: "Li, pode
seguir"). Leia antes de começar: este plano não repete o porquê, só como construir.

**Ensaio do plano (05/11):** o código deste plano foi escrito e testado fase a fase numa cópia isolada
(`git worktree`, sem push, branch local `ensaio-contas`, saída de `bc0c0ad`, com `npm ci` próprio e `.env.local`
vazio), e todo bloco de código abaixo foi tirado do git dessa cópia por um gerador, sem cópia à mão. Os
commits do ensaio são a FASE 1 `93ef48e`, a 2 `cbf2bc8`, a 3 `3d54172`, a 4 `606b743`, a 5 `34d20d0`, a 6
`5d57ca4` e a 7 `c107a5e`, com as mensagens deste plano. Depois, uma segunda cópia limpa fez o caminho de quem
executa (os testes da fase, o RED, o código, o GREEN e o commit) e deu o mesmo patch-id do ensaio nas sete
fases: os números de RED e de GREEN de cada passo são os dela.

Os números do fim, no `c107a5e`:
- lint e `tsc` limpos em cada fase;
- 146 arquivos e 3 628 casos puros (142 e 3 575 na base) e 34 arquivos e 308 de tela (32 e 298 na base);
- `next build` (Turbopack) limpo, com o `node_modules` próprio na cópia: "MIGRAÇÃO PULADA", as rotas de sempre e o `AGENTS.md` intacto; a varredura "SEM VAZAMENTO em A nem em C, nas duas varreduras";
- a integração no container: 66 arquivos, 784 passaram e 8 pularam (62 arquivos, 680 passaram e 8 pularam na base);
- as 48 provas de mutação do Apêndice A derrubaram, cada uma, o caso esperado: "48 mutações, 0
  ruins; árvore no fim: limpa";
- o plano, aplicado do zero numa cópia limpa, dá os 77 arquivos iguais ao fim do ensaio (FASE 8,
  passo 5);
- a guarda do diff (FASE 8, passo 4) mostra só os 77 arquivos do mapa abaixo, com 3 901 linhas a mais e 351 a menos.

**O que o ensaio achou, já resolvido neste plano:**
1. **A `exigirConta` da spec não nasce.** Cada ponto devolve a recusa no formato que já devolve hoje (o `{ erro }`,
   o aviso do botão ou o redirect), com o `podeVerConta`. As funções da regra são `contasDoLogin`,
   `podeVerConta`, `soAsDoLogin` e `contaEscolhida` (FASE 3).
2. **Com o "sem login, nenhuma conta", 46 casos de 11 integrações de hoje caíram.** Eles mediam uma tela de conta
   sem sessão, e a `getSelectedAccount` antiga caía na primeira conta mesmo assim. Esses 11 arquivos passam a usar
   o login de teste, que é administrador e continua sem cookie de conta, de modo que o tombo para a primeira conta
   continua valendo. A troca é mecânica, e cada arquivo leva uma nota no import (FASE 3).
3. **O login de teste do harness nasce administrador, e diz isso.** Com o padrão novo da 023, ele nasceria comum
   e sem contas, e os casos de hoje mediriam um painel vazio (FASE 2). O harness ganha também um login comum de
   teste, que entra pela ação de verdade. O cookie da conta dele é sempre o que o `selectAccount` emitiu para o
   login de teste, e nunca escrito à mão (FASE 3).
4. **A Atividade inteira esconde do comum os eventos sem conta,** e não só a lista: o `postsComEventos` segue o
   `buildWhere`. Um webhook com erro grava o corpo inteiro sem conta (FASE 3).
5. **O carrossel não pode usar a `getSelectedAccountId`.** O guarda do achado 60 (`tests/bonus-arte-paginas.test.ts`)
   proíbe a arte e as actions do carrossel de tocar a linha inteira da conta, com o token. Nasce
   `contaDoMenuNoCarrossel`, que escolhe nas contas do login pelas quatro colunas do cabeçalho, e o guarda fica
   como está (FASE 4).
6. **O teste da varredura vai para a FASE 4,** porque só depois do carrossel toda action passa pela regra. O RED
   dele mostra, por nome, as 12 actions e as 4 rotas do carrossel (FASE 4).
7. **As páginas sem conta viram uma fase própria (a 5).** O comum lê a frase uma vez só: nos subtítulos, ele
   recebe nada. O "Reconectar" do Início fica só para o administrador (FASE 5).
8. **O formulário das contas não leva o token ao navegador.** A página Logins entrega a ele só o id, o @ e o nome
   de cada conta, e a integração confere o HTML (FASE 6).
9. **O `definirCategoria` com o id de outra conta não recusa: diz que salvou e não muda nada** (é assim desde
   antes). O caso prende o que vale, que o banco não muda (FASE 3).

**O que fica de fora, e por quê:**
- as mensagens de action e de rota que mandam conectar uma conta: o comum só chega a elas por um pedido feito
  fora da tela;
- o link para a Configuração no editor da automação (`app/automacoes/editor/painel.tsx`), na lista fechada da
  varredura das páginas;
- o `README.md`, que ainda manda pôr a `ADMIN_PASSWORD` no deploy: numa instalação do zero, o primeiro login
  precisaria nascer com o hash, e isso é outro trabalho;
- o comentário da 022 que cita a passagem: mudar uma migração aplicada mudaria a soma dela;
- apagar a `ADMIN_PASSWORD` da Vercel: depois do merge, com o OK do Eduardo.

## Restrições globais

- **Branch:** `contas-por-login`, saída da `main` em `af395e2`, sem upstream. Nunca commitar nem empurrar na
  `main`: ela não está protegida, e um push nela dispara o deploy na Vercel. Conferir
  `git branch --show-current` antes de cada commit.
- **`git add` com caminho explícito.** Nunca `-A` nem `.`.
- **Commit no estilo do Vinícius:** uma frase dizendo o efeito, sem prefixo, sem rodapé de IA. Autor: Eduardo
  Kobal <162614913+Eduardokobal@users.noreply.github.com>.
- **Antes de cada commit**, varrer os arquivos tocados atrás de caractere de controle e de fim de linha
  misturado.
- **O commit é um comando à parte**, depois de ler a saída dos testes.
- **Fim de linha:** os diffs deste plano estão em LF. Aplique com `git apply --ignore-whitespace`, ou numa cópia
  feita com `git -c core.autocrlf=false`.
- **Os arquivos desta entrega são os do mapa abaixo, e mais nenhum.** Nada do motor (`lib/engine.ts`), da fila e
  do dreno (`lib/queue-drain.ts`), do `lib/db.ts`, dos processos do carrossel (`lib/bonus/*-processo.ts`), da
  publicação (`lib/publicacao.ts`), do bucket, dos `scripts` nem do `package`.
- **Uma migração, a 023,** aplicada à mão na produção ANTES do push (FASE 9), com o OK do Eduardo. Entre a 023 e o
  merge, ninguém cria login (achado 180). O build do merge tem de dizer "Nada a aplicar: as 24 migrações".
- **Uma rodada de integração de cada vez**, sempre com `DATABASE_URL_TESTES` apontando para o container
  (`127.0.0.1:5434`). Toda rodada tem de imprimir `[rede-global] ALVO: banco de TESTE`. Nunca rode com a variável
  vazia: ela cai na `DATABASE_URL`, que é **produção**. Se o container estiver parado (a máquina reiniciou):
  `docker start metodochat-banco-de-teste`.
- **`next build` sem as variáveis de agente:** `env -u CLAUDECODE -u AI_AGENT ...`, e `git diff AGENTS.md` depois.
- **Escrita em produção só com o OK do Eduardo**, a hora mandada à auditoria antes, e o "pode" dela.
- **Ao fechar cada fase**, avisar o auditor (`metodochat-c4` em 05/11; o nome muda por sessão, então conferir no
  `ListAgents` e com o Eduardo) com o hash. Ele confere pelo patch-id contra o ensaio.
- **Toda linha citada (`arquivo:linha`) diz o SHA em que foi medida.**
- **Nenhuma arroba solta** em commit, PR ou mensagem do merge.

## Mapa dos arquivos

| arquivo | responsabilidade | fase |
|---|---|---|
| `lib/acesso-escolha.ts` (novo), `tests/acesso-escolha.test.ts` (novo) | a escolha pura da conta | 1 |
| `lib/logins-textos.ts`, `tests/logins-textos.test.ts` | as frases das contas por login e da página Logins | 1 e 6 |
| `migrations/023-logins-contas.sql` (novo) | a tabela, as chaves, o índice, o RLS e o padrão comum | 2 |
| `lib/esquema.ts` | a partida exige a `logins_contas` | 2 |
| `lib/logins-repositorio.ts` | o papel explícito, as contas de um login e a troca do papel; sai a passagem | 2 e 7 |
| `app/logins/actions.ts`, `app/logins/formularios.tsx`, `app/logins/page.tsx` | a caixinha, as contas e o papel | 2 e 6 |
| `testes-integracao/logins-contas-tabela.integracao.ts` (novo) | a tabela e o repositório, no container | 2 |
| `testes-integracao/logins-tabela.integracao.ts`, `esquema-de-partida.integracao.ts`, `entrada.integracao.ts`, `logins-acoes.integracao.ts` | o papel explícito, a 023 na partida, a entrada sem a passagem | 2, 6 e 7 |
| `testes-integracao/semear-requisicao.ts` | o login de teste administrador, o login comum de teste, sem a `ADMIN_PASSWORD` | 2, 3 e 7 |
| `lib/acesso.ts` (novo) | a regra de quem vê qual conta, num lugar só | 3 |
| `lib/account.ts` | a conta escolhida passa pela regra | 3 |
| `app/layout.tsx`, `app/account-actions.ts`, `app/account-switcher.tsx`, `app/app-shell.tsx` | o seletor só com as contas do login; o Conectar e a Configuração só do administrador | 3 e 5 |
| `app/api/oauth/login/route.ts` | conectar conta é do administrador | 3 |
| `app/setup/page.tsx`, `app/setup/actions.ts` | a Configuração só do administrador | 3 |
| `lib/event-query.ts`, `app/eventos/page.tsx` | a Atividade sem os eventos sem conta para o comum | 3 e 5 |
| `lib/exigir-sessao.ts` | só o comentário | 3 |
| `testes-dom/menu-do-login-comum.dom.tsx` (novo), `testes-integracao/contas-por-login.integracao.ts` (novo), `tests/event-query.test.ts`, `tests/layout-contas.test.ts` | o login comum | 3 |
| as 11 integrações de hoje (`acoes-que-falam`, `agendados`, `capa-do-post`, `chave-fora-da-pagina`, `desempenho`, `ficha-da-conversa`, `marcar-em-lote`, `nao-saiu`, `portas-de-publicar`, `publicar-fala`, `pulso-do-inicio`) | a tela de conta medida com o login de teste | 3 |
| `lib/bonus/carrossel-acesso.ts` (novo) | o carrossel pergunta à regra, pelas quatro colunas | 4 |
| `lib/bonus/arte-conta.ts`, `arte-rota.ts`, `imagem-consulta.ts`, `carrosseis-tela.ts` | a queda na conta do login | 4 |
| `app/bonus/carrossel-actions.ts`, `imagem-actions.ts`, `publicar-actions.ts`, `apagar-actions.ts`, `app/carrosseis/actions.ts`, `app/carrosseis/page.tsx`, `app/bonus/[id]/carrossel/[cid]/revisao.tsx` e as 4 rotas de arte e de imagem | o carrossel nas contas do login | 4 e 5 |
| `tests/acesso-nas-actions.test.ts` (novo), `testes-integracao/contas-no-carrossel.integracao.ts` (novo), `tests/bonus-arte-conta.test.ts` | a varredura e o carrossel | 4 |
| `app/page.tsx`, `app/automacoes/page.tsx`, `app/contatos/page.tsx`, `app/conversas/[id]/page.tsx`, `app/conversas/lista.tsx`, `app/conversas/layout.tsx`, `app/desempenho/page.tsx`, `app/publicar/page.tsx`, `app/publicar/novo/page.tsx` | o comum sem contas | 5 |
| `tests/paginas-sem-conta.test.ts` (novo), `testes-integracao/paginas-sem-conta.integracao.ts` (novo) | as páginas sem conta | 5 |
| `testes-dom/logins-formularios.dom.tsx` (novo) | os formulários da página Logins | 6 |
| `lib/entrada.ts`, `lib/auth.ts`, `tests/sem-senha-unica.test.ts` (novo) | a senha única sai | 7 |

---

### FASE 0 — Começar da branch certa

- [ ] **Passo 1: conferir a main e a branch**

```bash
git ls-remote origin refs/heads/main
git switch contas-por-login
git log --oneline -3
git config --get branch.contas-por-login.merge || echo "sem upstream"
```

Esperado: a `main` em `af395e2` (ou depois dele); a branch com o commit deste plano sobre `bc0c0ad` e `8a90596`,
que estão sobre `af395e2`; e "sem upstream".

- [ ] **Passo 2: o `node_modules` próprio**

```bash
npm ci
```

- [ ] **Passo 3: o `.env.local` VAZIO** (achado 140). Se já existir com conteúdo, pare e avise.

```bash
test ! -s .env.local && : > .env.local && wc -c .env.local
```

Esperado: `0 .env.local`.

- [ ] **Passo 4: a linha de base**

```bash
npm test
npm run test:dom
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npm run test:integracao
```

Esperado: 142 arquivos e 3 575 casos puros; 32 arquivos e 298 de tela; `[rede-global] ALVO: banco de TESTE`, 62
arquivos, 680 passaram e 8 pularam (medido em 05/11, das 14:03Z às 14:08Z, no `bc0c0ad`).

---

### FASE 1 — A escolha pura da conta e as frases

A escolha da conta de um login, sem banco, e as frases das recusas e do comum sem contas.

- [ ] **Passo 1: os testes, antes do código**

Crie `tests/acesso-escolha.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { escolherConta } from "@/lib/acesso-escolha";

// A CONTA ESCOLHIDA DE UM LOGIN (docs/specs/2026-11-05-contas-por-login.md, seção 2). A parte que escolhe é
// pura: entram as contas que o login pode ver e o cookie, e sai uma delas, ou nenhuma. Quem monta a lista é
// lib/acesso.ts; esta função só escolhe nela, e por isso o cookie de uma conta de fora nunca é a resposta.
const A = { ig_user_id: "111", username: "conta_a" };
const B = { ig_user_id: "222", username: "conta_b" };
const C = { ig_user_id: "333", username: "conta_c" };

describe("a conta escolhida", () => {
  it("é a do cookie, quando ela está entre as permitidas", () => {
    expect(escolherConta([A, B], "222")).toBe(B);
  });

  it("é a primeira permitida quando o cookie é de uma conta de fora, e nunca a de fora", () => {
    expect(escolherConta([A, B], "333")).toBe(A);
    expect(escolherConta([B], C.ig_user_id)).toBe(B);
  });

  it("é a primeira permitida sem cookie, com o cookie vazio ou nulo", () => {
    for (const doCookie of [undefined, "", null]) {
      expect(escolherConta([A, B], doCookie), String(doCookie)).toBe(A);
    }
  });

  it("não existe quando o login não tem conta nenhuma, nem com cookie", () => {
    expect(escolherConta([], undefined)).toBeNull();
    expect(escolherConta([], "111")).toBeNull();
  });

  it("segue a ordem da lista, e não a do cookie nem a do id", () => {
    expect(escolherConta([C, A, B], undefined)).toBe(C);
    expect(escolherConta([B, A], "999")).toBe(B);
  });
});
```

Em `tests/logins-textos.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/logins-textos.test.ts b/tests/logins-textos.test.ts
index 07d34cd..dc37f93 100644
--- a/tests/logins-textos.test.ts
+++ b/tests/logins-textos.test.ts
@@ -1,5 +1,13 @@
 import { describe, expect, it } from "vitest";
-import { AVISOS_DA_PAGINA, avisoDaPagina } from "@/lib/logins-textos";
+import {
+  AVISOS_DA_PAGINA,
+  avisoDaPagina,
+  FRASE_CARROSSEL_DE_OUTRA_CONTA,
+  FRASE_CONTAS_SALVAS,
+  FRASE_SEM_ACESSO_A_CONTA,
+  FRASE_SEM_CONTAS,
+  textoSemConta,
+} from "@/lib/logins-textos";
 
 // O AVISO DA PÁGINA LOGINS VEM DA URL (docs/specs/2026-11-04-logins.md, seção 4), e a lista é fechada: o
 // texto que veio na URL nunca aparece na tela.
@@ -20,4 +28,29 @@ describe("o aviso da página Logins", () => {
     expect(AVISOS_DA_PAGINA.proprio).toMatch(/próprio login/);
     expect(AVISOS_DA_PAGINA.ultimo_administrador).toMatch(/último administrador/);
   });
+
+  // AS CONTAS POR LOGIN (docs/specs/2026-11-05-contas-por-login.md, seção 4): o papel tem a trava do próprio, e
+  // a do último administrador é a mesma do desativar.
+  it("a troca do papel tem os avisos dela, e o próprio papel tem trava própria", () => {
+    expect(AVISOS_DA_PAGINA.papel_proprio).toBe("Você não pode mudar o seu próprio papel.");
+    expect(AVISOS_DA_PAGINA.virou_administrador).toBe("Login agora é administrador. Ele vê todas as contas.");
+    expect(AVISOS_DA_PAGINA.virou_comum).toBe("Login agora é comum. Ele vê só as contas marcadas.");
+  });
+});
+
+describe("as frases das contas por login", () => {
+  it("são as da spec, uma para cada recusa", () => {
+    expect(FRASE_SEM_ACESSO_A_CONTA).toBe("Você não tem acesso a essa conta.");
+    expect(FRASE_CARROSSEL_DE_OUTRA_CONTA).toBe("Esse carrossel é de uma conta que você não tem.");
+    expect(FRASE_SEM_CONTAS).toBe("Você ainda não tem contas. Peça ao administrador.");
+    expect(FRASE_CONTAS_SALVAS).toBe("Contas salvas. Valem já no próximo clique desse login.");
+  });
+
+  // A PÁGINA SEM CONTA (seção 3): o administrador continua vendo o texto de hoje, que manda conectar uma
+  // conta; o comum não conecta conta, e vê a frase que manda pedir ao administrador.
+  it("a página sem conta mostra o texto de hoje ao administrador e a frase do comum ao comum", () => {
+    const deHoje = "Conecte uma conta do Instagram primeiro.";
+    expect(textoSemConta(true, deHoje)).toBe(deHoje);
+    expect(textoSemConta(false, deHoje)).toBe(FRASE_SEM_CONTAS);
+  });
 });
```

- [ ] **Passo 2: ver os testes falharem**

```bash
env -u CLAUDECODE -u AI_AGENT npx vitest run tests/acesso-escolha.test.ts tests/logins-textos.test.ts
```

Esperado: puros: 2 arquivos falhando, com 3 casos caindo e 3 passando. Cai porque o módulo novo não existe (`Cannot find package '@/lib/acesso-escolha'`), e caem as três frases novas.

- [ ] **Passo 3: o código**

Crie `lib/acesso-escolha.ts`:

```ts
// A ESCOLHA DA CONTA DE UM LOGIN (docs/specs/2026-11-05-contas-por-login.md, seção 2). PURA: recebe as contas
// que o login pode ver e o cookie, e devolve uma delas. Quem monta a lista é lib/acesso.ts, o único lugar que
// sabe quem vê qual conta; esta função só escolhe nela.
//
// O COOKIE NUNCA ESCOLHE FORA DA LISTA. Antes desta entrega, a escolha (lib/account.ts, app/layout.tsx e
// lib/bonus/arte-conta.ts) procurava o cookie em TODAS as contas, e o cookie era a única coisa entre um login e
// a conta de outro. Agora o cookie só desempata dentro do que o login já pode ver.

/** A do cookie, se estiver entre as permitidas; senão, a primeira permitida; senão, nenhuma. */
export function escolherConta<T extends { ig_user_id: string }>(
  permitidas: T[],
  doCookie: string | null | undefined
): T | null {
  return permitidas.find((c) => c.ig_user_id === doCookie) ?? permitidas[0] ?? null;
}
```

Em `lib/logins-textos.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/logins-textos.ts b/lib/logins-textos.ts
index 47abd27..93daa12 100644
--- a/lib/logins-textos.ts
+++ b/lib/logins-textos.ts
@@ -11,13 +11,31 @@ export const FRASE_DA_SENHA_NOVA_DEFINIDA = "Senha nova definida. As sessões ab
 export const FRASE_DA_SENHA_TROCADA = "Senha trocada. As suas sessões em outros aparelhos caíram.";
 export const FRASE_DO_LOGIN_QUE_NAO_EXISTE = "Esse login não existe mais.";
 
-/** O aviso que volta à página Logins pela URL, depois de desativar ou reativar. A lista é fechada. */
+// AS CONTAS POR LOGIN (docs/specs/2026-11-05-contas-por-login.md). Uma frase para cada recusa, e a do comum
+// sem conta, que não manda conectar conta, porque o comum não conecta.
+export const FRASE_SEM_ACESSO_A_CONTA = "Você não tem acesso a essa conta.";
+export const FRASE_CARROSSEL_DE_OUTRA_CONTA = "Esse carrossel é de uma conta que você não tem.";
+export const FRASE_SEM_CONTAS = "Você ainda não tem contas. Peça ao administrador.";
+export const FRASE_CONTAS_SALVAS = "Contas salvas. Valem já no próximo clique desse login.";
+
+/**
+ * O TEXTO DA PÁGINA SEM CONTA (seção 3): o administrador vê o de hoje, que manda conectar uma conta; o comum
+ * vê a frase que manda pedir ao administrador.
+ */
+export function textoSemConta(administrador: boolean, deHoje: string): string {
+  return administrador ? deHoje : FRASE_SEM_CONTAS;
+}
+
+/** O aviso que volta à página Logins pela URL, depois de desativar, reativar ou trocar o papel. A lista é fechada. */
 export const AVISOS_DA_PAGINA = {
   desativado: "Login desativado. As sessões dele caíram.",
   reativado: "Login reativado. A pessoa já pode entrar de novo.",
   proprio: "Você não pode desativar o seu próprio login.",
   ultimo_administrador: "Esse é o último administrador ativo, e o painel não pode ficar sem nenhum.",
   nao_encontrado: "Esse login não existe, ou já estava desativado.",
+  papel_proprio: "Você não pode mudar o seu próprio papel.",
+  virou_administrador: "Login agora é administrador. Ele vê todas as contas.",
+  virou_comum: "Login agora é comum. Ele vê só as contas marcadas.",
 } as const;
 
 export type AvisoDaPagina = keyof typeof AVISOS_DA_PAGINA;
```

- [ ] **Passo 4: ver passar**

```bash
env -u CLAUDECODE -u AI_AGENT npx vitest run tests/acesso-escolha.test.ts tests/logins-textos.test.ts
npx eslint lib/acesso-escolha.ts lib/logins-textos.ts tests/acesso-escolha.test.ts tests/logins-textos.test.ts
npx tsc --noEmit
```

Esperado: puros: 2 arquivos passando, com 11 casos passando; o lint e o `tsc` limpos.

- [ ] **Passo 5: o commit**

A mensagem do commit, gravada em `$SCRATCH/msg-contas-f1.txt`:

```text
A regra pura da conta escolhida e as frases das contas por login
```

```bash
git add lib/acesso-escolha.ts lib/logins-textos.ts tests/acesso-escolha.test.ts tests/logins-textos.test.ts
git commit -F "$SCRATCH/msg-contas-f1.txt"
```

---

### FASE 2 — A tabela das contas por login e o repositório

A migração 023, a partida que exige a tabela, o papel explícito ao criar, as contas de um login e a troca do papel, com a trava do último administrador.

- [ ] **Passo 1: os testes, antes do código**

Em `testes-integracao/entrada.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/entrada.integracao.ts b/testes-integracao/entrada.integracao.ts
index cb5d89c..ee95a76 100644
--- a/testes-integracao/entrada.integracao.ts
+++ b/testes-integracao/entrada.integracao.ts
@@ -39,7 +39,12 @@ beforeEach(async () => {
 const SENHA = "uma senha de login comprida";
 
 async function novoLogin(email: string, senha: string | null = SENHA): Promise<string> {
-  const r = await repo.criarLogin({ email, nome: "Fulano", senhaHash: senha === null ? null : await logins.hashDaSenha(senha) });
+  const r = await repo.criarLogin({
+    email,
+    nome: "Fulano",
+    senhaHash: senha === null ? null : await logins.hashDaSenha(senha),
+    administrador: true,
+  });
   if ("erro" in r) throw new Error(r.erro);
   return r.id;
 }
```

Em `testes-integracao/esquema-de-partida.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/esquema-de-partida.integracao.ts b/testes-integracao/esquema-de-partida.integracao.ts
index 1052052..c7a03e0 100644
--- a/testes-integracao/esquema-de-partida.integracao.ts
+++ b/testes-integracao/esquema-de-partida.integracao.ts
@@ -118,6 +118,10 @@ it("uma TABELA de depois da base que falta deixa a conferência vermelha, com a
   expect(esquema.faltando(semLogins)).toEqual(["tabela ausente: logins (migrations/022-logins-e-sessoes.sql)"]);
   const semSessoes = presentes.filter((p) => p.table_name !== "sessoes");
   expect(esquema.faltando(semSessoes)).toEqual(["tabela ausente: sessoes (migrations/022-logins-e-sessoes.sql)"]);
+  // AS CONTAS POR LOGIN (a 023, docs/specs/2026-11-05-contas-por-login.md): sem a tabela, o login comum não
+  // acha conta nenhuma, e a partida tem de recusar em vez de servir um painel vazio.
+  const semContas = presentes.filter((p) => p.table_name !== "logins_contas");
+  expect(esquema.faltando(semContas)).toEqual(["tabela ausente: logins_contas (migrations/023-logins-contas.sql)"]);
 });
 
 it("uma COLUNA que falta deixa a conferência vermelha — e ela NÃO cria a coluna de volta", async () => {
```

Em `testes-integracao/logins-acoes.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/logins-acoes.integracao.ts b/testes-integracao/logins-acoes.integracao.ts
index c0e1f0e..fae0eb2 100644
--- a/testes-integracao/logins-acoes.integracao.ts
+++ b/testes-integracao/logins-acoes.integracao.ts
@@ -62,7 +62,12 @@ async function comSessao<T>(rota: string, corpo: () => Promise<T>): Promise<{ de
 }
 
 async function outroLogin(email: string): Promise<string> {
-  const r = await repo.criarLogin({ email, nome: "Outra pessoa", senhaHash: await logins.hashDaSenha("a senha da outra pessoa") });
+  const r = await repo.criarLogin({
+    email,
+    nome: "Outra pessoa",
+    senhaHash: await logins.hashDaSenha("a senha da outra pessoa"),
+    administrador: true,
+  });
   if ("erro" in r) throw new Error(r.erro);
   return r.id;
 }
```

Crie `testes-integracao/logins-contas-tabela.integracao.ts`:

```ts
// A TABELA DAS CONTAS POR LOGIN (a 023, docs/specs/2026-11-05-contas-por-login.md, seção 1) e o repositório
// dela (lib/logins-repositorio.ts), conferidos no banco de verdade (o container).
//
// A 023 é observável, como a 022: lib/esquema.ts a exige na partida (testes-integracao/
// esquema-de-partida.integracao.ts). O RLS e a falta de permissão de `anon` e `authenticated` são conferidos
// para toda tabela por testes-integracao/rls-nas-tabelas.integracao.ts e sem-permissao-publica.integracao.ts.
// Este arquivo confere as colunas, as chaves, o padrão novo do papel e as regras do repositório, com a peça
// mais delicada no fim: a trava do último administrador na troca do papel (o mesmo achado 168 do desativar).
import { beforeEach, describe, expect, it } from "vitest";
import { bancoDescartavel } from "./harness";

type ModuloRepositorio = typeof import("@/lib/logins-repositorio");

const banco = bancoDescartavel();

// Um hash com o formato certo, sem pagar o scrypt: o repositório não confere senha, só guarda.
const HASH = `scrypt$131072$8$1$${Buffer.alloc(16, 1).toString("base64")}$${Buffer.alloc(64, 2).toString("base64")}`;

let repo: ModuloRepositorio;

const q = (texto: string, params: unknown[] = []) => banco.db().sql().query(texto, params) as Promise<Record<string, unknown>[]>;

beforeEach(async () => {
  repo ??= await import("@/lib/logins-repositorio");
  await q(`delete from logins_contas`);
  await q(`delete from sessoes`);
  await q(`delete from logins`);
  await q(`delete from accounts where ig_user_id like 'contas-por-login-%'`);
});

async function novoLogin(email: string, administrador: boolean): Promise<string> {
  const r = await repo.criarLogin({ email, nome: email.split("@")[0], senhaHash: HASH, administrador });
  if ("erro" in r) throw new Error(r.erro);
  return r.id;
}

async function novaConta(sufixo: string): Promise<string> {
  const id = `contas-por-login-${sufixo}`;
  await q(`insert into accounts (ig_user_id, username, access_token) values ($1, $2, 'token-de-teste')`, [id, sufixo]);
  return id;
}

const ligacoesDo = async (loginId: string) =>
  (await q(`select account_id from logins_contas where login_id = $1 order by account_id`, [loginId])).map((l) => l.account_id);

describe("a tabela logins_contas", () => {
  it("nasce da 023 com as colunas, a chave primária, o índice da conta e o RLS ligado", async () => {
    const colunas = await q(
      `select column_name, data_type, is_nullable from information_schema.columns
        where table_schema = current_schema() and table_name = 'logins_contas' order by ordinal_position`
    );
    expect(colunas).toEqual([
      { column_name: "login_id", data_type: "uuid", is_nullable: "NO" },
      { column_name: "account_id", data_type: "text", is_nullable: "NO" },
      { column_name: "criado_em", data_type: "timestamp with time zone", is_nullable: "NO" },
    ]);
    const [pk] = await q(
      `select pg_get_constraintdef(c.oid) as def from pg_constraint c
        join pg_class t on t.oid = c.conrelid join pg_namespace n on n.oid = t.relnamespace
        where n.nspname = current_schema() and t.relname = 'logins_contas' and c.conname = 'logins_contas_pkey'`
    );
    expect(pk.def).toBe("PRIMARY KEY (login_id, account_id)");
    const indices = await q(
      `select indexname from pg_indexes where schemaname = current_schema() and tablename = 'logins_contas' order by indexname`
    );
    expect(indices.map((i) => i.indexname)).toEqual(["logins_contas_account_id_idx", "logins_contas_pkey"]);
    const [rls] = await q(
      `select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = current_schema() and c.relname = 'logins_contas'`
    );
    expect(rls.relrowsecurity).toBe(true);
  });

  it("as duas chaves estrangeiras apagam a ligação junto com o login e com a conta", async () => {
    const chaves = await q(
      `select c.conname, pg_get_constraintdef(c.oid) as def from pg_constraint c
        join pg_class t on t.oid = c.conrelid join pg_namespace n on n.oid = t.relnamespace
        where n.nspname = current_schema() and t.relname = 'logins_contas' and c.contype = 'f' order by c.conname`
    );
    expect(chaves).toEqual([
      { conname: "logins_contas_account_id_fkey", def: "FOREIGN KEY (account_id) REFERENCES accounts(ig_user_id) ON DELETE CASCADE" },
      { conname: "logins_contas_login_id_fkey", def: "FOREIGN KEY (login_id) REFERENCES logins(id) ON DELETE CASCADE" },
    ]);
    const login = await novoLogin("cascata@exemplo.invalid", false);
    const a = await novaConta("a");
    const b = await novaConta("b");
    expect(await repo.definirContasDoLogin(login, [a, b])).toBe("ok");
    await q(`delete from accounts where ig_user_id = $1`, [a]);
    expect(await ligacoesDo(login)).toEqual([b]);
    await q(`delete from logins where id = $1`, [login]);
    expect(Number((await q(`select count(*)::int as n from logins_contas`))[0].n)).toBe(0);
  });

  it("o login criado sem dizer o papel nasce comum (o padrão novo da 023)", async () => {
    await q(`insert into logins (email, nome, senha_hash) values ('sem-papel@exemplo.invalid', 'Sem papel', $1)`, [HASH]);
    const [linha] = await q(`select administrador from logins where email = 'sem-papel@exemplo.invalid'`);
    expect(linha.administrador).toBe(false);
  });
});

describe("o repositório das contas por login", () => {
  it("criar grava o papel que veio, e nunca o padrão", async () => {
    const adm = await novoLogin("adm@exemplo.invalid", true);
    const comum = await novoLogin("comum@exemplo.invalid", false);
    const linhas = await q(`select id, administrador from logins order by email`);
    expect(linhas).toEqual([
      { id: adm, administrador: true },
      { id: comum, administrador: false },
    ]);
  });

  it("salvar as contas troca o conjunto inteiro, e as contas voltam na ordem do id", async () => {
    const comum = await novoLogin("comum@exemplo.invalid", false);
    const a = await novaConta("a");
    const b = await novaConta("b");
    const c = await novaConta("c");
    expect(await repo.definirContasDoLogin(comum, [b, a])).toBe("ok");
    expect(await repo.idsDasContasDoLogin(comum)).toEqual([a, b]);
    expect(await repo.definirContasDoLogin(comum, [c])).toBe("ok");
    expect(await repo.idsDasContasDoLogin(comum)).toEqual([c]);
    expect(await repo.definirContasDoLogin(comum, [])).toBe("ok");
    expect(await repo.idsDasContasDoLogin(comum)).toEqual([]);
    // A MESMA CONTA DUAS VEZES vira uma ligação só, e não um erro de chave repetida.
    expect(await repo.definirContasDoLogin(comum, [a, a])).toBe("ok");
    expect(await repo.idsDasContasDoLogin(comum)).toEqual([a]);
  });

  it("salvar as contas recusa a conta que não existe, sem mudar nada", async () => {
    const comum = await novoLogin("comum@exemplo.invalid", false);
    const a = await novaConta("a");
    expect(await repo.definirContasDoLogin(comum, [a])).toBe("ok");
    expect(await repo.definirContasDoLogin(comum, [a, "contas-por-login-que-nao-existe"])).toBe("conta_inexistente");
    expect(await repo.idsDasContasDoLogin(comum)).toEqual([a]);
  });

  it("salvar as contas recusa o administrador, o login desativado e o que não existe", async () => {
    const adm = await novoLogin("adm@exemplo.invalid", true);
    const comum = await novoLogin("comum@exemplo.invalid", false);
    const a = await novaConta("a");
    expect(await repo.definirContasDoLogin(adm, [a])).toBe("administrador");
    expect(await ligacoesDo(adm)).toEqual([]);
    await q(`update logins set desativado_em = now() where id = $1`, [comum]);
    expect(await repo.definirContasDoLogin(comum, [a])).toBe("nao_encontrado");
    expect(await repo.definirContasDoLogin("00000000-0000-4000-8000-000000000000", [a])).toBe("nao_encontrado");
    expect(await repo.definirContasDoLogin("isto-nao-e-um-uuid", [a])).toBe("nao_encontrado");
  });

  it("trocar o papel recusa o próprio e o login que não existe", async () => {
    const adm = await novoLogin("adm@exemplo.invalid", true);
    expect(await repo.definirPapelDoLogin(adm, false, adm)).toBe("proprio");
    expect(await repo.definirPapelDoLogin("00000000-0000-4000-8000-000000000000", true, adm)).toBe("nao_encontrado");
    expect(await repo.definirPapelDoLogin("isto-nao-e-um-uuid", true, adm)).toBe("nao_encontrado");
  });

  it("trocar o papel: o comum vira administrador, e o administrador vira comum, menos o último", async () => {
    const a = await novoLogin("a@exemplo.invalid", true);
    const b = await novoLogin("b@exemplo.invalid", false);
    expect(await repo.definirPapelDoLogin(b, true, a)).toBe("ok");
    expect(await repo.definirPapelDoLogin(b, false, a)).toBe("ok");
    // B voltou a comum, e A é o último administrador ativo. O pedido sai em nome de B só para passar da trava do
    // próprio: o repositório não confere quem pede, e a trava do último tem de segurar sozinha.
    expect(await repo.definirPapelDoLogin(a, false, b)).toBe("ultimo_administrador");
    const [linha] = await q(`select administrador from logins where id = $1`, [a]);
    expect(linha.administrador).toBe(true);
  });

  it("virar comum mantém as ligações que o login já tinha", async () => {
    const adm = await novoLogin("adm@exemplo.invalid", true);
    const comum = await novoLogin("comum@exemplo.invalid", false);
    const a = await novaConta("a");
    expect(await repo.definirContasDoLogin(comum, [a])).toBe("ok");
    expect(await repo.definirPapelDoLogin(comum, true, adm)).toBe("ok");
    expect(await repo.definirPapelDoLogin(comum, false, adm)).toBe("ok");
    expect(await repo.idsDasContasDoLogin(comum)).toEqual([a]);
  });

  it("duas trocas de papel ao mesmo tempo deixam 1 administrador ativo, e não 0 (achado 168)", async () => {
    const a = await novoLogin("a@exemplo.invalid", true);
    const b = await novoLogin("b@exemplo.invalid", true);
    // O ACERTO DO TEMPO É FEITO PELO BANCO, como no teste do desativar: uma transação de fora segura as linhas dos
    // administradores, as duas trocas saem enquanto ela segura, e só então ela solta. Com o `for update`, a
    // segunda conta de novo depois da primeira; sem ele, as duas contam 2, e cada uma rebaixa a outra.
    let juntas: Promise<string[]> | undefined;
    await banco
      .db()
      .sql()
      .begin(async (tx) => {
        await tx.query(`select id from logins where administrador and desativado_em is null for update`);
        juntas = Promise.all([repo.definirPapelDoLogin(b, false, a), repo.definirPapelDoLogin(a, false, b)]);
        await new Promise((r) => setTimeout(r, 400));
      });
    const resultados = await juntas!;
    expect([...resultados].sort()).toEqual(["ok", "ultimo_administrador"]);
    const [n] = await q(`select count(*)::int as n from logins where administrador and desativado_em is null`);
    expect(Number(n.n)).toBe(1);
  });
});
```

Em `testes-integracao/logins-tabela.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/logins-tabela.integracao.ts b/testes-integracao/logins-tabela.integracao.ts
index 9f6d648..241ce8b 100644
--- a/testes-integracao/logins-tabela.integracao.ts
+++ b/testes-integracao/logins-tabela.integracao.ts
@@ -31,8 +31,9 @@ beforeEach(async () => {
 
 const q = (texto: string, params: unknown[] = []) => banco.db().sql().query(texto, params) as Promise<Record<string, unknown>[]>;
 
+// DESDE AS CONTAS POR LOGIN (a 023) o papel vai sempre explícito: os casos deste arquivo são de administradores.
 async function novoLogin(email: string, senhaHash: string | null = HASH): Promise<string> {
-  const r = await repo.criarLogin({ email, nome: email.split("@")[0], senhaHash });
+  const r = await repo.criarLogin({ email, nome: email.split("@")[0], senhaHash, administrador: true });
   if ("erro" in r) throw new Error(r.erro);
   return r.id;
 }
@@ -71,8 +72,10 @@ describe("as tabelas logins e sessoes", () => {
     await expect(inserir("fulano@exemplo.invalid", "Fulano", "senha-em-claro")).rejects.toThrow(/logins_senha_hash_check/);
     await inserir("fulano@exemplo.invalid", "Fulano", null);
     await expect(inserir("fulano@exemplo.invalid", "Outro", HASH)).rejects.toThrow(/logins_email_key/);
+    // O PADRÃO DO PAPEL É O DA 023: um login criado sem dizer o papel nasce comum
+    // (docs/specs/2026-11-05-contas-por-login.md, seção 1). Na 022 ele nascia administrador.
     const [linha] = await q(`select administrador from logins where email = 'fulano@exemplo.invalid'`);
-    expect(linha.administrador).toBe(true);
+    expect(linha.administrador).toBe(false);
   });
 
   it("recusa o hash de sessão fora do formato, e apagar o login apaga as sessões", async () => {
@@ -89,9 +92,9 @@ describe("as tabelas logins e sessoes", () => {
 
 describe("o repositório dos logins", () => {
   it("criar devolve o id, e o e-mail repetido volta como erro, e não como exceção", async () => {
-    const r = await repo.criarLogin({ email: "a@exemplo.invalid", nome: "A", senhaHash: HASH });
+    const r = await repo.criarLogin({ email: "a@exemplo.invalid", nome: "A", senhaHash: HASH, administrador: true });
     expect("id" in r).toBe(true);
-    expect(await repo.criarLogin({ email: "a@exemplo.invalid", nome: "Outra A", senhaHash: HASH })).toEqual({
+    expect(await repo.criarLogin({ email: "a@exemplo.invalid", nome: "Outra A", senhaHash: HASH, administrador: false })).toEqual({
       erro: "email_repetido",
     });
   });
```

Em `testes-integracao/semear-requisicao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/semear-requisicao.ts b/testes-integracao/semear-requisicao.ts
index eab021a..37822e6 100644
--- a/testes-integracao/semear-requisicao.ts
+++ b/testes-integracao/semear-requisicao.ts
@@ -523,7 +523,15 @@ async function entrarDeVerdade(): Promise<string> {
   const { sql } = await import("@/lib/db");
   const [existe] = (await sql().query(`select id from logins where email = $1`, [EMAIL_DE_TESTE])) as unknown[];
   if (!existe) {
-    const r = await criarLogin({ email: EMAIL_DE_TESTE, nome: "Login de teste", senhaHash: await hashDaSenha(SENHA_DE_TESTE) });
+    // O LOGIN DE TESTE É ADMINISTRADOR, e diz isso: desde a 023 o padrão é comum
+    // (docs/specs/2026-11-05-contas-por-login.md), e um login de teste comum, sem contas, faria os casos de
+    // hoje medirem um painel vazio.
+    const r = await criarLogin({
+      email: EMAIL_DE_TESTE,
+      nome: "Login de teste",
+      senhaHash: await hashDaSenha(SENHA_DE_TESTE),
+      administrador: true,
+    });
     if ("erro" in r) throw new Error(`O LOGIN DE TESTE NÃO NASCEU: ${r.erro}`);
   }
   const { login } = await import("@/app/entrar/actions");
```

- [ ] **Passo 2: ver os testes falharem**

```bash
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/entrada.integracao.ts testes-integracao/esquema-de-partida.integracao.ts testes-integracao/logins-acoes.integracao.ts testes-integracao/logins-contas-tabela.integracao.ts testes-integracao/logins-tabela.integracao.ts
```

Esperado: integração: 3 arquivos falhando e 2 passando, com 13 casos caindo e 40 passando. Cai porque a tabela não existe, o `criarLogin` ainda não grava o papel, e o padrão ainda é administrador.

- [ ] **Passo 3: o código**

Em `app/logins/actions.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/logins/actions.ts b/app/logins/actions.ts
index f926b60..1ebeff4 100644
--- a/app/logins/actions.ts
+++ b/app/logins/actions.ts
@@ -31,7 +31,9 @@ export async function criarLoginAction(
   if (!nome) return { erro: FRASE_DO_NOME };
   if (!email) return { erro: FRASE_DO_EMAIL };
   if (!senhaValida(senha)) return { erro: FRASE_DA_SENHA };
-  const r = await criarLogin({ email, nome, senhaHash: await hashDaSenha(senha) });
+  // O PAPEL VAI EXPLÍCITO (a 023 trocou o padrão para comum). Até a caixinha "Administrador" entrar na página,
+  // todo login criado aqui é administrador, como a página diz.
+  const r = await criarLogin({ email, nome, senhaHash: await hashDaSenha(senha), administrador: true });
   if ("erro" in r) return { erro: FRASE_DO_EMAIL_REPETIDO };
   revalidatePath("/logins");
   return { ok: `Login de ${nome} criado. Passe a senha inicial a ${nome}.` };
```

Em `lib/esquema.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/esquema.ts b/lib/esquema.ts
index 3250a1b..7f238ee 100644
--- a/lib/esquema.ts
+++ b/lib/esquema.ts
@@ -302,10 +302,13 @@ const MARCA_DAGUA = {
   // AS TABELAS QUE NASCEM DEPOIS DA BASE E QUE A PARTIDA EXIGE. A primeira é a dos logins (a 022,
   // docs/specs/2026-11-04-logins.md): ao contrário das tabelas de feature de `naoObservaveis`, sem
   // `logins` e `sessoes` ninguém entra no painel, e servir sem elas seria servir uma tela de entrar que
-  // estoura. Decidido com o Eduardo em 04/11/2026.
+  // estoura. Decidido com o Eduardo em 04/11/2026. A `logins_contas` (a 023,
+  // docs/specs/2026-11-05-contas-por-login.md) entra pelo mesmo motivo: sem ela o login comum não acha
+  // conta nenhuma.
   tabelasDepois: [
     { tabela: "logins", de: "022-logins-e-sessoes.sql" },
     { tabela: "sessoes", de: "022-logins-e-sessoes.sql" },
+    { tabela: "logins_contas", de: "023-logins-contas.sql" },
   ],
   // A migração que cria as oito tabelas de `tabelas`, acima.
   base: "000-esquema-base.sql",
```

Em `lib/logins-repositorio.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/logins-repositorio.ts b/lib/logins-repositorio.ts
index 6c8082b..28b885f 100644
--- a/lib/logins-repositorio.ts
+++ b/lib/logins-repositorio.ts
@@ -30,16 +30,20 @@ export type LoginDaSessao = {
 // O id chega de um formulário, e um valor torto não pode virar erro de banco.
 const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 
-/** Cria um login. O e-mail e o nome chegam já conferidos por lib/logins.ts. */
+/**
+ * Cria um login. O e-mail e o nome chegam já conferidos por lib/logins.ts. O PAPEL VAI SEMPRE EXPLÍCITO
+ * (docs/specs/2026-11-05-contas-por-login.md, seção 4): o padrão da 023 é comum, e é só a rede de baixo.
+ */
 export async function criarLogin(dados: {
   email: string;
   nome: string;
   senhaHash: string | null;
+  administrador: boolean;
 }): Promise<{ id: string } | { erro: "email_repetido" }> {
   try {
     const [linha] = (await sql().query(
-      `insert into logins (email, nome, senha_hash) values ($1, $2, $3) returning id`,
-      [dados.email, dados.nome, dados.senhaHash]
+      `insert into logins (email, nome, senha_hash, administrador) values ($1, $2, $3, $4) returning id`,
+      [dados.email, dados.nome, dados.senhaHash, dados.administrador]
     )) as { id: string }[];
     return { id: linha.id };
   } catch (e) {
@@ -148,6 +152,79 @@ export async function desativarLogin(alvo: string, quemPede: string): Promise<Re
   });
 }
 
+export type ResultadoDoPapel = "ok" | "proprio" | "ultimo_administrador" | "nao_encontrado";
+
+/**
+ * TROCA O PAPEL DE UM LOGIN (docs/specs/2026-11-05-contas-por-login.md, seção 4), com as mesmas travas do
+ * desativar: ninguém muda o próprio papel, e o último administrador ativo não vira comum.
+ *
+ * O `for update` é o mesmo do `desativarLogin` (achado 168): dois administradores que rebaixam um ao outro ao
+ * mesmo tempo contariam 2 cada um sem a trava, e o painel ficaria sem nenhum. As ligações com contas ficam como
+ * estão nas duas direções: para o administrador elas não importam, e voltam a valer se ele virar comum.
+ */
+export async function definirPapelDoLogin(id: string, administrador: boolean, quemPede: string): Promise<ResultadoDoPapel> {
+  if (!UUID.test(id)) return "nao_encontrado";
+  if (id === quemPede) return "proprio";
+  return sql().begin(async (tx) => {
+    const ativos = (await tx.query(
+      `select id from logins where administrador and desativado_em is null for update`
+    )) as { id: string }[];
+    const [linha] = (await tx.query(
+      `select administrador, desativado_em is not null as desativado from logins where id = $1 for update`,
+      [id]
+    )) as { administrador: boolean; desativado: boolean }[];
+    if (!linha) return "nao_encontrado";
+    if (!administrador && linha.administrador && !linha.desativado && ativos.length <= 1) return "ultimo_administrador";
+    await tx.query(`update logins set administrador = $2 where id = $1`, [id, administrador]);
+    return "ok";
+  });
+}
+
+/** As contas que um login comum recebeu, na ordem do id. Para o administrador, a lista é a dele, e não importa. */
+export async function idsDasContasDoLogin(loginId: string): Promise<string[]> {
+  if (!UUID.test(loginId)) return [];
+  const linhas = (await sql().query(
+    `select account_id from logins_contas where login_id = $1 order by account_id`,
+    [loginId]
+  )) as { account_id: string }[];
+  return linhas.map((l) => l.account_id);
+}
+
+export type ResultadoDasContas = "ok" | "nao_encontrado" | "administrador" | "conta_inexistente";
+
+/**
+ * TROCA DE UMA VEZ AS CONTAS DE UM LOGIN COMUM (docs/specs/2026-11-05-contas-por-login.md, seção 4), numa
+ * transação: a linha do login fica travada enquanto o conjunto troca, para um "tornar administrador" ao mesmo
+ * tempo não se cruzar com isto. Recusa o login que não existe ou está desativado, o administrador, que vê todas,
+ * e a conta que não existe, sem mudar nada.
+ */
+export async function definirContasDoLogin(loginId: string, contas: string[]): Promise<ResultadoDasContas> {
+  if (!UUID.test(loginId)) return "nao_encontrado";
+  const unicas = [...new Set(contas)];
+  return sql().begin(async (tx) => {
+    const [linha] = (await tx.query(
+      `select administrador, desativado_em is not null as desativado from logins where id = $1 for update`,
+      [loginId]
+    )) as { administrador: boolean; desativado: boolean }[];
+    if (!linha || linha.desativado) return "nao_encontrado";
+    if (linha.administrador) return "administrador";
+    if (unicas.length) {
+      const [{ n }] = (await tx.query(`select count(*)::int as n from accounts where ig_user_id = any($1::text[])`, [
+        unicas,
+      ])) as { n: number }[];
+      if (n !== unicas.length) return "conta_inexistente";
+    }
+    await tx.query(`delete from logins_contas where login_id = $1`, [loginId]);
+    if (unicas.length) {
+      await tx.query(
+        `insert into logins_contas (login_id, account_id) select $1, unnest($2::text[])`,
+        [loginId, unicas]
+      );
+    }
+    return "ok";
+  });
+}
+
 export async function reativarLogin(id: string): Promise<boolean> {
   if (!UUID.test(id)) return false;
   const linhas = (await sql().query(
```

Crie `migrations/023-logins-contas.sql`:

```sql
-- AS CONTAS POR LOGIN: o login comum vê só as contas que o administrador der a ele, e o administrador vê
-- todas. O desenho inteiro está em docs/specs/2026-11-05-contas-por-login.md (a entrega 2 de 2 dos logins).
--
-- `logins_contas`: uma linha diz que o login comum vê aquela conta. O administrador não precisa de linha
-- nenhuma. Apagar o login ou desconectar a conta apaga a ligação junto. O índice da conta serve a esse
-- apagar e a quem pergunta "quem vê esta conta".
--
-- O PADRÃO DE `administrador` PASSA A SER `false`: um login criado sem dizer o papel nasce comum, com menos
-- acesso, e não mais. O código sempre passa o papel; o padrão é só a rede de baixo. Entre esta migração na
-- produção e o merge do código, ninguém cria login (achado 180): a página de antes cria sem dizer o papel.
--
-- A TABELA É OBSERVÁVEL, como as da 022: sem ela o login comum não acha conta nenhuma, e a conferência da
-- partida (lib/esquema.ts) passa a exigi-la.
--
-- O RLS É LIGADO AQUI, como na 021 e na 022. A permissão da API pública não precisa de linha: os
-- privilégios padrão da 020 já fazem a tabela nascer sem nada para `anon` e `authenticated`.
--
-- IDEMPOTENTE, como toda migração desta pasta: `if not exists` na tabela e no índice; ligar o RLS e trocar o
-- padrão de novo não mudam nada.

create table if not exists logins_contas (
  login_id uuid not null
    constraint logins_contas_login_id_fkey references logins (id) on delete cascade,
  account_id text not null
    constraint logins_contas_account_id_fkey references accounts (ig_user_id) on delete cascade,
  criado_em timestamptz not null default now(),
  constraint logins_contas_pkey primary key (login_id, account_id)
);
create index if not exists logins_contas_account_id_idx on logins_contas (account_id);
alter table logins_contas enable row level security;
alter table logins alter column administrador set default false;
```

- [ ] **Passo 4: ver passar**

```bash
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/entrada.integracao.ts testes-integracao/esquema-de-partida.integracao.ts testes-integracao/logins-acoes.integracao.ts testes-integracao/logins-contas-tabela.integracao.ts testes-integracao/logins-tabela.integracao.ts
npx eslint app/logins/actions.ts lib/esquema.ts lib/logins-repositorio.ts testes-integracao/entrada.integracao.ts testes-integracao/esquema-de-partida.integracao.ts testes-integracao/logins-acoes.integracao.ts testes-integracao/logins-contas-tabela.integracao.ts testes-integracao/logins-tabela.integracao.ts testes-integracao/semear-requisicao.ts
npx tsc --noEmit
```

Esperado: integração: 5 arquivos passando, com 53 casos passando; o lint e o `tsc` limpos.

- [ ] **Passo 5: o commit**

A mensagem do commit, gravada em `$SCRATCH/msg-contas-f2.txt`:

```text
A tabela das contas por login, com o papel explícito ao criar e as travas de trocar o papel
```

```bash
git add app/logins/actions.ts lib/esquema.ts lib/logins-repositorio.ts migrations/023-logins-contas.sql testes-integracao/entrada.integracao.ts testes-integracao/esquema-de-partida.integracao.ts testes-integracao/logins-acoes.integracao.ts testes-integracao/logins-contas-tabela.integracao.ts testes-integracao/logins-tabela.integracao.ts testes-integracao/semear-requisicao.ts
git commit -F "$SCRATCH/msg-contas-f2.txt"
```

---

### FASE 3 — A regra num lugar só e o login comum

A regra de quem vê qual conta (`lib/acesso.ts`), a conta escolhida, o seletor, a Configuração e o `/api/oauth/login` só do administrador, e a Atividade sem os eventos sem conta para o comum. As 11 integrações de hoje que mediam uma tela de conta sem sessão passam a usar o login de teste ("O que o ensaio achou", item 2).

- [ ] **Passo 1: os testes, antes do código**

Crie `testes-dom/menu-do-login-comum.dom.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/app/publicar/progresso", () => ({ default: () => null }));
// O SELETOR IMPORTA A ACTION DE TROCAR DE CONTA, que é de servidor. Nenhum caso daqui troca de conta: os
// casos só abrem o menu do seletor e leem o que está nele.
vi.mock("@/app/account-actions", () => ({ selectAccount: vi.fn(async () => {}) }));

import AppShell from "@/app/app-shell";

// O MENU E O SELETOR DO LOGIN COMUM (docs/specs/2026-11-05-contas-por-login.md, seção 3). A Configuração e a
// página Logins são do administrador, e conectar conta também: o "+ Conectar outra conta" do seletor e o
// "Conectar Instagram" do seletor sem contas só aparecem para ele. Esconder é conforto; quem confere é o
// servidor (a página e as actions da Configuração, e o `/api/oauth/login`), medido em
// testes-integracao/contas-por-login.integracao.ts.
//
// O menu aparece uma vez na barra fixa (a gaveta do celular só abre no clique), e os casos contam pelo
// link, como testes-dom/logins-no-menu.dom.tsx.
const CONTAS = [{ ig_user_id: "1", username: "conta_do_painel", profile_picture_url: null }];
const ADMINISTRADOR = { nome: "Eduardo", administrador: true };
const COMUM = { nome: "Fulano", administrador: false };

function desenhar(login: { nome: string; administrador: boolean }, contas = CONTAS) {
  return render(
    <AppShell accounts={contas} selectedId={contas[0]?.ig_user_id ?? null} login={login}>
      <p>o conteúdo da página</p>
    </AppShell>
  );
}

const linksPara = (href: string) => screen.queryAllByRole("link").filter((a) => a.getAttribute("href") === href);

/** Abre o menu do seletor de conta, clicando nele, como a pessoa faz. */
function abrirOSeletor() {
  fireEvent.click(screen.getByRole("button", { name: /@conta_do_painel/ }));
}

describe("o menu do login comum", () => {
  it("o comum não vê a Configuração nem os Logins", () => {
    desenhar(COMUM);
    expect(linksPara("/setup")).toHaveLength(0);
    expect(linksPara("/logins")).toHaveLength(0);
    // O resto do menu continua: o caso não passa por um menu que sumiu inteiro.
    expect(linksPara("/conversas")).toHaveLength(1);
  });

  it("o administrador vê os dois, no grupo Sistema", () => {
    desenhar(ADMINISTRADOR);
    expect(linksPara("/setup")).toHaveLength(1);
    expect(linksPara("/setup")[0].textContent).toBe("Configuração");
    expect(linksPara("/logins")).toHaveLength(1);
  });
});

describe("o seletor de conta do login comum", () => {
  it("o comum abre o seletor e não acha o + Conectar outra conta", () => {
    desenhar(COMUM);
    abrirOSeletor();
    // O menu do seletor abriu de verdade: a conta aparece duas vezes (no botão e na lista).
    expect(screen.getAllByText("@conta_do_painel")).toHaveLength(2);
    expect(screen.queryByText("+ Conectar outra conta")).toBeNull();
    expect(linksPara("/api/oauth/login")).toHaveLength(0);
  });

  it("o administrador abre o seletor e acha o + Conectar outra conta", () => {
    desenhar(ADMINISTRADOR);
    abrirOSeletor();
    expect(linksPara("/api/oauth/login")).toHaveLength(1);
    expect(linksPara("/api/oauth/login")[0].textContent).toBe("+ Conectar outra conta");
  });

  it("o comum sem contas não vê o Conectar Instagram", () => {
    desenhar(COMUM, []);
    expect(screen.queryByText("Conectar Instagram")).toBeNull();
  });

  it("o administrador sem contas vê o Conectar Instagram", () => {
    desenhar(ADMINISTRADOR, []);
    expect(screen.getByText("Conectar Instagram")).toBeTruthy();
  });
});
```

Em `testes-integracao/acoes-que-falam.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/acoes-que-falam.integracao.ts b/testes-integracao/acoes-que-falam.integracao.ts
index 1fe0a8c..f950cc6 100644
--- a/testes-integracao/acoes-que-falam.integracao.ts
+++ b/testes-integracao/acoes-que-falam.integracao.ts
@@ -69,7 +69,10 @@ import { createServer, type Server } from "node:http";
 import type { AddressInfo } from "node:net";
 import { afterAll, beforeAll, describe, expect, test } from "vitest";
 import { bancoDescartavel } from "./harness";
-import { comoNumaRequisicao, comoNumaRequisicaoComSessao } from "./semear-requisicao";
+// A CONTA ESCOLHIDA E AS TELAS DE CONTA RODAM COM A SESSÃO DE TESTE (administrador, que vê todas): desde
+// as contas por login (docs/specs/2026-11-05-contas-por-login.md), sem login não há conta escolhida
+// (lib/account.ts). O cookie de conta continua ausente, e o tombo para a primeira conta continua valendo.
+import { comoNumaRequisicaoComSessao } from "./semear-requisicao";
 import { hojeNoFusoDoPrazo } from "@/lib/lote";
 
 type ModuloAcoes = typeof import("@/app/contatos/actions");
@@ -317,7 +320,7 @@ async function statusDosItens(igId: string): Promise<string[]> {
 // ===========================================================================
 describe("as recusas de quem ainda não conectou conta nenhuma", () => {
   test("a condição deste bloco é o schema SEM conta — e ele confere isso antes de medir", async () => {
-    const { valor } = await comoNumaRequisicao("/contatos", () =>
+    const { valor } = await comoNumaRequisicaoComSessao("/contatos", () =>
       conta.getSelectedAccountId()
     );
     expect(valor).toBe(null);
@@ -352,7 +355,7 @@ describe("as recusas de quem ainda não conectou conta nenhuma", () => {
     const FRASE = "Conecte uma conta do Instagram primeiro.";
     const ID = "17841400000000999";
 
-    const { valor } = await comoNumaRequisicao(`/conversas/${ID}`, async () => {
+    const { valor } = await comoNumaRequisicaoComSessao(`/conversas/${ID}`, async () => {
       const tela = await import("@/app/conversas/[id]/page");
       try {
         const arvore = await tela.default({
@@ -393,8 +396,8 @@ describe("enviarLote termina falando, e o que ela diz é contado do lote certo",
     });
   });
 
-  test("a conta chega às ações sem cookie nenhum, pelo tombo declarado", async () => {
-    const { valor } = await comoNumaRequisicao("/contatos", () =>
+  test("a conta chega às ações sem cookie de conta, pelo tombo declarado", async () => {
+    const { valor } = await comoNumaRequisicaoComSessao("/contatos", () =>
       conta.getSelectedAccountId()
     );
     expect(valor).toBe(CONTA);
@@ -513,7 +516,7 @@ describe("enviarLote termina falando, e o que ela diz é contado do lote certo",
   // o clique errado entrava.
   // -------------------------------------------------------------------------
   test("o campo de prazo não deixa escolher um dia que já passou", async () => {
-    const { valor } = await comoNumaRequisicao("/contatos", async () => {
+    const { valor } = await comoNumaRequisicaoComSessao("/contatos", async () => {
       const tela = await import("@/app/contatos/page");
       return tela.default({ searchParams: Promise.resolve({}) });
     });
```

Em `testes-integracao/agendados.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/agendados.integracao.ts b/testes-integracao/agendados.integracao.ts
index 1f4585f..5d2a3df 100644
--- a/testes-integracao/agendados.integracao.ts
+++ b/testes-integracao/agendados.integracao.ts
@@ -58,6 +58,9 @@ import {
 import type { AddressInfo } from "node:net";
 import { afterAll, beforeAll, describe, expect, test } from "vitest";
 import { bancoDescartavel } from "./harness";
+// A CONTA ESCOLHIDA E AS TELAS DE CONTA RODAM COM A SESSÃO DE TESTE (administrador, que vê todas): desde
+// as contas por login (docs/specs/2026-11-05-contas-por-login.md), sem login não há conta escolhida
+// (lib/account.ts). O cookie de conta continua ausente, e o tombo para a primeira conta continua valendo.
 import { comoNumaRequisicao, comoNumaRequisicaoComSessao } from "./semear-requisicao";
 import { textoDaArvore } from "./texto-da-arvore";
 
@@ -398,8 +401,8 @@ function campoDeDataHora(instante: number): string {
 }
 
 describe("com a conta selecionada pelo tombo declarado (a primeira do schema)", () => {
-  test("a condição deste bloco é CONTA_A vir sem cookie nenhum — e ele confere isso antes de medir", async () => {
-    const { valor } = await comoNumaRequisicao("/publicar", () =>
+  test("a condição deste bloco é CONTA_A vir sem cookie de conta — e ele confere isso antes de medir", async () => {
+    const { valor } = await comoNumaRequisicaoComSessao("/publicar", () =>
       conta.getSelectedAccountId()
     );
     expect(valor).toBe(CONTA_A);
@@ -895,7 +898,7 @@ describe("com a conta selecionada pelo tombo declarado (a primeira do schema)",
 
   /** A arvore que a tela dos agendados devolve, em texto. */
   async function arvoreDosAgendados(): Promise<string> {
-    const { valor } = await comoNumaRequisicao("/publicar", async () =>
+    const { valor } = await comoNumaRequisicaoComSessao("/publicar", async () =>
       textoDaArvore(await telaDosAgendados.default({ searchParams: Promise.resolve({}) }))
     );
     return valor;
@@ -915,7 +918,7 @@ describe("com a conta selecionada pelo tombo declarado (a primeira do schema)",
    * `comoNumaRequisicao` direto na acao, sem tela nenhuma no meio.
    */
   async function arvoreDoDetalhe(id: string): Promise<string> {
-    const { valor } = await comoNumaRequisicao(`/publicar/post/${id}`, async () =>
+    const { valor } = await comoNumaRequisicaoComSessao(`/publicar/post/${id}`, async () =>
       textoDaArvore(
         await telaDoDetalhe.default({
           params: Promise.resolve({ id }),
@@ -928,7 +931,7 @@ describe("com a conta selecionada pelo tombo declarado (a primeira do schema)",
 
   /** A arvore que a tela de Envios devolve, em texto. */
   async function arvoreDeEnvios(): Promise<string> {
-    const { valor } = await comoNumaRequisicao("/eventos", async () =>
+    const { valor } = await comoNumaRequisicaoComSessao("/eventos", async () =>
       textoDaArvore(await telaDeEnvios.default({ searchParams: Promise.resolve({}) }))
     );
     return valor;
```

Em `testes-integracao/capa-do-post.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/capa-do-post.integracao.ts b/testes-integracao/capa-do-post.integracao.ts
index 6559ffd..662d23f 100644
--- a/testes-integracao/capa-do-post.integracao.ts
+++ b/testes-integracao/capa-do-post.integracao.ts
@@ -58,6 +58,9 @@ import type { AddressInfo, Socket } from "node:net";
 import { createElement } from "react";
 import { renderToStaticMarkup } from "react-dom/server";
 import { bancoDescartavel } from "./harness";
+// A CONTA ESCOLHIDA E AS TELAS DE CONTA RODAM COM A SESSÃO DE TESTE (administrador, que vê todas): desde
+// as contas por login (docs/specs/2026-11-05-contas-por-login.md), sem login não há conta escolhida
+// (lib/account.ts). O cookie de conta continua ausente, e o tombo para a primeira conta continua valendo.
 import { comoNumaRequisicao, comoNumaRequisicaoComSessao } from "./semear-requisicao";
 import type { AutomationRow } from "@/app/automacoes/list-client";
 import type { Configuracao } from "@/app/automacoes/editor/painel";
@@ -156,7 +159,7 @@ function acharLinhas(no: unknown): AutomationRow[] | null {
 }
 
 async function linhasDasAutomacoes(): Promise<AutomationRow[]> {
-  const { valor } = await comoNumaRequisicao("/automacoes", () =>
+  const { valor } = await comoNumaRequisicaoComSessao("/automacoes", () =>
     telaDeAutomacoes.default({ searchParams: Promise.resolve({}) })
   );
   const linhas = acharLinhas(valor);
@@ -211,7 +214,7 @@ function acharConfiguracao(no: unknown): Configuracao | null {
  * dado. Lança quando `acharConfiguracao` não a acha — mesmo motivo do `throw`
  * em `linhasDasAutomacoes`, acima. */
 async function configuracaoDoEditor(id: string): Promise<Configuracao> {
-  const { valor } = await comoNumaRequisicao(`/automacoes/${id}`, () =>
+  const { valor } = await comoNumaRequisicaoComSessao(`/automacoes/${id}`, () =>
     editorDaAutomacao.default({ params: Promise.resolve({ id }) })
   );
   const configuracao = acharConfiguracao(valor);
```

Em `testes-integracao/chave-fora-da-pagina.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/chave-fora-da-pagina.integracao.ts b/testes-integracao/chave-fora-da-pagina.integracao.ts
index de4a5fd..d91d4d1 100644
--- a/testes-integracao/chave-fora-da-pagina.integracao.ts
+++ b/testes-integracao/chave-fora-da-pagina.integracao.ts
@@ -10,7 +10,10 @@
 // apagar a chave gravada, nem ser recusado quando ela já existe.
 import { beforeAll, describe, expect, it } from "vitest";
 import { bancoDescartavel } from "./harness";
-import { comoNumaRequisicao, comoNumaRequisicaoComSessao } from "./semear-requisicao";
+// A CONTA ESCOLHIDA E AS TELAS DE CONTA RODAM COM A SESSÃO DE TESTE (administrador, que vê todas): desde
+// as contas por login (docs/specs/2026-11-05-contas-por-login.md), sem login não há conta escolhida
+// (lib/account.ts). O cookie de conta continua ausente, e o tombo para a primeira conta continua valendo.
+import { comoNumaRequisicaoComSessao } from "./semear-requisicao";
 import { textoDaArvore } from "./texto-da-arvore";
 
 const banco = bancoDescartavel();
@@ -66,7 +69,7 @@ async function salvar(campos: Record<string, string>): Promise<string | null> {
 describe("a chave do app da Meta na Configuração", () => {
   it("a página não leva a chave, e diz que ela está configurada", async () => {
     await gravarChave(CHAVE);
-    const { valor } = await comoNumaRequisicao("/setup", () =>
+    const { valor } = await comoNumaRequisicaoComSessao("/setup", () =>
       pagina.default({ searchParams: Promise.resolve({}) })
     );
     const texto = textoDaArvore(valor);
```

Crie `testes-integracao/contas-por-login.integracao.ts`:

```ts
// AS CONTAS POR LOGIN, PELO LADO DO LOGIN COMUM (docs/specs/2026-11-05-contas-por-login.md, seções 2 e 3),
// contra o banco descartável, no contexto de requisição semeado (./semear-requisicao.ts).
//
// O CENÁRIO: duas contas no schema, A e B, e o login comum de teste ligado só à A. O login de teste de
// sempre é administrador e vê as duas. A regra mora em lib/acesso.ts, e quem a pergunta é a conta
// escolhida (lib/account.ts), o layout, o `selectAccount`, a Configuração, o `/api/oauth/login` e a
// Atividade.
//
// NENHUM COOKIE É ESCRITO À MÃO. A sessão de cada login sai da ação de entrar de verdade, e o "cookie da B"
// é o que `selectAccount` emitiu para o administrador (`comoNumaRequisicaoComoComum`, com `contaDoCookie`):
// é o navegador em que um administrador escolheu a B e, depois, o comum entrou.
//
// A ORDEM DOS CASOS NÃO IMPORTA: cada chamada do comum diz as contas dele (`definirContasDoLogin`, por
// dentro de ./semear-requisicao.ts), e os casos que mudam o banco semeiam o que mudam.
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bancoDescartavel } from "./harness";
import {
  cabecalhoDaSessaoDeTeste,
  cabecalhoDoComumDeTeste,
  comoNumaRequisicaoComoComum,
  comoNumaRequisicaoComSessao,
} from "./semear-requisicao";
import { textoDaArvore } from "./texto-da-arvore";

const banco = bancoDescartavel();
const q = (texto: string, params: unknown[] = []) =>
  banco.db().sql().query(texto, params) as Promise<Record<string, unknown>[]>;

// Os ids deste arquivo. Valores inventados: nenhuma credencial de verdade entra em teste.
const CONTA_A = "17800000000031001";
const CONTA_B = "17800000000031002";
const APP_URL_FALSO = "https://painel.exemplo.invalid";

let servidor: Server;
let PORTA = 0;
const meta = { pedidos: [] as string[] };

// A CERCA DA REDE. As actions da Configuração falam com a Meta (`reassinarWebhooks`, as perguntas de
// abertura) e com a própria URL do app (`testarWebhook`), e `configurarWebhookAuto` chama o Graph do
// Facebook por um endereço fixo (`FB_GRAPH`, lib/ig.ts), que nenhuma variável desvia. Sem a conferência do
// papel, que é o que o RED deste arquivo mede, elas chegariam lá. A cerca deixa passar só o que vai para
// esta máquina (a Meta falsa, abaixo) e recusa o resto, anotando a origem; o último caso exige zero.
const pedidosParaFora: string[] = [];
let fetchDeVerdade: typeof fetch;

type ModuloConta = typeof import("@/lib/account");
type ModuloAcoesDaConta = typeof import("@/app/account-actions");
type ModuloSetup = typeof import("@/app/setup/actions");
type ModuloConvites = typeof import("@/lib/convites-repositorio");
type ModuloAutomacoes = typeof import("@/app/automacoes/actions");
type ModuloConversas = typeof import("@/app/conversas/[id]/actions");
type ModuloPost = typeof import("@/app/publicar/post/actions");
type ModuloSessao = typeof import("@/lib/sessao");
let conta: ModuloConta;
let acoesDaConta: ModuloAcoesDaConta;
let setup: ModuloSetup;
let convites: ModuloConvites;
let automacoes: ModuloAutomacoes;
let conversas: ModuloConversas;
let post: ModuloPost;
let sessao: ModuloSessao;
let Pedido: typeof import("next/server").NextRequest;

beforeAll(async () => {
  servidor = createServer((req, res) => {
    meta.pedidos.push(`${req.method} ${req.url}`);
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: { message: "a Meta falsa deste arquivo não responde nada" } }));
  });
  await new Promise<void>((pronto) => servidor.listen(0, "127.0.0.1", pronto));
  PORTA = (servidor.address() as AddressInfo).port;
  process.env.IG_GRAPH_BASE = `http://127.0.0.1:${PORTA}`;
  delete process.env.QSTASH_TOKEN;
  // A URL do app vem do ambiente antes do banco (`envAppUrl`, lib/app-url.ts). Sem estas três, ela é a
  // gravada na `config`, que aponta para a Meta falsa.
  delete process.env.APP_URL;
  delete process.env.NEXT_PUBLIC_APP_URL;
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;

  fetchDeVerdade = globalThis.fetch;
  globalThis.fetch = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(entrada instanceof Request ? entrada.url : String(entrada));
    if (url.hostname !== "127.0.0.1") {
      pedidosParaFora.push(url.origin);
      throw new Error(`A CERCA DE contas-por-login.integracao.ts recusou um pedido para ${url.origin}`);
    }
    return fetchDeVerdade(entrada, init);
  }) as typeof fetch;

  conta = await import("@/lib/account");
  acoesDaConta = await import("@/app/account-actions");
  setup = await import("@/app/setup/actions");
  convites = await import("@/lib/convites-repositorio");
  automacoes = await import("@/app/automacoes/actions");
  conversas = await import("@/app/conversas/[id]/actions");
  post = await import("@/app/publicar/post/actions");
  sessao = await import("@/lib/sessao");
  Pedido = (await import("next/server")).NextRequest;

  const ig = await import("@/lib/ig");
  if (ig.baseDoGraph() !== process.env.IG_GRAPH_BASE) {
    throw new Error(
      `RECUSADO: a base do Graph é ${ig.baseDoGraph()}, e tinha de ser a desta rodada ` +
        `(${process.env.IG_GRAPH_BASE}). Sem o desvio, este arquivo falaria com a Meta de verdade.`
    );
  }

  // AS DUAS CONTAS, A ANTES DA B. A ordem é a do `created_at` (a de `listAccounts`), e ela vai explícita:
  // a primeira conta é o tombo de quem não tem cookie.
  for (const [id, nome] of [
    [CONTA_A, "conta_a_das_contas_por_login"],
    [CONTA_B, "conta_b_das_contas_por_login"],
  ] as const) {
    await banco.db().upsertAccount({
      ig_user_id: id,
      username: nome,
      name: nome,
      profile_picture_url: null,
      access_token: `token-da-${nome}-que-nao-vale-nada`,
      token_expires_at: null,
    });
  }
  await q(`update accounts set created_at = now() - interval '2 hours' where ig_user_id = $1`, [CONTA_A]);
  await q(`update accounts set created_at = now() - interval '1 hour' where ig_user_id = $1`, [CONTA_B]);
  await q(`insert into config (id) values (1) on conflict do nothing`);
});

afterAll(async () => {
  globalThis.fetch = fetchDeVerdade;
  delete process.env.IG_GRAPH_BASE;
  await new Promise<void>((pronto) => servidor.close(() => pronto()));
});

const form = (campos: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
};

type Desfecho<T> = {
  /** O `digest` da exceção de controle de fluxo (redirect, notFound), ou `null` se o corpo voltou. */
  digest: string | null;
  /** O destino do redirect, lido do `digest`, ou `null`. */
  destino: string | null;
  valor: T | undefined;
  /** As tags que `revalidatePath` empilhou. */
  tags: unknown[];
};

/** O corpo, com o redirect e o 404 (que viajam no `digest`) virando valor. O erro de verdade sobe. */
function capturando<T>(corpo: () => Promise<T>) {
  return async (): Promise<{ digest: string | null; valor: T | undefined }> => {
    try {
      return { digest: null, valor: await corpo() };
    } catch (e) {
      const d = (e as { digest?: unknown }).digest;
      // Erro de verdade sobe: engoli-lo aqui viraria um desfecho mudo.
      if (typeof d !== "string") throw e;
      return { digest: d, valor: undefined };
    }
  };
}

const destinoDe = (digest: string | null) =>
  digest?.startsWith("NEXT_REDIRECT;") ? digest.split(";").slice(2, -2).join(";") : null;

/** O corpo com o login COMUM, e o que ele publicou: o valor, ou o redirect e o 404, que viajam no `digest`. */
async function comoComum<T>(
  rota: string,
  corpo: () => Promise<T>,
  opcoes: { contas: string[]; contaDoCookie?: string } = { contas: [CONTA_A] }
): Promise<Desfecho<T>> {
  const { valor, tags } = await comoNumaRequisicaoComoComum(rota, capturando(corpo), opcoes);
  return { ...valor, destino: destinoDe(valor.digest), tags };
}

/** O mesmo, com o login de teste, que é administrador (e sem cookie de conta: a primeira, a A). */
async function comoAdministrador<T>(rota: string, corpo: () => Promise<T>): Promise<Desfecho<T>> {
  const { valor, tags } = await comoNumaRequisicaoComSessao(rota, capturando(corpo));
  return { ...valor, destino: destinoDe(valor.digest), tags };
}

/**
 * Os `props` de todo elemento da árvore que casam com `casa`: a mesma leitura de
 * acoes-que-falam.integracao.ts (`propsDaArvore`), copiada e não importada, como as outras cópias desta
 * pasta. Anda só pelos FILHOS, e guarda o que já viu: a árvore do React tem referências circulares
 * (`_owner`), e um caminhar ingênuo entra em laço. Nenhum componente filho é chamado.
 */
function propsDaArvore(raiz: unknown, casa: (props: Record<string, unknown>) => boolean): Record<string, unknown>[] {
  const achados: Record<string, unknown>[] = [];
  const visto = new Set<unknown>();
  const andar = (no: unknown): void => {
    if (Array.isArray(no)) {
      no.forEach(andar);
      return;
    }
    if (typeof no !== "object" || no === null || visto.has(no)) return;
    visto.add(no);
    const props = (no as { props?: Record<string, unknown> }).props;
    if (!props) return;
    if (casa(props)) achados.push(props);
    andar(props.children);
  };
  andar(raiz);
  return achados;
}

const NAO_ACHOU = "NEXT_HTTP_ERROR_FALLBACK;404";

// ---------------------------------------------------------------------------------------------------
// 1 a 3. A CONTA ESCOLHIDA E O SELETOR
// ---------------------------------------------------------------------------------------------------

describe("a conta escolhida do login comum", () => {
  it("com o cookie da B, a conta escolhida do comum é a A", async () => {
    const d = await comoComum("/", () => conta.getSelectedAccountId(), { contas: [CONTA_A], contaDoCookie: CONTA_B });
    expect(d.digest).toBe(null);
    expect(d.valor).toBe(CONTA_A);
  });

  it("as contas do comum são só a A", async () => {
    const acesso = await import("@/lib/acesso");
    const d = await comoComum(
      "/",
      async () => {
        const login = await sessao.sessaoAtual();
        if (!login) throw new Error("o comum de teste ficou sem sessão");
        return (await acesso.contasDoLogin(login)).map((c) => c.ig_user_id);
      },
      { contas: [CONTA_A], contaDoCookie: CONTA_B }
    );
    expect(d.valor).toEqual([CONTA_A]);
  });

  it("o comum sem contas não tem conta escolhida, nem com o cookie da B", async () => {
    const d = await comoComum("/", () => conta.getSelectedAccountId(), { contas: [], contaDoCookie: CONTA_B });
    expect(d.valor).toBe(null);
  });
});

describe("o selectAccount do login comum", () => {
  // NUMA REQUISIÇÃO SEM COOKIE DE CONTA: o que se lê depois da chamada é só o que ela gravou.
  it("o da B não grava o cookie, nem revalida", async () => {
    const { ACCOUNT_COOKIE } = conta;
    const { cookies } = await import("next/headers");
    const d = await comoComum("/", async () => {
      await acoesDaConta.selectAccount(form({ account_id: CONTA_B }));
      return (await cookies()).get(ACCOUNT_COOKIE)?.value ?? null;
    });
    expect(d.digest).toBe(null);
    expect(d.valor).toBe(null);
    expect(d.tags).toEqual([]);
  });

  it("o da A grava o cookie, e revalida", async () => {
    const { ACCOUNT_COOKIE } = conta;
    const { cookies } = await import("next/headers");
    const d = await comoComum("/", async () => {
      await acoesDaConta.selectAccount(form({ account_id: CONTA_A }));
      return (await cookies()).get(ACCOUNT_COOKIE)?.value ?? null;
    });
    expect(d.valor).toBe(CONTA_A);
    expect(d.tags.length).toBeGreaterThan(0);
  });
});

describe("o administrador continua vendo tudo", () => {
  it("as contas do administrador são a A e a B, na ordem de criação", async () => {
    const acesso = await import("@/lib/acesso");
    const { valor } = await comoNumaRequisicaoComSessao("/", async () => {
      const login = await sessao.sessaoAtual();
      if (!login?.administrador) throw new Error("o login de teste devia ser administrador");
      return (await acesso.contasDoLogin(login)).map((c) => c.ig_user_id);
    });
    expect(valor).toEqual([CONTA_A, CONTA_B]);
  });

  it("com o cookie da B, a conta escolhida do administrador é a B", async () => {
    const { valor } = await comoNumaRequisicaoComSessao("/", () => conta.getSelectedAccountId(), {
      contaDoCookie: CONTA_B,
    });
    expect(valor).toBe(CONTA_B);
  });
});

// ---------------------------------------------------------------------------------------------------
// 4 e 5. A CONFIGURAÇÃO E O CONECTAR SÃO DO ADMINISTRADOR
// ---------------------------------------------------------------------------------------------------

/** Quantas linhas tem cada tabela do schema descartável (o molde de sessao-nas-acoes.integracao.ts). */
async function tamanhos(): Promise<Record<string, number>> {
  const tabelas = (await q(
    `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = current_schema() and c.relkind in ('r', 'p') order by 1`
  )) as { relname: string }[];
  const saida: Record<string, number> = {};
  for (const { relname } of tabelas) {
    const [{ n }] = (await q(`select count(*)::int as n from "${relname}"`)) as { n: number }[];
    saida[relname] = n;
  }
  return saida;
}

/** O que as actions da Configuração mexeriam: a `config`, os convites e o tamanho de cada tabela. */
async function estadoDaConfiguracao() {
  return {
    config: await q(`select * from config where id = 1`),
    convites: await q(`select * from convites_de_conexao order by criado_em, id`),
    tamanhos: await tamanhos(),
  };
}

describe("a Configuração manda o login comum para o início, sem mudar nada", () => {
  let conviteId = "";

  beforeAll(async () => {
    conviteId = (await convites.criarConvite("convite do administrador")).id;
  });

  // A `config` VOLTA AO MESMO PONTO antes de cada caso: com o App ID e a URL do app (a Meta falsa), e sem
  // chave nenhuma. Assim um caso que mudasse a `config` (o RED) não muda o ponto de partida do seguinte.
  beforeEach(async () => {
    await q(
      `update config set instagram_app_id = $1, instagram_app_secret = null, meta_app_id = null,
              meta_app_secret = null, app_url = $2 where id = 1`,
      ["1234567890123456", `http://127.0.0.1:${PORTA}`]
    );
  });

  const ACOES: [string, () => Promise<unknown>][] = [
    ["reassinarWebhooks", () => setup.reassinarWebhooks()],
    ["testarWebhook", () => setup.testarWebhook()],
    [
      "configurarWebhookAuto",
      () => setup.configurarWebhookAuto(form({ meta_app_id: "999", meta_app_secret: "chave-inventada-do-comum" })),
    ],
    [
      "saveMetaCredentials",
      () => setup.saveMetaCredentials(form({ instagram_app_id: "888", instagram_app_secret: "outra-chave-inventada" })),
    ],
    ["salvarPerguntasDeAbertura", () => setup.salvarPerguntasDeAbertura(form({ conta: CONTA_A }))],
    ["gerarConvite", () => setup.gerarConvite(null, form({ para_quem: "Dr. Comum" }))],
    ["cancelarConvite", () => setup.cancelarConvite(form({ id: conviteId }))],
  ];

  it("a lista tem as 5 actions da Configuração e os 2 convites", () => {
    expect(ACOES).toHaveLength(7);
  });

  it.each(ACOES)("%s vai para /, e nada muda", async (_nome, acao) => {
    // A SESSÃO DO COMUM ANTES DA FOTO: a primeira entrada dele grava uma sessão, e ela não é da action.
    await cabecalhoDoComumDeTeste([CONTA_A]);
    const antes = await estadoDaConfiguracao();
    const d = await comoComum("/setup", acao);
    expect(d.destino).toBe("/");
    expect(await estadoDaConfiguracao()).toEqual(antes);
  });
});

describe("o /api/oauth/login é do administrador", () => {
  beforeAll(async () => {
    await q(`update config set instagram_app_id = $1, app_url = $2 where id = 1`, ["1234567890123456", APP_URL_FALSO]);
  });

  const comecar = (cookie: string) =>
    import("@/app/api/oauth/login/route").then((rota) =>
      rota.GET(new Pedido(`${APP_URL_FALSO}/api/oauth/login`, { method: "GET", headers: { cookie } }))
    );
  const setCookies = (r: Response) => (r.headers as Headers & { getSetCookie(): string[] }).getSetCookie();

  it("com a sessão do comum, volta para a raiz, sem state", async () => {
    const resposta = await comecar(await cabecalhoDoComumDeTeste([CONTA_A]));
    const para = new URL(resposta.headers.get("location") ?? "");
    expect(para.origin).toBe(APP_URL_FALSO);
    expect(para.pathname).toBe("/");
    expect(setCookies(resposta)).toEqual([]);
  });

  it("com a do administrador, segue para o Instagram, como hoje", async () => {
    const resposta = await comecar(await cabecalhoDaSessaoDeTeste());
    expect(new URL(resposta.headers.get("location") ?? "").origin).toBe("https://www.instagram.com");
  });
});

// A PÁGINA, chamada como componente no contexto de cada login: ela confere o papel no servidor, antes de
// ler a `config` e todas as contas (app/setup/page.tsx).
describe("a página da Configuração é do administrador", () => {
  const abrir = async () => {
    const tela = await import("@/app/setup/page");
    return tela.default({ searchParams: Promise.resolve({}) });
  };

  it("o comum vai para /", async () => {
    const d = await comoComum("/setup", abrir);
    expect(d.destino).toBe("/");
  });

  it("o administrador, para comparar, recebe a página", async () => {
    const d = await comoAdministrador("/setup", abrir);
    expect(d.digest).toBe(null);
    expect(d.valor).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------------------------------
// 6. UMA ROTA DE CONTA: O CSV DE E-MAILS
// ---------------------------------------------------------------------------------------------------

describe("a lista de e-mails do comum é a da conta dele", () => {
  const EMAIL_DA_A = "pessoa.da.a@exemplo.invalid";
  const EMAIL_DA_B = "pessoa.da.b@exemplo.invalid";

  beforeAll(async () => {
    // O `campos` montado por `jsonb_build_object`, como o motor grava (ver exportacao-completa.integracao.ts).
    for (const [contaId, igId, email] of [
      [CONTA_A, "9310000000000001", EMAIL_DA_A],
      [CONTA_B, "9310000000000002", EMAIL_DA_B],
    ] as const) {
      await q(
        `insert into contacts (account_id, ig_id, username, campos, last_reply_at)
         values ($1, $2, $3, jsonb_build_object('email', jsonb_build_object('valor', $4::text, 'em', $5::text)), now())`,
        [contaId, igId, `csv_${igId}`, email, "2026-11-05T12:00:00.000Z"]
      );
    }
  });

  it("com o cookie da B, o CSV traz o contato da A e nenhum da B", async () => {
    const rota = await import("@/app/api/contatos/csv/route");
    const cookie = await cabecalhoDoComumDeTeste([CONTA_A], CONTA_B);
    const d = await comoComum(
      "/api/contatos/csv",
      async () => {
        const r = await rota.GET(new Pedido(`${APP_URL_FALSO}/api/contatos/csv`, { method: "GET", headers: { cookie } }));
        return { status: r.status, texto: await r.text() };
      },
      { contas: [CONTA_A], contaDoCookie: CONTA_B }
    );
    expect(d.valor?.status).toBe(200);
    expect(d.valor?.texto).toContain(EMAIL_DA_A);
    expect(d.valor?.texto).not.toContain(EMAIL_DA_B);
  });
});

// ---------------------------------------------------------------------------------------------------
// 7. A ATIVIDADE E OS EVENTOS SEM CONTA
// ---------------------------------------------------------------------------------------------------

describe("a Atividade e os eventos sem conta", () => {
  beforeAll(async () => {
    for (const [contaId, texto] of [
      [CONTA_A, "atividade-da-a"],
      [CONTA_B, "atividade-da-b"],
      [null, "atividade-sem-conta"],
    ] as const) {
      await q(`insert into events (account_id, type, payload) values ($1, 'comment', jsonb_build_object('text', $2::text))`, [
        contaId,
        texto,
      ]);
    }
  });

  /** Os textos dos eventos deste bloco que a consulta da Atividade traz. */
  async function daAtividade(comEventosSemConta?: boolean): Promise<string[]> {
    const { EVENTS_FROM, buildWhere } = await import("@/lib/event-query");
    const { NO_FILTERS } = await import("@/lib/event-filters");
    const w =
      comEventosSemConta === undefined
        ? buildWhere(CONTA_A, NO_FILTERS)
        : buildWhere(CONTA_A, NO_FILTERS, comEventosSemConta);
    const linhas = (await q(`select e.payload->>'text' as texto ${EVENTS_FROM} where ${w.sql}`, w.params)) as {
      texto: string | null;
    }[];
    return linhas
      .map((l) => l.texto ?? "")
      .filter((t) => t.startsWith("atividade-"))
      .sort();
  }

  it("com false (o comum), traz só os da A", async () => {
    expect(await daAtividade(false)).toEqual(["atividade-da-a"]);
  });

  it("com o padrão (o administrador), traz os da A e os sem conta", async () => {
    expect(await daAtividade()).toEqual(["atividade-da-a", "atividade-sem-conta"]);
  });
});

// A TELA DA ATIVIDADE, chamada como componente: é ela que passa o papel à consulta dos eventos e à do
// seletor de posts (app/eventos/page.tsx). Os dois logins estão na A (o comum só tem a A; o administrador,
// sem cookie de conta, cai na primeira), então a única diferença entre eles é o papel.
describe("a tela da Atividade e um evento sem conta", () => {
  const MARCADOR = "evento-sem-conta-na-tela-da-atividade";
  const MIDIA_DO_EVENTO_SEM_CONTA = "17999000000031009";

  beforeAll(async () => {
    await q(
      `insert into events (account_id, type, payload)
       values (null, 'comment', jsonb_build_object('text', $1::text, 'media', jsonb_build_object('id', $2::text)))`,
      [MARCADOR, MIDIA_DO_EVENTO_SEM_CONTA]
    );
  });

  const abrir = async () => {
    const tela = await import("@/app/eventos/page");
    return tela.default({ searchParams: Promise.resolve({}) });
  };
  // O texto do evento chega à árvore em dois lugares: o `texto` do `<Realce>` e o JSON do `<pre>` dos
  // detalhes técnicos. Qualquer `prop` de texto com o marcador conta.
  const temOMarcador = (arvore: unknown) =>
    propsDaArvore(arvore, (p) => Object.values(p).some((v) => typeof v === "string" && v.includes(MARCADOR))).length > 0;
  const postsDoSeletor = (arvore: unknown) =>
    propsDaArvore(arvore, (p) => Array.isArray(p.posts)).flatMap((p) => (p.posts as { id: string }[]).map((o) => o.id));

  it("o comum não vê o evento sem conta, e o administrador vê", async () => {
    const comum = await comoComum("/eventos", abrir);
    const administrador = await comoAdministrador("/eventos", abrir);
    expect(comum.digest).toBe(null);
    expect(administrador.digest).toBe(null);
    expect(temOMarcador(comum.valor)).toBe(false);
    expect(temOMarcador(administrador.valor)).toBe(true);
  });

  it("o seletor de posts do comum não oferece o post do evento sem conta, e o do administrador oferece", async () => {
    const comum = await comoComum("/eventos", abrir);
    const administrador = await comoAdministrador("/eventos", abrir);
    expect(postsDoSeletor(comum.valor)).not.toContain(MIDIA_DO_EVENTO_SEM_CONTA);
    expect(postsDoSeletor(administrador.valor)).toContain(MIDIA_DO_EVENTO_SEM_CONTA);
  });
});

// ---------------------------------------------------------------------------------------------------
// 8. A LIGAÇÃO DO ID À CONTA (achado 181)
//
// Os pontos que recebem um id do navegador e o ligam à conta escolhida (`... and account_id = $n`) ficam
// presos às contas do login sem mudar uma linha deles: a conta escolhida do comum já é uma das dele. Aqui o
// comum, ligado só à A, manda um id que é da B. A recusa tem de vir sem mudar nada no banco; e, para a
// recusa não ser de qualquer pedido, o mesmo pedido com o id da A funciona.
// ---------------------------------------------------------------------------------------------------

describe("a ligação do id à conta: o comum com um id da B (181)", () => {
  const CONTATO_A = "9320000000000001";
  const CONTATO_B = "9320000000000002";
  let automacaoA = "";
  let automacaoB = "";
  let itemA = "";
  let itemB = "";

  async function novaAutomacao(contaId: string, nome: string): Promise<string> {
    const [linha] = (await q(
      `insert into automations (account_id, name, active, triggers, keywords, match_type, steps)
       values ($1, $2, false, '{dm}'::text[], '{oi}'::text[], 'contains', '[]'::jsonb)
       returning id`,
      [contaId, nome]
    )) as { id: string }[];
    return linha.id;
  }

  async function novoItemDaFila(contaId: string): Promise<string> {
    const [linha] = (await q(
      `insert into queue (account_id, kind, contact_ig_id, payload, dedupe_key, status, not_before)
       values ($1, 'publicacao', null, $2, $3, 'pending', now() + interval '1 hour')
       returning id`,
      [contaId, { forma: "imagem", caminhos: [`${contaId}/agendado.jpg`] }, `contas-por-login-${contaId}`]
    )) as { id: string }[];
    return linha.id;
  }

  const automacao = (id: string) => q(`select * from automations where id = $1`, [id]);
  const contato = (contaId: string, igId: string) =>
    q(`select * from contacts where account_id = $1 and ig_id = $2`, [contaId, igId]);
  const item = (id: string) => q(`select * from queue where id = $1`, [id]);
  const tamanhoDaFila = async () => Number((await q(`select count(*)::int as n from queue`))[0].n);

  beforeAll(async () => {
    automacaoA = await novaAutomacao(CONTA_A, "automação da A");
    automacaoB = await novaAutomacao(CONTA_B, "automação da B");
    for (const [contaId, igId] of [
      [CONTA_A, CONTATO_A],
      [CONTA_B, CONTATO_B],
    ] as const) {
      // A JANELA DE 24H ABERTA nos dois: a recusa do `sendReply` não pode ser a da janela do próprio contato.
      await q(
        `insert into contacts (account_id, ig_id, username, last_reply_at, categoria)
         values ($1, $2, $3, now(), 'categoria de antes')`,
        [contaId, igId, `pessoa_${igId}`]
      );
    }
    itemA = await novoItemDaFila(CONTA_A);
    itemB = await novoItemDaFila(CONTA_B);
  });

  it("deleteAutomation: o id da B é recusado e a automação da B fica igual", async () => {
    const antes = await automacao(automacaoB);
    const d = await comoComum("/automacoes", () => automacoes.deleteAutomation(automacaoB));
    expect(d.valor).toEqual({ ok: false, erro: "Automação não encontrada." });
    expect(await automacao(automacaoB)).toEqual(antes);
  });

  it("deleteAutomation: o id da A, para comparar, apaga", async () => {
    const id = await novaAutomacao(CONTA_A, "automação da A para apagar");
    const d = await comoComum("/automacoes", () => automacoes.deleteAutomation(id));
    expect(d.valor).toEqual({ ok: true, ativoGravado: false });
    expect(await automacao(id)).toEqual([]);
  });

  it("salvarAutomacao: o id da B é recusado e a automação da B fica igual", async () => {
    const antes = await automacao(automacaoB);
    const d = await comoComum("/automacoes", () =>
      automacoes.salvarAutomacao(automacaoB, [{ id: "b_comum001", tipo: "dm", texto: "Oi!" }], [], {
        nome: "o comum tentou",
        ativo: false,
        gatilho: "dm",
        correspondencia: "any",
        palavras: [],
        entregaSemPortao: false,
      })
    );
    expect(d.valor).toEqual({ ok: false, erro: "Automação não encontrada." });
    expect(await automacao(automacaoB)).toEqual(antes);
  });

  // A RECUSA VEM ANTES DE QUALQUER CHAMADA À META, e é pela conta escolhida: a janela é lida em
  // `app/conversas/[id]/actions.ts:30-33`, com `where account_id = $1 and ig_id = $2` (:31) e a conta
  // escolhida (a A) no `$1`. O contato da B não tem linha na A, `windowState(null)` dá `open: false`
  // (lib/inbox-window.ts:20), e o `if` de `app/conversas/[id]/actions.ts:34` devolve a recusa antes do
  // `enqueueManualReply` (:38) e do `drainQueue` (:62). Nada vai à fila, e a Meta falsa não recebe nada.
  it("sendReply: o contato da B é recusado antes da Meta, e nada vai à fila", async () => {
    const pedidosAntes = meta.pedidos.length;
    const filaAntes = await tamanhoDaFila();
    const antes = await contato(CONTA_B, CONTATO_B);
    const d = await comoComum(`/conversas/${CONTATO_B}`, () =>
      conversas.sendReply(undefined, form({ contact: CONTATO_B, text: "mensagem que não pode sair" }))
    );
    expect(d.valor).toEqual({ error: "A janela de 24h fechou. Só é possível responder quem falou há menos de 24h." });
    expect(await tamanhoDaFila()).toBe(filaAntes);
    expect(meta.pedidos.length).toBe(pedidosAntes);
    expect(await contato(CONTA_B, CONTATO_B)).toEqual(antes);
  });

  // ESTA ACTION NÃO DIZ "RECUSADO": o `update` da conta escolhida pega zero linhas e ela volta com o aviso
  // de categoria salva, como para um contato que não existe (app/conversas/[id]/actions.ts:150-158). O que
  // prende a ligação é o banco: a categoria da B não muda. E a da A, pelo mesmo pedido, muda.
  it("definirCategoria: a categoria do contato da B não muda", async () => {
    const antes = await contato(CONTA_B, CONTATO_B);
    const d = await comoComum(`/conversas/${CONTATO_B}`, () =>
      conversas.definirCategoria(form({ contato: CONTATO_B, categoria: "mudada pelo comum" }))
    );
    expect(d.destino ?? "").toMatch(new RegExp(`^/conversas/${CONTATO_B}\\?`));
    expect(await contato(CONTA_B, CONTATO_B)).toEqual(antes);
  });

  it("definirCategoria: a do contato da A, para comparar, muda", async () => {
    await comoComum(`/conversas/${CONTATO_A}`, () =>
      conversas.definirCategoria(form({ contato: CONTATO_A, categoria: "mudada pelo comum" }))
    );
    expect((await contato(CONTA_A, CONTATO_A))[0].categoria).toBe("mudada pelo comum");
  });

  it("remarcarPublicacao: o item da B não é achado, e a hora dele fica igual", async () => {
    const antes = await item(itemB);
    const daquiADoisDias = new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString().slice(0, 16);
    const d = await comoComum("/publicar", () =>
      post.remarcarPublicacao(form({ id: itemB, data_hora: daquiADoisDias, fuso: "0" }))
    );
    expect(new URL(d.destino ?? "/", "http://127.0.0.1").searchParams.get("aviso")).toContain(
      "Não achei este post agendado nesta conta"
    );
    expect(await item(itemB)).toEqual(antes);
  });

  it("/automacoes/[id]: o id da B dá 404, e o da A abre", async () => {
    const tela = await import("@/app/automacoes/[id]/page");
    const abrir = (id: string) => comoComum(`/automacoes/${id}`, () => tela.default({ params: Promise.resolve({ id }) }));
    expect((await abrir(automacaoB)).digest).toBe(NAO_ACHOU);
    expect((await abrir(automacaoA)).digest).toBe(null);
  });

  it("/publicar/post/[id]: o item da B dá 404, e o da A abre", async () => {
    const tela = await import("@/app/publicar/post/[id]/page");
    const abrir = (id: string) =>
      comoComum(`/publicar/post/${id}`, () =>
        tela.default({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) })
      );
    expect((await abrir(itemB)).digest).toBe(NAO_ACHOU);
    expect((await abrir(itemA)).digest).toBe(null);
  });

  it("/conversas/[id]: o contato da B não aparece, e o da A aparece", async () => {
    const tela = await import("@/app/conversas/[id]/page");
    const abrir = async (id: string) => {
      const d = await comoComum(`/conversas/${id}`, async () =>
        textoDaArvore(await tela.default({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) }))
      );
      expect(d.digest).toBe(null);
      return d.valor ?? "";
    };
    expect(await abrir(CONTATO_B)).not.toContain(`pessoa_${CONTATO_B}`);
    expect(await abrir(CONTATO_A)).toContain(`pessoa_${CONTATO_A}`);
  });
});

describe("a cerca da rede", () => {
  it("nenhum pedido deste arquivo saiu da máquina", () => {
    expect(pedidosParaFora).toEqual([]);
  });
});
```

Em `testes-integracao/desempenho.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/desempenho.integracao.ts b/testes-integracao/desempenho.integracao.ts
index d527759..234faeb 100644
--- a/testes-integracao/desempenho.integracao.ts
+++ b/testes-integracao/desempenho.integracao.ts
@@ -63,7 +63,10 @@
 // isto que o plantio do relatório confirma.
 import { beforeAll, describe, expect, test } from "vitest";
 import { bancoDescartavel } from "./harness";
-import { comoNumaRequisicao } from "./semear-requisicao";
+// A CONTA ESCOLHIDA E AS TELAS DE CONTA RODAM COM A SESSÃO DE TESTE (administrador, que vê todas): desde
+// as contas por login (docs/specs/2026-11-05-contas-por-login.md), sem login não há conta escolhida
+// (lib/account.ts). O cookie de conta continua ausente, e o tombo para a primeira conta continua valendo.
+import { comoNumaRequisicaoComSessao } from "./semear-requisicao";
 import { textoDaArvore } from "./texto-da-arvore";
 
 type ModuloTelaDeDesempenho = typeof import("@/app/desempenho/page");
@@ -138,7 +141,7 @@ async function totalDoGrafico(): Promise<{ arvore: string; linhasDoGrafico: { di
   }) as typeof s.query;
 
   try {
-    const { valor: arvore } = await comoNumaRequisicao("/desempenho", async () =>
+    const { valor: arvore } = await comoNumaRequisicaoComSessao("/desempenho", async () =>
       textoDaArvore(await telaDeDesempenho.default())
     );
     if (capturado === null) {
```

Em `testes-integracao/ficha-da-conversa.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/ficha-da-conversa.integracao.ts b/testes-integracao/ficha-da-conversa.integracao.ts
index 9f5e372..780deec 100644
--- a/testes-integracao/ficha-da-conversa.integracao.ts
+++ b/testes-integracao/ficha-da-conversa.integracao.ts
@@ -37,7 +37,10 @@
 // nenhum, procurando o prop pelo NOME.
 import { beforeAll, describe, expect, test } from "vitest";
 import { bancoDescartavel } from "./harness";
-import { comoNumaRequisicao } from "./semear-requisicao";
+// A CONTA ESCOLHIDA E AS TELAS DE CONTA RODAM COM A SESSÃO DE TESTE (administrador, que vê todas): desde
+// as contas por login (docs/specs/2026-11-05-contas-por-login.md), sem login não há conta escolhida
+// (lib/account.ts). O cookie de conta continua ausente, e o tombo para a primeira conta continua valendo.
+import { comoNumaRequisicaoComSessao } from "./semear-requisicao";
 import { migracoesEmOrdem } from "./migracoes";
 // `lib/ficha-do-coletado.ts` é módulo puro (não fala com o banco): pode ser
 // importado no topo, como `migracao-dos-dados-legados.integracao.ts` já faz com
@@ -95,7 +98,7 @@ function itensDaFicha(raiz: unknown): ItemDaFicha[] {
 
 /** A ficha que a tela da conversa monta para este contato. */
 async function fichaNaTela(igId: string): Promise<ItemDaFicha[]> {
-  const { valor } = await comoNumaRequisicao(`/conversas/${igId}`, async () => {
+  const { valor } = await comoNumaRequisicaoComSessao(`/conversas/${igId}`, async () => {
     const tela = await import("@/app/conversas/[id]/page");
     return itensDaFicha(
       await tela.default({
@@ -161,14 +164,14 @@ beforeAll(async () => {
 
 describe("a ficha que a tela da conversa monta", () => {
   test("a conta que a tela usa é a desta suíte, e não a vizinha", async () => {
-    const { valor } = await comoNumaRequisicao("/conversas", async () => {
+    const { valor } = await comoNumaRequisicaoComSessao("/conversas", async () => {
       const conta = await import("@/lib/account");
       return conta.getSelectedAccountId();
     });
     expect(
       valor,
       "`listAccounts` ordena por `created_at asc` e `getSelectedAccount` cai na " +
-        "primeira sem cookie. Se este caso ficar vermelho, os de baixo estão " +
+        "primeira sem cookie de conta. Se este caso ficar vermelho, os de baixo estão " +
         "medindo a conta errada."
     ).toBe(CONTA);
   });
```

Em `testes-integracao/marcar-em-lote.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/marcar-em-lote.integracao.ts b/testes-integracao/marcar-em-lote.integracao.ts
index d4191a9..36edf36 100644
--- a/testes-integracao/marcar-em-lote.integracao.ts
+++ b/testes-integracao/marcar-em-lote.integracao.ts
@@ -25,7 +25,10 @@
 // chama `cookies()` de `next/headers`, que estoura fora de uma requisição.
 import { beforeAll, describe, expect, test } from "vitest";
 import { bancoDescartavel } from "./harness";
-import { comoNumaRequisicao, comoNumaRequisicaoComSessao } from "./semear-requisicao";
+// A CONTA ESCOLHIDA E AS TELAS DE CONTA RODAM COM A SESSÃO DE TESTE (administrador, que vê todas): desde
+// as contas por login (docs/specs/2026-11-05-contas-por-login.md), sem login não há conta escolhida
+// (lib/account.ts). O cookie de conta continua ausente, e o tombo para a primeira conta continua valendo.
+import { comoNumaRequisicaoComSessao } from "./semear-requisicao";
 
 type ModuloAcoes = typeof import("@/app/contatos/actions");
 type ModuloConta = typeof import("@/lib/account");
@@ -165,10 +168,10 @@ beforeAll(async () => {
   // criação um dia deixar de bastar (ou algo plantar um cookie sem querer), o
   // teste tem de morrer aqui, com nome, e não silenciosamente medir a conta
   // errada.
-  const { valor } = await comoNumaRequisicao("/contatos", () => conta.getSelectedAccountId());
+  const { valor } = await comoNumaRequisicaoComSessao("/contatos", () => conta.getSelectedAccountId());
   if (valor !== CONTA) {
     throw new Error(
-      `PRECONDIÇÃO QUEBRADA: sem cookie, \`getSelectedAccount\` devolveu ` +
+      `PRECONDIÇÃO QUEBRADA: com a sessão e sem cookie de conta, \`getSelectedAccount\` devolveu ` +
         `\`${String(valor)}\`, e este arquivo espera \`${CONTA}\` (a primeira conta ` +
         "criada). Sem isso, os casos abaixo mediriam a conta errada — ou nenhuma."
     );
```

Em `testes-integracao/nao-saiu.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/nao-saiu.integracao.ts b/testes-integracao/nao-saiu.integracao.ts
index 459ad3d..cad0528 100644
--- a/testes-integracao/nao-saiu.integracao.ts
+++ b/testes-integracao/nao-saiu.integracao.ts
@@ -52,7 +52,10 @@
 // nele que os demais casos devem medir.
 import { beforeAll, describe, expect, test } from "vitest";
 import { bancoDescartavel } from "./harness";
-import { comoNumaRequisicao } from "./semear-requisicao";
+// A CONTA ESCOLHIDA E AS TELAS DE CONTA RODAM COM A SESSÃO DE TESTE (administrador, que vê todas): desde
+// as contas por login (docs/specs/2026-11-05-contas-por-login.md), sem login não há conta escolhida
+// (lib/account.ts). O cookie de conta continua ausente, e o tombo para a primeira conta continua valendo.
+import { comoNumaRequisicaoComSessao } from "./semear-requisicao";
 import { textoDaArvore } from "./texto-da-arvore";
 
 type ModuloConta = typeof import("@/lib/account");
@@ -246,22 +249,22 @@ async function claimedAtDe(id: string): Promise<Date> {
 // ---------------------------------------------------------------------------
 
 async function arvoreDosAgendados(): Promise<string> {
-  const { valor } = await comoNumaRequisicao("/publicar", async () =>
+  const { valor } = await comoNumaRequisicaoComSessao("/publicar", async () =>
     textoDaArvore(await telaDosAgendados.default({ searchParams: Promise.resolve({}) }))
   );
   return valor;
 }
 
 async function arvoreDoPainel(): Promise<string> {
-  const { valor } = await comoNumaRequisicao("/", async () =>
+  const { valor } = await comoNumaRequisicaoComSessao("/", async () =>
     textoDaArvore(await telaDoPainel.default({ searchParams: Promise.resolve({}) }))
   );
   return valor;
 }
 
 describe("com a conta selecionada pelo tombo declarado (a primeira do schema)", () => {
-  test("a condição deste bloco é CONTA_A vir sem cookie nenhum — e ele confere isso antes de medir", async () => {
-    const { valor } = await comoNumaRequisicao("/publicar", () =>
+  test("a condição deste bloco é CONTA_A vir sem cookie de conta — e ele confere isso antes de medir", async () => {
+    const { valor } = await comoNumaRequisicaoComSessao("/publicar", () =>
       conta.getSelectedAccountId()
     );
     expect(valor).toBe(CONTA_A);
```

Em `testes-integracao/portas-de-publicar.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/portas-de-publicar.integracao.ts b/testes-integracao/portas-de-publicar.integracao.ts
index f0f9a87..1d10b08 100644
--- a/testes-integracao/portas-de-publicar.integracao.ts
+++ b/testes-integracao/portas-de-publicar.integracao.ts
@@ -84,7 +84,10 @@
 // exercita o CORPO do Server Action, e não a fronteira de serialização do POST.
 import { beforeAll, describe, expect, test } from "vitest";
 import { bancoDescartavel } from "./harness";
-import { comoNumaRequisicao, comoNumaRequisicaoComSessao } from "./semear-requisicao";
+// A CONTA ESCOLHIDA E AS TELAS DE CONTA RODAM COM A SESSÃO DE TESTE (administrador, que vê todas): desde
+// as contas por login (docs/specs/2026-11-05-contas-por-login.md), sem login não há conta escolhida
+// (lib/account.ts). O cookie de conta continua ausente, e o tombo para a primeira conta continua valendo.
+import { comoNumaRequisicaoComSessao } from "./semear-requisicao";
 
 type ModuloAcoes = typeof import("@/app/automacoes/actions");
 
@@ -187,8 +190,8 @@ async function ativaNoBanco(id: string): Promise<boolean> {
 }
 
 describe("as duas portas de publicar, com o contexto de requisição semeado", () => {
-  test("a conta chega às portas sem cookie nenhum, pelo tombo declarado", async () => {
-    const { valor } = await comoNumaRequisicao("/automacoes", async () => {
+  test("a conta chega às portas sem cookie de conta, pelo tombo declarado", async () => {
+    const { valor } = await comoNumaRequisicaoComSessao("/automacoes", async () => {
       const conta = await import("@/lib/account");
       return conta.getSelectedAccountId();
     });
```

Em `testes-integracao/publicar-fala.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/publicar-fala.integracao.ts b/testes-integracao/publicar-fala.integracao.ts
index f69f5b2..41a3ffb 100644
--- a/testes-integracao/publicar-fala.integracao.ts
+++ b/testes-integracao/publicar-fala.integracao.ts
@@ -69,7 +69,10 @@ import {
 import type { AddressInfo } from "node:net";
 import { afterAll, beforeAll, describe, expect, test } from "vitest";
 import { bancoDescartavel } from "./harness";
-import { comoNumaRequisicao, comoNumaRequisicaoComSessao } from "./semear-requisicao";
+// A CONTA ESCOLHIDA E AS TELAS DE CONTA RODAM COM A SESSÃO DE TESTE (administrador, que vê todas): desde
+// as contas por login (docs/specs/2026-11-05-contas-por-login.md), sem login não há conta escolhida
+// (lib/account.ts). O cookie de conta continua ausente, e o tombo para a primeira conta continua valendo.
+import { comoNumaRequisicaoComSessao } from "./semear-requisicao";
 
 type ModuloAcoes = typeof import("@/app/publicar/actions");
 type ModuloIg = typeof import("@/lib/ig");
@@ -315,7 +318,7 @@ async function itensDaFila(conta_id: string): Promise<LinhaDaFila[]> {
 // ===========================================================================
 describe("a recusa de quem ainda não conectou conta nenhuma", () => {
   test("a condição deste bloco é o schema SEM conta — e ele confere isso antes de medir", async () => {
-    const { valor } = await comoNumaRequisicao("/publicar", () => conta.getSelectedAccountId());
+    const { valor } = await comoNumaRequisicaoComSessao("/publicar", () => conta.getSelectedAccountId());
     expect(valor).toBe(null);
   });
 
@@ -352,8 +355,8 @@ describe("com a conta selecionada pelo tombo declarado (a primeira do schema)",
     }
   });
 
-  test("a condição deste bloco é CONTA_A vir sem cookie nenhum — e ele confere isso antes de medir", async () => {
-    const { valor } = await comoNumaRequisicao("/publicar", () => conta.getSelectedAccountId());
+  test("a condição deste bloco é CONTA_A vir sem cookie de conta — e ele confere isso antes de medir", async () => {
+    const { valor } = await comoNumaRequisicaoComSessao("/publicar", () => conta.getSelectedAccountId());
     expect(valor).toBe(CONTA_A);
   });
 
```

Em `testes-integracao/pulso-do-inicio.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/pulso-do-inicio.integracao.ts b/testes-integracao/pulso-do-inicio.integracao.ts
index 21e4e82..b85b2ff 100644
--- a/testes-integracao/pulso-do-inicio.integracao.ts
+++ b/testes-integracao/pulso-do-inicio.integracao.ts
@@ -87,7 +87,10 @@
 // derruba este caso, esteja o instante semeado no passado ou no futuro.
 import { beforeAll, describe, expect, test } from "vitest";
 import { bancoDescartavel } from "./harness";
-import { comoNumaRequisicao } from "./semear-requisicao";
+// A CONTA ESCOLHIDA E AS TELAS DE CONTA RODAM COM A SESSÃO DE TESTE (administrador, que vê todas): desde
+// as contas por login (docs/specs/2026-11-05-contas-por-login.md), sem login não há conta escolhida
+// (lib/account.ts). O cookie de conta continua ausente, e o tombo para a primeira conta continua valendo.
+import { comoNumaRequisicaoComSessao } from "./semear-requisicao";
 import { textoDaArvore } from "./texto-da-arvore";
 
 type ModuloTelaDoPainel = typeof import("@/app/page");
@@ -185,7 +188,7 @@ async function limparAFila(): Promise<void> {
 }
 
 async function arvoreDoPainel(): Promise<string> {
-  const { valor } = await comoNumaRequisicao("/", async () =>
+  const { valor } = await comoNumaRequisicaoComSessao("/", async () =>
     textoDaArvore(await telaDoPainel.default({ searchParams: Promise.resolve({}) }))
   );
   return valor;
```

Em `testes-integracao/semear-requisicao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/semear-requisicao.ts b/testes-integracao/semear-requisicao.ts
index 37822e6..4fbb52f 100644
--- a/testes-integracao/semear-requisicao.ts
+++ b/testes-integracao/semear-requisicao.ts
@@ -41,9 +41,17 @@
 // cima dela desde sempre — não é brecha, não é atalho, e não é uma sessão
 // inventada. A conta do teste é a conta do teste por construção do schema.
 //
+// DESDE AS CONTAS POR LOGIN (docs/specs/2026-11-05-contas-por-login.md), o
+// tombo é a primeira conta QUE O LOGIN VÊ, e sem login não há conta nenhuma:
+// `getSelectedAccount` pergunta a `contaEscolhida` (lib/acesso.ts) com o login
+// da sessão. Por isso, a jarra vazia de `comoNumaRequisicao` mede o "sem
+// sessão", e quem mede a conta escolhida usa a variante com sessão (o login de
+// teste é administrador e vê todas) ou a do login comum, mais abaixo.
+//
 // Se algum dia alguém precisar de DUAS contas neste caminho, a saída NÃO é
 // forjar o cookie: é medir de novo. Forjar cookie de sessão é regra do dono, e
-// esta fundação existe sem quebrá-la.
+// esta fundação existe sem quebrá-la. O cookie da conta, quando um caso precisa
+// dele, é o que `selectAccount` emitiu (ver o bloco do login comum).
 //
 // -----------------------------------------------------------------------------
 // E QUANDO A AÇÃO EXIGE SESSÃO (26/10/2026, docs/specs/2026-10-26-sessao-conferida.md).
@@ -57,8 +65,9 @@
 // `comoNumaRequisicaoComSessao`, e ela também NÃO FORJA NADA. Ela entra pela ação
 // de entrar de verdade (app/entrar/actions.ts), com a SENHA DE TESTE abaixo, e
 // leva na requisição seguinte o cookie que essa ação emitiu. O cookie de conta
-// continua ausente, e o tombo para a primeira conta continua valendo. Decidido
-// pelo Eduardo pela caixa em 26/10/2026, com as condições da auditoria (achado 131).
+// continua ausente (a não ser que o caso peça o que `selectAccount` emitiu), e o
+// tombo para a primeira conta continua valendo. Decidido pelo Eduardo pela caixa
+// em 26/10/2026, com as condições da auditoria (achado 131).
 //
 // -----------------------------------------------------------------------------
 // A ORDEM É OBRIGATÓRIA, e é a armadilha que quase matou este caminho.
@@ -499,38 +508,67 @@ export async function comoNumaRequisicao<T>(
   return rodarNoContexto(rota, corpo);
 }
 
-// O cabeçalho `cookie` da sessão de teste, depois do primeiro login deste arquivo.
-let cookieDaSessaoDeTeste: string | null = null;
+// ---------------------------------------------------------------------------
+// O LOGIN COMUM DE TESTE (docs/specs/2026-11-05-contas-por-login.md, seções 2 e 3).
+//
+// DESDE AS CONTAS POR LOGIN, a conta escolhida depende de quem entrou: o
+// administrador vê todas, e o comum só as que recebeu (lib/acesso.ts). O login
+// de teste de cima é administrador; este é o outro lado. Ele nasce comum
+// (`administrador: false`), com a mesma senha de teste, e entra pela MESMA ação
+// de entrar de verdade. As contas dele são postas por `definirContasDoLogin`
+// (lib/logins-repositorio.ts) antes de cada uso, para cada caso dizer quais são
+// em vez de herdar as do vizinho.
+//
+// O COOKIE DA CONTA NUNCA É ESCRITO À MÃO, e é a regra do dono do topo deste
+// arquivo. Quando um caso precisa do comum com o cookie de uma conta que ele não
+// tem (o mesmo navegador, depois de outro login ter escolhido outra conta: a
+// spec, "O que fica de fora"), o valor é o que `selectAccount`
+// (app/account-actions.ts) EMITIU numa requisição do login de teste, que é
+// administrador e pode escolher qualquer conta, lido de `cookies()` depois da
+// chamada, como `entrarComo` lê o da sessão.
+export const EMAIL_DO_COMUM_DE_TESTE = "comum-de-teste@exemplo.invalid";
+
+type QuemEntra = { email: string; nome: string; administrador: boolean };
+
+// O LOGIN DE TESTE É ADMINISTRADOR, e diz isso: desde a 023 o padrão é comum
+// (docs/specs/2026-11-05-contas-por-login.md), e um login de teste comum, sem
+// contas, faria os casos de hoje medirem um painel vazio.
+const LOGIN_DE_TESTE: QuemEntra = { email: EMAIL_DE_TESTE, nome: "Login de teste", administrador: true };
+const COMUM_DE_TESTE: QuemEntra = { email: EMAIL_DO_COMUM_DE_TESTE, nome: "Comum de teste", administrador: false };
+
+// O cabeçalho `cookie` da sessão de cada login de teste, depois do primeiro login dele neste arquivo.
+const cookiesDasSessoes = new Map<string, string>();
+
+/** O valor de um `nome=valor` de cookie, sem o nome. */
+const valorDoCookie = (cabecalho: string) => cabecalho.slice(cabecalho.indexOf("=") + 1);
 
 /**
- * Entra pela AÇÃO DE ENTRAR DE VERDADE, com o login de teste, e devolve o
+ * Entra pela AÇÃO DE ENTRAR DE VERDADE, com um login de teste, e devolve o
  * cabeçalho `cookie` com o que ela emitiu. Não monta sessão nenhuma à mão: o
- * login de teste é criado no schema descartável (se ainda não existir), e a
- * sessão sai da ação.
+ * login é criado no schema descartável (se ainda não existir), e a sessão sai
+ * da ação.
  *
  * Duas conferências antes de devolver, e as duas estouram sem imprimir o cookie:
  * o login mandou para "/" (o caminho do sucesso, e não só "gravou algo"), e a
  * sessão foi gravada no schema descartável (ver o topo deste arquivo).
  */
-async function entrarDeVerdade(): Promise<string> {
+async function entrarComo(quem: QuemEntra): Promise<string> {
   const { SESSION_COOKIE } = await import("@/lib/auth");
   const { sessaoPorCodigo, criarLogin } = await import("@/lib/logins-repositorio");
   // A SESSÃO GUARDADA AINDA VALE? Um caso que apagou as sessões ou os logins a derrubou.
-  if (cookieDaSessaoDeTeste && (await sessaoPorCodigo(cookieDaSessaoDeTeste.split("=")[1]))) {
-    return cookieDaSessaoDeTeste;
+  const guardada = cookiesDasSessoes.get(quem.email);
+  if (guardada && (await sessaoPorCodigo(valorDoCookie(guardada)))) {
+    return guardada;
   }
   const { hashDaSenha } = await import("@/lib/logins");
   const { sql } = await import("@/lib/db");
-  const [existe] = (await sql().query(`select id from logins where email = $1`, [EMAIL_DE_TESTE])) as unknown[];
+  const [existe] = (await sql().query(`select id from logins where email = $1`, [quem.email])) as unknown[];
   if (!existe) {
-    // O LOGIN DE TESTE É ADMINISTRADOR, e diz isso: desde a 023 o padrão é comum
-    // (docs/specs/2026-11-05-contas-por-login.md), e um login de teste comum, sem contas, faria os casos de
-    // hoje medirem um painel vazio.
     const r = await criarLogin({
-      email: EMAIL_DE_TESTE,
-      nome: "Login de teste",
+      email: quem.email,
+      nome: quem.nome,
       senhaHash: await hashDaSenha(SENHA_DE_TESTE),
-      administrador: true,
+      administrador: quem.administrador,
     });
     if ("erro" in r) throw new Error(`O LOGIN DE TESTE NÃO NASCEU: ${r.erro}`);
   }
@@ -539,7 +577,7 @@ async function entrarDeVerdade(): Promise<string> {
 
   const { valor } = await rodarNoContexto("/entrar", async () => {
     const form = new FormData();
-    form.set("email", EMAIL_DE_TESTE);
+    form.set("email", quem.email);
     form.set("password", SENHA_DE_TESTE);
     let digest: string | null = null;
     try {
@@ -571,21 +609,101 @@ async function entrarDeVerdade(): Promise<string> {
         "impresso). Sem isso, a variante com sessão mediria uma sessão de outro lugar."
     );
   }
-  cookieDaSessaoDeTeste = `${SESSION_COOKIE}=${valor.cookie}`;
-  return cookieDaSessaoDeTeste;
+  const cabecalho = `${SESSION_COOKIE}=${valor.cookie}`;
+  cookiesDasSessoes.set(quem.email, cabecalho);
+  return cabecalho;
+}
+
+/** A sessão do login de teste, que é administrador. */
+function entrarDeVerdade(): Promise<string> {
+  return entrarComo(LOGIN_DE_TESTE);
+}
+
+/**
+ * O `metodochat_account=<id>` que `selectAccount` EMITIU numa requisição do login de teste (administrador),
+ * lido de `cookies()` depois da chamada. A conferência estoura se a action não emitiu a conta pedida: sem
+ * ela, um caso "com o cookie da conta X" mediria um navegador sem cookie nenhum.
+ */
+async function cookieDaContaEmitido(contaId: string): Promise<string> {
+  const { ACCOUNT_COOKIE } = await import("@/lib/account");
+  const { selectAccount } = await import("@/app/account-actions");
+  const { cookies } = await import("next/headers");
+  const sessao = await entrarDeVerdade();
+  const { valor } = await rodarNoContexto(
+    "/",
+    async () => {
+      const form = new FormData();
+      form.set("account_id", contaId);
+      await selectAccount(form);
+      return (await cookies()).get(ACCOUNT_COOKIE)?.value ?? null;
+    },
+    { cookie: sessao }
+  );
+  if (valor !== contaId) {
+    throw new Error(
+      `O COOKIE DA CONTA NÃO FOI EMITIDO: \`selectAccount\` do login de teste (administrador) devia gravar ` +
+        `a conta pedida, e ${valor === null ? "não gravou nada" : "gravou outra"}. Sem ele, o caso mediria ` +
+        "um navegador sem o cookie da conta."
+    );
+  }
+  return `${ACCOUNT_COOKIE}=${valor}`;
 }
 
 /**
  * Como `comoNumaRequisicao`, mas com a sessão que a ação de entrar emitiu para o
  * login de teste. É para medir o CORPO de uma Server Action que começa por
  * `await exigirSessao()`; o "sem sessão" se mede com `comoNumaRequisicao`.
+ *
+ * `contaDoCookie`, se pedido, leva junto o cookie da conta que `selectAccount`
+ * emitiu para essa conta (ver o bloco do login comum, acima).
  */
 export async function comoNumaRequisicaoComSessao<T>(
   rota: string,
-  corpo: () => Promise<T>
+  corpo: () => Promise<T>,
+  opcoes: { contaDoCookie?: string } = {}
 ): Promise<DentroDaRequisicao<T>> {
   await provarOEfeito();
-  const cookie = await entrarDeVerdade();
+  const sessao = await entrarDeVerdade();
+  const cookie =
+    opcoes.contaDoCookie === undefined ? sessao : `${sessao}; ${await cookieDaContaEmitido(opcoes.contaDoCookie)}`;
+  return rodarNoContexto(rota, corpo, { cookie });
+}
+
+/**
+ * O cabeçalho `cookie` do login COMUM de teste, ligado só às `contas` (por `definirContasDoLogin`, a cada
+ * chamada), e com o cookie da conta que `selectAccount` emitiu, se `contaDoCookie` for pedido. Serve às
+ * rotas que leem `req.cookies` direto do pedido. O valor não deve ser impresso.
+ */
+export async function cabecalhoDoComumDeTeste(contas: string[], contaDoCookie?: string): Promise<string> {
+  const sessao = await entrarComo(COMUM_DE_TESTE);
+  const { sessaoDoCookie } = await import("@/lib/sessao");
+  const quem = await sessaoDoCookie(valorDoCookie(sessao));
+  // O COMUM TEM DE SER COMUM: um caso que o promovesse e não o devolvesse faria os vizinhos medirem um
+  // administrador com o nome do comum.
+  if (!quem || quem.email !== EMAIL_DO_COMUM_DE_TESTE || quem.administrador) {
+    throw new Error(
+      "O LOGIN COMUM DE TESTE NÃO É COMUM: a sessão emitida para ele não é de um login comum ativo. " +
+        "Sem isso, os casos do login comum mediriam outro papel."
+    );
+  }
+  const { definirContasDoLogin } = await import("@/lib/logins-repositorio");
+  const r = await definirContasDoLogin(quem.id, contas);
+  if (r !== "ok") throw new Error(`AS CONTAS DO LOGIN COMUM DE TESTE NÃO FORAM POSTAS: ${r}`);
+  if (contaDoCookie === undefined) return sessao;
+  return `${sessao}; ${await cookieDaContaEmitido(contaDoCookie)}`;
+}
+
+/**
+ * Como `comoNumaRequisicaoComSessao`, mas com o login COMUM de teste: ligado só às `contas`, e com o cookie
+ * da conta `contaDoCookie` (o que `selectAccount` emitiu para o administrador), se pedido.
+ */
+export async function comoNumaRequisicaoComoComum<T>(
+  rota: string,
+  corpo: () => Promise<T>,
+  opcoes: { contas: string[]; contaDoCookie?: string }
+): Promise<DentroDaRequisicao<T>> {
+  await provarOEfeito();
+  const cookie = await cabecalhoDoComumDeTeste(opcoes.contas, opcoes.contaDoCookie);
   return rodarNoContexto(rota, corpo, { cookie });
 }
 
```

Em `tests/event-query.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/event-query.test.ts b/tests/event-query.test.ts
index dfbfc29..465e5d3 100644
--- a/tests/event-query.test.ts
+++ b/tests/event-query.test.ts
@@ -1,5 +1,5 @@
 import { describe, it, expect } from "vitest";
-import { buildWhere } from "@/lib/event-query";
+import { buildWhere, postsComEventos } from "@/lib/event-query";
 import { NO_FILTERS, type EventFilters } from "@/lib/event-filters";
 
 const filtros = (p: Partial<EventFilters> = {}): EventFilters => ({ ...NO_FILTERS, ...p });
@@ -21,6 +21,47 @@ describe("isolamento por conta", () => {
   });
 });
 
+// OS EVENTOS SEM CONTA SÓ PARA O ADMINISTRADOR (docs/specs/2026-11-05-contas-por-login.md, seção 3). Quando
+// um webhook dá erro, o corpo inteiro é gravado sem conta (`account_id` nulo), com a DM ou o comentário de
+// qualquer conta dentro. O terceiro parâmetro diz se eles entram: a Atividade do login comum passa `false`.
+describe("os eventos sem conta", () => {
+  it("com false, o primeiro termo é só a conta, e o `is null` sai", () => {
+    const w = buildWhere("conta-1", filtros(), false);
+    expect(w.sql).toContain("(e.account_id = $1)");
+    expect(w.sql).not.toContain("is null");
+    expect(w.params).toEqual(["conta-1"]);
+  });
+
+  it("com false e um filtro ao lado, a conta continua entre parênteses e os parâmetros na mesma ordem", () => {
+    const w = buildWhere("conta-1", filtros({ type: "comment" }), false);
+    expect(w.sql.startsWith("(e.account_id = $1)\n")).toBe(true);
+    expect(w.sql).toContain("e.type = $2");
+    expect(w.sql).not.toContain("is null");
+    expect(w.params).toEqual(["conta-1", "comment"]);
+  });
+
+  it("o padrão é o de hoje: a conta e os sem conta, igual a passar true", () => {
+    const padrao = buildWhere("conta-1", filtros({ q: "oi" }));
+    expect(padrao.sql).toContain("(e.account_id = $1 or e.account_id is null)");
+    expect(buildWhere("conta-1", filtros({ q: "oi" }), true)).toEqual(padrao);
+  });
+
+  // O SELETOR DE POSTS DA ATIVIDADE SEGUE A MESMA REGRA: um evento sem conta com `media` ofereceria ao comum
+  // o post de outra conta, e a contagem dele.
+  it("postsComEventos com false: só a conta, e o `is null` sai", () => {
+    const w = postsComEventos("conta-1", 12, false);
+    expect(w.sql).toContain("where (e.account_id = $1)");
+    expect(w.sql).not.toContain("e.account_id is null");
+    expect(w.params).toEqual(["conta-1"]);
+  });
+
+  it("postsComEventos no padrão é o de hoje: a conta e os sem conta, igual a passar true", () => {
+    const padrao = postsComEventos("conta-1", 12);
+    expect(padrao.sql).toContain("where (e.account_id = $1 or e.account_id is null)");
+    expect(postsComEventos("conta-1", 12, true)).toEqual(padrao);
+  });
+});
+
 describe("filtros viram parâmetro, nunca texto colado no SQL", () => {
   it("tipo entra como $2", () => {
     const w = buildWhere("conta-1", filtros({ type: "comment" }));
```

Em `tests/layout-contas.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/layout-contas.test.ts b/tests/layout-contas.test.ts
index b788c8c..63cd3d4 100644
--- a/tests/layout-contas.test.ts
+++ b/tests/layout-contas.test.ts
@@ -7,9 +7,13 @@ import { describe, expect, it } from "vitest";
 //
 // O layout raiz roda em toda página, inclusive nas públicas (/entrar, /privacidade e
 // /exclusao-de-dados), e passa a lista ao AppShell, que é componente de cliente: o que ele recebe vai no
-// corpo da resposta. Este caso exige que a chamada a `listAccounts(` fique dentro de um `if` que confere
+// corpo da resposta. Este caso exige que a chamada que monta a lista fique dentro de um `if` que confere
 // a sessão, no ramo verdadeiro dele. Desde os logins (docs/specs/2026-11-04-logins.md), a conferência é
 // `if (login)`, com `login` declarado como `await sessaoAtual()` (lib/sessao.ts), a sessão do banco.
+//
+// DESDE AS CONTAS POR LOGIN (docs/specs/2026-11-05-contas-por-login.md, seção 2), a lista é a do login:
+// `contasDoLogin(login)` (lib/acesso.ts, o único lugar que sabe quem vê qual conta). O layout não chama
+// mais `listAccounts(` nenhuma vez: com ela de volta, o seletor do login comum mostraria todas as contas.
 
 const RAIZ = fileURLToPath(new URL("..", import.meta.url));
 
@@ -38,12 +42,12 @@ function nomesDaSessao(sf: ts.SourceFile): Set<string> {
   return nomes;
 }
 
-/** Cada chamada a `listAccounts(` e se ela está no ramo verdadeiro de um `if (<o login da sessão>)`. */
-function chamadasGuardadas(sf: ts.SourceFile): boolean[] {
+/** Cada chamada a `<funcao>(` e se ela está no ramo verdadeiro de um `if (<o login da sessão>)`. */
+function chamadasGuardadas(sf: ts.SourceFile, funcao: string): boolean[] {
   const daSessao = nomesDaSessao(sf);
   const saida: boolean[] = [];
   const visitar = (n: ts.Node) => {
-    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "listAccounts") {
+    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === funcao) {
       let filho: ts.Node = n;
       let guardada = false;
       for (let pai = n.parent; pai; filho = pai, pai = pai.parent) {
@@ -67,33 +71,38 @@ function chamadasGuardadas(sf: ts.SourceFile): boolean[] {
 
 describe("o layout raiz e a lista de contas", () => {
   it("o leitor acusa quando há o que acusar", () => {
-    expect(chamadasGuardadas(analisar("async function f() { const a = await listAccounts(); }"))).toEqual([false]);
+    const c = (fonte: string, funcao = "contasDoLogin") => chamadasGuardadas(analisar(fonte), funcao);
+    expect(c("async function f() { const a = await contasDoLogin(login); }")).toEqual([false]);
     expect(
-      chamadasGuardadas(
-        analisar("async function f() { const login = await sessaoAtual(); if (login) { const a = await listAccounts(); } }")
-      )
+      c("async function f() { const login = await sessaoAtual(); if (login) { const a = await contasDoLogin(login); } }")
     ).toEqual([true]);
     expect(
-      chamadasGuardadas(
-        analisar(
-          "async function f() { const login = await sessaoAtual(); if (login) { t(); } else { const a = await listAccounts(); } }"
-        )
+      c(
+        "async function f() { const login = await sessaoAtual(); if (login) { t(); } else { const a = await contasDoLogin(login); } }"
       )
     ).toEqual([false]);
     // Um `if` sobre outro nome não é a sessão.
-    expect(
-      chamadasGuardadas(analisar("async function f() { const x = await outra(); if (x) { const a = await listAccounts(); } }"))
-    ).toEqual([false]);
+    expect(c("async function f() { const x = await outra(); if (x) { const a = await contasDoLogin(x); } }")).toEqual([
+      false,
+    ]);
     // O nome antigo não vale mais.
+    expect(c("async function f() { if (isValidSession(x)) { const a = await contasDoLogin(x); } }")).toEqual([false]);
+    // E A `listAccounts(` É ACHADA ONDE ESTIVER, guardada ou não: o caso de baixo exige que não haja nenhuma.
     expect(
-      chamadasGuardadas(analisar("async function f() { if (isValidSession(x)) { const a = await listAccounts(); } }"))
-    ).toEqual([false]);
+      c("async function f() { const login = await sessaoAtual(); if (login) { const a = await listAccounts(); } }", "listAccounts")
+    ).toEqual([true]);
+    expect(c("async function f() { const a = await listAccounts(); }", "listAccounts")).toEqual([false]);
   });
 
-  it("app/layout.tsx só chama listAccounts() com a sessão conferida", () => {
+  it("app/layout.tsx só chama contasDoLogin() com a sessão conferida", () => {
     const sf = analisar(readFileSync(`${RAIZ}/app/layout.tsx`, "utf8"));
-    const chamadas = chamadasGuardadas(sf);
+    const chamadas = chamadasGuardadas(sf, "contasDoLogin");
     expect(chamadas.length).toBeGreaterThan(0);
     expect(chamadas).toEqual(chamadas.map(() => true));
   });
+
+  it("app/layout.tsx não chama listAccounts(): o seletor mostra só as contas do login", () => {
+    const sf = analisar(readFileSync(`${RAIZ}/app/layout.tsx`, "utf8"));
+    expect(chamadasGuardadas(sf, "listAccounts")).toEqual([]);
+  });
 });
```

- [ ] **Passo 2: ver os testes falharem**

```bash
env -u CLAUDECODE -u AI_AGENT npx vitest run tests/event-query.test.ts tests/layout-contas.test.ts
env -u CLAUDECODE -u AI_AGENT npx vitest run --config vitest.dom.config.ts testes-dom/menu-do-login-comum.dom.tsx
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/acoes-que-falam.integracao.ts testes-integracao/agendados.integracao.ts testes-integracao/capa-do-post.integracao.ts testes-integracao/chave-fora-da-pagina.integracao.ts testes-integracao/contas-por-login.integracao.ts testes-integracao/desempenho.integracao.ts testes-integracao/ficha-da-conversa.integracao.ts testes-integracao/marcar-em-lote.integracao.ts testes-integracao/nao-saiu.integracao.ts testes-integracao/portas-de-publicar.integracao.ts testes-integracao/publicar-fala.integracao.ts testes-integracao/pulso-do-inicio.integracao.ts
```

Esperado: puros: 2 arquivos falhando, com 5 casos caindo e 19 passando; tela: 1 arquivo falhando, com 3 casos caindo e 3 passando; integração: 1 arquivo falhando e 11 passando, com 17 casos caindo e 135 passando. Cai porque `@/lib/acesso` não existe; com o cookie da B, o comum ainda tem a B; a Configuração e o OAuth ainda aceitam o comum; o CSV traz a B; a Atividade traz os eventos sem conta; o menu do comum ainda tem a Configuração e o Conectar.

- [ ] **Passo 3: o código**

Em `app/account-actions.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/account-actions.ts b/app/account-actions.ts
index c317118..a743d3b 100644
--- a/app/account-actions.ts
+++ b/app/account-actions.ts
@@ -2,12 +2,15 @@
 import { cookies } from "next/headers";
 import { revalidatePath } from "next/cache";
 import { ACCOUNT_COOKIE } from "@/lib/account";
+import { podeVerConta } from "@/lib/acesso";
 import { exigirSessao } from "@/lib/exigir-sessao";
+import { sessaoAtual } from "@/lib/sessao";
 
 // Troca a conta ativa do painel (server action chamada pelo seletor).
 export async function selectAccount(formData: FormData): Promise<void> {
   await exigirSessao();
   const id = String(formData.get("account_id") ?? "");
+  const login = await sessaoAtual();
   // ESTE `return;` FICA MUDO DE PROPÓSITO, e não é o esquecimento que o resto
   // desta branch existe para fechar. Duas razões, e as duas precisam ser
   // verdade juntas:
@@ -16,21 +19,29 @@ export async function selectAccount(formData: FormData): Promise<void> {
   //      seletor de conta é um MENU DE BOTÕES (`app/account-switcher.tsx`),
   //      montado por `accounts.map`: cada botão chama `selectAccount` com um
   //      `FormData` cujo `account_id` sai de `a.ig_user_id`, nunca de campo
-  //      livre — não há caminho na UI para submeter isto vazio. Só chega aqui
-  //      vazio por um POST montado à mão, e nesse caso não há "conta que o
-  //      dono queria" para relatar: nenhuma escolha foi feita.
+  //      livre — e, desde as contas por login
+  //      (docs/specs/2026-11-05-contas-por-login.md, seção 2), `accounts` é a
+  //      lista de `contasDoLogin` (app/layout.tsx): O SELETOR SÓ MOSTRA AS
+  //      CONTAS DO LOGIN. Não há caminho na UI para submeter isto vazio, nem com
+  //      uma conta que o login não vê (`podeVerConta`, lib/acesso.ts). Os dois só
+  //      chegam aqui por um POST montado à mão, e nesse caso não há "conta que o
+  //      dono queria" para relatar: nenhuma escolha do seletor foi feita.
   //
   //      (Aqui se lia "um `<select>` cujas opções são as próprias contas". O
   //      argumento estava certo e o widget, errado — e uma varredura futura
   //      procuraria um `<select>` que não existe.)
   //   2. QUANDO A CONTA TROCA DE VERDADE, O RESULTADO JÁ É VISÍVEL — a conta
   //      muda na tela (o `revalidatePath` abaixo cuida disso). Um aviso aqui
-  //      só teria trabalho a fazer no caminho vazio, que é justamente o
-  //      caminho inatingível pela UI.
+  //      só teria trabalho a fazer nos caminhos recusados, que são justamente
+  //      os inatingíveis pela UI.
+  //
+  // E A RECUSA NÃO GRAVA NADA: um cookie de conta que o login não vê seria
+  // ignorado pela conta escolhida de qualquer jeito (`contaEscolhida`), mas
+  // gravá-lo deixaria no navegador uma escolha que ninguém fez.
   //
   // Este comentário existe para a próxima varredura não tratar este `return;`
   // como um dos mudos desta branch.
-  if (!id) return;
+  if (!id || !login || !(await podeVerConta(login, id))) return;
   (await cookies()).set(ACCOUNT_COOKIE, id, {
     httpOnly: true,
     sameSite: "lax",
```

Em `app/account-switcher.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/account-switcher.tsx b/app/account-switcher.tsx
index 86f6b66..abb160e 100644
--- a/app/account-switcher.tsx
+++ b/app/account-switcher.tsx
@@ -13,12 +13,20 @@ export type SwitcherAccount = {
 
 // Seletor de conta na base da sidebar. Sem conta conectada, vira um atalho
 // direto para a configuração.
+//
+// CONECTAR CONTA É DO ADMINISTRADOR (docs/specs/2026-11-05-contas-por-login.md,
+// seção 3): o "+ Conectar outra conta" e o atalho "Conectar Instagram" só
+// aparecem com `podeConectar`. O login comum sem contas não vê atalho nenhum.
+// Esconder é conforto: quem confere é o `/api/oauth/login` e a Configuração,
+// no servidor.
 export default function AccountSwitcher({
   accounts,
   selectedId,
+  podeConectar,
 }: {
   accounts: SwitcherAccount[];
   selectedId: string | null;
+  podeConectar: boolean;
 }) {
   const [open, setOpen] = useState(false);
   // A troca envolve uma ida ao servidor (cookie + recarregar os dados da nova
@@ -29,6 +37,7 @@ export default function AccountSwitcher({
   const [optimisticId, setOptimisticId] = useOptimistic(selectedId);
 
   if (!accounts.length) {
+    if (!podeConectar) return null;
     return (
       <Link
         href="/setup"
@@ -89,14 +98,16 @@ export default function AccountSwitcher({
               </li>
             ))}
           </ul>
-          <div className="border-t border-zinc-200 dark:border-zinc-800">
-            <a
-              href="/api/oauth/login"
-              className="block px-3 py-2 text-sm text-tinta transition-colors hover:bg-traco/40 dark:text-tinta-escuro dark:hover:bg-traco-escuro/60"
-            >
-              + Conectar outra conta
-            </a>
-          </div>
+          {podeConectar && (
+            <div className="border-t border-zinc-200 dark:border-zinc-800">
+              <a
+                href="/api/oauth/login"
+                className="block px-3 py-2 text-sm text-tinta transition-colors hover:bg-traco/40 dark:text-tinta-escuro dark:hover:bg-traco-escuro/60"
+              >
+                + Conectar outra conta
+              </a>
+            </div>
+          )}
         </div>
       )}
 
```

Em `app/api/oauth/login/route.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/api/oauth/login/route.ts b/app/api/oauth/login/route.ts
index 4495c77..1423912 100644
--- a/app/api/oauth/login/route.ts
+++ b/app/api/oauth/login/route.ts
@@ -15,9 +15,16 @@ export async function GET(req: NextRequest) {
   // A CONEXÃO SÓ COMEÇA COM A SESSÃO DO PAINEL. `/api/oauth` está na PUBLIC_PREFIXES do proxy.ts (a volta
   // do Instagram tem de passar), então quem confere é esta rota. Sem sessão, nenhum state é entregue
   // (docs/specs/2026-10-27-cron-e-oauth.md).
-  if (!(await sessaoDoCookie(req.cookies.get(SESSION_COOKIE)?.value))) {
+  const login = await sessaoDoCookie(req.cookies.get(SESSION_COOKIE)?.value);
+  if (!login) {
     return NextResponse.redirect(`${req.nextUrl.origin}/entrar`);
   }
+  // E SÓ O ADMINISTRADOR CONECTA CONTA (docs/specs/2026-11-05-contas-por-login.md, seção 3). O login comum
+  // volta para o início antes de qualquer state: sem ele, a volta do OAuth (`/api/oauth/callback`) recusa,
+  // e uma conta nova só nasce do começo de um administrador ou de um convite, que só ele gera.
+  if (!login.administrador) {
+    return NextResponse.redirect(`${req.nextUrl.origin}/`);
+  }
   const config = await getConfig();
   if (!config.instagram_app_id) {
     return NextResponse.redirect(
```

Em `app/app-shell.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/app-shell.tsx b/app/app-shell.tsx
index 7dbf617..5304e19 100644
--- a/app/app-shell.tsx
+++ b/app/app-shell.tsx
@@ -55,21 +55,24 @@ const NAV_GROUPS: {
   },
   {
     label: "Sistema",
-    items: [
-      { href: "/produtos", label: "Produtos", icon: IconStore },
-      { href: "/setup", label: "Configuração", icon: IconSettings },
-    ],
+    items: [{ href: "/produtos", label: "Produtos", icon: IconStore }],
   },
 ];
 
-// O ITEM DOS LOGINS, SÓ PARA ADMINISTRADOR (docs/specs/2026-11-04-logins.md,
-// seção 4). Esconder o item é conforto: quem confere é a página e as actions
-// dela, no servidor.
-const ITEM_DOS_LOGINS = { href: "/logins", label: "Logins", icon: IconPessoa };
+// OS ITENS DA CONFIGURAÇÃO E DOS LOGINS, SÓ PARA ADMINISTRADOR
+// (docs/specs/2026-11-04-logins.md, seção 4, e docs/specs/2026-11-05-contas-por-login.md,
+// seção 3: o login comum faz tudo nas contas dele, menos a Configuração e os
+// logins). Esconder o item é conforto: quem confere é a página e as actions de
+// cada um, no servidor. A ordem do grupo Sistema do administrador é a de antes:
+// Produtos, Configuração e Logins.
+const ITENS_DO_ADMINISTRADOR = [
+  { href: "/setup", label: "Configuração", icon: IconSettings },
+  { href: "/logins", label: "Logins", icon: IconPessoa },
+];
 
 function gruposDoMenu(administrador: boolean) {
   if (!administrador) return NAV_GROUPS;
-  return NAV_GROUPS.map((g) => (g.label === "Sistema" ? { ...g, items: [...g.items, ITEM_DOS_LOGINS] } : g));
+  return NAV_GROUPS.map((g) => (g.label === "Sistema" ? { ...g, items: [...g.items, ...ITENS_DO_ADMINISTRADOR] } : g));
 }
 
 /** O login da sessão, como o menu precisa dele: o nome e se é administrador. */
@@ -233,7 +236,11 @@ function SidebarBody({
       </div>
       <div className="space-y-1 px-2">
         <div className="mb-2 border-t border-zinc-200/70 pt-2 dark:border-zinc-800/70">
-          <AccountSwitcher accounts={accounts} selectedId={selectedId} />
+          <AccountSwitcher
+            accounts={accounts}
+            selectedId={selectedId}
+            podeConectar={login?.administrador ?? false}
+          />
         </div>
         {login && <LoginNoRodape login={login} sair={sair} onNavigate={onNavigate} />}
         <ThemeToggle />
```

Em `app/eventos/page.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/eventos/page.tsx b/app/eventos/page.tsx
index 37c43d8..57ca4e4 100644
--- a/app/eventos/page.tsx
+++ b/app/eventos/page.tsx
@@ -1,5 +1,6 @@
 import { sql, QueueItem } from "@/lib/db";
 import { getSelectedAccount } from "@/lib/account";
+import { sessaoAtual } from "@/lib/sessao";
 import { fmtDate } from "@/lib/format";
 import { card, muted, tableWrap, thead, rowDivide, btnGhost } from "../ui";
 import {
@@ -72,6 +73,12 @@ export default async function EventosPage({
   searchParams: Promise<Record<string, string | string[] | undefined>>;
 }) {
   const account = await getSelectedAccount();
+  // OS EVENTOS SEM CONTA SÓ PARA O ADMINISTRADOR (docs/specs/2026-11-05-contas-por-login.md, seção 3): o
+  // corpo de um webhook que deu erro é gravado sem conta e pode ser de qualquer conta (ver `buildWhere`).
+  // O papel vai às duas consultas que leem eventos: a lista e o seletor de posts. Sem login não há conta
+  // escolhida, e o `false` é só o lado seguro do tipo.
+  const login = await sessaoAtual();
+  const comEventosSemConta = login?.administrador ?? false;
   const params = await searchParams;
   const filtros = parseFilters(params);
   // QUANTOS EVENTOS ESTA PÁGINA TRAZ. Ele vem da barra de endereço e NÃO de
@@ -81,10 +88,10 @@ export default async function EventosPage({
   // muda.
   const quantos = quantosEventos(params.ver);
   const envios = parseEnvioFilters(params);
-  const where = account ? buildWhere(account.ig_user_id, filtros) : null;
+  const where = account ? buildWhere(account.ig_user_id, filtros, comEventosSemConta) : null;
   const whereEnvios = account ? buildEnviosWhere(account.ig_user_id, envios) : null;
   const situacoes = whereEnvios ? contagemPorSituacao(whereEnvios) : null;
-  const opcoes = account ? postsComEventos(account.ig_user_id, POSTS_NO_SELETOR) : null;
+  const opcoes = account ? postsComEventos(account.ig_user_id, POSTS_NO_SELETOR, comEventosSemConta) : null;
 
   // Junta com contatos para mostrar QUEM é a pessoa, não o número dela.
   // As cinco consultas são independentes — em paralelo para não empilhar
```

Em `app/layout.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/layout.tsx b/app/layout.tsx
index b1760c6..3c8445c 100644
--- a/app/layout.tsx
+++ b/app/layout.tsx
@@ -6,8 +6,9 @@ import "./globals.css";
 import AppShell, { type LoginDoMenu } from "./app-shell";
 import { sair } from "./minha-conta/actions";
 import { SwitcherAccount } from "./account-switcher";
-import { listAccounts } from "@/lib/db";
 import { ACCOUNT_COOKIE } from "@/lib/account";
+import { contasDoLogin } from "@/lib/acesso";
+import { escolherConta } from "@/lib/acesso-escolha";
 import { sessaoAtual } from "@/lib/sessao";
 
 // AS TRÊS FAMÍLIAS. A Sora saiu: não por ser ruim, mas por ser a fonte que
@@ -81,26 +82,28 @@ export default async function RootLayout({ children }: { children: React.ReactNo
   // Sem sessão, ela sai vazia (docs/specs/2026-10-26-sessao-conferida.md;
   // tests/layout-contas.test.ts). Desde os logins, a sessão é a do banco
   // (lib/sessao.ts, docs/specs/2026-11-04-logins.md).
+  //
+  // A LISTA É A DO LOGIN, e a escolha também (docs/specs/2026-11-05-contas-por-login.md, seção 2): o seletor
+  // mostra só as contas que ele vê (`contasDoLogin`, lib/acesso.ts), e o cookie só desempata entre elas
+  // (`escolherConta`, a mesma escolha pura da conta escolhida). Antes, este layout refazia a escolha à mão
+  // sobre todas as contas.
   let accounts: SwitcherAccount[] = [];
   let selectedId: string | null = null;
-  // O NOME E O MARCADOR DE ADMINISTRADOR vão ao menu (o item Logins e a Minha
-  // conta); o id, o e-mail e o id da sessão ficam no servidor.
+  // O NOME E O MARCADOR DE ADMINISTRADOR vão ao menu (os itens Configuração e
+  // Logins, o conectar conta do seletor e a Minha conta); o id, o e-mail e o id
+  // da sessão ficam no servidor.
   let doMenu: LoginDoMenu | null = null;
   try {
     const jarra = await cookies();
     const login = await sessaoAtual();
     if (login) {
       doMenu = { nome: login.nome, administrador: login.administrador };
-      accounts = (await listAccounts()).map((a) => ({
+      accounts = (await contasDoLogin(login)).map((a) => ({
         ig_user_id: a.ig_user_id,
         username: a.username,
         profile_picture_url: a.profile_picture_url,
       }));
-      const cookieId = jarra.get(ACCOUNT_COOKIE)?.value;
-      selectedId =
-        accounts.find((a) => a.ig_user_id === cookieId)?.ig_user_id ??
-        accounts[0]?.ig_user_id ??
-        null;
+      selectedId = escolherConta(accounts, jarra.get(ACCOUNT_COOKIE)?.value)?.ig_user_id ?? null;
     }
   } catch {
     // banco indisponível: segue sem contas
```

Em `app/setup/actions.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/setup/actions.ts b/app/setup/actions.ts
index ff3edc4..13d857e 100644
--- a/app/setup/actions.ts
+++ b/app/setup/actions.ts
@@ -17,6 +17,11 @@ import { exigirAdministrador, exigirSessao } from "@/lib/exigir-sessao";
 import { FRASE_DO_PARA_QUEM_INVALIDO, paraQuemDoFormulario, type EstadoDoGerar } from "@/lib/convites";
 import { cancelarConvite as cancelarNoBanco, criarConvite } from "@/lib/convites-repositorio";
 
+// TODA ACTION DESTE ARQUIVO É DO ADMINISTRADOR (docs/specs/2026-11-05-contas-por-login.md, seção 3: o login
+// comum faz tudo nas contas dele, menos a Configuração e os logins). Cada uma chama `exigirAdministrador`
+// logo DEPOIS do `await exigirSessao();`, que continua a primeira instrução (tests/sessao-nas-actions.test.ts
+// cobra). Os pontos que leem todas as contas, como `reassinarWebhooks`, ficam assim só ao alcance dele.
+
 // Reassina `CAMPOS_DE_WEBHOOK` (lib/ig.ts) em todas as contas conectadas. A
 // assinatura já acontece sozinha no OAuth, mas se falhar naquele momento nada
 // chega e o painel fica mudo — este botão conserta sem precisar reconectar tudo.
@@ -28,6 +33,7 @@ import { cancelarConvite as cancelarNoBanco, criarConvite } from "@/lib/convites
 // a Meta por causa de uma linha de configuração.
 export async function reassinarWebhooks(): Promise<void> {
   await exigirSessao();
+  await exigirAdministrador();
   const accounts = await listAccounts();
   let ok = 0;
   const falhas: string[] = [];
@@ -57,6 +63,7 @@ export async function reassinarWebhooks(): Promise<void> {
 // ============================================================
 export async function testarWebhook(): Promise<void> {
   await exigirSessao();
+  await exigirAdministrador();
   const config = await getConfig();
   const h = await headers();
   const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
@@ -139,6 +146,7 @@ export async function testarWebhook(): Promise<void> {
 // são salvas; senão, usa as já salvas (com fallback nas do login).
 export async function configurarWebhookAuto(formData: FormData): Promise<void> {
   await exigirSessao();
+  await exigirAdministrador();
   const config = await getConfig();
 
   const metaAppId = String(formData.get("meta_app_id") ?? "").trim();
@@ -193,6 +201,7 @@ export async function configurarWebhookAuto(formData: FormData): Promise<void> {
 
 export async function saveMetaCredentials(formData: FormData): Promise<void> {
   await exigirSessao();
+  await exigirAdministrador();
   const appId = String(formData.get("instagram_app_id") ?? "").trim();
   const appSecret = String(formData.get("instagram_app_secret") ?? "").trim();
   // A CHAVE EM BRANCO MANTÉM A GRAVADA (achado 123): a tela não leva mais o valor da chave, então o
@@ -256,6 +265,7 @@ function recusar(motivo: string, conta: string, linhas: LinhaDoFormulario[]): ne
 
 export async function salvarPerguntasDeAbertura(formData: FormData): Promise<void> {
   await exigirSessao();
+  await exigirAdministrador();
   const igUserId = contaDoFormulario(formData);
   const conta = await getAccount(igUserId);
   // A CONTA VEM DO FORMULÁRIO, então ela é conferida contra as conectadas. Sem
```

Em `app/setup/page.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/setup/page.tsx b/app/setup/page.tsx
index 2d5c087..9ea0bb6 100644
--- a/app/setup/page.tsx
+++ b/app/setup/page.tsx
@@ -1,5 +1,7 @@
 import { headers } from "next/headers";
+import { redirect } from "next/navigation";
 import { getConfig, isMetaConfigured, listAccounts, sql } from "@/lib/db";
+import { sessaoAtual } from "@/lib/sessao";
 import { qstashEnabled } from "@/lib/qstash";
 import { saveMetaCredentials, testarWebhook } from "./actions";
 import { resumoDaInstalacao, subtituloDaConfiguracao } from "./portas";
@@ -79,6 +81,13 @@ export default async function SetupPage({
 }: {
   searchParams: Promise<{ erro?: string; salvo?: string; rascunho?: string }>;
 }) {
+  // A CONFIGURAÇÃO É DO ADMINISTRADOR (docs/specs/2026-11-05-contas-por-login.md, seção 3), conferido aqui
+  // no servidor, como a página Logins (app/logins/page.tsx): o item do menu escondido é só conforto. Esta
+  // página lê todas as contas e a `config` inteira, e as actions dela conferem de novo
+  // (`exigirAdministrador`, ./actions.ts).
+  const quem = await sessaoAtual();
+  if (!quem) redirect("/entrar");
+  if (!quem.administrador) redirect("/");
   const sp = await searchParams;
   const config = await getConfig();
 
```

Em `lib/account.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/account.ts b/lib/account.ts
index 4d8caf2..dffecd6 100644
--- a/lib/account.ts
+++ b/lib/account.ts
@@ -1,16 +1,22 @@
 import "server-only";
 import { cookies } from "next/headers";
-import { listAccounts, Account } from "./db";
+import { type Account } from "./db";
+import { contaEscolhida } from "./acesso";
+import { sessaoAtual } from "./sessao";
 
-// Conta atualmente selecionada no painel. O valor vive num cookie; se estiver
-// ausente ou apontar para uma conta que não existe mais, cai na primeira.
+// Conta atualmente selecionada no painel. O valor vive num cookie, e ele só desempata DENTRO das contas que o
+// login da sessão vê (lib/acesso.ts, docs/specs/2026-11-05-contas-por-login.md, seção 2): ausente, ou de uma
+// conta que o login não vê (ou que não existe mais), cai na primeira que ele vê. Sem login, não há conta.
+//
+// A ASSINATURA NÃO MUDOU com as contas por login, de propósito: os pontos que usam a conta escolhida, e que
+// ligam o id do navegador a ela (`... and account_id = $n`), ficam presos às contas do login sem mudar uma
+// linha deles (o achado 181, medido em testes-integracao/contas-por-login.integracao.ts).
 export const ACCOUNT_COOKIE = "metodochat_account";
 
 export async function getSelectedAccount(): Promise<Account | null> {
-  const accounts = await listAccounts();
-  if (!accounts.length) return null;
-  const id = (await cookies()).get(ACCOUNT_COOKIE)?.value;
-  return accounts.find((a) => a.ig_user_id === id) ?? accounts[0];
+  const login = await sessaoAtual();
+  if (!login) return null;
+  return contaEscolhida(login, (await cookies()).get(ACCOUNT_COOKIE)?.value);
 }
 
 export async function getSelectedAccountId(): Promise<string | null> {
```

Crie `lib/acesso.ts`:

```ts
import "server-only";
import { listAccounts, sql, type Account } from "./db";
import { escolherConta } from "./acesso-escolha";
import { idsDasContasDoLogin, type LoginDaSessao } from "./logins-repositorio";

// QUEM VÊ QUAL CONTA (docs/specs/2026-11-05-contas-por-login.md, seção 2). ESTE É O ÚNICO LUGAR QUE SABE.
// O resto do código pergunta a ele: a conta escolhida (lib/account.ts), o seletor do layout, o
// `selectAccount` e, com eles, todo ponto que já liga o id que vem do navegador à conta escolhida.
//
// A REGRA DE HOJE: o administrador vê todas as contas; o login comum, só as ligadas a ele na
// `logins_contas` (a 023). O administrador não precisa de linha nenhuma.
//
// VIRAR MULTIEMPRESA É TROCAR A REGRA DAQUI (o "ManyChat com CRM" que o Eduardo deixou para depois, em
// 05/11): as contas de um login passam a ser as da empresa dele, e nenhum ponto que pergunta muda. Por isso
// nada fora deste arquivo pode ler a `logins_contas` ou decidir pelo `administrador` qual conta alguém vê.
//
// NADA FICA GUARDADO ENTRE PEDIDOS: tirar uma conta de um login vale no próximo clique.

/** As contas que o login vê, na ordem de `listAccounts` (`created_at`). */
export async function contasDoLogin(login: LoginDaSessao): Promise<Account[]> {
  if (login.administrador) return listAccounts();
  return (await sql().query(
    `select a.* from accounts a
       join logins_contas lc on lc.account_id = a.ig_user_id
      where lc.login_id = $1
      order by a.created_at asc`,
    [login.id]
  )) as Account[];
}

/** Se o login vê a conta: o administrador, se ela existe; o comum, se ela foi dada a ele. */
export async function podeVerConta(login: LoginDaSessao, contaId: string): Promise<boolean> {
  if (!contaId) return false;
  if (login.administrador) {
    const linhas = (await sql().query(`select 1 from accounts where ig_user_id = $1`, [contaId])) as unknown[];
    return linhas.length > 0;
  }
  // A ligação já garante que a conta existe: a chave estrangeira da 023 apaga a linha junto com a conta.
  return (await idsDasContasDoLogin(login.id)).includes(contaId);
}

/** De uma lista qualquer de contas (o carrossel usa a dos cabeçalhos), as que o login vê, na mesma ordem. */
export async function soAsDoLogin<T extends { ig_user_id: string }>(login: LoginDaSessao, contas: T[]): Promise<T[]> {
  if (login.administrador) return contas;
  const dele = new Set(await idsDasContasDoLogin(login.id));
  return contas.filter((c) => dele.has(c.ig_user_id));
}

/**
 * A conta escolhida do login: a do cookie, se ele a vê; senão, a primeira que ele vê; senão, nenhuma. A
 * escolha em si é pura (`escolherConta`, lib/acesso-escolha.ts); aqui só entra a lista do login.
 */
export async function contaEscolhida(login: LoginDaSessao, doCookie: string | undefined): Promise<Account | null> {
  return escolherConta(await contasDoLogin(login), doCookie);
}
```

Em `lib/event-query.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/event-query.ts b/lib/event-query.ts
index bd4ed90..014c9da 100644
--- a/lib/event-query.ts
+++ b/lib/event-query.ts
@@ -26,11 +26,22 @@ function toSearchPattern(termo: string): string {
   return `%${termo.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
 }
 
-export function buildWhere(accountId: string, f: EventFilters): Where {
+// OS EVENTOS SEM CONTA (`e.account_id is null`) SÓ ENTRAM SE `comEventosSemConta`
+// (docs/specs/2026-11-05-contas-por-login.md, seção 3). Quando um webhook dá
+// erro, o corpo inteiro é gravado sem conta (app/api/webhook/route.ts), com a DM
+// ou o comentário de qualquer conta dentro. O administrador vê todas as contas e
+// os recebe; o login comum, não (app/eventos/page.tsx passa o papel). O padrão é
+// o de antes desta entrega. É o primeiro termo das duas consultas deste arquivo,
+// a da lista (`buildWhere`) e a do seletor de posts (`postsComEventos`).
+function termoDaConta(comEventosSemConta: boolean): string {
+  return comEventosSemConta ? "(e.account_id = $1 or e.account_id is null)" : "(e.account_id = $1)";
+}
+
+export function buildWhere(accountId: string, f: EventFilters, comEventosSemConta = true): Where {
   // Os parênteses do primeiro termo importam: sem eles `A or B and C` seria
   // lido como `A or (B and C)` e vazaria evento de outra conta assim que
   // qualquer filtro entrasse.
-  const partes = ["(e.account_id = $1 or e.account_id is null)"];
+  const partes = [termoDaConta(comEventosSemConta)];
   const params: unknown[] = [accountId];
   const ref = () => `$${params.length}`;
 
@@ -77,11 +88,15 @@ export function buildWhere(accountId: string, f: EventFilters): Where {
 // esta lista que alimenta o seletor: assim toda opção oferecida produz
 // resultado. Não recebe os outros filtros de propósito — senão escolher um post
 // esconderia os demais e não daria para trocar.
-export function postsComEventos(accountId: string, limite: number): Where {
+//
+// OS EVENTOS SEM CONTA ENTRAM PELA MESMA REGRA DE `buildWhere` (`termoDaConta`,
+// acima): com `comEventosSemConta` falso (o login comum), um evento sem conta com
+// `media` não oferece o post, nem a contagem, de outra conta.
+export function postsComEventos(accountId: string, limite: number, comEventosSemConta = true): Where {
   return {
     sql: `select e.payload->'media'->>'id' as id, count(*)::int as total
           from events e
-          where (e.account_id = $1 or e.account_id is null)
+          where ${termoDaConta(comEventosSemConta)}
             and e.payload->'media'->>'id' is not null
           group by 1
           order by max(e.created_at) desc
```

Em `lib/exigir-sessao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/exigir-sessao.ts b/lib/exigir-sessao.ts
index 02310c9..307c688 100644
--- a/lib/exigir-sessao.ts
+++ b/lib/exigir-sessao.ts
@@ -22,8 +22,8 @@ export async function exigirSessao(): Promise<void> {
 /**
  * O LOGIN DA SESSÃO, SE FOR ADMINISTRADOR; senão, volta para o início (docs/specs/2026-11-04-logins.md,
  * seção 4). Vai logo DEPOIS do `await exigirSessao();` nas actions que só o administrador pode chamar: a
- * página Logins e o convite. Nesta entrega todo login é administrador, e a conferência já fica no servidor
- * para a entrega 2, quando nasce o login comum.
+ * página Logins e, desde as contas por login (docs/specs/2026-11-05-contas-por-login.md, seção 3), toda a
+ * Configuração (app/setup/actions.ts), o convite incluído.
  */
 export async function exigirAdministrador(): Promise<LoginDaSessao> {
   const login = await sessaoAtual();
```

- [ ] **Passo 4: ver passar**

```bash
env -u CLAUDECODE -u AI_AGENT npx vitest run tests/event-query.test.ts tests/layout-contas.test.ts
env -u CLAUDECODE -u AI_AGENT npx vitest run --config vitest.dom.config.ts testes-dom/menu-do-login-comum.dom.tsx
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/acoes-que-falam.integracao.ts testes-integracao/agendados.integracao.ts testes-integracao/capa-do-post.integracao.ts testes-integracao/chave-fora-da-pagina.integracao.ts testes-integracao/contas-por-login.integracao.ts testes-integracao/desempenho.integracao.ts testes-integracao/ficha-da-conversa.integracao.ts testes-integracao/marcar-em-lote.integracao.ts testes-integracao/nao-saiu.integracao.ts testes-integracao/portas-de-publicar.integracao.ts testes-integracao/publicar-fala.integracao.ts testes-integracao/pulso-do-inicio.integracao.ts
npx eslint app/account-actions.ts app/account-switcher.tsx app/api/oauth/login/route.ts app/app-shell.tsx app/eventos/page.tsx app/layout.tsx app/setup/actions.ts app/setup/page.tsx lib/account.ts lib/acesso.ts lib/event-query.ts lib/exigir-sessao.ts testes-dom/menu-do-login-comum.dom.tsx testes-integracao/acoes-que-falam.integracao.ts testes-integracao/agendados.integracao.ts testes-integracao/capa-do-post.integracao.ts testes-integracao/chave-fora-da-pagina.integracao.ts testes-integracao/contas-por-login.integracao.ts testes-integracao/desempenho.integracao.ts testes-integracao/ficha-da-conversa.integracao.ts testes-integracao/marcar-em-lote.integracao.ts testes-integracao/nao-saiu.integracao.ts testes-integracao/portas-de-publicar.integracao.ts testes-integracao/publicar-fala.integracao.ts testes-integracao/pulso-do-inicio.integracao.ts testes-integracao/semear-requisicao.ts tests/event-query.test.ts tests/layout-contas.test.ts
npx tsc --noEmit
```

Esperado: puros: 2 arquivos passando, com 24 casos passando; tela: 1 arquivo passando, com 6 casos passando; integração: 12 arquivos passando, com 152 casos passando; o lint e o `tsc` limpos.

- [ ] **Passo 5: o commit**

A mensagem do commit, gravada em `$SCRATCH/msg-contas-f3.txt`:

```text
A regra das contas mora num lugar só, e o login comum vê só as contas dele
```

```bash
git add app/account-actions.ts app/account-switcher.tsx app/api/oauth/login/route.ts app/app-shell.tsx app/eventos/page.tsx app/layout.tsx app/setup/actions.ts app/setup/page.tsx lib/account.ts lib/acesso.ts lib/event-query.ts lib/exigir-sessao.ts testes-dom/menu-do-login-comum.dom.tsx testes-integracao/acoes-que-falam.integracao.ts testes-integracao/agendados.integracao.ts testes-integracao/capa-do-post.integracao.ts testes-integracao/chave-fora-da-pagina.integracao.ts testes-integracao/contas-por-login.integracao.ts testes-integracao/desempenho.integracao.ts testes-integracao/ficha-da-conversa.integracao.ts testes-integracao/marcar-em-lote.integracao.ts testes-integracao/nao-saiu.integracao.ts testes-integracao/portas-de-publicar.integracao.ts testes-integracao/publicar-fala.integracao.ts testes-integracao/pulso-do-inicio.integracao.ts testes-integracao/semear-requisicao.ts tests/event-query.test.ts tests/layout-contas.test.ts
git commit -F "$SCRATCH/msg-contas-f3.txt"
```

---

### FASE 4 — O carrossel nas contas do login, e a varredura

O carrossel pergunta à regra (`lib/bonus/carrossel-acesso.ts`), a queda na logada escolhe nas contas do login (179), e a conta, as imagens, a publicação e o apagar exigem a conta do carrossel. O teste da varredura entra aqui, e a partir desta fase protege toda action e toda rota.

- [ ] **Passo 1: os testes, antes do código**

Crie `testes-integracao/contas-no-carrossel.integracao.ts`:

```ts
// OS CARROSSÉIS CONTINUAM DE TODOS, E A CONTA, AS IMAGENS, A PUBLICAÇÃO E O APAGAR SÓ NAS CONTAS DO LOGIN
// (docs/specs/2026-11-05-contas-por-login.md, seção 3, "Os carrosséis", e achado 179), contra o banco
// descartável, no contexto de requisição semeado (./semear-requisicao.ts).
//
// O CENÁRIO é o de contas-por-login.integracao.ts: duas contas, A e B, e o login comum de teste ligado só à
// A. O login de teste de sempre é administrador e vê as duas. O "cookie da B" é o que `selectAccount`
// emitiu para o administrador, nunca escrito à mão.
//
// NADA SAI DESTA MÁQUINA, e são três as portas:
//   - a OpenAI: a chave dela fica fora do ambiente, e o pedido de imagem para no "sem chave", antes de
//     reservar (lib/bonus/imagem-processo.ts);
//   - a Meta e o bucket: a publicação para no "faltam imagens", e a assinatura e o guardar param no tipo e
//     no caminho, antes do bucket;
//   - a IA do texto e o Labs: os pedidos e os gerar de novo chamam os dois. O Labs é a LABS_URL, e a IA a
//     ANTHROPIC_BASE_URL (lida pela SDK), as duas apontando para o servidor falso deste arquivo, que responde
//     a lista do Labs e recusa todo o resto. A geração do carrossel novo, no `after()`, falha ali, e o que
//     o caso mede (a conta gravada no pedido) já está no banco antes dela.
// E A CERCA da F3 por cima: o `fetch` global deixa passar só o 127.0.0.1, e o último caso exige zero
// pedidos para fora.
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { TextoDeCarrossel } from "@/lib/bonus/carrossel-texto";
import { bancoDescartavel } from "./harness";
import { comoNumaRequisicaoComoComum, comoNumaRequisicaoComSessao } from "./semear-requisicao";

const banco = bancoDescartavel();
const q = (texto: string, params: unknown[] = []) =>
  banco.db().sql().query(texto, params) as Promise<Record<string, unknown>[]>;

// Os ids deste arquivo. Valores inventados: nenhuma credencial de verdade entra em teste.
const CONTA_A = "17800000000041001";
const CONTA_B = "17800000000041002";
const SLUG = "bonus-das-contas-no-carrossel";
const CENA = "/marketing uma pessoa usando o celular numa loja de roupas";

const slide = (i: number) => ({ titulo: `Título do slide ${i}`, texto: `Texto do slide ${i}, com mais de trinta caracteres.` });
// O texto e a arte de bonus-imagem-processo.integracao.ts: 5 slides, o 1 e o 5 "só texto", o 2, o 3 e o 4
// com espaço de imagem.
const TEXTO: TextoDeCarrossel = {
  tipo: "carrossel",
  titulo: "Mensagens para reativar clientes",
  gancho: "Seu cliente sumiu? Não é culpa dele.",
  slides: [slide(1), slide(2), slide(3)],
  chamada: "Comente SUMIDO e receba as mensagens prontas.",
  legenda: "Quem sumiu ainda pode voltar. Comente SUMIDO que eu te mando as mensagens prontas para usar hoje mesmo.",
};
const arteDa = (conta: string | null) =>
  conta ? { conta, nome: `Nome da ${conta}`, arroba: `arroba_${conta}`, soTexto: [1, 5] } : { soTexto: [1, 5] };

let servidor: Server;
const pedidosAoFalso: string[] = [];
const pedidosParaFora: string[] = [];
let fetchDeVerdade: typeof fetch;
const AMBIENTE_GUARDADO: Record<string, string | undefined> = {};
const VARIAVEIS = ["LABS_URL", "ANTHROPIC_BASE_URL", "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "IG_GRAPH_BASE", "QSTASH_TOKEN"];

type ModuloCarrossel = typeof import("@/app/bonus/carrossel-actions");
type ModuloAvulso = typeof import("@/app/carrosseis/actions");
type ModuloImagem = typeof import("@/app/bonus/imagem-actions");
type ModuloPublicar = typeof import("@/app/bonus/publicar-actions");
type ModuloApagar = typeof import("@/app/bonus/apagar-actions");
let carrossel: ModuloCarrossel;
let avulso: ModuloAvulso;
let imagem: ModuloImagem;
let publicar: ModuloPublicar;
let apagar: ModuloApagar;
let FRASE_DE_OUTRA_CONTA = "";
let FRASE_SEM_CONTAS = "";
let bonusId = "";

beforeAll(async () => {
  servidor = createServer((req, res) => {
    const u = new URL(req.url ?? "/", "http://127.0.0.1");
    pedidosAoFalso.push(`${req.method} ${u.pathname}`);
    // A LISTA PÚBLICA DO LABS, no formato do contrato (lib/bonus/publicado.ts), com o bônus deste arquivo.
    if (req.method === "GET" && u.pathname === "/api/bonus") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          items: [
            {
              codigo: SLUG,
              palavraChave: "SUMIDO",
              tema: "Vendas",
              titulo: "Mensagens para reativar clientes",
              descricao: "As mensagens prontas para trazer de volta quem sumiu.",
            },
          ],
        })
      );
      return;
    }
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ type: "error", error: { type: "api_error", message: "o servidor falso deste arquivo não responde isto" } }));
  });
  await new Promise<void>((pronto) => servidor.listen(0, "127.0.0.1", pronto));
  const base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  for (const v of VARIAVEIS) AMBIENTE_GUARDADO[v] = process.env[v];
  process.env.LABS_URL = base;
  process.env.ANTHROPIC_BASE_URL = base;
  process.env.IG_GRAPH_BASE = base;
  process.env.ANTHROPIC_API_KEY = "chave-inventada-para-o-teste";
  delete process.env.OPENAI_API_KEY;
  delete process.env.QSTASH_TOKEN;

  fetchDeVerdade = globalThis.fetch;
  globalThis.fetch = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(entrada instanceof Request ? entrada.url : String(entrada));
    if (url.hostname !== "127.0.0.1") {
      pedidosParaFora.push(url.origin);
      throw new Error(`A CERCA DE contas-no-carrossel.integracao.ts recusou um pedido para ${url.origin}`);
    }
    return fetchDeVerdade(entrada, init);
  }) as typeof fetch;

  carrossel = await import("@/app/bonus/carrossel-actions");
  avulso = await import("@/app/carrosseis/actions");
  imagem = await import("@/app/bonus/imagem-actions");
  publicar = await import("@/app/bonus/publicar-actions");
  apagar = await import("@/app/bonus/apagar-actions");
  const textos = await import("@/lib/logins-textos");
  FRASE_DE_OUTRA_CONTA = textos.FRASE_CARROSSEL_DE_OUTRA_CONTA;
  FRASE_SEM_CONTAS = textos.FRASE_SEM_CONTAS;

  // AS DUAS CONTAS, A ANTES DA B (a ordem de `listAccounts` e de `contasParaArte`).
  for (const id of [CONTA_A, CONTA_B]) {
    await banco.db().upsertAccount({
      ig_user_id: id,
      username: `arroba_${id}`,
      name: `Nome da ${id}`,
      profile_picture_url: null,
      access_token: `token-da-${id}-que-nao-vale-nada`,
      token_expires_at: null,
    });
  }
  await q(`update accounts set created_at = now() - interval '2 hours' where ig_user_id = $1`, [CONTA_A]);
  await q(`update accounts set created_at = now() - interval '1 hour' where ig_user_id = $1`, [CONTA_B]);
  const [b] = (await q(
    `insert into bonus_gerados (tema, o_que_resolve, estado, slug, envio_estado)
     values ('Vendas', 'Reativar clientes que pararam de comprar pelo WhatsApp.', 'pronto', $1, 'criado')
     returning id`,
    [SLUG]
  )) as { id: string }[];
  bonusId = b.id;
});

afterAll(async () => {
  globalThis.fetch = fetchDeVerdade;
  for (const v of VARIAVEIS) {
    if (AMBIENTE_GUARDADO[v] === undefined) delete process.env[v];
    else process.env[v] = AMBIENTE_GUARDADO[v];
  }
  await new Promise<void>((pronto) => servidor.close(() => pronto()));
});

// ---------------------------------------------------------------------------------------------------
// Semear e ler. Nada aqui decide nada.
// ---------------------------------------------------------------------------------------------------

// OS CARROSSÉIS SEMEADOS NASCEM HÁ DOIS DIAS: o teto do pedido conta os das últimas 24 horas que chamaram a
// IA (lib/bonus/carrossel-repositorio.ts), e os pedidos deste arquivo não podem esbarrar nos semeados.
async function prontoDa(conta: string | null): Promise<string> {
  const [c] = (await q(
    `insert into carrosseis_gerados (origem, total_slides, palavra, contexto, estado, gerado, arte, criado_em)
     values ('livre', 5, 'SUMIDO', $1::jsonb, 'pronto', $2::jsonb, $3::jsonb, now() - interval '2 days') returning id`,
    [{ tipo: "livre", tema: "Vendas", conteudo: "Mensagens para trazer de volta quem sumiu." }, TEXTO, arteDa(conta)]
  )) as { id: string }[];
  return c.id;
}

/** Um carrossel que falhou e não tem conta: o original dos dois gerar de novo. */
async function falhouSemConta(tipo: "bonus" | "avulso"): Promise<string> {
  const [c] = (await (tipo === "bonus"
    ? q(
        `insert into carrosseis_gerados (bonus_id, total_slides, palavra, contexto, estado, erro, arte, criado_em)
         values ($1, 5, 'SUMIDO', '{}'::jsonb, 'falhou', 'A IA não respondeu.', '{}'::jsonb, now() - interval '2 days') returning id`,
        [bonusId]
      )
    : q(
        `insert into carrosseis_gerados (origem, total_slides, palavra, contexto, estado, erro, arte, criado_em)
         values ('livre', 5, 'SUMIDO', $1::jsonb, 'falhou', 'A IA não respondeu.', '{}'::jsonb, now() - interval '2 days') returning id`,
        [{ tipo: "livre", tema: "Vendas", conteudo: "Mensagens para trazer de volta quem sumiu." }]
      ))) as { id: string }[];
  return c.id;
}

const linhaDo = (id: string) => q(`select * from carrosseis_gerados where id = $1`, [id]);
const contaGravada = async (id: string) =>
  String(((await q(`select arte->>'conta' as conta from carrosseis_gerados where id = $1`, [id]))[0] ?? {}).conta ?? "");
const quantas = async (tabela: "queue" | "imagens_geradas") =>
  Number((await q(`select count(*)::int as n from ${tabela}`))[0].n);

/** O que as cinco ações mexeriam: a linha do carrossel, a fila e as reservas de imagem. */
const estadoDo = async (id: string) => ({ linha: await linhaDo(id), fila: await quantas("queue"), imagens: await quantas("imagens_geradas") });

const form = (campos: Record<string, string | string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) for (const x of Array.isArray(v) ? v : [v]) f.append(k, x);
  return f;
};

type Desfecho = { digest: string | null; destino: string | null; texto: string | null };

/** O corpo, com o redirect lido do `digest`, e o `texto` do estado que a action devolveu. */
function capturando(corpo: () => Promise<unknown>) {
  return async (): Promise<Desfecho> => {
    try {
      const v = await corpo();
      return { digest: null, destino: null, texto: (v as { texto?: string } | null)?.texto ?? null };
    } catch (e) {
      const d = (e as { digest?: unknown }).digest;
      if (typeof d !== "string") throw e;
      const destino = d.startsWith("NEXT_REDIRECT;") ? d.split(";").slice(2, -2).join(";") : null;
      return { digest: d, destino, texto: null };
    }
  };
}

const comoComum = async (corpo: () => Promise<unknown>, opcoes: { contas: string[]; contaDoCookie?: string } = { contas: [CONTA_A] }) =>
  (await comoNumaRequisicaoComoComum("/carrosseis", capturando(corpo), opcoes)).valor;
const comoAdministrador = async (corpo: () => Promise<unknown>) =>
  (await comoNumaRequisicaoComSessao("/carrosseis", capturando(corpo))).valor;

/** As cinco ações que agem na conta do carrossel, com um pedido que para logo depois da conferência. */
const ACOES: [string, (id: string) => () => Promise<unknown>][] = [
  ["pedirImagemDoSlide", (id) => () => imagem.pedirImagemDoSlide({ id, numero: 2, descricao: CENA })],
  [
    "assinarImagemDoCarrossel",
    (id) => () =>
      publicar.assinarImagemDoCarrossel({
        id,
        numero: 2,
        destino: "slide",
        arquivo: { nome: "slide.png", mime: "image/png", bytes: 1000, largura: 1080, altura: 1350 },
      }),
  ],
  ["guardarImagemDoSlide", (id) => () => publicar.guardarImagemDoSlide({ id, numero: 2, caminho: "fora/da/pasta.jpg" })],
  ["publicarCarrossel", (id) => () => publicar.publicarCarrossel({ id, quando: "agora", artes: [] })],
  ["apagarCarrosselDaPagina", (id) => () => apagar.apagarCarrosselDaPagina(null, form({ id }))],
];

// ---------------------------------------------------------------------------------------------------
// NUM CARROSSEL DA B, O COMUM É RECUSADO, E NADA MUDA
// ---------------------------------------------------------------------------------------------------

describe("num carrossel pronto da B, o comum é recusado e o banco não muda", () => {
  it.each(ACOES)("%s recusa com a frase, e o carrossel, a fila e as reservas ficam iguais", async (_nome, acao) => {
    const id = await prontoDa(CONTA_B);
    // A sessão do comum ANTES da foto, para a foto não depender da primeira entrada dele.
    await comoComum(async () => null);
    const antes = await estadoDo(id);
    const d = await comoComum(acao(id));
    expect(d.digest).toBe(null);
    expect(d.texto).toBe(FRASE_DE_OUTRA_CONTA);
    expect(await estadoDo(id)).toEqual(antes);
  });
});

// ---------------------------------------------------------------------------------------------------
// NUM CARROSSEL DA A, CADA UM PASSA DA CONFERÊNCIA
//
// O caso prova só que a recusa não é a da conta: cada ação para adiante pelo motivo de sempre (a chave da
// imagem, o tipo do arquivo, o caminho fora da pasta, as imagens que faltam), e o apagar apaga.
// ---------------------------------------------------------------------------------------------------

describe("num carrossel pronto da A, o comum passa da conferência", () => {
  it("o pedido de imagem para na chave da OpenAI, e não na conta", async () => {
    const { textoDaRecusaDaImagem } = await import("@/lib/bonus/imagem-textos");
    const d = await comoComum(ACOES[0][1](await prontoDa(CONTA_A)));
    expect(d.texto).toBe(textoDaRecusaDaImagem({ motivo: "sem_chave" }));
    expect(await quantas("imagens_geradas")).toBe(0);
  });

  it("o assinar, o guardar e o publicar param no motivo de sempre, e não na conta", async () => {
    const { textoDaRecusaDaPublicacaoDoCarrossel: frase } = await import("@/lib/bonus/publicar-textos");
    const id = await prontoDa(CONTA_A);
    expect((await comoComum(ACOES[1][1](id))).texto).toBe(frase({ motivo: "tipo" }));
    expect((await comoComum(ACOES[2][1](id))).texto).toBe(frase({ motivo: "caminho" }));
    expect((await comoComum(ACOES[3][1](id))).texto).toBe(frase({ motivo: "faltam_imagens", slides: [2, 3, 4] }));
    expect(await quantas("queue")).toBe(0);
  });

  it("o apagar apaga", async () => {
    const id = await prontoDa(CONTA_A);
    const d = await comoComum(ACOES[4][1](id));
    expect(d.digest ?? "").toMatch(/^NEXT_REDIRECT;/);
    expect(await linhaDo(id)).toEqual([]);
  });

  it("sem conta no carrossel, qualquer login apaga", async () => {
    const id = await prontoDa(null);
    const d = await comoComum(ACOES[4][1](id));
    expect(d.digest ?? "").toMatch(/^NEXT_REDIRECT;/);
    expect(await linhaDo(id)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------
// O TEXTO E A ARTE SÃO DE TODOS
// ---------------------------------------------------------------------------------------------------

describe("o comum salva slide e arte nos dois carrosséis", () => {
  it.each([
    ["da A", CONTA_A],
    ["da B", CONTA_B],
  ])("no carrossel %s", async (_nome, conta) => {
    const { TEXTO_ARTE_SALVA } = await import("@/lib/bonus/arte-textos");
    const id = await prontoDa(conta);
    const slide = await comoComum(() =>
      carrossel.salvarSlideDoCarrossel(null, form({ id, parte: "slide_1", gancho: "Seu cliente sumiu? A culpa não é dele." }))
    );
    expect(slide.texto).not.toBe(FRASE_DE_OUTRA_CONTA);
    expect(((await linhaDo(id))[0].revisado as { gancho?: string } | null)?.gancho).toBe("Seu cliente sumiu? A culpa não é dele.");
    const arte = await comoComum(() => carrossel.salvarArteDoCarrossel(null, form({ id, so_texto: ["1", "5"] })));
    expect(arte.texto).toBe(TEXTO_ARTE_SALVA);
  });
});

// ---------------------------------------------------------------------------------------------------
// A CONTA DE UM CARROSSEL NOVO É UMA DAS DO LOGIN (179)
//
// O comum, com o cookie da B no navegador: o pedido e o gerar de novo de um original sem conta gravam a A,
// e nunca a B. O destino do redirect diz qual é o carrossel novo.
// ---------------------------------------------------------------------------------------------------

describe("a conta de um carrossel novo do comum, com o cookie da B, é a A", () => {
  const COM_O_COOKIE_DA_B = { contas: [CONTA_A], contaDoCookie: CONTA_B };
  const novoDo = (destino: string | null) => (destino ?? "").split("/").pop() ?? "";

  it("o gerar de novo do carrossel de bônus sem conta grava a A", async () => {
    const original = await falhouSemConta("bonus");
    const d = await comoComum(() => carrossel.gerarCarrosselDeNovo(form({ id: original })), COM_O_COOKIE_DA_B);
    expect(d.destino ?? "").toMatch(new RegExp(`^/bonus/${bonusId}/carrossel/[0-9a-f-]{36}$`));
    expect(await contaGravada(novoDo(d.destino))).toBe(CONTA_A);
  });

  it("o gerar de novo do avulso sem conta grava a A", async () => {
    const original = await falhouSemConta("avulso");
    const d = await comoComum(() => avulso.gerarAvulsoDeNovo(form({ id: original })), COM_O_COOKIE_DA_B);
    expect(d.destino ?? "").toMatch(/^\/carrosseis\/[0-9a-f-]{36}$/);
    expect(await contaGravada(novoDo(d.destino))).toBe(CONTA_A);
  });

  it("o pedido de um carrossel de bônus grava a A", async () => {
    const d = await comoComum(() => carrossel.pedirCarrossel(null, form({ bonus_id: bonusId, total: "5" })), COM_O_COOKIE_DA_B);
    expect(d.destino ?? "").toMatch(new RegExp(`^/bonus/${bonusId}/carrossel/[0-9a-f-]{36}$`));
    expect(await contaGravada(novoDo(d.destino))).toBe(CONTA_A);
  });

  it("o pedido de um carrossel avulso grava a A", async () => {
    const d = await comoComum(
      () =>
        avulso.pedirCarrosselAvulso(
          null,
          form({
            origem: "livre",
            tema: "Produtividade",
            palavra: "BRUTAL",
            conteudo: "Um prompt que critica o seu plano sem dó nenhum.",
            total: "5",
            jeito: "ia",
          })
        ),
      COM_O_COOKIE_DA_B
    );
    expect(d.destino ?? "").toMatch(/^\/carrosseis\/[0-9a-f-]{36}$/);
    expect(await contaGravada(novoDo(d.destino))).toBe(CONTA_A);
  });
});

// A CONTA DO MENU NO CARROSSEL, lida direto: é ela que os pedidos e o fixar acima usam, e a revisão e as
// rotas também. O cookie da B não escolhe a B para o comum; para o administrador, que tem a B, escolhe.
describe("a conta do menu no carrossel", () => {
  const doMenu = async () => {
    const { contaDoMenuNoCarrossel } = await import("@/lib/bonus/carrossel-acesso");
    return (await contaDoMenuNoCarrossel())?.ig_user_id ?? null;
  };

  it("o comum com o cookie da B tem a A; sem contas, nenhuma", async () => {
    expect((await comoNumaRequisicaoComoComum("/carrosseis", doMenu, { contas: [CONTA_A], contaDoCookie: CONTA_B })).valor).toBe(CONTA_A);
    expect((await comoNumaRequisicaoComoComum("/carrosseis", doMenu, { contas: [], contaDoCookie: CONTA_B })).valor).toBe(null);
  });

  it("o administrador com o cookie da B tem a B", async () => {
    expect((await comoNumaRequisicaoComSessao("/carrosseis", doMenu, { contaDoCookie: CONTA_B })).valor).toBe(CONTA_B);
  });
});

describe("o fixar nesta conta", () => {
  it("num carrossel sem conta, o comum com o cookie da B fixa a A", async () => {
    const { TEXTO_CONTA_FIXADA } = await import("@/lib/bonus/arte-textos");
    const id = await prontoDa(null);
    const d = await comoComum(() => carrossel.fixarContaDoCarrossel(null, form({ id })), { contas: [CONTA_A], contaDoCookie: CONTA_B });
    expect(d.texto).toBe(TEXTO_CONTA_FIXADA);
    expect(await contaGravada(id)).toBe(CONTA_A);
  });

  it("o comum sem contas recebe a frase de quem não tem contas, e nada é gravado", async () => {
    const id = await prontoDa(null);
    const antes = await linhaDo(id);
    const d = await comoComum(() => carrossel.fixarContaDoCarrossel(null, form({ id })), { contas: [], contaDoCookie: CONTA_B });
    expect(d.texto).toBe(FRASE_SEM_CONTAS);
    expect(await linhaDo(id)).toEqual(antes);
  });
});

// ---------------------------------------------------------------------------------------------------
// O ADMINISTRADOR CONTINUA AGINDO NOS DOIS
// ---------------------------------------------------------------------------------------------------

describe("o administrador continua agindo nos dois carrosséis", () => {
  it.each([
    ["da A", CONTA_A],
    ["da B", CONTA_B],
  ])("no carrossel %s, as cinco passam da conferência", async (_nome, conta) => {
    const { textoDaRecusaDaImagem } = await import("@/lib/bonus/imagem-textos");
    const { textoDaRecusaDaPublicacaoDoCarrossel: frase } = await import("@/lib/bonus/publicar-textos");
    const id = await prontoDa(conta);
    expect((await comoAdministrador(ACOES[0][1](id))).texto).toBe(textoDaRecusaDaImagem({ motivo: "sem_chave" }));
    expect((await comoAdministrador(ACOES[1][1](id))).texto).toBe(frase({ motivo: "tipo" }));
    expect((await comoAdministrador(ACOES[2][1](id))).texto).toBe(frase({ motivo: "caminho" }));
    expect((await comoAdministrador(ACOES[3][1](id))).texto).toBe(frase({ motivo: "faltam_imagens", slides: [2, 3, 4] }));
    expect((await comoAdministrador(ACOES[4][1](id))).digest ?? "").toMatch(/^NEXT_REDIRECT;/);
    expect(await linhaDo(id)).toEqual([]);
  });
});

describe("a cerca da rede", () => {
  it("nenhum pedido deste arquivo saiu da máquina", () => {
    expect(pedidosParaFora).toEqual([]);
  });
});
```

Crie `tests/acesso-nas-actions.test.ts`:

```ts
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// TODA ACTION E TODA ROTA PASSA PELA REGRA DAS CONTAS (docs/specs/2026-11-05-contas-por-login.md, "Os testes").
// A regra mora em lib/acesso.ts, e o carrossel pergunta a ela por lib/bonus/carrossel-acesso.ts. Cada action
// exportada de um arquivo "use server" de `app/` e de `lib/`, e cada handler exportado de rota de `app/`, faz
// uma de três coisas:
//
//   1. chama `exigirAdministrador(` no corpo (lib/exigir-sessao.ts);
//   2. chama uma das funções da regra no corpo, direto ou por uma função local do mesmo arquivo que chame
//      (seguidas até o fim, sem laço);
//   3. está na lista fechada de baixo, com o motivo.
//
// ESTE ARQUIVO VALE PARA O QUE AINDA NÃO EXISTE, no molde de tests/sessao-nas-actions.test.ts: ele procura
// os arquivos em vez de uma lista. Uma action nova sem conferência faz este arquivo cair no `npm test`.
//
// O CÓDIGO É LIDO PELO ANALISADOR DO TYPESCRIPT, e o nome conta só quando é importado do módulo da regra:
// uma função local com o nome de uma da regra não passa por ela.

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const ler = (rel: string) => readFileSync(join(RAIZ, rel), "utf8");

/** Todo arquivo .ts/.tsx debaixo de `pasta`, com o caminho relativo à raiz e barras normais. */
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

function analisar(rel: string, fonte = ler(rel)): ts.SourceFile {
  const tipo = rel.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(rel, fonte, ts.ScriptTarget.Latest, true, tipo);
}

const exportado = (s: ts.Statement) =>
  ts.canHaveModifiers(s) && (ts.getModifiers(s) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);

function ehUseServer(sf: ts.SourceFile): boolean {
  const primeira = sf.statements[0];
  return (
    !!primeira &&
    ts.isExpressionStatement(primeira) &&
    ts.isStringLiteral(primeira.expression) &&
    primeira.expression.text === "use server"
  );
}

/** As funções da regra, pelo módulo de onde têm de vir. */
const DA_REGRA: Record<string, string[]> = {
  "@/lib/account": ["getSelectedAccount", "getSelectedAccountId"],
  "@/lib/acesso": ["contasDoLogin", "podeVerConta", "contaEscolhida", "soAsDoLogin"],
  // A CONTA DO MENU DO CARROSSEL não passa pela `getSelectedAccountId`, que lê a linha com o token (achado 60):
  // ela escolhe nas contas do login (`cabecalhosDoLogin`), com a mesma escolha pura.
  "@/lib/bonus/carrossel-acesso": ["cabecalhosDoLogin", "carrosselDeOutraConta", "contaDoMenuNoCarrossel"],
};
const DO_ADMINISTRADOR: Record<string, string[]> = { "@/lib/exigir-sessao": ["exigirAdministrador"] };

/** Os nomes locais que o arquivo importou de um destes módulos, com o nome de lá numa destas listas. */
function importados(sf: ts.SourceFile, modulos: Record<string, string[]>): Set<string> {
  const nomes = new Set<string>();
  for (const s of sf.statements) {
    if (!ts.isImportDeclaration(s) || !ts.isStringLiteral(s.moduleSpecifier)) continue;
    const aceitos = modulos[s.moduleSpecifier.text];
    const ligados = s.importClause?.namedBindings;
    if (!aceitos || !ligados || !ts.isNamedImports(ligados)) continue;
    for (const e of ligados.elements) {
      if (aceitos.includes((e.propertyName ?? e.name).text)) nomes.add(e.name.text);
    }
  }
  return nomes;
}

/** As funções declaradas no topo do arquivo, pelo nome: as `function` e as `const x = () => …`. */
function funcoesDoArquivo(sf: ts.SourceFile): Map<string, ts.Node> {
  const mapa = new Map<string, ts.Node>();
  for (const s of sf.statements) {
    if (ts.isFunctionDeclaration(s) && s.name && s.body) mapa.set(s.name.text, s.body);
    if (ts.isVariableStatement(s)) {
      for (const d of s.declarationList.declarations) {
        const i = d.initializer;
        if (ts.isIdentifier(d.name) && i && (ts.isArrowFunction(i) || ts.isFunctionExpression(i))) mapa.set(d.name.text, i.body);
      }
    }
  }
  return mapa;
}

/** Os nomes chamados como `nome(` em qualquer ponto do nó. */
function chamados(no: ts.Node): Set<string> {
  const nomes = new Set<string>();
  const andar = (n: ts.Node) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) nomes.add(n.expression.text);
    ts.forEachChild(n, andar);
  };
  andar(no);
  return nomes;
}

type Leitura = { regra: Set<string>; administrador: Set<string>; locais: Map<string, ts.Node> };

const leitura = (sf: ts.SourceFile): Leitura => ({
  regra: importados(sf, DA_REGRA),
  administrador: importados(sf, DO_ADMINISTRADOR),
  locais: funcoesDoArquivo(sf),
});

/** Se o corpo chega a uma função da regra, direto ou pelas funções locais, seguidas até o fim e sem laço. */
function chegaNaRegra(corpo: ts.Node, l: Leitura, visto = new Set<string>()): boolean {
  for (const nome of chamados(corpo)) {
    if (l.regra.has(nome)) return true;
    const local = l.locais.get(nome);
    if (local && !visto.has(nome)) {
      visto.add(nome);
      if (chegaNaRegra(local, l, visto)) return true;
    }
  }
  return false;
}

/** Como o corpo confere: pelo administrador, pela regra, ou não confere. */
function comoConfere(corpo: ts.Node, l: Leitura): "administrador" | "regra" | null {
  if ([...chamados(corpo)].some((n) => l.administrador.has(n))) return "administrador";
  return chegaNaRegra(corpo, l) ? "regra" : null;
}

/** Se o corpo lê `.administrador` de alguma coisa (o papel do login da sessão). */
function leOPapel(corpo: ts.Node): boolean {
  let achou = false;
  const andar = (n: ts.Node) => {
    if (ts.isPropertyAccessExpression(n) && n.name.text === "administrador") achou = true;
    ts.forEachChild(n, andar);
  };
  andar(corpo);
  return achou;
}

type Ponto = { chave: string; corpo: ts.Node | null; sf: ts.SourceFile };

/** Cada export de um arquivo "use server": num arquivo desses todo export é action. Sem corpo, `corpo: null`. */
function acoesDe(rel: string, sf: ts.SourceFile): Ponto[] {
  const pontos: Ponto[] = [];
  for (const s of sf.statements) {
    if (!exportado(s) || ts.isInterfaceDeclaration(s) || ts.isTypeAliasDeclaration(s)) continue;
    if (ts.isFunctionDeclaration(s) && s.name && s.body) pontos.push({ chave: `${rel} ${s.name.text}`, corpo: s.body, sf });
    else pontos.push({ chave: `${rel} ${s.getText(sf).split("\n")[0]}`, corpo: null, sf });
  }
  return pontos;
}

const METODOS_HTTP = new Set(["GET", "HEAD", "OPTIONS", "POST", "PUT", "DELETE", "PATCH"]);

/** Cada handler exportado como função de uma rota. As outras formas de export são cobradas por sessao-nas-actions. */
function handlersDe(rel: string, sf: ts.SourceFile): Ponto[] {
  return sf.statements
    .filter((s): s is ts.FunctionDeclaration => ts.isFunctionDeclaration(s) && exportado(s) && !!s.name && METODOS_HTTP.has(s.name.text))
    .map((f) => ({ chave: `${rel} ${f.name!.text}`, corpo: f.body ?? null, sf }));
}

const arquivosUseServer = () => [...arquivosDe("app"), ...arquivosDe("lib")].filter((rel) => ehUseServer(analisar(rel)));
const rotas = () => arquivosDe("app").filter((rel) => /\/route\.tsx?$/.test(rel));

const todasAsAcoes = () => arquivosUseServer().flatMap((rel) => acoesDe(rel, analisar(rel)));
const todosOsHandlers = () => rotas().flatMap((rel) => handlersDe(rel, analisar(rel)));

// A LISTA FECHADA: o que não passa pela regra, e por quê. Um item que deixe de existir derruba o teste, para a
// lista não envelhecer. `leOPapel` exige, no corpo, a leitura do `administrador` do login da sessão.
const FORA_DA_REGRA: Record<string, { motivo: string; leOPapel?: true }> = {
  "app/bonus/actions.ts pedirBonus": { motivo: "o bônus é do painel inteiro (decisão de 03/11)" },
  "app/bonus/actions.ts gerarDeNovo": { motivo: "o bônus é do painel inteiro (decisão de 03/11)" },
  "app/bonus/actions.ts enviarAoLabs": { motivo: "o bônus é do painel inteiro (decisão de 03/11)" },
  "app/bonus/actions.ts conferirNoLabs": { motivo: "o bônus é do painel inteiro (decisão de 03/11)" },
  "app/entrar/actions.ts login": { motivo: "é a ação que cria a sessão" },
  "app/minha-conta/actions.ts trocarMinhaSenha": { motivo: "só mexe no próprio login" },
  "app/minha-conta/actions.ts sair": { motivo: "só mexe no próprio login" },
  "app/api/cron/daily/route.ts GET": { motivo: "rota por segredo, sem login" },
  "app/api/queue/tick/route.ts POST": { motivo: "rota por segredo, sem login" },
  "app/api/webhook/route.ts GET": { motivo: "rota por segredo (o verify token da Meta), sem login" },
  "app/api/webhook/route.ts POST": { motivo: "rota por segredo (a assinatura da Meta), sem login" },
  "app/api/oauth/callback/route.ts GET": {
    motivo: "a volta do OAuth, pelo state: só chega do começo de um administrador ou de um convite",
  },
  "app/api/oauth/convite/[codigo]/route.ts GET": { motivo: "o começo do convite, público, pelo código" },
  "app/api/oauth/login/route.ts GET": {
    motivo: "confere o papel no login da sessão que a rota lê (login.administrador)",
    leOPapel: true,
  },
};

/** As falhas de uma lista de pontos: o que não confere e não está na lista fechada. */
function falhasDe(pontos: Ponto[]): string[] {
  const falhas: string[] = [];
  for (const p of pontos) {
    const fora = FORA_DA_REGRA[p.chave];
    if (fora) {
      if (fora.leOPapel && !(p.corpo && leOPapel(p.corpo))) falhas.push(`${p.chave}: está na lista e não lê o papel`);
      continue;
    }
    if (!p.corpo || !comoConfere(p.corpo, leitura(p.sf))) falhas.push(p.chave);
  }
  return falhas;
}

describe("toda action e toda rota passa pela regra das contas", () => {
  it("o leitor acusa quando há o que acusar", () => {
    const ponto = (fonte: string) => {
      const sf = analisar("x.ts", fonte);
      const f = sf.statements.find((s): s is ts.FunctionDeclaration => ts.isFunctionDeclaration(s) && s.name?.text === "acao")!;
      return comoConfere(f.body!, leitura(sf));
    };
    const regra = 'import { getSelectedAccountId } from "@/lib/account";\n';
    const carrossel = 'import { cabecalhosDoLogin } from "@/lib/bonus/carrossel-acesso";\n';
    // Nada da regra: acusa.
    expect(ponto("export async function acao() { await lerCarrossel(1); }")).toBe(null);
    // A regra direto, e por uma função local, e por duas.
    expect(ponto(`${regra}export async function acao() { return getSelectedAccountId(); }`)).toBe("regra");
    expect(ponto(`${carrossel}async function contas() { return cabecalhosDoLogin(); }\nexport async function acao() { await contas(); }`)).toBe(
      "regra"
    );
    expect(
      ponto(
        `${regra}const a = async () => getSelectedAccountId();\nasync function b() { return a(); }\nexport async function acao() { after(() => b()); }`
      )
    ).toBe("regra");
    // Funções locais em laço, sem a regra no fim: acusa, e não trava.
    expect(ponto("async function a() { return b(); }\nasync function b() { return a(); }\nexport async function acao() { await a(); }")).toBe(
      null
    );
    // O nome da regra sem o import dela não vale: uma função local com o mesmo nome não é a regra.
    expect(ponto("async function getSelectedAccountId() { return 1; }\nexport async function acao() { await getSelectedAccountId(); }")).toBe(
      null
    );
    // E o nome que vem de outro módulo também não.
    expect(ponto('import { getSelectedAccountId } from "./outro";\nexport async function acao() { await getSelectedAccountId(); }')).toBe(null);
    // O import com outro nome vale pelo nome de lá.
    expect(ponto('import { podeVerConta as pode } from "@/lib/acesso";\nexport async function acao() { await pode(l, c); }')).toBe("regra");
    // O administrador, direto; num comentário ou num texto, não.
    expect(ponto('import { exigirAdministrador } from "@/lib/exigir-sessao";\nexport async function acao() { await exigirAdministrador(); }')).toBe(
      "administrador"
    );
    expect(ponto('export async function acao() { // exigirAdministrador()\n const t = "exigirAdministrador()"; }')).toBe(null);
    // O papel lido no corpo.
    const papel = (fonte: string) => leOPapel(analisar("r.ts", fonte));
    expect(papel("export async function GET() { if (!login.administrador) return x; }")).toBe(true);
    expect(papel('export async function GET() { const administrador = "sim"; return x; }')).toBe(false);
  });

  it("a lista fechada não envelhece: cada item dela é uma action ou um handler que existe", () => {
    const existentes = new Set([...todasAsAcoes(), ...todosOsHandlers()].map((p) => p.chave));
    const sumidos = Object.keys(FORA_DA_REGRA).filter((chave) => {
      const rel = chave.slice(0, chave.lastIndexOf(" "));
      return !existsSync(join(RAIZ, rel)) || !existentes.has(chave);
    });
    expect(sumidos).toEqual([]);
  });

  it("o leitor acha as actions e as rotas do carrossel", () => {
    const chaves = [...todasAsAcoes(), ...todosOsHandlers()].map((p) => p.chave);
    for (const chave of [
      "app/bonus/carrossel-actions.ts pedirCarrossel",
      "app/bonus/imagem-actions.ts pedirImagemDoSlide",
      "app/bonus/publicar-actions.ts publicarCarrossel",
      "app/bonus/apagar-actions.ts apagarCarrosselDaPagina",
      "app/carrosseis/actions.ts gerarAvulsoDeNovo",
      "app/bonus/[id]/carrossel/[cid]/arte/route.tsx GET",
      "app/carrosseis/[cid]/imagem/route.ts GET",
      "app/account-actions.ts selectAccount",
      "app/setup/actions.ts reassinarWebhooks",
    ]) {
      expect(chaves, chave).toContain(chave);
    }
  });

  it("cada action exportada chama o administrador ou a regra, ou está na lista fechada", () => {
    expect(falhasDe(todasAsAcoes())).toEqual([]);
  });

  it("cada handler exportado de rota chama o administrador ou a regra, ou está na lista fechada", () => {
    expect(falhasDe(todosOsHandlers())).toEqual([]);
  });
});
```

Em `tests/bonus-arte-conta.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-arte-conta.test.ts b/tests/bonus-arte-conta.test.ts
index 060028f..4869f55 100644
--- a/tests/bonus-arte-conta.test.ts
+++ b/tests/bonus-arte-conta.test.ts
@@ -97,6 +97,38 @@ describe("a conta do Gerar de novo", () => {
   });
 });
 
+// A LISTA PERMITIDA (docs/specs/2026-11-05-contas-por-login.md, seção 2, e achado 179): todo login vê todos
+// os carrosséis, e por isso `contas` continua a lista de todas, para achar a conta gravada e completar o
+// nome. A QUEDA NA LOGADA (o carrossel sem conta, ou com a conta gravada que saiu sem nome) escolhe só nas
+// contas do login: um comum com o cookie de outra conta no navegador nunca cai nela.
+describe("a lista permitida, das contas do login", () => {
+  it("sem conta no carrossel: a queda escolhe na permitida, e o cookie de fora dela não vale", () => {
+    expect(resolverConta(CONTAS, guardada(null), "1002", [A])).toEqual({ conta: A, origem: "selecionada" });
+    expect(resolverConta(CONTAS, guardada(null), "1002", [])).toEqual({ conta: null, origem: "selecionada" });
+  });
+
+  it("a conta gravada que saiu sem nome também cai na permitida", () => {
+    expect(resolverConta(CONTAS, guardada("7777"), "1002", [A])).toEqual({ conta: A, origem: "gravada_saiu" });
+  });
+
+  it("a conta gravada continua achada em `contas`, mesmo fora da permitida", () => {
+    expect(resolverConta(CONTAS, guardada("1002"), "1001", [A])).toEqual({ conta: B, origem: "gravada" });
+  });
+
+  it("sem a permitida, vale a lista toda, como antes", () => {
+    expect(resolverConta(CONTAS, guardada(null), "1002")).toEqual(resolverConta(CONTAS, guardada(null), "1002", CONTAS));
+  });
+
+  it("o Gerar de novo de um original sem conta escolhe na permitida (179)", () => {
+    expect(contaParaGerarDeNovo(CONTAS, guardada(null), "1002", [A])).toEqual(guardada("1001", "Nome de thiagovannuchi", "thiagovannuchi"));
+    expect(contaParaGerarDeNovo(CONTAS, guardada(null), "1002", [])).toBeNull();
+  });
+
+  it("o Gerar de novo de um original com conta e sem nome completa o nome em `contas`, mesmo fora da permitida", () => {
+    expect(contaParaGerarDeNovo(CONTAS, guardada("1002"), "1001", [A])).toEqual(guardada("1002", "Nome de n8x", "n8x"));
+  });
+});
+
 // O NOME QUE FALTA: os carrosséis que ganharam conta na Etapa 3 a guardaram sem o nome. As actions
 // que já gravam num carrossel completam o nome e o @, quando a conta está conectada.
 describe("o nome que falta", () => {
```

- [ ] **Passo 2: ver os testes falharem**

```bash
env -u CLAUDECODE -u AI_AGENT npx vitest run tests/acesso-nas-actions.test.ts tests/bonus-arte-conta.test.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/contas-no-carrossel.integracao.ts
```

Esperado: puros: 2 arquivos falhando, com 5 casos caindo e 27 passando; integração: 1 arquivo falhando, com 13 casos caindo e 9 passando. Cai porque `@/lib/bonus/carrossel-acesso` não existe; no carrossel da B, o comum ainda gera imagem, assina, guarda, publica e apaga; os gerar de novo e o fixar ainda escolhem a B; a varredura acusa, por nome, as 12 actions e as 4 rotas do carrossel.

- [ ] **Passo 3: o código**

Em `app/bonus/[id]/carrossel/[cid]/arte/route.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/[id]/carrossel/[cid]/arte/route.tsx b/app/bonus/[id]/carrossel/[cid]/arte/route.tsx
index 97ef8b6..32d86d8 100644
--- a/app/bonus/[id]/carrossel/[cid]/arte/route.tsx
+++ b/app/bonus/[id]/carrossel/[cid]/arte/route.tsx
@@ -1,8 +1,8 @@
 import { cookies } from "next/headers";
-import { ACCOUNT_COOKIE } from "@/lib/account";
 import { SESSION_COOKIE } from "@/lib/auth";
 import { sessaoDoCookie } from "@/lib/sessao";
 import { desenharSlide, erroDaArte as erro } from "@/lib/bonus/arte-rota";
+import { cabecalhosDoLogin, contaDoMenuNoCarrossel } from "@/lib/bonus/carrossel-acesso";
 import { conferirPedidoDaArte } from "@/lib/bonus/arte-tela";
 import { TEXTO_ARTE_NAO_ENCONTRADA, TEXTO_ARTE_SEM_SESSAO } from "@/lib/bonus/arte-textos";
 import { lerCarrossel } from "@/lib/bonus/carrossel-repositorio";
@@ -23,6 +23,10 @@ import { lerLinha } from "@/lib/bonus/repositorio";
 //
 // O DESENHO MORA EM lib/bonus/arte-rota.ts (Etapa 7), comum a esta rota e à do carrossel avulso
 // (app/carrosseis/[cid]/arte/route.tsx). Esta só serve o carrossel do bônus da URL.
+//
+// A CONTA DO CABEÇALHO, no carrossel sem conta gravada, é a do menu, nas contas do login
+// (docs/specs/2026-11-05-contas-por-login.md, seção 2): as duas são lidas aqui, no corpo do handler, onde
+// tests/acesso-nas-actions.test.ts procura a chamada à regra. Mostrar o carrossel é de todo login.
 
 export const runtime = "nodejs";
 export const dynamic = "force-dynamic";
@@ -38,7 +42,8 @@ export async function GET(request: Request, { params }: { params: Promise<{ id:
   if (!conferido.ok) return erro(conferido.status, conferido.texto);
   return desenharSlide({
     ...conferido,
-    doCookie: jarra.get(ACCOUNT_COOKIE)?.value,
+    doCookie: (await contaDoMenuNoCarrossel())?.ig_user_id,
+    permitidas: await cabecalhosDoLogin(),
     baixar: pedido.get("baixar") === "1",
     // O arquivo baixado leva o endereço do bônus no Labs.
     slug: async () => (await lerLinha(id))?.slug ?? null,
```

Em `app/bonus/[id]/carrossel/[cid]/imagem/route.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/[id]/carrossel/[cid]/imagem/route.ts b/app/bonus/[id]/carrossel/[cid]/imagem/route.ts
index 261a53d..47a46d1 100644
--- a/app/bonus/[id]/carrossel/[cid]/imagem/route.ts
+++ b/app/bonus/[id]/carrossel/[cid]/imagem/route.ts
@@ -1,9 +1,9 @@
 import { cookies } from "next/headers";
-import { ACCOUNT_COOKIE } from "@/lib/account";
 import { SESSION_COOKIE } from "@/lib/auth";
 import { sessaoDoCookie } from "@/lib/sessao";
 import { conferirPedidoDaArte } from "@/lib/bonus/arte-tela";
 import { TEXTO_ARTE_NAO_ENCONTRADA, TEXTO_ARTE_SEM_SESSAO } from "@/lib/bonus/arte-textos";
+import { cabecalhosDoLogin, contaDoMenuNoCarrossel } from "@/lib/bonus/carrossel-acesso";
 import { lerCarrossel } from "@/lib/bonus/carrossel-repositorio";
 import { consultarImagem, respostaDaConsulta } from "@/lib/bonus/imagem-consulta";
 import { ehIdDeBonus } from "@/lib/bonus/pedido";
@@ -14,6 +14,9 @@ import { ehIdDeBonus } from "@/lib/bonus/pedido";
 //
 // A SESSÃO É CONFERIDA AQUI, como na rota da arte ao lado, e não só no proxy.ts. Sem sessão, 401.
 // tests/bonus-imagem-paginas.test.ts confere que isto é a primeira coisa do GET.
+//
+// A CONTA DA MINIATURA, no carrossel sem conta gravada, é a do menu, nas contas do login
+// (docs/specs/2026-11-05-contas-por-login.md, seção 2), lidas aqui, no corpo do handler.
 
 export const runtime = "nodejs";
 export const dynamic = "force-dynamic";
@@ -26,5 +29,12 @@ export async function GET(request: Request, { params }: { params: Promise<{ id:
   // O dono, o "pronto" e o slide, pela mesma conferência da rota da arte.
   const conferido = conferirPedidoDaArte(await lerCarrossel(cid), { tipo: "bonus", bonusId: id }, new URL(request.url).searchParams.get("slide"));
   if (!conferido.ok) return respostaDaConsulta({ erro: conferido.texto }, conferido.status);
-  return respostaDaConsulta(await consultarImagem({ linha: conferido.linha, numero: conferido.numero, doCookie: jarra.get(ACCOUNT_COOKIE)?.value }));
+  return respostaDaConsulta(
+    await consultarImagem({
+      linha: conferido.linha,
+      numero: conferido.numero,
+      doCookie: (await contaDoMenuNoCarrossel())?.ig_user_id,
+      permitidas: await cabecalhosDoLogin(),
+    })
+  );
 }
```

Em `app/bonus/[id]/carrossel/[cid]/revisao.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/[id]/carrossel/[cid]/revisao.tsx b/app/bonus/[id]/carrossel/[cid]/revisao.tsx
index 3d0961a..60704e9 100644
--- a/app/bonus/[id]/carrossel/[cid]/revisao.tsx
+++ b/app/bonus/[id]/carrossel/[cid]/revisao.tsx
@@ -1,15 +1,14 @@
-import { cookies } from "next/headers";
 import { alertError } from "@/app/ui";
 import { fixarContaDoCarrossel, salvarArteDoCarrossel, salvarSlideDoCarrossel } from "@/app/bonus/carrossel-actions";
 import { pedirImagemDoSlide } from "@/app/bonus/imagem-actions";
 import { assinarImagemDoCarrossel, guardarImagemDoSlide, publicarCarrossel } from "@/app/bonus/publicar-actions";
-import { ACCOUNT_COOKIE } from "@/lib/account";
 import { urlPublicaSeDerParaMontar } from "@/lib/bucket";
-import { contaSelecionada, resolverConta } from "@/lib/bonus/arte-conta";
+import { resolverConta } from "@/lib/bonus/arte-conta";
 import { escolhasDaArte } from "@/lib/bonus/arte-escolhas";
 import { slidesDoTexto } from "@/lib/bonus/arte-slides";
 import { cabecalhoParaVersao, versoesDosSlides } from "@/lib/bonus/arte-tela";
 import { TEXTO_ARTE_SEM_CONTA, rotuloDaConta, textoDaOrigemDaConta } from "@/lib/bonus/arte-textos";
+import { cabecalhosDoLogin, contaDoMenuNoCarrossel } from "@/lib/bonus/carrossel-acesso";
 import { caminhoDoCarrossel } from "@/lib/bonus/carrossel-caminho";
 import type { LinhaDoCarrossel } from "@/lib/bonus/carrossel-linha";
 import { contasParaArte } from "@/lib/bonus/carrossel-repositorio";
@@ -55,14 +54,15 @@ export default async function Revisao({ carrossel }: { carrossel: LinhaDoCarross
   const texto = textoDaLinhaDoCarrossel(carrossel);
   if (!texto) return <div className={alertError}>{TEXTO_CARROSSEL_SEM_TEXTO}</div>;
 
+  // AS DUAS LISTAS (docs/specs/2026-11-05-contas-por-login.md, seção 2): todas as contas, para mostrar a
+  // do carrossel (todo login vê todos), e as do login, onde a conta do menu e a queda na logada escolhem.
   const contas = await contasParaArte();
   const escolhas = escolhasDaArte(carrossel.arte, carrossel.total_slides);
-  const doCookie = (await cookies()).get(ACCOUNT_COOKIE)?.value;
-  const { conta, origem } = resolverConta(contas, escolhas, doCookie);
+  const noMenu = await contaDoMenuNoCarrossel();
+  const { conta, origem } = resolverConta(contas, escolhas, noMenu?.ig_user_id, await cabecalhosDoLogin());
 
   const estado = await estadoDoCarrossel(carrossel.arte);
   const filaId = "filaId" in estado ? estado.filaId : null;
-  const noMenu = contaSelecionada(contas, doCookie);
   // O jeito de cada imagem é o prefixo do caminho (adendo da Etapa 5): as fotos são as de `bonus-foto`, e
   // a capa, a de `bonus-capa` (Etapa 11). `imagensDaArte` só lê caminho com jeito.
   const fotos = fotosDaArte(carrossel.arte, carrossel.total_slides);
```

Em `app/bonus/apagar-actions.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/apagar-actions.ts b/app/bonus/apagar-actions.ts
index 11461ce..4a13d6f 100644
--- a/app/bonus/apagar-actions.ts
+++ b/app/bonus/apagar-actions.ts
@@ -1,8 +1,10 @@
 "use server";
 import { redirect } from "next/navigation";
+import { FRASE_CARROSSEL_DE_OUTRA_CONTA } from "@/lib/logins-textos";
 import { sessaoAtual } from "@/lib/sessao";
 import { apagarCarrossel } from "@/lib/bonus/apagar-carrossel";
 import { textoDoApagar, type AvisoDoApagar } from "@/lib/bonus/apagar-textos";
+import { carrosselDeOutraConta } from "@/lib/bonus/carrossel-acesso";
 import { urlDepoisDeApagar } from "@/lib/bonus/carrosseis-tela";
 import { ehIdDeBonus } from "@/lib/bonus/pedido";
 import { TEXTO_PEDIDO_INVALIDO } from "@/lib/bonus/publicar-textos";
@@ -16,6 +18,10 @@ import { TEXTO_PEDIDO_INVALIDO } from "@/lib/bonus/publicar-textos";
 // agendado em outra aba, por exemplo. Sai por redirect só o sucesso, para a lista na aba "Rascunhos", com
 // o aviso em verde (`urlDepoisDeApagar`, achado 92). Do formulário vem só o id: a regra e a trava são as
 // do servidor (lib/bonus/apagar-carrossel.ts).
+//
+// O CARROSSEL QUE JÁ TEM CONTA SÓ É APAGADO POR QUEM TEM A CONTA (docs/specs/2026-11-05-contas-por-login.md,
+// seção 3): o de outra conta é recusado logo depois da validação do id. O carrossel sem conta qualquer login
+// apaga (`carrosselDeOutraConta` diz falso para ele).
 
 async function exigirSessao(): Promise<void> {
   if (!(await sessaoAtual())) redirect("/entrar");
@@ -27,6 +33,7 @@ export async function apagarCarrosselDaPagina(_anterior: AvisoDoApagar | null, f
   const id = form.get("id");
   const em = Date.now();
   if (!ehIdDeBonus(id)) return { tom: "erro", texto: TEXTO_PEDIDO_INVALIDO, em };
+  if (await carrosselDeOutraConta(id)) return { tom: "erro", texto: FRASE_CARROSSEL_DE_OUTRA_CONTA, em };
   const r = await apagarCarrossel(id);
   if (!r.ok) return { tom: "erro", texto: textoDoApagar(r.motivo), em };
   redirect(urlDepoisDeApagar());
```

Em `app/bonus/carrossel-actions.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/carrossel-actions.ts b/app/bonus/carrossel-actions.ts
index cf6f5a4..1d4e4ad 100644
--- a/app/bonus/carrossel-actions.ts
+++ b/app/bonus/carrossel-actions.ts
@@ -1,13 +1,11 @@
 "use server";
 import { after } from "next/server";
-import { cookies } from "next/headers";
 import { redirect } from "next/navigation";
-import { ACCOUNT_COOKIE } from "@/lib/account";
+import { FRASE_SEM_CONTAS } from "@/lib/logins-textos";
 import { sessaoAtual } from "@/lib/sessao";
 import {
   contaParaGerarDeNovo,
   contaParaGuardar,
-  contaSelecionada,
   nomeQueFalta,
   resolverConta,
   type ContaGuardada,
@@ -22,6 +20,7 @@ import {
   textoDaRecusaDaArte,
   type AvisoDaArte,
 } from "@/lib/bonus/arte-textos";
+import { cabecalhosDoLogin, contaDoMenuNoCarrossel } from "@/lib/bonus/carrossel-acesso";
 import { caminhoDoCarrossel } from "@/lib/bonus/carrossel-caminho";
 import type { ContextoDoCarrossel } from "@/lib/bonus/carrossel-ia-parametros";
 import { lerPedidoDeCarrossel } from "@/lib/bonus/carrossel-pedido";
@@ -68,6 +67,11 @@ import { TEXTO_BONUS_NAO_ENCONTRADO, textoDaConfig, urlDoBonusComAviso } from "@
 //
 // A PALAVRA E O CONTEXTO SÃO LIDOS DO LABS AQUI, NO SERVIDOR, a cada pedido, e nunca aceitos do
 // formulário: a página aberta pode estar velha.
+//
+// A CONTA DE UM CARROSSEL NOVO É UMA DAS DO LOGIN (docs/specs/2026-11-05-contas-por-login.md, seção 2, e
+// achado 179): a do menu, escolhida na lista do login (`contaDoMenuNoCarrossel` e `cabecalhosDoLogin`,
+// lib/bonus/carrossel-acesso.ts, que leem só as quatro colunas do cabeçalho, achado 60). `contasParaArte`,
+// a lista de todas, fica para mostrar: todo login vê e edita todos os carrosséis.
 
 async function exigirSessao(): Promise<void> {
   if (!(await sessaoAtual())) redirect("/entrar");
@@ -79,12 +83,13 @@ async function exigirSessao(): Promise<void> {
  * de um GET; o pedido já é uma escrita.
  */
 async function contaDoPedido(): Promise<ContaGuardada | null> {
-  const logada = contaSelecionada(await contasParaArte(), await contaDoCookie());
+  const logada = await contaDoMenuNoCarrossel();
   return logada ? contaParaGuardar(logada) : null;
 }
 
-async function contaDoCookie(): Promise<string | undefined> {
-  return (await cookies()).get(ACCOUNT_COOKIE)?.value;
+/** O id da conta do menu, para as funções puras de lib/bonus/arte-conta.ts. */
+async function contaDoMenu(): Promise<string | undefined> {
+  return (await contaDoMenuNoCarrossel())?.ig_user_id;
 }
 
 /** O bônus pronto para carrossel: criado no Labs e publicado lá. Qualquer outra coisa é recusa. */
@@ -160,7 +165,8 @@ export async function gerarCarrosselDeNovo(form: FormData): Promise<void> {
   const bonus = await bonusParaCarrossel(bonusId);
   if (!bonus.ok) redirect(urlDoCarrosselComAviso(caminho, { tom: "erro", texto: bonus.texto }));
   // O novo herda a conta do original, mesmo desconectada (decisão do Eduardo em 02/10): gerar de
-  // novo um carrossel do Thiago com o Chat na N8X faz outro do Thiago.
+  // novo um carrossel do Thiago com o Chat na N8X faz outro do Thiago. O original sem conta usa a
+  // logada, escolhida nas contas do login (achado 179).
   const criado = await criarPedidoDeCarrossel({
     bonusId,
     total: linha.total_slides,
@@ -169,7 +175,8 @@ export async function gerarCarrosselDeNovo(form: FormData): Promise<void> {
     conta: contaParaGerarDeNovo(
       await contasParaArte(),
       escolhasDaArte(linha.arte, linha.total_slides),
-      await contaDoCookie()
+      await contaDoMenu(),
+      await cabecalhosDoLogin()
     ),
   });
   if (!criado.ok) redirect(urlDoCarrosselComAviso(caminho, { tom: "erro", texto: textoDoTetoDoCarrossel() }));
@@ -213,7 +220,7 @@ export async function salvarSlideDoCarrossel(_anterior: AvisoDoSlide | null, for
   if (!r.ok) return resposta("erro", `Corrija antes de salvar. ${textoDosProblemasDoCarrossel(total, r.problemas)}`);
   const texto = textoDaParteSalva(parte, total, r.avisos);
   if (parte.tipo === "legenda") return resposta("ok", texto);
-  const { conta } = resolverConta(contas, escolhas, await contaDoCookie());
+  const { conta } = resolverConta(contas, escolhas, await contaDoMenu(), await cabecalhosDoLogin());
   const slides = slidesDoTexto(r.texto);
   const versoes = versoesDosSlides(slides, escolhas.soTexto, cabecalhoParaVersao(conta), fotosDaArte(linha.arte, total), capaDaArte(linha.arte, total));
   // A versão do texto salvo vai junto (Etapa 5): o card compara com a da imagem do Canva guardada.
@@ -252,7 +259,7 @@ export async function salvarArteDoCarrossel(_anterior: AvisoDaArte | null, form:
   const escolhas = escolhasDaArte(linha.arte, linha.total_slides);
   const salvou = await salvarSoTextoDaArte(id, lido.soTexto, nomeQueFalta(contas, escolhas), capa.capa);
   if (!salvou.ok) return resposta("erro", salvou.motivo === "travado" ? textoDaTrava(salvou.estado) : TEXTO_ARTE_NAO_PRONTA);
-  const { conta } = resolverConta(contas, escolhas, await contaDoCookie());
+  const { conta } = resolverConta(contas, escolhas, await contaDoMenu(), await cabecalhosDoLogin());
   // A capa como ficou gravada: as imagens são as de antes, com o jeito novo do slide 1.
   const arteNova = { ...(linha.arte as Record<string, unknown>), soTexto: lido.soTexto, capa: capa.capa };
   return resposta(
@@ -272,6 +279,9 @@ export async function salvarArteDoCarrossel(_anterior: AvisoDaArte | null, form:
  * "FIXAR NESTA CONTA" (decisão do Eduardo em 02/10): o carrossel de antes da 015, sem conta gravada,
  * passa a ser da conta logada agora, com o nome e o @, uma vez só. A resposta volta como estado,
  * como as outras da página.
+ *
+ * A CONTA SAI DAS CONTAS DO LOGIN (docs/specs/2026-11-05-contas-por-login.md, seção 3): a escolhida no
+ * menu, na lista do login. O login sem contas recebe a frase de quem não tem contas, e nada é gravado.
  */
 export async function fixarContaDoCarrossel(_anterior: AvisoDaArte | null, form: FormData): Promise<AvisoDaArte | null> {
   await exigirSessao();
@@ -282,8 +292,8 @@ export async function fixarContaDoCarrossel(_anterior: AvisoDaArte | null, form:
   const resposta = (tom: AvisoDaArte["tom"], texto: string): AvisoDaArte => ({ tom, texto, em: Date.now() });
   if (linha.estado !== "pronto" || !textoDaLinhaDoCarrossel(linha)) return resposta("erro", TEXTO_ARTE_NAO_PRONTA);
   if (escolhasDaArte(linha.arte, linha.total_slides).conta) return resposta("erro", textoDaRecusaDaArte("ja_tem_conta"));
-  const logada = contaSelecionada(await contasParaArte(), await contaDoCookie());
-  if (!logada) return resposta("erro", textoDaRecusaDaArte("sem_conta"));
+  const logada = await contaDoMenuNoCarrossel();
+  if (!logada) return resposta("erro", FRASE_SEM_CONTAS);
   // O `where` do repositório recusa quem já tem conta: outra aba pode ter fixado no meio.
   const fixou = await gravarContaFixada(id, contaParaGuardar(logada));
   return fixou ? resposta("ok", TEXTO_CONTA_FIXADA) : resposta("erro", textoDaRecusaDaArte("ja_tem_conta"));
```

Em `app/bonus/imagem-actions.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/imagem-actions.ts b/app/bonus/imagem-actions.ts
index b5245e3..f78106e 100644
--- a/app/bonus/imagem-actions.ts
+++ b/app/bonus/imagem-actions.ts
@@ -1,8 +1,9 @@
 "use server";
 import { after } from "next/server";
 import { redirect } from "next/navigation";
+import { FRASE_CARROSSEL_DE_OUTRA_CONTA } from "@/lib/logins-textos";
 import { sessaoAtual } from "@/lib/sessao";
-import { contasParaArte } from "@/lib/bonus/carrossel-repositorio";
+import { cabecalhosDoLogin, carrosselDeOutraConta } from "@/lib/bonus/carrossel-acesso";
 import { gerarImagem, pedirImagem } from "@/lib/bonus/imagem-processo";
 import { TEXTO_GERANDO_A_IMAGEM, textoDaRecusaDaImagem, type AvisoDoPedidoDeImagem } from "@/lib/bonus/imagem-textos";
 import { ehIdDeBonus } from "@/lib/bonus/pedido";
@@ -17,6 +18,11 @@ import { TEXTO_PEDIDO_INVALIDO } from "@/lib/bonus/publicar-textos";
 // ~30 s prenderia o salvar, o "Só texto" e o publicar da página inteira. O pedido confere, reserva e
 // responde na hora; a geração roda no `after()`, dentro do `maxDuration` da página, e o card acompanha
 // pela rota GET da consulta. A resposta volta como estado, e nunca por redirect (achado 52).
+//
+// SÓ NAS CONTAS DO LOGIN (docs/specs/2026-11-05-contas-por-login.md, seção 3): o carrossel de uma conta que
+// o login não tem é recusado logo depois da validação do id, antes de qualquer custo ou reserva. O processo
+// recebe as contas do login (`cabecalhosDoLogin`), e não todas, como rede: a conta gravada fora delas
+// também seria recusada lá dentro.
 
 async function exigirSessao(): Promise<void> {
   if (!(await sessaoAtual())) redirect("/entrar");
@@ -33,9 +39,10 @@ export async function pedirImagemDoSlide(pedido: unknown): Promise<AvisoDoPedido
   const em = Date.now();
   if (!ehIdDeBonus(p.id) || typeof p.descricao !== "string") return { tom: "erro", texto: TEXTO_PEDIDO_INVALIDO, em };
   const id = p.id;
+  if (await carrosselDeOutraConta(id)) return { tom: "erro", texto: FRASE_CARROSSEL_DE_OUTRA_CONTA, em };
   const numero = inteiro(p.numero);
   const descricao = p.descricao;
-  const contas = await contasParaArte();
+  const contas = await cabecalhosDoLogin();
   const r = await pedirImagem({ id, numero, descricao, contas });
   if (!r.ok) return { tom: "erro", texto: textoDaRecusaDaImagem(r.recusa), em, ...(r.hoje === undefined ? {} : { hoje: r.hoje }) };
   const { reservaId, formato } = r;
```

Em `app/bonus/publicar-actions.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/publicar-actions.ts b/app/bonus/publicar-actions.ts
index 3844fa1..121d229 100644
--- a/app/bonus/publicar-actions.ts
+++ b/app/bonus/publicar-actions.ts
@@ -1,8 +1,9 @@
 "use server";
 import { redirect } from "next/navigation";
+import { FRASE_CARROSSEL_DE_OUTRA_CONTA } from "@/lib/logins-textos";
 import { sessaoAtual } from "@/lib/sessao";
 import { urlPublicaSeDerParaMontar } from "@/lib/bucket";
-import { contasParaArte } from "@/lib/bonus/carrossel-repositorio";
+import { cabecalhosDoLogin, carrosselDeOutraConta } from "@/lib/bonus/carrossel-acesso";
 import { ehIdDeBonus } from "@/lib/bonus/pedido";
 import { assinarImagem, guardarImagem, publicarNaFila, type ArteSubida } from "@/lib/bonus/publicar-processo";
 import {
@@ -26,6 +27,10 @@ import { camposDaDataHora, fusoDoCampo, instanteDoAgendamento, momentoDaPublicac
 // (lib/bonus/publicar-processo.ts), onde mora tudo o que decide e grava. A CONTA NUNCA VEM DO
 // NAVEGADOR: é a gravada no carrossel. A resposta volta como estado, e nunca por redirect (achado 52):
 // recriar a página apagaria o que está digitado nos outros cards.
+//
+// SÓ NAS CONTAS DO LOGIN (docs/specs/2026-11-05-contas-por-login.md, seção 3): o carrossel de uma conta que
+// o login não tem é recusado logo depois da validação do id, antes do bucket e da fila. O processo recebe as
+// contas do login (`cabecalhosDoLogin`), e não todas, como rede.
 
 async function exigirSessao(): Promise<void> {
   if (!(await sessaoAtual())) redirect("/entrar");
@@ -48,7 +53,8 @@ export async function assinarImagemDoCarrossel(pedido: unknown): Promise<Respost
   const destino =
     p.destino === "slide" || p.destino === "foto" || p.destino === "fila" || p.destino === "capa" ? p.destino : null;
   if (!ehIdDeBonus(p.id) || !destino) return { ok: false, texto: TEXTO_PEDIDO_INVALIDO };
-  const r = await assinarImagem({ id: p.id, numero: inteiro(p.numero), destino, arquivo: p.arquivo, contas: await contasParaArte() });
+  if (await carrosselDeOutraConta(p.id)) return { ok: false, texto: FRASE_CARROSSEL_DE_OUTRA_CONTA };
+  const r = await assinarImagem({ id: p.id, numero: inteiro(p.numero), destino, arquivo: p.arquivo, contas: await cabecalhosDoLogin() });
   return r.ok ? { ok: true, caminho: r.caminho, url: r.url } : { ok: false, texto: textoDaRecusaDaPublicacaoDoCarrossel(r.recusa) };
 }
 
@@ -61,7 +67,8 @@ export async function guardarImagemDoSlide(pedido: unknown): Promise<AvisoDaImag
   const p = registro(pedido);
   const em = Date.now();
   if (!ehIdDeBonus(p.id) || typeof p.caminho !== "string") return { tom: "erro", texto: TEXTO_PEDIDO_INVALIDO, em };
-  const r = await guardarImagem({ id: p.id, numero: inteiro(p.numero), caminho: p.caminho, contas: await contasParaArte() });
+  if (await carrosselDeOutraConta(p.id)) return { tom: "erro", texto: FRASE_CARROSSEL_DE_OUTRA_CONTA, em };
+  const r = await guardarImagem({ id: p.id, numero: inteiro(p.numero), caminho: p.caminho, contas: await cabecalhosDoLogin() });
   if (!r.ok) return { tom: "erro", texto: textoDaRecusaDaPublicacaoDoCarrossel(r.recusa), em };
   return {
     tom: "ok",
@@ -83,6 +90,7 @@ export async function publicarCarrossel(pedido: unknown): Promise<AvisoDaPublica
   const p = registro(pedido);
   const em = Date.now();
   if (!ehIdDeBonus(p.id)) return { tom: "erro", texto: TEXTO_PEDIDO_INVALIDO, em };
+  if (await carrosselDeOutraConta(p.id)) return { tom: "erro", texto: FRASE_CARROSSEL_DE_OUTRA_CONTA, em };
   const campos = camposDaDataHora(p.dataHora);
   const momento = momentoDaPublicacao(p.quando, campos ? instanteDoAgendamento(campos, fusoDoCampo(p.fuso)) : null, Date.now());
   if (!momento.ok) return { tom: "erro", texto: textoDaRecusaDaPublicacao(momento.motivo), em };
@@ -90,7 +98,7 @@ export async function publicarCarrossel(pedido: unknown): Promise<AvisoDaPublica
     const r = registro(a);
     return { numero: inteiro(r.numero), caminho: r.caminho, versao: r.versao };
   });
-  const r = await publicarNaFila({ id: p.id, quando: momento.quando, artes, contas: await contasParaArte() });
+  const r = await publicarNaFila({ id: p.id, quando: momento.quando, artes, contas: await cabecalhosDoLogin() });
   return r.ok
     ? { tom: "ok", texto: textoDaPublicacaoMandada(!r.jaVale), em }
     : { tom: "erro", texto: textoDaRecusaDaPublicacaoDoCarrossel(r.recusa), em };
```

Em `app/carrosseis/[cid]/arte/route.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/carrosseis/[cid]/arte/route.tsx b/app/carrosseis/[cid]/arte/route.tsx
index b49c183..738ae48 100644
--- a/app/carrosseis/[cid]/arte/route.tsx
+++ b/app/carrosseis/[cid]/arte/route.tsx
@@ -1,8 +1,8 @@
 import { cookies } from "next/headers";
-import { ACCOUNT_COOKIE } from "@/lib/account";
 import { SESSION_COOKIE } from "@/lib/auth";
 import { sessaoDoCookie } from "@/lib/sessao";
 import { desenharSlide, erroDaArte as erro } from "@/lib/bonus/arte-rota";
+import { cabecalhosDoLogin, contaDoMenuNoCarrossel } from "@/lib/bonus/carrossel-acesso";
 import { conferirPedidoDaArte } from "@/lib/bonus/arte-tela";
 import { TEXTO_ARTE_NAO_ENCONTRADA, TEXTO_ARTE_SEM_SESSAO } from "@/lib/bonus/arte-textos";
 import { lerCarrossel } from "@/lib/bonus/carrossel-repositorio";
@@ -17,6 +17,9 @@ import { ehIdDeBonus } from "@/lib/bonus/pedido";
 // tests/bonus-arte-paginas.test.ts confere que isto é a primeira coisa do GET.
 //
 // O arquivo baixado leva o código do bônus do Labs, ou "carrossel" no texto livre (`nomeDoArquivo`).
+//
+// A CONTA DO CABEÇALHO, no carrossel sem conta gravada, é a do menu, nas contas do login, lidas aqui como na
+// rota do bônus (docs/specs/2026-11-05-contas-por-login.md, seção 2).
 
 export const runtime = "nodejs";
 export const dynamic = "force-dynamic";
@@ -31,7 +34,8 @@ export async function GET(request: Request, { params }: { params: Promise<{ cid:
   if (!conferido.ok) return erro(conferido.status, conferido.texto);
   return desenharSlide({
     ...conferido,
-    doCookie: jarra.get(ACCOUNT_COOKIE)?.value,
+    doCookie: (await contaDoMenuNoCarrossel())?.ig_user_id,
+    permitidas: await cabecalhosDoLogin(),
     baixar: pedido.get("baixar") === "1",
     slug: async () => conferido.linha.labs_codigo,
   });
```

Em `app/carrosseis/[cid]/imagem/route.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/carrosseis/[cid]/imagem/route.ts b/app/carrosseis/[cid]/imagem/route.ts
index fde00a8..9e1fa42 100644
--- a/app/carrosseis/[cid]/imagem/route.ts
+++ b/app/carrosseis/[cid]/imagem/route.ts
@@ -1,9 +1,9 @@
 import { cookies } from "next/headers";
-import { ACCOUNT_COOKIE } from "@/lib/account";
 import { SESSION_COOKIE } from "@/lib/auth";
 import { sessaoDoCookie } from "@/lib/sessao";
 import { conferirPedidoDaArte } from "@/lib/bonus/arte-tela";
 import { TEXTO_ARTE_NAO_ENCONTRADA, TEXTO_ARTE_SEM_SESSAO } from "@/lib/bonus/arte-textos";
+import { cabecalhosDoLogin, contaDoMenuNoCarrossel } from "@/lib/bonus/carrossel-acesso";
 import { lerCarrossel } from "@/lib/bonus/carrossel-repositorio";
 import { consultarImagem, respostaDaConsulta } from "@/lib/bonus/imagem-consulta";
 import { ehIdDeBonus } from "@/lib/bonus/pedido";
@@ -14,6 +14,9 @@ import { ehIdDeBonus } from "@/lib/bonus/pedido";
 //
 // É uma rota GET, e não uma action, para nunca entrar na fila das actions da página (achado 88).
 // tests/bonus-imagem-paginas.test.ts confere que a sessão é a primeira coisa do GET.
+//
+// A CONTA DA MINIATURA, no carrossel sem conta gravada, é a do menu, nas contas do login, lidas aqui como na
+// rota do bônus (docs/specs/2026-11-05-contas-por-login.md, seção 2).
 
 export const runtime = "nodejs";
 export const dynamic = "force-dynamic";
@@ -25,5 +28,12 @@ export async function GET(request: Request, { params }: { params: Promise<{ cid:
   if (!ehIdDeBonus(cid)) return respostaDaConsulta({ erro: TEXTO_ARTE_NAO_ENCONTRADA }, 404);
   const conferido = conferirPedidoDaArte(await lerCarrossel(cid), { tipo: "avulso" }, new URL(request.url).searchParams.get("slide"));
   if (!conferido.ok) return respostaDaConsulta({ erro: conferido.texto }, conferido.status);
-  return respostaDaConsulta(await consultarImagem({ linha: conferido.linha, numero: conferido.numero, doCookie: jarra.get(ACCOUNT_COOKIE)?.value }));
+  return respostaDaConsulta(
+    await consultarImagem({
+      linha: conferido.linha,
+      numero: conferido.numero,
+      doCookie: (await contaDoMenuNoCarrossel())?.ig_user_id,
+      permitidas: await cabecalhosDoLogin(),
+    })
+  );
 }
```

Em `app/carrosseis/actions.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/carrosseis/actions.ts b/app/carrosseis/actions.ts
index 2b11813..88430bd 100644
--- a/app/carrosseis/actions.ts
+++ b/app/carrosseis/actions.ts
@@ -1,14 +1,13 @@
 "use server";
 import { after } from "next/server";
-import { cookies } from "next/headers";
 import { redirect } from "next/navigation";
-import { ACCOUNT_COOKIE } from "@/lib/account";
 import { sessaoAtual } from "@/lib/sessao";
-import { contaParaGerarDeNovo, contaParaGuardar, contaSelecionada } from "@/lib/bonus/arte-conta";
+import { contaParaGerarDeNovo, contaParaGuardar } from "@/lib/bonus/arte-conta";
 import { escolhasDaArte } from "@/lib/bonus/arte-escolhas";
 import { lerPedidoAvulso } from "@/lib/bonus/avulso-pedido";
 import { gerarAvulsoDeNovo as gerarDeNovo, pedirAvulso } from "@/lib/bonus/avulso-processo";
 import { textoDaRecusaDoPedidoAvulso, type AvisoDoAvulso } from "@/lib/bonus/avulso-textos";
+import { cabecalhosDoLogin, contaDoMenuNoCarrossel } from "@/lib/bonus/carrossel-acesso";
 import { caminhoDoCarrossel, ehDaRota } from "@/lib/bonus/carrossel-caminho";
 import { processarCarrossel } from "@/lib/bonus/carrossel-processo";
 import { contasParaArte, lerCarrossel } from "@/lib/bonus/carrossel-repositorio";
@@ -28,7 +27,10 @@ import { textoDaConfig } from "@/lib/bonus/textos";
 // `await exigirSessao();`.
 //
 // O BÔNUS DO LABS É LIDO AQUI, NO SERVIDOR, a cada pedido (avulso-processo.ts): do formulário vem só o
-// código, e a palavra e o contexto vêm da lista pública. A conta é a do cookie, e nunca do formulário.
+// código, e a palavra e o contexto vêm da lista pública. A conta é a escolhida no menu, e nunca do
+// formulário: desde as contas por login (docs/specs/2026-11-05-contas-por-login.md, seção 2, e achado
+// 179), ela sai das contas do login (`contaDoMenuNoCarrossel` e `cabecalhosDoLogin`,
+// lib/bonus/carrossel-acesso.ts), e o cookie só desempata dentro delas.
 
 async function exigirSessao(): Promise<void> {
   if (!(await sessaoAtual())) redirect("/entrar");
@@ -36,8 +38,9 @@ async function exigirSessao(): Promise<void> {
 
 const lerSituacao = (codigo: string) => situacaoDoAvulsoNoLabs(process.env.LABS_URL, codigo);
 
-async function contaDoCookie(): Promise<string | undefined> {
-  return (await cookies()).get(ACCOUNT_COOKIE)?.value;
+/** O id da conta do menu, para as funções puras de lib/bonus/arte-conta.ts. */
+async function contaDoMenu(): Promise<string | undefined> {
+  return (await contaDoMenuNoCarrossel())?.ig_user_id;
 }
 
 /**
@@ -65,7 +68,7 @@ export async function pedirCarrosselAvulso(_anterior: AvisoDoAvulso | null, form
   if (lido.pedido.jeito === "ia" && !temChaveDaIA(process.env)) return recusa(textoDaConfig("sem_chave_ia"));
   // Os campos do texto escrito à mão, pelos nomes da tela (a fonte única deles, carrossel-texto.ts).
   const bruto = Object.fromEntries(camposDoFormulario(lido.pedido.total).map((c) => [c.nome, form.get(c.nome)]));
-  const logada = contaSelecionada(await contasParaArte(), await contaDoCookie());
+  const logada = await contaDoMenuNoCarrossel();
   const r = await pedirAvulso({ pedido: lido.pedido, bruto, conta: logada ? contaParaGuardar(logada) : null, lerSituacao });
   if (!r.ok) return recusa(r.texto);
   const id = r.id;
@@ -87,7 +90,12 @@ export async function gerarAvulsoDeNovo(form: FormData): Promise<void> {
   if (!linha || !ehDaRota(linha, { tipo: "avulso" })) redirect(naoAchado);
   const caminho = caminhoDoCarrossel(linha);
   if (!temChaveDaIA(process.env)) redirect(urlDoCarrosselComAviso(caminho, { tom: "erro", texto: textoDaConfig("sem_chave_ia") }));
-  const conta = contaParaGerarDeNovo(await contasParaArte(), escolhasDaArte(linha.arte, linha.total_slides), await contaDoCookie());
+  const conta = contaParaGerarDeNovo(
+    await contasParaArte(),
+    escolhasDaArte(linha.arte, linha.total_slides),
+    await contaDoMenu(),
+    await cabecalhosDoLogin()
+  );
   const r = await gerarDeNovo({ linha, conta, lerSituacao, agora: Date.now() });
   if (!r.ok) redirect(urlDoCarrosselComAviso(caminho, { tom: "erro", texto: r.texto }));
   const novo = r.id;
```

Em `app/carrosseis/page.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/carrosseis/page.tsx b/app/carrosseis/page.tsx
index 5380dd4..81ac25b 100644
--- a/app/carrosseis/page.tsx
+++ b/app/carrosseis/page.tsx
@@ -1,10 +1,9 @@
 import Link from "next/link";
-import { cookies } from "next/headers";
 import { alertError, alertOk, btnPrimary, pageSubtitle, pageTitle } from "@/app/ui";
-import { ACCOUNT_COOKIE } from "@/lib/account";
 import { avisoDaUrl } from "@/lib/avisos";
 import { urlPublicaSeDerParaMontar } from "@/lib/bucket";
 import { abaDoEndereco, capaDoCarrossel, itemDaListaDeCarrosseis, separarPorAba } from "@/lib/bonus/carrosseis-tela";
+import { cabecalhosDoLogin, contaDoMenuNoCarrossel } from "@/lib/bonus/carrossel-acesso";
 import type { LinhaDoCarrossel } from "@/lib/bonus/carrossel-linha";
 import { contasParaArte, listarCarrosseis } from "@/lib/bonus/carrossel-repositorio";
 import { TEXTO_TABELA_CARROSSEL_AUSENTE } from "@/lib/bonus/carrossel-textos";
@@ -19,7 +18,9 @@ import ListaDeCarrosseis from "./lista";
 //
 // AS ABAS (spec da Etapa 10): "Rascunhos", "Agendados" e "Publicados", pelo estado da publicação de hoje,
 // com a aba no endereço (`?aba=`). A CAPA de cada linha é a miniatura do slide 1, calculada como a página
-// do carrossel calcula: as contas do cabeçalho são lidas uma vez, com o cookie da conta.
+// do carrossel calcula: as contas do cabeçalho são lidas uma vez, com a conta do menu e as contas do login
+// (docs/specs/2026-11-05-contas-por-login.md, seção 2: todo login vê todos os carrosséis, e a queda na
+// logada escolhe só nas contas dele).
 //
 // O ESTADO DA PUBLICAÇÃO é lido da fila só para o carrossel que tem publicação guardada: os outros
 // não pagam a consulta.
@@ -49,7 +50,8 @@ export default async function Carrosseis({
   }
   const estados = await Promise.all(linhas.map((l) => (publicacaoDaArte(l.arte) === null ? null : estadoDoCarrossel(l.arte))));
   const contas = await contasParaArte();
-  const doCookie = (await cookies()).get(ACCOUNT_COOKIE)?.value;
+  const doCookie = (await contaDoMenuNoCarrossel())?.ig_user_id;
+  const permitidas = await cabecalhosDoLogin();
   // Server Component `async` e `force-dynamic`: roda UMA vez por requisição, e ler o
   // relógio aqui é o comportamento pedido. A regra trata todo arquivo como cliente;
   // o dono silencia do mesmo jeito, com o motivo por extenso, em app/page.tsx:322-333.
@@ -59,7 +61,7 @@ export default async function Carrosseis({
     linhas.map((linha, i) => ({ linha, estado: estados[i] })),
     aba
   );
-  const contexto = { contas, doCookie, urlPublica: urlPublicaSeDerParaMontar };
+  const contexto = { contas, doCookie, permitidas, urlPublica: urlPublicaSeDerParaMontar };
 
   return (
     <div className="space-y-6">
```

Em `lib/bonus/arte-conta.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/arte-conta.ts b/lib/bonus/arte-conta.ts
index 5b4e33a..3f737a5 100644
--- a/lib/bonus/arte-conta.ts
+++ b/lib/bonus/arte-conta.ts
@@ -5,6 +5,11 @@
 // (com a foto); desconectada, os guardados (com as iniciais, porque o Chat apaga a linha da conta).
 // A "conta logada" é a selecionada no painel (lib/account.ts, `getSelectedAccount`): a do cookie,
 // e sem ela a primeira conectada. Estas funções não leem o cookie nem o banco: recebem os dois.
+//
+// DESDE AS CONTAS POR LOGIN (docs/specs/2026-11-05-contas-por-login.md, seção 2, e achado 179), são DUAS
+// listas: `contas`, todas as conectadas, para achar a conta gravada e completar o nome (todo login vê todos
+// os carrosséis); e `permitidas`, as do login (lib/bonus/carrossel-acesso.ts, `cabecalhosDoLogin`), onde a
+// queda na logada escolhe. Sem `permitidas`, vale `contas`, como antes.
 
 /** Só as colunas que o cabeçalho usa, e nunca o token (achado 60). */
 export type ContaDoCabecalho = {
@@ -36,10 +41,12 @@ export function contaParaGuardar(c: ContaDoCabecalho): ContaGuardada {
   return { conta: c.ig_user_id, nome: c.name, arroba: c.username };
 }
 
+/** A conta do cabeçalho: a gravada, achada em `contas`; sem ela, a logada, escolhida em `permitidas`. */
 export function resolverConta(
   contas: ContaDoCabecalho[],
   guardada: ContaGuardada,
-  doCookie: string | undefined
+  doCookie: string | undefined,
+  permitidas: ContaDoCabecalho[] = contas
 ): { conta: ContaDoCabecalho | null; origem: OrigemDaConta } {
   if (guardada.conta) {
     const achada = contas.find((c) => c.ig_user_id === guardada.conta);
@@ -50,26 +57,28 @@ export function resolverConta(
         origem: "guardada",
       };
     }
-    return { conta: contaSelecionada(contas, doCookie), origem: "gravada_saiu" };
+    return { conta: contaSelecionada(permitidas, doCookie), origem: "gravada_saiu" };
   }
-  return { conta: contaSelecionada(contas, doCookie), origem: "selecionada" };
+  return { conta: contaSelecionada(permitidas, doCookie), origem: "selecionada" };
 }
 
 /**
  * A CONTA DO "GERAR DE NOVO": a do carrossel original, mesmo desconectada (decisão do Eduardo em
  * 02/10). Sem o nome guardado e com a conta conectada, o nome e o @ vêm da tabela de contas. Só o
- * original sem conta usa a logada agora.
+ * original sem conta usa a logada agora, ESCOLHIDA EM `permitidas` (achado 179): sem isso, um comum com o
+ * cookie de outra conta no navegador geraria de novo um carrossel numa conta que ele não tem.
  */
 export function contaParaGerarDeNovo(
   contas: ContaDoCabecalho[],
   original: ContaGuardada,
-  doCookie: string | undefined
+  doCookie: string | undefined,
+  permitidas: ContaDoCabecalho[] = contas
 ): ContaGuardada | null {
   if (original.conta) {
     const falta = nomeQueFalta(contas, original);
     return falta ? { conta: original.conta, ...falta } : original;
   }
-  const logada = contaSelecionada(contas, doCookie);
+  const logada = contaSelecionada(permitidas, doCookie);
   return logada ? contaParaGuardar(logada) : null;
 }
 
```

Em `lib/bonus/arte-rota.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/arte-rota.ts b/lib/bonus/arte-rota.ts
index 7ec4017..af7ae10 100644
--- a/lib/bonus/arte-rota.ts
+++ b/lib/bonus/arte-rota.ts
@@ -1,6 +1,6 @@
 import "server-only";
 import { NextResponse } from "next/server";
-import { resolverConta } from "./arte-conta";
+import { resolverConta, type ContaDoCabecalho } from "./arte-conta";
 import { comEspaco, ehCapa, escolhasDaArte } from "./arte-escolhas";
 import { fotoDaCapa, fotoDoEspaco, fotosDaInstancia } from "./arte-foto";
 import { respostaDaArte } from "./arte-resposta";
@@ -25,17 +25,26 @@ export async function desenharSlide(p: {
   linha: LinhaDoCarrossel;
   slides: SlideParaArte[];
   numero: number;
-  /** A conta do cookie: a do cabeçalho quando o carrossel não tem conta gravada. */
+  /**
+   * O id da conta do menu (lib/bonus/carrossel-acesso.ts, `contaDoMenuNoCarrossel`): a do cabeçalho quando o
+   * carrossel não tem conta gravada.
+   */
   doCookie: string | undefined;
+  /**
+   * As contas do login (lib/bonus/carrossel-acesso.ts, `cabecalhosDoLogin`), onde a queda na logada
+   * escolhe (docs/specs/2026-11-05-contas-por-login.md, seção 2). A rota as lê no corpo dela, onde
+   * tests/acesso-nas-actions.test.ts procura a chamada à regra. Sem elas, valem todas, como antes.
+   */
+  permitidas?: ContaDoCabecalho[];
   baixar: boolean;
   /** O nome do arquivo baixado (`nomeDoArquivo`): o slug do bônus do Chat, ou o código do Labs. */
   slug: () => Promise<string | null>;
 }): Promise<Response> {
   const { linha, slides, numero } = p;
   // A conta do cabeçalho é a do carrossel (arte-conta.ts): conectada, os dados atuais; desconectada,
-  // o nome e o @ guardados, com as iniciais; sem conta gravada, a logada no Chat.
+  // o nome e o @ guardados, com as iniciais; sem conta gravada, a logada no Chat, nas contas do login.
   const escolhas = escolhasDaArte(linha.arte, slides.length);
-  const { conta } = resolverConta(await contasParaArte(), escolhas, p.doCookie);
+  const { conta } = resolverConta(await contasParaArte(), escolhas, p.doCookie, p.permitidas);
   if (!conta) return erroDaArte(409, TEXTO_ARTE_SEM_CONTA);
   // A FOTO DO ESPAÇO (adendo da Etapa 5): só no slide com espaço, e só a do jeito "foto", que o
   // prefixo do caminho guardado diz (publicar-regras.ts). `fotoDoEspaco` confere o caminho na pasta da
```

Em `lib/bonus/carrosseis-tela.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/carrosseis-tela.ts b/lib/bonus/carrosseis-tela.ts
index e757dcd..059bce9 100644
--- a/lib/bonus/carrosseis-tela.ts
+++ b/lib/bonus/carrosseis-tela.ts
@@ -139,10 +139,15 @@ export function separarPorAba<T extends EntradaDaLista>(
   return { contagem, daAba: daAba.sort(ordem[aba]) };
 }
 
-/** O que a capa precisa de fora: as contas do cabeçalho, o cookie da conta e o endereço público do bucket. */
+/**
+ * O que a capa precisa de fora: as contas do cabeçalho, a conta do menu e o endereço público do bucket. E as
+ * contas do login (`permitidas`, docs/specs/2026-11-05-contas-por-login.md, seção 2), onde a queda na logada
+ * escolhe; sem elas, valem todas, como antes.
+ */
 export type ContextoDaCapa = {
   contas: ContaDoCabecalho[];
   doCookie: string | undefined;
+  permitidas?: ContaDoCabecalho[];
   urlPublica: (caminho: string) => string | null;
 };
 
@@ -161,7 +166,7 @@ export function capaDoCarrossel(l: LinhaDoCarrossel, agoraMs: number, c: Context
   const imagem = comEspaco(escolhas, 1) ? imagensDaArte(l.arte, l.total_slides)[1] : undefined;
   const pronto = imagem && jeitoDoCaminho(imagem.caminho) === "slide" ? c.urlPublica(imagem.caminho) : null;
   if (pronto) return pronto;
-  const { conta } = resolverConta(c.contas, escolhas, c.doCookie);
+  const { conta } = resolverConta(c.contas, escolhas, c.doCookie, c.permitidas);
   const [versao] = versoesDosSlides(
     slidesDoTexto(texto),
     escolhas.soTexto,
```

Crie `lib/bonus/carrossel-acesso.ts`:

```ts
import "server-only";
import { cookies } from "next/headers";
import { ACCOUNT_COOKIE } from "@/lib/account";
import { podeVerConta, soAsDoLogin } from "@/lib/acesso";
import { escolherConta } from "@/lib/acesso-escolha";
import { sessaoAtual } from "@/lib/sessao";
import type { ContaDoCabecalho } from "./arte-conta";
import { escolhasDaArte } from "./arte-escolhas";
import { contasParaArte, lerCarrossel } from "./carrossel-repositorio";

// O CARROSSEL E AS CONTAS DO LOGIN (docs/specs/2026-11-05-contas-por-login.md, seção 3, "Os carrosséis").
// Todo login vê e edita todos os carrosséis; escolher a conta de um carrossel, gerar e subir imagens,
// publicar e apagar um carrossel que já tem conta só valem nas contas que o login recebeu.
//
// ESTE ARQUIVO NÃO DECIDE NADA SOZINHO: ele pergunta à regra de lib/acesso.ts, o único lugar que sabe quem
// vê qual conta, com o login da sessão. Aqui só mora a forma que o carrossel precisa: a lista de cabeçalhos
// (só as quatro colunas, achado 60), a conta do menu nessa lista, e a pergunta "este carrossel é de uma
// conta que o login não tem?".

/** As contas do login, como o cabeçalho da arte as usa. Sem login, nenhuma. */
export async function cabecalhosDoLogin(): Promise<ContaDoCabecalho[]> {
  const login = await sessaoAtual();
  if (!login) return [];
  return soAsDoLogin(login, await contasParaArte());
}

/**
 * A CONTA DO MENU, PARA O CARROSSEL: a do cookie, se estiver entre as do login; senão, a primeira delas;
 * senão, nenhuma.
 *
 * POR QUE NÃO `getSelectedAccountId` (lib/account.ts): ela passa pela linha inteira da conta, com o
 * `access_token`, e a arte e as actions do carrossel leem só as quatro colunas do cabeçalho, nunca a linha
 * com o token (achado 60, tests/bonus-arte-paginas.test.ts). A ESCOLHA É A MESMA DELA: a mesma lista do login
 * (`soAsDoLogin`, a regra de lib/acesso.ts), na mesma ordem (`created_at`, a de `contasParaArte` e a de
 * `listAccounts`), e a mesma escolha pura (`escolherConta`, lib/acesso-escolha.ts).
 *
 * O COOKIE CRU DA CONTA É LIDO SÓ AQUI, e só desempata dentro das contas do login: um cookie de outra conta
 * no navegador não escolhe nada fora delas.
 */
export async function contaDoMenuNoCarrossel(): Promise<ContaDoCabecalho | null> {
  return escolherConta(await cabecalhosDoLogin(), (await cookies()).get(ACCOUNT_COOKIE)?.value);
}

/**
 * Se o carrossel tem conta gravada e o login não a vê: a recusa das ações que agem na conta do carrossel.
 * Sem login, sempre (a ação já teria ido para /entrar). O carrossel sem conta é de todos, e o que não existe
 * fica para o processo dizer o "não achado" dele.
 */
export async function carrosselDeOutraConta(id: string): Promise<boolean> {
  const login = await sessaoAtual();
  if (!login) return true;
  const linha = await lerCarrossel(id);
  if (!linha) return false;
  const { conta } = escolhasDaArte(linha.arte, linha.total_slides);
  if (!conta) return false;
  return !(await podeVerConta(login, conta));
}
```

Em `lib/bonus/imagem-consulta.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/imagem-consulta.ts b/lib/bonus/imagem-consulta.ts
index 2cad780..ba3e67c 100644
--- a/lib/bonus/imagem-consulta.ts
+++ b/lib/bonus/imagem-consulta.ts
@@ -1,5 +1,5 @@
 import "server-only";
-import { resolverConta } from "./arte-conta";
+import { resolverConta, type ContaDoCabecalho } from "./arte-conta";
 import { escolhasDaArte } from "./arte-escolhas";
 import { slidesDoTexto } from "./arte-slides";
 import { cabecalhoParaVersao, versoesDosSlides } from "./arte-tela";
@@ -18,13 +18,22 @@ import { capaDaArte, fotosDaArte, imagensDaArte } from "./publicar-regras";
 // Pronta, a resposta traz a versão nova da miniatura, a mesma que a página desenharia ao recarregar
 // (`versoesDosSlides`, com a foto do slide), e a versão do texto guardada com a imagem. A travada pelo
 // prazo vira falha, com a frase dela.
+//
+// A CONTA DA MINIATURA, quando o carrossel não tem conta gravada, é a do menu, escolhida nas contas do login
+// (`doCookie` e `permitidas`, que a rota lê no corpo dela: docs/specs/2026-11-05-contas-por-login.md, seção
+// 2). Sem `permitidas`, valem todas, como antes.
 
 export type ConsultaDaImagem =
   | { estado: "nenhuma" | "gerando"; hoje: number }
   | { estado: "pronta"; hoje: number; versao: string | null; versaoDaMiniatura: string }
   | { estado: "falhou"; hoje: number; texto: string };
 
-export async function consultarImagem(p: { linha: LinhaDoCarrossel; numero: number; doCookie?: string }): Promise<ConsultaDaImagem> {
+export async function consultarImagem(p: {
+  linha: LinhaDoCarrossel;
+  numero: number;
+  doCookie?: string;
+  permitidas?: ContaDoCabecalho[];
+}): Promise<ConsultaDaImagem> {
   const [{ agora, linhas }, hoje] = await Promise.all([ultimasDoCarrossel(p.linha.id), imagensNasUltimas24h()]);
   const estado = estadoDaImagem(linhas[p.numero] ?? null, agora);
   if (estado.tipo === "falhou") return { estado: "falhou", hoje, texto: estado.motivo };
@@ -33,7 +42,7 @@ export async function consultarImagem(p: { linha: LinhaDoCarrossel; numero: numb
   if (estado.tipo !== "pronta" || !texto) return { estado: estado.tipo === "gerando" ? "gerando" : "nenhuma", hoje };
   const total = p.linha.total_slides;
   const escolhas = escolhasDaArte(p.linha.arte, total);
-  const { conta } = resolverConta(await contasParaArte(), escolhas, p.doCookie);
+  const { conta } = resolverConta(await contasParaArte(), escolhas, p.doCookie, p.permitidas);
   const versoes = versoesDosSlides(
     slidesDoTexto(texto),
     escolhas.soTexto,
```

- [ ] **Passo 4: ver passar**

```bash
env -u CLAUDECODE -u AI_AGENT npx vitest run tests/acesso-nas-actions.test.ts tests/bonus-arte-conta.test.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/contas-no-carrossel.integracao.ts
npx eslint "app/bonus/[id]/carrossel/[cid]/arte/route.tsx" "app/bonus/[id]/carrossel/[cid]/imagem/route.ts" "app/bonus/[id]/carrossel/[cid]/revisao.tsx" app/bonus/apagar-actions.ts app/bonus/carrossel-actions.ts app/bonus/imagem-actions.ts app/bonus/publicar-actions.ts "app/carrosseis/[cid]/arte/route.tsx" "app/carrosseis/[cid]/imagem/route.ts" app/carrosseis/actions.ts app/carrosseis/page.tsx lib/bonus/arte-conta.ts lib/bonus/arte-rota.ts lib/bonus/carrosseis-tela.ts lib/bonus/carrossel-acesso.ts lib/bonus/imagem-consulta.ts testes-integracao/contas-no-carrossel.integracao.ts tests/acesso-nas-actions.test.ts tests/bonus-arte-conta.test.ts
npx tsc --noEmit
```

Esperado: puros: 2 arquivos passando, com 32 casos passando; integração: 1 arquivo passando, com 22 casos passando; o lint e o `tsc` limpos.

- [ ] **Passo 5: o commit**

A mensagem do commit, gravada em `$SCRATCH/msg-contas-f4.txt`:

```text
Os carrosséis continuam de todos, e a conta, as imagens, a publicação e o apagar só nas contas do login
```

```bash
git add "app/bonus/[id]/carrossel/[cid]/arte/route.tsx" "app/bonus/[id]/carrossel/[cid]/imagem/route.ts" "app/bonus/[id]/carrossel/[cid]/revisao.tsx" app/bonus/apagar-actions.ts app/bonus/carrossel-actions.ts app/bonus/imagem-actions.ts app/bonus/publicar-actions.ts "app/carrosseis/[cid]/arte/route.tsx" "app/carrosseis/[cid]/imagem/route.ts" app/carrosseis/actions.ts app/carrosseis/page.tsx lib/bonus/arte-conta.ts lib/bonus/arte-rota.ts lib/bonus/carrosseis-tela.ts lib/bonus/carrossel-acesso.ts lib/bonus/imagem-consulta.ts testes-integracao/contas-no-carrossel.integracao.ts tests/acesso-nas-actions.test.ts tests/bonus-arte-conta.test.ts
git commit -F "$SCRATCH/msg-contas-f4.txt"
```

---

### FASE 5 — As páginas do comum sem contas

Nas páginas de conta, o comum sem contas lê "Você ainda não tem contas. Peça ao administrador.", uma vez, sem link para a Configuração. O administrador vê o de hoje. O "Reconectar" do Início fica só para o administrador.

- [ ] **Passo 1: os testes, antes do código**

Crie `testes-integracao/paginas-sem-conta.integracao.ts`:

```ts
// AS PÁGINAS SEM CONTA, PELO PAPEL (docs/specs/2026-11-05-contas-por-login.md, seção 3): "O comum sem contas
// vê, nas páginas de conta, a frase 'Você ainda não tem contas. Peça ao administrador.' no lugar do convite para
// conectar." O administrador continua vendo o de hoje, com o link para a Configuração. A frase aparece UMA VEZ
// por seção da tela: o subtítulo do cabeçalho do comum fica vazio, e a frase mora no corpo.
//
// E O "RECONECTAR" DO INÍCIO, o link para /api/oauth/login, é só do administrador: conectar conta é dele (F3).
//
// AS PÁGINAS SÃO CHAMADAS COMO COMPONENTE, no contexto de requisição semeado (./semear-requisicao.ts), e lidas
// pela árvore que devolvem (`textoDaArvore`): o texto e os `props` simples, como `href=/setup`.
//
// A ORDEM DOS DOIS BLOCOS É PARTE DA MEDIDA, no molde de acoes-que-falam.integracao.ts. O primeiro roda com o
// schema SEM conta nenhuma: é o único jeito de o administrador, que vê todas, não ter conta. O segundo conecta
// uma conta: o comum que não a recebeu é o caso de verdade do comum sem contas, e o comum que a recebeu é o do
// "Reconectar". Cada bloco confere a própria condição antes de medir.
//
// NADA SAI DA MÁQUINA: a cerca da F3 deixa passar só o 127.0.0.1, e o último caso exige zero pedidos para fora.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bancoDescartavel } from "./harness";
import { comoNumaRequisicaoComoComum, comoNumaRequisicaoComSessao } from "./semear-requisicao";
import { textoDaArvore } from "./texto-da-arvore";

const banco = bancoDescartavel();

const CONTA = "17800000000051001";
let FRASE_SEM_CONTAS = "";
const pedidosParaFora: string[] = [];
let fetchDeVerdade: typeof fetch;

beforeAll(async () => {
  FRASE_SEM_CONTAS = (await import("@/lib/logins-textos")).FRASE_SEM_CONTAS;
  fetchDeVerdade = globalThis.fetch;
  globalThis.fetch = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(entrada instanceof Request ? entrada.url : String(entrada));
    if (url.hostname !== "127.0.0.1") {
      pedidosParaFora.push(url.origin);
      throw new Error(`A CERCA DE paginas-sem-conta.integracao.ts recusou um pedido para ${url.origin}`);
    }
    return fetchDeVerdade(entrada, init);
  }) as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = fetchDeVerdade;
});

/** Uma página, o convite de hoje dela e quantas vezes o comum sem contas lê a frase nela (uma por seção). */
type Pagina = { nome: string; rota: string; abrir: () => Promise<unknown>; deHoje: string[]; vezes: number };

// As páginas e o convite de hoje de cada uma, pelo texto que o administrador sem conta lê nelas.
const PAGINAS: Pagina[] = [
  {
    nome: "o Início",
    rota: "/",
    abrir: async () => (await import("@/app/page")).default({ searchParams: Promise.resolve({}) }),
    deHoje: ["Nenhuma conta conectada ainda. Vá em", "Comece conectando sua conta do Instagram", "href=/setup"],
    vezes: 1,
  },
  {
    nome: "os Contatos",
    rota: "/contatos",
    abrir: async () => (await import("@/app/contatos/page")).default({ searchParams: Promise.resolve({}) }),
    deHoje: ["Conecte uma conta do Instagram primeiro."],
    vezes: 1,
  },
  {
    // DUAS SEÇÕES, os Envios e as Interações, e cada uma diz por que está vazia.
    nome: "a Atividade",
    rota: "/eventos",
    abrir: async () => (await import("@/app/eventos/page")).default({ searchParams: Promise.resolve({}) }),
    deHoje: ["Conecte uma conta do Instagram primeiro."],
    vezes: 2,
  },
  {
    nome: "as Automações",
    rota: "/automacoes",
    abrir: async () => (await import("@/app/automacoes/page")).default({ searchParams: Promise.resolve({}) }),
    deHoje: ["Conecte uma conta para começar", "Conecte uma conta do Instagram em", "href=/setup"],
    vezes: 1,
  },
  {
    nome: "o Desempenho",
    rota: "/desempenho",
    abrir: async () => (await import("@/app/desempenho/page")).default(),
    deHoje: ["Conecte uma conta do Instagram para ver os números", "Nenhuma conta conectada ainda. Vá em", "href=/setup"],
    vezes: 1,
  },
  {
    nome: "as Publicações",
    rota: "/publicar",
    abrir: async () => (await import("@/app/publicar/page")).default({ searchParams: Promise.resolve({}) }),
    deHoje: ["Nenhuma conta selecionada.", "Conecte uma conta do Instagram em Configuração para ver o que está agendado."],
    vezes: 1,
  },
  {
    // O teto do bucket é perguntado aqui, e falha sem a SUPABASE_URL, antes de qualquer pedido: a página já
    // segura essa falha (app/publicar/novo/page.tsx).
    nome: "o Novo post",
    rota: "/publicar/novo",
    abrir: async () => (await import("@/app/publicar/novo/page")).default({ searchParams: Promise.resolve({}) }),
    deHoje: ["Nenhuma conta selecionada.", "Conecte uma conta do Instagram em Configuração para publicar pelo painel."],
    vezes: 1,
  },
];

const linhasDe = (texto: string) => texto.split("\n").map((l) => l.trim());
const quantasVezes = (texto: string, frase: string) => linhasDe(texto).filter((l) => l === frase).length;

/** O texto da página no contexto do comum, com as contas dadas. */
async function doComum(p: Pick<Pagina, "rota" | "abrir">, contas: string[] = []): Promise<string> {
  return textoDaArvore((await comoNumaRequisicaoComoComum(p.rota, p.abrir, { contas })).valor);
}

/** O texto da página no contexto do administrador (o login de teste). */
async function doAdministrador(p: Pick<Pagina, "rota" | "abrir">): Promise<string> {
  return textoDaArvore((await comoNumaRequisicaoComSessao(p.rota, p.abrir)).valor);
}

// ===========================================================================
// PRIMEIRO BLOCO: O SCHEMA AINDA NÃO TEM CONTA NENHUMA.
// ===========================================================================
describe("sem conta nenhuma no painel", () => {
  it("a condição deste bloco é o schema sem conta, e ele confere isso antes de medir", async () => {
    const [{ n }] = (await banco.db().sql().query(`select count(*)::int as n from accounts`)) as { n: number }[];
    expect(n).toBe(0);
  });

  it.each(PAGINAS)("$nome do administrador mostra o convite de hoje, e não a frase do comum", async (p) => {
    const texto = await doAdministrador(p);
    for (const t of p.deHoje) expect(texto, t).toContain(t);
    expect(quantasVezes(texto, FRASE_SEM_CONTAS)).toBe(0);
  });

  it.each(PAGINAS)("$nome do comum mostra a frase uma vez por seção, sem o convite de hoje nem o link para a Configuração", async (p) => {
    const texto = await doComum(p);
    expect(quantasVezes(texto, FRASE_SEM_CONTAS)).toBe(p.vezes);
    for (const t of p.deHoje) expect(texto, t).not.toContain(t);
    expect(texto).not.toContain("href=/setup");
  });
});

// ===========================================================================
// SEGUNDO BLOCO: O PAINEL TEM UMA CONTA.
// ===========================================================================
describe("com uma conta no painel", () => {
  beforeAll(async () => {
    // Valor inventado. Nenhuma credencial de verdade entra em teste.
    await banco.db().upsertAccount({
      ig_user_id: CONTA,
      username: "conta_das_paginas_sem_conta",
      name: null,
      profile_picture_url: null,
      access_token: "token-de-teste-que-nao-vale-nada",
      token_expires_at: null,
    });
  });

  it("a condição deste bloco é a conta conectada, o comum sem ela e o comum com ela", async () => {
    const { getSelectedAccountId } = await import("@/lib/account");
    expect((await comoNumaRequisicaoComSessao("/", () => getSelectedAccountId())).valor).toBe(CONTA);
    expect((await comoNumaRequisicaoComoComum("/", () => getSelectedAccountId(), { contas: [] })).valor).toBe(null);
    expect((await comoNumaRequisicaoComoComum("/", () => getSelectedAccountId(), { contas: [CONTA] })).valor).toBe(CONTA);
  });

  it.each(PAGINAS)("$nome do comum que não recebeu a conta continua com a frase, uma vez por seção", async (p) => {
    const texto = await doComum(p);
    expect(quantasVezes(texto, FRASE_SEM_CONTAS)).toBe(p.vezes);
    for (const t of p.deHoje) expect(texto, t).not.toContain(t);
    expect(texto).not.toContain("href=/setup");
  });

  // O "RECONECTAR" do Início começa a conexão de uma conta (/api/oauth/login), e a rota manda o comum para o
  // início (F3). O caso de comparação é o próprio cabeçalho com a conta: ele está ali, com o @ dela.
  it("o Início do comum com a conta não tem o Reconectar, e o do administrador tem", async () => {
    const inicio = PAGINAS[0];
    const comum = await doComum(inicio, [CONTA]);
    expect(linhasDe(comum)).toContain("conta_das_paginas_sem_conta");
    expect(comum).not.toContain("href=/api/oauth/login");
    expect(comum).not.toContain("Reconectar");
    const administrador = await doAdministrador(inicio);
    expect(administrador).toContain("href=/api/oauth/login");
    expect(administrador).toContain("Reconectar");
  });
});

describe("a cerca da rede", () => {
  it("nenhum pedido deste arquivo saiu da máquina", () => {
    expect(pedidosParaFora).toEqual([]);
  });
});
```

Crie `tests/paginas-sem-conta.test.ts`:

```ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// AS PÁGINAS SEM CONTA DECIDEM PELO PAPEL (docs/specs/2026-11-05-contas-por-login.md, seção 3): "O comum sem
// contas vê, nas páginas de conta, a frase 'Você ainda não tem contas. Peça ao administrador.' no lugar do
// convite para conectar." O administrador continua vendo o de hoje: o texto e o link para a Configuração. O
// comum não conecta conta, e a Configuração o mandaria para o início.
//
// O CRITÉRIO, lido pelo analisador do TypeScript, e não por expressão regular:
//   1. todo pedaço do convite de hoje (o texto que manda conectar, o link para /setup e o link para
//      /api/oauth/login, o começo da conexão, que é do administrador desde a F3) está no ramo do
//      administrador: o segundo argumento de `textoSemConta(`, ou o ramo verdadeiro de um `?:`, de um `&&`
//      ou de um `if` cuja condição é o papel (`administrador`, ou `x.administrador`), ou o ramo falso quando a
//      condição é o papel negado;
//   2. a página usa a frase do comum: `FRASE_SEM_CONTAS` ou `textoSemConta`, importadas de
//      @/lib/logins-textos;
//   3. e a varredura vale para o que ainda não existe: nenhum arquivo de tela de `app/` tem o convite fora do
//      ramo do administrador. Ficam de fora a Configuração (app/setup, só do administrador), as actions e as
//      rotas, que não são páginas.

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

function analisar(rel: string, fonte = ler(rel)): ts.SourceFile {
  const tipo = rel.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(rel, fonte, ts.ScriptTarget.Latest, true, tipo);
}

/** O texto do convite de hoje: o que manda conectar uma conta, ou diz que não há conta. */
const CONVITE = /Conecte uma conta|Nenhuma conta (conectada|selecionada)|Comece conectando|Nenhuma conta do Instagram está conectada/;
/** As constantes que guardam o convite fora da página. */
const CONSTANTES_DO_CONVITE = new Set(["TEXTO_ARTE_SEM_CONTA"]);
/**
 * Os destinos que só o administrador alcança: a Configuração, e o começo da conexão de uma conta, que manda o
 * comum para o início (app/api/oauth/login/route.ts, F3). O "Reconectar" do Início é um deles.
 */
const DESTINOS_DO_ADMINISTRADOR = new Set(["/setup", "/api/oauth/login"]);

// O PAPEL, PELO NOME: `administrador` (o do login da sessão, ou a prop que o leva), e `podeConectar`, a prop do
// seletor de conta (app/account-switcher.tsx), que a casca enche com o papel (app/app-shell.tsx).
const NOMES_DO_PAPEL = new Set(["administrador", "podeConectar"]);

/** Se a expressão é o papel: `administrador`, `x.administrador` ou `x?.administrador`, com parênteses ou não. */
function ehOPapel(e: ts.Expression): boolean {
  while (ts.isParenthesizedExpression(e)) e = e.expression;
  if (ts.isIdentifier(e)) return NOMES_DO_PAPEL.has(e.text);
  if (ts.isPropertyAccessExpression(e)) return NOMES_DO_PAPEL.has(e.name.text);
  return false;
}

/**
 * O papel, ou o papel negado, ou nenhum dos dois. Uma cadeia de `&&` com o papel num dos lados também é o
 * papel: o que ela guarda só roda com todos os lados verdadeiros, o papel entre eles.
 */
function papelDa(e: ts.Expression): "sim" | "nao" | null {
  while (ts.isParenthesizedExpression(e)) e = e.expression;
  if (ts.isPrefixUnaryExpression(e) && e.operator === ts.SyntaxKind.ExclamationToken) return ehOPapel(e.operand) ? "nao" : null;
  if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
    return papelDa(e.left) === "sim" || papelDa(e.right) === "sim" ? "sim" : null;
  }
  return ehOPapel(e) ? "sim" : null;
}

const contem = (pai: ts.Node | undefined, filho: ts.Node) => !!pai && filho.pos >= pai.pos && filho.end <= pai.end;

/** Se o nó está no ramo do administrador, subindo pelos pais. */
function noRamoDoAdministrador(no: ts.Node): boolean {
  for (let p = no.parent; p; p = p.parent) {
    if (ts.isCallExpression(p) && ts.isIdentifier(p.expression) && p.expression.text === "textoSemConta") {
      if (contem(p.arguments[1], no)) return true;
    }
    if (ts.isConditionalExpression(p)) {
      const papel = papelDa(p.condition);
      if (papel === "sim" && contem(p.whenTrue, no)) return true;
      if (papel === "nao" && contem(p.whenFalse, no)) return true;
    }
    if (ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
      if (papelDa(p.left) === "sim" && contem(p.right, no)) return true;
    }
    if (ts.isIfStatement(p)) {
      const papel = papelDa(p.expression);
      if (papel === "sim" && contem(p.thenStatement, no)) return true;
      if (papel === "nao" && contem(p.elseStatement, no)) return true;
    }
  }
  return false;
}

/** Os pedaços do convite de hoje: o texto, a constante e os links do administrador, com a linha de cada um. */
function pedacosDoConvite(sf: ts.SourceFile): { no: ts.Node; linha: number; texto: string }[] {
  const achados: { no: ts.Node; linha: number; texto: string }[] = [];
  const anotar = (no: ts.Node, texto: string) =>
    achados.push({ no, linha: sf.getLineAndCharacterOfPosition(no.getStart(sf)).line + 1, texto });
  const andar = (n: ts.Node) => {
    if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isJsxText(n)) && CONVITE.test(n.text)) {
      anotar(n, n.text.trim());
    }
    if (ts.isIdentifier(n) && CONSTANTES_DO_CONVITE.has(n.text) && !ts.isImportSpecifier(n.parent)) anotar(n, n.text);
    if (
      ts.isJsxAttribute(n) &&
      n.name.getText(sf) === "href" &&
      n.initializer &&
      ts.isStringLiteral(n.initializer) &&
      DESTINOS_DO_ADMINISTRADOR.has(n.initializer.text)
    ) {
      anotar(n, `href="${n.initializer.text}"`);
    }
    ts.forEachChild(n, andar);
  };
  andar(sf);
  return achados;
}

/** Os pedaços do convite FORA do ramo do administrador: o que este arquivo acusa. */
const soltos = (sf: ts.SourceFile) =>
  pedacosDoConvite(sf)
    .filter((p) => !noRamoDoAdministrador(p.no))
    .map((p) => `${sf.fileName}:${p.linha} ${p.texto}`);

/** Se o arquivo importa de @/lib/logins-textos a frase do comum, e a usa. */
function usaAFraseDoComum(sf: ts.SourceFile): boolean {
  const nomes = new Set<string>();
  for (const s of sf.statements) {
    if (!ts.isImportDeclaration(s) || !ts.isStringLiteral(s.moduleSpecifier) || s.moduleSpecifier.text !== "@/lib/logins-textos") continue;
    const ligados = s.importClause?.namedBindings;
    if (!ligados || !ts.isNamedImports(ligados)) continue;
    for (const e of ligados.elements) {
      if (["FRASE_SEM_CONTAS", "textoSemConta"].includes((e.propertyName ?? e.name).text)) nomes.add(e.name.text);
    }
  }
  let usa = false;
  const andar = (n: ts.Node) => {
    if (ts.isIdentifier(n) && nomes.has(n.text) && !ts.isImportSpecifier(n.parent)) usa = true;
    ts.forEachChild(n, andar);
  };
  andar(sf);
  return usa;
}

// AS PÁGINAS DE CONTA COM O CONVITE DE HOJE, medidas no 606b743. A revisão do carrossel entrou pela constante
// `TEXTO_ARTE_SEM_CONTA` ("Nenhuma conta do Instagram está conectada no Chat"), que ela mostra quando não há
// conta para o cabeçalho.
const PAGINAS = [
  "app/page.tsx",
  "app/automacoes/page.tsx",
  "app/contatos/page.tsx",
  "app/conversas/[id]/page.tsx",
  "app/conversas/lista.tsx",
  "app/desempenho/page.tsx",
  "app/eventos/page.tsx",
  "app/publicar/page.tsx",
  "app/publicar/novo/page.tsx",
  "app/bonus/[id]/carrossel/[cid]/revisao.tsx",
];

// O QUE A VARREDURA DEIXA PASSAR, com o motivo. Não é o convite de quem não tem conta: é um link para a
// Configuração numa tela de conta, para o administrador escrever as perguntas de abertura.
const FORA_DA_VARREDURA = new Set([
  // O editor de uma automação de "pergunta de abertura" diz que as perguntas moram na Configuração.
  'app/automacoes/editor/painel.tsx href="/setup"',
]);

/** Os arquivos de tela de `app/`: fora a Configuração, as actions e as rotas. */
const arquivosDeTela = () =>
  arquivosDe("app").filter(
    (rel) =>
      !rel.startsWith("app/setup/") &&
      !/\/route\.tsx?$/.test(rel) &&
      !(() => {
        const primeira = analisar(rel).statements[0];
        return (
          !!primeira &&
          ts.isExpressionStatement(primeira) &&
          ts.isStringLiteral(primeira.expression) &&
          primeira.expression.text === "use server"
        );
      })()
  );

describe("as páginas sem conta decidem pelo papel", () => {
  it("o leitor acusa quando há o que acusar", () => {
    const s = (fonte: string) => soltos(analisar("x.tsx", fonte));
    // O convite solto: acusa o texto e o link.
    expect(s('const a = <p>Conecte uma conta do Instagram primeiro. <Link href="/setup">Configuração</Link></p>;')).toEqual([
      "x.tsx:1 Conecte uma conta do Instagram primeiro.",
      'x.tsx:1 href="/setup"',
    ]);
    // Uma condição que não é o papel não guarda.
    expect(s('const a = conta ? "x" : "Nenhuma conta selecionada.";')).toEqual(["x.tsx:1 Nenhuma conta selecionada."]);
    // O ramo do administrador guarda, nas quatro formas.
    expect(s('const a = login?.administrador ? <Link href="/setup">Nenhuma conta conectada ainda.</Link> : FRASE_SEM_CONTAS;')).toEqual([]);
    expect(s("const a = !administrador ? FRASE_SEM_CONTAS : <p>Nenhuma conta conectada ainda.</p>;")).toEqual([]);
    expect(s('const a = administrador && <Link href="/setup">Configuração</Link>;')).toEqual([]);
    expect(s('const a = podeConectar ? <Link href="/setup">Conectar Instagram</Link> : null;')).toEqual([]);
    // O começo da conexão também é do administrador: solto, acusa; no ramo dele, não.
    expect(s('const a = conta && <a href="/api/oauth/login">Reconectar</a>;')).toEqual(['x.tsx:1 href="/api/oauth/login"']);
    expect(s('const a = conta && administrador && <a href="/api/oauth/login">Reconectar</a>;')).toEqual([]);
    expect(s('function f() { if (quem.administrador) return <p>Conecte uma conta</p>; return null; }')).toEqual([]);
    expect(s('const a = textoSemConta(administrador, "Nenhuma conta selecionada.");')).toEqual([]);
    // O ramo do comum não guarda: o convite ali é o defeito.
    expect(s('const a = administrador ? FRASE_SEM_CONTAS : "Conecte uma conta do Instagram primeiro.";')).toEqual([
      "x.tsx:1 Conecte uma conta do Instagram primeiro.",
    ]);
    expect(s('const a = textoSemConta("Nenhuma conta selecionada.", x);')).toEqual(["x.tsx:1 Nenhuma conta selecionada."]);
    // A constante do convite conta; o import dela, não. O comentário não conta.
    expect(s('import { TEXTO_ARTE_SEM_CONTA } from "x";\n// Conecte uma conta\nconst a = TEXTO_ARTE_SEM_CONTA;')).toEqual([
      "x.tsx:3 TEXTO_ARTE_SEM_CONTA",
    ]);
    // A frase do comum: importada de @/lib/logins-textos e usada.
    expect(usaAFraseDoComum(analisar("x.tsx", 'import { FRASE_SEM_CONTAS } from "@/lib/logins-textos";\nconst a = FRASE_SEM_CONTAS;'))).toBe(true);
    expect(usaAFraseDoComum(analisar("x.tsx", 'import { FRASE_SEM_CONTAS } from "@/lib/logins-textos";\nconst a = 1;'))).toBe(false);
    expect(usaAFraseDoComum(analisar("x.tsx", 'import { textoSemConta } from "./outro";\nconst a = textoSemConta(x, "y");'))).toBe(false);
  });

  it.each(PAGINAS)("%s tem o convite de hoje, e ele está todo no ramo do administrador", (rel) => {
    const sf = analisar(rel);
    expect(pedacosDoConvite(sf).length, "a página tem de ter o convite de hoje, para o administrador").toBeGreaterThan(0);
    expect(soltos(sf)).toEqual([]);
  });

  it.each(PAGINAS)("%s usa a frase do comum", (rel) => {
    expect(usaAFraseDoComum(analisar(rel))).toBe(true);
  });

  it("o layout das conversas passa o papel à lista, que é de cliente", () => {
    const sf = analisar("app/conversas/layout.tsx");
    let passa = false;
    const andar = (n: ts.Node) => {
      if ((ts.isJsxSelfClosingElement(n) || ts.isJsxOpeningElement(n)) && n.tagName.getText(sf) === "Lista") {
        passa = n.attributes.properties.some((a) => ts.isJsxAttribute(a) && a.name.getText(sf) === "administrador");
      }
      ts.forEachChild(n, andar);
    };
    andar(sf);
    expect(passa).toBe(true);
  });

  it("nenhum arquivo de tela de app/ tem o convite fora do ramo do administrador", () => {
    const fora = (achado: string) => FORA_DA_VARREDURA.has(achado.replace(/:\d+ /, " "));
    expect(arquivosDeTela().flatMap((rel) => soltos(analisar(rel))).filter((a) => !fora(a))).toEqual([]);
  });

  it("a lista do que a varredura deixa passar não envelhece: cada item ainda existe", () => {
    const todos = new Set(arquivosDeTela().flatMap((rel) => soltos(analisar(rel)).map((a) => a.replace(/:\d+ /, " "))));
    expect([...FORA_DA_VARREDURA].filter((item) => !todos.has(item))).toEqual([]);
  });
});
```

- [ ] **Passo 2: ver os testes falharem**

```bash
env -u CLAUDECODE -u AI_AGENT npx vitest run tests/paginas-sem-conta.test.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/paginas-sem-conta.integracao.ts
```

Esperado: puros: 1 arquivo falhando, com 22 casos caindo e 2 passando; integração: 1 arquivo falhando, com 15 casos caindo e 10 passando. Cai porque as páginas ainda mostram ao comum o convite para conectar e o link para a Configuração, e o Início mostra o Reconectar.

- [ ] **Passo 3: o código**

Em `app/account-switcher.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/account-switcher.tsx b/app/account-switcher.tsx
index abb160e..cef6273 100644
--- a/app/account-switcher.tsx
+++ b/app/account-switcher.tsx
@@ -36,9 +36,10 @@ export default function AccountSwitcher({
   const [pending, startTransition] = useTransition();
   const [optimisticId, setOptimisticId] = useOptimistic(selectedId);
 
+  // O ATALHO FICA DENTRO DO `podeConectar ?`, e não depois de um `return` antecipado: é assim que
+  // tests/paginas-sem-conta.test.ts reconhece o link para a Configuração no ramo do administrador.
   if (!accounts.length) {
-    if (!podeConectar) return null;
-    return (
+    return podeConectar ? (
       <Link
         href="/setup"
         className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
@@ -46,7 +47,7 @@ export default function AccountSwitcher({
         <IconSettings className="h-4 w-4" />
         Conectar Instagram
       </Link>
-    );
+    ) : null;
   }
 
   const current = accounts.find((a) => a.ig_user_id === optimisticId) ?? accounts[0];
```

Em `app/automacoes/page.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/automacoes/page.tsx b/app/automacoes/page.tsx
index 85f0960..050f0eb 100644
--- a/app/automacoes/page.tsx
+++ b/app/automacoes/page.tsx
@@ -1,6 +1,8 @@
 import Link from "next/link";
 import { sql, Automation } from "@/lib/db";
 import { getSelectedAccount } from "@/lib/account";
+import { FRASE_SEM_CONTAS } from "@/lib/logins-textos";
+import { sessaoAtual } from "@/lib/sessao";
 import {
   resolvePosts,
   TETO_DA_CAPA_NA_TELA_MS,
@@ -18,6 +20,9 @@ export default async function AutomacoesPage({
 }) {
   const sp = await searchParams;
   const account = await getSelectedAccount();
+  // SEM CONTA, O PAPEL DECIDE O QUE A TELA DIZ (docs/specs/2026-11-05-contas-por-login.md, seção 3): o
+  // administrador, o convite de hoje com a Configuração; o comum, a frase de pedir ao administrador.
+  const administrador = (await sessaoAtual())?.administrador ?? false;
   // cada automação pertence a uma conta conectada
   const automations = account
     ? ((await sql().query(
@@ -182,6 +187,7 @@ export default async function AutomacoesPage({
         <div>
           <h1 className={pageTitle}>Automações</h1>
           <p className={pageSubtitle}>
+            {/* Sem conta, o subtítulo do comum fica vazio: ele lê a frase no corpo, uma vez só. */}
             {account ? (
               <>
                 {automations.length === 0
@@ -191,9 +197,9 @@ export default async function AutomacoesPage({
                     }`}{" "}
                 em <span className="font-medium">@{account.username ?? account.ig_user_id}</span>
               </>
-            ) : (
+            ) : administrador ? (
               "Conecte uma conta para começar"
-            )}
+            ) : null}
           </p>
         </div>
         {account && automations.length > 0 && (
@@ -204,13 +210,17 @@ export default async function AutomacoesPage({
       </div>
 
       {!account ? (
-        <div className={`p-8 text-center text-sm ${card} ${muted}`}>
-          Conecte uma conta do Instagram em{" "}
-          <Link href="/setup" className={link}>
-            Configuração
-          </Link>{" "}
-          para criar automações.
-        </div>
+        administrador ? (
+          <div className={`p-8 text-center text-sm ${card} ${muted}`}>
+            Conecte uma conta do Instagram em{" "}
+            <Link href="/setup" className={link}>
+              Configuração
+            </Link>{" "}
+            para criar automações.
+          </div>
+        ) : (
+          <div className={`p-8 text-center text-sm ${card} ${muted}`}>{FRASE_SEM_CONTAS}</div>
+        )
       ) : rows.length === 0 ? (
         <ListaVazia />
       ) : (
```

Em `app/bonus/[id]/carrossel/[cid]/revisao.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/[id]/carrossel/[cid]/revisao.tsx b/app/bonus/[id]/carrossel/[cid]/revisao.tsx
index 60704e9..bc10991 100644
--- a/app/bonus/[id]/carrossel/[cid]/revisao.tsx
+++ b/app/bonus/[id]/carrossel/[cid]/revisao.tsx
@@ -3,6 +3,8 @@ import { fixarContaDoCarrossel, salvarArteDoCarrossel, salvarSlideDoCarrossel }
 import { pedirImagemDoSlide } from "@/app/bonus/imagem-actions";
 import { assinarImagemDoCarrossel, guardarImagemDoSlide, publicarCarrossel } from "@/app/bonus/publicar-actions";
 import { urlPublicaSeDerParaMontar } from "@/lib/bucket";
+import { textoSemConta } from "@/lib/logins-textos";
+import { sessaoAtual } from "@/lib/sessao";
 import { resolverConta } from "@/lib/bonus/arte-conta";
 import { escolhasDaArte } from "@/lib/bonus/arte-escolhas";
 import { slidesDoTexto } from "@/lib/bonus/arte-slides";
@@ -60,6 +62,9 @@ export default async function Revisao({ carrossel }: { carrossel: LinhaDoCarross
   const escolhas = escolhasDaArte(carrossel.arte, carrossel.total_slides);
   const noMenu = await contaDoMenuNoCarrossel();
   const { conta, origem } = resolverConta(contas, escolhas, noMenu?.ig_user_id, await cabecalhosDoLogin());
+  // SEM CONTA PARA O CABEÇALHO, O PAPEL DECIDE O AVISO (docs/specs/2026-11-05-contas-por-login.md, seção 3):
+  // "nenhuma conta conectada" é verdade para o administrador; o comum sem contas lê a frase de pedir a ele.
+  const administrador = (await sessaoAtual())?.administrador ?? false;
 
   const estado = await estadoDoCarrossel(carrossel.arte);
   const filaId = "filaId" in estado ? estado.filaId : null;
@@ -108,7 +113,7 @@ export default async function Revisao({ carrossel }: { carrossel: LinhaDoCarross
       campos={camposDoFormulario(carrossel.total_slides)}
       valores={valoresPorCampo(texto)}
       rotuloDaConta={conta ? rotuloDaConta(conta) : null}
-      avisoDaConta={conta ? textoDaOrigemDaConta(origem, conta.username ?? "") : TEXTO_ARTE_SEM_CONTA}
+      avisoDaConta={conta ? textoDaOrigemDaConta(origem, conta.username ?? "") : textoSemConta(administrador, TEXTO_ARTE_SEM_CONTA)}
       podeFixar={origem === "selecionada" && conta !== null}
       soTextoInicial={escolhas.soTexto}
       capaInicial={escolhas.capa}
```

Em `app/contatos/page.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/contatos/page.tsx b/app/contatos/page.tsx
index 8eea1f4..d6f9c0e 100644
--- a/app/contatos/page.tsx
+++ b/app/contatos/page.tsx
@@ -1,6 +1,8 @@
 import Link from "next/link";
 import { sql, Contact } from "@/lib/db";
 import { getSelectedAccount } from "@/lib/account";
+import { textoSemConta } from "@/lib/logins-textos";
+import { sessaoAtual } from "@/lib/sessao";
 import { fmtDate } from "@/lib/format";
 import { windowState } from "@/lib/inbox-window";
 import {
@@ -370,6 +372,8 @@ export default async function ContatosPage({
   // CSS montada com texto vindo de fora.
   const aviso = avisoDaUrl(sp.aviso, sp.tom);
   const account = await getSelectedAccount();
+  // SEM CONTA, O PAPEL DECIDE O QUE A TELA DIZ (docs/specs/2026-11-05-contas-por-login.md, seção 3).
+  const administrador = (await sessaoAtual())?.administrador ?? false;
   // SEM `limit`, E ISSO É A CORREÇÃO DE UM DEFEITO, não uma folga.
   //
   // A consulta tinha `limit 200`, e as fichas — inclusive o número de
@@ -556,7 +560,7 @@ export default async function ContatosPage({
 
       {rows.length === 0 ? (
         <div className={`p-8 text-center text-sm ${card} ${muted}`}>
-          {account ? "Ninguém interagiu ainda." : "Conecte uma conta do Instagram primeiro."}
+          {account ? "Ninguém interagiu ainda." : textoSemConta(administrador, "Conecte uma conta do Instagram primeiro.")}
         </div>
       ) : (
         <div className="space-y-10">
```

Em `app/conversas/[id]/page.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/conversas/[id]/page.tsx b/app/conversas/[id]/page.tsx
index 13586be..fa9e702 100644
--- a/app/conversas/[id]/page.tsx
+++ b/app/conversas/[id]/page.tsx
@@ -2,6 +2,8 @@ import Link from "next/link";
 import { notFound } from "next/navigation";
 import { sql } from "@/lib/db";
 import { getSelectedAccount } from "@/lib/account";
+import { textoSemConta } from "@/lib/logins-textos";
+import { sessaoAtual } from "@/lib/sessao";
 import {
   conversationMessages,
   attachmentLabel,
@@ -120,6 +122,9 @@ export default async function ConversaPage({
   // cima (o do formato do id) FICA: um id que não é conversa não é uma conversa
   // vazia, é outra página.
   if (!account) {
+    // O PAPEL DECIDE O QUE A TELA SEM CONTA DIZ (docs/specs/2026-11-05-contas-por-login.md, seção 3): o comum
+    // não conecta conta, e lê a frase de pedir ao administrador.
+    const administrador = (await sessaoAtual())?.administrador ?? false;
     return (
       <div className="p-4">
         {/* NOMEIA O DESTINO, como as outras quatro telas aninhadas: "a lista"
@@ -131,7 +136,7 @@ export default async function ConversaPage({
         {aviso && (
           <div className={`mt-3 ${aviso.tom === "ok" ? alertOk : alertError}`}>{aviso.texto}</div>
         )}
-        <p className={`mt-3 text-sm ${muted}`}>Conecte uma conta do Instagram primeiro.</p>
+        <p className={`mt-3 text-sm ${muted}`}>{textoSemConta(administrador, "Conecte uma conta do Instagram primeiro.")}</p>
       </div>
     );
   }
```

Em `app/conversas/layout.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/conversas/layout.tsx b/app/conversas/layout.tsx
index ad628a2..bde89c1 100644
--- a/app/conversas/layout.tsx
+++ b/app/conversas/layout.tsx
@@ -1,4 +1,5 @@
 import { getSelectedAccount } from "@/lib/account";
+import { sessaoAtual } from "@/lib/sessao";
 import { categoriasDasConversas, listConversations } from "@/lib/conversations";
 import { frasePendentes, quantasSemCategoria } from "@/lib/categorias";
 import { card, muted, pageTitle } from "../ui";
@@ -21,6 +22,9 @@ export const dynamic = "force-dynamic";
 // desenha a lista. As duas coisas juntas é que fazem o badge sumir sem F5.
 export default async function ConversasLayout({ children }: { children: React.ReactNode }) {
   const account = await getSelectedAccount();
+  // O PAPEL VAI À LISTA, que é de cliente: sem conta, ela escolhe a frase por ele
+  // (docs/specs/2026-11-05-contas-por-login.md, seção 3).
+  const administrador = (await sessaoAtual())?.administrador ?? false;
   // DUAS consultas, e nao uma: a lista e uma PAGINA (as 50 mais recentes) e o
   // contador e sobre a CONTA INTEIRA. Contar sobre a pagina fazia o cabecalho
   // sumir assim que o topo ficasse marcado, com o resto por marcar abaixo do
@@ -54,7 +58,7 @@ export default async function ConversasLayout({ children }: { children: React.Re
           página inteira crescer e levar as duas junto. */}
       <div className={`flex h-[calc(100vh-13rem)] overflow-hidden ${card}`}>
         <ColunaLista>
-          <Lista conversas={conversas} semConta={!account} />
+          <Lista conversas={conversas} semConta={!account} administrador={administrador} />
         </ColunaLista>
         <ColunaConversa>{children}</ColunaConversa>
       </div>
```

Em `app/conversas/lista.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/conversas/lista.tsx b/app/conversas/lista.tsx
index f5c7252..15c83e0 100644
--- a/app/conversas/lista.tsx
+++ b/app/conversas/lista.tsx
@@ -9,12 +9,16 @@ import { muted, numero } from "../ui";
 import Avatar from "../avatar";
 import { badgeDaConversa } from "@/lib/inbox-badge";
 import { semCategoria } from "@/lib/categorias";
+import { textoSemConta } from "@/lib/logins-textos";
 
 // A coluna da esquerda do inbox.
 //
 // É componente de cliente por um motivo só: marcar a conversa aberta. O layout
 // que a renderiza não sabe qual rota filha está ativa — só o navegador sabe, via
 // usePathname. Os dados continuam vindo do servidor, por props.
+//
+// O PAPEL TAMBÉM VEM POR PROP (`administrador`, do layout): sem conta, o administrador lê o convite de hoje, e
+// o comum, a frase de pedir ao administrador (docs/specs/2026-11-05-contas-por-login.md, seção 3).
 
 export type ConversaResumo = {
   ig_id: string;
@@ -32,9 +36,11 @@ export type ConversaResumo = {
 export default function Lista({
   conversas,
   semConta,
+  administrador,
 }: {
   conversas: ConversaResumo[];
   semConta: boolean;
+  administrador: boolean;
 }) {
   const pathname = usePathname();
 
@@ -42,7 +48,7 @@ export default function Lista({
     return (
       <p className={`p-5 text-sm ${muted}`}>
         {semConta
-          ? "Conecte uma conta do Instagram primeiro."
+          ? textoSemConta(administrador, "Conecte uma conta do Instagram primeiro.")
           : "Nenhuma conversa ainda. Assim que alguém mandar mensagem, ela aparece aqui."}
       </p>
     );
```

Em `app/desempenho/page.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/desempenho/page.tsx b/app/desempenho/page.tsx
index 9ea566e..4dce6b0 100644
--- a/app/desempenho/page.tsx
+++ b/app/desempenho/page.tsx
@@ -1,6 +1,8 @@
 import Link from "next/link";
 import { sql } from "@/lib/db";
 import { getSelectedAccount } from "@/lib/account";
+import { FRASE_SEM_CONTAS } from "@/lib/logins-textos";
+import { sessaoAtual } from "@/lib/sessao";
 import { fmtDate } from "@/lib/format";
 // A CHAVE DO DIA E O FUSO VÊM DE `lib/calendario.ts`, e não de uma cópia local.
 // Esta tela nasceu com a quarta cópia byte a byte da mesma função — mesmo
@@ -66,6 +68,9 @@ function montarSerie(porDia: Map<string, number>) {
 
 export default async function Desempenho() {
   const account = await getSelectedAccount();
+  // SEM CONTA, O PAPEL DECIDE O QUE A TELA DIZ (docs/specs/2026-11-05-contas-por-login.md, seção 3): o
+  // administrador, o convite de hoje com a Configuração; o comum, a frase de pedir ao administrador.
+  const administrador = (await sessaoAtual())?.administrador ?? false;
 
   const [counts, serie] = await Promise.all([
     (async () =>
@@ -138,20 +143,27 @@ export default async function Desempenho() {
       <header>
         <h1 className="titulo text-2xl font-bold">Desempenho</h1>
         <p className={`mt-0.5 text-sm ${muted}`}>
+          {/* Sem conta, o subtítulo do comum fica vazio: ele lê a frase no corpo, uma vez só. */}
           {account
             ? `Os últimos ${DIAS_GRAFICO} dias de @${account.username ?? account.ig_user_id}`
-            : "Conecte uma conta do Instagram para ver os números"}
+            : administrador
+              ? "Conecte uma conta do Instagram para ver os números"
+              : null}
         </p>
       </header>
 
       {!account ? (
-        <div className={`p-6 text-sm ${card} ${muted}`}>
-          Nenhuma conta conectada ainda. Vá em{" "}
-          <Link href="/setup" className={link}>
-            Configuração
-          </Link>
-          .
-        </div>
+        administrador ? (
+          <div className={`p-6 text-sm ${card} ${muted}`}>
+            Nenhuma conta conectada ainda. Vá em{" "}
+            <Link href="/setup" className={link}>
+              Configuração
+            </Link>
+            .
+          </div>
+        ) : (
+          <div className={`p-6 text-sm ${card} ${muted}`}>{FRASE_SEM_CONTAS}</div>
+        )
       ) : (
         <>
           <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
```

Em `app/eventos/page.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/eventos/page.tsx b/app/eventos/page.tsx
index 57ca4e4..c3fa147 100644
--- a/app/eventos/page.tsx
+++ b/app/eventos/page.tsx
@@ -1,6 +1,7 @@
 import { sql, QueueItem } from "@/lib/db";
 import { getSelectedAccount } from "@/lib/account";
 import { sessaoAtual } from "@/lib/sessao";
+import { textoSemConta } from "@/lib/logins-textos";
 import { fmtDate } from "@/lib/format";
 import { card, muted, tableWrap, thead, rowDivide, btnGhost } from "../ui";
 import {
@@ -76,9 +77,11 @@ export default async function EventosPage({
   // OS EVENTOS SEM CONTA SÓ PARA O ADMINISTRADOR (docs/specs/2026-11-05-contas-por-login.md, seção 3): o
   // corpo de um webhook que deu erro é gravado sem conta e pode ser de qualquer conta (ver `buildWhere`).
   // O papel vai às duas consultas que leem eventos: a lista e o seletor de posts. Sem login não há conta
-  // escolhida, e o `false` é só o lado seguro do tipo.
+  // escolhida, e o `false` é só o lado seguro do tipo. O mesmo papel decide o que a tela sem conta diz: o
+  // convite de hoje para o administrador, a frase de pedir ao administrador para o comum.
   const login = await sessaoAtual();
-  const comEventosSemConta = login?.administrador ?? false;
+  const administrador = login?.administrador ?? false;
+  const comEventosSemConta = administrador;
   const params = await searchParams;
   const filtros = parseFilters(params);
   // QUANTOS EVENTOS ESTA PÁGINA TRAZ. Ele vem da barra de endereço e NÃO de
@@ -198,7 +201,7 @@ export default async function EventosPage({
                 className={`flex flex-col items-center gap-3 p-6 text-center text-sm ${card} ${muted}`}
               >
                 {!account ? (
-                  <p>Conecte uma conta do Instagram primeiro.</p>
+                  <p>{textoSemConta(administrador, "Conecte uma conta do Instagram primeiro.")}</p>
                 ) : filtrandoEnvios ? (
                   <>
                     <p>Nenhum envio com esses filtros.</p>
@@ -321,7 +324,7 @@ export default async function EventosPage({
                 className={`flex flex-col items-center gap-3 p-8 text-center text-sm ${card} ${muted}`}
               >
                 {!account ? (
-                  <p>Conecte uma conta do Instagram primeiro.</p>
+                  <p>{textoSemConta(administrador, "Conecte uma conta do Instagram primeiro.")}</p>
                 ) : filtrando ? (
                   <>
                     <p>Nenhuma interação com esses filtros.</p>
```

Em `app/page.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/page.tsx b/app/page.tsx
index 9565235..2395db2 100644
--- a/app/page.tsx
+++ b/app/page.tsx
@@ -1,6 +1,8 @@
 import Link from "next/link";
 import { sql, getConfig, isMetaConfigured } from "@/lib/db";
 import { getSelectedAccount } from "@/lib/account";
+import { FRASE_SEM_CONTAS } from "@/lib/logins-textos";
+import { sessaoAtual } from "@/lib/sessao";
 import { listConversations } from "@/lib/conversations";
 import { windowState } from "@/lib/inbox-window";
 import {
@@ -101,7 +103,11 @@ export default async function Home({
   searchParams: Promise<{ conectado?: string; erro?: string }>;
 }) {
   const sp = await searchParams; // Next 16: searchParams é assíncrono
-  const [config, account] = await Promise.all([getConfig(), getSelectedAccount()]);
+  const [config, account, login] = await Promise.all([getConfig(), getSelectedAccount(), sessaoAtual()]);
+  // O PAPEL DECIDE O QUE A TELA SEM CONTA DIZ (docs/specs/2026-11-05-contas-por-login.md, seção 3): o
+  // administrador vê o convite de hoje, com a Configuração; o comum, a frase de pedir ao administrador, sem
+  // link para a Configuração, que o mandaria para o início.
+  const administrador = login?.administrador ?? false;
 
   const [sinais, conversas, oportunidadesCruas] = await Promise.all([
     // CADA BLOCO FALHA SOZINHO (mesma restrição das oportunidades, abaixo): um
@@ -396,16 +402,22 @@ export default async function Home({
               Ele vira link de texto discreto, ao lado do @usuário.
             */}
             <p className={`mt-0.5 flex flex-wrap items-center gap-2 text-sm ${muted}`}>
+              {/* O "RECONECTAR" É DO ADMINISTRADOR: ele começa a conexão de uma conta
+                  (/api/oauth/login), e a rota manda o comum para o início (F3). E SEM
+                  CONTA, O SUBTÍTULO DO COMUM FICA VAZIO: a frase de pedir ao
+                  administrador já está no corpo, uma vez só. */}
               {account ? (
                 <>
                   <span>@{account.username ?? account.ig_user_id}</span>
-                  <a href="/api/oauth/login" className={`text-xs ${link}`}>
-                    Reconectar
-                  </a>
+                  {administrador && (
+                    <a href="/api/oauth/login" className={`text-xs ${link}`}>
+                      Reconectar
+                    </a>
+                  )}
                 </>
-              ) : (
+              ) : administrador ? (
                 "Comece conectando sua conta do Instagram"
-              )}
+              ) : null}
             </p>
           </div>
         </div>
@@ -420,11 +432,11 @@ export default async function Home({
               Nova automação
             </Link>
           </div>
-        ) : (
+        ) : administrador ? (
           <Link href="/setup" className={btnPrimary}>
             {isMetaConfigured(config) ? "Continuar configuração" : "Começar configuração"}
           </Link>
-        )}
+        ) : null}
       </header>
 
       {/* O PULSO. Uma linha, sempre visível, inclusive quando está tudo bem:
@@ -434,13 +446,17 @@ export default async function Home({
       {account && <p className={`text-xs ${muted}`}>{pulso}</p>}
 
       {!account ? (
-        <div className={`p-6 text-sm ${card} ${muted}`}>
-          Nenhuma conta conectada ainda. Vá em{" "}
-          <Link href="/setup" className={link}>
-            Configuração
-          </Link>{" "}
-          — o assistente te guia passo a passo (leva uns 15 minutos, só na primeira vez).
-        </div>
+        administrador ? (
+          <div className={`p-6 text-sm ${card} ${muted}`}>
+            Nenhuma conta conectada ainda. Vá em{" "}
+            <Link href="/setup" className={link}>
+              Configuração
+            </Link>{" "}
+            — o assistente te guia passo a passo (leva uns 15 minutos, só na primeira vez).
+          </div>
+        ) : (
+          <div className={`p-6 text-sm ${card} ${muted}`}>{FRASE_SEM_CONTAS}</div>
+        )
       ) : itens.length === 0 ? (
         // O ESTADO CALMO — o desfecho comum, e o que esta tela existe para
         // poder dizer. Não é tela de erro nem espaço à espera de conteúdo: é a
```

Em `app/publicar/novo/page.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/publicar/novo/page.tsx b/app/publicar/novo/page.tsx
index 7a1ba4d..e0bc4d3 100644
--- a/app/publicar/novo/page.tsx
+++ b/app/publicar/novo/page.tsx
@@ -1,5 +1,7 @@
 import Link from "next/link";
 import { getSelectedAccount } from "@/lib/account";
+import { textoSemConta } from "@/lib/logins-textos";
+import { sessaoAtual } from "@/lib/sessao";
 import { pastaDaConta, tetoDoBucket } from "@/lib/bucket";
 import { avisoDaUrl } from "@/lib/avisos";
 import { PUBLICACOES_POR_DIA } from "@/lib/publicacao";
@@ -51,6 +53,8 @@ export default async function Publicar({
   const params = await searchParams;
   const aviso = avisoDaUrl(params.aviso, params.tom);
   const conta = await getSelectedAccount();
+  // SEM CONTA, O PAPEL DECIDE O QUE A TELA DIZ (docs/specs/2026-11-05-contas-por-login.md, seção 3).
+  const administrador = (await sessaoAtual())?.administrador ?? false;
 
   // O TETO É PERGUNTADO AO BUCKET, E A PERGUNTA PODE FALHAR. Um `throw` aqui
   // seria a tela inteira em branco por causa de um número que só serve para
@@ -69,9 +73,12 @@ export default async function Publicar({
       <div>
         <h1 className={pageTitle}>Novo post</h1>
         <p className={pageSubtitle}>
+          {/* Sem conta, o subtítulo do comum fica vazio: ele lê a frase no corpo, uma vez só. */}
           {conta
             ? `no perfil de @${conta.username ?? conta.ig_user_id}`
-            : "Nenhuma conta selecionada."}
+            : administrador
+              ? "Nenhuma conta selecionada."
+              : null}
         </p>
         {/* O LINK PARA OS AGENDADOS, e ele e obrigatorio: uma tela sem link nao
             existe para quem usa, e este produto ja pagou por isso. Ele fica
@@ -96,7 +103,7 @@ export default async function Publicar({
       {!conta ? (
         <div className={emptyWrap}>
           <p className={muted}>
-            Conecte uma conta do Instagram em Configuração para publicar pelo painel.
+            {textoSemConta(administrador, "Conecte uma conta do Instagram em Configuração para publicar pelo painel.")}
           </p>
         </div>
       ) : (
```

Em `app/publicar/page.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/publicar/page.tsx b/app/publicar/page.tsx
index b07ae12..708893c 100644
--- a/app/publicar/page.tsx
+++ b/app/publicar/page.tsx
@@ -1,6 +1,8 @@
 import Link from "next/link";
 import { sql, type QueueItem } from "@/lib/db";
 import { getSelectedAccount } from "@/lib/account";
+import { textoSemConta } from "@/lib/logins-textos";
+import { sessaoAtual } from "@/lib/sessao";
 import { fmtDate } from "@/lib/format";
 import { avisoDaUrl } from "@/lib/avisos";
 import {
@@ -127,6 +129,8 @@ export default async function Agendados({
   const params = await searchParams;
   const aviso = avisoDaUrl(params.aviso, params.tom);
   const conta = await getSelectedAccount();
+  // SEM CONTA, O PAPEL DECIDE O QUE A TELA DIZ (docs/specs/2026-11-05-contas-por-login.md, seção 3).
+  const administrador = (await sessaoAtual())?.administrador ?? false;
 
   // A GRADE VEM ANTES DA CONSULTA, porque e ela que diz qual janela buscar.
   const hoje = chaveDoDia(new Date());
@@ -318,9 +322,12 @@ export default async function Agendados({
         <div>
           <h1 className={pageTitle}>Publicações</h1>
           <p className={pageSubtitle}>
+            {/* Sem conta, o subtítulo do comum fica vazio: ele lê a frase no corpo, uma vez só. */}
             {conta
               ? `o que sai e o que já saiu no perfil de @${conta.username ?? conta.ig_user_id}`
-              : "Nenhuma conta selecionada."}
+              : administrador
+                ? "Nenhuma conta selecionada."
+                : null}
           </p>
         </div>
         <Link href="/publicar/novo" className={btnPrimary}>
@@ -333,7 +340,7 @@ export default async function Agendados({
       {!conta ? (
         <div className={emptyWrap}>
           <p className={muted}>
-            Conecte uma conta do Instagram em Configuração para ver o que está agendado.
+            {textoSemConta(administrador, "Conecte uma conta do Instagram em Configuração para ver o que está agendado.")}
           </p>
         </div>
       ) : (
```

- [ ] **Passo 4: ver passar**

```bash
env -u CLAUDECODE -u AI_AGENT npx vitest run tests/paginas-sem-conta.test.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/paginas-sem-conta.integracao.ts
npx eslint app/account-switcher.tsx app/automacoes/page.tsx "app/bonus/[id]/carrossel/[cid]/revisao.tsx" app/contatos/page.tsx "app/conversas/[id]/page.tsx" app/conversas/layout.tsx app/conversas/lista.tsx app/desempenho/page.tsx app/eventos/page.tsx app/page.tsx app/publicar/novo/page.tsx app/publicar/page.tsx testes-integracao/paginas-sem-conta.integracao.ts tests/paginas-sem-conta.test.ts
npx tsc --noEmit
```

Esperado: puros: 1 arquivo passando, com 24 casos passando; integração: 1 arquivo passando, com 25 casos passando; o lint e o `tsc` limpos.

- [ ] **Passo 5: o commit**

A mensagem do commit, gravada em `$SCRATCH/msg-contas-f5.txt`:

```text
O login comum sem contas lê, nas páginas de conta, que deve pedir ao administrador, e não o convite para conectar
```

```bash
git add app/account-switcher.tsx app/automacoes/page.tsx "app/bonus/[id]/carrossel/[cid]/revisao.tsx" app/contatos/page.tsx "app/conversas/[id]/page.tsx" app/conversas/layout.tsx app/conversas/lista.tsx app/desempenho/page.tsx app/eventos/page.tsx app/page.tsx app/publicar/novo/page.tsx app/publicar/page.tsx testes-integracao/paginas-sem-conta.integracao.ts tests/paginas-sem-conta.test.ts
git commit -F "$SCRATCH/msg-contas-f5.txt"
```

---

### FASE 6 — A página Logins: o papel, as contas e a caixinha

A caixinha "Administrador" ao criar, as contas de cada login comum e o "Tornar administrador" ou "Tornar comum", com as travas do próprio e do último administrador. O formulário das contas não recebe o token.

- [ ] **Passo 1: os testes, antes do código**

Crie `testes-dom/logins-formularios.dom.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// O `vi.mock` sobe para o topo do arquivo, antes de qualquer `const`: as ações de mentira nascem no
// `vi.hoisted`, que sobe junto (o molde é testes-dom/convites-no-setup.dom.tsx).
const acoes = vi.hoisted(() => ({
  criarLoginAction: vi.fn(async () => ({})),
  definirSenhaAction: vi.fn(async () => ({})),
  definirContasDoLoginAction: vi.fn(async () => ({})),
}));
vi.mock("@/app/logins/actions", () => acoes);

import { ContasDoLogin, CriarLogin } from "@/app/logins/formularios";

// OS FORMULÁRIOS DA PÁGINA LOGINS (docs/specs/2026-11-05-contas-por-login.md, seção 4): a caixinha
// "Administrador" do criar, desmarcada (o login novo nasce comum), e as contas de um login comum, uma caixinha
// por conta. As ações são de mentira: o que elas gravam é conferido em testes-integracao/logins-acoes.integracao.ts.
const CONTAS = [
  { ig_user_id: "17800000000061001", username: "conta_a", name: "Conta A" },
  { ig_user_id: "17800000000061002", username: "conta_b", name: null },
  { ig_user_id: "17800000000061003", username: null, name: "Conta C" },
];

describe("o criar login", () => {
  it("tem a caixinha Administrador, com o rótulo, desmarcada", () => {
    render(<CriarLogin />);
    const caixa = screen.getByLabelText("Administrador") as HTMLInputElement;
    expect(caixa.type).toBe("checkbox");
    expect(caixa.name).toBe("administrador");
    expect(caixa.checked).toBe(false);
  });
});

describe("as contas de um login comum", () => {
  it("tem uma caixinha por conta, com o @ e o nome, e as marcadas vêm marcadas", () => {
    render(<ContasDoLogin id="login-1" nome="Fulano" contas={CONTAS} marcadas={["17800000000061002"]} />);
    const caixas = screen.getAllByRole("checkbox") as HTMLInputElement[];
    expect(caixas.map((c) => [c.name, c.value, c.checked])).toEqual([
      ["contas", "17800000000061001", false],
      ["contas", "17800000000061002", true],
      ["contas", "17800000000061003", false],
    ]);
    const rotulo = (n: number) => caixas[n].closest("label")?.textContent ?? "";
    expect(rotulo(0)).toContain("@conta_a");
    expect(rotulo(0)).toContain("Conta A");
    expect(rotulo(1)).toContain("@conta_b");
    // Sem o @, o rótulo leva o nome.
    expect(rotulo(2)).toContain("Conta C");
  });

  it("leva o id do login escondido e tem o botão Salvar contas", () => {
    const { container } = render(<ContasDoLogin id="login-1" nome="Fulano" contas={CONTAS} marcadas={[]} />);
    const id = container.querySelector('input[type="hidden"][name="id"]') as HTMLInputElement | null;
    expect(id?.value).toBe("login-1");
    const botao = screen.getByRole("button", { name: "Salvar contas" });
    expect(botao.getAttribute("type")).toBe("submit");
    expect(within(botao.closest("form")!).getAllByRole("checkbox")).toHaveLength(3);
  });

  it("sem conta nenhuma no painel, diz isso e não mostra caixinha", () => {
    render(<ContasDoLogin id="login-1" nome="Fulano" contas={[]} marcadas={[]} />);
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.getByText("Ainda não há contas no painel.")).toBeTruthy();
  });
});
```

Em `testes-integracao/logins-acoes.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/logins-acoes.integracao.ts b/testes-integracao/logins-acoes.integracao.ts
index fae0eb2..ca6cd51 100644
--- a/testes-integracao/logins-acoes.integracao.ts
+++ b/testes-integracao/logins-acoes.integracao.ts
@@ -2,12 +2,16 @@
 // teste, no contexto de requisição semeado e no banco descartável. E o convite, que passou a ser só do
 // administrador.
 //
-// O login de teste nasce administrador (é o padrão da coluna). Para o caso de quem não é, ele perde o
-// marcador no próprio caso e o recebe de volta no `beforeEach` seguinte.
+// O login de teste nasce administrador (./semear-requisicao.ts diz isso explícito). Para o caso de quem não é,
+// ele perde o marcador no próprio caso e o recebe de volta no `beforeEach` seguinte; e o login comum de teste
+// (`comoNumaRequisicaoComoComum`) mede o comum de verdade.
+//
+// DESDE AS CONTAS POR LOGIN (docs/specs/2026-11-05-contas-por-login.md, seção 4), a página cria o comum e o
+// administrador pela caixinha, dá as contas a cada comum e troca o papel, com as travas do desativar.
 import { renderToStaticMarkup } from "react-dom/server";
 import { beforeAll, beforeEach, describe, expect, it } from "vitest";
 import { bancoDescartavel } from "./harness";
-import { comoNumaRequisicaoComSessao, EMAIL_DE_TESTE } from "./semear-requisicao";
+import { comoNumaRequisicaoComoComum, comoNumaRequisicaoComSessao, EMAIL_DE_TESTE } from "./semear-requisicao";
 
 type ModuloAcoes = typeof import("@/app/logins/actions");
 type ModuloPagina = typeof import("@/app/logins/page");
@@ -33,8 +37,24 @@ beforeAll(async () => {
   repo = await import("@/lib/logins-repositorio");
   logins = await import("@/lib/logins");
   textos = await import("@/lib/logins-textos");
+  // AS DUAS CONTAS DO PAINEL, para as contas de um login comum. Valores inventados: nenhuma credencial de verdade
+  // entra em teste, e o token é conferido fora da página.
+  for (const id of [CONTA_A, CONTA_B]) {
+    await banco.db().upsertAccount({
+      ig_user_id: id,
+      username: `arroba_${id}`,
+      name: `Nome da ${id}`,
+      profile_picture_url: null,
+      access_token: TOKEN_DAS_CONTAS,
+      token_expires_at: null,
+    });
+  }
 });
 
+const CONTA_A = "17800000000071001";
+const CONTA_B = "17800000000071002";
+const TOKEN_DAS_CONTAS = "token-das-contas-da-pagina-logins-que-nao-vale-nada";
+
 beforeEach(async () => {
   await q(`delete from logins where email <> $1`, [EMAIL_DE_TESTE]);
   await q(`update logins set administrador = true, desativado_em = null where email = $1`, [EMAIL_DE_TESTE]);
@@ -61,12 +81,12 @@ async function comSessao<T>(rota: string, corpo: () => Promise<T>): Promise<{ de
   return valor;
 }
 
-async function outroLogin(email: string): Promise<string> {
+async function outroLogin(email: string, administrador = true, nome = "Outra pessoa"): Promise<string> {
   const r = await repo.criarLogin({
     email,
-    nome: "Outra pessoa",
+    nome,
     senhaHash: await logins.hashDaSenha("a senha da outra pessoa"),
-    administrador: true,
+    administrador,
   });
   if ("erro" in r) throw new Error(r.erro);
   return r.id;
@@ -83,7 +103,8 @@ describe("criar um login", () => {
     expect(r.valor?.ok).toMatch(/Login de Maria criado/);
     const [linha] = await q(`select nome, senha_hash, administrador from logins where email = 'maria@exemplo.invalid'`);
     expect(linha.nome).toBe("Maria");
-    expect(linha.administrador).toBe(true);
+    // SEM A CAIXINHA "Administrador", O LOGIN NASCE COMUM (spec das contas por login, seção 4).
+    expect(linha.administrador).toBe(false);
     expect(String(linha.senha_hash)).not.toContain("a senha inicial da maria");
     expect(await logins.senhaConfere("a senha inicial da maria", String(linha.senha_hash))).toBe(true);
   });
@@ -188,3 +209,217 @@ describe("a página Logins", () => {
     expect(torto).not.toContain("vazado");
   });
 });
+
+// ===================================================================================================
+// AS CONTAS POR LOGIN NA PÁGINA LOGINS (docs/specs/2026-11-05-contas-por-login.md, seção 4)
+// ===================================================================================================
+
+/** O formulário das contas de um login: o id e uma `contas` por caixinha marcada, como o navegador manda. */
+const formDasContas = (id: string, contas: string[]) => {
+  const f = form({ id });
+  for (const c of contas) f.append("contas", c);
+  return f;
+};
+
+const papelDe = async (id: string) => (await q(`select administrador from logins where id = $1`, [id]))[0]?.administrador;
+
+describe("criar um login, comum ou administrador", () => {
+  it("sem a caixinha nasce comum, e com ela nasce administrador", async () => {
+    const criar = (email: string, administrador: boolean) =>
+      comSessao("/logins", () =>
+        acoes.criarLoginAction(
+          {},
+          form({ nome: "Pessoa nova", email, senha: "a senha inicial dela", ...(administrador ? { administrador: "on" } : {}) })
+        )
+      );
+    expect((await criar("comum-novo@exemplo.invalid", false)).valor?.ok).toMatch(/criado/);
+    expect((await criar("adm-novo@exemplo.invalid", true)).valor?.ok).toMatch(/criado/);
+    const linhas = await q(`select email, administrador from logins where email like '%-novo@exemplo.invalid' order by email`);
+    expect(linhas).toEqual([
+      { email: "adm-novo@exemplo.invalid", administrador: true },
+      { email: "comum-novo@exemplo.invalid", administrador: false },
+    ]);
+  });
+});
+
+describe("as contas de um login comum", () => {
+  it("salvar troca o conjunto de uma vez, e diz que vale no próximo clique", async () => {
+    const comum = await outroLogin("comum@exemplo.invalid", false);
+    const salvar = (contas: string[]) => comSessao("/logins", () => acoes.definirContasDoLoginAction({}, formDasContas(comum, contas)));
+    expect((await salvar([CONTA_A])).valor).toEqual({ ok: textos.FRASE_CONTAS_SALVAS });
+    expect(await repo.idsDasContasDoLogin(comum)).toEqual([CONTA_A]);
+    expect((await salvar([CONTA_B])).valor).toEqual({ ok: textos.FRASE_CONTAS_SALVAS });
+    expect(await repo.idsDasContasDoLogin(comum)).toEqual([CONTA_B]);
+    // Nenhuma marcada também é um conjunto: o comum fica sem contas.
+    expect((await salvar([])).valor).toEqual({ ok: textos.FRASE_CONTAS_SALVAS });
+    expect(await repo.idsDasContasDoLogin(comum)).toEqual([]);
+  });
+
+  it("a conta que não existe é recusada, e nada muda", async () => {
+    const comum = await outroLogin("comum@exemplo.invalid", false);
+    expect(await repo.definirContasDoLogin(comum, [CONTA_A])).toBe("ok");
+    const r = await comSessao("/logins", () =>
+      acoes.definirContasDoLoginAction({}, formDasContas(comum, [CONTA_B, "17800000000079999"]))
+    );
+    expect(r.valor).toEqual({ erro: textos.FRASE_DA_CONTA_QUE_NAO_EXISTE });
+    expect(await repo.idsDasContasDoLogin(comum)).toEqual([CONTA_A]);
+  });
+
+  it("as contas de um administrador são recusadas: ele já vê todas", async () => {
+    const adm = await outroLogin("adm@exemplo.invalid", true);
+    const r = await comSessao("/logins", () => acoes.definirContasDoLoginAction({}, formDasContas(adm, [CONTA_A])));
+    expect(r.valor).toEqual({ erro: textos.FRASE_DO_LOGIN_ADMINISTRADOR });
+    expect(await repo.idsDasContasDoLogin(adm)).toEqual([]);
+  });
+
+  it("o login que não existe é recusado com a frase de sempre", async () => {
+    const r = await comSessao("/logins", () =>
+      acoes.definirContasDoLoginAction({}, formDasContas("00000000-0000-4000-8000-000000000000", [CONTA_A]))
+    );
+    expect(r.valor).toEqual({ erro: textos.FRASE_DO_LOGIN_QUE_NAO_EXISTE });
+  });
+});
+
+describe("o papel de um login", () => {
+  const trocar = (id: string, papel: string) => comSessao("/logins", () => acoes.definirPapelDoLoginAction(form({ id, papel })));
+
+  it("o comum vira administrador, e volta a comum", async () => {
+    const id = await outroLogin("comum@exemplo.invalid", false);
+    expect((await trocar(id, "administrador")).destino).toBe("/logins?aviso=virou_administrador");
+    expect(await papelDe(id)).toBe(true);
+    expect((await trocar(id, "comum")).destino).toBe("/logins?aviso=virou_comum");
+    expect(await papelDe(id)).toBe(false);
+  });
+
+  it("ninguém muda o próprio papel", async () => {
+    await comSessao("/logins", async () => null); // garante que o login de teste já nasceu
+    const eu = await idDoTeste();
+    expect((await trocar(eu, "comum")).destino).toBe("/logins?aviso=papel_proprio");
+    expect(await papelDe(eu)).toBe(true);
+  });
+
+  it("um papel que não é dos dois vira o aviso de não achado, e nada muda", async () => {
+    const id = await outroLogin("comum@exemplo.invalid", false);
+    expect((await trocar(id, "dono")).destino).toBe("/logins?aviso=nao_encontrado");
+    expect(await papelDe(id)).toBe(false);
+  });
+
+  // O ÚLTIMO ADMINISTRADOR, PELA ACTION. Em série ele não se alcança: quem pede é um administrador ativo, e o
+  // outro também, então há sempre dois. Ele aparece quando dois administradores rebaixam um ao outro ao mesmo
+  // tempo (achado 168). O ACERTO DO TEMPO É FEITO PELO BANCO: uma transação de fora rebaixa o login de teste e
+  // segura a linha dele; a action, pedida por ele, passa pela sessão (que lê a linha de antes) e para no
+  // `for update` dos administradores; a transação solta só depois de o banco mostrar a espera, e a action conta
+  // de novo, já sem o login de teste.
+  it("o último administrador ativo não vira comum, mesmo com os dois rebaixando um ao outro (168)", async () => {
+    await comSessao("/logins", async () => null); // a sessão do login de teste nasce antes da trava
+    const eu = await idDoTeste();
+    const outro = await outroLogin("outro-adm@exemplo.invalid", true);
+    let acao: Promise<{ destino: string | null }> | undefined;
+    await banco
+      .db()
+      .sql()
+      .begin(async (tx) => {
+        await tx.query(`update logins set administrador = false where id = $1`, [eu]);
+        acao = trocar(outro, "comum");
+        for (let i = 0; i < 100; i++) {
+          const [{ n }] = (await q(`select count(*)::int as n from pg_locks where not granted`)) as { n: number }[];
+          if (Number(n) > 0) break;
+          await new Promise((r) => setTimeout(r, 50));
+        }
+      });
+    expect((await acao!).destino).toBe("/logins?aviso=ultimo_administrador");
+    expect(await papelDe(outro)).toBe(true);
+  });
+});
+
+describe("o login comum na página Logins", () => {
+  /** Roda o corpo com o login COMUM de teste e devolve o destino do redirect (ou null). */
+  async function comoComum(corpo: () => Promise<unknown>): Promise<string | null> {
+    const { valor } = await comoNumaRequisicaoComoComum(
+      "/logins",
+      async () => {
+        try {
+          await corpo();
+          return null;
+        } catch (e) {
+          const d = (e as { digest?: unknown }).digest;
+          if (typeof d !== "string" || !d.startsWith("NEXT_REDIRECT;")) throw e;
+          return d.split(";").slice(2, -2).join(";");
+        }
+      },
+      { contas: [CONTA_A] }
+    );
+    return valor;
+  }
+
+  it("volta para o início em cada ação da página, as novas e as de antes, sem gravar nada", async () => {
+    const alvo = await outroLogin("alvo@exemplo.invalid", false);
+    const tentativas: [string, () => Promise<unknown>][] = [
+      ["criarLoginAction", () => acoes.criarLoginAction({}, form({ nome: "X", email: "intruso@exemplo.invalid", senha: "uma senha comprida" }))],
+      ["definirSenhaAction", () => acoes.definirSenhaAction({}, form({ id: alvo, senha: "uma senha comprida" }))],
+      ["desativarLoginAction", () => acoes.desativarLoginAction(form({ id: alvo }))],
+      ["reativarLoginAction", () => acoes.reativarLoginAction(form({ id: alvo }))],
+      ["definirContasDoLoginAction", () => acoes.definirContasDoLoginAction({}, formDasContas(alvo, [CONTA_A]))],
+      ["definirPapelDoLoginAction", () => acoes.definirPapelDoLoginAction(form({ id: alvo, papel: "administrador" }))],
+    ];
+    for (const [nome, t] of tentativas) expect(await comoComum(t), nome).toBe("/");
+    expect((await q(`select email from logins where email = 'intruso@exemplo.invalid'`)).length).toBe(0);
+    const [linha] = await q(`select administrador, desativado_em from logins where id = $1`, [alvo]);
+    expect(linha).toEqual({ administrador: false, desativado_em: null });
+    expect(await repo.idsDasContasDoLogin(alvo)).toEqual([]);
+  });
+
+  it("volta para o início na página", async () => {
+    expect(await comoComum(() => pagina.default({ searchParams: Promise.resolve({}) }))).toBe("/");
+  });
+});
+
+describe("a página Logins com o papel e as contas", () => {
+  /** Os `props` de todo elemento da árvore que casam com `casa`, andando pelos filhos (o molde de acoes-que-falam). */
+  function propsDaArvore(raiz: unknown, casa: (p: Record<string, unknown>) => boolean): Record<string, unknown>[] {
+    const achados: Record<string, unknown>[] = [];
+    const visto = new Set<unknown>();
+    const andar = (no: unknown): void => {
+      if (Array.isArray(no)) return no.forEach(andar);
+      if (typeof no !== "object" || no === null || visto.has(no)) return;
+      visto.add(no);
+      const props = (no as { props?: Record<string, unknown> }).props;
+      if (!props) return;
+      if (casa(props)) achados.push(props);
+      andar(props.children);
+    };
+    andar(raiz);
+    return achados;
+  }
+
+  it("mostra o papel, as contas do comum, o 'Vê todas as contas' do administrador e o trocar o papel", async () => {
+    const comum = await outroLogin("comum@exemplo.invalid", false, "Pessoa comum");
+    await outroLogin("adm@exemplo.invalid", true, "Pessoa administradora");
+    const parado = await outroLogin("parado@exemplo.invalid", false, "Pessoa desativada");
+    await q(`update logins set desativado_em = now() where id = $1`, [parado]);
+    expect(await repo.definirContasDoLogin(comum, [CONTA_B])).toBe("ok");
+
+    const { valor } = await comoNumaRequisicaoComSessao("/logins", () => pagina.default({ searchParams: Promise.resolve({}) }));
+    const h = renderToStaticMarkup(valor as Parameters<typeof renderToStaticMarkup>[0]);
+    expect(h).not.toContain("Nesta versão, todo login é administrador.");
+    // O selo do papel em cada linha: o login de teste e a outra administradora; a comum e a desativada.
+    expect(h.match(/>administrador</g)?.length).toBe(2);
+    expect(h.match(/>comum</g)?.length).toBe(2);
+    // As contas só na linha da comum ativa, e a desativada não tem o formulário.
+    expect(h.match(/>Salvar contas</g)?.length).toBe(1);
+    expect(h.match(/Vê todas as contas/g)?.length).toBe(2);
+    expect(h).toMatch(new RegExp(`value="${CONTA_B}"[^>]*checked|checked[^>]*value="${CONTA_B}"`));
+    expect(h).not.toMatch(new RegExp(`value="${CONTA_A}"[^>]*checked|checked[^>]*value="${CONTA_A}"`));
+    // O trocar o papel em toda linha que não é a sua: a administradora vira comum; as duas comuns, administradoras.
+    expect(h.match(/>Tornar comum</g)?.length).toBe(1);
+    expect(h.match(/>Tornar administrador</g)?.length).toBe(2);
+    // O TOKEN DAS CONTAS NÃO VAI AO NAVEGADOR: o formulário é de cliente, e o que ele recebe vai na resposta.
+    expect(h).not.toContain(TOKEN_DAS_CONTAS);
+    const formularios = propsDaArvore(valor, (p) => Array.isArray(p.contas) && Array.isArray(p.marcadas));
+    expect(formularios).toHaveLength(1);
+    for (const c of formularios[0].contas as Record<string, unknown>[]) {
+      expect(Object.keys(c).sort()).toEqual(["ig_user_id", "name", "username"]);
+    }
+    expect(formularios[0].marcadas).toEqual([CONTA_B]);
+  });
+});
```

Em `tests/logins-textos.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/logins-textos.test.ts b/tests/logins-textos.test.ts
index dc37f93..6eb1d4c 100644
--- a/tests/logins-textos.test.ts
+++ b/tests/logins-textos.test.ts
@@ -4,6 +4,8 @@ import {
   avisoDaPagina,
   FRASE_CARROSSEL_DE_OUTRA_CONTA,
   FRASE_CONTAS_SALVAS,
+  FRASE_DA_CONTA_QUE_NAO_EXISTE,
+  FRASE_DO_LOGIN_ADMINISTRADOR,
   FRASE_SEM_ACESSO_A_CONTA,
   FRASE_SEM_CONTAS,
   textoSemConta,
@@ -46,6 +48,12 @@ describe("as frases das contas por login", () => {
     expect(FRASE_CONTAS_SALVAS).toBe("Contas salvas. Valem já no próximo clique desse login.");
   });
 
+  // AS CONTAS DE UM LOGIN, NA PÁGINA LOGINS (seção 4): as duas recusas do "Salvar contas".
+  it("o salvar contas recusa o administrador e a conta que não existe, cada um com a sua frase", () => {
+    expect(FRASE_DO_LOGIN_ADMINISTRADOR).toBe("Esse login é administrador e já vê todas as contas.");
+    expect(FRASE_DA_CONTA_QUE_NAO_EXISTE).toBe("Uma das contas marcadas não existe mais. Recarregue a página.");
+  });
+
   // A PÁGINA SEM CONTA (seção 3): o administrador continua vendo o texto de hoje, que manda conectar uma
   // conta; o comum não conecta conta, e vê a frase que manda pedir ao administrador.
   it("a página sem conta mostra o texto de hoje ao administrador e a frase do comum ao comum", () => {
```

- [ ] **Passo 2: ver os testes falharem**

```bash
env -u CLAUDECODE -u AI_AGENT npx vitest run tests/logins-textos.test.ts
env -u CLAUDECODE -u AI_AGENT npx vitest run --config vitest.dom.config.ts testes-dom/logins-formularios.dom.tsx
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/logins-acoes.integracao.ts
```

Esperado: puros: 1 arquivo falhando, com 1 caso caindo e 6 passando; tela: 1 arquivo falhando, com 4 casos caindo; integração: 1 arquivo falhando, com 12 casos caindo e 9 passando. Cai porque as frases novas e o formulário das contas não existem, o login criado sem a caixinha ainda nasce administrador, e as actions novas não existem.

- [ ] **Passo 3: o código**

Em `app/logins/actions.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/logins/actions.ts b/app/logins/actions.ts
index 1ebeff4..2ba4c6e 100644
--- a/app/logins/actions.ts
+++ b/app/logins/actions.ts
@@ -3,12 +3,23 @@ import { revalidatePath } from "next/cache";
 import { redirect } from "next/navigation";
 import { exigirAdministrador, exigirSessao } from "@/lib/exigir-sessao";
 import { hashDaSenha, nomeValido, normalizarEmail, senhaValida } from "@/lib/logins";
-import { criarLogin, definirSenha, desativarLogin, reativarLogin } from "@/lib/logins-repositorio";
 import {
+  criarLogin,
+  definirContasDoLogin,
+  definirPapelDoLogin,
+  definirSenha,
+  desativarLogin,
+  reativarLogin,
+  type ResultadoDasContas,
+} from "@/lib/logins-repositorio";
+import {
+  FRASE_CONTAS_SALVAS,
+  FRASE_DA_CONTA_QUE_NAO_EXISTE,
   FRASE_DA_SENHA,
   FRASE_DA_SENHA_NOVA_DEFINIDA,
   FRASE_DO_EMAIL,
   FRASE_DO_EMAIL_REPETIDO,
+  FRASE_DO_LOGIN_ADMINISTRADOR,
   FRASE_DO_LOGIN_QUE_NAO_EXISTE,
   FRASE_DO_NOME,
 } from "@/lib/logins-textos";
@@ -16,6 +27,10 @@ import {
 // AS AÇÕES DA PÁGINA LOGINS (docs/specs/2026-11-04-logins.md, seção 4), só para administrador. Cada uma
 // começa por `await exigirSessao();` (tests/sessao-nas-actions.test.ts) e, logo depois, confere o
 // administrador no servidor: o menu esconder o item não basta, porque Server Action tem endereço próprio.
+//
+// DESDE AS CONTAS POR LOGIN (docs/specs/2026-11-05-contas-por-login.md, seção 4): o papel de um login novo vem
+// da caixinha "Administrador"; as contas de um login comum se trocam de uma vez; e o papel se troca com as
+// mesmas travas do desativar. As travas moram no repositório (lib/logins-repositorio.ts).
 
 export type EstadoDoFormulario = { erro?: string; ok?: string };
 
@@ -31,9 +46,9 @@ export async function criarLoginAction(
   if (!nome) return { erro: FRASE_DO_NOME };
   if (!email) return { erro: FRASE_DO_EMAIL };
   if (!senhaValida(senha)) return { erro: FRASE_DA_SENHA };
-  // O PAPEL VAI EXPLÍCITO (a 023 trocou o padrão para comum). Até a caixinha "Administrador" entrar na página,
-  // todo login criado aqui é administrador, como a página diz.
-  const r = await criarLogin({ email, nome, senhaHash: await hashDaSenha(senha), administrador: true });
+  // O PAPEL VAI SEMPRE EXPLÍCITO, pela caixinha "Administrador", que nasce desmarcada: sem ela, o login é comum.
+  const administrador = formData.get("administrador") === "on";
+  const r = await criarLogin({ email, nome, senhaHash: await hashDaSenha(senha), administrador });
   if ("erro" in r) return { erro: FRASE_DO_EMAIL_REPETIDO };
   revalidatePath("/logins");
   return { ok: `Login de ${nome} criado. Passe a senha inicial a ${nome}.` };
@@ -68,3 +83,52 @@ export async function reativarLoginAction(formData: FormData): Promise<void> {
   revalidatePath("/logins");
   redirect(`/logins?aviso=${ok ? "reativado" : "nao_encontrado"}`);
 }
+
+/** A recusa de cada resultado do repositório que não é "ok". */
+const RECUSA_DAS_CONTAS: Record<Exclude<ResultadoDasContas, "ok">, string> = {
+  administrador: FRASE_DO_LOGIN_ADMINISTRADOR,
+  nao_encontrado: FRASE_DO_LOGIN_QUE_NAO_EXISTE,
+  conta_inexistente: FRASE_DA_CONTA_QUE_NAO_EXISTE,
+};
+
+/**
+ * O "SALVAR CONTAS" DE UM LOGIN COMUM: as caixinhas marcadas trocam o conjunto de uma vez, numa transação do
+ * repositório, que recusa o administrador (ele vê todas), o login que não existe e a conta que não existe, sem
+ * mudar nada. A resposta volta como estado do formulário, como a senha nova.
+ */
+export async function definirContasDoLoginAction(
+  _anterior: EstadoDoFormulario,
+  formData: FormData
+): Promise<EstadoDoFormulario> {
+  await exigirSessao();
+  await exigirAdministrador();
+  const contas = formData.getAll("contas").map((c) => String(c));
+  const resultado = await definirContasDoLogin(String(formData.get("id") ?? ""), contas);
+  if (resultado !== "ok") return { erro: RECUSA_DAS_CONTAS[resultado] };
+  revalidatePath("/logins");
+  return { ok: FRASE_CONTAS_SALVAS };
+}
+
+/**
+ * "TORNAR ADMINISTRADOR" E "TORNAR COMUM": o papel novo vem do campo `papel`, e as travas são as do desativar
+ * (ninguém muda o próprio papel, e o último administrador ativo não vira comum). Um papel que não é dos dois
+ * não chega ao repositório, e volta com o aviso de não achado, como um id torto.
+ */
+export async function definirPapelDoLoginAction(formData: FormData): Promise<void> {
+  await exigirSessao();
+  const quem = await exigirAdministrador();
+  const papel = formData.get("papel");
+  if (papel !== "administrador" && papel !== "comum") redirect("/logins?aviso=nao_encontrado");
+  const virarAdministrador = papel === "administrador";
+  const resultado = await definirPapelDoLogin(String(formData.get("id") ?? ""), virarAdministrador, quem.id);
+  revalidatePath("/logins");
+  const aviso =
+    resultado === "ok"
+      ? virarAdministrador
+        ? "virou_administrador"
+        : "virou_comum"
+      : resultado === "proprio"
+        ? "papel_proprio"
+        : resultado;
+  redirect(`/logins?aviso=${aviso}`);
+}
```

Em `app/logins/formularios.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/logins/formularios.tsx b/app/logins/formularios.tsx
index b3861d6..2ee1017 100644
--- a/app/logins/formularios.tsx
+++ b/app/logins/formularios.tsx
@@ -1,11 +1,15 @@
 "use client";
 import { useActionState } from "react";
-import { criarLoginAction, definirSenhaAction, type EstadoDoFormulario } from "./actions";
-import { alertError, alertOk, btnPrimary, btnSecondary, input, label } from "../ui";
+import { criarLoginAction, definirContasDoLoginAction, definirSenhaAction, type EstadoDoFormulario } from "./actions";
+import { alertError, alertOk, btnPrimary, btnSecondary, input, label, muted } from "../ui";
 
 // OS FORMULÁRIOS DA PÁGINA LOGINS (docs/specs/2026-11-04-logins.md, seção 4): criar um login e definir a
 // senha nova de quem esqueceu. A senha é digitada pelo administrador, que a passa à pessoa; nenhum e-mail
 // sai daqui.
+//
+// DESDE AS CONTAS POR LOGIN (docs/specs/2026-11-05-contas-por-login.md, seção 4): o criar tem a caixinha
+// "Administrador", desmarcada (o login novo nasce comum), e cada login comum tem as contas dele, uma caixinha
+// por conta conectada.
 
 function Resposta({ estado }: { estado: EstadoDoFormulario }) {
   if (estado.erro)
@@ -56,6 +60,13 @@ export function CriarLogin() {
           />
         </div>
       </div>
+      <label className="flex items-center gap-2 text-sm">
+        <input type="checkbox" name="administrador" />
+        Administrador
+      </label>
+      <p className={`text-xs ${muted}`}>
+        Desmarcada, o login é comum: vê só as contas que você der a ele, e não entra na Configuração nem nos Logins.
+      </p>
       <button type="submit" disabled={criando} className={btnPrimary}>
         Criar login
       </button>
@@ -64,6 +75,47 @@ export function CriarLogin() {
   );
 }
 
+/** Uma conta como a caixinha a mostra: o id, o @ e o nome, e nunca o token. */
+export type ContaDaCaixinha = { ig_user_id: string; username: string | null; name: string | null };
+
+/**
+ * AS CONTAS DE UM LOGIN COMUM: uma caixinha por conta conectada, marcada se o login já a recebeu, e o "Salvar
+ * contas", que troca o conjunto de uma vez. A resposta volta como estado, como a senha nova.
+ */
+export function ContasDoLogin({
+  id,
+  nome,
+  contas,
+  marcadas,
+}: {
+  id: string;
+  nome: string;
+  contas: ContaDaCaixinha[];
+  marcadas: string[];
+}) {
+  const [estado, salvar, salvando] = useActionState<EstadoDoFormulario, FormData>(definirContasDoLoginAction, {});
+  if (!contas.length) return <p className={`text-xs ${muted}`}>Ainda não há contas no painel.</p>;
+  return (
+    <form action={salvar} className="space-y-2">
+      <input type="hidden" name="id" value={id} />
+      <p className={label}>Contas de {nome}</p>
+      <div className="flex flex-wrap gap-x-4 gap-y-1">
+        {contas.map((c) => (
+          <label key={c.ig_user_id} className="flex items-center gap-2 text-sm">
+            <input type="checkbox" name="contas" value={c.ig_user_id} defaultChecked={marcadas.includes(c.ig_user_id)} />
+            {c.username ? `@${c.username}` : c.ig_user_id}
+            {c.name && <span className={muted}>{c.name}</span>}
+          </label>
+        ))}
+      </div>
+      <button type="submit" disabled={salvando} className={btnSecondary}>
+        Salvar contas
+      </button>
+      <Resposta estado={estado} />
+    </form>
+  );
+}
+
 export function DefinirSenha({ id, nome }: { id: string; nome: string }) {
   const [estado, definir, definindo] = useActionState<EstadoDoFormulario, FormData>(definirSenhaAction, {});
   return (
```

Em `app/logins/page.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/logins/page.tsx b/app/logins/page.tsx
index eef9cfa..b6e947e 100644
--- a/app/logins/page.tsx
+++ b/app/logins/page.tsx
@@ -1,17 +1,24 @@
 import Link from "next/link";
 import { redirect } from "next/navigation";
-import { listarLogins } from "@/lib/logins-repositorio";
+import { contasDoLogin } from "@/lib/acesso";
+import { idsDasContasDoLogin, listarLogins } from "@/lib/logins-repositorio";
 import { avisoDaPagina } from "@/lib/logins-textos";
 import { sessaoAtual } from "@/lib/sessao";
 import { alertInfo, badgeNeutral, badgeWarn, btnGhost, card, link, muted, pageSubtitle, pageTitle } from "../ui";
-import { desativarLoginAction, reativarLoginAction } from "./actions";
-import { CriarLogin, DefinirSenha } from "./formularios";
+import { definirPapelDoLoginAction, desativarLoginAction, reativarLoginAction } from "./actions";
+import { ContasDoLogin, CriarLogin, DefinirSenha, type ContaDaCaixinha } from "./formularios";
 
 // A PÁGINA LOGINS (docs/specs/2026-11-04-logins.md, seção 4), só para administrador. A página confere o
 // administrador no servidor, e as actions dela conferem de novo: esconder o item do menu não basta.
 //
-// AS DUAS TRAVAS MORAM NO REPOSITÓRIO (lib/logins-repositorio.ts, `desativarLogin`): ninguém desativa o
-// próprio login, e o último administrador ativo fica. A página só não mostra o botão no próprio login.
+// AS TRAVAS MORAM NO REPOSITÓRIO (lib/logins-repositorio.ts, `desativarLogin` e `definirPapelDoLogin`):
+// ninguém desativa nem muda o papel do próprio login, e o último administrador ativo fica. A página só não
+// mostra os botões no próprio login.
+//
+// AS CONTAS DE CADA LOGIN COMUM (docs/specs/2026-11-05-contas-por-login.md, seção 4): a lista é a das contas
+// que o administrador vê (`contasDoLogin`, lib/acesso.ts, para a regra continuar num lugar só), e as marcadas
+// são as do login. O formulário é de cliente, e o que ele recebe vai na resposta: por isso a lista leva só o
+// id, o @ e o nome, e nunca a linha inteira, que tem o token.
 export const metadata = { title: "Logins" };
 export const dynamic = "force-dynamic";
 
@@ -28,13 +35,27 @@ export default async function LoginsPage({
   if (!quem.administrador) redirect("/");
   const aviso = avisoDaPagina((await searchParams).aviso);
   const logins = await listarLogins();
+  const contas: ContaDaCaixinha[] = (await contasDoLogin(quem)).map((c) => ({
+    ig_user_id: c.ig_user_id,
+    username: c.username,
+    name: c.name,
+  }));
+  // As contas marcadas de cada comum ativo, que é quem mostra o formulário.
+  const marcadas = new Map(
+    await Promise.all(
+      logins
+        .filter((l) => !l.administrador && l.desativado_em === null)
+        .map(async (l) => [l.id, await idsDasContasDoLogin(l.id)] as const)
+    )
+  );
 
   return (
     <div className="space-y-6">
       <header>
         <h1 className={pageTitle}>Logins</h1>
         <p className={pageSubtitle}>
-          Cada pessoa entra com o próprio e-mail e a própria senha. Nesta versão, todo login é administrador.
+          Cada pessoa entra com o próprio e-mail e a própria senha. O administrador vê todas as contas; o comum, só
+          as que você der a ele.
         </p>
       </header>
 
@@ -61,6 +82,7 @@ export default async function LoginsPage({
               <div className="flex flex-wrap items-center gap-2">
                 <span className="text-sm font-semibold">{l.nome}</span>
                 <span className={`text-sm ${muted}`}>{l.email}</span>
+                <span className={badgeNeutral}>{l.administrador ? "administrador" : "comum"}</span>
                 {souEu && <span className={badgeNeutral}>você</span>}
                 {desativado && <span className={badgeWarn}>desativado</span>}
                 <span className={`ml-auto text-xs ${muted}`}>criado em {quando(l.criado_em)}</span>
@@ -79,13 +101,28 @@ export default async function LoginsPage({
               ) : (
                 !desativado && <DefinirSenha id={l.id} nome={l.nome} />
               )}
+              {/* AS CONTAS: o administrador vê todas, e o comum ativo recebe as dele aqui. */}
+              {l.administrador ? (
+                <p className={`text-xs ${muted}`}>Vê todas as contas.</p>
+              ) : (
+                !desativado && <ContasDoLogin id={l.id} nome={l.nome} contas={contas} marcadas={marcadas.get(l.id) ?? []} />
+              )}
               {!souEu && (
-                <form action={desativado ? reativarLoginAction : desativarLoginAction}>
-                  <input type="hidden" name="id" value={l.id} />
-                  <button type="submit" className={btnGhost}>
-                    {desativado ? "Reativar" : "Desativar"}
-                  </button>
-                </form>
+                <div className="flex flex-wrap gap-2">
+                  <form action={definirPapelDoLoginAction}>
+                    <input type="hidden" name="id" value={l.id} />
+                    <input type="hidden" name="papel" value={l.administrador ? "comum" : "administrador"} />
+                    <button type="submit" className={btnGhost}>
+                      {l.administrador ? "Tornar comum" : "Tornar administrador"}
+                    </button>
+                  </form>
+                  <form action={desativado ? reativarLoginAction : desativarLoginAction}>
+                    <input type="hidden" name="id" value={l.id} />
+                    <button type="submit" className={btnGhost}>
+                      {desativado ? "Reativar" : "Desativar"}
+                    </button>
+                  </form>
+                </div>
               )}
             </li>
           );
```

Em `lib/logins-textos.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/logins-textos.ts b/lib/logins-textos.ts
index 93daa12..c6c5a89 100644
--- a/lib/logins-textos.ts
+++ b/lib/logins-textos.ts
@@ -17,6 +17,9 @@ export const FRASE_SEM_ACESSO_A_CONTA = "Você não tem acesso a essa conta.";
 export const FRASE_CARROSSEL_DE_OUTRA_CONTA = "Esse carrossel é de uma conta que você não tem.";
 export const FRASE_SEM_CONTAS = "Você ainda não tem contas. Peça ao administrador.";
 export const FRASE_CONTAS_SALVAS = "Contas salvas. Valem já no próximo clique desse login.";
+// As duas recusas do "Salvar contas" da página Logins (seção 4). O login que não existe usa a frase de sempre.
+export const FRASE_DO_LOGIN_ADMINISTRADOR = "Esse login é administrador e já vê todas as contas.";
+export const FRASE_DA_CONTA_QUE_NAO_EXISTE = "Uma das contas marcadas não existe mais. Recarregue a página.";
 
 /**
  * O TEXTO DA PÁGINA SEM CONTA (seção 3): o administrador vê o de hoje, que manda conectar uma conta; o comum
```

- [ ] **Passo 4: ver passar**

```bash
env -u CLAUDECODE -u AI_AGENT npx vitest run tests/logins-textos.test.ts
env -u CLAUDECODE -u AI_AGENT npx vitest run --config vitest.dom.config.ts testes-dom/logins-formularios.dom.tsx
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/logins-acoes.integracao.ts
npx eslint app/logins/actions.ts app/logins/formularios.tsx app/logins/page.tsx lib/logins-textos.ts testes-dom/logins-formularios.dom.tsx testes-integracao/logins-acoes.integracao.ts tests/logins-textos.test.ts
npx tsc --noEmit
```

Esperado: puros: 1 arquivo passando, com 7 casos passando; tela: 1 arquivo passando, com 4 casos passando; integração: 1 arquivo passando, com 21 casos passando; o lint e o `tsc` limpos.

- [ ] **Passo 5: o commit**

A mensagem do commit, gravada em `$SCRATCH/msg-contas-f6.txt`:

```text
A página Logins dá as contas a cada login comum e troca o papel, com as travas do último administrador
```

```bash
git add app/logins/actions.ts app/logins/formularios.tsx app/logins/page.tsx lib/logins-textos.ts testes-dom/logins-formularios.dom.tsx testes-integracao/logins-acoes.integracao.ts tests/logins-textos.test.ts
git commit -F "$SCRATCH/msg-contas-f6.txt"
```

---

### FASE 7 — A senha única sai do código

A passagem, a `senhaUnicaConfere` e a `gravarSenhaDaPassagem` saem. Um login sem senha não entra.

- [ ] **Passo 1: os testes, antes do código**

Em `testes-integracao/entrada.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/entrada.integracao.ts b/testes-integracao/entrada.integracao.ts
index ee95a76..f8d7757 100644
--- a/testes-integracao/entrada.integracao.ts
+++ b/testes-integracao/entrada.integracao.ts
@@ -3,8 +3,13 @@
 // descartável.
 //
 // O que se mede: a entrada certa abre UMA sessão e grava o cookie; toda entrada errada dá a mesma frase e
-// nenhuma sessão; o freio de tentativas segue valendo; a passagem da senha única grava o hash uma vez, só
-// num login sem senha; e o cookie v2 de antes não vale mais.
+// nenhuma sessão; o freio de tentativas segue valendo; o login sem senha não entra; e o cookie v2 de antes
+// não vale mais.
+//
+// A PASSAGEM DA SENHA ÚNICA SAIU (docs/specs/2026-11-05-contas-por-login.md, seção 5): até a entrega 2, um
+// login sem senha entrava uma vez pela `ADMIN_PASSWORD` e gravava ali a senha própria. Agora ele tem a
+// resposta de qualquer entrada errada, com o tempo de uma conferência, mesmo com a variável no ambiente (ela
+// fica na Vercel até depois do merge).
 import { beforeAll, beforeEach, describe, expect, it } from "vitest";
 import { bancoDescartavel } from "./harness";
 import { comoNumaRequisicao, SENHA_DE_TESTE } from "./semear-requisicao";
@@ -33,7 +38,6 @@ beforeEach(async () => {
   await q(`delete from sessoes`);
   await q(`delete from logins`);
   await q(`delete from login_attempts`);
-  process.env.ADMIN_PASSWORD = SENHA_DE_TESTE;
 });
 
 const SENHA = "uma senha de login comprida";
@@ -116,39 +120,53 @@ describe("a entrada", () => {
   });
 });
 
-describe("a passagem da senha única", () => {
-  it("o login sem senha entra com a ADMIN_PASSWORD, uma vez, e a segunda entrada já usa o hash", async () => {
-    const id = await novoLogin("eduardo@exemplo.invalid", null);
-    const primeira = await entrar("eduardo@exemplo.invalid", SENHA_DE_TESTE);
-    expect(primeira.destino).toBe("/");
-    const [linha] = await q(`select senha_hash from logins where id = $1`, [id]);
-    expect(String(linha.senha_hash)).toMatch(/^scrypt\$/);
-    expect(await logins.senhaConfere(SENHA_DE_TESTE, String(linha.senha_hash))).toBe(true);
-
-    // A partir daqui, quem decide é o hash: trocar a ADMIN_PASSWORD não muda nada.
-    process.env.ADMIN_PASSWORD = "outra senha unica qualquer";
-    expect((await entrar("eduardo@exemplo.invalid", SENHA_DE_TESTE)).destino).toBe("/");
-    expect((await entrar("eduardo@exemplo.invalid", "outra senha unica qualquer")).erro).toBe("E-mail ou senha incorretos.");
+/**
+ * Roda o corpo com a ADMIN_PASSWORD de teste no ambiente, como ela ainda está na Vercel até depois do merge, e
+ * a devolve como estava. É o pior caso para a entrada: a senha que antes era a única está à mão.
+ */
+async function comASenhaUnicaNoAmbiente<T>(corpo: () => Promise<T>): Promise<T> {
+  const antes = process.env.ADMIN_PASSWORD;
+  process.env.ADMIN_PASSWORD = SENHA_DE_TESTE;
+  try {
+    return await corpo();
+  } finally {
+    if (antes === undefined) delete process.env.ADMIN_PASSWORD;
+    else process.env.ADMIN_PASSWORD = antes;
+  }
+}
+
+const senhaDe = async (id: string) => (await q(`select senha_hash from logins where id = $1`, [id]))[0].senha_hash;
+
+describe("o login sem senha", () => {
+  it("é recusado com a frase de sempre, e nada é gravado no senha_hash", async () => {
+    const id = await novoLogin("sem-senha@exemplo.invalid", null);
+    const r = await entrar("sem-senha@exemplo.invalid", "uma senha qualquer que ele tentou");
+    expect(r).toEqual({ erro: logins.FRASE_DA_ENTRADA_ERRADA, destino: null, cookie: null });
+    expect(await senhaDe(id)).toBeNull();
+    expect(await quantasSessoes()).toBe(0);
   });
 
-  it("sem a ADMIN_PASSWORD no ambiente, a passagem recusa e não grava nada", async () => {
-    const id = await novoLogin("eduardo@exemplo.invalid", null);
-    delete process.env.ADMIN_PASSWORD;
-    const r = await entrar("eduardo@exemplo.invalid", SENHA_DE_TESTE);
-    expect(r.erro).toBe("E-mail ou senha incorretos.");
-    expect((await q(`select senha_hash from logins where id = $1`, [id]))[0].senha_hash).toBeNull();
+  it("nem a senha de teste que antes era a única abre esse login, mesmo com a ADMIN_PASSWORD no ambiente", async () => {
+    const id = await novoLogin("sem-senha@exemplo.invalid", null);
+    const r = await comASenhaUnicaNoAmbiente(() => entrar("sem-senha@exemplo.invalid", SENHA_DE_TESTE));
+    expect(r).toEqual({ erro: logins.FRASE_DA_ENTRADA_ERRADA, destino: null, cookie: null });
+    expect(await senhaDe(id)).toBeNull();
+    expect(await quantasSessoes()).toBe(0);
   });
 
-  it("a senha errada na passagem não grava nada", async () => {
-    const id = await novoLogin("eduardo@exemplo.invalid", null);
-    expect((await entrar("eduardo@exemplo.invalid", "nao e a senha unica")).erro).toBe("E-mail ou senha incorretos.");
-    expect((await q(`select senha_hash from logins where id = $1`, [id]))[0].senha_hash).toBeNull();
+  // O TEMPO NÃO CONTA: o login sem senha paga o scrypt de fachada, como o e-mail que não existe, para a
+  // resposta não dizer de fora que aquele e-mail tem login.
+  it("leva o tempo de uma conferência de senha", async () => {
+    await novoLogin("sem-senha@exemplo.invalid", null);
+    const t = performance.now();
+    await entrar("sem-senha@exemplo.invalid", "uma senha qualquer que ele tentou");
+    expect(performance.now() - t).toBeGreaterThan(150);
   });
 
-  it("um login COM senha não aceita a ADMIN_PASSWORD", async () => {
+  it("um login COM senha também não aceita a ADMIN_PASSWORD", async () => {
     await novoLogin("com-senha@exemplo.invalid");
-    const r = await entrar("com-senha@exemplo.invalid", SENHA_DE_TESTE);
-    expect(r.erro).toBe("E-mail ou senha incorretos.");
+    const r = await comASenhaUnicaNoAmbiente(() => entrar("com-senha@exemplo.invalid", SENHA_DE_TESTE));
+    expect(r.erro).toBe(logins.FRASE_DA_ENTRADA_ERRADA);
     expect(await quantasSessoes()).toBe(0);
   });
 });
```

Em `testes-integracao/logins-tabela.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/logins-tabela.integracao.ts b/testes-integracao/logins-tabela.integracao.ts
index 241ce8b..13a08e2 100644
--- a/testes-integracao/logins-tabela.integracao.ts
+++ b/testes-integracao/logins-tabela.integracao.ts
@@ -105,17 +105,6 @@ describe("o repositório dos logins", () => {
     expect(await repo.loginParaEntrar("ninguem@exemplo.invalid")).toBeNull();
   });
 
-  it("a passagem grava o hash só no login ativo sem senha, uma vez", async () => {
-    const semSenha = await novoLogin("passagem@exemplo.invalid", null);
-    const comSenha = await novoLogin("com-senha@exemplo.invalid");
-    expect(await repo.gravarSenhaDaPassagem(comSenha, HASH)).toBe(false);
-    expect(await repo.gravarSenhaDaPassagem(semSenha, HASH)).toBe(true);
-    expect(await repo.gravarSenhaDaPassagem(semSenha, HASH)).toBe(false);
-    const desativadoSemSenha = await novoLogin("desativado-sem-senha@exemplo.invalid", null);
-    await q(`update logins set desativado_em = now() where id = $1`, [desativadoSemSenha]);
-    expect(await repo.gravarSenhaDaPassagem(desativadoSemSenha, HASH)).toBe(false);
-  });
-
   it("a lista vem do mais velho para o mais novo, sem o hash", async () => {
     await novoLogin("primeiro@exemplo.invalid");
     await novoLogin("segundo@exemplo.invalid");
```

Em `testes-integracao/semear-requisicao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/semear-requisicao.ts b/testes-integracao/semear-requisicao.ts
index 4fbb52f..b3890df 100644
--- a/testes-integracao/semear-requisicao.ts
+++ b/testes-integracao/semear-requisicao.ts
@@ -111,7 +111,7 @@ import { exigirPrefixo } from "./banco-descartavel";
 const req = createRequire(import.meta.url);
 
 // ---------------------------------------------------------------------------
-// O LOGIN DE TESTE, e a senha única de teste posta ANTES de qualquer coisa a ler.
+// O LOGIN DE TESTE e a senha dele.
 //
 // DESDE OS LOGINS (docs/specs/2026-11-04-logins.md) a sessão mora no banco: o
 // cookie é um código sorteado, e só vale onde a linha da sessão existe. A
@@ -120,13 +120,14 @@ const req = createRequire(import.meta.url);
 // não vale em lugar nenhum fora deste schema, e a variante confere que a sessão
 // foi gravada nele (`exigirPrefixo`) antes de usá-la.
 //
-// A ADMIN_PASSWORD continua sobrescrita por um LITERAL: a passagem da senha única
-// (seção 6 da spec) a lê, e os testes da passagem têm de ler a de teste, e nunca
-// uma que chegasse ao `process.env` por outro caminho (o shell, um
-// `vercel env pull`). O `.env.local` tem a senha de verdade, e este harness nunca
-// a lê (banco-descartavel.ts). O valor do cookie nunca é impresso.
+// A ADMIN_PASSWORD JÁ NÃO É POSTA AQUI. Até a entrega 2 este arquivo a
+// sobrescrevia com a senha de teste, porque a passagem da senha única a lia.
+// A passagem saiu (docs/specs/2026-11-05-contas-por-login.md, seção 5), e nada
+// em app/ nem em lib/ lê a variável (tests/sem-senha-unica.test.ts). O
+// `.env.local` tem a senha de verdade, e este harness nunca a lê
+// (banco-descartavel.ts). SENHA_DE_TESTE é a senha dos logins de teste, e o
+// valor do cookie nunca é impresso.
 export const SENHA_DE_TESTE = "senha-de-teste-que-nao-vale-nada";
-process.env.ADMIN_PASSWORD = SENHA_DE_TESTE;
 
 /** O e-mail do login de teste: um domínio reservado, que não é de ninguém. */
 export const EMAIL_DE_TESTE = "login-de-teste@exemplo.invalid";
```

Crie `tests/sem-senha-unica.test.ts`:

```ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// A SENHA ÚNICA SAIU DO CÓDIGO (docs/specs/2026-11-05-contas-por-login.md, seção 5). Até a entrega 2 dos
// logins, um login sem senha entrava uma vez pela `ADMIN_PASSWORD` do ambiente, e a entrada gravava ali a
// senha própria dele (a passagem). Desde a entrega 2, todo login tem senha própria, e a variável deixa de ser
// lida: apagá-la da Vercel fica para depois do merge, com o OK do Eduardo.
//
// ESTE ARQUIVO VALE PARA O QUE AINDA NÃO EXISTE: ele lê todo arquivo de `app/` e de `lib/` pelo analisador do
// TypeScript, e acusa a leitura da variável (por `process.env.ADMIN_PASSWORD`, por `process.env["…"]`, pela
// desestruturação de `process.env` ou pelo nome dela num texto) e os nomes das duas peças da passagem. Um
// comentário que cita a variável, para contar a história, não conta.

const RAIZ = fileURLToPath(new URL("..", import.meta.url));

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

function analisar(rel: string, fonte = readFileSync(join(RAIZ, rel), "utf8")): ts.SourceFile {
  const tipo = rel.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(rel, fonte, ts.ScriptTarget.Latest, true, tipo);
}

const VARIAVEL = "ADMIN_PASSWORD";
const PECAS_DA_PASSAGEM = new Set(["senhaUnicaConfere", "gravarSenhaDaPassagem"]);

/** Se a expressão é `process.env`. */
const ehProcessEnv = (e: ts.Expression) =>
  ts.isPropertyAccessExpression(e) && e.name.text === "env" && ts.isIdentifier(e.expression) && e.expression.text === "process";

/** O que o arquivo tem da senha única, com a linha de cada achado. */
function achados(sf: ts.SourceFile): string[] {
  const saida: string[] = [];
  const anotar = (n: ts.Node, o: string) => saida.push(`${sf.fileName}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1} ${o}`);
  const andar = (n: ts.Node) => {
    if (ts.isPropertyAccessExpression(n) && n.name.text === VARIAVEL && ehProcessEnv(n.expression)) anotar(n, "process.env.ADMIN_PASSWORD");
    else if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && n.text === VARIAVEL) anotar(n, `"${VARIAVEL}"`);
    else if (ts.isBindingElement(n) && (n.propertyName ?? n.name).getText(sf) === VARIAVEL) anotar(n, `{ ${VARIAVEL} }`);
    else if (ts.isIdentifier(n) && PECAS_DA_PASSAGEM.has(n.text)) anotar(n, n.text);
    ts.forEachChild(n, andar);
  };
  andar(sf);
  return saida;
}

describe("a senha única saiu do código", () => {
  it("o leitor acusa quando há o que acusar", () => {
    const a = (fonte: string) => achados(analisar("x.ts", fonte));
    expect(a("const s = process.env.ADMIN_PASSWORD;")).toEqual(["x.ts:1 process.env.ADMIN_PASSWORD"]);
    expect(a('const s = process.env["ADMIN_PASSWORD"];')).toEqual(['x.ts:1 "ADMIN_PASSWORD"']);
    expect(a("const { ADMIN_PASSWORD } = process.env;")).toEqual(["x.ts:1 { ADMIN_PASSWORD }"]);
    expect(a("const { ADMIN_PASSWORD: s } = process.env;")).toEqual(["x.ts:1 { ADMIN_PASSWORD }"]);
    expect(a('import { senhaUnicaConfere } from "./auth";\nif (senhaUnicaConfere(x)) y();')).toEqual([
      "x.ts:1 senhaUnicaConfere",
      "x.ts:2 senhaUnicaConfere",
    ]);
    expect(a("export async function gravarSenhaDaPassagem() {}")).toEqual(["x.ts:1 gravarSenhaDaPassagem"]);
    // O comentário que conta a história não conta, nem outra variável do ambiente.
    expect(a("// a ADMIN_PASSWORD saiu\nconst s = process.env.CRON_SECRET;")).toEqual([]);
  });

  it("o leitor acha os arquivos de app/ e de lib/, inclusive os da entrada", () => {
    const todos = [...arquivosDe("app"), ...arquivosDe("lib")];
    for (const rel of ["lib/entrada.ts", "lib/auth.ts", "lib/logins-repositorio.ts", "app/entrar/actions.ts"]) {
      expect(todos, rel).toContain(rel);
    }
  });

  it("nenhum arquivo de app/ e de lib/ lê a ADMIN_PASSWORD, nem tem as peças da passagem", () => {
    expect([...arquivosDe("app"), ...arquivosDe("lib")].flatMap((rel) => achados(analisar(rel)))).toEqual([]);
  });
});
```

- [ ] **Passo 2: ver os testes falharem**

```bash
env -u CLAUDECODE -u AI_AGENT npx vitest run tests/sem-senha-unica.test.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/entrada.integracao.ts testes-integracao/logins-tabela.integracao.ts
```

Esperado: puros: 1 arquivo falhando, com 1 caso caindo e 2 passando; integração: 1 arquivo falhando e 1 passando, com 1 caso caindo e 24 passando. Cai porque a senha única ainda abre o login sem senha, e a leitura da `ADMIN_PASSWORD` ainda existe em `lib/auth.ts`.

- [ ] **Passo 3: o código**

Em `lib/auth.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/auth.ts b/lib/auth.ts
index 9eb876d..10d0b61 100644
--- a/lib/auth.ts
+++ b/lib/auth.ts
@@ -1,6 +1,6 @@
 import "server-only";
 import { randomBytes } from "node:crypto";
-import { safeEqualHex, safeEqualSecret } from "./crypto";
+import { safeEqualHex } from "./crypto";
 
 // O COOKIE DA SESSÃO. Até 04/11/2026 o valor era `v2.<expira>.<assinatura>`, assinado com uma chave derivada
 // da ADMIN_PASSWORD. Desde os logins (docs/specs/2026-11-04-logins.md) ele leva um código sorteado, e a
@@ -31,14 +31,3 @@ export function oauthStateConfere(doCookie: string | undefined, daVolta: string
   if (!doCookie || !daVolta || !STATE_HEX.test(doCookie) || !STATE_HEX.test(daVolta)) return false;
   return safeEqualHex(doCookie, daVolta);
 }
-
-/**
- * A SENHA ÚNICA, SÓ PARA A PASSAGEM (seção 6 da spec): a primeira entrada num login sem senha confere a
- * senha digitada contra a ADMIN_PASSWORD do ambiente. Sem a variável, recusa. É a única leitura dela que
- * sobrou, e sai na entrega 2.
- */
-export function senhaUnicaConfere(senha: string): boolean {
-  const unica = process.env.ADMIN_PASSWORD;
-  if (!unica) return false;
-  return safeEqualSecret(senha, unica);
-}
```

Em `lib/entrada.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/entrada.ts b/lib/entrada.ts
index 7210539..c1fa696 100644
--- a/lib/entrada.ts
+++ b/lib/entrada.ts
@@ -1,14 +1,13 @@
 import "server-only";
-import { senhaUnicaConfere } from "./auth";
 import { hashDaSenha, normalizarEmail, senhaConfere } from "./logins";
-import { gravarSenhaDaPassagem, loginParaEntrar } from "./logins-repositorio";
+import { loginParaEntrar } from "./logins-repositorio";
 
 // A CONFERÊNCIA DA ENTRADA (docs/specs/2026-11-04-logins.md, seção 3): devolve o id do login que entrou, ou
 // null. Toda entrada errada é a mesma para quem está do lado de fora: o e-mail que não existe, a senha
-// errada e o login desativado dão o mesmo null, e quem chama mostra uma frase só.
+// errada, o login desativado e o login sem senha dão o mesmo null, e quem chama mostra uma frase só.
 //
-// O TEMPO TAMBÉM NÃO PODE CONTAR: o e-mail que não existe paga um scrypt de fachada, para a resposta não
-// sair mais rápida que a de um e-mail que existe.
+// O TEMPO TAMBÉM NÃO PODE CONTAR: o e-mail que não existe e o login sem senha pagam um scrypt de fachada,
+// para a resposta não sair mais rápida que a de um login com senha.
 
 // Um hash qualquer, feito uma vez por processo, só para gastar o tempo de uma conferência.
 let hashDeFachada: Promise<string> | null = null;
@@ -20,19 +19,16 @@ async function gastarOTempoDeUmaConferencia(senha: string): Promise<void> {
 export async function conferirEntrada(emailBruto: string, senha: string): Promise<string | null> {
   const email = normalizarEmail(emailBruto);
   const login = email ? await loginParaEntrar(email) : null;
-  if (!login) {
+
+  // O LOGIN SEM SENHA NÃO ENTRA (docs/specs/2026-11-05-contas-por-login.md, seção 5). Até a entrega 2, ele
+  // entrava uma vez pela senha única do ambiente e gravava ali a senha própria (a passagem). Desde a entrega
+  // 2, todo login tem senha própria, e o que não tem recebe a resposta de qualquer entrada errada: o mesmo
+  // null, com o mesmo scrypt de fachada do e-mail que não existe.
+  if (!login || login.senha_hash === null) {
     await gastarOTempoDeUmaConferencia(senha);
     return null;
   }
 
-  // A PASSAGEM (seção 6): só um login sem senha aceita a senha única, e só enquanto não tiver senha. O hash
-  // é feito ANTES de conferir, para o tempo ser o de uma conferência mesmo quando ela não bate.
-  if (login.senha_hash === null) {
-    const hash = await hashDaSenha(senha);
-    if (login.desativado || !senhaUnicaConfere(senha)) return null;
-    return (await gravarSenhaDaPassagem(login.id, hash)) ? login.id : null;
-  }
-
   const confere = await senhaConfere(senha, login.senha_hash);
   return confere && !login.desativado ? login.id : null;
 }
```

Em `lib/logins-repositorio.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/logins-repositorio.ts b/lib/logins-repositorio.ts
index 28b885f..dd0bbff 100644
--- a/lib/logins-repositorio.ts
+++ b/lib/logins-repositorio.ts
@@ -53,7 +53,10 @@ export async function criarLogin(dados: {
   }
 }
 
-/** O que a entrada precisa para conferir: o id, o hash (nulo na passagem) e se o login está desativado. */
+/**
+ * O que a entrada precisa para conferir: o id, o hash e se o login está desativado. O hash nulo é o de um
+ * login sem senha própria, que não entra (docs/specs/2026-11-05-contas-por-login.md, seção 5).
+ */
 export async function loginParaEntrar(
   email: string
 ): Promise<{ id: string; senha_hash: string | null; desativado: boolean } | null> {
@@ -64,20 +67,6 @@ export async function loginParaEntrar(
   return linha ?? null;
 }
 
-/**
- * A PASSAGEM DA SENHA ÚNICA (seção 6 da spec): grava o hash só num login ativo que ainda está sem senha. A
- * segunda entrada já não passa por aqui, e duas entradas ao mesmo tempo gravam uma vez só.
- */
-export async function gravarSenhaDaPassagem(id: string, senhaHash: string): Promise<boolean> {
-  const linhas = (await sql().query(
-    `update logins set senha_hash = $2
-      where id = $1 and senha_hash is null and desativado_em is null
-      returning id`,
-    [id, senhaHash]
-  )) as { id: string }[];
-  return linhas.length === 1;
-}
-
 export async function listarLogins(): Promise<Login[]> {
   return (await sql().query(
     `select id, email, nome, administrador, criado_em, desativado_em from logins order by criado_em asc, email asc`
```

- [ ] **Passo 4: ver passar**

```bash
env -u CLAUDECODE -u AI_AGENT npx vitest run tests/sem-senha-unica.test.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/entrada.integracao.ts testes-integracao/logins-tabela.integracao.ts
npx eslint lib/auth.ts lib/entrada.ts lib/logins-repositorio.ts testes-integracao/entrada.integracao.ts testes-integracao/logins-tabela.integracao.ts testes-integracao/semear-requisicao.ts tests/sem-senha-unica.test.ts
npx tsc --noEmit
```

Esperado: puros: 1 arquivo passando, com 3 casos passando; integração: 2 arquivos passando, com 25 casos passando; o lint e o `tsc` limpos.

- [ ] **Passo 5: o commit**

A mensagem do commit, gravada em `$SCRATCH/msg-contas-f7.txt`:

```text
A senha única sai do código, e um login sem senha não entra
```

```bash
git add lib/auth.ts lib/entrada.ts lib/logins-repositorio.ts testes-integracao/entrada.integracao.ts testes-integracao/logins-tabela.integracao.ts testes-integracao/semear-requisicao.ts tests/sem-senha-unica.test.ts
git commit -F "$SCRATCH/msg-contas-f7.txt"
```

---

### FASE 8 — A verificação inteira, as mutações e a guarda do diff

- [ ] **Passo 1: o `verify`, com o build**

```bash
env -u CLAUDECODE -u AI_AGENT npm run verify
git diff --stat AGENTS.md
```

Esperado (medido em 05/11, das 17:14Z às 17:18Z, no `c107a5e`): lint e `tsc` limpos; 146 arquivos e 3 628 casos puros; 34 arquivos e 308 de tela; "SEM VAZAMENTO em A nem em C, nas duas varreduras."; "MIGRAÇÃO PULADA"; "▲ Next.js 16.4.3 (Turbopack)" e "Compiled successfully", com `/logins` e `/minha-conta` entre as rotas; e nenhuma diferença no `AGENTS.md`.

- [ ] **Passo 2: a integração inteira, sozinha no container**

```bash
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npm run test:integracao
```

Esperado (medido das 17:18Z às 17:21Z): `[rede-global] ALVO: banco de TESTE`, nenhum `teste_tmp_*` antes e depois, 66 arquivos, 784 passaram e 8 pularam.

- [ ] **Passo 3: as mutações do Apêndice A**, com a árvore commitada e limpa

```bash
node "$SCRATCH/mutar-contas.mjs"
```

Esperado: as 48 mutações derrubando, cada uma, o caso nomeado, e "48 mutações, 0 ruins; árvore no fim:
limpa".

- [ ] **Passo 4: a guarda do diff**

```bash
git diff --stat af395e2 HEAD -- . ':!docs'
git diff --quiet af395e2 HEAD -- lib/engine.ts lib/queue-drain.ts lib/db.ts lib/publicacao.ts lib/bucket.ts lib/bonus/publicar-processo.ts lib/bonus/imagem-processo.ts lib/bonus/carrossel-processo.ts lib/bonus/avulso-processo.ts lib/bonus/apagar-carrossel.ts lib/bonus/carrossel-repositorio.ts app/publicar/actions.ts app/publicar/post scripts package.json package-lock.json && echo "guarda: 0 diferença"
```

Esperado: os 77 arquivos do mapa e nenhum outro (3 901 linhas a mais e 351 a menos), e "guarda: 0 diferença".

- [ ] **Passo 5: o plano aplicado do zero** (a conferência da auditoria): numa cópia de `bc0c0ad` feita com
  `git -c core.autocrlf=false`, aplicar os blocos deste plano na ordem e comparar com a árvore do fim.

```bash
node "$SCRATCH/aplicar-plano-4.mjs" docs/plans/2026-11-05-contas-por-login.md <copia-limpa> bc0c0ad <fim-da-execucao>
```

Esperado: os 77 arquivos iguais, byte a byte.

---

### FASE 9 — A 023 na produção, o push, o preview, a prova e o PR

Cada escrita em produção tem o OK do Eduardo pela caixa, e a auditoria lê o banco antes e depois, avisada com a
hora. O preview usa o banco de produção. **Nenhum post e nenhuma DM.**

- [ ] **Passo 1: a linha de base da auditoria**, só de leitura:
  - o registro com 23 migrações e a ausência de `logins_contas`;
  - os logins, com `select count(*) from logins where senha_hash is null` = 0 (a senha única sai do código, e um
    login sem senha não entraria);
  - as contas.

- [ ] **Passo 2: o aviso ao Eduardo (achado 180), pela caixa:** entre a 023 e o merge, ninguém cria login. A
  página de hoje cria o login sem dizer o papel, e com o padrão novo ele nasceria comum, sem nenhuma conta.

- [ ] **Passo 3: o ensaio a seco da 023**, da raiz da cópia, com a `DATABASE_URL` do `.env.local` do repositório
  principal levada só ao processo, sem imprimir nada dela:

```bash
node --env-file="<raiz do repositório principal>/.env.local" scripts/migrar.mjs --a-mao
```

Esperado: só a `023-logins-contas.sql` como pendente, sem aplicar nada.

- [ ] **Passo 4: aplicar a 023, com o OK do Eduardo** e o "pode" da auditoria depois de ela ter a hora:

```bash
node --env-file="<raiz do repositório principal>/.env.local" scripts/migrar.mjs --aplicar --a-mao
node --env-file="<raiz do repositório principal>/.env.local" scripts/migrar.mjs --a-mao
```

Esperado: a primeira aplica e anota a `023`, e a segunda diz "já aplicada". A auditoria lê de novo, só lendo:
- 24 migrações;
- o `relrowsecurity` da `logins_contas` = true;
- o `has_table_privilege` de `anon` e de `authenticated` = false para select, insert, update e delete;
- 0 linhas na `logins_contas`;
- o padrão de `logins.administrador` = false, e os logins de antes iguais.

O código da `main` não lê a tabela, e por isso aplicá-la antes não muda nada na produção, salvo o padrão do papel
(passo 2).

- [ ] **Passo 5: o push da branch, com o OK do Eduardo**

```bash
git ls-remote origin refs/heads/contas-por-login
git push -u origin contas-por-login
```

Se a branch já existir no GitHub, pare. No log do build do preview, confira: o commit, nenhum aviso do Node 26,
"Detected Next.js version: 16.4.3", "MIGRAÇÃO PULADA" e as rotas de sempre.

- [ ] **Passo 6: a prova no preview, com o Eduardo**, e a hora à auditoria antes de cada gravação. O roteiro do
  navegador abre o preview num perfil próprio do Chrome; o Eduardo entra à mão, e o roteiro nunca vê a senha. Ele
  espera cada liberação numa página só de texto, que diz para não clicar nem fechar, e só abre o formulário
  depois da liberação (achado 176). Toda versão do roteiro passa pela auditoria antes de rodar (achado 175), e o
  perfil é apagado no fim.
  1. O Eduardo entra no preview (1 sessão).
  2. Na página Logins, ele cria um login comum de prova, com o e-mail `prova-contas` no domínio reservado
     `exemplo.invalid`, sem a caixinha, e dá a ele uma conta só (2 escritas).
  3. Numa janela sem perfil, o login de prova entra (1 sessão). Ele vê só aquela conta no seletor e nas páginas;
     a Configuração e a página Logins não aparecem no menu e, abertas pelo endereço, mandam para o início.
  4. O Eduardo tira a conta do login de prova (1 escrita). No próximo clique, a janela do login de prova diz "Você
     ainda não tem contas. Peça ao administrador.".
  5. O login de prova é desativado (1 escrita) e fica como histórico.
  6. **A medida:** o tempo até os cabeçalhos finais (o `finalResponseHeadersStart`, por causa do 103 da Vercel) de
     10 aberturas do `/`, para o comum e para o administrador, contra os 122 ms de 04/11.
  7. O Sair do Eduardo apaga a sessão dele.

  A recusa de publicar fica coberta pela integração, e a prova não clica em publicar.

- [ ] **Passo 7: o PR**, com o OK do Eduardo. O corpo leva o que muda, os números deste plano, a medida do passo
  6, os desvios do plano (os itens de "O que o ensaio achou") e nenhuma arroba solta. A mensagem do merge vai à
  parte, e a auditoria lê os dois antes de o PR abrir. O merge é do Eduardo.

- [ ] **Passo 8: o deploy do merge.**
  - No log: "Nada a aplicar: as 24 migrações já constam no registro.", sem o aviso do Node 26.
  - No site: o `/entrar` dá 200, e o cron sem senha dá 401.
  - A auditoria lê o banco antes e depois, e o Eduardo entra de novo na produção.
  - Depois, com o OK do Eduardo, a `ADMIN_PASSWORD` sai da Vercel.

---

## Apêndice A — As mutações

O roteiro roda da raiz da worktree, com a árvore commitada e limpa. Cada mutação troca um trecho que aparece uma
vez só, roda o arquivo de teste que a cobre e confere que o caso nomeado cai, pelo nome inteiro. As de integração
rodam contra o banco de TESTE, uma de cada vez. No fim, a árvore volta limpa.

```js
// AS MUTAÇÕES DAS CONTAS POR LOGIN (docs/specs/2026-11-05-contas-por-login.md, entrega 2 dos logins), no molde
// de mutar-logins.mjs (a entrega 1). Cada uma desfaz UMA trava, trocando um trecho exato de um arquivo (que tem
// de aparecer uma vez só), roda só o arquivo de teste que a cobre e confere que o caso NOMEADO cai. Os de
// integração rodam contra o banco de TESTE, um de cada vez. A árvore tem de estar commitada e limpa antes, e
// volta limpa no fim.
//
// Uso, da raiz da cópia: node ../mutar-contas.mjs [prefixo-do-nome]
//                        node ../mutar-contas.mjs --conferir   (só confere que cada trecho aparece uma vez)
//
// O CASO NOMEADO É CONFERIDO PELO NOME INTEIRO: a linha do `×` tem de ser exatamente o nome dele (com a duração
// no fim, se houver), e não só conter o texto. Assim "leva o tempo de uma conferência de senha" não passa pelo
// caso do e-mail que não existe, que tem o mesmo final.
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const TESTES_URL = "postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes";
if (process.env.DATABASE_URL) throw new Error("RECUSADO: DATABASE_URL no ambiente");
const status = () => execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim();
if (status() !== "") throw new Error("RECUSADO: árvore suja antes das mutações");

const PURO = { config: null };
const DOM = { config: "vitest.dom.config.ts" };
const INTEG = { config: "vitest.integracao.config.ts" };

const T_ESCOLHA = { ...PURO, arquivo: "tests/acesso-escolha.test.ts" };
const T_EVENTOS = { ...PURO, arquivo: "tests/event-query.test.ts" };
const T_ARTE = { ...PURO, arquivo: "tests/bonus-arte-conta.test.ts" };
const T_LAYOUT = { ...PURO, arquivo: "tests/layout-contas.test.ts" };
const T_MENU = { ...DOM, arquivo: "testes-dom/menu-do-login-comum.dom.tsx" };
const T_CONTAS = { ...INTEG, arquivo: "testes-integracao/contas-por-login.integracao.ts" };
const T_CARROSSEL = { ...INTEG, arquivo: "testes-integracao/contas-no-carrossel.integracao.ts" };
const T_TABELA = { ...INTEG, arquivo: "testes-integracao/logins-contas-tabela.integracao.ts" };
const T_ACOES = { ...INTEG, arquivo: "testes-integracao/logins-acoes.integracao.ts" };
const T_PAGINAS = { ...INTEG, arquivo: "testes-integracao/paginas-sem-conta.integracao.ts" };
const T_ENTRADA = { ...INTEG, arquivo: "testes-integracao/entrada.integracao.ts" };

/** A trava de cada action da Configuração: o `exigirAdministrador` logo depois do `exigirSessao`. */
const semAdministrador = (nome, assinatura, caso = `${nome} vai para /, e nada muda`) => ({
  arq: "app/setup/actions.ts",
  de: `export async function ${nome}(${assinatura} {\n  await exigirSessao();\n  await exigirAdministrador();\n`,
  para: `export async function ${nome}(${assinatura} {\n  await exigirSessao();\n`,
  teste: T_CONTAS,
  cai: caso,
});

/** A conferência da conta do carrossel numa action, com a linha seguinte para o trecho ser único. */
const semConferenciaDoCarrossel = (nome, arq, linha, seguinte) => ({
  nome,
  arq,
  de: `${linha}\n${seguinte}`,
  para: seguinte,
  teste: T_CARROSSEL,
  cai: `${nome.split(": ")[1].split(" ")[0]} recusa com a frase, e o carrossel, a fila e as reservas ficam iguais`,
});
const RECUSA_DA_CONTA = 'return { tom: "erro", texto: FRASE_CARROSSEL_DE_OUTRA_CONTA, em };';

const MUTACOES = [
  // A regra num lugar só (lib/acesso.ts e lib/acesso-escolha.ts), e quem pergunta a ela.
  {
    nome: "G1: a escolherConta sem o filtro (o cookie escolhe fora da lista)",
    arq: "lib/acesso-escolha.ts",
    de: "return permitidas.find((c) => c.ig_user_id === doCookie) ?? permitidas[0] ?? null;",
    para: "return (doCookie ? ({ ig_user_id: doCookie } as T) : null) ?? permitidas[0] ?? null;",
    teste: T_ESCOLHA,
    cai: "é a primeira permitida quando o cookie é de uma conta de fora, e nunca a de fora",
  },
  {
    nome: "G2: a conta escolhida escolhendo em todas as contas",
    arq: "lib/acesso.ts",
    de: "return escolherConta(await contasDoLogin(login), doCookie);",
    para: "return escolherConta(await listAccounts(), doCookie);",
    teste: T_CONTAS,
    cai: "com o cookie da B, a conta escolhida do comum é a A",
  },
  {
    nome: "G3: o contasDoLogin do comum devolvendo todas",
    arq: "lib/acesso.ts",
    de: "  if (login.administrador) return listAccounts();\n",
    para: "  return listAccounts();\n",
    teste: T_CONTAS,
    cai: "as contas do comum são só a A",
  },
  {
    nome: "G4: o podeVerConta do comum dizendo sempre que sim",
    arq: "lib/acesso.ts",
    de: "  return (await idsDasContasDoLogin(login.id)).includes(contaId);",
    para: "  return true;",
    teste: T_CONTAS,
    cai: "o da B não grava o cookie, nem revalida",
  },
  {
    nome: "G5: o soAsDoLogin do comum devolvendo todas",
    arq: "lib/acesso.ts",
    de: "  if (login.administrador) return contas;\n",
    para: "  return contas;\n",
    teste: T_CARROSSEL,
    cai: "o comum com o cookie da B tem a A; sem contas, nenhuma",
  },
  {
    nome: "G6: o selectAccount sem o podeVerConta",
    arq: "app/account-actions.ts",
    de: "  if (!id || !login || !(await podeVerConta(login, id))) return;",
    para: "  if (!id) return;",
    teste: T_CONTAS,
    cai: "o da B não grava o cookie, nem revalida",
  },
  {
    nome: "G7: o seletor do layout com todas as contas",
    arq: "app/layout.tsx",
    de: "      accounts = (await contasDoLogin(login)).map((a) => ({",
    para: "      accounts = (await listAccounts()).map((a) => ({",
    teste: T_LAYOUT,
    cai: "app/layout.tsx não chama listAccounts(): o seletor mostra só as contas do login",
  },
  {
    nome: "G8: o account_id tirado da consulta do deleteAutomation (181)",
    arq: "app/automacoes/actions.ts",
    de: "`delete from automations where id = $1 and account_id = $2 returning id`,\n    [id, accountId]",
    para: "`delete from automations where id = $1 returning id`,\n    [id]",
    teste: T_CONTAS,
    cai: "deleteAutomation: o id da B é recusado e a automação da B fica igual",
  },
  // A Configuração e o conectar são do administrador.
  { nome: "S1: o reassinarWebhooks sem o exigirAdministrador", ...semAdministrador("reassinarWebhooks", "): Promise<void>") },
  { nome: "S2: o testarWebhook sem o exigirAdministrador", ...semAdministrador("testarWebhook", "): Promise<void>") },
  {
    nome: "S3: o configurarWebhookAuto sem o exigirAdministrador",
    ...semAdministrador("configurarWebhookAuto", "formData: FormData): Promise<void>"),
  },
  {
    nome: "S4: o saveMetaCredentials sem o exigirAdministrador",
    ...semAdministrador("saveMetaCredentials", "formData: FormData): Promise<void>"),
  },
  {
    nome: "S5: o salvarPerguntasDeAbertura sem o exigirAdministrador",
    ...semAdministrador("salvarPerguntasDeAbertura", "formData: FormData): Promise<void>"),
  },
  {
    nome: "S6: o gerarConvite sem o exigirAdministrador",
    ...semAdministrador("gerarConvite", "_anterior: EstadoDoGerar, formData: FormData): Promise<EstadoDoGerar>"),
  },
  {
    nome: "S7: o cancelarConvite sem o exigirAdministrador",
    ...semAdministrador("cancelarConvite", "formData: FormData): Promise<void>"),
  },
  {
    nome: "S8: o SetupPage sem o redirect do comum",
    arq: "app/setup/page.tsx",
    de: '  if (!quem.administrador) redirect("/");\n  const sp = await searchParams;',
    para: "  const sp = await searchParams;",
    teste: T_CONTAS,
    cai: "o comum vai para /",
  },
  {
    nome: "S9: o /api/oauth/login sem a conferência do papel",
    arq: "app/api/oauth/login/route.ts",
    de: "  if (!login.administrador) {\n    return NextResponse.redirect(`${req.nextUrl.origin}/`);\n  }\n",
    para: "",
    teste: T_CONTAS,
    cai: "com a sessão do comum, volta para a raiz, sem state",
  },
  // Os eventos sem conta.
  {
    nome: "V1: o comEventosSemConta ignorado no buildWhere",
    arq: "lib/event-query.ts",
    de: "  const partes = [termoDaConta(comEventosSemConta)];",
    para: "  const partes = [termoDaConta(true)];",
    teste: T_EVENTOS,
    cai: "com false, o primeiro termo é só a conta, e o `is null` sai",
  },
  {
    nome: "V2: o comEventosSemConta ignorado no postsComEventos",
    arq: "lib/event-query.ts",
    de: "          where ${termoDaConta(comEventosSemConta)}",
    para: "          where ${termoDaConta(true)}",
    teste: T_EVENTOS,
    cai: "postsComEventos com false: só a conta, e o `is null` sai",
  },
  {
    nome: "V3: o eventos/page passando true sempre",
    arq: "app/eventos/page.tsx",
    de: "  const comEventosSemConta = administrador;",
    para: "  const comEventosSemConta = true;",
    teste: T_CONTAS,
    cai: "o comum não vê o evento sem conta, e o administrador vê",
  },
  // O menu e o seletor.
  {
    nome: "M1: o menu mostrando a Configuração ao comum",
    arq: "app/app-shell.tsx",
    de: '    items: [{ href: "/produtos", label: "Produtos", icon: IconStore }],',
    para:
      '    items: [\n      { href: "/produtos", label: "Produtos", icon: IconStore },\n      { href: "/setup", label: "Configuração", icon: IconSettings },\n    ],',
    teste: T_MENU,
    cai: "o comum não vê a Configuração nem os Logins",
  },
  {
    nome: "M2: o menu dando o podeConectar a todo login",
    arq: "app/app-shell.tsx",
    de: "            podeConectar={login?.administrador ?? false}",
    para: "            podeConectar={true}",
    teste: T_MENU,
    cai: "o comum abre o seletor e não acha o + Conectar outra conta",
  },
  {
    nome: "M3: o seletor mostrando o + Conectar outra conta ao comum",
    arq: "app/account-switcher.tsx",
    de: "          {podeConectar && (",
    para: "          {true && (",
    teste: T_MENU,
    cai: "o comum abre o seletor e não acha o + Conectar outra conta",
  },
  {
    nome: "M4: o seletor sem contas mostrando o Conectar Instagram ao comum",
    arq: "app/account-switcher.tsx",
    de: "    return podeConectar ? (",
    para: "    return true ? (",
    teste: T_MENU,
    cai: "o comum sem contas não vê o Conectar Instagram",
  },
  // Os carrosséis.
  semConferenciaDoCarrossel(
    "K1: pedirImagemDoSlide sem o carrosselDeOutraConta",
    "app/bonus/imagem-actions.ts",
    `  if (await carrosselDeOutraConta(id)) ${RECUSA_DA_CONTA}`,
    "  const numero = inteiro(p.numero);"
  ),
  semConferenciaDoCarrossel(
    "K2: assinarImagemDoCarrossel sem o carrosselDeOutraConta",
    "app/bonus/publicar-actions.ts",
    "  if (await carrosselDeOutraConta(p.id)) return { ok: false, texto: FRASE_CARROSSEL_DE_OUTRA_CONTA };",
    "  const r = await assinarImagem("
  ),
  semConferenciaDoCarrossel(
    "K3: guardarImagemDoSlide sem o carrosselDeOutraConta",
    "app/bonus/publicar-actions.ts",
    `  if (await carrosselDeOutraConta(p.id)) ${RECUSA_DA_CONTA}`,
    "  const r = await guardarImagem("
  ),
  semConferenciaDoCarrossel(
    "K4: publicarCarrossel sem o carrosselDeOutraConta",
    "app/bonus/publicar-actions.ts",
    `  if (await carrosselDeOutraConta(p.id)) ${RECUSA_DA_CONTA}`,
    "  const campos = camposDaDataHora(p.dataHora);"
  ),
  semConferenciaDoCarrossel(
    "K5: apagarCarrosselDaPagina sem o carrosselDeOutraConta",
    "app/bonus/apagar-actions.ts",
    `  if (await carrosselDeOutraConta(id)) ${RECUSA_DA_CONTA}`,
    "  const r = await apagarCarrossel(id);"
  ),
  {
    nome: "K6: o contaParaGerarDeNovo escolhendo em contas (179)",
    arq: "lib/bonus/arte-conta.ts",
    de: "  const logada = contaSelecionada(permitidas, doCookie);\n  return logada ? contaParaGuardar(logada) : null;",
    para: "  const logada = contaSelecionada(contas, doCookie);\n  return logada ? contaParaGuardar(logada) : null;",
    teste: T_ARTE,
    cai: "o Gerar de novo de um original sem conta escolhe na permitida (179)",
  },
  {
    nome: "K7: o resolverConta caindo em contas (o carrossel sem conta)",
    arq: "lib/bonus/arte-conta.ts",
    de: '  return { conta: contaSelecionada(permitidas, doCookie), origem: "selecionada" };',
    para: '  return { conta: contaSelecionada(contas, doCookie), origem: "selecionada" };',
    teste: T_ARTE,
    cai: "sem conta no carrossel: a queda escolhe na permitida, e o cookie de fora dela não vale",
  },
  {
    nome: "K8: o resolverConta caindo em contas (a conta gravada que saiu sem nome)",
    arq: "lib/bonus/arte-conta.ts",
    de: '    return { conta: contaSelecionada(permitidas, doCookie), origem: "gravada_saiu" };',
    para: '    return { conta: contaSelecionada(contas, doCookie), origem: "gravada_saiu" };',
    teste: T_ARTE,
    cai: "a conta gravada que saiu sem nome também cai na permitida",
  },
  {
    nome: "K9: a contaDoMenuNoCarrossel escolhendo na lista inteira",
    arq: "lib/bonus/carrossel-acesso.ts",
    de: "  return escolherConta(await cabecalhosDoLogin(), (await cookies()).get(ACCOUNT_COOKIE)?.value);",
    para: "  return escolherConta(await contasParaArte(), (await cookies()).get(ACCOUNT_COOKIE)?.value);",
    teste: T_CARROSSEL,
    cai: "o comum com o cookie da B tem a A; sem contas, nenhuma",
  },
  {
    nome: "K10: o fixar sem a recusa do comum sem contas (cai na primeira de todas)",
    arq: "app/bonus/carrossel-actions.ts",
    de: '  const logada = await contaDoMenuNoCarrossel();\n  if (!logada) return resposta("erro", FRASE_SEM_CONTAS);',
    para:
      '  const logada = (await contaDoMenuNoCarrossel()) ?? (await contasParaArte())[0] ?? null;\n  if (!logada) return resposta("erro", FRASE_SEM_CONTAS);',
    teste: T_CARROSSEL,
    cai: "o comum sem contas recebe a frase de quem não tem contas, e nada é gravado",
  },
  // A tabela, o repositório e a página Logins.
  {
    nome: "L1: o criarLogin sem o administrador (o insert sem a coluna)",
    arq: "lib/logins-repositorio.ts",
    de:
      "      `insert into logins (email, nome, senha_hash, administrador) values ($1, $2, $3, $4) returning id`,\n      [dados.email, dados.nome, dados.senhaHash, dados.administrador]",
    para: "      `insert into logins (email, nome, senha_hash) values ($1, $2, $3) returning id`,\n      [dados.email, dados.nome, dados.senhaHash]",
    teste: T_TABELA,
    cai: "criar grava o papel que veio, e nunca o padrão",
  },
  {
    nome: "L2: o definirContasDoLogin aceitando administrador",
    arq: "lib/logins-repositorio.ts",
    de: '    if (linha.administrador) return "administrador";\n',
    para: "",
    teste: T_TABELA,
    cai: "salvar as contas recusa o administrador, o login desativado e o que não existe",
  },
  {
    nome: "L3: o definirContasDoLogin sem a conferência da conta inexistente",
    arq: "lib/logins-repositorio.ts",
    de: '      if (n !== unicas.length) return "conta_inexistente";\n',
    para: "",
    teste: T_TABELA,
    cai: "salvar as contas recusa a conta que não existe, sem mudar nada",
  },
  {
    nome: "L4: o `for update` tirado da contagem do definirPapelDoLogin (168)",
    arq: "lib/logins-repositorio.ts",
    de:
      '  if (id === quemPede) return "proprio";\n  return sql().begin(async (tx) => {\n    const ativos = (await tx.query(\n      `select id from logins where administrador and desativado_em is null for update`',
    para:
      '  if (id === quemPede) return "proprio";\n  return sql().begin(async (tx) => {\n    const ativos = (await tx.query(\n      `select id from logins where administrador and desativado_em is null`',
    teste: T_TABELA,
    cai: "duas trocas de papel ao mesmo tempo deixam 1 administrador ativo, e não 0 (achado 168)",
  },
  {
    nome: "L5: a trava do próprio papel tirada",
    arq: "lib/logins-repositorio.ts",
    de: '  if (id === quemPede) return "proprio";\n',
    para: "",
    teste: T_TABELA,
    cai: "trocar o papel recusa o próprio e o login que não existe",
  },
  {
    nome: "L6: a criarLoginAction ignorando a caixinha (sempre administrador)",
    arq: "app/logins/actions.ts",
    de: '  const administrador = formData.get("administrador") === "on";',
    para: "  const administrador = true;",
    teste: T_ACOES,
    cai: "sem a caixinha nasce comum, e com ela nasce administrador",
  },
  {
    nome: "L7: a página Logins entregando a conta inteira ao formulário (o token no navegador)",
    arq: "app/logins/page.tsx",
    de:
      "  const contas: ContaDaCaixinha[] = (await contasDoLogin(quem)).map((c) => ({\n    ig_user_id: c.ig_user_id,\n    username: c.username,\n    name: c.name,\n  }));",
    para: "  const contas: ContaDaCaixinha[] = await contasDoLogin(quem);",
    teste: T_ACOES,
    cai: "mostra o papel, as contas do comum, o 'Vê todas as contas' do administrador e o trocar o papel",
  },
  {
    nome: "L8: o definirContasDoLoginAction sem o exigirAdministrador",
    arq: "app/logins/actions.ts",
    de: "  await exigirSessao();\n  await exigirAdministrador();\n  const contas = formData.getAll",
    para: "  await exigirSessao();\n  const contas = formData.getAll",
    teste: T_ACOES,
    cai: "volta para o início em cada ação da página, as novas e as de antes, sem gravar nada",
  },
  {
    nome: "L9: o definirPapelDoLoginAction sem o exigirAdministrador",
    arq: "app/logins/actions.ts",
    de: '  const quem = await exigirAdministrador();\n  const papel = formData.get("papel");',
    para: '  const quem = { id: "" };\n  const papel = formData.get("papel");',
    teste: T_ACOES,
    cai: "volta para o início em cada ação da página, as novas e as de antes, sem gravar nada",
  },
  // As páginas sem conta.
  {
    nome: "P1: os Contatos sem conta mostrando o convite de hoje ao comum",
    arq: "app/contatos/page.tsx",
    de: "  const administrador = (await sessaoAtual())?.administrador ?? false;",
    para: "  const administrador = true;",
    teste: T_PAGINAS,
    cai: "'os Contatos' do comum mostra a frase uma vez por seção, sem o convite de hoje nem o link para a Configuração",
  },
  {
    nome: "P2: o Início sem conta mostrando o convite de hoje ao comum",
    arq: "app/page.tsx",
    de: "  const administrador = login?.administrador ?? false;",
    para: "  const administrador = true;",
    teste: T_PAGINAS,
    cai: "'o Início' do comum mostra a frase uma vez por seção, sem o convite de hoje nem o link para a Configuração",
  },
  {
    nome: "P3: o Reconectar à vista do comum",
    arq: "app/page.tsx",
    de: "                  {administrador && (",
    para: "                  {true && (",
    teste: T_PAGINAS,
    cai: "o Início do comum com a conta não tem o Reconectar, e o do administrador tem",
  },
  // A entrada sem a senha única.
  {
    nome: "E1: a entrada aceitando de volta o login sem senha (a passagem)",
    arq: "lib/entrada.ts",
    de: "  if (!login || login.senha_hash === null) {\n    await gastarOTempoDeUmaConferencia(senha);\n    return null;\n  }",
    para:
      "  if (!login) {\n    await gastarOTempoDeUmaConferencia(senha);\n    return null;\n  }\n  if (login.senha_hash === null) return !login.desativado && senha === process.env.ADMIN_PASSWORD ? login.id : null;",
    teste: T_ENTRADA,
    cai: "nem a senha de teste que antes era a única abre esse login, mesmo com a ADMIN_PASSWORD no ambiente",
  },
  {
    nome: "E2: o login sem senha sem o scrypt de fachada",
    arq: "lib/entrada.ts",
    de: "  if (!login || login.senha_hash === null) {\n    await gastarOTempoDeUmaConferencia(senha);\n    return null;\n  }",
    para: "  if (!login) {\n    await gastarOTempoDeUmaConferencia(senha);\n    return null;\n  }\n  if (login.senha_hash === null) return null;",
    teste: T_ENTRADA,
    cai: "leva o tempo de uma conferência de senha",
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
