// O QUARTO CAMINHO DA FRENTE 2: do gatilho até a entrega.
//
// A PROMESSA, escrita como teste: **a automação entrega o que o editor montou.**
// O gatilho dispara, a caminhada percorre o GRAFO, o dreno entrega — e o que sai
// no fio é o que o mapa de caminhos manda, na ordem que ele manda.
//
// É o único caminho da Frente 2 que atravessa o sistema inteiro numa tacada:
// webhook -> `handleMessagingEvent`/`handleCommentEvent` -> `interpretar` ->
// fila -> `drainQueue` -> o corpo JSON que chegaria à Meta. Os três anteriores
// mediam um trecho cada; este mede a costura entre eles, que é onde ninguém
// olhava.
//
// -----------------------------------------------------------------------------
// A ORDEM DO ARRAY É DE PROPÓSITO DIFERENTE DA ORDEM DO GRAFO
//
// É a decisão de desenho mais importante deste arquivo, e ela vale para os
// quatro casos. Desde a Fase 2a a lista de blocos não diz mais o que vem depois:
// quem diz são as setas, e a ordem do array guarda UM significado só — `steps[0]`
// é a entrada do fluxo. Um teste cujo array já estivesse na ordem do grafo
// passaria com um motor que caminhasse pelo array, e não mediria nada.
//
// Aqui o array é [entrada, FIM, meio, bloco solto] e as setas são
// entrada -> meio -> fim. Se a caminhada voltar a somar 1 na posição, o fio
// acusa.
//
// -----------------------------------------------------------------------------
// ESTE CAMINHO NÃO NASCEU PARA MATAR ITEM DE LISTA
//
// Como o terceiro, ele não persegue defeito conhecido: dos oito sobreviventes da
// medição da Fase 2a, cinco já morreram e os três que restam vivem em arquivos
// que este teste não importa. O valor dele é ter DENTES, e dentes se provam
// plantando defeito plausível e vendo o teste acusar. A tabela dessas medições
// está no relatório da tarefa (`scratchpad/frente2-toque-e-gatilho.md`) e no
// plano da Frente 2.
//
// -----------------------------------------------------------------------------
// O CENÁRIO É MONTADO COMO A PRODUÇÃO MONTA, E CONFERIDO PELO QUE SAIU
//
//   MONTAR é gravar em `automations` o `steps` e as `ligacoes` que o editor
//     gravaria, por `insert` cru. Nenhuma função de decisão participa.
//   DISPARAR é entregar ao motor o evento que a Meta entrega — uma DM com a
//     palavra-chave, ou um comentário.
//   CONFERIR é olhar O QUE CHEGOU NO SERVIDOR LOCAL: o corpo JSON que o produto
//     entregaria ao Instagram. E, onde a pergunta é sobre tempo, a linha da fila
//     — `status` e `not_before` —, que é o que de fato segura o item.
//
// -----------------------------------------------------------------------------
// NADA DE MOCK, E NADA SAI DA MÁQUINA
//
// Não há `vi.mock`, não há `vi.stubGlobal`, não há banco de mentira. O `fetch` é
// o do Node, o POST é HTTP de verdade, o corpo é serializado pelo `sendMessage`
// (e pelo `replyToComment`) de verdade e parseado do outro lado. O que foi
// substituído é a OUTRA PONTA DO FIO, pelo mecanismo que o primeiro caminho
// criou: `IG_GRAPH_BASE` + `baseDoGraph()` (lib/ig.ts), com as duas travas dele.
// A guarda que falha ANTES de qualquer requisição sair está no `beforeAll`.
//
// E há uma SEGUNDA fronteira de rede neste caminho, que os anteriores não
// tocavam: `enqueue` e `drainQueue` chamam `scheduleTick` (lib/qstash.ts) quando
// há item adiado — e este arquivo tem um, de propósito. Ela sai por um cliente
// do Upstash que NÃO passa por `baseDoGraph()`, então o desvio do Graph não a
// cobre. Quem a segura é `qstashEnabled()`, que é falso sem `QSTASH_TOKEN`; o
// `beforeAll` apaga a variável e AFIRMA o falso, em vez de torcer.
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { bancoDescartavel } from "./harness";
// `lib/steps.ts` não tem import nenhum e não fala com o banco: pode ser
// importado no topo. Os módulos que tocam o banco (ou a rede) são importados
// dentro do `beforeAll`, depois de a DATABASE_URL estar pronta.
import { lerPayload } from "@/lib/steps";

type ModuloEngine = typeof import("@/lib/engine");
type ModuloIg = typeof import("@/lib/ig");
type ModuloDreno = typeof import("@/lib/queue-drain");
type ModuloQstash = typeof import("@/lib/qstash");

const banco = bancoDescartavel();

const CONTA = "17800000000000321";
// Valor inventado. Nenhuma credencial de verdade entra em teste — e o servidor
// que faz as vezes da Meta confere que foi ESTE token que chegou nele.
const TOKEN = "token-de-teste-que-nao-vale-nada";

const LINK = "https://exemplo-do-teste.invalid/a-recompensa";

// ---------------------------------------------------------------------------
// A META FALSA — a outra ponta do fio, e nada além disso.
//
// Ela guarda o que chegou em cada um dos dois caminhos de ENTREGA que este
// arquivo exercita: a mensagem (POST /{conta}/messages) e a resposta pública ao
// comentário (POST /{comentário}/replies). Qualquer outro caminho volta 404,
// para que uma pergunta nova apareça na lista em vez de receber resposta
// inventada.
// ---------------------------------------------------------------------------

type Botao = { content_type: string; title: string; payload: string };
type BotaoDeLink = { type: string; url: string; title: string };

type MensagemNoFio = {
  destinatario: { id?: string; comment_id?: string };
  texto: string;
  botoes: Botao[];
  // O template de botão de link (`linkMessage`, lib/ig.ts): é ele que carrega a
  // url, e é por ele que o link do editor chega à pessoa.
  linkDoAnexo: string | null;
  rotuloDoAnexo: string | null;
  textoDoAnexo: string | null;
  autorizacao: string | null;
  caminho: string;
};

type RespostaPublicaNoFio = { caminho: string; mensagem: string };

const meta = {
  enviadas: [] as MensagemNoFio[],
  publicas: [] as RespostaPublicaNoFio[],
  desconhecidos: [] as string[],
};

function doDestinatario(m: MensagemNoFio): string {
  return m.destinatario.id ?? m.destinatario.comment_id ?? "";
}

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
    const lerCorpo = (pronto: (texto: string) => void) => {
      const pedacos: Buffer[] = [];
      req.on("data", (d: Buffer) => pedacos.push(d));
      req.on("end", () => pronto(Buffer.concat(pedacos).toString("utf8")));
    };

    // O envio de mensagem: é este corpo que a maior parte do teste examina.
    if (req.method === "POST" && u.pathname.endsWith("/messages")) {
      lerCorpo((texto) => {
        const corpo = JSON.parse(texto) as {
          recipient: { id?: string; comment_id?: string };
          message: {
            text?: string;
            quick_replies?: Botao[];
            attachment?: {
              type?: string;
              payload?: { template_type?: string; text?: string; buttons?: BotaoDeLink[] };
            };
          };
        };
        const anexo = corpo.message.attachment?.payload;
        meta.enviadas.push({
          destinatario: corpo.recipient,
          texto: corpo.message.text ?? "",
          botoes: corpo.message.quick_replies ?? [],
          linkDoAnexo: anexo?.buttons?.[0]?.url ?? null,
          rotuloDoAnexo: anexo?.buttons?.[0]?.title ?? null,
          textoDoAnexo: anexo?.text ?? null,
          autorizacao: req.headers.authorization ?? null,
          caminho: u.pathname,
        });
        responder({ message_id: `mid-do-teste-${meta.enviadas.length}`, recipient_id: "r-1" });
      });
      return;
    }

    // A resposta PÚBLICA ao comentário (`replyToComment`, lib/ig.ts). Ela vai
    // por `application/x-www-form-urlencoded`, e não por JSON — outro formato,
    // outro parser, e por isso o corpo é lido como formulário aqui.
    if (req.method === "POST" && u.pathname.endsWith("/replies")) {
      lerCorpo((texto) => {
        meta.publicas.push({
          caminho: u.pathname,
          mensagem: new URLSearchParams(texto).get("message") ?? "",
        });
        responder({ id: `comentario-do-teste-${meta.publicas.length}` });
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
  // A SEGUNDA FRONTEIRA (ver o cabeçalho): o agendador do QStash não passa pelo
  // desvio do Graph. Sem token ele não sai — e a linha abaixo garante que não há
  // token, em vez de supor que a máquina de quem roda não tem um.
  delete process.env.QSTASH_TOKEN;

  engine = await import("@/lib/engine");
  ig = await import("@/lib/ig");
  dreno = await import("@/lib/queue-drain");
  qstash = await import("@/lib/qstash");

  // FALHA ANTES DE QUALQUER REQUISIÇÃO, e não depois — a mesma guarda dos três
  // caminhos anteriores, pela mesma razão. Sem o desvio, este teste tentaria
  // ENVIAR MENSAGEM e RESPONDER COMENTÁRIO pela Meta de verdade, com o texto
  // dentro.
  if (ig.baseDoGraph() !== process.env.IG_GRAPH_BASE) {
    throw new Error(
      `RECUSADO: a base do Graph é ${ig.baseDoGraph()}, e tinha de ser a desta ` +
        `rodada (${process.env.IG_GRAPH_BASE}). Sem o desvio, este teste tentaria ` +
        `ENTREGAR pela Meta de verdade.`
    );
  }
  if (qstash.qstashEnabled()) {
    throw new Error(
      "RECUSADO: o QStash está habilitado nesta rodada. O item adiado deste " +
        "teste faria `scheduleTick` publicar um agendamento de verdade, e essa " +
        "chamada NÃO passa pelo desvio do Graph."
    );
  }

  await banco.db().upsertAccount({
    ig_user_id: CONTA,
    username: "conta_do_gatilho",
    name: "Conta do gatilho",
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
  gatilhos: string,
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
       values ($1, $2, true, string_to_array($3, ','), string_to_array($4, ','), 'contains',
               $5::text::jsonb, $6::text::jsonb)
       returning id`,
      [CONTA, nome, gatilhos, palavra, JSON.stringify(steps), JSON.stringify(ligacoes)]
    )) as { id: string }[];
  return linhas[0].id;
}

type LinhaDaFila = {
  id: string;
  kind: string;
  status: string;
  segundos_para_soltar: number;
  payload: { text?: string };
};

// A fila desta pessoa, com o que segura cada item: o `status` e QUANTO FALTA
// para `not_before` chegar — contado pelo relógio do BANCO, que é o mesmo que o
// dreno compara. Trazer o instante e comparar com o relógio do Node poria dois
// relógios na mesma conta, que é o defeito que `enqueue` (lib/engine.ts)
// registra ter custado 53,9 segundos de atraso nesta máquina.
async function fila(contatoIgId: string): Promise<LinhaDaFila[]> {
  return (await banco
    .db()
    .sql()
    .query(
      `select id, kind, status, payload,
              extract(epoch from (not_before - now()))::float8 as segundos_para_soltar
         from queue
        where account_id = $1 and contact_ig_id = $2
        order by created_at asc, id asc`,
      [CONTA, contatoIgId]
    )) as LinhaDaFila[];
}

// Uma mensagem de texto chegando pelo webhook, como a Meta a entrega. Ela também
// é o que ABRE A JANELA DE 24H: `handleMessagingEvent` grava `last_reply_at`.
async function mensagem(igId: string, texto: string, mid: string) {
  await engine.handleMessagingEvent(CONTA, { sender: { id: igId }, message: { mid, text: texto } });
}

// Um comentário num post, como a Meta o entrega.
async function comentario(igId: string, texto: string, commentId: string, mediaId: string) {
  await engine.handleCommentEvent(CONTA, {
    id: commentId,
    from: { id: igId, username: "quem_comentou" },
    media: { id: mediaId },
    text: texto,
  });
}

// O que chegou no fio para ESTE destinatário — pessoa ou comentário. Filtrar é o
// que deixa os casos independentes: `drainQueue` esvazia a fila INTEIRA, então
// um caso pode acabar entregando item que outro deixou pendente.
function noFio(destinatario: string): MensagemNoFio[] {
  return meta.enviadas.filter((m) => doDestinatario(m) === destinatario);
}

function textosNoFio(destinatario: string): string[] {
  // O texto de uma mensagem com link mora DENTRO do anexo (é o template de
  // botão), e não em `message.text`. Ler só um dos dois faria metade das
  // entregas do produto parecer vazia.
  return noFio(destinatario).map((m) => m.textoDoAnexo ?? m.texto);
}

// ---------------------------------------------------------------------------

describe("o gatilho dispara, e o que sai é o que o mapa de caminhos manda", () => {
  test("A ORDEM É A DO GRAFO, NÃO A DO ARRAY — e o bloco solto não sai", async () => {
    // O array está EMBARALHADO de propósito: a entrada, depois o FIM, depois o
    // meio, depois um bloco que nenhuma seta alcança. Um motor que caminhasse
    // pelo array entregaria "1, 3, 2, solto"; o grafo manda "1, 2, 3".
    const AUTO = await semear(
      "A · o grafo contra o array",
      "dm",
      "quero-a-ordem",
      [
        { id: "b_entrada", tipo: "dm", texto: "1 · o começo" },
        { id: "b_ofim003", tipo: "dm", texto: "3 · o fim" },
        { id: "b_omeio02", tipo: "dm", texto: "2 · o meio" },
        { id: "b_solto04", tipo: "dm", texto: "bloco solto, sem seta chegando" },
      ],
      [
        { de: "b_entrada", quando: { tipo: "sempre" }, para: "b_omeio02" },
        { de: "b_omeio02", quando: { tipo: "sempre" }, para: "b_ofim003" },
      ]
    );
    const EU = "9300000000000001";

    await mensagem(EU, "quero-a-ordem", "m-ordem-1");

    // A fila recebeu os três da caminhada, e nenhum deles é o bloco solto.
    expect((await fila(EU)).map((l) => l.payload.text)).toEqual([
      "1 · o começo",
      "2 · o meio",
      "3 · o fim",
    ]);

    // O DRENO DE VERDADE. Daqui para baixo, tudo o que o teste olha é o que
    // chegou no fio.
    await dreno.drainQueue();

    // NO FIO, A ORDEM — e esta linha é a razão de o defeito de ordem existir na
    // lista de achados da Frente 2, em vez de continuar em produção.
    //
    // A afirmação da FILA, logo acima, prova a decisão do MOTOR: a caminhada é a
    // do grafo. Esta prova a decisão do DRENO, que é outra e mora noutro arquivo
    // — e as duas juntas são a promessa inteira, porque uma fila em ordem
    // entregue fora de ordem é a mesma conversa quebrada.
    //
    // O QUE FOI MEDIDO, quando este caso nasceu: os três itens nascem com
    // `created_at` DISTINTO e crescente (26 ms entre eles), e mesmo assim o fio
    // recebia `["3 · o fim", "1 · o começo", "2 · o meio"]` — e noutra sonda, com
    // oito itens, `u8 u5 u6 u7 u1 u4 u2 u3`. A causa estava na consulta de
    // `drainQueue` (lib/queue-drain.ts): o `order by created_at` vivia DENTRO da
    // subconsulta, onde escolhe QUAIS itens entram no lote e não em que ordem
    // eles voltam — a ordem do `returning` de um `update` não é especificada pelo
    // Postgres. O laço que envia segue a ordem que vier.
    //
    // Em produção isso é "Oi! Toca no botão pra receber o link" chegando DEPOIS
    // do cartão com o link. NÃO era regressão de nada nosso: é antigo, e ninguém
    // tinha como ver porque nenhum teste executava o dreno. Consertado com um
    // `with` que ordena o lote POR FORA, no banco — o porquê de não ser um
    // `sort()` em JavaScript está escrito lá, e é medição, não gosto.
    expect(textosNoFio(EU)).toEqual(["1 · o começo", "2 · o meio", "3 · o fim"]);
    // O bloco solto não foi entregue por caminho nenhum — nem fora de ordem, nem
    // no fim. É a metade que uma afirmação só sobre os três primeiros não faria.
    expect(textosNoFio(EU)).not.toContain("bloco solto, sem seta chegando");

    // Foi para a conta certa, com o token da conta, e para a pessoa certa.
    const primeira = noFio(EU)[0];
    expect(primeira.caminho).toBe(`/${ig.API_VERSION}/${CONTA}/messages`);
    expect(primeira.autorizacao).toBe(`Bearer ${TOKEN}`);
    expect(primeira.destinatario).toEqual({ id: EU });

    // A fila diz `sent` nos três: eles foram entregues, não abandonados.
    expect((await fila(EU)).map((l) => l.status)).toEqual(["sent", "sent", "sent"]);
    expect(AUTO).toBeTruthy();
    expect(meta.desconhecidos).toEqual([]);
  });

  test("A ESPERA DO EDITOR SEGURA O QUE VEM DEPOIS — e não o descarta", async () => {
    // O bloco `esperar` é o único que não vira mensagem: ele adia o que vem
    // DEPOIS dele. As duas metades da promessa são afirmadas, e a segunda é a
    // que importa mais — segurar e nunca soltar seria o mesmo que perder.
    await semear(
      "B · a espera do editor",
      "dm",
      "quero-a-espera",
      [
        { id: "b_agoraaa", tipo: "dm", texto: "Isto sai agora." },
        { id: "b_depois2", tipo: "dm", texto: "Isto sai depois." },
        { id: "b_espera1", tipo: "esperar", minutos: 5 },
      ],
      [
        { de: "b_agoraaa", quando: { tipo: "sempre" }, para: "b_espera1" },
        { de: "b_espera1", quando: { tipo: "sempre" }, para: "b_depois2" },
      ]
    );
    const EU = "9300000000000002";

    await mensagem(EU, "quero-a-espera", "m-espera-1");

    // DOIS itens na fila, e o segundo nasce adiado — 5 minutos são 300
    // segundos, contados pelo relógio do banco. A margem para baixo existe
    // porque o `now()` da conta é posterior ao do `insert`.
    const antes = await fila(EU);
    expect(antes.map((l) => l.payload.text)).toEqual(["Isto sai agora.", "Isto sai depois."]);
    expect(antes[0].segundos_para_soltar).toBeLessThanOrEqual(0);
    expect(antes[1].segundos_para_soltar).toBeGreaterThan(240);
    expect(antes[1].segundos_para_soltar).toBeLessThanOrEqual(300);

    await dreno.drainQueue();

    // SÓ A PRIMEIRA SAIU. A segunda continua `pending` — não foi entregue antes
    // da hora, e também não virou `failed` nem `skipped`.
    expect(textosNoFio(EU)).toEqual(["Isto sai agora."]);
    const meio = await fila(EU);
    expect(meio.map((l) => l.status)).toEqual(["sent", "pending"]);

    // E AGORA O TEMPO PASSA. Quem o faz passar é o BANCO, na coluna que o dreno
    // compara — não um relógio falso, não um `vi.useFakeTimers`. É a única coisa
    // que separa este instante daquele em que a Meta receberia a segunda
    // mensagem de verdade.
    await banco
      .db()
      .sql()
      .query(`update queue set not_before = now() where id = $1`, [meio[1].id]);

    await dreno.drainQueue();

    // A ESPERA ERA ESPERA, e não descarte: a segunda chegou, e DEPOIS da
    // primeira.
    expect(textosNoFio(EU)).toEqual(["Isto sai agora.", "Isto sai depois."]);
    expect((await fila(EU)).map((l) => l.status)).toEqual(["sent", "sent"]);
  });

  test("GATILHO POR COMENTÁRIO: a resposta privada fura a janela, com o link e o botão", async () => {
    // O caminho que só existe por inteiro aqui: quem comentou NUNCA mandou DM,
    // então a janela de 24h está fechada e uma DM comum seria descartada como
    // `skipped`. A primeira mensagem da execução sai como RESPOSTA PRIVADA,
    // endereçada ao COMENTÁRIO, e é isso que a faz chegar.
    //
    // O fluxo tem as duas entregas que um gatilho de comentário produz, e elas
    // vão por caminhos de rede DIFERENTES: a resposta privada por
    // `POST /{conta}/messages`, a pública por `POST /{comentário}/replies`.
    await semear(
      "C · o comentário",
      "comment",
      "eu-quero",
      [
        {
          id: "b_privada",
          tipo: "dm",
          texto: "Toma o link, como combinado!",
          botao_label: "Pegar agora",
          url: LINK,
        },
        { id: "b_publica", tipo: "resposta_publica", textos: ["Te mandei no direct 👀"] },
      ],
      [{ de: "b_privada", quando: { tipo: "sempre" }, para: "b_publica" }]
    );
    const QUEM_COMENTOU = "9300000000000003";
    const COMENTARIO = "17900000000000555";

    await comentario(QUEM_COMENTOU, "eu-quero", COMENTARIO, "17900000000000999");

    // A janela está FECHADA: esta pessoa nunca mandou DM. É a condição do caso,
    // e ela é conferida no banco em vez de suposta.
    const contato = (await banco
      .db()
      .sql()
      .query(`select last_reply_at from contacts where account_id = $1 and ig_id = $2`, [
        CONTA,
        QUEM_COMENTOU,
      ])) as { last_reply_at: Date | null }[];
    expect(contato[0]?.last_reply_at ?? null).toBe(null);

    expect((await fila(QUEM_COMENTOU)).map((l) => l.kind)).toEqual([
      "private_reply",
      "comment_reply",
    ]);

    await dreno.drainQueue();

    // A RESPOSTA PRIVADA CHEGOU, endereçada ao COMENTÁRIO e não à pessoa — é
    // por esse endereço que ela fura a janela.
    const privadas = noFio(COMENTARIO);
    expect(privadas.length).toBe(1);
    expect(privadas[0].destinatario).toEqual({ comment_id: COMENTARIO });
    // Nada foi endereçado à PESSOA: uma DM comum aqui teria sido descartada.
    expect(noFio(QUEM_COMENTOU)).toEqual([]);

    // E ELA LEVA O LINK E O RÓTULO QUE O EDITOR ESCREVEU. O link é o motivo de a
    // automação existir; sair sem ele é a mensagem chegar vazia de propósito.
    expect(privadas[0].textoDoAnexo).toBe("Toma o link, como combinado!");
    expect(privadas[0].linkDoAnexo).toBe(LINK);
    expect(privadas[0].rotuloDoAnexo).toBe("Pegar agora");

    // A RESPOSTA PÚBLICA saiu pelo outro caminho de rede, para o comentário
    // certo, com o texto que o editor sorteou da lista de um item.
    expect(meta.publicas.length).toBe(1);
    expect(meta.publicas[0].caminho).toBe(`/${ig.API_VERSION}/${COMENTARIO}/replies`);
    expect(meta.publicas[0].mensagem).toBe("Te mandei no direct 👀");

    // As duas foram entregues.
    expect((await fila(QUEM_COMENTOU)).map((l) => l.status)).toEqual(["sent", "sent"]);
  });

  test("O GATILHO CERTO DISPARA A AUTOMAÇÃO CERTA — e nenhum outro texto dispara nada", async () => {
    // Duas automações ATIVAS na mesma conta, com palavras-chave diferentes. Uma
    // automação só não provaria nada: um motor que devolvesse sempre a primeira
    // da lista passaria.
    //
    // A segunda tem um menu, e ela existe para uma segunda afirmação: o que o
    // gatilho entrega é o BLOCO DE ENTRADA e o que a caminhada alcança dele — os
    // braços de `botao` ficam para quem tocar, e não saem junto.
    await semear(
      "D · a promo",
      "dm",
      "quero-a-promo",
      [{ id: "b_promo01", tipo: "dm", texto: "A promo é essa." }],
      []
    );
    await semear(
      "E · a aula",
      "dm",
      "quero-a-aula",
      [
        {
          id: "b_aula001",
          tipo: "dm",
          texto: "A aula é essa. Qual módulo?",
          botoes: [
            { id: "op_mod001", rotulo: "Módulo 1" },
            { id: "op_mod002", rotulo: "Módulo 2" },
          ],
        },
        { id: "b_modul01", tipo: "dm", texto: "Módulo 1, então." },
        { id: "b_modul02", tipo: "dm", texto: "Módulo 2, então." },
      ],
      [
        { de: "b_aula001", quando: { tipo: "botao", botao: "op_mod001" }, para: "b_modul01" },
        { de: "b_aula001", quando: { tipo: "botao", botao: "op_mod002" }, para: "b_modul02" },
      ]
    );

    const DA_AULA = "9300000000000004";
    const DA_PROMO = "9300000000000005";
    const SEM_PALAVRA = "9300000000000006";

    await mensagem(DA_AULA, "quero-a-aula", "m-gatilho-1");
    await mensagem(DA_PROMO, "quero-a-promo", "m-gatilho-2");
    // Nenhuma palavra-chave, nenhum cursor: não há automação a disparar. A
    // pessoa existe (a janela abre), e não recebe nada.
    await mensagem(SEM_PALAVRA, "bom dia, tudo certo?", "m-gatilho-3");

    await dreno.drainQueue();

    // CADA UMA A SUA, e a lista inteira é afirmada — é ela que diz que a outra
    // NÃO chegou junto.
    expect(textosNoFio(DA_PROMO)).toEqual(["A promo é essa."]);
    expect(textosNoFio(DA_AULA)).toEqual(["A aula é essa. Qual módulo?"]);
    // E ninguém recebeu nada por escrever "bom dia".
    expect(textosNoFio(SEM_PALAVRA)).toEqual([]);
    expect((await fila(SEM_PALAVRA)).length).toBe(0);

    // O MENU PAROU A CAMINHADA: os dois braços não saíram junto com a entrada.
    // Eles são de quem tocar, e o gatilho não toca em nada.
    expect(textosNoFio(DA_AULA)).not.toContain("Módulo 1, então.");
    expect(textosNoFio(DA_AULA)).not.toContain("Módulo 2, então.");

    // E os botões que o editor desenhou chegaram na mensagem da entrada, com o
    // payload de quatro partes que os torna tocáveis. `lerPayload` aqui é
    // leitora: quem escreveu foi o motor.
    const daAula = noFio(DA_AULA)[0];
    expect(daAula.botoes.map((b) => b.title)).toEqual(["Módulo 1", "Módulo 2"]);
    expect(lerPayload(daAula.botoes[1].payload)?.botaoId).toBe("op_mod002");

    expect(meta.desconhecidos).toEqual([]);
  });
});
