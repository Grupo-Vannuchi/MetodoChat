// O SEXTO CAMINHO DA FRENTE 2: a PORTA DE ENTRADA.
//
// A PROMESSA, escrita como teste: **quem nunca falou com a conta toca numa
// pergunta de abertura e, sem digitar nada, VIRA CONTATO DAQUELA CONTA com a
// automação daquela pergunta rodando.**
//
// Ela é provada com o motor de verdade (`handleMessagingEvent`, lib/engine.ts)
// contra um banco de verdade (o schema descartável de `harness.ts`), e a prova é
// feita OLHANDO O QUE SAIU — a fila, a linha em `contacts` e a Atividade —, e
// nunca perguntando de novo à função que decidiu.
//
// -----------------------------------------------------------------------------
// O EVENTO É O QUE A PRODUÇÃO MEDIU, E NÃO O QUE A DOCUMENTAÇÃO PROMETE
//
// Desde 26/08/2026 o webhook grava como `webhook_messaging_nao_tratado` tudo que
// não cai num ramo conhecido, e foi assim que o experimento de primeiro contato
// capturou a forma real do toque numa pergunta de abertura:
//
//   {"sender":{"id":"..."},
//    "postback":{"mid":"...","title":"Quero saber mais","payload":"abertura-saber-mais"},
//    "recipient":{"id":"..."},"timestamp":...}
//
// É essa forma, campo por campo, que os casos abaixo entregam ao motor. Ela tem
// DUAS coisas que parecem o identificador e só uma é: o `title` é o TEXTO da
// pergunta, escrito por quem montou a tela, e o `payload` é o identificador. Ler
// o `title` "funcionaria" até alguém reescrever a pergunta — e é por isso que os
// dois são DIFERENTES em todo caso deste arquivo, de propósito.
//
// -----------------------------------------------------------------------------
// AS PERGUNTAS DE TESTE DA PRODUÇÃO NÃO PODEM VOLTAR A DISPARAR NADA
//
// As quatro perguntas que estão no ar hoje usam payload `abertura-...` — sem
// dois-pontos —, escolhido de propósito para que `lerPayload` (lib/steps.ts)
// devolva null e nada aconteça enquanto o ramo não existia. O ramo passou a
// existir, e essa escolha continua valendo: o segundo caso deste arquivo é a
// prova disso PELO MOTOR, e não só pela função pura (tests/steps.test.ts já
// segura o lado puro).
//
// -----------------------------------------------------------------------------
// DUAS CONTAS, E ELAS SÃO O CORAÇÃO DESTE ARQUIVO
//
// O schema tem a conta que recebe o toque e uma VIZINHA, criada ANTES dela (é a
// primeira de `listAccounts`, que ordena por `created_at asc`). A vizinha tem
// automação de abertura própria e já conhece a pessoa que vai tocar.
//
// Isso existe para uma coisa só: **criar o contato sem a conta certa atravessa
// contas**, e é o defeito mais grave que este caminho pode pegar. Com uma conta
// só no schema, "a conta certa" e "a única conta" são indistinguíveis, e todo
// erro de escopo passaria despercebido. Com duas, o erro tem para onde ir — e as
// afirmações abaixo perguntam ao banco QUAIS contas têm contato com aquele
// `ig_id`, e não se a conta esperada tem.
//
// -----------------------------------------------------------------------------
// NADA DE MOCK, E NADA SAI DA MÁQUINA
//
// Não há `vi.mock`, não há `vi.stubGlobal`, não há banco de mentira. O motor
// consulta o perfil de quem aparece pela primeira vez (`getUserProfile`), e essa
// consulta é HTTP de verdade — para um servidor desta máquina, pelo mesmo
// mecanismo dos outros caminhos: `IG_GRAPH_BASE` + `baseDoGraph()` (lib/ig.ts).
// A guarda que falha ANTES de qualquer requisição sair está no `beforeAll`,
// herdada dali.
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { bancoDescartavel } from "./harness";
// `lib/steps.ts` não tem import nenhum e não fala com o banco: pode ser
// importado no topo. Os módulos que tocam o banco (ou a rede) são importados
// dentro do `beforeAll`, depois de a DATABASE_URL estar pronta.
//
// `payloadDaPergunta` entra aqui como a ESCRITORA que a tela de Configuração vai
// usar para montar a pergunta na Meta — é o único lugar do produto que emite
// esta forma, e montar a string à mão aqui seria o teste concordando consigo
// mesmo sobre o formato.
import { payloadDaPergunta } from "@/lib/steps";

type ModuloEngine = typeof import("@/lib/engine");
type ModuloIg = typeof import("@/lib/ig");

const banco = bancoDescartavel();

// A VIZINHA nasce PRIMEIRO: `listAccounts` ordena por `created_at asc`, então
// ela é `accounts[0]`. Quem escrever "pega a conta da lista" em vez de "a conta
// do evento" cai nela, e o caso 3 fica vermelho.
const VIZINHA = "17800000000000111";
const CONTA = "17800000000000222";
// Valor inventado. Nenhuma credencial de verdade entra em teste.
const TOKEN = "token-de-teste-que-nao-vale-nada";

// ---------------------------------------------------------------------------
// A META FALSA — a outra ponta do fio, e nada além disso.
//
// Este caminho não envia mensagem: ele mede a FILA, que é onde o motor para. O
// único pedido que sai é o perfil de quem aparece pela primeira vez. Qualquer
// outro caminho volta 404, para que uma pergunta nova apareça na lista em vez de
// receber resposta inventada.
// ---------------------------------------------------------------------------

const meta = { desconhecidos: [] as string[] };

let servidor: Server;
let engine: ModuloEngine;
let ig: ModuloIg;

beforeAll(async () => {
  servidor = createServer((req, res) => {
    const u = new URL(req.url ?? "/", "http://127.0.0.1");
    const campos = u.searchParams.get("fields") ?? "";
    if (campos.includes("username")) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ username: "quem_abriu", name: "Quem abriu a conversa" }));
      return;
    }
    meta.desconhecidos.push(`${req.method} ${u.pathname}?${u.searchParams.toString()}`);
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: { message: `a Meta falsa não conhece ${u.pathname}` } }));
  });

  await new Promise<void>((pronto) => servidor.listen(0, "127.0.0.1", pronto));
  const porta = (servidor.address() as AddressInfo).port;
  process.env.IG_GRAPH_BASE = `http://127.0.0.1:${porta}`;

  engine = await import("@/lib/engine");
  ig = await import("@/lib/ig");

  // FALHA ANTES DE QUALQUER REQUISIÇÃO, e não depois — a mesma guarda dos outros
  // caminhos, pela mesma razão. Sem o desvio, o `getUserProfile` deste teste
  // sairia para `graph.instagram.com` com um token inventado.
  if (ig.baseDoGraph() !== process.env.IG_GRAPH_BASE) {
    throw new Error(
      `RECUSADO: a base do Graph é ${ig.baseDoGraph()}, e tinha de ser a desta ` +
        `rodada (${process.env.IG_GRAPH_BASE}). Sem o desvio, este teste falaria ` +
        `com a Meta de verdade.`
    );
  }

  // A ORDEM IMPORTA: a vizinha primeiro (ver o comentário da constante).
  await banco.db().upsertAccount({
    ig_user_id: VIZINHA,
    username: "conta_vizinha",
    name: "Conta vizinha",
    profile_picture_url: null,
    access_token: TOKEN,
    token_expires_at: null,
  });
  await banco.db().upsertAccount({
    ig_user_id: CONTA,
    username: "conta_da_porta",
    name: "Conta da porta de entrada",
    profile_picture_url: null,
    access_token: TOKEN,
    token_expires_at: null,
  });
});

afterAll(async () => {
  delete process.env.IG_GRAPH_BASE;
  await new Promise<void>((pronto) => servidor.close(() => pronto()));
});

// ---------------------------------------------------------------------------
// Semear e ler. Nada aqui decide nada: as decisões são todas do motor.
//
// `$n::text::jsonb`, e nunca `$n::jsonb` sobre string — a segunda forma grava um
// ESCALAR JSON e o motor registra `step_ignorado`. (O porquê inteiro está no
// primeiro caminho da Frente 2.)
// ---------------------------------------------------------------------------

/**
 * Uma automação de ABERTURA, gravada COMO A PRODUÇÃO GRAVA: `insert` cru na
 * tabela, com o gatilho `abertura`, ativa, e sem palavra-chave nenhuma — quem
 * dispara é o toque na pergunta, não texto.
 *
 * Nenhuma função de decisão participa da montagem, de propósito: um teste que
 * monta o cenário com as mesmas funções que testa concorda consigo mesmo.
 */
async function semearAbertura(
  contaId: string,
  nome: string,
  steps: unknown[]
): Promise<string> {
  const linhas = (await banco
    .db()
    .sql()
    .query(
      `insert into automations
         (account_id, name, active, triggers, keywords, match_type, steps, ligacoes)
       values ($1, $2, true, '{abertura}'::text[], '{}'::text[], 'any',
               $3::text::jsonb, '[]'::jsonb)
       returning id`,
      [contaId, nome, JSON.stringify(steps)]
    )) as { id: string }[];
  return linhas[0].id;
}

type LinhaDaFila = { kind: string; automation_id: string | null; payload: { text?: string } };

async function fila(contaId: string, contatoIgId: string): Promise<LinhaDaFila[]> {
  return (await banco
    .db()
    .sql()
    .query(
      `select kind, automation_id, payload from queue
        where account_id = $1 and contact_ig_id = $2
        order by created_at asc, id asc`,
      [contaId, contatoIgId]
    )) as LinhaDaFila[];
}

type LinhaDeContato = {
  account_id: string;
  last_automation_id: string | null;
  username: string | null;
  last_reply_at: Date | null;
};

/**
 * TODAS as linhas de `contacts` daquele `ig_id`, de QUALQUER conta, com a conta
 * junto. É a leitura que torna o defeito de escopo visível: perguntar
 * `where account_id = $conta` esconderia exatamente o erro que se procura.
 */
async function contatosDe(igId: string): Promise<LinhaDeContato[]> {
  return (await banco
    .db()
    .sql()
    .query(
      `select account_id, last_automation_id, username, last_reply_at
         from contacts where ig_id = $1 order by account_id asc`,
      [igId]
    )) as LinhaDeContato[];
}

async function eventos(contaId: string, tipo: string): Promise<Record<string, unknown>[]> {
  const linhas = (await banco
    .db()
    .sql()
    .query(
      `select payload from events where account_id = $1 and type = $2 order by created_at asc`,
      [contaId, tipo]
    )) as { payload: Record<string, unknown> }[];
  return linhas.map((l) => l.payload);
}

/**
 * O toque numa pergunta de abertura, na forma MEDIDA em produção — `postback` no
 * lugar de `message`, com `mid`, `title` e `payload`.
 *
 * O `title` e o `payload` são sempre DIFERENTES aqui, e é isso que separa "leu o
 * identificador" de "leu o texto da pergunta".
 */
async function tocarNaPergunta(
  contaId: string,
  igId: string,
  title: string,
  payload: string,
  mid: string
) {
  await engine.handleMessagingEvent(contaId, {
    sender: { id: igId },
    recipient: { id: contaId },
    timestamp: Date.now(),
    postback: { mid, title, payload },
  });
}

// ---------------------------------------------------------------------------

describe("a porta de entrada: o toque numa pergunta de abertura", () => {
  const BOAS_VINDAS = "Que bom te ver por aqui! 👋";
  const A_OUTRA = "Esta é a OUTRA porta desta conta.";
  const DA_VIZINHA = "Esta é a porta da conta VIZINHA.";

  let PRIMEIRA = "";
  let SEGUNDA = "";

  beforeAll(async () => {
    // DUAS automações de abertura na MESMA conta, e o toque é sempre na SEGUNDA.
    // Quem achar a automação pela POSIÇÃO na lista em vez do identificador cai
    // na primeira, e a fila mostra o texto errado.
    PRIMEIRA = await semearAbertura(CONTA, "A · a outra porta", [
      { id: "b_outra01", tipo: "dm", texto: A_OUTRA },
    ]);
    SEGUNDA = await semearAbertura(CONTA, "B · a porta tocada", [
      { id: "b_boasv01", tipo: "dm", texto: BOAS_VINDAS },
    ]);
    // E uma na VIZINHA, para que "a conta errada" tenha automação ativa e o erro
    // de escopo tenha para onde ir em vez de morrer por falta de candidata.
    await semearAbertura(VIZINHA, "C · porta da vizinha", [
      { id: "b_vizinh1", tipo: "dm", texto: DA_VIZINHA },
    ]);
    expect(PRIMEIRA).not.toBe(SEGUNDA);
  });

  test("tocar numa pergunta de abertura cria o contato e começa a automação", async () => {
    const QUEM_ABRIU = "9300000000000001";

    // A PESSOA NÃO EXISTE ANTES. Sem esta linha, "o contato existe" no fim não
    // diria nada — ele poderia já estar lá.
    expect(await contatosDe(QUEM_ABRIU)).toEqual([]);

    await tocarNaPergunta(
      CONTA,
      QUEM_ABRIU,
      // O TEXTO da pergunta, que é o que a pessoa leu na tela...
      "Quero saber mais",
      // ...e o IDENTIFICADOR dela, que é outra coisa. Quem escreve esta forma no
      // produto é `payloadDaPergunta`, e é dela que ela sai aqui.
      payloadDaPergunta(SEGUNDA),
      "mid-abertura-1"
    );

    // 1) A FILA GANHOU UMA ENTRADA, e é a da automação TOCADA.
    const naFila = await fila(CONTA, QUEM_ABRIU);
    expect(naFila.length).toBe(1);
    expect(naFila[0].automation_id).toBe(SEGUNDA);
    // `dm` de texto puro (sem url, sem botão) é `forma: "texto"` em `envioDaDm`,
    // e `enfileirarPasso` a enfileira como `dm_link`. O nome é herança: o que ele
    // discrimina no dreno é "DM comum", contra `dm_welcome` (que leva botões),
    // `private_reply` e `dm_follow_gate`.
    expect(naFila[0].kind).toBe("dm_link");
    expect(naFila[0].payload.text).toBe(BOAS_VINDAS);
    // E NÃO É A DA OUTRA PORTA DA MESMA CONTA. Sem esta linha, achar a automação
    // pela posição na lista passaria despercebido em metade dos casos.
    expect(naFila.map((l) => l.payload.text)).not.toContain(A_OUTRA);

    // 2) O CONTATO EXISTE, E NASCEU COM A CONTA CERTA — e a pergunta é feita ao
    //    banco sem filtrar por conta, para que o escopo errado apareça em vez de
    //    ser escondido pela própria consulta.
    const contatos = await contatosDe(QUEM_ABRIU);
    expect(contatos.length).toBe(1);
    expect(contatos[0].account_id).toBe(CONTA);
    // 3) COM A AUTOMAÇÃO APONTADA: é `last_automation_id` que faz o ramo de texto
    //    saber o que retomar quando a pessoa responder.
    expect(contatos[0].last_automation_id).toBe(SEGUNDA);
    // 4) E COM A JANELA DE 24h ABERTA. Não é enfeite: `processItem`
    //    (lib/queue-drain.ts) descarta como `skipped` toda DM comum fora da
    //    janela, então sem esta coluna o fluxo enfileira e não entrega nada.
    expect(contatos[0].last_reply_at).not.toBe(null);
    // O perfil foi buscado: quem abre a conversa não pode ficar salvo como um
    // número na lista de contatos.
    expect(contatos[0].username).toBe("quem_abriu");

    // 5) E O TOQUE FICOU EM ATIVIDADE como toque em botão — não como evento sem
    //    tratamento, que é onde ele caía antes deste ramo existir.
    expect(await eventos(CONTA, "webhook_messaging_nao_tratado")).toEqual([]);
    const tocou = await eventos(CONTA, "quick_reply");
    expect(tocou.length).toBe(1);
    expect((tocou[0].postback as { title?: string })?.title).toBe("Quero saber mais");

    expect(meta.desconhecidos).toEqual([]);
  });

  test("a pergunta de teste que está no ar (`abertura-...`) continua sem disparar nada", async () => {
    // As quatro perguntas de produção usam esta forma de propósito: sem
    // dois-pontos, `lerPayload` devolve null e nada acontece. O ramo novo não
    // pode ter mudado isso — e o que elas tinham de continuar fazendo é aparecer
    // no registro do webhook, que é onde o dono as observa.
    const CURIOSO = "9300000000000002";

    await tocarNaPergunta(CONTA, CURIOSO, "Quero saber mais", "abertura-saber-mais", "mid-inerte-1");

    expect(await fila(CONTA, CURIOSO)).toEqual([]);
    expect(await contatosDe(CURIOSO)).toEqual([]);

    const registrados = await eventos(CONTA, "webhook_messaging_nao_tratado");
    expect(registrados.length).toBe(1);
    expect((registrados[0].postback as { payload?: string })?.payload).toBe("abertura-saber-mais");
  });

  test("o contato nasce NA CONTA DO EVENTO, e não na vizinha que já o conhece", async () => {
    // O MESMO `ig_id` em duas contas é o caso normal do multi-conta: a mesma
    // pessoa fala com dois negócios diferentes. Aqui ela JÁ é contato da vizinha
    // — e é isso que dá ao erro de escopo um alvo plausível: um `upsert` sem a
    // conta acerta a linha que já existe, e o toque numa conta vira automação
    // rodando na OUTRA.
    const OS_DOIS = "9300000000000003";
    await banco
      .db()
      .sql()
      .query(
        `insert into contacts (account_id, ig_id, username) values ($1, $2, 'ja_conhecida')`,
        [VIZINHA, OS_DOIS]
      );

    await tocarNaPergunta(
      CONTA,
      OS_DOIS,
      "Quero saber mais",
      payloadDaPergunta(SEGUNDA),
      "mid-duas-contas-1"
    );

    // DUAS LINHAS, uma por conta, e cada uma com o seu.
    const contatos = await contatosDe(OS_DOIS);
    expect(contatos.map((c) => c.account_id).sort()).toEqual([VIZINHA, CONTA].sort());

    const naConta = contatos.find((c) => c.account_id === CONTA)!;
    const naVizinha = contatos.find((c) => c.account_id === VIZINHA)!;

    expect(naConta.last_automation_id).toBe(SEGUNDA);
    // A VIZINHA NÃO FOI TOCADA: nem automação, nem janela de 24h. Se esta linha
    // ficar vermelha, o produto está atravessando contas.
    expect(naVizinha.last_automation_id).toBe(null);
    expect(naVizinha.last_reply_at).toBe(null);

    // E a fila é da conta do evento, não da vizinha.
    expect((await fila(CONTA, OS_DOIS)).map((l) => l.payload.text)).toEqual([BOAS_VINDAS]);
    expect(await fila(VIZINHA, OS_DOIS)).toEqual([]);

    expect(meta.desconhecidos).toEqual([]);
  });
});
