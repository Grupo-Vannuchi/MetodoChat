# O link de convite para o cliente conectar a própria conta

**Nascido em:** 03/11/2026, sobre a `main` em `ce83e8a`, do ponto 5 dos feedbacks do Vinícius (19/10):
"facilitar o cadastro de contas dentro do Chat".

**Decisões do Eduardo pela caixa, em 03/11:**
- o caminho é o link de convite, e não o pedido de acesso avançado à Meta nem só um passo a passo melhor;
- o link vale 7 dias;
- o convite vem antes dos logins (o ponto 4), em entregas separadas;
- o desenho abaixo foi aprovado como está ("Está certo, pode escrever").

---

## O que estava aberto

Uma conta nova do Instagram passa hoje por três degraus:
1. o Eduardo a adiciona como testadora no app da Meta;
2. o dono da conta aceita o convite de testador em instagram.com/accounts/manage_access, só pelo computador;
3. alguém **logado no painel** clica em "Conectar outra conta" (`app/setup/page.tsx:492-499`) e entra no
   Instagram com a conta a conectar.

O degrau 3 é o que o painel pode resolver:
- `/api/oauth/login` exige a sessão do painel (`app/api/oauth/login/route.ts:17-18`, desde o PR #20).
- Por isso, quem conecta a conta do cliente é alguém da N8X, com a **senha do Instagram do cliente** em mãos,
  ou o cliente com a senha do painel. Nos dois casos, uma senha passa de mão.

## O que muda

### 1. A tabela `convites_de_conexao` (migração 021)

| coluna | tipo | o que guarda |
| --- | --- | --- |
| `id` | `uuid`, chave, `gen_random_uuid()` | o convite |
| `codigo_hash` | `text`, único, não nulo | o SHA-256 em hex do código do link; o código em si não é guardado |
| `para_quem` | `text`, não nulo | o nome que o administrador deu ("Dr. Marcus"), de 1 a 60 caracteres |
| `criado_em` | `timestamptz`, `now()` | |
| `expira_em` | `timestamptz`, não nulo | `criado_em` + 7 dias |
| `cancelado_em` | `timestamptz`, nulo | o clique em "Cancelar" |
| `usado_em` | `timestamptz`, nulo | a conexão que deu certo |
| `conta_conectada` | `text`, nulo | o `ig_user_id` da conta que entrou pelo convite |
| `ultimo_erro` | `text`, nulo | o motivo da última tentativa que falhou, para o painel |
| `ultimo_erro_em` | `timestamptz`, nulo | |

- A migração liga o RLS na tabela nova. A 019 só alcançou as tabelas que já existiam, e
  `testes-integracao/rls-nas-tabelas.integracao.ts:57-66` cobra o RLS de toda tabela do schema.
- A permissão da API pública não precisa de linha nova: os privilégios padrão que a 020 mudou já fazem a
  tabela nascer sem permissão para `anon` e `authenticated`.
- Ela entra em `naoObservaveis` (`lib/esquema.ts`), como a 013, a 014 e a 018: é uma tabela de feature, e a
  partida do painel não depende dela.
- Não há função nova, então o achado 130 não se aplica.

### 2. No painel, na etapa 6 da Configuração

- Ao lado de "Conectar outra conta" entra o botão **"Gerar link de convite"**, com o campo **"Para quem"**.
  - A ação (`app/setup/actions.ts`) confere a sessão, como toda action (`tests/sessao-nas-actions.test.ts`).
  - Ela sorteia o código (32 bytes aleatórios, em base64url), grava só o hash e devolve o link **uma vez**,
    no estado da ação. O link não vai para a URL nem para o log.
  - O link usa o endereço canônico (`canonicalAppUrl`, o `metodochat.vercel.app`), e não o endereço de onde o
    painel foi aberto. O cookie do `state` só volta junto se o começo acontecer no mesmo endereço do callback
    (achado 136).
- O link aparece com o botão de copiar e a frase "Este link aparece só agora. Se ele se perder, cancele e gere
  outro."
- Embaixo, a lista dos 20 convites mais recentes, com o "para quem" e o estado:
  - **pendente:** "vence em 10/11, 14:30", com o botão **Cancelar**;
  - **usado:** "`@conta`, em 04/11, 10:12";
  - **vencido** e **cancelado**;
  - se houver `ultimo_erro`, uma linha com "a última tentativa falhou: …" e a hora.
- O estado sai de uma função pura, nesta ordem: cancelado, usado, vencido (`expira_em <= agora`) e pendente.

### 3. A página do cliente, `/convite/[codigo]` (aberta, sem senha do painel)

- `/convite` entra na `PUBLIC_PREFIXES` do `proxy.ts:6-16`.
- **Com o convite pendente,** a página mostra:
  - o título "Conectar seu Instagram";
  - o passo a passo:
    1. a conta precisa ser Profissional (Comercial ou Criador);
    2. aceitar o convite de testador pelo computador, com o link para instagram.com/accounts/manage_access e
       o mesmo aviso da etapa 5 ("não aparece no aplicativo do celular");
    3. o botão **"Conectar meu Instagram"**, que leva a `/api/oauth/convite/[codigo]`.
- **Com o convite vencido, usado, cancelado ou inexistente,** a página mostra uma frase só: "Este link não vale
  mais. Peça um novo a quem te mandou." A mesma frase para os quatro, para a página não dizer qual é o caso.
- A página não mostra nada do painel: nem o "para quem", nem as contas, nem o nome de ninguém.

### 4. O começo pelo convite, `/api/oauth/convite/[codigo]`

- Já é pública, porque `/api/oauth` está na `PUBLIC_PREFIXES`.
- Confere o convite pelo hash do código. Se ele não estiver pendente, volta para `/convite/[codigo]`, que mostra
  a frase do convite que não vale, sem `state` nenhum.
- Pendente, faz o mesmo que `/api/oauth/login` faz depois da sessão (`route.ts:20-46`):
  - o `redirect_uri` canônico;
  - um `state` novo, no mesmo cookie `metodochat_oauth_state` (httpOnly, secure em produção, sameSite lax,
    path `/api/oauth`, 10 minutos);
  - **e um segundo cookie, `metodochat_oauth_convite`, com o `id` do convite,** com as mesmas opções e o mesmo
    prazo.
- O começo de hoje (`/api/oauth/login`) passa a **apagar** o cookie do convite, para uma conexão normal feita
  depois de um convite no mesmo navegador não ser tratada como convite.

### 5. A volta, `/api/oauth/callback`

- **Sem o cookie do convite,** nada muda.
- **Com o cookie do convite,** a volta segue o caminho do convite:
  1. o `state` é conferido como hoje (`route.ts:34`);
  2. a recusa no Instagram (`?error=`) grava "autorização negada" em `ultimo_erro` e manda para
     `/convite/erro?motivo=negado`;
  3. o convite é lido pelo `id`. Se ele não estiver pendente, manda para `/convite/erro?motivo=vencido`, sem
     chamar a Meta;
  4. a troca do código, o token longo e o perfil, como hoje (`route.ts:42-50`). Uma falha grava o motivo em
     `ultimo_erro` (só se o convite seguir pendente) e manda para `/convite/erro?motivo=falhou`;
  5. **numa transação só,** o convite é reivindicado e a conta é gravada:
     - `update convites_de_conexao set usado_em = now(), conta_conectada = $2 where id = $1 and usado_em is
       null and cancelado_em is null and expira_em > now() returning id`;
     - se a reivindicação não voltar linha nenhuma (o mesmo link usado em outra aba, ou cancelado no meio), a
       conta **não** é gravada, e a volta manda para `/convite/erro?motivo=vencido`;
     - se voltar, o mesmo `insert … on conflict` do `upsertAccount` (`lib/db.ts:427-444`), dentro da
       transação;
  6. a assinatura dos webhooks, como hoje (`route.ts:72-82`): a falha não desfaz a conexão e continua indo
     para o evento `subscribe_failed`;
  7. o destino é `/convite/pronto`. A volta **não** grava o cookie da conta selecionada (`route.ts:91-96`),
     porque quem conectou é o cliente, e não alguém do painel;
  8. os dois cookies, o do `state` e o do convite, são apagados em toda resposta, dê certo ou não.
- **As duas páginas de fim são abertas e fixas:**
  - `/convite/pronto`: "Pronto, sua conta do Instagram foi conectada. Pode fechar esta página.";
  - `/convite/erro`: uma frase por motivo (negado, vencido ou falhou), sempre com "Se precisar, peça um novo
    link a quem te mandou." O motivo vem de uma lista fechada. Nada do texto da Meta chega ao cliente; ele
    fica em `ultimo_erro`, para o painel.

## As regras, em resumo

- O link vale 7 dias e serve para **uma** conexão.
- Só o hash do código é guardado. O link não pode ser recuperado: se se perder, o administrador cancela e gera
  outro.
- A conexão pelo convite pode ser a de uma conta nova ou a reconexão de uma que já existe (o `upsert` renova o
  token). O convite guarda qual conta entrou.
- O degrau 1 continua: enquanto o app da Meta só aceitar testadores, a conta tem de ser adicionada antes.
- Hoje, quem entra no painel gera o convite. Com os logins (a próxima entrega), só o administrador vai gerar.

## O que fica de fora, e por quê

- **Os logins (o ponto 4):** é a entrega seguinte, com spec própria. O Eduardo já decidiu, pela caixa, em
  03/11:
  - o administrador vê tudo, e os outros logins só as contas que receberem;
  - o administrador cria o login (e-mail e senha inicial), sem e-mail de confirmação;
  - a senha única de hoje vira o login com e-mail do administrador e deixa de abrir o painel;
  - pode haver mais de um administrador, marcado no login;
  - um login comum faz tudo nas contas dele, menos a Configuração e os logins;
  - os bônus e os carrosséis continuam do painel inteiro.
- **O acesso avançado da Meta:** tiraria os degraus 1 e 2, mas é um processo do Eduardo no painel da Meta
  (revisão do app e verificação da empresa), e não código. O convite continua servindo depois.
- **O achado 136** (a conexão começada fora do endereço canônico): o link do convite já nasce no endereço
  canônico. Quem abrir o mesmo caminho por outro endereço cai no "state inválido" da volta, sem gravar nada,
  como hoje.
- **Mostrar o link de novo** e **apagar uma conta conectada:** ficam de fora.

## Os testes, escritos antes do código

- **Puros:**
  - o código sorteado (43 caracteres base64url, sem repetir em 1000 sorteios) e o hash (64 hex, o mesmo para o
    mesmo código);
  - o estado do convite, com o relógio fixo: as quatro saídas e as fronteiras (`expira_em` igual a agora é
    vencido);
  - o "para quem": vazio, só espaços, 60 e 61 caracteres;
  - o motivo do erro: só os três da lista viram frase, e qualquer outro valor vira "falhou".
- **Integração, no container, com a Meta falsa no loopback** (a guarda do `IG_GRAPH_BASE` antes de qualquer
  chamada, como em `agendados.integracao.ts`):
  - a ação de gerar, com a sessão de teste: grava o hash e não o código; o link devolvido abre o convite;
  - o começo com o convite pendente: manda para o Instagram com um `state` de 64 hex e grava os dois cookies;
  - o começo com o convite vencido, usado, cancelado ou inexistente: volta para a página, sem cookie nenhum;
  - a volta com o convite: grava a conta, marca o convite como usado com a `conta_conectada`, manda para
    `/convite/pronto` e não grava o cookie da conta;
  - a volta com o convite reivindicado no meio (marcado como usado entre o começo e a volta): não grava a conta;
  - a volta com a Meta em erro: o convite segue pendente, com o `ultimo_erro`;
  - a volta com `?error=`: "autorização negada" no convite;
  - a volta sem o cookie do convite: igual a hoje, para `/?conectado=1` e com o cookie da conta;
  - o começo de hoje apaga o cookie do convite;
  - a ação de cancelar: o convite vira cancelado, e o começo passa a recusar;
  - a tabela nova com o RLS ligado (o teste de `rls-nas-tabelas` já cobre, e conta a tabela nova).
- **Tela:** o bloco da etapa 6 mostra o link uma vez, com o copiar, e a lista com os quatro estados.
- **As mutações,** entre outras: a reivindicação sem o `usado_em is null`; a conta gravada fora da transação; a
  volta do convite gravando o cookie da conta; a página dizendo qual dos quatro casos é; o código guardado no
  lugar do hash; o `/convite` fora da `PUBLIC_PREFIXES`; o começo de hoje sem apagar o cookie do convite.

## A prova

- **A 021 à mão antes, com o OK do Eduardo,** como a 016 e a 018 (`node scripts/migrar.mjs --aplicar
  --a-mao`): o preview lê o banco de produção, e a tabela tem de existir para ele. Uma tabela vazia que nenhum
  código da produção lê não muda nada no painel de hoje. O deploy do merge tem de dizer "Nada a aplicar: as 22
  migrações".
- **No preview,** com o OK do Eduardo e a hora mandada ao auditor antes de cada gravação:
  - gerar um convite: 1 linha nova, com o hash e sem o código;
  - abrir `/convite/[codigo]` no endereço do preview, numa janela anônima: o passo a passo;
  - "Conectar meu Instagram": a tela de autorização do Instagram, **e parar ali**. A volta registrada na Meta é
    a da produção, que ainda não conhece o convite, e o cookie do `state` ficou no endereço do preview;
  - cancelar o convite e abrir a página de novo: "Este link não vale mais".
- **Na produção, depois do merge,** com o OK do Eduardo: gerar um convite, abrir numa janela anônima e
  reconectar a `@saas.metodoia`, a conta de teste que já está conectada.
  - O esperado: o convite usado com a `conta_conectada` dela, o token renovado, a página "Pronto" e as outras
    contas intactas.
  - O auditor lê o banco antes e depois.
