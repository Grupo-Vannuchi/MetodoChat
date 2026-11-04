# O link de convite para o cliente conectar a própria conta — Plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: `superpowers:subagent-driven-development`
> (recomendada) ou `superpowers:executing-plans`, fase por fase. Os passos usam caixa de
> seleção (`- [ ]`) para acompanhar.

**Objetivo:** o painel gera, na etapa 6 da Configuração, um link de convite de uso único e válido por 7 dias.
O cliente abre o link sem a senha do painel, segue o passo a passo e conecta a própria conta do Instagram,
sem passar a senha a ninguém. O convite fica registrado com o estado (pendente, usado, vencido ou
cancelado), a conta que entrou e o último erro, que só o painel vê.

**Arquitetura:** uma tabela de feature nova (`convites_de_conexao`, migração 021) guarda só o hash do código.
As regras são puras (`lib/convites.ts`), e o banco fica em `lib/convites-repositorio.ts`, com a reivindicação
do convite e a gravação da conta numa transação só. O começo pelo convite é uma rota aberta nova
(`/api/oauth/convite/[codigo]`), que grava um segundo cookie ao lado do `state`. A volta de hoje
(`/api/oauth/callback`) desvia para `app/api/oauth/callback/convite.ts` quando esse cookie vem junto. As três
páginas do cliente (`/convite/[codigo]`, `/convite/pronto` e `/convite/erro`) são abertas e não mostram nada
do painel, e as rotas do convite levam três cabeçalhos que fecham o código do link (achado 157).

**Stack:** a do projeto, no Next.js 16.4.3: Vitest (as três suítes), Testing Library no jsdom, o
`react-dom/server` para desenhar as páginas do servidor nos testes, e o Postgres no container para a
integração.

**Spec:** `docs/specs/2026-11-03-link-de-convite.md` (commits `250cd6f` e `08fd8bf`, auditada pela
`metodochat-74` com os achados 157, 158 e 159 absorvidos em `08fd8bf`, liberada e lida pelo Eduardo: "Li,
pode seguir"). Leia antes de começar: este plano não repete o porquê, só como construir.

**Ensaio do plano (03/11):** o código deste plano foi escrito e testado fase a fase numa cópia isolada do
repositório (`git worktree`, sem push, branch local `ensaio-convite`, saída de `08fd8bf`), e todo bloco de
código abaixo foi tirado do git dessa cópia por um gerador, sem cópia à mão. Os commits do ensaio são a
FASE 1 `409eca7`, a 2 `e307dec`, a 3 `d1fb428`, a 4 `37c1da1`, a 5 `cffe59a` e a 6 `7502e9e`, com as mensagens
deste plano.

Os números são os dessa cópia:
- lint e `tsc` limpos em cada fase; no fim, 139 arquivos e 3 564 casos puros (137 arquivos e 3 540 na base) e
  30 arquivos e 293 de tela (28 arquivos e 285 na base);
- `next build` (Turbopack) limpo, com o `node_modules` próprio na cópia: "MIGRAÇÃO PULADA", as 42 rotas (as 38
  de antes e as 4 do convite) mais o proxy, e o `AGENTS.md` intacto;
- a varredura "SEM VAZAMENTO em A nem em C, nas duas varreduras";
- integração no container, com o `.env.local` vazio na cópia (achado 140): 57 arquivos, 634 passaram e 8 pularam
  (53 arquivos, 603 passaram e 8 pularam na base);
- cada fase foi vista falhar antes do código e passar depois, com os números no passo dela;
- as 50 provas de mutação do Apêndice A derrubaram, cada uma, o caso esperado. A primeira rodada deu 2 ruins,
  e os dois eram erros do roteiro, e não buracos nos testes: um caso com o nome errado e um trecho que aparecia
  também num comentário. Corrigido o roteiro, deu 50 de 50. Na revisão do plano, a auditoria pediu a 51ª, a
  V10 (a volta do convite gravando o cookie da conta selecionada), que a spec lista e o roteiro não tinha; ela
  entrou na execução, na FASE 7. E o 163 trouxe a 52ª, a A8 (FASE 6-bis);
- o plano, aplicado do zero numa cópia limpa, dá os 29 arquivos iguais ao fim do ensaio, byte a byte;
- a guarda do diff (FASE 7, passo 4) mostrou só os 29 arquivos do mapa abaixo: `lib/steps.ts` muda só na
  palavra `export`, e o motor, a fila, o gerador de bônus, o `/publicar`, o bucket, os `scripts` e o `package`
  ficam com 0 diferença.

**O que o ensaio achou, já resolvido neste plano:**
1. **A troca do código vai a `api.instagram.com` sem desvio de teste** (`exchangeCodeForShortToken`,
   `lib/ig.ts:199-220` em `ce83e8a`). O Graph tem o `IG_GRAPH_BASE`, mas essa troca não. Nenhum teste de hoje
   passava pelo caminho de sucesso da volta. O teste da volta (FASE 4) intercepta o `fetch` só dentro do
   arquivo: ele deixa passar essa troca e o loopback, e RECUSA qualquer outro endereço. O código da produção
   não muda. De quebra, a volta de hoje ganha o primeiro teste do caminho de sucesso.
2. **A conta gravada na mesma transação da reivindicação** pede o `upsertAccount` com a transação: ele ganha
   um segundo parâmetro, `executor`, que por padrão é o pool (FASE 2). Copiar o SQL dele seria uma segunda
   regra para a mesma linha.
3. **O `semSegredo` passa a ser exportado** de `lib/steps.ts` (só a palavra `export`, FASE 1), como a
   auditoria pediu: sem cópia que diverge. Os testes de hoje dele (`tests/steps.test.ts` e
   `tests/labels.test.ts`) continuam passando.
4. **A lista da etapa 6 precisa do arroba da conta que entrou:** o `listarConvites` faz o `left join` com
   `accounts` (FASE 6).
5. **O erro de uma tentativa ANTES da que deu certo não vira aviso no convite usado:** só a assinatura dos
   webhooks que falhou depois da conexão, reconhecida pelo `PREFIXO_DA_ASSINATURA` (FASE 6).
6. **A rota aberta nova entra na lista exata das rotas públicas** de `tests/sessao-nas-actions.test.ts`
   (FASE 3). É o teste que cobra a sessão de toda rota fora das públicas.
7. **A casca do painel (`app/app-shell.tsx`) desenha o menu e o seletor de conta** em toda página que não está
   na lista dela de páginas públicas. O `/convite` entra nessa lista também, e não só no porteiro (FASE 3).
8. **O `react-hooks/purity` do lint recusa o `Date.now()` no corpo de um Server Component.** As duas páginas
   que leem o relógio silenciam como o dono silencia, com o motivo por extenso (`app/page.tsx:322-333`).
9. **A soma da 021 ignora o fim de linha e os comentários** (`comandosDoArquivo` e `somaDoTexto`,
   `scripts/migracoes.mjs:62-85`). A aplicação à mão a partir do Windows registra a mesma soma que o deploy
   confere: `8994f28aeb62`.
10. **A junção do `node_modules` quebra o build do Turbopack** ("Could not find the Next.js package"), medido
    em 03/11 na branch das fotos. A cópia usa um `npm ci` próprio (FASE 0).
11. **O `vi.mock` sobe para o topo do arquivo, antes de qualquer `const`:** as ações de mentira do teste de
    tela nascem no `vi.hoisted` (FASE 6).
12. **Uma integração de cada vez.** Duas rodadas ao mesmo tempo no mesmo container derrubam o schema uma da
    outra (medido de novo em 03/11, na branch das fotos).

**O que a execução achou (03/11), já resolvido ou anotado neste plano:**
1. **A mutação V10** (a volta do convite gravando o cookie da conta selecionada), que a spec lista e o Apêndice A
   não tinha, pedida pela auditoria na revisão do plano. Ela entrou na FASE 7, num commit de docs (`a7d6d85`).
2. **163 (ANOTAR, resolvido na FASE 6-bis):** com a instalação toda concluída, as etapas da Configuração nascem
   recolhidas no `<details>` "Instalação" (`app/setup/page.tsx:227`, medido em `a7d6d85`), e o bloco do convite,
   na etapa 6, ficava escondido lá dentro. A prova do preview tropeçou nisso (o campo "Para quem" existia, mas
   escondido). O Eduardo escolheu pela caixa "Tirar para fora, à vista": o bloco vai para a seção "Convidar um
   cliente", antes do "Instalação".
3. **164 (ANOTAR):** medido no preview, o `Cache-Control` da PÁGINA do convite é o do Next para página dinâmica
   ("private, no-cache, no-store, max-age=0, must-revalidate", o mesmo do `/entrar`), e não o `no-store` do
   `next.config.ts`. O nosso aparece no 307 da ROTA do começo. Sem cache, a página continua: ela é
   `force-dynamic`, e o `no-store` está entre as diretivas. O `X-Robots-Tag: noindex` do preview vem também da
   Vercel (aparece no `/entrar`), e só o `curl -I` da produção prova o nosso. O `Referrer-Policy: no-referrer`
   está na página e no 307, e não no `/entrar`: é o nosso.

## Restrições globais

- **Branch:** `link-de-convite`, saída da `main` em `ce83e8a`. Nunca commitar nem empurrar na `main`: ela não
  está protegida, e um push nela dispara o deploy na Vercel. Conferir `git branch --show-current` antes de
  cada commit.
- **`git add` com caminho explícito.** Nunca `-A` nem `.`.
- **Commit no estilo do Vinícius:** uma frase dizendo o efeito, sem prefixo, o porquê no corpo, sem
  rodapé de IA. Autor: Eduardo Kobal <162614913+Eduardokobal@users.noreply.github.com>.
- **Antes de cada commit**, varrer os arquivos tocados com `node "$SCRATCH/varrer-texto.mjs" <arquivos>`.
- **O commit é um comando à parte**, depois de ler a saída dos testes.
- **Fim de linha:** os diffs deste plano estão em LF. Aplique com `git apply --ignore-whitespace`, ou converta
  antes os arquivos que a fase toca (`node "$SCRATCH/para-lf.mjs" <arquivo>`).
- **Os arquivos desta entrega são os do mapa abaixo, e mais nenhum.** Nada do motor (`lib/engine.ts`), da fila
  e do dreno (`lib/queue-drain.ts`), das automações, do gerador de bônus (`lib/bonus/`, `app/bonus/`), do
  `/publicar`, do bucket, dos `scripts` nem do `package`. Em `lib/steps.ts`, só a palavra `export`; em
  `lib/db.ts`, só a assinatura do `upsertAccount`.
- **Uma migração, a 021,** aplicada à mão na produção ANTES do push (FASE 8), com o OK do Eduardo. O build do
  merge tem de dizer "Nada a aplicar: as 22 migrações".
- **Uma rodada de integração de cada vez**, sempre com `DATABASE_URL_TESTES` apontando para o container
  (`127.0.0.1:5434`). Toda rodada tem de imprimir `[rede-global] ALVO: banco de TESTE`. Nunca rode com a
  variável vazia: ela cai na `DATABASE_URL`, que é **produção**.
- **`next build` sem as variáveis de agente:** `env -u CLAUDECODE -u AI_AGENT ...`, e `git diff AGENTS.md`
  depois.
- **Escrita em produção só com o OK do Eduardo**, a hora mandada à auditoria antes, e o "pode" dela.
- **Ao fechar cada fase**, avisar o auditor (`metodochat-74` em 03/11; o nome muda por sessão, então conferir
  no `ListAgents` e com o Eduardo) com o hash.
- **Toda linha citada (`arquivo:linha`) diz o SHA em que foi medida.**
- **Nenhuma arroba solta** em commit, PR ou mensagem do merge (achado 145): o @ de uma conta vai entre
  crases.

## Mapa dos arquivos

| arquivo | responsabilidade | fase |
|---|---|---|
| `lib/convites.ts` (novo) | as regras puras: o código, o hash, o estado, o "para quem", o motivo, o texto do erro e a linha da etapa 6 | 1 e 6 |
| `lib/steps.ts` | só o `export` do `semSegredo` | 1 |
| `tests/convites.test.ts` (novo) | as regras puras, com o relógio fixo | 1 e 6 |
| `migrations/021-convites-de-conexao.sql` (novo) | a tabela, os `check`, o índice e o RLS | 2 |
| `lib/esquema.ts` | a 021 entre as tabelas de feature (`naoObservaveis`) | 2 |
| `lib/db.ts` | o `upsertAccount` aceita a transação | 2 |
| `lib/convites-repositorio.ts` (novo) | criar, ler, listar, cancelar, anotar o erro e reivindicar com a conta | 2 e 6 |
| `testes-integracao/convites-tabela.integracao.ts` (novo) | a tabela e o repositório, no container | 2 e 6 |
| `lib/auth.ts` | o nome do cookie do convite | 3 |
| `app/api/oauth/convite/[codigo]/route.ts` (novo) | o começo pelo convite | 3 |
| `app/api/oauth/login/route.ts` | o começo de hoje apaga o cookie do convite | 3 |
| `proxy.ts` | o `/convite` entre as rotas públicas | 3 |
| `app/app-shell.tsx` | o `/convite` entre as páginas sem a casca do painel | 3 |
| `next.config.ts` | os três cabeçalhos das rotas do convite (achado 157) | 3 |
| `tests/convite-publico.test.ts` (novo) | o porteiro e os cabeçalhos | 3 |
| `tests/sessao-nas-actions.test.ts` | a rota aberta nova na lista das públicas | 3 |
| `testes-dom/convite-sem-menu.dom.tsx` (novo) | a página do convite sem menu e sem conta | 3 |
| `testes-integracao/convite.integracao.ts` (novo) | o começo, o começo de hoje e as ações da etapa 6 | 3 e 6 |
| `app/api/oauth/callback/convite.ts` (novo) | a volta pelo convite | 4 e 6 |
| `app/api/oauth/callback/route.ts` | o desvio para a volta do convite | 4 |
| `testes-integracao/convite-volta.integracao.ts` (novo) | a volta com e sem o convite, com a Meta falsa | 4 |
| `app/convite/[codigo]/page.tsx`, `app/convite/pronto/page.tsx`, `app/convite/erro/page.tsx` (novos) | as três páginas abertas | 5 |
| `testes-integracao/convite-paginas.integracao.ts` (novo) | as três páginas, em HTML | 5 |
| `app/setup/actions.ts` | `gerarConvite` e `cancelarConvite` | 6 |
| `app/setup/convites.tsx` (novo) | o bloco do convite | 6 e 6-bis |
| `app/setup/page.tsx` | a lista dos convites; a seção "Convidar um cliente", fora do "Instalação" | 6 e 6-bis |
| `testes-dom/convites-no-setup.dom.tsx` (novo) | o bloco do convite | 6 |
| `tests/convite-a-vista.test.ts` (novo) | o convite fora de qualquer `<details>` (achado 163) | 6-bis |

---

### FASE 0 — Começar da branch certa

- [ ] **Passo 1: conferir a main e a branch**

```bash
git ls-remote origin refs/heads/main
git switch link-de-convite
git log --oneline -4
```

Esperado: a `main` em `ce83e8a` (ou depois dele); a branch com o commit deste plano sobre `08fd8bf` e
`250cd6f`, que estão sobre `ce83e8a`.

- [ ] **Passo 2: o `node_modules` próprio** (o Turbopack do `verify` recusa uma junção que aponte para fora
  da cópia)

```bash
npm ci
```

- [ ] **Passo 3: o `.env.local` VAZIO** (achado 140): a integração exige o arquivo na cópia como prova, e
  ele não pode ter nada. Se já existir com conteúdo, pare e avise.

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

Esperado: 137 arquivos e 3 540 casos puros; 28 arquivos e 285 de tela; `[rede-global] ALVO: banco de TESTE`,
53 arquivos, 603 passaram e 8 pularam (medido em 03/11, das 15:30Z às 15:37Z, numa árvore igual à de
`ce83e8a` fora de `docs/`). Antes da integração, confira que nenhum outro `vitest` roda no container.

---

### FASE 1 — As regras puras do convite

**Arquivos:** `lib/convites.ts` (novo), `lib/steps.ts`, `tests/convites.test.ts` (novo).

- [ ] **Passo 1: o teste, antes do código**

Crie `tests/convites.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  FRASE_DO_LINK_QUE_NAO_VALE,
  FRASE_DO_MOTIVO,
  LIMITE_DO_ERRO,
  LIMITE_DO_PARA_QUEM,
  VALIDADE_DO_CONVITE_DIAS,
  codigoBemFormado,
  estadoDoConvite,
  hashDoCodigo,
  motivoDoErro,
  novoCodigoDeConvite,
  paraQuemDoFormulario,
  textoParaOPainel,
} from "@/lib/convites";

// O LINK DE CONVITE (docs/specs/2026-11-03-link-de-convite.md): as regras puras. O relógio é fixo,
// para a fronteira do vencimento não depender da máquina.
const AGORA = Date.UTC(2026, 10, 3, 15, 0, 0);

describe("o código do link", () => {
  it("tem 32 bytes em base64url (43 caracteres) e não se repete", () => {
    const codigos = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const c = novoCodigoDeConvite();
      expect(c).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(codigoBemFormado(c)).toBe(true);
      codigos.add(c);
    }
    expect(codigos.size).toBe(1000);
  });

  it("recusa o que não tem o formato antes de qualquer consulta", () => {
    expect(codigoBemFormado("")).toBe(false);
    expect(codigoBemFormado("a".repeat(42))).toBe(false);
    expect(codigoBemFormado("a".repeat(44))).toBe(false);
    expect(codigoBemFormado(`${"a".repeat(42)}=`)).toBe(false);
    expect(codigoBemFormado(`${"a".repeat(42)}/`)).toBe(false);
  });

  it("o banco guarda o SHA-256 em hex, o mesmo para o mesmo código, e nunca o código", () => {
    const c = novoCodigoDeConvite();
    expect(hashDoCodigo(c)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashDoCodigo(c)).toBe(hashDoCodigo(c));
    expect(hashDoCodigo(c)).not.toBe(hashDoCodigo(novoCodigoDeConvite()));
    expect(hashDoCodigo(c)).not.toContain(c);
    // O vetor fixo do SHA-256 de "abc": a função é a de sempre, e não uma variação.
    expect(hashDoCodigo("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("o estado do convite", () => {
  const base = { cancelado_em: null, usado_em: null, expira_em: new Date(AGORA + 1000) };

  it("é pendente até vencer, e vence no próprio instante do prazo", () => {
    expect(VALIDADE_DO_CONVITE_DIAS).toBe(7);
    expect(estadoDoConvite(base, AGORA)).toBe("pendente");
    expect(estadoDoConvite({ ...base, expira_em: new Date(AGORA) }, AGORA)).toBe("vencido");
    expect(estadoDoConvite({ ...base, expira_em: new Date(AGORA - 1) }, AGORA)).toBe("vencido");
    expect(estadoDoConvite({ ...base, expira_em: new Date(AGORA).toISOString() }, AGORA)).toBe("vencido");
  });

  it("o cancelado vence o usado, e o usado vence o vencido", () => {
    const t = new Date(AGORA - 5000);
    expect(estadoDoConvite({ ...base, usado_em: t }, AGORA)).toBe("usado");
    expect(estadoDoConvite({ ...base, cancelado_em: t }, AGORA)).toBe("cancelado");
    expect(estadoDoConvite({ ...base, cancelado_em: t, usado_em: t }, AGORA)).toBe("cancelado");
    expect(estadoDoConvite({ cancelado_em: null, usado_em: t, expira_em: t }, AGORA)).toBe("usado");
  });
});

describe("o \"para quem\"", () => {
  it("aceita de 1 a 60 caracteres, sem os espaços das pontas", () => {
    expect(LIMITE_DO_PARA_QUEM).toBe(60);
    expect(paraQuemDoFormulario("  Dr. Marcus  ")).toBe("Dr. Marcus");
    expect(paraQuemDoFormulario("x".repeat(60))).toBe("x".repeat(60));
    expect(paraQuemDoFormulario("ç".repeat(60))).toBe("ç".repeat(60));
  });

  it("recusa o vazio, só espaços, 61 caracteres e o que não é texto", () => {
    expect(paraQuemDoFormulario("")).toBeNull();
    expect(paraQuemDoFormulario("   ")).toBeNull();
    expect(paraQuemDoFormulario("x".repeat(61))).toBeNull();
    expect(paraQuemDoFormulario(null)).toBeNull();
    expect(paraQuemDoFormulario(42)).toBeNull();
  });

  it("conta caractere, e não pedaço de UTF-16, como o char_length do banco", () => {
    expect(paraQuemDoFormulario("😀".repeat(60))).toBe("😀".repeat(60));
    expect(paraQuemDoFormulario("😀".repeat(61))).toBeNull();
  });
});

describe("o que o cliente lê quando dá errado", () => {
  it("só os três motivos da lista viram frase, e qualquer outro vira \"falhou\"", () => {
    expect(motivoDoErro("negado")).toBe("negado");
    expect(motivoDoErro("vencido")).toBe("vencido");
    expect(motivoDoErro("falhou")).toBe("falhou");
    expect(motivoDoErro("Instagram API 400: algo")).toBe("falhou");
    expect(motivoDoErro(null)).toBe("falhou");
    expect(motivoDoErro(["negado"])).toBe("falhou");
    expect(Object.keys(FRASE_DO_MOTIVO).sort()).toEqual(["falhou", "negado", "vencido"]);
  });

  it("a página do link que não vale tem uma frase só", () => {
    expect(FRASE_DO_LINK_QUE_NAO_VALE).toBe("Este link não vale mais. Peça um novo a quem te mandou.");
  });
});

describe("o texto do erro que vai para o painel (achado 159)", () => {
  it("troca os segredos por OCULTO: a query da Meta, o code, o token e o código do convite", () => {
    const code = "AQBcodigoDaVoltaDoInstagram123";
    const token = "IGAAtokenLongoDeVerdade456";
    const codigo = novoCodigoDeConvite();
    const texto = textoParaOPainel(
      `falhou com access_token=xyz&client_secret=abc code=${code} token ${token} link ${codigo}`,
      [code, token, codigo]
    );
    expect(texto).not.toContain("xyz");
    expect(texto).not.toContain("=abc");
    expect(texto).not.toContain(code);
    expect(texto).not.toContain(token);
    expect(texto).not.toContain(codigo);
    expect(texto).toContain("access_token=OCULTO");
    expect(texto).toContain("OCULTO");
  });

  it("corta em 160 caracteres, e corta depois de trocar, para não sobrar pedaço de segredo", () => {
    expect(LIMITE_DO_ERRO).toBe(160);
    expect(textoParaOPainel("x".repeat(400), [])).toHaveLength(160);
    expect(textoParaOPainel("curto", [])).toBe("curto");
    const segredo = "S".repeat(30);
    const texto = textoParaOPainel(`${"x".repeat(150)}${segredo}`, [segredo]);
    expect(texto).not.toContain("SSS");
    expect(texto).toHaveLength(156);
  });

  it("ignora segredo vazio ou ausente", () => {
    expect(textoParaOPainel("abc", ["", null, undefined])).toBe("abc");
  });
});
```

- [ ] **Passo 2: ver o teste falhar**

```bash
npx vitest run tests/convites.test.ts
```

Esperado: `Error: Cannot find package '@/lib/convites'`, e o arquivo cai sem rodar caso nenhum.

- [ ] **Passo 3: o `export` do `semSegredo`**

Em `lib/steps.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/steps.ts b/lib/steps.ts
index da1c593..f3a8ddb 100644
--- a/lib/steps.ts
+++ b/lib/steps.ts
@@ -4947,7 +4947,7 @@ const LIMITE_DA_MENSAGEM = 300;
  * este produto põe em query string em algum caminho. O valor é substituído,
  * não removido: quem lê precisa saber que ele ESTAVA ali.
  */
-function semSegredo(texto: string): string {
+export function semSegredo(texto: string): string {
   return texto.replace(
     /(access_token|client_secret|appsecret_proof)=([^&\s"']*)/gi,
     "$1=OCULTO"
```

- [ ] **Passo 4: as regras**

Crie `lib/convites.ts`:

```ts
// O LINK DE CONVITE PARA O CLIENTE CONECTAR A PRÓPRIA CONTA (docs/specs/2026-11-03-link-de-convite.md):
// as regras puras. O código do link e o hash que o banco guarda no lugar dele, o estado de cada convite,
// o "para quem", o motivo que o cliente lê quando dá errado e o texto do erro que só o painel lê.
import { createHash, randomBytes } from "node:crypto";
import { semSegredo } from "./steps";

export const VALIDADE_DO_CONVITE_DIAS = 7;
export const LIMITE_DO_PARA_QUEM = 60;

// O MESMO CORTE DO `avisoAssinatura` da volta do Instagram (app/api/oauth/callback/route.ts): o texto é
// para o dono ler numa linha da lista, e não para arquivar o corpo da Meta.
export const LIMITE_DO_ERRO = 160;

// 32 bytes em base64url são 43 caracteres, sem `=`. Um código fora desse formato nem chega ao banco.
const CODIGO = /^[A-Za-z0-9_-]{43}$/;

export function novoCodigoDeConvite(): string {
  return randomBytes(32).toString("base64url");
}

export function codigoBemFormado(codigo: string): boolean {
  return CODIGO.test(codigo);
}

// O BANCO GUARDA SÓ O HASH: quem lê a tabela não ganha um link que ainda vale. Por isso o link não pode
// ser mostrado de novo depois de gerado.
export function hashDoCodigo(codigo: string): string {
  return createHash("sha256").update(codigo).digest("hex");
}

export type EstadoDoConvite = "pendente" | "usado" | "vencido" | "cancelado";

type DatasDoConvite = {
  cancelado_em: Date | string | null;
  usado_em: Date | string | null;
  expira_em: Date | string;
};

/** Nesta ordem: o cancelado vence o usado, o usado vence o vencido, e o prazo vence no próprio instante. */
export function estadoDoConvite(c: DatasDoConvite, agoraMs: number): EstadoDoConvite {
  if (c.cancelado_em) return "cancelado";
  if (c.usado_em) return "usado";
  if (new Date(c.expira_em).getTime() <= agoraMs) return "vencido";
  return "pendente";
}

// CONTA CARACTERE, E NÃO PEDAÇO DE UTF-16: é o que o `char_length` da restrição da tabela conta, e um
// emoji não pode passar aqui e ser recusado lá.
export function paraQuemDoFormulario(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const texto = valor.trim();
  const tamanho = Array.from(texto).length;
  return tamanho >= 1 && tamanho <= LIMITE_DO_PARA_QUEM ? texto : null;
}

// O MOTIVO VEM DE UMA LISTA FECHADA. A página do cliente é aberta, e nada do texto da Meta chega até ela.
export const MOTIVOS_DO_ERRO = ["negado", "vencido", "falhou"] as const;
export type MotivoDoErro = (typeof MOTIVOS_DO_ERRO)[number];

export function motivoDoErro(valor: unknown): MotivoDoErro {
  return (MOTIVOS_DO_ERRO as readonly unknown[]).includes(valor) ? (valor as MotivoDoErro) : "falhou";
}

export const FRASE_DO_MOTIVO: Record<MotivoDoErro, string> = {
  negado: "A autorização foi recusada no Instagram, e a conta não foi conectada.",
  vencido: "Este link não vale mais.",
  falhou: "Não deu certo conectar a conta.",
};

export const PECA_UM_NOVO_LINK = "Se precisar, peça um novo link a quem te mandou.";

// A MESMA FRASE PARA O VENCIDO, O USADO, O CANCELADO E O QUE NÃO EXISTE: a página não diz qual é o caso.
export const FRASE_DO_LINK_QUE_NAO_VALE = "Este link não vale mais. Peça um novo a quem te mandou.";

export const FRASE_DO_PRONTO = "Pronto, sua conta do Instagram foi conectada. Pode fechar esta página.";

/**
 * O texto do erro que vai para o `ultimo_erro` do convite (achado 159). Passa pela limpeza de sempre
 * (`semSegredo`, a query da Meta), troca por OCULTO cada segredo da volta (o `code`, o token e o código
 * do convite) e só depois corta, para o corte não deixar um pedaço de segredo no fim.
 */
export function textoParaOPainel(texto: string, segredos: (string | null | undefined)[]): string {
  let limpo = semSegredo(texto);
  for (const segredo of segredos) if (segredo) limpo = limpo.split(segredo).join("OCULTO");
  return limpo.length > LIMITE_DO_ERRO ? limpo.slice(0, LIMITE_DO_ERRO) : limpo;
}
```

- [ ] **Passo 5: ver passar, com os testes do `semSegredo` de hoje**

```bash
npx vitest run tests/convites.test.ts tests/steps.test.ts tests/labels.test.ts
npx eslint lib/convites.ts tests/convites.test.ts lib/steps.ts
npx tsc --noEmit
node "$SCRATCH/varrer-texto.mjs" lib/convites.ts tests/convites.test.ts lib/steps.ts
```

Esperado: 3 arquivos e 423 casos passando; lint e `tsc` limpos; os três arquivos limpos.

- [ ] **Passo 6: o commit**

A mensagem do commit, gravada em `$SCRATCH/msg-conv-f1.txt`:

```text
As regras do link de convite: o código, o hash, o estado e o texto do erro

O código do link tem 32 bytes em base64url, e o banco guarda só o SHA-256
dele. O estado do convite sai de uma ordem fixa (cancelado, usado, vencido e
pendente), o "para quem" conta caractere como o banco conta, o cliente só lê
um de três motivos, e o texto do erro que vai para o painel passa pela limpeza
do semSegredo, troca os segredos da volta por OCULTO e é cortado em 160. O
semSegredo passa a ser exportado de lib/steps.ts, sem cópia.
```

```bash
git add lib/convites.ts tests/convites.test.ts lib/steps.ts
git commit -F "$SCRATCH/msg-conv-f1.txt"
```


---

### FASE 2 — A tabela dos convites e o repositório

**Arquivos:** `migrations/021-convites-de-conexao.sql` (novo), `lib/esquema.ts`, `lib/db.ts`,
`lib/convites-repositorio.ts` (novo), `testes-integracao/convites-tabela.integracao.ts` (novo).

- [ ] **Passo 1: o teste, antes do código**

Crie `testes-integracao/convites-tabela.integracao.ts`:

```ts
// A TABELA DOS CONVITES DE CONEXÃO (a 021, docs/specs/2026-11-03-link-de-convite.md) e o repositório dela
// (lib/convites-repositorio.ts), conferidos no banco de verdade (o container).
//
// Como a 013, a 014 e a 018, a 021 está em `naoObservaveis` de lib/esquema.ts (a partida do painel não
// depende dela), e é este arquivo que a confere. A peça central é a reivindicação: o convite só é usado na
// mesma transação que grava a conta, e uma conta que falha ao gravar deixa o convite como estava.
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { bancoDescartavel } from "./harness";

type ModuloRepositorio = typeof import("@/lib/convites-repositorio");

const banco = bancoDescartavel();

/** A ordem das colunas é a da migração; o código lê por nome, e a lista inteira é o contrato. */
const COLUNAS = [
  "id",
  "codigo_hash",
  "para_quem",
  "criado_em",
  "expira_em",
  "cancelado_em",
  "usado_em",
  "conta_conectada",
  "ultimo_erro",
  "ultimo_erro_em",
];

const CONTA = "17800000000021001";
const conta = (token: string) => ({
  ig_user_id: CONTA,
  username: "conta_do_convite",
  name: "Conta do convite",
  profile_picture_url: null,
  access_token: token,
  token_expires_at: new Date(Date.now() + 60 * 86_400_000),
});

let repo: ModuloRepositorio;

beforeEach(async () => {
  repo ??= await import("@/lib/convites-repositorio");
  await banco.db().sql().query(`delete from convites_de_conexao`);
  await banco.db().sql().query(`delete from accounts where ig_user_id = $1`, [CONTA]);
});

const linhaDo = async (id: string) =>
  ((await banco.db().sql().query(`select * from convites_de_conexao where id = $1`, [id])) as Record<string, unknown>[])[0];

const tokenDaConta = async () =>
  ((await banco.db().sql().query(`select access_token from accounts where ig_user_id = $1`, [CONTA])) as {
    access_token: string;
  }[])[0]?.access_token ?? null;

describe("a tabela convites_de_conexao", () => {
  it("nasce da 021 com as colunas que o código lê, e com o RLS ligado", async () => {
    const colunas = (await banco
      .db()
      .sql()
      .query(
        `select column_name from information_schema.columns
          where table_schema = current_schema() and table_name = 'convites_de_conexao'
          order by ordinal_position`
      )) as { column_name: string }[];
    expect(colunas.map((c) => c.column_name)).toEqual(COLUNAS);
    const [rls] = (await banco
      .db()
      .sql()
      .query(
        `select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = current_schema() and c.relname = 'convites_de_conexao'`
      )) as { relrowsecurity: boolean }[];
    expect(rls.relrowsecurity).toBe(true);
  });

  it("recusa o hash fora do formato, o \"para quem\" de 61 caracteres e o uso sem a conta", async () => {
    const inserir = (hash: string, paraQuem: string) =>
      banco
        .db()
        .sql()
        .query(`insert into convites_de_conexao (codigo_hash, para_quem, expira_em) values ($1, $2, now())`, [
          hash,
          paraQuem,
        ]);
    await expect(inserir("x".repeat(64), "Dr. Marcus")).rejects.toThrow(/codigo_hash_check/);
    await expect(inserir("a".repeat(64), "x".repeat(61))).rejects.toThrow(/para_quem_check/);
    await expect(inserir("a".repeat(64), "")).rejects.toThrow(/para_quem_check/);
    await inserir("a".repeat(64), "😀".repeat(60));
    await expect(inserir("a".repeat(64), "outro")).rejects.toThrow(/codigo_hash_key/);
    await expect(
      banco.db().sql().query(`update convites_de_conexao set usado_em = now() where codigo_hash = $1`, ["a".repeat(64)])
    ).rejects.toThrow(/usado_check/);
  });
});

describe("o repositório dos convites", () => {
  it("criar grava o hash do código, nunca o código, com 7 dias de prazo", async () => {
    const { id, codigo } = await repo.criarConvite("Dr. Marcus");
    const linha = await linhaDo(id);
    expect(linha.codigo_hash).toBe(createHash("sha256").update(codigo).digest("hex"));
    expect(Object.values(linha).some((v) => typeof v === "string" && v.includes(codigo))).toBe(false);
    expect(linha.para_quem).toBe("Dr. Marcus");
    expect((linha.expira_em as Date).getTime() - (linha.criado_em as Date).getTime()).toBe(7 * 86_400_000);
    expect(linha).toMatchObject({ cancelado_em: null, usado_em: null, conta_conectada: null, ultimo_erro: null });
  });

  it("acha pelo código e pelo id, e devolve null para o que não existe ou não tem o formato", async () => {
    const { id, codigo } = await repo.criarConvite("Dr. Marcus");
    expect((await repo.conviteDoCodigo(codigo))?.id).toBe(id);
    expect((await repo.conviteDoId(id))?.para_quem).toBe("Dr. Marcus");
    expect(await repo.conviteDoCodigo("a".repeat(43))).toBeNull();
    expect(await repo.conviteDoCodigo("curto")).toBeNull();
    expect(await repo.conviteDoId("00000000-0000-4000-8000-000000000000")).toBeNull();
    expect(await repo.conviteDoId("não é uuid")).toBeNull();
  });

  it("a lista vem do mais novo para o mais velho, até 20", async () => {
    for (let i = 0; i < 22; i++) await repo.criarConvite(`cliente ${i}`);
    const lista = await repo.listarConvites();
    expect(lista).toHaveLength(20);
    expect(lista[0].para_quem).toBe("cliente 21");
    expect(lista[19].para_quem).toBe("cliente 2");
    expect(Object.keys(lista[0])).not.toContain("codigo_hash");
  });

  it("cancelar vale só para o pendente, uma vez", async () => {
    const { id } = await repo.criarConvite("Dr. Marcus");
    expect(await repo.cancelarConvite(id)).toBe(true);
    expect((await linhaDo(id)).cancelado_em).toBeInstanceOf(Date);
    expect(await repo.cancelarConvite(id)).toBe(false);
    const usado = await repo.criarConvite("outro");
    expect(await repo.reivindicarEGravarConta(usado.id, conta("token-1"))).toBe(true);
    expect(await repo.cancelarConvite(usado.id)).toBe(false);
  });

  it("reivindicar usa o convite e grava a conta, na mesma transação, uma vez só", async () => {
    const { id } = await repo.criarConvite("Dr. Marcus");
    expect(await repo.reivindicarEGravarConta(id, conta("token-1"))).toBe(true);
    expect(await tokenDaConta()).toBe("token-1");
    const linha = await linhaDo(id);
    expect(linha.usado_em).toBeInstanceOf(Date);
    expect(linha.conta_conectada).toBe(CONTA);
    // A segunda aba com o mesmo link: não reivindica, e não regrava a conta.
    expect(await repo.reivindicarEGravarConta(id, conta("token-2"))).toBe(false);
    expect(await tokenDaConta()).toBe("token-1");
  });

  it("não reivindica o cancelado nem o vencido, e não grava a conta", async () => {
    const cancelado = await repo.criarConvite("cancelado");
    await repo.cancelarConvite(cancelado.id);
    expect(await repo.reivindicarEGravarConta(cancelado.id, conta("token-1"))).toBe(false);
    const vencido = await repo.criarConvite("vencido");
    await banco
      .db()
      .sql()
      .query(`update convites_de_conexao set expira_em = now() - interval '1 second' where id = $1`, [vencido.id]);
    expect(await repo.reivindicarEGravarConta(vencido.id, conta("token-1"))).toBe(false);
    expect(await tokenDaConta()).toBeNull();
  });

  it("se a conta falha ao gravar, o convite volta a ficar pendente", async () => {
    const { id } = await repo.criarConvite("Dr. Marcus");
    // `access_token` é not null na tabela accounts: o upsert falha DEPOIS da reivindicação.
    const quebrada = { ...conta("x"), access_token: null as unknown as string };
    await expect(repo.reivindicarEGravarConta(id, quebrada)).rejects.toThrow();
    const linha = await linhaDo(id);
    expect(linha.usado_em).toBeNull();
    expect(linha.conta_conectada).toBeNull();
    expect(await repo.reivindicarEGravarConta(id, conta("token-1"))).toBe(true);
  });

  it("o erro anotado vai só para o convite no estado pedido", async () => {
    const pendente = await repo.criarConvite("pendente");
    await repo.anotarErroDoConvite(pendente.id, "a Meta recusou", "pendente");
    expect(await linhaDo(pendente.id)).toMatchObject({ ultimo_erro: "a Meta recusou" });
    expect((await linhaDo(pendente.id)).ultimo_erro_em).toBeInstanceOf(Date);
    await repo.anotarErroDoConvite(pendente.id, "não entra", "usado");
    expect((await linhaDo(pendente.id)).ultimo_erro).toBe("a Meta recusou");

    const usado = await repo.criarConvite("usado");
    await repo.reivindicarEGravarConta(usado.id, conta("token-1"));
    await repo.anotarErroDoConvite(usado.id, "não entra", "pendente");
    expect((await linhaDo(usado.id)).ultimo_erro).toBeNull();
    await repo.anotarErroDoConvite(usado.id, "conectada, mas a assinatura dos webhooks falhou: x", "usado");
    expect((await linhaDo(usado.id)).ultimo_erro).toBe("conectada, mas a assinatura dos webhooks falhou: x");
  });
});
```

- [ ] **Passo 2: ver o teste falhar**

```bash
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/convites-tabela.integracao.ts
```

Esperado: `[rede-global] ALVO: banco de TESTE`, os 10 casos caindo e `Error: Cannot find package
'@/lib/convites-repositorio'`.

- [ ] **Passo 3: a migração 021**

Crie `migrations/021-convites-de-conexao.sql`:

```sql
-- OS CONVITES DE CONEXÃO: o link que o painel gera para o cliente conectar a própria conta do Instagram,
-- sem a senha do painel e sem passar a senha do Instagram a ninguém. O desenho inteiro está em
-- docs/specs/2026-11-03-link-de-convite.md.
--
-- Uma linha é um convite: o hash do código do link (o código em si não é guardado, e por isso o link não
-- pode ser mostrado de novo), o nome que o dono deu, o prazo de 7 dias, o cancelamento, o uso com a conta
-- que entrou, e o último erro, que só o painel mostra.
--
-- O USO É UMA ESCRITA SÓ: a volta do Instagram reivindica o convite com `usado_em is null and
-- cancelado_em is null and expira_em > now()` na mesma transação que grava a conta. Duas abas com o mesmo
-- link não conectam duas vezes.
--
-- TABELA DE FEATURE, como a 013, a 014 e a 018: entra em `naoObservaveis` de lib/esquema.ts, e quem
-- confere as colunas é testes-integracao/convites-tabela.integracao.ts.
--
-- O RLS É LIGADO AQUI: a 019 só alcançou as tabelas que já existiam, e
-- testes-integracao/rls-nas-tabelas.integracao.ts cobra o RLS de toda tabela do schema. A permissão da
-- API pública não precisa de linha: os privilégios padrão que a 020 mudou já fazem a tabela nascer sem
-- nada para `anon` e `authenticated`. Não há função, então o achado 130 não se aplica.
--
-- IDEMPOTENTE, como toda migração desta pasta: `if not exists` na tabela e no índice, e ligar o RLS de
-- novo não muda nada.
create table if not exists convites_de_conexao (
  id uuid primary key default gen_random_uuid(),
  codigo_hash text not null
    constraint convites_de_conexao_codigo_hash_check
      check (codigo_hash ~ '^[0-9a-f]{64}$'),
  para_quem text not null
    constraint convites_de_conexao_para_quem_check
      check (char_length(para_quem) between 1 and 60),
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  cancelado_em timestamptz,
  usado_em timestamptz,
  conta_conectada text,
  ultimo_erro text
    constraint convites_de_conexao_ultimo_erro_check
      check (char_length(ultimo_erro) between 1 and 160),
  ultimo_erro_em timestamptz,
  constraint convites_de_conexao_codigo_hash_key unique (codigo_hash),
  constraint convites_de_conexao_usado_check
    check ((usado_em is null) = (conta_conectada is null)),
  constraint convites_de_conexao_erro_check
    check ((ultimo_erro is null) = (ultimo_erro_em is null))
);

-- A lista da etapa 6 lê os mais recentes.
create index if not exists convites_de_conexao_criado_em_idx
  on convites_de_conexao (criado_em desc);

alter table convites_de_conexao enable row level security;
```

A soma dela, para conferir com o registro da produção na FASE 8:

```bash
node --input-type=module -e 'import { readFileSync } from "node:fs"; const m = await import("./scripts/migracoes.mjs"); console.log(m.somaDoTexto(m.comandosDoArquivo(readFileSync("migrations/021-convites-de-conexao.sql", "utf8"))).slice(0, 12));'
```

Esperado: `8994f28aeb62`.

- [ ] **Passo 4: a 021 entre as tabelas de feature**

Em `lib/esquema.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/esquema.ts b/lib/esquema.ts
index d2669cb..81a3630 100644
--- a/lib/esquema.ts
+++ b/lib/esquema.ts
@@ -289,6 +289,15 @@ const MARCA_DAGUA = {
       porque:
         "revoga permissões de papéis do Supabase, que presença de coluna não vê; a partida do painel não depende dela",
     },
+    {
+      de: "021-convites-de-conexao.sql",
+      // A QUARTA TABELA DE FEATURE, pelo mesmo motivo da 013, da 014 e da 018: `convites_de_conexao` é do
+      // link de convite (app/convite/ e app/api/oauth/convite/), que só ele lê, e ela não pode impedir o
+      // painel inteiro de subir. Quem confere as colunas é testes-integracao/convites-tabela.integracao.ts.
+      // Decidido pelo Eduardo em 03/11/2026 (docs/specs/2026-11-03-link-de-convite.md).
+      porque:
+        "tabela de FEATURE (convites_de_conexao): a partida do painel não depende dela, de propósito",
+    },
   ],
   // A migração que cria as oito tabelas de `tabelas`, acima.
   base: "000-esquema-base.sql",
```

- [ ] **Passo 5: o `upsertAccount` com a transação**

Em `lib/db.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/db.ts b/lib/db.ts
index 70bf6cb..b68a713 100644
--- a/lib/db.ts
+++ b/lib/db.ts
@@ -424,15 +424,20 @@ export async function getAccount(igUserId: string): Promise<Account | undefined>
   return rows[0];
 }
 
-export async function upsertAccount(a: {
-  ig_user_id: string;
-  username: string | null;
-  name: string | null;
-  profile_picture_url: string | null;
-  access_token: string;
-  token_expires_at: Date | null;
-}): Promise<void> {
-  await sql().query(
+// O SEGUNDO PARÂMETRO É A TRANSAÇÃO, quando há uma: a volta do link de convite grava a conta na mesma
+// transação que reivindica o convite (lib/convites-repositorio.ts). Sem ele, é o pool, como sempre foi.
+export async function upsertAccount(
+  a: {
+    ig_user_id: string;
+    username: string | null;
+    name: string | null;
+    profile_picture_url: string | null;
+    access_token: string;
+    token_expires_at: Date | null;
+  },
+  executor: SqlTx = sql()
+): Promise<void> {
+  await executor.query(
     `insert into accounts (ig_user_id, username, name, profile_picture_url,
                            access_token, token_expires_at, connected_at)
      values ($1, $2, $3, $4, $5, $6, now())
```

- [ ] **Passo 6: o repositório**

Crie `lib/convites-repositorio.ts`:

```ts
import "server-only";
import { sql, upsertAccount } from "./db";
import { VALIDADE_DO_CONVITE_DIAS, codigoBemFormado, hashDoCodigo, novoCodigoDeConvite } from "./convites";

// OS CONVITES DE CONEXÃO NO BANCO (a 021, docs/specs/2026-11-03-link-de-convite.md). O relógio é o do
// banco, como no resto deste projeto: o prazo nasce de `now()`, e a reivindicação confere `expira_em >
// now()`.

/** O convite como o painel e as rotas o leem. O `codigo_hash` nunca sai daqui. */
export type Convite = {
  id: string;
  para_quem: string;
  criado_em: Date;
  expira_em: Date;
  cancelado_em: Date | null;
  usado_em: Date | null;
  conta_conectada: string | null;
  ultimo_erro: string | null;
  ultimo_erro_em: Date | null;
};

const COLUNAS =
  "id, para_quem, criado_em, expira_em, cancelado_em, usado_em, conta_conectada, ultimo_erro, ultimo_erro_em";

// O id chega da volta do Instagram num cookie, e um valor torto não pode virar erro de banco.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Grava o hash de um código novo e devolve o código, que só existe nesta resposta. */
export async function criarConvite(paraQuem: string): Promise<{ id: string; codigo: string }> {
  const codigo = novoCodigoDeConvite();
  const [linha] = (await sql().query(
    `insert into convites_de_conexao (codigo_hash, para_quem, expira_em)
     values ($1, $2, now() + make_interval(days => $3))
     returning id`,
    [hashDoCodigo(codigo), paraQuem, VALIDADE_DO_CONVITE_DIAS]
  )) as { id: string }[];
  return { id: linha.id, codigo };
}

export async function conviteDoCodigo(codigo: string): Promise<Convite | null> {
  if (!codigoBemFormado(codigo)) return null;
  const [linha] = (await sql().query(`select ${COLUNAS} from convites_de_conexao where codigo_hash = $1`, [
    hashDoCodigo(codigo),
  ])) as Convite[];
  return linha ?? null;
}

export async function conviteDoId(id: string): Promise<Convite | null> {
  if (!UUID.test(id)) return null;
  const [linha] = (await sql().query(`select ${COLUNAS} from convites_de_conexao where id = $1`, [id])) as Convite[];
  return linha ?? null;
}

/** Os 20 mais recentes, para a lista da etapa 6. */
export async function listarConvites(): Promise<Convite[]> {
  return (await sql().query(
    `select ${COLUNAS} from convites_de_conexao order by criado_em desc, id desc limit 20`
  )) as Convite[];
}

/** Só o pendente é cancelado. Devolve se cancelou. */
export async function cancelarConvite(id: string): Promise<boolean> {
  if (!UUID.test(id)) return false;
  const linhas = await sql().query(
    `update convites_de_conexao set cancelado_em = now()
      where id = $1 and usado_em is null and cancelado_em is null
      returning id`,
    [id]
  );
  return linhas.length > 0;
}

/**
 * Anota o erro para o painel. "pendente" é a tentativa que falhou antes de reivindicar; "usado" é a
 * assinatura dos webhooks que falhou depois da conexão (achado 158). O texto já chega limpo e cortado
 * (`textoParaOPainel`).
 */
export async function anotarErroDoConvite(id: string, texto: string, estado: "pendente" | "usado"): Promise<void> {
  if (!UUID.test(id)) return;
  const condicao = estado === "pendente" ? "usado_em is null and cancelado_em is null" : "usado_em is not null";
  await sql().query(
    `update convites_de_conexao set ultimo_erro = $2, ultimo_erro_em = now() where id = $1 and ${condicao}`,
    [id, texto]
  );
}

/**
 * O USO DO CONVITE E A CONTA, NA MESMA TRANSAÇÃO. A reivindicação só volta a linha se o convite ainda
 * estiver pendente; sem ela, a conta não é gravada. Se a conta falhar ao gravar, a transação desfaz a
 * reivindicação, e o convite continua valendo. Devolve se conectou.
 */
export async function reivindicarEGravarConta(id: string, conta: Parameters<typeof upsertAccount>[0]): Promise<boolean> {
  if (!UUID.test(id)) return false;
  return sql().begin(async (tx) => {
    const reivindicado = await tx.query(
      `update convites_de_conexao set usado_em = now(), conta_conectada = $2
        where id = $1 and usado_em is null and cancelado_em is null and expira_em > now()
        returning id`,
      [id, conta.ig_user_id]
    );
    if (reivindicado.length === 0) return false;
    await upsertAccount(conta, tx);
    return true;
  });
}
```

- [ ] **Passo 7: ver passar, com os testes do esquema e do RLS**

```bash
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/convites-tabela.integracao.ts testes-integracao/rls-nas-tabelas.integracao.ts testes-integracao/esquema-de-partida.integracao.ts testes-integracao/registro-de-migracoes.integracao.ts testes-integracao/sem-permissao-publica.integracao.ts
npx vitest run
npx eslint lib/convites-repositorio.ts lib/db.ts lib/esquema.ts testes-integracao/convites-tabela.integracao.ts
npx tsc --noEmit
node "$SCRATCH/varrer-texto.mjs" lib/convites-repositorio.ts lib/db.ts lib/esquema.ts migrations/021-convites-de-conexao.sql testes-integracao/convites-tabela.integracao.ts
```

Esperado: `ALVO: banco de TESTE`, 5 arquivos e 33 casos de integração passando; a suíte pura inteira com 138
arquivos e 3 553 casos; lint e `tsc` limpos; os cinco arquivos limpos.

- [ ] **Passo 8: o commit**

A mensagem do commit, gravada em `$SCRATCH/msg-conv-f2.txt`:

```text
A tabela dos convites de conexão, com a reivindicação e a conta na mesma transação

A 021 cria convites_de_conexao com o hash do código, o "para quem", o prazo,
o cancelamento, o uso com a conta que entrou e o último erro, e liga o RLS
nela, porque a 019 só alcançou as tabelas que já existiam. Ela entra como
tabela de feature na conferência de partida. O repositório reivindica o
convite e grava a conta numa transação só: sem a linha voltando, a conta não é
gravada, e uma conta que falha ao gravar devolve o convite. Para isso, o
upsertAccount aceita a transação como segundo parâmetro.
```

```bash
git add migrations/021-convites-de-conexao.sql lib/esquema.ts lib/db.ts lib/convites-repositorio.ts testes-integracao/convites-tabela.integracao.ts
git commit -F "$SCRATCH/msg-conv-f2.txt"
```


---

### FASE 3 — O começo pelo convite, as rotas públicas e os cabeçalhos

**Arquivos:** `lib/auth.ts`, `app/api/oauth/convite/[codigo]/route.ts` (novo), `app/api/oauth/login/route.ts`,
`proxy.ts`, `app/app-shell.tsx`, `next.config.ts`, `tests/convite-publico.test.ts` (novo),
`tests/sessao-nas-actions.test.ts`, `testes-dom/convite-sem-menu.dom.tsx` (novo),
`testes-integracao/convite.integracao.ts` (novo).

- [ ] **Passo 1: os testes, antes do código**

Crie `tests/convite-publico.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import nextConfig from "@/next.config";
import { proxy } from "@/proxy";

// O LINK DE CONVITE É ABERTO (docs/specs/2026-11-03-link-de-convite.md): quem o abre é o cliente, sem a
// senha do painel. Este arquivo confere as duas portas que deixam ele passar e os cabeçalhos que fecham o
// código do link (achado 157).

const passa = (caminho: string) => proxy(new NextRequest(`https://painel.exemplo.com.br${caminho}`));

describe("o porteiro do painel e o convite", () => {
  it.each(["/convite/abc", "/convite/pronto", "/convite/erro", "/api/oauth/convite/abc"])(
    "%s passa sem a sessão",
    (caminho) => {
      expect(passa(caminho).headers.get("location")).toBeNull();
    }
  );

  it.each(["/convites", "/convite-x", "/setup"])("%s continua pedindo a sessão", (caminho) => {
    expect(new URL(passa(caminho).headers.get("location") ?? "").pathname).toBe("/entrar");
  });
});

describe("os cabeçalhos das rotas do convite (achado 157)", () => {
  const FECHADO = [
    { key: "Referrer-Policy", value: "no-referrer" },
    { key: "Cache-Control", value: "no-store" },
    { key: "X-Robots-Tag", value: "noindex" },
  ];

  it("a página e o começo levam os três, e nenhuma outra rota leva cabeçalho do next.config", async () => {
    const regras = (await nextConfig.headers?.()) ?? [];
    expect(regras).toEqual([
      { source: "/convite/:path*", headers: FECHADO },
      { source: "/api/oauth/convite/:path*", headers: FECHADO },
    ]);
  });
});
```

Em `tests/sessao-nas-actions.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/sessao-nas-actions.test.ts b/tests/sessao-nas-actions.test.ts
index 4fcb46d..0469de7 100644
--- a/tests/sessao-nas-actions.test.ts
+++ b/tests/sessao-nas-actions.test.ts
@@ -263,6 +263,7 @@ describe("toda rota fora das públicas confere a sessão antes de qualquer traba
     expect(publicas).toEqual([
       "app/api/cron/daily/route.ts",
       "app/api/oauth/callback/route.ts",
+      "app/api/oauth/convite/[codigo]/route.ts",
       "app/api/oauth/login/route.ts",
       "app/api/queue/tick/route.ts",
       "app/api/webhook/route.ts",
```

Crie `testes-dom/convite-sem-menu.dom.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

let caminho = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => caminho,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/app/publicar/progresso", () => ({ default: () => null }));

import AppShell from "@/app/app-shell";

// A PÁGINA DO CONVITE NÃO TEM O MENU DO PAINEL (docs/specs/2026-11-03-link-de-convite.md): quem a abre é
// o cliente, e ela não mostra nada do painel, nem as contas. O layout raiz já só lista as contas com a
// sessão; este caso confere a casca, que desenha o menu e o seletor de conta.
const CONTAS = [{ ig_user_id: "1", username: "conta_do_painel", profile_picture_url: null }];

function desenhar(rota: string) {
  caminho = rota;
  return render(
    <AppShell accounts={CONTAS} selectedId="1">
      <p>o conteúdo da página</p>
    </AppShell>
  );
}

describe("a casca do painel na página do convite", () => {
  it.each(["/convite/abc", "/convite/pronto", "/convite/erro"])("%s não tem menu nem conta", (rota) => {
    desenhar(rota);
    expect(screen.getByText("o conteúdo da página")).toBeTruthy();
    expect(screen.queryByText("Conversas")).toBeNull();
    expect(screen.queryByText(/conta_do_painel/)).toBeNull();
  });

  it("a configuração, para comparar, tem o menu", () => {
    desenhar("/setup");
    expect(screen.getAllByText("Conversas").length).toBeGreaterThan(0);
  });
});
```

Crie `testes-integracao/convite.integracao.ts`:

```ts
// O LINK DE CONVITE DE PONTA A PONTA (docs/specs/2026-11-03-link-de-convite.md): o começo pelo convite
// (`/api/oauth/convite/[codigo]`), a volta do Instagram com o cookie do convite e as actions do painel, contra
// o banco descartável.
//
// AS ROTAS SÃO CHAMADAS COMO A VERCEL AS CHAMA: o handler de verdade, com um `NextRequest`. A sessão, quando
// há, é a do login de verdade (`cabecalhoDaSessaoDeTeste`, ./semear-requisicao.ts). Valores inventados:
// nenhuma credencial de verdade entra em teste.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bancoDescartavel } from "./harness";
import { cabecalhoDaSessaoDeTeste } from "./semear-requisicao";

type ModuloComeco = typeof import("@/app/api/oauth/convite/[codigo]/route");
type ModuloLogin = typeof import("@/app/api/oauth/login/route");
type ModuloRepositorio = typeof import("@/lib/convites-repositorio");

const banco = bancoDescartavel();

const APP_ID = "1234567890123456";
const APP_URL = "https://painel.exemplo.com.br";
const COOKIE_DO_STATE = "metodochat_oauth_state";
const COOKIE_DO_CONVITE = "metodochat_oauth_convite";

let comeco: ModuloComeco;
let login: ModuloLogin;
let repo: ModuloRepositorio;
let Pedido: typeof import("next/server").NextRequest;

beforeAll(async () => {
  comeco = await import("@/app/api/oauth/convite/[codigo]/route");
  login = await import("@/app/api/oauth/login/route");
  repo = await import("@/lib/convites-repositorio");
  Pedido = (await import("next/server")).NextRequest;
  await banco.db().sql().query(`insert into config (id) values (1) on conflict do nothing`);
});

beforeEach(async () => {
  await banco.db().sql().query(`delete from convites_de_conexao`);
  await banco.db().sql().query(
    `update config set instagram_app_id = $1, instagram_app_secret = null, app_url = $2 where id = 1`,
    [APP_ID, APP_URL]
  );
});

/** Todos os Set-Cookie da resposta, por nome. */
function cookies(resposta: Response): Map<string, string> {
  const todos = (resposta.headers as Headers & { getSetCookie(): string[] }).getSetCookie();
  return new Map(todos.map((c) => [c.slice(0, c.indexOf("=")), c]));
}

const destino = (resposta: Response) => new URL(resposta.headers.get("location") ?? "");

async function comecar(codigo: string): Promise<Response> {
  return comeco.GET(new Pedido(`${APP_URL}/api/oauth/convite/${codigo}`, { method: "GET" }), {
    params: Promise.resolve({ codigo }),
  });
}

// ---------------------------------------------------------------------------------------------------
// O COMEÇO PELO CONVITE
// ---------------------------------------------------------------------------------------------------

describe("o começo da conexão pelo convite", () => {
  it("com o convite pendente, manda ao Instagram com um state novo e grava os dois cookies", async () => {
    const { id, codigo } = await repo.criarConvite("Dr. Marcus");
    const resposta = await comecar(codigo);
    const para = destino(resposta);
    expect(para.origin).toBe("https://www.instagram.com");
    expect(para.searchParams.get("redirect_uri")).toBe(`${APP_URL}/api/oauth/callback`);
    const state = para.searchParams.get("state") ?? "";
    expect(state).toMatch(/^[0-9a-f]{64}$/);

    const c = cookies(resposta);
    const doState = c.get(COOKIE_DO_STATE) ?? "";
    const doConvite = c.get(COOKIE_DO_CONVITE) ?? "";
    expect(doState.startsWith(`${COOKIE_DO_STATE}=${state};`)).toBe(true);
    expect(doConvite.startsWith(`${COOKIE_DO_CONVITE}=${id};`)).toBe(true);
    for (const cookie of [doState, doConvite]) {
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/Path=\/api\/oauth/i);
      expect(cookie).toMatch(/Max-Age=600/i);
      expect(cookie).toMatch(/SameSite=lax/i);
    }
  });

  it("o convite cancelado, usado, vencido, inexistente ou torto volta para a página, sem cookie", async () => {
    const cancelado = await repo.criarConvite("cancelado");
    await repo.cancelarConvite(cancelado.id);
    const usado = await repo.criarConvite("usado");
    await repo.reivindicarEGravarConta(usado.id, {
      ig_user_id: "17800000000021002",
      username: "u",
      name: null,
      profile_picture_url: null,
      access_token: "t",
      token_expires_at: null,
    });
    const vencido = await repo.criarConvite("vencido");
    await banco
      .db()
      .sql()
      .query(`update convites_de_conexao set expira_em = now() - interval '1 second' where id = $1`, [vencido.id]);

    for (const codigo of [cancelado.codigo, usado.codigo, vencido.codigo, "a".repeat(43), "torto"]) {
      const resposta = await comecar(codigo);
      expect(destino(resposta).toString()).toBe(`${APP_URL}/convite/${codigo}`);
      expect(cookies(resposta).size).toBe(0);
    }
  });

  it("sem o App ID cadastrado, manda para o erro, sem cookie", async () => {
    await banco.db().sql().query(`update config set instagram_app_id = null where id = 1`);
    const { codigo } = await repo.criarConvite("Dr. Marcus");
    const resposta = await comecar(codigo);
    expect(destino(resposta).pathname).toBe("/convite/erro");
    expect(destino(resposta).searchParams.get("motivo")).toBe("falhou");
    expect(cookies(resposta).size).toBe(0);
  });
});

describe("o começo da conexão de hoje, com a sessão", () => {
  it("apaga o cookie do convite, para a conexão normal não virar convite", async () => {
    const cookie = await cabecalhoDaSessaoDeTeste();
    const resposta = await login.GET(new Pedido(`${APP_URL}/api/oauth/login`, { method: "GET", headers: { cookie } }));
    const doConvite = cookies(resposta).get(COOKIE_DO_CONVITE) ?? "";
    expect(doConvite.startsWith(`${COOKIE_DO_CONVITE}=;`)).toBe(true);
    expect(doConvite).toMatch(/Path=\/api\/oauth/i);
    expect(doConvite).toMatch(/(Max-Age=0|Expires=Thu, 01 Jan 1970)/i);
    expect(cookies(resposta).get(COOKIE_DO_STATE)).toBeTruthy();
  });
});
```

- [ ] **Passo 2: ver os testes falharem**

```bash
npx vitest run tests/convite-publico.test.ts tests/sessao-nas-actions.test.ts
npx vitest run --config vitest.dom.config.ts testes-dom/convite-sem-menu.dom.tsx
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/convite.integracao.ts
```

Esperado:
- puros: 5 caem ("/convite/abc", "/convite/pronto" e "/convite/erro" passam sem a sessão; os cabeçalhos; e
  "as públicas são as do proxy.ts"), e 10 passam (o `/api/oauth/convite/abc` já passa, porque o
  `/api/oauth` já é público);
- tela: os 3 casos do `/convite` caem, e o da configuração passa;
- integração: `ALVO: banco de TESTE` e `Error: Cannot find package '@/app/api/oauth/convite/[codigo]/route'`.

- [ ] **Passo 3: o nome do cookie do convite**

Em `lib/auth.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/auth.ts b/lib/auth.ts
index bbc78c0..f91278f 100644
--- a/lib/auth.ts
+++ b/lib/auth.ts
@@ -71,6 +71,12 @@ export function isValidSession(value: string | undefined, now: number = Date.now
 // (que exige a sessão) sorteia um, guarda no cookie abaixo, e a volta só aceita o mesmo valor, uma vez.
 export const OAUTH_STATE_COOKIE = "metodochat_oauth_state";
 export const OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60;
+
+// O COOKIE DO CONVITE (docs/specs/2026-11-03-link-de-convite.md): o começo pelo link de convite
+// (`/api/oauth/convite/[codigo]`) grava o id do convite ao lado do `state`, com as mesmas opções e o mesmo
+// prazo, e é ele que diz à volta que a conexão é do cliente, e não de alguém do painel. O começo de hoje
+// (`/api/oauth/login`) o apaga.
+export const OAUTH_CONVITE_COOKIE = "metodochat_oauth_convite";
 const STATE_HEX = /^[0-9a-f]{64}$/;
 
 export function novoOauthState(): string {
```

- [ ] **Passo 4: o porteiro, a casca e os cabeçalhos**

Em `proxy.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/proxy.ts b/proxy.ts
index 20db601..4b09f72 100644
--- a/proxy.ts
+++ b/proxy.ts
@@ -10,6 +10,8 @@ const PUBLIC_PREFIXES = [
   "/api/queue/tick",
   "/privacidade",
   "/exclusao-de-dados",
+  // O link de convite, que o cliente abre sem a senha do painel (docs/specs/2026-11-03-link-de-convite.md).
+  "/convite",
   "/entrar",
   "/_next",
   "/favicon.ico",
```

Em `app/app-shell.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/app-shell.tsx b/app/app-shell.tsx
index b882b4b..e667682 100644
--- a/app/app-shell.tsx
+++ b/app/app-shell.tsx
@@ -61,8 +61,9 @@ const NAV_GROUPS: {
   },
 ];
 
-// Páginas sem painel (login e páginas públicas exigidas pela Meta)
-const PUBLIC_PATHS = ["/entrar", "/privacidade", "/exclusao-de-dados"];
+// Páginas sem painel (login, páginas públicas exigidas pela Meta e o link de
+// convite, que o cliente abre sem a senha do painel)
+const PUBLIC_PATHS = ["/entrar", "/privacidade", "/exclusao-de-dados", "/convite"];
 
 // A ROTA DO EDITOR, que recebe a janela inteira: nada de menu, nada de `max-w`,
 // nada de padding. Enquanto se edita, o quadro é o aplicativo — e ele traz a
```

Em `next.config.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/next.config.ts b/next.config.ts
index 5d63ec5..f816ad7 100644
--- a/next.config.ts
+++ b/next.config.ts
@@ -1,6 +1,20 @@
 import type { NextConfig } from "next";
 
+// AS ROTAS DO LINK DE CONVITE (achado 157, docs/specs/2026-11-03-link-de-convite.md): o código do convite
+// viaja no caminho da URL, então ele não pode ir no Referer, ficar num cache nem entrar num buscador.
+const FECHADO = [
+  { key: "Referrer-Policy", value: "no-referrer" },
+  { key: "Cache-Control", value: "no-store" },
+  { key: "X-Robots-Tag", value: "noindex" },
+];
+
 const nextConfig: NextConfig = {
+  async headers() {
+    return [
+      { source: "/convite/:path*", headers: FECHADO },
+      { source: "/api/oauth/convite/:path*", headers: FECHADO },
+    ];
+  },
   async redirects() {
     return [
       // A página deixou de ser loja (com preço e checkout) e virou vitrine dos
```

- [ ] **Passo 5: o começo de hoje apaga o cookie do convite**

Em `app/api/oauth/login/route.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/api/oauth/login/route.ts b/app/api/oauth/login/route.ts
index 15e0dcf..d095cc8 100644
--- a/app/api/oauth/login/route.ts
+++ b/app/api/oauth/login/route.ts
@@ -3,6 +3,7 @@ import { authorizeUrl } from "@/lib/ig";
 import {
   isValidSession,
   novoOauthState,
+  OAUTH_CONVITE_COOKIE,
   OAUTH_STATE_COOKIE,
   OAUTH_STATE_MAX_AGE_SECONDS,
   SESSION_COOKIE,
@@ -43,5 +44,8 @@ export async function GET(req: NextRequest) {
     path: "/api/oauth",
     maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
   });
+  // SEM O COOKIE DO CONVITE: uma conexão normal, feita depois de um convite no mesmo navegador, não pode
+  // ser tratada como a do cliente na volta (docs/specs/2026-11-03-link-de-convite.md).
+  res.cookies.set(OAUTH_CONVITE_COOKIE, "", { path: "/api/oauth", maxAge: 0 });
   return res;
 }
```

- [ ] **Passo 6: o começo pelo convite**

Crie `app/api/oauth/convite/[codigo]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { authorizeUrl } from "@/lib/ig";
import {
  novoOauthState,
  OAUTH_CONVITE_COOKIE,
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_MAX_AGE_SECONDS,
} from "@/lib/auth";
import { getConfig } from "@/lib/db";
import { canonicalAppUrl } from "@/lib/app-url";
import { estadoDoConvite } from "@/lib/convites";
import { conviteDoCodigo } from "@/lib/convites-repositorio";

// O COMEÇO DA CONEXÃO PELO LINK DE CONVITE (docs/specs/2026-11-03-link-de-convite.md). É pública, porque
// `/api/oauth` está na PUBLIC_PREFIXES do proxy.ts: quem abre é o cliente, sem a senha do painel, e quem
// confere é o código do link.
//
// COM O CONVITE PENDENTE, faz o mesmo que `/api/oauth/login` faz depois da sessão, e grava também o id do
// convite num segundo cookie, para a volta saber que a conexão é do cliente. Sem o convite pendente, volta
// para a página do link, que mostra a frase do link que não vale, sem `state` nenhum.
//
// NÃO GRAVA O `app_url`, ao contrário do começo de hoje: uma rota aberta não escreve na configuração.
export async function GET(req: NextRequest, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const convite = await conviteDoCodigo(codigo);
  if (!convite || estadoDoConvite(convite, Date.now()) !== "pendente") {
    return NextResponse.redirect(`${req.nextUrl.origin}/convite/${encodeURIComponent(codigo)}`);
  }
  const config = await getConfig();
  if (!config.instagram_app_id) {
    return NextResponse.redirect(`${req.nextUrl.origin}/convite/erro?motivo=falhou`);
  }
  // O MESMO `redirect_uri` canônico do começo de hoje: ele tem de bater com o cadastrado na Meta, e o
  // cookie do `state` só volta junto se o começo acontecer no endereço da volta (achado 136).
  const redirectUri = `${canonicalAppUrl(config.app_url, req.nextUrl.origin)}/api/oauth/callback`;
  const state = novoOauthState();
  const res = NextResponse.redirect(authorizeUrl(config.instagram_app_id, redirectUri, state));
  const opcoes = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/api/oauth",
    maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
  };
  res.cookies.set(OAUTH_STATE_COOKIE, state, opcoes);
  res.cookies.set(OAUTH_CONVITE_COOKIE, convite.id, opcoes);
  return res;
}
```

- [ ] **Passo 7: ver passar**

```bash
npx vitest run tests/convite-publico.test.ts tests/sessao-nas-actions.test.ts tests/proxy-matcher.test.ts
npx vitest run --config vitest.dom.config.ts testes-dom/convite-sem-menu.dom.tsx
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/convite.integracao.ts testes-integracao/cron-e-oauth.integracao.ts
npx eslint lib/auth.ts proxy.ts app/app-shell.tsx next.config.ts app/api/oauth/login/route.ts "app/api/oauth/convite/[codigo]/route.ts" tests/sessao-nas-actions.test.ts tests/convite-publico.test.ts testes-dom/convite-sem-menu.dom.tsx testes-integracao/convite.integracao.ts
npx tsc --noEmit
```

Esperado: 3 arquivos e 28 casos puros; 1 arquivo e 4 casos de tela; `ALVO: banco de TESTE`, 2 arquivos e 13
casos de integração; lint e `tsc` limpos. Varra os dez arquivos com o `varrer-texto.mjs`.

- [ ] **Passo 8: o commit**

A mensagem do commit, gravada em `$SCRATCH/msg-conv-f3.txt`:

```text
O link de convite começa a conexão sem a senha do painel

A rota /api/oauth/convite/[codigo] confere o convite pelo hash do código e,
com ele pendente, faz o mesmo começo da conexão de hoje, gravando também o id
do convite num segundo cookie, com as mesmas opções do state. O convite que
não vale volta para a página do link, sem cookie nenhum, e a rota aberta não
escreve na configuração. A conexão de hoje passa a apagar esse cookie. O
/convite entra nas rotas públicas do porteiro e da casca do painel, e as rotas
do convite ganham Referrer-Policy, Cache-Control e X-Robots-Tag, porque o
código viaja no caminho da URL.
```

```bash
git add lib/auth.ts proxy.ts app/app-shell.tsx next.config.ts app/api/oauth/login/route.ts "app/api/oauth/convite/[codigo]/route.ts" tests/sessao-nas-actions.test.ts tests/convite-publico.test.ts testes-dom/convite-sem-menu.dom.tsx testes-integracao/convite.integracao.ts
git commit -F "$SCRATCH/msg-conv-f3.txt"
```


---

### FASE 4 — A volta do Instagram pelo convite

**Arquivos:** `app/api/oauth/callback/convite.ts` (novo), `app/api/oauth/callback/route.ts`,
`testes-integracao/convite-volta.integracao.ts` (novo).

- [ ] **Passo 1: o teste, antes do código** (a Meta falsa no loopback e o `fetch` interceptado só neste
  arquivo, que recusa qualquer endereço de fora)

Crie `testes-integracao/convite-volta.integracao.ts`:

```ts
// A VOLTA DO INSTAGRAM COM O COOKIE DO CONVITE (docs/specs/2026-11-03-link-de-convite.md), e a volta de
// hoje, sem ele, contra o banco descartável.
//
// A META FALSA: um servidor HTTP na própria máquina para o Graph (`IG_GRAPH_BASE` preso ao loopback por
// uma guarda que falha ANTES de qualquer requisição sair, como em `agendados.integracao.ts`), e o `fetch`
// interceptado só neste arquivo para a troca do código, que vai a `api.instagram.com` sem desvio nenhum
// (`exchangeCodeForShortToken`, lib/ig.ts). O interceptador RECUSA qualquer endereço que não seja o
// loopback ou essa troca. **NADA AQUI CHAMA A META DE VERDADE.**
import { createServer, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { bancoDescartavel } from "./harness";

type ModuloVolta = typeof import("@/app/api/oauth/callback/route");
type ModuloRepositorio = typeof import("@/lib/convites-repositorio");
type ModuloIg = typeof import("@/lib/ig");

const banco = bancoDescartavel();

// Valores inventados. Nenhuma credencial de verdade entra em teste.
const APP_ID = "1234567890123456";
const APP_SECRET = "chave-secreta-do-app-de-teste-que-nao-vale-nada";
const APP_URL = "https://painel.exemplo.com.br";
const CONTA = "17800000000021501";
const CODE = "AQBcodigoDaVoltaDoInstagramDeTeste";
const STATE = "a".repeat(64);
const TOKEN_CURTO = "IGcurtoDeTesteQueNaoValeNada";
const TOKEN_LONGO = "IGlongoDeTesteQueNaoValeNada";
const COOKIE_DO_STATE = "metodochat_oauth_state";
const COOKIE_DO_CONVITE = "metodochat_oauth_convite";
const COOKIE_DA_CONTA = "metodochat_account";

const meta = {
  /** A resposta da troca do código em `api.instagram.com`. */
  troca: { status: 200, corpo: JSON.stringify({ access_token: TOKEN_CURTO, user_id: CONTA }) },
  /** Roda no meio da troca, antes de ela responder: é como o caso da disputa entra. */
  noMeioDaTroca: null as null | (() => Promise<void>),
  assinatura: { status: 200, corpo: JSON.stringify({ success: true }) },
  trocas: 0,
  assinaturas: 0,
  desconhecidos: [] as string[],
};

let servidorMeta: Server;
let volta: ModuloVolta;
let repo: ModuloRepositorio;
let ig: ModuloIg;
let Pedido: typeof import("next/server").NextRequest;

function responder(res: ServerResponse, status: number, corpo: string) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(corpo);
}

beforeAll(async () => {
  servidorMeta = createServer((req, res) => {
    const u = new URL(req.url ?? "/", "http://127.0.0.1");
    if (req.method === "GET" && u.pathname === "/access_token") {
      return responder(res, 200, JSON.stringify({ access_token: TOKEN_LONGO, expires_in: 5_184_000 }));
    }
    if (req.method === "GET" && u.pathname.endsWith("/me")) {
      return responder(res, 200, JSON.stringify({ user_id: CONTA, username: "conta_do_convite", name: "Conta" }));
    }
    if (req.method === "POST" && u.pathname.endsWith(`/${CONTA}/subscribed_apps`)) {
      meta.assinaturas++;
      return responder(res, meta.assinatura.status, meta.assinatura.corpo);
    }
    meta.desconhecidos.push(`${req.method} ${u.pathname}`);
    responder(res, 404, JSON.stringify({ error: { message: "a Meta falsa não conhece esse caminho" } }));
  });
  await new Promise<void>((pronto) => servidorMeta.listen(0, "127.0.0.1", pronto));
  process.env.IG_GRAPH_BASE = `http://127.0.0.1:${(servidorMeta.address() as AddressInfo).port}`;

  // O INTERCEPTADOR: só a troca do código e o loopback passam.
  const fetchDeVerdade = globalThis.fetch;
  vi.stubGlobal("fetch", async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof entrada === "string" ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
    if (url.href === "https://api.instagram.com/oauth/access_token") {
      meta.trocas++;
      if (meta.noMeioDaTroca) await meta.noMeioDaTroca();
      return new Response(meta.troca.corpo, { status: meta.troca.status });
    }
    if (url.hostname === "127.0.0.1") return fetchDeVerdade(entrada, init);
    throw new Error(`RECUSADO: este teste não chama ${url.origin}`);
  });

  ig = await import("@/lib/ig");
  volta = await import("@/app/api/oauth/callback/route");
  repo = await import("@/lib/convites-repositorio");
  Pedido = (await import("next/server")).NextRequest;

  // A GUARDA, ANTES DE QUALQUER REQUISIÇÃO.
  if (ig.baseDoGraph() !== process.env.IG_GRAPH_BASE) {
    throw new Error(
      `RECUSADO: a base do Graph é ${ig.baseDoGraph()}, e tinha de ser a desta rodada ` +
        `(${process.env.IG_GRAPH_BASE}). Sem o desvio, este teste chamaria a Meta de verdade.`
    );
  }
  await banco.db().sql().query(`insert into config (id) values (1) on conflict do nothing`);
});

afterAll(async () => {
  vi.unstubAllGlobals();
  delete process.env.IG_GRAPH_BASE;
  await new Promise<void>((pronto) => servidorMeta.close(() => pronto()));
});

beforeEach(async () => {
  meta.troca = { status: 200, corpo: JSON.stringify({ access_token: TOKEN_CURTO, user_id: CONTA }) };
  meta.noMeioDaTroca = null;
  meta.assinatura = { status: 200, corpo: JSON.stringify({ success: true }) };
  meta.trocas = 0;
  meta.assinaturas = 0;
  meta.desconhecidos.length = 0;
  await banco.db().sql().query(`delete from convites_de_conexao`);
  await banco.db().sql().query(`delete from events where account_id = $1`, [CONTA]);
  await banco.db().sql().query(`delete from accounts where ig_user_id = $1`, [CONTA]);
  await banco.db().sql().query(
    `update config set instagram_app_id = $1, instagram_app_secret = $2, app_url = $3 where id = 1`,
    [APP_ID, APP_SECRET, APP_URL]
  );
});

/** A volta como o Instagram a chama, com os cookies que o começo gravou. */
async function voltar(opcoes: { convite?: string; state?: string; query?: string } = {}): Promise<Response> {
  const cookies = [`${COOKIE_DO_STATE}=${opcoes.state ?? STATE}`];
  if (opcoes.convite) cookies.push(`${COOKIE_DO_CONVITE}=${opcoes.convite}`);
  const query = opcoes.query ?? `code=${CODE}&state=${STATE}`;
  return volta.GET(
    new Pedido(`${APP_URL}/api/oauth/callback?${query}`, { method: "GET", headers: { cookie: cookies.join("; ") } })
  );
}

function setCookies(resposta: Response): Map<string, string> {
  const todos = (resposta.headers as Headers & { getSetCookie(): string[] }).getSetCookie();
  return new Map(todos.map((c) => [c.slice(0, c.indexOf("=")), c]));
}

const destino = (resposta: Response) => new URL(resposta.headers.get("location") ?? "");
const apagado = (cookie: string | undefined) => !!cookie && /=;/.test(cookie) && /(Max-Age=0|Expires=Thu, 01 Jan 1970)/i.test(cookie);

const conviteNoBanco = async (id: string) =>
  ((await banco.db().sql().query(`select * from convites_de_conexao where id = $1`, [id])) as Record<string, unknown>[])[0];

const tokenDaConta = async () =>
  ((await banco.db().sql().query(`select access_token from accounts where ig_user_id = $1`, [CONTA])) as {
    access_token: string;
  }[])[0]?.access_token ?? null;

function oFimDoConvite(resposta: Response, caminho: string, motivo?: string) {
  expect(destino(resposta).origin).toBe(APP_URL);
  expect(destino(resposta).pathname).toBe(caminho);
  expect(destino(resposta).searchParams.get("motivo")).toBe(motivo ?? null);
  const c = setCookies(resposta);
  expect(apagado(c.get(COOKIE_DO_STATE))).toBe(true);
  expect(apagado(c.get(COOKIE_DO_CONVITE))).toBe(true);
  expect(c.has(COOKIE_DA_CONTA)).toBe(false);
}

describe("a volta do Instagram pelo convite", () => {
  it("conecta a conta, usa o convite e manda para o \"Pronto\", sem o cookie da conta", async () => {
    const { id } = await repo.criarConvite("Dr. Marcus");
    const resposta = await voltar({ convite: id });
    oFimDoConvite(resposta, "/convite/pronto");
    expect(await tokenDaConta()).toBe(TOKEN_LONGO);
    expect(await conviteNoBanco(id)).toMatchObject({ conta_conectada: CONTA, ultimo_erro: null });
    expect((await conviteNoBanco(id)).usado_em).toBeInstanceOf(Date);
    expect(meta.assinaturas).toBe(1);
    expect(meta.desconhecidos).toEqual([]);
  });

  it("o convite reivindicado no meio da troca (outra aba, ou cancelado) não grava a conta", async () => {
    const { id } = await repo.criarConvite("Dr. Marcus");
    meta.noMeioDaTroca = async () => {
      await repo.cancelarConvite(id);
    };
    const resposta = await voltar({ convite: id });
    oFimDoConvite(resposta, "/convite/erro", "vencido");
    expect(meta.trocas).toBe(1);
    expect(await tokenDaConta()).toBeNull();
    expect(meta.assinaturas).toBe(0);
  });

  it("o convite que já não vale manda para o erro sem chamar a Meta", async () => {
    const { id } = await repo.criarConvite("Dr. Marcus");
    await repo.cancelarConvite(id);
    for (const convite of [id, "00000000-0000-4000-8000-000000000000", "torto"]) {
      oFimDoConvite(await voltar({ convite }), "/convite/erro", "vencido");
    }
    expect(meta.trocas).toBe(0);
    expect(await tokenDaConta()).toBeNull();
  });

  it("a Meta em erro deixa o convite pendente, com o erro limpo dos segredos (achado 159)", async () => {
    const { id } = await repo.criarConvite("Dr. Marcus");
    meta.troca = {
      status: 400,
      corpo: `{"error_message":"codigo ${CODE} recusado","pedido":"access_token=vazado&client_secret=${APP_SECRET}"}`,
    };
    const resposta = await voltar({ convite: id });
    oFimDoConvite(resposta, "/convite/erro", "falhou");
    const linha = await conviteNoBanco(id);
    expect(linha.usado_em).toBeNull();
    const erro = String(linha.ultimo_erro);
    expect(erro).toContain("OCULTO");
    expect(erro).not.toContain(CODE);
    expect(erro).not.toContain("vazado");
    expect(erro).not.toContain(APP_SECRET);
    expect(erro.length).toBeLessThanOrEqual(160);
    expect(await tokenDaConta()).toBeNull();
  });

  it("a recusa no Instagram anota \"autorização negada\" e não chama a Meta", async () => {
    const { id } = await repo.criarConvite("Dr. Marcus");
    const resposta = await voltar({ convite: id, query: `error=access_denied&state=${STATE}` });
    oFimDoConvite(resposta, "/convite/erro", "negado");
    expect((await conviteNoBanco(id)).ultimo_erro).toBe("autorização negada");
    expect(meta.trocas).toBe(0);
  });

  it("o state diferente recusa sem escrever nada, nem no convite", async () => {
    const { id } = await repo.criarConvite("Dr. Marcus");
    const resposta = await voltar({ convite: id, state: "b".repeat(64) });
    oFimDoConvite(resposta, "/convite/erro", "falhou");
    expect(await conviteNoBanco(id)).toMatchObject({ ultimo_erro: null, usado_em: null });
    expect(meta.trocas).toBe(0);
  });

  it("a assinatura dos webhooks que falha fica no convite usado (achado 158), e a conta fica", async () => {
    const { id } = await repo.criarConvite("Dr. Marcus");
    meta.assinatura = { status: 500, corpo: JSON.stringify({ error: { message: "a Meta caiu" } }) };
    const resposta = await voltar({ convite: id });
    oFimDoConvite(resposta, "/convite/pronto");
    expect(await tokenDaConta()).toBe(TOKEN_LONGO);
    const linha = await conviteNoBanco(id);
    expect(linha.conta_conectada).toBe(CONTA);
    expect(String(linha.ultimo_erro)).toMatch(/^conectada, mas a assinatura dos webhooks falhou: /);
    expect(String(linha.ultimo_erro)).not.toContain(TOKEN_LONGO);
    const eventos = (await banco
      .db()
      .sql()
      .query(`select type from events where account_id = $1`, [CONTA])) as { type: string }[];
    expect(eventos.map((e) => e.type)).toContain("subscribe_failed");
  });
});

describe("a volta do Instagram sem o convite, como hoje", () => {
  it("conecta, manda para o painel e grava o cookie da conta", async () => {
    const resposta = await voltar();
    expect(destino(resposta).toString()).toBe(`${APP_URL}/?conectado=1`);
    expect(setCookies(resposta).get(COOKIE_DA_CONTA)?.startsWith(`${COOKIE_DA_CONTA}=${CONTA};`)).toBe(true);
    expect(apagado(setCookies(resposta).get(COOKIE_DO_STATE))).toBe(true);
    expect(await tokenDaConta()).toBe(TOKEN_LONGO);
  });
});
```

- [ ] **Passo 2: ver o teste falhar**

```bash
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/convite-volta.integracao.ts
```

Esperado: `ALVO: banco de TESTE`, os 7 casos do convite caindo e o da volta de hoje passando. Esse que passa
prova que a Meta falsa e o interceptador funcionam contra o código de hoje.

- [ ] **Passo 3: a volta pelo convite**

Crie `app/api/oauth/callback/convite.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCodeForShortToken,
  exchangeForLongLivedToken,
  getProfile,
  subscribeToWebhooks,
} from "@/lib/ig";
import { OAUTH_CONVITE_COOKIE, OAUTH_STATE_COOKIE, oauthStateConfere } from "@/lib/auth";
import { getConfig } from "@/lib/db";
import { logEvent } from "@/lib/engine";
import { canonicalAppUrl } from "@/lib/app-url";
import { estadoDoConvite, textoParaOPainel, type MotivoDoErro } from "@/lib/convites";
import { anotarErroDoConvite, conviteDoId, reivindicarEGravarConta } from "@/lib/convites-repositorio";

// A VOLTA DO INSTAGRAM PELO LINK DE CONVITE (docs/specs/2026-11-03-link-de-convite.md). A rota da volta
// (./route.ts) chama esta função quando o cookie do convite veio junto, e o caminho de hoje fica intacto.
//
// QUEM CONECTOU É O CLIENTE, e não alguém do painel: o fim é uma das duas páginas abertas do convite
// (`/convite/pronto` ou `/convite/erro`), nunca o painel, e o cookie da conta selecionada não é gravado.
// Nada do texto da Meta chega ao cliente: ele vai, limpo e cortado, para o `ultimo_erro` do convite.
//
// A ORDEM É A DA SPEC:
// 1. o `state`, antes de qualquer escrita: sem ele, a volta não é de ninguém;
// 2. a recusa no Instagram;
// 3. o convite pendente, antes de chamar a Meta;
// 4. a troca do código, o token longo e o perfil, fora da transação, para ela não ficar aberta durante a rede;
// 5. a reivindicação e a conta, numa transação só (`reivindicarEGravarConta`);
// 6. a assinatura dos webhooks, que não desfaz a conexão (achado 158).
export async function voltaDoConvite(req: NextRequest, conviteId: string): Promise<NextResponse> {
  const appUrl = req.nextUrl.origin;
  const q = req.nextUrl.searchParams;

  // OS DOIS COOKIES SÃO APAGADOS EM TODA RESPOSTA, dê certo ou não: cada `state` e cada convite servem uma
  // tentativa.
  const fim = (caminho: string) => {
    const res = NextResponse.redirect(`${appUrl}${caminho}`);
    res.cookies.set(OAUTH_STATE_COOKIE, "", { path: "/api/oauth", maxAge: 0 });
    res.cookies.set(OAUTH_CONVITE_COOKIE, "", { path: "/api/oauth", maxAge: 0 });
    return res;
  };
  const erro = (motivo: MotivoDoErro) => fim(`/convite/erro?motivo=${motivo}`);
  // Anotar não pode derrubar a resposta: o cliente vê a frase do erro de qualquer jeito.
  const anotar = async (texto: string, estado: "pendente" | "usado") => {
    try {
      await anotarErroDoConvite(conviteId, texto, estado);
    } catch {
      // banco fora do ar: a frase do erro ainda chega ao cliente
    }
  };

  if (!oauthStateConfere(req.cookies.get(OAUTH_STATE_COOKIE)?.value, q.get("state"))) return erro("falhou");

  if (q.get("error")) {
    await anotar("autorização negada", "pendente");
    return erro("negado");
  }

  const convite = await conviteDoId(conviteId);
  if (!convite || estadoDoConvite(convite, Date.now()) !== "pendente") return erro("vencido");

  const code = q.get("code");
  if (!code) {
    await anotar("código ausente", "pendente");
    return erro("falhou");
  }
  const config = await getConfig();
  if (!config.instagram_app_id || !config.instagram_app_secret) {
    await anotar("App ID e chave secreta não cadastrados no /setup", "pendente");
    return erro("falhou");
  }

  // OS SEGREDOS DESTA VOLTA, que nunca vão para o `ultimo_erro` (achado 159).
  const segredos: (string | null | undefined)[] = [code, config.instagram_app_secret];
  const mensagem = (err: unknown) => (err instanceof Error ? err.message : "erro desconhecido");

  let conta: Parameters<typeof reivindicarEGravarConta>[1];
  try {
    const short = await exchangeCodeForShortToken({
      appId: config.instagram_app_id,
      appSecret: config.instagram_app_secret,
      // precisa ser IDÊNTICO ao usado no começo
      redirectUri: `${canonicalAppUrl(config.app_url, appUrl)}/api/oauth/callback`,
      code,
    });
    segredos.push(short.access_token);
    const long = await exchangeForLongLivedToken(config.instagram_app_secret, short.access_token);
    segredos.push(long.access_token);
    const profile = await getProfile(long.access_token);
    conta = {
      ig_user_id: String(profile.user_id ?? short.user_id),
      username: profile.username ?? null,
      name: profile.name ?? null,
      profile_picture_url: profile.profile_picture_url ?? null,
      access_token: long.access_token,
      token_expires_at: new Date(Date.now() + long.expires_in * 1000),
    };
  } catch (err) {
    await anotar(textoParaOPainel(mensagem(err), segredos), "pendente");
    return erro("falhou");
  }

  let conectou: boolean;
  try {
    conectou = await reivindicarEGravarConta(conviteId, conta);
  } catch (err) {
    await anotar(textoParaOPainel(mensagem(err), segredos), "pendente");
    return erro("falhou");
  }
  // Outra aba com o mesmo link, ou o convite cancelado no meio: a conta não foi gravada.
  if (!conectou) return erro("vencido");

  try {
    await subscribeToWebhooks(conta.ig_user_id, conta.access_token);
  } catch (err) {
    const aviso = textoParaOPainel(`conectada, mas a assinatura dos webhooks falhou: ${mensagem(err)}`, segredos);
    await anotar(aviso, "usado");
    try {
      await logEvent(conta.ig_user_id, "subscribe_failed", { message: aviso });
    } catch {
      // banco fora do ar: o aviso já foi para o convite, se deu
    }
  }
  return fim("/convite/pronto");
}
```

- [ ] **Passo 4: o desvio na volta**

Em `app/api/oauth/callback/route.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/api/oauth/callback/route.ts b/app/api/oauth/callback/route.ts
index e5a38e8..e9bb478 100644
--- a/app/api/oauth/callback/route.ts
+++ b/app/api/oauth/callback/route.ts
@@ -5,15 +5,21 @@ import {
   getProfile,
   subscribeToWebhooks,
 } from "@/lib/ig";
-import { OAUTH_STATE_COOKIE, oauthStateConfere } from "@/lib/auth";
+import { OAUTH_CONVITE_COOKIE, OAUTH_STATE_COOKIE, oauthStateConfere } from "@/lib/auth";
 import { getConfig, upsertAccount } from "@/lib/db";
 import { logEvent } from "@/lib/engine";
 import { canonicalAppUrl } from "@/lib/app-url";
 import { ACCOUNT_COOKIE } from "@/lib/account";
+import { voltaDoConvite } from "./convite";
 
 export const maxDuration = 60;
 
 export async function GET(req: NextRequest) {
+  // COM O COOKIE DO CONVITE, a conexão é do cliente, que começou pelo link de convite
+  // (docs/specs/2026-11-03-link-de-convite.md), e o caminho é outro, em ./convite.ts. Sem ele, nada muda.
+  const conviteId = req.cookies.get(OAUTH_CONVITE_COOKIE)?.value;
+  if (conviteId) return voltaDoConvite(req, conviteId);
+
   const appUrl = req.nextUrl.origin;
   const q = req.nextUrl.searchParams;
   const code = q.get("code");
```

- [ ] **Passo 5: ver passar**

```bash
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/convite-volta.integracao.ts testes-integracao/cron-e-oauth.integracao.ts testes-integracao/convite.integracao.ts
npx eslint app/api/oauth/callback/route.ts app/api/oauth/callback/convite.ts testes-integracao/convite-volta.integracao.ts
npx tsc --noEmit
node "$SCRATCH/varrer-texto.mjs" app/api/oauth/callback/route.ts app/api/oauth/callback/convite.ts testes-integracao/convite-volta.integracao.ts
```

Esperado: `ALVO: banco de TESTE`, 3 arquivos e 21 casos passando; lint e `tsc` limpos; os três arquivos
limpos.

- [ ] **Passo 6: o commit**

A mensagem do commit, gravada em `$SCRATCH/msg-conv-f4.txt`:

```text
A volta do Instagram reconhece o convite e conecta a conta do cliente

Com o cookie do convite, a volta confere o state antes de qualquer escrita,
anota a recusa, só chama a Meta com o convite pendente e grava a conta na
mesma transação que reivindica o convite. O fim é uma das páginas abertas do
convite, nunca o painel, e o cookie da conta selecionada não é gravado. O erro
vai limpo dos segredos e cortado para o convite, e a assinatura dos webhooks
que falha fica no convite usado, porque o cliente só vê "Pronto". Sem o
cookie do convite, a volta de hoje não muda.
```

```bash
git add app/api/oauth/callback/route.ts app/api/oauth/callback/convite.ts testes-integracao/convite-volta.integracao.ts
git commit -F "$SCRATCH/msg-conv-f4.txt"
```


---

### FASE 5 — As três páginas abertas

**Arquivos:** `app/convite/[codigo]/page.tsx`, `app/convite/pronto/page.tsx`, `app/convite/erro/page.tsx`
(novos), `testes-integracao/convite-paginas.integracao.ts` (novo).

- [ ] **Passo 1: o teste, antes do código**

Crie `testes-integracao/convite-paginas.integracao.ts`:

```ts
// AS TRÊS PÁGINAS ABERTAS DO LINK DE CONVITE (docs/specs/2026-11-03-link-de-convite.md): a do link
// (`/convite/[codigo]`), a do "Pronto" e a do erro, desenhadas em HTML de verdade contra o banco
// descartável. Elas são o que o cliente vê sem a senha do painel, então o que importa é também o que NÃO
// aparece: o "para quem", as contas, o motivo de verdade de um erro e qual dos quatro casos fez o link não
// valer.
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bancoDescartavel } from "./harness";

type ModuloPagina = typeof import("@/app/convite/[codigo]/page");
type ModuloPronto = typeof import("@/app/convite/pronto/page");
type ModuloErro = typeof import("@/app/convite/erro/page");
type ModuloRepositorio = typeof import("@/lib/convites-repositorio");

const banco = bancoDescartavel();

let pagina: ModuloPagina;
let pronto: ModuloPronto;
let erro: ModuloErro;
let repo: ModuloRepositorio;

beforeAll(async () => {
  pagina = await import("@/app/convite/[codigo]/page");
  pronto = await import("@/app/convite/pronto/page");
  erro = await import("@/app/convite/erro/page");
  repo = await import("@/lib/convites-repositorio");
});

beforeEach(async () => {
  await banco.db().sql().query(`delete from convites_de_conexao`);
});

const html = async (codigo: string) =>
  renderToStaticMarkup(await pagina.default({ params: Promise.resolve({ codigo }) }));

const htmlDoErro = async (motivo: string | string[] | undefined) =>
  renderToStaticMarkup(await erro.default({ searchParams: Promise.resolve({ motivo }) }));

const FRASE_QUE_NAO_VALE = "Este link não vale mais. Peça um novo a quem te mandou.";

describe("a página do link", () => {
  it("com o convite pendente, mostra os três passos e o botão de conectar", async () => {
    const { codigo } = await repo.criarConvite("Dr. Marcus");
    const h = await html(codigo);
    expect(h).toContain("Conectar seu Instagram");
    expect(h).toContain("Profissional");
    expect(h).toContain("Convites de testador");
    expect(h).toContain("não aparece no aplicativo do Instagram no celular");
    expect(h).toContain(`href="/api/oauth/convite/${codigo}"`);
    expect(h).toContain("Conectar meu Instagram");
    // O link de fora sai sem o Referer, para o endereço com o código não ir junto (achado 157).
    expect(h).toMatch(
      /<a href="https:\/\/www\.instagram\.com\/accounts\/manage_access\/" target="_blank" rel="noreferrer"/
    );
    // Nada do painel: nem o "para quem".
    expect(h).not.toContain("Dr. Marcus");
  });

  it("o cancelado, o usado, o vencido, o inexistente e o torto têm a mesma frase, e nada mais", async () => {
    const cancelado = await repo.criarConvite("cancelado");
    await repo.cancelarConvite(cancelado.id);
    const usado = await repo.criarConvite("usado");
    await repo.reivindicarEGravarConta(usado.id, {
      ig_user_id: "17800000000021701",
      username: "u",
      name: null,
      profile_picture_url: null,
      access_token: "t",
      token_expires_at: null,
    });
    const vencido = await repo.criarConvite("vencido");
    await banco
      .db()
      .sql()
      .query(`update convites_de_conexao set expira_em = now() - interval '1 second' where id = $1`, [vencido.id]);

    const paginas = await Promise.all(
      [cancelado.codigo, usado.codigo, vencido.codigo, "a".repeat(43), "torto"].map(html)
    );
    for (const h of paginas) {
      expect(h).toContain(FRASE_QUE_NAO_VALE);
      expect(h).not.toContain("Conectar meu Instagram");
      expect(h).not.toContain("/api/oauth/convite/");
    }
    expect(new Set(paginas).size).toBe(1);
  });
});

describe("as páginas do fim", () => {
  it("o \"Pronto\" diz que a conta foi conectada", async () => {
    const h = renderToStaticMarkup(await pronto.default());
    expect(h).toContain("Pronto, sua conta do Instagram foi conectada. Pode fechar esta página.");
  });

  it("o erro tem uma frase por motivo, sempre com o pedido de um link novo", async () => {
    expect(await htmlDoErro("negado")).toContain("A autorização foi recusada no Instagram");
    expect(await htmlDoErro("vencido")).toContain("Este link não vale mais.");
    expect(await htmlDoErro("falhou")).toContain("Não deu certo conectar a conta.");
    for (const motivo of ["negado", "vencido", "falhou"]) {
      expect(await htmlDoErro(motivo)).toContain("Se precisar, peça um novo link a quem te mandou.");
    }
  });

  it("um motivo fora da lista vira \"falhou\", e o texto que veio na URL nunca aparece", async () => {
    const texto = "Instagram API 400: access_token=vazado";
    const h = await htmlDoErro(texto);
    expect(h).toContain("Não deu certo conectar a conta.");
    expect(h).not.toContain("vazado");
    expect(await htmlDoErro(["negado", "vencido"])).toContain("Não deu certo conectar a conta.");
    expect(await htmlDoErro(undefined)).toContain("Não deu certo conectar a conta.");
  });
});
```

- [ ] **Passo 2: ver o teste falhar**

```bash
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/convite-paginas.integracao.ts
```

Esperado: `ALVO: banco de TESTE` e `Error: Cannot find package '@/app/convite/[codigo]/page'`.

- [ ] **Passo 3: as páginas**

Crie `app/convite/[codigo]/page.tsx`:

```tsx
import { btnPrimary, link, muted } from "@/app/ui";
import { estadoDoConvite, FRASE_DO_LINK_QUE_NAO_VALE } from "@/lib/convites";
import { conviteDoCodigo } from "@/lib/convites-repositorio";

// A PÁGINA DO LINK DE CONVITE (docs/specs/2026-11-03-link-de-convite.md). É aberta: quem a vê é o cliente,
// sem a senha do painel, e por isso ela não mostra nada do painel, nem o "para quem" nem as contas.
//
// SEM O CONVITE PENDENTE, a mesma frase para o vencido, o usado, o cancelado e o que não existe: a página
// não diz qual é o caso.
//
// O CÓDIGO VIAJA NO CAMINHO DA URL, e os cabeçalhos do `next.config.ts` fecham o resto (achado 157). O link
// de fora vai com `rel="noreferrer"`, para o endereço com o código não ir junto.
export const metadata = { title: "Conectar seu Instagram", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const MANAGE_ACCESS = "https://www.instagram.com/accounts/manage_access/";

export default async function ConvitePage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const convite = await conviteDoCodigo(codigo);
  // Server Component `async` e `force-dynamic`: roda UMA vez por requisição, e ler o relógio aqui é o
  // comportamento pedido. A regra trata todo arquivo como cliente; o dono silencia do mesmo jeito, com o
  // motivo por extenso, em app/page.tsx:322-333.
  // eslint-disable-next-line react-hooks/purity
  const agora = Date.now();
  const pendente = !!convite && estadoDoConvite(convite, agora) === "pendente";

  return (
    <article className="mx-auto max-w-xl space-y-4 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
      <h1 className="titulo text-2xl font-bold text-zinc-900 dark:text-zinc-100">Conectar seu Instagram</h1>
      {pendente ? (
        <>
          <p>Siga os três passos abaixo, pelo navegador do computador.</p>
          <ol className="list-decimal space-y-3 pl-5">
            <li>
              A sua conta do Instagram precisa ser <b>Profissional</b> (Comercial ou Criador).
            </li>
            <li>
              Aceite o convite de testador: abra{" "}
              <a href={MANAGE_ACCESS} target="_blank" rel="noreferrer" className={link}>
                instagram.com/accounts/manage_access
              </a>
              , entre com a sua conta, vá em <b>Apps e sites</b> → aba <b>Convites de testador</b> e clique em{" "}
              <b>Aceitar</b>.
              <span className={`mt-1 block text-xs ${muted}`}>
                O convite não aparece no aplicativo do Instagram no celular, só na versão web.
              </span>
            </li>
            <li>
              Clique no botão abaixo e autorize na tela do Instagram.
              <a href={`/api/oauth/convite/${encodeURIComponent(codigo)}`} className={`mt-2 block w-fit ${btnPrimary}`}>
                Conectar meu Instagram
              </a>
            </li>
          </ol>
        </>
      ) : (
        <p>{FRASE_DO_LINK_QUE_NAO_VALE}</p>
      )}
    </article>
  );
}
```

Crie `app/convite/pronto/page.tsx`:

```tsx
import { FRASE_DO_PRONTO } from "@/lib/convites";

// O FIM DA CONEXÃO PELO LINK DE CONVITE, quando deu certo (docs/specs/2026-11-03-link-de-convite.md). É
// aberta e fixa: o cliente não entra no painel.
export const metadata = { title: "Conta conectada", robots: { index: false, follow: false } };

export default async function ConvitePronto() {
  return (
    <article className="mx-auto max-w-xl space-y-4 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
      <h1 className="titulo text-2xl font-bold text-zinc-900 dark:text-zinc-100">Conectar seu Instagram</h1>
      <p>{FRASE_DO_PRONTO}</p>
    </article>
  );
}
```

Crie `app/convite/erro/page.tsx`:

```tsx
import { FRASE_DO_MOTIVO, motivoDoErro, PECA_UM_NOVO_LINK } from "@/lib/convites";

// O FIM DA CONEXÃO PELO LINK DE CONVITE, quando deu errado (docs/specs/2026-11-03-link-de-convite.md). É
// aberta, e o motivo vem de uma lista fechada: o que veio na URL nunca aparece, e o texto da Meta fica no
// `ultimo_erro` do convite, para o painel.
export const metadata = { title: "Não deu certo", robots: { index: false, follow: false } };

export default async function ConviteErro({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string | string[] }>;
}) {
  const { motivo } = await searchParams;
  const qual = motivoDoErro(motivo);
  return (
    <article className="mx-auto max-w-xl space-y-4 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
      <h1 className="titulo text-2xl font-bold text-zinc-900 dark:text-zinc-100">Conectar seu Instagram</h1>
      <p>
        {FRASE_DO_MOTIVO[qual]} {PECA_UM_NOVO_LINK}
      </p>
    </article>
  );
}
```

- [ ] **Passo 4: ver passar**

```bash
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/convite-paginas.integracao.ts
npx eslint "app/convite/[codigo]/page.tsx" app/convite/pronto/page.tsx app/convite/erro/page.tsx testes-integracao/convite-paginas.integracao.ts
npx tsc --noEmit
```

Esperado: `ALVO: banco de TESTE`, 5 casos passando; lint e `tsc` limpos. Varra os quatro arquivos.

- [ ] **Passo 5: o commit**

A mensagem do commit, gravada em `$SCRATCH/msg-conv-f5.txt`:

```text
As páginas abertas do link de convite, para o cliente conectar a conta

A página do link mostra os três passos (a conta Profissional, o convite de
testador aceito pelo computador e o botão de conectar) só com o convite
pendente, e uma frase só para o vencido, o usado, o cancelado e o que não
existe. O fim é o "Pronto" ou o erro, com uma frase por motivo de uma lista
fechada. Nenhuma das três mostra nada do painel, e o link de fora sai sem o
Referer.
```

```bash
git add "app/convite/[codigo]/page.tsx" app/convite/pronto/page.tsx app/convite/erro/page.tsx testes-integracao/convite-paginas.integracao.ts
git commit -F "$SCRATCH/msg-conv-f5.txt"
```


---

### FASE 6 — A etapa 6: gerar o link e a lista dos convites

**Arquivos:** `lib/convites.ts`, `lib/convites-repositorio.ts`, `app/api/oauth/callback/convite.ts`,
`app/setup/actions.ts`, `app/setup/convites.tsx` (novo), `app/setup/page.tsx`, `tests/convites.test.ts`,
`testes-integracao/convite.integracao.ts`, `testes-integracao/convites-tabela.integracao.ts`,
`testes-dom/convites-no-setup.dom.tsx` (novo).

- [ ] **Passo 1: os testes, antes do código**

Em `tests/convites.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/convites.test.ts b/tests/convites.test.ts
index 061c64b..620b160 100644
--- a/tests/convites.test.ts
+++ b/tests/convites.test.ts
@@ -6,8 +6,10 @@ import {
   LIMITE_DO_PARA_QUEM,
   VALIDADE_DO_CONVITE_DIAS,
   codigoBemFormado,
+  PREFIXO_DA_ASSINATURA,
   estadoDoConvite,
   hashDoCodigo,
+  linhaDoConvite,
   motivoDoErro,
   novoCodigoDeConvite,
   paraQuemDoFormulario,
@@ -139,3 +141,69 @@ describe("o texto do erro que vai para o painel (achado 159)", () => {
     expect(textoParaOPainel("abc", ["", null, undefined])).toBe("abc");
   });
 });
+
+describe("a linha do convite na etapa 6", () => {
+  const quando = (d: Date | string | null) => (d ? `[${new Date(d).toISOString().slice(5, 16)}]` : "—");
+  const base = {
+    id: "c1",
+    para_quem: "Dr. Marcus",
+    criado_em: new Date(AGORA - 3_600_000),
+    expira_em: new Date(AGORA + 86_400_000),
+    cancelado_em: null,
+    usado_em: null,
+    conta_conectada: null,
+    conta_username: null,
+    ultimo_erro: null,
+    ultimo_erro_em: null,
+  };
+
+  it("o pendente diz quando vence e é o único que se cancela", () => {
+    expect(linhaDoConvite(base, AGORA, quando)).toEqual({
+      id: "c1",
+      paraQuem: "Dr. Marcus",
+      estado: "pendente",
+      detalhe: "vence em [11-04T15:00]",
+      aviso: null,
+      cancelavel: true,
+    });
+  });
+
+  it("o usado diz a conta e quando; o vencido e o cancelado dizem quando", () => {
+    const usado = { ...base, usado_em: new Date(AGORA - 60_000), conta_conectada: "178", conta_username: "drmarcus" };
+    expect(linhaDoConvite(usado, AGORA, quando)).toMatchObject({
+      estado: "usado",
+      detalhe: "@drmarcus, em [11-03T14:59]",
+      cancelavel: false,
+    });
+    expect(linhaDoConvite({ ...usado, conta_username: null }, AGORA, quando).detalhe).toBe("@178, em [11-03T14:59]");
+    expect(linhaDoConvite({ ...base, expira_em: new Date(AGORA) }, AGORA, quando)).toMatchObject({
+      estado: "vencido",
+      detalhe: "venceu em [11-03T15:00]",
+      cancelavel: false,
+    });
+    expect(linhaDoConvite({ ...base, cancelado_em: new Date(AGORA - 120_000) }, AGORA, quando)).toMatchObject({
+      estado: "cancelado",
+      detalhe: "cancelado em [11-03T14:58]",
+      cancelavel: false,
+    });
+  });
+
+  it("a tentativa que falhou aparece com a hora, e a assinatura que falhou aponta o reassinar (achado 158)", () => {
+    const erro = new Date(AGORA - 30_000);
+    expect(linhaDoConvite({ ...base, ultimo_erro: "a Meta recusou", ultimo_erro_em: erro }, AGORA, quando).aviso).toBe(
+      "A última tentativa falhou ([11-03T14:59]): a Meta recusou"
+    );
+    const usado = { ...base, usado_em: erro, conta_conectada: "178", conta_username: "drmarcus" };
+    expect(
+      linhaDoConvite(
+        { ...usado, ultimo_erro: `${PREFIXO_DA_ASSINATURA}a Meta caiu`, ultimo_erro_em: erro },
+        AGORA,
+        quando
+      ).aviso
+    ).toBe('conectada, mas a assinatura dos webhooks falhou: a Meta caiu. Use o botão "Reassinar webhooks" do passo 5.');
+    // O erro de uma tentativa ANTES da que deu certo não vira aviso no convite usado.
+    expect(
+      linhaDoConvite({ ...usado, ultimo_erro: "a Meta recusou", ultimo_erro_em: erro }, AGORA, quando).aviso
+    ).toBeNull();
+  });
+});
```

Em `testes-integracao/convites-tabela.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/convites-tabela.integracao.ts b/testes-integracao/convites-tabela.integracao.ts
index df2396b..917aa3d 100644
--- a/testes-integracao/convites-tabela.integracao.ts
+++ b/testes-integracao/convites-tabela.integracao.ts
@@ -123,6 +123,15 @@ describe("o repositório dos convites", () => {
     expect(Object.keys(lista[0])).not.toContain("codigo_hash");
   });
 
+  it("a lista traz o arroba da conta que entrou pelo convite", async () => {
+    const { id } = await repo.criarConvite("Dr. Marcus");
+    await repo.reivindicarEGravarConta(id, conta("token-1"));
+    await repo.criarConvite("pendente");
+    const lista = await repo.listarConvites();
+    expect(lista.find((c) => c.id === id)).toMatchObject({ conta_conectada: CONTA, conta_username: "conta_do_convite" });
+    expect(lista.find((c) => c.id !== id)).toMatchObject({ conta_conectada: null, conta_username: null });
+  });
+
   it("cancelar vale só para o pendente, uma vez", async () => {
     const { id } = await repo.criarConvite("Dr. Marcus");
     expect(await repo.cancelarConvite(id)).toBe(true);
```

Em `testes-integracao/convite.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/convite.integracao.ts b/testes-integracao/convite.integracao.ts
index 189ce13..7419717 100644
--- a/testes-integracao/convite.integracao.ts
+++ b/testes-integracao/convite.integracao.ts
@@ -5,13 +5,15 @@
 // AS ROTAS SÃO CHAMADAS COMO A VERCEL AS CHAMA: o handler de verdade, com um `NextRequest`. A sessão, quando
 // há, é a do login de verdade (`cabecalhoDaSessaoDeTeste`, ./semear-requisicao.ts). Valores inventados:
 // nenhuma credencial de verdade entra em teste.
+import { createHash } from "node:crypto";
 import { beforeAll, beforeEach, describe, expect, it } from "vitest";
 import { bancoDescartavel } from "./harness";
-import { cabecalhoDaSessaoDeTeste } from "./semear-requisicao";
+import { cabecalhoDaSessaoDeTeste, comoNumaRequisicaoComSessao } from "./semear-requisicao";
 
 type ModuloComeco = typeof import("@/app/api/oauth/convite/[codigo]/route");
 type ModuloLogin = typeof import("@/app/api/oauth/login/route");
 type ModuloRepositorio = typeof import("@/lib/convites-repositorio");
+type ModuloAcoes = typeof import("@/app/setup/actions");
 
 const banco = bancoDescartavel();
 
@@ -23,12 +25,14 @@ const COOKIE_DO_CONVITE = "metodochat_oauth_convite";
 let comeco: ModuloComeco;
 let login: ModuloLogin;
 let repo: ModuloRepositorio;
+let acoes: ModuloAcoes;
 let Pedido: typeof import("next/server").NextRequest;
 
 beforeAll(async () => {
   comeco = await import("@/app/api/oauth/convite/[codigo]/route");
   login = await import("@/app/api/oauth/login/route");
   repo = await import("@/lib/convites-repositorio");
+  acoes = await import("@/app/setup/actions");
   Pedido = (await import("next/server")).NextRequest;
   await banco.db().sql().query(`insert into config (id) values (1) on conflict do nothing`);
 });
@@ -128,3 +132,52 @@ describe("o começo da conexão de hoje, com a sessão", () => {
     expect(cookies(resposta).get(COOKIE_DO_STATE)).toBeTruthy();
   });
 });
+
+// ---------------------------------------------------------------------------------------------------
+// AS AÇÕES DA ETAPA 6
+// ---------------------------------------------------------------------------------------------------
+
+const formulario = (campos: Record<string, string>) => {
+  const fd = new FormData();
+  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
+  return fd;
+};
+
+const linhas = async () =>
+  (await banco.db().sql().query(`select * from convites_de_conexao order by criado_em`)) as Record<string, unknown>[];
+
+describe("as ações da etapa 6", () => {
+  it("gerar devolve o link no endereço canônico, uma vez, e grava só o hash do código", async () => {
+    const { valor, tags } = await comoNumaRequisicaoComSessao("/setup", () =>
+      acoes.gerarConvite(null, formulario({ para_quem: "  Dr. Marcus  " }))
+    );
+    expect(valor && "link" in valor).toBe(true);
+    const { link, paraQuem } = valor as { link: string; paraQuem: string };
+    expect(paraQuem).toBe("Dr. Marcus");
+    expect(link).toMatch(new RegExp(`^${APP_URL}/convite/[A-Za-z0-9_-]{43}$`));
+    const codigo = link.slice(link.lastIndexOf("/") + 1);
+    const [linha] = await linhas();
+    expect(linha.codigo_hash).toBe(createHash("sha256").update(codigo).digest("hex"));
+    expect(linha.para_quem).toBe("Dr. Marcus");
+    expect(tags.length).toBeGreaterThan(0);
+    // O link devolvido abre o convite.
+    expect(destino(await comecar(codigo)).origin).toBe("https://www.instagram.com");
+  });
+
+  it("gerar recusa o \"para quem\" vazio ou longo demais, sem gravar", async () => {
+    for (const para_quem of ["   ", "x".repeat(61)]) {
+      const { valor } = await comoNumaRequisicaoComSessao("/setup", () =>
+        acoes.gerarConvite(null, formulario({ para_quem }))
+      );
+      expect(valor).toEqual({ erro: "Diga para quem é o convite, em até 60 caracteres." });
+    }
+    expect(await linhas()).toHaveLength(0);
+  });
+
+  it("cancelar cancela o pendente, e o começo passa a recusar", async () => {
+    const { id, codigo } = await repo.criarConvite("Dr. Marcus");
+    await comoNumaRequisicaoComSessao("/setup", () => acoes.cancelarConvite(formulario({ id })));
+    expect((await linhas())[0].cancelado_em).toBeInstanceOf(Date);
+    expect(destino(await comecar(codigo)).toString()).toBe(`${APP_URL}/convite/${codigo}`);
+  });
+});
```

Crie `testes-dom/convites-no-setup.dom.tsx`:

```tsx
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// O `vi.mock` sobe para o topo do arquivo, antes de qualquer `const`: as duas ações de mentira nascem no
// `vi.hoisted`, que sobe junto.
const { gerarConvite, cancelarConvite } = vi.hoisted(() => ({ gerarConvite: vi.fn(), cancelarConvite: vi.fn() }));
vi.mock("@/app/setup/actions", () => ({ gerarConvite, cancelarConvite }));

import Convites from "@/app/setup/convites";
import type { LinhaDoConvite } from "@/lib/convites";

// O BLOCO DO LINK DE CONVITE NA ETAPA 6 (docs/specs/2026-11-03-link-de-convite.md): o formulário, o link que
// aparece uma vez, com o copiar, e a lista com os quatro estados. As ações são de mentira: o que elas
// gravam é conferido em testes-integracao/convite.integracao.ts.
const LINHAS: LinhaDoConvite[] = [
  { id: "1", paraQuem: "Dr. Marcus", estado: "pendente", detalhe: "vence em 10/11/2026, 12:00", aviso: null, cancelavel: true },
  {
    id: "2",
    paraQuem: "N8X",
    estado: "usado",
    detalhe: "@n8xmarketing, em 04/11/2026, 10:12",
    aviso: 'conectada, mas a assinatura dos webhooks falhou: x. Use o botão "Reassinar webhooks" do passo 5.',
    cancelavel: false,
  },
  { id: "3", paraQuem: "Antigo", estado: "vencido", detalhe: "venceu em 01/11/2026, 09:00", aviso: null, cancelavel: false },
  {
    id: "4",
    paraQuem: "Desistiu",
    estado: "cancelado",
    detalhe: "cancelado em 02/11/2026, 08:00",
    aviso: "A última tentativa falhou (02/11/2026, 07:59): a Meta recusou",
    cancelavel: false,
  },
];

beforeEach(() => {
  gerarConvite.mockReset();
  cancelarConvite.mockReset();
});

describe("o bloco do link de convite", () => {
  it("mostra o link uma vez, com o copiar e o aviso de que ele não volta", async () => {
    gerarConvite.mockResolvedValue({ link: "https://painel.exemplo.com.br/convite/abc", paraQuem: "Dr. Marcus" });
    render(<Convites linhas={[]} metaOk />);
    fireEvent.change(screen.getByLabelText("Para quem"), { target: { value: "Dr. Marcus" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Gerar link de convite" }));
    });
    expect(gerarConvite).toHaveBeenCalledTimes(1);
    expect((gerarConvite.mock.calls[0][1] as FormData).get("para_quem")).toBe("Dr. Marcus");
    expect(screen.getByText("https://painel.exemplo.com.br/convite/abc")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copiar" })).toBeTruthy();
    expect(screen.getByText("Este link aparece só agora. Se ele se perder, cancele e gere outro.")).toBeTruthy();
  });

  it("mostra o erro da ação, sem link", async () => {
    gerarConvite.mockResolvedValue({ erro: "Diga para quem é o convite, em até 60 caracteres." });
    render(<Convites linhas={[]} metaOk />);
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: "Gerar link de convite" }).closest("form")!);
    });
    expect(screen.getByRole("alert").textContent).toBe("Diga para quem é o convite, em até 60 caracteres.");
    expect(screen.queryByText(/Este link aparece só agora/)).toBeNull();
  });

  it("a lista mostra os quatro estados, o aviso de cada um e o cancelar só no pendente", () => {
    render(<Convites linhas={LINHAS} metaOk />);
    expect(screen.getByText(/vence em 10\/11\/2026, 12:00/)).toBeTruthy();
    expect(screen.getByText(/@n8xmarketing, em 04\/11\/2026, 10:12/)).toBeTruthy();
    expect(screen.getByText(/venceu em 01\/11\/2026, 09:00/)).toBeTruthy();
    expect(screen.getByText(/cancelado em 02\/11\/2026, 08:00/)).toBeTruthy();
    expect(screen.getByText(/Reassinar webhooks/)).toBeTruthy();
    expect(screen.getByText(/A última tentativa falhou/)).toBeTruthy();
    const cancelar = screen.getAllByRole("button", { name: "Cancelar" });
    expect(cancelar).toHaveLength(1);
    expect((cancelar[0].closest("form")!.querySelector('input[name="id"]') as HTMLInputElement).value).toBe("1");
  });

  it("sem o app da Meta configurado, o botão de gerar fica travado", () => {
    render(<Convites linhas={[]} metaOk={false} />);
    expect((screen.getByRole("button", { name: "Gerar link de convite" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
```

- [ ] **Passo 2: ver os testes falharem**

```bash
npx vitest run tests/convites.test.ts
npx vitest run --config vitest.dom.config.ts testes-dom/convites-no-setup.dom.tsx
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/convite.integracao.ts testes-integracao/convites-tabela.integracao.ts
```

Esperado: os 3 casos puros da linha caem (13 passam); a tela cai com `Failed to resolve import
"@/app/setup/convites"`; `ALVO: banco de TESTE` e 4 casos de integração caindo (o arroba na lista e as três
ações), com 14 passando.

- [ ] **Passo 3: a linha da etapa 6 e o prefixo da assinatura**

Em `lib/convites.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/convites.ts b/lib/convites.ts
index 461f452..89654cc 100644
--- a/lib/convites.ts
+++ b/lib/convites.ts
@@ -84,3 +84,60 @@ export function textoParaOPainel(texto: string, segredos: (string | null | undef
   for (const segredo of segredos) if (segredo) limpo = limpo.split(segredo).join("OCULTO");
   return limpo.length > LIMITE_DO_ERRO ? limpo.slice(0, LIMITE_DO_ERRO) : limpo;
 }
+
+// A ASSINATURA DOS WEBHOOKS QUE FALHA DEPOIS DA CONEXÃO (achado 158): a volta anota este começo no convite
+// já usado, e a linha da etapa 6 o reconhece para apontar o "Reassinar webhooks".
+export const PREFIXO_DA_ASSINATURA = "conectada, mas a assinatura dos webhooks falhou: ";
+
+export const FRASE_DO_PARA_QUEM_INVALIDO = "Diga para quem é o convite, em até 60 caracteres.";
+
+/** O que a ação de gerar devolve à etapa 6: o link, que só existe nesta resposta, ou a recusa. */
+export type EstadoDoGerar = { link: string; paraQuem: string } | { erro: string } | null;
+
+export type ConviteParaLinha = DatasDoConvite & {
+  id: string;
+  para_quem: string;
+  conta_conectada: string | null;
+  conta_username: string | null;
+  ultimo_erro: string | null;
+  ultimo_erro_em: Date | string | null;
+};
+
+export type LinhaDoConvite = {
+  id: string;
+  paraQuem: string;
+  estado: EstadoDoConvite;
+  detalhe: string;
+  aviso: string | null;
+  cancelavel: boolean;
+};
+
+/**
+ * Uma linha da lista da etapa 6. `quando` formata a data (no painel, o `fmtDate` de lib/format.ts). O
+ * erro de uma tentativa ANTES da que deu certo não vira aviso no convite usado: ali, só a assinatura que
+ * falhou depois da conexão importa.
+ */
+export function linhaDoConvite(
+  c: ConviteParaLinha,
+  agoraMs: number,
+  quando: (d: Date | string | null) => string
+): LinhaDoConvite {
+  const estado = estadoDoConvite(c, agoraMs);
+  const detalhe =
+    estado === "pendente"
+      ? `vence em ${quando(c.expira_em)}`
+      : estado === "usado"
+        ? `@${c.conta_username ?? c.conta_conectada}, em ${quando(c.usado_em)}`
+        : estado === "vencido"
+          ? `venceu em ${quando(c.expira_em)}`
+          : `cancelado em ${quando(c.cancelado_em)}`;
+  let aviso: string | null = null;
+  if (c.ultimo_erro && estado === "usado") {
+    if (c.ultimo_erro.startsWith(PREFIXO_DA_ASSINATURA)) {
+      aviso = `${c.ultimo_erro}. Use o botão "Reassinar webhooks" do passo 5.`;
+    }
+  } else if (c.ultimo_erro) {
+    aviso = `A última tentativa falhou (${quando(c.ultimo_erro_em)}): ${c.ultimo_erro}`;
+  }
+  return { id: c.id, paraQuem: c.para_quem, estado, detalhe, aviso, cancelavel: estado === "pendente" };
+}
```

Em `app/api/oauth/callback/convite.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/api/oauth/callback/convite.ts b/app/api/oauth/callback/convite.ts
index 6bae63b..e961ad0 100644
--- a/app/api/oauth/callback/convite.ts
+++ b/app/api/oauth/callback/convite.ts
@@ -9,7 +9,7 @@ import { OAUTH_CONVITE_COOKIE, OAUTH_STATE_COOKIE, oauthStateConfere } from "@/l
 import { getConfig } from "@/lib/db";
 import { logEvent } from "@/lib/engine";
 import { canonicalAppUrl } from "@/lib/app-url";
-import { estadoDoConvite, textoParaOPainel, type MotivoDoErro } from "@/lib/convites";
+import { estadoDoConvite, PREFIXO_DA_ASSINATURA, textoParaOPainel, type MotivoDoErro } from "@/lib/convites";
 import { anotarErroDoConvite, conviteDoId, reivindicarEGravarConta } from "@/lib/convites-repositorio";
 
 // A VOLTA DO INSTAGRAM PELO LINK DE CONVITE (docs/specs/2026-11-03-link-de-convite.md). A rota da volta
@@ -112,7 +112,7 @@ export async function voltaDoConvite(req: NextRequest, conviteId: string): Promi
   try {
     await subscribeToWebhooks(conta.ig_user_id, conta.access_token);
   } catch (err) {
-    const aviso = textoParaOPainel(`conectada, mas a assinatura dos webhooks falhou: ${mensagem(err)}`, segredos);
+    const aviso = textoParaOPainel(`${PREFIXO_DA_ASSINATURA}${mensagem(err)}`, segredos);
     await anotar(aviso, "usado");
     try {
       await logEvent(conta.ig_user_id, "subscribe_failed", { message: aviso });
```

- [ ] **Passo 4: o arroba na lista**

Em `lib/convites-repositorio.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/convites-repositorio.ts b/lib/convites-repositorio.ts
index a6d9cc4..bcefdea 100644
--- a/lib/convites-repositorio.ts
+++ b/lib/convites-repositorio.ts
@@ -21,6 +21,9 @@ export type Convite = {
 
 const COLUNAS =
   "id, para_quem, criado_em, expira_em, cancelado_em, usado_em, conta_conectada, ultimo_erro, ultimo_erro_em";
+const COLUNAS_DA_LISTA = COLUNAS.split(", ")
+  .map((coluna) => `c.${coluna}`)
+  .join(", ");
 
 // O id chega da volta do Instagram num cookie, e um valor torto não pode virar erro de banco.
 const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
@@ -51,11 +54,18 @@ export async function conviteDoId(id: string): Promise<Convite | null> {
   return linha ?? null;
 }
 
+/** O convite da lista, com o arroba da conta que entrou por ele, quando entrou. */
+export type ConviteNaLista = Convite & { conta_username: string | null };
+
 /** Os 20 mais recentes, para a lista da etapa 6. */
-export async function listarConvites(): Promise<Convite[]> {
+export async function listarConvites(): Promise<ConviteNaLista[]> {
   return (await sql().query(
-    `select ${COLUNAS} from convites_de_conexao order by criado_em desc, id desc limit 20`
-  )) as Convite[];
+    `select ${COLUNAS_DA_LISTA}, a.username as conta_username
+       from convites_de_conexao c
+       left join accounts a on a.ig_user_id = c.conta_conectada
+      order by c.criado_em desc, c.id desc
+      limit 20`
+  )) as ConviteNaLista[];
 }
 
 /** Só o pendente é cancelado. Devolve se cancelou. */
```

- [ ] **Passo 5: as duas ações**

Em `app/setup/actions.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/setup/actions.ts b/app/setup/actions.ts
index b934d07..b675b9e 100644
--- a/app/setup/actions.ts
+++ b/app/setup/actions.ts
@@ -14,6 +14,8 @@ import {
   type LinhaDoFormulario,
 } from "./portas";
 import { exigirSessao } from "@/lib/exigir-sessao";
+import { FRASE_DO_PARA_QUEM_INVALIDO, paraQuemDoFormulario, type EstadoDoGerar } from "@/lib/convites";
+import { cancelarConvite as cancelarNoBanco, criarConvite } from "@/lib/convites-repositorio";
 
 // Reassina `CAMPOS_DE_WEBHOOK` (lib/ig.ts) em todas as contas conectadas. A
 // assinatura já acontece sozinha no OAuth, mas se falhar naquele momento nada
@@ -324,3 +326,28 @@ export async function salvarPerguntasDeAbertura(formData: FormData): Promise<voi
     )}`
   );
 }
+
+// O LINK DE CONVITE (docs/specs/2026-11-03-link-de-convite.md): gera o código, grava só o hash e devolve o
+// link UMA VEZ, no estado da ação. O link não vai para a URL nem para o log, e não pode ser mostrado de
+// novo. Ele nasce no endereço canônico, e não no de onde o painel foi aberto: o cookie do `state` só volta
+// junto se o começo acontecer no endereço da volta (achado 136).
+export async function gerarConvite(_anterior: EstadoDoGerar, formData: FormData): Promise<EstadoDoGerar> {
+  await exigirSessao();
+  const paraQuem = paraQuemDoFormulario(formData.get("para_quem"));
+  if (!paraQuem) return { erro: FRASE_DO_PARA_QUEM_INVALIDO };
+  const config = await getConfig();
+  const h = await headers();
+  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
+  const proto = h.get("x-forwarded-proto") ?? "https";
+  const appUrl = canonicalAppUrl(config.app_url, host ? `${proto}://${host}` : "");
+  const { codigo } = await criarConvite(paraQuem);
+  revalidatePath("/setup");
+  return { link: `${appUrl}/convite/${codigo}`, paraQuem };
+}
+
+// Só o pendente é cancelado; o resto fica como está, e a lista mostra o estado de verdade.
+export async function cancelarConvite(formData: FormData): Promise<void> {
+  await exigirSessao();
+  await cancelarNoBanco(String(formData.get("id") ?? ""));
+  revalidatePath("/setup");
+}
```

- [ ] **Passo 6: o bloco e a lista na etapa 6**

Crie `app/setup/convites.tsx`:

```tsx
"use client";
import { useActionState } from "react";
import CopyField from "./copy-field";
import { cancelarConvite, gerarConvite } from "./actions";
import type { EstadoDoGerar, LinhaDoConvite } from "@/lib/convites";
import { alertError, btnPrimary, btnSecondary, input, label, muted } from "../ui";

// O LINK DE CONVITE NA ETAPA 6 (docs/specs/2026-11-03-link-de-convite.md): o cliente abre o link no
// computador e conecta a própria conta, sem a senha do painel. O link aparece UMA VEZ, no estado da ação,
// porque o banco guarda só o hash do código.
const ROTULO: Record<LinhaDoConvite["estado"], string> = {
  pendente: "pendente",
  usado: "usado",
  vencido: "vencido",
  cancelado: "cancelado",
};

export default function Convites({ linhas, metaOk }: { linhas: LinhaDoConvite[]; metaOk: boolean }) {
  const [estado, gerar, gerando] = useActionState<EstadoDoGerar, FormData>(gerarConvite, null);

  return (
    <div className="space-y-3 border-t border-traco pt-3 dark:border-traco-escuro">
      <p className="font-medium text-zinc-800 dark:text-zinc-200">Ou mande um link de convite ao cliente</p>
      <p className={`text-xs ${muted}`}>
        O cliente abre o link no computador e conecta a própria conta, sem a senha do painel e sem passar a
        senha do Instagram a ninguém. O link vale 7 dias e serve para uma conexão. A conta dele precisa estar
        como <b>Testador do Instagram</b> no seu app da Meta (etapa 5) antes.
      </p>
      <form action={gerar} className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <label htmlFor="convite-para-quem" className={label}>
            Para quem
          </label>
          <input
            id="convite-para-quem"
            name="para_quem"
            maxLength={60}
            placeholder="Ex.: Dr. Marcus"
            className={input}
          />
        </div>
        <button type="submit" disabled={!metaOk || gerando} className={btnPrimary}>
          Gerar link de convite
        </button>
      </form>
      {estado && "erro" in estado && (
        <p role="alert" className={alertError}>
          {estado.erro}
        </p>
      )}
      {estado && "link" in estado && (
        <div className="space-y-1">
          <CopyField label={`Link de convite para ${estado.paraQuem}`} value={estado.link} />
          <p className={`text-xs ${muted}`}>Este link aparece só agora. Se ele se perder, cancele e gere outro.</p>
        </div>
      )}
      {linhas.length > 0 && (
        <ul className="space-y-2">
          {linhas.map((l) => (
            <li
              key={l.id}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0">
                  <b>{l.paraQuem}</b> · {ROTULO[l.estado]} · {l.detalhe}
                </p>
                {l.cancelavel && (
                  <form action={cancelarConvite}>
                    <input type="hidden" name="id" value={l.id} />
                    <button type="submit" className={btnSecondary}>
                      Cancelar
                    </button>
                  </form>
                )}
              </div>
              {l.aviso && <p className={`mt-1 text-xs ${muted}`}>{l.aviso}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

Em `app/setup/page.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/setup/page.tsx b/app/setup/page.tsx
index 3b5852a..cde77b0 100644
--- a/app/setup/page.tsx
+++ b/app/setup/page.tsx
@@ -13,6 +13,9 @@ import SubmitButton from "./submit-button";
 import { IconAlert } from "../icons";
 import Avatar from "../avatar";
 import { fmtDate } from "@/lib/format";
+import { linhaDoConvite } from "@/lib/convites";
+import { listarConvites } from "@/lib/convites-repositorio";
+import Convites from "./convites";
 import { card, input, muted, btnPrimary, alertError, alertOk, link } from "../ui";
 
 export const dynamic = "force-dynamic";
@@ -96,6 +99,12 @@ export default async function SetupPage({
   const connected = accounts.length > 0;
   const eventRows = (await sql()`select count(*)::int as n from events`) as { n: number }[];
   const hasEvents = (eventRows[0]?.n ?? 0) > 0;
+  // OS CONVITES DA ETAPA 6 (docs/specs/2026-11-03-link-de-convite.md). Server Component `async`: roda UMA
+  // vez por requisição, e ler o relógio aqui é o comportamento pedido. A regra trata todo arquivo como
+  // cliente; o dono silencia do mesmo jeito, com o motivo por extenso, em app/page.tsx:322-333.
+  // eslint-disable-next-line react-hooks/purity
+  const agora = Date.now();
+  const convites = (await listarConvites()).map((c) => linhaDoConvite(c, agora, fmtDate));
 
   const inputCls = input;
 
@@ -506,6 +515,7 @@ export default async function SetupPage({
               autorizar aqui.
             </p>
           )}
+          <Convites linhas={convites} metaOk={metaOk} />
         </Step>
 
         <Step
```

- [ ] **Passo 7: ver passar**

```bash
npx vitest run tests/convites.test.ts tests/sessao-nas-actions.test.ts
npx vitest run --config vitest.dom.config.ts testes-dom/convites-no-setup.dom.tsx testes-dom/convite-sem-menu.dom.tsx
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/convite.integracao.ts testes-integracao/convites-tabela.integracao.ts testes-integracao/convite-volta.integracao.ts
npx eslint lib/convites.ts lib/convites-repositorio.ts app/api/oauth/callback/convite.ts app/setup/actions.ts app/setup/convites.tsx app/setup/page.tsx tests/convites.test.ts testes-integracao/convite.integracao.ts testes-integracao/convites-tabela.integracao.ts testes-dom/convites-no-setup.dom.tsx
npx tsc --noEmit
```

Esperado: 2 arquivos e 23 casos puros; 2 arquivos e 8 casos de tela; `ALVO: banco de TESTE`, 3 arquivos e 26
casos de integração; lint e `tsc` limpos. Varra os dez arquivos.

- [ ] **Passo 8: o commit**

A mensagem do commit, gravada em `$SCRATCH/msg-conv-f6.txt`:

```text
A etapa 6 gera o link de convite e lista os convites com o estado de cada um

O botão "Gerar link de convite", com o campo "Para quem", grava só o hash
do código e mostra o link uma vez, com o copiar, no endereço canônico. A lista
dos 20 mais recentes diz quando o pendente vence (com o cancelar), qual conta
entrou pelo usado e quando o vencido e o cancelado deixaram de valer. A
tentativa que falhou aparece com a hora, e a assinatura dos webhooks que
falhou depois da conexão aponta o "Reassinar webhooks" do passo 5.
```

```bash
git add lib/convites.ts lib/convites-repositorio.ts app/api/oauth/callback/convite.ts app/setup/actions.ts app/setup/convites.tsx app/setup/page.tsx tests/convites.test.ts testes-integracao/convite.integracao.ts testes-integracao/convites-tabela.integracao.ts testes-dom/convites-no-setup.dom.tsx
git commit -F "$SCRATCH/msg-conv-f6.txt"
```


---

### FASE 6-bis — O bloco do convite à vista (achado 163, na execução)

**Arquivos:** `app/setup/page.tsx`, `app/setup/convites.tsx`, `tests/convite-a-vista.test.ts` (novo).

- [ ] **Passo 1: o teste, antes do código** (lê a página pela árvore do TypeScript)

Crie `tests/convite-a-vista.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// O BLOCO DO LINK DE CONVITE À VISTA (achado 163, decidido pelo Eduardo em 03/11/2026). Com a instalação toda
// concluída, as etapas da Configuração nascem recolhidas num <details> "Instalação" (app/setup/page.tsx), e o
// convite, que estava na etapa 6, ficava escondido lá dentro: para gerar um link, era preciso abrir o bloco. O
// convite passou a morar numa seção própria, fora de qualquer <details>, e este teste lê a página pela árvore do
// TypeScript para isso não voltar sem ninguém ver.
const PAGINA = fileURLToPath(new URL("../app/setup/page.tsx", import.meta.url));

function jsxDoConvite(fonte: string, arquivo = "page.tsx"): { quantos: number; dentroDeDetails: number } {
  const sf = ts.createSourceFile(arquivo, fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let quantos = 0;
  let dentroDeDetails = 0;
  const nome = (n: ts.Node) =>
    ts.isJsxSelfClosingElement(n) || ts.isJsxOpeningElement(n) ? n.tagName.getText(sf) : null;
  const visitar = (n: ts.Node) => {
    if (nome(n) === "Convites") {
      quantos++;
      for (let p = n.parent; p; p = p.parent) {
        if (ts.isJsxElement(p) && p.openingElement.tagName.getText(sf) === "details") {
          dentroDeDetails++;
          break;
        }
      }
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return { quantos, dentroDeDetails };
}

describe("o bloco do convite na Configuração (achado 163)", () => {
  it("o leitor acusa o convite dentro de um <details>, e não acusa o de fora", () => {
    expect(jsxDoConvite("const a = <details><summary>x</summary><div><Convites linhas={[]} /></div></details>;")).toEqual({
      quantos: 1,
      dentroDeDetails: 1,
    });
    expect(jsxDoConvite("const a = <section><Convites linhas={[]} /></section>;")).toEqual({ quantos: 1, dentroDeDetails: 0 });
  });

  it("a página desenha o convite uma vez só, fora do bloco Instalação recolhido", () => {
    expect(jsxDoConvite(readFileSync(PAGINA, "utf8"))).toEqual({ quantos: 1, dentroDeDetails: 0 });
  });
});
```

- [ ] **Passo 2: ver o teste falhar**

```bash
npx vitest run tests/convite-a-vista.test.ts
```

Esperado: o caso do leitor passa, e "a página desenha o convite uma vez só, fora do bloco Instalação recolhido"
cai com `expected { quantos: 1, dentroDeDetails: 1 } to deeply equal { quantos: 1, dentroDeDetails: +0 }`.

- [ ] **Passo 3: a seção "Convidar um cliente", fora do "Instalação"**

Em `app/setup/page.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/setup/page.tsx b/app/setup/page.tsx
index cde77b0..2d5c087 100644
--- a/app/setup/page.tsx
+++ b/app/setup/page.tsx
@@ -209,6 +209,15 @@ export default async function SetupPage({
         </section>
       )}
 
+      {/* O LINK DE CONVITE, À VISTA (achado 163, decidido pelo Eduardo em 03/11/2026). Ele nasceu na etapa 6,
+          ao lado do "Conectar outra conta", mas com a instalação concluída o bloco abaixo nasce recolhido, e o
+          botão ficava escondido lá dentro. Mora aqui, fora do <details>, e tests/convite-a-vista.test.ts cobra
+          isso. */}
+      <section className={`p-5 ${card}`}>
+        <h3 className="mb-1 text-sm font-semibold text-zinc-800 dark:text-zinc-200">Convidar um cliente</h3>
+        <Convites linhas={convites} metaOk={metaOk} />
+      </section>
+
       {/* A INSTALAÇÃO INTEIRA, RECOLHIDA QUANDO JÁ TERMINOU.
 
           Medido em 31/08/2026 nesta tela, em produção: 6341 px de página
@@ -515,7 +524,9 @@ export default async function SetupPage({
               autorizar aqui.
             </p>
           )}
-          <Convites linhas={convites} metaOk={metaOk} />
+          <p className={`text-xs ${muted}`}>
+            Para o cliente conectar a própria conta, use o <b>Convidar um cliente</b>, acima.
+          </p>
         </Step>
 
         <Step
```

Em `app/setup/convites.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/setup/convites.tsx b/app/setup/convites.tsx
index 94a0083..0579449 100644
--- a/app/setup/convites.tsx
+++ b/app/setup/convites.tsx
@@ -19,8 +19,7 @@ export default function Convites({ linhas, metaOk }: { linhas: LinhaDoConvite[];
   const [estado, gerar, gerando] = useActionState<EstadoDoGerar, FormData>(gerarConvite, null);
 
   return (
-    <div className="space-y-3 border-t border-traco pt-3 dark:border-traco-escuro">
-      <p className="font-medium text-zinc-800 dark:text-zinc-200">Ou mande um link de convite ao cliente</p>
+    <div className="space-y-3">
       <p className={`text-xs ${muted}`}>
         O cliente abre o link no computador e conecta a própria conta, sem a senha do painel e sem passar a
         senha do Instagram a ninguém. O link vale 7 dias e serve para uma conexão. A conta dele precisa estar
```

- [ ] **Passo 4: ver passar**

```bash
npx vitest run tests/convite-a-vista.test.ts
npx vitest run --config vitest.dom.config.ts testes-dom/convites-no-setup.dom.tsx testes-dom/convite-sem-menu.dom.tsx
npx eslint app/setup/page.tsx app/setup/convites.tsx tests/convite-a-vista.test.ts
npx tsc --noEmit
```

Esperado: 2 casos puros; 2 arquivos e 8 casos de tela; lint e `tsc` limpos. Varra os três arquivos.

- [ ] **Passo 5: o commit**

A mensagem do commit, gravada em `$SCRATCH/msg-conv-163.txt`:

```text
O link de convite fica à vista na Configuração, fora da instalação recolhida

Com a instalação toda concluída, as etapas da Configuração nascem recolhidas
no bloco Instalação, e o convite, que estava na etapa 6, ficava escondido lá
dentro: para gerar um link, era preciso abrir o bloco. Medido na prova do
preview e decidido pelo Eduardo em 03/11 (achado 163), ele passa a morar numa
seção própria, Convidar um cliente, antes do bloco, e a etapa 6 aponta para
ela. Um teste lê a página e cobra o convite fora de qualquer details.
```

```bash
git add app/setup/page.tsx app/setup/convites.tsx tests/convite-a-vista.test.ts
git commit -F "$SCRATCH/msg-conv-163.txt"
```

---

### FASE 7 — A verificação inteira, as mutações e a guarda do diff

- [ ] **Passo 1: o `verify`, com o build**

```bash
env -u CLAUDECODE -u AI_AGENT npm run verify
git diff --stat AGENTS.md
```

Esperado (medido em 03/11 no `1e75167`, com o 163): lint e `tsc` limpos; 140 arquivos e 3 566 casos puros; 30 arquivos e 293 de tela; "SEM VAZAMENTO em A
nem em C, nas duas varreduras."; "MIGRAÇÃO PULADA"; "▲ Next.js 16.4.3 (Turbopack)" e "Compiled successfully",
com `/api/oauth/convite/[codigo]`, `/convite/[codigo]`, `/convite/erro` e `/convite/pronto` entre as 42 rotas; e
nenhuma diferença no `AGENTS.md`.

- [ ] **Passo 2: a integração inteira, sozinha no container**

```bash
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npm run test:integracao
```

Esperado: `[rede-global] ALVO: banco de TESTE`, nenhum `teste_tmp_*` antes e depois, 57 arquivos, 634 passaram e
8 pularam. Antes de rodar, confira que nenhum outro `vitest` está rodando.

- [ ] **Passo 3: as mutações do Apêndice A**, com a árvore commitada e limpa

```bash
node "$SCRATCH/mutar-convite.mjs"
```

Esperado: as 52 mutações derrubando, cada uma, o caso nomeado, e "52 mutações, 0 ruins; árvore no fim:
limpa". A 52ª é a A8, do 163.

- [ ] **Passo 4: a guarda do diff**

```bash
git diff --stat ce83e8a HEAD -- . ':!docs'
git diff ce83e8a HEAD -- lib/steps.ts lib/db.ts
git diff --quiet ce83e8a HEAD -- lib/engine.ts lib/queue-drain.ts lib/bonus app/bonus app/publicar lib/publicacao.ts lib/bucket.ts scripts package.json package-lock.json && echo "guarda: 0 diferença"
```

Esperado: os 30 arquivos do mapa e nenhum outro (1 935 linhas a mais e 13 a menos, com o 163); em `lib/steps.ts`, só o
`export` do `semSegredo`; em `lib/db.ts`, só o `upsertAccount` com o segundo parâmetro; e "guarda: 0 diferença".

---

### FASE 8 — A 021 na produção, o push, o preview, o PR e a prova

Cada escrita em produção tem o OK do Eduardo, pela caixa, e a auditoria lê o banco antes e depois (avisada
com a hora). O preview usa o banco de produção. **Nenhum post, nenhuma DM.**

- [ ] **Passo 1: a linha de base da auditoria**, só de leitura, antes da 021: o registro com 21 migrações e a
  ausência de `convites_de_conexao`.

- [ ] **Passo 2: o ensaio a seco da 021**, da raiz da cópia, com a `DATABASE_URL` do `.env.local` do
  repositório principal levada só ao processo, sem imprimir nada dela:

```bash
node --env-file="<raiz do repositório principal>/.env.local" scripts/migrar.mjs --a-mao
```

Esperado: só a `021-convites-de-conexao.sql` como pendente, sem aplicar nada.

- [ ] **Passo 3: aplicar à mão, com o OK do Eduardo** e o "pode" da auditoria depois de ela ter a hora

```bash
node --env-file="<raiz do repositório principal>/.env.local" scripts/migrar.mjs --aplicar --a-mao
node --env-file="<raiz do repositório principal>/.env.local" scripts/migrar.mjs --a-mao
```

Esperado: a primeira aplica e anota a `021`, e a segunda diz "já aplicada". A soma registrada é a da FASE 2
(`8994f28aeb62`). A auditoria lê de novo, só lendo: o `relrowsecurity` da tabela nova = true; o
`has_table_privilege` de `anon` e de `authenticated` = false para select, insert, update e delete; e 0 linhas.
O código da `main` não lê a tabela, e por isso aplicá-la antes não muda nada na produção.

- [ ] **Passo 4: o push da branch, com o OK do Eduardo**

```bash
git ls-remote origin refs/heads/link-de-convite
git push -u origin link-de-convite
```

Se a branch já existir no GitHub, pare. No log do build do preview, confira: o commit, nenhum aviso do Node 26,
"Detected Next.js version: 16.4.3", "MIGRAÇÃO PULADA" e as rotas `/convite/[codigo]`, `/convite/pronto`,
`/convite/erro` e `/api/oauth/convite/[codigo]`.

- [ ] **Passo 5: a prova no preview, com o Eduardo**, e a hora à auditoria antes de cada gravação. O roteiro do
  navegador abre o preview num perfil próprio do Chrome (o Eduardo entra à mão; o roteiro nunca vê a senha), e
  o perfil é apagado no fim.
  1. Na etapa 6, gerar um convite para "Prova do convite" (grava 1 linha): o link aparece uma vez, no endereço
     canônico. A auditoria confere a linha, com o hash e sem o código.
  2. Abrir o MESMO caminho (`/convite/<código>`) no endereço do preview, numa janela anônima: o passo a passo,
     sem o "para quem".
  3. Os três cabeçalhos medidos na resposta de verdade, pelo `response.headers()` do Playwright: na página e
     no 302 do `/api/oauth/convite/<código>`. O `curl` não serve aqui: o preview está atrás da proteção da
     Vercel, e ele receberia a resposta dela.
  4. "Conectar meu Instagram": a tela de autorização do Instagram, **e parar ali**. A volta registrada na Meta
     é a da produção, que ainda não conhece o convite, e o cookie do `state` ficou no endereço do preview.
  5. Cancelar o convite na etapa 6 (grava) e abrir a página de novo: "Este link não vale mais. Peça um novo a
     quem te mandou."

  **Feita em 03/11, das 18:22Z às 18:42Z** (`navegador-prova/prova-convite.mjs`, `d4b1e689`, no deploy
  `dpl_3heM4zye` de `a7d6d85`), com cada gravação liberada pelo Eduardo e pela auditoria. O convite da prova
  (`344b162c`) foi gerado às 18:31Z e cancelado às 18:40Z, e fica no banco como histórico. Duas paradas antes de
  gravar (o "Instalação" recolhido, que virou o 163, e um resumo de dentro dele pego pelo localizador) e uma no
  meio (um clique do Eduardo na janela, no "Conectar meu Instagram", que mostrou o botão funcionando) foram
  resolvidas sem gravar nada. Os cabeçalhos medidos estão no 164.

- [ ] **Passo 6: o PR**, com o OK do Eduardo. O corpo leva o que muda, os efeitos e os números deste plano, e
  nenhuma arroba solta. O merge é do Eduardo.

- [ ] **Passo 7: o deploy do merge.** No log: "Nada a aplicar: as 22 migrações já constam no registro.", sem
  o aviso do Node 26. O site: `/entrar` dá 200, e o cron sem senha dá 401. E os três cabeçalhos, agora pelo
  `curl -I`, que funciona na produção porque o `/convite` é público:

```bash
curl -sI https://metodochat.vercel.app/convite/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa | grep -iE "referrer-policy|cache-control|x-robots-tag"
curl -sI https://metodochat.vercel.app/entrar | grep -iE "referrer-policy|cache-control|x-robots-tag"
```

Esperado (164): na página, o `Referrer-Policy: no-referrer` e o `X-Robots-Tag: noindex`, que o `/entrar` não tem; o
`Cache-Control` da página é o do Next para página dinâmica, com o `no-store` entre as diretivas.

- [ ] **Passo 8: a prova na produção, com o OK do Eduardo**, e o antes e o depois da auditoria: gerar um
  convite, abrir numa janela anônima e reconectar a `@saas.metodoia`, a conta de teste que já está conectada.
  O esperado: o convite usado com a `conta_conectada` dela, o token renovado, a página "Pronto" e as outras
  contas intactas.

---

## Apêndice A — As mutações

Rode da raiz da cópia, com a árvore commitada e limpa (`node "$SCRATCH/mutar-convite.mjs"`). Cada mutação tira
uma proteção, roda o arquivo de teste que a cobre e confere que o caso nomeado caiu. O arquivo volta pelo git
depois de cada uma. A integração só roda contra o container: uma `DATABASE_URL` no ambiente recusa a rodada,
e a saída tem de dizer `[rede-global] ALVO: banco de TESTE`.

Duas proteções não ganham mutação, porque tirá-las não muda o que se vê: o `codigoBemFormado` antes da
consulta (o hash de um código torto não acha linha nenhuma, e ele só poupa a ida ao banco) e o `UUID.test` do
`cancelarConvite` e do `anotarErroDoConvite` (o id vem do próprio painel ou do cookie que o começo gravou; o do
`conviteDoId`, que lê o cookie na volta, tem a mutação R10).

```js
// AS MUTAÇÕES DO LINK DE CONVITE (docs/specs/2026-11-03-link-de-convite.md): cada uma tira uma proteção,
// roda o arquivo de teste que a cobre e confere que o caso nomeado caiu. O arquivo volta pelo git depois de
// cada uma, então roda com a árvore COMMITADA e limpa. Roda da raiz da cópia.
//
// A INTEGRAÇÃO SÓ RODA CONTRA O CONTAINER: a DATABASE_URL_TESTES é posta aqui, uma DATABASE_URL no ambiente
// RECUSA a rodada, e a saída tem de dizer "[rede-global] ALVO: banco de TESTE", senão a mutação conta como ruim.
import { execSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

if (process.env.DATABASE_URL) {
  console.log("RECUSADO: há DATABASE_URL no ambiente. As mutações só rodam contra o banco de teste.");
  process.exit(9);
}
if (execSync("git status --porcelain", { encoding: "utf8" }).split("\n").some((l) => l.trim() && l !== "?? .env.local")) {
  console.log("RECUSADO: a árvore não está limpa; as mutações voltam pelo git.");
  process.exit(9);
}

const TESTES = "postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes";
const puro = (arquivo) => ({ args: ["vitest", "run", arquivo], integ: false });
const dom = (arquivo) => ({ args: ["vitest", "run", "--config", "vitest.dom.config.ts", arquivo], integ: false });
const integ = (arquivo) => ({
  args: ["vitest", "run", "--config", "vitest.integracao.config.ts", arquivo],
  integ: true,
});

const T_PURO = puro("tests/convites.test.ts");
const T_PUBLICO = puro("tests/convite-publico.test.ts");
const T_SESSAO = puro("tests/sessao-nas-actions.test.ts");
const T_MENU = dom("testes-dom/convite-sem-menu.dom.tsx");
const T_SETUP = dom("testes-dom/convites-no-setup.dom.tsx");
const T_TABELA = integ("testes-integracao/convites-tabela.integracao.ts");
const T_CONVITE = integ("testes-integracao/convite.integracao.ts");
const T_VOLTA = integ("testes-integracao/convite-volta.integracao.ts");
const T_PAGINAS = integ("testes-integracao/convite-paginas.integracao.ts");
const T_A_VISTA = puro("tests/convite-a-vista.test.ts");

const L = "lib/convites.ts";
const R = "lib/convites-repositorio.ts";
const M = "migrations/021-convites-de-conexao.sql";
const C = "app/api/oauth/convite/[codigo]/route.ts";
const V = "app/api/oauth/callback/convite.ts";
const A = "app/setup/actions.ts";

const mutacoes = [
  // AS REGRAS PURAS
  { nome: "L1: o código com 31 bytes", arq: L, de: /randomBytes\(32\)/, para: "randomBytes(31)", teste: T_PURO, cai: "tem 32 bytes em base64url" },
  { nome: "L2: o hash vira SHA-1", arq: L, de: /createHash\("sha256"\)/, para: 'createHash("sha1")', teste: T_PURO, cai: "o banco guarda o SHA-256 em hex" },
  { nome: "L3: o formato aceita 44 caracteres", arq: L, de: /\{43\}\$\//, para: "{43,44}$/", teste: T_PURO, cai: "recusa o que não tem o formato" },
  { nome: "L4: o prazo perde o igual", arq: L, de: /getTime\(\) <= agoraMs\) return "vencido"/, para: 'getTime() < agoraMs) return "vencido"', teste: T_PURO, cai: "vence no próprio instante do prazo" },
  { nome: "L5: o usado passa na frente do cancelado", arq: L, de: /if \(c\.cancelado_em\) return "cancelado";(\r?\n)\s*if \(c\.usado_em\) return "usado";/, para: 'if (c.usado_em) return "usado";$1  if (c.cancelado_em) return "cancelado";', teste: T_PURO, cai: "o cancelado vence o usado" },
  { nome: "L6: o \"para quem\" conta UTF-16", arq: L, de: /Array\.from\(texto\)\.length/, para: "texto.length", teste: T_PURO, cai: "conta caractere, e não pedaço de UTF-16" },
  { nome: "L7: o limite do \"para quem\" vira 61", arq: L, de: /LIMITE_DO_PARA_QUEM = 60;/, para: "LIMITE_DO_PARA_QUEM = 61;", teste: T_PURO, cai: "recusa o vazio, só espaços, 61 caracteres" },
  { nome: "L8: qualquer motivo vira frase", arq: L, de: /\? \(valor as MotivoDoErro\) : "falhou"/, para: '? (valor as MotivoDoErro) : (valor as MotivoDoErro)', teste: T_PURO, cai: "só os três motivos da lista viram frase" },
  { nome: "L9: o texto do erro sem trocar os segredos da volta", arq: L, de: /\s*for \(const segredo of segredos\) if \(segredo\) limpo = limpo\.split\(segredo\)\.join\("OCULTO"\);/, para: "", teste: T_PURO, cai: "troca os segredos por OCULTO" },
  { nome: "L10: o texto do erro sem o semSegredo", arq: L, de: /let limpo = semSegredo\(texto\);/, para: "let limpo = texto;", teste: T_PURO, cai: "troca os segredos por OCULTO" },
  { nome: "L11: o corte de 160 tirado", arq: L, de: /return limpo\.length > LIMITE_DO_ERRO \? limpo\.slice\(0, LIMITE_DO_ERRO\) : limpo;/, para: "return limpo;", teste: T_PURO, cai: "corta em 160 caracteres" },
  { nome: "L12: o erro antigo vira aviso no convite usado", arq: L, de: /if \(c\.ultimo_erro\.startsWith\(PREFIXO_DA_ASSINATURA\)\) \{/, para: "if (true) {", teste: T_PURO, cai: "a tentativa que falhou aparece com a hora" },
  { nome: "L13: todo convite se cancela", arq: L, de: /cancelavel: estado === "pendente"/, para: "cancelavel: true", teste: T_PURO, cai: "o usado diz a conta e quando" },

  // A TABELA E O REPOSITÓRIO
  { nome: "R1: a 021 sem o RLS", arq: M, de: /\s*alter table convites_de_conexao enable row level security;/, para: "", teste: T_TABELA, cai: "nasce da 021 com as colunas que o código lê, e com o RLS ligado" },
  { nome: "R2: a reivindicação sem o usado_em is null", arq: R, de: /where id = \$1 and usado_em is null and cancelado_em is null and expira_em > now\(\)/, para: "where id = $1 and cancelado_em is null and expira_em > now()", teste: T_TABELA, cai: "reivindicar usa o convite e grava a conta, na mesma transação, uma vez só" },
  { nome: "R3: a reivindicação sem o cancelado_em is null", arq: R, de: /where id = \$1 and usado_em is null and cancelado_em is null and expira_em > now\(\)/, para: "where id = $1 and usado_em is null and expira_em > now()", teste: T_TABELA, cai: "não reivindica o cancelado nem o vencido" },
  { nome: "R4: a reivindicação sem o prazo", arq: R, de: /where id = \$1 and usado_em is null and cancelado_em is null and expira_em > now\(\)/, para: "where id = $1 and usado_em is null and cancelado_em is null", teste: T_TABELA, cai: "não reivindica o cancelado nem o vencido" },
  { nome: "R5: a reivindicação fora da transação", arq: R, de: /const reivindicado = await tx\.query\(/, para: "const reivindicado = await sql().query(", teste: T_TABELA, cai: "se a conta falha ao gravar, o convite volta a ficar pendente" },
  { nome: "R6: o cancelar pega o usado", arq: R, de: /set cancelado_em = now\(\)(\r?\n)\s*where id = \$1 and usado_em is null and cancelado_em is null/, para: "set cancelado_em = now()$1      where id = $$1 and cancelado_em is null", teste: T_TABELA, cai: "cancelar vale só para o pendente, uma vez" },
  { nome: "R7: o erro anotado sem olhar o estado", arq: R, de: /const condicao = estado === "pendente" \? "usado_em is null and cancelado_em is null" : "usado_em is not null";/, para: 'const condicao = estado === "pendente" ? "true" : "true";', teste: T_TABELA, cai: "o erro anotado vai só para o convite no estado pedido" },
  { nome: "R8: o prazo de 8 dias", arq: R, de: /make_interval\(days => \$3\)/, para: "make_interval(days => $3 + 1)", teste: T_TABELA, cai: "criar grava o hash do código, nunca o código, com 7 dias de prazo" },
  { nome: "R9: a lista sem o arroba", arq: R, de: /, a\.username as conta_username/, para: ", null as conta_username", teste: T_TABELA, cai: "a lista traz o arroba da conta que entrou pelo convite" },
  { nome: "R10: o id torto vai ao banco", arq: R, de: /if \(!UUID\.test\(id\)\) return null;/, para: "", teste: T_TABELA, cai: "acha pelo código e pelo id" },

  // O COMEÇO, O PORTEIRO, A CASCA E OS CABEÇALHOS
  { nome: "C1: o começo não confere o estado", arq: C, de: /if \(!convite \|\| estadoDoConvite\(convite, Date\.now\(\)\) !== "pendente"\) \{/, para: "if (!convite) {", teste: T_CONVITE, cai: "o convite cancelado, usado, vencido, inexistente ou torto volta para a página, sem cookie" },
  { nome: "C2: o começo sem o cookie do convite", arq: C, de: /\s*res\.cookies\.set\(OAUTH_CONVITE_COOKIE, convite\.id, opcoes\);/, para: "", teste: T_CONVITE, cai: "com o convite pendente, manda ao Instagram com um state novo e grava os dois cookies" },
  { nome: "C3: o começo de hoje não apaga o cookie do convite", arq: "app/api/oauth/login/route.ts", de: /\s*res\.cookies\.set\(OAUTH_CONVITE_COOKIE, "", \{ path: "\/api\/oauth", maxAge: 0 \}\);/, para: "", teste: T_CONVITE, cai: "apaga o cookie do convite" },
  { nome: "C4: o porteiro sem o /convite", arq: "proxy.ts", de: /\s*"\/convite",/, para: "", teste: T_PUBLICO, cai: "/convite/abc passa sem a sessão" },
  { nome: "C5: a casca sem o /convite", arq: "app/app-shell.tsx", de: /, "\/convite"\]/, para: "]", teste: T_MENU, cai: "/convite/abc não tem menu nem conta" },
  { nome: "C6: sem o Referrer-Policy", arq: "next.config.ts", de: /\s*\{ key: "Referrer-Policy", value: "no-referrer" \},/, para: "", teste: T_PUBLICO, cai: "a página e o começo levam os três" },
  { nome: "C7: o começo sem os cabeçalhos", arq: "next.config.ts", de: /\s*\{ source: "\/api\/oauth\/convite\/:path\*", headers: FECHADO \},/, para: "", teste: T_PUBLICO, cai: "a página e o começo levam os três" },

  // A VOLTA
  { nome: "V1: a volta do convite sem o state", arq: V, de: /if \(!oauthStateConfere\(req\.cookies\.get\(OAUTH_STATE_COOKIE\)\?\.value, q\.get\("state"\)\)\) return erro\("falhou"\);/, para: "", teste: T_VOLTA, cai: "o state diferente recusa sem escrever nada, nem no convite" },
  { nome: "V2: a recusa sem anotar", arq: V, de: /\s*await anotar\("autorização negada", "pendente"\);/, para: "", teste: T_VOLTA, cai: "a recusa no Instagram anota" },
  { nome: "V3: o convite que não vale chama a Meta", arq: V, de: /if \(!convite \|\| estadoDoConvite\(convite, Date\.now\(\)\) !== "pendente"\) return erro\("vencido"\);/, para: "", teste: T_VOLTA, cai: "o convite que já não vale manda para o erro sem chamar a Meta" },
  { nome: "V4: a reivindicação que falha vira \"Pronto\"", arq: V, de: /if \(!conectou\) return erro\("vencido"\);/, para: "", teste: T_VOLTA, cai: "o convite reivindicado no meio da troca" },
  { nome: "V5: a rota não desvia para o convite", arq: "app/api/oauth/callback/route.ts", de: /if \(conviteId\) return voltaDoConvite\(req, conviteId\);/, para: "", teste: T_VOLTA, cai: "conecta a conta, usa o convite" },
  { nome: "V6: o erro da Meta sem limpeza", arq: V, de: /await anotar\(textoParaOPainel\(mensagem\(err\), segredos\), "pendente"\);(\r?\n)\s*return erro\("falhou"\);(\r?\n)\s*\}(\r?\n)(\r?\n)\s*let conectou/, para: 'await anotar(mensagem(err), "pendente");$1    return erro("falhou");$2  }$3$4  let conectou', teste: T_VOLTA, cai: "a Meta em erro deixa o convite pendente, com o erro limpo dos segredos" },
  { nome: "V7: os segredos sem o code", arq: V, de: /= \[code, config\.instagram_app_secret\];/, para: "= [config.instagram_app_secret];", teste: T_VOLTA, cai: "a Meta em erro deixa o convite pendente, com o erro limpo dos segredos" },
  { nome: "V8: a assinatura que falha não vai para o convite", arq: V, de: /\s*await anotar\(aviso, "usado"\);/, para: "", teste: T_VOLTA, cai: "a assinatura dos webhooks que falha fica no convite usado" },
  { nome: "V9: o fim não apaga o cookie do convite", arq: V, de: /\s*res\.cookies\.set\(OAUTH_CONVITE_COOKIE, "", \{ path: "\/api\/oauth", maxAge: 0 \}\);/, para: "", teste: T_VOLTA, cai: "conecta a conta, usa o convite" },
  { nome: "V10: a volta do convite grava o cookie da conta (pedido da auditoria)", arq: V, de: /(res\.cookies\.set\(OAUTH_CONVITE_COOKIE, "", \{ path: "\/api\/oauth", maxAge: 0 \}\);)/, para: '$1 res.cookies.set("metodochat_account", "17800000000021501", { path: "/" });', teste: T_VOLTA, cai: "conecta a conta, usa o convite" },

  // AS PÁGINAS
  { nome: "P1: a página do link não confere o estado", arq: "app/convite/[codigo]/page.tsx", de: /const pendente = !!convite && estadoDoConvite\(convite, agora\) === "pendente";/, para: "const pendente = !!convite || agora < 0;", teste: T_PAGINAS, cai: "o cancelado, o usado, o vencido, o inexistente e o torto têm a mesma frase" },
  { nome: "P2: o link de fora com o Referer", arq: "app/convite/[codigo]/page.tsx", de: /target="_blank" rel="noreferrer"/, para: 'target="_blank" rel="noopener"', teste: T_PAGINAS, cai: "com o convite pendente, mostra os três passos e o botão de conectar" },
  { nome: "P3: a página do link mostra o \"para quem\"", arq: "app/convite/[codigo]/page.tsx", de: /<p>Siga os três passos abaixo, pelo navegador do computador\.<\/p>/, para: "<p>Siga os três passos abaixo, pelo navegador do computador. {convite?.para_quem}</p>", teste: T_PAGINAS, cai: "com o convite pendente, mostra os três passos e o botão de conectar" },
  { nome: "P4: a página do erro repete o que veio na URL", arq: "app/convite/erro/page.tsx", de: /\{FRASE_DO_MOTIVO\[qual\]\} \{PECA_UM_NOVO_LINK\}/, para: '{FRASE_DO_MOTIVO[qual]} {PECA_UM_NOVO_LINK} {String(motivo ?? "")}', teste: T_PAGINAS, cai: "um motivo fora da lista vira" },

  // A ETAPA 6
  { nome: "A1: o link nasce no endereço de onde o painel foi aberto", arq: A, de: /const appUrl = canonicalAppUrl\(config\.app_url, host \? `\$\{proto\}:\/\/\$\{host\}` : ""\);/, para: 'const appUrl = config.app_url ? "" : canonicalAppUrl(null, host ? `${proto}://${host}` : "");', teste: T_CONVITE, cai: "gerar devolve o link no endereço canônico" },
  { nome: "A2: gerar sem conferir o \"para quem\"", arq: A, de: /if \(!paraQuem\) return \{ erro: FRASE_DO_PARA_QUEM_INVALIDO \};/, para: "", teste: T_CONVITE, cai: "gerar recusa o" },
  { nome: "A3: cancelar sem cancelar", arq: A, de: /\s*await cancelarNoBanco\(String\(formData\.get\("id"\) \?\? ""\)\);/, para: "", teste: T_CONVITE, cai: "cancelar cancela o pendente, e o começo passa a recusar" },
  { nome: "A4: gerar sem a sessão", arq: A, de: /await exigirSessao\(\);(\r?\n)\s*const paraQuem = paraQuemDoFormulario/, para: "const paraQuem = paraQuemDoFormulario", teste: T_SESSAO, cai: "cada ação começa por" },
  { nome: "A5: a tela sem o link", arq: "app/setup/convites.tsx", de: /<CopyField label=\{`Link de convite para \$\{estado\.paraQuem\}`\} value=\{estado\.link\} \/>/, para: "", teste: T_SETUP, cai: "mostra o link uma vez, com o copiar e o aviso de que ele não volta" },
  { nome: "A6: o cancelar em todas as linhas", arq: "app/setup/convites.tsx", de: /\{l\.cancelavel && \(/, para: "{(", teste: T_SETUP, cai: "a lista mostra os quatro estados" },
  { nome: "A7: o gerar sem trava sem a Meta", arq: "app/setup/convites.tsx", de: /disabled=\{!metaOk \|\| gerando\}/, para: "disabled={gerando}", teste: T_SETUP, cai: "sem o app da Meta configurado, o botão de gerar fica travado" },
  { nome: "A8: o convite volta para dentro de um bloco recolhido (achado 163)", arq: "app/setup/page.tsx", de: /<Convites linhas=\{convites\} metaOk=\{metaOk\} \/>/, para: "<details><summary>Convidar</summary><Convites linhas={convites} metaOk={metaOk} /></details>", teste: T_A_VISTA, cai: "a página desenha o convite uma vez só, fora do bloco Instalação recolhido" },
];

let ruins = 0;
for (const m of mutacoes) {
  const original = readFileSync(m.arq, "utf8");
  if ((original.match(new RegExp(m.de.source, "g")) ?? []).length !== 1) {
    console.log(`✗ ${m.nome}: o trecho não aparece uma vez só`);
    ruins++;
    continue;
  }
  writeFileSync(m.arq, original.replace(m.de, m.para));
  const env = { ...process.env, CLAUDECODE: "", AI_AGENT: "" };
  if (m.teste.integ) env.DATABASE_URL_TESTES = TESTES;
  const r = spawnSync("npx", m.teste.args, { encoding: "utf8", shell: true, env });
  execSync(`git checkout -- "${m.arq}"`);
  const saida = (r.stdout + r.stderr).replace(/\x1b\[[0-9;]*m/g, "");
  const alvoOk = !m.teste.integ || saida.includes("[rede-global] ALVO: banco de TESTE");
  const caiu = r.status !== 0 && saida.split("\n").some((l) => l.includes("×") && l.includes(m.cai));
  const ok = caiu && alvoOk;
  console.log(`${ok ? "✓" : "✗"} ${m.nome}: o caso "${m.cai}" ${caiu ? "caiu" : "NÃO caiu"}${alvoOk ? "" : " (SEM o ALVO de teste)"}`);
  if (!ok) ruins++;
}
const sujo = execSync("git status --porcelain", { encoding: "utf8" })
  .split("\n")
  .filter((l) => l.trim() && l !== "?? .env.local")
  .join(" ");
console.log(`${mutacoes.length} mutações, ${ruins} ruins; árvore no fim: ${sujo ? `SUJA (${sujo})` : "limpa"}`);
process.exit(ruins || sujo ? 1 : 0);
```
