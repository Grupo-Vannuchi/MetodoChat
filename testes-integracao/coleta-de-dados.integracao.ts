// A COLETA DE DADOS, do pedido à gravação — a conversa inteira contra o banco.
//
// A PROMESSA, escrita como teste: **a automação pergunta o campo, recusa o que
// não serve, grava o que serve, e NUNCA prende quem não quer responder.**
//
// Por que este arquivo existe, e por que ele nasceu ANTES de uma linha do motor
// mudar: a revisão da tarefa anterior mediu que a captura do e-mail em
// `lib/engine.ts` não tinha UM ÚNICO teste — trocar `extractEmail(text)` por uma
// string fixa deixava o `tsc` limpo e as duas suítes inteiras verdes. O primeiro
// caso daqui de baixo é o de CARACTERIZAÇÃO: ele foi escrito contra o motor
// ANTIGO, visto verde, e só então o defeito foi plantado para vê-lo vermelho.
// Ele continua aqui depois da generalização porque o e-mail é o campo que já
// atende cliente de verdade, e é dele que a Parte 2 vai depender.
//
// -----------------------------------------------------------------------------
// A MAQUINARIA É A DE `gatilho-entrega.integracao.ts`, E NÃO UMA NOVA
//
// Servidor HTTP local com `IG_GRAPH_BASE`, `semear` por `insert` cru,
// `mensagem` pelo webhook de verdade, `drainQueue` de verdade. Não há `vi.mock`,
// não há banco de mentira: o que foi substituído é a OUTRA PONTA DO FIO. As duas
// guardas do `beforeAll` (a base do Graph e o QStash desligado) são as mesmas de
// lá, pelos mesmos motivos — sem elas este arquivo mandaria DM pela Meta de
// verdade.
//
// -----------------------------------------------------------------------------
// CADA CASO TEM A SUA PALAVRA-CHAVE E O SEU CONTATO
//
// `findMatch` (lib/engine.ts) escolhe UMA automação por palavra, e `drainQueue`
// esvazia a fila INTEIRA — então dois casos que dividissem palavra ou contato se
// contaminariam pela ordem em que rodassem. A palavra é única por caso, o
// `ig_id` é único por caso, e o que se lê do fio é filtrado por destinatário.
//
// E "ÚNICA" AQUI É MAIS FORTE QUE "DIFERENTE": o `match_type` é `contains`, então
// uma palavra que seja PEDAÇO de outra ("quero-o-zap" dentro de
// "quero-o-zap-b") faz a mensagem do segundo caso disparar a automação do
// primeiro. Custou duas asserções vermelhas que pareciam defeito do motor.
//
// -----------------------------------------------------------------------------
// O RELÓGIO NUNCA É CRAVADO
//
// `diasAtras(n)` conta a partir de `Date.now()`, e nunca de uma data escrita à
// mão: em 21/09/2026 dois testes desta base ficaram vermelhos sozinhos por
// cravarem data que passou. E a data que o motor GRAVA vem do BANCO
// (`gravarCampo`, lib/engine.ts) — o que este arquivo confere sobre ela é a
// distância até o relógio do banco, nunca até o do Node.
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { bancoDescartavel } from "./harness";
// `lib/campos.ts` é puro (sem `server-only`) e não fala com o banco: pode ser
// importado no topo, do mesmo jeito que `lib/steps.ts` é em gatilho-entrega.
import { TETO_DE_TENTATIVAS, campoEstaFresco } from "@/lib/campos";

type ModuloEngine = typeof import("@/lib/engine");
type ModuloIg = typeof import("@/lib/ig");
type ModuloDreno = typeof import("@/lib/queue-drain");
type ModuloQstash = typeof import("@/lib/qstash");

const banco = bancoDescartavel();

const CONTA = "17800000000000777";
// Valor inventado. Nenhuma credencial de verdade entra em teste.
const TOKEN = "token-de-teste-que-nao-vale-nada";

// ---------------------------------------------------------------------------
// A META FALSA — a outra ponta do fio, e nada além disso.
// ---------------------------------------------------------------------------

type MensagemNoFio = {
  destinatario: string;
  texto: string;
  textoDoAnexo: string | null;
};

const meta = {
  enviadas: [] as MensagemNoFio[],
  desconhecidos: [] as string[],
};

let servidor: Server;
let engine: ModuloEngine;
let ig: ModuloIg;
let dreno: ModuloDreno;
let qstash: ModuloQstash;

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
          recipient: { id?: string; comment_id?: string };
          message: {
            text?: string;
            attachment?: { payload?: { text?: string } };
          };
        };
        meta.enviadas.push({
          destinatario: corpo.recipient.id ?? corpo.recipient.comment_id ?? "",
          texto: corpo.message.text ?? "",
          textoDoAnexo: corpo.message.attachment?.payload?.text ?? null,
        });
        responder({ message_id: `mid-do-teste-${meta.enviadas.length}`, recipient_id: "r-1" });
      });
      return;
    }

    if ((u.searchParams.get("fields") ?? "").includes("username")) {
      return responder({ username: "pessoa_de_teste", name: "Pessoa de teste" });
    }

    meta.desconhecidos.push(`${req.method} ${u.pathname}`);
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: { message: `a Meta falsa não conhece ${u.pathname}` } }));
  });

  await new Promise<void>((pronto) => servidor.listen(0, "127.0.0.1", pronto));
  const porta = (servidor.address() as AddressInfo).port;
  process.env.IG_GRAPH_BASE = `http://127.0.0.1:${porta}`;
  delete process.env.QSTASH_TOKEN;

  engine = await import("@/lib/engine");
  ig = await import("@/lib/ig");
  dreno = await import("@/lib/queue-drain");
  qstash = await import("@/lib/qstash");

  // FALHA ANTES DE QUALQUER REQUISIÇÃO SAIR. Sem o desvio, este arquivo
  // mandaria DM pela Meta de verdade, com o texto dentro.
  if (ig.baseDoGraph() !== process.env.IG_GRAPH_BASE) {
    throw new Error(
      `RECUSADO: a base do Graph é ${ig.baseDoGraph()}, e tinha de ser a desta ` +
        `rodada (${process.env.IG_GRAPH_BASE}).`
    );
  }
  if (qstash.qstashEnabled()) {
    throw new Error(
      "RECUSADO: o QStash está habilitado nesta rodada — `scheduleTick` publicaria " +
        "um agendamento de verdade, e essa chamada não passa pelo desvio do Graph."
    );
  }

  await banco.db().upsertAccount({
    ig_user_id: CONTA,
    username: "conta_da_coleta",
    name: "Conta da coleta",
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
// ESCALAR JSON e o motor registra `step_ignorado`. (O porquê inteiro está em
// gatilho-entrega.integracao.ts.)
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
       values ($1, $2, true, string_to_array('dm', ','), string_to_array($3, ','), 'contains',
               $4::text::jsonb, $5::text::jsonb)
       returning id`,
      [CONTA, nome, palavra, JSON.stringify(steps), JSON.stringify(ligacoes)]
    )) as { id: string }[];
  return linhas[0].id;
}

// Uma automação cuja ENTRADA é o pedido do campo, e que opcionalmente tem um
// bloco depois dele. O bloco de depois é o que prova que o fluxo SEGUIU: ele só
// sai quando o pedido foi resolvido (pulado, gravado, ou desistido).
async function semearComPedido(
  palavra: string,
  campo: string,
  texto: string,
  depois?: string,
  chave?: string
): Promise<string> {
  const pedido: Record<string, unknown> = { id: "b_pedido0", tipo: "pedir_dado", campo, texto };
  if (chave !== undefined) pedido.chave = chave;
  const steps: unknown[] = [pedido];
  const ligacoes: unknown[] = [];
  if (depois !== undefined) {
    steps.push({ id: "b_depois0", tipo: "dm", texto: depois });
    ligacoes.push({ de: "b_pedido0", quando: { tipo: "sempre" }, para: "b_depois0" });
  }
  return semear(`coleta · ${palavra}`, palavra, steps, ligacoes);
}

// Uma mensagem de texto chegando pelo webhook, como a Meta a entrega. Ela também
// é o que ABRE A JANELA DE 24H, sem a qual `drainQueue` descartaria tudo.
async function mensagem(igId: string, texto: string, mid: string) {
  await engine.handleMessagingEvent(CONTA, { sender: { id: igId }, message: { mid, text: texto } });
}

// O que chegou no fio para ESTA pessoa. Filtrar é o que deixa os casos
// independentes: `drainQueue` esvazia a fila inteira.
function textosNoFio(destinatario: string): string[] {
  // O texto de uma mensagem com link mora DENTRO do anexo, e não em
  // `message.text` — ler só um dos dois faria metade das entregas parecer vazia.
  return meta.enviadas
    .filter((m) => m.destinatario === destinatario)
    .map((m) => m.textoDoAnexo ?? m.texto);
}

// O valor de um campo dentro do `jsonb`, ou `null` quando ele não está lá.
async function campoDoContato(igId: string, chave: string): Promise<string | null> {
  const linhas = (await banco
    .db()
    .sql()
    .query(`select campos -> $3 ->> 'valor' as valor from contacts where account_id = $1 and ig_id = $2`, [
      CONTA,
      igId,
      chave,
    ])) as { valor: string | null }[];
  return linhas[0]?.valor ?? null;
}

// A COLUNA `contacts.email`, lida à parte do `jsonb` de propósito: ela continua
// sendo escrita nesta Parte 1, e os seis leitores de hoje leem DELA. É este
// leitor que prende a escrita dupla de `gravarCampo` (lib/engine.ts) — sem ele,
// tirar a linha da coluna não acusaria em lugar nenhum, e a Parte 2 herdaria
// uma coluna divergente.
async function emailDaColuna(igId: string): Promise<string | null> {
  const linhas = (await banco
    .db()
    .sql()
    .query(`select email from contacts where account_id = $1 and ig_id = $2`, [CONTA, igId])) as {
    email: string | null;
  }[];
  return linhas[0]?.email ?? null;
}

async function tentativasDoContato(igId: string): Promise<number | null> {
  const linhas = (await banco
    .db()
    .sql()
    .query(`select campo_tentativas from contacts where account_id = $1 and ig_id = $2`, [
      CONTA,
      igId,
    ])) as { campo_tentativas: number }[];
  return linhas[0]?.campo_tentativas ?? null;
}

// O `em` cru de um campo — o QUANDO que o motor gravou, sem passar por nenhuma
// conversão do driver.
async function emDoCampo(igId: string, chave: string): Promise<string | null> {
  const linhas = (await banco
    .db()
    .sql()
    .query(
      `select campos -> $3 ->> 'em' as em from contacts where account_id = $1 and ig_id = $2`,
      [CONTA, igId, chave]
    )) as { em: string | null }[];
  return linhas[0]?.em ?? null;
}

// Quantos segundos separam o `em` gravado do relógio DO BANCO. A conta roda
// dentro do banco de propósito (ver o caso que a usa), e o `::timestamptz`
// também é medição: uma data que o Postgres não saiba ler derruba a consulta em
// vez de devolver um número plausível.
async function distanciaNoBanco(igId: string, chave: string): Promise<number> {
  const linhas = (await banco
    .db()
    .sql()
    .query(
      `select extract(epoch from (now() - ((campos -> $3 ->> 'em')::timestamptz)))::float8
              as segundos
         from contacts where account_id = $1 and ig_id = $2`,
      [CONTA, igId, chave]
    )) as { segundos: number }[];
  return linhas[0].segundos;
}

// Põe o contador de tentativas num valor escolhido, como se um campo ANTERIOR
// tivesse deixado ele assim.
async function porTentativas(igId: string, quantas: number) {
  await banco
    .db()
    .sql()
    .query(`update contacts set campo_tentativas = $3 where account_id = $1 and ig_id = $2`, [
      CONTA,
      igId,
      quantas,
    ]);
}

// O `flow_step_id` cru — onde a pessoa está parada, se é que está. É o que
// separa "o fluxo andou" de "o fluxo ficou onde estava", e sem ele o caso da
// seta pendurada não teria como afirmar que ninguém saiu do lugar.
async function cursorDoContato(igId: string): Promise<string | null> {
  const linhas = (await banco
    .db()
    .sql()
    .query(`select flow_step_id from contacts where account_id = $1 and ig_id = $2`, [CONTA, igId])) as {
    flow_step_id: string | null;
  }[];
  return linhas[0]?.flow_step_id ?? null;
}

// Um e-mail JÁ GRAVADO na coluna, como o de um contato que respondeu mês
// passado. É o que o campo livre chamado "email" apagava.
async function semearEmailNaColuna(igId: string, email: string) {
  await banco
    .db()
    .sql()
    .query(
      `insert into contacts (account_id, ig_id, email) values ($1, $2, $3)
       on conflict (account_id, ig_id) do update set email = excluded.email`,
      [CONTA, igId, email]
    );
}

// A ORIGEM gravada junto do valor — qual automação coletou aquele dado. É o
// terceiro membro de `CampoColetado` (lib/campos.ts), e o que a migração dos
// e-mails de hoje vai usar para distinguir o que foi COLETADO do que foi MOVIDO.
async function automacaoDoCampo(igId: string, chave: string): Promise<string | null> {
  const linhas = (await banco
    .db()
    .sql()
    .query(
      `select campos -> $3 ->> 'automacao' as automacao from contacts
        where account_id = $1 and ig_id = $2`,
      [CONTA, igId, chave]
    )) as { automacao: string | null }[];
  return linhas[0]?.automacao ?? null;
}

function diasAtras(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

// Põe um campo já coletado no contato, como se uma automação anterior o tivesse
// gravado. `on conflict` porque o contato pode já existir (a chave é composta,
// migrations/005-contatos-chave-composta.sql).
async function semearCampo(igId: string, chave: string, valor: string, em: string) {
  await banco
    .db()
    .sql()
    .query(
      `insert into contacts (account_id, ig_id, campos)
       values ($1, $2, jsonb_build_object($3::text, jsonb_build_object('valor', $4::text, 'em', $5::text)))
       on conflict (account_id, ig_id) do update
         set campos = contacts.campos || excluded.campos`,
      [CONTA, igId, chave, valor, em]
    );
}

// ---------------------------------------------------------------------------

describe("a automação pergunta, recusa, grava — e nunca prende", () => {
  test("CARACTERIZAÇÃO — o e-mail: repergunta o que não serve, grava o que serve", async () => {
    // ESTE CASO NASCEU CONTRA O MOTOR ANTIGO, e foi visto verde antes de uma
    // linha mudar: era o único jeito de reescrever a captura do e-mail sem
    // reescrevê-la às cegas. O plantio que o provou: `extractEmail(text)` por
    // uma string fixa — as duas primeiras asserções de e-mail ficam vermelhas.
    await semearComPedido("quero-o-email", "email", "Qual é o seu e-mail?", "depois do e-mail");
    const EU = "9300000000000201";

    await mensagem(EU, "quero-o-email", "m-e1");
    await dreno.drainQueue();
    expect(textosNoFio(EU)).toEqual(["Qual é o seu e-mail?"]);

    // Resposta que não serve: repergunta, e NADA é gravado.
    await mensagem(EU, "não tenho", "m-e2");
    await dreno.drainQueue();
    expect(textosNoFio(EU)[1]).toContain("e-mail");
    expect(await emailDaColuna(EU)).toBeNull();

    // Resposta boa: grava e SEGUE.
    await mensagem(EU, "meu email é ana@exemplo-do-teste.invalid", "m-e3");
    await dreno.drainQueue();
    expect(await emailDaColuna(EU)).toBe("ana@exemplo-do-teste.invalid");
    expect(textosNoFio(EU)).toContain("depois do e-mail");

    // E A ESCRITA É NOS DOIS LUGARES. Esta linha é a que prende a metade da
    // escrita que a Parte 2 vai herdar: o `jsonb` é a fonte nova, a coluna é a
    // fonte que os seis leitores de hoje usam. Tirar qualquer uma das duas de
    // `gravarCampo` (lib/engine.ts) deixa uma destas duas asserções vermelha.
    expect(await campoDoContato(EU, "email")).toBe("ana@exemplo-do-teste.invalid");
  });

  test("pergunta, recusa o que não serve, e grava quando serve", async () => {
    const AUTO = await semearComPedido("quero-zap-um", "telefone", "Me manda seu WhatsApp 👇");
    const EU = "9300000000000101";

    await mensagem(EU, "quero-zap-um", "m-1");
    await dreno.drainQueue();
    expect(textosNoFio(EU)).toEqual(["Me manda seu WhatsApp 👇"]);

    // Resposta que não serve: repergunta com o texto DO CAMPO — e é isso que
    // prova que o motor foi ao catálogo (lib/campos.ts) em vez de repetir a
    // frase de e-mail que estava cravada aqui até esta tarefa.
    await mensagem(EU, "não tenho", "m-2");
    await dreno.drainQueue();
    expect(textosNoFio(EU)[1]).toContain("DDD");
    expect(await campoDoContato(EU, "telefone")).toBeNull();

    // Resposta boa: grava só os dígitos e SEGUE.
    await mensagem(EU, "meu zap é (11) 99999-9999", "m-3");
    await dreno.drainQueue();
    expect(await campoDoContato(EU, "telefone")).toBe("11999999999");

    // A COLUNA `email` NÃO É TOCADA por um campo que não é e-mail. É a outra
    // metade do `case when $3 = 'email'` de `gravarCampo`: sem ela, gravar o
    // telefone escreveria o número dentro da coluna de e-mail.
    expect(await emailDaColuna(EU)).toBeNull();

    // A IDA E A VOLTA DO `em`, e ela precisa das DUAS asserções abaixo.
    //
    // `gravarCampo` (lib/engine.ts) escreve a data com `to_char(now() at time
    // zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`, e quem a lê de volta é
    // `campoEstaFresco` (lib/campos.ts), com `Date.parse`. Um formato que o
    // `Date.parse` não entenda vira `NaN`, e `NaN` cai no lado "não fresco"
    // CALADO: o passo voltaria a perguntar para sempre um dado já gravado, e
    // nenhum outro caso deste arquivo acusaria — os outros semeiam o `em` por
    // conta própria, e por isso nunca exercitam o que o MOTOR escreveu.
    //
    // NÃO DÁ PARA MEDIR ISSO REPETINDO A PALAVRA-CHAVE: o segundo pedido do
    // mesmo dia cai na mesma `emailAskKey` e é engolido por `enqueue`, então o
    // fio fica igual com a data certa e com a data podre (medido plantando
    // `'DD/MM/YYYY HH24:MI'` — o caso continuava verde). A medição tem de ser
    // sobre o valor gravado.
    const em = await emDoCampo(EU, "telefone");
    expect(em, "o motor tem de ter gravado o QUANDO junto com o valor").toBeTruthy();
    expect(campoEstaFresco(em)).toBe(true);
    // E O RELÓGIO É O DO BANCO. A distância é medida DENTRO do banco, contra o
    // `now()` dele — trazer o instante e comparar com o do Node poria dois
    // relógios na mesma conta, que é o defeito que `enqueue` (lib/engine.ts)
    // registra ter custado 53,9 segundos de atraso nesta máquina. Um `to_char`
    // sem o `at time zone 'utc'` num servidor fora do UTC gravaria hora local
    // com um "Z" colado, e a distância seria o fuso inteiro.
    expect(Math.abs(await distanciaNoBanco(EU, "telefone"))).toBeLessThan(60);

    // A ORIGEM VAI JUNTO — qual automação coletou o dado. Sem esta linha, trocar
    // `autoParada.id` por `null` em `gravarCampo` (lib/engine.ts) deixava a
    // suíte inteira verde, e a Tarefa 7 herdaria um registro em que o que foi
    // coletado por automação é indistinguível do que foi movido pela migração
    // dos e-mails antigos (que nunca teve origem nenhuma — por isso o campo é
    // opcional em `CampoColetado`, lib/campos.ts).
    expect(await automacaoDoCampo(EU, "telefone")).toBe(AUTO);

    // E O CONTADOR ZERA NA GRAVAÇÃO. A resposta ruim lá em cima deixou o
    // contador em 1; gravado o campo, ele é sobre um campo que ninguém está
    // perguntando mais. Sem esta linha, tirar o `campo_tentativas = 0` de
    // `gravarCampo` (lib/engine.ts) não acendia nada — foi um dos plantios que
    // sobreviveram à revisão da Tarefa 4.
    expect(await tentativasDoContato(EU)).toBe(0);
  });

  test("esgotado o teto, o fluxo SEGUE sem o dado", async () => {
    // O DEFEITO QUE ISTO CONSERTA: até esta tarefa o pedido de e-mail repetia
    // PARA SEMPRE, a cada mensagem recebida, e quem nunca mandasse e-mail ficava
    // preso no passo. O `pedir_follow`, ao lado, tem teto desde sempre.
    await semearComPedido("quero-zap-dois", "telefone", "Me manda seu WhatsApp 👇", "depois do pedido");
    const EU = "9300000000000102";

    await mensagem(EU, "quero-zap-dois", "m-1");
    await dreno.drainQueue();
    for (let i = 0; i < TETO_DE_TENTATIVAS; i++) {
      await mensagem(EU, "não tenho", `m-r${i}`);
      await dreno.drainQueue();
    }

    expect(textosNoFio(EU)).toContain("depois do pedido");
    expect(await campoDoContato(EU, "telefone")).toBeNull();
    // O contador zera no estouro: a pessoa segue o fluxo, e o PRÓXIMO campo que
    // alguém pedir a ela começa do zero — o contador é sobre "o campo que está
    // sendo perguntado agora" (migrations/011-campos-do-contato.sql).
    expect(await tentativasDoContato(EU)).toBe(0);
  });

  test("campo fresco PULA o passo; campo vencido pergunta de novo", async () => {
    const EU = "9300000000000103";
    await semearCampo(EU, "telefone", "11999999999", diasAtras(5));
    await semearComPedido("quero-zap-tres", "telefone", "Me manda seu WhatsApp 👇", "depois do pedido");

    await mensagem(EU, "quero-zap-tres", "m-1");
    await dreno.drainQueue();
    // Pulou: o pedido NÃO saiu, e o que vem depois saiu.
    expect(textosNoFio(EU)).toEqual(["depois do pedido"]);

    const OUTRO = "9300000000000104";
    await semearCampo(OUTRO, "telefone", "11999999999", diasAtras(31));
    await mensagem(OUTRO, "quero-zap-tres", "m-2");
    await dreno.drainQueue();
    expect(textosNoFio(OUTRO)).toEqual(["Me manda seu WhatsApp 👇"]);
  });

  test("gravar o SEGUNDO campo não apaga o primeiro", async () => {
    // O PLANTIO QUE ESTE CASO EXISTE PARA ACUSAR: trocar o `campos ||
    // jsonb_build_object(...)` de `gravarCampo` por `campos =
    // jsonb_build_object(...)`. A forma que substitui parece igual e apaga tudo
    // o que já tinha sido coletado — e, sem este caso, gravar o telefone
    // apagaria o e-mail e nada acusaria.
    await semearComPedido("quero-os-dois", "email", "Qual é o seu e-mail?");
    const EU = "9300000000000105";
    await semearCampo(EU, "cidade", "Sorocaba", diasAtras(2));

    await mensagem(EU, "quero-os-dois", "m-d1");
    await dreno.drainQueue();
    await mensagem(EU, "bia@exemplo-do-teste.invalid", "m-d2");
    await dreno.drainQueue();

    expect(await campoDoContato(EU, "email")).toBe("bia@exemplo-do-teste.invalid");
    expect(await campoDoContato(EU, "cidade")).toBe("Sorocaba");
  });

  test("o contador zera quando a automação passa a PERGUNTAR — o teto é do campo de agora", async () => {
    // O PLANTIO QUE ESTE CASO ACUSA: tirar o `campo_tentativas = 0` do ramo que
    // envia o pedido (lib/engine.ts). `campo_tentativas` é UM contador, sobre o
    // campo que está sendo perguntado AGORA
    // (migrations/011-campos-do-contato.sql) — sem a zeragem, quem chegasse no
    // teto de um campo começaria o campo SEGUINTE já esgotado e nunca teria a
    // chance de responder a uma pergunta que nem tinha sido feita.
    await semearComPedido("quero-o-nome", "nome_informado", "Como te chamo?", "depois do nome");
    const EU = "9300000000000107";

    // A pessoa chega com o contador ESTOURADO, de um campo anterior.
    await semearCampo(EU, "cidade", "Sorocaba", diasAtras(1));
    await porTentativas(EU, TETO_DE_TENTATIVAS);

    await mensagem(EU, "quero-o-nome", "m-n1");
    await dreno.drainQueue();
    expect(textosNoFio(EU)).toEqual(["Como te chamo?"]);
    expect(await tentativasDoContato(EU)).toBe(0);

    // E uma resposta que não serve ainda REPERGUNTA: o contador do campo
    // anterior não conta contra este.
    await mensagem(EU, "🙃", "m-n2");
    await dreno.drainQueue();
    expect(textosNoFio(EU)[1]).toContain("nome");
  });

  test("o campo LIVRE grava sob a chave do passo, e aceita o que o catálogo recusaria", async () => {
    // `campo: "livre"` não está no catálogo, e é a `chave` do passo que diz onde
    // o valor mora (`lib/steps.ts`, o tipo `pedir_dado`). O extrator do livre é
    // o texto inteiro aparado: não há o que validar num campo que quem montou a
    // automação acabou de inventar.
    await semearComPedido(
      "quero-a-cidade",
      "livre",
      "De qual cidade você é?",
      "depois da cidade",
      "cidade"
    );
    const EU = "9300000000000106";

    await mensagem(EU, "quero-a-cidade", "m-l1");
    await dreno.drainQueue();
    expect(textosNoFio(EU)).toEqual(["De qual cidade você é?"]);

    await mensagem(EU, "  Sorocaba  ", "m-l2");
    await dreno.drainQueue();
    expect(await campoDoContato(EU, "cidade")).toBe("Sorocaba");
    expect(textosNoFio(EU)).toContain("depois da cidade");
  });

  test("campo LIVRE com a chave de um campo do sistema NÃO encosta no e-mail de verdade", async () => {
    // O DEFEITO, medido contra o banco pela revisão da Tarefa 4: um passo
    // `pedir_dado { campo: "livre", chave: "email" }` com a resposta "moro em
    // Sorocaba desde 1990" gravava essa frase em `campos->'email'` E NA COLUNA
    // `contacts.email` — o `case when $3 = 'email'` de `gravarCampo`
    // (lib/engine.ts) dispara sobre a CHAVE. O e-mail de um contato real virava
    // uma frase, e os seis leitores da coluna (conversas, exportação, a migração
    // que vem) herdavam o lixo sem nada acusar.
    //
    // HOJE ISSO EXIGE `steps` GRAVADO POR FORA — que é exatamente o que este
    // caso faz, com `insert` cru. Quem arma a bomba é o editor da Tarefa 5, que
    // põe o nome do campo na mão do dono; o motor é a última barreira antes do
    // banco, e é ela que este caso mede.
    //
    // AS DUAS PONTAS QUE O FECHAM: `conferir` (lib/steps.ts) recusa o bloco, e
    // por isso a pergunta nem sai; e `chaveDoPedido` devolve `null`, e por isso
    // nada seria gravado mesmo que o bloco tivesse passado. Cada uma tem caso
    // próprio em tests/steps.test.ts — aqui o que se mede é o DESFECHO: o
    // e-mail da pessoa continua o que era.
    await semearComPedido(
      "quero-o-campo-perigoso",
      "livre",
      "Qual é o seu e-mail?",
      "depois do campo perigoso",
      "email"
    );
    const EU = "9300000000000108";
    await semearEmailNaColuna(EU, "ana@exemplo-do-teste.invalid");

    await mensagem(EU, "quero-o-campo-perigoso", "m-p1");
    await dreno.drainQueue();
    await mensagem(EU, "moro em Sorocaba desde 1990", "m-p2");
    await dreno.drainQueue();

    // O e-mail de verdade continua de pé, nas duas fontes.
    expect(await emailDaColuna(EU)).toBe("ana@exemplo-do-teste.invalid");
    expect(await campoDoContato(EU, "email")).toBeNull();
    // E o bloco recusado não sequestra ninguém: o que vem depois dele sai.
    expect(textosNoFio(EU)).toContain("depois do campo perigoso");
  });

  test("chave que não vira variável: o fluxo SEGUE sem o dado, e nada é gravado", async () => {
    // A GUARDA DO PASSO QUEBRADO (`chave === null || !regra`, lib/engine.ts)
    // ganhou um caminho que a alcança, e é este. `conferir` (lib/steps.ts) só
    // cobra que a chave EXISTA — "123" atravessa o salvar —, mas
    // `normalizarChaveLivre` (lib/campos.ts) a recusa: `{{123}}` não é nome de
    // variável que alguém leia depois, e gravar o dado de uma pessoa sob `123`
    // é gravar onde ninguém lê.
    //
    // ANTES DESTE CONSERTO a chave saía CRUA e o valor era gravado sob "123".
    // A guarda existia e nenhum caminho chegava nela — a revisão mediu isso
    // apagando-a inteira sem acender luz nenhuma. Agora ela tem leitor, e o
    // desfecho é o que a tarefa promete: nunca prende, e o fluxo segue.
    await semearComPedido(
      "quero-o-campo-sem-nome",
      "livre",
      "De qual cidade você é?",
      "depois do campo sem nome",
      "123"
    );
    const EU = "9300000000000109";

    await mensagem(EU, "quero-o-campo-sem-nome", "m-s1");
    await dreno.drainQueue();
    expect(textosNoFio(EU)).toEqual(["De qual cidade você é?"]);

    await mensagem(EU, "Sorocaba", "m-s2");
    await dreno.drainQueue();

    // Nada foi gravado — nem sob a chave crua, nem sob a normalizada.
    expect(await campoDoContato(EU, "123")).toBeNull();
    // E o fluxo SEGUIU: a pessoa não ficou presa num passo que não sabe gravar.
    expect(textosNoFio(EU)).toContain("depois do campo sem nome");
    expect(await cursorDoContato(EU)).not.toBe("b_pedido0");
  });

  test("com a seta pendurada, o teto SOLTA mesmo assim — o ciclo não rearma", async () => {
    // O QUE A REVISÃO DA TAREFA 4 MEDIU, contra o banco: `pedir_dado` com uma
    // `sempre` apontando para um bloco que não existe, 12 mensagens ruins
    // depois da pergunta → 8 REPERGUNTAS, cursor ainda em `b_pedido0`,
    // `campo_tentativas` de volta a 0. `seguirSemODado` (lib/engine.ts) zerava
    // o contador ANTES de saber se o fluxo tinha andado; com a seta pendurada
    // `interpretar` devolve `cursorNoFim: "manter"`, o cursor fica onde estava,
    // e o contador zerado REARMA o ciclo. Duas reperguntas a cada três
    // mensagens, para sempre — que é exatamente a armadilha que esta tarefa
    // existe para fechar.
    //
    // A SETA PENDURADA NÃO É HIPÓTESE: `conferirLista` a trata como "bloco
    // inalcançável", que trava o ATIVAR e não o salvar, e `desligarBloco` sobre
    // lista sem `id` já gravou uma no banco (lib/steps.ts registra a medição).
    //
    // O QUE O CONSERTO PROMETE: o contador só zera quando o fluxo ANDOU. Sem
    // andar, a pessoa fica CALADA em vez de ficar sendo cutucada — o passo não
    // tem para onde ir, mas ninguém leva repergunta pelo resto da vida.
    const EU = "9300000000000110";
    await semear(
      "coleta · seta pendurada",
      "quero-a-seta-pendurada",
      [{ id: "b_pedido0", tipo: "pedir_dado", campo: "telefone", texto: "Me manda seu WhatsApp 👇" }],
      [{ de: "b_pedido0", quando: { tipo: "sempre" }, para: "b_naoexiste" }]
    );

    await mensagem(EU, "quero-a-seta-pendurada", "m-sp0");
    await dreno.drainQueue();
    expect(textosNoFio(EU)).toEqual(["Me manda seu WhatsApp 👇"]);

    // DOZE mensagens ruins — quatro vezes o teto.
    for (let i = 0; i < 12; i++) {
      await mensagem(EU, "não tenho", `m-sp${i + 1}`);
      await dreno.drainQueue();
    }

    // A conversa inteira: a pergunta e as reperguntas que o teto permite
    // (`TETO_DE_TENTATIVAS` chances = `TETO_DE_TENTATIVAS - 1` reperguntas), e
    // NADA depois disso. Com o defeito eram 9 mensagens; com o conserto, 3.
    expect(textosNoFio(EU)).toHaveLength(TETO_DE_TENTATIVAS);

    // O cursor não tem para onde ir, e continua onde estava — isto é o preço
    // conhecido da seta pendurada, e não o defeito.
    expect(await cursorDoContato(EU)).toBe("b_pedido0");
    // O QUE NÃO PODE ACONTECER: o contador voltar a zero e rearmar o ciclo.
    expect(await tentativasDoContato(EU)).toBeGreaterThanOrEqual(TETO_DE_TENTATIVAS);
  });
  test("DOIS campos na mesma automação: a segunda pergunta CHEGA", async () => {
    // O DEFEITO QUE ESTE CASO FECHA É A CHAVE DE ENFILEIRAMENTO, e ele é
    // invisível de todo lado menos daqui: `emailAskKey` (lib/dedupe.ts) era
    // automação + pessoa + DIA. Enquanto a paleta montava UM `pedir_dado` por
    // automação isso bastava; o editor desta tarefa pôs cinco pedidos na faixa,
    // e aí os dois pedidos do mesmo dia caíam na MESMA `dedupe_key`. O `on
    // conflict do nothing` de `enqueue` engolia o segundo EM SILÊNCIO — sem
    // erro, sem `step_ignorado`, sem nada em Atividade. A pessoa respondia o
    // e-mail e simplesmente nunca era perguntada sobre o telefone.
    //
    // NENHUM TESTE PURO ALCANÇA ISTO: a chave é string, o formato está trancado
    // em tests/dedupe.test.ts, e o que engole o item é o índice UNIQUE do
    // Postgres. É preciso o banco de verdade para que o segundo pedido suma.
    const EU = "9300000000000120";
    // A PALAVRA NÃO PODE CONTER A DE OUTRO CASO: o gatilho é `contains`, e
    // "quero-os-dois-campos" casava com a automação de "quero-os-dois" (o caso
    // do campo já fresco, acima) — `findMatch` escolhia AQUELA, que só pede o
    // e-mail, e este caso ficava vermelho acusando um defeito que não existia.
    await semear(
      "coleta · dois campos",
      "coletar-dois-dados-distintos",
      [
        { id: "b_pedido0", tipo: "pedir_dado", campo: "email", texto: "Qual é o seu e-mail?" },
        { id: "b_pedido1", tipo: "pedir_dado", campo: "telefone", texto: "Me manda seu WhatsApp 👇" },
        { id: "b_depois0", tipo: "dm", texto: "depois dos dois" },
      ],
      [
        { de: "b_pedido0", quando: { tipo: "sempre" }, para: "b_pedido1" },
        { de: "b_pedido1", quando: { tipo: "sempre" }, para: "b_depois0" },
      ]
    );

    await mensagem(EU, "coletar-dois-dados-distintos", "m-2c0");
    await dreno.drainQueue();
    expect(textosNoFio(EU)).toEqual(["Qual é o seu e-mail?"]);

    // A resposta do primeiro campo destrava o segundo pedido — NO MESMO DIA,
    // que é a condição em que as duas chaves colidiam.
    await mensagem(EU, "meu email é bia@exemplo-do-teste.invalid", "m-2c1");
    await dreno.drainQueue();
    expect(await campoDoContato(EU, "email")).toBe("bia@exemplo-do-teste.invalid");
    // ESTA É A LINHA DO DEFEITO: com a chave antiga o fio parava na primeira
    // pergunta, e esta segunda nunca aparecia.
    expect(textosNoFio(EU)).toContain("Me manda seu WhatsApp 👇");

    // E o segundo campo é coletado de verdade, no lugar dele.
    await mensagem(EU, "meu zap é (11) 98888-7777", "m-2c2");
    await dreno.drainQueue();
    expect(await campoDoContato(EU, "telefone")).toBe("11988887777");
    expect(textosNoFio(EU)).toContain("depois dos dois");
  });

  test("DOIS campos livres de chave ilegível: a segunda pergunta CHEGA assim mesmo", async () => {
    // O QUE ESTE CASO PRENDE é o `chave ?? identidadeDoPasso(p, acao.indice)` da
    // chave de enfileiramento (lib/engine.ts). Uma revisão trocou o `??` por uma
    // string fixa e A INTEGRAÇÃO INTEIRA ficou verde — o comentário de três
    // parágrafos em cima daquela linha descrevia este cenário e nada o media.
    //
    // O CAMINHO É REAL. `chaveDoPedido` (lib/steps.ts) devolve `null` para
    // chave que não vira variável ("123", "🔥"), e o motor SEGUE o fluxo sem
    // gravar — é a guarda do passo quebrado, com caso próprio logo acima. Com a
    // chave caindo numa string fixa, DOIS blocos assim na mesma automação saem
    // com a MESMA `dedupe_key`, e o `on conflict do nothing` de `enqueue` engole
    // o segundo EM SILÊNCIO: sem erro, sem `step_ignorado`, sem nada em
    // Atividade. É o mesmo defeito que a chave por campo existe para fechar,
    // pela porta dos fundos.
    //
    // POR QUE UMA AUTOMAÇÃO ASSIM EXISTE NO BANCO: `conferirLista` acusa as
    // duas chaves e TRAVA O SALVAR desde a tarefa dos consertos, então a tela
    // não monta mais uma destas. Chega-se aqui por `steps` gravado por fora ou
    // por automação salva antes daquela regra — que é exatamente a população
    // que a rede do `??` existe para atender, e é por isso que este caso semeia
    // direto no banco em vez de passar pelo editor.
    const EU = "9300000000000130";
    await semear(
      "coleta · dois livres ilegíveis",
      "coletar-dois-livres-ilegiveis",
      [
        { id: "b_pedido0", tipo: "pedir_dado", campo: "livre", chave: "123", texto: "Primeira?" },
        { id: "b_pedido1", tipo: "pedir_dado", campo: "livre", chave: "456", texto: "Segunda?" },
        { id: "b_depois0", tipo: "dm", texto: "depois das duas" },
      ],
      [
        { de: "b_pedido0", quando: { tipo: "sempre" }, para: "b_pedido1" },
        { de: "b_pedido1", quando: { tipo: "sempre" }, para: "b_depois0" },
      ]
    );

    await mensagem(EU, "coletar-dois-livres-ilegiveis", "m-2l0");
    await dreno.drainQueue();
    expect(textosNoFio(EU)).toEqual(["Primeira?"]);

    // A pessoa responde. A chave não vira variável, então NADA é gravado e o
    // fluxo segue — e o segundo pedido sai NO MESMO DIA, que é a condição em
    // que as duas chaves de envio colidiriam.
    await mensagem(EU, "Sorocaba", "m-2l1");
    await dreno.drainQueue();
    expect(await campoDoContato(EU, "123")).toBeNull();
    // ESTA É A LINHA DO DEFEITO: com a chave de envio caindo numa string fixa,
    // o fio parava na primeira pergunta e esta segunda nunca aparecia.
    expect(textosNoFio(EU)).toContain("Segunda?");

    // E o fluxo chega ao fim, sem prender ninguém no meio.
    await mensagem(EU, "Itu", "m-2l2");
    await dreno.drainQueue();
    expect(textosNoFio(EU)).toContain("depois das duas");
  });
  test("a promessa da tela: o dado coletado chega DENTRO da mensagem seguinte", async () => {
    // A DÍVIDA DA TAREFA 5, MEDIDA DA TELA ATÉ O FIO.
    //
    // O painel mostra ao dono, enquanto ele digita "Qual sua Cidade", que a
    // resposta "vai virar {{qual_sua_cidade}}"
    // (app/automacoes/editor/painel.tsx). Até a fiação das variáveis existir
    // essa frase era FALSA: `renderVariables` (lib/variables.ts) não conhecia a
    // chave, APAGAVA o token, e o lead recebia a mensagem com um buraco no
    // lugar do dado que ele mesmo acabara de responder.
    //
    // POR QUE AQUI E NÃO SÓ NA SUÍTE PURA: o caso puro prende
    // `renderVariables`, e ele sozinho ficaria verde com a consulta de
    // `variableContext` (lib/queue-drain.ts) sem a coluna `campos` — o contexto
    // chegaria sem registro nenhum e o buraco voltaria, calado. Este caso é o
    // único que atravessa a gravação do motor, a leitura do dreno e a
    // renderização no mesmo fio.
    //
    // A CHAVE SEMEADA É O TEXTO CRU, como o editor a grava desde que o rascunho
    // do dono passou a sobreviver: quem a normaliza é `chaveDoPedido`
    // (lib/steps.ts), do outro lado, a cada mensagem. Semear já normalizado
    // mediria um par inventado, e não o par que a tela promete.
    const EU = "9300000000000140";
    await semearComPedido(
      "quero-dizer-a-cidade",
      "livre",
      "De qual cidade você é?",
      "Boa! Anotei que você é de {{qual_sua_cidade}}.",
      "Qual sua Cidade"
    );

    await mensagem(EU, "quero-dizer-a-cidade", "m-cid0");
    await dreno.drainQueue();
    expect(textosNoFio(EU)).toEqual(["De qual cidade você é?"]);

    await mensagem(EU, "Osasco", "m-cid1");
    await dreno.drainQueue();

    // Gravou sob a chave NORMALIZADA — é ela que a variável da mensagem lê.
    expect(await campoDoContato(EU, "qual_sua_cidade")).toBe("Osasco");
    // E É ESTA A LINHA DA DÍVIDA: antes da fiação o fio trazia "Boa! Anotei que
    // você é de ." — a frase inteira, com o buraco no lugar da cidade.
    expect(textosNoFio(EU)).toContain("Boa! Anotei que você é de Osasco.");
  });

  test("a variável de campo do catálogo também chega ao fio", async () => {
    // O CAMINHO DO TELEFONE, e ele não é o mesmo do campo livre: a variável do
    // livre é resolvida por chave, fora da lista fixa, e a do catálogo nasce de
    // `CAMPOS` dentro de `VARIABLES` (lib/variables.ts). São dois ramos de
    // `renderVariables`, e só um deles seria exercido pelo caso da cidade.
    const EU = "9300000000000141";
    await semearComPedido(
      "quero-dizer-o-zap",
      "telefone",
      "Me manda seu WhatsApp com DDD 👇",
      "Anotado: {{telefone}}."
    );

    await mensagem(EU, "quero-dizer-o-zap", "m-zv0");
    await dreno.drainQueue();
    await mensagem(EU, "meu zap é (11) 98888-7777", "m-zv1");
    await dreno.drainQueue();

    expect(await campoDoContato(EU, "telefone")).toBe("11988887777");
    expect(textosNoFio(EU)).toContain("Anotado: 11988887777.");
  });
});
