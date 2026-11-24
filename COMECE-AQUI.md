# Comece aqui

Guia para quem chega ao Método Chat. Ele explica o que o projeto faz, como o código está organizado, como a equipe trabalha (com um DEV e um AUDITOR), as regras de git e de produção, onde o trabalho parou e o que vem a seguir.

Escrito em 18/11/2026 e atualizado em 19/11/2026. Se um fato daqui mudar, atualize este arquivo no mesmo PR da mudança.

> **Este repositório é PÚBLICO.** Tudo o que entra nele, inclusive commit e corpo de PR, qualquer pessoa lê. Nunca escreva aqui segredo, nome de cliente, conta de Instagram nem endereço interno.

---

## 1. As três regras que não podem falhar

1. **Nunca faça commit nem push na `main`.** Ela não tem proteção, e todo push nela dispara um deploy na Vercel de um app que atende contas reais de Instagram. Trabalhe sempre numa branch. A `main` só recebe código por PR, e quem mescla o PR é o Victor.
2. **O banco do `.env.local` é o de PRODUÇÃO.** As credenciais da Meta e do LinkedIn moram no banco, e não em variável de ambiente, então um banco local vazio não fala com nenhuma rede. Isso é proposital. A consequência: todo clique que grava no painel rodando na sua máquina grava de verdade, na conta de um cliente. Antes de qualquer ação que grave, fale com o Victor e espere a resposta.
3. **Segredo nunca vai para o código, para log, para commit, para PR nem para o chat.** O `.env.local` tem a `SUPABASE_SERVICE_ROLE_KEY`, que passa por cima de todas as regras de acesso do banco. Não imprima, não cole, não passe adiante.

---

## 2. O que é o Método Chat

É um painel em português para automatizar redes sociais pela API oficial de cada rede, sem robô de navegador.

A função que deu origem ao projeto é **"comentário vira DM"**: alguém comenta uma palavra-chave num post do Instagram, e o app responde no privado com uma mensagem e um link. Hoje o painel faz bem mais:

| Área do painel | O que faz |
|---|---|
| **Início** (`/`) | O resumo do dia. |
| **Automações** (`/automacoes`) | Fluxos de DM disparados por comentário, resposta a story ou DM com palavra-chave. O editor é em blocos, com ramificação, portão (pedir para seguir) e coleta de dados. |
| **Conversas** (`/conversas`) | A caixa de entrada das DMs, com as não lidas. |
| **Contatos** (`/contatos`) | Quem interagiu, com categoria, campos coletados e exportação em CSV. |
| **Publicações** (`/publicar`) | Compor e agendar posts: imagem, carrossel, reels e story no Instagram; texto, imagem, carrossel (como PDF) e vídeo no LinkedIn. Um post pode sair só numa rede ou nas duas. |
| **Bônus e carrosséis** (`/bonus`, `/carrosseis`) | O gerador com IA: escreve o bônus (prompt) e o carrossel, gera a arte e a capa, publica o bônus no Método Labs (outro projeto da casa) e o carrossel no Instagram. |
| **Desempenho** (`/desempenho`) | Responde "está funcionando?": as mensagens entregues e a fila. |
| **Atividade** (`/eventos`) | O registro do que aconteceu. |
| **Produtos** (`/produtos`) | Uma vitrine de produtos, com a lista em `lib/produtos.ts`. |
| **Logins e Minha conta** (`/logins`, `/minha-conta`) | Cada pessoa entra com o próprio login e vê só as contas que o administrador liberou. |
| **Configuração** (`/setup`) | Conectar contas do Instagram e do LinkedIn, inclusive por um link de convite que o cliente abre sozinho. |

Uma rede conectada é uma "conta". O painel atende várias contas ao mesmo tempo.

---

## 3. Como o código funciona

### A pilha

- **Next.js 16.4.6** (App Router e `proxy.ts`), **React 19**, TypeScript e **Tailwind v4**. Esta versão do Next mudou APIs e convenções: antes de escrever código de Next, leia o guia em `node_modules/next/dist/docs/` (o `AGENTS.md` pede isso).
- **Node 24.x** (o `engines` do `package.json`).
- **Postgres 17 no Supabase**, com o **Storage** do Supabase para as mídias (o bucket guarda os arquivos até o post sair).
- **Vercel** (plano Hobby, região `gru1`), com deploy automático a cada push na `main`.
- **Upstash QStash** para acordar a fila na hora certa (os "tiques"), e um **cron diário** às 09:00 UTC (06:00 de Brasília).
- **IA:** a Anthropic para o texto do gerador e a OpenAI para as imagens.

### O motor e a fila

O coração do app é uma fila no banco (a tabela `queue`), drenada com trava atômica (`FOR UPDATE SKIP LOCKED`), para nunca enviar nada em dobro.

- O **webhook** da Meta (`/api/webhook`) valida a assinatura, enfileira e drena a fila na mesma requisição.
- O **tique** (`/api/queue/tick`), chamado pelo QStash, drena o que venceu.
- O **cron** (`/api/cron/daily`) renova os tokens e faz uma drenagem de segurança.
- Os cliques do painel também drenam o que é deles.

Os arquivos centrais são `lib/engine.ts` (o motor), `lib/queue-drain.ts` (o dreno) e `lib/fila-tipos.ts` (os tipos de linha que o dreno conhece). Mexer neles é **mexer no motor**, e isso pede o processo completo da seção 6, com o auditor e um agente independente.

Duas regras do dreno que você precisa conhecer:
- o dreno só pega os tipos de linha que conhece; um tipo novo entra na lista antes de qualquer linha dele existir;
- cada passada tem uma **hora de parar** (40 s dentro do prazo da função): depois dela, nada novo começa, e o que sobrou volta para a fila sem gastar tentativa.

### O banco e as migrações

- O esquema vive em `migrations/` (hoje são 26, de `000` a `025`). O `npm run build` aplica as migrações novas com `scripts/migrar.mjs`, **só no deploy de produção**. No preview, o log diz "MIGRAÇÃO PULADA".
- Uma migração que mexe em DADO não roda no build: ela é aplicada à mão, com a decisão do Victor (veja `docs/deploy/2026-09-23-a-012-sai-do-build.md`).
- O deploy confere o esquema e escreve "Nada a aplicar: as 26 migrações já constam no registro." quando não há migração nova. Essa frase é conferida depois de todo merge.

> **O `README.md` está desatualizado em dois pontos:** o banco é o Supabase, e não o Neon; e o esquema NÃO se cria sozinho no `lib/db.ts`: ele vive em `migrations/`. O `COMO-ATUALIZAR.md` descreve um caminho de merge pelo terminal direto na `main`, que esta equipe NÃO usa (veja a regra 1).

### As pastas

| Pasta | O que tem |
|---|---|
| `app/` | as páginas, as actions de servidor e as rotas de API |
| `lib/` | as regras e os serviços; `lib/bonus/` é o gerador; `lib/linkedin*.ts` é o LinkedIn |
| `migrations/` | o esquema do banco, em ordem |
| `scripts/` | o `migrar.mjs`, a varredura de segredos (`varredura-portao.mjs`) e utilitários |
| `tests/` | os testes puros (Vitest) |
| `testes-dom/` | os testes de tela (Vitest com jsdom) |
| `testes-integracao/` | os testes contra um Postgres de verdade, num container local |
| `docs/specs/` | o desenho de cada entrega, aprovado antes do código |
| `docs/plans/` | o plano de cada entrega, com o código ensaiado, fase por fase |
| `docs/deploy/` | notas de deploy que não são óbvias |

As specs e os planos contam o porquê de quase tudo. Antes de mexer numa área, procure o plano dela.

### Os testes

| Comando | O que roda | Hoje, na `main` |
|---|---|---|
| `npm test` | os testes puros | 163 arquivos, 3 884 casos |
| `npm run test:dom` | os testes de tela | 36 arquivos, 350 casos |
| `npm run test:integracao` | os testes contra o banco de teste | 80 arquivos, 1 018 casos e 8 pulados |
| `npm run verify` | lint, tsc, puros, tela, a varredura de segredos e o build | tudo isso |

**Antes de dizer que algo está pronto, `npm run verify` tem de passar limpo.**

---

## 4. No seu computador

1. Clone e instale com `npm ci` (e não `npm install`), para usar exatamente o `package-lock.json`. Nunca rode `npx` sem `--no-install`: ele baixa pacote sem pedir.
2. O `.env.local` não vem no clone. Peça ao Victor. Lembre da regra 2: ele aponta para a produção.
3. Para os testes de integração, suba o banco de teste (Docker): `npm run banco:teste`. Ele cria o container `metodochat-banco-de-teste`, na porta 5434, só em `127.0.0.1`, com os dados em memória.
4. Rode a integração **sempre** com a variável apontando para o container:
   ```bash
   DATABASE_URL_TESTES=postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes npm run test:integracao
   ```
   - A saída tem de mostrar `[rede-global] ALVO: banco de TESTE`.
   - **Nunca rode sem a variável:** sem ela, a suíte cai na `DATABASE_URL`, que é a produção. A dica que a própria suíte imprime, "Rode sem DATABASE_URL_TESTES antes do merge", NÃO vale aqui.
   - Uma rodada de integração de cada vez, nunca duas juntas.
   - O container para entre um dia e outro: confira com `docker ps` antes de rodar.
   - O container fica preso ao projeto do compose que o subiu, e o nome do projeto é o da pasta, em minúsculas. Pare-o com `npm run banco:teste:parar` nessa mesma pasta ou, na pasta principal, com `docker compose -p <projeto> -f docker-compose.yml down -v`. O `banco:teste:parar` rodado em outra pasta não o acha: ele continua de pé, e o próximo `npm run banco:teste` de outra pasta cai, porque o nome `metodochat-banco-de-teste` já está em uso.
5. **Testes que caíam por tempo na primeira rodada de uma cópia nova** (`docs/specs/2026-11-18-testes-que-caem.md`): os casos e os ganchos de `tests/` que varrem a árvore, e os ganchos com `import()`, têm prazo próprio de 60 s, e `tests/prazo-das-varreduras.test.ts` confere isso. Um estouro de tempo neles agora é divergência, e não acaso. Na integração, um caso da migração 012 em `testes-integracao/migracao-dos-dados-legados.integracao.ts` ainda pode cair, pelo corte no segundo e não por prazo: rode o arquivo sozinho e depois a suíte inteira de novo. Se cair de novo, é defeito de verdade.
6. **No Windows:** a cópia de trabalho fica em CRLF e o repositório em LF (`* text=auto`). Não rode `git config` dentro de uma worktree, porque ele grava no `.git/config` do repositório inteiro. Para uma cópia em LF, use `git -c core.autocrlf=false -c core.eol=lf worktree add …` (medido em 19/11/2026: 741 arquivos em LF e nenhum em CRLF). O `-c` vale só para esse comando: o que o git reescrever na cópia depois (um checkout, um restore, um merge) volta a sair em CRLF.

---

## 5. Como trabalhamos: o DEV e o AUDITOR

**Todo trabalho aqui tem duas sessões do Claude Code rodando ao mesmo tempo, na mesma pasta do projeto.**

- **O DEV** desenha com o Victor, escreve o plano, ensaia, escreve o código, roda os testes, faz os commits e prepara os PRs.
- **O AUDITOR** não escreve código. Ele lê, mede e reporta: confere cada fase do DEV, lê a produção só para leitura (antes e depois de cada passo que grava), confere os textos de PR e escreve o relatório do dia ao Victor. Nenhum comando que grave roda sem o "pode" dele.
  - **Como o auditor lê a produção, hoje:** pela Vercel, pelo conector, só com as ferramentas de leitura (os deploys, os registros de build e de execução, e os erros), e nunca promovendo, voltando ou mexendo em variável. O banco de produção, ele só lê quando houver um acesso de leitura, que ainda não existe. Até lá, numa entrega que não muda o app, a leitura da Vercel substitui a da base: ela não vê a fila, mas uma entrega assim não mexe nela (decisão do Victor em 19/11/2026). O plano Hobby guarda os registros de execução por uma hora só.

Os dois são parceiros, e não adversários. O objetivo é a entrega sair certa.

### Abrindo o chat pelo workspace

1. Abra a pasta do projeto no VS Code, com a extensão do Claude Code instalada.
2. Abra **duas conversas** do Claude Code nessa mesma pasta. Uma recebe o papel de DEV, e a outra o de AUDITOR, pela primeira mensagem de cada uma: os textos de partida estão na seção 10.
3. Cada sessão ganha um nome (algo como `metodochat-xx`). Elas se acham com a ferramenta **ListAgents** e conversam sozinhas com a **SendMessage**, sem você copiar e colar nada entre elas.
4. No começo do dia, o DEV confirma com você, por uma pergunta, qual sessão é o auditor daquele dia.
5. Duas abas abertas sobre a mesma conversa viram duas sessões com o mesmo papel. Só fica uma, a que você confirmar, e a outra para de escrever.

### O ciclo de uma entrega

Cada entrega passa pelas etapas abaixo, nesta ordem. Uma entrega pequena pode juntar etapas, mas nenhuma é pulada quando a mudança toca o motor, a fila, o login ou a produção.

1. **Desenho com o Victor.** As decisões são dele, feitas por perguntas de múltipla escolha (a ferramenta AskUserQuestion, que chamamos de "a caixa"), uma por vez, com a opção recomendada primeiro.
2. **Spec** em `docs/specs/AAAA-MM-DD-assunto.md`. O auditor lê antes do Victor.
3. **Ensaio.** O código é escrito fase por fase numa cópia isolada (uma worktree com `npm ci` próprio e o `.env.local` VAZIO, para nada falar com a produção). Em cada fase:
   - o teste vem antes, e a falha dele é medida com o código ausente;
   - o código entra, e o teste passa;
   - as três suítes rodam inteiras;
   - a **guarda do diff** confere que só os arquivos previstos mudaram.
4. **Mutações** (ou sabotagens): um roteiro estraga cada proteção de propósito, uma por vez, e confere que algum teste cai. A mutação que não cai é um teste que não mede nada.
5. **Plano** em `docs/plans/`, com o código de cada fase escrito por inteiro. O auditor aplica o plano do zero numa cópia limpa e confere que sai igual ao ensaio. Quando a mudança toca o motor, um agente independente lê o plano também.
6. **"Li, pode executar"** do Victor, pela caixa.
7. **Execução** numa branch, fase por fase. O patch-id de cada fase tem de ser igual ao do ensaio, e o auditor confere cada uma.
8. **Push da branch**, com o OK do Victor pela caixa. A Vercel monta um **preview**.
9. **Prova no preview.** O preview grava no banco de PRODUÇÃO e publica nas redes de verdade, numa conta de provas. Quem clica é o Victor. Antes de cada clique, o auditor mede o relógio e a conta, lê a base e dá o "pode". O preview não tem o QStash: o que fica na fila só anda com o "Remarcar" da tela, usando o minuto que o relógio mostra.
10. **PR**, com o OK do Victor. O corpo é lido pelo auditor antes.
11. **Merge**, feito pelo Victor no GitHub, depois de uma leitura da base pelo auditor. Na própria caixa do merge, o Victor confirma que a conta dele no GitHub tem "Keep my email addresses private" ligado (e, de preferência, "Block command line pushes that expose my email"). Nem o DEV nem o auditor veem essa configuração, e sem ela o e-mail pessoal de quem mescla vai para o histórico público, no commit do merge.
12. **Deploy e primeira hora.** Confere-se o log do deploy, o site e, por uma hora, os erros e a fila contra a leitura de antes do merge. As leituras de +15 e +50 minutos têm hora certa, contada do READY do deploy, e vão ao relatório: o Hobby guarda os registros por uma hora, e uma leitura perdida não se recupera. O DEV também anota as duas horas e cobra a leitura do auditor em cada uma. Se a sessão do auditor cair, o DEV avisa o Victor antes de a janela de uma hora fechar.
13. **Teste na produção**, quando a entrega tem um caminho que o preview não alcança.
14. **Limpeza** das cópias de trabalho, com o OK do Victor. Uma cópia com `node_modules` num caminho longo (como o scratchpad do Claude Code) passa do limite de 260 caracteres do Windows ao ser apagada, e o `git worktree remove` a deixa pela metade. Crie as cópias com um nome curto, ou renomeie a pasta para um nome curto antes de apagar. Nunca use `--force` às cegas.

### Os achados

Todo problema achado ganha um número, em sequência (quando este guia foi atualizado, em 19/11/2026, íamos no 316; o último número fica no relatório do dia), e uma classe:
- **BLOQUEIA:** a entrega não segue até resolver;
- **CORRIGIR:** resolve antes de publicar;
- **ANOTAR:** fica registrado e segue.

### Regras de trabalho entre as sessões

- **Todo roteiro vai ao auditor antes de rodar,** com o sha256 e as linhas. Isso vale até para um roteiro que só lê. Um roteiro mudado vai com a versão anterior e o diff.
- **Toda linha citada é medida antes.** Um `arquivo:linha` mandado a alguém foi conferido no commit certo, e não lembrado.
- **Medição vence afirmação.** Quando uma sessão contradiz a outra, mede-se de novo e manda-se a medição.
- **O essencial vai dentro da pergunta.** O texto escrito antes de uma caixa às vezes não chega ao Victor. Tudo o que ele precisa para decidir vai na própria pergunta e nas opções. Uma pergunta que só registra o que aconteceu (por exemplo, "Você fez o merge?") não tem opção recomendada e tem sempre "Não fiz / não lembro".
- **Antes de cada escrita na produção:** o OK do Victor pela caixa, a hora mandada ao auditor e o "pode" dele, nesta ordem.
- **Com o Victor, sempre em português,** em linguagem simples.

---

## 6. Git, commits e PRs

- **Uma branch por assunto,** saindo da `main`, com nome curto em português (`agendados`, `linkedin-video`).
- **`git add` com o caminho de cada arquivo.** Nunca `git add -A` nem `git add .`: pode haver mais de uma sessão na mesma árvore.
- **Confira a branch antes de cada commit.** Commit na branch errada não sobe: ele vai para a certa por `cherry-pick`.
- **A mensagem do commit segue o estilo do Vinícius,** o autor original: uma frase em português que diz o EFEITO da mudança, sem prefixo (nada de `feat:` ou `docs:`), e o porquê no corpo, quando precisar. Exemplo: "O reels em MP4 sai também no LinkedIn, como vídeo em partes, só lá ou nas duas redes".
- **Nenhum rodapé de IA,** nem `Co-Authored-By: Claude`, em commit, PR ou mensagem.
- **Nenhum e-mail pessoal no histórico,** nem no commit do merge. O git de quem commita usa o e-mail noreply do GitHub, e a conta de quem mescla tem o e-mail privado ligado (o passo 11 da seção 5).
- **Antes do commit,** varra os arquivos tocados atrás de caractere de controle e de fim de linha misturado: um escape comido (`\b` virando backspace) passa calado pelo lint, pelo tsc e pelos testes.
- **O commit é um comando à parte,** rodado depois de ler a saída dos testes.
- **O PR explica o porquê,** e não só o quê. O corpo não tem arroba solta (o GitHub avisa a conta com aquele nome), nem nome de cliente, nem conta de Instagram fora de crase, nem e-mail.
- **A mensagem do merge é o título do PR.** O GitHub escreve o commit do merge como "Merge pull request #N from …" e põe o título do PR no corpo. Por isso, o título é escrito no mesmo estilo e aprovado como a mensagem do merge: assim ela sai certa sem depender de colar texto na hora.

---

## 7. Onde paramos (19/11/2026)

### Os 5 pontos que o Vinícius deixou

O Vinícius, autor da maior parte do código, deixou cinco pontos sobre o que faltava. Desde 15/10/2026, o motor dele pode ser mudado com a decisão do Victor, seguindo o jeito do Vinícius: comentário com o porquê e a medição, função pura com teste, uma mutação por proteção e commit numa frase.

| # | O ponto | Situação |
|---|---|---|
| 1 | O "limite de 5m" dos posts | **Resolvido.** O "5m" foi entendido como 5 MB. A medição na produção não achou falha de tamanho: os envios já vão direto ao bucket, sem passar pelo teto de 4,5 MB da Vercel. A investigação achou outra coisa: o QStash estava desligado, e os agendados só saíam com um webhook ou com o cron. Ele foi ligado, e os tiques foram conferidos. |
| 2 | Postar em várias redes (LinkedIn, TikTok, YouTube, X) | **Em andamento.** O LinkedIn, no perfil pessoal, está em produção: a conexão, texto e imagem, as duas redes no mesmo post, o carrossel como PDF e o vídeo (PRs #31 a #38). Falta o detalhe abaixo. As outras redes vêm depois. |
| 3 | A correção das imagens do carrossel | **Em produção** desde 29/10 (PR #21): o painel enquadra as fotos em 4:5, 1:1 ou 1,91:1 antes de publicar. |
| 4 | Perfis de login | **Em produção:** os logins individuais (PR #29, 05/11) e as contas por login (PR #30, 06/11). |
| 5 | Facilitar o cadastro de contas | **Em produção:** o link de convite, que o cliente abre para conectar a própria conta (PRs #27 e #28, 04/11). Falta uma prova de ponta a ponta com uma conta real de fora. |

### O que vem a seguir, nesta ordem

1. **O teste final do vídeo no LinkedIn, na produção.** O vídeo foi para a produção em 17/11 (PR #38), e a primeira hora passou limpa. Falta publicar um vídeo de 30 s nas duas redes pela produção, que deve sair sozinho pelos tiques, em 5 partes. É o único caminho que o preview não alcança. O Victor clica, e o auditor acompanha. O teste espera um acesso de leitura da produção para o auditor, que ainda não existe.
2. **O LinkedIn no carrossel do gerador:** hoje o carrossel do gerador sai só no Instagram.
3. **As outras redes.** Uma pesquisa de 06/11, ainda a conferir, aponta que o TikTok veta ferramenta de agência, que o X cobra por post e que o YouTube só aceita vídeo. Cada rede começa por um desenho com o Victor.

### O que está anotado e ainda aberto

- **O botão de convite do LinkedIn** pode criar dois convites com dois cliques, e o que sobra continua válido até ser cancelado à mão.
- **Na conexão do LinkedIn**, uma vez a página final mostrou "link que não vale mais" com a conexão feita. A causa não foi achada.
- **Um travamento de até 5 minutos** ao abrir a página inicial, visto só num preview. A causa não foi achada.
- **No preview, um "Remarcar"** para um minuto que ainda não chegou fica parado, porque lá a fila não anda sozinha. A tela poderia deixar mais claro qual minuto usar.
- **A página de um carrossel** pode levar 30 s ou mais para carregar no preview. Não medido na produção.
- **O custo da imagem em pé da capa** não tinha sido medido no painel da OpenAI até a última anotação (03/11).
- **As cópias de trabalho do vídeo e as antigas que guardam um `.env.local`** ficaram na máquina do Eduardo, e a limpeza delas é lá.
- **O GitHub guarda 39 ramos antigos,** fora a `main`. Apagá-los é uma decisão à parte.

### Ideias que NÃO são para construir agora

- O painel pode virar, no futuro, um produto para várias empresas, com clientes isolados. Por enquanto, a regra é só manter o acesso por conta num lugar só, sem construir nada nessa direção.
- O `LICENSE` limita o uso do código. Antes de qualquer coisa que venda o painel a terceiros, fale com o Victor.

---

## 8. Armadilhas que já custaram caro

- **O relógio do computador.** O "Remarcar" do preview usa a hora digitada, e um relógio adiantado manda a linha para o futuro. Sincronize o relógio do sistema antes de uma prova.
- **Um endereço público do bucket pode servir um arquivo já apagado** (cache). Para saber se um arquivo saiu, conte na tabela `storage.objects`, só lendo.
- **A busca no histórico da própria sessão acha o resultado da busca anterior.** Antes de dizer que algo aconteceu duas vezes, confira se a segunda é só o eco.
- **O preview grava na produção.** Um preview antigo, de uma branch velha, também grava, com o código velho.
- **O `postgres` (Postgres.js) e o `timestamptz`:** um parâmetro tipado `$1::timestamptz` vira `Date` e perde os microssegundos. Para comparar um instante exato, use `$1::text::timestamptz`.

---

## 9. Para ler antes de mexer

- Este guia, inteiro.
- `AGENTS.md`: esta versão do Next.js é diferente da que você conhece.
- `docs/auditoria-de-design-2026-09-10.md`: o sistema visual (contraste, escala, raios e alvos de toque). Tela nova segue o que existe.
- `docs/specs/` e `docs/plans/` da área em que você vai mexer.
- Exemplos de entrega escrita, ensaiada e provada: `docs/plans/2026-11-16-linkedin-video.md` (com prova no preview) e `docs/plans/2026-11-18-testes-que-caem.md` (sem mudança no app).

---

## 10. Os textos de partida

Cada conversa do Claude Code recebe o papel pela primeira mensagem (a seção 5). Copie o texto do papel e cole como a primeira mensagem da conversa. Os textos trazem só as regras: o nome de cada sessão aparece na hora, pelo ListAgents.

### O do DEV

```text
Você é o DEV do Método Chat nesta sessão. Antes de tudo, leia inteiros o COMECE-AQUI.md e o AGENTS.md.
- As três regras da seção 1 do COMECE-AQUI valem sempre, e as da seção 4 também: o npx só com --no-install, e a integração só com a DATABASE_URL_TESTES apontando para o banco de teste.
- Você desenha com o Victor, escreve a spec e o plano, ensaia numa cópia isolada, escreve o código, roda os testes, faz os commits e prepara os PRs.
- O AUDITOR é a outra sessão aberta nesta mesma pasta. Ache-a com ListAgents e fale com ela por SendMessage. No começo do dia, confirme com o Victor, pela caixa, qual sessão é o auditor.
- Nenhum comando que grave roda sem o "pode" do auditor, nem para testar. Todo roteiro vai a ele antes, com o sha256 e o número de linhas; um roteiro mudado vai com a versão anterior e o diff.
- Toda linha citada é medida antes. Medição vence afirmação.
- As decisões são do Victor, pela caixa, com o essencial dentro da pergunta e a opção recomendada primeiro.
- Antes de cada escrita na produção: a caixa do Victor, a hora mandada ao auditor e o "pode" dele, nesta ordem.
- Fale com o Victor sempre em português simples.
```

### O do AUDITOR

```text
Você é o AUDITOR do Método Chat nesta sessão. Antes de tudo, leia inteiros o COMECE-AQUI.md e o AGENTS.md.
- As três regras da seção 1 do COMECE-AQUI valem sempre, e as da seção 4 também: o npx só com --no-install, e a integração só com a DATABASE_URL_TESTES apontando para o banco de teste.
- Você NÃO escreve código nem faz commit: você lê, mede e reporta.
- O DEV é a outra sessão aberta nesta mesma pasta. Ache-a com ListAgents e fale com ela por SendMessage.
- Para cada spec ou plano do DEV, responda: (1) está correto e resolve o problema? (2) existe uma opção melhor ou mais simples? Qual, e por quê? (3) segue os padrões do projeto (COMECE-AQUI, specs e planos em docs/, docs/auditoria-de-design-2026-09-10.md, teste antes do código, mutações, guarda do diff, estilo de commit)?
- Confira cada fase do DEV rodando os testes você mesmo. Meça antes de afirmar, e só cite arquivo:linha depois de conferir.
- Todo roteiro do DEV passa por você antes de rodar, mesmo o que só lê.
- Numere os achados em sequência, a partir do último do relatório do dia anterior, com a classe BLOQUEIA, CORRIGIR ou ANOTAR.
- A produção você só lê. Nada que grave lá roda sem o seu "pode", depois da caixa do Victor e da hora.
- No fim do dia, escreva o relatório ao Victor.
- Fale com o Victor sempre em português simples.

Comece mandando ao DEV uma mensagem dizendo que está no ar.
```
