# O gerador de bônus — Etapa 6: o criador de imagem

**Nascido em:** 09/10/2026, desenhado com o Eduardo pela caixa de perguntas, sobre a `main` em
`aef1eeb` (a Etapa 9 em produção desde 08/10, 17:53Z). A capa do slide 1 fica com o Canva, pelo
"Slide pronto do Canva" que já existe (decisão do Eduardo no mesmo dia, depois de comparar três posts
publicados); esta etapa é a imagem do espaço da arte.
**Estado:** desenho aprovado pelo Eduardo, em três partes; à espera da revisão da auditoria.
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
`main` dele em `672ee71`), com regras de estilo decididas pelo Eduardo lá. O Chat copia esse caminho.

---

## As decisões, e de quem

Do Eduardo, pela caixa, em 09/10:

| assunto | decisão |
|---|---|
| a capa do slide 1 | fica com o Canva, pelo "Slide pronto do Canva" (4:5), sem código nesta etapa |
| de onde vêm as imagens hoje | do ChatGPT; por isso a OpenAI |
| a conta | já existe conta de API da OpenAI |
| como gerar | um botão por slide com espaço, com a descrição da cena digitada, como no Labs; nada automático |
| o caminho | copiar o caminho do Labs: o Chat chama a OpenAI direto, com a própria chave e as regras de estilo copiadas do Labs |
| o teto | 10 imagens nas últimas 24 horas, somando todos os carrosséis, como o Labs |
| a chave | `OPENAI_API_KEY` na Vercel do Chat, em Production e Preview, criada pelo Eduardo ou pelo Vinícius; uma chave só para o Chat é a sugestão |
| a tela, o por dentro e a prova | aprovados como estão nesta spec |

**O que vem do Labs sem mudar.** As regras de estilo foram decididas pelo Eduardo no Labs, entre 02/09
e 22/09, e valem inteiras aqui: a fotografia editorial realista, a cena de borda a borda, a proibição
de texto na imagem (as superfícies nomeadas), a proibição de pessoa real, de figura pública e de marca
(direito de imagem, do manual do perfil), os cinco atalhos de composição, e a descrição de 10 a 600
caracteres. Também o modelo (`gpt-image-1`), o tamanho (`1536x1024`, a proporção do espaço), a
qualidade (`medium`: o Labs mediu ~US$ 0,063 e 34 s por imagem; o `high` custa 3,96 vezes e não foi
adotado), o fundo opaco, e nenhuma chamada ao Claude para "melhorar" a descrição.

---

## A tela

Na página do carrossel (as duas rotas, `/bonus/[id]/carrossel/[cid]` e `/carrosseis/[cid]`, que usam
o mesmo editor):

- **Onde:** no card de cada slide com espaço (o que não está marcado "Só texto"), na linha dos botões
  da imagem, ao lado de "Subir foto" e "Slide pronto do Canva", um botão **"Gerar imagem"**. Ele segue
  a mesma regra dos outros dois: não aparece no "Só texto" nem com o carrossel na fila ou publicado.
- **O pedido:** o botão abre o campo **"Descreva a cena"**, com a lista dos cinco atalhos e o resumo
  de cada um, como o Labs mostra (`/showcase` vitrine do produto, `/marketing` cena de divulgação,
  `/grafico` dados e comparação, `/passo` sequência de etapas, `/antes-depois` antes e depois), e o
  botão **"Gerar"**. A descrição tem de 10 a 600 caracteres, contados sem o atalho; o atalho que não
  existe é recusado com a lista dos que existem.
- **O aviso de texto:** se a descrição pedir texto na imagem ("escrito", "placa", "título" e os outros
  termos do Labs), o campo avisa que a IA escreve errado e que o texto do slide já vem da arte. É
  aviso, não bloqueio, como o Eduardo decidiu no Labs em 21/09.
- **Enquanto gera:** "Gerando a imagem… leva uns 30 segundos", com os botões da imagem daquele slide
  desligados.
- **Pronta:** a imagem entra no espaço, como uma foto subida. A miniatura troca pela versão nova, e a
  imagem anterior daquele slide, de qualquer jeito (foto, imagem gerada ou slide pronto), sai do
  bucket, como numa troca de foto hoje.
- **Gerar de novo:** depois da primeira, o botão diz "Gerar de novo", e o campo volta com a última
  descrição daquele slide, para ajustar.
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

### As regras, copiadas do Labs

Um módulo puro novo (`lib/bonus/imagem-prompt.ts`) é a cópia de `src/lib/ia/prompt-ilustracao.ts` do
Labs na `main` `672ee71` (sha do blob `d993e809…`): `PROIBICAO_DE_TEXTO`, `PROIBICAO_DE_PESSOA_REAL`,
`ESTILO`, `FUNDO`, `ESTILOS`, `separarEstilo`, `pedeTextoNaImagem`, `MIN_DESCRICAO`, `MAX_DESCRICAO`,
`validarDescricao` e `montarPrompt`. A tradução das recusas da OpenAI (`mensagemDaOpenAI`) é a cópia
de `src/lib/ia/erro-ilustracao.ts` (`c2ce506f…`), noutro módulo puro. Os comentários que contam a
história de cada regra vêm junto, com a origem citada.

Um teste trava a cópia: a soma dos textos que vão para o modelo (as quatro regras e os cinco atalhos)
é a do Labs em `672ee71`. Mudar uma regra num lado sem o outro derruba o teste, e a mudança se combina
entre os dois, como a conta da arte e os vetores (acordo de 08/10 com o Labs).

### A chamada à OpenAI

Um módulo `server-only` (`lib/bonus/imagem-openai.ts`) faz o `POST https://api.openai.com/v1/images/generations`
com `fetch`, sem SDK, como o Labs: nada muda no `package.json`. O corpo é o do Labs, com uma diferença:

- `model: "gpt-image-1"`, `size: "1536x1024"`, `quality: "medium"`, `n: 1`, `background: "opaque"`;
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
nova que o prazo da chamada recusa o segundo pedido: cada slide gera uma imagem de cada vez.

A linha nasce `gerando` antes da chamada e termina `pronta` (com o caminho) ou `falhou` (com o
motivo). A página lê dela a contagem de hoje e a última descrição de cada slide, para o "Gerar de
novo".

### O processo e a action

O processo (`lib/bonus/imagem-processo.ts`) faz, nesta ordem:

1. confere o carrossel como o publicar confere (pronto, com a conta gravada e conectada, e a trava
   livre) e o slide (existe e tem espaço);
2. confere a descrição (`validarDescricao`) e a chave;
3. reserva no teto (a linha `gerando`), ou recusa;
4. chama a OpenAI, confere a imagem, sobe para o bucket e guarda no slide;
5. marca a linha `pronta` ou `falhou`.

Os passos 1 a 3 recusam sem chamar a OpenAI, ou seja, sem custo. Uma falha depois de subir ao bucket
apaga o que subiu. A chamada à OpenAI entra por parâmetro só para o teste, como o `enfileirar` do
publicar: a integração usa uma OpenAI falsa.

A action (`gerarImagemDoSlide`, num arquivo novo em `app/bonus/`) confere a sessão por conta própria,
como toda action do gerador, lê o pedido e chama o processo. A resposta volta como estado
(`useActionState` ou transição), nunca por redirect (achado 52), com a frase, a versão nova da
miniatura e a contagem de hoje. Ela espera a imagem: o Chat tem 300 s por página na Vercel, e o Labs
pede e consulta por causa da hospedagem dele. Se a aba fechar no meio, o servidor termina e guarda; a
página recarregada mostra a imagem.

### O que não muda

- A arte, o desenho, a conta do "não cabe" e os vetores combinados com o Labs.
- A rota da arte, o publicar, a fila e o "Subir foto": a imagem gerada passa por eles como foto.
- Nenhum arquivo do `/publicar`, do bucket (`lib/bucket.ts`), do dreno, da fila nem das automações, e
  nenhuma dependência nova. O diff fica em `app/bonus/`, `lib/bonus/`, `migrations/018-…`, a declaração
  em `lib/esquema.ts`, testes e `docs/`.

---

## O efeito na produção

O botão "Gerar imagem" aparece em todo slide com espaço dos carrosséis que já existem, e nada muda
neles até alguém gerar. Cada imagem gerada custa ~US$ 0,063 na conta da OpenAI, até 10 por 24 horas.
A descrição digitada vai para a OpenAI, um terceiro novo no Chat; o texto do carrossel e os dados dos
contatos não vão.

---

## Testes

| suíte | o quê |
|---|---|
| pura | a cópia das regras: a soma dos textos igual à do Labs em `672ee71`; `montarPrompt` na ordem (cena, atalho, estilo, fundo, pessoa real, texto); `validarDescricao` (curta, longa, atalho desconhecido, o atalho que não conta no mínimo); `pedeTextoNaImagem` (os termos, e "escritório" não casa com "escrito") |
| pura | `mensagemDaOpenAI` (sem crédito, 429, 401, 403, 400, outro), as frases de cada recusa do Chat, e o contador "Hoje: N de 10" |
| pura | a leitura da largura e da altura do cabeçalho do JPEG, e a conferência da imagem pela regra da foto (JPEG, 1536×1024 passa; PNG, outra proporção e mais de 2 MB não) |
| pura | o corpo da chamada (modelo, tamanho, qualidade, fundo, formato JPEG, n), com o `fetch` falso, sem rede; a chave ausente recusa sem chamar; o prazo vira a frase da demora |
| integração | a tabela 018: as colunas, os `check`, o carrossel apagado deixando a linha, a migração rodando duas vezes, e a declaração em `naoObservaveis` |
| integração | gerar com a OpenAI falsa e o bucket falso: a imagem vai para `bonus-foto/` na pasta da conta do carrossel, o slide guarda com o jeito foto, a anterior sai do bucket, a linha fica `pronta`; o publicar desse slide sai pela arte, como foto |
| integração | o teto: o 11º pedido em 24 horas é recusado sem chamar a OpenAI; dois pedidos juntos no mesmo slide geram uma imagem só; a falha da OpenAI (400, 401, 429, demora) fica `falhou` e conta; a imagem fora do formato não é guardada e o que subiu sai do bucket |
| integração | as recusas antes da chamada: o carrossel na fila ou publicado, o slide "Só texto", o slide que não existe, sem conta, com a conta desconectada e sem a chave |
| tela | o botão só no slide com espaço e sem trava; o campo com os atalhos; o aviso de texto; o "Gerando…"; a imagem no espaço com a miniatura nova; o "Gerar de novo" com a última descrição; o contador e a trava no 10; a frase da recusa |
| páginas | a action nova confere a sessão (a guarda que lê os arquivos das actions) |

Cada proteção principal ganha uma prova de mutação: retirada de propósito, o teste certo cai.

---

## A prova real

No preview, com o Eduardo na tela. Cada gravação tem o OK dele, e a auditoria lê o banco antes e
depois. O preview usa o banco e o bucket de produção, e a chave em Preview. **Sem post real.**
Os textos sugeridos para digitar passam antes pelo schema de cada campo (o mínimo e o máximo).

1. "Novo carrossel" → texto livre → "Escrever à mão", com 1 slide; criar (grava).
2. No slide, "Gerar imagem" com uma descrição de cena (grava; **~US$ 0,063**): a imagem aparece no
   espaço, e o contador mostra "Hoje: 1 de 10". A auditoria mede o JPEG guardado (medidas e bytes).
3. "Gerar de novo" com a descrição ajustada (grava; **~US$ 0,063**): a imagem troca, a anterior sai do
   bucket, e o contador vai a 2.
4. Uma descrição com menos de 10 caracteres: recusada antes de chamar a OpenAI, sem custo e sem linha
   nova.
5. Agendar para daqui a 7 dias e cancelar no calendário (gravam): a arte da fila leva a imagem gerada.

No fim, o carrossel e as imagens saem do banco e do bucket, com o OK do Eduardo e o script lido pela
auditoria antes de rodar (achado 77). As linhas de `imagens_geradas` ficam, com o carrossel nulo: são o
histórico do teto. Custo da prova: ~US$ 0,13.

---

## Pré-condições

Da prova:

1. A `OPENAI_API_KEY` na Vercel do Chat, em Production e Preview, numa conta da OpenAI com crédito e
   com a organização verificada (o `gpt-image-1` exige a verificação, que é separada do crédito: a
   frase do 403 do Labs). Quem cria é o Eduardo ou o Vinícius; a sessão de desenvolvimento nunca vê o
   valor.
2. A 018 aplicada à mão na produção, com o OK do Eduardo, antes da prova, porque o preview usa o
   banco de produção (como a 016 e a 017).

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
- Imagem de pessoa real: as regras proíbem; uma foto real continua entrando pelo "Subir foto", e a
  responsabilidade pelo direito de imagem é de quem sobe.
