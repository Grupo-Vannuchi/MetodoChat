# O gerador de bônus — Etapa 3: a arte do carrossel

**Nascido em:** 01/10/2026, desenhado com o Eduardo pela caixa de perguntas, com a sessão auditora
levantando os riscos antes da spec.
**Estado:** desenho aprovado ("Está certo, pode escrever"). Depende de dois PRs antes dela: o #3
(Etapa 2, o texto do carrossel) e o da atualização do Next (abaixo).
**Projeto de quem:** do Vinícius Gualberto. Como as etapas anteriores, entra como visita: pasta
própria e o mínimo de toque no que já existe.
**Etapas anteriores:** `docs/specs/2026-09-29-gerador-de-bonus.md` e
`docs/specs/2026-09-30-gerador-de-carrossel.md`.

---

## O que é

Na página do carrossel (Etapa 2), cada slide aparece desenhado como no Método Labs, a "capa branca
com os textos": PNG de 1080×1350, com o cabeçalho da conta do Instagram do carrossel. Em cada slide,
o operador escolhe se ele reserva um espaço em branco para uma imagem ou se é só texto. A tela avisa
quando o texto não cabe. O operador baixa os slides, um a um ou todos, e leva ao Canva para pôr as
imagens. Nenhuma imagem é guardada: cada slide é desenhado na hora, a partir do texto salvo.

Antes da arte, a etapa abre com o achado 57: o bônus publicado no Labs sem palavra-chave ou sem tema
ganha uma mensagem própria (ver "Primeiro: o achado 57").

---

## A ordem das etapas, decidida pelo Eduardo em 01/10

| ordem | o quê |
|---|---|
| antes | atualizar o Next do Chat para 16.3.7, num PR próprio (ver "O pré-requisito") |
| **3** | **esta spec**: primeiro o achado 57; depois a arte, a prévia, o "não cabe", e baixar |
| depois | o gerador de imagem pela API da OpenAI, que preenche o espaço reservado (etapa própria) |
| depois | publicar o carrossel, com o "devolver" das imagens editadas no Canva |
| depois | o carrossel avulso: sem bônus, nada ligado ao Labs |
| depois | fechar o funil (a Etapa 5 da spec de 29/09) e puxar um bônus que já existe no Labs |

---

## O que foi medido antes de desenhar

**No Labs** (site-ia, `origin/main` em `45bc973`; os arquivos da arte mudaram por último em
`19d25be`):

- A arte é desenhada **no servidor**, por `ImageResponse` de `next/og` (Satori + resvg), uma rota
  GET autenticada que devolve um slide por pedido (`src/app/admin/carrossel/arte/route.tsx`).
- A geometria é uma fonte única (`src/lib/ia/geometria-da-arte.ts`): 1080×1350 (4:5), margem 110,
  entrelinha 1,32, largura útil 860, espaço da ilustração 860×573 (3:2).
- O tamanho da fonte cai em degraus por tipo de slide, com um fator quando não há ilustração, e piso
  de 34 px (`src/lib/ia/slides.ts`: `tamanhoDoTexto`, `slidesQueNaoCabem`, `slidesParaArte`,
  `slidesDoPost`). Os degraus foram calibrados com e sem ilustração.
- O layout segue o manual de arte trazido pelo Eduardo em 02/09: fundo branco, texto preto, fonte
  Carlito, hierarquia por peso, texto ancorado no topo, cabeçalho com foto redonda, nome e @. No
  último slide do carrossel, o cabeçalho desce para o pé; no post de uma imagem, fica no topo.
- A Carlito é buscada no Google Fonts na hora de desenhar, com cache de processo.
- Os PNGs não são guardados. O download é um PNG por slide; não há "baixar todos" nem zip.

**No Chat:**

- O Chat está no Next 16.2.10. A CVE-2026-94545, uma execução remota de código no `next/og`, foi
  corrigida na 16.3.6; o Labs subiu para a 16.3.7 por causa dela (site-ia `d3be6c3`). Hoje o Chat
  não usa `next/og`, então a falha não é alcançável. Trazer a arte para o servidor do Chat a tornaria
  alcançável.
- O `/publicar` aceita só JPEG, até 8 MB, largura mínima 320 e proporção de 0,8 a 1,91, e converte
  PNG para JPEG no navegador. A arte em 1080×1350 (0,8) cabe. Isso importa para a etapa de publicar,
  não para esta.
- A Vercel recusa corpo acima de 4,5 MB (`lib/bucket.ts`). Um PNG por pedido cabe; um zip de dez
  montado no servidor poderia não caber.
- A tabela `accounts` guarda `username`, `name` e `profile_picture_url` de cada conta conectada. A
  URL da foto vem da Meta, expira, e o cron diário a renova.
- O `proxy.ts` deixa passar sem sessão os caminhos que terminam em `.png`, `.jpg`, `.svg` e `.ico`.
- A Carlito é SIL Open Font License 1.1, com o nome reservado "Carlito" (`google/fonts`,
  `ofl/carlito/METADATA.pb` e `OFL.txt`, conferido em 01/10).

---

## As decisões, e de quem

| decisão | quem, quando |
|---|---|
| Desenhar no servidor, reaproveitando a arte do Labs, com a atualização do Next antes, num PR próprio | Eduardo, 01/10 |
| Baixar: um botão por slide e um "Baixar todos" que baixa os PNGs um a um, sem zip | Eduardo, 01/10 |
| O cabeçalho vem de uma conta do Instagram conectada no Chat, gravada no carrossel; vale para todas as contas, não só a do Thiago | Eduardo, 01/10 |
| Em cada slide, "com espaço para imagem" ou "só texto"; o espaço sai em branco no PNG | Eduardo, 01/10 |
| Devolver as imagens editadas no Canva fica para a etapa de publicar | Eduardo, 01/10 |
| O gerador de imagem pela API da OpenAI é uma etapa própria, logo depois desta | Eduardo, 01/10 |
| Sem selo de verificado e sem tema escuro nesta etapa (o pedido é a capa branca) | Eduardo, no desenho aprovado em 01/10 |
| O achado 57 é a primeira coisa da etapa seguinte à Etapa 2, que é esta | Eduardo, 01/10 ("Na próxima etapa") |

---

## O pré-requisito: o Next 16.3.7

Um PR próprio, antes da Etapa 3, que só sobe o Next do Chat de 16.2.10 para 16.3.7. Ele mexe no
projeto inteiro, e por isso é do Vinícius: a Etapa 3 só começa depois do merge dele.

O que o PR prova:

- as mudanças da 16.3 lidas em `node_modules/next/dist/docs/` antes de qualquer outra coisa, como
  manda o `AGENTS.md`;
- `npm run verify` limpo e a suíte de integração verde no container;
- **o build do preview da Vercel**: o verde local (Node 24) não prova outro ambiente, que foi a
  lição do Labs em `d3be6c3`;
- os caminhos críticos do dono conferidos depois da atualização: o webhook das DMs, o dreno da fila
  e o `/publicar`.

---

## Primeiro: o achado 57

Hoje, um bônus que está na lista pública do Labs sem `palavraChave` ou sem `tema` cai em
`formato_estranho` (`lib/bonus/publicado.ts`, `situacaoNaLista`), e a tela diz "O Labs respondeu
num formato que o Chat não reconhece. Avise quem cuida do Labs." A frase está errada para esse caso:
o Labs respondeu no formato do contrato (os dois campos são opcionais e vêm como chave ausente,
documentado pelo Labs em `7971720`), e quem resolve é o operador, no /admin do Labs.

O conserto:

- `situacaoNaLista` ganha dois resultados: `sem_palavra` (a chave `palavraChave` ausente, ou texto
  vazio) e `sem_tema` (o mesmo para `tema`). Faltando os dois, vale `sem_palavra`.
- `quadroDaSituacao` dá a cada um a sua frase, em tom de atenção:
  - "Este bônus está publicado no Labs sem palavra-chave. Cadastre uma no /admin do Labs para gerar
    carrossel."
  - "Este bônus está publicado no Labs sem tema. Cadastre um no /admin do Labs para gerar carrossel."
- Nada muda no que é liberado: só `publicado` gera carrossel. Uma palavra presente que o Chat não
  aceita (`palavraValida`), e qualquer outra forma fora do contrato, seguem em `formato_estranho`.

---

## O desenho

### Onde mora

Tudo dentro de `app/bonus/` e `lib/bonus/`, como as etapas anteriores. Fora disso:
`migrations/015-arte-do-carrossel.sql`, uma entrada em `lib/esquema.ts`, e os dois `.ttf` da fonte
com a licença. Se o `.ttf` não entrar na função da Vercel, `next.config.ts` ganha um
`outputFileTracingIncludes` (ver "A fonte").

### A coluna `arte` (migração 015)

`carrosseis_gerados` ganha uma coluna `arte jsonb` (`add column if not exists`), com as escolhas da
arte:

- `conta`: o `ig_user_id` da conta do cabeçalho;
- `soTexto`: a lista dos números de slide marcados como "só texto". Os outros saem "com espaço",
  que é o padrão, como no Labs.

Um carrossel novo nasce com `conta` igual à conta selecionada no Chat na hora do pedido. Gravar na
primeira visita, como se pensou no desenho, seria uma escrita dentro de um GET; gravar no pedido
aproveita a escrita que já existe. Os carrosséis que já existem têm `arte` vazia: até o operador
escolher, a arte usa a conta selecionada no Chat no momento, e a tela diz isso. A `015` entra em `naoObservaveis` de `lib/esquema.ts`, como a
`013` e a `014`, e é aplicada à mão, depois do ensaio a seco e com o OK do Eduardo.

### A rota da arte

`GET /bonus/[id]/carrossel/[cid]/arte?slide=N`, um route handler (`runtime nodejs`) que devolve um
PNG por pedido. O caminho **não termina em `.png`**, para não escapar do `proxy.ts`, e mesmo assim a
rota confere a sessão por conta própria: sem sessão, 401.

Antes de desenhar, ela confere: `id` e `cid` como uuid; o carrossel existe e é desse bônus; está
`pronto`; o texto (`revisado ?? gerado`) tem forma válida; `N` é inteiro de 1 ao total. Qualquer
falha responde com erro, sem desenhar.

Cabeçalhos:

- `Cache-Control: private, no-store`, sempre. Imagem autenticada nunca sai como `public`: fora do
  desenvolvimento, o padrão do `ImageResponse` é `public, immutable, no-transform, max-age=31536000`
  (conferido em `node_modules/next` 16.2.10; conferir de novo na 16.3.7).
- `Content-Disposition: attachment` com nome de arquivo (`<slug>-slide-NN.png`) quando o pedido é
  para baixar, e `inline` para a prévia.

A prévia usa um parâmetro de versão na URL, para o navegador pedir de novo quando algo mudar. Ele
leva **tudo** o que muda a imagem: a data do texto (`revisado_em` ou `gerado_em`), a coluna `arte` e
o nome, o @ e a foto da conta.

### Os slides

Trazidos do Labs como estão, com o commit de origem no cabeçalho de cada arquivo ("dois donos": a
mudança se avisa nos dois sentidos, como nas instruções da Etapa 2):

- `geometria-da-arte.ts` e `slides.ts`, com os testes deles, e os nomes de campo adaptados
  (`chamada` no Chat, `chamadaParaAcao` no Labs);
- o desenho do slide de `arte/route.tsx`, com quatro diferenças:
  1. sem ilustração: o espaço reservado sai **em branco**, sem a moldura tracejada nem o escrito do
     Labs, para receber a imagem no Canva;
  2. "só texto" usa a geometria e os degraus do Labs para slide sem ilustração;
  3. sem tema escuro e sem selo;
  4. o cabeçalho vem da conta do carrossel.

A lista de slides segue a do Labs: o carrossel vira gancho, os slides de conteúdo e a chamada no
último (com o cabeçalho no pé). O post de uma imagem vira um slide com a chamada no fim do texto,
separada por linha em branco, e o cabeçalho no topo. Com total 2, são só o gancho e a chamada. O
schema do Labs pede de 6 a 9 slides de conteúdo (total de 8 a 11), então a arte dele nunca desenhou
um carrossel de 2 a 7 slides; os totais pequenos entram na prova.

### A fonte

`Carlito-Regular.ttf` (400) e `Carlito-Bold.ttf` (700), **sem modificação**, commitados com o
`OFL.txt` ao lado, e lidos do disco (`readFile(join(process.cwd(), …))`, o padrão da documentação do
Next 16). Nada de buscar no Google Fonts na hora de desenhar. Localmente a leitura sempre passa; só o
preview da Vercel prova que o arquivo entrou na função. Se não entrar, `outputFileTracingIncludes`.

### O cabeçalho e a foto

O nome e o @ vêm de `accounts` (`name` e `username`). A foto vem de `profile_picture_url`, que a
própria rota busca, com estas travas:

- só `https`, e só os hosts do CDN do Instagram e do Facebook (a lista é medida no banco antes do
  plano, sem imprimir as URLs);
- `redirect: "manual"`, tempo de 3 s e teto de bytes;
- só JPEG e PNG;
- a imagem entra no Satori como `data:` URI **depois** dessa busca, e nunca como URL: com a URL, o
  Satori buscaria sozinho, por fora das travas.

Qualquer falha cai nas iniciais num círculo, como no Labs. A rota nunca busca uma URL vinda do
formulário.

### A prévia e o "não cabe"

A seção da arte fica na página do carrossel, junto do editor (o formulário da Etapa 2). A prévia
mostra cada slide em miniatura, com a escolha "com espaço / só texto", o "Baixar" e o aviso "não
cabe".

O editor e a prévia ficam num mesmo componente do navegador. Quando o "Salvar revisão" responde
"Revisão salva.", ou quando se troca o espaço de um slide ou a conta, a versão das miniaturas muda e
elas são pedidas de novo. Nada disso usa redirect nem `router.refresh`: a lição dos achados 52 e 54
é que recriar a página apaga o que estava na tela.

O "não cabe" vem de `slidesQueNaoCabem` e `tamanhoDoTexto`, as mesmas funções puras no servidor
(junto de cada slide) e no editor (enquanto se digita). Elas são uma **estimativa** por caracteres,
do Labs. A prova confere a imagem de verdade com textos no limite de cada degrau.

### Baixar

- Um "Baixar" em cada slide: a URL da rota com o pedido de download.
- "Baixar todos": no navegador, um download de cada slide, em ordem, com uma pequena pausa entre
  eles. O navegador costuma pedir permissão para "baixar vários arquivos", e a tela avisa isso antes.

---

## As telas

Na página do carrossel pronto, abaixo da situação no Labs:

- a conta do cabeçalho, num seletor com as contas conectadas, mostrando qual está em uso;
- a grade das miniaturas, cada uma com "com espaço / só texto", o "Baixar" e o aviso "não cabe";
- "Baixar todos", com o aviso de permissão do navegador;
- o editor da Etapa 2, com o aviso "não cabe" ao lado de cada campo, enquanto se digita.

Toda resposta de action volta como estado do formulário, junto do botão, sem redirect.

---

## Segurança

- A rota da arte confere a sessão, e cada action começa com `await exigirSessao()`.
- Todo id é conferido como uuid; o carrossel tem de ser do bônus da URL; o número do slide está na
  faixa.
- A imagem sai com `Cache-Control: private, no-store`.
- A busca da foto só vai a hosts do CDN da Meta, sem seguir redirect, com tempo e teto, só JPEG e
  PNG, e entra no Satori como `data:` URI.
- A conta escolhida tem de ser uma das conectadas.
- O texto vai ao Satori como texto, nunca como HTML.
- A arte só existe com o Next 16.3.7 ou mais novo.

---

## Testes

| suíte | o quê |
|---|---|
| pura | o achado 57: chave ausente e texto vazio, de cada campo e dos dois juntos, e a frase de cada caso; a palavra recusada pelo Chat segue em `formato_estranho` |
| pura | a geometria e os degraus trazidos do Labs, com os testes de lá; a lista de slides para os totais 1 a 10 e o post |
| pura | a coluna `arte`: forma válida, padrão "com espaço", conta |
| pura | a versão da URL leva tudo o que muda a imagem |
| pura | a busca da foto: hosts aceitos e recusados, redirect, tamanho, tipo |
| pura | a fonte: os dois `.ttf` e o `OFL.txt` existem, e os `.ttf` são TrueType |
| pura | o "não cabe": qual campo do editor cai em qual slide e com qual geometria |
| integração | a rota: 401 sem sessão; uuid, dono e faixa do slide; `Cache-Control` e `Content-Disposition`; PNG de 1080×1350 |
| integração | a `015`; gravar a conta e o "só texto" |
| tela | a escolha por slide, a conta, a versão das miniaturas depois de salvar, e o "Baixar todos" disparando um download por slide |

Como nas etapas anteriores: todo teste escrito antes do código e visto falhar, e as proteções
provadas também retirando-as e vendo o caso cair. O que só acontece no navegador de verdade (o
download de vários arquivos, a página sem ser recriada) é provado no Edge sem janela e pelo Eduardo.

---

## A prova real

Cada escrita só com o OK do Eduardo.

1. O preview da Vercel desenhando a arte: a fonte Carlito de verdade (e não a de reserva), e a foto
   da conta buscada a partir da região da Vercel.
2. Carrosséis de 1, 2, 3, 4 e 10 slides, desenhados e baixados.
3. Textos no limite de cada degrau, nos dois modos ("com espaço" e "só texto"), com a imagem
   conferida para ver se cortou.
4. "Baixar todos" num navegador de verdade, com os arquivos baixados contados.
5. Uma conta sem foto (ou com a foto vencida): as iniciais.
6. Trocar a conta e o espaço de um slide, e ver a miniatura mudar sem a página ser recriada.

---

## Pré-condições do merge

1. O PR do Next 16.3.7 mergeado antes.
2. A `015` aplicada na produção, conferida pelo ensaio seguinte ("já aplicada").
3. `npm run verify` limpo, a integração verde no container, e o preview desenhando a arte com a
   Carlito.
4. Nenhum `next dev` apontado para a produção durante o deploy.
5. Depois do deploy, recarregar as abas abertas: a Skew Protection prende componentes novos ao
   deploy anterior.

---

## Dois donos

O desenho do slide, a geometria e os degraus vêm do Labs. Enquanto o Labs tiver o gerador de
carrossel dele, mudança na arte de qualquer um dos lados se avisa ao outro, como nas instruções.

---

## Fora desta etapa

- O gerador de imagem pela API da OpenAI (etapa própria, logo depois).
- Publicar o carrossel e devolver as imagens editadas no Canva (etapa de publicar).
- O carrossel avulso, sem bônus.
- Puxar um bônus que já existe no Labs.
- O selo de verificado e o tema escuro.
