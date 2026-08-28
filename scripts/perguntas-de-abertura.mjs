// Perguntas de abertura (ice breakers) de uma conta conectada: ler, escrever, apagar.
//
// A REGRA DA META NÃO MORA MAIS AQUI. Ela saiu para `lib/perguntas-de-abertura.ts`
// quando a tela de Configuração passou a precisar das mesmas três chamadas — o
// `locale` obrigatório, o corpo do DELETE, a leitura de volta e o limite de
// quatro estão lá, com teste puro, e este script os IMPORTA. Duas cópias da
// mesma regra é a doença que esta base passou semanas curando.
//
// O `.mjs` importa um `.ts` e isso funciona sem passo de build: o `node` deste
// projeto (v24) apaga os tipos sozinho. É também o motivo de aquele módulo não
// ter NENHUM import — o `node` não resolve o atalho `@/` nem carrega
// `server-only`.
//
// O `node` avisa "MODULE_TYPELESS_PACKAGE_JSON" ao carregar aquele `.ts`, porque
// o package.json deste projeto não declara `type`. É só aviso, vai para o
// stderr, e a saída do script continua a mesma — pôr `"type": "module"` no
// package.json para calá-lo mudaria a resolução de TODO o projeto por causa de
// uma linha de log.
//
// POR QUE ESTE SCRIPT CONTINUA EXISTINDO, agora que há tela. Ele é o caminho
// que não depende de sessão aberta no painel, e é o único que APAGA o campo
// inteiro numa linha — o desfazer de emergência. A tela é para o dono; isto é
// para quem está consertando.
//
// ELAS APARECEM PARA TODO MUNDO. Escrever numa conta com automação real no ar
// muda o que os clientes dela veem ao abrir a conversa. Por isso o nome da
// conta é OBRIGATÓRIO: não há conta padrão, e não há "todas".
//
// Uso:
//   node scripts/perguntas-de-abertura.mjs --ler    <username>
//   node scripts/perguntas-de-abertura.mjs --apagar <username>
//   node scripts/perguntas-de-abertura.mjs --escrever <username> "Pergunta|payload" ...
//
// A DATABASE_URL sai do .env.local e o token sai do banco. Nenhum dos dois é
// impresso, em nenhum caminho.
import postgres from "postgres";
import { readFileSync } from "node:fs";
import {
  lerPerguntas,
  sincronizarPerguntas,
  MAXIMO_DE_PERGUNTAS,
} from "../lib/perguntas-de-abertura.ts";

// Cada fornecedor inventa o seu parâmetro de URL. Espelha o limparUrl de lib/db.ts.
function limparUrl(url) {
  const u = new URL(url);
  for (const p of ["channel_binding", "pgbouncer"]) u.searchParams.delete(p);
  return u.toString();
}

const [acao, username, ...resto] = process.argv.slice(2);
const ACOES = ["--ler", "--apagar", "--escrever"];
if (!ACOES.includes(acao) || !username) {
  console.error("uso: node scripts/perguntas-de-abertura.mjs --ler|--apagar|--escrever <username> [...]");
  process.exit(2);
}

const url = readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const sql = postgres(limparUrl(url), { prepare: false, ssl: "require", max: 1 });

const [conta] = await sql`select ig_user_id, username, access_token from accounts where username = ${username}`;
if (!conta) {
  console.error(`conta @${username} não está conectada neste install`);
  await sql.end();
  process.exit(1);
}

// A leitura de volta é o fim de TODO caminho, inclusive o de escrita, e quem
// garante isso agora é o módulo: os dois efeitos devolvem `leitura` junto.
function mostrarLeitura(l) {
  console.log(`GET @${conta.username} ->`, l.status, l.corpo);
}

if (acao === "--ler") {
  mostrarLeitura(await lerPerguntas(conta.ig_user_id, conta.access_token));
} else {
  // No `--apagar` a lista é vazia de propósito: `acaoDaEscrita` (no módulo)
  // traduz lista vazia em DELETE, que é a única forma de a conta ficar sem
  // pergunta nenhuma — a Meta recusa POST com `call_to_actions` vazio.
  //
  // Cada argumento do `--escrever` é "Pergunta|payload". Este pedaço é formato
  // de LINHA DE COMANDO, não regra da Meta, e por isso continua aqui.
  const perguntas =
    acao === "--apagar"
      ? []
      : resto.map((p) => {
          const [question, payload] = p.split("|");
          if (!question || !payload) throw new Error(`argumento fora do formato "Pergunta|payload": ${p}`);
          return { question, payload };
        });
  if (acao === "--escrever" && !perguntas.length) {
    throw new Error(`são de 1 a ${MAXIMO_DE_PERGUNTAS} perguntas — para zerar, use --apagar`);
  }
  const { efeito, motivo } = await sincronizarPerguntas(conta.ig_user_id, conta.access_token, perguntas);
  if (motivo) {
    console.error(motivo);
    await sql.end();
    process.exit(1);
  }
  console.log(`${acao === "--apagar" ? "DELETE" : "POST"} @${conta.username} ->`, efeito.status, efeito.corpo);
  mostrarLeitura(efeito.leitura);
}

await sql.end();
