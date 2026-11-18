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
