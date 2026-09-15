// O TETO DE TEMPO DE UMA LEITURA na API do Instagram, e a prova de que ele NÃO
// vale para envio.
//
// -----------------------------------------------------------------------------
// O DEFEITO
//
// `graphFetch` (lib/ig.ts) fazia `await fetch(...)` sem `AbortController`, sem
// `signal`, sem timeout nenhum. Se a Meta aceitasse a conexão e não
// respondesse, a chamada ficava pendurada para sempre — segurando socket e
// memória até o processo morrer. `/` e `/automacoes` já cercavam isso com um
// `Promise.race` de 2500ms NO CALL SITE, mas aquilo fazia a TELA responder sem
// abortar a requisição de verdade, que seguia viva atrás dela. `/eventos`
// NUNCA teve essa corrida — chama `resolvePosts` cru — e era a dívida
// declarada no comentário antigo de `app/page.tsx` ("conserto amplo, que
// resolveria /eventos também, fica como dívida declarada"). É essa dívida que
// o teto em `graphFetch` paga agora, para as quatro chamadas ao mesmo tempo.
//
// -----------------------------------------------------------------------------
// POR QUE O TETO SÓ VALE PARA LEITURA — E É ISSO QUE ESTE ARQUIVO PROVA
//
// `graphFetch` é o caminho de ENVIO em produção, não só de leitura: serve
// `sendMessage`, `replyToComment`, `sendReaction`, `criarContainer` e
// `publicarContainer`, tanto quanto serve `getMedia`, `getProfile` e
// `checkFollowsAccount`. Abortar um POST que a Meta JÁ ACEITOU é pior do que
// esperar: o dreno trataria o abort como falha e tentaria de novo, e uma
// pessoa real receberia a mesma mensagem duas vezes — este produto já teve
// incidente de envio duplicado. Por isso o teto (`lib/ig.ts`, `ehLeitura`) só
// se aplica quando `init.method` está ausente ou é `GET`.
//
// -----------------------------------------------------------------------------
// POR QUE ESTE TESTE NÃO USA MOCK
//
// O mesmo motivo de `testes-integracao/portao-link.integracao.ts` e
// `testes-integracao/capa-do-post.integracao.ts` (ver os cabeçalhos deles): um
// `vi.mock` do `fetch` trocaria a chamada por uma cópia da cola, e a promessa
// deste arquivo — "uma leitura pendurada de verdade TERMINA; um envio
// pendurado de verdade NÃO termina" — só se prova com uma pendura de verdade.
// A saída é a mesma: um servidor HTTP nesta própria máquina que ACEITA a
// conexão e NUNCA escreve nada, com a base do Graph desviada para ele por
// `IG_GRAPH_BASE` (`baseDoGraph`, lib/ig.ts — as duas travas e o porquê de
// cada uma estão lá). O `fetch` é o `fetch` do Node, de verdade; só a outra
// ponta do fio muda.
//
// -----------------------------------------------------------------------------
// O TETO REDUZIDO — E POR QUE ESTE ARQUIVO NÃO USA UM
//
// `TETO_DA_LEITURA_MS` (lib/ig.ts) é exportado e usado aqui do valor REAL
// (8000ms), sem parâmetro nem variável de ambiente para encurtá-lo neste
// teste. Um teto que só existisse "para o teste" seria uma segunda verdade —
// a suíte provaria um número que a produção não usa. O preço é um arquivo mais
// lento (as duas primeiras provas passam perto de 8s cada); o benefício é medir
// exatamente a constante que roda em produção, e não uma cópia dela.
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo, Socket } from "node:net";
import { getMediaById, sendMessage, IgTimeoutError, TETO_DA_LEITURA_MS } from "@/lib/ig";

const TOKEN = "token-do-teto-que-nao-vale-nada";
const CONTA = "17900000000000901";

// A FOLGA sobre o teto — generosa de propósito, para o caso não ficar
// quebradiço em CI mais lenta. O que prova o teto não é a folga, é a
// asserção de PISO logo abaixo dela em cada caso.
const FOLGA_MS = 3000;

// O SERVIDOR MUDO: aceita a conexão TCP, recebe a requisição HTTP inteira
// (o Node já fez o parse do request na hora do evento `request`), e nunca
// chama `res.write` nem `res.end`. Do lado do cliente isso é indistinguível
// de "a Meta aceitou e não respondeu" — exatamente o defeito medido.
let servidor: Server;
const socketsAbertos = new Set<Socket>();

// QUANTOS PEDIDOS O SERVIDOR RECEBEU DE VERDADE. Sem isto, o caso do envio só
// provava que `sendMessage` não retornou dentro da janela — um `sendMessage`
// que travasse ANTES de sequer conectar (erro de DNS, `fetch` que nunca sai da
// fila de eventos, …) passaria pelo mesmo jeito, sem provar que o POST chegou
// a este servidor. Contado no evento `request` (dispara só quando o Node
// termina de receber a requisição inteira), e zerado no início de cada caso
// que o usa — este servidor é compartilhado pelos dois testes do arquivo.
let pedidos = 0;

beforeAll(async () => {
  servidor = createServer((_req, _res) => {
    // De propósito: nada aqui. Nem `res.writeHead`, nem `res.write`, nem
    // `res.end`. A conexão fica aberta e muda.
  });
  servidor.on("request", () => pedidos++);
  servidor.on("connection", (socket) => {
    socketsAbertos.add(socket);
    socket.on("close", () => socketsAbertos.delete(socket));
  });
  await new Promise<void>((resolve) => servidor.listen(0, "127.0.0.1", resolve));
  const porta = (servidor.address() as AddressInfo).port;
  process.env.IG_GRAPH_BASE = `http://127.0.0.1:${porta}`;
});

afterAll(async () => {
  delete process.env.IG_GRAPH_BASE;
  // `closeAllConnections` (Node >=18.2, e este projeto exige >=22.18) destrói
  // à força os sockets abertos — inclusive o do caso "um envio não desiste",
  // que por definição nunca vai fechar sozinho. Sem isto, `servidor.close()`
  // espera as conexões ativas encerrarem e o vitest nunca sai deste arquivo.
  servidor.closeAllConnections?.();
  for (const socket of socketsAbertos) socket.destroy();
  await new Promise<void>((resolveClose) => servidor.close(() => resolveClose()));
});

describe("o teto de tempo de uma leitura na API do Instagram", () => {
  test("uma LEITURA desiste dentro do teto, e o erro diz o que aconteceu", async () => {
    const inicio = Date.now();
    let erro: unknown;
    try {
      await getMediaById("17900000000000001", TOKEN);
      throw new Error("getMediaById deveria ter rejeitado contra o servidor mudo");
    } catch (e) {
      erro = e;
    }
    const decorrido = Date.now() - inicio;

    // O PISO: sem ele, este caso passaria mesmo se o teto não existisse e a
    // rejeição viesse de outra causa (erro de parsing, conexão recusada, …) —
    // qualquer coisa que rejeitasse rápido demais passaria batido.
    expect(decorrido).toBeGreaterThanOrEqual(TETO_DA_LEITURA_MS - 300);
    // O TETO: teve que terminar, e não ficar pendurada para sempre.
    expect(decorrido).toBeLessThan(TETO_DA_LEITURA_MS + FOLGA_MS);

    expect(erro).toBeInstanceOf(IgTimeoutError);
    const mensagem = (erro as Error).message;
    expect(mensagem).toContain("não respondeu");
    expect(mensagem).toContain(String(TETO_DA_LEITURA_MS));
    expect(mensagem).toContain("17900000000000001");
    // O ACHADO DE SEGURANÇA: `getMediaById` põe `access_token` na query
    // (`?...&access_token=${TOKEN}`), e `IgTimeoutError` cortava o `path`
    // inteiro para dentro da mensagem — que cai em lugares que NÃO apagam
    // segredo (a coluna `error` da fila, o `fail()` do callback do OAuth, o
    // `console.error` das telas). Devolver o `path` inteiro aqui, sem cortar a
    // query, deixa este caso VERMELHO.
    expect(mensagem).not.toContain(TOKEN);
  }, TETO_DA_LEITURA_MS + FOLGA_MS + 5000);

  test("um ENVIO não desiste — continua pendurado depois do teto de leitura", async () => {
    // A corrida central da tarefa: um `setTimeout` MAIOR que o teto de
    // leitura contra `sendMessage` (POST) no mesmo servidor mudo. Se
    // `sendMessage` "ganhasse" — resolvesse OU rejeitasse — dentro dessa
    // janela, o teto estaria vazando para o envio, e é exatamente esse
    // vazamento que duplicaria mensagem para uma pessoa real.
    const JANELA_MS = TETO_DA_LEITURA_MS + FOLGA_MS;
    // Zerado aqui, e não só declarado lá em cima: o caso da leitura, que roda
    // antes, já fez um pedido contra o mesmo servidor. Sem zerar, a asserção
    // de `pedidos` no fim deste caso passaria mesmo que `sendMessage` nunca
    // saísse do processo.
    pedidos = 0;
    let idDoTimer: ReturnType<typeof setTimeout> | undefined;
    const timerVenceu = new Promise<"timer">((resolve) => {
      idDoTimer = setTimeout(() => resolve("timer"), JANELA_MS);
    });

    // `.then/.catch` aqui, e não deixado cru: a promessa de `sendMessage`
    // nunca vai se resolver sozinha contra este servidor (ele nunca
    // responde), e só é destravada quando `afterAll` derruba o socket à
    // força. Sem o `.catch` anexado agora, aquela rejeição tardia viraria
    // unhandled rejection depois que o teste já terminou.
    const envio = sendMessage(CONTA, TOKEN, { id: "17900000000000002" }, { text: "oi" })
      .then(() => "sendMessage-resolveu" as const)
      .catch((e) => `sendMessage-rejeitou: ${String(e)}` as const);

    const vencedor = await Promise.race([envio, timerVenceu]);
    clearTimeout(idDoTimer);

    expect(vencedor).toBe("timer");
    // A PROVA QUE FALTAVA: sem isto, um `sendMessage` que travasse ANTES de
    // conectar (por exemplo, um erro na montagem da requisição) venceria a
    // mesma corrida do mesmo jeito — "continuar pendurado" não é a mesma coisa
    // que "o POST chegou". `pedidos` conta o evento `request` do servidor
    // mudo, que só dispara quando o Node recebeu a requisição inteira.
    expect(pedidos).toBeGreaterThan(0);
  }, TETO_DA_LEITURA_MS + FOLGA_MS + 5000);
});
