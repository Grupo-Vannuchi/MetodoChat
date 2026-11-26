# O painel no celular, onda 1, PR 2: o plano

**Nascido em:** 26/11/2026, sobre a `main` em `96b5cbb` (o merge do PR 1, o #43). A spec é
`docs/specs/2026-11-24-celular-onda-1.md`, com a emenda do PR 2, no sha256 `579ead18865d187e96f5f0bc2953f7b48ea8426af4b83fc25dca76949e5c0955`.

**O que o Victor decidiu pela caixa** (a spec traz cada decisão com as opções):
- em 24/11: o uso "acompanhar"; as mesmas telas se ajustam ao tamanho, no mesmo endereço; nada de telas separadas;
- em 25/11, com os números da Fase 0: o calendário de Publicações vira uma lista por dia; 44 px nos alvos principais
  (o Remarcar, o "Cancelar este post" e o Pausar/Ativar) e 24 no resto;
- em 26/11: começar o ensaio do PR 2 ("Pode começar").

**As emendas do PR 2** (a spec registra todas, no commit da spec):
- a releitura da auditoria antes do ensaio: a lista mostra exatamente as casas da grade que têm posts, as do mês
  vizinho também, e o vazio do celular olha a lista (o 365); o cartão do post é um só (o 366); a lista não ordena nada
  (o 367); o teste de tela monta o quadro de verdade (o 368), com o `ResizeObserver` entre os dublês (o 369);
- o texto do `capable` (o 360): sem a chave, o Next o põe como `true`;
- a prova sem sessão e a do iPhone do PR 1 foram para a produção (o 356);
- **o cartão é uma FUNÇÃO chamada no corpo da página, e não um componente filho** (o 375): a integração lê a tela
  pelo `textoDaArvore`, que não desce em componente filho. O ensaio mediu isso (a seção abaixo).

**O ensaio (26/11):** feito na cópia `m` (`git worktree add --detach` na `96b5cbb`, com `npm ci` próprio e
`.env.local` vazio), bloco a bloco, com o "pode" da auditoria em cada um. O ramo final é o `ensaio-celular-2b`, que
refez o ensaio a partir da `96b5cbb` depois do 375 (o ramo `ensaio-celular-2`, com o cartão como componente, ficou só
para comparação). Os seis commits do `ensaio-celular-2b`, e o patch-id de cada um, que a execução tem de repetir:

| Commit do ensaio | O que é | patch-id |
|---|---|---|
| `524164d` | a spec com a emenda do PR 2 | `cca2040c951b65c2cfa62a05e8c5efe68e42f158` |
| `32e4ce3` | F1: o teste de tela do quadro | `d65602cd68192a74258213aaa30b5b4bdf98e5b2` |
| `709ca25` | F2: a lista do calendário (a função pura e o teste) | `e2cffcdaac4a8aed291603631ce82c5c0924c093` |
| `2e854f8` | F3: o calendário vira a lista no celular, com o cartão como função | `d606e8375e7360cd3c8f9409b0820c39fc67c4be` |
| `a1b3262` | F4: os alvos de toque do post e das Automações | `6f0e4f99ecf0e032a4eb72df1328f2e73c18ef80` |
| `2df9e02` | F5: o comentário do `capable` | `94050e6fc55c619772b2e4151c45f1d75026d628` |

O plano entra num commit próprio, logo depois da spec, e não tem par no ensaio: o patch-id dele é medido na aplicação
do zero pela auditoria.

---

## O que o ensaio mediu

- **O quadro monta no jsdom com três dublês** (a F1): a ação `salvarAutomacao`, o `ReactFlow` trocado por um
  componente vazio e um `ResizeObserver` que não faz nada. Os 2 casos passaram, e nenhum outro dublê foi pedido.
- **O vermelho da lista pela afirmação** (a F2, o achado 355): com a função como esboço que devolve sempre `[]`, cinco
  casos caíram com `AssertionError` e um passou:

```text
failed  o dia do mês vizinho entra, como na grade, com o mês dele no título (o achado 365)
failed  o post que cai só na folga da janela não tem casa e não entra (o achado 365)
failed  os dias saem na ordem da grade, e os posts de cada dia na ordem em que chegaram (o achado 367)
failed  a semana que atravessa a virada do mês dá os dois meses nos títulos
passed  uma grade sem posts dá uma lista vazia
failed  um dia com a lista de posts vazia não entra
```

- **O `page.tsx` move o cartão, e não o redigita** (a F3): o corpo da `cartaoDoCalendario` é o trecho das
  `:445-536` da `main`, recortado pelo roteiro, com só DUAS diferenças (o `href`, com a prop `ancora`, e o `span` do
  rótulo, com o `truncate` condicionado a `inteiro`). A auditoria conferiu isso por comparação automática.
- **O 375, medido, e a prova de que a integração protege o cartão.** No ramo `ensaio-celular-2`, o cartão era um
  componente (`<CartaoDoCalendario />`), e a integração caiu em 4 casos (registro do ensaio: "Tests  4 failed | 1014
  passed | 8 skipped (1026)"). Os quatro procuram o `href` ou o rótulo, que moravam dentro do componente:

```text
FAIL  testes-integracao/agendados.integracao.ts > com a conta selecionada pelo tombo declarado (a primeira do schema) > o detalhe promete a hora no futuro, e avisa do prazo no atrasado
      AssertionError: expected 'className=space-y-6…' to contain '/publicar/post/<id>'
FAIL  testes-integracao/linkedin-telas.integracao.ts > o calendário e "Não saíram" leem o post do LinkedIn > o calendário mostra o post do LinkedIn com a rede no nome e o link para a página dele
      AssertionError: expected 'className=space-y-6…' to contain 'LinkedIn · Só texto'
FAIL  testes-integracao/linkedin-telas.integracao.ts > o calendário e "Não saíram" leem o post do LinkedIn > o vídeo do LinkedIn fica sem capa e com o ícone ▶ enquanto não saiu, e não como imagem quebrada (a parte 3b)
      AssertionError: expected 'className=space-y-6…' to contain 'LinkedIn · Vídeo'
FAIL  testes-integracao/nao-saiu.integracao.ts > com a conta selecionada pelo tombo declarado (a primeira do schema) > a publicação pending fica na seção de agendados e NÃO aparece na das falhadas
      AssertionError: expected 'className=space-y-6…' to contain '/publicar/post/<id>'
```

  No ramo `ensaio-celular-2b`, com o cartão como função, a mesma suíte deu "1018 passed | 8 skipped (1026)": os 4
  passaram de caídos a passados, com o mesmo total. **Virar o cartão em componente filho é uma mutação que a própria
  integração já pega.** E há um risco pior que as quedas: um `not.toContain` sobre o cartão
  (`testes-integracao/linkedin-telas.integracao.ts:299`) ficaria verde sem ler nada.
- **As 7 mutações** (o apêndice B): 7 de 7 caíram, cada uma nos casos previstos, e a árvore voltou limpa. A 6 e a 7
  não estão na lista da spec: elas ficam neste plano (a 6 é a outra metade do "inverter a ordem"; a 7, uma sugestão
  da auditoria, prova que o caso da folga morde).
- **O verify** (na `2df9e02`): 167 arquivos e 3 910 casos puros, 37 e 352 de tela, os quatro "VAZAMENTOS: 0",
  "MIGRAÇÃO PULADA", "Next.js 16.4.6", as 21 páginas, o "ƒ /publicar" e o "ƒ Proxy (Middleware)".
- **A integração** (na `2df9e02`, com o Docker aberto pelo Victor): o alvo no banco de TESTE, 80 arquivos, "1018
  passed | 8 skipped (1026)", igual à `main`.
- **A guarda do diff** (`guarda-celular-2.mjs`, na `2df9e02`): os nove arquivos "dentro", o layout só com comentário,
  os tamanhos das trocas pequenas iguais aos do ensaio e o cartão como função.

## O que fica aberto, fora desta entrega

- **O iPhone do PR 1:** a prova do ícone, no `metodochat.vercel.app`, pendente desde 26/11. O PR 2 não mexe no ícone.
- **O 370:** um post pendente que cai só na folga da janela não aparece em nenhuma casa da grade do computador, nem
  entra no "fora deste período". É anterior ao PR 2, e o PR 2 não muda o computador.
- **O 347:** a sessão que cai sem rastro quando o banco falha. Uma entrega à parte.
- **O 325:** o aviso do `minimatch` nas ferramentas de lint. Um PR pequeno.
- **O PR do guia:** a ordem de trabalho nova e os achados de 317 em diante.
- **O 363:** os 38 ramos antigos do GitHub. Só se o Victor quiser.

## Restrições globais

- **Os caminhos.** Todo bloco de comandos começa definindo:
  - `S`, o scratchpad: `C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/28ff177f-dfa7-439e-ba1a-dc70de81ea3c/scratchpad`;
  - `C`, a cópia da execução: `$S/x` (nome curto, o achado 307);
  - `K`, a pasta dos roteiros desta entrega: `$S/celular2`, onde moram também o `extrair-bloco.mjs` e o
    `varrer-texto.mjs` (copiados em 26/11 da pasta `next/` da sessão do PR 1, com o sha conferido);
  - `P`, este plano: `$K/plano.md`, o arquivo que a auditoria leu (no Passo 3, ele é copiado para
    `docs/plans/2026-11-26-celular-onda-1-pr2.md`).
  - A auditoria, ao aplicar o plano do zero, troca `C` e `K` pelos caminhos dela.
- **O ramo:** `celular-2`, saído da `96b5cbb`, sem upstream até o push. Nunca commitar nem empurrar na `main`. Todo
  commit vem depois de `test "$(git branch --show-current)" = celular-2 &&`.
- **O autor** é o do git da máquina (Victor Souza, com o e-mail noreply do GitHub). Sem `--author`, sem rodapé de IA (a
  seção 6 do `COMECE-AQUI.md`), e nunca `git config` numa worktree.
- **`git add` com o caminho de cada arquivo.** Nunca `-A` nem `.`.
- **Antes de cada commit,** o `varrer-texto.mjs` nos arquivos da fase, todos "limpo". O commit é um comando à parte,
  rodado depois de ler a saída dos testes.
- **A guarda do diff** (`guarda-celular-2.mjs`) roda no fim de cada fase e sai com 0.
- **As suítes em cada fase de código:** o typecheck, o lint, os puros e os de tela rodam inteiros. A integração roda
  uma vez, sobre o estado final, com o Docker aberto pelo Victor.
- **A regra de divergência:** se o blob, o patch-id, a guarda, a varredura ou uma contagem não baterem com o plano,
  pare. Não ajuste nada: mande a saída inteira à auditoria e espere.
- **Nenhum roteiro roda sem o "pode" da auditoria**, nem para testar. Um bloco que a ferramenta levar para segundo
  plano não roda de novo: espere o aviso de término e mande a saída inteira (o 362).
- **A trava do banco** (os achados 351 e 371): antes de cada suíte, do build, do verify e da integração, a linha que
  procura uma variável com URL de banco pelo VALOR, e não só pelo nome:
  `node -e 'const a=Object.entries(process.env).filter(([k,v])=>/^postgres(ql)?:\/\//i.test(v||"")).map(([k])=>k); if(a.length){console.log("variável com URL de banco:",a.join(", "),": pare");process.exit(1)} console.log("nenhuma variável com URL de banco")' || exit 1`
- **`npx --no-install`** sempre (o 372). O `npm` só roda como está escrito aqui.
- **Os registros com cor:** as contagens se leem sem os códigos ANSI (`sed 's/\x1b\[[0-9;]*m//g'`).
- **O DEV não usa credencial nem o banco de produção.** As únicas leituras dele na produção são os GETs públicos e sem
  cookie do Envio 6 (o 357). A leitura do deploy e da prévia é da auditoria, pelo conector da Vercel, só com
  ferramentas de leitura.
- **No corpo do PR e no repositório,** nenhuma arroba solta, nem e-mail, nem conta, nem dado de cliente: o
  repositório é público.
- **O fim de linha.** A cópia tem `core.autocrlf=true`: o git põe os arquivos que já existiam em CRLF, e o extrair
  grava os novos em LF. Os roteiros mantêm o fim de linha que cada arquivo tem, e o `git hash-object` dá o mesmo blob
  nos dois casos.

## Mapa dos arquivos

| Arquivo | Fase | O que é |
|---|---|---|
| `docs/specs/2026-11-24-celular-onda-1.md` | Passo 2 | a spec com a emenda do PR 2 |
| `docs/plans/2026-11-26-celular-onda-1-pr2.md` | Passo 3 | este plano (novo) |
| `testes-dom/quadro-no-celular.dom.tsx` | F1 | o teste de tela do quadro (novo) |
| `lib/calendario.ts` e `tests/calendario-lista.test.ts` | F2 | a lista do calendário e o teste dela (novo) |
| `app/publicar/page.tsx` | F3 | a grade só no computador, a lista no celular, o cartão como função e o vazio |
| `app/publicar/post/[id]/page.tsx`, `app/automacoes/list-client.tsx` e `app/automacoes/editor/quadro.tsx` | F4 | os alvos de toque |
| `app/layout.tsx` | F5 | o comentário do `capable` |

E mais nenhum: a guarda do diff confere isso.

---

## Antes da execução: a caixa do Victor

Depois de a auditoria aplicar este plano do zero e os patch-ids baterem, a caixa do "Li, pode executar" vai ao Victor
com o essencial dentro:
- o que este PR muda: no celular, o calendário de Publicações vira uma lista por dia; o Remarcar, o "Cancelar este
  post" e o Pausar/Ativar ficam do tamanho do dedo; o editor das automações ganha um teste para o aviso; no
  computador, nada muda, a não ser o mínimo de 24 px de dois links;
- **a linha do 375:** o ensaio mostrou que o cartão do calendário tem de ficar escrito dentro da página, para os
  testes do projeto conseguirem lê-lo, e foi refeito assim;
- **o lembrete do e-mail privado** (o 333): no merge, o "Keep my email addresses private" do GitHub tem de estar
  ligado;
- **a primeira hora** (o 361): o merge acontece com tempo para a leitura de +50 minutos, ou fica para o dia seguinte.

Depois da caixa, a hora mandada à auditoria e o "pode" dela.

## Passo 0: os roteiros

Os roteiros vêm dos blocos do apêndice A. O primeiro, o `extrair-bloco.mjs`, é criado a partir do bloco dele por
qualquer meio e conferido pelo sha256; os outros saem do plano por ele (as pastas `e2`, `e3`, `e4` e `e5` são criadas
antes). Na pasta do DEV eles já existem, e só se confere o sha256.

| Roteiro | sha256 |
|---|---|
| `extrair-bloco.mjs` | `8585d040e92f75b0c9f05fa2491cd9a34c7066bac48c4389f6466a6ce307f52a` |
| `varrer-texto.mjs` | `2e5f91e9083f4873102269ec596fe2c62f97cc47d00a310f29898f08173c9a85` |
| `guarda-celular-2.mjs` | `f48c7ef7203f7a67aa0e8a8ca4126efa6586691c85e8cc16f6b4f091143d94ae` |
| `e2/aplicar-calendario.mjs` | `618e280237aaec0b77c5576be163b1a50aec1f1e54cdfd7b65e94101594a8301` |
| `e3/aplicar-publicar-2.mjs` | `f00348eea728ec0f210d1bb65b12366b5bb18abd0ab5262c88bf2f2ba42e78cf` |
| `e4/aplicar-e4.mjs` | `f34be4e58e604c85e9ac6d5b0fe2906a071dccd1c608b0e444bc2531aac3eeb6` |
| `e5/mutar-celular-2.mjs` | `ba41c2efe1d0d56af6e2b14eda8e213e67baaf04db4de6aefb63dc2c17f731b0` |

```bash
S="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/28ff177f-dfa7-439e-ba1a-dc70de81ea3c/scratchpad"
K="$S/celular2"
( cd "$K" && sha256sum extrair-bloco.mjs varrer-texto.mjs guarda-celular-2.mjs e2/aplicar-calendario.mjs e3/aplicar-publicar-2.mjs e4/aplicar-e4.mjs e5/mutar-celular-2.mjs )
for f in extrair-bloco.mjs varrer-texto.mjs guarda-celular-2.mjs e2/aplicar-calendario.mjs e3/aplicar-publicar-2.mjs e4/aplicar-e4.mjs e5/mutar-celular-2.mjs; do node --check "$K/$f" || { echo "a sintaxe de $f falhou: pare"; exit 1; }; done
echo "sintaxe dos sete roteiros: ok"
```

Esperado: os sete sha256 da tabela e "sintaxe dos sete roteiros: ok".

## Passo 1: a cópia da execução, saída da `main`

```bash
R="C:/Users/Usuario/varandas/MetodoChat"
S="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/28ff177f-dfa7-439e-ba1a-dc70de81ea3c/scratchpad"
C="$S/x"; K="$S/celular2"
MAIN=96b5cbbeaf8bc13850785b882a9e861339614bbf
test ! -e "$C" || { echo "a pasta da cópia já existe: pare"; exit 1; }
cd "$R" || exit 1
git fetch origin
test "$(git rev-parse origin/main)" = "$MAIN" || { echo "a main mudou: pare"; exit 1; }
test "$(git config user.email | sed 's/.*@//')" = users.noreply.github.com || { echo "o e-mail do git não é o noreply: pare"; exit 1; }
node -e 'const a=Object.entries(process.env).filter(([k,v])=>/^postgres(ql)?:\/\//i.test(v||"")).map(([k])=>k); if(a.length){console.log("variável com URL de banco:",a.join(", "),": pare");process.exit(1)} console.log("nenhuma variável com URL de banco")' || exit 1
git worktree add -b celular-2 "$C" "$MAIN" || { echo "o worktree add falhou: pare"; exit 1; }
cd "$C" || exit 1
if git rev-parse --abbrev-ref '@{upstream}' >/dev/null 2>&1; then echo "o ramo tem upstream: pare"; exit 1; fi
for f in .env*; do if [ -e "$f" ]; then echo "PARADO: $f existe na cópia"; exit 1; fi; done
: > .env.local
npm ci || { echo "o npm ci falhou: pare"; exit 1; }
echo "npm ci: ok"
echo "o maior caminho da cópia: $(find "$C" | awk '{ print length }' | sort -n | tail -1) caracteres"
git branch --show-current
git status --porcelain; echo "(status acima; vazio = limpo)"
node -p "'instalado: next ' + require('./node_modules/next/package.json').version"
node "$K/guarda-celular-2.mjs" "$C"; echo "guarda: $?"
```

Esperado: "nenhuma variável com URL de banco"; "npm ci: ok"; o maior caminho com no máximo 259 caracteres (a cópia do
ensaio deu 242; senão, avise antes de seguir: a limpeza vai precisar mover a pasta); o ramo `celular-2`; o status
vazio (o `.env.local` está no `.gitignore`); "instalado: next 16.4.6"; a guarda com "(nada mudou)" e 0.

## Passo 2: a spec (o commit que repete o `524164d`)

A spec já existe na `main`, e o extrair não grava por cima: ela sai do bloco para `$K/exec-spec.md` e é copiada.

<!-- bloco: docs/specs/2026-11-24-celular-onda-1.md -->
```markdown
# O painel no celular, onda 1: acompanhar pelo celular, com o ícone na tela inicial

**Nascido em:** 24/11/2026, sobre a `main` em `aadf566`. **A v2 é de 25/11/2026**, com a medição de base (a Fase 0)
e as decisões que dependiam dela. **A v3, do mesmo dia,** traz a medição da tabela da Atividade antes do plano (o
achado 349). **A emenda do ensaio, também de 25/11,** troca o 404 do `/favicon.ico` por um redirect (o achado 352) e
traz as cores do ícone que o Victor escolheu depois de vê-lo. **A emenda do PR 2, de 26/11/2026, sobre a `main` em
`96b5cbb`,** vem da releitura da auditoria antes do ensaio do PR 2 (os achados 365 a 369), corrige o texto do
`capable` (o achado 360) e registra que as provas sem sessão e a do iPhone do PR 1 foram para a produção (o achado
356). **O ensaio do PR 2, no mesmo dia,** mostrou que o cartão do calendário tem de ser uma função chamada no corpo da
página, e não um componente filho, porque a integração não lê componente filho (o achado 375).

**As decisões do Victor, em 24/11/2026 (à tarde, pela caixa):**
- **O uso é "acompanhar".** As alternativas eram "acompanhar e criar posts" e "tudo igual ao computador".
- **Só o ícone na tela inicial.** Sem avisos (push) e sem funcionar offline. Os avisos, se um dia vierem, serão uma
  entrega própria.
- **O caminho A:** as telas que já existem se ajustam ao tamanho, no mesmo endereço. Não há telas separadas para o
  celular, nem zoom com rolagem lateral.
- **Mudança de decisão:** pela manhã, o Gerador estava na onda 1. Com o "acompanhar", a montagem do carrossel fica no
  computador, e o Gerador SAI da onda 1.
- **O ícone:** o "M." no azul do painel ("\"M.\" no azul do painel (Recomendado)"), feito no código. Ele é uma redução
  da marca "MetodoChat." da tela (`app/app-shell.tsx:183`), em papel `#fbfaf8` sobre a cor de ação `#1a5a6c`
  (`app/globals.css:54` e `:102`).
- **O favicon da aba muda também** ("Sim, trocar também (Recomendado)").

**As decisões do Victor, em 25/11/2026 (pela caixa, com os números da Fase 0 dentro da pergunta):**
- **O calendário de Publicações:** "Virar lista por dia (Recomendado)". A alternativa era deixar como está.
- **A tabela da Atividade:** "Fazer a tabela caber (Recomendado)". As alternativas eram virar cartões ou deixar como
  está.
- **O tamanho dos alvos de toque:** "44 nos principais, 24 no resto (Recomendado)". A alternativa era 44 em tudo.
- **A letra do ícone:** "Desenhar o M. (Recomendado)". A alternativa era usar a fonte do painel, com um arquivo de
  fonte no repositório.
- **O celular da prova:** "iPhone".
- **As cores do ícone (mudança de decisão, depois de ver o ícone no azul):** "Não gostei da forma que ficou, pode
  deixar o fundo mais escuro, quase um preto", "ou da cor do background do método chat". Pela caixa:
  - o fundo: "Fundo do painel, tema escuro (Recomendado)", o `#0b0a0e` (`--color-papel-escuro`,
    `app/globals.css:58`). A alternativa era o `#17161a` (`--color-tinta`, `:65`);
  - a barra do celular: "Acompanha o preto (Recomendado)". A alternativa era continuar no azul;
  - o ponto do "M.": "Ponto azul claro (Recomendado)", o `#78bacd` (`--color-acao-escuro`, `:104`). A alternativa
    era o ponto claro, igual ao "M".
  - O "M" continua em papel `#fbfaf8`.
- **A tela de abertura do Android:** "Preto, igual ao ícone (Recomendado)", o `#0b0a0e`. A alternativa era o fundo
  claro. O custo: quem usa o tema claro vê a abertura preta virar o painel claro. No iPhone, essa tela não aparece.

---

## O que foi medido

### No código e no guia do Next (24/11)

**O guia do Next foi lido na versão instalada, a 16.4.6,** numa cópia de leitura sem ramo (`git worktree add
--detach` na `aadf566`, com `npm ci` próprio e `.env.local` vazio). O `node_modules` da pasta principal ainda é o da
16.4.3 (o achado 335). Os caminhos abaixo são de `node_modules/next/dist/docs/01-app/03-api-reference/`:
- **`03-file-conventions/01-metadata/manifest.md`:** o manifesto pode ser um arquivo estático ou um
  `app/manifest.ts` que devolve um `MetadataRoute.Manifest` (`:20-47`). Gerado, ele é um Route Handler especial, em
  cache por padrão (`:24`).
- **`03-file-conventions/01-metadata/app-icons.md`:**
  - o `favicon` só pode ser um `.ico` estático no topo de `app/` (`:18` e `:24`), e não pode ser gerado (`:171`);
  - o `icon` e o `apple-icon` podem ser gerados no código, com o `ImageResponse` de `next/og` (`:70-81`);
  - o `<head>` ganha `<link rel="icon" href="/icon?<generated>">` e `<link rel="apple-touch-icon"
    href="/apple-icon?<generated>">` (`:40-59`), e vários tamanhos saem de um arquivo só pelo
    `generateImageMetadata` (`:170`).
- **`04-functions/generate-viewport.md`:** a cor da barra (`themeColor`) vai no `export const viewport` do layout
  (`:21-33` e `:71-93`), e o `<meta name="viewport">` já sai sozinho (`:124`).
- **`node_modules/next/dist/lib/metadata/is-metadata-route.js`:** os nomes reconhecidos são `icon`, `apple-icon`,
  `favicon`, `manifest.webmanifest` e também `manifest.json` (`:116`, o achado 342).

**O favicon atual NÃO é do projeto.** O `app/favicon.ico` tem 25 931 bytes e 4 camadas (16, 32 e 48 em BMP de 32 bpp,
e 256x256 em PNG). A camada de 256 é um círculo preto com um triângulo branco: o logotipo da Vercel, que o
`create-next-app` traz por padrão. O `git log -- app/favicon.ico` tem só o `1ff1bc2` "initial commit", de 28/07/2026.

**A letra da marca** é a IBM Plex Sans 600: a marca usa `font-semibold` (`app/app-shell.tsx:181`), que herda a
`--font-sans` (`app/globals.css:150`), declarada em `app/layout.tsx:46-50`. O `ImageResponse` traz só o
Geist-Regular; outra família pede um arquivo de fonte no repositório (o achado 336).

**O porteiro (`proxy.ts`):**
- os caminhos públicos estão em `PUBLIC_PREFIXES` (`:14-26`), e a conferência é por prefixo: o caminho igual, ou
  começando por ele seguido de `/` (`:30`);
- o matcher tira do porteiro só `_next/static`, `_next/image` e `favicon.ico` (`:46-48`). O comentário das
  `:42-45` conta por que não se libera por extensão (`docs/specs/2026-10-26-sessao-conferida.md`);
- `tests/proxy-matcher.test.ts` confere o matcher pelo verificador do Next, e `tests/proxy-ordem.test.ts` confere que
  os caminhos públicos passam antes da consulta da sessão.

**Sem login, o celular não instala o ícone.** O navegador busca o manifesto e os ícones sozinho, e o porteiro manda
para `/entrar` todo endereço que não está na lista pública. Por isso, os endereços do manifesto e dos ícones têm de
ser públicos.

**O layout (`app/layout.tsx`)** tem só o `metadata` com o título e a descrição (`:68-71`). Não tem `viewport`, nem
manifesto, nem ícone de tela inicial.

**A casca no celular já existe** (`app/app-shell.tsx:335-372`): uma barra no topo com a marca e o botão "Abrir menu"
(`:341`), e uma gaveta com o botão "Fechar menu" (`:358`). Os links do menu são `py-2 text-sm` (`:149`), num
componente que a barra lateral do computador também usa.

**O editor das automações já tem o aviso do celular** (`app/automacoes/editor/quadro.tsx:1536-1551`). Abaixo de
640 px (`sm:hidden`), ele diz "A edição das automações é pelo computador — o quadro precisa de arrastar e soltar" e
mostra os blocos em modo leitura. O "Salvar automação" só aparece de 640 px para cima (`:1450`). Nenhum teste confere
esse aviso.

**As ações da onda 1 já existem:** `cancelarPublicacao` (`app/publicar/post/actions.ts:139`) e `remarcarPublicacao`
(`:231`).

### Na produção, em 390x844 (a Fase 0, 25/11)

Medida pela auditoria, só lendo, no Chrome do Victor e com a caixa dele, na `aadf566`, das 10:15:52 às 10:16:54. As 8
rotas valem: `innerWidth = 390` e nenhuma parte pendente em todas. O resultado completo está no registro da auditoria,
sem dado de cliente (o achado 338).

| Rota | Rola a página? | Alvos | Abaixo de 44 | Abaixo de 24 | Caixa que rola de lado |
|---|---|---|---|---|---|
| `/` | não | 11 | 7 | 3 | — |
| `/desempenho` | não | 2 | 2 (a casca) | 0 | — |
| `/eventos` | não | 49 | 41 | 25 | a tabela: 417 px numa caixa de 356 |
| `/publicar` | não | 21 | 21 | 1 | o calendário: 640 px numa caixa de 356 |
| `/publicar/agendados` | redireciona para `/publicar` | | | | |
| `/publicar/post/[id]` | não | 4 | 3 | 1 | — |
| `/automacoes` | não | 442 | 442 | 0 | — |
| `/automacoes/[id]` | não | 1 | 1 | 1 | — |

- **Nenhuma página rola na horizontal hoje.** Os problemas estão dentro das caixas.
- **A tabela do `/eventos`** (`app/eventos/page.tsx:223`) esconde 61 px (15%) dentro do `tableWrap`, que já é
  `overflow-x-auto` (`app/ui.ts:367-368`). A causa é a coluna "Quando", com `whitespace-nowrap`
  (`app/eventos/page.tsx:279`): a data sai cortada.
- **O calendário do `/publicar`** tem `min-w-[640px]` (`app/publicar/page.tsx:404`) e esconde 284 px (44%): só
  aparecem domingo a quarta. Os cartões dos posts saem cortados. A visão "Semana" usa a mesma grade de 7 colunas
  (`:404-416`), então também rola.
- **Os alvos:** são 517 abaixo de 44 e 31 abaixo de 24. Os botões "Abrir menu" e "Fechar menu" têm 36x36, e os 12
  links do menu na gaveta, 240x36. Os 31 abaixo de 24 são de 7 tipos:
  - 25 "Ver detalhes técnicos", com 16 de altura (`app/eventos/page.tsx:380`);
  - "Reconectar", com 16 (`app/page.tsx:419`);
  - "Criar post →" e "Ver a atividade →", com 18 (`app/page.tsx:552` e `:561`);
  - o "+N" do calendário, com 17;
  - "Ver no LinkedIn ↗", com 20 (`app/publicar/post/[id]/page.tsx:278`);
  - "← Automações", com 20 (`app/automacoes/editor/quadro.tsx:1410`).
- **O Remarcar e o "Cancelar este post"** (`app/publicar/post/[id]/page.tsx:315` e `:327`) não foram medidos na tela:
  nenhum dos posts da lista estava pendente. Pelo código (`btnGhost` e `btnDanger`, `app/ui.ts:183-187`), os dois têm
  30 px de altura.
- **O "Pausar" e o "Ativar" da lista de automações** (`app/automacoes/list-client.tsx:331-338`, `btnLinha`) têm 28 px
  de altura, como os outros três botões de cada linha.
- **O console:** nenhum erro do app. O único erro é de uma extensão do Chrome do Victor, que aparece em toda página
  (o achado 346).

### A tabela da Atividade, antes do plano (o achado 349, 25/11)

A prévia só existe depois do plano, e o ensaio, com o `.env.local` vazio, não monta o `/eventos` com dados. Por isso,
a auditoria mediu na produção, só lendo, com a caixa do Victor, em 390x844, das 10:34:24 às 10:34:42. Ela pôs regras
de CSS só na aba dela, sem nada ir ao servidor, e recarregou a página antes de cada variante. A data tem o formato
"99/99/9999, 99:99", com um espaço comum depois da vírgula. A caixa da tabela tem 356 px visíveis.

| Variante | Total da caixa | Colunas (Para quem / O que / Quando) | Rola? |
|---|---|---|---|
| (0) hoje | 417 | 192 / 96 / 129 | sim |
| (a) "Quando" sem `whitespace-nowrap` | 382 | 192 / 96 / 94 | sim |
| (b) a (a) mais `px-2` nas células | 358 | 184 / 88 / 86 | sim, por 2 px |
| (c) a (b) mais a hora noutra linha | 356 | 184 / 89 / 83 | não, com folga zero |
| (d) a (b) mais o nome com até 7rem | 356 | 160 / 104 / 92 | não |
| (e) a (d) mais a hora noutra linha | 356 | 160 / 113 / 83 | não |

- **Mudar só o "Quando" não basta:** a (b) ainda rola.
- **A (c) cabe só com os nomes de hoje.** A coluna mais larga é a "Para quem". O nome tem `truncate`
  (`app/eventos/page.tsx:269`), dentro de um `flex` (`:262`), mas uma célula de tabela cresce com o conteúdo, e o
  `truncate` nunca corta. Um nome mais longo faria a tabela voltar a rolar.
- **A (d) cabe com folga, e ela não depende do nome:** a coluna do nome fica no teto (8 + 24 do avatar + 8 + 112 + 8 =
  160), e a sobra (uns 22 px) vai para as outras duas. O pedaço mais largo do "Quando" é o "25/11/2026," (70 px).
- **Na (d), 3 dos 12 nomes de hoje aparecem cortados com "…"** no celular. Para "acompanhar", isso é aceitável, e o
  nome inteiro continua no computador.
- A (e) não acrescenta nada à (d).

### Na releitura para o PR 2 (26/11)

Medido pela auditoria e pelo DEV na `main` em `96b5cbb`, só lendo. Os arquivos que o PR 2 toca não mudaram no PR 1
(o `git diff --stat aadf566 96b5cbb` não traz nenhum deles), e as linhas citadas na parte do PR 2 batem.
- **A janela da consulta tem um dia de folga de cada lado** (`app/publicar/page.tsx:136-140`), e a consulta traz os
  posts da janela inteira (`:258-266`). Na visão "Mês", a grade tem 42 casas, e as do mês vizinho (`doMes: false`,
  `lib/calendario.ts:133-135`) também mostram os posts delas.
- **O "fora deste período"** (`app/publicar/page.tsx:290-295`) conta só os pendentes FORA da janela. Um post que cai
  só na folga entra em `itens`, mas não entra em nenhuma casa, nem na contagem.
- **O vazio,** "Nada marcado neste período." (`:596-606`), aparece quando `itens.length === 0`.
- **O cartão do post na grade** (`:444-537`) junta a capa ou o ícone (`cartaoDoPost`), o ponto de estado (saiu ou
  atrasado, `avisoDoAtrasoNaLista`), a hora, o rótulo (com `truncate`, `:531`) e o `href` que carrega a âncora
  (`:474-477`).
- **A leitura dos testes de integração não desce em componente filho** (`testes-integracao/texto-da-arvore.ts:37-53`).
  O `textoDaArvore` anda pela árvore que a página devolve e lê o texto, a `key` e os `props` simples, sem chamar o
  `type` de elemento nenhum. A regra prática está escrita lá: o que um caso de integração precisa LER tem de ser
  escrito no corpo da página, e não num componente filho. O `app/page.tsx:474-475` repete a regra: é por ela que o
  estado calmo do Início é escrito no corpo. Os casos de `agendados`, `linkedin-telas` e `nao-saiu` leem o cartão do
  calendário por ele (o achado 375).
- **A ordem já chega pronta.** A consulta ordena por `coalesce(sent_at, not_before), id` (`:264`). Essa é a mesma
  data que o `dataDaLinhaDeEnvio` usa (`lib/publicacao.ts:1927-1932`), e o `agruparPorDia` agrupa por ela
  (`app/publicar/page.tsx:309`), mantendo a ordem de chegada (`lib/calendario.ts:252-256`). Os dias já vêm em ordem
  nas `grade.casas`.
- **Nenhum teste de tela monta o quadro do editor:** nenhum arquivo de `testes-dom/` importa `editor/quadro`. O quadro
  importa o `@xyflow/react` e o CSS dele (`app/automacoes/editor/quadro.tsx:4-15`), e a ação de servidor
  `salvarAutomacao` (`:43`). O `ReactFlow` está em `:1644`, e o aviso, fora dele, em `:1546-1551`. A suíte de tela
  roda no jsdom (`vitest.dom.config.ts:48` e `:53`).
- **O `capable` já sai como `true`.** Quando o `appleWebApp` existe sem a chave, o Next o resolve como `true`
  (`node_modules/next/dist/lib/metadata/resolvers/resolve-basics.js:197`, lido na 16.4.3 da pasta principal, o
  achado 335; a linha da 16.4.6 se confere no ensaio). A auditoria mediu na produção, em 26/11 (um GET do `/entrar`,
  sem cookie), o `<meta name="mobile-web-app-capable" content="yes"/>` no `<head>` (o achado 360).

---

## As regras de tela (o que a prova mede)

Em 390 px de largura, em cada rota da onda 1:
- **nada rola na horizontal:** `document.documentElement.scrollWidth <= innerWidth`;
- **a tabela do `/eventos` cabe:** a caixa dela não rola (`scrollWidth <= clientWidth`);
- **o calendário do `/publicar` vira a lista por dia** abaixo de 640 px (o `sm` do Tailwind, o mesmo corte que o
  editor já usa). Acima disso, fica como está;
- **os alvos de toque**, pela decisão do Victor:
  - **44x44 px nos principais:** o "Abrir menu", o "Fechar menu", os 12 links do menu na gaveta, o Remarcar, o
    "Cancelar este post" e o "Pausar"/"Ativar" das automações;
  - **24 px, no mínimo, no resto.** Um link dentro de um parágrafo de texto corrido não conta;
  - 44 é o guia da Apple e o nível AAA do WCAG (2.5.5); 24 é o nível AA (2.5.8) (o achado 340);
- **nenhum erro do app no console.** Os erros de extensão do navegador (com `chrome-extension://`) ficam fora da
  conta (o achado 346);
- **o computador não muda:** os ajustes de tamanho valem abaixo do corte de cada um (640 px para o conteúdo e 1024 px,
  o `lg`, para a casca), e nada muda no computador, a não ser os mínimos de 24 px;
- **o que existe se segue:** os tokens de `app/ui.ts` e a `docs/auditoria-de-design-2026-09-10.md`. Nada de cor, raio
  ou tamanho novo fora do sistema.

---

## O que muda: o PR 1 (o ícone, o porteiro e a casca; e Início, Desempenho e Atividade)

### O ícone e o manifesto

- **O desenho do "M." mora num módulo só,** usado pelo `icon.tsx` e pelo `apple-icon.tsx`. Ele é desenhado como
  caminho SVG, sem fonte e sem arquivo binário, pela decisão do Victor. O fundo é quadrado e cheio em `#0b0a0e`, o
  "M" vai em `#fbfaf8` e o ponto em `#78bacd`, centralizados e dentro dos 80% do meio, para o Android poder recortar o ícone em
  círculo sem cortar a letra. Ele fica parecido com a letra do painel, mas não idêntico.
- **`app/icon.tsx` (novo):** o `generateImageMetadata` dá três tamanhos: 32 (a aba), 192 e 512 (a tela inicial).
- **`app/apple-icon.tsx` (novo):** o mesmo desenho, em 180x180, para o iPhone.
- **O nome e a descrição moram numa constante só** (por exemplo, em `lib/marca.ts`), usada pelo `metadata` do layout
  e pelo manifesto (o achado 343).
- **`app/manifest.ts` (novo):**
  - `name` e `short_name`: "MetodoChat";
  - `description`: a mesma constante do `metadata`;
  - `lang`: `pt-BR`;
  - `start_url`: `/`;
  - `display`: `standalone`;
  - `background_color`: `#0b0a0e`;
  - `theme_color`: `#0b0a0e`;
  - `icons`: o de 192 e o de 512, com os endereços medidos no build. O de 512 entra também com o
    `purpose: "maskable"`.
- **`app/layout.tsx`:**
  - ganha `export const viewport = { themeColor: "#0b0a0e" }`;
  - ganha, no `metadata`, o `appleWebApp` com `title: "MetodoChat"`, que dá o nome do ícone na tela de início do
    iPhone;
  - **o `capable` não é escrito, e mesmo assim sai como `true`** (o achado 360, que corrige a v3: ela dizia que ele
    "fica fora"). Sem a chave, o Next o resolve como `true` e escreve `<meta name="mobile-web-app-capable"
    content="yes">` (`node_modules/next/dist/lib/metadata/metadata-elements.js:446-452`; a seção "Na releitura para o
    PR 2"). Quem faz o app abrir sem a barra de endereço continua sendo o `display: standalone` do manifesto (o achado
    339), e a meta não atrapalha. A prova no iPhone mede isso. Se ele abrir com a barra de endereço, a causa não é a
    falta do `capable`, e o caso volta à auditoria. O comentário de `app/layout.tsx:71-74`, que repete o texto da v3,
    é corrigido no PR 2. O código não muda, porque o `<head>` já é o desejado.
- **O favicon:** há duas opções. A spec escolhe a (1).
  - **(1) Apagar o `app/favicon.ico`** e deixar o desenho só no `icon.tsx` e no `apple-icon.tsx`.
    - É uma fonte só para o desenho, sem binário versionado e sem roteiro de uso único. Quando vier um logo, troca-se
      um arquivo.
    - O navegador usa o `<link rel="icon">` do `<head>`, e só pede o `/favicon.ico` quando não há link.
    - O ensaio mediu o custo (os achados 341 e 352): no build, o `/_not-found` é dinâmico (ƒ), como já era antes
      desta entrega, porque o layout lê cookies (`app/layout.tsx:97-98`). Sem o arquivo, cada pedido ao
      `/favicon.ico` viraria uma chamada de função e, com o cookie da sessão, duas consultas ao banco (o
      `sessaoAtual()` e o `contasDoLogin()`).
    - **Por isso, o `/favicon.ico` leva ao ícone novo por um redirect no `next.config.ts`**, para o `/icon/32`, com
      `permanent: false` (um 307, que não fica em cache: `redirects.md:30`). O redirect do `next.config` roda antes
      do porteiro e antes dos arquivos (`proxy.md:243-246` e `redirects.md:39`, no guia da 16.4.6). O
      `next.config.ts` já tem um redirect, o do `/loja` (`:24`).
    - O servidor local não sobe sem um banco com o esquema (o `instrumentation.ts`, o achado 353). Por isso, o
      `<head>`, os códigos sem sessão e o 307 do favicon se medem na prova na prévia.
    - O `/favicon.ico` continua em `PUBLIC_PREFIXES` e no matcher, como está.
  - **(2) Um roteiro que gera o `.ico` novo** a partir do mesmo desenho, rodado uma vez, com o sha registrado.
    - Cria duas cópias do mesmo desenho.
    - Depende de o `ImageResponse` rodar fora do servidor do Next, o que ninguém mediu.
    - Só entra se o ensaio mostrar um problema com a (1).
- **Um logo de verdade, depois,** troca só o módulo do desenho. Os endereços liberados no porteiro continuam os
  mesmos.

### O porteiro

- **Uma lista nova, `PUBLIC_EXATOS`, em `proxy.ts`,** com os endereços exatos que o build serve para o manifesto e os
  ícones. A conferência é só de igualdade (`pathname === p`, sem a query), e não de prefixo. Pelo guia, os endereços
  devem ser `/manifest.webmanifest`, os do `/icon` (um por tamanho) e o do `/apple-icon`. **A forma exata (com ou sem
  sufixo e com o número do tamanho) é medida no build do ensaio e só então entra na lista.**
- **A ordem se mantém:** os exatos passam antes da consulta da sessão, como os outros públicos
  (`tests/proxy-ordem.test.ts`).
- **O matcher não muda:** esses endereços passam pelo porteiro, e é a lista que os libera.

### A casca

- **"Abrir menu" e "Fechar menu"** (`app/app-shell.tsx:342` e `:359`): passam de `p-2` a `p-3`. Com o ícone de 20 px,
  ficam com 44 px de lado. Eles só existem abaixo de 1024 px.
- **Os 12 links do menu** (`:149`): ganham altura mínima de 44 px abaixo de 1024 px, onde a gaveta existe. A barra
  lateral do computador não muda.

### Início

- "Reconectar" (`app/page.tsx:419`), "Criar post →" (`:552`) e "Ver a atividade →" (`:561`) sobem para 24 px de
  altura, no mínimo.

### Desempenho

- Nada além da casca: a página não tem outro alvo de toque e não rola.

### Atividade

- **A tabela cabe, pela variante (d) medida** (a seção "A tabela da Atividade, antes do plano"). Só com classes,
  abaixo de 640 px, sem mexer no texto da data. Acima de 640 px, fica como está:
  - o nome (`app/eventos/page.tsx:269`) ganha largura máxima de 7rem, e o `truncate` passa a cortar com "…";
  - as células da tabela passam de `px-3` para `px-2`;
  - o "Quando" (`:279`) fica `whitespace-nowrap` só de 640 px para cima.
- A prova na prévia só confirma que a caixa da tabela não rola em 390 px.
- **"Ver detalhes técnicos"** (`:380`): o `summary` sobe para 24 px de altura, no mínimo.

## O que muda: o PR 2 (Publicações e Automações)

O PR 2 segue os moldes que o PR 1 deixou na `main`: os 44 px com a volta no corte (`min-h-11 lg:min-h-[auto]`, em
`app/app-shell.tsx:149`), os 24 px de um link (`inline-flex min-h-6 items-center`, em `app/page.tsx:418`, `:551` e
`:560`) e as classes que só valem abaixo de 640 px com a volta no `sm:` (`app/eventos/page.tsx:226-228` e `:269`).

### Publicações

- **O calendário vira uma lista por dia abaixo de 640 px** (`app/publicar/page.tsx:404`):
  - a grade de 7 colunas fica só de 640 px para cima;
  - **abaixo disso, a lista mostra exatamente as casas da grade que têm posts, na ordem da grade, as do mês vizinho
    também** (o achado 365). A lista mostra o mesmo que a grade. Se ela tirasse os dias do mês vizinho, um post do
    dia 1/12, visto na grade de novembro, sumiria da lista do celular sem contagem nenhuma, porque o "fora deste
    período" (`:290-295`) só conta o que está fora da janela. Isso iria contra o "quem corta tem de contar"
    (`:539-541` e `lib/calendario.ts:264-265`);
  - cada dia tem um título com o dia da semana, o dia e o nome do mês, com os mesmos nomes da grade
    (`DIAS_DA_SEMANA` e `MESES`, `lib/calendario.ts:27-32`), por exemplo "ter, 1 de dezembro". Com o mês no título, o
    dia do mês vizinho não se confunde com um dia do mês da grade;
  - **os posts de cada dia vêm no mesmo cartão da grade** (o achado 366). O cartão (`:444-537`) vira uma função só,
    a `cartaoDoCalendario`, no mesmo arquivo, chamada no corpo da página pela grade e pela lista. Escrever outro
    cartão para a lista criaria duas fontes para as mesmas decisões (a capa, o ponto de estado, a hora, o rótulo e a
    âncora do `href`), o defeito que o próprio arquivo condena em `:304-308`. Na lista, só muda que o rótulo não
    corta: a hora e o tipo inteiros, sem o `truncate` de `:531`;
  - **o cartão é uma FUNÇÃO chamada no corpo, e não um componente filho** (o achado 375). A leitura dos testes de
    integração não desce em componente filho (`testes-integracao/texto-da-arvore.ts:37-53` e `app/page.tsx:474-475`):
    com um `<CartaoDoCalendario />`, o `href` e o rótulo do cartão somem do texto que eles leem. No ensaio de 26/11, o
    cartão como componente derrubou 4 casos da integração (em `agendados`, `linkedin-telas` e `nao-saiu`), e um
    `not.toContain` sobre o cartão (`testes-integracao/linkedin-telas.integracao.ts:299`) passaria a ficar verde sem
    ler nada. Por isso o nome começa com minúscula, a função não usa hook, e o `key={item.id}` fica no `Link` que ela
    devolve, como está hoje;
  - vale para a visão "Mês" e para a "Semana". A navegação ("‹", "›", "Hoje", "Semana" e "Mês") continua igual;
  - o "+N" de um dia cheio não aparece na lista, porque ela mostra todos os posts do dia;
  - **abaixo de 640 px, o vazio aparece quando a LISTA está vazia** (o achado 365). Um post que cai só na folga da
    janela entra em `itens`, mas em nenhuma casa. Com o vazio de hoje (`itens.length === 0`, `:599`), a lista
    ficaria em branco, sem a frase. De 640 px para cima, o vazio continua como está;
  - **a montagem da lista é uma função pura em `lib/calendario.ts`,** com teste próprio. Ela recebe as casas da grade
    (`gradeDoMes`, `:137`, ou `gradeDaSemana`, `:166`) e o `porDia` (`app/publicar/page.tsx:309`) e devolve as casas
    com posts, com os posts de cada uma e o título do dia. **Ela não ordena nada** (o achado 367): os dias já vêm em
    ordem nas casas, e os posts de cada dia já chegam em ordem de hora (a seção "Na releitura para o PR 2"). Uma
    segunda ordenação seria uma segunda fonte da ordem.
- **O post (`/publicar/post/[id]`):**
  - o Remarcar (`:315`) e o "Cancelar este post" (`:327`) ganham altura mínima de 44 px abaixo de 640 px;
  - "Ver no LinkedIn ↗" (`:278`) sobe para 24 px, no mínimo.

### Automações

- **A lista (`/automacoes`):** o "Pausar" e o "Ativar" (`app/automacoes/list-client.tsx:331-338`) ganham altura mínima
  de 44 px abaixo de 640 px. "Editar", "Criar uma cópia" e "Excluir automação" ficam com os 28 px de hoje, acima dos
  24. As alturas ficam misturadas na mesma linha (o achado 350). A foto da prova mostra como fica e, se parecer
  defeito, o alinhamento entra neste PR.
- **O editor (`/automacoes/[id]`):**
  - o aviso já existe (`quadro.tsx:1546-1551`). Esta entrega o cobre com um teste de tela que monta o quadro (a
    seção "Os testes", o achado 368);
  - "← Automações" (`quadro.tsx:1410`) sobe para 24 px, no mínimo.

## O que fica de fora

- Abrem no celular, mas sem ajuste: `/publicar/novo`, `/carrosseis*`, `/bonus*` e o desenho das automações.
- A onda 2: Conversas, Contatos, Configuração, Logins e Produtos.
- Os avisos (push), o modo offline e o service worker.
- **A sessão que cai sem rastro (o achado 347):** o `sessaoDoCookie` engole o erro do banco e devolve `null`
  (`lib/sessao.ts:17-23`), e o porteiro manda para `/entrar` sem registro. Para quem usa, uma falha do banco parece um
  "fui deslogado". Isso já existia e fica para uma entrega à parte: registrar o erro no `catch`.
- O banco não muda, e não há migração.

## Os testes

O layout não se mede no jsdom. Por isso, os testes cobrem o que é lógica, e a prova na prévia mede o resto.

- **O manifesto (puro, novo):** o `app/manifest.ts` devolve o nome, o `start_url` `/`, o `display` `standalone`, as
  duas cores e os ícones de 192 e 512 com os endereços medidos. A descrição é a mesma do `metadata`.
- **O porteiro (puro, no estilo de `tests/proxy-ordem.test.ts`):**
  - cada endereço de `PUBLIC_EXATOS` passa sem sessão e sem consultar a sessão;
  - os vizinhos parecidos continuam pedindo sessão: o endereço exato com `/x` no fim, `/icon-qualquer-coisa`,
    `/manifest.json` (enquanto não existir um `app/manifest.json`, o achado 342), `/apple-icon.png.x` e
    `/conversas/x.png`. A lista final sai da forma medida no build.
- **O favicon antigo (puro, novo):** o `redirects()` do `next.config.ts` leva o `/favicon.ico` ao `/icon/32`, com
  `permanent: false`.
- **A lista do calendário (puro, novo):** a função devolve só as casas com posts, na ordem das casas, com os posts de
  cada uma na ordem em que chegaram e o título de cada dia. Os casos:
  - na grade do mês, um post num dia do mês vizinho entra na lista, com o mês dele no título (o achado 365);
  - um post que cai só na folga da janela deixa a lista vazia (o achado 365);
  - dois posts do mesmo dia, entregues numa ordem qualquer, saem na mesma ordem: a função não ordena (o achado 367);
  - a semana que atravessa a virada do mês dá os dois meses nos títulos;
  - uma grade sem posts dá uma lista vazia.
- **O aviso do editor (tela, novo):** o teste monta o `Quadro` de `app/automacoes/editor/quadro.tsx`, e não um pedaço
  extraído dele, porque tirar o aviso do quadro tem de derrubar o teste (o achado 368). Os dublês:
  - a ação `salvarAutomacao`, por `vi.mock("@/app/automacoes/actions")`, no molde de
    `testes-dom/convites-no-setup.dom.tsx:7`;
  - o `ReactFlow` de `@xyflow/react`, trocado por um componente vazio, com o resto do módulo verdadeiro
    (`importOriginal`, no molde de `testes-dom/teto-nas-telas.dom.tsx:36`). O teste não confere o quadro de
    arrastar: o aviso mora fora do `ReactFlow`;
  - um `ResizeObserver` que não faz nada, por `vi.stubGlobal`, dentro do próprio teste (no molde de
    `testes-dom/bonus-capa-card.dom.tsx:35`). Ele é certo, e não um "talvez" (o achado 369): o quadro chama
    `new ResizeObserver` num efeito de montagem (`quadro.tsx:1187-1193`) sobre a `div` da faixa de edição (`:1831`),
    que fica FORA do `ReactFlow` (ele fecha em `:1816`), e o jsdom não tem `ResizeObserver`.

  O teste confere que o aviso "A edição das automações é pelo computador" aparece dentro de um elemento com
  `sm:hidden`, e que o "Salvar automação" fica dentro do elemento com `hidden` e `sm:flex` (`quadro.tsx:1450`).
  **O ensaio mede se o quadro monta assim, antes do plano.** Se ele pedir mais dublês além desses três, a lista volta
  à auditoria antes do plano.
- **A integração que já existe lê o cartão do calendário** (os casos de `agendados`, `linkedin-telas` e `nao-saiu`,
  pelo `textoDaArvore`). Ela já protege a forma do cartão: virar o cartão em componente filho derruba 4 desses casos,
  como o ensaio de 26/11 mediu (o achado 375).
- **As mutações:** cada proteção é estragada, uma por vez, e algum teste tem de cair. As mutações são:
  - trocar a igualdade de `PUBLIC_EXATOS` por prefixo;
  - tirar um endereço da lista;
  - pôr os exatos depois da sessão;
  - tirar o aviso do quadro;
  - mostrar o "Salvar automação" abaixo de 640 px (tirar o `hidden` de `quadro.tsx:1450`);
  - trocar o `display` do manifesto;
  - escrever a descrição à mão no manifesto, sem a constante (o achado 343);
  - tirar o redirect do favicon;
  - na lista do calendário: deixar entrar um dia sem posts, tirar os dias do mês vizinho e inverter a ordem.
- **O verify** limpo e a integração igual à `main`.

## A prova na prévia

**A auditoria mede,** com o navegador em 390x844 e com a caixa do Victor, só lendo, pelas regras de tela acima:
- cada rota da onda 1;
- numa aba em segundo plano, um quadro forçado antes de medir, com a contagem das partes pendentes. Uma rota com
  parte pendente não vale (o achado 345);
- sem sessão: `/manifest.webmanifest` e os ícones dão 200, com o tipo certo; o `/favicon.ico` dá 307 para o
  `/icon/32`; e
  `/icon-qualquer-coisa` vai para `/entrar`;
- o `<head>` com o `link rel="manifest"`, os ícones e o `theme-color`;
- o Remarcar e o "Cancelar este post" num post pendente da conta de provas, se houver um. Se não houver, eles ficam
  como "medidos pelo código".

**No PR 1, as medidas sem sessão foram para a produção,** depois do merge, e não para a prévia. A prévia tem a
proteção da Vercel (o `ssoProtection` com "all_except_custom_domains"), e um pedido sem o login da Vercel recebe o 401
dela, e não a resposta do app (o achado 356). **No PR 2, não há endereço novo sem sessão:** a auditoria mede as rotas
de Publicações e de Automações na prévia, com a sessão do Victor, numa aba aberta no perfil certo do Chrome dele (o
achado 359).

**O iPhone, no PR 1:** a prova foi para o domínio de produção (`metodochat.vercel.app`), e não para a prévia, pelo
mesmo motivo (o achado 356): o Safari do iPhone pediria o login da Vercel. Em 26/11, ela está pendente: o Victor a faz
quando estiver com o iPhone, e a caixa do resultado vem depois do "terminei" dele. **O PR 2 não mexe no ícone nem no
manifesto, e não tem prova no iPhone.** O Android fica sem prova nesta entrega.

**Os dados da Fase 0 que têm dado de cliente** (o `fase0.json` e as fotos, no scratchpad da auditoria) foram
apagados. A auditoria conferiu em 26/11 que não há `fase0.json` nem fotos, e os JSON que sobraram só têm números (os
nomes aparecem só como contagem).

## A entrega

- **Uma spec, dois PRs,** cada um com o ciclo inteiro: ensaio, plano, aplicação do zero pela auditoria, execução e
  envios.
  - **PR 1:** o ícone, o manifesto, o porteiro, a casca, e Início, Desempenho e Atividade.
  - **PR 2:** Publicações e Automações.
- **Um plano por PR.** O PR 2 sai da `main` depois do merge do PR 1. O PR 1 foi mesclado em 25/11 (o PR #43, com o
  merge `96b5cbb`), e a limpeza dele foi feita em 26/11.
- **Antes do próximo merge,** a caixa confere que o "Keep my email addresses private" continua ligado (o achado 333).
```

```bash
S="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/28ff177f-dfa7-439e-ba1a-dc70de81ea3c/scratchpad"
C="$S/x"; K="$S/celular2"; P="$K/plano.md"
cd "$C" || exit 1
test "$(git branch --show-current)" = celular-2 || { echo "não é o ramo da execução: pare"; exit 1; }
test -z "$(git status --porcelain)" || { echo "a árvore não está limpa: pare"; exit 1; }
node "$K/extrair-bloco.mjs" "$P" docs/specs/2026-11-24-celular-onda-1.md "$K/exec-spec.md" || { echo "o extrair parou: pare"; exit 1; }
cp "$K/exec-spec.md" docs/specs/2026-11-24-celular-onda-1.md || { echo "o cp da spec falhou: pare"; exit 1; }
test "$(git hash-object docs/specs/2026-11-24-celular-onda-1.md)" = 7d992edef7ff8f5055661f419b5c105666db3c56 || { echo "a spec não é a do ensaio: pare"; exit 1; }
sha256sum docs/specs/2026-11-24-celular-onda-1.md
node "$K/varrer-texto.mjs" docs/specs/2026-11-24-celular-onda-1.md
node "$K/guarda-celular-2.mjs" "$C"; echo "guarda: $?"
```

Esperado: o "GRAVADO" do extrair; o sha256 `579ead18865d187e96f5f0bc2953f7b48ea8426af4b83fc25dca76949e5c0955`, o da spec lida pela auditoria;
"limpo … (LF)"; a guarda com "dentro: docs/specs/2026-11-24-celular-onda-1.md" e 0. Depois, à parte:

```bash
cd "C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/28ff177f-dfa7-439e-ba1a-dc70de81ea3c/scratchpad/x" || exit 1
test "$(git branch --show-current)" = celular-2 && git add docs/specs/2026-11-24-celular-onda-1.md && git commit -m "A spec do celular registra a emenda do PR 2: a lista do calendário por dia, o cartão como função e o teste que monta o quadro"
git show HEAD | git patch-id --stable
```

Esperado: o patch-id `cca2040c951b65c2cfa62a05e8c5efe68e42f158`.

## Passo 3: este plano, num commit próprio

```bash
S="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/28ff177f-dfa7-439e-ba1a-dc70de81ea3c/scratchpad"
C="$S/x"; K="$S/celular2"
cd "$C" || exit 1
test "$(git branch --show-current)" = celular-2 || { echo "não é o ramo da execução: pare"; exit 1; }
test ! -e docs/plans/2026-11-26-celular-onda-1-pr2.md || { echo "o plano já existe na cópia: pare"; exit 1; }
cp "$K/plano.md" docs/plans/2026-11-26-celular-onda-1-pr2.md
cmp "$K/plano.md" docs/plans/2026-11-26-celular-onda-1-pr2.md && sha256sum docs/plans/2026-11-26-celular-onda-1-pr2.md
node "$K/varrer-texto.mjs" docs/plans/2026-11-26-celular-onda-1-pr2.md
node "$K/guarda-celular-2.mjs" "$C"; echo "guarda: $?"
```

Esperado: o sha256 que a auditoria leu; "limpo … (LF)"; a guarda com os dois "dentro" e 0. Depois, à parte:

```bash
cd "C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/28ff177f-dfa7-439e-ba1a-dc70de81ea3c/scratchpad/x" || exit 1
test "$(git branch --show-current)" = celular-2 && git add docs/plans/2026-11-26-celular-onda-1-pr2.md && git commit -m "O plano do PR 2 do celular: o ensaio refeito, a lista do calendário, o cartão como função e a prova na prévia"
git show HEAD | git patch-id --stable
```

Esperado: um patch-id, comparado com o da aplicação do zero.

## F1: o teste de tela do quadro (o commit que repete o `32e4ce3`)

A F1 não tem vermelho: o aviso e o Salvar escondido já existem no quadro (`quadro.tsx:1546-1551` e `:1450`), e o
teste os cobre pela primeira vez. A prova de que ele mede o que diz vem das mutações 1 e 2 (tirar o aviso e tirar o
`hidden` da caixa do Salvar), que o derrubam (o apêndice B).

<!-- bloco: testes-dom/quadro-no-celular.dom.tsx -->
```tsx
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// O EDITOR DAS AUTOMAÇÕES NO CELULAR (docs/specs/2026-11-24-celular-onda-1.md, os achados 368 e 369): abaixo de
// 640 px, o quadro diz que a edição é pelo computador e esconde o Salvar. O teste monta o `Quadro` de verdade, e
// não um pedaço extraído dele: tirar o aviso do quadro tem de derrubar este teste.
//
// OS TRÊS DUBLÊS, e só eles:
// - a ação de servidor `salvarAutomacao`, que o quadro importa (`quadro.tsx:43`) e que aqui nunca é chamada;
// - o `ReactFlow`, trocado por um componente vazio, com o resto do `@xyflow/react` verdadeiro. O aviso e o Salvar
//   moram fora dele, e o quadro de arrastar não é o que este teste confere;
// - o `ResizeObserver`, que o jsdom não tem. O quadro o cria num efeito de montagem sobre a faixa de edição, que
//   fica fora do `ReactFlow` (`quadro.tsx:1187-1193` e `:1831`).
//
// O `vi.mock` sobe para o topo do arquivo, antes de qualquer `const`: a ação de mentira nasce no `vi.hoisted`, que
// sobe junto.
const { salvarAutomacao } = vi.hoisted(() => ({ salvarAutomacao: vi.fn() }));
vi.mock("@/app/automacoes/actions", () => ({ salvarAutomacao }));

vi.mock("@xyflow/react", async (importOriginal) => {
  const real = await importOriginal<typeof import("@xyflow/react")>();
  return { ...real, ReactFlow: () => null };
});

import Quadro from "@/app/automacoes/editor/quadro";
import type { Configuracao } from "@/app/automacoes/editor/painel";
import type { Passo } from "@/lib/steps";

const CONFIGURACAO: Configuracao = {
  nome: "automação de teste",
  ativo: false,
  gatilho: "dm",
  palavras: ["oi"],
  correspondencia: "contains",
  post: null,
  story: null,
  entregaSemPortao: false,
};

const PASSOS: Passo[] = [{ id: "b_dm0001", tipo: "dm", texto: "Oi! Aqui está o link." }];

function montarOQuadro() {
  render(
    <Quadro
      automationId="automacao-de-teste"
      passosIniciais={PASSOS}
      ligacoesIniciais={[]}
      configuracaoInicial={CONFIGURACAO}
      conta={{ usuario: "conta_de_teste", nome: null, foto: null }}
    />
  );
}

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});

// A CONFIG DE TELA NÃO DESFAZ O STUB SOZINHA (nem `vitest.dom.config.ts`, nem `testes-dom/limpeza.ts`), então ele se
// desfaz aqui, no molde de `testes-dom/bonus-capa-card.dom.tsx`.
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("o editor das automações no celular", () => {
  it("abaixo de 640 px, o quadro diz que a edição é pelo computador", () => {
    montarOQuadro();
    const aviso = screen.getByText(/A edição das automações é pelo computador/);
    expect(aviso.closest(".sm\\:hidden")).not.toBeNull();
  });

  it("o Salvar fica escondido abaixo de 640 px e só aparece de 640 px para cima", () => {
    montarOQuadro();
    const caixa = screen.getByRole("button", { name: "Salvar automação" }).closest(".sm\\:flex");
    expect(caixa).not.toBeNull();
    expect(caixa?.classList.contains("hidden")).toBe(true);
  });
});
```

```bash
S="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/28ff177f-dfa7-439e-ba1a-dc70de81ea3c/scratchpad"
C="$S/x"; K="$S/celular2"; P="$K/plano.md"
T=testes-dom/quadro-no-celular.dom.tsx
cd "$C" || exit 1
test "$(git branch --show-current)" = celular-2 || { echo "não é o ramo da execução: pare"; exit 1; }
test -z "$(git status --porcelain)" || { echo "a árvore não está limpa: pare"; exit 1; }
node -e 'const a=Object.entries(process.env).filter(([k,v])=>/^postgres(ql)?:\/\//i.test(v||"")).map(([k])=>k); if(a.length){console.log("variável com URL de banco:",a.join(", "),": pare");process.exit(1)} console.log("nenhuma variável com URL de banco")' || exit 1
node "$K/extrair-bloco.mjs" "$P" "$T" "$T" || { echo "o extrair parou: pare"; exit 1; }
test "$(git hash-object "$T")" = 4818ad09b4ba9602ebd451c646421dd59726ce2c || { echo "o teste não é o do ensaio: pare"; exit 1; }
echo "o blob do teste: igual ao do ensaio"
node "$K/varrer-texto.mjs" "$T"
npm run test:dom -- "$T" > "$K/exec-f1-quadro.log" 2>&1; echo "o teste do quadro: $?"; sed 's/\x1b\[[0-9;]*m//g' "$K/exec-f1-quadro.log" | grep -n -E "^\s*(Test Files|Tests)\s"
npm run typecheck > "$K/exec-f1-tsc.log" 2>&1; echo "typecheck: $?"
npm run lint > "$K/exec-f1-lint.log" 2>&1; echo "lint: $?"
npm test > "$K/exec-f1-puros.log" 2>&1; echo "puros: $?"; sed 's/\x1b\[[0-9;]*m//g' "$K/exec-f1-puros.log" | grep -n -E "^\s*(Test Files|Tests)\s"
npm run test:dom > "$K/exec-f1-tela.log" 2>&1; echo "tela: $?"; sed 's/\x1b\[[0-9;]*m//g' "$K/exec-f1-tela.log" | grep -n -E "^\s*(Test Files|Tests)\s"
node "$K/guarda-celular-2.mjs" "$C"; echo "guarda: $?"
```

Esperado: "nenhuma variável com URL de banco"; o "GRAVADO" do extrair e o blob igual; "limpo … (LF)"; o teste do
quadro com 0 e "Tests  2 passed (2)"; o typecheck e o lint com 0; os puros com 166 e 3 904 (os da `main`); os de tela
com 37 e 352 (os da `main` mais este arquivo, com 2 casos); a guarda com três "dentro" (a spec, o plano e o teste) e 0.
Depois, à parte:

```bash
cd "C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/28ff177f-dfa7-439e-ba1a-dc70de81ea3c/scratchpad/x" || exit 1
test "$(git branch --show-current)" = celular-2 && git add testes-dom/quadro-no-celular.dom.tsx && git commit -m "O editor das automações ganha um teste de tela para o aviso do celular e para o Salvar escondido"
git show HEAD | git patch-id --stable
```

Esperado: o patch-id `d65602cd68192a74258213aaa30b5b4bdf98e5b2`.

## F2: a lista do calendário (o commit que repete o `709ca25`)

O teste novo, e a função em `lib/calendario.ts` aplicada pelo `e2/aplicar-calendario.mjs` em dois modos: primeiro o
"esboco", que devolve sempre `[]`, para o vermelho cair pela afirmação (o 355); depois a "funcao".

<!-- bloco: tests/calendario-lista.test.ts -->
```typescript
import { describe, it, expect } from "vitest";
import { gradeDoMes, gradeDaSemana, listaDoCalendario } from "@/lib/calendario";

// A LISTA DO CALENDÁRIO NO CELULAR (docs/specs/2026-11-24-celular-onda-1.md, a parte do PR 2, os achados 365 e
// 367): abaixo de 640 px, o calendário de Publicações vira uma lista com as casas da grade que têm posts, um dia
// embaixo do outro.
//
// Novembro de 2026 começa num domingo: a grade do mês vai de 1/11 a 12/12, e as casas de dezembro são do mês
// vizinho.
const NOVEMBRO = gradeDoMes("2026-11", "2026-11-26");

describe("a lista do calendário no celular", () => {
  it("o dia do mês vizinho entra, como na grade, com o mês dele no título (o achado 365)", () => {
    const lista = listaDoCalendario(NOVEMBRO.casas, new Map([["2026-12-01", ["post de dezembro"]]]));
    expect(lista.map((d) => [d.casa.chave, d.casa.doMes, d.titulo, d.itens])).toEqual([
      ["2026-12-01", false, "ter, 1 de dezembro", ["post de dezembro"]],
    ]);
  });

  it("o post que cai só na folga da janela não tem casa e não entra (o achado 365)", () => {
    const porDia = new Map([
      ["2026-10-31", ["antes da grade"]],
      ["2026-11-10", ["dentro da grade"]],
      ["2026-12-13", ["depois da grade"]],
    ]);
    expect(listaDoCalendario(NOVEMBRO.casas, porDia).map((d) => d.casa.chave)).toEqual(["2026-11-10"]);
    // Só com posts na folga, a lista sai vazia: é ela, e não a consulta, que decide o vazio do celular.
    porDia.delete("2026-11-10");
    expect(listaDoCalendario(NOVEMBRO.casas, porDia)).toEqual([]);
  });

  it("os dias saem na ordem da grade, e os posts de cada dia na ordem em que chegaram (o achado 367)", () => {
    const porDia = new Map([
      ["2026-11-20", ["c"]],
      ["2026-11-05", ["b", "a"]],
    ]);
    const lista = listaDoCalendario(NOVEMBRO.casas, porDia);
    expect(lista.map((d) => d.titulo)).toEqual(["qui, 5 de novembro", "sex, 20 de novembro"]);
    // A função não ordena: "b" chegou antes de "a" e continua antes.
    expect(lista[0].itens).toEqual(["b", "a"]);
  });

  it("a semana que atravessa a virada do mês dá os dois meses nos títulos", () => {
    const semana = gradeDaSemana("2026-11-30", "2026-11-26");
    const porDia = new Map([
      ["2026-11-30", ["x"]],
      ["2026-12-02", ["y"]],
    ]);
    expect(listaDoCalendario(semana.casas, porDia).map((d) => d.titulo)).toEqual([
      "seg, 30 de novembro",
      "qua, 2 de dezembro",
    ]);
  });

  it("uma grade sem posts dá uma lista vazia", () => {
    expect(listaDoCalendario(NOVEMBRO.casas, new Map())).toEqual([]);
  });

  it("um dia com a lista de posts vazia não entra", () => {
    const porDia = new Map<string, string[]>([
      ["2026-11-03", []],
      ["2026-11-04", ["d"]],
    ]);
    expect(listaDoCalendario(NOVEMBRO.casas, porDia).map((d) => d.casa.chave)).toEqual(["2026-11-04"]);
  });
});
```

O diff do `lib/calendario.ts`, tirado do ensaio:

```diff
diff --git a/lib/calendario.ts b/lib/calendario.ts
index 99ad8dd..e114e04 100644
--- a/lib/calendario.ts
+++ b/lib/calendario.ts
@@ -275,6 +275,54 @@ export function recorteDoDia<T>(
   };
 }
 
+/** Um dia da lista do celular: a casa da grade, o título dela e os itens do dia. */
+export type DiaDaLista<T> = {
+  casa: Casa;
+  /** "ter, 1 de dezembro" */
+  titulo: string;
+  itens: T[];
+};
+
+/**
+ * A LISTA DO CELULAR: o calendário de Publicações abaixo de 640 px, um dia
+ * embaixo do outro (docs/specs/2026-11-24-celular-onda-1.md, a parte do PR 2).
+ *
+ * ELA MOSTRA EXATAMENTE AS CASAS DA GRADE QUE TÊM ITENS, as do mês vizinho
+ * também (o achado 365). A consulta da tela busca a grade inteira, e a grade
+ * desenha os posts das casas vizinhas. Se a lista as tirasse, um post do dia
+ * 1/12, visto na grade de novembro, sumiria do celular sem contagem nenhuma: o
+ * "fora deste período" da tela só conta o que está fora da janela.
+ *
+ * ELA NÃO ORDENA NADA (o achado 367). Os dias vêm na ordem das casas, e os
+ * itens de cada dia já chegam em ordem de hora: a consulta ordena pela mesma
+ * data que `agruparPorDia` usa, e ele mantém a ordem de chegada. Uma segunda
+ * ordenação aqui seria uma segunda fonte da ordem.
+ *
+ * O POST QUE CAI SÓ NA FOLGA DA JANELA não tem casa, e por isso não entra. A
+ * lista pode sair vazia com itens na consulta, e é ela, e não a consulta, que
+ * decide o vazio do celular.
+ */
+export function listaDoCalendario<T>(casas: Casa[], porDia: Map<string, T[]>): DiaDaLista<T>[] {
+  const lista: DiaDaLista<T>[] = [];
+  for (const casa of casas) {
+    const itens = porDia.get(casa.chave);
+    if (itens && itens.length > 0) lista.push({ casa, titulo: tituloDoDia(casa.chave), itens });
+  }
+  return lista;
+}
+
+/**
+ * O título de um dia da lista: "ter, 1 de dezembro".
+ *
+ * OS NOMES SÃO OS DA GRADE (as colunas e o título do mês), e não uma lista
+ * nova: o celular e o computador dizem o mesmo dia com as mesmas palavras. O
+ * mês vai sempre, porque a lista do mês tem dias do mês vizinho.
+ */
+function tituloDoDia(chave: string): string {
+  const [, mes, dia] = chave.split("-").map(Number);
+  return `${DIAS_DA_SEMANA[diaDaSemana(chave)]}, ${dia} de ${MESES[mes - 1]}`;
+}
+
 /**
  * QUAL BARRA DO GRÁFICO LEVA O NÚMERO — o índice, ou `-1` quando nenhuma.
  *
```

```bash
S="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/28ff177f-dfa7-439e-ba1a-dc70de81ea3c/scratchpad"
C="$S/x"; K="$S/celular2"; P="$K/plano.md"
T=tests/calendario-lista.test.ts
cd "$C" || exit 1
test "$(git branch --show-current)" = celular-2 || { echo "não é o ramo da execução: pare"; exit 1; }
test -z "$(git status --porcelain)" || { echo "a árvore não está limpa: pare"; exit 1; }
node -e 'const a=Object.entries(process.env).filter(([k,v])=>/^postgres(ql)?:\/\//i.test(v||"")).map(([k])=>k); if(a.length){console.log("variável com URL de banco:",a.join(", "),": pare");process.exit(1)} console.log("nenhuma variável com URL de banco")' || exit 1
echo "== o vermelho: o teste com o esboço"
node "$K/extrair-bloco.mjs" "$P" "$T" "$T" || { echo "o extrair parou: pare"; exit 1; }
node "$K/e2/aplicar-calendario.mjs" "$C" esboco || { echo "o aplicar do esboço parou: pare"; exit 1; }
npm test -- "$T" --reporter=default --reporter=json --outputFile.json="$K/exec-f2-vermelho.json" > "$K/exec-f2-vermelho.log" 2>&1; echo "teste com o esboço: $? (esperado: diferente de 0)"
node -e 'const r=require(process.argv[1]); const a=r.testResults.flatMap((f)=>f.assertionResults); for (const t of a) console.log(t.status.padEnd(7), t.title); const caem=a.filter((t)=>t.status==="failed"); const passam=a.filter((t)=>t.status==="passed"); const pelaAfirmacao=caem.every((t)=>t.failureMessages.join("\n").includes("AssertionError")); const ok=a.length===6&&caem.length===5&&passam.length===1&&passam[0].title==="uma grade sem posts dá uma lista vazia"&&pelaAfirmacao; console.log(ok?"vermelho como esperado: 5 caem pela afirmação, 1 passa":"o vermelho NÃO é o esperado"); process.exit(ok?0:1)' "$K/exec-f2-vermelho.json" || { echo "o vermelho não é o esperado: pare"; exit 1; }
echo "== o verde: a função no lugar do esboço"
node "$K/e2/aplicar-calendario.mjs" "$C" funcao || { echo "o aplicar da função parou: pare"; exit 1; }
test "$(git hash-object "$T")" = da9b20e96d5fb8f36eb242e1aa6c51a90baa390b || { echo "o teste não é o do ensaio: pare"; exit 1; }
test "$(git hash-object lib/calendario.ts)" = e114e047dd3f69e662ef8f8e58697056d7cf1a37 || { echo "o calendário não é o do ensaio: pare"; exit 1; }
echo "os dois blobs: iguais aos do ensaio"
node "$K/varrer-texto.mjs" lib/calendario.ts "$T"
npm test -- "$T" --reporter=default --reporter=json --outputFile.json="$K/exec-f2-verde.json" > "$K/exec-f2-verde.log" 2>&1; echo "teste com a função: $?"
node -e 'const r=require(process.argv[1]); const a=r.testResults.flatMap((f)=>f.assertionResults); const ok=a.length===6&&a.every((t)=>t.status==="passed"); console.log(ok?"verde: 6 de 6":"o verde NÃO é o esperado"); process.exit(ok?0:1)' "$K/exec-f2-verde.json" || { echo "o verde não é o esperado: pare"; exit 1; }
npm run typecheck > "$K/exec-f2-tsc.log" 2>&1; echo "typecheck: $?"
npm run lint > "$K/exec-f2-lint.log" 2>&1; echo "lint: $?"
npm test > "$K/exec-f2-puros.log" 2>&1; echo "puros: $?"; sed 's/\x1b\[[0-9;]*m//g' "$K/exec-f2-puros.log" | grep -n -E "^\s*(Test Files|Tests)\s"
npm run test:dom > "$K/exec-f2-tela.log" 2>&1; echo "tela: $?"; sed 's/\x1b\[[0-9;]*m//g' "$K/exec-f2-tela.log" | grep -n -E "^\s*(Test Files|Tests)\s"
node "$K/guarda-celular-2.mjs" "$C"; echo "guarda: $?"
```

Esperado: "nenhuma variável com URL de banco"; o "GRAVADO" do extrair; "GRAVADO: o esboço, depois do recorteDoDia no
lib/calendario.ts, que passa de 306 para 322 linhas (CRLF)."; o teste com o esboço diferente de 0, as seis linhas de
status (as mesmas da seção do ensaio, acima) e "vermelho como esperado: 5 caem pela afirmação, 1 passa"; "GRAVADO: a
função, no lugar do esboço no lib/calendario.ts, que passa de 322 para 354 linhas (CRLF)."; os dois blobs iguais; os
dois "limpo" (o calendário em CRLF e o teste em LF); "teste com a função: 0" e "verde: 6 de 6"; o typecheck e o lint
com 0; os puros com 167 e 3 910; os de tela com 37 e 352; a guarda com cinco "dentro", "lib/calendario.ts: 48
posta(s) e nenhuma tirada" e 0. Depois, à parte:

```bash
cd "C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/28ff177f-dfa7-439e-ba1a-dc70de81ea3c/scratchpad/x" || exit 1
test "$(git branch --show-current)" = celular-2 && git add lib/calendario.ts tests/calendario-lista.test.ts && git commit -m "O calendário de Publicações ganha a lista por dia do celular, com as casas da grade que têm posts"
git show HEAD | git patch-id --stable
```

Esperado: o patch-id `e2cffcdaac4a8aed291603631ce82c5c0924c093`.

## F3: o calendário vira a lista no celular, com o cartão como função (o commit que repete o `2e854f8`)

O `e3/aplicar-publicar-2.mjs` faz as oito trocas no `app/publicar/page.tsx`: o cartão do `mostrados.map` vira a
função `cartaoDoCalendario`, chamada no corpo pela grade e pela lista (o 366 e o 375), recortada do próprio arquivo e
não redigitada; a grade fica `hidden sm:block`; a lista por dia aparece com `sm:hidden`; e o vazio olha a lista no
celular, com uma frase só em cada largura (o 365). Não há teste novo: a lógica da lista é da F2, a largura se mede na
prova na prévia, e a integração lê o cartão (o 375). O diff, tirado do ensaio:

```diff
diff --git a/app/publicar/page.tsx b/app/publicar/page.tsx
index ea35e6f..7dbcf4f 100644
--- a/app/publicar/page.tsx
+++ b/app/publicar/page.tsx
@@ -22,6 +22,7 @@ import {
   alertOk,
   alertError,
   emptyWrap,
+  eyebrow,
 } from "../ui";
 import { urlPublicaSeDerParaMontar } from "@/lib/bucket";
 import {
@@ -34,6 +35,7 @@ import {
   agruparPorDia,
   recorteDoDia,
   diaSomado,
+  listaDoCalendario,
 } from "@/lib/calendario";
 
 // A CARA DA SEÇÃO DE PUBLICAÇÕES — componente de SERVIDOR, sem uma linha de
@@ -308,6 +310,10 @@ export default async function Agendados({
   // status novo aparecesse.
   const porDia = agruparPorDia(itens, (i) => dataDaLinhaDeEnvio(i).quando);
   const fora = resumoFora[0] ?? { fora: 0, proximo: null };
+  // A LISTA DO CELULAR SAI DA MESMA GRADE E DO MESMO AGRUPAMENTO (os achados
+  // 365 e 367): ela não consulta nada nem ordena nada, e é ela que decide o
+  // vazio abaixo de 640 px.
+  const diasDaLista = listaDoCalendario(grade.casas, porDia);
 
   return (
     <div className="space-y-6">
@@ -396,11 +402,14 @@ export default async function Agendados({
             </p>
           </div>
 
-          {/* A GRADE. `overflow-x-auto` porque sete colunas não cabem em 390px
-              sem espremer o conteúdo até ele deixar de ser legível — e a regra
-              desta base é que conteúdo largo rola DENTRO do próprio recipiente,
-              nunca fazendo a página inteira rolar de lado. */}
-          <div className="overflow-x-auto">
+          {/* A GRADE, SÓ DE 640 PX PARA CIMA. Abaixo disso, sete colunas não
+              cabem sem espremer o conteúdo até ele deixar de ser legível, e a
+              lista por dia, logo abaixo, toma o lugar dela
+              (docs/specs/2026-11-24-celular-onda-1.md, a parte do PR 2). O
+              `overflow-x-auto` fica pela regra desta base: conteúdo largo rola
+              DENTRO do próprio recipiente, nunca fazendo a página inteira rolar
+              de lado. */}
+          <div className="hidden overflow-x-auto sm:block">
             <div className="min-w-[640px]">
               <div className="grid grid-cols-7 border-b border-traco dark:border-traco-escuro">
                 {grade.colunas.map((c) => (
@@ -441,100 +450,9 @@ export default async function Agendados({
                         </span>
                       </p>
 
-                      {mostrados.map((item) => {
-                        const quando = dataDaLinhaDeEnvio(item);
-                        const saiu = quando.saiu;
-                        // A MINIATURA SÓ EXISTE ENQUANTO O POST NÃO SAIU: o
-                        // dreno apaga a mídia do bucket depois de publicar
-                        // (`limparOBucket`). Num post publicado a prévia seria
-                        // uma imagem quebrada, então nem se tenta.
-                        //
-                        // E A CAPA É A PRIMEIRA IMAGEM, e não o primeiro
-                        // caminho (spec 2026-10-19-enquadrar-imagens): o
-                        // vídeo saía como imagem quebrada. O post só de vídeo
-                        // fica sem capa, e a célula desenha o ícone dele. Quem
-                        // decide, nas duas redes, é `cartaoDoPost`.
-                        const cartao = cartaoDoPost(item, saiu);
-                        const primeira = cartao.capa;
-                        const soVideo = cartao.soVideo;
-                        // `null` QUANDO O AMBIENTE NÃO DEIXA MONTAR A URL, e
-                        // aí a célula desenha o símbolo em vez de uma imagem
-                        // quebrada. Prévia não vale uma tela — ver
-                        // `urlPublicaSeDerParaMontar` (lib/bucket.ts) para o
-                        // defeito que ensinou isso.
-                        const capa = primeira ? urlPublicaSeDerParaMontar(primeira) : null;
-                        // ATRASADO: a hora passou e ele ainda esta na fila. A
-                        // decisao e de `avisoDoAtrasoNaLista`, a mesma da tela
-                        // de detalhe — aqui so se pergunta SE ha aviso, porque
-                        // no quadrado nao cabe a frase.
-                        const atrasado = avisoDoAtrasoNaLista(quando) !== null;
-                        return (
-                          <Link
-                            key={item.id}
-                            /* A VOLTA CARREGA A ÂNCORA, e não só a visão: sem
-                               `em`, quem estava olhando dezembro e clicava em
-                               "← Calendário" caía no mês de hoje. */
-                            href={`/publicar/post/${item.id}?v=${visao}&em=${grade.ancora}`}
-                            /* O CHIP NÃO PINTA ESTADO, e isso é conserto de um
-                               defeito que a revisão achou em 11/09/2026.
-
-                               A primeira versão dava `bg-aberto/8` ao post que
-                               AINDA NÃO SAIU e cinza ao que JÁ SAIU — e em toda
-                               outra tela deste painel verde quer dizer "deu
-                               certo". Quem varria o calendário procurando
-                               problema via os verdes como sucesso, quando eram
-                               justamente os pendentes, um deles atrasado num dia
-                               que já passou.
-
-                               E a spec proíbe isso em uma linha: os três estados
-                               "continuam sendo SINAL — pílula, texto, ponto — e
-                               nunca preenchimento grande". A superfície volta a
-                               ser neutra; quem carrega o estado é o símbolo à
-                               esquerda, que é do tamanho de um sinal. */
-                            className="flex items-center gap-1.5 rounded-lg border border-traco bg-papel p-1 transition-colors hover:border-quieto/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acao/25 dark:border-traco-escuro dark:bg-papel-escuro/50 dark:focus-visible:ring-acao-escuro/25"
-                          >
-                            {capa ? (
-                              // eslint-disable-next-line @next/next/no-img-element
-                              <img
-                                src={capa}
-                                alt=""
-                                className="h-8 w-8 shrink-0 rounded-lg object-cover"
-                              />
-                            ) : (
-                              <span
-                                aria-hidden
-                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-traco text-[11px] dark:bg-traco-escuro"
-                              >
-                                {saiu ? "✓" : soVideo ? "▶" : "•"}
-                              </span>
-                            )}
-                            {/* O PONTO DE ESTADO — do tamanho de um sinal, que é
-                                o que a spec permite para as três cores. Verde é
-                                o que SAIU (o mesmo sentido de todas as outras
-                                telas), âmbar é o que está ATRASADO e ainda na
-                                fila, e nada aparece no que vai sair na hora —
-                                porque aí não há sinal a dar. */}
-                            {(saiu || atrasado) && (
-                              <span
-                                aria-hidden
-                                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
-                                  saiu
-                                    ? "bg-aberto dark:bg-aberto-escuro"
-                                    : "bg-fecha dark:bg-fecha-escuro"
-                                }`}
-                              />
-                            )}
-                            <span className="min-w-0 flex-1">
-                              <span className={`block text-[11px] font-semibold ${numero}`}>
-                                {horaDoDia(quando.quando)}
-                              </span>
-                              <span className={`block truncate text-[11px] ${muted}`}>
-                                {cartao.rotulo}
-                              </span>
-                            </span>
-                          </Link>
-                        );
-                      })}
+                      {mostrados.map((item) =>
+                        cartaoDoCalendario({ item, visao, ancora: grade.ancora, inteiro: false })
+                      )}
 
                       {/* QUEM CORTA TEM DE CONTAR — a mesma disciplina da tabela
                           de contatos e do feed de Atividade. O "+N" leva à
@@ -554,6 +472,26 @@ export default async function Agendados({
             </div>
           </div>
 
+          {/* A LISTA POR DIA, SÓ ABAIXO DE 640 PX (docs/specs/2026-11-24-celular-onda-1.md,
+              a parte do PR 2, os achados 365 a 367). As casas da grade que têm
+              posts, um dia embaixo do outro, as do mês vizinho também: a lista
+              mostra o mesmo que a grade. O "+N" não existe aqui, porque cada dia
+              mostra todos os posts dele. */}
+          {diasDaLista.length > 0 && (
+            <ol className="space-y-4 px-4 py-3 sm:hidden">
+              {diasDaLista.map(({ casa, titulo, itens: doDia }) => (
+                <li key={casa.chave}>
+                  <h2 className={eyebrow}>{titulo}</h2>
+                  <div className="mt-1.5 space-y-1.5">
+                    {doDia.map((item) =>
+                      cartaoDoCalendario({ item, visao, ancora: grade.ancora, inteiro: true })
+                    )}
+                  </div>
+                </li>
+              ))}
+            </ol>
+          )}
+
           {/* O CORTE DA GRADE, DECLARADO. Ele não morde hoje (medido: pico de 2
               posts por mês contra um teto de 200), e é justamente por isso que
               ele morderia CALADO no dia em que mordesse. A ordem da consulta é
@@ -595,9 +533,16 @@ export default async function Agendados({
 
           {/* O VAZIO DIZ O QUE FAZER. Um calendário sem nenhum post no período
               não é erro — é um mês em que ninguém marcou nada, e a frase tem de
-              ser um convite e não um silêncio. */}
-          {itens.length === 0 && (
-            <p className={`px-4 py-6 text-center text-sm ${muted}`}>
+              ser um convite e não um silêncio.
+
+              E NO CELULAR ELE OLHA A LISTA, e não a consulta (o achado 365). A
+              janela tem um dia de folga de cada lado, e um post que cai só na
+              folga entra em `itens` sem entrar em nenhuma casa: com a condição
+              de antes, a lista ficaria em branco, sem a frase. De 640 px para
+              cima, a condição continua a de `itens`, e o `sm:hidden` faz a
+              frase aparecer uma vez só em cada largura. */}
+          {diasDaLista.length === 0 && (
+            <p className={`px-4 py-6 text-center text-sm ${muted} ${itens.length === 0 ? "" : "sm:hidden"}`}>
               Nada marcado neste período.{" "}
               <Link href="/publicar/novo" className={link}>
                 Agendar um post
@@ -665,3 +610,125 @@ export default async function Agendados({
     </div>
   );
 }
+
+/**
+ * O CARTÃO DE UM POST NO CALENDÁRIO, um só, usado pela grade e pela lista do
+ * celular (docs/specs/2026-11-24-celular-onda-1.md, o achado 366).
+ *
+ * ESCREVER OUTRO CARTÃO PARA A LISTA criaria duas fontes para as mesmas
+ * decisões (a capa, o ponto de estado, a hora, o rótulo e a âncora do `href`),
+ * o defeito que o comentário do `agruparPorDia`, no corpo da página, condena.
+ * Na lista, só muda que o rótulo não corta (`inteiro`): o quadrado da grade é
+ * estreito, e a linha da lista tem a largura do celular.
+ *
+ * ELE É UMA FUNÇÃO CHAMADA NO CORPO DA PÁGINA, e não um componente (o achado
+ * 375). A leitura dos testes de integração não desce em componente filho
+ * (testes-integracao/texto-da-arvore.ts:49-53): com um `<CartaoDoCalendario />`,
+ * o `href` e o rótulo sumiam do texto que eles leem, e quatro casos caíram no
+ * ensaio. Por isso o nome começa com minúscula, a função não usa hook, e o `key`
+ * mora no `Link` que ela devolve.
+ */
+function cartaoDoCalendario({
+  item,
+  visao,
+  ancora,
+  inteiro,
+}: {
+  item: QueueItem;
+  visao: "mes" | "semana";
+  ancora: string;
+  inteiro: boolean;
+}) {
+  const quando = dataDaLinhaDeEnvio(item);
+  const saiu = quando.saiu;
+  // A MINIATURA SÓ EXISTE ENQUANTO O POST NÃO SAIU: o
+  // dreno apaga a mídia do bucket depois de publicar
+  // (`limparOBucket`). Num post publicado a prévia seria
+  // uma imagem quebrada, então nem se tenta.
+  //
+  // E A CAPA É A PRIMEIRA IMAGEM, e não o primeiro
+  // caminho (spec 2026-10-19-enquadrar-imagens): o
+  // vídeo saía como imagem quebrada. O post só de vídeo
+  // fica sem capa, e a célula desenha o ícone dele. Quem
+  // decide, nas duas redes, é `cartaoDoPost`.
+  const cartao = cartaoDoPost(item, saiu);
+  const primeira = cartao.capa;
+  const soVideo = cartao.soVideo;
+  // `null` QUANDO O AMBIENTE NÃO DEIXA MONTAR A URL, e
+  // aí a célula desenha o símbolo em vez de uma imagem
+  // quebrada. Prévia não vale uma tela — ver
+  // `urlPublicaSeDerParaMontar` (lib/bucket.ts) para o
+  // defeito que ensinou isso.
+  const capa = primeira ? urlPublicaSeDerParaMontar(primeira) : null;
+  // ATRASADO: a hora passou e ele ainda esta na fila. A
+  // decisao e de `avisoDoAtrasoNaLista`, a mesma da tela
+  // de detalhe — aqui so se pergunta SE ha aviso, porque
+  // no quadrado nao cabe a frase.
+  const atrasado = avisoDoAtrasoNaLista(quando) !== null;
+  return (
+    <Link
+      key={item.id}
+      /* A VOLTA CARREGA A ÂNCORA, e não só a visão: sem
+         `em`, quem estava olhando dezembro e clicava em
+         "← Calendário" caía no mês de hoje. */
+      href={`/publicar/post/${item.id}?v=${visao}&em=${ancora}`}
+      /* O CHIP NÃO PINTA ESTADO, e isso é conserto de um
+         defeito que a revisão achou em 11/09/2026.
+
+         A primeira versão dava `bg-aberto/8` ao post que
+         AINDA NÃO SAIU e cinza ao que JÁ SAIU — e em toda
+         outra tela deste painel verde quer dizer "deu
+         certo". Quem varria o calendário procurando
+         problema via os verdes como sucesso, quando eram
+         justamente os pendentes, um deles atrasado num dia
+         que já passou.
+
+         E a spec proíbe isso em uma linha: os três estados
+         "continuam sendo SINAL — pílula, texto, ponto — e
+         nunca preenchimento grande". A superfície volta a
+         ser neutra; quem carrega o estado é o símbolo à
+         esquerda, que é do tamanho de um sinal. */
+      className="flex items-center gap-1.5 rounded-lg border border-traco bg-papel p-1 transition-colors hover:border-quieto/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acao/25 dark:border-traco-escuro dark:bg-papel-escuro/50 dark:focus-visible:ring-acao-escuro/25"
+    >
+      {capa ? (
+        // eslint-disable-next-line @next/next/no-img-element
+        <img
+          src={capa}
+          alt=""
+          className="h-8 w-8 shrink-0 rounded-lg object-cover"
+        />
+      ) : (
+        <span
+          aria-hidden
+          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-traco text-[11px] dark:bg-traco-escuro"
+        >
+          {saiu ? "✓" : soVideo ? "▶" : "•"}
+        </span>
+      )}
+      {/* O PONTO DE ESTADO — do tamanho de um sinal, que é
+          o que a spec permite para as três cores. Verde é
+          o que SAIU (o mesmo sentido de todas as outras
+          telas), âmbar é o que está ATRASADO e ainda na
+          fila, e nada aparece no que vai sair na hora —
+          porque aí não há sinal a dar. */}
+      {(saiu || atrasado) && (
+        <span
+          aria-hidden
+          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
+            saiu
+              ? "bg-aberto dark:bg-aberto-escuro"
+              : "bg-fecha dark:bg-fecha-escuro"
+          }`}
+        />
+      )}
+      <span className="min-w-0 flex-1">
+        <span className={`block text-[11px] font-semibold ${numero}`}>
+          {horaDoDia(quando.quando)}
+        </span>
+        <span className={`block ${inteiro ? "" : "truncate "}text-[11px] ${muted}`}>
+          {cartao.rotulo}
+        </span>
+      </span>
+    </Link>
+  );
+}
```

```bash
S="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/28ff177f-dfa7-439e-ba1a-dc70de81ea3c/scratchpad"
C="$S/x"; K="$S/celular2"
F=app/publicar/page.tsx
cd "$C" || exit 1
test "$(git branch --show-current)" = celular-2 || { echo "não é o ramo da execução: pare"; exit 1; }
test -z "$(git status --porcelain)" || { echo "a árvore não está limpa: pare"; exit 1; }
node -e 'const a=Object.entries(process.env).filter(([k,v])=>/^postgres(ql)?:\/\//i.test(v||"")).map(([k])=>k); if(a.length){console.log("variável com URL de banco:",a.join(", "),": pare");process.exit(1)} console.log("nenhuma variável com URL de banco")' || exit 1
node "$K/e3/aplicar-publicar-2.mjs" "$C" || { echo "o aplicar parou: pare"; exit 1; }
test "$(git hash-object "$F")" = 7dbcf4f25fb5d188edd980b13659ae7c641240bb || { echo "o page.tsx não é o do ensaio: pare"; exit 1; }
echo "o blob do page.tsx: igual ao do ensaio"
node "$K/varrer-texto.mjs" "$F"
npm run typecheck > "$K/exec-f3-tsc.log" 2>&1; echo "typecheck: $?"
npm run lint > "$K/exec-f3-lint.log" 2>&1; echo "lint: $?"
npm test > "$K/exec-f3-puros.log" 2>&1; echo "puros: $?"; sed 's/\x1b\[[0-9;]*m//g' "$K/exec-f3-puros.log" | grep -n -E "^\s*(Test Files|Tests)\s"
npm run test:dom > "$K/exec-f3-tela.log" 2>&1; echo "tela: $?"; sed 's/\x1b\[[0-9;]*m//g' "$K/exec-f3-tela.log" | grep -n -E "^\s*(Test Files|Tests)\s"
env -u CLAUDECODE -u AI_AGENT npm run build > "$K/exec-f3-build.log" 2>&1; echo "build: $?"
grep -n -E "MIGRAÇÃO PULADA|Next\.js 16|Compiled successfully|ƒ /publicar$" "$K/exec-f3-build.log"
git diff --stat -- AGENTS.md tsconfig.json; echo "(diff do AGENTS.md e do tsconfig.json acima; vazio = intocados)"
node "$K/guarda-celular-2.mjs" "$C"; echo "guarda: $?"
```

Esperado: "nenhuma variável com URL de banco"; as oito linhas do aplicar e "GRAVADO: 8 trocas no
app/publicar/page.tsx, que passa de 667 para 734 linhas (CRLF)."; o blob igual; "limpo … (CRLF)"; o typecheck e o
lint com 0; os puros com 167 e 3 910; os de tela com 37 e 352; "build: 0", com "MIGRAÇÃO PULADA", "Next.js 16.4.6",
"Compiled successfully" e o "ƒ /publicar"; o `AGENTS.md` e o `tsconfig.json` intocados; a guarda com seis "dentro",
"app/publicar/page.tsx: o cartão é função (3 "cartaoDoCalendario(", e 1 "CartaoDoCalendario" só em comentário)" e 0.

Antes do commit, a auditoria refaz a comparação do corpo: a `cartaoDoCalendario`, com os 22 espaços devolvidos,
contra as `:445-536` do `app/publicar/page.tsx` da `main`, tem de dar só DUAS diferenças (o `href` e o rótulo).
Depois, à parte:

```bash
cd "C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/28ff177f-dfa7-439e-ba1a-dc70de81ea3c/scratchpad/x" || exit 1
test "$(git branch --show-current)" = celular-2 && git add app/publicar/page.tsx && git commit -m "O calendário de Publicações vira uma lista por dia no celular, com o mesmo cartão da grade"
git show HEAD | git patch-id --stable
```

Esperado: o patch-id `d606e8375e7360cd3c8f9409b0820c39fc67c4be`.

## F4 e F5: os alvos de toque, e o comentário do `capable` (os commits que repetem o `a1b3262` e o `2df9e02`)

O `e4/aplicar-e4.mjs` faz as seis trocas de uma vez, nos quatro arquivos, conferindo todos antes de gravar qualquer
um. Os commits são dois, como no ensaio: os alvos (o post, a lista e o editor das automações) e o layout. Não há teste
novo: a spec deixa os tamanhos para a prova na prévia. Os diffs, tirados do ensaio:

```diff
diff --git a/app/automacoes/editor/quadro.tsx b/app/automacoes/editor/quadro.tsx
index ec753e7..dc5502e 100644
--- a/app/automacoes/editor/quadro.tsx
+++ b/app/automacoes/editor/quadro.tsx
@@ -1405,7 +1405,7 @@ export default function Quadro({
       <header className="flex shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-4 py-2 dark:border-zinc-800 dark:bg-zinc-950">
         <Link
           href="/automacoes"
-          className="shrink-0 text-sm text-quieto transition-colors hover:text-tinta dark:text-quieto-escuro dark:hover:text-tinta-escuro"
+          className="inline-flex min-h-6 shrink-0 items-center text-sm text-quieto transition-colors hover:text-tinta dark:text-quieto-escuro dark:hover:text-tinta-escuro"
         >
           ← Automações
         </Link>
diff --git a/app/automacoes/list-client.tsx b/app/automacoes/list-client.tsx
index 9034dab..1adc4ba 100644
--- a/app/automacoes/list-client.tsx
+++ b/app/automacoes/list-client.tsx
@@ -333,7 +333,7 @@ export default function AutomationsList({ automations }: { automations: Automati
                       disabled={ocupado}
                       onClick={() => alternar(a.id, a.active)}
                       title={a.active ? "Pausar automação" : "Ativar automação"}
-                      className={btnLinha}
+                      className={`${btnLinha} min-h-11 sm:min-h-[auto]`}
                     >
                       {a.active ? "Pausar" : "Ativar"}
                     </button>
diff --git a/app/publicar/post/[id]/page.tsx b/app/publicar/post/[id]/page.tsx
index fa6e515..89a7ae1 100644
--- a/app/publicar/post/[id]/page.tsx
+++ b/app/publicar/post/[id]/page.tsx
@@ -273,7 +273,7 @@ export default async function DetalheDaPublicacao({
             href={pagina.linkNoLinkedin}
             target="_blank"
             rel="noopener noreferrer"
-            className={`inline-block text-sm ${link}`}
+            className={`inline-flex min-h-6 items-center text-sm ${link}`}
           >
             Ver no LinkedIn ↗
           </a>
@@ -312,7 +312,7 @@ export default async function DetalheDaPublicacao({
                 className={`${input} w-auto!`}
               />
             </div>
-            <button className={btnGhost}>Remarcar</button>
+            <button className={`${btnGhost} min-h-11 sm:min-h-[auto]`}>Remarcar</button>
           </form>
 
           {/* CANCELAR PEDE CONFIRMAÇÃO, e a confirmação é um campo do
@@ -324,7 +324,7 @@ export default async function DetalheDaPublicacao({
               <input type="checkbox" name="confirmo" value="1" required />
               Confirmo o cancelamento
             </label>
-            <button className={btnDanger}>Cancelar este post</button>
+            <button className={`${btnDanger} min-h-11 sm:min-h-[auto]`}>Cancelar este post</button>
           </form>
 
           <p className={hint}>{pagina.notaDoCancelar}</p>
```

```diff
diff --git a/app/layout.tsx b/app/layout.tsx
index a010932..116571b 100644
--- a/app/layout.tsx
+++ b/app/layout.tsx
@@ -68,10 +68,12 @@ const fontes = `${archivo.variable} ${plexSans.variable} ${plexMono.variable}`;
 
 // O TÍTULO E A DESCRIÇÃO vêm de lib/marca.ts, a mesma fonte do manifesto do celular (o achado 343).
 //
-// O `appleWebApp.title` é o nome que o iPhone dá ao ícone na tela de início. O `capable` fica de fora: no
-// 16.4.6 ele escreve `mobile-web-app-capable` (node_modules/next/dist/lib/metadata/metadata-elements.js:446-452),
-// e quem abre o app sem a barra do navegador é o `display: "standalone"` do manifesto
-// (docs/specs/2026-11-24-celular-onda-1.md, o achado 339).
+// O `appleWebApp.title` é o nome que o iPhone dá ao ícone na tela de início. O `capable` não é escrito, e mesmo
+// assim sai como `true`: com o `appleWebApp` sem a chave, o Next o resolve como `true`
+// (node_modules/next/dist/lib/metadata/resolvers/resolve-basics.js:197) e escreve `mobile-web-app-capable`
+// (node_modules/next/dist/lib/metadata/metadata-elements.js:446-452). Quem abre o app sem a barra do navegador é
+// o `display: "standalone"` do manifesto, e a meta não atrapalha (docs/specs/2026-11-24-celular-onda-1.md, os
+// achados 339 e 360).
 export const metadata: Metadata = {
   title: TITULO_DO_PAINEL,
   description: DESCRICAO_DO_PAINEL,
```

```bash
S="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/28ff177f-dfa7-439e-ba1a-dc70de81ea3c/scratchpad"
C="$S/x"; K="$S/celular2"
POST="app/publicar/post/[id]/page.tsx"
LISTA=app/automacoes/list-client.tsx
QUADRO=app/automacoes/editor/quadro.tsx
LAYOUT=app/layout.tsx
cd "$C" || exit 1
test "$(git branch --show-current)" = celular-2 || { echo "não é o ramo da execução: pare"; exit 1; }
test -z "$(git status --porcelain)" || { echo "a árvore não está limpa: pare"; exit 1; }
node -e 'const a=Object.entries(process.env).filter(([k,v])=>/^postgres(ql)?:\/\//i.test(v||"")).map(([k])=>k); if(a.length){console.log("variável com URL de banco:",a.join(", "),": pare");process.exit(1)} console.log("nenhuma variável com URL de banco")' || exit 1
node "$K/e4/aplicar-e4.mjs" "$C" || { echo "o aplicar parou: pare"; exit 1; }
test "$(git hash-object "$POST")" = 89a7ae136227b829e28b42700734079f9dd8d941 || { echo "o post não é o do ensaio: pare"; exit 1; }
test "$(git hash-object "$LISTA")" = 1adc4ba961d8ef981f90f9a05e9f602544b67397 || { echo "a lista das automações não é a do ensaio: pare"; exit 1; }
test "$(git hash-object "$QUADRO")" = dc5502e07f212627869b65c74d9b064b50514114 || { echo "o quadro não é o do ensaio: pare"; exit 1; }
test "$(git hash-object "$LAYOUT")" = 116571b271531dd7f15789ad857ff74609508056 || { echo "o layout não é o do ensaio: pare"; exit 1; }
echo "os quatro blobs: iguais aos do ensaio"
node "$K/varrer-texto.mjs" "$POST" "$LISTA" "$QUADRO" "$LAYOUT"
npm run typecheck > "$K/exec-f4-tsc.log" 2>&1; echo "typecheck: $?"
npm run lint > "$K/exec-f4-lint.log" 2>&1; echo "lint: $?"
npm test > "$K/exec-f4-puros.log" 2>&1; echo "puros: $?"; sed 's/\x1b\[[0-9;]*m//g' "$K/exec-f4-puros.log" | grep -n -E "^\s*(Test Files|Tests)\s"
npm run test:dom > "$K/exec-f4-tela.log" 2>&1; echo "tela: $?"; sed 's/\x1b\[[0-9;]*m//g' "$K/exec-f4-tela.log" | grep -n -E "^\s*(Test Files|Tests)\s"
node "$K/guarda-celular-2.mjs" "$C"; echo "guarda: $?"
```

Esperado: "nenhuma variável com URL de banco"; as seis linhas do aplicar e os quatro "GRAVADO" (o post de 335 para
335 linhas, a lista de 431 para 431, o quadro de 1929 para 1929 e o layout de 154 para 156, todos em CRLF); os quatro
blobs iguais; os quatro "limpo"; o typecheck e o lint com 0; os puros com 167 e 3 910; os de tela com 37 e 352 (o
teste do quadro passa depois da troca no `quadro.tsx`); a guarda com os dez "dentro", "app/layout.tsx: só
comentário", os três tamanhos "como no ensaio" (1 e 1, 1 e 1, 3 e 3) e 0. Depois, à parte, os dois commits:

```bash
cd "C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/28ff177f-dfa7-439e-ba1a-dc70de81ea3c/scratchpad/x" || exit 1
test "$(git branch --show-current)" = celular-2 && git add "app/publicar/post/[id]/page.tsx" app/automacoes/list-client.tsx app/automacoes/editor/quadro.tsx && git commit -m "O post e as Automações ganham alvos de toque do tamanho do dedo no celular"
git show HEAD | git patch-id --stable
test "$(git branch --show-current)" = celular-2 && git add app/layout.tsx && git commit -m "O layout passa a dizer que o capable do iPhone sai como true mesmo sem a chave"
git show HEAD | git patch-id --stable
git status --porcelain; echo "(status acima; vazio = limpo)"
```

Esperado: os patch-ids `6f0e4f99ecf0e032a4eb72df1328f2e73c18ef80` e `94050e6fc55c619772b2e4151c45f1d75026d628`, e o status vazio.

## As mutações, sobre o estado final

As mesmas 7 do ensaio (o apêndice B): as cinco da spec e mais duas, que ficam neste plano (a 6, a ordem dos posts de
cada dia invertida; e a 7, a lista montada pelas chaves do `porDia` em vez das casas, que prova que o caso da folga
morde). Cada mutação grava UM arquivo, roda o teste que deveria pegá-la e volta pelo `git checkout --`, conferindo que
o arquivo voltou com o mesmo sha e que a árvore ficou limpa.

```bash
S="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/28ff177f-dfa7-439e-ba1a-dc70de81ea3c/scratchpad"
C="$S/x"; K="$S/celular2"
cd "$C" || exit 1
test "$(git branch --show-current)" = celular-2 || { echo "não é o ramo da execução: pare"; exit 1; }
test "$(git show HEAD | git patch-id --stable | cut -d' ' -f1)" = 94050e6fc55c619772b2e4151c45f1d75026d628 || { echo "o HEAD não é a F5 do ensaio: pare"; exit 1; }
test -z "$(git status --porcelain)" || { echo "a árvore não está limpa: pare"; exit 1; }
node -e 'const a=Object.entries(process.env).filter(([k,v])=>/^postgres(ql)?:\/\//i.test(v||"")).map(([k])=>k); if(a.length){console.log("variável com URL de banco:",a.join(", "),": pare");process.exit(1)} console.log("nenhuma variável com URL de banco")' || exit 1
node "$K/e5/mutar-celular-2.mjs" "$C" > "$K/exec-mutacoes.log" 2>&1; echo "mutar: $?"
cat "$K/exec-mutacoes.log"
git status --porcelain; echo "(status acima; vazio = limpo)"
```

Esperado: o mesmo do apêndice B (com os sha da cópia da execução, que podem ser outros): as 7 caindo nos mesmos
casos (1 + 1 + 6 + 1 + 2 + 1 + 2 = 14 linhas FAIL), os dois testes passando na árvore limpa (6 da lista e 2 do
quadro), "FIM: 7 de 7 mutações caíram.", "mutar: 0" e o status vazio.

## O verify inteiro

O build roda o `scripts/migrar.mjs --aplicar`. Na cópia, com o `.env.local` vazio e sem `VERCEL_ENV`, ele escreve
"MIGRAÇÃO PULADA" e sai sem abrir conexão com o banco. O `next build` roda sem as variáveis de agente, porque o Next
pode reescrever o bloco do `AGENTS.md`.

```bash
S="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/28ff177f-dfa7-439e-ba1a-dc70de81ea3c/scratchpad"
C="$S/x"; K="$S/celular2"
MAIN=96b5cbbeaf8bc13850785b882a9e861339614bbf
cd "$C" || exit 1
test "$(git branch --show-current)" = celular-2 || { echo "não é o ramo da execução: pare"; exit 1; }
test -z "$(git status --porcelain)" || { echo "a árvore não está limpa: pare"; exit 1; }
node -e 'const a=Object.entries(process.env).filter(([k,v])=>/^postgres(ql)?:\/\//i.test(v||"")).map(([k])=>k); if(a.length){console.log("variável com URL de banco:",a.join(", "),": pare");process.exit(1)} console.log("nenhuma variável com URL de banco")' || exit 1
env -u CLAUDECODE -u AI_AGENT npm run verify > "$K/exec-verify.log" 2>&1; echo "verify: $?"
sed 's/\x1b\[[0-9;]*m//g' "$K/exec-verify.log" | grep -n -E "Next\.js 16\.4\.[0-9]+|MIGRAÇÃO PULADA|^\s*(Test Files|Tests)\s|VAZAMENTOS|static pages using 3 workers \(21|Proxy|ƒ /publicar$"
git diff --stat -- AGENTS.md tsconfig.json; echo "(diff do AGENTS.md e do tsconfig.json acima; vazio = intocados)"
git diff --stat "$MAIN..HEAD"
git status --porcelain; echo "(status acima; vazio = limpo)"
node "$K/guarda-celular-2.mjs" "$C"; echo "guarda: $?"
```

Esperado: "verify: 0"; os puros com 167 e 3 910, os de tela com 37 e 352, os quatro "VAZAMENTOS: 0", "MIGRAÇÃO
PULADA", "Next.js 16.4.6", as 21 páginas ("(21/21)"), o "ƒ /publicar" e o "ƒ Proxy (Middleware)"; o `AGENTS.md` e o
`tsconfig.json` intocados; o diff do ramo com os dez arquivos (os nove do ensaio e este plano); o status vazio; a
guarda com 0.

## A integração, com o Docker Desktop aberto pelo Victor

Uma vez só, sobre o estado final, depois da caixa do Victor (ele abre o Docker Desktop pelo menu Iniciar e espera o
"Engine running"), da hora mandada à auditoria e do "pode" dela. Se um caso cair, nada se repete sem um novo "pode".
Nunca rode a integração sem a `DATABASE_URL_TESTES`: sem ela, a suíte cai na `DATABASE_URL`, que é a produção. A
suíte imprime "Rode sem DATABASE_URL_TESTES antes do merge", e essa dica NÃO vale aqui (o `COMECE-AQUI.md`, seção 4).

**O PR 2 mexe no que a integração lê:** os casos de `agendados`, `linkedin-telas` e `nao-saiu` leem o calendário de
Publicações pelo `textoDaArvore`, e é por eles que o cartão como função está protegido (o 375, medido no ensaio).

```bash
S="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/28ff177f-dfa7-439e-ba1a-dc70de81ea3c/scratchpad"
C="$S/x"; K="$S/celular2"
cd "$C" || exit 1
test "$(git branch --show-current)" = celular-2 || { echo "não é o ramo da execução: pare"; exit 1; }
test -z "$(git status --porcelain)" || { echo "a árvore não está limpa: pare"; exit 1; }
node -e 'const a=Object.entries(process.env).filter(([k,v])=>/^postgres(ql)?:\/\//i.test(v||"")).map(([k])=>k); if(a.length){console.log("variável com URL de banco:",a.join(", "),": pare");process.exit(1)} console.log("nenhuma variável com URL de banco")' || exit 1
docker version --format '{{.Server.Version}}' >/dev/null 2>&1 || { echo "o Docker não responde: pare"; exit 1; }
docker ps -a --filter name=metodochat-banco-de-teste --format '{{.Names}} | {{.Status}} | projeto={{.Label "com.docker.compose.project"}}'; echo "(acima: o que já existe com o nome; vazio = nada)"
test -z "$(docker ps -a --filter name=^metodochat-banco-de-teste$ --format '{{.Names}}')" || { echo "já existe um container com o nome: pare"; exit 1; }
npm run banco:teste || { echo "o banco:teste falhou: pare"; exit 1; }
docker ps --filter name=^metodochat-banco-de-teste$ --format '{{.Names}} | {{.Status}} | projeto={{.Label "com.docker.compose.project"}}'
DATABASE_URL_TESTES=postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes npm run test:integracao > "$K/exec-integracao.log" 2>&1; echo "integração: $?"
sed 's/\x1b\[[0-9;]*m//g' "$K/exec-integracao.log" | grep -n -E "rede-global|^\s*(Test Files|Tests)\s"
grep -n -E "FAIL|✗|×" "$K/exec-integracao.log" | head -20; echo "(falhas acima; vazio = nenhuma)"
npm run banco:teste:parar; echo "banco:teste:parar: $?"
docker ps -a --filter name=^metodochat-banco-de-teste$ --format '{{.Names}}'; echo "(vazio = removido)"
git status --porcelain; echo "(status acima; vazio = limpo)"
```

Esperado: "nenhuma variável com URL de banco"; nada com o nome antes; o container "healthy", com `projeto=x`;
"integração: 0"; "[rede-global] ALVO: banco de TESTE"; 80 arquivos e "1018 passed | 8 skipped (1026)", com os casos
do calendário passando; nenhuma falha; o container removido no fim; o status vazio. Os containers dos outros projetos
não são tocados.

## O envio: o push, a prévia, a prova, o PR e o merge

No molde do PR 1, com as lições dele: a leitura da produção pela Vercel (o 308), a mensagem do merge igual ao título do
PR (o 305), o e-mail do merge (o 318 e o 333) e as duas leituras da primeira hora com hora certa, combinadas antes (o
306 e o 361). A auditoria só usa ferramentas de leitura do conector: nunca promover, voltar, mexer em variável ou
gravar qualquer coisa.

**Envio 1: a conferência antes do push.** Repetida, igual, antes do PR (Envio 4) e antes da caixa do merge (Envio 5).

```bash
cd "C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/28ff177f-dfa7-439e-ba1a-dc70de81ea3c/scratchpad/x" || exit 1
git fetch origin
test "$(git rev-parse origin/main)" = 96b5cbbeaf8bc13850785b882a9e861339614bbf && echo "origin/main em 96b5cbb"
test "$(git branch --show-current)" = celular-2 && echo "no ramo certo"
git log --oneline 96b5cbb..HEAD                            # 7 commits: a spec, o plano e os cinco das fases
git log --format='%an' 96b5cbb..HEAD | sort -u             # só Victor Souza
git log --format='%ae' 96b5cbb..HEAD | sed 's/^.*@//' | sort -u   # só users.noreply.github.com
git log --format=%B 96b5cbb..HEAD | grep -ci "co-authored" # 0
git status --porcelain; echo "(status acima; vazio = limpo)"
```

Se qualquer linha divergir, pare.

**Envio 2: o push do ramo,** com o OK do Victor pela caixa.

```bash
cd "C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/28ff177f-dfa7-439e-ba1a-dc70de81ea3c/scratchpad/x" || exit 1
test -z "$(git ls-remote origin refs/heads/celular-2)" || { echo "o ramo já existe no remoto: pare"; exit 1; }
test "$(git branch --show-current)" = celular-2 && git push -u origin refs/heads/celular-2:refs/heads/celular-2
```

**Envio 3: a prévia e a prova.** A Vercel monta uma prévia do ramo. A prévia grava na produção (o login grava a
sessão), então vale a ordem: a caixa do Victor, a hora mandada à auditoria e o "pode" dela. A prévia tem a proteção da
Vercel (o 356), e a medida é feita com a sessão do Victor, numa aba aberta no perfil certo do Chrome dele (o 359).

1. **O build da prévia,** lido pela auditoria pelo conector: o commit da F5; "Detected Next.js version: 16.4.6";
   "MIGRAÇÃO PULADA"; nenhuma linha de nível error.
2. **A medição da auditoria,** no navegador do Victor, só lendo e sem telemetria (`BH_TELEMETRY=0`, `BH_RECORD=0` e
   `BH_TAB_MARKER=0`), com um quadro forçado antes de medir cada rota e a contagem das partes pendentes (uma rota com
   parte pendente não vale, o 345). **A medida não grava dado de cliente nenhum** (o 338): só tamanhos, contagens e o
   host. A prévia lê os posts de verdade da conta.
   - **Em 390x844:**
     - o `/publicar` no mês e na semana: a lista por dia aparece, a grade não, e a página não rola de lado
       (`document.documentElement.scrollWidth <= innerWidth`); cada dia com o título e os cartões, levando à página do
       post;
     - o vazio, num mês sem posts, por GET da navegação (por exemplo, `/publicar?v=mes&em=2027-06`), sem gravar nada:
       a frase "Nada marcado neste período." aparece uma vez só;
     - o post (`/publicar/post/[id]`): o Remarcar e o "Cancelar este post" com 44 px, num post pendente da conta de
       provas, se houver um (senão, "medidos pelo código"); o "Ver no LinkedIn ↗" com 24 px, se houver um post do
       LinkedIn;
     - o `/automacoes`: o Pausar/Ativar com 44 px e os outros botões da linha com 28; a foto da linha, para ver se as
       alturas misturadas parecem defeito (o 350);
     - o editor (`/automacoes/[id]`): o aviso "A edição das automações é pelo computador" aparece, o "Salvar automação"
       não, e o "← Automações" tem 24 px;
     - nenhum erro do app no console; os de extensão (`chrome-extension://`) ficam fora da conta (o 346).
   - **Em 1280 de largura** (a regra "o computador não muda", medida): no `/publicar`, a grade aparece e a lista some;
     no mês sem posts, a frase do vazio aparece uma vez só.
3. **O PR 2 não tem prova no iPhone:** ele não mexe no ícone nem no manifesto.

**Envio 4: o PR,** com o OK do Victor pela caixa.
- O corpo do PR, em `$K/pr-corpo.md`, é escrito depois da execução, com os números medidos, e vai à auditoria com o
  sha256 antes da caixa. Ele explica o porquê, e não tem arroba solta, nem e-mail, nem conta, nem rodapé de IA, nem
  `Co-Authored-By`.
- **O título do PR é a mensagem do merge** (o 305): "O calendário de Publicações vira uma lista por dia no celular, e
  o post e as Automações ganham botões do tamanho do dedo". A caixa do PR mostra o título como a mensagem que vai ao
  merge.
- A conferência do Envio 1, de novo. Depois:

```bash
S="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/28ff177f-dfa7-439e-ba1a-dc70de81ea3c/scratchpad"
cd "$S/x" || exit 1
gh pr create --base main --head celular-2 --title "O calendário de Publicações vira uma lista por dia no celular, e o post e as Automações ganham botões do tamanho do dedo" --body-file "$S/celular2/pr-corpo.md"
```

**Envio 5: antes do merge.** O merge publica na produção (a `main` faz o deploy), então vale a ordem: a caixa do
Victor, a hora mandada à auditoria e o "pode" dela.
1. A conferência do Envio 1, de novo.
2. O commit provado é o que vai ao merge:

```bash
cd "C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/28ff177f-dfa7-439e-ba1a-dc70de81ea3c/scratchpad/x" || exit 1
git rev-parse HEAD                                        # o commit provado
git ls-remote origin refs/heads/celular-2 | cut -f1       # o mesmo
gh pr view celular-2 --json headRefOid --jq .headRefOid   # o mesmo
```

   Se os três não forem o mesmo commit, pare.
3. **A caixa do merge**, com o essencial dentro: a mensagem do merge é o título do PR; o Victor confere, em
   github.com/settings/emails, que o "Keep my email addresses private" continua ligado (o 333); e **a primeira hora**
   (o 361): quem fica com a sessão aberta até a leitura de +50 minutos. Se o merge for perto do fim do dia, ele fica
   para o dia seguinte.
4. A hora mandada à auditoria.
5. **A linha de base, pela Vercel** (a regra do 308): o `list_deployments` de produção (o último READY, na `96b5cbb`,
   e nenhum build em andamento); o log do build desse deploy, para comparar com o do merge; e o `get_runtime_errors` e
   o `get_runtime_logs` com nível error/fatal, desde 30 min antes.
6. O "pode" da auditoria. O merge é do Victor, no GitHub. A caixa seguinte é de resultado, depois de ele dizer que
   terminou: sem "(Recomendado)" e com "Não fiz / não lembro". Nela, o Victor diz também se apareceu o seletor de
   e-mail e o que escolheu.

**Envio 6: o deploy do merge,** lido pela auditoria pelo conector:
- o deploy novo de produção READY, no sha do merge;
- no log do build: o commit do merge; "Detected Next.js version: 16.4.6"; "Nada a aplicar: as 26 migrações já constam
  no registro."; e nenhuma linha de nível error;
- o DEV confere, só lendo, no domínio de produção e sem cookie (o 357): o `/entrar` dá 200, e o cron sem senha
  (`/api/cron/daily`) dá 401;
- o DEV confere que o merge não tem e-mail pessoal: `git log -1 --format='%ae %ce' <sha do merge> | sed 's/[^ ]*@/@/g'`
  mostra só domínios do GitHub (`@users.noreply.github.com` ou `@github.com`), e nenhum outro;
- se o deploy der erro, nada novo vai à `main`, e o caso vai à caixa, com o log.

**Envio 7: a primeira hora (as regras do 306 e do 361).**
- O DEV anota as duas horas, contadas do READY do deploy novo: +15 min e +50 min. Em cada uma, a auditoria lê o
  `get_runtime_errors` e o `get_runtime_logs` (nível error/fatal), e o DEV cobra a leitura dela. As duas horas vão ao
  relatório.
- Um aviso programado não sobrevive ao fim da sessão (o 361): quem ficou combinado no Envio 5 fica com a sessão
  aberta até a +50.
- Passa com zero, ou só com o que já estava na linha de base. Se divergir, pare e avise. O caminho de volta é
  promover de novo o deploy da `96b5cbb`. Isso grava na produção: só com a caixa do Victor, e quem promove é o Victor,
  ou o DEV com o "pode" da auditoria.

**Envio 8: a limpeza,** com o OK do Victor pela caixa, depois da primeira hora fechada. Um bloco só, que para no
primeiro desvio, sem `--force`, com o sha inteiro em cada trava (o 334), no molde da limpeza do PR 1:
- as duas worktrees, a do ensaio (`$S/m`) e a da execução (`$S/x`), ambas com `node_modules` e `.next`: antes de cada
  `git worktree remove`, o maior caminho é medido, e acima de 259 caracteres a pasta é movida para um caminho mais
  curto (o 307);
- os ramos locais `ensaio-celular-2` e `ensaio-celular-2b` (com `-D`, depois de conferir o sha de cada um: o
  `640e43b…` e o `2df9e02…`) e `celular-2` (com `-d`, porque está inteiro na `main`);
- o ramo `celular-2` no remoto, depois de conferir o sha dele (o repositório tem `delete_branch_on_merge=false`);
- a `main` local avançada só por ff até o merge.
O bloco da limpeza vai à auditoria, com o sha256, antes da caixa.

---

## Apêndice A: os roteiros

<!-- bloco: extrair-bloco.mjs -->
```js
// Item 3: tira um bloco do plano para um arquivo, sem cópia à mão.
// No plano, cada arquivo a criar vem numa linha "<!-- bloco: <nome> -->", seguida de um bloco cercado por três
// ou mais crases. Este roteiro acha a linha do nome (tem de haver EXATAMENTE uma), pega o conteúdo do bloco que
// vem logo depois, sem as cercas, e grava no destino, em LF e com a quebra de linha final. Ele só grava o destino,
// e para se o destino já existir.
// Uso: node extrair-bloco.mjs <plano.md> <nome-do-bloco> <arquivo-de-destino>
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const [plano, nome, destino] = process.argv.slice(2);
if (!plano || !nome || !destino) {
  console.error("uso: node extrair-bloco.mjs <plano.md> <nome-do-bloco> <arquivo-de-destino>");
  process.exit(1);
}
if (existsSync(destino)) {
  console.log(`PARADO: ${destino} já existe`);
  process.exit(1);
}
const linhas = readFileSync(plano, "utf8").replace(/\r\n/g, "\n").split("\n");
const marca = `<!-- bloco: ${nome} -->`;
const onde = linhas.flatMap((l, i) => (l.trim() === marca ? [i] : []));
if (onde.length !== 1) {
  console.log(`PARADO: a marca "${marca}" aparece ${onde.length} vezes, e não 1`);
  process.exit(1);
}
const abre = linhas[onde[0] + 1] ?? "";
const cerca = /^(`{3,})/.exec(abre)?.[1];
if (!cerca) {
  console.log(`PARADO: a linha depois da marca não abre um bloco: ${abre}`);
  process.exit(1);
}
const fim = linhas.findIndex((l, i) => i > onde[0] + 1 && l === cerca);
if (fim < 0) {
  console.log(`PARADO: o bloco de "${nome}" não fecha`);
  process.exit(1);
}
writeFileSync(destino, `${linhas.slice(onde[0] + 2, fim).join("\n")}\n`, "utf8");
console.log(`GRAVADO: ${destino} (${fim - onde[0] - 2} linhas, do bloco "${nome}")`);
```

<!-- bloco: varrer-texto.mjs -->
```js
// A varredura de texto antes de cada commit (COMECE-AQUI.md:191). Só lê.
// Para cada arquivo dado, acusa:
//   - caractere de controle (U+0000-U+0008, U+000B, U+000C, U+000E-U+001F, U+007F), com a linha e o código;
//   - fim de linha misturado (CRLF e LF soltos no mesmo arquivo);
//   - CR sozinho (sem LF depois);
//   - BOM no começo.
// Imprime "limpo" ou os problemas de cada arquivo, e sai com 1 se houver qualquer problema.
// Uso: node varrer-texto.mjs <arquivo> [<arquivo> ...]
import { readFileSync } from "node:fs";

const arquivos = process.argv.slice(2);
if (!arquivos.length) {
  console.error("uso: node varrer-texto.mjs <arquivo> [<arquivo> ...]");
  process.exit(1);
}
let problemas = 0;
for (const arquivo of arquivos) {
  const texto = readFileSync(arquivo, "utf8");
  const achados = [];
  if (texto.charCodeAt(0) === 0xfeff) achados.push("BOM no começo");
  const crlf = (texto.match(/\r\n/g) ?? []).length;
  const lf = (texto.match(/(?<!\r)\n/g) ?? []).length;
  const crSozinho = (texto.match(/\r(?!\n)/g) ?? []).length;
  if (crlf && lf) achados.push(`fim de linha misturado: ${crlf} CRLF e ${lf} LF`);
  if (crSozinho) achados.push(`${crSozinho} CR sozinho`);
  texto.split("\n").forEach((linha, i) => {
    for (const ch of linha.replace(/\r$/, "")) {
      const c = ch.charCodeAt(0);
      if ((c < 0x20 && c !== 0x09) || c === 0x7f) achados.push(`linha ${i + 1}: controle U+${c.toString(16).padStart(4, "0").toUpperCase()}`);
    }
  });
  const fim = crlf ? "CRLF" : "LF";
  if (achados.length) {
    problemas += achados.length;
    console.log(`PROBLEMA ${arquivo} (${fim}):`);
    for (const a of achados) console.log(`  ${a}`);
  } else {
    console.log(`limpo ${arquivo} (${fim})`);
  }
}
process.exit(problemas ? 1 : 0);
```

<!-- bloco: guarda-celular-2.mjs -->
```js
// O celular, PR 2 (docs/specs/2026-11-24-celular-onda-1.md, a parte do PR 2): a guarda do diff. Só lê. Na cópia dada
// (a do ensaio ou a da execução), contra a 96b5cbb, confere:
//   1. que só os caminhos previstos para o PR 2 estão alterados ou novos;
//   2. no app/layout.tsx: que toda linha posta ou tirada é comentário. O código do layout não muda no PR 2: só o
//      comentário do `capable` (o achado 360);
//   3. o tamanho de cada troca pequena, pelos números do `git diff --numstat` do ramo do ensaio (ensaio-celular-2b,
//      medido em 26/11): 1 linha posta e 1 tirada no quadro.tsx e no list-client.tsx, 3 e 3 no post/[id]/page.tsx; e,
//      no lib/calendario.ts, nenhuma linha tirada (a lista só acrescenta: 48 postas na forma final);
//   4. no app/publicar/page.tsx, o achado 375: toda linha com "CartaoDoCalendario" (com maiúscula) é comentário, e
//      "cartaoDoCalendario(" aparece exatamente 3 vezes (a definição e as duas chamadas, na grade e na lista). O cartão
//      é uma função chamada no corpo, e não um componente filho, porque a integração lê a tela pelo `textoDaArvore`,
//      que não desce em componente filho (testes-integracao/texto-da-arvore.ts:37-53).
// Cada conferência só vale quando o arquivo dela já mudou. Os arquivos da cópia são lidos com o CRLF trocado por LF.
// Uso: node guarda-celular-2.mjs <raiz-da-copia>   (sai com 0 se tudo está dentro; com 1 e o que está fora)
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const raiz = process.argv[2];
if (!raiz) {
  console.log("uso: node guarda-celular-2.mjs <raiz-da-copia>");
  process.exit(1);
}
const BASE = "96b5cbb";
const PREVISTOS = new Set([
  "docs/specs/2026-11-24-celular-onda-1.md",
  "docs/plans/2026-11-26-celular-onda-1-pr2.md",
  "testes-dom/quadro-no-celular.dom.tsx",
  "lib/calendario.ts",
  "tests/calendario-lista.test.ts",
  "app/publicar/page.tsx",
  "app/publicar/post/[id]/page.tsx",
  "app/automacoes/list-client.tsx",
  "app/automacoes/editor/quadro.tsx",
  "app/layout.tsx",
]);

const git = (...args) => execFileSync("git", args, { cwd: raiz, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const naCopia = (p) => readFileSync(join(raiz, p), "utf8").replace(/\r\n/g, "\n");
let fora = 0;
const acusar = (texto) => {
  console.log(texto);
  fora = 1;
};

// 1. Os caminhos. --no-renames (achado 286): com a detecção de renome, um arquivo movido mostraria só o destino.
const mudados = [
  ...new Set(
    [...git("diff", "--no-renames", "--name-only", BASE).split("\n"), ...git("ls-files", "--others", "--exclude-standard").split("\n")].filter(Boolean)
  ),
].sort();
if (!mudados.length) console.log("(nada mudou)");
for (const p of mudados) {
  if (PREVISTOS.has(p)) console.log(`dentro: ${p}`);
  else acusar(`FORA DA SPEC: ${p}`);
}

// As linhas postas e tiradas de um arquivo rastreado, contra a base (sem o cabeçalho do diff).
const linhasDoDiff = (p) =>
  git("diff", "--no-renames", "-U0", BASE, "--", p)
    .split("\n")
    .filter((l) => /^[-+]/.test(l) && !/^(\+\+\+|---) /.test(l));

// 2. O layout: só comentário.
if (mudados.includes("app/layout.tsx")) {
  const naoComentario = linhasDoDiff("app/layout.tsx").filter((l) => !/^[-+]\s*\/\//.test(l));
  if (naoComentario.length) {
    acusar(`app/layout.tsx FORA: ${naoComentario.length} linha(s) postas ou tiradas que não são comentário:`);
    for (const l of naoComentario) console.log(`  ${l}`);
  } else {
    console.log("app/layout.tsx: só comentário");
  }
}

// 3. O tamanho das trocas pequenas.
const TAMANHOS = [
  ["app/automacoes/editor/quadro.tsx", 1, 1],
  ["app/automacoes/list-client.tsx", 1, 1],
  ["app/publicar/post/[id]/page.tsx", 3, 3],
];
for (const [p, postas, tiradas] of TAMANHOS) {
  if (!mudados.includes(p)) continue;
  const l = linhasDoDiff(p);
  const mais = l.filter((x) => x.startsWith("+")).length;
  const menos = l.filter((x) => x.startsWith("-")).length;
  if (mais === postas && menos === tiradas) console.log(`${p}: ${mais} posta(s) e ${menos} tirada(s), como no ensaio`);
  else acusar(`${p} FORA: ${mais} posta(s) e ${menos} tirada(s), e o ensaio tem ${postas} e ${tiradas}`);
}
if (mudados.includes("lib/calendario.ts")) {
  const l = linhasDoDiff("lib/calendario.ts");
  const mais = l.filter((x) => x.startsWith("+")).length;
  const menos = l.filter((x) => x.startsWith("-")).length;
  if (menos === 0) console.log(`lib/calendario.ts: ${mais} posta(s) e nenhuma tirada (na forma final, 48)`);
  else acusar(`lib/calendario.ts FORA: ${menos} linha(s) tiradas, e a lista só acrescenta`);
}

// 4. O cartão do calendário como função, e não como componente (o achado 375).
if (mudados.includes("app/publicar/page.tsx")) {
  const linhas = naCopia("app/publicar/page.tsx").split("\n");
  const maiusculas = linhas.filter((l) => l.includes("CartaoDoCalendario"));
  const foraDoComentario = maiusculas.filter((l) => !/^\s*(\*|\/\/)/.test(l));
  const chamadas = linhas.join("\n").split("cartaoDoCalendario(").length - 1;
  if (foraDoComentario.length) {
    acusar(`app/publicar/page.tsx FORA: "CartaoDoCalendario" fora de comentário (o 375):`);
    for (const l of foraDoComentario) console.log(`  ${l.trim()}`);
  }
  if (chamadas !== 3) acusar(`app/publicar/page.tsx FORA: "cartaoDoCalendario(" aparece ${chamadas} vez(es), e não 3`);
  if (!foraDoComentario.length && chamadas === 3) {
    console.log(`app/publicar/page.tsx: o cartão é função (3 "cartaoDoCalendario(", e ${maiusculas.length} "CartaoDoCalendario" só em comentário)`);
  }
}

process.exit(fora);
```

<!-- bloco: e2/aplicar-calendario.mjs -->
```js
// O celular, PR 2, E2: a lista do calendário em lib/calendario.ts (docs/specs/2026-11-24-celular-onda-1.md, a parte do
// PR 2, os achados 365 e 367). Dois modos:
// - "esboco" põe o tipo e a função como esboço, logo depois do `recorteDoDia`. O esboço devolve sempre a lista vazia,
//   para o vermelho cair pela afirmação, e não por um import que não existe (o achado 355);
// - "funcao" troca o esboço pela função.
// Confere o trecho inteiro antes de trocar e, se ele não for o esperado, para sem gravar nada. Mantém o fim de linha
// que o arquivo já tem.
// Uso: node aplicar-calendario.mjs <raiz-da-copia> <esboco|funcao>
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [raiz, modo] = process.argv.slice(2);
if (!raiz || !["esboco", "funcao"].includes(modo)) {
  console.log("uso: node aplicar-calendario.mjs <raiz-da-copia> <esboco|funcao>");
  process.exit(1);
}
const parar = (motivo) => {
  console.log(`PARADO, NADA GRAVADO: ${motivo}`);
  process.exit(1);
};
const arquivo = join(raiz, "lib/calendario.ts");
const original = readFileSync(arquivo, "utf8");
const fim = original.includes("\r\n") ? "\r\n" : "\n";
const texto = original.replace(/\r\n/g, "\n");
if (texto.includes("\r")) parar("o lib/calendario.ts tem fim de linha misturado");

const FIM_DO_RECORTE = ["    escondidos: Math.max(0, itens.length - teto),", "  };", "}", ""].join("\n");

const TIPO = [
  "/** Um dia da lista do celular: a casa da grade, o título dela e os itens do dia. */",
  "export type DiaDaLista<T> = {",
  "  casa: Casa;",
  '  /** "ter, 1 de dezembro" */',
  "  titulo: string;",
  "  itens: T[];",
  "};",
  "",
  "",
].join("\n");

const ESBOCO = [
  "// O ESBOÇO DO ENSAIO (o achado 355): a função existe e devolve sempre a lista vazia, para o vermelho cair pela",
  "// afirmação, e não por um import que não existe.",
  "export function listaDoCalendario<T>(casas: Casa[], porDia: Map<string, T[]>): DiaDaLista<T>[] {",
  "  void casas;",
  "  void porDia;",
  "  return [];",
  "}",
  "",
].join("\n");

const FUNCAO = [
  "/**",
  " * A LISTA DO CELULAR: o calendário de Publicações abaixo de 640 px, um dia",
  " * embaixo do outro (docs/specs/2026-11-24-celular-onda-1.md, a parte do PR 2).",
  " *",
  " * ELA MOSTRA EXATAMENTE AS CASAS DA GRADE QUE TÊM ITENS, as do mês vizinho",
  " * também (o achado 365). A consulta da tela busca a grade inteira, e a grade",
  " * desenha os posts das casas vizinhas. Se a lista as tirasse, um post do dia",
  " * 1/12, visto na grade de novembro, sumiria do celular sem contagem nenhuma: o",
  ' * "fora deste período" da tela só conta o que está fora da janela.',
  " *",
  " * ELA NÃO ORDENA NADA (o achado 367). Os dias vêm na ordem das casas, e os",
  " * itens de cada dia já chegam em ordem de hora: a consulta ordena pela mesma",
  " * data que `agruparPorDia` usa, e ele mantém a ordem de chegada. Uma segunda",
  " * ordenação aqui seria uma segunda fonte da ordem.",
  " *",
  " * O POST QUE CAI SÓ NA FOLGA DA JANELA não tem casa, e por isso não entra. A",
  " * lista pode sair vazia com itens na consulta, e é ela, e não a consulta, que",
  " * decide o vazio do celular.",
  " */",
  "export function listaDoCalendario<T>(casas: Casa[], porDia: Map<string, T[]>): DiaDaLista<T>[] {",
  "  const lista: DiaDaLista<T>[] = [];",
  "  for (const casa of casas) {",
  "    const itens = porDia.get(casa.chave);",
  "    if (itens && itens.length > 0) lista.push({ casa, titulo: tituloDoDia(casa.chave), itens });",
  "  }",
  "  return lista;",
  "}",
  "",
  "/**",
  ' * O título de um dia da lista: "ter, 1 de dezembro".',
  " *",
  " * OS NOMES SÃO OS DA GRADE (as colunas e o título do mês), e não uma lista",
  " * nova: o celular e o computador dizem o mesmo dia com as mesmas palavras. O",
  " * mês vai sempre, porque a lista do mês tem dias do mês vizinho.",
  " */",
  "function tituloDoDia(chave: string): string {",
  '  const [, mes, dia] = chave.split("-").map(Number);',
  "  return `${DIAS_DA_SEMANA[diaDaSemana(chave)]}, ${dia} de ${MESES[mes - 1]}`;",
  "}",
  "",
].join("\n");

let nome, antes, depois;
if (modo === "esboco") {
  if (texto.includes("listaDoCalendario")) parar("a listaDoCalendario já existe no arquivo");
  [nome, antes, depois] = ["o esboço, depois do recorteDoDia", FIM_DO_RECORTE, FIM_DO_RECORTE + "\n" + TIPO + ESBOCO];
} else {
  [nome, antes, depois] = ["a função, no lugar do esboço", TIPO + ESBOCO, TIPO + FUNCAO];
}
const vezes = texto.split(antes).length - 1;
if (vezes !== 1) parar(`${nome}: o trecho esperado aparece ${vezes} vezes, e não 1`);
// A troca é por função, e não por texto: num texto de troca, o `$` tem sentido especial para o `replace`.
const novo = texto.replace(antes, () => depois);
writeFileSync(arquivo, fim === "\r\n" ? novo.replace(/\n/g, "\r\n") : novo);
const linhas = (t) => t.split("\n").length - 1;
console.log(
  `GRAVADO: ${nome} no lib/calendario.ts, que passa de ${linhas(texto)} para ${linhas(novo)} linhas (${fim === "\r\n" ? "CRLF" : "LF"}).`
);
```

<!-- bloco: e3/aplicar-publicar-2.mjs -->
```js
// O celular, PR 2, E3: as trocas no app/publicar/page.tsx previstas pela spec (docs/specs/2026-11-24-celular-onda-1.md,
// a parte do PR 2, os achados 365 a 367 e 375):
// - o cartão do post da grade vira uma FUNÇÃO só, a `cartaoDoCalendario`, chamada no corpo da página pela grade e pela
//   lista (os achados 366 e 375), e não um componente filho: a leitura dos testes de integração não desce em
//   componente filho (testes-integracao/texto-da-arvore.ts:37-53). O corpo dela é TIRADO do arquivo, e não reescrito
//   à mão: o roteiro recorta o trecho do `mostrados.map`, troca o `grade.ancora` do `href` pela prop `ancora` e o
//   `truncate` do rótulo por um que depende de `inteiro`, e tira 22 espaços do recuo. O `key={item.id}` fica no
//   `Link`, como está. Todo o resto do corpo fica igual, letra por letra;
// - a grade fica só de 640 px para cima (`hidden sm:block`), e a lista por dia aparece abaixo disso (`sm:hidden`);
// - o vazio passa a olhar a lista no celular, com uma frase só em cada largura (o 365).
// Antes de trocar, confere que o arquivo (sem os CR) é o da `96b5cbb` e que cada trecho aparece uma vez só. Se algo não
// for o esperado, para sem gravar nada. Mantém o fim de linha que o arquivo já tem.
// Uso: node aplicar-publicar-2.mjs <raiz-da-copia>
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const raiz = process.argv[2];
if (!raiz) {
  console.log("uso: node aplicar-publicar-2.mjs <raiz-da-copia>");
  process.exit(1);
}
const parar = (motivo) => {
  console.log(`PARADO, NADA GRAVADO: ${motivo}`);
  process.exit(1);
};
const SHA_DA_MAIN = "a063bb57dafcb0afb6616e1076e3fc5870cdcb2c5a54f9c7708ccab68d33dc8e";
const arquivo = join(raiz, "app/publicar/page.tsx");
const original = readFileSync(arquivo, "utf8");
const fim = original.includes("\r\n") ? "\r\n" : "\n";
const texto = original.replace(/\r\n/g, "\n");
if (texto.includes("\r")) parar("o app/publicar/page.tsx tem fim de linha misturado");
const sha = createHash("sha256").update(texto, "utf8").digest("hex");
if (sha !== SHA_DA_MAIN) parar(`o arquivo, sem os CR, não é o da 96b5cbb (sha ${sha})`);

const umaVez = (onde, trecho, nome) => {
  const vezes = onde.split(trecho).length - 1;
  if (vezes !== 1) parar(`${nome}: o trecho esperado aparece ${vezes} vezes, e não 1`);
};
// A troca é por função, e não por texto: num texto de troca, o `$` tem sentido especial para o `replace`.
const trocar = (onde, antes, depois) => onde.replace(antes, () => depois);

// ---------------------------------------------------------------------------------------------------------------
// O CARTÃO: recortado do `mostrados.map` da grade.
const INICIO_DO_MAP = "                      {mostrados.map((item) => {\n";
const FIM_DO_MAP = "                      })}\n\n                      {/* QUEM CORTA TEM DE CONTAR";
umaVez(texto, INICIO_DO_MAP, "o começo do mostrados.map");
umaVez(texto, FIM_DO_MAP, "o fim do mostrados.map");
const comeco = texto.indexOf(INICIO_DO_MAP);
const fimDoCorpo = texto.indexOf(FIM_DO_MAP);
if (fimDoCorpo < comeco) parar("o fim do mostrados.map vem antes do começo");
let corpo = texto.slice(comeco + INICIO_DO_MAP.length, fimDoCorpo);
const linhasDoCorpo = corpo.split("\n").length - 1;
if (linhasDoCorpo !== 92) parar(`o corpo do cartão tem ${linhasDoCorpo} linhas, e não 92 (as 445-536 da 96b5cbb)`);

// O `key={item.id}` FICA: chamada como função, a raiz que ela devolve é o elemento da lista (o achado 375).
const KEY = "                            key={item.id}\n";
const HREF_ANTES = "                            href={`/publicar/post/${item.id}?v=${visao}&em=${grade.ancora}`}\n";
const HREF_DEPOIS = "                            href={`/publicar/post/${item.id}?v=${visao}&em=${ancora}`}\n";
const ROTULO_ANTES = "                              <span className={`block truncate text-[11px] ${muted}`}>\n";
const ROTULO_DEPOIS = '                              <span className={`block ${inteiro ? "" : "truncate "}text-[11px] ${muted}`}>\n';
umaVez(corpo, KEY, "o key do Link");
umaVez(corpo, HREF_ANTES, "o href do Link");
umaVez(corpo, ROTULO_ANTES, "o span do rótulo");
corpo = trocar(corpo, HREF_ANTES, HREF_DEPOIS);
corpo = trocar(corpo, ROTULO_ANTES, ROTULO_DEPOIS);
const RECUO = " ".repeat(22);
const corpoSemRecuo = corpo
  .split("\n")
  .map((linha) => {
    if (linha === "") return linha;
    if (!linha.startsWith(RECUO)) parar(`uma linha do cartão tem menos de 22 espaços de recuo: ${linha}`);
    return linha.slice(RECUO.length);
  })
  .join("\n");

const FUNCAO = [
  "",
  "/**",
  " * O CARTÃO DE UM POST NO CALENDÁRIO, um só, usado pela grade e pela lista do",
  " * celular (docs/specs/2026-11-24-celular-onda-1.md, o achado 366).",
  " *",
  " * ESCREVER OUTRO CARTÃO PARA A LISTA criaria duas fontes para as mesmas",
  " * decisões (a capa, o ponto de estado, a hora, o rótulo e a âncora do `href`),",
  " * o defeito que o comentário do `agruparPorDia`, no corpo da página, condena.",
  " * Na lista, só muda que o rótulo não corta (`inteiro`): o quadrado da grade é",
  " * estreito, e a linha da lista tem a largura do celular.",
  " *",
  " * ELE É UMA FUNÇÃO CHAMADA NO CORPO DA PÁGINA, e não um componente (o achado",
  " * 375). A leitura dos testes de integração não desce em componente filho",
  " * (testes-integracao/texto-da-arvore.ts:49-53): com um `<CartaoDoCalendario />`,",
  " * o `href` e o rótulo sumiam do texto que eles leem, e quatro casos caíram no",
  " * ensaio. Por isso o nome começa com minúscula, a função não usa hook, e o `key`",
  " * mora no `Link` que ela devolve.",
  " */",
  "function cartaoDoCalendario({",
  "  item,",
  "  visao,",
  "  ancora,",
  "  inteiro,",
  "}: {",
  "  item: QueueItem;",
  '  visao: "mes" | "semana";',
  "  ancora: string;",
  "  inteiro: boolean;",
  "}) {",
].join("\n") + "\n" + corpoSemRecuo + "}\n";

const USO_NA_GRADE = [
  "                      {mostrados.map((item) =>",
  "                        cartaoDoCalendario({ item, visao, ancora: grade.ancora, inteiro: false })",
  "                      )}",
  "",
].join("\n");

// ---------------------------------------------------------------------------------------------------------------
// AS TROCAS DE TEXTO, cada uma conferida inteira.
const TROCAS = [
  ["o import dos tokens", '  emptyWrap,\n} from "../ui";\n', '  emptyWrap,\n  eyebrow,\n} from "../ui";\n'],
  [
    "o import do calendário",
    '  diaSomado,\n} from "@/lib/calendario";\n',
    '  diaSomado,\n  listaDoCalendario,\n} from "@/lib/calendario";\n',
  ],
  [
    "a lista dos dias",
    "  const fora = resumoFora[0] ?? { fora: 0, proximo: null };\n",
    [
      "  const fora = resumoFora[0] ?? { fora: 0, proximo: null };",
      "  // A LISTA DO CELULAR SAI DA MESMA GRADE E DO MESMO AGRUPAMENTO (os achados",
      "  // 365 e 367): ela não consulta nada nem ordena nada, e é ela que decide o",
      "  // vazio abaixo de 640 px.",
      "  const diasDaLista = listaDoCalendario(grade.casas, porDia);",
      "",
    ].join("\n"),
  ],
  [
    "a grade só de 640 px para cima",
    [
      "          {/* A GRADE. `overflow-x-auto` porque sete colunas não cabem em 390px",
      "              sem espremer o conteúdo até ele deixar de ser legível — e a regra",
      "              desta base é que conteúdo largo rola DENTRO do próprio recipiente,",
      "              nunca fazendo a página inteira rolar de lado. */}",
      '          <div className="overflow-x-auto">',
      "",
    ].join("\n"),
    [
      "          {/* A GRADE, SÓ DE 640 PX PARA CIMA. Abaixo disso, sete colunas não",
      "              cabem sem espremer o conteúdo até ele deixar de ser legível, e a",
      "              lista por dia, logo abaixo, toma o lugar dela",
      "              (docs/specs/2026-11-24-celular-onda-1.md, a parte do PR 2). O",
      "              `overflow-x-auto` fica pela regra desta base: conteúdo largo rola",
      "              DENTRO do próprio recipiente, nunca fazendo a página inteira rolar",
      "              de lado. */}",
      '          <div className="hidden overflow-x-auto sm:block">',
      "",
    ].join("\n"),
  ],
  [
    "a lista por dia, depois da grade",
    "          </div>\n\n          {/* O CORTE DA GRADE, DECLARADO.",
    [
      "          </div>",
      "",
      "          {/* A LISTA POR DIA, SÓ ABAIXO DE 640 PX (docs/specs/2026-11-24-celular-onda-1.md,",
      "              a parte do PR 2, os achados 365 a 367). As casas da grade que têm",
      "              posts, um dia embaixo do outro, as do mês vizinho também: a lista",
      '              mostra o mesmo que a grade. O "+N" não existe aqui, porque cada dia',
      "              mostra todos os posts dele. */}",
      "          {diasDaLista.length > 0 && (",
      '            <ol className="space-y-4 px-4 py-3 sm:hidden">',
      "              {diasDaLista.map(({ casa, titulo, itens: doDia }) => (",
      "                <li key={casa.chave}>",
      "                  <h2 className={eyebrow}>{titulo}</h2>",
      '                  <div className="mt-1.5 space-y-1.5">',
      "                    {doDia.map((item) =>",
      "                      cartaoDoCalendario({ item, visao, ancora: grade.ancora, inteiro: true })",
      "                    )}",
      "                  </div>",
      "                </li>",
      "              ))}",
      "            </ol>",
      "          )}",
      "",
      "          {/* O CORTE DA GRADE, DECLARADO.",
    ].join("\n"),
  ],
  [
    "o vazio pela lista no celular",
    [
      "          {/* O VAZIO DIZ O QUE FAZER. Um calendário sem nenhum post no período",
      "              não é erro — é um mês em que ninguém marcou nada, e a frase tem de",
      "              ser um convite e não um silêncio. */}",
      "          {itens.length === 0 && (",
      "            <p className={`px-4 py-6 text-center text-sm ${muted}`}>",
      "",
    ].join("\n"),
    [
      "          {/* O VAZIO DIZ O QUE FAZER. Um calendário sem nenhum post no período",
      "              não é erro — é um mês em que ninguém marcou nada, e a frase tem de",
      "              ser um convite e não um silêncio.",
      "",
      "              E NO CELULAR ELE OLHA A LISTA, e não a consulta (o achado 365). A",
      "              janela tem um dia de folga de cada lado, e um post que cai só na",
      "              folga entra em `itens` sem entrar em nenhuma casa: com a condição",
      "              de antes, a lista ficaria em branco, sem a frase. De 640 px para",
      "              cima, a condição continua a de `itens`, e o `sm:hidden` faz a",
      "              frase aparecer uma vez só em cada largura. */}",
      "          {diasDaLista.length === 0 && (",
      '            <p className={`px-4 py-6 text-center text-sm ${muted} ${itens.length === 0 ? "" : "sm:hidden"}`}>',
      "",
    ].join("\n"),
  ],
];

for (const [nome, antes] of TROCAS) umaVez(texto, antes, nome);
if (!texto.endsWith("    </div>\n  );\n}\n")) parar("o arquivo não termina no fecho da página");
if (/cartaoDoCalendario/i.test(texto)) parar("o cartaoDoCalendario já existe no arquivo");

let novo = texto.slice(0, comeco) + USO_NA_GRADE + texto.slice(fimDoCorpo + "                      })}\n".length);
console.log("app/publicar/page.tsx: o cartão da grade virou a chamada da cartaoDoCalendario");
for (const [nome, antes, depois] of TROCAS) {
  umaVez(novo, antes, nome);
  novo = trocar(novo, antes, depois);
  console.log(`app/publicar/page.tsx: ${nome} trocado`);
}
novo = novo + FUNCAO;
console.log("app/publicar/page.tsx: a cartaoDoCalendario no fim do arquivo");
writeFileSync(arquivo, fim === "\r\n" ? novo.replace(/\n/g, "\r\n") : novo);
const linhas = (t) => t.split("\n").length - 1;
console.log(
  `GRAVADO: 8 trocas no app/publicar/page.tsx, que passa de ${linhas(texto)} para ${linhas(novo)} linhas (${fim === "\r\n" ? "CRLF" : "LF"}).`
);
```

<!-- bloco: e4/aplicar-e4.mjs -->
```js
// O celular, PR 2, E4: os alvos de toque do post e das Automações, e o comentário do `capable` no layout
// (docs/specs/2026-11-24-celular-onda-1.md, a parte do PR 2 e o achado 360). Os moldes são os do PR 1: os 44 px com a
// volta no corte (`min-h-11 lg:min-h-[auto]`, app/app-shell.tsx:149), aqui no `sm`, e os 24 px de um link
// (`inline-flex min-h-6 items-center`, app/page.tsx:418).
// Para cada arquivo, confere que ele (sem os CR) é o da 96b5cbb e que cada trecho aparece uma vez só, ANTES de gravar
// qualquer um. Se algo não for o esperado, para sem gravar nada. Mantém o fim de linha que cada arquivo já tem.
// Uso: node aplicar-e4.mjs <raiz-da-copia>
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const raiz = process.argv[2];
if (!raiz) {
  console.log("uso: node aplicar-e4.mjs <raiz-da-copia>");
  process.exit(1);
}
const parar = (motivo) => {
  console.log(`PARADO, NADA GRAVADO: ${motivo}`);
  process.exit(1);
};

const ARQUIVOS = [
  {
    caminho: "app/publicar/post/[id]/page.tsx",
    sha: "c4fe37b66c1ecafecdaf83fe605e0807ac8c18fbc607da5212d8069164881beb",
    trocas: [
      [
        "o Ver no LinkedIn com 24 px",
        "            className={`inline-block text-sm ${link}`}\n          >\n            Ver no LinkedIn ↗\n",
        "            className={`inline-flex min-h-6 items-center text-sm ${link}`}\n          >\n            Ver no LinkedIn ↗\n",
      ],
      [
        "o Remarcar com 44 px abaixo de 640",
        "            <button className={btnGhost}>Remarcar</button>\n",
        "            <button className={`${btnGhost} min-h-11 sm:min-h-[auto]`}>Remarcar</button>\n",
      ],
      [
        "o Cancelar este post com 44 px abaixo de 640",
        "            <button className={btnDanger}>Cancelar este post</button>\n",
        "            <button className={`${btnDanger} min-h-11 sm:min-h-[auto]`}>Cancelar este post</button>\n",
      ],
    ],
  },
  {
    caminho: "app/automacoes/list-client.tsx",
    sha: "69e7ebe0ad594037efd79b394cad9e6fccddb5a4bc6224b5fc6aa3229dc6c625",
    trocas: [
      [
        "o Pausar e o Ativar com 44 px abaixo de 640",
        '                      title={a.active ? "Pausar automação" : "Ativar automação"}\n                      className={btnLinha}\n',
        '                      title={a.active ? "Pausar automação" : "Ativar automação"}\n                      className={`${btnLinha} min-h-11 sm:min-h-[auto]`}\n',
      ],
    ],
  },
  {
    caminho: "app/automacoes/editor/quadro.tsx",
    sha: "56dc2ed2b7c702ae274318740ff227d0f5a49cc9b614a41995224e482f9e4f4f",
    trocas: [
      [
        "o ← Automações com 24 px",
        '          href="/automacoes"\n          className="shrink-0 text-sm text-quieto',
        '          href="/automacoes"\n          className="inline-flex min-h-6 shrink-0 items-center text-sm text-quieto',
      ],
    ],
  },
  {
    caminho: "app/layout.tsx",
    sha: "97858a1d7323d75d6aa6ccc1bed23677b7c5c3389869729fad13c38c254c4439",
    trocas: [
      [
        "o comentário do capable (o achado 360)",
        [
          "// O `appleWebApp.title` é o nome que o iPhone dá ao ícone na tela de início. O `capable` fica de fora: no",
          "// 16.4.6 ele escreve `mobile-web-app-capable` (node_modules/next/dist/lib/metadata/metadata-elements.js:446-452),",
          '// e quem abre o app sem a barra do navegador é o `display: "standalone"` do manifesto',
          "// (docs/specs/2026-11-24-celular-onda-1.md, o achado 339).",
          "",
        ].join("\n"),
        [
          "// O `appleWebApp.title` é o nome que o iPhone dá ao ícone na tela de início. O `capable` não é escrito, e mesmo",
          "// assim sai como `true`: com o `appleWebApp` sem a chave, o Next o resolve como `true`",
          "// (node_modules/next/dist/lib/metadata/resolvers/resolve-basics.js:197) e escreve `mobile-web-app-capable`",
          "// (node_modules/next/dist/lib/metadata/metadata-elements.js:446-452). Quem abre o app sem a barra do navegador é",
          '// o `display: "standalone"` do manifesto, e a meta não atrapalha (docs/specs/2026-11-24-celular-onda-1.md, os',
          "// achados 339 e 360).",
          "",
        ].join("\n"),
      ],
    ],
  },
];

// PRIMEIRO CONFERE TUDO, DEPOIS GRAVA: um arquivo fora do esperado não deixa os outros pela metade.
const prontos = [];
for (const { caminho, sha, trocas } of ARQUIVOS) {
  const arquivo = join(raiz, caminho);
  const original = readFileSync(arquivo, "utf8");
  const fim = original.includes("\r\n") ? "\r\n" : "\n";
  const texto = original.replace(/\r\n/g, "\n");
  if (texto.includes("\r")) parar(`${caminho}: fim de linha misturado`);
  const medido = createHash("sha256").update(texto, "utf8").digest("hex");
  if (medido !== sha) parar(`${caminho}: o arquivo, sem os CR, não é o da 96b5cbb (sha ${medido})`);
  let novo = texto;
  for (const [nome, antes, depois] of trocas) {
    const vezes = novo.split(antes).length - 1;
    if (vezes !== 1) parar(`${caminho}: ${nome}: o trecho esperado aparece ${vezes} vezes, e não 1`);
    // A troca é por função, e não por texto: num texto de troca, o `$` tem sentido especial para o `replace`.
    novo = novo.replace(antes, () => depois);
  }
  prontos.push({ caminho, arquivo, fim, texto, novo, trocas });
}
const linhas = (t) => t.split("\n").length - 1;
for (const { caminho, arquivo, fim, texto, novo, trocas } of prontos) {
  writeFileSync(arquivo, fim === "\r\n" ? novo.replace(/\n/g, "\r\n") : novo);
  for (const [nome] of trocas) console.log(`${caminho}: ${nome}`);
  console.log(`GRAVADO: ${caminho}, de ${linhas(texto)} para ${linhas(novo)} linhas (${fim === "\r\n" ? "CRLF" : "LF"}).`);
}
```

<!-- bloco: e5/mutar-celular-2.mjs -->
```js
// O celular, PR 2: as mutações (docs/specs/2026-11-24-celular-onda-1.md, "Os testes", com a emenda do PR 2). Cada
// mutação estraga UMA proteção, roda o teste que deveria pegá-la e mostra QUAIS casos caíram. Depois, o arquivo volta
// pelo `git checkout --`. Uma mutação que não derruba nenhum caso é um teste que não mede nada.
//
// As da spec emendada, para o PR 2, no molde do mutar-celular-1.mjs do PR 1:
//   1. o aviso tirado do quadro (o teste de tela monta o Quadro de verdade: o achado 368);
//   2. o `hidden` tirado da caixa do Salvar (o "Salvar automação" passaria a aparecer abaixo de 640 px);
//   3. na lista do calendário, um dia sem posts deixado entrar;
//   4. na lista do calendário, os dias do mês vizinho tirados (o achado 365);
//   5. na lista do calendário, a ordem dos dias invertida;
//   6. na lista do calendário, a ordem dos posts de cada dia invertida (o achado 367);
//   7. a lista montada pelas chaves do `porDia`, e não pelas casas da grade (a sugestão da auditoria: ela prova que
//      o caso da folga, o achado 365, morde).
// A 6 e a 7 não estão na lista da spec: elas ficam no roteiro e no plano.
//
// Cada mutação confere, depois do `git checkout --`, que o arquivo voltou com o MESMO sha de antes e que a árvore
// ficou limpa.
//
// GRAVA na cópia dada, um arquivo por vez, e o desfaz em seguida. Para se a árvore não estiver limpa no começo, se
// um trecho não aparecer exatamente uma vez, ou se a árvore não voltar limpa depois de cada mutação.
// Uso: node mutar-celular-2.mjs <raiz-da-copia>
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const raiz = process.argv[2];
if (!raiz) {
  console.log("uso: node mutar-celular-2.mjs <raiz-da-copia>");
  process.exit(1);
}
const git = (...args) => execFileSync("git", args, { cwd: raiz, encoding: "utf8" });
const parar = (motivo) => {
  console.log(`PARADO: ${motivo}`);
  process.exit(1);
};
if (git("status", "--porcelain").trim()) parar("a árvore não está limpa no começo");

const TELA = { config: "vitest.dom.config.ts", testes: ["testes-dom/quadro-no-celular.dom.tsx"] };
const LISTA = { config: null, testes: ["tests/calendario-lista.test.ts"] };

const MUTACOES = [
  {
    nome: "1. o aviso tirado do quadro",
    arquivo: "app/automacoes/editor/quadro.tsx",
    trocas: [
      [
        [
          '        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700 dark:bg-amber-950/40">',
          "          A edição das automações é pelo computador — o quadro precisa de arrastar e soltar. Abaixo,",
          "          os blocos desta automação em modo leitura. O caminho entre eles são as setas do quadro, e",
          "          elas só aparecem no computador.",
          "        </div>",
          "",
        ].join("\n"),
        "",
      ],
    ],
    ...TELA,
  },
  {
    nome: "2. o hidden tirado da caixa do Salvar",
    arquivo: "app/automacoes/editor/quadro.tsx",
    trocas: [
      [
        '        <div className="ml-auto hidden shrink-0 items-center gap-3 sm:flex">\n',
        '        <div className="ml-auto shrink-0 items-center gap-3 sm:flex">\n',
      ],
    ],
    ...TELA,
  },
  {
    nome: "3. um dia sem posts deixado entrar na lista",
    arquivo: "lib/calendario.ts",
    trocas: [
      [
        "    if (itens && itens.length > 0) lista.push({ casa, titulo: tituloDoDia(casa.chave), itens });\n",
        "    lista.push({ casa, titulo: tituloDoDia(casa.chave), itens: itens ?? [] });\n",
      ],
    ],
    ...LISTA,
  },
  {
    nome: "4. os dias do mês vizinho tirados da lista",
    arquivo: "lib/calendario.ts",
    trocas: [
      [
        "    if (itens && itens.length > 0) lista.push(",
        "    if (casa.doMes && itens && itens.length > 0) lista.push(",
      ],
    ],
    ...LISTA,
  },
  {
    nome: "5. a ordem dos dias invertida",
    arquivo: "lib/calendario.ts",
    trocas: [["  return lista;\n", "  return lista.reverse();\n"]],
    ...LISTA,
  },
  {
    nome: "6. a ordem dos posts de cada dia invertida",
    arquivo: "lib/calendario.ts",
    trocas: [
      [
        "lista.push({ casa, titulo: tituloDoDia(casa.chave), itens });\n",
        "lista.push({ casa, titulo: tituloDoDia(casa.chave), itens: [...itens].reverse() });\n",
      ],
    ],
    ...LISTA,
  },
  {
    nome: "7. a lista montada pelas chaves do porDia, e não pelas casas",
    arquivo: "lib/calendario.ts",
    trocas: [
      [
        "  for (const casa of casas) {\n    const itens = porDia.get(casa.chave);\n",
        [
          "  for (const [chave, itens] of porDia) {",
          "    const casa = casas.find((c) => c.chave === chave) ?? { chave, dia: Number(chave.slice(8)), doMes: false, hoje: false };",
          "",
        ].join("\n"),
      ],
    ],
    ...LISTA,
  },
];
const sha = (caminho) => createHash("sha256").update(readFileSync(caminho)).digest("hex");

const vitest = ({ config, testes }) =>
  spawnSync(
    process.execPath,
    ["node_modules/vitest/vitest.mjs", "run", ...(config ? ["--config", config] : []), ...testes],
    { cwd: raiz, encoding: "utf8" }
  );

let semQueda = 0;
for (const m of MUTACOES) {
  console.log(`== ${m.nome} (${m.arquivo})`);
  const caminho = join(raiz, m.arquivo);
  const shaAntes = sha(caminho);
  const original = readFileSync(caminho, "utf8");
  const fim = original.includes("\r\n") ? "\r\n" : "\n";
  let texto = original.replace(/\r\n/g, "\n");
  for (const [antes, depois] of m.trocas) {
    const vezes = texto.split(antes).length - 1;
    if (vezes !== 1) parar(`${m.arquivo}: um trecho da mutação aparece ${vezes} vezes, e não 1`);
    // A troca é por função, e não por texto: num texto de troca, o `$` tem sentido especial para o `replace`.
    texto = texto.replace(antes, () => depois);
  }
  writeFileSync(caminho, fim === "\r\n" ? texto.replace(/\n/g, "\r\n") : texto);
  const r = vitest(m);
  const saida = `${r.stdout}\n${r.stderr}`;
  const caidos = [...new Set(saida.split("\n").filter((l) => /^\s*FAIL\s/.test(l)).map((l) => l.trim()))];
  const placar = saida.split("\n").filter((l) => /^\s*Tests\s/.test(l)).map((l) => l.trim());
  console.log(`vitest: ${r.status}; ${placar.join(" | ") || "(sem placar)"}`);
  for (const c of caidos.slice(0, 12)) console.log(`  ${c}`);
  if (r.status === 0 || caidos.length === 0) {
    console.log("  NENHUM CASO CAIU: o teste não mede esta proteção");
    semQueda++;
  }
  git("checkout", "--", m.arquivo);
  const shaDepois = sha(caminho);
  if (shaDepois !== shaAntes) parar(`${m.arquivo} não voltou com o mesmo sha depois da mutação ${m.nome}`);
  if (git("status", "--porcelain").trim()) parar(`a árvore não voltou limpa depois da mutação ${m.nome}`);
  console.log(`  desfeita; ${m.arquivo} de volta no sha ${shaDepois.slice(0, 12)}; árvore limpa`);
}

console.log("== os mesmos testes, na árvore limpa");
let falhaNoFim = 0;
for (const grupo of [LISTA, TELA]) {
  const r = vitest(grupo);
  const placar = `${r.stdout}\n${r.stderr}`.split("\n").filter((l) => /^\s*(Test Files|Tests)\s/.test(l)).map((l) => l.trim());
  console.log(`vitest ${grupo.testes.join(" ")}: ${r.status}; ${placar.join(" | ")}`);
  if (r.status) falhaNoFim++;
}
console.log(`FIM: ${MUTACOES.length - semQueda} de ${MUTACOES.length} mutações caíram.`);
process.exit(semQueda || falhaNoFim ? 1 : 0);
```

## Apêndice B: as mutações do ensaio

Rodadas na cópia do ensaio, no ramo `ensaio-celular-2b`, sobre a `2df9e02` commitada e limpa, com o "pode" da
auditoria. A saída:

```text
== 1. o aviso tirado do quadro (app/automacoes/editor/quadro.tsx)
vitest: 1; Tests  1 failed | 1 passed (2)
  FAIL  testes-dom/quadro-no-celular.dom.tsx > o editor das automações no celular > abaixo de 640 px, o quadro diz que a edição é pelo computador
  desfeita; app/automacoes/editor/quadro.tsx de volta no sha 5779a48d4630; árvore limpa
== 2. o hidden tirado da caixa do Salvar (app/automacoes/editor/quadro.tsx)
vitest: 1; Tests  1 failed | 1 passed (2)
  FAIL  testes-dom/quadro-no-celular.dom.tsx > o editor das automações no celular > o Salvar fica escondido abaixo de 640 px e só aparece de 640 px para cima
  desfeita; app/automacoes/editor/quadro.tsx de volta no sha 5779a48d4630; árvore limpa
== 3. um dia sem posts deixado entrar na lista (lib/calendario.ts)
vitest: 1; Tests  6 failed (6)
  FAIL  tests/calendario-lista.test.ts > a lista do calendário no celular > o dia do mês vizinho entra, como na grade, com o mês dele no título (o achado 365)
  FAIL  tests/calendario-lista.test.ts > a lista do calendário no celular > o post que cai só na folga da janela não tem casa e não entra (o achado 365)
  FAIL  tests/calendario-lista.test.ts > a lista do calendário no celular > os dias saem na ordem da grade, e os posts de cada dia na ordem em que chegaram (o achado 367)
  FAIL  tests/calendario-lista.test.ts > a lista do calendário no celular > a semana que atravessa a virada do mês dá os dois meses nos títulos
  FAIL  tests/calendario-lista.test.ts > a lista do calendário no celular > uma grade sem posts dá uma lista vazia
  FAIL  tests/calendario-lista.test.ts > a lista do calendário no celular > um dia com a lista de posts vazia não entra
  desfeita; lib/calendario.ts de volta no sha 854cd325f62b; árvore limpa
== 4. os dias do mês vizinho tirados da lista (lib/calendario.ts)
vitest: 1; Tests  1 failed | 5 passed (6)
  FAIL  tests/calendario-lista.test.ts > a lista do calendário no celular > o dia do mês vizinho entra, como na grade, com o mês dele no título (o achado 365)
  desfeita; lib/calendario.ts de volta no sha 854cd325f62b; árvore limpa
== 5. a ordem dos dias invertida (lib/calendario.ts)
vitest: 1; Tests  2 failed | 4 passed (6)
  FAIL  tests/calendario-lista.test.ts > a lista do calendário no celular > os dias saem na ordem da grade, e os posts de cada dia na ordem em que chegaram (o achado 367)
  FAIL  tests/calendario-lista.test.ts > a lista do calendário no celular > a semana que atravessa a virada do mês dá os dois meses nos títulos
  desfeita; lib/calendario.ts de volta no sha 854cd325f62b; árvore limpa
== 6. a ordem dos posts de cada dia invertida (lib/calendario.ts)
vitest: 1; Tests  1 failed | 5 passed (6)
  FAIL  tests/calendario-lista.test.ts > a lista do calendário no celular > os dias saem na ordem da grade, e os posts de cada dia na ordem em que chegaram (o achado 367)
  desfeita; lib/calendario.ts de volta no sha 854cd325f62b; árvore limpa
== 7. a lista montada pelas chaves do porDia, e não pelas casas (lib/calendario.ts)
vitest: 1; Tests  2 failed | 4 passed (6)
  FAIL  tests/calendario-lista.test.ts > a lista do calendário no celular > o post que cai só na folga da janela não tem casa e não entra (o achado 365)
  FAIL  tests/calendario-lista.test.ts > a lista do calendário no celular > os dias saem na ordem da grade, e os posts de cada dia na ordem em que chegaram (o achado 367)
  desfeita; lib/calendario.ts de volta no sha 854cd325f62b; árvore limpa
== os mesmos testes, na árvore limpa
vitest tests/calendario-lista.test.ts: 0; Test Files  1 passed (1) | Tests  6 passed (6)
vitest testes-dom/quadro-no-celular.dom.tsx: 0; Test Files  1 passed (1) | Tests  2 passed (2)
FIM: 7 de 7 mutações caíram.
```
