// O GERADOR DE BÔNUS CONTRA O BANCO DE VERDADE E UM LABS FALSO.
//
// As proteções desta fase são `update`s condicionais e uma trava de transação, e
// nenhuma delas é visível para tsc, lint ou a suíte pura: apagar qualquer uma
// passa por todos. Só um caminho que fale com o Postgres acusa.
//
// O LABS FALSO é um servidor HTTP na própria máquina (127.0.0.1, porta sorteada),
// que responde o que cada caso roteirizar. NADA SAI PARA O LABS DE VERDADE.
import { createHmac } from "node:crypto";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bancoDescartavel } from "./harness";

type ModuloRepo = typeof import("@/lib/bonus/repositorio");
type ModuloProcesso = typeof import("@/lib/bonus/processo");
type ModuloContrato = typeof import("@/lib/bonus/contrato");

const banco = bancoDescartavel();

const SEGREDO = "segredo-inventado-para-o-teste-que-nao-vale-nada";
const PEDIDO = { tema: "Marketing", oQueResolve: "Montar um cronograma de lançamento em 7 dias", palavraDigitada: null };
const GERADO = {
  titulo: "Kit de lançamento em 7 dias",
  slug: "kit-de-lancamento",
  palavraChave: "LANCAMENTO",
  descricao:
    "Um cronograma de sete dias para lançar um produto sem travar na véspera, com o que fazer e o que conferir em cada dia.",
  intro:
    "Use quando tiver data de lançamento marcada. Preencha o produto e o público, cole no ChatGPT e receba o cronograma dia a dia.",
  prompt: "Aja como um estrategista de lançamento. ".repeat(12),
};
const MEDICAO = { modelo: "claude-opus-5-5", tokensEntrada: 1, tokensSaida: 1, cacheCriado: 0, cacheLido: 0 };
const REVISADO = {
  titulo: GERADO.titulo,
  slug: "kit-de-lancamento",
  palavra: "LANCAMENTO",
  descricao: GERADO.descricao,
  intro: GERADO.intro,
  prompt: GERADO.prompt,
  tema: "Marketing",
};

type Passo = { status: number; corpo: unknown; atrasoMs?: number };
const labs = { roteiro: [] as Passo[], recebidos: [] as { corpo: string; assinatura: string }[] };

let servidor: Server;
let porta = 0;
let repo: ModuloRepo;
let processo: ModuloProcesso;
let contrato: ModuloContrato;

function corpoDe(req: IncomingMessage): Promise<string> {
  return new Promise((pronto) => {
    const pedacos: Buffer[] = [];
    req.on("data", (d: Buffer) => pedacos.push(d));
    req.on("end", () => pronto(Buffer.concat(pedacos).toString("utf8")));
  });
}

beforeAll(async () => {
  repo = await import("@/lib/bonus/repositorio");
  processo = await import("@/lib/bonus/processo");
  contrato = await import("@/lib/bonus/contrato");
  servidor = createServer(async (req, res) => {
    const corpo = await corpoDe(req);
    labs.recebidos.push({ corpo, assinatura: String(req.headers["x-metodolabs-signature"] ?? "") });
    const passo = labs.roteiro.shift() ?? { status: 500, corpo: { ok: false, erro: "erro_temporario" } };
    const responder = () => {
      if (res.destroyed || res.writableEnded) return;
      res.writeHead(passo.status, { "content-type": "application/json" });
      res.end(JSON.stringify(passo.corpo));
    };
    if (passo.atrasoMs) setTimeout(responder, passo.atrasoMs);
    else responder();
  });
  await new Promise<void>((pronto) => servidor.listen(0, "127.0.0.1", () => pronto()));
  porta = (servidor.address() as AddressInfo).port;
});

afterAll(async () => {
  servidor.closeAllConnections();
  await new Promise<void>((pronto) => servidor.close(() => pronto()));
});

beforeEach(async () => {
  await banco.db().sql().query(`delete from bonus_gerados`);
  labs.roteiro = [];
  labs.recebidos = [];
});

const deps = () => ({
  env: { BONUS_INTAKE_SECRET: SEGREDO, LABS_URL: `http://127.0.0.1:${porta}` },
  timeoutMs: 300,
});

function assinaturaConfere(r: { corpo: string; assinatura: string }): boolean {
  const m = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(r.assinatura);
  return m !== null && createHmac("sha256", SEGREDO).update(`${m[1]}.${r.corpo}`).digest("hex") === m[2];
}

async function linhaPronta(): Promise<string> {
  const r = await repo.criarPedido(PEDIDO);
  if (!r.ok) throw new Error("teto no meio do teste: o beforeEach devia ter limpado a tabela");
  await banco
    .db()
    .sql()
    .query(`update bonus_gerados set estado = 'pronto', gerado = $2::jsonb, gerado_em = now() where id = $1`, [
      r.id,
      GERADO,
    ]);
  return r.id;
}

/** Espera uma condição, conferindo a cada 10 ms, por até 3 s. */
async function esperarAte(condicao: () => boolean): Promise<void> {
  for (let i = 0; i < 300 && !condicao(); i++) await new Promise((f) => setTimeout(f, 10));
  if (!condicao()) throw new Error("a condição não chegou em 3 s");
}

describe("o teto diário", () => {
  // DETERMINÍSTICO, e não por concorrência (achado do auditor): disparar pedidos
  // em paralelo pode passar SEM a trava, porque o primeiro pega a conexão quente e
  // termina antes de os outros abrirem conexão. Aqui a trava é segurada por uma
  // transação do próprio teste, e o pedido TEM de ficar esperando por ela.
  it("o pedido espera a trava do teto: contar e inserir não correm em paralelo", async () => {
    let soltar!: () => void;
    const segurando = new Promise<void>((f) => (soltar = f));
    let travou!: () => void;
    const travado = new Promise<void>((f) => (travou = f));
    const transacao = banco
      .db()
      .sql()
      .begin(async (tx) => {
        await tx.query(`select pg_advisory_xact_lock($1::bigint)`, [repo.TRAVA_DO_TETO]);
        // CINCO LINHAS INVISÍVEIS ATÉ O COMMIT (reforço do auditor): quem conta DEPOIS
        // de pegar a trava vê 5 e recusa; quem conta ANTES dela vê 0 e insere. Assim o
        // caso pega a trava no lugar errado, e não só a trava ausente.
        for (let i = 0; i < 5; i++) {
          await tx.query(
            `insert into bonus_gerados (tema, o_que_resolve) values ('Marketing', 'um pedido de teste com mais de vinte letras')`
          );
        }
        travou();
        await segurando;
      });
    await travado;

    const pedido = repo.criarPedido(PEDIDO);
    const venceu = await Promise.race([
      pedido.then(() => "pedido"),
      new Promise((f) => setTimeout(() => f("relogio"), 300)),
    ]);
    expect(venceu).toBe("relogio");

    soltar();
    await transacao;
    expect((await pedido).ok).toBe(false);
  });

  it("com 5 no dia, o sexto é recusado", async () => {
    for (let i = 0; i < 5; i++) await repo.criarPedido(PEDIDO);
    expect((await repo.criarPedido(PEDIDO)).ok).toBe(false);
    expect(await repo.usadasNasUltimas24h()).toBe(5);
  });

  it("linha de mais de 24 h, pelo relógio do banco, não conta", async () => {
    for (let i = 0; i < 5; i++) await repo.criarPedido(PEDIDO);
    await banco.db().sql().query(`update bonus_gerados set criado_em = now() - interval '25 hours'`);
    expect((await repo.criarPedido(PEDIDO)).ok).toBe(true);
  });
});

describe("processarGeracao", () => {
  it("dois disparos da mesma linha chamam a IA uma vez só", async () => {
    const r = await repo.criarPedido(PEDIDO);
    if (!r.ok) throw new Error("devia criar");
    let chamadas = 0;
    const gerar = async () => {
      chamadas++;
      await new Promise((f) => setTimeout(f, 50));
      return { ok: true as const, dados: GERADO, medicao: MEDICAO };
    };
    await Promise.all([processo.processarGeracao(r.id, gerar), processo.processarGeracao(r.id, gerar)]);
    expect(chamadas).toBe(1);
    const linha = await repo.lerLinha(r.id);
    expect(linha?.estado).toBe("pronto");
    expect(linha?.gerado).toEqual(GERADO);
  });

  it("a falha da IA fica escrita na linha", async () => {
    const r = await repo.criarPedido(PEDIDO);
    if (!r.ok) throw new Error("devia criar");
    await processo.processarGeracao(r.id, async () => ({ ok: false as const, erro: "a IA recusou", medicao: null }));
    const linha = await repo.lerLinha(r.id);
    expect([linha?.estado, linha?.erro]).toEqual(["falhou", "a IA recusou"]);
  });

  it("uma exceção nossa também vira falha escrita, e não linha girando até travar", async () => {
    const r = await repo.criarPedido(PEDIDO);
    if (!r.ok) throw new Error("devia criar");
    await processo.processarGeracao(r.id, async () => {
      throw new TypeError("defeito plantado");
    });
    const linha = await repo.lerLinha(r.id);
    expect(linha?.estado).toBe("falhou");
    expect(linha?.erro).toContain("defeito plantado");
  });
});

describe("enviarLinha", () => {
  it("201: criado, com a data e o motivo gravados", async () => {
    const id = await linhaPronta();
    labs.roteiro = [{ status: 201, corpo: { ok: true, slug: "kit-de-lancamento", id: 7, isActive: false } }];
    const r = await processo.enviarLinha(id, REVISADO, deps());
    expect(r.tipo === "enviado" && r.desfecho.estado).toBe("criado");
    const linha = await repo.lerLinha(id);
    expect(linha?.envio_estado).toBe("criado");
    expect(linha?.enviado_em).not.toBeNull();
    expect((linha?.envio_resposta as { motivo?: string }).motivo).toBe("criado");
    expect(labs.recebidos.every(assinaturaConfere)).toBe(true);
  });

  it("[timeout, duplicate]: incerto e depois conferir, com o MESMO corpo nas duas", async () => {
    const id = await linhaPronta();
    labs.roteiro = [{ status: 201, corpo: { ok: true, slug: "kit-de-lancamento", id: 7, isActive: false }, atrasoMs: 2_000 }];
    const r1 = await processo.enviarLinha(id, REVISADO, deps());
    expect(r1.tipo === "enviado" && r1.desfecho.estado).toBe("incerto");

    labs.roteiro = [{ status: 200, corpo: { ok: true, duplicate: true, slug: "kit-de-lancamento", isActive: false } }];
    const r2 = await processo.enviarLinha(id, { ...REVISADO, titulo: "Outro título que o operador tentou pôr" }, deps());
    expect(r2.tipo === "enviado" && r2.desfecho.estado).toBe("conferir");
    expect(labs.recebidos[1].corpo).toBe(labs.recebidos[0].corpo);
    expect(labs.recebidos.every(assinaturaConfere)).toBe(true);
  });

  it("[timeout, 409 título do nosso slug]: criado", async () => {
    const id = await linhaPronta();
    labs.roteiro = [{ status: 201, corpo: { ok: true }, atrasoMs: 2_000 }];
    await processo.enviarLinha(id, REVISADO, deps());
    labs.roteiro = [{ status: 409, corpo: { ok: false, erro: "titulo_repetido", slugExistente: "kit-de-lancamento" } }];
    const r = await processo.enviarLinha(id, REVISADO, deps());
    expect(r.tipo === "enviado" && r.desfecho.estado).toBe("criado");
  });

  it("[timeout, duplicate com id]: criado, com o id do Labs gravado (contrato de 29/09)", async () => {
    const id = await linhaPronta();
    labs.roteiro = [{ status: 201, corpo: { ok: true }, atrasoMs: 2_000 }];
    await processo.enviarLinha(id, REVISADO, deps());
    labs.roteiro = [
      { status: 200, corpo: { ok: true, duplicate: true, id: 42, slug: "kit-de-lancamento", isActive: false } },
    ];
    const r = await processo.enviarLinha(id, REVISADO, deps());
    expect(r.tipo === "enviado" && r.desfecho.estado).toBe("criado");
    const linha = await repo.lerLinha(id);
    const resposta = linha?.envio_resposta as { motivo?: string; id?: string };
    expect([linha?.envio_estado, linha?.incerto_pendente, resposta.motivo, resposta.id]).toEqual([
      "criado",
      false,
      "criado_pela_duplicata",
      "42",
    ]);
  });

  it("colisão sem incerteza libera: o slug editado vai no envio seguinte", async () => {
    const id = await linhaPronta();
    labs.roteiro = [{ status: 200, corpo: { ok: true, duplicate: true, slug: "kit-de-lancamento", isActive: true } }];
    const r1 = await processo.enviarLinha(id, REVISADO, deps());
    expect(r1.tipo === "enviado" && r1.desfecho.estado).toBe("colisao");

    labs.roteiro = [{ status: 201, corpo: { ok: true, slug: "kit-de-lancamento-7-dias", id: 8, isActive: false } }];
    await processo.enviarLinha(id, { ...REVISADO, slug: "kit-de-lancamento-7-dias" }, deps());
    expect(JSON.parse(labs.recebidos[1].corpo).slug).toBe("kit-de-lancamento-7-dias");
    expect((await repo.lerLinha(id))?.envio_estado).toBe("criado");
  });

  it("envio preso há 61 s é GRAVADO como incerto: vai o corpo X, e não o slug editado (proposto pelo auditor)", async () => {
    const id = await linhaPronta();
    const X = contrato.montarCorpo({ ...REVISADO, slug: "x-slug" });
    await banco
      .db()
      .sql()
      .query(
        `update bonus_gerados set envio_estado = 'enviando', envio_iniciado_em = now() - interval '61 seconds',
                incerto_pendente = false, corpo_enviado = $2, slug = 'x-slug' where id = $1`,
        [id, X]
      );
    labs.roteiro = [{ status: 200, corpo: { ok: true, duplicate: true, slug: "x-slug", isActive: false } }];
    const r = await processo.enviarLinha(id, { ...REVISADO, slug: "y-slug" }, deps());
    expect(labs.recebidos[0].corpo).toBe(X);
    expect(r.tipo === "enviado" && r.desfecho.estado).toBe("conferir");
  });

  it("envio em andamento há menos de 60 s: ocupado, e nada sai", async () => {
    const id = await linhaPronta();
    await banco
      .db()
      .sql()
      .query(`update bonus_gerados set envio_estado = 'enviando', envio_iniciado_em = now() where id = $1`, [id]);
    expect((await processo.enviarLinha(id, REVISADO, deps())).tipo).toBe("ocupado");
    expect(labs.recebidos).toHaveLength(0);
  });

  it("a ficha: o desfecho de quem perdeu a reserva não apaga o de quem a assumiu (proposto pelo auditor)", async () => {
    // A posta e o Labs demora 300 ms para responder 429. Enquanto isso a reserva de
    // A envelhece, B a assume e posta, e o Labs responde 201 a B em 600 ms. Sem a
    // ficha, o 429 de A seria gravado por cima do `enviando` de B, e o 201 de B
    // acharia zero linhas e sumiria: a linha terminaria em `esperar`, com o bônus
    // criado no Labs.
    const id = await linhaPronta();
    labs.roteiro = [
      { status: 429, corpo: { ok: false, erro: "muitas_requisicoes" }, atrasoMs: 300 },
      { status: 201, corpo: { ok: true, slug: "kit-de-lancamento", id: 7, isActive: false }, atrasoMs: 600 },
    ];
    const lento = { ...deps(), timeoutMs: 2_000 };
    const a = processo.enviarLinha(id, REVISADO, lento);
    await esperarAte(() => labs.recebidos.length === 1);
    await banco
      .db()
      .sql()
      .query(`update bonus_gerados set envio_iniciado_em = now() - interval '61 seconds' where id = $1`, [id]);
    const b = processo.enviarLinha(id, REVISADO, lento);
    const [ra, rb] = await Promise.all([a, b]);
    expect(ra.tipo).toBe("superado");
    expect(rb.tipo === "enviado" && rb.desfecho.estado).toBe("criado");
    expect((await repo.lerLinha(id))?.envio_estado).toBe("criado");
    expect(labs.recebidos[1].corpo).toBe(labs.recebidos[0].corpo);
  });

  it("o corpo liberado é apagado na reserva: um corpo abandonado não volta (proposto pelo auditor)", async () => {
    // O operador teve o slug `slug-a` recusado e editou para `slug-b`. A reserva
    // seguinte morre antes de gravar o corpo novo; a próxima a encontra presa e a
    // grava como incerta. Sem apagar o corpo liberado, iria o `slug-a` abandonado.
    const id = await linhaPronta();
    const A = contrato.montarCorpo({ ...REVISADO, slug: "slug-a" });
    await banco
      .db()
      .sql()
      .query(
        `update bonus_gerados set envio_estado = 'recusado', incerto_pendente = false,
                corpo_enviado = $2, slug = 'slug-a', tentativas = 1 where id = $1`,
        [id, A]
      );
    await repo.reivindicarEnvio(id);
    await banco
      .db()
      .sql()
      .query(`update bonus_gerados set envio_iniciado_em = now() - interval '61 seconds' where id = $1`, [id]);
    labs.roteiro = [{ status: 201, corpo: { ok: true, slug: "slug-b", id: 9, isActive: false } }];
    await processo.enviarLinha(id, { ...REVISADO, slug: "slug-b" }, deps());
    expect(JSON.parse(labs.recebidos[0].corpo).slug).toBe("slug-b");
  });

  it("sem configuração, recusa antes de tocar o banco e a rede", async () => {
    const id = await linhaPronta();
    expect(await processo.enviarLinha(id, REVISADO, { env: {} })).toEqual({ tipo: "sem_config", motivo: "sem_segredo" });
    expect(labs.recebidos).toHaveLength(0);
    expect((await repo.lerLinha(id))?.tentativas).toBe(0);
  });

  it("a conferência humana fecha o conferir", async () => {
    const id = await linhaPronta();
    await banco.db().sql().query(`update bonus_gerados set envio_estado = 'conferir', incerto_pendente = true where id = $1`, [id]);
    expect(await repo.gravarConferencia(id, false)).toBe(true);
    const linha = await repo.lerLinha(id);
    expect([linha?.envio_estado, linha?.incerto_pendente]).toEqual(["recusado", false]);
    expect(await repo.gravarConferencia(id, true)).toBe(false);
  });
});
