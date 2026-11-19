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
