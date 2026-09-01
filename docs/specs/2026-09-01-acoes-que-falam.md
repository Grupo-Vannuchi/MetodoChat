# As ações que falam — o painel para de engolir calado o que recusou

**Nascido em:** 01/09/2026, à noite, do teste do envio em lote. O dono mandou o
lote, funcionou, e sentiu falta da confirmação. A medição mostrou que o buraco
é maior do que a confirmação que faltava.
**Estado:** desenho aprovado, pronto para virar plano.

---

## O que foi medido

`enviarLote` tem **cinco saídas mudas**, e três delas são RECUSAS:

| linha | o que acontece | o que a tela mostra |
|---|---|---|
| `if (!account) return` | nenhuma conta selecionada | recarrega igual |
| `if (!texto) return` | não mandou nada | recarrega igual |
| `if (url && !urlDeLoteValida(url)) return` | **link torto barra o lote inteiro** | recarrega igual |
| `if (!alvo.length) return` | ninguém alcançado, ou confirmação não marcada | recarrega igual |
| caminho de sucesso | as mensagens saíram | recarrega igual |

**Sucesso e recusa são indistinguíveis.** Quem digita um endereço malformado vai
embora achando que mandou.

A varredura da base inteira encontrou o mesmo padrão em mais quatro ações:

| ação | tela | retornos mudos |
|---|---|---|
| `enviarLote` | `/contatos` | 5, inclusive o sucesso |
| `atualizarPerfis` | `/contatos` | 1, e nenhum sinal de sucesso |
| `definirCategoria` | `/conversas/[id]` | 2, e nenhum sinal de sucesso |
| `deleteAutomation` | `/automacoes` | 1 |
| `duplicateAutomation` | `/automacoes` | 2 |

**E encontrou que a maior parte da base JÁ FALA**, o que decide o desenho: as
cinco ações de `/setup` usam `redirect("?erro=" | "?salvo=")`, e
`salvarAutomacao`, `criarAutomacao`, `toggleAutomation` e `sendReply` devolvem
`{ ok, erro }` para `useActionState`. Não há mecanismo a inventar — há duas
mecânicas existentes a estender para quem ficou de fora.

---

## O desenho

### 1 · Duas mecânicas, escolhidas pela superfície e não por gosto

**Componente de servidor com form nativo** (`/contatos`, `/conversas/[id]`):
`redirect` com parâmetro de busca, no molde de `app/setup/actions.ts`. Nenhum
componente de cliente novo, nenhum estado — que é o que estas telas escolheram
de propósito (`<details>` nativo, zero JavaScript).

**Componente de cliente que já tem estado** (`/automacoes`):
`deleteAutomation` e `duplicateAutomation` passam a devolver `Resultado`, o
MESMO tipo que `toggleAutomation` já devolve no mesmo arquivo, e
`list-client.tsx` mostra o erro onde já mostra o de `toggleAutomation`.

**RECUSADO unificar as duas numa só.** Seria mais bonito e custaria um
componente de cliente em duas telas que hoje não têm nenhum, para resolver um
problema que a base já resolveu de dois jeitos que funcionam.

### 2 · O aviso do lote diz o repartimento, e não "enviado"

```
✓ 3 receberam agora · 0 guardadas para quando voltarem a falar
```

**O número NÃO pode vir do retorno de `drainQueue`**, e isto é a decisão técnica
central desta parte: ela drena a fila inteira, então contaria itens de outros
envios que por acaso saíram no mesmo dreno. Tem de ser uma consulta pelos itens
do PRÓPRIO lote, pelo identificador que `enqueueLote` já gera e hoje é
descartado — `crypto.randomUUID()` em `app/contatos/actions.ts`.

### 3 · A recusa diz o motivo, não "falhou"

Cada uma das saídas mudas ganha uma frase que nomeia o que fazer:

- sem conta: "Conecte uma conta do Instagram primeiro."
- sem texto: "Escreva a mensagem antes de mandar."
- link torto: "O endereço do botão não é uma URL válida — confira e mande de novo."
- ninguém alcançado: "Ninguém nesta categoria; nada foi enfileirado."
- sem confirmação: "Marque a confirmação antes de mandar."

**"Ninguém alcançado" e "sem confirmação" são motivos DIFERENTES e hoje saem
pela mesma linha** (`if (!alvo.length)`). `alvoDoLote` já distingue os dois
casos internamente; o aviso exige que essa distinção chegue a quem chamou.

### 4 · Duas ações continuam mudas, DE PROPÓSITO

- **`selectAccount`** — o `if (!id) return` é guarda de formulário malformado, e
  o resultado da ação já é visível: a conta troca na tela.
- **`marcarVisto`** — escrituração de fundo, disparada a cada abertura de
  conversa e a cada 30 segundos pelo laço de `conversas/layout.tsx`. Um aviso
  ali tocaria sozinho o dia inteiro.

Isto fica ESCRITO no código, com o motivo, para a próxima varredura não as
tratar como esquecimento.

### 5 · O que este projeto NÃO faz

- Não mexe em quem já fala (as cinco de `/setup`, as quatro de `{ ok, erro }`).
- Não inventa componente de notificação flutuante, nem biblioteca.
- Não muda o que qualquer ação FAZ — só o que ela CONTA.

---

## As três armadilhas, ditas antes de começar

1. **O `?categoria=` tem de sobreviver ao redirect.** `?categoria=` ausente e
   `?categoria=` presente-e-vazio são pedidos diferentes — foi o Crítico que a
   revisão final pegou hoje. O redirect que monta a URL de volta TEM de usar
   `urlComFiltro` (`lib/categorias.ts`), e não concatenação nova.
2. **`redirect()` funciona lançando.** `enviarLote` tem um
   `try { await drainQueue() } catch {}` que engole tudo; um `redirect` dentro
   dele seria engolido junto. O aviso tem de sair FORA desse bloco.
3. **O aviso não pode virar mentira.** "3 receberam agora" só é verdade se
   medido depois do dreno, pelos itens do próprio lote.

---

## Como isto fica provado

**As mensagens viram função pura, com teste:** qual aviso corresponde a qual
recusa, e como o repartimento do lote vira frase. Nada de texto solto no JSX.

**O plantio de sempre:** trocar o aviso de sucesso pelo de recusa, apagar a
distinção entre "ninguém alcançado" e "sem confirmação", e — o mais importante —
fazer o redirect perder o `?categoria=`, que é o Crítico de hoje voltando por
uma porta nova.

---

## Restrições herdadas, que valem aqui

- **A suíte não testa componente.** Toda decisão sai do JSX e vira função pura.
- **`lib/steps.ts` não tem NENHUM import.**
- **Nenhum `"use client"` novo** em `/contatos` nem em `/conversas/[id]`.
- **A `DATABASE_URL` pode ser usada, nunca impressa.**
- **Em produção, não mexer em automação existente.**
- **Este Next.js não é o que você conhece.** Ler `node_modules/next/dist/docs/`
  antes de escrever código específico de Next.
