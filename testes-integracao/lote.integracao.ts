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
// escondida atrás de um recurso novo.
//
// A SEGUNDA VERSÃO PÔS O ITEM PARA DORMIR UM DIA, e o caso que media isso tinha
// VINTE itens — que é menos do que ele precisava ter. `BATCH_SIZE` é 15: com
// vinte, sobram cinco depois da primeira drenagem, o item vivo entra junto com
// eles e sai. O caso passava contra qualquer desenho. E dormir um dia só ADIAVA
// a fome: passado o dia, os quarenta voltavam para a mesma fila, e o ciclo se
// repetia todo dia.
//
// A VERSÃO DE HOJE TIRA O ITEM DA FILA DE VERDADE: ele vai para um estado
// próprio, `guardado` (`migrations/009-fila-estado-guardado.sql`), que a
// seleção do dreno não enxerga — hoje nem amanhã. O caso "quarenta itens
// guardados... hoje nem amanhã" mede as duas metades, e a segunda é a que
// distingue os dois desenhos.
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
// DESPERTAR do item de lote (o `update queue set status = 'pending'`) mora
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
  // QUEM A META FALSA RECUSA COM 500, e por que ela precisa saber recusar: o
  // caso do backoff de erro só existe se houver erro. 500 e não 4xx de
  // propósito — `drainQueue` trata 4xx como permanente e mata o item em
  // `failed`, e o que este arquivo mede é justamente o item que CONTINUA
  // tentando.
  falharCom500: new Set<string>(),
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
        const destinatario = corpo.recipient.id ?? "";
        if (meta.falharCom500.has(destinatario)) {
          res.writeHead(500, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: { message: "a Meta ficou instavel" } }));
          return;
        }
        meta.enviadas.push({
          destinatario,
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

// O DIA SEGUINTE CHEGA.
//
// É o único pedaço deste arquivo que mexe no banco à mão, e ele existe porque é
// a única parte da fome de fila que o relógio não deixa medir de verdade: o
// item guardado dormia 24h e ACORDAVA, e é a REPETIÇÃO — "e o ciclo se repete
// todo dia" — que separa "guardar tira o item da disputa por um dia" de
// "guardar tira o item da disputa". Sem isto, os dois desenhos ficam
// indistinguíveis num teste que roda em vinte segundos.
//
// ELE NÃO MUDA STATUS NENHUM, de propósito: só adianta `not_before` de quem
// está dormindo. Contra o desenho de hoje isso acorda os quarenta; contra o
// desenho novo ele casa ZERO linhas, porque item guardado não dorme — ele está
// noutro estado, e `not_before` deixou de ser o que o segura.
async function passarUmDia() {
  await banco
    .db()
    .sql()
    .query(
      `update queue set not_before = now() - interval '1 minute'
        where account_id = $1 and kind = 'dm_lote' and not_before > now()`,
      [CONTA]
    );
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

// O item está esperando o backoff passar? É a pergunta que o dreno faz
// (`status = 'pending' and not_before <= now()`), escrita do lado de fora.
async function esperandoOBackoff(igId: string): Promise<boolean> {
  const linhas = (await banco
    .db()
    .sql()
    .query(
      `select (not_before > now()) as no_futuro from queue
        where account_id = $1 and contact_ig_id = $2
        order by created_at desc, id desc limit 1`,
      [CONTA, igId]
    )) as { no_futuro: boolean }[];
  return linhas[0].no_futuro;
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

    // Primeiro dreno: a janela está fechada. O item sai da fila e vai para o
    // estado próprio — `guardado`, e não `pending`
    // (`migrations/009-fila-estado-guardado.sql`).
    await drenar();
    expect(await estadoDoItem(CONTATO)).toBe("guardado");
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

  // A FOME DE FILA, E O NÚMERO AGORA É QUARENTA. Os dois números têm porquê.
  //
  // ELE ERA VINTE, E VINTE NÃO MEDIA. `BATCH_SIZE` é 15: com vinte, a primeira
  // drenagem tira quinze de circulação e sobram CINCO — o item vivo entra na
  // segunda drenagem junto com esses cinco e sai. O caso passava contra
  // qualquer desenho, inclusive contra o que ele existe para reprovar. A
  // fronteira exata é TRINTA: com trinta, sobram quinze depois da primeira
  // drenagem, os quinze são mais velhos que o item vivo, e ele fica de fora.
  // Quarenta é trinta com folga, e é o número do achado.
  //
  // E O CASO GANHOU A METADE QUE FALTAVA — o dia seguinte. Guardar quarenta
  // custa três drenagens (15 + 15 + 10), e ISSO O REDESENHO NÃO MUDA: os itens
  // nascem `pending` e alguém tem de olhá-los uma vez. O que ele muda é que
  // essas três são as ÚNICAS. No desenho antigo o item guardado dormia um dia e
  // voltava para a mesma fila, e amanhã as três drenagens aconteciam de novo, e
  // depois de amanhã também — a fome de fila não era um susto de estreia, era
  // uma assinatura mensal. Por isso a segunda metade do caso é uma mensagem
  // viva DEPOIS de o dia virar.
  test("quarenta itens guardados nao impedem uma mensagem de verdade de sair, hoje nem amanha", async () => {
    const ESPERANDO = Array.from(
      { length: 40 },
      (_, i) => `90000000000002${String(i).padStart(2, "0")}`
    );
    for (const c of ESPERANDO) await semearContato(c, { horasDesdeAResposta: 48 });
    await engine.enqueueLote(CONTA, "L5", ESPERANDO, { text: "guardado", validoAte: null });

    // As três drenagens que guardam os quarenta. Escritas uma a uma, e não num
    // laço "até esvaziar": o número é o que o `BATCH_SIZE` promete, e um laço
    // esconderia uma quarta drenagem se ela passasse a ser necessária.
    await drenar();
    await drenar();
    await drenar();

    const VIVO = "9000000000000299";
    await semearContato(VIVO, { horasDesdeAResposta: 0 });
    await engine.enqueueManualReply(CONTA, VIVO, "esta tem de sair agora");

    await drenar();
    expect(await estadoDoItem(VIVO), "a mensagem viva de HOJE").toBe("sent");

    // O DIA SEGUINTE, que é onde o desenho antigo reprova.
    await passarUmDia();

    const VIVO_AMANHA = "9000000000000298";
    await semearContato(VIVO_AMANHA, { horasDesdeAResposta: 0 });
    await engine.enqueueManualReply(CONTA, VIVO_AMANHA, "esta tem de sair amanha");

    await drenar();
    expect(await estadoDoItem(VIVO_AMANHA), "a mensagem viva de AMANHA").toBe("sent");
  });

  // O ITEM DE LOTE COM PAYLOAD QUE NÃO É DE LOTE.
  //
  // `lerPayloadDoLote` (lib/lote.ts) devolve `null` quando falta `lote_id` ou
  // `text`, e o dreno lia `null` como "sem prazo" — a MESMA resposta que um
  // lote deliberadamente eterno dá. O item ficava guardado para sempre, sem
  // texto para enviar e sem uma linha dizendo por quê.
  //
  // O `update` à MÃO AQUI É O CENÁRIO, e não um atalho: `payload` é `jsonb` e
  // editável por fora do painel — é a mesma premissa pela qual o dreno defende
  // os botões em vez de confiar no editor (cabeçalho de lib/queue-drain.ts).
  // Nenhum caminho do produto grava um payload assim; a coluna, sim.
  test("item de lote com payload que nao e de lote nao espera para sempre", async () => {
    const CONTATO = "9000000000000109";
    await semearContato(CONTATO, { horasDesdeAResposta: 48 });
    await engine.enqueueLote(CONTA, "L9", [CONTATO], { text: "texto bom", validoAte: null });

    await banco
      .db()
      .sql()
      .query(
        `update queue set payload = '{"nada":"a ver"}'::jsonb
          where account_id = $1 and contact_ig_id = $2 and kind = 'dm_lote'`,
        [CONTA, CONTATO]
      );

    await drenar();
    const item = await lerItem(CONTATO);
    expect(item.status, "ficou guardado para sempre").toBe("skipped");
    expect(item.error).toContain("payload");
  });

  // O DESPERTAR NÃO PODE ZERAR O BACKOFF DE ERRO.
  //
  // O `update` de `upsertContact` (lib/engine.ts) casava com todo `dm_lote`
  // `pending` da pessoa — e o item que a Meta acabou de recusar com 500 está
  // exatamente nesse estado: o `catch` do dreno o devolve como `pending,
  // retryInSeconds: 120`. A pessoa mandar uma mensagem qualquer nesses dois
  // minutos trazia o item de volta NA HORA, contra a Meta que acabara de dizer
  // que não estava bem, gastando mais uma tentativa das três.
  //
  // Com o estado próprio, "guardado" e "esperando o backoff" deixaram de ser a
  // mesma palavra: o despertar pede `guardado`, e este item está `pending`.
  test("a pessoa falar NAO adianta o item que a Meta acabou de recusar", async () => {
    const CONTATO = "9000000000000108";
    // JANELA ABERTA, para o item chegar até a Meta e tomar o 500. Com a janela
    // fechada ele nem sairia, e o caso mediria outra coisa.
    await semearContato(CONTATO, { horasDesdeAResposta: 0 });
    meta.falharCom500.add(CONTATO);
    await engine.enqueueLote(CONTA, "L8", [CONTATO], { text: "vai falhar", validoAte: null });

    await drenar();
    const depoisDoErro = await lerItem(CONTATO);
    expect(depoisDoErro.status, "500 e transitorio: continua tentando").toBe("pending");
    expect(await esperandoOBackoff(CONTATO), "o backoff de 120s foi gravado").toBe(true);

    // A pessoa fala. Isto NAO pode mexer no item que está de castigo.
    await abrirJanela(CONTATO);

    expect(
      await esperandoOBackoff(CONTATO),
      "o despertar do lote zerou o backoff de erro"
    ).toBe(true);

    meta.falharCom500.delete(CONTATO);
  });

  test("um lote novo cancela o que estava guardado para a mesma pessoa", async () => {
    const CONTATO = "9000000000000104";
    await semearContato(CONTATO, { horasDesdeAResposta: 48 });

    await engine.enqueueLote(CONTA, "L3", [CONTATO], { text: "primeiro", validoAte: null });
    await drenar();
    expect(await estadoDoItem(CONTATO)).toBe("guardado");

    await engine.enqueueLote(CONTA, "L4", [CONTATO], { text: "segundo", validoAte: null });

    // UM ITEM VIVO, E A CONTA E SOBRE OS DOIS ESTADOS. O velho estava
    // `guardado` (a janela dele fechou), o novo nasce `pending`: contar so
    // `pending` diria "um" mesmo se o velho tivesse sobrado inteiro, e a pessoa
    // receberia os DOIS quando voltasse a falar.
    const itens = await todosOsItens(CONTATO);
    const vivos = itens.filter((i) => i.status === "pending" || i.status === "guardado");
    expect(vivos, "a pessoa ficou com mais de um envio de lote vivo").toHaveLength(1);
    expect((vivos[0].payload as { text: string }).text).toBe("segundo");
    const cancelado = itens.find((i) => i.status === "skipped");
    expect(cancelado?.error, "o lote velho nao foi cancelado").toContain("substituido");
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
  // O LOTE VENCIDO DE QUEM NUNCA MAIS FALA.
  //
  // `drainQueue` é o único lugar que avalia `loteExpirou`, e ele só roda sobre
  // item `pending`. Item `guardado` só vira `pending` quando a PESSOA escreve —
  // e 40% dos contatos deste produto falaram uma vez e nunca mais. Para esses, o
  // item ficava guardado PARA SEMPRE e a tela de Envios seguia prometendo "sai
  // assim que ela voltar a falar" semanas depois do prazo.
  //
  // O `update` DO PAYLOAD É O RELÓGIO, e não um atalho: o prazo tem de estar no
  // FUTURO na hora do primeiro dreno (senão o item morre ali mesmo, sem nunca
  // ficar guardado), e no PASSADO na hora da varredura. É a única forma de o
  // tempo passar dentro de um teste de vinte segundos — a mesma escolha, pelo
  // mesmo motivo, de `passarUmDia` lá em cima.
  test("o lote guardado que venceu e encerrado com o motivo escrito", async () => {
    const CONTATO = "9000000000000110";
    await semearContato(CONTATO, { horasDesdeAResposta: 48 });
    await engine.enqueueLote(CONTA, "L10", [CONTATO], {
      text: "a turma abre segunda",
      validoAte: new Date(Date.now() + 3_600_000).toISOString(),
    });

    await drenar();
    expect(await estadoDoItem(CONTATO), "precisa estar guardado para o caso medir algo").toBe(
      "guardado"
    );

    // O prazo acaba enquanto ela não volta.
    await banco
      .db()
      .sql()
      .query(
        `update queue set payload = jsonb_set(payload, '{valido_ate}', to_jsonb($3::text))
          where account_id = $1 and contact_ig_id = $2 and kind = 'dm_lote'`,
        [CONTA, CONTATO, new Date(Date.now() - 3_600_000).toISOString()]
      );

    // Ninguém falou, ninguém drenou: é a varredura do cron diário que decide.
    const { vencidos } = await dreno.cancelarLotesVencidos();
    expect(vencidos).toBe(1);

    const item = await lerItem(CONTATO);
    expect(item.status, "continuou guardado depois do prazo").toBe("skipped");
    // O pedaço que `friendlyError` (app/labels.ts) procura para escrever o
    // motivo em português na tela de Envios.
    expect(item.error).toContain("o lote venceu");
  });

  // O CONTROLE QUE IMPEDE A VARREDURA DE VIRAR UMA VASSOURA. Ela apaga item
  // vencido, e NADA MAIS: o lote sem prazo ("segue o material") espera para
  // sempre de propósito, e o `pending` não é assunto dela — devolver item
  // guardado à fila viva, ou matar o que ainda vai sair, era o que
  // `migrations/009-fila-estado-guardado.sql` fechou.
  test("a varredura nao encosta no lote sem prazo nem no que ainda esta na fila", async () => {
    const SEM_PRAZO = "9000000000000111";
    const NA_FILA = "9000000000000112";
    await semearContato(SEM_PRAZO, { horasDesdeAResposta: 48 });
    // Janela ABERTA: este nasce `pending` e continua lá até alguém drenar.
    await semearContato(NA_FILA, { horasDesdeAResposta: 0 });

    await engine.enqueueLote(CONTA, "L11", [SEM_PRAZO], { text: "segue o material", validoAte: null });
    await drenar();
    expect(await estadoDoItem(SEM_PRAZO)).toBe("guardado");

    await engine.enqueueLote(CONTA, "L12", [NA_FILA], {
      text: "ainda vai sair",
      validoAte: new Date(Date.now() - 3_600_000).toISOString(),
    });

    const { vencidos } = await dreno.cancelarLotesVencidos();
    expect(vencidos, "a varredura levou quem nao devia").toBe(0);
    expect(await estadoDoItem(SEM_PRAZO), "o lote sem prazo nunca vence").toBe("guardado");
    expect(await estadoDoItem(NA_FILA), "a varredura mexeu num item pending").toBe("pending");
  });

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
