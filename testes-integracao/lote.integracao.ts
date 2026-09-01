// O QUINTO CAMINHO DA FRENTE 2: o motor ESPERANDO em vez de descartando.
//
// A PROMESSA, escrita como teste: **quem está fora da janela de 24h não perde a
// mensagem do lote — ela fica guardada até a pessoa voltar a falar.**
//
// -----------------------------------------------------------------------------
// O DEFEITO QUE ESTE ARQUIVO EXISTE PARA NÃO DEIXAR VOLTAR
//
// A primeira versão deste plano guardava o item com `not_before` no passado. A
// seleção do dreno é `status = 'pending' and not_before <= now()`, `order by
// created_at`, `limit 15` (lib/queue-drain.ts) — e um item assim é sempre
// elegível e é o mais antigo. Com muita gente esperando, todo dreno pegaria os
// mais velhos, veria a janela fechada, os devolveria à fila — e nunca chegaria
// nas mensagens de verdade. O produto pararia de responder, e a causa estaria
// escondida atrás de um recurso novo. O caso "vinte itens guardados" mede
// exatamente isto: mede que não é assim, e vermelho se voltar a ser.
//
// -----------------------------------------------------------------------------
// A FORMA É A DE `portao-link.integracao.ts` — leia aquele cabeçalho primeiro
//
// O mesmo servidor HTTP na própria máquina, a mesma `IG_GRAPH_BASE` presa ao
// loopback por `baseDoGraph()` (lib/ig.ts), com as duas travas dele. A guarda
// que falha ANTES de qualquer requisição sair está no `beforeAll`, herdada de
// lá — este arquivo não duplica o teste dedicado às duas travas porque ele já
// prova o mecanismo uma vez; duplicá-lo em cada arquivo que o usa não
// acrescentaria cobertura nova, só repetição (mesma escolha de
// `gatilho-entrega.integracao.ts` e `dreno-botoes.integracao.ts`).
//
// E há a MESMA segunda fronteira que `gatilho-entrega` já documentou:
// `drainQueue` chama `scheduleTick` (lib/qstash.ts) quando sobra item pendente
// — e este arquivo deixa muitos pendentes, de propósito. Ela não passa pelo
// desvio do Graph; quem a segura é `qstashEnabled()`, falso sem `QSTASH_TOKEN` —
// o `beforeAll` apaga a variável em vez de supor que não existe.
//
// -----------------------------------------------------------------------------
// "A PESSOA VOLTA A FALAR" É O MOTOR DE VERDADE, NÃO UM UPDATE ESCRITO AQUI
//
// `abrirJanela` chama `engine.handleMessagingEvent` com uma mensagem de texto —
// o mesmo caminho que a Meta aciona de verdade. Isso importa porque o
// DESPERTAR do item de lote (o `update queue set not_before = now()`) mora
// DENTRO de `upsertContact` (lib/engine.ts), uma função que este arquivo não
// importa e não pode chamar direto. Se `abrirJanela` reescrevesse a lógica do
// despertar aqui — em vez de provocá-la —, o Plantio 3 (apagar aquele `update`
// de `upsertContact`) NÃO deixaria caso nenhum vermelho: o teste estaria
// medindo a cópia, não o original. Chamar o motor de verdade é o que torna o
// plantio detectável.
//
// O contato já nasce com `username` preenchido (`semearContato`), então esta
// chamada não busca perfil na Meta — `fetchProfileFields` (lib/engine.ts) pula
// a rede quando o username já é conhecido. Nada sai da máquina neste passo.
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { bancoDescartavel } from "./harness";

type ModuloEngine = typeof import("@/lib/engine");
type ModuloIg = typeof import("@/lib/ig");
type ModuloDreno = typeof import("@/lib/queue-drain");

const banco = bancoDescartavel();

const CONTA = "17800000000000789";
// Valor inventado. Nenhuma credencial de verdade entra em teste — e o servidor
// falso confere que foi ESTE token que chegou nele.
const TOKEN = "token-de-teste-que-nao-vale-nada";

// ---------------------------------------------------------------------------
// A META FALSA — a outra ponta do fio, e nada além disso.
//
// Só o envio de mensagem importa a este arquivo: os contatos já nascem com
// `username`, então a busca de perfil nunca é chamada. Qualquer caminho fora
// disso volta 404, para que um pedido inesperado apareça na lista em vez de
// receber resposta inventada.
// ---------------------------------------------------------------------------

const meta = {
  enviadas: [] as { destinatario: string; texto: string; caminho: string }[],
  desconhecidos: [] as string[],
};

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

    if (req.method === "POST" && u.pathname.endsWith("/messages")) {
      const pedacos: Buffer[] = [];
      req.on("data", (d: Buffer) => pedacos.push(d));
      req.on("end", () => {
        const corpo = JSON.parse(Buffer.concat(pedacos).toString("utf8")) as {
          recipient: { id?: string };
          message: { text?: string };
        };
        meta.enviadas.push({
          destinatario: corpo.recipient.id ?? "",
          texto: corpo.message.text ?? "",
          caminho: u.pathname,
        });
        responder({ message_id: `mid-do-teste-${meta.enviadas.length}`, recipient_id: "r-1" });
      });
      return;
    }

    // Perfil, só por segurança: nenhum caso deste arquivo deveria alcançar
    // aqui, porque todo contato já nasce com `username`.
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
  // A SEGUNDA FRONTEIRA (ver o cabeçalho): sem token, `scheduleTick` não sai.
  delete process.env.QSTASH_TOKEN;

  engine = await import("@/lib/engine");
  ig = await import("@/lib/ig");
  dreno = await import("@/lib/queue-drain");

  // FALHA ANTES DE QUALQUER REQUISIÇÃO, e não depois — a mesma guarda de
  // `portao-link.integracao.ts`, pela mesma razão.
  if (ig.baseDoGraph() !== process.env.IG_GRAPH_BASE) {
    throw new Error(
      `RECUSADO: a base do Graph é ${ig.baseDoGraph()}, e tinha de ser a desta ` +
        `rodada (${process.env.IG_GRAPH_BASE}). Sem o desvio, este teste tentaria ` +
        `ENVIAR pela Meta de verdade.`
    );
  }

  await banco.db().upsertAccount({
    ig_user_id: CONTA,
    username: "conta_do_lote",
    name: "Conta do lote",
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
// ---------------------------------------------------------------------------

// O contato nasce com `last_reply_at` no passado — `horasDesdeAResposta` horas
// atrás — e já com `username`, para nenhum caso precisar de rede.
async function semearContato(igId: string, opts: { horasDesdeAResposta: number }) {
  await banco
    .db()
    .sql()
    .query(
      `insert into contacts (account_id, ig_id, username, last_reply_at)
       values ($1, $2, 'pessoa_de_teste', now() - make_interval(hours => $3::int))
       on conflict (account_id, ig_id) do update set last_reply_at = excluded.last_reply_at`,
      [CONTA, igId, opts.horasDesdeAResposta]
    );
}

// A pessoa volta a falar. Passa pelo `engine.handleMessagingEvent` de verdade —
// o mesmo caminho que a Meta aciona — e não por um `update` escrito aqui: é o
// que faz o Plantio 3 (apagar o despertar de `upsertContact`) alcançável.
async function abrirJanela(igId: string) {
  await engine.handleMessagingEvent(CONTA, {
    sender: { id: igId },
    message: { mid: `abrir-${igId}-${Date.now()}`, text: "oi de novo" },
  });
}

async function drenar() {
  return dreno.drainQueue();
}

async function estadoDoItem(igId: string): Promise<string> {
  const linhas = (await banco
    .db()
    .sql()
    .query(
      `select status from queue where account_id = $1 and contact_ig_id = $2
        order by created_at desc, id desc limit 1`,
      [CONTA, igId]
    )) as { status: string }[];
  return linhas[0]?.status ?? "(sem item)";
}

async function lerItem(igId: string): Promise<{ status: string; error: string | null }> {
  const linhas = (await banco
    .db()
    .sql()
    .query(
      `select status, error from queue where account_id = $1 and contact_ig_id = $2
        order by created_at desc, id desc limit 1`,
      [CONTA, igId]
    )) as { status: string; error: string | null }[];
  return linhas[0];
}

async function todosOsItens(
  igId: string
): Promise<{ status: string; payload: Record<string, unknown>; error: string | null }[]> {
  return (await banco
    .db()
    .sql()
    .query(
      `select status, payload, error from queue where account_id = $1 and contact_ig_id = $2
        order by created_at asc, id asc`,
      [CONTA, igId]
    )) as { status: string; payload: Record<string, unknown>; error: string | null }[];
}

async function enviadasPara(igId: string): Promise<number> {
  const linhas = (await banco
    .db()
    .sql()
    .query(
      `select count(*)::int as n from queue
        where account_id = $1 and contact_ig_id = $2 and status = 'sent'`,
      [CONTA, igId]
    )) as { n: number }[];
  return linhas[0].n;
}

// ---------------------------------------------------------------------------

describe("o item de lote espera a janela em vez de ser descartado", () => {
  test("item de lote com a janela FECHADA fica guardado, e sai quando ela abre", async () => {
    const CONTATO = "9000000000000101";
    await semearContato(CONTATO, { horasDesdeAResposta: 48 });

    await engine.enqueueLote(CONTA, "L1", [CONTATO], {
      text: "A turma abre segunda",
      validoAte: null,
    });

    // Primeiro dreno: a janela está fechada.
    await drenar();
    expect(await estadoDoItem(CONTATO)).toBe("pending");
    expect(await enviadasPara(CONTATO)).toBe(0);

    // A pessoa volta a falar — é isto que o webhook faz antes de drenar.
    await abrirJanela(CONTATO);

    // Segundo dreno: agora sai.
    await drenar();
    expect(await estadoDoItem(CONTATO)).toBe("sent");
    expect(await enviadasPara(CONTATO)).toBe(1);
  });

  // O CONTROLE QUE IMPEDE A PROVA DE SER VAZIA: o mesmo cenário com um tipo que
  // NÃO é lote continua sendo descartado. Sem este caso, "o item ficou pending"
  // não distingue "o lote espera" de "o dreno parou de descartar tudo".
  test("item que NÃO é lote continua sendo descartado na mesma situação", async () => {
    const CONTATO = "9000000000000102";
    await semearContato(CONTATO, { horasDesdeAResposta: 48 });
    await engine.enqueueManualReply(CONTA, CONTATO, "resposta escrita a mao");

    await drenar();
    expect(await estadoDoItem(CONTATO)).toBe("skipped");
  });

  test("lote vencido é cancelado em vez de sair atrasado", async () => {
    const CONTATO = "9000000000000103";
    await semearContato(CONTATO, { horasDesdeAResposta: 48 });
    await engine.enqueueLote(CONTA, "L2", [CONTATO], {
      text: "promocao que ja acabou",
      validoAte: new Date(Date.now() - 3_600_000).toISOString(),
    });

    await drenar();
    const item = await lerItem(CONTATO);
    expect(item.status).toBe("skipped");
    expect(item.error).toContain("venceu");
    expect(await enviadasPara(CONTATO)).toBe(0);
  });

  // O CASO QUE FALTAVA, E ELE É O IRMÃO DO DE CIMA PELO OUTRO LADO DA JANELA.
  //
  // O caso anterior mede o lote vencido com a janela FECHADA, e ele passava
  // desde sempre — `loteExpirou` era consultada UMA ÚNICA VEZ, dentro do ramo
  // em que a janela está fechada. No caminho de ENVIO ninguém olhava a
  // validade: `processItem` via a janela aberta e mandava.
  //
  // O CENÁRIO, com nome e data: sexta o dono manda "a turma abre segunda, vagas
  // até domingo" para 111 pessoas fora da janela. Terça uma delas volta a
  // falar. O item acorda, a janela agora está ABERTA — e ela recebia a oferta
  // que venceu há dois dias.
  //
  // E ELE NÃO PRECISA DE NINGUÉM VOLTANDO A FALAR PARA ACONTECER: `HOURLY_CAP`
  // é 190 por conta, então um lote de 800 com a janela aberta leva ~4h20 para
  // sair inteiro, e tudo o que fica depois do teto sai DEPOIS do prazo.
  test("lote VENCIDO com a janela ABERTA nao e enviado", async () => {
    const CONTATO = "9000000000000107";
    await semearContato(CONTATO, { horasDesdeAResposta: 0 });
    await engine.enqueueLote(CONTA, "L7", [CONTATO], {
      text: "vagas ate domingo",
      validoAte: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    });

    await drenar();
    const item = await lerItem(CONTATO);
    expect(item.status).toBe("skipped");
    expect(item.error).toContain("venceu");
    expect(await enviadasPara(CONTATO)).toBe(0);
  });

  // O CASO QUE A PRIMEIRA VERSÃO DESTE PLANO NÃO TINHA, e ele existe porque o
  // defeito era meu: itens guardados NÃO PODEM sufocar a fila. Sem o
  // `retryInSeconds` de um dia, itens de lote esperando ocupariam os lugares de
  // todo dreno, e a resposta de verdade nunca sairia.
  test("vinte itens guardados nao impedem uma mensagem de verdade de sair", async () => {
    const ESPERANDO = Array.from(
      { length: 20 },
      (_, i) => `90000000000002${String(i).padStart(2, "0")}`
    );
    for (const c of ESPERANDO) await semearContato(c, { horasDesdeAResposta: 48 });
    await engine.enqueueLote(CONTA, "L5", ESPERANDO, { text: "guardado", validoAte: null });
    await drenar(); // todos ficam pending e dormem

    const VIVO = "9000000000000299";
    await semearContato(VIVO, { horasDesdeAResposta: 0 });
    await engine.enqueueManualReply(CONTA, VIVO, "esta tem de sair agora");

    await drenar();
    expect(await estadoDoItem(VIVO)).toBe("sent");
  });

  test("um lote novo cancela o que estava guardado para a mesma pessoa", async () => {
    const CONTATO = "9000000000000104";
    await semearContato(CONTATO, { horasDesdeAResposta: 48 });

    await engine.enqueueLote(CONTA, "L3", [CONTATO], { text: "primeiro", validoAte: null });
    await drenar();
    expect(await estadoDoItem(CONTATO)).toBe("pending");

    await engine.enqueueLote(CONTA, "L4", [CONTATO], { text: "segundo", validoAte: null });

    const itens = await todosOsItens(CONTATO);
    expect(itens.filter((i) => i.status === "pending")).toHaveLength(1);
    const guardado = itens.find((i) => i.status === "pending")!;
    expect((guardado.payload as { text: string }).text).toBe("segundo");
    const cancelado = itens.find((i) => i.status === "skipped")!;
    expect(cancelado.error).toContain("substituido");
  });

  // O DUPLO CLIQUE: rede lenta, o dono confirma e o clique dispara duas vezes
  // com o MESMO loteId. O comentário de `enqueueLote` promete "o mesmo lote
  // duas vezes é um só" — este caso mede se a promessa é verdade.
  //
  // O `update` que cancela lote antigo não distinguia o loteId: ele marcava
  // `skipped` até o item que a PRÓPRIA chamada tinha acabado de inserir (mesmo
  // loteId), e o `insert` seguinte esbarrava no `dedupe_key` já ocupado por
  // essa linha agora `skipped` — `on conflict do nothing` não reescrevia nada.
  // Resultado: o contato ficava sem item NENHUM, nem o original nem o
  // substituto.
  test("duplo clique em confirmar, com o MESMO loteId, nao apaga a mensagem", async () => {
    const CONTATO = "9000000000000106";
    await semearContato(CONTATO, { horasDesdeAResposta: 48 });

    await engine.enqueueLote(CONTA, "L6", [CONTATO], { text: "oferta unica", validoAte: null });
    await engine.enqueueLote(CONTA, "L6", [CONTATO], { text: "oferta unica", validoAte: null });

    const itens = await todosOsItens(CONTATO);
    expect(itens).toHaveLength(1);
    expect(itens[0].status).toBe("pending");
  });
});
