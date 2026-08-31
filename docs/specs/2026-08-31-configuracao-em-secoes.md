# Configuração em seções — a tela para de ensinar o que já foi feito

**Nascido em:** 31/08/2026, de um incômodo do dono: *"é um scroll infinito para
baixo, está muito bagunçado"*. **Estado:** desenho aprovado, pronto para virar
plano.

---

## O que foi medido, antes de propor qualquer coisa

A tela foi aberta em produção, pela depuração remota, com os dados reais do
dono. Não é impressão — são números:

| medida | valor |
|---|---|
| altura da página | **6341 px**, para uma janela de 623 → **10,2 telas** |
| palavras na página | 1882 |
| palavras nas 8 etapas de instalação | **804**, e as oito estão **concluídas** |
| caixas de aviso coloridas | 6 |
| onde começa "Perguntas de abertura" | **3721 px** — a sexta tela |
| altura de "Perguntas de abertura" | **2426 px — 3,9 telas sozinho** |
| contas renderizadas nesse bloco | **4, todas abertas** (16 seletores) |

E o quadro que resume o problema: no topo, a barra diz **"Configuração
concluída — 100%"**; logo abaixo, a tela ensina em quatro passos numerados como
criar o app na Meta do zero.

### O diagnóstico, e por que ele muda a solução

O problema **não é conteúdo demais**. É **instalação concluída ocupando a tela
inteira**, empurrando para a sexta tela as duas coisas que o dono usa toda
semana: as perguntas de abertura e o diagnóstico das contas.

As oito etapas são de uma vez na vida. O resto é uso corrente. A tela trata os
dois com o mesmo peso, na ordem errada.

---

## O desenho

### 1 · A instalação vira um bloco só, que nasce fechado quando terminou

As oito etapas passam a viver dentro de um bloco `Instalação — 8 de 8
concluídas ✓`.

**Ele nasce FECHADO quando tudo está concluído e ABERTO quando falta algo.**
Isto é a regra inteira, e ela protege quem instala pela primeira vez: para essa
pessoa nada muda — ela vê exatamente a tela de hoje, na mesma ordem, com o mesmo
texto. Quem já instalou vê uma linha.

O resumo no cabeçalho do bloco diz **quantas de quantas**, para que fechado não
signifique escondido.

### 2 · A ordem inverte

```
Perguntas de abertura        ← uso corrente, no topo
Diagnóstico das contas       ← uso corrente
▸ Instalação   8 de 8 ✓      ← fechado quando concluído
▸ Status técnico             ← fechado, é consulta
```

### 3 · O bloco de perguntas abre UMA conta por vez

Hoje ele renderiza as quatro contas expandidas, e é isso que o faz ter 3,9
telas. A conta **selecionada** (a do menu lateral) fica aberta; as outras viram
uma linha cada, com a contagem:

```
@vannuchi.eng — 4 perguntas ▸
```

**A contagem fica visível de propósito.** Sem ela, uma conta com perguntas de
teste velhas some da vista — e é exatamente esse o caso aberto hoje: três contas
exibem textos do experimento de 26/08. A linha fechada tem de continuar
denunciando isso.

**O que existe hoje, conferido no código:** `app/setup/portas-de-entrada.tsx`
chama `listAccounts()` e renderiza todas as contas expandidas. Não há noção de
conta selecionada ali. O resto do painel já tem: `getSelectedAccount()`
(`lib/account.ts`) lê um cookie e cai na primeira conta como reserva, e é o que
`app/automacoes` e `app/contatos` usam. A mudança é **passar a usar o que já
existe**, e não inventar um seletor novo nesta tela — o menu lateral continua
sendo o único lugar que troca de conta.

### 4 · Os dois avisos viram uma nota

As caixas "só aparecem no aplicativo do celular" e "só aparecem em conversa
nova" viram **uma nota compacta com as duas frases**.

**O conteúdo não sai.** Os dois avisos estão na especificação das portas de
entrada (`docs/specs/2026-08-26-portas-de-entrada.md`) e continuam verdadeiros:
quem for conferir no computador não vê nada, e quem já conversou nunca mais vê.
O que sai é o peso de duas caixas coloridas de bloco inteiro.

---

## Como isso é construído

### `<details>`/`<summary>` nativos — sem componente de cliente

Nenhum estado, nenhum JavaScript, nenhum `"use client"` novo. O atributo `open`
é calculado **no servidor**, a partir do que a página já tem em mãos (`metaOk`,
`connected`, `hasEvents`).

**Por que isto importa nesta base:** a suíte não testa componente, por decisão
do dono. Toda decisão que mora dentro do JSX fica sem rede — foi medido oito
vezes nesta fase, e sobreviveram plantios em todos os pontos onde uma decisão
estava escrita na tela. Uma sanfona com estado de cliente criaria decisão nova
em JSX. `<details>` não cria nenhuma.

### A decisão sai do JSX e vira função pura

A regra "o que nasce aberto" mora em `app/setup/portas.ts` — arquivo que já
existe, já é puro e já tem teste (`tests/setup-portas.test.ts`).

```
resumoDaInstalacao(etapas) -> { concluidas, total, aberto }
```

`aberto` é **derivado**, nunca escrito à mão: `aberto = concluidas < total`.
Escrever os dois separadamente é o defeito que a Tarefa 4 desta fase já
encontrou uma vez, com `LIGAR_FUNCIONA`.

---

## O que este desenho recusa, e por quê

**Abas no topo.** Arrumariam a tela, mas quebram a sequência das oito etapas
para quem instala pela primeira vez — e essa pessoa é justamente quem tem menos
contexto para se orientar.

**Sanfona em todos os 11 blocos.** Deixaria a página numa tela, ao custo de um
clique para chegar às perguntas de abertura, que é o que o dono mais usa. Trocar
scroll por clique no item mais usado não é ganho.

**Apagar o texto das etapas.** As 804 palavras são úteis exatamente uma vez, e
para quem nunca fez. Fechá-las é diferente de perdê-las.

**Estado lembrado entre visitas.** Guardar "o dono fechou este bloco" exigiria
armazenamento e criaria um estado que discorda da realidade quando a instalação
muda. O `aberto` derivado do estado real sempre conta a verdade.

---

## Como isto fica provado

**O que é decisão ganha teste puro:** `resumoDaInstalacao`, com caso para
instalação completa, incompleta e vazia — e um caso que prende que `aberto` é
derivado, não escrito.

**O que é tela é provado na tela**, com a depuração remota, e vira item de
roteiro em vez de ressalva: a página abre com a instalação fechada; abrir a
instalação mostra as oito etapas na ordem de hoje; com algo faltando ela nasce
aberta; a conta não selecionada aparece como uma linha com a contagem certa.

**A medida de sucesso é numérica, e a mesma que abriu esta especificação:**
a página completa tem de cair de **6341 px** para algo perto de **1500 px** com
tudo concluído — e continuar com as mesmas 6341 px de conteúdo disponíveis a um
clique.

---

## Restrições herdadas, que valem aqui

- **A suíte não testa componente.** Sem banco, sem mock, sem DOM.
- **`lib/steps.ts` não tem NENHUM import.** (Nada aqui mexe nele.)
- **Este Next.js não é o que você conhece.** Ler `node_modules/next/dist/docs/`
  antes de escrever código específico de Next.
- **Em produção, não mexer em automação existente.**
- **A `DATABASE_URL` pode ser usada, nunca impressa.**
- **Nenhuma escrita na Meta** faz parte deste trabalho: a tela já sabe ler e
  gravar perguntas, e este desenho só muda como ela é apresentada.
