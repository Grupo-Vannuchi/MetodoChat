# Portas de entrada — quem abre sua conversa vira contato

**Nascido em:** 26/08/2026 · **Corrigido em:** 27/08/2026, depois de duas rodadas
de experimento contra a Meta. **Estado:** desenho aprovado, pronto para virar plano.

---

## O que este documento já afirmou e a medição derrubou

Este arquivo nasceu chamado *"Gatilho por link"*, e o desenho era: **cada
automação tem um link próprio; quem toca abre a conversa carregando a
identificação daquele link.**

**Não funciona.** Duas rodadas de experimento contra a Meta, em 26/08:

| medido | resultado |
|---|---|
| tocar o link sem digitar | **nenhum evento** — a Meta não avisa que alguém chegou |
| tocar e digitar, sem perguntas de abertura | `messages` **sem** marcador |
| tocar e digitar, **com** perguntas de abertura | `messages` **sem** marcador |
| tocar numa pergunta de abertura | `messaging_postback` **com** o identificador da pergunta, **sem** o marcador do link |
| eventos com `referral` em **todo o histórico** | **zero** |

E não foi por falta de configuração. O dono conferiu o painel da Meta: o campo
`messaging_referral` está **assinado**. As contas foram reassinadas. As perguntas
de abertura estavam ativas. A conversa era nova. O link foi aberto do WhatsApp
**direto para o aplicativo**, sem passar pelo navegador — que é o caminho que
preserva o marcador.

**A documentação da Meta promete o marcador e a plataforma não entrega.** Está
registrado em `docs/experimentos/2026-08-26-primeiro-contato.md`, com as duas
rodadas e as condições exatas, para ninguém tentar de novo lendo a mesma frase.

### E antes disso, uma ideia ainda maior morreu

O pedido original era **"automação para novos seguidores — o gatilho é a pessoa
clicar em seguir"**. A lista oficial de campos de webhook do Instagram **não tem
evento de follow**, e a API **não expõe a lista de seguidores** — só a contagem.
Não há como saber quem passou a seguir, nem quando.

O objetivo real, escolhido pelo dono quando perguntado: **converter seguidor novo
em contato**. É esse que este documento resolve.

---

## O que sobrou, e funciona

**A pergunta de abertura é um gatilho, e está provada ao vivo.**

Quando alguém abre sua conversa pela primeira vez, o Instagram mostra até
**quatro perguntas** que você escreveu. A pessoa toca numa, e chega:

```json
{"postback": {"title": "Quero saber mais",
              "payload": "abertura-saber-mais"},
 "sender": {...}, "recipient": {...}}
```

Isso basta: o sistema sabe **qual** pergunta foi tocada, e pode disparar a
automação daquela pergunta.

**É o caminho fácil que faltava.** Sem caçar post, sem adivinhar palavra-chave,
sem digitar nada.

---

## O que este projeto é

**Uma tela em Configuração que gerencia as quatro portas de entrada da conta**, e
um gatilho novo que as automações podem usar.

### As quatro portas pertencem à CONTA, não à automação

Isto é o fato que molda tudo, e é onde o desenho anterior errava. Não são
"quatro automações com pergunta"; é **um menu de boas-vindas da conta, com até
quatro opções**, e cada opção pode levar a uma automação.

**Por isso a tela é própria, e não um campo dentro do editor.** O dono precisa
ver o menu **do jeito que o visitante vê** — as quatro na ordem em que aparecem —
para escrevê-las como um conjunto. Um campo por automação esconderia justamente
a coisa que precisa ser vista junta.

E resolve um caso que o campo-por-automação não resolveria: **uma pergunta que
não dispara automação nenhuma**. "Quais são os valores?" pode ser só uma pergunta
que o dono responde à mão — e ainda assim vale estar no menu.

### O que a tela mostra

- as quatro posições, na ordem em que o Instagram as exibe
- o texto de cada pergunta, editável
- para cada uma, **qual automação ela dispara** — ou "nenhuma"
- por conta, porque cada conta conectada tem o seu menu
- o aviso de que **não aparecem no computador**, só no celular
- o aviso de que **só aparecem em conversa nova** — quem já conversou não as vê

### O gatilho novo

Um tipo de gatilho `abertura`, ao lado de comentário, story e mensagem direta. A
automação continua sendo automação: mesmo quadro, mesmos blocos, mesma prévia,
mesmas regras de publicar.

No painel do gatilho, `abertura` **não pede palavra-chave** — mostra qual
pergunta a dispara, e um caminho para a tela de Configuração se ainda não houver
nenhuma ligada a ela.

---

## As decisões de comportamento

**A pergunta está ligada a uma automação pausada, ou apagada.** Não faz nada, e
**registra em Atividade**. Mesmo tratamento que palavra-chave sem automação
recebe hoje, e pela mesma razão: o dono precisa poder ver que aconteceu.

**A pergunta não está ligada a nenhuma automação.** Também não faz nada, e
**não** registra — é o caso normal e declarado, não um problema.

**A pessoa ignora as perguntas e digita.** Chega `messages`, e o produto trata
como já trata mensagem direta hoje. Não é caso novo.

**A mesma pessoa toca duas vezes.** O comportamento existente vale, e não é
decisão deste projeto — mas **qual é ele precisa ser MEDIDO no plano, não
presumido**. O produto já resolve reentrada para os três gatilhos que tem (o
cursor da pessoa, a janela de eventos repetidos, a chave de deduplicação da
fila), e o gatilho novo tem de cair na mesma regra em vez de inventar uma.

**O que já está escrito na Meta e não na nossa tela.** As perguntas configuradas
durante o experimento existem hoje em três contas. A tela precisa **ler o que
está lá** e mostrar, em vez de assumir que o banco é a verdade — a Meta é a
verdade, e o dono pode ter mexido pelo painel dela.

---

## Como funciona, por dentro

### O encanamento já existe

`app/api/webhook/route.ts` já percorre `entry.messaging[]`. O evento de botão
chega **nesse mesmo array**, e desde 26/08 ele já é **registrado** em vez de
descartado — foi assim que o experimento o capturou.

O que falta é um **ramo** que o trate em vez de registrar.

### As três mudanças

**1 · Um ramo para o evento de botão** em `handleMessagingEvent`: lê o
identificador da pergunta, acha a automação ligada a ela, cria ou atualiza o
contato, e começa o fluxo.

**2 · O gatilho `abertura`** no banco, no editor e nas conferências de publicar.

**3 · A tela**, em Configuração, e a sincronização com a Meta.

### A chamada da Meta, já levantada e exercitada

```
POST  https://graph.instagram.com/v25.0/<IG_USER_ID>/messenger_profile
      {"platform":"instagram","ice_breakers":[{"locale":"default","call_to_actions":[…]}]}
GET   …/messenger_profile?fields=ice_breakers
DELETE …/messenger_profile   {"fields":["ice_breakers"]}
```

**A documentação da Meta está errada aqui:** sem `locale` ela responde `400`,
subcode 2534058. O `scripts/perguntas-de-abertura.mjs`, escrito no experimento,
já faz os três caminhos e foi exercitado contra a Meta — a tela pode reaproveitar
o que ele descobriu.

### O identificador da pergunta

O `payload` que volta no evento de botão é escolhido por nós, e é ele que liga a
pergunta à automação. **Use o identificador da automação**, como o resto do
produto já faz — não um apelido novo, que seria mais um campo a manter único.

**Cuidado medido:** durante o experimento os identificadores começaram com
`abertura-` de propósito, para que `lerPayload` os devolvesse `null` e **nenhuma
automação disparasse**. Quando o formato mudar para o identificador de verdade,
essas perguntas de teste **passam a disparar**. Elas precisam ser apagadas ou
reescritas junto com a mudança — está no plano, não na memória de ninguém.

---

## Os limites, escritos para não serem descobertos tarde

- **Quatro perguntas por conta.** Não é por automação. A tela tem de deixar isso
  óbvio, não descobrir no erro da Meta.
- **Não aparecem no computador.** Quem abre a conversa pelo navegador não vê
  nada, e o produto não tem como saber.
- **Só aparecem em conversa nova.** Quem já falou com a conta nunca mais as vê —
  o que também significa que **testar exige um perfil que nunca falou**, e isso
  se confere na tabela `contacts` em vez de se presumir.
- **A atribuição não existe.** Não dá para saber se a pessoa veio da bio, do
  story ou de onde. Se um dia o marcador do link passar a funcionar, entra como
  acréscimo, sem refazer nada.

---

## Como isto fica provado

**Um caminho novo de integração**, no padrão da Frente 2: `pergunta tocada →
contato criado → automação rodando`, com o motor de verdade contra o schema
descartável, e nenhuma requisição saindo da máquina.

E o costume da casa: **plantar defeitos plausíveis e mostrar que morrem**.
Candidatos naturais — o identificador lido do campo errado; a automação achada
por posição em vez de identificador; o contato criado sem a conta certa, que
atravessaria contas.

A suíte pura ganha o que for decisão: ler e validar o identificador da pergunta
é função pura, e mora em `lib/steps.ts`, que não tem nenhum import.

**A tela não ganha teste automático** — a suíte não testa componente, por decisão
do dono. Ela é provada na tela, com o navegador em depuração remota, e o que for
provado ali vira item do roteiro em vez de ressalva no relatório.

---

## O que fica para depois

**O Projeto B — categoria e envio em lote.** Independente deste, e com desenho
próprio. Medido em 26/08: 109 contatos, **13 alcançáveis** — a janela de 24h só
abre quando a pessoa fala, e a Meta proíbe iniciar conversa. O recurso honesto é
"mostrar o número na cara e mandar para quem dá".

**A atribuição**, se a Meta um dia entregar o marcador.

**Reação a mensagem como gatilho.** O campo `message_reactions` **já está
assinado** e já chega — descoberto quando o webhook parou de descartar calado.
Alguém responder sua DM com um coração é um gatilho plausível, e o encanamento já
existe.

---

## Restrições herdadas, que valem aqui

- **`lib/steps.ts` não tem NENHUM import.** Toda decisão pura mora nele.
- **A suíte padrão só testa função pura.** Sem banco, sem mock, sem componente.
  Integração tem comando próprio, e o `verify` não a chama.
- **Três formatos de payload convivem para sempre.** Um botão entregue vive na
  conversa da pessoa indefinidamente.
- **Este Next.js não é o que você conhece.** Ler `node_modules/next/dist/docs/`
  antes de escrever código específico de Next.
- **Em produção, não mexer em automação existente.** Se precisar de uma para
  provar algo, criar nova ou duplicar, e apagar a cópia no fim.
- **A `DATABASE_URL` pode ser usada, nunca impressa.**
- **Perfis de teste:** @imzetti e @alicistica. **@jvsiqueira_ saiu.**
