# O gerador de bônus — Etapa 5: publicar o carrossel

**Nascido em:** 05/10/2026, desenhado com o Eduardo pela caixa de perguntas, com a sessão auditora
levantando os riscos durante o desenho (medidos no código da `main` em `a4411a5`).
**Estado:** desenho aprovado pelo Eduardo nas três partes (a tela; por dentro; os testes e a prova),
e revisado pela auditoria: o achado 75 (a marca de enfileirada) e o 76 (a proporção 4:5, decidida pelo
Eduardo) estão absorvidos no texto. **Adendo de 05/10, durante a prova:** a etapa ganhou o segundo jeito
de imagem, "só a foto, no espaço da arte" (seção "A foto no espaço da arte"), aprovado pelo Eduardo
nas duas partes; a prova passou a ser sem post real (nenhuma conta conectada é de teste). A revisão do
adendo trouxe os achados 78 (a arte com a foto que faltou) e 79 (o teto de 2 MB), absorvidos; o ensaio
do adendo achou que a versão da página ficava velha depois de salvar (ver "A versão vem da rota").
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
| ~~a prova~~ | ~~agendar, ver no calendário, cancelar, e um post real numa conta de teste~~ (trocada no adendo, abaixo) |

Decididas pelo Eduardo durante a prova de 05/10, depois de ver a imagem subida tomar o slide inteiro
("A ideia é seguir o primeiro, mas o segundo também"):

| decisão | escolha |
|---|---|
| os jeitos de imagem | dois: **"Subir foto"**, o principal, põe a foto no espaço reservado da arte (onde o criador de imagem da Etapa 6 também vai pôr a dele), com o texto e o cabeçalho do Chat; **"Slide pronto do Canva"** substitui o slide inteiro, para quando se quer algo além da foto |
| como se escolhe | dois botões em cada slide com espaço, e não pela proporção (uma foto em pé 4:5 viraria slide pronto sem querer) |
| a foto no espaço | cortada para preencher, centralizada; cantos retos, como a regra da casa no Labs |
| quantas imagens por slide | uma: subir um jeito troca o outro |
| subir o carrossel inteiro do Canva de uma vez | depois desta etapa |
| a prova | sem post real: nenhuma das 4 contas conectadas é de teste. Agendar para daqui a 7 dias (folga se o cancelar falhar) e cancelar; o primeiro post real vai ser um que o Eduardo queira publicar, com a auditoria acompanhando |

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

- Ganha os dois jeitos de imagem (adendo de 05/10): **"Subir foto"**, ao lado do **"Baixar"**, e
  **"Slide pronto do Canva"** embaixo. A foto está na seção "A foto no espaço da arte". O resto desta
  lista é do slide pronto.
- O slide pronto aceita JPEG, PNG e WEBP. PNG e WEBP viram JPEG no navegador, como
  no `/publicar` (fundo branco, qualidade 0,9, até 1440 de largura).
- O slide pronto tem de ser **4:5**, como a arte (1080×1350), com 1% de tolerância (de 0,792 a 0,808).
  Outra proporção é recusada com a frase "A imagem do slide tem de ser 4:5, como a arte
  (1080×1350)." O motivo é do Instagram: todos os itens do carrossel são cortados pela proporção do
  PRIMEIRO (`lib/dedupe.ts:211-212`), e uma imagem quadrada no slide 1 cortaria o texto das artes
  "Só texto". O `/publicar` aceita de 0,8 a 1,91 (`lib/publicacao.ts:42-43`), e esta regra é só da
  página do carrossel.
- Depois de subir, a miniatura do card passa a ser a imagem do Canva, e o botão vira **"Trocar
  slide pronto"**. Trocar apaga a anterior do bucket.
- O **"Baixar"** continua baixando a arte do Chat, para levar ao Canva.
- Se o texto do slide mudar depois do slide pronto, o card mostra **"O texto mudou depois desta
  imagem."** Com a foto no espaço, o aviso não aparece: a arte se redesenha com o texto novo.

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

### Os prefixos no bucket

A pasta é a da conta do carrossel (`pastaDaConta`, `lib/bucket.ts:184`), nunca a do cookie.

| prefixo | o quê | quem apaga |
|---|---|---|
| `<pasta>/bonus/<uuid>.jpg` | o slide pronto do Canva guardado no slide | a troca, de um jeito ou do outro (a anterior) |
| `<pasta>/bonus-foto/<uuid>.jpg` | a foto guardada no slide, para o espaço da arte (adendo de 05/10) | a troca, de um jeito ou do outro (a anterior) |
| `<pasta>/bonus-fila/<uuid>.jpg` | o que vai para a fila: as cópias dos slides prontos e as artes desenhadas (a "Só texto" e a com a foto), convertidas | o dreno, depois de publicar ou no cancelamento; esta etapa, em qualquer recusa |

Nenhum dos três entra pelo `/publicar`, que só aceita `pasta/arquivo.ext` com uma barra; os três
saem pelo dreno, que não confere a forma. Por isso uma imagem guardada nunca vai para a fila, e o
dreno nunca a apaga: o que vai é sempre uma cópia ou uma arte em `bonus-fila`. O prefixo da foto é
próprio para o jeito de cada imagem guardada sair do caminho que o servidor assinou (ver "A foto no
espaço da arte").

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

1. **No navegador**, para cada slide "Só texto" (e, pelo adendo, cada slide com foto): baixa a arte da
   rota da Etapa 3 (mesma origem, com a sessão), lê dela a versão do desenho (o cabeçalho
   `X-Arte-Versao`), converte o PNG em JPEG, pede a assinatura (`assinarImagemDoCarrossel` com o
   destino da fila, que emite `<pasta>/bonus-fila/<uuid>.jpg`) e sobe.
2. **A action `publicarCarrossel`** recebe o id, o "agora" ou a data e hora com o fuso do navegador,
   e, para cada slide que sai com a arte do Chat, o caminho subido e a versão que a rota mandou com
   a arte (ver "A versão vem da rota").
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

**A versão vem da rota (achado no ensaio do adendo, 06/10).** A versão que confere a arte é a do que
a rota DESENHOU, e a rota a manda junto com a arte, no cabeçalho `X-Arte-Versao`
(`versaoDoDesenho`): a do texto, no "Só texto"; a do texto e do caminho da foto, no slide com foto. O
navegador só a devolve, e o servidor a compara com a do que está salvo agora. Na primeira redação, a
página mandava a versão do texto de quando ela abriu: depois de salvar um slide "Só texto" sem
recarregar (o salvar não recarrega, achado 52), o publicar mandava a versão velha e era recusado
sempre ("mudou enquanto a arte era preparada"), até recarregar a página. O ensaio mediu isso num
teste de tela, que cai no código de `30842a1`.

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

### A foto no espaço da arte (adendo de 05/10)

O jeito principal de imagem, decidido pelo Eduardo durante a prova. A foto entra no espaço reservado
da arte, o mesmo onde o criador de imagem da Etapa 6 vai pôr a dele, e o slide continua sendo a arte
do Chat: a manchete, o texto e o cabeçalho.

**O espaço** é o que a arte já reserva: 860×573 (`LARGURA_UTIL` por `ALTURA_ILUSTRACAO`,
`lib/bonus/arte-geometria.ts:25-28`), deitado, 3:2. A conta do "não cabe" não muda: o espaço, o
`GAP_ILUSTRACAO` e a altura útil são os mesmos, e os vetores combinados com o Labs
(`tests/vetores-da-arte.json`) continuam iguais.

**No navegador**, antes de subir:
- a foto é cortada ao centro na proporção do espaço (860:573) e reduzida até 1720×1146 (o dobro do
  espaço), em JPEG a 0,9. O que sobe já tem a forma do espaço, e a rota não corta nada;
- a foto cujo recorte fica menor que o espaço (860×573) é recusada: "A foto é pequena para o espaço
  da arte: o mínimo é 860×573." Ampliada, ela sairia borrada no post;
- a regra do 4:5 não vale para a foto. Ela vale para o slide pronto, que é o slide inteiro.

**Guardada** em `arte.imagens[n]`, como o slide pronto, e **o jeito é o prefixo do caminho**
(revisão do adendo pela auditoria: amarrar o jeito à assinatura): `<pasta>/bonus-foto/<uuid>.jpg` é
foto no espaço, `<pasta>/bonus/<uuid>.jpg` é slide pronto. O navegador não diz o jeito no guardar: o
servidor o lê do caminho que ele mesmo assinou. Não há campo de jeito na coluna: o caminho é a fonte
única, e não existe um campo que possa discordar dele. As entradas de antes deste adendo, em `bonus/`,
continuam slide pronto, sem migrar nada: é o caso das duas do carrossel `4c5701a8` (slides 2 e 3),
guardadas na primeira prova.

Os lugares que o prefixo da foto toca, para o plano não esquecer nenhum: a assinatura
(`assinarCaminho` e `caminhoDaImagem`, com um destino novo); `ehCaminhoDoDestino`; o guardar
(`gravarImagemDoSlide`, que lê o jeito do caminho e apaga a anterior de qualquer jeito); a rota da
arte, que busca a foto SÓ em `bonus-foto/`; o publicar, cuja cópia (`copiarTodasParaAFila`) é SÓ do
slide pronto, em `bonus/`; e a lista do que fica no bucket. A entrada cujo caminho não está em nenhum dos dois prefixos
não conta: o slide volta a pedir a imagem e o "Publicar" trava, que é o lado seguro (nunca publica
uma imagem do jeito errado); o arquivo dela, se houver, fica no bucket (ver "O que fica no bucket sem
dono"). Subir um jeito troca o outro, e a anterior sai do bucket.

**A assinatura** recebe o jeito e emite o prefixo dele. A foto declarada tem de estar na proporção do
espaço (860:573, com 1% de tolerância), entre 860×573 e 1720×1146, em JPEG, e com até 2 MB; o slide
pronto segue no 4:5. As medidas são declaradas pelo navegador, como no resto do upload. Um pedido
montado à mão ainda pode subir outros bytes do que declarou; o efeito fica no próprio carrossel, como
no slide pronto.

**Os 2 MB são o teto da busca da rota, com a mesma constante (achado 79).** O upload do slide segue o
teto do `/publicar` (8 MB), e a rota só lê a foto até 2 MB. Uma foto entre os dois seria assinada,
subiria e seria guardada, e a rota responderia sempre "faltou": o slide travaria o publicar para
sempre, com uma frase que manda esperar. Por isso a regra da foto (`problemaDaFotoDoEspaco`), a
assinatura e a busca da rota usam a mesma constante, exportada de um lugar só
(`FOTO_DO_ESPACO_MAX_BYTES`, `lib/bonus/publicar-regras.ts`), e o navegador recusa antes de assinar a
foto que, já reduzida, passa dela: "A foto passou de 2 MB mesmo reduzida. Tente outra foto, ou
exporte esta com menos qualidade."

**A rota da arte desenha a foto**, só no slide com espaço e com foto guardada:
- busca a foto no servidor, só pelo endereço público do nosso bucket (`urlPublicaDoObjeto`), e só
  se o caminho estiver na forma exata `<pasta da conta do carrossel>/bonus-foto/<uuid>.jpg`: nada de
  outra pasta, de outro prefixo, de outro host, nem de caminho vindo da URL;
- com teto de tempo (3 s) e de bytes (2 MB), e conferindo os primeiros bytes de JPEG, no molde de
  `fotoDaConta` (`lib/bonus/arte-foto.ts`);
- guardada em memória por instância e pelo caminho, no molde de `memoriaDasFotos`
  (`lib/bonus/arte-foto.ts:94-133`): a foto achada vale 10 minutos, a FALHA vale só 30 segundos, e as
  vencidas saem a cada busca. Uma falha passageira não pode deixar a instância desenhando em branco;
- desenha `<img>` de 860×573 com `objectFit: "cover"` dentro do espaço, sem borda e sem canto
  arredondado, como o Labs desenha a ilustração dele;
- se qualquer coisa falhar, o slide sai com o espaço em branco, e nunca quebrado. A resposta continua
  lida antes de sair (`respostaDaArte`, achado 65);
- **e diz se a foto veio** (achado 78): no slide com foto, a resposta leva o cabeçalho
  `X-Arte-Foto: sim` quando a foto foi desenhada, e `X-Arte-Foto: faltou` quando o espaço saiu em
  branco. Nos outros slides, o cabeçalho não vai.

**A versão da miniatura** (`versoesDosSlides`) passa a levar o caminho da foto do slide, quando ele
tem espaço e foto: trocar a foto troca a miniatura e o "Baixar". A miniatura do slide com foto é a
própria arte da rota, e não a foto do bucket.

**Publicar.** O slide com foto publica a ARTE desenhada, e não a foto. Ele vai pelo caminho das
artes "Só texto": o navegador baixa a arte da rota, converte em JPEG e sobe em `bonus-fila`. Só o
slide pronto vai pelo caminho das cópias. A versão que o navegador manda para o slide com foto é a que
a rota mandou com a arte (o texto do slide e o caminho da foto; ver "A versão vem da rota"); o
servidor recalcula e recusa a velha, como na arte "Só texto". A reserva confere também que as fotos
são as mesmas. A foto guardada num slide marcado "Só texto" não conta: ele vai com a arte "Só texto".

**A arte com a foto que faltou não sobe (achado 78).** A versão é um resumo do texto e do caminho, e
não sabe se a foto foi desenhada; o navegador, sem o cabeçalho, só conferiria o `r.ok` e a conversão.
Uma busca da foto que passasse de 3 s, ou falhasse uma vez, na hora de publicar, subiria a arte com o
espaço em branco, e o post sairia sem a foto, sem volta. Por isso, ao preparar o slide com foto, o
navegador exige `X-Arte-Foto: sim`: qualquer outra coisa recusa antes de assinar, com a frase "A foto
do slide N não carregou. Espere um instante e publique de novo." A miniatura pode sair em branco numa
falha (ela se refaz na próxima busca); o post, não.

**O que a rota diz da foto vale mais que a página (achado 81, decisão do Eduardo: corrigir antes da
prova).** O servidor decide pelo banco quem vai como arte e com que versão, e a página pode estar velha:
com a foto posta noutra aba, num slide que esta página ainda vê como "Só texto", ela mandaria a arte
sem exigir o "sim", e a versão bateria. Uma busca que falhasse nessa hora publicaria o espaço em branco.
Por isso o navegador recusa toda arte que venha com `X-Arte-Foto` e não diga "sim", e no slide que ele
sabe ter foto exige o cabeçalho. A rota só o manda no slide que tem foto no banco.

**O que falta para publicar** passa a ser: todo slide com espaço tem uma imagem, de qualquer jeito.

**"Só texto"** tira o espaço: nem a foto nem o slide pronto são usados (ficam guardados, e voltam se o
espaço voltar).

**Os dois donos.** O desenho muda só quando há foto. Os vetores e a conta não mudam, e o Labs
(`site-ia`) fica avisado de que o Chat desenha a foto no espaço com `cover`, sem canto, e de que o
Labs desenha a ilustração com `contain`. As duas dão o mesmo resultado quando a imagem já vem na
proporção do espaço, que é o caso das duas.

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
- o arquivo de uma entrada de imagem com caminho fora dos dois prefixos (adendo): ela não conta, e a
  troca não a apaga, porque a leitura a pula;
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
| tela | o card com o slide pronto mostra a imagem guardada e o "Trocar slide pronto"; o aviso do texto que mudou; o "Publicar" travado com a frase de cada motivo; a página travada quando agendada |
| integração | guardar a imagem grava só aquele slide e mantém a conta e o "Só texto"; trocar apaga a anterior; caminho de outra pasta ou outro prefixo é recusado |
| integração | publicar enfileira na conta do carrossel, com a selecionada no cookie sendo outra; os caminhos da fila são cópias em `bonus-fila`, na ordem dos slides; as guardadas continuam no bucket |
| integração | dois publicar ao mesmo tempo: um post só, e as cópias do segundo apagadas |
| integração | recusa e falha no meio da cópia apagam as cópias; falha na fila desfaz a reserva; a reserva velha substituída tem os caminhos dela apagados |
| integração | a linha da fila apagada depois de enfileirar (como faz o `deleteAccount`): o carrossel segue travado, mesmo passados os 10 minutos (achado 75) |
| integração | a assinatura recusa medidas declaradas fora de 4:5 |
| integração | a trava no servidor: salvar slide, "Só texto", assinar, guardar e publicar recusados com o item `pending`, `sending` e `sent`; liberados com `failed` e `skipped` |
| integração | o caminho de "Só texto" que já está no payload de outro item da fila é recusado |
| guardas | toda action começa por `exigirSessao`; nenhum arquivo do `/publicar`, do bucket, do dreno ou da fila no diff |

Do adendo (a foto no espaço):

| suíte | o quê |
|---|---|
| pura | o jeito lido do caminho guardado: `bonus-foto/` é foto, `bonus/` é slide pronto (inclusive as entradas de antes do adendo), outro prefixo não conta |
| pura | a foto declarada: a proporção do espaço passa, as bordas de 1% passam, 4:5 é recusada, menor que 860×573 é recusada, maior que 1720×1146 é recusada |
| pura | a versão da miniatura muda com o caminho da foto do slide com espaço, e não muda com a foto do slide "Só texto" |
| pura | o que falta para publicar conta a foto e o slide pronto do mesmo jeito |
| tela | os dois botões no slide com espaço; nenhum no "Só texto"; o "Trocar foto" e o "Trocar slide pronto" |
| tela | a foto cortada ao centro no navegador, na proporção do espaço, e reduzida até 1720×1146; a foto pequena recusada antes de assinar |
| tela | o aviso do texto que mudou só no slide pronto; a miniatura do slide com foto é a arte da rota |
| integração | guardar a foto e o slide pronto; trocar a foto pelo slide pronto apaga a foto do bucket, e o contrário também |
| integração | a foto em `bonus-foto/` nunca vai para a fila como cópia: o slide com foto leva a arte desenhada, e a cópia é só do slide pronto |
| desenho | a rota recusa como foto um caminho de `bonus/` (o slide pronto) e desenha o espaço em branco, com `X-Arte-Foto: faltou` |
| integração | publicar com um slide de foto: ele vai pelo caminho das artes (não copia a foto), com a versão da arte com a foto conferida; a versão velha é recusada |
| integração | a assinatura recusa a foto fora da proporção do espaço, e o slide pronto fora do 4:5 |
| desenho | a foto entra no espaço: o PNG tem a foto onde era branco, e o texto acima dela fica igual ao do slide sem foto |
| desenho | a foto que falha (bytes que não são JPEG, caminho de outra pasta ou de outro prefixo, outro host, resposta lenta) desenha o espaço em branco, a rota responde um PNG válido, e o cabeçalho diz `X-Arte-Foto: faltou`; com a foto desenhada, `sim`; sem foto no slide, nenhum |
| pura | a memória da foto do espaço: a achada vale 10 minutos, a falha só 30 segundos, as vencidas saem (relógio falso) |
| tela | ao publicar, a arte com `X-Arte-Foto: faltou` (ou sem o cabeçalho) recusa o slide com foto antes de assinar, com a frase, e nada sobe (achado 78) |
| tela | a arte que vem com `X-Arte-Foto: faltou` num slide que a página vê sem foto também não sobe; com "sim", sobe (achado 81) |
| integração | o guardar tira o jeito do prefixo do caminho: `bonus-foto/` é foto, `bonus/` é slide pronto, outro prefixo é recusado |
| desenho | os vetores combinados com o Labs continuam iguais (o sha256 do arquivo e a conta) |
| pura e integração | a foto de 2 MB passa e a de 2 MB e 1 byte é recusada, na regra, na assinatura e na busca da rota, com a mesma constante (achado 79) |
| tela | a versão que vai ao publicar é a que a rota mandou com a arte, e não a da página; depois de salvar um slide "Só texto" sem recarregar, a versão nova vai (achado no ensaio) |
| integração | a foto guardada num slide marcado "Só texto" não entra: ele vai com a arte "Só texto" |
| desenho | sem foto, a arte sai igual byte a byte à de antes do adendo |

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
depois. O preview usa o banco e o bucket de produção. **Sem post real** (decisão do Eduardo no
adendo): nenhuma das contas conectadas é de teste. Tudo no carrossel de 4 slides do Thiago
(`4c5701a8`), que no fim volta a como estava (com o OK dele, e qualquer script lido pela auditoria
antes de rodar).

1. Uma foto menor que o espaço é recusada antes de subir; um slide pronto fora do 4:5 também (sem
   gravar nada).
2. Subir uma foto num slide: a miniatura é a arte do Chat com a foto no espaço, com o texto e o
   cabeçalho; o "Baixar" baixa essa arte.
3. Trocar a foto pelo slide pronto do Canva no mesmo slide: a foto sai do bucket, e a miniatura vira o
   slide pronto.
4. Editar o texto: o aviso "o texto mudou depois desta imagem" aparece no slide pronto, e não no slide
   com foto, cuja arte se redesenha.
5. Agendar para daqui a 7 dias: a página mostra "Agendado", e texto, "Só texto" e imagens ficam
   travados. O post aparece no calendário, com a conta do carrossel selecionada no menu. Na fila, os
   caminhos estão em `bonus-fila`: a arte com a foto, a cópia do slide pronto e as artes "Só texto".
6. Cancelar no calendário (a auditoria confirma o `skipped` e as cópias fora do bucket): o botão volta,
   e as imagens continuam no carrossel.

**Fica NÃO MEDIDO até o primeiro post real** (vai assim no corpo do PR):
- a Meta buscar a URL de duas barras (`<pasta>/bonus-fila/<uuid>.jpg`);
- o recorte das artes, das fotos no espaço e dos slides prontos no carrossel publicado;
- a ordem dos slides e a legenda no Instagram;
- o "Agora" drenar e a linha ir a `sent`;
- as cópias saírem do bucket depois do `sent`.

O que a primeira prova (antes do adendo) já mediu: a página, os dois botões lado a lado ("Subir do
Canva" ao lado do "Baixar", pedido do Eduardo, commit `30842a1`), o "Só texto" gravado, e a imagem
de 1080×1350 guardada no slide com a versão do texto. Ela também achou o desencontro que virou este
adendo: a imagem subida tomava o slide inteiro, e o uso principal era a foto no espaço.

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
- Subir o carrossel inteiro do Canva de uma vez, na ordem (decisão do Eduardo no adendo).
- Um "Tirar imagem" no card (achado 77): até ele existir, imagem errada se troca, não se tira.
- O criador de imagem (Etapa 6), que vai pôr a imagem gerada no mesmo espaço da foto.
- O carrossel avulso (Etapa 7).
