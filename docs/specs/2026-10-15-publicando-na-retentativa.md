# O post em nova tentativa aparece como "publicando" no gerador

**Nascido em:** 15/10/2026, sobre a `main` em `fc16464` (a hora marcada mesclada às 16:01Z, no ar desde as 16:02Z). É o
achado 100 da auditoria, visto no estudo do achado 91, e o Eduardo decidiu consertá-lo no gerador, num PR
nosso.
**Estado:** desenho aprovado pelo Eduardo pela caixa em 15/10, depois de cruzado com a auditoria
(`metodochat-20`), que pediu a frase da trava na espera da cota (incluída abaixo). Aguarda a revisão da
spec pela auditoria e a leitura do Eduardo.
**Projeto de quem:** o gerador é nosso. O motor (a fila, o dreno e o `/publicar`) não muda.

---

## O que é

Na página do carrossel, um post que entra em nova tentativa (o "Publicar agora", ou um agendado quando
chega a hora) aparece como "Agendado para [a hora da nova tentativa]". Ele não foi agendado de novo: está
saindo, e precisou esperar. A causa é que
o dreno, quando tenta de novo, empurra o `not_before` para a frente, e o gerador decide "agendado" só
porque o `not_before` está no futuro (`lib/bonus/publicar-estado.ts:37-40`).

As três novas tentativas de uma publicação, medidas em `fc16464`:

| motivo | espera | o que o dreno grava |
|---|---|---|
| a Meta ainda processa a mídia | +60 s | `pending` e "a Meta ainda esta processando a midia" (`lib/queue-drain.ts:549-553`) |
| a conta chegou ao limite de posts das últimas 24 horas | +3600 s, repetida até a janela virar | `pending` e "a cota de publicacoes da conta acabou (X de Y em 24h); o post sai assim que ela virar" (`:588-592`) |
| uma falha passageira | +120 s, enquanto o post tiver menos de 3 tentativas, contadas todas, inclusive as da cota e da Meta processando (`:1039`, `:1252`) | `pending` e a mensagem do erro (`:1253-1256`) |

As três gravam um `error` não nulo, e o `finish` só limpa o `error` quando o post sai (`:223`). Medido
pela auditoria: nenhum outro caminho grava `error` numa publicação `pending`. O `enqueuePublicacao` não
grava `error`, o remarcar só muda o `not_before`, e os outros caminhos gravam `skipped`. **Então
"`pending` com `error`" é exatamente "já foi tentado".** O repositório do gerador já lê o `error` da
linha da fila (`lib/bonus/publicar-repositorio.ts:37-44`).

---

## As decisões, e de quem

Do Eduardo, pela caixa, em 15/10:

| assunto | decisão |
|---|---|
| o achado 100 | consertar no gerador, num PR nosso |
| o que a tela diz na nova tentativa | "Publicando", e o motivo só na cota: a Meta processando e a falha passageira saem em 1 ou 2 minutos e ficam com o "Publicando" de hoje; o limite da conta segura por 1 hora, e a frase diz o motivo e a hora da nova tentativa |
| o desenho (abaixo) | aprovado, com a frase da trava pedida pela auditoria |

Da auditoria, no cruzamento do desenho:
- **a frase da trava na espera da cota:** o post que espera o limite da conta continua cancelável (o
  cancelar só exige `status = 'pending'`, `app/publicar/post/actions.ts:83`), e a espera se repete de hora
  em hora. A frase de hoje, "o carrossel não muda até o post sair", esconderia a saída que existe;
- **o remarcar de um post em nova tentativa** fica como resíduo escrito (abaixo), sem mexer no `/publicar`.

---

## Por dentro

### O estado, puro (`lib/bonus/publicar-estado.ts`)

`EstadoDaPublicacao` ganha, no `publicando`, uma espera opcional:

```ts
| { tipo: "publicando"; filaId: string | null; espera?: { motivo: "cota"; ate: Date } }
```

No `case "pending"` de `estadoDaPublicacao`:

| a linha da fila | o estado |
|---|---|
| `error` nulo e `not_before` no futuro | `agendado`, como hoje |
| `error` não nulo, começando pelo prefixo da cota, e `not_before` no futuro | `publicando`, com `espera: { motivo: "cota", ate: not_before }` |
| `error` não nulo, outro motivo, e `not_before` no futuro | `publicando`, sem espera |
| `not_before` vencido, com ou sem `error` | `publicando`, sem espera, como hoje |

O `sending` continua `publicando` sem espera. O prefixo da cota vira uma constante do gerador,
`MOTIVO_DA_COTA = "a cota de publicacoes da conta acabou"`.

### As frases (`lib/bonus/publicar-textos.ts`)

- **`textoDoEstadoDaPublicacao`**, no `publicando` com a espera da cota: "Publicando assim que o
  Instagram liberar: a conta chegou ao limite de posts das últimas 24 horas. Nova tentativa por volta de
  {`fmtDate(ate)`} (horário de Brasília)." Sem a espera, continua "Publicando. O Instagram leva até um
  minuto: recarregue a página para ver."
- **`textoDaTrava`**, no `publicando` com a espera da cota: "Esperando o Instagram liberar: para mudar,
  cancele no calendário." Sem a espera, continua "Publicando: o carrossel não muda até o post sair."
- **A cor** (`tomDoEstadoDaPublicacao`) não muda pelo tipo: o `publicando` já é `atencao`. O post em
  nova tentativa passa de verde (o `agendado`) para amarelo, o que é certo para quem espera por um
  problema.

### A guarda do acoplamento

O gerador passa a depender do começo do texto que o dreno grava na cota. Uma guarda pura lê
`lib/queue-drain.ts` e cobra que o `error` da cota continue começando por `MOTIVO_DA_COTA`. Se alguém mudar
a frase no dreno, a guarda cai no `verify`, e não na tela de quem espera.

### O que não muda

- O motor: `lib/queue-drain.ts`, `lib/engine.ts`, `app/publicar/` e a fila.
- O repositório do gerador: ele já lê o `error`.
- A trava: `publicacaoLivre` (`publicar-estado.ts:63-64`) já trava o `agendado` e o `publicando`. O
  carrossel segue travado como hoje, e o funil (`textoDoFunil`, `publicar-textos.ts:71`) trata os dois
  igual.
- O banco: nenhuma migração.

---

## O efeito na produção

- O "Publicar agora" em nova tentativa deixa de aparecer como "Agendado para", e passa a "Publicando".
- No limite da conta, a tela diz o motivo e a hora da nova tentativa, e a frase da trava aponta o
  calendário para cancelar.
- O post agendado que ainda não foi tentado continua "Agendado para", sem mudança.

**Os resíduos, escritos:**
- **O calendário do `/publicar`** continua mostrando a hora da nova tentativa, porque ele lê o
  `not_before`. O achado pedia o conserto no gerador.
- **O remarcar de um post em nova tentativa** (ele aparece na lista de agendados, porque está `pending`
  com `not_before` no futuro) não limpa o `error`. Até a hora nova, o gerador mostra:
  - na espera da cota: "Publicando assim que o Instagram liberar: a conta chegou ao limite de posts das
    últimas 24 horas. Nova tentativa por volta de {a hora nova} (horário de Brasília)." e, na trava,
    "Esperando o Instagram liberar: para mudar, cancele no calendário.". A hora está certa (é o
    `not_before`); só o motivo é o da tentativa velha;
  - nos outros motivos: "Publicando. O Instagram leva até um minuto: recarregue a página para ver." e,
    na trava, "Publicando: o carrossel não muda até o post sair.".

  O post sai na hora nova de qualquer jeito. Consertar isto pediria ao remarcar limpar o `error`, no
  `/publicar`, por causa de uma frase do gerador: fica de fora.
- **A frase "O Instagram leva até um minuto"** vale para a espera de +60 s. Na falha passageira, a nova
  tentativa é em 2 minutos, enquanto o post tiver menos de 3 tentativas, contadas todas (`:1039`,
  `:1252`). A frase é a de hoje e não muda.
- **A lista de carrosséis da Etapa 10**, quando entrar, mostra "Publicando…" sem a hora no caso da cota
  (`selosDoCarrossel`). O tipo ganha `espera` opcional, e o código dela continua compilando.

---

## Testes

| suíte | o quê |
|---|---|
| pura | o estado: o agendado sem `error`; o pendente com `error` no futuro, nos três motivos; a cota com a espera e a hora; o vencido como hoje; o `sending` sem espera |
| pura | as frases: a do estado e a da trava, com e sem a espera da cota; a cor do `publicando` |
| pura | a guarda: o `error` da cota em `lib/queue-drain.ts` começa por `MOTIVO_DA_COTA` |
| integração | o repositório: uma linha `pending` com `error` e `not_before` no futuro dá `publicando`; com o `error` da cota, dá a espera com a hora; sem `error`, dá `agendado` |

Cada proteção principal ganha uma prova de mutação: retirada de propósito, o teste certo cai.

---

## A prova real

No preview, com o Eduardo na tela. O preview usa o banco e o bucket de produção. **Sem post real, e sem
gravar na fila uma linha forjada.** A nova tentativa fica coberta pelos testes. A prova mostra que nada
mudou no caminho comum:

1. No gerador, um carrossel escrito à mão, com 1 slide em "Só texto", agendado para daqui a 2 dias (grava).
   A página do carrossel mostra "Agendado para…", como hoje.
2. Cancelar no calendário (grava).

Cada gravação tem o OK do Eduardo e a hora mandada antes, e a auditoria lê a produção antes e depois. No
fim, o carrossel de prova sai do banco por um script que a auditoria lê antes de rodar.

---

## Pré-condições do merge

1. `npm run verify` limpo, a integração verde no container, e a prova feita no preview.
2. Nenhuma migração: o build do merge diz "Nada a aplicar: as 19 migrações".
3. O merge é do Eduardo, no GitHub, com a mensagem preparada no estilo do Vinícius.

---

## Fora desta etapa

- O calendário do `/publicar` com a hora da nova tentativa.
- O remarcar limpando o `error`.
- Uma frase própria para a Meta processando e para a falha passageira.
