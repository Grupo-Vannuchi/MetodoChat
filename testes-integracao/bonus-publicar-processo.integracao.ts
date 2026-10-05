// O PROCESSO DA PUBLICAÇÃO DO CARROSSEL CONTRA O BANCO E UM BUCKET FALSO (spec da Etapa 5).
//
// A FORMA É A DE `publicacao.integracao.ts`: o bucket é um servidor HTTP nesta máquina, as três
// variáveis do Supabase apontam para ele, e o `beforeAll` recusa rodar se a `SUPABASE_URL` não for
// loopback. **Nada sobe para o Supabase de verdade, e nada é publicado no Instagram**: a fila é a do
// banco de teste, e o dreno é um falso que só conta as chamadas.
//
// O que este arquivo prende é a COSTURA, que não é função pura: a ordem entre copiar, reservar,
// enfileirar e marcar; o que sai do bucket em cada recusa; e a conta do carrossel no lugar do cookie.
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { TextoDeCarrossel, TextoDePost } from "@/lib/bonus/carrossel-texto";
import { bancoDescartavel } from "./harness";

type ModuloProcesso = typeof import("@/lib/bonus/publicar-processo");
type ModuloRepo = typeof import("@/lib/bonus/carrossel-repositorio");
type ModuloRegras = typeof import("@/lib/bonus/publicar-regras");
type ModuloSlides = typeof import("@/lib/bonus/arte-slides");
type ContaDoCabecalho = import("@/lib/bonus/arte-conta").ContaDoCabecalho;

const banco = bancoDescartavel();

const CONTA = "17841400000000001";
const OUTRA = "17841400000000002";
const CHAVE_DO_BUCKET_FALSO = "chave-de-servico-inventada-para-o-teste";
const BUCKET = "MetodoChatDeTeste";
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 9, 9, 9]);
const DECLARADO = { nome: "slide.jpg", mime: "image/jpeg", bytes: 1000, largura: 1080, altura: 1350 };

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
const POST: TextoDePost = {
  tipo: "post",
  titulo: "Mensagens para reativar clientes",
  texto: "Seu cliente sumiu, e não é culpa dele. Três mensagens trazem de volta quem parou de responder.",
  chamada: "Comente SUMIDO e receba as mensagens prontas.",
  legenda: TEXTO.legenda,
};
// 5 slides: o 1 (gancho) e o 5 (chamada) são "só texto"; o 2, o 3 e o 4 têm espaço de imagem.
const ARTE = { conta: CONTA, nome: "Thiago Vannuchi", arroba: "thiagovannuchi", soTexto: [1, 5] };

// O BUCKET FALSO: os objetos ficam num Map, e cada chamada fica anotada.
const bucket = {
  objetos: new Map<string, Uint8Array>(),
  chamadas: [] as string[],
  recusarLeitura: new Set<string>(),
};
let servidor: Server;
let processo: ModuloProcesso;
let repo: ModuloRepo;
let regras: ModuloRegras;
let slides: ModuloSlides;
let contas: ContaDoCabecalho[];
let bonusId: string;
let drenagens: number;
const drenar = async () => {
  drenagens++;
};

beforeAll(async () => {
  servidor = createServer(async (req, res) => {
    const u = new URL(req.url ?? "/", "http://127.0.0.1");
    const corpo: Buffer[] = [];
    for await (const parte of req) corpo.push(parte as Buffer);
    const responder = (status: number, json: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(json));
    };
    const depois = (prefixo: string) => decodeURIComponent(u.pathname.slice(prefixo.length));
    const comChave = () => req.headers["apikey"] === CHAVE_DO_BUCKET_FALSO;

    if (req.method === "GET" && u.pathname === `/storage/v1/bucket/${BUCKET}`) {
      if (!comChave()) return responder(401, { message: "sem apikey" });
      return responder(200, { file_size_limit: 52428800 });
    }
    const assinar = `/storage/v1/object/upload/sign/${BUCKET}/`;
    if (req.method === "POST" && u.pathname.startsWith(assinar)) {
      if (!comChave()) return responder(401, { message: "sem apikey" });
      const caminho = depois(assinar);
      bucket.chamadas.push(`assinou ${caminho}`);
      return responder(200, { url: `/object/upload/sign/${BUCKET}/${caminho}?token=tk`, token: "tk" });
    }
    if (req.method === "PUT" && u.pathname.startsWith(assinar)) {
      if (u.searchParams.get("token") !== "tk") return responder(400, { message: "sem token" });
      const caminho = depois(assinar);
      bucket.chamadas.push(`subiu ${caminho}`);
      bucket.objetos.set(caminho, new Uint8Array(Buffer.concat(corpo)));
      return responder(200, { Key: caminho });
    }
    const publico = `/storage/v1/object/public/${BUCKET}/`;
    if (req.method === "GET" && u.pathname.startsWith(publico)) {
      const caminho = depois(publico);
      bucket.chamadas.push(`baixou ${caminho}`);
      const objeto = bucket.objetos.get(caminho);
      if (!objeto || bucket.recusarLeitura.has(caminho)) return responder(400, { message: "Object not found" });
      res.writeHead(200, { "content-type": "image/jpeg" });
      return res.end(Buffer.from(objeto));
    }
    const objeto = `/storage/v1/object/${BUCKET}/`;
    if (req.method === "DELETE" && u.pathname.startsWith(objeto)) {
      if (!comChave()) return responder(401, { message: "sem apikey" });
      const caminho = depois(objeto);
      bucket.chamadas.push(`apagou ${caminho}`);
      return bucket.objetos.delete(caminho) ? responder(200, {}) : responder(400, { message: "Object not found" });
    }
    responder(404, { message: `o bucket falso nao conhece ${req.method} ${u.pathname}` });
  });
  await new Promise<void>((pronto) => servidor.listen(0, "127.0.0.1", pronto));
  process.env.SUPABASE_URL = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = CHAVE_DO_BUCKET_FALSO;
  process.env.SUPABASE_BUCKET = BUCKET;
  // Sem token, `scheduleTick` não sai da máquina: o agendado fica na fila do banco de teste.
  delete process.env.QSTASH_TOKEN;
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(process.env.SUPABASE_URL ?? "")) {
    throw new Error("RECUSADO: a SUPABASE_URL desta rodada nao e loopback. Sem isso, este teste escreveria no bucket de verdade.");
  }

  processo = await import("@/lib/bonus/publicar-processo");
  repo = await import("@/lib/bonus/carrossel-repositorio");
  regras = await import("@/lib/bonus/publicar-regras");
  slides = await import("@/lib/bonus/arte-slides");
  for (const [conta, nome] of [
    [CONTA, "thiagovannuchi"],
    [OUTRA, "n8x"],
  ] as const) {
    await banco.db().upsertAccount({
      ig_user_id: conta,
      username: nome,
      name: nome,
      profile_picture_url: null,
      access_token: "token-que-nao-vale-nada",
      token_expires_at: null,
    });
  }
  contas = await repo.contasParaArte();
});

afterAll(async () => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_BUCKET;
  await new Promise<void>((pronto) => servidor.close(() => pronto()));
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
  bucket.objetos.clear();
  bucket.chamadas = [];
  bucket.recusarLeitura.clear();
  drenagens = 0;
});

async function carrossel(arte: Record<string, unknown> = ARTE, texto: TextoDeCarrossel | TextoDePost = TEXTO): Promise<string> {
  const total = texto.tipo === "post" ? 1 : texto.slides.length + 2;
  const [c] = (await banco
    .db()
    .sql()
    .query(
      `insert into carrosseis_gerados (bonus_id, total_slides, palavra, contexto, estado, gerado, arte)
       values ($1, $2, 'SUMIDO', '{}'::jsonb, 'pronto', $3::jsonb, $4::jsonb) returning id`,
      [bonusId, total, texto, arte]
    )) as { id: string }[];
  return c.id;
}

const versaoDo = (n: number, texto: TextoDeCarrossel | TextoDePost = TEXTO) =>
  regras.versaoDoTextoDoSlide(slides.slidesDoTexto(texto)[n - 1]);

/** Assina, sobe pelo PUT de verdade (no bucket falso) e devolve o caminho. */
async function subir(id: string, numero: number, destino: "slide" | "fila"): Promise<string> {
  const a = await processo.assinarImagem({ id, numero, destino, arquivo: DECLARADO, contas });
  if (!a.ok) throw new Error(`assinar recusou: ${a.recusa.motivo}`);
  const r = await fetch(a.url, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: JPEG });
  if (!r.ok) throw new Error(`o PUT falhou: ${r.status}`);
  return a.caminho;
}

/** O carrossel com as imagens do Canva guardadas nos slides com espaço (2, 3 e 4). */
async function comImagens(): Promise<{ id: string; guardadas: Record<number, string> }> {
  const id = await carrossel();
  const guardadas: Record<number, string> = {};
  for (const n of [2, 3, 4]) {
    guardadas[n] = await subir(id, n, "slide");
    const g = await processo.guardarImagem({ id, numero: n, caminho: guardadas[n], contas });
    if (!g.ok) throw new Error(`guardar recusou: ${g.recusa.motivo}`);
  }
  return { id, guardadas };
}

/** As artes "Só texto" (1 e 5), subidas como o navegador sobe na hora de publicar. */
async function artesDe(id: string) {
  return Promise.all([1, 5].map(async (n) => ({ numero: n, caminho: await subir(id, n, "fila"), versao: versaoDo(n) })));
}

async function fila() {
  return (await banco.db().sql().query(`select account_id, payload, dedupe_key, status, not_before from queue order by created_at`)) as {
    account_id: string;
    payload: { forma: string; caminhos: string[]; legenda?: string };
    dedupe_key: string;
    status: string;
    not_before: Date;
  }[];
}

async function arteDe(id: string): Promise<Record<string, unknown>> {
  const [l] = (await banco.db().sql().query(`select arte from carrosseis_gerados where id = $1`, [id])) as { arte: Record<string, unknown> }[];
  return l.arte;
}

const daFila = () => [...bucket.objetos.keys()].filter((k) => k.startsWith(`${CONTA}/bonus-fila/`));

describe("assinar a imagem", () => {
  it("assina na pasta da conta do carrossel, no prefixo do destino", async () => {
    const id = await carrossel();
    const slide2 = await processo.assinarImagem({ id, numero: 2, destino: "slide", arquivo: DECLARADO, contas });
    const arte1 = await processo.assinarImagem({ id, numero: 1, destino: "fila", arquivo: DECLARADO, contas });
    expect(slide2.ok && slide2.caminho).toMatch(new RegExp(`^${CONTA}/bonus/[0-9a-f-]{36}\\.jpg$`));
    expect(arte1.ok && arte1.caminho).toMatch(new RegExp(`^${CONTA}/bonus-fila/[0-9a-f-]{36}\\.jpg$`));
  });

  it.each([
    ["o PNG", 2, "slide", { ...DECLARADO, mime: "image/png" }, "tipo"],
    ["a imagem quadrada", 2, "slide", { ...DECLARADO, largura: 1080, altura: 1080 }, "proporcao"],
    ["a imagem sem medida", 2, "slide", { ...DECLARADO, largura: undefined }, "proporcao"],
    ["a estreita demais, pela decisão do /publicar", 2, "slide", { ...DECLARADO, largura: 240, altura: 300 }, "arquivo"],
    ["o slide só texto no destino do slide", 1, "slide", DECLARADO, "sem_espaco"],
    ["o slide com espaço no destino da fila", 2, "fila", DECLARADO, "nao_e_so_texto"],
    ["o slide que não existe", 6, "slide", DECLARADO, "slide"],
  ] as const)("recusa %s", async (_nome, numero, destino, arquivo, motivo) => {
    const id = await carrossel();
    const r = await processo.assinarImagem({ id, numero, destino, arquivo, contas });
    expect(r.ok ? null : r.recusa.motivo).toBe(motivo);
    expect(bucket.chamadas.filter((c) => c.startsWith("assinou"))).toEqual([]);
  });

  it("recusa o carrossel sem conta, e o de conta desconectada", async () => {
    const semConta = await carrossel({ soTexto: [1, 5] });
    const r1 = await processo.assinarImagem({ id: semConta, numero: 2, destino: "slide", arquivo: DECLARADO, contas });
    expect(r1.ok ? null : r1.recusa.motivo).toBe("sem_conta");
    const desconectada = await carrossel({ ...ARTE, conta: "17841400000000099" });
    const r2 = await processo.assinarImagem({ id: desconectada, numero: 2, destino: "slide", arquivo: DECLARADO, contas });
    expect(r2.ok ? null : r2.recusa.motivo).toBe("conta_desconectada");
  });
});

describe("guardar a imagem", () => {
  it("guarda com a versão do texto, e a troca apaga a anterior do bucket", async () => {
    const id = await carrossel();
    const primeira = await subir(id, 3, "slide");
    expect(await processo.guardarImagem({ id, numero: 3, caminho: primeira, contas })).toEqual({ ok: true, versao: versaoDo(3) });
    const segunda = await subir(id, 3, "slide");
    await processo.guardarImagem({ id, numero: 3, caminho: segunda, contas });
    expect(bucket.objetos.has(primeira)).toBe(false);
    expect(bucket.objetos.has(segunda)).toBe(true);
    expect(regras.imagensDaArte(await arteDe(id), 5)[3]).toEqual({ caminho: segunda, versao: versaoDo(3) });
  });
});

describe("publicar", () => {
  it("agora: enfileira na conta do carrossel, com cópias em bonus-fila na ordem dos slides, e drena", async () => {
    const { id, guardadas } = await comImagens();
    const artes = await artesDe(id);
    const r = await processo.publicarNaFila({ id, quando: null, artes, contas, drenar });
    expect(r).toEqual({ ok: true, quando: null });

    const [item, ...resto] = await fila();
    expect(resto).toEqual([]);
    expect(item.account_id).toBe(CONTA);
    expect(item.payload.forma).toBe("carrossel");
    expect(item.payload.legenda).toBe(TEXTO.legenda);
    const caminhos = item.payload.caminhos;
    expect(caminhos).toHaveLength(5);
    expect(caminhos[0]).toBe(artes[0].caminho);
    expect(caminhos[4]).toBe(artes[1].caminho);
    for (const c of caminhos) expect(c).toMatch(new RegExp(`^${CONTA}/bonus-fila/[0-9a-f-]{36}\\.jpg$`));
    // As do meio são CÓPIAS das guardadas: nunca a guardada, que o dreno apagaria depois de publicar.
    for (const n of [2, 3, 4]) {
      expect(caminhos[n - 1]).not.toBe(guardadas[n]);
      expect(bucket.objetos.get(caminhos[n - 1])).toEqual(bucket.objetos.get(guardadas[n]));
      expect(bucket.objetos.has(guardadas[n])).toBe(true);
    }

    const publicacao = regras.publicacaoDaArte(await arteDe(id));
    expect(publicacao).toMatchObject({ chave: item.dedupe_key, caminhos });
    expect((publicacao as { enfileiradaEm: Date | null }).enfileiradaEm).toBeInstanceOf(Date);
    expect(drenagens).toBe(1);
  });

  it("agendado: entra com a hora pedida, e não drena", async () => {
    const { id } = await comImagens();
    const quando = new Date(Date.now() + 86_400_000);
    expect((await processo.publicarNaFila({ id, quando, artes: await artesDe(id), contas, drenar })).ok).toBe(true);
    const [item] = await fila();
    expect(Math.abs(item.not_before.getTime() - quando.getTime())).toBeLessThan(120_000);
    expect(drenagens).toBe(0);
  });

  it("o post de um slide sai como imagem única", async () => {
    const id = await carrossel({ ...ARTE, soTexto: [] }, POST);
    const caminho = await subir(id, 1, "slide");
    await processo.guardarImagem({ id, numero: 1, caminho, contas });
    expect((await processo.publicarNaFila({ id, quando: null, artes: [], contas, drenar })).ok).toBe(true);
    const [item] = await fila();
    expect(item.payload.forma).toBe("imagem");
    expect(item.payload.caminhos).toHaveLength(1);
  });

  it("dois publicar ao mesmo tempo: um post só, e as cópias e artes do outro saem do bucket", async () => {
    const { id } = await comImagens();
    const [artesA, artesB] = [await artesDe(id), await artesDe(id)];
    const [a, b] = await Promise.all([
      processo.publicarNaFila({ id, quando: null, artes: artesA, contas, drenar }),
      processo.publicarNaFila({ id, quando: null, artes: artesB, contas, drenar }),
    ]);
    expect([a.ok, b.ok].sort()).toEqual([false, true]);
    const perdeu = a.ok ? b : a;
    expect(perdeu.ok ? null : perdeu.recusa.motivo).toBe("travado");
    const itens = await fila();
    expect(itens).toHaveLength(1);
    expect(daFila().sort()).toEqual([...itens[0].payload.caminhos].sort());
  });

  it("falta imagem: recusa antes de tocar o bucket", async () => {
    const id = await carrossel();
    const r = await processo.publicarNaFila({ id, quando: null, artes: [], contas, drenar });
    expect(r.ok ? null : r.recusa).toEqual({ motivo: "faltam_imagens", slides: [2, 3, 4] });
    expect(bucket.chamadas).toEqual([]);
  });

  it("a arte velha é recusada, e as artes subidas saem do bucket", async () => {
    const { id } = await comImagens();
    const artes = await artesDe(id);
    const r = await processo.publicarNaFila({ id, quando: null, artes: [artes[0], { ...artes[1], versao: "00000000" }], contas, drenar });
    expect(r.ok ? null : r.recusa).toEqual({ motivo: "arte_velha", numero: 5 });
    expect(daFila()).toEqual([]);
    expect(await fila()).toEqual([]);
  });

  it("o caminho de uma arte que já está na fila de outro post é recusado, e não é apagado", async () => {
    const { id } = await comImagens();
    const artes = await artesDe(id);
    await banco
      .db()
      .sql()
      .query(
        `insert into queue (account_id, kind, payload, dedupe_key) values ($1, 'publicacao', $2::jsonb, 'pub:outro-post')`,
        [CONTA, { forma: "carrossel", caminhos: [artes[0].caminho, "x"] }]
      );
    const r = await processo.publicarNaFila({ id, quando: null, artes, contas, drenar });
    expect(r.ok ? null : r.recusa.motivo).toBe("caminho_na_fila");
    expect(bucket.objetos.has(artes[0].caminho)).toBe(true);
    expect(bucket.objetos.has(artes[1].caminho)).toBe(false);
  });

  it("a cópia que falha no meio: nada fica em bonus-fila, e nada é reservado", async () => {
    const { id, guardadas } = await comImagens();
    bucket.recusarLeitura.add(guardadas[3]);
    const r = await processo.publicarNaFila({ id, quando: null, artes: await artesDe(id), contas, drenar });
    expect(r.ok ? null : r.recusa).toEqual({ motivo: "copia", numero: 3 });
    expect(daFila()).toEqual([]);
    expect(regras.publicacaoDaArte(await arteDe(id))).toBeNull();
  });

  it("a fila que recusa desfaz a reserva e apaga as cópias e as artes", async () => {
    const { id } = await comImagens();
    const r = await processo.publicarNaFila({ id, quando: null, artes: await artesDe(id), contas, drenar, enfileirar: async () => false });
    expect(r.ok ? null : r.recusa.motivo).toBe("fila");
    expect(regras.publicacaoDaArte(await arteDe(id))).toBeNull();
    expect(daFila()).toEqual([]);
    expect(drenagens).toBe(0);
  });

  it("publicado e agendado, o carrossel trava: publicar, assinar e guardar são recusados", async () => {
    const { id } = await comImagens();
    await processo.publicarNaFila({ id, quando: new Date(Date.now() + 86_400_000), artes: await artesDe(id), contas, drenar });
    const r1 = await processo.publicarNaFila({ id, quando: null, artes: await artesDe(id).catch(() => []), contas, drenar });
    expect(r1.ok ? null : r1.recusa.motivo).toBe("travado");
    const r2 = await processo.assinarImagem({ id, numero: 2, destino: "slide", arquivo: DECLARADO, contas });
    expect(r2.ok ? null : r2.recusa.motivo).toBe("travado");
  });

  // ACHADO 75: desconectar a conta apaga as linhas da fila dela (lib/db.ts:469-474).
  it("a linha da fila apagada depois de enfileirar: publicar de novo segue recusado", async () => {
    const { id } = await comImagens();
    await processo.publicarNaFila({ id, quando: null, artes: await artesDe(id), contas, drenar });
    await banco.db().sql().query(`delete from queue where account_id = $1`, [CONTA]);
    const r = await processo.publicarNaFila({ id, quando: null, artes: [], contas, drenar });
    expect(r.ok ? null : r.recusa).toEqual({ motivo: "travado", estado: { tipo: "saiu_da_fila" } });
  });

  it("a reserva velha que nunca entrou na fila sai do bucket quando a nova a substitui", async () => {
    const { id } = await comImagens();
    const velhas = [await subir(id, 1, "fila"), await subir(id, 5, "fila")];
    await banco
      .db()
      .sql()
      .query(
        `update carrosseis_gerados set arte = arte || jsonb_build_object('publicacao',
           $2::jsonb || jsonb_build_object('reservada_em', now() - interval '11 minutes')) where id = $1`,
        [id, { chave: "pub:velha", caminhos: velhas }]
      );
    expect((await processo.publicarNaFila({ id, quando: null, artes: await artesDe(id), contas, drenar })).ok).toBe(true);
    for (const v of velhas) expect(bucket.objetos.has(v)).toBe(false);
  });

  // Revisão do plano (05/10): o navegador sempre assina um uuid novo, mas um pedido montado à mão pode
  // repetir na tentativa nova a arte da reserva velha. A limpeza da velha não pode apagar o que está
  // entrando na fila: o item sairia failed, com a mídia faltando.
  it("a reserva velha que repete um caminho desta tentativa não apaga o arquivo do post que entra", async () => {
    const { id } = await comImagens();
    const artes = await artesDe(id);
    await banco
      .db()
      .sql()
      .query(
        `update carrosseis_gerados set arte = arte || jsonb_build_object('publicacao',
           $2::jsonb || jsonb_build_object('reservada_em', now() - interval '11 minutes')) where id = $1`,
        [id, { chave: "pub:velha", caminhos: [artes[0].caminho] }]
      );
    expect((await processo.publicarNaFila({ id, quando: null, artes, contas, drenar })).ok).toBe(true);
    const [item] = await fila();
    expect(item.payload.caminhos[0]).toBe(artes[0].caminho);
    expect(bucket.objetos.has(artes[0].caminho)).toBe(true);
  });
});
