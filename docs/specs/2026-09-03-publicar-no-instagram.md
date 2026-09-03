# Publicar no Instagram pelo painel

**Nascido em:** 03/09/2026, de pedido direto do dono: publicar posts estáticos,
vídeos, reels, stories e carrossel pelo painel, com publicação imediata e
agendamento.
**Estado:** desenho aprovado, pronto para virar plano.

---

## O que foi medido, e como isso desenhou a solução

**Toda afirmação desta seção foi lida na página da documentação, no navegador, e
não em resumo.** Isso é deliberado: a primeira leitura, por resumo automático,
devolveu três coisas erradas — que a conta precisa de Página do Facebook, que o
limite diário é 100 (ou 50), e que `VIDEO` é um tipo de mídia. Nenhuma das três
se sustentou na fonte.

### O que é possível, e não precisa de revisão da Meta

Publicação funciona pela **API do Instagram com Login do Instagram** —
exatamente o caminho que o painel já usa (`graph.instagram.com`). A permissão
nova é `instagram_business_content_publish`.

**E ela NÃO precisa de App Review**, que era o custo que parecia proibitivo:
Acesso Padrão é aprovado automaticamente para contas que tenham papel no
aplicativo. As quatro contas são do dono. Revisão só passaria a ser necessária
se o painel publicasse em nome de clientes.

**A Página do Facebook NÃO é requisito.** Ela aparece uma única vez na
documentação, dentro da tabela que compara os dois caminhos, na coluna do Login
do Facebook. Era o risco que eu não conseguia eliminar por leitura de resumo.

**As quatro contas atendem ao requisito de tipo**, perguntado à Meta com os
tokens que já temos, em 03/09:

| conta | tipo | posts |
|---|---|---|
| @thiagovannuchi | MEDIA_CREATOR | 2.933 |
| @vannuchi.eng | MEDIA_CREATOR | 518 |
| @n8xmarketing | MEDIA_CREATOR | 49 |
| @saas.metodoia | BUSINESS | 28 |

### A medição que decidiu o formato do upload

**A Vercel aceita no máximo 4,5 MB de corpo de requisição** (erro 413,
`FUNCTION_PAYLOAD_TOO_LARGE`). Um reels pode ter 300 MB.

**Consequência: o arquivo NÃO pode passar pelo nosso servidor.** Ele vai do
navegador direto para o bucket do Supabase, por URL assinada. Isto não é
otimização — é o que torna vídeo possível. Sem o bucket, reels estaria fora.

E dela sai a segunda consequência, que não era óbvia: **a conversão para JPEG
também não pode ser no servidor.** Uma imagem de 8 MB não chega lá. Ela acontece
no navegador, por `canvas`, que de quebra resolve o redimensionamento para a
faixa de 320–1440px e o espaço de cor sRGB. O `sharp` foi descartado — era
dependência transitiva do Next, que pode sumir num upgrade.

### A medição que decidiu o agendamento

**A Meta não tem agendamento.** Não existe parâmetro de data; `media_publish`
publica no instante da chamada. O agendamento é necessariamente nosso, e a Meta
nunca fica sabendo dele.

**E o contêiner vence em 24 horas.** Disso sai a decisão mais importante do
desenho: **o contêiner nasce na hora de publicar, nunca na hora de compor.**
Criá-lo ao agendar faria todo agendamento além de um dia falhar CALADO, com
`status_code: EXPIRED`. Com ele nascendo na publicação, o horizonte é infinito.

Efeito colateral aceito: o arquivo FICA no bucket até a publicação.

### A medição que reduziu o escopo de quatro formas para três, mais uma

A referência do endpoint lista `media_type` como **CAROUSEL, REELS, STORIES** e
nada mais. **Não existe `VIDEO`** — o guia diz que existe e contradiz a própria
referência.

Então "publicar vídeo no feed" é **publicar reels com `share_to_feed=true`**. O
pedido de quatro coisas é, na prática, três formas mais o carrossel.

### Os números de cada formato, lidos na referência

| | formato | tamanho | duração | proporção |
|---|---|---|---|---|
| imagem | JPEG, sRGB | 8 MB | — | 4:5 a 1.91:1, largura 320–1440 |
| reels | MOV/MP4, H.264 ou HEVC, AAC | 300 MB | 3 s a 15 min | 0.01:1 a 10:1 (9:16) |
| story vídeo | idem | 100 MB | 3 s a 60 s | 9:16 |
| story imagem | JPEG, sRGB | 8 MB | — | 9:16 |

Legenda: 2.200 caracteres, 30 hashtags, 20 menções. Taxa de quadros do vídeo:
23 a 60 FPS. Capa do reels: `cover_url` (JPEG, 8 MB) ou `thumb_offset` em ms.

Limites de volume: **400 contêineres por conta / 24h**, e entre 50 e 100
publicações — a Meta se contradiz, e por isso o número vem do endpoint.

---

## O desenho

### 1 · O caminho, de ponta a ponta

```
navegador                  nosso servidor          Supabase      Meta
──────────────────────────────────────────────────────────────────────
escolhe arquivo
valida tipo/tamanho/duração
converte p/ JPEG (canvas)
              ─ pede URL assinada ─→
              ←──── URL ──────────
envia direto ────────────────────────→ bucket
  (barra de progresso)
              ─ registra a mídia ──→ banco

compõe legenda; "agora" ou data/hora
              ──── enfileira ──────→ fila (not_before)

                    [na hora de publicar]
                    cria contêiner ──────────────→ POST /media
                    espera FINISHED ─────────────→ GET status_code
                    publica ─────────────────────→ POST /media_publish
```

### 2 · A publicação é item de fila, e isso resolve mais que o agendamento

A fila já existe, com `not_before`, tentativas, dreno no webhook, tique do
QStash e tela de Envios. Um post é um `kind` novo.

**E ela resolve o vídeo mesmo sem agendamento:** um reels pode levar minutos
processando na Meta (`IN_PROGRESS` → `FINISHED`). Publicação direta obrigaria
quem clicou a esperar olhando a tela; pela fila, sai sozinho.

A espera de `status_code` segue a recomendação da Meta: **uma consulta por
minuto, por no máximo cinco**. Passado isso, o item volta para a fila em vez de
segurar o dreno — a mesma decisão que o lote guardado tomou em 01/09, e pelo
mesmo motivo: o dreno roda dentro do webhook e não pode ser sequestrado.

### 3 · O modal de progresso — a exceção declarada à doutrina desta base

O upload mostra progresso num modal flutuante no canto inferior, que
**sobrevive à navegação**: quem está enviando um reels de 200 MB pode ir para
outra tela e continuar vendo o andamento.

**ISTO É UMA EXCEÇÃO CONSCIENTE, e vai escrita aqui para não ser descoberta
depois.** Esta base foi construída evitando estado no navegador — `<details>`
nativo em `/setup`, decisões fora do JSX, nenhum componente de cliente que possa
ser evitado. Um modal persistente exige estado no `layout`.

**Ela é justificada porque é o único caminho:** o progresso só existe porque o
navegador é quem faz o upload, e o navegador é quem faz o upload porque a Vercel
não aceita 300 MB. Não há versão em servidor deste recurso.

A mitigação é a de sempre: **nenhuma decisão mora no componente.** Validação de
tipo, tamanho, duração e proporção, tradução de erro da Meta e a frase de cada
estado são funções puras com teste. O componente desenha o que elas decidem.

### 4 · Música: RECUSADO, por impossibilidade

Pedido do dono, e a resposta é não. A documentação diz, na seção de Reels:
*"A marcação de música está disponível apenas para áudio original."* O único
parâmetro de áudio é `audio_name` — que **nomeia** a faixa que já está no vídeo,
e não escolhe uma da biblioteca.

A biblioteca de áudio do Instagram é licenciada e existe só no aplicativo.

**E o contorno é armadilha:** embutir a música no arquivo publica áudio
protegido sem a licença que a biblioteca fornece. A Meta detecta — a
documentação de leitura diz que ela **omite o `media_url`** de vídeo com áudio
protegido, *"incluindo áudio adicionado da biblioteca de áudio do Instagram"*, e
que isso vale **mesmo quando a conta é a dona da mídia**.

Áudio próprio funciona, e ganha nome pelo `audio_name`. Trilha da biblioteca
segue manual, pelo celular. **Comunicado ao dono em 03/09**, que levou a
limitação ao chefe por escrito.

### 5 · Aviso de falha: NÃO ENTRA na v1, e o motivo é medido

Um post agendado que falha às 3h aparece na tela de Envios com o motivo escrito,
e em nenhum outro lugar. O painel não tem canal de aviso — nem e-mail, nem
notificação.

**E a saída que parecia mais esperta foi RECUSADA:** mandar DM de aviso pelo
motor que já existe exige **janela de 24h aberta** para a conta de destino.
Medido em 01/09: das janelas entre as contas conectadas, quase todas fecham em
um dia. Um aviso de falha que pode falhar calado é a doença que esta base passou
a semana curando — o webhook que engolia forma nova, o erro da Meta engolido no
portão de follow, as cinco ações que recusavam em silêncio.

Aviso confiável merece projeto próprio e canal que não dependa da mesma
plataforma que falhou.

### 6 · Carrossel, e as duas regras que a tela precisa respeitar

Até 10 itens, cada um com seu contêiner filho (`is_carousel_item=true`), mais um
contêiner pai com `media_type=CAROUSEL` e a lista de filhos em `children`.

**Reels NÃO podem entrar em carrossel** — vídeo em carrossel é vídeo comum, sem
`share_to_feed`, sem `audio_name`, sem capa. A tela tem de dizer isso ao montar,
senão a pessoa monta esperando comportamento de reels.

**Todos os itens são cortados pela proporção do primeiro**, padrão 1:1. Isso
aparece ANTES de escolher os arquivos, não depois — a ordem importa, e descobrir
isso pelo resultado publicado é tarde.

Carrossel também não aceita marcação de localização.

### 7 · O que este projeto NÃO faz

- **Não põe música da biblioteca** (ver 4).
- **Não avisa fora da tela** (ver 5).
- Não publica figurinha de link, enquete nem localização em stories — a API não
  suporta. Menção de perfil funciona.
- Não põe etiqueta de compras nem filtro — a API não suporta.
- Não usa `upload_type=resumable`: a documentação o restringe a apps com Login do
  Facebook. O `video_url` do bucket cobre o caso.
- Não mexe em nenhuma automação existente.

---

## O que muda no banco

Um `kind` novo na fila (`dm_lote` de 01/09 é o precedente: a restrição
`queue_kind_check` já foi reescrita duas vezes), e **provavelmente** uma tabela
para a mídia enviada — porque, diferente do lote, aqui há **ciclo de vida de
arquivo**: o objeto no bucket existe antes do post, sobrevive ao agendamento e
precisa ser localizável para limpeza.

**Isso será decidido com número no plano, não aqui.** A pergunta que o plano tem
de responder: o `payload` da fila basta, ou o arquivo precisa de registro
próprio? O envio em lote respondeu "nenhuma tabela nova" e estava certo; aqui a
resposta pode ser outra, e o critério é o mesmo — o que a consulta precisa
saber, não o que parece organizado.

---

## O que este projeto arrisca, dito antes de começar

**É o primeiro recurso que escreve no perfil público.** Tudo até aqui responde em
conversa privada. Um defeito aqui não é uma mensagem errada para uma pessoa — é
um post no perfil de 2.933 publicações, visível para todos os seguidores, que
some do feed mas não da memória de quem viu.

Três consequências para o plano:

1. **A prova vem antes da tela.** Ver abaixo.
2. **A validação é função pura com teste**, e roda ANTES do upload. Deixar a Meta
   recusar depois de 200 MB enviados é desperdício e experiência ruim.
3. **`trial_params` com `graduation_strategy: MANUAL`** publica reels de teste
   que NÃO vão para os seguidores até serem promovidos à mão. É o que permite
   provar reels numa conta real sem ninguém ver.

---

## Como isto fica provado

### A PRIMEIRA TAREFA É UM PORTÃO, e nada se constrói antes dela

Dois pontos não se resolvem lendo, e a Meta diz isso por extenso:

- **PPA** — se uma conta estiver vinculada a Página que exige Autorização de
  Publicação, a publicação é bloqueada. *"Já que não é possível determinar se a
  Página de um usuário requer ou não PPA"* — palavras da documentação. Some-se a
  isso que autenticação em dois fatores exigida pela Página também faz falhar.
- **O limite diário real** — a mesma página da Meta diz 100 num lugar e 50 em
  outro. Resolve-se consultando `GET /{IG_ID}/content_publishing_limit`, que
  devolve uso e cota de verdade. Não se chuta, pergunta-se.

**A prova:** acrescentar o escopo, reconectar UMA conta, subir um JPEG ao bucket
à mão, criar contêiner, publicar, apagar. Se a Meta recusar, o erro vem com
código e subcódigo — e `resumoDoErroDaMeta` (`lib/steps.ts`) já sabe traduzi-lo
desde 28/08.

**Nada de tela, upload, conversão ou fila antes disso passar.** É a mesma
disciplina que o envio em lote seguiu: medir o alcance real (126 contatos, 9
alcançáveis) antes de construir o botão.

### Depois do portão

**As decisões viram funções puras, com teste:** a validação de cada formato
(tipo, tamanho, duração, proporção, largura), qual `media_type` e quais
parâmetros cada forma exige, a frase de cada estado do upload, e a leitura de
`status_code`.

**O motor ganha caminho de integração**, no molde do sexto caminho de 02/09
(`testes-integracao/acoes-que-falam.integracao.ts`, sobre `comoNumaRequisicao`):
enfileirar um post, drenar contra a Meta falsa, conferir os dois `POST` na ordem
certa e o estado final.

**E o plantio de sempre.** Os candidatos naturais: o contêiner nascendo na hora
de agendar em vez da de publicar (o `EXPIRED` calado), a validação aceitando
PNG, a espera de `status_code` sem teto segurando o dreno, e o post indo para a
conta errada — que é o mesmo defeito que `alvoDoLote` existe para impedir.

---

## Restrições herdadas, que valem aqui

- **A suíte não testa componente.** Toda decisão sai do JSX e vira função pura.
- **`lib/steps.ts` não tem NENHUM import.**
- **Migração é imutável depois de aplicada** — mudança é arquivo NOVO.
- **A migração roda no build, ANTES de o código novo entrar no ar.** Mudança que
  o código antigo não tolera vai em DOIS deploys.
- **Em produção, não mexer em automação existente.**
- **A `DATABASE_URL` pode ser usada, nunca impressa.** O mesmo passa a valer para
  a `SUPABASE_SERVICE_ROLE_KEY`.
- **Nada de teste que alcance cliente.** Aqui é mais forte: nada de teste que
  publique no perfil sem `trial_params`, ou que não seja apagado depois.
- **Este Next.js não é o que você conhece.** Ler `node_modules/next/dist/docs/`
  antes de escrever código específico de Next.

---

## Fontes

Lidas no navegador, em 03/09/2026:

- [Publicação de conteúdo](https://developers.facebook.com/docs/instagram-platform/content-publishing)
- [Mídia de usuário do Instagram — referência](https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user/media)
- [Limite da publicação de conteúdo](https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user/content_publishing_limit)
- [Níveis de acesso da Graph API](https://developers.facebook.com/docs/graph-api/overview/access-levels)
- [Limites das Vercel Functions](https://vercel.com/docs/functions/limitations)
