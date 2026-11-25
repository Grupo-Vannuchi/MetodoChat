# O painel no celular, onda 1, PR 1: o plano

**Nascido em:** 25/11/2026, sobre a `main` em `aadf566`. A spec é `docs/specs/2026-11-24-celular-onda-1.md`.

**O que o Victor decidiu pela caixa** (a spec traz cada decisão com as opções):
- em 24/11: o uso "acompanhar"; só o ícone, sem push e sem offline; as mesmas telas se ajustam; o Gerador sai da onda
  1; o ícone "M." feito no código; e o favicon trocado também;
- em 25/11, com os números da Fase 0: o calendário vira uma lista por dia (no PR 2); a tabela da Atividade cabe na
  tela; 44 px nos alvos principais e 24 no resto; o "M." desenhado, sem fonte; e a prova no iPhone;
- em 25/11, a **spec aprovada**, a v3, no sha256 `6b270cdd0c2dea4009cfd0ef14d77728e7007b872a0b3ca09a691fe1dcf6ee26`;
- em 25/11, depois de ver o ícone no azul: o fundo preto do painel (`#0b0a0e`), a barra do celular no mesmo preto e o
  ponto do "M." no azul claro (`#78bacd`);
- em 25/11: a tela de abertura do Android também no preto.

**As emendas do ensaio**, que a spec registra em três commits (o E, a citação na F3 e a F5): o `/favicon.ico` leva ao
ícone novo por um redirect no `next.config.ts` (os achados 341, 352 e 353), as cores escolhidas e a tela de abertura.

**O ensaio (25/11):** feito na cópia `m` (`git worktree add --detach` na `aadf566`, com `npm ci` próprio e `.env.local`
vazio, e depois o ramo local `ensaio-celular-1`), bloco a bloco, com o "pode" da auditoria em cada um. Os nove commits
do ensaio, e o patch-id de cada um, que a execução tem de repetir:

| Commit do ensaio | O que é | patch-id |
|---|---|---|
| `78d34a1` | a spec | `f785965595e89c498dd2d3081159c9e45e411524` |
| `691e8ad` | F1: a marca e o manifesto | `eb446b60b1ba8ae7a02ab62a63c9737339ff78f0` |
| `ce55384` | F2: o ícone, no lugar do favicon da Vercel | `eac7aab54687cadc432ac87442a24b304f1302a8` |
| `18063bb` | E: a emenda da spec | `7ce3be5b926da2c662449d92efd943fb897fce4f` |
| `628f244` | C: as cores do ícone e da barra | `7c5ac5e2a20271f7d1516b7f55484e67d7ca6bed` |
| `bcb8b40` | R: o redirect do favicon antigo | `f38a086d2af0528c3954444e76814f9eaaf65482` |
| `58e9e13` | F3: o porteiro, os lados do ícone e os ícones do manifesto | `4c15944a60a8df6cc797014ecfa1e64af749f4e5` |
| `1a1049e` | F4: a casca, o Início e a Atividade | `b22dc81b546ea0409d47cf3dbe7aaa754e9d5480` |
| `e946b1c` | F5: a tela de abertura | `6caafcb7a145cf59e36e70f51def063419962738` |

O plano entra num commit próprio, logo depois da spec, e não tem par no ensaio: o patch-id dele é medido na aplicação
do zero pela auditoria.

---

## O que o ensaio mediu

- **A Fase 0 e a tabela da Atividade:** estão na spec (as 8 rotas em 390x844, e a tabela de hoje e as cinco variantes).
- **O build:** os endereços servidos são `/manifest.webmanifest` (○), `/apple-icon` (○) e `/icon/32`, `/icon/192` e
  `/icon/512` (●). O `/_not-found` é dinâmico (ƒ), como já era antes (o 352).
- **O servidor local não sobe sem um banco com o esquema** (o `instrumentation.ts`, o 353). No ensaio, os endereços
  se medem pela lista de rotas do build e pelo `.next/server/app`. O `<head>` e o 307 do favicon ficam para a prova na
  prévia; os códigos sem sessão, para a produção, logo depois do merge (o 356, no Envio 3).
- **Os ícones:** o DEV abriu o de 512 e o de 180 no azul (F2) e o de 512 no preto (C). Neles, o "M" em papel e o ponto
  ficam centrados e com margem. O de 180 no preto é conferido na prova, no iPhone.
- **O vermelho vem antes em cada fase com teste novo** (F1, C, R, F3 e F5): o vermelho caiu pelo motivo certo, e o
  verde passou com os puros e os de tela inteiros. A F2 e a F4 não têm teste novo, e a E é só texto; o porquê está em
  cada uma.
- **As 6 mutações do PR 1** (o apêndice B): 6 de 6 caíram, cada uma no caso certo, e a árvore voltou limpa.
- **O verify** (na `1a1049e`): 166 arquivos e 3 904 casos puros, 36 e 350 de tela, os quatro "VAZAMENTOS: 0",
  "MIGRAÇÃO PULADA", "Next.js 16.4.6", as 21 páginas e o "ƒ Proxy (Middleware)".
- **A integração** (na `1a1049e`, com o Docker aberto pelo Victor): o alvo no banco de TESTE, 80 arquivos, 1 018 casos e
  8 pulados, igual à `main`, e nenhuma linha com as portas dos bancos de outros projetos (5432 e 54322).
- **A F5 veio depois** das mutações, do verify e da integração. Ela mexe só no manifesto, no teste dele e na spec. No
  verde dela rodaram os puros e os de tela inteiros, e o build. Nenhuma das 6 mutações toca as linhas que a F5 muda, e
  a integração não lê esses arquivos. Por isso, o ensaio não repetiu as três. **Na execução, as três rodam sobre o
  estado final, com a F5.**

## O que fica aberto, fora desta entrega

- **O PR 2** (Publicações e Automações), que sai da `main` depois do merge deste.
- **O 347:** a sessão que cai sem rastro quando o banco falha (o `sessaoDoCookie` engole o erro). Uma entrega à parte.
- **O 325:** o aviso do `minimatch` nas ferramentas de lint. Um PR pequeno.
- **O PR do guia:** a ordem de trabalho nova, a data da `:5` e os achados de 317 em diante.

## Restrições globais

- **Os caminhos.** Todo bloco de comandos começa definindo:
  - `S`, o scratchpad: `C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/e078f16e-47b2-4e08-86f3-8036d4155715/scratchpad`;
  - `C`, a cópia da execução: `$S/x` (nome curto, achado 307);
  - `N`, a pasta do extrair e da varredura: `$S/next`; e `K`, a pasta dos roteiros desta entrega: `$S/celular`;
  - `P`, este plano: `$K/plano.md`, o arquivo que a auditoria leu (no Passo 3, ele é copiado para
    `docs/plans/2026-11-25-celular-onda-1-pr1.md`).
  - A auditoria, ao aplicar o plano do zero, troca `C`, `N` e `K` pelos caminhos dela.
- **O ramo:** `celular-1`, saído da `aadf566`, sem upstream até o push. Nunca commitar nem empurrar na `main`. Todo
  commit vem depois de `test "$(git branch --show-current)" = celular-1 &&`.
- **O autor** é o do git da máquina (Victor Souza, com o e-mail noreply do GitHub). Sem `--author`, sem rodapé de IA (a
  seção 6 do `COMECE-AQUI.md`), e nunca `git config` numa worktree.
- **`git add` com o caminho de cada arquivo.** Nunca `-A` nem `.`.
- **Antes de cada commit,** o `varrer-texto.mjs` nos arquivos da fase, todos "limpo". O commit é um comando à parte.
- **A guarda do diff** (`guarda-celular-1.mjs`) roda no fim de cada fase e sai com 0.
- **As suítes em cada fase** (o 354): os puros e os de tela rodam inteiros no verde de cada fase de código. As
  exceções:
  - **a E**, que é só texto da spec: nenhum teste lê a spec;
  - **a integração**, que roda uma vez, sobre o estado final. Ela precisa do Docker aberto pelo Victor, e nenhum
    arquivo desta entrega é do banco, da fila ou das actions que ela prova.
- **A regra de divergência:** se o blob, o patch-id, a guarda, a varredura ou uma contagem não baterem com o plano,
  pare. Não ajuste nada: mande a saída inteira à auditoria e espere.
- **Nenhum roteiro roda sem o "pode" da auditoria**, nem para testar. Os passos longos rodam em segundo plano de
  propósito, com aviso antes, e a saída só é lida no fim. Nunca uma segunda cópia de um passo que ainda roda.
- **A trava do banco** (o 351): antes de cada build, do verify e da integração, a linha que procura uma variável com
  URL de banco pelo VALOR, e não só pelo nome:
  `node -e 'const a=Object.entries(process.env).filter(([k,v])=>/^postgres(ql)?:\/\//i.test(v||"")).map(([k])=>k); if(a.length){console.log("variável com URL de banco:",a.join(", "),": pare");process.exit(1)} console.log("nenhuma variável com URL de banco")' || exit 1`
- **`npx --no-install`** sempre. O `npm` só roda como está escrito aqui.
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
| `docs/specs/2026-11-24-celular-onda-1.md` | Passo 2, E, F3 e F5 | a spec, a emenda, uma citação e a abertura |
| `docs/plans/2026-11-25-celular-onda-1-pr1.md` | Passo 3 | este plano (novo) |
| `lib/marca.ts` | F1 e C | o nome, a descrição e as cores (novo) |
| `app/manifest.ts` | F1, C, F3 e F5 | o manifesto (novo) |
| `app/layout.tsx` | F1 e C | o `metadata` e o `viewport` |
| `tests/manifesto.test.ts` | F1, C, F3 e F5 | o teste do manifesto (novo) |
| `lib/desenho-do-icone.tsx` | F2, C e F3 | o desenho do "M." e os lados (novo) |
| `app/icon.tsx` | F2 e F3 | os ícones de 32, 192 e 512 (novo) |
| `app/apple-icon.tsx` | F2 | o ícone de 180 do iPhone (novo) |
| `app/favicon.ico` | F2 | apagado |
| `next.config.ts` | R e F3 | o redirect do favicon antigo, e uma citação |
| `tests/favicon.test.ts` | R | o teste do redirect (novo) |
| `proxy.ts` e `tests/proxy-icone.test.ts` | F3 | o porteiro e o teste dele (novo) |
| `app/app-shell.tsx`, `app/page.tsx` e `app/eventos/page.tsx` | F4 | as classes do celular |

E mais nenhum: a guarda do diff confere isso.

---

## Antes da execução: a caixa do Victor

Depois de a auditoria aplicar este plano do zero e os patch-ids baterem, a caixa do "Li, pode executar" vai ao Victor
com o essencial dentro:
- o que este PR muda (o ícone na tela inicial, o manifesto, o porteiro, o menu, o Início e a Atividade no celular);
- **a linha da emenda:** o ensaio emendou a spec aprovada com o redirect do favicon antigo, as cores que ele escolheu e
  a tela de abertura preta;
- **o lembrete do e-mail privado** (o 333): no merge, o "Keep my email addresses private" do GitHub tem de estar
  ligado, como ele deixou em 24/11.

Depois da caixa, a hora mandada à auditoria e o "pode" dela.

## Passo 0: os roteiros

Os roteiros vêm dos blocos do apêndice A. O primeiro, o `extrair-bloco.mjs`, é criado a partir do bloco dele por
qualquer meio e conferido pelo sha256; os outros saem do plano por ele (as pastas `f1`, `f2c`, `f3`, `f4` e `f5` são
criadas antes). Na pasta do DEV eles já existem, e só se confere o sha256.

| Roteiro | Pasta | sha256 |
|---|---|---|
| `extrair-bloco.mjs` | `N` | `8585d040e92f75b0c9f05fa2491cd9a34c7066bac48c4389f6466a6ce307f52a` |
| `varrer-texto.mjs` | `N` | `2e5f91e9083f4873102269ec596fe2c62f97cc47d00a310f29898f08173c9a85` |
| `guarda-celular-1.mjs` | `K` | `2789b52d3abb0e260a7d0f5cce2bff24de69b2c6b02a78c524487134c2e67aec` |
| `f1/aplicar-layout.mjs` | `K` | `88c91e1a65e76efe4eef679a2ab5ca45de34a4bc8eeba854bac015661a6279ef` |
| `f2c/aplicar-emenda.mjs` | `K` | `8a7da7c80f8b3f93969aca352fbbdf823da1f74f249c566618aba5dd930b8659` |
| `f2c/aplicar-cores.mjs` | `K` | `2b98f1620c5d7cd2c1bee025f3b026da2135193999b30e3f01a84004b9a86330` |
| `f2c/aplicar-next-config.mjs` | `K` | `cdab6883e5440b3a331240c7de02d7b753c90a575b549a7629fbd6e510d87dc7` |
| `f3/aplicar-f3.mjs` | `K` | `092fcc688bdd4175141ab4d90094350a82ba7e27c2f63011b2c19963b7183b7f` |
| `f4/aplicar-f4.mjs` | `K` | `059cb7a79b532203af0cd8d9fb20a8ff42f1c81f07bb845d1945a588f0213d97` |
| `f5/aplicar-abertura.mjs` | `K` | `42ae7776de2d84361116c36054f5034cdbf5499901eed3592542742ca62cabad` |
| `mutar-celular-1.mjs` | `K` | `eed2785c87cffb313f24051ec3b8d86ce0eccfc07348fbbaf01a805de02c2c84` |

```bash
S="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/e078f16e-47b2-4e08-86f3-8036d4155715/scratchpad"
N="$S/next"; K="$S/celular"
sha256sum "$N/extrair-bloco.mjs" "$N/varrer-texto.mjs"
( cd "$K" && sha256sum guarda-celular-1.mjs f1/aplicar-layout.mjs f2c/aplicar-emenda.mjs f2c/aplicar-cores.mjs f2c/aplicar-next-config.mjs f3/aplicar-f3.mjs f4/aplicar-f4.mjs f5/aplicar-abertura.mjs mutar-celular-1.mjs )
for f in "$N/extrair-bloco.mjs" "$N/varrer-texto.mjs" "$K/guarda-celular-1.mjs" "$K/f1/aplicar-layout.mjs" "$K/f2c/aplicar-emenda.mjs" "$K/f2c/aplicar-cores.mjs" "$K/f2c/aplicar-next-config.mjs" "$K/f3/aplicar-f3.mjs" "$K/f4/aplicar-f4.mjs" "$K/f5/aplicar-abertura.mjs" "$K/mutar-celular-1.mjs"; do node --check "$f" || { echo "a sintaxe de $f falhou: pare"; exit 1; }; done
echo "sintaxe dos onze roteiros: ok"
```

Esperado: os onze sha256 da tabela e "sintaxe dos onze roteiros: ok".

## Passo 1: a cópia da execução, saída da `main`

```bash
R="c:/Users/Usuario/varandas/MetodoChat"
S="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/e078f16e-47b2-4e08-86f3-8036d4155715/scratchpad"
C="$S/x"; K="$S/celular"
test ! -e "$C" || { echo "a pasta da cópia já existe: pare"; exit 1; }
cd "$R" || exit 1
git fetch origin
test "$(git rev-parse origin/main)" = aadf56683b24ddcc742f773c48f3ed27e2b3954f || { echo "a main mudou: pare"; exit 1; }
test "$(git config user.email | sed 's/.*@//')" = users.noreply.github.com || { echo "o e-mail do git não é o noreply: pare"; exit 1; }
node -e 'const a=Object.entries(process.env).filter(([k,v])=>/^postgres(ql)?:\/\//i.test(v||"")).map(([k])=>k); if(a.length){console.log("variável com URL de banco:",a.join(", "),": pare");process.exit(1)} console.log("nenhuma variável com URL de banco")' || exit 1
git worktree add -b celular-1 "$C" aadf56683b24ddcc742f773c48f3ed27e2b3954f || { echo "o worktree add falhou: pare"; exit 1; }
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
node "$K/guarda-celular-1.mjs" "$C"; echo "guarda: $?"
```

Esperado: "nenhuma variável com URL de banco"; "npm ci: ok"; o maior caminho com no máximo 259 caracteres (senão,
avise antes de seguir: a limpeza vai precisar renomear a pasta); o ramo `celular-1`; o status vazio (o `.env.local`
está no `.gitignore`); "instalado: next 16.4.6"; a guarda com "(nada mudou)" e 0.

## Passo 2: a spec (o commit que repete o `78d34a1`)

<!-- bloco: docs/specs/2026-11-24-celular-onda-1.md -->
```markdown
# O painel no celular, onda 1: acompanhar pelo celular, com o ícone na tela inicial

**Nascido em:** 24/11/2026, sobre a `main` em `aadf566`. **A v2 é de 25/11/2026**, com a medição de base (a Fase 0)
e as decisões que dependiam dela. **A v3, do mesmo dia,** traz a medição da tabela da Atividade antes do plano (o
achado 349).

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
  caminho SVG, sem fonte e sem arquivo binário, pela decisão do Victor. O fundo é quadrado e cheio em `#1a5a6c`, e o
  "M." com o ponto vai em `#fbfaf8`, centralizado e dentro dos 80% do meio, para o Android poder recortar o ícone em
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
  - `background_color`: `#fbfaf8`;
  - `theme_color`: `#1a5a6c`;
  - `icons`: o de 192 e o de 512, com os endereços medidos no build. O de 512 entra também com o
    `purpose: "maskable"`.
- **`app/layout.tsx`:**
  - ganha `export const viewport = { themeColor: "#1a5a6c" }`;
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
    - O ensaio mede: o `/favicon.ico` passa a dar 404 sem ir para `/entrar`; o `<head>` traz o link do `/icon`; e a
      aba mostra o "M.".
    - O ensaio mede também se esse 404 é uma página estática ou se roda a função a cada pedido, porque o layout lê
      cookies (`app/layout.tsx:97-98`) e não há `app/not-found.tsx` (o achado 341). A escolha só muda se aparecer um
      custo.
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
  - na lista do calendário, deixar entrar um dia sem posts e inverter a ordem.
- **O verify** limpo e a integração igual à `main`.

## A prova na prévia

**A auditoria mede,** com o navegador em 390x844 e com a caixa do Victor, só lendo, pelas regras de tela acima:
- cada rota da onda 1;
- numa aba em segundo plano, um quadro forçado antes de medir, com a contagem das partes pendentes. Uma rota com
  parte pendente não vale (o achado 345);
- sem sessão: `/manifest.webmanifest` e os ícones dão 200, com o tipo certo; o `/favicon.ico` dá 404; e
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
```

```bash
S="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/e078f16e-47b2-4e08-86f3-8036d4155715/scratchpad"
C="$S/x"; N="$S/next"; K="$S/celular"; P="$K/plano.md"
cd "$C" || exit 1
test "$(git branch --show-current)" = celular-1 || { echo "não é o ramo da execução: pare"; exit 1; }
node "$N/extrair-bloco.mjs" "$P" docs/specs/2026-11-24-celular-onda-1.md docs/specs/2026-11-24-celular-onda-1.md || { echo "o extrair parou: pare"; exit 1; }
test "$(git hash-object docs/specs/2026-11-24-celular-onda-1.md)" = 34bc0d97d1f82b9a243fae93c625e5d74e5fad3e || { echo "a spec não é a do ensaio: pare"; exit 1; }
sha256sum docs/specs/2026-11-24-celular-onda-1.md
node "$N/varrer-texto.mjs" docs/specs/2026-11-24-celular-onda-1.md
node "$K/guarda-celular-1.mjs" "$C"; echo "guarda: $?"
```

Esperado: "GRAVADO: docs/specs/2026-11-24-celular-onda-1.md (346 linhas, …)"; o sha256 `6b270cdd…`, o da spec
aprovada; "limpo … (LF)"; a guarda com "dentro: docs/specs/2026-11-24-celular-onda-1.md" e 0. Depois, à parte:

```bash
cd "C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/e078f16e-47b2-4e08-86f3-8036d4155715/scratchpad/x" || exit 1
test "$(git branch --show-current)" = celular-1 && git add docs/specs/2026-11-24-celular-onda-1.md && git commit -m "A spec registra o painel no celular, onda 1: o ícone na tela inicial, o porteiro e as telas de acompanhar"
git show HEAD | git patch-id --stable
```

Esperado: o patch-id `f785965595e89c498dd2d3081159c9e45e411524`.

## Passo 3: este plano, num commit próprio

```bash
S="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/e078f16e-47b2-4e08-86f3-8036d4155715/scratchpad"
C="$S/x"; N="$S/next"; K="$S/celular"
cd "$C" || exit 1
test "$(git branch --show-current)" = celular-1 || { echo "não é o ramo da execução: pare"; exit 1; }
test ! -e docs/plans/2026-11-25-celular-onda-1-pr1.md || { echo "o plano já existe na cópia: pare"; exit 1; }
cp "$K/plano.md" docs/plans/2026-11-25-celular-onda-1-pr1.md
cmp "$K/plano.md" docs/plans/2026-11-25-celular-onda-1-pr1.md && sha256sum docs/plans/2026-11-25-celular-onda-1-pr1.md
node "$N/varrer-texto.mjs" docs/plans/2026-11-25-celular-onda-1-pr1.md
node "$K/guarda-celular-1.mjs" "$C"; echo "guarda: $?"
```

Esperado: o sha256 que a auditoria leu; "limpo … (LF)"; a guarda com os dois "dentro" e 0. Depois, à parte:

```bash
cd "C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/e078f16e-47b2-4e08-86f3-8036d4155715/scratchpad/x" || exit 1
test "$(git branch --show-current)" = celular-1 && git add docs/plans/2026-11-25-celular-onda-1-pr1.md && git commit -m "O plano do PR 1 do celular: o ensaio, as fases com o vermelho antes, as mutações e a prova no iPhone"
git show HEAD | git patch-id --stable
```

Esperado: um patch-id, comparado com o da aplicação do zero.

## F1: a marca e o manifesto (o commit que repete o `691e8ad`)

Os três arquivos novos, como no ensaio:

<!-- bloco: tests/manifesto.test.ts -->
```typescript
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import { DESCRICAO_DO_PAINEL } from "@/lib/marca";

// O MANIFESTO DO CELULAR (docs/specs/2026-11-24-celular-onda-1.md, "Os testes").
//
// O manifesto é o que deixa pôr o painel na tela inicial do celular. O primeiro caso confere o que a spec decidiu:
// o nome, o endereço de início, o abrir sem a barra do navegador e as duas cores do sistema.
//
// A DESCRIÇÃO TEM UMA FONTE SÓ (o achado 343): o layout e o manifesto usam a constante de lib/marca.ts. Comparar
// os valores não bastaria, porque um texto escrito à mão igual passaria hoje e divergiria na próxima mudança. Por
// isso o segundo caso lê o código dos dois arquivos, como tests/layout-contas.test.ts faz com o layout.

const RAIZ = fileURLToPath(new URL("..", import.meta.url));

/** O código de cada valor das propriedades `<nome>:` de um arquivo (o identificador ou o literal, como texto). */
function valoresDe(caminho: string, nome: string): string[] {
  const fonte = readFileSync(`${RAIZ}${caminho}`, "utf8");
  const sf = ts.createSourceFile(caminho, fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const achados: string[] = [];
  const visitar = (n: ts.Node) => {
    if (ts.isPropertyAssignment(n) && ts.isIdentifier(n.name) && n.name.text === nome) {
      achados.push(n.initializer.getText(sf));
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return achados;
}

describe("o manifesto do celular", () => {
  it("abre o painel sem a barra do navegador, no endereço de início, com o nome e as cores da marca", () => {
    const m = manifest();
    expect(m.name).toBe("MetodoChat");
    expect(m.short_name).toBe("MetodoChat");
    expect(m.lang).toBe("pt-BR");
    expect(m.start_url).toBe("/");
    expect(m.display).toBe("standalone");
    expect(m.background_color).toBe("#fbfaf8");
    expect(m.theme_color).toBe("#1a5a6c");
    expect(m.description).toBe(DESCRICAO_DO_PAINEL);
  });

  it("tira a descrição da mesma constante que o layout usa", () => {
    expect(valoresDe("app/manifest.ts", "description")).toEqual(["DESCRICAO_DO_PAINEL"]);
    expect(valoresDe("app/layout.tsx", "description")).toEqual(["DESCRICAO_DO_PAINEL"]);
  });
});
```

<!-- bloco: lib/marca.ts -->
```typescript
// A MARCA DO PAINEL NUM LUGAR SÓ (docs/specs/2026-11-24-celular-onda-1.md, o achado 343).
//
// O nome e a descrição saem daqui para o <head> de toda página (o `metadata` de app/layout.tsx) e para o
// manifesto do celular (app/manifest.ts). Com dois textos, um mudaria e o outro não, e o ícone da tela inicial e a
// aba do navegador passariam a dizer coisas diferentes. tests/manifesto.test.ts confere que os dois usam estas
// constantes.
//
// AS DUAS CORES SÃO AS DO SISTEMA (app/globals.css): o papel (`--color-papel`, :54) e a ação (`--color-acao`,
// :102). O manifesto e a barra do celular não leem o CSS, então os valores vão escritos aqui. Se o sistema mudar
// de cor, estas mudam junto.
export const NOME_DO_PAINEL = "MetodoChat";
export const TITULO_DO_PAINEL = "MetodoChat — comentário vira DM";
export const DESCRICAO_DO_PAINEL = "Automação do seu Instagram: palavra-chave no comentário vira DM com seu link.";
export const COR_DO_PAPEL = "#fbfaf8";
export const COR_DA_ACAO = "#1a5a6c";
```

<!-- bloco: app/manifest.ts -->
```typescript
import type { MetadataRoute } from "next";
import { COR_DA_ACAO, COR_DO_PAPEL, DESCRICAO_DO_PAINEL, NOME_DO_PAINEL } from "@/lib/marca";

// O MANIFESTO DO CELULAR (docs/specs/2026-11-24-celular-onda-1.md). É ele que deixa pôr o painel na tela inicial
// e abri-lo sem a barra do navegador (o `display: "standalone"`). O Next o serve em /manifest.webmanifest
// (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/manifest.md:20-47).
//
// ESTE ENDEREÇO TEM DE SER PÚBLICO NO PORTEIRO (proxy.ts): o navegador o busca sozinho, sem o cookie da sessão,
// e sem ele o celular não instala o ícone.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: NOME_DO_PAINEL,
    short_name: NOME_DO_PAINEL,
    description: DESCRICAO_DO_PAINEL,
    lang: "pt-BR",
    start_url: "/",
    display: "standalone",
    background_color: COR_DO_PAPEL,
    theme_color: COR_DA_ACAO,
  };
}
```

O diff do `app/layout.tsx`, tirado do ensaio (o `f1/aplicar-layout.mjs` faz as três trocas):

```diff
diff --git a/app/layout.tsx b/app/layout.tsx
index 3c8445c..6ae8cf9 100644
--- a/app/layout.tsx
+++ b/app/layout.tsx
@@ -1,4 +1,4 @@
-import type { Metadata } from "next";
+import type { Metadata, Viewport } from "next";
 import { Archivo, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
 import Script from "next/script";
 import { cookies } from "next/headers";
@@ -10,6 +10,7 @@ import { ACCOUNT_COOKIE } from "@/lib/account";
 import { contasDoLogin } from "@/lib/acesso";
 import { escolherConta } from "@/lib/acesso-escolha";
 import { sessaoAtual } from "@/lib/sessao";
+import { COR_DA_ACAO, DESCRICAO_DO_PAINEL, NOME_DO_PAINEL, TITULO_DO_PAINEL } from "@/lib/marca";
 
 // AS TRÊS FAMÍLIAS. A Sora saiu: não por ser ruim, mas por ser a fonte que
 // aparece em todo modelo de SaaS — ela era metade do "ar de modelo" que a
@@ -65,9 +66,23 @@ const plexMono = IBM_Plex_Mono({
 
 const fontes = `${archivo.variable} ${plexSans.variable} ${plexMono.variable}`;
 
+// O TÍTULO E A DESCRIÇÃO vêm de lib/marca.ts, a mesma fonte do manifesto do celular (o achado 343).
+//
+// O `appleWebApp.title` é o nome que o iPhone dá ao ícone na tela de início. O `capable` fica de fora: no
+// 16.4.6 ele escreve `mobile-web-app-capable` (node_modules/next/dist/lib/metadata/metadata-elements.js:446-452),
+// e quem abre o app sem a barra do navegador é o `display: "standalone"` do manifesto
+// (docs/specs/2026-11-24-celular-onda-1.md, o achado 339).
 export const metadata: Metadata = {
-  title: "MetodoChat — comentário vira DM",
-  description: "Automação do seu Instagram: palavra-chave no comentário vira DM com seu link.",
+  title: TITULO_DO_PAINEL,
+  description: DESCRICAO_DO_PAINEL,
+  appleWebApp: { title: NOME_DO_PAINEL },
+};
+
+// A COR DA BARRA DO CELULAR é a cor de ação do sistema (lib/marca.ts). O guia do Next a põe no `viewport`, e
+// não no `metadata` (node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-viewport.md:21-33
+// e :71-93).
+export const viewport: Viewport = {
+  themeColor: COR_DA_ACAO,
 };
 
 // Aplica o tema salvo antes da primeira pintura (evita flash de cor errada)
```

**O vermelho:** o teste, sem o código.

```bash
S="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/e078f16e-47b2-4e08-86f3-8036d4155715/scratchpad"
C="$S/x"; N="$S/next"; K="$S/celular"; P="$K/plano.md"
cd "$C" || exit 1
test "$(git branch --show-current)" = celular-1 || { echo "não é o ramo da execução: pare"; exit 1; }
test -z "$(git status --porcelain)" || { echo "a árvore não está limpa: pare"; exit 1; }
node "$N/extrair-bloco.mjs" "$P" tests/manifesto.test.ts tests/manifesto.test.ts || { echo "o extrair parou: pare"; exit 1; }
npx --no-install vitest run tests/manifesto.test.ts > "$K/exec-f1-vermelho.log" 2>&1; echo "vitest: $?"
sed 's/\x1b\[[0-9;]*m//g' "$K/exec-f1-vermelho.log" | grep -n -E "^\s*(Test Files|Tests)\s|Cannot find"
node "$K/guarda-celular-1.mjs" "$C"; echo "guarda: $?"
```

Esperado: "vitest: 1", com "Test Files 1 failed (1)", "Tests no tests" e "Cannot find package '@/app/manifest'"; a
guarda com "dentro: tests/manifesto.test.ts", além da spec, e 0. O vermelho do ensaio, sem os códigos de cor:

```text
(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.

 RUN  v4.1.12 C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/e078f16e-47b2-4e08-86f3-8036d4155715/scratchpad/m

 ❯ tests/manifesto.test.ts (0 test)

⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  tests/manifesto.test.ts [ tests/manifesto.test.ts ]
Error: Cannot find package '@/app/manifest' imported from C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/e078f16e-47b2-4e08-86f3-8036d4155715/scratchpad/m/tests/manifesto.test.ts
 ❯ tests/manifesto.test.ts:5:1
      3| import ts from "typescript";
      4| import { describe, expect, it } from "vitest";
      5| import manifest from "@/app/manifest";
       | ^
      6| import { DESCRICAO_DO_PAINEL } from "@/lib/marca";
      7|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯


 Test Files  1 failed (1)
      Tests  no tests
   Start at  10:46:52
   Duration  1.17s (transform 189ms, setup 0ms, import 0ms, tests 0ms, environment 0ms)

```

**O verde:**

```bash
S="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/e078f16e-47b2-4e08-86f3-8036d4155715/scratchpad"
C="$S/x"; N="$S/next"; K="$S/celular"; P="$K/plano.md"
cd "$C" || exit 1
test "$(git branch --show-current)" = celular-1 || { echo "não é o ramo da execução: pare"; exit 1; }
node "$N/extrair-bloco.mjs" "$P" lib/marca.ts lib/marca.ts || { echo "o extrair parou: pare"; exit 1; }
node "$N/extrair-bloco.mjs" "$P" app/manifest.ts app/manifest.ts || { echo "o extrair parou: pare"; exit 1; }
node "$K/f1/aplicar-layout.mjs" "$C" || { echo "o aplicar parou: pare"; exit 1; }
test "$(git hash-object tests/manifesto.test.ts)" = 3db6dc22519b36621d58795ad3e455afe22117b5 || { echo "o teste não é o do ensaio: pare"; exit 1; }
test "$(git hash-object lib/marca.ts)" = 281500371795273bd36d146febcb5dafa52441d5 || { echo "a marca não é a do ensaio: pare"; exit 1; }
test "$(git hash-object app/manifest.ts)" = 639272928be8a054ba9fe8bc54554494115e2ceb || { echo "o manifesto não é o do ensaio: pare"; exit 1; }
test "$(git hash-object app/layout.tsx)" = 6ae8cf9f0f22e8f0da57fb80289cc288bb97e33f || { echo "o layout não é o do ensaio: pare"; exit 1; }
echo "os quatro blobs: iguais aos do ensaio"
node "$N/varrer-texto.mjs" lib/marca.ts app/manifest.ts app/layout.tsx tests/manifesto.test.ts
npx --no-install vitest run tests/manifesto.test.ts > "$K/exec-f1-verde.log" 2>&1; echo "vitest do manifesto: $?"
npm run typecheck > "$K/exec-f1-tsc.log" 2>&1; echo "typecheck: $?"
npm run lint > "$K/exec-f1-lint.log" 2>&1; echo "lint: $?"
npm test > "$K/exec-f1-puros.log" 2>&1; echo "puros: $?"; sed 's/\x1b\[[0-9;]*m//g' "$K/exec-f1-puros.log" | grep -n -E "^\s*(Test Files|Tests)\s"
npm run test:dom > "$K/exec-f1-tela.log" 2>&1; echo "tela: $?"; sed 's/\x1b\[[0-9;]*m//g' "$K/exec-f1-tela.log" | grep -n -E "^\s*(Test Files|Tests)\s"
node "$K/guarda-celular-1.mjs" "$C"; echo "guarda: $?"
```

Esperado: os três "GRAVADO" do extrair e do aplicar, este com "GRAVADO: 3 trocas no app/layout.tsx, que passa de 139
para 154 linhas (CRLF)."; os quatro blobs iguais; os quatro "limpo" (os três novos em LF e o layout em CRLF); o
manifesto (2 casos), o typecheck e o lint com 0; os puros com 164 e 3 886; os de tela com 36 e 350; a guarda com 0.
Depois, à parte:

```bash
cd "C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/e078f16e-47b2-4e08-86f3-8036d4155715/scratchpad/x" || exit 1
test "$(git branch --show-current)" = celular-1 && git add lib/marca.ts app/manifest.ts app/layout.tsx tests/manifesto.test.ts && git commit -m "O painel ganha o manifesto do celular, com o nome, a descrição e as cores tirados de um lugar só"
git show HEAD | git patch-id --stable
```

Esperado: o patch-id `eb446b60b1ba8ae7a02ab62a63c9737339ff78f0`.

## F2: o ícone (o commit que repete o `ce55384`)

A F2 não tem teste novo: o ícone é um desenho, e a imagem é conferida na prova. O build confere que ele é gerado, nos
três tamanhos e no de 180.

<!-- bloco: lib/desenho-do-icone.tsx -->
```tsx
import { COR_DA_ACAO, COR_DO_PAPEL } from "@/lib/marca";

// O DESENHO DO ÍCONE, num lugar só (docs/specs/2026-11-24-celular-onda-1.md, "O ícone e o manifesto"). O
// app/icon.tsx (a aba e a tela inicial do Android) e o app/apple-icon.tsx (a tela de início do iPhone) desenham
// isto, cada um no seu tamanho. Quando vier um logo de verdade, troca-se só este arquivo: os endereços liberados
// no porteiro (proxy.ts) continuam os mesmos.
//
// O "M." É UM DESENHO, E NÃO UMA LETRA, pela decisão do Victor de 25/11 ("Desenhar o M."): o ImageResponse só traz
// a fonte Geist, e a da marca (a IBM Plex Sans 600) pediria um arquivo de fonte no repositório (o achado 336). Ele
// fica parecido com a marca "MetodoChat." da tela (app/app-shell.tsx:183), mas não idêntico.
//
// AS MEDIDAS ESTÃO NUM QUADRADO DE 100. O "M." ocupa de 18 a 80 na largura e de 30 a 70 na altura: fica dentro dos
// 80% do meio (de 10 a 90), que é o que o Android não corta quando recorta o ícone em círculo (o `maskable` do
// manifesto). O fundo é cheio, sem borda nem canto arredondado: quem arredonda é o sistema do celular.
export const DESENHO_DO_M =
  "M18 70 V30 H28 L42 52 L56 30 H66 V70 H56 V46 L45 63 H39 L28 46 V70 Z";
export const PONTO = { cx: 75, cy: 65, r: 5 };

/** O ícone inteiro, no lado pedido (em px), para o `ImageResponse`. */
export function desenhoDoIcone(lado: number) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: COR_DA_ACAO,
      }}
    >
      <svg width={lado} height={lado} viewBox="0 0 100 100">
        <path d={DESENHO_DO_M} fill={COR_DO_PAPEL} />
        <circle cx={PONTO.cx} cy={PONTO.cy} r={PONTO.r} fill={COR_DO_PAPEL} />
      </svg>
    </div>
  );
}
```

<!-- bloco: app/icon.tsx -->
```tsx
import { ImageResponse } from "next/og";
import { desenhoDoIcone } from "@/lib/desenho-do-icone";

// O ÍCONE DA ABA E DA TELA INICIAL (docs/specs/2026-11-24-celular-onda-1.md, "O ícone e o manifesto"). Ele toma o
// lugar do app/favicon.ico, que era o logotipo da Vercel, vindo com o create-next-app.
//
// TRÊS TAMANHOS NUM ARQUIVO SÓ, pelo `generateImageMetadata`
// (node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-image-metadata.md): 32 para a aba do
// navegador, e 192 e 512 para a tela inicial do Android, que o manifesto (app/manifest.ts) aponta. Desde o Next
// 16, o `id` chega como uma promessa (o mesmo guia, "Version History").
//
// ESTES ENDEREÇOS TÊM DE SER PÚBLICOS NO PORTEIRO (proxy.ts): o navegador busca o ícone sozinho, sem o cookie da
// sessão.
const LADOS = [32, 192, 512] as const;

export function generateImageMetadata() {
  return LADOS.map((lado) => ({
    id: String(lado),
    size: { width: lado, height: lado },
    contentType: "image/png",
  }));
}

export default async function Icon({ id }: { id: Promise<string | number> }) {
  const lado = Number(await id);
  return new ImageResponse(desenhoDoIcone(lado), { width: lado, height: lado });
}
```

<!-- bloco: app/apple-icon.tsx -->
```tsx
import { ImageResponse } from "next/og";
import { desenhoDoIcone } from "@/lib/desenho-do-icone";

// O ÍCONE DA TELA DE INÍCIO DO IPHONE (docs/specs/2026-11-24-celular-onda-1.md): o mesmo desenho do app/icon.tsx,
// em 180x180, que é o tamanho que o iPhone usa. O Next põe o <link rel="apple-touch-icon"> no <head> sozinho
// (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/app-icons.md:49-59).
//
// ESTE ENDEREÇO TEM DE SER PÚBLICO NO PORTEIRO (proxy.ts): o iPhone busca o ícone sem o cookie da sessão.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(desenhoDoIcone(size.width), size);
}
```

```bash
S="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/e078f16e-47b2-4e08-86f3-8036d4155715/scratchpad"
C="$S/x"; N="$S/next"; K="$S/celular"; P="$K/plano.md"
cd "$C" || exit 1
test "$(git branch --show-current)" = celular-1 || { echo "não é o ramo da execução: pare"; exit 1; }
test -z "$(git status --porcelain)" || { echo "a árvore não está limpa: pare"; exit 1; }
node -e 'const a=Object.entries(process.env).filter(([k,v])=>/^postgres(ql)?:\/\//i.test(v||"")).map(([k])=>k); if(a.length){console.log("variável com URL de banco:",a.join(", "),": pare");process.exit(1)} console.log("nenhuma variável com URL de banco")' || exit 1
for p in lib/desenho-do-icone.tsx app/icon.tsx app/apple-icon.tsx; do node "$N/extrair-bloco.mjs" "$P" "$p" "$p" || { echo "o extrair de $p parou: pare"; exit 1; }; done
rm app/favicon.ico
test "$(git hash-object lib/desenho-do-icone.tsx)" = 90549d8e35fc394a7152c3c407515b5e30f236c4 || { echo "o desenho não é o do ensaio: pare"; exit 1; }
test "$(git hash-object app/icon.tsx)" = 6b22856d6bf7da38f4439d12aadebc5609284e1f || { echo "o icon não é o do ensaio: pare"; exit 1; }
test "$(git hash-object app/apple-icon.tsx)" = 712f2529aaf5d14a91a354cdf9a0b1d6dd07724b || { echo "o apple-icon não é o do ensaio: pare"; exit 1; }
echo "os três blobs: iguais aos do ensaio"
node "$N/varrer-texto.mjs" lib/desenho-do-icone.tsx app/icon.tsx app/apple-icon.tsx
npm run typecheck > "$K/exec-f2-tsc.log" 2>&1; echo "typecheck: $?"
npm run lint > "$K/exec-f2-lint.log" 2>&1; echo "lint: $?"
env -u CLAUDECODE -u AI_AGENT npm run build > "$K/exec-f2-build.log" 2>&1; echo "build: $?"
sed 's/\x1b\[[0-9;]*m//g' "$K/exec-f2-build.log" | grep -n -E "MIGRAÇÃO PULADA|Next\.js 16|apple-icon|/icon/|manifest|_not-found"
npm test > "$K/exec-f2-puros.log" 2>&1; echo "puros: $?"; sed 's/\x1b\[[0-9;]*m//g' "$K/exec-f2-puros.log" | grep -n -E "^\s*(Test Files|Tests)\s"
npm run test:dom > "$K/exec-f2-tela.log" 2>&1; echo "tela: $?"; sed 's/\x1b\[[0-9;]*m//g' "$K/exec-f2-tela.log" | grep -n -E "^\s*(Test Files|Tests)\s"
git diff --stat -- AGENTS.md tsconfig.json; echo "(diff do AGENTS.md e do tsconfig.json acima; vazio = intocados)"
node "$K/guarda-celular-1.mjs" "$C"; echo "guarda: $?"
```

Esperado: "nenhuma variável com URL de banco"; os três blobs iguais; os três "limpo … (LF)"; o typecheck, o lint e o
build com 0, com "MIGRAÇÃO PULADA", "Next.js 16.4.6", o `○ /apple-icon`, os três `● /icon/…`, o `○
/manifest.webmanifest` e o `ƒ /_not-found`; os puros com 164 e 3 886 e os de tela com 36 e 350, iguais aos da F1
(nenhum teste novo); o diff do `AGENTS.md` e do `tsconfig.json` vazio; a guarda com "app/favicon.ico: apagado" e 0.
Depois, à parte:

```bash
cd "C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/e078f16e-47b2-4e08-86f3-8036d4155715/scratchpad/x" || exit 1
test "$(git branch --show-current)" = celular-1 && git add lib/desenho-do-icone.tsx app/icon.tsx app/apple-icon.tsx app/favicon.ico && git commit -m "O ícone da aba e da tela inicial passa a ser o \"M.\" no azul do painel, no lugar do logotipo da Vercel"
git show HEAD | git patch-id --stable
```

Esperado: o patch-id `eac7aab54687cadc432ac87442a24b304f1302a8`. A mensagem é a do ensaio: o azul vira preto no commit C.

## E: a emenda da spec (o commit que repete o `18063bb`)

A E é só texto: nenhum teste lê a spec, e as suítes não rodam aqui.

```diff
diff --git a/docs/specs/2026-11-24-celular-onda-1.md b/docs/specs/2026-11-24-celular-onda-1.md
index 34bc0d9..e9d5886 100644
--- a/docs/specs/2026-11-24-celular-onda-1.md
+++ b/docs/specs/2026-11-24-celular-onda-1.md
@@ -2,7 +2,8 @@
 
 **Nascido em:** 24/11/2026, sobre a `main` em `aadf566`. **A v2 é de 25/11/2026**, com a medição de base (a Fase 0)
 e as decisões que dependiam dela. **A v3, do mesmo dia,** traz a medição da tabela da Atividade antes do plano (o
-achado 349).
+achado 349). **A emenda do ensaio, também de 25/11,** troca o 404 do `/favicon.ico` por um redirect (o achado 352) e
+traz as cores do ícone que o Victor escolheu depois de vê-lo.
 
 **As decisões do Victor, em 24/11/2026 (à tarde, pela caixa):**
 - **O uso é "acompanhar".** As alternativas eram "acompanhar e criar posts" e "tudo igual ao computador".
@@ -25,6 +26,14 @@ achado 349).
 - **A letra do ícone:** "Desenhar o M. (Recomendado)". A alternativa era usar a fonte do painel, com um arquivo de
   fonte no repositório.
 - **O celular da prova:** "iPhone".
+- **As cores do ícone (mudança de decisão, depois de ver o ícone no azul):** "Não gostei da forma que ficou, pode
+  deixar o fundo mais escuro, quase um preto", "ou da cor do background do método chat". Pela caixa:
+  - o fundo: "Fundo do painel, tema escuro (Recomendado)", o `#0b0a0e` (`--color-papel-escuro`,
+    `app/globals.css:58`). A alternativa era o `#17161a` (`--color-tinta`, `:65`);
+  - a barra do celular: "Acompanha o preto (Recomendado)". A alternativa era continuar no azul;
+  - o ponto do "M.": "Ponto azul claro (Recomendado)", o `#78bacd` (`--color-acao-escuro`, `:104`). A alternativa
+    era o ponto claro, igual ao "M".
+  - O "M" continua em papel `#fbfaf8`.
 
 ---
 
@@ -178,8 +187,8 @@ Em 390 px de largura, em cada rota da onda 1:
 ### O ícone e o manifesto
 
 - **O desenho do "M." mora num módulo só,** usado pelo `icon.tsx` e pelo `apple-icon.tsx`. Ele é desenhado como
-  caminho SVG, sem fonte e sem arquivo binário, pela decisão do Victor. O fundo é quadrado e cheio em `#1a5a6c`, e o
-  "M." com o ponto vai em `#fbfaf8`, centralizado e dentro dos 80% do meio, para o Android poder recortar o ícone em
+  caminho SVG, sem fonte e sem arquivo binário, pela decisão do Victor. O fundo é quadrado e cheio em `#0b0a0e`, o
+  "M" vai em `#fbfaf8` e o ponto em `#78bacd`, centralizados e dentro dos 80% do meio, para o Android poder recortar o ícone em
   círculo sem cortar a letra. Ele fica parecido com a letra do painel, mas não idêntico.
 - **`app/icon.tsx` (novo):** o `generateImageMetadata` dá três tamanhos: 32 (a aba), 192 e 512 (a tela inicial).
 - **`app/apple-icon.tsx` (novo):** o mesmo desenho, em 180x180, para o iPhone.
@@ -192,11 +201,11 @@ Em 390 px de largura, em cada rota da onda 1:
   - `start_url`: `/`;
   - `display`: `standalone`;
   - `background_color`: `#fbfaf8`;
-  - `theme_color`: `#1a5a6c`;
+  - `theme_color`: `#0b0a0e`;
   - `icons`: o de 192 e o de 512, com os endereços medidos no build. O de 512 entra também com o
     `purpose: "maskable"`.
 - **`app/layout.tsx`:**
-  - ganha `export const viewport = { themeColor: "#1a5a6c" }`;
+  - ganha `export const viewport = { themeColor: "#0b0a0e" }`;
   - ganha, no `metadata`, o `appleWebApp` com `title: "MetodoChat"`, que dá o nome do ícone na tela de início do
     iPhone;
   - **o `capable: true` fica fora.** No 16.4.6, ele escreve `<meta name="mobile-web-app-capable">`
@@ -208,11 +217,16 @@ Em 390 px de largura, em cada rota da onda 1:
     - É uma fonte só para o desenho, sem binário versionado e sem roteiro de uso único. Quando vier um logo, troca-se
       um arquivo.
     - O navegador usa o `<link rel="icon">` do `<head>`, e só pede o `/favicon.ico` quando não há link.
-    - O ensaio mede: o `/favicon.ico` passa a dar 404 sem ir para `/entrar`; o `<head>` traz o link do `/icon`; e a
-      aba mostra o "M.".
-    - O ensaio mede também se esse 404 é uma página estática ou se roda a função a cada pedido, porque o layout lê
-      cookies (`app/layout.tsx:97-98`) e não há `app/not-found.tsx` (o achado 341). A escolha só muda se aparecer um
-      custo.
+    - O ensaio mediu o custo (os achados 341 e 352): no build, o `/_not-found` é dinâmico (ƒ), como já era antes
+      desta entrega, porque o layout lê cookies (`app/layout.tsx:97-98`). Sem o arquivo, cada pedido ao
+      `/favicon.ico` viraria uma chamada de função e, com o cookie da sessão, duas consultas ao banco (o
+      `sessaoAtual()` e o `contasDoLogin()`).
+    - **Por isso, o `/favicon.ico` leva ao ícone novo por um redirect no `next.config.ts`**, para o `/icon/32`, com
+      `permanent: false` (um 307, que não fica em cache: `redirects.md:30`). O redirect do `next.config` roda antes
+      do porteiro e antes dos arquivos (`proxy.md:242-245` e `redirects.md:39`, no guia da 16.4.6). O
+      `next.config.ts` já tem um redirect, o do `/loja` (`:24`).
+    - O servidor local não sobe sem um banco com o esquema (o `instrumentation.ts`, o achado 353). Por isso, o
+      `<head>`, os códigos sem sessão e o 307 do favicon se medem na prova na prévia.
     - O `/favicon.ico` continua em `PUBLIC_PREFIXES` e no matcher, como está.
   - **(2) Um roteiro que gera o `.ico` novo** a partir do mesmo desenho, rodado uma vez, com o sha registrado.
     - Cria duas cópias do mesmo desenho.
@@ -305,6 +319,8 @@ O layout não se mede no jsdom. Por isso, os testes cobrem o que é lógica, e a
   - os vizinhos parecidos continuam pedindo sessão: o endereço exato com `/x` no fim, `/icon-qualquer-coisa`,
     `/manifest.json` (enquanto não existir um `app/manifest.json`, o achado 342), `/apple-icon.png.x` e
     `/conversas/x.png`. A lista final sai da forma medida no build.
+- **O favicon antigo (puro, novo):** o `redirects()` do `next.config.ts` leva o `/favicon.ico` ao `/icon/32`, com
+  `permanent: false`.
 - **A lista do calendário (puro, novo):** a função monta, a partir da grade, só os dias com posts, em ordem de data,
   com os posts de cada dia em ordem de hora. Uma grade sem posts dá uma lista vazia.
 - **O aviso do editor (tela, novo):** o aviso "A edição das automações é pelo computador" aparece no quadro, com a
@@ -315,6 +331,8 @@ O layout não se mede no jsdom. Por isso, os testes cobrem o que é lógica, e a
   - pôr os exatos depois da sessão;
   - tirar o aviso;
   - trocar o `display` do manifesto;
+  - escrever a descrição à mão no manifesto, sem a constante (o achado 343);
+  - tirar o redirect do favicon;
   - na lista do calendário, deixar entrar um dia sem posts e inverter a ordem.
 - **O verify** limpo e a integração igual à `main`.
 
@@ -324,7 +342,8 @@ O layout não se mede no jsdom. Por isso, os testes cobrem o que é lógica, e a
 - cada rota da onda 1;
 - numa aba em segundo plano, um quadro forçado antes de medir, com a contagem das partes pendentes. Uma rota com
   parte pendente não vale (o achado 345);
-- sem sessão: `/manifest.webmanifest` e os ícones dão 200, com o tipo certo; o `/favicon.ico` dá 404; e
+- sem sessão: `/manifest.webmanifest` e os ícones dão 200, com o tipo certo; o `/favicon.ico` dá 307 para o
+  `/icon/32`; e
   `/icon-qualquer-coisa` vai para `/entrar`;
 - o `<head>` com o `link rel="manifest"`, os ícones e o `theme-color`;
 - o Remarcar e o "Cancelar este post" num post pendente da conta de provas, se houver um. Se não houver, eles ficam
```

```bash
S="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/e078f16e-47b2-4e08-86f3-8036d4155715/scratchpad"
C="$S/x"; N="$S/next"; K="$S/celular"
cd "$C" || exit 1
test "$(git branch --show-current)" = celular-1 || { echo "não é o ramo da execução: pare"; exit 1; }
test -z "$(git status --porcelain)" || { echo "a árvore não está limpa: pare"; exit 1; }
node "$K/f2c/aplicar-emenda.mjs" "$C" || { echo "a emenda parou: pare"; exit 1; }
test "$(git hash-object docs/specs/2026-11-24-celular-onda-1.md)" = e9d5886fa07a369b83f71019fa6a537e04ccf0db || { echo "a spec emendada não é a do ensaio: pare"; exit 1; }
echo "o blob: igual ao do ensaio"
node "$N/varrer-texto.mjs" docs/specs/2026-11-24-celular-onda-1.md
node "$K/guarda-celular-1.mjs" "$C"; echo "guarda: $?"
```

Esperado: as 9 linhas "a spec: … trocado" e "GRAVADO: 9 trocas na spec, que passa de 346 para 365 linhas (LF)."; o
blob igual; "limpo … (LF)"; a guarda com "app/favicon.ico: apagado" e 0. Depois, à parte:

```bash
cd "C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/e078f16e-47b2-4e08-86f3-8036d4155715/scratchpad/x" || exit 1
test "$(git branch --show-current)" = celular-1 && git add docs/specs/2026-11-24-celular-onda-1.md && git commit -m "A spec registra a emenda do ensaio: o favicon antigo leva ao ícone novo, e o ícone passa ao preto do painel"
git show HEAD | git patch-id --stable
```

Esperado: o patch-id `7ce3be5b926da2c662449d92efd943fb897fce4f`.

## C: as cores do ícone e da barra (o commit que repete o `628f244`)

```diff
diff --git a/app/layout.tsx b/app/layout.tsx
index 6ae8cf9..a010932 100644
--- a/app/layout.tsx
+++ b/app/layout.tsx
@@ -10,7 +10,7 @@ import { ACCOUNT_COOKIE } from "@/lib/account";
 import { contasDoLogin } from "@/lib/acesso";
 import { escolherConta } from "@/lib/acesso-escolha";
 import { sessaoAtual } from "@/lib/sessao";
-import { COR_DA_ACAO, DESCRICAO_DO_PAINEL, NOME_DO_PAINEL, TITULO_DO_PAINEL } from "@/lib/marca";
+import { COR_DO_PAPEL_ESCURO, DESCRICAO_DO_PAINEL, NOME_DO_PAINEL, TITULO_DO_PAINEL } from "@/lib/marca";
 
 // AS TRÊS FAMÍLIAS. A Sora saiu: não por ser ruim, mas por ser a fonte que
 // aparece em todo modelo de SaaS — ela era metade do "ar de modelo" que a
@@ -78,11 +78,11 @@ export const metadata: Metadata = {
   appleWebApp: { title: NOME_DO_PAINEL },
 };
 
-// A COR DA BARRA DO CELULAR é a cor de ação do sistema (lib/marca.ts). O guia do Next a põe no `viewport`, e
-// não no `metadata` (node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-viewport.md:21-33
-// e :71-93).
+// A COR DA BARRA DO CELULAR é o preto do fundo do tema escuro (lib/marca.ts), o mesmo do ícone. O guia do Next a
+// põe no `viewport`, e não no `metadata`
+// (node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-viewport.md:21-33 e :71-93).
 export const viewport: Viewport = {
-  themeColor: COR_DA_ACAO,
+  themeColor: COR_DO_PAPEL_ESCURO,
 };
 
 // Aplica o tema salvo antes da primeira pintura (evita flash de cor errada)
diff --git a/app/manifest.ts b/app/manifest.ts
index 6392729..bb7737c 100644
--- a/app/manifest.ts
+++ b/app/manifest.ts
@@ -1,5 +1,5 @@
 import type { MetadataRoute } from "next";
-import { COR_DA_ACAO, COR_DO_PAPEL, DESCRICAO_DO_PAINEL, NOME_DO_PAINEL } from "@/lib/marca";
+import { COR_DO_PAPEL, COR_DO_PAPEL_ESCURO, DESCRICAO_DO_PAINEL, NOME_DO_PAINEL } from "@/lib/marca";
 
 // O MANIFESTO DO CELULAR (docs/specs/2026-11-24-celular-onda-1.md). É ele que deixa pôr o painel na tela inicial
 // e abri-lo sem a barra do navegador (o `display: "standalone"`). O Next o serve em /manifest.webmanifest
@@ -16,6 +16,6 @@ export default function manifest(): MetadataRoute.Manifest {
     start_url: "/",
     display: "standalone",
     background_color: COR_DO_PAPEL,
-    theme_color: COR_DA_ACAO,
+    theme_color: COR_DO_PAPEL_ESCURO,
   };
 }
diff --git a/lib/desenho-do-icone.tsx b/lib/desenho-do-icone.tsx
index 90549d8..e9ba22c 100644
--- a/lib/desenho-do-icone.tsx
+++ b/lib/desenho-do-icone.tsx
@@ -1,4 +1,4 @@
-import { COR_DA_ACAO, COR_DO_PAPEL } from "@/lib/marca";
+import { COR_DA_ACAO_ESCURA, COR_DO_PAPEL, COR_DO_PAPEL_ESCURO } from "@/lib/marca";
 
 // O DESENHO DO ÍCONE, num lugar só (docs/specs/2026-11-24-celular-onda-1.md, "O ícone e o manifesto"). O
 // app/icon.tsx (a aba e a tela inicial do Android) e o app/apple-icon.tsx (a tela de início do iPhone) desenham
@@ -26,12 +26,12 @@ export function desenhoDoIcone(lado: number) {
         display: "flex",
         alignItems: "center",
         justifyContent: "center",
-        background: COR_DA_ACAO,
+        background: COR_DO_PAPEL_ESCURO,
       }}
     >
       <svg width={lado} height={lado} viewBox="0 0 100 100">
         <path d={DESENHO_DO_M} fill={COR_DO_PAPEL} />
-        <circle cx={PONTO.cx} cy={PONTO.cy} r={PONTO.r} fill={COR_DO_PAPEL} />
+        <circle cx={PONTO.cx} cy={PONTO.cy} r={PONTO.r} fill={COR_DA_ACAO_ESCURA} />
       </svg>
     </div>
   );
diff --git a/lib/marca.ts b/lib/marca.ts
index 2815003..cc279bd 100644
--- a/lib/marca.ts
+++ b/lib/marca.ts
@@ -5,11 +5,14 @@
 // aba do navegador passariam a dizer coisas diferentes. tests/manifesto.test.ts confere que os dois usam estas
 // constantes.
 //
-// AS DUAS CORES SÃO AS DO SISTEMA (app/globals.css): o papel (`--color-papel`, :54) e a ação (`--color-acao`,
-// :102). O manifesto e a barra do celular não leem o CSS, então os valores vão escritos aqui. Se o sistema mudar
-// de cor, estas mudam junto.
+// AS TRÊS CORES SÃO AS DO SISTEMA (app/globals.css): o papel (`--color-papel`, :54), o fundo do tema escuro
+// (`--color-papel-escuro`, :58) e a ação no tema escuro (`--color-acao-escuro`, :104). O manifesto, a barra do
+// celular e o ícone não leem o CSS, então os valores vão escritos aqui. Se o sistema mudar de cor, estas mudam
+// junto. O ícone e a barra ficaram no preto do painel, com o ponto no azul claro, pela decisão do Victor de
+// 25/11, depois de ver o ícone no azul (docs/specs/2026-11-24-celular-onda-1.md).
 export const NOME_DO_PAINEL = "MetodoChat";
 export const TITULO_DO_PAINEL = "MetodoChat — comentário vira DM";
 export const DESCRICAO_DO_PAINEL = "Automação do seu Instagram: palavra-chave no comentário vira DM com seu link.";
 export const COR_DO_PAPEL = "#fbfaf8";
-export const COR_DA_ACAO = "#1a5a6c";
+export const COR_DO_PAPEL_ESCURO = "#0b0a0e";
+export const COR_DA_ACAO_ESCURA = "#78bacd";
diff --git a/tests/manifesto.test.ts b/tests/manifesto.test.ts
index 3db6dc2..9d9fa91 100644
--- a/tests/manifesto.test.ts
+++ b/tests/manifesto.test.ts
@@ -40,7 +40,7 @@ describe("o manifesto do celular", () => {
     expect(m.start_url).toBe("/");
     expect(m.display).toBe("standalone");
     expect(m.background_color).toBe("#fbfaf8");
-    expect(m.theme_color).toBe("#1a5a6c");
+    expect(m.theme_color).toBe("#0b0a0e");
     expect(m.description).toBe(DESCRICAO_DO_PAINEL);
   });
 
```

**O vermelho:** o teste do manifesto passa a esperar a barra preta.

```bash
S="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/e078f16e-47b2-4e08-86f3-8036d4155715/scratchpad"
C="$S/x"; K="$S/celular"
cd "$C" || exit 1
test "$(git branch --show-current)" = celular-1 || { echo "não é o ramo da execução: pare"; exit 1; }
test -z "$(git status --porcelain)" || { echo "a árvore não está limpa: pare"; exit 1; }
node "$K/f2c/aplicar-cores.mjs" "$C" teste || { echo "o aplicar parou: pare"; exit 1; }
npx --no-install vitest run tests/manifesto.test.ts > "$K/exec-c-vermelho.log" 2>&1; echo "vitest: $?"
sed 's/\x1b\[[0-9;]*m//g' "$K/exec-c-vermelho.log" | grep -n -E "^\s*(Test Files|Tests)\s|AssertionError"
node "$K/guarda-celular-1.mjs" "$C"; echo "guarda: $?"
```

Esperado: "tests/manifesto.test.ts: 1 troca(s), de 51 para 51 linhas (LF)" e "GRAVADO: as cores, no modo teste.";
"vitest: 1", com "expected '#1a5a6c' to be '#0b0a0e'" e "1 failed | 1 passed (2)"; a guarda com 0. O vermelho do
ensaio, sem os códigos de cor:

```text
(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.

 RUN  v4.1.12 C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/e078f16e-47b2-4e08-86f3-8036d4155715/scratchpad/m

 ❯ tests/manifesto.test.ts (2 tests | 1 failed) 34ms
     × abre o painel sem a barra do navegador, no endereço de início, com o nome e as cores da marca 9ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  tests/manifesto.test.ts > o manifesto do celular > abre o painel sem a barra do navegador, no endereço de início, com o nome e as cores da marca
AssertionError: expected '#1a5a6c' to be '#0b0a0e' // Object.is equality

Expected: "#0b0a0e"
Received: "#1a5a6c"

 ❯ tests/manifesto.test.ts:43:27
     41|     expect(m.display).toBe("standalone");
     42|     expect(m.background_color).toBe("#fbfaf8");
     43|     expect(m.theme_color).toBe("#0b0a0e");
       |                           ^
     44|     expect(m.description).toBe(DESCRICAO_DO_PAINEL);
     45|   });

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯


 Test Files  1 failed (1)
      Tests  1 failed | 1 passed (2)
   Start at  11:12:10
   Duration  1.18s (transform 166ms, setup 0ms, import 530ms, tests 34ms, environment 0ms)

```

**O verde:** as cores na marca, no manifesto, no layout e no desenho.

```bash
S="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/e078f16e-47b2-4e08-86f3-8036d4155715/scratchpad"
C="$S/x"; N="$S/next"; K="$S/celular"
cd "$C" || exit 1
test "$(git branch --show-current)" = celular-1 || { echo "não é o ramo da execução: pare"; exit 1; }
node -e 'const a=Object.entries(process.env).filter(([k,v])=>/^postgres(ql)?:\/\//i.test(v||"")).map(([k])=>k); if(a.length){console.log("variável com URL de banco:",a.join(", "),": pare");process.exit(1)} console.log("nenhuma variável com URL de banco")' || exit 1
node "$K/f2c/aplicar-cores.mjs" "$C" codigo || { echo "o aplicar parou: pare"; exit 1; }
test "$(git hash-object lib/marca.ts)" = cc279bd4101cd38f2026756c51035bb927b123c1 || { echo "a marca não é a do ensaio: pare"; exit 1; }
test "$(git hash-object app/manifest.ts)" = bb7737cfe6d023853696338b1cc5dd544c9363fc || { echo "o manifesto não é o do ensaio: pare"; exit 1; }
test "$(git hash-object app/layout.tsx)" = a010932c95bdec78f926ca1c66e6e5614999ba29 || { echo "o layout não é o do ensaio: pare"; exit 1; }
test "$(git hash-object lib/desenho-do-icone.tsx)" = e9ba22cee9830ec2e084045cb483a78071778de4 || { echo "o desenho não é o do ensaio: pare"; exit 1; }
test "$(git hash-object tests/manifesto.test.ts)" = 9d9fa91f576007ed2eb79200df3a527ecfdfba9c || { echo "o teste não é o do ensaio: pare"; exit 1; }
echo "os cinco blobs: iguais aos do ensaio"
node "$N/varrer-texto.mjs" lib/marca.ts app/manifest.ts app/layout.tsx lib/desenho-do-icone.tsx tests/manifesto.test.ts
grep -rn "COR_DA_ACAO\b" app lib tests; echo "(acima: o COR_DA_ACAO que sobrou; vazio = nenhum)"
npx --no-install vitest run tests/manifesto.test.ts > "$K/exec-c-verde.log" 2>&1; echo "vitest do manifesto: $?"
npm run typecheck > "$K/exec-c-tsc.log" 2>&1; echo "typecheck: $?"
npm run lint > "$K/exec-c-lint.log" 2>&1; echo "lint: $?"
env -u CLAUDECODE -u AI_AGENT npm run build > "$K/exec-c-build.log" 2>&1; echo "build: $?"
cat .next/server/app/manifest.webmanifest.body; echo
npm test > "$K/exec-c-puros.log" 2>&1; echo "puros: $?"; sed 's/\x1b\[[0-9;]*m//g' "$K/exec-c-puros.log" | grep -n -E "^\s*(Test Files|Tests)\s"
npm run test:dom > "$K/exec-c-tela.log" 2>&1; echo "tela: $?"; sed 's/\x1b\[[0-9;]*m//g' "$K/exec-c-tela.log" | grep -n -E "^\s*(Test Files|Tests)\s"
git diff --stat -- AGENTS.md tsconfig.json; echo "(diff do AGENTS.md e do tsconfig.json acima; vazio = intocados)"
node "$K/guarda-celular-1.mjs" "$C"; echo "guarda: $?"
```

Esperado: as 4 linhas do aplicar (a marca de 15 para 18; o manifest de 21 para 21; o layout de 154 para 154 em CRLF; o
desenho de 38 para 38) e "GRAVADO: as cores, no modo codigo."; os cinco blobs iguais; os cinco "limpo"; nenhum
`COR_DA_ACAO`; o manifesto (2 casos), o typecheck, o lint e o build com 0; o manifesto gerado com
`"theme_color":"#0b0a0e"`; os puros com 164 e 3 886; os de tela com 36 e 350; o diff do `AGENTS.md` e do
`tsconfig.json` vazio; a guarda com 0. Depois, à parte:

```bash
cd "C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/e078f16e-47b2-4e08-86f3-8036d4155715/scratchpad/x" || exit 1
test "$(git branch --show-current)" = celular-1 && git add lib/marca.ts app/manifest.ts app/layout.tsx lib/desenho-do-icone.tsx tests/manifesto.test.ts && git commit -m "O ícone e a barra do celular passam ao preto do painel, com o ponto do \"M.\" no azul claro"
git show HEAD | git patch-id --stable
```

Esperado: o patch-id `7c5ac5e2a20271f7d1516b7f55484e67d7ca6bed`.

## R: o redirect do favicon antigo (o commit que repete o `bcb8b40`)

<!-- bloco: tests/favicon.test.ts -->
```typescript
import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";

// O FAVICON ANTIGO LEVA AO ÍCONE NOVO (docs/specs/2026-11-24-celular-onda-1.md, o achado 352).
//
// O app/favicon.ico (o logotipo da Vercel) saiu, e o /_not-found deste app é dinâmico, porque o layout lê cookies.
// Sem o redirect, cada pedido ao /favicon.ico rodaria o layout, que, com o cookie da sessão, consulta o banco duas
// vezes. O redirect é temporário (307), para não ficar em cache no navegador de ninguém.
describe("o favicon antigo", () => {
  it("leva ao ícone novo de 32 px, por um redirect temporário", async () => {
    const lista = await nextConfig.redirects!();
    expect(lista).toContainEqual({ source: "/favicon.ico", destination: "/icon/32", permanent: false });
  });
});
```

```diff
diff --git a/next.config.ts b/next.config.ts
index f816ad7..6c538df 100644
--- a/next.config.ts
+++ b/next.config.ts
@@ -22,6 +22,13 @@ const nextConfig: NextConfig = {
       // como "Loja" por um bom tempo, e link salvo de cliente não deve virar
       // 404.
       { source: "/loja", destination: "/produtos", permanent: true },
+      // O FAVICON ANTIGO LEVA AO ÍCONE NOVO (docs/specs/2026-11-24-celular-onda-1.md, o achado 352). O
+      // app/favicon.ico (o logotipo da Vercel) saiu, e o /_not-found deste app é dinâmico: sem este redirect,
+      // cada pedido ao /favicon.ico rodaria o layout, que lê a sessão no banco. O redirect do next.config roda
+      // antes do porteiro e antes dos arquivos (node_modules/next/dist/docs/01-app/03-api-reference/
+      // 03-file-conventions/proxy.md:242-245 e 05-config/01-next-config-js/redirects.md:39). O 307
+      // (permanent: false) não fica em cache (redirects.md:30). tests/favicon.test.ts confere este redirect.
+      { source: "/favicon.ico", destination: "/icon/32", permanent: false },
     ];
   },
 };
```

**O vermelho:** o teste, sem o redirect.

```bash
S="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/e078f16e-47b2-4e08-86f3-8036d4155715/scratchpad"
C="$S/x"; N="$S/next"; K="$S/celular"; P="$K/plano.md"
cd "$C" || exit 1
test "$(git branch --show-current)" = celular-1 || { echo "não é o ramo da execução: pare"; exit 1; }
test -z "$(git status --porcelain)" || { echo "a árvore não está limpa: pare"; exit 1; }
node "$N/extrair-bloco.mjs" "$P" tests/favicon.test.ts tests/favicon.test.ts || { echo "o extrair parou: pare"; exit 1; }
npx --no-install vitest run tests/favicon.test.ts > "$K/exec-r-vermelho.log" 2>&1; echo "vitest: $?"
sed 's/\x1b\[[0-9;]*m//g' "$K/exec-r-vermelho.log" | grep -n -E "^\s*(Test Files|Tests)\s|AssertionError"
node "$K/guarda-celular-1.mjs" "$C"; echo "guarda: $?"
```

Esperado: "vitest: 1", com "Tests 1 failed (1)", porque a lista do `redirects()` só tem o `/loja` ("expected [ {
source: '/loja', …(2) } ] to deep equally contain { source: '/favicon.ico', …(2) }"); a guarda com "dentro:
tests/favicon.test.ts" a mais e 0. O vermelho do ensaio, sem os códigos de cor:

```text
(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.

 RUN  v4.1.12 C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/e078f16e-47b2-4e08-86f3-8036d4155715/scratchpad/m

 ❯ tests/favicon.test.ts (1 test | 1 failed) 9ms
     × leva ao ícone novo de 32 px, por um redirect temporário 7ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  tests/favicon.test.ts > o favicon antigo > leva ao ícone novo de 32 px, por um redirect temporário
AssertionError: expected [ { source: '/loja', …(2) } ] to deep equally contain { source: '/favicon.ico', …(2) }

- Expected:
{
  "destination": "/icon/32",
  "permanent": false,
  "source": "/favicon.ico",
}

+ Received:
[
  {
    "destination": "/produtos",
    "permanent": true,
    "source": "/loja",
  },
]

 ❯ tests/favicon.test.ts:12:19
     10|   it("leva ao ícone novo de 32 px, por um redirect temporário", async …
     11|     const lista = await nextConfig.redirects!();
     12|     expect(lista).toContainEqual({ source: "/favicon.ico", destination…
       |                   ^
     13|   });
     14| });

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯


 Test Files  1 failed (1)
      Tests  1 failed (1)
   Start at  11:15:49
   Duration  419ms (transform 41ms, setup 0ms, import 73ms, tests 9ms, environment 0ms)

```

**O verde:**

```bash
S="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/e078f16e-47b2-4e08-86f3-8036d4155715/scratchpad"
C="$S/x"; N="$S/next"; K="$S/celular"
cd "$C" || exit 1
test "$(git branch --show-current)" = celular-1 || { echo "não é o ramo da execução: pare"; exit 1; }
node "$K/f2c/aplicar-next-config.mjs" "$C" || { echo "o aplicar parou: pare"; exit 1; }
test "$(git hash-object next.config.ts)" = 6c538dfa1b11462b7b7341b2192b43e6e0be2971 || { echo "o next.config não é o do ensaio: pare"; exit 1; }
test "$(git hash-object tests/favicon.test.ts)" = c9f3b61f4c17b8fcd9b6aecf85e771ff46bca0bc || { echo "o teste não é o do ensaio: pare"; exit 1; }
echo "os dois blobs: iguais aos do ensaio"
node "$N/varrer-texto.mjs" next.config.ts tests/favicon.test.ts
npx --no-install vitest run tests/favicon.test.ts > "$K/exec-r-verde.log" 2>&1; echo "vitest do favicon: $?"
npm run typecheck > "$K/exec-r-tsc.log" 2>&1; echo "typecheck: $?"
npm run lint > "$K/exec-r-lint.log" 2>&1; echo "lint: $?"
npm test > "$K/exec-r-puros.log" 2>&1; echo "puros: $?"; sed 's/\x1b\[[0-9;]*m//g' "$K/exec-r-puros.log" | grep -n -E "^\s*(Test Files|Tests)\s"
npm run test:dom > "$K/exec-r-tela.log" 2>&1; echo "tela: $?"; sed 's/\x1b\[[0-9;]*m//g' "$K/exec-r-tela.log" | grep -n -E "^\s*(Test Files|Tests)\s"
node "$K/guarda-celular-1.mjs" "$C"; echo "guarda: $?"
```

Esperado: "GRAVADO: o redirect do favicon no next.config.ts, que passa de 29 para 36 linhas (CRLF)."; os dois blobs
iguais; os dois "limpo"; o favicon (1 caso), o typecheck e o lint com 0; os puros com 165 e 3 887 (os da F1, mais
este arquivo com 1 caso); os de tela com 36 e 350; a guarda com "next.config.ts: só o redirect do favicon, com os
comentários dele" e 0. Depois, à parte:

```bash
cd "C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/e078f16e-47b2-4e08-86f3-8036d4155715/scratchpad/x" || exit 1
test "$(git branch --show-current)" = celular-1 && git add next.config.ts tests/favicon.test.ts && git commit -m "O endereço antigo do favicon passa a levar ao ícone novo, sem rodar a página de não encontrado"
git show HEAD | git patch-id --stable
```

Esperado: o patch-id `f38a086d2af0528c3954444e76814f9eaaf65482`.

## F3: o porteiro, os lados do ícone e os ícones do manifesto (o commit que repete o `58e9e13`)

<!-- bloco: tests/proxy-icone.test.ts -->
```typescript
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LADOS_DO_ICONE } from "@/lib/desenho-do-icone";

// O PORTEIRO E O ÍCONE DO CELULAR (docs/specs/2026-11-24-celular-onda-1.md, "O porteiro").
//
// O navegador busca o manifesto e os ícones sozinho, sem o cookie da sessão, e sem eles o celular não instala o
// ícone. Por isso, os endereços que o build serve para eles passam pelo porteiro sem sessão. A conferência é de
// IGUALDADE (a lista PUBLIC_EXATOS de proxy.ts), e não de prefixo nem de extensão
// (docs/specs/2026-10-26-sessao-conferida.md): um vizinho parecido continua pedindo sessão.
//
// A conferência da sessão é trocada por uma de mentira que conta as chamadas e responde "sem sessão", como em
// tests/proxy-ordem.test.ts. O banco não entra aqui.

const conferencia = vi.hoisted(() => ({ chamadas: 0 }));
vi.mock("@/lib/sessao", () => ({
  sessaoDoCookie: async () => {
    conferencia.chamadas++;
    return null;
  },
}));

const { proxy } = await import("@/proxy");

const pedido = (caminho: string) => new NextRequest(`https://painel.exemplo.invalid${caminho}`);
const vaiParaEntrar = (r: Response) => {
  const destino = r.headers.get("location");
  return destino !== null && new URL(destino).pathname === "/entrar";
};

// Os caminhos da lista de rotas do build (o manifesto, um /icon por lado de lib/desenho-do-icone.tsx e o ícone do
// iPhone). Montados a partir dos lados, um lado novo sem o endereço no porteiro cai aqui.
const PUBLICOS = ["/manifest.webmanifest", ...LADOS_DO_ICONE.map((lado) => `/icon/${lado}`), "/apple-icon"];

beforeEach(() => {
  conferencia.chamadas = 0;
});

describe("o porteiro e o ícone do celular", () => {
  it.each(PUBLICOS)("%s passa sem sessão, e sem consultar a sessão", async (caminho) => {
    const r = await proxy(pedido(caminho));
    expect(r.headers.get("location"), caminho).toBeNull();
    expect(conferencia.chamadas).toBe(0);
  });

  it("confere o caminho sem a query que o Next põe no <link> do ícone", async () => {
    const r = await proxy(pedido("/icon/32?a1b2c3d4"));
    expect(r.headers.get("location")).toBeNull();
    expect(conferencia.chamadas).toBe(0);
  });

  it.each([
    "/manifest.webmanifest/x",
    "/icon/32/x",
    "/icon/64",
    "/icon",
    "/icon-qualquer-coisa",
    "/iconx",
    "/apple-icon/x",
    "/apple-icon.png",
    "/manifest.json",
    "/conversas/x.png",
  ])("%s continua pedindo sessão", async (caminho) => {
    const r = await proxy(pedido(caminho));
    expect(vaiParaEntrar(r), caminho).toBe(true);
    expect(conferencia.chamadas).toBe(1);
  });
});
```

```diff
diff --git a/app/icon.tsx b/app/icon.tsx
index 6b22856..9e997bd 100644
--- a/app/icon.tsx
+++ b/app/icon.tsx
@@ -1,5 +1,5 @@
 import { ImageResponse } from "next/og";
-import { desenhoDoIcone } from "@/lib/desenho-do-icone";
+import { desenhoDoIcone, LADOS_DO_ICONE } from "@/lib/desenho-do-icone";
 
 // O ÍCONE DA ABA E DA TELA INICIAL (docs/specs/2026-11-24-celular-onda-1.md, "O ícone e o manifesto"). Ele toma o
 // lugar do app/favicon.ico, que era o logotipo da Vercel, vindo com o create-next-app.
@@ -11,10 +11,8 @@ import { desenhoDoIcone } from "@/lib/desenho-do-icone";
 //
 // ESTES ENDEREÇOS TÊM DE SER PÚBLICOS NO PORTEIRO (proxy.ts): o navegador busca o ícone sozinho, sem o cookie da
 // sessão.
-const LADOS = [32, 192, 512] as const;
-
 export function generateImageMetadata() {
-  return LADOS.map((lado) => ({
+  return LADOS_DO_ICONE.map((lado) => ({
     id: String(lado),
     size: { width: lado, height: lado },
     contentType: "image/png",
diff --git a/app/manifest.ts b/app/manifest.ts
index bb7737c..10dc293 100644
--- a/app/manifest.ts
+++ b/app/manifest.ts
@@ -17,5 +17,12 @@ export default function manifest(): MetadataRoute.Manifest {
     display: "standalone",
     background_color: COR_DO_PAPEL,
     theme_color: COR_DO_PAPEL_ESCURO,
+    // OS ÍCONES DA TELA INICIAL são os de 192 e 512 do app/icon.tsx (os lados de lib/desenho-do-icone.tsx). O de
+    // 512 vale também como "maskable": o desenho fica nos 80% do meio, e o Android pode recortá-lo em círculo.
+    icons: [
+      { src: "/icon/192", sizes: "192x192", type: "image/png" },
+      { src: "/icon/512", sizes: "512x512", type: "image/png" },
+      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
+    ],
   };
 }
diff --git a/docs/specs/2026-11-24-celular-onda-1.md b/docs/specs/2026-11-24-celular-onda-1.md
index e9d5886..e9dc351 100644
--- a/docs/specs/2026-11-24-celular-onda-1.md
+++ b/docs/specs/2026-11-24-celular-onda-1.md
@@ -223,7 +223,7 @@ Em 390 px de largura, em cada rota da onda 1:
       `sessaoAtual()` e o `contasDoLogin()`).
     - **Por isso, o `/favicon.ico` leva ao ícone novo por um redirect no `next.config.ts`**, para o `/icon/32`, com
       `permanent: false` (um 307, que não fica em cache: `redirects.md:30`). O redirect do `next.config` roda antes
-      do porteiro e antes dos arquivos (`proxy.md:242-245` e `redirects.md:39`, no guia da 16.4.6). O
+      do porteiro e antes dos arquivos (`proxy.md:243-246` e `redirects.md:39`, no guia da 16.4.6). O
       `next.config.ts` já tem um redirect, o do `/loja` (`:24`).
     - O servidor local não sobe sem um banco com o esquema (o `instrumentation.ts`, o achado 353). Por isso, o
       `<head>`, os códigos sem sessão e o 307 do favicon se medem na prova na prévia.
diff --git a/lib/desenho-do-icone.tsx b/lib/desenho-do-icone.tsx
index e9ba22c..3c4d377 100644
--- a/lib/desenho-do-icone.tsx
+++ b/lib/desenho-do-icone.tsx
@@ -16,6 +16,11 @@ export const DESENHO_DO_M =
   "M18 70 V30 H28 L42 52 L56 30 H66 V70 H56 V46 L45 63 H39 L28 46 V70 Z";
 export const PONTO = { cx: 75, cy: 65, r: 5 };
 
+// OS LADOS DO app/icon.tsx, num lugar só: 32 para a aba do navegador, e 192 e 512 para a tela inicial do
+// Android. O manifesto (app/manifest.ts) aponta para o 192 e o 512, e o porteiro (proxy.ts) libera um /icon por
+// lado. tests/manifesto.test.ts e tests/proxy-icone.test.ts conferem os dois contra esta lista.
+export const LADOS_DO_ICONE = [32, 192, 512] as const;
+
 /** O ícone inteiro, no lado pedido (em px), para o `ImageResponse`. */
 export function desenhoDoIcone(lado: number) {
   return (
diff --git a/next.config.ts b/next.config.ts
index 6c538df..6e6f4ef 100644
--- a/next.config.ts
+++ b/next.config.ts
@@ -26,7 +26,7 @@ const nextConfig: NextConfig = {
       // app/favicon.ico (o logotipo da Vercel) saiu, e o /_not-found deste app é dinâmico: sem este redirect,
       // cada pedido ao /favicon.ico rodaria o layout, que lê a sessão no banco. O redirect do next.config roda
       // antes do porteiro e antes dos arquivos (node_modules/next/dist/docs/01-app/03-api-reference/
-      // 03-file-conventions/proxy.md:242-245 e 05-config/01-next-config-js/redirects.md:39). O 307
+      // 03-file-conventions/proxy.md:243-246 e 05-config/01-next-config-js/redirects.md:39). O 307
       // (permanent: false) não fica em cache (redirects.md:30). tests/favicon.test.ts confere este redirect.
       { source: "/favicon.ico", destination: "/icon/32", permanent: false },
     ];
diff --git a/proxy.ts b/proxy.ts
index a46667b..5e2a6ea 100644
--- a/proxy.ts
+++ b/proxy.ts
@@ -25,9 +25,24 @@ const PUBLIC_PREFIXES = [
   "/favicon.ico",
 ];
 
+// OS ENDEREÇOS EXATOS DO MANIFESTO E DO ÍCONE (docs/specs/2026-11-24-celular-onda-1.md, "O porteiro"). O
+// navegador os busca sozinho, sem o cookie da sessão, e sem eles públicos o celular não instala o ícone. A
+// conferência é de IGUALDADE, e não de prefixo nem de extensão: um vizinho parecido (`/icon/32/x`,
+// `/icon-qualquer-coisa`, `/apple-icon.png`) continua pedindo sessão. São os caminhos da lista de rotas do build
+// do Next 16.4.6: o app/manifest.ts, o app/icon.tsx (um por lado de lib/desenho-do-icone.tsx) e o
+// app/apple-icon.tsx. O `pathname` vem sem a query que o Next põe no <link>. tests/proxy-icone.test.ts confere a
+// lista e os vizinhos.
+const PUBLIC_EXATOS = new Set([
+  "/manifest.webmanifest",
+  "/icon/32",
+  "/icon/192",
+  "/icon/512",
+  "/apple-icon",
+]);
+
 export async function proxy(req: NextRequest) {
   const { pathname } = req.nextUrl;
-  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
+  if (PUBLIC_EXATOS.has(pathname) || PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
     return NextResponse.next();
   }
   if (await sessaoDoCookie(req.cookies.get(SESSION_COOKIE)?.value)) {
diff --git a/tests/manifesto.test.ts b/tests/manifesto.test.ts
index 9d9fa91..9c1f25a 100644
--- a/tests/manifesto.test.ts
+++ b/tests/manifesto.test.ts
@@ -3,6 +3,7 @@ import { fileURLToPath } from "node:url";
 import ts from "typescript";
 import { describe, expect, it } from "vitest";
 import manifest from "@/app/manifest";
+import { LADOS_DO_ICONE } from "@/lib/desenho-do-icone";
 import { DESCRICAO_DO_PAINEL } from "@/lib/marca";
 
 // O MANIFESTO DO CELULAR (docs/specs/2026-11-24-celular-onda-1.md, "Os testes").
@@ -48,4 +49,19 @@ describe("o manifesto do celular", () => {
     expect(valoresDe("app/manifest.ts", "description")).toEqual(["DESCRICAO_DO_PAINEL"]);
     expect(valoresDe("app/layout.tsx", "description")).toEqual(["DESCRICAO_DO_PAINEL"]);
   });
+
+  // OS ÍCONES DO MANIFESTO SAEM DOS LADOS QUE O app/icon.tsx GERA (lib/desenho-do-icone.tsx). Um tamanho mudado
+  // num lado e não no outro faria o manifesto apontar para um /icon/… que não existe, e o celular não instalaria.
+  it("aponta os ícones da tela inicial para os tamanhos que o app/icon.tsx gera", () => {
+    const icones = manifest().icons ?? [];
+    expect(icones.map((i) => i.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
+    for (const i of icones) {
+      const lado = Number(i.src.replace("/icon/", ""));
+      expect(LADOS_DO_ICONE, i.src).toContain(lado);
+      expect(i.src).toBe(`/icon/${lado}`);
+      expect(i.sizes).toBe(`${lado}x${lado}`);
+      expect(i.type).toBe("image/png");
+    }
+    expect(icones.some((i) => i.purpose === "maskable" && i.sizes === "512x512")).toBe(true);
+  });
 });
```

**O vermelho**, com os lados antes do teste (o achado 355): o `tests/proxy-icone.test.ts` monta os caminhos públicos
com o `LADOS_DO_ICONE`, e sem ele o arquivo inteiro cairia ao carregar, e não pelo porteiro. A troca dos lados não muda
comportamento (continuam 32, 192 e 512), e o typecheck confere isso antes do teste.

```bash
S="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/e078f16e-47b2-4e08-86f3-8036d4155715/scratchpad"
C="$S/x"; N="$S/next"; K="$S/celular"; P="$K/plano.md"
cd "$C" || exit 1
test "$(git branch --show-current)" = celular-1 || { echo "não é o ramo da execução: pare"; exit 1; }
test -z "$(git status --porcelain)" || { echo "a árvore não está limpa: pare"; exit 1; }
node "$K/f3/aplicar-f3.mjs" "$C" lados || { echo "o aplicar dos lados parou: pare"; exit 1; }
npm run typecheck > "$K/exec-f3-lados-tsc.log" 2>&1; echo "typecheck dos lados: $?"
node "$N/extrair-bloco.mjs" "$P" tests/proxy-icone.test.ts tests/proxy-icone.test.ts || { echo "o extrair parou: pare"; exit 1; }
node "$K/f3/aplicar-f3.mjs" "$C" teste || { echo "o aplicar parou: pare"; exit 1; }
npx --no-install vitest run tests/proxy-icone.test.ts tests/manifesto.test.ts > "$K/exec-f3-vermelho.log" 2>&1; echo "vitest: $?"
sed 's/\x1b\[[0-9;]*m//g' "$K/exec-f3-vermelho.log" | grep -n -E "^\s+×|^\s*(Test Files|Tests)\s|AssertionError"
node "$K/guarda-celular-1.mjs" "$C"; echo "guarda: $?"
```

Esperado:
- "lib/desenho-do-icone.tsx: 1 troca(s), de 38 para 43 linhas (LF)", "app/icon.tsx: 3 troca(s), de 27 para 25 linhas
  (LF)" e "GRAVADO: a F3, no modo lados."; "typecheck dos lados: 0";
- "tests/manifesto.test.ts: 2 troca(s), de 51 para 67 linhas (LF)" e "GRAVADO: a F3, no modo teste.";
- "vitest: 1", com "Test Files 2 failed (2)" e "Tests 7 failed | 12 passed (19)":
  - no `tests/proxy-icone.test.ts`, os 5 caminhos públicos e o caso da query caindo pelo porteiro (cada um com o
    `location` para o `/entrar`), e os 10 vizinhos passando;
  - no `tests/manifesto.test.ts`, os 2 casos de antes passando, e o caso novo dos ícones caindo, porque o manifesto
    ainda não tem `icons` ("expected [] to deeply equal ArrayContaining [\"192x192\", \"512x512\"]");
- a guarda com "dentro: tests/proxy-icone.test.ts" a mais e 0.

O vermelho do ensaio, sem os códigos de cor:

```text
(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.

 RUN  v4.1.12 C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/e078f16e-47b2-4e08-86f3-8036d4155715/scratchpad/m

 ❯ tests/proxy-icone.test.ts (16 tests | 6 failed) 27ms
     × /manifest.webmanifest passa sem sessão, e sem consultar a sessão 12ms
     × /icon/32 passa sem sessão, e sem consultar a sessão 1ms
     × /icon/192 passa sem sessão, e sem consultar a sessão 1ms
     × /icon/512 passa sem sessão, e sem consultar a sessão 1ms
     × /apple-icon passa sem sessão, e sem consultar a sessão 1ms
     × confere o caminho sem a query que o Next põe no <link> do ícone 1ms
 ❯ tests/manifesto.test.ts (3 tests | 1 failed) 52ms
     × aponta os ícones da tela inicial para os tamanhos que o app/icon.tsx gera 12ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 7 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  tests/manifesto.test.ts > o manifesto do celular > aponta os ícones da tela inicial para os tamanhos que o app/icon.tsx gera
AssertionError: expected [] to deeply equal ArrayContaining ["192x192", "512x512"]

- Expected
+ Received

- ArrayContaining [
-   "192x192",
-   "512x512",
- ]
+ []

 ❯ tests/manifesto.test.ts:57:40
     55|   it("aponta os ícones da tela inicial para os tamanhos que o app/icon…
     56|     const icones = manifest().icons ?? [];
     57|     expect(icones.map((i) => i.sizes)).toEqual(expect.arrayContaining(…
       |                                        ^
     58|     for (const i of icones) {
     59|       const lado = Number(i.src.replace("/icon/", ""));

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/7]⎯

 FAIL  tests/proxy-icone.test.ts > o porteiro e o ícone do celular > /manifest.webmanifest passa sem sessão, e sem consultar a sessão
AssertionError: /manifest.webmanifest: expected 'https://painel.exemplo.invalid/entrar' to be null

- Expected:
null

+ Received:
"https://painel.exemplo.invalid/entrar"

 ❯ tests/proxy-icone.test.ts:42:48
     40|   it.each(PUBLICOS)("%s passa sem sessão, e sem consultar a sessão", a…
     41|     const r = await proxy(pedido(caminho));
     42|     expect(r.headers.get("location"), caminho).toBeNull();
       |                                                ^
     43|     expect(conferencia.chamadas).toBe(0);
     44|   });

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/7]⎯

 FAIL  tests/proxy-icone.test.ts > o porteiro e o ícone do celular > /icon/32 passa sem sessão, e sem consultar a sessão
AssertionError: /icon/32: expected 'https://painel.exemplo.invalid/entrar' to be null

- Expected:
null

+ Received:
"https://painel.exemplo.invalid/entrar"

 ❯ tests/proxy-icone.test.ts:42:48
     40|   it.each(PUBLICOS)("%s passa sem sessão, e sem consultar a sessão", a…
     41|     const r = await proxy(pedido(caminho));
     42|     expect(r.headers.get("location"), caminho).toBeNull();
       |                                                ^
     43|     expect(conferencia.chamadas).toBe(0);
     44|   });

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/7]⎯

 FAIL  tests/proxy-icone.test.ts > o porteiro e o ícone do celular > /icon/192 passa sem sessão, e sem consultar a sessão
AssertionError: /icon/192: expected 'https://painel.exemplo.invalid/entrar' to be null

- Expected:
null

+ Received:
"https://painel.exemplo.invalid/entrar"

 ❯ tests/proxy-icone.test.ts:42:48
     40|   it.each(PUBLICOS)("%s passa sem sessão, e sem consultar a sessão", a…
     41|     const r = await proxy(pedido(caminho));
     42|     expect(r.headers.get("location"), caminho).toBeNull();
       |                                                ^
     43|     expect(conferencia.chamadas).toBe(0);
     44|   });

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/7]⎯

 FAIL  tests/proxy-icone.test.ts > o porteiro e o ícone do celular > /icon/512 passa sem sessão, e sem consultar a sessão
AssertionError: /icon/512: expected 'https://painel.exemplo.invalid/entrar' to be null

- Expected:
null

+ Received:
"https://painel.exemplo.invalid/entrar"

 ❯ tests/proxy-icone.test.ts:42:48
     40|   it.each(PUBLICOS)("%s passa sem sessão, e sem consultar a sessão", a…
     41|     const r = await proxy(pedido(caminho));
     42|     expect(r.headers.get("location"), caminho).toBeNull();
       |                                                ^
     43|     expect(conferencia.chamadas).toBe(0);
     44|   });

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/7]⎯

 FAIL  tests/proxy-icone.test.ts > o porteiro e o ícone do celular > /apple-icon passa sem sessão, e sem consultar a sessão
AssertionError: /apple-icon: expected 'https://painel.exemplo.invalid/entrar' to be null

- Expected:
null

+ Received:
"https://painel.exemplo.invalid/entrar"

 ❯ tests/proxy-icone.test.ts:42:48
     40|   it.each(PUBLICOS)("%s passa sem sessão, e sem consultar a sessão", a…
     41|     const r = await proxy(pedido(caminho));
     42|     expect(r.headers.get("location"), caminho).toBeNull();
       |                                                ^
     43|     expect(conferencia.chamadas).toBe(0);
     44|   });

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[6/7]⎯

 FAIL  tests/proxy-icone.test.ts > o porteiro e o ícone do celular > confere o caminho sem a query que o Next põe no <link> do ícone
AssertionError: expected 'https://painel.exemplo.invalid/entrar' to be null

- Expected:
null

+ Received:
"https://painel.exemplo.invalid/entrar"

 ❯ tests/proxy-icone.test.ts:48:39
     46|   it("confere o caminho sem a query que o Next põe no <link> do ícone"…
     47|     const r = await proxy(pedido("/icon/32?a1b2c3d4"));
     48|     expect(r.headers.get("location")).toBeNull();
       |                                       ^
     49|     expect(conferencia.chamadas).toBe(0);
     50|   });

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[7/7]⎯


 Test Files  2 failed (2)
      Tests  7 failed | 12 passed (19)
   Start at  11:30:41
   Duration  1.31s (transform 343ms, setup 0ms, import 1.10s, tests 79ms, environment 0ms)

```

**O verde:** o porteiro, os lados, o manifesto e a citação.

```bash
S="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/e078f16e-47b2-4e08-86f3-8036d4155715/scratchpad"
C="$S/x"; N="$S/next"; K="$S/celular"
cd "$C" || exit 1
test "$(git branch --show-current)" = celular-1 || { echo "não é o ramo da execução: pare"; exit 1; }
node -e 'const a=Object.entries(process.env).filter(([k,v])=>/^postgres(ql)?:\/\//i.test(v||"")).map(([k])=>k); if(a.length){console.log("variável com URL de banco:",a.join(", "),": pare");process.exit(1)} console.log("nenhuma variável com URL de banco")' || exit 1
node "$K/f3/aplicar-f3.mjs" "$C" codigo || { echo "o aplicar parou: pare"; exit 1; }
test "$(git hash-object proxy.ts)" = 5e2a6ea1774ea6a365e75f1e1594a87c278ab61d || { echo "o proxy não é o do ensaio: pare"; exit 1; }
test "$(git hash-object app/manifest.ts)" = 10dc2934598048bfcf52ab65412626eb3bf14d44 || { echo "o manifesto não é o do ensaio: pare"; exit 1; }
test "$(git hash-object lib/desenho-do-icone.tsx)" = 3c4d377c0f22b246c38476f2026b798acef117a0 || { echo "o desenho não é o do ensaio: pare"; exit 1; }
test "$(git hash-object app/icon.tsx)" = 9e997bd9b0fd95924de12ad88e1971b775936fb3 || { echo "o icon não é o do ensaio: pare"; exit 1; }
test "$(git hash-object tests/manifesto.test.ts)" = 9c1f25a3f6f9326c0e8e918333b7249d740226b9 || { echo "o teste do manifesto não é o do ensaio: pare"; exit 1; }
test "$(git hash-object tests/proxy-icone.test.ts)" = c67604177fd32a86224f1800ca12d3b922116561 || { echo "o teste do porteiro não é o do ensaio: pare"; exit 1; }
test "$(git hash-object next.config.ts)" = 6e6f4ef966160d0736abcc182c7abc3c990a3f7a || { echo "o next.config não é o do ensaio: pare"; exit 1; }
test "$(git hash-object docs/specs/2026-11-24-celular-onda-1.md)" = e9dc351f6e8981ca8e5b47ecbfe5654d41557ff8 || { echo "a spec não é a do ensaio: pare"; exit 1; }
echo "os oito blobs: iguais aos do ensaio"
node "$N/varrer-texto.mjs" lib/desenho-do-icone.tsx app/icon.tsx app/manifest.ts proxy.ts next.config.ts docs/specs/2026-11-24-celular-onda-1.md tests/proxy-icone.test.ts tests/manifesto.test.ts
grep -rn "242-245" app lib proxy.ts next.config.ts docs/specs/2026-11-24-celular-onda-1.md; echo "(acima: a citação velha que sobrou; vazio = nenhuma)"
npx --no-install vitest run tests/proxy-icone.test.ts tests/manifesto.test.ts tests/proxy-ordem.test.ts tests/proxy-matcher.test.ts tests/favicon.test.ts > "$K/exec-f3-verde.log" 2>&1; echo "vitest dos cinco: $?"
sed 's/\x1b\[[0-9;]*m//g' "$K/exec-f3-verde.log" | grep -n -E "^\s*(Test Files|Tests)\s"
npm run typecheck > "$K/exec-f3-tsc.log" 2>&1; echo "typecheck: $?"
npm run lint > "$K/exec-f3-lint.log" 2>&1; echo "lint: $?"
env -u CLAUDECODE -u AI_AGENT npm run build > "$K/exec-f3-build.log" 2>&1; echo "build: $?"
sed 's/\x1b\[[0-9;]*m//g' "$K/exec-f3-build.log" | grep -n -E "MIGRAÇÃO PULADA|Next\.js 16|Proxy|apple-icon|/icon/|manifest"
cat .next/server/app/manifest.webmanifest.body; echo
npm test > "$K/exec-f3-puros.log" 2>&1; echo "puros: $?"; sed 's/\x1b\[[0-9;]*m//g' "$K/exec-f3-puros.log" | grep -n -E "^\s*(Test Files|Tests)\s"
npm run test:dom > "$K/exec-f3-tela.log" 2>&1; echo "tela: $?"; sed 's/\x1b\[[0-9;]*m//g' "$K/exec-f3-tela.log" | grep -n -E "^\s*(Test Files|Tests)\s"
git diff --stat -- AGENTS.md tsconfig.json; echo "(diff do AGENTS.md e do tsconfig.json acima; vazio = intocados)"
node "$K/guarda-celular-1.mjs" "$C"; echo "guarda: $?"
```

Esperado:
- as 4 linhas do aplicar (o manifest de 21 para 28; o proxy de 48 para 63 em CRLF; o next.config de 36 para 36 em
  CRLF; a spec de 365 para 365) e "GRAVADO: a F3, no modo codigo.";
- os oito blobs iguais; os oito "limpo"; nenhuma citação "242-245" sobrando;
- "vitest dos cinco: 0", com 5 arquivos e 35 casos (o porteiro com 16, o manifesto com 3, a ordem do porteiro, o
  matcher e o favicon);
- o typecheck, o lint e o build com 0, com as mesmas rotas do ícone e do manifesto, e o manifesto gerado com os três
  `icons`;
- os puros com 166 e 3 904 (os 165 e 3 887 do R, mais o porteiro com 16 e o caso novo do manifesto); os de tela com 36
  e 350;
- o diff do `AGENTS.md` e do `tsconfig.json` vazio;
- a guarda com "proxy.ts: PUBLIC_PREFIXES igual à base", "proxy.ts: o matcher igual à base", "next.config.ts: só o
  redirect do favicon, com os comentários dele" e 0.

Depois, à parte:

```bash
cd "C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/e078f16e-47b2-4e08-86f3-8036d4155715/scratchpad/x" || exit 1
test "$(git branch --show-current)" = celular-1 && git add lib/desenho-do-icone.tsx app/icon.tsx app/manifest.ts proxy.ts next.config.ts docs/specs/2026-11-24-celular-onda-1.md tests/proxy-icone.test.ts tests/manifesto.test.ts && git commit -m "O porteiro deixa passar sem login só os endereços exatos do manifesto e do ícone, e o manifesto aponta os ícones da tela inicial"
git show HEAD | git patch-id --stable
```

Esperado: o patch-id `4c15944a60a8df6cc797014ecfa1e64af749f4e5`.

## F4: a casca, o Início e a Atividade (o commit que repete o `1a1049e`)

A F4 só troca classes, e não tem teste novo: o jsdom não mede layout. O build confere que o Tailwind gerou cada regra
nova, e a prova na prévia mede o tamanho de cada alvo e a largura da tabela. A conta das regras no CSS usa a fronteira
`{`: sem ela, o `.py-1` conta 7, porque pega o `.py-1\.5` e outros (medido no build da `e946b1c`: com a chave, 1 em
cada uma das nove).

```diff
diff --git a/app/app-shell.tsx b/app/app-shell.tsx
index 5304e19..e294fd8 100644
--- a/app/app-shell.tsx
+++ b/app/app-shell.tsx
@@ -146,7 +146,7 @@ function NavLinks({ onNavigate, administrador }: { onNavigate?: () => void; admi
                    navega por teclado atravessa esta lista em TODA página, então
                    era justamente o caminho mais percorrido que tinha o sinal
                    mais fraco. Agora é o mesmo anel de `acao` dos botões. */
-                className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acao/25 dark:focus-visible:ring-acao-escuro/25 ${
+                className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 min-h-11 lg:min-h-[auto] text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acao/25 dark:focus-visible:ring-acao-escuro/25 ${
                   active
                     ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800/70 dark:text-white"
                     : "text-zinc-600 hover:bg-zinc-100/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/40 dark:hover:text-zinc-100"
@@ -339,7 +339,7 @@ export default function AppShell({
           type="button"
           onClick={() => setOpen(true)}
           aria-label="Abrir menu"
-          className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
+          className="rounded-lg p-3 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
         >
           <IconMenu className="h-5 w-5" />
         </button>
@@ -356,7 +356,7 @@ export default function AppShell({
               type="button"
               onClick={() => setOpen(false)}
               aria-label="Fechar menu"
-              className="absolute right-3 top-4 rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
+              className="absolute right-3 top-4 rounded-lg p-3 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
             >
               <IconX className="h-5 w-5" />
             </button>
diff --git a/app/eventos/page.tsx b/app/eventos/page.tsx
index c3fa147..c930b4b 100644
--- a/app/eventos/page.tsx
+++ b/app/eventos/page.tsx
@@ -223,9 +223,9 @@ export default async function EventosPage({
                 <table className="w-full text-left text-sm">
                   <thead className={thead}>
                     <tr>
-                      <th className="px-3 py-2">Para quem</th>
-                      <th className="px-3 py-2">O que foi enviado</th>
-                      <th className="px-3 py-2">Quando</th>
+                      <th className="px-2 py-2 sm:px-3">Para quem</th>
+                      <th className="px-2 py-2 sm:px-3">O que foi enviado</th>
+                      <th className="px-2 py-2 sm:px-3">Quando</th>
                     </tr>
                   </thead>
                   <tbody className={rowDivide}>
@@ -258,7 +258,7 @@ export default async function EventosPage({
                       const quando = dataDaLinhaDeEnvio(q);
                       return (
                         <tr key={q.id}>
-                          <td className="px-3 py-1.5">
+                          <td className="px-2 py-1.5 sm:px-3">
                             <div className="flex items-center gap-2">
                               <Avatar
                                 src={q.person_pic}
@@ -266,17 +266,17 @@ export default async function EventosPage({
                                 className="h-6 w-6"
                                 textClassName="text-[11px]"
                               />
-                              <span className="truncate font-medium">{paraQuem}</span>
+                              <span className="max-w-28 truncate font-medium sm:max-w-none">{paraQuem}</span>
                             </div>
                           </td>
-                          <td className="px-3 py-1.5">
+                          <td className="px-2 py-1.5 sm:px-3">
                             <span className="inline-flex flex-wrap items-center gap-2">
                               {kindLabel(q.kind)}
                               {!normal && <span className={badge.className}>{badge.label}</span>}
                             </span>
                             {erro && <p className={`max-w-md text-xs ${muted}`}>{erro}</p>}
                           </td>
-                          <td className={`whitespace-nowrap px-3 py-1.5 text-xs ${muted}`}>
+                          <td className={`px-2 py-1.5 text-xs sm:whitespace-nowrap sm:px-3 ${muted}`}>
                             {/* A FRASE VEM DE `fraseDaDataDaLinha`, e ate
                                 09/09/2026 ela era decidida AQUI, com palavras
                                 diferentes das da tela de agendados para o mesmo
@@ -377,7 +377,7 @@ export default async function EventosPage({
                       {media && <PostLine kind={media.kind} post={posts.get(media.id) ?? null} />}
 
                       <details className="mt-2">
-                        <summary className={`cursor-pointer text-xs ${muted} hover:text-zinc-900 dark:hover:text-zinc-100`}>
+                        <summary className={`cursor-pointer py-1 text-xs ${muted} hover:text-zinc-900 dark:hover:text-zinc-100`}>
                           Ver detalhes técnicos
                         </summary>
                         <pre className="mt-2 overflow-x-auto rounded-lg bg-zinc-100 p-3 text-xs text-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
diff --git a/app/page.tsx b/app/page.tsx
index 31b28bb..5a581ef 100644
--- a/app/page.tsx
+++ b/app/page.tsx
@@ -415,7 +415,7 @@ export default async function Home({
                 <>
                   <span>@{account.username ?? account.ig_user_id}</span>
                   {administrador && (
-                    <a href="/api/oauth/login" className={`text-xs ${link}`}>
+                    <a href="/api/oauth/login" className={`inline-flex min-h-6 items-center text-xs ${link}`}>
                       Reconectar
                     </a>
                   )}
@@ -548,7 +548,7 @@ export default async function Home({
                 Tarefa 3. */}
             <p className={`mt-2 text-sm ${muted}`}>Nada agendado.</p>
             <p className="mt-3 text-sm">
-              <Link href="/publicar/novo" className={link}>
+              <Link href="/publicar/novo" className={`inline-flex min-h-6 items-center ${link}`}>
                 Criar post →
               </Link>
             </p>
@@ -557,7 +557,7 @@ export default async function Home({
             <h2 className="titulo text-sm font-semibold">Nas últimas 24h</h2>
             <p className={`mt-2 text-sm ${muted}`}>{vinte4h}</p>
             <p className="mt-3 text-sm">
-              <Link href="/eventos" className={link}>
+              <Link href="/eventos" className={`inline-flex min-h-6 items-center ${link}`}>
                 Ver a atividade →
               </Link>
             </p>
```

```bash
S="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/e078f16e-47b2-4e08-86f3-8036d4155715/scratchpad"
C="$S/x"; N="$S/next"; K="$S/celular"
cd "$C" || exit 1
test "$(git branch --show-current)" = celular-1 || { echo "não é o ramo da execução: pare"; exit 1; }
test -z "$(git status --porcelain)" || { echo "a árvore não está limpa: pare"; exit 1; }
node -e 'const a=Object.entries(process.env).filter(([k,v])=>/^postgres(ql)?:\/\//i.test(v||"")).map(([k])=>k); if(a.length){console.log("variável com URL de banco:",a.join(", "),": pare");process.exit(1)} console.log("nenhuma variável com URL de banco")' || exit 1
node "$K/f4/aplicar-f4.mjs" "$C" || { echo "o aplicar parou: pare"; exit 1; }
test "$(git hash-object app/app-shell.tsx)" = e294fd809da4a81e7ee487c81457de6175a433a8 || { echo "a casca não é a do ensaio: pare"; exit 1; }
test "$(git hash-object app/page.tsx)" = 5a581effd844dc527e6623f480c7a028f3b84610 || { echo "o Início não é o do ensaio: pare"; exit 1; }
test "$(git hash-object app/eventos/page.tsx)" = c930b4b671f9209587695dbad2a1f257e045b7f0 || { echo "a Atividade não é a do ensaio: pare"; exit 1; }
echo "os três blobs: iguais aos do ensaio"
node "$N/varrer-texto.mjs" app/app-shell.tsx app/page.tsx app/eventos/page.tsx
npm run typecheck > "$K/exec-f4-tsc.log" 2>&1; echo "typecheck: $?"
npm run lint > "$K/exec-f4-lint.log" 2>&1; echo "lint: $?"
env -u CLAUDECODE -u AI_AGENT npm run build > "$K/exec-f4-build.log" 2>&1; echo "build: $?"
for r in '.min-h-11' '.lg\:min-h-\[auto\]' '.min-h-6' '.p-3' '.max-w-28' '.sm\:max-w-none' '.sm\:whitespace-nowrap' '.sm\:px-3' '.py-1'; do
  echo "$r: $(cat .next/static/chunks/*.css .next/static/css/*.css 2>/dev/null | grep -o -F "$r{" | wc -l)"
done
npm test > "$K/exec-f4-puros.log" 2>&1; echo "puros: $?"; sed 's/\x1b\[[0-9;]*m//g' "$K/exec-f4-puros.log" | grep -n -E "^\s*(Test Files|Tests)\s"
npm run test:dom > "$K/exec-f4-tela.log" 2>&1; echo "tela: $?"; sed 's/\x1b\[[0-9;]*m//g' "$K/exec-f4-tela.log" | grep -n -E "^\s*(Test Files|Tests)\s"
git diff --stat -- AGENTS.md tsconfig.json; echo "(diff do AGENTS.md e do tsconfig.json acima; vazio = intocados)"
node "$K/guarda-celular-1.mjs" "$C"; echo "guarda: $?"
```

Esperado: "app/app-shell.tsx: 3 troca(s), de 391 para 391 linhas (CRLF)", "app/page.tsx: 3 troca(s), de 569 para 569
linhas (CRLF)", "app/eventos/page.tsx: 8 troca(s), de 443 para 443 linhas (CRLF)" e "GRAVADO: a F4."; os três blobs
iguais; os três "limpo … (CRLF)"; o typecheck, o lint e o build com 0; cada uma das nove regras com 1; os puros com
166 e 3 904 e os de tela com 36 e 350, iguais aos da F3 (nenhum teste olha estas classes); o diff do `AGENTS.md` e do
`tsconfig.json` vazio; a guarda com 0. Depois, à parte:

```bash
cd "C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/e078f16e-47b2-4e08-86f3-8036d4155715/scratchpad/x" || exit 1
test "$(git branch --show-current)" = celular-1 && git add app/app-shell.tsx app/page.tsx app/eventos/page.tsx && git commit -m "No celular, o menu e os links do Início ficam do tamanho do dedo, e a tabela da Atividade cabe na tela"
git show HEAD | git patch-id --stable
```

Esperado: o patch-id `b22dc81b546ea0409d47cf3dbe7aaa754e9d5480`.

## F5: a tela de abertura (o commit que repete o `e946b1c`)

```diff
diff --git a/app/manifest.ts b/app/manifest.ts
index 10dc293..3548891 100644
--- a/app/manifest.ts
+++ b/app/manifest.ts
@@ -1,5 +1,5 @@
 import type { MetadataRoute } from "next";
-import { COR_DO_PAPEL, COR_DO_PAPEL_ESCURO, DESCRICAO_DO_PAINEL, NOME_DO_PAINEL } from "@/lib/marca";
+import { COR_DO_PAPEL_ESCURO, DESCRICAO_DO_PAINEL, NOME_DO_PAINEL } from "@/lib/marca";
 
 // O MANIFESTO DO CELULAR (docs/specs/2026-11-24-celular-onda-1.md). É ele que deixa pôr o painel na tela inicial
 // e abri-lo sem a barra do navegador (o `display: "standalone"`). O Next o serve em /manifest.webmanifest
@@ -15,7 +15,9 @@ export default function manifest(): MetadataRoute.Manifest {
     lang: "pt-BR",
     start_url: "/",
     display: "standalone",
-    background_color: COR_DO_PAPEL,
+    // A TELA DE ABERTURA DO ANDROID (o fundo atrás do ícone) e a barra ficam no preto do ícone, pela decisão do
+    // Victor de 25/11 (docs/specs/2026-11-24-celular-onda-1.md). No iPhone, essa tela não aparece.
+    background_color: COR_DO_PAPEL_ESCURO,
     theme_color: COR_DO_PAPEL_ESCURO,
     // OS ÍCONES DA TELA INICIAL são os de 192 e 512 do app/icon.tsx (os lados de lib/desenho-do-icone.tsx). O de
     // 512 vale também como "maskable": o desenho fica nos 80% do meio, e o Android pode recortá-lo em círculo.
diff --git a/docs/specs/2026-11-24-celular-onda-1.md b/docs/specs/2026-11-24-celular-onda-1.md
index e9dc351..9855b8a 100644
--- a/docs/specs/2026-11-24-celular-onda-1.md
+++ b/docs/specs/2026-11-24-celular-onda-1.md
@@ -34,6 +34,8 @@ traz as cores do ícone que o Victor escolheu depois de vê-lo.
   - o ponto do "M.": "Ponto azul claro (Recomendado)", o `#78bacd` (`--color-acao-escuro`, `:104`). A alternativa
     era o ponto claro, igual ao "M".
   - O "M" continua em papel `#fbfaf8`.
+- **A tela de abertura do Android:** "Preto, igual ao ícone (Recomendado)", o `#0b0a0e`. A alternativa era o fundo
+  claro. O custo: quem usa o tema claro vê a abertura preta virar o painel claro. No iPhone, essa tela não aparece.
 
 ---
 
@@ -200,7 +202,7 @@ Em 390 px de largura, em cada rota da onda 1:
   - `lang`: `pt-BR`;
   - `start_url`: `/`;
   - `display`: `standalone`;
-  - `background_color`: `#fbfaf8`;
+  - `background_color`: `#0b0a0e`;
   - `theme_color`: `#0b0a0e`;
   - `icons`: o de 192 e o de 512, com os endereços medidos no build. O de 512 entra também com o
     `purpose: "maskable"`.
diff --git a/tests/manifesto.test.ts b/tests/manifesto.test.ts
index 9c1f25a..3ce19c9 100644
--- a/tests/manifesto.test.ts
+++ b/tests/manifesto.test.ts
@@ -40,7 +40,7 @@ describe("o manifesto do celular", () => {
     expect(m.lang).toBe("pt-BR");
     expect(m.start_url).toBe("/");
     expect(m.display).toBe("standalone");
-    expect(m.background_color).toBe("#fbfaf8");
+    expect(m.background_color).toBe("#0b0a0e");
     expect(m.theme_color).toBe("#0b0a0e");
     expect(m.description).toBe(DESCRICAO_DO_PAINEL);
   });
```

**O vermelho:** o teste do manifesto passa a esperar a abertura preta.

```bash
S="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/e078f16e-47b2-4e08-86f3-8036d4155715/scratchpad"
C="$S/x"; K="$S/celular"
cd "$C" || exit 1
test "$(git branch --show-current)" = celular-1 || { echo "não é o ramo da execução: pare"; exit 1; }
test -z "$(git status --porcelain)" || { echo "a árvore não está limpa: pare"; exit 1; }
node "$K/f5/aplicar-abertura.mjs" "$C" teste || { echo "o aplicar parou: pare"; exit 1; }
npx --no-install vitest run tests/manifesto.test.ts > "$K/exec-f5-vermelho.log" 2>&1; echo "vitest: $?"
sed 's/\x1b\[[0-9;]*m//g' "$K/exec-f5-vermelho.log" | grep -n -E "^\s*(Test Files|Tests)\s|AssertionError"
node "$K/guarda-celular-1.mjs" "$C"; echo "guarda: $?"
```

Esperado: "tests/manifesto.test.ts: 1 troca(s), de 67 para 67 linhas (LF)" e "GRAVADO: a abertura, no modo teste.";
"vitest: 1", com "expected '#fbfaf8' to be '#0b0a0e'" e "1 failed | 2 passed (3)"; a guarda com 0. O vermelho do
ensaio, sem os códigos de cor:

```text
(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.

 RUN  v4.1.12 C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/e078f16e-47b2-4e08-86f3-8036d4155715/scratchpad/m

 ❯ tests/manifesto.test.ts (3 tests | 1 failed) 37ms
     × abre o painel sem a barra do navegador, no endereço de início, com o nome e as cores da marca 9ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  tests/manifesto.test.ts > o manifesto do celular > abre o painel sem a barra do navegador, no endereço de início, com o nome e as cores da marca
AssertionError: expected '#fbfaf8' to be '#0b0a0e' // Object.is equality

Expected: "#0b0a0e"
Received: "#fbfaf8"

 ❯ tests/manifesto.test.ts:43:32
     41|     expect(m.start_url).toBe("/");
     42|     expect(m.display).toBe("standalone");
     43|     expect(m.background_color).toBe("#0b0a0e");
       |                                ^
     44|     expect(m.theme_color).toBe("#0b0a0e");
     45|     expect(m.description).toBe(DESCRICAO_DO_PAINEL);

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯


 Test Files  1 failed (1)
      Tests  1 failed | 2 passed (3)
   Start at  12:07:27
   Duration  1.20s (transform 193ms, setup 0ms, import 545ms, tests 37ms, environment 0ms)

```

**O verde:** o manifesto e a spec.

```bash
S="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/e078f16e-47b2-4e08-86f3-8036d4155715/scratchpad"
C="$S/x"; N="$S/next"; K="$S/celular"
cd "$C" || exit 1
test "$(git branch --show-current)" = celular-1 || { echo "não é o ramo da execução: pare"; exit 1; }
node -e 'const a=Object.entries(process.env).filter(([k,v])=>/^postgres(ql)?:\/\//i.test(v||"")).map(([k])=>k); if(a.length){console.log("variável com URL de banco:",a.join(", "),": pare");process.exit(1)} console.log("nenhuma variável com URL de banco")' || exit 1
node "$K/f5/aplicar-abertura.mjs" "$C" codigo || { echo "o aplicar parou: pare"; exit 1; }
test "$(git hash-object app/manifest.ts)" = 3548891d8a7fbda512fdb9f92a843c120fdcd848 || { echo "o manifesto não é o do ensaio: pare"; exit 1; }
test "$(git hash-object docs/specs/2026-11-24-celular-onda-1.md)" = 9855b8af4fd0d4af236762f487cf83f5823d2765 || { echo "a spec não é a do ensaio: pare"; exit 1; }
test "$(git hash-object tests/manifesto.test.ts)" = 3ce19c919f12568eb5d2a08c0e61ab011d003b75 || { echo "o teste não é o do ensaio: pare"; exit 1; }
echo "os três blobs: iguais aos do ensaio"
node "$N/varrer-texto.mjs" app/manifest.ts docs/specs/2026-11-24-celular-onda-1.md tests/manifesto.test.ts
npx --no-install vitest run tests/manifesto.test.ts > "$K/exec-f5-verde.log" 2>&1; echo "vitest do manifesto: $?"
npm run typecheck > "$K/exec-f5-tsc.log" 2>&1; echo "typecheck: $?"
npm run lint > "$K/exec-f5-lint.log" 2>&1; echo "lint: $?"
env -u CLAUDECODE -u AI_AGENT npm run build > "$K/exec-f5-build.log" 2>&1; echo "build: $?"
cat .next/server/app/manifest.webmanifest.body; echo
npm test > "$K/exec-f5-puros.log" 2>&1; echo "puros: $?"; sed 's/\x1b\[[0-9;]*m//g' "$K/exec-f5-puros.log" | grep -n -E "^\s*(Test Files|Tests)\s"
npm run test:dom > "$K/exec-f5-tela.log" 2>&1; echo "tela: $?"; sed 's/\x1b\[[0-9;]*m//g' "$K/exec-f5-tela.log" | grep -n -E "^\s*(Test Files|Tests)\s"
git diff --stat -- AGENTS.md tsconfig.json; echo "(diff do AGENTS.md e do tsconfig.json acima; vazio = intocados)"
node "$K/guarda-celular-1.mjs" "$C"; echo "guarda: $?"
```

Esperado:
- "app/manifest.ts: 2 troca(s), de 28 para 30 linhas (LF)", "docs/specs/2026-11-24-celular-onda-1.md: 2 troca(s), de
  365 para 367 linhas (LF)" e "GRAVADO: a abertura, no modo codigo.". No ensaio, o manifesto saiu em CRLF, porque lá
  as mutações rodaram antes da F5 e o `git checkout --` delas devolveu o arquivo em CRLF. Aqui a F5 vem antes, e o
  arquivo ainda está como o extrair gravou, em LF. O blob é o mesmo;
- os três blobs iguais; os três "limpo";
- o manifesto (3 casos), o typecheck, o lint e o build com 0;
- o manifesto gerado com `"background_color":"#0b0a0e"` e `"theme_color":"#0b0a0e"`;
- os puros com 166 e 3 904; os de tela com 36 e 350;
- o diff do `AGENTS.md` e do `tsconfig.json` vazio;
- a guarda com os 17 "dentro" (os 16 do ensaio e o plano), "proxy.ts: PUBLIC_PREFIXES igual à base", "proxy.ts: o matcher igual à base",
  "app/favicon.ico: apagado", "next.config.ts: só o redirect do favicon, com os comentários dele" e 0.

Depois, à parte:

```bash
cd "C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/e078f16e-47b2-4e08-86f3-8036d4155715/scratchpad/x" || exit 1
test "$(git branch --show-current)" = celular-1 && git add app/manifest.ts docs/specs/2026-11-24-celular-onda-1.md tests/manifesto.test.ts && git commit -m "A tela de abertura do celular passa ao preto do ícone, e a spec registra a decisão"
git show HEAD | git patch-id --stable
```

Esperado: o patch-id `6caafcb7a145cf59e36e70f51def063419962738`.

## As mutações, sobre o estado final

As mesmas 6 do ensaio (o apêndice B), agora com a F5. Nenhuma delas toca as linhas que a F5 muda: as trocas da 4 e da
5 são o `display` e o `description` do manifesto, iguais antes e depois da F5. Cada mutação volta pelo `git checkout
--`, que regrava o arquivo em CRLF; o status continua vazio.

```bash
S="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/e078f16e-47b2-4e08-86f3-8036d4155715/scratchpad"
C="$S/x"; K="$S/celular"
cd "$C" || exit 1
test "$(git branch --show-current)" = celular-1 || { echo "não é o ramo da execução: pare"; exit 1; }
test "$(git show HEAD | git patch-id --stable | cut -d' ' -f1)" = 6caafcb7a145cf59e36e70f51def063419962738 || { echo "o HEAD não é a F5 do ensaio: pare"; exit 1; }
test -z "$(git status --porcelain)" || { echo "a árvore não está limpa: pare"; exit 1; }
node "$K/mutar-celular-1.mjs" "$C" > "$K/exec-mutacoes.log" 2>&1; echo "mutar: $?"
cat "$K/exec-mutacoes.log"
git status --porcelain; echo "(status acima; vazio = limpo)"
```

Esperado: o mesmo do apêndice B: as 6 caindo nos mesmos casos, "vitest: 0; Test Files  3 passed (3) | Tests  20
passed (20)" na árvore limpa, "FIM: 6 de 6 mutações caíram.", "mutar: 0" e o status vazio.

## O verify inteiro

O build roda o `scripts/migrar.mjs --aplicar`. Na cópia, com o `.env.local` vazio e sem `VERCEL_ENV`, ele escreve
"MIGRAÇÃO PULADA" e sai sem abrir conexão com o banco. O `next build` roda sem as variáveis de agente, porque o Next
pode reescrever o bloco do `AGENTS.md`. Passa de 5 minutos: roda em segundo plano de propósito.

```bash
S="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/e078f16e-47b2-4e08-86f3-8036d4155715/scratchpad"
C="$S/x"; K="$S/celular"
cd "$C" || exit 1
test "$(git branch --show-current)" = celular-1 || { echo "não é o ramo da execução: pare"; exit 1; }
test -z "$(git status --porcelain)" || { echo "a árvore não está limpa: pare"; exit 1; }
node -e 'const a=Object.entries(process.env).filter(([k,v])=>/^postgres(ql)?:\/\//i.test(v||"")).map(([k])=>k); if(a.length){console.log("variável com URL de banco:",a.join(", "),": pare");process.exit(1)} console.log("nenhuma variável com URL de banco")' || exit 1
env -u CLAUDECODE -u AI_AGENT npm run verify > "$K/exec-verify.log" 2>&1; echo "verify: $?"
sed 's/\x1b\[[0-9;]*m//g' "$K/exec-verify.log" | grep -n -E "Next\.js 16\.4\.[0-9]+|MIGRAÇÃO PULADA|^\s*(Test Files|Tests)\s|VAZAMENTOS|static pages using 3 workers \(21|Proxy"
git diff --stat -- AGENTS.md tsconfig.json; echo "(diff do AGENTS.md e do tsconfig.json acima; vazio = intocados)"
git status --porcelain; echo "(status acima; vazio = limpo)"
node "$K/guarda-celular-1.mjs" "$C"; echo "guarda: $?"
```

Esperado: "verify: 0"; os puros com 166 e 3 904, os de tela com 36 e 350, os quatro "VAZAMENTOS: 0", "MIGRAÇÃO
PULADA", "Next.js 16.4.6", as 21 páginas ("(21/21)") e o "ƒ Proxy (Middleware)"; o `AGENTS.md` e o `tsconfig.json`
intocados; o status vazio; a guarda com 0.

## A integração, com o Docker Desktop aberto pelo Victor

Roda em segundo plano de propósito, e uma vez só, sobre o estado final. Se um caso cair, nada se repete sem um novo
"pode", nem o da 012 (o 248). Nunca rode a integração sem a `DATABASE_URL_TESTES`: sem ela, a suíte cai na
`DATABASE_URL`, que é a produção. A suíte imprime "Rode sem DATABASE_URL_TESTES antes do merge", e essa dica NÃO vale
aqui (o `COMECE-AQUI.md`, seção 4).

```bash
S="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/e078f16e-47b2-4e08-86f3-8036d4155715/scratchpad"
C="$S/x"; K="$S/celular"
cd "$C" || exit 1
test "$(git branch --show-current)" = celular-1 || { echo "não é o ramo da execução: pare"; exit 1; }
node -e 'const a=Object.entries(process.env).filter(([k,v])=>/^postgres(ql)?:\/\//i.test(v||"")).map(([k])=>k); if(a.length){console.log("variável com URL de banco:",a.join(", "),": pare");process.exit(1)} console.log("nenhuma variável com URL de banco")' || exit 1
docker ps -a --filter name=metodochat-banco-de-teste --format '{{.Names}} | {{.Status}} | projeto={{.Label "com.docker.compose.project"}}'; echo "(acima: o que já existe com o nome; vazio = nada)"
test -z "$(docker ps -a --filter name=^metodochat-banco-de-teste$ --format '{{.Names}}')" || { echo "já existe um container com o nome: pare"; exit 1; }
npm run banco:teste || { echo "o banco:teste falhou: pare"; exit 1; }
docker ps --filter name=^metodochat-banco-de-teste$ --format '{{.Names}} | {{.Status}} | projeto={{.Label "com.docker.compose.project"}}'
DATABASE_URL_TESTES=postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes npm run test:integracao > "$K/exec-integracao.log" 2>&1; echo "integração: $?"
grep -n -E "rede-global|Test Files|Tests  " "$K/exec-integracao.log"
grep -n -E "FAIL|✗|×" "$K/exec-integracao.log" | head -20; echo "(falhas acima; vazio = nenhuma)"
echo "linhas com 5432 ou 54322: $(grep -c -E '5432[^0-9]|5432$|54322' "$K/exec-integracao.log")"
npm run banco:teste:parar; echo "banco:teste:parar: $?"
docker ps -a --filter name=^metodochat-banco-de-teste$ --format '{{.Names}}'; echo "(vazio = removido)"
```

Esperado: "nenhuma variável com URL de banco"; nada com o nome antes; o container "healthy", com `projeto=x`;
"integração: 0"; "[rede-global] ALVO: banco de TESTE"; 80 arquivos, 1 018 casos e 8 pulados; nenhuma falha; 0 linhas
com as portas dos outros projetos; o container removido no fim. Os containers dos outros projetos não são tocados.

## O envio: o push, a prévia, a prova, o PR e o merge

No molde dos PRs #41 e #42, com as lições deles: a leitura da produção pela Vercel (o 308), a mensagem do merge igual
ao título do PR (o 305), o e-mail do merge (o 318 e o 333) e as duas leituras da primeira hora com hora certa (o 306).
A auditoria só usa ferramentas de leitura do conector: nunca promover, voltar, mexer em variável ou gravar qualquer
coisa.

**Envio 1: a conferência antes do push.** Repetida, igual, antes do PR (Envio 4) e antes da caixa do merge (Envio 5).

```bash
cd "C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/e078f16e-47b2-4e08-86f3-8036d4155715/scratchpad/x" || exit 1
git fetch origin
test "$(git rev-parse origin/main)" = aadf56683b24ddcc742f773c48f3ed27e2b3954f && echo "origin/main em aadf566"
test "$(git branch --show-current)" = celular-1 && echo "no ramo certo"
git log --oneline aadf566..HEAD                            # 10 commits: a spec, o plano e os oito das fases
git log --format='%an' aadf566..HEAD | sort -u             # só Victor Souza
git log --format='%ae' aadf566..HEAD | sed 's/^.*@//' | sort -u   # só users.noreply.github.com
git log --format=%B aadf566..HEAD | grep -ci "co-authored" # 0
git status --porcelain; echo "(status acima; vazio = limpo)"
```

Se qualquer linha divergir, pare.

**Envio 2: o push do ramo,** com o OK do Victor pela caixa.

```bash
cd "C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/e078f16e-47b2-4e08-86f3-8036d4155715/scratchpad/x" || exit 1
test -z "$(git ls-remote origin refs/heads/celular-1)" || { echo "o ramo já existe no remoto: pare"; exit 1; }
test "$(git branch --show-current)" = celular-1 && git push -u origin refs/heads/celular-1:refs/heads/celular-1
```

**Envio 3: a prévia e a prova.** A Vercel monta uma prévia do ramo. A prévia grava na produção (o login grava a
sessão), então vale a ordem: a caixa do Victor, a hora mandada à auditoria e o "pode" dela. O "pode começar" vai ao
Victor em texto, e a caixa do resultado só depois de ele dizer que terminou (o 328).

**A proteção da Vercel na prévia (o 356).** O projeto tem o login da Vercel ligado para tudo, menos os domínios
próprios (medido pela auditoria no `get_project`: `ssoProtection` com `deploymentType` "all_except_custom_domains"). O
domínio de produção não tem essa proteção, mas a prévia tem: um pedido sem o login da Vercel recebe o 401 da Vercel, e
não a resposta do app, e tirar só o cookie do app da aba não muda isso. Por isso, o "sem sessão" (o manifesto e os
ícones abertos sem login, e o `/icon-qualquer-coisa` indo para o `/entrar`) não se mede na prévia: ele está provado
pelo `tests/proxy-icone.test.ts` e é medido na produção, sem cookie, no Envio 6. Um 401 da Vercel na prévia não é
defeito do app.

1. **O build da prévia,** lido pela auditoria pelo conector: o commit da F5; "Detected Next.js version: 16.4.6";
   "MIGRAÇÃO PULADA"; nenhuma linha de nível error.
2. **A medição da auditoria,** no navegador do Victor, numa aba nova em 390x844, com a caixa dele, só lendo e sem
   telemetria (`BH_TELEMETRY=0`, `BH_RECORD=0` e `BH_TAB_MARKER=0`):
   - em cada rota medida, um quadro forçado antes de medir, com a contagem das partes pendentes. Uma rota com parte
     pendente não vale (o 345);
   - nas rotas da onda 1 (o Início, o Desempenho e a Atividade; e, sem mudança neste PR, as de Publicações e
     Automações): a página não rola de lado; a tabela da Atividade cabe na caixa dela; o "Abrir menu", o "Fechar
     menu" e os 12 links da gaveta com 44 px; o "Reconectar", o "Criar post →", o "Ver a atividade →" e o "Ver
     detalhes técnicos" com pelo menos 24 px;
   - nenhum erro do app no console; os de extensão (`chrome-extension://`) ficam fora da conta (o 346);
   - o Remarcar e o "Cancelar este post" num post pendente da conta de provas, se houver um. Eles são do PR 2, e aqui
     só se registra o tamanho de hoje;
   - no navegador do Victor, com a sessão dele: o `/manifest.webmanifest` com 200 e `application/manifest+json`; o
     `/icon/32`, o `/icon/192`, o `/icon/512` e o `/apple-icon` com 200 e `image/png` (são endereços públicos: a
     resposta é a mesma com e sem a sessão); e o `/favicon.ico` com 307 para o `/icon/32`;
   - o `<head>` com o `<link rel="manifest">`, os `<link rel="icon">` dos três tamanhos, o `<link
     rel="apple-touch-icon">`, o `<meta name="theme-color">` com `#0b0a0e` e o `apple-mobile-web-app-title`
     "MetodoChat".
   Os registros com dado de cliente (fotos e o JSON) ficam só na máquina e são apagados depois do relatório.
3. **O Victor instala o ícone no iPhone,** pelo Safari, em "Adicionar à Tela de Início", a partir da prévia, e conta
   como o ícone ficou (o fundo preto, o "M" claro e o ponto azul claro) e se o app abre sem a barra do navegador. Ele
   só tenta a instalação na prévia se o Safari do iPhone JÁ abrir a prévia sem pedir o login da Vercel. Se pedir, ele
   não entra na Vercel pelo iPhone (seria mais uma conta logada no celular só para isso), e a prova do iPhone vai
   direto para a produção, no Envio 6. Na prévia, o Next põe `crossOrigin="use-credentials"` no
   `<link rel="manifest">` quando o `VERCEL_ENV` é `preview`
   (`node_modules/next/dist/lib/metadata/metadata-elements.js:140`), e o manifesto vai com o login da Vercel; os
   ícones que o iPhone busca sozinho não têm essa garantia. **Se o ícone da tela inicial sair como uma foto da página,
   ou se o iPhone pedir login, a prova fica inconclusiva, e não reprovada:** ela se repete na produção, depois do
   merge (o Envio 6), no domínio sem a proteção. O Android fica sem prova.

**Envio 4: o PR,** com o OK do Victor pela caixa.
- O corpo do PR, em `$K/pr-corpo.md`, é escrito depois da execução, com os números medidos, e vai à auditoria com o
  sha256 antes da caixa. Ele explica o porquê, e não tem arroba solta, nem e-mail, nem conta, nem rodapé de IA, nem
  `Co-Authored-By`.
- **O título do PR é a mensagem do merge** (o 305): "O painel vai para a tela inicial do celular, com o ícone \"M.\", e
  o menu, o Início e a Atividade passam a caber na tela". A caixa do PR mostra o título como a mensagem que vai ao
  merge.
- A conferência do Envio 1, de novo. Depois:

```bash
S="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/e078f16e-47b2-4e08-86f3-8036d4155715/scratchpad"
cd "$S/x" || exit 1
gh pr create --base main --head celular-1 --title "O painel vai para a tela inicial do celular, com o ícone \"M.\", e o menu, o Início e a Atividade passam a caber na tela" --body-file "$S/celular/pr-corpo.md"
```

**Envio 5: antes do merge.** O merge publica na produção (a `main` faz o deploy), então vale a ordem: a caixa do
Victor, a hora mandada à auditoria e o "pode" dela.
1. A conferência do Envio 1, de novo.
2. O commit provado é o que vai ao merge:

```bash
cd "C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/e078f16e-47b2-4e08-86f3-8036d4155715/scratchpad/x" || exit 1
git rev-parse HEAD                                        # o commit provado
git ls-remote origin refs/heads/celular-1 | cut -f1       # o mesmo
gh pr view celular-1 --json headRefOid --jq .headRefOid   # o mesmo
```

   Se os três não forem o mesmo commit, pare.
3. **A caixa do merge**, com o essencial dentro: a mensagem do merge é o título do PR; o Victor confere, em
   github.com/settings/emails, que o "Keep my email addresses private" continua ligado (o 333); e, se a tela do merge
   mostrar um seletor de e-mail, ele escolhe o que termina em `@users.noreply.github.com` (o 318).
4. A hora mandada à auditoria.
5. **A linha de base, pela Vercel** (a regra do 308): o `list_deployments` de produção (o último READY, na `aadf566`,
   e nenhum build em andamento); o log do build desse deploy, para comparar com o do merge; e o `get_runtime_errors` e
   o `get_runtime_logs` com nível error/fatal, desde 30 min antes.
6. O "pode" da auditoria. O merge é do Victor, no GitHub. A caixa seguinte é de resultado, depois de ele dizer que
   terminou: sem "(Recomendado)" e com "Não fiz / não lembro". Nela, o Victor diz também se apareceu o seletor de
   e-mail e o que escolheu.

**Envio 6: o deploy do merge,** lido pela auditoria pelo conector:
- o deploy novo de produção READY, no sha do merge;
- no log do build: o commit do merge; "Detected Next.js version: 16.4.6"; "Nada a aplicar: as 26 migrações já constam
  no registro."; as mesmas linhas de conferência do esquema do log da linha de base; e nenhuma linha de nível error;
- o DEV confere, só lendo, no domínio de produção e sem cookie (é aqui que o "sem sessão" se mede, o 356): o `/entrar`
  dá 200; o cron sem senha (`/api/cron/daily`) dá 401; o `/manifest.webmanifest` dá 200 com
  `application/manifest+json`; o `/icon/32`, o `/icon/192`, o `/icon/512` e o `/apple-icon` dão 200 com `image/png`; o
  `/favicon.ico` dá 307 para o `/icon/32`; e o `/icon-qualquer-coisa` vai para o `/entrar`;
- se a prova do iPhone não foi feita na prévia (o Safari pediu o login da Vercel) ou ficou inconclusiva (o Envio 3), o
  Victor a faz agora, a partir do domínio de produção, e a caixa de resultado vem depois de ele dizer que terminou;
- o DEV confere que o merge não tem e-mail pessoal: `git log -1 --format='%ae %ce' <sha do merge> | sed 's/[^ ]*@/@/g'`
  mostra só domínios do GitHub (`@users.noreply.github.com` ou `@github.com`), e nenhum outro;
- se o deploy der erro, nada novo vai à `main`, e o caso vai à caixa, com o log.

**Envio 7: a primeira hora (a regra do 306).**
- O DEV anota as duas horas, contadas do READY do deploy novo: +15 min e +50 min. Em cada uma, a auditoria lê o
  `get_runtime_errors` e o `get_runtime_logs` (nível error/fatal), e o DEV cobra a leitura dela. As duas horas vão ao
  relatório.
- Se a sessão da auditoria cair, o DEV avisa o Victor antes de a janela de uma hora fechar.
- Passa com zero, ou só com o que já estava na linha de base. Se divergir, pare e avise. O caminho de volta é
  promover de novo o deploy da `aadf566`. Isso grava na produção: só com a caixa do Victor, e quem promove é o Victor,
  ou o DEV com o "pode" da auditoria.

**Envio 8: a limpeza,** com o OK do Victor pela caixa, depois da primeira hora fechada. Um bloco só, que para no
primeiro desvio, sem `--force`, com o sha inteiro em cada trava (o 334):
- as duas worktrees, a do ensaio (`$S/m`) e a da execução (`$S/x`), ambas com `node_modules` e `.next`: antes de cada
  `git worktree remove`, o maior caminho é medido, e acima de 259 caracteres a pasta é renomeada para um caminho mais
  curto (o 307);
- os ramos locais `ensaio-celular-1` (com `-D`, depois de conferir que está no `e946b1c`) e `celular-1` (com `-d`,
  porque está inteiro na `main`);
- o ramo `celular-1` no remoto, se o GitHub não o apagar no merge, depois de conferir o sha dele;
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

<!-- bloco: guarda-celular-1.mjs -->
```js
// O celular, PR 1 (docs/specs/2026-11-24-celular-onda-1.md): a guarda do diff. Só lê. Na cópia dada (a do ensaio
// ou a da execução), contra a aadf566, confere:
//   1. que só os caminhos previstos pela spec para o PR 1 estão alterados, novos ou apagados;
//   2. no proxy.ts: que a lista PUBLIC_PREFIXES e o bloco do matcher (`export const config`) continuam IGUAIS aos da
//      base, porque a spec só acrescenta a lista nova PUBLIC_EXATOS ("O matcher não muda");
//   3. que o app/favicon.ico, se mudou, foi APAGADO, e não trocado (a opção 1 da spec);
//   4. no next.config.ts: que nenhuma linha da base saiu, e que toda linha posta é comentário ou a linha do redirect
//      do /favicon.ico para o /icon/32 (a emenda da spec, o achado 352).
// Os arquivos da cópia são lidos com o CRLF trocado por LF, porque a base sai do git em LF.
// Uso: node guarda-celular-1.mjs <raiz-da-copia>   (sai com 0 se tudo está dentro; com 1 e o que está fora)
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const raiz = process.argv[2];
if (!raiz) {
  console.log("uso: node guarda-celular-1.mjs <raiz-da-copia>");
  process.exit(1);
}
const BASE = "aadf566";
const PREVISTOS = new Set([
  "docs/specs/2026-11-24-celular-onda-1.md",
  "docs/plans/2026-11-25-celular-onda-1-pr1.md",
  "lib/marca.ts",
  "lib/desenho-do-icone.tsx",
  "app/manifest.ts",
  "app/icon.tsx",
  "app/apple-icon.tsx",
  "app/favicon.ico",
  "app/layout.tsx",
  "proxy.ts",
  "tests/manifesto.test.ts",
  "tests/proxy-icone.test.ts",
  "next.config.ts",
  "tests/favicon.test.ts",
  "app/app-shell.tsx",
  "app/page.tsx",
  "app/eventos/page.tsx",
]);

const git = (...args) => execFileSync("git", args, { cwd: raiz, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const naBase = (p) => git("show", `${BASE}:${p}`);
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

// 2. O proxy.ts: a lista de prefixos e o matcher ficam como na base.
const trecho = (texto, inicio, fim) => {
  const i = texto.indexOf(inicio);
  if (i < 0) return null;
  const j = texto.indexOf(fim, i);
  return j < 0 ? null : texto.slice(i, j + fim.length);
};
if (mudados.includes("proxy.ts")) {
  const base = naBase("proxy.ts");
  const copia = naCopia("proxy.ts");
  for (const [nome, inicio, fim] of [
    ["PUBLIC_PREFIXES", "const PUBLIC_PREFIXES = [", "];"],
    ["o matcher", "export const config = {", "};"],
  ]) {
    const a = trecho(base, inicio, fim);
    const b = trecho(copia, inicio, fim);
    if (a === null) acusar(`proxy.ts: a base não tem ${nome}: pare`);
    else if (a === b) console.log(`proxy.ts: ${nome} igual à base`);
    else acusar(`proxy.ts FORA: ${nome} mudou`);
  }
}

// 3. O favicon: só apagado.
if (mudados.includes("app/favicon.ico")) {
  if (existsSync(join(raiz, "app/favicon.ico"))) acusar("app/favicon.ico FORA: mudou, mas não foi apagado");
  else console.log("app/favicon.ico: apagado");
}

// 4. O next.config.ts: só linhas postas, e cada uma é comentário ou o redirect do favicon.
if (mudados.includes("next.config.ts")) {
  const REDIRECT = '{ source: "/favicon.ico", destination: "/icon/32", permanent: false },';
  const linhas = git("diff", "--no-renames", "-U0", BASE, "--", "next.config.ts")
    .split("\n")
    .filter((l) => /^[-+]/.test(l) && !/^(\+\+\+|---) /.test(l));
  const tiradas = linhas.filter((l) => l.startsWith("-"));
  const foraDoPrevisto = linhas.filter((l) => l.startsWith("+") && !/^\+\s*\/\//.test(l) && l.slice(1).trim() !== REDIRECT);
  const redirects = linhas.filter((l) => l.startsWith("+") && l.slice(1).trim() === REDIRECT).length;
  if (tiradas.length || foraDoPrevisto.length || redirects !== 1) {
    acusar(`next.config.ts FORA: ${tiradas.length} linhas tiradas, ${redirects} redirect(s) do favicon, e fora do previsto:`);
    for (const l of [...tiradas, ...foraDoPrevisto]) console.log(`  ${l}`);
  } else {
    console.log("next.config.ts: só o redirect do favicon, com os comentários dele");
  }
}

process.exit(fora);
```

<!-- bloco: f1/aplicar-layout.mjs -->
```js
// O celular, PR 1, F1: as trocas no app/layout.tsx previstas pela spec (docs/specs/2026-11-24-celular-onda-1.md, "O
// ícone e o manifesto"). O layout passa a tirar o título e a descrição de lib/marca.ts (o achado 343), ganha o
// `appleWebApp.title` e o `export const viewport` com a cor da barra.
// Confere cada trecho inteiro antes de trocar e, se um não for o esperado, para sem gravar nada. Mantém o fim de
// linha que o arquivo já tem (a cópia de trabalho sai em CRLF).
// Uso: node aplicar-layout.mjs <raiz-da-copia>
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const raiz = process.argv[2];
if (!raiz) {
  console.log("uso: node aplicar-layout.mjs <raiz-da-copia>");
  process.exit(1);
}
const parar = (motivo) => {
  console.log(`PARADO, NADA GRAVADO: ${motivo}`);
  process.exit(1);
};
const arquivo = join(raiz, "app/layout.tsx");
const original = readFileSync(arquivo, "utf8");
const fim = original.includes("\r\n") ? "\r\n" : "\n";
const texto = original.replace(/\r\n/g, "\n");
if (fim === "\r\n" && texto.includes("\r")) parar("o app/layout.tsx tem fim de linha misturado");

const TROCAS = [
  [
    "o import do tipo",
    'import type { Metadata } from "next";\n',
    'import type { Metadata, Viewport } from "next";\n',
  ],
  [
    "o import da marca",
    'import { sessaoAtual } from "@/lib/sessao";\n',
    'import { sessaoAtual } from "@/lib/sessao";\nimport { COR_DA_ACAO, DESCRICAO_DO_PAINEL, NOME_DO_PAINEL, TITULO_DO_PAINEL } from "@/lib/marca";\n',
  ],
  [
    "o metadata",
    'export const metadata: Metadata = {\n  title: "MetodoChat — comentário vira DM",\n  description: "Automação do seu Instagram: palavra-chave no comentário vira DM com seu link.",\n};\n',
    [
      "// O TÍTULO E A DESCRIÇÃO vêm de lib/marca.ts, a mesma fonte do manifesto do celular (o achado 343).",
      "//",
      "// O `appleWebApp.title` é o nome que o iPhone dá ao ícone na tela de início. O `capable` fica de fora: no",
      "// 16.4.6 ele escreve `mobile-web-app-capable` (node_modules/next/dist/lib/metadata/metadata-elements.js:446-452),",
      '// e quem abre o app sem a barra do navegador é o `display: "standalone"` do manifesto',
      "// (docs/specs/2026-11-24-celular-onda-1.md, o achado 339).",
      "export const metadata: Metadata = {",
      "  title: TITULO_DO_PAINEL,",
      "  description: DESCRICAO_DO_PAINEL,",
      "  appleWebApp: { title: NOME_DO_PAINEL },",
      "};",
      "",
      "// A COR DA BARRA DO CELULAR é a cor de ação do sistema (lib/marca.ts). O guia do Next a põe no `viewport`, e",
      "// não no `metadata` (node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-viewport.md:21-33",
      "// e :71-93).",
      "export const viewport: Viewport = {",
      "  themeColor: COR_DA_ACAO,",
      "};",
      "",
    ].join("\n"),
  ],
];

let novo = texto;
for (const [nome, antes] of TROCAS) {
  const vezes = novo.split(antes).length - 1;
  if (vezes !== 1) parar(`${nome}: o trecho esperado aparece ${vezes} vezes, e não 1`);
}
for (const [nome, antes, depois] of TROCAS) {
  novo = novo.replace(antes, depois);
  console.log(`app/layout.tsx: ${nome} trocado`);
}
writeFileSync(arquivo, fim === "\r\n" ? novo.replace(/\n/g, "\r\n") : novo);
const linhas = (t) => t.split("\n").length - 1;
console.log(`GRAVADO: 3 trocas no app/layout.tsx, que passa de ${linhas(texto)} para ${linhas(novo)} linhas (${fim === "\r\n" ? "CRLF" : "LF"}).`);
```

<!-- bloco: f2c/aplicar-emenda.mjs -->
```js
// O celular, PR 1, F2, c: a emenda da spec (docs/specs/2026-11-24-celular-onda-1.md), pelos achados 352 e 353 e
// pela decisão do Victor sobre as cores do ícone. O 404 do /favicon.ico vira um redirect para o /icon/32; o ensaio
// registra que o servidor local não sobe sem banco; os testes, as mutações e a prova ganham o redirect; e o fundo do
// ícone e a barra do celular passam ao preto do painel, com o ponto no azul claro. Confere cada trecho inteiro antes de trocar e, se um não for
// o esperado, para sem gravar nada. Mantém o fim de linha que o arquivo já tem.
// Uso: node aplicar-emenda.mjs <raiz-da-copia>
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const raiz = process.argv[2];
if (!raiz) {
  console.log("uso: node aplicar-emenda.mjs <raiz-da-copia>");
  process.exit(1);
}
const parar = (motivo) => {
  console.log(`PARADO, NADA GRAVADO: ${motivo}`);
  process.exit(1);
};
const arquivo = join(raiz, "docs/specs/2026-11-24-celular-onda-1.md");
const original = readFileSync(arquivo, "utf8");
const fim = original.includes("\r\n") ? "\r\n" : "\n";
const texto = original.replace(/\r\n/g, "\n");
if (texto.includes("\r")) parar("a spec tem fim de linha misturado");

const TROCAS = [
  [
    "o cabeçalho",
    "e as decisões que dependiam dela. **A v3, do mesmo dia,** traz a medição da tabela da Atividade antes do plano (o\nachado 349).\n",
    "e as decisões que dependiam dela. **A v3, do mesmo dia,** traz a medição da tabela da Atividade antes do plano (o\nachado 349). **A emenda do ensaio, também de 25/11,** troca o 404 do `/favicon.ico` por um redirect (o achado 352) e\ntraz as cores do ícone que o Victor escolheu depois de vê-lo.\n",
  ],
  [
    "a decisão das cores",
    '- **O celular da prova:** "iPhone".\n',
    [
      '- **O celular da prova:** "iPhone".',
      "- **As cores do ícone (mudança de decisão, depois de ver o ícone no azul):** \"Não gostei da forma que ficou, pode",
      '  deixar o fundo mais escuro, quase um preto", "ou da cor do background do método chat". Pela caixa:',
      '  - o fundo: "Fundo do painel, tema escuro (Recomendado)", o `#0b0a0e` (`--color-papel-escuro`,',
      "    `app/globals.css:58`). A alternativa era o `#17161a` (`--color-tinta`, `:65`);",
      '  - a barra do celular: "Acompanha o preto (Recomendado)". A alternativa era continuar no azul;',
      '  - o ponto do "M.": "Ponto azul claro (Recomendado)", o `#78bacd` (`--color-acao-escuro`, `:104`). A alternativa',
      '    era o ponto claro, igual ao "M".',
      '  - O "M" continua em papel `#fbfaf8`.',
      "",
    ].join("\n"),
  ],
  [
    "o desenho",
    "O fundo é quadrado e cheio em `#1a5a6c`, e o\n  \"M.\" com o ponto vai em `#fbfaf8`, centralizado e dentro dos 80% do meio",
    "O fundo é quadrado e cheio em `#0b0a0e`, o\n  \"M\" vai em `#fbfaf8` e o ponto em `#78bacd`, centralizados e dentro dos 80% do meio",
  ],
  [
    "o theme_color",
    "  - `theme_color`: `#1a5a6c`;\n",
    "  - `theme_color`: `#0b0a0e`;\n",
  ],
  [
    "o viewport",
    '  - ganha `export const viewport = { themeColor: "#1a5a6c" }`;\n',
    '  - ganha `export const viewport = { themeColor: "#0b0a0e" }`;\n',
  ],
  [
    "o favicon",
    [
      "    - O ensaio mede: o `/favicon.ico` passa a dar 404 sem ir para `/entrar`; o `<head>` traz o link do `/icon`; e a",
      '      aba mostra o "M.".',
      "    - O ensaio mede também se esse 404 é uma página estática ou se roda a função a cada pedido, porque o layout lê",
      "      cookies (`app/layout.tsx:97-98`) e não há `app/not-found.tsx` (o achado 341). A escolha só muda se aparecer um",
      "      custo.",
      "",
    ].join("\n"),
    [
      "    - O ensaio mediu o custo (os achados 341 e 352): no build, o `/_not-found` é dinâmico (ƒ), como já era antes",
      "      desta entrega, porque o layout lê cookies (`app/layout.tsx:97-98`). Sem o arquivo, cada pedido ao",
      "      `/favicon.ico` viraria uma chamada de função e, com o cookie da sessão, duas consultas ao banco (o",
      "      `sessaoAtual()` e o `contasDoLogin()`).",
      "    - **Por isso, o `/favicon.ico` leva ao ícone novo por um redirect no `next.config.ts`**, para o `/icon/32`, com",
      "      `permanent: false` (um 307, que não fica em cache: `redirects.md:30`). O redirect do `next.config` roda antes",
      "      do porteiro e antes dos arquivos (`proxy.md:242-245` e `redirects.md:39`, no guia da 16.4.6). O",
      "      `next.config.ts` já tem um redirect, o do `/loja` (`:24`).",
      "    - O servidor local não sobe sem um banco com o esquema (o `instrumentation.ts`, o achado 353). Por isso, o",
      "      `<head>`, os códigos sem sessão e o 307 do favicon se medem na prova na prévia.",
      "",
    ].join("\n"),
  ],
  [
    "o teste do favicon",
    "- **A lista do calendário (puro, novo):**",
    [
      "- **O favicon antigo (puro, novo):** o `redirects()` do `next.config.ts` leva o `/favicon.ico` ao `/icon/32`, com",
      "  `permanent: false`.",
      "- **A lista do calendário (puro, novo):**",
    ].join("\n"),
  ],
  [
    "as mutações",
    "  - trocar o `display` do manifesto;\n",
    "  - trocar o `display` do manifesto;\n  - escrever a descrição à mão no manifesto, sem a constante (o achado 343);\n  - tirar o redirect do favicon;\n",
  ],
  [
    "a prova",
    "- sem sessão: `/manifest.webmanifest` e os ícones dão 200, com o tipo certo; o `/favicon.ico` dá 404; e\n",
    "- sem sessão: `/manifest.webmanifest` e os ícones dão 200, com o tipo certo; o `/favicon.ico` dá 307 para o\n  `/icon/32`; e\n",
  ],
];

let novo = texto;
for (const [nome, antes] of TROCAS) {
  const vezes = novo.split(antes).length - 1;
  if (vezes !== 1) parar(`${nome}: o trecho esperado aparece ${vezes} vezes, e não 1`);
}
for (const [nome, antes, depois] of TROCAS) {
  novo = novo.replace(antes, depois);
  console.log(`a spec: ${nome} trocado`);
}
writeFileSync(arquivo, fim === "\r\n" ? novo.replace(/\n/g, "\r\n") : novo);
const linhas = (t) => t.split("\n").length - 1;
console.log(`GRAVADO: ${TROCAS.length} trocas na spec, que passa de ${linhas(texto)} para ${linhas(novo)} linhas (${fim === "\r\n" ? "CRLF" : "LF"}).`);
```

<!-- bloco: f2c/aplicar-cores.mjs -->
```js
// O celular, PR 1, F2, c: as cores do ícone e da barra do celular, pela decisão do Victor de 25/11, depois de ver o
// ícone no azul (a emenda da spec docs/specs/2026-11-24-celular-onda-1.md). O fundo do ícone e a barra passam ao
// preto do painel no tema escuro (#0b0a0e, --color-papel-escuro), e o ponto do "M." ao azul claro (#78bacd,
// --color-acao-escuro). O "M" continua em papel.
// Dois modos, para o teste vir antes do código:
//   teste   — só o tests/manifesto.test.ts passa a esperar o theme_color novo (o vermelho);
//   codigo  — a lib/marca.ts, o app/manifest.ts, o app/layout.tsx e a lib/desenho-do-icone.tsx (o verde).
// Confere cada trecho inteiro antes de trocar e, se um não for o esperado, para sem gravar NADA (nenhum arquivo).
// Mantém o fim de linha que cada arquivo já tem.
// Uso: node aplicar-cores.mjs <raiz-da-copia> <teste|codigo>
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [raiz, modo] = process.argv.slice(2);
if (!raiz || !["teste", "codigo"].includes(modo)) {
  console.log("uso: node aplicar-cores.mjs <raiz-da-copia> <teste|codigo>");
  process.exit(1);
}
const parar = (motivo) => {
  console.log(`PARADO, NADA GRAVADO: ${motivo}`);
  process.exit(1);
};

const TESTE = {
  "tests/manifesto.test.ts": [['    expect(m.theme_color).toBe("#1a5a6c");\n', '    expect(m.theme_color).toBe("#0b0a0e");\n']],
};

const CODIGO = {
  "lib/marca.ts": [
    [
      [
        "// AS DUAS CORES SÃO AS DO SISTEMA (app/globals.css): o papel (`--color-papel`, :54) e a ação (`--color-acao`,",
        "// :102). O manifesto e a barra do celular não leem o CSS, então os valores vão escritos aqui. Se o sistema mudar",
        "// de cor, estas mudam junto.",
        "",
      ].join("\n"),
      [
        "// AS TRÊS CORES SÃO AS DO SISTEMA (app/globals.css): o papel (`--color-papel`, :54), o fundo do tema escuro",
        "// (`--color-papel-escuro`, :58) e a ação no tema escuro (`--color-acao-escuro`, :104). O manifesto, a barra do",
        "// celular e o ícone não leem o CSS, então os valores vão escritos aqui. Se o sistema mudar de cor, estas mudam",
        "// junto. O ícone e a barra ficaram no preto do painel, com o ponto no azul claro, pela decisão do Victor de",
        "// 25/11, depois de ver o ícone no azul (docs/specs/2026-11-24-celular-onda-1.md).",
        "",
      ].join("\n"),
    ],
    [
      'export const COR_DA_ACAO = "#1a5a6c";\n',
      'export const COR_DO_PAPEL_ESCURO = "#0b0a0e";\nexport const COR_DA_ACAO_ESCURA = "#78bacd";\n',
    ],
  ],
  "app/manifest.ts": [
    [
      'import { COR_DA_ACAO, COR_DO_PAPEL, DESCRICAO_DO_PAINEL, NOME_DO_PAINEL } from "@/lib/marca";\n',
      'import { COR_DO_PAPEL, COR_DO_PAPEL_ESCURO, DESCRICAO_DO_PAINEL, NOME_DO_PAINEL } from "@/lib/marca";\n',
    ],
    ["    theme_color: COR_DA_ACAO,\n", "    theme_color: COR_DO_PAPEL_ESCURO,\n"],
  ],
  "app/layout.tsx": [
    [
      'import { COR_DA_ACAO, DESCRICAO_DO_PAINEL, NOME_DO_PAINEL, TITULO_DO_PAINEL } from "@/lib/marca";\n',
      'import { COR_DO_PAPEL_ESCURO, DESCRICAO_DO_PAINEL, NOME_DO_PAINEL, TITULO_DO_PAINEL } from "@/lib/marca";\n',
    ],
    [
      [
        "// A COR DA BARRA DO CELULAR é a cor de ação do sistema (lib/marca.ts). O guia do Next a põe no `viewport`, e",
        "// não no `metadata` (node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-viewport.md:21-33",
        "// e :71-93).",
        "export const viewport: Viewport = {",
        "  themeColor: COR_DA_ACAO,",
        "};",
        "",
      ].join("\n"),
      [
        "// A COR DA BARRA DO CELULAR é o preto do fundo do tema escuro (lib/marca.ts), o mesmo do ícone. O guia do Next a",
        "// põe no `viewport`, e não no `metadata`",
        "// (node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-viewport.md:21-33 e :71-93).",
        "export const viewport: Viewport = {",
        "  themeColor: COR_DO_PAPEL_ESCURO,",
        "};",
        "",
      ].join("\n"),
    ],
  ],
  "lib/desenho-do-icone.tsx": [
    [
      'import { COR_DA_ACAO, COR_DO_PAPEL } from "@/lib/marca";\n',
      'import { COR_DA_ACAO_ESCURA, COR_DO_PAPEL, COR_DO_PAPEL_ESCURO } from "@/lib/marca";\n',
    ],
    ["        background: COR_DA_ACAO,\n", "        background: COR_DO_PAPEL_ESCURO,\n"],
    [
      "        <circle cx={PONTO.cx} cy={PONTO.cy} r={PONTO.r} fill={COR_DO_PAPEL} />\n",
      "        <circle cx={PONTO.cx} cy={PONTO.cy} r={PONTO.r} fill={COR_DA_ACAO_ESCURA} />\n",
    ],
  ],
};

const plano = modo === "teste" ? TESTE : CODIGO;
const gravar = [];
// Primeiro confere tudo; só grava se todos os trechos de todos os arquivos estiverem lá, uma vez cada.
for (const [caminho, trocas] of Object.entries(plano)) {
  const arquivo = join(raiz, caminho);
  const original = readFileSync(arquivo, "utf8");
  const fim = original.includes("\r\n") ? "\r\n" : "\n";
  const texto = original.replace(/\r\n/g, "\n");
  if (texto.includes("\r")) parar(`${caminho} tem fim de linha misturado`);
  let novo = texto;
  for (const [antes, depois] of trocas) {
    const vezes = novo.split(antes).length - 1;
    if (vezes !== 1) parar(`${caminho}: um trecho esperado aparece ${vezes} vezes, e não 1`);
    novo = novo.replace(antes, depois);
  }
  gravar.push([caminho, arquivo, fim, texto, novo, trocas.length]);
}
const linhas = (t) => t.split("\n").length - 1;
for (const [caminho, arquivo, fim, texto, novo, n] of gravar) {
  writeFileSync(arquivo, fim === "\r\n" ? novo.replace(/\n/g, "\r\n") : novo);
  console.log(`${caminho}: ${n} troca(s), de ${linhas(texto)} para ${linhas(novo)} linhas (${fim === "\r\n" ? "CRLF" : "LF"})`);
}
console.log(`GRAVADO: as cores, no modo ${modo}.`);
```

<!-- bloco: f2c/aplicar-next-config.mjs -->
```js
// O celular, PR 1, F2, c: o redirect do /favicon.ico para o /icon/32 no next.config.ts (a emenda da spec, o achado
// 352). Acrescenta o redirect, com o comentário do porquê, logo depois do redirect do /loja. Confere o trecho inteiro
// antes de trocar e, se ele não for o esperado, para sem gravar nada. Mantém o fim de linha que o arquivo já tem.
// Uso: node aplicar-next-config.mjs <raiz-da-copia>
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const raiz = process.argv[2];
if (!raiz) {
  console.log("uso: node aplicar-next-config.mjs <raiz-da-copia>");
  process.exit(1);
}
const parar = (motivo) => {
  console.log(`PARADO, NADA GRAVADO: ${motivo}`);
  process.exit(1);
};
const arquivo = join(raiz, "next.config.ts");
const original = readFileSync(arquivo, "utf8");
const fim = original.includes("\r\n") ? "\r\n" : "\n";
const texto = original.replace(/\r\n/g, "\n");
if (texto.includes("\r")) parar("o next.config.ts tem fim de linha misturado");

const ANTES = '      { source: "/loja", destination: "/produtos", permanent: true },\n    ];\n';
const DEPOIS = [
  '      { source: "/loja", destination: "/produtos", permanent: true },',
  "      // O FAVICON ANTIGO LEVA AO ÍCONE NOVO (docs/specs/2026-11-24-celular-onda-1.md, o achado 352). O",
  "      // app/favicon.ico (o logotipo da Vercel) saiu, e o /_not-found deste app é dinâmico: sem este redirect,",
  "      // cada pedido ao /favicon.ico rodaria o layout, que lê a sessão no banco. O redirect do next.config roda",
  "      // antes do porteiro e antes dos arquivos (node_modules/next/dist/docs/01-app/03-api-reference/",
  "      // 03-file-conventions/proxy.md:242-245 e 05-config/01-next-config-js/redirects.md:39). O 307",
  "      // (permanent: false) não fica em cache (redirects.md:30). tests/favicon.test.ts confere este redirect.",
  '      { source: "/favicon.ico", destination: "/icon/32", permanent: false },',
  "    ];",
  "",
].join("\n");

const vezes = texto.split(ANTES).length - 1;
if (vezes !== 1) parar(`o trecho do redirect do /loja aparece ${vezes} vezes, e não 1`);
const novo = texto.replace(ANTES, DEPOIS);
writeFileSync(arquivo, fim === "\r\n" ? novo.replace(/\n/g, "\r\n") : novo);
const linhas = (t) => t.split("\n").length - 1;
console.log(`GRAVADO: o redirect do favicon no next.config.ts, que passa de ${linhas(texto)} para ${linhas(novo)} linhas (${fim === "\r\n" ? "CRLF" : "LF"}).`);
```

<!-- bloco: f3/aplicar-f3.mjs -->
```js
// O celular, PR 1, F3: o porteiro com os endereços exatos do ícone e do manifesto, a lista dos lados do ícone num
// lugar só, os ícones no manifesto, e a citação proxy.md:243-246 (docs/specs/2026-11-24-celular-onda-1.md, "O
// porteiro", e os achados 351 a 353).
// Três modos, para o teste vir antes do código e cair pelo motivo certo (o achado 355):
//   lados   — a lib/desenho-do-icone.tsx exporta o LADOS_DO_ICONE, e o app/icon.tsx passa a usá-lo. É uma
//             refatoração sem mudança de comportamento (os lados continuam 32, 192 e 512), e roda ANTES do teste,
//             para o tests/proxy-icone.test.ts carregar e o vermelho mostrar o porteiro barrando os caminhos;
//   teste   — o tests/manifesto.test.ts ganha o caso dos ícones (o tests/proxy-icone.test.ts entra por cp, no bloco);
//   codigo  — o app/manifest.ts, o proxy.ts, o next.config.ts e a spec.
// Confere cada trecho inteiro antes de trocar e, se um não for o esperado, para sem gravar NADA (nenhum arquivo).
// Mantém o fim de linha que cada arquivo já tem.
// Uso: node aplicar-f3.mjs <raiz-da-copia> <lados|teste|codigo>
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [raiz, modo] = process.argv.slice(2);
if (!raiz || !["lados", "teste", "codigo"].includes(modo)) {
  console.log("uso: node aplicar-f3.mjs <raiz-da-copia> <lados|teste|codigo>");
  process.exit(1);
}
const parar = (motivo) => {
  console.log(`PARADO, NADA GRAVADO: ${motivo}`);
  process.exit(1);
};

const TESTE = {
  "tests/manifesto.test.ts": [
    [
      'import { DESCRICAO_DO_PAINEL } from "@/lib/marca";\n',
      'import { LADOS_DO_ICONE } from "@/lib/desenho-do-icone";\nimport { DESCRICAO_DO_PAINEL } from "@/lib/marca";\n',
    ],
    [
      [
        '    expect(valoresDe("app/layout.tsx", "description")).toEqual(["DESCRICAO_DO_PAINEL"]);',
        "  });",
        "});",
        "",
      ].join("\n"),
      [
        '    expect(valoresDe("app/layout.tsx", "description")).toEqual(["DESCRICAO_DO_PAINEL"]);',
        "  });",
        "",
        "  // OS ÍCONES DO MANIFESTO SAEM DOS LADOS QUE O app/icon.tsx GERA (lib/desenho-do-icone.tsx). Um tamanho mudado",
        "  // num lado e não no outro faria o manifesto apontar para um /icon/… que não existe, e o celular não instalaria.",
        '  it("aponta os ícones da tela inicial para os tamanhos que o app/icon.tsx gera", () => {',
        "    const icones = manifest().icons ?? [];",
        '    expect(icones.map((i) => i.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));',
        "    for (const i of icones) {",
        '      const lado = Number(i.src.replace("/icon/", ""));',
        "      expect(LADOS_DO_ICONE, i.src).toContain(lado);",
        "      expect(i.src).toBe(`/icon/${lado}`);",
        "      expect(i.sizes).toBe(`${lado}x${lado}`);",
        '      expect(i.type).toBe("image/png");',
        "    }",
        '    expect(icones.some((i) => i.purpose === "maskable" && i.sizes === "512x512")).toBe(true);',
        "  });",
        "});",
        "",
      ].join("\n"),
    ],
  ],
};

const LADOS = {
  "lib/desenho-do-icone.tsx": [
    [
      "export const PONTO = { cx: 75, cy: 65, r: 5 };\n",
      [
        "export const PONTO = { cx: 75, cy: 65, r: 5 };",
        "",
        "// OS LADOS DO app/icon.tsx, num lugar só: 32 para a aba do navegador, e 192 e 512 para a tela inicial do",
        "// Android. O manifesto (app/manifest.ts) aponta para o 192 e o 512, e o porteiro (proxy.ts) libera um /icon por",
        "// lado. tests/manifesto.test.ts e tests/proxy-icone.test.ts conferem os dois contra esta lista.",
        "export const LADOS_DO_ICONE = [32, 192, 512] as const;",
        "",
      ].join("\n"),
    ],
  ],
  "app/icon.tsx": [
    [
      'import { desenhoDoIcone } from "@/lib/desenho-do-icone";\n',
      'import { desenhoDoIcone, LADOS_DO_ICONE } from "@/lib/desenho-do-icone";\n',
    ],
    ["const LADOS = [32, 192, 512] as const;\n\n", ""],
    ["  return LADOS.map((lado) => ({\n", "  return LADOS_DO_ICONE.map((lado) => ({\n"],
  ],
};

const CODIGO = {
  "app/manifest.ts": [
    [
      "    theme_color: COR_DO_PAPEL_ESCURO,\n  };\n",
      [
        "    theme_color: COR_DO_PAPEL_ESCURO,",
        "    // OS ÍCONES DA TELA INICIAL são os de 192 e 512 do app/icon.tsx (os lados de lib/desenho-do-icone.tsx). O de",
        '    // 512 vale também como "maskable": o desenho fica nos 80% do meio, e o Android pode recortá-lo em círculo.',
        "    icons: [",
        '      { src: "/icon/192", sizes: "192x192", type: "image/png" },',
        '      { src: "/icon/512", sizes: "512x512", type: "image/png" },',
        '      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },',
        "    ],",
        "  };",
        "",
      ].join("\n"),
    ],
  ],
  "proxy.ts": [
    [
      "\nexport async function proxy(req: NextRequest) {\n",
      [
        "",
        "// OS ENDEREÇOS EXATOS DO MANIFESTO E DO ÍCONE (docs/specs/2026-11-24-celular-onda-1.md, \"O porteiro\"). O",
        "// navegador os busca sozinho, sem o cookie da sessão, e sem eles públicos o celular não instala o ícone. A",
        "// conferência é de IGUALDADE, e não de prefixo nem de extensão: um vizinho parecido (`/icon/32/x`,",
        "// `/icon-qualquer-coisa`, `/apple-icon.png`) continua pedindo sessão. São os caminhos da lista de rotas do build",
        "// do Next 16.4.6: o app/manifest.ts, o app/icon.tsx (um por lado de lib/desenho-do-icone.tsx) e o",
        "// app/apple-icon.tsx. O `pathname` vem sem a query que o Next põe no <link>. tests/proxy-icone.test.ts confere a",
        "// lista e os vizinhos.",
        "const PUBLIC_EXATOS = new Set([",
        '  "/manifest.webmanifest",',
        '  "/icon/32",',
        '  "/icon/192",',
        '  "/icon/512",',
        '  "/apple-icon",',
        "]);",
        "",
        "export async function proxy(req: NextRequest) {",
        "",
      ].join("\n"),
    ],
    [
      "  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {\n",
      "  if (PUBLIC_EXATOS.has(pathname) || PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {\n",
    ],
  ],
  "next.config.ts": [["proxy.md:242-245", "proxy.md:243-246"]],
  "docs/specs/2026-11-24-celular-onda-1.md": [["`proxy.md:242-245`", "`proxy.md:243-246`"]],
};

const plano = { lados: LADOS, teste: TESTE, codigo: CODIGO }[modo];
const gravar = [];
// Primeiro confere tudo; só grava se todos os trechos de todos os arquivos estiverem lá, uma vez cada.
for (const [caminho, trocas] of Object.entries(plano)) {
  const arquivo = join(raiz, caminho);
  const original = readFileSync(arquivo, "utf8");
  const fim = original.includes("\r\n") ? "\r\n" : "\n";
  const texto = original.replace(/\r\n/g, "\n");
  if (texto.includes("\r")) parar(`${caminho} tem fim de linha misturado`);
  let novo = texto;
  for (const [antes, depois] of trocas) {
    const vezes = novo.split(antes).length - 1;
    if (vezes !== 1) parar(`${caminho}: um trecho esperado aparece ${vezes} vezes, e não 1`);
    novo = novo.replace(antes, depois);
  }
  gravar.push([caminho, arquivo, fim, texto, novo, trocas.length]);
}
const linhas = (t) => t.split("\n").length - 1;
for (const [caminho, arquivo, fim, texto, novo, n] of gravar) {
  writeFileSync(arquivo, fim === "\r\n" ? novo.replace(/\n/g, "\r\n") : novo);
  console.log(`${caminho}: ${n} troca(s), de ${linhas(texto)} para ${linhas(novo)} linhas (${fim === "\r\n" ? "CRLF" : "LF"})`);
}
console.log(`GRAVADO: a F3, no modo ${modo}.`);
```

<!-- bloco: f4/aplicar-f4.mjs -->
```js
// O celular, PR 1, F4: a casca, o Início e a Atividade no celular (docs/specs/2026-11-24-celular-onda-1.md, "As
// regras de tela" e "O que muda: o PR 1"). Só classes, e cada uma vale abaixo do corte dela, para o computador não
// mudar (a não ser os mínimos de 24 px):
//   - a casca: os botões "Abrir menu" e "Fechar menu" passam de p-2 a p-3 (44 px; eles só existem abaixo de lg), e
//     os links do menu ganham min-h-11 abaixo de lg (onde a gaveta existe). De lg para cima, o min-h-[auto] devolve
//     o valor inicial do min-height (auto), que é o de hoje: um min-h-0 mudaria o mínimo de um item de flex;
//   - o Início: "Reconectar", "Criar post →" e "Ver a atividade →" ganham pelo menos 24 px de altura;
//   - a Atividade: a variante (d) medida pela auditoria (o achado 349): px-2 nos th e nos td, o nome com até 7rem e
//     o "Quando" com nowrap só de sm para cima; e o "Ver detalhes técnicos" com pelo menos 24 px.
// Confere cada trecho inteiro antes de trocar e, se um não for o esperado, para sem gravar NADA (nenhum arquivo).
// Mantém o fim de linha que cada arquivo já tem.
// Uso: node aplicar-f4.mjs <raiz-da-copia>
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const raiz = process.argv[2];
if (!raiz) {
  console.log("uso: node aplicar-f4.mjs <raiz-da-copia>");
  process.exit(1);
}
const parar = (motivo) => {
  console.log(`PARADO, NADA GRAVADO: ${motivo}`);
  process.exit(1);
};

const TROCAS = {
  "app/app-shell.tsx": [
    [
      "gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
      "gap-3 rounded-lg px-3 py-2 min-h-11 lg:min-h-[auto] text-sm font-medium transition-colors",
    ],
    [
      '          className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"\n',
      '          className="rounded-lg p-3 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"\n',
    ],
    [
      '              className="absolute right-3 top-4 rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"\n',
      '              className="absolute right-3 top-4 rounded-lg p-3 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"\n',
    ],
  ],
  "app/page.tsx": [
    [
      '                    <a href="/api/oauth/login" className={`text-xs ${link}`}>\n',
      '                    <a href="/api/oauth/login" className={`inline-flex min-h-6 items-center text-xs ${link}`}>\n',
    ],
    [
      '              <Link href="/publicar/novo" className={link}>\n                Criar post →\n',
      '              <Link href="/publicar/novo" className={`inline-flex min-h-6 items-center ${link}`}>\n                Criar post →\n',
    ],
    [
      '              <Link href="/eventos" className={link}>\n                Ver a atividade →\n',
      '              <Link href="/eventos" className={`inline-flex min-h-6 items-center ${link}`}>\n                Ver a atividade →\n',
    ],
  ],
  "app/eventos/page.tsx": [
    ['<th className="px-3 py-2">Para quem</th>', '<th className="px-2 py-2 sm:px-3">Para quem</th>'],
    ['<th className="px-3 py-2">O que foi enviado</th>', '<th className="px-2 py-2 sm:px-3">O que foi enviado</th>'],
    ['<th className="px-3 py-2">Quando</th>', '<th className="px-2 py-2 sm:px-3">Quando</th>'],
    [
      '                        <tr key={q.id}>\n                          <td className="px-3 py-1.5">\n',
      '                        <tr key={q.id}>\n                          <td className="px-2 py-1.5 sm:px-3">\n',
    ],
    [
      '<span className="truncate font-medium">{paraQuem}</span>',
      '<span className="max-w-28 truncate font-medium sm:max-w-none">{paraQuem}</span>',
    ],
    [
      '                          <td className="px-3 py-1.5">\n                            <span className="inline-flex flex-wrap items-center gap-2">\n',
      '                          <td className="px-2 py-1.5 sm:px-3">\n                            <span className="inline-flex flex-wrap items-center gap-2">\n',
    ],
    [
      "<td className={`whitespace-nowrap px-3 py-1.5 text-xs ${muted}`}>",
      "<td className={`px-2 py-1.5 text-xs sm:whitespace-nowrap sm:px-3 ${muted}`}>",
    ],
    [
      "<summary className={`cursor-pointer text-xs ${muted} hover:text-zinc-900 dark:hover:text-zinc-100`}>",
      "<summary className={`cursor-pointer py-1 text-xs ${muted} hover:text-zinc-900 dark:hover:text-zinc-100`}>",
    ],
  ],
};

const gravar = [];
// Primeiro confere tudo; só grava se todos os trechos de todos os arquivos estiverem lá, uma vez cada.
for (const [caminho, trocas] of Object.entries(TROCAS)) {
  const arquivo = join(raiz, caminho);
  const original = readFileSync(arquivo, "utf8");
  const fim = original.includes("\r\n") ? "\r\n" : "\n";
  const texto = original.replace(/\r\n/g, "\n");
  if (texto.includes("\r")) parar(`${caminho} tem fim de linha misturado`);
  let novo = texto;
  for (const [antes, depois] of trocas) {
    const vezes = novo.split(antes).length - 1;
    if (vezes !== 1) parar(`${caminho}: um trecho esperado aparece ${vezes} vezes, e não 1: ${antes.trim().slice(0, 70)}`);
    novo = novo.replace(antes, depois);
  }
  gravar.push([caminho, arquivo, fim, texto, novo, trocas.length]);
}
const linhas = (t) => t.split("\n").length - 1;
for (const [caminho, arquivo, fim, texto, novo, n] of gravar) {
  writeFileSync(arquivo, fim === "\r\n" ? novo.replace(/\n/g, "\r\n") : novo);
  console.log(`${caminho}: ${n} troca(s), de ${linhas(texto)} para ${linhas(novo)} linhas (${fim === "\r\n" ? "CRLF" : "LF"})`);
}
console.log("GRAVADO: a F4.");
```

<!-- bloco: f5/aplicar-abertura.mjs -->
```js
// O celular, PR 1, F5: a tela de abertura do Android (o `background_color` do manifesto) passa ao preto do ícone,
// pela decisão do Victor de 25/11 ("Preto, igual ao ícone (Recomendado)"), e a spec registra a decisão.
// Dois modos, para o teste vir antes do código:
//   teste   — o tests/manifesto.test.ts passa a esperar o background_color #0b0a0e (o vermelho);
//   codigo  — o app/manifest.ts e a spec (o verde).
// Confere cada trecho inteiro antes de trocar e, se um não for o esperado, para sem gravar NADA (nenhum arquivo).
// Mantém o fim de linha que cada arquivo já tem.
// Uso: node aplicar-abertura.mjs <raiz-da-copia> <teste|codigo>
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [raiz, modo] = process.argv.slice(2);
if (!raiz || !["teste", "codigo"].includes(modo)) {
  console.log("uso: node aplicar-abertura.mjs <raiz-da-copia> <teste|codigo>");
  process.exit(1);
}
const parar = (motivo) => {
  console.log(`PARADO, NADA GRAVADO: ${motivo}`);
  process.exit(1);
};

const TESTE = {
  "tests/manifesto.test.ts": [['    expect(m.background_color).toBe("#fbfaf8");\n', '    expect(m.background_color).toBe("#0b0a0e");\n']],
};

const CODIGO = {
  "app/manifest.ts": [
    [
      'import { COR_DO_PAPEL, COR_DO_PAPEL_ESCURO, DESCRICAO_DO_PAINEL, NOME_DO_PAINEL } from "@/lib/marca";\n',
      'import { COR_DO_PAPEL_ESCURO, DESCRICAO_DO_PAINEL, NOME_DO_PAINEL } from "@/lib/marca";\n',
    ],
    [
      "    background_color: COR_DO_PAPEL,\n",
      [
        "    // A TELA DE ABERTURA DO ANDROID (o fundo atrás do ícone) e a barra ficam no preto do ícone, pela decisão do",
        "    // Victor de 25/11 (docs/specs/2026-11-24-celular-onda-1.md). No iPhone, essa tela não aparece.",
        "    background_color: COR_DO_PAPEL_ESCURO,",
        "",
      ].join("\n"),
    ],
  ],
  "docs/specs/2026-11-24-celular-onda-1.md": [
    [
      '  - O "M" continua em papel `#fbfaf8`.\n',
      [
        '  - O "M" continua em papel `#fbfaf8`.',
        '- **A tela de abertura do Android:** "Preto, igual ao ícone (Recomendado)", o `#0b0a0e`. A alternativa era o fundo',
        "  claro. O custo: quem usa o tema claro vê a abertura preta virar o painel claro. No iPhone, essa tela não aparece.",
        "",
      ].join("\n"),
    ],
    ["  - `background_color`: `#fbfaf8`;\n", "  - `background_color`: `#0b0a0e`;\n"],
  ],
};

const plano = modo === "teste" ? TESTE : CODIGO;
const gravar = [];
// Primeiro confere tudo; só grava se todos os trechos de todos os arquivos estiverem lá, uma vez cada.
for (const [caminho, trocas] of Object.entries(plano)) {
  const arquivo = join(raiz, caminho);
  const original = readFileSync(arquivo, "utf8");
  const fim = original.includes("\r\n") ? "\r\n" : "\n";
  const texto = original.replace(/\r\n/g, "\n");
  if (texto.includes("\r")) parar(`${caminho} tem fim de linha misturado`);
  let novo = texto;
  for (const [antes, depois] of trocas) {
    const vezes = novo.split(antes).length - 1;
    if (vezes !== 1) parar(`${caminho}: um trecho esperado aparece ${vezes} vezes, e não 1`);
    novo = novo.replace(antes, depois);
  }
  gravar.push([caminho, arquivo, fim, texto, novo, trocas.length]);
}
const linhas = (t) => t.split("\n").length - 1;
for (const [caminho, arquivo, fim, texto, novo, n] of gravar) {
  writeFileSync(arquivo, fim === "\r\n" ? novo.replace(/\n/g, "\r\n") : novo);
  console.log(`${caminho}: ${n} troca(s), de ${linhas(texto)} para ${linhas(novo)} linhas (${fim === "\r\n" ? "CRLF" : "LF"})`);
}
console.log(`GRAVADO: a abertura, no modo ${modo}.`);
```

<!-- bloco: mutar-celular-1.mjs -->
```js
// O celular, PR 1: as mutações (docs/specs/2026-11-24-celular-onda-1.md, "Os testes"). Cada mutação estraga UMA
// proteção, roda os testes que deveriam pegá-la e mostra QUAIS casos caíram. Depois, o arquivo volta pelo
// `git checkout --`. Uma mutação que não derruba nenhum caso é um teste que não mede nada.
//
// As seis da spec emendada, para o PR 1:
//   1. a igualdade do PUBLIC_EXATOS trocada por prefixo;
//   2. um endereço tirado do PUBLIC_EXATOS (o /icon/192);
//   3. os exatos conferidos DEPOIS da sessão (eles ainda passam, mas a sessão é consultada antes);
//   4. o `display` do manifesto trocado;
//   5. a descrição do manifesto escrita à mão, com o mesmo texto (o achado 343: só o caso que lê o código pega);
//   6. o redirect do favicon tirado do next.config.ts.
//
// GRAVA na cópia dada, um arquivo por vez, e o desfaz em seguida. Para se a árvore não estiver limpa no começo, se
// um trecho não aparecer exatamente uma vez, ou se a árvore não voltar limpa depois de cada mutação.
// Uso: node mutar-celular-1.mjs <raiz-da-copia>
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const raiz = process.argv[2];
if (!raiz) {
  console.log("uso: node mutar-celular-1.mjs <raiz-da-copia>");
  process.exit(1);
}
const git = (...args) => execFileSync("git", args, { cwd: raiz, encoding: "utf8" });
const parar = (motivo) => {
  console.log(`PARADO: ${motivo}`);
  process.exit(1);
};
if (git("status", "--porcelain").trim()) parar("a árvore não está limpa no começo");

const MUTACOES = [
  {
    nome: "1. a igualdade do PUBLIC_EXATOS trocada por prefixo",
    arquivo: "proxy.ts",
    trocas: [["PUBLIC_EXATOS.has(pathname) ||", "[...PUBLIC_EXATOS].some((p) => pathname.startsWith(p)) ||"]],
    testes: ["tests/proxy-icone.test.ts"],
  },
  {
    nome: "2. o /icon/192 tirado do PUBLIC_EXATOS",
    arquivo: "proxy.ts",
    trocas: [['  "/icon/192",\n', ""]],
    testes: ["tests/proxy-icone.test.ts"],
  },
  {
    nome: "3. os exatos conferidos depois da sessão",
    arquivo: "proxy.ts",
    trocas: [
      ["PUBLIC_EXATOS.has(pathname) || ", ""],
      ["  const url = req.nextUrl.clone();\n", "  if (PUBLIC_EXATOS.has(pathname)) return NextResponse.next();\n  const url = req.nextUrl.clone();\n"],
    ],
    testes: ["tests/proxy-icone.test.ts"],
  },
  {
    nome: "4. o display do manifesto trocado por browser",
    arquivo: "app/manifest.ts",
    trocas: [['    display: "standalone",\n', '    display: "browser",\n']],
    testes: ["tests/manifesto.test.ts"],
  },
  {
    nome: "5. a descrição do manifesto escrita à mão, com o mesmo texto",
    arquivo: "app/manifest.ts",
    trocas: [
      [
        "    description: DESCRICAO_DO_PAINEL,\n",
        '    description: "Automação do seu Instagram: palavra-chave no comentário vira DM com seu link.",\n',
      ],
    ],
    testes: ["tests/manifesto.test.ts"],
  },
  {
    nome: "6. o redirect do favicon tirado",
    arquivo: "next.config.ts",
    trocas: [['      { source: "/favicon.ico", destination: "/icon/32", permanent: false },\n', ""]],
    testes: ["tests/favicon.test.ts"],
  },
];

const vitest = (arquivos) =>
  spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", ...arquivos], { cwd: raiz, encoding: "utf8" });

let semQueda = 0;
for (const m of MUTACOES) {
  console.log(`== ${m.nome} (${m.arquivo})`);
  const caminho = join(raiz, m.arquivo);
  const original = readFileSync(caminho, "utf8");
  const fim = original.includes("\r\n") ? "\r\n" : "\n";
  let texto = original.replace(/\r\n/g, "\n");
  for (const [antes, depois] of m.trocas) {
    const vezes = texto.split(antes).length - 1;
    if (vezes !== 1) parar(`${m.arquivo}: um trecho da mutação aparece ${vezes} vezes, e não 1`);
    texto = texto.replace(antes, depois);
  }
  writeFileSync(caminho, fim === "\r\n" ? texto.replace(/\n/g, "\r\n") : texto);
  const r = vitest(m.testes);
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
  if (git("status", "--porcelain").trim()) parar(`a árvore não voltou limpa depois da mutação ${m.nome}`);
  console.log("  desfeita; árvore limpa");
}

console.log("== os mesmos testes, na árvore limpa");
const r = vitest(["tests/proxy-icone.test.ts", "tests/manifesto.test.ts", "tests/favicon.test.ts"]);
const placar = `${r.stdout}\n${r.stderr}`.split("\n").filter((l) => /^\s*(Test Files|Tests)\s/.test(l)).map((l) => l.trim());
console.log(`vitest: ${r.status}; ${placar.join(" | ")}`);
console.log(`FIM: ${MUTACOES.length - semQueda} de ${MUTACOES.length} mutações caíram.`);
process.exit(semQueda || r.status ? 1 : 0);
```

## Apêndice B: as mutações do ensaio

Rodadas na cópia do ensaio, sobre a `1a1049e` commitada e limpa, com o "pode" da auditoria. A saída:

```text
== 1. a igualdade do PUBLIC_EXATOS trocada por prefixo (proxy.ts)
vitest: 1; Tests  4 failed | 12 passed (16)
  FAIL  tests/proxy-icone.test.ts > o porteiro e o ícone do celular > /manifest.webmanifest/x continua pedindo sessão
  FAIL  tests/proxy-icone.test.ts > o porteiro e o ícone do celular > /icon/32/x continua pedindo sessão
  FAIL  tests/proxy-icone.test.ts > o porteiro e o ícone do celular > /apple-icon/x continua pedindo sessão
  FAIL  tests/proxy-icone.test.ts > o porteiro e o ícone do celular > /apple-icon.png continua pedindo sessão
  desfeita; árvore limpa
== 2. o /icon/192 tirado do PUBLIC_EXATOS (proxy.ts)
vitest: 1; Tests  1 failed | 15 passed (16)
  FAIL  tests/proxy-icone.test.ts > o porteiro e o ícone do celular > /icon/192 passa sem sessão, e sem consultar a sessão
  desfeita; árvore limpa
== 3. os exatos conferidos depois da sessão (proxy.ts)
vitest: 1; Tests  6 failed | 10 passed (16)
  FAIL  tests/proxy-icone.test.ts > o porteiro e o ícone do celular > /manifest.webmanifest passa sem sessão, e sem consultar a sessão
  FAIL  tests/proxy-icone.test.ts > o porteiro e o ícone do celular > /icon/32 passa sem sessão, e sem consultar a sessão
  FAIL  tests/proxy-icone.test.ts > o porteiro e o ícone do celular > /icon/192 passa sem sessão, e sem consultar a sessão
  FAIL  tests/proxy-icone.test.ts > o porteiro e o ícone do celular > /icon/512 passa sem sessão, e sem consultar a sessão
  FAIL  tests/proxy-icone.test.ts > o porteiro e o ícone do celular > /apple-icon passa sem sessão, e sem consultar a sessão
  FAIL  tests/proxy-icone.test.ts > o porteiro e o ícone do celular > confere o caminho sem a query que o Next põe no <link> do ícone
  desfeita; árvore limpa
== 4. o display do manifesto trocado por browser (app/manifest.ts)
vitest: 1; Tests  1 failed | 2 passed (3)
  FAIL  tests/manifesto.test.ts > o manifesto do celular > abre o painel sem a barra do navegador, no endereço de início, com o nome e as cores da marca
  desfeita; árvore limpa
== 5. a descrição do manifesto escrita à mão, com o mesmo texto (app/manifest.ts)
vitest: 1; Tests  1 failed | 2 passed (3)
  FAIL  tests/manifesto.test.ts > o manifesto do celular > tira a descrição da mesma constante que o layout usa
  desfeita; árvore limpa
== 6. o redirect do favicon tirado (next.config.ts)
vitest: 1; Tests  1 failed (1)
  FAIL  tests/favicon.test.ts > o favicon antigo > leva ao ícone novo de 32 px, por um redirect temporário
  desfeita; árvore limpa
== os mesmos testes, na árvore limpa
vitest: 0; Test Files  3 passed (3) | Tests  20 passed (20)
FIM: 6 de 6 mutações caíram.
```
