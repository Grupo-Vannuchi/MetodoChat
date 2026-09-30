# O gerador de bônus — Etapa 2: o texto do carrossel

**Nascido em:** 30/09/2026, desenhado com o Eduardo parte por parte, no dia em que o primeiro
bônus gerado pelo Chat foi publicado no Método Labs (`reativar-clientes-whatsapp`, palavra
`SUMIDO`).
**Estado:** desenho aprovado. Pronto para virar plano.
**Projeto de quem:** do Vinícius Gualberto. Como a Etapa 1, esta entra como visita: pasta própria
e o mínimo de toque no que já existe.
**Etapa anterior:** `docs/specs/2026-09-29-gerador-de-bonus.md`, em produção desde 29/09.

---

## O que é

Na página de um bônus que já está publicado no Labs, o operador pede um carrossel. A IA escreve o
texto de cada slide e a legenda do post, e a chamada final pede para comentar a **palavra do
bônus**, posta pelo código. O operador revisa, edita e copia cada peça. A arte (Etapa 3) e a
publicação (Etapa 4) vão usar o texto salvo aqui.

O que esta etapa garante, acima de tudo: **na hora de gerar e de salvar, a chamada pede a palavra
do bônus e nenhuma outra**, e essa palavra é a que o Labs tinha publicada naquele momento. Depois
disso, a página do carrossel mostra sempre a situação do bônus no Labs, e avisa quando ele deixou
de estar publicado ou trocou de palavra. É a falha que o Labs registrou em `src/lib/ia/funil.ts`:
dois carrosséis de exemplo pediam "Comente PROMPT" e "Comente EXCEL", nenhuma das duas palavras
existia, e quem comentasse ficaria sem resposta, sem que nada no sistema acusasse.

---

## O que foi medido antes de desenhar

Tudo no site-ia em `origin/main` = `45bc973` (produção do Labs), só leitura, e no Chat em
`689f93b`.

| pergunta | resposta | fonte |
|---|---|---|
| que formato o Labs usa para o carrossel? | `titulo` (10–90, interno), `gancho` (15–120, slide 1), `slides` de 6 a 9 com `titulo` (8–70) e `texto` (30–300), `chamadaParaAcao` (20–200, slide final), `legenda` (80–900) | `src/lib/ia/schemas.ts`, `CarrosselGeradoSchema` e `SlideSchema` |
| e para uma imagem só? | `PostUnicoSchema`: `titulo` (10–90), `texto` (60–300), `chamadaParaAcao` (20–200, **opcional** lá), `legenda` (80–900) | idem |
| por que duas instruções? | a do carrossel ensina a deixar gancho para o próximo slide; numa peça única isso promete o que não tem onde entregar | comentário de `gerarPostUnico`, `src/lib/ia/gerar.ts` |
| de onde vêm os tetos de tamanho? | da geometria da arte (fonte mínima legível e altura útil); o `texto` do post já foi 350 e cortava | comentários do `PostUnicoSchema` e `slides.test.ts` |
| como o Labs pede um total de slides? | na **mensagem**, não na instrução: "Este post precisa ter N slides no total…". Medido em 15/09: pedido 8, saíram 8 | `gerarCarrossel`, `gerar.ts:334` |
| as instruções mudam muito? | `instrucao-carrossel.ts` (103 linhas) e `instrucao-post.ts` (90) não mudam desde `01e609f`, o mesmo commit de onde veio a instrução do bônus | `git log` |
| o Chat consegue ler a palavra atual de um bônus? | sim, dos **publicados**: `GET /api/bonus` do Labs devolve `items` com `codigo`, `skillId`, `palavraChave`, `titulo`, `tema`, `descricao`, só dos ativos (58 na medição; `reativar-clientes-whatsapp` → `SUMIDO`) | chamada ao vivo, 30/09 |
| essa leitura está no contrato? | **não**. O contrato cobre só o `POST`; o `GET` é o mesmo que o Chat já usa para sugerir temas (`lib/bonus/temas.ts`) | `site-ia/docs/contrato-metodo-chat.md` |
| quantos itens o `/publicar` do Chat aceita num carrossel? | 10, o teto da Meta | `CARROSSEL_ITENS_MAX`, `lib/publicacao.ts:369` |
| a palavra guardada no Chat é confiável? | não depois de publicado: o bônus de 30/09 foi enviado com `ZZTESTECHAT` e o Eduardo a trocou por `SUMIDO` no `/admin` do Labs | banco do Chat e lista pública do Labs |

---

## As decisões, e de quem

Todas do Eduardo, em 30/09, pela caixa de perguntas.

| decisão | escolha | por quê |
|---|---|---|
| de onde nasce o carrossel | **de um bônus pronto**, com um botão na página dele | a palavra já existe e é única no Labs; o elo é posto pelo código, não adivinhado |
| para quais bônus | **só os publicados no Labs**, com a palavra **lida do Labs** | não promove bônus oculto (link quebrado) nem palavra trocada no `/admin` |
| tamanho | **o operador escolhe de 1 a 10 slides no total**, contando gancho e chamada (sugestão do chefe do Eduardo); 1 é um post de imagem única | o Instagram aceita no máximo 10 itens |
| quantos por bônus | **vários** | o mesmo bônus pode ser divulgado em posts diferentes |
| depois de gerar | **revisar, editar e copiar** cada peça; a palavra fica travada | o texto salvo é o que as Etapas 3 e 4 vão usar |
| limite | **10 gerações por dia**, contando o painel inteiro, separado das 5 do bônus | ~US$ 0,06 cada, até ~US$ 0,60 por dia |
| caminho | **A**: o molde da Etapa 1 com as instruções do Labs trazidas como estão | reaproveita o que já foi afinado com carrosséis de verdade |

---

## O desenho

### Onde mora

- `lib/bonus/`: as funções novas, puras sempre que possível (pedido, mensagem para a IA,
  conferências, leitura da lista do Labs), mais as duas instruções trazidas.
- `app/bonus/[id]/`: a seção de carrosséis na página do bônus e a página nova
  `app/bonus/[id]/carrossel/[cid]/`.
- `migrations/014-carrosseis-gerados.sql` e uma entrada em `naoObservaveis` de `lib/esquema.ts`,
  pelo mesmo motivo da `013`: tabela de feature não impede o painel inteiro de subir.

Nada escreve no Labs. O carrossel vive só no Chat.

### A tabela `carrosseis_gerados`

| coluna | o quê |
|---|---|
| `id` | uuid |
| `bonus_id` | o bônus de origem (`bonus_gerados.id`) |
| `criado_em` | quando foi pedido; conta para o teto |
| `total_slides` | 1 a 10, com `check` |
| `palavra` | a palavra lida do Labs **no momento do pedido** |
| `contexto` | o `titulo`, a `descricao` e o `tema` lidos do Labs no pedido, mais o `o_que_resolve` do bônus (`jsonb`): a geração roda no `after()` e não lê o Labs de novo |
| `estado` | `pendente`, `gerando`, `pronto` ou `falhou`, com `check` |
| `gerado` | o que a IA devolveu (`jsonb`, objeto cru, como na `013`) |
| `revisado` | o que o operador salvou (`jsonb`) |
| `erro` | frase legível quando `falhou` |
| `medicao` | tokens e modelo (`jsonb`) |
| `gerado_em`, `revisado_em` | quando a IA terminou e quando o operador salvou |

Índices: `(bonus_id, criado_em desc)` para a lista na página do bônus e `(criado_em desc)` para o
teto.

### O teto

10 pedidos nas últimas 24 horas, para o painel inteiro. Contar e inserir acontecem na mesma
transação, com `pg_advisory_xact_lock` numa **chave própria**, diferente da do bônus, para dois
cliques simultâneos não passarem juntos pela contagem. É o molde de `criarPedido`
(`lib/bonus/repositorio.ts`).

### A palavra e o "publicado"

Uma função lê a lista pública do Labs (`GET {LABS_URL}/api/bonus`) e procura o item cujo `codigo`
é o slug do bônus. A leitura tem **teto próprio de tamanho, 512 KiB**: a lista de produção tinha
20 158 bytes em 30/09 (58 bônus, uns 337 bytes cada), e o teto de 16 KiB da resposta do envio
(`RESPOSTA_MAX_BYTES`, `lib/bonus/labs.ts`) já não a comportaria (achado 44 do auditor). 512 KiB
cobre perto de 1 500 bônus. Além do teto: 3 s de tempo, `redirect: "manual"` e `cache: "no-store"`.
O leitor com teto (`lerAteOTeto`) é o de `labs.ts`, que passa a ser exportado. Do lado do Labs, a
lista tem cache de 30 minutos, invalidado por toda ação do `/admin` e pelo `POST` (medido pelo
auditor). As saídas:

- **publicado**: devolve `palavraChave`, `titulo`, `tema` e `descricao` do Labs. A palavra só é
  aceita se tiver de 3 a 30 letras ou números, a mesma regra de `palavraValida`; fora disso, a
  saída é "formato estranho";
- **não publicado**: o slug não está na lista (o bônus existe oculto, ou nunca foi criado);
- **Labs sem resposta**: rede, tempo esgotado ou status diferente de 200;
- **formato estranho**: a resposta não tem `items` como lista, ou o item não tem os campos;
- **sem configuração**: falta a `LABS_URL`, ou ela não passa por `urlDaPorta`.

**Falha fechada:** só "publicado" libera o carrossel. A leitura acontece **no servidor** duas
vezes: ao desenhar a página e de novo dentro da action que cria o pedido, porque a página aberta
pode estar velha.

**Esta leitura corrige o achado 43 do auditor** (30/09): hoje a tela de um bônus criado diz
"Criado no Labs, ainda oculto" (`textos.ts:127`, `:131`, `:137`), o rótulo "No Labs, oculto"
(`tela.ts:104`) e "O link que vai existir depois de publicar" (`app/bonus/[id]/page.tsx`), sem
ler o Labs de novo. Depois que o bônus é publicado, as três frases ficam falsas. Com a leitura:
"Publicado no Labs · palavra X", "Criado no Labs como oculto" ou "Não consegui consultar o Labs
agora". O rótulo da lista, que não lê o Labs, passa a "Criado no Labs", sem afirmar o estado
atual.

### A geração

1. A action confere a sessão, lê o Labs (tem de dar "publicado") e cria o pedido sob a trava do
   teto, gravando a `palavra` daquele momento.
2. O `after()` da action chama a IA, como no bônus, sob o `maxDuration = 300` da página.
3. **A instrução** depende do total:
   - 2 a 10: `instrucao-carrossel.ts` do Labs;
   - 1: `instrucao-post.ts` do Labs.

   Ambas vêm **como estão**, com o commit de origem (`01e609f`) anotado no cabeçalho, como a do
   bônus. A `REGRA_DE_PORTUGUES` que elas importam já está no Chat.
4. **A mensagem** leva o que muda a cada pedido, e nunca a instrução:
   - o contexto do bônus: `titulo`, `descricao` e `tema` do Labs, e o `o_que_resolve` do pedido
     original;
   - o total: "Este post tem N slides no total: o gancho, N−2 slides de conteúdo e a chamada";
   - a palavra: "A chamada e a legenda pedem para comentar PALAVRA, escrita exatamente assim, em
     maiúsculas".
5. **O formato** é o do Labs, com uma mudança: no carrossel, `slides` aceita de 0 a 8 itens
   (o do Labs pede de 6 a 9), porque aqui o total vai de 2 a 10. No post único, a
   `chamadaParaAcao` passa a obrigatória, porque aqui o post existe para levar ao bônus. Os
   tetos de tamanho de cada campo ficam os do Labs, que vêm da arte.

   **Dois conflitos com as instruções do Labs, e o que se faz com eles** (achado 47 do auditor):
   - `instrucao-carrossel.ts:55` e `:101` dizem "de 6 a 9" slides. Com total de 2 a 7, a
     mensagem pede outra coisa, e nada fora de 8 a 11 foi medido no Labs. A mensagem diz que o
     total dela substitui a faixa da instrução, a conferência de `N − 2` pega a desobediência, e
     a prova real inclui o total 2 (nenhum slide de conteúdo). O custo de errar é uma geração,
     não um texto errado no ar;
   - `instrucao-post.ts:88` fala num texto de "~350" caracteres, e o schema corta em 300. A
     mensagem do post único diz o teto de 300.
6. **As conferências do código**, antes de gravar `pronto`:
   - no carrossel, `slides` tem exatamente `N − 2` itens;
   - a `chamadaParaAcao` e a `legenda` contêm a palavra como palavra inteira, em maiúsculas.
     "Inteira" quer dizer sem letra nem número colado, com a bandeira `u`: um `\b` do
     JavaScript acharia `PROMO` dentro de `PROMOÇÃO` (achado 46 do auditor);
   - a `chamadaParaAcao` não pede **outra** palavra: nenhuma outra palavra toda em maiúsculas, de
     3 caracteres ou mais e com pelo menos uma letra, além da palavra do bônus e das exceções que
     o Labs já usa em `funil.ts` (`PDF`, `LINK`, `BIO`, `GRATIS`, `GRÁTIS`, `AQUI`, `AGORA` e
     `VENCE`, do bordão). "Comente SUMIDO ou GUIA" é recusada. Decisão do Eduardo, 30/09.

   Qualquer uma que falhe grava `falhou` com a frase do que faltou ("vieram 7 slides de
   conteúdo, o pedido era 8; gere de novo", "a IA não pôs a palavra SUMIDO na chamada; gere de
   novo", "a chamada pede também GUIA; gere de novo").
7. Modelo, parâmetros e tempos são os do bônus (`lib/bonus/ia-parametros.ts` e `tempos.ts`):
   `claude-opus-5-5`, saída estruturada pelo schema, `maxRetries: 0`, sem `cache_control`, com
   a `medicao` gravada.

### A revisão

A action de salvar confere a sessão e valida o que chega do formulário:

- o mesmo número de slides do pedido (o número não muda na revisão; para outro tamanho, gera-se
  outro carrossel);
- os tetos de tamanho de cada campo, depois de trocar `\r\n` por `\n` (o mesmo cuidado da
  FASE 1.11-bis);
- a palavra do carrossel na `chamadaParaAcao` e na `legenda`, e nenhuma outra palavra gritada na
  `chamadaParaAcao`, com as mesmas regras da geração.

Passando, grava `revisado` e `revisado_em`. A palavra não vem do formulário: vem da linha.

**O que mudou no Labs depois:** a página do carrossel lê o Labs de novo a cada vez e mostra
sempre a situação, com as cinco saídas da leitura. Se o bônus deixou de estar publicado, ou se a
palavra atual for outra ("No Labs, a palavra deste bônus agora é X; este carrossel pede Y"), o
aviso aparece acima dos campos. O carrossel não é reescrito sozinho; o operador gera outro se
quiser.

### A instrução com dois donos

Até o Labs apagar o gerador de carrossel dele (a geração vai migrar para o Chat), as duas
instruções trazidas existem nos dois repositórios. Vale o combinado de 29/09 para as instruções
do bônus: **mudança em qualquer uma se avisa nos dois sentidos**.

---

## As telas

**Página do bônus (`/bonus/[id]`), quando o envio está `criado`:**

- a linha de estado lida do Labs (publicado, oculto ou sem resposta), no lugar do quadro fixo
  "ainda oculto";
- a seção **"Carrosséis deste bônus"**: a lista (data, total de slides, estado), cada item
  levando à página do carrossel;
- o pedido: um campo **"Quantos slides?"** de 1 a 10, com **10** como padrão, o botão **"Gerar
  carrossel"** e o aviso "Restam X de 10 gerações de carrossel nas últimas 24 horas". O botão só
  fica ativo com o bônus publicado.

**Página do carrossel (`/bonus/[id]/carrossel/[cid]`):**

- gerando: o mesmo acompanhamento do bônus (`acompanhar.tsx`), que pergunta ao servidor uma vez
  por intervalo e desiste depois do teto;
- pronto: um campo por peça, em ordem (gancho, cada slide com título e texto, chamada e
  legenda), com a contagem de caracteres e um **botão de copiar** (`CopyField`, o mesmo da
  página do bônus). No post único: texto, chamada e legenda;
- a palavra aparece travada, com a situação do bônus no Labs e o aviso se ele deixou de estar
  publicado ou trocou de palavra;
- **"Salvar revisão"**;
- `falhou` ou travado: a frase do motivo e **"Gerar de novo"**, que conta no teto do dia.

Nenhum item novo no menu. O visual segue `app/ui.ts` e a auditoria de design de 10/09.

---

## Segurança

- Toda action começa com `await exigirSessao()`, e um teste cobra isso de toda action exportada
  do arquivo, como na Etapa 1.
- Todo id que chega do formulário ou da URL é conferido como uuid antes do SQL.
- Todo SQL é parametrizado.
- A palavra, o título e a descrição que vêm do Labs são entrada de fora: validados e limitados em
  tamanho antes de ir para a IA ou para a tela. A tela os mostra como texto, nunca como HTML.
- A lista do Labs é lida com teto de tempo e de tamanho, sem seguir redirect, pelo mesmo cliente
  que o Chat já usa (`lib/bonus/labs.ts`, `lib/bonus/temas.ts`).

---

## Testes

Todo teste é escrito antes do código e visto falhar. As proteções principais são provadas também
retirando a proteção e vendo o caso certo cair.

| suíte | o quê |
|---|---|
| pura | o pedido: total de 1 a 10 e id do bônus |
| pura | a leitura da lista do Labs: acha pelo `codigo`; palavra fora do formato → "formato estranho"; sem `items` → "formato estranho"; erro de rede → "sem resposta"; só "publicado" libera |
| pura | a mensagem para a IA: o total, a palavra e o contexto; a instrução certa para 1 e para 2 a 10 |
| pura | as conferências: número exato de slides; palavra inteira em maiúsculas na chamada e na legenda, e não como pedaço de outra (`PROMO` dentro de `PROMOÇÃO` não conta); outra palavra gritada na chamada é recusada, e as exceções do Labs (`VENCE`, `PDF`…) e os números passam |
| pura | a revisão: número de slides mantido, tetos depois do `\r\n`, palavra presente |
| pura | as frases: cada estado e cada falha têm frase; as três frases do achado 43 não afirmam "oculto" sem ler o Labs |
| pura | as instruções trazidas são as do Labs (começo do texto, a regra de português junto) |
| integração | a tabela `014`; o teto de 10 com a trava (dois pedidos simultâneos com 9 no dia: um passa, o outro recusa); gerar, gravar `pronto` ou `falhou`; salvar revisão; as actions recusam sem sessão |
| tela | o acompanhamento reusa o componente da Etapa 1 |

---

## A prova real, antes do merge

Cada passo que grava só acontece depois de avisar o Eduardo e ter o OK dele.

1. Ensaio a seco de `scripts/migrar.mjs --a-mao` na produção do Chat (só lê). Se aparecer
   qualquer migração além da `014`, para aqui.
2. Com o OK, `--aplicar --a-mao`: cria `carrosseis_gerados` na produção.
3. Subir o Chat local apontado para a produção **com a `LABS_URL` de produção só no ambiente do
   processo** (`LABS_URL=https://metodolabs.metodotia.com npx next dev -p 3001`) e **sem** o
   `BONUS_INTAKE_SECRET`: assim ele lê a lista pública e não consegue escrever no Labs
   (`configDoEnvio` recusa sem segredo). O `.env.local` não tem nenhuma das duas (achado 48 do
   auditor).
4. Gerar para o bônus `reativar-clientes-whatsapp` (publicado, palavra `SUMIDO`) quatro
   carrosséis: de **10**, de **3**, de **2** e de **1** slide. Custa perto de US$ 0,24 e 4 das 10
   gerações do dia. Conferir o número de slides, a palavra na chamada e na legenda, e a qualidade
   do texto nos tamanhos pequenos, que o Labs nunca testou.
5. Medir tempo e tokens na `medicao`.
6. Salvar uma revisão editada e conferir que a palavra continua travada.
7. Desligar o Chat local assim que a prova terminar (o `57014` de 29/09).

---

## Pré-condições do merge

1. A `014` aplicada na produção, conferida pelo ensaio a seco seguinte ("já aplicada").
2. `npm run verify` limpo e a suíte de integração verde no container.
3. Nenhum `next dev` apontado para a produção durante o deploy do merge.
4. PR com o porquê, revisado pelo dono.
5. Depois do deploy, recarregar a página por completo antes de usar: a Skew Protection da Vercel
   prende a aba ao deploy anterior (achado 42 do auditor, 30/09).

---

## Pedido ao Labs

Incluir o `GET /api/bonus` no contrato (`docs/contrato-metodo-chat.md`), com os campos `codigo`
e `palavraChave` e a regra de que só lista bônus ativos. O Chat passa a depender dele para mais
do que sugerir temas.

---

## Fora desta etapa

- A arte dos slides (Etapa 3).
- Publicar o carrossel pelo `/publicar` (Etapa 4).
- Ligar a automação à palavra (Etapa 5), que também vai precisar ler a palavra do Labs.
- O botão "É este bônus" na colisão (lacuna da FASE 1.13).
- Editar a palavra do bônus pelo Chat: ela é do Labs.
