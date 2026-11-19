# O guia com o Victor: o plano (o PR do COMECE-AQUI)

**Nascido em:** 19/11/2026, sobre a `main` em `4182066`. A spec é `docs/specs/2026-11-19-o-guia-com-o-victor.md`.

**O que o Victor decidiu pela caixa:**
- em 18/11: a troca de papéis no guia vai num **PR próprio**, e a instrução da cópia em LF (`COMECE-AQUI.md:121`,
  achado 274) vai neste PR;
- em 19/11: ele no lugar do Eduardo em todas as decisões do dia a dia; o recado da `:141` sai; o `.env.local` passa a
  ser "Peça ao Victor"; os textos de partida das duas sessões vão para o próprio guia; a licença passa a ser "fale
  com o Victor"; a conferência pela Vercel **vira regra** para entrega que não muda o app (achado 308); o comentário
  do `docker-compose.yml` muda (achado 303); o "A seguir" fica com o vídeo primeiro; e as duas linhas novas entram no
  "Anotado";
- em 19/11: **a spec aprovada**, no sha256 `49f62a3c6a600bbf1656be95fd5da24cdcfda7ceb59a676f48cbbe1a66fb5a87`.

**As emendas à spec, para o "Li, pode executar" do Victor** (achados da auditoria no ensaio):
- **315, a contagem dos achados.** A spec dizia "o último número no dia do commit". Um número cravado fica velho no
  mesmo dia, e um número que muda entre o ensaio e a execução quebra o patch-id do guia. A `:168` passa a uma frase
  verdadeira a qualquer hora: "(quando este guia foi atualizado, em 19/11/2026, íamos no 316; o último número fica
  no relatório do dia)". No texto de partida do AUDITOR, os achados passam a ser numerados "a partir do último do
  relatório do dia anterior".
- **316, a `:252`.** "O último plano entregue, `docs/plans/2026-11-16-linkedin-video.md`" ficou velho com o PR #40.
  A `:5` manda atualizar o fato no mesmo PR. A linha passa a: "Exemplos de entrega escrita, ensaiada e provada:
  `docs/plans/2026-11-16-linkedin-video.md` (com prova no preview) e `docs/plans/2026-11-18-testes-que-caem.md` (sem
  mudança no app)."

**Como a spec virou texto, onde ela não dava as palavras exatas** (medido na `4182066`):
- a spec fala da regra "nenhum e-mail em commit" da seção 6, mas essa regra não existe lá com essas palavras (a
  `:193` só proíbe e-mail no corpo do PR). Por isso, entra uma linha nova depois da `:190`;
- os textos de partida vão em blocos de código marcados como `text`, para colar limpo, e sem crases dentro (sairiam
  literais);
- a `:202` diz "seguindo o jeito do Vinícius", e não "o jeito dele", que ficaria ambíguo depois de "do Victor".

**O ensaio (19/11):** feito numa cópia isolada de nome curto (`git worktree`, ramo local `ensaio-guia`, saído da
`4182066`, sem `npm ci`, porque nada roda nela), passo a passo com o "pode" da auditoria. Os três commits do ensaio,
e o patch-id de cada um, que a execução tem de repetir:

| Commit do ensaio | O que é | patch-id |
|---|---|---|
| `4a1c443` | a spec | `d7759b32557cc0171064308f4dbf5e09a1e259c0` |
| `eb5c1b6` | a FASE 1: o guia | `8699ca2a9652aae8aa11c40d0019765c980bb443` |
| `4b6a530` | a FASE 2: o comentário do compose | `4fc934b64e1f86b262303074f6349e551f461206` |

---

## O que o ensaio mediu

- **A base:** o `origin/main` em `4182066`; 39 ramos no remoto, fora a `main` (o número da linha nova do "Anotado");
  o `COMECE-AQUI.md` com 252 linhas e 252 CR, e o `docker-compose.yml` com 72 e 72 (a cópia sai em CRLF).
- **O guia:** 38 trocas, de 252 para 293 linhas, em CRLF e "limpo". O "Eduardo" sobra numa linha só, a `:229`, a das
  cópias que ficaram na máquina dele. A seção 10 vai de `:259` a `:293`.
- **O compose:** 2 trocas, nas `:34-35`, só comentário, e o arquivo continua com 72 linhas em CRLF.
- **A guarda do diff:** "dentro" para os caminhos previstos, "docker-compose.yml: só comentário" e saída 0, em cada
  passo.
- **As 5 sabotagens, uma por proteção** (o apêndice B), sobre a árvore commitada: todas caíram, e o status voltou
  vazio.
- **A linha nova da seção 4 (o banco de teste) NÃO foi medida no ensaio:** o Docker não respondia. Ela é medida no
  Passo D, antes da execução, junto com a remoção do container que sobrou do item 3. Se a medição a contradisser, a
  execução não começa, e a linha volta à spec.

## O que fica aberto, fora desta entrega

- **O 272:** o `next` 16.4.3 tem um alerta moderado (`'use cache'`, que o projeto não usa); o conserto é o 16.4.6,
  num PR pequeno à parte. É o item 2 do "A seguir" novo.
- **O 276:** o vídeo de 30 s do LinkedIn na produção espera um acesso de leitura da auditoria à produção.
- **O 248:** o caso da migração 012 na integração ainda pode cair, pelo corte no segundo.
- **Os 39 ramos remotos antigos** e **as cópias na máquina do Eduardo:** anotados no guia, cada um uma decisão à
  parte.

## Restrições globais

- **Os caminhos.** Todo bloco de comandos começa definindo:
  - `S`, o scratchpad: `C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/394c77f1-2a23-4c47-b600-4f9c6baec770/scratchpad`;
  - `C`, a cópia da execução: `$S/x` (nome curto, achado 307: ela tem `node_modules`);
  - `G`, a pasta dos roteiros desta entrega: `$S/guia`; e `T`, a do item 3, com os roteiros reusados: `$S/item3`;
  - `P`, este plano: `$G/plano.md`, o arquivo que a auditoria leu (no Passo 3, ele é copiado para
    `docs/plans/2026-11-19-o-guia-com-o-victor.md`).
  - A auditoria, ao aplicar o plano do zero, troca `C`, `G` e `T` pelos caminhos dela.
- **O ramo:** `guia`, saído da `4182066`, sem upstream. Nunca commitar nem empurrar na `main`. Todo commit vem
  depois de `test "$(git branch --show-current)" = guia &&`.
- **O autor** é o do git da máquina (Victor Souza, com o e-mail noreply do GitHub). Sem `--author`, sem rodapé de IA
  (`COMECE-AQUI.md:190`, que vale mais que qualquer lembrete de atribuição), e nunca `git config` numa worktree.
- **`git add` com o caminho de cada arquivo.** Nunca `-A` nem `.`.
- **Antes de cada commit,** o `varrer-texto.mjs` nos arquivos da fase, todos "limpo", com a saída lida. O commit é um
  comando à parte.
- **A guarda do diff** (`guarda-do-diff.sh`) roda no fim de cada fase e sai com 0.
- **A regra de divergência:** se o blob, o patch-id, a guarda, a varredura ou uma contagem não baterem com o plano,
  pare. Não ajuste nada: mande a saída inteira à auditoria e espere.
- **Nenhum roteiro roda sem o "pode" da auditoria**, nem para testar (achados 275, 289, 292, 295, 296 e 314). Nada
  roda sozinho em segundo plano sem aviso antes.
- **`npx --no-install`** sempre. **Nada de `app/`, `lib/`, `scripts/`, testes, `package*` ou configuração muda**, fora
  o comentário das `:34-35` do `docker-compose.yml`.
- **O DEV não se conecta à produção.** A leitura do deploy e da prévia é da auditoria, pelo conector da Vercel, só
  com ferramentas de leitura.
- **No corpo do PR,** nenhuma arroba solta, nem e-mail, nem conta: o repositório é público.

## Mapa dos arquivos

| Arquivo | Fase | O que é |
|---|---|---|
| `docs/specs/2026-11-19-o-guia-com-o-victor.md` | Passo 2 | a spec (novo) |
| `docs/plans/2026-11-19-o-guia-com-o-victor.md` | Passo 3 | este plano (novo) |
| `COMECE-AQUI.md` | FASE 1 | 38 trocas (o diff da FASE 1) |
| `docker-compose.yml` | FASE 2 | o comentário das `:34-35` |

E mais nenhum: a guarda do diff confere isso.

---

## Passo D: a medição da linha nova da seção 4 e a remoção do container do item 3

Antes da execução, com o Docker aberto pelo Victor e com o "pode" da auditoria. Mede o que a linha nova depois da
`COMECE-AQUI.md:119` afirma, e remove o container `metodochat-banco-de-teste`, que ficou do item 3 (o projeto do
compose dele é `testes-que-caem-exec`, a pasta que o subiu). Roda na pasta principal, na `main`, e não mexe em nenhum
outro container: todo filtro é pelo nome `metodochat-banco-de-teste` ou pelas duas redes do compose
(`metodochat_default` e `testes-que-caem-exec_default`).

```bash
R="c:/Users/Usuario/varandas/MetodoChat"
cd "$R" || exit 1
test "$(git branch --show-current)" = main || { echo "a pasta principal não está na main: pare"; exit 1; }
test -z "$(git status --porcelain)" || { echo "a pasta principal não está limpa: pare"; exit 1; }
echo "== antes"
docker ps -a --filter name=metodochat-banco-de-teste --format '{{.Names}} | {{.Status}} | projeto={{.Label "com.docker.compose.project"}}'
test "$(docker ps -a --filter name=^metodochat-banco-de-teste$ --format '{{.Label "com.docker.compose.project"}}')" = testes-que-caem-exec || { echo "o container não é o esperado: pare"; exit 1; }
docker network ls --filter name=metodochat_default --filter name=testes-que-caem-exec_default --format '{{.Name}}'; echo "(redes acima)"
echo "== 1: o banco:teste na pasta principal (projeto metodochat), com o container de outro projeto ainda lá"
npm run banco:teste; echo "banco:teste saiu com $?"
echo "== 2: o banco:teste:parar na pasta principal"
npm run banco:teste:parar; echo "banco:teste:parar saiu com $?"
docker ps -a --filter name=metodochat-banco-de-teste --format '{{.Names}} | {{.Status}} | projeto={{.Label "com.docker.compose.project"}}'
echo "== 3: a remoção pelo projeto, na pasta principal"
docker compose -p testes-que-caem-exec -f docker-compose.yml down -v; echo "down -p saiu com $?"
echo "== depois"
docker ps -a --filter name=metodochat-banco-de-teste --format '{{.Names}}'; echo "(vazio = removido)"
docker network ls --filter name=metodochat_default --filter name=testes-que-caem-exec_default --format '{{.Name}}'; echo "(vazio = sem as duas redes)"
git status --porcelain; echo "(status acima; vazio = limpo)"
```

Esperado:
- antes: o container com `projeto=testes-que-caem-exec`;
- 1: o `banco:teste` cai, com "already in use" no nome `metodochat-banco-de-teste`, e sai com um código diferente
  de 0. Antes de cair, ele pode criar a rede `metodochat_default`;
- 2: o `banco:teste:parar` sai com 0, remove só a rede `metodochat_default` (se ela existir) e não acha o
  container: a linha do `docker ps -a` seguinte continua mostrando o container, com `projeto=testes-que-caem-exec`;
- 3: o `down -p` remove o container (e a rede `testes-que-caem-exec_default`, se existir) e sai com 0;
- depois: o `docker ps -a` vazio, o `docker network ls` vazio e o status da pasta principal limpo.

Se o 1 NÃO cair (se subir um container novo), pare: a linha nova da seção 4 está errada, e a execução não começa.

## Passo 0: os roteiros

Os roteiros vêm dos blocos do apêndice A. O primeiro, o `extrair-bloco.mjs`, é criado a partir do bloco dele por
qualquer meio, e conferido pelo sha256; os outros saem do plano por ele. Na pasta do DEV eles já existem, e só se
confere o sha256.

| Roteiro | Pasta | sha256 | Lido pela auditoria |
|---|---|---|---|
| `extrair-bloco.mjs` | `T` | `8585d040e92f75b0c9f05fa2491cd9a34c7066bac48c4389f6466a6ce307f52a` | sim (18/11), sem mudança |
| `varrer-texto.mjs` | `T` | `2e5f91e9083f4873102269ec596fe2c62f97cc47d00a310f29898f08173c9a85` | sim (18/11), sem mudança |
| `guarda-do-diff.sh` | `G` | `c7ce050e0cc4a08b5220898e7ce5c79d5f5f1f4957abfc3ab937d624762b02ae` | sim (19/11) |
| `aplicar-guia.mjs` | `G` | `5a5e116e48569cb3342e1e4d852eff23066d448b8af00481c5be87873798ce72` | sim (19/11, a v3) |

```bash
S="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/394c77f1-2a23-4c47-b600-4f9c6baec770/scratchpad"
G="$S/guia"; T="$S/item3"
sha256sum "$T/extrair-bloco.mjs" "$T/varrer-texto.mjs" "$G/guarda-do-diff.sh" "$G/aplicar-guia.mjs"
```

Esperado: os quatro sha256 da tabela.

## Passo 1: a cópia da execução, saída da `main`

```bash
R="c:/Users/Usuario/varandas/MetodoChat"
S="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/394c77f1-2a23-4c47-b600-4f9c6baec770/scratchpad"
C="$S/x"
test ! -e "$C" || { echo "a pasta da cópia já existe: pare"; exit 1; }
cd "$R" || exit 1
git fetch origin
test "$(git rev-parse --short origin/main)" = 4182066 || { echo "a main mudou: pare"; exit 1; }
git worktree add -b guia "$C" 4182066
cd "$C" || exit 1
if git rev-parse --abbrev-ref '@{upstream}' >/dev/null 2>&1; then echo "o ramo tem upstream: pare"; exit 1; fi
for f in .env*; do if [ -e "$f" ]; then echo "PARADO: $f existe na cópia"; exit 1; fi; done
: > .env.local
npm ci; echo "npm ci: $?"
echo "o maior caminho da cópia: $(find "$C" | awk '{ print length }' | sort -n | tail -1) caracteres"
git branch --show-current
git status --porcelain; echo "(status acima; vazio = limpo)"
```

Esperado: o ramo `guia`; "npm ci: 0"; o maior caminho com no máximo 259 caracteres (senão, avise antes de seguir: a
limpeza vai precisar renomear a pasta para um caminho mais curto); e o status vazio (o `.env.local` está no
`.gitignore`). Se o `origin/main` não estiver em `4182066`, pare: a base mudou.

## Passo 2: a spec (o commit que repete o `4a1c443`)

<!-- bloco: docs/specs/2026-11-19-o-guia-com-o-victor.md -->
```markdown
# O guia com o Victor (o PR do COMECE-AQUI)

**Nascido em:** 19/11/2026, sobre a `main` em `4182066` (o item 3, os testes que caíam por tempo, em produção desde
18/11, no PR #40).

**O que o Victor decidiu pela caixa:**
- em 18/11: a troca de papéis no guia vai num **PR próprio**, e não junto com o item 3; e a instrução da cópia em LF
  (`COMECE-AQUI.md:121`, achado 274) vai neste PR;
- em 19/11: **ele no lugar do Eduardo em todas as decisões do dia a dia** (as linhas listadas em A); o recado da
  `:141` sai; o `.env.local` passa a ser "Peça ao Victor"; os **textos de partida** das duas sessões passam a estar
  **no próprio guia**; e a licença passa a ser "fale com o Victor";
- em 19/11, depois da leitura do auditor: a conferência pela Vercel **vira regra** para toda entrega que não muda o
  app, até existir o acesso de leitura (achado 308); o comentário do `docker-compose.yml` **muda** (achado 303); o
  "A seguir" fica **na ordem proposta**, com o vídeo primeiro; e **as duas linhas** novas entram no "Anotado".

---

## O que estava aberto

O `COMECE-AQUI.md` foi escrito em 18/11, antes de o Victor assumir o projeto e antes do que o item 3 ensinou. Hoje
ele diz coisas que não valem mais. Medido na `4182066`, com 252 linhas:

- **A. Os papéis.** O Eduardo aparece como quem decide em `:13`, `:14`, `:72`, `:110`, `:129`, `:130`, `:137`,
  `:147`, `:148`, `:156`, `:158-161`, `:164`, `:178-180`, `:202`, `:214`, `:215`, `:218` e `:232`. A `:141` é um
  recado ao Victor que deixou de fazer sentido.
- **B. A leitura da produção.** A `:130` diz que o auditor "lê a produção só para leitura". Nesta máquina, ele não lê
  o banco de produção (achado 276). O que ele lê de fato é a Vercel, pelo conector.
- **C. O processo.** O item 3 deixou quatro lições que o ciclo (`:145-164`) e as regras (`:173-180`) ainda não têm:
  - o e-mail pessoal de quem mescla foi para o histórico público no merge do PR #40 (achados 299 e 304);
  - o corpo do merge saiu com o título do PR, e não com a mensagem aprovada (achado 305);
  - a leitura de +50 min depois do deploy foi perdida, e não se recupera, porque o plano Hobby da Vercel guarda os
    registros de execução por uma hora (achado 306);
  - apagar uma cópia de trabalho com `node_modules` sob o scratchpad passou do limite de 260 caracteres do Windows,
    e o `git worktree remove` deixou a pasta pela metade (achado 307).
- **D. A cópia em LF.** A `:121` manda usar `git -c core.autocrlf=false worktree add …`, mas isso dá CRLF nesta
  máquina (achado 274).
- **E. O banco de teste.** O container do banco de teste ganha o nome do projeto do compose, que é o nome da pasta
  que o subiu. Um `npm run banco:teste:parar` em outra pasta não o acha. E o comentário do `docker-compose.yml`
  (`:34-35`) diz que o `n8x-marketing-db` está na 5433, mas nesta máquina ele está na 5432 (achado 303).
- **F. A seção 7.** O item 3 já saiu, e as cópias de trabalho do vídeo não estão nesta máquina.
- **G. As abas.** Em 19/11, duas abas abertas sobre a mesma conversa do auditor viraram duas sessões que se
  apresentaram como auditor.

## O que muda

Tudo no `COMECE-AQUI.md`, e mais o comentário das `:34-35` do `docker-compose.yml` (veja E).

**A. Os papéis.**
- Nas linhas da lista, "o Eduardo" vira "o Victor", com a gramática ajustada.
- A `:141` sai.
- A `:110` passa a dizer "Peça ao Victor".
- A `:137` passa a dizer que os textos de partida estão no fim do guia (a seção nova "10").
- A `:232` passa a dizer "fale com o Victor".
- A `:202` mantém a história do Vinícius, e a decisão sobre o motor passa a ser "do Victor".
- O topo (`:5`) registra a atualização: "Escrito em 18/11/2026 e atualizado em 19/11/2026."

**B. A leitura da produção (seção 5).** O papel do auditor passa a dizer o que vale de fato:
- ele lê a produção só lendo. Hoje, isso é a Vercel pelo conector (os deploys, os registros de build, os
  registros de execução e os erros), só com as ferramentas de leitura, e nunca promover, voltar ou mexer em
  variável;
- o banco de produção, ele só lê quando houver um acesso de leitura (o 276, ainda aberto);
- para uma entrega que não muda o app, o deploy, o log do build e os erros da Vercel substituem a leitura da base,
  até existir o acesso de leitura. Essa conferência não vê a fila, mas uma entrega que não muda o app não mexe
  nela. É uma regra desde 19/11, por decisão do Victor (achado 308); em 18/11 ela valia só para o item 3;
- o plano Hobby guarda os registros de execução por uma hora.

**C. O processo (seções 5 e 6).**
- **No ciclo, antes da caixa do merge,** um passo obrigatório: a conta que mescla tem "Keep my email addresses
  private" ligado (e, de preferência, "Block command line pushes that expose my email"). Quem confere é o Victor,
  dentro da própria caixa do merge, porque nem o DEV nem o auditor veem essa configuração. Na seção 6, a regra
  "nenhum e-mail em commit" passa a valer também para o commit do merge.
- **A mensagem do merge** (`:194`) é o próprio título do PR, que o GitHub já usa no corpo do merge. Assim, a
  mensagem aprovada sai certa sem depender de colar texto.
- **A primeira hora:** as leituras de +15 e +50 minutos têm hora certa, contada do READY do deploy, e vão ao
  relatório. Uma leitura perdida não se recupera. Por isso há redundância: o DEV também anota as duas horas e cobra
  a leitura do auditor em cada uma. Se a sessão do auditor cair, o DEV avisa o Victor antes de a janela de 1 h
  fechar.
- **A limpeza:** uma cópia com `node_modules` sob o scratchpad pode passar do limite de 260 caracteres do Windows. A
  saída é criar as cópias com um caminho curto, ou renomear a pasta para um nome curto antes de apagar. Nunca
  `--force` às cegas.
- A contagem dos achados (`:168`) passa de "hoje vamos no 266" para o último número no dia do commit, que o plano
  mede na hora.

**D. A cópia em LF (`:121`), escrita a partir da medição de 19/11:**
- para uma cópia em LF nesta máquina: `git -c core.autocrlf=false -c core.eol=lf worktree add …`;
- medido: 741 arquivos em LF, nenhum em CRLF, e o status vazio;
- o `-c` vale só para aquele comando. Depois, a cópia volta a usar o `core.autocrlf=true` do gitconfig do sistema, e
  o que o git reescrever nela (um checkout, um restore, um merge) sai em CRLF;
- nunca `git config` dentro de uma worktree, como já está.

**E. O banco de teste (seção 4, `:111-119`).**
- No guia: o container leva o nome do projeto do compose, que é o nome da pasta que o subiu. Para pará-lo, rode o
  `npm run banco:teste:parar` na mesma pasta, ou `docker compose -p <projeto> down -v`. Senão, o próximo
  `npm run banco:teste` bate no nome do container já em uso.
- **No `docker-compose.yml` (`:34-35`), só o comentário, como o Victor aprovou em 19/11:** "a 5433 é do container
  `n8x-marketing-db`" vira "a 5432 ou a 5433, conforme a máquina, são do Postgres instalado e do container
  `n8x-marketing-db`". Nenhuma linha que não seja comentário muda: a porta 5434 continua a mesma.

**F. A seção 7, com o estado de 19/11:**
- o título passa a "Onde paramos (19/11/2026)";
- na tabela dos 5 pontos, a linha 2 continua "Em andamento";
- **"O que vem a seguir"**, na nova ordem:
  1. o teste final do vídeo no LinkedIn, na produção. Quem clica é o Victor. O teste espera um acesso de leitura
     da produção para o auditor (o 276);
  2. um PR pequeno com o Next 16.4.6, para o alerta moderado do 16.4.3 (o 272);
  3. o LinkedIn no carrossel do gerador;
  4. as outras redes, cada uma com um desenho com o Victor;
- os itens 2 e 3 de hoje (`:215-216`, as limpezas) saem da lista, porque o que falta deles está na máquina do
  Eduardo;
- **"O que está anotado"** ganha duas linhas:
  - as cópias de trabalho do vídeo e as antigas com `.env.local` ficaram na máquina do Eduardo, e a limpeza delas é
    lá;
  - o GitHub guarda 39 ramos de PRs antigos, e apagá-los é uma decisão à parte.

**G. As abas (seção 5, perto da `:139`).** Uma linha: duas abas abertas sobre a mesma conversa viram duas sessões
com o mesmo papel. Só uma fica, a que o Victor confirmar pela caixa, e a outra para de escrever.

**H. A seção nova "10. Os textos de partida".** O texto de partida do DEV e o do AUDITOR, para copiar e colar como a
primeira mensagem de cada aba. Eles levam só as regras, sem nome de sessão, sem caminho de máquina e sem e-mail.

O do DEV:

> Você é o DEV do Método Chat nesta sessão. Antes de tudo, leia inteiros o COMECE-AQUI.md e o AGENTS.md.
> - As três regras da seção 1 do COMECE-AQUI valem sempre, e as da seção 4 também: o `npx` só com `--no-install`,
>   e a integração só com a `DATABASE_URL_TESTES` apontando para o banco de teste.
> - Você desenha com o Victor, escreve a spec e o plano, ensaia numa cópia isolada, escreve o código, roda os
>   testes, faz os commits e prepara os PRs.
> - O AUDITOR é a outra sessão aberta nesta mesma pasta. Ache-a com ListAgents e fale com ela por SendMessage. No
>   começo do dia, confirme com o Victor, pela caixa, qual sessão é o auditor.
> - Nenhum comando que grave roda sem o "pode" do auditor, nem para testar. Todo roteiro vai a ele antes, com o
>   sha256 e o número de linhas; um roteiro mudado vai com a versão anterior e o diff.
> - Toda linha citada é medida antes. Medição vence afirmação.
> - As decisões são do Victor, pela caixa, com o essencial dentro da pergunta e a opção recomendada primeiro.
> - Antes de cada escrita na produção: a caixa do Victor, a hora mandada ao auditor e o "pode" dele, nesta ordem.
> - Fale com o Victor sempre em português simples.

O do AUDITOR:

> Você é o AUDITOR do Método Chat nesta sessão. Antes de tudo, leia inteiros o COMECE-AQUI.md e o AGENTS.md.
> - As três regras da seção 1 do COMECE-AQUI valem sempre, e as da seção 4 também: o `npx` só com `--no-install`,
>   e a integração só com a `DATABASE_URL_TESTES` apontando para o banco de teste.
> - Você NÃO escreve código nem faz commit: você lê, mede e reporta.
> - O DEV é a outra sessão aberta nesta mesma pasta. Ache-a com ListAgents e fale com ela por SendMessage.
> - Para cada spec ou plano do DEV, responda: (1) está correto e resolve o problema? (2) existe uma opção melhor ou
>   mais simples? Qual, e por quê? (3) segue os padrões do projeto (COMECE-AQUI, specs e planos em docs/,
>   docs/auditoria-de-design-2026-09-10.md, teste antes do código, mutações, guarda do diff, estilo de commit)?
> - Confira cada fase do DEV rodando os testes você mesmo. Meça antes de afirmar, e só cite arquivo:linha depois de
>   conferir.
> - Todo roteiro do DEV passa por você antes de rodar, mesmo o que só lê.
> - Numere os achados em sequência, a partir do último que o guia registra, com a classe BLOQUEIA, CORRIGIR ou
>   ANOTAR.
> - A produção você só lê. Nada que grave lá roda sem o seu "pode", depois da caixa do Victor e da hora.
> - No fim do dia, escreva o relatório ao Victor.
> - Fale com o Victor sempre em português simples.
>
> Comece mandando ao DEV uma mensagem dizendo que está no ar.

## O que não muda

- **As regras em si.** Só muda quem decide. O ciclo, a caixa, o "pode", as medições e as mutações continuam iguais.
- **A história.** O Vinícius como autor da maior parte do código, os 5 pontos dele e os planos antigos, que citam o
  Eduardo, ficam como estão.
- **Nenhum código, teste, migração ou configuração**, fora o comentário das `:34-35` do `docker-compose.yml`.
  Medido: nenhum arquivo de `app/`, `lib/`, `scripts/`, `tests/`, `testes-dom/` ou
  `testes-integracao/` lê o `COMECE-AQUI.md`.
- **A seção 8 (as armadilhas) e a seção 9 (o que ler).**

## Como se confere

A entrega é só de texto, então não há RED nem GREEN de teste. A conferência é:
- **a guarda do diff:** só o `COMECE-AQUI.md`, esta spec, o plano e o `docker-compose.yml`, e, no compose, só
  linhas que começam com `#` (depois dos espaços);
- **a busca pelo nome:** depois da mudança, o `grep -n "Eduardo"` no guia só acha as linhas que falam dele de
  propósito (a máquina dele, na seção 7);
- **a varredura de texto** (controle e fim de linha) em cada arquivo tocado;
- **a leitura do texto inteiro pelo Victor**, antes do commit, como ele pediu em 18/11;
- **o `npm run verify`**, uma vez, porque o guia manda passá-lo antes de dizer que algo está pronto. Uma mudança só de
  texto não o altera, mas é ele que prova isso;
- **o ensaio** numa cópia de nome CURTO (o 307), e o plano que a auditoria aplica do zero.

## A prova

Não há código do app, então não há prova no preview. O deploy do merge confere o log ("Nada a aplicar…" e as 16
conferências), o site respondendo e os erros da Vercel, como no PR #40.
```

```bash
S="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/394c77f1-2a23-4c47-b600-4f9c6baec770/scratchpad"
C="$S/x"; G="$S/guia"; T="$S/item3"; P="$G/plano.md"
cd "$C" || exit 1
node "$T/extrair-bloco.mjs" "$P" docs/specs/2026-11-19-o-guia-com-o-victor.md docs/specs/2026-11-19-o-guia-com-o-victor.md
test "$(git hash-object docs/specs/2026-11-19-o-guia-com-o-victor.md)" = ec8ef5a7453c551cee87023244a68aa0417e174f || { echo "a spec não é a aprovada: pare"; exit 1; }
node "$T/varrer-texto.mjs" docs/specs/2026-11-19-o-guia-com-o-victor.md
bash "$G/guarda-do-diff.sh" "$C"; echo "guarda: $?"
```

Esperado: "GRAVADO: … (184 linhas …)"; "limpo docs/specs/2026-11-19-o-guia-com-o-victor.md (LF)"; a guarda com o
"dentro" da spec e 0. Depois, à parte:

```bash
cd "C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/394c77f1-2a23-4c47-b600-4f9c6baec770/scratchpad/x" || exit 1
test "$(git branch --show-current)" = guia && git add docs/specs/2026-11-19-o-guia-com-o-victor.md && git commit -m "A spec do guia com o Victor: as decisões passam a ele, e o guia ganha as lições do item 3 e os textos de partida"
git show HEAD | git patch-id --stable
```

Esperado: o patch-id `d7759b32557cc0171064308f4dbf5e09a1e259c0`.

## Passo 3: este plano, num commit próprio

O plano entra num commit só dele, depois da spec, porque a cita.

```bash
S="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/394c77f1-2a23-4c47-b600-4f9c6baec770/scratchpad"
C="$S/x"; G="$S/guia"; T="$S/item3"
cd "$C" || exit 1
test ! -e docs/plans/2026-11-19-o-guia-com-o-victor.md || { echo "o plano já existe na cópia: pare"; exit 1; }
cp "$G/plano.md" docs/plans/2026-11-19-o-guia-com-o-victor.md
cmp "$G/plano.md" docs/plans/2026-11-19-o-guia-com-o-victor.md && sha256sum docs/plans/2026-11-19-o-guia-com-o-victor.md
node "$T/varrer-texto.mjs" docs/plans/2026-11-19-o-guia-com-o-victor.md
bash "$G/guarda-do-diff.sh" "$C"; echo "guarda: $?"
```

Esperado: o sha256 que a auditoria leu; "limpo … (LF)"; a guarda com os dois "dentro" e 0. Depois, à parte:

```bash
cd "C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/394c77f1-2a23-4c47-b600-4f9c6baec770/scratchpad/x" || exit 1
test "$(git branch --show-current)" = guia && git add docs/plans/2026-11-19-o-guia-com-o-victor.md && git commit -m "O plano do guia com o Victor: as linhas trocadas, o ensaio, as sabotagens e o verify"
```

## FASE 1: o guia (o commit que repete o `eb5c1b6`)

O diff esperado, tirado do ensaio. É o texto final de cada linha trocada:

````diff
diff --git a/COMECE-AQUI.md b/COMECE-AQUI.md
index a6e320f..02dd408 100644
--- a/COMECE-AQUI.md
+++ b/COMECE-AQUI.md
@@ -2,7 +2,7 @@
 
 Guia para quem chega ao Método Chat. Ele explica o que o projeto faz, como o código está organizado, como a equipe trabalha (com um DEV e um AUDITOR), as regras de git e de produção, onde o trabalho parou e o que vem a seguir.
 
-Escrito em 18/11/2026. Se um fato daqui mudar, atualize este arquivo no mesmo PR da mudança.
+Escrito em 18/11/2026 e atualizado em 19/11/2026. Se um fato daqui mudar, atualize este arquivo no mesmo PR da mudança.
 
 > **Este repositório é PÚBLICO.** Tudo o que entra nele, inclusive commit e corpo de PR, qualquer pessoa lê. Nunca escreva aqui segredo, nome de cliente, conta de Instagram nem endereço interno.
 
@@ -10,8 +10,8 @@ Escrito em 18/11/2026. Se um fato daqui mudar, atualize este arquivo no mesmo PR
 
 ## 1. As três regras que não podem falhar
 
-1. **Nunca faça commit nem push na `main`.** Ela não tem proteção, e todo push nela dispara um deploy na Vercel de um app que atende contas reais de Instagram. Trabalhe sempre numa branch. A `main` só recebe código por PR, e quem mescla o PR é o Eduardo.
-2. **O banco do `.env.local` é o de PRODUÇÃO.** As credenciais da Meta e do LinkedIn moram no banco, e não em variável de ambiente, então um banco local vazio não fala com nenhuma rede. Isso é proposital. A consequência: todo clique que grava no painel rodando na sua máquina grava de verdade, na conta de um cliente. Antes de qualquer ação que grave, fale com o Eduardo e espere a resposta.
+1. **Nunca faça commit nem push na `main`.** Ela não tem proteção, e todo push nela dispara um deploy na Vercel de um app que atende contas reais de Instagram. Trabalhe sempre numa branch. A `main` só recebe código por PR, e quem mescla o PR é o Victor.
+2. **O banco do `.env.local` é o de PRODUÇÃO.** As credenciais da Meta e do LinkedIn moram no banco, e não em variável de ambiente, então um banco local vazio não fala com nenhuma rede. Isso é proposital. A consequência: todo clique que grava no painel rodando na sua máquina grava de verdade, na conta de um cliente. Antes de qualquer ação que grave, fale com o Victor e espere a resposta.
 3. **Segredo nunca vai para o código, para log, para commit, para PR nem para o chat.** O `.env.local` tem a `SUPABASE_SERVICE_ROLE_KEY`, que passa por cima de todas as regras de acesso do banco. Não imprima, não cole, não passe adiante.
 
 ---
@@ -69,7 +69,7 @@ Duas regras do dreno que você precisa conhecer:
 ### O banco e as migrações
 
 - O esquema vive em `migrations/` (hoje são 26, de `000` a `025`). O `npm run build` aplica as migrações novas com `scripts/migrar.mjs`, **só no deploy de produção**. No preview, o log diz "MIGRAÇÃO PULADA".
-- Uma migração que mexe em DADO não roda no build: ela é aplicada à mão, com a decisão do Eduardo (veja `docs/deploy/2026-09-23-a-012-sai-do-build.md`).
+- Uma migração que mexe em DADO não roda no build: ela é aplicada à mão, com a decisão do Victor (veja `docs/deploy/2026-09-23-a-012-sai-do-build.md`).
 - O deploy confere o esquema e escreve "Nada a aplicar: as 26 migrações já constam no registro." quando não há migração nova. Essa frase é conferida depois de todo merge.
 
 > **O `README.md` está desatualizado em dois pontos:** o banco é o Supabase, e não o Neon; e o esquema NÃO se cria sozinho no `lib/db.ts`: ele vive em `migrations/`. O `COMO-ATUALIZAR.md` descreve um caminho de merge pelo terminal direto na `main`, que esta equipe NÃO usa (veja a regra 1).
@@ -107,7 +107,7 @@ As specs e os planos contam o porquê de quase tudo. Antes de mexer numa área,
 ## 4. No seu computador
 
 1. Clone e instale com `npm ci` (e não `npm install`), para usar exatamente o `package-lock.json`. Nunca rode `npx` sem `--no-install`: ele baixa pacote sem pedir.
-2. O `.env.local` não vem no clone. Peça ao Eduardo. Lembre da regra 2: ele aponta para a produção.
+2. O `.env.local` não vem no clone. Peça ao Victor. Lembre da regra 2: ele aponta para a produção.
 3. Para os testes de integração, suba o banco de teste (Docker): `npm run banco:teste`. Ele cria o container `metodochat-banco-de-teste`, na porta 5434, só em `127.0.0.1`, com os dados em memória.
 4. Rode a integração **sempre** com a variável apontando para o container:
    ```bash
@@ -117,8 +117,9 @@ As specs e os planos contam o porquê de quase tudo. Antes de mexer numa área,
    - **Nunca rode sem a variável:** sem ela, a suíte cai na `DATABASE_URL`, que é a produção. A dica que a própria suíte imprime, "Rode sem DATABASE_URL_TESTES antes do merge", NÃO vale aqui.
    - Uma rodada de integração de cada vez, nunca duas juntas.
    - O container para entre um dia e outro: confira com `docker ps` antes de rodar.
+   - O container fica preso ao projeto do compose que o subiu, e o nome do projeto é o da pasta, em minúsculas. Pare-o com `npm run banco:teste:parar` nessa mesma pasta ou, na pasta principal, com `docker compose -p <projeto> -f docker-compose.yml down -v`. O `banco:teste:parar` rodado em outra pasta não o acha: ele continua de pé, e o próximo `npm run banco:teste` de outra pasta cai, porque o nome `metodochat-banco-de-teste` já está em uso.
 5. **Testes que caíam por tempo na primeira rodada de uma cópia nova** (`docs/specs/2026-11-18-testes-que-caem.md`): os casos e os ganchos de `tests/` que varrem a árvore, e os ganchos com `import()`, têm prazo próprio de 60 s, e `tests/prazo-das-varreduras.test.ts` confere isso. Um estouro de tempo neles agora é divergência, e não acaso. Na integração, um caso da migração 012 em `testes-integracao/migracao-dos-dados-legados.integracao.ts` ainda pode cair, pelo corte no segundo e não por prazo: rode o arquivo sozinho e depois a suíte inteira de novo. Se cair de novo, é defeito de verdade.
-6. **No Windows:** a cópia de trabalho fica em CRLF e o repositório em LF (`* text=auto`). Não rode `git config` dentro de uma worktree, porque ele grava no `.git/config` do repositório inteiro. Para uma cópia em LF, use `git -c core.autocrlf=false worktree add …` só no comando.
+6. **No Windows:** a cópia de trabalho fica em CRLF e o repositório em LF (`* text=auto`). Não rode `git config` dentro de uma worktree, porque ele grava no `.git/config` do repositório inteiro. Para uma cópia em LF, use `git -c core.autocrlf=false -c core.eol=lf worktree add …` (medido em 19/11/2026: 741 arquivos em LF e nenhum em CRLF). O `-c` vale só para esse comando: o que o git reescrever na cópia depois (um checkout, um restore, um merge) volta a sair em CRLF.
 
 ---
 
@@ -126,26 +127,26 @@ As specs e os planos contam o porquê de quase tudo. Antes de mexer numa área,
 
 **Todo trabalho aqui tem duas sessões do Claude Code rodando ao mesmo tempo, na mesma pasta do projeto.**
 
-- **O DEV** desenha com o Eduardo, escreve o plano, ensaia, escreve o código, roda os testes, faz os commits e prepara os PRs.
-- **O AUDITOR** não escreve código. Ele lê, mede e reporta: confere cada fase do DEV, lê a produção só para leitura (antes e depois de cada passo que grava), confere os textos de PR e escreve o relatório do dia ao Eduardo. Nenhum comando que grave roda sem o "pode" dele.
+- **O DEV** desenha com o Victor, escreve o plano, ensaia, escreve o código, roda os testes, faz os commits e prepara os PRs.
+- **O AUDITOR** não escreve código. Ele lê, mede e reporta: confere cada fase do DEV, lê a produção só para leitura (antes e depois de cada passo que grava), confere os textos de PR e escreve o relatório do dia ao Victor. Nenhum comando que grave roda sem o "pode" dele.
+  - **Como o auditor lê a produção, hoje:** pela Vercel, pelo conector, só com as ferramentas de leitura (os deploys, os registros de build e de execução, e os erros), e nunca promovendo, voltando ou mexendo em variável. O banco de produção, ele só lê quando houver um acesso de leitura, que ainda não existe. Até lá, numa entrega que não muda o app, a leitura da Vercel substitui a da base: ela não vê a fila, mas uma entrega assim não mexe nela (decisão do Victor em 19/11/2026). O plano Hobby guarda os registros de execução por uma hora só.
 
 Os dois são parceiros, e não adversários. O objetivo é a entrega sair certa.
 
 ### Abrindo o chat pelo workspace
 
 1. Abra a pasta do projeto no VS Code, com a extensão do Claude Code instalada.
-2. Abra **duas conversas** do Claude Code nessa mesma pasta. Uma recebe o papel de DEV, e a outra o de AUDITOR, pela primeira mensagem de cada uma. O Eduardo tem os textos de partida das duas sessões; este guia traz a versão atual das regras.
+2. Abra **duas conversas** do Claude Code nessa mesma pasta. Uma recebe o papel de DEV, e a outra o de AUDITOR, pela primeira mensagem de cada uma: os textos de partida estão na seção 10.
 3. Cada sessão ganha um nome (algo como `metodochat-xx`). Elas se acham com a ferramenta **ListAgents** e conversam sozinhas com a **SendMessage**, sem você copiar e colar nada entre elas.
 4. No começo do dia, o DEV confirma com você, por uma pergunta, qual sessão é o auditor daquele dia.
-
-> **Victor, você já sabe abrir duas conversas do Claude Code no mesmo workspace e fazer uma falar com a outra?** Se não souber, fale com o Eduardo antes de começar: ele mostra como é.
+5. Duas abas abertas sobre a mesma conversa viram duas sessões com o mesmo papel. Só fica uma, a que você confirmar, e a outra para de escrever.
 
 ### O ciclo de uma entrega
 
 Cada entrega passa pelas etapas abaixo, nesta ordem. Uma entrega pequena pode juntar etapas, mas nenhuma é pulada quando a mudança toca o motor, a fila, o login ou a produção.
 
-1. **Desenho com o Eduardo.** As decisões são dele, feitas por perguntas de múltipla escolha (a ferramenta AskUserQuestion, que chamamos de "a caixa"), uma por vez, com a opção recomendada primeiro.
-2. **Spec** em `docs/specs/AAAA-MM-DD-assunto.md`. O auditor lê antes do Eduardo.
+1. **Desenho com o Victor.** As decisões são dele, feitas por perguntas de múltipla escolha (a ferramenta AskUserQuestion, que chamamos de "a caixa"), uma por vez, com a opção recomendada primeiro.
+2. **Spec** em `docs/specs/AAAA-MM-DD-assunto.md`. O auditor lê antes do Victor.
 3. **Ensaio.** O código é escrito fase por fase numa cópia isolada (uma worktree com `npm ci` próprio e o `.env.local` VAZIO, para nada falar com a produção). Em cada fase:
    - o teste vem antes, e a falha dele é medida com o código ausente;
    - o código entra, e o teste passa;
@@ -153,19 +154,19 @@ Cada entrega passa pelas etapas abaixo, nesta ordem. Uma entrega pequena pode ju
    - a **guarda do diff** confere que só os arquivos previstos mudaram.
 4. **Mutações** (ou sabotagens): um roteiro estraga cada proteção de propósito, uma por vez, e confere que algum teste cai. A mutação que não cai é um teste que não mede nada.
 5. **Plano** em `docs/plans/`, com o código de cada fase escrito por inteiro. O auditor aplica o plano do zero numa cópia limpa e confere que sai igual ao ensaio. Quando a mudança toca o motor, um agente independente lê o plano também.
-6. **"Li, pode executar"** do Eduardo, pela caixa.
+6. **"Li, pode executar"** do Victor, pela caixa.
 7. **Execução** numa branch, fase por fase. O patch-id de cada fase tem de ser igual ao do ensaio, e o auditor confere cada uma.
-8. **Push da branch**, com o OK do Eduardo pela caixa. A Vercel monta um **preview**.
-9. **Prova no preview.** O preview grava no banco de PRODUÇÃO e publica nas redes de verdade, numa conta de provas. Quem clica é o Eduardo. Antes de cada clique, o auditor mede o relógio e a conta, lê a base e dá o "pode". O preview não tem o QStash: o que fica na fila só anda com o "Remarcar" da tela, usando o minuto que o relógio mostra.
-10. **PR**, com o OK do Eduardo. O corpo é lido pelo auditor antes.
-11. **Merge**, feito pelo Eduardo no GitHub, depois de uma leitura da base pelo auditor.
-12. **Deploy e primeira hora.** Confere-se o log do deploy, o site e, por uma hora, os erros e a fila contra a leitura de antes do merge.
+8. **Push da branch**, com o OK do Victor pela caixa. A Vercel monta um **preview**.
+9. **Prova no preview.** O preview grava no banco de PRODUÇÃO e publica nas redes de verdade, numa conta de provas. Quem clica é o Victor. Antes de cada clique, o auditor mede o relógio e a conta, lê a base e dá o "pode". O preview não tem o QStash: o que fica na fila só anda com o "Remarcar" da tela, usando o minuto que o relógio mostra.
+10. **PR**, com o OK do Victor. O corpo é lido pelo auditor antes.
+11. **Merge**, feito pelo Victor no GitHub, depois de uma leitura da base pelo auditor. Na própria caixa do merge, o Victor confirma que a conta dele no GitHub tem "Keep my email addresses private" ligado (e, de preferência, "Block command line pushes that expose my email"). Nem o DEV nem o auditor veem essa configuração, e sem ela o e-mail pessoal de quem mescla vai para o histórico público, no commit do merge.
+12. **Deploy e primeira hora.** Confere-se o log do deploy, o site e, por uma hora, os erros e a fila contra a leitura de antes do merge. As leituras de +15 e +50 minutos têm hora certa, contada do READY do deploy, e vão ao relatório: o Hobby guarda os registros por uma hora, e uma leitura perdida não se recupera. O DEV também anota as duas horas e cobra a leitura do auditor em cada uma. Se a sessão do auditor cair, o DEV avisa o Victor antes de a janela de uma hora fechar.
 13. **Teste na produção**, quando a entrega tem um caminho que o preview não alcança.
-14. **Limpeza** das cópias de trabalho, com o OK do Eduardo.
+14. **Limpeza** das cópias de trabalho, com o OK do Victor. Uma cópia com `node_modules` num caminho longo (como o scratchpad do Claude Code) passa do limite de 260 caracteres do Windows ao ser apagada, e o `git worktree remove` a deixa pela metade. Crie as cópias com um nome curto, ou renomeie a pasta para um nome curto antes de apagar. Nunca use `--force` às cegas.
 
 ### Os achados
 
-Todo problema achado ganha um número, em sequência (hoje vamos no 266), e uma classe:
+Todo problema achado ganha um número, em sequência (quando este guia foi atualizado, em 19/11/2026, íamos no 316; o último número fica no relatório do dia), e uma classe:
 - **BLOQUEIA:** a entrega não segue até resolver;
 - **CORRIGIR:** resolve antes de publicar;
 - **ANOTAR:** fica registrado e segue.
@@ -175,9 +176,9 @@ Todo problema achado ganha um número, em sequência (hoje vamos no 266), e uma
 - **Todo roteiro vai ao auditor antes de rodar,** com o sha256 e as linhas. Isso vale até para um roteiro que só lê. Um roteiro mudado vai com a versão anterior e o diff.
 - **Toda linha citada é medida antes.** Um `arquivo:linha` mandado a alguém foi conferido no commit certo, e não lembrado.
 - **Medição vence afirmação.** Quando uma sessão contradiz a outra, mede-se de novo e manda-se a medição.
-- **O essencial vai dentro da pergunta.** O texto escrito antes de uma caixa às vezes não chega ao Eduardo. Tudo o que ele precisa para decidir vai na própria pergunta e nas opções. Uma pergunta que só registra o que aconteceu (por exemplo, "Você fez o merge?") não tem opção recomendada e tem sempre "Não fiz / não lembro".
-- **Antes de cada escrita na produção:** o OK do Eduardo pela caixa, a hora mandada ao auditor e o "pode" dele, nesta ordem.
-- **Com o Eduardo, sempre em português,** em linguagem simples.
+- **O essencial vai dentro da pergunta.** O texto escrito antes de uma caixa às vezes não chega ao Victor. Tudo o que ele precisa para decidir vai na própria pergunta e nas opções. Uma pergunta que só registra o que aconteceu (por exemplo, "Você fez o merge?") não tem opção recomendada e tem sempre "Não fiz / não lembro".
+- **Antes de cada escrita na produção:** o OK do Victor pela caixa, a hora mandada ao auditor e o "pode" dele, nesta ordem.
+- **Com o Victor, sempre em português,** em linguagem simples.
 
 ---
 
@@ -188,18 +189,19 @@ Todo problema achado ganha um número, em sequência (hoje vamos no 266), e uma
 - **Confira a branch antes de cada commit.** Commit na branch errada não sobe: ele vai para a certa por `cherry-pick`.
 - **A mensagem do commit segue o estilo do Vinícius,** o autor original: uma frase em português que diz o EFEITO da mudança, sem prefixo (nada de `feat:` ou `docs:`), e o porquê no corpo, quando precisar. Exemplo: "O reels em MP4 sai também no LinkedIn, como vídeo em partes, só lá ou nas duas redes".
 - **Nenhum rodapé de IA,** nem `Co-Authored-By: Claude`, em commit, PR ou mensagem.
+- **Nenhum e-mail pessoal no histórico,** nem no commit do merge. O git de quem commita usa o e-mail noreply do GitHub, e a conta de quem mescla tem o e-mail privado ligado (o passo 11 da seção 5).
 - **Antes do commit,** varra os arquivos tocados atrás de caractere de controle e de fim de linha misturado: um escape comido (`\b` virando backspace) passa calado pelo lint, pelo tsc e pelos testes.
 - **O commit é um comando à parte,** rodado depois de ler a saída dos testes.
 - **O PR explica o porquê,** e não só o quê. O corpo não tem arroba solta (o GitHub avisa a conta com aquele nome), nem nome de cliente, nem conta de Instagram fora de crase, nem e-mail.
-- **A mensagem do merge** é preparada junto com o PR, no mesmo estilo.
+- **A mensagem do merge é o título do PR.** O GitHub escreve o commit do merge como "Merge pull request #N from …" e põe o título do PR no corpo. Por isso, o título é escrito no mesmo estilo e aprovado como a mensagem do merge: assim ela sai certa sem depender de colar texto na hora.
 
 ---
 
-## 7. Onde paramos (18/11/2026)
+## 7. Onde paramos (19/11/2026)
 
 ### Os 5 pontos que o Vinícius deixou
 
-O Vinícius, autor da maior parte do código, deixou cinco pontos sobre o que faltava. Desde 15/10/2026, o motor dele pode ser mudado com a decisão do Eduardo, seguindo o jeito dele: comentário com o porquê e a medição, função pura com teste, uma mutação por proteção e commit numa frase.
+O Vinícius, autor da maior parte do código, deixou cinco pontos sobre o que faltava. Desde 15/10/2026, o motor dele pode ser mudado com a decisão do Victor, seguindo o jeito do Vinícius: comentário com o porquê e a medição, função pura com teste, uma mutação por proteção e commit numa frase.
 
 | # | O ponto | Situação |
 |---|---|---|
@@ -211,11 +213,10 @@ O Vinícius, autor da maior parte do código, deixou cinco pontos sobre o que fa
 
 ### O que vem a seguir, nesta ordem
 
-1. **O teste final do vídeo no LinkedIn, na produção.** O vídeo foi para a produção em 17/11 (PR #38), e a primeira hora passou limpa. Falta publicar um vídeo de 30 s nas duas redes pela produção, que deve sair sozinho pelos tiques, em 5 partes. É o único caminho que o preview não alcança. O Eduardo clica, e o auditor acompanha.
-2. **A limpeza das cópias de trabalho do vídeo,** com o OK do Eduardo.
-3. **As cópias antigas de trabalho que ainda guardam um `.env.local`**: um plano pequeno, à parte. Os testes que caíam por tempo ganharam prazo próprio (a seção 4, item 5).
-4. **O LinkedIn no carrossel do gerador:** hoje o carrossel do gerador sai só no Instagram.
-5. **As outras redes.** Uma pesquisa de 06/11, ainda a conferir, aponta que o TikTok veta ferramenta de agência, que o X cobra por post e que o YouTube só aceita vídeo. Cada rede começa por um desenho com o Eduardo.
+1. **O teste final do vídeo no LinkedIn, na produção.** O vídeo foi para a produção em 17/11 (PR #38), e a primeira hora passou limpa. Falta publicar um vídeo de 30 s nas duas redes pela produção, que deve sair sozinho pelos tiques, em 5 partes. É o único caminho que o preview não alcança. O Victor clica, e o auditor acompanha. O teste espera um acesso de leitura da produção para o auditor, que ainda não existe.
+2. **O Next 16.4.6, num PR pequeno.** O 16.4.3 tem um alerta moderado, no `'use cache'`, que o projeto não usa. O conserto é o 16.4.6.
+3. **O LinkedIn no carrossel do gerador:** hoje o carrossel do gerador sai só no Instagram.
+4. **As outras redes.** Uma pesquisa de 06/11, ainda a conferir, aponta que o TikTok veta ferramenta de agência, que o X cobra por post e que o YouTube só aceita vídeo. Cada rede começa por um desenho com o Victor.
 
 ### O que está anotado e ainda aberto
 
@@ -225,11 +226,13 @@ O Vinícius, autor da maior parte do código, deixou cinco pontos sobre o que fa
 - **No preview, um "Remarcar"** para um minuto que ainda não chegou fica parado, porque lá a fila não anda sozinha. A tela poderia deixar mais claro qual minuto usar.
 - **A página de um carrossel** pode levar 30 s ou mais para carregar no preview. Não medido na produção.
 - **O custo da imagem em pé da capa** não tinha sido medido no painel da OpenAI até a última anotação (03/11).
+- **As cópias de trabalho do vídeo e as antigas que guardam um `.env.local`** ficaram na máquina do Eduardo, e a limpeza delas é lá.
+- **O GitHub guarda 39 ramos antigos,** fora a `main`. Apagá-los é uma decisão à parte.
 
 ### Ideias que NÃO são para construir agora
 
 - O painel pode virar, no futuro, um produto para várias empresas, com clientes isolados. Por enquanto, a regra é só manter o acesso por conta num lugar só, sem construir nada nessa direção.
-- O `LICENSE` limita o uso do código. Antes de qualquer coisa que venda o painel a terceiros, fale com o Eduardo.
+- O `LICENSE` limita o uso do código. Antes de qualquer coisa que venda o painel a terceiros, fale com o Victor.
 
 ---
 
@@ -249,4 +252,42 @@ O Vinícius, autor da maior parte do código, deixou cinco pontos sobre o que fa
 - `AGENTS.md`: esta versão do Next.js é diferente da que você conhece.
 - `docs/auditoria-de-design-2026-09-10.md`: o sistema visual (contraste, escala, raios e alvos de toque). Tela nova segue o que existe.
 - `docs/specs/` e `docs/plans/` da área em que você vai mexer.
-- O último plano entregue, `docs/plans/2026-11-16-linkedin-video.md`, como exemplo de como uma entrega é escrita, ensaiada e provada.
+- Exemplos de entrega escrita, ensaiada e provada: `docs/plans/2026-11-16-linkedin-video.md` (com prova no preview) e `docs/plans/2026-11-18-testes-que-caem.md` (sem mudança no app).
+
+---
+
+## 10. Os textos de partida
+
+Cada conversa do Claude Code recebe o papel pela primeira mensagem (a seção 5). Copie o texto do papel e cole como a primeira mensagem da conversa. Os textos trazem só as regras: o nome de cada sessão aparece na hora, pelo ListAgents.
+
+### O do DEV
+
+```text
+Você é o DEV do Método Chat nesta sessão. Antes de tudo, leia inteiros o COMECE-AQUI.md e o AGENTS.md.
+- As três regras da seção 1 do COMECE-AQUI valem sempre, e as da seção 4 também: o npx só com --no-install, e a integração só com a DATABASE_URL_TESTES apontando para o banco de teste.
+- Você desenha com o Victor, escreve a spec e o plano, ensaia numa cópia isolada, escreve o código, roda os testes, faz os commits e prepara os PRs.
+- O AUDITOR é a outra sessão aberta nesta mesma pasta. Ache-a com ListAgents e fale com ela por SendMessage. No começo do dia, confirme com o Victor, pela caixa, qual sessão é o auditor.
+- Nenhum comando que grave roda sem o "pode" do auditor, nem para testar. Todo roteiro vai a ele antes, com o sha256 e o número de linhas; um roteiro mudado vai com a versão anterior e o diff.
+- Toda linha citada é medida antes. Medição vence afirmação.
+- As decisões são do Victor, pela caixa, com o essencial dentro da pergunta e a opção recomendada primeiro.
+- Antes de cada escrita na produção: a caixa do Victor, a hora mandada ao auditor e o "pode" dele, nesta ordem.
+- Fale com o Victor sempre em português simples.
+```
+
+### O do AUDITOR
+
+```text
+Você é o AUDITOR do Método Chat nesta sessão. Antes de tudo, leia inteiros o COMECE-AQUI.md e o AGENTS.md.
+- As três regras da seção 1 do COMECE-AQUI valem sempre, e as da seção 4 também: o npx só com --no-install, e a integração só com a DATABASE_URL_TESTES apontando para o banco de teste.
+- Você NÃO escreve código nem faz commit: você lê, mede e reporta.
+- O DEV é a outra sessão aberta nesta mesma pasta. Ache-a com ListAgents e fale com ela por SendMessage.
+- Para cada spec ou plano do DEV, responda: (1) está correto e resolve o problema? (2) existe uma opção melhor ou mais simples? Qual, e por quê? (3) segue os padrões do projeto (COMECE-AQUI, specs e planos em docs/, docs/auditoria-de-design-2026-09-10.md, teste antes do código, mutações, guarda do diff, estilo de commit)?
+- Confira cada fase do DEV rodando os testes você mesmo. Meça antes de afirmar, e só cite arquivo:linha depois de conferir.
+- Todo roteiro do DEV passa por você antes de rodar, mesmo o que só lê.
+- Numere os achados em sequência, a partir do último do relatório do dia anterior, com a classe BLOQUEIA, CORRIGIR ou ANOTAR.
+- A produção você só lê. Nada que grave lá roda sem o seu "pode", depois da caixa do Victor e da hora.
+- No fim do dia, escreva o relatório ao Victor.
+- Fale com o Victor sempre em português simples.
+
+Comece mandando ao DEV uma mensagem dizendo que está no ar.
+```
````

```bash
S="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/394c77f1-2a23-4c47-b600-4f9c6baec770/scratchpad"
C="$S/x"; G="$S/guia"; T="$S/item3"
cd "$C" || exit 1
node "$G/aplicar-guia.mjs" "$C" guia || { echo "o aplicar parou: pare"; exit 1; }
test "$(git hash-object COMECE-AQUI.md)" = 02dd40897ce20da53e7bf8d6ab0b54f85ef5c496 || { echo "o guia não é o do ensaio: pare"; exit 1; }
node "$T/varrer-texto.mjs" COMECE-AQUI.md
echo "linhas com Eduardo:"; grep -n "Eduardo" COMECE-AQUI.md
bash "$G/guarda-do-diff.sh" "$C"; echo "guarda: $?"
```

Esperado: 38 linhas "COMECE-AQUI.md:N -> …" e "GRAVADO: 38 trocas no COMECE-AQUI.md, que passa de 252 para 293
linhas (CRLF)."; o blob igual; "limpo COMECE-AQUI.md (CRLF)"; uma só linha com "Eduardo", a `:229`; a guarda com os
três "dentro" e 0. Depois, à parte:

```bash
cd "C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/394c77f1-2a23-4c47-b600-4f9c6baec770/scratchpad/x" || exit 1
test "$(git branch --show-current)" = guia && git add COMECE-AQUI.md && git commit -m "O guia passa as decisões ao Victor, ganha as lições do item 3 e traz os textos de partida das duas sessões"
git show HEAD | git patch-id --stable
```

Esperado: o patch-id `8699ca2a9652aae8aa11c40d0019765c980bb443`.

## FASE 2: o comentário do compose (o commit que repete o `4b6a530`)

```diff
diff --git a/docker-compose.yml b/docker-compose.yml
index fa22193..955dc3e 100644
--- a/docker-compose.yml
+++ b/docker-compose.yml
@@ -31,8 +31,8 @@ services:
       POSTGRES_PASSWORD: postgres
       POSTGRES_DB: metodochat_testes
     ports:
-      # 5434, E A ESCOLHA FOI MEDIDA. Nesta máquina a 5432 já escuta (Postgres
-      # instalado) e a 5433 é do container `n8x-marketing-db`, que atende OUTRO
+      # 5434, E A ESCOLHA FOI MEDIDA. A 5432 ou a 5433, conforme a máquina, são do
+      # Postgres instalado e do container `n8x-marketing-db`, que atende OUTRO
       # produto da casa e estava de pé. Escolher porta "que parece livre" foi
       # como este arquivo nasceu errado na primeira tentativa.
       #
```

```bash
S="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/394c77f1-2a23-4c47-b600-4f9c6baec770/scratchpad"
C="$S/x"; G="$S/guia"; T="$S/item3"
cd "$C" || exit 1
node "$G/aplicar-guia.mjs" "$C" compose || { echo "o aplicar parou: pare"; exit 1; }
test "$(git hash-object docker-compose.yml)" = 955dc3e4b4f9d044acbfe59c95940d13db2abc81 || { echo "o compose não é o do ensaio: pare"; exit 1; }
node "$T/varrer-texto.mjs" docker-compose.yml
bash "$G/guarda-do-diff.sh" "$C"; echo "guarda: $?"
```

Esperado: "GRAVADO: 2 trocas no docker-compose.yml, que passa de 72 para 72 linhas (CRLF)."; o blob igual; "limpo
docker-compose.yml (CRLF)"; a guarda com os quatro "dentro", "docker-compose.yml: só comentário" e 0. Depois, à
parte:

```bash
cd "C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/394c77f1-2a23-4c47-b600-4f9c6baec770/scratchpad/x" || exit 1
test "$(git branch --show-current)" = guia && git add docker-compose.yml && git commit -m "O comentário do banco de teste deixa de cravar a porta do n8x, que muda conforme a máquina"
git show HEAD | git patch-id --stable
```

Esperado: o patch-id `4fc934b64e1f86b262303074f6349e551f461206`.

## As sabotagens, de novo, no ramo que vai ao PR

As mesmas 5 do ensaio (o apêndice B), sobre a árvore commitada e limpa da FASE 2:

```bash
S="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/394c77f1-2a23-4c47-b600-4f9c6baec770/scratchpad"
C="$S/x"; G="$S/guia"
cd "$C" || exit 1
test "$(git show HEAD | git patch-id --stable | cut -d' ' -f1)" = 4fc934b64e1f86b262303074f6349e551f461206 || { echo "o HEAD não é a FASE 2 provada: pare"; exit 1; }
test -z "$(git status --porcelain)" || { echo "a árvore não está limpa: pare"; exit 1; }
echo "== 1: o aplicar de novo, sobre o guia já trocado"; node "$G/aplicar-guia.mjs" "$C" guia; echo "saiu com $?"
echo "== 2: o aplicar de novo, sobre o compose já trocado"; node "$G/aplicar-guia.mjs" "$C" compose; echo "saiu com $?"
echo "== 3: um arquivo fora da spec"; : > zz-sabotagem.txt; bash "$G/guarda-do-diff.sh" "$C"; echo "guarda: $?"; rm zz-sabotagem.txt
echo "== 4: uma linha que não é comentário no compose"; printf 'x: 1\r\n' >> docker-compose.yml; bash "$G/guarda-do-diff.sh" "$C"; echo "guarda: $?"; git checkout -- docker-compose.yml
echo "== 5: uma linha em branco no compose"; printf '\r\n' >> docker-compose.yml; bash "$G/guarda-do-diff.sh" "$C"; echo "guarda: $?"; git checkout -- docker-compose.yml
git status --porcelain; echo "(status acima; vazio = limpo)"
```

Esperado: o mesmo do apêndice B, com o "dentro" do plano a mais nas sabotagens 3, 4 e 5, e o status vazio no fim.

## O verify inteiro

O build roda o `scripts/migrar.mjs --aplicar`. Na cópia, com o `.env.local` vazio e sem `VERCEL_ENV`, ele escreve
"MIGRAÇÃO PULADA" e sai sem abrir conexão com o banco, como no PR #40. O `next build` roda sem as variáveis de agente,
porque o Next pode reescrever o bloco do `AGENTS.md`.

```bash
S="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/394c77f1-2a23-4c47-b600-4f9c6baec770/scratchpad"
C="$S/x"; G="$S/guia"
cd "$C" || exit 1
env -u CLAUDECODE -u AI_AGENT npm run verify 2>&1 | tee "$G/exec-verify.log"; echo "verify: ${PIPESTATUS[0]}"
git diff --stat -- AGENTS.md
git status --porcelain; echo "(status acima; vazio = limpo)"
bash "$G/guarda-do-diff.sh" "$C"; echo "guarda: $?"
```

Esperado: "verify: 0"; no registro, a pura com 163 arquivos e 3 884 casos, a de tela com 36 e 350, "MIGRAÇÃO
PULADA" e o build do Next concluído; o `git diff` do `AGENTS.md` vazio; o status vazio; e a guarda com os quatro
"dentro" e 0. Uma mudança só de texto não altera o verify, e é ele que prova isso.

A integração não roda: nenhum arquivo que ela lê muda.

## O envio: o push, a prévia, o PR e o merge

No molde do PR #40 (`docs/plans/2026-11-18-testes-que-caem.md`), com as lições dele já no guia novo: a leitura da
produção pela Vercel (o 308), o e-mail privado conferido na caixa do merge (o 304), a mensagem do merge igual ao
título do PR (o 305) e as duas leituras da primeira hora com hora certa e redundância (o 306). A auditoria só usa
ferramentas de leitura do conector: nunca promover, voltar, mexer em variável ou gravar qualquer coisa.

**Envio 1: a conferência antes do push.** Repetida, igual, antes do PR (Envio 4) e antes da caixa do merge
(Envio 5).

```bash
cd "C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/394c77f1-2a23-4c47-b600-4f9c6baec770/scratchpad/x" || exit 1
git fetch origin
test "$(git rev-parse --short origin/main)" = 4182066 && echo "origin/main em 4182066"
test "$(git branch --show-current)" = guia && echo "no ramo certo"
git log --oneline 4182066..HEAD                            # 4 commits: a spec, o plano, a FASE 1 e a FASE 2
git log --format='%an' 4182066..HEAD | sort -u             # só Victor Souza
git log --format='%ae' 4182066..HEAD | sed 's/^.*@//' | sort -u   # só users.noreply.github.com
git log --format=%B 4182066..HEAD | grep -ci "co-authored" # 0
git status --porcelain                                     # vazio
```

Se qualquer linha divergir, pare.

**Envio 2: o push do ramo,** com o OK do Victor pela caixa.

```bash
cd "C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/394c77f1-2a23-4c47-b600-4f9c6baec770/scratchpad/x" || exit 1
test -z "$(git ls-remote origin refs/heads/guia)" || { echo "o ramo já existe no remoto: pare"; exit 1; }
test "$(git branch --show-current)" = guia && git push -u origin refs/heads/guia:refs/heads/guia
```

**Envio 3: a prévia, só lendo.** A Vercel monta uma prévia do ramo. Ninguém clica em nada nela: a prévia grava na
produção, e esta entrega não tem prova de tela. No log do build, lido pela auditoria pelo conector: o commit;
"Detected Next.js version: 16.4.3"; "MIGRAÇÃO PULADA"; e nenhum aviso do Node 26.

**Envio 4: o PR,** com o OK do Victor pela caixa.
- Antes, os dois "[A PREENCHER …]" de `G/pr-corpo.md` são preenchidos: o do resultado do Passo D e o dos números
  medidos no verify. A auditoria relê o corpo inteiro, com o sha256 novo. Ele não tem arroba solta, nem e-mail, nem rodapé de IA, nem `Co-Authored-By`.
- **O título do PR é a mensagem do merge** (o 305): "O guia passa as decisões ao Victor, ganha as lições do item 3 e
  traz os textos de partida das duas sessões". A caixa do PR mostra o título como a mensagem que vai ao merge.
- A conferência do Envio 1, de novo. Depois:

```bash
S="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/394c77f1-2a23-4c47-b600-4f9c6baec770/scratchpad"
cd "$S/x" || exit 1
gh pr create --base main --head guia --title "O guia passa as decisões ao Victor, ganha as lições do item 3 e traz os textos de partida das duas sessões" --body-file "$S/guia/pr-corpo.md"
```

**Envio 5: antes do merge.** O merge publica na produção (a `main` faz o deploy), então vale a ordem: a caixa do
Victor, a hora mandada à auditoria e o "pode" dela.
1. A conferência do Envio 1, de novo.
2. O commit provado é o que vai ao merge:

```bash
cd "C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/394c77f1-2a23-4c47-b600-4f9c6baec770/scratchpad/x" || exit 1
git rev-parse HEAD                                    # o commit provado
git ls-remote origin refs/heads/guia | cut -f1        # o mesmo
gh pr view guia --json headRefOid --jq .headRefOid    # o mesmo
```

   Se os três não forem o mesmo commit, pare.
3. **A caixa do merge**, com o essencial dentro: a mensagem do merge é o título do PR, e o Victor confirma, na
   própria caixa, que a conta dele no GitHub tem "Keep my email addresses private" ligado (o 304). Se não tiver, o
   merge espera.
4. A hora mandada à auditoria.
5. **A linha de base, pela Vercel** (a regra do 308): o `list_deployments` de produção (o último READY, na
   `4182066`, e nenhum build em andamento), e o `get_runtime_errors` e o `get_runtime_logs` com nível error/fatal,
   desde 30 min antes.
6. O "pode" da auditoria. O merge é do Victor, no GitHub. A caixa seguinte é de resultado: sem "(Recomendado)" e com
   "Não fiz / não lembro". Nela, o Victor diz também se o corpo do merge saiu com o título do PR.

**Envio 6: o deploy do merge,** lido pela auditoria pelo conector:
- o deploy novo de produção READY, no sha do merge;
- no log do build: o commit do merge; "Detected Next.js version: 16.4.3"; "Nada a aplicar: as 26 migrações já
  constam no registro."; "NENHUMA DDL de esquema foi executada, então nenhuma trava foi pedida."; as mesmas 16
  linhas "CONFERIDO no banco:"; nenhum aviso do Node 26; e nenhuma linha de nível error;
- o DEV confere, só lendo, no domínio de produção: o `/entrar` dá 200, e o cron sem senha (`/api/cron/daily`) dá 401;
- o DEV confere que o merge não tem e-mail pessoal: `git log -1 --format='%ae %ce' <sha do merge> | sed 's/[^ ]*@/@/g'`
  mostra só domínios do GitHub (`@users.noreply.github.com` ou `@github.com`), e nenhum outro;
- se o deploy der erro, nada novo vai à `main`, e o caso vai à caixa, com o log.

**Envio 7: a primeira hora (a regra do 306).**
- O DEV anota as duas horas, contadas do READY do deploy novo: +15 min e +50 min. Em cada uma, a auditoria lê o
  `get_runtime_errors` e o `get_runtime_logs` (nível error/fatal), e o DEV cobra a leitura dela. As duas horas vão ao
  relatório.
- Se a sessão da auditoria cair, o DEV avisa o Victor antes de a janela de uma hora fechar.
- Passa com zero, ou só com o que já estava na linha de base. Se divergir, pare e avise. O caminho de volta é
  promover de novo o deploy da `4182066`. Isso grava na produção: só com a caixa do Victor, e quem promove é o
  Victor, ou o DEV com o "pode" da auditoria.

**Envio 8: a limpeza,** com o OK do Victor pela caixa, depois da primeira hora fechada:
- as duas worktrees: a do ensaio (`$S/g`, sem `node_modules`) e a da execução (`$S/x`). Se o Passo 1 mediu algum
  caminho acima de 259 caracteres, a `x` é renomeada para um caminho mais curto antes de apagar. Nunca `--force` às
  cegas;
- os ramos locais `ensaio-guia` e `guia`;
- o ramo `guia` no remoto, se o GitHub não o apagar no merge.

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

<!-- bloco: guarda-do-diff.sh -->
```bash
#!/usr/bin/env bash
# O PR do guia: a guarda do diff. Só lê. Na cópia dada (a do ensaio ou a da execução), confere, contra a 4182066:
#   - que só os quatro caminhos previstos pela spec (docs/specs/2026-11-19-o-guia-com-o-victor.md) estão alterados
#     ou novos;
#   - que, no docker-compose.yml, toda linha tirada ou posta é comentário (espaços e depois "#"); uma linha em
#     branco tirada ou posta também conta como fora.
# Uso: guarda-do-diff.sh <raiz-da-copia>   (sai com 0 se tudo está dentro; com 1 e a lista do que está fora)
set -u
C="${1:-}"
[ -n "$C" ] || { echo "uso: guarda-do-diff.sh <raiz-da-copia>"; exit 1; }
BASE="4182066"
cd "$C" || exit 1
PREVISTOS="
COMECE-AQUI.md
docker-compose.yml
docs/specs/2026-11-19-o-guia-com-o-victor.md
docs/plans/2026-11-19-o-guia-com-o-victor.md
"
# --no-renames (achado 286): com a detecção de renome, um arquivo movido mostraria só o destino.
MUDADOS=$( { git diff --no-renames --name-only "$BASE"; git ls-files --others --exclude-standard; } | sort -u )
FORA=0
for p in $MUDADOS; do
  if printf '%s\n' "$PREVISTOS" | grep -qxF "$p"; then echo "dentro: $p"; else echo "FORA DA SPEC: $p"; FORA=1; fi
done
if printf '%s\n' "$MUDADOS" | grep -qxF docker-compose.yml; then
  NAO_COMENTARIO=$(git diff --no-renames -U0 "$BASE" -- docker-compose.yml \
    | grep -E '^[-+]' \
    | grep -vE '^(\+\+\+ (b/|/dev/null)|--- (a/|/dev/null))' \
    | grep -vE '^[-+][[:space:]]*#')
  if [ -z "$NAO_COMENTARIO" ]; then
    echo "docker-compose.yml: só comentário"
  else
    echo "docker-compose.yml FORA DO COMENTÁRIO:"
    printf '%s\n' "$NAO_COMENTARIO"
    FORA=1
  fi
fi
[ -n "$MUDADOS" ] || echo "(nada mudou)"
exit $FORA
```

<!-- bloco: aplicar-guia.mjs -->
````js
// O PR do guia (docs/specs/2026-11-19-o-guia-com-o-victor.md). GRAVA na cópia dada, um arquivo por vez:
//   guia     -> o COMECE-AQUI.md: os papéis com o Victor, as lições do item 3, a seção 7 de 19/11 e a seção 10;
//   compose  -> o comentário das :34-35 do docker-compose.yml (achado 303).
// Tudo ou nada: o arquivo tem de ter o número de linhas esperado, e cada linha antiga tem de estar EXATAMENTE no
// número dado (comparada sem o CR); senão, ele para sem gravar. As trocas são aplicadas de baixo para cima, para que
// os números das linhas antigas valham até o fim. O fim de linha do arquivo fica como está: se ele tem CRLF, cada
// linha nova ganha o CR.
// Uso: node aplicar-guia.mjs <raiz-da-copia> guia|compose
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [raiz, alvo] = process.argv.slice(2);
if (!raiz || !["guia", "compose"].includes(alvo)) {
  console.error("uso: node aplicar-guia.mjs <raiz-da-copia> guia|compose");
  process.exit(1);
}

// Troca um trecho que aparece EXATAMENTE uma vez na linha.
const trocaUma = (n, texto, de, para) => {
  if (texto.split(de).length !== 2) {
    console.log(`PARADO, NADA GRAVADO: a linha ${n} não tem "${de}" exatamente uma vez`);
    process.exit(1);
  }
  return texto.replace(de, para);
};
// [linha, antiga, novas]: a antiga sai, e as novas entram no lugar dela (zero novas = a linha sai).
const nome = (n, antiga, de, para) => [n, antiga, [trocaUma(n, antiga, de, para)]];
const depoisDe = (n, antiga, ...novas) => [n, antiga, [antiga, ...novas]];
const trocaEDepois = (n, antiga, nova, ...novas) => [n, antiga, [nova, ...novas]];

const L130 =
  "- **O AUDITOR** não escreve código. Ele lê, mede e reporta: confere cada fase do DEV, lê a produção só para leitura (antes e depois de cada passo que grava), confere os textos de PR e escreve o relatório do dia ao Eduardo. Nenhum comando que grave roda sem o \"pode\" dele.";

const GUIA = [
  [
    5,
    "Escrito em 18/11/2026. Se um fato daqui mudar, atualize este arquivo no mesmo PR da mudança.",
    ["Escrito em 18/11/2026 e atualizado em 19/11/2026. Se um fato daqui mudar, atualize este arquivo no mesmo PR da mudança."],
  ],
  nome(
    13,
    "1. **Nunca faça commit nem push na `main`.** Ela não tem proteção, e todo push nela dispara um deploy na Vercel de um app que atende contas reais de Instagram. Trabalhe sempre numa branch. A `main` só recebe código por PR, e quem mescla o PR é o Eduardo.",
    "é o Eduardo.",
    "é o Victor.",
  ),
  nome(
    14,
    "2. **O banco do `.env.local` é o de PRODUÇÃO.** As credenciais da Meta e do LinkedIn moram no banco, e não em variável de ambiente, então um banco local vazio não fala com nenhuma rede. Isso é proposital. A consequência: todo clique que grava no painel rodando na sua máquina grava de verdade, na conta de um cliente. Antes de qualquer ação que grave, fale com o Eduardo e espere a resposta.",
    "fale com o Eduardo",
    "fale com o Victor",
  ),
  nome(
    72,
    "- Uma migração que mexe em DADO não roda no build: ela é aplicada à mão, com a decisão do Eduardo (veja `docs/deploy/2026-09-23-a-012-sai-do-build.md`).",
    "decisão do Eduardo",
    "decisão do Victor",
  ),
  nome(
    110,
    "2. O `.env.local` não vem no clone. Peça ao Eduardo. Lembre da regra 2: ele aponta para a produção.",
    "Peça ao Eduardo.",
    "Peça ao Victor.",
  ),
  depoisDe(
    119,
    "   - O container para entre um dia e outro: confira com `docker ps` antes de rodar.",
    "   - O container fica preso ao projeto do compose que o subiu, e o nome do projeto é o da pasta, em minúsculas. Pare-o com `npm run banco:teste:parar` nessa mesma pasta ou, na pasta principal, com `docker compose -p <projeto> -f docker-compose.yml down -v`. O `banco:teste:parar` rodado em outra pasta não o acha: ele continua de pé, e o próximo `npm run banco:teste` de outra pasta cai, porque o nome `metodochat-banco-de-teste` já está em uso.",
  ),
  [
    121,
    "6. **No Windows:** a cópia de trabalho fica em CRLF e o repositório em LF (`* text=auto`). Não rode `git config` dentro de uma worktree, porque ele grava no `.git/config` do repositório inteiro. Para uma cópia em LF, use `git -c core.autocrlf=false worktree add …` só no comando.",
    ["6. **No Windows:** a cópia de trabalho fica em CRLF e o repositório em LF (`* text=auto`). Não rode `git config` dentro de uma worktree, porque ele grava no `.git/config` do repositório inteiro. Para uma cópia em LF, use `git -c core.autocrlf=false -c core.eol=lf worktree add …` (medido em 19/11/2026: 741 arquivos em LF e nenhum em CRLF). O `-c` vale só para esse comando: o que o git reescrever na cópia depois (um checkout, um restore, um merge) volta a sair em CRLF."],
  ],
  nome(
    129,
    "- **O DEV** desenha com o Eduardo, escreve o plano, ensaia, escreve o código, roda os testes, faz os commits e prepara os PRs.",
    "com o Eduardo",
    "com o Victor",
  ),
  [
    130,
    L130,
    [
      trocaUma(130, L130, "ao Eduardo.", "ao Victor."),
      "  - **Como o auditor lê a produção, hoje:** pela Vercel, pelo conector, só com as ferramentas de leitura (os deploys, os registros de build e de execução, e os erros), e nunca promovendo, voltando ou mexendo em variável. O banco de produção, ele só lê quando houver um acesso de leitura, que ainda não existe. Até lá, numa entrega que não muda o app, a leitura da Vercel substitui a da base: ela não vê a fila, mas uma entrega assim não mexe nela (decisão do Victor em 19/11/2026). O plano Hobby guarda os registros de execução por uma hora só.",
    ],
  ],
  [
    137,
    "2. Abra **duas conversas** do Claude Code nessa mesma pasta. Uma recebe o papel de DEV, e a outra o de AUDITOR, pela primeira mensagem de cada uma. O Eduardo tem os textos de partida das duas sessões; este guia traz a versão atual das regras.",
    ["2. Abra **duas conversas** do Claude Code nessa mesma pasta. Uma recebe o papel de DEV, e a outra o de AUDITOR, pela primeira mensagem de cada uma: os textos de partida estão na seção 10."],
  ],
  depoisDe(
    139,
    "4. No começo do dia, o DEV confirma com você, por uma pergunta, qual sessão é o auditor daquele dia.",
    "5. Duas abas abertas sobre a mesma conversa viram duas sessões com o mesmo papel. Só fica uma, a que você confirmar, e a outra para de escrever.",
  ),
  [
    141,
    "> **Victor, você já sabe abrir duas conversas do Claude Code no mesmo workspace e fazer uma falar com a outra?** Se não souber, fale com o Eduardo antes de começar: ele mostra como é.",
    [],
  ],
  [142, "", []],
  nome(
    147,
    "1. **Desenho com o Eduardo.** As decisões são dele, feitas por perguntas de múltipla escolha (a ferramenta AskUserQuestion, que chamamos de \"a caixa\"), uma por vez, com a opção recomendada primeiro.",
    "com o Eduardo.",
    "com o Victor.",
  ),
  nome(
    148,
    "2. **Spec** em `docs/specs/AAAA-MM-DD-assunto.md`. O auditor lê antes do Eduardo.",
    "antes do Eduardo.",
    "antes do Victor.",
  ),
  nome(156, "6. **\"Li, pode executar\"** do Eduardo, pela caixa.", "do Eduardo,", "do Victor,"),
  nome(
    158,
    "8. **Push da branch**, com o OK do Eduardo pela caixa. A Vercel monta um **preview**.",
    "do Eduardo pela",
    "do Victor pela",
  ),
  nome(
    159,
    "9. **Prova no preview.** O preview grava no banco de PRODUÇÃO e publica nas redes de verdade, numa conta de provas. Quem clica é o Eduardo. Antes de cada clique, o auditor mede o relógio e a conta, lê a base e dá o \"pode\". O preview não tem o QStash: o que fica na fila só anda com o \"Remarcar\" da tela, usando o minuto que o relógio mostra.",
    "é o Eduardo.",
    "é o Victor.",
  ),
  nome(160, "10. **PR**, com o OK do Eduardo. O corpo é lido pelo auditor antes.", "do Eduardo.", "do Victor."),
  [
    161,
    "11. **Merge**, feito pelo Eduardo no GitHub, depois de uma leitura da base pelo auditor.",
    ["11. **Merge**, feito pelo Victor no GitHub, depois de uma leitura da base pelo auditor. Na própria caixa do merge, o Victor confirma que a conta dele no GitHub tem \"Keep my email addresses private\" ligado (e, de preferência, \"Block command line pushes that expose my email\"). Nem o DEV nem o auditor veem essa configuração, e sem ela o e-mail pessoal de quem mescla vai para o histórico público, no commit do merge."],
  ],
  [
    162,
    "12. **Deploy e primeira hora.** Confere-se o log do deploy, o site e, por uma hora, os erros e a fila contra a leitura de antes do merge.",
    ["12. **Deploy e primeira hora.** Confere-se o log do deploy, o site e, por uma hora, os erros e a fila contra a leitura de antes do merge. As leituras de +15 e +50 minutos têm hora certa, contada do READY do deploy, e vão ao relatório: o Hobby guarda os registros por uma hora, e uma leitura perdida não se recupera. O DEV também anota as duas horas e cobra a leitura do auditor em cada uma. Se a sessão do auditor cair, o DEV avisa o Victor antes de a janela de uma hora fechar."],
  ],
  [
    164,
    "14. **Limpeza** das cópias de trabalho, com o OK do Eduardo.",
    ["14. **Limpeza** das cópias de trabalho, com o OK do Victor. Uma cópia com `node_modules` num caminho longo (como o scratchpad do Claude Code) passa do limite de 260 caracteres do Windows ao ser apagada, e o `git worktree remove` a deixa pela metade. Crie as cópias com um nome curto, ou renomeie a pasta para um nome curto antes de apagar. Nunca use `--force` às cegas."],
  ],
  [
    168,
    "Todo problema achado ganha um número, em sequência (hoje vamos no 266), e uma classe:",
    ["Todo problema achado ganha um número, em sequência (quando este guia foi atualizado, em 19/11/2026, íamos no 316; o último número fica no relatório do dia), e uma classe:"],
  ],
  nome(
    178,
    "- **O essencial vai dentro da pergunta.** O texto escrito antes de uma caixa às vezes não chega ao Eduardo. Tudo o que ele precisa para decidir vai na própria pergunta e nas opções. Uma pergunta que só registra o que aconteceu (por exemplo, \"Você fez o merge?\") não tem opção recomendada e tem sempre \"Não fiz / não lembro\".",
    "ao Eduardo.",
    "ao Victor.",
  ),
  nome(
    179,
    "- **Antes de cada escrita na produção:** o OK do Eduardo pela caixa, a hora mandada ao auditor e o \"pode\" dele, nesta ordem.",
    "do Eduardo pela",
    "do Victor pela",
  ),
  nome(180, "- **Com o Eduardo, sempre em português,** em linguagem simples.", "o Eduardo,", "o Victor,"),
  depoisDe(
    190,
    "- **Nenhum rodapé de IA,** nem `Co-Authored-By: Claude`, em commit, PR ou mensagem.",
    "- **Nenhum e-mail pessoal no histórico,** nem no commit do merge. O git de quem commita usa o e-mail noreply do GitHub, e a conta de quem mescla tem o e-mail privado ligado (o passo 11 da seção 5).",
  ),
  [
    194,
    "- **A mensagem do merge** é preparada junto com o PR, no mesmo estilo.",
    ["- **A mensagem do merge é o título do PR.** O GitHub escreve o commit do merge como \"Merge pull request #N from …\" e põe o título do PR no corpo. Por isso, o título é escrito no mesmo estilo e aprovado como a mensagem do merge: assim ela sai certa sem depender de colar texto na hora."],
  ],
  [198, "## 7. Onde paramos (18/11/2026)", ["## 7. Onde paramos (19/11/2026)"]],
  [
    202,
    "O Vinícius, autor da maior parte do código, deixou cinco pontos sobre o que faltava. Desde 15/10/2026, o motor dele pode ser mudado com a decisão do Eduardo, seguindo o jeito dele: comentário com o porquê e a medição, função pura com teste, uma mutação por proteção e commit numa frase.",
    ["O Vinícius, autor da maior parte do código, deixou cinco pontos sobre o que faltava. Desde 15/10/2026, o motor dele pode ser mudado com a decisão do Victor, seguindo o jeito do Vinícius: comentário com o porquê e a medição, função pura com teste, uma mutação por proteção e commit numa frase."],
  ],
  [
    214,
    "1. **O teste final do vídeo no LinkedIn, na produção.** O vídeo foi para a produção em 17/11 (PR #38), e a primeira hora passou limpa. Falta publicar um vídeo de 30 s nas duas redes pela produção, que deve sair sozinho pelos tiques, em 5 partes. É o único caminho que o preview não alcança. O Eduardo clica, e o auditor acompanha.",
    ["1. **O teste final do vídeo no LinkedIn, na produção.** O vídeo foi para a produção em 17/11 (PR #38), e a primeira hora passou limpa. Falta publicar um vídeo de 30 s nas duas redes pela produção, que deve sair sozinho pelos tiques, em 5 partes. É o único caminho que o preview não alcança. O Victor clica, e o auditor acompanha. O teste espera um acesso de leitura da produção para o auditor, que ainda não existe."],
  ],
  [
    215,
    "2. **A limpeza das cópias de trabalho do vídeo,** com o OK do Eduardo.",
    ["2. **O Next 16.4.6, num PR pequeno.** O 16.4.3 tem um alerta moderado, no `'use cache'`, que o projeto não usa. O conserto é o 16.4.6."],
  ],
  [
    216,
    "3. **As cópias antigas de trabalho que ainda guardam um `.env.local`**: um plano pequeno, à parte. Os testes que caíam por tempo ganharam prazo próprio (a seção 4, item 5).",
    ["3. **O LinkedIn no carrossel do gerador:** hoje o carrossel do gerador sai só no Instagram."],
  ],
  [
    217,
    "4. **O LinkedIn no carrossel do gerador:** hoje o carrossel do gerador sai só no Instagram.",
    ["4. **As outras redes.** Uma pesquisa de 06/11, ainda a conferir, aponta que o TikTok veta ferramenta de agência, que o X cobra por post e que o YouTube só aceita vídeo. Cada rede começa por um desenho com o Victor."],
  ],
  [
    218,
    "5. **As outras redes.** Uma pesquisa de 06/11, ainda a conferir, aponta que o TikTok veta ferramenta de agência, que o X cobra por post e que o YouTube só aceita vídeo. Cada rede começa por um desenho com o Eduardo.",
    [],
  ],
  depoisDe(
    227,
    "- **O custo da imagem em pé da capa** não tinha sido medido no painel da OpenAI até a última anotação (03/11).",
    "- **As cópias de trabalho do vídeo e as antigas que guardam um `.env.local`** ficaram na máquina do Eduardo, e a limpeza delas é lá.",
    "- **O GitHub guarda 39 ramos antigos,** fora a `main`. Apagá-los é uma decisão à parte.",
  ),
  nome(
    232,
    "- O `LICENSE` limita o uso do código. Antes de qualquer coisa que venda o painel a terceiros, fale com o Eduardo.",
    "com o Eduardo.",
    "com o Victor.",
  ),
  trocaEDepois(
    252,
    "- O último plano entregue, `docs/plans/2026-11-16-linkedin-video.md`, como exemplo de como uma entrega é escrita, ensaiada e provada.",
    "- Exemplos de entrega escrita, ensaiada e provada: `docs/plans/2026-11-16-linkedin-video.md` (com prova no preview) e `docs/plans/2026-11-18-testes-que-caem.md` (sem mudança no app).",
    "",
    "---",
    "",
    "## 10. Os textos de partida",
    "",
    "Cada conversa do Claude Code recebe o papel pela primeira mensagem (a seção 5). Copie o texto do papel e cole como a primeira mensagem da conversa. Os textos trazem só as regras: o nome de cada sessão aparece na hora, pelo ListAgents.",
    "",
    "### O do DEV",
    "",
    "```text",
    "Você é o DEV do Método Chat nesta sessão. Antes de tudo, leia inteiros o COMECE-AQUI.md e o AGENTS.md.",
    "- As três regras da seção 1 do COMECE-AQUI valem sempre, e as da seção 4 também: o npx só com --no-install, e a integração só com a DATABASE_URL_TESTES apontando para o banco de teste.",
    "- Você desenha com o Victor, escreve a spec e o plano, ensaia numa cópia isolada, escreve o código, roda os testes, faz os commits e prepara os PRs.",
    "- O AUDITOR é a outra sessão aberta nesta mesma pasta. Ache-a com ListAgents e fale com ela por SendMessage. No começo do dia, confirme com o Victor, pela caixa, qual sessão é o auditor.",
    "- Nenhum comando que grave roda sem o \"pode\" do auditor, nem para testar. Todo roteiro vai a ele antes, com o sha256 e o número de linhas; um roteiro mudado vai com a versão anterior e o diff.",
    "- Toda linha citada é medida antes. Medição vence afirmação.",
    "- As decisões são do Victor, pela caixa, com o essencial dentro da pergunta e a opção recomendada primeiro.",
    "- Antes de cada escrita na produção: a caixa do Victor, a hora mandada ao auditor e o \"pode\" dele, nesta ordem.",
    "- Fale com o Victor sempre em português simples.",
    "```",
    "",
    "### O do AUDITOR",
    "",
    "```text",
    "Você é o AUDITOR do Método Chat nesta sessão. Antes de tudo, leia inteiros o COMECE-AQUI.md e o AGENTS.md.",
    "- As três regras da seção 1 do COMECE-AQUI valem sempre, e as da seção 4 também: o npx só com --no-install, e a integração só com a DATABASE_URL_TESTES apontando para o banco de teste.",
    "- Você NÃO escreve código nem faz commit: você lê, mede e reporta.",
    "- O DEV é a outra sessão aberta nesta mesma pasta. Ache-a com ListAgents e fale com ela por SendMessage.",
    "- Para cada spec ou plano do DEV, responda: (1) está correto e resolve o problema? (2) existe uma opção melhor ou mais simples? Qual, e por quê? (3) segue os padrões do projeto (COMECE-AQUI, specs e planos em docs/, docs/auditoria-de-design-2026-09-10.md, teste antes do código, mutações, guarda do diff, estilo de commit)?",
    "- Confira cada fase do DEV rodando os testes você mesmo. Meça antes de afirmar, e só cite arquivo:linha depois de conferir.",
    "- Todo roteiro do DEV passa por você antes de rodar, mesmo o que só lê.",
    "- Numere os achados em sequência, a partir do último do relatório do dia anterior, com a classe BLOQUEIA, CORRIGIR ou ANOTAR.",
    "- A produção você só lê. Nada que grave lá roda sem o seu \"pode\", depois da caixa do Victor e da hora.",
    "- No fim do dia, escreva o relatório ao Victor.",
    "- Fale com o Victor sempre em português simples.",
    "",
    "Comece mandando ao DEV uma mensagem dizendo que está no ar.",
    "```",
  ),
];

const COMPOSE = [
  [
    34,
    "      # 5434, E A ESCOLHA FOI MEDIDA. Nesta máquina a 5432 já escuta (Postgres",
    ["      # 5434, E A ESCOLHA FOI MEDIDA. A 5432 ou a 5433, conforme a máquina, são do"],
  ],
  [
    35,
    "      # instalado) e a 5433 é do container `n8x-marketing-db`, que atende OUTRO",
    ["      # Postgres instalado e do container `n8x-marketing-db`, que atende OUTRO"],
  ],
];

const ALVOS = {
  guia: { arquivo: "COMECE-AQUI.md", linhas: 252, trocas: GUIA },
  compose: { arquivo: "docker-compose.yml", linhas: 72, trocas: COMPOSE },
};
const { arquivo, linhas: esperadas, trocas } = ALVOS[alvo];
const caminho = join(raiz, arquivo);
const texto = readFileSync(caminho, "utf8");
const cr = texto.includes("\r\n") ? "\r" : "";
const linhas = texto.split("\n");
// Um arquivo de N linhas que termina em fim de linha dá N + 1 pedaços, e o último é vazio.
if (linhas.length !== esperadas + 1 || linhas[esperadas] !== "") {
  console.log(`PARADO, NADA GRAVADO: o ${arquivo} não tem ${esperadas} linhas terminadas em fim de linha`);
  process.exit(1);
}
const numeros = trocas.map(([n]) => n);
if (new Set(numeros).size !== numeros.length) {
  console.log("PARADO, NADA GRAVADO: há duas trocas para a mesma linha");
  process.exit(1);
}
for (const [n, antiga] of trocas) {
  const atual = (linhas[n - 1] ?? "").replace(/\r$/, "");
  if (atual !== antiga) {
    console.log(`PARADO, NADA GRAVADO: a linha ${n} do ${arquivo} não é a esperada`);
    process.exit(1);
  }
}
for (const [n, , novas] of [...trocas].sort((a, b) => b[0] - a[0])) {
  linhas.splice(n - 1, 1, ...novas.map((l) => l + cr));
  console.log(`${arquivo}:${n} -> ${novas.length === 0 ? "sai" : `${novas.length} linha(s)`}`);
}
writeFileSync(caminho, linhas.join("\n"), "utf8");
console.log(`GRAVADO: ${trocas.length} trocas no ${arquivo}, que passa de ${esperadas} para ${linhas.length - 1} linhas (${cr ? "CRLF" : "LF"}).`);
````

## Apêndice B: as sabotagens do ensaio

Rodadas na cópia do ensaio, sobre a `4b6a530` commitada e limpa, com o "pode" da auditoria. A saída:

```text
== 1: o aplicar de novo, sobre o guia já trocado
PARADO, NADA GRAVADO: o COMECE-AQUI.md não tem 252 linhas terminadas em fim de linha
saiu com 1
== 2: o aplicar de novo, sobre o compose já trocado
PARADO, NADA GRAVADO: a linha 34 do docker-compose.yml não é a esperada
saiu com 1
== 3: um arquivo fora da spec
dentro: COMECE-AQUI.md
dentro: docker-compose.yml
dentro: docs/specs/2026-11-19-o-guia-com-o-victor.md
FORA DA SPEC: zz-sabotagem.txt
docker-compose.yml: só comentário
guarda: 1
== 4: uma linha que não é comentário no compose
dentro: COMECE-AQUI.md
dentro: docker-compose.yml
dentro: docs/specs/2026-11-19-o-guia-com-o-victor.md
docker-compose.yml FORA DO COMENTÁRIO:
+x: 1
guarda: 1
== 5: uma linha em branco no compose
dentro: COMECE-AQUI.md
dentro: docker-compose.yml
dentro: docs/specs/2026-11-19-o-guia-com-o-victor.md
docker-compose.yml FORA DO COMENTÁRIO:
+
guarda: 1
(status acima; vazio = limpo)
```
