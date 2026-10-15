# A hora marcada da publicação

**Nascido em:** 15/10/2026, sobre a `main` em `af714d3` (a Etapa 6 do gerador em produção desde 09/10).
Nasce do achado 91: o post agendado para as 10:00 que aparece como "09:59". A causa foi medida em 13/10;
em 15/10, o DEV e a auditoria estudaram o conserto com agentes, só lendo.
**Estado:** desenho fechado pelo DEV e pela auditoria em 15/10. Passou pelo estudo da causa, pela
revisão de risco do conserto (o que poderia acabar, falhar ou errar com a regra nova, pedida pelo
Eduardo) e pela auditoria própria do perigo. Essa auditoria mapeou quem grava e quem lê
`queue.not_before`, levantou os testes das mensagens com espera e mediu a produção. O teto no tique das
mensagens foi escolha do Eduardo. Aguarda a revisão da spec pela auditoria e a leitura do Eduardo.
**Projeto de quem:** o motor (a fila, o `/publicar` e o remarcar) era do Vinícius Gualberto, que saiu
da empresa em 15/10. Por decisão do Eduardo, passamos a mexer nele no jeito do Vinícius: o comentário
diz o porquê e a medição, a regra vira função pura com teste, cada proteção tem a mutação que a
derruba, e o commit é uma frase. O merge é do Eduardo, depois da conferência da auditoria.
**Achados:** resolve o 91, o 99, o 101 e o 102. O 100 e o 103 ficam fora (ver "Fora desta etapa").

---

## O que é

Agendado para as 10:00, o post entra na fila com `not_before` alguns milissegundos antes do minuto. A
auditoria mediu na produção: em 3 dos 7 agendamentos reais, o horário gravado ficou antes do minuto,
por −10, −205 e −330 ms. No caso visível, as 10:00 (13:00:00.000Z) foram gravadas como 12:59:59.670Z,
e a tela mostra "09:59", porque `fmtDate` corta os segundos. Acontece no `/publicar` (a linha
`c597dd2a`, de 09/09) e no gerador, porque os dois chamam `enqueuePublicacao`. O calendário põe o post
no dia de `not_before` em America/Sao_Paulo (`chaveDoDia`, `lib/calendario.ts:42`), então pode levar um post da
meia-noite para o dia anterior.

Três defeitos moram no mesmo caminho e entram juntos:

- **Achado 99: "depois" no minuto corrente não sai sozinho.** `momentoDaPublicacao` aceita até 60 s
  no passado, pela tolerância do minuto (`lib/publicacao.ts:1379` e `:1416`). Com isso, o atraso vira
  0. O `enqueue` só arma tique acima de 15 s (`lib/engine.ts:337`), e só o "agora" drena
  (`app/publicar/actions.ts:151` e `lib/bonus/publicar-processo.ts:300`). O post fica parado até o
  próximo tique de outro item, um webhook ou o cron. O mesmo acontece em dois casos parecidos:
  - o agendamento para daqui a menos de 15 s;
  - o remarcar para o minuto corrente: `atrasoDoTiqueDoRemarcar` (`lib/publicacao.ts:1808`) não arma
    tique até 15 s, e o remarcar não drena.
- **Achado 101: um erro depois do insert desfaz o que já entrou.** O `enqueue` lê a config e pede o
  tique DEPOIS do insert (`lib/engine.ts:337-340`), fora de qualquer `try`. Um erro ali volta como falha
  de um item que já está na fila:
  - no `/publicar`, a pessoa vê erro num post que vai sair;
  - no gerador, o `catch` (`lib/bonus/publicar-processo.ts:279-288`) desfaz a reserva e apaga as cópias
    da mídia, e o item da fila fica apontando para arquivos apagados;
  - o remarcar tem o mesmo desenho (`app/publicar/post/actions.ts:289`).
- **Achado 102: o tique do `enqueue` não tem teto.** No limite de 1 dia, ele pede 86405 s
  (`lib/engine.ts:339`). São cinco segundos além do horizonte que o projeto declarou nunca passar
  (`HORIZONTE_DO_TIQUE_EM_SEGUNDOS`, `lib/qstash.ts:31`). Nas mensagens é pior:
  - uma automação com um "Esperar" de mais de 1 dia pede ao QStash um atraso de dias, e o editor não
    tem teto para a espera (`app/automacoes/editor/painel.tsx:690-692` e `lib/steps.ts:1092`);
  - o cron diário não cobre mensagens: `armarTiquesDoDia` só arma posts (`kind = 'publicacao'`,
    `lib/queue-drain.ts:1349`).

---

## A causa, medida

`enqueuePublicacao` (`lib/engine.ts:2602`, do commit `ffaf941`) transforma a hora marcada, que é
ABSOLUTA, numa duração:

```ts
Math.round((quando.getTime() - Date.now()) / 1000)
```

Depois, o `enqueue` grava `now() + make_interval(secs => atraso)` (`lib/engine.ts:314-317`). Assim, a
duração é medida pelo relógio da aplicação e somada pelo relógio do banco. Além disso, o arredondamento
tira até meio segundo. Por exemplo: com 60,33 s de distância, o `round` dá 60, e o post fica 0,33 s
antes da hora.

A regra "o atraso vai em segundos, e quem soma é o banco" é do commit `6cd8d6d` (31/07). Ela está certa
para o que resolveu: o atraso RELATIVO das mensagens ("mande daqui a N minutos"), que não tem hora no
relógio de ninguém. A hora marcada tem hora. Convertê-la em duração traz de volta o relógio da
aplicação que o `6cd8d6d` tirou:

> "Dois relógios na mesma comparação — e o item nasce no futuro pela diferença entre eles." (`6cd8d6d`)

> "O que sai daqui é uma DURAÇÃO, e duração não depende de qual relógio a mediu." (`lib/engine.ts:2596-2597`)

A segunda frase não vale para esta conta: a duração é medida contra `Date.now()`, então depende do
relógio que a mediu. E o remarcar do próprio Vinícius já grava a hora absoluta
(`app/publicar/post/actions.ts:247-251`, `update queue set not_before = $3`), com o resultado
registrado no commit:

> "O que ficou provado e que a hora nova e gravada exatamente e que o dreno obedece a ela." (`c27b403`, 04/09)

**Esta etapa leva para o primeiro agendamento o que o remarcar já faz.**

---

## As decisões, e de quem

Do Eduardo, pela caixa:

| quando | assunto | decisão |
|---|---|---|
| 13/10 | o achado 91 | causa medida; o conserto fica para a semana seguinte, com o Vinícius |
| 15/10 | o estudo | "junto com agentes + o auditor, estude este caso para tentar rever" |
| 15/10 | o achado 99 | junto com o 91 |
| 15/10 | o achado 100 | consertar no gerador, num PR nosso, fora desta spec |
| 15/10 | o conserto recomendado (a hora absoluta) | antes dele, uma revisão do que poderia acabar, falhar ou errar com a regra nova |
| 15/10 | o Vinícius | saiu da empresa. Mexer no motor não precisa mais da permissão dele e segue o jeito dele. A auditoria faz uma auditoria própria do perigo antes da spec |
| 15/10 | o merge | é do Eduardo, no GitHub, depois da conferência da auditoria |
| 15/10 | o teto no tique das mensagens (achado 102 inteiro) | sim: o mesmo teto de 1 dia, com um teste de uma mensagem que espera 2 dias |

**Os consertos descartados no estudo de 15/10, e por quê:**

- **arredondar para cima e somar 1 s** (`Math.ceil` + 1): tira o "09:59", mas a hora continua sendo
  uma duração. Além disso, quebra a borda de 1 dia que `testes-integracao/tique-do-rodape.integracao.ts`
  protege;
- **mexer só na tela** (mostrar a hora pedida em vez de `not_before`): não conserta o dia no calendário
  nem o post que sai 0,3 s antes.

---

## Por dentro

### A fronteira: o INSERT das mensagens não muda

O `enqueue` (`lib/engine.ts:291-342`) é o contrato das mensagens: o atraso vem em segundos, e quem soma
é o banco. Pelo mapa da auditoria (15/10):

- ele tem 9 chamadores, todos em `lib/engine.ts`;
- só os do `enfileirarPasso` passam espera (`:1256`, `:1316`, `:1429` e `:1442`); eles somam os
  blocos "Esperar" em `lib/steps.ts:1722-1725`;
- o `reminder_delay_minutes` não é lido.

**O INSERT do `enqueue` continua byte a byte.** A publicação ganha um INSERT próprio, e a regra nova
não tem caminho para chegar às mensagens. No `enqueue`, mudam só duas coisas, e nenhuma toca a hora
gravada:

- o teto do tique (abaixo), que é JavaScript;
- a saída do parâmetro `agendarTique`, que só a publicação usava.

A auditoria mediu a produção, só lendo, às 13:56:29Z de 15/10:

- só a publicação nasceu com espera: 7 dos 9 itens dela;
- os outros 9 kinds não tiveram nenhum item com espera: `comment_reply` 65, `private_reply` 64,
  `dm_link` 61, `dm_welcome` 33, `dm_manual` 31, `dm_email_ask` 24, `story_reaction` 9,
  `dm_follow_gate` 7 e `dm_lote` 3;
- não há mensagem pendente.

Se a regra vazasse hoje, nada se estragaria. Mas o editor deixa qualquer automação esperar, então a
fronteira precisa estar garantida pelo próprio código, e uma guarda que lê o arquivo a protege (G, em
"Testes").

### A decisão do tique, pura

A função nova é `atrasoDoTiqueDaPublicacao(falta, horizonte)`, em `lib/publicacao.ts`. O navegador
também lê esse arquivo, então o horizonte entra por parâmetro, como já entra hoje em
`atrasoDoTiqueDoRemarcar`.

| `falta` (segundos, medida pelo banco) | tique |
|---|---|
| ≤ 0, ou não finita | nenhum: o item já vale, e quem drena é o chamador |
| de 1 até o horizonte | `min(falta + 5, horizonte)` |
| acima do horizonte | nenhum: o cron diário arma quando a hora entrar no dia |

**O piso de 15 s sai.** Ele existia porque o "agora" nascia com atraso 0 e era drenado na hora. Com a
regra nova, o chamador drena o que já vale, e o que falta pouco (de 1 a 15 s) ganha o tique que hoje
não tem (achado 99). A função nova substitui `atrasoDoTiqueDoRemarcar` (`lib/publicacao.ts:1808`), que
mede a distância com `Date.now()` e `Math.round`.

### O enfileirar da publicação

`enqueuePublicacao` (`lib/engine.ts:2577`) passa a gravar com o próprio INSERT:

```sql
insert into queue (account_id, kind, payload, dedupe_key, not_before)
values ($1, 'publicacao', $2, $3, greatest(now(), coalesce($4::timestamptz, now())))
on conflict (dedupe_key) do nothing
returning id,
          (not_before <= now()) as ja_vale,
          greatest(0, ceil(extract(epoch from (not_before - now()))))::int as falta
```

- **A hora marcada é gravada como veio**, sem passar por `Date.now()`. Hora no passado vira agora (o
  `greatest`), como já acontece hoje: "quem agendou para as 14h e confirmou às 14h01 quer publicar"
  (`lib/engine.ts:2599-2601`).
- **O `coalesce` fica explícito.** O `greatest` do Postgres ignora `NULL`, então `greatest(now(), NULL)`
  já daria `now()`. Com o `coalesce` escrito, quem lê a linha não precisa conhecer essa armadilha.
- **O INSERT novo repete o que o do `enqueue` faz:**
  - o `on conflict (dedupe_key) do nothing returning`;
  - o payload cru, sem `JSON.stringify` (`lib/engine.ts:326-329`);
  - as colunas de contato, de automação e de comentário nulas, como hoje.
- **O banco mede `ja_vale` e `falta` no mesmo statement**, e dentro dele `now()` tem um valor só.
  `ja_vale` quer dizer "a hora marcada não está no futuro". Nenhuma das duas respostas passa pelo
  relógio da aplicação.
- **O retorno muda** de `boolean` para `{ entrou: false } | { entrou: true; jaVale: boolean; falta: number }`.
- **O tique é armado aqui**, por `atrasoDoTiqueDaPublicacao(falta, HORIZONTE_DO_TIQUE_EM_SEGUNDOS)`.
  `getConfig` e `scheduleTick` ficam dentro de um `try` (achado 101). Depois do insert, o item já está
  na fila, e uma falha no tique não pode voltar como falha dele. Sem tique o post ainda sai, pelo rodapé
  do dreno, por um webhook ou pelo cron. É o mesmo argumento de `app/publicar/post/actions.ts:278-281`.

### Os chamadores

- **O compor** (`app/publicar/actions.ts:115-172`):
  - o `if (!r.entrou)` continua com a frase de "já está na fila";
  - a drenagem passa a acontecer quando `r.jaVale`, e não mais quando `momento.quando === null`;
  - quando `r.jaVale`, o aviso de sucesso é o do "agora" ("Ela sai em instantes", `lib/avisos.ts:416`);
    nos outros casos, é o da hora marcada.
- **O gerador** (`lib/bonus/publicar-processo.ts:279-307`):
  - drena quando `jaVale`;
  - devolve `jaVale` para a frase de `app/bonus/publicar-actions.ts:95`, que hoje decide por
    `r.quando !== null`;
  - o `catch` do enfileirar (`:279-288`) continua desfazendo a reserva e apagando as cópias. A
    diferença é que só chega lá um erro de antes do insert: o do tique fica dentro de
    `enqueuePublicacao`;
  - o estado na página vem da linha da fila (`lib/bonus/publicar-estado.ts:37-40`) e não muda.
- **O remarcar** (`app/publicar/post/actions.ts:247-294`):
  - grava `set not_before = greatest(now(), $3)`, com o mesmo `returning` de `ja_vale` e `falta`;
  - quando `ja_vale`, drena, dentro de um `try`, como o compor;
  - nos outros casos, o tique sai por `atrasoDoTiqueDaPublicacao(falta, …)`, com `getConfig` e
    `scheduleTick` dentro de um `try`;
  - com isso, "remarcar para o minuto corrente" passa a sair.

### O teto no tique das mensagens (achado 102, escolha do Eduardo)

No `enqueue`, o tique passa a ser pedido assim:

```ts
scheduleTick(config.app_url ?? "", Math.min(atraso + 5, HORIZONTE_DO_TIQUE_EM_SEGUNDOS))
```

A mensagem que espera mais de 1 dia ganha um tique em 1 dia. A drenagem desse tique não acha nada para
sair, e o rodapé dela (`lib/queue-drain.ts:1289-1303`) arma o próximo tique, já dentro do horizonte,
até a hora chegar. É o mesmo teto que o rodapé, `armarTiquesDoDia` e o remarcar já usam.

**O tratamento de erro das mensagens não muda.** O `try` em volta do tique fica só na publicação, que
agora tem caminho próprio: mexer nisso no fluxo das automações seria mudar o comportamento das
mensagens sem ninguém ter pedido.

### Os comentários que deixam de ser verdade

| onde | o que diz hoje | o que passa a dizer |
|---|---|---|
| `lib/engine.ts:279-290` | o atraso vem em segundos, "não como instante absoluto" | continua valendo para as mensagens, mais uma linha para a publicação: a hora marcada é gravada absoluta, e por quê (esta spec) |
| `lib/engine.ts:300-312` | o `agendarTique` que "só a publicação desliga" | sai, com o parâmetro |
| `lib/engine.ts:2594-2601` e `:2615-2618` | a duração "não depende de qual relógio a mediu"; o tique decidido por `atraso <= HORIZONTE` | a hora absoluta, o `ja_vale` e a `falta` medidos pelo banco, e a medição do 91 |
| `app/publicar/actions.ts:136-150` | "o agendado não drena"; cita `lib/engine.ts:321`, linha que já mudou | drena o que já vale |
| `lib/bonus/publicar-processo.ts:298-299` | "o agendado não drena" | drena o que já vale |
| `lib/publicacao.ts:1400-1403` | `enqueuePublicacao` "trata atraso negativo como zero" | grava `greatest(now(), quando)` |
| `lib/publicacao.ts:1780-1806` | "as três regras são as de `enqueue`", com o piso de 15 s | a regra da publicação, sem o piso |
| `app/publicar/post/actions.ts:272-276` | "as três regras de `enqueue`: nada abaixo de 15 s" | a função nova |
| `tests/publicacao.test.ts:1925-1927` | "`momentoDaPublicacao` já recusa" o passado | a tolerância do minuto deixa passar até 60 s, e o passado vira agora |
| `lib/qstash.ts:28-29` | "os dois lugares que pedem tique com atraso escolhido" | são cinco: o `enqueue`, o `enqueuePublicacao`, o remarcar, o rodapé e `armarTiquesDoDia` |
| `lib/queue-drain.ts:448` e `:1319-1322`; `app/api/cron/daily/route.ts:109-114` | `enqueuePublicacao` "não arma nada além de um dia" | continua verdade e fica. Com o teto, o "o QStash só recebe atrasos que ele já cumpre" de `queue-drain.ts:1321-1322` passa a valer também para as mensagens |

### O que não muda

- **O INSERT das mensagens** (`lib/engine.ts:315-317`), byte a byte. A guarda G cobra isso.
- **A retentativa do dreno**, que reescreve `not_before = now() + N` (60 s, 120 s e 3600 s;
  `lib/queue-drain.ts:549-553`, `:1253-1256` e `:588-592`). É uma duração relativa, e está certa.
- **`armarTiquesDoDia` e o rodapé do dreno.** A janela deles compara `not_before` com `now()` e
  funciona igual com a hora absoluta.
- **`momentoDaPublicacao` e a tolerância do minuto.**
- **A tela.** `fmtDate` continua cortando os segundos. Ela passa a mostrar a hora certa porque a hora
  gravada passa a ser a marcada.
- **O banco:** nenhuma migração.
- **O `sent_at = new Date()` do dreno** (`lib/queue-drain.ts:607` e `:1174`), que continua no relógio
  da aplicação. Fica anotado, fora desta etapa.

---

## O efeito na produção

- **A hora gravada é a marcada**, sem arredondamento. A tela, a lista de agendados e o calendário
  mostram a hora e o dia certos.
- **A saída passa a seguir só o relógio do banco**, o mesmo do dreno. Hoje, a saída segue o relógio
  da aplicação (a duração é contada a partir de `Date.now()`), e a gravação segue o do banco:
  - com a aplicação em T + a e o banco em T + b (d = a − b), hoje o dreno solta o post quando o
    relógio da aplicação chega à hora marcada;
  - depois desta etapa, ele solta quando o relógio do banco chega, ou seja, d mais tarde;
  - pelos 7 agendamentos reais, a diferença na produção fica abaixo de uns 0,2 s. É um limite tirado
    dos dados, e não uma medição direta, e ele inclui a latência entre o `Date.now()` e o insert. Na
    máquina do Vinícius, em julho, a diferença era de 53,9 s (`6cd8d6d`).
- **"Depois" no minuto corrente, ou para daqui a menos de 15 s, sai na hora**, no compor, no gerador e
  no remarcar. Nesses casos, o compor e o remarcar drenam, como o compor já faz no "agora": quem clicou
  espera a ida à Meta, e não a publicação (`app/publicar/actions.ts:142-146`).
- **Um erro no tique não derruba mais o enfileirar** (achado 101). O post que entrou na fila fica com
  a mídia.
- **Uma mensagem com espera de mais de 1 dia** ganha o tique em 1 dia, e o rodapé a leva até a hora.
  Hoje não existe nenhuma.
- **Os posts que já estão na fila** ficam com a hora gravada do jeito antigo, até meio segundo antes.
  Nenhuma linha é reescrita.

---

## Testes

A suíte pura roda em `npm run verify`. A integração roda no container, com
`npm run test:integracao`, e só com a `DATABASE_URL_TESTES`. Cada proteção tem a mutação que a
derruba: retirada a proteção de propósito, o teste certo cai. As mutações rodam no ensaio do plano, com
a trava da `DATABASE_URL_TESTES`.

| # | suíte | o que prova | a mutação que o derruba |
|---|---|---|---|
| G | pura, lendo o arquivo | a fronteira: o INSERT do `enqueue` continua com `now() + make_interval(secs => $8::int)`, e só `enqueuePublicacao` grava a hora absoluta. Fica na suíte pura porque o `verify` não roda a integração | pôr o `greatest` no INSERT do `enqueue` |
| P | pura | `atrasoDoTiqueDaPublicacao`: 0 → nenhum; 1 → 6; 15 → 20 (hoje, nenhum: o 99); horizonte → horizonte (o 102); horizonte + 1 → nenhum; `NaN` → nenhum | voltar o piso de 15 s; tirar o `min` |
| T1 | integração | a hora gravada é a marcada: com `quando` = `now()` do banco + 120,67 s, `not_before` sai igual, ao milissegundo | voltar ao `Math.round` + `make_interval` |
| T2 | integração | o resultado não depende do relógio da aplicação: com `Date.now()` adiantado 30 s (`vi.spyOn`), `not_before` não muda | medir a distância com `Date.now()` |
| T3 | integração | a hora no passado vira agora e sai: com `quando` = agora − 30 s, vem `ja_vale`, e o compor drena (com a Meta falsa do harness de `agendados.integracao.ts`) | drenar só com `quando === null` |
| T4 | integração | a borda de 1 dia tem teto: com `falta` = horizonte, o tique pedido é o horizonte, e não 86405 | tirar o `min`. Hoje este teste fica vermelho: é o 102 |
| T5 | integração | a menos de 15 s também arma: com `falta` = 10, o tique sai com 15 | voltar o piso |
| T6 | integração | o erro no tique não derruba: com `getConfig` lançando erro, `entrou` fica `true`, e o gerador não apaga as cópias | tirar o `try` |
| T7 | integração | as mensagens continuam relativas: `gatilho-entrega.integracao.ts:426` (o `dm_link` com espera, `:454-455`) | mandar as mensagens pelo INSERT absoluto |
| T8 | integração | o remarcar: para o minuto corrente, sai no dreno; para +10 s, arma 15; para +2 dias, não arma tique | não drenar no remarcar; voltar o piso |
| T9 | integração | a mensagem com espera de 2 dias pede o tique do horizonte, e não 172805 | tirar o `Math.min` do `enqueue` |

**Os testes que mudam de propósito:**

- `tests/publicacao.test.ts:1919-1930` ("perto demais NAO arma" e "hora no passado NAO arma") passam
  para a função nova: 10 s passa a armar 15 (o 99), e o comentário de `:1925-1927` é corrigido.
- `testes-integracao/tique-do-rodape.integracao.ts` monta o `quando` a partir de `Date.now()` (os
  ajudantes de `:216-222` e `:277-279`). Ele passa a montar pelo relógio do banco, para não depender de
  a máquina estar em dia com o container.
- `testes-integracao/publicacao.integracao.ts` (19 usos) e `tique-do-rodape.integracao.ts` (8 usos)
  passam a ler o retorno novo. Os casos que enfileiram com `null` e esperam o dreno continuam certos
  com o `coalesce`.
- `testes-integracao/bonus-publicar-processo.integracao.ts:560` (o `enfileirar: async () => false`)
  passa para o retorno novo.

---

## A prova real

A prova é no preview, com o Eduardo na tela. O preview usa o banco e o bucket de produção. Antes de
cada gravação, o Eduardo dá o OK, a hora vai à auditoria, e a auditoria lê o banco antes e depois.
**Sem post real:** a saída na hora é provada pela integração, com a Meta falsa. Sem migração.

1. No `/publicar`, compor um post de imagem e agendar para daqui a 2 dias, às 10:00 (grava a imagem e
   a linha da fila). A auditoria confere que `not_before` é 13:00:00.000Z, exato.
2. Na lista de agendados, remarcar para o dia seguinte, às 10:00 (grava). A auditoria confere que a
   hora nova está exata.
3. Cancelar (grava `skipped`).

O gerador chama o mesmo `enqueuePublicacao`, e a parte dele que muda (drenar quando `jaVale`) está
coberta pelos testes T3 e T6. No fim, o que a prova criou sai do banco e do bucket. Para isso, o
Eduardo dá o OK, e a auditoria lê o script antes de ele rodar.

---

## Pré-condições do merge

1. `npm run verify` limpo, a integração verde no container e a prova feita no preview.
2. Nenhuma migração: o build do merge diz "Nada a aplicar".
3. O merge é do Eduardo, no GitHub, depois da conferência da auditoria.
4. Nenhum `next dev` apontado para a produção durante o deploy.

Esta etapa não toca nenhum arquivo da Etapa 10 (a branch `lista-de-carrosseis` só acrescenta
`testes-integracao/bonus-apagar-carrossel.integracao.ts` fora das pastas dela), então as duas entram em
qualquer ordem.

---

## Fora desta etapa

- **Achado 100** (PR do gerador): no gerador, um post em retentativa aparece como "Agendado para",
  porque a retentativa reescreve `not_before`. São três esperas possíveis:
  - +60 s, do contêiner em processamento (`lib/queue-drain.ts:549-553`);
  - +120 s, do erro (`:1253-1256`);
  - +3600 s, da cota (`:588-592`).

  O conserto é do gerador: um item pendente com erro conta como "publicando", e a tela mostra o motivo
  quando é a cota.
- **Achado 103** (anotado): um "Esperar" antes de `pedir_follow` ou de `pedir_dado` é descartado sem
  aviso. `lib/steps.ts:1722-1725` soma a espera, mas `lib/engine.ts:800-1010` não lê o
  `atrasoSegundos`.
- O `sent_at = new Date()` do dreno, que fica no relógio da aplicação.
- Os quatro kinds de mensagem com espera sem teste próprio (`dm_welcome`, `private_reply`,
  `comment_reply` e `story_reaction`). A guarda G protege o INSERT deles, e nenhum deles muda.
