# O gerador de bônus — Etapa 7: o carrossel avulso

**Nascido em:** 06/10/2026, desenhado com o Eduardo pela caixa de perguntas, com a sessão auditora
levantando os riscos (medidos no código da `main` em `bf1bb32`, com a Etapa 5 em produção).
**Estado:** desenho aprovado pelo Eduardo ("Sim, está certo"); esperando a revisão da auditoria.
**Projeto de quem:** do Vinícius Gualberto. Como as etapas anteriores, entra como visita: pasta
própria, e nenhum arquivo do `/publicar` nem das automações muda.
**Etapas anteriores:** `docs/specs/2026-09-29-gerador-de-bonus.md`,
`docs/specs/2026-09-30-gerador-de-carrossel.md`, `docs/specs/2026-10-01-arte-do-carrossel.md`,
`docs/specs/2026-10-02-pagina-do-carrossel.md` e `docs/specs/2026-10-05-publicar-do-carrossel.md`.

---

## O que é

Até a Etapa 5, o Chat só faz carrossel de um bônus que ele mesmo gerou e enviou ao Método Labs: o
pedido de carrossel exige o bônus do Chat criado e publicado lá (`bonusParaCarrossel`,
`app/bonus/carrossel-actions.ts:91`). Em 06/10, o bônus BRUTAL ("Conselheiro brutalmente honesto")
nasceu no Notion e foi criado direto no Labs, e o Chat não tinha como fazer o carrossel dele.

Esta etapa traz o **carrossel avulso**: um carrossel que nasce de um bônus que já está no Labs, ou de
um texto livre, sem bônus do Chat. A página de cada carrossel continua a mesma da Etapa 5: editar,
foto no espaço, slide pronto do Canva, baixar, publicar e agendar.

---

## As decisões, e de quem

Todas do Eduardo, pela caixa, em 06/10:

| assunto | decisão |
|---|---|
| a origem do conteúdo | os dois: um bônus que já está no Labs, ou um tema e um texto livre (colado do Notion, ou uma ideia sem bônus) |
| o texto dos slides | a IA escreve, como hoje, a partir da origem; e há o "Escrever à mão", que cria o carrossel com o texto que o operador escreve ou cola, sem gastar IA |
| onde mora | um item novo **"Carrosséis"** no menu, com a lista de todos (os dos bônus e os avulsos) e o botão **"Novo carrossel"** |
| o funil depois de publicar | fora desta etapa: o Eduardo liga a automação da palavra no `/automacoes`, e a página avisa depois de publicar |
| a forma de guardar | uma migração pequena na tabela dos carrosséis (o caminho recomendado; os outros dois estão em "Por dentro") |

---

## A página

### O menu "Carrosséis" (`/carrosseis`)

- Lista todos os carrosséis, do mais novo para o mais velho: os dos bônus e os avulsos.
- Cada linha mostra:
  - o título (o do texto, quando pronto);
  - a origem: "Bônus do Chat", "Bônus do Labs: <título>" ou "Texto livre";
  - a conta (o @);
  - o número de slides;
  - o estado (gerando, pronto, falhou);
  - e, quando há publicação, o estado dela (agendado, publicado, cancelado).
- O botão **"Novo carrossel"** leva a `/carrosseis/novo`.
- Clicar numa linha abre a página do carrossel: a de hoje para o carrossel de bônus
  (`/bonus/[id]/carrossel/[cid]`) e a nova para o avulso (`/carrosseis/[cid]`).

### "Novo carrossel" (`/carrosseis/novo`)

O operador escolhe a origem e o jeito do texto:

- **De um bônus do Labs.** Uma lista dos bônus publicados no Labs, com busca pelo título. O Chat lê de
  lá o título, a descrição, o tema e a palavra; o operador não digita a palavra (um erro de
  digitação quebraria o funil). Um campo opcional, **"O que destacar"**, vai para a IA no lugar do "o
  que resolve" do bônus do Chat.
- **De um texto livre.** Os campos:
  - **Tema**, até 80 caracteres;
  - **Palavra-chave**, obrigatória, com a mesma regra do pedido do bônus (`palavraValida`: de 3 a 30
    letras maiúsculas ou números, uma palavra só);
  - **Conteúdo**, de 20 a 8 000 caracteres: o que o post divulga, escrito ou colado do Notion.
- **Quantos slides**, de 1 a 10, como hoje.
- Dois botões:
  - **"Gerar com a IA"**: pede o texto à IA, como o carrossel de bônus. Conta no teto diário de
    carrosséis.
  - **"Escrever à mão"**: mostra os campos do carrossel para o número de slides escolhido (gancho,
    título e texto de cada slide do meio, chamada e legenda; no post de 1 slide, texto, chamada e
    legenda). Os campos e os limites são os de `camposDoFormulario`, e a conferência é a de
    `lerRevisaoDoCarrossel` (`lib/bonus/carrossel-texto.ts:196`), o carrossel inteiro de uma vez,
    com a chamada e a legenda pedindo a palavra. Cada recusa diz o campo e o motivo, e o que foi
    digitado fica na tela. O carrossel nasce pronto, com o texto escrito, e não gasta IA nem conta
    no teto.

O carrossel nasce na conta selecionada no menu, gravada no carrossel, como hoje (spec da Etapa 4).

### A página do carrossel avulso (`/carrosseis/[cid]`)

A mesma página da Etapa 5, com os mesmos componentes: os cards dos slides, a legenda, o "Baixar
todos", o upload da foto e do slide pronto, e o card "Publicar". Muda só o topo:

- o título e a origem ("Bônus do Labs: <título>", com o link da página pública dele, montado por
  `urlPublicaDoBonus` como na página do bônus; ou "Texto livre: <tema>");
- a palavra-chave;
- no avulso que veio do Labs, o mesmo aviso de hoje quando a palavra mudou lá depois de gerar
  (`avisoDePalavraTrocada`), e quando o bônus deixou de estar publicado;
- no que falhou na IA, o **"Gerar de novo"**. No do Labs, ele relê o Labs pelo código, como o de
  bônus faz hoje (`gerarCarrosselDeNovo`, `app/bonus/carrossel-actions.ts:143`). No do texto livre,
  ele reaproveita o tema, o conteúdo e a palavra gravados no carrossel que falhou, porque não há
  outro lugar de onde lê-los.

### O aviso do funil, em todos os carrosséis

Depois de publicar ou agendar, o card "Publicar" mostra:

> O funil não liga sozinho: depois que o post sair, crie no /automacoes a automação da palavra
> **X** para este post.

com o link do `/automacoes`. Vale para o carrossel de bônus também, porque o problema é o mesmo: o
post é novo, e as automações da palavra que já existem estão presas a outros posts
(`lib/engine.ts:269`).

---

## Por dentro

### A migração 016

Hoje `carrosseis_gerados.bonus_id` é `uuid not null references bonus_gerados (id) on delete cascade`
(`migrations/014-carrosseis-gerados.sql:17`). A 016:

- tira o `not null` de `bonus_id` (só metadado: nenhuma linha muda);
- acrescenta `origem text not null default 'bonus'`, com `check (origem in ('bonus', 'labs',
  'livre'))`. As linhas de hoje ficam `'bonus'` pelo padrão;
- acrescenta `labs_codigo text`: o código (o slug) do bônus do Labs, só na origem `'labs'`;
- acrescenta `texto_a_mao boolean not null default false`: o carrossel escrito à mão, que não conta
  no teto;
- amarra as colunas com dois `check`:
  - `(origem = 'bonus') = (bonus_id is not null)`;
  - `(origem = 'labs') = (labs_codigo is not null)`.

O tipo `LinhaDoCarrossel` (`lib/bonus/carrossel-linha.ts`) ganha as três colunas, e `bonus_id`
passa a `string | null`. O compilador aponta cada uso de `bonus_id` que supõe o bônus, e cada um
vira uma decisão pela origem.

**O teto** (`TETO_CARROSSEL_DIARIO`) passa a contar só os carrosséis que pediram a IA: as duas
contagens, a da tela (`carrosseisNasUltimas24h`) e a do pedido, dentro da trava
(`criarPedidoDeCarrossel`), ganham `and not texto_a_mao`. O escrito à mão não passa pela trava.

O build de produção aplica a 016 no merge ("MODO: APLICANDO"), e ela segue o protocolo da 015:

- uma leitura de linha de base, só leitura, antes;
- as conferências de esquema novas no `scripts/migrar.mjs`, para as colunas e os `check`;
- a conferência depois do deploy.

**Os dois caminhos que ficaram de fora:**
- uma tabela própria para os avulsos, que duplicaria a página, o publicar, a trava e os testes;
- um bônus "de mentira" em `bonus_gerados` para cada avulso, sem DDL. Ele se misturaria com a lista
  do `/bonus` e com o envio ao Labs (a auditoria desaconselhou).

### O contexto da IA

O contexto é gravado em `carrosseis_gerados.contexto`, como hoje:

- **bônus do Chat:** como hoje, `{ tema, titulo, descricao, oQueResolve }`
  (`ContextoDoCarrossel`, `lib/bonus/carrossel-ia-parametros.ts:16`);
- **bônus do Labs:** o mesmo formato. Título, descrição, tema e palavra vêm da lista pública do
  Labs, lidos pelo código na hora do pedido; o `oQueResolve` é o "O que destacar", ou, vazio, a
  própria descrição;
- **texto livre:** um formato próprio, `{ tipo: "livre", tema, conteudo }`.

`contextoGravado` passa a aceitar os dois formatos, e o formato de hoje continua sem `tipo`: as linhas
que já existem não mudam. A mensagem à IA (`mensagemDoCarrossel`) do texto livre é "Tema: <tema>",
depois "O conteúdo que este post divulga:" com o conteúdo, e o mesmo pedido extra de hoje (o total
e a palavra). Ela não fala de "O que deve resolver" nem de "O bônus que este post divulga". A
instrução do sistema (a do Labs) não muda.

O **título interno** do carrossel escrito à mão (o campo `titulo` do texto, que a IA escreve quando
gera) é o título do bônus do Labs, ou o tema do texto livre.

**A leitura da lista do Labs não está no contrato** (`lib/bonus/publicado.ts:3`). Por isso ela falha
fechada, como hoje: só um bônus "publicado", com palavra e tema no formato que o Chat usa, libera o
pedido. A lista de escolha do "Novo carrossel" sai da mesma leitura, por uma função pura nova ao lado
de `situacaoNaLista`, com as mesmas regras por item: o bônus fora do formato não aparece. Uma falha
da leitura mostra a frase da falha, e não a lista vazia.

### As rotas

Nenhum arquivo de `app/bonus/[id]/carrossel/` muda de lugar. As rotas novas reaproveitam os
componentes:

- `app/carrosseis/page.tsx` (a lista), `app/carrosseis/novo/` (o pedido) e
  `app/carrosseis/[cid]/page.tsx` (a página do avulso);
- `app/carrosseis/[cid]/arte/route.tsx` (a arte do avulso), com a mesma sessão conferida antes de
  tudo e o mesmo desenho (`respostaDaArte`).

**Cada rota serve só a sua origem.** A página e a arte de `/bonus/[id]/carrossel/[cid]` continuam
exigindo o carrossel daquele bônus (`conferirPedidoDaArte`, `lib/bonus/arte-tela.ts:30`, e
`page.tsx:69`); as de `/carrosseis/[cid]` exigem a origem `'labs'` ou `'livre'`. O carrossel da
outra origem dá 404 nas duas.

**O endereço da página vem da linha.** Uma função pura nova dá o caminho de cada carrossel:
`/bonus/<bonus_id>/carrossel/<id>` na origem `'bonus'`, e `/carrosseis/<id>` nas outras. Ela é usada:
- por `urlDaArte`, que hoje recebe o id do bônus, e pelos componentes que a chamam (`card-da-parte`,
  `editor-do-carrossel`, `card-publicar` e `imagem-no-navegador`), que passam a receber o caminho
  pronto no lugar do `bonusId`;
- por `urlDoCarrosselComAviso`, e pelos `redirect` das actions do carrossel, que hoje montam
  `/bonus/<bonus_id>/carrossel/<id>`.

**A parte de dentro da página** (o componente `Revisao`, hoje dentro de
`app/bonus/[id]/carrossel/[cid]/page.tsx`) vai para um arquivo novo no mesmo diretório, sem
mudar o que faz, e as duas páginas o usam. É o único trecho de código que muda de arquivo nesta
etapa.

O nome do arquivo baixado (`nomeDoArquivo`, `lib/bonus/arte-tela.ts:44`, que já aceita `null`) é:
- o slug do bônus do Chat, como hoje;
- o código do Labs, no avulso do Labs;
- "carrossel", no texto livre.

O proxy protege as rotas novas por padrão. As actions novas começam por `exigirSessao()`, e a conta
nunca vem do formulário.

### O que não muda

- A Etapa 5 vale igual para todo carrossel: a conta gravada no nascimento, as imagens, a trava
  escrita pelo que libera, a reserva antes da fila e a marca de enfileirada. Os testes dela continuam
  e ganham o avulso nos casos de publicar.
- Nenhum arquivo do `/publicar`, do bucket, do dreno, da fila nem das automações. O diff fica em
  `app/bonus/`, `app/carrosseis/`, `lib/bonus/`, `migrations/016-…`, `scripts/migrar.mjs` (só as
  conferências da 016), o item do menu em `app/app-shell.tsx`, testes e `docs/`.

---

## Segurança

- As rotas e as actions conferem a sessão (o mesmo molde das etapas anteriores, com o teste que lê a
  primeira instrução de cada action).
- A conta é a do cookie no nascimento, gravada no carrossel; nunca vem do formulário.
- O código do Labs vem do formulário, mas só vale se estiver na lista pública lida na hora; o
  contexto e a palavra vêm de lá, e não do formulário.
- O conteúdo livre vai à IA como dado. Ele não é segredo, e o carrossel é interno ao painel.

---

## Testes

| suíte | o quê |
|---|---|
| pura | a leitura do pedido avulso: origem, código, tema, palavra (`palavraValida`), conteúdo (20 a 8 000), slides (1 a 10); cada recusa com frase |
| pura | o contexto de cada origem; `contextoGravado` aceita o formato de hoje (as linhas antigas) e o do texto livre, e recusa o resto |
| pura | a mensagem à IA do texto livre ("O conteúdo que este post divulga"), sem "O bônus que" e sem "O que deve resolver" |
| pura | a lista de escolha do Labs: só os bônus no formato, com as mesmas regras de `situacaoNaLista` |
| pura | o caminho da página nas três origens, e `urlDaArte` e `urlDoCarrosselComAviso` a partir dele |
| pura | o nome do arquivo baixado nas três origens |
| pura | o aviso do funil com a palavra, depois de agendar ou publicar, e nada antes |
| integração | a 016 no banco descartável: as colunas, o padrão `'bonus'` nas linhas antigas e os dois `check` recusando as combinações erradas |
| integração | criar o avulso do Labs (com a lista do Labs falsa), o do texto livre e o escrito à mão; o escrito à mão nasce pronto e não conta no teto, e os da IA contam |
| integração | o bônus do Labs fora da lista, ou sem palavra no formato, recusa o pedido sem gravar |
| integração | publicar e agendar um avulso: a conta do carrossel, a trava e a reserva, como no de bônus |
| integração | a rota da arte do avulso recusa sem sessão (401) |
| pura | cada rota recusa (404) o carrossel da outra origem (`conferirPedidoDaArte` e a conferência da página nova) |
| integração | o "Gerar de novo" do texto livre reaproveita o tema, o conteúdo e a palavra gravados |
| tela | o "Novo carrossel": as duas origens, os dois botões, e o "Escrever à mão" com os campos e as frases de recusa |
| tela | a lista "Carrosséis" com as três origens |
| guardas | toda action nova começa por `exigirSessao`; nenhum arquivo do `/publicar` nem das automações no diff |

---

## A prova real

No preview, com o Eduardo na tela. Cada gravação tem o OK dele, e a auditoria lê o banco antes e
depois. O preview usa o banco e o bucket de produção. **Sem post real**, como na Etapa 5.

1. O menu "Carrosséis" lista os carrosséis que já existem, todos como "Bônus do Chat", e cada um
   abre a página de hoje.
2. "Novo carrossel" → "Escrever à mão", de um bônus do Labs (o BRUTAL): o carrossel nasce pronto, com
   o texto escrito e a palavra BRUTAL lida do Labs, sem gastar IA.
3. Na página dele: a arte, a foto no espaço e o "Baixar"; agendar para daqui a 7 dias e cancelar no
   calendário, com o aviso do funil.
4. Quando o crédito da Anthropic entrar: "Gerar com a IA", de um texto livre, com 4 slides.

No fim, o que a prova criou sai do banco e do bucket, com o OK do Eduardo e o script lido pela
auditoria antes de rodar (achado 77).

---

## Pré-condições do merge

1. `npm run verify` limpo, a integração verde no container, e o preview com a prova feita.
2. A linha de base da 016 lida antes do merge, e a conferência depois do deploy.
3. Nenhum `next dev` apontado para a produção durante o deploy, e as abas recarregadas depois.

---

## Fora desta etapa

- Ligar o funil sozinho: criar a automação da palavra presa ao post novo, depois de publicar.
- O criador de imagem (Etapa 6), que vai pôr a imagem gerada no mesmo espaço da foto.
- Subir o carrossel inteiro do Canva de uma vez.
