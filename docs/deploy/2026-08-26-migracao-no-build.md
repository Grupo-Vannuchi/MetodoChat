# A migração deixa de ser passo manual em produção

**Data:** 26/08/2026 · **Branch:** `esteira-migracao`
**O que muda na operação:** em deploy de **produção**, a migração de esquema
roda sozinha, antes do `next build`. Em qualquer outro deploy, ela **pula**.

Este documento é o roteiro novo. O de 17/08
(`docs/deploy/2026-08-17-ramificacao.md`) continua valendo para tudo o que ele
descreve — inclusive a migração de **dado**, que **não** entrou nesta esteira.

---

## O que existia até aqui, medido em 26/08

**Nada rodava migração no deploy.** `vercel.json` não tem passo de build;
`package.json` tinha `"build": "next build"` e nada mais. As três migrações de
`migrations/` foram aplicadas **à mão**, da máquina de quem implanta, seguindo o
roteiro de 17/08.

E o script nem poderia rodar num build: ele lia a senha do banco de `.env.local`,
um arquivo que **não existe na Vercel** — o `.gitignore` o mantém fora do
repositório, e é assim que tem de ser. Medido, rodando `scripts/migrar.mjs` de um
diretório sem o arquivo: `Error: ENOENT … .env.local`, **código de saída 1**.
Ligado ao build do jeito que estava, ele derrubaria o primeiro deploy.

---

## O que passa a acontecer

`package.json`:

```json
"build": "node scripts/migrar.mjs --aplicar && next build"
```

| onde | o que o script faz | código de saída | o `next build` acontece? |
|---|---|---|---|
| deploy de **produção** (`VERCEL_ENV=production`) | **aplica** e confere no banco | 0 se conferiu; 1 se não | sim, se a migração passou |
| deploy de **preview** (`VERCEL_ENV=preview`) | **pula**, e diz por quê | **0** | **sim** |
| `npm run build` na máquina de alguém (sem `VERCEL_ENV`) | **pula**, e diz por quê | **0** | sim |

**Pular sai com 0 de propósito.** Num preview, não aplicar é o comportamento
certo, e um deploy de branch não pode ficar vermelho por estar se comportando
bem. **Branch de teste não toca o banco** — e o pulo acontece **antes** de a
`DATABASE_URL` ser lida, então um build de branch sem variável de banco nenhuma
também passa. Medido nos três casos da tabela.

### A senha do banco

`process.env.DATABASE_URL` primeiro; `.env.local` só quando ela não estiver no
ambiente — que é o caso da máquina local. É a mesma forma de
`testes-integracao/banco-descartavel.ts:urlDoBanco()`. Os dois caminhos foram
medidos, cada um com o outro indisponível, e os dois saíram 0.

### A ORDEM, e por que a migração vem ANTES do `next build`

Três razões, e a terceira tem prazo de validade:

1. **`&&`.** Migração vermelha significa que o `next build` **não acontece**: o
   deploy morre em segundos, em vez de depois de um build inteiro. Medido com uma
   migração de SQL inválido contra schema descartável — saída 1, e o passo
   seguinte da cadeia nunca rodou.
2. **É o que o script existe para resolver.** Ele nasceu do impasse de 17/08: *a
   estrutura só existe depois que o código sobe*. Pô-lo depois do build inverte
   exatamente isso.
3. **Ela só é segura porque toda migração desta pasta é idempotente e ADITIVA.**
   Coluna nova parada é inofensiva se o build seguinte falhar — é o mesmo
   argumento que o roteiro de 17/08 usa para dizer "não apague a coluna para
   reverter". **No dia da primeira migração que MOVE dado, esta ordem tem de ser
   repensada junto com a tabela de controle**, que também não existe ainda.

**O `next build` não lê o banco**, e isso foi conferido: toda página que consulta
o banco é `force-dynamic`, então nada é pré-renderizado a partir dele. A ordem,
portanto, não é sobre o build precisar do esquema — é sobre falhar cedo e sobre
não construir por cima de um banco que ainda não é o que o código espera.

### Quando ela falha

O deploy **para**, e a aplicação antiga continua servindo. Os dois modos de
falha, e os dois já eram os do script antes desta mudança:

- **a migração estourou** (SQL inválido, banco fora do ar): saída 1, o
  `next build` não roda
- **a migração rodou e a conferência discorda**: `if not exists` tem sucesso
  mesmo sem fazer nada, então o script pergunta ao banco o que existe de verdade —
  tipo, nulidade, padrão e regra de chave estrangeira. Divergiu, sai 1

**O que fazer:** ler o log do build, que diz qual coluna ou qual chave divergiu.
`--aplicar` de novo **não** conserta forma divergente — está escrito no próprio
script, e continua verdade.

**O banco pode ficar à frente do código.** Se a migração passa e o `next build`
falha por outro motivo, as colunas novas ficam no banco sem o código novo no ar.
Isso é inofensivo enquanto as migrações forem aditivas (ver razão 3 acima), e é o
mesmo estado que o roteiro de 17/08 chama de "ponto de volta sem consequência".

---

## A CONFERÊNCIA DO PRIMEIRO DEPLOY DE PRODUÇÃO — não pule esta

`VERCEL_ENV` é variável de sistema da Vercel, e a documentação dela diz que
essas variáveis só existem com a caixa **"Enable access to System Environment
Variables"** marcada nas configurações do projeto.

**Com a caixa desmarcada, `VERCEL_ENV` não existe nem em produção, e o script
pula em todo deploy.** Nada quebra — pular devolve exatamente o estado de hoje,
em que nada roda migração no deploy e `ensureSchema` é a rede. Mas a esteira não
estaria fazendo nada, e ninguém saberia.

**Como saber, e custa dez segundos:** no primeiro deploy de produção, abra o log
do build e procure a linha

```
MODO: APLICANDO (grava no banco)
```

Se em vez dela aparecer

```
MIGRAÇÃO PULADA — este não é um deploy de produção.
  VERCEL_ENV: ausente
```

a caixa está desmarcada. Marque-a e implante de novo.

**Por que a trava erra para este lado:** pular sem precisar é perder uma
comodidade; aplicar sem dever é uma branch de teste escrevendo no banco vivo. O
segundo é irreversível, o primeiro não.

---

## O QUE CONTINUA MANUAL — e é mais do que parece

### 1 · A rede do `ensureSchema` continua existindo

O esquema base ainda nasce dentro da aplicação: `ensureSchema` (`lib/db.ts`) roda
42 instruções na primeira requisição de cada instância. **Esta esteira não o
tocou**, e é deliberado. Enquanto ele existir, implantar sem migração ainda
funciona — e a armadilha de 17/08 continua valendo: **com um servidor de dev de
pé, editar `lib/db.ts` É aplicar a migração** no banco de desenvolvimento.

Tirar o esquema de dentro da aplicação é o resto da Frente 1
(`docs/plans/2026-08-17-esquema-e-harness.md`), e é outro degrau.

### 2 · Migração que MOVE dado não é suportada

O contrato da pasta `migrations/` é **idempotência**: toda DDL com
`if not exists`, rodar duas vezes é inofensivo, e **não existe tabela de
controle** registrando o que já rodou. Renomear coluna preservando conteúdo,
quebrar uma tabela em duas, remover `flow_step_index` — nada disso cabe aqui
ainda. **No dia da primeira, a tabela de controle vira obrigatória**, e a ordem
dentro do `build` tem de ser reexaminada junto.

### 3 · A migração de DADO continua fora da esteira

`scripts/ligar-passos-existentes.mjs` e os outros scripts de `scripts/` **não
mudaram e continuam sendo rodados à mão**. Eles preenchem; este cria. O roteiro
de 17/08, incluindo a armadilha da linha que parece sucesso e pode ser perda
silenciosa, continua sendo o documento deles.

### 4 · A conferência de `migrar.mjs` continua sendo lista à mão

Quem acrescentar migração acrescenta a linha correspondente em `ESPERADAS` ou
`ESPERADAS_CHAVES`. O porquê está escrito no script, com o dia em que ela ficou
velha. **Toda migração de forma nova exige perguntar se a conferência sabe
enxergá-la** — senão ela imprime "CONFERIDO" sobre outra coisa. Agora isso pesa
mais: o que antes deixava um roteiro manual seguir por engano, hoje deixa um
deploy passar por engano.

### 5 · Rodar à mão continua possível, e agora é preciso DIZER

Fora de um deploy de produção, `--aplicar` sozinho pula. Para aplicar à mão:

```
node scripts/migrar.mjs                        # ensaio a seco, não é travado
node scripts/migrar.mjs --aplicar --a-mao      # grava
```

A bandeira existe para que quem aplica de fora de um deploy diga que é isso que
está fazendo. **Ela é recusada com código 1 dentro de um build da Vercel**,
qualquer que seja o ambiente — assim, escrevê-la no `build` do `package.json`
para "destravar" não produz um deploy que aplica em preview: produz um deploy
vermelho, na primeira tentativa.

---

## Como voltar atrás

**A esteira inteira sai com uma linha:** devolver `"build": "next build"` no
`package.json`. A migração volta a ser passo manual, e o roteiro de 17/08 volta a
ser o único. Nada no banco precisa ser desfeito — as migrações são aditivas, e as
três de hoje já estão aplicadas em produção.

**Não apague coluna para reverter.** Continua valendo, pelo mesmo motivo de
17/08: ela é inofensiva parada, e apagá-la obrigaria a refazer a migração.
