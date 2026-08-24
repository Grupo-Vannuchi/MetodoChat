// Aplica as migrações de esquema de `migrations/`, em ordem de nome.
//
// Uso:  node scripts/migrar.mjs            ← ENSAIO A SECO, só mostra o que faria
//       node scripts/migrar.mjs --aplicar  ← grava
//
// CÓDIGO DE SAÍDA: 0 quando toda coluna esperada existe com o tipo e o padrão
// esperados; 1 quando alguma confere errado — coluna ausente depois de aplicar,
// ou coluna presente com forma divergente. É o que um roteiro de implantação lê
// para decidir se segue ou para.
//
// -----------------------------------------------------------------------------
// POR QUE ELE EXISTE
//
// Hoje o esquema nasce dentro da aplicação: `ensureSchema` (lib/db.ts) roda 54
// comandos de DDL na primeira requisição de cada instância. Isso funciona, mas
// deixa o esquema AMARRADO AO DEPLOY — a estrutura só existe depois que o código
// novo sobe.
//
// A Fase 2a esbarrou nisso de frente. O motor novo precisa da coluna `ligacoes`
// PREENCHIDA para funcionar, e preencher exige que ela exista, e ela só existia
// depois do deploy — que é justamente o que não podia acontecer antes. Impasse.
//
// Este script quebra o impasse pela raiz: o esquema passa a poder ser preparado
// ANTES, por um passo próprio. É também a primeira parcela da mudança maior
// descrita em `docs/plans/2026-08-17-esquema-e-harness.md`.
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
import postgres from "postgres";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Espelha `limparUrl` de lib/db.ts: cada fornecedor inventa o seu parâmetro de
// URL (channel_binding no Neon, pgbouncer no Prisma), o postgres.js não conhece
// nenhum e os repassa ao servidor, que os recusa.
function limparUrl(url) {
  const u = new URL(url);
  for (const p of ["channel_binding", "pgbouncer"]) u.searchParams.delete(p);
  return u.toString();
}

const aplicar = process.argv.includes("--aplicar");
const url = readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const sql = postgres(limparUrl(url), { prepare: false, ssl: "require", max: 1, onnotice: () => {} });

console.log(aplicar ? "MODO: APLICANDO (grava no banco)\n" : "MODO: ENSAIO A SECO (nada é gravado)\n");

// Ordem por nome, e é por isso que os arquivos são numerados. Ordem alfabética
// de `001-`, `002-` … coincide com a ordem cronológica até 999 arquivos, o que
// é folga suficiente para este projeto.
const arquivos = readdirSync("migrations").filter((f) => f.endsWith(".sql")).sort();

if (!arquivos.length) {
  console.log("Nenhuma migração em `migrations/`.");
  await sql.end();
  process.exit(0);
}

for (const nome of arquivos) {
  const conteudo = readFileSync(join("migrations", nome), "utf8");

  // Só as linhas de comando, para o ensaio mostrar o que roda em vez de despejar
  // o comentário inteiro — que nestes arquivos costuma ser a maior parte.
  const comandos = conteudo
    .split("\n")
    .filter((l) => !l.trim().startsWith("--") && l.trim())
    .join("\n")
    .trim();

  if (!comandos) {
    console.log(`  ok   ${nome} — só comentário, nada a rodar`);
    continue;
  }

  if (!aplicar) {
    console.log(`  ►    ${nome}`);
    for (const l of comandos.split("\n")) console.log(`         ${l}`);
    continue;
  }

  await sql.unsafe(comandos);
  console.log(`  ✓    ${nome} — aplicada`);
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
