# A parte 3a do LinkedIn, o carrossel em PDF, sobre a hora de parar do dreno — Plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: `superpowers:subagent-driven-development`
> (recomendada) ou `superpowers:executing-plans`, fase por fase. Os passos usam caixa de
> seleção (`- [ ]`) para acompanhar.

**Objetivo:** o carrossel de fotos da tela de compor sai também no perfil pessoal do LinkedIn, como um documento PDF com uma página por foto. Ele pode sair só no LinkedIn ou nas duas redes. E o botão de publicar passa a dizer onde e quando o post sai (o 215).

**Este plano refaz o plano de 12/11 (`7f7cb1ea`) sobre a `main` com a 3a-0** (a hora de parar do dreno, PR #36). O código é o mesmo, fora três pontos em que a 3a-0 mudou o terreno, descritos em "O que mudou em relação ao plano de 12/11".

**Arquitetura:**
- **O PDF é montado pelo painel, sem dependência nova** (`lib/pdf-de-fotos.ts`, puro).
  - É um PDF 1.4 com uma página por foto, no tamanho da foto, e cada JPEG entra como está (`/DCTDecode`), sem recomprimir.
  - Só entra o JPEG comum: 1 ou 3 componentes, 8 bits e os processos da DCT (C0, C1 e C2). É a regra `vaiCruParaOLinkedin` (`lib/linkedin-publicacao.ts`), a mesma da tela.
  - O cabeçalho sai do `cabecalhoDoJpeg` (`lib/bonus/imagem-jpeg.ts`), que agora devolve também os componentes, a precisão e o marcador do SOF.
- **O cliente do LinkedIn** (`lib/linkedin.ts`):
  - `reservarDocumento` pede o documento com a pessoa dona;
  - `enviarDocumento` faz um `PUT` só, com a autorização, para um endereço https do LinkedIn, com teto de 25 s;
  - o `criarPost` decide a mídia não pronta na resposta INTEIRA (`LinkedinError.midiaNaoPronta`).
- **A fila do LinkedIn** (`lib/linkedin-fila.ts`) ganha a forma `"carrossel"`, com 2 a 10 fotos.
  - **A passada do documento** baixa as fotos, monta o PDF, reserva e envia. Ela pede 52 s (bucket 10, montagem 2, reserva 10, envio 25, folga 5) e só começa com esse tempo pela frente.
  - O `documento_urn` fica no payload. O post leva `{ id, title }`, e o título é o começo do texto, com até 100 caracteres.
  - **A mídia que o LinkedIn ainda processa** volta em 60 s sem gastar tentativa, até 5 consultas; na 6ª, a linha vai a `failed`.
  - **Os adiamentos contam**, para toda forma: o 7º encerra a linha, com o motivo pela forma (219). Só a regra do próprio post do LinkedIn conta adiamento; a linha devolvida pela hora de parar da 3a-0 não ganha nenhum.
  - O teto de 15 MB é conferido de novo no que o dreno baixou.
- **As actions** (`app/publicar/actions.ts`):
  - **Só no LinkedIn**, o carrossel entra pela lista única das formas.
  - **Nas duas redes**, a linha do LinkedIn leva uma cópia de cada foto (`copiarAsImagensParaOLinkedin`, em paralelo, com `allSettled`), e a chave continua pelas originais. A ordem do 192 e o 199 não mudam.
  - **No "agora" do carrossel nas duas redes**, o "agora" do LinkedIn (`drenarUmaPublicacaoDoLinkedin`) conta o prazo com 20 s de reserva para o Instagram (222), e o documento nunca começa no clique. O dreno do Instagram é o dreno do clique da 3a-0, que não pega o post do LinkedIn, então a reserva só vale para o "agora" do LinkedIn.
  - **A recusa `carrossel_com_video`** vale nas três barreiras: a tela, a action e o enfileirar.
- **A tela de compor** (`app/publicar/enviador.tsx`, `app/publicar/navegador.ts`):
  - a caixinha do LinkedIn fica ligada no carrossel, e o vídeo na lista a desliga e a desmarca;
  - com o LinkedIn marcado, o JPEG só vai cru se o PDF o aceita como está (o navegador lê o cabeçalho, `lerCabecalho`, opcional);
  - as fotos juntas têm o teto de 15 MB, conferido antes de cada foto subir;
  - o botão diz as redes e o quando.
- **As telas de Publicações** (`lib/post-da-fila.ts`) mostram o rótulo "LinkedIn · Carrossel (PDF)", a capa da primeira foto e a frase sobre a mídia.
- **O `lib/queue-drain.ts` e o `lib/fila-tipos.ts` não mudam.** A 3-0 preparou o dreno (o predicado da forma conhecida, a ordem do lote e o "agora" de uma linha), e a 3a-0 deu a ele a hora de parar e o dreno do clique.

**Stack:** a do projeto, no Next.js 16.4.3: Vitest (testes puros, de tela e de integração) e o Postgres no container para a integração.

**O desenho:** `scratchpad/desenho-li3.md` (d6ce6456), §6, revisado pela auditoria. A spec é a `docs/specs/2026-11-06-linkedin-no-perfil.md` (a emenda de 09/11, parte 3). A pesquisa da API está em `scratchpad/ponto2/linkedin-video-documento-11-11.md` (e0ca8bc6).

**As decisões do Eduardo:**
- pela caixa de 11/11, às 14:55:42.887Z: "Em 4 entregas (Recomendado)" (3-0, 3a, 3b e 3c), "Montado pelo painel (Recomendado)" (o PDF sem dependência), "O começo do texto (Recomendado)" (o título do documento) e "O botão diz as redes (Recomendado)";
- pela caixa de 12/11, às 14:06:42.071Z: a 3a-0 à parte, antes da 3a, com a hora de parar e os cliques sem o LinkedIn.

**A base:** a `main` em `40b2aec`, com a 3a-0 em produção desde 12/11, às 18:13:06Z (PR #36). A primeira hora fechou sem tráfego na fila; a leitura se repete no primeiro tráfego. A 3-0 está em produção desde 11/11 (PR #35).

**A auditoria (`metodochat-f4` em 12/11 e `metodochat-9c` em 13/11)** conferiu cada fase do ensaio pelo patch-id e pela leitura do código. O que ela pediu entrou no ensaio:
- **219:** o motivo do 7º adiamento falava em fotos para toda forma. Agora só o carrossel fala em fotos, e o teto dos adiamentos vale também para o texto e a imagem que já estão no ar.
- **220:** o PDF aceitava o JPEG sem perda e o aritmético. Agora a regra confere o marcador do SOF, na tela e no PDF.
- **221:** a mídia não pronta era decidida no texto cortado em 300 caracteres. Agora ela é decidida na resposta inteira.
- **222:** no "agora" das duas redes, o PDF podia começar no clique. Agora há a reserva de 20 s no "agora" do LinkedIn.
- **O 223 e o 224** viraram a 3a-0, que já está em produção. Este plano é a 3a refeita sobre ela.
- O JPEG de 4 componentes, com o LinkedIn marcado, tem um caso de tela que mostra que ele passa pelo canvas (a nota 5).
- A chave da imagem que já está na fila não muda, e um caso a grava à mão como a produção de hoje a escreve.

**O que mudou em relação ao plano de 12/11 (`7f7cb1ea`), medido por `git merge-tree` e no ensaio:**
- **Os arquivos que a 3a e a 3a-0 mudam juntos são 3:** `app/publicar/actions.ts`, `tests/dreno-com-prazo.test.ts` e `testes-integracao/linkedin-publicacao.integracao.ts`. Só a FASE 4-bis tem conflito; as outras seis fases de código aplicam limpas e dão o mesmo patch-id de 12/11.
- **FASE 3-bis:** os casos "só texto, no sétimo adiamento" e "só texto, adiado" passaram do dreno do lote para o `drenarUmaPublicacaoDoLinkedin`, com 5 s restando. Com a 3a-0, o dreno do lote nem reivindica a 50 s do começo. E entrou uma guarda no arquivo da 3a-0 (`testes-integracao/dreno-hora-de-parar.integracao.ts`): a linha do carrossel devolvida pela hora de parar volta com o payload igual, sem adiamento. O patch-id mudou de `db161fbc13b5` para `9ee1c9da8cad`.
- **FASE 4-bis:** o dreno do Instagram, no "agora" das duas redes, fica na forma do clique da 3a-0 (`drainQueue({ inicioDaFuncaoMs, doClique: true })`); a reserva fica só no "agora" do LinkedIn. O teste de fonte junta os dois lados. O caso do 222 em que o "agora" do LinkedIn lança passou a provar que o dreno do clique não pega a linha do LinkedIn. Quatro comentários que diziam que o dreno do Instagram pegava a linha do LinkedIn foram acertados. O patch-id mudou de `c27ec3afd620` (os dois commits de 12/11 juntos) para `7eaad643609a`.
- **A reserva continua necessária no "agora" do LinkedIn:** sem ela, a passada do documento (52 s) começaria no clique sempre que o que vem antes levasse até 3 s, o dreno do Instagram começaria depois da hora de parar e não pegaria nada, e o Instagram sairia só pelo tique. Com ela, o Instagram sai no clique, e o LinkedIn espera o tique.

**Ensaio do plano (13/11):** o código deste plano foi refeito e testado fase a fase numa cópia isolada (`git worktree`, sem push, branch local `ensaio-carrossel-pdf-2`, saída de `40b2aec`, com `npm ci` próprio e `.env.local` vazio), trazendo cada commit do ensaio de 12/11 por `cherry-pick --no-commit`. Em cada fase, o código foi separado para o RED e devolvido para o GREEN, com os mesmos comandos deste plano, e a saída inteira de cada suíte foi para um registro. Todo bloco de código abaixo foi tirado do git dessa cópia por um gerador, sem cópia à mão. Os commits do ensaio:
- FASE 1, `7b4e8f2` (patch-id `48d90a10bbfa`, igual ao de 12/11);
- FASE 2, `687d0d0` (patch-id `c072013ab462`, igual);
- FASE 3, `d30d512` (patch-id `79de982da6e9`, igual);
- FASE 3-bis, `2ef0aa8` (patch-id `9ee1c9da8cad`, mudou);
- FASE 4, `3ed16b3` (patch-id `2ea7ea0eec88`, igual);
- FASE 4-bis, `6ee7932` (patch-id `7eaad643609a`, mudou);
- FASE 5, `3c7bdf0` (patch-id `86cc557adc71`, igual);
- FASE 6, `cac8f4b` (patch-id `28741e26cedf`, igual).

As mensagens são as deste plano. Os registros estão na pasta de trabalho do DEV: `el3av2-f*-*.log`, `el3av2-verify.log`, `el3av2-integracao.log` e `el3av2-mutar.log`.

Os números do fim, no `cac8f4b` (entre parênteses, os da base `40b2aec`):
- o `tsc` e o lint dos arquivos de cada fase limpos em todas as fases;
- a guarda contra a `40b2aec` (nada em `lib/queue-drain.ts`, `lib/fila-tipos.ts`, `migrations`, `scripts` e `package*`) vazia em todas as fases;
- testes puros: 160 arquivos e 3 828 casos (159 e 3 784); testes de tela: 36 arquivos e 347 casos (36 e 336);
- a varredura sem vazamento e o build com o Next 16.4.3 ("MIGRAÇÃO PULADA", fora da produção);
- a integração no container: 79 arquivos, 982 passaram e 8 pularam (78, 954 e 8);
- as 33 mutações do Apêndice A (14 delas de integração e 5 de tela) derrubaram, cada uma, o caso esperado: "33 mutações, 0 ruins; árvore no fim: limpa", com o roteiro de sha256 `1c062fbe22b72d62` (390 linhas);
- a guarda do diff (FASE 7, Passo 5) mostra só os 29 arquivos do mapa, com 2 140 linhas a mais e 151 a menos;
- este plano, aplicado do zero numa cópia limpa da `40b2aec` (cada "Crie" gravado, cada "Em ... aplique" passado ao `git apply`), deu os 29 arquivos iguais aos do ensaio: "3 criados, 45 diffs aplicados, 0 apagados, 0 gerados; 29 arquivos conferidos, 0 diferentes", e o `git hash-object` de cada um igual ao do `cac8f4b` (29 de 29).

**O que o ensaio achou:**
- **O 227 tem causa medida:** na primeira suíte pura de uma cópia recém-instalada, a varredura da árvore de `tests/vocabulario-da-fila.test.ts` levou 5 714 ms e passou do limite de 5 s ("Test timed out in 5000ms"); sozinha, logo depois, levou 119 ms. A de `tests/paleta.test.ts` levou 1 518 ms contra 60 ms. É a primeira carga do disco, como o 218 (o `beforeAll` de `tests/proxy-matcher.test.ts`). A segunda rodada passou inteira. Nada desta entrega toca neles.
- **O container do banco de teste parou** entre um dia e outro ("Exited (255)"), e a primeira rodada de integração da FASE 3 deu `ECONNREFUSED 127.0.0.1:5434` antes de qualquer teste. Ligado com `docker start`, ficou saudável, e o RED e o GREEN foram refeitos. Por isso o `docker ps` vem antes de cada rodada de integração.
- **O "nunca cabe no mesmo clique" do desenho (:191) não era verdade** (o 222). A passada do documento cabia no "agora" das duas redes quando tudo antes dela levava menos de 3 s. A reserva no "agora" do LinkedIn resolve.
- **O teto de 15 MB na tela é conferido antes de cada foto subir**, e não antes de toda a leva. O tamanho só se sabe depois do canvas, que roda junto da subida, foto por foto. A foto que passaria do teto não sobe, e as de antes ficam guardadas para o próximo clique. A auditoria aceitou.
- **O `redeAceitaAForma` muda na FASE 5, com a tela, e não na FASE 4.** Na FASE 4, a action aceita o carrossel pela lista única das formas, e a caixinha só liga quando a tela inteira está pronta.
- **Os JPEGs dos testes:** só o baseline é um JPEG de verdade, feito pelo ffmpeg (16×20 e 20×16, em base64). O progressivo, o cinza, o CMYK, o de 12 bits e os de outro marcador são cabeçalhos montados à mão.
- **O `medidasDoJpeg` do gerador passa a usar o `cabecalhoDoJpeg`.** O JPEG cortado logo depois das medidas, antes do byte dos componentes, passa a dar `null`. Os testes do gerador continuam passando.
- **Os testes da 3-0 que usavam "carrossel" como a forma que este código não conhece** passaram a usar "video": o carrossel agora é conhecido.
- **As fotos falsas do teste das duas redes ganharam um cabeçalho de verdade** (um comentário com o número e o SOF0 de 16×16), para o PDF não morrer antes de chamar o LinkedIn falso.

**Os limites conhecidos (sem código nesta entrega):**
- **O tempo da action das duas redes, com 10 fotos** (o `maxDuration` é 60, `app/publicar/novo/page.tsx:49`):
  - as conferências são consultas ao banco, sem teto próprio;
  - as cópias correm em paralelo, cada uma com três chamadas de até 10 s, então o pior caso é ~30 s, o mesmo de uma foto só. Medido no ensaio de 12/11: 3 fotos com cada download a 3,1 s levaram 3 974 ms;
  - o "agora" do LinkedIn não começa o documento (o 222);
  - o dreno do Instagram não começa nada depois da hora de parar (a 3a-0): se tudo antes passar dos 40 s, o Instagram sai pelo tique, uns 20 s depois.
- **Se a função for cortada no meio das cópias** (só se as conferências levarem mais de ~30 s), nada foi gravado: as linhas só entram depois de todas as cópias. As cópias que já subiram ficam no bucket sem dono, e o mesmo envio pode ir de novo.
- **Se a função for cortada no post do Instagram**, a linha dele fica em `sending` e volta em 3 minutos (`lib/queue-drain.ts:1244`, na `40b2aec`). Os filhos já criados são reaproveitados (`:398`), e o contêiner já publicado não republica (`:619`).
- **A fome, com N carrosséis vencidos:** cada passada de rota leva um passo longo, e as mensagens do mesmo lote podem voltar até N vezes pela hora de parar. Os cliques não entram nisso (a 3a-0).
- **O post do LinkedIn vencido só sai pelos drenos das rotas** (o tique, o webhook e o cron) e pelo "agora" e o Remarcar. Com o serviço dos tiques fora, ele espera o próximo webhook ou o cron.
- **O total de 15 MB não é conferido na action**, porque ela não sabe os tamanhos sem baixar. A tela confere antes, e o dreno confere de novo e encerra a linha com o motivo.
- **O teto dos adiamentos passa a valer também para o texto e a imagem** que já estão no ar. O 7º adiamento encerra a linha com "o post não coube no tempo de nenhuma passada; publique de novo".
- **O "Remarcar" do preview** (o caminho da prova, o 216) roda na página `app/publicar/post/[id]/page.tsx`, que não declara `maxDuration`: vale o padrão do projeto, 300 s com o Fluid ligado (o Eduardo conferiu o Fluid e o plano Hobby no painel em 29/09).
  - Desde a 3a-0, o Remarcar passa ao `drenarUmaPublicacaoDoLinkedin` o começo da própria action, marcado logo depois da sessão (`app/publicar/post/actions.ts:231-232` e `:331`, na `40b2aec`). A passada do documento (52 s dos 55) só começa se a conta, o `update` e a reivindicação da linha levarem até 3 s (o `statusNaConta`, `:290`, só roda quando o `update` não pegou linha). Se não, a linha é adiada sem gastar tentativa e conta 1 adiamento. A prova lê o `adiamentos` depois de cada Remarcar, e o 7º encerraria a linha.
- **Até o merge, as Publicações da produção mostram a linha do carrossel como "LinkedIn · Forma não reconhecida"** (`lib/linkedin-publicacao.ts:95`, na `40b2aec`), e o cancelar da produção não apaga as fotos dela: o `lerPayloadDoLinkedin` da `40b2aec` não lê o carrossel (`:168` e `:286`), e o `caminhosDoPostDaFila` devolve null (`lib/post-da-fila.ts:69-71`). Por isso a linha da prova se cancela pelo preview.
- **Num rollback para a `40b2aec`**, uma linha de carrossel em `sending` fica presa: o resgate de 3 minutos da `40b2aec` também exclui a forma que ela não conhece. Uma linha `pending` volta a ficar intocada.
- **Os previews antigos não têm o predicado da forma:** o `lib/queue-drain.ts` das branches `linkedin-publicacao`, `linkedin-duas-redes` e `linkedin-conexao` tem 0 ocorrências de `soAFormaConhecidaDoLinkedin` (medido em 13/11). Um clique num deles mandaria a linha do carrossel a `failed`, por payload torto. Por isso nenhum outro preview é aberto durante a prova.
- **A memória da função não foi medida** (o `get_project` não a traz). O pico estimado é ~30 MB: as fotos mais o PDF.
- **A vazão do bucket e a do envio ao LinkedIn, a partir da Vercel, não foram medidas.** A prova leva um carrossel perto dos 15 MB e lê os tempos da linha. O teto só sobe depois dessa medida.

## Restrições globais

- **A cópia tem caminho absoluto fixo**, fora da pasta do projeto, que tem o `.env.local` de produção:
  - `C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-carrossel-pdf"`;
  - todo bloco de comandos abaixo começa por essa linha e por `cd "$C" || exit 1`, porque a sessão não guarda o `cd` fora da pasta do projeto;
  - o `..` dos comandos é a pasta de trabalho do DEV, onde ficam o `varrer-texto.mjs` (sha256 `f350d19f515e854f`) e o roteiro das mutações.
- **Branch:** `linkedin-carrossel-pdf`, saída do `40b2aec` (a `main` com a 3a-0), sem upstream.
  - Nunca commitar nem empurrar na `main`: ela não está protegida, e um push nela dispara o deploy na Vercel.
  - Todo commit vem depois de `test "$(git branch --show-current)" = linkedin-carrossel-pdf &&`.
- **`git add` com caminho explícito.** Nunca `-A` nem `.`.
- **Commit no estilo do Vinícius:** uma frase dizendo o efeito, sem prefixo, sem rodapé de IA.
  - Autor: Eduardo Kobal <162614913+Eduardokobal@users.noreply.github.com>.
  - Nunca `git config` numa worktree.
- **Antes de cada commit**, o `node ../varrer-texto.mjs` nos arquivos da fase (cada um "limpo"), no mesmo comando do commit, com `&&` e sem nada entre os dois.
- **O commit é um comando à parte**, depois de ler a saída dos testes.
- **A regra de divergência:** se o RED, o GREEN, o patch-id, a guarda ou a aplicação não baterem com o plano, pare. Não ajuste o teste nem o código: mande a saída inteira à auditoria e espere.
- **O 218 e o 227 em toda rodada da suíte pura:** na primeira suíte de uma cópia recém-instalada, três casos de outros arquivos podem estourar o tempo pela primeira carga do disco:
  - o `beforeAll` de `tests/proxy-matcher.test.ts` (10 s, "Hook timed out in 10000ms");
  - as duas varreduras de `tests/vocabulario-da-fila.test.ts` e `tests/paleta.test.ts` (5 s, "Test timed out in 5000ms"; medido em 13/11: 5 714 ms na primeira carga, 119 ms sozinho).
  - O procedimento: rodar o arquivo sozinho e a suíte inteira de novo. Se cair outra vez numa rodada que não seja a primeira, é divergência, e a mensagem inteira vai à auditoria.
- **A saída inteira de toda suíte (pura, de tela e de integração) vai para um registro**, sem filtro: os comandos abaixo passam por `2>&1 | tee ../el3a-<fase>-<rodada>.log`.
- **Fim de linha:** os diffs deste plano estão em LF. A cópia é feita com `git -c core.autocrlf=false`, e o `git apply --ignore-whitespace` serve se ela não for.
- **Os arquivos desta entrega são os 29 do mapa abaixo, e mais nenhum.** O `lib/queue-drain.ts` e o `lib/fila-tipos.ts` NÃO mudam, e a guarda confere isso em cada fase, contra a `40b2aec`. O cuidado do motor vale para o ramo do LinkedIn na fila (auditoria, DEV e agentes).
- **Os testes da 3-0 e da 3a-0 continuam valendo:** no arquivo da 3a-0, só entra o caso de guarda novo (nenhuma linha sai); no `tests/dreno-com-prazo.test.ts`, só o bloco das duas redes muda; o `tests/fila-tipos.test.ts` não muda; e os três da 3-0 trocam "carrossel" por "video" como a forma que o código não conhece.
- **Nenhuma migração.** O deploy tem de dizer "Nada a aplicar: as 26 migrações já constam no registro."
- **Toda escrita em produção** (a prova no preview grava no banco de produção e publica nas redes) pede, nesta ordem:
  1. o OK do Eduardo pela caixa;
  2. a hora mandada à auditoria;
  3. o "pode" dela.
- **O DEV não se conecta à produção.** As leituras da base (antes da prova, depois da prova, antes do merge e na primeira hora) são da auditoria, com as ferramentas dela, só lendo.
- **Uma rodada de integração de cada vez**, sempre com `DATABASE_URL_TESTES=postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes`.
  - **O `docker ps` vem antes de cada rodada de integração**, e não só na FASE 0: o container parou entre um dia e outro no ensaio. Se ele estiver parado, `docker start metodochat-banco-de-teste` e espere "healthy".
  - Toda rodada tem de imprimir `[rede-global] ALVO: banco de TESTE`.
  - Nunca rode com a variável vazia: ela cai na `DATABASE_URL`, que é **produção**.
  - **A dica que a própria rodada imprime, "Rode sem DATABASE_URL_TESTES antes do merge"** (`testes-integracao/rede-global.ts:41`), **não vale nesta entrega**: sem a variável, a integração roda contra a produção.
- **`npx --no-install`** sempre (achado 208), e o `npm ci` da FASE 0 antes de qualquer teste.
- **A suíte pura inteira roda no fim de toda fase**, além dos arquivos da fase.
- **`next build` sem as variáveis de agente:** `env -u CLAUDECODE -u AI_AGENT ...`, e `git diff AGENTS.md` depois.
- **O token, o code e o segredo do LinkedIn nunca vão para o chat nem para registro.**
- **No corpo do PR**, nenhuma arroba solta, nem e-mail, nem nome de pessoa ou de conta: o repositório é público.

## Mapa dos arquivos

| Arquivo | O que faz | Fase |
|---|---|---|
| `lib/pdf-de-fotos.ts` (novo) | o PDF 1.4 de fotos, sem dependência | 1, 3 e 3-bis |
| `lib/bonus/imagem-jpeg.ts` | o `cabecalhoDoJpeg` (componentes, precisão e marcador); o `medidasDoJpeg` passa a usá-lo | 1 e 3-bis |
| `lib/linkedin-publicacao.ts` | o título, o teto de 15 MB, o problema do carrossel, o JPEG cru, a forma `"carrossel"`, o payload, o corpo do post com o documento, a mídia não pronta, a recusa do vídeo e a nota da tela | 1, 2, 3, 3-bis, 4 e 5 |
| `lib/redes-do-post.ts` | o texto do botão; o carrossel liga o LinkedIn, e o vídeo o desliga | 1 e 5 |
| `tests/linkedin-carrossel-regras.test.ts` (novo) | o cabeçalho, o PDF, o título, o teto, o JPEG cru e o botão | 1 e 3-bis |
| `lib/linkedin.ts` | a reserva e o envio do documento; a mídia não pronta na resposta inteira | 2 e 3-bis |
| `tests/linkedin-rest.test.ts` | a reserva, o envio e a mídia não pronta | 2 e 3-bis |
| `tests/linkedin-post.test.ts` | o corpo do post com o documento; a forma e o payload do carrossel | 2 e 3 |
| `lib/linkedin-fila.ts` | a passada do documento, a mídia não pronta, os adiamentos e a reserva do "agora" do LinkedIn | 3, 3-bis e 4-bis |
| `testes-integracao/linkedin-carrossel.integracao.ts` (novo) | o carrossel pela fila, com o LinkedIn e o bucket falsos | 3 e 3-bis |
| `testes-integracao/dreno-forma-desconhecida.integracao.ts` | a forma desconhecida passa a ser "video" | 3 |
| `testes-integracao/linkedin-telas.integracao.ts` | idem | 3 |
| `tests/linkedin-forma-conhecida.test.ts` | idem | 3 |
| `tests/linkedin-compor.test.ts` | as recusas do carrossel; a do vídeo | 3 e 4 |
| `testes-integracao/linkedin-publicacao.integracao.ts` | o 7º adiamento do só texto e o adiamento contado, pelo "agora" com 5 s restando | 3-bis |
| `testes-integracao/dreno-hora-de-parar.integracao.ts` | a guarda: o carrossel devolvido pela hora de parar não ganha adiamento | 3-bis |
| `app/publicar/actions.ts` | as duas redes com o carrossel; a reserva no "agora" do LinkedIn | 4 e 4-bis |
| `lib/linkedin-copia.ts` | as cópias em paralelo | 4 |
| `tests/linkedin-copia.test.ts` | as cópias em paralelo | 4 |
| `testes-integracao/linkedin-compor.integracao.ts` | o carrossel só no LinkedIn | 4 |
| `testes-integracao/linkedin-duas-redes.integracao.ts` | o carrossel nas duas redes e o 222 | 4 e 4-bis |
| `tests/dreno-com-prazo.test.ts` | o teste que lê a action das duas redes passa a ler a reserva do "agora" do LinkedIn | 4-bis |
| `app/publicar/enviador.tsx` | a tela com o carrossel no LinkedIn e o botão | 5 |
| `app/publicar/navegador.ts` | o leitor do cabeçalho do JPEG | 5 |
| `testes-dom/publicar-compositor-linkedin.dom.tsx` | os casos de tela do carrossel e do botão | 5 |
| `testes-dom/publicar-compositor.dom.tsx` | o leitor de verdade do cabeçalho | 5 |
| `tests/redes-do-post.test.ts` | o carrossel liga o LinkedIn, e o vídeo o desliga | 5 |
| `lib/post-da-fila.ts` | a capa e a frase do carrossel | 6 |
| `tests/post-da-fila.test.ts` | idem | 6 |

São 29 arquivos, 3 deles novos.

---

### FASE 0 — Começar da branch certa

- [ ] **Passo 1: a branch, saída da `main`, no caminho fixo**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-carrossel-pdf"
test ! -e "$C" || { echo "a pasta da cópia já existe: pare"; exit 1; }
cd "$HOME/Projetos/metodochat" || exit 1
git fetch origin
test "$(git rev-parse --short origin/main)" = 40b2aec || { echo "a main mudou: pare"; exit 1; }
git -c core.autocrlf=false worktree add -b linkedin-carrossel-pdf "$C" 40b2aec
cd "$C" || exit 1
git rev-parse --abbrev-ref @{upstream} 2>/dev/null || echo "sem upstream"   # sem upstream: nada sobe sem querer
git branch --show-current                          # linkedin-carrossel-pdf
: > .env.local                                     # vazio: nenhum banco de produção na cópia
npm ci
docker ps --format '{{.Names}} {{.Status}}' | grep metodochat-banco-de-teste   # healthy; senão, docker start
```

Se `origin/main` não estiver em `40b2aec`, pare: a base mudou, e o plano precisa ser conferido de novo.

- [ ] **Passo 2: o plano na branch.** O primeiro commit da branch é este plano, em `docs/plans/2026-11-13-linkedin-carrossel-pdf.md`.

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-carrossel-pdf"; cd "$C" || exit 1
node ../varrer-texto.mjs docs/plans/2026-11-13-linkedin-carrossel-pdf.md && test "$(git branch --show-current)" = linkedin-carrossel-pdf && git add docs/plans/2026-11-13-linkedin-carrossel-pdf.md && git commit -m "O plano da parte 3a do LinkedIn, refeito sobre a hora de parar do dreno: o carrossel sai como PDF, só no LinkedIn ou nas duas redes, e o botão diz onde e quando o post sai"
```

---

### FASE 1 — As regras puras: o cabeçalho do JPEG, o PDF de fotos, o título, o teto e o botão

**Arquivos:** `lib/bonus/imagem-jpeg.ts`, `lib/linkedin-publicacao.ts`, `lib/pdf-de-fotos.ts`, `lib/redes-do-post.ts`, `tests/linkedin-carrossel-regras.test.ts`.

- [ ] **Passo 1: os testes**

Crie `tests/linkedin-carrossel-regras.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { cabecalhoDoJpeg, medidasDoJpeg } from "@/lib/bonus/imagem-jpeg";
import { pdfDeFotos } from "@/lib/pdf-de-fotos";
import {
  problemaDoCarrosselNoLinkedin,
  textoDoProblemaDoCarrosselNoLinkedin,
  TETO_DO_CARROSSEL_NO_LINKEDIN_BYTES,
  tituloDoDocumento,
  vaiCruParaOLinkedin,
} from "@/lib/linkedin-publicacao";
import { textoDoBotaoDePublicar } from "@/lib/redes-do-post";

// AS REGRAS PURAS DO CARROSSEL EM PDF NO LINKEDIN (a parte 3a; o desenho, scratchpad/desenho-li3.md, §6): o
// cabeçalho do JPEG, o PDF de fotos, o título do documento, o teto do carrossel, o JPEG que pode ir cru com o LinkedIn
// marcado, e o botão que diz onde o post sai (o achado 215).

// DOIS JPEGS DE VERDADE, feitos pelo ffmpeg (testsrc, 16×20 e testsrc2, 20×16, yuvj420p): baseline, 3 componentes.
const FOTO_A = Uint8Array.from(Buffer.from("/9j/4AAQSkZJRgABAgAAAQABAAD//gAPTGF2YzYzLjEuMTAyAP/bAEMACAoKCwoLDQ0NDQ0NEA8QEBAQEBAQEBAQEBISEhUVFRISEhAQEhIUFBUVFxcXFRUVFRcXGRkZHh4cHCMjJCsrM//EAHUAAQEBAQAAAAAAAAAAAAAAAAUGAgMBAQEBAAAAAAAAAAAAAAAAAAECAxAAAgECBAQFBQEAAAAAAAAAAgEDBBESBgAhMQUyQjPDgkEHIyKRYVFSEQABAgUFAQEBAAAAAAAAAAABAgMSEQQTIiEUAAUjMYEy/8AAEQgAFAAQAwEiAAIRAAMRAP/aAAwDAQACEQMRAD8AFdHzLKPLo/qqKstiNCo5BixMWg+4SEiQyNG1cb9Ldruoq66lybXRnBTt0ou0kQkRHhJAsQFKTbIXIRIWSRdLa2a1ngSrQZ0oupErYShTlEvC4MLp8Hw/mp7PZDUnIEBKYla4xtGS8Lihu/Z/jR2AtDqNlpe3e9sa3IbEG4gnOGNyCP8AmJUuLKjUuUiHZKcUK0OokApW3FeKe4gAElFimgKhObbZ+gc7ZSnq+bU0VPNVSgI3wuMIEQ2cn+oSXalunpPLFPS8/qnU1dPGikRIwjKYQfXvvKRJrB7Fbd/rRHx72erztO/HvZ6vO1PXeCXw15BRdiCMQrVX2GU/3mvYC3XJqEYPFFD7J0dybYizGWUzPXWZ5//Z", "base64"));
const FOTO_B = Uint8Array.from(Buffer.from("/9j/4AAQSkZJRgABAgAAAQABAAD//gAPTGF2YzYzLjEuMTAyAP/bAEMACBAQExATFhYWFhYWGhgaGxsbGhoaGhsbGx0dHSIiIh0dHRsbHR0gICIiJSYlIyMiIyYmKCgoMDAuLjg4OkVFU//EAHQAAQEBAQEAAAAAAAAAAAAAAAUEAQcGAQEBAQAAAAAAAAAAAAAAAAAFAwYQAAEDAwIDCQEBAAAAAAAAAAECAxEEEiEAURMiU6LSQTJhFDEVIzNSEQACAQIGAwEAAAAAAAAAAAABAhEDIQASIjEEBXFhI2L/wAARCAAQABQDASIAAhEAAxEA/9oADAMBAAIRAxEAPwDlxL63VIb8BcfKAABJJUrAHqTqp9Va9XKWrLhSFlUICbAgC6cItjE/E+ukWCD7tuL1K4Kg3MFYQZUAd42ztppbjZpzTWy7/T28m6ziX2T/AKs8PPGY1Gr2ld+RnUEWKjUSUSpkZjMjQIAIsDFzjSPRArFS5+bEg/oMQFG8NaRefWCBXV9OEoLluJHK2QQcyCEkEHcHW/a1vV7Dfd16GmqWaVlDbn5K5lcPmUUBSyUgkA5gj5zvq37Gl6nZX3dGt2PIDH5O1zqBaG9iJ38nzgOp1XEquzvUpZnYs2ZULSTJkkyTO84//9k=", "base64"));

/** Um segmento JPEG: FF, a marca, o tamanho em dois bytes (que conta a si mesmo) e o conteúdo. */
const segmento = (marca: number, conteudo: number[]) => [0xff, marca, (conteudo.length + 2) >> 8, (conteudo.length + 2) & 0xff, ...conteudo];

/**
 * O COMEÇO DE UM JPEG NA FORMA DE UM DE VERDADE, para os casos que o ffmpeg não faz (o progressivo, o cinza, o
 * CMYK e o de 12 bits): SOI, APP0, uma tabela de Huffman (C4, que não é SOF), o SOF pedido e o SOS. O SOF leva um
 * byte por componente a mais do que conta, como o de verdade (o id, a amostragem e a tabela de cada um).
 */
function jpeg(p: { largura: number; altura: number; sof?: number; componentes?: number; precisao?: number; antes?: number[] }): Uint8Array {
  const componentes = p.componentes ?? 3;
  const app0 = segmento(0xe0, [0x4a, 0x46, 0x49, 0x46, 0x00, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
  const dht = segmento(0xc4, [0x00, ...Array(16).fill(0)]);
  const porComponente = Array.from({ length: componentes }, (_, i) => [i + 1, 0x11, 0]).flat();
  const sofN = segmento(p.sof ?? 0xc0, [
    p.precisao ?? 8,
    p.altura >> 8,
    p.altura & 0xff,
    p.largura >> 8,
    p.largura & 0xff,
    componentes,
    ...porComponente,
  ]);
  const sos = segmento(0xda, [1, 1, 0, 0, 0x3f, 0]);
  return new Uint8Array([0xff, 0xd8, ...(p.antes ?? []), ...app0, ...dht, ...sofN, ...sos, 0x55, 0x55, 0xff, 0xd9]);
}

describe("o cabeçalho do JPEG: as medidas, os componentes e a precisão", () => {
  it("os dois JPEGs de verdade do ffmpeg: baseline, 3 componentes, 8 bits", () => {
    expect(cabecalhoDoJpeg(FOTO_A)).toEqual({ largura: 16, altura: 20, componentes: 3, precisao: 8 });
    expect(cabecalhoDoJpeg(FOTO_B)).toEqual({ largura: 20, altura: 16, componentes: 3, precisao: 8 });
  });

  it("o progressivo (SOF2), o cinza (1 componente), o CMYK (4) e o de 12 bits", () => {
    expect(cabecalhoDoJpeg(jpeg({ largura: 1080, altura: 1350, sof: 0xc2 }))).toEqual({ largura: 1080, altura: 1350, componentes: 3, precisao: 8 });
    expect(cabecalhoDoJpeg(jpeg({ largura: 600, altura: 600, componentes: 1 }))).toMatchObject({ componentes: 1 });
    expect(cabecalhoDoJpeg(jpeg({ largura: 600, altura: 600, componentes: 4 }))).toMatchObject({ componentes: 4 });
    expect(cabecalhoDoJpeg(jpeg({ largura: 600, altura: 600, precisao: 12 }))).toMatchObject({ precisao: 12 });
  });

  it("o SOF depois de segmentos grandes (um EXIF e um perfil de cor de 60 KB cada, 120 KB antes dele) ainda é achado", () => {
    // UM SEGMENTO VAI ATÉ 64 KB (o tamanho tem dois bytes); a foto de celular com perfil de cor leva vários.
    const exif = segmento(0xe1, Array(60_000).fill(0x20));
    const perfil = segmento(0xe2, Array(60_000).fill(0x21));
    expect(cabecalhoDoJpeg(jpeg({ largura: 1080, altura: 1080, antes: [...exif, ...perfil] }))).toMatchObject({ largura: 1080, altura: 1080 });
  });

  it("o que não é JPEG, ou o JPEG cortado antes do SOF, não tem cabeçalho", () => {
    expect(cabecalhoDoJpeg(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]))).toBeNull();
    expect(cabecalhoDoJpeg(FOTO_A.slice(0, 40))).toBeNull();
    expect(cabecalhoDoJpeg(new Uint8Array())).toBeNull();
  });

  it("as medidas do gerador continuam as mesmas", () => {
    expect(medidasDoJpeg(FOTO_A)).toEqual({ largura: 16, altura: 20 });
  });
});

/** O PDF como texto (latin1), para achar as marcas; as fotos entram como bytes, e a busca delas é pelos bytes. */
const comoTexto = (b: Uint8Array) => Buffer.from(b).toString("latin1");

describe("o PDF de fotos", () => {
  it("uma página por foto, na ordem, cada uma do tamanho da foto, com o JPEG dentro como está", () => {
    const pdf = pdfDeFotos([FOTO_A, FOTO_B]);
    const t = comoTexto(pdf);
    expect(t.startsWith("%PDF-1.4\n")).toBe(true);
    expect(t.endsWith("%%EOF\n")).toBe(true);
    expect(t).toContain("/Type /Pages /Kids [3 0 R 6 0 R] /Count 2");
    expect(t).toContain("/MediaBox [0 0 16 20]");
    expect(t).toContain("/MediaBox [0 0 20 16]");
    expect(t.indexOf("/MediaBox [0 0 16 20]")).toBeLessThan(t.indexOf("/MediaBox [0 0 20 16]"));
    expect(t.match(/\/Filter \/DCTDecode/g)?.length).toBe(2);
    expect(t.match(/\/ColorSpace \/DeviceRGB/g)?.length).toBe(2);
    // O JPEG ENTRA COMO ESTÁ, byte a byte, sem recomprimir.
    expect(Buffer.from(pdf).indexOf(Buffer.from(FOTO_A))).toBeGreaterThan(0);
    expect(Buffer.from(pdf).indexOf(Buffer.from(FOTO_B))).toBeGreaterThan(Buffer.from(pdf).indexOf(Buffer.from(FOTO_A)));
  });

  it("a tabela de posições aponta para cada objeto, e o startxref para a tabela", () => {
    const pdf = pdfDeFotos([FOTO_A, FOTO_B]);
    const t = comoTexto(pdf);
    const inicioDaTabela = Number(/startxref\n(\d+)\n%%EOF\n$/.exec(t)?.[1]);
    expect(t.slice(inicioDaTabela, inicioDaTabela + 5)).toBe("xref\n");
    const cabeca = /^xref\n0 (\d+)\n/.exec(t.slice(inicioDaTabela));
    const total = Number(cabeca?.[1]);
    expect(total).toBe(1 + 2 + 2 * 3);
    const linhas = t.slice(inicioDaTabela + (cabeca?.[0].length ?? 0)).split("\n").slice(0, total);
    expect(linhas[0]).toBe("0000000000 65535 f ");
    for (let n = 1; n < total; n++) {
      const posicao = Number(linhas[n].slice(0, 10));
      expect(linhas[n].endsWith(" 00000 n ")).toBe(true);
      expect(t.slice(posicao, posicao + `${n} 0 obj`.length)).toBe(`${n} 0 obj`);
    }
    expect(t).toContain(`trailer\n<< /Size ${total} /Root 1 0 R >>`);
  });

  it("o tamanho do fluxo da foto é o do JPEG, e o do desenho da página é o do texto dele", () => {
    const t = comoTexto(pdfDeFotos([FOTO_A]));
    expect(t).toContain(`/Length ${FOTO_A.length} >>\nstream\n`);
    const desenho = "q 16 0 0 20 0 0 cm /Im0 Do Q";
    expect(t).toContain(`<< /Length ${desenho.length} >>\nstream\n${desenho}\nendstream`);
  });

  it("a foto em tons de cinza vai como cinza", () => {
    expect(comoTexto(pdfDeFotos([jpeg({ largura: 8, altura: 8, componentes: 1 })]))).toContain("/ColorSpace /DeviceGray");
  });

  it("recusa, com o número da foto, o CMYK, o de 12 bits e o que não é JPEG; e recusa a lista vazia", () => {
    expect(() => pdfDeFotos([FOTO_A, jpeg({ largura: 8, altura: 8, componentes: 4 })])).toThrow(/foto 2/);
    expect(() => pdfDeFotos([jpeg({ largura: 8, altura: 8, precisao: 12 })])).toThrow(/foto 1/);
    expect(() => pdfDeFotos([FOTO_A, new Uint8Array([1, 2, 3])])).toThrow(/foto 2/);
    expect(() => pdfDeFotos([])).toThrow();
  });
});

describe("o título do documento no LinkedIn: o começo do texto (a decisão do Eduardo, 11/11)", () => {
  it("o texto curto vai inteiro, numa linha só, sem os espaços das pontas", () => {
    expect(tituloDoDocumento("  Cinco dicas\npara o seu   perfil  ")).toBe("Cinco dicas para o seu perfil");
  });

  it("o texto longo é cortado no fim de uma palavra, com reticências, em até 100 caracteres", () => {
    const longo = "Palavra ".repeat(30).trim();
    const titulo = tituloDoDocumento(longo);
    expect(Array.from(titulo).length).toBeLessThanOrEqual(100);
    expect(titulo.endsWith("Palavra…")).toBe(true);
    expect(titulo).not.toContain(" …");
  });

  it("uma palavra só, maior que 100, é cortada no meio, com reticências", () => {
    const titulo = tituloDoDocumento("x".repeat(150));
    expect(titulo).toBe(`${"x".repeat(99)}…`);
  });

  it("o texto de exatos 100 caracteres não ganha reticências", () => {
    const cem = `${"a".repeat(49)} ${"b".repeat(50)}`;
    expect(tituloDoDocumento(cem)).toBe(cem);
  });
});

describe("o carrossel no LinkedIn: só fotos, até 15 MB no total", () => {
  it("o teto é 15 MB", () => {
    expect(TETO_DO_CARROSSEL_NO_LINKEDIN_BYTES).toBe(15 * 1024 * 1024);
  });

  it("um vídeo no carrossel não vai ao LinkedIn; o total acima do teto também não; o resto passa", () => {
    expect(problemaDoCarrosselNoLinkedin([{ video: false, bytes: 1000 }, { video: true, bytes: 1000 }])).toBe("video");
    expect(
      problemaDoCarrosselNoLinkedin([
        { video: false, bytes: TETO_DO_CARROSSEL_NO_LINKEDIN_BYTES },
        { video: false, bytes: 1 },
      ])
    ).toBe("grande");
    expect(problemaDoCarrosselNoLinkedin([{ video: false, bytes: TETO_DO_CARROSSEL_NO_LINKEDIN_BYTES - 1 }, { video: false, bytes: 1 }])).toBeNull();
  });

  it("cada problema tem a sua frase", () => {
    expect(textoDoProblemaDoCarrosselNoLinkedin("video")).toBe("O carrossel do LinkedIn vai como PDF, só com fotos.");
    expect(textoDoProblemaDoCarrosselNoLinkedin("grande")).toBe(
      "As fotos do carrossel passam de 15 MB juntas, o limite do LinkedIn neste painel. Tire fotos ou use fotos menores."
    );
  });
});

describe("o JPEG que pode ir cru com o LinkedIn marcado", () => {
  it("só o de 1 ou 3 componentes (cinza ou cor de tela); o CMYK e o que não deu para ler passam pelo canvas", () => {
    expect(vaiCruParaOLinkedin(1)).toBe(true);
    expect(vaiCruParaOLinkedin(3)).toBe(true);
    for (const outro of [0, 2, 4]) expect(vaiCruParaOLinkedin(outro)).toBe(false);
  });
});

describe("o botão diz onde o post sai (o achado 215)", () => {
  it("com as caixinhas na tela, o botão diz as redes marcadas, e o verbo segue o Quando", () => {
    expect(textoDoBotaoDePublicar({ comRedes: true, instagram: true, linkedin: false, agendar: false })).toBe("Publicar no Instagram");
    expect(textoDoBotaoDePublicar({ comRedes: true, instagram: false, linkedin: true, agendar: false })).toBe("Publicar no LinkedIn");
    expect(textoDoBotaoDePublicar({ comRedes: true, instagram: true, linkedin: true, agendar: false })).toBe(
      "Publicar no Instagram e no LinkedIn"
    );
    expect(textoDoBotaoDePublicar({ comRedes: true, instagram: false, linkedin: true, agendar: true })).toBe("Agendar no LinkedIn");
    expect(textoDoBotaoDePublicar({ comRedes: true, instagram: true, linkedin: true, agendar: true })).toBe(
      "Agendar no Instagram e no LinkedIn"
    );
  });

  it("sem nenhuma rede marcada, ou sem as caixinhas (a conta sem LinkedIn), o botão é o de antes", () => {
    expect(textoDoBotaoDePublicar({ comRedes: true, instagram: false, linkedin: false, agendar: false })).toBe("Publicar");
    expect(textoDoBotaoDePublicar({ comRedes: false, instagram: true, linkedin: false, agendar: false })).toBe("Publicar");
    expect(textoDoBotaoDePublicar({ comRedes: false, instagram: true, linkedin: false, agendar: true })).toBe("Publicar");
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-carrossel-pdf"; cd "$C" || exit 1
npx --no-install vitest run tests/linkedin-carrossel-regras.test.ts 2>&1 | tee ../el3a-f1-red-puros.log
```

Esperado: "Test Files 1 failed (1)" e "Tests no tests", com "Error: Cannot find package '@/lib/pdf-de-fotos'": o arquivo do PDF ainda não existe, e nenhum caso chega a rodar.

- [ ] **Passo 3: o código**

Crie `lib/pdf-de-fotos.ts`:

```ts
// O PDF DE FOTOS DO CARROSSEL NO LINKEDIN (a parte 3a; scratchpad/desenho-li3.md, §6). PURO, SEM DEPENDÊNCIA.
//
// O LinkedIn publica o carrossel como documento: um PDF, uma página por foto, que a pessoa passa com a seta. A
// decisão do Eduardo pela caixa, em 11/11 ("Montado pelo painel"), foi escrever o PDF aqui, e não pôr uma biblioteca:
// a que a spec citava está sem mudança no registro desde 2022 e tem 19,5 MB. Um PDF de fotos é pequeno: um catálogo,
// a árvore das páginas e, por página, a página, o desenho dela e a imagem.
//
// O JPEG ENTRA COMO ESTÁ (o filtro /DCTDecode do próprio PDF): sem recomprimir, sem perder qualidade e sem gastar
// processamento além de juntar os bytes. As medidas e as cores saem do cabeçalho do JPEG (`cabecalhoDoJpeg`). A
// página tem o tamanho da foto, um ponto por pixel: quem mostra o PDF o escala, e a proporção é o que conta.
//
// SÓ CINZA E COR DE TELA (1 ou 3 componentes), DE 8 BITS. O CMYK de gráfica pediria a inversão do Adobe, que nem todo
// leitor faz igual, e o de 12 bits não é aceito pelo filtro em todo lugar. A tela de publicar converte para JPEG de
// cor de tela, pelo canvas, toda foto que não sirva quando o LinkedIn está marcado (`vaiCruParaOLinkedin`), então
// esta recusa só se alcança por um pedido montado à mão.
import { cabecalhoDoJpeg } from "./bonus/imagem-jpeg";

const ESPACO_DE_COR: Record<number, string> = { 1: "/DeviceGray", 3: "/DeviceRGB" };

/** Monta o PDF, uma página por foto, na ordem. Lança com o número da foto (a partir de 1) que não serve. */
export function pdfDeFotos(fotos: readonly Uint8Array[]): Uint8Array {
  if (fotos.length === 0) throw new Error("o PDF precisa de ao menos uma foto");
  const paginas = fotos.map((foto, i) => {
    const c = cabecalhoDoJpeg(foto);
    const cor = c ? ESPACO_DE_COR[c.componentes] : undefined;
    if (!c || !cor || c.precisao !== 8) {
      throw new Error(`a foto ${i + 1} não é um JPEG de 8 bits em cor de tela (RGB) ou em tons de cinza`);
    }
    return { foto, largura: c.largura, altura: c.altura, cor };
  });

  // OS OBJETOS: 1 o catálogo, 2 as páginas, e três por página (a página, o desenho dela e a imagem).
  const pedacos: Uint8Array[] = [];
  const posicoes: number[] = [];
  let tamanho = 0;
  const escrever = (parte: string | Uint8Array) => {
    const bytes = typeof parte === "string" ? latin1(parte) : parte;
    pedacos.push(bytes);
    tamanho += bytes.length;
  };
  const objeto = (numero: number, ...partes: (string | Uint8Array)[]) => {
    posicoes[numero] = tamanho;
    escrever(`${numero} 0 obj\n`);
    for (const parte of partes) escrever(parte);
    escrever("\nendobj\n");
  };

  // O CABEÇALHO E A LINHA COM BYTES ACIMA DE 127, que diz aos programas que o arquivo é binário.
  escrever("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n");
  const numeroDaPagina = (i: number) => 3 + i * 3;
  objeto(1, "<< /Type /Catalog /Pages 2 0 R >>");
  objeto(2, `<< /Type /Pages /Kids [${paginas.map((_, i) => `${numeroDaPagina(i)} 0 R`).join(" ")}] /Count ${paginas.length} >>`);
  paginas.forEach((p, i) => {
    const pagina = numeroDaPagina(i);
    const desenho = `q ${p.largura} 0 0 ${p.altura} 0 0 cm /Im0 Do Q`;
    objeto(
      pagina,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${p.largura} ${p.altura}] ` +
        `/Resources << /XObject << /Im0 ${pagina + 2} 0 R >> >> /Contents ${pagina + 1} 0 R >>`
    );
    objeto(pagina + 1, `<< /Length ${desenho.length} >>\nstream\n${desenho}\nendstream`);
    objeto(
      pagina + 2,
      `<< /Type /XObject /Subtype /Image /Width ${p.largura} /Height ${p.altura} /ColorSpace ${p.cor} ` +
        `/BitsPerComponent 8 /Filter /DCTDecode /Length ${p.foto.length} >>\nstream\n`,
      p.foto,
      "\nendstream"
    );
  });

  // A TABELA DE POSIÇÕES: cada linha tem exatos 20 bytes, com o espaço antes da quebra.
  const total = 3 + paginas.length * 3;
  const inicioDaTabela = tamanho;
  escrever(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let n = 1; n < total; n++) escrever(`${String(posicoes[n]).padStart(10, "0")} 00000 n \n`);
  escrever(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${inicioDaTabela}\n%%EOF\n`);

  const pdf = new Uint8Array(tamanho);
  let onde = 0;
  for (const p of pedacos) {
    pdf.set(p, onde);
    onde += p.length;
  }
  return pdf;
}

/** O texto das marcas do PDF, um byte por caractere (todas são ASCII, fora a linha binária do cabeçalho). */
function latin1(texto: string): Uint8Array {
  const b = new Uint8Array(texto.length);
  for (let i = 0; i < texto.length; i++) b[i] = texto.charCodeAt(i) & 0xff;
  return b;
}
```

Em `lib/bonus/imagem-jpeg.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/imagem-jpeg.ts b/lib/bonus/imagem-jpeg.ts
index 8b3a26c..ec11c80 100644
--- a/lib/bonus/imagem-jpeg.ts
+++ b/lib/bonus/imagem-jpeg.ts
@@ -18,6 +18,18 @@ const ehSof = (marca: number) => marca >= 0xc0 && marca <= 0xcf && marca !== 0xc
  * JPEG começa por FF D8; depois do SOS (DA) vêm os dados da imagem, e as medidas já teriam aparecido.
  */
 export function medidasDoJpeg(b: Uint8Array): MedidasDoJpeg | null {
+  const c = cabecalhoDoJpeg(b);
+  return c ? { largura: c.largura, altura: c.altura } : null;
+}
+
+/**
+ * O CABEÇALHO DO JPEG, lido do mesmo segmento SOF: as medidas, os componentes de cor (1 é cinza, 3 é a cor de tela,
+ * 4 é o CMYK da gráfica) e a precisão em bits. É o que o PDF de fotos do LinkedIn precisa para pôr a foto como ela
+ * está (a parte 3a: lib/pdf-de-fotos.ts), e o que a tela de publicar lê para decidir se a foto vai crua.
+ */
+export type CabecalhoDoJpeg = MedidasDoJpeg & { componentes: number; precisao: number };
+
+export function cabecalhoDoJpeg(b: Uint8Array): CabecalhoDoJpeg | null {
   if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
   let i = 2;
   while (i + 4 <= b.length) {
@@ -31,10 +43,12 @@ export function medidasDoJpeg(b: Uint8Array): MedidasDoJpeg | null {
     const tamanho = (b[i + 2] << 8) | b[i + 3];
     if (tamanho < 2) return null;
     if (ehSof(marca)) {
-      if (i + 9 > b.length) return null;
+      if (i + 10 > b.length) return null;
+      const precisao = b[i + 4];
       const altura = (b[i + 5] << 8) | b[i + 6];
       const largura = (b[i + 7] << 8) | b[i + 8];
-      return largura > 0 && altura > 0 ? { largura, altura } : null;
+      const componentes = b[i + 9];
+      return largura > 0 && altura > 0 ? { largura, altura, componentes, precisao } : null;
     }
     i += 2 + tamanho;
   }
```

Em `lib/linkedin-publicacao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/linkedin-publicacao.ts b/lib/linkedin-publicacao.ts
index 3a22131..eb182fa 100644
--- a/lib/linkedin-publicacao.ts
+++ b/lib/linkedin-publicacao.ts
@@ -357,3 +357,61 @@ export function motivoDaAutorizacaoRecusada(nome: string): string {
 export function oPostPodeTerSaido(status: number): boolean {
   return !(status >= 400 && status < 500);
 }
+
+// ---------------------------------------------------------------------------------------------------------------
+// O CARROSSEL EM PDF (a parte 3a; scratchpad/desenho-li3.md, §6)
+// ---------------------------------------------------------------------------------------------------------------
+
+/** O título do documento no LinkedIn tem no máximo 100 caracteres: o limite não está na página, e a escolha é nossa. */
+export const TITULO_DO_DOCUMENTO_MAX = 100;
+
+/**
+ * O TÍTULO DO DOCUMENTO, obrigatório no post com documento ("The media title (Required field for Documents API)", o
+ * Post schema). O LinkedIn o mostra em cima do carrossel no feed. A decisão do Eduardo pela caixa, em 11/11, foi "O
+ * começo do texto": o texto do post numa linha só, até 100 caracteres, cortado no fim de uma palavra, com reticências
+ * quando cortado. Uma palavra só, maior que o limite, é cortada no meio.
+ */
+export function tituloDoDocumento(texto: string): string {
+  const linha = texto.replace(/\s+/g, " ").trim();
+  const letras = Array.from(linha);
+  if (letras.length <= TITULO_DO_DOCUMENTO_MAX) return linha;
+  const cabe = letras.slice(0, TITULO_DO_DOCUMENTO_MAX - 1).join("");
+  const ultimoEspaco = cabe.lastIndexOf(" ");
+  return `${ultimoEspaco > 0 ? cabe.slice(0, ultimoEspaco) : cabe}…`;
+}
+
+/**
+ * O TETO DO CARROSSEL NO LINKEDIN, somando as fotos que subiram: 15 MB. A vazão do bucket e a do envio ao LinkedIn,
+ * a partir da Vercel, não foram medidas; com 15 MB, baixar em 10 s pede ~12 Mbit/s e subir em 25 s pede ~4,8 Mbit/s,
+ * a mesma ordem que a imagem já supõe (lib/linkedin.ts, `TETO_DO_ENVIO_DA_IMAGEM_MS`). A prova leva um carrossel perto
+ * do teto, e ele só sobe depois dessa medida.
+ */
+export const TETO_DO_CARROSSEL_NO_LINKEDIN_BYTES = 15 * 1024 * 1024;
+
+export type ProblemaDoCarrosselNoLinkedin = "video" | "grande";
+
+/**
+ * O CARROSSEL QUE NÃO VAI AO LINKEDIN: o PDF só leva fotos (o carrossel do Instagram aceita vídeo nos itens), e as
+ * fotos juntas têm de caber no teto. A tela confere os itens antes de subir (o vídeo) e o total depois da conversão
+ * (o tamanho que de fato sobe); o dreno confere de novo o que baixou.
+ */
+export function problemaDoCarrosselNoLinkedin(itens: readonly { video: boolean; bytes: number }[]): ProblemaDoCarrosselNoLinkedin | null {
+  if (itens.some((i) => i.video)) return "video";
+  const total = itens.reduce((soma, i) => soma + i.bytes, 0);
+  return total > TETO_DO_CARROSSEL_NO_LINKEDIN_BYTES ? "grande" : null;
+}
+
+export function textoDoProblemaDoCarrosselNoLinkedin(p: ProblemaDoCarrosselNoLinkedin): string {
+  return p === "video"
+    ? "O carrossel do LinkedIn vai como PDF, só com fotos."
+    : "As fotos do carrossel passam de 15 MB juntas, o limite do LinkedIn neste painel. Tire fotos ou use fotos menores.";
+}
+
+/**
+ * O JPEG QUE PODE IR CRU, SEM O CANVAS, QUANDO O LINKEDIN ESTÁ MARCADO NO CARROSSEL: só o de 1 ou 3 componentes (cinza
+ * ou cor de tela), que o PDF de fotos aceita como está (lib/pdf-de-fotos.ts). O CMYK de gráfica, e o que não deu para
+ * ler (0), passam pelo canvas, que devolve cor de tela. Sem o LinkedIn, a regra do Instagram não muda.
+ */
+export function vaiCruParaOLinkedin(componentes: number): boolean {
+  return componentes === 1 || componentes === 3;
+}
```

Em `lib/redes-do-post.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/redes-do-post.ts b/lib/redes-do-post.ts
index 54a1b67..e7dfef9 100644
--- a/lib/redes-do-post.ts
+++ b/lib/redes-do-post.ts
@@ -168,3 +168,16 @@ export function avisoDasDuasRedes(d: DesfechoDasDuasRedes): Aviso {
     texto: `Instagram: ${doInstagram} LinkedIn: ${doLinkedin.texto}`,
   };
 }
+
+/**
+ * O BOTÃO DIZ ONDE O POST SAI (o achado 215; a decisão do Eduardo pela caixa, em 11/11: "O botão diz as redes").
+ * Com as caixinhas na tela, o botão diz as redes marcadas, e o verbo segue o "Quando": "Agendar" no "depois", e
+ * "Publicar" no resto. Quem marcou só o LinkedIn lê isso no próprio clique. Sem rede marcada, ou sem as caixinhas (a
+ * conta sem o LinkedIn na página), o botão é o de antes, "Publicar".
+ */
+export function textoDoBotaoDePublicar(p: { comRedes: boolean; instagram: boolean; linkedin: boolean; agendar: boolean }): string {
+  if (!p.comRedes || (!p.instagram && !p.linkedin)) return "Publicar";
+  const verbo = p.agendar ? "Agendar" : "Publicar";
+  if (p.instagram && p.linkedin) return `${verbo} no Instagram e no LinkedIn`;
+  return p.instagram ? `${verbo} no Instagram` : `${verbo} no LinkedIn`;
+}
```

- [ ] **Passo 4: rodar e ver passar**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-carrossel-pdf"; cd "$C" || exit 1
npx --no-install vitest run tests/linkedin-carrossel-regras.test.ts 2>&1 | tee ../el3a-f1-green-puros.log
npx --no-install vitest run 2>&1 | tee ../el3a-f1-suite.log
npx --no-install tsc --noEmit
npx --no-install eslint lib/bonus/imagem-jpeg.ts lib/linkedin-publicacao.ts lib/pdf-de-fotos.ts lib/redes-do-post.ts tests/linkedin-carrossel-regras.test.ts
git diff --name-only 40b2aec -- lib/queue-drain.ts lib/fila-tipos.ts migrations scripts package.json package-lock.json   # vazio
```

Esperado: "Test Files 1 passed (1)" e "Tests 20 passed (20)"; a suíte pura inteira: "Test Files 160 passed (160)" e "Tests 3804 passed (3804)". No ensaio, a primeira suíte pura da cópia nova caiu pelo 227 (ver as restrições), e a segunda deu esse número. O `tsc` e o lint sem saída, e a guarda vazia.

- [ ] **Passo 5: o commit**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-carrossel-pdf"; cd "$C" || exit 1
node ../varrer-texto.mjs lib/bonus/imagem-jpeg.ts lib/linkedin-publicacao.ts lib/pdf-de-fotos.ts lib/redes-do-post.ts tests/linkedin-carrossel-regras.test.ts && test "$(git branch --show-current)" = linkedin-carrossel-pdf && git add lib/bonus/imagem-jpeg.ts lib/linkedin-publicacao.ts lib/pdf-de-fotos.ts lib/redes-do-post.ts tests/linkedin-carrossel-regras.test.ts && git commit -m "O carrossel do LinkedIn ganha as regras puras: as cores do cabeçalho do JPEG, o PDF de fotos sem dependência, o título pelo começo do texto, o teto de 15 MB e o botão que diz as redes"
git show HEAD | git patch-id --stable | cut -c1-12   # 48d90a10bbfa
```

O patch-id tem de começar por `48d90a10bbfa` (o mesmo do plano de 12/11). Se não começar, pare.

---

### FASE 2 — O cliente do LinkedIn reserva e envia o documento, e o post leva o documento com o título

**Arquivos:** `lib/linkedin-publicacao.ts`, `lib/linkedin.ts`, `tests/linkedin-post.test.ts`, `tests/linkedin-rest.test.ts`.

- [ ] **Passo 1: os testes**

Em `tests/linkedin-rest.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/linkedin-rest.test.ts b/tests/linkedin-rest.test.ts
index b8cb77b..d463616 100644
--- a/tests/linkedin-rest.test.ts
+++ b/tests/linkedin-rest.test.ts
@@ -2,10 +2,13 @@ import { afterEach, describe, expect, it, vi } from "vitest";
 import {
   criarPost,
   enderecoDeEnvioConfiavel,
+  enviarDocumento,
   enviarImagem,
   LINKEDIN_VERSION,
   nomeLimpo,
+  reservarDocumento,
   TETO_DO_ENVIO_DA_IMAGEM_MS,
+  TETO_DO_ENVIO_DO_DOCUMENTO_MS,
   TETO_DO_LINKEDIN_MS,
 } from "@/lib/linkedin";
 import { chaveDaPublicacaoNoLinkedin, publicacaoKey } from "@/lib/dedupe";
@@ -108,3 +111,77 @@ describe("a chave da linha do LinkedIn na fila", () => {
     );
   });
 });
+
+// O DOCUMENTO DO CARROSSEL (a parte 3a; scratchpad/desenho-li3.md, §6). A Documents API: a reserva com a pessoa dona
+// devolve o endereço de envio e o URN do documento; o envio é um PUT só, com a autorização, como o exemplo da página
+// ("curl --upload-file" com o "Authorization: Bearer"), e o mesmo cuidado do domínio da imagem. O envio leva até os
+// 15 MB do carrossel, e o teto dele é de 25 s.
+describe("a reserva e o envio do documento do carrossel", () => {
+  function gravarOsPedidos(resposta: () => Response) {
+    const pedidos: { url: string; init: RequestInit }[] = [];
+    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
+      pedidos.push({ url, init });
+      return resposta();
+    });
+    return pedidos;
+  }
+
+  it("a reserva pede o documento com a pessoa dona, e devolve o endereço e o URN", async () => {
+    const pedidos = gravarOsPedidos(
+      () =>
+        new Response(
+          JSON.stringify({ value: { uploadUrl: "https://www.linkedin.com/dms-uploads/D5510/doc/0?ca=x", document: "urn:li:document:D5510X" } }),
+          { status: 200 }
+        )
+    );
+    expect(await reservarDocumento("token-de-teste", "pessoaX")).toEqual({
+      uploadUrl: "https://www.linkedin.com/dms-uploads/D5510/doc/0?ca=x",
+      documentoUrn: "urn:li:document:D5510X",
+    });
+    expect(pedidos).toHaveLength(1);
+    expect(pedidos[0].url.endsWith("/rest/documents?action=initializeUpload")).toBe(true);
+    expect(JSON.parse(String(pedidos[0].init.body))).toEqual({ initializeUploadRequest: { owner: "urn:li:person:pessoaX" } });
+    expect((pedidos[0].init.headers as Record<string, string>)["linkedin-version"]).toBe(LINKEDIN_VERSION);
+  });
+
+  it("a reserva que não devolve o URN de documento é um erro do LinkedIn", async () => {
+    gravarOsPedidos(() => new Response(JSON.stringify({ value: { uploadUrl: "https://www.linkedin.com/x", document: "urn:li:image:Y" } }), { status: 200 }));
+    await expect(reservarDocumento("token-de-teste", "pessoaX")).rejects.toMatchObject({ name: "LinkedinError", status: 200 });
+    gravarOsPedidos(() => new Response("{}", { status: 403 }));
+    await expect(reservarDocumento("token-de-teste", "pessoaX")).rejects.toMatchObject({ name: "LinkedinError", status: 403 });
+  });
+
+  it("o envio é um PUT com a autorização e os bytes do PDF, com o teto de 25 s", async () => {
+    expect(TETO_DO_ENVIO_DO_DOCUMENTO_MS).toBe(25_000);
+    const tetos: number[] = [];
+    const original = AbortSignal.timeout.bind(AbortSignal);
+    vi.spyOn(AbortSignal, "timeout").mockImplementation((ms: number) => {
+      tetos.push(ms);
+      return original(ms);
+    });
+    const pedidos = gravarOsPedidos(() => new Response("", { status: 201 }));
+    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
+    await enviarDocumento("https://www.linkedin.com/dms-uploads/D5510/doc/0?ca=x", "token-de-teste", pdf);
+    expect(tetos).toEqual([TETO_DO_ENVIO_DO_DOCUMENTO_MS]);
+    expect(pedidos[0].init.method).toBe("PUT");
+    expect((pedidos[0].init.headers as Record<string, string>).authorization).toBe("Bearer token-de-teste");
+    expect(pedidos[0].init.body).toBe(pdf);
+  });
+
+  it("o envio para um endereço que não é do LinkedIn não sai, e a autorização não vai", async () => {
+    const pedidos = gravarOsPedidos(() => new Response("", { status: 201 }));
+    await expect(enviarDocumento("https://www.exemplo.com/doc", "token-de-teste", new Uint8Array(4))).rejects.toMatchObject({
+      name: "LinkedinError",
+      status: 0,
+    });
+    expect(pedidos).toHaveLength(0);
+  });
+
+  it("o envio recusado pelo LinkedIn é um erro com o status", async () => {
+    gravarOsPedidos(() => new Response("negado", { status: 400 }));
+    await expect(enviarDocumento("https://www.linkedin.com/dms-uploads/D5510/doc/0", "token-de-teste", new Uint8Array(4))).rejects.toMatchObject({
+      name: "LinkedinError",
+      status: 400,
+    });
+  });
+});
```

Em `tests/linkedin-post.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/linkedin-post.test.ts b/tests/linkedin-post.test.ts
index 607a329..954bc80 100644
--- a/tests/linkedin-post.test.ts
+++ b/tests/linkedin-post.test.ts
@@ -173,3 +173,15 @@ describe("o link para ver o post no LinkedIn", () => {
     }
   });
 });
+
+// O POST COM O DOCUMENTO DO CARROSSEL (a parte 3a): o conteúdo leva o URN do documento e o título, que é
+// obrigatório no documento ("The media title (Required field for Documents API)", o Post schema).
+describe("o corpo do POST /rest/posts com o documento do carrossel", () => {
+  it("o conteúdo leva o documento e o título", () => {
+    expect(corpoDoPost({ pessoaId: "abc", texto: "x", documento: { urn: "urn:li:document:D", titulo: "Cinco dicas" } })).toMatchObject({
+      author: "urn:li:person:abc",
+      commentary: "x",
+      content: { media: { id: "urn:li:document:D", title: "Cinco dicas" } },
+    });
+  });
+});
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-carrossel-pdf"; cd "$C" || exit 1
npx --no-install vitest run tests/linkedin-rest.test.ts tests/linkedin-post.test.ts 2>&1 | tee ../el3a-f2-red-puros.log
```

Esperado: "Test Files 2 failed (2)" e "Tests 6 failed | 26 passed (32)". Caem os 5 casos de "a reserva e o envio do documento do carrossel" (as funções ainda não existem) e "o conteúdo leva o documento e o título".

- [ ] **Passo 3: o código**

Em `lib/linkedin.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/linkedin.ts b/lib/linkedin.ts
index 55c683b..6c3ef29 100644
--- a/lib/linkedin.ts
+++ b/lib/linkedin.ts
@@ -26,6 +26,13 @@ export const TETO_DO_LINKEDIN_MS = 10_000;
  */
 export const TETO_DO_ENVIO_DA_IMAGEM_MS = 15_000;
 
+/**
+ * O teto do envio do documento do carrossel (a parte 3a), que leva até os 15 MB do carrossel
+ * (`TETO_DO_CARROSSEL_NO_LINKEDIN_BYTES`, ~4,8 Mbit/s em 25 s). A passada da mídia do carrossel (o bucket, a montagem
+ * do PDF, a reserva e este envio) soma 52 s com a folga, e só começa no início de uma função (lib/linkedin-fila.ts).
+ */
+export const TETO_DO_ENVIO_DO_DOCUMENTO_MS = 25_000;
+
 // AS BASES SÓ SE MOVEM NOS TESTES, sob as mesmas duas travas da `baseDoGraph` (lib/ig.ts): `VITEST=true`, que
 // `next build` e a Vercel não definem, e o loopback, e só ele (a autorização viaja nestas chamadas, e uma base
 // apontando para fora seria vazar a autorização por variável de ambiente). As duas bases vão juntas para o
@@ -245,6 +252,40 @@ export async function enviarImagem(uploadUrl: string, token: string, bytes: Arra
   if (r.status !== 200 && r.status !== 201) throw new LinkedinError(r.status, r.texto.slice(0, 300));
 }
 
+/**
+ * A RESERVA DO DOCUMENTO DO CARROSSEL (`POST /rest/documents?action=initializeUpload`, Documents API; a parte 3a),
+ * com a pessoa como dona ("For documents with person URN owners, the caller must match the document owner"). A sonda
+ * de 09/11 deu 200 nela. Devolve o endereço de envio e o URN do documento.
+ */
+export async function reservarDocumento(token: string, pessoaId: string): Promise<{ uploadUrl: string; documentoUrn: string }> {
+  const r = await chamar(`${basesDoLinkedin().api}/rest/documents?action=initializeUpload`, {
+    method: "POST",
+    headers: cabecalhosDoRest(token),
+    body: JSON.stringify({ initializeUploadRequest: { owner: `urn:li:person:${pessoaId}` } }),
+  });
+  if (r.status !== 200) throw new LinkedinError(r.status, r.texto.slice(0, 300));
+  const valor = json(r.texto)?.value as Record<string, unknown> | undefined;
+  const uploadUrl = valor?.uploadUrl;
+  const documentoUrn = valor?.document;
+  if (typeof uploadUrl !== "string" || typeof documentoUrn !== "string" || !documentoUrn.startsWith("urn:li:document:")) {
+    throw new LinkedinError(r.status, "a reserva do documento não devolveu o endereço e o URN");
+  }
+  return { uploadUrl, documentoUrn };
+}
+
+/**
+ * O ENVIO DO DOCUMENTO: um `PUT` só, dos bytes do PDF, com a autorização, como o exemplo da Documents API ("curl
+ * --upload-file" com o "Authorization: Bearer"). O endereço passa pela mesma regra do da imagem: só https de um
+ * domínio do LinkedIn recebe a autorização (os exemplos trazem `https://www.linkedin.com/dms-uploads/...`).
+ */
+export async function enviarDocumento(uploadUrl: string, token: string, bytes: Uint8Array<ArrayBuffer>): Promise<void> {
+  if (!enderecoDeEnvioConfiavel(uploadUrl)) {
+    throw new LinkedinError(0, "o endereço de envio do documento não é do LinkedIn");
+  }
+  const r = await chamar(uploadUrl, { method: "PUT", headers: { authorization: `Bearer ${token}` }, body: bytes }, TETO_DO_ENVIO_DO_DOCUMENTO_MS);
+  if (r.status !== 200 && r.status !== 201) throw new LinkedinError(r.status, r.texto.slice(0, 300));
+}
+
 /**
  * O POST (`POST /rest/posts`, Posts API): "You should get a 201 response and the response header x-restli-id
  * contains the Post ID". Devolve o URN do post.
```

Em `lib/linkedin-publicacao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/linkedin-publicacao.ts b/lib/linkedin-publicacao.ts
index eb182fa..b53a78d 100644
--- a/lib/linkedin-publicacao.ts
+++ b/lib/linkedin-publicacao.ts
@@ -308,9 +308,16 @@ export function lerPayloadDoLinkedin(bruto: unknown): LeituraDoPayloadDoLinkedin
 
 /**
  * O corpo do `POST /rest/posts` (Posts API): o autor é a pessoa, o texto já transformado, PÚBLICO (fixo nesta
- * entrega; não há escolha de visibilidade na tela), no feed, publicado, e a imagem quando há.
+ * entrega; não há escolha de visibilidade na tela), no feed, publicado, e a imagem quando há. O documento do
+ * carrossel (a parte 3a) vai com o título, que é obrigatório nele (`tituloDoDocumento`).
  */
-export function corpoDoPost(p: { pessoaId: string; texto: string; imagemUrn?: string }): Record<string, unknown> {
+export function corpoDoPost(p: {
+  pessoaId: string;
+  texto: string;
+  imagemUrn?: string;
+  documento?: { urn: string; titulo: string };
+}): Record<string, unknown> {
+  const media = p.imagemUrn ? { id: p.imagemUrn } : p.documento ? { id: p.documento.urn, title: p.documento.titulo } : null;
   return {
     author: `urn:li:person:${p.pessoaId}`,
     commentary: textoParaOLinkedin(p.texto),
@@ -318,7 +325,7 @@ export function corpoDoPost(p: { pessoaId: string; texto: string; imagemUrn?: st
     distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
     lifecycleState: "PUBLISHED",
     isReshareDisabledByAuthor: false,
-    ...(p.imagemUrn ? { content: { media: { id: p.imagemUrn } } } : {}),
+    ...(media ? { content: { media } } : {}),
   };
 }
 
```

- [ ] **Passo 4: rodar e ver passar**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-carrossel-pdf"; cd "$C" || exit 1
npx --no-install vitest run tests/linkedin-rest.test.ts tests/linkedin-post.test.ts 2>&1 | tee ../el3a-f2-green-puros.log
npx --no-install vitest run 2>&1 | tee ../el3a-f2-suite.log
npx --no-install tsc --noEmit
npx --no-install eslint lib/linkedin-publicacao.ts lib/linkedin.ts tests/linkedin-post.test.ts tests/linkedin-rest.test.ts
git diff --name-only 40b2aec -- lib/queue-drain.ts lib/fila-tipos.ts migrations scripts package.json package-lock.json   # vazio
```

Esperado: "Test Files 2 passed (2)" e "Tests 32 passed (32)"; a suíte pura inteira: "Test Files 160 passed (160)" e "Tests 3810 passed (3810)". O `tsc` e o lint sem saída, e a guarda vazia.

- [ ] **Passo 5: o commit**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-carrossel-pdf"; cd "$C" || exit 1
node ../varrer-texto.mjs lib/linkedin-publicacao.ts lib/linkedin.ts tests/linkedin-post.test.ts tests/linkedin-rest.test.ts && test "$(git branch --show-current)" = linkedin-carrossel-pdf && git add lib/linkedin-publicacao.ts lib/linkedin.ts tests/linkedin-post.test.ts tests/linkedin-rest.test.ts && git commit -m "O cliente do LinkedIn reserva e envia o documento do carrossel, e o post leva o documento com o título"
git show HEAD | git patch-id --stable | cut -c1-12   # c072013ab462
```

O patch-id tem de começar por `c072013ab462` (o mesmo do plano de 12/11). Se não começar, pare.

---

### FASE 3 — O carrossel sai pela fila: o PDF, o documento marcado, a mídia que o LinkedIn ainda processa e o 7º adiamento

**Arquivos:** `lib/linkedin-fila.ts`, `lib/linkedin-publicacao.ts`, `lib/pdf-de-fotos.ts`, `testes-integracao/dreno-forma-desconhecida.integracao.ts`, `testes-integracao/linkedin-carrossel.integracao.ts`, `testes-integracao/linkedin-telas.integracao.ts`, `tests/linkedin-compor.test.ts`, `tests/linkedin-forma-conhecida.test.ts`, `tests/linkedin-post.test.ts`.

A forma `"carrossel"` entra em `FORMAS_NO_LINKEDIN`, e com isso o dreno passa a pegá-la (o predicado da 3-0). Os testes da 3-0 que usavam "carrossel" como a forma que este código não conhece passam a usar "video".

- [ ] **Passo 1: os testes**

Crie `testes-integracao/linkedin-carrossel.integracao.ts`:

```ts
// O CARROSSEL EM PDF NO LINKEDIN PELA FILA (a parte 3a; scratchpad/desenho-li3.md, §6), contra o banco descartável:
// o ramo do carrossel no dreno do LinkedIn (lib/linkedin-fila.ts). As fotos baixadas do bucket, o PDF montado no
// painel (lib/pdf-de-fotos.ts), a reserva e o envio do documento, o post com o documento e o título, as marcas de
// cada passo, a espera do documento que o LinkedIn ainda processa, o teto de tempo da passada e o teto dos adiamentos.
//
// O LINKEDIN FALSO E O BUCKET FALSO: dois servidores HTTP na própria máquina, no molde de
// linkedin-publicacao.integracao.ts. As bases do LinkedIn (lib/linkedin.ts) e a SUPABASE_URL vão para eles, e as
// guardas conferem isso ANTES de qualquer requisição. O `fetch` é interceptado só neste arquivo e RECUSA qualquer
// endereço que não seja o loopback. **NADA AQUI CHAMA O LINKEDIN NEM O BUCKET DE VERDADE.** Valores inventados:
// nenhuma credencial de verdade entra em teste.
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

const CONTA = "17800000000031001";
const PESSOA = "pessoaDoCarrosselA1";
const TOKEN_DO_LINKEDIN = "AQVautorizacaoDoCarrosselQueNaoValeNada";
const BUCKET = "midia-do-carrossel";
const CHAVE_DO_BUCKET = "chave-do-bucket-do-carrossel-que-nao-vale-nada";

// DOIS JPEGS DE VERDADE, feitos pelo ffmpeg (testsrc, 16×20 e testsrc2, 20×16, yuvj420p): os mesmos de
// tests/linkedin-carrossel-regras.test.ts.
const FOTO_A = Buffer.from("/9j/4AAQSkZJRgABAgAAAQABAAD//gAPTGF2YzYzLjEuMTAyAP/bAEMACAoKCwoLDQ0NDQ0NEA8QEBAQEBAQEBAQEBISEhUVFRISEhAQEhIUFBUVFxcXFRUVFRcXGRkZHh4cHCMjJCsrM//EAHUAAQEBAQAAAAAAAAAAAAAAAAUGAgMBAQEBAAAAAAAAAAAAAAAAAAECAxAAAgECBAQFBQEAAAAAAAAAAgEDBBESBgAhMQUyQjPDgkEHIyKRYVFSEQABAgUFAQEBAAAAAAAAAAABAgMSEQQTIiEUAAUjMYEy/8AAEQgAFAAQAwEiAAIRAAMRAP/aAAwDAQACEQMRAD8AFdHzLKPLo/qqKstiNCo5BixMWg+4SEiQyNG1cb9Ldruoq66lybXRnBTt0ou0kQkRHhJAsQFKTbIXIRIWSRdLa2a1ngSrQZ0oupErYShTlEvC4MLp8Hw/mp7PZDUnIEBKYla4xtGS8Lihu/Z/jR2AtDqNlpe3e9sa3IbEG4gnOGNyCP8AmJUuLKjUuUiHZKcUK0OokApW3FeKe4gAElFimgKhObbZ+gc7ZSnq+bU0VPNVSgI3wuMIEQ2cn+oSXalunpPLFPS8/qnU1dPGikRIwjKYQfXvvKRJrB7Fbd/rRHx72erztO/HvZ6vO1PXeCXw15BRdiCMQrVX2GU/3mvYC3XJqEYPFFD7J0dybYizGWUzPXWZ5//Z", "base64");
const FOTO_B = Buffer.from("/9j/4AAQSkZJRgABAgAAAQABAAD//gAPTGF2YzYzLjEuMTAyAP/bAEMACBAQExATFhYWFhYWGhgaGxsbGhoaGhsbGx0dHSIiIh0dHRsbHR0gICIiJSYlIyMiIyYmKCgoMDAuLjg4OkVFU//EAHQAAQEBAQEAAAAAAAAAAAAAAAUEAQcGAQEBAQAAAAAAAAAAAAAAAAAFAwYQAAEDAwIDCQEBAAAAAAAAAAECAxEEEiEAURMiU6LSQTJhFDEVIzNSEQACAQIGAwEAAAAAAAAAAAABAhEDIQASIjEEBXFhI2L/wAARCAAQABQDASIAAhEAAxEA/9oADAMBAAIRAxEAPwDlxL63VIb8BcfKAABJJUrAHqTqp9Va9XKWrLhSFlUICbAgC6cItjE/E+ukWCD7tuL1K4Kg3MFYQZUAd42ztppbjZpzTWy7/T28m6ziX2T/AKs8PPGY1Gr2ld+RnUEWKjUSUSpkZjMjQIAIsDFzjSPRArFS5+bEg/oMQFG8NaRefWCBXV9OEoLluJHK2QQcyCEkEHcHW/a1vV7Dfd16GmqWaVlDbn5K5lcPmUUBSyUgkA5gj5zvq37Gl6nZX3dGt2PIDH5O1zqBaG9iJ38nzgOp1XEquzvUpZnYs2ZULSTJkkyTO84//9k=", "base64");
const FOTOS = [`${CONTA}/a.jpg`, `${CONTA}/b.jpg`];
const TEXTO = "Cinco dicas para o seu perfil no LinkedIn, uma por foto, do jeito que a gente usa no dia a dia #perfil";

type Pedido = { metodo: string; caminho: string; cabecalhos: IncomingMessage["headers"]; corpo: Buffer };

const linkedin = {
  pedidos: [] as Pedido[],
  posts: [] as Record<string, unknown>[],
  documentos: [] as Buffer[],
  /** A próxima resposta do POST /rest/posts, quando não é o sucesso. */
  respostaDoPost: null as null | { status: number; corpo: string },
  desconhecidos: [] as string[],
};
/** O que o bucket falso serve em cada caminho; sem entrada, 404. */
const bucket = { arquivos: new Map<string, Buffer>(), apagados: [] as string[], baixados: [] as string[] };

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
    if (req.method === "POST" && u.pathname === "/rest/documents" && u.searchParams.get("action") === "initializeUpload") {
      return responder(res, 200, {
        value: { uploadUrl: `http://127.0.0.1:${porta}/envio/D5510`, uploadUrlExpiresAt: 1999999999999, document: "urn:li:document:D5510Falso" },
      });
    }
    if (req.method === "PUT" && u.pathname === "/envio/D5510") {
      linkedin.documentos.push(corpo);
      return responder(res, 201, "");
    }
    if (req.method === "POST" && u.pathname === "/rest/posts") {
      const r = linkedin.respostaDoPost;
      if (r) {
        linkedin.respostaDoPost = null;
        return responder(res, r.status, r.corpo);
      }
      linkedin.posts.push(JSON.parse(corpo.toString()) as Record<string, unknown>);
      return responder(res, 201, "", { "x-restli-id": `urn:li:share:70000000000000003${linkedin.posts.length}` });
    }
    linkedin.desconhecidos.push(`${req.method} ${u.pathname}`);
    responder(res, 404, { message: "o LinkedIn falso não conhece esse caminho" });
  });

  servidorBucket = createServer((req, res) => {
    const u = new URL(req.url ?? "/", "http://127.0.0.1");
    const publico = `/storage/v1/object/public/${BUCKET}/`;
    const privado = `/storage/v1/object/${BUCKET}/`;
    if (req.method === "GET" && u.pathname.startsWith(publico)) {
      const caminho = decodeURIComponent(u.pathname.slice(publico.length));
      bucket.baixados.push(caminho);
      const bytes = bucket.arquivos.get(caminho);
      if (!bytes) return responder(res, 404, { message: "não existe" });
      res.writeHead(200, { "content-type": "image/jpeg" });
      return res.end(bytes);
    }
    if (req.method === "DELETE" && u.pathname.startsWith(privado)) {
      if (req.headers["apikey"] !== CHAVE_DO_BUCKET) return responder(res, 401, { message: "sem apikey" });
      bucket.apagados.push(decodeURIComponent(u.pathname.slice(privado.length)));
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
    username: "conta_do_carrossel",
    name: "Carrossel",
    profile_picture_url: null,
    access_token: "ig-token-do-carrossel",
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
  Object.assign(linkedin, { pedidos: [], posts: [], documentos: [], respostaDoPost: null, desconhecidos: [] });
  bucket.arquivos = new Map([
    [FOTOS[0], FOTO_A],
    [FOTOS[1], FOTO_B],
  ]);
  bucket.apagados = [];
  bucket.baixados = [];
  await q(`delete from queue`);
  await q(`delete from linkedin_conexoes`);
  await q(
    `insert into linkedin_conexoes (account_id, pessoa_id, nome, access_token, expira_em)
     values ($1, $2, 'Dra. Ana Souza', $3, now() + interval '60 days')`,
    [CONTA, PESSOA, TOKEN_DO_LINKEDIN]
  );
});

const ENVIO = "9f1c2e3d-0000-4000-8000-000000000031";

/** Enfileira o carrossel para agora e devolve o id da linha. */
async function enfileirarOCarrossel(caminhos = FOTOS): Promise<string> {
  const r = await fila.enqueuePublicacaoNoLinkedin(CONTA, { forma: "carrossel", caminhos, texto: TEXTO, idDoEnvio: ENVIO }, null);
  if (!r.entrou) throw new Error("o carrossel não entrou na fila");
  return r.id;
}

const linha = async (id: string) =>
  (await q(`select status, attempts, error, payload, not_before > now() + interval '50 seconds' as espera_um_minuto from queue where id = $1`, [id]))[0] as {
    status: string;
    attempts: number;
    error: string | null;
    payload: Record<string, unknown>;
    espera_um_minuto: boolean;
  };

const caminhosDoLinkedin = () => linkedin.pedidos.map((p) => `${p.metodo} ${p.caminho.split("?")[0]}`);
const restando = (ms: number) => Date.now() - (dreno.ORCAMENTO_DA_FUNCAO_MS - ms);

describe("o carrossel em PDF no LinkedIn", () => {
  it("agora: as fotos baixadas, o PDF com as duas, o envio com a autorização, o post com o documento e o título, e as fotos fora do bucket", async () => {
    const id = await enfileirarOCarrossel();

    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("publicado");

    expect(caminhosDoLinkedin()).toEqual(["POST /rest/documents", "PUT /envio/D5510", "POST /rest/posts"]);
    const envio = linkedin.pedidos[1];
    expect(envio.cabecalhos.authorization).toBe(`Bearer ${TOKEN_DO_LINKEDIN}`);
    const pdf = linkedin.documentos[0];
    expect(pdf.subarray(0, 9).toString("latin1")).toBe("%PDF-1.4\n");
    expect(pdf.indexOf(FOTO_A)).toBeGreaterThan(0);
    expect(pdf.indexOf(FOTO_B)).toBeGreaterThan(pdf.indexOf(FOTO_A));
    expect(linkedin.posts[0]).toMatchObject({
      author: `urn:li:person:${PESSOA}`,
      content: { media: { id: "urn:li:document:D5510Falso", title: tituloDoDocumento(TEXTO) } },
    });
    const l = await linha(id);
    expect(l.status).toBe("sent");
    expect(l.payload).toMatchObject({ documento_urn: "urn:li:document:D5510Falso", post_urn: "urn:li:share:700000000000000031" });
    expect(bucket.apagados.sort()).toEqual([...FOTOS].sort());
  });

  it("a passada seguinte não monta nem envia o PDF de novo: com o documento marcado, só publica", async () => {
    const id = await enfileirarOCarrossel();
    await q(`update queue set payload = payload || '{"documento_urn":"urn:li:document:JaEnviado"}'::jsonb where id = $1`, [id]);

    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("publicado");

    expect(caminhosDoLinkedin()).toEqual(["POST /rest/posts"]);
    expect(bucket.baixados).toEqual([]);
    expect(linkedin.posts[0]).toMatchObject({ content: { media: { id: "urn:li:document:JaEnviado" } } });
  });

  it("o documento que o LinkedIn ainda processa: a marca sai, a linha volta em um minuto sem gastar tentativa, e a consulta conta", async () => {
    const id = await enfileirarOCarrossel();
    linkedin.respostaDoPost = { status: 400, corpo: '{"code":"MEDIA_ASSET_WAITING_UPLOAD","message":"Media asset is waiting upload"}' };

    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("aguardando");

    const l = await linha(id);
    expect(l).toMatchObject({ status: "pending", attempts: 0, espera_um_minuto: true });
    expect(l.payload).toMatchObject({ documento_urn: "urn:li:document:D5510Falso", consultas_da_midia: 1 });
    expect(l.payload.post_tentado_em).toBeUndefined();
    expect(l.error).toBe(fila.MOTIVO_MIDIA_PROCESSANDO);
  });

  it("na sexta consulta, a linha vai a failed com o motivo", async () => {
    const id = await enfileirarOCarrossel();
    await q(
      `update queue set payload = payload || '{"documento_urn":"urn:li:document:D","consultas_da_midia":5}'::jsonb where id = $1`,
      [id]
    );
    linkedin.respostaDoPost = { status: 400, corpo: '{"code":"MEDIA_ASSET_WAITING_UPLOAD"}' };

    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("falhou");

    expect(await linha(id)).toMatchObject({ status: "failed", error: fila.MOTIVO_MIDIA_NAO_FICOU_PRONTA });
  });

  it("o 400 que não é de processamento encerra a linha, como hoje", async () => {
    const id = await enfileirarOCarrossel();
    linkedin.respostaDoPost = { status: 400, corpo: '{"code":"INVALID_URN_TYPE"}' };

    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("falhou");

    const l = await linha(id);
    expect(l.status).toBe("failed");
    expect(l.error).toContain("400");
  });

  it("sem os 52 s da mídia, a passada não começa: volta sem gastar tentativa, e o adiamento conta", async () => {
    const id = await enfileirarOCarrossel();

    const resumo = await dreno.drainQueue({ inicioDaFuncaoMs: restando(40_000) });

    expect(resumo.aguardando).toBe(1);
    expect(linkedin.pedidos).toEqual([]);
    expect(bucket.baixados).toEqual([]);
    const l = await linha(id);
    expect(l).toMatchObject({ status: "pending", attempts: 0 });
    expect(l.payload).toMatchObject({ adiamentos: 1 });
  });

  it("o sétimo adiamento encerra a linha, sem chamar o LinkedIn", async () => {
    const id = await enfileirarOCarrossel();
    await q(`update queue set payload = payload || '{"adiamentos":6}'::jsonb where id = $1`, [id]);

    await dreno.drainQueue({ inicioDaFuncaoMs: restando(40_000) });

    expect(linkedin.pedidos).toEqual([]);
    expect(await linha(id)).toMatchObject({ status: "failed", error: fila.MOTIVO_SEM_TEMPO_DEMAIS });
  });

  it("a foto que não é JPEG encerra a linha antes de qualquer chamada ao LinkedIn, dizendo qual foto", async () => {
    bucket.arquivos.set(FOTOS[1], Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]));
    const id = await enfileirarOCarrossel();

    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("falhou");

    expect(linkedin.pedidos).toEqual([]);
    const l = await linha(id);
    expect(l.status).toBe("failed");
    expect(l.error).toContain("foto 2");
  });

  it("as fotos que passam de 15 MB juntas encerram a linha antes de qualquer chamada ao LinkedIn", async () => {
    const grande = Buffer.alloc(8 * 1024 * 1024, 0x55);
    bucket.arquivos.set(FOTOS[0], grande);
    bucket.arquivos.set(FOTOS[1], grande);
    const id = await enfileirarOCarrossel();

    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("falhou");

    expect(linkedin.pedidos).toEqual([]);
    expect(await linha(id)).toMatchObject({
      status: "failed",
      error: "As fotos do carrossel passam de 15 MB juntas, o limite do LinkedIn neste painel. Tire fotos ou use fotos menores.",
    });
  });

  it("a foto que sumiu do bucket não publica: a linha volta à fila pelo erro passageiro, sem chamar o LinkedIn", async () => {
    bucket.arquivos.delete(FOTOS[1]);
    const id = await enfileirarOCarrossel();

    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id)).toBe("aguardando");

    expect(linkedin.pedidos).toEqual([]);
    expect((await linha(id)).status).toBe("pending");
  });
});
```

Em `testes-integracao/dreno-forma-desconhecida.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/dreno-forma-desconhecida.integracao.ts b/testes-integracao/dreno-forma-desconhecida.integracao.ts
index 71838f7..5ee3d63 100644
--- a/testes-integracao/dreno-forma-desconhecida.integracao.ts
+++ b/testes-integracao/dreno-forma-desconhecida.integracao.ts
@@ -130,13 +130,14 @@ async function linha(id: string) {
   return l;
 }
 
-const CARROSSEL = { forma: "carrossel", caminhos: [`${CONTA}/a.jpg`, `${CONTA}/b.jpg`], texto: "um carrossel do futuro" };
+// A FORMA NOVA DE EXEMPLO É O VÍDEO (a parte 3b), que este código ainda não publica. Até a 3a, era o carrossel.
+const FORMA_NOVA = { forma: "video", caminhos: [`${CONTA}/a.mp4`], texto: "um vídeo do futuro" };
 const TEXTO = { forma: "texto", caminhos: [], texto: "um post só de texto" };
 const IMAGEM = { forma: "imagem", caminhos: [`${CONTA}/c.jpg`], texto: "um post com imagem" };
 
 describe("o dreno e um post do LinkedIn de forma que ele não conhece", () => {
   test("a linha de forma nova fica pending e intocada, e as de forma conhecida são pegas", async () => {
-    const nova = await semear(CARROSSEL);
+    const nova = await semear(FORMA_NOVA);
     const texto = await semear(TEXTO);
     const imagem = await semear(IMAGEM);
     const antes = await linha(nova);
@@ -169,7 +170,7 @@ describe("o dreno e um post do LinkedIn de forma que ele não conhece", () => {
   });
 
   test("a linha de forma nova presa em sending há mais de 3 minutos não é retomada", async () => {
-    const presa = await semear(CARROSSEL, { status: "sending", reivindicadoHaSegundos: 600 });
+    const presa = await semear(FORMA_NOVA, { status: "sending", reivindicadoHaSegundos: 600 });
     const antes = await linha(presa);
 
     await dreno.drainQueue();
@@ -179,7 +180,7 @@ describe("o dreno e um post do LinkedIn de forma que ele não conhece", () => {
   });
 
   test("o rodapé não arma tique por uma linha de forma nova vencida, que fica pending (sem isso, um tique a cada 20 s)", async () => {
-    await semear(CARROSSEL);
+    await semear(FORMA_NOVA);
 
     await dreno.drainQueue();
 
@@ -187,7 +188,7 @@ describe("o dreno e um post do LinkedIn de forma que ele não conhece", () => {
   });
 
   test("o rodapé não arma tique por uma linha de forma nova para daqui a pouco", async () => {
-    await semear(CARROSSEL, { emSegundos: 600 });
+    await semear(FORMA_NOVA, { emSegundos: 600 });
 
     await dreno.drainQueue();
 
@@ -203,7 +204,7 @@ describe("o dreno e um post do LinkedIn de forma que ele não conhece", () => {
   });
 
   test("os tiques do dia não contam a linha de forma nova, e contam a de forma conhecida", async () => {
-    await semear(CARROSSEL, { emSegundos: 7200 });
+    await semear(FORMA_NOVA, { emSegundos: 7200 });
     expect(await dreno.armarTiquesDoDia()).toEqual({ armados: 0 });
     expect(publicados).toEqual([]);
 
@@ -213,7 +214,7 @@ describe("o dreno e um post do LinkedIn de forma que ele não conhece", () => {
   });
 
   test("o agora não pega a linha de forma nova, e pega a de forma conhecida", async () => {
-    const nova = await semear(CARROSSEL);
+    const nova = await semear(FORMA_NOVA);
     const texto = await semear(TEXTO);
     const antes = await linha(nova);
 
```

Em `testes-integracao/linkedin-telas.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/linkedin-telas.integracao.ts b/testes-integracao/linkedin-telas.integracao.ts
index 6f58296..90a3330 100644
--- a/testes-integracao/linkedin-telas.integracao.ts
+++ b/testes-integracao/linkedin-telas.integracao.ts
@@ -386,7 +386,8 @@ describe("o remarcar e o cancelar de um post do LinkedIn de forma nova", () => {
        returning id, not_before`,
       [
         CONTA_A,
-        { forma: "carrossel", caminhos: [`${CONTA_A}/novo-${semente}-a.jpg`, `${CONTA_A}/novo-${semente}-b.jpg`], texto: "um carrossel do futuro" },
+        // A FORMA NOVA DE EXEMPLO É O VÍDEO (a parte 3b), que este código ainda não publica. Até a 3a, era o carrossel.
+        { forma: "video", caminhos: [`${CONTA_A}/novo-${semente}.mp4`], texto: "um vídeo do futuro" },
         `telas-forma-nova-${semente}`,
         emSegundos,
       ]
```

Em `tests/linkedin-compor.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/linkedin-compor.test.ts b/tests/linkedin-compor.test.ts
index 157ef3a..93dd62a 100644
--- a/tests/linkedin-compor.test.ts
+++ b/tests/linkedin-compor.test.ts
@@ -18,9 +18,10 @@ const pedido = (p: Partial<Parameters<typeof recusaDoPedidoNoLinkedin>[0]> = {})
   recusaDoPedidoNoLinkedin({ forma: "texto", caminhos: [], texto: "Olá #mundo", idDoEnvio: ENVIO, ...p });
 
 describe("as recusas do pedido de publicar no LinkedIn", () => {
-  it("o pedido certo passa, nas duas formas", () => {
+  it("o pedido certo passa, nas três formas", () => {
     expect(pedido()).toBeNull();
     expect(pedido({ forma: "imagem", caminhos: ["conta/foto.jpg"] })).toBeNull();
+    expect(pedido({ forma: "carrossel", caminhos: ["conta/a.jpg", "conta/b.jpg"] })).toBeNull();
   });
 
   it("a forma que não é do LinkedIn", () => {
@@ -33,6 +34,12 @@ describe("as recusas do pedido de publicar no LinkedIn", () => {
     expect(pedido({ forma: "imagem", caminhos: ["conta/a.jpg", "conta/b.jpg"] })).toBe("quantidade");
   });
 
+  it("o carrossel leva de 2 a 10 fotos", () => {
+    expect(pedido({ forma: "carrossel", caminhos: ["conta/a.jpg"] })).toBe("quantidade");
+    expect(pedido({ forma: "carrossel", caminhos: Array(11).fill("conta/a.jpg") })).toBe("quantidade");
+    expect(pedido({ forma: "carrossel", caminhos: Array(10).fill("conta/a.jpg") })).toBeNull();
+  });
+
   it("o texto vazio, nas duas formas", () => {
     expect(pedido({ texto: "   " })).toBe("texto_vazio");
     expect(pedido({ forma: "imagem", caminhos: ["conta/foto.jpg"], texto: "" })).toBe("texto_vazio");
@@ -68,6 +75,10 @@ describe("as recusas do pedido de publicar no LinkedIn", () => {
     expect(new Set(frases).size).toBe(5);
     expect(textoDaRecusaNoLinkedin("texto_longo")).toContain("3.000");
     expect(textoDaRecusaNoLinkedin("texto_longo")).toContain("hashtags");
+    expect(textoDaRecusaNoLinkedin("forma_desconhecida")).toBe("Escolha a forma do post no LinkedIn: só texto, imagem ou carrossel.");
+    expect(textoDaRecusaNoLinkedin("quantidade")).toBe(
+      "O post do LinkedIn com imagem leva uma imagem, o carrossel leva de 2 a 10 fotos, e o só texto não leva arquivo."
+    );
   });
 });
 
```

Em `tests/linkedin-forma-conhecida.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/linkedin-forma-conhecida.test.ts b/tests/linkedin-forma-conhecida.test.ts
index 4b2d777..e14167e 100644
--- a/tests/linkedin-forma-conhecida.test.ts
+++ b/tests/linkedin-forma-conhecida.test.ts
@@ -13,8 +13,8 @@ import { AVISO_DO_REMARCAR_DA_FORMA_NOVA } from "@/lib/post-da-fila";
 // efeito dele contra o Postgres de verdade está em testes-integracao/dreno-forma-desconhecida.integracao.ts.
 
 describe("as formas do post do LinkedIn que este código conhece", () => {
-  it("são as que o ramo do dreno publica hoje: só texto e imagem", () => {
-    expect([...FORMAS_NO_LINKEDIN]).toEqual(["texto", "imagem"]);
+  it("são as que o ramo do dreno publica hoje: só texto, imagem e o carrossel em PDF (a parte 3a)", () => {
+    expect([...FORMAS_NO_LINKEDIN]).toEqual(["texto", "imagem", "carrossel"]);
   });
 });
 
```

Em `tests/linkedin-post.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/linkedin-post.test.ts b/tests/linkedin-post.test.ts
index 954bc80..3346ebd 100644
--- a/tests/linkedin-post.test.ts
+++ b/tests/linkedin-post.test.ts
@@ -1,5 +1,6 @@
 import { describe, expect, it } from "vitest";
 import {
+  aMidiaAindaNaoEstaPronta,
   corpoDoPost,
   desfechoDoErroDoLinkedin,
   formaNoLinkedinDoCampo,
@@ -18,15 +19,17 @@ import {
 // AS REGRAS PURAS DO POST NO LINKEDIN (docs/specs/2026-11-06-linkedin-no-perfil.md, §5; a parte 2a: só texto e
 // imagem, uma rede por post). A tela de publicar e o servidor leem as mesmas funções.
 
-describe("as formas do LinkedIn na 2a", () => {
-  it("são só texto e imagem; o resto, inclusive o que é do Instagram, não vale", () => {
+describe("as formas do LinkedIn (a 2a e o carrossel da 3a)", () => {
+  it("são só texto, imagem e carrossel; o resto, inclusive o que é só do Instagram, não vale", () => {
     expect(formaNoLinkedinDoCampo("texto")).toBe("texto");
     expect(formaNoLinkedinDoCampo("imagem")).toBe("imagem");
-    for (const outra of ["carrossel", "reels", "story", "", null, undefined, ["texto"]]) {
+    expect(formaNoLinkedinDoCampo("carrossel")).toBe("carrossel");
+    for (const outra of ["reels", "video", "story", "", null, undefined, ["texto"]]) {
       expect(formaNoLinkedinDoCampo(outra)).toBeNull();
     }
     expect(rotuloDaFormaNoLinkedin("texto")).toBe("Só texto");
     expect(rotuloDaFormaNoLinkedin("imagem")).toBe("Imagem");
+    expect(rotuloDaFormaNoLinkedin("carrossel")).toBe("Carrossel (PDF)");
   });
 });
 
@@ -115,13 +118,40 @@ describe("o payload da linha do LinkedIn na fila", () => {
       caminhos: ["conta/a.jpg"],
       texto: "Olá",
       imagemUrn: "urn:li:image:X",
+      documentoUrn: null,
+      consultasDaMidia: 0,
+      adiamentos: 0,
       postTentadoEm: "2026-11-09T19:00:00Z",
       postUrn: "urn:li:share:1",
     });
   });
 
+  it("o carrossel leva de 2 a 10 fotos, e lê de volta o documento, as consultas e os adiamentos", () => {
+    const fotos = ["conta/a.jpg", "conta/b.jpg"];
+    const p = payloadDoLinkedin({ forma: "carrossel", caminhos: fotos, texto: "Cinco dicas" });
+    expect(lerPayloadDoLinkedin({ ...p, documento_urn: "urn:li:document:D", consultas_da_midia: 2, adiamentos: 1 })).toMatchObject({
+      forma: "carrossel",
+      caminhos: fotos,
+      documentoUrn: "urn:li:document:D",
+      consultasDaMidia: 2,
+      adiamentos: 1,
+    });
+    expect(lerPayloadDoLinkedin({ forma: "carrossel", caminhos: ["conta/a.jpg"], texto: "x" })).toBeNull();
+    expect(lerPayloadDoLinkedin({ forma: "carrossel", caminhos: Array(11).fill("conta/a.jpg"), texto: "x" })).toBeNull();
+    expect(lerPayloadDoLinkedin({ forma: "carrossel", caminhos: Array(10).fill("conta/a.jpg"), texto: "x" })).not.toBeNull();
+  });
+
+  it("as consultas e os adiamentos que não são inteiros a partir de zero valem zero", () => {
+    for (const torto of [-1, 1.5, "3", null]) {
+      expect(lerPayloadDoLinkedin({ forma: "texto", caminhos: [], texto: "x", consultas_da_midia: torto, adiamentos: torto })).toMatchObject({
+        consultasDaMidia: 0,
+        adiamentos: 0,
+      });
+    }
+  });
+
   it("recusa a forma desconhecida, o texto com arquivo e a imagem sem arquivo, ou com dois", () => {
-    expect(lerPayloadDoLinkedin({ forma: "reels", caminhos: ["a/b.mp4"], texto: "x" })).toBeNull();
+    expect(lerPayloadDoLinkedin({ forma: "video", caminhos: ["a/b.mp4"], texto: "x" })).toBeNull();
     expect(lerPayloadDoLinkedin({ forma: "texto", caminhos: ["a/b.jpg"], texto: "x" })).toBeNull();
     expect(lerPayloadDoLinkedin({ forma: "imagem", caminhos: [], texto: "x" })).toBeNull();
     expect(lerPayloadDoLinkedin({ forma: "imagem", caminhos: ["a/b.jpg", "a/c.jpg"], texto: "x" })).toBeNull();
@@ -185,3 +215,20 @@ describe("o corpo do POST /rest/posts com o documento do carrossel", () => {
     });
   });
 });
+
+// O DOCUMENTO QUE O LINKEDIN AINDA PROCESSA (a parte 3a). A Posts API não tem código próprio para a mídia não
+// pronta; a Videos API lista o 400 "MEDIA_ASSET_WAITING_UPLOAD" e o estado "PROCESSING". O post com o documento que
+// volta assim não foi criado (é um 4xx), e a linha espera e consulta de novo. O "PROCESSING_FAILED" não espera: falhou.
+describe("o documento que o LinkedIn ainda processa", () => {
+  it("o 400 que fala em WAITING_UPLOAD ou em PROCESSING é a mídia não pronta", () => {
+    expect(aMidiaAindaNaoEstaPronta(400, '{"code":"MEDIA_ASSET_WAITING_UPLOAD","message":"Media asset is waiting upload"}')).toBe(true);
+    expect(aMidiaAindaNaoEstaPronta(400, "the document is still PROCESSING")).toBe(true);
+  });
+
+  it("o PROCESSING_FAILED, outro 400, ou outro status não são", () => {
+    expect(aMidiaAindaNaoEstaPronta(400, '{"code":"MEDIA_ASSET_PROCESSING_FAILED"}')).toBe(false);
+    expect(aMidiaAindaNaoEstaPronta(400, '{"code":"INVALID_URN_TYPE"}')).toBe(false);
+    expect(aMidiaAindaNaoEstaPronta(422, "WAITING_UPLOAD")).toBe(false);
+    expect(aMidiaAindaNaoEstaPronta(500, "PROCESSING")).toBe(false);
+  });
+});
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-carrossel-pdf"; cd "$C" || exit 1
npx --no-install vitest run tests/linkedin-compor.test.ts tests/linkedin-forma-conhecida.test.ts tests/linkedin-post.test.ts 2>&1 | tee ../el3a-f3-red-puros.log
docker ps --format '{{.Names}} {{.Status}}' | grep metodochat-banco-de-teste   # healthy; senão, docker start e espere healthy
DATABASE_URL_TESTES=postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes npx --no-install vitest run --config vitest.integracao.config.ts testes-integracao/linkedin-carrossel.integracao.ts testes-integracao/dreno-forma-desconhecida.integracao.ts testes-integracao/linkedin-telas.integracao.ts 2>&1 | tee ../el3a-f3-red-integ.log
```

Esperado: nos puros, "Test Files 3 failed (3)" e "Tests 10 failed | 36 passed (46)": a forma `"carrossel"`, as recusas e o payload dela, a lista das formas e a mídia não pronta ainda não existem. Na integração, `ALVO: banco de TESTE`, nenhum `teste_tmp` antes e depois, "Test Files 1 failed | 2 passed (3)" e "Tests 10 failed | 25 passed (35)": caem os 10 casos de `linkedin-carrossel.integracao.ts` ("o carrossel não entrou na fila"), e os de "video" dos dois arquivos da 3-0 passam.

- [ ] **Passo 3: o código**

Em `lib/linkedin-publicacao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/linkedin-publicacao.ts b/lib/linkedin-publicacao.ts
index b53a78d..0b3e010 100644
--- a/lib/linkedin-publicacao.ts
+++ b/lib/linkedin-publicacao.ts
@@ -1,7 +1,8 @@
 // AS DECISÕES PURAS DO LINKEDIN (docs/specs/2026-11-06-linkedin-no-perfil.md, §5), SEM IMPORT DE SERVIDOR: a
 // tela de cliente e o servidor leem as mesmas regras. Na parte 1 (a conexão), o vencimento; na parte 2a (só
-// texto e imagem, uma rede por post), as formas, o texto, o payload da fila, o corpo do post e os erros. O
-// carrossel em PDF e o vídeo vêm na parte 3.
+// texto e imagem, uma rede por post), as formas, o texto, o payload da fila, o corpo do post e os erros. Na parte
+// 3a, o carrossel em PDF; o vídeo vem na 3b. O único import é o de lib/publicacao.ts, que também é puro.
+import { CARROSSEL_ITENS_MAX, CARROSSEL_ITENS_MIN } from "./publicacao";
 
 /** O aviso de que a autorização vai vencer começa a 7 dias. */
 export const AVISO_DO_VENCIMENTO_DIAS = 7;
@@ -46,13 +47,25 @@ export const TEXTO_DO_CONVITE_SEM_CONFIRMACAO =
 // AS FORMAS DA PARTE 2a
 // ---------------------------------------------------------------------------------------------------------------
 
-export type FormaNoLinkedin = "texto" | "imagem";
+/** As formas do post no LinkedIn: o só texto e a imagem (a parte 2a), e o carrossel em PDF (a parte 3a). */
+export type FormaNoLinkedin = "texto" | "imagem" | "carrossel";
 
 /**
  * AS FORMAS QUE ESTE CÓDIGO SABE PUBLICAR NO LINKEDIN, numa lista só: a do formulário, a do payload e a do dreno
- * (`soAFormaConhecidaDoLinkedin`, abaixo). Uma forma acrescentada aqui é uma forma que o dreno passa a pegar.
+ * (`soAFormaConhecidaDoLinkedin`, abaixo). Uma forma acrescentada aqui é uma forma que o dreno passa a pegar: o
+ * carrossel entra junto com o ramo dele (lib/linkedin-fila.ts).
  */
-export const FORMAS_NO_LINKEDIN: readonly FormaNoLinkedin[] = ["texto", "imagem"];
+export const FORMAS_NO_LINKEDIN: readonly FormaNoLinkedin[] = ["texto", "imagem", "carrossel"];
+
+/**
+ * QUANTOS ARQUIVOS CADA FORMA LEVA, numa função só, para o pedido e para o payload: o só texto nenhum, a imagem um, e
+ * o carrossel as mesmas 2 a 10 fotos do carrossel do Instagram (`CARROSSEL_ITENS_MIN` e `CARROSSEL_ITENS_MAX`).
+ */
+function quantidadeServe(forma: FormaNoLinkedin, quantos: number): boolean {
+  if (forma === "texto") return quantos === 0;
+  if (forma === "imagem") return quantos === 1;
+  return quantos >= CARROSSEL_ITENS_MIN && quantos <= CARROSSEL_ITENS_MAX;
+}
 
 /** A forma que veio do formulário, de uma lista fechada. */
 export function formaNoLinkedinDoCampo(bruto: unknown): FormaNoLinkedin | null {
@@ -83,6 +96,7 @@ export function soAFormaConhecidaDoLinkedin(marcador: string): string {
 }
 
 export function rotuloDaFormaNoLinkedin(forma: FormaNoLinkedin): string {
+  if (forma === "carrossel") return "Carrossel (PDF)";
   return forma === "texto" ? "Só texto" : "Imagem";
 }
 
@@ -165,7 +179,7 @@ export function recusaDoPedidoNoLinkedin(p: {
   idDoEnvio: string;
 }): RecusaDoPedidoNoLinkedin | null {
   if (!p.forma) return "forma_desconhecida";
-  if (p.caminhos.length !== (p.forma === "imagem" ? 1 : 0)) return "quantidade";
+  if (!quantidadeServe(p.forma, p.caminhos.length)) return "quantidade";
   const problema = problemaDoTextoDoLinkedin(p.texto, p.forma);
   if (problema === "vazio") return "texto_vazio";
   if (problema === "longo") return "texto_longo";
@@ -176,9 +190,9 @@ export function recusaDoPedidoNoLinkedin(p: {
 export function textoDaRecusaNoLinkedin(r: RecusaDoPedidoNoLinkedin): string {
   switch (r) {
     case "forma_desconhecida":
-      return "Escolha a forma do post no LinkedIn: só texto ou imagem.";
+      return "Escolha a forma do post no LinkedIn: só texto, imagem ou carrossel.";
     case "quantidade":
-      return "O post do LinkedIn com imagem leva uma imagem, e o só texto não leva arquivo.";
+      return "O post do LinkedIn com imagem leva uma imagem, o carrossel leva de 2 a 10 fotos, e o só texto não leva arquivo.";
     case "texto_vazio":
       return "Escreva o texto do post.";
     case "texto_longo":
@@ -260,12 +274,19 @@ export function avisoDoPostNoLinkedin(d: {
  * foi feito (spec, §6): `imagem_urn` depois do envio da imagem; `post_tentado_em` ANTES do POST do post (achado
  * 210: o POST não tem chave contra repetição, e uma resposta perdida não pode virar um segundo post); e
  * `post_urn` com o id que o LinkedIn devolveu.
+ *
+ * NO CARROSSEL (a parte 3a): `documento_urn` depois do envio do PDF; `consultas_da_midia`, as vezes em que o post
+ * voltou porque o LinkedIn ainda processava o documento; e `adiamentos`, as passadas que não tinham tempo para o
+ * passo seguinte (vale para toda forma, e o dreno lê o número para pôr a linha adiada primeiro no lote).
  */
 export type PayloadDoLinkedin = {
   forma: FormaNoLinkedin;
   caminhos: string[];
   texto: string;
   imagem_urn?: string;
+  documento_urn?: string;
+  consultas_da_midia?: number;
+  adiamentos?: number;
   post_tentado_em?: string;
   post_urn?: string;
 };
@@ -279,6 +300,9 @@ export type LeituraDoPayloadDoLinkedin = {
   caminhos: string[];
   texto: string;
   imagemUrn: string | null;
+  documentoUrn: string | null;
+  consultasDaMidia: number;
+  adiamentos: number;
   postTentadoEm: string | null;
   postUrn: string | null;
 };
@@ -290,13 +314,19 @@ export function lerPayloadDoLinkedin(bruto: unknown): LeituraDoPayloadDoLinkedin
   const forma = formaNoLinkedinDoCampo(p.forma);
   if (!forma || typeof p.texto !== "string") return null;
   const caminhos = Array.isArray(p.caminhos) && p.caminhos.every((c) => typeof c === "string") ? (p.caminhos as string[]) : null;
-  if (!caminhos || caminhos.length !== (forma === "imagem" ? 1 : 0)) return null;
+  if (!caminhos || !quantidadeServe(forma, caminhos.length)) return null;
   const texto = (v: unknown) => (typeof v === "string" && v ? v : null);
+  // A CONTAGEM QUE NÃO É UM INTEIRO A PARTIR DE ZERO VALE ZERO: ela só é escrita pelo dreno, e um valor torto não
+  // pode encerrar a linha antes da hora.
+  const contagem = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : 0);
   return {
     forma,
     caminhos,
     texto: p.texto,
     imagemUrn: texto(p.imagem_urn),
+    documentoUrn: texto(p.documento_urn),
+    consultasDaMidia: contagem(p.consultas_da_midia),
+    adiamentos: contagem(p.adiamentos),
     postTentadoEm: texto(p.post_tentado_em),
     postUrn: texto(p.post_urn),
   };
@@ -365,6 +395,16 @@ export function oPostPodeTerSaido(status: number): boolean {
   return !(status >= 400 && status < 500);
 }
 
+/**
+ * O DOCUMENTO QUE O LINKEDIN AINDA PROCESSA (a parte 3a). A Posts API não tem código próprio para a mídia não pronta;
+ * a Videos API lista o 400 "MEDIA_ASSET_WAITING_UPLOAD" e o estado "PROCESSING". Um 400 que fale em WAITING_UPLOAD ou
+ * em PROCESSING (e não em PROCESSING_FAILED, que é falha) é a mídia não pronta: o post não foi criado, e a linha
+ * espera e consulta de novo. Como o LinkedIn responde de fato ao documento em processamento, a prova mede.
+ */
+export function aMidiaAindaNaoEstaPronta(status: number, texto: string): boolean {
+  return status === 400 && /WAITING_UPLOAD|PROCESSING(?!_FAILED)/.test(texto);
+}
+
 // ---------------------------------------------------------------------------------------------------------------
 // O CARROSSEL EM PDF (a parte 3a; scratchpad/desenho-li3.md, §6)
 // ---------------------------------------------------------------------------------------------------------------
```

Em `lib/pdf-de-fotos.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/pdf-de-fotos.ts b/lib/pdf-de-fotos.ts
index 39278c9..3f0f486 100644
--- a/lib/pdf-de-fotos.ts
+++ b/lib/pdf-de-fotos.ts
@@ -18,7 +18,7 @@ import { cabecalhoDoJpeg } from "./bonus/imagem-jpeg";
 const ESPACO_DE_COR: Record<number, string> = { 1: "/DeviceGray", 3: "/DeviceRGB" };
 
 /** Monta o PDF, uma página por foto, na ordem. Lança com o número da foto (a partir de 1) que não serve. */
-export function pdfDeFotos(fotos: readonly Uint8Array[]): Uint8Array {
+export function pdfDeFotos(fotos: readonly Uint8Array[]): Uint8Array<ArrayBuffer> {
   if (fotos.length === 0) throw new Error("o PDF precisa de ao menos uma foto");
   const paginas = fotos.map((foto, i) => {
     const c = cabecalhoDoJpeg(foto);
```

Em `lib/linkedin-fila.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/linkedin-fila.ts b/lib/linkedin-fila.ts
index 50084ff..3f740ea 100644
--- a/lib/linkedin-fila.ts
+++ b/lib/linkedin-fila.ts
@@ -11,13 +11,17 @@ import { urlPublicaDoObjeto } from "./bucket";
 import { conexaoDaConta } from "./linkedin-conexoes";
 import {
   criarPost,
+  enviarDocumento,
   enviarImagem,
   LinkedinError,
+  reservarDocumento,
   reservarImagem,
   TETO_DO_ENVIO_DA_IMAGEM_MS,
+  TETO_DO_ENVIO_DO_DOCUMENTO_MS,
   TETO_DO_LINKEDIN_MS,
 } from "./linkedin";
 import {
+  aMidiaAindaNaoEstaPronta,
   corpoDoPost,
   desfechoDoErroDoLinkedin,
   lerPayloadDoLinkedin,
@@ -25,8 +29,13 @@ import {
   oPostPodeTerSaido,
   payloadDoLinkedin,
   recusaDoPedidoNoLinkedin,
+  textoDoProblemaDoCarrosselNoLinkedin,
+  TETO_DO_CARROSSEL_NO_LINKEDIN_BYTES,
+  tituloDoDocumento,
   type FormaNoLinkedin,
+  type LeituraDoPayloadDoLinkedin,
 } from "./linkedin-publicacao";
+import { pdfDeFotos } from "./pdf-de-fotos";
 
 // O POST DO LINKEDIN PELA FILA (docs/specs/2026-11-06-linkedin-no-perfil.md, §6; a parte 2a: só texto e imagem,
 // uma rede por post). Dois pedaços: o enfileirar, no molde do `enqueuePublicacao` (lib/engine.ts), e o publicar,
@@ -160,19 +169,75 @@ const FOLGA_MS = 5_000;
 const TEMPO_PARA_A_IMAGEM_MS = TETO_DO_BUCKET_MS + TETO_DO_LINKEDIN_MS + TETO_DO_ENVIO_DA_IMAGEM_MS + FOLGA_MS;
 /** O POST, com a folga: 15 s. */
 const TEMPO_PARA_O_POST_MS = TETO_DO_LINKEDIN_MS + FOLGA_MS;
+/**
+ * A MONTAGEM DO PDF DO CARROSSEL (lib/pdf-de-fotos.ts): juntar os JPEGs, até os 15 MB do carrossel, e escrever a
+ * tabela de posições. É linear nos bytes, sem recomprimir; os 2 s são a trava, e o plano mede o tempo de verdade.
+ */
+const TEMPO_DE_MONTAGEM_DO_PDF_MS = 2_000;
+/**
+ * A MÍDIA DO CARROSSEL (a parte 3a; o 213): as fotos do bucket, baixadas juntas (10 s), a montagem (2 s), a reserva
+ * (10 s) e o envio do documento (25 s), com a folga: 52 s. Ela só cabe no começo de uma função; o post vem numa
+ * passada seguinte, se não sobrar tempo.
+ */
+const TEMPO_PARA_O_DOCUMENTO_MS =
+  TETO_DO_BUCKET_MS + TEMPO_DE_MONTAGEM_DO_PDF_MS + TETO_DO_LINKEDIN_MS + TETO_DO_ENVIO_DO_DOCUMENTO_MS + FOLGA_MS;
 /** Quando falta tempo, a linha volta para daqui a pouco: a próxima passada é outra função, com o prazo inteiro. */
 const VOLTA_SEM_TEMPO_EM_SEGUNDOS = 20;
+/**
+ * O TETO DOS ADIAMENTOS (a parte 3a; nota da auditoria): a volta sem gastar tentativa não tinha teto, e uma linha que
+ * nunca tivesse tempo seria adiada para sempre. O sétimo adiamento encerra a linha com o motivo. No lote, a linha já
+ * adiada vai primeiro (`naOrdemDoLote`, lib/fila-tipos.ts), e começa com o prazo quase inteiro.
+ */
+export const ADIAMENTOS_MAX = 6;
+export const MOTIVO_SEM_TEMPO_DEMAIS = "o post não coube no tempo de nenhuma passada; publique de novo, com menos fotos";
+/**
+ * O DOCUMENTO QUE O LINKEDIN AINDA PROCESSA (a parte 3a): a linha volta em um minuto, até cinco consultas, como a
+ * espera do contêiner da Meta. Na sexta, ela encerra com o motivo.
+ */
+export const CONSULTAS_DA_MIDIA_MAX = 5;
+const ESPERA_DA_MIDIA_EM_SEGUNDOS = 60;
+export const MOTIVO_MIDIA_PROCESSANDO = "o LinkedIn ainda está processando o documento; o post sai na próxima consulta";
+export const MOTIVO_MIDIA_NAO_FICOU_PRONTA = "o LinkedIn não terminou de processar o documento a tempo; publique de novo";
 
 /**
  * A LINHA VOLTA À FILA SEM GASTAR A TENTATIVA: a reivindicação contou uma, e nada foi tentado. Sem o desconto,
- * três passadas sem tempo levariam o primeiro erro passageiro a encerrar a linha.
+ * três passadas sem tempo levariam o primeiro erro passageiro a encerrar a linha. O adiamento fica contado no payload.
+ */
+async function devolverSemGastarTentativa(id: string, adiamentos: number): Promise<void> {
+  await sql().query(
+    `update queue set status = 'pending', attempts = greatest(attempts - 1, 0),
+            not_before = now() + make_interval(secs => $2::int), error = $3,
+            payload = payload || jsonb_build_object('adiamentos', $4::int)
+      where id = $1`,
+    [id, VOLTA_SEM_TEMPO_EM_SEGUNDOS, MOTIVO_SEM_TEMPO, adiamentos]
+  );
+}
+
+/** Sem tempo para o passo seguinte: adia, contando, ou encerra no sétimo adiamento. */
+async function adiarOuEncerrar(
+  item: QueueItem,
+  pub: LeituraDoPayloadDoLinkedin,
+  deps: DependenciasDoDreno
+): Promise<DesfechoDoPostNoLinkedin> {
+  if (pub.adiamentos >= ADIAMENTOS_MAX) {
+    await deps.finish(item.id, { status: "failed", error: MOTIVO_SEM_TEMPO_DEMAIS });
+    return "falhou";
+  }
+  await devolverSemGastarTentativa(item.id, pub.adiamentos + 1);
+  return "aguardando";
+}
+
+/**
+ * O DOCUMENTO AINDA NÃO ESTÁ PRONTO: o post não foi criado (o 4xx prova), então a marca do POST sai, e a linha volta
+ * em um minuto sem gastar a tentativa, com a consulta contada.
  */
-async function devolverSemGastarTentativa(id: string): Promise<void> {
+async function esperarAMidia(id: string, consultas: number): Promise<void> {
   await sql().query(
     `update queue set status = 'pending', attempts = greatest(attempts - 1, 0),
-            not_before = now() + make_interval(secs => $2::int), error = $3
+            not_before = now() + make_interval(secs => $2::int), error = $3,
+            payload = (payload - 'post_tentado_em') || jsonb_build_object('consultas_da_midia', $4::int)
       where id = $1`,
-    [id, VOLTA_SEM_TEMPO_EM_SEGUNDOS, MOTIVO_SEM_TEMPO]
+    [id, ESPERA_DA_MIDIA_EM_SEGUNDOS, MOTIVO_MIDIA_PROCESSANDO, consultas]
   );
 }
 
@@ -240,12 +305,14 @@ export async function publicarNoLinkedinDaFila(item: QueueItem, deps: Dependenci
   }
 
   // O TEMPO, ANTES DE QUALQUER CHAMADA: a imagem que ainda não subiu precisa do bucket, da reserva e do envio; o
-  // resto, só do post.
-  const precisa = pub.forma === "imagem" && !pub.imagemUrn ? TEMPO_PARA_A_IMAGEM_MS : TEMPO_PARA_O_POST_MS;
-  if (deps.prazoMs - Date.now() < precisa) {
-    await devolverSemGastarTentativa(item.id);
-    return "aguardando";
-  }
+  // documento do carrossel, também da montagem do PDF; o resto, só do post.
+  const precisa =
+    pub.forma === "imagem" && !pub.imagemUrn
+      ? TEMPO_PARA_A_IMAGEM_MS
+      : pub.forma === "carrossel" && !pub.documentoUrn
+        ? TEMPO_PARA_O_DOCUMENTO_MS
+        : TEMPO_PARA_O_POST_MS;
+  if (deps.prazoMs - Date.now() < precisa) return adiarOuEncerrar(item, pub, deps);
 
   const conexao = conta ? await conexaoDaConta(conta) : null;
   if (!conexao) {
@@ -274,26 +341,71 @@ export async function publicarNoLinkedinDaFila(item: QueueItem, deps: Dependenci
     await deps.guardarNoPayload(item.id, { imagem_urn: imagemUrn });
   }
 
-  // O TEMPO DE NOVO, depois da imagem: o passo que pode duplicar nunca começa perto do fim da função. O
-  // `imagem_urn` já está gravado, e a passada seguinte só publica.
-  if (deps.prazoMs - Date.now() < TEMPO_PARA_O_POST_MS) {
-    await devolverSemGastarTentativa(item.id);
-    return "aguardando";
+  // O DOCUMENTO DO CARROSSEL (a parte 3a): as fotos do bucket, baixadas juntas; o total no teto; o PDF montado aqui,
+  // com o JPEG como está; a reserva e o envio. O `documento_urn` fica gravado, e a passada seguinte não refaz nada
+  // disso. Repetir este passo inteiro, se a marca se perdeu, é seguro: a reserva nova é outro documento, e o de antes
+  // fica sem uso no LinkedIn. A foto que falta no bucket é erro passageiro (sobe ao `catch` do dreno); a foto que
+  // não é JPEG, e o total acima do teto, encerram a linha antes de qualquer chamada ao LinkedIn.
+  let documentoUrn = pub.documentoUrn ?? undefined;
+  if (pub.forma === "carrossel" && !documentoUrn) {
+    const fotos = (await Promise.all(pub.caminhos.map(bytesDaImagem))).map((b) => new Uint8Array(b));
+    if (fotos.reduce((soma, f) => soma + f.length, 0) > TETO_DO_CARROSSEL_NO_LINKEDIN_BYTES) {
+      await deps.finish(item.id, { status: "failed", error: textoDoProblemaDoCarrosselNoLinkedin("grande") });
+      return "falhou";
+    }
+    let pdf: Uint8Array<ArrayBuffer>;
+    try {
+      pdf = pdfDeFotos(fotos);
+    } catch (err) {
+      await deps.finish(item.id, { status: "failed", error: err instanceof Error ? err.message : "o PDF do carrossel não foi montado" });
+      return "falhou";
+    }
+    try {
+      const reserva = await reservarDocumento(conexao.access_token, conexao.pessoa_id);
+      await enviarDocumento(reserva.uploadUrl, conexao.access_token, pdf);
+      documentoUrn = reserva.documentoUrn;
+    } catch (err) {
+      const recusa = recusaDoLinkedin(err, conexao.nome);
+      if (recusa === null) throw err;
+      await deps.finish(item.id, { status: "failed", error: recusa });
+      return "falhou";
+    }
+    await deps.guardarNoPayload(item.id, { documento_urn: documentoUrn });
   }
 
+  // O TEMPO DE NOVO, depois da mídia: o passo que pode duplicar nunca começa perto do fim da função. O
+  // `imagem_urn` (ou o `documento_urn`) já está gravado, e a passada seguinte só publica.
+  if (deps.prazoMs - Date.now() < TEMPO_PARA_O_POST_MS) return adiarOuEncerrar(item, pub, deps);
+
   // A MARCA ANTES DO POST (achado 210): uma resposta perdida daqui em diante não vira um segundo post.
   await deps.guardarNoPayload(item.id, { post_tentado_em: new Date().toISOString() });
   let postUrn: string;
   try {
     postUrn = await criarPost(
       conexao.access_token,
-      corpoDoPost({ pessoaId: conexao.pessoa_id, texto: pub.texto, imagemUrn })
+      corpoDoPost({
+        pessoaId: conexao.pessoa_id,
+        texto: pub.texto,
+        imagemUrn,
+        documento: documentoUrn ? { urn: documentoUrn, titulo: tituloDoDocumento(pub.texto) } : undefined,
+      })
     );
   } catch (err) {
     if (!(err instanceof LinkedinError) || oPostPodeTerSaido(err.status)) {
       await deps.finish(item.id, { status: "failed", error: MOTIVO_PODE_TER_SAIDO });
       return "falhou";
     }
+    // O DOCUMENTO QUE O LINKEDIN AINDA PROCESSA (a parte 3a): o 4xx prova que o post não foi criado. A linha espera
+    // um minuto e consulta de novo, até cinco vezes; na sexta, encerra com o motivo.
+    if (pub.forma === "carrossel" && aMidiaAindaNaoEstaPronta(err.status, err.texto)) {
+      if (pub.consultasDaMidia >= CONSULTAS_DA_MIDIA_MAX) {
+        await tirarAMarcaDoPost(item.id);
+        await deps.finish(item.id, { status: "failed", error: MOTIVO_MIDIA_NAO_FICOU_PRONTA });
+        return "falhou";
+      }
+      await esperarAMidia(item.id, pub.consultasDaMidia + 1);
+      return "aguardando";
+    }
     // O LinkedIn respondeu 4xx: o post não foi criado, e a marca sai. O 429 e o 409 voltam à fila; o resto encerra.
     await tirarAMarcaDoPost(item.id);
     const recusa = recusaDoLinkedin(err, conexao.nome);
```

- [ ] **Passo 4: rodar e ver passar**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-carrossel-pdf"; cd "$C" || exit 1
npx --no-install vitest run tests/linkedin-compor.test.ts tests/linkedin-forma-conhecida.test.ts tests/linkedin-post.test.ts 2>&1 | tee ../el3a-f3-green-puros.log
docker ps --format '{{.Names}} {{.Status}}' | grep metodochat-banco-de-teste   # healthy; senão, docker start e espere healthy
DATABASE_URL_TESTES=postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes npx --no-install vitest run --config vitest.integracao.config.ts testes-integracao/linkedin-carrossel.integracao.ts testes-integracao/dreno-forma-desconhecida.integracao.ts testes-integracao/linkedin-telas.integracao.ts 2>&1 | tee ../el3a-f3-green-integ.log
npx --no-install vitest run 2>&1 | tee ../el3a-f3-suite.log
npx --no-install tsc --noEmit
npx --no-install eslint lib/linkedin-fila.ts lib/linkedin-publicacao.ts lib/pdf-de-fotos.ts testes-integracao/dreno-forma-desconhecida.integracao.ts testes-integracao/linkedin-carrossel.integracao.ts testes-integracao/linkedin-telas.integracao.ts tests/linkedin-compor.test.ts tests/linkedin-forma-conhecida.test.ts tests/linkedin-post.test.ts
git diff --name-only 40b2aec -- lib/queue-drain.ts lib/fila-tipos.ts migrations scripts package.json package-lock.json   # vazio
```

Esperado: nos puros, "Test Files 3 passed (3)" e "Tests 46 passed (46)"; a integração: `ALVO: banco de TESTE`, "nenhum schema teste_tmp_* no banco" antes e depois, "Test Files 3 passed (3)" e "Tests 35 passed (35)"; a suíte pura inteira: "Test Files 160 passed (160)" e "Tests 3815 passed (3815)". O `tsc` e o lint sem saída, e a guarda vazia.

- [ ] **Passo 5: o commit**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-carrossel-pdf"; cd "$C" || exit 1
node ../varrer-texto.mjs lib/linkedin-fila.ts lib/linkedin-publicacao.ts lib/pdf-de-fotos.ts testes-integracao/dreno-forma-desconhecida.integracao.ts testes-integracao/linkedin-carrossel.integracao.ts testes-integracao/linkedin-telas.integracao.ts tests/linkedin-compor.test.ts tests/linkedin-forma-conhecida.test.ts tests/linkedin-post.test.ts && test "$(git branch --show-current)" = linkedin-carrossel-pdf && git add lib/linkedin-fila.ts lib/linkedin-publicacao.ts lib/pdf-de-fotos.ts testes-integracao/dreno-forma-desconhecida.integracao.ts testes-integracao/linkedin-carrossel.integracao.ts testes-integracao/linkedin-telas.integracao.ts tests/linkedin-compor.test.ts tests/linkedin-forma-conhecida.test.ts tests/linkedin-post.test.ts && git commit -m "O carrossel sai no LinkedIn pela fila: as fotos viram um PDF, o documento é enviado e marcado, o post espera o documento que o LinkedIn ainda processa, e o sétimo adiamento encerra a linha"
git show HEAD | git patch-id --stable | cut -c1-12   # 79de982da6e9
```

O patch-id tem de começar por `79de982da6e9` (o mesmo do plano de 12/11). Se não começar, pare.

---

### FASE 3-bis — O JPEG cru pelo processo, a mídia não pronta na resposta inteira, o motivo pela forma (219, 220 e 221), e a linha devolvida pela hora de parar sem adiamento

**Arquivos:** `lib/bonus/imagem-jpeg.ts`, `lib/linkedin-fila.ts`, `lib/linkedin-publicacao.ts`, `lib/linkedin.ts`, `lib/pdf-de-fotos.ts`, `testes-integracao/dreno-hora-de-parar.integracao.ts`, `testes-integracao/linkedin-carrossel.integracao.ts`, `testes-integracao/linkedin-publicacao.integracao.ts`, `tests/linkedin-carrossel-regras.test.ts`, `tests/linkedin-rest.test.ts`.

Sobre a 3a-0: com 5 s restando, o dreno do lote nem reivindica, então os dois casos do só texto que contam adiamento ("no sétimo adiamento" e "adiado") usam o `drenarUmaPublicacaoDoLinkedin`. E a guarda nova, no arquivo da 3a-0, prova que a linha do carrossel devolvida pela hora de parar volta com o payload igual: a devolução da 3a-0 não conta adiamento.

- [ ] **Passo 1: os testes**

Em `tests/linkedin-carrossel-regras.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/linkedin-carrossel-regras.test.ts b/tests/linkedin-carrossel-regras.test.ts
index 94b77e5..ff0945a 100644
--- a/tests/linkedin-carrossel-regras.test.ts
+++ b/tests/linkedin-carrossel-regras.test.ts
@@ -46,17 +46,28 @@ function jpeg(p: { largura: number; altura: number; sof?: number; componentes?:
 
 describe("o cabeçalho do JPEG: as medidas, os componentes e a precisão", () => {
   it("os dois JPEGs de verdade do ffmpeg: baseline, 3 componentes, 8 bits", () => {
-    expect(cabecalhoDoJpeg(FOTO_A)).toEqual({ largura: 16, altura: 20, componentes: 3, precisao: 8 });
-    expect(cabecalhoDoJpeg(FOTO_B)).toEqual({ largura: 20, altura: 16, componentes: 3, precisao: 8 });
+    expect(cabecalhoDoJpeg(FOTO_A)).toEqual({ largura: 16, altura: 20, componentes: 3, precisao: 8, marcador: 0xc0 });
+    expect(cabecalhoDoJpeg(FOTO_B)).toEqual({ largura: 20, altura: 16, componentes: 3, precisao: 8, marcador: 0xc0 });
   });
 
   it("o progressivo (SOF2), o cinza (1 componente), o CMYK (4) e o de 12 bits", () => {
-    expect(cabecalhoDoJpeg(jpeg({ largura: 1080, altura: 1350, sof: 0xc2 }))).toEqual({ largura: 1080, altura: 1350, componentes: 3, precisao: 8 });
+    expect(cabecalhoDoJpeg(jpeg({ largura: 1080, altura: 1350, sof: 0xc2 }))).toEqual({
+      largura: 1080,
+      altura: 1350,
+      componentes: 3,
+      precisao: 8,
+      marcador: 0xc2,
+    });
     expect(cabecalhoDoJpeg(jpeg({ largura: 600, altura: 600, componentes: 1 }))).toMatchObject({ componentes: 1 });
     expect(cabecalhoDoJpeg(jpeg({ largura: 600, altura: 600, componentes: 4 }))).toMatchObject({ componentes: 4 });
     expect(cabecalhoDoJpeg(jpeg({ largura: 600, altura: 600, precisao: 12 }))).toMatchObject({ precisao: 12 });
   });
 
+  it("o sem perda (C3) e o aritmético (C9) também são lidos, com o marcador de cada um", () => {
+    expect(cabecalhoDoJpeg(jpeg({ largura: 8, altura: 8, sof: 0xc3 }))).toMatchObject({ marcador: 0xc3 });
+    expect(cabecalhoDoJpeg(jpeg({ largura: 8, altura: 8, sof: 0xc9 }))).toMatchObject({ marcador: 0xc9 });
+  });
+
   it("o SOF depois de segmentos grandes (um EXIF e um perfil de cor de 60 KB cada, 120 KB antes dele) ainda é achado", () => {
     // UM SEGMENTO VAI ATÉ 64 KB (o tamanho tem dois bytes); a foto de celular com perfil de cor leva vários.
     const exif = segmento(0xe1, Array(60_000).fill(0x20));
@@ -130,6 +141,13 @@ describe("o PDF de fotos", () => {
     expect(() => pdfDeFotos([FOTO_A, new Uint8Array([1, 2, 3])])).toThrow(/foto 2/);
     expect(() => pdfDeFotos([])).toThrow();
   });
+
+  it("recusa, com o número da foto, o JPEG que o filtro do PDF não decodifica: o sem perda (C3) e o aritmético (C9)", () => {
+    // A TABELA B.1 DA NORMA DO JPEG (ITU T.81): C3, C7, CB e CF são sem perda, sem a DCT; C9 a CB e CD a CF, aritméticos.
+    expect(() => pdfDeFotos([FOTO_A, jpeg({ largura: 8, altura: 8, sof: 0xc3 })])).toThrow(/foto 2/);
+    expect(() => pdfDeFotos([jpeg({ largura: 8, altura: 8, sof: 0xc9 })])).toThrow(/foto 1/);
+    expect(comoTexto(pdfDeFotos([jpeg({ largura: 8, altura: 8, sof: 0xc1 }), jpeg({ largura: 8, altura: 8, sof: 0xc2 })]))).toContain("/Count 2");
+  });
 });
 
 describe("o título do documento no LinkedIn: o começo do texto (a decisão do Eduardo, 11/11)", () => {
@@ -182,9 +200,18 @@ describe("o carrossel no LinkedIn: só fotos, até 15 MB no total", () => {
 
 describe("o JPEG que pode ir cru com o LinkedIn marcado", () => {
   it("só o de 1 ou 3 componentes (cinza ou cor de tela); o CMYK e o que não deu para ler passam pelo canvas", () => {
-    expect(vaiCruParaOLinkedin(1)).toBe(true);
-    expect(vaiCruParaOLinkedin(3)).toBe(true);
-    for (const outro of [0, 2, 4]) expect(vaiCruParaOLinkedin(outro)).toBe(false);
+    expect(vaiCruParaOLinkedin({ componentes: 1, precisao: 8, marcador: 0xc0 })).toBe(true);
+    expect(vaiCruParaOLinkedin({ componentes: 3, precisao: 8, marcador: 0xc0 })).toBe(true);
+    for (const outro of [0, 2, 4]) expect(vaiCruParaOLinkedin({ componentes: outro, precisao: 8, marcador: 0xc0 })).toBe(false);
+    expect(vaiCruParaOLinkedin(null)).toBe(false);
+  });
+
+  it("só o baseline, o estendido e o progressivo (C0, C1 e C2), de 8 bits; o sem perda e o aritmético passam pelo canvas", () => {
+    for (const marcador of [0xc0, 0xc1, 0xc2]) expect(vaiCruParaOLinkedin({ componentes: 3, precisao: 8, marcador })).toBe(true);
+    for (const marcador of [0xc3, 0xc5, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xcf]) {
+      expect(vaiCruParaOLinkedin({ componentes: 3, precisao: 8, marcador })).toBe(false);
+    }
+    expect(vaiCruParaOLinkedin({ componentes: 3, precisao: 12, marcador: 0xc1 })).toBe(false);
   });
 });
 
```

Em `tests/linkedin-rest.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/linkedin-rest.test.ts b/tests/linkedin-rest.test.ts
index d463616..cdcd2ce 100644
--- a/tests/linkedin-rest.test.ts
+++ b/tests/linkedin-rest.test.ts
@@ -185,3 +185,23 @@ describe("a reserva e o envio do documento do carrossel", () => {
     });
   });
 });
+
+// A MÍDIA NÃO PRONTA É DECIDIDA NA RESPOSTA INTEIRA (nota da auditoria sobre a F3 da 3a). O erro guarda só os
+// primeiros 300 caracteres da resposta, para a mensagem; o código do LinkedIn pode vir depois deles, e a decisão
+// tem de ver o texto todo, dentro do `criarPost`.
+describe("o post recusado pela mídia que o LinkedIn ainda processa", () => {
+  it("o código depois dos 300 primeiros caracteres ainda conta, e o erro diz que a mídia não está pronta", async () => {
+    const longo = JSON.stringify({ message: "x".repeat(400), code: "MEDIA_ASSET_WAITING_UPLOAD" });
+    vi.stubGlobal("fetch", async () => new Response(longo, { status: 400 }));
+    await expect(criarPost("token-de-teste", { author: "urn:li:person:x" })).rejects.toMatchObject({
+      name: "LinkedinError",
+      status: 400,
+      midiaNaoPronta: true,
+    });
+  });
+
+  it("o outro 400, e o post que deu certo, não", async () => {
+    vi.stubGlobal("fetch", async () => new Response('{"code":"INVALID_URN_TYPE"}', { status: 400 }));
+    await expect(criarPost("token-de-teste", { author: "urn:li:person:x" })).rejects.toMatchObject({ status: 400, midiaNaoPronta: false });
+  });
+});
```

Em `testes-integracao/linkedin-carrossel.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/linkedin-carrossel.integracao.ts b/testes-integracao/linkedin-carrossel.integracao.ts
index 7f05bbc..affd82c 100644
--- a/testes-integracao/linkedin-carrossel.integracao.ts
+++ b/testes-integracao/linkedin-carrossel.integracao.ts
@@ -288,7 +288,8 @@ describe("o carrossel em PDF no LinkedIn", () => {
     await dreno.drainQueue({ inicioDaFuncaoMs: restando(40_000) });
 
     expect(linkedin.pedidos).toEqual([]);
-    expect(await linha(id)).toMatchObject({ status: "failed", error: fila.MOTIVO_SEM_TEMPO_DEMAIS });
+    expect(await linha(id)).toMatchObject({ status: "failed", error: fila.MOTIVO_SEM_TEMPO_DEMAIS_NO_CARROSSEL });
+    expect(fila.MOTIVO_SEM_TEMPO_DEMAIS_NO_CARROSSEL).toContain("menos fotos");
   });
 
   it("a foto que não é JPEG encerra a linha antes de qualquer chamada ao LinkedIn, dizendo qual foto", async () => {
```

Em `testes-integracao/linkedin-publicacao.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/linkedin-publicacao.integracao.ts b/testes-integracao/linkedin-publicacao.integracao.ts
index 949dcd4..cb0de0c 100644
--- a/testes-integracao/linkedin-publicacao.integracao.ts
+++ b/testes-integracao/linkedin-publicacao.integracao.ts
@@ -461,6 +461,26 @@ describe("o post do LinkedIn não começa o que a função não tem tempo de ter
     expect((linha.payload as Record<string, unknown>).post_tentado_em ?? null).toBeNull();
   });
 
+  // O TETO DOS ADIAMENTOS VALE PARA TODA FORMA (a parte 3a; nota da auditoria): antes, a volta sem tempo não tinha
+  // teto. O motivo do só texto e o da imagem não falam em fotos. PELO DRENO DE UMA LINHA SÓ: com 5 s restando, o dreno
+  // do lote nem reivindica (a hora de parar da 3a-0), e a regra do próprio post só é vista aqui.
+  it("só texto, no sétimo adiamento: não chama o LinkedIn, e a linha vai a failed com o motivo sem falar em fotos", async () => {
+    await enfileirarTexto();
+    await q(`update queue set payload = payload || '{"adiamentos":6}'::jsonb where kind = 'publicacao_linkedin'`);
+    const id = String((await linhaDoLinkedin()).id);
+    await dreno.drenarUmaPublicacaoDoLinkedin(id, restando(5_000));
+    expect(linkedin.pedidos).toEqual([]);
+    expect(await linhaCompleta()).toMatchObject({ status: "failed", error: fila.MOTIVO_SEM_TEMPO_DEMAIS });
+    expect(fila.MOTIVO_SEM_TEMPO_DEMAIS).not.toContain("foto");
+  });
+
+  it("só texto, adiado: o adiamento fica contado no payload", async () => {
+    await enfileirarTexto();
+    const id = String((await linhaDoLinkedin()).id);
+    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id, restando(5_000))).toBe("aguardando");
+    expect((await linhaCompleta()).payload).toMatchObject({ adiamentos: 1 });
+  });
+
   it("imagem, com 25 s restando: não baixa, não reserva e volta pending", async () => {
     await enfileirarImagem();
     await dreno.drainQueue({ inicioDaFuncaoMs: restando(25_000) });
```

Em `testes-integracao/dreno-hora-de-parar.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/dreno-hora-de-parar.integracao.ts b/testes-integracao/dreno-hora-de-parar.integracao.ts
index 840cca9..929227b 100644
--- a/testes-integracao/dreno-hora-de-parar.integracao.ts
+++ b/testes-integracao/dreno-hora-de-parar.integracao.ts
@@ -330,6 +330,26 @@ describe("a hora de parar, no laço", () => {
     expect(await linha(encerrada)).toMatchObject({ status: "skipped", error: "encerrada por outro" });
     expect(resumo.devolvidos).toBe(1);
   });
+
+  // A LINHA DO CARROSSEL DEVOLVIDA PELA HORA DE PARAR NÃO GANHA ADIAMENTO (a parte 3a): a devolução só escreve o
+  // status, a tentativa e o `not_before`. O `adiamentos` é da regra do próprio post do LinkedIn, quando um passo dele
+  // não cabe, e esta linha nem chegou a ser vista.
+  it("a linha do carrossel do LinkedIn devolvida pela hora de parar não ganha adiamento, e volta com a tentativa de antes", async () => {
+    await postDoLinkedinAdiado();
+    const antes = { forma: "carrossel", caminhos: [`${CONTA}/foto-1.jpg`, `${CONTA}/foto-2.jpg`], texto: "O carrossel que vem depois" };
+    const [carrossel] = (await q(
+      `insert into queue (account_id, kind, payload, dedupe_key, not_before)
+       values ($1, 'publicacao_linkedin', $2, 'hora-de-parar:carrossel', now() - interval '1 minute')
+       returning id`,
+      [CONTA, antes]
+    )) as { id: string }[];
+    linkedin.atrasoMs = 2_000;
+    const resumo = await dreno.drainQueue({ inicioDaFuncaoMs: haTrintaENoveSegundos() });
+    expect(await linha(carrossel.id)).toMatchObject({ status: "pending", attempts: 0, error: null, vencida: true });
+    expect(await payloadDe(carrossel.id)).toEqual(antes);
+    expect(resumo.devolvidos).toBe(1);
+    expect(linkedin.pedidos).toEqual(["POST /rest/posts"]);
+  });
 });
 
 describe("sem passar da hora de parar, o dreno é o de hoje", () => {
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-carrossel-pdf"; cd "$C" || exit 1
npx --no-install vitest run tests/linkedin-carrossel-regras.test.ts tests/linkedin-rest.test.ts 2>&1 | tee ../el3a-f3bis-red-puros.log
docker ps --format '{{.Names}} {{.Status}}' | grep metodochat-banco-de-teste   # healthy; senão, docker start e espere healthy
DATABASE_URL_TESTES=postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes npx --no-install vitest run --config vitest.integracao.config.ts testes-integracao/linkedin-carrossel.integracao.ts testes-integracao/linkedin-publicacao.integracao.ts testes-integracao/dreno-hora-de-parar.integracao.ts 2>&1 | tee ../el3a-f3bis-red-integ.log
```

Esperado: nos puros, "Test Files 2 failed (2)" e "Tests 8 failed | 31 passed (39)": o marcador do cabeçalho, o JPEG cru pelo processo e a mídia não pronta na resposta inteira (`midiaNaoPronta`) ainda não existem. Na integração, `ALVO: banco de TESTE`, nenhum `teste_tmp` antes e depois, "Test Files 2 failed | 1 passed (3)" e "Tests 2 failed | 53 passed (55)": caem "o sétimo adiamento encerra a linha, sem chamar o LinkedIn" (o motivo do carrossel) e "só texto, no sétimo adiamento: …" (o motivo sem fotos, agora pelo "agora" com 5 s restando). Passam já, de propósito: o "só texto, adiado" (a contagem dos adiamentos vem da FASE 3) e a guarda nova da hora de parar (a devolução da 3a-0 nunca toca no payload; a mutação F3-9 mostra que ela cai quando a devolução conta adiamento).

- [ ] **Passo 3: o código**

Em `lib/bonus/imagem-jpeg.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/imagem-jpeg.ts b/lib/bonus/imagem-jpeg.ts
index ec11c80..936f37c 100644
--- a/lib/bonus/imagem-jpeg.ts
+++ b/lib/bonus/imagem-jpeg.ts
@@ -24,10 +24,12 @@ export function medidasDoJpeg(b: Uint8Array): MedidasDoJpeg | null {
 
 /**
  * O CABEÇALHO DO JPEG, lido do mesmo segmento SOF: as medidas, os componentes de cor (1 é cinza, 3 é a cor de tela,
- * 4 é o CMYK da gráfica) e a precisão em bits. É o que o PDF de fotos do LinkedIn precisa para pôr a foto como ela
- * está (a parte 3a: lib/pdf-de-fotos.ts), e o que a tela de publicar lê para decidir se a foto vai crua.
+ * 4 é o CMYK da gráfica), a precisão em bits e o próprio marcador do SOF, que diz o processo (C0 o baseline, C1 o
+ * estendido, C2 o progressivo; C3, C7, CB e CF os sem perda; de C9 a CB e de CD a CF os aritméticos: a tabela B.1 da
+ * norma, ITU T.81). É o que o PDF de fotos do LinkedIn precisa para pôr a foto como ela está (a parte 3a:
+ * lib/pdf-de-fotos.ts), e o que a tela de publicar lê para decidir se a foto vai crua.
  */
-export type CabecalhoDoJpeg = MedidasDoJpeg & { componentes: number; precisao: number };
+export type CabecalhoDoJpeg = MedidasDoJpeg & { componentes: number; precisao: number; marcador: number };
 
 export function cabecalhoDoJpeg(b: Uint8Array): CabecalhoDoJpeg | null {
   if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
@@ -48,7 +50,7 @@ export function cabecalhoDoJpeg(b: Uint8Array): CabecalhoDoJpeg | null {
       const altura = (b[i + 5] << 8) | b[i + 6];
       const largura = (b[i + 7] << 8) | b[i + 8];
       const componentes = b[i + 9];
-      return largura > 0 && altura > 0 ? { largura, altura, componentes, precisao } : null;
+      return largura > 0 && altura > 0 ? { largura, altura, componentes, precisao, marcador: marca } : null;
     }
     i += 2 + tamanho;
   }
```

Em `lib/linkedin-publicacao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/linkedin-publicacao.ts b/lib/linkedin-publicacao.ts
index 0b3e010..9858c73 100644
--- a/lib/linkedin-publicacao.ts
+++ b/lib/linkedin-publicacao.ts
@@ -455,10 +455,18 @@ export function textoDoProblemaDoCarrosselNoLinkedin(p: ProblemaDoCarrosselNoLin
 }
 
 /**
- * O JPEG QUE PODE IR CRU, SEM O CANVAS, QUANDO O LINKEDIN ESTÁ MARCADO NO CARROSSEL: só o de 1 ou 3 componentes (cinza
- * ou cor de tela), que o PDF de fotos aceita como está (lib/pdf-de-fotos.ts). O CMYK de gráfica, e o que não deu para
- * ler (0), passam pelo canvas, que devolve cor de tela. Sem o LinkedIn, a regra do Instagram não muda.
+ * O JPEG QUE VAI COMO ESTÁ PARA O PDF DO CARROSSEL, e o que pode ir cru, sem o canvas, quando o LinkedIn está marcado
+ * no carrossel: uma regra só, para a tela e para o PDF (lib/pdf-de-fotos.ts).
+ *   - 1 ou 3 componentes (cinza ou cor de tela): o CMYK de gráfica pediria a inversão do Adobe, que nem todo leitor
+ *     faz igual;
+ *   - 8 bits: o de 12 não é aceito pelo filtro do PDF em todo lugar;
+ *   - o baseline, o estendido ou o progressivo (C0, C1 e C2), que usam a DCT do filtro /DCTDecode. O sem perda e o
+ *     aritmético não (nota da auditoria sobre a F1 da 3a).
+ * O resto, e o que não deu para ler (null), passa pelo canvas, que devolve um JPEG baseline de cor de tela. Sem o
+ * LinkedIn, a regra do Instagram não muda.
  */
-export function vaiCruParaOLinkedin(componentes: number): boolean {
-  return componentes === 1 || componentes === 3;
+const MARCADORES_DA_DCT = new Set([0xc0, 0xc1, 0xc2]);
+
+export function vaiCruParaOLinkedin(c: { componentes: number; precisao: number; marcador: number } | null): boolean {
+  return !!c && (c.componentes === 1 || c.componentes === 3) && c.precisao === 8 && MARCADORES_DA_DCT.has(c.marcador);
 }
```

Em `lib/pdf-de-fotos.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/pdf-de-fotos.ts b/lib/pdf-de-fotos.ts
index 3f0f486..fae7b72 100644
--- a/lib/pdf-de-fotos.ts
+++ b/lib/pdf-de-fotos.ts
@@ -9,11 +9,13 @@
 // processamento além de juntar os bytes. As medidas e as cores saem do cabeçalho do JPEG (`cabecalhoDoJpeg`). A
 // página tem o tamanho da foto, um ponto por pixel: quem mostra o PDF o escala, e a proporção é o que conta.
 //
-// SÓ CINZA E COR DE TELA (1 ou 3 componentes), DE 8 BITS. O CMYK de gráfica pediria a inversão do Adobe, que nem todo
-// leitor faz igual, e o de 12 bits não é aceito pelo filtro em todo lugar. A tela de publicar converte para JPEG de
+// SÓ CINZA E COR DE TELA (1 ou 3 componentes), DE 8 BITS, E SÓ OS PROCESSOS DA DCT (C0, C1 e C2). O CMYK de gráfica
+// pediria a inversão do Adobe, que nem todo leitor faz igual; o de 12 bits não é aceito pelo filtro em todo lugar; e o
+// sem perda e o aritmético não são decodificados pelo /DCTDecode. A tela de publicar converte para JPEG de
 // cor de tela, pelo canvas, toda foto que não sirva quando o LinkedIn está marcado (`vaiCruParaOLinkedin`), então
 // esta recusa só se alcança por um pedido montado à mão.
 import { cabecalhoDoJpeg } from "./bonus/imagem-jpeg";
+import { vaiCruParaOLinkedin } from "./linkedin-publicacao";
 
 const ESPACO_DE_COR: Record<number, string> = { 1: "/DeviceGray", 3: "/DeviceRGB" };
 
@@ -22,11 +24,11 @@ export function pdfDeFotos(fotos: readonly Uint8Array[]): Uint8Array<ArrayBuffer
   if (fotos.length === 0) throw new Error("o PDF precisa de ao menos uma foto");
   const paginas = fotos.map((foto, i) => {
     const c = cabecalhoDoJpeg(foto);
-    const cor = c ? ESPACO_DE_COR[c.componentes] : undefined;
-    if (!c || !cor || c.precisao !== 8) {
-      throw new Error(`a foto ${i + 1} não é um JPEG de 8 bits em cor de tela (RGB) ou em tons de cinza`);
+    // A MESMA REGRA DA TELA (`vaiCruParaOLinkedin`): 1 ou 3 componentes, 8 bits e um processo da DCT.
+    if (!c || !vaiCruParaOLinkedin(c)) {
+      throw new Error(`a foto ${i + 1} não é um JPEG comum de 8 bits em cor de tela (RGB) ou em tons de cinza`);
     }
-    return { foto, largura: c.largura, altura: c.altura, cor };
+    return { foto, largura: c.largura, altura: c.altura, cor: ESPACO_DE_COR[c.componentes] };
   });
 
   // OS OBJETOS: 1 o catálogo, 2 as páginas, e três por página (a página, o desenho dela e a imagem).
```

Em `lib/linkedin.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/linkedin.ts b/lib/linkedin.ts
index 6c3ef29..0fc6fe6 100644
--- a/lib/linkedin.ts
+++ b/lib/linkedin.ts
@@ -7,6 +7,8 @@ import "server-only";
 // AS CHAVES DO APP (`LINKEDIN_CLIENT_ID` e `LINKEDIN_CLIENT_SECRET`) FICAM SÓ NAS VARIÁVEIS DA VERCEL, nunca no
 // código nem no banco, porque o repositório é público (§8). Sem as duas, o LinkedIn fica desligado no painel.
 
+import { aMidiaAindaNaoEstaPronta } from "./linkedin-publicacao";
+
 const OAUTH = "https://www.linkedin.com";
 const API = "https://api.linkedin.com";
 
@@ -95,11 +97,18 @@ export function temPermissaoDePublicar(scope: unknown): boolean {
 export class LinkedinError extends Error {
   status: number;
   texto: string;
-  constructor(status: number, texto: string) {
+  /**
+   * O POST RECUSADO PORQUE O LINKEDIN AINDA PROCESSA A MÍDIA (a parte 3a), decidido na resposta INTEIRA dentro do
+   * `criarPost` (`aMidiaAindaNaoEstaPronta`): o `texto` guarda só o começo dela, para a mensagem, e o código do
+   * LinkedIn pode vir depois (nota da auditoria sobre a F3).
+   */
+  midiaNaoPronta: boolean;
+  constructor(status: number, texto: string, midiaNaoPronta = false) {
     super(`LinkedIn ${status}: ${texto}`);
     this.name = "LinkedinError";
     this.status = status;
     this.texto = texto;
+    this.midiaNaoPronta = midiaNaoPronta;
   }
 }
 
@@ -296,7 +305,7 @@ export async function criarPost(token: string, corpo: Record<string, unknown>):
     headers: cabecalhosDoRest(token),
     body: JSON.stringify(corpo),
   });
-  if (r.status !== 201) throw new LinkedinError(r.status, r.texto.slice(0, 300));
+  if (r.status !== 201) throw new LinkedinError(r.status, r.texto.slice(0, 300), aMidiaAindaNaoEstaPronta(r.status, r.texto));
   if (!r.restliId) throw new LinkedinError(r.status, "o post saiu sem o x-restli-id");
   return r.restliId;
 }
```

Em `lib/linkedin-fila.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/linkedin-fila.ts b/lib/linkedin-fila.ts
index 3f740ea..361376d 100644
--- a/lib/linkedin-fila.ts
+++ b/lib/linkedin-fila.ts
@@ -21,7 +21,6 @@ import {
   TETO_DO_LINKEDIN_MS,
 } from "./linkedin";
 import {
-  aMidiaAindaNaoEstaPronta,
   corpoDoPost,
   desfechoDoErroDoLinkedin,
   lerPayloadDoLinkedin,
@@ -189,7 +188,8 @@ const VOLTA_SEM_TEMPO_EM_SEGUNDOS = 20;
  * adiada vai primeiro (`naOrdemDoLote`, lib/fila-tipos.ts), e começa com o prazo quase inteiro.
  */
 export const ADIAMENTOS_MAX = 6;
-export const MOTIVO_SEM_TEMPO_DEMAIS = "o post não coube no tempo de nenhuma passada; publique de novo, com menos fotos";
+export const MOTIVO_SEM_TEMPO_DEMAIS = "o post não coube no tempo de nenhuma passada; publique de novo";
+export const MOTIVO_SEM_TEMPO_DEMAIS_NO_CARROSSEL = "o post não coube no tempo de nenhuma passada; publique de novo, com menos fotos";
 /**
  * O DOCUMENTO QUE O LINKEDIN AINDA PROCESSA (a parte 3a): a linha volta em um minuto, até cinco consultas, como a
  * espera do contêiner da Meta. Na sexta, ela encerra com o motivo.
@@ -220,7 +220,9 @@ async function adiarOuEncerrar(
   deps: DependenciasDoDreno
 ): Promise<DesfechoDoPostNoLinkedin> {
   if (pub.adiamentos >= ADIAMENTOS_MAX) {
-    await deps.finish(item.id, { status: "failed", error: MOTIVO_SEM_TEMPO_DEMAIS });
+    // O MOTIVO PELA FORMA: só o carrossel fala em fotos (nota da auditoria sobre a F3).
+    const motivo = pub.forma === "carrossel" ? MOTIVO_SEM_TEMPO_DEMAIS_NO_CARROSSEL : MOTIVO_SEM_TEMPO_DEMAIS;
+    await deps.finish(item.id, { status: "failed", error: motivo });
     return "falhou";
   }
   await devolverSemGastarTentativa(item.id, pub.adiamentos + 1);
@@ -397,7 +399,7 @@ export async function publicarNoLinkedinDaFila(item: QueueItem, deps: Dependenci
     }
     // O DOCUMENTO QUE O LINKEDIN AINDA PROCESSA (a parte 3a): o 4xx prova que o post não foi criado. A linha espera
     // um minuto e consulta de novo, até cinco vezes; na sexta, encerra com o motivo.
-    if (pub.forma === "carrossel" && aMidiaAindaNaoEstaPronta(err.status, err.texto)) {
+    if (pub.forma === "carrossel" && err.midiaNaoPronta) {
       if (pub.consultasDaMidia >= CONSULTAS_DA_MIDIA_MAX) {
         await tirarAMarcaDoPost(item.id);
         await deps.finish(item.id, { status: "failed", error: MOTIVO_MIDIA_NAO_FICOU_PRONTA });
```

- [ ] **Passo 4: rodar e ver passar**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-carrossel-pdf"; cd "$C" || exit 1
npx --no-install vitest run tests/linkedin-carrossel-regras.test.ts tests/linkedin-rest.test.ts 2>&1 | tee ../el3a-f3bis-green-puros.log
docker ps --format '{{.Names}} {{.Status}}' | grep metodochat-banco-de-teste   # healthy; senão, docker start e espere healthy
DATABASE_URL_TESTES=postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes npx --no-install vitest run --config vitest.integracao.config.ts testes-integracao/linkedin-carrossel.integracao.ts testes-integracao/linkedin-publicacao.integracao.ts testes-integracao/dreno-hora-de-parar.integracao.ts 2>&1 | tee ../el3a-f3bis-green-integ.log
npx --no-install vitest run 2>&1 | tee ../el3a-f3bis-suite.log
npx --no-install tsc --noEmit
npx --no-install eslint lib/bonus/imagem-jpeg.ts lib/linkedin-fila.ts lib/linkedin-publicacao.ts lib/linkedin.ts lib/pdf-de-fotos.ts testes-integracao/dreno-hora-de-parar.integracao.ts testes-integracao/linkedin-carrossel.integracao.ts testes-integracao/linkedin-publicacao.integracao.ts tests/linkedin-carrossel-regras.test.ts tests/linkedin-rest.test.ts
git diff --name-only 40b2aec -- lib/queue-drain.ts lib/fila-tipos.ts migrations scripts package.json package-lock.json   # vazio
```

Esperado: nos puros, "Test Files 2 passed (2)" e "Tests 39 passed (39)"; a integração: `ALVO: banco de TESTE`, "nenhum schema teste_tmp_* no banco" antes e depois, "Test Files 3 passed (3)" e "Tests 55 passed (55)"; a suíte pura inteira: "Test Files 160 passed (160)" e "Tests 3820 passed (3820)". O `tsc` e o lint sem saída, e a guarda vazia.

- [ ] **Passo 5: o commit**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-carrossel-pdf"; cd "$C" || exit 1
node ../varrer-texto.mjs lib/bonus/imagem-jpeg.ts lib/linkedin-fila.ts lib/linkedin-publicacao.ts lib/linkedin.ts lib/pdf-de-fotos.ts testes-integracao/dreno-hora-de-parar.integracao.ts testes-integracao/linkedin-carrossel.integracao.ts testes-integracao/linkedin-publicacao.integracao.ts tests/linkedin-carrossel-regras.test.ts tests/linkedin-rest.test.ts && test "$(git branch --show-current)" = linkedin-carrossel-pdf && git add lib/bonus/imagem-jpeg.ts lib/linkedin-fila.ts lib/linkedin-publicacao.ts lib/linkedin.ts lib/pdf-de-fotos.ts testes-integracao/dreno-hora-de-parar.integracao.ts testes-integracao/linkedin-carrossel.integracao.ts testes-integracao/linkedin-publicacao.integracao.ts tests/linkedin-carrossel-regras.test.ts tests/linkedin-rest.test.ts && git commit -m "O carrossel do LinkedIn só leva cru o JPEG que o PDF decodifica, decide a mídia não pronta na resposta inteira, o sétimo adiamento só fala em fotos no carrossel, e a linha devolvida pela hora de parar não ganha adiamento"
git show HEAD | git patch-id --stable | cut -c1-12   # 9ee1c9da8cad
```

O patch-id tem de começar por `9ee1c9da8cad` (mudou em relação ao plano de 12/11; ver "O que mudou"). Se não começar, pare.

---

### FASE 4 — O carrossel nas duas redes e só no LinkedIn, e o vídeo não vai ao LinkedIn

**Arquivos:** `app/publicar/actions.ts`, `lib/linkedin-copia.ts`, `lib/linkedin-publicacao.ts`, `testes-integracao/linkedin-compor.integracao.ts`, `testes-integracao/linkedin-duas-redes.integracao.ts`, `tests/linkedin-compor.test.ts`, `tests/linkedin-copia.test.ts`.

- [ ] **Passo 1: os testes**

Em `tests/linkedin-compor.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/linkedin-compor.test.ts b/tests/linkedin-compor.test.ts
index 93dd62a..c2c1765 100644
--- a/tests/linkedin-compor.test.ts
+++ b/tests/linkedin-compor.test.ts
@@ -7,6 +7,7 @@ import {
   recusaDoPedidoNoLinkedin,
   tamanhoDoTextoNoLinkedin,
   textoDaRecusaNoLinkedin,
+  textoDoProblemaDoCarrosselNoLinkedin,
 } from "@/lib/linkedin-publicacao";
 
 // O COMPOR DO POST NO LINKEDIN (docs/specs/2026-11-06-linkedin-no-perfil.md, §7; a parte 2a). A tela confere o
@@ -40,6 +41,16 @@ describe("as recusas do pedido de publicar no LinkedIn", () => {
     expect(pedido({ forma: "carrossel", caminhos: Array(10).fill("conta/a.jpg") })).toBeNull();
   });
 
+  // O PDF DO CARROSSEL SÓ LEVA FOTOS (a parte 3a). O carrossel do Instagram aceita vídeo nos itens; o do LinkedIn não.
+  // O vídeo é reconhecido pela extensão do caminho, como o dreno do Instagram decide (`pareceVideo`, lib/publicacao.ts).
+  it("o carrossel com vídeo não vai ao LinkedIn, com a frase da tela", () => {
+    expect(pedido({ forma: "carrossel", caminhos: ["conta/a.jpg", "conta/b.mp4"] })).toBe("carrossel_com_video");
+    expect(pedido({ forma: "carrossel", caminhos: ["conta/a.mov", "conta/b.jpg"] })).toBe("carrossel_com_video");
+    // A quantidade vem antes: um vídeo sozinho já não é carrossel.
+    expect(pedido({ forma: "carrossel", caminhos: ["conta/b.mp4"] })).toBe("quantidade");
+    expect(textoDaRecusaNoLinkedin("carrossel_com_video")).toBe(textoDoProblemaDoCarrosselNoLinkedin("video"));
+  });
+
   it("o texto vazio, nas duas formas", () => {
     expect(pedido({ texto: "   " })).toBe("texto_vazio");
     expect(pedido({ forma: "imagem", caminhos: ["conta/foto.jpg"], texto: "" })).toBe("texto_vazio");
@@ -69,10 +80,10 @@ describe("as recusas do pedido de publicar no LinkedIn", () => {
   });
 
   it("cada recusa tem a sua frase, e a do texto longo diz por que conta mais", () => {
-    const frases = (["forma_desconhecida", "quantidade", "texto_vazio", "texto_longo", "envio_sem_id"] as const).map(
-      textoDaRecusaNoLinkedin
-    );
-    expect(new Set(frases).size).toBe(5);
+    const frases = (
+      ["forma_desconhecida", "quantidade", "carrossel_com_video", "texto_vazio", "texto_longo", "envio_sem_id"] as const
+    ).map(textoDaRecusaNoLinkedin);
+    expect(new Set(frases).size).toBe(6);
     expect(textoDaRecusaNoLinkedin("texto_longo")).toContain("3.000");
     expect(textoDaRecusaNoLinkedin("texto_longo")).toContain("hashtags");
     expect(textoDaRecusaNoLinkedin("forma_desconhecida")).toBe("Escolha a forma do post no LinkedIn: só texto, imagem ou carrossel.");
```

Em `tests/linkedin-copia.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/linkedin-copia.test.ts b/tests/linkedin-copia.test.ts
index a370b95..1f9d109 100644
--- a/tests/linkedin-copia.test.ts
+++ b/tests/linkedin-copia.test.ts
@@ -10,7 +10,9 @@ process.env.SUPABASE_URL = "https://exemplo.supabase.co";
 process.env.SUPABASE_SERVICE_ROLE_KEY = "chave-de-teste-que-nao-vale-nada";
 process.env.SUPABASE_BUCKET = "MetodoChat";
 
-const { copiarImagemParaOLinkedin, TETO_DA_COPIA_BYTES, TETO_DA_COPIA_MS } = await import("@/lib/linkedin-copia");
+const { copiarAsImagensParaOLinkedin, copiarImagemParaOLinkedin, TETO_DA_COPIA_BYTES, TETO_DA_COPIA_MS } = await import(
+  "@/lib/linkedin-copia"
+);
 
 const CONTA = "17841400000000001";
 const OUTRA = "17841400000000002";
@@ -168,3 +170,87 @@ describe("copiar a imagem do post para a linha do LinkedIn", () => {
     expect(chamadas.map((c) => c.metodo)).toEqual(["GET", "POST", "PUT"]);
   });
 });
+
+// AS CÓPIAS DO CARROSSEL NAS DUAS REDES (a parte 3a; scratchpad/desenho-li3.md, "As duas redes"): uma por foto, EM
+// PARALELO, na ordem das originais (a ordem é a das páginas do PDF). O pior caso é o de uma cópia só, três chamadas
+// de até 10 s, e não dez vezes isso. Se uma falha, as outras terminam, as que deram certo são apagadas, e o erro sobe.
+describe("copiar as fotos do carrossel para a linha do LinkedIn", () => {
+  const ORIGENS = [1, 2, 3].map((n) => `${CONTA}/foto-${n}.jpg`);
+  const assinar = (c: Chamada) => {
+    const caminho = c.url.split("/object/upload/sign/MetodoChat/")[1];
+    return Response.json({ url: `/object/upload/sign/MetodoChat/${caminho}?token=t`, token: "t" });
+  };
+  const caminhoDaSubida = (c: Chamada) => c.url.split("/object/upload/sign/MetodoChat/")[1].split("?")[0];
+
+  it("uma cópia por foto, na ordem das originais, mesmo quando a última responde primeiro", async () => {
+    responder = async (c) => {
+      if (c.metodo === "POST") return assinar(c);
+      if (c.metodo === "GET") {
+        const n = Number(/foto-(\d+)\.jpg$/.exec(c.url)?.[1]);
+        await new Promise((pronto) => setTimeout(pronto, (4 - n) * 20));
+        return new Response(new Uint8Array([0xff, 0xd8, n]), { status: 200 });
+      }
+      return new Response("{}", { status: 200 });
+    };
+    const copias = await copiarAsImagensParaOLinkedin(ORIGENS, CONTA);
+    expect(copias).toHaveLength(3);
+    expect(new Set(copias).size).toBe(3);
+    for (const [i, copia] of copias.entries()) {
+      expect(copia).toMatch(new RegExp(`^${CONTA}/[0-9a-f-]{36}\\.jpg$`));
+      const subida = chamadas.find((c) => c.metodo === "PUT" && caminhoDaSubida(c) === copia);
+      expect(Array.from(subida?.corpo as Uint8Array)).toEqual([0xff, 0xd8, i + 1]);
+    }
+  });
+
+  it("em paralelo: com cada chamada no limite do teto, dez cópias levam o tempo de uma (três tetos), e não dez vezes isso", async () => {
+    vi.useFakeTimers();
+    const dez = Array.from({ length: 10 }, (_, i) => `${CONTA}/foto-${i + 1}.jpg`);
+    const quase = TETO_DA_COPIA_MS - 1;
+    responder = (c) =>
+      new Promise<Response>((pronto) =>
+        setTimeout(
+          () => pronto(c.metodo === "POST" ? assinar(c) : c.metodo === "GET" ? new Response(JPEG, { status: 200 }) : new Response("{}", { status: 200 })),
+          quase
+        )
+      );
+    let terminou = false;
+    const feitas = copiarAsImagensParaOLinkedin(dez, CONTA).then((copias) => {
+      terminou = true;
+      return copias;
+    });
+    await vi.advanceTimersByTimeAsync(3 * quase - 1);
+    expect(terminou).toBe(false);
+    await vi.advanceTimersByTimeAsync(1);
+    expect(terminou).toBe(true);
+    await expect(feitas).resolves.toHaveLength(10);
+    expect(chamadas.filter((c) => c.metodo === "GET")).toHaveLength(10);
+  });
+
+  it("uma cópia que falha: as outras terminam, as que subiram são apagadas, e o erro é o da que falhou", async () => {
+    let subidas = 0;
+    responder = async (c) => {
+      if (c.metodo === "POST") return assinar(c);
+      if (c.metodo === "GET") return new Response(JPEG, { status: 200 });
+      if (c.metodo === "PUT") {
+        subidas++;
+        if (subidas === 1) return new Response("{}", { status: 400 });
+        // AS OUTRAS TERMINAM DEPOIS DA FALHA: quem não espera por elas não tem o que apagar, e elas sobram no bucket.
+        await new Promise((pronto) => setTimeout(pronto, 50));
+        return new Response("{}", { status: 200 });
+      }
+      return new Response("{}", { status: 200 });
+    };
+    const erro = await copiarAsImagensParaOLinkedin(ORIGENS, CONTA).catch((e: Error) => e);
+    expect(erro).toBeInstanceOf(Error);
+    expect((erro as Error).message).toMatch(/recusou a cópia \(HTTP 400\)/);
+    const subiram = chamadas.filter((c) => c.metodo === "PUT").map(caminhoDaSubida);
+    const apagadas = chamadas.filter((c) => c.metodo === "DELETE").map((c) => c.url.split("/object/MetodoChat/")[1]);
+    expect(subiram).toHaveLength(3);
+    expect([...apagadas].sort()).toEqual(subiram.slice(1).sort());
+  });
+
+  it("a lista vazia é recusada antes de qualquer chamada", async () => {
+    await expect(copiarAsImagensParaOLinkedin([], CONTA)).rejects.toThrow(/nenhuma imagem/);
+    expect(chamadas).toEqual([]);
+  });
+});
```

Em `testes-integracao/linkedin-compor.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/linkedin-compor.integracao.ts b/testes-integracao/linkedin-compor.integracao.ts
index 1ece954..21525d5 100644
--- a/testes-integracao/linkedin-compor.integracao.ts
+++ b/testes-integracao/linkedin-compor.integracao.ts
@@ -220,6 +220,32 @@ describe("agendar no LinkedIn", () => {
   });
 });
 
+// O CARROSSEL SÓ NO LINKEDIN (a parte 3a): a forma já é aceita pela lista única (`FORMAS_NO_LINKEDIN`, desde a F3), e a
+// linha leva os caminhos da pasta da conta, na ordem, com a chave por eles.
+describe("o carrossel só no LinkedIn", () => {
+  it("agendado: as fotos da pasta da conta vão à linha na ordem, a chave é por elas, e ninguém fala com o LinkedIn", async () => {
+    const fotos = [3, 1, 2].map((n) => `${CONTA_A}/foto-${n}.jpg`);
+    const alvo = new Date(Date.now() + 2 * 3600 * 1000);
+    alvo.setUTCSeconds(0, 0);
+    const aviso = await publicarComoAdministrador(
+      formulario({
+        forma_linkedin: "carrossel",
+        caminhos: fotos.join("\n"),
+        quando: "depois",
+        data_hora: alvo.toISOString().slice(0, 16),
+        fuso: "0",
+      })
+    );
+    expect(aviso.tom).toBe("ok");
+    expect(aviso.texto).toContain("agendado para");
+    const [linha] = await q(`select status, dedupe_key, payload from queue`);
+    expect(linha.status).toBe("pending");
+    expect(linha.payload).toMatchObject({ forma: "carrossel", caminhos: fotos });
+    expect(linha.dedupe_key).toBe(`pub-linkedin:${CONTA_A}:carrossel:${fotos.join(",")}`);
+    expect(linkedin.pedidos).toEqual([]);
+  });
+});
+
 describe("as recusas: nenhuma linha entra", () => {
   const casos: [string, Partial<Record<string, string>>, string][] = [
     ["a forma desconhecida", { forma_linkedin: "reels" }, "forma_desconhecida"],
@@ -230,6 +256,14 @@ describe("as recusas: nenhuma linha entra", () => {
     // 2.998 caracteres digitados, e mais de 3.000 no LinkedIn: o servidor conta como o contador.
     ["o texto longo depois das hashtags", { texto: `${"a".repeat(2990)} #ab #cd` }, "texto_longo"],
     ["o envio sem id", { id_do_envio: "" }, "envio_sem_id"],
+    // O CARROSSEL (a parte 3a): de 2 a 10 fotos, todas da pasta da conta, e nenhum vídeo, que o PDF não leva.
+    ["o carrossel com uma foto só", { forma_linkedin: "carrossel", caminhos: `${CONTA_A}/a.jpg` }, "quantidade"],
+    [
+      "o carrossel com a foto de outra conta (descartada, e sobra uma)",
+      { forma_linkedin: "carrossel", caminhos: `${CONTA_A}/a.jpg\n${CONTA_B}/b.jpg` },
+      "quantidade",
+    ],
+    ["o carrossel com vídeo", { forma_linkedin: "carrossel", caminhos: `${CONTA_A}/a.jpg\n${CONTA_A}/b.mp4` }, "carrossel_com_video"],
   ];
   for (const [nome, campos, recusa] of casos) {
     it(nome, async () => {
```

Em `testes-integracao/linkedin-duas-redes.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/linkedin-duas-redes.integracao.ts b/testes-integracao/linkedin-duas-redes.integracao.ts
index 9856695..b30c567 100644
--- a/testes-integracao/linkedin-duas-redes.integracao.ts
+++ b/testes-integracao/linkedin-duas-redes.integracao.ts
@@ -42,6 +42,11 @@ const bucket = {
   objetos: new Map<string, Uint8Array>(),
   chamadas: [] as string[],
   recusarSubida: false,
+  // A PARTE 3a: só a primeira subida que chegar é recusada; as outras podem esperar antes de terminar; e o download
+  // pode ser lento (o "agora" do carrossel com as cópias passando de 3 s).
+  recusarUmaSubida: false,
+  atrasoDaSubidaMs: 0,
+  atrasoDaBaixadaMs: 0,
 };
 
 let servidorFalso: Server;
@@ -76,12 +81,18 @@ beforeAll(async () => {
     if (req.method === "PUT" && u.pathname.startsWith(assinar)) {
       bucket.chamadas.push(`subiu ${depois(assinar)}`);
       if (bucket.recusarSubida) return responder(res, 400, { message: "o bucket falso recusou de propósito" });
+      if (bucket.recusarUmaSubida) {
+        bucket.recusarUmaSubida = false;
+        return responder(res, 400, { message: "o bucket falso recusou esta subida de propósito" });
+      }
+      if (bucket.atrasoDaSubidaMs) await esperar(bucket.atrasoDaSubidaMs);
       bucket.objetos.set(depois(assinar), new Uint8Array(corpo));
       return responder(res, 200, { Key: depois(assinar) });
     }
     const publico = `/storage/v1/object/public/${BUCKET}/`;
     if (req.method === "GET" && u.pathname.startsWith(publico)) {
       bucket.chamadas.push(`baixou ${depois(publico)}`);
+      if (bucket.atrasoDaBaixadaMs) await esperar(bucket.atrasoDaBaixadaMs);
       const objeto = bucket.objetos.get(depois(publico));
       if (!objeto) return responder(res, 400, { message: "Object not found" });
       res.writeHead(200, { "content-type": "image/jpeg" });
@@ -105,6 +116,13 @@ beforeAll(async () => {
         });
       }
       if (req.method === "PUT" && u.pathname === "/envio/C4E10AQduas") return responder(res, 201, "");
+      // O DOCUMENTO DO CARROSSEL (a parte 3a), para o caso de a passada da mídia caber no "agora".
+      if (req.method === "POST" && u.pathname === "/rest/documents") {
+        return responder(res, 200, {
+          value: { uploadUrl: `http://127.0.0.1:${porta}/envio/D5510duas`, document: "urn:li:document:DasDuasRedes" },
+        });
+      }
+      if (req.method === "PUT" && u.pathname === "/envio/D5510duas") return responder(res, 201, "");
       if (req.method === "POST" && u.pathname === "/rest/posts") {
         return responder(res, 201, "", { "x-restli-id": "urn:li:share:7000000000000000262" });
       }
@@ -203,6 +221,9 @@ beforeEach(async () => {
   bucket.objetos = new Map([[ORIGINAL, JPEG]]);
   bucket.chamadas = [];
   bucket.recusarSubida = false;
+  bucket.recusarUmaSubida = false;
+  bucket.atrasoDaSubidaMs = 0;
+  bucket.atrasoDaBaixadaMs = 0;
 });
 
 async function conectar(conta: string) {
@@ -507,7 +528,9 @@ describe("as recusas: nenhuma linha entra, e o bucket e as redes não são chama
   const casos: [string, Partial<Record<string, string>>, (t: string | null) => void][] = [
     ["a imagem de outra conta (descartada antes de copiar)", { caminhos: `${CONTA_B}/foto-do-post.jpg` }, (t) => expect(t).toBeTruthy()],
     ["sem a imagem", { caminhos: "" }, (t) => expect(t).toBeTruthy()],
-    ["a forma que o LinkedIn ainda não recebe", { forma: "carrossel" }, (t) => expect(t).toContain("próxima entrega")],
+    ["o reels, que o LinkedIn ainda não recebe", { forma: "reels" }, (t) => expect(t).toContain("próxima entrega")],
+    ["o carrossel com vídeo, que o PDF do LinkedIn não leva", { forma: "carrossel", caminhos: `${ORIGINAL}\n${CONTA_A}/video-do-post.mp4` }, (t) =>
+      expect(t).toBe(regrasDoLinkedin.textoDaRecusaNoLinkedin("carrossel_com_video"))],
     ["o story", { forma: "story" }, (t) => expect(t).toContain("não tem story")],
     ["o texto vazio nas duas (a legenda e o texto próprio)", { legenda: "", texto_linkedin: "  " }, (t) =>
       expect(t).toBe(regrasDoLinkedin.textoDaRecusaNoLinkedin("texto_vazio"))],
@@ -551,3 +574,140 @@ describe("a regra das contas: a conta vem da sessão, e nunca do formulário", (
     expect(bucket.chamadas).toEqual([]);
   });
 });
+
+// ---------------------------------------------------------------------------------------------------------------
+// O CARROSSEL NAS DUAS REDES (a parte 3a; scratchpad/desenho-li3.md, "As duas redes"): a linha do LinkedIn leva uma
+// cópia de cada foto, feitas em paralelo e na ordem das originais; a chave continua pelos caminhos ORIGINAIS, e a
+// ordem do 192 e do 199 não muda; quando uma cópia falha, as que deram certo saem do bucket, e nada é gravado.
+
+const FOTOS = [1, 2, 3].map((n) => `${CONTA_A}/foto-${n}-do-carrossel.jpg`);
+const bytesDaFoto = (n: number) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x10 + n, 0xff, 0xd9]);
+const comAsFotos = () => FOTOS.forEach((caminho, i) => bucket.objetos.set(caminho, bytesDaFoto(i + 1)));
+const carrossel = (campos: Partial<Record<string, string>> = {}) => formulario({ forma: "carrossel", caminhos: FOTOS.join("\n"), ...campos });
+const soAsOriginais = () => [ORIGINAL, ...FOTOS].sort();
+const apagadas = () => bucket.chamadas.filter((c) => c.startsWith("apagou ")).map((c) => c.slice("apagou ".length));
+
+describe("o carrossel nas duas redes (a parte 3a)", () => {
+  it("agendado: o LinkedIn leva uma cópia de cada foto, na ordem, e a chave é a das originais", async () => {
+    comAsFotos();
+    const aviso = await nasDuasComoAdministrador(carrossel(daquiA2Horas()));
+    expect(aviso.tom).toBe("ok");
+    expect(aviso.texto).toContain("Instagram: Publicação agendada para");
+    expect(aviso.texto).toContain("LinkedIn: Post do LinkedIn agendado para");
+    const [ig] = await daRede("publicacao");
+    const [li] = await daRede("publicacao_linkedin");
+    expect(ig.payload.caminhos).toEqual(FOTOS);
+    expect(li.payload.forma).toBe("carrossel");
+    const copias = li.payload.caminhos as string[];
+    expect(copias).toHaveLength(3);
+    for (const [i, copia] of copias.entries()) {
+      expect(copia).toMatch(COPIA);
+      expect(Array.from(bucket.objetos.get(copia) ?? [])).toEqual(Array.from(bytesDaFoto(i + 1)));
+    }
+    expect(li.dedupe_key).toBe(`pub-linkedin:${CONTA_A}:carrossel:${FOTOS.join(",")}`);
+    expect(linkedin.pedidos).toEqual([]);
+    expect(meta.containers).toBe(0);
+  });
+
+  it("o mesmo carrossel de novo: já existia nas duas, pela chave das originais, e nenhuma cópia nova é feita", async () => {
+    comAsFotos();
+    const hora = daquiA2Horas();
+    await nasDuasComoAdministrador(carrossel(hora));
+    const antes = [...bucket.objetos.keys()].sort();
+    bucket.chamadas = [];
+    const aviso = await nasDuasComoAdministrador(carrossel(hora));
+    expect(aviso.tom).toBe("erro");
+    expect(aviso.texto?.match(/Nada foi duplicado/g)).toHaveLength(2);
+    expect(await linhas()).toHaveLength(2);
+    expect([...bucket.objetos.keys()].sort()).toEqual(antes);
+    expect(bucket.chamadas).toEqual([]);
+  });
+
+  it("agora, com as cópias passando de 3 s: o Instagram sai, e o LinkedIn fica aguardando, adiado sem gastar tentativa", async () => {
+    comAsFotos();
+    bucket.atrasoDaBaixadaMs = 3_100;
+    const inicio = Date.now();
+    const aviso = await nasDuasComoAdministrador(carrossel());
+    const levou = Date.now() - inicio;
+    console.log(`O AGORA DO CARROSSEL NAS DUAS REDES, com o bucket a 3,1 s por download: ${levou} ms`);
+    expect(aviso).toEqual(
+      redes.avisoDasDuasRedes({
+        tipo: "entrou",
+        campos: null,
+        instagram: { entrou: true, jaVale: true },
+        linkedin: { entrou: true, jaVale: true, desfecho: "aguardando", motivo: null },
+      })
+    );
+    expect((await daRede("publicacao"))[0].status).toBe("sent");
+    const [li] = await q(
+      `select status, attempts, payload, not_before > now() as adiada from queue where kind = 'publicacao_linkedin'`
+    );
+    expect(li).toMatchObject({ status: "pending", attempts: 0, adiada: true });
+    expect(li.payload).toMatchObject({ adiamentos: 1 });
+    expect(linkedin.pedidos).toEqual([]);
+    // AS CÓPIAS FICAM PARA A PASSADA SEGUINTE; as originais, o dreno do Instagram apagou depois de publicar.
+    const copias = (li.payload as { caminhos: string[] }).caminhos;
+    expect([...bucket.objetos.keys()].sort()).toEqual([ORIGINAL, ...copias].sort());
+  }, 30_000);
+
+  it("a cópia que falha no meio: as que subiram saem do bucket depois de terminar, e nada é gravado", async () => {
+    comAsFotos();
+    bucket.recusarUmaSubida = true;
+    bucket.atrasoDaSubidaMs = 300;
+    const aviso = await nasDuasComoAdministrador(carrossel(daquiA2Horas()));
+    expect(aviso.tom).toBe("erro");
+    expect(aviso.texto).toContain("Nada foi agendado");
+    expect(aviso.texto).toContain("HTTP 400");
+    expect(await linhas()).toEqual([]);
+    const subiram = bucket.chamadas.filter((c) => c.startsWith("subiu ")).map((c) => c.slice("subiu ".length));
+    expect(subiram).toHaveLength(3);
+    // A PRIMEIRA SUBIDA FOI RECUSADA NA HORA; as outras duas terminaram 300 ms depois, e só então saíram.
+    expect(apagadas().sort()).toEqual(subiram.slice(1).sort());
+    expect([...bucket.objetos.keys()].sort()).toEqual(soAsOriginais());
+  });
+
+  it("a linha do LinkedIn que o banco recusa: as três cópias saem, e nada foi agendado", async () => {
+    comAsFotos();
+    await comGatilho(
+      "teste_recusa_o_linkedin",
+      "before",
+      `if new.kind = 'publicacao_linkedin' then raise exception 'o banco de teste recusou a linha do LinkedIn'; end if; return new;`,
+      async () => {
+        const aviso = await nasDuasComoAdministrador(carrossel(daquiA2Horas()));
+        expect(aviso.tom).toBe("erro");
+        expect(aviso.texto).toContain("Nada foi agendado");
+        expect(await linhas()).toEqual([]);
+        expect(apagadas()).toHaveLength(3);
+        expect([...bucket.objetos.keys()].sort()).toEqual(soAsOriginais());
+      }
+    );
+  });
+
+  it("o Instagram que o banco recusa, com o carrossel do LinkedIn pendente: o LinkedIn é desfeito, e as três cópias saem", async () => {
+    comAsFotos();
+    await comGatilho("teste_recusa_o_instagram", "before", RECUSA_DO_INSTAGRAM, async () => {
+      const aviso = await nasDuasComoAdministrador(carrossel(daquiA2Horas()));
+      expect(aviso).toEqual(redes.avisoDasDuasRedes({ tipo: "instagram_nao_entrou", linkedin: "desfeito" }));
+      expect((await daRede("publicacao_linkedin"))[0].status).toBe("skipped");
+      expect(apagadas()).toHaveLength(3);
+      expect([...bucket.objetos.keys()].sort()).toEqual(soAsOriginais());
+    });
+  });
+
+  // A CHAVE CONTRA O CLIQUE DUPLO NÃO MUDA PARA O POST SÓ DE IMAGEM (nota da auditoria sobre a F4): a linha que já está
+  // na fila, gravada com a chave escrita à mão como a produção de hoje (e2949fb) a escreve, pela original, segura o
+  // mesmo envio depois desta entrega.
+  it("a imagem que já está na fila, com a chave da produção de hoje: o mesmo envio dá já existia no LinkedIn, sem cópia", async () => {
+    await q(
+      `insert into queue (account_id, kind, payload, dedupe_key, not_before)
+       values ($1, 'publicacao_linkedin', $2, $3, now() + interval '2 hours')`,
+      [CONTA_A, { forma: "imagem", caminhos: [ORIGINAL], texto: "O post do LinkedIn" }, `pub-linkedin:${CONTA_A}:imagem:${ORIGINAL}`]
+    );
+    const aviso = await nasDuasComoAdministrador(formulario(daquiA2Horas()));
+    expect(aviso.texto).toContain("LinkedIn: O post do LinkedIn já estava na fila. Nada foi duplicado.");
+    expect(aviso.texto).toContain("Instagram: Publicação agendada para");
+    expect(await daRede("publicacao_linkedin")).toHaveLength(1);
+    expect(await daRede("publicacao")).toHaveLength(1);
+    expect(bucket.chamadas).toEqual([]);
+  });
+});
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-carrossel-pdf"; cd "$C" || exit 1
npx --no-install vitest run tests/linkedin-compor.test.ts tests/linkedin-copia.test.ts 2>&1 | tee ../el3a-f4-red-puros.log
docker ps --format '{{.Names}} {{.Status}}' | grep metodochat-banco-de-teste   # healthy; senão, docker start e espere healthy
DATABASE_URL_TESTES=postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes npx --no-install vitest run --config vitest.integracao.config.ts testes-integracao/linkedin-compor.integracao.ts testes-integracao/linkedin-duas-redes.integracao.ts 2>&1 | tee ../el3a-f4-red-integ.log
```

Esperado: nos puros, "Test Files 2 failed (2)" e "Tests 5 failed | 27 passed (32)": a recusa do carrossel com vídeo e as 4 das cópias em paralelo (`copiarAsImagensParaOLinkedin` ainda não existe). Na integração, `ALVO: banco de TESTE`, nenhum `teste_tmp` antes e depois, "Test Files 2 failed (2)" e "Tests 8 failed | 47 passed (55)": o carrossel com vídeo nas duas redes e só no LinkedIn, e os 6 do carrossel nas duas redes, que a action ainda recusa. Passam já, de propósito: o carrossel só no LinkedIn agendado (a forma é aceita desde a FASE 3), as outras recusas do carrossel, o reels nas duas e a chave da imagem que já está na fila (uma guarda).

- [ ] **Passo 3: o código**

Em `lib/linkedin-publicacao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/linkedin-publicacao.ts b/lib/linkedin-publicacao.ts
index 9858c73..b32a486 100644
--- a/lib/linkedin-publicacao.ts
+++ b/lib/linkedin-publicacao.ts
@@ -2,7 +2,7 @@
 // tela de cliente e o servidor leem as mesmas regras. Na parte 1 (a conexão), o vencimento; na parte 2a (só
 // texto e imagem, uma rede por post), as formas, o texto, o payload da fila, o corpo do post e os erros. Na parte
 // 3a, o carrossel em PDF; o vídeo vem na 3b. O único import é o de lib/publicacao.ts, que também é puro.
-import { CARROSSEL_ITENS_MAX, CARROSSEL_ITENS_MIN } from "./publicacao";
+import { CARROSSEL_ITENS_MAX, CARROSSEL_ITENS_MIN, pareceVideo } from "./publicacao";
 
 /** O aviso de que a autorização vai vencer começa a 7 dias. */
 export const AVISO_DO_VENCIMENTO_DIAS = 7;
@@ -162,7 +162,13 @@ export function problemaDoTextoDoLinkedin(texto: string, _forma: FormaNoLinkedin
 // O PEDIDO DE PUBLICAR, NA TELA E NA ACTION
 // ---------------------------------------------------------------------------------------------------------------
 
-export type RecusaDoPedidoNoLinkedin = "forma_desconhecida" | "quantidade" | "texto_vazio" | "texto_longo" | "envio_sem_id";
+export type RecusaDoPedidoNoLinkedin =
+  | "forma_desconhecida"
+  | "quantidade"
+  | "carrossel_com_video"
+  | "texto_vazio"
+  | "texto_longo"
+  | "envio_sem_id";
 
 const ID_DO_ENVIO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 
@@ -180,6 +186,9 @@ export function recusaDoPedidoNoLinkedin(p: {
 }): RecusaDoPedidoNoLinkedin | null {
   if (!p.forma) return "forma_desconhecida";
   if (!quantidadeServe(p.forma, p.caminhos.length)) return "quantidade";
+  // O PDF DO CARROSSEL SÓ LEVA FOTOS (a parte 3a). O vídeo é reconhecido pela extensão do caminho, como o dreno do
+  // Instagram decide (`pareceVideo`); a tela confere antes, pelo tipo do arquivo, e desliga a caixinha.
+  if (p.forma === "carrossel" && p.caminhos.some((c) => pareceVideo(c))) return "carrossel_com_video";
   const problema = problemaDoTextoDoLinkedin(p.texto, p.forma);
   if (problema === "vazio") return "texto_vazio";
   if (problema === "longo") return "texto_longo";
@@ -193,6 +202,8 @@ export function textoDaRecusaNoLinkedin(r: RecusaDoPedidoNoLinkedin): string {
       return "Escolha a forma do post no LinkedIn: só texto, imagem ou carrossel.";
     case "quantidade":
       return "O post do LinkedIn com imagem leva uma imagem, o carrossel leva de 2 a 10 fotos, e o só texto não leva arquivo.";
+    case "carrossel_com_video":
+      return textoDoProblemaDoCarrosselNoLinkedin("video");
     case "texto_vazio":
       return "Escreva o texto do post.";
     case "texto_longo":
```

Em `lib/linkedin-copia.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/linkedin-copia.ts b/lib/linkedin-copia.ts
index 460877a..addc641 100644
--- a/lib/linkedin-copia.ts
+++ b/lib/linkedin-copia.ts
@@ -82,3 +82,27 @@ export async function apagarACopiaSemDerrubar(caminho: string): Promise<void> {
     // Fica no bucket sem dono; o aviso da tela já diz o que aconteceu com o post.
   }
 }
+
+/**
+ * AS CÓPIAS DO POST DAS DUAS REDES, uma por arquivo, EM PARALELO, na ordem das originais (a parte 3a: o carrossel leva
+ * de 2 a 10 fotos, e a ordem delas é a das páginas do PDF). Cada uma é a cópia de cima, com os mesmos tetos; em
+ * paralelo, o pior caso de dez é o de uma só, três chamadas de até 10 s (~30 s), e não dez vezes isso.
+ *
+ * ESPERA TODAS TERMINAREM (`allSettled`), e não só a primeira falha: se uma falha, as que deram certo são apagadas, e
+ * só então sobe o erro da primeira que falhou, na ordem das originais. Assim nenhuma cópia termina depois da limpeza e
+ * fica no bucket sem dono (o desenho da 3a: "se uma cópia falha, as que deram certo saem, e nada é gravado").
+ */
+export async function copiarAsImagensParaOLinkedin(origens: readonly string[], conta: string): Promise<string[]> {
+  if (origens.length === 0) throw new Error("nenhuma imagem para copiar");
+  const feitas = await Promise.allSettled(origens.map((origem) => copiarImagemParaOLinkedin(origem, conta)));
+  const copias = feitas.flatMap((f) => (f.status === "fulfilled" ? [f.value] : []));
+  const falha = feitas.find((f): f is PromiseRejectedResult => f.status === "rejected");
+  if (!falha) return copias;
+  await apagarAsCopiasSemDerrubar(copias);
+  throw falha.reason;
+}
+
+/** As cópias que não vão ser usadas, apagadas juntas e sem derrubar quem chama (a de cima, para cada uma). */
+export async function apagarAsCopiasSemDerrubar(caminhos: readonly string[]): Promise<void> {
+  await Promise.all(caminhos.map((caminho) => apagarACopiaSemDerrubar(caminho)));
+}
```

Em `app/publicar/actions.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/publicar/actions.ts b/app/publicar/actions.ts
index 26fba34..9ecb6a6 100644
--- a/app/publicar/actions.ts
+++ b/app/publicar/actions.ts
@@ -37,9 +37,10 @@ import {
   type ResultadoDoLinkedin,
 } from "@/lib/linkedin-fila";
 import { armarOTiqueDaLinha, drenarUmaPublicacaoDoLinkedin } from "@/lib/queue-drain";
-// O POST DAS DUAS REDES (a parte 2b): as regras puras das duas, e a cópia da imagem para a linha do LinkedIn.
+// O POST DAS DUAS REDES (a parte 2b): as regras puras das duas, e as cópias para a linha do LinkedIn (uma no post de
+// imagem; uma por foto no carrossel, a parte 3a).
 import { avisoDasDuasRedes, redeAceitaAForma, textoQueVaiAoLinkedin } from "@/lib/redes-do-post";
-import { apagarACopiaSemDerrubar, copiarImagemParaOLinkedin } from "@/lib/linkedin-copia";
+import { apagarAsCopiasSemDerrubar, copiarAsImagensParaOLinkedin } from "@/lib/linkedin-copia";
 import type { ResultadoDaPublicacao } from "@/lib/engine";
 
 /**
@@ -286,9 +287,9 @@ export async function publicarNoLinkedin(formData: FormData): Promise<void> {
 }
 
 /**
- * O POST DE IMAGEM NAS DUAS REDES, Instagram e LinkedIn, para a conta selecionada (docs/specs/2026-11-06-linkedin-
- * no-perfil.md, §6 e §7; a parte 2b). Uma linha por rede, cada uma com a sua chave, o seu andamento e as suas
- * tentativas: se uma rede falhar ao publicar, a outra segue.
+ * O POST DE IMAGEM OU DE CARROSSEL NAS DUAS REDES, Instagram e LinkedIn, para a conta selecionada
+ * (docs/specs/2026-11-06-linkedin-no-perfil.md, §6 e §7; a parte 2b, e o carrossel na 3a). Uma linha por rede, cada
+ * uma com a sua chave, o seu andamento e as suas tentativas: se uma rede falhar ao publicar, a outra segue.
  *
  * AS MESMAS REGRAS DAS DUAS ACTIONS DE CIMA: a sessão primeiro; nenhuma saída muda; a conta da regra das contas, e
  * nunca do formulário; os caminhos pela pasta dessa conta; a conexão e o pedido do LinkedIn conferidos de novo
@@ -298,17 +299,25 @@ export async function publicarNoLinkedin(formData: FormData): Promise<void> {
  *   1. todas as conferências, sem gravar nada;
  *   2. a chave do LinkedIn já está na fila? Então ele "já existia", e não há cópia (depois de um "agora", o dreno do
  *      Instagram já apagou o original, e copiar falharia);
- *   3. a cópia da imagem para a linha do LinkedIn (lib/linkedin-copia.ts). Se falha, nada é gravado;
- *   4. a linha do LinkedIn, com a cópia, e a chave pelo caminho ORIGINAL. Se ela não entra (o banco recusou, ou a
- *      chave apareceu entre a conferência e o insert), a cópia sai, e nada é gravado;
+ *   3. as cópias para a linha do LinkedIn, uma por arquivo, em paralelo (lib/linkedin-copia.ts). Se uma falha, as
+ *      que deram certo saem, e nada é gravado;
+ *   4. a linha do LinkedIn, com as cópias, e a chave pelos caminhos ORIGINAIS. Se ela não entra (o banco recusou, ou
+ *      a chave apareceu entre a conferência e o insert), as cópias saem, e nada é gravado;
  *   5. a linha do Instagram, pelo `enqueuePublicacao` de hoje, sem mudança. Se ele LANÇA, a do LinkedIn é desfeita
- *      só se ainda estiver pendente (achado 199), e só então a cópia sai; um dreno que já a pegou segue com ela.
+ *      só se ainda estiver pendente (achado 199), e só então as cópias saem; um dreno que já a pegou segue com elas.
  *      A chave do Instagram que já existia não é falha: a tela diz que ele já estava na fila.
  *
  * O "AGORA" (a escolha (a) da auditoria): primeiro o LinkedIn, só a própria linha (`drenarUmaPublicacaoDoLinkedin`,
  * achado 211), que só começa o passo que tem tempo de terminar; depois o dreno de hoje para o Instagram, com o
  * mesmo começo da função, para outra linha do LinkedIn que ele pegue respeitar o prazo. O dreno não muda nesta
  * entrega.
+ *
+ * O TEMPO, COM O CARROSSEL (a parte 3a; nota da auditoria sobre a F4). As cópias correm em paralelo: o pior caso de
+ * dez fotos é o de uma, três chamadas de até 10 s (~30 s), dentro dos 60 s da página (`maxDuration`,
+ * app/publicar/novo/page.tsx). A passada da mídia do carrossel pede 52 s dos 55 do orçamento, e só começa no "agora"
+ * se tudo antes dela levou menos de 3 s; senão a linha volta sem gastar tentativa, e o aviso diz que o post vai sair.
+ * As linhas só entram depois de TODAS as cópias: se a função for cortada no meio delas, nada foi gravado, e as que já
+ * subiram ficam no bucket sem dono, como a cópia que o `apagarACopiaSemDerrubar` não consegue apagar.
  */
 export async function publicarNasDuasRedes(formData: FormData): Promise<void> {
   await exigirSessao();
@@ -324,10 +333,12 @@ export async function publicarNasDuasRedes(formData: FormData): Promise<void> {
     redirect(urlDePublicarComAviso({ tom: "erro", texto: disponivel.motivo }));
   }
 
-  // NESTA ENTREGA, AS DUAS REDES JUNTAS SÓ NA IMAGEM: o carrossel e o vídeo chegam ao LinkedIn na parte 3, e o story
-  // não existe lá. O motivo é o mesmo que a tela mostra na caixinha desligada.
+  // AS DUAS REDES JUNTAS NA IMAGEM E NO CARROSSEL: as formas da tela que o LinkedIn publica com arquivo, pela lista
+  // única (`FORMAS_NO_LINKEDIN`; o carrossel vai como PDF, só com fotos, na parte 3a). O vídeo chega ao LinkedIn
+  // depois, e o story não existe lá. O motivo é o mesmo que a tela mostra na caixinha desligada.
   const forma = formaQueATelaPublica(formData.get("forma"));
-  if (forma !== "imagem") {
+  const formaNoLinkedin = formaNoLinkedinDoCampo(forma);
+  if (!forma || !formaNoLinkedin) {
     redirect(
       urlDePublicarComAviso({
         tom: "erro",
@@ -351,7 +362,7 @@ export async function publicarNasDuasRedes(formData: FormData): Promise<void> {
   // O TEXTO DO LINKEDIN: o próprio, quando há; sem ele, a legenda. Contado pela mesma função do contador (212).
   const texto = textoQueVaiAoLinkedin({ legenda, textoProprio: String(formData.get("texto_linkedin") ?? "") });
   const idDoEnvio = String(formData.get("id_do_envio") ?? "");
-  const recusa = recusaDoPedidoNoLinkedin({ forma, caminhos, texto, idDoEnvio });
+  const recusa = recusaDoPedidoNoLinkedin({ forma: formaNoLinkedin, caminhos, texto, idDoEnvio });
   if (recusa) {
     redirect(urlDePublicarComAviso({ tom: "erro", texto: textoDaRecusaNoLinkedin(recusa) }));
   }
@@ -367,33 +378,34 @@ export async function publicarNasDuasRedes(formData: FormData): Promise<void> {
     redirect(urlDePublicarComAviso({ tom: "erro", texto: textoDaRecusaDaPublicacao(momento.motivo) }));
   }
 
-  // 2 A 4. O LINKEDIN: a chave, a cópia e a linha.
-  const pedidoDoLinkedin = { forma, caminhos, texto, idDoEnvio };
+  // 2 A 4. O LINKEDIN: a chave, as cópias e a linha.
+  const pedidoDoLinkedin = { forma: formaNoLinkedin, caminhos, texto, idDoEnvio };
   let linkedin: ResultadoDoLinkedin = { entrou: false };
-  let copia: string | null = null;
+  let copias: string[] = [];
   if (!(await aChaveDoLinkedinJaExiste(conta.ig_user_id, pedidoDoLinkedin))) {
     let falhaDoLinkedin: string | null = null;
     try {
-      copia = await copiarImagemParaOLinkedin(caminhos[0], conta.ig_user_id);
+      // UMA CÓPIA POR ARQUIVO, EM PARALELO e na ordem das originais; se uma falha, as outras já saíram do bucket.
+      copias = await copiarAsImagensParaOLinkedin(caminhos, conta.ig_user_id);
     } catch (e) {
       falhaDoLinkedin = e instanceof Error ? e.message : "a cópia da imagem falhou";
     }
-    if (copia) {
+    if (copias.length) {
       try {
         linkedin = await enqueuePublicacaoNoLinkedin(
           conta.ig_user_id,
-          { ...pedidoDoLinkedin, caminhos: [copia] },
+          { ...pedidoDoLinkedin, caminhos: copias },
           momento.quando,
           { caminhosDaChave: caminhos }
         );
       } catch {
         falhaDoLinkedin = "a fila do LinkedIn não respondeu";
       }
-      // A CÓPIA QUE NÃO VAI SER USADA SAI: o banco recusou a linha, ou a chave apareceu entre a conferência e o
+      // AS CÓPIAS QUE NÃO VÃO SER USADAS SAEM: o banco recusou a linha, ou a chave apareceu entre a conferência e o
       // insert (dois cliques juntos). No segundo caso, o LinkedIn "já existia", e o Instagram segue.
       if (!linkedin.entrou) {
-        await apagarACopiaSemDerrubar(copia);
-        copia = null;
+        await apagarAsCopiasSemDerrubar(copias);
+        copias = [];
       }
     }
     if (falhaDoLinkedin) {
@@ -415,10 +427,10 @@ export async function publicarNasDuasRedes(formData: FormData): Promise<void> {
       try {
         desfeita = await desfazerLinhaDoLinkedin(linkedin.id);
       } catch {
-        // Sem a resposta do banco, a linha continua como estava: pendente, ela sai sozinha. A cópia fica.
+        // Sem a resposta do banco, a linha continua como estava: pendente, ela sai sozinha. As cópias ficam.
       }
       lado = desfeita ? "desfeito" : "seguiu";
-      if (desfeita && copia) await apagarACopiaSemDerrubar(copia);
+      if (desfeita && copias.length) await apagarAsCopiasSemDerrubar(copias);
     }
     redirect(urlDePublicarComAviso(avisoDasDuasRedes({ tipo: "instagram_nao_entrou", linkedin: lado })));
   }
```

- [ ] **Passo 4: rodar e ver passar**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-carrossel-pdf"; cd "$C" || exit 1
npx --no-install vitest run tests/linkedin-compor.test.ts tests/linkedin-copia.test.ts 2>&1 | tee ../el3a-f4-green-puros.log
docker ps --format '{{.Names}} {{.Status}}' | grep metodochat-banco-de-teste   # healthy; senão, docker start e espere healthy
DATABASE_URL_TESTES=postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes npx --no-install vitest run --config vitest.integracao.config.ts testes-integracao/linkedin-compor.integracao.ts testes-integracao/linkedin-duas-redes.integracao.ts 2>&1 | tee ../el3a-f4-green-integ.log
npx --no-install vitest run 2>&1 | tee ../el3a-f4-suite.log
npx --no-install tsc --noEmit
npx --no-install eslint app/publicar/actions.ts lib/linkedin-copia.ts lib/linkedin-publicacao.ts testes-integracao/linkedin-compor.integracao.ts testes-integracao/linkedin-duas-redes.integracao.ts tests/linkedin-compor.test.ts tests/linkedin-copia.test.ts
git diff --name-only 40b2aec -- lib/queue-drain.ts lib/fila-tipos.ts migrations scripts package.json package-lock.json   # vazio
```

Esperado: nos puros, "Test Files 2 passed (2)" e "Tests 32 passed (32)"; a integração: `ALVO: banco de TESTE`, "nenhum schema teste_tmp_* no banco" antes e depois, "Test Files 2 passed (2)" e "Tests 55 passed (55)"; a suíte pura inteira: "Test Files 160 passed (160)" e "Tests 3825 passed (3825)". O `tsc` e o lint sem saída, e a guarda vazia.

- [ ] **Passo 5: o commit**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-carrossel-pdf"; cd "$C" || exit 1
node ../varrer-texto.mjs app/publicar/actions.ts lib/linkedin-copia.ts lib/linkedin-publicacao.ts testes-integracao/linkedin-compor.integracao.ts testes-integracao/linkedin-duas-redes.integracao.ts tests/linkedin-compor.test.ts tests/linkedin-copia.test.ts && test "$(git branch --show-current)" = linkedin-carrossel-pdf && git add app/publicar/actions.ts lib/linkedin-copia.ts lib/linkedin-publicacao.ts testes-integracao/linkedin-compor.integracao.ts testes-integracao/linkedin-duas-redes.integracao.ts tests/linkedin-compor.test.ts tests/linkedin-copia.test.ts && git commit -m "O carrossel sai nas duas redes, com uma cópia de cada foto feita em paralelo e a chave pelas originais, e o carrossel com vídeo não vai ao LinkedIn"
git show HEAD | git patch-id --stable | cut -c1-12   # 2ea7ea0eec88
```

O patch-id tem de começar por `2ea7ea0eec88` (o mesmo do plano de 12/11). Se não começar, pare.

---

### FASE 4-bis — No "agora" do carrossel nas duas redes, o documento não começa no clique (222)

**Arquivos:** `app/publicar/actions.ts`, `lib/linkedin-fila.ts`, `testes-integracao/linkedin-duas-redes.integracao.ts`, `tests/dreno-com-prazo.test.ts`.

Sobre a 3a-0: a reserva fica só no "agora" do LinkedIn (`const inicioDoLinkedin = comecoDoLinkedinNoAgoraDasDuas(...)` e o `drenarUmaPublicacaoDoLinkedin(linkedin.id, inicioDoLinkedin)`), e o dreno do Instagram continua na forma do clique, `drainQueue({ inicioDaFuncaoMs, doClique: true })`, que não pega o post do LinkedIn. O caso em que o "agora" do LinkedIn lança passa a provar isso: a linha fica vencida, sem adiamento e sem documento, para os drenos das rotas.

- [ ] **Passo 1: os testes**

Em `testes-integracao/linkedin-duas-redes.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/linkedin-duas-redes.integracao.ts b/testes-integracao/linkedin-duas-redes.integracao.ts
index b30c567..d333f80 100644
--- a/testes-integracao/linkedin-duas-redes.integracao.ts
+++ b/testes-integracao/linkedin-duas-redes.integracao.ts
@@ -581,7 +581,11 @@ describe("a regra das contas: a conta vem da sessão, e nunca do formulário", (
 // ordem do 192 e do 199 não muda; quando uma cópia falha, as que deram certo saem do bucket, e nada é gravado.
 
 const FOTOS = [1, 2, 3].map((n) => `${CONTA_A}/foto-${n}-do-carrossel.jpg`);
-const bytesDaFoto = (n: number) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x10 + n, 0xff, 0xd9]);
+// UM JPEG COM CABEÇALHO DE VERDADE: um comentário com o número da foto, o SOF0 de 16×16 em cor de tela e o fim. O PDF
+// do carrossel só lê o cabeçalho (lib/pdf-de-fotos.ts), e é ele que deixa a passada do documento chegar ao LinkedIn
+// falso, se ela começar (o caso do achado 222, abaixo).
+const bytesDaFoto = (n: number) =>
+  new Uint8Array([0xff, 0xd8, 0xff, 0xfe, 0, 3, n, 0xff, 0xc0, 0, 17, 8, 0, 16, 0, 16, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1, 0xff, 0xd9]);
 const comAsFotos = () => FOTOS.forEach((caminho, i) => bucket.objetos.set(caminho, bytesDaFoto(i + 1)));
 const carrossel = (campos: Partial<Record<string, string>> = {}) => formulario({ forma: "carrossel", caminhos: FOTOS.join("\n"), ...campos });
 const soAsOriginais = () => [ORIGINAL, ...FOTOS].sort();
@@ -711,3 +715,92 @@ describe("o carrossel nas duas redes (a parte 3a)", () => {
     expect(bucket.chamadas).toEqual([]);
   });
 });
+
+// O "AGORA" DO CARROSSEL NAS DUAS REDES NÃO COMEÇA O DOCUMENTO NO CLIQUE (achado 222, da auditoria sobre a F4 da 3a).
+// A action publica o LinkedIn primeiro e o Instagram depois, na mesma função de 60 s, e o dreno do Instagram não lê o
+// orçamento. A passada do documento pede 52 s dos 55: começada no clique, ela deixaria o Instagram com uns 5 s. No
+// carrossel, o LinkedIn conta o prazo com a reserva do Instagram (`comecoDoLinkedinNoAgoraDasDuas`): a linha volta
+// adiada, para depois do dreno do Instagram. E o dreno do Instagram, que é o do clique, não pega a linha do LinkedIn
+// (a 3a-0, o 224): ela sai pelos drenos das rotas.
+describe("o agora do carrossel nas duas redes não começa o documento no clique (achado 222)", () => {
+  it("a reserva do Instagram é maior que a folga do documento: com ela, a passada do documento nunca cabe no clique", async () => {
+    const fila = await import("@/lib/linkedin-fila");
+    const dreno = await import("@/lib/queue-drain");
+    expect(dreno.ORCAMENTO_DA_FUNCAO_MS - fila.RESERVA_DO_INSTAGRAM_NO_CARROSSEL_MS).toBeLessThan(fila.TEMPO_PARA_O_DOCUMENTO_MS);
+    // NA IMAGEM, NADA MUDA (a 2b): o começo é o da função.
+    expect(fila.comecoDoLinkedinNoAgoraDasDuas("imagem", 1_000_000)).toBe(1_000_000);
+    expect(fila.comecoDoLinkedinNoAgoraDasDuas("carrossel", 1_000_000)).toBe(1_000_000 - fila.RESERVA_DO_INSTAGRAM_NO_CARROSSEL_MS);
+  });
+
+  it("com as cópias instantâneas: o LinkedIn não chama nada no clique, a linha volta adiada antes do dreno do Instagram, e o Instagram sai", async () => {
+    comAsFotos();
+    const inicio = Date.now();
+    const aviso = await nasDuasComoAdministrador(carrossel());
+    const levou = Date.now() - inicio;
+    console.log(`O AGORA DO CARROSSEL NAS DUAS REDES, com as cópias instantâneas: ${levou} ms`);
+    expect(aviso).toEqual(
+      redes.avisoDasDuasRedes({
+        tipo: "entrou",
+        campos: null,
+        instagram: { entrou: true, jaVale: true },
+        linkedin: { entrou: true, jaVale: true, desfecho: "aguardando", motivo: null },
+      })
+    );
+    // NEM A RESERVA DO DOCUMENTO: a passada do documento não começou no clique.
+    expect(linkedin.pedidos).toEqual([]);
+    const [li] = await q(
+      `select status, attempts, payload, not_before > now() as adiada from queue where kind = 'publicacao_linkedin'`
+    );
+    expect(li).toMatchObject({ status: "pending", attempts: 0, adiada: true });
+    expect(li.payload).toMatchObject({ adiamentos: 1 });
+    expect((li.payload as Record<string, unknown>).documento_urn).toBeUndefined();
+    expect((await daRede("publicacao"))[0].status).toBe("sent");
+    expect(meta).toMatchObject({ containers: 4, publicacoes: 1, desconhecidos: [] });
+  });
+
+  it("o agora do LinkedIn que lança antes de adiar: o dreno do Instagram, de clique, não pega a linha do LinkedIn, que fica vencida e sem adiamento para os drenos das rotas", async () => {
+    comAsFotos();
+    // A RECUSA DA PRIMEIRA REIVINDICAÇÃO DA LINHA DO LINKEDIN, uma vez só (a do "agora" dele). O dreno do Instagram,
+    // que é o do clique, nem tenta reivindicá-la. A sequência, a função e o gatilho nascem e morrem aqui.
+    await q(`create sequence teste_uma_vez_222`);
+    try {
+      await comGatilhoDeUpdate(
+        "teste_recusa_a_reivindicacao",
+        // O `nextval` SÓ RODA DENTRO DO PRIMEIRO `if`: o Postgres não promete a ordem das partes de um `and`.
+        `if new.kind = 'publicacao_linkedin' and old.status = 'pending' and new.status = 'sending' then
+           if nextval('teste_uma_vez_222') = 1 then
+             raise exception 'o banco de teste recusou a reivindicação do LinkedIn';
+           end if;
+         end if;
+         return new;`,
+        async () => {
+          const aviso = await nasDuasComoAdministrador(carrossel());
+          expect(aviso.tom).toBe("ok");
+          expect(linkedin.pedidos).toEqual([]);
+          const [li] = await q(
+            `select status, attempts, payload, not_before <= now() as vencida from queue where kind = 'publicacao_linkedin'`
+          );
+          expect(li).toMatchObject({ status: "pending", attempts: 0, vencida: true });
+          expect((li.payload as Record<string, unknown>).adiamentos).toBeUndefined();
+          expect((li.payload as Record<string, unknown>).documento_urn).toBeUndefined();
+          expect((await daRede("publicacao"))[0].status).toBe("sent");
+        }
+      );
+    } finally {
+      await q(`drop sequence if exists teste_uma_vez_222`);
+    }
+  });
+});
+
+/** O GATILHO DE TESTE NO UPDATE, irmão do `comGatilho` de cima: nasce, o caso roda, e ele morre no `finally`. */
+async function comGatilhoDeUpdate(nome: string, corpoDaFuncao: string, caso: () => Promise<void>) {
+  if (!/^teste_[a-z_]+$/.test(nome)) throw new Error(`o gatilho de teste tem de começar com teste_: ${nome}`);
+  await q(`create function ${nome}() returns trigger language plpgsql as $$ begin ${corpoDaFuncao} end $$`);
+  await q(`create trigger ${nome} before update on queue for each row execute function ${nome}()`);
+  try {
+    await caso();
+  } finally {
+    await q(`drop trigger if exists ${nome} on queue`);
+    await q(`drop function if exists ${nome}()`);
+  }
+}
```

Em `tests/dreno-com-prazo.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/dreno-com-prazo.test.ts b/tests/dreno-com-prazo.test.ts
index 21f23f8..935d17a 100644
--- a/tests/dreno-com-prazo.test.ts
+++ b/tests/dreno-com-prazo.test.ts
@@ -28,9 +28,11 @@ describe("a action de publicar no LinkedIn passa o começo da função ao \"agor
   });
 });
 
-// O "AGORA" DAS DUAS REDES (`publicarNasDuasRedes`, a parte 2b): o mesmo começo vai ao LinkedIn e ao dreno de hoje,
-// que publica o Instagram, para outra linha do LinkedIn que esse dreno pegue respeitar o prazo (nota da auditoria
-// sobre o desenho da 2b). E o LinkedIn vem antes (a escolha (a)): só a própria linha, com o tempo inteiro.
+// O "AGORA" DAS DUAS REDES (`publicarNasDuasRedes`, a parte 2b): o LinkedIn vem antes (a escolha (a)), só a própria
+// linha, e depois o dreno do clique publica o Instagram, com o começo da função e sem o post do LinkedIn (a 3a-0, o
+// 224). NO CARROSSEL (a parte 3a, achado 222), o começo do LinkedIn vem com a reserva do Instagram
+// (`comecoDoLinkedinNoAgoraDasDuas`, lib/linkedin-fila.ts), que na imagem devolve o próprio começo da função; os casos
+// estão em testes-integracao/linkedin-duas-redes.integracao.ts.
 describe("a action das duas redes passa o começo da função ao LinkedIn e ao dreno do Instagram", () => {
   it("app/publicar/actions.ts, publicarNasDuasRedes", () => {
     const fonte = readFileSync(join(RAIZ, "app/publicar/actions.ts"), "utf8").replace(/\r\n/g, "\n");
@@ -39,9 +41,10 @@ describe("a action das duas redes passa o começo da função ao LinkedIn e ao d
     const fim = fonte.indexOf("\nexport ", inicio + 1);
     const corpo = fonte.slice(inicio, fim === -1 ? undefined : fim);
     expect(corpo).toMatch(/\{\n {2}await exigirSessao\(\);\n {2}const inicioDaFuncaoMs = Date\.now\(\);\n/);
-    expect(corpo).toMatch(/drenarUmaPublicacaoDoLinkedin\(\s*[\w.]+,\s*inicioDaFuncaoMs\s*\)/);
+    expect(corpo).toMatch(/const inicioDoLinkedin = comecoDoLinkedinNoAgoraDasDuas\(\s*formaNoLinkedin,\s*inicioDaFuncaoMs\s*\);/);
+    expect(corpo).toMatch(/drenarUmaPublicacaoDoLinkedin\(\s*[\w.]+,\s*inicioDoLinkedin\s*\)/);
     // O DRENO DO INSTAGRAM, NO CLIQUE, NÃO PEGA O POST DO LINKEDIN (a 3a-0, o 224): o da própria linha já saiu pelo
-    // `drenarUmaPublicacaoDoLinkedin`, logo acima.
+    // `drenarUmaPublicacaoDoLinkedin`, logo acima. Por isso a reserva do carrossel não vai a ele.
     expect(corpo).toMatch(/drainQueue\(\{\s*inicioDaFuncaoMs,\s*doClique:\s*true\s*\}\)/);
     expect(corpo).not.toMatch(/drainQueue\(\)/);
     expect(corpo.indexOf("drenarUmaPublicacaoDoLinkedin(")).toBeLessThan(corpo.indexOf("drainQueue("));
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-carrossel-pdf"; cd "$C" || exit 1
npx --no-install vitest run tests/dreno-com-prazo.test.ts 2>&1 | tee ../el3a-f4bis-red-puros.log
docker ps --format '{{.Names}} {{.Status}}' | grep metodochat-banco-de-teste   # healthy; senão, docker start e espere healthy
DATABASE_URL_TESTES=postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes npx --no-install vitest run --config vitest.integracao.config.ts testes-integracao/linkedin-duas-redes.integracao.ts 2>&1 | tee ../el3a-f4bis-red-integ.log
```

Esperado: nos puros, "Test Files 1 failed (1)" e "Tests 1 failed | 14 passed (15)": o teste que lê a action das duas redes pede o `inicioDoLinkedin`. Na integração, `ALVO: banco de TESTE`, nenhum `teste_tmp` antes e depois, "Test Files 1 failed (1)" e "Tests 2 failed | 34 passed (36)": caem "a reserva do Instagram é maior que a folga do documento…" (a reserva ainda não existe) e "com as cópias instantâneas: o LinkedIn não chama nada no clique…" (o documento começa no clique). Passa já, de propósito, o caso em que o "agora" do LinkedIn lança: ele prova o dreno do clique da 3a-0, e a mutação F4bis-M3 mostra que ele cai quando o dreno das duas redes pega o post do LinkedIn.

- [ ] **Passo 3: o código**

Em `lib/linkedin-fila.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/linkedin-fila.ts b/lib/linkedin-fila.ts
index 361376d..90994ad 100644
--- a/lib/linkedin-fila.ts
+++ b/lib/linkedin-fila.ts
@@ -178,10 +178,28 @@ const TEMPO_DE_MONTAGEM_DO_PDF_MS = 2_000;
  * (10 s) e o envio do documento (25 s), com a folga: 52 s. Ela só cabe no começo de uma função; o post vem numa
  * passada seguinte, se não sobrar tempo.
  */
-const TEMPO_PARA_O_DOCUMENTO_MS =
+export const TEMPO_PARA_O_DOCUMENTO_MS =
   TETO_DO_BUCKET_MS + TEMPO_DE_MONTAGEM_DO_PDF_MS + TETO_DO_LINKEDIN_MS + TETO_DO_ENVIO_DO_DOCUMENTO_MS + FOLGA_MS;
 /** Quando falta tempo, a linha volta para daqui a pouco: a próxima passada é outra função, com o prazo inteiro. */
 const VOLTA_SEM_TEMPO_EM_SEGUNDOS = 20;
+
+/**
+ * A RESERVA DO INSTAGRAM NO "AGORA" DO CARROSSEL DAS DUAS REDES (achado 222, da auditoria sobre a F4 da 3a). A action
+ * das duas redes publica o LinkedIn primeiro e o Instagram depois, na mesma função de 60 s. A passada do documento
+ * pede 52 s dos 55: começada no clique, ela empurraria o dreno do Instagram para depois da hora de parar (a 3a-0,
+ * lib/fila-tipos.ts), e o Instagram não sairia no clique, só no tique seguinte.
+ *
+ * ENTÃO, NO CARROSSEL DAS DUAS REDES, O LINKEDIN CONTA O PRAZO COMO SE A FUNÇÃO TIVESSE COMEÇADO 20 s ANTES: 55 − 20 =
+ * 35 s, menos que os 52 do documento, e a passada do documento nunca cabe no clique. A linha volta adiada, sem gastar
+ * tentativa e para daqui a 20 s (`VOLTA_SEM_TEMPO_EM_SEGUNDOS`), antes do dreno do Instagram, e o "agora" do LinkedIn
+ * arma o tique dela. A reserva só vale para esse "agora": o dreno do Instagram é o do clique, e não pega o post do
+ * LinkedIn (a 3a-0, o 224). Na imagem, nada muda (a 2b).
+ */
+export const RESERVA_DO_INSTAGRAM_NO_CARROSSEL_MS = 20_000;
+
+export function comecoDoLinkedinNoAgoraDasDuas(forma: FormaNoLinkedin, inicioDaFuncaoMs: number): number {
+  return forma === "carrossel" ? inicioDaFuncaoMs - RESERVA_DO_INSTAGRAM_NO_CARROSSEL_MS : inicioDaFuncaoMs;
+}
 /**
  * O TETO DOS ADIAMENTOS (a parte 3a; nota da auditoria): a volta sem gastar tentativa não tinha teto, e uma linha que
  * nunca tivesse tempo seria adiada para sempre. O sétimo adiamento encerra a linha com o motivo. No lote, a linha já
```

Em `app/publicar/actions.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/publicar/actions.ts b/app/publicar/actions.ts
index 9ecb6a6..2528c70 100644
--- a/app/publicar/actions.ts
+++ b/app/publicar/actions.ts
@@ -31,6 +31,7 @@ import {
 } from "@/lib/linkedin-publicacao";
 import {
   aChaveDoLinkedinJaExiste,
+  comecoDoLinkedinNoAgoraDasDuas,
   desfazerLinhaDoLinkedin,
   enqueuePublicacaoNoLinkedin,
   erroDaLinha,
@@ -308,14 +309,14 @@ export async function publicarNoLinkedin(formData: FormData): Promise<void> {
  *      A chave do Instagram que já existia não é falha: a tela diz que ele já estava na fila.
  *
  * O "AGORA" (a escolha (a) da auditoria): primeiro o LinkedIn, só a própria linha (`drenarUmaPublicacaoDoLinkedin`,
- * achado 211), que só começa o passo que tem tempo de terminar; depois o dreno de hoje para o Instagram, com o
- * mesmo começo da função, para outra linha do LinkedIn que ele pegue respeitar o prazo. O dreno não muda nesta
- * entrega.
+ * achado 211), que só começa o passo que tem tempo de terminar; depois o dreno do clique para o Instagram, com o
+ * começo da função e sem o post do LinkedIn (a 3a-0).
  *
  * O TEMPO, COM O CARROSSEL (a parte 3a; nota da auditoria sobre a F4). As cópias correm em paralelo: o pior caso de
  * dez fotos é o de uma, três chamadas de até 10 s (~30 s), dentro dos 60 s da página (`maxDuration`,
- * app/publicar/novo/page.tsx). A passada da mídia do carrossel pede 52 s dos 55 do orçamento, e só começa no "agora"
- * se tudo antes dela levou menos de 3 s; senão a linha volta sem gastar tentativa, e o aviso diz que o post vai sair.
+ * app/publicar/novo/page.tsx). A passada da mídia do carrossel pede 52 s dos 55 do orçamento, e no "agora" das duas
+ * redes ela nunca começa: o LinkedIn conta o prazo com a reserva do Instagram (achado 222,
+ * `comecoDoLinkedinNoAgoraDasDuas`), a linha volta sem gastar tentativa, e o aviso diz que o post vai sair.
  * As linhas só entram depois de TODAS as cópias: se a função for cortada no meio delas, nada foi gravado, e as que já
  * subiram ficam no bucket sem dono, como a cópia que o `apagarACopiaSemDerrubar` não consegue apagar.
  */
@@ -435,12 +436,16 @@ export async function publicarNasDuasRedes(formData: FormData): Promise<void> {
     redirect(urlDePublicarComAviso(avisoDasDuasRedes({ tipo: "instagram_nao_entrou", linkedin: lado })));
   }
 
-  // 6. O "AGORA": o LinkedIn primeiro, só a própria linha; depois o dreno de hoje, para o Instagram.
+  // 6. O "AGORA": o LinkedIn primeiro, só a própria linha; depois o dreno do clique, para o Instagram, que não pega o
+  // post do LinkedIn (a 3a-0). NO CARROSSEL, o LinkedIn conta o prazo com a reserva do Instagram (achado 222): o
+  // documento nunca começa neste clique, e a linha volta adiada antes do dreno do Instagram, que sai na hora. Na
+  // imagem, o começo é o da função, como na 2b.
+  const inicioDoLinkedin = comecoDoLinkedinNoAgoraDasDuas(formaNoLinkedin, inicioDaFuncaoMs);
   let desfecho: "publicado" | "aguardando" | "falhou" | null = null;
   let motivo: string | null = null;
   if (linkedin.entrou && linkedin.jaVale) {
     try {
-      desfecho = await drenarUmaPublicacaoDoLinkedin(linkedin.id, inicioDaFuncaoMs);
+      desfecho = await drenarUmaPublicacaoDoLinkedin(linkedin.id, inicioDoLinkedin);
       if (desfecho === "falhou") motivo = await erroDaLinha(linkedin.id);
     } catch {
       // O mesmo `catch` do `publicarNoLinkedin`: a linha pode ter ficado pendente sem tique, e este tique é o que
```

- [ ] **Passo 4: rodar e ver passar**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-carrossel-pdf"; cd "$C" || exit 1
npx --no-install vitest run tests/dreno-com-prazo.test.ts 2>&1 | tee ../el3a-f4bis-green-puros.log
docker ps --format '{{.Names}} {{.Status}}' | grep metodochat-banco-de-teste   # healthy; senão, docker start e espere healthy
DATABASE_URL_TESTES=postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes npx --no-install vitest run --config vitest.integracao.config.ts testes-integracao/linkedin-duas-redes.integracao.ts 2>&1 | tee ../el3a-f4bis-green-integ.log
npx --no-install vitest run 2>&1 | tee ../el3a-f4bis-suite.log
npx --no-install tsc --noEmit
npx --no-install eslint app/publicar/actions.ts lib/linkedin-fila.ts testes-integracao/linkedin-duas-redes.integracao.ts tests/dreno-com-prazo.test.ts
git diff --name-only 40b2aec -- lib/queue-drain.ts lib/fila-tipos.ts migrations scripts package.json package-lock.json   # vazio
```

Esperado: nos puros, "Test Files 1 passed (1)" e "Tests 15 passed (15)"; a integração: `ALVO: banco de TESTE`, "nenhum schema teste_tmp_* no banco" antes e depois, "Test Files 1 passed (1)" e "Tests 36 passed (36)"; a suíte pura inteira: "Test Files 160 passed (160)" e "Tests 3825 passed (3825)". O `tsc` e o lint sem saída, e a guarda vazia.

- [ ] **Passo 5: o commit**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-carrossel-pdf"; cd "$C" || exit 1
node ../varrer-texto.mjs app/publicar/actions.ts lib/linkedin-fila.ts testes-integracao/linkedin-duas-redes.integracao.ts tests/dreno-com-prazo.test.ts && test "$(git branch --show-current)" = linkedin-carrossel-pdf && git add app/publicar/actions.ts lib/linkedin-fila.ts testes-integracao/linkedin-duas-redes.integracao.ts tests/dreno-com-prazo.test.ts && git commit -m "No agora do carrossel nas duas redes, o LinkedIn conta o prazo com a reserva do Instagram, e o documento não começa no clique"
git show HEAD | git patch-id --stable | cut -c1-12   # 7eaad643609a
```

O patch-id tem de começar por `7eaad643609a` (mudou em relação ao plano de 12/11; ver "O que mudou"). Se não começar, pare.

---

### FASE 5 — A tela de compor leva o carrossel ao LinkedIn, e o botão diz onde e quando o post sai

**Arquivos:** `app/publicar/enviador.tsx`, `app/publicar/navegador.ts`, `lib/linkedin-publicacao.ts`, `lib/redes-do-post.ts`, `testes-dom/publicar-compositor-linkedin.dom.tsx`, `testes-dom/publicar-compositor.dom.tsx`, `tests/redes-do-post.test.ts`.

- [ ] **Passo 1: os testes**

Em `tests/redes-do-post.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/redes-do-post.test.ts b/tests/redes-do-post.test.ts
index 0020202..f6ac988 100644
--- a/tests/redes-do-post.test.ts
+++ b/tests/redes-do-post.test.ts
@@ -11,7 +11,7 @@ import {
   textoQueVaiAoLinkedin,
 } from "@/lib/redes-do-post";
 import { avisoDaPublicacaoEnfileirada } from "@/lib/avisos";
-import { avisoDoPostNoLinkedin } from "@/lib/linkedin-publicacao";
+import { avisoDoPostNoLinkedin, textoDoProblemaDoCarrosselNoLinkedin } from "@/lib/linkedin-publicacao";
 import { textoDaRecusaDaPublicacao } from "@/lib/publicacao";
 
 // AS DUAS REDES NO MESMO POST (docs/specs/2026-11-06-linkedin-no-perfil.md, §6 e §7; a parte 2b). As regras puras
@@ -32,10 +32,10 @@ describe("o que cada rede aceita", () => {
     expect(redeAceitaAForma("instagram", "texto")).toContain("só de texto");
   });
 
-  it("o LinkedIn aceita o só texto e a imagem; o carrossel e o reels chegam na próxima entrega, e o story nunca", () => {
+  it("o LinkedIn aceita o só texto, a imagem e o carrossel (em PDF, a parte 3a); o reels chega na próxima entrega, e o story nunca", () => {
     expect(redeAceitaAForma("linkedin", "texto")).toBeNull();
     expect(redeAceitaAForma("linkedin", "imagem")).toBeNull();
-    expect(redeAceitaAForma("linkedin", "carrossel")).toContain("próxima entrega");
+    expect(redeAceitaAForma("linkedin", "carrossel")).toBeNull();
     expect(redeAceitaAForma("linkedin", "reels")).toContain("próxima entrega");
     expect(redeAceitaAForma("linkedin", "story")).toContain("não tem story");
   });
@@ -79,14 +79,26 @@ describe("as caixinhas", () => {
     expect(e.linkedin).toEqual({ ligada: false, marcada: false, motivo: desligado.motivo });
   });
 
-  it("o story, o carrossel e o reels desligam o LinkedIn, com o motivo da forma", () => {
-    for (const forma of ["story", "carrossel", "reels"] as const) {
+  it("o story e o reels desligam o LinkedIn, com o motivo da forma", () => {
+    for (const forma of ["story", "reels"] as const) {
       const e = estadoDasCaixinhas({ forma, marcadas: as2, linkedin: ligado });
       expect(e.linkedin).toEqual({ ligada: false, marcada: false, motivo: redeAceitaAForma("linkedin", forma) });
       expect(e.instagram.marcada).toBe(true);
     }
   });
 
+  // O PDF DO CARROSSEL SÓ LEVA FOTOS (a parte 3a): um vídeo na lista desliga o LinkedIn, e o Instagram não muda.
+  it("o carrossel com vídeo desliga o LinkedIn, com o motivo do PDF; sem vídeo, ele fica ligado", () => {
+    const comVideo = estadoDasCaixinhas({ forma: "carrossel", marcadas: as2, linkedin: ligado, comVideo: true });
+    expect(comVideo.linkedin).toEqual({ ligada: false, marcada: false, motivo: textoDoProblemaDoCarrosselNoLinkedin("video") });
+    expect(comVideo.instagram).toEqual({ ligada: true, marcada: true, motivo: null });
+    const soFotos = estadoDasCaixinhas({ forma: "carrossel", marcadas: as2, linkedin: ligado, comVideo: false });
+    expect(soFotos.linkedin).toEqual({ ligada: true, marcada: true, motivo: null });
+    // SEM A CONEXÃO, o motivo é o da conexão, como antes.
+    const semConexao = estadoDasCaixinhas({ forma: "carrossel", marcadas: as2, linkedin: desligado, comVideo: true });
+    expect(semConexao.linkedin?.motivo).toBe(desligado.motivo);
+  });
+
   it("o só texto desliga o Instagram, com o motivo", () => {
     const e = estadoDasCaixinhas({ forma: "texto", marcadas: as2, linkedin: ligado });
     expect(e.instagram).toEqual({ ligada: false, marcada: false, motivo: redeAceitaAForma("instagram", "texto") });
```

Em `testes-dom/publicar-compositor-linkedin.dom.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-dom/publicar-compositor-linkedin.dom.tsx b/testes-dom/publicar-compositor-linkedin.dom.tsx
index 40d8e4a..4f018db 100644
--- a/testes-dom/publicar-compositor-linkedin.dom.tsx
+++ b/testes-dom/publicar-compositor-linkedin.dom.tsx
@@ -1,45 +1,80 @@
 import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
 import { afterEach, describe, expect, it, vi } from "vitest";
 import Enviador from "@/app/publicar/enviador";
-import { limparEnvios } from "@/app/publicar/envios";
+import { lerEnvios, limparEnvios } from "@/app/publicar/envios";
 import type { Medidas, Navegador } from "@/app/publicar/navegador";
 import {
+  NOTA_DO_CARROSSEL_NO_LINKEDIN,
   NOTA_DO_CONTADOR_DO_LINKEDIN,
   tamanhoDoTextoNoLinkedin,
   textoDaRecusaNoLinkedin,
+  textoDoProblemaDoCarrosselNoLinkedin,
   type DisponibilidadeDoLinkedin,
 } from "@/lib/linkedin-publicacao";
-import { rotuloDaForma } from "@/lib/publicacao";
+import type { CabecalhoDoJpeg } from "@/lib/bonus/imagem-jpeg";
+import { rotuloDaForma, rotuloDoEnvio, textoDoEnvioQueNaoFoi } from "@/lib/publicacao";
 import { NOTA_DA_LEGENDA_NO_LINKEDIN, redeAceitaAForma, TEXTO_SEM_REDE } from "@/lib/redes-do-post";
 
 // O COMPOR COM AS DUAS REDES (docs/specs/2026-11-06-linkedin-no-perfil.md, §7; a parte 2b). A tela tem as caixinhas
 // "Instagram" e "LinkedIn", que começam só com o Instagram marcado (a decisão do Eduardo, 10/11). Cada forma liga e
-// desliga as redes, com o motivo: o só texto é só do LinkedIn, e o carrossel, o reels e o story não vão ao LinkedIn
-// nesta entrega. Só no LinkedIn, o campo é o "Texto" da parte 2a; nas duas, a "Legenda" e o "Texto para o LinkedIn",
+// desliga as redes, com o motivo: o só texto é só do LinkedIn, o reels e o story não vão ao LinkedIn, e o carrossel
+// vai como PDF, só com fotos (a parte 3a). Só no LinkedIn, o campo é o "Texto" da parte 2a; nas duas, a "Legenda" e o "Texto para o LinkedIn",
 // opcional. O clique chama a action das redes marcadas, e só ela. O navegador e as actions são falsos, como no
 // teste do compositor (testes-dom/publicar-compositor.dom.tsx).
 
 const MIB = 1024 * 1024;
 const PASTA = "17841400000000002";
-const MEDIDAS: Record<string, Medidas> = { "arte.jpg": { largura: 1080, altura: 1350 } };
+const NA_MEDIDA = { largura: 1080, altura: 1350 };
+const MEDIDAS: Record<string, Medidas> = {
+  "arte.jpg": NA_MEDIDA,
+  // O CARROSSEL DA PARTE 3a: fotos na medida exata do 4:5, que vão cruas pela regra do Instagram.
+  "a.jpg": NA_MEDIDA,
+  "b.jpg": NA_MEDIDA,
+  "cmyk.jpg": NA_MEDIDA,
+  "grande-1.jpg": NA_MEDIDA,
+  "grande-2.jpg": NA_MEDIDA,
+  "clipe.mp4": { largura: 1080, altura: 1920, segundos: 10 },
+};
 
-function navegadorFalso() {
-  const f = { assinados: [] as { forma: string; nome: string }[] };
+/** O cabeçalho que a tela lê com o LinkedIn marcado no carrossel: o de cor de tela, a não ser o que o caso pedir. */
+const RGB: CabecalhoDoJpeg = { largura: 1080, altura: 1350, componentes: 3, precisao: 8, marcador: 0xc0 };
+const CMYK: CabecalhoDoJpeg = { ...RGB, componentes: 4 };
+
+type OpcoesDoNavegador = {
+  cabecalhos?: Record<string, CabecalhoDoJpeg>;
+  /** O navegador sem o leitor do cabeçalho (o método é opcional). */
+  semCabecalho?: boolean;
+  /** A subida destes arquivos falha uma vez. */
+  falharSubidaDe?: Set<string>;
+};
+
+function navegadorFalso(opcoes: OpcoesDoNavegador = {}) {
+  const f = { assinados: [] as { forma: string; nome: string }[], enquadrados: [] as string[], cabecalhosLidos: [] as string[] };
   const nav: Navegador = {
     criarEndereco: (a) => `blob:${a.name}`,
     soltarEndereco: () => {},
     medir: async (a) => MEDIDAS[a.name] ?? {},
     lerOrientacao: async () => 1,
-    enquadrar: async (a) => new File(["jpeg"], a.name, { type: "image/jpeg" }),
+    enquadrar: async (a) => {
+      f.enquadrados.push(a.name);
+      return new File(["jpeg"], a.name, { type: "image/jpeg" });
+    },
     converter: async (a) => a,
     assinar: async (p) => {
       f.assinados.push({ forma: p.forma, nome: p.nome });
       return { ok: true, caminho: `${PASTA}/${p.nome.replace(/\.\w+$/, "")}.jpg`, url: `https://bucket.test/${p.nome}` };
     },
     subir: async (_url, arquivo, aoAndar) => {
+      if (opcoes.falharSubidaDe?.delete(arquivo.name)) throw new Error("A conexão caiu durante o envio.");
       aoAndar(arquivo.size, arquivo.size);
     },
   };
+  if (!opcoes.semCabecalho) {
+    nav.lerCabecalho = async (a) => {
+      f.cabecalhosLidos.push(a.name);
+      return opcoes.cabecalhos?.[a.name] ?? RGB;
+    };
+  }
   return { f, nav };
 }
 
@@ -58,8 +93,8 @@ const QUANDO = (
 
 const LIGADO: DisponibilidadeDoLinkedin = { disponivel: true, nome: "Dra. Ana Souza" };
 
-function renderizar(linkedin: DisponibilidadeDoLinkedin | null) {
-  const { f, nav } = navegadorFalso();
+function renderizar(linkedin: DisponibilidadeDoLinkedin | null, opcoes: OpcoesDoNavegador = {}) {
+  const { f, nav } = navegadorFalso(opcoes);
   const acao = vi.fn(async (_dados: FormData) => {});
   const acaoDoLinkedin = vi.fn(async (_dados: FormData) => {});
   const acaoDasDuasRedes = vi.fn(async (_dados: FormData) => {});
@@ -80,7 +115,8 @@ function renderizar(linkedin: DisponibilidadeDoLinkedin | null) {
   return { f, acao, acaoDoLinkedin, acaoDasDuasRedes };
 }
 
-const botao = () => screen.getByRole("button", { name: /^(Publicar|Enviando…)$/ }) as HTMLButtonElement;
+// O BOTÃO DIZ AS REDES E O QUANDO (a parte 3a, o 215): "Publicar no Instagram", "Agendar no LinkedIn"...
+const botao = () => screen.getByRole("button", { name: /^(Publicar|Agendar|Enviando…)/ }) as HTMLButtonElement;
 const caixinha = (rede: "Instagram" | "LinkedIn") => screen.getByLabelText(rede) as HTMLInputElement;
 const campoDoTexto = () => screen.getByLabelText("Texto") as HTMLTextAreaElement;
 const campoDaLegenda = () => screen.getByLabelText("Legenda") as HTMLTextAreaElement;
@@ -96,6 +132,20 @@ async function escolherAImagem() {
   await waitFor(() => expect(screen.queryByText("Lendo o arquivo…")).toBeNull());
 }
 
+/** Os arquivos do carrossel: o nome vira um JPEG de 1.000 bytes (ou um MP4, pela extensão), ou o arquivo pronto. */
+async function escolherArquivos(arquivos: (string | File)[]) {
+  await act(async () => {
+    fireEvent.change(screen.getByLabelText("Arquivos"), {
+      target: {
+        files: arquivos.map((a) =>
+          typeof a === "string" ? new File([new Uint8Array(1000)], a, { type: a.endsWith(".mp4") ? "video/mp4" : "image/jpeg" }) : a
+        ),
+      },
+    });
+  });
+  await waitFor(() => expect(screen.queryByText("Lendo o arquivo…")).toBeNull());
+}
+
 async function clicarEmPublicar() {
   await act(async () => {
     fireEvent.click(botao());
@@ -135,11 +185,14 @@ describe("as caixinhas das redes", () => {
     expect(Array.from(forma.options).map((o) => o.value)).not.toContain("texto");
   });
 
-  it("o carrossel, o reels e o story desligam e desmarcam o LinkedIn, com o motivo da forma", () => {
+  it("o reels e o story desligam e desmarcam o LinkedIn, com o motivo da forma; o carrossel não (a parte 3a)", () => {
     renderizar(LIGADO);
     fireEvent.click(caixinha("LinkedIn"));
     expect(caixinha("LinkedIn").checked).toBe(true);
-    for (const forma of ["carrossel", "reels", "story"] as const) {
+    escolherForma("carrossel");
+    expect(caixinha("LinkedIn").disabled).toBe(false);
+    expect(caixinha("LinkedIn").checked).toBe(true);
+    for (const forma of ["reels", "story"] as const) {
       escolherForma(forma);
       expect(caixinha("LinkedIn").disabled).toBe(true);
       expect(caixinha("LinkedIn").checked).toBe(false);
@@ -316,25 +369,167 @@ describe("nas duas redes", () => {
     expect(acaoDasDuasRedes).not.toHaveBeenCalled();
   });
 
-  it("trocar para o carrossel com as duas marcadas deixa só o Instagram, e o clique vai à action dele", async () => {
-    const { acao, acaoDasDuasRedes } = renderizar(LIGADO);
+  it("o carrossel com as duas marcadas: as duas ficam, e o clique vai à action das duas, com a forma e as fotos na ordem", async () => {
+    const { f, acao, acaoDasDuasRedes } = renderizar(LIGADO);
     fireEvent.click(caixinha("LinkedIn"));
     escolherForma("carrossel");
+    expect(caixinha("LinkedIn").checked).toBe(true);
+    expect(screen.getByLabelText("Texto para o LinkedIn (opcional)")).toBeTruthy();
+    expect(screen.getByText(NOTA_DO_CARROSSEL_NO_LINKEDIN)).toBeTruthy();
+    await escolherArquivos(["b.jpg", "a.jpg"]);
+    fireEvent.change(campoDaLegenda(), { target: { value: "O carrossel #ig" } });
+    await clicarEmPublicar();
+    await waitFor(() => expect(acaoDasDuasRedes).toHaveBeenCalledTimes(1));
+    const dados = acaoDasDuasRedes.mock.calls[0][0];
+    expect(dados.get("forma")).toBe("carrossel");
+    expect(dados.get("caminhos")).toBe(`${PASTA}/b.jpg\n${PASTA}/a.jpg`);
+    expect(f.assinados).toEqual([
+      { forma: "carrossel", nome: "b.jpg" },
+      { forma: "carrossel", nome: "a.jpg" },
+    ]);
+    expect(acao).not.toHaveBeenCalled();
+  });
+});
+
+// O CARROSSEL NO LINKEDIN (a parte 3a; scratchpad/desenho-li3.md, §6): ele vai como PDF, só com fotos, até 15 MB
+// juntas. O vídeo na lista desliga o LinkedIn; com o LinkedIn marcado, o JPEG só vai cru se o PDF o leva como está
+// (`vaiCruParaOLinkedin`), e o resto passa pelo canvas; o total é contado pelo que de fato sobe.
+describe("o carrossel no LinkedIn (a parte 3a)", () => {
+  it("só no LinkedIn: a action do LinkedIn recebe a forma carrossel e as fotos na ordem, com a nota do PDF", async () => {
+    const { f, acao, acaoDoLinkedin } = renderizar(LIGADO);
+    escolherForma("carrossel");
+    fireEvent.click(caixinha("LinkedIn"));
+    fireEvent.click(caixinha("Instagram"));
+    expect(screen.getByText(NOTA_DO_CARROSSEL_NO_LINKEDIN)).toBeTruthy();
+    await escolherArquivos(["b.jpg", "a.jpg"]);
+    fireEvent.change(campoDoTexto(), { target: { value: "O carrossel" } });
+    await clicarEmPublicar();
+    await waitFor(() => expect(acaoDoLinkedin).toHaveBeenCalledTimes(1));
+    const dados = acaoDoLinkedin.mock.calls[0][0];
+    expect(dados.get("forma_linkedin")).toBe("carrossel");
+    expect(dados.get("caminhos")).toBe(`${PASTA}/b.jpg\n${PASTA}/a.jpg`);
+    expect(f.assinados.map((a) => a.forma)).toEqual(["carrossel", "carrossel"]);
+    expect(acao).not.toHaveBeenCalled();
+  });
+
+  it("um vídeo no carrossel desliga e desmarca o LinkedIn, com o motivo do PDF, e tirar o vídeo não o remarca", async () => {
+    renderizar(LIGADO);
+    escolherForma("carrossel");
+    fireEvent.click(caixinha("LinkedIn"));
+    expect(caixinha("LinkedIn").checked).toBe(true);
+    await escolherArquivos(["a.jpg", "clipe.mp4"]);
+    expect(caixinha("LinkedIn").disabled).toBe(true);
     expect(caixinha("LinkedIn").checked).toBe(false);
-    expect(screen.queryByLabelText("Texto para o LinkedIn (opcional)")).toBeNull();
-    await act(async () => {
-      fireEvent.change(screen.getByLabelText("Arquivos"), {
-        target: {
-          files: [
-            new File([new Uint8Array(1000)], "arte.jpg", { type: "image/jpeg" }),
-            new File([new Uint8Array(1000)], "arte.jpg", { type: "image/jpeg" }),
-          ],
-        },
-      });
-    });
-    await waitFor(() => expect(screen.queryByText("Lendo o arquivo…")).toBeNull());
+    expect(screen.getByText(textoDoProblemaDoCarrosselNoLinkedin("video"))).toBeTruthy();
+    expect(caixinha("Instagram").checked).toBe(true);
+    // O POST SAI PÚBLICO NO PERFIL PESSOAL: tirar o vídeo liga a caixinha, mas só vai quem marcar de novo.
+    fireEvent.click(screen.getByRole("button", { name: "Remover clipe.mp4" }));
+    expect(caixinha("LinkedIn").disabled).toBe(false);
+    expect(caixinha("LinkedIn").checked).toBe(false);
+  });
+
+  it("com o LinkedIn marcado, o JPEG que o PDF não leva como está (CMYK) passa pelo canvas, e o de cor de tela vai cru", async () => {
+    const { f, acaoDasDuasRedes } = renderizar(LIGADO, { cabecalhos: { "cmyk.jpg": CMYK } });
+    escolherForma("carrossel");
+    fireEvent.click(caixinha("LinkedIn"));
+    await escolherArquivos(["a.jpg", "cmyk.jpg"]);
+    fireEvent.change(campoDaLegenda(), { target: { value: "O carrossel #ig" } });
+    await clicarEmPublicar();
+    await waitFor(() => expect(acaoDasDuasRedes).toHaveBeenCalledTimes(1));
+    expect(f.cabecalhosLidos).toEqual(["a.jpg", "cmyk.jpg"]);
+    expect(f.enquadrados).toEqual(["cmyk.jpg"]);
+    expect(acaoDasDuasRedes.mock.calls[0][0].get("caminhos")).toBe(`${PASTA}/a.jpg\n${PASTA}/cmyk.jpg`);
+  });
+
+  it("sem o LinkedIn, a regra do Instagram não muda: o mesmo JPEG de 4 componentes vai cru, e o cabeçalho nem é lido", async () => {
+    const { f, acao } = renderizar(LIGADO, { cabecalhos: { "cmyk.jpg": CMYK } });
+    escolherForma("carrossel");
+    await escolherArquivos(["a.jpg", "cmyk.jpg"]);
+    fireEvent.change(campoDaLegenda(), { target: { value: "O carrossel #ig" } });
     await clicarEmPublicar();
     await waitFor(() => expect(acao).toHaveBeenCalledTimes(1));
+    expect(f.cabecalhosLidos).toEqual([]);
+    expect(f.enquadrados).toEqual([]);
+  });
+
+  it("o navegador que não lê o cabeçalho: com o LinkedIn marcado, toda foto passa pelo canvas", async () => {
+    const { f, acaoDasDuasRedes } = renderizar(LIGADO, { semCabecalho: true });
+    escolherForma("carrossel");
+    fireEvent.click(caixinha("LinkedIn"));
+    await escolherArquivos(["a.jpg", "b.jpg"]);
+    fireEvent.change(campoDaLegenda(), { target: { value: "O carrossel #ig" } });
+    await clicarEmPublicar();
+    await waitFor(() => expect(acaoDasDuasRedes).toHaveBeenCalledTimes(1));
+    expect(f.enquadrados).toEqual(["a.jpg", "b.jpg"]);
+  });
+
+  it("o total passa de 15 MB com o LinkedIn: a foto que passaria do teto não sobe, a lista diz por quê, e nada é publicado", async () => {
+    const { f, acaoDasDuasRedes } = renderizar(LIGADO);
+    escolherForma("carrossel");
+    fireEvent.click(caixinha("LinkedIn"));
+    // DUAS FOTOS DE 7,6 MiB, que vão cruas (até 8 MiB, na medida): 15,2 MiB juntas.
+    const grande = (nome: string) => new File([new Uint8Array(Math.floor(7.6 * MIB))], nome, { type: "image/jpeg" });
+    await escolherArquivos([grande("grande-1.jpg"), grande("grande-2.jpg")]);
+    fireEvent.change(campoDaLegenda(), { target: { value: "O carrossel #ig" } });
+    await clicarEmPublicar();
+    const segunda = rotuloDoEnvio("grande-2.jpg", 1, 2);
+    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(textoDoEnvioQueNaoFoi(segunda)));
+    expect(lerEnvios().find((e) => e.nome === segunda)).toMatchObject({
+      estado: "recusado",
+      detalhe: textoDoProblemaDoCarrosselNoLinkedin("grande"),
+    });
+    expect(f.assinados).toEqual([{ forma: "carrossel", nome: "grande-1.jpg" }]);
     expect(acaoDasDuasRedes).not.toHaveBeenCalled();
   });
+
+  it("sem o LinkedIn, as mesmas fotos grandes sobem: o teto é só do PDF", async () => {
+    const { f, acao } = renderizar(LIGADO);
+    escolherForma("carrossel");
+    const grande = (nome: string) => new File([new Uint8Array(Math.floor(7.6 * MIB))], nome, { type: "image/jpeg" });
+    await escolherArquivos([grande("grande-1.jpg"), grande("grande-2.jpg")]);
+    fireEvent.change(campoDaLegenda(), { target: { value: "O carrossel #ig" } });
+    await clicarEmPublicar();
+    await waitFor(() => expect(acao).toHaveBeenCalledTimes(1));
+    expect(f.assinados).toHaveLength(2);
+  });
+
+  it("a foto que subiu crua só para o Instagram sobe de novo pelo canvas quando o LinkedIn é marcado depois", async () => {
+    const { f, acao, acaoDasDuasRedes } = renderizar(LIGADO, { cabecalhos: { "cmyk.jpg": CMYK }, falharSubidaDe: new Set(["b.jpg"]) });
+    escolherForma("carrossel");
+    await escolherArquivos(["cmyk.jpg", "b.jpg"]);
+    fireEvent.change(campoDaLegenda(), { target: { value: "O carrossel #ig" } });
+    // SÓ O INSTAGRAM: a foto CMYK sobe crua, e a segunda falha.
+    await clicarEmPublicar();
+    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(textoDoEnvioQueNaoFoi(rotuloDoEnvio("b.jpg", 1, 2))));
+    expect(f.enquadrados).toEqual([]);
+    expect(acao).not.toHaveBeenCalled();
+    // COM O LINKEDIN, o caminho guardado não vale: ela sobe de novo, pelo canvas.
+    fireEvent.click(caixinha("LinkedIn"));
+    await clicarEmPublicar();
+    await waitFor(() => expect(acaoDasDuasRedes).toHaveBeenCalledTimes(1));
+    expect(f.enquadrados).toEqual(["cmyk.jpg"]);
+    expect(f.assinados.map((a) => a.nome)).toEqual(["cmyk.jpg", "b.jpg", "cmyk.jpg", "b.jpg"]);
+  });
+});
+
+// O BOTÃO DIZ ONDE E QUANDO O POST SAI (o 215; a decisão do Eduardo de 11/11, "O botão diz as redes"): quem marcou só
+// o LinkedIn lê isso no próprio clique. O "Quando" vem pronto da página, e o botão acompanha a escolha.
+describe("o botão de publicar (215)", () => {
+  it("diz as redes marcadas, e Agendar com a outra hora", () => {
+    renderizar(LIGADO);
+    expect(botao().textContent).toBe("Publicar no Instagram");
+    fireEvent.click(caixinha("LinkedIn"));
+    expect(botao().textContent).toBe("Publicar no Instagram e no LinkedIn");
+    fireEvent.click(caixinha("Instagram"));
+    expect(botao().textContent).toBe("Publicar no LinkedIn");
+    fireEvent.click(screen.getByLabelText(/Publicar em outra hora/));
+    expect(botao().textContent).toBe("Agendar no LinkedIn");
+    fireEvent.click(screen.getByLabelText(/Publicar agora/));
+    expect(botao().textContent).toBe("Publicar no LinkedIn");
+  });
+
+  it("sem o LinkedIn na página, o botão continua Publicar, como antes", () => {
+    renderizar(null);
+    expect(botao().textContent).toBe("Publicar");
+  });
 });
```

Em `testes-dom/publicar-compositor.dom.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-dom/publicar-compositor.dom.tsx b/testes-dom/publicar-compositor.dom.tsx
index 0620e07..8c52723 100644
--- a/testes-dom/publicar-compositor.dom.tsx
+++ b/testes-dom/publicar-compositor.dom.tsx
@@ -670,6 +670,27 @@ describe("o navegador de verdade", () => {
     expect(await navegadorDeVerdade.lerOrientacao(ilegivel)).toBe(0);
   });
 
+  // O CABEÇALHO DO JPEG, para o carrossel do LinkedIn (a parte 3a): os componentes, a precisão e o processo, lidos
+  // dos primeiros 256 KiB. O que não é JPEG, o que não deu para ler e o SOF depois dos 256 KiB dão null, e o null
+  // vai pelo canvas.
+  it("lê o cabeçalho do JPEG para o carrossel do LinkedIn; o que não é JPEG, ou não deu para ler, é null", async () => {
+    const comSof = (componentes: number, antes: number[] = []) =>
+      new Uint8Array([0xff, 0xd8, ...antes, 0xff, 0xc0, 0, 8 + 3 * componentes, 8, 0, 20, 0, 16, componentes, ...Array(3 * componentes).fill(1), 0xff, 0xd9]);
+    const jpeg = (b: Uint8Array<ArrayBuffer>) => new File([b], "f.jpg", { type: "image/jpeg" });
+    expect(await navegadorDeVerdade.lerCabecalho?.(jpeg(comSof(3)))).toEqual({ largura: 16, altura: 20, componentes: 3, precisao: 8, marcador: 0xc0 });
+    expect((await navegadorDeVerdade.lerCabecalho?.(jpeg(comSof(4))))?.componentes).toBe(4);
+    expect(await navegadorDeVerdade.lerCabecalho?.(new File([comSof(3)], "f.png", { type: "image/png" }))).toBeNull();
+    const ilegivel = {
+      type: "image/jpeg",
+      slice: () => ({ arrayBuffer: () => Promise.reject(new Error("o arquivo sumiu do disco")) }),
+    } as unknown as File;
+    expect(await navegadorDeVerdade.lerCabecalho?.(ilegivel)).toBeNull();
+    // CINCO SEGMENTOS DE 60.000 BYTES ANTES DO SOF: 300.000 bytes, além dos 256 KiB lidos.
+    const longo: number[] = [];
+    for (let k = 0; k < 5; k++) longo.push(0xff, 0xe2, 0xea, 0x60, ...new Array(59_998).fill(0));
+    expect(await navegadorDeVerdade.lerCabecalho?.(jpeg(comSof(3, longo)))).toBeNull();
+  });
+
   it("o vídeo que o navegador não mede no tempo-limite fica sem medida, e o endereço é solto", async () => {
     vi.useFakeTimers();
     const soltos: string[] = [];
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-carrossel-pdf"; cd "$C" || exit 1
npx --no-install vitest run tests/redes-do-post.test.ts 2>&1 | tee ../el3a-f5-red-puros.log
npx --no-install vitest run --config vitest.dom.config.ts testes-dom/publicar-compositor-linkedin.dom.tsx testes-dom/publicar-compositor.dom.tsx 2>&1 | tee ../el3a-f5-red-tela.log
```

Esperado: nos puros, "Test Files 1 failed (1)" e "Tests 2 failed | 26 passed (28)": o carrossel ainda desliga o LinkedIn, e o `comVideo` não existe. Na tela, "Test Files 2 failed (2)" e "Tests 10 failed | 56 passed (66)". Passam já, de propósito, três guardas: sem o LinkedIn, o CMYK vai cru; sem o LinkedIn, as fotos grandes sobem; e, sem o LinkedIn na página, o botão continua "Publicar".

- [ ] **Passo 3: o código**

Em `lib/redes-do-post.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/redes-do-post.ts b/lib/redes-do-post.ts
index e7dfef9..4d66c39 100644
--- a/lib/redes-do-post.ts
+++ b/lib/redes-do-post.ts
@@ -3,7 +3,11 @@
 // ao LinkedIn quando o post é das duas, e o aviso das duas. As regras de cada rede continuam onde estavam: as do
 // Instagram em lib/publicacao.ts, e as do LinkedIn em lib/linkedin-publicacao.ts.
 import { avisoDaPublicacaoEnfileirada, type Aviso } from "@/lib/avisos";
-import { avisoDoPostNoLinkedin, type DisponibilidadeDoLinkedin } from "@/lib/linkedin-publicacao";
+import {
+  avisoDoPostNoLinkedin,
+  textoDoProblemaDoCarrosselNoLinkedin,
+  type DisponibilidadeDoLinkedin,
+} from "@/lib/linkedin-publicacao";
 import { textoDaRecusaDaPublicacao, type FormaDePublicacao } from "@/lib/publicacao";
 
 export type Rede = "instagram" | "linkedin";
@@ -14,17 +18,17 @@ export type FormaDaTela = FormaDePublicacao | "texto";
 const FORMAS_DO_INSTAGRAM: readonly FormaDePublicacao[] = ["imagem", "carrossel", "reels", "story"];
 
 /**
- * POR QUE UMA REDE NÃO ACEITA A FORMA, ou null quando aceita. Nesta entrega o LinkedIn recebe só texto e imagem: o
- * carrossel (em PDF) e o vídeo chegam na próxima (a parte 3), e o story não existe lá.
+ * POR QUE UMA REDE NÃO ACEITA A FORMA, ou null quando aceita. O LinkedIn recebe o só texto, a imagem e o carrossel,
+ * que vai como PDF, só com fotos (a parte 3a; o vídeo na lista desliga a caixinha, em `estadoDasCaixinhas`). O vídeo
+ * chega na próxima entrega (a 3b), e o story não existe lá.
  */
 export function redeAceitaAForma(rede: Rede, forma: FormaDaTela): string | null {
   if (rede === "instagram") return forma === "texto" ? "O Instagram não publica post só de texto." : null;
   switch (forma) {
     case "texto":
     case "imagem":
-      return null;
     case "carrossel":
-      return "O LinkedIn recebe carrossel na próxima entrega.";
+      return null;
     case "reels":
       return "O LinkedIn recebe vídeo na próxima entrega.";
     case "story":
@@ -51,17 +55,23 @@ export type EstadoDaCaixinha = { ligada: boolean; marcada: boolean; motivo: stri
 /**
  * O ESTADO DE CADA CAIXINHA: ligada quando a rede aceita a forma (e, no LinkedIn, quando a conexão vale); marcada só
  * se ligada E marcada por quem compõe; e o motivo quando desligada. A caixinha desligada nunca conta como marcada,
- * mesmo que o formulário a mande. Sem o LinkedIn na página, não há caixinha do LinkedIn (`null`).
+ * mesmo que o formulário a mande. Sem o LinkedIn na página, não há caixinha do LinkedIn (`null`). No carrossel, o
+ * vídeo na lista desliga o LinkedIn: o PDF só leva fotos (a parte 3a).
  */
 export function estadoDasCaixinhas(p: {
   forma: FormaDaTela;
   marcadas: Readonly<Record<Rede, boolean>>;
   linkedin: DisponibilidadeDoLinkedin | null;
+  /** Há vídeo na lista de arquivos. */
+  comVideo?: boolean;
 }): { instagram: EstadoDaCaixinha; linkedin: EstadoDaCaixinha | null } {
   const motivoDoInstagram = redeAceitaAForma("instagram", p.forma);
   const instagram = { ligada: !motivoDoInstagram, marcada: !motivoDoInstagram && p.marcadas.instagram, motivo: motivoDoInstagram };
   if (!p.linkedin) return { instagram, linkedin: null };
-  const motivoDoLinkedin = p.linkedin.disponivel ? redeAceitaAForma("linkedin", p.forma) : p.linkedin.motivo;
+  const motivoDoLinkedin = p.linkedin.disponivel
+    ? (redeAceitaAForma("linkedin", p.forma) ??
+      (p.forma === "carrossel" && p.comVideo ? textoDoProblemaDoCarrosselNoLinkedin("video") : null))
+    : p.linkedin.motivo;
   return {
     instagram,
     linkedin: { ligada: !motivoDoLinkedin, marcada: !motivoDoLinkedin && p.marcadas.linkedin, motivo: motivoDoLinkedin },
```

Em `lib/linkedin-publicacao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/linkedin-publicacao.ts b/lib/linkedin-publicacao.ts
index b32a486..106fada 100644
--- a/lib/linkedin-publicacao.ts
+++ b/lib/linkedin-publicacao.ts
@@ -465,6 +465,11 @@ export function textoDoProblemaDoCarrosselNoLinkedin(p: ProblemaDoCarrosselNoLin
     : "As fotos do carrossel passam de 15 MB juntas, o limite do LinkedIn neste painel. Tire fotos ou use fotos menores.";
 }
 
+/** A NOTA DA TELA COM O LINKEDIN MARCADO NO CARROSSEL (a parte 3a): o que vai, e o teto, antes de subir. */
+export const NOTA_DO_CARROSSEL_NO_LINKEDIN = `No LinkedIn, o carrossel vai como um documento PDF, uma página por foto: só fotos, até ${
+  TETO_DO_CARROSSEL_NO_LINKEDIN_BYTES / (1024 * 1024)
+} MB juntas.`;
+
 /**
  * O JPEG QUE VAI COMO ESTÁ PARA O PDF DO CARROSSEL, e o que pode ir cru, sem o canvas, quando o LinkedIn está marcado
  * no carrossel: uma regra só, para a tela e para o PDF (lib/pdf-de-fotos.ts).
```

Em `app/publicar/navegador.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/publicar/navegador.ts b/app/publicar/navegador.ts
index 69adc2a..db55d6f 100644
--- a/app/publicar/navegador.ts
+++ b/app/publicar/navegador.ts
@@ -6,6 +6,7 @@ import {
   type FormaDePublicacao,
   type Retangulo,
 } from "@/lib/publicacao";
+import { cabecalhoDoJpeg, type CabecalhoDoJpeg } from "@/lib/bonus/imagem-jpeg";
 
 // A FIAÇÃO DO NAVEGADOR DO /publicar — medir, ler a orientação, desenhar no
 // `canvas`, pedir a URL assinada e subir com progresso. Nenhuma decisão de
@@ -37,6 +38,11 @@ export type Navegador = {
   medir(arquivo: File): Promise<Medidas>;
   /** A orientação EXIF do JPEG: de 1 a 8, ou 0 quando não deu para ler (`orientacaoDoJpeg`). */
   lerOrientacao(arquivo: File): Promise<number>;
+  /**
+   * O cabeçalho do JPEG (os componentes, a precisão e o processo), para o carrossel do LinkedIn (a parte 3a), ou
+   * `null`. OPCIONAL: o navegador sem ele manda toda foto do carrossel do LinkedIn pelo canvas, que é o caminho seguro.
+   */
+  lerCabecalho?(arquivo: File): Promise<CabecalhoDoJpeg | null>;
   /** O desenho do enquadramento, num JPEG do tamanho do canvas. */
   enquadrar(arquivo: File, desenho: { largura: number; altura: number; origem: Retangulo; destino: Retangulo }): Promise<File>;
   /** A conversão de sempre (o story): PNG ou WebP em JPEG, no tamanho que `planoDaConversao` mandou. */
@@ -199,6 +205,17 @@ export const navegadorDeVerdade: Navegador = {
 
   lerOrientacao: orientacaoDoArquivo,
 
+  // O CABEÇALHO DO JPEG (a parte 3a), nos primeiros 256 KiB: o SOF vem depois do EXIF e dos perfis de cor. O que ficar
+  // além deles, o que não é JPEG e a leitura que falha dão null, e o null vai pelo canvas.
+  async lerCabecalho(arquivo) {
+    if (arquivo.type !== "image/jpeg") return null;
+    try {
+      return cabecalhoDoJpeg(new Uint8Array(await arquivo.slice(0, 256 * 1024).arrayBuffer()));
+    } catch {
+      return null;
+    }
+  },
+
   async enquadrar(arquivo, d) {
     const bitmap = await bitmapDe(arquivo);
     try {
```

Em `app/publicar/enviador.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/publicar/enviador.tsx b/app/publicar/enviador.tsx
index 9e1c9b9..1b2cd0f 100644
--- a/app/publicar/enviador.tsx
+++ b/app/publicar/enviador.tsx
@@ -40,17 +40,23 @@ import {
   type ProporcaoDoPost,
 } from "@/lib/publicacao";
 // O LINKEDIN (a parte 2a: uma rede por post). As regras puras dele, sem import de servidor: as formas, o texto
-// contado como o LinkedIn conta (achado 212), as recusas do pedido e o id do envio.
+// contado como o LinkedIn conta (achado 212), as recusas do pedido e o id do envio. Na parte 3a, o carrossel em PDF:
+// a nota, o teto das fotos juntas e o JPEG que vai cru.
 import {
   LIMITE_DO_TEXTO_DO_LINKEDIN,
+  NOTA_DO_CARROSSEL_NO_LINKEDIN,
   NOTA_DO_CONTADOR_DO_LINKEDIN,
+  TETO_DO_CARROSSEL_NO_LINKEDIN_BYTES,
   novoIdDoEnvio,
   problemaDoTextoDoLinkedin,
   recusaDoPedidoNoLinkedin,
   rotuloDaFormaNoLinkedin,
   tamanhoDoTextoNoLinkedin,
   textoDaRecusaNoLinkedin,
+  textoDoProblemaDoCarrosselNoLinkedin,
+  vaiCruParaOLinkedin,
   type DisponibilidadeDoLinkedin,
+  type FormaNoLinkedin,
 } from "@/lib/linkedin-publicacao";
 // AS DUAS REDES NO MESMO POST (a parte 2b): o que cada forma aceita, as caixinhas, o texto que vai ao LinkedIn e a
 // recusa sem rede, das mesmas regras puras que a action lê.
@@ -61,6 +67,7 @@ import {
   estadoDasCaixinhas,
   formasDaTela,
   redeAceitaAForma,
+  textoDoBotaoDePublicar,
   textoQueVaiAoLinkedin,
   type FormaDaTela,
   type Rede,
@@ -148,8 +155,11 @@ type Slide = {
   /** A orientação EXIF; 0 até ser lida, e quando não deu para ler. */
   orientacao: number;
   modo: ModoDoEnquadramento;
-  /** O caminho no bucket, SÓ depois do 2xx da subida, e para qual conta, forma, proporção e modo ele foi feito. */
-  enviado: { caminho: string; chave: string } | null;
+  /**
+   * O caminho no bucket, SÓ depois do 2xx da subida, e para qual conta, forma, proporção e modo ele foi feito; e os
+   * bytes que subiram, para o teto do carrossel do LinkedIn (a parte 3a).
+   */
+  enviado: { caminho: string; chave: string; bytes: number } | null;
 };
 
 export default function Enviador({
@@ -179,7 +189,7 @@ export default function Enviador({
   linkedin?: DisponibilidadeDoLinkedin | null;
   /** A action do post só no LinkedIn (a parte 2a). */
   acaoDoLinkedin?: (dados: FormData) => Promise<void>;
-  /** A action do post de imagem nas duas redes (a parte 2b). */
+  /** A action do post de imagem ou de carrossel nas duas redes (a parte 2b; o carrossel na 3a). */
   acaoDasDuasRedes?: (dados: FormData) => Promise<void>;
   navegador?: Navegador;
 }) {
@@ -195,19 +205,34 @@ export default function Enviador({
   // O ID DO ENVIO, um por formulário: é a chave do só texto contra o clique repetido. A action termina em
   // `redirect`, que recria o componente (ver o cabeçalho), e o formulário seguinte nasce com outro.
   const [idDoEnvio] = useState(novoIdDoEnvio);
+  // A LISTA VEM ANTES DAS CAIXINHAS: um vídeo no carrossel desliga o LinkedIn (a parte 3a).
+  const [slides, setSlides] = useState<Slide[]>([]);
   const mostraARede = linkedin !== null && !!acaoDoLinkedin && !!acaoDasDuasRedes;
-  const redes = estadoDasCaixinhas({ forma: formaDaTela, marcadas, linkedin: mostraARede ? linkedin : null });
+  const redes = estadoDasCaixinhas({
+    forma: formaDaTela,
+    marcadas,
+    linkedin: mostraARede ? linkedin : null,
+    comVideo: slides.some((s) => s.video),
+  });
   const paraOInstagram = redes.instagram.marcada;
   const paraOLinkedin = redes.linkedin?.marcada === true;
   /** Só no LinkedIn: o campo "Texto" e a action da parte 2a. */
   const soNoLinkedin = paraOLinkedin && !paraOInstagram;
   /** Nas duas: a "Legenda", o "Texto para o LinkedIn" (opcional) e a action das duas. */
   const nasDuas = paraOLinkedin && paraOInstagram;
+  /** A forma que vai ao LinkedIn: o só texto, a imagem ou o carrossel, que vai como PDF (a parte 3a). */
+  const formaNoLinkedin: FormaNoLinkedin = formaDaTela === "texto" ? "texto" : formaDaTela === "carrossel" ? "carrossel" : "imagem";
+  /** O carrossel que vai ao LinkedIn: o JPEG só vai cru se o PDF o leva como está, e as fotos juntas têm o teto dele. */
+  const carrosselNoLinkedin = paraOLinkedin && formaNoLinkedin === "carrossel";
+  /**
+   * "AGENDAR" OU "PUBLICAR" NO BOTÃO (o 215). O "Quando" vem pronto da página e não é controlado aqui: a escolha chega
+   * pela mudança que sobe ao formulário. O padrão da página é "agora" (app/publicar/novo/page.tsx).
+   */
+  const [agendar, setAgendar] = useState(false);
   /** O texto próprio do LinkedIn, no post das duas redes. Vazio, vai a legenda. */
   const [textoProprio, setTextoProprio] = useState("");
   const [proporcao, setProporcao] = useState<ProporcaoDoPost>(PROPORCAO_PADRAO);
   const [legenda, setLegenda] = useState("");
-  const [slides, setSlides] = useState<Slide[]>([]);
   const [foraDaLista, setForaDaLista] = useState(0);
   const [recusa, setRecusa] = useState<string | null>(null);
   const [enviando, setEnviando] = useState(false);
@@ -297,7 +322,7 @@ export default function Enviador({
   // NO LINKEDIN, o texto é contado como o LinkedIn conta, pela mesma função da action. Enquanto se digita, só o
   // longo é vermelho: o vazio é o estado de quem ainda não começou, e é recusado no clique.
   const textoLongoNoLinkedin =
-    paraOLinkedin && problemaDoTextoDoLinkedin(textoDoLinkedin, formaDaTela === "texto" ? "texto" : "imagem") === "longo";
+    paraOLinkedin && problemaDoTextoDoLinkedin(textoDoLinkedin, formaNoLinkedin) === "longo";
   // O ARQUIVO SÓ NÃO EXISTE NO SÓ TEXTO.
   const temArquivo = formaDaTela !== "texto";
   const caixa = caixaDaMiniatura(forma, medidos, proporcao);
@@ -370,6 +395,12 @@ export default function Enviador({
       return lista.map((s) => porId.get(s.id) ?? s);
     });
     setForaDaLista(deFora);
+    // UM VÍDEO NO CARROSSEL DESMARCA O LINKEDIN (a parte 3a: o PDF só leva fotos), como a forma que ele não aceita: a
+    // caixinha se desliga com o motivo, e tirar o vídeo não a remarca. O post sai público no perfil pessoal, e só vai
+    // quem marcar de novo.
+    if (forma === "carrossel" && novos.some((n) => n.video && ficam.has(n.id))) {
+      setMarcadas((atuais) => ({ ...atuais, linkedin: false }));
+    }
     // A MEDIDA DE CADA UM, sem segurar a tela: a linha diz "Lendo o arquivo…"
     // até ela chegar.
     for (const s of novos.filter((n) => ficam.has(n.id))) {
@@ -395,10 +426,11 @@ export default function Enviador({
    * qualquer um sobe de novo. A CONTA ENTRA porque a troca no seletor entre uma
    * tentativa que falhou e a próxima deixaria guardado um caminho da pasta
    * antiga, e o clique seguinte recusaria com "a conta mudou" sem envio nenhum em
-   * andamento.
+   * andamento. O LINKEDIN NO CARROSSEL TAMBÉM ENTRA (a parte 3a): com ele, o JPEG que o PDF não leva como está passa
+   * pelo canvas, e o caminho que subiu cru só para o Instagram não serve.
    */
   function chaveDe(s: Slide): string {
-    return `${pasta}|${forma}|${proporcao}|${s.modo}`;
+    return `${pasta}|${forma}|${proporcao}|${s.modo}|${carrosselNoLinkedin ? "pdf" : "ig"}`;
   }
 
   /** A recusa da hora, pelas mesmas funções da action, sobre o formulário lido no clique. `null` quando ela serve. */
@@ -412,14 +444,22 @@ export default function Enviador({
     return momento.ok ? null : textoDaRecusaDaPublicacao(momento.motivo);
   }
 
-  /** Prepara e sobe um slide. Devolve o caminho, ou `null` com o motivo já escrito na janelinha. */
-  async function prepararESubir(s: Slide, nome: string, sinal: AbortSignal): Promise<string | null> {
+  /**
+   * Prepara e sobe um slide. Devolve o caminho e os bytes que subiram, ou `null` com o motivo já escrito na
+   * janelinha. `cabe` é o teto do carrossel do LinkedIn, sobre o arquivo que DE FATO sobe (a parte 3a).
+   */
+  async function prepararESubir(
+    s: Slide,
+    nome: string,
+    sinal: AbortSignal,
+    cabe: (bytes: number) => boolean
+  ): Promise<{ caminho: string; bytes: number } | null> {
     try {
       let arquivo = s.arquivo;
       let medidas: Medidas = s.medidas ?? {};
       const ehImagem = arquivo.type.startsWith("image/");
       if (ehImagem && enquadra && medidas.largura && medidas.altura) {
-        const cru = vaiSemRedesenho({
+        let cru = vaiSemRedesenho({
           mime: arquivo.type,
           largura: medidas.largura,
           altura: medidas.altura,
@@ -427,6 +467,14 @@ export default function Enviador({
           proporcao,
           orientacao: s.orientacao,
         });
+        // COM O LINKEDIN NO CARROSSEL, O JPEG SÓ VAI CRU SE O PDF O LEVA COMO ESTÁ (`vaiCruParaOLinkedin`, a mesma regra
+        // de lib/pdf-de-fotos.ts): o CMYK, o de 12 bits, o sem perda, o aritmético e o que não deu para ler (também no
+        // navegador sem o leitor) passam pelo canvas, que devolve um JPEG baseline de cor de tela. Sem o LinkedIn, a
+        // regra do Instagram não muda.
+        if (cru && carrosselNoLinkedin) {
+          cru = vaiCruParaOLinkedin((await navegador.lerCabecalho?.(s.arquivo)) ?? null);
+          seguir(sinal);
+        }
         if (!cru) {
           const g = geometriaDoEnquadramento({ largura: medidas.largura, altura: medidas.altura, proporcao, modo: s.modo });
           if (!g.ok) {
@@ -462,6 +510,11 @@ export default function Enviador({
         atualizarEnvio(nome, { estado: "recusado", detalhe: textoDoProblema(problema) });
         return null;
       }
+      // O TETO DO CARROSSEL DO LINKEDIN (a parte 3a), antes de assinar: a foto que passaria das fotos juntas não sobe.
+      if (!cabe(arquivo.size)) {
+        atualizarEnvio(nome, { estado: "recusado", detalhe: textoDoProblemaDoCarrosselNoLinkedin("grande") });
+        return null;
+      }
 
       atualizarEnvio(nome, { estado: "assinando", enviados: 0, total: arquivo.size });
       const assinatura = await navegador.assinar({ forma, nome: arquivo.name, ...declarado }, sinal);
@@ -474,7 +527,7 @@ export default function Enviador({
       atualizarEnvio(nome, { estado: "enviando", enviados: 0, total: arquivo.size });
       await navegador.subir(assinatura.url, arquivo, (enviados, total) => atualizarEnvio(nome, { enviados, total }), sinal);
       atualizarEnvio(nome, { estado: "pronto", enviados: arquivo.size, total: arquivo.size });
-      return assinatura.caminho;
+      return { caminho: assinatura.caminho, bytes: arquivo.size };
     } catch (erro) {
       // A LEVA INTERROMPIDA PELA SAÍDA DA TELA NÃO ESCREVE NADA: a limpeza já pôs
       // "A publicação não foi pedida." na janelinha, e "O envio foi
@@ -490,7 +543,7 @@ export default function Enviador({
   /** Sobe os válidos na ordem da lista. Os que já subiram para a mesma chave não sobem de novo. */
   async function subirTodos(lista: Slide[], sinal: AbortSignal): Promise<string[] | null> {
     const nomes = lista.map((s, i) => rotuloDoEnvio(s.arquivo.name, i, lista.length));
-    const jaEnviado = (s: Slide) => (s.enviado && s.enviado.chave === chaveDe(s) ? s.enviado.caminho : null);
+    const jaEnviado = (s: Slide) => (s.enviado && s.enviado.chave === chaveDe(s) ? s.enviado : null);
     definirEnvios(
       lista.map(
         (s, i): EnvioEmAndamento =>
@@ -499,16 +552,27 @@ export default function Enviador({
             : { nome: nomes[i], estado: "escolhido", enviados: 0, total: s.arquivo.size }
       )
     );
+    // O TETO DO CARROSSEL DO LINKEDIN (a parte 3a): as fotos juntas, contadas pelo que DE FATO sobe (depois do
+    // canvas), na ordem da lista, as já guardadas também. A foto que passaria do teto não sobe, e o motivo vai à lista.
+    const teto = carrosselNoLinkedin ? TETO_DO_CARROSSEL_NO_LINKEDIN_BYTES : null;
+    let total = 0;
+    const cabe = (bytes: number) => teto === null || total + bytes <= teto;
     const caminhos: string[] = [];
     for (let i = 0; i < lista.length; i++) {
       const guardado = jaEnviado(lista[i]);
       if (guardado) {
-        caminhos.push(guardado);
+        if (!cabe(guardado.bytes)) {
+          atualizarEnvio(nomes[i], { estado: "recusado", detalhe: textoDoProblemaDoCarrosselNoLinkedin("grande") });
+          setRecusa(textoDoEnvioQueNaoFoi(nomes[i]));
+          return null;
+        }
+        total += guardado.bytes;
+        caminhos.push(guardado.caminho);
         continue;
       }
-      const caminho = await prepararESubir(lista[i], nomes[i], sinal);
+      const subido = await prepararESubir(lista[i], nomes[i], sinal, cabe);
       if (sinal.aborted) return null;
-      if (!caminho) {
+      if (!subido) {
         setRecusa(textoDoEnvioQueNaoFoi(nomes[i]));
         return null;
       }
@@ -516,8 +580,9 @@ export default function Enviador({
       // depois de `subir` resolver.
       const chave = chaveDe(lista[i]);
       const id = lista[i].id;
-      setSlides((atuais) => atuais.map((x) => (x.id === id ? { ...x, enviado: { caminho, chave } } : x)));
-      caminhos.push(caminho);
+      setSlides((atuais) => atuais.map((x) => (x.id === id ? { ...x, enviado: { ...subido, chave } } : x)));
+      total += subido.bytes;
+      caminhos.push(subido.caminho);
     }
     return caminhos;
   }
@@ -568,7 +633,6 @@ export default function Enviador({
           legenda: String(pedido.get("legenda") ?? ""),
           textoProprio: String(pedido.get("texto_linkedin") ?? ""),
         });
-    const formaNoLinkedin = formaDaTela === "texto" ? "texto" : "imagem";
     if (paraOLinkedin) {
       // O TEXTO DO LINKEDIN, pela mesma função da action, antes de subir qualquer arquivo.
       const doTexto = problemaDoTextoDoLinkedin(textoDoLinkedinNoPedido, formaNoLinkedin);
@@ -687,6 +751,11 @@ export default function Enviador({
         ev.preventDefault();
         void publicar();
       }}
+      onChange={(ev) => {
+        // O "QUANDO" DA PÁGINA, acompanhado pela mudança que sobe ao formulário: o botão diz "Agendar" (o 215).
+        const alvo: EventTarget = ev.target;
+        if (alvo instanceof HTMLInputElement && alvo.name === "quando") setAgendar(alvo.value === "depois");
+      }}
     >
       {/* AS REDES DO POST (a parte 2b: uma ou as duas). Só aparecem quando a página manda o LinkedIn da conta. Cada
           caixinha desligada diz o motivo: a conexão (sem LinkedIn, ou vencido), que veio do servidor, ou a forma. */}
@@ -758,6 +827,7 @@ export default function Enviador({
         {paraOLinkedin && formaDaTela === "imagem" && (
           <p className={hint}>No LinkedIn, a imagem segue as regras da imagem do Instagram: JPEG, na proporção escolhida.</p>
         )}
+        {carrosselNoLinkedin && <p className={hint}>{NOTA_DO_CARROSSEL_NO_LINKEDIN}</p>}
       </div>
 
       {enquadra && temArquivo && (
@@ -962,7 +1032,9 @@ export default function Enviador({
       <div className="flex flex-wrap items-center justify-between gap-3">
         {rodape}
         <button type="button" className={btnPrimary} disabled={ocupado} onClick={() => void publicar()}>
-          {ocupado ? "Enviando…" : "Publicar"}
+          {ocupado
+            ? "Enviando…"
+            : textoDoBotaoDePublicar({ comRedes: mostraARede, instagram: paraOInstagram, linkedin: paraOLinkedin, agendar })}
         </button>
       </div>
     </form>
```

- [ ] **Passo 4: rodar e ver passar**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-carrossel-pdf"; cd "$C" || exit 1
npx --no-install vitest run tests/redes-do-post.test.ts 2>&1 | tee ../el3a-f5-green-puros.log
npx --no-install vitest run --config vitest.dom.config.ts testes-dom/publicar-compositor-linkedin.dom.tsx testes-dom/publicar-compositor.dom.tsx 2>&1 | tee ../el3a-f5-green-tela.log
npx --no-install vitest run 2>&1 | tee ../el3a-f5-suite.log
npx --no-install vitest run --config vitest.dom.config.ts 2>&1 | tee ../el3a-f5-suite-tela.log
npx --no-install tsc --noEmit
npx --no-install eslint app/publicar/enviador.tsx app/publicar/navegador.ts lib/linkedin-publicacao.ts lib/redes-do-post.ts testes-dom/publicar-compositor-linkedin.dom.tsx testes-dom/publicar-compositor.dom.tsx tests/redes-do-post.test.ts
git diff --name-only 40b2aec -- lib/queue-drain.ts lib/fila-tipos.ts migrations scripts package.json package-lock.json   # vazio
```

Esperado: nos puros, "Test Files 1 passed (1)" e "Tests 28 passed (28)"; na tela, "Test Files 2 passed (2)" e "Tests 66 passed (66)"; a suíte pura inteira: "Test Files 160 passed (160)" e "Tests 3826 passed (3826)"; a suíte de tela inteira: "Test Files 36 passed (36)" e "Tests 347 passed (347)". O `tsc` e o lint sem saída, e a guarda vazia.

- [ ] **Passo 5: o commit**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-carrossel-pdf"; cd "$C" || exit 1
node ../varrer-texto.mjs app/publicar/enviador.tsx app/publicar/navegador.ts lib/linkedin-publicacao.ts lib/redes-do-post.ts testes-dom/publicar-compositor-linkedin.dom.tsx testes-dom/publicar-compositor.dom.tsx tests/redes-do-post.test.ts && test "$(git branch --show-current)" = linkedin-carrossel-pdf && git add app/publicar/enviador.tsx app/publicar/navegador.ts lib/linkedin-publicacao.ts lib/redes-do-post.ts testes-dom/publicar-compositor-linkedin.dom.tsx testes-dom/publicar-compositor.dom.tsx tests/redes-do-post.test.ts && git commit -m "A tela de compor leva o carrossel ao LinkedIn: o vídeo desliga a caixinha, a foto que o PDF não leva passa pelo canvas, as fotos juntas têm o teto de 15 MB, e o botão diz onde e quando o post sai"
git show HEAD | git patch-id --stable | cut -c1-12   # 86cc557adc71
```

O patch-id tem de começar por `86cc557adc71` (o mesmo do plano de 12/11). Se não começar, pare.

---

### FASE 6 — As telas de Publicações mostram o carrossel do LinkedIn

**Arquivos:** `lib/post-da-fila.ts`, `tests/post-da-fila.test.ts`.

A capa é o primeiro caminho da PRÓPRIA linha do LinkedIn. Nas duas redes, é a cópia da primeira foto, e não a original do Instagram, que o dreno dele apaga. Só no LinkedIn, é a foto que a tela subiu para essa linha. O calendário só lista as linhas `pending` e `sent`, e a que já saiu fica sem capa, com o símbolo, como a imagem e o Instagram de hoje.

- [ ] **Passo 1: os testes**

Em `tests/post-da-fila.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/post-da-fila.test.ts b/tests/post-da-fila.test.ts
index bd1f3e8..03ed5f0 100644
--- a/tests/post-da-fila.test.ts
+++ b/tests/post-da-fila.test.ts
@@ -18,11 +18,17 @@ import { MOTIVO_NAO_REGISTRADO, fraseSobreAMidia } from "@/lib/publicacao";
 const IG = { kind: "publicacao", payload: { forma: "imagem", caminhos: ["conta/ig.jpg"], legenda: "A legenda" } };
 const LI_TEXTO = { kind: "publicacao_linkedin", payload: { forma: "texto", caminhos: [], texto: "O texto do post" } };
 const LI_IMAGEM = { kind: "publicacao_linkedin", payload: { forma: "imagem", caminhos: ["conta/li.jpg"], texto: "Com foto" } };
+// O CARROSSEL DO LINKEDIN (a parte 3a): as fotos vão como PDF, e as telas mostram a primeira como capa.
+const LI_CARROSSEL = {
+  kind: "publicacao_linkedin",
+  payload: { forma: "carrossel", caminhos: ["conta/c1.jpg", "conta/c2.jpg"], texto: "O carrossel" },
+};
 
 describe("o nome do post do LinkedIn", () => {
   it("leva a rede na frente, como o convite do LinkedIn", () => {
     expect(rotuloDoPostNoLinkedin({ forma: "texto" })).toBe("LinkedIn · Só texto");
     expect(rotuloDoPostNoLinkedin({ forma: "imagem" })).toBe("LinkedIn · Imagem");
+    expect(rotuloDoPostNoLinkedin({ forma: "carrossel" })).toBe("LinkedIn · Carrossel (PDF)");
     expect(rotuloDoPostNoLinkedin(null)).toBe("LinkedIn · Forma não reconhecida");
   });
 });
@@ -47,6 +53,11 @@ describe("o quadrado do calendário", () => {
     expect(cartaoDoPost(LI_TEXTO, false)).toEqual({ rotulo: "LinkedIn · Só texto", capa: null, soVideo: false });
   });
 
+  it("o carrossel do LinkedIn: a capa é a primeira foto, enquanto não saiu (a parte 3a)", () => {
+    expect(cartaoDoPost(LI_CARROSSEL, false)).toEqual({ rotulo: "LinkedIn · Carrossel (PDF)", capa: "conta/c1.jpg", soVideo: false });
+    expect(cartaoDoPost(LI_CARROSSEL, true)).toEqual({ rotulo: "LinkedIn · Carrossel (PDF)", capa: null, soVideo: false });
+  });
+
   it("o payload torto do LinkedIn não vira o do Instagram", () => {
     expect(cartaoDoPost({ kind: "publicacao_linkedin", payload: { forma: "reels" } }, false).rotulo).toBe(
       "LinkedIn · Forma não reconhecida"
@@ -77,6 +88,7 @@ describe("os arquivos que o cancelar apaga", () => {
     expect(caminhosDoPostDaFila(IG.kind, IG.payload)).toEqual(["conta/ig.jpg"]);
     expect(caminhosDoPostDaFila(LI_IMAGEM.kind, LI_IMAGEM.payload)).toEqual(["conta/li.jpg"]);
     expect(caminhosDoPostDaFila(LI_TEXTO.kind, LI_TEXTO.payload)).toEqual([]);
+    expect(caminhosDoPostDaFila(LI_CARROSSEL.kind, LI_CARROSSEL.payload)).toEqual(["conta/c1.jpg", "conta/c2.jpg"]);
     expect(caminhosDoPostDaFila("publicacao_linkedin", { forma: "reels", caminhos: ["x"] })).toBeNull();
     expect(caminhosDoPostDaFila("publicacao", { forma: "nada" })).toBeNull();
   });
@@ -127,6 +139,17 @@ describe("a página de um post", () => {
     expect(p.sobreAMidia).toBe(fraseSobreAMidia(saiu, null));
     expect(p.ehVideo("conta/li.mp4")).toBe(false);
   });
+
+  it("o carrossel do LinkedIn tem todas as fotos e a frase sobre a mídia, e nunca é vídeo (a parte 3a)", () => {
+    const agendadoComErro = paginaDoPost({ ...LI_CARROSSEL, error: "o LinkedIn recusou" }, agendado);
+    expect(agendadoComErro.titulo).toBe("LinkedIn · Carrossel (PDF)");
+    expect(agendadoComErro.caminhos).toEqual(["conta/c1.jpg", "conta/c2.jpg"]);
+    expect(agendadoComErro.sobreAMidia).toBe(fraseSobreAMidia(agendado, "o LinkedIn recusou"));
+    expect(paginaDoPost({ ...LI_CARROSSEL, error: null }, saiu).sobreAMidia).toBe(fraseSobreAMidia(saiu, null));
+    expect(agendadoComErro.ehVideo("conta/c1.mp4")).toBe(false);
+    // O SÓ TEXTO CONTINUA SEM A FRASE: ele não tem mídia.
+    expect(paginaDoPost({ ...LI_TEXTO, error: null }, saiu).sobreAMidia).toBeNull();
+  });
 });
 
 describe("o aviso do cancelar e do remarcar", () => {
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-carrossel-pdf"; cd "$C" || exit 1
npx --no-install vitest run tests/post-da-fila.test.ts 2>&1 | tee ../el3a-f6-red-puros.log
```

Esperado: "Test Files 1 failed (1)" e "Tests 2 failed | 14 passed (16)": a capa e a frase sobre a mídia ainda são só da imagem.

- [ ] **Passo 3: o código**

Em `lib/post-da-fila.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/post-da-fila.ts b/lib/post-da-fila.ts
index 08b6f23..e8d81a6 100644
--- a/lib/post-da-fila.ts
+++ b/lib/post-da-fila.ts
@@ -34,7 +34,8 @@ export function cartaoDoPost(
 ): { rotulo: string; capa: string | null; soVideo: boolean } {
   if (ehPostDoLinkedin(item.kind)) {
     const li = lerPayloadDoLinkedin(item.payload);
-    return { rotulo: rotuloDoPostNoLinkedin(li), capa: !saiu && li?.forma === "imagem" ? li.caminhos[0] : null, soVideo: false };
+    // A CAPA É A IMAGEM, ou a primeira foto do carrossel (a parte 3a); o só texto não tem.
+    return { rotulo: rotuloDoPostNoLinkedin(li), capa: !saiu && li && li.forma !== "texto" ? li.caminhos[0] : null, soVideo: false };
   }
   // O INSTAGRAM, como a célula decidia antes (app/publicar/page.tsx): a capa é a primeira imagem, e o post só de
   // vídeo fica sem capa e desenha o ícone dele.
@@ -107,8 +108,8 @@ export function paginaDoPost(
       semTexto: "Sem texto.",
       caminhos: li?.caminhos ?? [],
       ehVideo: () => false,
-      // O SÓ TEXTO NÃO TEM MÍDIA, e a frase sobre a mídia apagada mentiria.
-      sobreAMidia: li?.forma === "imagem" ? fraseSobreAMidia(quando, item.error) : null,
+      // O SÓ TEXTO NÃO TEM MÍDIA, e a frase sobre a mídia apagada mentiria. A imagem e o carrossel (a parte 3a) têm.
+      sobreAMidia: li && li.forma !== "texto" ? fraseSobreAMidia(quando, item.error) : null,
       mediaIdNoInstagram: null,
       linkNoLinkedin: quando.saiu ? linkParaVerNoLinkedin(li?.postUrn) : null,
       notaDoCancelar: NOTA_DO_CANCELAR_NO_LINKEDIN,
```

- [ ] **Passo 4: rodar e ver passar**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-carrossel-pdf"; cd "$C" || exit 1
npx --no-install vitest run tests/post-da-fila.test.ts 2>&1 | tee ../el3a-f6-green-puros.log
npx --no-install vitest run 2>&1 | tee ../el3a-f6-suite.log
npx --no-install tsc --noEmit
npx --no-install eslint lib/post-da-fila.ts tests/post-da-fila.test.ts
git diff --name-only 40b2aec -- lib/queue-drain.ts lib/fila-tipos.ts migrations scripts package.json package-lock.json   # vazio
```

Esperado: "Test Files 1 passed (1)" e "Tests 16 passed (16)"; a suíte pura inteira: "Test Files 160 passed (160)" e "Tests 3828 passed (3828)". O `tsc` e o lint sem saída, e a guarda vazia.

- [ ] **Passo 5: o commit**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-carrossel-pdf"; cd "$C" || exit 1
node ../varrer-texto.mjs lib/post-da-fila.ts tests/post-da-fila.test.ts && test "$(git branch --show-current)" = linkedin-carrossel-pdf && git add lib/post-da-fila.ts tests/post-da-fila.test.ts && git commit -m "As telas de Publicações mostram o carrossel do LinkedIn com a capa da primeira foto e a frase sobre a mídia"
git show HEAD | git patch-id --stable | cut -c1-12   # 28741e26cedf
```

O patch-id tem de começar por `28741e26cedf` (o mesmo do plano de 12/11). Se não começar, pare.

---

### FASE 7 — A verificação inteira, as mutações e a guarda do diff

- [ ] **Passo 1: o verify**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-carrossel-pdf"; cd "$C" || exit 1
env -u CLAUDECODE -u AI_AGENT npm run verify 2>&1 | tee ../el3a-verify.log; echo "saída ${PIPESTATUS[0]}"; git diff --stat AGENTS.md
```

Esperado: saída 0; 160 arquivos e 3 828 casos puros; 36 e 347 de tela; "SEM VAZAMENTO em A nem em C, nas duas varreduras."; "MIGRAÇÃO PULADA — este não é um deploy de produção."; o build do Next 16.4.3 ("Compiled successfully"); e o `git diff --stat AGENTS.md` vazio. Se cair o 218 ou o 227, siga o procedimento das restrições.

- [ ] **Passo 2: a integração inteira, uma rodada só**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-carrossel-pdf"; cd "$C" || exit 1
docker ps --format '{{.Names}} {{.Status}}' | grep metodochat-banco-de-teste   # healthy; senão, docker start e espere healthy
DATABASE_URL_TESTES=postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes npm run test:integracao 2>&1 | tee ../el3a-integracao.log
```

Esperado: `ALVO: banco de TESTE`; "nenhum schema teste_tmp_* no banco" antes e depois; "Test Files 79 passed (79)" e "Tests 982 passed | 8 skipped (990)" (na base, 78 arquivos, 954 e 8).

- [ ] **Passo 3: o roteiro das mutações, gravado a partir do Apêndice A, fora da cópia**

O roteiro é o último bloco deste plano. O comando abaixo o tira do plano commitado e o grava em `../mutar-li3a-v2.mjs`. Se o arquivo já existir ali, ele só compara e para se for diferente.

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-carrossel-pdf"; cd "$C" || exit 1
node -e '
const fs = require("fs");
const plano = fs.readFileSync("docs/plans/2026-11-13-linkedin-carrossel-pdf.md", "utf8").replace(/\r\n/g, "\n");
const cerca = String.fromCharCode(96).repeat(3);
const inicio = plano.lastIndexOf(cerca + "js\n") + cerca.length + 3;
const bloco = plano.slice(inicio, plano.indexOf("\n" + cerca, inicio) + 1);
const destino = "../mutar-li3a-v2.mjs";
if (fs.existsSync(destino)) {
  const igual = fs.readFileSync(destino, "utf8") === bloco;
  console.log(igual ? "o roteiro de fora é igual ao Apêndice A" : "DIFERENTE do Apêndice A: pare");
  process.exit(igual ? 0 : 1);
}
fs.writeFileSync(destino, bloco);
console.log("gravado a partir do Apêndice A");
'
sha256sum ../mutar-li3a-v2.mjs   # 1c062fbe22b72d620482b3da46b8e29ccd79a1979567898f60eb15ebd55c2300
```

- [ ] **Passo 4: as mutações (Apêndice A)**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-carrossel-pdf"; cd "$C" || exit 1
docker ps --format '{{.Names}} {{.Status}}' | grep metodochat-banco-de-teste   # healthy; senão, docker start e espere healthy
node ../mutar-li3a-v2.mjs --conferir 2>&1 | tee ../el3a-mutar-conferir.log    # "33 mutações, 0 ruins; árvore no fim: limpa (só a conferência dos trechos)"
node ../mutar-li3a-v2.mjs 2>&1 | tee ../el3a-mutar.log
```

Esperado: as 33 como "MORTA", e "33 mutações, 0 ruins; árvore no fim: limpa". A F3-9 cai na guarda da hora de parar, a F4bis-M2 no caso das cópias instantâneas e a F4bis-M3 no caso em que o "agora" do LinkedIn lança. Se a rodada parar antes da última linha, rode `git status` e `git diff` antes de qualquer outra coisa: o arquivo da mutação em curso pode ter ficado mutado, e só ele se restaura.

- [ ] **Passo 5: a guarda do diff**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-carrossel-pdf"; cd "$C" || exit 1
git diff --stat 40b2aec HEAD -- . ':!docs'
git diff --name-only 40b2aec HEAD -- lib/queue-drain.ts lib/fila-tipos.ts migrations scripts package.json package-lock.json   # vazio
git diff --name-only 40b2aec HEAD -- docs                                                                                   # só este plano
```

Esperado: no primeiro, os 29 arquivos do mapa, e mais nenhum: "29 files changed, 2140 insertions(+), 151 deletions(-)". O segundo, vazio: o `lib/queue-drain.ts` e o `lib/fila-tipos.ts` não mudam. No terceiro, só este plano. O patch-id de cada fase (`git show <commit> | git patch-id --stable`) tem de bater com o do ensaio: `48d90a10bbfa`, `c072013ab462`, `79de982da6e9`, `9ee1c9da8cad`, `2ea7ea0eec88`, `7eaad643609a`, `86cc557adc71` e `28741e26cedf`.

---

### FASE 8 — O push, a prova no preview, o PR, o deploy e a primeira hora

Esta entrega publica de verdade nas duas redes. A prova é no preview, que usa o banco de produção.

**A linha do carrossel no preview é uma linha da produção**, porque o banco é o mesmo. O código no ar (a `40b2aec`, com a 3-0 e a 3a-0) não conhece a forma `"carrossel"`: o predicado da 3-0 deixa essa linha `pending` e intocada em todos os drenos da produção (o tique, o webhook, o cron e os cliques), sem tique. Nada da produção drena essa linha até o merge desta entrega. No preview, quem a drena é o "agora" do LinkedIn e o "Remarcar" do próprio preview (o 216). O preview não tem QStash.

**Por isso nenhuma linha da prova chega ao merge `pending` nem em `sending` (o achado 228).** Com o merge, a produção passa a conhecer o carrossel e publicaria sozinha uma linha que tivesse ficado na fila (adiada, esperando a mídia ou com um erro passageiro), com as fotos que ficaram no bucket, talvez depois de os posts da prova terem sido apagados. A linha pendente se cancela pelo PREVIEW (o cancelar da produção não apaga as fotos do carrossel). Uma linha em `sending` o preview não tira, porque os botões da página do post só aparecem com `pending` (`app/publicar/post/[id]/page.tsx:106`): ela para a prova e vai à caixa.

- [ ] **Passo 1: a conferência antes do push.** Repetida, igual, antes do PR (Passo 6) e antes da caixa do merge (Passo 7).

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-carrossel-pdf"; cd "$C" || exit 1
git fetch origin
test "$(git rev-parse --short origin/main)" = 40b2aec && echo "origin/main em 40b2aec"
test "$(git branch --show-current)" = linkedin-carrossel-pdf && echo "na branch certa"
git log --oneline 40b2aec..HEAD                            # 9 commits: o plano e as FASES 1 a 6, com a 3-bis e a 4-bis
git log --format='%an <%ae>' 40b2aec..HEAD | sort -u       # só Eduardo Kobal <162614913+Eduardokobal@users.noreply.github.com>
git log --format=%B 40b2aec..HEAD | grep -ci "co-authored" # 0
git status --porcelain                                     # vazio
```

Se qualquer linha divergir, pare.

- [ ] **Passo 2: o push da branch, com o OK do Eduardo pela caixa e a hora à auditoria**

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-carrossel-pdf"; cd "$C" || exit 1
test -z "$(git ls-remote origin refs/heads/linkedin-carrossel-pdf)" || { echo "a branch já existe no remoto: pare"; exit 1; }
test "$(git branch --show-current)" = linkedin-carrossel-pdf && git push -u origin refs/heads/linkedin-carrossel-pdf:refs/heads/linkedin-carrossel-pdf
```

No log do build do preview, lido em janelas com `since`/`until`, confira:
- o commit;
- nenhum aviso do Node 26;
- "Detected Next.js version: 16.4.3";
- "MIGRAÇÃO PULADA".

- [ ] **Passo 3: as regras da prova, e o roteiro lido pela auditoria antes de qualquer passo.**
  - **Uma caixa para a prova inteira** antes do 1º passo, e o "pode" da auditoria, com a hora, em cada passo que grava.
  - **Quem clica é o Eduardo**, logado como administrador no preview, na conta do Instagram e no LinkedIn pessoal conectados que as provas da 2a e da 2b usaram.
  - **Só "agora".** O "Agendar" é proibido na prova: uma linha agendada ficaria `pending` e intocada até o merge.
  - **Nenhum outro preview** é aberto ou clicado durante a prova: os previews antigos não têm o predicado da forma (ver os limites).
  - **O "Remarcar"**, na página do post no preview, vai com a hora do minuto corrente: ele passa por cima da espera da linha e drena na hora.
  - **Depois de um "processando"** (o LinkedIn ainda processa o documento), espere os 60 s antes de Remarcar: o Remarcar passa por cima da espera e gasta uma das 5 consultas da mídia.
  - **O clique "agora" só no LinkedIn pode levar ~50 s**: a passada do documento pede 52 s.
  - **As leituras da prova são só da auditoria, só lendo:** antes da prova, logo depois de cada clique e de cada Remarcar, e no fim. De cada linha da prova: o `kind`, o `status`, o `attempts`, o `error`, a forma, os `adiamentos`, as `consultas_da_midia`, se há ou não `documento_urn`, `post_urn` e `post_tentado_em`, e as horas (`created_at`, `claimed_at`, `not_before` e `sent_at`). Nenhum texto do post, nenhum caminho e nenhum token.
  - **A vazão** é lida logo depois do clique ou do Remarcar que fez a passada do documento: o `sent_at − claimed_at` mede só a última passada.

- [ ] **Passo 4: os passos da prova.**
  1. **O carrossel só no LinkedIn, "agora", com 3 fotos.**
     - A tela mostra a nota do PDF e o botão "Publicar no LinkedIn".
     - O aviso esperado: "Post publicado no LinkedIn." Ou, se o documento ainda processa ou se a passada não coube no clique: "O post do LinkedIn está na fila e vai sair em instantes. Acompanhe em Publicações."
     - Na base, o esperado é `sent`, com `documento_urn` e `post_urn`. Ou `pending`, com 1 em `consultas_da_midia` (processando) ou 1 em `adiamentos` (sem tempo); nesse caso, o Remarcar a drena, como nas regras.
     - **Este passo mede o domínio do endereço de envio.** Se ele não for https de um domínio do LinkedIn, o envio recusa com o status 0, que é passageiro (`lib/linkedin.ts:290-292` e `lib/linkedin-publicacao.ts:392`): a linha volta `pending` e tenta de novo em 120 s, e o aviso diz "vai sair em instantes". A prova não para sozinha. Por isso a auditoria lê o `error` da linha logo depois deste passo. Se for "o endereço de envio do documento não é do LinkedIn", a linha é cancelada pelo preview antes da volta, e a prova para.
  2. **O carrossel nas duas redes, "agora", com 3 fotos.**
     - O aviso esperado: "Instagram: …" com o aviso do Instagram de hoje, e "LinkedIn: O post do LinkedIn está na fila e vai sair em instantes. Acompanhe em Publicações."
     - Na base: a linha do LinkedIn `pending`, com 1 em `adiamentos` (a reserva do 222) e sem `documento_urn`. A do Instagram sai no clique, ou fica `pending` e vencida, aguardando a Meta processar o contêiner. Nesse caso, depois de 60 s, ela sai pelo Remarcar da linha do Instagram no minuto corrente, no preview, com o "pode" da auditoria: o Remarcar do Instagram chama o dreno do clique, que pega o Instagram (`app/publicar/post/actions.ts:332`). Sem isso, ela só sairia com um webhook ou com o cron das 09:00 UTC (`vercel.json`), porque o preview não tem QStash (o 216).
     - O Remarcar do LinkedIn não espera os 20 s: ele drena na hora.
  3. **Um carrossel perto dos 15 MB, nas duas redes.** É a medida da vazão.
     - As fotos vão cruas, sem passar pelo canvas: JPEG comum (baseline, 8 bits, em cor), com a orientação 1 (sem rotação no EXIF), já na medida que a tela aceita sem redimensionar, com até 8 MB cada (o teto da imagem, `lib/publicacao.ts:36`), somando perto de 15 MB.
     - Se as fotos não couberem assim, a decisão vai à caixa.
  4. **Antes de apagar**, o Eduardo abre cada post no LinkedIn (o título, as páginas na ordem e se o documento abre) e as Publicações do preview.
  5. **A leitura final da auditoria:**
     - nenhuma linha da prova `pending` nem `sending`; cada uma `sent`, ou `failed` com o motivo;
     - o bucket: os arquivos das linhas `sent` saíram, e os das `failed` ficaram (o arquivo só sai do bucket com o `sent`). A decisão sobre eles vai à caixa.
  6. **O Eduardo apaga os posts da prova**, pelo LinkedIn e pelo Instagram.

**Se divergir, por caso.** Em todos eles, a prova para, e a auditoria lê a linha antes de qualquer outro clique.

| O que acontece | A linha | O que fazer com a linha | O bucket | A caixa |
|---|---|---|---|---|
| O endereço de envio não é do LinkedIn | `pending`, com o `error` do domínio, volta em 120 s | cancelar pelo preview, antes da volta | o cancelar do preview apaga as fotos da linha | seguir ou parar a entrega |
| O PDF recusado (o `PUT` com 4xx) | `failed`, com o motivo do LinkedIn | nada: `failed` não volta | as fotos ficam | o que fazer com as fotos, e se a prova segue |
| O título recusado (o `POST` com 400) | `failed`, com o motivo | nada | as fotos ficam | o que fazer com as fotos, e se a prova segue |
| Outra resposta no processamento do documento | `failed` com o motivo, ou `pending` se for passageira | se `pending`, cancelar pelo preview | o cancelar apaga as fotos; no `failed`, elas ficam | se a prova segue |
| O `PUT` de ~15 MB passa do teto de 25 s | `pending` (passageiro), volta em 120 s | cancelar pelo preview depois da primeira vez | o cancelar apaga as fotos | baixar o tamanho ou parar |
| O Instagram fica aguardando a Meta | a linha do Instagram `pending`, vencida | depois de 60 s, o Remarcar da linha do Instagram no minuto corrente, no preview, com o "pode" da auditoria: o Remarcar do Instagram chama o dreno do clique, que pega o Instagram | — | só se o Remarcar não a publicar |
| "Pode ter saído" (`post_tentado_em` sem `post_urn`) | `failed`, com o motivo do "pode ter saído" | o Eduardo confere no LinkedIn se o post saiu | as fotos ficam | apagar o post, se saiu, e as fotos |
| O Instagram publicado e o LinkedIn falho | Instagram `sent`; LinkedIn `failed` | — | as fotos do LinkedIn ficam | apagar o post do Instagram ou deixar |
| Qualquer linha da prova em `sending` | `sending` | o preview não a tira, e nenhum dreno da produção a resgata | — | o que fazer antes do merge |

- [ ] **Passo 5: a base depois da prova**, lida pela auditoria: igual à de antes, fora as linhas da prova, e nenhuma delas `pending` nem `sending`.

- [ ] **Passo 6: o PR, com o OK do Eduardo pela caixa.**
  - Antes, a auditoria confere de novo que nenhuma linha da prova está `pending` nem `sending`.
  - O corpo leva o que muda, os números deste plano, o que o ensaio achou, a prova e os limites conhecidos, sem nenhuma arroba solta nem nome de pessoa ou de conta. Ele fica em `../corpo-pr-3a.md`, e a mensagem do merge, à parte, em `../merge-3a.txt`. A auditoria lê os dois antes de o PR abrir.
  - Depois da conferência do Passo 1, de novo:

```bash
C="$HOME/AppData/Local/Temp/claude/a758ee03f2997007/187b4ee0-3486-466c-8385-44b5b3c0837d/scratchpad/linkedin-carrossel-pdf"; cd "$C" || exit 1
gh pr create --base main --head linkedin-carrossel-pdf --title "O carrossel sai também no LinkedIn, como PDF, só lá ou nas duas redes, e o botão diz onde e quando o post sai" --body-file ../corpo-pr-3a.md
```

  - **A caixa do PR diz que o merge espera a conferência da auditoria e uma caixa minha.**

- [ ] **Passo 7: a leitura de antes do merge e a caixa do merge.**
  - A auditoria lê a base na hora antes do merge, só lendo, e confere de novo que nenhuma linha da prova está `pending` nem `sending`. Essa leitura é a base de comparação da primeira hora.
  - Depois da conferência do Passo 1, de novo, vem a caixa do merge. O merge é do Eduardo. A caixa é de resultado: sem "(Recomendado)" e com "Não fiz / não lembro".

- [ ] **Passo 8: o deploy do merge.**
  - No log, lido em janelas com `since`/`until`, quatro coisas:
    - "Nada a aplicar: as 26 migrações já constam no registro.";
    - o `queue_kind_check` "existe e confere (025-fila-linkedin.sql)";
    - as outras conferências "CONFERIDO";
    - nenhum aviso do Node 26.
  - No site: o `/entrar` dá 200, e o cron sem senha dá 401.

- [ ] **Passo 9: a primeira hora.** A janela vai do deploy pronto até uma hora depois. Nada aqui grava.
  - **Os erros e os registros da Vercel**, lidos pelo DEV e pela auditoria com o conector da Vercel, em pedaços, porque o Hobby só guarda uma hora:
    - `get_runtime_errors`: nenhum erro novo, e nenhuma função cortada por tempo nas rotas que drenam (`/api/queue/tick`, `/api/webhook` e `/api/cron/daily`) nem nas páginas das actions;
    - `get_runtime_logs` com o texto `[dreno]`: cada linha tem hora, contagem e tipos. Ela é a regra da 3a-0 agindo, e não um defeito.
  - **A base, só pela auditoria, só lendo**, com as cinco consultas da 3a-0, sobre `kind`, `status`, `attempts` e as horas, nunca `payload`, `contact_ig_id`, `error` nem texto: as presas em `sending`, as vencidas que não saíram, as tentativas, o volume e a espera por tipo, e os posts, contra a leitura de antes do merge. Ela confere também que nenhuma linha `publicacao_linkedin` ficou presa em `sending`. (A leitura da forma é só da prova, e não da primeira hora.)
  - **Quando divergir, pare.** São quatro casos:
    - uma linha presa em `sending` há mais de 3 minutos;
    - queda no volume ou espera maior que a das janelas de comparação;
    - um erro novo;
    - uma linha "[dreno]" cujos itens não saíram na passada seguinte.
    Em qualquer um deles, avise a auditoria com a leitura. O caminho de volta é o rollback da Vercel para o deploy da `40b2aec`: sem migração nesta entrega, ele é seguro, e só é feito com a caixa do Eduardo. Uma linha de carrossel `pending` volta a ficar intocada com o rollback, e uma em `sending` fica presa (ver os limites).

Com esta entrega em produção, a parte 3b (o vídeo) começa pelo plano dela.

---

## Apêndice A — As mutações

O roteiro roda da raiz da cópia, com a árvore commitada e limpa, e com o `node_modules` da cópia. Cada mutação troca um trecho que aparece uma vez só, roda o arquivo de teste que a cobre e confere que o caso nomeado cai, pelo nome inteiro. As de integração rodam contra o banco de TESTE, uma de cada vez. No fim, a árvore volta limpa. São 33: as das FASES 1 a 6, com as do 219, do 220, do 221 e do 222, e as três novas sobre a 3a-0 (a F3-9, a F4bis-M2 refeita e a F4bis-M3). A FASE 7, no Passo 3, grava este bloco em `../mutar-li3a-v2.mjs`.

```js
// AS MUTAÇÕES DA 3a DO LINKEDIN (o carrossel em PDF), REFEITA SOBRE A 3a-0 (a main 40b2aec), no molde de
// mutar-li30.mjs: as de todas as fases do ensaio, a F1 (as regras puras e o PDF), a F2 (o cliente do documento), a F3 e
// a F3-bis (a fila; 219, 220 e 221; e a linha devolvida pela hora de parar sem adiamento), a F4 (as actions), a F4-bis
// (222, com o dreno do clique da 3a-0), a F5 (a tela) e a F6 (as telas de Publicações). Cada uma desfaz UMA trava,
// trocando um trecho exato de um arquivo (que tem de aparecer uma vez só), roda só o arquivo de teste que a cobre e
// confere que o caso NOMEADO cai, pelo nome inteiro. As de integração rodam contra o banco de TESTE, uma de cada vez.
// A árvore tem de estar commitada e limpa antes, e volta limpa no fim. O vitest roda por `npx --no-install` (achado
// 208), e a cópia tem de ter o node_modules dela.
//
// Uso, da raiz da cópia: node ../mutar-li3a-v2.mjs [prefixo-do-nome]
//                        node ../mutar-li3a-v2.mjs --conferir   (só confere que cada trecho aparece uma vez)
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const TESTES_URL = "postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes";
if (process.env.DATABASE_URL) throw new Error("RECUSADO: DATABASE_URL no ambiente");
if (!existsSync("node_modules/.bin/vitest")) throw new Error("RECUSADO: sem node_modules/.bin/vitest nesta cópia");
const status = () => execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim();
if (status() !== "") throw new Error("RECUSADO: árvore suja antes das mutações");

const PURO = { config: null };
const DOM = { config: "vitest.dom.config.ts" };
const INTEG = { config: "vitest.integracao.config.ts" };

const T_REGRAS = { ...PURO, arquivo: "tests/linkedin-carrossel-regras.test.ts" };
const T_REST = { ...PURO, arquivo: "tests/linkedin-rest.test.ts" };
const T_POST = { ...PURO, arquivo: "tests/linkedin-post.test.ts" };
const T_COMPOR = { ...PURO, arquivo: "tests/linkedin-compor.test.ts" };
const T_COPIA = { ...PURO, arquivo: "tests/linkedin-copia.test.ts" };
const T_REDES = { ...PURO, arquivo: "tests/redes-do-post.test.ts" };
const T_PFILA = { ...PURO, arquivo: "tests/post-da-fila.test.ts" };
const T_TELA = { ...DOM, arquivo: "testes-dom/publicar-compositor-linkedin.dom.tsx" };
const T_CARR = { ...INTEG, arquivo: "testes-integracao/linkedin-carrossel.integracao.ts" };
const T_PUBI = { ...INTEG, arquivo: "testes-integracao/linkedin-publicacao.integracao.ts" };
const T_DUAS = { ...INTEG, arquivo: "testes-integracao/linkedin-duas-redes.integracao.ts" };
const T_HORA = { ...INTEG, arquivo: "testes-integracao/dreno-hora-de-parar.integracao.ts" };

const PDF = "lib/pdf-de-fotos.ts";
const PUB = "lib/linkedin-publicacao.ts";
const REDES = "lib/redes-do-post.ts";
const LI = "lib/linkedin.ts";
const FILA = "lib/linkedin-fila.ts";
const COPIA = "lib/linkedin-copia.ts";
const ACOES = "app/publicar/actions.ts";
const TELA = "app/publicar/enviador.tsx";
const PFILA = "lib/post-da-fila.ts";
const DRENO = "lib/queue-drain.ts";

const MUTACOES = [
  // ---- F1: as regras puras e o PDF (F3-bis: o marcador, 220) ----
  {
    nome: "F1-1: o PDF aceita o JPEG que não vai cru",
    arq: PDF,
    de: "    if (!c || !vaiCruParaOLinkedin(c)) {",
    para: "    if (!c) {",
    teste: T_REGRAS,
    cai: "recusa, com o número da foto, o CMYK, o de 12 bits e o que não é JPEG; e recusa a lista vazia",
  },
  {
    nome: "F1-2: o título do documento não é cortado",
    arq: PUB,
    de: "  if (letras.length <= TITULO_DO_DOCUMENTO_MAX) return linha;",
    para: "  return linha;",
    teste: T_REGRAS,
    cai: "o texto longo é cortado no fim de uma palavra, com reticências, em até 100 caracteres",
  },
  {
    nome: "F1-3: o vídeo no carrossel passa",
    arq: PUB,
    de: '  if (itens.some((i) => i.video)) return "video";',
    para: "",
    teste: T_REGRAS,
    cai: "um vídeo no carrossel não vai ao LinkedIn; o total acima do teto também não; o resto passa",
  },
  {
    nome: "F1-4 (220): o JPEG cru sem conferir o processo",
    arq: PUB,
    de: "MARCADORES_DA_DCT.has(c.marcador)",
    para: "c.marcador > 0",
    teste: T_REGRAS,
    cai: "só o baseline, o estendido e o progressivo (C0, C1 e C2), de 8 bits; o sem perda e o aritmético passam pelo canvas",
  },
  {
    nome: "F1-5: o botão não segue o Quando",
    arq: REDES,
    de: '  const verbo = p.agendar ? "Agendar" : "Publicar";',
    para: '  const verbo = "Publicar";',
    teste: T_REGRAS,
    cai: "com as caixinhas na tela, o botão diz as redes marcadas, e o verbo segue o Quando",
  },

  // ---- F2: o cliente do documento ----
  {
    nome: "F2-1: o envio do documento sem a regra do domínio",
    arq: LI,
    de: '  if (!enderecoDeEnvioConfiavel(uploadUrl)) {\n    throw new LinkedinError(0, "o endereço de envio do documento não é do LinkedIn");\n  }',
    para: "",
    teste: T_REST,
    cai: "o envio para um endereço que não é do LinkedIn não sai, e a autorização não vai",
  },
  {
    nome: "F2-2: o documento sem o título",
    arq: PUB,
    de: "{ id: p.documento.urn, title: p.documento.titulo }",
    para: "{ id: p.documento.urn }",
    teste: T_POST,
    cai: "o conteúdo leva o documento e o título",
  },
  {
    nome: "F2-3: o envio do documento com o teto do post",
    arq: LI,
    de: "body: bytes }, TETO_DO_ENVIO_DO_DOCUMENTO_MS);",
    para: "body: bytes }, TETO_DO_LINKEDIN_MS);",
    teste: T_REST,
    cai: "o envio é um PUT com a autorização e os bytes do PDF, com o teto de 25 s",
  },

  // ---- F3 e F3-bis: a fila (219 e 221) ----
  {
    nome: "F3-1: as fotos acima de 15 MB passam no dreno",
    arq: FILA,
    de: "soma + f.length, 0) > TETO_DO_CARROSSEL_NO_LINKEDIN_BYTES) {",
    para: "soma + f.length, 0) > Infinity) {",
    teste: T_CARR,
    cai: "as fotos que passam de 15 MB juntas encerram a linha antes de qualquer chamada ao LinkedIn",
  },
  {
    nome: "F3-2: a espera da mídia gasta a tentativa",
    arq: FILA,
    de: "attempts = greatest(attempts - 1, 0),\n            not_before = now() + make_interval(secs => $2::int), error = $3,\n            payload = (payload - 'post_tentado_em')",
    para: "attempts = attempts,\n            not_before = now() + make_interval(secs => $2::int), error = $3,\n            payload = (payload - 'post_tentado_em')",
    teste: T_CARR,
    cai: "o documento que o LinkedIn ainda processa: a marca sai, a linha volta em um minuto sem gastar tentativa, e a consulta conta",
  },
  {
    nome: "F3-3: a mídia espera sem teto de consultas",
    arq: FILA,
    de: "      if (pub.consultasDaMidia >= CONSULTAS_DA_MIDIA_MAX) {",
    para: "      if (pub.consultasDaMidia >= Infinity) {",
    teste: T_CARR,
    cai: "na sexta consulta, a linha vai a failed com o motivo",
  },
  {
    nome: "F3-4: os adiamentos sem teto",
    arq: FILA,
    de: "  if (pub.adiamentos >= ADIAMENTOS_MAX) {",
    para: "  if (pub.adiamentos >= Infinity) {",
    teste: T_CARR,
    cai: "o sétimo adiamento encerra a linha, sem chamar o LinkedIn",
  },
  {
    nome: "F3-5 (219): o motivo do sétimo adiamento fala em fotos para toda forma",
    arq: FILA,
    de: '    const motivo = pub.forma === "carrossel" ? MOTIVO_SEM_TEMPO_DEMAIS_NO_CARROSSEL : MOTIVO_SEM_TEMPO_DEMAIS;',
    para: "    const motivo = MOTIVO_SEM_TEMPO_DEMAIS_NO_CARROSSEL;",
    teste: T_PUBI,
    cai: "só texto, no sétimo adiamento: não chama o LinkedIn, e a linha vai a failed com o motivo sem falar em fotos",
  },
  {
    nome: "F3-6 (221): a mídia não pronta decidida no texto cortado",
    arq: LI,
    de: "aMidiaAindaNaoEstaPronta(r.status, r.texto));",
    para: "aMidiaAindaNaoEstaPronta(r.status, r.texto.slice(0, 300)));",
    teste: T_REST,
    cai: "o código depois dos 300 primeiros caracteres ainda conta, e o erro diz que a mídia não está pronta",
  },
  {
    nome: "F3-7: o documento enviado não fica marcado",
    arq: FILA,
    de: "    await deps.guardarNoPayload(item.id, { documento_urn: documentoUrn });",
    para: "",
    teste: T_CARR,
    cai: "agora: as fotos baixadas, o PDF com as duas, o envio com a autorização, o post com o documento e o título, e as fotos fora do bucket",
  },
  {
    nome: "F3-8: a mídia não pronta vira erro de post",
    arq: FILA,
    de: '    if (pub.forma === "carrossel" && err.midiaNaoPronta) {',
    para: "    if (false) {",
    teste: T_CARR,
    cai: "o documento que o LinkedIn ainda processa: a marca sai, a linha volta em um minuto sem gastar tentativa, e a consulta conta",
  },
  {
    nome: "F3-9: a devolução da hora de parar contando um adiamento",
    arq: DRENO,
    de: "      `update queue set status = 'pending', attempts = greatest(attempts - 1, 0), not_before = now()",
    para: "      `update queue set status = 'pending', attempts = greatest(attempts - 1, 0), not_before = now(), payload = payload || '{\"adiamentos\":1}'::jsonb",
    teste: T_HORA,
    cai: "a linha do carrossel do LinkedIn devolvida pela hora de parar não ganha adiamento, e volta com a tentativa de antes",
  },

  // ---- F4: as actions ----
  {
    nome: "F4-1: as cópias sem esperar todas (Promise.all)",
    arq: COPIA,
    de: "const feitas = await Promise.allSettled(origens.map((origem) => copiarImagemParaOLinkedin(origem, conta)));",
    para: 'const feitas = (await Promise.all(origens.map((origem) => copiarImagemParaOLinkedin(origem, conta)))).map((value) => ({ status: "fulfilled", value }));',
    teste: T_COPIA,
    cai: "uma cópia que falha: as outras terminam, as que subiram são apagadas, e o erro é o da que falhou",
  },
  {
    nome: "F4-2: a chave do LinkedIn pelas cópias",
    arq: ACOES,
    de: "          { caminhosDaChave: caminhos }",
    para: "          {}",
    teste: T_DUAS,
    cai: "agendado: o LinkedIn leva uma cópia de cada foto, na ordem, e a chave é a das originais",
  },
  {
    nome: "F4-3: o carrossel com vídeo vai ao LinkedIn",
    arq: PUB,
    de: '  if (p.forma === "carrossel" && p.caminhos.some((c) => pareceVideo(c))) return "carrossel_com_video";',
    para: "",
    teste: T_COMPOR,
    cai: "o carrossel com vídeo não vai ao LinkedIn, com a frase da tela",
  },
  {
    nome: "F4-4: as cópias ficam quando o Instagram é recusado",
    arq: ACOES,
    de: "      if (desfeita && copias.length) await apagarAsCopiasSemDerrubar(copias);",
    para: "",
    teste: T_DUAS,
    cai: "o Instagram que o banco recusa, com o carrossel do LinkedIn pendente: o LinkedIn é desfeito, e as três cópias saem",
  },
  {
    nome: "F4-5: as duas redes só na imagem",
    arq: ACOES,
    de: "  if (!forma || !formaNoLinkedin) {",
    para: '  if (!forma || formaNoLinkedin !== "imagem") {',
    teste: T_DUAS,
    cai: "agendado: o LinkedIn leva uma cópia de cada foto, na ordem, e a chave é a das originais",
  },

  // ---- F4-bis: o 222 ----
  {
    nome: "F4bis-M1: sem a reserva do Instagram",
    arq: FILA,
    de: '  return forma === "carrossel" ? inicioDaFuncaoMs - RESERVA_DO_INSTAGRAM_NO_CARROSSEL_MS : inicioDaFuncaoMs;',
    para: "  return inicioDaFuncaoMs;",
    teste: T_DUAS,
    cai: "com as cópias instantâneas: o LinkedIn não chama nada no clique, a linha volta adiada antes do dreno do Instagram, e o Instagram sai",
  },
  {
    nome: "F4bis-M2: o agora do LinkedIn nas duas redes sem a reserva",
    arq: ACOES,
    de: "      desfecho = await drenarUmaPublicacaoDoLinkedin(linkedin.id, inicioDoLinkedin);",
    para: "      desfecho = await drenarUmaPublicacaoDoLinkedin(linkedin.id, inicioDaFuncaoMs);",
    teste: T_DUAS,
    cai: "com as cópias instantâneas: o LinkedIn não chama nada no clique, a linha volta adiada antes do dreno do Instagram, e o Instagram sai",
  },
  {
    nome: "F4bis-M3: o dreno do Instagram nas duas redes pegando o LinkedIn (sem o doClique da 3a-0)",
    arq: ACOES,
    de: "  if (instagram.entrou && instagram.jaVale) {\n    try {\n      await drainQueue({ inicioDaFuncaoMs, doClique: true });",
    para: "  if (instagram.entrou && instagram.jaVale) {\n    try {\n      await drainQueue({ inicioDaFuncaoMs });",
    teste: T_DUAS,
    cai: "o agora do LinkedIn que lança antes de adiar: o dreno do Instagram, de clique, não pega a linha do LinkedIn, que fica vencida e sem adiamento para os drenos das rotas",
  },

  // ---- F5: a tela ----
  {
    nome: "F5-1: a chave do caminho guardado sem o LinkedIn",
    arq: TELA,
    de: '|${carrosselNoLinkedin ? "pdf" : "ig"}`;',
    para: "`;",
    teste: T_TELA,
    cai: "a foto que subiu crua só para o Instagram sobe de novo pelo canvas quando o LinkedIn é marcado depois",
  },
  {
    nome: "F5-2: o JPEG cru sem conferir o cabeçalho",
    arq: TELA,
    de: "        if (cru && carrosselNoLinkedin) {",
    para: "        if (false) {",
    teste: T_TELA,
    cai: "com o LinkedIn marcado, o JPEG que o PDF não leva como está (CMYK) passa pelo canvas, e o de cor de tela vai cru",
  },
  {
    nome: "F5-3: o teto das fotos juntas sempre cabe",
    arq: TELA,
    de: "    const cabe = (bytes: number) => teto === null || total + bytes <= teto;",
    para: "    const cabe = (_bytes: number) => true;",
    teste: T_TELA,
    cai: "o total passa de 15 MB com o LinkedIn: a foto que passaria do teto não sobe, a lista diz por quê, e nada é publicado",
  },
  {
    nome: "F5-4: o vídeo não desmarca o LinkedIn",
    arq: TELA,
    de: "      setMarcadas((atuais) => ({ ...atuais, linkedin: false }));",
    para: "",
    teste: T_TELA,
    cai: "um vídeo no carrossel desliga e desmarca o LinkedIn, com o motivo do PDF, e tirar o vídeo não o remarca",
  },
  {
    nome: "F5-5: o vídeo não desliga a caixinha",
    arq: REDES,
    de: '(p.forma === "carrossel" && p.comVideo ? textoDoProblemaDoCarrosselNoLinkedin("video") : null))',
    para: "null)",
    teste: T_REDES,
    cai: "o carrossel com vídeo desliga o LinkedIn, com o motivo do PDF; sem vídeo, ele fica ligado",
  },
  {
    nome: "F5-6: o botão não acompanha o Quando",
    arq: TELA,
    de: "linkedin: paraOLinkedin, agendar })}",
    para: "linkedin: paraOLinkedin, agendar: false })}",
    teste: T_TELA,
    cai: "diz as redes marcadas, e Agendar com a outra hora",
  },

  // ---- F6: as telas de Publicações ----
  {
    nome: "F6-1: a capa só da imagem",
    arq: PFILA,
    de: 'li && li.forma !== "texto" ? li.caminhos[0] : null',
    para: 'li?.forma === "imagem" ? li.caminhos[0] : null',
    teste: T_PFILA,
    cai: "o carrossel do LinkedIn: a capa é a primeira foto, enquanto não saiu (a parte 3a)",
  },
  {
    nome: "F6-2: a frase sobre a mídia só da imagem",
    arq: PFILA,
    de: 'sobreAMidia: li && li.forma !== "texto" ? fraseSobreAMidia(quando, item.error) : null,',
    para: 'sobreAMidia: li?.forma === "imagem" ? fraseSobreAMidia(quando, item.error) : null,',
    teste: T_PFILA,
    cai: "o carrossel do LinkedIn tem todas as fotos e a frase sobre a mídia, e nunca é vídeo (a parte 3a)",
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
