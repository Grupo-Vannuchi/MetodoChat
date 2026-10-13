# O gerador de bônus — Etapa 11: a capa do carrossel

**Nascido em:** 13/10/2026, enquanto a prova da Etapa 10 esperava quem faz os testes. O Eduardo retomou a
análise de 09/10: três prints do Instagram (uma arte estilo tweet em fundo escuro, e capas com a foto no
slide inteiro e o título grande, uma delas feita por IA), e o pedido de um slide 1 mais elaborado. Em
09/10 a decisão tinha sido o Canva, pelo "Slide pronto do Canva" no slide 1, sem código. Desenhado com ele
pela caixa de perguntas e por modelos lado a lado no navegador.
**Estado:** desenho aprovado pelo Eduardo, em três partes (a tela e o desenho; a imagem e o publicar; o
que não muda, os testes e a prova). Aguarda a revisão da auditoria.
**Projeto de quem:** do Vinícius Gualberto. Como as etapas anteriores, entra como visita: pasta própria,
e nenhum arquivo do `/publicar`, da fila nem das automações muda.
**Depende da Etapa 10:** o código começa depois que a Etapa 10 (a lista e o apagar) entrar na `main`,
porque o apagar dela precisa levar a imagem da capa (abaixo, "O que muda no apagar").

---

## O que é

Hoje o slide 1 sai no estilo de todos os slides: fundo branco, o cabeçalho da conta (a foto, o nome e o @),
o gancho em texto e, por padrão, o espaço de uma imagem deitada embaixo (`lib/bonus/arte-desenho.tsx`,
`FUNDO` e `TEXTO` em :46-49). Esta etapa dá ao slide 1 um quarto jeito, **"Capa com imagem"**: uma
imagem ocupa o slide inteiro, e o gancho vem grande por cima, como nas capas de carrossel dos exemplos.
A imagem é uma foto subida ou uma imagem do criador de imagem da Etapa 6, em pé.

---

## As decisões, e de quem

Do Eduardo, pela caixa e pelos modelos no navegador, em 13/10:

| assunto | decisão |
|---|---|
| o que resolver | a capa automática no Chat (e não só o modo escuro, nem continuar só com o Canva) |
| de onde vem a imagem | subida ou gerada por IA, à escolha na hora |
| o desenho | o modelo A: a imagem inteira, a sombra subindo do pé, o gancho embaixo, a conta pequena no topo |
| a letra | a Carlito do manual, em negrito e toda em maiúscula (e não uma fonte condensada, fora do manual) |
| como o carrossel usa a capa | um quarto jeito no slide 1, escolhido por carrossel; quem não escolher fica como hoje |
| a imagem por IA | o mesmo criador (modelo, regras de estilo), em pé, no mesmo limite de 10 por dia e no mesmo custo, medido na prova |
| onde | só no Chat: o Labs não muda, e as medidas divididas com ele também não |

---

## A tela

### O card do slide 1

- Os jeitos do slide 1 passam a ser quatro: o **padrão** (o texto com o espaço da imagem deitada embaixo),
  o **"Só texto"**, o **"Slide pronto do Canva"** e o **"Capa com imagem"**. Um jeito exclui os outros. O
  "Capa com imagem" só existe no slide 1; os outros slides não mudam.
- Com a capa ligada, o card mostra **"Subir foto da capa"** e **"Gerar com IA"** (o mesmo campo da cena, com
  o estilo e os atalhos da Etapa 6), e a miniatura mostra a capa.
- Sem imagem ainda, a miniatura mostra a capa com o fundo escuro liso, para o desenho e o "não cabe"
  aparecerem antes da imagem.
- O gancho é o mesmo campo de hoje (de 15 a 120 caracteres, `carrossel-texto.ts:172`). Se ele não couber na
  capa nem no menor degrau, o card avisa "O gancho não cabe na capa. Encurte o texto.", e o "Publicar" trava,
  como na Etapa 9.

### O desenho da capa (o modelo A)

- A imagem ocupa o slide inteiro, 1080×1350, recortada ao centro (`objectFit: cover`).
- Uma **sombra** escura sobe do pé, para o texto ficar legível em qualquer imagem: preta, de 88% no pé a 0
  em 62% da altura. Uma sombra leve desce do topo (de 45% a 0 em 20% da altura), atrás da conta.
- O **gancho** fica embaixo, alinhado à esquerda, dentro da margem de 110 do manual
  (`arte-geometria.ts`, `MARGEM`): Carlito negrito, branco, **todo em maiúscula**
  (`toLocaleUpperCase("pt-BR")`, feito antes de medir, para a medida e o desenho verem o mesmo texto),
  entrelinha 1,02.
- O **tamanho** desce em degraus próprios da capa até caber: 112, 96, 80, 64 e 56. O bloco do gancho tem até
  640 px de altura, de cima da margem do pé para cima.
- No topo, dentro da margem, a **conta** pequena: a foto (ou as iniciais) com 72 px de lado, o nome e o @ em
  branco, a mesma conta que o carrossel guarda hoje (`arte-conta.ts`).

---

## A imagem da capa

### Subida

- O navegador recorta a foto em **4:5**, pelo centro, como já recorta a foto deitada do espaço
  (`recorteDaFoto`, `publicar-regras.ts:116`), e converte para JPEG.
- A regra da foto da capa: 4:5 com 1% de tolerância; de 1080×1350 a 2160×2700 (menor sairia borrada no post,
  e o navegador nunca amplia); até 2 MB, o mesmo teto da foto do espaço (`FOTO_DO_ESPACO_MAX_BYTES`,
  `publicar-regras.ts:91`, achado 79).

### Gerada por IA

- É o criador da Etapa 6, com o mesmo modelo fixo, a mesma qualidade, as mesmas regras de estilo e o mesmo
  limite de **10 imagens por dia** (a capa conta junto com as outras), só que em pé: **1024×1536**, em vez de
  1536×1024 (`imagem-openai.ts:33-36`).
- A conferência da imagem gerada aceita, para a capa, o JPEG de 1024×1536 com até 2 MB
  (`problemaDaImagemGerada`, `imagem-regras.ts:86-90`, hoje medida com a regra da foto do espaço). O
  desenho recorta em cima e embaixo para fechar o 4:5, e a imagem sai ampliada uns 5% (1024 para 1080 de
  largura).
- O pedido da capa ganha uma frase nas regras do Chat (`prompt-ilustracao.ts`): o terço de baixo da imagem
  com fundo simples, sem rosto nem objeto importante, porque o gancho vai por cima. A regra de não escrever
  texto na imagem continua.
- O custo da imagem em pé é **medido na prova**, na primeira geração, antes de o uso normal começar. A
  expectativa é a mesma de hoje (US$ 0,0432, high), porque a OpenAI cobra os dois tamanhos iguais; se a
  medida der outro número, ele fica escrito no PR.

### Onde ela fica

- Um destino novo no bucket, **`capa`**, em `<pasta da conta do carrossel>/bonus-capa/<uuid>.jpg`, ao lado
  dos três de hoje (`slide`, `foto` e `fila`, `publicar-regras.ts:9-29`). O jeito da imagem continua sendo
  o prefixo do caminho, que o servidor assinou (`jeitoDoCaminho`, :49-53): `bonus-capa/` é a capa.
- A imagem da capa ocupa o lugar da imagem do slide 1 (`arte.imagens["1"]`). Cada jeito pede a imagem no
  formato dele: a foto deitada do padrão não serve à capa, e a da capa não serve ao padrão. Ao trocar de
  jeito, o card pede a imagem nova, e a antiga sai do bucket quando a nova entra, como na troca de foto de
  hoje.

### O jeito guardado

- O jeito do slide 1 fica na coluna `arte`, numa chave nova, **`capa: true`**, gravada pelo mesmo caminho do
  "Só texto" (`salvarArteDoCarrossel`, `carrossel-actions.ts:231`, com a linha travada e a trava do
  publicar). `escolhasDaArte` (`arte-escolhas.ts:20-28`) ganha o campo `capa`. A capa e o "Só texto" no
  slide 1 não convivem: ligar um desliga o outro.
- O carrossel sem a chave (os 5 de hoje, e todo carrossel que não ligar a capa) continua como hoje.

---

## O publicar

- A capa é desenhada pelo Chat, pela rota da arte de hoje, e vai à fila como os slides com foto: o navegador
  baixa o slide montado, em 1080×1350, e sobe a cópia em `bonus-fila/` (`artesParaPublicar`,
  `publicar-estado.ts:109`, ganha a capa).
- O "Publicar" trava, com a frase dele, enquanto a capa não tem imagem (a falta "imagens" de hoje, em
  `faltasParaPublicar`, `publicar-estado.ts:80`) ou o gancho não cabe na capa (a falta "não cabe" da Etapa 9).
- O servidor confere de novo, antes da fila: o jeito, a imagem com o prefixo `bonus-capa/` e o cabimento do
  gancho.

## O que muda no apagar (Etapa 10)

- O apagar leva a imagem da capa junto com o carrossel: `caminhosDoCarrossel` (`apagar-regras.ts`, da Etapa
  10) passa a aceitar o destino `capa`, na pasta da conta, na forma exata. Por isso esta etapa começa depois
  de a 10 entrar na `main`.

---

## Por dentro

- **Um desenho próprio da capa**, em arquivos novos (`lib/bonus/capa-geometria.ts` com os números acima, e o
  desenho dela ao lado de `arte-desenho.tsx`). **`arte-geometria.ts` não muda, e os vetores divididos com o
  Labs (`tests/vetores-da-arte.json`) também não**: a fase final confere 0 diferença nos dois.
- **A medida do gancho da capa** usa a conta exata de hoje (`arte-medida.ts`, com as larguras reais da
  Carlito), com os degraus, o bloco e a entrelinha da capa. A mesma função decide a tela, o desenho e o
  servidor (o achado 70 nasceu de a conta e o desenho divergirem). O ensaio mede que o gancho mais longo do
  schema (120 caracteres, em maiúscula) cabe no menor degrau; se não couber, o degrau ou o bloco mudam no
  plano, com a medição escrita.
- **A versão da miniatura** (`versoesDosSlides`) passa a resumir também o jeito da capa e a imagem dela, para
  a miniatura trocar quando um dos dois mudar.
- **A rota da imagem** (a consulta da Etapa 6) e o pedido de imagem aceitam o slide 1 em capa, com o tamanho
  em pé e o destino `capa`.

## O que não muda

- Os carrosséis de hoje e os slides 2 em diante.
- O "Só texto" e o "Slide pronto do Canva" do slide 1.
- O Labs, a `arte-geometria.ts` e os vetores divididos.
- O publicar, a fila, o calendário do `/publicar` e as automações.
- O modo escuro da arte, que segue como ideia.
- Sem migração: a capa vive na coluna `arte` que já existe.

---

## Testes

| suíte | o quê |
|---|---|
| pura | o jeito do slide 1 (a capa e o "Só texto" não convivem; sem a chave, o jeito de hoje); o destino `capa` (o caminho na forma exata e na pasta da conta; o jeito pelo prefixo); a regra da foto da capa (4:5, os tamanhos, os 2 MB) e o recorte em 4:5; a regra da imagem gerada para a capa (1024×1536); a medida do gancho da capa (os degraus, o bloco, a maiúscula antes de medir, e o gancho de 120 caracteres no menor degrau); a falta e a recusa da capa sem imagem e do gancho que não cabe; a versão da miniatura com a capa |
| integração | ligar e desligar a capa (com a trava do publicar); guardar a imagem da capa e trocar a antiga; a geração em pé contando no mesmo limite de 10; publicar com a capa (a cópia em `bonus-fila/`); o servidor recusando a capa sem imagem e o gancho que não cabe; o apagar levando a imagem da capa |
| tela | o card do slide 1 com o quarto jeito, os dois botões, a miniatura e o aviso do "não cabe"; o "Publicar" travado com a frase |
| guarda | 0 diferença em `arte-geometria.ts` e em `tests/vetores-da-arte.json`; nada do `/publicar`, da fila, das automações, das migrações nem do `package` |

Cada proteção principal ganha uma prova de mutação no apêndice do plano.

---

## A prova real

No preview, com o Eduardo na tela e a hora mandada à auditoria antes de cada gravação. O preview usa o banco
e o bucket de produção. **Sem post real.** Uma imagem por IA, de cerca de US$ 0,04, só com o OK do Eduardo.

1. "Novo carrossel" → texto livre → "Escrever à mão", com 3 slides (grava). Ligar a "Capa com imagem" no
   slide 1 (grava): a miniatura mostra a capa com o fundo escuro, e o "Publicar" trava pedindo a imagem.
2. Um gancho comprido demais: o aviso "O gancho não cabe na capa." e o "Publicar" travado; encurtar e salvar
   (grava).
3. "Subir foto da capa" (grava): a miniatura com a foto, a sombra, o gancho em maiúscula e a conta.
4. "Gerar com IA" na capa (grava, com o custo): a imagem em pé entra no lugar da foto, o custo é medido, e a
   foto antiga sai do bucket.
5. Agendar para daqui a 7 dias e cancelar no calendário (gravam): a cópia da capa vai à fila e sai no
   cancelamento.
6. "Apagar carrossel" (grava): a auditoria confere que a imagem da capa saiu do bucket.

---

## Pré-condições

1. A Etapa 10 na `main`.
2. `npm run verify` limpo, a integração verde no container, e o preview com a prova feita.
3. O build do merge diz "Nada a aplicar: as 19 migrações".

---

## Fora desta etapa

- O modo escuro da arte.
- A capa no Labs.
- Outros modelos de capa (o título no topo, a faixa sólida), ou uma fonte condensada.
- A capa em outro slide que não o 1.
