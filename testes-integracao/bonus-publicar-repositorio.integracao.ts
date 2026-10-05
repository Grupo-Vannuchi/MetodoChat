// A PUBLICAÇÃO DO CARROSSEL CONTRA O BANCO DE VERDADE (o container), spec da Etapa 5.
//
// As proteções desta fase são a linha travada (`for update`), os `update`s condicionais pela chave
// da reserva e a leitura da fila, e nenhuma delas é visível para tsc, lint ou a suíte pura. Nada aqui
// fala com o bucket nem com a Meta: o repositório só grava caminhos.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { TextoDeCarrossel } from "@/lib/bonus/carrossel-texto";
import { bancoDescartavel } from "./harness";

type ModuloRepo = typeof import("@/lib/bonus/carrossel-repositorio");
type ModuloPublicar = typeof import("@/lib/bonus/publicar-repositorio");
type ModuloRegras = typeof import("@/lib/bonus/publicar-regras");
type ModuloSlides = typeof import("@/lib/bonus/arte-slides");

const banco = bancoDescartavel();

const CONTA = "17841400000000001";
const OUTRA = "17841400000000002";
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const guardada = (n: number, pasta = CONTA) => `${pasta}/bonus/${uuid(n)}.jpg`;
const daFila = (n: number, pasta = CONTA) => `${pasta}/bonus-fila/${uuid(n)}.jpg`;

const slide = (i: number) => ({
  titulo: `Título do slide ${i}`,
  texto: `Texto do slide ${i}, com mais de trinta caracteres.`,
});
const TEXTO: TextoDeCarrossel = {
  tipo: "carrossel",
  titulo: "Mensagens para reativar clientes",
  gancho: "Seu cliente sumiu? Não é culpa dele.",
  slides: [slide(1), slide(2), slide(3)],
  chamada: "Comente SUMIDO e receba as mensagens prontas.",
  legenda:
    "Quem sumiu ainda pode voltar. Comente SUMIDO que eu te mando as mensagens prontas para usar hoje mesmo.",
};
// 5 slides: o 1 (gancho) e o 5 (chamada) são "só texto"; o 2, o 3 e o 4 têm espaço de imagem.
const ARTE = { conta: CONTA, nome: "Thiago Vannuchi", arroba: "thiagovannuchi", soTexto: [1, 5] };

let repo: ModuloRepo;
let publicar: ModuloPublicar;
let regras: ModuloRegras;
let slides: ModuloSlides;
let bonusId: string;

beforeAll(async () => {
  repo = await import("@/lib/bonus/carrossel-repositorio");
  publicar = await import("@/lib/bonus/publicar-repositorio");
  regras = await import("@/lib/bonus/publicar-regras");
  slides = await import("@/lib/bonus/arte-slides");
});

beforeEach(async () => {
  await banco.db().sql().query(`delete from queue`);
  await banco.db().sql().query(`delete from carrosseis_gerados`);
  await banco.db().sql().query(`delete from bonus_gerados`);
  const [b] = (await banco
    .db()
    .sql()
    .query(
      `insert into bonus_gerados (tema, o_que_resolve, estado, slug, envio_estado)
       values ('Vendas', 'Reativar clientes que pararam de comprar pelo WhatsApp.', 'pronto', 'reativar-clientes-whatsapp', 'criado')
       returning id`
    )) as { id: string }[];
  bonusId = b.id;
});

async function carrossel(arte: Record<string, unknown> = ARTE, estado = "pronto"): Promise<string> {
  const [c] = (await banco
    .db()
    .sql()
    .query(
      `insert into carrosseis_gerados (bonus_id, total_slides, palavra, contexto, estado, gerado, arte)
       values ($1, 5, 'SUMIDO', '{}'::jsonb, $2, $3::jsonb, $4::jsonb) returning id`,
      [bonusId, estado, TEXTO, arte]
    )) as { id: string }[];
  return c.id;
}

async function arteDe(id: string): Promise<Record<string, unknown>> {
  const [l] = (await banco.db().sql().query(`select arte from carrosseis_gerados where id = $1`, [id])) as { arte: Record<string, unknown> }[];
  return l.arte;
}

/** Uma linha da fila com a chave dada, no estado dado. */
async function naFila(chave: string, status: string, caminhos: string[] = [daFila(90)], adiante = "1 hour"): Promise<void> {
  await banco
    .db()
    .sql()
    .query(
      `insert into queue (account_id, kind, payload, dedupe_key, status, not_before)
       values ($1, 'publicacao', $2::jsonb, $3, $4, now() + $5::interval)`,
      [CONTA, { forma: "carrossel", caminhos }, chave, status, adiante]
    );
}

/** O carrossel com uma publicação reservada (e enfileirada, por padrão) com a chave dada. */
async function publicado(chave: string, extra: Record<string, unknown> = {}, enfileirada = true): Promise<string> {
  const id = await carrossel();
  await banco
    .db()
    .sql()
    .query(
      `update carrosseis_gerados set arte = arte || jsonb_build_object('publicacao',
         $2::jsonb || jsonb_build_object('reservada_em', now()) || case when $3 then jsonb_build_object('enfileirada_em', now()) else '{}'::jsonb end)
       where id = $1`,
      [id, { chave, caminhos: [daFila(90)], ...extra }, enfileirada]
    );
  return id;
}

const versaoDo = (n: number) => regras.versaoDoTextoDoSlide(slides.slidesDoTexto(TEXTO)[n - 1]);

describe("guardar a imagem de um slide", () => {
  it("grava só aquele slide, com a versão do texto salvo, e mantém a conta e o só texto", async () => {
    const id = await carrossel();
    const r = await publicar.gravarImagemDoSlide(id, 3, guardada(3));
    expect(r).toEqual({ ok: true, anterior: null, versao: versaoDo(3) });
    const arte = await arteDe(id);
    expect(arte.imagens).toEqual({ "3": { caminho: guardada(3), versao: versaoDo(3) } });
    expect(arte.conta).toBe(CONTA);
    expect(arte.soTexto).toEqual([1, 5]);
  });

  it("a troca devolve a anterior, para ela sair do bucket, e não mexe nos outros slides", async () => {
    const id = await carrossel();
    await publicar.gravarImagemDoSlide(id, 2, guardada(2));
    await publicar.gravarImagemDoSlide(id, 3, guardada(3));
    expect(await publicar.gravarImagemDoSlide(id, 3, guardada(33))).toEqual({ ok: true, anterior: guardada(3), versao: versaoDo(3) });
    expect(regras.imagensDaArte(await arteDe(id), 5)).toEqual({
      2: { caminho: guardada(2), versao: versaoDo(2) },
      3: { caminho: guardada(33), versao: versaoDo(3) },
    });
  });

  it.each([
    ["outra pasta", 3, guardada(3, OUTRA), "caminho"],
    ["o prefixo da fila", 3, daFila(3), "caminho"],
    ["o slide só texto", 1, guardada(1), "sem_espaco"],
    ["o slide que não existe", 6, guardada(6), "slide"],
  ])("recusa %s", async (_nome, numero, caminho, motivo) => {
    const id = await carrossel();
    const r = await publicar.gravarImagemDoSlide(id, numero, caminho);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.recusa.motivo).toBe(motivo);
    expect((await arteDe(id)).imagens).toBeUndefined();
  });

  it("recusa o carrossel sem conta e o que não está pronto", async () => {
    const semConta = await carrossel({ soTexto: [] });
    const r1 = await publicar.gravarImagemDoSlide(semConta, 3, guardada(3));
    expect(r1.ok ? null : r1.recusa.motivo).toBe("sem_conta");
    const gerando = await carrossel(ARTE, "gerando");
    const r2 = await publicar.gravarImagemDoSlide(gerando, 3, guardada(3));
    expect(r2.ok ? null : r2.recusa.motivo).toBe("nao_pronto");
  });
});

// A TRAVA VALE NO SERVIDOR (spec, "A trava no servidor"): livre só sem publicação, com a linha em
// failed ou skipped, ou com a reserva nunca enfileirada e velha. Todo o resto trava.
describe("a trava nas gravações do carrossel", () => {
  const CHAVE = `pub:${CONTA}:carrossel:${daFila(90)}`;
  const tentar = async (id: string) => ({
    slide: await repo.salvarParteDoCarrossel(id, { tipo: "slide", numero: 2 }, { slide_1_titulo: "Outro título do slide 1", slide_1_texto: TEXTO.slides[0].texto }, null),
    soTexto: await repo.salvarSoTextoDaArte(id, [1], null),
    imagem: await publicar.gravarImagemDoSlide(id, 3, guardada(3)),
  });
  const motivos = (r: Awaited<ReturnType<typeof tentar>>) => [
    r.slide.ok ? "ok" : r.slide.motivo,
    r.soTexto.ok ? "ok" : r.soTexto.motivo,
    r.imagem.ok ? "ok" : r.imagem.recusa.motivo,
  ];

  it.each(["pending", "sending", "sent"])("com a linha da fila em %s, salvar, só texto e guardar são recusados", async (status) => {
    const id = await publicado(CHAVE);
    await naFila(CHAVE, status);
    const r = await tentar(id);
    expect(motivos(r)).toEqual(["travado", "travado", "travado"]);
    const arte = await arteDe(id);
    expect(arte.soTexto).toEqual([1, 5]);
    expect(arte.imagens).toBeUndefined();
  });

  it.each(["failed", "skipped"])("com a linha da fila em %s, as gravações voltam", async (status) => {
    const id = await publicado(CHAVE);
    await naFila(CHAVE, status);
    expect(motivos(await tentar(id))).toEqual(["ok", "ok", "ok"]);
  });

  // ACHADO 75: desconectar a conta apaga as linhas da fila dela (lib/db.ts:469-474).
  it("a linha da fila apagada depois de enfileirar: segue travado, mesmo passados os 10 minutos", async () => {
    const id = await publicado(CHAVE);
    await banco
      .db()
      .sql()
      .query(
        `update carrosseis_gerados set arte = jsonb_set(jsonb_set(arte, '{publicacao,reservada_em}', to_jsonb(now() - interval '1 day')),
           '{publicacao,enfileirada_em}', to_jsonb(now() - interval '1 day')) where id = $1`,
        [id]
      );
    expect(motivos(await tentar(id))).toEqual(["travado", "travado", "travado"]);
  });

  it("a reserva nunca enfileirada e sem linha trava nos 10 minutos, e libera depois", async () => {
    const id = await publicado(CHAVE, {}, false);
    expect(motivos(await tentar(id))).toEqual(["travado", "travado", "travado"]);
    await banco
      .db()
      .sql()
      .query(`update carrosseis_gerados set arte = jsonb_set(arte, '{publicacao,reservada_em}', to_jsonb(now() - interval '11 minutes')) where id = $1`, [id]);
    expect(motivos(await tentar(id))).toEqual(["ok", "ok", "ok"]);
  });

  it("a publicação de forma estranha trava", async () => {
    const id = await carrossel({ ...ARTE, publicacao: "publicado" });
    expect(motivos(await tentar(id))).toEqual(["travado", "travado", "travado"]);
  });

  it("o estado do carrossel, para a página, vem da fila pela chave exata", async () => {
    const id = await publicado(CHAVE);
    await naFila(CHAVE, "sent");
    await naFila(`${CHAVE}-outra`, "failed");
    const [linha] = (await banco.db().sql().query(`select * from carrosseis_gerados where id = $1`, [id])) as { arte: unknown }[];
    expect((await publicar.estadoDoCarrossel(linha.arte)).tipo).toBe("publicado");
  });
});

describe("a reserva da publicação", () => {
  const imagensDe = (id: string) => publicar.gravarImagemDoSlide(id, 2, guardada(2)).then(() =>
    publicar.gravarImagemDoSlide(id, 3, guardada(3))).then(() => publicar.gravarImagemDoSlide(id, 4, guardada(4)));
  const esperado = { texto: JSON.stringify(TEXTO), soTexto: [1, 5], imagens: { 2: guardada(2), 3: guardada(3), 4: guardada(4) } };
  const caminhos = [daFila(1), daFila(2), daFila(3), daFila(4), daFila(5)];

  it("grava a chave e os caminhos, com a hora do banco, e devolve a legenda salva", async () => {
    const id = await carrossel();
    await imagensDe(id);
    const r = await publicar.reservarPublicacao(id, esperado, "pub:chave-1", caminhos);
    expect(r).toEqual({ ok: true, legenda: TEXTO.legenda, velha: null });
    const p = regras.publicacaoDaArte(await arteDe(id));
    expect(p).toMatchObject({ chave: "pub:chave-1", caminhos, enfileiradaEm: null });
    expect(Math.abs((p as { reservadaEm: Date }).reservadaEm.getTime() - Date.now())).toBeLessThan(120_000);
  });

  it.each([
    ["o texto", { texto: JSON.stringify({ ...TEXTO, legenda: "outra" }) }],
    ["o só texto", { soTexto: [1] }],
    ["uma imagem", { imagens: { ...esperado.imagens, 3: guardada(33) } }],
  ])("recusa quando %s mudou desde as cópias", async (_nome, mudanca) => {
    const id = await carrossel();
    await imagensDe(id);
    const r = await publicar.reservarPublicacao(id, { ...esperado, ...mudanca }, "pub:chave-1", caminhos);
    expect(r.ok ? null : r.recusa.motivo).toBe("mudou");
    expect(regras.publicacaoDaArte(await arteDe(id))).toBeNull();
  });

  it("dois reservando ao mesmo tempo: um só reserva, e o outro é recusado pela trava", async () => {
    const id = await carrossel();
    await imagensDe(id);
    const [a, b] = await Promise.all([
      publicar.reservarPublicacao(id, esperado, "pub:chave-a", caminhos),
      publicar.reservarPublicacao(id, esperado, "pub:chave-b", caminhos),
    ]);
    expect([a.ok, b.ok].sort()).toEqual([false, true]);
    const recusada = a.ok ? b : a;
    expect(recusada.ok ? null : recusada.recusa.motivo).toBe("travado");
  });

  // A RESERVA TRAVA A LINHA (`for update`). Os dois cliques de cima podem não se cruzar de verdade: a
  // primeira transação às vezes termina antes de a segunda ler. Aqui o cruzamento é forçado: uma
  // transação do próprio teste segura a linha e grava uma reserva, como o outro clique no meio do
  // caminho. Quem trava a linha espera, vê a reserva dele e é recusado; quem lesse sem travar veria a
  // linha velha, sem reserva, e gravaria a sua por cima (medido no ensaio: a mutação sem o `for
  // update` passava pelo caso de cima).
  it("o segundo clique espera a linha, vê a reserva do primeiro e é recusado", async () => {
    const id = await carrossel();
    await imagensDe(id);
    let soltar!: () => void;
    const segurando = new Promise<void>((f) => (soltar = f));
    let travou!: () => void;
    const travado = new Promise<void>((f) => (travou = f));
    const transacao = banco
      .db()
      .sql()
      .begin(async (tx) => {
        await tx.query(`select id from carrosseis_gerados where id = $1 for update`, [id]);
        await tx.query(
          `update carrosseis_gerados set arte = arte || jsonb_build_object('publicacao',
             $2::jsonb || jsonb_build_object('reservada_em', now())) where id = $1`,
          [id, { chave: "pub:chave-a", caminhos }]
        );
        travou();
        await segurando;
      });
    await travado;
    // A chamada fica DENTRO do `try` (achado 74): se ela lançar, o `finally` solta a linha assim mesmo.
    const reservas: Promise<Awaited<ReturnType<typeof publicar.reservarPublicacao>>>[] = [];
    try {
      reservas.push(publicar.reservarPublicacao(id, esperado, "pub:chave-b", caminhos));
      await new Promise((f) => setTimeout(f, 300));
    } finally {
      soltar();
      await transacao;
    }
    const [r] = await Promise.all(reservas);
    expect(r.ok ? null : r.recusa.motivo).toBe("travado");
    expect((regras.publicacaoDaArte(await arteDe(id)) as { chave: string }).chave).toBe("pub:chave-a");
  });

  it("a reserva velha, nunca enfileirada, volta para os caminhos dela saírem do bucket", async () => {
    const id = await carrossel();
    await imagensDe(id);
    await publicar.reservarPublicacao(id, esperado, "pub:velha", [daFila(70)]);
    await banco
      .db()
      .sql()
      .query(`update carrosseis_gerados set arte = jsonb_set(arte, '{publicacao,reservada_em}', to_jsonb(now() - interval '11 minutes')) where id = $1`, [id]);
    const r = await publicar.reservarPublicacao(id, esperado, "pub:nova", caminhos);
    expect(r.ok && r.velha?.caminhos).toEqual([daFila(70)]);
  });

  it("marcar enfileirada e desfazer a reserva só valem com a chave da tentativa", async () => {
    const id = await carrossel();
    await imagensDe(id);
    await publicar.reservarPublicacao(id, esperado, "pub:minha", caminhos);
    expect(await publicar.marcarEnfileirada(id, "pub:outra")).toBe(false);
    expect(await publicar.marcarEnfileirada(id, "pub:minha")).toBe(true);
    expect((regras.publicacaoDaArte(await arteDe(id)) as { enfileiradaEm: Date | null }).enfileiradaEm).toBeInstanceOf(Date);
    await publicar.desfazerReserva(id, "pub:outra");
    expect(regras.publicacaoDaArte(await arteDe(id))).not.toBeNull();
    await publicar.desfazerReserva(id, "pub:minha");
    expect(regras.publicacaoDaArte(await arteDe(id))).toBeNull();
  });

  it("acha o caminho que está no payload de algum item da fila", async () => {
    await naFila("pub:x", "pending", [daFila(1), daFila(2)]);
    expect(await publicar.caminhosNaFila([daFila(2), daFila(3)])).toEqual([daFila(2)]);
    expect(await publicar.caminhosNaFila([daFila(3)])).toEqual([]);
  });
});
