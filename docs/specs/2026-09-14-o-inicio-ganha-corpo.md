# O Início ganha corpo

**Nascido em:** 14/09/2026, de uma queixa do dono — *"a página de painel ficou
muito vazia"* — que ao ser medida virou outra coisa, maior.
**Estado:** desenho aprovado pelo dono, pronto para virar plano.

---

## Por que existe

### A queixa estava certa, e o diagnóstico não era o esperado

Medido em produção, no tema escuro, 1366×648:

- conteúdo: **388px** numa janela de 648 — **260px mortos**, 40% da tela
- a barra lateral tem **11 itens**; o conteúdo tinha **3 linhas**
- e a tela **não estava no estado vazio**: havia três pessoas esperando

Ou seja, o problema não é "ela fica vazia quando não há nada" — isso é o desenho
de 10/09 e continua certo. É que **mesmo com conteúdo ela parece desocupada**.

A comparação com `/desempenho` fecha o argumento: aquela tela tem quatro cartões,
um gráfico e um rodapé de contexto. **A tela de alta frequência ficou magra e a de
baixa frequência ficou gorda.** O Início se abre dez vezes por dia; o Desempenho,
uma vez por semana.

E o estado vazio, que justificou o desenho, quase nunca acontece: a conta tem 3 a
5 janelas abertas o tempo todo. Otimizamos para um desfecho celebratório que a
medição não encontra.

### O que a medição achou de verdade, e é o motivo real desta spec

Contando os comentários dos últimos 7 dias contra as automações ativas:

| | comentários em 7 dias |
|---|---:|
| em post **SEM** automação ativa | **331** |
| em post com automação ativa | **1** |

Doze posts receberam comentário. **Nenhum deles tem automação.** O maior recebeu
**100 comentários** e ninguém recebeu nada de volta.

Não é defeito: o motor está certo, e não responde porque não há nada escutando
naqueles posts. As 21 automações ativas estão presas a carrosséis antigos — a que
disparou mais recentemente foi em **08/09**, seis dias atrás.

**É uso, e o painel não diz.** Ele mostra *"Automações ativas: 21"* e *"Na fila:
0"*, que lidos juntos parecem saúde. Cem pessoas comentando sem resposta é
dinheiro na mesa, e nenhuma tela do produto conta isso.

---

## A tese do desenho

**O Início pergunta "o que precisa de mim agora?", e a resposta tem TRÊS formas,
não uma.** Hoje o produto só conta duas:

1. **alguém esperando** — a janela de 24h correndo
2. **alguma coisa quebrada** — falha de envio ou de publicação
3. **oportunidade escapando** — comentário chegando onde não há automação ← a
   forma nova, e a de maior volume

E a tela se organiza como uma **linha do tempo curta em torno de agora**: o que
pede ação, o que vem adiante, o que ficou atrás. O pulso é a prova de que o
relógio anda.

```
Início                                    [Criar post]  [Nova automação]
@thiagovannuchi

  nada entregue hoje · última há 3 dias · fila vazia          ← o pulso

  PRECISA DE VOCÊ
  ▸ 100 comentários sem automação      último há 2h   [Criar automação]
  ▸ @n8xmarketing     esperando resposta              fecha em 21h47
  ▸ @vitoriamalafati_ esperando resposta              fecha em 23h04

  ┌─ ADIANTE ──────────────┐  ┌─ NAS ÚLTIMAS 24H ────────┐
  │ Nada agendado.         │  │ 22 comentários            │
  │ Criar post →           │  │ 13 mensagens · 3 enviadas │
  └────────────────────────┘  │ Ver a atividade →         │
                              └───────────────────────────┘
```

**Por que isto não ressuscita o amontoado que a auditoria de 10/09 desmontou:**
lá eram quatro números e um gráfico competindo sem hierarquia. Aqui há espinha —
**ação em largura total no topo, contexto em duas colunas embaixo** — e o que
desceu para as colunas é resumo com link, nunca a lista inteira.

---

## O desenho, bloco a bloco

### 1 · O pulso

Uma linha, sempre visível, logo abaixo do cabeçalho. Três fatos com carimbo de
hora:

> **nada entregue hoje · última entrega há 3 dias · fila vazia**

Com movimento, lê-se *"4 entregues hoje · última há 12 min · fila vazia"*.

**POR QUE FATO E NÃO CONTAGEM PARADA:** "21 automações ativas" continuaria 21 com
tudo quebrado — foi exatamente o que aconteceu nos últimos seis dias. "Última
entrega há 3 dias" denuncia sozinha, sem ninguém precisar comparar nada.

**ELE APARECE SEMPRE, inclusive quando está tudo bem.** Silêncio não serve como
resposta para "está rodando?": silêncio é também o que aparece quando a própria
medição quebrou. A linha positiva é o que distingue as duas coisas.

`hoje` é o dia em **America/Sao_Paulo**, não em UTC — o servidor roda em UTC e
"hoje" é uma pergunta do fuso de quem lê. A mesma disciplina de
`hojeNoFusoDoPrazo` (`lib/lote.ts`).

### 2 · Precisa de você — agora com três tipos de linha

A lista continua saindo de `oQuePrecisaDeVoce` (`lib/precisa-de-voce.ts`), que
ganha um quarto fato de entrada: as oportunidades.

**A ORDEM, e ela estende a regra que já está escrita lá** — vem primeiro o que
desaparece se ninguém agir:

1. conversa com menos de `HORAS_QUE_TORNAM_URGENTE`
2. **oportunidade: post recebendo comentário sem automação** ← nova
3. publicação que não saiu
4. mensagem que não saiu
5. conversa com o dia pela frente
6. o convite de criar automação, quando não há nenhuma

A oportunidade entra **acima das falhas** e **abaixo da conversa apertada**.
Justificativa: a conversa apertada expira por relógio em minutos; a oportunidade
cresce a cada hora (o post continua recebendo comentário) mas não vira zero de
uma vez; a publicação que falhou já falhou e continuará falhada.

**O CORTE:** no máximo **3** oportunidades, e só posts com **5 ou mais**
comentários nos últimos **7 dias**. Sem piso, um comentário perdido num post
antigo vira linha e a tela de chamados vira ruído — medido: com piso 1 seriam 12
linhas; com piso 5, três.

**COMO A LINHA NOMEIA O POST, e por que não pelo nome:** o payload do webhook traz
só `media.id`; legenda e miniatura exigiriam chamar a API do Instagram durante o
render. **Isso está recusado**: é a tela de maior frequência do painel, e uma
chamada externa no caminho dela é a doença de 09/09 por outra porta — API lenta ou
fora do ar derruba o Início inteiro. A linha diz o que sabe sem sair de casa:

> **100 comentários sem automação** · último há 2h

Qual post é, quem vai ver é a tela seguinte.

### 3 · O post atravessa para a automação nova

O botão da linha leva a `/automacoes/nova?post=<media_id>`, e o `media_id` é
gravado na automação criada.

**ISTO NÃO É ENFEITE:** sem ele, quem clica em "100 comentários sem automação"
cai num formulário que não sabe de qual post se trata, e precisa reencontrá-lo
no editor. A linha perderia a ação e viraria aviso.

O custo é pequeno e a coluna já existe: `automations.media_id` está no esquema e
`criarAutomacao` (`app/automacoes/actions.ts`) simplesmente não a preenche.
Entram um campo escondido no formulário e o valor no `insert`.

**O `media_id` é validado como dígito antes de ir ao banco** — ele vem da URL, e
URL é digitável. Fora do formato, é ignorado: a automação nasce sem post, que é o
comportamento de hoje.

### 4 · Adiante

Coluna esquerda. As próximas publicações agendadas, com dia e hora, no máximo
três.

**HOJE ELA NASCE VAZIA, e isso foi medido:** não há nenhum item pendente na fila,
de nenhum tipo. Então o estado vazio não é exceção — é o estado comum, e tem de
ser bom:

> **Nada agendado.** · *Criar post →*

Convite, não buraco. Mesma disciplina do estado calmo do Início.

### 5 · Nas últimas 24h

Coluna direita. Três números e um link:

> **22 comentários · 13 mensagens · 3 respostas enviadas** — *Ver a atividade →*

**AS FONTES SÃO DECLARADAS AQUI para ninguém "consertar" uma duplicação que não
existe.** O pulso (§1) e esta coluna parecem falar da mesma coisa e não falam:

| | assunto | fonte |
|---|---|---|
| **pulso** | a MÁQUINA | `queue` — o que a fila entregou |
| **24h** | o MOVIMENTO da conta | `events` — o que entrou, e o que saiu por qualquer caminho |

"3 respostas enviadas" conta `message_sent`, que `lib/engine.ts` grava para TODO
envio do sistema — **inclusive a resposta que alguém do marketing digitou na tela
de conversa.** Por isso os dois números divergem de propósito, e hoje divergem: a
fila entregou **zero** e houve **três** respostas. Lidos juntos, dizem a coisa
certa — *ninguém foi respondido pela automação, e três pessoas foram respondidas
à mão.* É exatamente o retrato desta semana.

**NÚMEROS, NUNCA O FEED.** `/eventos` existe, faz isso melhor, e repetir a lista
aqui seria manter duas telas dizendo a mesma coisa — com a garantia de que um dia
vão discordar. O que esta coluna responde é "aconteceu alguma coisa enquanto eu
dormia?", e para isso três números bastam.

### 6 · Os atalhos

**Criar post** e **Nova automação**, no cabeçalho, à direita do título — onde hoje
mora o "Reconectar".

**O "Reconectar" SAI DO LUGAR DE HONRA.** Conferido em `app/page.tsx:158`: ele é
renderizado SEMPRE que existe conta — não é condicional a problema nenhum. É o
único botão da tela hoje, e anuncia avaria numa conta conectada e saudável. Vai para junto do
`@usuário`, discreto, e volta a ter destaque só quando o token estiver perto de
vencer — informação que `/desempenho` já mostra ("acesso renovado automaticamente
até 10/11/2026").

---

## O que NÃO entra, declarado

- **Responder pelo Início.** Foi oferecido e recusado: a tela continua mandando
  para a conversa. Caixa de entrada é outra tela e outro desenho.
- **O gráfico de volta.** Ele respondeu "está funcionando?" e tem casa em
  `/desempenho`. O pulso responde "está rodando AGORA?", que é outra pergunta.
- **Chamar a API do Instagram no render.** §2, com o motivo.
- **Consertar as 21 automações presas a carrosséis mortos.** O painel passa a
  DIZER que os comentários estão caindo fora; o que fazer com isso é decisão do
  marketing, não do software.
- **Mudar `/desempenho`.** Ele fica como está.

---

## Testes

**Puros** (`tests/precisa-de-voce.test.ts`, que já existe, e um arquivo novo para
o pulso):
- a oportunidade entra abaixo da conversa urgente e acima da falha de publicação
- o piso de 5 comentários corta, e o teto de 3 corta — com dados que distinguem
  os dois cortes (um caso com 4 posts acima do piso prova o teto; um com posts de
  4 e 5 comentários prova o piso)
- singular e plural de "comentário(s)" e de cada número do pulso
- o pulso com zero entregas hoje diz "nada entregue hoje", e não "0 entregues"
- "hoje" no fuso de São Paulo: um envio às 23h de Brasília conta como hoje mesmo
  sendo 02h de UTC do dia seguinte — é o caso que prende o fuso

**Integração** (`testes-integracao/`):
- a consulta das oportunidades não conta post que TEM automação ativa — semear os
  dois e conferir que só um aparece
- ela respeita `account_id`: comentário da conta vizinha não entra
- `criarAutomacao` com `post=<id>` grava `media_id`; com `post` fora do formato,
  grava nulo e não falha

**Plantio obrigatório:** trocar o piso por 1, trocar o teto por 10, tirar o
`account_id` da consulta das oportunidades, e trocar o fuso do "hoje" por UTC. Os
quatro têm de matar um caso.

---

## Risco declarado

Esta tela passa de 1 consulta a 4 (oportunidades, adiante, 24h, pulso), e é a de
maior frequência do painel. **Nenhuma delas pode derrubar o resto**: cada bloco
falha sozinho e some, como `urlPublicaSeDerParaMontar` já faz em
`/publicar` — a tela que perde uma coluna continua servindo, a que devolve 500 com
corpo vazio não.
