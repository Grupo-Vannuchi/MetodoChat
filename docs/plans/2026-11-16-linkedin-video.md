# A parte 3b do LinkedIn, o vídeo em partes — Plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: `superpowers:subagent-driven-development`
> (recomendada) ou `superpowers:executing-plans`, fase por fase. Os passos usam caixa de
> seleção (`- [ ]`) para acompanhar.

**Objetivo:** o reels da tela de compor, em MP4, sai também no perfil pessoal do LinkedIn, como vídeo. Ele pode sair só no LinkedIn ou nas duas redes. O vídeo sobe em partes, uma etapa por passada da fila, e sai alguns minutos depois do clique.

**Arquitetura:**
- **As regras puras** (`lib/linkedin-publicacao.ts`):
  - a forma `"video"`: um arquivo só, MP4 pela extensão do caminho, e a recusa `video_nao_mp4`; o rótulo "Vídeo";
  - o `oVideoVaiAoLinkedin`: só o `video/mp4`, que é o que a API aceita;
  - o estado do envio, lido do payload (`estadoDoEnvioDoVideo`); o progresso; e a próxima etapa (a reserva, cada parte, o fim e o post);
  - os dois tetos: o das passadas (o número de partes, mais a reserva, o fim e o post, mais 6 de folga) e o da idade (2 h desde a primeira passada);
  - o erro de uma parte: o 401 e o 403 são a parte recusada, com texto próprio; os passageiros são os de hoje;
  - o aviso do vídeo na fila e a nota da tela.
- **O cliente do LinkedIn** (`lib/linkedin.ts`):
  - **toda chamada vai com `redirect: "error"`.** O redirecionamento recusado é o `STATUS_RECUSADO_PELO_PAINEL` (−1, permanente);
  - `reservarVideo` pede o vídeo com a pessoa dona e o tamanho, e confere as partes: cada endereço é do LinkedIn, e as partes vão de 0 ao fim, sem buraco nem sobra;
  - `enviarParteDoVideo` faz um `PUT` SEM o token, binário, com teto de 15 s; ele exige o `ETag` e erra com texto fixo, sem o endereço do envio;
  - `finalizarVideo` leva os `ETags` na ordem das partes;
  - `estadoDoVideo` é o `GET` do fim perdido;
  - o `criarPost` leva o vídeo e o título, e marca o `PROCESSING_FAILED` (`LinkedinError.processamentoFalhou`).
- **O bucket** (`lib/bucket.ts`):
  - o tamanho vem do `HEAD`, sem cache;
  - a faixa de uma parte só vale com `206`, o `Content-Range` igual ao pedido e o tamanho exato; o `200` é erro;
  - a cópia é feita no próprio servidor do Storage (`POST /storage/v1/object/copy`).
- **A fila do LinkedIn** (`lib/linkedin-fila.ts`): o ramo do vídeo faz UMA etapa por passada.
  - A primeira passada fica gravada, e o teto de idade conta dela.
  - Os dois tetos encerram a linha com o motivo. A passada do post fica fora do teto das passadas (o 241).
  - A etapa só começa se o pior caso dela termina antes da hora de parar, aos 40 s. Os piores casos, com 2 s de folga (o 242):
    - a reserva, 22 s;
    - cada parte, 27 s;
    - o fim, 22 s, porque são duas chamadas (o 240);
    - o post, 12 s.
  - A passada é contada, e a etapa roda. O progresso é lido do payload gravado (o `returning`), e a linha só volta "com avanço", com as tentativas zeradas, se ele cresceu.
  - **O fim perdido** (a marca do fim sem o fim gravado) consulta o estado. `AVAILABLE` e `PROCESSING` contam como fim. A consulta que falha de passagem devolve a linha (o 244).
  - **O post:**
    - a mídia não pronta espera 60 s sem gastar tentativa, até 10 consultas;
    - o `PROCESSING_FAILED` encerra a linha com o motivo;
    - o arquivo só sai do bucket no `sent`.
- **As actions** (`app/publicar/actions.ts`, `lib/linkedin-copia.ts`):
  - **só no LinkedIn**, o reels vai como a forma `"video"`, e o "agora" faz a primeira etapa (a reserva) no clique;
  - **nas duas redes**, o LinkedIn leva uma cópia do MP4, feita no servidor do Storage, e a chave continua pelo original;
  - no "agora" das duas, o clique só arma o tique da linha do LinkedIn (o 232), para não tirar tempo do Instagram.
- **O Remarcar** (`app/publicar/post/actions.ts`) tira a `primeira_passada_em` só do vídeo do LinkedIn (o 245). A linha continua de onde parou.
- **A tela de compor** (`app/publicar/enviador.tsx`, `lib/redes-do-post.ts`):
  - o reels MP4 liga a caixinha do LinkedIn;
  - o MOV a desliga, com "O LinkedIn só aceita vídeo MP4.";
  - a nota do vídeo aparece, e o aviso diz que o vídeo sobe em partes e sai em alguns minutos.
- **As Publicações** (`lib/post-da-fila.ts`) mostram "LinkedIn · Vídeo", sem capa e com o ▶ enquanto ele não sai; a página do post desenha o arquivo como vídeo.
- **Não mudam:** o `lib/queue-drain.ts`, o `lib/fila-tipos.ts`, as migrações, os scripts e os `package*` (a guarda de toda fase). A 3-0 e a 3a-0 já deram ao dreno o predicado da forma conhecida e a hora de parar, e o vídeo entra pela lista única das formas.

**Stack:** a do projeto, no Next.js 16.4.3: Vitest (testes puros, de tela e de integração) e o Postgres no container para a integração.

**O desenho:** `scratchpad/desenho-li3b.md` v3 (`a385412a267751f8`), liberado pela auditoria em 16/11; a v1 e a v2 estão guardadas.
- O mapa: `scratchpad/mapa-li3b.md` (`13141e883ebc2638`).
- As notas: `scratchpad/notas-plano-li3b.md` (`0afb387616bf7246`).
- A spec: `docs/specs/2026-11-06-linkedin-no-perfil.md` (a emenda de 09/11, a parte 3).

**As decisões do Eduardo:**
- **Caixa de 11/11, às 14:55:42.887Z** (jsonl da sessão do DEV, linha 105291): a parte 3 em 4 entregas (3-0, 3a, 3b e 3c), e "O começo do texto" como título do documento.
- **Caixa de 16/11, às 14:56:34.180Z** (linha 116202): "Começar o vídeo (Recomendado)".
- **Caixa de 16/11, às 15:13:13.464Z** (linha 116324):
  - "Sim, depois de testar (Recomendado)": o vídeo nas duas redes já nesta entrega, depois da sonda da cópia;
  - "O começo do texto (Recomendado)": o título do vídeo;
  - "Sim, como hoje (Recomendado)": o teste na produção no fim da prova.
- **Caixa de 16/11, às 15:17:15.741Z** (linha 116472): "Pode rodar (Recomendado)", a sonda da cópia no Storage da produção. A sonda deu `200`, e nada ficou no bucket (conferido pela auditora na `storage.objects`).
- **O "só MP4" não é uma escolha:** é a regra da API ("File format: MP4."; o desenho, §2).
- **O 245 pela (A), sem caixa:** a auditora decidiu que tirar a marca no Remarcar é o §3.7 do desenho liberado ("a linha continua de onde parou").

**A base:** a `main` em `a5cd8d4`, com a 3a (o carrossel em PDF) em produção desde 16/11, às 13:47:04Z (PR #37).
- O LinkedIn está conectado na produção desde 16/11, às 14:02:09Z (vence perto de 15/01/2027).
- Os tiques do QStash da produção foram vistos `DELIVERED` em 16/11 (o 106, resolvido).

**A auditoria (`metodochat-ae` em 16/11, `metodochat-de` em 17/11)** conferiu cada fase do ensaio pelo patch-id e pela leitura do código. Os achados desta entrega, com os do agente independente sobre o plano (do 249 ao 259):

| Nº | Classe | O que é | Onde entrou |
|---|---|---|---|
| 230 | CORRIGIR | o progresso pelo payload gravado, o `ETag` pelo índice, a reserva única, o teto duro e as tentativas zeradas no avanço | F1 (o progresso e os tetos) e F4 (as gravações e o avanço) |
| 231 | CORRIGIR | uma etapa por passada, terminando antes da hora de parar | F4 (`aEtapaDoVideoCabe`), com um caso no `dreno-hora-de-parar` |
| 232 | CORRIGIR | o clique das duas redes não drena o LinkedIn com vídeo | F5 |
| 233 | ANOTAR | o fim perdido e a consulta do estado | F2 (`estadoDoVideo`) e F4 |
| 234 | ANOTAR | as partes sem o `Authorization`, o `redirect: "error"` e o texto próprio do 401/403 da parte | F1, F2 e F4 |
| 235 | ANOTAR | a cópia órfã e a cópia guardada pela linha `failed` | os limites conhecidos |
| 236 | ANOTAR | a faixa conferida, o `update` único, o erro só com o status e o Remarcar no meio | F3, F2, F4 e F6-bis |
| 237 | CORRIGIR | a passada do post com a mídia não pronta não soma no teto das passadas | F4 |
| 238 | CORRIGIR | a classificação dos erros de hoje, com o 409, o 429 e os 5xx passageiros | F1 e F4 |
| 239 | ANOTAR | o endereço público serviu um arquivo já apagado (cache provável, não medido); a limpeza se prova pela `storage.objects` | os testes (a lista do bucket falso) e a prova |
| 240 | CORRIGIR | o pior caso do fim conta as duas chamadas (o fim e a consulta do estado) | F4-bis |
| 241 | CORRIGIR | a etapa é decidida antes do teto, e o post fica fora do teto das passadas | F4-bis |
| 242 | ANOTAR | 2 s de folga por etapa, e a conta com `<` | F4-bis |
| 243 | ANOTAR | o erro de uma parte não leva o endereço do envio | F4-bis |
| 244 | ANOTAR | a consulta do fim perdido que falha de passagem devolve a linha | F4-bis |
| 245 | ANOTAR | o Remarcar para mais de 2 h depois encerrava a linha pela idade | F6-bis |
| 246 | ANOTAR | o caso do 231 prova um lado só; o outro fica na aritmética pura, que a folga do 242 deixa conservadora | sem mudança |
| 247 | ANOTAR | 3 erros passageiros seguidos, sem avanço, encerram a linha | F4-bis (o caso) |
| 248 | ANOTAR | o caso da migração 012 cai às vezes pelo corte no segundo | o plano à parte, com o 218 e o 227 |
| 249 | CORRIGIR | a linha da prova em `sending` não sai pela tela e seria retomada depois do merge | FASE 9: o passo "A linha em `sending`", com as duas saídas pela caixa |
| 250 | CORRIGIR | o "nenhuma linha aberta" contado no banco inteiro, e não pelos ids acompanhados | FASE 9: a parte (2) da leitura da auditoria, nos Passos 5, 6, 7 e 8 |
| 251 | CORRIGIR | no preview sem o cookie, vale a primeira conta do login | FASE 9: o endereço exato do preview, o @ conferido na tela e a conta conferida em cada leitura |
| 252 | CORRIGIR | o relógio sem um passo | FASE 9: o "Sincronizar agora" e a medida da auditoria (< 5 s), antes do 1º clique e de cada Remarcar; a linha do Remarcar recusado na tabela |
| 253 | CORRIGIR | ninguém encarregado dos arquivos que ficam no bucket | FASE 9: o passo "Os arquivos que ficam", e o `skipped` aceito como fim |
| 254 | ANOTAR | o teste na produção sem o arquivo e sem o "se divergir"; o rollback com o vídeo em `sending` | FASE 9: os Passos 10 e 11 |
| 255 | ANOTAR | faltavam casos na tabela | FASE 9: a linha "qualquer outro `failed`" |
| 256 | ANOTAR | cada Remarcar regrava a primeira passada | FASE 9: as regras do Passo 4 |
| 257 | ANOTAR | o commit provado é o do merge; o deploy com erro | FASE 9: os Passos 8 e 9 |
| 258 | ANOTAR | o dreno do clique manda as mensagens vencidas pelo código do preview (o 211); o "~20 s" contra o "~22 s" | FASE 9: a caixa da prova e as regras do Passo 4 |
| 259 | ANOTAR | o roteiro do Eduardo: o arquivo, os cliques e os textos conferidos contra os limites | FASE 9: os Passos 3, 5 e 11 |

**Ensaio do plano (16/11):** o código deste plano foi feito e testado fase a fase numa cópia isolada (`git worktree`, sem push, branch local `ensaio-video-linkedin`, saída da `a5cd8d4`, com `npm ci` próprio e `.env.local` vazio). Cada fase teve o RED medido com o código separado, o GREEN, as três suítes inteiras em registro, a guarda vazia e a conferência da auditora. A ordem do git é a ordem das fases: a F4-bis veio depois da F5, porque a revisão do agente na F4 chegou com a F5 pronta.

| Fase | Commit | Patch-id | Arquivos | O que entra |
|---|---|---|---|---|
| F1 | `4d7b139` | `28529a49ee97` | `lib/linkedin-publicacao.ts`, `tests/linkedin-video-regras.test.ts` | as regras puras do vídeo |
| F2 | `395fdb3` | `8705ede51b3f` | `lib/linkedin.ts`, `lib/linkedin-publicacao.ts`, `tests/linkedin-rest.test.ts`, `tests/linkedin-post.test.ts` | o cliente do vídeo e o `redirect: "error"` |
| F3 | `2467ffe` | `be1322ea0304` | `lib/bucket.ts`, `tests/bucket-video.test.ts` | o tamanho, a faixa e a cópia no servidor |
| F4 | `58a7c0b` | `48c8da1398de` | `lib/linkedin-fila.ts`, `lib/linkedin-publicacao.ts`, `lib/linkedin.ts`, `tests/linkedin-forma-conhecida.test.ts`, `tests/linkedin-post.test.ts`, `tests/linkedin-rest.test.ts`, `testes-integracao/linkedin-video.integracao.ts` (novo), `testes-integracao/dreno-hora-de-parar.integracao.ts`, `testes-integracao/dreno-forma-desconhecida.integracao.ts`, `testes-integracao/linkedin-telas.integracao.ts` | o ramo do vídeo na fila |
| F5 | `f60321c` | `3de3447832a3` | `app/publicar/actions.ts`, `lib/linkedin-copia.ts`, `tests/linkedin-copia.test.ts`, `testes-integracao/linkedin-compor.integracao.ts`, `testes-integracao/linkedin-duas-redes.integracao.ts` | as actions, a cópia e o 232 |
| F4-bis | `36d7a06` | `1cc776cf4c5a` | `lib/linkedin-fila.ts`, `lib/linkedin.ts`, `testes-integracao/linkedin-video.integracao.ts` | o 240, o 241, o 242, o 243, o 244 e o 247 |
| F6 | `16b3ad1` | `601a079771da` | `app/publicar/actions.ts`, `app/publicar/enviador.tsx`, `lib/linkedin-publicacao.ts`, `lib/redes-do-post.ts`, `tests/redes-do-post.test.ts`, `tests/linkedin-video-regras.test.ts`, `testes-dom/publicar-compositor-linkedin.dom.tsx`, `testes-integracao/linkedin-compor.integracao.ts`, `testes-integracao/linkedin-duas-redes.integracao.ts` | a tela, a nota e o aviso do vídeo |
| F6-bis | `dce3e18` | `99a765366768` | `app/publicar/post/actions.ts`, `testes-integracao/linkedin-telas.integracao.ts` | o Remarcar do vídeo (o 245) |
| F7 | `4a17402` | `91621a82d970` | `lib/post-da-fila.ts`, `tests/post-da-fila.test.ts`, `testes-integracao/linkedin-telas.integracao.ts` | as Publicações |
| F7-bis | `f1bad7c` | `e69221ff369c` | `testes-integracao/linkedin-video.integracao.ts` | só teste: a décima consulta ainda espera |
| F7-ter | `f5bb171` | `e894b13801dd` | `tests/bucket-video.test.ts` | só teste: o 200 da faixa é recusado pelo status |
| F7-quater | `548bf5d` | `ad446f7bf641` | `testes-integracao/linkedin-duas-redes.integracao.ts` | só teste: no "agora" das duas redes, a linha do vídeo fica intocada de verdade (o 232) |

As mensagens dos commits são as deste plano. Os registros estão na pasta de trabalho do DEV: `el3b-f*-*.log`, `el3b-mut-*.log` e os das suítes de cada fase.

Os números do fim, medidos na cópia limpa com os comandos deste plano (entre parênteses, os da base `a5cd8d4`):
- o `tsc` e o lint dos arquivos de cada fase limpos em todas as fases;
- a guarda contra a `a5cd8d4` (nada em `lib/queue-drain.ts`, `lib/fila-tipos.ts`, `migrations`, `scripts` e `package*`) vazia em todas as fases;
- testes puros: "Test Files 162 passed (162)" e "Tests 3880 passed (3880)" (160 arquivos e 3 828 casos); testes de tela: "Test Files 36 passed (36)" e "Tests 350 passed (350)" (36 e 347);
- a varredura sem vazamento e o build com o Next 16.4.3 ("MIGRAÇÃO PULADA", fora da produção);
- a integração no container: "Test Files 80 passed (80)" e "Tests 1018 passed | 8 skipped (1026)" (79, 982 e 8);
- as 65 mutações do Apêndice A (23 delas de integração e 3 de tela) derrubaram, cada uma, o caso esperado: "65 mutações, 0 ruins; árvore no fim: limpa; 4 min 50 s", com o roteiro de sha256 `c769fa1109b06af1` (659 linhas);
- a guarda do diff (FASE 8, Passo 5) mostra só os 25 arquivos do mapa: "25 files changed, 2375 insertions(+), 90 deletions(-)";
- a aplicação do zero dos blocos deste plano numa cópia nova saída da `a5cd8d4` (16/11, 18:30Z): "3 criados, 40 diffs aplicados, 0 apagados, 0 gerados; 25 arquivos conferidos, 0 diferentes", contra a `548bf5d` do ensaio; e a da auditoria, pelo hash dos blobs: 744 iguais.

**O que o ensaio achou:**
- **O `fetch` do Node com `redirect: "error"` recusa o 3xx sem ir ao destino.** Um caso com dois servidores de verdade (um `307`) mostra que a parte não chega ao endereço do redirecionamento. A causa vem no `cause` do erro ("redirect") e vira o −1. É um desvio aceito na F4: o `STATUS_RECUSADO_PELO_PAINEL` mora em `lib/linkedin.ts`.
- **A primeira passada é gravada na primeira vez que o ramo roda,** mesmo sem tempo para a etapa (desvio aceito na F4). Assim o teto de idade também limita a espera sem tempo, que não conta passada.
- **O `jsonb` vai cru.** O `gravarAReserva` com `JSON.stringify` gravava um texto dentro do `jsonb`, e o teste de integração pegou.
- **Os testes da 3-0 que usavam `"video"` como a forma desconhecida** passaram a usar `"enquete"`: o vídeo agora é conhecido.
- **As mutações acharam três lacunas de teste,** fechadas com fases só de teste:
  - a F7-bis: o teste das consultas só prendia o teto por cima, e o vídeo com o teto de 5 do documento passava;
  - a F7-ter: o `200` sem `Content-Range` caía na trava seguinte, e a trava do status ficava solta;
  - a F7-quater: o caso do 232 só olhava `pending`, nenhum URN e nenhum pedido ao LinkedIn. Com o clique drenando o vídeo, a reserva falhava antes, no `HEAD` do bucket falso, e o caso passava. Agora ele confere que o ramo do vídeo não rodou: sem `error`, sem a marca da primeira passada e sem passada contada.
- **O 248 apareceu numa suíte de integração da F5:** o caso da migração caiu uma vez e passou nas rodadas seguintes. A causa, medida pela auditora, é o corte no segundo da `migrations/012-migrar-email-para-campos.sql:183` contra o `Date.now()` do teste. Não se mexe nele nesta entrega.
- **A F5 foi ao commit sozinha.** As mudanças da F4-bis já estavam na árvore; elas foram separadas com `git stash`, a F5 foi testada de novo e foi ao commit, e a F4-bis virou a fase seguinte.
- **No compositor, o reels tem o campo "Arquivo",** e não "Arquivos" como o carrossel: os casos de tela do vídeo usam um ajudante próprio.

**Os limites conhecidos (sem código nesta entrega):**
- **O vídeo de 50 MiB leva ~16 passadas, ~5 a 6 minutos.** Ele sai em minutos, e não no clique.
- **O painel não confere o codec.** Um MP4 que o LinkedIn não processa encerra a linha com o motivo ("confira se ele é um MP4 comum").
- **O teto é o do bucket (50 MiB),** e não o do LinkedIn (500 MB).
- **A cópia órfã de até 50 MiB** (a cópia que estoura o nosso teto e termina no Supabase) **e a cópia guardada pela linha `failed`** (235).
- **O redirecionamento recusado passa a dar −1 (permanente) em TODA chamada ao LinkedIn:** a reserva, o fim, o post, a imagem, o documento e a troca do código do convite. Antes da 3b, o `fetch` seguia o redirecionamento. O caminho do convite só é exercido na próxima conexão, que não está na prova. Isso vai ao corpo do PR.
- **O Remarcar para depois de ~30 dias da reserva** cai na parte recusada (os endereços de envio vencem), com "publique de novo". Não medido: se a sessão de envio vence antes disso no meio do envio.
- **O 239:** um `HEAD` ou `GET` no endereço público não prova que um arquivo saiu do bucket. A prova conta pela `storage.objects`.
- **O 248:** o caso da migração 012 cai às vezes pelo corte no segundo. Vai ao plano à parte, com o 218 e o 227.
- **O clique "agora" só no LinkedIn faz a reserva** e pode levar até ~22 s nela (o bucket e o LinkedIn, 10 s cada, e a folga).
- **Até o merge, a produção (`a5cd8d4`) não toca a linha de vídeo que a prova cria pelo preview:**
  - o dreno só reivindica e só resgata as formas que conhece: o de uma linha em `lib/queue-drain.ts:1119`, e o do lote, com o resgate dos 3 minutos, em `:1257`, na `a5cd8d4`. A lista da produção não tem o vídeo (`lib/linkedin-publicacao.ts:58`, na `a5cd8d4`);
  - as Publicações da produção mostram essa linha como "LinkedIn · Forma não reconhecida" (`lib/linkedin-publicacao.ts:109`, na `a5cd8d4`).
- **Num rollback para a `a5cd8d4`,** uma linha de vídeo em `sending` fica presa, porque o resgate também exclui a forma que ela não conhece. Uma linha `pending` fica intocada.
- **A memória da função não foi medida.** Cada passada leva uma parte só na memória; o tamanho das partes vem do LinkedIn e é lido na prova.
- **A vazão do bucket e a do envio ao LinkedIn, a partir da Vercel, não foram medidas.** A prova lê os tempos de cada etapa.
- **Os previews antigos da Vercel seguem com o banco da produção** (a nota de 16/11).

## Restrições globais

- **A cópia tem caminho absoluto fixo**, fora da pasta do projeto, que tem o `.env.local` de produção:
  - `C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-video"`;
  - todo bloco de comandos abaixo começa por essa linha e por `cd "$C" || exit 1`, porque a sessão não guarda o `cd` fora da pasta do projeto;
  - o `..` dos comandos é a pasta de trabalho do DEV, onde ficam o `varrer-texto.mjs` (sha256 `f350d19f515e854f`) e o roteiro das mutações.
- **Branch:** `linkedin-video`, saída da `a5cd8d4` (a `main` com a 3a), sem upstream.
  - Nunca commitar nem empurrar na `main`: ela não está protegida, e um push nela dispara o deploy na Vercel.
  - Todo commit vem depois de `test "$(git branch --show-current)" = linkedin-video &&`.
- **`git add` com caminho explícito.** Nunca `-A` nem `.`.
- **Commit no estilo do Vinícius:** uma frase dizendo o efeito, sem prefixo, sem rodapé de IA.
  - Autor: Eduardo Kobal <162614913+Eduardokobal@users.noreply.github.com>.
  - Nunca `git config` numa worktree.
- **Antes de cada commit**, o `node ../varrer-texto.mjs` nos arquivos da fase (cada um "limpo"), no mesmo comando do commit, com `&&` e sem nada entre os dois.
- **O commit é um comando à parte**, depois de ler a saída dos testes.
- **A regra de divergência:** se o RED, o GREEN, o patch-id, a guarda ou a aplicação não baterem com o plano, pare. Não ajuste o teste nem o código: mande a saída inteira à auditoria e espere.
- **O 218 e o 227 em toda rodada da suíte pura:** na primeira suíte de uma cópia recém-instalada, três casos de outros arquivos podem estourar o tempo pela primeira carga do disco:
  - o `beforeAll` de `tests/proxy-matcher.test.ts` (10 s, "Hook timed out in 10000ms");
  - as duas varreduras de `tests/vocabulario-da-fila.test.ts` e `tests/paleta.test.ts` (5 s, "Test timed out in 5000ms").
  - O procedimento: rodar o arquivo sozinho e a suíte inteira de novo. Se cair outra vez numa rodada que não seja a primeira, é divergência, e a saída inteira vai à auditoria.
- **O 248 em toda rodada da integração inteira:** o caso "o contato NÃO é perguntado de novo logo depois da migração — e volta à fila em 30 dias" (`testes-integracao/migracao-dos-dados-legados.integracao.ts`) pode cair pelo corte no segundo da migração 012. O procedimento: rodar o arquivo sozinho e a integração inteira de novo. Se cair outra vez, é divergência.
- **A saída inteira de toda suíte (pura, de tela e de integração) vai para um registro**, sem filtro: os comandos abaixo passam por `2>&1 | tee ../pl3b-<fase>-<rodada>.log`.
- **Fim de linha:** os diffs deste plano estão em LF. A cópia é feita com `git -c core.autocrlf=false`, e o `git apply --ignore-whitespace` serve se ela não for.
- **Os arquivos desta entrega são os 25 do mapa abaixo, e mais nenhum.** O `lib/queue-drain.ts`, o `lib/fila-tipos.ts`, as migrações, os scripts e os `package*` NÃO mudam, e a guarda confere isso em cada fase, contra a `a5cd8d4`. O cuidado do motor vale para o ramo do LinkedIn na fila (auditoria, DEV e agentes).
- **Os testes da 3-0, da 3a-0 e da 3a continuam valendo:** os três da 3-0 trocam `"video"` por `"enquete"` como a forma que o código não conhece; no arquivo da 3a-0, só entra o caso novo do vídeo (nenhuma linha sai).
- **Nenhuma migração.** O deploy tem de dizer "Nada a aplicar: as 26 migrações já constam no registro."
- **Toda escrita em produção** (a prova no preview grava no banco de produção e publica nas redes) pede, nesta ordem:
  1. o OK do Eduardo pela caixa;
  2. a hora mandada à auditoria;
  3. o "pode" dela.
- **O DEV não se conecta à produção.** As leituras da base (antes da prova, depois da prova, antes do merge e na primeira hora) são da auditoria, com as ferramentas dela, só lendo. As duas exceções são da FASE 9, e cada uma pede a caixa do Eduardo, a hora mandada à auditoria e o "pode" dela, com o roteiro lido antes (o 264):
  - a linha da prova presa em `sending` (o passo "A linha em `sending`");
  - os arquivos que ficam no bucket (o passo "Os arquivos que ficam").
- **Uma rodada de integração de cada vez**, sempre com `DATABASE_URL_TESTES=postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes`.
  - **O `docker ps` vem antes de cada rodada de integração**: o container para entre um dia e outro. Se ele estiver parado, `docker start metodochat-banco-de-teste` e espere "healthy".
  - Toda rodada tem de imprimir `[rede-global] ALVO: banco de TESTE`.
  - Nunca rode com a variável vazia: ela cai na `DATABASE_URL`, que é **produção**.
  - **A dica que a própria rodada imprime, "Rode sem DATABASE_URL_TESTES antes do merge"** (`testes-integracao/rede-global.ts:41`), **não vale nesta entrega**: sem a variável, a integração roda contra a produção.
- **`npx --no-install`** sempre (achado 208), e o `npm ci` da FASE 0 antes de qualquer teste.
- **A suíte pura inteira roda no fim de toda fase**, além dos arquivos da fase.
- **`next build` sem as variáveis de agente:** `env -u CLAUDECODE -u AI_AGENT ...`, e `git diff AGENTS.md` depois.
- **O token, o code e o segredo do LinkedIn nunca vão para o chat nem para registro.** Nem o endereço de envio das partes, que leva uma assinatura.
- **No corpo do PR**, nenhuma arroba solta, nem e-mail, nem nome de pessoa ou de conta: o repositório é público.

## Mapa dos arquivos

| Arquivo | O que faz | Fase |
|---|---|---|
| `lib/linkedin-publicacao.ts` | a forma `"video"`, o "só MP4", o estado do envio, o progresso, a próxima etapa, os tetos, o erro da parte, o payload do vídeo, o corpo do post com o vídeo, o `PROCESSING_FAILED`, o aviso e a nota | 1, 2, 4 e 6 |
| `tests/linkedin-video-regras.test.ts` (novo) | as regras puras do vídeo e o aviso | 1 e 6 |
| `lib/linkedin.ts` | o `redirect: "error"` em toda chamada, a reserva, a parte sem o token, o fim, o estado, o −1 e o erro da parte sem o endereço | 2, 4 e 4-bis |
| `tests/linkedin-rest.test.ts` | a reserva, a parte, o fim, o estado, o `307` real e o −1 | 2 e 4 |
| `tests/linkedin-post.test.ts` | o corpo do post com o vídeo; a forma e o payload do vídeo | 2 e 4 |
| `lib/bucket.ts` | o tamanho pelo `HEAD`, a faixa exata e a cópia no servidor | 3 |
| `tests/bucket-video.test.ts` (novo) | o tamanho, a faixa e a cópia | 3 e 7-ter |
| `lib/linkedin-fila.ts` | o ramo do vídeo: uma etapa por passada, os tetos, o fim perdido e a espera da mídia | 4 e 4-bis |
| `testes-integracao/linkedin-video.integracao.ts` (novo) | o vídeo pela fila, com o LinkedIn e o bucket falsos | 4, 4-bis e 7-bis |
| `testes-integracao/dreno-hora-de-parar.integracao.ts` | o caso do 231: a parte que não termina antes da hora de parar não começa | 4 |
| `testes-integracao/dreno-forma-desconhecida.integracao.ts` | a forma desconhecida passa a ser `"enquete"` | 4 |
| `testes-integracao/linkedin-telas.integracao.ts` | idem; o Remarcar do vídeo; o vídeo nas Publicações | 4, 6-bis e 7 |
| `tests/linkedin-forma-conhecida.test.ts` | o vídeo na lista das formas conhecidas | 4 |
| `app/publicar/actions.ts` | o reels no LinkedIn, a cópia, o 232 e a forma no aviso | 5 e 6 |
| `lib/linkedin-copia.ts` | a cópia do vídeo no servidor | 5 |
| `tests/linkedin-copia.test.ts` | idem | 5 |
| `testes-integracao/linkedin-compor.integracao.ts` | o vídeo só no LinkedIn; o aviso | 5 e 6 |
| `testes-integracao/linkedin-duas-redes.integracao.ts` | o vídeo nas duas redes e o 232; o aviso | 5 e 6 |
| `app/publicar/enviador.tsx` | o MOV, a forma vídeo e a nota | 6 |
| `lib/redes-do-post.ts` | o reels liga o LinkedIn; o MOV o desliga; o aviso das duas redes | 6 |
| `testes-dom/publicar-compositor-linkedin.dom.tsx` | os casos de tela do vídeo | 6 |
| `tests/redes-do-post.test.ts` | as caixinhas e o aviso das duas redes | 6 |
| `app/publicar/post/actions.ts` | o Remarcar tira a marca da primeira passada do vídeo | 6-bis |
| `lib/post-da-fila.ts` | o vídeo nas Publicações | 7 |
| `tests/post-da-fila.test.ts` | idem | 7 |

São 25 arquivos, 3 deles novos.

---

### FASE 0 — Começar da branch certa

- [ ] **Passo 1: a branch, saída da `main`, no caminho fixo**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-video"
test ! -e "$C" || { echo "a pasta da cópia já existe: pare"; exit 1; }
cd "$HOME/Projetos/metodochat" || exit 1
git fetch origin
test "$(git rev-parse --short origin/main)" = a5cd8d4 || { echo "a main mudou: pare"; exit 1; }
git -c core.autocrlf=false worktree add -b linkedin-video "$C" a5cd8d4
cd "$C" || exit 1
git rev-parse --abbrev-ref @{upstream} 2>/dev/null || echo "sem upstream"   # sem upstream: nada sobe sem querer
git branch --show-current                          # linkedin-video
: > .env.local                                     # vazio: nenhum banco de produção na cópia
npm ci
docker ps --format '{{.Names}} {{.Status}}' | grep metodochat-banco-de-teste   # healthy; senão, docker start
```

Se `origin/main` não estiver em `a5cd8d4`, pare: a base mudou, e o plano precisa ser conferido de novo.

- [ ] **Passo 2: o plano na branch.** O primeiro commit da branch é este plano, em `docs/plans/2026-11-16-linkedin-video.md`.

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-video"; cd "$C" || exit 1
node ../varrer-texto.mjs docs/plans/2026-11-16-linkedin-video.md && test "$(git branch --show-current)" = linkedin-video && git add docs/plans/2026-11-16-linkedin-video.md && git commit -m "O plano da parte 3b do LinkedIn: o reels em MP4 sai também no LinkedIn, como vídeo em partes, só lá ou nas duas redes"
```

---

### FASE 1 — As regras puras do vídeo: só MP4, o progresso e a próxima etapa, os dois tetos e o erro da parte

**Arquivos:** `lib/linkedin-publicacao.ts`, `tests/linkedin-video-regras.test.ts`.

- [ ] **Passo 1: os testes**

Crie `tests/linkedin-video-regras.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  desfechoDoErroDaParte,
  oVideoVaiAoLinkedin,
  progressoDoVideo,
  proximaEtapaDoVideo,
  recusaDoPedidoNoLinkedin,
  rotuloDoPostNoLinkedin,
  TEXTO_DO_VIDEO_QUE_NAO_E_MP4,
  textoDaRecusaNoLinkedin,
  tetoDePassadasDoVideo,
  tetoDoVideoAtingido,
  IDADE_MAXIMA_DO_VIDEO_MS,
  type EstadoDoEnvioDoVideo,
} from "@/lib/linkedin-publicacao";

// AS REGRAS PURAS DO VÍDEO EM PARTES NO LINKEDIN (a parte 3b; o desenho, scratchpad/desenho-li3b.md, v3): a forma e o
// rótulo, o "só MP4", o progresso e a próxima etapa (o 230), os dois tetos (o 230 e o 237) e o erro da parte, que vai
// sem o token (o 234 e o 238). Elas não mudam nada do que já sai: o vídeo só entra na lista das formas com o ramo
// dele na fila.

const ID = "3f1c2b7a-9d4e-4f6a-8b1c-2d3e4f5a6b7c";
const vazio: EstadoDoEnvioDoVideo = { reservado: false, partes: 0, etags: 0, finalizado: false };

describe("a forma do vídeo no LinkedIn", () => {
  it("o rótulo nas Publicações é LinkedIn · Vídeo", () => {
    expect(rotuloDoPostNoLinkedin({ forma: "video" })).toBe("LinkedIn · Vídeo");
  });

  it("o pedido de vídeo leva um arquivo só, MP4 pela extensão do caminho; o MOV é recusado com a frase do MP4", () => {
    const pedido = (caminhos: string[]) => recusaDoPedidoNoLinkedin({ forma: "video", caminhos, texto: "Um vídeo novo", idDoEnvio: ID });
    expect(pedido(["conta/a.mp4"])).toBeNull();
    expect(pedido(["conta/a.MP4"])).toBeNull();
    expect(pedido([])).toBe("quantidade");
    expect(pedido(["conta/a.mp4", "conta/b.mp4"])).toBe("quantidade");
    expect(pedido(["conta/a.mov"])).toBe("video_nao_mp4");
    expect(pedido(["conta/a.jpg"])).toBe("video_nao_mp4");
    expect(textoDaRecusaNoLinkedin("video_nao_mp4")).toBe(TEXTO_DO_VIDEO_QUE_NAO_E_MP4);
  });
});

describe("só MP4 (Videos API: \"File format: MP4.\")", () => {
  it("o MP4 vai; o MOV do iPhone e o resto não", () => {
    expect(oVideoVaiAoLinkedin("video/mp4")).toBe(true);
    expect(oVideoVaiAoLinkedin("video/quicktime")).toBe(false);
    expect(oVideoVaiAoLinkedin("video/webm")).toBe(false);
    expect(oVideoVaiAoLinkedin("")).toBe(false);
  });

  it("a frase diz o porquê", () => {
    expect(TEXTO_DO_VIDEO_QUE_NAO_E_MP4).toBe("O LinkedIn só aceita vídeo MP4.");
  });
});

describe("o progresso e a próxima etapa (o 230)", () => {
  it("a ordem é a reserva, cada parte, o fim e o post", () => {
    expect(proximaEtapaDoVideo(vazio)).toBe("reserva");
    expect(proximaEtapaDoVideo({ reservado: true, partes: 3, etags: 0, finalizado: false })).toBe("parte");
    expect(proximaEtapaDoVideo({ reservado: true, partes: 3, etags: 2, finalizado: false })).toBe("parte");
    expect(proximaEtapaDoVideo({ reservado: true, partes: 3, etags: 3, finalizado: false })).toBe("fim");
    expect(proximaEtapaDoVideo({ reservado: true, partes: 3, etags: 3, finalizado: true })).toBe("post");
  });

  it("o progresso conta a reserva, cada ETag gravado e o fim, e só cresce ao longo das etapas", () => {
    const caminho: EstadoDoEnvioDoVideo[] = [
      vazio,
      { reservado: true, partes: 3, etags: 0, finalizado: false },
      { reservado: true, partes: 3, etags: 1, finalizado: false },
      { reservado: true, partes: 3, etags: 2, finalizado: false },
      { reservado: true, partes: 3, etags: 3, finalizado: false },
      { reservado: true, partes: 3, etags: 3, finalizado: true },
    ];
    expect(caminho.map(progressoDoVideo)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("ETags a mais que as partes (um payload torto) não passam do número de partes", () => {
    const torto = { reservado: true, partes: 2, etags: 5, finalizado: false };
    expect(progressoDoVideo(torto)).toBe(3);
    expect(proximaEtapaDoVideo(torto)).toBe("fim");
  });
});

describe("os dois tetos do vídeo (o 230 e o 237)", () => {
  const T0 = Date.UTC(2026, 10, 16, 12, 0, 0);

  it("o teto das passadas é o número de partes, mais a reserva, o fim e o post, mais 6 de folga", () => {
    expect(tetoDePassadasDoVideo(13)).toBe(22);
    expect(tetoDePassadasDoVideo(1)).toBe(10);
  });

  it("encerra só quando PASSA do teto das passadas", () => {
    const base = { partes: 13, primeiraPassadaEmMs: T0, agoraMs: T0 + 60_000 };
    expect(tetoDoVideoAtingido({ ...base, passadas: 22 })).toBeNull();
    expect(tetoDoVideoAtingido({ ...base, passadas: 23 })).toBe("passadas");
  });

  it("a idade: 2 horas desde a primeira passada encerram, mesmo com passadas sobrando", () => {
    expect(IDADE_MAXIMA_DO_VIDEO_MS).toBe(2 * 60 * 60 * 1000);
    const base = { partes: 13, passadas: 5, primeiraPassadaEmMs: T0 };
    expect(tetoDoVideoAtingido({ ...base, agoraMs: T0 + IDADE_MAXIMA_DO_VIDEO_MS - 1 })).toBeNull();
    expect(tetoDoVideoAtingido({ ...base, agoraMs: T0 + IDADE_MAXIMA_DO_VIDEO_MS })).toBe("idade");
  });

  it("sem a primeira passada gravada, só o teto das passadas vale", () => {
    expect(tetoDoVideoAtingido({ partes: 3, passadas: 1, primeiraPassadaEmMs: null, agoraMs: T0 })).toBeNull();
  });
});

describe("o erro de uma parte, que vai sem o token (o 234 e o 238)", () => {
  it("o 401 e o 403 são a parte recusada, com texto próprio, e não a autorização da conexão", () => {
    expect(desfechoDoErroDaParte(401)).toBe("recusada");
    expect(desfechoDoErroDaParte(403)).toBe("recusada");
  });

  it("a rede, o 409, o 429 e os 5xx passam, como hoje", () => {
    for (const s of [0, 409, 429, 500, 502, 503]) expect(desfechoDoErroDaParte(s)).toBe("passageiro");
  });

  it("os outros 4xx não passam sozinhos", () => {
    for (const s of [400, 404, 413, 422]) expect(desfechoDoErroDaParte(s)).toBe("permanente");
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-video"; cd "$C" || exit 1
npx --no-install vitest run tests/linkedin-video-regras.test.ts 2>&1 | tee ../pl3b-f1-red-puros.log
```

Esperado: Nos puros, "Test Files 1 failed (1)" e "Tests 14 failed (14)". Caem: "o rótulo nas Publicações é LinkedIn · Vídeo"; "o pedido de vídeo leva um arquivo só, MP4 pela extensão do caminho; o MOV é recusado com a frase do MP4"; "o MP4 vai; o MOV do iPhone e o resto não"; "a frase diz o porquê"; "a ordem é a reserva, cada parte, o fim e o post"; "o progresso conta a reserva, cada ETag gravado e o fim, e só cresce ao longo das etapas"; "ETags a mais que as partes (um payload torto) não passam do número de partes"; "o teto das passadas é o número de partes, mais a reserva, o fim e o post, mais 6 de folga"; "encerra só quando PASSA do teto das passadas"; "a idade: 2 horas desde a primeira passada encerram, mesmo com passadas sobrando"; "sem a primeira passada gravada, só o teto das passadas vale"; "o 401 e o 403 são a parte recusada, com texto próprio, e não a autorização da conexão"; "a rede, o 409, o 429 e os 5xx passam, como hoje"; "os outros 4xx não passam sozinhos".

- [ ] **Passo 3: o código**

Em `lib/linkedin-publicacao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/linkedin-publicacao.ts b/lib/linkedin-publicacao.ts
index 106fada..3df540d 100644
--- a/lib/linkedin-publicacao.ts
+++ b/lib/linkedin-publicacao.ts
@@ -1,7 +1,7 @@
 // AS DECISÕES PURAS DO LINKEDIN (docs/specs/2026-11-06-linkedin-no-perfil.md, §5), SEM IMPORT DE SERVIDOR: a
 // tela de cliente e o servidor leem as mesmas regras. Na parte 1 (a conexão), o vencimento; na parte 2a (só
 // texto e imagem, uma rede por post), as formas, o texto, o payload da fila, o corpo do post e os erros. Na parte
-// 3a, o carrossel em PDF; o vídeo vem na 3b. O único import é o de lib/publicacao.ts, que também é puro.
+// 3a, o carrossel em PDF; na 3b, o vídeo em partes. O único import é o de lib/publicacao.ts, que também é puro.
 import { CARROSSEL_ITENS_MAX, CARROSSEL_ITENS_MIN, pareceVideo } from "./publicacao";
 
 /** O aviso de que a autorização vai vencer começa a 7 dias. */
@@ -47,23 +47,27 @@ export const TEXTO_DO_CONVITE_SEM_CONFIRMACAO =
 // AS FORMAS DA PARTE 2a
 // ---------------------------------------------------------------------------------------------------------------
 
-/** As formas do post no LinkedIn: o só texto e a imagem (a parte 2a), e o carrossel em PDF (a parte 3a). */
-export type FormaNoLinkedin = "texto" | "imagem" | "carrossel";
+/**
+ * As formas do post no LinkedIn: o só texto e a imagem (a parte 2a), o carrossel em PDF (a parte 3a) e o vídeo em
+ * partes (a parte 3b).
+ */
+export type FormaNoLinkedin = "texto" | "imagem" | "carrossel" | "video";
 
 /**
  * AS FORMAS QUE ESTE CÓDIGO SABE PUBLICAR NO LINKEDIN, numa lista só: a do formulário, a do payload e a do dreno
  * (`soAFormaConhecidaDoLinkedin`, abaixo). Uma forma acrescentada aqui é uma forma que o dreno passa a pegar: o
- * carrossel entra junto com o ramo dele (lib/linkedin-fila.ts).
+ * carrossel entrou junto com o ramo dele (lib/linkedin-fila.ts), e o vídeo também entra só com o ramo dele.
  */
 export const FORMAS_NO_LINKEDIN: readonly FormaNoLinkedin[] = ["texto", "imagem", "carrossel"];
 
 /**
- * QUANTOS ARQUIVOS CADA FORMA LEVA, numa função só, para o pedido e para o payload: o só texto nenhum, a imagem um, e
- * o carrossel as mesmas 2 a 10 fotos do carrossel do Instagram (`CARROSSEL_ITENS_MIN` e `CARROSSEL_ITENS_MAX`).
+ * QUANTOS ARQUIVOS CADA FORMA LEVA, numa função só, para o pedido e para o payload: o só texto nenhum, a imagem e o
+ * vídeo um, e o carrossel as mesmas 2 a 10 fotos do carrossel do Instagram (`CARROSSEL_ITENS_MIN` e
+ * `CARROSSEL_ITENS_MAX`).
  */
 function quantidadeServe(forma: FormaNoLinkedin, quantos: number): boolean {
   if (forma === "texto") return quantos === 0;
-  if (forma === "imagem") return quantos === 1;
+  if (forma === "imagem" || forma === "video") return quantos === 1;
   return quantos >= CARROSSEL_ITENS_MIN && quantos <= CARROSSEL_ITENS_MAX;
 }
 
@@ -97,6 +101,7 @@ export function soAFormaConhecidaDoLinkedin(marcador: string): string {
 
 export function rotuloDaFormaNoLinkedin(forma: FormaNoLinkedin): string {
   if (forma === "carrossel") return "Carrossel (PDF)";
+  if (forma === "video") return "Vídeo";
   return forma === "texto" ? "Só texto" : "Imagem";
 }
 
@@ -166,6 +171,7 @@ export type RecusaDoPedidoNoLinkedin =
   | "forma_desconhecida"
   | "quantidade"
   | "carrossel_com_video"
+  | "video_nao_mp4"
   | "texto_vazio"
   | "texto_longo"
   | "envio_sem_id";
@@ -189,6 +195,9 @@ export function recusaDoPedidoNoLinkedin(p: {
   // O PDF DO CARROSSEL SÓ LEVA FOTOS (a parte 3a). O vídeo é reconhecido pela extensão do caminho, como o dreno do
   // Instagram decide (`pareceVideo`); a tela confere antes, pelo tipo do arquivo, e desliga a caixinha.
   if (p.forma === "carrossel" && p.caminhos.some((c) => pareceVideo(c))) return "carrossel_com_video";
+  // O VÍDEO DO LINKEDIN SÓ VAI EM MP4 (a parte 3b). O caminho ganha a extensão pelo tipo de quem subiu
+  // (lib/bucket.ts), então o MOV do iPhone chega com ".mov"; a tela confere antes, pelo tipo do arquivo.
+  if (p.forma === "video" && !p.caminhos.every((c) => c.toLowerCase().endsWith(".mp4"))) return "video_nao_mp4";
   const problema = problemaDoTextoDoLinkedin(p.texto, p.forma);
   if (problema === "vazio") return "texto_vazio";
   if (problema === "longo") return "texto_longo";
@@ -204,6 +213,8 @@ export function textoDaRecusaNoLinkedin(r: RecusaDoPedidoNoLinkedin): string {
       return "O post do LinkedIn com imagem leva uma imagem, o carrossel leva de 2 a 10 fotos, e o só texto não leva arquivo.";
     case "carrossel_com_video":
       return textoDoProblemaDoCarrosselNoLinkedin("video");
+    case "video_nao_mp4":
+      return TEXTO_DO_VIDEO_QUE_NAO_E_MP4;
     case "texto_vazio":
       return "Escreva o texto do post.";
     case "texto_longo":
@@ -486,3 +497,87 @@ const MARCADORES_DA_DCT = new Set([0xc0, 0xc1, 0xc2]);
 export function vaiCruParaOLinkedin(c: { componentes: number; precisao: number; marcador: number } | null): boolean {
   return !!c && (c.componentes === 1 || c.componentes === 3) && c.precisao === 8 && MARCADORES_DA_DCT.has(c.marcador);
 }
+
+// ---------------------------------------------------------------------------------------------------------------
+// O VÍDEO EM PARTES (a parte 3b; scratchpad/desenho-li3b.md, v3)
+// ---------------------------------------------------------------------------------------------------------------
+
+/**
+ * SÓ MP4 ("File format: MP4.", a Videos API). O reels do Instagram aceita também o MOV (`lib/publicacao.ts`), que é o
+ * padrão do iPhone: com ele, a caixinha do LinkedIn desliga, com esta frase, e o post vai só ao Instagram.
+ */
+export const TEXTO_DO_VIDEO_QUE_NAO_E_MP4 = "O LinkedIn só aceita vídeo MP4.";
+
+export function oVideoVaiAoLinkedin(mime: string): boolean {
+  return mime === "video/mp4";
+}
+
+/**
+ * O QUE JÁ FOI FEITO NO ENVIO DO VÍDEO, lido do payload GRAVADO (o 230): a reserva, quantas partes ela devolveu,
+ * quantas têm o `ETag` gravado e o fim.
+ */
+export type EstadoDoEnvioDoVideo = { reservado: boolean; partes: number; etags: number; finalizado: boolean };
+
+/** As etapas do vídeo, uma por passada (o 231): a reserva, cada parte, o fim e o post. */
+export type EtapaDoVideo = "reserva" | "parte" | "fim" | "post";
+
+/** Os `ETag` a mais que as partes (um payload torto) não contam: a etapa seguinte é o fim. */
+function etagsQueContam(e: EstadoDoEnvioDoVideo): number {
+  return e.reservado ? Math.min(e.etags, e.partes) : 0;
+}
+
+/**
+ * O PROGRESSO DO VÍDEO (o 230): um número que só cresce ao longo das etapas, a reserva (1), cada `ETag` gravado (1 por
+ * parte) e o fim (1). A passada que o aumenta devolve a linha à fila sem contar adiamento; a que não aumenta, conta
+ * contra os tetos. Ele é lido do que a gravação devolveu, e não do que a passada achou que fez.
+ */
+export function progressoDoVideo(e: EstadoDoEnvioDoVideo): number {
+  return (e.reservado ? 1 : 0) + etagsQueContam(e) + (e.reservado && e.finalizado ? 1 : 0);
+}
+
+export function proximaEtapaDoVideo(e: EstadoDoEnvioDoVideo): EtapaDoVideo {
+  if (!e.reservado) return "reserva";
+  if (etagsQueContam(e) < e.partes) return "parte";
+  return e.finalizado ? "post" : "fim";
+}
+
+/**
+ * OS DOIS TETOS DO VÍDEO, para nenhum defeito virar um laço sem fim (o 230 e o 237):
+ *   - as passadas que COMEÇARAM uma etapa, com avanço ou sem, até o número de partes mais as três etapas de uma vez só
+ *     (a reserva, o fim e o post) mais 6 de folga. A passada do post que volta por mídia não pronta não conta aqui,
+ *     porque as consultas têm o teto delas;
+ *   - a idade: 2 horas desde a primeira passada. É ela que limita a espera da passada sem tempo, que não conta como
+ *     passada (um segundo vídeo na fila não gasta a folga esperando o primeiro).
+ */
+export const PASSADAS_DE_FOLGA_DO_VIDEO = 6;
+export const IDADE_MAXIMA_DO_VIDEO_MS = 2 * 60 * 60 * 1000;
+
+export function tetoDePassadasDoVideo(partes: number): number {
+  return partes + 3 + PASSADAS_DE_FOLGA_DO_VIDEO;
+}
+
+export type TetoDoVideo = "passadas" | "idade";
+
+export function tetoDoVideoAtingido(p: {
+  partes: number;
+  passadas: number;
+  primeiraPassadaEmMs: number | null;
+  agoraMs: number;
+}): TetoDoVideo | null {
+  if (p.passadas > tetoDePassadasDoVideo(p.partes)) return "passadas";
+  if (p.primeiraPassadaEmMs !== null && p.agoraMs - p.primeiraPassadaEmMs >= IDADE_MAXIMA_DO_VIDEO_MS) return "idade";
+  return null;
+}
+
+/**
+ * O ERRO DE UMA PARTE DO VÍDEO (o 234 e o 238). A parte vai SEM o token, para o endereço já assinado da reserva:
+ * o 401 e o 403 ali são a parte recusada (o endereço venceu ou não vale), e NÃO a autorização da conexão, que
+ * mandaria o convite de novo sem razão. A rede, o 409, o 429 e os 5xx passam, como em `desfechoDoErroDoLinkedin`;
+ * os outros 4xx não passam sozinhos.
+ */
+export type DesfechoDoErroDaParte = "recusada" | "passageiro" | "permanente";
+
+export function desfechoDoErroDaParte(status: number): DesfechoDoErroDaParte {
+  if (status === 401 || status === 403) return "recusada";
+  return desfechoDoErroDoLinkedin(status) === "passageiro" ? "passageiro" : "permanente";
+}
```

- [ ] **Passo 4: rodar e ver passar**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-video"; cd "$C" || exit 1
npx --no-install vitest run tests/linkedin-video-regras.test.ts 2>&1 | tee ../pl3b-f1-green-puros.log
npx --no-install vitest run 2>&1 | tee ../pl3b-f1-suite.log
npx --no-install tsc --noEmit
npx --no-install eslint lib/linkedin-publicacao.ts tests/linkedin-video-regras.test.ts
git diff --name-only a5cd8d4 -- lib/queue-drain.ts lib/fila-tipos.ts migrations scripts package.json package-lock.json   # vazio
```

Esperado: Nos puros, "Test Files 1 passed (1)" e "Tests 14 passed (14)". A suíte pura inteira: "Test Files 161 passed (161)" e "Tests 3842 passed (3842)". O `tsc` e o lint sem saída, e a guarda vazia.

- [ ] **Passo 5: o commit**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-video"; cd "$C" || exit 1
node ../varrer-texto.mjs lib/linkedin-publicacao.ts tests/linkedin-video-regras.test.ts && test "$(git branch --show-current)" = linkedin-video && git add lib/linkedin-publicacao.ts tests/linkedin-video-regras.test.ts && git commit -m "O vídeo do LinkedIn ganha as regras puras: só MP4, o progresso e a próxima etapa do envio em partes, os dois tetos e o erro da parte que vai sem o token"
git show HEAD | git patch-id --stable | cut -c1-12   # 28529a49ee97
```

O patch-id tem de começar por `28529a49ee97` (o mesmo do ensaio). Se não começar, pare.

---

### FASE 2 — O cliente do LinkedIn reserva o vídeo, envia as partes sem o token, finaliza e consulta, e nenhuma chamada segue redirecionamento

**Arquivos:** `lib/linkedin-publicacao.ts`, `lib/linkedin.ts`, `tests/linkedin-post.test.ts`, `tests/linkedin-rest.test.ts`.

- [ ] **Passo 1: os testes**

Em `tests/linkedin-rest.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/linkedin-rest.test.ts b/tests/linkedin-rest.test.ts
index cdcd2ce..dfbb6ee 100644
--- a/tests/linkedin-rest.test.ts
+++ b/tests/linkedin-rest.test.ts
@@ -1,13 +1,20 @@
+import { createServer, type Server } from "node:http";
+import type { AddressInfo } from "node:net";
 import { afterEach, describe, expect, it, vi } from "vitest";
 import {
   criarPost,
   enderecoDeEnvioConfiavel,
   enviarDocumento,
   enviarImagem,
+  enviarParteDoVideo,
+  estadoDoVideo,
+  finalizarVideo,
   LINKEDIN_VERSION,
   nomeLimpo,
   reservarDocumento,
+  reservarVideo,
   TETO_DO_ENVIO_DA_IMAGEM_MS,
+  TETO_DO_ENVIO_DA_PARTE_MS,
   TETO_DO_ENVIO_DO_DOCUMENTO_MS,
   TETO_DO_LINKEDIN_MS,
 } from "@/lib/linkedin";
@@ -205,3 +212,203 @@ describe("o post recusado pela mídia que o LinkedIn ainda processa", () => {
     await expect(criarPost("token-de-teste", { author: "urn:li:person:x" })).rejects.toMatchObject({ status: 400, midiaNaoPronta: false });
   });
 });
+
+// O VÍDEO EM PARTES (a parte 3b; scratchpad/desenho-li3b.md, v3): a reserva com o tamanho, as partes conferidas, o
+// envio de cada parte SEM o token (o 234), o fim com os ETags na ordem, e o estado do vídeo (o 233).
+describe("a reserva do vídeo", () => {
+  function responderUmaVez(corpo: unknown, status = 200) {
+    const pedidos: { url: string; init: RequestInit }[] = [];
+    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
+      pedidos.push({ url, init });
+      return new Response(typeof corpo === "string" ? corpo : JSON.stringify(corpo), { status });
+    });
+    return pedidos;
+  }
+  const instrucao = (firstByte: number, lastByte: number, n: number) => ({
+    uploadUrl: `https://www.linkedin.com/dms-uploads/V77/uploadedVideo?parte=${n}`,
+    firstByte,
+    lastByte,
+  });
+
+  it("pede o vídeo com a pessoa dona e o tamanho, sem legenda nem capa, e devolve as partes, o URN e o token", async () => {
+    const pedidos = responderUmaVez({
+      value: {
+        uploadInstructions: [instrucao(0, 4194303, 1), instrucao(4194304, 5000000, 2)],
+        video: "urn:li:video:V77",
+        uploadToken: "token-do-envio",
+        uploadUrlsExpireAt: 1999999999999,
+      },
+    });
+    expect(await reservarVideo("token-de-teste", "pessoaX", 5000001)).toEqual({
+      videoUrn: "urn:li:video:V77",
+      uploadToken: "token-do-envio",
+      partes: [
+        { inicio: 0, fim: 4194303, url: "https://www.linkedin.com/dms-uploads/V77/uploadedVideo?parte=1" },
+        { inicio: 4194304, fim: 5000000, url: "https://www.linkedin.com/dms-uploads/V77/uploadedVideo?parte=2" },
+      ],
+    });
+    expect(pedidos[0].url.endsWith("/rest/videos?action=initializeUpload")).toBe(true);
+    expect(JSON.parse(String(pedidos[0].init.body))).toEqual({
+      initializeUploadRequest: { owner: "urn:li:person:pessoaX", fileSizeBytes: 5000001, uploadCaptions: false, uploadThumbnail: false },
+    });
+    expect(pedidos[0].init.redirect).toBe("error");
+  });
+
+  it("o token do envio vazio é aceito (o vídeo de uma parte só)", async () => {
+    responderUmaVez({ value: { uploadInstructions: [instrucao(0, 99999, 1)], video: "urn:li:video:V1", uploadToken: "" } });
+    expect((await reservarVideo("token-de-teste", "pessoaX", 100000)).uploadToken).toBe("");
+  });
+
+  it("recusa a reserva sem o URN de vídeo, sem instruções, ou com um endereço que não é do LinkedIn", async () => {
+    const ok = { uploadInstructions: [instrucao(0, 99, 1)], video: "urn:li:video:V1", uploadToken: "t" };
+    responderUmaVez({ value: { ...ok, video: "urn:li:image:I" } });
+    await expect(reservarVideo("token-de-teste", "pessoaX", 100)).rejects.toMatchObject({ name: "LinkedinError" });
+    responderUmaVez({ value: { ...ok, uploadInstructions: [] } });
+    await expect(reservarVideo("token-de-teste", "pessoaX", 100)).rejects.toMatchObject({ name: "LinkedinError" });
+    responderUmaVez({ value: { ...ok, uploadInstructions: [{ ...instrucao(0, 99, 1), uploadUrl: "https://www.exemplo.com/x" }] } });
+    await expect(reservarVideo("token-de-teste", "pessoaX", 100)).rejects.toMatchObject({ name: "LinkedinError" });
+  });
+
+  it("recusa as partes que não cobrem o arquivo inteiro, em ordem, sem buraco nem sobra", async () => {
+    const reserva = (instrucoes: unknown[], tamanho: number) => {
+      responderUmaVez({ value: { uploadInstructions: instrucoes, video: "urn:li:video:V1", uploadToken: "t" } });
+      return reservarVideo("token-de-teste", "pessoaX", tamanho);
+    };
+    await expect(reserva([instrucao(0, 49, 1), instrucao(51, 99, 2)], 100)).rejects.toMatchObject({ name: "LinkedinError" });
+    await expect(reserva([instrucao(0, 49, 1), instrucao(40, 99, 2)], 100)).rejects.toMatchObject({ name: "LinkedinError" });
+    await expect(reserva([instrucao(0, 98, 1)], 100)).rejects.toMatchObject({ name: "LinkedinError" });
+    await expect(reserva([instrucao(0, 100, 1)], 100)).rejects.toMatchObject({ name: "LinkedinError" });
+    await expect(reserva([instrucao(1, 99, 1)], 100)).rejects.toMatchObject({ name: "LinkedinError" });
+    await expect(reserva([{ ...instrucao(0, 99, 1), lastByte: "99" }], 100)).rejects.toMatchObject({ name: "LinkedinError" });
+  });
+
+  it("a reserva recusada pelo LinkedIn é um erro com o status", async () => {
+    responderUmaVez("{}", 403);
+    await expect(reservarVideo("token-de-teste", "pessoaX", 100)).rejects.toMatchObject({ name: "LinkedinError", status: 403 });
+  });
+});
+
+describe("o envio de uma parte do vídeo (o 234)", () => {
+  function gravar(resposta: () => Response) {
+    const pedidos: { url: string; init: RequestInit }[] = [];
+    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
+      pedidos.push({ url, init });
+      return resposta();
+    });
+    return pedidos;
+  }
+  const ENDERECO = "https://www.linkedin.com/dms-uploads/V77/uploadedVideo?parte=1";
+
+  it("é um PUT SEM a autorização, com os bytes, o tipo binário e o teto de 15 s, e devolve o ETag", async () => {
+    expect(TETO_DO_ENVIO_DA_PARTE_MS).toBe(15_000);
+    const tetos: number[] = [];
+    const original = AbortSignal.timeout.bind(AbortSignal);
+    vi.spyOn(AbortSignal, "timeout").mockImplementation((ms: number) => {
+      tetos.push(ms);
+      return original(ms);
+    });
+    const pedidos = gravar(() => new Response("", { status: 200, headers: { etag: '"etag-da-parte-1"' } }));
+    const bytes = new Uint8Array([1, 2, 3]);
+    expect(await enviarParteDoVideo(ENDERECO, bytes)).toBe('"etag-da-parte-1"');
+    expect(tetos).toEqual([TETO_DO_ENVIO_DA_PARTE_MS]);
+    expect(pedidos[0].init.method).toBe("PUT");
+    const cabecalhos = pedidos[0].init.headers as Record<string, string>;
+    expect(Object.keys(cabecalhos).map((k) => k.toLowerCase())).not.toContain("authorization");
+    expect(cabecalhos["content-type"]).toBe("application/octet-stream");
+    expect(pedidos[0].init.body).toBe(bytes);
+    expect(pedidos[0].init.redirect).toBe("error");
+  });
+
+  it("a parte aceita sem o ETag, ou com ele vazio, é um erro", async () => {
+    gravar(() => new Response("", { status: 200 }));
+    await expect(enviarParteDoVideo(ENDERECO, new Uint8Array(3))).rejects.toMatchObject({ name: "LinkedinError", status: 200 });
+    gravar(() => new Response("", { status: 201, headers: { etag: "" } }));
+    await expect(enviarParteDoVideo(ENDERECO, new Uint8Array(3))).rejects.toMatchObject({ name: "LinkedinError", status: 201 });
+  });
+
+  it("o endereço que não é do LinkedIn não recebe a parte: o vídeo é do cliente", async () => {
+    const pedidos = gravar(() => new Response("", { status: 200, headers: { etag: "e" } }));
+    await expect(enviarParteDoVideo("https://www.exemplo.com/x", new Uint8Array(3))).rejects.toMatchObject({ name: "LinkedinError", status: 0 });
+    expect(pedidos).toHaveLength(0);
+  });
+
+  it("a parte recusada é um erro com o status, e o texto não leva a resposta do LinkedIn (o 236)", async () => {
+    gravar(() => new Response("um texto longo do LinkedIn que a tela não deve mostrar", { status: 403 }));
+    const erro = await enviarParteDoVideo(ENDERECO, new Uint8Array(3)).catch((e: unknown) => e);
+    expect(erro).toMatchObject({ name: "LinkedinError", status: 403 });
+    expect(String((erro as Error).message)).not.toContain("um texto longo");
+  });
+});
+
+describe("o fim do envio e o estado do vídeo", () => {
+  function gravar(resposta: () => Response) {
+    const pedidos: { url: string; init: RequestInit }[] = [];
+    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
+      pedidos.push({ url, init });
+      return resposta();
+    });
+    return pedidos;
+  }
+
+  it("o fim leva o vídeo, o token do envio e os ETags na ordem das partes", async () => {
+    const pedidos = gravar(() => new Response("", { status: 200 }));
+    await finalizarVideo("token-de-teste", "urn:li:video:V77", "token-do-envio", ['"e1"', '"e2"', '"e3"']);
+    expect(pedidos[0].url.endsWith("/rest/videos?action=finalizeUpload")).toBe(true);
+    expect(JSON.parse(String(pedidos[0].init.body))).toEqual({
+      finalizeUploadRequest: { video: "urn:li:video:V77", uploadToken: "token-do-envio", uploadedPartIds: ['"e1"', '"e2"', '"e3"'] },
+    });
+    expect((pedidos[0].init.headers as Record<string, string>).authorization).toBe("Bearer token-de-teste");
+    expect(pedidos[0].init.redirect).toBe("error");
+  });
+
+  it("o fim recusado é um erro com o status", async () => {
+    gravar(() => new Response("{}", { status: 400 }));
+    await expect(finalizarVideo("token-de-teste", "urn:li:video:V77", "t", ["e"])).rejects.toMatchObject({ name: "LinkedinError", status: 400 });
+  });
+
+  it("o estado do vídeo vem do GET com o URN codificado no caminho", async () => {
+    const pedidos = gravar(() => new Response(JSON.stringify({ status: "AVAILABLE", id: "urn:li:video:V77" }), { status: 200 }));
+    expect(await estadoDoVideo("token-de-teste", "urn:li:video:V77")).toBe("AVAILABLE");
+    expect(pedidos[0].url.endsWith("/rest/videos/urn%3Ali%3Avideo%3AV77")).toBe(true);
+    expect(pedidos[0].init.method ?? "GET").toBe("GET");
+  });
+
+  it("o estado que não veio, ou a consulta recusada, é null ou erro", async () => {
+    gravar(() => new Response("{}", { status: 200 }));
+    expect(await estadoDoVideo("token-de-teste", "urn:li:video:V77")).toBeNull();
+    gravar(() => new Response("{}", { status: 403 }));
+    await expect(estadoDoVideo("token-de-teste", "urn:li:video:V77")).rejects.toMatchObject({ name: "LinkedinError", status: 403 });
+  });
+});
+
+// O REDIRECIONAMENTO NÃO É SEGUIDO (o 234). A regra do domínio confere só o primeiro endereço; um 3xx para fora do
+// LinkedIn levaria o token (ou a parte do vídeo) junto. Este caso usa dois servidores de verdade no loopback, sem
+// trocar o `fetch`, para medir o que o `fetch` do Node faz com o `redirect: "error"`.
+describe("o redirecionamento não é seguido", () => {
+  it("a parte que recebe um 307 não vai ao endereço do redirecionamento", async () => {
+    const recebidos: string[] = [];
+    const destino: Server = createServer((req, res) => {
+      recebidos.push(req.url ?? "");
+      res.writeHead(200, { etag: "nao-devia-chegar" });
+      res.end();
+    });
+    await new Promise<void>((pronto) => destino.listen(0, "127.0.0.1", pronto));
+    const portaDestino = (destino.address() as AddressInfo).port;
+    const origem: Server = createServer((_req, res) => {
+      res.writeHead(307, { location: `http://127.0.0.1:${portaDestino}/capturado` });
+      res.end();
+    });
+    await new Promise<void>((pronto) => origem.listen(0, "127.0.0.1", pronto));
+    const portaOrigem = (origem.address() as AddressInfo).port;
+    try {
+      await expect(enviarParteDoVideo(`http://127.0.0.1:${portaOrigem}/envio`, new Uint8Array([1, 2, 3]))).rejects.toMatchObject({
+        name: "LinkedinError",
+        status: 0,
+      });
+      expect(recebidos).toEqual([]);
+    } finally {
+      await new Promise((pronto) => origem.close(pronto));
+      await new Promise((pronto) => destino.close(pronto));
+    }
+  });
+});
```

Em `tests/linkedin-post.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/linkedin-post.test.ts b/tests/linkedin-post.test.ts
index 3346ebd..c2ce91a 100644
--- a/tests/linkedin-post.test.ts
+++ b/tests/linkedin-post.test.ts
@@ -216,6 +216,18 @@ describe("o corpo do POST /rest/posts com o documento do carrossel", () => {
   });
 });
 
+// O POST COM O VÍDEO (a parte 3b): o conteúdo leva o URN do vídeo e o título, que é opcional no vídeo; a decisão do
+// Eduardo pela caixa, em 16/11, foi "O começo do texto", a mesma regra do carrossel.
+describe("o corpo do POST /rest/posts com o vídeo", () => {
+  it("o conteúdo leva o vídeo e o título", () => {
+    expect(corpoDoPost({ pessoaId: "abc", texto: "x", video: { urn: "urn:li:video:V", titulo: "Um vídeo novo" } })).toMatchObject({
+      author: "urn:li:person:abc",
+      commentary: "x",
+      content: { media: { id: "urn:li:video:V", title: "Um vídeo novo" } },
+    });
+  });
+});
+
 // O DOCUMENTO QUE O LINKEDIN AINDA PROCESSA (a parte 3a). A Posts API não tem código próprio para a mídia não
 // pronta; a Videos API lista o 400 "MEDIA_ASSET_WAITING_UPLOAD" e o estado "PROCESSING". O post com o documento que
 // volta assim não foi criado (é um 4xx), e a linha espera e consulta de novo. O "PROCESSING_FAILED" não espera: falhou.
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-video"; cd "$C" || exit 1
npx --no-install vitest run tests/linkedin-rest.test.ts tests/linkedin-post.test.ts 2>&1 | tee ../pl3b-f2-red-puros.log
```

Esperado: Nos puros, "Test Files 2 failed (2)" e "Tests 15 failed | 38 passed (53)". Caem: "o conteúdo leva o vídeo e o título"; "pede o vídeo com a pessoa dona e o tamanho, sem legenda nem capa, e devolve as partes, o URN e o token"; "o token do envio vazio é aceito (o vídeo de uma parte só)"; "recusa a reserva sem o URN de vídeo, sem instruções, ou com um endereço que não é do LinkedIn"; "recusa as partes que não cobrem o arquivo inteiro, em ordem, sem buraco nem sobra"; "a reserva recusada pelo LinkedIn é um erro com o status"; "é um PUT SEM a autorização, com os bytes, o tipo binário e o teto de 15 s, e devolve o ETag"; "a parte aceita sem o ETag, ou com ele vazio, é um erro"; "o endereço que não é do LinkedIn não recebe a parte: o vídeo é do cliente"; "a parte recusada é um erro com o status, e o texto não leva a resposta do LinkedIn (o 236)"; "o fim leva o vídeo, o token do envio e os ETags na ordem das partes"; "o fim recusado é um erro com o status"; "o estado do vídeo vem do GET com o URN codificado no caminho"; "o estado que não veio, ou a consulta recusada, é null ou erro"; "a parte que recebe um 307 não vai ao endereço do redirecionamento".

- [ ] **Passo 3: o código**

Em `lib/linkedin.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/linkedin.ts b/lib/linkedin.ts
index 0fc6fe6..ffb8af7 100644
--- a/lib/linkedin.ts
+++ b/lib/linkedin.ts
@@ -112,14 +112,19 @@ export class LinkedinError extends Error {
   }
 }
 
+/**
+ * TODA CHAMADA AO LINKEDIN PASSA POR AQUI, com o teto de tempo e SEM SEGUIR REDIRECIONAMENTO (o 234, a parte 3b): a
+ * regra do domínio (`enderecoDeEnvioConfiavel`) confere só o primeiro endereço, e um 3xx para fora do LinkedIn
+ * levaria junto o token, ou a parte do vídeo do cliente. O redirecionamento vira erro de rede (status 0).
+ */
 async function chamar(
   url: string,
   init: RequestInit,
   tetoMs: number = TETO_DO_LINKEDIN_MS
-): Promise<{ status: number; texto: string; restliId: string | null }> {
+): Promise<{ status: number; texto: string; restliId: string | null; etag: string | null }> {
   try {
-    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(tetoMs) });
-    return { status: res.status, texto: await res.text(), restliId: res.headers.get("x-restli-id") };
+    const res = await fetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(tetoMs) });
+    return { status: res.status, texto: await res.text(), restliId: res.headers.get("x-restli-id"), etag: res.headers.get("etag") };
   } catch (err) {
     // O endereço vai sem a query: nenhuma destas chamadas leva segredo nela, e assim continua.
     const onde = url.split("?")[0];
@@ -295,6 +300,115 @@ export async function enviarDocumento(uploadUrl: string, token: string, bytes: U
   if (r.status !== 200 && r.status !== 201) throw new LinkedinError(r.status, r.texto.slice(0, 300));
 }
 
+// ---------------------------------------------------------------------------------------------------------------
+// O VÍDEO EM PARTES (a parte 3b; scratchpad/desenho-li3b.md, v3; a Videos API, lida em 11/11)
+// ---------------------------------------------------------------------------------------------------------------
+
+/**
+ * O teto do envio de UMA parte do vídeo: as partes são de 4 MiB nos exemplos da Videos API (~2,2 Mbit/s em 15 s), e
+ * a parte inteira (a faixa do bucket e este envio) só começa se terminar antes da hora de parar (o 231,
+ * lib/linkedin-fila.ts).
+ */
+export const TETO_DO_ENVIO_DA_PARTE_MS = 15_000;
+
+/** Uma parte do vídeo: o primeiro e o último byte, inclusivos, e o endereço de envio dela. */
+export type ParteDoVideo = { inicio: number; fim: number; url: string };
+
+/**
+ * AS PARTES DA RESERVA, conferidas antes de qualquer gravação: cada endereço pela regra do domínio, e os intervalos
+ * cobrindo o arquivo inteiro, de 0 ao tamanho − 1, em ordem, sem buraco nem sobra. Uma reserva torta não vira um
+ * envio pela metade.
+ */
+function partesConferidas(instrucoes: unknown, tamanho: number): ParteDoVideo[] | null {
+  if (!Array.isArray(instrucoes) || instrucoes.length === 0) return null;
+  const partes: ParteDoVideo[] = [];
+  let esperado = 0;
+  for (const i of instrucoes) {
+    if (!i || typeof i !== "object") return null;
+    const { uploadUrl, firstByte, lastByte } = i as Record<string, unknown>;
+    if (typeof uploadUrl !== "string" || !enderecoDeEnvioConfiavel(uploadUrl)) return null;
+    if (!Number.isSafeInteger(firstByte) || !Number.isSafeInteger(lastByte)) return null;
+    const inicio = firstByte as number;
+    const fim = lastByte as number;
+    if (inicio !== esperado || fim < inicio) return null;
+    partes.push({ inicio, fim, url: uploadUrl });
+    esperado = fim + 1;
+  }
+  return esperado === tamanho ? partes : null;
+}
+
+/**
+ * A RESERVA DO VÍDEO (`POST /rest/videos?action=initializeUpload`, Videos API), com a pessoa como dona ("For videos
+ * with member URN owners, the caller needs to match the video owner") e o tamanho, que decide quantas partes
+ * vêm. Sem legenda e sem capa. Devolve o URN, o token do envio (que pode vir vazio no vídeo de uma parte só) e as
+ * partes conferidas.
+ */
+export async function reservarVideo(
+  token: string,
+  pessoaId: string,
+  tamanho: number
+): Promise<{ videoUrn: string; uploadToken: string; partes: ParteDoVideo[] }> {
+  const r = await chamar(`${basesDoLinkedin().api}/rest/videos?action=initializeUpload`, {
+    method: "POST",
+    headers: cabecalhosDoRest(token),
+    body: JSON.stringify({
+      initializeUploadRequest: { owner: `urn:li:person:${pessoaId}`, fileSizeBytes: tamanho, uploadCaptions: false, uploadThumbnail: false },
+    }),
+  });
+  if (r.status !== 200) throw new LinkedinError(r.status, r.texto.slice(0, 300));
+  const valor = json(r.texto)?.value as Record<string, unknown> | undefined;
+  const videoUrn = valor?.video;
+  const uploadToken = valor?.uploadToken;
+  const partes = partesConferidas(valor?.uploadInstructions, tamanho);
+  if (typeof videoUrn !== "string" || !videoUrn.startsWith("urn:li:video:") || typeof uploadToken !== "string" || !partes) {
+    throw new LinkedinError(r.status, "a reserva do vídeo não devolveu o URN, o token do envio e as partes do arquivo inteiro");
+  }
+  return { videoUrn, uploadToken, partes };
+}
+
+/**
+ * O ENVIO DE UMA PARTE (o 234): um `PUT` dos bytes da parte, com o tipo binário e SEM a autorização, como o exemplo
+ * da Videos API, que traz o endereço já assinado. O endereço passa pela regra do domínio mesmo assim: o vídeo é do
+ * cliente e não sai do LinkedIn. Devolve o `ETag` da resposta, que é o id da parte; sem ele, ou vazio, é erro. O
+ * erro leva só o status, e não a resposta (o 236): a tela mostra a coluna `error`.
+ */
+export async function enviarParteDoVideo(uploadUrl: string, bytes: Uint8Array<ArrayBuffer>): Promise<string> {
+  if (!enderecoDeEnvioConfiavel(uploadUrl)) {
+    throw new LinkedinError(0, "o endereço de envio do vídeo não é do LinkedIn");
+  }
+  const r = await chamar(uploadUrl, { method: "PUT", headers: { "content-type": "application/octet-stream" }, body: bytes }, TETO_DO_ENVIO_DA_PARTE_MS);
+  if (r.status !== 200 && r.status !== 201) throw new LinkedinError(r.status, `o LinkedIn recusou a parte do vídeo (${r.status})`);
+  if (!r.etag) throw new LinkedinError(r.status, "o LinkedIn aceitou a parte do vídeo sem o ETag");
+  return r.etag;
+}
+
+/**
+ * O FIM DO ENVIO (`POST /rest/videos?action=finalizeUpload`): o vídeo, o token do envio e os ETags "na mesma ordem
+ * das partes nas instruções".
+ */
+export async function finalizarVideo(token: string, videoUrn: string, uploadToken: string, etags: readonly string[]): Promise<void> {
+  const r = await chamar(`${basesDoLinkedin().api}/rest/videos?action=finalizeUpload`, {
+    method: "POST",
+    headers: cabecalhosDoRest(token),
+    body: JSON.stringify({ finalizeUploadRequest: { video: videoUrn, uploadToken, uploadedPartIds: [...etags] } }),
+  });
+  if (r.status !== 200) throw new LinkedinError(r.status, r.texto.slice(0, 300));
+}
+
+/**
+ * O ESTADO DO VÍDEO (`GET /rest/videos/{urn}`): PROCESSING, PROCESSING_FAILED, AVAILABLE ou WAITING_UPLOAD. Ele só é
+ * lido no fim perdido (o 233). Se a consulta funciona só com o `w_member_social` não está medido: a prova mede.
+ */
+export async function estadoDoVideo(token: string, videoUrn: string): Promise<string | null> {
+  const r = await chamar(`${basesDoLinkedin().api}/rest/videos/${encodeURIComponent(videoUrn)}`, {
+    method: "GET",
+    headers: cabecalhosDoRest(token),
+  });
+  if (r.status !== 200) throw new LinkedinError(r.status, r.texto.slice(0, 300));
+  const status = json(r.texto)?.status;
+  return typeof status === "string" && status ? status : null;
+}
+
 /**
  * O POST (`POST /rest/posts`, Posts API): "You should get a 201 response and the response header x-restli-id
  * contains the Post ID". Devolve o URN do post.
```

Em `lib/linkedin-publicacao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/linkedin-publicacao.ts b/lib/linkedin-publicacao.ts
index 3df540d..eb34cfe 100644
--- a/lib/linkedin-publicacao.ts
+++ b/lib/linkedin-publicacao.ts
@@ -361,15 +361,18 @@ export function lerPayloadDoLinkedin(bruto: unknown): LeituraDoPayloadDoLinkedin
 /**
  * O corpo do `POST /rest/posts` (Posts API): o autor é a pessoa, o texto já transformado, PÚBLICO (fixo nesta
  * entrega; não há escolha de visibilidade na tela), no feed, publicado, e a imagem quando há. O documento do
- * carrossel (a parte 3a) vai com o título, que é obrigatório nele (`tituloDoDocumento`).
+ * carrossel (a parte 3a) vai com o título, que é obrigatório nele (`tituloDoDocumento`). O vídeo (a parte 3b) vai
+ * com o título pela mesma regra, que nele é opcional (a decisão do Eduardo pela caixa, em 16/11: "O começo do texto").
  */
 export function corpoDoPost(p: {
   pessoaId: string;
   texto: string;
   imagemUrn?: string;
   documento?: { urn: string; titulo: string };
+  video?: { urn: string; titulo: string };
 }): Record<string, unknown> {
-  const media = p.imagemUrn ? { id: p.imagemUrn } : p.documento ? { id: p.documento.urn, title: p.documento.titulo } : null;
+  const comTitulo = p.documento ?? p.video;
+  const media = p.imagemUrn ? { id: p.imagemUrn } : comTitulo ? { id: comTitulo.urn, title: comTitulo.titulo } : null;
   return {
     author: `urn:li:person:${p.pessoaId}`,
     commentary: textoParaOLinkedin(p.texto),
```

- [ ] **Passo 4: rodar e ver passar**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-video"; cd "$C" || exit 1
npx --no-install vitest run tests/linkedin-rest.test.ts tests/linkedin-post.test.ts 2>&1 | tee ../pl3b-f2-green-puros.log
npx --no-install vitest run 2>&1 | tee ../pl3b-f2-suite.log
npx --no-install tsc --noEmit
npx --no-install eslint lib/linkedin-publicacao.ts lib/linkedin.ts tests/linkedin-post.test.ts tests/linkedin-rest.test.ts
git diff --name-only a5cd8d4 -- lib/queue-drain.ts lib/fila-tipos.ts migrations scripts package.json package-lock.json   # vazio
```

Esperado: Nos puros, "Test Files 2 passed (2)" e "Tests 53 passed (53)". A suíte pura inteira: "Test Files 161 passed (161)" e "Tests 3857 passed (3857)". O `tsc` e o lint sem saída, e a guarda vazia.

- [ ] **Passo 5: o commit**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-video"; cd "$C" || exit 1
node ../varrer-texto.mjs lib/linkedin-publicacao.ts lib/linkedin.ts tests/linkedin-post.test.ts tests/linkedin-rest.test.ts && test "$(git branch --show-current)" = linkedin-video && git add lib/linkedin-publicacao.ts lib/linkedin.ts tests/linkedin-post.test.ts tests/linkedin-rest.test.ts && git commit -m "O cliente do LinkedIn reserva o vídeo e confere as partes, envia cada parte sem o token e guarda o ETag, finaliza e consulta o estado, e nenhuma chamada segue redirecionamento"
git show HEAD | git patch-id --stable | cut -c1-12   # 8705ede51b3f
```

O patch-id tem de começar por `8705ede51b3f` (o mesmo do ensaio). Se não começar, pare.

---

### FASE 3 — O bucket diz o tamanho do vídeo, entrega a faixa exata de uma parte e copia o vídeo no próprio servidor

**Arquivos:** `lib/bucket.ts`, `tests/bucket-video.test.ts`.

- [ ] **Passo 1: os testes**

Crie `tests/bucket-video.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

// O BUCKET PARA O VÍDEO DO LINKEDIN (a parte 3b; scratchpad/desenho-li3b.md, v3, §3.3, §3.6 e §4): o tamanho do
// vídeo, a faixa de uma parte, conferida (o 236), e a cópia no servidor do Storage (o vídeo nas duas redes).
// As chamadas vão a um `fetch` trocado: o que se prova aqui é o pedido que sai e a conferência da resposta. A faixa e
// a cópia de verdade foram medidas em 16/11 (a faixa pela auditoria, só lendo; a cópia pela sonda, com a caixa do
// Eduardo), e a prova mede de novo.

process.env.SUPABASE_URL = "https://exemplo.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "chave-de-teste-que-nao-vale-nada";
process.env.SUPABASE_BUCKET = "MetodoChat";

const { copiarObjeto, faixaDoObjeto, tamanhoDoObjeto } = await import("@/lib/bucket");

const CAMINHO = "17841400000000001/v.mp4";
const PUBLICO = "https://exemplo.supabase.co/storage/v1/object/public/MetodoChat/17841400000000001/v.mp4";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function gravar(resposta: () => Response) {
  const pedidos: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    pedidos.push({ url, init });
    return resposta();
  });
  return pedidos;
}

function medirOsTetos() {
  const tetos: number[] = [];
  const original = AbortSignal.timeout.bind(AbortSignal);
  vi.spyOn(AbortSignal, "timeout").mockImplementation((ms: number) => {
    tetos.push(ms);
    return original(ms);
  });
  return tetos;
}

describe("o tamanho do vídeo no bucket", () => {
  it("vem do HEAD do endereço público, sem cache, com o teto pedido", async () => {
    const tetos = medirOsTetos();
    const pedidos = gravar(() => new Response(null, { status: 200, headers: { "content-length": "5000001" } }));
    expect(await tamanhoDoObjeto(CAMINHO, 10_000)).toBe(5000001);
    expect(pedidos[0].url).toBe(PUBLICO);
    expect(pedidos[0].init.method).toBe("HEAD");
    expect(pedidos[0].init.cache).toBe("no-store");
    expect(tetos).toEqual([10_000]);
  });

  it("o arquivo que não está lá, ou a resposta sem o tamanho, é erro, e o erro não leva o endereço", async () => {
    gravar(() => new Response(null, { status: 404 }));
    const erro = await tamanhoDoObjeto(CAMINHO, 10_000).catch((e: unknown) => e);
    expect(String((erro as Error).message)).toContain("404");
    expect(String((erro as Error).message)).not.toContain("supabase");
    gravar(() => new Response(null, { status: 200 }));
    await expect(tamanhoDoObjeto(CAMINHO, 10_000)).rejects.toThrow();
  });
});

describe("a faixa de uma parte do vídeo (o 236)", () => {
  it("é um GET com o Range dos bytes inclusivos, sem cache, e devolve os bytes da faixa", async () => {
    const tetos = medirOsTetos();
    const pedidos = gravar(
      () => new Response(new Uint8Array([7, 8, 9, 10]), { status: 206, headers: { "content-range": "bytes 4-7/20", "content-length": "4" } })
    );
    expect(Array.from(await faixaDoObjeto(CAMINHO, 4, 7, 10_000))).toEqual([7, 8, 9, 10]);
    expect(pedidos[0].url).toBe(PUBLICO);
    expect((pedidos[0].init.headers as Record<string, string>).range).toBe("bytes=4-7");
    expect(pedidos[0].init.cache).toBe("no-store");
    expect(tetos).toEqual([10_000]);
  });

  it("o 200 com o arquivo inteiro é erro: a faixa não foi respeitada", async () => {
    gravar(() => new Response(new Uint8Array(20), { status: 200 }));
    await expect(faixaDoObjeto(CAMINHO, 4, 7, 10_000)).rejects.toThrow(/faixa/);
  });

  it("o Content-Range diferente do pedido, ou ausente, é erro", async () => {
    gravar(() => new Response(new Uint8Array(4), { status: 206, headers: { "content-range": "bytes 0-3/20" } }));
    await expect(faixaDoObjeto(CAMINHO, 4, 7, 10_000)).rejects.toThrow(/faixa/);
    gravar(() => new Response(new Uint8Array(4), { status: 206 }));
    await expect(faixaDoObjeto(CAMINHO, 4, 7, 10_000)).rejects.toThrow(/faixa/);
  });

  it("o corpo menor ou maior que a faixa é erro", async () => {
    gravar(() => new Response(new Uint8Array(3), { status: 206, headers: { "content-range": "bytes 4-7/20" } }));
    await expect(faixaDoObjeto(CAMINHO, 4, 7, 10_000)).rejects.toThrow(/faixa/);
    gravar(() => new Response(new Uint8Array(5), { status: 206, headers: { "content-range": "bytes 4-7/20" } }));
    await expect(faixaDoObjeto(CAMINHO, 4, 7, 10_000)).rejects.toThrow(/faixa/);
  });

  it("o arquivo que não está lá é erro com o status, sem o endereço", async () => {
    gravar(() => new Response(null, { status: 404 }));
    const erro = await faixaDoObjeto(CAMINHO, 4, 7, 10_000).catch((e: unknown) => e);
    expect(String((erro as Error).message)).toContain("404");
    expect(String((erro as Error).message)).not.toContain("supabase");
  });
});

describe("a cópia no servidor do Storage (o vídeo nas duas redes)", () => {
  it("é um POST ao /object/copy, com as duas chaves de serviço e o bucket, a origem e o destino", async () => {
    const tetos = medirOsTetos();
    const pedidos = gravar(() => new Response(JSON.stringify({ Key: "MetodoChat/x" }), { status: 200 }));
    await copiarObjeto(CAMINHO, "17841400000000001/linkedin-v.mp4", 10_000);
    expect(pedidos[0].url).toBe("https://exemplo.supabase.co/storage/v1/object/copy");
    expect(pedidos[0].init.method).toBe("POST");
    const cabecalhos = pedidos[0].init.headers as Record<string, string>;
    expect(cabecalhos.Authorization).toBe("Bearer chave-de-teste-que-nao-vale-nada");
    expect(cabecalhos.apikey).toBe("chave-de-teste-que-nao-vale-nada");
    expect(JSON.parse(String(pedidos[0].init.body))).toEqual({
      bucketId: "MetodoChat",
      sourceKey: CAMINHO,
      destinationKey: "17841400000000001/linkedin-v.mp4",
    });
    expect(tetos).toEqual([10_000]);
  });

  it("a cópia recusada é erro com o status", async () => {
    gravar(() => new Response("The resource already exists", { status: 409 }));
    await expect(copiarObjeto(CAMINHO, "17841400000000001/linkedin-v.mp4", 10_000)).rejects.toThrow(/409/);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-video"; cd "$C" || exit 1
npx --no-install vitest run tests/bucket-video.test.ts 2>&1 | tee ../pl3b-f3-red-puros.log
```

Esperado: Nos puros, "Test Files 1 failed (1)" e "Tests 9 failed (9)". Caem: "vem do HEAD do endereço público, sem cache, com o teto pedido"; "o arquivo que não está lá, ou a resposta sem o tamanho, é erro, e o erro não leva o endereço"; "é um GET com o Range dos bytes inclusivos, sem cache, e devolve os bytes da faixa"; "o 200 com o arquivo inteiro é erro: a faixa não foi respeitada"; "o Content-Range diferente do pedido, ou ausente, é erro"; "o corpo menor ou maior que a faixa é erro"; "o arquivo que não está lá é erro com o status, sem o endereço"; "é um POST ao /object/copy, com as duas chaves de serviço e o bucket, a origem e o destino"; "a cópia recusada é erro com o status".

- [ ] **Passo 3: o código**

Em `lib/bucket.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bucket.ts b/lib/bucket.ts
index 2295a72..bb7a2a5 100644
--- a/lib/bucket.ts
+++ b/lib/bucket.ts
@@ -280,6 +280,67 @@ export async function apagarObjeto(caminho: string): Promise<void> {
   if (!r.ok) throw await falha("Nao foi possivel apagar o objeto do bucket", r);
 }
 
+// ---------------------------------------------------------------------------------------------------------------
+// O VÍDEO DO LINKEDIN (a parte 3b; scratchpad/desenho-li3b.md, v3)
+// ---------------------------------------------------------------------------------------------------------------
+
+/**
+ * O TAMANHO DE UM OBJETO, pelo `HEAD` do endereço público, sem cache: é o que a reserva do vídeo pede ao LinkedIn
+ * (o `fileSizeBytes`). O erro leva o status, e não o endereço.
+ */
+export async function tamanhoDoObjeto(caminho: string, tetoMs: number): Promise<number> {
+  const r = await fetch(urlPublicaDoObjeto(caminho), { method: "HEAD", cache: "no-store", signal: AbortSignal.timeout(tetoMs) });
+  if (!r.ok) throw new Error(`o vídeo do post não foi encontrado no armazenamento (HTTP ${r.status})`);
+  const tamanho = Number(r.headers.get("content-length"));
+  if (!r.headers.get("content-length") || !Number.isSafeInteger(tamanho) || tamanho < 0) {
+    throw new Error("o armazenamento não disse o tamanho do vídeo do post");
+  }
+  return tamanho;
+}
+
+const CONTENT_RANGE = /^bytes (\d+)-(\d+)\/(?:\d+|\*)$/;
+
+/**
+ * UMA FAIXA DE UM OBJETO (uma parte do vídeo), pelo `GET` com `Range` no endereço público, sem cache. A faixa no
+ * endereço público foi medida em 16/11 (206, o `Content-Range` certo e os bytes pedidos). A resposta é CONFERIDA
+ * (o 236): o 206, o `Content-Range` igual ao pedido e o tamanho exato. Um 200 com o arquivo inteiro é erro, porque o
+ * envio da parte levaria os bytes errados ao LinkedIn.
+ */
+export async function faixaDoObjeto(caminho: string, inicio: number, fim: number, tetoMs: number): Promise<Uint8Array<ArrayBuffer>> {
+  const r = await fetch(urlPublicaDoObjeto(caminho), {
+    headers: { range: `bytes=${inicio}-${fim}` },
+    cache: "no-store",
+    signal: AbortSignal.timeout(tetoMs),
+  });
+  if (r.status !== 206) {
+    if (r.status === 200) await r.body?.cancel();
+    throw new Error(`o armazenamento não devolveu a faixa pedida do vídeo (HTTP ${r.status})`);
+  }
+  const intervalo = CONTENT_RANGE.exec(r.headers.get("content-range") ?? "");
+  if (!intervalo || Number(intervalo[1]) !== inicio || Number(intervalo[2]) !== fim) {
+    await r.body?.cancel();
+    throw new Error("o armazenamento devolveu outra faixa do vídeo, e não a pedida");
+  }
+  const bytes = new Uint8Array(await r.arrayBuffer());
+  if (bytes.length !== fim - inicio + 1) throw new Error("o armazenamento devolveu a faixa do vídeo com outro tamanho");
+  return bytes;
+}
+
+/**
+ * A CÓPIA NO SERVIDOR DO STORAGE (`POST /storage/v1/object/copy`): o vídeo das duas redes ganha uma cópia para a linha
+ * do LinkedIn sem passar pelo painel. Medida em 16/11 pela sonda (`scratchpad/sonda-copia-storage.mjs`): 200 em
+ * 240 ms, com a cópia igual à origem. O erro leva o status e o começo da resposta, como `falha`.
+ */
+export async function copiarObjeto(origem: string, destino: string, tetoMs: number): Promise<void> {
+  const r = await fetch(`${base()}/storage/v1/object/copy`, {
+    method: "POST",
+    headers: { ...cabecalhosDeServico(), "content-type": "application/json" },
+    body: JSON.stringify({ bucketId: bucket(), sourceKey: origem, destinationKey: destino }),
+    signal: AbortSignal.timeout(tetoMs),
+  });
+  if (!r.ok) throw await falha("Nao foi possivel copiar o objeto no bucket", r);
+}
+
 /**
  * O piso de segurança para quando o bucket NÃO tem teto próprio.
  *
```

- [ ] **Passo 4: rodar e ver passar**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-video"; cd "$C" || exit 1
npx --no-install vitest run tests/bucket-video.test.ts 2>&1 | tee ../pl3b-f3-green-puros.log
npx --no-install vitest run 2>&1 | tee ../pl3b-f3-suite.log
npx --no-install tsc --noEmit
npx --no-install eslint lib/bucket.ts tests/bucket-video.test.ts
git diff --name-only a5cd8d4 -- lib/queue-drain.ts lib/fila-tipos.ts migrations scripts package.json package-lock.json   # vazio
```

Esperado: Nos puros, "Test Files 1 passed (1)" e "Tests 9 passed (9)". A suíte pura inteira: "Test Files 162 passed (162)" e "Tests 3866 passed (3866)". O `tsc` e o lint sem saída, e a guarda vazia.

- [ ] **Passo 5: o commit**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-video"; cd "$C" || exit 1
node ../varrer-texto.mjs lib/bucket.ts tests/bucket-video.test.ts && test "$(git branch --show-current)" = linkedin-video && git add lib/bucket.ts tests/bucket-video.test.ts && git commit -m "O bucket diz o tamanho do vídeo, entrega a faixa de uma parte só se ela vier exata, e copia o vídeo no próprio servidor do Storage"
git show HEAD | git patch-id --stable | cut -c1-12   # be1322ea0304
```

O patch-id tem de começar por `be1322ea0304` (o mesmo do ensaio). Se não começar, pare.

---

### FASE 4 — O vídeo sai pela fila, uma etapa por passada, só se ela terminar antes da hora de parar

**Arquivos:** `lib/linkedin-fila.ts`, `lib/linkedin-publicacao.ts`, `lib/linkedin.ts`, `testes-integracao/dreno-forma-desconhecida.integracao.ts`, `testes-integracao/dreno-hora-de-parar.integracao.ts`, `testes-integracao/linkedin-telas.integracao.ts`, `testes-integracao/linkedin-video.integracao.ts`, `tests/linkedin-forma-conhecida.test.ts`, `tests/linkedin-post.test.ts`, `tests/linkedin-rest.test.ts`.

A forma `"video"` entra em `FORMAS_NO_LINKEDIN`, e com isso o dreno passa a pegá-la (o predicado da 3-0). Os testes da 3-0 que usavam `"video"` como a forma que este código não conhece passam a usar `"enquete"`.

- [ ] **Passo 1: os testes**

Crie `testes-integracao/linkedin-video.integracao.ts`:

```ts
// O VÍDEO EM PARTES NO LINKEDIN PELA FILA (a parte 3b; scratchpad/desenho-li3b.md, v3), contra o banco descartável:
// o ramo do vídeo no dreno do LinkedIn (lib/linkedin-fila.ts). Uma etapa por passada (a reserva, cada parte, o fim e
// o post), o progresso lido do que ficou gravado, as tentativas zeradas na passada que avança, os dois tetos, a
// classificação dos erros de cada etapa, o fim perdido, a mídia que o LinkedIn ainda processa, e o arquivo que só sai
// do bucket com o post publicado (conferido pela lista do bucket falso, e não pelo endereço público: o 239).
//
// O LINKEDIN FALSO E O BUCKET FALSO: dois servidores HTTP na própria máquina, no molde de
// linkedin-carrossel.integracao.ts. O bucket falso responde ao HEAD (o tamanho) e ao GET com Range (a faixa, com 206).
// O `fetch` é interceptado só neste arquivo e RECUSA qualquer endereço que não seja o loopback. **NADA AQUI CHAMA O
// LINKEDIN NEM O BUCKET DE VERDADE.** Valores inventados: nenhuma credencial de verdade entra em teste.
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { bancoDescartavel } from "./harness";
import { tituloDoDocumento } from "@/lib/linkedin-publicacao";

type ModuloDreno = typeof import("@/lib/queue-drain");
type ModuloFila = typeof import("@/lib/linkedin-fila");
type ModuloLinkedin = typeof import("@/lib/linkedin");

const banco = bancoDescartavel();
const q = (texto: string, params: unknown[] = []) =>
  banco.db().sql().query(texto, params) as Promise<Record<string, unknown>[]>;

const CONTA = "17800000000031002";
const PESSOA = "pessoaDoVideoB2";
const TOKEN_DO_LINKEDIN = "AQVautorizacaoDoVideoQueNaoValeNada";
const BUCKET = "midia-do-video";
const CHAVE_DO_BUCKET = "chave-do-bucket-do-video-que-nao-vale-nada";

// UM "VÍDEO" DE 10 BYTES, EM PARTES DE 4: o LinkedIn falso devolve 0-3, 4-7 e 8-9. O tamanho de verdade das partes
// (4 MiB nos exemplos da Videos API) não muda a lógica, e a prova mede o de verdade.
const VIDEO = `${CONTA}/v.mp4`;
const BYTES_DO_VIDEO = Buffer.from([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
const TAMANHO_DA_PARTE = 4;
const TEXTO = "Um vídeo curto sobre o que muda no perfil, para quem está começando agora no LinkedIn #perfil";
const URN = "urn:li:video:V3bFalso";

type Pedido = { metodo: string; caminho: string; cabecalhos: IncomingMessage["headers"]; corpo: Buffer };

const linkedin = {
  pedidos: [] as Pedido[],
  partes: new Map<number, Buffer>(),
  fins: [] as Record<string, unknown>[],
  posts: [] as Record<string, unknown>[],
  /** As próximas respostas do PUT das partes, quando não são o sucesso; o resto responde 200 com o ETag. */
  respostasDasPartes: [] as { status: number; semEtag?: boolean }[],
  respostaDoFim: null as null | { status: number; corpo: string },
  estadoDoVideo: { status: 200, corpo: '{"status":"AVAILABLE"}' } as { status: number; corpo: string },
  respostaDoPost: null as null | { status: number; corpo: string },
  /** O endereço das partes na reserva; o padrão é o do próprio servidor falso. */
  enderecoDasPartes: null as null | string,
  desconhecidos: [] as string[],
};
const bucket = { arquivos: new Map<string, Buffer>(), apagados: [] as string[], faixas: [] as string[], respostaDaFaixa: null as null | number };

let servidorLinkedin: Server;
let servidorBucket: Server;
let dreno: ModuloDreno;
let fila: ModuloFila;
let li: ModuloLinkedin;

function responder(res: ServerResponse, status: number, corpo: unknown, cabecalhos: Record<string, string> = {}) {
  res.writeHead(status, { "content-type": "application/json", ...cabecalhos });
  res.end(typeof corpo === "string" ? corpo : JSON.stringify(corpo));
}

function lerCorpo(req: IncomingMessage): Promise<Buffer> {
  return new Promise((pronto) => {
    const partes: Buffer[] = [];
    req.on("data", (p) => partes.push(p));
    req.on("end", () => pronto(Buffer.concat(partes)));
  });
}

beforeAll(async () => {
  servidorLinkedin = createServer(async (req, res) => {
    const u = new URL(req.url ?? "/", "http://127.0.0.1");
    const corpo = await lerCorpo(req);
    linkedin.pedidos.push({ metodo: req.method ?? "", caminho: u.pathname + u.search, cabecalhos: req.headers, corpo });
    const porta = (servidorLinkedin.address() as AddressInfo).port;
    if (req.method === "POST" && u.pathname === "/rest/videos" && u.searchParams.get("action") === "initializeUpload") {
      const pedido = JSON.parse(corpo.toString()) as { initializeUploadRequest: { fileSizeBytes: number } };
      const tamanho = pedido.initializeUploadRequest.fileSizeBytes;
      const instrucoes = [];
      for (let inicio = 0, n = 0; inicio < tamanho; inicio += TAMANHO_DA_PARTE, n++) {
        instrucoes.push({
          uploadUrl: linkedin.enderecoDasPartes ?? `http://127.0.0.1:${porta}/parte/${n}`,
          firstByte: inicio,
          lastByte: Math.min(inicio + TAMANHO_DA_PARTE, tamanho) - 1,
        });
      }
      return responder(res, 200, { value: { uploadInstructions: instrucoes, video: URN, uploadToken: "token-do-envio-falso" } });
    }
    if (req.method === "PUT" && u.pathname.startsWith("/parte/")) {
      const n = Number(u.pathname.slice("/parte/".length));
      const r = linkedin.respostasDasPartes.shift();
      if (r && r.status !== 200) return responder(res, r.status, "um texto do LinkedIn que não vai para a tela");
      linkedin.partes.set(n, corpo);
      return responder(res, 200, "", r?.semEtag ? {} : { etag: `"etag-${n}"` });
    }
    if (req.method === "POST" && u.pathname === "/rest/videos" && u.searchParams.get("action") === "finalizeUpload") {
      const r = linkedin.respostaDoFim;
      if (r) {
        linkedin.respostaDoFim = null;
        return responder(res, r.status, r.corpo);
      }
      linkedin.fins.push(JSON.parse(corpo.toString()) as Record<string, unknown>);
      return responder(res, 200, "");
    }
    if (req.method === "GET" && u.pathname === `/rest/videos/${encodeURIComponent(URN)}`) {
      return responder(res, linkedin.estadoDoVideo.status, linkedin.estadoDoVideo.corpo);
    }
    if (req.method === "POST" && u.pathname === "/rest/posts") {
      const r = linkedin.respostaDoPost;
      if (r) {
        linkedin.respostaDoPost = null;
        return responder(res, r.status, r.corpo);
      }
      linkedin.posts.push(JSON.parse(corpo.toString()) as Record<string, unknown>);
      return responder(res, 201, "", { "x-restli-id": `urn:li:share:70000000000000005${linkedin.posts.length}` });
    }
    linkedin.desconhecidos.push(`${req.method} ${u.pathname}`);
    responder(res, 404, { message: "o LinkedIn falso não conhece esse caminho" });
  });

  servidorBucket = createServer((req, res) => {
    const u = new URL(req.url ?? "/", "http://127.0.0.1");
    const publico = `/storage/v1/object/public/${BUCKET}/`;
    const privado = `/storage/v1/object/${BUCKET}/`;
    if ((req.method === "GET" || req.method === "HEAD") && u.pathname.startsWith(publico)) {
      const caminho = decodeURIComponent(u.pathname.slice(publico.length));
      const bytes = bucket.arquivos.get(caminho);
      if (!bytes) return responder(res, 404, { message: "não existe" });
      if (req.method === "HEAD") {
        res.writeHead(200, { "content-length": String(bytes.length), "content-type": "video/mp4" });
        return res.end();
      }
      const faixa = /^bytes=(\d+)-(\d+)$/.exec(String(req.headers.range ?? ""));
      if (!faixa || bucket.respostaDaFaixa === 200) {
        bucket.respostaDaFaixa = null;
        res.writeHead(200, { "content-type": "video/mp4" });
        return res.end(bytes);
      }
      const [inicio, fim] = [Number(faixa[1]), Number(faixa[2])];
      bucket.faixas.push(`${inicio}-${fim}`);
      res.writeHead(206, { "content-type": "video/mp4", "content-range": `bytes ${inicio}-${fim}/${bytes.length}` });
      return res.end(bytes.subarray(inicio, fim + 1));
    }
    if (req.method === "DELETE" && u.pathname.startsWith(privado)) {
      if (req.headers["apikey"] !== CHAVE_DO_BUCKET) return responder(res, 401, { message: "sem apikey" });
      const caminho = decodeURIComponent(u.pathname.slice(privado.length));
      bucket.apagados.push(caminho);
      bucket.arquivos.delete(caminho);
      return responder(res, 200, { message: "ok" });
    }
    responder(res, 404, { message: "o bucket falso não conhece esse caminho" });
  });

  await new Promise<void>((pronto) => servidorLinkedin.listen(0, "127.0.0.1", pronto));
  await new Promise<void>((pronto) => servidorBucket.listen(0, "127.0.0.1", pronto));
  process.env.LINKEDIN_API_BASE = `http://127.0.0.1:${(servidorLinkedin.address() as AddressInfo).port}`;
  process.env.SUPABASE_URL = `http://127.0.0.1:${(servidorBucket.address() as AddressInfo).port}`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = CHAVE_DO_BUCKET;
  process.env.SUPABASE_BUCKET = BUCKET;
  delete process.env.QSTASH_TOKEN;

  // O INTERCEPTADOR: só o loopback passa.
  const fetchDeVerdade = globalThis.fetch;
  vi.stubGlobal("fetch", async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof entrada === "string" ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
    if (url.hostname === "127.0.0.1") return fetchDeVerdade(entrada, init);
    throw new Error(`RECUSADO: este teste não chama ${url.origin}`);
  });

  li = await import("@/lib/linkedin");
  dreno = await import("@/lib/queue-drain");
  fila = await import("@/lib/linkedin-fila");

  // AS GUARDAS, ANTES DE QUALQUER REQUISIÇÃO.
  if (li.basesDoLinkedin().api !== process.env.LINKEDIN_API_BASE) {
    throw new Error("RECUSADO: a base do LinkedIn não é a desta rodada. Sem o desvio, este teste publicaria de verdade.");
  }
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(process.env.SUPABASE_URL ?? "")) {
    throw new Error("RECUSADO: a SUPABASE_URL desta rodada não é loopback.");
  }
  await banco.db().upsertAccount({
    ig_user_id: CONTA,
    username: "conta_do_video",
    name: "Vídeo",
    profile_picture_url: null,
    access_token: "ig-token-do-video",
    token_expires_at: null,
  });
});

afterAll(async () => {
  vi.unstubAllGlobals();
  for (const v of ["LINKEDIN_API_BASE", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_BUCKET"]) delete process.env[v];
  await new Promise<void>((pronto) => servidorLinkedin.close(() => pronto()));
  await new Promise<void>((pronto) => servidorBucket.close(() => pronto()));
});

beforeEach(async () => {
  Object.assign(linkedin, {
    pedidos: [],
    partes: new Map(),
    fins: [],
    posts: [],
    respostasDasPartes: [],
    respostaDoFim: null,
    estadoDoVideo: { status: 200, corpo: '{"status":"AVAILABLE"}' },
    respostaDoPost: null,
    enderecoDasPartes: null,
    desconhecidos: [],
  });
  bucket.arquivos = new Map([[VIDEO, BYTES_DO_VIDEO]]);
  bucket.apagados = [];
  bucket.faixas = [];
  bucket.respostaDaFaixa = null;
  await q(`delete from queue`);
  await q(`delete from linkedin_conexoes`);
  await q(
    `insert into linkedin_conexoes (account_id, pessoa_id, nome, access_token, expira_em)
     values ($1, $2, 'Dra. Ana Souza', $3, now() + interval '60 days')`,
    [CONTA, PESSOA, TOKEN_DO_LINKEDIN]
  );
});

const ENVIO = "9f1c2e3d-0000-4000-8000-000000000032";

/** Enfileira o vídeo para agora e devolve o id da linha. */
async function enfileirarOVideo(): Promise<string> {
  const r = await fila.enqueuePublicacaoNoLinkedin(CONTA, { forma: "video", caminhos: [VIDEO], texto: TEXTO, idDoEnvio: ENVIO }, null);
  if (!r.entrou) throw new Error("o vídeo não entrou na fila");
  return r.id;
}

const linha = async (id: string) =>
  (await q(
    `select status, attempts, error, payload, not_before > now() + interval '15 seconds' as espera, not_before > now() + interval '50 seconds' as espera_um_minuto
       from queue where id = $1`,
    [id]
  ))[0] as { status: string; attempts: number; error: string | null; payload: Record<string, unknown>; espera: boolean; espera_um_minuto: boolean };

/** A linha volta a valer já, como o tique seguinte a encontraria. */
const valerJa = (id: string) => q(`update queue set not_before = now() where id = $1`, [id]);

const caminhosDoLinkedin = () => linkedin.pedidos.map((p) => `${p.metodo} ${p.caminho.split("?")[0]}`);

/** Uma passada de cada vez, até a linha fechar; devolve os desfechos. */
async function passadasAteFechar(id: string, maximo = 12): Promise<string[]> {
  const desfechos: string[] = [];
  for (let i = 0; i < maximo; i++) {
    const d = await dreno.drenarUmaPublicacaoDoLinkedin(id);
    desfechos.push(String(d));
    if (d === "publicado" || d === "falhou") return desfechos;
    await valerJa(id);
  }
  return desfechos;
}

describe("o vídeo em partes no LinkedIn", () => {
  it("sai em passadas, uma etapa por vez: a reserva, cada parte, o fim e o post; o arquivo só sai do bucket no fim", async () => {
    const id = await enfileirarOVideo();

    expect(await passadasAteFechar(id)).toEqual(["aguardando", "aguardando", "aguardando", "aguardando", "aguardando", "publicado"]);

    expect(caminhosDoLinkedin()).toEqual([
      "POST /rest/videos",
      "PUT /parte/0",
      "PUT /parte/1",
      "PUT /parte/2",
      "POST /rest/videos",
      "POST /rest/posts",
    ]);
    // A reserva pediu o tamanho do arquivo; as partes levaram as faixas certas, SEM o token (o 234).
    expect(JSON.parse(linkedin.pedidos[0].corpo.toString())).toMatchObject({ initializeUploadRequest: { fileSizeBytes: 10 } });
    expect(bucket.faixas).toEqual(["0-3", "4-7", "8-9"]);
    expect([0, 1, 2].map((n) => Array.from(linkedin.partes.get(n) ?? []))).toEqual([
      [10, 11, 12, 13],
      [14, 15, 16, 17],
      [18, 19],
    ]);
    for (const p of linkedin.pedidos.filter((p) => p.metodo === "PUT")) expect(p.cabecalhos.authorization).toBeUndefined();
    // O fim levou os ETags na ordem; o post, o vídeo e o título pela regra do carrossel.
    expect(linkedin.fins[0]).toEqual({
      finalizeUploadRequest: { video: URN, uploadToken: "token-do-envio-falso", uploadedPartIds: ['"etag-0"', '"etag-1"', '"etag-2"'] },
    });
    expect(linkedin.posts[0]).toMatchObject({ author: `urn:li:person:${PESSOA}`, content: { media: { id: URN, title: tituloDoDocumento(TEXTO) } } });

    const l = await linha(id);
    expect(l.status).toBe("sent");
    expect(l.payload).toMatchObject({ video_urn: URN, video_finalizado: true, passadas_do_video: 5, etags: ['"etag-0"', '"etag-1"', '"etag-2"'] });
    expect(bucket.apagados).toEqual([VIDEO]);
  });

  it("entre as passadas, a linha volta já, com as tentativas zeradas, o motivo do vídeo subindo, e o arquivo ainda no bucket", async () => {
    const id = await enfileirarOVideo();

    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("aguardando");

    const l = await linha(id);
    expect(l).toMatchObject({ status: "pending", attempts: 0, espera: false, error: fila.MOTIVO_VIDEO_SUBINDO });
    expect(l.payload).toMatchObject({ video_urn: URN, upload_token: "token-do-envio-falso", etags: [], passadas_do_video: 1 });
    expect((l.payload.partes as unknown[]).length).toBe(3);
    expect(typeof l.payload.primeira_passada_em).toBe("string");
    expect(bucket.apagados).toEqual([]);
  });

  it("dois erros passageiros, um avanço e mais dois: as tentativas zeram no avanço, e a linha segue até sair", async () => {
    const id = await enfileirarOVideo();
    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("aguardando"); // a reserva
    await valerJa(id);
    linkedin.respostasDasPartes = [{ status: 503 }, { status: 503 }, { status: 200 }, { status: 503 }, { status: 503 }];

    for (let i = 0; i < 2; i++) {
      expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("aguardando");
      await valerJa(id);
    }
    expect((await linha(id)).attempts).toBe(2);
    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("aguardando"); // a parte 0 sai
    expect((await linha(id)).attempts).toBe(0);
    await valerJa(id);
    for (let i = 0; i < 2; i++) {
      expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("aguardando");
      await valerJa(id);
    }
    expect(await linha(id)).toMatchObject({ status: "pending", attempts: 2 });

    expect(await passadasAteFechar(id)).toEqual(["aguardando", "aguardando", "aguardando", "publicado"]);
    expect((await linha(id)).status).toBe("sent");
  });

  it("sem tempo para a etapa (o 231): a linha volta sem gastar a tentativa, sem contar adiamento nem passada, com o payload igual", async () => {
    const id = await enfileirarOVideo();
    // O começo da função há 30 s: a hora de parar é daqui a 10 s, e a reserva pede 20.
    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id, Date.now() - 30_000)).toBe("aguardando");

    const l = await linha(id);
    expect(l).toMatchObject({ status: "pending", attempts: 0, espera: true, error: fila.MOTIVO_SEM_TEMPO });
    expect(l.payload.adiamentos).toBeUndefined();
    expect(l.payload.passadas_do_video).toBeUndefined();
    expect(l.payload.video_urn).toBeUndefined();
    expect(linkedin.pedidos).toEqual([]);
  });

  it("o começo máximo de cada etapa, contra a hora de parar dos 40 s (o 231)", () => {
    const prazo = 1_000_000 + 55_000;
    const aos = (s: number) => 1_000_000 + s * 1000;
    expect(fila.aEtapaDoVideoCabe("reserva", aos(20), prazo)).toBe(true);
    expect(fila.aEtapaDoVideoCabe("reserva", aos(20.001), prazo)).toBe(false);
    expect(fila.aEtapaDoVideoCabe("parte", aos(15), prazo)).toBe(true);
    expect(fila.aEtapaDoVideoCabe("parte", aos(15.001), prazo)).toBe(false);
    expect(fila.aEtapaDoVideoCabe("fim", aos(30), prazo)).toBe(true);
    expect(fila.aEtapaDoVideoCabe("post", aos(30.001), prazo)).toBe(false);
  });
});

describe("os erros de cada etapa do vídeo (o 238)", () => {
  async function reservado(): Promise<string> {
    const id = await enfileirarOVideo();
    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("aguardando");
    await valerJa(id);
    linkedin.pedidos = [];
    return id;
  }

  it("a parte recusada com 403 encerra a linha com o motivo próprio, sem pedir o convite de novo", async () => {
    const id = await reservado();
    linkedin.respostasDasPartes = [{ status: 403 }];
    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("falhou");
    expect(await linha(id)).toMatchObject({ status: "failed", error: fila.MOTIVO_PARTE_RECUSADA });
    expect(bucket.apagados).toEqual([]);
  });

  it("a parte aceita sem o ETag encerra a linha", async () => {
    const id = await reservado();
    linkedin.respostasDasPartes = [{ status: 200, semEtag: true }];
    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("falhou");
    const l = await linha(id);
    expect(l.status).toBe("failed");
    expect(l.error).toContain("sem o ETag");
  });

  it("o endereço de uma parte fora do LinkedIn (um payload torto) encerra a linha, e a parte não sai", async () => {
    const id = await reservado();
    await q(`update queue set payload = jsonb_set(payload, '{partes,0,url}', '"https://www.exemplo.com/parte"') where id = $1`, [id]);
    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("falhou");
    const l = await linha(id);
    expect(l.status).toBe("failed");
    expect(l.error).toContain("não é do LinkedIn");
    expect(caminhosDoLinkedin()).toEqual([]);
  });

  it("a faixa que volta com 200 é erro passageiro: a linha volta, e nada vai ao LinkedIn", async () => {
    const id = await reservado();
    bucket.respostaDaFaixa = 200;
    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("aguardando");
    const l = await linha(id);
    expect(l).toMatchObject({ status: "pending", attempts: 1 });
    expect(l.error).toContain("faixa");
    expect(caminhosDoLinkedin()).toEqual([]);
  });

  it("a conexão vencida encerra antes de chamar o LinkedIn, pedindo o convite de novo, como hoje", async () => {
    const id = await enfileirarOVideo();
    await q(`update linkedin_conexoes set expira_em = now() - interval '1 day' where account_id = $1`, [CONTA]);
    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("falhou");
    expect((await linha(id)).error).toContain("mande o convite de novo");
    expect(linkedin.pedidos).toEqual([]);
  });
});

describe("os tetos do vídeo (o 230 e o 237)", () => {
  it("a linha que passou do teto das passadas encerra com o motivo", async () => {
    const id = await enfileirarOVideo();
    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("aguardando");
    await q(`update queue set not_before = now(), payload = payload || '{"passadas_do_video": 13}'::jsonb where id = $1`, [id]);
    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("falhou");
    expect(await linha(id)).toMatchObject({ status: "failed", error: fila.MOTIVO_VIDEO_PASSADAS_DEMAIS });
  });

  it("o vídeo de mais de 2 horas desde a primeira passada encerra com o motivo", async () => {
    const id = await enfileirarOVideo();
    await q(
      `update queue set payload = payload || jsonb_build_object('primeira_passada_em', to_json(now() - interval '3 hours') #>> '{}') where id = $1`,
      [id]
    );
    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("falhou");
    expect(await linha(id)).toMatchObject({ status: "failed", error: fila.MOTIVO_VIDEO_VELHO });
  });
});

describe("o fim e o post do vídeo", () => {
  async function comTodasAsPartes(): Promise<string> {
    const id = await enfileirarOVideo();
    for (let i = 0; i < 4; i++) {
      expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("aguardando");
      await valerJa(id);
    }
    linkedin.pedidos = [];
    return id;
  }

  it("o fim perdido (o 233): com a marca e sem o fim, o 4xx consulta o estado, e AVAILABLE conta como fim", async () => {
    const id = await comTodasAsPartes();
    await q(`update queue set payload = payload || jsonb_build_object('fim_tentado_em', now()::text) where id = $1`, [id]);
    linkedin.respostaDoFim = { status: 400, corpo: '{"message":"o envio já foi finalizado"}' };

    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("aguardando");
    expect(caminhosDoLinkedin()).toEqual(["POST /rest/videos", "GET /rest/videos/" + encodeURIComponent(URN)]);
    expect((await linha(id)).payload).toMatchObject({ video_finalizado: true });
    await valerJa(id);
    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("publicado");
  });

  it("o fim perdido com o estado que não se lê encerra dizendo que o vídeo pode ter subido", async () => {
    const id = await comTodasAsPartes();
    await q(`update queue set payload = payload || jsonb_build_object('fim_tentado_em', now()::text) where id = $1`, [id]);
    linkedin.respostaDoFim = { status: 400, corpo: "{}" };
    linkedin.estadoDoVideo = { status: 403, corpo: "{}" };

    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("falhou");
    expect(await linha(id)).toMatchObject({ status: "failed", error: fila.MOTIVO_VIDEO_PODE_TER_SUBIDO });
  });

  it("o fim recusado na primeira vez encerra com o erro do LinkedIn, sem consultar o estado", async () => {
    const id = await comTodasAsPartes();
    linkedin.respostaDoFim = { status: 400, corpo: '{"message":"partes erradas"}' };
    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("falhou");
    expect(caminhosDoLinkedin()).toEqual(["POST /rest/videos"]);
    expect((await linha(id)).status).toBe("failed");
  });

  it("o vídeo que o LinkedIn ainda processa: a linha espera um minuto, a consulta conta, e a passada não conta (o 237)", async () => {
    const id = await comTodasAsPartes();
    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("aguardando"); // o fim
    await valerJa(id);
    const passadas = (await linha(id)).payload.passadas_do_video;
    linkedin.respostaDoPost = { status: 400, corpo: '{"code":"MEDIA_ASSET_WAITING_UPLOAD"}' };

    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("aguardando");

    const l = await linha(id);
    expect(l).toMatchObject({ status: "pending", espera_um_minuto: true, error: fila.MOTIVO_VIDEO_PROCESSANDO });
    expect(l.payload).toMatchObject({ consultas_da_midia: 1, passadas_do_video: passadas });
    expect(l.payload.post_tentado_em).toBeUndefined();
  });

  it("na décima primeira consulta, a linha encerra com o motivo do vídeo", async () => {
    const id = await comTodasAsPartes();
    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("aguardando"); // o fim
    await q(`update queue set not_before = now(), payload = payload || '{"consultas_da_midia": 10}'::jsonb where id = $1`, [id]);
    linkedin.respostaDoPost = { status: 400, corpo: '{"code":"MEDIA_ASSET_WAITING_UPLOAD"}' };
    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("falhou");
    expect(await linha(id)).toMatchObject({ status: "failed", error: fila.MOTIVO_VIDEO_NAO_FICOU_PRONTO });
  });

  it("o vídeo que o LinkedIn não conseguiu processar encerra com o motivo que diz o que conferir", async () => {
    const id = await comTodasAsPartes();
    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("aguardando"); // o fim
    await valerJa(id);
    linkedin.respostaDoPost = { status: 400, corpo: '{"code":"MEDIA_ASSET_PROCESSING_FAILED"}' };
    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("falhou");
    expect(await linha(id)).toMatchObject({ status: "failed", error: fila.MOTIVO_VIDEO_PROCESSAMENTO_FALHOU });
    expect(bucket.apagados).toEqual([]);
  });
});
```

Em `testes-integracao/dreno-hora-de-parar.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/dreno-hora-de-parar.integracao.ts b/testes-integracao/dreno-hora-de-parar.integracao.ts
index 929227b..d9fe0fc 100644
--- a/testes-integracao/dreno-hora-de-parar.integracao.ts
+++ b/testes-integracao/dreno-hora-de-parar.integracao.ts
@@ -521,3 +521,43 @@ describe("a devolução só mexe no que este dreno pegou (o 225)", () => {
     expect(resumo.devolvidos).toBe(0);
   });
 });
+
+// O VÍDEO DO LINKEDIN NO LOTE NÃO EMPURRA AS MENSAGENS PARA DEPOIS DA HORA DE PARAR (a parte 3b; o 231). Uma etapa do
+// vídeo só começa se o pior caso dela termina antes dos 40 s; aqui, o vídeo vem primeiro no lote (é o mais antigo), e
+// a parte dele (25 s pelos tetos) não cabe nos 24 s que faltam. Ele volta sem chamar o LinkedIn, sem gastar a tentativa
+// e sem contar adiamento, e as mensagens saem na mesma passada: nenhuma volta à fila.
+describe("o vídeo do LinkedIn no lote (a 3b, o 231)", () => {
+  it("a parte que não termina antes da hora de parar não começa, e as mensagens do mesmo lote saem, sem nada voltar", async () => {
+    const antes = {
+      forma: "video",
+      caminhos: [`${CONTA}/v.mp4`],
+      texto: "O vídeo que vem primeiro no lote",
+      video_urn: "urn:li:video:HoraDeParar",
+      upload_token: "token-do-envio",
+      partes: [{ inicio: 0, fim: 9, url: "https://www.linkedin.com/dms-uploads/V/0" }],
+      etags: [],
+    };
+    const [video] = (await q(
+      `insert into queue (account_id, kind, payload, dedupe_key, not_before)
+       values ($1, 'publicacao_linkedin', $2, 'hora-de-parar:video', now() - interval '2 minutes')
+       returning id`,
+      [CONTA, antes]
+    )) as { id: string }[];
+    await esperar(5);
+    const a = await mensagem("a mensagem depois do vídeo");
+    const b = await mensagem("outra mensagem depois do vídeo");
+
+    const { valor: resumo, linhas } = await comORegistro(() => dreno.drainQueue({ inicioDaFuncaoMs: Date.now() - 16_000 }));
+
+    expect(resumo).toMatchObject({ sent: 2, devolvidos: 0 });
+    expect(meta.textos).toEqual(["a mensagem depois do vídeo", "outra mensagem depois do vídeo"]);
+    for (const id of [a, b]) expect((await linha(id)).status).toBe("sent");
+    expect(await linha(video.id)).toMatchObject({ status: "pending", attempts: 0, vencida: false });
+    const depois = await payloadDe(video.id);
+    expect(depois).toMatchObject(antes);
+    expect(depois.adiamentos).toBeUndefined();
+    expect(depois.passadas_do_video).toBeUndefined();
+    expect(linkedin.pedidos).toEqual([]);
+    expect(linhas).toEqual([]);
+  }, 30_000);
+});
```

Em `testes-integracao/dreno-forma-desconhecida.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/dreno-forma-desconhecida.integracao.ts b/testes-integracao/dreno-forma-desconhecida.integracao.ts
index 5ee3d63..1918ce1 100644
--- a/testes-integracao/dreno-forma-desconhecida.integracao.ts
+++ b/testes-integracao/dreno-forma-desconhecida.integracao.ts
@@ -130,8 +130,9 @@ async function linha(id: string) {
   return l;
 }
 
-// A FORMA NOVA DE EXEMPLO É O VÍDEO (a parte 3b), que este código ainda não publica. Até a 3a, era o carrossel.
-const FORMA_NOVA = { forma: "video", caminhos: [`${CONTA}/a.mp4`], texto: "um vídeo do futuro" };
+// A FORMA NOVA DE EXEMPLO É UMA QUE NENHUMA PARTE PLANEJOU (a enquete), porque este código já publica o vídeo (a
+// parte 3b). Até a 3a, era o carrossel; até a 3b, o vídeo.
+const FORMA_NOVA = { forma: "enquete", caminhos: [`${CONTA}/a.mp4`], texto: "uma enquete do futuro" };
 const TEXTO = { forma: "texto", caminhos: [], texto: "um post só de texto" };
 const IMAGEM = { forma: "imagem", caminhos: [`${CONTA}/c.jpg`], texto: "um post com imagem" };
 
```

Em `testes-integracao/linkedin-telas.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/linkedin-telas.integracao.ts b/testes-integracao/linkedin-telas.integracao.ts
index 90a3330..2829fff 100644
--- a/testes-integracao/linkedin-telas.integracao.ts
+++ b/testes-integracao/linkedin-telas.integracao.ts
@@ -386,8 +386,9 @@ describe("o remarcar e o cancelar de um post do LinkedIn de forma nova", () => {
        returning id, not_before`,
       [
         CONTA_A,
-        // A FORMA NOVA DE EXEMPLO É O VÍDEO (a parte 3b), que este código ainda não publica. Até a 3a, era o carrossel.
-        { forma: "video", caminhos: [`${CONTA_A}/novo-${semente}.mp4`], texto: "um vídeo do futuro" },
+        // A FORMA NOVA DE EXEMPLO É UMA QUE NENHUMA PARTE PLANEJOU (a enquete), porque este código já publica o vídeo
+        // (a parte 3b). Até a 3a, era o carrossel; até a 3b, o vídeo.
+        { forma: "enquete", caminhos: [`${CONTA_A}/novo-${semente}.mp4`], texto: "uma enquete do futuro" },
         `telas-forma-nova-${semente}`,
         emSegundos,
       ]
```

Em `tests/linkedin-forma-conhecida.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/linkedin-forma-conhecida.test.ts b/tests/linkedin-forma-conhecida.test.ts
index e14167e..44f11a8 100644
--- a/tests/linkedin-forma-conhecida.test.ts
+++ b/tests/linkedin-forma-conhecida.test.ts
@@ -13,8 +13,8 @@ import { AVISO_DO_REMARCAR_DA_FORMA_NOVA } from "@/lib/post-da-fila";
 // efeito dele contra o Postgres de verdade está em testes-integracao/dreno-forma-desconhecida.integracao.ts.
 
 describe("as formas do post do LinkedIn que este código conhece", () => {
-  it("são as que o ramo do dreno publica hoje: só texto, imagem e o carrossel em PDF (a parte 3a)", () => {
-    expect([...FORMAS_NO_LINKEDIN]).toEqual(["texto", "imagem", "carrossel"]);
+  it("são as que o ramo do dreno publica hoje: só texto, imagem, o carrossel em PDF (a parte 3a) e o vídeo em partes (a parte 3b)", () => {
+    expect([...FORMAS_NO_LINKEDIN]).toEqual(["texto", "imagem", "carrossel", "video"]);
   });
 });
 
```

Em `tests/linkedin-post.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/linkedin-post.test.ts b/tests/linkedin-post.test.ts
index c2ce91a..6b1f111 100644
--- a/tests/linkedin-post.test.ts
+++ b/tests/linkedin-post.test.ts
@@ -3,6 +3,7 @@ import {
   aMidiaAindaNaoEstaPronta,
   corpoDoPost,
   desfechoDoErroDoLinkedin,
+  estadoDoEnvioDoVideo,
   formaNoLinkedinDoCampo,
   LIMITE_DO_TEXTO_DO_LINKEDIN,
   lerPayloadDoLinkedin,
@@ -19,17 +20,19 @@ import {
 // AS REGRAS PURAS DO POST NO LINKEDIN (docs/specs/2026-11-06-linkedin-no-perfil.md, §5; a parte 2a: só texto e
 // imagem, uma rede por post). A tela de publicar e o servidor leem as mesmas funções.
 
-describe("as formas do LinkedIn (a 2a e o carrossel da 3a)", () => {
-  it("são só texto, imagem e carrossel; o resto, inclusive o que é só do Instagram, não vale", () => {
+describe("as formas do LinkedIn (a 2a, o carrossel da 3a e o vídeo da 3b)", () => {
+  it("são só texto, imagem, carrossel e vídeo; o resto, inclusive o que é só do Instagram, não vale", () => {
     expect(formaNoLinkedinDoCampo("texto")).toBe("texto");
     expect(formaNoLinkedinDoCampo("imagem")).toBe("imagem");
     expect(formaNoLinkedinDoCampo("carrossel")).toBe("carrossel");
-    for (const outra of ["reels", "video", "story", "", null, undefined, ["texto"]]) {
+    expect(formaNoLinkedinDoCampo("video")).toBe("video");
+    for (const outra of ["reels", "enquete", "story", "", null, undefined, ["texto"]]) {
       expect(formaNoLinkedinDoCampo(outra)).toBeNull();
     }
     expect(rotuloDaFormaNoLinkedin("texto")).toBe("Só texto");
     expect(rotuloDaFormaNoLinkedin("imagem")).toBe("Imagem");
     expect(rotuloDaFormaNoLinkedin("carrossel")).toBe("Carrossel (PDF)");
+    expect(rotuloDaFormaNoLinkedin("video")).toBe("Vídeo");
   });
 });
 
@@ -123,6 +126,14 @@ describe("o payload da linha do LinkedIn na fila", () => {
       adiamentos: 0,
       postTentadoEm: "2026-11-09T19:00:00Z",
       postUrn: "urn:li:share:1",
+      videoUrn: null,
+      uploadToken: null,
+      partes: null,
+      etags: [],
+      fimTentadoEm: null,
+      videoFinalizado: false,
+      passadasDoVideo: 0,
+      primeiraPassadaEm: null,
     });
   });
 
@@ -151,7 +162,7 @@ describe("o payload da linha do LinkedIn na fila", () => {
   });
 
   it("recusa a forma desconhecida, o texto com arquivo e a imagem sem arquivo, ou com dois", () => {
-    expect(lerPayloadDoLinkedin({ forma: "video", caminhos: ["a/b.mp4"], texto: "x" })).toBeNull();
+    expect(lerPayloadDoLinkedin({ forma: "enquete", caminhos: ["a/b.mp4"], texto: "x" })).toBeNull();
     expect(lerPayloadDoLinkedin({ forma: "texto", caminhos: ["a/b.jpg"], texto: "x" })).toBeNull();
     expect(lerPayloadDoLinkedin({ forma: "imagem", caminhos: [], texto: "x" })).toBeNull();
     expect(lerPayloadDoLinkedin({ forma: "imagem", caminhos: ["a/b.jpg", "a/c.jpg"], texto: "x" })).toBeNull();
@@ -244,3 +255,57 @@ describe("o documento que o LinkedIn ainda processa", () => {
     expect(aMidiaAindaNaoEstaPronta(500, "PROCESSING")).toBe(false);
   });
 });
+
+// O PAYLOAD DO VÍDEO EM PARTES (a parte 3b; o 230): a reserva, os ETags em sequência (sem os vazios), o fim, as
+// passadas e a primeira passada, e o estado do envio que sai deles.
+describe("o payload do vídeo na fila", () => {
+  const base = { forma: "video", caminhos: ["conta/v.mp4"], texto: "Um vídeo novo" };
+  const partes = [
+    { inicio: 0, fim: 4194303, url: "https://www.linkedin.com/dms-uploads/V/1" },
+    { inicio: 4194304, fim: 5000000, url: "https://www.linkedin.com/dms-uploads/V/2" },
+  ];
+
+  it("o vídeo leva um arquivo, e sem a reserva o estado é o do começo", () => {
+    const pub = lerPayloadDoLinkedin(base);
+    expect(pub).toMatchObject({ forma: "video", videoUrn: null, partes: null, etags: [], videoFinalizado: false, passadasDoVideo: 0 });
+    expect(estadoDoEnvioDoVideo(pub!)).toEqual({ reservado: false, partes: 0, etags: 0, finalizado: false });
+    expect(lerPayloadDoLinkedin({ ...base, caminhos: [] })).toBeNull();
+  });
+
+  it("lê a reserva, os ETags gravados e o fim; o token do envio vazio vale", () => {
+    const pub = lerPayloadDoLinkedin({
+      ...base,
+      video_urn: "urn:li:video:V",
+      upload_token: "",
+      partes,
+      etags: ['"e1"'],
+      fim_tentado_em: "2026-11-16T15:00:00Z",
+      passadas_do_video: 3,
+      primeira_passada_em: "2026-11-16T14:58:00Z",
+    })!;
+    expect(pub).toMatchObject({ videoUrn: "urn:li:video:V", uploadToken: "", partes, etags: ['"e1"'], passadasDoVideo: 3 });
+    expect(estadoDoEnvioDoVideo(pub)).toEqual({ reservado: true, partes: 2, etags: 1, finalizado: false });
+    expect(estadoDoEnvioDoVideo({ ...pub, etags: ['"e1"', '"e2"'], videoFinalizado: true })).toEqual({
+      reservado: true,
+      partes: 2,
+      etags: 2,
+      finalizado: true,
+    });
+  });
+
+  it("os ETags contam em sequência e param no primeiro vazio ou que não é texto (o 230)", () => {
+    const ler = (etags: unknown) => lerPayloadDoLinkedin({ ...base, video_urn: "urn:li:video:V", upload_token: "t", partes, etags })!.etags;
+    expect(ler(['"e1"', "", '"e3"'])).toEqual(['"e1"']);
+    expect(ler(["", '"e2"'])).toEqual([]);
+    expect(ler([null, '"e2"'])).toEqual([]);
+    expect(ler("nao-e-lista")).toEqual([]);
+  });
+
+  it("as partes tortas, ou o URN sem token, não contam como reserva", () => {
+    const ler = (extra: Record<string, unknown>) => estadoDoEnvioDoVideo(lerPayloadDoLinkedin({ ...base, video_urn: "urn:li:video:V", ...extra })!);
+    expect(ler({ upload_token: "t", partes: [{ inicio: "0", fim: 9, url: "x" }] }).reservado).toBe(false);
+    expect(ler({ upload_token: "t", partes: [] }).reservado).toBe(false);
+    expect(ler({ partes }).reservado).toBe(false);
+    expect(ler({ upload_token: "t", partes }).reservado).toBe(true);
+  });
+});
```

Em `tests/linkedin-rest.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/linkedin-rest.test.ts b/tests/linkedin-rest.test.ts
index dfbb6ee..5e63dba 100644
--- a/tests/linkedin-rest.test.ts
+++ b/tests/linkedin-rest.test.ts
@@ -13,6 +13,7 @@ import {
   nomeLimpo,
   reservarDocumento,
   reservarVideo,
+  STATUS_RECUSADO_PELO_PAINEL,
   TETO_DO_ENVIO_DA_IMAGEM_MS,
   TETO_DO_ENVIO_DA_PARTE_MS,
   TETO_DO_ENVIO_DO_DOCUMENTO_MS,
@@ -328,7 +329,10 @@ describe("o envio de uma parte do vídeo (o 234)", () => {
 
   it("o endereço que não é do LinkedIn não recebe a parte: o vídeo é do cliente", async () => {
     const pedidos = gravar(() => new Response("", { status: 200, headers: { etag: "e" } }));
-    await expect(enviarParteDoVideo("https://www.exemplo.com/x", new Uint8Array(3))).rejects.toMatchObject({ name: "LinkedinError", status: 0 });
+    await expect(enviarParteDoVideo("https://www.exemplo.com/x", new Uint8Array(3))).rejects.toMatchObject({
+      name: "LinkedinError",
+      status: STATUS_RECUSADO_PELO_PAINEL,
+    });
     expect(pedidos).toHaveLength(0);
   });
 
@@ -403,7 +407,7 @@ describe("o redirecionamento não é seguido", () => {
     try {
       await expect(enviarParteDoVideo(`http://127.0.0.1:${portaOrigem}/envio`, new Uint8Array([1, 2, 3]))).rejects.toMatchObject({
         name: "LinkedinError",
-        status: 0,
+        status: STATUS_RECUSADO_PELO_PAINEL,
       });
       expect(recebidos).toEqual([]);
     } finally {
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-video"; cd "$C" || exit 1
npx --no-install vitest run tests/linkedin-forma-conhecida.test.ts tests/linkedin-post.test.ts tests/linkedin-rest.test.ts 2>&1 | tee ../pl3b-f4-red-puros.log
docker ps --format '{{.Names}} {{.Status}}' | grep metodochat-banco-de-teste   # healthy; senão, docker start e espere healthy
DATABASE_URL_TESTES=postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes npx --no-install vitest run --config vitest.integracao.config.ts testes-integracao/linkedin-video.integracao.ts testes-integracao/dreno-hora-de-parar.integracao.ts testes-integracao/dreno-forma-desconhecida.integracao.ts testes-integracao/linkedin-telas.integracao.ts 2>&1 | tee ../pl3b-f4-red-integ.log
```

Esperado: Nos puros, "Test Files 3 failed (3)" e "Tests 9 failed | 56 passed (65)". Caem: "são as que o ramo do dreno publica hoje: só texto, imagem, o carrossel em PDF (a parte 3a) e o vídeo em partes (a parte 3b)"; "são só texto, imagem, carrossel e vídeo; o resto, inclusive o que é só do Instagram, não vale"; "grava a forma, os caminhos e o texto, e lê de volta com as marcas dos passos"; "o vídeo leva um arquivo, e sem a reserva o estado é o do começo"; "lê a reserva, os ETags gravados e o fim; o token do envio vazio vale"; "os ETags contam em sequência e param no primeiro vazio ou que não é texto (o 230)"; "as partes tortas, ou o URN sem token, não contam como reserva"; "o endereço que não é do LinkedIn não recebe a parte: o vídeo é do cliente"; "a parte que recebe um 307 não vai ao endereço do redirecionamento". Na integração, `ALVO: banco de TESTE`, nenhum `teste_tmp` antes e depois, "Test Files 2 failed | 2 passed (4)" e "Tests 19 failed | 42 passed (61)". Caem: "a parte que não termina antes da hora de parar não começa, e as mensagens do mesmo lote saem, sem nada voltar"; "sai em passadas, uma etapa por vez: a reserva, cada parte, o fim e o post; o arquivo só sai do bucket no fim"; "entre as passadas, a linha volta já, com as tentativas zeradas, o motivo do vídeo subindo, e o arquivo ainda no bucket"; "dois erros passageiros, um avanço e mais dois: as tentativas zeram no avanço, e a linha segue até sair"; "sem tempo para a etapa (o 231): a linha volta sem gastar a tentativa, sem contar adiamento nem passada, com o payload igual"; "o começo máximo de cada etapa, contra a hora de parar dos 40 s (o 231)"; "a parte recusada com 403 encerra a linha com o motivo próprio, sem pedir o convite de novo"; "a parte aceita sem o ETag encerra a linha"; "o endereço de uma parte fora do LinkedIn (um payload torto) encerra a linha, e a parte não sai"; "a faixa que volta com 200 é erro passageiro: a linha volta, e nada vai ao LinkedIn"; "a conexão vencida encerra antes de chamar o LinkedIn, pedindo o convite de novo, como hoje"; "a linha que passou do teto das passadas encerra com o motivo"; "o vídeo de mais de 2 horas desde a primeira passada encerra com o motivo"; "o fim perdido (o 233): com a marca e sem o fim, o 4xx consulta o estado, e AVAILABLE conta como fim"; "o fim perdido com o estado que não se lê encerra dizendo que o vídeo pode ter subido"; "o fim recusado na primeira vez encerra com o erro do LinkedIn, sem consultar o estado"; "o vídeo que o LinkedIn ainda processa: a linha espera um minuto, a consulta conta, e a passada não conta (o 237)"; "na décima primeira consulta, a linha encerra com o motivo do vídeo"; "o vídeo que o LinkedIn não conseguiu processar encerra com o motivo que diz o que conferir".

- [ ] **Passo 3: o código**

Em `lib/linkedin-publicacao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/linkedin-publicacao.ts b/lib/linkedin-publicacao.ts
index eb34cfe..5221850 100644
--- a/lib/linkedin-publicacao.ts
+++ b/lib/linkedin-publicacao.ts
@@ -56,9 +56,9 @@ export type FormaNoLinkedin = "texto" | "imagem" | "carrossel" | "video";
 /**
  * AS FORMAS QUE ESTE CÓDIGO SABE PUBLICAR NO LINKEDIN, numa lista só: a do formulário, a do payload e a do dreno
  * (`soAFormaConhecidaDoLinkedin`, abaixo). Uma forma acrescentada aqui é uma forma que o dreno passa a pegar: o
- * carrossel entrou junto com o ramo dele (lib/linkedin-fila.ts), e o vídeo também entra só com o ramo dele.
+ * carrossel entrou junto com o ramo dele (lib/linkedin-fila.ts), e o vídeo também entra só com o ramo dele (a 3b).
  */
-export const FORMAS_NO_LINKEDIN: readonly FormaNoLinkedin[] = ["texto", "imagem", "carrossel"];
+export const FORMAS_NO_LINKEDIN: readonly FormaNoLinkedin[] = ["texto", "imagem", "carrossel", "video"];
 
 /**
  * QUANTOS ARQUIVOS CADA FORMA LEVA, numa função só, para o pedido e para o payload: o só texto nenhum, a imagem e o
@@ -311,6 +311,16 @@ export type PayloadDoLinkedin = {
   adiamentos?: number;
   post_tentado_em?: string;
   post_urn?: string;
+  // O VÍDEO EM PARTES (a parte 3b): a reserva (o URN, o token do envio e as partes, num `update` só), os ETags
+  // gravados um a um pelo índice da parte, a marca e o fim, as passadas que começaram uma etapa e a primeira passada.
+  video_urn?: string;
+  upload_token?: string;
+  partes?: { inicio: number; fim: number; url: string }[];
+  etags?: string[];
+  fim_tentado_em?: string;
+  video_finalizado?: boolean;
+  passadas_do_video?: number;
+  primeira_passada_em?: string;
 };
 
 export function payloadDoLinkedin(pedido: { forma: FormaNoLinkedin; caminhos: string[]; texto: string }): PayloadDoLinkedin {
@@ -327,6 +337,18 @@ export type LeituraDoPayloadDoLinkedin = {
   adiamentos: number;
   postTentadoEm: string | null;
   postUrn: string | null;
+  /** O vídeo em partes (a parte 3b); nas outras formas, tudo vazio. */
+  videoUrn: string | null;
+  /** O token do envio pode vir vazio no vídeo de uma parte só: null é "não veio". */
+  uploadToken: string | null;
+  /** As partes da reserva, ou null quando não vieram, ou vieram tortas. */
+  partes: { inicio: number; fim: number; url: string }[] | null;
+  /** Os ETags gravados EM SEQUÊNCIA desde a primeira parte, sem os vazios (o 230). */
+  etags: string[];
+  fimTentadoEm: string | null;
+  videoFinalizado: boolean;
+  passadasDoVideo: number;
+  primeiraPassadaEm: string | null;
 };
 
 /** Lê o payload, ou null: a forma tem de ser da lista, o texto tem de ser texto, e a quantidade de arquivos a da forma. */
@@ -351,6 +373,52 @@ export function lerPayloadDoLinkedin(bruto: unknown): LeituraDoPayloadDoLinkedin
     adiamentos: contagem(p.adiamentos),
     postTentadoEm: texto(p.post_tentado_em),
     postUrn: texto(p.post_urn),
+    videoUrn: texto(p.video_urn),
+    uploadToken: typeof p.upload_token === "string" ? p.upload_token : null,
+    partes: partesDoPayload(p.partes),
+    etags: etagsEmSequencia(p.etags),
+    fimTentadoEm: texto(p.fim_tentado_em),
+    videoFinalizado: p.video_finalizado === true,
+    passadasDoVideo: contagem(p.passadas_do_video),
+    primeiraPassadaEm: texto(p.primeira_passada_em),
+  };
+}
+
+/** As partes gravadas, só se todas tiverem o início e o fim inteiros e o endereço em texto. */
+function partesDoPayload(v: unknown): { inicio: number; fim: number; url: string }[] | null {
+  if (!Array.isArray(v) || v.length === 0) return null;
+  const partes: { inicio: number; fim: number; url: string }[] = [];
+  for (const p of v) {
+    if (!p || typeof p !== "object") return null;
+    const { inicio, fim, url } = p as Record<string, unknown>;
+    if (!Number.isSafeInteger(inicio) || !Number.isSafeInteger(fim) || typeof url !== "string" || !url) return null;
+    partes.push({ inicio: inicio as number, fim: fim as number, url });
+  }
+  return partes;
+}
+
+/**
+ * OS ETAGS QUE CONTAM (o 230): em sequência desde a primeira parte, parando no primeiro que falta ou que está vazio.
+ * As partes vão em ordem, uma por passada; um buraco seria um payload torto, e a parte do buraco é a próxima a ir.
+ */
+function etagsEmSequencia(v: unknown): string[] {
+  if (!Array.isArray(v)) return [];
+  const etags: string[] = [];
+  for (const e of v) {
+    if (typeof e !== "string" || !e) break;
+    etags.push(e);
+  }
+  return etags;
+}
+
+/** O que já foi feito no envio do vídeo, lido do payload gravado (o 230). */
+export function estadoDoEnvioDoVideo(pub: LeituraDoPayloadDoLinkedin): EstadoDoEnvioDoVideo {
+  const reservado = !!pub.videoUrn && pub.uploadToken !== null && pub.partes !== null;
+  return {
+    reservado,
+    partes: reservado ? (pub.partes as unknown[]).length : 0,
+    etags: reservado ? pub.etags.length : 0,
+    finalizado: reservado && pub.videoFinalizado,
   };
 }
 
@@ -430,6 +498,15 @@ export function aMidiaAindaNaoEstaPronta(status: number, texto: string): boolean
   return status === 400 && /WAITING_UPLOAD|PROCESSING(?!_FAILED)/.test(texto);
 }
 
+/**
+ * O VÍDEO QUE O LINKEDIN NÃO CONSEGUIU PROCESSAR (a parte 3b): o 400 "MEDIA_ASSET_PROCESSING_FAILED" da Videos API
+ * ("Processing failed due to client error such as file size too large, unsupported file format"). O post não foi
+ * criado, e repetir não ajuda: a linha encerra com um motivo que diz o que conferir.
+ */
+export function oProcessamentoFalhou(status: number, texto: string): boolean {
+  return status === 400 && /PROCESSING_FAILED/.test(texto);
+}
+
 // ---------------------------------------------------------------------------------------------------------------
 // O CARROSSEL EM PDF (a parte 3a; scratchpad/desenho-li3.md, §6)
 // ---------------------------------------------------------------------------------------------------------------
```

Em `lib/linkedin.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/linkedin.ts b/lib/linkedin.ts
index ffb8af7..8f17d94 100644
--- a/lib/linkedin.ts
+++ b/lib/linkedin.ts
@@ -7,7 +7,7 @@ import "server-only";
 // AS CHAVES DO APP (`LINKEDIN_CLIENT_ID` e `LINKEDIN_CLIENT_SECRET`) FICAM SÓ NAS VARIÁVEIS DA VERCEL, nunca no
 // código nem no banco, porque o repositório é público (§8). Sem as duas, o LinkedIn fica desligado no painel.
 
-import { aMidiaAindaNaoEstaPronta } from "./linkedin-publicacao";
+import { aMidiaAindaNaoEstaPronta, oProcessamentoFalhou } from "./linkedin-publicacao";
 
 const OAUTH = "https://www.linkedin.com";
 const API = "https://api.linkedin.com";
@@ -103,19 +103,33 @@ export class LinkedinError extends Error {
    * LinkedIn pode vir depois (nota da auditoria sobre a F3).
    */
   midiaNaoPronta: boolean;
-  constructor(status: number, texto: string, midiaNaoPronta = false) {
+  /**
+   * O POST RECUSADO PORQUE O LINKEDIN NÃO CONSEGUIU PROCESSAR O VÍDEO (`MEDIA_ASSET_PROCESSING_FAILED`, a parte 3b),
+   * decidido também na resposta inteira.
+   */
+  processamentoFalhou: boolean;
+  constructor(status: number, texto: string, midiaNaoPronta = false, processamentoFalhou = false) {
     super(`LinkedIn ${status}: ${texto}`);
     this.name = "LinkedinError";
     this.status = status;
     this.texto = texto;
     this.midiaNaoPronta = midiaNaoPronta;
+    this.processamentoFalhou = processamentoFalhou;
   }
 }
 
+/**
+ * O PEDIDO QUE O PAINEL RECUSOU SEM CHEGAR AO LINKEDIN, e que repetir não conserta (a nota da auditoria sobre a F2 da
+ * 3b): o redirecionamento recusado, e o endereço de uma parte do vídeo fora da regra do domínio. Não é um status de
+ * HTTP: `desfechoDoErroDoLinkedin` o trata como permanente, e não como a rede (status 0), que passa.
+ */
+export const STATUS_RECUSADO_PELO_PAINEL = -1;
+
 /**
  * TODA CHAMADA AO LINKEDIN PASSA POR AQUI, com o teto de tempo e SEM SEGUIR REDIRECIONAMENTO (o 234, a parte 3b): a
  * regra do domínio (`enderecoDeEnvioConfiavel`) confere só o primeiro endereço, e um 3xx para fora do LinkedIn
- * levaria junto o token, ou a parte do vídeo do cliente. O redirecionamento vira erro de rede (status 0).
+ * levaria junto o token, ou a parte do vídeo do cliente. O redirecionamento recusado é permanente
+ * (`STATUS_RECUSADO_PELO_PAINEL`).
  */
 async function chamar(
   url: string,
@@ -131,6 +145,11 @@ async function chamar(
     if (err instanceof Error && err.name === "TimeoutError") {
       throw new LinkedinError(0, `${onde} não respondeu em ${tetoMs}ms`);
     }
+    // O `fetch` do Node recusa o 3xx com um erro de rede cuja causa fala do redirecionamento.
+    const causa = err instanceof Error ? (err as Error & { cause?: unknown }).cause : undefined;
+    if (causa instanceof Error && /redirect/i.test(causa.message)) {
+      throw new LinkedinError(STATUS_RECUSADO_PELO_PAINEL, `${onde} redirecionou, e a chamada não seguiu`);
+    }
     throw new LinkedinError(0, `${onde} falhou na rede`);
   }
 }
@@ -374,7 +393,7 @@ export async function reservarVideo(
  */
 export async function enviarParteDoVideo(uploadUrl: string, bytes: Uint8Array<ArrayBuffer>): Promise<string> {
   if (!enderecoDeEnvioConfiavel(uploadUrl)) {
-    throw new LinkedinError(0, "o endereço de envio do vídeo não é do LinkedIn");
+    throw new LinkedinError(STATUS_RECUSADO_PELO_PAINEL, "o endereço de envio do vídeo não é do LinkedIn");
   }
   const r = await chamar(uploadUrl, { method: "PUT", headers: { "content-type": "application/octet-stream" }, body: bytes }, TETO_DO_ENVIO_DA_PARTE_MS);
   if (r.status !== 200 && r.status !== 201) throw new LinkedinError(r.status, `o LinkedIn recusou a parte do vídeo (${r.status})`);
@@ -419,7 +438,9 @@ export async function criarPost(token: string, corpo: Record<string, unknown>):
     headers: cabecalhosDoRest(token),
     body: JSON.stringify(corpo),
   });
-  if (r.status !== 201) throw new LinkedinError(r.status, r.texto.slice(0, 300), aMidiaAindaNaoEstaPronta(r.status, r.texto));
+  if (r.status !== 201) {
+    throw new LinkedinError(r.status, r.texto.slice(0, 300), aMidiaAindaNaoEstaPronta(r.status, r.texto), oProcessamentoFalhou(r.status, r.texto));
+  }
   if (!r.restliId) throw new LinkedinError(r.status, "o post saiu sem o x-restli-id");
   return r.restliId;
 }
```

Em `lib/linkedin-fila.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/linkedin-fila.ts b/lib/linkedin-fila.ts
index 90994ad..c424ebc 100644
--- a/lib/linkedin-fila.ts
+++ b/lib/linkedin-fila.ts
@@ -7,22 +7,34 @@ export type ResultadoDoLinkedin = { entrou: false } | (Extract<ResultadoDaPublic
 import { scheduleTick, HORIZONTE_DO_TIQUE_EM_SEGUNDOS } from "./qstash";
 import { atrasoDoTiqueDaPublicacao } from "./publicacao";
 import { chaveDaPublicacaoNoLinkedin } from "./dedupe";
-import { urlPublicaDoObjeto } from "./bucket";
+import { faixaDoObjeto, tamanhoDoObjeto, urlPublicaDoObjeto } from "./bucket";
+import { RESERVA_PARA_TERMINAR_MS } from "./fila-tipos";
 import { conexaoDaConta } from "./linkedin-conexoes";
 import {
   criarPost,
   enviarDocumento,
   enviarImagem,
+  enviarParteDoVideo,
+  estadoDoVideo,
+  finalizarVideo,
   LinkedinError,
   reservarDocumento,
   reservarImagem,
+  reservarVideo,
   TETO_DO_ENVIO_DA_IMAGEM_MS,
+  TETO_DO_ENVIO_DA_PARTE_MS,
   TETO_DO_ENVIO_DO_DOCUMENTO_MS,
   TETO_DO_LINKEDIN_MS,
 } from "./linkedin";
 import {
   corpoDoPost,
+  desfechoDoErroDaParte,
   desfechoDoErroDoLinkedin,
+  estadoDoEnvioDoVideo,
+  progressoDoVideo,
+  proximaEtapaDoVideo,
+  tetoDoVideoAtingido,
+  type EtapaDoVideo,
   lerPayloadDoLinkedin,
   motivoDaAutorizacaoRecusada,
   oPostPodeTerSaido,
@@ -217,6 +229,46 @@ const ESPERA_DA_MIDIA_EM_SEGUNDOS = 60;
 export const MOTIVO_MIDIA_PROCESSANDO = "o LinkedIn ainda está processando o documento; o post sai na próxima consulta";
 export const MOTIVO_MIDIA_NAO_FICOU_PRONTA = "o LinkedIn não terminou de processar o documento a tempo; publique de novo";
 
+// ---------------------------------------------------------------------------------------------------------------
+// O VÍDEO EM PARTES (a parte 3b; scratchpad/desenho-li3b.md, v3)
+// ---------------------------------------------------------------------------------------------------------------
+
+/**
+ * O VÍDEO PODE PROCESSAR POR MAIS TEMPO QUE O DOCUMENTO (o §3.5): 10 consultas, uma por minuto, contra 5 do documento.
+ * A prova mede o tempo de verdade. Os motivos dizem a mídia certa.
+ */
+export const CONSULTAS_DO_VIDEO_MAX = 10;
+export const MOTIVO_VIDEO_PROCESSANDO = "o LinkedIn ainda está processando o vídeo; o post sai na próxima consulta";
+export const MOTIVO_VIDEO_NAO_FICOU_PRONTO = "o LinkedIn não terminou de processar o vídeo a tempo; publique de novo";
+export const MOTIVO_VIDEO_PROCESSAMENTO_FALHOU = "o LinkedIn não conseguiu processar o vídeo; confira se ele é um MP4 comum";
+export const MOTIVO_VIDEO_SUBINDO = "o vídeo está subindo ao LinkedIn, em partes; o post sai em alguns minutos";
+export const MOTIVO_VIDEO_PASSADAS_DEMAIS = "o vídeo não terminou de subir ao LinkedIn depois de muitas passadas; publique de novo";
+export const MOTIVO_VIDEO_VELHO = "o vídeo não terminou de subir ao LinkedIn em 2 horas; publique de novo";
+export const MOTIVO_PARTE_RECUSADA = "o LinkedIn recusou o envio de uma parte do vídeo; publique de novo";
+export const MOTIVO_VIDEO_PODE_TER_SUBIDO =
+  "o vídeo pode ter terminado de subir ao LinkedIn sem a confirmação chegar; publique de novo";
+
+/**
+ * O PIOR CASO DE CADA ETAPA DO VÍDEO, pelos tetos (o §3.3): a reserva (o tamanho pelo bucket e a reserva), uma parte
+ * (a faixa do bucket e o envio dela), o fim e o post.
+ */
+export const PIOR_CASO_DA_ETAPA_DO_VIDEO_MS: Readonly<Record<EtapaDoVideo, number>> = {
+  reserva: TETO_DO_BUCKET_MS + TETO_DO_LINKEDIN_MS,
+  parte: TETO_DO_BUCKET_MS + TETO_DO_ENVIO_DA_PARTE_MS,
+  fim: TETO_DO_LINKEDIN_MS,
+  post: TETO_DO_LINKEDIN_MS,
+};
+
+/**
+ * UMA ETAPA POR PASSADA, que só começa se o pior caso dela termina ANTES da hora de parar da 3a-0 (o 231): o prazo do
+ * dreno menos a reserva para terminar (lib/fila-tipos.ts). Com o prazo de 55 s, a hora de parar é aos 40 s: a reserva
+ * começa até os 20 s, a parte até os 15 s, e o fim e o post até os 30 s. Assim, nenhuma mensagem do mesmo lote volta à
+ * fila por causa do vídeo.
+ */
+export function aEtapaDoVideoCabe(etapa: EtapaDoVideo, agoraMs: number, prazoMs: number): boolean {
+  return agoraMs + PIOR_CASO_DA_ETAPA_DO_VIDEO_MS[etapa] <= prazoMs - RESERVA_PARA_TERMINAR_MS;
+}
+
 /**
  * A LINHA VOLTA À FILA SEM GASTAR A TENTATIVA: a reivindicação contou uma, e nada foi tentado. Sem o desconto,
  * três passadas sem tempo levariam o primeiro erro passageiro a encerrar a linha. O adiamento fica contado no payload.
@@ -251,16 +303,102 @@ async function adiarOuEncerrar(
  * O DOCUMENTO AINDA NÃO ESTÁ PRONTO: o post não foi criado (o 4xx prova), então a marca do POST sai, e a linha volta
  * em um minuto sem gastar a tentativa, com a consulta contada.
  */
-async function esperarAMidia(id: string, consultas: number): Promise<void> {
+async function esperarAMidia(id: string, consultas: number, motivo: string = MOTIVO_MIDIA_PROCESSANDO): Promise<void> {
   await sql().query(
     `update queue set status = 'pending', attempts = greatest(attempts - 1, 0),
             not_before = now() + make_interval(secs => $2::int), error = $3,
             payload = (payload - 'post_tentado_em') || jsonb_build_object('consultas_da_midia', $4::int)
       where id = $1`,
-    [id, ESPERA_DA_MIDIA_EM_SEGUNDOS, MOTIVO_MIDIA_PROCESSANDO, consultas]
+    [id, ESPERA_DA_MIDIA_EM_SEGUNDOS, motivo, consultas]
   );
 }
 
+/**
+ * O VÍDEO SEM TEMPO PARA A ETAPA DESTA PASSADA volta à fila sem gastar a tentativa e SEM contar adiamento (o 230): o
+ * teto dele é o de idade. O payload não muda.
+ */
+async function devolverOVideoSemContar(id: string): Promise<void> {
+  await sql().query(
+    `update queue set status = 'pending', attempts = greatest(attempts - 1, 0),
+            not_before = now() + make_interval(secs => $2::int), error = $3
+      where id = $1`,
+    [id, VOLTA_SEM_TEMPO_EM_SEGUNDOS, MOTIVO_SEM_TEMPO]
+  );
+}
+
+/**
+ * O VÍDEO QUE AVANÇOU volta à fila valendo já, com as tentativas ZERADAS (a nota da auditoria sobre o 230): só 3
+ * erros passageiros SEGUIDOS, sem avanço entre eles, encerram a linha. O tique seguinte a traz de volta.
+ */
+async function devolverOVideoComAvanco(id: string): Promise<void> {
+  await sql().query(
+    `update queue set status = 'pending', attempts = 0, not_before = now(), error = $2 where id = $1`,
+    [id, MOTIVO_VIDEO_SUBINDO]
+  );
+}
+
+/** Grava a primeira passada, se ainda não houver, e devolve a hora dela (epoch, ms). */
+async function marcarAPrimeiraPassada(id: string): Promise<number> {
+  const [linha] = (await sql().query(
+    `update queue set payload = payload || jsonb_build_object('primeira_passada_em', coalesce(payload->>'primeira_passada_em', $2::text))
+      where id = $1 returning payload->>'primeira_passada_em' as primeira`,
+    [id, new Date().toISOString()]
+  )) as { primeira: string | null }[];
+  const ms = linha?.primeira ? Date.parse(linha.primeira) : NaN;
+  return Number.isNaN(ms) ? Date.now() : ms;
+}
+
+/** Conta a passada que vai começar uma etapa (o teto das passadas, o 230). */
+async function contarAPassada(id: string): Promise<void> {
+  await sql().query(
+    `update queue set payload = payload || jsonb_build_object('passadas_do_video', coalesce((payload->>'passadas_do_video')::int, 0) + 1)
+      where id = $1`,
+    [id]
+  );
+}
+
+/**
+ * A GRAVAÇÃO DE CADA ETAPA DEVOLVE O PAYLOAD GRAVADO (o 230): o progresso é lido dele, e não do que a passada achou
+ * que fez. A reserva vai num `update` só (o URN, o token, as partes e a lista vazia dos ETags, o 236), e só se ainda
+ * não houver URN: com o `video_urn` gravado, nunca se reserva de novo. O ETag vai pelo índice da parte.
+ */
+async function gravarAReserva(
+  id: string,
+  r: { videoUrn: string; uploadToken: string; partes: { inicio: number; fim: number; url: string }[] }
+): Promise<unknown> {
+  const [linha] = (await sql().query(
+    `update queue set payload = payload || jsonb_build_object('video_urn', $2::text, 'upload_token', $3::text, 'partes', $4::jsonb, 'etags', '[]'::jsonb)
+      where id = $1 and not (payload ? 'video_urn') returning payload`,
+    // A LISTA VAI CRUA para o parâmetro jsonb, como o `guardarNoPayload`: serializada à mão, ela viraria um texto.
+    [id, r.videoUrn, r.uploadToken, r.partes]
+  )) as { payload: unknown }[];
+  return linha?.payload ?? null;
+}
+
+async function gravarOETag(id: string, indice: number, etag: string): Promise<unknown> {
+  const [linha] = (await sql().query(
+    `update queue set payload = jsonb_set(payload, array['etags', $2::text], to_jsonb($3::text), true)
+      where id = $1 and jsonb_typeof(payload->'etags') = 'array' and jsonb_array_length(payload->'etags') = $4::int
+      returning payload`,
+    [id, String(indice), etag, indice]
+  )) as { payload: unknown }[];
+  return linha?.payload ?? null;
+}
+
+async function gravarOFim(id: string): Promise<unknown> {
+  const [linha] = (await sql().query(
+    `update queue set payload = payload || '{"video_finalizado": true}'::jsonb where id = $1 returning payload`,
+    [id]
+  )) as { payload: unknown }[];
+  return linha?.payload ?? null;
+}
+
+/** O progresso do payload gravado, ou −1 quando a gravação não pegou a linha (ou o payload não se lê). */
+function progressoGravado(payload: unknown): number {
+  const pub = lerPayloadDoLinkedin(payload);
+  return pub ? progressoDoVideo(estadoDoEnvioDoVideo(pub)) : -1;
+}
+
 /**
  * Os bytes da imagem, pelo endereço público do bucket (o mesmo do `copiarParaAFila`, lib/bonus/publicar-bucket.ts).
  * Lança com o status, sem o endereço; o erro volta à fila pelo `catch` do dreno.
@@ -289,6 +427,110 @@ async function tirarAMarcaDoPost(id: string): Promise<void> {
   await sql().query(`update queue set payload = payload - 'post_tentado_em' where id = $1`, [id]);
 }
 
+/**
+ * UMA PASSADA DO VÍDEO EM PARTES (a parte 3b; scratchpad/desenho-li3b.md, v3, §3.3 a §3.5). Faz UMA etapa (a reserva,
+ * uma parte ou o fim) e devolve a linha à fila, ou devolve "post" quando só falta o post, que é o de todas as formas.
+ *
+ *   1. a primeira passada fica gravada (o teto de idade conta dela);
+ *   2. os dois tetos (as passadas que começaram uma etapa e a idade) encerram a linha com o motivo;
+ *   3. a etapa só começa se o pior caso dela termina antes da hora de parar (o 231); se não, a linha volta sem gastar a
+ *      tentativa e sem contar adiamento;
+ *   4. a conexão é conferida, a passada é contada, e a etapa roda;
+ *   5. a gravação devolve o payload, e a linha só volta "com avanço" (as tentativas zeradas) se o progresso gravado
+ *      cresceu (o 230). Se não cresceu, é um erro passageiro, que gasta a tentativa.
+ *
+ * OS ERROS (o 238): na reserva e no fim, que levam o token, a classificação de sempre (`recusaDoLinkedin`); na parte,
+ * que vai sem o token, o 401/403 é a parte recusada (`desfechoDoErroDaParte`), e o endereço fora da regra do domínio,
+ * ou o redirecionamento, é permanente (`STATUS_RECUSADO_PELO_PAINEL`). O erro do bucket é passageiro.
+ */
+async function passadaDoVideo(
+  item: QueueItem,
+  pub: LeituraDoPayloadDoLinkedin,
+  deps: DependenciasDoDreno
+): Promise<DesfechoDoPostNoLinkedin | "post"> {
+  const estado = estadoDoEnvioDoVideo(pub);
+  if (pub.videoUrn && !estado.reservado) {
+    await deps.finish(item.id, { status: "failed", error: MOTIVO_DO_PAYLOAD_TORTO });
+    return "falhou";
+  }
+  const primeiraMs = await marcarAPrimeiraPassada(item.id);
+  const teto = tetoDoVideoAtingido({
+    partes: estado.partes,
+    passadas: pub.passadasDoVideo,
+    primeiraPassadaEmMs: primeiraMs,
+    agoraMs: Date.now(),
+  });
+  if (teto) {
+    await deps.finish(item.id, { status: "failed", error: teto === "idade" ? MOTIVO_VIDEO_VELHO : MOTIVO_VIDEO_PASSADAS_DEMAIS });
+    return "falhou";
+  }
+
+  const etapa = proximaEtapaDoVideo(estado);
+  if (!aEtapaDoVideoCabe(etapa, Date.now(), deps.prazoMs)) {
+    await devolverOVideoSemContar(item.id);
+    return "aguardando";
+  }
+  if (etapa === "post") return "post";
+
+  const conta = item.account_id ?? "";
+  const conexao = conta ? await conexaoDaConta(conta) : null;
+  if (!conexao) {
+    await deps.finish(item.id, { status: "failed", error: MOTIVO_SEM_CONEXAO });
+    return "falhou";
+  }
+  if (new Date(conexao.expira_em).getTime() <= Date.now()) {
+    await deps.finish(item.id, { status: "failed", error: motivoDaAutorizacaoRecusada(conexao.nome) });
+    return "falhou";
+  }
+
+  await contarAPassada(item.id);
+  const antes = progressoDoVideo(estado);
+  let gravado: unknown;
+  try {
+    if (etapa === "reserva") {
+      const tamanho = await tamanhoDoObjeto(pub.caminhos[0], TETO_DO_BUCKET_MS);
+      const reserva = await reservarVideo(conexao.access_token, conexao.pessoa_id, tamanho);
+      gravado = await gravarAReserva(item.id, reserva);
+    } else if (etapa === "parte") {
+      const indice = estado.etags;
+      const parte = (pub.partes ?? [])[indice];
+      const bytes = await faixaDoObjeto(pub.caminhos[0], parte.inicio, parte.fim, TETO_DO_BUCKET_MS);
+      const etag = await enviarParteDoVideo(parte.url, bytes);
+      gravado = await gravarOETag(item.id, indice, etag);
+    } else {
+      // O FIM (o 233): a marca vai antes. Com a marca de uma passada anterior e sem o fim gravado, um 4xx no fim não
+      // encerra direto: o estado do vídeo diz se o fim de antes chegou ao LinkedIn.
+      const repetido = !!pub.fimTentadoEm;
+      await deps.guardarNoPayload(item.id, { fim_tentado_em: new Date().toISOString() });
+      try {
+        await finalizarVideo(conexao.access_token, pub.videoUrn as string, pub.uploadToken as string, pub.etags.slice(0, estado.partes));
+      } catch (err) {
+        if (!(repetido && err instanceof LinkedinError && desfechoDoErroDoLinkedin(err.status) === "permanente")) throw err;
+        const situacao = await estadoDoVideo(conexao.access_token, pub.videoUrn as string).catch(() => null);
+        if (situacao !== "AVAILABLE" && situacao !== "PROCESSING") {
+          await deps.finish(item.id, { status: "failed", error: MOTIVO_VIDEO_PODE_TER_SUBIDO });
+          return "falhou";
+        }
+      }
+      gravado = await gravarOFim(item.id);
+    }
+  } catch (err) {
+    if (etapa === "parte" && err instanceof LinkedinError) {
+      const desfecho = desfechoDoErroDaParte(err.status);
+      if (desfecho === "passageiro") throw err;
+      await deps.finish(item.id, { status: "failed", error: desfecho === "recusada" ? MOTIVO_PARTE_RECUSADA : err.message.slice(0, 500) });
+      return "falhou";
+    }
+    const recusa = recusaDoLinkedin(err, conexao.nome);
+    if (recusa === null) throw err;
+    await deps.finish(item.id, { status: "failed", error: recusa });
+    return "falhou";
+  }
+  if (progressoGravado(gravado) <= antes) throw new Error("o avanço do vídeo não ficou gravado; a etapa volta na próxima passada");
+  await devolverOVideoComAvanco(item.id);
+  return "aguardando";
+}
+
 /**
  * PUBLICA A LINHA NO LINKEDIN. Os passos ficam marcados no payload, e cada passada começa do que falta:
  *
@@ -324,6 +566,12 @@ export async function publicarNoLinkedinDaFila(item: QueueItem, deps: Dependenci
     return "falhou";
   }
 
+  // O VÍDEO EM PARTES (a parte 3b): uma etapa por passada, até só faltar o post, que segue o caminho de todas as formas.
+  if (pub.forma === "video") {
+    const desfecho = await passadaDoVideo(item, pub, deps);
+    if (desfecho !== "post") return desfecho;
+  }
+
   // O TEMPO, ANTES DE QUALQUER CHAMADA: a imagem que ainda não subiu precisa do bucket, da reserva e do envio; o
   // documento do carrossel, também da montagem do PDF; o resto, só do post.
   const precisa =
@@ -408,6 +656,8 @@ export async function publicarNoLinkedinDaFila(item: QueueItem, deps: Dependenci
         texto: pub.texto,
         imagemUrn,
         documento: documentoUrn ? { urn: documentoUrn, titulo: tituloDoDocumento(pub.texto) } : undefined,
+        // O VÍDEO (a parte 3b) vai com o título pela mesma regra (a decisão do Eduardo pela caixa, em 16/11).
+        video: pub.forma === "video" && pub.videoUrn ? { urn: pub.videoUrn, titulo: tituloDoDocumento(pub.texto) } : undefined,
       })
     );
   } catch (err) {
@@ -415,17 +665,26 @@ export async function publicarNoLinkedinDaFila(item: QueueItem, deps: Dependenci
       await deps.finish(item.id, { status: "failed", error: MOTIVO_PODE_TER_SAIDO });
       return "falhou";
     }
-    // O DOCUMENTO QUE O LINKEDIN AINDA PROCESSA (a parte 3a): o 4xx prova que o post não foi criado. A linha espera
-    // um minuto e consulta de novo, até cinco vezes; na sexta, encerra com o motivo.
-    if (pub.forma === "carrossel" && err.midiaNaoPronta) {
-      if (pub.consultasDaMidia >= CONSULTAS_DA_MIDIA_MAX) {
+    // O DOCUMENTO OU O VÍDEO QUE O LINKEDIN AINDA PROCESSA (a parte 3a e a 3b): o 4xx prova que o post não foi criado.
+    // A linha espera um minuto e consulta de novo, até cinco vezes no documento e dez no vídeo; depois, encerra com o
+    // motivo. A passada do post não conta no teto das passadas do vídeo (o 237): as consultas têm o teto delas.
+    const comMidiaQueProcessa = pub.forma === "carrossel" || pub.forma === "video";
+    if (comMidiaQueProcessa && err.midiaNaoPronta) {
+      const doVideo = pub.forma === "video";
+      if (pub.consultasDaMidia >= (doVideo ? CONSULTAS_DO_VIDEO_MAX : CONSULTAS_DA_MIDIA_MAX)) {
         await tirarAMarcaDoPost(item.id);
-        await deps.finish(item.id, { status: "failed", error: MOTIVO_MIDIA_NAO_FICOU_PRONTA });
+        await deps.finish(item.id, { status: "failed", error: doVideo ? MOTIVO_VIDEO_NAO_FICOU_PRONTO : MOTIVO_MIDIA_NAO_FICOU_PRONTA });
         return "falhou";
       }
-      await esperarAMidia(item.id, pub.consultasDaMidia + 1);
+      await esperarAMidia(item.id, pub.consultasDaMidia + 1, doVideo ? MOTIVO_VIDEO_PROCESSANDO : MOTIVO_MIDIA_PROCESSANDO);
       return "aguardando";
     }
+    // O VÍDEO QUE O LINKEDIN NÃO CONSEGUIU PROCESSAR (a parte 3b): o post não foi criado, e repetir não ajuda.
+    if (pub.forma === "video" && err.processamentoFalhou) {
+      await tirarAMarcaDoPost(item.id);
+      await deps.finish(item.id, { status: "failed", error: MOTIVO_VIDEO_PROCESSAMENTO_FALHOU });
+      return "falhou";
+    }
     // O LinkedIn respondeu 4xx: o post não foi criado, e a marca sai. O 429 e o 409 voltam à fila; o resto encerra.
     await tirarAMarcaDoPost(item.id);
     const recusa = recusaDoLinkedin(err, conexao.nome);
```

- [ ] **Passo 4: rodar e ver passar**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-video"; cd "$C" || exit 1
npx --no-install vitest run tests/linkedin-forma-conhecida.test.ts tests/linkedin-post.test.ts tests/linkedin-rest.test.ts 2>&1 | tee ../pl3b-f4-green-puros.log
docker ps --format '{{.Names}} {{.Status}}' | grep metodochat-banco-de-teste   # healthy; senão, docker start e espere healthy
DATABASE_URL_TESTES=postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes npx --no-install vitest run --config vitest.integracao.config.ts testes-integracao/linkedin-video.integracao.ts testes-integracao/dreno-hora-de-parar.integracao.ts testes-integracao/dreno-forma-desconhecida.integracao.ts testes-integracao/linkedin-telas.integracao.ts 2>&1 | tee ../pl3b-f4-green-integ.log
npx --no-install vitest run 2>&1 | tee ../pl3b-f4-suite.log
npx --no-install tsc --noEmit
npx --no-install eslint lib/linkedin-fila.ts lib/linkedin-publicacao.ts lib/linkedin.ts testes-integracao/dreno-forma-desconhecida.integracao.ts testes-integracao/dreno-hora-de-parar.integracao.ts testes-integracao/linkedin-telas.integracao.ts testes-integracao/linkedin-video.integracao.ts tests/linkedin-forma-conhecida.test.ts tests/linkedin-post.test.ts tests/linkedin-rest.test.ts
git diff --name-only a5cd8d4 -- lib/queue-drain.ts lib/fila-tipos.ts migrations scripts package.json package-lock.json   # vazio
```

Esperado: Nos puros, "Test Files 3 passed (3)" e "Tests 65 passed (65)". Na integração, `ALVO: banco de TESTE`, nenhum `teste_tmp` antes e depois, "Test Files 4 passed (4)" e "Tests 61 passed (61)". A suíte pura inteira: "Test Files 162 passed (162)" e "Tests 3870 passed (3870)". O `tsc` e o lint sem saída, e a guarda vazia.

- [ ] **Passo 5: o commit**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-video"; cd "$C" || exit 1
node ../varrer-texto.mjs lib/linkedin-fila.ts lib/linkedin-publicacao.ts lib/linkedin.ts testes-integracao/dreno-forma-desconhecida.integracao.ts testes-integracao/dreno-hora-de-parar.integracao.ts testes-integracao/linkedin-telas.integracao.ts testes-integracao/linkedin-video.integracao.ts tests/linkedin-forma-conhecida.test.ts tests/linkedin-post.test.ts tests/linkedin-rest.test.ts && test "$(git branch --show-current)" = linkedin-video && git add lib/linkedin-fila.ts lib/linkedin-publicacao.ts lib/linkedin.ts testes-integracao/dreno-forma-desconhecida.integracao.ts testes-integracao/dreno-hora-de-parar.integracao.ts testes-integracao/linkedin-telas.integracao.ts testes-integracao/linkedin-video.integracao.ts tests/linkedin-forma-conhecida.test.ts tests/linkedin-post.test.ts tests/linkedin-rest.test.ts && git commit -m "O vídeo sai no LinkedIn pela fila, uma etapa por passada: a reserva, cada parte, o fim e o post, cada etapa só se terminar antes da hora de parar, com o avanço lido do que ficou gravado, as tentativas zeradas no avanço e os dois tetos"
git show HEAD | git patch-id --stable | cut -c1-12   # 48c8da1398de
```

O patch-id tem de começar por `48c8da1398de` (o mesmo do ensaio). Se não começar, pare.

---

### FASE 5 — O reels vai ao LinkedIn, só lá ou nas duas redes, com a cópia feita no servidor, e o clique das duas redes não drena o vídeo (232)

**Arquivos:** `app/publicar/actions.ts`, `lib/linkedin-copia.ts`, `testes-integracao/linkedin-compor.integracao.ts`, `testes-integracao/linkedin-duas-redes.integracao.ts`, `tests/linkedin-copia.test.ts`.

- [ ] **Passo 1: os testes**

Em `tests/linkedin-copia.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/linkedin-copia.test.ts b/tests/linkedin-copia.test.ts
index 1f9d109..9bd8041 100644
--- a/tests/linkedin-copia.test.ts
+++ b/tests/linkedin-copia.test.ts
@@ -10,7 +10,7 @@ process.env.SUPABASE_URL = "https://exemplo.supabase.co";
 process.env.SUPABASE_SERVICE_ROLE_KEY = "chave-de-teste-que-nao-vale-nada";
 process.env.SUPABASE_BUCKET = "MetodoChat";
 
-const { copiarAsImagensParaOLinkedin, copiarImagemParaOLinkedin, TETO_DA_COPIA_BYTES, TETO_DA_COPIA_MS } = await import(
+const { copiarAsImagensParaOLinkedin, copiarImagemParaOLinkedin, copiarOVideoParaOLinkedin, TETO_DA_COPIA_BYTES, TETO_DA_COPIA_MS } = await import(
   "@/lib/linkedin-copia"
 );
 
@@ -254,3 +254,31 @@ describe("copiar as fotos do carrossel para a linha do LinkedIn", () => {
     expect(chamadas).toEqual([]);
   });
 });
+
+// A CÓPIA DO VÍDEO (a parte 3b; scratchpad/desenho-li3b.md, §3.6): pelo próprio servidor do Storage, um pedido só, sem
+// baixar nem subir nada aqui. A origem é conferida antes de qualquer chamada: da conta, na forma do /publicar, e MP4.
+describe("copiar o vídeo do post para a linha do LinkedIn", () => {
+  const VIDEO = `${CONTA}/video-do-post.mp4`;
+
+  it("é um pedido só, a cópia no servidor, para um caminho novo .mp4 da mesma pasta, e devolve o caminho", async () => {
+    expect(await copiarOVideoParaOLinkedin(VIDEO, CONTA, uuid(7))).toBe(`${CONTA}/${uuid(7)}.mp4`);
+    expect(chamadas.map((c) => `${c.metodo} ${c.url}`)).toEqual([`POST ${BASE}/object/copy`]);
+    expect(JSON.parse(String(chamadas[0].corpo))).toEqual({ bucketId: "MetodoChat", sourceKey: VIDEO, destinationKey: `${CONTA}/${uuid(7)}.mp4` });
+  });
+
+  it("o vídeo de outra conta, ou com caminho torto, é recusado antes de qualquer chamada", async () => {
+    await expect(copiarOVideoParaOLinkedin(`${OUTRA}/video.mp4`, CONTA)).rejects.toThrow("não é desta conta");
+    await expect(copiarOVideoParaOLinkedin(`${CONTA}/../${OUTRA}/video.mp4`, CONTA)).rejects.toThrow("não é desta conta");
+    expect(chamadas).toEqual([]);
+  });
+
+  it("o MOV é recusado antes de qualquer chamada: o LinkedIn só aceita MP4", async () => {
+    await expect(copiarOVideoParaOLinkedin(`${CONTA}/video-do-post.mov`, CONTA)).rejects.toThrow("MP4");
+    expect(chamadas).toEqual([]);
+  });
+
+  it("a cópia recusada pelo armazenamento faz a cópia lançar, com o status", async () => {
+    responder = () => new Response("The resource already exists", { status: 409 });
+    await expect(copiarOVideoParaOLinkedin(VIDEO, CONTA, uuid(8))).rejects.toThrow(/409/);
+  });
+});
```

Em `testes-integracao/linkedin-compor.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/linkedin-compor.integracao.ts b/testes-integracao/linkedin-compor.integracao.ts
index 21525d5..54acd57 100644
--- a/testes-integracao/linkedin-compor.integracao.ts
+++ b/testes-integracao/linkedin-compor.integracao.ts
@@ -49,7 +49,22 @@ beforeAll(async () => {
     if (req.method === "DELETE" && u.pathname.startsWith(`/storage/v1/object/${BUCKET}/`)) {
       return responder(res, 200, { message: "ok" });
     }
+    // O TAMANHO DO VÍDEO (a parte 3b): o HEAD do endereço público.
+    if (req.method === "HEAD" && u.pathname.startsWith(`/storage/v1/object/public/${BUCKET}/`)) {
+      res.writeHead(200, { "content-length": "10", "content-type": "video/mp4" });
+      return res.end();
+    }
     linkedin.pedidos.push(`${req.method} ${u.pathname}`);
+    // A RESERVA DO VÍDEO (a parte 3b): uma parte só, para os 10 bytes.
+    if (req.method === "POST" && u.pathname === "/rest/videos") {
+      return responder(res, 200, {
+        value: {
+          uploadInstructions: [{ uploadUrl: `http://127.0.0.1:${porta}/parte/0`, firstByte: 0, lastByte: 9 }],
+          video: "urn:li:video:DoCompor",
+          uploadToken: "",
+        },
+      });
+    }
     if (req.method === "POST" && u.pathname === "/rest/images") {
       return responder(res, 200, {
         value: { uploadUrl: `http://127.0.0.1:${porta}/envio/C4E10AQ`, image: "urn:li:image:DoCompor" },
@@ -322,3 +337,42 @@ describe("a regra das contas: a conta vem da sessão, e nunca do formulário", (
     expect(linkedin.pedidos).toEqual([]);
   });
 });
+
+// O VÍDEO SÓ NO LINKEDIN (a parte 3b; scratchpad/desenho-li3b.md, §3.6). O reels MP4 da pasta da conta vai à linha com a
+// forma "video"; no "agora", o clique faz só a primeira etapa (a reserva), e o resto sai pelos tiques, uma etapa por
+// passada. O MOV é recusado com a frase do MP4, sem linha.
+describe("o vídeo só no LinkedIn (a parte 3b)", () => {
+  const VIDEO = `${CONTA_A}/video-do-post.mp4`;
+
+  it("agendado: o MP4 da pasta da conta vai à linha, a chave é por ele, e ninguém fala com o LinkedIn", async () => {
+    const alvo = new Date(Date.now() + 2 * 3600 * 1000);
+    alvo.setUTCSeconds(0, 0);
+    const aviso = await publicarComoAdministrador(
+      formulario({ forma_linkedin: "video", caminhos: VIDEO, quando: "depois", data_hora: alvo.toISOString().slice(0, 16), fuso: "0" })
+    );
+    expect(aviso.tom).toBe("ok");
+    expect(aviso.texto).toContain("agendado para");
+    const [linha] = await q(`select status, dedupe_key, payload from queue`);
+    expect(linha.status).toBe("pending");
+    expect(linha.payload).toMatchObject({ forma: "video", caminhos: [VIDEO] });
+    expect(linha.dedupe_key).toBe(`pub-linkedin:${CONTA_A}:video:${VIDEO}`);
+    expect(linkedin.pedidos).toEqual([]);
+  });
+
+  it("agora: o clique faz só a reserva, a linha volta à fila com o vídeo reservado, e o aviso diz que o post vai sair", async () => {
+    const aviso = await publicarComoAdministrador(formulario({ forma_linkedin: "video", caminhos: VIDEO }));
+    expect(aviso.tom).toBe("ok");
+    expect(aviso.texto).toBe("O post do LinkedIn está na fila e vai sair em instantes. Acompanhe em Publicações.");
+    expect(linkedin.pedidos).toEqual(["POST /rest/videos"]);
+    const [linha] = await q(`select status, attempts, error, payload from queue`);
+    expect(linha).toMatchObject({ status: "pending", attempts: 0 });
+    expect(linha.payload).toMatchObject({ forma: "video", video_urn: "urn:li:video:DoCompor", etags: [] });
+  });
+
+  it("o MOV é recusado com a frase do MP4, e nenhuma linha entra", async () => {
+    const aviso = await publicarComoAdministrador(formulario({ forma_linkedin: "video", caminhos: `${CONTA_A}/video-do-post.mov` }));
+    expect(aviso).toEqual({ tom: "erro", texto: regras.TEXTO_DO_VIDEO_QUE_NAO_E_MP4 });
+    expect(await linhas()).toEqual([]);
+    expect(linkedin.pedidos).toEqual([]);
+  });
+});
```

Em `testes-integracao/linkedin-duas-redes.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/linkedin-duas-redes.integracao.ts b/testes-integracao/linkedin-duas-redes.integracao.ts
index d333f80..970d887 100644
--- a/testes-integracao/linkedin-duas-redes.integracao.ts
+++ b/testes-integracao/linkedin-duas-redes.integracao.ts
@@ -47,6 +47,8 @@ const bucket = {
   recusarUmaSubida: false,
   atrasoDaSubidaMs: 0,
   atrasoDaBaixadaMs: 0,
+  // A PARTE 3b: a cópia do vídeo no próprio servidor do Storage.
+  recusarCopia: false,
 };
 
 let servidorFalso: Server;
@@ -106,6 +108,18 @@ beforeAll(async () => {
       return responder(res, 200, { message: "ok" });
     }
 
+    // A CÓPIA NO SERVIDOR DO STORAGE (a parte 3b, o vídeo nas duas redes).
+    if (req.method === "POST" && u.pathname === "/storage/v1/object/copy") {
+      if (req.headers["apikey"] !== CHAVE_DO_BUCKET) return responder(res, 401, { message: "sem apikey" });
+      const { sourceKey, destinationKey } = JSON.parse(corpo.toString()) as { sourceKey: string; destinationKey: string };
+      bucket.chamadas.push(`copiou ${sourceKey} -> ${destinationKey}`);
+      if (bucket.recusarCopia) return responder(res, 500, { message: "o bucket falso recusou a cópia de propósito" });
+      const origem = bucket.objetos.get(sourceKey);
+      if (!origem) return responder(res, 404, { message: "Object not found" });
+      bucket.objetos.set(destinationKey, origem);
+      return responder(res, 200, { Key: destinationKey });
+    }
+
     // O LINKEDIN: reservar a imagem, enviá-la e publicar.
     if (u.pathname.startsWith("/rest/") || u.pathname.startsWith("/envio/")) {
       linkedin.pedidos.push(`${req.method} ${u.pathname}`);
@@ -224,6 +238,7 @@ beforeEach(async () => {
   bucket.recusarUmaSubida = false;
   bucket.atrasoDaSubidaMs = 0;
   bucket.atrasoDaBaixadaMs = 0;
+  bucket.recusarCopia = false;
 });
 
 async function conectar(conta: string) {
@@ -528,7 +543,8 @@ describe("as recusas: nenhuma linha entra, e o bucket e as redes não são chama
   const casos: [string, Partial<Record<string, string>>, (t: string | null) => void][] = [
     ["a imagem de outra conta (descartada antes de copiar)", { caminhos: `${CONTA_B}/foto-do-post.jpg` }, (t) => expect(t).toBeTruthy()],
     ["sem a imagem", { caminhos: "" }, (t) => expect(t).toBeTruthy()],
-    ["o reels, que o LinkedIn ainda não recebe", { forma: "reels" }, (t) => expect(t).toContain("próxima entrega")],
+    // O REELS VAI AO LINKEDIN DESDE A 3b, como vídeo, só em MP4: com a imagem do formulário, a recusa é a do MP4.
+    ["o reels sem um MP4, que o LinkedIn não recebe", { forma: "reels" }, (t) => expect(t).toBe(regrasDoLinkedin.TEXTO_DO_VIDEO_QUE_NAO_E_MP4)],
     ["o carrossel com vídeo, que o PDF do LinkedIn não leva", { forma: "carrossel", caminhos: `${ORIGINAL}\n${CONTA_A}/video-do-post.mp4` }, (t) =>
       expect(t).toBe(regrasDoLinkedin.textoDaRecusaNoLinkedin("carrossel_com_video"))],
     ["o story", { forma: "story" }, (t) => expect(t).toContain("não tem story")],
@@ -804,3 +820,58 @@ async function comGatilhoDeUpdate(nome: string, corpoDaFuncao: string, caso: ()
     await q(`drop function if exists ${nome}()`);
   }
 }
+
+// O VÍDEO NAS DUAS REDES (a parte 3b; scratchpad/desenho-li3b.md, §3.6). O Instagram leva o reels original; a linha do
+// LinkedIn leva a forma "video" e uma cópia feita no próprio servidor do Storage, sem baixar nem subir nada aqui. No
+// "agora", o clique não drena o LinkedIn (o 232): só arma o tique da linha, e o Instagram sai no dreno do clique.
+const VIDEO_ORIGINAL = `${CONTA_A}/video-do-post.mp4`;
+const MP4 = new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70]);
+const COPIA_DO_VIDEO = new RegExp(`^${CONTA_A}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.mp4$`);
+const reels = (campos: Partial<Record<string, string>> = {}) => formulario({ forma: "reels", caminhos: VIDEO_ORIGINAL, ...campos });
+
+describe("o vídeo nas duas redes (a parte 3b)", () => {
+  it("agendado: o Instagram leva o reels, o LinkedIn leva a forma vídeo com uma cópia feita no servidor, e a chave é a do original", async () => {
+    bucket.objetos.set(VIDEO_ORIGINAL, MP4);
+    const aviso = await nasDuasComoAdministrador(reels(daquiA2Horas()));
+    expect(aviso.tom).toBe("ok");
+    const [ig] = await daRede("publicacao");
+    const [li] = await daRede("publicacao_linkedin");
+    expect(ig.payload).toMatchObject({ forma: "reels", caminhos: [VIDEO_ORIGINAL] });
+    expect(li.payload.forma).toBe("video");
+    const [copia] = li.payload.caminhos as string[];
+    expect(copia).toMatch(COPIA_DO_VIDEO);
+    expect(li.dedupe_key).toBe(`pub-linkedin:${CONTA_A}:video:${VIDEO_ORIGINAL}`);
+    expect(bucket.chamadas).toEqual([`copiou ${VIDEO_ORIGINAL} -> ${copia}`]);
+    expect(Array.from(bucket.objetos.get(copia) ?? [])).toEqual(Array.from(MP4));
+    expect(linkedin.pedidos).toEqual([]);
+  });
+
+  it("agora: o clique não drena o LinkedIn (o 232), que fica na fila intocado, e o Instagram sai no dreno do clique", async () => {
+    bucket.objetos.set(VIDEO_ORIGINAL, MP4);
+    const aviso = await nasDuasComoAdministrador(reels());
+    expect(aviso.texto).toContain("LinkedIn: O post do LinkedIn está na fila e vai sair em instantes.");
+    const [li] = await daRede("publicacao_linkedin");
+    expect(li.status).toBe("pending");
+    expect(li.payload.video_urn).toBeUndefined();
+    expect(linkedin.pedidos).toEqual([]);
+    expect(meta.containers).toBeGreaterThanOrEqual(1);
+  });
+
+  it("o MOV não vai ao LinkedIn: nada é gravado, nenhuma cópia é feita, e a tela diz a frase do MP4", async () => {
+    const mov = `${CONTA_A}/video-do-post.mov`;
+    bucket.objetos.set(mov, MP4);
+    const aviso = await nasDuasComoAdministrador(formulario({ forma: "reels", caminhos: mov }));
+    expect(aviso).toEqual({ tom: "erro", texto: regrasDoLinkedin.TEXTO_DO_VIDEO_QUE_NAO_E_MP4 });
+    expect(await linhas()).toEqual([]);
+    expect(bucket.chamadas).toEqual([]);
+  });
+
+  it("a cópia no servidor que falha: nada é gravado, e a tela diz o motivo", async () => {
+    bucket.objetos.set(VIDEO_ORIGINAL, MP4);
+    bucket.recusarCopia = true;
+    const aviso = await nasDuasComoAdministrador(reels(daquiA2Horas()));
+    expect(aviso.tom).toBe("erro");
+    expect(aviso.texto).toContain("Nada foi agendado");
+    expect(await linhas()).toEqual([]);
+  });
+});
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-video"; cd "$C" || exit 1
npx --no-install vitest run tests/linkedin-copia.test.ts 2>&1 | tee ../pl3b-f5-red-puros.log
docker ps --format '{{.Names}} {{.Status}}' | grep metodochat-banco-de-teste   # healthy; senão, docker start e espere healthy
DATABASE_URL_TESTES=postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes npx --no-install vitest run --config vitest.integracao.config.ts testes-integracao/linkedin-compor.integracao.ts testes-integracao/linkedin-duas-redes.integracao.ts 2>&1 | tee ../pl3b-f5-red-integ.log
```

Esperado: Nos puros, "Test Files 1 failed (1)" e "Tests 4 failed | 15 passed (19)". Caem: "é um pedido só, a cópia no servidor, para um caminho novo .mp4 da mesma pasta, e devolve o caminho"; "o vídeo de outra conta, ou com caminho torto, é recusado antes de qualquer chamada"; "o MOV é recusado antes de qualquer chamada: o LinkedIn só aceita MP4"; "a cópia recusada pelo armazenamento faz a cópia lançar, com o status". Na integração, `ALVO: banco de TESTE`, nenhum `teste_tmp` antes e depois, "Test Files 1 failed | 1 passed (2)" e "Tests 5 failed | 60 passed (65)". Caem: "o reels sem um MP4, que o LinkedIn não recebe"; "agendado: o Instagram leva o reels, o LinkedIn leva a forma vídeo com uma cópia feita no servidor, e a chave é a do original"; "agora: o clique não drena o LinkedIn (o 232), que fica na fila intocado, e o Instagram sai no dreno do clique"; "o MOV não vai ao LinkedIn: nada é gravado, nenhuma cópia é feita, e a tela diz a frase do MP4"; "a cópia no servidor que falha: nada é gravado, e a tela diz o motivo".

- [ ] **Passo 3: o código**

Em `lib/linkedin-copia.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/linkedin-copia.ts b/lib/linkedin-copia.ts
index addc641..ff4ca55 100644
--- a/lib/linkedin-copia.ts
+++ b/lib/linkedin-copia.ts
@@ -1,5 +1,5 @@
 import "server-only";
-import { apagarObjeto, caminhoDoObjeto, pastaDaConta, urlAssinadaDeUpload, urlPublicaDoObjeto } from "./bucket";
+import { apagarObjeto, caminhoDoObjeto, copiarObjeto, pastaDaConta, urlAssinadaDeUpload, urlPublicaDoObjeto } from "./bucket";
 import { caminhosDoCampo } from "./publicacao";
 
 // A CÓPIA DA IMAGEM PARA A LINHA DO LINKEDIN, NO POST DAS DUAS REDES (docs/specs/2026-11-06-linkedin-no-perfil.md, §6;
@@ -102,6 +102,25 @@ export async function copiarAsImagensParaOLinkedin(origens: readonly string[], c
   throw falha.reason;
 }
 
+/**
+ * A CÓPIA DO VÍDEO PARA A LINHA DO LINKEDIN, NO POST DAS DUAS REDES (a parte 3b; scratchpad/desenho-li3b.md, §3.6):
+ * pelo próprio servidor do Storage (`copiarObjeto`, lib/bucket.ts), sem passar pelo painel. Baixar e subir até 50 MiB
+ * dentro da action não caberia com folga; a cópia no servidor foi medida em 16/11 (200 em 240 ms).
+ *
+ * A ORIGEM É CONFERIDA ANTES DE QUALQUER CHAMADA, como na imagem: da conta que publica, na forma dos caminhos do
+ * /publicar, e MP4 (o LinkedIn só aceita MP4; a tela e a action já recusaram o resto). A cópia que estoura o nosso teto
+ * e termina mesmo assim no Supabase fica no bucket sem dono (o 235).
+ */
+export async function copiarOVideoParaOLinkedin(origem: string, conta: string, uuid: string = crypto.randomUUID()): Promise<string> {
+  const pasta = pastaDaConta(conta);
+  const conferidos = caminhosDoCampo(origem, pasta);
+  if (conferidos.length !== 1 || conferidos[0] !== origem) throw new Error("o vídeo não é desta conta");
+  if (!origem.toLowerCase().endsWith(".mp4")) throw new Error("o vídeo do LinkedIn tem de ser MP4");
+  const destino = caminhoDoObjeto(conta, "copia.mp4", uuid, "video/mp4");
+  await copiarObjeto(origem, destino, TETO_DA_COPIA_MS);
+  return destino;
+}
+
 /** As cópias que não vão ser usadas, apagadas juntas e sem derrubar quem chama (a de cima, para cada uma). */
 export async function apagarAsCopiasSemDerrubar(caminhos: readonly string[]): Promise<void> {
   await Promise.all(caminhos.map((caminho) => apagarACopiaSemDerrubar(caminho)));
```

Em `app/publicar/actions.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/publicar/actions.ts b/app/publicar/actions.ts
index 2528c70..fedac79 100644
--- a/app/publicar/actions.ts
+++ b/app/publicar/actions.ts
@@ -41,7 +41,7 @@ import { armarOTiqueDaLinha, drenarUmaPublicacaoDoLinkedin } from "@/lib/queue-d
 // O POST DAS DUAS REDES (a parte 2b): as regras puras das duas, e as cópias para a linha do LinkedIn (uma no post de
 // imagem; uma por foto no carrossel, a parte 3a).
 import { avisoDasDuasRedes, redeAceitaAForma, textoQueVaiAoLinkedin } from "@/lib/redes-do-post";
-import { apagarAsCopiasSemDerrubar, copiarAsImagensParaOLinkedin } from "@/lib/linkedin-copia";
+import { apagarAsCopiasSemDerrubar, copiarAsImagensParaOLinkedin, copiarOVideoParaOLinkedin } from "@/lib/linkedin-copia";
 import type { ResultadoDaPublicacao } from "@/lib/engine";
 
 /**
@@ -288,8 +288,8 @@ export async function publicarNoLinkedin(formData: FormData): Promise<void> {
 }
 
 /**
- * O POST DE IMAGEM OU DE CARROSSEL NAS DUAS REDES, Instagram e LinkedIn, para a conta selecionada
- * (docs/specs/2026-11-06-linkedin-no-perfil.md, §6 e §7; a parte 2b, e o carrossel na 3a). Uma linha por rede, cada
+ * O POST DE IMAGEM, DE CARROSSEL OU DE VÍDEO NAS DUAS REDES, Instagram e LinkedIn, para a conta selecionada
+ * (docs/specs/2026-11-06-linkedin-no-perfil.md, §6 e §7; a parte 2b, o carrossel na 3a e o vídeo na 3b). Uma linha por rede, cada
  * uma com a sua chave, o seu andamento e as suas tentativas: se uma rede falhar ao publicar, a outra segue.
  *
  * AS MESMAS REGRAS DAS DUAS ACTIONS DE CIMA: a sessão primeiro; nenhuma saída muda; a conta da regra das contas, e
@@ -334,11 +334,12 @@ export async function publicarNasDuasRedes(formData: FormData): Promise<void> {
     redirect(urlDePublicarComAviso({ tom: "erro", texto: disponivel.motivo }));
   }
 
-  // AS DUAS REDES JUNTAS NA IMAGEM E NO CARROSSEL: as formas da tela que o LinkedIn publica com arquivo, pela lista
-  // única (`FORMAS_NO_LINKEDIN`; o carrossel vai como PDF, só com fotos, na parte 3a). O vídeo chega ao LinkedIn
-  // depois, e o story não existe lá. O motivo é o mesmo que a tela mostra na caixinha desligada.
+  // AS DUAS REDES JUNTAS NA IMAGEM, NO CARROSSEL E NO VÍDEO: as formas da tela que o LinkedIn publica com arquivo,
+  // pela lista única (`FORMAS_NO_LINKEDIN`; o carrossel vai como PDF, só com fotos, na parte 3a). O reels da tela é o
+  // vídeo do LinkedIn (a parte 3b), e o story não existe lá. O motivo é o mesmo que a tela mostra na caixinha
+  // desligada.
   const forma = formaQueATelaPublica(formData.get("forma"));
-  const formaNoLinkedin = formaNoLinkedinDoCampo(forma);
+  const formaNoLinkedin = forma === "reels" ? "video" : formaNoLinkedinDoCampo(forma);
   if (!forma || !formaNoLinkedin) {
     redirect(
       urlDePublicarComAviso({
@@ -386,8 +387,12 @@ export async function publicarNasDuasRedes(formData: FormData): Promise<void> {
   if (!(await aChaveDoLinkedinJaExiste(conta.ig_user_id, pedidoDoLinkedin))) {
     let falhaDoLinkedin: string | null = null;
     try {
-      // UMA CÓPIA POR ARQUIVO, EM PARALELO e na ordem das originais; se uma falha, as outras já saíram do bucket.
-      copias = await copiarAsImagensParaOLinkedin(caminhos, conta.ig_user_id);
+      // UMA CÓPIA POR ARQUIVO, EM PARALELO e na ordem das originais; se uma falha, as outras já saíram do bucket. O
+      // VÍDEO (a parte 3b) é copiado no próprio servidor do Storage, sem passar por aqui.
+      copias =
+        formaNoLinkedin === "video"
+          ? [await copiarOVideoParaOLinkedin(caminhos[0], conta.ig_user_id)]
+          : await copiarAsImagensParaOLinkedin(caminhos, conta.ig_user_id);
     } catch (e) {
       falhaDoLinkedin = e instanceof Error ? e.message : "a cópia da imagem falhou";
     }
@@ -439,11 +444,15 @@ export async function publicarNasDuasRedes(formData: FormData): Promise<void> {
   // 6. O "AGORA": o LinkedIn primeiro, só a própria linha; depois o dreno do clique, para o Instagram, que não pega o
   // post do LinkedIn (a 3a-0). NO CARROSSEL, o LinkedIn conta o prazo com a reserva do Instagram (achado 222): o
   // documento nunca começa neste clique, e a linha volta adiada antes do dreno do Instagram, que sai na hora. Na
-  // imagem, o começo é o da função, como na 2b.
+  // imagem, o começo é o da função, como na 2b. NO VÍDEO (a parte 3b; o 232), o clique não drena o LinkedIn: a primeira
+  // etapa dele (a reserva, 20 s) caberia mesmo com a reserva do Instagram, e tiraria tempo dele. O clique só arma o tique
+  // da linha, e o aviso diz que o post do LinkedIn vai sair.
   const inicioDoLinkedin = comecoDoLinkedinNoAgoraDasDuas(formaNoLinkedin, inicioDaFuncaoMs);
   let desfecho: "publicado" | "aguardando" | "falhou" | null = null;
   let motivo: string | null = null;
-  if (linkedin.entrou && linkedin.jaVale) {
+  if (linkedin.entrou && linkedin.jaVale && formaNoLinkedin === "video") {
+    await armarOTiqueDaLinha(linkedin.id);
+  } else if (linkedin.entrou && linkedin.jaVale) {
     try {
       desfecho = await drenarUmaPublicacaoDoLinkedin(linkedin.id, inicioDoLinkedin);
       if (desfecho === "falhou") motivo = await erroDaLinha(linkedin.id);
```

- [ ] **Passo 4: rodar e ver passar**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-video"; cd "$C" || exit 1
npx --no-install vitest run tests/linkedin-copia.test.ts 2>&1 | tee ../pl3b-f5-green-puros.log
docker ps --format '{{.Names}} {{.Status}}' | grep metodochat-banco-de-teste   # healthy; senão, docker start e espere healthy
DATABASE_URL_TESTES=postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes npx --no-install vitest run --config vitest.integracao.config.ts testes-integracao/linkedin-compor.integracao.ts testes-integracao/linkedin-duas-redes.integracao.ts 2>&1 | tee ../pl3b-f5-green-integ.log
npx --no-install vitest run 2>&1 | tee ../pl3b-f5-suite.log
npx --no-install tsc --noEmit
npx --no-install eslint app/publicar/actions.ts lib/linkedin-copia.ts testes-integracao/linkedin-compor.integracao.ts testes-integracao/linkedin-duas-redes.integracao.ts tests/linkedin-copia.test.ts
git diff --name-only a5cd8d4 -- lib/queue-drain.ts lib/fila-tipos.ts migrations scripts package.json package-lock.json   # vazio
```

Esperado: Nos puros, "Test Files 1 passed (1)" e "Tests 19 passed (19)". Na integração, `ALVO: banco de TESTE`, nenhum `teste_tmp` antes e depois, "Test Files 2 passed (2)" e "Tests 65 passed (65)". A suíte pura inteira: "Test Files 162 passed (162)" e "Tests 3874 passed (3874)". O `tsc` e o lint sem saída, e a guarda vazia.

- [ ] **Passo 5: o commit**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-video"; cd "$C" || exit 1
node ../varrer-texto.mjs app/publicar/actions.ts lib/linkedin-copia.ts testes-integracao/linkedin-compor.integracao.ts testes-integracao/linkedin-duas-redes.integracao.ts tests/linkedin-copia.test.ts && test "$(git branch --show-current)" = linkedin-video && git add app/publicar/actions.ts lib/linkedin-copia.ts testes-integracao/linkedin-compor.integracao.ts testes-integracao/linkedin-duas-redes.integracao.ts tests/linkedin-copia.test.ts && git commit -m "O reels nas duas redes leva o vídeo também ao LinkedIn, com uma cópia feita no próprio servidor do Storage, e o clique só arma o tique do LinkedIn, para não tirar tempo do Instagram"
git show HEAD | git patch-id --stable | cut -c1-12   # 3de3447832a3
```

O patch-id tem de começar por `3de3447832a3` (o mesmo do ensaio). Se não começar, pare.

---

### FASE 4-bis — O fim conta as duas chamadas, cada etapa tem 2 s de folga, o post fica fora do teto das passadas, e a consulta que falha de passagem devolve a linha (240 a 244 e 247)

**Arquivos:** `lib/linkedin-fila.ts`, `lib/linkedin.ts`, `testes-integracao/linkedin-video.integracao.ts`.

A revisão do agente na FASE 4 chegou com a FASE 5 pronta: por isso esta fase vem depois da 5, na ordem do git do ensaio.

- [ ] **Passo 1: os testes**

Em `testes-integracao/linkedin-video.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/linkedin-video.integracao.ts b/testes-integracao/linkedin-video.integracao.ts
index 5e90b24..dca7f3a 100644
--- a/testes-integracao/linkedin-video.integracao.ts
+++ b/testes-integracao/linkedin-video.integracao.ts
@@ -345,15 +345,17 @@ describe("o vídeo em partes no LinkedIn", () => {
     expect(linkedin.pedidos).toEqual([]);
   });
 
-  it("o começo máximo de cada etapa, contra a hora de parar dos 40 s (o 231)", () => {
+  it("o começo máximo de cada etapa, contra a hora de parar dos 40 s (o 231), com a folga de 2 s (o 242) e o fim de duas chamadas (o 240)", () => {
     const prazo = 1_000_000 + 55_000;
     const aos = (s: number) => 1_000_000 + s * 1000;
-    expect(fila.aEtapaDoVideoCabe("reserva", aos(20), prazo)).toBe(true);
-    expect(fila.aEtapaDoVideoCabe("reserva", aos(20.001), prazo)).toBe(false);
-    expect(fila.aEtapaDoVideoCabe("parte", aos(15), prazo)).toBe(true);
-    expect(fila.aEtapaDoVideoCabe("parte", aos(15.001), prazo)).toBe(false);
-    expect(fila.aEtapaDoVideoCabe("fim", aos(30), prazo)).toBe(true);
-    expect(fila.aEtapaDoVideoCabe("post", aos(30.001), prazo)).toBe(false);
+    expect(fila.aEtapaDoVideoCabe("reserva", aos(17.999), prazo)).toBe(true);
+    expect(fila.aEtapaDoVideoCabe("reserva", aos(18), prazo)).toBe(false);
+    expect(fila.aEtapaDoVideoCabe("parte", aos(12.999), prazo)).toBe(true);
+    expect(fila.aEtapaDoVideoCabe("parte", aos(13), prazo)).toBe(false);
+    expect(fila.aEtapaDoVideoCabe("fim", aos(17.999), prazo)).toBe(true);
+    expect(fila.aEtapaDoVideoCabe("fim", aos(18), prazo)).toBe(false);
+    expect(fila.aEtapaDoVideoCabe("post", aos(27.999), prazo)).toBe(true);
+    expect(fila.aEtapaDoVideoCabe("post", aos(28), prazo)).toBe(false);
   });
 });
 
@@ -410,6 +412,28 @@ describe("os erros de cada etapa do vídeo (o 238)", () => {
     expect((await linha(id)).error).toContain("mande o convite de novo");
     expect(linkedin.pedidos).toEqual([]);
   });
+  it("três erros passageiros SEGUIDOS, sem avanço entre eles, encerram a linha (o 247)", async () => {
+    const id = await reservado();
+    linkedin.respostasDasPartes = [{ status: 503 }, { status: 503 }, { status: 503 }];
+    for (let i = 0; i < 2; i++) {
+      expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("aguardando");
+      await valerJa(id);
+    }
+    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("falhou");
+    expect((await linha(id)).status).toBe("failed");
+    expect(bucket.apagados).toEqual([]);
+  });
+
+  it("o erro de rede de uma parte vai para a linha com um texto fixo, sem o endereço do envio (o 243)", async () => {
+    const id = await reservado();
+    linkedin.enderecoDasPartes = null;
+    await q(`update queue set payload = jsonb_set(payload, '{partes,0,url}', '"http://127.0.0.1:10/parte-que-ninguem-ouve"') where id = $1`, [id]);
+    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("aguardando");
+    const l = await linha(id);
+    expect(l.error).toContain("o envio da parte do vídeo falhou na rede");
+    expect(l.error).not.toContain("127.0.0.1");
+    expect(l.error).not.toContain("parte-que-ninguem-ouve");
+  });
 });
 
 describe("os tetos do vídeo (o 230 e o 237)", () => {
@@ -488,6 +512,39 @@ describe("o fim e o post do vídeo", () => {
     expect(l.payload.post_tentado_em).toBeUndefined();
   });
 
+  it("o fim conta as duas chamadas (o 240): aos 25 s ele não começa mais, e a linha volta sem chamar o LinkedIn", async () => {
+    const id = await comTodasAsPartes();
+    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id, Date.now() - 25_000)).toBe("aguardando");
+    expect(linkedin.pedidos).toEqual([]);
+    const l = await linha(id);
+    expect(l).toMatchObject({ status: "pending", error: fila.MOTIVO_SEM_TEMPO });
+    expect(l.payload.video_finalizado).toBeUndefined();
+    expect(l.payload.fim_tentado_em).toBeUndefined();
+  });
+
+  it("o post não cai no teto das passadas (o 241): o fim foi a última passada permitida, e o post publica", async () => {
+    const id = await comTodasAsPartes();
+    // As 3 partes dão o teto de 12 passadas, que só encerra quando PASSA dele: com 12 contadas, o fim ainda começa e
+    // vira a 13ª. Sem a correção, a passada do post, com 13, encerraria o vídeo já finalizado.
+    await q(`update queue set payload = payload || '{"passadas_do_video": 12}'::jsonb where id = $1`, [id]);
+    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("aguardando"); // o fim, a 13ª
+    expect((await linha(id)).payload).toMatchObject({ video_finalizado: true, passadas_do_video: 13 });
+    await valerJa(id);
+    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("publicado");
+    expect((await linha(id)).status).toBe("sent");
+  });
+
+  it("a consulta do estado que falha de passagem (429) não encerra o fim perdido (o 244): a linha volta à fila", async () => {
+    const id = await comTodasAsPartes();
+    await q(`update queue set payload = payload || jsonb_build_object('fim_tentado_em', now()::text) where id = $1`, [id]);
+    linkedin.respostaDoFim = { status: 400, corpo: "{}" };
+    linkedin.estadoDoVideo = { status: 429, corpo: "{}" };
+    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("aguardando");
+    const l = await linha(id);
+    expect(l).toMatchObject({ status: "pending", attempts: 1 });
+    expect(l.payload.video_finalizado).toBeUndefined();
+  });
+
   it("na décima primeira consulta, a linha encerra com o motivo do vídeo", async () => {
     const id = await comTodasAsPartes();
     expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("aguardando"); // o fim
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-video"; cd "$C" || exit 1
docker ps --format '{{.Names}} {{.Status}}' | grep metodochat-banco-de-teste   # healthy; senão, docker start e espere healthy
DATABASE_URL_TESTES=postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes npx --no-install vitest run --config vitest.integracao.config.ts testes-integracao/linkedin-video.integracao.ts 2>&1 | tee ../pl3b-f4bis-red-integ.log
```

Esperado: Na integração, `ALVO: banco de TESTE`, nenhum `teste_tmp` antes e depois, "Test Files 1 failed (1)" e "Tests 5 failed | 18 passed (23)". Caem: "o começo máximo de cada etapa, contra a hora de parar dos 40 s (o 231), com a folga de 2 s (o 242) e o fim de duas chamadas (o 240)"; "o erro de rede de uma parte vai para a linha com um texto fixo, sem o endereço do envio (o 243)"; "o fim conta as duas chamadas (o 240): aos 25 s ele não começa mais, e a linha volta sem chamar o LinkedIn"; "o post não cai no teto das passadas (o 241): o fim foi a última passada permitida, e o post publica"; "a consulta do estado que falha de passagem (429) não encerra o fim perdido (o 244): a linha volta à fila".

- [ ] **Passo 3: o código**

Em `lib/linkedin.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/linkedin.ts b/lib/linkedin.ts
index 8f17d94..1a5b41f 100644
--- a/lib/linkedin.ts
+++ b/lib/linkedin.ts
@@ -395,7 +395,20 @@ export async function enviarParteDoVideo(uploadUrl: string, bytes: Uint8Array<Ar
   if (!enderecoDeEnvioConfiavel(uploadUrl)) {
     throw new LinkedinError(STATUS_RECUSADO_PELO_PAINEL, "o endereço de envio do vídeo não é do LinkedIn");
   }
-  const r = await chamar(uploadUrl, { method: "PUT", headers: { "content-type": "application/octet-stream" }, body: bytes }, TETO_DO_ENVIO_DA_PARTE_MS);
+  // O ERRO DA CHAMADA NÃO LEVA O ENDEREÇO (o 243): o `chamar` põe o endereço, sem a query, nas frases de tempo, de rede e
+  // de redirecionamento, e a frase da parte vai para a coluna `error`, que a tela mostra. O status fica, e a frase é fixa.
+  let r: Awaited<ReturnType<typeof chamar>>;
+  try {
+    r = await chamar(uploadUrl, { method: "PUT", headers: { "content-type": "application/octet-stream" }, body: bytes }, TETO_DO_ENVIO_DA_PARTE_MS);
+  } catch (err) {
+    const status = err instanceof LinkedinError ? err.status : 0;
+    throw new LinkedinError(
+      status,
+      status === STATUS_RECUSADO_PELO_PAINEL
+        ? "o envio da parte do vídeo foi redirecionado, e a chamada não seguiu"
+        : "o envio da parte do vídeo falhou na rede ou não respondeu a tempo"
+    );
+  }
   if (r.status !== 200 && r.status !== 201) throw new LinkedinError(r.status, `o LinkedIn recusou a parte do vídeo (${r.status})`);
   if (!r.etag) throw new LinkedinError(r.status, "o LinkedIn aceitou a parte do vídeo sem o ETag");
   return r.etag;
```

Em `lib/linkedin-fila.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/linkedin-fila.ts b/lib/linkedin-fila.ts
index c424ebc..af97363 100644
--- a/lib/linkedin-fila.ts
+++ b/lib/linkedin-fila.ts
@@ -249,24 +249,32 @@ export const MOTIVO_VIDEO_PODE_TER_SUBIDO =
   "o vídeo pode ter terminado de subir ao LinkedIn sem a confirmação chegar; publique de novo";
 
 /**
- * O PIOR CASO DE CADA ETAPA DO VÍDEO, pelos tetos (o §3.3): a reserva (o tamanho pelo bucket e a reserva), uma parte
- * (a faixa do bucket e o envio dela), o fim e o post.
+ * A FOLGA DE CADA ETAPA DO VÍDEO (o 242): depois da conferência do tempo ainda vêm a conexão, a contagem da passada e as
+ * gravações, que não estão nos tetos. Os outros ramos usam a `FOLGA_MS`; aqui, 2 s por etapa.
+ */
+const FOLGA_DA_ETAPA_DO_VIDEO_MS = 2_000;
+
+/**
+ * O PIOR CASO DE CADA ETAPA DO VÍDEO, pelos tetos e com a folga (o §3.3): a reserva (o tamanho pelo bucket e a reserva),
+ * uma parte (a faixa do bucket e o envio dela), o fim e o post. O FIM CONTA DUAS CHAMADAS (o 240): o fim perdido faz o
+ * `finalizeUpload` e depois a consulta do estado, 10 s cada.
  */
 export const PIOR_CASO_DA_ETAPA_DO_VIDEO_MS: Readonly<Record<EtapaDoVideo, number>> = {
-  reserva: TETO_DO_BUCKET_MS + TETO_DO_LINKEDIN_MS,
-  parte: TETO_DO_BUCKET_MS + TETO_DO_ENVIO_DA_PARTE_MS,
-  fim: TETO_DO_LINKEDIN_MS,
-  post: TETO_DO_LINKEDIN_MS,
+  reserva: TETO_DO_BUCKET_MS + TETO_DO_LINKEDIN_MS + FOLGA_DA_ETAPA_DO_VIDEO_MS,
+  parte: TETO_DO_BUCKET_MS + TETO_DO_ENVIO_DA_PARTE_MS + FOLGA_DA_ETAPA_DO_VIDEO_MS,
+  fim: 2 * TETO_DO_LINKEDIN_MS + FOLGA_DA_ETAPA_DO_VIDEO_MS,
+  post: TETO_DO_LINKEDIN_MS + FOLGA_DA_ETAPA_DO_VIDEO_MS,
 };
 
 /**
  * UMA ETAPA POR PASSADA, que só começa se o pior caso dela termina ANTES da hora de parar da 3a-0 (o 231): o prazo do
- * dreno menos a reserva para terminar (lib/fila-tipos.ts). Com o prazo de 55 s, a hora de parar é aos 40 s: a reserva
- * começa até os 20 s, a parte até os 15 s, e o fim e o post até os 30 s. Assim, nenhuma mensagem do mesmo lote volta à
- * fila por causa do vídeo.
+ * dreno menos a reserva para terminar (lib/fila-tipos.ts). Com o prazo de 55 s, a hora de parar é aos 40 s; com a
+ * folga, a reserva começa antes dos 18 s, a parte antes dos 13 s, o fim antes dos 18 s e o post antes dos 28 s. O fim
+ * da etapa tem de ficar ANTES da hora de parar, e não nela (o 242: a hora de parar é `>=`). Assim, nenhuma mensagem do
+ * mesmo lote volta à fila por causa do vídeo.
  */
 export function aEtapaDoVideoCabe(etapa: EtapaDoVideo, agoraMs: number, prazoMs: number): boolean {
-  return agoraMs + PIOR_CASO_DA_ETAPA_DO_VIDEO_MS[etapa] <= prazoMs - RESERVA_PARA_TERMINAR_MS;
+  return agoraMs + PIOR_CASO_DA_ETAPA_DO_VIDEO_MS[etapa] < prazoMs - RESERVA_PARA_TERMINAR_MS;
 }
 
 /**
@@ -454,9 +462,12 @@ async function passadaDoVideo(
     return "falhou";
   }
   const primeiraMs = await marcarAPrimeiraPassada(item.id);
+  // A ETAPA ANTES DOS TETOS (o 241): a passada do post não conta no teto das passadas, que é das etapas do envio; com o
+  // vídeo finalizado, ela publica mesmo que o fim tenha sido a última passada permitida. O teto de idade vale sempre.
+  const etapa = proximaEtapaDoVideo(estado);
   const teto = tetoDoVideoAtingido({
     partes: estado.partes,
-    passadas: pub.passadasDoVideo,
+    passadas: etapa === "post" ? 0 : pub.passadasDoVideo,
     primeiraPassadaEmMs: primeiraMs,
     agoraMs: Date.now(),
   });
@@ -465,7 +476,6 @@ async function passadaDoVideo(
     return "falhou";
   }
 
-  const etapa = proximaEtapaDoVideo(estado);
   if (!aEtapaDoVideoCabe(etapa, Date.now(), deps.prazoMs)) {
     await devolverOVideoSemContar(item.id);
     return "aguardando";
@@ -506,7 +516,12 @@ async function passadaDoVideo(
         await finalizarVideo(conexao.access_token, pub.videoUrn as string, pub.uploadToken as string, pub.etags.slice(0, estado.partes));
       } catch (err) {
         if (!(repetido && err instanceof LinkedinError && desfechoDoErroDoLinkedin(err.status) === "permanente")) throw err;
-        const situacao = await estadoDoVideo(conexao.access_token, pub.videoUrn as string).catch(() => null);
+        // A CONSULTA QUE FALHA DE PASSAGEM (a rede, o 429, o 5xx) não encerra um vídeo que provavelmente está bom (o
+        // 244): o erro sobe, e a linha volta à fila. Só a recusa da consulta encerra.
+        const situacao = await estadoDoVideo(conexao.access_token, pub.videoUrn as string).catch((e: unknown) => {
+          if (e instanceof LinkedinError && desfechoDoErroDoLinkedin(e.status) === "passageiro") throw e;
+          return null;
+        });
         if (situacao !== "AVAILABLE" && situacao !== "PROCESSING") {
           await deps.finish(item.id, { status: "failed", error: MOTIVO_VIDEO_PODE_TER_SUBIDO });
           return "falhou";
```

- [ ] **Passo 4: rodar e ver passar**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-video"; cd "$C" || exit 1
docker ps --format '{{.Names}} {{.Status}}' | grep metodochat-banco-de-teste   # healthy; senão, docker start e espere healthy
DATABASE_URL_TESTES=postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes npx --no-install vitest run --config vitest.integracao.config.ts testes-integracao/linkedin-video.integracao.ts 2>&1 | tee ../pl3b-f4bis-green-integ.log
npx --no-install vitest run 2>&1 | tee ../pl3b-f4bis-suite.log
npx --no-install tsc --noEmit
npx --no-install eslint lib/linkedin-fila.ts lib/linkedin.ts testes-integracao/linkedin-video.integracao.ts
git diff --name-only a5cd8d4 -- lib/queue-drain.ts lib/fila-tipos.ts migrations scripts package.json package-lock.json   # vazio
```

Esperado: Na integração, `ALVO: banco de TESTE`, nenhum `teste_tmp` antes e depois, "Test Files 1 passed (1)" e "Tests 23 passed (23)". A suíte pura inteira: "Test Files 162 passed (162)" e "Tests 3874 passed (3874)". O `tsc` e o lint sem saída, e a guarda vazia.

- [ ] **Passo 5: o commit**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-video"; cd "$C" || exit 1
node ../varrer-texto.mjs lib/linkedin-fila.ts lib/linkedin.ts testes-integracao/linkedin-video.integracao.ts && test "$(git branch --show-current)" = linkedin-video && git add lib/linkedin-fila.ts lib/linkedin.ts testes-integracao/linkedin-video.integracao.ts && git commit -m "Cada etapa do vídeo conta a folga e o fim conta as duas chamadas, o post não cai no teto das passadas, a consulta do estado que falha de passagem devolve a linha, e o erro de uma parte não leva o endereço do envio"
git show HEAD | git patch-id --stable | cut -c1-12   # 1cc776cf4c5a
```

O patch-id tem de começar por `1cc776cf4c5a` (o mesmo do ensaio). Se não começar, pare.

---

### FASE 6 — A tela de compor liga o LinkedIn no reels MP4 e o desliga no MOV, e o aviso diz que o vídeo sobe em partes

**Arquivos:** `app/publicar/actions.ts`, `app/publicar/enviador.tsx`, `lib/linkedin-publicacao.ts`, `lib/redes-do-post.ts`, `testes-dom/publicar-compositor-linkedin.dom.tsx`, `testes-integracao/linkedin-compor.integracao.ts`, `testes-integracao/linkedin-duas-redes.integracao.ts`, `tests/linkedin-video-regras.test.ts`, `tests/redes-do-post.test.ts`.

- [ ] **Passo 1: os testes**

Em `tests/linkedin-video-regras.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/linkedin-video-regras.test.ts b/tests/linkedin-video-regras.test.ts
index 0511752..d7e5eba 100644
--- a/tests/linkedin-video-regras.test.ts
+++ b/tests/linkedin-video-regras.test.ts
@@ -1,5 +1,7 @@
 import { describe, expect, it } from "vitest";
 import {
+  avisoDoPostNoLinkedin,
+  AVISO_DO_VIDEO_NA_FILA,
   desfechoDoErroDaParte,
   oVideoVaiAoLinkedin,
   progressoDoVideo,
@@ -120,3 +122,24 @@ describe("o erro de uma parte, que vai sem o token (o 234 e o 238)", () => {
     for (const s of [400, 404, 413, 422]) expect(desfechoDoErroDaParte(s)).toBe("permanente");
   });
 });
+
+// O AVISO DO VÍDEO (a parte 3b): na fila, ele diz que o vídeo sobe em partes e sai em minutos, e não "em instantes". O
+// publicado, o que falhou e o agendado são os de sempre.
+describe("o aviso do vídeo no LinkedIn", () => {
+  it("na fila, o vídeo tem a frase própria; as outras formas, a de sempre", () => {
+    expect(avisoDoPostNoLinkedin({ desfecho: null, agendadoPara: null, forma: "video" })).toEqual({ tom: "ok", texto: AVISO_DO_VIDEO_NA_FILA });
+    expect(avisoDoPostNoLinkedin({ desfecho: "aguardando", agendadoPara: null, forma: "video" })).toEqual({ tom: "ok", texto: AVISO_DO_VIDEO_NA_FILA });
+    expect(AVISO_DO_VIDEO_NA_FILA).toBe("O vídeo do LinkedIn está na fila e sobe em partes; ele sai em alguns minutos. Acompanhe em Publicações.");
+    expect(avisoDoPostNoLinkedin({ desfecho: null, agendadoPara: null, forma: "carrossel" }).texto).toBe(
+      "O post do LinkedIn está na fila e vai sair em instantes. Acompanhe em Publicações."
+    );
+  });
+
+  it("o publicado, o que falhou e o agendado do vídeo são os de sempre", () => {
+    expect(avisoDoPostNoLinkedin({ desfecho: "publicado", agendadoPara: null, forma: "video" }).texto).toBe("Post publicado no LinkedIn.");
+    expect(avisoDoPostNoLinkedin({ desfecho: "falhou", motivo: "x", agendadoPara: null, forma: "video" })).toMatchObject({ tom: "erro" });
+    expect(avisoDoPostNoLinkedin({ desfecho: null, agendadoPara: { dia: 1, mes: 12, hora: 9, minuto: 5 }, forma: "video" }).texto).toBe(
+      "Post do LinkedIn agendado para 01/12 às 09:05. Acompanhe em Publicações."
+    );
+  });
+});
```

Em `tests/redes-do-post.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/redes-do-post.test.ts b/tests/redes-do-post.test.ts
index f6ac988..c367ebe 100644
--- a/tests/redes-do-post.test.ts
+++ b/tests/redes-do-post.test.ts
@@ -11,7 +11,12 @@ import {
   textoQueVaiAoLinkedin,
 } from "@/lib/redes-do-post";
 import { avisoDaPublicacaoEnfileirada } from "@/lib/avisos";
-import { avisoDoPostNoLinkedin, textoDoProblemaDoCarrosselNoLinkedin } from "@/lib/linkedin-publicacao";
+import {
+  AVISO_DO_VIDEO_NA_FILA,
+  avisoDoPostNoLinkedin,
+  TEXTO_DO_VIDEO_QUE_NAO_E_MP4,
+  textoDoProblemaDoCarrosselNoLinkedin,
+} from "@/lib/linkedin-publicacao";
 import { textoDaRecusaDaPublicacao } from "@/lib/publicacao";
 
 // AS DUAS REDES NO MESMO POST (docs/specs/2026-11-06-linkedin-no-perfil.md, §6 e §7; a parte 2b). As regras puras
@@ -32,11 +37,11 @@ describe("o que cada rede aceita", () => {
     expect(redeAceitaAForma("instagram", "texto")).toContain("só de texto");
   });
 
-  it("o LinkedIn aceita o só texto, a imagem e o carrossel (em PDF, a parte 3a); o reels chega na próxima entrega, e o story nunca", () => {
+  it("o LinkedIn aceita o só texto, a imagem, o carrossel (em PDF, a parte 3a) e o reels (como vídeo, a parte 3b); o story nunca", () => {
     expect(redeAceitaAForma("linkedin", "texto")).toBeNull();
     expect(redeAceitaAForma("linkedin", "imagem")).toBeNull();
     expect(redeAceitaAForma("linkedin", "carrossel")).toBeNull();
-    expect(redeAceitaAForma("linkedin", "reels")).toContain("próxima entrega");
+    expect(redeAceitaAForma("linkedin", "reels")).toBeNull();
     expect(redeAceitaAForma("linkedin", "story")).toContain("não tem story");
   });
 });
@@ -79,12 +84,24 @@ describe("as caixinhas", () => {
     expect(e.linkedin).toEqual({ ligada: false, marcada: false, motivo: desligado.motivo });
   });
 
-  it("o story e o reels desligam o LinkedIn, com o motivo da forma", () => {
-    for (const forma of ["story", "reels"] as const) {
-      const e = estadoDasCaixinhas({ forma, marcadas: as2, linkedin: ligado });
-      expect(e.linkedin).toEqual({ ligada: false, marcada: false, motivo: redeAceitaAForma("linkedin", forma) });
-      expect(e.instagram.marcada).toBe(true);
-    }
+  it("o story desliga o LinkedIn, com o motivo da forma; o reels não (a parte 3b)", () => {
+    const story = estadoDasCaixinhas({ forma: "story", marcadas: as2, linkedin: ligado });
+    expect(story.linkedin).toEqual({ ligada: false, marcada: false, motivo: redeAceitaAForma("linkedin", "story") });
+    expect(story.instagram.marcada).toBe(true);
+    const reels = estadoDasCaixinhas({ forma: "reels", marcadas: as2, linkedin: ligado });
+    expect(reels.linkedin).toEqual({ ligada: true, marcada: true, motivo: null });
+  });
+
+  // O VÍDEO DO LINKEDIN SÓ VAI EM MP4 (a parte 3b): o MOV do iPhone desliga a caixinha, com a frase; o Instagram segue.
+  it("o reels com um vídeo que não é MP4 desliga o LinkedIn, com a frase do MP4; sem a conexão, o motivo é o da conexão", () => {
+    const mov = estadoDasCaixinhas({ forma: "reels", marcadas: as2, linkedin: ligado, videoQueNaoEMp4: true });
+    expect(mov.linkedin).toEqual({ ligada: false, marcada: false, motivo: TEXTO_DO_VIDEO_QUE_NAO_E_MP4 });
+    expect(mov.instagram).toEqual({ ligada: true, marcada: true, motivo: null });
+    const semConexao = estadoDasCaixinhas({ forma: "reels", marcadas: as2, linkedin: desligado, videoQueNaoEMp4: true });
+    expect(semConexao.linkedin?.motivo).toBe((desligado as { motivo: string }).motivo);
+    // O MOV SÓ PESA NO REELS: no carrossel, quem decide é o vídeo na lista (o PDF só leva fotos).
+    const carrossel = estadoDasCaixinhas({ forma: "carrossel", marcadas: as2, linkedin: ligado, videoQueNaoEMp4: true });
+    expect(carrossel.linkedin).toEqual({ ligada: true, marcada: true, motivo: null });
   });
 
   // O PDF DO CARROSSEL SÓ LEVA FOTOS (a parte 3a): um vídeo na lista desliga o LinkedIn, e o Instagram não muda.
@@ -251,3 +268,24 @@ describe("o aviso das duas redes", () => {
     expect(new Set(frases).size).toBe(4);
   });
 });
+
+// O AVISO DAS DUAS REDES COM O VÍDEO (a parte 3b): o lado do LinkedIn diz que o vídeo sobe em partes e sai em minutos.
+describe("o aviso das duas redes com o vídeo", () => {
+  it("no agora, o LinkedIn diz que o vídeo sobe em partes; agendado, a hora, como sempre", () => {
+    const agora = avisoDasDuasRedes({
+      tipo: "entrou",
+      campos: null,
+      instagram: { entrou: true, jaVale: true },
+      linkedin: { entrou: true, jaVale: true, desfecho: null, forma: "video" },
+    });
+    expect(agora).toEqual({ tom: "ok", texto: `Instagram: ${avisoDaPublicacaoEnfileirada(null).texto} LinkedIn: ${AVISO_DO_VIDEO_NA_FILA}` });
+    const campos = { dia: 20, mes: 11, hora: 10, minuto: 30 };
+    const agendado = avisoDasDuasRedes({
+      tipo: "entrou",
+      campos,
+      instagram: { entrou: true, jaVale: false },
+      linkedin: { entrou: true, jaVale: false, desfecho: null, forma: "video" },
+    });
+    expect(agendado.texto).toContain("LinkedIn: Post do LinkedIn agendado para 20/11 às 10:30.");
+  });
+});
```

Em `testes-dom/publicar-compositor-linkedin.dom.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-dom/publicar-compositor-linkedin.dom.tsx b/testes-dom/publicar-compositor-linkedin.dom.tsx
index 4f018db..f750ca9 100644
--- a/testes-dom/publicar-compositor-linkedin.dom.tsx
+++ b/testes-dom/publicar-compositor-linkedin.dom.tsx
@@ -6,6 +6,8 @@ import type { Medidas, Navegador } from "@/app/publicar/navegador";
 import {
   NOTA_DO_CARROSSEL_NO_LINKEDIN,
   NOTA_DO_CONTADOR_DO_LINKEDIN,
+  NOTA_DO_VIDEO_NO_LINKEDIN,
+  TEXTO_DO_VIDEO_QUE_NAO_E_MP4,
   tamanhoDoTextoNoLinkedin,
   textoDaRecusaNoLinkedin,
   textoDoProblemaDoCarrosselNoLinkedin,
@@ -17,8 +19,8 @@ import { NOTA_DA_LEGENDA_NO_LINKEDIN, redeAceitaAForma, TEXTO_SEM_REDE } from "@
 
 // O COMPOR COM AS DUAS REDES (docs/specs/2026-11-06-linkedin-no-perfil.md, §7; a parte 2b). A tela tem as caixinhas
 // "Instagram" e "LinkedIn", que começam só com o Instagram marcado (a decisão do Eduardo, 10/11). Cada forma liga e
-// desliga as redes, com o motivo: o só texto é só do LinkedIn, o reels e o story não vão ao LinkedIn, e o carrossel
-// vai como PDF, só com fotos (a parte 3a). Só no LinkedIn, o campo é o "Texto" da parte 2a; nas duas, a "Legenda" e o "Texto para o LinkedIn",
+// desliga as redes, com o motivo: o só texto é só do LinkedIn, o story não vai ao LinkedIn, o carrossel
+// vai como PDF, só com fotos (a parte 3a), e o reels vai como vídeo, só em MP4 (a parte 3b). Só no LinkedIn, o campo é o "Texto" da parte 2a; nas duas, a "Legenda" e o "Texto para o LinkedIn",
 // opcional. O clique chama a action das redes marcadas, e só ela. O navegador e as actions são falsos, como no
 // teste do compositor (testes-dom/publicar-compositor.dom.tsx).
 
@@ -34,6 +36,8 @@ const MEDIDAS: Record<string, Medidas> = {
   "grande-1.jpg": NA_MEDIDA,
   "grande-2.jpg": NA_MEDIDA,
   "clipe.mp4": { largura: 1080, altura: 1920, segundos: 10 },
+  // O MOV DO iPHONE (a parte 3b): o LinkedIn só aceita MP4.
+  "clipe.mov": { largura: 1080, altura: 1920, segundos: 10 },
 };
 
 /** O cabeçalho que a tela lê com o LinkedIn marcado no carrossel: o de cor de tela, a não ser o que o caso pedir. */
@@ -62,7 +66,9 @@ function navegadorFalso(opcoes: OpcoesDoNavegador = {}) {
     converter: async (a) => a,
     assinar: async (p) => {
       f.assinados.push({ forma: p.forma, nome: p.nome });
-      return { ok: true, caminho: `${PASTA}/${p.nome.replace(/\.\w+$/, "")}.jpg`, url: `https://bucket.test/${p.nome}` };
+      // A EXTENSÃO VEM DO TIPO, como em lib/bucket.ts: o vídeo fica .mp4 ou .mov (a parte 3b), e o resto, .jpg.
+      const ext = p.nome.endsWith(".mp4") ? "mp4" : p.nome.endsWith(".mov") ? "mov" : "jpg";
+      return { ok: true, caminho: `${PASTA}/${p.nome.replace(/\.\w+$/, "")}.${ext}`, url: `https://bucket.test/${p.nome}` };
     },
     subir: async (_url, arquivo, aoAndar) => {
       if (opcoes.falharSubidaDe?.delete(arquivo.name)) throw new Error("A conexão caiu durante o envio.");
@@ -185,20 +191,20 @@ describe("as caixinhas das redes", () => {
     expect(Array.from(forma.options).map((o) => o.value)).not.toContain("texto");
   });
 
-  it("o reels e o story desligam e desmarcam o LinkedIn, com o motivo da forma; o carrossel não (a parte 3a)", () => {
+  it("o story desliga e desmarca o LinkedIn, com o motivo da forma; o carrossel e o reels não (as partes 3a e 3b)", () => {
     renderizar(LIGADO);
     fireEvent.click(caixinha("LinkedIn"));
     expect(caixinha("LinkedIn").checked).toBe(true);
-    escolherForma("carrossel");
-    expect(caixinha("LinkedIn").disabled).toBe(false);
-    expect(caixinha("LinkedIn").checked).toBe(true);
-    for (const forma of ["reels", "story"] as const) {
+    for (const forma of ["carrossel", "reels"] as const) {
       escolherForma(forma);
-      expect(caixinha("LinkedIn").disabled).toBe(true);
-      expect(caixinha("LinkedIn").checked).toBe(false);
-      expect(screen.getByText(redeAceitaAForma("linkedin", forma) as string)).toBeTruthy();
-      expect(caixinha("Instagram").checked).toBe(true);
+      expect(caixinha("LinkedIn").disabled).toBe(false);
+      expect(caixinha("LinkedIn").checked).toBe(true);
     }
+    escolherForma("story");
+    expect(caixinha("LinkedIn").disabled).toBe(true);
+    expect(caixinha("LinkedIn").checked).toBe(false);
+    expect(screen.getByText(redeAceitaAForma("linkedin", "story") as string)).toBeTruthy();
+    expect(caixinha("Instagram").checked).toBe(true);
     // VOLTAR À IMAGEM NÃO REMARCA O LINKEDIN SOZINHO: o post sai público no perfil pessoal, e só vai quem marcar.
     escolherForma("imagem");
     expect(caixinha("LinkedIn").disabled).toBe(false);
@@ -533,3 +539,58 @@ describe("o botão de publicar (215)", () => {
     expect(botao().textContent).toBe("Publicar");
   });
 });
+
+/** O reels tem um campo só, "Arquivo" (o carrossel é que tem "Arquivos"). */
+async function escolherOVideo(arquivo: File) {
+  await act(async () => {
+    fireEvent.change(screen.getByLabelText("Arquivo"), { target: { files: [arquivo] } });
+  });
+  await waitFor(() => expect(screen.queryByText("Lendo o arquivo…")).toBeNull());
+}
+const mp4 = () => new File([new Uint8Array(1000)], "clipe.mp4", { type: "video/mp4" });
+
+// O VÍDEO NO LINKEDIN (a parte 3b; scratchpad/desenho-li3b.md, §3.1): o reels vai ao LinkedIn como vídeo, só em MP4,
+// com a nota de que ele sai em minutos. O MOV do iPhone desliga e desmarca a caixinha, com a frase do MP4.
+describe("o vídeo no LinkedIn (a parte 3b)", () => {
+  it("só no LinkedIn: o reels MP4 vai à action do LinkedIn com a forma vídeo, com a nota do vídeo", async () => {
+    const { acao, acaoDoLinkedin } = renderizar(LIGADO);
+    escolherForma("reels");
+    fireEvent.click(caixinha("LinkedIn"));
+    fireEvent.click(caixinha("Instagram"));
+    expect(screen.getByText(NOTA_DO_VIDEO_NO_LINKEDIN)).toBeTruthy();
+    await escolherOVideo(mp4());
+    fireEvent.change(campoDoTexto(), { target: { value: "Um vídeo novo" } });
+    await clicarEmPublicar();
+    await waitFor(() => expect(acaoDoLinkedin).toHaveBeenCalledTimes(1));
+    const dados = acaoDoLinkedin.mock.calls[0][0];
+    expect(dados.get("forma_linkedin")).toBe("video");
+    expect(dados.get("caminhos")).toBe(`${PASTA}/clipe.mp4`);
+    expect(acao).not.toHaveBeenCalled();
+  });
+
+  it("nas duas: o reels MP4 vai à action das duas, com a forma reels", async () => {
+    const { acaoDasDuasRedes } = renderizar(LIGADO);
+    escolherForma("reels");
+    fireEvent.click(caixinha("LinkedIn"));
+    expect(caixinha("Instagram").checked).toBe(true);
+    await escolherOVideo(mp4());
+    fireEvent.change(campoDaLegenda(), { target: { value: "O vídeo #ig" } });
+    await clicarEmPublicar();
+    await waitFor(() => expect(acaoDasDuasRedes).toHaveBeenCalledTimes(1));
+    const dados = acaoDasDuasRedes.mock.calls[0][0];
+    expect(dados.get("forma")).toBe("reels");
+    expect(dados.get("caminhos")).toBe(`${PASTA}/clipe.mp4`);
+  });
+
+  it("o MOV desliga e desmarca o LinkedIn, com a frase do MP4, e o Instagram segue marcado", async () => {
+    renderizar(LIGADO);
+    escolherForma("reels");
+    fireEvent.click(caixinha("LinkedIn"));
+    expect(caixinha("LinkedIn").checked).toBe(true);
+    await escolherOVideo(new File([new Uint8Array(1000)], "clipe.mov", { type: "video/quicktime" }));
+    expect(caixinha("LinkedIn").disabled).toBe(true);
+    expect(caixinha("LinkedIn").checked).toBe(false);
+    expect(screen.getByText(TEXTO_DO_VIDEO_QUE_NAO_E_MP4)).toBeTruthy();
+    expect(caixinha("Instagram").checked).toBe(true);
+  });
+});
```

Em `testes-integracao/linkedin-compor.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/linkedin-compor.integracao.ts b/testes-integracao/linkedin-compor.integracao.ts
index 54acd57..7a44b64 100644
--- a/testes-integracao/linkedin-compor.integracao.ts
+++ b/testes-integracao/linkedin-compor.integracao.ts
@@ -362,7 +362,7 @@ describe("o vídeo só no LinkedIn (a parte 3b)", () => {
   it("agora: o clique faz só a reserva, a linha volta à fila com o vídeo reservado, e o aviso diz que o post vai sair", async () => {
     const aviso = await publicarComoAdministrador(formulario({ forma_linkedin: "video", caminhos: VIDEO }));
     expect(aviso.tom).toBe("ok");
-    expect(aviso.texto).toBe("O post do LinkedIn está na fila e vai sair em instantes. Acompanhe em Publicações.");
+    expect(aviso.texto).toBe(regras.AVISO_DO_VIDEO_NA_FILA);
     expect(linkedin.pedidos).toEqual(["POST /rest/videos"]);
     const [linha] = await q(`select status, attempts, error, payload from queue`);
     expect(linha).toMatchObject({ status: "pending", attempts: 0 });
```

Em `testes-integracao/linkedin-duas-redes.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/linkedin-duas-redes.integracao.ts b/testes-integracao/linkedin-duas-redes.integracao.ts
index 970d887..a430645 100644
--- a/testes-integracao/linkedin-duas-redes.integracao.ts
+++ b/testes-integracao/linkedin-duas-redes.integracao.ts
@@ -849,7 +849,7 @@ describe("o vídeo nas duas redes (a parte 3b)", () => {
   it("agora: o clique não drena o LinkedIn (o 232), que fica na fila intocado, e o Instagram sai no dreno do clique", async () => {
     bucket.objetos.set(VIDEO_ORIGINAL, MP4);
     const aviso = await nasDuasComoAdministrador(reels());
-    expect(aviso.texto).toContain("LinkedIn: O post do LinkedIn está na fila e vai sair em instantes.");
+    expect(aviso.texto).toContain(`LinkedIn: ${regrasDoLinkedin.AVISO_DO_VIDEO_NA_FILA}`);
     const [li] = await daRede("publicacao_linkedin");
     expect(li.status).toBe("pending");
     expect(li.payload.video_urn).toBeUndefined();
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-video"; cd "$C" || exit 1
npx --no-install vitest run tests/linkedin-video-regras.test.ts tests/redes-do-post.test.ts 2>&1 | tee ../pl3b-f6-red-puros.log
npx --no-install vitest run --config vitest.dom.config.ts testes-dom/publicar-compositor-linkedin.dom.tsx 2>&1 | tee ../pl3b-f6-red-tela.log
docker ps --format '{{.Names}} {{.Status}}' | grep metodochat-banco-de-teste   # healthy; senão, docker start e espere healthy
DATABASE_URL_TESTES=postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes npx --no-install vitest run --config vitest.integracao.config.ts testes-integracao/linkedin-compor.integracao.ts testes-integracao/linkedin-duas-redes.integracao.ts 2>&1 | tee ../pl3b-f6-red-integ.log
```

Esperado: Nos puros, "Test Files 2 failed (2)" e "Tests 5 failed | 41 passed (46)". Caem: "na fila, o vídeo tem a frase própria; as outras formas, a de sempre"; "o LinkedIn aceita o só texto, a imagem, o carrossel (em PDF, a parte 3a) e o reels (como vídeo, a parte 3b); o story nunca"; "o story desliga o LinkedIn, com o motivo da forma; o reels não (a parte 3b)"; "o reels com um vídeo que não é MP4 desliga o LinkedIn, com a frase do MP4; sem a conexão, o motivo é o da conexão"; "no agora, o LinkedIn diz que o vídeo sobe em partes; agendado, a hora, como sempre". Na tela, "Test Files 1 failed (1)" e "Tests 4 failed | 25 passed (29)". Caem: "o story desliga e desmarca o LinkedIn, com o motivo da forma; o carrossel e o reels não (as partes 3a e 3b)"; "só no LinkedIn: o reels MP4 vai à action do LinkedIn com a forma vídeo, com a nota do vídeo"; "nas duas: o reels MP4 vai à action das duas, com a forma reels"; "o MOV desliga e desmarca o LinkedIn, com a frase do MP4, e o Instagram segue marcado". Na integração, `ALVO: banco de TESTE`, nenhum `teste_tmp` antes e depois, "Test Files 2 failed (2)" e "Tests 2 failed | 63 passed (65)". Caem: "agora: o clique faz só a reserva, a linha volta à fila com o vídeo reservado, e o aviso diz que o post vai sair"; "agora: o clique não drena o LinkedIn (o 232), que fica na fila intocado, e o Instagram sai no dreno do clique".

- [ ] **Passo 3: o código**

Em `lib/linkedin-publicacao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/linkedin-publicacao.ts b/lib/linkedin-publicacao.ts
index 5221850..13f1ab5 100644
--- a/lib/linkedin-publicacao.ts
+++ b/lib/linkedin-publicacao.ts
@@ -274,6 +274,8 @@ export function avisoDoPostNoLinkedin(d: {
   desfecho: "publicado" | "aguardando" | "falhou" | null;
   motivo?: string | null;
   agendadoPara: { dia: number; mes: number; hora: number; minuto: number } | null;
+  /** A forma do post: o vídeo na fila tem frase própria (a parte 3b). */
+  forma?: FormaNoLinkedin;
 }): { tom: "ok" | "erro"; texto: string } {
   if (d.agendadoPara) {
     const p = (n: number) => String(n).padStart(2, "0");
@@ -284,9 +286,13 @@ export function avisoDoPostNoLinkedin(d: {
   if (d.desfecho === "falhou") {
     return { tom: "erro", texto: `O post não saiu no LinkedIn: ${d.motivo?.trim() || "o motivo não foi registrado"}.` };
   }
+  // O VÍDEO NA FILA (a parte 3b): ele sobe em partes, uma por passada, e sai em minutos, e não em instantes.
+  if (d.forma === "video") return { tom: "ok", texto: AVISO_DO_VIDEO_NA_FILA };
   return { tom: "ok", texto: "O post do LinkedIn está na fila e vai sair em instantes. Acompanhe em Publicações." };
 }
 
+export const AVISO_DO_VIDEO_NA_FILA = "O vídeo do LinkedIn está na fila e sobe em partes; ele sai em alguns minutos. Acompanhe em Publicações.";
+
 // ---------------------------------------------------------------------------------------------------------------
 // O PAYLOAD DA LINHA `publicacao_linkedin` NA FILA
 // ---------------------------------------------------------------------------------------------------------------
@@ -588,6 +594,9 @@ export function vaiCruParaOLinkedin(c: { componentes: number; precisao: number;
  */
 export const TEXTO_DO_VIDEO_QUE_NAO_E_MP4 = "O LinkedIn só aceita vídeo MP4.";
 
+/** A NOTA DA TELA COM O LINKEDIN MARCADO NO REELS (a parte 3b): o que vai, e quando sai. */
+export const NOTA_DO_VIDEO_NO_LINKEDIN = "No LinkedIn, o vídeo vai em partes e sai alguns minutos depois do clique: só MP4.";
+
 export function oVideoVaiAoLinkedin(mime: string): boolean {
   return mime === "video/mp4";
 }
```

Em `lib/redes-do-post.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/redes-do-post.ts b/lib/redes-do-post.ts
index 4d66c39..a6d8eeb 100644
--- a/lib/redes-do-post.ts
+++ b/lib/redes-do-post.ts
@@ -5,8 +5,10 @@
 import { avisoDaPublicacaoEnfileirada, type Aviso } from "@/lib/avisos";
 import {
   avisoDoPostNoLinkedin,
+  TEXTO_DO_VIDEO_QUE_NAO_E_MP4,
   textoDoProblemaDoCarrosselNoLinkedin,
   type DisponibilidadeDoLinkedin,
+  type FormaNoLinkedin,
 } from "@/lib/linkedin-publicacao";
 import { textoDaRecusaDaPublicacao, type FormaDePublicacao } from "@/lib/publicacao";
 
@@ -18,9 +20,9 @@ export type FormaDaTela = FormaDePublicacao | "texto";
 const FORMAS_DO_INSTAGRAM: readonly FormaDePublicacao[] = ["imagem", "carrossel", "reels", "story"];
 
 /**
- * POR QUE UMA REDE NÃO ACEITA A FORMA, ou null quando aceita. O LinkedIn recebe o só texto, a imagem e o carrossel,
- * que vai como PDF, só com fotos (a parte 3a; o vídeo na lista desliga a caixinha, em `estadoDasCaixinhas`). O vídeo
- * chega na próxima entrega (a 3b), e o story não existe lá.
+ * POR QUE UMA REDE NÃO ACEITA A FORMA, ou null quando aceita. O LinkedIn recebe o só texto, a imagem, o carrossel,
+ * que vai como PDF, só com fotos (a parte 3a; o vídeo na lista desliga a caixinha, em `estadoDasCaixinhas`), e o reels,
+ * que vai como vídeo, só em MP4 (a parte 3b; o MOV desliga a caixinha). O story não existe lá.
  */
 export function redeAceitaAForma(rede: Rede, forma: FormaDaTela): string | null {
   if (rede === "instagram") return forma === "texto" ? "O Instagram não publica post só de texto." : null;
@@ -28,9 +30,8 @@ export function redeAceitaAForma(rede: Rede, forma: FormaDaTela): string | null
     case "texto":
     case "imagem":
     case "carrossel":
-      return null;
     case "reels":
-      return "O LinkedIn recebe vídeo na próxima entrega.";
+      return null;
     case "story":
       return "O LinkedIn não tem story.";
   }
@@ -64,13 +65,16 @@ export function estadoDasCaixinhas(p: {
   linkedin: DisponibilidadeDoLinkedin | null;
   /** Há vídeo na lista de arquivos. */
   comVideo?: boolean;
+  /** Há um vídeo que não é MP4 na lista (o MOV do iPhone, a parte 3b). */
+  videoQueNaoEMp4?: boolean;
 }): { instagram: EstadoDaCaixinha; linkedin: EstadoDaCaixinha | null } {
   const motivoDoInstagram = redeAceitaAForma("instagram", p.forma);
   const instagram = { ligada: !motivoDoInstagram, marcada: !motivoDoInstagram && p.marcadas.instagram, motivo: motivoDoInstagram };
   if (!p.linkedin) return { instagram, linkedin: null };
   const motivoDoLinkedin = p.linkedin.disponivel
     ? (redeAceitaAForma("linkedin", p.forma) ??
-      (p.forma === "carrossel" && p.comVideo ? textoDoProblemaDoCarrosselNoLinkedin("video") : null))
+      (p.forma === "carrossel" && p.comVideo ? textoDoProblemaDoCarrosselNoLinkedin("video") : null) ??
+      (p.forma === "reels" && p.videoQueNaoEMp4 ? TEXTO_DO_VIDEO_QUE_NAO_E_MP4 : null))
     : p.linkedin.motivo;
   return {
     instagram,
@@ -113,7 +117,7 @@ export type LadoDoInstagram = { entrou: true; jaVale: boolean } | { entrou: fals
 
 /** O lado do LinkedIn: entrou, com o desfecho do "agora" quando já valia, ou a chave já existia. */
 export type LadoDoLinkedin =
-  | { entrou: true; jaVale: boolean; desfecho: "publicado" | "aguardando" | "falhou" | null; motivo?: string | null }
+  | { entrou: true; jaVale: boolean; desfecho: "publicado" | "aguardando" | "falhou" | null; motivo?: string | null; forma?: FormaNoLinkedin }
   | { entrou: false };
 
 /**
@@ -170,6 +174,7 @@ export function avisoDasDuasRedes(d: DesfechoDasDuasRedes): Aviso {
         desfecho: d.linkedin.desfecho,
         motivo: d.linkedin.motivo,
         agendadoPara: d.linkedin.jaVale ? null : d.campos,
+        forma: d.linkedin.forma,
       })
     : { tom: "ok" as const, texto: JA_EXISTIA_NO_LINKEDIN };
   const nadaNovo = !d.instagram.entrou && !d.linkedin.entrou;
```

Em `app/publicar/actions.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/publicar/actions.ts b/app/publicar/actions.ts
index fedac79..17479ef 100644
--- a/app/publicar/actions.ts
+++ b/app/publicar/actions.ts
@@ -284,7 +284,7 @@ export async function publicarNoLinkedin(formData: FormData): Promise<void> {
   revalidatePath("/publicar/novo");
   revalidatePath("/publicar");
   revalidatePath("/eventos");
-  redirect(urlDePublicarComAviso(avisoDoPostNoLinkedin({ desfecho, motivo, agendadoPara: r.jaVale ? null : campos })));
+  redirect(urlDePublicarComAviso(avisoDoPostNoLinkedin({ desfecho, motivo, agendadoPara: r.jaVale ? null : campos, forma })));
 }
 
 /**
@@ -480,7 +480,7 @@ export async function publicarNasDuasRedes(formData: FormData): Promise<void> {
         tipo: "entrou",
         campos,
         instagram: instagram.entrou ? { entrou: true, jaVale: instagram.jaVale } : { entrou: false },
-        linkedin: linkedin.entrou ? { entrou: true, jaVale: linkedin.jaVale, desfecho, motivo } : { entrou: false },
+        linkedin: linkedin.entrou ? { entrou: true, jaVale: linkedin.jaVale, desfecho, motivo, forma: formaNoLinkedin } : { entrou: false },
       })
     )
   );
```

Em `app/publicar/enviador.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/publicar/enviador.tsx b/app/publicar/enviador.tsx
index 1b2cd0f..8217057 100644
--- a/app/publicar/enviador.tsx
+++ b/app/publicar/enviador.tsx
@@ -41,11 +41,13 @@ import {
 } from "@/lib/publicacao";
 // O LINKEDIN (a parte 2a: uma rede por post). As regras puras dele, sem import de servidor: as formas, o texto
 // contado como o LinkedIn conta (achado 212), as recusas do pedido e o id do envio. Na parte 3a, o carrossel em PDF:
-// a nota, o teto das fotos juntas e o JPEG que vai cru.
+// a nota, o teto das fotos juntas e o JPEG que vai cru. Na parte 3b, o vídeo: só MP4, e a nota de que ele sai em minutos.
 import {
   LIMITE_DO_TEXTO_DO_LINKEDIN,
   NOTA_DO_CARROSSEL_NO_LINKEDIN,
   NOTA_DO_CONTADOR_DO_LINKEDIN,
+  NOTA_DO_VIDEO_NO_LINKEDIN,
+  oVideoVaiAoLinkedin,
   TETO_DO_CARROSSEL_NO_LINKEDIN_BYTES,
   novoIdDoEnvio,
   problemaDoTextoDoLinkedin,
@@ -213,6 +215,8 @@ export default function Enviador({
     marcadas,
     linkedin: mostraARede ? linkedin : null,
     comVideo: slides.some((s) => s.video),
+    // O VÍDEO DO LINKEDIN SÓ VAI EM MP4 (a parte 3b): o MOV do iPhone desliga a caixinha, com a frase.
+    videoQueNaoEMp4: slides.some((s) => s.video && !oVideoVaiAoLinkedin(s.arquivo.type)),
   });
   const paraOInstagram = redes.instagram.marcada;
   const paraOLinkedin = redes.linkedin?.marcada === true;
@@ -220,8 +224,12 @@ export default function Enviador({
   const soNoLinkedin = paraOLinkedin && !paraOInstagram;
   /** Nas duas: a "Legenda", o "Texto para o LinkedIn" (opcional) e a action das duas. */
   const nasDuas = paraOLinkedin && paraOInstagram;
-  /** A forma que vai ao LinkedIn: o só texto, a imagem ou o carrossel, que vai como PDF (a parte 3a). */
-  const formaNoLinkedin: FormaNoLinkedin = formaDaTela === "texto" ? "texto" : formaDaTela === "carrossel" ? "carrossel" : "imagem";
+  /**
+   * A forma que vai ao LinkedIn: o só texto, a imagem, o carrossel, que vai como PDF (a parte 3a), ou o reels, que vai
+   * como vídeo (a parte 3b).
+   */
+  const formaNoLinkedin: FormaNoLinkedin =
+    formaDaTela === "texto" ? "texto" : formaDaTela === "carrossel" ? "carrossel" : formaDaTela === "reels" ? "video" : "imagem";
   /** O carrossel que vai ao LinkedIn: o JPEG só vai cru se o PDF o leva como está, e as fotos juntas têm o teto dele. */
   const carrosselNoLinkedin = paraOLinkedin && formaNoLinkedin === "carrossel";
   /**
@@ -828,6 +836,7 @@ export default function Enviador({
           <p className={hint}>No LinkedIn, a imagem segue as regras da imagem do Instagram: JPEG, na proporção escolhida.</p>
         )}
         {carrosselNoLinkedin && <p className={hint}>{NOTA_DO_CARROSSEL_NO_LINKEDIN}</p>}
+        {paraOLinkedin && formaNoLinkedin === "video" && <p className={hint}>{NOTA_DO_VIDEO_NO_LINKEDIN}</p>}
       </div>
 
       {enquadra && temArquivo && (
```

- [ ] **Passo 4: rodar e ver passar**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-video"; cd "$C" || exit 1
npx --no-install vitest run tests/linkedin-video-regras.test.ts tests/redes-do-post.test.ts 2>&1 | tee ../pl3b-f6-green-puros.log
npx --no-install vitest run --config vitest.dom.config.ts testes-dom/publicar-compositor-linkedin.dom.tsx 2>&1 | tee ../pl3b-f6-green-tela.log
docker ps --format '{{.Names}} {{.Status}}' | grep metodochat-banco-de-teste   # healthy; senão, docker start e espere healthy
DATABASE_URL_TESTES=postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes npx --no-install vitest run --config vitest.integracao.config.ts testes-integracao/linkedin-compor.integracao.ts testes-integracao/linkedin-duas-redes.integracao.ts 2>&1 | tee ../pl3b-f6-green-integ.log
npx --no-install vitest run 2>&1 | tee ../pl3b-f6-suite.log
npx --no-install vitest run --config vitest.dom.config.ts 2>&1 | tee ../pl3b-f6-suite-tela.log
npx --no-install tsc --noEmit
npx --no-install eslint app/publicar/actions.ts app/publicar/enviador.tsx lib/linkedin-publicacao.ts lib/redes-do-post.ts testes-dom/publicar-compositor-linkedin.dom.tsx testes-integracao/linkedin-compor.integracao.ts testes-integracao/linkedin-duas-redes.integracao.ts tests/linkedin-video-regras.test.ts tests/redes-do-post.test.ts
git diff --name-only a5cd8d4 -- lib/queue-drain.ts lib/fila-tipos.ts migrations scripts package.json package-lock.json   # vazio
```

Esperado: Nos puros, "Test Files 2 passed (2)" e "Tests 46 passed (46)". Na tela, "Test Files 1 passed (1)" e "Tests 29 passed (29)". Na integração, `ALVO: banco de TESTE`, nenhum `teste_tmp` antes e depois, "Test Files 2 passed (2)" e "Tests 65 passed (65)". A suíte pura inteira: "Test Files 162 passed (162)" e "Tests 3878 passed (3878)". A suíte de tela inteira: "Test Files 36 passed (36)" e "Tests 350 passed (350)". O `tsc` e o lint sem saída, e a guarda vazia.

- [ ] **Passo 5: o commit**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-video"; cd "$C" || exit 1
node ../varrer-texto.mjs app/publicar/actions.ts app/publicar/enviador.tsx lib/linkedin-publicacao.ts lib/redes-do-post.ts testes-dom/publicar-compositor-linkedin.dom.tsx testes-integracao/linkedin-compor.integracao.ts testes-integracao/linkedin-duas-redes.integracao.ts tests/linkedin-video-regras.test.ts tests/redes-do-post.test.ts && test "$(git branch --show-current)" = linkedin-video && git add app/publicar/actions.ts app/publicar/enviador.tsx lib/linkedin-publicacao.ts lib/redes-do-post.ts testes-dom/publicar-compositor-linkedin.dom.tsx testes-integracao/linkedin-compor.integracao.ts testes-integracao/linkedin-duas-redes.integracao.ts tests/linkedin-video-regras.test.ts tests/redes-do-post.test.ts && git commit -m "O reels MP4 liga a caixinha do LinkedIn, o MOV a desliga com a frase do MP4, e o aviso do vídeo diz que ele sobe em partes e sai em alguns minutos"
git show HEAD | git patch-id --stable | cut -c1-12   # 601a079771da
```

O patch-id tem de começar por `601a079771da` (o mesmo do ensaio). Se não começar, pare.

---

### FASE 6-bis — O Remarcar do vídeo recomeça a contar a idade de 2 horas, com as passadas e o resto do envio como estavam (245)

**Arquivos:** `app/publicar/post/actions.ts`, `testes-integracao/linkedin-telas.integracao.ts`.

- [ ] **Passo 1: os testes**

Em `testes-integracao/linkedin-telas.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/linkedin-telas.integracao.ts b/testes-integracao/linkedin-telas.integracao.ts
index 2829fff..e3a88ed 100644
--- a/testes-integracao/linkedin-telas.integracao.ts
+++ b/testes-integracao/linkedin-telas.integracao.ts
@@ -442,3 +442,90 @@ describe("o Início e o gerador conhecem o post do LinkedIn", () => {
     expect(await repositorio.caminhosNaFila([caminho, `${CONTA_A}/nao-esta-na-fila.jpg`])).toEqual([caminho]);
   });
 });
+
+// O REMARCAR DO VÍDEO NO MEIO DO ENVIO (o 245; a parte 3b, scratchpad/desenho-li3b.md, §3.7: "a linha continua de
+// onde parou"). O teto de idade conta da primeira passada; o Remarcar tira a marca, e a contagem recomeça na primeira
+// passada da hora nova. As passadas ficam como estavam (o teto delas é o limite do envio), e o payload das outras
+// linhas não muda, nem quando elas têm uma chave com o mesmo nome.
+describe("o remarcar do vídeo do LinkedIn no meio do envio (o 245)", () => {
+  /** Um vídeo que já subiu inteiro e foi finalizado, com a primeira passada há 3 horas: só falta o post. */
+  async function semearOVideoFinalizado(): Promise<{ id: string; payload: Record<string, unknown> }> {
+    semente++;
+    const [linha] = (await q(
+      `insert into queue (account_id, kind, payload, dedupe_key, not_before)
+       values ($1, 'publicacao_linkedin',
+               $2::jsonb || jsonb_build_object('primeira_passada_em', to_json(now() - interval '3 hours') #>> '{}'),
+               $3, now() + interval '1 hour')
+       returning id, payload`,
+      [
+        CONTA_A,
+        {
+          forma: "video",
+          caminhos: [`${CONTA_A}/video-${semente}.mp4`],
+          texto: "O vídeo que já subiu",
+          video_urn: "urn:li:video:C4E000000000000245",
+          upload_token: "token-do-envio-das-telas",
+          partes: [{ inicio: 0, fim: 999, url: "http://127.0.0.1/parte-das-telas" }],
+          etags: ['"etag-das-telas"'],
+          video_finalizado: true,
+          passadas_do_video: 4,
+        },
+        `telas-video-${semente}`,
+      ]
+    )) as { id: string; payload: Record<string, unknown> }[];
+    return linha;
+  }
+
+  it("remarcar para daqui a três horas tira só a marca da primeira passada; as passadas e o resto do envio ficam", async () => {
+    const { id, payload: antes } = await semearOVideoFinalizado();
+    expect(typeof antes.primeira_passada_em).toBe("string");
+    const alvo = Math.floor((Date.now() + 3 * 3600 * 1000) / 60000) * 60000;
+    const aviso = await avisoDe(acoes.remarcarPublicacao, formulario({ id, data_hora: campoDeDataHora(alvo), fuso: "0" }));
+    expect(aviso.tom).toBe("ok");
+    const depois = await lerItem(id);
+    expect(new Date(depois.not_before as Date).getTime()).toBe(alvo);
+    const esperado: Record<string, unknown> = { ...antes };
+    delete esperado.primeira_passada_em;
+    expect(depois.payload).toEqual(esperado);
+    expect((depois.payload as Record<string, unknown>).passadas_do_video).toBe(4);
+    expect(pedidos.linkedin).toEqual([]);
+  });
+
+  it("remarcar para o minuto corrente: a idade recomeça, e o vídeo sai pelo post, sem contar passada", async () => {
+    await conectar();
+    const { id } = await semearOVideoFinalizado();
+    const minuto = Math.floor(Date.now() / 60000) * 60000;
+    const aviso = await avisoDe(acoes.remarcarPublicacao, formulario({ id, data_hora: campoDeDataHora(minuto), fuso: "0" }));
+    expect(aviso.tom).toBe("ok");
+    const depois = await lerItem(id);
+    expect(depois).toMatchObject({ status: "sent", error: null });
+    expect(pedidos.linkedin).toEqual(["POST /rest/posts"]);
+    const payload = depois.payload as Record<string, unknown>;
+    expect(payload.passadas_do_video).toBe(4);
+    // A MARCA É A DA PASSADA DEPOIS DA HORA NOVA, e não a de 3 horas atrás.
+    expect(Date.now() - new Date(payload.primeira_passada_em as string).getTime()).toBeLessThan(5 * 60 * 1000);
+    expect(pedidos.meta).toEqual([]);
+  });
+
+  it("o post do Instagram e o do LinkedIn que não é vídeo ficam com o payload intacto, mesmo com uma chave do mesmo nome", async () => {
+    const marca = { primeira_passada_em: "2026-11-16T12:00:00.000Z" };
+    const instagram = await semear({ kind: "publicacao", emSegundos: 3600 });
+    const texto = await semear({ forma: "texto", emSegundos: 3600 });
+    const imagem = await semear({ forma: "imagem", emSegundos: 3600 });
+    for (const { id } of [instagram, texto, imagem]) {
+      await q(`update queue set payload = payload || $2::jsonb where id = $1`, [id, marca]);
+    }
+    const alvo = Math.floor((Date.now() + 3 * 3600 * 1000) / 60000) * 60000;
+    for (const { id } of [instagram, texto, imagem]) {
+      const antes = (await lerItem(id)).payload;
+      expect(antes).toMatchObject(marca);
+      const aviso = await avisoDe(acoes.remarcarPublicacao, formulario({ id, data_hora: campoDeDataHora(alvo), fuso: "0" }));
+      expect(aviso.tom).toBe("ok");
+      const depois = await lerItem(id);
+      expect(new Date(depois.not_before as Date).getTime()).toBe(alvo);
+      expect(depois.payload).toEqual(antes);
+    }
+    expect(pedidos.linkedin).toEqual([]);
+    expect(pedidos.meta).toEqual([]);
+  });
+});
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-video"; cd "$C" || exit 1
docker ps --format '{{.Names}} {{.Status}}' | grep metodochat-banco-de-teste   # healthy; senão, docker start e espere healthy
DATABASE_URL_TESTES=postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes npx --no-install vitest run --config vitest.integracao.config.ts testes-integracao/linkedin-telas.integracao.ts 2>&1 | tee ../pl3b-f6bis-red-integ.log
```

Esperado: Na integração, `ALVO: banco de TESTE`, nenhum `teste_tmp` antes e depois, "Test Files 1 failed (1)" e "Tests 2 failed | 18 passed (20)". Caem: "remarcar para daqui a três horas tira só a marca da primeira passada; as passadas e o resto do envio ficam"; "remarcar para o minuto corrente: a idade recomeça, e o vídeo sai pelo post, sem contar passada".

- [ ] **Passo 3: o código**

Em `app/publicar/post/actions.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/publicar/post/actions.ts b/app/publicar/post/actions.ts
index 1fec23e..20bb709 100644
--- a/app/publicar/post/actions.ts
+++ b/app/publicar/post/actions.ts
@@ -277,8 +277,16 @@ export async function remarcarPublicacao(formData: FormData): Promise<void> {
   //
   // SÓ O POST DE FORMA QUE ESTE CÓDIGO CONHECE (a preparação da parte 3 do LinkedIn): a forma nova não é publicada
   // por este código, e gravar a hora dela, ou drenar, seria dizer "feito" com a linha parada.
+  //
+  // O VÍDEO DO LINKEDIN RECOMEÇA A CONTAR A IDADE (o 245; a parte 3b, scratchpad/desenho-li3b.md, §3.7: "a linha
+  // continua de onde parou"). O teto de 2 horas conta da primeira passada (`marcarAPrimeiraPassada`,
+  // lib/linkedin-fila.ts), e o vídeo remarcado para mais de 2 horas depois dela encerraria na primeira passada da hora
+  // nova. O Remarcar tira a marca, e a primeira passada depois da hora nova grava outra. As passadas ficam: o Remarcar
+  // não soma passada, e o teto delas continua sendo o limite do envio. O payload das outras linhas não muda.
   const afetadas = (await sql().query(
-    `update queue set not_before = greatest(now(), $3::timestamptz)
+    `update queue set not_before = greatest(now(), $3::timestamptz),
+                      payload = case when kind = 'publicacao_linkedin' and payload->>'forma' = 'video'
+                                     then payload - 'primeira_passada_em' else payload end
      ${ALVO_DA_MUDANCA}
        and ${soAFormaConhecidaDoLinkedin("$5")}
      returning id, kind,
```

- [ ] **Passo 4: rodar e ver passar**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-video"; cd "$C" || exit 1
docker ps --format '{{.Names}} {{.Status}}' | grep metodochat-banco-de-teste   # healthy; senão, docker start e espere healthy
DATABASE_URL_TESTES=postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes npx --no-install vitest run --config vitest.integracao.config.ts testes-integracao/linkedin-telas.integracao.ts 2>&1 | tee ../pl3b-f6bis-green-integ.log
npx --no-install vitest run 2>&1 | tee ../pl3b-f6bis-suite.log
npx --no-install tsc --noEmit
npx --no-install eslint app/publicar/post/actions.ts testes-integracao/linkedin-telas.integracao.ts
git diff --name-only a5cd8d4 -- lib/queue-drain.ts lib/fila-tipos.ts migrations scripts package.json package-lock.json   # vazio
```

Esperado: Na integração, `ALVO: banco de TESTE`, nenhum `teste_tmp` antes e depois, "Test Files 1 passed (1)" e "Tests 20 passed (20)". A suíte pura inteira: "Test Files 162 passed (162)" e "Tests 3878 passed (3878)". O `tsc` e o lint sem saída, e a guarda vazia.

- [ ] **Passo 5: o commit**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-video"; cd "$C" || exit 1
node ../varrer-texto.mjs app/publicar/post/actions.ts testes-integracao/linkedin-telas.integracao.ts && test "$(git branch --show-current)" = linkedin-video && git add app/publicar/post/actions.ts testes-integracao/linkedin-telas.integracao.ts && git commit -m "O Remarcar do vídeo do LinkedIn tira a marca da primeira passada, e a contagem das 2 horas recomeça na hora nova, com as passadas e o resto do envio como estavam"
git show HEAD | git patch-id --stable | cut -c1-12   # 99a765366768
```

O patch-id tem de começar por `99a765366768` (o mesmo do ensaio). Se não começar, pare.

---

### FASE 7 — As Publicações mostram o vídeo do LinkedIn sem capa e com o ícone, e a página do post o desenha como vídeo

**Arquivos:** `lib/post-da-fila.ts`, `testes-integracao/linkedin-telas.integracao.ts`, `tests/post-da-fila.test.ts`.

- [ ] **Passo 1: os testes**

Em `tests/post-da-fila.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/post-da-fila.test.ts b/tests/post-da-fila.test.ts
index 03ed5f0..3cc5f40 100644
--- a/tests/post-da-fila.test.ts
+++ b/tests/post-da-fila.test.ts
@@ -23,6 +23,8 @@ const LI_CARROSSEL = {
   kind: "publicacao_linkedin",
   payload: { forma: "carrossel", caminhos: ["conta/c1.jpg", "conta/c2.jpg"], texto: "O carrossel" },
 };
+// O VÍDEO DO LINKEDIN (a parte 3b): um arquivo só, o `.mp4`, que não vira capa.
+const LI_VIDEO = { kind: "publicacao_linkedin", payload: { forma: "video", caminhos: ["conta/v.mp4"], texto: "O vídeo" } };
 
 describe("o nome do post do LinkedIn", () => {
   it("leva a rede na frente, como o convite do LinkedIn", () => {
@@ -58,6 +60,11 @@ describe("o quadrado do calendário", () => {
     expect(cartaoDoPost(LI_CARROSSEL, true)).toEqual({ rotulo: "LinkedIn · Carrossel (PDF)", capa: null, soVideo: false });
   });
 
+  it("o vídeo do LinkedIn fica sem capa e com o ícone enquanto não saiu, como o reels do Instagram (a parte 3b)", () => {
+    expect(cartaoDoPost(LI_VIDEO, false)).toEqual({ rotulo: "LinkedIn · Vídeo", capa: null, soVideo: true });
+    expect(cartaoDoPost(LI_VIDEO, true)).toEqual({ rotulo: "LinkedIn · Vídeo", capa: null, soVideo: false });
+  });
+
   it("o payload torto do LinkedIn não vira o do Instagram", () => {
     expect(cartaoDoPost({ kind: "publicacao_linkedin", payload: { forma: "reels" } }, false).rotulo).toBe(
       "LinkedIn · Forma não reconhecida"
@@ -150,6 +157,15 @@ describe("a página de um post", () => {
     // O SÓ TEXTO CONTINUA SEM A FRASE: ele não tem mídia.
     expect(paginaDoPost({ ...LI_TEXTO, error: null }, saiu).sobreAMidia).toBeNull();
   });
+
+  it("o vídeo do LinkedIn é vídeo na prévia, e tem a frase sobre a mídia (a parte 3b)", () => {
+    const p = paginaDoPost({ ...LI_VIDEO, error: null }, agendado);
+    expect(p.titulo).toBe("LinkedIn · Vídeo");
+    expect(p.caminhos).toEqual(["conta/v.mp4"]);
+    expect(p.ehVideo("conta/v.mp4")).toBe(true);
+    expect(p.sobreAMidia).toBe(fraseSobreAMidia(agendado, null));
+    expect(paginaDoPost({ ...LI_VIDEO, error: null }, saiu).sobreAMidia).toBe(fraseSobreAMidia(saiu, null));
+  });
 });
 
 describe("o aviso do cancelar e do remarcar", () => {
```

Em `testes-integracao/linkedin-telas.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/linkedin-telas.integracao.ts b/testes-integracao/linkedin-telas.integracao.ts
index e3a88ed..dc55d79 100644
--- a/testes-integracao/linkedin-telas.integracao.ts
+++ b/testes-integracao/linkedin-telas.integracao.ts
@@ -141,7 +141,7 @@ let semente = 0;
 async function semear(item: {
   conta?: string;
   kind?: "publicacao" | "publicacao_linkedin" | "dm_manual";
-  forma?: "texto" | "imagem";
+  forma?: "texto" | "imagem" | "video";
   texto?: string;
   status?: string;
   emSegundos?: number;
@@ -152,13 +152,14 @@ async function semear(item: {
   semente++;
   const conta = item.conta ?? CONTA_A;
   const kind = item.kind ?? "publicacao_linkedin";
-  const caminho = `${conta}/tela-${semente}.jpg`;
   const forma = item.forma ?? "texto";
+  // O VÍDEO (a parte 3b) é um `.mp4`; o resto, `.jpg`.
+  const caminho = `${conta}/tela-${semente}.${forma === "video" ? "mp4" : "jpg"}`;
   const payload =
     kind === "publicacao_linkedin"
       ? {
           forma,
-          caminhos: forma === "imagem" ? [caminho] : [],
+          caminhos: forma === "texto" ? [] : [caminho],
           texto: item.texto ?? `O post ${semente} do LinkedIn`,
           ...(item.postUrn ? { post_urn: item.postUrn } : {}),
         }
@@ -289,6 +290,14 @@ describe("o calendário e \"Não saíram\" leem o post do LinkedIn", () => {
     await semear({ conta: CONTA_B, forma: "texto", texto: "O post da outra conta" });
     expect(await arvoreDosAgendados()).not.toContain("O post da outra conta");
   });
+
+  it("o vídeo do LinkedIn fica sem capa e com o ícone ▶ enquanto não saiu, e não como imagem quebrada (a parte 3b)", async () => {
+    const video = await semear({ forma: "video", emSegundos: 3600 });
+    const arvore = await arvoreDosAgendados();
+    expect(arvore).toContain("LinkedIn · Vídeo");
+    expect(arvore).toContain("▶");
+    expect(arvore).not.toContain(`/storage/v1/object/public/${BUCKET}/${video.caminho}`);
+  });
 });
 
 describe("a página do post do LinkedIn", () => {
@@ -309,6 +318,20 @@ describe("a página do post do LinkedIn", () => {
     expect(await arvoreDoDetalhe(id)).toContain(`/storage/v1/object/public/${BUCKET}/${caminho}`);
   });
 
+  it("com vídeo: agendado, o arquivo do bucket aparece como vídeo; publicado, a frase da mídia apagada (a parte 3b)", async () => {
+    const { id, caminho } = await semear({ forma: "video" });
+    const arvore = await arvoreDoDetalhe(id);
+    expect(arvore).toContain("LinkedIn · Vídeo");
+    expect(arvore).toContain(`/storage/v1/object/public/${BUCKET}/${caminho}`);
+    expect(arvore).toContain("▶ vídeo");
+    const publicado = await semear({ forma: "video", status: "sent", emSegundos: -3600, postUrn: "urn:li:share:7000000000000000777" });
+    const frase = publicacao.fraseSobreAMidia({ saiu: true, encerrado: true }, null) ?? "";
+    expect(frase).not.toBe("");
+    expect(await arvoreDoDetalhe(publicado.id)).toContain(frase);
+    expect(pedidos.linkedin).toEqual([]);
+    expect(pedidos.meta).toEqual([]);
+  });
+
   it("publicado: o link \"Ver no LinkedIn\" leva ao post, sem falar com ninguém", async () => {
     const { id } = await semear({
       forma: "texto",
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-video"; cd "$C" || exit 1
npx --no-install vitest run tests/post-da-fila.test.ts 2>&1 | tee ../pl3b-f7-red-puros.log
docker ps --format '{{.Names}} {{.Status}}' | grep metodochat-banco-de-teste   # healthy; senão, docker start e espere healthy
DATABASE_URL_TESTES=postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes npx --no-install vitest run --config vitest.integracao.config.ts testes-integracao/linkedin-telas.integracao.ts 2>&1 | tee ../pl3b-f7-red-integ.log
```

Esperado: Nos puros, "Test Files 1 failed (1)" e "Tests 2 failed | 16 passed (18)". Caem: "o vídeo do LinkedIn fica sem capa e com o ícone enquanto não saiu, como o reels do Instagram (a parte 3b)"; "o vídeo do LinkedIn é vídeo na prévia, e tem a frase sobre a mídia (a parte 3b)". Na integração, `ALVO: banco de TESTE`, nenhum `teste_tmp` antes e depois, "Test Files 1 failed (1)" e "Tests 2 failed | 20 passed (22)". Caem: "o vídeo do LinkedIn fica sem capa e com o ícone ▶ enquanto não saiu, e não como imagem quebrada (a parte 3b)"; "com vídeo: agendado, o arquivo do bucket aparece como vídeo; publicado, a frase da mídia apagada (a parte 3b)".

- [ ] **Passo 3: o código**

Em `lib/post-da-fila.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/post-da-fila.ts b/lib/post-da-fila.ts
index e8d81a6..ffd6ae1 100644
--- a/lib/post-da-fila.ts
+++ b/lib/post-da-fila.ts
@@ -34,8 +34,14 @@ export function cartaoDoPost(
 ): { rotulo: string; capa: string | null; soVideo: boolean } {
   if (ehPostDoLinkedin(item.kind)) {
     const li = lerPayloadDoLinkedin(item.payload);
-    // A CAPA É A IMAGEM, ou a primeira foto do carrossel (a parte 3a); o só texto não tem.
-    return { rotulo: rotuloDoPostNoLinkedin(li), capa: !saiu && li && li.forma !== "texto" ? li.caminhos[0] : null, soVideo: false };
+    // A CAPA É A IMAGEM, ou a primeira foto do carrossel (a parte 3a); o só texto não tem. O VÍDEO (a parte 3b) fica sem
+    // capa e com o ícone dele, como o reels do Instagram: o `.mp4` como capa seria uma imagem quebrada.
+    const video = li?.forma === "video";
+    return {
+      rotulo: rotuloDoPostNoLinkedin(li),
+      capa: !saiu && li && li.forma !== "texto" && !video ? li.caminhos[0] : null,
+      soVideo: !saiu && video && (li?.caminhos.length ?? 0) > 0,
+    };
   }
   // O INSTAGRAM, como a célula decidia antes (app/publicar/page.tsx): a capa é a primeira imagem, e o post só de
   // vídeo fica sem capa e desenha o ícone dele.
@@ -107,8 +113,11 @@ export function paginaDoPost(
       texto: li?.texto.trim() ? li.texto : null,
       semTexto: "Sem texto.",
       caminhos: li?.caminhos ?? [],
-      ehVideo: () => false,
-      // O SÓ TEXTO NÃO TEM MÍDIA, e a frase sobre a mídia apagada mentiria. A imagem e o carrossel (a parte 3a) têm.
+      // O VÍDEO É VÍDEO NA PRÉVIA (a parte 3b): o post de vídeo leva um arquivo só, o `.mp4`. A imagem e o carrossel
+      // nunca são vídeo.
+      ehVideo: () => li?.forma === "video",
+      // O SÓ TEXTO NÃO TEM MÍDIA, e a frase sobre a mídia apagada mentiria. A imagem, o carrossel (a parte 3a) e o vídeo
+      // (a parte 3b) têm.
       sobreAMidia: li && li.forma !== "texto" ? fraseSobreAMidia(quando, item.error) : null,
       mediaIdNoInstagram: null,
       linkNoLinkedin: quando.saiu ? linkParaVerNoLinkedin(li?.postUrn) : null,
```

- [ ] **Passo 4: rodar e ver passar**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-video"; cd "$C" || exit 1
npx --no-install vitest run tests/post-da-fila.test.ts 2>&1 | tee ../pl3b-f7-green-puros.log
docker ps --format '{{.Names}} {{.Status}}' | grep metodochat-banco-de-teste   # healthy; senão, docker start e espere healthy
DATABASE_URL_TESTES=postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes npx --no-install vitest run --config vitest.integracao.config.ts testes-integracao/linkedin-telas.integracao.ts 2>&1 | tee ../pl3b-f7-green-integ.log
npx --no-install vitest run 2>&1 | tee ../pl3b-f7-suite.log
npx --no-install tsc --noEmit
npx --no-install eslint lib/post-da-fila.ts testes-integracao/linkedin-telas.integracao.ts tests/post-da-fila.test.ts
git diff --name-only a5cd8d4 -- lib/queue-drain.ts lib/fila-tipos.ts migrations scripts package.json package-lock.json   # vazio
```

Esperado: Nos puros, "Test Files 1 passed (1)" e "Tests 18 passed (18)". Na integração, `ALVO: banco de TESTE`, nenhum `teste_tmp` antes e depois, "Test Files 1 passed (1)" e "Tests 22 passed (22)". A suíte pura inteira: "Test Files 162 passed (162)" e "Tests 3880 passed (3880)". O `tsc` e o lint sem saída, e a guarda vazia.

- [ ] **Passo 5: o commit**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-video"; cd "$C" || exit 1
node ../varrer-texto.mjs lib/post-da-fila.ts testes-integracao/linkedin-telas.integracao.ts tests/post-da-fila.test.ts && test "$(git branch --show-current)" = linkedin-video && git add lib/post-da-fila.ts testes-integracao/linkedin-telas.integracao.ts tests/post-da-fila.test.ts && git commit -m "Nas Publicações, o vídeo do LinkedIn aparece sem capa e com o ícone dele enquanto não sai, e a página do post o mostra como vídeo, com a frase sobre a mídia"
git show HEAD | git patch-id --stable | cut -c1-12   # 91621a82d970
```

O patch-id tem de começar por `91621a82d970` (o mesmo do ensaio). Se não começar, pare.

---

### FASE 7-bis — Só teste: a décima consulta do vídeo ainda espera

**Arquivos:** `testes-integracao/linkedin-video.integracao.ts`.

Esta fase é só de teste: o código já está certo desde a FASE 4. O caso passa já. O RED dele é a mutação F4-8b do Apêndice A, que o teste de antes deixava viva (a lacuna achada nas mutações do ensaio).

- [ ] **Passo 1: o teste**

Em `testes-integracao/linkedin-video.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/linkedin-video.integracao.ts b/testes-integracao/linkedin-video.integracao.ts
index dca7f3a..49a5ae7 100644
--- a/testes-integracao/linkedin-video.integracao.ts
+++ b/testes-integracao/linkedin-video.integracao.ts
@@ -545,9 +545,16 @@ describe("o fim e o post do vídeo", () => {
     expect(l.payload.video_finalizado).toBeUndefined();
   });
 
-  it("na décima primeira consulta, a linha encerra com o motivo do vídeo", async () => {
+  it("a décima consulta ainda espera, e na décima primeira a linha encerra com o motivo do vídeo", async () => {
     const id = await comTodasAsPartes();
     expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("aguardando"); // o fim
+    // A DÉCIMA CONSULTA AINDA ESPERA: o teto do vídeo é 10, e não os 5 do documento (a lacuna achada nas mutações).
+    await q(`update queue set not_before = now(), payload = payload || '{"consultas_da_midia": 9}'::jsonb where id = $1`, [id]);
+    linkedin.respostaDoPost = { status: 400, corpo: '{"code":"MEDIA_ASSET_WAITING_UPLOAD"}' };
+    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("aguardando");
+    const decima = await linha(id);
+    expect(decima).toMatchObject({ status: "pending", error: fila.MOTIVO_VIDEO_PROCESSANDO });
+    expect(decima.payload).toMatchObject({ consultas_da_midia: 10 });
     await q(`update queue set not_before = now(), payload = payload || '{"consultas_da_midia": 10}'::jsonb where id = $1`, [id]);
     linkedin.respostaDoPost = { status: 400, corpo: '{"code":"MEDIA_ASSET_WAITING_UPLOAD"}' };
     expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("falhou");
```

- [ ] **Passo 2: rodar e ver passar**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-video"; cd "$C" || exit 1
docker ps --format '{{.Names}} {{.Status}}' | grep metodochat-banco-de-teste   # healthy; senão, docker start e espere healthy
DATABASE_URL_TESTES=postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes npx --no-install vitest run --config vitest.integracao.config.ts testes-integracao/linkedin-video.integracao.ts 2>&1 | tee ../pl3b-f7bis-green-integ.log
npx --no-install vitest run 2>&1 | tee ../pl3b-f7bis-suite.log
npx --no-install tsc --noEmit
npx --no-install eslint testes-integracao/linkedin-video.integracao.ts
git diff --name-only a5cd8d4 -- lib/queue-drain.ts lib/fila-tipos.ts migrations scripts package.json package-lock.json   # vazio
```

Esperado: Na integração, `ALVO: banco de TESTE`, nenhum `teste_tmp` antes e depois, "Test Files 1 passed (1)" e "Tests 23 passed (23)". A suíte pura inteira: "Test Files 162 passed (162)" e "Tests 3880 passed (3880)". O `tsc` e o lint sem saída, e a guarda vazia.

- [ ] **Passo 3: o commit**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-video"; cd "$C" || exit 1
node ../varrer-texto.mjs testes-integracao/linkedin-video.integracao.ts && test "$(git branch --show-current)" = linkedin-video && git add testes-integracao/linkedin-video.integracao.ts && git commit -m "O teste das consultas do vídeo confere que a décima ainda espera, e não só que a décima primeira encerra"
git show HEAD | git patch-id --stable | cut -c1-12   # e69221ff369c
```

O patch-id tem de começar por `e69221ff369c` (o mesmo do ensaio). Se não começar, pare.

---

### FASE 7-ter — Só teste: o 200 da faixa é recusado pelo status, com o arquivo inteiro ou com o Content-Range do pedido

**Arquivos:** `tests/bucket-video.test.ts`.

Esta fase é só de teste: o código já está certo desde a FASE 3. O caso passa já. O RED dele é a mutação F3-3 do Apêndice A, que o teste de antes deixava viva (a lacuna achada nas mutações do ensaio).

- [ ] **Passo 1: o teste**

Em `tests/bucket-video.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bucket-video.test.ts b/tests/bucket-video.test.ts
index 6053159..f0e611b 100644
--- a/tests/bucket-video.test.ts
+++ b/tests/bucket-video.test.ts
@@ -73,9 +73,12 @@ describe("a faixa de uma parte do vídeo (o 236)", () => {
     expect(tetos).toEqual([10_000]);
   });
 
-  it("o 200 com o arquivo inteiro é erro: a faixa não foi respeitada", async () => {
+  it("o 200 é erro, com o arquivo inteiro ou com o Content-Range do pedido: a faixa não foi respeitada", async () => {
     gravar(() => new Response(new Uint8Array(20), { status: 200 }));
-    await expect(faixaDoObjeto(CAMINHO, 4, 7, 10_000)).rejects.toThrow(/faixa/);
+    await expect(faixaDoObjeto(CAMINHO, 4, 7, 10_000)).rejects.toThrow(/HTTP 200/);
+    // O 200 COM O CONTENT-RANGE DO PEDIDO E O CORPO DO TAMANHO CERTO: só a trava do status o recusa.
+    gravar(() => new Response(new Uint8Array(4), { status: 200, headers: { "content-range": "bytes 4-7/20" } }));
+    await expect(faixaDoObjeto(CAMINHO, 4, 7, 10_000)).rejects.toThrow(/HTTP 200/);
   });
 
   it("o Content-Range diferente do pedido, ou ausente, é erro", async () => {
```

- [ ] **Passo 2: rodar e ver passar**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-video"; cd "$C" || exit 1
npx --no-install vitest run tests/bucket-video.test.ts 2>&1 | tee ../pl3b-f7ter-green-puros.log
npx --no-install vitest run 2>&1 | tee ../pl3b-f7ter-suite.log
npx --no-install tsc --noEmit
npx --no-install eslint tests/bucket-video.test.ts
git diff --name-only a5cd8d4 -- lib/queue-drain.ts lib/fila-tipos.ts migrations scripts package.json package-lock.json   # vazio
```

Esperado: Nos puros, "Test Files 1 passed (1)" e "Tests 9 passed (9)". A suíte pura inteira: "Test Files 162 passed (162)" e "Tests 3880 passed (3880)". O `tsc` e o lint sem saída, e a guarda vazia.

- [ ] **Passo 3: o commit**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-video"; cd "$C" || exit 1
node ../varrer-texto.mjs tests/bucket-video.test.ts && test "$(git branch --show-current)" = linkedin-video && git add tests/bucket-video.test.ts && git commit -m "O teste da faixa confere que o 200 é recusado pelo status, com o arquivo inteiro ou com o Content-Range do pedido"
git show HEAD | git patch-id --stable | cut -c1-12   # e894b13801dd
```

O patch-id tem de começar por `e894b13801dd` (o mesmo do ensaio). Se não começar, pare.

---

### FASE 7-quater — Só teste: no agora das duas redes, a linha do vídeo fica intocada de verdade (232)

**Arquivos:** `testes-integracao/linkedin-duas-redes.integracao.ts`.

Esta fase é só de teste: o código já está certo desde a FASE 5. O caso passa já. O RED dele é a mutação F5-5 do Apêndice A, que o teste de antes deixava viva (a lacuna achada nas mutações do ensaio).

- [ ] **Passo 1: o teste**

Em `testes-integracao/linkedin-duas-redes.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/linkedin-duas-redes.integracao.ts b/testes-integracao/linkedin-duas-redes.integracao.ts
index a430645..8af8eb0 100644
--- a/testes-integracao/linkedin-duas-redes.integracao.ts
+++ b/testes-integracao/linkedin-duas-redes.integracao.ts
@@ -853,6 +853,11 @@ describe("o vídeo nas duas redes (a parte 3b)", () => {
     const [li] = await daRede("publicacao_linkedin");
     expect(li.status).toBe("pending");
     expect(li.payload.video_urn).toBeUndefined();
+    // INTOCADO DE VERDADE: o ramo do vídeo não rodou, nem uma etapa que falhasse antes de chamar o LinkedIn (nenhuma
+    // marca da primeira passada, nenhuma passada contada, nenhum erro).
+    expect(li.error).toBeNull();
+    expect(li.payload.primeira_passada_em).toBeUndefined();
+    expect(li.payload.passadas_do_video).toBeUndefined();
     expect(linkedin.pedidos).toEqual([]);
     expect(meta.containers).toBeGreaterThanOrEqual(1);
   });
```

- [ ] **Passo 2: rodar e ver passar**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-video"; cd "$C" || exit 1
docker ps --format '{{.Names}} {{.Status}}' | grep metodochat-banco-de-teste   # healthy; senão, docker start e espere healthy
DATABASE_URL_TESTES=postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes npx --no-install vitest run --config vitest.integracao.config.ts testes-integracao/linkedin-duas-redes.integracao.ts 2>&1 | tee ../pl3b-f7quater-green-integ.log
npx --no-install vitest run 2>&1 | tee ../pl3b-f7quater-suite.log
npx --no-install tsc --noEmit
npx --no-install eslint testes-integracao/linkedin-duas-redes.integracao.ts
git diff --name-only a5cd8d4 -- lib/queue-drain.ts lib/fila-tipos.ts migrations scripts package.json package-lock.json   # vazio
```

Esperado: Na integração, `ALVO: banco de TESTE`, nenhum `teste_tmp` antes e depois, "Test Files 1 passed (1)" e "Tests 40 passed (40)". A suíte pura inteira: "Test Files 162 passed (162)" e "Tests 3880 passed (3880)". O `tsc` e o lint sem saída, e a guarda vazia.

- [ ] **Passo 3: o commit**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-video"; cd "$C" || exit 1
node ../varrer-texto.mjs testes-integracao/linkedin-duas-redes.integracao.ts && test "$(git branch --show-current)" = linkedin-video && git add testes-integracao/linkedin-duas-redes.integracao.ts && git commit -m "O teste do agora das duas redes confere que a linha do vídeo fica intocada de verdade, sem nenhuma etapa começada no clique"
git show HEAD | git patch-id --stable | cut -c1-12   # ad446f7bf641
```

O patch-id tem de começar por `ad446f7bf641` (o mesmo do ensaio). Se não começar, pare.

---

### FASE 8 — A verificação inteira, as mutações e a guarda do diff

- [ ] **Passo 1: o verify**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-video"; cd "$C" || exit 1
env -u CLAUDECODE -u AI_AGENT npm run verify 2>&1 | tee ../pl3b-verify.log; echo "saída ${PIPESTATUS[0]}"; git diff --stat AGENTS.md
```

Esperado: saída 0; nos puros, "Test Files 162 passed (162)" e "Tests 3880 passed (3880)"; na tela, "Test Files 36 passed (36)" e "Tests 350 passed (350)"; "SEM VAZAMENTO"; "MIGRAÇÃO PULADA — este não é um deploy de produção."; o build do Next 16.4.3 ("Compiled successfully"); e o `git diff --stat AGENTS.md` vazio. Se cair o 218 ou o 227, siga o procedimento das restrições.

- [ ] **Passo 2: a integração inteira, uma rodada só**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-video"; cd "$C" || exit 1
docker ps --format '{{.Names}} {{.Status}}' | grep metodochat-banco-de-teste   # healthy; senão, docker start e espere healthy
DATABASE_URL_TESTES=postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes npm run test:integracao 2>&1 | tee ../pl3b-integracao.log
```

Esperado: `ALVO: banco de TESTE`; "nenhum schema teste_tmp_* no banco" antes e depois; "Test Files 80 passed (80)" e "Tests 1018 passed | 8 skipped (1026)" (na base, 79 arquivos, 982 passaram e 8 pularam). Se cair o 248, siga o procedimento das restrições.

- [ ] **Passo 3: o roteiro das mutações, gravado a partir do Apêndice A, fora da cópia**

O roteiro é o último bloco deste plano. O comando abaixo o tira do plano commitado e o grava em `../mutar-li3b.mjs`. Se o arquivo já existir ali, ele só compara e para se for diferente.

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-video"; cd "$C" || exit 1
node -e '
const fs = require("fs");
const plano = fs.readFileSync("docs/plans/2026-11-16-linkedin-video.md", "utf8").replace(/\r\n/g, "\n");
const cerca = String.fromCharCode(96).repeat(3);
const inicio = plano.lastIndexOf(cerca + "js\n") + cerca.length + 3;
const bloco = plano.slice(inicio, plano.indexOf("\n" + cerca, inicio) + 1);
const destino = "../mutar-li3b.mjs";
if (fs.existsSync(destino)) {
  const igual = fs.readFileSync(destino, "utf8") === bloco;
  console.log(igual ? "o roteiro de fora é igual ao Apêndice A" : "DIFERENTE do Apêndice A: pare");
  process.exit(igual ? 0 : 1);
}
fs.writeFileSync(destino, bloco);
console.log("gravado a partir do Apêndice A");
'
sha256sum ../mutar-li3b.mjs   # c769fa1109b06af1fa527881638672e42d0706e59c4ab7dc63cc1014dc7ed8c2
```

- [ ] **Passo 4: as mutações (Apêndice A)**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-video"; cd "$C" || exit 1
docker ps --format '{{.Names}} {{.Status}}' | grep metodochat-banco-de-teste   # healthy; senão, docker start e espere healthy
env -u DATABASE_URL node ../mutar-li3b.mjs --conferir 2>&1 | tee ../pl3b-mutar-conferir.log    # "65 mutações, 0 ruins; árvore no fim: limpa (só a conferência dos trechos)"
env -u DATABASE_URL node ../mutar-li3b.mjs 2>&1 | tee ../pl3b-mutar.log
```

Esperado: as 65 como "MORTA" (65 na medida), e "65 mutações, 0 ruins; árvore no fim: limpa; 4 min 50 s" (a conferência: "65 mutações, 0 ruins; árvore no fim: limpa (só a conferência dos trechos)"). Se a rodada parar antes da última linha, rode `git status` e `git diff` antes de qualquer outra coisa: o arquivo da mutação em curso pode ter ficado mutado, e só ele se restaura.

- [ ] **Passo 5: a guarda do diff**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-video"; cd "$C" || exit 1
git diff --stat a5cd8d4 HEAD -- . ':!docs'
git diff --name-only a5cd8d4 HEAD -- lib/queue-drain.ts lib/fila-tipos.ts migrations scripts package.json package-lock.json   # vazio
git diff --name-only a5cd8d4 HEAD -- docs                                                                                   # só este plano
```

Esperado: no primeiro, os 25 arquivos do mapa, e mais nenhum: "25 files changed, 2375 insertions(+), 90 deletions(-)". O segundo, vazio: o `lib/queue-drain.ts`, o `lib/fila-tipos.ts`, as migrações, os scripts e os `package*` não mudam. No terceiro, só este plano. O patch-id de cada fase (`git show <commit> | git patch-id --stable`) tem de bater com o do ensaio.

---

### FASE 9 — O push, a prova no preview, o PR, o deploy, a primeira hora e o teste na produção

Esta entrega publica de verdade nas duas redes. A prova é no preview, que usa o banco de produção.

**A linha do vídeo no preview é uma linha da produção**, porque o banco é o mesmo. O código no ar (a `a5cd8d4`) não conhece a forma `"video"`: o predicado da 3-0 deixa essa linha `pending` e intocada em todos os drenos da produção (o tique, o webhook, o cron e os cliques). Nada da produção drena essa linha até o merge desta entrega. No preview, quem a drena é o "agora" do LinkedIn e o "Remarcar" do próprio preview (o 216). O preview não tem QStash: **cada etapa do vídeo pede um Remarcar.**

**Por isso nenhuma linha da prova chega ao merge `pending` nem em `sending` (o 228).** Com o merge, a produção passa a conhecer o vídeo e publicaria sozinha uma linha que tivesse ficado na fila, com o arquivo que ficou no bucket.
- A linha `pending` se cancela pelo PREVIEW, que apaga o arquivo dela: o cancelar da produção não lê o payload do vídeo e não apaga o arquivo.
- A linha em `sending` não sai pela tela: os botões da página do post só agem sobre `pending` (`app/publicar/post/actions.ts:96`), o resgate dos 3 minutos é só do dreno de lote (`lib/queue-drain.ts:1244`), e o dreno do clique não pega o post do LinkedIn (`:1278`). Ela tem um passo próprio: "A linha em `sending`", depois da tabela do Passo 5.

**Quem grava o quê.** O DEV não se conecta à produção, e a auditoria só lê. Na prova, gravam:
- o Eduardo, pela tela do preview: o publicar, o Remarcar e o Cancelar;
- o DEV, num passo próprio, só para a linha em `sending` e para o arquivo que ficar no bucket: o roteiro é escrito na hora, lido pela auditoria antes, e roda com a caixa do Eduardo, a hora mandada à auditoria e o "pode" dela, como a sonda da cópia de 16/11.

- [ ] **Passo 1: a conferência antes do push.** Repetida, igual, antes do PR (Passo 7) e antes da caixa do merge (Passo 8).

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-video"; cd "$C" || exit 1
git fetch origin
test "$(git rev-parse --short origin/main)" = a5cd8d4 && echo "origin/main em a5cd8d4"
test "$(git branch --show-current)" = linkedin-video && echo "na branch certa"
git log --oneline a5cd8d4..HEAD                            # 13 commits: o plano e as 12 fases
git log --format='%an <%ae>' a5cd8d4..HEAD | sort -u       # só Eduardo Kobal <162614913+Eduardokobal@users.noreply.github.com>
git log --format=%B a5cd8d4..HEAD | grep -ci "co-authored" # 0
git status --porcelain                                     # vazio
```

Se qualquer linha divergir, pare.

- [ ] **Passo 2: o push da branch, com o OK do Eduardo pela caixa e a hora à auditoria**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-video"; cd "$C" || exit 1
test -z "$(git ls-remote origin refs/heads/linkedin-video)" || { echo "a branch já existe no remoto: pare"; exit 1; }
test "$(git branch --show-current)" = linkedin-video && git push -u origin refs/heads/linkedin-video:refs/heads/linkedin-video
```

No log do build do preview, lido em janelas com `since`/`until`, confira:
- o commit;
- nenhum aviso do Node 26;
- "Detected Next.js version: 16.4.3";
- "MIGRAÇÃO PULADA".

**O endereço do preview (o 251):** o endereço exato do deployment deste commit (o `….vercel.app` do deployment, e não o da branch) é conferido pelo DEV e pela auditoria e mandado ao Eduardo. É nele, e só nele, que a prova clica.

- [ ] **Passo 3: os vídeos da prova, gerados na pasta de trabalho do DEV, fora da cópia**

Um MP4 comum (H.264 e AAC, 1080×1920, 30 quadros por segundo, 12 s, com o `moov` no começo), de 6 a 7 MiB, para o LinkedIn devolver duas partes. Ele é feito pelo `ffmpeg`, com ruído, para o tamanho não depender da compressão de uma imagem parada. Ele não entra no git.

```bash
cd "$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad" || exit 1
ffmpeg -hide_banner -loglevel error -y -f lavfi -i "testsrc2=size=1080x1920:rate=30,noise=alls=40:allf=t+u" -f lavfi -i "sine=frequency=440:sample_rate=48000" -t 12 -c:v libx264 -profile:v high -pix_fmt yuv420p -b:v 4500k -maxrate 4500k -bufsize 9000k -c:a aac -b:a 128k -movflags +faststart video-prova-3b.mp4
ls -l video-prova-3b.mp4; sha256sum video-prova-3b.mp4
AREA="$(powershell.exe -NoProfile -Command "[Environment]::GetFolderPath('Desktop')" | tr -d '\r')"
cp video-prova-3b.mp4 "$AREA/video-prova-3b.mp4" && sha256sum "$AREA/video-prova-3b.mp4"   # o mesmo sha
```

Se o tamanho não ficar entre 6 e 7 MiB, ajuste só o `-b:v` e diga à auditoria o valor usado. O sha256 e o tamanho vão à auditoria antes do primeiro passo. A cópia fica na Área de Trabalho do Eduardo, que é de onde ele escolhe o arquivo na tela (o 259).

- [ ] **Passo 4: as regras da prova, e o roteiro lido pela auditoria antes de qualquer passo.**
  - **Uma caixa para a prova inteira** antes do 1º passo, e o "pode" da auditoria, com a hora, em cada passo que grava. A caixa diz também que o clique das duas redes e o Remarcar da linha do Instagram rodam o dreno do clique (`drainQueue({ doClique: true })`), que manda as mensagens vencidas da produção pelo código do preview. É o 211, que já existia (o 258).
  - **Quem clica é o Eduardo**, logado como administrador no endereço do preview conferido no Passo 2.
  - **A conta (o 251):** no domínio do preview não há o cookie da conta escolhida. Sem ele, vale a primeira conta do login (`lib/acesso-escolha.ts:14`), e a produção tem conta de cliente. Antes do 1º clique, o Eduardo confere na tela o @ da conta das provas e troca de conta, se for outra. O LinkedIn é o pessoal, conectado na produção desde 16/11, às 14:02:09Z.
  - **O relógio (o 252), antes do 1º clique e de novo antes de cada Remarcar:**
    - o Eduardo aperta "Sincronizar agora" no Windows (Configurações > Hora e idioma > Data e hora);
    - a auditoria mede o relógio do computador contra o `now()` do banco e só dá o "pode" com a diferença menor que 5 s.
  - **Só "agora".** O "Agendar" é proibido na prova: uma linha agendada ficaria `pending` e intocada até o merge.
  - **Nenhum outro preview** é aberto ou clicado durante a prova.
  - **O "Remarcar"**, na página do post no preview, vai com **exatamente o minuto que o relógio mostra**. Nunca o minuto seguinte. Ele passa por cima da espera da linha e drena na hora, uma etapa por vez. O Remarcar aceita até 60 s para trás (`lib/publicacao.ts:1379`): um minuto que já virou é recusado.
  - **Cada Remarcar tira a `primeira_passada_em` (o 245)**, e a passada seguinte grava outra. A marca nova em cada leitura é o esperado, e não divergência (o 256).
  - **Depois de um "processando"** (o LinkedIn ainda processa o vídeo), espere os 60 s antes de Remarcar: o Remarcar gasta uma das 10 consultas da mídia.
  - **O clique "agora" só no LinkedIn pode levar ~22 s**: ele faz a reserva, cujo pior caso é o bucket e o LinkedIn, 10 s cada, mais a folga (o 258).
  - **As leituras da prova são só da auditoria, só lendo, com a ferramenta dela:** a `ler-prova-3b.mjs` (sha256 `61e4109aa2d2fb2d`, em três transações só de leitura, desde a hora do começo da prova). Ela lê antes da prova, logo depois de cada clique e de cada Remarcar, e no fim. Cada leitura começa por "conexões do LinkedIn: 1" (o 263: o "conta das provas" só identifica a conta se houver uma conexão só) e tem três partes:
    - (1) as linhas de post criadas desde a hora, cada uma com "conta das provas: sim" (o 251), a classe do erro e o estado do envio do vídeo;
    - (2) os vídeos do LinkedIn abertos (`pending` ou `sending`) no banco inteiro, e as linhas de post abertas criadas desde a hora (o 250);
    - (3) o 239 linha a linha: os caminhos de CADA linha da prova cruzados com a `storage.objects`, dentro do banco, por status. As linhas `sent` e `skipped` têm de dar 0 no bucket; as `failed` podem ter (o 261).
    - De cada linha da prova: o `kind`, o `account_id` (conferido contra o da conta das provas, o 251), o `status`, o `attempts`, o `error`, a forma, se há `video_urn`, o número de partes, o número de `ETags` não vazios, o `video_finalizado`, o `fim_tentado_em`, as `passadas_do_video`, a `primeira_passada_em`, as `consultas_da_midia`, se há `post_urn` e `post_tentado_em`, e as horas (`created_at`, `claimed_at`, `not_before` e `sent_at`).
    - Nenhum texto do post, nenhum caminho, nenhum endereço de envio e nenhum token.
  - **A vazão** de cada etapa é lida logo depois do clique ou do Remarcar que a fez: o `sent_at − claimed_at` mede só a passada do post; nas outras, a auditoria lê o `claimed_at` e a hora em que a linha voltou.

- [ ] **Passo 5: os passos da prova.**
  1. **O vídeo só no LinkedIn, "agora".**
     - Na tela de publicar, o Eduardo escolhe: a forma "Reels"; o arquivo `video-prova-3b.mp4` da Área de Trabalho; só a caixinha do LinkedIn marcada; o quando "Agora"; e o texto "Teste do vídeo no LinkedIn: um clipe curto de doze segundos, enviado em partes pelo painel." São 91 caracteres, sem hashtag nem arroba: cabe no LinkedIn (de 1 a 3 000, `lib/linkedin-publicacao.ts:126` e `:161-162`) e vira o título inteiro (até 100, `:521`) (o 259).
     - A tela mostra a nota do vídeo ("No LinkedIn, o vídeo vai em partes e sai alguns minutos depois do clique: só MP4.") e o botão "Publicar no LinkedIn".
     - O aviso esperado: "O vídeo do LinkedIn está na fila e sobe em partes; ele sai em alguns minutos. Acompanhe em Publicações."
     - Na base: `pending`, com o `video_urn`, as partes que o LinkedIn devolveu (o número entra no relatório), nenhum `ETag`, 1 passada e a `primeira_passada_em`.
     - **Este passo mede o domínio do endereço de envio.** Se o LinkedIn devolver um endereço de parte que não é https de um domínio dele, a reserva recusa e a linha vai a `failed` antes de qualquer parte. A prova para.
     - Depois, um Remarcar por etapa, cada um com o relógio conferido e a leitura da auditoria: cada parte (um `ETag` a mais por vez), o fim (`video_finalizado`) e o post (`sent`, com o `post_urn`). Se o post voltar "processando", espere 60 s e Remarque de novo.
  2. **O vídeo nas duas redes, "agora".**
     - Na tela: a forma "Reels"; o mesmo arquivo; as duas caixinhas marcadas; "Agora"; e o texto "Teste do vídeo nas duas redes: o mesmo clipe no Instagram e no LinkedIn, pela fila do painel." São 93 caracteres, sem hashtag nem arroba: cabe na legenda do Instagram (até 2 200, com até 30 hashtags e 20 menções, `lib/publicacao.ts:62-64`) e no LinkedIn, e vira o título inteiro (o 259).
     - O aviso esperado: "Instagram: …" com o aviso do Instagram de hoje, e "LinkedIn: O vídeo do LinkedIn está na fila e sobe em partes; ele sai em alguns minutos. Acompanhe em Publicações."
     - Na base: a linha do LinkedIn `pending` e intocada (sem `video_urn`, sem passada, sem `error`: o 232), com o caminho de uma cópia (a auditoria confere que o caminho é diferente do da linha do Instagram, sem dizer qual é). A do Instagram sai no clique, ou fica `pending` e vencida, aguardando a Meta processar o reels. Nesse caso, depois de 60 s, ela sai pelo Remarcar da linha do Instagram no minuto corrente, no preview, com o "pode" da auditoria.
     - Depois, o Remarcar do LinkedIn, uma etapa por vez: a reserva, cada parte, o fim e o post.
  3. **Antes de apagar**, o Eduardo abre cada post no LinkedIn (o vídeo toca, inteiro, com o som) e as Publicações do preview ("LinkedIn · Vídeo", com o ✓ depois de sair).
  4. **A leitura final da auditoria**, no banco inteiro, e não só pelos ids acompanhados (o 250):
     - a parte (2) da leitura dá 0 e 0: nenhuma linha `kind = 'publicacao_linkedin'` com `payload->>'forma' = 'video'` em `pending` ou `sending`, e nenhuma linha dos tipos de publicação (`TIPOS_DE_PUBLICACAO`) criada desde o começo da prova em `pending` ou `sending`;
     - cada linha da prova termina `sent`, `skipped` (cancelada pelo preview, com o arquivo já fora do bucket) ou `failed` com o motivo;
     - a parte (3), o 239 linha a linha, pela `storage.objects`, e nunca pelo endereço público: as linhas `sent` e `skipped` dão 0 no bucket, e os arquivos das `failed` ficaram. Eles vão ao passo "Os arquivos que ficam", e depois dele as `failed` também dão 0.
  5. **O Eduardo apaga os posts da prova**, pelo LinkedIn e pelo Instagram.

**Se divergir, por caso.** Em todos eles, a prova para, e a auditoria lê a linha antes de qualquer outro clique.

| O que acontece | A linha | O que fazer com a linha | O bucket | A caixa |
|---|---|---|---|---|
| A reserva recusa o endereço da parte (fora do LinkedIn) | `failed`, com o motivo da reserva | nada: `failed` não volta | o arquivo fica | seguir ou parar a entrega |
| Uma parte recusada (401 ou 403) | `failed`, com "o LinkedIn recusou o envio de uma parte do vídeo; publique de novo" | nada | o arquivo fica | o que fazer com o arquivo, e se a prova segue |
| A faixa do bucket que volta errada, ou a rede que cai numa parte | `pending` (passageiro), com o `attempts` contado | Remarcar de novo uma vez; se repetir, cancelar pelo preview | o cancelar apaga o arquivo | se a prova segue |
| O Remarcar recusado (a hora já passou) ou sem avanço | como estava | esperar o minuto virar e Remarcar com o minuto que o relógio mostra, com o relógio conferido de novo (o 252) | — | só se repetir |
| O fim recusado | `failed`, com o erro do LinkedIn | nada | o arquivo fica | se a prova segue |
| "Pode ter subido" (o fim perdido sem confirmação) | `failed`, com o motivo do "pode ter subido" | o Eduardo confere no LinkedIn se há um vídeo solto | o arquivo fica | apagar o arquivo |
| O LinkedIn não processa o vídeo (`PROCESSING_FAILED`) | `failed`, com "confira se ele é um MP4 comum" | nada | o arquivo fica | se a prova segue com outro vídeo |
| O post "processando" mais de 10 vezes | `failed`, com o motivo do vídeo que não ficou pronto | nada | o arquivo fica | se a prova segue |
| O Instagram fica aguardando a Meta | a linha do Instagram `pending`, vencida | depois de 60 s, o Remarcar da linha do Instagram no minuto corrente, no preview, com o "pode" da auditoria | — | só se o Remarcar não a publicar |
| O Instagram publicado e o LinkedIn falho | Instagram `sent`; LinkedIn `failed` | — | o arquivo do LinkedIn fica | apagar o post do Instagram ou deixar |
| Qualquer linha da prova em `sending` | `sending` | o passo "A linha em `sending`", abaixo | — | as duas saídas do passo |
| Qualquer outro `failed` (o 255) | `failed`, com o motivo | nada na linha | o arquivo fica | o que fazer, pela caixa |

**A linha em `sending` (o 249).** Ela não sai pela tela, e depois do merge a produção a retomaria (o 228). A auditoria lê a linha e espera 6 minutos desde o `claimed_at`, e não 3: o Remarcar pode viver até 300 s, e o desfecho dele grava pelo id sem conferir o status, então uma função travada ainda poderia devolver a linha (o 260). Depois, a caixa do Eduardo escolhe uma de duas saídas:
- **(a) Encerrar a linha.** Uma escrita única, rodada pelo DEV com o roteiro lido pela auditoria antes, a caixa, a hora e o "pode". Ela muda uma linha só, e só se ela ainda estiver presa:
  `update queue set status = 'failed', error = 'a linha da prova ficou presa em envio e foi encerrada à mão; publique de novo' where id = $1 and kind = 'publicacao_linkedin' and status = 'sending' and claimed_at < now() - interval '6 minutes' returning id`.
  O roteiro espera exatamente 1 linha no `returning`; com 0 ou mais de 1, ele para e diz o número. Se a linha tiver `post_tentado_em`, o Eduardo confere antes, no LinkedIn, se o post saiu. A auditoria lê a linha depois. O arquivo dela vai ao passo seguinte.
  A linha do Instagram presa em `sending` não entra neste passo: a produção conhece o tipo dela e a resgata sozinha no dreno de lote, depois de 3 minutos. Se ela for encerrada à mão mesmo assim, o Eduardo confere o Instagram antes, e não só o `post_tentado_em`.
- **(b) Não fazer o merge.** A branch fica no remoto sem PR mesclado, até a linha ser resolvida.

**Os arquivos que ficam (o 253).** O arquivo de uma linha `failed` fica no bucket, porque o arquivo só sai com o `sent`, e o de uma linha encerrada à mão também. Quem apaga é o DEV, com um roteiro escrito na hora, lido pela auditoria antes, com a caixa do Eduardo, a hora e o "pode", como a sonda da cópia de 16/11. Ele lê os caminhos no payload das linhas, na produção, só lendo, e tem uma trava: só os caminhos dos ids NOMEADOS na caixa, em `failed` ou encerrados à mão, dentro da pasta da conta das provas, e nunca um caminho que ainda esteja numa linha aberta (como o original do Instagram que espera a Meta). Depois, o `DELETE` de cada caminho pelo Storage, com a chave de serviço, que nunca é impressa (o 262). O prazo é antes da caixa do merge (Passo 8). A prova é a contagem na `storage.objects`, pela auditoria, e nunca pelo endereço público (o 239).

- [ ] **Passo 6: a base depois da prova**, lida pela auditoria, no banco inteiro (o 250): igual à de antes, fora as linhas da prova, e nenhuma delas `pending` nem `sending`.

- [ ] **Passo 7: o PR, com o OK do Eduardo pela caixa.**
  - Antes, a auditoria confere de novo, no banco inteiro, que nenhuma linha da prova está `pending` nem `sending`.
  - O corpo leva o que muda, os números deste plano, o que o ensaio achou, a prova e os limites conhecidos (com a mudança do redirecionamento em toda chamada ao LinkedIn), sem nenhuma arroba solta nem nome de pessoa ou de conta. Ele fica em `../corpo-pr-3b.md`, e a mensagem do merge, à parte, em `../merge-3b.txt`. A auditoria lê os dois antes de o PR abrir.
  - Depois da conferência do Passo 1, de novo:

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-video"; cd "$C" || exit 1
gh pr create --base main --head linkedin-video --title "O reels em MP4 sai também no LinkedIn, como vídeo em partes, só lá ou nas duas redes" --body-file ../corpo-pr-3b.md
```

  - **A caixa do PR diz que o merge espera a conferência da auditoria e uma caixa minha.**

- [ ] **Passo 8: a leitura de antes do merge e a caixa do merge.**
  - A auditoria lê a base na hora antes do merge, só lendo, e confere de novo, no banco inteiro, que nenhuma linha da prova está `pending` nem `sending` e que os arquivos que ficaram já saíram. Essa leitura é a base de comparação da primeira hora.
  - **O commit provado é o que vai ao merge (o 257).** Depois da conferência do Passo 1, de novo:

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-video"; cd "$C" || exit 1
git rev-parse HEAD                                                  # o commit provado no preview
git ls-remote origin refs/heads/linkedin-video | cut -f1            # o mesmo
gh pr view linkedin-video --json headRefOid --jq .headRefOid        # o mesmo
```

  - Se os três não forem o mesmo commit, pare. Se forem, vem a caixa do merge. O merge é do Eduardo. A caixa é de resultado: sem "(Recomendado)" e com "Não fiz / não lembro".

- [ ] **Passo 9: o deploy do merge.**
  - No log, lido em janelas com `since`/`until`, quatro coisas:
    - "Nada a aplicar: as 26 migrações já constam no registro.";
    - o `queue_kind_check` "existe e confere (025-fila-linkedin.sql)";
    - as outras conferências "CONFERIDO";
    - nenhum aviso do Node 26.
  - No site: o `/entrar` dá 200, e o cron sem senha dá 401.
  - **Se o deploy der erro (o 257):** nada novo vai à `main`, e o caso vai à caixa, com o log.

- [ ] **Passo 10: a primeira hora.** A janela vai do deploy pronto até uma hora depois. Nada aqui grava.
  - **Os erros e os registros da Vercel**, lidos pelo DEV e pela auditoria com o conector da Vercel, em pedaços, porque o Hobby só guarda uma hora:
    - `get_runtime_errors`: nenhum erro novo, e nenhuma função cortada por tempo nas rotas que drenam (`/api/queue/tick`, `/api/webhook` e `/api/cron/daily`) nem nas páginas das actions;
    - `get_runtime_logs` com o texto `[dreno]`: cada linha tem hora, contagem e tipos. Ela é a regra da 3a-0 agindo, e não um defeito.
  - **A base, só pela auditoria, só lendo**, com as cinco consultas da 3a-0, sobre `kind`, `status`, `attempts` e as horas, nunca `payload`, `contact_ig_id`, `error` nem texto: as presas em `sending`, as vencidas que não saíram, as tentativas, o volume e a espera por tipo, e os posts, contra a leitura de antes do merge. Ela confere também que nenhuma linha `publicacao_linkedin` ficou presa em `sending`.
  - **Quando divergir, pare.** São quatro casos:
    - uma linha presa em `sending` há mais de 3 minutos;
    - queda no volume ou espera maior que a das janelas de comparação;
    - um erro novo;
    - uma linha "[dreno]" cujos itens não saíram na passada seguinte.
    Em qualquer um deles, avise a auditoria com a leitura. O caminho de volta é o rollback da Vercel para o deploy da `a5cd8d4`: sem migração nesta entrega, ele é seguro, e só é feito com a caixa do Eduardo. **Antes de qualquer rollback, nenhuma linha de vídeo pode estar em `sending` (o 254):** o rollback a deixaria presa, porque o resgate da `a5cd8d4` exclui a forma que ela não conhece. Espere a linha terminar; se ela estiver `pending`, cancele-a pela produção nova antes. Uma linha de vídeo `pending` volta a ficar intocada com o rollback.

- [ ] **Passo 11: o teste na produção (a decisão de 16/11, "Sim, como hoje"), com a caixa do Eduardo e o "pode" da auditoria.** Depois da primeira hora fechada.
  - **O vídeo (o 254):** um MP4 de 30 s, entre 16 e 20 MiB, para o LinkedIn devolver cinco partes, gerado como o da prova. O sha256 e o tamanho vão à auditoria antes do clique, e a cópia vai à Área de Trabalho do Eduardo.

```bash
cd "$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad" || exit 1
ffmpeg -hide_banner -loglevel error -y -f lavfi -i "testsrc2=size=1080x1920:rate=30,noise=alls=40:allf=t+u" -f lavfi -i "sine=frequency=440:sample_rate=48000" -t 30 -c:v libx264 -profile:v high -pix_fmt yuv420p -b:v 5000k -maxrate 5000k -bufsize 10000k -c:a aac -b:a 128k -movflags +faststart video-producao-3b.mp4
ls -l video-producao-3b.mp4; sha256sum video-producao-3b.mp4
AREA="$(powershell.exe -NoProfile -Command "[Environment]::GetFolderPath('Desktop')" | tr -d '\r')"
cp video-producao-3b.mp4 "$AREA/video-producao-3b.mp4" && sha256sum "$AREA/video-producao-3b.mp4"   # o mesmo sha
```

  - Se o tamanho não ficar entre 16 e 20 MiB, ajuste só o `-b:v` e diga à auditoria o valor usado.
  - **Os cliques, na produção:** a forma "Reels"; o arquivo `video-producao-3b.mp4` da Área de Trabalho; as duas caixinhas marcadas; "Agora"; e o texto "Teste final do vídeo na produção: um clipe de trinta segundos nas duas redes, pela fila." São 88 caracteres, sem hashtag nem arroba, dentro dos limites das duas redes, e o título inteiro. O relógio e a conta são conferidos antes do clique, como na prova.
  - Ele sai sozinho pelos tiques, com a conexão que já existe. É o caminho que o preview não alcança.
  - A auditoria lê a linha a cada etapa, só lendo, e mede o tempo total, do clique ao `sent`.
  - Ela confere também, nas linhas "[dreno]" do mesmo período, que nenhuma mensagem voltou à fila por causa do vídeo.
  - **Se divergir:** a mesma tabela da prova vale, com duas diferenças. A linha é drenada pelos tiques da produção, e não por Remarcar; e uma linha em `sending` há mais de 3 minutos é resgatada pela própria produção. Um `failed` vai à caixa, e o arquivo dele vai ao passo "Os arquivos que ficam".
  - Antes de apagar, o Eduardo abre o post no LinkedIn e no Instagram. Depois, ele apaga os dois, e a auditoria confere o bucket pela `storage.objects`.

Com esta entrega em produção, a parte 3c (o LinkedIn no carrossel do gerador) começa pelo plano dela.

---

## Apêndice A — As mutações

O roteiro roda da raiz da cópia, com a árvore commitada e limpa, e com o `node_modules` da cópia. Ele recusa a `DATABASE_URL` no ambiente, o `.env.local` com variáveis, o ramo `main` e a árvore suja. Cada mutação troca um trecho que aparece uma vez só, roda o arquivo de teste que a cobre e confere que o caso nomeado cai, pelo nome inteiro. As de integração rodam contra o banco de TESTE, uma de cada vez, e só contam com "ALVO: banco de TESTE" na saída. No fim, a árvore volta limpa. São 65: 39 puras, 3 de tela e 23 de integração, das FASES 1 a 7, com as três que acharam as lacunas da 7-bis (a F4-8b), da 7-ter (a F3-3) e da 7-quater (a F5-5). A FASE 8, no Passo 3, grava este bloco em `../mutar-li3b.mjs`.

```js
// AS MUTAÇÕES DA 3b DO LINKEDIN (o vídeo em partes), no molde de mutar-li3a-v2.mjs: as de todas as fases do ensaio, a
// F1 (as regras puras), a F2 (o cliente do vídeo), a F3 (o bucket), a F4 e a F4-bis (o ramo do vídeo na fila), a F5 (as
// actions e a cópia), a F6 (a tela e o aviso), a F6-bis (o Remarcar, o 245) e a F7 (as Publicações). Cada uma desfaz
// UMA trava, trocando um trecho exato de um arquivo (que tem de aparecer uma vez só), roda só o arquivo de teste que a
// cobre e confere que o caso NOMEADO cai, pelo nome inteiro. As de integração rodam contra o banco de TESTE, uma de
// cada vez. A árvore tem de estar commitada e limpa antes, e volta limpa no fim. O vitest roda por `npx --no-install`
// (achado 208), e a cópia tem de ter o node_modules dela.
//
// Uso, da raiz da cópia: node ../mutar-li3b.mjs --conferir        (só confere que cada trecho aparece uma vez)
//                        node ../mutar-li3b.mjs --tipo=puro       (só as dos testes puros; também dom e integ)
//                        node ../mutar-li3b.mjs [prefixo-do-nome]
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const TESTES_URL = "postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes";
if (process.env.DATABASE_URL) throw new Error("RECUSADO: DATABASE_URL no ambiente");
if (existsSync(".env.local") && /^\s*[A-Z_]+\s*=/m.test(readFileSync(".env.local", "utf8"))) {
  throw new Error("RECUSADO: o .env.local desta cópia tem variáveis (a cópia do ensaio tem o .env.local vazio)");
}
if (!existsSync("node_modules/.bin/vitest")) throw new Error("RECUSADO: sem node_modules/.bin/vitest nesta cópia");
const ramo = execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim();
if (ramo === "main" || ramo === "") throw new Error(`RECUSADO: o ramo é "${ramo}"; as mutações só rodam numa cópia de ensaio`);
const status = () => execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim();
if (status() !== "") throw new Error("RECUSADO: árvore suja antes das mutações");

const PURO = { tipo: "puro", config: null };
const DOM = { tipo: "dom", config: "vitest.dom.config.ts" };
const INTEG = { tipo: "integ", config: "vitest.integracao.config.ts" };

const T_VREGRAS = { ...PURO, arquivo: "tests/linkedin-video-regras.test.ts" };
const T_POST = { ...PURO, arquivo: "tests/linkedin-post.test.ts" };
const T_FCONH = { ...PURO, arquivo: "tests/linkedin-forma-conhecida.test.ts" };
const T_REST = { ...PURO, arquivo: "tests/linkedin-rest.test.ts" };
const T_BUCKET = { ...PURO, arquivo: "tests/bucket-video.test.ts" };
const T_COPIA = { ...PURO, arquivo: "tests/linkedin-copia.test.ts" };
const T_REDES = { ...PURO, arquivo: "tests/redes-do-post.test.ts" };
const T_PFILA = { ...PURO, arquivo: "tests/post-da-fila.test.ts" };
const T_TELA = { ...DOM, arquivo: "testes-dom/publicar-compositor-linkedin.dom.tsx" };
const T_VIDEO = { ...INTEG, arquivo: "testes-integracao/linkedin-video.integracao.ts" };
const T_HORA = { ...INTEG, arquivo: "testes-integracao/dreno-hora-de-parar.integracao.ts" };
const T_COMPOR = { ...INTEG, arquivo: "testes-integracao/linkedin-compor.integracao.ts" };
const T_DUAS = { ...INTEG, arquivo: "testes-integracao/linkedin-duas-redes.integracao.ts" };
const T_TELAS = { ...INTEG, arquivo: "testes-integracao/linkedin-telas.integracao.ts" };

const PUB = "lib/linkedin-publicacao.ts";
const LI = "lib/linkedin.ts";
const BUCKET = "lib/bucket.ts";
const FILA = "lib/linkedin-fila.ts";
const COPIA = "lib/linkedin-copia.ts";
const ACOES = "app/publicar/actions.ts";
const ACOES_DO_POST = "app/publicar/post/actions.ts";
const TELA = "app/publicar/enviador.tsx";
const REDES = "lib/redes-do-post.ts";
const PFILA = "lib/post-da-fila.ts";

const MUTACOES = [
  // ---- F1: as regras puras (e o aviso da F6, que mora no mesmo arquivo) ----
  {
    nome: "F1-1: o rótulo do vídeo some",
    arq: PUB,
    de: 'if (forma === "video") return "Vídeo";',
    para: "",
    teste: T_VREGRAS,
    cai: "o rótulo nas Publicações é LinkedIn · Vídeo",
  },
  {
    nome: "F1-2: o vídeo leva mais de um arquivo",
    arq: PUB,
    de: 'if (forma === "imagem" || forma === "video") return quantos === 1;',
    para: 'if (forma === "imagem") return quantos === 1;',
    teste: T_VREGRAS,
    cai: "o pedido de vídeo leva um arquivo só, MP4 pela extensão do caminho; o MOV é recusado com a frase do MP4",
  },
  {
    nome: "F1-3: o pedido aceita o MOV",
    arq: PUB,
    de: 'if (p.forma === "video" && !p.caminhos.every((c) => c.toLowerCase().endsWith(".mp4"))) return "video_nao_mp4";',
    para: "",
    teste: T_VREGRAS,
    cai: "o pedido de vídeo leva um arquivo só, MP4 pela extensão do caminho; o MOV é recusado com a frase do MP4",
  },
  {
    nome: "F1-4: todo vídeo vai ao LinkedIn",
    arq: PUB,
    de: 'return mime === "video/mp4";',
    para: 'return mime.startsWith("video/");',
    teste: T_VREGRAS,
    cai: "o MP4 vai; o MOV do iPhone e o resto não",
  },
  {
    nome: "F1-5: a etapa pula o fim",
    arq: PUB,
    de: 'return e.finalizado ? "post" : "fim";',
    para: 'return "post";',
    teste: T_VREGRAS,
    cai: "a ordem é a reserva, cada parte, o fim e o post",
  },
  {
    nome: "F1-6: os ETags a mais contam",
    arq: PUB,
    de: "return e.reservado ? Math.min(e.etags, e.partes) : 0;",
    para: "return e.reservado ? e.etags : 0;",
    teste: T_VREGRAS,
    cai: "ETags a mais que as partes (um payload torto) não passam do número de partes",
  },
  {
    nome: "F1-7: o teto das passadas sem a reserva, o fim e o post",
    arq: PUB,
    de: "return partes + 3 + PASSADAS_DE_FOLGA_DO_VIDEO;",
    para: "return partes + PASSADAS_DE_FOLGA_DO_VIDEO;",
    teste: T_VREGRAS,
    cai: "o teto das passadas é o número de partes, mais a reserva, o fim e o post, mais 6 de folga",
  },
  {
    nome: "F1-8: o teto das passadas encerra ao chegar, e não ao passar",
    arq: PUB,
    de: 'if (p.passadas > tetoDePassadasDoVideo(p.partes)) return "passadas";',
    para: 'if (p.passadas >= tetoDePassadasDoVideo(p.partes)) return "passadas";',
    teste: T_VREGRAS,
    cai: "encerra só quando PASSA do teto das passadas",
  },
  {
    nome: "F1-9: a idade de 2 horas não encerra na hora exata",
    arq: PUB,
    de: "p.agoraMs - p.primeiraPassadaEmMs >= IDADE_MAXIMA_DO_VIDEO_MS",
    para: "p.agoraMs - p.primeiraPassadaEmMs > IDADE_MAXIMA_DO_VIDEO_MS",
    teste: T_VREGRAS,
    cai: "a idade: 2 horas desde a primeira passada encerram, mesmo com passadas sobrando",
  },
  {
    nome: "F1-10: o 401 e o 403 da parte viram a autorização",
    arq: PUB,
    de: 'if (status === 401 || status === 403) return "recusada";',
    para: "",
    teste: T_VREGRAS,
    cai: "o 401 e o 403 são a parte recusada, com texto próprio, e não a autorização da conexão",
  },
  {
    nome: "F1-11 (F6): o aviso do vídeo na fila diz em instantes",
    arq: PUB,
    de: 'if (d.forma === "video") return { tom: "ok", texto: AVISO_DO_VIDEO_NA_FILA };',
    para: "",
    teste: T_VREGRAS,
    cai: "na fila, o vídeo tem a frase própria; as outras formas, a de sempre",
  },
  {
    nome: "F1-12 (F2): o post do vídeo sem o vídeo",
    arq: PUB,
    de: "const comTitulo = p.documento ?? p.video;",
    para: "const comTitulo = p.documento;",
    teste: T_POST,
    cai: "o conteúdo leva o vídeo e o título",
  },
  {
    nome: "F1-13 (F4): o URN sozinho conta como reserva",
    arq: PUB,
    de: "const reservado = !!pub.videoUrn && pub.uploadToken !== null && pub.partes !== null;",
    para: "const reservado = !!pub.videoUrn;",
    teste: T_POST,
    cai: "as partes tortas, ou o URN sem token, não contam como reserva",
  },
  {
    nome: "F1-14 (F4): os ETags pulam o vazio (o 230)",
    arq: PUB,
    de: 'if (typeof e !== "string" || !e) break;',
    para: 'if (typeof e !== "string") continue;',
    teste: T_POST,
    cai: "os ETags contam em sequência e param no primeiro vazio ou que não é texto (o 230)",
  },
  {
    nome: "F1-15 (F4): o vídeo fora da lista das formas conhecidas",
    arq: PUB,
    de: 'export const FORMAS_NO_LINKEDIN: readonly FormaNoLinkedin[] = ["texto", "imagem", "carrossel", "video"];',
    para: 'export const FORMAS_NO_LINKEDIN: readonly FormaNoLinkedin[] = ["texto", "imagem", "carrossel"];',
    teste: T_FCONH,
    cai: "são as que o ramo do dreno publica hoje: só texto, imagem, o carrossel em PDF (a parte 3a) e o vídeo em partes (a parte 3b)",
  },

  // ---- F2: o cliente do vídeo (e o 243 da F4-bis) ----
  {
    nome: "F2-1: a chamada segue o redirecionamento (o 234)",
    arq: LI,
    de: 'redirect: "error", signal: AbortSignal.timeout(tetoMs)',
    para: "signal: AbortSignal.timeout(tetoMs)",
    teste: T_REST,
    cai: "a parte que recebe um 307 não vai ao endereço do redirecionamento",
  },
  {
    nome: "F2-2: as partes com buraco passam",
    arq: LI,
    de: "if (inicio !== esperado || fim < inicio) return null;",
    para: "if (fim < inicio) return null;",
    teste: T_REST,
    cai: "recusa as partes que não cobrem o arquivo inteiro, em ordem, sem buraco nem sobra",
  },
  {
    nome: "F2-3: as partes que não cobrem o arquivo passam",
    arq: LI,
    de: "return esperado === tamanho ? partes : null;",
    para: "return partes;",
    teste: T_REST,
    cai: "recusa as partes que não cobrem o arquivo inteiro, em ordem, sem buraco nem sobra",
  },
  {
    nome: "F2-4: a reserva aceita um endereço de envio que não é do LinkedIn",
    arq: LI,
    de: 'if (typeof uploadUrl !== "string" || !enderecoDeEnvioConfiavel(uploadUrl)) return null;',
    para: 'if (typeof uploadUrl !== "string") return null;',
    teste: T_REST,
    cai: "recusa a reserva sem o URN de vídeo, sem instruções, ou com um endereço que não é do LinkedIn",
  },
  {
    nome: "F2-5: a parte vai a um endereço que não é do LinkedIn",
    arq: LI,
    de: '  if (!enderecoDeEnvioConfiavel(uploadUrl)) {\n    throw new LinkedinError(STATUS_RECUSADO_PELO_PAINEL, "o endereço de envio do vídeo não é do LinkedIn");\n  }',
    para: "",
    teste: T_REST,
    cai: "o endereço que não é do LinkedIn não recebe a parte: o vídeo é do cliente",
  },
  {
    nome: "F2-6: a parte aceita sem o ETag",
    arq: LI,
    de: 'if (!r.etag) throw new LinkedinError(r.status, "o LinkedIn aceitou a parte do vídeo sem o ETag");',
    para: "",
    teste: T_REST,
    cai: "a parte aceita sem o ETag, ou com ele vazio, é um erro",
  },
  {
    nome: "F2-7: a parte com o teto do post",
    arq: LI,
    de: "body: bytes }, TETO_DO_ENVIO_DA_PARTE_MS);",
    para: "body: bytes }, TETO_DO_LINKEDIN_MS);",
    teste: T_REST,
    cai: "é um PUT SEM a autorização, com os bytes, o tipo binário e o teto de 15 s, e devolve o ETag",
  },
  {
    nome: "F2-8: o fim leva os ETags fora da ordem das partes",
    arq: LI,
    de: "uploadedPartIds: [...etags]",
    para: "uploadedPartIds: [...etags].reverse()",
    teste: T_REST,
    cai: "o fim leva o vídeo, o token do envio e os ETags na ordem das partes",
  },
  {
    nome: "F2-9 (243): a parte recusada leva a resposta do LinkedIn no erro",
    arq: LI,
    de: "throw new LinkedinError(r.status, `o LinkedIn recusou a parte do vídeo (${r.status})`);",
    para: "throw new LinkedinError(r.status, r.texto.slice(0, 300));",
    teste: T_REST,
    cai: "a parte recusada é um erro com o status, e o texto não leva a resposta do LinkedIn (o 236)",
  },
  {
    nome: "F2-10: o estado do vídeo com o URN cru no caminho",
    arq: LI,
    de: "/rest/videos/${encodeURIComponent(videoUrn)}",
    para: "/rest/videos/${videoUrn}",
    teste: T_REST,
    cai: "o estado do vídeo vem do GET com o URN codificado no caminho",
  },

  // ---- F3: o bucket (e a cópia da F5) ----
  {
    nome: "F3-1: o HEAD do tamanho com cache",
    arq: BUCKET,
    de: '{ method: "HEAD", cache: "no-store",',
    para: '{ method: "HEAD",',
    teste: T_BUCKET,
    cai: "vem do HEAD do endereço público, sem cache, com o teto pedido",
  },
  {
    nome: "F3-2: o tamanho sem o Content-Length",
    arq: BUCKET,
    de: 'if (!r.headers.get("content-length") || !Number.isSafeInteger(tamanho) || tamanho < 0) {',
    para: "if (false) {",
    teste: T_BUCKET,
    cai: "o arquivo que não está lá, ou a resposta sem o tamanho, é erro, e o erro não leva o endereço",
  },
  {
    nome: "F3-3: a faixa aceita o 200 com o arquivo inteiro",
    arq: BUCKET,
    de: "if (r.status !== 206) {",
    para: "if (r.status !== 206 && r.status !== 200) {",
    teste: T_BUCKET,
    cai: "o 200 é erro, com o arquivo inteiro ou com o Content-Range do pedido: a faixa não foi respeitada",
  },
  {
    nome: "F3-4: a faixa sem conferir o Content-Range",
    arq: BUCKET,
    de: "if (!intervalo || Number(intervalo[1]) !== inicio || Number(intervalo[2]) !== fim) {",
    para: "if (false) {",
    teste: T_BUCKET,
    cai: "o Content-Range diferente do pedido, ou ausente, é erro",
  },
  {
    nome: "F3-5: a faixa sem conferir o tamanho do corpo",
    arq: BUCKET,
    de: 'if (bytes.length !== fim - inicio + 1) throw new Error("o armazenamento devolveu a faixa do vídeo com outro tamanho");',
    para: "",
    teste: T_BUCKET,
    cai: "o corpo menor ou maior que a faixa é erro",
  },
  {
    nome: "F3-6: a cópia recusada passa calada",
    arq: BUCKET,
    de: 'if (!r.ok) throw await falha("Nao foi possivel copiar o objeto no bucket", r);',
    para: "",
    teste: T_BUCKET,
    cai: "a cópia recusada é erro com o status",
  },
  {
    nome: "F5-1: a cópia aceita o MOV",
    arq: COPIA,
    de: 'if (!origem.toLowerCase().endsWith(".mp4")) throw new Error("o vídeo do LinkedIn tem de ser MP4");',
    para: "",
    teste: T_COPIA,
    cai: "o MOV é recusado antes de qualquer chamada: o LinkedIn só aceita MP4",
  },
  {
    nome: "F5-2: a cópia aceita o vídeo de outra conta",
    arq: COPIA,
    de: 'if (conferidos.length !== 1 || conferidos[0] !== origem) throw new Error("o vídeo não é desta conta");',
    para: "",
    teste: T_COPIA,
    cai: "o vídeo de outra conta, ou com caminho torto, é recusado antes de qualquer chamada",
  },

  // ---- F6: as caixinhas e a tela ----
  {
    nome: "F6-1: o reels volta a não ir ao LinkedIn",
    arq: REDES,
    de: '    case "carrossel":\n    case "reels":\n      return null;',
    para: '    case "carrossel":\n      return null;\n    case "reels":\n      return "O LinkedIn recebe vídeo na próxima entrega.";',
    teste: T_REDES,
    cai: "o LinkedIn aceita o só texto, a imagem, o carrossel (em PDF, a parte 3a) e o reels (como vídeo, a parte 3b); o story nunca",
  },
  {
    nome: "F6-2: o MOV não desliga a caixinha",
    arq: REDES,
    de: '(p.forma === "reels" && p.videoQueNaoEMp4 ? TEXTO_DO_VIDEO_QUE_NAO_E_MP4 : null))',
    para: "null)",
    teste: T_REDES,
    cai: "o reels com um vídeo que não é MP4 desliga o LinkedIn, com a frase do MP4; sem a conexão, o motivo é o da conexão",
  },
  {
    nome: "F6-3: o aviso das duas redes sem a forma",
    arq: REDES,
    de: "        forma: d.linkedin.forma,\n",
    para: "",
    teste: T_REDES,
    cai: "no agora, o LinkedIn diz que o vídeo sobe em partes; agendado, a hora, como sempre",
  },
  {
    nome: "F6-4: a tela não vê o MOV",
    arq: TELA,
    de: "videoQueNaoEMp4: slides.some((s) => s.video && !oVideoVaiAoLinkedin(s.arquivo.type)),",
    para: "videoQueNaoEMp4: false,",
    teste: T_TELA,
    cai: "o MOV desliga e desmarca o LinkedIn, com a frase do MP4, e o Instagram segue marcado",
  },
  {
    nome: "F6-5: o reels vai ao LinkedIn como imagem",
    arq: TELA,
    de: 'formaDaTela === "reels" ? "video" : "imagem";',
    para: '"imagem";',
    teste: T_TELA,
    cai: "só no LinkedIn: o reels MP4 vai à action do LinkedIn com a forma vídeo, com a nota do vídeo",
  },
  {
    nome: "F6-6: a nota do vídeo some",
    arq: TELA,
    de: '{paraOLinkedin && formaNoLinkedin === "video" && <p className={hint}>{NOTA_DO_VIDEO_NO_LINKEDIN}</p>}',
    para: "{null}",
    teste: T_TELA,
    cai: "só no LinkedIn: o reels MP4 vai à action do LinkedIn com a forma vídeo, com a nota do vídeo",
  },

  // ---- F7: as Publicações ----
  {
    nome: "F7-1: o .mp4 vira a capa",
    arq: PFILA,
    de: 'li.forma !== "texto" && !video ? li.caminhos[0] : null',
    para: 'li.forma !== "texto" ? li.caminhos[0] : null',
    teste: T_PFILA,
    cai: "o vídeo do LinkedIn fica sem capa e com o ícone enquanto não saiu, como o reels do Instagram (a parte 3b)",
  },
  {
    nome: "F7-2: o vídeo sem o ícone",
    arq: PFILA,
    de: "soVideo: !saiu && video && (li?.caminhos.length ?? 0) > 0,",
    para: "soVideo: false,",
    teste: T_PFILA,
    cai: "o vídeo do LinkedIn fica sem capa e com o ícone enquanto não saiu, como o reels do Instagram (a parte 3b)",
  },
  {
    nome: "F7-3: a página desenha o vídeo como imagem",
    arq: PFILA,
    de: 'ehVideo: () => li?.forma === "video",',
    para: "ehVideo: () => false,",
    teste: T_PFILA,
    cai: "o vídeo do LinkedIn é vídeo na prévia, e tem a frase sobre a mídia (a parte 3b)",
  },

  // ---- F4 e F4-bis: o ramo do vídeo na fila (integração) ----
  {
    nome: "F4-1 (231): a etapa começa sem conferir a hora de parar",
    arq: FILA,
    de: "if (!aEtapaDoVideoCabe(etapa, Date.now(), deps.prazoMs)) {",
    para: "if (false) {",
    teste: T_VIDEO,
    cai: "sem tempo para a etapa (o 231): a linha volta sem gastar a tentativa, sem contar adiamento nem passada, com o payload igual",
  },
  {
    nome: "F4-2 (231): a parte sem o teto do envio no pior caso",
    arq: FILA,
    de: "parte: TETO_DO_BUCKET_MS + TETO_DO_ENVIO_DA_PARTE_MS + FOLGA_DA_ETAPA_DO_VIDEO_MS,",
    para: "parte: TETO_DO_BUCKET_MS + FOLGA_DA_ETAPA_DO_VIDEO_MS,",
    teste: T_HORA,
    cai: "a parte que não termina antes da hora de parar não começa, e as mensagens do mesmo lote saem, sem nada voltar",
  },
  {
    nome: "F4-3: o avanço não zera as tentativas",
    arq: FILA,
    de: "attempts = 0, not_before = now(), error = $2 where id = $1",
    para: "attempts = attempts, not_before = now(), error = $2 where id = $1",
    teste: T_VIDEO,
    cai: "dois erros passageiros, um avanço e mais dois: as tentativas zeram no avanço, e a linha segue até sair",
  },
  {
    nome: "F4-4 (237): a idade não conta da primeira passada",
    arq: FILA,
    de: "primeiraPassadaEmMs: primeiraMs,",
    para: "primeiraPassadaEmMs: null,",
    teste: T_VIDEO,
    cai: "o vídeo de mais de 2 horas desde a primeira passada encerra com o motivo",
  },
  {
    nome: "F4-5 (238): a parte recusada pede o convite de novo",
    arq: FILA,
    de: 'if (etapa === "parte" && err instanceof LinkedinError) {',
    para: "if (false) {",
    teste: T_VIDEO,
    cai: "a parte recusada com 403 encerra a linha com o motivo próprio, sem pedir o convite de novo",
  },
  {
    nome: "F4-6 (233): o fim perdido não aceita o AVAILABLE",
    arq: FILA,
    de: 'if (situacao !== "AVAILABLE" && situacao !== "PROCESSING") {',
    para: "if (true) {",
    teste: T_VIDEO,
    cai: "o fim perdido (o 233): com a marca e sem o fim, o 4xx consulta o estado, e AVAILABLE conta como fim",
  },
  {
    nome: "F4-7 (233): o fim recusado na primeira vez consulta o estado",
    arq: FILA,
    de: "if (!(repetido && err instanceof LinkedinError",
    para: "if (!(err instanceof LinkedinError",
    teste: T_VIDEO,
    cai: "o fim recusado na primeira vez encerra com o erro do LinkedIn, sem consultar o estado",
  },
  {
    nome: "F4-8: o vídeo espera uma consulta a mais",
    arq: FILA,
    de: "export const CONSULTAS_DO_VIDEO_MAX = 10;",
    para: "export const CONSULTAS_DO_VIDEO_MAX = 11;",
    teste: T_VIDEO,
    cai: "a décima consulta ainda espera, e na décima primeira a linha encerra com o motivo do vídeo",
  },
  {
    nome: "F4-8b (F7-bis): o vídeo encerra no teto de 5 consultas do documento",
    arq: FILA,
    de: "(doVideo ? CONSULTAS_DO_VIDEO_MAX : CONSULTAS_DA_MIDIA_MAX)",
    para: "CONSULTAS_DA_MIDIA_MAX",
    teste: T_VIDEO,
    cai: "a décima consulta ainda espera, e na décima primeira a linha encerra com o motivo do vídeo",
  },
  {
    nome: "F4-9: o processamento que falhou vira um erro comum",
    arq: FILA,
    de: 'if (pub.forma === "video" && err.processamentoFalhou) {',
    para: "if (false) {",
    teste: T_VIDEO,
    cai: "o vídeo que o LinkedIn não conseguiu processar encerra com o motivo que diz o que conferir",
  },
  {
    nome: "F4-10: o PROCESSING_FAILED não é reconhecido",
    arq: PUB,
    de: "return status === 400 && /PROCESSING_FAILED/.test(texto);",
    para: "return false;",
    teste: T_VIDEO,
    cai: "o vídeo que o LinkedIn não conseguiu processar encerra com o motivo que diz o que conferir",
  },
  {
    nome: "F4bis-1 (240): o fim conta uma chamada só",
    arq: FILA,
    de: "fim: 2 * TETO_DO_LINKEDIN_MS + FOLGA_DA_ETAPA_DO_VIDEO_MS,",
    para: "fim: TETO_DO_LINKEDIN_MS + FOLGA_DA_ETAPA_DO_VIDEO_MS,",
    teste: T_VIDEO,
    cai: "o fim conta as duas chamadas (o 240): aos 25 s ele não começa mais, e a linha volta sem chamar o LinkedIn",
  },
  {
    nome: "F4bis-2 (242): a etapa sem a folga de 2 s",
    arq: FILA,
    de: "const FOLGA_DA_ETAPA_DO_VIDEO_MS = 2_000;",
    para: "const FOLGA_DA_ETAPA_DO_VIDEO_MS = 0;",
    teste: T_VIDEO,
    cai: "o começo máximo de cada etapa, contra a hora de parar dos 40 s (o 231), com a folga de 2 s (o 242) e o fim de duas chamadas (o 240)",
  },
  {
    nome: "F4bis-3: a etapa que termina na hora de parar começa",
    arq: FILA,
    de: "< prazoMs - RESERVA_PARA_TERMINAR_MS;",
    para: "<= prazoMs - RESERVA_PARA_TERMINAR_MS;",
    teste: T_VIDEO,
    cai: "o começo máximo de cada etapa, contra a hora de parar dos 40 s (o 231), com a folga de 2 s (o 242) e o fim de duas chamadas (o 240)",
  },
  {
    nome: "F4bis-4 (241): o post cai no teto das passadas",
    arq: FILA,
    de: 'passadas: etapa === "post" ? 0 : pub.passadasDoVideo,',
    para: "passadas: pub.passadasDoVideo,",
    teste: T_VIDEO,
    cai: "o post não cai no teto das passadas (o 241): o fim foi a última passada permitida, e o post publica",
  },
  {
    nome: "F4bis-5 (244): a consulta que falha de passagem encerra o fim perdido",
    arq: FILA,
    de: 'if (e instanceof LinkedinError && desfechoDoErroDoLinkedin(e.status) === "passageiro") throw e;',
    para: "",
    teste: T_VIDEO,
    cai: "a consulta do estado que falha de passagem (429) não encerra o fim perdido (o 244): a linha volta à fila",
  },
  {
    nome: "F4bis-6 (243): o erro de rede da parte leva a mensagem crua",
    arq: LI,
    de: "    const status = err instanceof LinkedinError ? err.status : 0;\n    throw new LinkedinError(\n      status,",
    para: "    const status = err instanceof LinkedinError ? err.status : 0;\n    if (status !== STATUS_RECUSADO_PELO_PAINEL) throw err;\n    throw new LinkedinError(\n      status,",
    teste: T_VIDEO,
    cai: "o erro de rede de uma parte vai para a linha com um texto fixo, sem o endereço do envio (o 243)",
  },

  // ---- F5: as actions (integração) ----
  {
    nome: "F5-3: o reels nas duas redes não leva o LinkedIn",
    arq: ACOES,
    de: 'const formaNoLinkedin = forma === "reels" ? "video" : formaNoLinkedinDoCampo(forma);',
    para: "const formaNoLinkedin = formaNoLinkedinDoCampo(forma);",
    teste: T_DUAS,
    cai: "agendado: o Instagram leva o reels, o LinkedIn leva a forma vídeo com uma cópia feita no servidor, e a chave é a do original",
  },
  {
    nome: "F5-4: o vídeo copiado como as imagens",
    arq: ACOES,
    de: 'formaNoLinkedin === "video"\n          ? [await copiarOVideoParaOLinkedin(',
    para: 'false\n          ? [await copiarOVideoParaOLinkedin(',
    teste: T_DUAS,
    cai: "agendado: o Instagram leva o reels, o LinkedIn leva a forma vídeo com uma cópia feita no servidor, e a chave é a do original",
  },
  {
    nome: "F5-5 (232): o clique das duas redes drena o vídeo",
    arq: ACOES,
    de: 'if (linkedin.entrou && linkedin.jaVale && formaNoLinkedin === "video") {',
    para: "if (false) {",
    teste: T_DUAS,
    cai: "agora: o clique não drena o LinkedIn (o 232), que fica na fila intocado, e o Instagram sai no dreno do clique",
  },
  {
    nome: "F6-7: o aviso do LinkedIn sem a forma",
    arq: ACOES,
    de: "agendadoPara: r.jaVale ? null : campos, forma })));",
    para: "agendadoPara: r.jaVale ? null : campos })));",
    teste: T_COMPOR,
    cai: "agora: o clique faz só a reserva, a linha volta à fila com o vídeo reservado, e o aviso diz que o post vai sair",
  },

  // ---- F6-bis: o Remarcar do vídeo (o 245; integração) ----
  {
    nome: "F6bis-1 (245): o Remarcar não tira a marca da primeira passada",
    arq: ACOES_DO_POST,
    de: "then payload - 'primeira_passada_em' else payload end",
    para: "then payload else payload end",
    teste: T_TELAS,
    cai: "remarcar para daqui a três horas tira só a marca da primeira passada; as passadas e o resto do envio ficam",
  },
  {
    nome: "F6bis-2 (245): o Remarcar tira a chave de toda linha",
    arq: ACOES_DO_POST,
    de: "payload = case when kind = 'publicacao_linkedin' and payload->>'forma' = 'video'\n                                     then payload - 'primeira_passada_em' else payload end",
    para: "payload = payload - 'primeira_passada_em'",
    teste: T_TELAS,
    cai: "o post do Instagram e o do LinkedIn que não é vídeo ficam com o payload intacto, mesmo com uma chave do mesmo nome",
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
const tipo = process.argv[2]?.startsWith("--tipo=") ? process.argv[2].slice("--tipo=".length) : undefined;
if (tipo !== undefined && !["puro", "dom", "integ"].includes(tipo)) throw new Error(`RECUSADO: tipo desconhecido "${tipo}"`);
const filtro = conferir || tipo ? undefined : process.argv[2];
const inicio = Date.now();
let ruins = 0;
let rodadas = 0;
for (const m of MUTACOES) {
  if (filtro && !m.nome.startsWith(filtro)) continue;
  if (tipo && m.teste.tipo !== tipo) continue;
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
    console.log(`ÚNICO ${m.nome}  [${m.teste.tipo}]`);
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
    delete env.DATABASE_URL_TESTES;
    if (m.teste.tipo === "integ") env.DATABASE_URL_TESTES = TESTES_URL;
    r = spawnSync("npx", args, { encoding: "utf8", shell: true, env, timeout: 10 * 60 * 1000, maxBuffer: 64 * 1024 * 1024 });
  } finally {
    writeFileSync(m.arq, original);
  }
  const saida = semCor(`${r.stdout}\n${r.stderr}`);
  const alvoOk = m.teste.tipo !== "integ" || saida.includes("ALVO: banco de TESTE");
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
