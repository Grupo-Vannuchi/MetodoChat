# O painel no celular, onda 1: acompanhar pelo celular, com o ícone na tela inicial

**Nascido em:** 24/11/2026, sobre a `main` em `aadf566`. **A v2 é de 25/11/2026**, com a medição de base (a Fase 0)
e as decisões que dependiam dela. **A v3, do mesmo dia,** traz a medição da tabela da Atividade antes do plano (o
achado 349). **A emenda do ensaio, também de 25/11,** troca o 404 do `/favicon.ico` por um redirect (o achado 352) e
traz as cores do ícone que o Victor escolheu depois de vê-lo.

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
  - **o `capable: true` fica fora.** No 16.4.6, ele escreve `<meta name="mobile-web-app-capable">`
    (`node_modules/next/dist/lib/metadata/metadata-elements.js:446-452`). Quem faz o app abrir sem a barra do
    navegador é o `display: standalone` do manifesto (o achado 339). A prova no iPhone mede isso. Se ele abrir com a
    barra, o `capable` volta numa emenda, com uma nova prova.
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

### Publicações

- **O calendário vira uma lista por dia abaixo de 640 px** (`app/publicar/page.tsx:404`):
  - a grade de 7 colunas fica só de 640 px para cima;
  - abaixo disso, aparece uma lista dos dias do período que têm posts, um embaixo do outro, em ordem. Cada dia tem
    um título com a data e os posts dele, com a hora e o tipo inteiros, cada um levando à página do post;
  - vale para a visão "Mês" e para a "Semana". A navegação ("‹", "›", "Hoje", "Semana" e "Mês") continua igual;
  - o "+N" de um dia cheio não aparece na lista, porque ela mostra todos os posts do dia;
  - um período sem posts mostra o estado vazio que já existe;
  - a montagem da lista é uma função pura sobre a mesma grade (`lib/calendario.ts`, `gradeDoMes` na `:137` e
    `gradeDaSemana` na `:166`), com teste próprio.
- **O post (`/publicar/post/[id]`):**
  - o Remarcar (`:315`) e o "Cancelar este post" (`:327`) ganham altura mínima de 44 px abaixo de 640 px;
  - "Ver no LinkedIn ↗" (`:278`) sobe para 24 px, no mínimo.

### Automações

- **A lista (`/automacoes`):** o "Pausar" e o "Ativar" (`app/automacoes/list-client.tsx:331-338`) ganham altura mínima
  de 44 px abaixo de 640 px. "Editar", "Criar uma cópia" e "Excluir automação" ficam com os 28 px de hoje, acima dos
  24. As alturas ficam misturadas na mesma linha (o achado 350). A foto da prova mostra como fica e, se parecer
  defeito, o alinhamento entra neste PR.
- **O editor (`/automacoes/[id]`):**
  - o aviso já existe (`quadro.tsx:1546-1551`). Esta entrega só o cobre com um teste de tela;
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
- **A lista do calendário (puro, novo):** a função monta, a partir da grade, só os dias com posts, em ordem de data,
  com os posts de cada dia em ordem de hora. Uma grade sem posts dá uma lista vazia.
- **O aviso do editor (tela, novo):** o aviso "A edição das automações é pelo computador" aparece no quadro, com a
  classe `sm:hidden`.
- **As mutações:** cada proteção é estragada, uma por vez, e algum teste tem de cair. As mutações são:
  - trocar a igualdade de `PUBLIC_EXATOS` por prefixo;
  - tirar um endereço da lista;
  - pôr os exatos depois da sessão;
  - tirar o aviso;
  - trocar o `display` do manifesto;
  - escrever a descrição à mão no manifesto, sem a constante (o achado 343);
  - tirar o redirect do favicon;
  - na lista do calendário, deixar entrar um dia sem posts e inverter a ordem.
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

**O Victor instala o ícone no iPhone dele,** pelo Safari, em "Adicionar à Tela de Início", a partir da prévia. Ele
conta como o ícone ficou e se o app abre sem a barra do navegador. **O Android fica sem prova** nesta entrega.

**Os dados da Fase 0 que têm dado de cliente** (o `fase0.json` e as fotos, no scratchpad da auditoria) são apagados
quando esta spec for aprovada.

## A entrega

- **Uma spec, dois PRs,** cada um com o ciclo inteiro: ensaio, plano, aplicação do zero pela auditoria, execução e
  envios.
  - **PR 1:** o ícone, o manifesto, o porteiro, a casca, e Início, Desempenho e Atividade.
  - **PR 2:** Publicações e Automações.
- **Um plano por PR.** O PR 2 sai da `main` depois do merge do PR 1.
- **Antes do próximo merge,** a caixa confere que o "Keep my email addresses private" continua ligado (o achado 333).
