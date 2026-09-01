# Envio em lote por categoria — a mensagem que espera a janela abrir

**Nascido em:** 01/09/2026, do "Projeto B" adiado em 26/08 e partido em dois em
31/08. A parte 1 (categoria do contato) está no ar desde hoje de manhã.
**Estado:** desenho aprovado, pronto para virar plano.

---

## O que foi medido, e como isso desenhou a solução

O pedido original era **disparo em massa**. Duas medições já o tinham
reformulado: a Meta proíbe iniciar conversa, e a janela de 24 horas só abre
quando a pessoa fala. Em produção, hoje: **126 contatos, 9 alcançáveis (7,1%)**,
com duas das quatro contas em **zero**.

Um botão que alcança 7% não é funcionalidade. A pergunta virou: **dá para
alcançar mais sem sair da regra?**

### A medição que respondeu

| medida | valor |
|---|---|
| itens que a janela já descartou, na vida inteira | **6** |
| intervalos entre mensagens da mesma pessoa | 961 |
| — até 24h (a janela nem chega a fechar) | **817 — 85%** |
| — de 1 a 3 dias | 96 |
| — de 3 a 7 dias | 37 |
| — mais de 7 dias | 11 |
| mediana do intervalo | **0,1 hora** |
| pessoas que já falaram | 120 |
| — que falaram **uma única vez** | **48 — 40%** |

**Quem volta, volta rápido.** A maioria em menos de um dia; quase tudo em três.
Guardar a mensagem e soltá-la quando a pessoa voltar converte 7% de alcance
imediato em algo entre **metade e dois terços** da categoria.

**Não é "quase 100%".** Era otimismo meu na conversa anterior, e a medição o
derrubou: 40% falaram uma vez e nunca mais. Para esses, a mensagem guardada
nunca sai.

**E é por isso que a validade existe.** Uma mensagem pode ficar guardada semanas.
Se for "a turma nova abre segunda", chegar três semanas atrasada é **pior** que
não chegar.

### A verificação que autorizou o desenho

O dreno da fila já roda **dentro do webhook** (`app/api/webhook/route.ts`, no
`after()`), e o `last_reply_at` do contato é gravado **antes** disso, durante o
processamento do evento (`lib/engine.ts`, `upsertContact`).

**Conferido nesta ordem, e ela é o que faz o desenho funcionar:** quando a
pessoa escreve, a janela dela abre e o dreno roda em seguida. Um item guardado
encontra a janela aberta sem precisar de relógio, de tarefa agendada, nem de
mecanismo novo.

---

## O desenho

### 1 · O que é um lote

Um **texto**, com **link e botão opcionais**, endereçado a uma **categoria**,
com uma **validade**.

**A validade existe sempre**, e "sem prazo" é um valor dela. O dono pediu os dois
usos — aviso com prazo ("a turma abre segunda") e conteúdo que não vence ("segue
o material") —, e um mecanismo só serve aos dois. Dois mecanismos seriam duas
coisas para manter iguais.

**RECUSADO disparar uma automação inteira.** Escolher uma automação já montada e
rodá-la para a categoria seria muito mais poderoso — e o fluxo tem passos que
esperam resposta, portão de follow, botões. Começar quarenta fluxos de uma vez é
comportamento que ninguém mediu. Fica para projeto próprio, se um dia.

### 2 · Quem está alcançável recebe na hora

Os itens entram na fila como qualquer outro envio e o dreno os manda. **Nada
novo:** a fila já sabe entregar texto com link e botão.

### 3 · Quem não está, ESPERA — e é só isto que muda no motor

Hoje, `lib/queue-drain.ts` faz:

```
} else {
  await finish(item.id, { status: "skipped", error: "janela de 24h fechada" });
}
```

Item fora da janela é **descartado**. Para o lote, ele passa a ficar `pending`.

**A máquina de esperar já existe e já é usada:** o caminho de erro, dez linhas
abaixo, usa `status: "pending", retryInSeconds: 120`, e `finish` já sabe mexer no
`not_before`. Não há mecanismo novo — há uma decisão nova sobre um mecanismo
existente.

**A ESPERA É SÓ PARA LOTE, e isso é deliberado.** Item de automação continua
sendo descartado ao perder a janela. Motivo medido: a janela descartou **6 itens
na vida inteira** do produto, e quase sempre porque a automação disparou para
alguém cuja conversa já tinha esfriado. Fazer esses esperarem entregaria uma
boas-vindas dias depois, fora de contexto — mudança de comportamento que ninguém
pediu, num caminho que já funciona.

### 4 · Só o mais recente espera

Um lote novo **cancela** o que estava guardado para aquela pessoa.

**O que se perde:** o aviso de segunda nunca chega para quem só voltou no sábado.
**O que se evita:** a pessoa diz "oi" depois de uma semana e leva três mensagens
seguidas de uma conta que ficou muda — o comportamento que faz gente bloquear
perfil, e que a Meta observa.

### 5 · Passou a validade, cancela

O item guardado **não vira mensagem atrasada**. Ele é encerrado com o motivo
escrito, e aparece assim na tela de envios — que já existe e já mostra motivo de
item pulado.

### 6 · Compõe-se em `/contatos`, com o filtro ativo

É onde o dono já está vendo **quem** e **quantos**. A tela diz, antes de
confirmar:

```
40 pessoas em "interessado"
   3 recebem agora
  21 quando voltarem a falar
  16 provavelmente nunca — falaram uma única vez
```

**Os dois primeiros números são fato; o terceiro é palpite, e a tela tem de
dizer isso.** "Recebem agora" é `windowState` — a mesma função que o motor usa
para recusar. "Quando voltarem" é o resto. Já o "provavelmente nunca" conta quem
tem **uma única mensagem recebida** em todo o histórico, e isso é uma
heurística: a pessoa pode voltar amanhã. Ela vale porque o número é grande (48
de 120 hoje) e porque some se ninguém contar — mas a palavra "provavelmente"
tem de aparecer na tela, e o número **não** pode ser subtraído dos outros dois
como se fosse certo.

**E há confirmação antes de enfileirar.** Quarenta mensagens não se desfazem.

### 7 · O que este projeto NÃO faz

- Não dispara automação (ver 1).
- Não muda o comportamento de nenhum envio que já existe (ver 3).
- Não inventa agendamento: não há "mandar na terça às 9h". O lote sai agora para
  quem dá, e espera para o resto.

---

## O que muda no banco

Um tipo novo em `queue_kind_check` (`migrations/004` é o precedente: ela já
reescreveu essa restrição uma vez, de 5 tipos para 9).

**E NENHUMA TABELA NOVA**, decidido aqui e não adiado para o plano.

Um lote é N itens de fila que compartilham um identificador de lote no
`payload`, e cada item carrega o texto, o link e a validade. As duas coisas que
pareciam exigir uma tabela não exigem:

- **"só o mais recente espera"** é uma consulta sobre `queue` por conta, contato,
  tipo e `status = 'pending'` — a tabela de lotes não participaria dela;
- **a validade** é lida do `payload` que o dreno já lê para montar a mensagem.

O custo é o texto repetido em quarenta linhas, de algumas centenas de bytes.
O que se evita é uma junção nova dentro do dreno — que roda **dentro do
webhook** — e uma tabela cujo ciclo de vida ninguém pediu.

---

## O que este projeto arrisca, dito antes de começar

**É o primeiro que manda mensagem para muita gente de uma vez.** Tudo no produto
até aqui responde a alguém que falou primeiro. Isso muda o que um defeito custa:
um erro aqui não é uma mensagem errada, são quarenta — e elas saem do perfil de
verdade, para clientes de verdade.

Três consequências para o plano:

1. **A confirmação não é enfeite.** Ela é a última coisa entre um engano e
   quarenta pessoas.
2. **O que decide QUEM recebe é a peça mais perigosa**, e vai para função pura
   com teste — a categoria certa, a conta certa, a janela certa.
3. **Nada de disparo real em cliente.** Instrução do dono, 01/09/2026: o teste
   com envio de verdade usa as contas conectadas mandando mensagem entre si, e
   nunca um contato de cliente. A suíte de integração exercita o dreno contra o
   servidor local que já existe (`testes-integracao/portao-link`), e nenhuma
   requisição sai da máquina.

---

## Como isto fica provado

**As decisões viram funções puras, com teste:** quem entra no lote, quantos
recebem agora contra quantos esperam, se um item guardado ainda vale ou já
expirou, e qual guardado é cancelado por um lote novo.

**O motor ganha caso de integração**, no padrão da Frente 2: enfileirar um lote
com a janela fechada, confirmar que o item fica `pending` e **não** `skipped`;
abrir a janela; drenar; confirmar que saiu. E o inverso: item de automação na
mesma situação continua sendo descartado.

**E o plantio de sempre:** os candidatos naturais são o item de lote virando
`skipped` de novo, o lote alcançando contato de outra conta, a validade nunca
expirando, e o "só o mais recente" deixando dois guardados.

### A PROVA COM ENVIO REAL NÃO TOCA EM CLIENTE — instrução do dono, 01/09/2026

**Nenhum disparo de teste vai para contato de cliente.** O teste usa as contas
conectadas mandando mensagem entre si.

**A base existe, e o dono a preparou:** em 01/09 ele mandou mensagem entre as
quatro contas de propósito, para deixá-las ativas. Medido logo depois:

| medida | valor |
|---|---|
| pares de contas com registro de contato | **12** — malha completa: cada conta tem as outras três |
| janelas abertas | **12 de 12** (última resposta há 0,0 a 0,1 h) |
| perfis de teste com janela aberta | `@alicistica` em `@n8xmarketing` (15,6 h) |

**Isso dá as duas metades do teste, em momentos diferentes, e de graça:** com as
janelas abertas prova-se o caminho "recebe agora"; **passadas 24 horas elas
fecham sozinhas**, e aí prova-se o caminho "espera". O dono reabre quando
precisar, mandando mensagem de novo.

**A limitação que continua valendo:** para abrir uma janela, a mensagem tem de
vir **de fora** — o painel só responde DENTRO de uma janela aberta
(`queue-drain` recusa o resto), então ele não consegue abrir a própria janela.
Abrir exige o aplicativo do Instagram, ou seja, o dono. Foi assim que estas doze
foram abertas.

Consequência para o plano, e ela decide o esforço:

- **O mecanismo inteiro é provado na suíte de integração**, sem mandar nada:
  ela controla o banco e a Meta falsa (`testes-integracao/portao-link` é o
  precedente). Enfileirar com janela fechada, conferir que fica `pending`;
  mexer no `last_reply_at`; drenar; conferir que saiu. **Isto não precisa do
  dono e cobre a lógica toda.**
- **A entrega de verdade é provada com UM envio**, de uma conta para outra, e
  precisa do dono só se a janela estiver fechada na hora. Enquanto
  `@n8xmarketing` ← `@alicistica` estiver aberta, dá para provar o caminho
  "recebe agora" sem pedir nada a ninguém.
- **O caminho "espera e sai depois"** precisa de uma mensagem chegando pelo
  aplicativo. É o mesmo tipo de prova que o toque na pergunta de abertura exigiu
  em 28/08, e ela vale o pedido: é a única que mostra o recurso funcionando como
  a pessoa do outro lado o veria.

---

## Restrições herdadas, que valem aqui

- **A suíte não testa componente.** Toda decisão sai do JSX e vira função pura.
- **A janela de 24h tem UMA fonte: `windowState`** (`lib/inbox-window.ts`) — a
  mesma que o motor usa para recusar. Nenhum SQL de 24 horas cravado.
- **`lib/steps.ts` não tem NENHUM import.**
- **Migração é imutável depois de aplicada** — `schema_migrations` recusa arquivo
  editado; mudança é arquivo NOVO.
- **A migração roda no build, ANTES de o código novo entrar no ar.** Mudança que
  o código antigo não tolera vai em DOIS deploys.
- **Em produção, não mexer em automação existente.**
- **A `DATABASE_URL` pode ser usada, nunca impressa.**
- **Este Next.js não é o que você conhece.** Ler `node_modules/next/dist/docs/`
  antes de escrever código específico de Next.
