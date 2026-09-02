# O sinal de "sem categoria" na lista de conversas

**Nascido em:** 02/09/2026, da decisão do dono de deixar a categorização
acontecer organicamente, com o pessoal do marketing marcando ao longo do tempo.
**Estado:** desenho aprovado, pronto para virar plano.

---

## Por que existe

O envio em lote está em produção desde 01/09 e **não tem alvo**: medido em
02/09, `(sem categoria) = 120`, `teste = 12`, `equipe = 1`. O recurso funciona,
foi provado com envio real, e serve para nada enquanto não houver recorte.

**A marcação em massa foi RECUSADA, e a recusa é do dono:** as categorias vão
sendo postas organicamente, pelo marketing, conforme as conversas chegam.
Concordo, e a medição sustenta: ferramenta de marcação em massa existe para
limpar acúmulo, e acúmulo que não vai ser limpo não precisa de ferramenta.
Marcar dentro da conversa — que já existe e já fala — é o instrumento certo
para marcação orgânica, e a categoria decidida lendo a conversa é mais certa
que a decidida olhando uma linha de tabela.

**O problema que sobra é este:** nada na tela indica quais conversas ainda não
foram marcadas. "Orgânico" sem sinal vira "esquecido", e o número já mostra
isso — em um dia, 1 contato marcado de 120.

---

## O desenho

### 1 · A marca fica na segunda linha, no fluxo

`app/conversas/lista.tsx`, segunda linha da conversa, logo depois de
`há 2 h · 5 msgs`, separado pelo mesmo `·` que já separa os outros dois campos.

**O texto é "sem categoria"**, na mesma classe apagada da linha (`muted`), sem
cor de alerta e sem fundo. "Discreto mas não invisível" — pedido do dono, e o
contorno dele é este: legível ao varrer a lista, e nunca competindo com o canto
direito, que continua sendo da contagem de não lidas.

**E ISTO É UMA CORREÇÃO DE MEIO DE DESENHO, registrada porque a primeira
versão estava errada.** A proposta inicial punha a categoria como terceiro
valor de `badgeDaConversa` (`lib/inbox-badge.ts`). Ler o componente mostrou
que aquele enum decide **um canto só** — o da direita da segunda linha, onde
moram a contagem de não lidas e o ponto de "sem resposta". Um terceiro valor
ali forçaria exclusão mútua, e a marca sumiria justamente nas conversas com
mensagem não lida: as mais ativas, as que mais se abre, as que mais importa
marcar.

As duas coisas não disputam espaço, então **não devem disputar decisão**.
`badgeDaConversa` fica intacta.

### 2 · O que conta como "sem categoria" é decisão, e é pura

Não é só `null`. Categoria de espaços em branco tem de contar como AUSENTE —
senão ela marca a conversa como resolvida sem ninguém ter decidido nada.

`normalizarCategoria` (`lib/categorias.ts`) já sabe essa regra e já é usada
pela gravação. A função nova a usa em vez de reinventar, e por isso a leitura
não pode divergir da escrita.

### 3 · O contador do topo usa a MESMA função

O contador vai no cabeçalho de `app/conversas/layout.tsx`, junto do subtítulo
que já explica a regra das 24h — e não dentro da coluna que rola, senão ele
sairia da tela ao descer a lista.

Diz quantas conversas ainda não têm categoria: o número que hoje é 120 e não
aparece em lugar nenhum. **Zero não vira linha:** quando não falta nenhuma, o
contador some em vez de anunciar que não há nada a fazer.

**Mesma função da marca, aplicada à lista inteira.** É o que impede o contador
de dizer 120 enquanto as linhas mostram 119 marcas.

### 4 · A marca aparece em TODAS as conversas sem categoria

Decisão do dono, 02/09: inclusive as 6 que nunca responderam.

### 5 · O que este projeto NÃO faz

- **Nada de filtro "só sem categoria".** Foi sugestão minha e contradiz a
  decisão do dono: filtro serve para varrer acúmulo de uma vez, que é
  exatamente o que marcação orgânica não é. Se daqui a um mês o hábito pegar e
  sobrar resto para varrer, ele se justifica com uso real.
- **Nada de mexer na marcação em si** — `definirCategoria` já funciona e já
  fala (consertada em 02/09).
- **Nada de mexer em `badgeDaConversa`** (ver §1).

---

## Como fica provado

**A regra de "sem categoria" vira função pura, com teste:** `null`, string
vazia, só espaços, e categoria de verdade. E o contador sobre uma lista mista.

**O plantio:** fazer a função aceitar espaços em branco como categoria válida.
Uma conversa marcada com `"   "` deixaria de pedir marcação para sempre, e é
o tipo de defeito que nenhum olho pega numa tela cheia.

---

## Restrições herdadas, que valem aqui

- **A suíte não testa componente.** Toda decisão sai do JSX e vira função pura.
- **`lib/steps.ts` não tem NENHUM import.**
- **`lista.tsx` já é `"use client"`** — e continua sendo, pelo motivo que o
  comentário dela dá (marcar a conversa aberta exige `usePathname`). Nenhum
  componente de cliente NOVO.
- **A janela de 24h tem UMA fonte: `windowState`.**
- **A `DATABASE_URL` pode ser usada, nunca impressa.**
- **Em produção, não mexer em automação existente.**
- **Este Next.js não é o que você conhece.** Ler `node_modules/next/dist/docs/`
  antes de escrever código específico de Next.
