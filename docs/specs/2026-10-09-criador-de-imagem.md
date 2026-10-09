# O gerador de bônus — Etapa 6: o criador de imagem

**Nascido em:** 09/10/2026, desenhado com o Eduardo pela caixa de perguntas, sobre a `main` em
`aef1eeb` (a Etapa 9 em produção desde 08/10, 17:53Z). A capa do slide 1 fica com o Canva, pelo
"Slide pronto do Canva" que já existe (decisão do Eduardo no mesmo dia, depois de comparar três posts
publicados); esta etapa é a imagem do espaço da arte.
**Estado:** desenho aprovado pelo Eduardo, em três partes; revisado pela auditoria, com o pedir e
acompanhar (achado 88, escolhido pelo Eduardo), o bucket na falha (achado 89) e as pré-condições do
Fluid Compute e do limite de gasto absorvidos; o ensaio do plano acertou os nomes e a versão das cópias
do Labs. **Adendo de 09/10, durante a prova:** a primeira imagem real saiu com "cara de IA" (dedos
fundidos, pele oleosa) e sem o que o Eduardo pediu, e a OpenAI desliga o `gpt-image-1` em 23/10/2026
(achado 90). O Eduardo pausou a prova, mandou seis referências dos carrosséis dele e decidiu, pela caixa,
que o Chat ganha regras de estilo próprias: a seção "As regras de estilo do Chat" substitui a cópia do
`prompt-ilustracao.ts` do Labs, e o modelo e a qualidade saem de uma medição feita antes ("O modelo e a
qualidade, medidos antes").
**Projeto de quem:** do Vinícius Gualberto. Como as etapas anteriores, entra como visita: pasta
própria, e nenhum arquivo do `/publicar` nem das automações muda.
**Etapas anteriores:** a Etapa 5 e o adendo "foto no espaço" (`docs/specs/2026-10-05-publicar-do-carrossel.md`),
que guardam a foto do espaço e a publicam pela arte desenhada.

---

## O que é

Hoje a imagem que entra no espaço da arte (o retângulo de 860×573 embaixo do texto do slide) é feita
fora do Chat: alguém escreve o pedido no ChatGPT, baixa a imagem e sobe pelo "Subir foto". Esta etapa
põe o pedido dentro do Chat: em cada slide com espaço, o operador descreve a cena, o Chat pede a
imagem à OpenAI, e ela entra no espaço exatamente como uma foto subida.

O Labs já faz isso desde setembro (`src/lib/ia/ilustracao.ts` e `src/lib/ia/prompt-ilustracao.ts`, na
`main` dele em `672ee71`), com regras de estilo decididas pelo Eduardo lá. O Chat copia esse caminho: a
chamada, a conferência, a tradução das recusas. Pelo adendo de 09/10, o estilo é do Chat, no jeito das
imagens que os carrosséis já usam (cena de cinema, ilustração conceitual e ambiente comercial, com o
texto só entre aspas), e o modelo é o que substitui o `gpt-image-1`.

---

## As decisões, e de quem

Do Eduardo, pela caixa, em 09/10:

| assunto | decisão |
|---|---|
| a capa do slide 1 | fica com o Canva, pelo "Slide pronto do Canva" (4:5), sem código nesta etapa |
| de onde vêm as imagens hoje | do ChatGPT; por isso a OpenAI |
| a conta | já existe conta de API da OpenAI |
| como gerar | um botão por slide com espaço, com a descrição da cena digitada, como no Labs; nada automático |
| o caminho | copiar o caminho do Labs: o Chat chama a OpenAI direto, com a própria chave ~~e as regras de estilo copiadas do Labs~~ (as regras de estilo mudaram no adendo, abaixo) |
| o teto | 10 imagens nas últimas 24 horas, somando todos os carrosséis, como o Labs |
| a chave | `OPENAI_API_KEY` na Vercel do Chat, em Production e Preview, criada pelo Eduardo ou pelo Vinícius; uma chave só para o Chat é a sugestão |
| a tela, o por dentro e a prova | aprovados como estão nesta spec |
| a espera da imagem (achado 88, da revisão) | pedir e acompanhar: o clique registra o pedido e volta na hora, a imagem é gerada em segundo plano, e o card acompanha |

Do Eduardo, pela caixa, no adendo de 09/10, depois da primeira imagem real e das seis referências:

| assunto | decisão |
|---|---|
| a prova | pausada para rever as imagens |
| as regras de estilo | o Chat ganha regras próprias, no estilo das referências, para os carrosséis; o Labs fica com as dele para o site |
| o texto dentro da imagem | só o texto que o operador escrever entre aspas, exatamente como escrito |
| marca e logotipo | continuam proibidos (manual do perfil), e a regra fica escrita na tela, na hora de gerar |
| pessoa real e figura pública | continuam proibidas (manual do perfil), escritas na tela junto da de marca |
| os estilos | três, escolhidos por slide: cena de cinema, ilustração conceitual e ambiente comercial brilhante (o objeto 3D ficou de fora) |
| os atalhos de composição | os cinco continuam, ajustados ao texto entre aspas |
| o modelo e a qualidade | medidos antes, com a mesma cena nos dois modelos novos e em duas qualidades; o Eduardo escolhe olhando |
| o desenho do adendo | aprovado em três partes (as regras e a tela, por dentro, a medição e a ordem) |

**O que vem do Labs, e o que mudou no adendo.** As regras de estilo foram decididas pelo Eduardo no
Labs, entre 02/09 e 22/09, para as ilustrações do site, e o Chat as copiou inteiras até a primeira imagem
real. ~~Valem inteiras aqui: a fotografia editorial realista, a proibição de texto na imagem, os cinco
atalhos e o modelo `gpt-image-1` em `medium`.~~ Pelo adendo de 09/10, continuam do Labs: a cena de borda
a borda, a proibição de pessoa real, de figura pública e de marca (direito de imagem, do manual do
perfil), os cinco atalhos de composição (ajustados), a descrição até 600 caracteres, o tamanho
(`1536x1024`, a proporção do espaço), o fundo opaco, a tradução das recusas da OpenAI
(`erro-ilustracao.ts`, ainda cópia) e nenhuma chamada ao Claude para "melhorar" a descrição. Mudaram: o
estilo (três, do Chat), o texto na imagem (só entre aspas), e o modelo e a qualidade (medidos antes; o
`gpt-image-1` sai do ar em 23/10/2026, achado 90). O que o Labs mediu do `gpt-image-1` continua valendo
como histórico: ~US$ 0,063 e 34 s por imagem em `medium`, e "mão é onde este modelo erra em qualquer
nível" (`src/lib/ia/ilustracao.ts:66-70` do Labs).

---

## A tela

Na página do carrossel (as duas rotas, `/bonus/[id]/carrossel/[cid]` e `/carrosseis/[cid]`, que usam
o mesmo editor):

- **Onde:** no card de cada slide com espaço (o que não está marcado "Só texto"), na linha dos botões
  da imagem, ao lado de "Subir foto" e "Slide pronto do Canva", um botão **"Gerar imagem"**. Ele segue
  a mesma regra dos outros dois: não aparece no "Só texto" nem com o carrossel na fila ou publicado.
- **O pedido:** o botão abre o campo **"Descreva a cena"**, com a **escolha do estilo** (adendo de
  09/10: "Cena de cinema", o primeiro e o que já vem marcado, "Ilustração conceitual" e "Ambiente
  comercial brilhante", cada um com uma linha de resumo), a lista dos cinco atalhos e o resumo de cada
  um, como o Labs mostra (`/showcase` vitrine do produto, `/marketing` cena de divulgação, `/grafico`
  dados e comparação, `/passo` sequência de etapas, `/antes-depois` antes e depois), e o botão
  **"Gerar"**. A cena tem pelo menos 10 caracteres, contados sem os atalhos e sem o texto entre aspas;
  a descrição inteira tem até 600; o texto entre aspas soma até 120; o atalho que não existe é recusado
  com a lista dos que existem, e a aspa sem par também, com a frase dela.
- **As regras na tela (adendo de 09/10):** junto do campo, sempre visível, "Sem marca e sem pessoa
  real (manual do perfil). Texto só entre aspas, exatamente como escrito." É a regra do manual do
  perfil registrada na hora de gerar, como o Eduardo pediu.
- **O aviso de texto (mudou no adendo):** ~~se a descrição pedir texto na imagem, o campo avisa que a
  IA escreve errado e que o texto do slide já vem da arte~~. Se a descrição pedir texto ("escrito",
  "placa", "título" e os outros termos do Labs) sem nenhum trecho entre aspas, o campo avisa "Para o
  texto aparecer na imagem, escreva-o entre aspas." Com aspas, avisa "Confira a grafia na imagem antes
  de publicar." Os dois são aviso, não bloqueio, como o Eduardo decidiu no Labs em 21/09. O texto da
  imagem não disputa lugar com o texto do slide: na arte, o texto fica acima do espaço, e a imagem
  dentro dele, sem sobreposição.
- **Enquanto gera:** "Gerando a imagem… leva uns 30 segundos", com os botões da imagem daquele slide
  desligados. O resto da página continua funcionando: salvar, "Só texto", outro slide e publicar. Se a
  página for recarregada ou a aba fechada, a geração continua no servidor, e o card volta em
  "Gerando…" até a imagem aparecer.
- **Pronta:** a imagem entra no espaço, como uma foto subida. A miniatura troca pela versão nova, e a
  imagem anterior daquele slide, de qualquer jeito (foto, imagem gerada ou slide pronto), sai do
  bucket, como numa troca de foto hoje.
- **Gerar de novo:** depois da primeira, o botão diz "Gerar de novo", e o campo volta com a última
  descrição daquele slide, para ajustar. Pelo adendo, volta também com o estilo e o atalho, porque os
  dois ficam guardados no começo da descrição (`/cinema /antes-depois …`).
- **O teto:** junto do campo, "Hoje: 3 de 10 imagens". Com 10 nas últimas 24 horas, o botão "Gerar"
  trava com a frase do teto.
- **As recusas, cada uma com frase:** a descrição curta ou longa, o atalho que não existe, o teto, a
  chave que falta, o slide que já está gerando, as recusas da OpenAI (sem crédito, limite de
  requisições, chave não reconhecida, acesso negado ao modelo, pedido recusado: as frases do Labs), a
  demora, a imagem que veio fora do formato, e o carrossel na fila, publicado, sem conta ou com a conta
  desconectada.
- **Nada publica sozinho:** a imagem é vista no slide antes de publicar. O Labs mediu que o modelo
  ainda erra mãos e dedos na qualidade usada.

---

## Por dentro

### ~~As regras, copiadas do Labs~~ As regras de estilo do Chat (adendo de 09/10)

**Até o adendo,** `lib/bonus/prompt-ilustracao.ts` era a cópia, byte a byte, de
`src/lib/ia/prompt-ilustracao.ts` do Labs na `main` `672ee71` (blob `d993e809…`), travada por um teste
da soma do git, com os testes do Labs copiados junto (commit `698abb6` da branch). **Pelo adendo, o
arquivo passa a ser do Chat:** o nome fica, o comentário de topo diz que ele nasceu da cópia do Labs e se
separou em 09/10 por decisão do Eduardo, e o teste da soma desse arquivo e os testes copiados dele saem,
trocados pelos testes das regras abaixo. O Labs fica com as regras dele para o site, e foi avisado.

**A tradução das recusas continua cópia.** `lib/bonus/erro-ilustracao.ts` (`mensagemDaOpenAI`) segue a
cópia, byte a byte, de `src/lib/ia/erro-ilustracao.ts` da dev do Labs em `69c079d` (blob `6a5e8f55…`),
com o filtro do pedaço da chave do 401, o teste da soma e o teste do Labs copiado. Recusa da OpenAI não é
estilo, e os dois lados ganham com a mesma tradução. O acordo de 08/10 com o Labs passa a valer para a
conta da arte, os vetores e este arquivo; o Labs avisa antes de mudá-lo.

**As peças do pedido**, todas em `lib/bonus/prompt-ilustracao.ts`, com o texto exato que vai à OpenAI:

1. **O estilo** (`ESTILOS`, três, escolhidos por slide; a chave vira um atalho no começo da descrição):

   | chave | na tela | o trecho do pedido |
   |---|---|---|
   | `/cinema` | Cena de cinema: foto realista, luz dramática e contraste forte | "Fotografia realista com cara de cena de cinema, num ambiente de trabalho brasileiro contemporâneo. Luz dramática e quente, de abajur, de janela no fim da tarde ou de tela, com sombras profundas e contraste forte; fundo levemente desfocado. Cores ricas e naturais. Pele com textura real, poros e pequenas imperfeições, sem brilho oleoso e sem retoque. Expressões claras e postura natural, com as mãos repousadas ou fora do primeiro plano. Sem aparência de render 3D, de desenho ou de banco de imagens." |
   | `/ilustracao` | Ilustração conceitual: uma metáfora desenhada, com textura | "Ilustração conceitual digital, com acabamento de peça editorial: uma metáfora visual clara do assunto, feita de objetos simbólicos, ícones simples, post-its, fios e setas, sobre fundo com textura de papel. Cores vivas e harmônicas, sombras suaves, traço limpo e volume leve. Não é foto nem render 3D realista." |
   | `/comercial` | Ambiente comercial brilhante: loja, vitrine ou fachada iluminada | "Fotografia realista de ambiente comercial bem iluminado: loja, vitrine, balcão ou fachada, com luz quente de spots, reflexos no chão e no vidro, produtos organizados e brilho convidativo de vitrine. Cores quentes e saturadas na medida, nitidez de foto profissional. Fachadas, caixas e produtos sem nome, sem marca e sem logotipo visível." |

   Sem estilo na descrição, vale o `/cinema`; a tela sempre manda um.
2. **O atalho de composição** (`ATALHOS`, opcional): os cinco do Labs, com o texto do Labs, menos o
   `/grafico`, que passa a "Composição de dado: barras, setas ou blocos de tamanhos diferentes
   representando comparação ou crescimento, sem eixos nem escala; números e rótulos, só os que estiverem
   entre aspas na descrição." O que o Labs escreveu sobre eles continua valendo: o atalho muda o
   enquadramento, não a estética.
3. **A cena**: a descrição digitada, sem os atalhos, com as aspas onde o operador as pôs.
4. **O texto**: com trechos entre aspas (retas `"…"` ou curvas `“…”`), "Escreva na imagem exatamente
   estes textos, em português do Brasil, com a grafia, as maiúsculas e os acentos exatamente como estão
   entre aspas: «trecho 1»; «trecho 2». Cada um aparece uma vez, legível, numa superfície que faça sentido
   na cena (placa, tela, papel, quadro, post-it ou rótulo). Nenhum outro texto, letra, número ou logotipo
   em nenhuma parte da imagem." Sem aspas, a `PROIBICAO_DE_TEXTO` do Labs, sem mudar uma letra.
5. **As proibições do manual do perfil**: a `PROIBICAO_DE_PESSOA_REAL` do Labs, sem mudar uma letra
   (pessoa fictícia e anônima; nenhuma pessoa real, figura pública, celebridade, político ou sósia; nenhuma
   marca, logotipo ou uniforme identificável).
6. **A cena de borda a borda**: o `FUNDO` do Labs, sem mudar uma letra.

`montarPrompt` junta as seis nessa ordem, a aprovada pelo Eduardo.

**A conferência da descrição** (`validarDescricao`, antes de qualquer chamada, sem custo): no começo,
até um estilo e um atalho, em qualquer ordem; um atalho que não existe é recusado com a lista dos que
existem; a aspa sem par é recusada ("Feche as aspas do texto que deve aparecer na imagem."); o texto entre
aspas soma até 120 caracteres; a cena, sem os atalhos e sem o texto entre aspas, tem pelo menos 10; a
descrição inteira, até 600. `pedeTextoNaImagem` (a lista de termos do Labs) continua, e alimenta o aviso
de texto da tela.

**A medição do texto.** O Labs mediu que o `gpt-image-1` "troca letra, inventa acento, e é pior em
português" (o caso ORGÁNICA). No modelo novo isso não está medido: a medição de antes (abaixo) e a prova
usam um texto acentuado entre aspas, e o limite de 120 caracteres pode baixar se a medição mostrar erro.

### O modelo e a qualidade, medidos antes (adendo de 09/10, achado 90)

A OpenAI desliga o `gpt-image-1` em 23/10/2026, e os pedidos com esse nome passam a falhar
(https://developers.openai.com/api/docs/deprecations, bloco "Legacy GPT Model Snapshots (April 22,
2026)"); os substitutos indicados são `gpt-image-2.5-flare` e `gpt-image-2.5-sunburst`. O `gpt-image-1.5`,
o `gpt-image-1-mini` e o `chatgpt-image-latest` saem em 01/12/2026, e não servem de ponte. O Labs, que usa
o `gpt-image-1` em produção, foi avisado e abriu a Etapa 49 dele.

O que a documentação oficial confirma para os dois modelos novos
(https://developers.openai.com/api/docs/models/gpt-image-2.5-flare, o guia
https://developers.openai.com/api/docs/guides/image-generation e a referência
https://developers.openai.com/api/reference/python/resources/images/methods/generate): o mesmo endpoint
(`v1/images/generations`); `1536x1024` entre os tamanhos recomendados; `jpeg` com `output_compression`;
`background: "opaque"` aceito pelos dois; `quality` de `low` a `max` (`xhigh` e `max` só neles), com
`auto` como padrão; a resposta em `b64_json`; e a verificação da organização, que pode ser exigida. A
tarifa é por token, a mesma nos dois ($30 por milhão de tokens de imagem gerada). Não há tabela por imagem
para eles: a do `gpt-image-2`, com a mesma tarifa, dá, em `1536x1024`, US$ 0,041 em `medium` e US$ 0,165 em
`high` (a do `gpt-image-1` dá US$ 0,063 e US$ 0,25, o que o Labs mediu).

**A medição, antes do plano.** Com o OK do Eduardo para o gasto, o Labs (Etapa 49.1 dele, pela chave
dele, fora da produção do Chat, sem contar no teto do Chat) gera a mesma cena do Chat, com o pedido
montado pelas regras acima, no estilo `/cinema` e com um texto acentuado entre aspas, nos dois modelos e
em duas qualidades (`medium` e `high`): 4 imagens; e mais uma no estilo `/ilustracao`. São 5 imagens, uns
US$ 0,60. De cada uma ficam registrados o custo pelo `usage` da resposta, o tempo, as mãos e a pele
ampliadas, e a grafia do texto. O Eduardo compara lado a lado e escolhe o modelo e a qualidade; o plano
os fixa num lugar só (`imagem-openai.ts`), e o custo do teto e da prova se refaz com o número medido.

**O que não muda na chamada:** `1536x1024`, `n: 1`, `background: "opaque"`, `output_format: "jpeg"` e a
compressão que o plano fixou (`COMPRESSAO_DA_IMAGEM`; sem ela, o padrão é 100 e o arquivo cresce; a
primeira imagem real, no `gpt-image-1`, deu 193 734 bytes). As recusas do modelo novo (o 403 da
verificação e o formato do erro) e o custo real ficam como não medidos até a primeira geração da prova.

### A chamada à OpenAI

Um módulo `server-only` (`lib/bonus/imagem-openai.ts`) faz o `POST https://api.openai.com/v1/images/generations`
com `fetch`, sem SDK, como o Labs: nada muda no `package.json`. O corpo é o do Labs, com uma diferença:

- ~~`model: "gpt-image-1"`~~, `size: "1536x1024"`, ~~`quality: "medium"`~~, `n: 1`, `background: "opaque"`;
  pelo adendo, o modelo e a qualidade saem da medição ("O modelo e a qualidade, medidos antes");
- **`output_format: "jpeg"`**, e não `"png"`, com `output_compression`. O Chat guarda a foto do espaço
  em JPEG e a rota da arte só a lê como JPEG e até 2 MB (`FOTO_DO_ESPACO_MAX_BYTES`,
  `lib/bonus/publicar-regras.ts:91`; `lib/bonus/arte-foto.ts:175`); o PNG do Labs passou de 2 MB
  com transparência. O nível da compressão fica no plano, e a prova mede o tamanho da primeira imagem.

O prazo é de 180 s (`TIMEOUT_IMAGEM_MS`, o `TIMEOUT_API_MS` do Labs), dentro dos 300 s das páginas do
carrossel (`MAX_DURATION_S`, `lib/bonus/tempos.ts:12`). A chave sai de `process.env.OPENAI_API_KEY` e
nunca vai para log, frase nem banco. Sem a chave, a recusa diz isso, sem chamar nada.

### Guardar como foto

A imagem que volta é conferida antes de qualquer gravação: os bytes têm de ser JPEG (a mesma leitura
de `arte-foto.ts`), a largura e a altura são lidas do cabeçalho do JPEG, e as duas e o tamanho passam
pela regra da foto do espaço (`problemaDaFotoDoEspaco`, `publicar-regras.ts:96`: a proporção do
espaço, de 860×573 a 1720×1146, e até 2 MB). 1536×1024 está dentro. Fora disso, a recusa tem frase e
nada é guardado.

Conferida, a imagem sobe para o bucket como uma foto do espaço: o caminho é assinado em `bonus-foto/`
na pasta da conta do carrossel (`assinarCaminho`, `lib/bonus/publicar-bucket.ts:14`) e o servidor faz
o `PUT`. Depois ela é guardada no slide pelo mesmo caminho do "Subir foto" (`guardarImagem`,
`lib/bonus/publicar-processo.ts:125`): a gravação confere o caminho, a imagem anterior sai do bucket, e
a resposta traz a versão nova da miniatura. **Por isso a rota da arte, o publicar e a fila não mudam:**
para eles, a imagem gerada é uma foto.

### O teto e a migração 018

Uma tabela nova, `imagens_geradas` (`migrations/018-imagens-geradas.sql`), guarda uma linha por pedido
à OpenAI: o carrossel (que, apagado, deixa a linha com o carrossel nulo), o número do slide, a
descrição digitada, o estado (`gerando`, `pronta` ou `falhou`), o motivo da falha, o caminho guardado
e as horas de começo e de fim. É **tabela de feature**, como a 013 e a 014: entra em `naoObservaveis`
de `lib/esquema.ts`, e quem confere as colunas é um teste de integração da própria tabela. O
`scripts/migrar.mjs` não muda (achado 82).

O teto conta as linhas das últimas 24 horas, de qualquer estado, no relógio do banco. Conta também o
pedido que falhou, porque a OpenAI pode ter cobrado. A conta e a linha nova acontecem numa transação
com trava própria (`pg_advisory_xact_lock`, no molde de `comTeto`, `lib/bonus/carrossel-repositorio.ts:53`),
para dois cliques juntos não passarem do 10. Na mesma trava, um slide com uma linha `gerando` mais
nova que `TRAVADA_IMAGEM_MS` (abaixo) recusa o segundo pedido: cada slide gera uma imagem de cada vez.

A linha nasce `gerando` antes da chamada e termina `pronta` (com o caminho) ou `falhou` (com o
motivo). A página lê dela a contagem de hoje e a última descrição de cada slide, para o "Gerar de
novo".

### Pedir e acompanhar (achado 88)

**Por que não esperar a imagem na action.** O Next instalado manda as Server Actions de um cliente
uma de cada vez: "If a user triggers three actions in quick succession, the second waits for the first
to finish" (`node_modules/next/dist/docs/01-app/02-guides/server-actions.md:28`). Uma action que
esperasse a imagem por até 180 s prenderia, nesse tempo, o salvar de cada slide, o "Só texto", o
guardar foto, o "Gerar" de outro slide e o publicar. A página pareceria travada. Por isso o pedido e
a geração se separam, como o Chat já faz com a geração do bônus e do carrossel pela IA (`after()`, em
`app/bonus/actions.ts` e `app/carrosseis/actions.ts`) e como o Labs faz com a ilustração (decisão do
Eduardo em 09/10).

**O pedido** é uma action curta (`pedirImagemDoSlide`, num arquivo novo em `app/bonus/`). Ela confere a
sessão por conta própria, como toda action do gerador, lê o pedido e faz, nesta ordem:

1. confere o carrossel como o publicar confere (pronto, com a conta gravada e conectada, e a trava
   livre) e o slide (existe e tem espaço);
2. confere a descrição (`validarDescricao`) e a chave;
3. reserva no teto (a linha `gerando`), ou recusa;

e volta na hora, como estado (nunca por redirect, achado 52), com a frase e a contagem de hoje. Os
passos 1 a 3 recusam sem chamar a OpenAI, ou seja, sem custo.

**A geração** roda depois da resposta, no `after()` da mesma action, dentro do `maxDuration` da página
(300 s). O processo (`lib/bonus/imagem-processo.ts`):

4. chama a OpenAI, confere a imagem, sobe para o bucket e guarda no slide (`guardarImagem`, que
   confere de novo o carrossel: se ele foi agendado no meio, a imagem não entra);
5. marca a linha `pronta` (com o caminho) ou `falhou` (com o motivo).

**O que sai do bucket numa falha (achado 89).** Enquanto o `guardarImagem` não confirmou, uma falha
apaga o arquivo que subiu. Depois dele, o arquivo já é a foto do slide (o caminho foi gravado e a
imagem anterior saiu do bucket): uma falha ao marcar a linha deixa o arquivo, e a linha `gerando`
vence pelo prazo e conta no teto.

**O acompanhar.** O card pergunta o estado da linha a cada 2 s (`INTERVALO_CONSULTA_MS`) por uma rota
GET da pasta da feature, ao lado da rota da arte, que confere a sessão e o carrossel e só lê. Fora da
fila das actions, a consulta nunca prende a página. Pronta, a resposta traz a versão nova da miniatura,
e o card mostra a imagem; com falha, a frase. A linha `gerando` mais velha que o prazo da chamada com
uma folga (`TRAVADA_IMAGEM_MS`) aparece como falha ("A geração não terminou. Tente de novo."), libera
o slide e continua contando no teto. A página que abre com uma linha `gerando` no slide começa o card
em "Gerando…": recarregar ou fechar a aba não para a geração.

A chamada à OpenAI entra por parâmetro só para o teste, como o `enfileirar` do publicar: a integração
roda o processo com uma OpenAI falsa.

### O que não muda

- A arte, o desenho, a conta do "não cabe" e os vetores combinados com o Labs.
- A rota da arte, o publicar, a fila e o "Subir foto": a imagem gerada passa por eles como foto.
- Nenhum arquivo do `/publicar`, do bucket (`lib/bucket.ts`), do dreno, da fila nem das automações, e
  nenhuma dependência nova. O diff fica em `app/bonus/`, `app/carrosseis/` (a rota da consulta ao lado
  da rota da arte, uma em cada caminho do carrossel, como a arte), `lib/bonus/`, `migrations/018-…`, a
  declaração em `lib/esquema.ts`, testes e `docs/`.

---

## O efeito na produção

O botão "Gerar imagem" aparece em todo slide com espaço dos carrosséis que já existem, e nada muda
neles até alguém gerar. Cada imagem gerada custa ~~cerca de US$ 0,063~~ o que a medição do adendo mostrar para
o modelo e a qualidade escolhidos (perto de US$ 0,04 em `medium` ou US$ 0,17 em `high`, pela tabela do
`gpt-image-2`), na conta da OpenAI, até 10 por 24 horas.
A descrição digitada vai para a OpenAI, um terceiro novo no Chat; o texto do carrossel e os dados dos
contatos não vão.

---

## Testes

| suíte | o quê |
|---|---|
| pura | ~~a cópia das regras: a soma do git de cada arquivo igual à do blob do Labs; os testes do Labs, copiados~~ (adendo) a cópia da tradução das recusas: a soma do git de `erro-ilustracao.ts` igual à do blob do Labs, e o teste do Labs copiado (`mensagemDaOpenAI`, com o pedaço da chave tirado) |
| pura | (adendo) as regras do Chat: `montarPrompt` na ordem aprovada (estilo, atalho, cena, texto, pessoa real, fundo), com o trecho de cada estilo e o `/cinema` quando não há estilo; o texto entre aspas (retas e curvas) vira a ordem de escrever exatamente aqueles trechos, e sem aspas entra a `PROIBICAO_DE_TEXTO`; a `PROIBICAO_DE_PESSOA_REAL` e o `FUNDO` sempre presentes e sem mudar uma letra; `validarDescricao` (cena curta sem contar atalhos nem aspas, descrição longa, aspas acima de 120, aspa sem par, estilo ou atalho desconhecido, dois estilos); `pedeTextoNaImagem` (os termos, e "escritório" não casa com "escrito") |
| pura | `mensagemDaOpenAI` (sem crédito, 429, 401, 403, 400, outro), as frases de cada recusa do Chat, e o contador "Hoje: N de 10" |
| pura | a leitura da largura e da altura do cabeçalho do JPEG, e a conferência da imagem pela regra da foto (JPEG, 1536×1024 passa; PNG, outra proporção e mais de 2 MB não) |
| pura | o corpo da chamada (o modelo e a qualidade escolhidos no adendo, nunca o `gpt-image-1`; tamanho, fundo, formato JPEG, compressão, n), com o `fetch` falso, sem rede; a chave ausente recusa sem chamar; o prazo vira a frase da demora |
| integração | a tabela 018: as colunas, os `check`, o carrossel apagado deixando a linha, a migração rodando duas vezes, e a declaração em `naoObservaveis` |
| integração | gerar com a OpenAI falsa e o bucket falso: a imagem vai para `bonus-foto/` na pasta da conta do carrossel, o slide guarda com o jeito foto, a anterior sai do bucket, a linha fica `pronta`; o publicar desse slide sai pela arte, como foto |
| integração | o teto: o 11º pedido em 24 horas é recusado sem chamar a OpenAI; dois pedidos juntos no mesmo slide geram uma imagem só; a falha da OpenAI (400, 401, 429, demora) fica `falhou` e conta; a imagem fora do formato não é guardada e o que subiu sai do bucket |
| integração | o bucket na falha (achado 89): antes do `guardarImagem` confirmar, o arquivo que subiu sai; com a falha forçada ao marcar a linha, depois dele, o arquivo fica e o slide continua com a foto que abre; o carrossel agendado no meio da geração não recebe a imagem |
| integração | as recusas do pedido, antes da chamada e sem linha nova: o carrossel na fila ou publicado, o slide "Só texto", o slide que não existe, sem conta, com a conta desconectada, sem a chave e a descrição fora da regra |
| integração | a consulta: o estado de cada linha (`gerando`, `pronta` com a versão da miniatura, `falhou` com a frase), a linha travada pelo prazo, e a sessão e o carrossel conferidos |
| tela | o botão só no slide com espaço e sem trava; o campo com os atalhos; (adendo) a escolha do estilo, que começa em "Cena de cinema" e vai para o começo da descrição; as regras do manual do perfil sempre visíveis; o aviso de texto nos dois casos (sem aspas: "escreva entre aspas"; com aspas: "confira a grafia"); o "Gerando…" com a consulta; a imagem no espaço com a miniatura nova; o "Gerar de novo" com a última descrição; o contador e a trava no 10; a frase da recusa; **outra action (salvar um slide) sai enquanto a imagem gera** (achado 88); a página que abre com a linha `gerando` começa o card em "Gerando…" |
| páginas | a action nova e a rota da consulta conferem a sessão (as guardas que leem os arquivos); a action chama o processo no `after()` |

Cada proteção principal ganha uma prova de mutação: retirada de propósito, o teste certo cai.

---

## A prova real

No preview, com o Eduardo na tela. Cada gravação tem o OK dele, e a auditoria lê o banco antes e
depois. O preview usa o banco e o bucket de produção, e a chave em Preview. **Sem post real.**
Os textos sugeridos para digitar passam antes pelo schema de cada campo (o mínimo e o máximo).

**A primeira prova, em 09/10, pausada.** Com o `gpt-image-1` e as regras copiadas do Labs, os passos 1 e 2
foram feitos: o carrossel `4e3664ea` e uma imagem (`imagens_geradas` `b6292a0b`, `pronta` em 23,5 s, JPEG
1536×1024 com 193 734 bytes), medidos pela auditoria. O mecanismo funcionou de ponta a ponta; a imagem
saiu com os defeitos que levaram ao adendo, e a prova parou ali. O `4e3664ea` fica no banco, sem agendar
nem publicar, até a devolução do fim da prova retomada, e pode servir de carrossel dela.

**A prova retomada, depois do plano do adendo:**

1. Um carrossel de 1 slide, à mão (o `4e3664ea`, ou um novo; criar grava).
2. No slide, "Gerar imagem" no estilo "Cena de cinema", com uma cena e um texto acentuado entre aspas
   (grava; o custo medido do modelo escolhido): a imagem aparece no espaço, e o contador sobe. A
   auditoria mede o JPEG guardado (medidas e bytes) e a grafia do texto.
3. "Gerar de novo" no estilo "Ilustração conceitual", com a descrição ajustada (grava; o mesmo custo),
   e, durante o "Gerando…", recarregar a página: o card volta em "Gerando…" e a imagem aparece sem novo
   clique. A imagem troca, a anterior sai do bucket, o contador sobe, e o campo volta com o estilo novo.
4. Uma descrição com menos de 10 caracteres de cena, e outra com a aspa sem par: recusadas antes de
   chamar a OpenAI, sem custo e sem linha nova.
5. Agendar para daqui a 7 dias e cancelar no calendário (gravam): a arte da fila leva a imagem gerada.

Pedido com marca não entra na prova: a regra o proíbe no próprio pedido, e cada geração custa e conta no
teto da produção. Se o modelo recusa um pedido assim, e se cobra a recusa, fica como não medido.

No fim, o carrossel e as imagens saem do banco e do bucket, com o OK do Eduardo e o script lido pela
auditoria antes de rodar (achado 77). As linhas de `imagens_geradas` ficam, com o carrossel nulo: são o
histórico do teto, e as da prova contam no teto da produção por 24 horas. Custo da prova retomada: duas
imagens, com o preço medido do modelo escolhido.

---

## Pré-condições

Da prova:

1. A `OPENAI_API_KEY` na Vercel do Chat, em Production e Preview, numa conta da OpenAI com crédito e
   com a organização verificada (os modelos GPT Image podem exigir a verificação, que é separada do
   crédito: a frase do 403 do Labs). Quem cria é o Eduardo ou o Vinícius; a sessão de desenvolvimento
   nunca vê o valor. Em 09/10, o Eduardo confirmou as três coisas pela caixa, e a auditoria viu a chave
   como `sensitive` em Production e Preview (sem o valor).
2. A 018 aplicada à mão na produção, com o OK do Eduardo, antes da prova, porque o preview usa o
   banco de produção (como a 016 e a 017).
3. O Fluid Compute ligado no projeto da Vercel: no plano Hobby, os 300 s das páginas exigem o Fluid
   (`lib/bonus/tempos.ts:11`), e sem ele a função para em 60 s e a geração no `after()` pode ser
   cortada. O Eduardo o conferiu ligado em 29/09, para a Etapa 1; o conector da Vercel não mostra a
   opção, e por isso ele ou o Vinícius confere de novo em Settings → Functions antes da prova.
4. Recomendado: um limite de gasto no projeto da OpenAI dessa chave, como segunda guarda além do teto
   do banco (o Eduardo confirmou em 09/10 que colocou).
5. (Adendo) A medição feita, e o modelo e a qualidade escolhidos pelo Eduardo; o plano do adendo
   executado, sem `gpt-image-1` em lugar nenhum do código.

Do merge:

1. `npm run verify` limpo, a integração verde no container, e o preview com a prova feita.
2. A soma da 018 registrada na produção igual à do head; o build do merge diz "Nada a aplicar: as 19
   migrações".
3. Nenhum `next dev` apontado para a produção durante o deploy, e as abas recarregadas depois.

---

## Fora desta etapa

- Gerar sozinho a imagem de todos os slides, ou de vários de uma vez.
- A IA de texto escrever a descrição da cena a partir do slide (depende do crédito da Anthropic, e o
  Labs também não faz).
- Editar uma imagem já gerada, ou gerar a partir de uma foto.
- A capa do slide 1 desenhada pelo Chat, o modo escuro da arte e a capa gerada por IA (ideias de
  09/10, sem decisão); a capa segue pelo "Slide pronto do Canva".
- (Adendo) Marca e logotipo na imagem gerada: o manual do perfil proíbe, e o Eduardo manteve. A imagem
  com o logo de uma ferramenta continua sendo feita fora (no ChatGPT ou no Canva) e entra pelo "Subir
  foto".
- (Adendo) O estilo "objeto 3D em fundo claro", que estava entre as referências e não foi escolhido.
- Imagem de pessoa real: as regras proíbem; uma foto real continua entrando pelo "Subir foto", e a
  responsabilidade pelo direito de imagem é de quem sobe.
