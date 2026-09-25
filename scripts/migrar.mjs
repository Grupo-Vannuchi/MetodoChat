// Aplica as migrações de esquema de `migrations/`, em ordem de nome.
//
// Uso:  node scripts/migrar.mjs                     ← ENSAIO A SECO, só mostra o que faria
//       node scripts/migrar.mjs --aplicar           ← grava, e SÓ em deploy de produção
//       node scripts/migrar.mjs --aplicar --a-mao   ← grava fora de um deploy, à mão
//
// Desde 26/08 ele roda DENTRO do `build` (package.json), e a trava que decide se
// aplica mora aqui embaixo, em "A TRAVA DE PRODUÇÃO". O ensaio a seco não é
// travado: ele só lê.
//
// DESDE 23/09 NEM TUDO ENTRA NO BUILD: migração que MEXE EM DADO é ADIADA e só
// roda com `--a-mao` (ver `SO_A_MAO`, abaixo). O motivo é a janela do deploy —
// o banco ficava à frente do código enquanto o deploy não era promovido, e com
// uma migração que reescreve linhas isso fazia o fluxo entregar o link sem
// pedir o dado. O procedimento está em
// `docs/deploy/2026-09-23-a-012-sai-do-build.md`.
//
// O ENSAIO A SECO SEGUE A MESMA REGRA: sem `--a-mao` ele mostra o que o BUILD
// faria; com `--a-mao`, o que a MÃO faria.
//
// CÓDIGO DE SAÍDA: 0 quando toda coluna esperada existe com o tipo e o padrão
// esperados; 1 quando alguma confere errado — coluna ausente depois de aplicar,
// ou coluna presente com forma divergente. É o que um roteiro de implantação lê
// para decidir se segue ou para — e, desde 26/08, é também o que decide se o
// `next build` chega a acontecer.
//
// PULAR SAI 0, MAS SÓ QUANDO O SCRIPT SABE ONDE ESTÁ. Num preview, ou na
// máquina de quem desenvolve, não aplicar é o comportamento certo e sai 0. Sem
// prova de estar num dos dois lugares — `VERCEL_ENV` ausente E `.env.local`
// ausente — ele RECUSA com código 1, em vez de pular calado. O porquê inteiro
// está em "A TRAVA DE PRODUÇÃO", abaixo.
//
// -----------------------------------------------------------------------------
// POR QUE ELE EXISTE
//
// Até 26/08 o esquema nascia dentro da aplicação: `ensureSchema` (lib/db.ts)
// rodava 49 comandos na primeira requisição de cada instância. Isso funcionava,
// mas deixava o esquema AMARRADO AO DEPLOY — a estrutura só existia depois que o
// código novo subia.
//
// A Fase 2a esbarrou nisso de frente. O motor novo precisa da coluna `ligacoes`
// PREENCHIDA para funcionar, e preencher exige que ela exista, e ela só existia
// depois do deploy — que é justamente o que não podia acontecer antes. Impasse.
//
// Este script quebra o impasse pela raiz: o esquema passa a poder ser preparado
// ANTES, por um passo próprio. É também a primeira parcela da mudança maior
// descrita em `docs/plans/2026-08-17-esquema-e-harness.md`.
//
// DESDE 26/08 O ESQUEMA BASE INTEIRO MORA AQUI. `000-esquema-base.sql` traz as
// 42 instruções da lista `DDL` de `lib/db.ts`, os dois `alter` que
// `ensureSchema` rodava fora dela e a semente de `config`; `004` e `005` trazem as
// duas mudanças de FORMA que estavam escondidas dentro de `migrateAccounts`. Um
// banco vazio passa a nascer inteiro só desta pasta.
//
// **`ensureSchema` FOI APAGADO EM 26/08, E ESTA PASTA É A ÚNICA FONTE DA
// ESTRUTURA.** Enquanto ele existia, implantar sem rodar isto ainda funcionava;
// hoje, esquecer de rodar QUEBRA o deploy — e isso é intencional, não
// descoberto. A remoção foi feita com a prova de equivalência na mão: um schema
// descartável por lado, comparados campo a campo (tabela, coluna com posição,
// tipo, nulidade e padrão, índice, chave primária, chave estrangeira com regra
// de exclusão e `check`), **ZERO divergências**. Aquele caminho continua
// existindo, com as perguntas que sobreviveram: ver
// `testes-integracao/esquema-base.integracao.ts`.
//
// -----------------------------------------------------------------------------
// POR QUE NÃO NO SCRIPT DE DADO
//
// `scripts/ligar-passos-existentes.mjs` diz, no próprio comentário, que não
// grava DDL "para não fazer esquema ser coisa de script de dado". O princípio
// está certo e continua valendo: aquele script preenche, este cria. Misturar os
// dois faria um script de migração de dado precisar de permissão de DDL, e
// tornaria impossível rodar só um dos dois.
//
// -----------------------------------------------------------------------------
// O CONTRATO: TODA MIGRAÇÃO DESTA PASTA É IDEMPOTENTE
//
// Com `if not exists` em toda DDL, rodar duas vezes é inofensivo.
//
// A TABELA DE CONTROLE EXISTE, e este parágrafo afirmava o contrário até
// 23/09/2026. Ele dizia "não há tabela de controle registrando o que já foi
// aplicado — de propósito, por ora", e isso era FALSO desde `7ee9f9e`, anterior
// à branch da coleta de dados: `schema_migrations` nasce aqui mesmo (ver "O
// REGISTRO DO QUE JÁ RODOU", abaixo), `decidirMigracoes` (scripts/migracoes.mjs)
// decide por ela, e `testes-integracao/registro-de-migracoes.integracao.ts`
// prova que a segunda rodada não aplica nada.
//
// E O COMENTÁRIO DESATUALIZADO CUSTOU CARO, que é o motivo de esta correção vir
// escrita e não apagada: ele continuava anunciando que a tabela de controle
// "vira obrigatória no dia em que aparecer a primeira migração que MOVE DADO" —
// e `docs/deploy/2026-08-26-migracao-no-build.md:72-77` mandava, nesse mesmo
// dia, repensar a ORDEM do build "junto com a tabela de controle, que também não
// existe ainda". Quem leu os dois em 2026 leu uma condição com duas metades e
// concluiu que o dia estava longe. Metade dela já estava resolvida havia
// semanas; a outra metade — a ordem — é a que ficou, e é a que a `012` cobrou.
//
// O PREÇO, escrito para não ser descoberto tarde: `if not exists` não serve para
// migração que MOVE DADO (renomear coluna preservando conteúdo, quebrar uma
// tabela em duas). Essas não são idempotentes por natureza, e é o registro que
// as segura — por isso ele existe.
//
// E ELAS NÃO RODAM DENTRO DO BUILD. Ver `SO_A_MAO`, mais abaixo: o dia previsto
// chegou com a `012`, e a resposta é que migração de dado é aplicada À MÃO,
// depois de o código novo estar no ar. O procedimento inteiro está em
// `docs/deploy/2026-09-23-a-012-sai-do-build.md`.
//
// A ÚNICA LINHA DESTA PASTA QUE ESCREVE DADO DENTRO DO BUILD é a semente de
// `config` em `000`, e ela cabe no contrato: `on conflict (id) do nothing` não
// lê, não altera e não apaga nada — só faz nascer a linha única quando não há
// nenhuma. O token dela é GERADO, e é por isso que a cláusula importa: rodar de
// novo não pode trocar o token de quem já está usando o sistema. Está medido,
// como asserção executada, em `testes-integracao/esquema-base.integracao.ts`.
import postgres from "postgres";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { comandosDoArquivo, somaDoTexto, decidirMigracoes } from "./migracoes.mjs";
import { sslDaUrl } from "../lib/conexao.ts";

// Espelha `limparUrl` de lib/db.ts: cada fornecedor inventa o seu parâmetro de
// URL (channel_binding no Neon, pgbouncer no Prisma), o postgres.js não conhece
// nenhum e os repassa ao servidor, que os recusa.
function limparUrl(url) {
  const u = new URL(url);
  for (const p of ["channel_binding", "pgbouncer"]) u.searchParams.delete(p);
  return u.toString();
}

const aplicar = process.argv.includes("--aplicar");

// ---------- A TRAVA DE PRODUÇÃO ----------
//
// A partir de 26/08 este script roda DENTRO do `build` (ver `package.json`), e
// portanto em TODO deploy — inclusive nos de branch. O dono decidiu: **a
// migração aplica em deploy de produção, e só nele. Branch de teste não toca o
// banco.**
//
// POR QUE A TRAVA MORA AQUI, E NÃO NUMA LINHA DE SHELL. Dava para escrever
// `[ "$VERCEL_ENV" = production ] && node scripts/migrar.mjs --aplicar` no
// `package.json`. Seria mais curto e seria pior: uma condição de shell não tem
// onde ser comentada, não diz nada quando pula, e não pode ser exercitada por
// ninguém. Aqui ela é legível, comentada e MEDÍVEL — quem duvidar roda o script
// com `VERCEL_ENV` valendo cada coisa e lê a saída. É o mesmo raciocínio de
// `baseDoGraph()` (lib/ig.ts), que é o precedente desta base: a decisão de "isto
// pode se mover?" mora no código, com o porquê ao lado.
//
// A VARIÁVEL, E DE ONDE VEM A AFIRMAÇÃO. `VERCEL_ENV` é definida pela Vercel,
// vale `production`, `preview` ou `development`, e está disponível **tanto no
// build quanto em runtime** — documentação da Vercel, "System environment
// variables" (/docs/environment-variables/system-environment-variables), lida em
// 26/08. Isto NÃO está nos documentos do Next: `grep -rn VERCEL_ENV
// node_modules/next/dist/docs/` devolve ZERO. Quem for reconferir olha a
// documentação da Vercel, não a do Next.
//
// PULAR SAI COM CÓDIGO 0 QUANDO O SCRIPT SABE ONDE ESTÁ: num preview, não
// aplicar é o comportamento CERTO, e um deploy de branch não pode falhar por
// estar se comportando bem. Quem lê o código de saída (o `&&` do `build`) tem de
// seguir. **O que mudou em 26/08 é o caso em que ele NÃO sabe** — ver "O BURACO
// QUE ESTA SEÇÃO FECHOU", abaixo.
//
// A CAIXA, E O QUE ELA CUSTA. A mesma documentação diz que essas variáveis só
// existem com a caixa **"Enable access to System Environment Variables"**
// marcada nas configurações do projeto. Com ela DESMARCADA, `VERCEL_ENV` não
// existe nem em produção. Até 26/08 isso fazia o script pular em todo deploy,
// calado e com código 0; hoje faz o deploy ficar VERMELHO, e a mensagem nomeia a
// caixa. A conferência do log continua valendo e continua barata: no deploy de
// produção, o log do build tem de mostrar "MODO: APLICANDO". Está escrito no
// roteiro de deploy.
//
// A SEGUNDA PORTA, e por que ela é uma porta e não um buraco. Este script
// continua sendo rodado À MÃO — foi assim que as três migrações de hoje
// entraram, e o roteiro de deploy continua mandando rodar o ensaio a seco antes.
// Fora da Vercel não existe `VERCEL_ENV`, então sem uma porta o `--aplicar`
// manual morreria junto com o preview. A porta é uma segunda bandeira,
// `--a-mao`, que obriga quem aplica de fora de um deploy a DIZER que é isso que
// está fazendo.
//
// E ela tem tranca própria: `--a-mao` DENTRO de um build da Vercel é recusado
// com código 1, qualquer que seja o ambiente. O sentido da bandeira é "não estou
// num deploy"; estar num deploy a contradiz. Assim, alguém que a escrevesse no
// `build` do `package.json` para "destravar" não ganharia um deploy que aplica
// em preview — ganharia um deploy vermelho, na primeira tentativa.
// -----------------------------------------------------------------------------
// O BURACO QUE ESTA SEÇÃO FECHOU EM 26/08, E POR QUE ELE ERA GRANDE
//
// Até aqui, `VERCEL_ENV` AUSENTE fazia o script pular com código 0. Isso era
// seguro enquanto `ensureSchema` existia: pular devolvia o estado antigo, em que
// a aplicação criava o esquema sozinha na primeira requisição.
//
// **`ensureSchema` NÃO EXISTE MAIS**, e esta trava entrou ANTES da remoção dele,
// de propósito: com a caixa "Enable access to System Environment Variables"
// desmarcada, `VERCEL_ENV` some, o script pularia, o build passaria, o deploy
// subiria — e não há mais nada criando o esquema.
// Uma migração nova nunca seria aplicada, e o defeito apareceria longe da causa.
// Pular calado é a classe de defeito que esta base passou a semana fechando.
//
// A PERGUNTA FOI MEDIDA, E A RESPOSTA É NÃO: **nenhuma variável da Vercel
// distingue "build da Vercel com a caixa desmarcada" de "máquina de alguém".**
// A documentação da Vercel (System environment variables, lida em 26/08) diz o
// que `VERCEL` significa, e a frase encerra o assunto:
//
//     VERCEL=1 — "An indicator to show that system environment variables have
//                 been exposed to your project's Deployments."
//
// Ou seja: `VERCEL` é o indicador de que a CAIXA está marcada. Ele, `CI`,
// `VERCEL_URL`, `VERCEL_DEPLOYMENT_ID` e todos os outros saem pela MESMA caixa.
// Com ela desmarcada, o ambiente de um build da Vercel e o de um laptop são
// indistinguíveis — não por descuido do script, mas por construção.
//
// ENTÃO O SCRIPT PARA DE PERGUNTAR AO AMBIENTE ONDE ELE ESTÁ, e passa a exigir
// PROVA. São dois mundos, e cada um tem a sua:
//
//   1. UM DEPLOY — prova: `VERCEL_ENV` existe. Aplica se `production`, pula se
//      `preview` ou `development` (com código 0, que continua sendo o certo).
//   2. A MÁQUINA DE UMA PESSOA — prova: existe um `.env.local` no diretório de
//      trabalho.
//   3. QUALQUER OUTRA COISA — recusa, com código 1.
//
// POR QUE `.env.local` É PROVA, e isto não é palpite: ele está no `.gitignore`,
// a Vercel constrói a partir do repositório, e **já foi medido em 26/08 que ele
// não existe num build da Vercel** — foi justamente o ENOENT desta leitura que
// obrigou a URL do banco a vir do ambiente primeiro (ver a seção seguinte e
// `docs/deploy/2026-08-26-migracao-no-build.md`). O arquivo é o que existe de um
// lado e não pode existir do outro.
//
// O QUE ISSO CUSTA: num diretório sem `.env.local` e sem `VERCEL_ENV`, um
// `npm run build` fica VERMELHO. É o lado barato de errar — o outro lado é um
// deploy verde sobre um banco sem migração e sem rede. A mensagem diz as duas
// saídas.
//
// A TRANCA DO `--a-mao` GANHOU A SEGUNDA METADE, E ELA FECHA O ESPELHO DO MESMO
// BURACO. A tranca antiga recusava `--a-mao` quando `VERCEL_ENV` existia — mas
// com a caixa desmarcada ela não dispararia, e um `--a-mao` escrito no `build`
// do `package.json` faria um deploy de PREVIEW aplicar no banco vivo. Agora
// `--a-mao` exige a mesma prova do mundo 2: sem `.env.local`, é recusado.

const ambienteDaVercel = process.env.VERCEL_ENV;
const naVercel = typeof ambienteDaVercel === "string" && ambienteDaVercel !== "";
const emDeployDeProducao = ambienteDaVercel === "production";
const aMao = process.argv.includes("--a-mao");
// Relativo ao diretório de trabalho, como o `readdirSync("migrations")` e o
// `readFileSync(".env.local")` logo abaixo: o contrato deste script é ser rodado
// da RAIZ do repositório.
const temEnvLocal = existsSync(".env.local");

const COMO_SAIR =
  "  Se você está num build da Vercel: marque a caixa \"Enable access to System\n" +
  "    Environment Variables\" nas configurações do projeto e implante de novo.\n" +
  "  Se você está construindo na sua máquina: rode da raiz do repositório, onde\n" +
  "    o `.env.local` está — ou `npx next build` direto, que não migra nada.\n";

if (aplicar && aMao && naVercel) {
  console.error(
    "RECUSADO: `--a-mao` dentro de um build da Vercel (VERCEL_ENV=" +
      `${ambienteDaVercel}).\n` +
      "  Essa bandeira significa \"não estou num deploy\", e estar num deploy a\n" +
      "  contradiz. Se ela veio do `build` do package.json, tire-a de lá: a\n" +
      "  trava de produção existe para que branch de teste não toque o banco.\n" +
      "Saindo com código 1."
  );
  process.exit(1);
}

if (aplicar && aMao && !temEnvLocal) {
  console.error(
    "RECUSADO: `--a-mao` sem `.env.local` no diretório de trabalho.\n" +
      "  A bandeira significa \"estou aplicando à mão, da minha máquina\", e a\n" +
      "  prova disso é o `.env.local` — que o `.gitignore` mantém fora do\n" +
      "  repositório e que, medido em 26/08, NÃO existe num build da Vercel.\n" +
      "  Sem ela, um `--a-mao` escrito no `build` do package.json faria um deploy\n" +
      "  de PREVIEW gravar no banco de produção quando a caixa de variáveis de\n" +
      "  sistema estivesse desmarcada.\n" +
      "  Rode da raiz do repositório.\n" +
      "Saindo com código 1."
  );
  process.exit(1);
}

if (aplicar && !naVercel && !aMao && !temEnvLocal) {
  // O BURACO, FECHADO. Nem prova de deploy nem prova de máquina: o script não
  // sabe onde está, e o lugar mais caro de estar sem saber é um build de
  // produção com a caixa desmarcada. Falhar aqui deixa o deploy vermelho; o
  // contrário deixaria o deploy verde sobre um banco sem migração.
  console.error(
    "RECUSADO: não dá para saber onde este script está rodando.\n" +
      "  VERCEL_ENV: ausente — e nenhuma variável da Vercel distingue \"build com\n" +
      "    a caixa de variáveis de sistema desmarcada\" de \"máquina de alguém\":\n" +
      "    `VERCEL`, `CI` e as outras saem pela MESMA caixa (documentação da\n" +
      "    Vercel, System environment variables).\n" +
      "  `.env.local`: ausente — e é ele a prova de estar numa máquina.\n" +
      "  ANTES DE 26/08 ISTO PULAVA COM CÓDIGO 0, e era seguro porque\n" +
      "    `ensureSchema` criava o esquema na primeira requisição. Essa rede foi\n" +
      "    desligada (Frente 1): pular aqui seria subir um deploy sobre um banco\n" +
      "    sem migração, e sem nada para criá-la.\n" +
      COMO_SAIR +
      "Saindo com código 1, sem abrir conexão com o banco."
  );
  process.exit(1);
}

if (aplicar && !emDeployDeProducao && !aMao) {
  // A mensagem diz o valor que ACHOU, e não só que pulou: "VERCEL_ENV ausente" e
  // "VERCEL_ENV=preview" são dois mundos diferentes, e quem lê o log precisa
  // saber em qual está. E ela diz QUAL PROVA a fez pular — sem isso, "pulei"
  // volta a ser indistinguível de "não sei o que estou fazendo".
  console.log(
    "MIGRAÇÃO PULADA — este não é um deploy de produção.\n" +
      `  VERCEL_ENV: ${naVercel ? ambienteDaVercel : "ausente"}\n` +
      `  A prova de onde estou: ${
        naVercel
          ? "um deploy da Vercel, e não é o de produção"
          : "`.env.local` no diretório — a máquina de alguém"
      }\n` +
      "  A migração aplica só quando VERCEL_ENV=production. Num preview, e na\n" +
      "  máquina de quem desenvolve, isto é o comportamento correto — e por isso\n" +
      "  NÃO é falha.\n" +
      "  Para aplicar à mão, fora de um deploy: node scripts/migrar.mjs --aplicar --a-mao\n" +
      "Saindo com código 0, sem abrir conexão com o banco."
  );
  process.exit(0);
}

// ---------- DE ONDE VEM A URL DO BANCO ----------
//
// O AMBIENTE PRIMEIRO, O ARQUIVO COMO RESERVA — e a ordem é esta porque o
// arquivo é justamente o que NÃO EXISTE no lugar novo. Até 26/08 aqui havia uma
// linha só:
//
//     readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim()
//
// Na máquina de quem roda à mão ela funciona. Num build da Vercel, `.env.local`
// não existe — o `.gitignore` o mantém fora do repositório, e é assim que tem de
// ser —, então o script morria de ENOENT antes de abrir conexão. MEDIDO em
// 26/08, rodando o script de um diretório sem o arquivo: `Error: ENOENT … open
// '…\.env.local'`, código de saída **1**.
//
// Isso deixou de ser detalhe no dia em que este script passou a rodar DENTRO do
// `build` (ver `package.json`): o ENOENT derrubaria o deploy inteiro, e por um
// motivo que nada tem a ver com o esquema.
//
// A FORMA É A MESMA de `testes-integracao/banco-descartavel.ts:urlDoBanco()`, de
// propósito: as duas perguntam ao ambiente e só depois ao arquivo. Duas formas
// diferentes para a mesma pergunta é como nasce a divergência que ninguém vê.
//
// O CAMINHO CONTINUA RELATIVO AO DIRETÓRIO DE TRABALHO, como o
// `readdirSync("migrations")` logo abaixo: o contrato deste script é ser rodado
// da RAIZ do repositório, e na Vercel a raiz é o diretório de trabalho do build.
// Ancorar só um dos dois no arquivo daria a impressão falsa de que ele roda de
// qualquer lugar — o outro continuaria não rodando.
//
// DO ARQUIVO SAI UMA LINHA E NADA MAIS. A `ADMIN_PASSWORD` mora nele e não é
// lida — e não é lida porque não é procurada.
function urlDoBanco() {
  const doAmbiente = process.env.DATABASE_URL;
  if (doAmbiente && doAmbiente.trim()) return doAmbiente.trim();

  let texto;
  try {
    texto = readFileSync(".env.local", "utf8");
  } catch {
    throw new Error(
      "DATABASE_URL não veio do ambiente, e `.env.local` não existe neste " +
        "diretório. Rode da raiz do repositório, ou defina DATABASE_URL no ambiente."
    );
  }
  const achado = texto.match(/^DATABASE_URL=(.+)$/m);
  if (!achado) {
    throw new Error("DATABASE_URL não encontrada: nem no ambiente, nem no `.env.local`.");
  }
  // As aspas saem porque um arquivo `.env` pode trazê-las e a URL não as quer.
  return achado[1].trim().replace(/^["']|["']$/g, "");
}

// O `ssl` DEPENDE DO ALVO, e nao e mais cravado: a suite de integracao pode
// rodar contra um Postgres local (docker-compose.yml), e a imagem oficial nao
// serve TLS. A regra tem um dono so -- `sslDaUrl` (lib/conexao.ts).
const urlDoAlvo = limparUrl(urlDoBanco());
const sql = postgres(urlDoAlvo, { prepare: false, ssl: sslDaUrl(urlDoAlvo), max: 1, onnotice: () => {} });

console.log(aplicar ? "MODO: APLICANDO (grava no banco)\n" : "MODO: ENSAIO A SECO (nada é gravado)\n");

// ============================================================
// O REGISTRO DO QUE JÁ RODOU — e a medição que o obrigou.
//
// Em 28/08/2026 dois builds de produção morreram aos 120 segundos, os dois no
// PRIMEIRO arquivo, com `canceling statement due to statement timeout` (57014).
// Nenhuma das seis migrações tinha o que fazer: todas já estavam aplicadas.
//
// `alter table ... if not exists` pega a trava EXCLUSIVA da tabela ANTES de
// descobrir que não há nada a fazer. Um leitor parado numa transação aberta
// (medido: um `npm run dev` apontando para este mesmo banco) segura a tabela e
// derruba o deploy — inclusive o deploy que não muda uma vírgula do esquema.
//
// A defesa é não executar o que já foi executado. A DECISÃO mora em
// `scripts/migracoes.mjs`, pura e com caso para cada saída; aqui fica só a
// conversa com o banco.
//
// ESTA TABELA É CRIADA PELO PRÓPRIO SCRIPT, e não por um arquivo em
// `migrations/`. Não é descuido: um `006-registro.sql` seria circular —
// precisaríamos do registro para saber se o registro já foi aplicado.
// ============================================================
const TABELA_DO_REGISTRO = "schema_migrations";

if (aplicar) {
  // A única DDL que roda SEMPRE. É segura porque nada mais neste produto lê ou
  // escreve nesta tabela: não há leitor para disputar a trava com ela.
  await sql.unsafe(
    `create table if not exists ${TABELA_DO_REGISTRO} (
       name text primary key,
       checksum text not null,
       applied_at timestamptz not null default now()
     )`
  );
}

let registro = [];
try {
  registro = await sql.unsafe(`select name, checksum from ${TABELA_DO_REGISTRO}`);
} catch (erro) {
  // 42P01 = relação não existe. Acontece no ensaio a seco antes da primeira
  // aplicação, e a resposta certa é "nada foi registrado ainda" — não estourar.
  if (erro?.code !== "42P01") throw erro;
  console.log(
    `  (o registro ${TABELA_DO_REGISTRO} ainda não existe; nasce na primeira aplicação)\n`
  );
}

// Ordem por nome, e é por isso que os arquivos são numerados. Ordem alfabética
// de `001-`, `002-` … coincide com a ordem cronológica até 999 arquivos, o que
// é folga suficiente para este projeto.
const nomes = readdirSync("migrations").filter((f) => f.endsWith(".sql")).sort();

if (!nomes.length) {
  console.log("Nenhuma migração em `migrations/`.");
  await sql.end();
  process.exit(0);
}

const arquivos = nomes.map((nome) => {
  const comandos = comandosDoArquivo(readFileSync(join("migrations", nome), "utf8"));
  return { nome, comandos, soma: somaDoTexto(comandos) };
});

// ============================================================
// AS MIGRAÇÕES QUE O BUILD NÃO APLICA — e a janela do deploy, que é o motivo.
//
// O PROBLEMA, MEDIDO. Este script roda no COMEÇO do `next build`
// (`package.json`), e a aplicação ANTERIOR continua atendendo o webhook da Meta
// até o build terminar e o deploy ser promovido. Nessa janela o banco está à
// frente do código. Enquanto toda migração desta pasta foi ADITIVA, isso era
// inofensivo — coluna nova parada não muda o que o código velho faz, e é assim
// que `docs/deploy/2026-08-26-migracao-no-build.md` justifica a ordem (razão 3),
// dizendo na mesma frase: "no dia da primeira migração que MOVE dado, esta
// ordem tem de ser repensada".
//
// A `012` é essa migração, e ela diz isso na primeira linha. Ela reescreve
// `tipo: "pedir_email"` para `pedir_dado`, e o código VELHO não conhece o tipo
// novo — o `conferir` DE ENTÃO (o de hoje é bilíngue, ver a metade 1 abaixo)
// recusa o bloco, `interpretar` o IGNORA e o fluxo ENTREGA O LINK sem nunca ter
// pedido o dado — calado, para as automações ativas de clientes reais. Quem estava no meio da conversa perde o cursor e a
// resposta que acabou de mandar. E se o `next build` FALHAR, a janela não fecha:
// a migração já gravou, o deploy não é promovido, e o estado dura tempo
// indeterminado.
//
// O CONSERTO TEM DUAS METADES, e esta é a segunda:
//
//   1. O MOTOR FICOU BILÍNGUE. `conferir` (lib/steps.ts) aceita `pedir_email`
//      como APELIDO de `pedir_dado { campo: "email" }`, traduzindo na leitura.
//      Com isso o código NOVO serve dado VELHO, e os dois formatos funcionam ao
//      mesmo tempo, em qualquer ordem — a janela deixa de existir nas DUAS
//      direções, e reverter o deploy volta a ser seguro.
//   2. A `012` SAI DO BUILD (esta lista). Ela deixa de ser destravamento e vira
//      limpeza de formato, aplicada à mão num momento calmo, com o código novo
//      já no ar.
//
// POR QUE A TRAVA MORA AQUI, E NÃO NUMA PASTA SEPARADA: `migrations/` é a única
// fonte da estrutura, e os testes de integração montam o schema descartável de
// toda rodada aplicando a pasta INTEIRA (`testes-integracao/migracoes.ts`).
// Mover o arquivo para fora tiraria a `012` de todas as provas que a cercam —
// são cinco pontos de rede, plantados e medidos. Aqui a decisão é uma linha
// legível, com o porquê ao lado, e o arquivo continua na pasta, na ordem, no
// registro e sob teste. É o mesmo raciocínio de "A TRAVA DE PRODUÇÃO", acima.
//
// ELA NÃO DESLIGA A CONFERÊNCIA: `ESPERADAS_DADOS` (lá embaixo) continua
// perguntando ao banco o que sobrou. O que muda é o VEREDICTO — enquanto a
// migração não estiver no registro, sobrar é o ESPERADO e não derruba o deploy;
// depois que ela estiver, sobrar volta a ser falha. O porquê inteiro está lá.
//
// QUEM ACRESCENTAR MIGRAÇÃO QUE MEXE EM DADO ACRESCENTA AQUI, e acrescenta
// também em `ESPERADAS_DADOS`.
const SO_A_MAO = new Set(["012-migrar-email-para-campos.sql"]);

const COMO_APLICAR_A_MAO =
  "Aplique à mão, da raiz do repositório, com o código novo já no ar:\n" +
  "    node scripts/migrar.mjs                          ← ensaio a seco\n" +
  "    node scripts/migrar.mjs --aplicar --a-mao        ← grava\n" +
  "  O procedimento está em `docs/deploy/2026-09-23-a-012-sai-do-build.md`.";

const decisao = decidirMigracoes(arquivos, registro);

for (const nome of decisao.jaAplicadas) {
  console.log(`  ·    ${nome} — já aplicada, nada a fazer`);
}

// ARQUIVO EDITADO DEPOIS DE APLICADO: o SQL que este banco recebeu não é mais o
// que está no arquivo, e ninguém consegue dizer qual dos dois vale. PARA ANTES
// DE APLICAR QUALQUER COISA — inclusive as migrações sem conflito, porque a
// pergunta "este banco está no estado que a pasta descreve?" ficou sem resposta,
// e aplicar mais coisas por cima só afunda o descompasso.
if (decisao.conflitos.length) {
  console.log("\nPAROU: migração já aplicada foi EDITADA depois.\n");
  for (const c of decisao.conflitos) {
    console.log(`  ✗    ${c.nome}`);
    console.log(`         assinatura registrada: ${c.registrada}`);
    console.log(`         assinatura do arquivo: ${c.atual}`);
  }
  console.log(
    "\nMigração aplicada é imutável: o banco já recebeu a versão antiga, e rodar\n" +
      "a nova por cima produz um estado que ninguém consegue prever lendo isto.\n" +
      "Se a mudança é de propósito, ela é um arquivo NOVO em `migrations/`.\n" +
      "Se foi sem querer, devolva o arquivo ao que estava."
  );
  await sql.end();
  process.exit(1);
}

// Registro apontando para arquivo que não existe mais. O SQL dele JÁ RODOU neste
// banco, então não há o que refazer — mas o descompasso é notícia, e some se
// ninguém contar. Não é motivo para parar.
for (const orfa of decisao.orfas) {
  console.log(`  !    ${orfa} — está no registro e NÃO está em migrations/`);
}

// AS ADIADAS, E A SEPARAÇÃO É PELA BANDEIRA `--a-mao`, não pelo ambiente.
//
// `--a-mao` já significa "não estou num deploy" (ver "A TRAVA DE PRODUÇÃO",
// acima), e as duas trancas dela garantem que ela não pode ser escrita no
// `build` do `package.json` para destravar isto: dentro da Vercel ela é
// RECUSADA, e sem `.env.local` também. Ou seja, migração de dado não tem como
// voltar para dentro de um deploy sem que alguém apague `SO_A_MAO` de propósito.
//
// O ENSAIO A SECO SEGUE A MESMA REGRA, e é o que faz a prévia dizer a verdade:
// `node scripts/migrar.mjs` mostra o que o BUILD faria (a `012` adiada), e
// `node scripts/migrar.mjs --a-mao` mostra o que a MÃO faria (a `012` inclusa).
// Um ensaio que mostrasse sempre tudo prometeria um build que não acontece.
const adiadas = aMao ? [] : decisao.aplicar.filter((nome) => SO_A_MAO.has(nome));
const aRodar = decisao.aplicar.filter((nome) => !adiadas.includes(nome));

for (const nome of adiadas) {
  console.log(`  |    ${nome} — ADIADA: mexe em DADO e não roda dentro do build`);
}
if (adiadas.length) {
  console.log(
    "\n  A MIGRAÇÃO ACIMA MEXE EM DADO, e por isso fica FORA do build: aplicá-la\n" +
      "  antes de o deploy ser promovido põe o banco à FRENTE do código, e essa é\n" +
      "  a janela em que o fluxo entrega o link sem pedir o dado. NÃO é falha, e o\n" +
      "  deploy SEGUE — o motor serve os dois formatos do pedido (`conferir`,\n" +
      "  lib/steps.ts).\n" +
      `  ${COMO_APLICAR_A_MAO}\n`
  );
}

if (aplicar && !aRodar.length) {
  console.log(
    `\nNada a aplicar: as ${decisao.jaAplicadas.length} migrações já constam no registro.\n` +
      "NENHUMA DDL de esquema foi executada, então nenhuma trava foi pedida."
  );
}

// O QUE O BANCO CONFIRMA TER RECEBIDO — e quem lê isto é `ESPERADAS_DADOS`,
// lá embaixo: uma conferência de DADO só pode cobrar o resultado de uma
// migração que RODOU. Começa no registro lido antes da decisão e cresce a
// cada aplicação bem sucedida, dentro do laço.
const noRegistro = new Set(decisao.jaAplicadas);

for (const nome of aRodar) {
  const arq = arquivos.find((a) => a.nome === nome);

  if (!aplicar) {
    console.log(`  ►    ${nome}`);
    for (const l of arq.comandos.split("\n")) if (l) console.log(`         ${l}`);
    continue;
  }

  try {
    // OS COMANDOS E O REGISTRO NA MESMA TRANSAÇÃO. Separados, um erro entre os
    // dois deixaria o banco migrado e o registro dizendo que não — e o deploy
    // seguinte rodaria tudo de novo, de volta à estaca zero deste conserto.
    await sql.begin(async (tx) => {
      // `set local` vale só nesta transação. Sem ele a espera é o
      // `statement_timeout` do banco (120s, medido), tempo suficiente para o
      // build morrer sem dizer o que estava esperando.
      await tx.unsafe("set local lock_timeout = '15s'");
      if (arq.comandos) await tx.unsafe(arq.comandos);
      await tx.unsafe(
        `insert into ${TABELA_DO_REGISTRO} (name, checksum) values ($1, $2)
         on conflict (name) do update set checksum = excluded.checksum, applied_at = now()`,
        [nome, arq.soma]
      );
    });
    console.log(
      arq.comandos
        ? `  ✓    ${nome} — aplicada e registrada`
        : `  ✓    ${nome} — só comentário, registrada sem rodar nada`
    );
    noRegistro.add(nome);
  } catch (erro) {
    // 55P03 = lock_not_available (bateu no `lock_timeout` acima).
    // 57014 = query_canceled (bateu no `statement_timeout` do banco).
    if (erro?.code !== "55P03" && erro?.code !== "57014") throw erro;
    console.log(`\n  ✗    ${nome} — NÃO consegui a trava.\n`);
    console.log(
      "Alguém está com uma transação aberta numa tabela desta migração.\n" +
        "Isto NÃO é problema do SQL: DDL idempotente pede a trava exclusiva ANTES\n" +
        "de descobrir que não tem o que fazer.\n\n" +
        "Para ver quem segura:\n" +
        "  select pid, state, now()-xact_start as ha, left(query,80)\n" +
        "    from pg_stat_activity\n" +
        "   where xact_start is not null order by xact_start;\n\n" +
        "Causa já medida neste projeto: um `npm run dev` apontando para este\n" +
        "mesmo banco, com uma aba do painel aberta."
    );
    await sql.end();
    process.exit(1);
  }
}

// A CONFERÊNCIA VALE MAIS QUE O "aplicada" ACIMA, porque `if not exists` tem
// sucesso mesmo quando não faz nada — inclusive quando o arquivo está errado.
// Perguntar ao banco o que existe de verdade é a única leitura que não mente.
//
// A LISTA É ESCRITA À MÃO, E QUEM ACRESCENTAR MIGRAÇÃO ACRESCENTA AQUI. Ela
// nasceu com uma linha só (`ligacoes`), e a Tarefa 9 a encontrou VELHA no
// primeiro dia em que houve uma segunda migração: com `002` na pasta, o script
// imprimia "aplicada" para as duas e depois conferia SÓ a coluna de `001`. Ou
// seja, `002` podia não fazer efeito nenhum e a única leitura que não mente
// diria "CONFERIDO" sobre outra coisa — que é a mesma classe de defeito que o
// parágrafo acima existe para fechar, por outra porta.
//
// POR QUE NÃO EXTRAIR OS NOMES DO PRÓPRIO `.sql`: daria uma expressão regular
// casando `add column if not exists <nome>`, e ela passaria a ser a definição do
// que esta pasta pode conter. O contrato escrito lá em cima é `if not exists` em
// TODA DDL — `create index`, `create table`, `add constraint` —, e um extrator
// que só entende `add column` ficaria calado justamente na migração de forma
// nova. Uma lista à mão que alguém esquece de atualizar falha em silêncio uma
// vez; um extrator que não entende a DDL falha em silêncio sempre.
//
// `tipo` E `padrao` SÃO A SEGUNDA METADE DA CONFERÊNCIA, e vieram da revisão da
// Tarefa 9. Até então esta parte IMPRIMIA os dois e não os comparava com nada:
// uma coluna nascida `boolean not null default true` — que é exatamente o risco
// que `lib/db.ts` e `migrations/002` declaram um ao outro, por terem a mesma DDL
// escrita duas vezes — sairia daqui como "CONFERIDO … existe" e ninguém veria.
// Presença é o que `if not exists` garante; FORMA é o que ele não garante.
//
// Os valores são os que o Postgres devolve, não os que a DDL escreve: `boolean`
// e não `bool`, `false` e não `'false'`. Quem acrescentar linha aqui roda o
// ensaio a seco uma vez e copia o que saiu.
// `naoNulo` COMPLETA A FORMA, e vem desta re-revisão: `tipo` e `padrao` já
// aferiam dois terços da DDL enquanto o terceiro — `not null` — nem chegava a
// ser lido. `boolean not null default true`, o risco que o parágrafo acima
// cita para justificar aferir forma, tem justamente um `not null` nele; uma
// coluna que nascesse SEM essa cláusula — "o `not null` caiu numa das cópias
// da DDL" é uma divergência tão plausível quanto o tipo ou o padrão trocados
// — saía CONFERIDO até aqui.
const ESPERADAS = [
  {
    tabela: "automations",
    coluna: "ligacoes",
    de: "001-ligacoes.sql",
    tipo: "jsonb",
    padrao: "'[]'::jsonb",
    naoNulo: true,
  },
  {
    tabela: "automations",
    coluna: "entrega_sem_portao",
    de: "002-entrega-sem-portao.sql",
    tipo: "boolean",
    padrao: "false",
    naoNulo: true,
  },
  {
    tabela: "contacts",
    coluna: "categoria",
    de: "007-categoria-do-contato.sql",
    tipo: "text",
    padrao: null,
    naoNulo: false,
  },
  {
    tabela: "contacts",
    coluna: "campos",
    de: "011-campos-do-contato.sql",
    tipo: "jsonb",
    padrao: "'{}'::jsonb",
    naoNulo: true,
  },
  {
    tabela: "contacts",
    coluna: "campo_tentativas",
    de: "011-campos-do-contato.sql",
    tipo: "integer",
    padrao: "0",
    naoNulo: true,
  },
];

// ============================================================
// O QUE TEM DE **NÃO** EXISTIR — a conferência simétrica.
//
// `ESPERADAS` acima afirma presença, e por três anos foi só disso que este
// projeto precisou: toda migração ACRESCENTAVA. A `006` é a primeira que
// DESTRÓI, e para ela a lista de presença não serve — pior, ela é MUDA: uma
// remoção que não fez efeito nenhum passaria por aqui sem uma linha, e o script
// sairia 0 dizendo "CONFERIDO" sobre outras duas colunas.
//
// É a mesma classe de defeito que a Tarefa 9 encontrou (a lista velha conferindo
// só a coluna de `001`), pela terceira porta. A conferência já aprendeu forma de
// coluna e chave estrangeira; agora aprende ausência.
//
// QUEM ACRESCENTAR MIGRAÇÃO QUE REMOVE ACRESCENTA AQUI.
// ============================================================
const REMOVIDAS_ESPERADAS = [
  {
    tabela: "contacts",
    coluna: "flow_step_index",
    de: "006-colunas-mortas.sql",
  },
  {
    tabela: "contacts",
    coluna: "follow_attempts_dia",
    de: "006-colunas-mortas.sql",
  },
];

// A SEGUNDA LISTA, E ELA NASCE DO DIA QUE O PARÁGRAFO ACIMA PREVIU.
//
// Lá em cima está escrito, desde a Tarefa 9, que um extrator que só entende
// `add column` "ficaria calado justamente na migração de forma nova". A `003` é
// essa migração: ela não cria coluna nenhuma — muda a REGRA DE EXCLUSÃO de uma
// chave estrangeira. A conferência de colunas passaria por ela sem uma palavra,
// e o script sairia 0 dizendo "CONFERIDO" sobre outras duas coisas.
//
// Ou seja: a lista à mão tinha o mesmo ponto cego do extrator que ela recusou,
// só que por outro motivo — não por não entender a DDL, mas por só saber
// PERGUNTAR sobre coluna. Presença de coluna era tudo que ela sabia checar.
//
// `confdeltype` é uma letra: c = cascade, n = set null, a = no action,
// r = restrict, d = set default. Aferimos a letra, não a presença: uma chave que
// exista com a regra ERRADA é exatamente o caso que esta migração conserta, e
// seria absurdo que a conferência dela não soubesse ver a diferença.
const ESPERADAS_CHAVES = [
  {
    tabela: "queue",
    coluna: "automation_id",
    aponta: "automations",
    aoExcluir: "n", // set null — a fila é histórico e sobrevive à automação
    de: "003-fila-sobrevive-a-automacao.sql",
  },
  {
    // NÃO É ALVO DE MIGRAÇÃO NENHUMA, e está aqui de propósito: é a regra que
    // deve CONTINUAR sendo cascade. Acompanhamento é mensagem FUTURA agendada —
    // se a automação morre, ele tem que morrer junto, senão o sistema manda
    // mensagem de uma automação que não existe. Se alguém "consertar" esta para
    // set null por simetria com a de cima, esta linha acusa.
    tabela: "followups",
    coluna: "automation_id",
    aponta: "automations",
    aoExcluir: "c", // cascade, e é o certo
    de: "esquema base (lib/db.ts) — deliberado, ver migrations/003",
  },
];

// A TERCEIRA LISTA, E ELA NASCE DO MESMO DIA QUE A SEGUNDA PREVIU.
//
// `000-esquema-base.sql` é a maior migração desta pasta — 8 tabelas, 8 índices,
// 26 `alter table`, os dois `alter` soltos e a semente de `config`. As duas
// listas acima olham COLUNA e CHAVE ESTRANGEIRA, e nenhuma delas sabe perguntar
// "a tabela existe". Sem esta lista, um `000` que não fizesse efeito nenhum
// passaria calado, e o script sairia 0 dizendo "CONFERIDO" sobre duas colunas
// que já estavam lá.
//
// A LISTA É AS OITO TABELAS DO ESQUEMA BASE, e não uma amostra: a graça de
// conferir presença de tabela é justamente pegar a que faltou.
const ESPERADAS_TABELAS = {
  de: "000-esquema-base.sql",
  nomes: [
    "accounts",
    "automations",
    "config",
    "contacts",
    "events",
    "followups",
    "login_attempts",
    "queue",
  ],
};

// A QUARTA LISTA, E ELA NASCE DE `004` E `005`.
//
// As duas migrações novas mudam formas que NENHUMA das listas acima enxerga:
// `004` reescreve um `check`, e `005` troca a CHAVE PRIMÁRIA de `contacts`. Uma
// conferência que só sabe perguntar por coluna e por chave estrangeira imprimiria
// "CONFERIDO" sobre outra coisa nas duas — que é exatamente o defeito que a
// segunda lista existe para não repetir.
//
// AFERIMOS A DEFINIÇÃO INTEIRA, e não a presença, pelo mesmo motivo do
// `confdeltype` acima: uma restrição que exista com o conteúdo ERRADO é o caso
// que estas migrações consertam, e seria absurdo que a conferência delas não
// soubesse ver a diferença. Um `queue_kind_check` com CINCO tipos existe, tem o
// nome certo, e recusa quatro tipos de fila em uso.
//
// OS TEXTOS SÃO OS QUE O POSTGRES DEVOLVE (`pg_get_constraintdef`), e não os que
// a DDL escreve — `ANY (ARRAY[…::text])` e não `in (…)`. Quem acrescentar linha
// aqui roda o ensaio a seco uma vez e copia o que saiu.
const ESPERADAS_RESTRICOES = [
  {
    tabela: "contacts",
    nome: "contacts_pkey",
    de: "005-contatos-chave-composta.sql",
    // A mesma pessoa pode falar com duas contas conectadas. Com a chave só em
    // `ig_id`, o `on conflict (account_id, ig_id)` de `upsertContact` estoura
    // 42P10 no primeiro webhook de DM.
    definicao: "PRIMARY KEY (account_id, ig_id)",
  },
  {
    // ESTA LINHA É REESCRITA A CADA MIGRAÇÃO QUE ALARGA A RESTRIÇÃO, e não
    // duplicada: `queue_kind_check` é UMA restrição, e o banco só tem a versão
    // mais nova dela. Uma segunda entrada com o mesmo nome faria uma das duas
    // acusar divergência para sempre, e a acusação seria mentira. Foi assim que
    // a `008` substituiu a `004` aqui, e é assim que a `010` substitui a `008`:
    // o `de` aponta para quem escreveu o texto que está no banco AGORA.
    tabela: "queue",
    nome: "queue_kind_check",
    de: "010-fila-publicacao.sql",
    definicao:
      "CHECK ((kind = ANY (ARRAY['private_reply'::text, 'comment_reply'::text, " +
      "'dm_welcome'::text, 'dm_link'::text, 'dm_reminder'::text, " +
      "'dm_follow_gate'::text, 'dm_email_ask'::text, 'story_reaction'::text, " +
      "'dm_manual'::text, 'dm_lote'::text, 'publicacao'::text])))",
  },
  {
    // A GÊMEA DA LINHA ACIMA, na coluna vizinha da mesma tabela. Ela está aqui
    // pela mesma razão: um `queue_status_check` com CINCO estados existe, tem o
    // nome certo, e recusa o `update` que guarda o item de lote — o dreno
    // falharia por linha, e a conferência de presença não veria nada.
    tabela: "queue",
    nome: "queue_status_check",
    de: "009-fila-estado-guardado.sql",
    definicao:
      "CHECK ((status = ANY (ARRAY['pending'::text, 'sending'::text, " +
      "'sent'::text, 'failed'::text, 'skipped'::text, 'guardado'::text])))",
  },
];

// QUANTAS CONFERÊNCIAS FALHARAM. É o que decide o código de saída lá embaixo.
let falhas = 0;

console.log("");
for (const { tabela, coluna, de, tipo, padrao, naoNulo } of ESPERADAS) {
  // A PERGUNTA É FEITA AO `pg_catalog` E NÃO AO `information_schema`, e o motivo
  // é o `table_schema` que faltava: `where table_name = 'automations'` casa a
  // coluna em QUALQUER schema visível ou não — dois bancos com a mesma tabela em
  // schemas diferentes conferiam um contra o outro. `to_regclass` resolve o nome
  // pelo `search_path`, que é EXATAMENTE como o `alter table` acima o resolveu:
  // não sobra ambiguidade para filtrar. Tabela inexistente devolve null, o `=`
  // não casa nada, e a linha sai como "NÃO existe" — que é a resposta certa.
  //
  // `attnotnull` está no MESMO `pg_attribute` que já dá `tipo`, a um campo de
  // distância — não é consulta nova, é uma coluna a mais no mesmo select.
  const colunas = await sql`
    select format_type(a.atttypid, a.atttypmod) as tipo,
           pg_get_expr(d.adbin, d.adrelid) as padrao,
           a.attnotnull as nao_nulo
    from pg_attribute a
    left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
    where a.attrelid = to_regclass(${tabela})
      and a.attname = ${coluna}
      and a.attnum > 0
      and not a.attisdropped`;

  if (!colunas.length) {
    // AUSENTE NO ENSAIO A SECO É O ESPERADO — nada foi gravado, então não há o
    // que conferir e isto não é falha. Ausente DEPOIS DE APLICAR é falha: o
    // script disse "aplicada" e o banco discorda.
    console.log(
      `CONFERIDO no banco: ${tabela}.${coluna} NÃO existe (${de})` +
        (aplicar
          ? " — A MIGRAÇÃO NÃO FEZ EFEITO, pare e investigue."
          : " (esperado no ensaio a seco)")
    );
    if (aplicar) falhas++;
    continue;
  }

  const achado = {
    tipo: colunas[0].tipo,
    padrao: colunas[0].padrao,
    naoNulo: colunas[0].nao_nulo,
  };
  const divergentes = [];
  if (achado.tipo !== tipo) divergentes.push(`tipo esperado ${tipo}, achado ${achado.tipo}`);
  if (achado.padrao !== padrao)
    divergentes.push(`default esperado ${padrao}, achado ${achado.padrao}`);
  if (achado.naoNulo !== naoNulo)
    divergentes.push(`not null esperado ${naoNulo}, achado ${achado.naoNulo}`);

  if (divergentes.length) {
    // DIVERGÊNCIA DE FORMA É FALHA NOS DOIS MODOS, e não só ao aplicar: a coluna
    // já está no banco com a forma errada, e rodar `--aplicar` de novo não
    // conserta — `if not exists` vai achar que está tudo certo para sempre.
    console.log(
      `CONFERIDO no banco: ${tabela}.${coluna} existe, MAS DIVERGE de ${de} — ` +
        divergentes.join("; ") +
        ". Pare e investigue: `if not exists` não vai corrigir isto sozinho."
    );
    falhas++;
    continue;
  }

  console.log(
    `CONFERIDO no banco: ${tabela}.${coluna} existe e confere (${achado.tipo}, ` +
      `not null ${achado.naoNulo}, default ${achado.padrao})`
  );
}

// A CONFERÊNCIA DA AUSÊNCIA — espelho exata da de presença, com a polaridade
// invertida em UM ponto e não em dois: no ensaio a seco, a coluna AINDA ESTAR lá
// é o esperado (nada foi gravado); depois de aplicar, ela ainda estar lá é
// falha. É a mesma frase do bloco de cima, ao contrário.
for (const { tabela, coluna, de } of REMOVIDAS_ESPERADAS) {
  // A MESMA pergunta ao `pg_catalog` do bloco acima, e pelo mesmo motivo:
  // `to_regclass` resolve o nome pelo `search_path`, exatamente como o
  // `alter table` o resolveu. E `not a.attisdropped` importa AQUI mais que lá —
  // o Postgres não apaga a linha de `pg_attribute` ao derrubar uma coluna, ele
  // a marca. Sem esse filtro, a coluna removida continuaria "existindo" e esta
  // conferência falharia para sempre depois de funcionar.
  const achadas = await sql`
    select 1 from pg_attribute a
     where a.attrelid = to_regclass(${tabela})
       and a.attname = ${coluna}
       and a.attnum > 0
       and not a.attisdropped`;

  if (achadas.length) {
    console.log(
      `CONFERIDO no banco: ${tabela}.${coluna} AINDA EXISTE (${de})` +
        (aplicar
          ? " — A REMOÇÃO NÃO FEZ EFEITO, pare e investigue."
          : " (esperado no ensaio a seco)")
    );
    if (aplicar) falhas++;
    continue;
  }

  console.log(`CONFERIDO no banco: ${tabela}.${coluna} não existe mais (${de})`);
}

const NOME_DA_REGRA = { a: "no action", r: "restrict", c: "cascade", n: "set null", d: "set default" };

for (const { tabela, coluna, aponta, aoExcluir, de } of ESPERADAS_CHAVES) {
  const chaves = await sql`
    select c.conname as nome, c.confdeltype as ao_excluir
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid and a.attnum = any(c.conkey) and not a.attisdropped
    where c.contype = 'f'
      and c.conrelid = to_regclass(${tabela})
      and c.confrelid = to_regclass(${aponta})
      and a.attname = ${coluna}`;

  if (!chaves.length) {
    console.log(
      `CONFERIDO no banco: ${tabela}.${coluna} NÃO tem chave para ${aponta} (${de})` +
        (aplicar ? " — A MIGRAÇÃO NÃO FEZ EFEITO, pare e investigue." : " (esperado no ensaio a seco)")
    );
    if (aplicar) falhas++;
    continue;
  }

  const achada = chaves[0].ao_excluir;
  if (achada !== aoExcluir) {
    // DIVERGÊNCIA DE REGRA É FALHA NOS DOIS MODOS, pelo mesmo motivo da forma de
    // coluna: a chave já está no banco com a regra errada, e rodar a migração de
    // novo não a conserta sozinha se alguém tiver mexido nela por fora.
    console.log(
      `CONFERIDO no banco: ${tabela}.${coluna} -> ${aponta} DIVERGE de ${de} — ` +
        `ao excluir esperado "${NOME_DA_REGRA[aoExcluir]}", achado ` +
        `"${NOME_DA_REGRA[achada] || achada}". Pare e investigue.`
    );
    falhas++;
    continue;
  }

  console.log(
    `CONFERIDO no banco: ${tabela}.${coluna} -> ${aponta} confere ` +
      `(ao excluir: ${NOME_DA_REGRA[achada]})`
  );
}

// `to_regclass` devolve null para tabela que não existe, e é essa a resposta que
// interessa: perguntar ao `information_schema` casaria o nome em qualquer schema
// visível, e o `search_path` desta conexão é o mesmo pelo qual as migrações
// acabaram de rodar.
{
  const ausentes = [];
  for (const nome of ESPERADAS_TABELAS.nomes) {
    const r = await sql`select to_regclass(${nome}) is not null as existe`;
    if (!r[0].existe) ausentes.push(nome);
  }
  if (ausentes.length) {
    console.log(
      `CONFERIDO no banco: tabelas AUSENTES (${ESPERADAS_TABELAS.de}): ` +
        ausentes.join(", ") +
        (aplicar
          ? " — A MIGRAÇÃO NÃO FEZ EFEITO, pare e investigue."
          : " (esperado no ensaio a seco, num banco vazio)")
    );
    if (aplicar) falhas++;
  } else {
    console.log(
      `CONFERIDO no banco: as ${ESPERADAS_TABELAS.nomes.length} tabelas do esquema ` +
        `base existem (${ESPERADAS_TABELAS.de})`
    );
  }
}

for (const { tabela, nome, definicao, de } of ESPERADAS_RESTRICOES) {
  const achadas = await sql`
    select pg_get_constraintdef(c.oid) as definicao
    from pg_constraint c
    where c.conrelid = to_regclass(${tabela}) and c.conname = ${nome}`;

  if (!achadas.length) {
    console.log(
      `CONFERIDO no banco: ${tabela}.${nome} NÃO existe (${de})` +
        (aplicar
          ? " — A MIGRAÇÃO NÃO FEZ EFEITO, pare e investigue."
          : " (esperado no ensaio a seco)")
    );
    if (aplicar) falhas++;
    continue;
  }

  if (achadas[0].definicao !== definicao) {
    // DIVERGÊNCIA DE DEFINIÇÃO É FALHA NOS DOIS MODOS, pelo mesmo motivo da forma
    // de coluna e da regra de exclusão: a restrição já está no banco com o
    // conteúdo errado, e o par "derruba se houver, cria em seguida" só a conserta
    // se ELE for quem rodar — se alguém a tiver reescrito por fora, não.
    console.log(
      `CONFERIDO no banco: ${tabela}.${nome} existe, MAS DIVERGE de ${de}\n` +
        `  esperado: ${definicao}\n` +
        `  achado:   ${achadas[0].definicao}\n` +
        "  Pare e investigue."
    );
    falhas++;
    continue;
  }

  console.log(`CONFERIDO no banco: ${tabela}.${nome} existe e confere (${de})`);
}

// ============================================================
// A QUINTA LISTA, E ELA NASCE DA `012` — a primeira migração de DADO.
//
// As quatro listas acima perguntam ao CATÁLOGO: coluna existe, coluna sumiu,
// chave aponta para onde, restrição tem qual texto, tabela existe. Nenhuma
// delas sabe perguntar pelo CONTEÚDO das linhas, e a `012` não emite uma única
// DDL — ela reescreve `contacts.campos` e `automations.steps`. As duas colunas
// que ela toca já existiam antes dela, e continuariam existindo, com a forma
// certa, se ela não tivesse feito nada. Ou seja: sem esta lista o script
// imprimiria "CONFERIDO" cinco vezes sobre outras coisas e sairia 0 com a
// produção ainda no formato velho.
//
// É a MESMA CLASSE DE DEFEITO que fez nascer a segunda lista (a `003` mudava
// chave estrangeira e a conferência de coluna passava calada) e a quarta (a
// `004`/`005` mudavam restrição e a de chave passava calada), pela quinta porta.
// Cada forma nova de migração descobriu que a conferência só sabia perguntar
// pela forma anterior.
//
// E AQUI O SILÊNCIO CUSTA MAIS QUE NAS OUTRAS. As migrações de restrição estão
// do lado ALTO: um banco que não as recebeu RECUSA a escrita errada sozinho. A
// `012` não tem quem recuse — um banco que não a recebeu SERVE NORMALMENTE, e
// nada no catálogo distingue esse banco de um migrado. Esta lista é a ÚNICA
// coisa que enxerga esta migração.
//
// O QUE O PARÁGRAFO ACIMA DIZIA, E DEIXOU DE SER VERDADE EM 23/09/2026: ele
// afirmava que os passos `pedir_email` de um banco não migrado eram recusados
// por `conferir` e IGNORADOS por `interpretar` — o fluxo entregando o link sem
// pedir nada —, e concluía que "a única barreira contra ela é sair 1 aqui e
// derrubar o build". As duas metades caíram com o conserto da janela do deploy:
//
//   · `conferir` (lib/steps.ts) passou a aceitar `pedir_email` como APELIDO de
//     `pedir_dado { campo: "email" }`. Um passo não migrado é SERVIDO — pede o
//     dado e para esperando a resposta. Não há mais falha calada nesse estado;
//   · e por isso derrubar o build deixou de ser a barreira certa. A `012` sai
//     do build (`SO_A_MAO`, acima) e é aplicada à mão; sobrar `pedir_email`
//     ANTES disso é o esperado, e o veredicto desta lista passou a depender de
//     a migração estar no registro. Ver "O VEREDICTO DEPENDE DE A MIGRAÇÃO TER
//     RODADO", no laço lá embaixo, e
//     `docs/deploy/2026-09-23-a-012-sai-do-build.md`.
//
// O QUE ELA CONTINUA SENDO: a prova de que a limpeza de formato ACONTECEU. Sem
// esta lista, o script imprimiria "CONFERIDO" cinco vezes sobre outras coisas e
// sairia 0 com a produção ainda no formato velho, servida pelo apelido para
// sempre — e o apelido é temporário por decisão, não por acidente.
//
// O QUE SE PERGUNTA É "SOBROU ALGUMA?", E NÃO "MIGROU QUANTAS?". Contar o que
// mudou exigiria saber quantas havia antes, e depois da primeira execução essa
// resposta é zero para sempre — a conferência ficaria vermelha em todo deploy
// seguinte. "Sobrou alguma?" responde zero nos dois casos, e continua sendo a
// pergunta certa no deploy número cem.
//
// PERGUNTAR PELO TIPO NÃO BASTA, E ISTO CUSTOU UM ACHADO DA REVISÃO DA TAREFA 7.
// Até ela, a metade das automações perguntava só "sobrou algum `pedir_email`?",
// e essa pergunta é CEGA para o passo que migra e continua sendo ignorado: um
// `pedir_email` SEM TEXTO vira `{"tipo":"pedir_dado","campo":"email"}` SEM
// TEXTO, `conferir` (lib/steps.ts) o recusa por "pedir_dado sem texto" e
// `interpretar` o IGNORA — exatamente a doença que a `012` existe para curar. O
// tipo velho sumiu, então a pergunta antiga respondia "não sobrou nenhum", o
// script saía 0 e o build passava verde.
//
// MEDIDO pela revisão, no arranjo de produção `[dm oi, pedido, dm link]`: o
// passo migrado sem texto enfileira `["oi!","AQUI ESTA O LINK"]` — a MESMA saída
// de `interpretar` que o passo não migrado. Só muda o `motivo` dentro de
// `ignorados`, que ninguém lê em produção. O link sai sem nunca ter pedido nada.
//
// O ATENUANTE, E ELE É VERDADE — escrito aqui para evitar alarme falso em quem
// ler isto depois: o `conferir` ANTERIOR à renomeação (`a23dac0^`,
// lib/steps.ts:1028-1032) já exigia `texto` para `pedir_email`, ou seja o editor
// nunca gravou um assim e o bloco já estaria quebrado hoje, migração ou não. A
// `012` NÃO REGREDE NADA. O defeito é só da conferência, e é o pior tipo: ela
// AFIRMAVA sucesso. Em 21/09/2026 produção tinha ZERO destes (medido, somente
// leitura), então apertar a pergunta não trava deploy nenhum hoje — ela passa a
// travar no dia em que um aparecer, que é todo o ponto.
//
// CADA ENTRADA DIZ O QUE FAZER QUANDO SOBRA (`seSobrar`), e não há mensagem
// única, porque as duas doenças pedem ações OPOSTAS. Para as metades da
// reexecução, sobrar significa "o `update` não casou nada" e o conselho é
// investigar por que a migração não fez efeito. Para o passo sem texto, a
// migração FEZ efeito — e rodá-la de novo não conserta, porque ela não tem como
// inventar o texto que falta. Ali o conserto é humano, pelo editor. Mandar
// "a migração não fez efeito" nesse caso seria mandar o plantão para o lado
// errado, que é o mesmo defeito de sempre com outra roupa.
//
// A CONSULTA NÃO LEVA `account_id`, pelo mesmo motivo escrito no topo de
// `migrations/012`: não há conta pedindo, e filtrar por uma deixaria as outras
// sem conferência.
//
// ATENÇÃO AO `jsonb_typeof`: `jsonb_array_elements` estoura em `steps` que não
// seja array (medido: "cannot extract elements from an object"), e uma
// conferência que derruba o script por uma linha torta seria pior que a
// ausência dela. O `case` faz a guarda POR LINHA, dentro do argumento da função,
// onde a avaliação é garantida — um `where jsonb_typeof(...)` ao lado não é: o
// planejador não promete ordem entre condições do `where`.
//
// QUEM ACRESCENTAR MIGRAÇÃO QUE MEXE EM DADO ACRESCENTA AQUI.
// ============================================================
const ESPERADAS_DADOS = [
  {
    de: "012-migrar-email-para-campos.sql",
    oQue: "passos `pedir_email` (o formato velho, que o apelido de `conferir` ainda serve)",
    // Conta ELEMENTOS, e não automações: uma automação pode ter mais de um, e o
    // número que interessa é quantos blocos continuariam sendo ignorados.
    consulta: `
      select count(*)::int as sobraram
        from automations a,
             lateral jsonb_array_elements(
               case when jsonb_typeof(a.steps) = 'array' then a.steps else '[]'::jsonb end
             ) as p
       where p->>'tipo' = 'pedir_email'`,
    seSobrar: "A MIGRAÇÃO DE DADO NÃO FEZ EFEITO, pare e investigue.",
  },
  {
    de: "012-migrar-email-para-campos.sql",
    oQue: "passos `pedir_dado` SEM TEXTO (migraram, e `interpretar` continua os IGNORANDO)",
    // A PERGUNTA QUE FALTAVA — o achado 1 da revisão da Tarefa 7, e o porquê
    // inteiro está no bloco de comentário acima ("PERGUNTAR PELO TIPO NÃO
    // BASTA"). Em resumo: a entrada de cima olha o TIPO, esta olha o que
    // `interpretar` FAZ com o bloco. Um passo sem texto passa pela primeira e é
    // ignorado do mesmo jeito que o não migrado.
    //
    // A CONDIÇÃO DE TEXTO É O QUE SEPARA O QUEBRADO DO SÃO, e sem ela esta
    // conferência contaria todo `pedir_dado` legítimo — ou seja, ficaria
    // vermelha em todo deploy, contra o dado que a Tarefa 5 grava de propósito.
    // `coalesce(btrim(...), '')` cobre as três formas de "sem texto" que o jsonb
    // admite: chave ausente, `null` e string de espaços; `->>` devolve NULL nas
    // duas primeiras, e `btrim` sozinho propagaria esse NULL para fora da
    // comparação. É a mesma condição da consulta C4 do relatório da revisão,
    // palavra por palavra, para que a conferência do build e a conferência
    // pós-deploy não possam divergir.
    //
    // O `case` do `jsonb_typeof` é o mesmo da entrada de cima, pelo mesmo
    // motivo (`jsonb_array_elements` estoura fora de array) — ver "ATENÇÃO AO
    // `jsonb_typeof`" acima. Quem mexer numa mexe na outra.
    consulta: `
      select count(*)::int as sobraram
        from automations a,
             lateral jsonb_array_elements(
               case when jsonb_typeof(a.steps) = 'array' then a.steps else '[]'::jsonb end
             ) as p
       where p->>'tipo' = 'pedir_dado'
         and coalesce(btrim(p->>'texto'), '') = ''`,
    seSobrar:
      "O BLOCO MIGROU E CONTINUA SENDO IGNORADO por `interpretar`. Rodar a " +
      "migração de novo NÃO conserta — ela não tem como inventar o texto que " +
      "falta. O conserto é pôr texto no bloco pelo editor. Pare e investigue.",
  },
  {
    de: "012-migrar-email-para-campos.sql",
    oQue: "contatos com e-mail na coluna e sem `campos->'email'`",
    // A OUTRA METADE, e ela não é decorativa: um `update` que casasse zero
    // contatos deixaria esta conferência vermelha enquanto a de cima ficaria
    // verde. As duas metades da migração falham de jeitos diferentes.
    //
    // E AGORA ELA TEM REDE — até a revisão da Tarefa 7 esta entrada era GUARDA
    // ÓRFÃ, e a frase acima afirmava "não é decorativa" sem dizer que nada a
    // alcançava. Apagando SÓ esta entrada, a suíte de integração inteira ficava
    // verde (238 passaram / 8 pulados, idêntico à linha de base): o único caso
    // que tocava `ESPERADAS_DADOS` cobrava "SOBRARAM 1" e "pedir_email", que a
    // entrada das automações já imprime sozinha. Quem a prende hoje é o caso
    // "CONTATO com e-mail na coluna e sem `campos`"
    // (testes-integracao/registro-de-migracoes.integracao.ts), que cobra a
    // frase de CONTATOS — e não "SOBRARAM 1", que as outras metades também
    // imprimem.
    //
    // POR QUE AQUI COUBE CASO E NO `order by ord` (migrations/012) NÃO COUBE, e
    // esta é a diferença que decidiu a escolha: lá a cláusula é contrato sem
    // comportamento observável — tirando-a, a saída do Postgres é medidamente
    // IDÊNTICA, com 3 e com 50 elementos, e nenhum caso pode distingui-la. Um
    // teste ali seria verde nos dois mundos, ou seja, não seria teste. Aqui não:
    // tirando esta entrada, um banco com contato para trás sai 0 em vez de 1, e
    // isso um caso enxerga. Quando dá para prender, prende-se; a confissão por
    // escrito é para quando NÃO dá, e é por isso que o vizinho confessa e esta
    // não precisa mais.
    // ESTA CONSULTA É O ÚLTIMO LEITOR DE `contacts.email` NO PRODUTO, e desde o
    // Passo 2a da Parte 2 ela é o único. O código parou de escrever a coluna
    // (`gravarCampo`, lib/engine.ts), a queda para ela saiu de
    // `lib/variables.ts` e ela saiu dos quatro `select` das telas e das rotas —
    // só este `where` continua citando a coluna, e continua de propósito: quem
    // responde "a `012` fez efeito?" precisa olhar a fonte de onde o dado veio.
    //
    // ENTÃO ELA SAI JUNTO COM O `drop column` DO PASSO 2b, e não depois. A
    // ordem não é gosto: com a coluna derrubada e esta entrada de pé, o
    // PRÓXIMO BUILD DE PRODUÇÃO quebra aqui — `column "email" does not exist` —
    // depois de a migração já ter rodado. Quem for aplicar o Passo 2b apaga
    // esta entrada no MESMO commit, e com ela o caso que a prende ("CONTATO com
    // e-mail na coluna e sem `campos`",
    // testes-integracao/registro-de-migracoes.integracao.ts).
    consulta: `
      select count(*)::int as sobraram
        from contacts
       where email is not null and btrim(email) <> '' and not (campos ? 'email')`,
    seSobrar: "A MIGRAÇÃO DE DADO NÃO FEZ EFEITO, pare e investigue.",
  },
];

// O VEREDICTO DEPENDE DE A MIGRAÇÃO TER RODADO, e esta é a metade que a saída
// da `012` do build obrigou a escrever.
//
// Antes, sobrar era sempre falha, e isso estava certo enquanto a migração rodava
// DENTRO do build: se ela acabou de rodar e ainda sobrou coisa, é porque não fez
// efeito. Com a `012` ADIADA (ver `SO_A_MAO`, acima), sobrar passou a ter DUAS
// causas opostas, e derrubar o deploy nas duas seria trocar uma falha calada por
// um bloqueio permanente de deploys corretos:
//
//   A MIGRAÇÃO AINDA NÃO RODOU (não está no registro). Sobrar é o ESPERADO — é
//     literalmente o estado que o deploy foi feito para atravessar em paz. E ele
//     é seguro: o motor serve os dois formatos do pedido (`conferir`,
//     lib/steps.ts), então nenhum lead recebe o link sem entregar o dado. Aqui a
//     conferência DIZ o que viu e o deploy SEGUE.
//
//   A MIGRAÇÃO RODOU (está no registro) e ainda sobrou. Aí é o que sempre foi:
//     ou o `update` não casou nada, ou o bloco migrou quebrado. O deploy PARA, e
//     o `seSobrar` da entrada diz para qual lado investigar.
//
// A CONFERÊNCIA NÃO FOI DESLIGADA, e a diferença importa: ela continua rodando
// as três consultas em todo deploy e continua IMPRIMINDO a conta. O que mudou é
// só o `falhas++`. Uma conferência que só fala quando pode derrubar o build é
// uma conferência que ninguém lê no dia em que ela teria evitado o estrago.
//
// O ESTADO "NÃO APLICADA" TEM PRAZO, e quem o encerra é a mão: depois de
// `--aplicar --a-mao`, a `012` entra no registro e esta conferência volta,
// sozinha, a ser bloqueante. Não há bandeira para lembrar de tirar.
for (const { de, oQue, consulta, seSobrar } of ESPERADAS_DADOS) {
  const [{ sobraram }] = await sql.unsafe(consulta);
  // `noRegistro` é o que o BANCO confirma (ver o laço de aplicação, acima), e
  // não a pasta: um arquivo que existe em `migrations/` e nunca rodou aqui é
  // exatamente o caso que esta linha distingue.
  const aindaNaoRodou = !noRegistro.has(de);

  if (sobraram > 0) {
    const recado = !aplicar
      ? " (esperado no ensaio a seco: nada foi gravado)"
      : aindaNaoRodou
        ? ` — ${de} AINDA NÃO FOI APLICADA, então sobrar é o esperado e o deploy SEGUE. ${COMO_APLICAR_A_MAO}`
        : ` — ${seSobrar}`;

    console.log(`CONFERIDO no banco: SOBRARAM ${sobraram} ${oQue} (${de})` + recado);
    if (aplicar && !aindaNaoRodou) falhas++;
    continue;
  }

  console.log(`CONFERIDO no banco: não sobrou nenhum — ${oQue} (${de})`);
}

if (!aplicar) console.log("\nNada foi gravado. Rode com --aplicar para valer.");

// O CÓDIGO DE SAÍDA É O QUE SEPARA "SEGUIU" DE "PAROU". Este script é rodado à
// mão dentro de um roteiro de implantação, e um roteiro lê o código de saída,
// não a tela: até a revisão da Tarefa 9 ele saía 0 mesmo imprimindo "A MIGRAÇÃO
// NÃO FEZ EFEITO, pare e investigue", ou seja o passo seguinte da implantação
// rodava por cima de um esquema que não existia.
if (falhas) {
  console.log(
    `\n${falhas} confer${falhas === 1 ? "ência falhou" : "ências falharam"}. Saindo com código 1.`
  );
  process.exitCode = 1;
}

await sql.end();
