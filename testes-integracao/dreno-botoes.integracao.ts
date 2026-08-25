// O SEGUNDO CAMINHO DA FRENTE 2: o dreno e os botões.
//
// A PROMESSA, escrita como teste: **os botões de uma mensagem chegam pareados —
// cada rótulo com o payload dele, e TODOS eles.**
//
// Ela é provada com o dreno de verdade (`drainQueue`, lib/queue-drain.ts) contra
// um banco de verdade (o schema descartável de `harness.ts`), e a prova é feita
// OLHANDO O FIO — o corpo JSON que chegou no servidor que faz as vezes da Meta —,
// e não o que uma função devolveu.
//
// -----------------------------------------------------------------------------
// POR QUE ESTE ARQUIVO EXISTE
//
// `lib/queue-drain.ts` é onde a fila vira mensagem no Instagram, e NENHUM teste
// do projeto o importava até esta linha. Ele já escondeu dois defeitos graves,
// os dois plantados por revisão e os dois invisíveis:
//
//   1. "o menu entrega só o primeiro botão" — 485/485 verdes
//   2. "rótulo e payload trocados no mapeamento final" — 671/671 verdes,
//      `tsc` limpo, `eslint` limpo
//
// O segundo é o que dói mais em produção e o que menos aparece: cada botão sairia
// com a string `AUTO:…` no lugar do rótulo e devolveria o rótulo do dono como
// payload. `lerPayload` recusaria, o toque não faria NADA — e NÃO haveria linha
// nenhuma em Atividade, nem `botao_sem_caminho`, porque nem se chega lá.
//
// A correção de cada um levou a decisão para a função pura (`botoesDaMensagem`,
// lib/steps.ts), o que apagou a linha em que a revisão plantava. Este teste não
// depende dessa geografia: ele mede a SAÍDA do dreno, então qualquer lugar em
// que a troca voltar a ser escrita — na função pura, no dreno, num terceiro
// arquivo que ainda não existe — cai aqui.
//
// -----------------------------------------------------------------------------
// A IDA E A VOLTA, que é a única forma honesta de provar pareamento
//
// Afirmar `title === rótulo` sozinho não prova pareamento: um teste que só olha
// os títulos passa com os payloads embaralhados entre si. Por isso o caso
// central faz o círculo inteiro:
//
//   o motor escreve os payloads  ->  o dreno os entrega no fio  ->  o payload é
//   LIDO DO FIO e devolvido ao motor como toque  ->  o braço que chega é o do
//   botão cujo RÓTULO prometia aquilo
//
// Nenhuma string é montada à mão no meio do caminho. É o mesmo princípio do
// primeiro caminho (`portao-link.integracao.ts`), levado até o outro lado.
//
// -----------------------------------------------------------------------------
// NADA DE MOCK, E NADA SAI DA MÁQUINA
//
// Não há `vi.mock`, não há `vi.stubGlobal`, não há banco de mentira. O `fetch` é
// o do Node, o POST é HTTP de verdade, o corpo é serializado pelo `sendMessage`
// de verdade e parseado do outro lado. O que foi substituído é a OUTRA PONTA DO
// FIO, pelo mesmo mecanismo que o primeiro caminho criou: `IG_GRAPH_BASE` +
// `baseDoGraph()` (lib/ig.ts), com as duas travas dele. A guarda que falha ANTES
// de qualquer requisição sair está no `beforeAll`, herdada dali.
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { bancoDescartavel } from "./harness";
// `lib/steps.ts` não tem import nenhum e não fala com o banco: pode ser
// importado no topo. Os módulos que tocam o banco (ou a rede) são importados
// dentro do `beforeAll`, depois de a DATABASE_URL estar pronta.
import { LIMITE_DE_BOTOES, lerPayload, payloadDoBotao } from "@/lib/steps";

type ModuloEngine = typeof import("@/lib/engine");
type ModuloIg = typeof import("@/lib/ig");
type ModuloDreno = typeof import("@/lib/queue-drain");

const banco = bancoDescartavel();

const CONTA = "17800000000000456";
// Valor inventado. Nenhuma credencial de verdade entra em teste — e o servidor
// que faz as vezes da Meta confere que foi ESTE token que chegou nele.
const TOKEN = "token-de-teste-que-nao-vale-nada";

// ---------------------------------------------------------------------------
// A META FALSA — a outra ponta do fio, e nada além disso.
//
// Ela guarda o corpo de cada POST /{conta}/messages, que é o objeto que o
// produto realmente entregaria ao Instagram. Qualquer outro caminho volta 404,
// para que uma pergunta nova apareça na lista em vez de receber resposta
// inventada.
// ---------------------------------------------------------------------------

type MensagemNoFio = {
  destinatario: { id?: string; comment_id?: string };
  texto: string;
  botoes: { content_type: string; title: string; payload: string }[];
  temQuickReplies: boolean;
  autorizacao: string | null;
  caminho: string;
};

const meta = {
  enviadas: [] as MensagemNoFio[],
  desconhecidos: [] as string[],
};

function doDestinatario(m: MensagemNoFio): string {
  return m.destinatario.id ?? m.destinatario.comment_id ?? "";
}

let servidor: Server;
let engine: ModuloEngine;
let ig: ModuloIg;
let dreno: ModuloDreno;

beforeAll(async () => {
  servidor = createServer((req, res) => {
    const u = new URL(req.url ?? "/", "http://127.0.0.1");
    const responder = (corpo: unknown) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(corpo));
    };

    // O envio de mensagem: é este corpo que o teste inteiro examina.
    if (req.method === "POST" && u.pathname.endsWith("/messages")) {
      const pedacos: Buffer[] = [];
      req.on("data", (d: Buffer) => pedacos.push(d));
      req.on("end", () => {
        const corpo = JSON.parse(Buffer.concat(pedacos).toString("utf8")) as {
          recipient: { id?: string; comment_id?: string };
          message: {
            text?: string;
            quick_replies?: { content_type: string; title: string; payload: string }[];
          };
        };
        meta.enviadas.push({
          destinatario: corpo.recipient,
          texto: corpo.message.text ?? "",
          botoes: corpo.message.quick_replies ?? [],
          // Separado do array vazio de propósito: `quick_replies: []` é a forma
          // malformada que faz a Meta recusar a mensagem inteira, e o dreno tem
          // uma decisão escrita sobre não emiti-la. Um teste que só olhasse
          // `botoes.length` não distinguiria "sem botão" de "lista vazia".
          temQuickReplies: Object.prototype.hasOwnProperty.call(corpo.message, "quick_replies"),
          autorizacao: req.headers.authorization ?? null,
          caminho: u.pathname,
        });
        responder({ message_id: `mid-do-teste-${meta.enviadas.length}`, recipient_id: "r-1" });
      });
      return;
    }

    // O perfil de quem mandou a DM (`getUserProfile`), na primeira mensagem de
    // cada pessoa.
    if ((u.searchParams.get("fields") ?? "").includes("username")) {
      return responder({ username: "pessoa_de_teste", name: "Pessoa de teste" });
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
  dreno = await import("@/lib/queue-drain");

  // FALHA ANTES DE QUALQUER REQUISIÇÃO, e não depois — a mesma guarda do
  // primeiro caminho, pela mesma razão. Sem o desvio, o `sendMessage` deste
  // teste sairia para `graph.instagram.com` com um token inventado E COM O TEXTO
  // DAS MENSAGENS: aqui não é só uma consulta, é uma tentativa de ENVIO.
  if (ig.baseDoGraph() !== process.env.IG_GRAPH_BASE) {
    throw new Error(
      `RECUSADO: a base do Graph é ${ig.baseDoGraph()}, e tinha de ser a desta ` +
        `rodada (${process.env.IG_GRAPH_BASE}). Sem o desvio, este teste tentaria ` +
        `ENVIAR MENSAGEM pela Meta de verdade.`
    );
  }

  await banco.db().upsertAccount({
    ig_user_id: CONTA,
    username: "conta_do_dreno",
    name: "Conta do dreno",
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
// Semear e ler. Nada aqui decide nada.
// ---------------------------------------------------------------------------

// `$n::text::jsonb`, e nunca `$n::jsonb` sobre string — a segunda forma grava um
// ESCALAR JSON e o motor registra `step_ignorado`. (O porquê inteiro está no
// primeiro caminho.)
async function semear(
  nome: string,
  palavra: string,
  steps: unknown[],
  ligacoes: unknown[]
): Promise<string> {
  const linhas = (await banco
    .db()
    .sql()
    .query(
      `insert into automations
         (account_id, name, active, triggers, keywords, match_type, steps, ligacoes)
       values ($1, $2, true, '{dm}'::text[], string_to_array($3, ','), 'contains',
               $4::text::jsonb, $5::text::jsonb)
       returning id`,
      [CONTA, nome, palavra, JSON.stringify(steps), JSON.stringify(ligacoes)]
    )) as { id: string }[];
  return linhas[0].id;
}

async function fila(contatoIgId: string) {
  return (await banco
    .db()
    .sql()
    .query(
      `select kind, status, payload from queue
        where account_id = $1 and contact_ig_id = $2
        order by created_at asc, id asc`,
      [CONTA, contatoIgId]
    )) as { kind: string; status: string; payload: Record<string, unknown> }[];
}

// Devolve os PAYLOADS das linhas de Atividade deste tipo, na ordem em que foram
// gravadas — é o payload que carrega o número que cada caso afirma.
async function eventos(tipo: string): Promise<Record<string, unknown>[]> {
  const linhas = (await banco
    .db()
    .sql()
    .query(
      `select payload from events where account_id = $1 and type = $2 order by created_at asc`,
      [CONTA, tipo]
    )) as { payload: Record<string, unknown> }[];
  return linhas.map((l) => l.payload);
}

// Uma mensagem de texto chegando pelo webhook, como a Meta a entrega. Ela também
// é o que ABRE A JANELA DE 24H: `handleMessagingEvent` grava `last_reply_at`, e
// sem ela o dreno descartaria tudo como `skipped`.
async function mensagem(igId: string, texto: string, mid: string) {
  await engine.handleMessagingEvent(CONTA, { sender: { id: igId }, message: { mid, text: texto } });
}

// Um toque em botão de resposta rápida, como a Meta o entrega.
async function toque(igId: string, payload: string, mid: string) {
  await engine.handleMessagingEvent(CONTA, {
    sender: { id: igId },
    message: { mid, text: "", quick_reply: { payload } },
  });
}

// O que chegou no fio para ESTA pessoa. Filtrar por destinatário é o que deixa
// os casos independentes: `drainQueue` esvazia a fila INTEIRA, então um caso
// pode acabar entregando item que outro deixou pendente.
function noFio(igId: string): MensagemNoFio[] {
  return meta.enviadas.filter((m) => doDestinatario(m) === igId);
}

// ---------------------------------------------------------------------------

describe("o dreno entrega os botões pareados", () => {
  test("TRÊS BOTÕES: os três chegam, na ordem, cada rótulo com o payload dele", async () => {
    const BOTOES = [
      { id: "op_guia01", rotulo: "Quero o guia" },
      { id: "op_plani2", rotulo: "Quero a planilha" },
      { id: "op_ambos3", rotulo: "Quero os dois" },
    ];
    const AUTO = await semear(
      "A · menu de três botões",
      "quero-menu",
      [
        { id: "b_menuuuu", tipo: "dm", texto: "Escolhe aí:", botoes: BOTOES },
        { id: "b_guiaaaa", tipo: "dm", texto: "Aqui está o guia." },
        { id: "b_planilh", tipo: "dm", texto: "Aqui está a planilha." },
        { id: "b_ambosss", tipo: "dm", texto: "Aqui estão os dois." },
      ],
      [
        { de: "b_menuuuu", quando: { tipo: "botao", botao: "op_guia01" }, para: "b_guiaaaa" },
        { de: "b_menuuuu", quando: { tipo: "botao", botao: "op_plani2" }, para: "b_planilh" },
        { de: "b_menuuuu", quando: { tipo: "botao", botao: "op_ambos3" }, para: "b_ambosss" },
      ]
    );
    const EU = "9100000000000001";

    await mensagem(EU, "quero-menu", "m-menu-1");
    expect((await fila(EU)).map((l) => l.kind)).toEqual(["dm_welcome"]);

    // O DRENO DE VERDADE. Daqui para baixo, tudo o que o teste olha é o que
    // chegou no fio.
    const resultado = await dreno.drainQueue();
    expect(resultado.sent).toBeGreaterThanOrEqual(1);

    const entregues = noFio(EU);
    expect(entregues.length).toBe(1);
    const msg = entregues[0];

    // Foi para a conta certa, com o token da conta, e para a pessoa certa.
    expect(msg.caminho).toBe(`/${ig.API_VERSION}/${CONTA}/messages`);
    expect(msg.autorizacao).toBe(`Bearer ${TOKEN}`);
    expect(msg.destinatario).toEqual({ id: EU });
    expect(msg.texto).toBe("Escolhe aí:");

    // OS TRÊS CHEGARAM. Este é o defeito nº 1 desta fase — "o menu entrega só o
    // primeiro botão" — e ele mora nesta linha.
    expect(msg.botoes.length).toBe(3);

    // CADA RÓTULO COM O PAYLOAD DELE. Afirmar o par INTEIRO de uma vez, e não
    // dois arrays em separado: comparar só os títulos passaria com os payloads
    // embaralhados entre si.
    expect(msg.botoes).toEqual(
      BOTOES.map((b) => ({
        content_type: "text",
        title: b.rotulo,
        payload: payloadDoBotao(AUTO, "b_menuuuu", b.id),
      }))
    );

    // O PAYLOAD DE QUATRO PARTES, ÍNTEGRO NO FIO, e `lerPayload` o entendendo de
    // volta — não a string que o teste montou, a que o dreno entregou.
    msg.botoes.forEach((b, i) => {
      expect(b.payload.split(":").length).toBe(4);
      expect(lerPayload(b.payload)).toEqual({
        prefixo: "AUTO",
        automationId: AUTO,
        passoId: "b_menuuuu",
        botaoId: BOTOES[i].id,
      });
    });

    // A VOLTA, e é ela que fecha o pareamento: o payload do TERCEIRO botão é
    // lido DO FIO e devolvido ao motor como toque. O braço que chega tem de ser
    // o que o RÓTULO do terceiro botão prometia.
    //
    // O terceiro, e não o primeiro, de propósito: com "só o primeiro botão" ele
    // nem existiria no fio, e com rótulo e payload trocados `lerPayload`
    // devolveria null e o toque não faria NADA — sem linha em Atividade, que é
    // o que torna esse defeito mudo.
    await toque(EU, msg.botoes[2].payload, "m-menu-2");
    const depois = await fila(EU);
    expect(depois.map((l) => l.payload.text)).toEqual(["Escolhe aí:", "Aqui estão os dois."]);

    // E O PRIMEIRO BOTÃO LEVA AO BRAÇO DELE, não ao mesmo lugar: sem este
    // vizinho, um dreno que entregasse o MESMO payload em todos os botões
    // passaria na afirmação de cima.
    const OUTRA = "9100000000000002";
    await mensagem(OUTRA, "quero-menu", "m-menu-3");
    await dreno.drainQueue();
    const dela = noFio(OUTRA);
    expect(dela.length).toBe(1);
    expect(dela[0].botoes.map((b) => b.title)).toEqual(BOTOES.map((b) => b.rotulo));
    await toque(OUTRA, dela[0].botoes[0].payload, "m-menu-4");
    expect((await fila(OUTRA)).map((l) => l.payload.text)).toEqual([
      "Escolhe aí:",
      "Aqui está o guia.",
    ]);

    // Nenhuma pergunta caiu no 404: tudo o que este caminho pediu, a Meta falsa
    // conhecia — ou seja, nada saiu desta máquina por um caminho não previsto.
    expect(meta.desconhecidos).toEqual([]);
  });

  test("O LIMITE DE 13: o dreno corta, entrega os 13 primeiros e REGISTRA o corte", async () => {
    // 15 botões numa fila que já existe. A forma de chegar aqui é a que está
    // escrita no próprio dreno: `queue.payload` é `jsonb`, editável por fora do
    // painel e sobrevivente a restauração de backup. Desde a Tarefa 5,
    // `conferirLista` recusa ATIVAR um bloco com mais de 13 botões — então esta
    // é a porta que sobra, e é justamente a que o dreno diz defender.
    const AUTO = await semear(
      "B · o teto da Meta",
      "quero-teto",
      [{ id: "b_tetoooo", tipo: "dm", texto: "Escolhe uma:" }],
      []
    );
    const EU = "9100000000000003";
    const QUANTOS = 15;
    const rotulos = Array.from({ length: QUANTOS }, (_, i) => `Opção ${i + 1}`);
    const payloads = rotulos.map((_, i) => payloadDoBotao(AUTO, "b_tetoooo", `op_n${i + 1}`));

    // A janela de 24h precisa estar aberta: quem a abre é uma mensagem da pessoa.
    await mensagem(EU, "oi", "m-teto-0");

    await banco
      .db()
      .sql()
      .query(
        `insert into queue (account_id, kind, contact_ig_id, automation_id, payload, dedupe_key)
         values ($1, 'dm_welcome', $2, $3, $4, $5)`,
        [
          CONTA,
          EU,
          AUTO,
          // Cru, não `JSON.stringify`: o driver tipa o parâmetro como json
          // sozinho, e a string pré-serializada viraria ESCALAR json (o mesmo
          // motivo escrito em `logEvent`, lib/engine.ts).
          { text: "Escolhe uma:", quick_reply_labels: rotulos, quick_reply_payloads: payloads },
          `teste-teto-${EU}`,
        ]
      );

    await dreno.drainQueue();

    const entregues = noFio(EU);
    expect(entregues.length).toBe(1);
    const msg = entregues[0];

    // O DRENO TEM ALGO A DIZER SOBRE EXCEDER, e são duas coisas.
    //
    // PRIMEIRA: ele corta. Chegam 13, e são os 13 PRIMEIROS, cada um ainda
    // pareado com o payload dele — o corte não pode embaralhar o que sobrou.
    expect(LIMITE_DE_BOTOES).toBe(13);
    expect(msg.botoes.length).toBe(LIMITE_DE_BOTOES);
    expect(msg.botoes).toEqual(
      rotulos.slice(0, LIMITE_DE_BOTOES).map((r, i) => ({
        content_type: "text",
        title: r,
        payload: payloads[i],
      }))
    );
    // e os dois de baixo NÃO chegaram — quem só chegaria por eles não recebe nada
    expect(msg.botoes.some((b) => b.title === "Opção 14")).toBe(false);
    expect(msg.botoes.some((b) => b.title === "Opção 15")).toBe(false);

    // SEGUNDA, e é a que faz o corte não ser mudo: uma linha em Atividade, com o
    // total e o limite. Botão que some da mensagem sem registro é o defeito que
    // esta fase inteira passou fechando.
    const cortes = await eventos("quick_replies_cortados");
    expect(cortes.length).toBe(1);
    expect(cortes[0].total).toBe(QUANTOS);
    expect(cortes[0].limite).toBe(LIMITE_DE_BOTOES);
    expect(cortes[0].automation_id).toBe(AUTO);

    // O item foi mesmo entregue, e não abandonado: a fila diz `sent`.
    expect((await fila(EU)).map((l) => l.status)).toEqual(["sent"]);
  });

  test("MENU INTEIRAMENTE DESCARTADO sai como TEXTO PURO, e com linha em Atividade", async () => {
    // O caso que o dreno decide sozinho, e que só se prova no fio: com todos os
    // rótulos em branco, ele NÃO manda `quick_replies: []` — essa lista vazia é
    // a forma malformada que faria a Meta recusar a MENSAGEM INTEIRA, e aí nem o
    // texto chegaria. Ele manda só o texto, e registra dois eventos: os
    // descartes e o menu que sobrou vazio.
    const AUTO = await semear(
      "C · menu sem rótulo",
      "quero-vazio",
      [{ id: "b_vazioaa", tipo: "dm", texto: "Escolhe:" }],
      []
    );
    const EU = "9100000000000004";
    await mensagem(EU, "oi", "m-vazio-0");
    await banco
      .db()
      .sql()
      .query(
        `insert into queue (account_id, kind, contact_ig_id, automation_id, payload, dedupe_key)
         values ($1, 'dm_welcome', $2, $3, $4, $5)`,
        [
          CONTA,
          EU,
          AUTO,
          {
            text: "Escolhe:",
            quick_reply_labels: ["", "   "],
            quick_reply_payloads: [
              payloadDoBotao(AUTO, "b_vazioaa", "op_um0001"),
              payloadDoBotao(AUTO, "b_vazioaa", "op_dois02"),
            ],
          },
          `teste-vazio-${EU}`,
        ]
      );

    await dreno.drainQueue();

    const msg = noFio(EU)[0];
    expect(msg.texto).toBe("Escolhe:");
    expect(msg.botoes).toEqual([]);
    // A distinção que importa: o campo NÃO FOI ENVIADO. Não é lista vazia.
    expect(msg.temQuickReplies).toBe(false);

    const descartes = await eventos("quick_replies_sem_rotulo");
    expect(descartes.length).toBe(1);
    expect(descartes[0].descartados).toBe(2);

    const vazios = await eventos("menu_sem_botoes");
    expect(vazios.length).toBe(1);
    expect(vazios[0].pareados).toBe(0);
    expect(vazios[0].contact_ig_id).toBe(EU);
  });

  test("A FORMA SINGULAR continua entregue, e as três formas de payload convivem", async () => {
    // Um botão só, pela forma SINGULAR do payload (`quick_reply_label` /
    // `quick_reply_payload`), que é o caminho mais comum do produto e continua
    // vivo ao lado do plural — item enfileirado antes da Tarefa 4 tem só esta
    // forma, e a fila não foi migrada. O payload dela tem TRÊS partes.
    const AUTO = await semear(
      "D · um botão só",
      "quero-um",
      [
        { id: "b_unicooo", tipo: "dm", texto: "Vamos?", botao_label: "Quero!" },
        { id: "b_destino", tipo: "dm", texto: "Então toma." },
      ],
      [{ de: "b_unicooo", quando: { tipo: "sempre" }, para: "b_destino" }]
    );
    const EU = "9100000000000005";
    await mensagem(EU, "quero-um", "m-um-1");
    await dreno.drainQueue();

    const msg = noFio(EU)[0];
    expect(msg.botoes).toEqual([
      { content_type: "text", title: "Quero!", payload: `AUTO:${AUTO}:b_unicooo` },
    ]);
    // TRÊS partes, e `lerPayload` a lê sem botão — a forma da Fase 1b, que
    // convive com a de quatro para sempre.
    expect(lerPayload(msg.botoes[0].payload)).toEqual({
      prefixo: "AUTO",
      automationId: AUTO,
      passoId: "b_unicooo",
      botaoId: null,
    });

    // E o toque com o payload LIDO DO FIO segue a seta `sempre` do bloco.
    await toque(EU, msg.botoes[0].payload, "m-um-2");
    expect((await fila(EU)).map((l) => l.payload.text)).toEqual(["Vamos?", "Então toma."]);
  });
});
