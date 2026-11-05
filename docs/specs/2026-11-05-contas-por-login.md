# As contas por login (entrega 2 de 2 dos logins)

**Nascido em:** 05/11/2026, sobre a `main` em `af395e2` (o PR #29, a entrega 1, em produção desde 05/11), do ponto 4 dos feedbacks do Vinícius (19/10): os logins.

**O que o Eduardo decidiu pela caixa:**
- **em 03/11** (valem como estão):
  - o administrador vê tudo, e os outros logins só as contas que receberem;
  - pode haver mais de um administrador, marcado no login;
  - um login comum faz tudo nas contas dele, menos a Configuração e os logins;
  - os bônus e os carrosséis continuam do painel inteiro;
  - só o administrador gera convites (feito na entrega 1).
- **em 05/11:**
  - **o carrossel:** todo login vê e edita todos os carrosséis e bônus. Escolher a conta do carrossel, gerar imagens, subir imagens, publicar e apagar um carrossel que já tem conta só funcionam nas contas que o login recebeu;
  - **onde dar as contas:** na página Logins, em cada login comum, uma caixinha por conta conectada;
  - **a conta nova:** só o administrador conecta contas (o botão e o convite). A conta nova aparece para os administradores e só vai para um login comum quando o administrador der;
  - **o login novo:** nasce comum. A caixinha "Administrador", desmarcada, faz dele administrador. Depois dá para trocar na lista, menos o último administrador;
  - **o rumo do produto:** o MetodoChat pode virar um "ManyChat com CRM" multiempresa, com clientes isolados. A escolha foi "seguir e deixar pronto para depois": esta entrega segue as decisões de 03/11, e a regra de acesso mora num lugar só (seção 2);
  - **o desenho abaixo foi aprovado** em três partes: a regra num lugar só; o que muda para o login comum; e a página Logins, a saída da senha única e os testes.

---

## O que estava aberto

O inventário de 05/11, medido no `af395e2`, achou **84 pontos do servidor**: 45 actions, 11 rotas (fora o cron, o webhook e a fila) e 28 páginas. Em relação ao de 04/11, no `ed2b515`, nenhum mudou de categoria. A entrega 1 só acrescentou 6 actions e 2 páginas, todas sem conta.

- **Os logins não têm ligação com contas.** A `logins` e a `sessoes` (`migrations/022-logins-e-sessoes.sql`) não têm coluna de conta.
- **A conta escolhida é um cookie que vale para qualquer login.**
  - `getSelectedAccount` (`lib/account.ts:9-14`) lê todas as contas e, quando o cookie não bate, devolve a mais antiga (`:13`).
  - `selectAccount` (`app/account-actions.ts:8`) grava no cookie (`:34-39`) qualquer id não vazio vindo do formulário (`:10`).
  - O layout refaz a mesma escolha à mão (`app/layout.tsx:94` e `:100-103`).
- **O carrossel tem uma segunda lista de contas.** `contasParaArte` (`lib/bonus/carrossel-repositorio.ts:263`) devolve todas as contas, e `contaSelecionada` (`lib/bonus/arte-conta.ts:31-33`) escolhe pelo cookie, com a mesma queda na primeira.
- **18 pontos recebem um id do navegador sem conferir a conta:**
  - `selectAccount` e `salvarPerguntasDeAbertura` (`app/setup/actions.ts:257`);
  - as 10 actions do carrossel: `apagarCarrosselDaPagina` (`app/bonus/apagar-actions.ts:25`); `gerarCarrosselDeNovo`, `salvarSlideDoCarrossel`, `salvarArteDoCarrossel` e `fixarContaDoCarrossel` (`app/bonus/carrossel-actions.ts:143`, `:192`, `:233` e `:276`); `pedirImagemDoSlide` (`app/bonus/imagem-actions.ts:30`); `assinarImagemDoCarrossel`, `guardarImagemDoSlide` e `publicarCarrossel` (`app/bonus/publicar-actions.ts:45`, `:59` e `:81`); e `gerarAvulsoDeNovo` (`app/carrosseis/actions.ts:81`);
  - as 4 rotas de arte e de imagem do carrossel e as 2 páginas de um carrossel.

  A publicação passa por `conferirCarrossel` (`lib/bonus/publicar-processo.ts:72`), que só exige que a conta gravada no carrossel esteja conectada, qualquer uma (`:77-79`).
- **4 pontos leem todas as contas:** `reassinarWebhooks` (`app/setup/actions.ts:29`), `SetupPage` (`app/setup/page.tsx:77`), `PortasDeEntrada` e `SubscriptionStatus`. A Configuração não confere papel: só `gerarConvite` e `cancelarConvite` chamam `exigirAdministrador` (`app/setup/actions.ts:339` e `:355`).
- **Qualquer login conecta uma conta nova.** `/api/oauth/login` (`app/api/oauth/login/route.ts:14`) só confere a sessão (`:18-20`). O botão "+ Conectar outra conta" fica no seletor (`app/account-switcher.tsx:93-98`) e na Configuração.
- **A Atividade mostra os eventos sem conta para todos.** É o `or e.account_id is null` em `lib/event-query.ts:33`.
- **A senha única ainda é lida.** O caminho da passagem é `lib/entrada.ts:28-34`, e a leitura da `ADMIN_PASSWORD` fica na `senhaUnicaConfere` (`lib/auth.ts:40-41`). Na produção, os dois logins já têm senha (leitura da auditoria de 05/11, às 13:18Z).

---

## O que muda

### 1. A migração 023: `logins_contas`

```sql
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

- Uma linha diz que o login comum vê aquela conta. O administrador não precisa de linha nenhuma, porque vê todas.
- Apagar o login ou desconectar a conta apaga a ligação junto (`on delete cascade`).
- A tabela nasce com o RLS ligado e sem permissão para `anon` e `authenticated`, pelos privilégios padrão da 020, como a 021 e a 022.
- O padrão de `administrador` passa a ser `false`: um login criado sem dizer o papel nasce comum. A action sempre passa o valor (seção 4), e o padrão é só a rede de baixo.
- A partida passa a exigir a tabela (`lib/esquema.ts`, `tabelasDepois`). Por isso a 023 é aplicada à mão na produção antes do preview, como a 022.

### 2. A regra num lugar só: `lib/acesso.ts`

**Este é o único arquivo que sabe quem vê qual conta.** O resto do código pergunta a ele. Assim, virar multiempresa depois é trocar a regra daqui e criar a tabela das empresas, sem refazer a varredura.

- `contasDoLogin(login)`: o administrador recebe todas as contas, na ordem de hoje (`created_at`). O comum recebe só as ligadas a ele, na mesma ordem.
- `podeVerConta(login, contaId)`: `true` para o administrador, se a conta existir, e para o comum, se houver a ligação.
- `contaEscolhida(login, doCookie)`: a do cookie, se estiver entre as permitidas; senão, a primeira permitida; senão, nenhuma. A parte que escolhe é pura (uma lista e um cookie entram, e uma conta sai), para os testes a cercarem sem banco.
- `exigirConta(contaId)`: lê o login da sessão e recusa se `podeVerConta` não confirmar. Na action, a recusa é um `{ erro }` com a frase "Você não tem acesso a essa conta." ou o redirect para o início, conforme o que a action devolve hoje. Na rota, é um 403.

Quem passa a perguntar à regra:
- **`getSelectedAccount` e `getSelectedAccountId`** (`lib/account.ts:9` e `:16`) passam a usar `contaEscolhida` com o login da sessão. A assinatura não muda. Os 29 pontos que já usam a conta escolhida (categorias a e a+c✓ do inventário) ficam presos às contas do login sem mudar uma linha deles.
- **O layout** (`app/layout.tsx:94-103`) monta o seletor com `contasDoLogin` e a escolha com `contaEscolhida`, no lugar da cópia à mão.
- **`selectAccount`** grava o cookie só se `podeVerConta` confirmar. Um id que não é do login é ignorado, como o vazio de hoje (`app/account-actions.ts:33`).
- **O carrossel** separa as duas coisas que a `contasParaArte` faz hoje:
  - **para mostrar** (a arte, a revisão, a lista e o `resolverConta` da conferência), continua a lista de todas as contas, porque todo login vê todos os carrosséis;
  - **para escolher** a conta de um carrossel novo ou de um carrossel sem conta (`contaDoPedido`, `app/bonus/carrossel-actions.ts:81-84`; o pedido e o gerar de novo do avulso), vale `contaEscolhida`, com as contas do login.

A regra não guarda nada em memória entre pedidos: tirar uma conta de um login vale no próximo clique.

### 3. O que muda para o login comum

- **A Configuração e a página Logins** somem do menu, e as duas páginas mandam o comum para o início no servidor. Todas as actions de `app/setup/actions.ts` passam a chamar `exigirAdministrador`: `reassinarWebhooks`, `testarWebhook`, `configurarWebhookAuto`, `saveMetaCredentials` e `salvarPerguntasDeAbertura`, além dos dois convites, que já chamam. Os 4 pontos que leem todas as contas ficam todos dentro da Configuração, e por isso só o administrador chega a eles.
- **Conectar conta é do administrador.** `/api/oauth/login` passa a exigir administrador e recusa o comum com o redirect para o início. O "+ Conectar outra conta" do seletor, e o "Conectar Instagram" do seletor sem contas, aparecem só para o administrador. A volta do OAuth (`/api/oauth/callback`) não muda: ela só chega depois de um começo que já exigiu o administrador, pelo cookie do `state`.
- **O comum sem contas** vê, nas páginas de conta, a frase "Você ainda não tem contas. Peça ao administrador." no lugar do convite para conectar.
- **A Atividade:** para o comum, os eventos sem conta (`e.account_id is null`) não aparecem. O `buildWhere` (`lib/event-query.ts:29`) ganha o parâmetro que diz se os eventos sem conta entram, e só o administrador os recebe.
- **Os carrosséis.** Exigem `podeVerConta` sobre a conta gravada no carrossel:
  - `pedirImagemDoSlide`;
  - `assinarImagemDoCarrossel` e `guardarImagemDoSlide`;
  - `publicarCarrossel`;
  - `apagarCarrosselDaPagina`, quando o carrossel já tem conta (sem conta, qualquer login apaga).

  `fixarContaDoCarrossel` grava a conta escolhida, que já sai das contas do login (seção 2), e ganha a mesma conferência como rede.

  Ficam abertos a todo login, porque editam o carrossel e não agem na conta:
  - `gerarCarrosselDeNovo` e `gerarAvulsoDeNovo`, que mantêm a conta do original;
  - `salvarSlideDoCarrossel` e `salvarArteDoCarrossel`;
  - as 4 rotas de arte e de imagem e as 2 páginas de um carrossel, que só mostram.

  A recusa diz "Esse carrossel é de uma conta que você não tem." e não muda nada.

### 4. A página Logins

- **Criar um login:** o formulário ganha a caixinha "Administrador", desmarcada. `criarLoginAction` passa o papel à `criarLogin` (`lib/logins-repositorio.ts`), sempre explícito.
- **As contas de um login comum:** cada linha de login comum mostra as contas conectadas, com uma caixinha em cada uma, e o botão "Salvar contas". A action nova `definirContasDoLogin` (administrador) troca o conjunto de uma vez, numa transação. Ela recusa uma conta que não existe e um login que é administrador. A linha de um administrador diz "Vê todas as contas", sem caixinhas.
- **O papel:** cada linha ganha "Tornar administrador" ou "Tornar comum". A action nova `definirPapelDoLogin` (administrador) segue as mesmas travas do desativar:
  - ninguém muda o próprio papel;
  - o último administrador ativo não vira comum. A trava lê os administradores ativos com `for update` (achado 168), como o `desativarLogin`.

  Virar comum mantém as ligações que o login já tinha. Virar administrador não apaga as ligações, mas elas deixam de importar.
- **As frases** novas moram em `lib/logins-textos.ts`, com as de hoje.

### 5. A senha única sai do código

- O caminho da passagem (`lib/entrada.ts:28-34`), a `senhaUnicaConfere` (`lib/auth.ts:40`) e a `gravarSenhaDaPassagem` (`lib/logins-repositorio.ts`) saem.
- Um login sem senha passa a ter a resposta de qualquer entrada errada: o scrypt de fachada e a mesma frase. Hoje não há nenhum; a auditoria confere de novo na produção antes do merge (`select count(*) from logins where senha_hash is null` = 0).
- A `ADMIN_PASSWORD` deixa de ser lida pelo código. Apagar a variável da Vercel fica para depois do merge, com o OK do Eduardo.

---

## As regras, em resumo

| Quem | Vê as contas | Configuração e Logins | Conecta conta | Carrossel: ver e editar | Carrossel: conta, imagens, publicar, apagar com conta |
|---|---|---|---|---|---|
| Administrador | todas | sim | sim | todos | todos |
| Comum | as que recebeu | não | não | todos | só nas contas que recebeu |

---

## O que fica de fora, e por quê

- **O multiempresa.** Fica para quando o Eduardo decidir o produto. O caminho fica pronto pela seção 2. Quando vier, será por empresa: os logins, as contas, os contatos, os bônus, os carrosséis, a Configuração, o app da Meta e os webhooks.
- **Os ids de post e de story nas automações** (`app/automacoes/actions.ts:217-218` e `:467-469`) continuam sem conferência. A automação é gravada na conta escolhida, que agora é conferida. Um id de mídia de outra conta só faria a automação não disparar.
- **A `drainQueue`** drena a fila de todas as contas. É interna ao servidor e não depende de quem clicou.
- **O cookie da conta continua entre logins** no mesmo navegador, porque o Sair só apaga o da sessão. Com a regra, um cookie de uma conta que o login não tem é ignorado.
- **A conta do carrossel continua dentro do `arte` (jsonb)**, sem chave estrangeira. A conferência lê a conta de lá, como o `conferirCarrossel` já faz.

---

## Os testes, escritos antes do código

- **Puros:**
  - a escolha da `contaEscolhida`: o cookie permitido, o cookie de outra conta, sem cookie, sem contas, e a ordem;
  - as frases novas.
- **O teste da varredura** (`tests/acesso-nas-actions.test.ts`, no molde do `tests/sessao-nas-actions.test.ts`). Ele lê toda action exportada e todo handler de rota, e exige que cada um faça uma destas três coisas:
  - chamar `exigirAdministrador`;
  - chamar uma função de `lib/acesso.ts`, direto ou pela `getSelectedAccount`;
  - estar numa lista fechada, com o motivo de cada um (os bônus, as edições do carrossel, a entrada e a Minha conta).

  Uma action nova sem conferência derruba o teste.
- **A integração**, com dois logins (um administrador e um comum), duas contas (A e B) e o comum ligado só à A:
  - o comum com o cookie da B vê a A; o `selectAccount` da B não grava o cookie;
  - as páginas e as rotas de conta (os CSVs, a mídia, o assinar) servem a A, e nunca a B;
  - as actions da Configuração e o `/api/oauth/login` recusam o comum;
  - num carrossel da B, o comum é recusado em imagem, assinar, guardar, publicar e apagar, e nada muda no banco. Num carrossel da A, cada um funciona. Ele edita o texto dos dois;
  - a Atividade do comum não mostra os eventos sem conta;
  - na página Logins: criar comum e administrador; salvar as contas; trocar o papel com as duas travas; a recusa de uma conta que não existe;
  - o administrador continua vendo tudo, como hoje;
  - a entrada de um login sem senha é recusada com a frase de sempre.
- **As mutações**, uma por trava: cada conferência tirada derruba o caso nomeado. Entre elas: a queda na primeira conta sem filtro; o `selectAccount` sem conferência; cada action do carrossel sem o `podeVerConta`; a Configuração sem o `exigirAdministrador`; o `/api/oauth/login` aberto; o `for update` do papel; e o `is null` da Atividade para o comum.

---

## A prova

- **A 023 à mão na produção**, com o OK do Eduardo e a leitura da auditoria antes e depois. O código da main não lê a tabela, e o padrão novo de `administrador` só vale para logins criados depois.
- **No preview**, com o roteiro do navegador que espera numa página só de texto e só abre o formulário depois do pode:
  - o Eduardo cria um login comum de prova (`prova-contas`, no domínio reservado `exemplo.invalid`) e dá a ele uma conta só;
  - numa janela sem perfil, o login de prova entra e vê só aquela conta no seletor e nas páginas. A Configuração e a página Logins não aparecem e mandam para o início;
  - o administrador tira a conta do login de prova, e no próximo clique ele vê "Você ainda não tem contas";
  - o login de prova é desativado e fica como histórico.

  **Nenhum post e nenhuma DM:** a recusa de publicar está coberta pela integração, e a prova não clica em publicar.
- **A medida:** o tempo até os cabeçalhos finais de 10 aberturas do `/`, para o comum e para o administrador, contra os números de 04/11 (122 ms no `/`).
