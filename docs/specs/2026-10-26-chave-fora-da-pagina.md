# A chave do app da Meta fora da página de Configuração (achado 123)

**Nascido em:** 26/10/2026, sobre a `main` em `fba3572`, da varredura de segurança desse dia. **Decisão do
Eduardo pela caixa:** "Só consertar o painel". A chave fica parada na Meta, porque o risco de alguém tê-la
copiado é baixo.

---

## O que estava aberto

A etapa 2 da Configuração (`app/setup/page.tsx:290-299`) desenha o campo da chave secreta do app com
`defaultValue={config.instagram_app_secret}`.
- O campo é `type="password"`, então a tela mostra só ●●●●.
- Mas o valor vai inteiro no HTML da página, e quem estiver logado no painel e abrir o código-fonte ou as
  ferramentas do navegador o lê.
- Até a troca da `ADMIN_PASSWORD` em 26/10, a senha do painel estava também com o Dr. Marcus e com a copy.

Com essa chave, dá para assinar webhooks falsos (`app/api/webhook/route.ts:112-117`) e trocar códigos de
OAuth do app. Ela não deveria sair do servidor.

É o único lugar em que ela vai para o navegador: o `git grep` de `instagram_app_secret` e
`meta_app_secret` em `app/` acha só esse `defaultValue` como saída para a tela. O resto é leitura no
servidor (o callback do OAuth, o webhook e as actions).

## O que muda

1. **A tela (`app/setup/page.tsx`):** o campo da chave sai sem `defaultValue`.
   - Com uma chave já gravada, ele deixa de ser obrigatório, e o texto de exemplo diz "Chave configurada ✓
     — deixe em branco para manter".
   - Sem chave gravada, ele continua obrigatório.
   - A tela só sabe SE há chave (um booleano), e nunca o valor.
   - O campo ganha `autoComplete="new-password"`. Vazio, ele é um campo de senha num formulário do mesmo
     site, e o navegador poderia preenchê-lo com a senha do painel que guardou; um salvar distraído
     gravaria essa senha como a chave da Meta.
2. **O salvar (`saveMetaCredentials`, `app/setup/actions.ts`):**
   - com o campo em branco e uma chave já gravada, a chave atual fica como está, e só o App ID (e a URL
     pública, como hoje) é gravado;
   - com o campo em branco e nenhuma chave gravada, a recusa é a de hoje: "Preencha o App ID e a chave
     secreta.";
   - com uma chave nova no campo, ela substitui a antiga, como hoje.

## O que não muda

- O token de verificação do webhook continua na tela (`CopyField`). Ele é feito para ser copiado para a
  Meta, e não dá acesso a nada.
- O callback do OAuth, o webhook, as outras actions e o banco não mudam. Não há migração.

## Os testes, escritos antes do código

`testes-integracao/chave-fora-da-pagina.integracao.ts`, no container:
1. **A página não leva a chave:** com uma chave inventada gravada na `config`, a árvore de
   `app/setup/page.tsx` (lida por `textoDaArvore`) não contém o valor dela, e o texto de exemplo diz que
   ela está configurada.
2. **O salvar em branco mantém a chave:** com a sessão de teste, `saveMetaCredentials` com o campo da chave
   vazio manda para `/setup?salvo=1`, e a `config` continua com a chave de antes.
3. **O salvar em branco sem chave recusa:** sem chave gravada e com o campo vazio, a recusa é a de hoje, e a
   `config` não ganha chave.
4. **A chave nova substitui:** com o campo preenchido, a `config` passa a ter a chave nova.

**Medido sobre a `main`:** o caso 1 cai (o valor está no `defaultValue`) e o caso 2 também (o salvar recusa
o campo vazio). Os casos 3 e 4 passam, porque guardam o comportamento de hoje. O caso 1 confere também que o
App ID, que vai na mesma etapa, aparece na leitura, para que o "não contém a chave" não seja uma leitura que
não alcança o formulário.

**As mutações, cada uma derrubando o caso certo:**
- o valor da chave de volta ao campo derruba o 1;
- o salvar em branco gravando o vazio derruba o 2;
- o salvar em branco recusando sempre derruba o 2;
- a tela sem o "Chave configurada" derruba o 1.

## A prova, no preview

Sem gravar nada: o Eduardo, logado no preview, abre a Configuração e vê o campo da chave vazio, com o texto
"Chave configurada ✓". No código-fonte da página (Ctrl+U), o campo `instagram_app_secret` não tem `value`.
Nenhum botão de salvar é clicado, porque o preview grava na `config` de produção.
