# Experimento: o que chega no webhook quando alguém toca o link pela PRIMEIRA vez

**Data:** 26/08/2026 · **Estado:** instrumento pronto, medição ao vivo pendente do dono.

Este documento **não desenha funcionalidade nenhuma**. Ele monta um instrumento e
diz como lê-lo.

---

## A pergunta

> Quando uma pessoa que **nunca falou** com a conta toca num link do Instagram
> e/ou abre a conversa, o que exatamente chega no nosso webhook?

Ela existe porque a spec `docs/specs/2026-08-26-gatilho-por-link.md` está
desatualizada num ponto, e o ponto é o caso principal: a documentação diz que
`messaging_referral` só ocorre em conversa **que já existe**.

---

## O que a documentação da Meta respondeu — com a frase

As páginas que a spec encontrou em 404 **mudaram de lugar**, não sumiram. Elas
estão hoje em `developers.facebook.com/documentation/business-messaging/…` e em
`developers.facebook.com/docs/instagram-platform/…`, e não mais em
`developers.facebook.com/docs/messenger-platform/…`.

**Página "Instagram Messaging → Webhooks" (lista de eventos).**

- `messaging_referral`: *"A notification is sent when an `ig.me` link with a
  referral parameter is clicked by a customer in an existing conversation"*, e o
  campo `type: "OPEN_THREAD"` traz a nota *"Only supported for existing
  conversations"*.
- `messaging_postbacks`: *"A notification is sent when a customer clicked an
  Icebreaker option or Generic Template button"*.

**Página "Using ig.me Links".** É ela que responde o primeiro contato, e responde
inteiro:

- *"When a user opens an ig.me link to start or continue a conversation with your
  Instagram account, the user is redirected to a new or existing thread, based on
  whether the user had previously messaged your Instagram account."*
- **A PRÉ-CONDIÇÃO, e é ela que decide o desenho:** *"Your Instagram experience
  must have Icebreakers set to receive the referral parameter for new
  conversations"*.
- *"If you have configured Icebreakers for your Instagram Account and the user
  taps on an Icebreaker, your app receives the `messaging_postback` webhook event
  which includes the passed referral parameter."*
- *"If you have configured Icebreakers for your Instagram Account and the user
  doesn't tap on an Icebreaker, and chooses to send a message via the composer,
  your app receives the `messages` webhook event which includes the passed
  referral parameter."*
- *"This action resets the 24-hour window for standard messaging, allowing the app
  to reply after getting the webhook event with the `ref` parameter."*
- Formato: `https://ig.me/m/<USERNAME>?ref=<REF_PARAM>`; o `ref` é *"a string up
  to 2,083 characters in length"* e aceita *"only alphanumeric characters, and
  -, _, ="*.

### O que isso já responde, e o que continua em aberto

| sub-pergunta | resposta da documentação |
|---|---|
| chega algo **antes** de ela digitar? | **Não há frase dizendo que sim.** Todo evento descrito para conversa NOVA depende de um ato dela: tocar numa pergunta de abertura, ou digitar. Ausência de frase não é medição — fica para o teste ao vivo. |
| se ela tocar numa **pergunta de abertura**? | `messaging_postbacks`, com `postback.referral.{ref,source,type}` dentro. |
| o `ref` chega? em qual evento? | Em conversa NOVA: dentro do `postback`, ou dentro do `messages`. Em conversa QUE JÁ EXISTE: em `messaging_referral`. **E só se houver pergunta de abertura configurada.** |
| e quando ela **digita** a primeira mensagem? | `messages` **com o `referral` junto** — mas, de novo, só sob a pré-condição das perguntas de abertura. |

**A pré-condição é a notícia.** Não é o gatilho `link` que não funciona no
primeiro contato: é que, **sem pergunta de abertura configurada, o marcador não
chega no primeiro contato**. As duas coisas que a spec tratou como alternativas
excludentes — link com marcador *ou* perguntas de abertura — são, para o caso que
o produto precisa cobrir, **uma coisa só**.

---

## O que foi medido ao vivo, na Meta, em 26/08

Chamadas de leitura, com o token de cada conta conectada:

- `GET /{ig_user_id}/subscribed_apps` — as **4** contas conectadas assinam hoje
  exatamente `["comments","messages"]`. Nenhuma assina `messaging_referral` nem
  `messaging_postbacks`.
- `GET /v25.0/me/messenger_profile?fields=ice_breakers` — respondeu `200` com
  `{"data":[]}` nas **4** contas. **Nenhuma tem pergunta de abertura.** O `200`
  também prova que o endpoint responde com as permissões que este app já tem.
- `GET https://ig.me/m/thiagovannuchi?ref=…` — `302` para
  `https://www.instagram.com/m/thiagovannuchi`. **O redirecionamento web descarta
  o `?ref`**; quem preserva o marcador é o encaminhamento para o aplicativo, no
  celular. Com user-agent de Android o `ig.me` respondeu `400` — o link é para ser
  **tocado**, não para ser buscado por robô.
- `GET /{app_id}/subscriptions` (nível do APP) — **não deu para ler**: `400`,
  `code 190`. O install só tem as credenciais do login do Instagram; o segredo do
  app da Meta não está salvo. Ver "O que pode dar errado".

---

## O instrumento — as duas mudanças

**1 · A assinatura.** `CAMPOS_DE_WEBHOOK` (lib/ig.ts) passou a valer
`comments,messages,messaging_postbacks,messaging_referral`, num lugar só, lido
pelas duas assinaturas (a da conta e a do app) e pela conferência do `/setup`.

As permissões dos dois campos novos são as **mesmas** de `messages`
(`instagram_business_basic` e `instagram_business_manage_messages`, tabela de
permissões da página de webhooks da Instagram Platform). O "risco secundário" da
spec — revisão nova da Meta — **não se aplica**.

**2 · O registro do que não é tratado.** `app/api/webhook/route.ts` deixou de
descartar calado: `field` desconhecido em `changes` vira
`webhook_campo_nao_tratado`, e item de `messaging` sem `message` vira
`webhook_messaging_nao_tratado`. Nos dois casos o payload vai **cru**, inteiro.
`messaging_referral` e `messaging_postbacks` chegam sem `message` — eram
exatamente a forma que o ramo antigo jogava fora.

Isso é **aditivo e permanente**, e o porquê está escrito no arquivo.

---

## Como reassinar a conta já conectada, SEM desconectar

**Existe caminho, e ele já está de pé.**

A inscrição por conta é gravada **uma vez**, no OAuth
(`app/api/oauth/callback/route.ts`). Mudar a string não reassina ninguém. Mas
`app/setup/actions.ts` tem `reassinarWebhooks()`, que percorre `listAccounts()` e
chama `subscribeToWebhooks` em cada uma — **sem tocar no token e sem
desconectar** —, e ela está exposta como o botão **"Reassinar webhooks"**, em
`app/setup/subscription-status.tsx`, dentro da seção *Diagnóstico das contas* do
`/setup`.

Ordem para o dono, depois que o deploy subir:

1. Abrir `/setup` → *Diagnóstico das contas*.
2. Cada conta deve aparecer com **"falta assinar: messaging_postbacks,
   messaging_referral"** — a conferência agora lê a mesma lista que a inscrição
   escreve, e diz **quais** campos faltam.
3. Apertar **"Reassinar webhooks"**. As quatro devem virar **"recebendo eventos ✓"**.

Se depois disso alguma continuar incompleta, o problema é o **outro** nível de
assinatura — ver o fim deste documento.

---

## O link, pronto para tocar

Formato: `https://ig.me/m/<username>?ref=<marcador>`.

**Conta @vannuchi.eng** (`17841454481842903`), para o caso **primeiro contato de
verdade**:

```
https://ig.me/m/vannuchi.eng?ref=exp-primeiro-contato-a
```

**Conta principal @thiagovannuchi** (`17841403483234337`, 5 777 eventos, 95
contatos), para o caso **conversa que já existe**:

```
https://ig.me/m/thiagovannuchi?ref=exp-primeiro-contato-b
```

Por que duas contas, e não uma: **medido no banco**, os dois perfis autorizados —
`@jvsiqueira_` e `@alicistica` — **já têm linha em `contacts` para
@thiagovannuchi**. Nenhum dos dois consegue fazer o papel de "nunca falou" nessa
conta. `@jvsiqueira_` **não** tem linha em `contacts` para @vannuchi.eng, e é o
único par disponível para o primeiro contato.

O marcador usa só letra, número e hífen — dentro do que o `ref` aceita.

---

## O roteiro — três linhas, na ordem

1. **Primeiro contato, sem digitar.** De `@jvsiqueira_`, no **celular**, toque
   `https://ig.me/m/vannuchi.eng?ref=exp-primeiro-contato-a`, deixe a conversa
   abrir e **não digite nada**. Espere um minuto e abra `/eventos`.
2. **Primeiro contato, digitando.** Na mesma conversa, ainda de `@jvsiqueira_`,
   mande **"oi"**. Volte a `/eventos`.
3. **Conversa que já existe.** De `@alicistica`, no celular, toque
   `https://ig.me/m/thiagovannuchi?ref=exp-primeiro-contato-b` e **não digite
   nada**. Volte a `/eventos`.

Nada é disparado para ninguém: quem toca é o dono, dos perfis autorizados.

---

## Como ler o resultado

Em `/eventos`, procurar as linhas **"Evento de conversa ainda sem tratamento"** e
**"Campo de webhook ainda sem tratamento"**, e olhar o payload cru.

| o que aparece | o que fica provado |
|---|---|
| nada, depois do passo 1 | **Não chega nada antes de a pessoa agir.** O gatilho `link` não pode disparar sozinho no primeiro contato, e a spec muda como ela mesma previu. |
| um item de `messaging` com `referral`, no passo 1 | O evento chega antes de digitar. É o melhor caso, e contraria a leitura literal da documentação. |
| no passo 2, um `message` **sem** `referral` | Confirma a pré-condição: **sem pergunta de abertura, o marcador não sobrevive ao primeiro contato.** |
| no passo 2, um `message` **com** `referral` | A pré-condição das perguntas de abertura não vale como está escrita. |
| no passo 3, um item com `referral: {ref, source, type}` | `messaging_referral` funciona em conversa existente, como a documentação diz. |

**A previsão honesta, para ser derrubada pela medição:** com `ice_breakers` vazio
nas quatro contas — medido —, os passos 1 e 2 devem mostrar **ausência de `ref`**.
Isso não é defeito do experimento: é a pré-condição da documentação aparecendo na
tela. A segunda rodada, depois de configurar as perguntas de abertura, é que
separa "a documentação está certa" de "a documentação está desatualizada".

---

## Como configurar as perguntas de abertura, quando for a hora

Endpoint medido — host e versão iguais aos que este app já usa
(`graph.instagram.com`, `v25.0`):

```
POST https://graph.instagram.com/v25.0/<IG_USER_ID>/messenger_profile
Content-Type: application/json

{"platform":"instagram","ice_breakers":[{"call_to_actions":[
  {"question":"<PERGUNTA_1>","payload":"<PAYLOAD_1>"},
  {"question":"<PERGUNTA_2>","payload":"<PAYLOAD_2>"}
]}]}
```

Ler: `GET /v25.0/me/messenger_profile?fields=ice_breakers`.
Apagar: `DELETE /v25.0/me/messenger_profile` com `{"fields":["ice_breakers"]}`.

Permissões: `instagram_business_basic` e `instagram_business_manage_messages` —
as mesmas que o app já tem, e a leitura respondendo `200` hoje é a prova.

Limites, e eles doem no desenho: **no máximo 4 perguntas para a conta inteira**, e
*"Ice Breakers are currently not available on desktop"*. O `payload` de cada
pergunta volta dentro do `messaging_postbacks` — é o mesmo formato de marcador que
os botões de resposta rápida já usam neste produto (`lerPayload`, lib/steps.ts).

---

## O que pode dar errado, escrito antes

**São DUAS assinaturas, não uma.** A da conta
(`/{ig_user_id}/subscribed_apps`) e a do app (`/{app_id}/subscriptions`, no Graph
do Facebook, com a lista de `fields` do objeto `instagram`). As duas precisam
listar o campo. O botão "Reassinar webhooks" só mexe na **primeira**.

A segunda **não pôde ser lida daqui**: `400`, `code 190`, porque o install não tem
o segredo do app da Meta salvo — o webhook do app foi configurado à mão no painel,
e não pelo botão de configuração automática. **Se depois de reassinar nada chegar
nos passos 1–3, é aqui que está o problema:** no painel da Meta, em *Webhooks →
Instagram → Gerenciar*, marcar também `messaging_postbacks` e
`messaging_referral`.
