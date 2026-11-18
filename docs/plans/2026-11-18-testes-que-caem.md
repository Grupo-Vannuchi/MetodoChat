# Os testes que caíam por tempo: o plano (item 3 da seção 7 do COMECE-AQUI)

**Nascido em:** 18/11/2026, sobre a `main` em `b03a54d`. A spec é `docs/specs/2026-11-18-testes-que-caem.md`.

**O que o Victor decidiu pela caixa, em 18/11/2026:**
- **prazo próprio**, com um teste guarda (o caminho 4 da investigação), e não um prazo global maior;
- a spec aprovada, com as emendas do glob e das funções em qualquer nível (achados 287 e 288) e da resolução
  pela declaração visível (achado 290);
- **três linhas do `COMECE-AQUI.md` neste PR** (a `:98`, a `:120` e a `:216`); a `:121`, a da cópia em LF
  (achado 274), vai para o PR próprio do guia;
- a suíte de integração roda uma vez, no verify, com o Docker aberto por ele;
- os commits saem no nome dele, pelo git da máquina, e quem mescla é ele;
- **a leitura da base antes e depois do merge (achado 297), só nesta entrega, que não muda o app:** como esta
  máquina não lê a produção (o 276), ela é trocada pelo deploy, pelo log do build, pelo site e pelos erros da
  Vercel, lidos pelo conector (a decisão foi dada à auditoria e ao DEV). O acesso de leitura continua necessário
  antes do vídeo do LinkedIn.

**O ensaio (18/11):** o código deste plano foi feito e testado fase a fase numa cópia isolada (`git worktree`, sem
push, ramo local `ensaio-testes-que-caem`, saído da `b03a54d`, com `npm ci` próprio e `.env.local` vazio). Cada
fase teve o RED medido com o código ausente, o GREEN, as suítes em registro, a guarda do diff e a conferência da
auditoria. Os três commits do ensaio, e o patch-id de cada um, que a execução tem de repetir:

| Commit do ensaio | O que é | patch-id |
|---|---|---|
| `a0dcb73` | a spec | `fb41a7197844eec6740423ee2f7925a2d0ba37d4` |
| `46f40ec` | a FASE 1: o guarda e os 22 prazos | `ed75e8ae723f9481aa008386197459d4e3b0f57c` |
| `8e01d80` | a FASE 2: as três linhas do guia | `2716d1a167a38968a4d4ea2d276734353369c4ac` |

---

## O que o ensaio mediu

- **A falha não se reproduziu na máquina do ensaio** (4 núcleos, Defender em tempo real), em três rodadas: a pasta
  principal logo depois do `npm ci`, a mesma quente, e uma worktree nova logo depois do `npm ci`. As três passaram
  inteiras (162 arquivos e 3 880 casos). Na worktree nova, as varreduras ficaram de 1,1 a 9 vezes mais lentas (o
  vocabulario foi de 156 ms para 1 412 ms), mas abaixo do prazo. O 218 e o 227 foram anotados em outra máquina.
  A causa da lentidão é hipótese (a primeira leitura de arquivos recém-gravados), e não medida (achado 273).
- **O RED é determinístico:** o guarda, escrito antes dos prazos, cai com EXATAMENTE os 22 pontos da spec. A
  primeira versão do guarda deu 28 (o `red-1`): ela juntava pelo nome funções homônimas de escopos diferentes (o
  `andar` de quem varre e o `andar` de quem só percorre a árvore do TypeScript). A resolução pela declaração
  visível, pelo checker do TypeScript, deu os 22 (o `red-2`), com 0 quedas para o nome, em 977 ms (achado 290).
- **O GREEN:** 22 trocas, cada uma `});` → `}, 60_000);`, em 12 arquivos; o guarda com 4 de 4 (73, 9, 1 770 e
  1 013 ms); a suíte pura com 163 arquivos e 3 884 casos (49,8 s); a de tela com 36 e 350; o eslint dos 13 e o
  `tsc` limpos.
- **As 28 mutações, uma por proteção, derrubaram o caso certo** (o apêndice B): os 12 prazos tirados e o 5_000
  derrubam só o caso 4, com o ponto mutado e nenhum outro; a subpasta derruba só o caso 3; e as 14 do leitor
  derrubam o caso 1 ou o 2 na linha sintética delas.

## O que fica aberto, fora desta entrega

- **O 248:** o caso da migração 012 na integração ainda pode cair, pelo corte no segundo, e não por prazo.
- **O 272:** o `next` 16.4.3 tem um alerta moderado (`'use cache'`), que o projeto não usa; o conserto é o 16.4.6,
  num PR pequeno à parte.
- **O 274:** a instrução da cópia em LF (`COMECE-AQUI.md:121`), no PR do guia.
- **O 276:** o vídeo de 30 s do LinkedIn na produção espera um acesso de leitura da auditoria à produção.
- **A outra metade do item 3** (as cópias antigas que guardam um `.env.local`) está em outra máquina.

## Restrições globais

- **Os caminhos.** Todo bloco de comandos começa definindo:
  - `C`, a cópia da execução: `C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/394c77f1-2a23-4c47-b600-4f9c6baec770/scratchpad/testes-que-caem-exec`;
  - `T`, a pasta dos roteiros e dos registros: `C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/394c77f1-2a23-4c47-b600-4f9c6baec770/scratchpad/item3`;
  - `P`, este plano: `$T/plano.md`, o arquivo que a auditoria leu (no Passo 3, ele é copiado para
    `docs/plans/2026-11-18-testes-que-caem.md`).
  - A auditoria, ao aplicar o plano do zero, troca `C` e `T` pelos caminhos dela.
- **O ramo:** `testes-que-caem`, saído da `b03a54d` (a `main` de hoje), sem upstream. Nunca commitar nem empurrar
  na `main`. Todo commit vem depois de `test "$(git branch --show-current)" = testes-que-caem &&`.
- **O autor** é o do git da máquina (Victor Souza, com o e-mail noreply do GitHub). Sem `--author`, sem rodapé
  de IA, e nunca `git config` numa worktree.
- **`git add` com o caminho de cada arquivo.** Nunca `-A` nem `.`.
- **Antes de cada commit,** o `varrer-texto.mjs` nos arquivos da fase, todos "limpo", com a saída lida. O commit é
  um comando à parte.
- **A guarda do diff** (`guarda-do-diff.sh`) roda no fim de cada fase e sai com 0.
- **A regra de divergência:** se o RED, o GREEN, o blob, o patch-id, a guarda ou a varredura não baterem com o
  plano, pare. Não ajuste nada: mande a saída inteira à auditoria e espere.
- **Nenhum roteiro roda sem o "pode" da auditoria**, nem para testar (achados 275, 289, 292, 295 e 296). Os roteiros
  deste plano já foram lidos por ela, com o sha256 da tabela do Passo 0.
- **`npx --no-install`** sempre. **Nada de `app/` nem de `lib/` muda**, nem `package*`, nem `vitest*.config.ts`.
- **O DEV não se conecta à produção.** A leitura do deploy e do preview é da auditoria.
- **No corpo do PR,** nenhuma arroba solta, nem e-mail, nem nome de pessoa: o repositório é público.

## Mapa dos arquivos

| Arquivo | Fase | O que é |
|---|---|---|
| `docs/specs/2026-11-18-testes-que-caem.md` | Passo 2 | a spec (novo) |
| `docs/plans/2026-11-18-testes-que-caem.md` | Passo 3 | este plano (novo) |
| `tests/prazo-das-varreduras.test.ts` | FASE 1 | o guarda (novo) |
| os 12 de `tests/` da tabela da FASE 1 | FASE 1 | uma linha cada fechamento: `});` → `}, 60_000);` |
| `COMECE-AQUI.md` | FASE 2 | as linhas 98, 120 e 216 |

E mais nenhum: a guarda do diff confere isso.

---

## Passo 0: os roteiros, em `T`

Os roteiros vêm dos blocos do apêndice A. O primeiro, o `extrair-bloco.mjs`, é criado a partir do bloco dele por
qualquer meio, e conferido pelo sha256; os outros saem do plano por ele. Na pasta do DEV eles já existem, e só se
confere o sha256.

| Roteiro | sha256 | Lido pela auditoria |
|---|---|---|
| `extrair-bloco.mjs` | `8585d040e92f75b0c9f05fa2491cd9a34c7066bac48c4389f6466a6ce307f52a` | a ler, com este plano |
| `varrer-texto.mjs` | `2e5f91e9083f4873102269ec596fe2c62f97cc47d00a310f29898f08173c9a85` | sim (18/11) |
| `guarda-do-diff.sh` | `641d60f7fd35a1f92edb2bda80cc4ff202c3e056e290de4150f63b7b0cb09e6f` | a ler, com este plano (a 343ba50d com a cópia por argumento) |
| `aplicar-prazos.mjs` | `89685638dc607f1a222d788202b1ec02c99f6351d3c32becf17b1da7ada7ba45` | sim (18/11) |
| `aplicar-guia.mjs` | `b58d433b3efc0f901056ff2f715d9790fe9f5b2bc4ce628b91a29c5454d7de8a` | a ler, com este plano |
| `mutar.mjs` | `9684565608637d064e3d6ea5f31d63fcb8bb1f6951837aae8c0a9c76cfbe8749` | a ler, com este plano (a 3f05ee6c com o ramo e o HEAD por argumento) |

```bash
T="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/394c77f1-2a23-4c47-b600-4f9c6baec770/scratchpad/item3"
cd "$T" || exit 1
sha256sum extrair-bloco.mjs varrer-texto.mjs guarda-do-diff.sh aplicar-prazos.mjs aplicar-guia.mjs mutar.mjs
```

Esperado: os seis sha256 da tabela.

## Passo 1: a cópia da execução, saída da `main`

```bash
C="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/394c77f1-2a23-4c47-b600-4f9c6baec770/scratchpad/testes-que-caem-exec"
test ! -e "$C" || { echo "a pasta da cópia já existe: pare"; exit 1; }
cd "c:/Users/Usuario/varandas/MetodoChat" || exit 1
git fetch origin
test "$(git rev-parse --short origin/main)" = b03a54d || { echo "a main mudou: pare"; exit 1; }
git worktree add -b testes-que-caem "$C" b03a54d
cd "$C" || exit 1
if git rev-parse --abbrev-ref '@{upstream}' >/dev/null 2>&1; then echo "o ramo tem upstream: pare"; exit 1; fi
for f in .env*; do if [ -e "$f" ]; then echo "PARADO: $f existe na cópia"; exit 1; fi; done
: > .env.local
npm ci
git branch --show-current
git status --porcelain
```

Esperado: o ramo `testes-que-caem`, o `npm ci` saindo com 0 e o `git status` vazio (o `.env.local` está no
`.gitignore`). A cópia sai em CRLF, como a do ensaio (o `* text=auto` com o `core.eol` "native"; achado 274).

Se o `origin/main` não estiver em `b03a54d`, pare: a base mudou, e o plano precisa ser conferido de novo.

## Passo 2: a spec (o commit que repete o `a0dcb73`)

<!-- bloco: docs/specs/2026-11-18-testes-que-caem.md -->
```markdown
# Os testes que caem por tempo na cópia nova (item 3; achados 218, 227 e 271)

**Nascido em:** 18/11/2026, sobre a `main` em `b03a54d`, do item 3 da seção 7 do `COMECE-AQUI.md`.
**Decisão do Victor pela caixa, em 18/11/2026:** "Prazo próprio". Os casos e os ganchos que varrem a árvore, e
os ganchos que fazem `import()`, ganham 60 s próprios, e um teste guarda confere a regra. A outra metade do
item 3 (as cópias antigas que guardam um `.env.local`) está em outra máquina e fica de fora.

---

## O que estava aberto

- **O 218:** o `beforeAll` de `tests/proxy-matcher.test.ts:20` passou de 10 s ("Hook timed out in 10000ms") no
  primeiro `verify` de uma cópia nova (`docs/plans/2026-11-11-linkedin-forma-conhecida.md:69`). Sozinho, ele
  levou 899 ms e 1,20 s.
- **O 227:** a varredura de `tests/vocabulario-da-fila.test.ts` levou 5 714 ms contra o limite de 5 s, na
  primeira suíte pura de uma cópia nova. Sozinha, logo depois, levou 119 ms. A de `tests/paleta.test.ts` levou
  1 518 ms contra 60 ms (`docs/plans/2026-11-13-linkedin-carrossel-pdf.md:87`).
- **O 271:** a família é maior do que os três nomes do guia. São 11 arquivos que varrem a árvore. Um deles,
  `tests/sessao-nas-actions.test.ts`, também já caiu numa cópia nova
  (`docs/plans/2026-10-30-capa-do-carrossel.md:233-235`).
- **O procedimento de hoje** (`COMECE-AQUI.md:120`) é rodar o arquivo sozinho e a suíte de novo. Cada plano o
  repete (por exemplo, `docs/plans/2026-11-16-linkedin-video.md:187-190`).

## O que medimos (18/11, nesta máquina: 4 núcleos, Defender em tempo real)

| Rodada | Cópia | Suíte pura | Duração |
|---|---|---|---|
| 1 | a pasta principal, logo depois do `npm ci` | 162 arquivos e 3 880 casos passaram | 51,8 s |
| 2 | a mesma, já quente | passou inteira | 52,0 s |
| 3 | uma worktree nova, logo depois do `npm ci` | passou inteira | 64,9 s |

- **A falha não se reproduziu nesta máquina.** O 218 e o 227 foram anotados em outra máquina.
- **A árvore nova deixou as varreduras de 1,1 a 9 vezes mais lentas** (o maior caso de cada arquivo, da
  rodada 1 para a 3; achado 279). O efeito vai de 1,1 vez no sem-senha-unica, que passa a maior parte do tempo
  compilando com o TypeScript, a 9,1 vezes no vocabulario, que foi de 156 ms para 1 412 ms. O maior caso da
  rodada 3 levou 1 855 ms.
- **O mecanismo é hipótese, e não causa medida (achado 273).** A hipótese é a primeira leitura de cada arquivo
  recém-escrito. Ela não explica o 218: o `verify` roda o lint e o `tsc` antes dos testes, e eles já leem a
  árvore. Nesta máquina, o arquivo do proxy-matcher levou 627, 1 183 e 791 ms, contando o `beforeAll`.
- **A cópia nova saiu em CRLF, e não em LF (achado 274).** Com o `* text=auto`, quem decide o fim de linha
  é o `core.eol`. Ele não está definido aqui, então vale "native", e o `-c core.autocrlf=false` não muda nada.
  As três rodadas foram em CRLF.
- **O leitor do guarda, rodado sobre a `b03a54d`,** achou 134 casos e ganchos que tocam o disco ou fazem
  `import()`. Separados pelo risco, com o tempo de cada caso na rodada 3:

| Classe | O que é | Quantos | Maior tempo a frio |
|---|---|---|---|
| varre a árvore | alcança `readdirSync`/`opendirSync` (ou `glob`), ou lê o disco sobre uma lista montada por eles | 21 casos em 11 arquivos | 1 855 ms |
| gancho com `import()` | o `beforeAll` do proxy-matcher | 1 | (o json não traz o tempo de gancho) |
| caso com `import()` | `tests/bucket.test.ts:111` e `:119`, `tests/logins.test.ts:89` | 3 | 153 ms |
| lê arquivos de caminho conhecido | o resto | 109 casos em 23 arquivos | 41 ms (`tests/paginas-sem-conta.test.ts:231`) |

O tempo de cada caso foi casado pelo título. Num título-modelo, isso errou uma vez: o `${arquivo}, ${funcao}` de
`tests/dreno-com-prazo.test.ts:161` pegou os 485 ms do `:134`, que é da outra classe. A auditoria mediu esse caso
no json, de 1 a 8 ms, e achou o maior de verdade da classe: 41 ms (achado 278).

## O que muda

1. **Prazo próprio de 60 s** (`}, 60_000);`, o terceiro argumento, como no `3c3aefd` e em
   `tests/bonus-arte-resposta.test.ts:78`). Ele entra nestes 22 pontos, todos medidos na `b03a54d`:
   - `tests/acesso-nas-actions.test.ts`: `:260`, `:269`, `:286` e `:290`;
   - `tests/bonus-arte-paginas.test.ts:20`;
   - `tests/dreno-com-prazo.test.ts:134`;
   - `tests/escala.test.ts:221`;
   - `tests/fila-tipos.test.ts:40`;
   - `tests/linkedin-token-fora-do-cliente.test.ts`: `:35`, `:42` e `:63`;
   - `tests/paginas-sem-conta.test.ts`: `:254` e `:259`;
   - `tests/paleta.test.ts:363`;
   - `tests/sem-senha-unica.test.ts`: `:75` e `:82`;
   - `tests/sessao-nas-actions.test.ts`: `:129`, `:148`, `:282` e `:298`;
   - `tests/vocabulario-da-fila.test.ts:525`;
   - o `beforeAll` de `tests/proxy-matcher.test.ts:20`.

   **Por que 60 s:** é o precedente da casa para caso pesado, e fica mais de 10 vezes acima do pior tempo
   anotado (5,7 s). Um travamento de verdade nesses casos continua caindo, só que em 60 s.
2. **Um teste guarda novo, `tests/prazo-das-varreduras.test.ts`.** A regra dele: todo caso (`it`/`test`) ou
   gancho (`beforeAll`, `beforeEach`, `afterAll`, `afterEach`) que varre a árvore, e todo gancho que faz
   `import()`, declara prazo próprio (achado 281: um gancho que varre ficaria com os 10 s do `hookTimeout`; hoje
   não existe nenhum). O prazo é um número literal de pelo menos `60_000`, logo depois da função. Um nome no
   lugar do número não vale.
   - **"Varre a árvore"** quer dizer duas coisas:
     - (a) o caso ou o gancho alcança `readdirSync`, `opendirSync` ou `glob`/`globSync` (achado 288: o Node 24
       tem o `fs.globSync`), direto, por uma função do próprio arquivo, declarada em qualquer nível (achado 287),
       ou por uma função de um auxiliar de `tests/` importada pelo nome, por fecho transitivo;
     - (b) o caso ou o gancho lê o disco e usa uma lista da árvore. Uma lista da árvore é uma variável, em
       qualquer nível, cujo valor alcança uma varredura de pasta. A lista derivada de outra lista também conta,
       por fecho, e a lista atribuída num gancho também.
   - **Por que a regra do auxiliar fica (achado 280),** se hoje ela não acha nenhum caso: vários dos 11 arquivos
     repetem a mesma função de varredura (`arquivosDe`, `arquivosDeTela`). Juntá-las num auxiliar de `tests/` é
     o próximo passo natural de alguém, e sem a regra essa mudança tiraria a proteção em silêncio. O leitor
     recebe um mapa de fontes (nome do arquivo → texto): na árvore de verdade, os arquivos de `tests/`; no caso
     1, fontes sintéticas, com um auxiliar e um teste que o importa.
   - **Os detalhes da leitura:**
     - uma função que só lê pelo valor padrão de um parâmetro conta só quando a chamada omite esse
       argumento. Por isso o "o leitor acusa quando há o que acusar", que passa o texto, não lê nada;
     - uma função passada por nome no lugar do corpo, como em `it("x", lerTudo)`, também conta;
     - **cada nome de função e de lista é resolvido pela declaração visível** de onde ele é usado, pelo checker
       do TypeScript (um programa em memória, sem biblioteca e sem resolver módulos; achado 290). A casa repete
       nomes de função no mesmo arquivo: o `andar` de quem varre e o `andar` de quem só percorre a árvore do
       TypeScript, como em `tests/sem-senha-unica.test.ts:21` e `:48`. Juntá-los pelo nome marcou 6 casos que
       não leem disco (o RED de 18/11, `red-1`). Quando a resolução falha, vale o nome, e o erro possível é um
       prazo a mais. A importação de "./aux" vai pelo nome local. Medido no protótipo sobre a `b03a54d`: os 22,
       nenhuma queda para o nome, e 977 ms para os 167 arquivos de `tests/`.
   - **O próprio guarda varre `tests/`,** então o caso dele leva o prazo também.
3. **`COMECE-AQUI.md`, em três linhas** (o `:5` manda atualizar no mesmo PR o fato que muda):
   - **`:120`:** a lista dos três vira a regra: os casos e os ganchos que varrem a árvore, e os ganchos com
     `import()`, têm prazo próprio de 60 s, e o guarda `tests/prazo-das-varreduras.test.ts` confere. Um estouro
     de tempo neles passa a ser divergência, e não acaso. A linha do caso da migração 012 fica, porque a causa
     é outra;
   - **`:98`:** a tabela da suíte pura passa a "163 arquivos, 3 884 casos" (medido no GREEN do ensaio);
   - **`:216`:** o item 3 da seção 7 fica só com as cópias antigas que guardam um `.env.local`, e diz que os
     testes que caíam por tempo ganharam prazo próprio.
   Cada uma continua numa linha só, e a guarda do diff confere os três trechos exatos: "-98 +98", "-120 +120" e
   "-216 +216".
4. **`COMECE-AQUI.md:121` não muda nesta entrega** (decisão do Victor pela caixa, na aprovação desta spec, em
   18/11/2026). A correção da cópia em LF (achado 274) é outro assunto, e vai para o PR do guia, que já mexe no
   `COMECE-AQUI.md`. Lá, o comando certo (`-c core.eol=lf`) é medido antes de ser escrito.

## O que não muda

- **O `testTimeout` e o `hookTimeout` globais** (5 s e 10 s). Um prazo maior para todos esconderia um
  travamento de verdade em qualquer um dos 3 880 casos.
- **Nenhum arquivo de `app/` nem de `lib/`**, nenhum `vitest*.config.ts` e nenhum `package*`. A guarda do diff
  confere isso em cada fase.
- **Os 109 casos que leem arquivos de caminho conhecido** e os 3 casos com `import()` ficam com os 5 s. Os
  maiores levaram 41 ms e 153 ms a frio. Na outra máquina, o vocabulario levou cerca de 4 vezes o tempo daqui
  (5 714 ms contra 1 412 ms). Na mesma proporção, esses casos iriam a cerca de 0,2 s e 0,6 s, contra os 5 s. É
  uma ESTIMATIVA pela proporção de um caso só, e não uma medida.
- **`testes-dom/` e `testes-integracao/` ficam fora.** O caso da migração 012
  (`testes-integracao/migracao-dos-dados-legados.integracao.ts`, o 248) cai pelo corte no segundo, e não por
  prazo. Ele pede outra investigação.

## As alternativas, e por que não

- **Um `testTimeout` global maior:** esconderia travamentos nos 3 880 casos.
- **Ler a árvore no carregamento, fora do caso:** reescreve 11 portões de outros autores para tirar a leitura
  de dentro do caso. É mais invasivo, e o guarda continuaria precisando dizer onde a leitura pode ficar.
- **Aquecer o disco num `globalSetup`:** apoia-se num mecanismo que ainda é hipótese, e não explica o 218.
- **Prazo em todo caso que toca o disco (134):** enche de prazo casos que nunca correram risco (até 41 ms a frio).
- **Só os três nomes do guia:** deixa oito arquivos da família expostos (o 271).
- **O `retry` do Vitest, por caso ou por arquivo** (`retry` no `TestOptions`,
  `node_modules/@vitest/runner/dist/tasks.d-DEYaIMIu.d.ts:783-787`): ele automatizaria o "rode de novo" de hoje
  (achados 282 e 285). Três motivos para não usá-lo:
  - **não cobre o gancho do 218 (medido no runner da cópia).** O laço do retry fica no `runTest`
    (`node_modules/@vitest/runner/dist/chunk-artifact.js:2935`). O `beforeAll` roda no `runSuite` (`:3136`), e
    a falha dele faz `failTask` e `markTasksAsSkipped` na suíte (`:3138-3139`), sem repetir;
  - **depende do texto da mensagem.** Para repetir só o estouro de tempo, e não uma asserção, é preciso um
    `condition` (`tasks.d-DEYaIMIu.d.ts:749-751` e `:770-774`, que no padrão repete qualquer falha) casado com o
    texto "Test timed out in 5000ms", e esse texto pode mudar de uma versão do Vitest para outra;
  - **esconde a lentidão.** A primeira tentativa, a frio, aquece o disco, e a repetição passa e esconde
    exatamente o que queremos ver.
- **O prazo por `describe`** (`describe(nome, { timeout: 60_000 }, …)`: no Vitest 4, o `SuiteOptions` estende o
  `TestOptions`, que tem `timeout`, em `tasks.d-DEYaIMIu.d.ts:776-780` e `:833`). Seria uma mudança por
  `describe`, em vez de uma por caso, e o guarda olharia menos. Mas os 12 arquivos têm 147 casos (contados pela
  auditoria no `rodada-3.json`), e todos ganhariam 60 s, em vez de 22. Também sai do precedente da casa, que é o
  terceiro argumento por caso (`3c3aefd`).

## Os testes, escritos antes do código

`tests/prazo-das-varreduras.test.ts`:
1. **"o leitor acusa quando há o que acusar"**, com fontes sintéticas. Cada uma destas sai acusada:
   - um `readdirSync` num caso sem prazo;
   - um `readdirSync` dentro de uma função do arquivo, chamada pelo caso;
   - uma função que varre, num auxiliar sintético de `tests/`, importada pelo nome e chamada pelo caso;
   - um `globSync` num caso sem prazo;
   - uma função que lê declarada dentro de um `describe`, sobre uma lista do `describe`;
   - o nome visível varre, e o homônimo de outro escopo não;
   - uma lista no topo e um `readFileSync` no caso;
   - uma lista derivada de outra lista;
   - uma lista atribuída num `beforeAll`;
   - um `beforeAll` que varre a árvore, sem prazo;
   - um gancho com `import()` sem prazo;
   - um prazo de `5_000`;
   - um prazo que é um nome;
   - uma função leitora passada por nome.
2. **"não acusa o que não varre"**: a leitura de um arquivo conhecido, a lista usada sem ler o disco,
   `analisar("x.ts", fonte)` com o texto passado, `}, 60_000);` no lugar certo, e o desenho real do `red-1`:
   uma função que varre, com um `andar` interno que faz `readdirSync`, e outra com um `andar` interno que não
   lê disco, e o caso chamando só a segunda.
3. **"enxerga a árvore que diz enxergar"**: acha o "varre a árvore de verdade…" do vocabulario, o `beforeAll`
   do proxy-matcher e o caso do próprio guarda. Sem isso, o guarda passaria por vacuidade. O caso também confere
   que `tests/` não tem subpasta (achado 283): o leitor lê só o nível de cima, e o vitest inclui
   `tests/**/*.test.ts`. Uma subpasta derruba este caso, com o aviso de que o guarda precisa ser estendido.
4. **"todo caso ou gancho que varre a árvore, e todo gancho com `import()`, têm prazo próprio"**, com `60_000`.

**O RED esperado sobre a `b03a54d`:** o caso 4 cai e lista os 22 pontos acima. Os casos 1 a 3 passam.

**As mutações, uma por proteção, cada uma derrubando o caso certo (28 no total):**
- nos arquivos protegidos (13):
  - tirar o prazo de um ponto em cada um dos 12 arquivos derruba o 4 (são 12 mutações);
  - trocar `60_000` por `5_000` num deles derruba o 4;
- na árvore (1): uma subpasta em `tests/`, com um `.test.ts` dentro, derruba o 3;
- no leitor do guarda (14), cada uma derrubando a linha sintética dela no 1 ou no 2:
  - resolvendo pelo nome solto, e não pela declaração visível: derruba o 2;
  - só a chamada direta conta, sem o fecho das funções do arquivo: derruba o 1;
  - só as funções do topo, e não as de dentro de um `describe`: derruba o 1;
  - sem o `glob`/`globSync` entre as varreduras: derruba o 1;
  - sem os auxiliares importados: derruba o 1;
  - só os casos, sem os ganchos que varrem: derruba o 1;
  - sem a regra (b), a da lista: derruba o 1;
  - sem o fecho das listas derivadas: derruba o 1;
  - sem a lista atribuída num gancho: derruba o 1;
  - sem o gancho com `import()`: derruba o 1;
  - sem a função passada por nome: derruba o 1;
  - aceitando um nome como prazo: derruba o 1;
  - aceitando qualquer número como prazo, mesmo abaixo de `60_000`: derruba o 1;
  - contando a leitura do valor padrão mesmo com o argumento passado: derruba o 2.

## Os limites do guarda, conhecidos

- uma leitura do disco dentro de uma função de `app/` ou de `lib/` chamada pelo teste não é vista;
- uma importação por namespace ou por `default` de um auxiliar de `tests/` também não;
- o valor padrão que lê é guardado só para o primeiro parâmetro, e um `undefined` passado de propósito não é
  visto;
- a lista da árvore e as funções que leem são reconhecidas pela declaração visível, e pelo nome só quando a
  resolução falha (aí um homônimo de outro escopo também conta, e o efeito é um prazo a mais, nunca um a menos).
  A queda pelo nome não tem linha sintética: com o programa sem biblioteca e sem resolver módulos, um nome
  declarado no próprio arquivo sempre resolve, e não achei como provocar a falha sem injetar um resolvedor
  falso. Ela fica como rede de segurança, e o protótipo mediu 0 quedas na árvore de hoje;
- uma função declarada como global num arquivo de `tests/` sem `import` nem `export` (um script), chamada de
  outro arquivo, não é vista. Hoje não existe nenhum: os 167 arquivos `.ts` de `tests/` têm uma linha de `import`
  ou de `export` (medido na `b03a54d` com `grep -L`);
- o leitor lê só o nível de cima de `tests/`. Hoje não há subpasta (medido), e o caso 3 cai se aparecer uma.

## A prova

A entrega não muda nenhum código do app, então não há prova no preview.
- **Nesta máquina:** o RED, o GREEN e as mutações, no ensaio.
- **Na máquina onde a falha foi anotada, quando der:** o mesmo roteiro da rodada 3 (uma worktree nova, `npm ci`
  e logo a suíte pura), com a correção, sem nenhum estouro na primeira rodada. É confirmação, e não condição
  para o merge.
```

```bash
C="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/394c77f1-2a23-4c47-b600-4f9c6baec770/scratchpad/testes-que-caem-exec"
T="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/394c77f1-2a23-4c47-b600-4f9c6baec770/scratchpad/item3"
P="$T/plano.md"
cd "$C" || exit 1
node "$T/extrair-bloco.mjs" "$P" docs/specs/2026-11-18-testes-que-caem.md docs/specs/2026-11-18-testes-que-caem.md
test "$(git hash-object docs/specs/2026-11-18-testes-que-caem.md)" = 311ee66f84a717d00cebad87f1f5683984bb2421 || { echo "a spec não é a aprovada: pare"; exit 1; }
node "$T/varrer-texto.mjs" docs/specs/2026-11-18-testes-que-caem.md
```

Esperado: "limpo docs/specs/2026-11-18-testes-que-caem.md (LF)". Depois, à parte:

```bash
test "$(git branch --show-current)" = testes-que-caem && git add docs/specs/2026-11-18-testes-que-caem.md && git commit -m "A spec dos testes que caíam por tempo: os casos e os ganchos que varrem a árvore ganham prazo próprio, e um guarda confere"
git show HEAD | git patch-id --stable
```

Esperado: o patch-id `fb41a7197844eec6740423ee2f7925a2d0ba37d4`.

## Passo 3: este plano, num commit próprio

O plano entra num commit só dele, depois da spec, porque a cita.

```bash
C="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/394c77f1-2a23-4c47-b600-4f9c6baec770/scratchpad/testes-que-caem-exec"
T="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/394c77f1-2a23-4c47-b600-4f9c6baec770/scratchpad/item3"
cd "$C" || exit 1
test ! -e docs/plans/2026-11-18-testes-que-caem.md || { echo "o plano já existe na cópia: pare"; exit 1; }
cp "$T/plano.md" docs/plans/2026-11-18-testes-que-caem.md
cmp "$T/plano.md" docs/plans/2026-11-18-testes-que-caem.md && sha256sum docs/plans/2026-11-18-testes-que-caem.md
node "$T/varrer-texto.mjs" docs/plans/2026-11-18-testes-que-caem.md
```

Depois, à parte:

```bash
test "$(git branch --show-current)" = testes-que-caem && git add docs/plans/2026-11-18-testes-que-caem.md && git commit -m "O plano dos testes que caíam por tempo: o guarda e os 22 prazos, com o ensaio, as mutações e o verify"
```

## FASE 1: o guarda e os 22 prazos (o commit que repete o `46f40ec`)

**O guarda.** Crie `tests/prazo-das-varreduras.test.ts` (o blob esperado é
`0c2f5a69474a3b44d62001fdbba982f6f53ad18a`):

<!-- bloco: tests/prazo-das-varreduras.test.ts -->
```ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// O PRAZO DAS VARREDURAS (docs/specs/2026-11-18-testes-que-caem.md). Na primeira suíte de uma cópia nova, os
// casos que varrem a árvore estouravam o prazo padrão: a varredura de `tests/vocabulario-da-fila.test.ts`
// levou 5 714 ms contra os 5 s (achado 227; sozinha, 119 ms), e o `beforeAll` de `tests/proxy-matcher.test.ts`
// passou dos 10 s ao carregar o Next (achado 218). A família é de 11 arquivos, e não de três (achado 271). Em
// 18/11, numa worktree nova, as varreduras ficaram de 1,1 a 9 vezes mais lentas que na cópia quente. A causa
// da lentidão é hipótese (a primeira leitura de cada arquivo recém-escrito), e não medida.
//
// A REGRA: todo caso ou gancho que varre a árvore, e todo gancho que faz `import()`, declara prazo próprio,
// com um número literal de pelo menos 60_000 logo depois da função, como no `3c3aefd`. Um nome no lugar do
// número não vale. Os casos que leem arquivos de caminho conhecido (o maior levou 41 ms a frio) e os casos com
// `import()` (153 ms) ficam com o prazo padrão.
//
// "VARRE A ÁRVORE" é: (a) alcançar `readdirSync`, `opendirSync` ou `glob`/`globSync`, direto, por uma função
// do próprio arquivo (em qualquer nível) ou por uma função de um auxiliar de `tests/` importada pelo nome, por
// fecho; ou (b) ler o disco usando uma lista da árvore, que é uma variável cujo valor alcança uma varredura (a
// lista derivada de outra e a lista atribuída num gancho também contam). É o desenho do vocabulario: a lista
// no carregamento, a leitura no caso.
//
// CADA NOME É RESOLVIDO PELA DECLARAÇÃO VISÍVEL de onde ele é usado, pelo checker do TypeScript (achado 290):
// a casa repete nomes de função no mesmo arquivo (o `andar` de quem varre e o `andar` de quem só percorre a
// árvore do TypeScript), e juntá-los pelo nome marcava 6 casos que não leem disco. Quando a resolução falha,
// vale o nome, e o erro possível é um prazo a mais, nunca um a menos. A importação de "./aux" vai pelo nome
// local, porque o programa é montado sem resolver módulos.
//
// OS LIMITES: uma leitura dentro de uma função de `app/` ou de `lib/` não é vista; nem a importação por
// namespace ou por `default` de um auxiliar; o valor padrão que lê é guardado só para o primeiro parâmetro; a
// queda pelo nome não tem caso sintético (sem biblioteca e sem resolver módulos, um nome declarado no próprio
// arquivo sempre resolve; em 18/11 houve 0 quedas na árvore inteira); uma função global de um arquivo-script de
// `tests/` (sem `import` nem `export`), chamada de outro arquivo, não é vista (em 18/11 não havia nenhum: os 167
// arquivos importam ou exportam); e só o nível de cima de `tests/` é lido, por isso o caso que enxerga a árvore
// cai se aparecer uma subpasta.

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const PASTA = join(RAIZ, "tests");
const PRAZO_MINIMO = 60_000;

const LEITURAS_DO_FS = new Set([
  "readFileSync", "readdirSync", "statSync", "lstatSync", "existsSync", "opendirSync",
  "accessSync", "readFile", "readdir", "stat", "lstat", "access", "opendir", "globSync", "glob",
]);
// O `glob`/`globSync` do `node:fs` existe no Node 24 (achado 288): uma varredura por padrão também é varredura.
const VARREDURAS_DO_FS = new Set(["readdirSync", "opendirSync", "readdir", "opendir", "globSync", "glob"]);
const CASOS = new Set(["it", "test"]);
const GANCHOS = new Set(["beforeAll", "beforeEach", "afterAll", "afterEach"]);

type Funcao = ts.ArrowFunction | ts.FunctionExpression | ts.FunctionDeclaration;
/** Uma função que lê. `soSeOmitir = k`: ela só lê pelo valor padrão do parâmetro k, quando a chamada o omite. */
type Leitor = { varre: boolean; soSeOmitir: number | null };
type Leitura = { le: boolean; varre: boolean; importa: boolean; por: string };
type Ponto = { arquivo: string; linha: number; tipo: string; titulo: string; por: string; prazo: number | null };

const ehFuncao = (n: ts.Node | undefined): n is Funcao =>
  !!n && (ts.isArrowFunction(n) || ts.isFunctionExpression(n) || ts.isFunctionDeclaration(n));

/** O identificador está em posição de USO, e não de nome de propriedade, de declaração ou de importação. */
function ehUso(n: ts.Identifier): boolean {
  const p = n.parent;
  if (ts.isPropertyAccessExpression(p) && p.name === n) return false;
  if ((ts.isVariableDeclaration(p) || ts.isFunctionDeclaration(p) || ts.isParameter(p) || ts.isBindingElement(p)) && p.name === n) {
    return false;
  }
  return !ts.isImportSpecifier(p) && !ts.isImportClause(p);
}

/** Dos dois, o que pede mais: varrer vence ler, e ler sempre vence ler só pelo valor padrão. */
const maisForte = (a: Leitor | null, b: Leitor | null): Leitor | null =>
  !a ? b : !b ? a : (b.varre && !a.varre) || (a.soSeOmitir !== null && b.soSeOmitir === null) ? b : a;

/** Os casos e os ganchos que precisam de prazo próprio, em cada `*.test.ts` das fontes, com o prazo que têm. */
function pontos(fontes: Map<string, string>): Ponto[] {
  // Um programa do TypeScript só com as fontes, em memória, sem biblioteca e sem resolver módulos: o checker
  // serve aqui só para achar a declaração visível de cada nome.
  const DIR = "/t/";
  const nomeDe = (f: string) => (f.startsWith(DIR) ? f.slice(DIR.length) : f);
  const host: ts.CompilerHost = {
    getSourceFile: (f, versao) => {
      const texto = fontes.get(nomeDe(f));
      return texto === undefined ? undefined : ts.createSourceFile(f, texto, versao, true, ts.ScriptKind.TS);
    },
    getDefaultLibFileName: () => "lib.d.ts",
    writeFile: () => {},
    getCurrentDirectory: () => DIR,
    getCanonicalFileName: (f) => f,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => "\n",
    fileExists: (f) => fontes.has(nomeDe(f)),
    readFile: (f) => fontes.get(nomeDe(f)),
  };
  const nomes = [...fontes.keys()].sort();
  const programa = ts.createProgram(nomes.map((n) => DIR + n), { noLib: true, noResolve: true, types: [] }, host);
  const checker = programa.getTypeChecker();
  /** As declarações visíveis do nome, ou null se a resolução falhou (aí vale o nome). */
  const declaracoes = (id: ts.Identifier): readonly ts.Declaration[] | null => {
    const d = checker.getSymbolAtLocation(id)?.declarations;
    return d && d.length ? d : null;
  };

  function analisar(sf: ts.SourceFile, importados: Map<string, Leitor>) {
    // As funções, em qualquer nível, cada uma pelo nó da sua declaração.
    const funcoes: [ts.Declaration, Funcao, string][] = [];
    const juntar = (n: ts.Node): void => {
      if (ts.isFunctionDeclaration(n) && n.name) funcoes.push([n, n, n.name.text]);
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && ehFuncao(n.initializer)) funcoes.push([n, n.initializer, n.name.text]);
      ts.forEachChild(n, juntar);
    };
    juntar(sf);
    const nomesDeFuncao = new Set([...funcoes.map(([, , nome]) => nome), ...importados.keys()]);
    const porDeclaracao = new Map<ts.Declaration, Leitor>();

    const leitorDe = (id: ts.Identifier): Leitor | null => {
      if (!nomesDeFuncao.has(id.text)) return null;
      const ds = declaracoes(id);
      let l: Leitor | null = null;
      if (ds) {
        for (const d of ds) l = maisForte(l, ts.isImportSpecifier(d) ? importados.get(id.text) ?? null : porDeclaracao.get(d) ?? null);
        return l;
      }
      // A resolução falhou: vale o nome, juntando os homônimos (o lado do prazo a mais).
      l = importados.get(id.text) ?? null;
      for (const [d, , nome] of funcoes) if (nome === id.text) l = maisForte(l, porDeclaracao.get(d) ?? null);
      return l;
    };

    /** O que o nó faz com o disco: se lê, se varre e se faz `import()`, com o primeiro motivo de cada. */
    const leitura = (no: ts.Node): Leitura => {
      let porVarre = "";
      let porLe = "";
      let importa = false;
      const marcar = (por: string, varre: boolean) => {
        if (varre && !porVarre) porVarre = por;
        if (!porLe) porLe = por;
      };
      const andar = (n: ts.Node): void => {
        if (ts.isCallExpression(n)) {
          if (n.expression.kind === ts.SyntaxKind.ImportKeyword) importa = true;
          const alvo = n.expression;
          const nome = ts.isIdentifier(alvo) ? alvo.text : ts.isPropertyAccessExpression(alvo) ? alvo.name.text : null;
          if (nome && LEITURAS_DO_FS.has(nome)) marcar(nome, VARREDURAS_DO_FS.has(nome));
          const l = ts.isIdentifier(alvo) ? leitorDe(alvo) : null;
          if (l && ts.isIdentifier(alvo)) {
            if (l.soSeOmitir === null || n.arguments.length <= l.soSeOmitir) marcar(alvo.text, l.varre);
            n.arguments.forEach(andar);
            return;
          }
        } else if (ts.isIdentifier(n) && ehUso(n) && !(ts.isCallExpression(n.parent) && n.parent.expression === n)) {
          // Uma função que lê, passada como valor (ex.: arquivos.map(ler)): conta, sem saber os argumentos.
          const l = leitorDe(n);
          if (l) marcar(n.text, l.varre);
        }
        ts.forEachChild(n, andar);
      };
      andar(no);
      return { le: porLe !== "", varre: porVarre !== "", importa, por: porVarre || porLe || (importa ? "import()" : "") };
    };

    const leitorDaFuncao = (fn: Funcao): Leitor | null => {
      const doCorpo = fn.body ? leitura(fn.body) : null;
      if (doCorpo?.le) return { varre: doCorpo.varre, soSeOmitir: null };
      for (let k = 0; k < fn.parameters.length; k++) {
        const inicial = fn.parameters[k].initializer;
        const doPadrao = inicial ? leitura(inicial) : null;
        if (doPadrao?.le) return { varre: doPadrao.varre, soSeOmitir: k };
      }
      return null;
    };
    for (let mudou = true; mudou; ) {
      mudou = false;
      for (const [decl, fn] of funcoes) {
        const antes = porDeclaracao.get(decl) ?? null;
        const depois = maisForte(antes, leitorDaFuncao(fn));
        if (depois && depois !== antes) {
          porDeclaracao.set(decl, depois);
          mudou = true;
        }
      }
    }

    // As listas da árvore: variáveis declaradas ou atribuídas cujo valor varre, ou vem de outra lista, por fecho.
    const valores: [readonly ts.Declaration[] | null, string, ts.Expression][] = [];
    const juntarValores = (n: ts.Node): void => {
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && !ehFuncao(n.initializer)) {
        valores.push([[n], n.name.text, n.initializer]);
      }
      if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(n.left)) {
        valores.push([declaracoes(n.left), n.left.text, n.right]);
      }
      ts.forEachChild(n, juntarValores);
    };
    juntarValores(sf);
    const nomesDeValor = new Set(valores.map(([, nome]) => nome));
    const listas = new Set<ts.Declaration>();
    const listasPeloNome = new Set<string>();
    const usaLista = (no: ts.Node): string => {
      let achada = "";
      const andar = (n: ts.Node): void => {
        if (achada) return;
        if (ts.isIdentifier(n) && nomesDeValor.has(n.text) && ehUso(n)) {
          const ds = declaracoes(n);
          const eh = ds ? ds.some((d) => listas.has(d)) : listasPeloNome.has(n.text);
          if (eh) {
            achada = n.text;
            return;
          }
        }
        ts.forEachChild(n, andar);
      };
      andar(no);
      return achada;
    };
    for (let mudou = true; mudou; ) {
      mudou = false;
      for (const [ds, nome, valor] of valores) {
        const ja = ds ? ds.every((d) => listas.has(d)) : listasPeloNome.has(nome);
        if (!ja && (leitura(valor).varre || usaLista(valor))) {
          if (ds) ds.forEach((d) => listas.add(d));
          listasPeloNome.add(nome);
          mudou = true;
        }
      }
    }
    return { porDeclaracao, leitorDe, leitura, usaLista };
  }

  /** Os nomes locais importados de "./x" que, no auxiliar x, são leitores do topo. */
  const importadosQueLeem = (sf: ts.SourceFile, porModulo: Map<string, Map<string, Leitor>>) => {
    const locais = new Map<string, Leitor>();
    for (const st of sf.statements) {
      if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier)) continue;
      const m = /^\.\/([\w-]+?)(\.ts)?$/.exec(st.moduleSpecifier.text);
      const doModulo = m ? porModulo.get(m[1]) : undefined;
      const nomeados = st.importClause?.namedBindings;
      if (!doModulo || !nomeados || !ts.isNamedImports(nomeados)) continue;
      for (const el of nomeados.elements) {
        const l = doModulo.get((el.propertyName ?? el.name).text);
        if (l) locais.set(el.name.text, l);
      }
    }
    return locais;
  };

  // Os auxiliares de tests/ (sem .test.): os leitores do topo, pelo nome; duas voltas, para um que importa outro.
  const porModulo = new Map<string, Map<string, Leitor>>();
  for (let volta = 0; volta < 2; volta++) {
    for (const nome of nomes) {
      const sf = programa.getSourceFile(DIR + nome);
      if (/\.test\.ts$/.test(nome) || !sf) continue;
      const { porDeclaracao } = analisar(sf, importadosQueLeem(sf, porModulo));
      const doTopo = new Map<string, Leitor>();
      for (const st of sf.statements) {
        if (ts.isFunctionDeclaration(st) && st.name) {
          const l = porDeclaracao.get(st);
          if (l) doTopo.set(st.name.text, l);
        }
        if (ts.isVariableStatement(st)) {
          for (const d of st.declarationList.declarations) {
            const ld = porDeclaracao.get(d);
            if (ts.isIdentifier(d.name) && ld) doTopo.set(d.name.text, ld);
          }
        }
      }
      porModulo.set(nome.replace(/\.ts$/, ""), doTopo);
    }
  }

  const saida: Ponto[] = [];
  for (const nome of nomes) {
    const sf = programa.getSourceFile(DIR + nome);
    if (!/\.test\.ts$/.test(nome) || !sf) continue;
    const { leitorDe, leitura, usaLista } = analisar(sf, importadosQueLeem(sf, porModulo));
    const andar = (n: ts.Node): void => {
      if (ts.isCallExpression(n)) {
        // it(...), it.skip(...), it.each(T)(...), beforeAll(...)
        let base: ts.Expression = ts.isCallExpression(n.expression) ? n.expression.expression : n.expression;
        while (ts.isPropertyAccessExpression(base)) base = base.expression;
        const tipo = ts.isIdentifier(base) ? (CASOS.has(base.text) ? "caso" : GANCHOS.has(base.text) ? base.text : null) : null;
        // O corpo: a primeira função escrita ali, ou um leitor passado pelo nome no lugar dela.
        let i = tipo ? n.arguments.findIndex((a) => ehFuncao(a)) : -1;
        if (tipo && i < 0) i = n.arguments.findIndex((a) => ts.isIdentifier(a) && leitorDe(a) !== null);
        if (tipo && i >= 0) {
          const corpo = n.arguments[i];
          const l = ts.isIdentifier(corpo) ? leitorDe(corpo) : null;
          const r: Leitura = l && ts.isIdentifier(corpo) ? { le: true, varre: l.varre, importa: false, por: corpo.text } : leitura(corpo);
          const lista = r.le && !r.varre ? usaLista(corpo) : "";
          const varre = r.varre || lista !== "";
          if (varre || (tipo !== "caso" && r.importa)) {
            const depois = n.arguments[i + 1];
            const prazo = depois && ts.isNumericLiteral(depois) ? Number(depois.text.replace(/_/g, "")) : null;
            const primeiro = n.arguments[0];
            const titulo =
              tipo !== "caso" || !primeiro ? "" : ts.isStringLiteralLike(primeiro) ? primeiro.text : primeiro.getText(sf);
            const linha = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
            const por = lista ? `${r.por} sobre a lista ${lista}` : varre ? r.por : "import()";
            saida.push({ arquivo: `tests/${nome}`, linha, tipo, titulo, por, prazo });
          }
        }
      }
      ts.forEachChild(n, andar);
    };
    andar(sf);
  }
  return saida;
}

const texto = (p: Ponto) => `${p.arquivo}:${p.linha} ${p.tipo === "caso" ? `caso «${p.titulo}»` : p.tipo} (por ${p.por})`;
const semPrazo = (ps: Ponto[]) => ps.filter((p) => p.prazo === null || p.prazo < PRAZO_MINIMO).map(texto);

function fontesDeTests(): Map<string, string> {
  const fontes = new Map<string, string>();
  for (const nome of readdirSync(PASTA)) {
    if (/\.ts$/.test(nome)) fontes.set(nome, readFileSync(join(PASTA, nome), "utf8"));
  }
  return fontes;
}

const subpastasDeTests = () => readdirSync(PASTA).filter((nome) => statSync(join(PASTA, nome)).isDirectory());

describe("o prazo das varreduras", () => {
  const a = (fontes: Record<string, string>) => semPrazo(pontos(new Map(Object.entries(fontes))));
  const fs = 'import { readdirSync, readFileSync } from "node:fs";\n';

  it("o leitor acusa quando há o que acusar", () => {
    // um readdirSync no caso
    expect(a({ "x.test.ts": `${fs}it("a", () => { readdirSync("app"); });` })).toEqual([
      "tests/x.test.ts:2 caso «a» (por readdirSync)",
    ]);
    // dentro de uma função do arquivo, chamada pelo caso
    expect(a({ "x.test.ts": `${fs}function varrer() { return readdirSync("app"); }\nit("a", () => { varrer(); });` })).toEqual([
      "tests/x.test.ts:3 caso «a» (por varrer)",
    ]);
    // numa função de um auxiliar de tests/, importada pelo nome
    expect(
      a({
        "aux.ts": `${fs}export function varrer() { return readdirSync("app"); }`,
        "x.test.ts": 'import { varrer } from "./aux";\nit("a", () => { varrer(); });',
      })
    ).toEqual(["tests/x.test.ts:2 caso «a» (por varrer)"]);
    // uma varredura por padrão (glob)
    expect(a({ "x.test.ts": 'import { globSync } from "node:fs";\nit("a", () => { globSync("app/**/*.ts"); });' })).toEqual([
      "tests/x.test.ts:2 caso «a» (por globSync)",
    ]);
    // um leitor declarado dentro do describe, sobre uma lista do describe
    expect(
      a({
        "x.test.ts": `${fs}describe("d", () => {\n  const ler = (f: string) => readFileSync(f, "utf8");\n  const L = readdirSync("app");\n  it("a", () => { for (const f of L) ler(f); });\n});`,
      })
    ).toEqual(["tests/x.test.ts:5 caso «a» (por ler sobre a lista L)"]);
    // o nome visível varre, e o homônimo de outro escopo não
    expect(
      a({ "x.test.ts": `${fs}function outra() { const andar = () => 1; return andar(); }\nconst andar = () => readdirSync("app");\nit("a", () => { andar(); });` })
    ).toEqual(["tests/x.test.ts:4 caso «a» (por andar)"]);
    // a lista no topo, a leitura no caso
    expect(a({ "x.test.ts": `${fs}const L = readdirSync("app");\nit("a", () => { for (const f of L) readFileSync(f); });` })).toEqual([
      "tests/x.test.ts:3 caso «a» (por readFileSync sobre a lista L)",
    ]);
    // a lista derivada de outra lista
    expect(
      a({ "x.test.ts": `${fs}const L = readdirSync("app");\nconst M = L.filter((f) => f.endsWith(".ts"));\nit("a", () => { for (const f of M) readFileSync(f); });` })
    ).toEqual(["tests/x.test.ts:4 caso «a» (por readFileSync sobre a lista M)"]);
    // a lista atribuída num gancho (que tem o seu prazo)
    expect(
      a({ "x.test.ts": `${fs}let L: string[] = [];\nbeforeAll(() => { L = readdirSync("app"); }, 60_000);\nit("a", () => { for (const f of L) readFileSync(f); });` })
    ).toEqual(["tests/x.test.ts:4 caso «a» (por readFileSync sobre a lista L)"]);
    // um gancho que varre
    expect(a({ "x.test.ts": `${fs}beforeAll(() => { readdirSync("app"); });` })).toEqual(["tests/x.test.ts:2 beforeAll (por readdirSync)"]);
    // um gancho com import()
    expect(a({ "x.test.ts": 'beforeAll(async () => { await import("next/x"); });' })).toEqual(["tests/x.test.ts:1 beforeAll (por import())"]);
    // um prazo abaixo do mínimo
    expect(a({ "x.test.ts": `${fs}it("a", () => { readdirSync("app"); }, 5_000);` })).toEqual(["tests/x.test.ts:2 caso «a» (por readdirSync)"]);
    // um nome no lugar do número
    expect(a({ "x.test.ts": `${fs}const PRAZO = 60_000;\nit("a", () => { readdirSync("app"); }, PRAZO);` })).toEqual([
      "tests/x.test.ts:3 caso «a» (por readdirSync)",
    ]);
    // um leitor passado pelo nome no lugar do corpo
    expect(a({ "x.test.ts": `${fs}function lerTudo() { readdirSync("app"); }\nit("a", lerTudo);` })).toEqual([
      "tests/x.test.ts:3 caso «a» (por lerTudo)",
    ]);
  });

  it("não acusa o que não varre", () => {
    // um arquivo de caminho conhecido
    expect(a({ "x.test.ts": `${fs}it("a", () => { readFileSync("app/x.ts", "utf8"); });` })).toEqual([]);
    // a lista usada sem ler o disco
    expect(a({ "x.test.ts": `${fs}const L = readdirSync("app");\nit("a", () => { expect(L.length).toBeGreaterThan(0); });` })).toEqual([]);
    // o leitor que só lê pelo valor padrão, chamado com o texto: não lê nada
    expect(
      a({
        "x.test.ts": `${fs}const L = readdirSync("app");\nfunction analisar(rel: string, fonte = readFileSync(rel, "utf8")) { return fonte; }\nit("a", () => { for (const f of L) analisar(f, "const x = 1;"); });`,
      })
    ).toEqual([]);
    // um nome igual em outro escopo, que varre: o caso chama o visível, que não lê (o "andar" da casa)
    expect(
      a({
        "x.test.ts": `${fs}function varrer() {\n  const andar = () => readdirSync("app");\n  return andar();\n}\nfunction percorrer() {\n  const andar = () => 1;\n  return andar();\n}\nit("a", () => { percorrer(); });`,
      })
    ).toEqual([]);
    // o prazo no lugar certo, inclusive um maior
    expect(a({ "x.test.ts": `${fs}it("a", () => { readdirSync("app"); }, 60_000);\nit("b", () => { readdirSync("lib"); }, 900_000);` })).toEqual([]);
    // um caso (e não um gancho) com import(): fica com o prazo padrão
    expect(a({ "x.test.ts": 'it("a", async () => { await import("./x"); });' })).toEqual([]);
  });

  it("enxerga a árvore que diz enxergar", () => {
    // Um guarda que não acha nada passa por vacuidade. Este caso é o que impede isso.
    expect(subpastasDeTests(), "tests/ tem subpasta: o leitor lê só o nível de cima e precisa ser estendido").toEqual([]);
    const achados = pontos(fontesDeTests());
    const acha = (arquivo: string, tipo: string, inicio: string) =>
      achados.some((p) => p.arquivo === arquivo && p.tipo === tipo && p.titulo.startsWith(inicio));
    expect(acha("tests/vocabulario-da-fila.test.ts", "caso", "varre a árvore de verdade")).toBe(true);
    expect(acha("tests/proxy-matcher.test.ts", "beforeAll", "")).toBe(true);
    expect(acha("tests/prazo-das-varreduras.test.ts", "caso", "todo caso ou gancho que varre a árvore")).toBe(true);
  }, 60_000);

  it("todo caso ou gancho que varre a árvore, e todo gancho com import(), têm prazo próprio", () => {
    expect(semPrazo(pontos(fontesDeTests()))).toEqual([]);
  }, 60_000);
});
```

**O RED**, com os prazos ainda ausentes:

```bash
C="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/394c77f1-2a23-4c47-b600-4f9c6baec770/scratchpad/testes-que-caem-exec"
T="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/394c77f1-2a23-4c47-b600-4f9c6baec770/scratchpad/item3"
P="$T/plano.md"
cd "$C" || exit 1
node "$T/extrair-bloco.mjs" "$P" tests/prazo-das-varreduras.test.ts tests/prazo-das-varreduras.test.ts
test "$(git hash-object tests/prazo-das-varreduras.test.ts)" = 0c2f5a69474a3b44d62001fdbba982f6f53ad18a || { echo "o guarda não é o do ensaio: pare"; exit 1; }
npx --no-install vitest run tests/prazo-das-varreduras.test.ts 2>&1 | tee "$T/exec-fase1-red.log"
```

Esperado: "Tests 1 failed | 3 passed (4)". O caso 4 cai com EXATAMENTE estes 22, nesta ordem e com este texto:

```text
tests/acesso-nas-actions.test.ts:260 caso «a lista fechada não envelhece: cada item dela é uma action ou um handler que existe» (por todasAsAcoes)
tests/acesso-nas-actions.test.ts:269 caso «o leitor acha as actions e as rotas do carrossel» (por todasAsAcoes)
tests/acesso-nas-actions.test.ts:286 caso «cada action exportada chama o administrador ou a regra, ou está na lista fechada» (por todasAsAcoes)
tests/acesso-nas-actions.test.ts:290 caso «cada handler exportado de rota chama o administrador ou a regra, ou está na lista fechada» (por todosOsHandlers)
tests/bonus-arte-paginas.test.ts:20 caso «mora em /arte, e não num caminho que termina em .png» (por readdirSync)
tests/dreno-com-prazo.test.ts:134 caso «são os 8 de sempre, por qualquer jeito de importar: as 3 rotas, as 4 actions de clique e o processo do bônus» (por arquivosDe)
tests/escala.test.ts:221 caso «fora do editor, não sobrou tamanho, raio nem espaçamento fora da lista» (por readFileSync sobre a lista ARQUIVOS)
tests/fila-tipos.test.ts:40 caso «são exatamente os do queue_kind_check da última migração que o escreve» (por tiposDaUltimaMigracaoDoCheck)
tests/linkedin-token-fora-do-cliente.test.ts:35 caso «nenhum componente de cliente importa o repositório da conexão nem o cliente do LinkedIn» (por ler sobre a lista CODIGO)
tests/linkedin-token-fora-do-cliente.test.ts:42 caso «só estes arquivos importam o repositório da conexão» (por ler sobre a lista CODIGO)
tests/linkedin-token-fora-do-cliente.test.ts:63 caso «a linha inteira, com o token, só sai pela conexaoDaConta, e só o post da fila a chama» (por ler sobre a lista CODIGO)
tests/paginas-sem-conta.test.ts:254 caso «nenhum arquivo de tela de app/ tem o convite fora do ramo do administrador» (por arquivosDeTela)
tests/paginas-sem-conta.test.ts:259 caso «a lista do que a varredura deixa passar não envelhece: cada item ainda existe» (por arquivosDeTela)
tests/paleta.test.ts:363 caso «não sobrou nenhum `indigo`, `violet` ou `purple` na árvore» (por readFileSync sobre a lista arquivos)
tests/proxy-matcher.test.ts:20 beforeAll (por import())
tests/sem-senha-unica.test.ts:75 caso «o leitor acha os arquivos de app/ e de lib/, inclusive os da entrada» (por arquivosDe)
tests/sem-senha-unica.test.ts:82 caso «nenhum arquivo de app/ e de lib/ lê a ADMIN_PASSWORD, nem tem as peças da passagem» (por arquivosDe)
tests/sessao-nas-actions.test.ts:129 caso «o leitor acha os arquivos de ação, inclusive os vinte da varredura de 26/10» (por arquivosUseServer)
tests/sessao-nas-actions.test.ts:148 caso «cada ação começa por `await exigirSessao();`, e o `exigirSessao` dela confere» (por arquivosUseServer)
tests/sessao-nas-actions.test.ts:282 caso «as públicas são as do proxy.ts, e as protegidas incluem as oito de 26/10» (por rotas)
tests/sessao-nas-actions.test.ts:298 caso «cada handler exportado de rota protegida começa conferindo a sessão» (por rotas)
tests/vocabulario-da-fila.test.ts:525 caso «varre a árvore de verdade e só acha o que já foi conferido e excetuado» (por readFileSync sobre a lista ARQUIVOS)
```

**O GREEN.** Os 22 prazos, pelo `aplicar-prazos.mjs`, que acha cada ponto pela árvore do TypeScript (a linha e o
título) e só grava se achar os 22, em 12 arquivos. O diff esperado, tirado do ensaio:

```diff
diff --git a/tests/acesso-nas-actions.test.ts b/tests/acesso-nas-actions.test.ts
index 8acc3de..10d3d82 100644
--- a/tests/acesso-nas-actions.test.ts
+++ b/tests/acesso-nas-actions.test.ts
@@ -264,7 +264,7 @@ describe("toda action e toda rota passa pela regra das contas", () => {
       return !existsSync(join(RAIZ, rel)) || !existentes.has(chave);
     });
     expect(sumidos).toEqual([]);
-  });
+  }, 60_000);
 
   it("o leitor acha as actions e as rotas do carrossel", () => {
     const chaves = [...todasAsAcoes(), ...todosOsHandlers()].map((p) => p.chave);
@@ -281,13 +281,13 @@ describe("toda action e toda rota passa pela regra das contas", () => {
     ]) {
       expect(chaves, chave).toContain(chave);
     }
-  });
+  }, 60_000);
 
   it("cada action exportada chama o administrador ou a regra, ou está na lista fechada", () => {
     expect(falhasDe(todasAsAcoes())).toEqual([]);
-  });
+  }, 60_000);
 
   it("cada handler exportado de rota chama o administrador ou a regra, ou está na lista fechada", () => {
     expect(falhasDe(todosOsHandlers())).toEqual([]);
-  });
+  }, 60_000);
 });
diff --git a/tests/bonus-arte-paginas.test.ts b/tests/bonus-arte-paginas.test.ts
index 3abf7bd..c5039a2 100644
--- a/tests/bonus-arte-paginas.test.ts
+++ b/tests/bonus-arte-paginas.test.ts
@@ -21,7 +21,7 @@ describe.each(ROTAS)("a rota da arte %s", (rota) => {
     expect(existsSync(`${RAIZ}/${rota}`)).toBe(true);
     const pagina = dirname(dirname(`${RAIZ}/${rota}`));
     expect(readdirSync(pagina).some((n) => /\.(png|jpe?g|svg|ico)$/.test(n))).toBe(false);
-  });
+  }, 60_000);
 
   it("o GET confere a sessão antes de qualquer outra coisa", () => {
     const fonte = ler(rota);
diff --git a/tests/dreno-com-prazo.test.ts b/tests/dreno-com-prazo.test.ts
index 935d17a..f6914b9 100644
--- a/tests/dreno-com-prazo.test.ts
+++ b/tests/dreno-com-prazo.test.ts
@@ -136,7 +136,7 @@ describe("os arquivos que chegam ao dreno (a 3a-0)", () => {
       .filter((f) => f !== "lib/queue-drain.ts" && CHEGA_AO_DRENO.test(ler(f)))
       .sort();
     expect(achados).toEqual(QUEM_IMPORTA_O_DRENO);
-  });
+  }, 60_000);
 
   it("nenhum dá outro nome ao dreno nem o guarda numa variável (fora o drenar do bônus)", () => {
     for (const arquivo of QUEM_IMPORTA_O_DRENO) {
diff --git a/tests/escala.test.ts b/tests/escala.test.ts
index 4540ff3..c9d7054 100644
--- a/tests/escala.test.ts
+++ b/tests/escala.test.ts
@@ -227,7 +227,7 @@ describe("nenhum arquivo de tela fura a escala", () => {
       }
     }
     expect(furos).toEqual([]);
-  });
+  }, 60_000);
 
   it("os tokens de `app/ui.ts` também obedecem", () => {
     // Eles são a origem da maioria das ocorrências na tela: um furo aqui vale
diff --git a/tests/fila-tipos.test.ts b/tests/fila-tipos.test.ts
index c68ad56..00b146e 100644
--- a/tests/fila-tipos.test.ts
+++ b/tests/fila-tipos.test.ts
@@ -42,7 +42,7 @@ describe("os tipos que o dreno conhece", () => {
     // A 025 (a parte 2a do LinkedIn) alargou o check com o `publicacao_linkedin`, e o dreno ganhou o ramo dele.
     expect(arquivo).toBe("025-fila-linkedin.sql");
     expect([...TIPOS_QUE_O_DRENO_CONHECE].sort()).toEqual([...tipos].sort());
-  });
+  }, 60_000);
 
   it("não têm repetição", () => {
     expect(new Set(TIPOS_QUE_O_DRENO_CONHECE).size).toBe(TIPOS_QUE_O_DRENO_CONHECE.length);
diff --git a/tests/linkedin-token-fora-do-cliente.test.ts b/tests/linkedin-token-fora-do-cliente.test.ts
index 22b2a4a..cf21856 100644
--- a/tests/linkedin-token-fora-do-cliente.test.ts
+++ b/tests/linkedin-token-fora-do-cliente.test.ts
@@ -37,7 +37,7 @@ describe("a autorização do LinkedIn fica no servidor", () => {
     expect(clientes.length).toBeGreaterThan(0);
     const errados = clientes.filter((rel) => IMPORTA_O_REPOSITORIO.test(ler(rel)) || IMPORTA_O_CLIENTE.test(ler(rel)));
     expect(errados).toEqual([]);
-  });
+  }, 60_000);
 
   it("só estes arquivos importam o repositório da conexão", () => {
     const importam = CODIGO.filter((rel) => IMPORTA_O_REPOSITORIO.test(ler(rel)));
@@ -50,7 +50,7 @@ describe("a autorização do LinkedIn fica no servidor", () => {
       "lib/convites-repositorio.ts",
       "lib/linkedin-fila.ts",
     ]);
-  });
+  }, 60_000);
 
   it("a tela de compor e a action de publicar leem só o resumo", () => {
     for (const rel of ["app/publicar/actions.ts", "app/publicar/novo/page.tsx"]) {
@@ -65,7 +65,7 @@ describe("a autorização do LinkedIn fica no servidor", () => {
     // autorização.
     const chamam = CODIGO.filter((rel) => rel !== "lib/linkedin-conexoes.ts" && /\bconexaoDaConta\b/.test(ler(rel)));
     expect(chamam).toEqual(["lib/linkedin-fila.ts"]);
-  });
+  }, 60_000);
 
   it("a Configuração lê só os resumos, e o componente de cliente dela não fala de token", () => {
     const pagina = ler("app/setup/page.tsx");
diff --git a/tests/paginas-sem-conta.test.ts b/tests/paginas-sem-conta.test.ts
index ff2a89a..765e411 100644
--- a/tests/paginas-sem-conta.test.ts
+++ b/tests/paginas-sem-conta.test.ts
@@ -254,10 +254,10 @@ describe("as páginas sem conta decidem pelo papel", () => {
   it("nenhum arquivo de tela de app/ tem o convite fora do ramo do administrador", () => {
     const fora = (achado: string) => FORA_DA_VARREDURA.has(achado.replace(/:\d+ /, " "));
     expect(arquivosDeTela().flatMap((rel) => soltos(analisar(rel))).filter((a) => !fora(a))).toEqual([]);
-  });
+  }, 60_000);
 
   it("a lista do que a varredura deixa passar não envelhece: cada item ainda existe", () => {
     const todos = new Set(arquivosDeTela().flatMap((rel) => soltos(analisar(rel)).map((a) => a.replace(/:\d+ /, " "))));
     expect([...FORA_DA_VARREDURA].filter((item) => !todos.has(item))).toEqual([]);
-  });
+  }, 60_000);
 });
diff --git a/tests/paleta.test.ts b/tests/paleta.test.ts
index 6190ede..98a5735 100644
--- a/tests/paleta.test.ts
+++ b/tests/paleta.test.ts
@@ -373,7 +373,7 @@ describe("a varredura do índigo", () => {
       }
     }
     expect(sobras).toEqual([]);
-  });
+  }, 60_000);
 
   it("a exceção da maquete existe DE VERDADE — senão ela não está isentando nada", () => {
     // Uma isenção que não corresponde a nenhuma linha do arquivo é uma isenção
diff --git a/tests/proxy-matcher.test.ts b/tests/proxy-matcher.test.ts
index 41da888..1b5b1c8 100644
--- a/tests/proxy-matcher.test.ts
+++ b/tests/proxy-matcher.test.ts
@@ -22,7 +22,7 @@ beforeAll(async () => {
   g.AsyncLocalStorage ??= AsyncLocalStorage;
   const { unstable_doesMiddlewareMatch } = await import("next/experimental/testing/server");
   casa = (url) => unstable_doesMiddlewareMatch({ config, url });
-});
+}, 60_000);
 
 describe("o porteiro do painel", () => {
   it.each([
diff --git a/tests/sem-senha-unica.test.ts b/tests/sem-senha-unica.test.ts
index 79edddb..f31932f 100644
--- a/tests/sem-senha-unica.test.ts
+++ b/tests/sem-senha-unica.test.ts
@@ -77,9 +77,9 @@ describe("a senha única saiu do código", () => {
     for (const rel of ["lib/entrada.ts", "lib/auth.ts", "lib/logins-repositorio.ts", "app/entrar/actions.ts"]) {
       expect(todos, rel).toContain(rel);
     }
-  });
+  }, 60_000);
 
   it("nenhum arquivo de app/ e de lib/ lê a ADMIN_PASSWORD, nem tem as peças da passagem", () => {
     expect([...arquivosDe("app"), ...arquivosDe("lib")].flatMap((rel) => achados(analisar(rel)))).toEqual([]);
-  });
+  }, 60_000);
 });
diff --git a/tests/sessao-nas-actions.test.ts b/tests/sessao-nas-actions.test.ts
index 5beca7b..de8b266 100644
--- a/tests/sessao-nas-actions.test.ts
+++ b/tests/sessao-nas-actions.test.ts
@@ -143,7 +143,7 @@ describe("toda Server Action confere a sessão antes de qualquer coisa", () => {
     ]) {
       expect(achados, rel).toContain(rel);
     }
-  });
+  }, 60_000);
 
   it("cada ação começa por `await exigirSessao();`, e o `exigirSessao` dela confere", () => {
     const falhas: string[] = [];
@@ -156,7 +156,7 @@ describe("toda Server Action confere a sessão antes de qualquer coisa", () => {
       if (!exigirSessaoConfere(sf)) falhas.push(`${rel}: o exigirSessao não vem de @/lib/exigir-sessao nem confere`);
     }
     expect(falhas).toEqual([]);
-  });
+  }, 60_000);
 
   it("o `exigirSessao` compartilhado confere a sessão e não é ele mesmo uma ação", () => {
     const sf = analisar("lib/exigir-sessao.ts");
@@ -293,7 +293,7 @@ describe("toda rota fora das públicas confere a sessão antes de qualquer traba
       "app/api/webhook/route.ts",
     ]);
     expect(rotas().length - publicas.length).toBeGreaterThanOrEqual(8);
-  });
+  }, 60_000);
 
   it("cada handler exportado de rota protegida começa conferindo a sessão", () => {
     const prefixos = prefixosPublicos();
@@ -311,5 +311,5 @@ describe("toda rota fora das públicas confere a sessão antes de qualquer traba
       }
     }
     expect(falhas).toEqual([]);
-  });
+  }, 60_000);
 });
diff --git a/tests/vocabulario-da-fila.test.ts b/tests/vocabulario-da-fila.test.ts
index dc59347..67b051d 100644
--- a/tests/vocabulario-da-fila.test.ts
+++ b/tests/vocabulario-da-fila.test.ts
@@ -565,5 +565,5 @@ describe("a varredura", () => {
         `exceção sem uso: ${e.caminho} '${e.literal}' — o código mudou, a exceção não`
       ).toBe(true);
     }
-  });
+  }, 60_000);
 });
```

```bash
C="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/394c77f1-2a23-4c47-b600-4f9c6baec770/scratchpad/testes-que-caem-exec"
T="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/394c77f1-2a23-4c47-b600-4f9c6baec770/scratchpad/item3"
DOZE="tests/acesso-nas-actions.test.ts tests/bonus-arte-paginas.test.ts tests/dreno-com-prazo.test.ts tests/escala.test.ts tests/fila-tipos.test.ts tests/linkedin-token-fora-do-cliente.test.ts tests/paginas-sem-conta.test.ts tests/paleta.test.ts tests/proxy-matcher.test.ts tests/sem-senha-unica.test.ts tests/sessao-nas-actions.test.ts tests/vocabulario-da-fila.test.ts"
cd "$C" || exit 1
node "$T/aplicar-prazos.mjs" "$C" || { echo "o aplicar parou: pare"; exit 1; }
# shellcheck disable=SC2086
for f in $DOZE; do echo "$f $(git hash-object "$f")"; done
bash "$T/guarda-do-diff.sh" "$C"
npx --no-install vitest run tests/prazo-das-varreduras.test.ts 2>&1 | tee "$T/exec-fase1-guarda.log"
npm test 2>&1 | tee "$T/exec-fase1-pura.log"
npm run test:dom 2>&1 | tee "$T/exec-fase1-tela.log"
# shellcheck disable=SC2086
npx --no-install eslint tests/prazo-das-varreduras.test.ts $DOZE
npx --no-install tsc --noEmit
```

Esperado:
- o aplicar: 22 linhas "(fecha em :N): "});" -> "}, 60_000);"" e "GRAVADO: 22 prazos em 12 arquivos.";
- os blobs dos 12, iguais aos do ensaio:

```text
tests/acesso-nas-actions.test.ts 10d3d82f6b83236f2a2c1a0bd7bd07588b3fdcaf
tests/bonus-arte-paginas.test.ts c5039a232633406a8986b201b304ad17f54910dd
tests/dreno-com-prazo.test.ts f6914b906540778e55f7e316fd5d7160b9c3d634
tests/escala.test.ts c9d70545ff2da51c31288a1000248d82557d13ab
tests/fila-tipos.test.ts 00b146eed67e9d2356d07ea44310c93ff9479890
tests/linkedin-token-fora-do-cliente.test.ts cf21856d5a81dcf432e14e1c0d5be9f605f298ae
tests/paginas-sem-conta.test.ts 765e4110aa462acac3a81dc8388c578052d76caa
tests/paleta.test.ts 98a5735976f565f21baa8d85f77839edc343be87
tests/proxy-matcher.test.ts 1b5b1c81aaa7d3870bf5d4e5c9a4cfa707ff11fe
tests/sem-senha-unica.test.ts f31932f56a677e24ebafb56901e7d2b031295293
tests/sessao-nas-actions.test.ts de8b26676b887457f5e27a30ff2f3b01a0d60511
tests/vocabulario-da-fila.test.ts 67b051dff928ee4d552928aa147ecc88ae1e4270
```

- a guarda: 15 "dentro" (a spec, o plano, o guarda e os 12) e saída 0;
- o guarda: "Tests 4 passed (4)";
- a pura: "Test Files 163 passed (163)" e "Tests 3884 passed (3884)". Um estouro de tempo num dos 22 agora é
  divergência;
- a de tela: "Test Files 36 passed (36)" e "Tests 350 passed (350)";
- o eslint e o `tsc` sem nenhuma saída de erro.

A integração não roda aqui: nenhum arquivo de `testes-integracao/` muda, nenhuma outra suíte olha `tests/`
(`vitest.dom.config.ts:53` inclui só `testes-dom/**/*.dom.tsx`; `vitest.integracao.config.ts:32`, só
`testes-integracao/**/*.integracao.ts`), e ela roda uma vez, no verify (decisão do Victor).

A varredura e o commit, à parte:

```bash
C="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/394c77f1-2a23-4c47-b600-4f9c6baec770/scratchpad/testes-que-caem-exec"
T="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/394c77f1-2a23-4c47-b600-4f9c6baec770/scratchpad/item3"
cd "$C" || exit 1
node "$T/varrer-texto.mjs" tests/prazo-das-varreduras.test.ts tests/acesso-nas-actions.test.ts tests/bonus-arte-paginas.test.ts tests/dreno-com-prazo.test.ts tests/escala.test.ts tests/fila-tipos.test.ts tests/linkedin-token-fora-do-cliente.test.ts tests/paginas-sem-conta.test.ts tests/paleta.test.ts tests/proxy-matcher.test.ts tests/sem-senha-unica.test.ts tests/sessao-nas-actions.test.ts tests/vocabulario-da-fila.test.ts
```

```bash
test "$(git branch --show-current)" = testes-que-caem && git add tests/prazo-das-varreduras.test.ts tests/acesso-nas-actions.test.ts tests/bonus-arte-paginas.test.ts tests/dreno-com-prazo.test.ts tests/escala.test.ts tests/fila-tipos.test.ts tests/linkedin-token-fora-do-cliente.test.ts tests/paginas-sem-conta.test.ts tests/paleta.test.ts tests/proxy-matcher.test.ts tests/sem-senha-unica.test.ts tests/sessao-nas-actions.test.ts tests/vocabulario-da-fila.test.ts && git commit -m "Os casos e os ganchos que varrem a árvore ganham 60 s próprios, e um guarda acusa quem varrer sem prazo"
git show HEAD | git patch-id --stable
```

Esperado: a varredura com 13 "limpo" (o guarda em LF, os 12 em CRLF), e o patch-id `ed75e8ae723f9481aa008386197459d4e3b0f57c`.

## FASE 2: as três linhas do guia (o commit que repete o `8e01d80`)

O diff esperado, tirado do ensaio:

```diff
diff --git a/COMECE-AQUI.md b/COMECE-AQUI.md
index 8de1d35..a6e320f 100644
--- a/COMECE-AQUI.md
+++ b/COMECE-AQUI.md
@@ -95,7 +95,7 @@ As specs e os planos contam o porquê de quase tudo. Antes de mexer numa área,
 
 | Comando | O que roda | Hoje, na `main` |
 |---|---|---|
-| `npm test` | os testes puros | 162 arquivos, 3 880 casos |
+| `npm test` | os testes puros | 163 arquivos, 3 884 casos |
 | `npm run test:dom` | os testes de tela | 36 arquivos, 350 casos |
 | `npm run test:integracao` | os testes contra o banco de teste | 80 arquivos, 1 018 casos e 8 pulados |
 | `npm run verify` | lint, tsc, puros, tela, a varredura de segredos e o build | tudo isso |
@@ -117,7 +117,7 @@ As specs e os planos contam o porquê de quase tudo. Antes de mexer numa área,
    - **Nunca rode sem a variável:** sem ela, a suíte cai na `DATABASE_URL`, que é a produção. A dica que a própria suíte imprime, "Rode sem DATABASE_URL_TESTES antes do merge", NÃO vale aqui.
    - Uma rodada de integração de cada vez, nunca duas juntas.
    - O container para entre um dia e outro: confira com `docker ps` antes de rodar.
-5. **Testes que às vezes caem por tempo** (anotados, ainda sem conserto): na primeira rodada de uma cópia recém-instalada, o `beforeAll` de `tests/proxy-matcher.test.ts` e as varreduras de `tests/vocabulario-da-fila.test.ts` e de `tests/paleta.test.ts`; e, na integração, um caso da migração 012 em `testes-integracao/migracao-dos-dados-legados.integracao.ts`. O procedimento: rode o arquivo sozinho e depois a suíte inteira de novo. Se cair de novo, é defeito de verdade.
+5. **Testes que caíam por tempo na primeira rodada de uma cópia nova** (`docs/specs/2026-11-18-testes-que-caem.md`): os casos e os ganchos de `tests/` que varrem a árvore, e os ganchos com `import()`, têm prazo próprio de 60 s, e `tests/prazo-das-varreduras.test.ts` confere isso. Um estouro de tempo neles agora é divergência, e não acaso. Na integração, um caso da migração 012 em `testes-integracao/migracao-dos-dados-legados.integracao.ts` ainda pode cair, pelo corte no segundo e não por prazo: rode o arquivo sozinho e depois a suíte inteira de novo. Se cair de novo, é defeito de verdade.
 6. **No Windows:** a cópia de trabalho fica em CRLF e o repositório em LF (`* text=auto`). Não rode `git config` dentro de uma worktree, porque ele grava no `.git/config` do repositório inteiro. Para uma cópia em LF, use `git -c core.autocrlf=false worktree add …` só no comando.
 
 ---
@@ -213,7 +213,7 @@ O Vinícius, autor da maior parte do código, deixou cinco pontos sobre o que fa
 
 1. **O teste final do vídeo no LinkedIn, na produção.** O vídeo foi para a produção em 17/11 (PR #38), e a primeira hora passou limpa. Falta publicar um vídeo de 30 s nas duas redes pela produção, que deve sair sozinho pelos tiques, em 5 partes. É o único caminho que o preview não alcança. O Eduardo clica, e o auditor acompanha.
 2. **A limpeza das cópias de trabalho do vídeo,** com o OK do Eduardo.
-3. **Os testes que caem por tempo** (a seção 4, item 5) e as cópias antigas de trabalho que ainda guardam um `.env.local`: um plano pequeno, à parte.
+3. **As cópias antigas de trabalho que ainda guardam um `.env.local`**: um plano pequeno, à parte. Os testes que caíam por tempo ganharam prazo próprio (a seção 4, item 5).
 4. **O LinkedIn no carrossel do gerador:** hoje o carrossel do gerador sai só no Instagram.
 5. **As outras redes.** Uma pesquisa de 06/11, ainda a conferir, aponta que o TikTok veta ferramenta de agência, que o X cobra por post e que o YouTube só aceita vídeo. Cada rede começa por um desenho com o Eduardo.
 
```

```bash
C="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/394c77f1-2a23-4c47-b600-4f9c6baec770/scratchpad/testes-que-caem-exec"
T="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/394c77f1-2a23-4c47-b600-4f9c6baec770/scratchpad/item3"
cd "$C" || exit 1
node "$T/aplicar-guia.mjs" "$C" || { echo "o aplicar-guia parou: pare"; exit 1; }
test "$(git hash-object COMECE-AQUI.md)" = a6e320f99b81d9d45cdeb81c38f321ffc95ff07b || { echo "o guia não é o do ensaio: pare"; exit 1; }
bash "$T/guarda-do-diff.sh" "$C"
node "$T/varrer-texto.mjs" COMECE-AQUI.md
```

Esperado: "GRAVADO: 3 linhas no COMECE-AQUI.md."; a guarda com 16 "dentro" (os 15 e o guia), "COMECE-AQUI.md: só
as linhas 98, 120 e 216" e saída 0; a varredura "limpo COMECE-AQUI.md (CRLF)". Depois, à parte:

```bash
test "$(git branch --show-current)" = testes-que-caem && git add COMECE-AQUI.md && git commit -m "O guia diz que as varreduras da árvore têm prazo próprio, e que um estouro de tempo nelas agora é defeito"
git show HEAD | git patch-id --stable
```

Esperado: o patch-id `2716d1a167a38968a4d4ea2d276734353369c4ac`.

## O verify inteiro

O build roda o `scripts/migrar.mjs --aplicar`. Na cópia, com o `.env.local` vazio e sem `VERCEL_ENV`, ele cai no
ramo de `scripts/migrar.mjs:299` e escreve "MIGRAÇÃO PULADA" (`:305`) e "Saindo com código 0, sem abrir conexão
com o banco." (`:316`). O `next build` roda sem as variáveis de agente, porque o Next pode reescrever o bloco do
`AGENTS.md` (`docs/plans/2026-11-16-linkedin-video.md:211`).

```bash
C="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/394c77f1-2a23-4c47-b600-4f9c6baec770/scratchpad/testes-que-caem-exec"
T="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/394c77f1-2a23-4c47-b600-4f9c6baec770/scratchpad/item3"
cd "$C" || exit 1
env -u CLAUDECODE -u AI_AGENT npm run verify 2>&1 | tee "$T/exec-verify.log"; echo "verify: ${PIPESTATUS[0]}"
git diff --stat -- AGENTS.md
git status --porcelain
bash "$T/guarda-do-diff.sh" "$C"
```

Esperado: "verify: 0"; no registro, 163 e 3 884 puros, 36 e 350 de tela, "MIGRAÇÃO PULADA" e o build do Next
concluído; o `git diff` do `AGENTS.md` vazio; o `git status` vazio; e a guarda com 16 "dentro" e saída 0.

**A integração,** uma vez, com o Docker Desktop aberto pelo Victor:

```bash
C="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/394c77f1-2a23-4c47-b600-4f9c6baec770/scratchpad/testes-que-caem-exec"
T="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/394c77f1-2a23-4c47-b600-4f9c6baec770/scratchpad/item3"
cd "$C" || exit 1
docker ps --format '{{.Names}} {{.Status}}' | grep metodochat-banco-de-teste || npm run banco:teste
docker ps --format '{{.Names}} {{.Status}}' | grep metodochat-banco-de-teste
DATABASE_URL_TESTES=postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes npm run test:integracao 2>&1 | tee "$T/exec-integracao.log"
```

Esperado: o container "healthy"; "[rede-global] ALVO: banco de TESTE" no registro; e a contagem do
`COMECE-AQUI.md:100` ("80 arquivos, 1 018 casos e 8 pulados") continuando verdadeira. Nunca rode sem a variável:
sem ela, a suíte cai na `DATABASE_URL`. Se o caso da migração 012 cair (o 248), rode o arquivo sozinho e a suíte
de novo; se cair outra vez, é divergência.

## As mutações, de novo, no ramo que vai ao PR

No ensaio, deram 28 de 28 (o apêndice B). Na execução, elas rodam outra vez, como no precedente da casa
(`docs/plans/2026-11-16-linkedin-video.md:4549`), sobre a árvore commitada e limpa da FASE 2. Antes delas, o
patch-id do HEAD é conferido contra o do `8e01d80`, para que rodem sobre o conteúdo provado.

```bash
C="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/394c77f1-2a23-4c47-b600-4f9c6baec770/scratchpad/testes-que-caem-exec"
T="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/394c77f1-2a23-4c47-b600-4f9c6baec770/scratchpad/item3"
cd "$C" || exit 1
test "$(git show HEAD | git patch-id --stable | cut -d' ' -f1)" = 2716d1a167a38968a4d4ea2d276734353369c4ac || { echo "o HEAD não é a FASE 2 provada: pare"; exit 1; }
test -z "$(git status --porcelain)" || { echo "a árvore não está limpa: pare"; exit 1; }
mkdir -p "$T/exec-mutacoes"
node "$T/mutar.mjs" "$C" "$T/exec-mutacoes" testes-que-caem "$(git rev-parse --short HEAD)" 2>&1 | tee "$T/exec-mutacoes/saida.txt"; echo "mutar: saiu com ${PIPESTATUS[0]}"
```

Esperado: o mesmo do ensaio: "base: sem mutação, 4 de 4 verdes", as 28 linhas "OK" do apêndice B (com as mesmas
linhas sintéticas e os mesmos "também caiu"), "FIM: 28 de 28 mutações derrubaram o caso certo; a árvore está
limpa no <HEAD da FASE 2>" e "mutar: saiu com 0".

## O envio: o push, a prévia, o PR e o merge

No molde do plano do vídeo (`docs/plans/2026-11-16-linkedin-video.md:4632-4790`), com a leitura da base trocada
pela do conector da Vercel (o 297). A auditoria só usa ferramentas de leitura do conector (as `list_*`, as `get_*`
e os eventos dos deployments): nunca promover, voltar, mexer em variável ou gravar qualquer coisa.

**Envio 1: a conferência antes do push.** Repetida, igual, antes do PR (Envio 4) e antes da caixa do merge
(Envio 5).

```bash
C="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/394c77f1-2a23-4c47-b600-4f9c6baec770/scratchpad/testes-que-caem-exec"
cd "$C" || exit 1
git fetch origin
test "$(git rev-parse --short origin/main)" = b03a54d && echo "origin/main em b03a54d"
test "$(git branch --show-current)" = testes-que-caem && echo "no ramo certo"
git log --oneline b03a54d..HEAD                            # 4 commits: a spec, o plano, a FASE 1 e a FASE 2
git log --format='%an' b03a54d..HEAD | sort -u             # só Victor Souza (com o e-mail noreply do GitHub)
git log --format=%B b03a54d..HEAD | grep -ci "co-authored" # 0
git status --porcelain                                     # vazio
```

Se qualquer linha divergir, pare.

**Envio 2: o push do ramo,** com o OK do Victor pela caixa.

```bash
C="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/394c77f1-2a23-4c47-b600-4f9c6baec770/scratchpad/testes-que-caem-exec"
cd "$C" || exit 1
test -z "$(git ls-remote origin refs/heads/testes-que-caem)" || { echo "o ramo já existe no remoto: pare"; exit 1; }
test "$(git branch --show-current)" = testes-que-caem && git push -u origin refs/heads/testes-que-caem:refs/heads/testes-que-caem
```

**Envio 3: a prévia, só lendo.** A Vercel monta uma prévia do ramo.
- O endereço é o do deployment DESTE commit (o `….vercel.app` do deployment, e não o do ramo), conferido pelo DEV
  e pela auditoria. Ninguém clica em nada nela: a prévia grava na produção, e esta entrega não tem prova de tela.
- No log do build, lido pela auditoria pelo conector, e conferido pelo DEV: o commit; "Detected Next.js version:
  16.4.3"; "MIGRAÇÃO PULADA"; e nenhum aviso do Node 26.

**Envio 4: o PR,** com o OK do Victor pela caixa.
- Antes, o "[A PREENCHER …]" de `T/pr-corpo.md` é preenchido com os números medidos no verify e na integração. A
  auditoria relê o corpo inteiro, com o sha256 novo. Ele não tem arroba solta, nem nome de pessoa, nem e-mail, nem
  rodapé de IA, nem `Co-Authored-By`: a regra do projeto (`COMECE-AQUI.md:190`) vale mais que qualquer lembrete de
  atribuição. A mensagem do merge, `T/merge-mensagem.txt`, segue a mesma regra.
- A conferência do Envio 1, de novo. Depois:

```bash
C="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/394c77f1-2a23-4c47-b600-4f9c6baec770/scratchpad/testes-que-caem-exec"
T="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/394c77f1-2a23-4c47-b600-4f9c6baec770/scratchpad/item3"
cd "$C" || exit 1
gh pr create --base main --head testes-que-caem --title "Os casos que varrem a árvore ganham prazo próprio, e um guarda confere" --body-file "$T/pr-corpo.md"
```

- A caixa do PR diz que o merge espera a conferência da auditoria e uma caixa própria.

**Envio 5: antes do merge.** O merge publica na produção (a `main` faz o deploy), então vale a ordem da regra 1 do
`COMECE-AQUI.md`: a caixa do Victor, a hora mandada à auditoria e o "pode" dela.
1. A conferência do Envio 1, de novo.
2. O commit provado é o que vai ao merge:

```bash
C="C:/Users/Usuario/AppData/Local/Temp/claude/f952b1cc50e93ccc/394c77f1-2a23-4c47-b600-4f9c6baec770/scratchpad/testes-que-caem-exec"
cd "$C" || exit 1
git rev-parse HEAD                                                  # o commit provado
git ls-remote origin refs/heads/testes-que-caem | cut -f1           # o mesmo
gh pr view testes-que-caem --json headRefOid --jq .headRefOid       # o mesmo
```

   Se os três não forem o mesmo commit, pare.
3. A caixa do Victor para o merge, com a mensagem de `T/merge-mensagem.txt`.
4. A hora mandada à auditoria.
5. **A linha de base (a (b) do 297)**, pela auditoria, pelo conector: o `list_deployments` de produção (o último
   READY é o `dpl_6r1JESvEuiszD5BKXCYM2wSPYLa2`, na `b03a54d`, e não há build em andamento), e o
   `get_runtime_errors` e o `get_runtime_logs` com nível error/fatal, desde 30 min antes.
6. O "pode" da auditoria. O merge é do Victor, no GitHub. A caixa seguinte é de resultado: sem "(Recomendado)" e
   com "Não fiz / não lembro".

**Envio 6: o deploy do merge,** lido pela auditoria pelo conector:
- o deploy novo de produção READY, no sha do merge;
- no log do build: "Cloning … (Branch: main, Commit: <o sha curto do merge>)"; "Detected Next.js version:
  16.4.3"; "Nada a aplicar: as 26 migrações já constam no registro."; "NENHUMA DDL de esquema foi executada,
  então nenhuma trava foi pedida."; as mesmas 16 linhas "CONFERIDO no banco:", entre elas
  "queue.queue_kind_check existe e confere (025-fila-linkedin.sql)"; nenhum aviso do Node 26; e nenhuma linha de
  nível error.
- O DEV confere, só lendo, no domínio de produção: o `/entrar` dá 200, e o cron sem senha
  (`/api/cron/daily`) dá 401.
- Se o deploy der erro, nada novo vai à `main`, e o caso vai à caixa, com o log.

**Envio 7: a primeira hora (a (b) do 297).**
- A auditoria lê o `get_runtime_errors` e o `get_runtime_logs` (nível error/fatal) em duas horas certas: o READY do
  deploy novo mais 15 min, e mais 50 min. As duas horas vão ao relatório. O Hobby guarda os registros por uma hora
  só, então não existe "leio depois".
- Passa com zero, ou só com o que já estava na linha de base.
- A ausência de registros com o site quieto não prova nada além de que não houve erro.
- **Se divergir, pare** e avise. O caminho de volta é promover de novo o `dpl_6r1JESvEuiszD5BKXCYM2wSPYLa2`. Isso
  grava na produção: só com a caixa do Victor, e quem promove é o Victor, ou o DEV com o "pode" da auditoria. A
  auditoria não promove. Sem migração nesta entrega, a volta é segura.

**Envio 8: a limpeza,** com o OK do Victor pela caixa, depois da primeira hora fechada:
- as duas worktrees: a do ensaio (`…/scratchpad/testes-que-caem`) e a da execução (`…/scratchpad/testes-que-caem-exec`);
- os ramos locais `ensaio-testes-que-caem` e `testes-que-caem`;
- o ramo `testes-que-caem` no remoto, se o GitHub não o apagar no merge.

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
# Item 3: a guarda do diff. Só lê. Na cópia dada (a do ensaio ou a da execução), confere que só os caminhos
# previstos pela spec (docs/specs/2026-11-18-testes-que-caem.md) estão alterados ou novos, contra a b03a54d, e
# que o COMECE-AQUI.md, se mudou, mudou só nas linhas 98, 120 e 216, cada uma trocada por uma (trechos exatos).
# Uso: guarda-do-diff.sh <raiz-da-copia>   (sai com 0 se tudo está dentro; com 1 e a lista do que está fora)
set -u
C="${1:-}"
[ -n "$C" ] || { echo "uso: guarda-do-diff.sh <raiz-da-copia>"; exit 1; }
BASE="b03a54d"
cd "$C" || exit 1
PREVISTOS="
tests/prazo-das-varreduras.test.ts
tests/acesso-nas-actions.test.ts
tests/bonus-arte-paginas.test.ts
tests/dreno-com-prazo.test.ts
tests/escala.test.ts
tests/fila-tipos.test.ts
tests/linkedin-token-fora-do-cliente.test.ts
tests/paginas-sem-conta.test.ts
tests/paleta.test.ts
tests/sem-senha-unica.test.ts
tests/sessao-nas-actions.test.ts
tests/vocabulario-da-fila.test.ts
tests/proxy-matcher.test.ts
docs/specs/2026-11-18-testes-que-caem.md
docs/plans/2026-11-18-testes-que-caem.md
COMECE-AQUI.md
"
# O que difere da base: os commits do ramo, o que está alterado e o que é novo (fora o .gitignore).
# --no-renames (achado 286): com a detecção de renome, um arquivo movido mostraria só o destino, e um arquivo
# do motor movido para um caminho previsto passaria por "dentro".
MUDADOS=$( { git diff --no-renames --name-only "$BASE"; git ls-files --others --exclude-standard; } | sort -u )
FORA=0
for p in $MUDADOS; do
  if printf '%s\n' "$PREVISTOS" | grep -qxF "$p"; then echo "dentro: $p"; else echo "FORA DA SPEC: $p"; FORA=1; fi
done
if printf '%s\n' "$MUDADOS" | grep -qxF COMECE-AQUI.md; then
  HUNKS=$(git diff --no-renames -U0 "$BASE" -- COMECE-AQUI.md | grep '^@@' | sed -E 's/^@@ -([0-9]+)(,[0-9]+)? \+([0-9]+)(,[0-9]+)? @@.*/-\1\2 +\3\4/')
  ESPERADOS="$(printf '%s\n' "-98 +98" "-120 +120" "-216 +216")"
  if [ "$HUNKS" = "$ESPERADOS" ]; then echo "COMECE-AQUI.md: só as linhas 98, 120 e 216"; else echo "COMECE-AQUI.md FORA DAS LINHAS 98, 120 E 216: $(echo $HUNKS)"; FORA=1; fi
fi
[ -n "$MUDADOS" ] || echo "(nada mudou)"
exit $FORA
```

<!-- bloco: aplicar-prazos.mjs -->
```js
// Item 3, fase 2 (GREEN): põe ", 60_000" logo depois do corpo de cada um dos 22 pontos da spec
// (docs/specs/2026-11-18-testes-que-caem.md, "O que muda", item 1). GRAVA nos 12 arquivos de tests/ da cópia.
// Cada ponto é achado pela árvore do TypeScript: a chamada (it ou beforeAll) que começa na linha dada e tem o
// título dado. O texto entra logo depois da função do corpo, e nada mais muda: "});" vira "}, 60_000);".
// Tudo ou nada: se um ponto não for achado EXATAMENTE uma vez, ou se já houver algo depois do corpo, ele para
// antes de gravar qualquer arquivo.
// Uso: node aplicar-prazos.mjs <raiz-da-copia>
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const raiz = process.argv[2];
if (!raiz) {
  console.error("uso: node aplicar-prazos.mjs <raiz-da-copia>");
  process.exit(1);
}
const ts = createRequire(join(raiz, "package.json"))("typescript");

// [arquivo, linha na b03a54d, quem chama, começo do título]
const PONTOS = [
  ["acesso-nas-actions", 260, "it", "a lista fechada não envelhece"],
  ["acesso-nas-actions", 269, "it", "o leitor acha as actions e as rotas do carrossel"],
  ["acesso-nas-actions", 286, "it", "cada action exportada chama o administrador"],
  ["acesso-nas-actions", 290, "it", "cada handler exportado de rota chama o administrador"],
  ["bonus-arte-paginas", 20, "it", "mora em /arte"],
  ["dreno-com-prazo", 134, "it", "são os 8 de sempre"],
  ["escala", 221, "it", "fora do editor, não sobrou tamanho"],
  ["fila-tipos", 40, "it", "são exatamente os do queue_kind_check"],
  ["linkedin-token-fora-do-cliente", 35, "it", "nenhum componente de cliente importa"],
  ["linkedin-token-fora-do-cliente", 42, "it", "só estes arquivos importam"],
  ["linkedin-token-fora-do-cliente", 63, "it", "a linha inteira, com o token"],
  ["paginas-sem-conta", 254, "it", "nenhum arquivo de tela de app/ tem o convite"],
  ["paginas-sem-conta", 259, "it", "a lista do que a varredura deixa passar"],
  ["paleta", 363, "it", "não sobrou nenhum `indigo`"],
  ["proxy-matcher", 20, "beforeAll", ""],
  ["sem-senha-unica", 75, "it", "o leitor acha os arquivos de app/ e de lib/"],
  ["sem-senha-unica", 82, "it", "nenhum arquivo de app/ e de lib/ lê a ADMIN_PASSWORD"],
  ["sessao-nas-actions", 129, "it", "o leitor acha os arquivos de ação"],
  ["sessao-nas-actions", 148, "it", "cada ação começa por"],
  ["sessao-nas-actions", 282, "it", "as públicas são as do proxy.ts"],
  ["sessao-nas-actions", 298, "it", "cada handler exportado de rota protegida"],
  ["vocabulario-da-fila", 525, "it", "varre a árvore de verdade"],
];
const PRAZO = ", 60_000";

const ehFuncao = (n) => !!n && (ts.isArrowFunction(n) || ts.isFunctionExpression(n));
const porArquivo = new Map();
for (const p of PONTOS) porArquivo.set(p[0], [...(porArquivo.get(p[0]) ?? []), p]);

const gravar = [];
let erros = 0;
for (const [arquivo, pontos] of porArquivo) {
  const caminho = join(raiz, "tests", `${arquivo}.test.ts`);
  const texto = readFileSync(caminho, "utf8");
  const sf = ts.createSourceFile(caminho, texto, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const chamadas = [];
  const andar = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) chamadas.push(n);
    ts.forEachChild(n, andar);
  };
  andar(sf);
  const insercoes = [];
  for (const [, linha, quem, titulo] of pontos) {
    const achadas = chamadas.filter((c) => {
      if (c.expression.text !== quem) return false;
      if (sf.getLineAndCharacterOfPosition(c.getStart(sf)).line + 1 !== linha) return false;
      const t = c.arguments[0];
      return quem !== "it" || (t && ts.isStringLiteralLike(t) && t.text.startsWith(titulo));
    });
    const onde = `tests/${arquivo}.test.ts:${linha}`;
    if (achadas.length !== 1) {
      console.log(`ERRO ${onde}: ${achadas.length} chamadas casam, e não 1`);
      erros++;
      continue;
    }
    const c = achadas[0];
    const i = c.arguments.findIndex(ehFuncao);
    if (i < 0 || i !== c.arguments.length - 1) {
      console.log(`ERRO ${onde}: o corpo não é o último argumento (já há algo depois dele)`);
      erros++;
      continue;
    }
    insercoes.push({ onde, pos: c.arguments[i].getEnd() });
  }
  let novo = texto;
  for (const { pos } of [...insercoes].sort((a, b) => b.pos - a.pos)) novo = novo.slice(0, pos) + PRAZO + novo.slice(pos);
  for (const { onde, pos } of insercoes) {
    const fim = texto.indexOf("\n", pos);
    const inicio = texto.lastIndexOf("\n", pos) + 1;
    const antes = texto.slice(inicio, fim < 0 ? undefined : fim).replace(/\r$/, "");
    const linhaDoFechamento = sf.getLineAndCharacterOfPosition(pos).line + 1;
    const depois = antes.slice(0, pos - inicio) + PRAZO + antes.slice(pos - inicio);
    console.log(`${onde} (fecha em :${linhaDoFechamento}): "${antes.trim()}" -> "${depois.trim()}"`);
  }
  gravar.push([caminho, novo, insercoes.length]);
}

const total = gravar.reduce((s, [, , n]) => s + n, 0);
if (erros || total !== 22 || porArquivo.size !== 12) {
  console.log(`PARADO, NADA GRAVADO: ${erros} erros, ${total} pontos achados (esperado 22), ${porArquivo.size} arquivos (esperado 12)`);
  process.exit(1);
}
for (const [caminho, novo] of gravar) writeFileSync(caminho, novo, "utf8");
console.log(`GRAVADO: ${total} prazos em ${gravar.length} arquivos.`);
```

<!-- bloco: aplicar-guia.mjs -->
```js
// Item 3, FASE 2: as três linhas do COMECE-AQUI.md (a :98, a :120 e a :216), trocadas pelo texto aprovado pelo
// Victor pela caixa em 18/11/2026. GRAVA no COMECE-AQUI.md da cópia. Tudo ou nada: cada linha antiga tem de estar
// EXATAMENTE no número dado (comparada sem o CR); senão, ele para sem gravar. O fim de linha da cópia fica como
// está (o CR de cada linha trocada é mantido).
// Uso: node aplicar-guia.mjs <raiz-da-copia>
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const raiz = process.argv[2];
if (!raiz) {
  console.error("uso: node aplicar-guia.mjs <raiz-da-copia>");
  process.exit(1);
}
const TROCAS = [
  [
    98,
    "| `npm test` | os testes puros | 162 arquivos, 3 880 casos |",
    "| `npm test` | os testes puros | 163 arquivos, 3 884 casos |",
  ],
  [
    120,
    "5. **Testes que às vezes caem por tempo** (anotados, ainda sem conserto): na primeira rodada de uma cópia recém-instalada, o `beforeAll` de `tests/proxy-matcher.test.ts` e as varreduras de `tests/vocabulario-da-fila.test.ts` e de `tests/paleta.test.ts`; e, na integração, um caso da migração 012 em `testes-integracao/migracao-dos-dados-legados.integracao.ts`. O procedimento: rode o arquivo sozinho e depois a suíte inteira de novo. Se cair de novo, é defeito de verdade.",
    "5. **Testes que caíam por tempo na primeira rodada de uma cópia nova** (`docs/specs/2026-11-18-testes-que-caem.md`): os casos e os ganchos de `tests/` que varrem a árvore, e os ganchos com `import()`, têm prazo próprio de 60 s, e `tests/prazo-das-varreduras.test.ts` confere isso. Um estouro de tempo neles agora é divergência, e não acaso. Na integração, um caso da migração 012 em `testes-integracao/migracao-dos-dados-legados.integracao.ts` ainda pode cair, pelo corte no segundo e não por prazo: rode o arquivo sozinho e depois a suíte inteira de novo. Se cair de novo, é defeito de verdade.",
  ],
  [
    216,
    "3. **Os testes que caem por tempo** (a seção 4, item 5) e as cópias antigas de trabalho que ainda guardam um `.env.local`: um plano pequeno, à parte.",
    "3. **As cópias antigas de trabalho que ainda guardam um `.env.local`**: um plano pequeno, à parte. Os testes que caíam por tempo ganharam prazo próprio (a seção 4, item 5).",
  ],
];

const caminho = join(raiz, "COMECE-AQUI.md");
const linhas = readFileSync(caminho, "utf8").split("\n");
for (const [n, antes] of TROCAS) {
  const atual = (linhas[n - 1] ?? "").replace(/\r$/, "");
  if (atual !== antes) {
    console.log(`PARADO, NADA GRAVADO: a linha ${n} do COMECE-AQUI.md não é a esperada`);
    process.exit(1);
  }
}
for (const [n, , depois] of TROCAS) {
  const cr = linhas[n - 1].endsWith("\r") ? "\r" : "";
  linhas[n - 1] = depois + cr;
  console.log(`COMECE-AQUI.md:${n} trocada`);
}
writeFileSync(caminho, linhas.join("\n"), "utf8");
console.log("GRAVADO: 3 linhas no COMECE-AQUI.md.");
```

## Apêndice B: as mutações

O `mutar.mjs` abaixo (sha256 `9684565608637d064e3d6ea5f31d63fcb8bb1f6951837aae8c0a9c76cfbe8749`) recebe a cópia, a pasta de saída, o ramo e o HEAD. No ensaio,
rodou a versão anterior dele, `3f05ee6c`, sobre o ramo `ensaio-testes-que-caem` no `8e01d80`. A anterior é igual a
esta, menos em quatro pontos: o ramo e o HEAD eram fixos (eram `ensaio-testes-que-caem` e `8e01d80`), o uso e o
cabeçalho não falavam deles, e não havia a recusa da `main` (um engano de argumento não pode mutar arquivos numa
árvore da `main`). A saída da rodada do ensaio, `mutar-saida.txt`, foi:

```text
base: sem mutação, 4 de 4 verdes
M01 sem o prazo em tests/acesso-nas-actions.test.ts:260: OK: cai só o caso 4, com tests/acesso-nas-actions.test.ts:260 e nenhum outro
M02 sem o prazo em tests/bonus-arte-paginas.test.ts:20: OK: cai só o caso 4, com tests/bonus-arte-paginas.test.ts:20 e nenhum outro
M03 sem o prazo em tests/dreno-com-prazo.test.ts:134: OK: cai só o caso 4, com tests/dreno-com-prazo.test.ts:134 e nenhum outro
M04 sem o prazo em tests/escala.test.ts:221: OK: cai só o caso 4, com tests/escala.test.ts:221 e nenhum outro
M05 sem o prazo em tests/fila-tipos.test.ts:40: OK: cai só o caso 4, com tests/fila-tipos.test.ts:40 e nenhum outro
M06 sem o prazo em tests/linkedin-token-fora-do-cliente.test.ts:35: OK: cai só o caso 4, com tests/linkedin-token-fora-do-cliente.test.ts:35 e nenhum outro
M07 sem o prazo em tests/paginas-sem-conta.test.ts:254: OK: cai só o caso 4, com tests/paginas-sem-conta.test.ts:254 e nenhum outro
M08 sem o prazo em tests/paleta.test.ts:363: OK: cai só o caso 4, com tests/paleta.test.ts:363 e nenhum outro
M09 sem o prazo em tests/proxy-matcher.test.ts:20: OK: cai só o caso 4, com tests/proxy-matcher.test.ts:20 e nenhum outro
M10 sem o prazo em tests/sem-senha-unica.test.ts:75: OK: cai só o caso 4, com tests/sem-senha-unica.test.ts:75 e nenhum outro
M11 sem o prazo em tests/sessao-nas-actions.test.ts:129: OK: cai só o caso 4, com tests/sessao-nas-actions.test.ts:129 e nenhum outro
M12 sem o prazo em tests/vocabulario-da-fila.test.ts:525: OK: cai só o caso 4, com tests/vocabulario-da-fila.test.ts:525 e nenhum outro
M13 5_000 no lugar de 60_000 em tests/vocabulario-da-fila.test.ts:525: OK: cai só o caso 4, com tests/vocabulario-da-fila.test.ts:525 e nenhum outro
M14 uma subpasta em tests/, com um .test.ts dentro: OK: cai só o caso 3, com "tests/ tem subpasta"
M15 só a chamada direta conta, sem o fecho das funções do arquivo: OK: cai «o leitor acusa quando há o que acusar» em :333, na linha sintética (333-335); também caiu «enxerga a árvore que diz enxergar»
M16 só as funções do topo, e não as de dentro de um describe: OK: cai «o leitor acusa quando há o que acusar» em :352, na linha sintética (348-352)
M17 sem o glob/globSync entre as varreduras: OK: cai «o leitor acusa quando há o que acusar» em :344, na linha sintética (344-346)
M18 sem os auxiliares importados: OK: cai «o leitor acusa quando há o que acusar» em :342, na linha sintética (337-342)
M19 só os casos, sem os ganchos que varrem: OK: cai «o leitor acusa quando há o que acusar» em :370, na linha sintética (370-370)
M20 sem a regra (b), a da lista: OK: cai «o leitor acusa quando há o que acusar» em :352, na linha sintética (348-352); também caiu «enxerga a árvore que diz enxergar»
M21 sem o fecho das listas derivadas: OK: cai «o leitor acusa quando há o que acusar» em :364, na linha sintética (362-364)
M22 sem a lista atribuída num gancho: OK: cai «o leitor acusa quando há o que acusar» em :368, na linha sintética (366-368)
M23 sem o gancho com import(): OK: cai «o leitor acusa quando há o que acusar» em :372, na linha sintética (372-372); também caiu «enxerga a árvore que diz enxergar»
M24 sem a função passada por nome: OK: cai «o leitor acusa quando há o que acusar» em :380, na linha sintética (380-382)
M25 aceitando um nome como prazo: OK: cai «o leitor acusa quando há o que acusar» em :376, na linha sintética (376-378)
M26 aceitando qualquer número como prazo, mesmo abaixo de 60_000: OK: cai «o leitor acusa quando há o que acusar» em :374, na linha sintética (374-374)
M27 contando a leitura do valor padrão mesmo com o argumento passado: OK: cai «não acusa o que não varre» em :395, na linha sintética (391-395)
M28 resolvendo pelo nome solto, e não pela declaração visível: OK: cai «não acusa o que não varre» em :401, na linha sintética (397-401); também caiu «todo caso ou gancho que varre a árvore, e todo gancho com import(), têm prazo próprio»

FIM: 28 de 28 mutações derrubaram o caso certo; a árvore está limpa no 8e01d80.
```

<!-- bloco: mutar.mjs -->
```js
// Item 3: as 28 mutações (docs/specs/2026-11-18-testes-que-caem.md, "As mutações"), uma por proteção.
// Roda sobre a cópia dada, no ramo e no HEAD dados, com a árvore commitada e limpa (no ensaio, foi o ramo
// ensaio-testes-que-caem no 8e01d80; na execução, o testes-que-caem no commit da FASE 2). Antes de tudo, uma rodada sem
// mutação tem de dar 4 de 4. Depois, cada mutação troca UMA linha (conferida antes) ou UM trecho (que tem de
// aparecer uma vez só), roda o guarda pelo node (sem npx) e confere:
//   - nos 12 arquivos protegidos e no 5_000: só o caso 4 cai, com o ponto mutado e nenhum outro dos 22;
//   - na subpasta: só o caso 3 cai, com o aviso da subpasta;
//   - no leitor: o caso nomeado cai, e o primeiro expect que falha fica na linha sintética da mutação.
// Depois de cada uma, a árvore volta por git checkout (ou pela remoção da subpasta), e o git status tem de estar
// vazio antes da próxima. Qualquer coisa fora disso é DIVERGÊNCIA, e ele para.
// GRAVA, de passagem, nos arquivos de tests/ da cópia (e cria e apaga tests/mutacao-subpasta/), e grava os json
// do vitest na pasta de saída. No fim, a árvore volta limpa, no mesmo HEAD.
// Uso: node mutar.mjs <raiz-da-copia> <pasta-de-saida-absoluta> <ramo> <head-curto>
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";

const [raiz, saida, RAMO, HEAD] = process.argv.slice(2);
if (!raiz || !saida || !RAMO || !HEAD || !isAbsolute(saida) || !existsSync(saida)) {
  console.error("uso: node mutar.mjs <raiz-da-copia> <pasta-de-saida-absoluta, que já existe> <ramo> <head-curto>");
  process.exit(1);
}
// Um engano de argumento não pode mutar arquivos numa árvore da main (o precedente: linkedin-video, :4817).
if (RAMO === "main") {
  console.error("RECUSADO: o ramo dado é a main");
  process.exit(1);
}
const GUARDA = "tests/prazo-das-varreduras.test.ts";
const VITEST = join(raiz, "node_modules", "vitest", "vitest.mjs");
const CASO1 = "o leitor acusa quando há o que acusar";
const CASO2 = "não acusa o que não varre";
const CASO3 = "enxerga a árvore que diz enxergar";
const CASO4 = "todo caso ou gancho que varre a árvore, e todo gancho com import(), têm prazo próprio";

const git = (...args) => {
  const r = spawnSync("git", args, { cwd: raiz, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} saiu com ${r.status}: ${r.stderr}`);
  return r.stdout;
};
const parar = (motivo) => {
  console.log(`PARADO: ${motivo}`);
  process.exit(1);
};

// As travas.
if (git("branch", "--show-current").trim() !== RAMO) parar(`o ramo não é o ${RAMO}`);
if (git("rev-parse", "--short", "HEAD").trim() !== HEAD) parar(`o HEAD não é o ${HEAD}`);
if (git("status", "--porcelain").trim() !== "") parar("a árvore não está limpa");
if (!existsSync(join(raiz, ".env.local")) || statSync(join(raiz, ".env.local")).size !== 0) parar("o .env.local não existe ou não está vazio");
const outrosEnv = readdirSync(raiz).filter((n) => n.startsWith(".env") && n !== ".env.local");
if (outrosEnv.length) parar(`há outro .env na cópia: ${outrosEnv.join(", ")}`);

// Os 22 pontos, para conferir que a mutação de um arquivo não faz aparecer outro.
const PONTOS = [
  "acesso-nas-actions:260", "acesso-nas-actions:269", "acesso-nas-actions:286", "acesso-nas-actions:290",
  "bonus-arte-paginas:20", "dreno-com-prazo:134", "escala:221", "fila-tipos:40",
  "linkedin-token-fora-do-cliente:35", "linkedin-token-fora-do-cliente:42", "linkedin-token-fora-do-cliente:63",
  "paginas-sem-conta:254", "paginas-sem-conta:259", "paleta:363", "proxy-matcher:20",
  "sem-senha-unica:75", "sem-senha-unica:82", "sessao-nas-actions:129", "sessao-nas-actions:148",
  "sessao-nas-actions:282", "sessao-nas-actions:298", "vocabulario-da-fila:525",
].map((p) => `tests/${p.replace(":", ".test.ts:")} `);

// [arquivo, linha do fechamento, linha do it/beforeAll]: o primeiro prazo de cada um dos 12 (do aplicar-prazos).
const FECHAMENTOS = [
  ["acesso-nas-actions", 267, 260], ["bonus-arte-paginas", 24, 20], ["dreno-com-prazo", 139, 134],
  ["escala", 230, 221], ["fila-tipos", 45, 40], ["linkedin-token-fora-do-cliente", 40, 35],
  ["paginas-sem-conta", 257, 254], ["paleta", 376, 363], ["proxy-matcher", 25, 20],
  ["sem-senha-unica", 80, 75], ["sessao-nas-actions", 146, 129], ["vocabulario-da-fila", 568, 525],
];
const MUTACOES = [
  ...FECHAMENTOS.map(([a, fecha, it]) => ({
    nome: `sem o prazo em tests/${a}.test.ts:${it}`, tipo: "linha", arquivo: `tests/${a}.test.ts`, linha: fecha,
    de: "}, 60_000);", para: "});", caso: CASO4, ponto: `tests/${a}.test.ts:${it} `,
  })),
  {
    nome: "5_000 no lugar de 60_000 em tests/vocabulario-da-fila.test.ts:525", tipo: "linha",
    arquivo: "tests/vocabulario-da-fila.test.ts", linha: 568, de: "}, 60_000);", para: "}, 5_000);", caso: CASO4,
    ponto: "tests/vocabulario-da-fila.test.ts:525 ",
  },
  { nome: "uma subpasta em tests/, com um .test.ts dentro", tipo: "subpasta", caso: CASO3, aviso: "tests/ tem subpasta" },
  {
    nome: "só a chamada direta conta, sem o fecho das funções do arquivo", tipo: "trecho",
    de: "const l = ts.isIdentifier(alvo) ? leitorDe(alvo) : null;", para: "const l = null as Leitor | null;",
    caso: CASO1, comentario: "// dentro de uma função do arquivo, chamada pelo caso",
  },
  {
    nome: "só as funções do topo, e não as de dentro de um describe", tipo: "trecho", de: "juntar(sf);",
    para: "for (const st of sf.statements) { if (ts.isFunctionDeclaration(st) && st.name) funcoes.push([st, st, st.name.text]); if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name) && ehFuncao(d.initializer)) funcoes.push([d, d.initializer, d.name.text]); }",
    caso: CASO1, comentario: "// um leitor declarado dentro do describe, sobre uma lista do describe",
  },
  {
    nome: "sem o glob/globSync entre as varreduras", tipo: "trecho",
    de: 'const VARREDURAS_DO_FS = new Set(["readdirSync", "opendirSync", "readdir", "opendir", "globSync", "glob"]);',
    para: 'const VARREDURAS_DO_FS = new Set(["readdirSync", "opendirSync", "readdir", "opendir"]);',
    caso: CASO1, comentario: "// uma varredura por padrão (glob)",
  },
  {
    nome: "sem os auxiliares importados", tipo: "trecho", de: "if (l) locais.set(el.name.text, l);", para: "void l;",
    caso: CASO1, comentario: "// numa função de um auxiliar de tests/, importada pelo nome",
  },
  {
    nome: "só os casos, sem os ganchos que varrem", tipo: "trecho", de: 'if (varre || (tipo !== "caso" && r.importa)) {',
    para: 'if ((varre && tipo === "caso") || (tipo !== "caso" && r.importa)) {', caso: CASO1, comentario: "// um gancho que varre",
  },
  {
    nome: "sem a regra (b), a da lista", tipo: "trecho", de: 'const lista = r.le && !r.varre ? usaLista(corpo) : "";',
    para: 'const lista = "";', caso: CASO1, comentario: "// um leitor declarado dentro do describe, sobre uma lista do describe",
  },
  {
    nome: "sem o fecho das listas derivadas", tipo: "trecho", de: "if (!ja && (leitura(valor).varre || usaLista(valor))) {",
    para: "if (!ja && leitura(valor).varre) {", caso: CASO1, comentario: "// a lista derivada de outra lista",
  },
  {
    nome: "sem a lista atribuída num gancho", tipo: "trecho", de: "valores.push([declaracoes(n.left), n.left.text, n.right]);",
    para: "void 0;", caso: CASO1, comentario: "// a lista atribuída num gancho (que tem o seu prazo)",
  },
  {
    nome: "sem o gancho com import()", tipo: "trecho", de: 'if (varre || (tipo !== "caso" && r.importa)) {', para: "if (varre) {",
    caso: CASO1, comentario: "// um gancho com import()",
  },
  {
    nome: "sem a função passada por nome", tipo: "trecho",
    de: "if (tipo && i < 0) i = n.arguments.findIndex((a) => ts.isIdentifier(a) && leitorDe(a) !== null);", para: "void 0;",
    caso: CASO1, comentario: "// um leitor passado pelo nome no lugar do corpo",
  },
  {
    nome: "aceitando um nome como prazo", tipo: "trecho",
    de: 'const prazo = depois && ts.isNumericLiteral(depois) ? Number(depois.text.replace(/_/g, "")) : null;',
    para: 'const prazo = depois && ts.isNumericLiteral(depois) ? Number(depois.text.replace(/_/g, "")) : depois && ts.isIdentifier(depois) ? PRAZO_MINIMO : null;',
    caso: CASO1, comentario: "// um nome no lugar do número",
  },
  {
    nome: "aceitando qualquer número como prazo, mesmo abaixo de 60_000", tipo: "trecho",
    de: "const semPrazo = (ps: Ponto[]) => ps.filter((p) => p.prazo === null || p.prazo < PRAZO_MINIMO).map(texto);",
    para: "const semPrazo = (ps: Ponto[]) => ps.filter((p) => p.prazo === null).map(texto);",
    caso: CASO1, comentario: "// um prazo abaixo do mínimo",
  },
  {
    nome: "contando a leitura do valor padrão mesmo com o argumento passado", tipo: "trecho",
    de: "if (l.soSeOmitir === null || n.arguments.length <= l.soSeOmitir) marcar(alvo.text, l.varre);",
    para: "marcar(alvo.text, l.varre);", caso: CASO2,
    comentario: "// o leitor que só lê pelo valor padrão, chamado com o texto: não lê nada",
  },
  {
    nome: "resolvendo pelo nome solto, e não pela declaração visível", tipo: "trecho", de: "const ds = declaracoes(id);",
    para: "const ds = null as readonly ts.Declaration[] | null;", caso: CASO2,
    comentario: '// um nome igual em outro escopo, que varre: o caso chama o visível, que não lê (o "andar" da casa)',
  },
];
if (MUTACOES.length !== 28) parar(`são ${MUTACOES.length} mutações, e não 28`);

// As faixas de linha de cada comentário sintético, no guarda como está no HEAD (as mutações não mudam linhas),
// calculadas ANTES do laço (achado 294): um comentário não achado para aqui, sem nada gravado.
const linhasDoGuarda = readFileSync(join(raiz, GUARDA), "utf8").split("\n").map((l) => l.replace(/\r$/, ""));
const faixa = (comentario) => {
  const i = linhasDoGuarda.findIndex((l) => l.trim() === comentario);
  if (i < 0) parar(`comentário sintético não achado: ${comentario}`);
  let fim = i + 1;
  while (fim < linhasDoGuarda.length && !/^\s*\/\/ /.test(linhasDoGuarda[fim]) && !/^ {2}\}/.test(linhasDoGuarda[fim])) fim++;
  return [i + 2, fim]; // 1-based: da linha seguinte ao comentário até a anterior ao próximo
};
for (const m of MUTACOES) if (m.comentario) m.faixa = faixa(m.comentario);

// O vitest com dois reporters (achado 293): o json diz quem passou e quem caiu; o texto (o stdout, sem cor, porque
// não há TTY) traz a lista inteira de cada falha e a linha já mapeada para o fonte ("❯ tests/…:N:C"). A mensagem
// do json vem abreviada ("expected [ …(22) ]") e não serve para procurar pontos. Uma falha aqui LANÇA, para o
// finally de quem chamou restaurar a árvore.
function rodarGuarda(rotulo) {
  const json = join(saida, `mutacao-${rotulo}.json`);
  const r = spawnSync(
    process.execPath,
    [VITEST, "run", GUARDA, "--reporter=default", "--reporter=json", `--outputFile.json=${json}`],
    { cwd: raiz, encoding: "utf8" }
  );
  const texto = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  writeFileSync(join(saida, `mutacao-${rotulo}.txt`), texto, "utf8");
  if (!existsSync(json)) throw new Error(`o vitest não escreveu ${json} (saiu com ${r.status}): ${texto.slice(-500)}`);
  const casos = JSON.parse(readFileSync(json, "utf8")).testResults.flatMap((t) => t.assertionResults);
  return { casos: casos.map((c) => ({ titulo: c.title, passou: c.status === "passed" })), texto };
}

// O bloco do texto que é a falha de um caso: começa no " FAIL  … > <título>" e vai até o próximo " FAIL " ou o fim.
// A linha do FAIL vem cortada na largura, e um acento pode sair partido: compara-se só o COMEÇO do título, e só
// com os caracteres ASCII dos dois lados.
const soAscii = (s) => s.replace(/[^\x20-\x7e]/g, "");
function blocoDaFalha(texto, titulo) {
  const linhas = texto.split("\n");
  const alvo = soAscii(titulo).slice(0, 20);
  const i = linhas.findIndex((l) => l.startsWith(" FAIL ") && soAscii(l.split(" > ").slice(2).join(" > ")).startsWith(alvo));
  if (i < 0) return "";
  let fim = i + 1;
  while (fim < linhas.length && !linhas[fim].startsWith(" FAIL ")) fim++;
  return linhas.slice(i, fim).join("\n");
}

function restaurar(m) {
  if (m.tipo === "subpasta") rmSync(join(raiz, "tests", "mutacao-subpasta"), { recursive: true, force: true });
  else git("checkout", "--", m.arquivo ?? GUARDA);
  if (git("status", "--porcelain").trim() !== "") parar(`a árvore não voltou limpa depois de: ${m.nome}`);
}

// A rodada sem mutação: 4 de 4.
let base;
try {
  base = rodarGuarda("00-sem-mutacao").casos;
} catch (e) {
  parar(e.message);
}
if (base.length !== 4 || !base.every((c) => c.passou)) parar(`sem mutação, o guarda não deu 4 de 4: ${JSON.stringify(base.map((c) => [c.titulo, c.passou]))}`);
console.log("base: sem mutação, 4 de 4 verdes");

// Cada mutação: preparar (as conferências, antes de gravar qualquer coisa), gravar, rodar e conferir, e restaurar
// num finally. Um erro em qualquer ponto depois de gravar sobe até o catch de fora, DEPOIS do finally.
let divergencias = 0;
try {
  MUTACOES.forEach((m, k) => {
    const rotulo = String(k + 1).padStart(2, "0");
    let gravar;
    if (m.tipo === "subpasta") {
      gravar = () => {
        mkdirSync(join(raiz, "tests", "mutacao-subpasta"));
        writeFileSync(join(raiz, "tests", "mutacao-subpasta", "x.test.ts"), "export {};\n", "utf8");
      };
    } else {
      const arquivo = join(raiz, m.arquivo ?? GUARDA);
      const texto = readFileSync(arquivo, "utf8");
      let novo;
      if (m.tipo === "linha") {
        const linhas = texto.split("\n");
        const atual = linhas[m.linha - 1].replace(/\r$/, "");
        if (atual.trim() !== m.de) parar(`M${rotulo}: a linha ${m.arquivo}:${m.linha} é "${atual}", e não "${m.de}"`);
        linhas[m.linha - 1] = linhas[m.linha - 1].replace(m.de, m.para);
        novo = linhas.join("\n");
      } else {
        const vezes = texto.split(m.de).length - 1;
        if (vezes !== 1) parar(`M${rotulo}: o trecho aparece ${vezes} vezes, e não 1: ${m.de}`);
        novo = texto.replace(m.de, m.para);
      }
      gravar = () => writeFileSync(arquivo, novo, "utf8");
    }
    let veredito;
    try {
      gravar();
      const { casos, texto } = rodarGuarda(rotulo);
      const caidos = casos.filter((c) => !c.passou);
      const alvo = casos.find((c) => c.titulo === m.caso);
      const bloco = alvo && !alvo.passou ? blocoDaFalha(texto, m.caso) : "";
      if (!alvo || alvo.passou) veredito = `NÃO CAIU o caso «${m.caso}»`;
      else if (!bloco) veredito = `o caso caiu, mas o bloco " FAIL … > ${m.caso.slice(0, 20)}…" não foi achado no texto`;
      else if (m.ponto) {
        const outros = PONTOS.filter((p) => p !== m.ponto && bloco.includes(p));
        if (caidos.length !== 1) veredito = `caíram ${caidos.length} casos, e não só o 4`;
        else if (!bloco.includes(m.ponto)) veredito = `o caso 4 caiu sem o ponto ${m.ponto.trim()}`;
        else if (outros.length) veredito = `o caso 4 caiu com outros pontos: ${outros.map((p) => p.trim()).join(", ")}`;
        else veredito = `OK: cai só o caso 4, com ${m.ponto.trim()} e nenhum outro`;
      } else if (m.aviso) {
        if (caidos.length !== 1) veredito = `caíram ${caidos.length} casos, e não só o 3`;
        else veredito = bloco.includes(m.aviso) ? `OK: cai só o caso 3, com "${m.aviso}"` : `o caso 3 caiu sem o aviso "${m.aviso}"`;
      } else {
        const [de, ate] = m.faixa;
        const linha = Number((/❯ tests\/prazo-das-varreduras\.test\.ts:(\d+):\d+/.exec(bloco) ?? [])[1]);
        const tambem = caidos.filter((c) => c.titulo !== m.caso).map((c) => `«${c.titulo}»`);
        veredito =
          linha >= de && linha <= ate
            ? `OK: cai «${m.caso}» em :${linha}, na linha sintética (${de}-${ate})${tambem.length ? `; também caiu ${tambem.join(", ")}` : ""}`
            : `o caso caiu em :${linha || "?"}, fora da linha sintética (${de}-${ate})`;
      }
    } finally {
      restaurar(m);
    }
    const ok = veredito.startsWith("OK");
    if (!ok) divergencias++;
    console.log(`${ok ? "" : "DIVERGÊNCIA "}M${rotulo} ${m.nome}: ${veredito}`);
  });
} catch (e) {
  // A árvore já foi restaurada pelo finally da mutação em que o erro aconteceu.
  parar(`${e.message} (a mutação em curso foi desfeita)`);
}

if (git("rev-parse", "--short", "HEAD").trim() !== HEAD || git("status", "--porcelain").trim() !== "") parar("no fim, o HEAD ou a árvore não estão como no começo");
console.log(`\nFIM: ${MUTACOES.length - divergencias} de ${MUTACOES.length} mutações derrubaram o caso certo; a árvore está limpa no ${HEAD}.`);
process.exit(divergencias ? 1 : 0);
```
