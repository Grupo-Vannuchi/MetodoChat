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
// Não há tabela de controle registrando o que já foi aplicado — de propósito,
// por ora. Com `if not exists` em toda DDL, rodar duas vezes é inofensivo, e uma
// tabela de controle seria maquinário para um problema que ainda não existe.
//
// O PREÇO, escrito para não ser descoberto tarde: isto não serve para migração
// que MOVE DADO (renomear coluna preservando conteúdo, quebrar uma tabela em
// duas). Essas não são idempotentes por natureza e precisam de registro do que
// já rodou. **No dia em que aparecer a primeira, a tabela de controle vira
// obrigatória** — e este parágrafo é o aviso de que ela não existe.
//
// A ÚNICA LINHA DESTA PASTA QUE ESCREVE DADO é a semente de `config` em `000`, e
// ela cabe no contrato: `on conflict (id) do nothing` não lê, não altera e não
// apaga nada — só faz nascer a linha única quando não há nenhuma. O token dela é
// GERADO, e é por isso que a cláusula importa: rodar de novo não pode trocar o
// token de quem já está usando o sistema. Está medido, como asserção executada,
// em `testes-integracao/esquema-base.integracao.ts`.
import postgres from "postgres";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { comandosDoArquivo, somaDoTexto, decidirMigracoes } from "./migracoes.mjs";

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

const sql = postgres(limparUrl(urlDoBanco()), { prepare: false, ssl: "require", max: 1, onnotice: () => {} });

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

if (aplicar && !decisao.aplicar.length) {
  console.log(
    `\nNada a aplicar: as ${decisao.jaAplicadas.length} migrações já constam no registro.\n` +
      "NENHUMA DDL de esquema foi executada, então nenhuma trava foi pedida."
  );
}

for (const nome of decisao.aplicar) {
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
    tabela: "queue",
    nome: "queue_kind_check",
    de: "008-fila-tipo-lote.sql",
    definicao:
      "CHECK ((kind = ANY (ARRAY['private_reply'::text, 'comment_reply'::text, " +
      "'dm_welcome'::text, 'dm_link'::text, 'dm_reminder'::text, " +
      "'dm_follow_gate'::text, 'dm_email_ask'::text, 'story_reaction'::text, " +
      "'dm_manual'::text, 'dm_lote'::text])))",
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
