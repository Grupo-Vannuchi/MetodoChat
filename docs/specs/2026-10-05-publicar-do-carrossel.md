# O gerador de bônus — Etapa 5: publicar o carrossel

**Nascido em:** 05/10/2026, desenhado com o Eduardo pela caixa de perguntas, com a sessão auditora
levantando os riscos durante o desenho (medidos no código da `main` em `a4411a5`).
**Estado:** desenho aprovado pelo Eduardo nas três partes (a tela; por dentro; os testes e a prova),
e revisado pela auditoria: o achado 75 (a marca de enfileirada) e o 76 (a proporção 4:5, decidida pelo
Eduardo) estão absorvidos no texto.
**Projeto de quem:** do Vinícius Gualberto. Como as etapas anteriores, entra como visita: pasta
própria, e nenhum arquivo do `/publicar` muda.
**Etapas anteriores:** `docs/specs/2026-09-29-gerador-de-bonus.md`,
`docs/specs/2026-09-30-gerador-de-carrossel.md`, `docs/specs/2026-10-01-arte-do-carrossel.md` e
`docs/specs/2026-10-02-pagina-do-carrossel.md`.

---

## O que é

Até a Etapa 4, o carrossel pronto termina no "Baixar": o operador leva as artes ao Canva, monta as
imagens e publica por outro caminho. Nesta etapa, a página do carrossel recebe de volta a imagem
pronta de cada slide, durante a criação, e publica ou agenda dali mesmo. O post entra na fila do
`/publicar` do Vinícius e aparece no calendário dele, onde se cancela ou remarca.

Nas palavras do Eduardo: "a ideia do upload é para a geração de carrossel, ou do carrossel de bônus,
para enviar quando estiver criando".

---

## As decisões, e de quem

Todas do Eduardo, em 05/10, pela caixa de perguntas.

| decisão | escolha |
|---|---|
| o que é o upload | a imagem pronta do Canva, subida no card de cada slide, na página do carrossel |
| o slide "Só texto" | vai com a arte do Chat, sem upload |
| o botão de publicar | travado até todo slide com espaço de imagem ter a imagem, dizendo qual falta |
| por onde sai | publicar ou agendar na própria página do carrossel; o post entra na fila do `/publicar` e aparece no calendário dele; sempre na conta do carrossel. A tela de compor do `/publicar` não muda (ela não tem rascunho nem pré-preenchimento) |
| a imagem subida | fica guardada no carrossel: sobe hoje, publica amanhã, e dá para trocar |
| a proporção da imagem do slide | 4:5, como a arte do Chat (1080×1350); outra proporção é recusada no upload (achado 76) |
| o texto muda depois da imagem | a imagem fica, e o card avisa "o texto mudou depois desta imagem" |
| depois de mandar | a página mostra o estado e trava o botão; cancelado ou falho, o botão volta |
| enquanto agendado | texto, "Só texto" e imagens travados até cancelar no calendário |
| depois de publicado | a página fica só para leitura, e não há republicar |
| a imagem guardada contra o `/publicar` que apaga | copiar ao publicar: a fila leva uma cópia, e o `/publicar` apaga só a cópia |
| a prova | agendar, ver no calendário, cancelar, e um post real numa conta de teste, apagado depois no Instagram |

---

## O que o `/publicar` já faz, medido

Lido na `main` em `a4411a5`. Nada disto muda nesta etapa; a etapa usa o que está aqui.

- **As formas** são `imagem`, `reels`, `story` e `carrossel` (`lib/publicacao.ts:95`). O carrossel vai
  de 2 a 10 itens (`CARROSSEL_ITENS_MAX`, `:369`; `recusaDaQuantidade`, `:1257`). Imagem só em JPEG,
  até 8 MB, com largura de pelo menos 320 e proporção de 4:5 a 1,91:1 (`problemaDoArquivo`, `:150`).
  A arte do Chat tem 1080×1350 (0,8), dentro da faixa.
- **O upload** vai do navegador direto ao bucket, por URL assinada (`urlAssinadaDeUpload`,
  `lib/bucket.ts:246`), porque a Vercel recusa corpo acima de 4,5 MB. A rota de assinar do
  `/publicar` assina na pasta da conta do COOKIE (`app/api/midia/assinar/route.ts:62`), de propósito.
- **A fila.** `enqueuePublicacao` (`lib/engine.ts:2577`) não confere nada: quem chama repete as
  conferências de `app/publicar/actions.ts:57-134`. A chave da fila (`publicacaoKey`,
  `lib/dedupe.ts:225`) leva a conta, a forma e todos os caminhos em ordem, e `dedupe_key` é `unique`
  na tabela inteira, para sempre (`migrations/000-esquema-base.sql:201`): mandar de novo os mesmos
  caminhos dá "já enfileirado" mesmo depois de o primeiro ter falhado.
- **O bucket é limpo** depois de publicar e no cancelamento (`limparOBucket`,
  `lib/queue-drain.ts:318`). Só o item `failed` guarda os arquivos.
- **O calendário e o cancelar são da conta selecionada.** O calendário lista só `pending` e `sent`
  da conta do cookie (`app/publicar/page.tsx:258-260`), e o `cancelarPublicacao`
  (`app/publicar/post/actions.ts:119`) filtra pela mesma conta e só cancela `pending`.
- **Os estados da fila** são seis: `pending`, `sending`, `sent`, `failed`, `skipped` e `guardado`
  (`migrations/009-fila-estado-guardado.sql:76`). O `guardado` só existe para o envio em lote de DMs.
- **A forma do caminho.** O `/publicar` só aceita `pasta/arquivo.ext`, com uma barra
  (`FORMA_DO_CAMINHO`, `lib/publicacao.ts:1535`). O dreno não confere a forma
  (`lerPayloadDaPublicacao`, `:826`, só exige texto não vazio).
- **A conversão para JPEG** mora só no navegador (`converterParaJpeg`, `app/publicar/enviador.tsx:549`,
  não exportada). As decisões puras dela são exportadas, e o arquivo delas não é `server-only`:
  `planoDaConversao`, `medidasDaConversao` e `QUALIDADE_DO_JPEG` (`lib/publicacao.ts:903-1007`).

---

## A página

O que o Eduardo aprovou na parte 1. Tudo mora na página do carrossel da Etapa 4
(`app/bonus/[id]/carrossel/[cid]/`).

### O card de cada slide com espaço de imagem

- Ganha **"Subir imagem do Canva"**. Aceita JPEG, PNG e WEBP. PNG e WEBP viram JPEG no navegador, como
  no `/publicar` (fundo branco, qualidade 0,9, até 1440 de largura).
- A imagem tem de ser **4:5**, como a arte (1080×1350), com 1% de tolerância (de 0,792 a 0,808).
  Outra proporção é recusada com a frase "A imagem do slide tem de ser 4:5, como a arte
  (1080×1350)." O motivo é do Instagram: todos os itens do carrossel são cortados pela proporção do
  PRIMEIRO (`lib/dedupe.ts:211-212`), e uma imagem quadrada no slide 1 cortaria o texto das artes
  "Só texto". O `/publicar` aceita de 0,8 a 1,91 (`lib/publicacao.ts:42-43`), e esta regra é só da
  página do carrossel.
- Depois de subir, a miniatura do card passa a ser a imagem do Canva, e o botão vira **"Trocar
  imagem"**. Trocar apaga a anterior do bucket.
- O **"Baixar"** continua baixando a arte do Chat, para levar ao Canva.
- Se o texto do slide mudar depois da imagem, o card mostra **"O texto mudou depois desta imagem."**

### O card "Só texto"

Não tem upload. O que sai é a arte do Chat. Marcar "Só texto" num slide que já tinha imagem não apaga
a imagem: ela só deixa de ser usada, e volta se o slide voltar a ter espaço.

### O card "Publicar", no fim da página, depois da legenda

- Mostra a conta: "Vai sair em @thiagovannuchi".
- **Agora** ou **Agendar** (data e hora), e o botão **Publicar**.
- O botão fica travado, com a frase do motivo, quando:
  - falta imagem: "Falta a imagem dos slides 2 e 5.";
  - algum card está com "não salvo": "Salve o slide 3 antes de publicar." (o que sai é o texto
    salvo, e não o que está nos campos);
  - o carrossel não tem conta: pede o "Fixar nesta conta" da Etapa 4;
  - a conta do carrossel foi desconectada do Chat: diz isso.
- O post de 1 slide sai como **imagem única**; de 2 a 10, como **carrossel**. A legenda é a salva no
  card da legenda.

### Depois de mandar

No lugar do botão aparece o estado, lido da fila:

| na fila | na tela |
|---|---|
| `pending`, com hora no futuro | "Agendado para 06/10/2026, 18:00" (horário de Brasília) |
| `pending` com a hora vencida, ou `sending` | "Publicando. O Instagram leva até um minuto: recarregue a página para ver." |
| `sent` | "Publicado em 06/10/2026, 18:01" |
| `failed` | "Não publicou: <motivo da fila>", e o botão volta |
| `skipped` | "Cancelado no calendário", e o botão volta |
| a reserva nunca enfileirada, sem linha na fila, há menos de 10 minutos | "Publicando" |
| a reserva nunca enfileirada, sem linha na fila, há 10 minutos ou mais | "A última tentativa não entrou na fila.", e o botão volta |
| enfileirada, e sem linha na fila | "O registro deste post saiu da fila. A conta foi desconectada?", e tudo segue travado (achado 75) |

Os estados levam ao post no `/publicar`. Como o calendário só mostra a conta selecionada no menu,
quando ela é outra a tela diz: "Para ver no calendário, selecione Thiago Vannuchi no menu."

### As travas

- Enquanto o post está agendado ou publicando, o texto, o "Só texto" e as imagens ficam travados, com
  o aviso "Agendado: para mudar, cancele no calendário."
- Depois de publicado, a página fica só para leitura, com "Publicado em …". Não há republicar.
- A trava vale no servidor, e não só na tela (ver "A trava no servidor").

---

## Por dentro

### Onde mora: a coluna `arte`, sem migração

Duas chaves novas no `jsonb` de `carrosseis_gerados.arte`, ao lado de `conta`, `nome`, `arroba` e
`soTexto`, gravadas com `arte || …` como as da Etapa 4:

- `imagens`: `{"2": {"caminho": "<pasta>/bonus/<uuid>.jpg", "versao": "<versão do texto>"}}`, uma
  entrada por slide com imagem guardada;
- `publicacao`: `{"chave": "<dedupe_key exata>", "caminhos": [...], "reservada_em": "<instante>",
  "enfileirada_em": "<instante>"}`. `enfileirada_em` só entra depois de a fila aceitar o item.

A `chave` é a `dedupe_key` exata que foi para a fila, e não só os caminhos para recalcular: se a
`publicacaoKey` mudar de formato um dia, o recálculo perderia o item.

As leituras não quebram a página com a forma errada, mas as duas chaves não erram para o mesmo lado:
- uma imagem fora de forma fica de fora, como `escolhasDaArte` já faz, e o slide volta a pedir a
  imagem;
- uma `publicacao` fora de forma TRAVA (o estado "desconhecido"), e não vira "sem publicação". A
  trava se escreve pelo que libera, e ler um registro estranho como "nada foi mandado" liberaria o
  botão de um carrossel que pode estar na fila. Achado no ensaio do plano: a primeira redação desta
  seção mandava as duas voltarem ao padrão.

### Os dois prefixos no bucket

A pasta é a da conta do carrossel (`pastaDaConta`, `lib/bucket.ts:184`), nunca a do cookie.

| prefixo | o quê | quem apaga |
|---|---|---|
| `<pasta>/bonus/<uuid>.jpg` | as imagens guardadas nos slides | o "Trocar imagem" (a anterior) |
| `<pasta>/bonus-fila/<uuid>.jpg` | o que vai para a fila: as cópias das guardadas e a arte "Só texto" convertida | o dreno, depois de publicar ou no cancelamento; esta etapa, em qualquer recusa |

Nenhum dos dois entra pelo `/publicar`, que só aceita `pasta/arquivo.ext` com uma barra; os dois
saem pelo dreno, que não confere a forma. Por isso uma imagem guardada nunca vai para a fila, e o
dreno nunca a apaga: o que vai é sempre uma cópia em `bonus-fila`.

### A versão do texto do slide

`versaoDoTextoDoSlide(slide)` é o resumo (`versaoDaArte`, `lib/bonus/arte-tela.ts:80`) só do slide:
número, total, tipo, manchete e texto. Não é a versão da miniatura (`versoesDosSlides`), porque essa
leva a URL da foto da conta, que a Meta troca sozinha, e o aviso apareceria sem o texto ter mudado. A
versão é gravada com a imagem, a partir do texto SALVO no momento de guardar, e comparada com a do
texto salvo agora.

### Subir a imagem de um slide

1. O navegador lê a imagem, converte para JPEG quando preciso, e confere tipo e tamanho com as
   regras do `/publicar` (`problemaDoArquivo`) e a proporção 4:5 do slide
   (`problemaDaProporcaoDoSlide`, pura), para dizer cedo o que não serve.
2. A action **`assinarImagemDoCarrossel`** (id, slide, destino, descrição do arquivo): sessão; o
   carrossel pronto; a conta do carrossel gravada e conectada; a trava livre; o slide existe e, no
   destino `slide`, tem espaço de imagem (no destino `fila`, é "Só texto"); o `mime` é `image/jpeg`;
   a largura e a altura declaradas dão 4:5 (`problemaDaProporcaoDoSlide`, nos dois destinos: a arte
   "Só texto" tem 1080×1350); a descrição passa pela `decisaoDeAssinatura` (`lib/publicacao.ts:478`),
   com a forma do carrossel e o teto do bucket (`tetoDoBucket`). Como no `/publicar`, as medidas são
   declaradas pelo navegador, e o servidor não vê os bytes para conferir. Devolve o caminho (`<pasta>/bonus/<uuid>.jpg` no destino
   `slide`, `<pasta>/bonus-fila/<uuid>.jpg` no destino `fila`) e a URL assinada daquele caminho só.
3. O navegador sobe direto ao bucket (`PUT`, sem cabeçalho de autenticação, como o enviador do
   `/publicar`).
4. A action **`guardarImagemDoSlide`** (id, slide, caminho), numa transação com a linha travada
   (`for update`): as mesmas conferências, mais o caminho na forma exata
   `^<pasta da conta do carrossel>/bonus/<uuid>\.jpg$`. Grava `imagens[slide]` com a versão do
   texto salvo agora. Depois do `commit`, apaga a imagem anterior daquele slide, se havia; uma falha
   ao apagar não desfaz a troca (o molde de `limparOBucket`).

As duas respostas voltam como estado (useActionState), nunca por redirect (achado 52).

### Publicar

O clique do "Publicar" faz, em ordem:

1. **No navegador**, para cada slide "Só texto": baixa a arte da rota da Etapa 3 (mesma origem, com a
   sessão), converte o PNG em JPEG, pede a assinatura (`assinarImagemDoCarrossel` com o destino da
   fila, que emite `<pasta>/bonus-fila/<uuid>.jpg`) e sobe.
2. **A action `publicarCarrossel`** recebe o id, o "agora" ou a data e hora com o fuso do navegador,
   e, para cada slide "Só texto", o caminho subido e a versão do texto que o navegador desenhou.
   Confere, antes de tocar o bucket:
   - sessão; o carrossel pronto; a conta do carrossel gravada e conectada (origem `gravada` de
     `resolverConta`; `selecionada` pede o "Fixar"; `guardada` e `gravada_saiu` são conta
     desconectada);
   - a trava livre;
   - todo slide com espaço tem imagem guardada; os slides "Só texto" são exatamente os gravados em
     `soTexto`, cada um com um caminho na forma exata `^<pasta>/bonus-fila/<uuid>\.jpg$`, distintos,
     que não aparecem em payload nenhum da fila, e com a versão igual à do texto salvo agora;
   - a forma pela quantidade (1 é `imagem`, 2 a 10 é `carrossel`; `recusaDaQuantidade`);
   - a legenda salva (`problemaDaLegenda`);
   - a hora (`camposDaDataHora`, `fusoDoCampo`, `instanteDoAgendamento`, `momentoDaPublicacao`).
3. **As cópias**, fora de qualquer transação: cada imagem guardada é copiada para
   `<pasta>/bonus-fila/<uuid>.jpg` no servidor, só com o que o `lib/bucket.ts` já exporta e já mediu:
   `GET` na `urlPublicaDoObjeto` e `PUT` na `urlAssinadaDeUpload`. Nada de endpoint novo do Supabase.
   Se uma cópia falha no meio, as já feitas são apagadas, e a resposta diz qual slide falhou.
4. **A reserva**, numa transação curta: trava a linha (`for update`) e confere de novo a trava livre e
   que as imagens, o `soTexto` e as versões são os mesmos que foram copiados. Grava
   `arte.publicacao` com a chave e os caminhos, e faz `commit`. Em qualquer recusa daqui, apaga as
   cópias e as artes "Só texto" desta tentativa. Quando a reserva nova substitui uma velha que nunca
   entrou na fila, depois do `commit` apaga os caminhos da velha que não aparecem em payload nenhum
   da fila (sem isso, eles ficariam no bucket sem dono).
5. **A fila**, depois do `commit`: `enqueuePublicacao(conta do carrossel, {forma, caminhos, legenda},
   quando)`. Se ela lança ou devolve falso, a reserva é desfeita (só se a chave ainda for a desta
   tentativa) e as cópias são apagadas.
6. **A marca de enfileirada** (achado 75), numa segunda transação curta: grava
   `arte.publicacao.enfileirada_em` com o `now()` do banco, só se a chave ainda for a desta
   tentativa. Se essa gravação falhar, o post já está na fila e a resposta é de sucesso: a linha da
   fila existe, e o estado vem dela.
7. Com "agora", drena a fila como o `/publicar` (`drainQueue`, num `try`,
   `app/publicar/actions.ts:151-159`).

No sucesso, a página é recarregada (`router.refresh`). Aqui isso é seguro, ao contrário do salvar da
Etapa 4, porque o publicar exige que nenhum card esteja "não salvo".

**Por que a reserva vem antes da fila.** A fila é gravada por `enqueue`, na conexão dela, e não dá
para pô-la na transação do carrossel. Na ordem contrária (enfileirar, e depois gravar a reserva), uma
falha no `commit` deixaria um post na fila que o carrossel não conhece, e o botão voltaria: dois posts
no perfil, sem `DELETE` que desfaça. Com a reserva primeiro, o pior caso é o processo morrer entre o
`commit` e a fila: a reserva fica sem linha, e a página mostra "Publicando" por 10 minutos e depois
devolve o botão ("A última tentativa não entrou na fila.").

**Por que a marca de enfileirada (achado 75).** A linha da fila nem sempre dura: desconectar a conta
apaga todas as linhas da fila dela (`deleteAccount`, `lib/db.ts:469-474`). Sem a marca, um carrossel
publicado cuja conta fosse desconectada perderia a linha `sent`, cairia em "reserva sem linha há 10
minutos" e ficaria livre; reconectada a conta, um clique publicaria o mesmo carrossel de novo. Com a
marca, "enfileirada e sem linha" trava para sempre. O que sobra é a soma de duas falhas: a marca não
ser gravada (passo 6) E a conta ser desconectada depois. Nesse caso vale a regra dos 10 minutos, e o
botão volta.

**Dois cliques.** O primeiro reserva. O segundo faz as cópias dele, trava a linha, acha a reserva do
primeiro, recusa e apaga as cópias dele. Sai um post só.

### O estado da publicação

Uma função pura, `estadoDaPublicacao(publicacao, linhaDaFila, agora)`, decide o estado da tabela de
"Depois de mandar", a partir de `arte.publicacao` e da linha da fila lida pela `chave`
(`status`, `not_before`, `sent_at`, `error`, `id`). A leitura da fila é só `select`, numa função do
repositório do carrossel.

Os 10 minutos da reserva sem linha se contam no relógio do banco: `reservada_em` é gravado com o
`now()` do banco, e o `agora` da função é o `now()` lido junto com a linha da fila. Os dois
relógios já foram medidos a 53,9 segundos um do outro numa máquina de desenvolvimento (comentário de
`enqueuePublicacao`, `lib/engine.ts:2594-2597`).

### A trava no servidor

O carrossel está **livre** só quando:
- não tem `arte.publicacao`; ou
- a linha da fila da chave está em `failed` ou `skipped`; ou
- a reserva nunca foi enfileirada (sem `enfileirada_em`), não tem linha na fila, e tem 10 minutos ou
  mais.

Todo o resto trava: `pending`, `sending`, `sent`, a reserva recente sem linha, a enfileirada sem
linha, e qualquer estado que apareça na fila no futuro. A regra é escrita pelo contrário (o que libera), e não pelo que trava,
para um estado novo travar sozinho.

Ela vale em todas as actions que gravam no carrossel:
- `salvarSlideDoCarrossel` e o salvar da legenda: dentro da transação que já trava a linha;
- `salvarArteDoCarrossel` (o "Só texto"): o `update` dele passa a ser feito numa transação com a
  linha travada, como o do salvar do slide, para a trava usar a mesma função pura;
- `assinarImagemDoCarrossel`, `guardarImagemDoSlide` e `publicarCarrossel`.

O "Fixar nesta conta" não precisa dela: um carrossel sem conta não chega a publicar.

### A conversão para JPEG, no navegador

`converterParaJpeg` não é exportada, e exportá-la seria mexer no arquivo do Vinícius. Ela é copiada
para um módulo de cliente da página do carrossel, com o comentário de origem, e usa as decisões puras
que o `lib/publicacao.ts` já exporta (`planoDaConversao`, `medidasDaConversao`). A cópia mantém o
`fillRect` branco antes do `drawImage`: o `canvas` nasce transparente, e sem ele o PNG vira JPEG de
fundo preto.

### O que não muda

Nenhum arquivo do `/publicar`, do bucket, do dreno ou da fila. Esta etapa importa deles e não toca
neles. O diff fica em `app/bonus/`, `lib/bonus/`, nos testes e em `docs/`.

---

## Sem migração

Tudo cabe na coluna `arte`, que já existe. A etapa não tem DDL, e o deploy dela não tem passo à mão.

---

## Segurança

- Toda action nova começa com `await exigirSessao()`, e a guarda que lê o arquivo de actions cobra
  isso de todas.
- A conta nunca vem do formulário: é a do carrossel, gravada e conectada. O upload e a fila usam a
  pasta e o id dela.
- Os caminhos são emitidos pelo servidor. O que volta do navegador só passa na forma exata do prefixo
  da conta do carrossel. O da fila também não pode estar em payload nenhum da fila: sem isso, um
  pedido montado à mão apontaria o arquivo de um post do `/publicar` ainda na fila, o carrossel o
  publicaria, e o dreno o apagaria depois.
- Só `image/jpeg` é assinado, pela `decisaoDeAssinatura`, com a forma do carrossel.
- A chave do Supabase não sai do servidor: a cópia é feita no servidor, com as funções do
  `lib/bucket.ts`.
- As imagens ficam no bucket público, como as do `/publicar` (a Meta as busca sem token). O endereço
  tem um uuid, e só aparece na página do carrossel, atrás da sessão.

---

## O que fica no bucket sem dono (anotado, não resolvido)

São apagados: a imagem trocada; as cópias e as artes de uma tentativa recusada ou que falhou; os
caminhos de uma reserva velha que nunca entrou na fila, quando uma tentativa nova a substitui; e, pelo
dreno, as da fila depois de publicar ou cancelar.

Ficam:
- o upload que subiu e não foi guardado (a aba fechada entre o `PUT` e o guardar), como no
  `/publicar`;
- a arte "Só texto" que o navegador subiu numa tentativa que parou ainda no navegador (a arte de
  outro slide que não veio, ou a aba fechada antes de mandar o pedido): o servidor nunca soube
  desses caminhos;
- as imagens guardadas de um carrossel publicado, que a página, só para leitura, segue mostrando;
- as cópias de um item `failed`, pela regra do `/publicar` (item falhado guarda os arquivos).

---

## Testes

| suíte | o quê |
|---|---|
| pura | o estado da publicação: cada estado da fila, a reserva nunca enfileirada sem linha antes e depois dos 10 minutos, a enfileirada sem linha travando, e um estado desconhecido travando |
| pura | a trava livre só em sem publicação, `failed`, `skipped` e reserva velha, nunca enfileirada, sem linha |
| pura | a proporção do slide: 1080×1350 passa, as bordas de 1% passam, 1:1 e 1,91:1 são recusadas, e medida ausente ou zero é recusada |
| pura | a versão do texto do slide: muda com a manchete e o texto daquele slide, e não muda com a foto da conta |
| pura | o que falta para publicar: os slides com espaço sem imagem, o "não salvo", a conta |
| pura | os caminhos: a forma exata de cada prefixo, na pasta da conta do carrossel; recusa outra pasta, outro prefixo, `..`, barra a mais e extensão diferente de `.jpg` |
| pura | a forma pela quantidade: 1 slide é imagem, 2 a 10 é carrossel |
| tela | a conversão para JPEG, com `canvas` e `createImageBitmap` falsos: pinta de branco antes de desenhar, usa as medidas do plano e grava `image/jpeg` na qualidade 0,9 |
| tela | o card com imagem mostra a imagem guardada e o "Trocar imagem"; o aviso do texto que mudou; o "Publicar" travado com a frase de cada motivo; a página travada quando agendada |
| integração | guardar a imagem grava só aquele slide e mantém a conta e o "Só texto"; trocar apaga a anterior; caminho de outra pasta ou outro prefixo é recusado |
| integração | publicar enfileira na conta do carrossel, com a selecionada no cookie sendo outra; os caminhos da fila são cópias em `bonus-fila`, na ordem dos slides; as guardadas continuam no bucket |
| integração | dois publicar ao mesmo tempo: um post só, e as cópias do segundo apagadas |
| integração | recusa e falha no meio da cópia apagam as cópias; falha na fila desfaz a reserva; a reserva velha substituída tem os caminhos dela apagados |
| integração | a linha da fila apagada depois de enfileirar (como faz o `deleteAccount`): o carrossel segue travado, mesmo passados os 10 minutos (achado 75) |
| integração | a assinatura recusa medidas declaradas fora de 4:5 |
| integração | a trava no servidor: salvar slide, "Só texto", assinar, guardar e publicar recusados com o item `pending`, `sending` e `sent`; liberados com `failed` e `skipped` |
| integração | o caminho de "Só texto" que já está no payload de outro item da fila é recusado |
| guardas | toda action começa por `exigirSessao`; nenhum arquivo do `/publicar`, do bucket, do dreno ou da fila no diff |

A integração usa o banco de teste do container e um bucket falso num servidor local, como
`testes-integracao/publicacao.integracao.ts` já faz (com a guarda que exige a `SUPABASE_URL` em
loopback). Nenhum teste toca o Supabase de verdade, nem a Meta.

Como nas etapas anteriores: todo teste escrito antes do código e visto falhar; as proteções provadas
também retirando-as e vendo o caso certo cair (a trava no servidor, a forma dos caminhos, o payload da
fila, as cópias apagadas na recusa, os dois cliques, a versão do texto, a conta do carrossel, a marca
de enfileirada e a proporção 4:5); o
código ensaiado numa cópia isolada antes do plano, e o plano trazendo os blocos tirados dessa cópia.

---

## A prova real

No preview, com o Eduardo na tela. Cada gravação tem o OK dele, e a auditoria lê o banco antes e
depois. O preview usa o banco e o bucket de produção, e o post real sai no Instagram de verdade.

1. Subir a imagem do Canva em slides com espaço: a miniatura troca, e o "Publicar" diz quais faltam.
   Uma imagem quadrada é recusada antes de subir, com a frase do 4:5 (sem gravar nada).
2. Trocar uma imagem: a anterior sai do bucket.
3. Editar o texto de um slide com imagem e salvar: aparece o aviso "o texto mudou depois desta
   imagem".
4. Agendar para o dia seguinte: a página mostra "Agendado", e texto, "Só texto" e imagens ficam
   travados. O post aparece no calendário, com a conta do carrossel selecionada no menu.
5. Cancelar no calendário: o botão volta, e as imagens continuam no carrossel.
6. Um post real numa conta de teste, escolhida pelo Eduardo na hora, com um carrossel daquela conta
   (gerado ou fixado nela, com o OK dele): "Agora", "Publicando" e "Publicado". Conferir no Instagram
   a ordem dos slides, as artes "Só texto" sem recorte (o texto inteiro, de margem a margem), as
   imagens do Canva e a legenda. Depois, o Eduardo apaga o post no Instagram.

---

## Pré-condições do merge

1. `npm run verify` limpo, a integração verde no container, e o preview com a prova feita.
2. Nenhum `next dev` apontado para a produção durante o deploy, e as abas recarregadas depois.

---

## Fora desta etapa

- Republicar um carrossel publicado, ou editá-lo depois de publicado.
- Limpar as imagens guardadas de carrossel publicado e os uploads órfãos.
- Ver no carrossel o post de outra conta sem trocar o menu: o calendário é do `/publicar`, e segue
  mostrando só a conta selecionada.
- O criador de imagem (Etapa 6).
- O carrossel avulso (Etapa 7).
