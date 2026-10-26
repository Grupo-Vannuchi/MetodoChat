# A sessão conferida em toda ação do painel

**Nascido em:** 26/10/2026, sobre a `main` em `260b9dd`, da varredura de segurança que o Eduardo pediu
nesse dia. É o segundo caso dela, depois do RLS (branch `rls-nas-tabelas`), e vai num PR próprio.
**Decisão do Eduardo pela caixa, em 26/10:** as três frentes, ou seja, o porteiro, as 20 ações e a lista
de contas do menu.

---

## O furo

O painel tem um porteiro, o `proxy.ts`, que confere o cookie de sessão antes de abrir qualquer tela.
Duas coisas abrem uma brecha nele.

1. **A regra do porteiro é larga demais.** O matcher (`proxy.ts:33`) é
   `"/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|ico)$).*)"`. Ele foi pensado para as imagens do
   site, mas tira do porteiro QUALQUER endereço que termine em `.svg`, `.png`, `.jpg` ou `.ico`,
   inclusive o de uma tela de segmento dinâmico (`/conversas/[id]`, `/automacoes/[id]`,
   `/publicar/post/[id]` e outras).
2. **Vinte ações não conferem a sessão por conta própria.** A doc do Next desta versão
   (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`, em "Execution
   order") diz que uma Server Function é chamada por POST na rota em que é usada, e que um matcher que
   exclui um caminho também pula a chamada nesse caminho. Por isso ela manda conferir a autenticação
   dentro de cada Server Function. As ações do bônus e dos carrosseis já fazem isso. Estas 20 não:

   | Arquivo | Ações |
   |---|---|
   | `app/account-actions.ts` | `selectAccount` |
   | `app/automacoes/actions.ts` | `salvarAutomacao`, `criarAutomacao`, `toggleAutomation`, `deleteAutomation`, `duplicateAutomation` |
   | `app/contatos/actions.ts` | `atualizarPerfis`, `enviarLote`, `marcarCategoriaEmLote` |
   | `app/conversas/[id]/actions.ts` | `sendReply`, `definirCategoria` |
   | `app/conversas/[id]/marcar-visto.ts` | `marcarVisto` |
   | `app/publicar/actions.ts` | `publicar` |
   | `app/publicar/post/actions.ts` | `cancelarPublicacao`, `remarcarPublicacao` |
   | `app/setup/actions.ts` | `reassinarWebhooks`, `testarWebhook`, `configurarWebhookAuto`, `saveMetaCredentials`, `salvarPerguntasDeAbertura` |

Há também um vazamento menor, da mesma família. O layout raiz (`app/layout.tsx:76-91`) lê a lista de
contas (o id, o nome de usuário e a foto) e a passa ao `AppShell`, que é um componente de cliente. Ele
faz isso em toda página, inclusive nas públicas (`/entrar`, `/privacidade` e `/exclusao-de-dados`), e a
lista vai no corpo da resposta.

**Nada disso foi testado na produção, de propósito.** O conserto não depende de saber até onde a brecha
vai: ele fecha as duas portas e cobra isso nos testes.

## O que muda

1. **O porteiro (`proxy.ts:33`).** O matcher passa a tirar só o que é de fato arquivo do Next e o
   favicon: `"/((?!_next/static|_next/image|favicon\\.ico$).*)"`. Todo o resto passa pelo porteiro.
   - As cinco imagens de `public/` (`file.svg`, `globe.svg`, `next.svg`, `vercel.svg` e `window.svg`)
     são as do modelo do `create-next-app`, e nenhum arquivo de `app/` ou de `lib/` as usa (medido com
     grep). Sem sessão, elas passam a levar a `/entrar`, e isso não faz falta a ninguém.
   - A `PUBLIC_PREFIXES` não muda.
2. **As 20 ações.** A primeira instrução de cada uma passa a ser `await exigirSessao();`, como nas ações
   do bônus. A função vem de um arquivo novo, `lib/exigir-sessao.ts`, com o mesmo corpo das cópias que
   já existem: lê o cookie e, sem sessão válida, faz `redirect("/entrar")`.
   - **Por que um arquivo novo, e não mais oito cópias:** com mais oito, seriam catorze cópias da mesma
     regra de segurança. As seis que já existem (`app/bonus/*-actions.ts`, `app/bonus/actions.ts` e
     `app/carrosseis/actions.ts`) ficam como estão, porque mexer nelas não é necessário.
   - **O comportamento com sessão válida não muda.** Sem sessão, a ação não faz nada e o navegador vai
     para `/entrar`. Hoje esse caso não acontece pelo caminho normal, porque o porteiro já mandou a
     pessoa para `/entrar` antes.
3. **A lista de contas do menu (`app/layout.tsx`).** O layout só chama `listAccounts()` quando o cookie
   de sessão é válido. Sem sessão, a lista sai vazia, como já sai hoje quando o banco não responde.
   - **Depois do login, o menu aparece com as contas sem recarregar a página.** A action de entrar grava
     o cookie (`app/entrar/actions.ts:41`) e faz `redirect("/")` (`:48`). A página nova é desenhada no
     servidor já com o cookie gravado, e o layout dela confere a sessão e lê as contas (achado 128 da
     auditoria). A prova também confere isso.

## O que não muda

- `app/entrar/actions.ts`: a ação de entrar é pública por definição.
- As rotas públicas (o webhook, o OAuth, o cron, o tique da fila, a privacidade, a exclusão de dados e
  a de entrar).
- As páginas. Com o matcher corrigido, todas passam pelo porteiro.
- As seis ações e as rotas que já conferem a sessão.
- O banco: nenhuma migração e nenhuma escrita.

## Os testes, escritos antes do código

1. **`tests/sessao-nas-actions.test.ts`**, sobre o texto dos arquivos.
   - Ele procura em `app/` e `lib/` todo arquivo que comece com `"use server"`. Para cada função
     exportada, exige que a primeira instrução seja `await exigirSessao();`.
   - O `exigirSessao` de cada arquivo tem de ser o de `@/lib/exigir-sessao` ou uma função local que
     chame `isValidSession` e `redirect("/entrar")`. Isso pega uma cópia que não confere nada.
   - A única exceção é `app/entrar/actions.ts`, nomeada no teste com o motivo.
   - O teste lê o código pelo analisador do TypeScript, que já está nas dependências, e não por
     expressão regular. A assinatura de `sendReply` tem `{` antes do corpo (medido: 1 das 20) e enganaria
     o molde de `tests/bonus-paginas.test.ts:22`.
   - **Ele vale também para os arquivos futuros:** uma ação nova sem a conferência faz o teste cair.
2. **No mesmo arquivo, as rotas.** A regra vale para todo `route.ts` ou `route.tsx` de `app/` fora dos
   prefixos públicos, em cada handler exportado (`GET`, `POST`…).
   - A primeira instrução que não seja `const <nome> = await cookies();` tem de ser um
     `if (!isValidSession(...))`.
   - O ramo desse `if` tem de RETORNAR: um `return` direto ou um bloco que termina em `return`.
   - Isso pega uma conferência movida para depois do trabalho ou com o resultado ignorado, e não só a
     ausência dela (achado 127 da auditoria).
   - As oito rotas protegidas de hoje têm uma de duas formas, medidas pelo analisador:
     - quatro começam pelo `if` (as do CSV, a de mídia e a de assinar);
     - quatro leem `await cookies()` e fazem o `if` logo em seguida (as de imagem e de arte).
   - Esse caso nasce verde, e a prova dele é a mutação.
3. **`tests/proxy-matcher.test.ts`**, com o verificador do próprio Next. Esta versão exporta
   `unstable_doesMiddlewareMatch` de `next/experimental/testing/server`, e a doc chama a mesma função de
   `unstable_doesProxyMatch`.
   - Têm de passar pelo porteiro:
     - `/`, `/setup`, `/automacoes` e `/contatos`;
     - `/conversas/x.png`, `/automacoes/1.svg`, `/publicar/post/a.jpg` e `/bonus/b.ico`;
     - um POST para `/setup/x.png`.
   - Ficam fora dele: `/_next/static/chunks/a.js`, `/_next/image` e `/favicon.ico`.
4. **`tests/layout-contas.test.ts`**, sobre o texto do arquivo. Em `app/layout.tsx`, a chamada a
   `listAccounts(` fica dentro do bloco que confere `isValidSession`.

**A prova de que falham:** os testes 1, 3 e 4 caem sobre a `main`, e o 2 cai nas mutações.

**As mutações** (no apêndice do plano):

- tirar `await exigirSessao();` de uma ação de cada arquivo;
- trocar o corpo de `exigirSessao` por um que não confere;
- pôr de volta o `svg|png|jpg|ico` no matcher;
- tirar a conferência de uma rota protegida;
- tirar a guarda do `listAccounts` no layout.

**A suíte inteira continua passando:** os puros, os de tela e os de integração no container, com o
`tsc` e o lint.

## A prova, no preview

A prova é feita pelo Eduardo no navegador. O preview usa o banco de produção, então só a entrada grava
alguma coisa: a action de entrar apaga as tentativas do IP de quem entra (`lib/login-throttle.ts:50`).
Ela só grava com o OK do Eduardo pela caixa, a hora mandada à auditoria antes e o "pode" dela.

1. **Sem sessão**, numa janela anônima:
   - `/setup` leva a `/entrar`;
   - `/conversas/x.png` também leva a `/entrar`;
   - em `/entrar`, a lista de contas não aparece no código da página.
2. **Com sessão:**
   - o menu mostra as contas logo depois de entrar;
   - abrem `/setup`, `/automacoes`, `/contatos`, `/conversas` e `/publicar`;
   - trocar de conta no menu funciona. O `selectAccount` só grava cookie.

Nenhuma ação que grava no banco é clicada na prova: salvar, criar, apagar, enviar, publicar, cancelar
ou remarcar. A conferência delas é o teste 1, que cobra a primeira instrução de cada uma.

## O que fica de fora, e por quê

- **O cron diário que libera sem a `CRON_SECRET` e o `state` fixo do OAuth:** são achados médios da
  mesma varredura, mas de outra porta, e entram depois, se o Eduardo decidir.
- **A troca da `ADMIN_PASSWORD`:** vem depois deste PR, na ordem que o Eduardo deu. A troca derruba
  todas as sessões abertas, porque a chave da sessão é derivada da senha (`lib/auth.ts:34-39`).
- **As seis cópias locais de `exigirSessao`:** ficam como estão, para este PR não tocar o que já é
  seguro.
- **O `configurarWebhookAuto` sem importador** (`app/setup/actions.ts:135`, achado 129 da auditoria):
  ele ganha a conferência como as outras 19 ações, e apagá-lo fica para um PR futuro.
- **O prefixo `/_next` da `PUBLIC_PREFIXES`** (`proxy.ts:14`): continua público no porteiro. Não há
  página sob `/_next`, e uma ação chamada ali confere a sessão sozinha, pelo item 2 de "O que muda".
- **A prova no preview pede login na Vercel:** o preview está atrás da proteção SSO dela (medido pela
  auditoria em 20/10).
