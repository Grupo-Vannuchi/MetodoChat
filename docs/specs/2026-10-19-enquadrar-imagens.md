# O /publicar enquadra as imagens do carrossel e do post de imagem

**Nascido em:** 19/10/2026, sobre a `main` em `260b9dd` (a Etapa 10 do gerador, no ar desde as 14:54Z).
É o ponto 3 dos feedbacks que o Vinícius deixou ao sair ("correção das imagens do carrossel"), e o
Eduardo confirmou pela caixa que é o carrossel do `/publicar`, o compositor antigo, e não o do gerador.
**Estado:** desenho aprovado pelo Eduardo pela caixa em 19/10, em três partes. A auditoria do perigo e a
revisão da spec (`metodochat-0d`, sobre `268daf3`) trouxeram os achados 107 e 108 (BLOQUEIA), 109 a 112
(CORRIGIR) e 113 (ANOTAR, já em produção), todos absorvidos nesta versão. Duas decisões novas do Eduardo
saíram dessa revisão: o reels e o story também passam a enviar no clique, e o 113 é corrigido aqui. A
revisão do diff (`9f68b1e`) trouxe o achado 114 (a prova não clica com "Publicar agora" marcado) e três
correções de precisão, absorvidos; a spec foi liberada em `057a18c` e lida pelo Eduardo. No começo do
plano, uma sonda de laboratório mediu o que o `redirect` da action faz com a tela: ela é recriada. Com
isso, o identificador do pedido sai (por recomendação da auditoria) e a action não muda. A revisão do
plano (`56eb105`) trouxe os achados 115 (o post sem legenda, BLOQUEIA), 116 (a subida dentro da transição) e
117 (o EXIF que falhava aberto), absorvidos aqui e no plano. O caso de tela do 115 achou ainda um defeito já
em produção, o fuso vazio (achado 118), e o Eduardo decidiu pela caixa corrigi-lo nesta etapa. A segunda
revisão do plano (`6e032a9`) achou o mesmo fuso vazio no remarcar, medido por uma sonda, e o Eduardo decidiu
corrigir junto também; e trouxe o 119 (o "Quando" que não travava na subida) e o 120 (a foto deitada no
navegador que recusa a orientação), absorvidos.
**Projeto de quem:** do Vinícius Gualberto, que saiu da empresa em 15/10. Por decisão do Eduardo, o
código dele pode mudar no jeito dele: o porquê e a medição no comentário, a regra como função pura com
teste, uma mutação por proteção e o commit numa frase. Mexer no `/publicar` pede antes a auditoria do
perigo, que está feita.

---

## O que é

O compositor do `/publicar` não corta nem enquadra imagem nenhuma: ele só aceita ou recusa cada arquivo
pela faixa da Meta, de 0,8 a 1,91 (`lib/publicacao.ts:41-43`, `:185-199`). Medido no código em 19/10:

1. **Foto de celular em pé é recusada.** As proporções 3:4 (0,75), 2:3 e 9:16 ficam abaixo de 0,8, e a
   tela não oferece cortar.
2. **O Instagram corta todos os slides pela proporção do primeiro**, e nada no painel compara a
   proporção de cada item com a do primeiro. A regra só aparece num aviso em texto
   (`app/publicar/enviador.tsx:225-232`), citada da spec de 03/09
   (`docs/specs/2026-09-03-publicar-no-instagram.md:199`), e não medida. Uma arte com texto perto da
   borda sai cortada no perfil público, onde não há `DELETE` que desfaça (medido em 03/09).
3. **A lista de montagem só mostra o nome do arquivo**, sem miniatura e sem remover
   (`enviador.tsx:279-307`), e escolher de novo apaga a lista (`:152`). Um arquivo recusado no meio fica
   fora da lista, e o laço segue de propósito (`:176-189`, "um arquivo recusado no meio de dez não é
   motivo para descartar os outros nove"), mas o único aviso é a linha "falhou" na janelinha de envio.
4. **A prévia quebra com vídeo, nas quatro formas.** A página do post desenha `<img>` para todos os
   caminhos, inclusive `.mp4` e `.mov` (`app/publicar/post/[id]/page.tsx:197-214`), e o calendário usa o
   primeiro caminho como capa (`app/publicar/page.tsx:448-454` e `:485-491`). Vale para o carrossel com
   vídeo, para o reels e para o story de vídeo.
5. **A página do post cancelado mente sobre o arquivo** (achado 113, em produção). Ela diz "O arquivo
   continua no armazenamento." (`fraseSobreAMidia`, `lib/publicacao.ts:2413-2417`, presa por
   `tests/publicacao.test.ts:2667-2671`), mas o cancelar apaga a mídia
   (`app/publicar/post/actions.ts:199-202`). As provas de 15, 16 e 19/10 mediram 400 no bucket depois de
   cancelar.

O mesmo enquadramento vale para o post de **imagem única** do `/publicar`, que recusa a foto em pé pela
mesma faixa.

---

## As decisões, e de quem

Do Eduardo, pela caixa, em 19/10:

| assunto | decisão |
|---|---|
| o que entra | os quatro problemas: enquadrar a foto, ver o corte antes, miniaturas e remover, e a prévia com vídeo |
| a proporção | a pessoa escolhe entre 4:5 (em pé), 1:1 (quadrado) e 1,91:1 (deitado), com 4:5 marcado |
| como cada imagem cabe | cortada ao centro, como padrão; em cada slide dá para trocar para "inteira, com bordas" |
| as bordas | brancas |
| o vídeo, que o Chat não recorta | vai como está; a prévia mostra como o Instagram vai cortá-lo, com aviso |
| onde vale o enquadramento | no carrossel e no post de imagem única |
| quando os arquivos sobem | ao clicar em Publicar, e não ao escolher |
| o reels e o story (depois da revisão) | também sobem no clique: um jeito só para as quatro formas |
| o achado 113 (depois da revisão) | corrigido nesta etapa |
| o fuso vazio (achado 118, no plano, já em produção) | corrigido nesta etapa |
| o fuso vazio também no remarcar (medido na segunda revisão) | corrigido nesta etapa |
| a tela e o "por dentro" | aprovados |

---

## A tela (`/publicar/novo`)

### O enquadramento (formas "imagem" e "carrossel")

- **A proporção**, acima do campo de arquivos: "4:5 (em pé)", "1:1 (quadrado)" e "1,91:1 (deitado)",
  com "4:5 (em pé)" marcado. Trocar a proporção refaz as miniaturas, e nada é enviado.
- **Escolher arquivos não envia nada.** No carrossel, escolher de novo acrescenta ao fim da lista, até
  `CARROSSEL_ITENS_MAX` (10). O que passar de 10 não entra, com a frase de hoje da quantidade
  (`recusaDaQuantidade`, `lib/publicacao.ts:1257`). Na imagem única, escolher de novo troca o arquivo.
- **A lista de montagem**, uma linha por arquivo:
  - **a miniatura já enquadrada**, na proporção escolhida, desenhada no navegador com o mesmo branco das
    bordas. No carrossel só de vídeos, a caixa tem a medida do primeiro vídeo, porque é por ele que a Meta
    corta os outros;
  - o nome do arquivo (`rotuloDoEnvio`, como hoje);
  - nas imagens, **"Cortar"** e **"Inteira, com bordas"**, com "Cortar" marcado;
  - **↑ ↓**, como hoje (`moverNaOrdem`), e **"Remover"**.
- **O vídeo do carrossel** aparece com o primeiro quadro e a marca de como o Instagram vai cortá-lo na
  proporção escolhida, com a frase "O Instagram corta este vídeo assim.". Ele não tem "Cortar" nem
  "Inteira, com bordas".
- **O arquivo que não serve** entra na lista **em vermelho, com o motivo**, e não conta. O motivo é o da
  **saída prevista**, e não o do original (achado 110): o PNG e o WebP viram JPEG no `canvas`, e a foto
  0,75 sai na proporção escolhida. Eles não ficam vermelhos por serem PNG ou estarem em pé. Fica vermelho:
  - o formato que nem o `canvas` nem a Meta aceitam;
  - a saída mais estreita que 320 px. A frase sugere "Inteira, com bordas" quando é o corte que a deixa
    estreita, como num 640×360 em 4:5, que dá 288 px;
  - o vídeo longo ou pesado demais, pelas regras de hoje.
- **Acima da lista:** "**O post vai sair com N slides.**". Com menos de 2 válidos no carrossel, o
  Publicar trava com a frase da quantidade. Quando há arquivo escolhido e nenhum serve (a imagem única com o
  único arquivo vermelho), a frase aponta a lista ("O arquivo escolhido não serve: o motivo está na lista.
  Escolha outro."), em vez de mandar escolher um arquivo.
- **A trava do primeiro slide** (achado 111). A Meta corta todos pela proporção do primeiro que SAI (o
  primeiro válido, pulando os vermelhos). Quando o post tem pelo menos uma imagem e esse primeiro é um
  vídeo, o Publicar trava em dois casos:
  - **o vídeo está fora da proporção escolhida** (1% de tolerância). A frase é "O primeiro slide decide o
    corte de todos: ponha uma imagem em primeiro.". Quando o vídeo está a 1% de uma das três proporções,
    ela acrescenta "ou escolha a proporção X", com a proporção certa;
  - **o vídeo não tem medida** (o navegador não o abre, como o `.mov` HEVC no Chrome): "Não consegui
    medir o vídeo do primeiro slide: ponha uma imagem em primeiro.".

  Um carrossel só de vídeos, que hoje é aceito, continua aceito: não há imagem a proteger.

### O envio no clique (as quatro formas)

- **O botão Publicar não envia o formulário sozinho** (achados 107 e 108). Ele vira um botão de cliente,
  no molde do gerador (`app/bonus/[id]/carrossel/[cid]/card-publicar.tsx:57-77` e `:129-131`):
  - trava no primeiro clique, e a trava é ligada antes de qualquer espera. Um segundo clique, ou um envio
    nativo do formulário, não começa outra leva;
  - o envio nativo do formulário é segurado e cai no mesmo caminho, sob a mesma trava. Correção da segunda
    revisão do plano: hoje o Enter NÃO envia este formulário no navegador, porque não há botão de `submit`
    e a data e o nome do áudio são campos que bloqueiam o envio implícito. O `onSubmit` fica como defesa. O
    invariante: o `submit` nativo do formulário SEMPRE leva `preventDefault` no próprio `form`, antes do
    ouvinte do React na raiz (o React confere `nativeEvent.defaultPrevented` antes de chamar a action do
    `<form action>`), e nunca chega à action pelo React. A action só é chamada pelo caminho da trava.
- **O formulário é lido no clique**, antes de qualquer espera (achado 115). Durante a subida a tela trava
  os campos com `disabled`, e campo desabilitado não entra no `FormData`: lido depois da subida, o post saía
  sem legenda, calado, nas quatro formas (medido pela auditoria com uma sonda). O `FormData` lido no clique
  é o que vai à action, com a forma e os caminhos acrescentados.
- **O fuso também é lido no clique.** Ele morava num campo escondido escrito por um efeito, e o React o
  devolvia ao valor inicial vazio a cada desenho: medido em 19/10 com o compositor de produção, o campo vale
  "180" depois de montar e fica vazio na primeira letra da legenda. A action cai então no fuso do painel
  (`fusoDoCampo`, 180), e quem agenda fora de Brasília vê o post sair na hora errada (em Manaus, 1 hora
  antes). O campo escondido sai.
- **Antes de subir qualquer arquivo**, a tela roda as mesmas funções puras que a action roda
  (`recusaDaQuantidade`, `problemaDaLegenda` sobre a legenda sem os espaços das pontas, e
  `camposDaDataHora`, `instanteDoAgendamento` e `momentoDaPublicacao`, `app/publicar/actions.ts`). A recusa
  aparece na tela com a frase da action, sem subir nada. Hoje todas essas recusas chegam depois da subida,
  porque o formulário não tem `required` (achado 109).
- **A subida**, depois do clique:
  1. a janelinha de envios (`app/publicar/envios.ts`) nasce aqui, e não na escolha;
  2. cada arquivo válido é preparado (enquadrado no `canvas`, ou mandado como veio, abaixo) e sobe, um
     de cada vez, na ordem da lista;
  3. o caminho de cada slide só é guardado depois que a subida dele respondeu 2xx.
- **A action só é chamada com todos os válidos subidos**, na ordem da lista, e todos na pasta da conta
  que a página mostra. A troca de conta no seletor (`app/account-switcher.tsx:46-57`) no meio da subida
  faria a action descartar calada o que é de outra pasta (`caminhosDoCampo`, `lib/publicacao.ts:1524-1535`)
  e publicar o resto; aqui a tela recusa e pede para recomeçar. A hora é conferida de novo logo antes de
  chamar a action, porque a subida pode levar minutos e a tolerância do "agora" é de 60 s
  (`lib/publicacao.ts:1379`, `:1416`).
- **Durante a subida**, a forma, a proporção, os modos, a lista, a legenda, o "Quando" e as opções do reels
  ficam travados (o "Quando" e as opções do reels pelo achado 119: eles vêm prontos da página, e a pessoa
  trocava "agora" por "outra hora" no meio de um reels, com a tela mostrando um valor e a action recebendo o
  do clique). Fechar ou recarregar a aba pede confirmação (`beforeunload`). Sair pelo menu interrompe a subida, e a janelinha diz "A
  publicação não foi pedida.". Hoje o laço e a subida sobrevivem a sair da tela (`enviador.tsx:148-191`,
  `:597-622`).
- **A subida corre fora da transição** (achado 116). Uma transição assíncrona aberta prende as seguintes, e
  o `Link` do menu navega por `startTransition`: com a subida dentro dela, o clique no menu ficaria parado
  até a subida e a action acabarem (lido no React embutido no Next, e não medido). A subida tem um estado
  próprio, que trava a tela e liga o `beforeunload`, e dentro da transição fica só a espera da action, que é
  o que a sonda mediu. Cada leva tem um `AbortController`, criado antes da primeira espera, com o sinal no
  pedido da assinatura e na subida, e conferido depois de cada espera.
- **Se uma subida falha**, nada vai para a fila, e a lista diz qual falhou. Os que já subiram ficam
  guardados, e um novo clique sobe só os que faltam. Mudar o modo, a proporção ou o arquivo de um slide
  descarta o caminho guardado dele, e trocar de conta no seletor descarta todos.
- **O que acontece depois da action, MEDIDO** (achado 109). A action termina em `redirect` para a
  própria tela, com o aviso, como hoje. Uma sonda de laboratório mediu, em 19/10, no Next 16.3.8, no
  `next dev` e no `next build` + `next start`, o que isso faz com um componente de cliente que chama uma
  action assim, dentro de `startTransition`, com redirect para a mesma rota e outro parâmetro de busca:
  - o componente é **recriado**: o estado some, e ele monta de novo;
  - a espera da action **rejeita** com `NEXT_REDIRECT`, e o `finally` roda;
  - o `isPending` volta a falso.

  A sonda é a raiz da página dela. No `/publicar/novo` o compositor fica dentro de uma página de servidor,
  e por isso a medição não é "medida no `/publicar`", mas os dois desfechos ficam cobertos abaixo.
- **Depois do sucesso**, a tela nasce vazia, porque é recriada. Se um Next futuro passar a manter o
  componente, a lista que ficar guarda os MESMOS caminhos: um novo clique chama a action com a mesma
  chave de dedupe (`pub:conta:forma:caminhos`, `lib/dedupe.ts:225-226`) e cai em "já enfileirado"
  (`app/publicar/actions.ts:127-135`), sem post em dobro. A proteção desse caso já existe.
- **Depois de uma recusa da action**, a lista some, porque os `File` não sobrevivem à recriação, e o que
  subiu vira órfão (nos resíduos). As conferências antes da subida (acima) deixam essa recusa rara:
  sobram a conta trocada no meio e a corrida do "já enfileirado".
- **A chamada da action não tem `catch` que engula o erro.** O `NEXT_REDIRECT` chega como rejeição, e um
  `catch` que o tratasse como falha poria "o envio falhou" por cima de um sucesso. Só `try`/`finally`, e
  o `finally` solta a trava.
- **O reels e o story** passam pelo mesmo clique, sem enquadramento: o arquivo vai como hoje, convertido
  ou cru pelas regras de `planoDaConversao`, só que sobe no clique.

### As prévias com vídeo (`/publicar/post/[id]` e o calendário, nas quatro formas)

- Uma função só decide se o caminho é vídeo: o reels sempre, e as outras formas pela extensão, como o
  dreno faz (`lib/publicacao.ts:292`). As duas prévias a usam.
- Na página do post, o vídeo aparece como `<video>` mudo, só com o primeiro quadro
  (`preload="metadata"`) e um ícone de vídeo, e não como `<img>` quebrada.
- No calendário, a capa é o primeiro caminho de imagem do post. Se o post só tiver vídeo, aparece o ícone
  de vídeo, e só enquanto o post não saiu (`app/publicar/page.tsx:497`), como a capa de hoje.

### A frase do post encerrado (achado 113)

`fraseSobreAMidia` passa a dizer o que aconteceu com o arquivo em cada caminho. Os encerramentos de uma
publicação, medidos pela auditoria em `260b9dd`:

| como encerrou | o arquivo | a frase |
|---|---|---|
| cancelado pelo painel: `skipped` com `MOTIVO_CANCELADO_PELO_DONO` (`app/publicar/post/actions.ts:159-164`) | apagado (`:199-202`) | o arquivo foi apagado |
| "conta não conectada": `skipped` pelo dreno (`lib/queue-drain.ts:1087-1091`), sem `limparOBucket` | fica | o arquivo continua no armazenamento |
| `failed` | fica ("Objeto de item falhado não é órfão", `lib/queue-drain.ts:301-303`) | o arquivo continua no armazenamento |
| `sent` | apagado depois de publicar (`:609`) | a frase de hoje, sem mudança |

As outras saídas `skipped` do dreno (`:966`, `:1135`, `:1143` e `:1247`) são de lote ou de mensagem, e
não de publicação. A frase decide pelo MOTIVO, e não pelo status, como o `statusBadge` já faz com
`MOTIVO_CANCELADO_PELO_DONO` (`app/labels.ts:443`).

### O fuso do remarcar (achado 118, na página do post)

O remarcar da página do post mandava o fuso por um campo escondido com `defaultValue` vazio, preenchido
por um `<Script id="fuso-do-remarcar">`. O `<Script>` do Next com o mesmo id roda UMA VEZ por documento.
Uma sonda mediu em 19/10, no `next dev` e no `next start`, com o fuso de Manaus forçado no navegador:

- o post aberto por carga inteira manda "240";
- o segundo post aberto por Link, como do calendário, manda vazio, e a action cai no fuso de Brasília.

O campo passa a ser de cliente e controlado (`app/publicar/campo-do-fuso.tsx`): o servidor o escreve vazio, a
hidratação põe o fuso do navegador, e um novo desenho não o apaga. Sem JavaScript ele fica vazio, e a action
cai no fuso do painel, como antes. O `<Script>` sai.

---

## Por dentro

### As regras, puras (`lib/publicacao.ts`, uma seção nova, "O ENQUADRAMENTO")

O lugar é este arquivo, pela regra que o Vinícius deixou escrita (`lib/publicacao.ts:867`, "AS DECISÕES
DA TELA DE COMPOR"): "um `if` sobre regra de negócio dentro do JSX está no lugar errado".

- **`PROPORCOES_DO_POST`**: as três, com o valor (0,8, 1 e 1,91), o rótulo e "4:5" como padrão.
- **`geometriaDoEnquadramento({ largura, altura, proporcao, modo })`**: devolve a medida do `canvas` e
  os dois retângulos do `drawImage`, o da origem e o do destino, todos em pixels inteiros.
  - **"Cortar":** o maior retângulo da origem na proporção, centrado, desenhado no `canvas` inteiro.
  - **"Inteira, com bordas":** a imagem inteira, centrada, com o resto do `canvas` em branco.
  - **A largura de saída** é a da origem (ou do recorte), até `CONVERSAO_LARGURA_MAX` (1440,
    `lib/publicacao.ts:908`), como hoje.
  - **O arredondamento nunca sai da faixa da Meta** (achado 112). 4:5 fica exatamente no limite de 0,8
    (`:42`, o teste `proporcao < 0.8` em `:195`). O invariante é escrito pela razão: no 4:5, largura sobre
    altura ≥ 0,8; no 1,91:1, ≤ 1,91. Quando a altura sai da largura, a do 4:5 arredonda para baixo e a do
    1,91:1 para cima; quando a largura sai da altura, o sentido inverte. A auditoria contou, de 320 a 1440
    de largura: o 4:5 arredondado para baixo dá 0 saídas fora da faixa, e arredondado ao mais próximo dá
    560.
  - **A saída menor que `IMAGEM_LARGURA_MIN` (320, `:40`)** devolve a recusa, com a frase acima. Não se
    amplia imagem.
- **`vaiSemRedesenho({ mime, largura, altura, bytes, proporcao, orientacao })`**: o arquivo vai como veio,
  sem `canvas`, só quando o enquadramento **não mudaria nenhum pixel**. Ou seja: JPEG; a geometria dá o
  recorte igual à imagem inteira e a saída com as medidas do original (igual à saída do `canvas`: no
  1,91:1 a proporção exata quase não existe, só em larguras múltiplas de 191, e o 1080×566 vai cru); até
  1440 px de largura; até 8 MiB; e a orientação EXIF ausente ou igual a 1. Sem medida, não vai cru. É a
  regra do Vinícius de "JPEG que já serve não passa pelo canvas" (`planoDaConversao`, `:951-982`),
  estendida à proporção. Não se usa a
  tolerância de 1% do gerador (0,792–0,808, `lib/bonus/publicar-regras.ts:61-62`): ali, a assinatura
  recusa abaixo de 0,8 depois. Aqui, um cru a 0,807 em primeiro cortaria os outros em cerca de 12 px.
- **`orientacaoDoJpeg(bytes)`**: lê a orientação EXIF no segmento APP1 do JPEG, pura e sobre os bytes.
  Devolve 1 só de uma leitura que chegou ao fim (os cabeçalhos acabaram sem EXIF, ou o EXIF não tem a
  etiqueta), e 0 quando não deu para ler (outro formato, bytes cortados, segmento malformado), e o 0 vai pelo
  `canvas` (achado 117). A tela lê só os primeiros 64 KiB: um APP1 que termina depois deles dá 0, e não 1.
- **`problemaDaSaida(...)`**: o vermelho da lista, sobre a saída prevista. O mime da saída é JPEG quando
  o `canvas` converte (`MIMES_QUE_O_CANVAS_CONVERTE`, `:914`), as medidas são as da geometria, e os bytes
  só contam no cru. O `problemaDoArquivo` de hoje continua valendo, sobre o arquivo que de fato sobe.
- **`problemaDoPrimeiroSlide(itens, proporcao)`**: a trava acima, sobre o primeiro válido, com o caso do
  vídeo sem medida e o carrossel só de vídeos.
- **`recorteDoInstagramNoVideo` saiu no plano** (desvio declarado): a miniatura é desenhada por CSS, e
  não pelo `canvas` (abaixo), e o vídeo aparece com `object-cover` na caixa da proporção, que já é o corte
  do Instagram. Ninguém chamaria a função.
- **`caixaDaMiniatura(forma, itens, proporcao)`**: a proporção da caixa da miniatura; no carrossel só de
  vídeos, a do primeiro vídeo válido.
- **A lista**: acrescentar até 10, remover, a contagem dos válidos e a frase "O post vai sair com N
  slides.".
- **As frases do clique** (`textoDaRecusaDaTela`, `textoDoEnvioQueNaoFoi`, `textoDaQuantidadeNaTela`), em
  `lib`, com caso, e não no JSX.
- **`ehVideoNoPost(forma, caminho)`**: o reels, ou `pareceVideo` (`lib/publicacao.ts:548`) nas outras
  formas, como o dreno faz.

### O enviador (`app/publicar/enviador.tsx`) e o botão

- **O estado** passa a ser a lista de arquivos escolhidos, cada um com o `File`, as medidas, o modo, o
  problema, se houver, e o caminho, só depois do 2xx.
- **As medidas saem do mesmo bitmap que o `canvas` desenha** (achado 110): `createImageBitmap(arquivo,
  { imageOrientation: "from-image" })`. Hoje a tela mede com `new Image().naturalWidth`
  (`enviador.tsx:508-516`) e desenha com outro objeto, esticando o desenho nas medidas do primeiro (`:553`,
  `:570`). Correção da revisão do plano: o gerador NÃO passa a opção
  (`app/bonus/[id]/carrossel/[cid]/imagem-no-navegador.ts` chama `createImageBitmap(arquivo)`), e nada em
  produção prova que todo navegador a aceita. Se ela der erro, a chamada se repete sem ela, para um
  navegador que a recuse não deixar toda imagem "ilegível". **Menos para o JPEG que precisa girar**
  (achado 120): o navegador que recusa "from-image" é o que não conhece o valor, e sem ele a rotação do EXIF
  não é garantida; a foto em pé gravada deitada seria medida, cortada e publicada deitada, com a miniatura
  (que o CSS gira) mostrando certo. O JPEG com orientação diferente de 1 (o 0 incluído) não repete, e fica
  "ilegível".
- **A fiação do navegador mora em `app/publicar/navegador.ts`** (desvio declarado: a spec não previa o
  arquivo), entregue ao compositor por propriedade, porque o jsdom não tem `canvas`, `createImageBitmap` nem
  `URL.createObjectURL` e o teste de tela entrega uma falsa. A medida do vídeo tem tempo-limite de 10 s, e
  a leitura da orientação que falha vale 0.
- **A imagem que o navegador não abriu fica vermelha** (`imagem_ilegivel`, desvio declarado): sem medida,
  não há como enquadrá-la, e a frase pede exportar em JPEG ou PNG.
- **O `canvas` pinta o branco antes do `drawImage`**, como hoje (`enviador.tsx:568`). É a proteção do
  PNG transparente, e agora é também a cor da borda. Depois do `toBlob`, a tela confere que o tipo
  saiu JPEG, como o gerador confere (`imagem-no-navegador.ts:103`, `:132`, `:214`). Hoje o tipo é forçado
  (`enviador.tsx:579`).
- **As miniaturas são desenhadas por CSS, e não pelo `canvas`** (desvio declarado no plano). A caixa tem a
  proporção do post e o fundo branco, e a imagem vai com `object-cover` (o corte ao centro) ou
  `object-contain` (inteira, com bordas): é o mesmo enquadramento que `geometriaDoEnquadramento` manda o
  `canvas` desenhar na subida. Sem `canvas` na tela, não há bitmap a segurar; os endereços locais são
  liberados (`URL.revokeObjectURL`) ao remover e ao sair da tela.
- **O botão e a trava**, como em "O envio no clique". A action continua a mesma: a tela lê o `FormData` do
  formulário no clique e põe os caminhos de uma variável, não de um campo controlado pelo estado. Um estado
  atualizado depois de uma espera ainda não chegou ao campo (achado 108).
- **O que a rota de assinar recebe não muda**: o tipo, o tamanho e as medidas DECLARADAS do arquivo que
  sobe, e não do original. A rota confere esses números (`app/api/midia/assinar/route.ts:47-51`,
  `decisaoDeAssinatura`, `lib/publicacao.ts:478`). A action não confere a mídia.

### A action `publicar` (`app/publicar/actions.ts`)

Não muda. As recusas, a fila, o dreno, os avisos e o `redirect` continuam como estão. O compositor
chama a mesma action, com um `FormData` montado por ele.

### As frases do fluxo antigo

- A dica do carrossel deixa de dizer "dá para mudá-la depois de enviar" (`enviador.tsx:229`), porque a
  ordem agora se muda antes.
- A frase do `sem_arquivo` ("Escolha um arquivo e espere o envio terminar antes de publicar.",
  `lib/publicacao.ts:1476-1480`, presa por `testes-integracao/publicar-fala.integracao.ts:499-505` e
  `:595-608`) passa a "Escolha um arquivo antes de publicar.", com o comentário dela e o teste
  atualizados. A action continua recusando sem arquivo, como defesa.

### O que não muda

- A fila, o dreno e o envio ao Instagram.
- A rota de assinar e as regras da Meta (`problemaDoArquivo`).
- O calendário (fora a capa), o cancelar e o remarcar (fora o campo do fuso).
- O gerador de bônus e os carrosséis dele.
- O banco: nenhuma migração.

---

## O efeito na produção

- **A foto de celular em pé passa a entrar**, cortada ao centro ou inteira com bordas brancas, no
  carrossel e na imagem única.
- **Todos os slides de imagem saem na proporção escolhida.**
- **A lista mostra o que vai sair**, e remover um slide não exige recomeçar.
- **O clique duplo não vira post em dobro**, nas quatro formas.
- **As recusas da legenda, da hora e da quantidade aparecem antes de subir qualquer arquivo.**
- **O clique em Publicar demora o tempo do envio**: segundos para uma imagem, minutos para um carrossel
  de 10 ou um reels grande. A janelinha mostra o andamento.
- **A página do post cancelado diz a verdade sobre o arquivo.**
- **A legenda e o fuso chegam à action**, e o post agendado ou remarcado fora de Brasília sai na hora
  marcada.

**Os resíduos, escritos (os órfãos que continuam no bucket):**
- recarregar ou fechar a aba no meio da subida, mesmo depois do aviso;
- remover um slide, trocar a forma, ou mudar o arquivo, o modo ou a proporção de um slide depois de uma
  tentativa que subiu algo e falhou;
- a recusa da action depois da subida: a tela é recriada pelo `redirect` (medido), e a lista some.

**A frase do cancelado pode mentir num caso**: ela diz "O arquivo foi apagado do armazenamento." pelo motivo
do cancelamento, e o cancelar apaga com `limparOBucket`. Se essa limpeza falhar, o arquivo fica e a frase
diz que saiu. O resíduo fica escrito, e não medido.

**A action pode sair depois de a tela sair** (lido no Next 16.3.8, e não medido; anotação da segunda
revisão). Se um clique no menu já deixou uma navegação pendente nos instantes finais da última subida, o
POST da action espera essa navegação assentar (`app-router-instance.js`), e o compositor desmonta com a leva
já encerrada: o post entra na fila mesmo assim. A janela é curta, mas "sair pelo menu interrompe" vale para
a subida, e não para a action já pedida.

**O deslocamento do fuso é o de agora**, e não o da data marcada: num fuso com horário de verão, um
agendamento que atravessa a troca sairia uma hora fora. No Brasil isso não acontece desde 2019, e a conta
pela data marcada não tem como ser testada na máquina do ensaio, que está em Brasília.

Trocar a forma antes de clicar deixa de orfanar, porque nada subiu. A varredura de órfãos continua sendo
recurso novo, como o Vinícius registrou (`lib/bucket.ts` não sabe listar).

**Os que ficam sem medida:**
- se a Meta corta pela proporção do primeiro e se o vídeo em primeiro manda (só citado, desde 03/09). A
  trava fica do lado seguro;
- se a Meta respeita a orientação EXIF. Por isso o cru exige a orientação 1;
- HEIC continua recusado, como hoje.

---

## Testes

| suíte | o quê |
|---|---|
| pura | `geometriaDoEnquadramento`: a varredura de 320 a 1440 de largura × 3 proporções × 2 modos, passando cada saída por `problemaDoArquivo`, com `Number.isInteger` e o recorte dentro da imagem; os casos de origem mais larga, mais alta e igual; o teto de 1440; a recusa abaixo de 320 e a frase que sugere as bordas |
| pura | `vaiSemRedesenho`: o cru só sem mudar pixel (igual à saída do `canvas`); nunca com PNG ou WebP, diferente da saída, acima de 1440, acima de 8 MiB, sem medida ou com EXIF diferente de 1 (o 0 incluído) |
| pura | `orientacaoDoJpeg`: os bytes de orientação 1, 3, 6 e 8 nas duas ordens; o APP1 depois do APP0 e de um APP1 de XMP; a etiqueta depois de outras; os bytes de preenchimento; o 1 só sem EXIF ou sem a etiqueta; o 0 para o cortado (o APP1 que passa dos 64 KiB), o vazio, o malformado e o valor fora de 1 a 8 |
| pura | `problemaDaSaida`: o PNG e a foto 0,75 que não ficam vermelhos; a saída estreita que fica |
| pura | `problemaDoPrimeiroSlide`: [imagem recusada, vídeo 9:16, imagem] com 4:5 trava; o vídeo sem medida em primeiro trava; o carrossel só de vídeos não trava; a frase só oferece a proporção quando o vídeo está a 1% de uma delas |
| pura | a lista (acrescentar até 10, remover, a contagem, a frase), `caixaDaMiniatura`, as frases do clique, `ehVideoNoPost` e `pareceVideo` direto (as extensões, a maiúscula, `?` e `#`, e `.bin`); a borda de 1% do vídeo em primeiro (1080×1340 passa, 1080×1330 trava) |
| pura | `fraseSobreAMidia`, pelo motivo: o cancelado pelo painel diz que foi apagado; a "conta não conectada" e o que falhou dizem que ficou |
| tela | o seletor da proporção com 4:5 marcado; escolher não envia; a lista com miniatura, os dois modos, ↑ ↓ e "Remover"; o vermelho; a contagem; as travas; **dois cliques (e o Enter) dão uma leva de assinaturas e uma chamada da action**; a recusa da hora ou da legenda antes de qualquer assinatura; o Enter não chama a action pelo `submit` (0 chamada direta); a ordem da subida; a action só com todos os caminhos; o caminho guardado só depois do 2xx; a trava solta depois da action. Precisa de um `XMLHttpRequest` falso, que ainda não existe na suíte. Depois da revisão do plano: **a action recebe as oito chaves que lê** (forma, caminhos, legenda, quando, data_hora, fuso, compartilhar_no_feed e nome_do_audio), com a legenda digitada e as opções do reels na tela; os dois cliques num só quadro; a hora conferida de novo depois da subida; o clique antes da leitura dos arquivos; o `beforeunload`; sair da tela com a assinatura pendente; o modo e a conta que descartam o caminho guardado; e o navegador de verdade (a opção da orientação recusada, a leitura que falha, o tempo-limite do vídeo e o sinal no pedido da assinatura). Depois da segunda revisão: o "Quando" e as opções do reels travados durante a subida (119); o JPEG com EXIF 6 que não repete sem a opção (120); o JPEG que iria cru com a orientação 6 e vai pelo `canvas`; e o clique e o envio nativo no mesmo quadro. Os casos falam em "envio nativo", e não em Enter, que não envia este formulário |
| tela | o campo do fuso do remarcar: com o fuso ao montar, depois de um novo desenho e no segundo formulário da aba (`testes-dom/publicar-campo-do-fuso.dom.tsx`) |
| guarda | a chamada da action no compositor sem `catch` em volta, só ela dentro da transição, e o formulário lido antes da primeira espera: um teste que lê o arquivo, no jeito das guardas do Vinícius, porque o jsdom não reproduz o `NEXT_REDIRECT` |
| páginas | a página do post desenha `<video>` para o caminho de vídeo nas quatro formas; o calendário não usa o vídeo como capa, e o post só de vídeo mostra o ▶. A integração de `nao-saiu` não liga o bucket, e a capa ali é nula. **Desvio declarado:** o caso é uma guarda de texto, que casa a expressão inteira com o ramo, e não uma suíte que monta a URL, porque as duas páginas são de servidor e leem o banco |
| guarda | o remarcar usa o campo do fuso de cliente, e nem o campo escondido nem o `<Script>` (`tests/publicar-remarcar-fuso.test.ts`) |
| integração | a frase nova do `sem_arquivo` (`testes-integracao/publicar-fala.integracao.ts`) |

Cada proteção principal ganha uma prova de mutação: retirada de propósito, o teste certo cai. A do
arredondamento troca o "para baixo" pelo "ao mais próximo" e tem de derrubar a varredura. A da trava tira
a referência ligada antes da espera, e o teste dos dois cliques tem de cair. A do `catch` põe um `catch`
que engole o erro em volta da chamada da action, e a guarda tem de cair. A da legenda lê o formulário
depois da subida, e o caso das oito chaves tem de cair.

---

## A prova real

No preview, com o Eduardo na tela. O preview usa o banco e o bucket de produção. **Sem post real.** Cada
gravação tem o OK do Eduardo e a hora mandada antes, e a auditoria lê a produção antes e depois.

1. No `/publicar/novo`, no navegador de uso do Eduardo, um carrossel com quatro arquivos:
   - uma foto de celular em pé, tirada no celular, em "Cortar";
   - um print ou arte deitada, em "Inteira, com bordas";
   - um JPEG já em 4:5 exato, com até 1440 px de largura, que vai sem redesenho;
   - um vídeo curto de iPhone (`.mov`), em quarto, aberto no Chrome do computador e no Safari.

   A lista mostra as miniaturas. Confere-se remover um slide e escolher de novo. No Safari do iPhone,
   anota-se se o primeiro quadro do vídeo aparece (o `<video preload="metadata">` pode ficar em branco ali).
   **Nenhum clique em Publicar com "Publicar agora" marcado**: é o padrão do formulário
   (`app/publicar/novo/page.tsx:150-153`, "sai em instantes, e não dá para desfazer"), e o clique
   publicaria de verdade (achado 114).
2. **Digitar uma legenda curta**, marcar **"Publicar em outra hora"**, com a data de daqui a 7 dias, e só
   então dar **dois cliques rápidos** no Publicar (grava). Sem legenda, a prova não pegaria a legenda que
   some (achado 115).
   - A auditoria confere logo depois que há **um item só na fila**, com a legenda digitada e a hora
     marcada (o fuso lido no clique), as medidas de cada imagem no bucket (4:5 nas três) e que o JPEG
     subiu igual ao original, byte a byte.
   - A página do post mostra o vídeo como vídeo, e o calendário mostra a capa.
3. **Remarcar o post da prova** (grava), aberto pelo calendário como o segundo post da aba, para daqui a 8
   dias. A auditoria confere a hora nova.
4. Cancelar na página do post (`app/publicar/post/[id]/page.tsx`, o formulário do cancelar) (grava). O
   cancelamento tira os arquivos do bucket, e a página passa a dizer que o arquivo foi apagado.

**O que a prova não mostra:** o Eduardo está em Brasília, onde o fuso certo e o padrão da action coincidem.
Os passos 2 e 3 provam que o compor e o remarcar não quebraram; o fuso fica provado pelas sondas e pelos
casos de tela.

---

## Pré-condições do merge

1. `npm run verify` limpo, a integração verde no container, e a prova feita no preview.
2. Nenhuma migração: o build do merge diz "Nada a aplicar: as 19 migrações".
3. O merge é do Eduardo, no GitHub, com a mensagem preparada no estilo do Vinícius, colada nos dois
   campos.

---

## Fora desta etapa

- Arrastar o corte para escolher a parte da foto que fica.
- Bordas pretas ou desfocadas, ou cor por slide.
- Recortar vídeo no navegador.
- HEIC e a correção da orientação EXIF do JPEG que vai sem redesenho.
- A varredura de órfãos do bucket.
- O carrossel do gerador de bônus, que já enquadra pelas regras dele.
