// Perguntas de abertura (ice breakers) de uma conta conectada: ler, escrever, apagar.
//
// POR QUE ISTO É UM SCRIPT, E NÃO UMA TELA.
//
// As perguntas de abertura são uma configuração GLOBAL da conta do Instagram —
// no máximo 4 para a conta inteira, e elas aparecem para toda pessoa que abrir
// a conversa. Não é objeto do produto, não pertence a automação nenhuma, e
// desenhar tela para isso agora seria decidir um produto que ainda não foi
// desenhado. Enquanto elas existirem só para o experimento de primeiro contato,
// o lugar certo é aqui: explícito, com o nome da conta na linha de comando, e
// desfazível numa linha.
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

const GRAPH = "https://graph.instagram.com/v25.0";

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
const token = encodeURIComponent(conta.access_token);

// A leitura de volta é o fim de TODO caminho, inclusive o de escrita: um 200 do
// POST diz que a Meta aceitou a chamada, não que a conta ficou como se queria.
async function ler() {
  const r = await fetch(`${GRAPH}/${conta.ig_user_id}/messenger_profile?fields=ice_breakers&access_token=${token}`);
  console.log(`GET @${conta.username} ->`, r.status, await r.text());
}

if (acao === "--ler") {
  await ler();
} else if (acao === "--apagar") {
  const r = await fetch(`${GRAPH}/${conta.ig_user_id}/messenger_profile?access_token=${token}`, {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fields: ["ice_breakers"] }),
  });
  console.log(`DELETE @${conta.username} ->`, r.status, await r.text());
  await ler();
} else {
  // Cada argumento é "Pergunta|payload". No máximo 4, e o limite é da Meta.
  const call_to_actions = resto.map((p) => {
    const [question, payload] = p.split("|");
    if (!question || !payload) throw new Error(`argumento fora do formato "Pergunta|payload": ${p}`);
    return { question, payload };
  });
  if (!call_to_actions.length || call_to_actions.length > 4) {
    throw new Error("são de 1 a 4 perguntas — o limite de 4 é da conta inteira, e é da Meta");
  }
  // O `locale` é OBRIGATÓRIO, e isso foi medido contra a API, não lido.
  // Sem ele a Meta responde 400, subcode 2534058: "os conjuntos de chaves dos
  // parâmetros de quebra-gelo devem ter o formato (question, payload) ou
  // (call_to_actions, locale)". A forma sem `locale`, que é a que a
  // documentação mostra, NÃO é aceita neste endpoint.
  const r = await fetch(`${GRAPH}/${conta.ig_user_id}/messenger_profile?access_token=${token}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      platform: "instagram",
      ice_breakers: [{ locale: "default", call_to_actions }],
    }),
  });
  console.log(`POST @${conta.username} ->`, r.status, await r.text());
  await ler();
}

await sql.end();
