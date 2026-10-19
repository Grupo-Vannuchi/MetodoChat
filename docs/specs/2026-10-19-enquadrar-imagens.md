# O /publicar enquadra as imagens do carrossel e do post de imagem

**Nascido em:** 19/10/2026, sobre a `main` em `260b9dd` (a Etapa 10 do gerador, no ar desde as 14:54Z).
É o ponto 3 dos feedbacks que o Vinícius deixou ao sair ("correção das imagens do carrossel"), e o
Eduardo confirmou pela caixa que é o carrossel do `/publicar`, o compositor antigo, e não o do gerador.
**Estado:** desenho aprovado pelo Eduardo pela caixa em 19/10, em três partes. A auditoria do perigo e a
revisão da spec (`metodochat-0d`, sobre `268daf3`) trouxeram os achados 107 e 108 (BLOQUEIA), 109 a 112
(CORRIGIR) e 113 (ANOTAR, já em produção), todos absorvidos nesta versão. Duas decisões novas do Eduardo
saíram dessa revisão: o reels e o story também passam a enviar no clique, e o 113 é corrigido aqui.
Aguarda a revisão do diff pela auditoria e a leitura do Eduardo.
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
    bordas;
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
  Publicar trava com a frase da quantidade.
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
  - trava no primeiro clique, e a trava é ligada antes de qualquer espera. Um segundo clique, ou um
    Enter num campo de texto (o `nome_do_audio`, `app/publicar/novo/page.tsx:238-243`), não começa outra
    leva;
  - o envio nativo do formulário (o Enter) é segurado e cai no mesmo caminho, sob a mesma trava.
- **Antes de subir qualquer arquivo**, a tela roda as mesmas funções puras que a action roda
  (`recusaDaQuantidade`, `problemaDaLegenda`, e `camposDaDataHora`, `instanteDoAgendamento` e
  `momentoDaPublicacao`, `app/publicar/actions.ts`). A recusa aparece na tela com a frase da action, sem
  subir nada. Hoje todas essas recusas chegam depois da subida, porque o formulário não tem `required`
  (achado 109).
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
- **Durante a subida**, a forma, a proporção, os modos e a lista ficam travados. Fechar ou recarregar a
  aba pede confirmação (`beforeunload`). Sair pelo menu interrompe a subida, e a janelinha diz "A
  publicação não foi pedida.". Hoje o laço e a subida sobrevivem a sair da tela (`enviador.tsx:148-191`,
  `:597-622`).
- **Se uma subida falha**, nada vai para a fila, e a lista diz qual falhou. Os que já subiram ficam
  guardados, e um novo clique sobe só os que faltam. Mudar o modo, a proporção ou o arquivo de um slide
  descarta o caminho guardado dele.
- **Depois do sucesso**, a action leva de volta à tela com o aviso, como hoje, e a tela nasce vazia.
  Depois de uma recusa da action, a lista e os caminhos já subidos ficam. Para a tela saber a diferença,
  o clique leva um identificador do pedido, e a action o devolve no endereço do sucesso. A tela esvazia a
  lista quando o endereço traz o pedido dela. Não se depende de o React recriar ou manter o componente
  depois do `redirect` (achado 109).
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

`fraseSobreAMidia` passa a dizer o que aconteceu com o arquivo em cada caminho. O cancelado pelo painel
diz que o arquivo foi apagado, e o que falhou diz que ele continua lá ("Objeto de item falhado não é
órfão", `lib/queue-drain.ts:301-303`). O plano mede, caminho por caminho, os outros encerramentos do
dreno antes de escrever a frase deles.

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
  recorte igual à imagem inteira e a saída com as medidas do original; até 1440 px de largura; até 8 MiB;
  e a orientação EXIF ausente ou igual a 1. Sem medida, não vai cru. É a regra do Vinícius de "JPEG que
  já serve não passa pelo canvas" (`planoDaConversao`, `:951-982`), estendida à proporção. Não se usa a
  tolerância de 1% do gerador (0,792–0,808, `lib/bonus/publicar-regras.ts:61-62`): ali, a assinatura
  recusa abaixo de 0,8 depois. Aqui, um cru a 0,807 em primeiro cortaria os outros em cerca de 12 px.
- **`orientacaoDoJpeg(bytes)`**: lê a orientação EXIF no segmento APP1 do JPEG, pura e sobre os bytes.
  Devolve 1 quando não há EXIF.
- **`problemaDaSaida(...)`**: o vermelho da lista, sobre a saída prevista. O mime da saída é JPEG quando
  o `canvas` converte (`MIMES_QUE_O_CANVAS_CONVERTE`, `:914`), as medidas são as da geometria, e os bytes
  só contam no cru. O `problemaDoArquivo` de hoje continua valendo, sobre o arquivo que de fato sobe.
- **`problemaDoPrimeiroSlide(itens, proporcao)`**: a trava acima, sobre o primeiro válido, com o caso do
  vídeo sem medida e o carrossel só de vídeos.
- **`recorteDoInstagramNoVideo(proporcaoDoVideo, proporcaoDoPost)`**: o retângulo visível, em frações,
  para a marca da prévia do vídeo.
- **A lista**: acrescentar até 10, remover, a contagem dos válidos e a frase "O post vai sair com N
  slides.".
- **`ehVideoNoPost(forma, caminho)`**: o reels, ou `pareceVideo` (`lib/publicacao.ts:548`) nas outras
  formas, como o dreno faz.

### O enviador (`app/publicar/enviador.tsx`) e o botão

- **O estado** passa a ser a lista de arquivos escolhidos, cada um com o `File`, as medidas, o modo, o
  problema, se houver, e o caminho, só depois do 2xx.
- **As medidas saem do mesmo bitmap que o `canvas` desenha** (achado 110): `createImageBitmap(arquivo,
  { imageOrientation: "from-image" })`, como o gerador já faz
  (`app/bonus/[id]/carrossel/[cid]/imagem-no-navegador.ts:65-66` e `:91`). Hoje a tela mede com
  `new Image().naturalWidth` (`enviador.tsx:508-516`) e desenha com outro objeto, esticando o desenho nas
  medidas do primeiro (`:553`, `:570`).
- **O `canvas` pinta o branco antes do `drawImage`**, como hoje (`enviador.tsx:568`). É a proteção do
  PNG transparente, e agora é também a cor da borda. Depois do `toBlob`, a tela confere que o tipo
  saiu JPEG, como o gerador confere (`imagem-no-navegador.ts:103`, `:132`, `:214`). Hoje o tipo é forçado
  (`enviador.tsx:579`).
- **As miniaturas** são refeitas uma de cada vez, com um só bitmap vivo por vez, e liberadas
  (`URL.revokeObjectURL`) ao refazer, ao remover e ao sair da tela.
- **O botão e a trava**, como em "O envio no clique". A action continua a mesma: a tela monta o
  `FormData` do formulário e põe os caminhos de uma referência, não de um campo controlado pelo estado.
  O React lê o formulário no instante do envio, e um estado atualizado depois de uma espera ainda não
  chegou ao campo (achado 108).
- **O que a rota de assinar recebe não muda**: o tipo, o tamanho e as medidas DECLARADAS do arquivo que
  sobe, e não do original. A rota confere esses números (`app/api/midia/assinar/route.ts:47-51`,
  `decisaoDeAssinatura`, `lib/publicacao.ts:478`). A action não confere a mídia.

### A action `publicar` (`app/publicar/actions.ts`)

Só uma mudança: ela lê o identificador do pedido, se vier e tiver a forma de um UUID, e o devolve no
endereço do sucesso. Todo o resto continua igual: as recusas, a fila, o dreno e os avisos.

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
- O calendário (fora a capa), o cancelar e o remarcar.
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

**Os resíduos, escritos (os órfãos que continuam no bucket):**
- recarregar ou fechar a aba no meio da subida, mesmo depois do aviso;
- remover um slide, trocar a forma, ou mudar o arquivo, o modo ou a proporção de um slide depois de uma
  tentativa que subiu algo e falhou;
- a recusa da action depois da subida, se a pessoa abandonar a tela em vez de tentar de novo.

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
| pura | `vaiSemRedesenho`: o cru só sem mudar pixel; nunca com PNG ou WebP, fora da proporção exata, acima de 1440, acima de 8 MiB, sem medida ou com EXIF diferente de 1 |
| pura | `orientacaoDoJpeg`: os bytes de orientação 1, 3, 6 e 8, e o JPEG sem EXIF |
| pura | `problemaDaSaida`: o PNG e a foto 0,75 que não ficam vermelhos; a saída estreita que fica |
| pura | `problemaDoPrimeiroSlide`: [imagem recusada, vídeo 9:16, imagem] com 4:5 trava; o vídeo sem medida em primeiro trava; o carrossel só de vídeos não trava; a frase só oferece a proporção quando o vídeo está a 1% de uma delas |
| pura | `recorteDoInstagramNoVideo`, a lista (acrescentar até 10, remover, a contagem, a frase), `ehVideoNoPost` e `pareceVideo` direto (as extensões, a maiúscula, `?` e `#`, e `.bin`) |
| pura | `fraseSobreAMidia`: o cancelado diz que foi apagado, e o que falhou diz que ficou |
| tela | o seletor da proporção com 4:5 marcado; escolher não envia; a lista com miniatura, os dois modos, ↑ ↓ e "Remover"; o vermelho; a contagem; as travas; **dois cliques (e o Enter) dão uma leva de assinaturas e uma chamada da action**; a recusa da hora ou da legenda antes de qualquer assinatura; a ordem da subida; a action só com todos os caminhos; o caminho guardado só depois do 2xx; a lista que fica depois de uma recusa e some depois do sucesso. Precisa de um `XMLHttpRequest` falso, que ainda não existe na suíte |
| páginas | a página do post desenha `<video>` para o caminho de vídeo nas quatro formas; o calendário não usa o vídeo como capa. A integração de `nao-saiu` não liga o bucket, e a capa ali é nula: o caso vai numa suíte que monta a URL |
| integração | a action devolve o pedido no endereço do sucesso, e não nas recusas; a frase nova do `sem_arquivo` |

Cada proteção principal ganha uma prova de mutação: retirada de propósito, o teste certo cai. A do
arredondamento troca o "para baixo" pelo "ao mais próximo" e tem de derrubar a varredura. A da trava tira
a referência ligada antes da espera, e o teste dos dois cliques tem de cair.

---

## A prova real

No preview, com o Eduardo na tela. O preview usa o banco e o bucket de produção. **Sem post real.** Cada
gravação tem o OK do Eduardo e a hora mandada antes, e a auditoria lê a produção antes e depois.

1. No `/publicar/novo`, no navegador de uso do Eduardo, um carrossel com quatro arquivos:
   - uma foto de celular em pé, tirada no celular, em "Cortar";
   - um print ou arte deitada, em "Inteira, com bordas";
   - um JPEG já em 4:5 exato, com até 1440 px de largura, que vai sem redesenho;
   - um vídeo curto de iPhone (`.mov`), em quarto, aberto no Chrome do computador e no Safari.

   A lista mostra as miniaturas. Confere-se remover um slide e escolher de novo, e dois cliques rápidos
   no Publicar.
2. Agendar para daqui a 7 dias (grava).
   - A auditoria confere no bucket as medidas de cada imagem (4:5 nas três), que o JPEG subiu igual ao
     original, byte a byte, e que há um item só na fila.
   - A página do post mostra o vídeo como vídeo, e o calendário mostra a capa.
3. Cancelar na página do post (`app/publicar/post/[id]/page.tsx:279-286`) (grava). O cancelamento tira
   os arquivos do bucket, e a página passa a dizer que o arquivo foi apagado.

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
