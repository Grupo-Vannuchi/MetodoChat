# Gatilho por link — quem chega pelo seu link vira contato

**Data:** 26/08/2026 · **Estado:** desenho aprovado pelo dono, pronto para virar plano.

---

## De onde isto veio, e o que morreu no caminho

O pedido original era **"uma categoria de automação para novos seguidores — o
gatilho é a pessoa clicar em seguir"**.

**Isso não é possível, e a medição é definitiva.** A lista oficial de campos de
webhook do Instagram (Instagram API with Instagram Login), consultada na
documentação da Meta em 26/08, é:

```
comments · live_comments · message_echoes · message_reactions · messages
messaging_handover · messaging_optins · messaging_postbacks
messaging_referral · messaging_seen · standby
```

**Não existe evento de "seguiu".** E a saída óbvia — consultar a lista de
seguidores periodicamente e comparar — também não existe: a API não expõe a
lista de seguidores, só a contagem.

O que a API **sabe** responder é se **uma pessoa específica** segue a conta
(`is_user_follow_business`), e é o que o portão de follow já usa hoje. Mas isso
exige ter o identificador dela, o que só se tem depois que ela fala com você.

### O objetivo real, escolhido pelo dono

Perguntado qual resultado ele queria de fato, ele escolheu: **converter seguidor
novo em contato/lead**.

Isso reformula o problema. Não falta gatilho — já existem três (comentário,
story, mensagem direta) e um seguidor novo pode usar qualquer um deles. **Falta
um caminho fácil**, que não obrigue a pessoa a caçar um post e adivinhar a
palavra-chave certa.

---

## O que este projeto é

**Um quarto tipo de gatilho: `link`.**

Cada automação de gatilho `link` tem um link próprio. O dono o copia e cola onde
quiser — bio, story, post. Quem toca abre a conversa com a conta **carregando a
identificação daquele link**, e a automação certa dispara.

A automação continua sendo automação: mesmo quadro, mesmos blocos, mesma
prévia, mesmas regras de publicar. **Só o gatilho é novo.**

### O que este projeto NÃO é

- **Não é "automação para novos seguidores".** Ninguém é notificado de um
  follow, e este projeto não finge o contrário. Ele cria um caminho pelo qual um
  seguidor novo — ou qualquer pessoa — vira contato.
- **Não são as perguntas de abertura** (*ice breakers*). São um mecanismo
  legítimo e complementar, deixado para depois — ver "O que fica para depois".
- **Não é disparo em massa.** É o Projeto B, com desenho próprio.

---

## Por que o link, e não as perguntas de abertura

As duas foram medidas na documentação da Meta, e as duas funcionam.

| | link com marcador | perguntas de abertura |
|---|---|---|
| onde aparece | onde o dono colar | sozinhas, ao abrir a conversa |
| quantas | ilimitadas | **4 no total, para a conta inteira** |
| granularidade | **por automação** | global |
| desktop | funciona | **não funciona** |
| atribuição | **sabe de onde a pessoa veio** | não distingue |

**Três razões decidiram:**

1. **Encaixa no modelo que existe.** Um quarto gatilho ao lado de três. As
   perguntas de abertura seriam uma configuração global — outro tipo de objeto,
   outra tela, outra lógica.
2. **Serve melhor o objetivo escolhido.** Seguidor novo olha a bio. Um link ali
   é caminho novo; as perguntas só ajudam quem já ia mandar mensagem.
3. **Resolve a atribuição, e é o que falta.** Medido em 26/08: a tabela
   `contacts` tem `last_automation_id` e mais nada sobre origem. Com links
   distintos, cada pessoa chega **com carimbo de onde veio** — o que vira a
   categoria natural do Projeto B, de graça, em vez de classificar 109 pessoas
   à mão.

---

## Como funciona, por dentro

### O encanamento já existe, e isso encolhe o projeto

Medido em `app/api/webhook/route.ts:152-161`: a rota já percorre
`entry.messaging[]` e entrega cada item a `handleMessagingEvent`. **Um evento de
link chega nesse mesmo array**, com um campo `referral` no lugar de `message`.

Não é uma via nova. É um ramo numa via que já está de pé.

### As três mudanças

**1 · Assinar o campo novo.** Hoje `lib/ig.ts:196` assina `comments,messages`.
Passa a assinar também o campo de referral.

**2 · Um ramo em `handleMessagingEvent`.** Quando o evento traz `referral`: lê o
marcador, acha a automação, cria ou atualiza o contato, e começa o fluxo.

**3 · O gatilho na tela.** No painel do gatilho, `link` substitui o campo de
palavra-chave por **o link e um botão de copiar**.

### O marcador é o identificador da automação

E não um apelido novo. Um apelido seria mais um campo a manter único, com tela
de edição e conferência de colisão; o identificador **já é único e já existe**.

**O preço, escrito para não ser descoberto tarde:** o link fica feio, e ele
carrega o identificador interno da automação para quem olhar a URL. Não é
segredo — não dá acesso a nada, e quem tem o link já pode disparar a automação
de qualquer forma. Se um dia o dono quiser link bonito, é uma camada de apelido
por cima, sem mexer nisto.

---

## As decisões de comportamento

**Chegou por link de automação pausada ou apagada.** Não faz nada, e **registra
em Atividade**. É o mesmo tratamento que palavra-chave sem automação recebe
hoje, e a razão é a mesma: o dono precisa poder ver que aconteceu.

**Chegou por link de automação que não pode publicar.** Mesma coisa: a
conferência de ativar já impede que ela esteja no ar.

**A mesma pessoa chega duas vezes pelo mesmo link.** O comportamento existente
vale, e não é decisão deste projeto — mas **qual é ele precisa ser MEDIDO no
plano, não presumido**. O produto já resolve reentrada para os três gatilhos que
tem (o cursor da pessoa, a janela de eventos repetidos, a chave de deduplicação
da fila), e o gatilho novo tem de cair na mesma regra em vez de inventar uma.
Quem escrever o plano mede o que acontece hoje quando a mesma pessoa dispara a
mesma automação duas vezes, e escreve a resposta ali.

---

## O RISCO PRINCIPAL, e ele é honesto

**Não foi possível confirmar se tocar o link, sozinho, já permite enviar.**

As páginas específicas da Meta sobre o payload do referral e sobre o formato do
link responderam **404** nas tentativas de 26/08. O que está confirmado: o campo
de webhook existe (lista oficial) e a forma geral do link é conhecida.

O que falta saber: se o evento de link **abre a janela de mensagem** por si só,
ou se a pessoa ainda precisa enviar alguma coisa.

**Se precisar, o desenho muda:** a automação passa a esperar a primeira mensagem
dela, em vez de começar sozinha. O gatilho continua sendo `link` — o que muda é
o momento do disparo.

> **Esta é a PRIMEIRA coisa a medir no plano, antes de escrever qualquer código.**

**Risco secundário:** assinar um campo novo de webhook pode exigir revisão da
Meta. Também é medição do plano, não suposição.

---

## Como isto fica provado

**Um caminho novo de integração**, no padrão que a Frente 2 estabeleceu:
`link → contato criado → automação rodando`, com o motor de verdade contra o
schema descartável, e nenhuma requisição saindo da máquina.

E o costume da casa, que é o que separa teste de encenação: **plantar defeitos
plausíveis e mostrar que morrem**. Candidatos naturais — o marcador lido do
campo errado; a automação achada por posição em vez de identificador; o contato
criado sem a conta certa (que atravessaria contas).

A suíte pura ganha o que for decisão: ler e validar o marcador é função pura, e
mora em `lib/steps.ts`, que não tem nenhum import.

---

## O que fica para depois

**As perguntas de abertura.** Ficam baratas depois que o encanamento de webhook
existir — é outro campo no mesmo array, e o ramo já estará escrito. Valem por si:
pegam quem abre a conversa por conta própria e não sabe o que dizer.

**O Projeto B — categoria e envio em lote.** Este projeto o alimenta: quem chega
por link chega com origem conhecida.

**Link bonito.** Uma camada de apelido sobre o identificador, se e quando doer.

---

## Restrições que valem aqui, herdadas

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
