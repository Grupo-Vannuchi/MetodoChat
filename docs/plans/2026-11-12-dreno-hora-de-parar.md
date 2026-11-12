# A 3a-0, a hora de parar do dreno — Plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: `superpowers:subagent-driven-development`
> (recomendada) ou `superpowers:executing-plans`, fase por fase. Os passos usam caixa de
> seleção (`- [ ]`) para acompanhar.

**Objetivo:** o dreno da fila não começa nada que não tenha tempo de terminar. Passada a hora de parar (o começo da função mais 55 s menos 15 s, ou seja, 40 s), o que ainda não começou volta à fila sem gastar a tentativa, e o post do Instagram confere a mesma hora antes de cada ida à Meta. Os drenos dos cliques do painel deixam de pegar o post do LinkedIn, e todo chamador passa o começo da função: nas actions, marcado logo depois da sessão; nas rotas, como já faziam. São os achados 223, 224 e 225, e a anotação 226.

**Arquitetura:**
- **A hora de parar e os tipos do clique, num lugar só, em `lib/fila-tipos.ts` (puro):**
  - `RESERVA_PARA_TERMINAR_MS` (15 s) e `jaPassouDaHoraDeParar({ inicioDaFuncaoMs, orcamentoMs, agoraMs })`, que dá verdadeiro a partir do instante exato da hora de parar (`>=`);
  - `TIPOS_DO_DRENO_DE_CLIQUE`: os tipos que o dreno conhece, menos o `publicacao_linkedin`;
  - `textoDaDevolucao(tipos)`: a linha do registro, só com a contagem e os tipos, por exemplo "[dreno] a hora de parar chegou: 3 itens voltaram à fila sem gastar tentativa (dm_lote 2, publicacao 1)".
- **O dreno** (`lib/queue-drain.ts`):
  - **antes de reivindicar:** o dreno que começa depois da hora de parar não pega nada e vai direto ao rodapé, que arma o tique como hoje;
  - **no laço, antes de cada item, de todo tipo:** passada a hora, o item da vez e todos os que faltam voltam à fila num `update` só (`devolverOQueNaoComecou`): `pending`, `attempts` menos 1 (nunca abaixo de 0), `not_before = now()`, e o `error` como estava. O laço termina, e o rodapé arma o tique;
  - **a devolução só mexe na linha que este dreno reivindicou** (o 225): ela confere o `status = 'sending'` e a ficha da reivindicação, o `claimed_at` lido como texto e mandado de volta como texto (`$2::text::timestamptz`). Assim, a linha que outro dreno resgatou depois de 3 minutos não volta;
  - **o resumo ganha o `devolvidos`**, contado pelo que o banco devolveu, e cada devolução escreve uma linha "[dreno]" no registro. O `update` fica num `try`/`catch`: uma falha dele não pula o rodapé.
- **O post do Instagram confere a hora por dentro** (`publicarDaFila`, a P2): antes de cada filho do carrossel, do pai, do contêiner, da leitura de estado, da cota e da publicação. Passada a hora, ele volta à fila com o que já fez (os filhos e o contêiner ficam no payload), e o desfecho `"devolvido"` é contado em `devolvidos`.
- **Os drenos de clique** (o 224): `drainQueue({ inicioDaFuncaoMs, doClique: true })` seleciona sem o post do LinkedIn. O rodapé continua contando o post do LinkedIn e arma o tique para ele.
  - Os seis drenos de clique passam o começo e o `doClique`: o "agora" só no Instagram e o das duas redes (`app/publicar/actions.ts`), o `enviarLote` (`app/contatos/actions.ts`), o `sendReply` (`app/conversas/[id]/actions.ts`), o remarcar (`app/publicar/post/actions.ts`) e o "Publicar" do bônus (`app/bonus/publicar-actions.ts` passa o começo ao `publicarNaFila`, em `lib/bonus/publicar-processo.ts`, que o passa ao `drenar`).
  - As 3 rotas (o tique, o webhook e o cron) continuam com `drainQueue({ inicioDaFuncaoMs })` e drenam o post do LinkedIn.
  - O remarcar passa o começo também ao `drenarUmaPublicacaoDoLinkedin`.
- **O teste de fonte** (`tests/dreno-com-prazo.test.ts`) lê os arquivos de `app/` e `lib/` e cobra três coisas:
  - só os 8 de sempre chegam ao dreno: as 3 rotas, as 4 actions de clique e o processo do bônus. Ele acha o import pelo `"@/lib/queue-drain"` e pelo caminho relativo (`./` ou `../`), com aspas duplas ou simples, no `from` (o que inclui o `import * as`) e no `import(...)`;
  - nenhum desses 8 dá outro nome ao dreno nem o guarda numa variável, fora o `drenar` do bônus, que tem caso próprio;
  - toda chamada é uma das duas formas exatas: `drainQueue({ inicioDaFuncaoMs })` nas 3 rotas, e `drainQueue({ inicioDaFuncaoMs, doClique: true })` no resto.
  - Ele não vê o import com `.js` ou `.ts` no fim do caminho, nem um arquivo fora de `app/` e `lib/`. E o caminho pelo `publicarNaFila` só é cobrado no chamador que existe hoje, o `publicarCarrossel`, pelo caso do bônus.

**Stack:** a do projeto, no Next.js 16.4.3: Vitest (puros e integração) e o Postgres no container para a integração.

**O desenho:** `scratchpad/desenho-223.md` (172 linhas), a 3ª versão, lida pela auditoria (`metodochat-f4`) com o sha256 `27b0de3d2ecd4023`. Depois, só a linha 65 mudou, para registrar o 225 (a ficha da reivindicação): o sha256 de agora é `f0b105ad1ee31868`. Ele absorve a 2ª leitura independente e a análise de perigo da auditoria.

**As decisões do Eduardo, pela caixa de 12/11, às 14:06:42.071Z (a linha 109234 do registro da sessão do DEV):**
- **"Confere o relógio (Recomendado)"** (1-B): a P1 e a P2, ou seja, o laço e o post do Instagram por dentro.
- **"Cliques sem LinkedIn (Recomendado)"** (224-A): os drenos de clique não pegam o post do LinkedIn.
- **"À parte, antes (Recomendado)"**: esta entrega vem sozinha, antes da 3a, como a 3-0. A 3a é refeita depois, sobre a `main` nova.

**A base:** a `main` em `e2949fb`, com a 3-0 em produção desde 11/11 (PR #35). A primeira hora e a limpeza da 3-0 estão fechadas.

**Por que esta entrega, em uma frase:** só o post do LinkedIn lia o prazo da função. Depois de uma passada longa dele, o resto do lote rodava sem olhar o relógio, e a função de 60 s podia ser cortada, com a mensagem cortada entre o envio e o `finish` saindo em dobro (o 223). E o dreno dentro do clique de quem usa o painel podia esperar o post do LinkedIn de outro post (o 224).

**A auditoria e os agentes (12/11), pela regra do motor:**
- **O 1º agente**, na revisão do plano da 3a, achou o 223.
- **O 2º agente leu o desenho.** A devolução antes de começar é segura para os quatro tipos, mas sozinha não fecha a classe: o post do Instagram começado aos 39 s não tem teto, e o corte pula o rodapé. Daí a P2.
- **A auditoria achou o 224** e pediu a linha de registro da devolução.
- **O 3º agente** leu o ensaio até a FASE 4. Ele não achou envio em dobro novo dentro dos 60 s. Achou duas coisas:
  - o 225 (CORRIGIR): a devolução não conferia o dono da linha;
  - o 226 (ANOTAR): o teste de fonte tinha brechas, e o `doClique` é opcional.
  - A FASE 5 fecha os dois.
- **A auditoria conferiu cada fase do ensaio pelo patch-id e pela leitura do código.**
- **O 4º agente leu este plano**, com a auditoria, e pediu o que entrou nesta versão: o caminho absoluto da cópia, a regra de divergência, as conferências antes do push, do PR e do merge, o roteiro gravado a partir do Apêndice A, as leituras da primeira hora pela auditoria e o caminho de volta.

**Ensaio do plano (12/11):** o código deste plano foi escrito e testado fase a fase numa cópia isolada (`git worktree`, sem push, branch local `ensaio-dreno-hora-de-parar`, saída de `e2949fb`, com `npm ci` próprio e `.env.local` vazio). Todo bloco de código abaixo foi tirado do git dessa cópia por um gerador, sem cópia à mão. Os commits do ensaio:
- FASE 1, `8c3a797` (patch-id `142c7b277576`);
- FASE 2, `3712dae` (patch-id `8bf0461c9a62`);
- FASE 3, `119aab2` (patch-id `6f3712622625`);
- FASE 4, `ceefb76` (patch-id `1ff253e92786`);
- FASE 5, `8bc5868` (patch-id `402cda67679e`).

As mensagens são as deste plano. Os números de RED e de GREEN de cada passo foram medidos de novo numa segunda cópia limpa da `e2949fb`, com os comandos deste plano, trazendo de cada commit do ensaio primeiro os testes e depois o código (`scratchpad/rodar-fases-li3a0.mjs`). Os registros estão na pasta de trabalho do DEV: `el3a0-fases.log`, `el3a0-lint-tsc.log`, `el3a0-verify.log`, `el3a0-integracao.log`, `el3a0-mutar.log` e `el3a0-aplicar.log`.

Os números do fim, no `8bc5868` (entre parênteses, os da base `e2949fb`):
- o `tsc` e o lint dos arquivos de cada fase limpos nos 5 commits (`el3a0-lint-tsc.log`);
- testes puros: 159 arquivos e 3 784 casos (159 e 3 770); testes de tela: 36 arquivos e 336 casos (36 e 336);
- a varredura sem vazamento e o build com o Next 16.4.3 ("MIGRAÇÃO PULADA", fora da produção);
- a integração no container: 78 arquivos, 954 passaram e 8 pularam (77, 938 e 8);
- as 33 mutações do Apêndice A (16 delas de integração) derrubaram, cada uma, o caso esperado: "33 mutações, 0 ruins; árvore no fim: limpa", com o roteiro de sha256 `df98f1fb6fc187a3` (380 linhas);
- a guarda do diff (FASE 6, Passo 5) mostra só os 13 arquivos do mapa, com 896 linhas a mais e 39 a menos, e nada em `migrations`, `scripts`, `package.json` nem `package-lock.json`;
- cada fase, refeita numa segunda cópia limpa da `e2949fb` com os comandos deste plano, ficou igual ao commit dela no ensaio, com a suíte pura inteira verde no fim de todas;
- este plano, aplicado do zero numa cópia limpa do `e2949fb` (cada "Crie" gravado, cada "Em ... aplique" passado ao `git apply`), deu os 13 arquivos iguais aos do ensaio: "1 criados, 19 diffs aplicados, 0 apagados, 0 gerados; 13 arquivos conferidos, 0 diferentes", e o `git hash-object` de cada um igual ao do `8bc5868` (13 de 13).

**O que o ensaio achou:**
- **O driver do banco perde os microssegundos do parâmetro tipado.** Mandada num `$2::timestamptz`, a ficha da reivindicação vira `Date` no `postgres.js`, chega ao banco com milissegundos, e a igualdade com a coluna nunca casa: sem erro, o `update` só não pega linha. Por isso a ficha é lida como `claimed_at::text` e mandada como `$2::text::timestamptz`. A mutação F5-2 prova que o teste vê a diferença.
  - **Na produção, a auditoria mediu o mesmo caminho, só lendo** (`auditor-ferramentas/sonda-ficha-claimed-at.mjs`): duas transações `read only` separadas, como o dreno faz; `TimeZone` UTC e `DateStyle` "ISO, MDY"; o texto do `claimed_at` com os microssegundos; e a igualdade `claimed_at = $1::text::timestamptz` casou nas 5 linhas lidas.
- **Um caso da 2a mudou** (`testes-integracao/linkedin-publicacao.integracao.ts`, "só texto, com 5 s restando"). Com a hora de parar, o dreno do lote nem pega a linha; as conferências da regra do LinkedIn foram ao caso do `drenarUmaPublicacaoDoLinkedin`. A auditoria aceitou.
- **Por isso, no dreno do lote, o post só texto nunca é adiado pela regra dele**: a reserva da hora de parar (15 s) é o tempo do post (15 s). Na 3a, o caso "só texto, no sétimo adiamento" passa ao `drenarUma`.
- **O remarcar passou o começo também ao `drenarUmaPublicacaoDoLinkedin`**, fora do desenho, e o teste de fonte cobra isso. A auditoria aceitou.
  - A página do Remarcar (`app/publicar/post/[id]/page.tsx`) não declara `maxDuration`, então vale o padrão do projeto. O Eduardo conferiu no painel, em 29/09, o Fluid ligado e o plano Hobby, e a documentação da Vercel dá 300 s como padrão nesse caso. Lá, contar do começo da action só deixa a regra mais conservadora.
  - Mas o Remarcar é o caminho da prova da 3a no preview (o 216): a passada do documento (52 s dos 55) só começa se a sessão, a conta, o `update` e o `statusNaConta` levarem até 3 s. A prova da 3a lê o `adiamentos` da linha depois de cada Remarcar.
- **Duas linhas "[dreno]"** quando o post do Instagram para no meio e ainda sobram itens no lote: uma do post e uma do resto. A auditoria aceitou.
- **O `doClique` ficou opcional, e o teste de fonte é que o cobra** (o 226). Um tipo obrigatório mudaria 94 chamadas sem argumento em 14 arquivos de teste. O que o teste cobra, e o que ele não vê, está na arquitetura, acima.
- **O comentário de `lib/avisos.ts`** que cita a chamada do `enviarLote` passou a citar a forma nova.
- **O `beforeAll` de `tests/proxy-matcher.test.ts`** (o 218) passou de 10 s na primeira rodada do verify do ensaio. Sozinho, deu 13/13 em 948 ms, e a segunda rodada passou inteira. Nada desta entrega toca nele.

**Os limites conhecidos (sem código nesta entrega):**
- **Uma ida sem teto**, começada antes dos 40 s, ainda pode passar dos 60 s. É de propósito: abortar um POST que a Meta já aceitou pode mandar em dobro (`lib/ig.ts:138-143`).
- **O Remarcar do post do LinkedIn conta o prazo do começo da action**, e não do começo do dreno de uma linha: a sessão, a conta, o `update` e o `statusNaConta` vêm antes, e o passo longo só começa se o pior caso dele ainda couber nos 55 s.
  - A passada da imagem (40 s, o `TEMPO_PARA_A_IMAGEM_MS` de `lib/linkedin-fila.ts`) começa se o que vem antes levar até 15 s. Na 3a, a do documento (52 s) começa se levar até 3 s.
  - Se não couber, a linha fica para a passada seguinte, sem gastar tentativa. A prova da 3a lê o `adiamentos` da linha depois de cada Remarcar.
- **O cron diário que chega tarde ao dreno só roda o rodapé.** Ele arma até 200 tiques do dia antes de drenar (`app/api/cron/daily/route.ts:164`, `:177` e `:181`). Se o QStash estiver fora, o cron não drena naquele dia, e os webhooks continuam drenando.
- **A fome, depois da 3a:** com N carrosséis vencidos na fila, cada passada de rota leva um passo longo, e as mensagens do mesmo lote podem voltar até N vezes. Os cliques não entram nisso.
- **A janela de 24 h da conversa e o `validoAte` do lote podem vencer durante a espera.** O dreno confere os dois antes de mandar, e o item vira `guardado` ou `skipped` pela regra de hoje.
- **A devolução que falha no banco** (o `update` lança) deixa as linhas em `sending` até o resgate de 3 minutos, sem linha de registro: o `catch` só devolve 0. O rodapé ainda roda, mas não arma tique para elas, porque só conta as pendentes: elas esperam o resgate por um dreno qualquer depois de 3 minutos.

**Os limites que mudam o que quem usa o painel vê (vão na caixa do Eduardo):**
- **O "agora" das duas redes e o "Publicar" do bônus podem não publicar no clique** se o que roda antes do dreno passar dos 40 s. Na produção, o tique que o rodapé arma drena uns 20 s depois. No preview, que não tem QStash, a linha espera.
- **O "Enviar" de um lote grande pode dizer que ninguém recebeu agora** e mandar pelo tique uns 20 s depois. O `enqueueLote` grava um contato por vez (`lib/engine.ts:2523`, na `e2949fb`), e, se isso passar dos 40 s, o dreno do clique não pega nada.
- **O post do LinkedIn vencido só sai pelos drenos das rotas** (o tique, o webhook e o cron) e pelo dreno de uma linha só dele (o "agora" e o Remarcar). Com o QStash fora, ele espera o próximo webhook ou o cron.

## Restrições globais

- **A cópia tem caminho absoluto fixo**, fora da pasta do projeto, que tem o `.env.local` de produção:
  - `C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/dreno-hora-de-parar"`;
  - todo bloco de comandos abaixo começa por essa linha e por `cd "$C" || exit 1`, porque a sessão não guarda o `cd` fora da pasta do projeto;
  - o `..` dos comandos é a pasta de trabalho do DEV, onde ficam o `varrer-texto.mjs` (sha256 `f350d19f515e854f`) e o roteiro das mutações.
- **Branch:** `dreno-hora-de-parar`, saída do `e2949fb` (a `main` com a 3-0), sem upstream.
  - Nunca commitar nem empurrar na `main`: ela não está protegida, e um push nela dispara o deploy na Vercel.
  - Todo commit vem depois de `test "$(git branch --show-current)" = dreno-hora-de-parar &&`.
- **`git add` com caminho explícito.** Nunca `-A` nem `.`.
- **Commit no estilo do Vinícius:** uma frase dizendo o efeito, sem prefixo, sem rodapé de IA.
  - Autor: Eduardo Kobal <162614913+Eduardokobal@users.noreply.github.com>.
  - Nunca `git config` numa worktree.
- **Antes de cada commit**, o `node ../varrer-texto.mjs` nos arquivos da fase (cada um "limpo"), no mesmo comando do commit, com `&&`.
- **O commit é um comando à parte**, depois de ler a saída dos testes.
- **A regra de divergência:** se o RED, o GREEN, o patch-id, a guarda ou a aplicação não baterem com o plano, pare. Não ajuste o teste nem o código: mande a saída inteira à auditoria e espere.
- **O 218 em toda rodada da suíte pura:** se o `beforeAll` de `tests/proxy-matcher.test.ts` passar de 10 s ("Hook timed out in 10000ms"), rode-o sozinho (`npx --no-install vitest run tests/proxy-matcher.test.ts`, 13 casos) e a suíte de novo. Se cair outra vez, é divergência.
- **Fim de linha:** os diffs deste plano estão em LF. A cópia é feita com `git -c core.autocrlf=false`, e o `git apply --ignore-whitespace` serve se ela não for.
- **Os arquivos desta entrega são os 13 do mapa abaixo, e mais nenhum.** É código do motor (`lib/queue-drain.ts`): o cuidado do motor vale (auditoria, DEV e agentes).
- **Os testes da 3-0 continuam passando sem mudança:** `testes-integracao/dreno-forma-desconhecida.integracao.ts`, `testes-integracao/linkedin-telas.integracao.ts` e `tests/fila-tipos.test.ts` (neste, o import cresce e os casos novos entram no fim; os 9 casos antigos ficam como estão).
- **Nenhuma migração e nenhuma escrita em produção** nesta entrega, fora o merge do Eduardo e o deploy que ele dispara. O deploy tem de dizer "Nada a aplicar: as 26 migrações já constam no registro."
- **O DEV não se conecta à produção.** As leituras da base (antes do merge e na primeira hora) são da auditoria, com as ferramentas dela.
- **Uma rodada de integração de cada vez**, sempre com `DATABASE_URL_TESTES=postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes`.
  - Toda rodada tem de imprimir `[rede-global] ALVO: banco de TESTE`.
  - Nunca rode com a variável vazia: ela cai na `DATABASE_URL`, que é **produção**.
  - Se o container estiver parado: `docker start metodochat-banco-de-teste`.
- **`npx --no-install`** sempre (achado 208), e o `npm ci` da FASE 0 antes de qualquer teste.
- **A suíte pura inteira roda no fim de toda fase**, além dos arquivos da fase.
- **`next build` sem as variáveis de agente:** `env -u CLAUDECODE -u AI_AGENT ...`, e `git diff AGENTS.md` depois.
- **No corpo do PR**, nenhuma arroba solta, nem e-mail, nem nome de pessoa ou de conta: o repositório é público.
- **A ordem com a parte 3a:** a 3a é refeita sobre a `main` com esta entrega, e o push dela só vem depois do deploy desta, conferido.

## Mapa dos arquivos

| Arquivo | O que faz | Fase |
|---|---|---|
| `lib/fila-tipos.ts` | a hora de parar, os tipos do dreno de clique e o texto do registro | 1 |
| `tests/fila-tipos.test.ts` | idem; os 9 casos antigos ficam como estão | 1 |
| `lib/queue-drain.ts` | a conferência antes de reivindicar e no laço, a devolução, o `devolvidos`, o registro; a P2 no post do Instagram; a seleção do clique; a ficha da reivindicação | 2, 3, 4 e 5 |
| `testes-integracao/dreno-hora-de-parar.integracao.ts` (novo) | o dreno com o relógio passando da hora, por tipo, com a Meta falsa | 2, 3, 4 e 5 |
| `testes-integracao/linkedin-publicacao.integracao.ts` | o caso da 2a "só texto, com 5 s restando" | 2 |
| `app/publicar/actions.ts` | o "agora" só no Instagram e o das duas redes passam o `doClique` (o primeiro, também o começo) | 4 |
| `app/contatos/actions.ts` | o `enviarLote` passa o começo e o `doClique` | 4 |
| `app/conversas/[id]/actions.ts` | o `sendReply` passa o começo e o `doClique` | 4 |
| `app/publicar/post/actions.ts` | o remarcar passa o começo ao dreno e ao `drenarUma`, e o `doClique` ao dreno | 4 |
| `app/bonus/publicar-actions.ts` | o `publicarCarrossel` passa o começo ao `publicarNaFila` | 4 |
| `lib/bonus/publicar-processo.ts` | o `publicarNaFila` passa o começo e o `doClique` ao `drenar` | 4 |
| `tests/dreno-com-prazo.test.ts` | o teste de fonte dos 8 arquivos que chegam ao dreno | 4 e 5 |
| `lib/avisos.ts` | o comentário que cita a chamada do `enviarLote` | 5 |

São 13 arquivos, 1 deles novo. O `testes-integracao/dreno-hora-de-parar.integracao.ts` nasce na FASE 2 e cresce nas FASES 3, 4 e 5.

---

### FASE 0 — Começar da branch certa

- [ ] **Passo 1: a branch, saída da `main`, no caminho fixo**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/dreno-hora-de-parar"
test ! -e "$C" || { echo "a pasta da cópia já existe: pare"; exit 1; }
cd "$HOME/Projetos/metodochat" || exit 1
git fetch origin
test "$(git rev-parse --short origin/main)" = e2949fb || { echo "a main mudou: pare"; exit 1; }
git -c core.autocrlf=false worktree add -b dreno-hora-de-parar "$C" e2949fb
cd "$C" || exit 1
git rev-parse --abbrev-ref @{upstream} 2>/dev/null || echo "sem upstream"   # sem upstream: nada sobe sem querer
git branch --show-current                          # dreno-hora-de-parar
: > .env.local                                     # vazio: nenhum banco de produção na cópia
npm ci
docker ps --format '{{.Names}} {{.Status}}' | grep metodochat-banco-de-teste   # healthy; senão, docker start
```

Se `origin/main` não estiver em `e2949fb`, pare: a base mudou, e o plano precisa ser conferido de novo.

- [ ] **Passo 2: o plano na branch.** O primeiro commit da branch é este plano, em `docs/plans/2026-11-12-dreno-hora-de-parar.md`.

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/dreno-hora-de-parar"; cd "$C" || exit 1
node ../varrer-texto.mjs docs/plans/2026-11-12-dreno-hora-de-parar.md && test "$(git branch --show-current)" = dreno-hora-de-parar && git add docs/plans/2026-11-12-dreno-hora-de-parar.md && git commit -m "O plano da 3a-0: o dreno não começa nada depois da hora de parar, devolve à fila o que não começou, e os cliques do painel não pegam o post do LinkedIn"
```

---

### FASE 1 — A hora de parar, os tipos do clique e o texto do registro, num lugar só

**Arquivos:** `lib/fila-tipos.ts`, `tests/fila-tipos.test.ts`.

- [ ] **Passo 1: os testes**

Em `tests/fila-tipos.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/fila-tipos.test.ts b/tests/fila-tipos.test.ts
index 3a97d22..c68ad56 100644
--- a/tests/fila-tipos.test.ts
+++ b/tests/fila-tipos.test.ts
@@ -1,7 +1,16 @@
 import { describe, expect, expectTypeOf, it } from "vitest";
 import { readdirSync, readFileSync } from "node:fs";
 import { join } from "node:path";
-import { naOrdemDoLote, TIPOS_DE_PUBLICACAO, TIPOS_QUE_O_DRENO_CONHECE, type TipoDaFila } from "@/lib/fila-tipos";
+import {
+  jaPassouDaHoraDeParar,
+  naOrdemDoLote,
+  RESERVA_PARA_TERMINAR_MS,
+  textoDaDevolucao,
+  TIPOS_DE_PUBLICACAO,
+  TIPOS_DO_DRENO_DE_CLIQUE,
+  TIPOS_QUE_O_DRENO_CONHECE,
+  type TipoDaFila,
+} from "@/lib/fila-tipos";
 import type { QueueItem } from "@/lib/db";
 
 // A LISTA DOS TIPOS QUE O DRENO CONHECE É A DO BANCO (docs/specs/2026-11-06-linkedin-no-perfil.md, §0).
@@ -101,3 +110,47 @@ describe("a ordem do lote", () => {
     expect(lote).toEqual(copia);
   });
 });
+
+// OS TIPOS DO DRENO DE CLIQUE (a 3a-0; o 224): o dreno que roda dentro do clique de quem usa o painel não pega o post
+// do LinkedIn, que pode levar uma passada inteira, e a seleção não filtra pela conta do clique.
+describe("os tipos do dreno de clique (a 3a-0, o 224)", () => {
+  it("são os que o dreno conhece, na mesma ordem, menos o post do LinkedIn", () => {
+    expect(TIPOS_DO_DRENO_DE_CLIQUE).toEqual(TIPOS_QUE_O_DRENO_CONHECE.filter((t) => t !== "publicacao_linkedin"));
+    expect(TIPOS_DO_DRENO_DE_CLIQUE).toHaveLength(TIPOS_QUE_O_DRENO_CONHECE.length - 1);
+    expect(TIPOS_DO_DRENO_DE_CLIQUE).not.toContain("publicacao_linkedin");
+    expect(TIPOS_DO_DRENO_DE_CLIQUE).toContain("publicacao");
+    expect(TIPOS_DO_DRENO_DE_CLIQUE).toContain("dm_manual");
+  });
+});
+
+// A HORA DE PARAR (a 3a-0; o 223): nada começa depois dela. É o começo da função mais o orçamento, menos a reserva
+// para o que já começou terminar: 55 − 15 = 40 s numa função de 60.
+describe("a hora de parar (a 3a-0, o 223)", () => {
+  const passou = (agoraMs: number) => jaPassouDaHoraDeParar({ inicioDaFuncaoMs: 1_000_000, orcamentoMs: 55_000, agoraMs });
+
+  it("a reserva é de 15 s, e a hora de parar é o começo mais 40 s, contando o próprio instante", () => {
+    expect(RESERVA_PARA_TERMINAR_MS).toBe(15_000);
+    expect(passou(1_000_000)).toBe(false);
+    expect(passou(1_039_999)).toBe(false);
+    expect(passou(1_040_000)).toBe(true);
+    expect(passou(1_100_000)).toBe(true);
+  });
+
+  it("segue o orçamento que recebe", () => {
+    expect(jaPassouDaHoraDeParar({ inicioDaFuncaoMs: 0, orcamentoMs: 30_000, agoraMs: 14_999 })).toBe(false);
+    expect(jaPassouDaHoraDeParar({ inicioDaFuncaoMs: 0, orcamentoMs: 30_000, agoraMs: 15_000 })).toBe(true);
+  });
+});
+
+// A LINHA DO REGISTRO DA DEVOLUÇÃO (a 3a-0; pedido da auditoria): só a contagem e os tipos. Ela recebe só os tipos,
+// e o caso de integração confere a linha que de fato vai ao registro (testes-integracao/dreno-hora-de-parar).
+describe("a linha do registro da devolução (a 3a-0)", () => {
+  it("diz a contagem e os tipos, em ordem alfabética, no plural e no singular", () => {
+    expect(textoDaDevolucao(["dm_lote", "publicacao", "dm_lote"])).toBe(
+      "[dreno] a hora de parar chegou: 3 itens voltaram à fila sem gastar tentativa (dm_lote 2, publicacao 1)"
+    );
+    expect(textoDaDevolucao(["dm_manual"])).toBe(
+      "[dreno] a hora de parar chegou: 1 item voltou à fila sem gastar tentativa (dm_manual 1)"
+    );
+  });
+});
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/dreno-hora-de-parar"; cd "$C" || exit 1
npx --no-install vitest run tests/fila-tipos.test.ts
```

Esperado: "Test Files 1 failed (1)" e "Tests 4 failed | 9 passed (13)". Caem os 4 casos novos: os tipos do dreno de clique, os dois da hora de parar e a linha do registro, porque as três peças ainda não existem. Os 9 casos antigos passam.

- [ ] **Passo 3: o código**

Em `lib/fila-tipos.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/fila-tipos.ts b/lib/fila-tipos.ts
index c636510..60a399f 100644
--- a/lib/fila-tipos.ts
+++ b/lib/fila-tipos.ts
@@ -57,3 +57,41 @@ function adiamentosDoPayload(payload: unknown): number {
   const v = (payload as Record<string, unknown>).adiamentos;
   return typeof v === "number" && Number.isInteger(v) ? v : 0;
 }
+
+// OS TIPOS DO DRENO DE CLIQUE (a 3a-0; o 224; scratchpad/desenho-223.md, P3). Os drenos que rodam dentro do clique de
+// quem usa o painel (responder no inbox, enviar um lote, publicar no Instagram, remarcar e o "Publicar" do bônus) não
+// pegam o post do LinkedIn: a passada dele pode ser longa (até ~52 s pelos tetos), e a seleção do dreno não filtra
+// pela conta do clique, então o clique de uma pessoa esperaria o post de outra. O post do LinkedIn sai pelos drenos das
+// rotas (o tique, o webhook e o cron) e pelo dreno de uma linha só dele (o "agora" e o Remarcar).
+export const TIPOS_DO_DRENO_DE_CLIQUE = TIPOS_QUE_O_DRENO_CONHECE.filter(
+  (t): t is Exclude<TipoDaFila, "publicacao_linkedin"> => t !== "publicacao_linkedin"
+);
+
+// A HORA DE PARAR (a 3a-0; o 223; scratchpad/desenho-223.md, P1 e P2). Nada começa depois dela: nem a reivindicação do
+// lote, nem um item do laço, nem uma etapa do post do Instagram. Ela é o começo da função mais o orçamento
+// (`ORCAMENTO_DA_FUNCAO_MS`, 55 s, lib/queue-drain.ts) menos a reserva para o que já começou terminar: 40 s numa função
+// de 60, com 20 s até o corte.
+//
+// A RESERVA É UMA ESTIMATIVA, E NÃO UMA MEDIDA. Ela cobre o perigo que importa em cada tipo: na mensagem, uma ida à Meta
+// e os 600 ms do ritmo (o corte entre o envio e o `finish` mandaria em dobro, lib/ig.ts); no post do Instagram, uma
+// etapa (o corte ali não publica em dobro, mas deixa a linha em `sending` até o resgate). No post do LinkedIn, cada
+// passo já só começa se o pior caso dele cabe (lib/linkedin-fila.ts).
+export const RESERVA_PARA_TERMINAR_MS = 15_000;
+
+export function jaPassouDaHoraDeParar(p: { inicioDaFuncaoMs: number; orcamentoMs: number; agoraMs: number }): boolean {
+  return p.agoraMs >= p.inicioDaFuncaoMs + p.orcamentoMs - RESERVA_PARA_TERMINAR_MS;
+}
+
+// A LINHA DO REGISTRO QUANDO O DRENO DEVOLVE ITENS À FILA (a 3a-0; pedido da auditoria): só a contagem e os tipos, sem
+// id, sem texto e sem conta. A função recebe só os tipos, e então não tem como levar outra coisa. É o único jeito de
+// ver a regra da hora de parar agindo na produção, e a primeira hora a lê nos registros da Vercel.
+export function textoDaDevolucao(tipos: readonly string[]): string {
+  const porTipo = new Map<string, number>();
+  for (const t of tipos) porTipo.set(t, (porTipo.get(t) ?? 0) + 1);
+  const lista = [...porTipo.entries()]
+    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
+    .map(([t, n]) => `${t} ${n}`)
+    .join(", ");
+  const n = tipos.length;
+  return `[dreno] a hora de parar chegou: ${n} ${n === 1 ? "item voltou" : "itens voltaram"} à fila sem gastar tentativa (${lista})`;
+}
```

- [ ] **Passo 4: rodar e ver passar**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/dreno-hora-de-parar"; cd "$C" || exit 1
npx --no-install vitest run tests/fila-tipos.test.ts
npx --no-install vitest run
npx --no-install tsc --noEmit
npx --no-install eslint lib/fila-tipos.ts tests/fila-tipos.test.ts
```

Esperado: "Test Files 1 passed (1)" e "Tests 13 passed (13)"; a suíte pura inteira: "Test Files 159 passed (159)" e "Tests 3774 passed (3774)". O `tsc` e o lint sem saída.

- [ ] **Passo 5: o commit**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/dreno-hora-de-parar"; cd "$C" || exit 1
node ../varrer-texto.mjs lib/fila-tipos.ts tests/fila-tipos.test.ts && test "$(git branch --show-current)" = dreno-hora-de-parar && git add lib/fila-tipos.ts tests/fila-tipos.test.ts && git commit -m "A fila ganha a hora de parar, os tipos do dreno de clique sem o post do LinkedIn e a linha do registro da devolução"
git show HEAD | git patch-id --stable | cut -c1-12   # 142c7b277576
```

---

### FASE 2 — O dreno não reivindica tarde e, no laço, devolve o que não começou

**Arquivos:** `lib/queue-drain.ts`, `testes-integracao/dreno-hora-de-parar.integracao.ts` (novo), `testes-integracao/linkedin-publicacao.integracao.ts`.

O relógio dos testes é o da função: os casos passam ao dreno um começo no passado (`inicioDaFuncaoMs`, por exemplo 39 s atrás), e o LinkedIn falso demora o bastante para a hora de parar chegar durante o post dele. O QStash, a Meta e o LinkedIn são falsos, no loopback: nenhum caso fala com a Meta nem com o LinkedIn de verdade.

- [ ] **Passo 1: os testes**

Crie `testes-integracao/dreno-hora-de-parar.integracao.ts`:

```ts
// A HORA DE PARAR DO DRENO (a 3a-0; os achados 223 e 224; scratchpad/desenho-223.md, P1).
//
// O PROBLEMA, medido na e2949fb: o laço do dreno (lib/queue-drain.ts, `drainQueue`) percorre até 15 linhas já
// reivindicadas, e só o post do LinkedIn olha o relógio. Depois de uma passada longa dele, o resto do lote começava sem
// olhar o tempo que sobrava, e a função de 60 s podia ser cortada no meio de uma mensagem, que então sairia em dobro.
//
// A REGRA: nada começa depois da hora de parar (o começo da função + 55 s − 15 s = 40 s; `jaPassouDaHoraDeParar`,
// lib/fila-tipos.ts). O dreno que começa depois dela não reivindica nada e só arma o tique. No laço, o item da vez e
// todos os que faltam voltam à fila num `update` só: `pending`, sem gastar a tentativa, com o `error` de antes, e o
// rodapé arma o tique. Uma linha vai ao registro, só com a contagem e os tipos.
//
// A MAQUINARIA: o QStash, a Meta e o LinkedIn são falsos, no loopback. O relógio é o da função: os casos passam ao
// dreno um começo no passado (`inicioDaFuncaoMs`), e o LinkedIn falso demora o bastante para a hora de parar chegar
// durante o post dele. **NADA AQUI FALA COM A META NEM COM O LINKEDIN DE VERDADE.**
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { bancoDescartavel } from "./harness";
import { textoDaDevolucao } from "@/lib/fila-tipos";

type ModuloDreno = typeof import("@/lib/queue-drain");
type ModuloQstash = typeof import("@/lib/qstash");

const banco = bancoDescartavel();
const q = (texto: string, params: unknown[] = []) =>
  banco.db().sql().query(texto, params) as Promise<Record<string, unknown>[]>;

// Valores inventados. Nenhuma credencial de verdade entra em teste.
const CONTA = "17800000000022301";
const CONTATO = "17800000000022399";
const TOKEN_DA_CONTA = "token-da-conta-da-hora-de-parar-que-nao-vale-nada";
const TOKEN_DO_LINKEDIN = "AQVautorizacaoDaHoraDePararQueNaoValeNada";
const TOKEN_DO_QSTASH = "token-de-qstash-inventado-para-a-hora-de-parar";
const APP_URL = "https://exemplo.invalid";

const qstash = { publicados: [] as string[] };
const meta = { textos: [] as string[], desconhecidos: [] as string[] };
const linkedin = { pedidos: [] as string[], atrasoMs: 0, durante: null as null | (() => Promise<void>) };

let servidorQstash: Server;
let servidorMeta: Server;
let servidorLinkedin: Server;
let dreno: ModuloDreno;
let moduloQstash: ModuloQstash;

const esperar = (ms: number) => new Promise((pronto) => setTimeout(pronto, ms));

function responder(res: ServerResponse, status: number, corpo: unknown, cabecalhos: Record<string, string> = {}) {
  res.writeHead(status, { "content-type": "application/json", ...cabecalhos });
  res.end(typeof corpo === "string" ? corpo : JSON.stringify(corpo));
}

async function corpoDe(req: IncomingMessage): Promise<string> {
  const pedacos: Buffer[] = [];
  for await (const parte of req) pedacos.push(parte as Buffer);
  return Buffer.concat(pedacos).toString("utf8");
}

beforeAll(async () => {
  servidorQstash = createServer(async (req, res) => {
    await corpoDe(req);
    if (req.method === "POST" && (req.url ?? "").startsWith("/v2/publish/")) {
      qstash.publicados.push(req.url ?? "");
      return responder(res, 200, { messageId: `msg-${qstash.publicados.length}` });
    }
    responder(res, 404, { error: "o qstash falso nao conhece esse caminho" });
  });
  servidorMeta = createServer(async (req, res) => {
    const corpo = await corpoDe(req);
    const u = new URL(req.url ?? "/", "http://127.0.0.1");
    if (req.method === "POST" && u.pathname.endsWith("/messages")) {
      const lido = JSON.parse(corpo || "{}") as { message?: { text?: string } };
      meta.textos.push(lido.message?.text ?? "");
      return responder(res, 200, { message_id: `mid-${meta.textos.length}`, recipient_id: CONTATO });
    }
    meta.desconhecidos.push(`${req.method} ${u.pathname}`);
    responder(res, 404, { error: { message: `o falso não conhece ${u.pathname}` } });
  });
  servidorLinkedin = createServer(async (req, res) => {
    await corpoDe(req);
    const u = new URL(req.url ?? "/", "http://127.0.0.1");
    linkedin.pedidos.push(`${req.method} ${u.pathname}`);
    if (req.method === "POST" && u.pathname === "/rest/posts") {
      if (linkedin.durante) await linkedin.durante();
      if (linkedin.atrasoMs) await esperar(linkedin.atrasoMs);
      return responder(res, 201, "", { "x-restli-id": "urn:li:share:7000000000000022301" });
    }
    responder(res, 404, { message: "o LinkedIn falso não conhece esse caminho" });
  });
  for (const s of [servidorQstash, servidorMeta, servidorLinkedin]) {
    await new Promise<void>((pronto) => s.listen(0, "127.0.0.1", pronto));
  }
  const base = (s: Server) => `http://127.0.0.1:${(s.address() as AddressInfo).port}`;
  process.env.QSTASH_URL = base(servidorQstash);
  process.env.QSTASH_TOKEN = TOKEN_DO_QSTASH;
  process.env.IG_GRAPH_BASE = base(servidorMeta);
  process.env.LINKEDIN_API_BASE = base(servidorLinkedin);

  // AS GUARDAS, ANTES DE QUALQUER DRENO: sem os desvios, este teste falaria com as redes de verdade.
  const ig = await import("@/lib/ig");
  if (ig.baseDoGraph() !== base(servidorMeta)) throw new Error("RECUSADO: a base do Graph não é a desta rodada.");
  const li = await import("@/lib/linkedin");
  if (li.basesDoLinkedin().api !== base(servidorLinkedin)) throw new Error("RECUSADO: a base do LinkedIn não é a desta rodada.");
  moduloQstash = await import("@/lib/qstash");
  if (!moduloQstash.qstashEnabled()) throw new Error("RECUSADO: qstashEnabled() falso com a QSTASH_TOKEN posta.");
  dreno = await import("@/lib/queue-drain");

  await banco.db().updateConfig({ app_url: APP_URL });
  await banco.db().upsertAccount({
    ig_user_id: CONTA,
    username: "conta_da_hora_de_parar",
    name: "conta_da_hora_de_parar",
    profile_picture_url: null,
    access_token: TOKEN_DA_CONTA,
    token_expires_at: null,
  });
});

afterAll(async () => {
  for (const v of ["QSTASH_URL", "QSTASH_TOKEN", "IG_GRAPH_BASE", "LINKEDIN_API_BASE"]) delete process.env[v];
  for (const s of [servidorQstash, servidorMeta, servidorLinkedin]) await new Promise<void>((pronto) => s.close(() => pronto()));
});

beforeEach(async () => {
  await q(`delete from queue`);
  await q(`delete from contacts`);
  await q(`delete from linkedin_conexoes`);
  // A JANELA DE 24 H ABERTA: o contato escreveu agora há pouco.
  await q(`insert into contacts (account_id, ig_id, last_reply_at) values ($1, $2, now())`, [CONTA, CONTATO]);
  await q(
    `insert into linkedin_conexoes (account_id, pessoa_id, nome, access_token, expira_em)
     values ($1, 'pessoaDaHoraDeParar', 'Dra. Ana Souza', $2, now() + interval '30 days')`,
    [CONTA, TOKEN_DO_LINKEDIN]
  );
  qstash.publicados = [];
  meta.textos = [];
  meta.desconhecidos = [];
  linkedin.pedidos = [];
  linkedin.atrasoMs = 0;
  linkedin.durante = null;
});

/** Uma mensagem manual vencida, para o contato da conta, com o texto dado. Cada uma nasce depois da anterior. */
async function mensagem(texto: string, extra: { attempts?: number; error?: string | null } = {}): Promise<string> {
  const [linha] = (await q(
    `insert into queue (account_id, kind, contact_ig_id, payload, dedupe_key, not_before, attempts, error)
     values ($1, 'dm_manual', $2, $3, $4, now() - interval '1 minute', $5, $6)
     returning id`,
    [CONTA, CONTATO, { text: texto }, `hora-de-parar:${texto}`, extra.attempts ?? 0, extra.error ?? null]
  )) as { id: string }[];
  await esperar(5);
  return linha.id;
}

/**
 * O POST DO LINKEDIN SÓ TEXTO JÁ ADIADO UMA VEZ, que a ordem do lote põe primeiro. O `adiamentos` é semeado à mão: a
 * e2949fb não o grava (quem o grava é a 3a).
 */
async function postDoLinkedinAdiado(): Promise<string> {
  const [linha] = (await q(
    `insert into queue (account_id, kind, payload, dedupe_key, not_before)
     values ($1, 'publicacao_linkedin', $2, 'hora-de-parar:linkedin', now() - interval '1 minute')
     returning id`,
    [CONTA, { forma: "texto", caminhos: [], texto: "O post do LinkedIn que vai primeiro", adiamentos: 1 }]
  )) as { id: string }[];
  await esperar(5);
  return linha.id;
}

type Linha = { status: string; attempts: number; error: string | null; claimed_at: Date | null; vencida: boolean };
const linha = async (id: string) =>
  (
    (await q(`select status, attempts, error, claimed_at, not_before <= now() as vencida from queue where id = $1`, [
      id,
    ])) as Linha[]
  )[0];

/** O COMEÇO DA FUNÇÃO de 39 s atrás: o LinkedIn ainda tem os 15 s do post, e a hora de parar chega durante ele. */
const haTrintaENoveSegundos = () => Date.now() - 39_000;

/** As linhas que o dreno mandou ao registro com o prefixo dele, durante a chamada. */
async function comORegistro<T>(fazer: () => Promise<T>): Promise<{ valor: T; linhas: string[] }> {
  const espiao = vi.spyOn(console, "log").mockImplementation(() => {});
  try {
    const valor = await fazer();
    const linhas = espiao.mock.calls.map((c) => c.map(String).join(" ")).filter((l) => l.startsWith("[dreno]"));
    return { valor, linhas };
  } finally {
    espiao.mockRestore();
  }
}

describe("a hora de parar, antes de reivindicar", () => {
  it("o dreno que começa depois da hora de parar não pega nada: as linhas ficam como estavam, nada volta, e o tique é armado", async () => {
    const a = await mensagem("primeira");
    const b = await mensagem("segunda");
    const { valor: resumo, linhas } = await comORegistro(() => dreno.drainQueue({ inicioDaFuncaoMs: Date.now() - 41_000 }));
    for (const id of [a, b]) expect(await linha(id)).toMatchObject({ status: "pending", attempts: 0, claimed_at: null });
    expect(resumo).toMatchObject({ sent: 0, skipped: 0, failed: 0, devolvidos: 0 });
    expect(linhas).toEqual([]);
    expect(meta.textos).toEqual([]);
    expect(qstash.publicados).toHaveLength(1);
  });
});

describe("a hora de parar, no laço", () => {
  it("depois do post do LinkedIn que leva o relógio além dos 40 s, as mensagens voltam à fila sem gastar tentativa e sem tocar no error", async () => {
    const li = await postDoLinkedinAdiado();
    const a = await mensagem("a primeira mensagem");
    const b = await mensagem("a segunda mensagem", { attempts: 1, error: "a Meta não respondeu da última vez" });
    const c = await mensagem("a terceira mensagem");
    linkedin.atrasoMs = 2_000;
    const resumo = await dreno.drainQueue({ inicioDaFuncaoMs: haTrintaENoveSegundos() });
    expect((await linha(li)).status).toBe("sent");
    expect(await linha(a)).toMatchObject({ status: "pending", attempts: 0, error: null, vencida: true });
    expect(await linha(b)).toMatchObject({ status: "pending", attempts: 1, error: "a Meta não respondeu da última vez", vencida: true });
    expect(await linha(c)).toMatchObject({ status: "pending", attempts: 0, error: null, vencida: true });
    expect(resumo).toMatchObject({ sent: 1, devolvidos: 3 });
    expect(meta.textos).toEqual([]);
    expect(linkedin.pedidos).toEqual(["POST /rest/posts"]);
    // O RODAPÉ ARMOU O TIQUE: as mensagens vencidas saem na passada seguinte.
    expect(qstash.publicados).toHaveLength(1);
  });

  it("a linha do registro diz só a contagem e os tipos: nenhum id da fila, nenhuma conta, nenhum contato e nenhum texto das mensagens", async () => {
    const ids = [await postDoLinkedinAdiado()];
    const textos = ["o texto secreto da primeira", "o texto secreto da segunda", "o texto secreto da terceira"];
    for (const t of textos) ids.push(await mensagem(t));
    linkedin.atrasoMs = 2_000;
    const { linhas } = await comORegistro(() => dreno.drainQueue({ inicioDaFuncaoMs: haTrintaENoveSegundos() }));
    expect(linhas).toEqual([textoDaDevolucao(["dm_manual", "dm_manual", "dm_manual"])]);
    for (const proibido of [...ids, CONTA, CONTATO, ...textos, "secreto"]) expect(linhas[0]).not.toContain(proibido);
  });

  it("a linha resgatada de sending, presa havia mais de 3 minutos, volta a pending com a tentativa de antes", async () => {
    await postDoLinkedinAdiado();
    const presa = await mensagem("a mensagem presa");
    await q(`update queue set status = 'sending', claimed_at = now() - interval '4 minutes', attempts = 2 where id = $1`, [presa]);
    linkedin.atrasoMs = 2_000;
    const resumo = await dreno.drainQueue({ inicioDaFuncaoMs: haTrintaENoveSegundos() });
    expect(await linha(presa)).toMatchObject({ status: "pending", attempts: 2, vencida: true });
    expect(resumo.devolvidos).toBe(1);
  });

  it("as mensagens devolvidas saem na passada seguinte, na ordem em que entraram na fila", async () => {
    await postDoLinkedinAdiado();
    await mensagem("um");
    await mensagem("dois");
    await mensagem("três");
    linkedin.atrasoMs = 2_000;
    await dreno.drainQueue({ inicioDaFuncaoMs: haTrintaENoveSegundos() });
    expect(meta.textos).toEqual([]);
    const resumo = await dreno.drainQueue();
    expect(resumo).toMatchObject({ sent: 3, devolvidos: 0 });
    expect(meta.textos).toEqual(["um", "dois", "três"]);
  }, 30_000);

  it("a devolução não ressuscita a linha que outro encerrou no meio do caminho: só volta o que ainda está em sending", async () => {
    await postDoLinkedinAdiado();
    const a = await mensagem("a primeira");
    const encerrada = await mensagem("a que outro encerrou");
    linkedin.atrasoMs = 2_000;
    // DURANTE O POST DO LINKEDIN, outro processo encerra uma das mensagens já reivindicadas.
    linkedin.durante = async () => {
      await q(`update queue set status = 'skipped', error = 'encerrada por outro' where id = $1`, [encerrada]);
    };
    const resumo = await dreno.drainQueue({ inicioDaFuncaoMs: haTrintaENoveSegundos() });
    expect(await linha(a)).toMatchObject({ status: "pending" });
    expect(await linha(encerrada)).toMatchObject({ status: "skipped", error: "encerrada por outro" });
    expect(resumo.devolvidos).toBe(1);
  });
});

describe("sem passar da hora de parar, o dreno é o de hoje", () => {
  it("as mensagens saem, nada volta, e não há linha de registro", async () => {
    await mensagem("um");
    await mensagem("dois");
    const { valor: resumo, linhas } = await comORegistro(() => dreno.drainQueue());
    expect(resumo).toMatchObject({ sent: 2, devolvidos: 0 });
    expect(meta.textos).toEqual(["um", "dois"]);
    expect(linhas).toEqual([]);
  }, 30_000);
});
```

Em `testes-integracao/linkedin-publicacao.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/linkedin-publicacao.integracao.ts b/testes-integracao/linkedin-publicacao.integracao.ts
index 49594e5..949dcd4 100644
--- a/testes-integracao/linkedin-publicacao.integracao.ts
+++ b/testes-integracao/linkedin-publicacao.integracao.ts
@@ -448,14 +448,16 @@ describe("o post do LinkedIn não começa o que a função não tem tempo de ter
   const linhaCompleta = async () =>
     (await q(`select status, attempts, error, payload, not_before > now() as adiado from queue where kind = 'publicacao_linkedin'`))[0];
 
-  it("só texto, com 5 s restando: não chama o LinkedIn, volta pending e não gasta a tentativa", async () => {
+  // COM 5 s RESTANDO, O DRENO DO LOTE NEM REIVINDICA (a hora de parar da 3a-0; lib/fila-tipos.ts): a linha fica como
+  // estava, e o LinkedIn não é chamado. A regra do próprio post do LinkedIn, que adia com o motivo, continua provada no
+  // dreno de uma linha só, no caso do "agora" com 5 s restando, logo abaixo.
+  it("só texto, com 5 s restando: o dreno nem pega a linha, não chama o LinkedIn, e a linha fica pending, com a tentativa de antes", async () => {
     await enfileirarTexto();
     const resumo = await dreno.drainQueue({ inicioDaFuncaoMs: restando(5_000) });
-    expect(resumo.aguardando).toBe(1);
+    expect(resumo).toMatchObject({ aguardando: 0, devolvidos: 0 });
     expect(linkedin.pedidos).toEqual([]);
     const linha = await linhaCompleta();
-    expect(linha).toMatchObject({ status: "pending", attempts: 0, adiado: true });
-    expect(String(linha.error)).toContain("não bastava");
+    expect(linha).toMatchObject({ status: "pending", attempts: 0, adiado: false, error: null });
     expect((linha.payload as Record<string, unknown>).post_tentado_em ?? null).toBeNull();
   });
 
@@ -519,7 +521,10 @@ describe("o post do LinkedIn não começa o que a função não tem tempo de ter
     const id = String((await linhaDoLinkedin()).id);
     expect(await dreno.drenarUmaPublicacaoDoLinkedin(id, restando(5_000))).toBe("aguardando");
     expect(linkedin.pedidos).toEqual([]);
-    expect(await linhaCompleta()).toMatchObject({ status: "pending", attempts: 0 });
+    const linha = await linhaCompleta();
+    expect(linha).toMatchObject({ status: "pending", attempts: 0, adiado: true });
+    expect(String(linha.error)).toContain("não bastava");
+    expect((linha.payload as Record<string, unknown>).post_tentado_em ?? null).toBeNull();
   });
 });
 
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/dreno-hora-de-parar"; cd "$C" || exit 1
DATABASE_URL_TESTES=postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes npx --no-install vitest run --config vitest.integracao.config.ts testes-integracao/dreno-hora-de-parar.integracao.ts testes-integracao/linkedin-publicacao.integracao.ts
```

Esperado: `ALVO: banco de TESTE`, "nenhum schema teste_tmp_* no banco" antes e depois, "Test Files 2 failed (2)" e "Tests 8 failed | 25 passed (33)". Caem os 7 casos do arquivo novo (o dreno de hoje reivindica depois da hora de parar, não devolve nada e não tem o `devolvidos` no resumo; por isso cai também "as mensagens saem, nada volta, e não há linha de registro") e o caso ajustado da 2a, "só texto, com 5 s restando: o dreno nem pega a linha…", porque o dreno de hoje ainda pega a linha.

- [ ] **Passo 3: o código**

Em `lib/queue-drain.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/queue-drain.ts b/lib/queue-drain.ts
index 10d4bfc..ce03c63 100644
--- a/lib/queue-drain.ts
+++ b/lib/queue-drain.ts
@@ -22,7 +22,13 @@ import { renderVariables, type VariableContext } from "./variables";
 // coluna é `variableContext`, aqui embaixo; quem entende o `jsonb` é ele.
 import { lerCampos } from "./campos";
 import { lerPayloadDoLote, loteExpirou } from "./lote";
-import { naOrdemDoLote, TIPOS_DE_PUBLICACAO, TIPOS_QUE_O_DRENO_CONHECE } from "./fila-tipos";
+import {
+  jaPassouDaHoraDeParar,
+  naOrdemDoLote,
+  textoDaDevolucao,
+  TIPOS_DE_PUBLICACAO,
+  TIPOS_QUE_O_DRENO_CONHECE,
+} from "./fila-tipos";
 // O POST DO LINKEDIN (a parte 2a). O arquivo dele não importa este: as três funções de que ele precisa vão como
 // parâmetro (`DEPENDENCIAS_DO_LINKEDIN`, lá embaixo).
 import { publicarNoLinkedinDaFila, type DependenciasDoDreno } from "./linkedin-fila";
@@ -910,6 +916,10 @@ export type ResumoDaDrenagem = {
   // Em português pela mesma razão que `guardados`: o estado que ele conta é o
   // da publicação esperando a Meta, e o produto chama isso de aguardar.
   aguardando: number;
+  // O SEXTO CONTADOR (a 3a-0; o 223): as linhas que voltaram à fila sem começar, porque a hora de parar chegou
+  // (`jaPassouDaHoraDeParar`, lib/fila-tipos.ts). Não é o `aguardando`, que é a publicação esperando a Meta: estas
+  // nem foram tentadas. Zero quando o dreno nem reivindicou, porque nada foi pego.
+  devolvidos: number;
 };
 
 /**
@@ -1002,6 +1012,35 @@ async function devolverOuEncerrar(item: QueueItem, err: unknown): Promise<"pendi
  */
 export const ORCAMENTO_DA_FUNCAO_MS = 55_000;
 
+/**
+ * DEVOLVE À FILA AS LINHAS DO LOTE QUE NÃO COMEÇARAM, porque a hora de parar chegou (a 3a-0; o 223;
+ * scratchpad/desenho-223.md, P1). Num `update` só:
+ *   - `pending`, com `not_before = now()`: elas saem na passada seguinte, que o rodapé arma em 20 s;
+ *   - sem gastar a tentativa (`greatest(attempts − 1, 0)`, como a devolução do post do LinkedIn): a reivindicação
+ *     contou uma, e nada foi tentado;
+ *   - com o `error` que estava. Um texto novo cairia no genérico da tela de Envios (app/labels.ts), falso para uma
+ *     linha que ninguém tentou, e só a nova tentativa grava `error` numa publicação pendente
+ *     (lib/bonus/publicar-estado.ts);
+ *   - só o que ainda está em `sending`: uma linha que outro processo encerrou no meio do caminho não volta.
+ * Uma linha vai ao registro, só com a contagem e os tipos (`textoDaDevolucao`). Sem a resposta do banco, as linhas
+ * ficam em `sending`, e o resgate de 3 minutos as devolve; o rodapé roda do mesmo jeito.
+ */
+async function devolverOQueNaoComecou(ids: readonly string[]): Promise<number> {
+  if (ids.length === 0) return 0;
+  try {
+    const linhas = (await sql().query(
+      `update queue set status = 'pending', attempts = greatest(attempts - 1, 0), not_before = now()
+        where id = any($1::uuid[]) and status = 'sending'
+        returning kind`,
+      [Array.from(ids)]
+    )) as { kind: string }[];
+    if (linhas.length > 0) console.log(textoDaDevolucao(linhas.map((l) => l.kind)));
+    return linhas.length;
+  } catch {
+    return 0;
+  }
+}
+
 /** O que o post do LinkedIn usa do dreno (lib/linkedin-fila.ts), com o prazo desta função. */
 function dependenciasDoLinkedin(inicioDaFuncaoMs: number): DependenciasDoDreno {
   return { finish, guardarNoPayload, limparOBucket, prazoMs: inicioDaFuncaoMs + ORCAMENTO_DA_FUNCAO_MS };
@@ -1068,8 +1107,13 @@ export async function armarOTiqueDaLinha(id: string): Promise<void> {
 }
 
 export async function drainQueue(opcoes: { inicioDaFuncaoMs?: number } = {}): Promise<ResumoDaDrenagem> {
-  const depsDoLinkedin = dependenciasDoLinkedin(opcoes.inicioDaFuncaoMs ?? Date.now());
-  const result = { sent: 0, skipped: 0, failed: 0, guardados: 0, aguardando: 0 };
+  const inicioDaFuncaoMs = opcoes.inicioDaFuncaoMs ?? Date.now();
+  const depsDoLinkedin = dependenciasDoLinkedin(inicioDaFuncaoMs);
+  const result = { sent: 0, skipped: 0, failed: 0, guardados: 0, aguardando: 0, devolvidos: 0 };
+  // A HORA DE PARAR (a 3a-0; o 223; scratchpad/desenho-223.md, P1): nada começa depois dela. O relógio é o desta
+  // função, o mesmo do prazo do LinkedIn, e não o do banco.
+  const passouDaHoraDeParar = () =>
+    jaPassouDaHoraDeParar({ inicioDaFuncaoMs, orcamentoMs: ORCAMENTO_DA_FUNCAO_MS, agoraMs: Date.now() });
   const accounts = await listAccounts();
   if (!accounts.length) return result;
   const byId = new Map(accounts.map((a) => [a.ig_user_id, a]));
@@ -1132,7 +1176,13 @@ export async function drainQueue(opcoes: { inicioDaFuncaoMs?: number } = {}): Pr
   //
   // O `skip locked` continua onde estava: o `explain` mostra o `LockRows`
   // debaixo do `Limit` dentro da CTE, e o `Sort` só por cima do `CTE Scan`.
-  const items = (await sql().query(
+  // A HORA DE PARAR, ANTES DE REIVINDICAR (a 3a-0): o dreno que começa depois dela não pega nada, e vai direto ao
+  // rodapé, que arma o tique. É o cron depois dos tiques do dia, o envio de um lote grande e o "agora" das duas redes
+  // depois do LinkedIn. A conferência vem ANTES do `update` da seleção: uma linha reivindicada e devolvida em seguida
+  // gastaria duas idas ao banco à toa.
+  const items = (passouDaHoraDeParar()
+    ? []
+    : await sql().query(
     `with lote as (
        update queue q
        set status = 'sending', claimed_at = now(), attempts = q.attempts + 1
@@ -1204,7 +1254,17 @@ export async function drainQueue(opcoes: { inicioDaFuncaoMs?: number } = {}): Pr
   // A ORDEM DO LOTE (a preparação da parte 3 do LinkedIn; `naOrdemDoLote`, lib/fila-tipos.ts): o post do LinkedIn
   // que já foi adiado por falta de tempo vai primeiro, para começar com o prazo da função quase inteiro. Só ele; o
   // resto segue na ordem da seleção.
+  //
+  // E A HORA DE PARAR, ANTES DE CADA ITEM (a 3a-0; o 223): passou dela, o item da vez e todos os que faltam voltam à
+  // fila sem começar (`devolverOQueNaoComecou`), e o laço termina. O que falta é este conjunto, e não um índice: o laço
+  // continua a percorrer `naOrdemDoLote(items)`, que a guarda da 3-0 cobra (tests/linkedin-forma-conhecida.test.ts).
+  const naoComecados = new Set(items.map((i) => i.id));
   for (const item of naOrdemDoLote(items)) {
+    if (passouDaHoraDeParar()) {
+      result.devolvidos += await devolverOQueNaoComecou([...naoComecados]);
+      break;
+    }
+    naoComecados.delete(item.id);
     const account = item.account_id ? byId.get(item.account_id) : undefined;
     if (!account) {
       // conta desconectada (ou item órfão antigo): não há token para enviar
```

- [ ] **Passo 4: rodar e ver passar**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/dreno-hora-de-parar"; cd "$C" || exit 1
DATABASE_URL_TESTES=postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes npx --no-install vitest run --config vitest.integracao.config.ts testes-integracao/dreno-hora-de-parar.integracao.ts testes-integracao/linkedin-publicacao.integracao.ts
npx --no-install vitest run
npx --no-install tsc --noEmit
npx --no-install eslint lib/queue-drain.ts testes-integracao/dreno-hora-de-parar.integracao.ts testes-integracao/linkedin-publicacao.integracao.ts
```

Esperado: a integração: `ALVO: banco de TESTE`, "nenhum schema teste_tmp_* no banco" antes e depois, "Test Files 2 passed (2)" e "Tests 33 passed (33)"; a suíte pura inteira: "Test Files 159 passed (159)" e "Tests 3774 passed (3774)". O `tsc` e o lint sem saída.

- [ ] **Passo 5: o commit**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/dreno-hora-de-parar"; cd "$C" || exit 1
node ../varrer-texto.mjs lib/queue-drain.ts testes-integracao/dreno-hora-de-parar.integracao.ts testes-integracao/linkedin-publicacao.integracao.ts && test "$(git branch --show-current)" = dreno-hora-de-parar && git add lib/queue-drain.ts testes-integracao/dreno-hora-de-parar.integracao.ts testes-integracao/linkedin-publicacao.integracao.ts && git commit -m "O dreno não começa nada depois da hora de parar: não reivindica o lote tarde, devolve à fila o que não começou sem gastar a tentativa, e conta e registra o que devolveu"
git show HEAD | git patch-id --stable | cut -c1-12   # 8bf0461c9a62
```

---

### FASE 3 — O post do Instagram confere a hora de parar antes de cada ida à Meta

**Arquivos:** `lib/queue-drain.ts`, `testes-integracao/dreno-hora-de-parar.integracao.ts`.

- [ ] **Passo 1: os testes**

Em `testes-integracao/dreno-hora-de-parar.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/dreno-hora-de-parar.integracao.ts b/testes-integracao/dreno-hora-de-parar.integracao.ts
index 22d38e2..f83f3ce 100644
--- a/testes-integracao/dreno-hora-de-parar.integracao.ts
+++ b/testes-integracao/dreno-hora-de-parar.integracao.ts
@@ -34,7 +34,19 @@ const TOKEN_DO_QSTASH = "token-de-qstash-inventado-para-a-hora-de-parar";
 const APP_URL = "https://exemplo.invalid";
 
 const qstash = { publicados: [] as string[] };
-const meta = { textos: [] as string[], desconhecidos: [] as string[] };
+const meta = {
+  textos: [] as string[],
+  desconhecidos: [] as string[],
+  // O POST DO INSTAGRAM (a P2): os contêineres criados, as leituras de estado, as cotas e as publicações, e quanto cada
+  // ida demora, para a hora de parar chegar no ponto que o caso escolhe. O atraso do contêiner é pelo número dele.
+  containers: 0,
+  estados: 0,
+  cotas: 0,
+  publicacoes: 0,
+  atrasoDoContainer: (_n: number) => 0,
+  atrasoDoEstadoMs: 0,
+  atrasoDaCotaMs: 0,
+};
 const linkedin = { pedidos: [] as string[], atrasoMs: 0, durante: null as null | (() => Promise<void>) };
 
 let servidorQstash: Server;
@@ -73,6 +85,30 @@ beforeAll(async () => {
       meta.textos.push(lido.message?.text ?? "");
       return responder(res, 200, { message_id: `mid-${meta.textos.length}`, recipient_id: CONTATO });
     }
+    const ultimo = u.pathname.split("/").filter(Boolean).pop() ?? "";
+    if (req.method === "POST" && ultimo === "media") {
+      meta.containers++;
+      const n = meta.containers;
+      const atraso = meta.atrasoDoContainer(n);
+      if (atraso) await esperar(atraso);
+      return responder(res, 200, { id: `container-${n}` });
+    }
+    if (req.method === "GET" && (u.searchParams.get("fields") ?? "").includes("status_code")) {
+      meta.estados++;
+      if (meta.atrasoDoEstadoMs) await esperar(meta.atrasoDoEstadoMs);
+      return responder(res, 200, { id: ultimo, status_code: "FINISHED" });
+    }
+    if (req.method === "GET" && ultimo === "content_publishing_limit") {
+      meta.cotas++;
+      if (meta.atrasoDaCotaMs) await esperar(meta.atrasoDaCotaMs);
+      return responder(res, 200, { config: { quota_total: 100, quota_duration: 86400 }, quota_usage: 0 });
+    }
+    if (req.method === "POST" && ultimo === "media_publish") {
+      meta.publicacoes++;
+      return responder(res, 200, { id: `media-${meta.publicacoes}` });
+    }
+    // O BUCKET FALSO, só para o apagar depois do post: o `limparOBucket` registra e segue se falhar.
+    if (req.method === "DELETE") return responder(res, 200, { message: "ok" });
     meta.desconhecidos.push(`${req.method} ${u.pathname}`);
     responder(res, 404, { error: { message: `o falso não conhece ${u.pathname}` } });
   });
@@ -95,6 +131,10 @@ beforeAll(async () => {
   process.env.QSTASH_TOKEN = TOKEN_DO_QSTASH;
   process.env.IG_GRAPH_BASE = base(servidorMeta);
   process.env.LINKEDIN_API_BASE = base(servidorLinkedin);
+  // O ENDEREÇO PÚBLICO DA FOTO é montado a partir do bucket, e o apagar fala com ele: os dois vão à Meta falsa.
+  process.env.SUPABASE_URL = base(servidorMeta);
+  process.env.SUPABASE_BUCKET = "midia-da-hora-de-parar";
+  process.env.SUPABASE_SERVICE_ROLE_KEY = "chave-do-bucket-da-hora-de-parar-que-nao-vale-nada";
 
   // AS GUARDAS, ANTES DE QUALQUER DRENO: sem os desvios, este teste falaria com as redes de verdade.
   const ig = await import("@/lib/ig");
@@ -117,7 +157,17 @@ beforeAll(async () => {
 });
 
 afterAll(async () => {
-  for (const v of ["QSTASH_URL", "QSTASH_TOKEN", "IG_GRAPH_BASE", "LINKEDIN_API_BASE"]) delete process.env[v];
+  for (const v of [
+    "QSTASH_URL",
+    "QSTASH_TOKEN",
+    "IG_GRAPH_BASE",
+    "LINKEDIN_API_BASE",
+    "SUPABASE_URL",
+    "SUPABASE_BUCKET",
+    "SUPABASE_SERVICE_ROLE_KEY",
+  ]) {
+    delete process.env[v];
+  }
   for (const s of [servidorQstash, servidorMeta, servidorLinkedin]) await new Promise<void>((pronto) => s.close(() => pronto()));
 });
 
@@ -135,6 +185,13 @@ beforeEach(async () => {
   qstash.publicados = [];
   meta.textos = [];
   meta.desconhecidos = [];
+  meta.containers = 0;
+  meta.estados = 0;
+  meta.cotas = 0;
+  meta.publicacoes = 0;
+  meta.atrasoDoContainer = () => 0;
+  meta.atrasoDoEstadoMs = 0;
+  meta.atrasoDaCotaMs = 0;
   linkedin.pedidos = [];
   linkedin.atrasoMs = 0;
   linkedin.durante = null;
@@ -281,3 +338,99 @@ describe("sem passar da hora de parar, o dreno é o de hoje", () => {
     expect(linhas).toEqual([]);
   }, 30_000);
 });
+
+// O POST DO INSTAGRAM CONFERE A HORA DE PARAR POR DENTRO (a 3a-0; o 223; scratchpad/desenho-223.md, P2). Antes de cada
+// ida à Meta (cada filho do carrossel, o pai, o contêiner da imagem, a leitura de estado, a cota e a publicação), passou
+// da hora: a linha volta à fila sem gastar a tentativa, com o que já foi gravado no payload (os filhos, o contêiner), e
+// a passada seguinte continua dali, sem recriar nada. Cada caso para num ponto: a Meta falsa demora na ida anterior.
+
+/** Um post do Instagram vencido, na conta, com as fotos dadas. */
+async function postDoInstagram(forma: "imagem" | "carrossel", fotos: number): Promise<string> {
+  const caminhos = Array.from({ length: fotos }, (_, i) => `${CONTA}/foto-${i + 1}.jpg`);
+  const [l] = (await q(
+    `insert into queue (account_id, kind, payload, dedupe_key, not_before)
+     values ($1, 'publicacao', $2, $3, now() - interval '1 minute')
+     returning id`,
+    [CONTA, { forma, caminhos, legenda: "A legenda do post" }, `hora-de-parar:instagram:${forma}:${fotos}`]
+  )) as { id: string }[];
+  return l.id;
+}
+
+const payloadDe = async (id: string) =>
+  ((await q(`select payload from queue where id = $1`, [id])) as { payload: Record<string, unknown> }[])[0].payload;
+
+describe("o post do Instagram confere a hora de parar por dentro (a P2)", () => {
+  it("antes de um filho do carrossel: o filho já criado fica no payload, e a passada seguinte cria só os que faltam", async () => {
+    const id = await postDoInstagram("carrossel", 3);
+    meta.atrasoDoContainer = (n) => (n === 1 ? 2_000 : 0);
+    const resumo = await dreno.drainQueue({ inicioDaFuncaoMs: haTrintaENoveSegundos() });
+    expect(resumo).toMatchObject({ devolvidos: 1, sent: 0 });
+    expect(await linha(id)).toMatchObject({ status: "pending", attempts: 0, vencida: true });
+    expect(await payloadDe(id)).toMatchObject({ filhos: ["container-1"] });
+    expect((await payloadDe(id)).container_id).toBeUndefined();
+    expect(meta.containers).toBe(1);
+
+    meta.atrasoDoContainer = () => 0;
+    expect(await dreno.drainQueue()).toMatchObject({ sent: 1, devolvidos: 0 });
+    // OS DOIS FILHOS QUE FALTAVAM E O PAI: 1 + 2 + 1, e o primeiro filho é o mesmo.
+    expect(meta.containers).toBe(4);
+    expect(await payloadDe(id)).toMatchObject({ filhos: ["container-1", "container-2", "container-3"], container_id: "container-4" });
+    expect(meta.publicacoes).toBe(1);
+  });
+
+  it("antes do pai do carrossel: os filhos ficam, e a passada seguinte cria só o pai", async () => {
+    const id = await postDoInstagram("carrossel", 2);
+    meta.atrasoDoContainer = (n) => (n === 2 ? 2_000 : 0);
+    expect(await dreno.drainQueue({ inicioDaFuncaoMs: haTrintaENoveSegundos() })).toMatchObject({ devolvidos: 1 });
+    expect(await payloadDe(id)).toMatchObject({ filhos: ["container-1", "container-2"] });
+    expect((await payloadDe(id)).container_id).toBeUndefined();
+    expect(meta.containers).toBe(2);
+
+    meta.atrasoDoContainer = () => 0;
+    expect(await dreno.drainQueue()).toMatchObject({ sent: 1 });
+    expect(meta.containers).toBe(3);
+    expect(await payloadDe(id)).toMatchObject({ container_id: "container-3" });
+  });
+
+  it("antes da leitura de estado: o contêiner da imagem fica, e a passada seguinte só lê o estado e publica", async () => {
+    const id = await postDoInstagram("imagem", 1);
+    meta.atrasoDoContainer = () => 2_000;
+    expect(await dreno.drainQueue({ inicioDaFuncaoMs: haTrintaENoveSegundos() })).toMatchObject({ devolvidos: 1 });
+    expect(await payloadDe(id)).toMatchObject({ container_id: "container-1" });
+    expect(meta.estados).toBe(0);
+
+    meta.atrasoDoContainer = () => 0;
+    expect(await dreno.drainQueue()).toMatchObject({ sent: 1 });
+    expect(meta.containers).toBe(1);
+    expect(meta.publicacoes).toBe(1);
+  });
+
+  it("antes da cota: o estado já lido não conta consulta a mais, e a passada seguinte publica com o mesmo contêiner", async () => {
+    const id = await postDoInstagram("imagem", 1);
+    meta.atrasoDoEstadoMs = 2_000;
+    expect(await dreno.drainQueue({ inicioDaFuncaoMs: haTrintaENoveSegundos() })).toMatchObject({ devolvidos: 1 });
+    expect(meta.estados).toBe(1);
+    expect(meta.cotas).toBe(0);
+    expect(await linha(id)).toMatchObject({ status: "pending", attempts: 0 });
+
+    meta.atrasoDoEstadoMs = 0;
+    expect(await dreno.drainQueue()).toMatchObject({ sent: 1 });
+    expect(meta.containers).toBe(1);
+    expect(meta.publicacoes).toBe(1);
+  });
+
+  it("antes da publicação: nada foi publicado, e a passada seguinte publica uma vez só, com o mesmo contêiner", async () => {
+    const id = await postDoInstagram("imagem", 1);
+    meta.atrasoDaCotaMs = 2_000;
+    expect(await dreno.drainQueue({ inicioDaFuncaoMs: haTrintaENoveSegundos() })).toMatchObject({ devolvidos: 1, sent: 0 });
+    expect(meta.cotas).toBe(1);
+    expect(meta.publicacoes).toBe(0);
+    expect(await linha(id)).toMatchObject({ status: "pending", attempts: 0 });
+
+    meta.atrasoDaCotaMs = 0;
+    expect(await dreno.drainQueue()).toMatchObject({ sent: 1 });
+    expect(meta.containers).toBe(1);
+    expect(meta.publicacoes).toBe(1);
+    expect((await linha(id)).status).toBe("sent");
+  });
+});
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/dreno-hora-de-parar"; cd "$C" || exit 1
DATABASE_URL_TESTES=postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes npx --no-install vitest run --config vitest.integracao.config.ts testes-integracao/dreno-hora-de-parar.integracao.ts
```

Esperado: `ALVO: banco de TESTE`, "nenhum schema teste_tmp_* no banco" antes e depois, "Test Files 1 failed (1)" e "Tests 5 failed | 7 passed (12)". Caem os 5 casos novos da P2: antes de um filho do carrossel, antes do pai, antes da leitura de estado, antes da cota e antes da publicação. Os 7 da FASE 2 passam.

- [ ] **Passo 3: o código**

Em `lib/queue-drain.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/queue-drain.ts b/lib/queue-drain.ts
index ce03c63..82a1e77 100644
--- a/lib/queue-drain.ts
+++ b/lib/queue-drain.ts
@@ -419,10 +419,14 @@ export async function limparOBucket(
 async function containerPaiDoCarrossel(
   item: QueueItem,
   account: Account,
-  pub: { caminhos: string[]; legenda?: string; filhos: string[] }
-): Promise<string> {
+  pub: { caminhos: string[]; legenda?: string; filhos: string[] },
+  passouDaHoraDeParar: () => boolean
+): Promise<string | null> {
   const filhos = [...pub.filhos];
   for (let i = filhos.length; i < pub.caminhos.length; i++) {
+    // A HORA DE PARAR ANTES DE CADA FILHO (a 3a-0; o 223, P2): `null`, e quem chama devolve a linha. A lista já
+    // gravada fica, e a passada seguinte continua daqui, sem recriar o que existe.
+    if (passouDaHoraDeParar()) return null;
     const filho = await criarContainer(
       account.ig_user_id,
       account.access_token,
@@ -439,6 +443,7 @@ async function containerPaiDoCarrossel(
   // O PAI POR ÚLTIMO, com a lista inteira e a legenda. `parametrosDoContainerPai`
   // é quem recusa zero, um e mais de dez — e ele nunca chega aqui com essas
   // contagens, porque a quantidade já foi conferida duas vezes antes.
+  if (passouDaHoraDeParar()) return null;
   return criarContainer(
     account.ig_user_id,
     account.access_token,
@@ -446,8 +451,12 @@ async function containerPaiDoCarrossel(
   );
 }
 
-/** O que aconteceu com um item de publicação nesta passada. */
-type DesfechoDaPublicacao = "publicado" | "aguardando" | "falhou";
+/**
+ * O que aconteceu com um item de publicação nesta passada. O `devolvido` (a 3a-0; o 223, P2) é o post que parou no
+ * meio porque a hora de parar chegou: ele voltou à fila sem gastar a tentativa, com o que já tinha feito no payload, e
+ * o laço o conta em `devolvidos`, e não em `aguardando`, que é a publicação esperando a Meta.
+ */
+type DesfechoDaPublicacao = "publicado" | "aguardando" | "falhou" | "devolvido";
 
 /**
  * PUBLICA UM ITEM DA FILA. É o ramo que não é mensagem.
@@ -475,7 +484,22 @@ type DesfechoDaPublicacao = "publicado" | "aguardando" | "falhou";
  * ficar decidido aqui fica sem rede, e o cabeçalho conta as duas vezes em que
  * isso já custou caro.
  */
-async function publicarDaFila(item: QueueItem, account: Account): Promise<DesfechoDaPublicacao> {
+async function publicarDaFila(
+  item: QueueItem,
+  account: Account,
+  passouDaHoraDeParar: () => boolean
+): Promise<DesfechoDaPublicacao> {
+  // A HORA DE PARAR POR DENTRO (a 3a-0; o 223; scratchpad/desenho-223.md, P2). Um carrossel faz até 11 POSTs sem teto
+  // (o teto do `graphFetch` é só do GET, de propósito: lib/ig.ts) e 2 GETs de até 8 s, e começado aos 39 s ele ainda
+  // podia passar do corte da função, que pula o rodapé. Antes de cada ida à Meta, passou da hora: a linha volta à fila
+  // pelo mesmo caminho do laço (`devolverOQueNaoComecou`), sem gastar a tentativa, e o que já foi gravado no payload
+  // (os filhos, o contêiner) fica para a passada seguinte. O corte de um post não publica em dobro (a lista de filhos
+  // gravada a cada filho e o "publicado não republica", abaixo); o que esta conferência evita é a linha presa em
+  // `sending` por 3 minutos, sem tique. O relógio é o do laço, que o dreno passa.
+  const devolver = async (): Promise<DesfechoDaPublicacao> => {
+    await devolverOQueNaoComecou([item.id]);
+    return "devolvido";
+  };
   const pub = lerPayloadDaPublicacao(item.payload);
   if (!pub) {
     // MESMO DESFECHO DO LOTE COM PAYLOAD INVÁLIDO, e pela mesma razão: um item
@@ -514,9 +538,10 @@ async function publicarDaFila(item: QueueItem, account: Account): Promise<Desfec
 
   let containerId = pub.containerId;
   if (!containerId) {
-    containerId =
+    if (pub.forma !== "carrossel" && passouDaHoraDeParar()) return devolver();
+    const criado =
       pub.forma === "carrossel"
-        ? await containerPaiDoCarrossel(item, account, pub)
+        ? await containerPaiDoCarrossel(item, account, pub, passouDaHoraDeParar)
         : await criarContainer(
             account.ig_user_id,
             account.access_token,
@@ -533,12 +558,18 @@ async function publicarDaFila(item: QueueItem, account: Account): Promise<Desfec
               nomeDoAudio: pub.nomeDoAudio,
             })
           );
+    // A HORA DE PARAR CHEGOU ENTRE OS FILHOS, OU ANTES DO PAI: a lista dos filhos já está gravada.
+    if (criado === null) return devolver();
+    containerId = criado;
     // GRAVADO ANTES DE QUALQUER OUTRA COISA. Se a consulta de estado logo
     // abaixo estourar, o `catch` de `drainQueue` devolve o item à fila — e a
     // passada seguinte tem de encontrar ESTE contêiner, e não criar o segundo.
     await guardarNoPayload(item.id, { container_id: containerId });
   }
 
+  // A HORA DE PARAR ANTES DA LEITURA DE ESTADO: o contêiner já está gravado.
+  if (passouDaHoraDeParar()) return devolver();
+
   const leitura = leituraDoContainer(
     await estadoDoContainerNaMeta(containerId, account.access_token)
   );
@@ -592,6 +623,9 @@ async function publicarDaFila(item: QueueItem, account: Account): Promise<Desfec
   // /{ig-media-id}` não existe no Login do Instagram (medido em 03/09), e a
   // remoção é manual, no aplicativo.
   if (leitura.estado === "pronto") {
+    // A HORA DE PARAR ANTES DA COTA E ANTES DA PUBLICAÇÃO: nada foi publicado, e a passada seguinte lê o estado de
+    // novo (um GET) e publica com o mesmo contêiner.
+    if (passouDaHoraDeParar()) return devolver();
     const cota = cotaDePublicacao(await limiteDePublicacao(account.ig_user_id, account.access_token));
     if (cotaEstourada(cota)) {
       // `pending`, E NÃO `failed`. A publicação não deu errado — ela ainda não
@@ -605,6 +639,7 @@ async function publicarDaFila(item: QueueItem, account: Account): Promise<Desfec
       });
       return "aguardando";
     }
+    if (passouDaHoraDeParar()) return devolver();
     const resposta = await publicarContainer(
       account.ig_user_id,
       account.access_token,
@@ -1340,9 +1375,10 @@ export async function drainQueue(opcoes: { inicioDaFuncaoMs?: number } = {}): Pr
       // de retentativa escrita só para este ramo seria uma segunda coisa para
       // manter, e o `catch` de baixo já está certo.
       if (item.kind === "publicacao") {
-        const desfecho = await publicarDaFila(item, account);
+        const desfecho = await publicarDaFila(item, account, passouDaHoraDeParar);
         if (desfecho === "publicado") result.sent++;
         else if (desfecho === "aguardando") result.aguardando++;
+        else if (desfecho === "devolvido") result.devolvidos++;
         else result.failed++;
         continue;
       }
```

- [ ] **Passo 4: rodar e ver passar**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/dreno-hora-de-parar"; cd "$C" || exit 1
DATABASE_URL_TESTES=postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes npx --no-install vitest run --config vitest.integracao.config.ts testes-integracao/dreno-hora-de-parar.integracao.ts
npx --no-install vitest run
npx --no-install tsc --noEmit
npx --no-install eslint lib/queue-drain.ts testes-integracao/dreno-hora-de-parar.integracao.ts
```

Esperado: a integração: `ALVO: banco de TESTE`, "nenhum schema teste_tmp_* no banco" antes e depois, "Test Files 1 passed (1)" e "Tests 12 passed (12)"; a suíte pura inteira: "Test Files 159 passed (159)" e "Tests 3774 passed (3774)". O `tsc` e o lint sem saída.

- [ ] **Passo 5: o commit**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/dreno-hora-de-parar"; cd "$C" || exit 1
node ../varrer-texto.mjs lib/queue-drain.ts testes-integracao/dreno-hora-de-parar.integracao.ts && test "$(git branch --show-current)" = dreno-hora-de-parar && git add lib/queue-drain.ts testes-integracao/dreno-hora-de-parar.integracao.ts && git commit -m "O post do Instagram confere a hora de parar antes de cada ida à Meta e, passada a hora, volta à fila com o que já fez, sem gastar a tentativa"
git show HEAD | git patch-id --stable | cut -c1-12   # 6f3712622625
```

---

### FASE 4 — Os drenos dos cliques passam o começo e não pegam o post do LinkedIn

**Arquivos:** `app/publicar/actions.ts`, `app/contatos/actions.ts`, `app/conversas/[id]/actions.ts`, `app/publicar/post/actions.ts`, `app/bonus/publicar-actions.ts`, `lib/bonus/publicar-processo.ts`, `lib/queue-drain.ts`, `tests/dreno-com-prazo.test.ts`, `testes-integracao/dreno-hora-de-parar.integracao.ts`.

- [ ] **Passo 1: os testes**

Em `tests/dreno-com-prazo.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/dreno-com-prazo.test.ts b/tests/dreno-com-prazo.test.ts
index dc61549..87dcbe8 100644
--- a/tests/dreno-com-prazo.test.ts
+++ b/tests/dreno-com-prazo.test.ts
@@ -1,5 +1,5 @@
-import { readFileSync } from "node:fs";
-import { join } from "node:path";
+import { readdirSync, readFileSync, statSync } from "node:fs";
+import { join, relative } from "node:path";
 import { describe, expect, it } from "vitest";
 
 // AS ROTAS QUE DRENAM A FILA PASSAM O COMEÇO DA FUNÇÃO (nota da auditoria sobre a F2 da parte 2a do LinkedIn).
@@ -40,7 +40,9 @@ describe("a action das duas redes passa o começo da função ao LinkedIn e ao d
     const corpo = fonte.slice(inicio, fim === -1 ? undefined : fim);
     expect(corpo).toMatch(/\{\n {2}await exigirSessao\(\);\n {2}const inicioDaFuncaoMs = Date\.now\(\);\n/);
     expect(corpo).toMatch(/drenarUmaPublicacaoDoLinkedin\(\s*[\w.]+,\s*inicioDaFuncaoMs\s*\)/);
-    expect(corpo).toMatch(/drainQueue\(\{\s*inicioDaFuncaoMs\s*\}\)/);
+    // O DRENO DO INSTAGRAM, NO CLIQUE, NÃO PEGA O POST DO LINKEDIN (a 3a-0, o 224): o da própria linha já saiu pelo
+    // `drenarUmaPublicacaoDoLinkedin`, logo acima.
+    expect(corpo).toMatch(/drainQueue\(\{\s*inicioDaFuncaoMs,\s*doClique:\s*true\s*\}\)/);
     expect(corpo).not.toMatch(/drainQueue\(\)/);
     expect(corpo.indexOf("drenarUmaPublicacaoDoLinkedin(")).toBeLessThan(corpo.indexOf("drainQueue("));
   });
@@ -64,3 +66,93 @@ describe("as rotas que drenam passam o começo da função ao dreno", () => {
     });
   }
 });
+
+// A 3a-0 (os achados 223 e 224; scratchpad/desenho-223.md, P3 e P4). TODO chamador do dreno passa o começo da função,
+// porque a hora de parar é contada dele; e os seis drenos que rodam dentro de um clique de quem usa o painel pedem a
+// seleção sem o post do LinkedIn (`doClique: true`), que pode levar uma passada inteira. A lista dos arquivos que
+// importam o `drainQueue` é fechada: um chamador novo entra aqui, com a escolha dele.
+const ler = (arquivo: string) => readFileSync(join(RAIZ, arquivo), "utf8").replace(/\r\n/g, "\n");
+
+function arquivosDe(pasta: string): string[] {
+  const saida: string[] = [];
+  for (const nome of readdirSync(join(RAIZ, pasta))) {
+    const caminho = join(RAIZ, pasta, nome);
+    if (statSync(caminho).isDirectory()) saida.push(...arquivosDe(relative(RAIZ, caminho)));
+    else if (/\.(ts|tsx)$/.test(nome)) saida.push(relative(RAIZ, caminho).replace(/\\/g, "/"));
+  }
+  return saida;
+}
+
+/** O corpo de uma função exportada: do `export async function nome(` até o próximo `export` do arquivo. */
+function corpoDa(arquivo: string, funcao: string): string {
+  const fonte = ler(arquivo);
+  const inicio = fonte.indexOf(`export async function ${funcao}(`);
+  expect(inicio).toBeGreaterThan(-1);
+  const fim = fonte.indexOf("\nexport ", inicio + 1);
+  return fonte.slice(inicio, fim === -1 ? undefined : fim);
+}
+
+const QUEM_IMPORTA_O_DRENO = [
+  ...ROTAS,
+  "app/contatos/actions.ts",
+  "app/conversas/[id]/actions.ts",
+  "app/publicar/actions.ts",
+  "app/publicar/post/actions.ts",
+  "lib/bonus/publicar-processo.ts",
+].sort();
+
+const DRENOS_DE_CLIQUE = [
+  { arquivo: "app/publicar/actions.ts", funcao: "publicar" },
+  { arquivo: "app/publicar/actions.ts", funcao: "publicarNasDuasRedes" },
+  { arquivo: "app/contatos/actions.ts", funcao: "enviarLote" },
+  { arquivo: "app/conversas/[id]/actions.ts", funcao: "sendReply" },
+  { arquivo: "app/publicar/post/actions.ts", funcao: "remarcarPublicacao" },
+  // O SEXTO É O "PUBLICAR" DO BÔNUS, que chega ao dreno pelo `publicarNaFila`: o caso dele vem abaixo.
+];
+
+const COMECO_DEPOIS_DA_SESSAO = /\{\n {2}await exigirSessao\(\);\n {2}const inicioDaFuncaoMs = Date\.now\(\);\n/;
+
+describe("os arquivos que importam o dreno (a 3a-0)", () => {
+  it("são os 8 de sempre: as 3 rotas, as 4 actions de clique e o processo do bônus", () => {
+    const achados = [...arquivosDe("app"), ...arquivosDe("lib")]
+      .filter((f) => /import\s*\{[^}]*\bdrainQueue\b[^}]*\}\s*from\s*"@\/lib\/queue-drain"/.test(ler(f)))
+      .sort();
+    expect(achados).toEqual(QUEM_IMPORTA_O_DRENO);
+  });
+
+  it("nenhum chama o dreno sem o começo da função", () => {
+    for (const arquivo of QUEM_IMPORTA_O_DRENO) {
+      expect(ler(arquivo)).not.toMatch(/drainQueue\(\s*\)/);
+      for (const chamada of ler(arquivo).match(/drainQueue\([^)]*\)/g) ?? []) expect(chamada).toMatch(/inicioDaFuncaoMs/);
+    }
+  });
+});
+
+describe("os drenos de clique passam o começo e pedem a seleção sem o post do LinkedIn (a 3a-0, o 224)", () => {
+  for (const { arquivo, funcao } of DRENOS_DE_CLIQUE) {
+    it(`${arquivo}, ${funcao}`, () => {
+      const corpo = corpoDa(arquivo, funcao);
+      expect(corpo).toMatch(COMECO_DEPOIS_DA_SESSAO);
+      const chamadas = corpo.match(/drainQueue\([^)]*\)/g) ?? [];
+      expect(chamadas.length).toBeGreaterThan(0);
+      for (const c of chamadas) expect(c).toMatch(/^drainQueue\(\{\s*inicioDaFuncaoMs,\s*doClique:\s*true\s*\}\)$/);
+      // O DRENO DE UMA LINHA SÓ, quando a action o chama, também recebe o começo.
+      for (const c of corpo.match(/drenarUmaPublicacaoDoLinkedin\([^)]*\)/g) ?? []) {
+        expect(c).toMatch(/drenarUmaPublicacaoDoLinkedin\(\s*[\w.]+,\s*inicio\w*\s*\)/);
+      }
+    });
+  }
+
+  it("o bônus: a action passa o começo ao publicarNaFila, e ele o passa ao drenar, com a seleção do clique", () => {
+    const acao = corpoDa("app/bonus/publicar-actions.ts", "publicarCarrossel");
+    expect(acao).toMatch(COMECO_DEPOIS_DA_SESSAO);
+    expect(acao).toMatch(/publicarNaFila\(\{[^}]*\binicioDaFuncaoMs\b[^}]*\}\)/);
+    const chamadas = ler("lib/bonus/publicar-processo.ts").match(/\bdrenar\([^)]*\)/g) ?? [];
+    expect(chamadas).toHaveLength(1);
+    expect(chamadas[0]).toMatch(/^drenar\(\{\s*inicioDaFuncaoMs,\s*doClique:\s*true\s*\}\)$/);
+  });
+
+  it("as rotas não pedem a seleção do clique: o tique, o webhook e o cron drenam o post do LinkedIn", () => {
+    for (const rota of ROTAS) expect(ler(rota)).not.toMatch(/doClique/);
+  });
+});
```

Em `testes-integracao/dreno-hora-de-parar.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/dreno-hora-de-parar.integracao.ts b/testes-integracao/dreno-hora-de-parar.integracao.ts
index f83f3ce..b718c9f 100644
--- a/testes-integracao/dreno-hora-de-parar.integracao.ts
+++ b/testes-integracao/dreno-hora-de-parar.integracao.ts
@@ -434,3 +434,29 @@ describe("o post do Instagram confere a hora de parar por dentro (a P2)", () =>
     expect((await linha(id)).status).toBe("sent");
   });
 });
+
+// O DRENO DE CLIQUE NÃO PEGA O POST DO LINKEDIN (a 3a-0; o 224; scratchpad/desenho-223.md, P3). A seleção do dreno não
+// filtra pela conta do clique, e a passada de um post do LinkedIn pode levar a função inteira: quem só respondeu uma
+// mensagem esperaria o post de outro. No clique, a seleção sai sem o `publicacao_linkedin`; o rodapé continua contando
+// o post do LinkedIn, e arma o tique para ele, que sai no dreno do tique.
+describe("o dreno de clique não pega o post do LinkedIn (a P3, o 224)", () => {
+  it("a linha do LinkedIn vencida fica como estava, a mensagem do clique sai, e o rodapé arma o tique para o LinkedIn", async () => {
+    const li = await postDoLinkedinAdiado();
+    await mensagem("a mensagem do clique");
+    const resumo = await dreno.drainQueue({ inicioDaFuncaoMs: Date.now(), doClique: true });
+    expect(resumo).toMatchObject({ sent: 1, devolvidos: 0 });
+    expect(meta.textos).toEqual(["a mensagem do clique"]);
+    expect(linkedin.pedidos).toEqual([]);
+    expect(await linha(li)).toMatchObject({ status: "pending", attempts: 0, claimed_at: null });
+    expect(qstash.publicados).toHaveLength(1);
+  });
+
+  it("o mesmo lote, no dreno de uma rota (o tique, o webhook ou o cron): o post do LinkedIn sai", async () => {
+    const li = await postDoLinkedinAdiado();
+    await mensagem("a mensagem da rota");
+    const resumo = await dreno.drainQueue({ inicioDaFuncaoMs: Date.now() });
+    expect(resumo).toMatchObject({ sent: 2 });
+    expect(linkedin.pedidos).toEqual(["POST /rest/posts"]);
+    expect((await linha(li)).status).toBe("sent");
+  });
+});
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/dreno-hora-de-parar"; cd "$C" || exit 1
npx --no-install vitest run tests/dreno-com-prazo.test.ts
DATABASE_URL_TESTES=postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes npx --no-install vitest run --config vitest.integracao.config.ts testes-integracao/dreno-hora-de-parar.integracao.ts
```

Esperado: nos puros, "Test Files 1 failed (1)" e "Tests 8 failed | 6 passed (14)": as 6 chamadas de clique ainda sem a forma do clique (o publicar, o das duas redes, o `enviarLote`, o `sendReply`, o remarcar e o bônus), o caso antigo das duas redes, que passa a pedir o `doClique`, e "nenhum chama o dreno sem o começo da função". Na integração, `ALVO: banco de TESTE`, "nenhum schema teste_tmp_* no banco" antes e depois, "Test Files 1 failed (1)" e "Tests 1 failed | 13 passed (14)": cai "a linha do LinkedIn vencida fica como estava, a mensagem do clique sai, e o rodapé…", porque a seleção ainda não tem a opção do clique.

- [ ] **Passo 3: o código**

Em `lib/queue-drain.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/queue-drain.ts b/lib/queue-drain.ts
index 82a1e77..5780aa9 100644
--- a/lib/queue-drain.ts
+++ b/lib/queue-drain.ts
@@ -27,6 +27,7 @@ import {
   naOrdemDoLote,
   textoDaDevolucao,
   TIPOS_DE_PUBLICACAO,
+  TIPOS_DO_DRENO_DE_CLIQUE,
   TIPOS_QUE_O_DRENO_CONHECE,
 } from "./fila-tipos";
 // O POST DO LINKEDIN (a parte 2a). O arquivo dele não importa este: as três funções de que ele precisa vão como
@@ -1141,7 +1142,15 @@ export async function armarOTiqueDaLinha(id: string): Promise<void> {
   }
 }
 
-export async function drainQueue(opcoes: { inicioDaFuncaoMs?: number } = {}): Promise<ResumoDaDrenagem> {
+/**
+ * O DRENO DA FILA. `inicioDaFuncaoMs` é o começo da função que o chama: a hora de parar e o prazo do post do LinkedIn
+ * são contados dele. `doClique` (a 3a-0; o 224) é o dreno que roda dentro de um clique de quem usa o painel: a
+ * seleção sai sem o post do LinkedIn (`TIPOS_DO_DRENO_DE_CLIQUE`, lib/fila-tipos.ts), que pode levar a passada
+ * inteira, e o rodapé continua contando o post do LinkedIn, e arma o tique para ele.
+ */
+export async function drainQueue(
+  opcoes: { inicioDaFuncaoMs?: number; doClique?: boolean } = {}
+): Promise<ResumoDaDrenagem> {
   const inicioDaFuncaoMs = opcoes.inicioDaFuncaoMs ?? Date.now();
   const depsDoLinkedin = dependenciasDoLinkedin(inicioDaFuncaoMs);
   const result = { sent: 0, skipped: 0, failed: 0, guardados: 0, aguardando: 0, devolvidos: 0 };
@@ -1258,7 +1267,7 @@ export async function drainQueue(opcoes: { inicioDaFuncaoMs?: number } = {}): Pr
     [
       BATCH_SIZE,
       blocked,
-      Array.from(TIPOS_QUE_O_DRENO_CONHECE),
+      Array.from(opcoes.doClique ? TIPOS_DO_DRENO_DE_CLIQUE : TIPOS_QUE_O_DRENO_CONHECE),
       Array.from(TIPOS_DE_PUBLICACAO),
       Array.from(FORMAS_NO_LINKEDIN),
     ]
```

Em `app/publicar/actions.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/publicar/actions.ts b/app/publicar/actions.ts
index dbbbb2d..26fba34 100644
--- a/app/publicar/actions.ts
+++ b/app/publicar/actions.ts
@@ -79,6 +79,7 @@ import type { ResultadoDaPublicacao } from "@/lib/engine";
  */
 export async function publicar(formData: FormData): Promise<void> {
   await exigirSessao();
+  const inicioDaFuncaoMs = Date.now();
   const conta = await getSelectedAccount();
   if (!conta) {
     redirect(
@@ -179,7 +180,8 @@ export async function publicar(formData: FormData): Promise<void> {
   // drenando os itens dos outros.
   if (r.jaVale) {
     try {
-      await drainQueue();
+      // O DRENO DO CLIQUE (a 3a-0): com o começo da função, e sem o post do LinkedIn, que pode levar a passada inteira.
+      await drainQueue({ inicioDaFuncaoMs, doClique: true });
     } catch {
       // A trava atômica garante que o próximo dreno recupera. O item fica
       // 'pending' e a tela de Atividade mostra isso — que aqui é verdade. É o
@@ -437,7 +439,7 @@ export async function publicarNasDuasRedes(formData: FormData): Promise<void> {
   }
   if (instagram.entrou && instagram.jaVale) {
     try {
-      await drainQueue({ inicioDaFuncaoMs });
+      await drainQueue({ inicioDaFuncaoMs, doClique: true });
     } catch {
       // O mesmo `catch` do `publicar`: a trava atômica garante que o próximo dreno recupera.
     }
```

Em `app/contatos/actions.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/contatos/actions.ts b/app/contatos/actions.ts
index cf36f3e..86ffc0b 100644
--- a/app/contatos/actions.ts
+++ b/app/contatos/actions.ts
@@ -123,6 +123,7 @@ export async function atualizarPerfis(formData: FormData): Promise<void> {
  */
 export async function enviarLote(formData: FormData): Promise<void> {
   await exigirSessao();
+  const inicioDaFuncaoMs = Date.now();
   // O FILTRO VEM PRIMEIRO DE TUDO, antes de qualquer recusa: cada `redirect`
   // abaixo devolve o dono para a MESMA categoria que ele estava olhando, e não
   // para "tudo" — ele só perde o recorte quando o próprio campo não é legível
@@ -246,7 +247,9 @@ export async function enviarLote(formData: FormData): Promise<void> {
   // ponta; o resto do lote sai pelo tique que a própria drenagem agenda. Quem
   // clicou espera pelo primeiro punhado, e não pelos 126.
   try {
-    await drainQueue();
+    // O DRENO DO CLIQUE (a 3a-0): com o começo da função, que já gastou um insert por contato, e sem o post do
+    // LinkedIn, que pode levar a passada inteira.
+    await drainQueue({ inicioDaFuncaoMs, doClique: true });
   } catch {
     // A trava atômica garante que o próximo dreno recupera. Os itens ficam
     // 'pending' e a tela de Envios mostra isso — que aqui é verdade.
```

Em `app/conversas/[id]/actions.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/conversas/[id]/actions.ts b/app/conversas/[id]/actions.ts
index 0411fdb..6d2156d 100644
--- a/app/conversas/[id]/actions.ts
+++ b/app/conversas/[id]/actions.ts
@@ -15,6 +15,7 @@ export async function sendReply(
   formData: FormData
 ): Promise<{ error?: string }> {
   await exigirSessao();
+  const inicioDaFuncaoMs = Date.now();
   const account = await getSelectedAccount();
   if (!account) return { error: "Conecte uma conta do Instagram primeiro." };
 
@@ -59,7 +60,8 @@ export async function sendReply(
   // horário ou "não enviada", certa de primeira, sem depender de o JavaScript da
   // página estar de pé.
   try {
-    await drainQueue();
+    // O DRENO DO CLIQUE (a 3a-0): com o começo da função, e sem o post do LinkedIn, que pode levar a passada inteira.
+    await drainQueue({ inicioDaFuncaoMs, doClique: true });
   } catch {
     // A trava atômica garante que o próximo dreno recupera. O item fica
     // 'pending' e o balão mostra "enviando…", que aqui é verdade.
```

Em `app/publicar/post/actions.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/publicar/post/actions.ts b/app/publicar/post/actions.ts
index 1b852d2..1fec23e 100644
--- a/app/publicar/post/actions.ts
+++ b/app/publicar/post/actions.ts
@@ -230,6 +230,7 @@ export async function cancelarPublicacao(formData: FormData): Promise<void> {
 
 export async function remarcarPublicacao(formData: FormData): Promise<void> {
   await exigirSessao();
+  const inicioDaFuncaoMs = Date.now();
   const conta = await getSelectedAccount();
   if (!conta) {
     redirect(
@@ -325,8 +326,10 @@ export async function remarcarPublicacao(formData: FormData): Promise<void> {
       try {
         // O POST DO LINKEDIN DRENA SÓ A PRÓPRIA LINHA (achado 211), como o "agora" do compor: o dreno inteiro
         // mandaria também as mensagens vencidas do banco, que é um só para a produção e os previews.
-        if (ehPostDoLinkedin(kind)) await drenarUmaPublicacaoDoLinkedin(id);
-        else await drainQueue();
+        // OS DOIS COM O COMEÇO DA FUNÇÃO (a 3a-0), e o dreno do clique sem o post do LinkedIn, que pode levar a
+        // passada inteira: o do próprio post sai pelo dreno de uma linha só, acima.
+        if (ehPostDoLinkedin(kind)) await drenarUmaPublicacaoDoLinkedin(id, inicioDaFuncaoMs);
+        else await drainQueue({ inicioDaFuncaoMs, doClique: true });
       } catch {
         // A trava atômica garante que o próximo dreno recupera, como no compor.
       }
```

Em `app/bonus/publicar-actions.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/publicar-actions.ts b/app/bonus/publicar-actions.ts
index 121d229..0a1920f 100644
--- a/app/bonus/publicar-actions.ts
+++ b/app/bonus/publicar-actions.ts
@@ -87,6 +87,7 @@ export async function guardarImagemDoSlide(pedido: unknown): Promise<AvisoDaImag
  */
 export async function publicarCarrossel(pedido: unknown): Promise<AvisoDaPublicacao> {
   await exigirSessao();
+  const inicioDaFuncaoMs = Date.now();
   const p = registro(pedido);
   const em = Date.now();
   if (!ehIdDeBonus(p.id)) return { tom: "erro", texto: TEXTO_PEDIDO_INVALIDO, em };
@@ -98,7 +99,7 @@ export async function publicarCarrossel(pedido: unknown): Promise<AvisoDaPublica
     const r = registro(a);
     return { numero: inteiro(r.numero), caminho: r.caminho, versao: r.versao };
   });
-  const r = await publicarNaFila({ id: p.id, quando: momento.quando, artes, contas: await cabecalhosDoLogin() });
+  const r = await publicarNaFila({ id: p.id, quando: momento.quando, artes, contas: await cabecalhosDoLogin(), inicioDaFuncaoMs });
   return r.ok
     ? { tom: "ok", texto: textoDaPublicacaoMandada(!r.jaVale), em }
     : { tom: "erro", texto: textoDaRecusaDaPublicacaoDoCarrossel(r.recusa), em };
```

Em `lib/bonus/publicar-processo.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/publicar-processo.ts b/lib/bonus/publicar-processo.ts
index 9970575..fe76819 100644
--- a/lib/bonus/publicar-processo.ts
+++ b/lib/bonus/publicar-processo.ts
@@ -196,15 +196,20 @@ export type ArteSubida = { numero: number; caminho: unknown; versao: unknown };
  * texto e o caminho da foto). A foto guardada nunca vai para a fila, nem como cópia.
  *
  * `enfileirar` e `drenar` entram por parâmetro só para o teste: em produção são as do /publicar.
+ *
+ * `inicioDaFuncaoMs` é o começo da action que publica (a 3a-0; o 223): a hora de parar do dreno é contada dele. O
+ * dreno daqui é o de um clique, sem o post do LinkedIn (o 224). Sem o começo, vale a hora desta chamada.
  */
 export async function publicarNaFila(p: {
   id: string;
   quando: Date | null;
   artes: ArteSubida[];
   contas: ContaDoCabecalho[];
+  inicioDaFuncaoMs?: number;
   enfileirar?: typeof enqueuePublicacao;
-  drenar?: () => Promise<unknown>;
+  drenar?: (opcoes: { inicioDaFuncaoMs: number; doClique: boolean }) => Promise<unknown>;
 }): Promise<{ ok: true; quando: Date | null; jaVale: boolean } | Recusa> {
+  const inicioDaFuncaoMs = p.inicioDaFuncaoMs ?? Date.now();
   const enfileirar = p.enfileirar ?? enqueuePublicacao;
   const drenar = p.drenar ?? drainQueue;
   const c = await conferirCarrossel(p.id, p.contas);
@@ -355,7 +360,7 @@ export async function publicarNaFila(p: {
   // 99). O que ainda não vale não drena.
   if (r.jaVale) {
     try {
-      await drenar();
+      await drenar({ inicioDaFuncaoMs, doClique: true });
     } catch {
       // A trava atômica do dreno garante que o próximo recupera; o estado na página diz "publicando".
     }
```

- [ ] **Passo 4: rodar e ver passar**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/dreno-hora-de-parar"; cd "$C" || exit 1
npx --no-install vitest run tests/dreno-com-prazo.test.ts
DATABASE_URL_TESTES=postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes npx --no-install vitest run --config vitest.integracao.config.ts testes-integracao/dreno-hora-de-parar.integracao.ts
npx --no-install vitest run
npx --no-install tsc --noEmit
npx --no-install eslint lib/queue-drain.ts app/publicar/actions.ts app/contatos/actions.ts "app/conversas/[id]/actions.ts" app/publicar/post/actions.ts app/bonus/publicar-actions.ts lib/bonus/publicar-processo.ts tests/dreno-com-prazo.test.ts testes-integracao/dreno-hora-de-parar.integracao.ts
```

Esperado: nos puros, "Test Files 1 passed (1)" e "Tests 14 passed (14)"; a integração: `ALVO: banco de TESTE`, "nenhum schema teste_tmp_* no banco" antes e depois, "Test Files 1 passed (1)" e "Tests 14 passed (14)"; a suíte pura inteira: "Test Files 159 passed (159)" e "Tests 3783 passed (3783)". O `tsc` e o lint sem saída.

- [ ] **Passo 5: o commit**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/dreno-hora-de-parar"; cd "$C" || exit 1
node ../varrer-texto.mjs lib/queue-drain.ts app/publicar/actions.ts app/contatos/actions.ts "app/conversas/[id]/actions.ts" app/publicar/post/actions.ts app/bonus/publicar-actions.ts lib/bonus/publicar-processo.ts tests/dreno-com-prazo.test.ts testes-integracao/dreno-hora-de-parar.integracao.ts && test "$(git branch --show-current)" = dreno-hora-de-parar && git add lib/queue-drain.ts app/publicar/actions.ts app/contatos/actions.ts "app/conversas/[id]/actions.ts" app/publicar/post/actions.ts app/bonus/publicar-actions.ts lib/bonus/publicar-processo.ts tests/dreno-com-prazo.test.ts testes-integracao/dreno-hora-de-parar.integracao.ts && git commit -m "Os drenos dos cliques do painel passam o começo da função e não pegam o post do LinkedIn, que sai pelos drenos das rotas"
git show HEAD | git patch-id --stable | cut -c1-12   # 1ff253e92786
```

---

### FASE 5 — A devolução só mexe na linha deste dreno, e o teste de fonte fecha os outros caminhos

**Arquivos:** `lib/queue-drain.ts`, `lib/avisos.ts`, `tests/dreno-com-prazo.test.ts`, `testes-integracao/dreno-hora-de-parar.integracao.ts`.

O 225 e o 226, da leitura independente do ensaio. Os dois casos novos de integração fazem outro dreno resgatar a linha no meio do caminho (o `claimed_at` regravado), e a devolução deste dreno não pode tocá-la.

- [ ] **Passo 1: os testes**

Em `tests/dreno-com-prazo.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/dreno-com-prazo.test.ts b/tests/dreno-com-prazo.test.ts
index 87dcbe8..21f23f8 100644
--- a/tests/dreno-com-prazo.test.ts
+++ b/tests/dreno-com-prazo.test.ts
@@ -112,18 +112,43 @@ const DRENOS_DE_CLIQUE = [
 
 const COMECO_DEPOIS_DA_SESSAO = /\{\n {2}await exigirSessao\(\);\n {2}const inicioDaFuncaoMs = Date\.now\(\);\n/;
 
-describe("os arquivos que importam o dreno (a 3a-0)", () => {
-  it("são os 8 de sempre: as 3 rotas, as 4 actions de clique e o processo do bônus", () => {
+// O 226 (a leitura independente): a lista pega TODO jeito de chegar ao dreno (o import com aspas duplas ou simples, o
+// relativo, o `import * as` e o `await import`); nenhum arquivo dá outro nome ao dreno nem o guarda numa variável (fora
+// o `drenar` do bônus, que tem caso próprio); e toda chamada é uma das DUAS formas exatas: a das rotas, e a do clique em
+// todo o resto, inclusive numa action nova de um destes arquivos.
+const CHEGA_AO_DRENO = /(?:\bfrom\s*|\bimport\s*\(\s*)["'](?:@\/lib\/|(?:\.{1,2}\/)+(?:[\w[\]-]+\/)*)queue-drain["']/;
+const FORMA_DA_ROTA = "drainQueue({ inicioDaFuncaoMs })";
+const FORMA_DO_CLIQUE = "drainQueue({ inicioDaFuncaoMs, doClique: true })";
+
+/** O código sem as linhas de comentário (as de `//` e as de JSDoc), para o comentário que cita o dreno não contar. */
+const soOCodigo = (arquivo: string) =>
+  ler(arquivo)
+    .split("\n")
+    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
+    .join("\n");
+
+describe("os arquivos que chegam ao dreno (a 3a-0)", () => {
+  it("são os 8 de sempre, por qualquer jeito de importar: as 3 rotas, as 4 actions de clique e o processo do bônus", () => {
     const achados = [...arquivosDe("app"), ...arquivosDe("lib")]
-      .filter((f) => /import\s*\{[^}]*\bdrainQueue\b[^}]*\}\s*from\s*"@\/lib\/queue-drain"/.test(ler(f)))
+      .filter((f) => f !== "lib/queue-drain.ts" && CHEGA_AO_DRENO.test(ler(f)))
       .sort();
     expect(achados).toEqual(QUEM_IMPORTA_O_DRENO);
   });
 
-  it("nenhum chama o dreno sem o começo da função", () => {
+  it("nenhum dá outro nome ao dreno nem o guarda numa variável (fora o drenar do bônus)", () => {
     for (const arquivo of QUEM_IMPORTA_O_DRENO) {
-      expect(ler(arquivo)).not.toMatch(/drainQueue\(\s*\)/);
-      for (const chamada of ler(arquivo).match(/drainQueue\([^)]*\)/g) ?? []) expect(chamada).toMatch(/inicioDaFuncaoMs/);
+      const codigo = soOCodigo(arquivo)
+        .replace(/import\s*\{[^}]*\}\s*from\s*["'][^"']+["'];?/g, "")
+        .replace("p.drenar ?? drainQueue", "");
+      expect(codigo).not.toMatch(/\bdrainQueue\s+as\b/);
+      expect(codigo.match(/\bdrainQueue\b(?!\s*\()/g) ?? []).toEqual([]);
+    }
+  });
+
+  it("toda chamada do dreno é uma das duas formas exatas: a das rotas nas 3 rotas, e a do clique em todo o resto", () => {
+    for (const arquivo of QUEM_IMPORTA_O_DRENO) {
+      const esperada = ROTAS.includes(arquivo) ? FORMA_DA_ROTA : FORMA_DO_CLIQUE;
+      for (const chamada of soOCodigo(arquivo).match(/\bdrainQueue\s*\([^)]*\)/g) ?? []) expect(chamada).toBe(esperada);
     }
   });
 });
```

Em `testes-integracao/dreno-hora-de-parar.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/dreno-hora-de-parar.integracao.ts b/testes-integracao/dreno-hora-de-parar.integracao.ts
index b718c9f..840cca9 100644
--- a/testes-integracao/dreno-hora-de-parar.integracao.ts
+++ b/testes-integracao/dreno-hora-de-parar.integracao.ts
@@ -46,6 +46,8 @@ const meta = {
   atrasoDoContainer: (_n: number) => 0,
   atrasoDoEstadoMs: 0,
   atrasoDaCotaMs: 0,
+  /** O que acontece durante a criação de cada contêiner (o 225: outro dreno resgata a linha no meio do caminho). */
+  duranteDoContainer: null as null | (() => Promise<void>),
 };
 const linkedin = { pedidos: [] as string[], atrasoMs: 0, durante: null as null | (() => Promise<void>) };
 
@@ -89,6 +91,7 @@ beforeAll(async () => {
     if (req.method === "POST" && ultimo === "media") {
       meta.containers++;
       const n = meta.containers;
+      if (meta.duranteDoContainer) await meta.duranteDoContainer();
       const atraso = meta.atrasoDoContainer(n);
       if (atraso) await esperar(atraso);
       return responder(res, 200, { id: `container-${n}` });
@@ -192,6 +195,7 @@ beforeEach(async () => {
   meta.atrasoDoContainer = () => 0;
   meta.atrasoDoEstadoMs = 0;
   meta.atrasoDaCotaMs = 0;
+  meta.duranteDoContainer = null;
   linkedin.pedidos = [];
   linkedin.atrasoMs = 0;
   linkedin.durante = null;
@@ -329,11 +333,16 @@ describe("a hora de parar, no laço", () => {
 });
 
 describe("sem passar da hora de parar, o dreno é o de hoje", () => {
-  it("as mensagens saem, nada volta, e não há linha de registro", async () => {
+  // O LOTE TEM O POST DO LINKEDIN DE PASSO CURTO (só texto, já adiado, e então o primeiro), como o desenho pede (§6,
+  // nota da leitura independente): ele sai, as mensagens saem depois dele, e nada volta.
+  it("o lote com o post do LinkedIn de passo curto (só texto) e as mensagens: tudo sai, nada volta, e não há linha de registro", async () => {
+    const li = await postDoLinkedinAdiado();
     await mensagem("um");
     await mensagem("dois");
     const { valor: resumo, linhas } = await comORegistro(() => dreno.drainQueue());
-    expect(resumo).toMatchObject({ sent: 2, devolvidos: 0 });
+    expect(resumo).toMatchObject({ sent: 3, devolvidos: 0 });
+    expect((await linha(li)).status).toBe("sent");
+    expect(linkedin.pedidos).toEqual(["POST /rest/posts"]);
     expect(meta.textos).toEqual(["um", "dois"]);
     expect(linhas).toEqual([]);
   }, 30_000);
@@ -460,3 +469,35 @@ describe("o dreno de clique não pega o post do LinkedIn (a P3, o 224)", () => {
     expect((await linha(li)).status).toBe("sent");
   });
 });
+
+// A DEVOLUÇÃO SÓ MEXE NO QUE ESTE DRENO PEGOU (a 3a-0; o 225, da leitura independente). Numa página de 300 s, um POST
+// sem teto pode segurar o dreno A por mais de 3 minutos; o dreno B resgata as linhas de A e as processa; e A, ao voltar,
+// passava da hora e as devolvia a pending, e um terceiro dreno mandaria de novo o que B mandou. A reivindicação grava o
+// mesmo `claimed_at` no lote inteiro, e a devolução só mexe na linha que ainda tem esse `claimed_at`. Os casos trocam o
+// `claimed_at` à mão, como faria o resgate de outro dreno, no meio da passada de A.
+describe("a devolução só mexe no que este dreno pegou (o 225)", () => {
+  it("no laço: a mensagem que outro dreno resgatou no meio do caminho não volta, e a que continua deste dreno volta", async () => {
+    await postDoLinkedinAdiado();
+    const resgatada = await mensagem("a que outro dreno resgatou");
+    const nossa = await mensagem("a que continua deste dreno");
+    linkedin.atrasoMs = 2_000;
+    linkedin.durante = async () => {
+      await q(`update queue set claimed_at = now() + interval '1 second' where id = $1`, [resgatada]);
+    };
+    const resumo = await dreno.drainQueue({ inicioDaFuncaoMs: haTrintaENoveSegundos() });
+    expect((await linha(resgatada)).status).toBe("sending");
+    expect((await linha(nossa)).status).toBe("pending");
+    expect(resumo.devolvidos).toBe(1);
+  });
+
+  it("no post do Instagram: o post que outro dreno resgatou no meio do caminho não volta, e não conta como devolvido", async () => {
+    const id = await postDoInstagram("carrossel", 3);
+    meta.atrasoDoContainer = (n) => (n === 1 ? 2_000 : 0);
+    meta.duranteDoContainer = async () => {
+      await q(`update queue set claimed_at = now() + interval '1 second' where id = $1`, [id]);
+    };
+    const resumo = await dreno.drainQueue({ inicioDaFuncaoMs: haTrintaENoveSegundos() });
+    expect((await linha(id)).status).toBe("sending");
+    expect(resumo.devolvidos).toBe(0);
+  });
+});
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/dreno-hora-de-parar"; cd "$C" || exit 1
npx --no-install vitest run tests/dreno-com-prazo.test.ts
DATABASE_URL_TESTES=postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes npx --no-install vitest run --config vitest.integracao.config.ts testes-integracao/dreno-hora-de-parar.integracao.ts
```

Esperado: nos puros, "Test Files 1 passed (1)" e "Tests 15 passed (15)": o teste de fonte reforçado passa já, de propósito. Ele fecha caminhos que o código da FASE 4 não usa (outro nome, a variável, o import relativo ou com aspas simples, e a chamada fora das duas formas exatas), e as mutações F5-3, F5-4 e F5-5 provam que ele cai quando alguém os usa. Na integração, `ALVO: banco de TESTE`, "nenhum schema teste_tmp_* no banco" antes e depois, "Test Files 1 failed (1)" e "Tests 2 failed | 14 passed (16)": caem os dois casos do 225, porque a devolução ainda não confere a ficha da reivindicação.

- [ ] **Passo 3: o código**

Em `lib/queue-drain.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/queue-drain.ts b/lib/queue-drain.ts
index 5780aa9..c869898 100644
--- a/lib/queue-drain.ts
+++ b/lib/queue-drain.ts
@@ -488,7 +488,8 @@ type DesfechoDaPublicacao = "publicado" | "aguardando" | "falhou" | "devolvido";
 async function publicarDaFila(
   item: QueueItem,
   account: Account,
-  passouDaHoraDeParar: () => boolean
+  passouDaHoraDeParar: () => boolean,
+  devolverDoLote: (ids: readonly string[]) => Promise<void>
 ): Promise<DesfechoDaPublicacao> {
   // A HORA DE PARAR POR DENTRO (a 3a-0; o 223; scratchpad/desenho-223.md, P2). Um carrossel faz até 11 POSTs sem teto
   // (o teto do `graphFetch` é só do GET, de propósito: lib/ig.ts) e 2 GETs de até 8 s, e começado aos 39 s ele ainda
@@ -496,9 +497,10 @@ async function publicarDaFila(
   // pelo mesmo caminho do laço (`devolverOQueNaoComecou`), sem gastar a tentativa, e o que já foi gravado no payload
   // (os filhos, o contêiner) fica para a passada seguinte. O corte de um post não publica em dobro (a lista de filhos
   // gravada a cada filho e o "publicado não republica", abaixo); o que esta conferência evita é a linha presa em
-  // `sending` por 3 minutos, sem tique. O relógio é o do laço, que o dreno passa.
+  // `sending` por 3 minutos, sem tique. O relógio e a devolução são os do laço, que o dreno passa: a devolução leva
+  // a ficha da reivindicação (o 225) e conta o que o banco de fato devolveu.
   const devolver = async (): Promise<DesfechoDaPublicacao> => {
-    await devolverOQueNaoComecou([item.id]);
+    await devolverDoLote([item.id]);
     return "devolvido";
   };
   const pub = lerPayloadDaPublicacao(item.payload);
@@ -952,9 +954,10 @@ export type ResumoDaDrenagem = {
   // Em português pela mesma razão que `guardados`: o estado que ele conta é o
   // da publicação esperando a Meta, e o produto chama isso de aguardar.
   aguardando: number;
-  // O SEXTO CONTADOR (a 3a-0; o 223): as linhas que voltaram à fila sem começar, porque a hora de parar chegou
-  // (`jaPassouDaHoraDeParar`, lib/fila-tipos.ts). Não é o `aguardando`, que é a publicação esperando a Meta: estas
-  // nem foram tentadas. Zero quando o dreno nem reivindicou, porque nada foi pego.
+  // O SEXTO CONTADOR (a 3a-0; o 223): as linhas que voltaram à fila sem terminar, porque a hora de parar chegou
+  // (`jaPassouDaHoraDeParar`, lib/fila-tipos.ts): as do laço nem começaram, e o post do Instagram parou no meio, com o
+  // que já tinha feito no payload. Não é o `aguardando`, que é a publicação esperando a Meta. É o número de linhas que
+  // o banco de fato devolveu; zero quando o dreno nem reivindicou, porque nada foi pego.
   devolvidos: number;
 };
 
@@ -1043,8 +1046,9 @@ async function devolverOuEncerrar(item: QueueItem, err: unknown): Promise<"pendi
 /**
  * O ORÇAMENTO DE TEMPO DE UMA FUNÇÃO QUE DRENA: as rotas que drenam têm `maxDuration` 60 (o tique, o webhook e o
  * cron), e os 5 s que faltam são a folga. É contado do COMEÇO DA FUNÇÃO (`inicioDaFuncaoMs`), que as três rotas
- * passam (tests/dreno-com-prazo.test.ts); sem ele, conta da hora em que o dreno começou. Hoje só o post do
- * LinkedIn o lê (lib/linkedin-fila.ts), para não começar um passo que a função não tem tempo de terminar.
+ * passam (tests/dreno-com-prazo.test.ts); sem ele, conta da hora em que o dreno começou. Dois o leem: o post do
+ * LinkedIn (lib/linkedin-fila.ts), para não começar um passo que a função não tem tempo de terminar, e a hora de parar
+ * do dreno (a 3a-0; `jaPassouDaHoraDeParar`, lib/fila-tipos.ts), para não começar item nenhum depois dela.
  */
 export const ORCAMENTO_DA_FUNCAO_MS = 55_000;
 
@@ -1057,18 +1061,22 @@ export const ORCAMENTO_DA_FUNCAO_MS = 55_000;
  *   - com o `error` que estava. Um texto novo cairia no genérico da tela de Envios (app/labels.ts), falso para uma
  *     linha que ninguém tentou, e só a nova tentativa grava `error` numa publicação pendente
  *     (lib/bonus/publicar-estado.ts);
- *   - só o que ainda está em `sending`: uma linha que outro processo encerrou no meio do caminho não volta.
- * Uma linha vai ao registro, só com a contagem e os tipos (`textoDaDevolucao`). Sem a resposta do banco, as linhas
- * ficam em `sending`, e o resgate de 3 minutos as devolve; o rodapé roda do mesmo jeito.
+ *   - só o que ainda está em `sending` COM A FICHA DESTE DRENO, o `claimed_at` que ele gravou no lote inteiro (o
+ *     225, da leitura independente): uma linha que outro processo encerrou não volta, e uma linha que outro dreno
+ *     resgatou depois de 3 minutos (numa página de 300 s, um POST sem teto pode segurar este dreno) é daquele dreno, e
+ *     não volta. Sem a ficha, ele devolveria a pending o que o outro já mandou, e um terceiro mandaria de novo.
+ * Uma linha vai ao registro, só com a contagem e os tipos (`textoDaDevolucao`). Devolve quantas o banco devolveu.
+ * Sem a resposta do banco, as linhas ficam em `sending`, sem tique, até o resgate de 3 minutos por um dreno qualquer:
+ * o rodapé roda, mas não arma nada para elas.
  */
-async function devolverOQueNaoComecou(ids: readonly string[]): Promise<number> {
-  if (ids.length === 0) return 0;
+async function devolverOQueNaoComecou(ids: readonly string[], fichaDaReivindicacao: string | null): Promise<number> {
+  if (ids.length === 0 || fichaDaReivindicacao === null) return 0;
   try {
     const linhas = (await sql().query(
       `update queue set status = 'pending', attempts = greatest(attempts - 1, 0), not_before = now()
-        where id = any($1::uuid[]) and status = 'sending'
+        where id = any($1::uuid[]) and status = 'sending' and claimed_at = $2::text::timestamptz
         returning kind`,
-      [Array.from(ids)]
+      [Array.from(ids), fichaDaReivindicacao]
     )) as { kind: string }[];
     if (linhas.length > 0) console.log(textoDaDevolucao(linhas.map((l) => l.kind)));
     return linhas.length;
@@ -1263,7 +1271,7 @@ export async function drainQueue(
        )
        returning q.*
      )
-     select *, now() as agora_do_banco from lote order by created_at, id`,
+     select *, now() as agora_do_banco, claimed_at::text as reivindicado_em from lote order by created_at, id`,
     [
       BATCH_SIZE,
       blocked,
@@ -1271,7 +1279,19 @@ export async function drainQueue(
       Array.from(TIPOS_DE_PUBLICACAO),
       Array.from(FORMAS_NO_LINKEDIN),
     ]
-  )) as (QueueItem & { agora_do_banco: Date })[];
+  )) as (QueueItem & { agora_do_banco: Date; reivindicado_em: string })[];
+
+  // A FICHA DA REIVINDICAÇÃO (a 3a-0; o 225): o `claimed_at` que este dreno gravou no lote inteiro (um `now()` só, do
+  // mesmo `update`), em TEXTO, com os microssegundos do banco: o `Date` do driver só guarda milissegundos, e a
+  // comparação exata falharia. E ELA VAI COMO TEXTO E VIRA INSTANTE NO SQL (`$2::text::timestamptz`): com o parâmetro
+  // tipado como `timestamptz`, o postgres.js o converte para `Date` antes de mandar, e os microssegundos se perdem
+  // (medido em 12/11 no banco de teste: "…24.428574+00" voltou "…24.428+00" e não casou). A devolução só mexe na
+  // linha que ainda tem esta ficha, e soma no `devolvidos` o que o
+  // banco de fato devolveu (nota da leitura independente).
+  const fichaDaReivindicacao = items[0]?.reivindicado_em ?? null;
+  const devolver = async (ids: readonly string[]): Promise<void> => {
+    result.devolvidos += await devolverOQueNaoComecou(ids, fichaDaReivindicacao);
+  };
 
   // O RELOGIO QUE JULGA A VALIDADE É O DO BANCO, E NÃO O DA APLICAÇÃO.
   //
@@ -1305,7 +1325,7 @@ export async function drainQueue(
   const naoComecados = new Set(items.map((i) => i.id));
   for (const item of naOrdemDoLote(items)) {
     if (passouDaHoraDeParar()) {
-      result.devolvidos += await devolverOQueNaoComecou([...naoComecados]);
+      await devolver([...naoComecados]);
       break;
     }
     naoComecados.delete(item.id);
@@ -1384,11 +1404,11 @@ export async function drainQueue(
       // de retentativa escrita só para este ramo seria uma segunda coisa para
       // manter, e o `catch` de baixo já está certo.
       if (item.kind === "publicacao") {
-        const desfecho = await publicarDaFila(item, account, passouDaHoraDeParar);
+        const desfecho = await publicarDaFila(item, account, passouDaHoraDeParar, devolver);
         if (desfecho === "publicado") result.sent++;
         else if (desfecho === "aguardando") result.aguardando++;
-        else if (desfecho === "devolvido") result.devolvidos++;
-        else result.failed++;
+        // O "DEVOLVIDO" JÁ FOI CONTADO NA DEVOLUÇÃO, pelo número de linhas que o banco devolveu (a 3a-0).
+        else if (desfecho === "falhou") result.failed++;
         continue;
       }
 
```

Em `lib/avisos.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/avisos.ts b/lib/avisos.ts
index febd705..bc28113 100644
--- a/lib/avisos.ts
+++ b/lib/avisos.ts
@@ -112,8 +112,8 @@ export function textoDoLoteEnviado(agora: number, guardadas: number): string {
  * O aviso do lote inteiro — texto E tom —, resolvendo a ambiguidade que
  * `textoDoLoteEnviado(0, 0)` sozinha não sabe resolver.
  *
- * `enviarLote` (app/contatos/actions.ts) tem `try { await drainQueue(); }
- * catch {}`. Quando o dreno LANÇA — que é o motivo de o `catch` existir —,
+ * `enviarLote` (app/contatos/actions.ts) tem
+ * `try { await drainQueue({ inicioDaFuncaoMs, doClique: true }); } catch {}`. Quando o dreno LANÇA — que é o motivo de o `catch` existir —,
  * nenhum item deste lote chega a virar `sent` nem `guardado`: os dois ficam
  * ZERO, e os itens ficam `pending` (nem enviados, nem guardados — só ainda não
  * tentados). `textoDoLoteEnviado(0, 0)` devolve "ninguém recebeu agora · 0
```

- [ ] **Passo 4: rodar e ver passar**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/dreno-hora-de-parar"; cd "$C" || exit 1
npx --no-install vitest run tests/dreno-com-prazo.test.ts
DATABASE_URL_TESTES=postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes npx --no-install vitest run --config vitest.integracao.config.ts testes-integracao/dreno-hora-de-parar.integracao.ts
npx --no-install vitest run
npx --no-install tsc --noEmit
npx --no-install eslint lib/queue-drain.ts lib/avisos.ts tests/dreno-com-prazo.test.ts testes-integracao/dreno-hora-de-parar.integracao.ts
```

Esperado: nos puros, "Test Files 1 passed (1)" e "Tests 15 passed (15)"; a integração: `ALVO: banco de TESTE`, "nenhum schema teste_tmp_* no banco" antes e depois, "Test Files 1 passed (1)" e "Tests 16 passed (16)"; a suíte pura inteira: "Test Files 159 passed (159)" e "Tests 3784 passed (3784)". O `tsc` e o lint sem saída.

- [ ] **Passo 5: o commit**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/dreno-hora-de-parar"; cd "$C" || exit 1
node ../varrer-texto.mjs lib/queue-drain.ts lib/avisos.ts tests/dreno-com-prazo.test.ts testes-integracao/dreno-hora-de-parar.integracao.ts && test "$(git branch --show-current)" = dreno-hora-de-parar && git add lib/queue-drain.ts lib/avisos.ts tests/dreno-com-prazo.test.ts testes-integracao/dreno-hora-de-parar.integracao.ts && git commit -m "A devolução do dreno só mexe na linha que ele mesmo reivindicou, conta o que o banco devolveu, e o teste de fonte fecha todo jeito de chegar ao dreno"
git show HEAD | git patch-id --stable | cut -c1-12   # 402cda67679e
```

---

### FASE 6 — A verificação inteira, as mutações e a guarda do diff

- [ ] **Passo 1: o verify**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/dreno-hora-de-parar"; cd "$C" || exit 1
env -u CLAUDECODE -u AI_AGENT npm run verify; echo "saída $?"; git diff --stat AGENTS.md
```

Esperado: saída 0; 159 arquivos e 3 784 casos puros; 36 e 336 de tela; "SEM VAZAMENTO em A nem em C, nas duas varreduras."; "MIGRAÇÃO PULADA — este não é um deploy de produção."; o build do Next 16.4.3 ("Compiled successfully"); e o `git diff --stat AGENTS.md` vazio. Se o `beforeAll` de `tests/proxy-matcher.test.ts` passar de 10 s (o 218, que aconteceu na primeira rodada do ensaio), rode-o sozinho (`npx --no-install vitest run tests/proxy-matcher.test.ts`, 13 casos) e o verify inteiro de novo.

- [ ] **Passo 2: a integração inteira, uma rodada só**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/dreno-hora-de-parar"; cd "$C" || exit 1
DATABASE_URL_TESTES=postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes npm run test:integracao
```

Esperado: `ALVO: banco de TESTE`; "nenhum schema teste_tmp_* no banco" antes e depois; "Test Files 78 passed (78)" e "Tests 954 passed | 8 skipped (962)" (na base, 77 arquivos, 938 e 8).

- [ ] **Passo 3: o roteiro das mutações, gravado a partir do Apêndice A, fora da cópia**

O roteiro é o último bloco deste plano. O comando abaixo o tira do plano commitado e o grava em `../mutar-li3a0.mjs`. Se o arquivo já existir ali, ele só compara e para se for diferente.

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/dreno-hora-de-parar"; cd "$C" || exit 1
node -e '
const fs = require("fs");
const plano = fs.readFileSync("docs/plans/2026-11-12-dreno-hora-de-parar.md", "utf8").replace(/\r\n/g, "\n");
const cerca = String.fromCharCode(96).repeat(3);
const inicio = plano.lastIndexOf(cerca + "js\n") + cerca.length + 3;
const bloco = plano.slice(inicio, plano.indexOf("\n" + cerca, inicio) + 1);
const destino = "../mutar-li3a0.mjs";
if (fs.existsSync(destino)) {
  const igual = fs.readFileSync(destino, "utf8") === bloco;
  console.log(igual ? "o roteiro de fora é igual ao Apêndice A" : "DIFERENTE do Apêndice A: pare");
  process.exit(igual ? 0 : 1);
}
fs.writeFileSync(destino, bloco);
console.log("gravado a partir do Apêndice A");
'
sha256sum ../mutar-li3a0.mjs   # df98f1fb6fc187a36d0d8c623515b81be2a77f8d05e46d7c67b785c0326bf7fa
```

- [ ] **Passo 4: as mutações (Apêndice A)**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/dreno-hora-de-parar"; cd "$C" || exit 1
node ../mutar-li3a0.mjs --conferir    # "33 mutações, 0 ruins; árvore no fim: limpa (só a conferência dos trechos)"
node ../mutar-li3a0.mjs
```

Esperado: as 33 como "MORTA", e "33 mutações, 0 ruins; árvore no fim: limpa". Se a rodada parar antes dessa linha, rode `git status` e `git diff` antes de qualquer outra coisa: o arquivo da mutação em curso pode ter ficado mutado, e só ele se restaura.

- [ ] **Passo 5: a guarda do diff**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/dreno-hora-de-parar"; cd "$C" || exit 1
git diff --stat e2949fb HEAD -- . ':!docs'
git diff --name-only e2949fb HEAD -- migrations scripts package.json package-lock.json   # vazio
git diff --name-only e2949fb HEAD -- docs                                                  # só este plano
```

Esperado: no primeiro, os 13 arquivos do mapa, e mais nenhum: "13 files changed, 896 insertions(+), 39 deletions(-)". O segundo, vazio: nada em `migrations`, `scripts`, `package.json` nem `package-lock.json`. No terceiro, só este plano. O patch-id de cada fase (`git show <commit> | git patch-id --stable`) tem de bater com o do ensaio: `142c7b277576`, `8bf0461c9a62`, `6f3712622625`, `1ff253e92786` e `402cda67679e`.

---

### FASE 7 — O push, o PR, o deploy e a primeira hora

A devolução não se provoca com segurança na produção: seria preciso um lote que passasse dos 40 s. E, na tela, o efeito só aparece nos casos dos limites acima (o clique que passa dos 40 s antes do dreno, ou o lote grande), que também não se provocam sem gravar na produção. Por isso não há prova no navegador. A prova é a integração, as mutações, a base lida pela auditoria antes e depois do merge, o deploy e a primeira hora.

- [ ] **Passo 1: a conferência antes do push.** Repetida, igual, antes do PR (Passo 3) e antes da caixa do merge (Passo 4).

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/dreno-hora-de-parar"; cd "$C" || exit 1
git fetch origin
test "$(git rev-parse --short origin/main)" = e2949fb && echo "origin/main em e2949fb"
test "$(git branch --show-current)" = dreno-hora-de-parar && echo "na branch certa"
git log --oneline e2949fb..HEAD                            # 6 commits: o plano e as FASES 1 a 5
git log --format='%an <%ae>' e2949fb..HEAD | sort -u       # só Eduardo Kobal <162614913+Eduardokobal@users.noreply.github.com>
git log --format=%B e2949fb..HEAD | grep -ci "co-authored" # 0
git status --porcelain                                     # vazio
```

Se qualquer linha divergir, pare.

- [ ] **Passo 2: o push da branch, com o OK do Eduardo pela caixa e a hora à auditoria**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/dreno-hora-de-parar"; cd "$C" || exit 1
test -z "$(git ls-remote origin refs/heads/dreno-hora-de-parar)" || { echo "a branch já existe no remoto: pare"; exit 1; }
test "$(git branch --show-current)" = dreno-hora-de-parar && git push -u origin refs/heads/dreno-hora-de-parar:refs/heads/dreno-hora-de-parar
```

No log do build do preview, confira:
- o commit;
- nenhum aviso do Node 26;
- "Detected Next.js version: 16.4.3";
- "MIGRAÇÃO PULADA".

O preview usa o banco de produção, e ninguém clica nele nesta entrega. Os drenos de clique dele, se alguém clicasse, já não pegariam as linhas do LinkedIn da produção.

- [ ] **Passo 3: o PR, com o OK do Eduardo pela caixa.**
  - O corpo leva o que muda, os números deste plano, o que o ensaio achou e os limites conhecidos, sem nenhuma arroba solta nem nome de pessoa ou de conta. Ele fica em `../corpo-pr-3a0.md`, e a mensagem do merge, à parte, em `../merge-3a0.txt`. A auditoria lê os dois antes de o PR abrir.
  - Depois da conferência do Passo 1, de novo:

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/dreno-hora-de-parar"; cd "$C" || exit 1
gh pr create --base main --head dreno-hora-de-parar --title "O dreno não começa nada depois da hora de parar, e os cliques do painel não pegam o post do LinkedIn" --body-file ../corpo-pr-3a0.md
```

  - **A caixa do PR diz que o merge espera a conferência da auditoria e uma caixa minha**, e leva os limites que mudam o que quem usa o painel vê.

- [ ] **Passo 4: a leitura de antes do merge e a caixa do merge.**
  - A auditoria lê a base (as consultas do Passo 6) na hora antes do merge. Essa leitura é a base de comparação da primeira hora.
  - Depois da conferência do Passo 1, de novo, vem a caixa do merge. O merge é do Eduardo. A caixa é de resultado: sem "(Recomendado)" e com "Não fiz / não lembro".

- [ ] **Passo 5: o deploy do merge.**
  - No log, quatro coisas:
    - "Nada a aplicar: as 26 migrações já constam no registro.";
    - o `queue_kind_check` "existe e confere (025-fila-linkedin.sql)";
    - as outras conferências "CONFERIDO";
    - nenhum aviso do Node 26.
  - No site: o `/entrar` dá 200, e o cron sem senha dá 401.

- [ ] **Passo 6: a primeira hora.** A janela vai do deploy pronto até uma hora depois. Nada aqui grava.
  - **Os erros e os registros da Vercel**, lidos pelo DEV e pela auditoria com o conector da Vercel, no projeto e na janela:
    - `get_runtime_errors`: nenhum erro novo, e nenhuma função cortada por tempo nas rotas que drenam (`/api/queue/tick`, `/api/webhook` e `/api/cron/daily`) nem nas páginas das actions;
    - `get_runtime_logs` com o texto `[dreno]`: cada linha tem hora, contagem e tipos, e nenhum id, texto ou conta.
    - As 6 actions engolem o erro do dreno (o `try`/`catch` de cada clique), então "nenhum erro novo" não prova que o dreno de clique funciona. Quem prova é a espera, abaixo.
  - **A base, só pela auditoria, só lendo**: com as ferramentas dela (o `node` com o `postgres.js`, cada leitura num `sql.begin("read only", ...)`, e a URL lida do `.env.local` do projeto sem aparecer na tela). O DEV não se conecta à produção.
    - Só se leem `kind`, `status`, `attempts` e as horas. Nunca `payload`, `contact_ig_id`, `error` nem texto.
    - A mesma leitura foi feita antes do merge (Passo 4), e as janelas de comparação são a hora antes do merge e a mesma hora do dia anterior.

```sql
-- 1. as presas em sending: tem de dar 0
select count(*) from queue where status = 'sending' and claimed_at < now() - interval '3 minutes';

-- 2. as vencidas que não saíram, por tipo: contra a leitura de antes do merge
select kind, count(*) from queue
 where status = 'pending' and not_before < now() - interval '2 minutes'
 group by 1 order by 1;

-- 3. o que foi pego na janela, por tipo, desfecho e tentativas. Pela hora da reivindicação, vê também o que não saiu:
--    a linha devolvida e pega de novo tem a tentativa de antes mais 1, e não mais 2
select kind, status, attempts, count(*) from queue
 where claimed_at >= '<início>'::timestamptz and claimed_at < '<fim>'::timestamptz
 group by 1, 2, 3 order by 1, 2, 3;

-- 4. o que saiu na janela, por tipo, e a espera do vencimento ao envio. Pela hora do envio, só vê o que saiu.
--    Rode também com as duas horas menos 1 dia: sem queda no volume e sem espera maior
select kind, count(*) as sairam,
       percentile_disc(0.5) within group (order by sent_at - greatest(created_at, not_before)) as espera_mediana,
       max(sent_at - greatest(created_at, not_before)) as espera_maxima
  from queue
 where status = 'sent' and sent_at >= '<início>'::timestamptz and sent_at < '<fim>'::timestamptz
 group by 1 order by 1;

-- 5. os posts da janela (o Instagram e o LinkedIn): o desfecho, as tentativas e quanto levaram
select kind, status, attempts,
       sent_at - claimed_at as na_ultima_passada,
       sent_at - greatest(created_at, not_before) as do_vencimento_ao_envio
  from queue
 where kind in ('publicacao', 'publicacao_linkedin')
   and coalesce(sent_at, claimed_at) >= '<início>'::timestamptz and coalesce(sent_at, claimed_at) < '<fim>'::timestamptz
 order by claimed_at;
```

  - **A linha "[dreno]" é a regra agindo, e não um defeito.** Ela pode aparecer no tráfego normal, por exemplo num lote de webhook com um post longo. Para cada uma, os itens dela (pela hora e pelos tipos) têm de ter saído numa passada seguinte, com a tentativa de antes mais 1.
  - **Quando divergir, pare.** São quatro casos:
    - uma linha presa em `sending` há mais de 3 minutos;
    - queda no volume ou espera maior que a das janelas de comparação;
    - um erro novo;
    - uma linha "[dreno]" cujos itens não saíram na passada seguinte.
    Em qualquer um deles, avise a auditoria com a leitura. O caminho de volta é o rollback da Vercel para o deploy da `e2949fb`: sem migração nesta entrega, ele é seguro. Ele só é feito com a caixa do Eduardo.

Com esta entrega em produção, a parte 3a (o carrossel em PDF) é refeita sobre a `main` nova: o ensaio de novo, o plano gerado de novo, e o caso "só texto, no sétimo adiamento" no `drenarUma`.

---

## Apêndice A — As mutações

O roteiro roda da raiz da cópia, com a árvore commitada e limpa, e com o `node_modules` da cópia. Cada mutação troca um trecho que aparece uma vez só, roda o arquivo de teste que a cobre e confere que o caso nomeado cai, pelo nome inteiro. As de integração rodam contra o banco de TESTE, uma de cada vez. No fim, a árvore volta limpa. São 33: as das FASES 1 a 5, com as do 225 e do 226. A FASE 6, no Passo 3, grava este bloco em `../mutar-li3a0.mjs`.

```js
// AS MUTAÇÕES DA 3a-0 (a hora de parar do dreno; os achados 223, 224 e 225, e a anotação 226), no molde de
// mutar-li3a.mjs: as das cinco fases do ensaio, a F1 (as regras puras), a F2 (a P1 no drainQueue), a F3 (a P2 no
// publicarDaFila), a F4 (a P3 e a P4: os drenos de clique e o começo da função) e a F5 (a ficha da reivindicação e o
// teste de fonte reforçado). Cada uma desfaz UMA trava, trocando um trecho exato de um arquivo (que
// tem de aparecer uma vez só), roda só o arquivo de teste que a cobre e confere que o caso NOMEADO cai, pelo nome
// inteiro. As de integração rodam contra o banco de TESTE, uma de cada vez. A árvore tem de estar commitada e limpa
// antes, e volta limpa no fim. O vitest roda por `npx --no-install` (achado 208), e a cópia tem de ter o node_modules.
//
// Uso, da raiz da cópia: node ../mutar-li3a0.mjs [prefixo-do-nome]
//                        node ../mutar-li3a0.mjs --conferir   (só confere que cada trecho aparece uma vez)
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const TESTES_URL = "postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes";
if (process.env.DATABASE_URL) throw new Error("RECUSADO: DATABASE_URL no ambiente");
if (!existsSync("node_modules/.bin/vitest")) throw new Error("RECUSADO: sem node_modules/.bin/vitest nesta cópia");
const status = () => execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim();
if (status() !== "") throw new Error("RECUSADO: árvore suja antes das mutações");

const PURO = { config: null };
const INTEG = { config: "vitest.integracao.config.ts" };

const T_TIPOS = { ...PURO, arquivo: "tests/fila-tipos.test.ts" };
const T_FONTE = { ...PURO, arquivo: "tests/dreno-com-prazo.test.ts" };
const T_HORA = { ...INTEG, arquivo: "testes-integracao/dreno-hora-de-parar.integracao.ts" };

const TIPOS = "lib/fila-tipos.ts";
const DRENO = "lib/queue-drain.ts";
const PUBLICAR = "app/publicar/actions.ts";
const CONTATOS = "app/contatos/actions.ts";
const CONVERSAS = "app/conversas/[id]/actions.ts";
const POST = "app/publicar/post/actions.ts";
const BONUS_ACAO = "app/bonus/publicar-actions.ts";
const BONUS_PROCESSO = "lib/bonus/publicar-processo.ts";

const CASO_DO_LACO =
  "depois do post do LinkedIn que leva o relógio além dos 40 s, as mensagens voltam à fila sem gastar tentativa e sem tocar no error";
const CASO_DO_CLIQUE =
  "a linha do LinkedIn vencida fica como estava, a mensagem do clique sai, e o rodapé arma o tique para o LinkedIn";
const CASO_DO_BONUS = "o bônus: a action passa o começo ao publicarNaFila, e ele o passa ao drenar, com a seleção do clique";
const COMECO = "  await exigirSessao();\n  const inicioDaFuncaoMs = Date.now();\n";

const MUTACOES = [
  // ---- F1: as regras puras ----
  {
    nome: "F1-1: a hora de parar sem a reserva",
    arq: TIPOS,
    de: "return p.agoraMs >= p.inicioDaFuncaoMs + p.orcamentoMs - RESERVA_PARA_TERMINAR_MS;",
    para: "return p.agoraMs >= p.inicioDaFuncaoMs + p.orcamentoMs;",
    teste: T_TIPOS,
    cai: "a reserva é de 15 s, e a hora de parar é o começo mais 40 s, contando o próprio instante",
  },
  {
    nome: "F1-2: os tipos do clique com o post do LinkedIn",
    arq: TIPOS,
    de: '=> t !== "publicacao_linkedin"',
    para: '=> t !== "nenhum"',
    teste: T_TIPOS,
    cai: "são os que o dreno conhece, na mesma ordem, menos o post do LinkedIn",
  },
  {
    nome: "F1-3: a linha do registro sem a contagem por tipo",
    arq: TIPOS,
    de: ".map(([t, n]) => `${t} ${n}`)",
    para: ".map(([t]) => t)",
    teste: T_TIPOS,
    cai: "diz a contagem e os tipos, em ordem alfabética, no plural e no singular",
  },

  // ---- F2: a P1 no drainQueue ----
  {
    nome: "F2-1: sem a conferência antes de reivindicar",
    arq: DRENO,
    de: "  const items = (passouDaHoraDeParar()\n    ? []",
    para: "  const items = (false\n    ? []",
    teste: T_HORA,
    cai: "o dreno que começa depois da hora de parar não pega nada: as linhas ficam como estavam, nada volta, e o tique é armado",
  },
  {
    nome: "F2-2: sem a conferência no laço",
    arq: DRENO,
    de: "    if (passouDaHoraDeParar()) {\n      await devolver([...naoComecados]);",
    para: "    if (false) {\n      await devolver([...naoComecados]);",
    teste: T_HORA,
    cai: CASO_DO_LACO,
  },
  {
    nome: "F2-3: a devolução gastando a tentativa",
    arq: DRENO,
    de: "attempts = greatest(attempts - 1, 0), not_before = now()",
    para: "attempts = attempts, not_before = now()",
    teste: T_HORA,
    cai: CASO_DO_LACO,
  },
  {
    nome: "F2-4: a devolução gravando o error",
    arq: DRENO,
    de: "attempts = greatest(attempts - 1, 0), not_before = now()",
    para: "attempts = greatest(attempts - 1, 0), not_before = now(), error = 'devolvido'",
    teste: T_HORA,
    cai: CASO_DO_LACO,
  },
  {
    nome: "F2-5: a devolução sem o filtro de sending",
    arq: DRENO,
    de: "where id = any($1::uuid[]) and status = 'sending'",
    para: "where id = any($1::uuid[])",
    teste: T_HORA,
    cai: "a devolução não ressuscita a linha que outro encerrou no meio do caminho: só volta o que ainda está em sending",
  },
  {
    nome: "F2-6: sem a linha do registro",
    arq: DRENO,
    de: "    if (linhas.length > 0) console.log(textoDaDevolucao(linhas.map((l) => l.kind)));",
    para: "",
    teste: T_HORA,
    cai: "a linha do registro diz só a contagem e os tipos: nenhum id da fila, nenhuma conta, nenhum contato e nenhum texto das mensagens",
  },

  // ---- F3: a P2 no publicarDaFila ----
  {
    nome: "F3-1: sem a conferência antes de cada filho",
    arq: DRENO,
    de: "    if (passouDaHoraDeParar()) return null;\n    const filho = await criarContainer(",
    para: "    const filho = await criarContainer(",
    teste: T_HORA,
    cai: "antes de um filho do carrossel: o filho já criado fica no payload, e a passada seguinte cria só os que faltam",
  },
  {
    nome: "F3-2: sem a conferência antes do pai",
    arq: DRENO,
    de: "  if (passouDaHoraDeParar()) return null;\n  return criarContainer(",
    para: "  return criarContainer(",
    teste: T_HORA,
    cai: "antes do pai do carrossel: os filhos ficam, e a passada seguinte cria só o pai",
  },
  {
    nome: "F3-3: sem a conferência antes do estado",
    arq: DRENO,
    de: "  // A HORA DE PARAR ANTES DA LEITURA DE ESTADO: o contêiner já está gravado.\n  if (passouDaHoraDeParar()) return devolver();",
    para: "  // A HORA DE PARAR ANTES DA LEITURA DE ESTADO: o contêiner já está gravado.",
    teste: T_HORA,
    cai: "antes da leitura de estado: o contêiner da imagem fica, e a passada seguinte só lê o estado e publica",
  },
  {
    nome: "F3-4: sem a conferência antes da cota",
    arq: DRENO,
    de: "    if (passouDaHoraDeParar()) return devolver();\n    const cota = cotaDePublicacao(",
    para: "    const cota = cotaDePublicacao(",
    teste: T_HORA,
    cai: "antes da cota: o estado já lido não conta consulta a mais, e a passada seguinte publica com o mesmo contêiner",
  },
  {
    nome: "F3-5: sem a conferência antes da publicação",
    arq: DRENO,
    de: "    if (passouDaHoraDeParar()) return devolver();\n    const resposta = await publicarContainer(",
    para: "    const resposta = await publicarContainer(",
    teste: T_HORA,
    cai: "antes da publicação: nada foi publicado, e a passada seguinte publica uma vez só, com o mesmo contêiner",
  },
  {
    nome: "F3-6: o devolvido contado de novo no laço, além do que o banco devolveu",
    arq: DRENO,
    de: '        else if (desfecho === "falhou") result.failed++;',
    para: '        else if (desfecho === "devolvido") result.devolvidos++;\n        else result.failed++;',
    teste: T_HORA,
    cai: "no post do Instagram: o post que outro dreno resgatou no meio do caminho não volta, e não conta como devolvido",
  },

  // ---- F4: os drenos de clique e o começo da função ----
  {
    nome: "F4-1: o publicar sem a seleção do clique",
    arq: PUBLICAR,
    de: "sem o post do LinkedIn, que pode levar a passada inteira.\n      await drainQueue({ inicioDaFuncaoMs, doClique: true });",
    para: "sem o post do LinkedIn, que pode levar a passada inteira.\n      await drainQueue({ inicioDaFuncaoMs });",
    teste: T_FONTE,
    cai: "app/publicar/actions.ts, publicar",
  },
  {
    nome: "F4-2: o das duas redes sem a seleção do clique",
    arq: PUBLICAR,
    de: "      await drainQueue({ inicioDaFuncaoMs, doClique: true });\n    } catch {\n      // O mesmo `catch` do `publicar`",
    para: "      await drainQueue({ inicioDaFuncaoMs });\n    } catch {\n      // O mesmo `catch` do `publicar`",
    teste: T_FONTE,
    cai: "app/publicar/actions.ts, publicarNasDuasRedes",
  },
  {
    nome: "F4-3: o enviarLote sem a seleção do clique",
    arq: CONTATOS,
    de: "await drainQueue({ inicioDaFuncaoMs, doClique: true });",
    para: "await drainQueue({ inicioDaFuncaoMs });",
    teste: T_FONTE,
    cai: "app/contatos/actions.ts, enviarLote",
  },
  {
    nome: "F4-4: o sendReply sem a seleção do clique",
    arq: CONVERSAS,
    de: "await drainQueue({ inicioDaFuncaoMs, doClique: true });",
    para: "await drainQueue({ inicioDaFuncaoMs });",
    teste: T_FONTE,
    cai: "app/conversas/[id]/actions.ts, sendReply",
  },
  {
    nome: "F4-5: o remarcar sem a seleção do clique",
    arq: POST,
    de: "else await drainQueue({ inicioDaFuncaoMs, doClique: true });",
    para: "else await drainQueue({ inicioDaFuncaoMs });",
    teste: T_FONTE,
    cai: "app/publicar/post/actions.ts, remarcarPublicacao",
  },
  {
    nome: "F4-6: o bônus sem a seleção do clique",
    arq: BONUS_PROCESSO,
    de: "await drenar({ inicioDaFuncaoMs, doClique: true });",
    para: "await drenar({ inicioDaFuncaoMs, doClique: false });",
    teste: T_FONTE,
    cai: CASO_DO_BONUS,
  },
  {
    nome: "F4-7: o publicar sem o começo da função",
    arq: PUBLICAR,
    de: `export async function publicar(formData: FormData): Promise<void> {\n${COMECO}`,
    para: "export async function publicar(formData: FormData): Promise<void> {\n  await exigirSessao();\n",
    teste: T_FONTE,
    cai: "app/publicar/actions.ts, publicar",
  },
  {
    nome: "F4-8: o enviarLote sem o começo da função",
    arq: CONTATOS,
    de: `export async function enviarLote(formData: FormData): Promise<void> {\n${COMECO}`,
    para: "export async function enviarLote(formData: FormData): Promise<void> {\n  await exigirSessao();\n",
    teste: T_FONTE,
    cai: "app/contatos/actions.ts, enviarLote",
  },
  {
    nome: "F4-9: o sendReply sem o começo da função",
    arq: CONVERSAS,
    de: `): Promise<{ error?: string }> {\n${COMECO}`,
    para: "): Promise<{ error?: string }> {\n  await exigirSessao();\n",
    teste: T_FONTE,
    cai: "app/conversas/[id]/actions.ts, sendReply",
  },
  {
    nome: "F4-10: o remarcar sem o começo da função",
    arq: POST,
    de: `export async function remarcarPublicacao(formData: FormData): Promise<void> {\n${COMECO}`,
    para: "export async function remarcarPublicacao(formData: FormData): Promise<void> {\n  await exigirSessao();\n",
    teste: T_FONTE,
    cai: "app/publicar/post/actions.ts, remarcarPublicacao",
  },
  {
    nome: "F4-11: o bônus sem o começo da função",
    arq: BONUS_ACAO,
    de: `export async function publicarCarrossel(pedido: unknown): Promise<AvisoDaPublicacao> {\n${COMECO}`,
    para: "export async function publicarCarrossel(pedido: unknown): Promise<AvisoDaPublicacao> {\n  await exigirSessao();\n",
    teste: T_FONTE,
    cai: CASO_DO_BONUS,
  },
  {
    nome: "F4-12: a seleção sempre com a lista inteira",
    arq: DRENO,
    de: "Array.from(opcoes.doClique ? TIPOS_DO_DRENO_DE_CLIQUE : TIPOS_QUE_O_DRENO_CONHECE),",
    para: "Array.from(TIPOS_QUE_O_DRENO_CONHECE),",
    teste: T_HORA,
    cai: CASO_DO_CLIQUE,
  },
  {
    nome: "F4-13: o rodapé com a lista do clique",
    arq: DRENO,
    de: "[Array.from(TIPOS_QUE_O_DRENO_CONHECE), HORIZONTE_DO_TIQUE_EM_SEGUNDOS, Array.from(FORMAS_NO_LINKEDIN)]",
    para: "[Array.from(TIPOS_DO_DRENO_DE_CLIQUE), HORIZONTE_DO_TIQUE_EM_SEGUNDOS, Array.from(FORMAS_NO_LINKEDIN)]",
    teste: T_HORA,
    cai: CASO_DO_CLIQUE,
  },

  // ---- F5: a leitura independente (o 225, o 226 e as notas) ----
  {
    nome: "F5-1: a devolução sem a ficha da reivindicação",
    arq: DRENO,
    de: "and claimed_at = $2::text::timestamptz",
    para: "and $2::text is not null",
    teste: T_HORA,
    cai: "no laço: a mensagem que outro dreno resgatou no meio do caminho não volta, e a que continua deste dreno volta",
  },
  {
    nome: "F5-2: a ficha mandada como timestamptz (o driver perde os microssegundos)",
    arq: DRENO,
    de: "and claimed_at = $2::text::timestamptz",
    para: "and claimed_at = $2::timestamptz",
    teste: T_HORA,
    cai: CASO_DO_LACO,
  },
  {
    nome: "F5-3: uma chamada do dreno fora das duas formas exatas",
    arq: CONTATOS,
    de: "await drainQueue({ inicioDaFuncaoMs, doClique: true });",
    para: "await drainQueue({ inicioDaFuncaoMs: Date.now(), doClique: true });",
    teste: T_FONTE,
    cai: "toda chamada do dreno é uma das duas formas exatas: a das rotas nas 3 rotas, e a do clique em todo o resto",
  },
  {
    nome: "F5-4: o dreno guardado numa variável",
    arq: CONTATOS,
    de: 'import { drainQueue } from "@/lib/queue-drain";',
    para: 'import { drainQueue } from "@/lib/queue-drain";\nconst drenarAgora = drainQueue;\nvoid drenarAgora;',
    teste: T_FONTE,
    cai: "nenhum dá outro nome ao dreno nem o guarda numa variável (fora o drenar do bônus)",
  },
  {
    nome: "F5-5: um arquivo novo chegando ao dreno por import relativo, com aspas simples",
    arq: "lib/avisos.ts",
    de: 'import { urlComFiltro, type FiltroDeCategoria } from "./categorias";',
    para: "import * as _dreno from './queue-drain';\nvoid _dreno;\nimport { urlComFiltro, type FiltroDeCategoria } from \"./categorias\";",
    teste: T_FONTE,
    cai: "são os 8 de sempre, por qualquer jeito de importar: as 3 rotas, as 4 actions de clique e o processo do bônus",
  },
];

const semCor = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");
/** Os nomes dos casos que caíram: as linhas do `×`, sem o sinal e sem a duração do fim. */
const casosQueCairam = (saida) =>
  saida
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("×"))
    .map((l) => l.replace(/^×\s*/, "").replace(/\s+\d+(\.\d+)?\s*m?s$/, "").trim());

const conferir = process.argv[2] === "--conferir";
const filtro = conferir ? undefined : process.argv[2];
const inicio = Date.now();
let ruins = 0;
let rodadas = 0;
for (const m of MUTACOES) {
  if (filtro && !m.nome.startsWith(filtro)) continue;
  rodadas++;
  const original = readFileSync(m.arq, "utf8");
  // A PASTA PODE ESTAR EM CRLF (autocrlf=true; o blob é LF). O trecho segue o fim de linha do arquivo.
  const crlf = original.includes("\r\n");
  const ajusta = (s) => (crlf ? s.replace(/\r?\n/g, "\r\n") : s);
  const de = ajusta(m.de);
  const vezes = original.split(de).length - 1;
  if (vezes !== 1) {
    console.log(`RUIM  ${m.nome}: o trecho aparece ${vezes} vez(es) em ${m.arq}`);
    ruins++;
    continue;
  }
  if (conferir) {
    console.log(`ÚNICO ${m.nome}`);
    continue;
  }
  const t0 = Date.now();
  let r;
  try {
    writeFileSync(m.arq, original.replace(de, () => ajusta(m.para)));
    const args = ["--no-install", "vitest", "run", ...(m.teste.config ? ["--config", m.teste.config] : []), m.teste.arquivo];
    const env = { ...process.env };
    delete env.CLAUDECODE;
    delete env.AI_AGENT;
    if (m.teste.config === INTEG.config) env.DATABASE_URL_TESTES = TESTES_URL;
    r = spawnSync("npx", args, { encoding: "utf8", shell: true, env, timeout: 10 * 60 * 1000, maxBuffer: 64 * 1024 * 1024 });
  } finally {
    writeFileSync(m.arq, original);
  }
  const saida = semCor(`${r.stdout}\n${r.stderr}`);
  const alvoOk = m.teste.config !== INTEG.config || saida.includes("ALVO: banco de TESTE");
  const cairam = casosQueCairam(saida);
  const caiu = cairam.includes(m.cai);
  const outros = cairam.filter((c) => c !== m.cai).length;
  const ok = alvoOk && r.status !== 0 && caiu;
  if (!ok) ruins++;
  const s = Math.round((Date.now() - t0) / 1000);
  console.log(
    `${ok ? "MORTA" : "RUIM "} ${m.nome}  (saída ${r.status}, alvo ok: ${alvoOk}, caiu o caso: ${caiu}, outros que caíram: ${outros}, ${s}s)`
  );
  if (!ok) console.log(`      casos que caíram: ${cairam.length ? cairam.join(" | ") : "nenhum"}`);
}
const total = Math.round((Date.now() - inicio) / 1000);
console.log(
  `${rodadas} mutações, ${ruins} ruins; árvore no fim: ${status() === "" ? "limpa" : "SUJA"}${conferir ? " (só a conferência dos trechos)" : `; ${Math.floor(total / 60)} min ${total % 60} s`}`
);
```
