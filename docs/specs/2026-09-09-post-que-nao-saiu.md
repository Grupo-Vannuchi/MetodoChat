# O post que não saiu precisa aparecer

**Nascido em:** 09/09/2026, depois de a equipe de marketing começar a agendar
conteúdo real pelo painel. Pedido do dono: *"precisamos ser avisados no painel
primeiramente. futuramente fazemos a adição de se comunicar pelo whatsapp
também"*.
**Estado:** desenho aprovado, pronto para virar plano.

---

## O que foi medido

| pergunta | resposta hoje |
|---|---|
| post que falha aparece na tela de agendados? | **NÃO** — a consulta filtra `status = 'pending'` (`app/publicar/agendados/page.tsx:95`); ele SOME da lista |
| o painel inicial avisa? | sim, mas chama de **"mensagem não saiu"** — inclusive quando é publicação (`app/page.tsx:161`) |
| por quanto tempo? | **24 horas.** Falha na sexta à noite some antes de alguém abrir na segunda |
| existe canal externo de aviso? | **nenhum** — quatro dependências de produção, nenhuma de e-mail ou mensagem |
| quantas falhas na vida do produto? | **2**, ambas do mesmo incidente em 28/08. Zero publicações falhadas até agora |

**O que mudou não foi a frequência — foi a consequência.** Enquanto era o dono
usando, uma DM que não saía era uma pessoa sem resposta, e ele estava olhando.
Com o marketing agendando conteúdo real, um post que falha numa sexta à noite é
um lançamento que não aconteceu, e ninguém está de plantão.

**E a especificação de 03/09 recusou aviso de propósito**, com um motivo que
continua bom: mandar DM de aviso exige janela de 24h aberta, e um aviso que pode
falhar calado é a doença que esta base passou a semana curando. Este projeto
**não reabre essa porta** — ele faz o painel dizer, que é o que foi pedido.

---

## O desenho

### 1 · O post que falhou não some da tela de agendados

`/publicar/agendados` ganha uma segunda seção — **"Não saíram"** — com as
publicações `failed` da conta: quando deveriam ter saído, a forma, o começo da
legenda, e **o motivo escrito** que o dreno gravou em `error`.

**Sem limite de tempo nesta tela.** É a tela para onde se vai procurar, e uma
falha antiga sumindo daqui é o mesmo defeito por outro caminho. Elas são raras —
duas em dois meses —, então a lista não cresce.

**RECUSADO reaproveitar a seção existente.** Agendado e falhado são estados
diferentes com ações diferentes: um se cancela ou remarca, o outro não tem o que
cancelar. Misturá-los faria a mesma lista significar duas coisas — o mesmo erro
que a tela de Envios cometia com a coluna de data, e que consertamos ontem.

### 2 · O painel inicial para de chamar publicação de mensagem

`app/page.tsx` conta as duas coisas separado e escreve o que cada uma é:
*"1 publicação não saiu"* é fato diferente de *"1 mensagem não saiu"*, e a ação
que resolve cada uma mora em tela diferente — a publicação em
`/publicar/agendados`, a mensagem em `/eventos`.

### 3 · O prazo da publicação é de 7 dias, e o número tem motivo

Mensagem continua com as 24 horas de hoje — o comportamento não muda.

**Publicação passa a 7 dias**, e o número não é gosto: o modo de falha declarado
pelo dono é *"falha na sexta à noite, ninguém vê até segunda"*. Vinte e quatro
horas não cobrem um fim de semana; sete dias cobrem com folga, e ainda param de
incomodar quando a falha já é história.

**RECUSADO "para sempre".** Um aviso vermelho por um post que falhou há três
meses e já foi republicado à mão é ruído — e ruído numa tela de diagnóstico
ensina a ignorá-la, que é exatamente o argumento escrito em `app/labels.ts`
sobre a confirmação de leitura.

**E RECUSADO botão de dispensar**, que seria a alternativa: exige coluna nova,
ação nova e mais uma saída que não pode ser muda, para um evento que aconteceu
duas vezes em dois meses.

### 4 · O que este projeto NÃO faz

- **Não manda WhatsApp.** Pedido do dono para depois, e é projeto próprio: o
  WhatsApp Business exige aplicativo, número e modelos aprovados pela Meta.
- **Não manda e-mail nem DM.** Ver a recusa de 03/09.
- **Não oferece "tentar de novo".** O arquivo continua no bucket e o `payload`
  tem tudo, então é barato — mas é ação nova de escrita, com todas as regras de
  saída muda, e ninguém pediu. Fica registrado como possível.
- **Não muda o comportamento de mensagem** em lugar nenhum.

---

## Como isto fica provado

**As decisões viram funções puras, com teste:** o que a tela mostra para um item
falhado, a frase do aviso do painel para cada mistura de publicação e mensagem,
e a janela de tempo de cada tipo.

**O caminho de integração**, no molde de `agendados.integracao.ts`: uma
publicação `failed` aparece na seção certa com o motivo; uma `pending` continua
na seção de agendados e **não** aparece na de falhadas; uma falha de outra conta
não aparece; e uma falha de 8 dias atrás sai do aviso do painel mas **continua**
na tela de agendados.

**O plantio de sempre:** a consulta das falhadas sem `account_id`, a janela de 7
dias virando 24h, e a frase de publicação virando a de mensagem.

---

## Restrições herdadas, que valem aqui

- **A suíte não testa componente.** Toda decisão sai do JSX e vira função pura.
- **Nenhum `"use client"` novo.**
- **Nenhuma ação de servidor pode ter saída muda** — e este projeto não cria
  ação nenhuma, só leitura.
- **A conta vem do cookie, nunca do formulário.**
- **`lib/steps.ts` não tem NENHUM import.** Nenhuma migração.
- **A `DATABASE_URL` e a `SUPABASE_SERVICE_ROLE_KEY` podem ser usadas, nunca
  impressas.**
