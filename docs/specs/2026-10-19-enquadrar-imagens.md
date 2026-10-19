# O /publicar enquadra as imagens do carrossel e do post de imagem

**Nascido em:** 19/10/2026, sobre a `main` em `260b9dd` (a Etapa 10 do gerador, no ar desde as 14:54Z).
É o ponto 3 dos feedbacks que o Vinícius deixou ao sair ("correção das imagens do carrossel"), e o
Eduardo confirmou pela caixa que é o carrossel do `/publicar`, o compositor antigo, e não o do gerador.
**Estado:** desenho aprovado pelo Eduardo pela caixa em 19/10, em três partes (a tela, as prévias com
vídeo, e por dentro com a prova). Aguarda a auditoria do perigo e a revisão da spec pela auditoria
(`metodochat-0d`), e a leitura do Eduardo.
**Projeto de quem:** do Vinícius Gualberto, que saiu da empresa em 15/10. Por decisão do Eduardo, o
código dele pode mudar no jeito dele: o porquê e a medição no comentário, a regra como função pura com
teste, uma mutação por proteção e o commit numa frase. Mexer no `/publicar` pede antes a auditoria do
perigo.

---

## O que é

O compositor do `/publicar` não corta nem enquadra imagem nenhuma: ele só aceita ou recusa cada arquivo
pela faixa da Meta, de 0,8 a 1,91 (`lib/publicacao.ts:41-43`, `:185-199`). Medido no código em 19/10:

1. **Foto de celular em pé é recusada.** As proporções 3:4 (0,75), 2:3 e 9:16 ficam abaixo de 0,8, e a
   tela não oferece cortar.
2. **O Instagram corta todos os slides pela proporção do primeiro**, e nada no painel compara a
   proporção de cada item com a do primeiro. A regra só aparece num aviso em texto
   (`app/publicar/enviador.tsx:225-232`). Uma arte com texto perto da borda sai cortada no perfil
   público, onde não há `DELETE` que desfaça (medido em 03/09).
3. **A lista de montagem só mostra o nome do arquivo**, sem miniatura e sem remover
   (`enviador.tsx:279-307`), e escolher de novo apaga a lista (`:152`). Um arquivo recusado no meio fica
   fora da lista, e o laço segue de propósito (`:176-189`, "um arquivo recusado no meio de dez não é
   motivo para descartar os outros nove"), mas o único aviso é a linha "falhou" na janelinha de envio.
4. **A prévia quebra com vídeo.** A página do post desenha `<img>` para todos os caminhos, inclusive
   `.mp4` e `.mov` (`app/publicar/post/[id]/page.tsx:197-214`), e o calendário usa o primeiro caminho
   como capa (`app/publicar/page.tsx:448-454` e `:485-491`).

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
| onde vale | no carrossel e no post de imagem única; o reels e o story não mudam |
| quando os arquivos sobem | ao clicar em Publicar ou Agendar, e não ao escolher |
| a tela e o "por dentro" | aprovados |

---

## A tela (`/publicar/novo`, nas formas "imagem" e "carrossel")

- **A proporção**, acima do campo de arquivos: "4:5 (em pé)", "1:1 (quadrado)" e "1,91:1 (deitado)",
  com "4:5 (em pé)" marcado. Trocar a proporção refaz as miniaturas na hora, e nada é enviado.
- **Escolher arquivos não envia nada.** No carrossel, escolher de novo acrescenta ao fim da lista, até
  `CARROSSEL_ITENS_MAX` (10). O que passar de 10 não entra, com a frase de hoje da quantidade
  (`recusaDaQuantidade`, `lib/publicacao.ts:1257`). Na imagem única, escolher de novo troca o arquivo.
- **A lista de montagem**, uma linha por arquivo:
  - **a miniatura já enquadrada**, na proporção escolhida, desenhada no navegador;
  - o nome do arquivo (`rotuloDoEnvio`, como hoje);
  - nas imagens, **"Cortar"** e **"Inteira, com bordas"**, com "Cortar" marcado;
  - **↑ ↓**, como hoje (`moverNaOrdem`), e **"Remover"**.
- **O vídeo do carrossel** aparece com o primeiro quadro e a marca de como o Instagram vai cortá-lo na
  proporção escolhida, com a frase "O Instagram corta este vídeo assim.". Ele não tem "Cortar" nem
  "Inteira, com bordas".
- **O vídeo não pode ser o primeiro slide fora da proporção.** A Meta corta todos os slides pela
  proporção do primeiro. Se o primeiro for um vídeo com outra proporção, ele mandaria no corte de todas
  as imagens já enquadradas. Nesse caso, o botão Publicar trava com a frase "O primeiro slide decide o
  corte de todos: ponha uma imagem em primeiro, ou escolha a proporção do vídeo.".
- **O arquivo que não serve** (o formato, a largura mínima, o vídeo longo ou pesado demais,
  `problemaDoArquivo`, `lib/publicacao.ts:150`) entra na lista **em vermelho, com a frase de hoje**
  (`textoDoProblema`) e sem contar. Acima da lista fica "**O post vai sair com N slides.**". Com menos de
  2 válidos no carrossel, o Publicar trava com a frase da quantidade.
- **Trocar a forma** descarta a lista, como hoje (`trocarForma`, `enviador.tsx:116`). Agora nada
  subiu, então nada fica órfão no bucket. O caminho mais barato do órfão, registrado em aberto pelo
  Vinícius no comentário de `trocarForma`, fecha.
- **Ao clicar em Publicar** (o mesmo botão para agora e para agendar):
  1. o Chat prepara cada arquivo válido, na ordem: enquadra no `canvas`, ou manda como veio (abaixo);
  2. envia um de cada vez, com a janelinha de progresso de hoje;
  3. só então o formulário segue para a action, com os caminhos, como hoje.

  Se um envio falha, nada vai para a fila, e a lista diz qual falhou. Os que já subiram ficam guardados
  na tela, e um novo clique envia só os que faltam.

### As prévias com vídeo (`/publicar/post/[id]` e o calendário)

- Na página do post, o caminho de vídeo aparece como `<video>` mudo, só com o primeiro quadro
  (`preload="metadata"`) e um ícone de vídeo, e não como `<img>` quebrada.
- No calendário, a capa do dia é o primeiro caminho de imagem do post. Se o post só tiver vídeo, aparece
  o ícone de vídeo no lugar da miniatura.

---

## Por dentro

### As regras, puras (`lib/publicacao.ts`, uma seção nova, "O ENQUADRAMENTO")

O lugar é este arquivo, pela regra que o Vinícius deixou escrita (`lib/publicacao.ts`, "AS DECISÕES DA
TELA DE COMPOR"): "um `if` sobre regra de negócio dentro do JSX está no lugar errado".

- **`PROPORCOES_DO_POST`**: as três, com o valor (0,8, 1 e 1,91), o rótulo e "4:5" como padrão.
- **`geometriaDoEnquadramento({ largura, altura, proporcao, modo })`**: devolve a medida do `canvas` e
  os dois retângulos do `drawImage`, o da origem e o do destino.
  - **"Cortar":** o maior retângulo da origem na proporção, centrado, desenhado no `canvas` inteiro.
  - **"Inteira, com bordas":** a imagem inteira, centrada, com o resto do `canvas` em branco.
  - **A largura de saída** é a da origem (ou do recorte), até `CONVERSAO_LARGURA_MAX` (1440,
    `lib/publicacao.ts:908`), como hoje.
  - **O arredondamento nunca sai da faixa da Meta.** Medida inteira em pixel arredonda a proporção, e
    4:5 fica exatamente no limite de 0,8. Por isso a altura do 4:5 arredonda para baixo, e a do 1,91:1
    arredonda para cima. A saída tem de passar em `problemaDoArquivo`, e um teste cobra isso em cada
    proporção.
  - **A saída menor que `IMAGEM_LARGURA_MIN` (320, `:40`)** devolve a recusa de hoje. Não se amplia
    imagem.
- **`vaiSemRedesenho({ mime, largura, altura, proporcao })`**: o JPEG que já está na proporção
  escolhida (com 1% de tolerância, como no gerador, `lib/bonus/publicar-regras.ts:61-70`), dentro da
  faixa da Meta e com até 1440 px de largura vai como veio, sem passar pelo `canvas`. Ele não precisa de
  corte nem de borda, nos dois modos. É a regra do Vinícius de "JPEG que já serve não passa pelo canvas"
  (`planoDaConversao`, `:951-982`), estendida à proporção.
- **`problemaDoPrimeiroSlide(itens, proporcao)`**: a trava do vídeo em primeiro fora da proporção (1% de
  tolerância).
- **`recorteDoInstagramNoVideo(proporcaoDoVideo, proporcaoDoPost)`**: o retângulo visível, em frações,
  para a marca da prévia do vídeo.
- **A lista**: acrescentar até 10, remover, a contagem dos válidos e a frase "O post vai sair com N
  slides.", com a regra fora do JSX.
- **`pareceVideo`** (`lib/publicacao.ts:548`) passa a ser exportada, para as prévias reconhecerem o vídeo
  pela extensão, que já é a regra do Chat.

### O enviador (`app/publicar/enviador.tsx`)

- **O estado** passa a ser a lista de arquivos escolhidos, cada um com o `File`, as medidas, o modo, o
  problema, se houver, e o caminho, depois que subiu. Mudar o modo, a proporção ou o arquivo de um slide
  descarta o caminho guardado dele.
- **As miniaturas** saem do mesmo `canvas` da conversão, em tamanho pequeno, e são liberadas
  (`URL.revokeObjectURL`) ao remover e ao sair da tela.
- **O `canvas` pinta o branco antes do `drawImage`**, como hoje (`enviador.tsx:568`). É a proteção do
  PNG transparente, e agora é também a cor da borda.
- **O envio no clique:** o enviador escuta o `submit` do formulário. Faltando subir algum arquivo, ele
  segura o envio, prepara, sobe e preenche o campo `caminhos`, e só então reenvia o formulário
  (`requestSubmit`).
- **O que a rota de assinar recebe não muda**: o tipo, o tamanho e as medidas do arquivo que sobe, e não
  do original. A rota e a action conferem tudo de novo, como hoje (`decisaoDeAssinatura`,
  `lib/publicacao.ts:478`).

### O que não muda

- A action `publicar` (`app/publicar/actions.ts`), a fila, o dreno e o envio ao Instagram.
- A rota de assinar (`app/api/midia/assinar/route.ts`) e as regras da Meta (`problemaDoArquivo`).
- O reels e o story, o calendário (fora a capa), o cancelar e o remarcar.
- O gerador de bônus e os carrosséis dele.
- O banco: nenhuma migração.

---

## O efeito na produção

- **A foto de celular em pé passa a entrar**, cortada ao centro ou inteira com bordas brancas, no
  carrossel e na imagem única.
- **Todos os slides de imagem saem na proporção escolhida**, e o corte da Meta pelo primeiro deixa de
  surpreender.
- **A lista mostra o que vai sair**, e remover um slide não exige recomeçar.
- **Trocar a forma deixa de deixar órfãos no bucket.**
- **O clique em Publicar demora o tempo do envio**: segundos para uma imagem, e alguns minutos para um
  carrossel de 10. A janelinha mostra o andamento.

**Os resíduos, escritos:**
- **Recarregar a página no meio do envio** deixa no bucket o que já subiu, como hoje, quando a aba fecha
  no meio.
- **Trocar o arquivo, o modo ou a proporção de um slide que já subiu numa tentativa que falhou** deixa a
  cópia antiga no bucket, até existir a varredura de órfãos, que o Vinícius registrou como recurso novo
  (`lib/bucket.ts` não sabe listar).
- **A orientação EXIF.** O JPEG que vai sem redesenho mantém a orientação gravada no arquivo, e o código
  não mede se a Meta a respeita. Uma foto girada pelo EXIF que caia exatamente na proporção escolhida
  iria sem redesenho. O que passa pelo `canvas` sai com a orientação aplicada (`createImageBitmap`).
- **HEIC** continua recusado, como hoje.

---

## Testes

| suíte | o quê |
|---|---|
| pura | `geometriaDoEnquadramento` em cada proporção e nos dois modos: a origem mais larga, a mais alta e a igual; o teto de 1440; a recusa abaixo de 320; e a saída que **sempre** passa em `problemaDoArquivo` depois do arredondamento |
| pura | `vaiSemRedesenho`: o JPEG na proporção vai cru; o PNG, o WebP, o JPEG fora da proporção, o JPEG acima de 1440 e o JPEG dentro de 1% mas fora da faixa da Meta não vão |
| pura | `problemaDoPrimeiroSlide`: o vídeo em primeiro fora da proporção trava; na proporção, não; a imagem em primeiro nunca trava |
| pura | `recorteDoInstagramNoVideo`, a lista (acrescentar até 10, remover, a contagem, a frase) e `pareceVideo` exportada |
| tela | o seletor da proporção com 4:5 marcado; escolher não envia; a lista com miniatura, "Cortar" e "Inteira, com bordas", ↑ ↓ e "Remover"; o arquivo recusado em vermelho; "O post vai sair com N slides."; a trava da quantidade e a do primeiro slide; o envio só no clique, na ordem, e o formulário só depois |
| páginas | a página do post desenha `<video>` para o caminho de vídeo; o calendário não usa o vídeo como capa |

Cada proteção principal ganha uma prova de mutação: retirada de propósito, o teste certo cai.

---

## A prova real

No preview, com o Eduardo na tela. O preview usa o banco e o bucket de produção. **Sem post real.** Cada
gravação tem o OK do Eduardo e a hora mandada antes, e a auditoria lê a produção antes e depois.

1. No `/publicar/novo`, um carrossel com quatro arquivos:
   - uma foto de celular em pé, em "Cortar";
   - um print ou arte deitada, em "Inteira, com bordas";
   - um JPEG já em 4:5, com até 1440 px de largura, que vai sem redesenho;
   - um vídeo curto, em quarto.

   A lista mostra as miniaturas, e se confere remover um slide e escolher de novo.
2. Agendar para daqui a 7 dias (grava).
   - A auditoria confere no bucket as medidas de cada imagem (4:5 nas três) e que o JPEG subiu igual ao
     original, byte a byte.
   - A página do post mostra o vídeo como vídeo, e o calendário mostra a capa.
3. Cancelar no calendário (grava): o cancelamento já tira os arquivos do bucket.

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
- O story e o reels.
- HEIC e a correção da orientação EXIF do JPEG que vai sem redesenho.
- A varredura de órfãos do bucket.
- O carrossel do gerador de bônus, que já enquadra pelas regras dele.
