# O gerador de bônus — Etapa 8: o carrossel sem palavra-chave

**Nascido em:** 08/10/2026, desenhado com o Eduardo pela caixa de perguntas, sobre a `main` em
`3d96638` (a Etapa 7 em produção desde 08/10, 12:19Z). É o passo curto que o Eduardo decidiu em
07/10, durante a prova da Etapa 7: "Depois do merge da Etapa 7".
**Estado:** desenho aprovado pelo Eduardo em três partes (a tela, por dentro, os testes e a prova);
revisado pela auditoria, com o achado 85 absorvido (as duas regras do Labs) e a lista "Carrosséis"
decidida pelo Eduardo (não muda).
**Projeto de quem:** do Vinícius Gualberto. Como as etapas anteriores, entra como visita: pasta
própria, e nenhum arquivo do `/publicar` nem das automações muda.
**Etapa anterior:** `docs/specs/2026-10-06-carrossel-avulso.md`.

---

## O que é

Hoje todo carrossel é montado em torno de "comente PALAVRA": a chamada final e a legenda pedem a
palavra, a conferência do texto exige que peçam, e depois de publicar o Chat avisa que o funil da
palavra tem de ser ligado no `/automacoes`. No texto livre a palavra é obrigatória
(`lib/bonus/avulso-pedido.ts:70-71`), e um bônus do Labs sem palavra nem aparece na lista de
escolha.

Esta etapa traz o **carrossel sem palavra-chave**: a chamada final pede outra ação (salvar o post,
compartilhar, seguir o perfil ou comentar a opinião), e não há funil. Ela vale para o texto livre e
para o bônus do Labs que não tem palavra. O carrossel de bônus do Chat e o bônus do Labs com palavra
continuam como hoje.

Entram junto dois achados da auditoria de 07/10, apontados pelo Labs:
- **83:** os comentários do código e a spec da Etapa 7 dizem que a lista pública do Labs está fora
  do contrato. Ela está no contrato desde 01/10 (site-ia, `docs/contrato-metodo-chat.md`, seção do
  `GET /api/bonus`, na `main` deles por `a56459b`), e lá `palavraChave` e `tema` são opcionais;
- **84:** a lista de escolha do "Novo carrossel" deixa de fora, sem contar e sem aviso, o bônus do
  Labs sem palavra ou sem tema (`lib/bonus/publicado.ts:116-126`).

---

## As decisões, e de quem

Todas do Eduardo, pela caixa, em 08/10:

| assunto | decisão |
|---|---|
| o que a chamada pede sem palavra | o operador escolhe numa lista: salvar o post, compartilhar, seguir o perfil ou comentar a opinião. A IA, ou o operador no "Escrever à mão", escreve a chamada em cima da ação |
| onde vale | no texto livre (o operador marca "Sem palavra-chave") e no bônus do Labs que não tem palavra. O bônus com palavra, do Chat ou do Labs, sempre usa a palavra |
| onde guardar | uma migração 017: a `palavra` passa a aceitar nulo, e uma coluna nova guarda a ação, com o banco amarrando as duas |
| a tela (parte 1) | aprovada: "Sem palavra-chave" no texto livre, o bônus do Labs sem palavra marcado na lista, a contagem dos que ficam de fora, a ação no topo da página, sem o aviso do funil |
| a lista "Carrosséis" | não muda: ela não mostra a palavra hoje, e não passa a mostrar a ação (decidido depois da revisão da auditoria) |
| por dentro (parte 2) e os testes e a prova (parte 3) | aprovados como estão nesta spec |

---

## A tela

### "Novo carrossel" (`/carrosseis/novo`)

- **Texto livre.** Junto da palavra-chave, uma caixa de marcar **"Sem palavra-chave"**. Marcada:
  - o campo da palavra some, e o que estava digitado nele não vai no pedido;
  - aparece **"O que a chamada pede"**, com quatro opções, nenhuma marcada de início:
    "Salvar o post", "Compartilhar", "Seguir o perfil" e "Comentar a opinião". Sem escolher uma,
    o pedido é recusado com frase própria.
- **Bônus do Labs.** O bônus publicado sem `palavraChave` aparece na lista, com "sem palavra-chave"
  no lugar de "Palavra X". Escolhido, aparece "O que a chamada pede", como no texto livre. O bônus
  com palavra não mostra essa escolha: o carrossel dele pede a palavra.
- **Os bônus que ficam de fora.** Abaixo da lista, quando houver: "N bônus do Labs não aparecem:
  A sem tema, B com a palavra fora do padrão do Chat (de 3 a 30 letras maiúsculas ou números) e C
  num formato que o Chat não lê." Só as partes que existem. Hoje são 0 (medido pela auditoria em
  07/10: os 59 itens têm palavra e tema).
- **"Escrever à mão".** Os campos são os de hoje. Sem palavra, o aviso na hora da chamada deixa de
  ser "precisa pedir a palavra X" e passa a ser o da palavra em maiúsculas (abaixo); a legenda fica
  sem aviso.
- **"Gerar com a IA"** e o teto diário funcionam como hoje.

### A página do carrossel (`/carrosseis/[cid]`)

- O topo, que hoje diz "palavra X" (`app/carrosseis/[cid]/page.tsx:77`), passa a dizer "sem
  palavra-chave · a chamada pede: salvar o post" (ou a ação gravada).
- Num avulso do Labs, o aviso de palavra trocada (`app/carrosseis/[cid]/page.tsx:66` e `:88`)
  cobre os dois lados novos:
  - feito sem palavra, e o bônus agora tem palavra no Labs: "No Labs, este bônus agora tem a
    palavra X. Este carrossel foi feito sem palavra-chave; para usar a palavra, crie um carrossel
    novo.";
  - feito com palavra, e o bônus perdeu a palavra no Labs: "No Labs, este bônus não tem mais
    palavra-chave. Este carrossel pede a palavra X: confira se a automação dela ainda existe."
- O card "Publicar" não mostra o aviso do funil (`textoDoFunil`, `lib/bonus/publicar-textos.ts:67`,
  devolve nada sem palavra).
- O resto da página é o de hoje: os cards, a arte, a foto, o slide pronto, baixar, publicar e
  agendar.

### A lista "Carrosséis" (`/carrosseis`)

Não muda. Ela não mostra a palavra hoje (`itemDaListaDeCarrosseis`,
`lib/bonus/carrosseis-tela.ts:30-41`: título, origem, conta e tamanho, geração e publicação), e
continua sem mostrar a palavra ou a ação, por decisão do Eduardo em 08/10, depois da revisão da
auditoria. A palavra ou a ação aparece só no topo da página de cada carrossel.

---

## Por dentro

### A migração 017

Hoje `carrosseis_gerados.palavra` é `text not null` (`migrations/014-carrosseis-gerados.sql:22`;
medido pela auditoria em 08/10: nulo = NO). A 017:

- tira o `not null` de `palavra` (só metadado: nenhuma linha muda);
- acrescenta `acao_da_chamada text`, nula nas linhas de hoje;
- amarra as colunas com quatro `check`:
  - `acao_da_chamada in ('salvar', 'compartilhar', 'seguir', 'comentar')` (o nulo passa);
  - `(palavra is null) = (acao_da_chamada is not null)`: ou palavra, ou ação, nunca as duas e
    nunca nenhuma;
  - `origem <> 'bonus' or palavra is not null`: o carrossel de bônus do Chat sempre tem palavra;
  - `palavra <> ''`: a palavra vazia não é um terceiro jeito de dizer "sem palavra" (o nulo passa).

Ela segue o molde da 016: idempotente (`add column if not exists`, `drop constraint if exists` e
`add`), declarada em `naoObservaveis` de `lib/esquema.ts`, com o motivo, como a 014, a 015 e a 016.
Quem confere as colunas e os `check` é `testes-integracao/bonus-carrossel-tabela.integracao.ts`.
**O `scripts/migrar.mjs` não muda (achado 82).**

**É aplicada à mão na produção ANTES da prova no preview**, como a 016: o ensaio a seco, a linha de
base da auditoria, `node scripts/migrar.mjs --aplicar --a-mao` com o OK do Eduardo e o "pode" da
auditoria, e a conferência dela depois, só de leitura. O build do merge diz "Nada a aplicar". Os
comandos da 017 não mudam depois de aplicada: a soma registrada é a dos comandos, e um comando
mudado para o build do merge.

**É segura com o código de hoje no ar.** O código da Etapa 7 sempre grava a palavra e nunca a ação,
e lê com `select *`, que ignora coluna nova. Durante a prova, a linha sem palavra existe no banco
de produção. A auditoria rodou o código de `3d96638` com uma linha de palavra nula, sem banco, em
08/10: nenhuma função lança. O código de hoje mostraria o topo de `/carrosseis/[cid]` com "palavra"
sem nada depois, recusaria salvar um slide dela com "precisa pedir a palavra null", e, com o
carrossel agendado, o aviso do funil diria "da palavra null". Uma aba velha que tentasse gravar uma
linha sem palavra e sem ação seria barrada pelo `check` `(palavra is null) = (acao_da_chamada is
not null)`. Ninguém grava nela pela produção, e ela sai na devolução. A prova mede a página real
(passo 4).

O tipo `LinhaDoCarrossel` (`lib/bonus/carrossel-linha.ts:17`) passa a ter `palavra: string | null`
e `acao_da_chamada`. O compilador aponta cada uso da palavra, e cada um vira uma decisão, como o
`bonus_id` na Etapa 7.

### A ação da chamada

Um tipo novo, `AcaoDaChamada = "salvar" | "compartilhar" | "seguir" | "comentar"`, com o rótulo da
tela e a frase do pedido à IA de cada uma, numa função pura:

| ação | na tela | no pedido à IA |
|---|---|---|
| `salvar` | Salvar o post | peça para salvar o post |
| `compartilhar` | Compartilhar | peça para compartilhar o post com quem precisa ver |
| `seguir` | Seguir o perfil | peça para seguir o perfil |
| `comentar` | Comentar a opinião | peça para comentar a opinião, sem palavra-chave |

O valor vem do formulário e só vale se for um dos quatro; o banco confere de novo.

### O pedido

- **Texto livre** (`lerPedidoAvulso`, `lib/bonus/avulso-pedido.ts`): com "Sem palavra-chave", a
  palavra não é lida e a ação é exigida; sem a caixa marcada, é o de hoje (a palavra com
  `palavraValida`, `lib/bonus/pedido.ts:42`). A recusa nova: "Escolha o que a chamada pede."
- **Bônus do Labs:** a palavra vem do Labs, como hoje. Se o bônus não tem palavra, a ação é exigida;
  se tem, a ação que vier do formulário é ignorada.

### A lista do Labs (achado 84)

Hoje `situacaoDoItem` (`lib/bonus/publicado.ts:83-101`) confere a palavra antes do tema e devolve
`sem_palavra`, `palavra_fora_do_padrao`, `sem_tema` ou `formato_estranho`, e `bonusDaLista`
(`:116-126`) descarta tudo que não é "publicado", sem contar.

Hoje essa regra é UMA só, e serve a dois caminhos (achado 85): `situacaoDoItem` é chamada por
`situacaoNaLista` (`:79`), que é o caminho do carrossel de bônus do Chat (`situacaoNoLabs`, `:169`,
em `app/bonus/carrossel-actions.ts:98` e `app/bonus/[id]/carrossel/[cid]/page.tsx:113`) e também o
do avulso do Labs pelo código (`app/carrosseis/actions.ts:38`, `doLabs` em
`lib/bonus/avulso-processo.ts:34-41`, e o topo de `app/carrosseis/[cid]/page.tsx:63`); e por
`bonusDaLista` (`:121`). Mudar a ordem dentro dela mudaria o bônus do Chat. Por isso passam a ser
**duas regras**:

- **A do bônus do Chat é a de hoje, sem mudança.** `situacaoNaLista` continua devolvendo
  `sem_palavra` para o bônus sem palavra, inclusive o "sem palavra E sem tema"
  (`tests/bonus-publicado.test.ts:53-55`, que fica intacto), com a frase de hoje
  (`lib/bonus/carrossel-textos.ts:73`). O banco continua exigindo a palavra nele.
- **A do avulso do Labs é nova**, e vale nos três lugares do avulso: a lista de escolha, o pedido
  pelo código e o "Gerar de novo" (os dois últimos por `doLabs`), além do topo da página do avulso.
  O bônus sem `palavraChave` (a chave ausente ou o texto em branco, como o contrato manda) e com
  tema é "publicado" com a palavra nula. O sem tema fica de fora com ou sem palavra.
- **A lista de escolha devolve também a contagem** dos que ficaram de fora pela regra do avulso, por
  motivo (sem tema, palavra fora do padrão, formato que o Chat não lê), e a tela mostra a frase.
- Uma prova de mutação troca as duas regras de lugar, e um teste de cada lado cai.

### O pedido à IA

A instrução do sistema (a do Labs, `lib/bonus/instrucao-carrossel.ts`) não muda. Ela diz que o
pedido padrão da chamada é comentar uma palavra-chave (`:69`); o pedido extra do Chat já a
contradiz no número de slides, e passa a contradizer também aqui.

`pedidoExtra` (`lib/bonus/carrossel-ia-parametros.ts:70`) recebe a palavra ou a ação. Sem palavra,
no lugar de `pedirPalavra` (`:57-60`): "Na chamada para ação, <a frase da ação>. Este post não tem
palavra-chave: não peça para comentar uma palavra. Na chamada, nenhuma palavra vai toda em
maiúsculas, fora VENCE do bordão. Termine a legenda no mesmo pedido." O post de 1 slide recebe o
mesmo trecho.

### A conferência do texto

`conferirGerado` (`lib/bonus/carrossel-texto.ts:117-125`) e a revisão (`conferirCampos`, `:207`, com
as regras da palavra em `:220-231`, usada por `lerRevisaoDoCarrossel`, `:196`, e por `juntarParte`,
`:280`) recebem a palavra nula. Sem palavra:

- a chamada não pode ter **nenhuma** palavra gritada (as de `outrasGritadas`, `:98`, com a mesma
  lista de permitidas, que tem o VENCE). Uma chamada "Comente GUIA" sem automação deixaria quem
  comentou sem resposta, que é a falha que o Labs registrou em `src/lib/ia/funil.ts`. A frase:
  "a chamada não pode ter palavra em maiúsculas: este carrossel não tem palavra-chave";
- a legenda não tem exigência de palavra;
- o Chat **não confere** se a chamada pede a ação escolhida: isso fica com o operador, na revisão.

A tela do campo (`app/bonus/[id]/carrossel/[cid]/campo.tsx:49-53`) avisa na hora pela mesma regra.

### O "Gerar de novo"

`gerarAvulsoDeNovo` (`lib/bonus/avulso-processo.ts`):
- **texto livre:** repete o contexto, a palavra nula e a ação gravados;
- **bônus do Labs:** relê o bônus no Labs pelo código, como hoje. Com palavra lá, o carrossel novo
  sai com a palavra. Sem palavra lá, sai com a ação gravada; se o carrossel que falhou tinha palavra
  (e por isso não tem ação gravada), a recusa diz: "No Labs, este bônus não tem mais palavra-chave.
  Crie um carrossel novo e escolha o que a chamada pede."

### O que não muda

- A arte e o desenho do slide (a palavra não entra na arte), os vetores combinados com o Labs, o
  publicar e o agendar da Etapa 5, a trava, a reserva, a conta e o teto.
- O carrossel de bônus do Chat, inteiro.
- Nenhum arquivo do `/publicar`, do bucket, do dreno, da fila nem das automações. O diff fica em
  `app/bonus/`, `app/carrosseis/`, `lib/bonus/`, `migrations/017-…`, `lib/esquema.ts` (só a
  declaração da 017), testes e `docs/`.

### Os comentários do contrato (achado 83)

Os comentários de `lib/bonus/publicado.ts:3`, `lib/bonus/temas.ts:3` e
`app/carrosseis/novo/page.tsx:12` passam a dizer que a lista está no contrato desde 01/10 e que a
leitura falha fechada porque `palavraChave`, `tema` e `skillId` são opcionais (a chave some do JSON).
A frase de `docs/specs/2026-10-06-carrossel-avulso.md:183` ganha uma nota de correção, com a data,
sem reescrever a spec antiga.

---

## Segurança

- As actions continuam começando por `exigirSessao()`, e a conta continua vindo do cookie.
- A ação vem do formulário, mas só vale um dos quatro valores, conferido no pedido e no banco.
- O código do Labs continua valendo só se estiver na lista lida na hora; a palavra e o tema vêm de
  lá, nunca do formulário.

---

## Testes

| suíte | o quê |
|---|---|
| integração | a 017 no banco descartável: as colunas; as linhas antigas com palavra e sem ação; os quatro `check` recusando palavra e ação juntas, nenhuma das duas, bônus do Chat sem palavra, ação fora das quatro e palavra vazia; a 017 reaplicada sem erro |
| pura | o pedido do texto livre: com a caixa, a ação exigida e a palavra ignorada; sem a caixa, o de hoje |
| pura | o pedido do Labs: sem palavra, a ação exigida; com palavra, a ação ignorada |
| pura | a lista do Labs: o sem palavra entra com a palavra nula; o sem tema fica de fora mesmo sem palavra; a contagem por motivo; a frase dos que ficam de fora |
| pura | o bônus do Chat sem palavra continua com a frase de hoje |
| pura | o pedido à IA sem palavra: a frase da ação, sem "comentar a palavra", nos dois formatos (carrossel e post) |
| pura | a conferência sem palavra: recusa a chamada com palavra gritada, aceita o VENCE, não exige nada da legenda |
| pura | o aviso do funil some sem palavra; o topo da página diz a ação; a linha da lista "Carrosséis" é igual com e sem palavra |
| pura | as duas regras do Labs: a do bônus do Chat igual à de hoje (`tests/bonus-publicado.test.ts:53-55` intacto) e a do avulso com o sem palavra "publicado" |
| pura | os dois avisos novos de palavra trocada |
| integração | criar o avulso sem palavra, do texto livre (pela IA falsa e à mão) e do Labs (com a lista falsa); o escrito à mão sem palavra nasce pronto e fora do teto |
| integração | o "Gerar de novo": o livre repete a ação; o do Labs segue o Labs, e recusa o que perdeu a palavra |
| integração | publicar e agendar um carrossel sem palavra, pelo mesmo caminho dos outros |
| tela | o "Novo carrossel": a caixa "Sem palavra-chave", a escolha da ação, o bônus do Labs sem palavra na lista e a frase dos que ficam de fora |
| tela | o campo da chamada sem palavra avisando a palavra gritada |
| guardas | toda action começa por `exigirSessao`; nenhum arquivo do `/publicar`, das automações nem do `scripts/migrar.mjs` no diff |

Cada proteção principal ganha uma prova de mutação: retirada de propósito, o teste certo cai.

---

## A prova real

No preview, com o Eduardo na tela. Cada gravação tem o OK dele, e a auditoria lê o banco antes e
depois. O preview usa o banco e o bucket de produção. **Sem post real.** Antes de tudo, a 017
aplicada à mão na produção.

1. "Novo carrossel" → texto livre → "Sem palavra-chave" → "Salvar o post" → "Escrever à mão": o
   carrossel nasce pronto, com a palavra nula e a ação `salvar`, sem gastar IA.
2. Na página dele: o topo com "sem palavra-chave · a chamada pede: salvar o post"; a chamada com uma
   palavra em maiúsculas recusada ao salvar.
3. Agendar para daqui a 7 dias e cancelar no calendário, sem o aviso do funil.
4. Com o carrossel da prova ainda no banco, o Eduardo abre na produção (`metodochat.vercel.app`) a
   lista `/carrosseis` e a página do carrossel da prova, só olhando, sem salvar nada: é a medição
   da página real com o código de hoje.

No fim, o que a prova criou sai do banco e do bucket, com o OK do Eduardo e o script lido pela
auditoria antes de rodar (achado 77).

**Fica sem medir:** o bônus do Labs sem palavra (não existe nenhum hoje, e o preview não tem a
`LABS_URL`) e o "Gerar com a IA" (sem a chave no preview e sem crédito).

---

## Pré-condições do merge

1. `npm run verify` limpo, a integração verde no container, e o preview com a prova feita.
2. A 017 aplicada à mão antes da prova, com a linha de base da auditoria antes e a conferência dela
   depois, só de leitura; o build do merge diz "Nada a aplicar".
3. Nenhum `next dev` apontado para a produção durante o deploy, e as abas recarregadas depois.

---

## Fora desta etapa

- Conferir que a chamada pede a ação escolhida (fica com o operador, na revisão).
- A legenda sem palavra não tem regra nenhuma, e a regra da chamada pega só a palavra em
  maiúsculas: um "comente quero", em minúsculas, passa na chamada e na legenda. A instrução do Labs
  diz que o pedido padrão é comentar uma palavra-chave (`lib/bonus/instrucao-carrossel.ts:69`), e o
  pedido extra manda não pedir; o que escapar disso fica com o operador, na revisão.
- O carrossel sem palavra num bônus que tem palavra.
- Ligar o funil sozinho: criar a automação da palavra presa ao post novo.
- O criador de imagem (Etapa 6) e subir o carrossel inteiro do Canva de uma vez.
