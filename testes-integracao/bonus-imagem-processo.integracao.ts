// O CRIADOR DE IMAGEM CONTRA O BANCO E UM BUCKET FALSO (spec da Etapa 6, "Pedir e acompanhar").
//
// A FORMA É A DE `bonus-publicar-processo.integracao.ts`: o bucket é um servidor HTTP nesta máquina, as
// três variáveis do Supabase apontam para ele, e o `beforeAll` recusa rodar se a `SUPABASE_URL` não for
// loopback. **A OpenAI é sempre uma função falsa, passada por parâmetro: nada sai desta máquina.**
//
// O que este arquivo prende é a COSTURA: o pedir que recusa sem custo e sem linha; o gerar que confere,
// sobe, guarda como foto e marca a linha; e o que fica no bucket em cada falha (achado 89).
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { TextoDeCarrossel } from "@/lib/bonus/carrossel-texto";
import { bancoDescartavel } from "./harness";

type ModuloImagem = typeof import("@/lib/bonus/imagem-processo");
type ModuloPublicar = typeof import("@/lib/bonus/publicar-processo");
type ModuloRegras = typeof import("@/lib/bonus/publicar-regras");
type ModuloSlides = typeof import("@/lib/bonus/arte-slides");
type ModuloTextos = typeof import("@/lib/bonus/imagem-textos");
type ModuloConsulta = typeof import("@/lib/bonus/imagem-consulta");
type ModuloCarrossel = typeof import("@/lib/bonus/carrossel-repositorio");
type ModuloTela = typeof import("@/lib/bonus/arte-tela");
type ContaDoCabecalho = import("@/lib/bonus/arte-conta").ContaDoCabecalho;

const banco = bancoDescartavel();

const CONTA = "17841400000000001";
const CHAVE_DO_BUCKET_FALSO = "chave-de-servico-inventada-para-o-teste";
const BUCKET = "MetodoChatDeTeste";
const AMBIENTE = { OPENAI_API_KEY: "chave-inventada-para-o-teste" };
const JPEG_DO_CANVA = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 9, 9, 9]);
const DECLARADO = { nome: "slide.jpg", mime: "image/jpeg", bytes: 1000, largura: 1080, altura: 1350 };
const CENA = "/marketing uma pessoa usando o celular numa loja de roupas";

const slide = (i: number) => ({ titulo: `Título do slide ${i}`, texto: `Texto do slide ${i}, com mais de trinta caracteres.` });
const TEXTO: TextoDeCarrossel = {
  tipo: "carrossel",
  titulo: "Mensagens para reativar clientes",
  gancho: "Seu cliente sumiu? Não é culpa dele.",
  slides: [slide(1), slide(2), slide(3)],
  chamada: "Comente SUMIDO e receba as mensagens prontas.",
  legenda: "Quem sumiu ainda pode voltar. Comente SUMIDO que eu te mando as mensagens prontas para usar hoje mesmo.",
};
// 5 slides: o 1 (gancho) e o 5 (chamada) são "só texto"; o 2, o 3 e o 4 têm espaço de imagem.
const ARTE = { conta: CONTA, nome: "Thiago Vannuchi", arroba: "thiagovannuchi", soTexto: [1, 5] };

/** Um segmento JPEG: FF, a marca, o tamanho em dois bytes (que conta a si mesmo) e o conteúdo. */
const segmento = (marca: number, conteudo: number[]) => [0xff, marca, (conteudo.length + 2) >> 8, (conteudo.length + 2) & 0xff, ...conteudo];
/** O começo de um JPEG com as medidas no SOF, como o que a OpenAI devolve, e o fim. */
function jpeg(largura: number, altura: number): Uint8Array {
  const sof = segmento(0xc0, [8, altura >> 8, altura & 0xff, largura >> 8, largura & 0xff, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
  return new Uint8Array([0xff, 0xd8, ...segmento(0xe0, [0x4a, 0x46, 0x49, 0x46, 0]), ...sof, ...segmento(0xda, [0]), 0x55, 0xff, 0xd9]);
}
const GERADA = jpeg(1536, 1024);
const openaiQueGera = async () => ({ ok: true as const, bytes: GERADA });

// O BUCKET FALSO: os objetos ficam num Map, e cada chamada fica anotada.
const bucket = { objetos: new Map<string, Uint8Array>(), chamadas: [] as string[] };
let servidor: Server;
let imagem: ModuloImagem;
let publicar: ModuloPublicar;
let regras: ModuloRegras;
let slides: ModuloSlides;
let textos: ModuloTextos;
let consulta: ModuloConsulta;
let carrosselRepo: ModuloCarrossel;
let tela: ModuloTela;
let contas: ContaDoCabecalho[];

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
      const objeto = bucket.objetos.get(depois(publico));
      if (!objeto) return responder(400, { message: "Object not found" });
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
  delete process.env.QSTASH_TOKEN;
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(process.env.SUPABASE_URL ?? "")) {
    throw new Error("RECUSADO: a SUPABASE_URL desta rodada nao e loopback. Sem isso, este teste escreveria no bucket de verdade.");
  }
  imagem = await import("@/lib/bonus/imagem-processo");
  publicar = await import("@/lib/bonus/publicar-processo");
  regras = await import("@/lib/bonus/publicar-regras");
  slides = await import("@/lib/bonus/arte-slides");
  textos = await import("@/lib/bonus/imagem-textos");
  consulta = await import("@/lib/bonus/imagem-consulta");
  carrosselRepo = await import("@/lib/bonus/carrossel-repositorio");
  tela = await import("@/lib/bonus/arte-tela");
  await banco.db().upsertAccount({
    ig_user_id: CONTA,
    username: "thiagovannuchi",
    name: "thiagovannuchi",
    profile_picture_url: null,
    access_token: "token-que-nao-vale-nada",
    token_expires_at: null,
  });
  contas = await (await import("@/lib/bonus/carrossel-repositorio")).contasParaArte();
});

afterAll(async () => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_BUCKET;
  await new Promise<void>((pronto) => servidor.close(() => pronto()));
});

beforeEach(async () => {
  await banco.db().sql().query(`delete from queue`);
  await banco.db().sql().query(`delete from imagens_geradas`);
  await banco.db().sql().query(`delete from carrosseis_gerados`);
  bucket.objetos.clear();
  bucket.chamadas = [];
});

/** O carrossel avulso do texto livre, pronto, com a arte dada. */
async function carrossel(arte: Record<string, unknown> = ARTE): Promise<string> {
  const [c] = (await banco
    .db()
    .sql()
    .query(
      `insert into carrosseis_gerados (origem, total_slides, palavra, contexto, estado, gerado, arte)
       values ('livre', 5, 'SUMIDO', $1::jsonb, 'pronto', $2::jsonb, $3::jsonb) returning id`,
      [{ tipo: "livre", tema: "Vendas", conteudo: "Mensagens para trazer de volta quem sumiu." }, TEXTO, arte]
    )) as { id: string }[];
  return c.id;
}

const pedir = (id: string, numero = 2, descricao = CENA, ambiente: Record<string, string | undefined> = AMBIENTE) =>
  imagem.pedirImagem({ id, numero, descricao, contas, ambiente });

/** Pede e devolve a reserva; o caso que chama quer que o pedido passe. */
async function reservado(id: string, numero = 2): Promise<string> {
  const r = await pedir(id, numero);
  if (!r.ok) throw new Error(`o pedido devia passar: ${r.recusa.motivo}`);
  return r.reservaId;
}

async function linhas() {
  return (await banco.db().sql().query(`select numero, estado, motivo, caminho from imagens_geradas order by criado_em`)) as {
    numero: number;
    estado: string;
    motivo: string | null;
    caminho: string | null;
  }[];
}

async function arteDe(id: string): Promise<Record<string, unknown>> {
  const [l] = (await banco.db().sql().query(`select arte from carrosseis_gerados where id = $1`, [id])) as { arte: Record<string, unknown> }[];
  return l.arte;
}

const fotosNoBucket = () => [...bucket.objetos.keys()].filter((k) => k.startsWith(`${CONTA}/bonus-foto/`));

/** Assina, sobe pelo PUT de verdade (no bucket falso) e guarda o slide pronto do Canva no slide. */
async function slidePronto(id: string, numero: number): Promise<string> {
  const a = await publicar.assinarImagem({ id, numero, destino: "slide", arquivo: DECLARADO, contas });
  if (!a.ok) throw new Error(`assinar recusou: ${a.recusa.motivo}`);
  await fetch(a.url, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: JPEG_DO_CANVA });
  const g = await publicar.guardarImagem({ id, numero, caminho: a.caminho, contas });
  if (!g.ok) throw new Error(`guardar recusou: ${g.recusa.motivo}`);
  return a.caminho;
}

describe("pedir uma imagem", () => {
  it("reserva a linha gerando, com a conta do dia, sem chamar a OpenAI", async () => {
    const id = await carrossel();
    const r = await pedir(id);
    expect(r).toMatchObject({ ok: true, hoje: 1 });
    expect(await linhas()).toEqual([{ numero: 2, estado: "gerando", motivo: null, caminho: null }]);
    expect(bucket.chamadas).toEqual([]);
  });

  it.each([
    ["o slide que não existe", { numero: 9 }, "slide"],
    ["o slide só texto", { numero: 1 }, "sem_espaco"],
    ["a descrição curta", { descricao: "uma" }, "descricao"],
    ["o atalho que não existe", { descricao: "/vitrine uma caixa de presente bonita" }, "descricao"],
    ["sem a chave", { ambiente: {} }, "sem_chave"],
  ])("recusa %s, sem linha nova", async (_nome, mudanca, motivo) => {
    const id = await carrossel();
    const m = mudanca as { numero?: number; descricao?: string; ambiente?: Record<string, string | undefined> };
    const r = await pedir(id, m.numero ?? 2, m.descricao ?? CENA, m.ambiente ?? AMBIENTE);
    expect(r.ok ? null : r.recusa.motivo).toBe(motivo);
    expect(await linhas()).toEqual([]);
  });

  it.each([
    ["o carrossel sem conta", {}, "sem_conta"],
    ["o carrossel de conta desconectada", { ...ARTE, conta: "17841499999999999" }, "conta_desconectada"],
  ])("recusa %s, sem linha nova", async (_nome, arte, motivo) => {
    const id = await carrossel(arte);
    const r = await pedir(id);
    expect(r.ok ? null : r.recusa.motivo).toBe(motivo);
    expect(await linhas()).toEqual([]);
  });

  it("recusa o carrossel na fila, sem linha nova", async () => {
    const id = await carrossel({
      ...ARTE,
      publicacao: { chave: "pub:outro", caminhos: [`${CONTA}/bonus-fila/x.jpg`], reservada_em: new Date().toISOString() },
    });
    const r = await pedir(id);
    expect(r.ok ? null : r.recusa.motivo).toBe("travado");
    expect(await linhas()).toEqual([]);
  });

  it("recusa pelo teto, com 10 no dia", async () => {
    const id = await carrossel();
    for (let i = 0; i < 10; i++) {
      await banco
        .db()
        .sql()
        .query(`insert into imagens_geradas (carrossel_id, numero, descricao, estado, motivo, terminado_em) values ($1, 3, 'uma cena', 'falhou', 'x', now())`, [id]);
    }
    const r = await pedir(id);
    expect(r).toEqual({ ok: false, recusa: { motivo: "teto" }, hoje: 10 });
  });
});

describe("gerar a imagem", () => {
  it("vai para bonus-foto na pasta da conta, o slide guarda como foto, a anterior sai, e a linha fica pronta", async () => {
    const id = await carrossel();
    const anterior = await slidePronto(id, 2);
    const reservaId = await reservado(id);
    const r = await imagem.gerarImagem({ reservaId, id, numero: 2, descricao: CENA, contas, gerar: openaiQueGera });
    if (!r.ok) throw new Error(`a geração devia passar: ${r.motivo}`);
    expect(r.caminho).toMatch(new RegExp(`^${CONTA}/bonus-foto/[0-9a-f-]{36}\\.jpg$`));
    expect(bucket.objetos.get(r.caminho)).toEqual(GERADA);
    expect(bucket.objetos.has(anterior)).toBe(false);
    expect(regras.fotosDaArte(await arteDe(id), 5)).toEqual({ 2: r.caminho });
    expect(await linhas()).toEqual([{ numero: 2, estado: "pronta", motivo: null, caminho: r.caminho }]);
  });

  it("o publicar desse slide sai pela arte, como foto: a imagem gerada não vai para a fila", async () => {
    const id = await carrossel();
    for (const n of [3, 4]) await slidePronto(id, n);
    const r = await imagem.gerarImagem({ reservaId: await reservado(id), id, numero: 2, descricao: CENA, contas, gerar: openaiQueGera });
    if (!r.ok) throw new Error(`a geração devia passar: ${r.motivo}`);
    const desenho = (n: number, foto: string | null) => regras.versaoDoDesenho(slides.slidesDoTexto(TEXTO)[n - 1], foto);
    const subir = async (n: number) => {
      const a = await publicar.assinarImagem({ id, numero: n, destino: "fila", arquivo: DECLARADO, contas });
      if (!a.ok) throw new Error(`assinar recusou: ${a.recusa.motivo}`);
      await fetch(a.url, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: JPEG_DO_CANVA });
      return a.caminho;
    };
    const artes = [
      { numero: 1, caminho: await subir(1), versao: desenho(1, null) },
      { numero: 2, caminho: await subir(2), versao: desenho(2, r.caminho) },
      { numero: 5, caminho: await subir(5), versao: desenho(5, null) },
    ];
    expect(await publicar.publicarNaFila({ id, quando: new Date(Date.now() + 86_400_000), artes, contas, drenar: async () => {} })).toEqual({
      ok: true,
      quando: expect.any(Date),
    });
    const [item] = (await banco.db().sql().query(`select payload from queue`)) as { payload: { caminhos: string[] } }[];
    expect(item.payload.caminhos[1]).toBe(artes[1].caminho);
    expect(item.payload.caminhos).not.toContain(r.caminho);
  });

  it("a recusa da OpenAI fica falhou, com a frase, e nada sobe", async () => {
    const id = await carrossel();
    const erro = "A OpenAI recusou o pedido. (OpenAI: Your request was rejected by the safety system.)";
    const r = await imagem.gerarImagem({ reservaId: await reservado(id), id, numero: 2, descricao: CENA, contas, gerar: async () => ({ ok: false, erro }) });
    expect(r).toEqual({ ok: false, motivo: erro });
    expect(await linhas()).toEqual([{ numero: 2, estado: "falhou", motivo: erro, caminho: null }]);
    expect(bucket.chamadas).toEqual([]);
  });

  it("a imagem fora do formato não sobe, e a linha fica falhou com a frase", async () => {
    const id = await carrossel();
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const r = await imagem.gerarImagem({
      reservaId: await reservado(id),
      id,
      numero: 2,
      descricao: CENA,
      contas,
      gerar: async () => ({ ok: true, bytes: png }),
    });
    expect(r).toEqual({ ok: false, motivo: textos.textoDoProblemaDaImagem("formato") });
    expect(bucket.chamadas.filter((c) => c.startsWith("subiu"))).toEqual([]);
  });

  it("o carrossel agendado no meio da geração não recebe a imagem, e nada sobe", async () => {
    const id = await carrossel();
    const reservaId = await reservado(id);
    const agendaNoMeio = async () => {
      await banco
        .db()
        .sql()
        .query(`update carrosseis_gerados set arte = arte || $2::jsonb where id = $1`, [
          id,
          { publicacao: { chave: "pub:no-meio", caminhos: [`${CONTA}/bonus-fila/x.jpg`], reservada_em: new Date().toISOString() } },
        ]);
      return { ok: true as const, bytes: GERADA };
    };
    const r = await imagem.gerarImagem({ reservaId, id, numero: 2, descricao: CENA, contas, gerar: agendaNoMeio });
    expect(r.ok).toBe(false);
    expect(fotosNoBucket()).toEqual([]);
    expect(regras.fotosDaArte(await arteDe(id), 5)).toEqual({});
    expect((await linhas())[0].estado).toBe("falhou");
  });

  // ACHADO 89: enquanto o guardar não confirmou, a falha apaga o que subiu.
  it("a falha ao guardar apaga do bucket o que subiu", async () => {
    const id = await carrossel();
    const r = await imagem.gerarImagem({
      reservaId: await reservado(id),
      id,
      numero: 2,
      descricao: CENA,
      contas,
      gerar: openaiQueGera,
      guardar: async () => ({ ok: false, recusa: { motivo: "mudou" } }),
    });
    expect(r.ok).toBe(false);
    expect(bucket.chamadas.some((c) => c.startsWith(`subiu ${CONTA}/bonus-foto/`))).toBe(true);
    expect(fotosNoBucket()).toEqual([]);
    expect((await linhas())[0].estado).toBe("falhou");
  });

  // ACHADO 89: depois do guardar, o arquivo já é a foto do slide. A falha ao marcar a linha deixa o
  // arquivo, e a linha `gerando` vence pelo prazo e conta no teto.
  it("a falha ao marcar a linha, depois de guardar, deixa a foto no bucket e no slide", async () => {
    const id = await carrossel();
    const r = await imagem.gerarImagem({
      reservaId: await reservado(id),
      id,
      numero: 2,
      descricao: CENA,
      contas,
      gerar: openaiQueGera,
      marcarPronta: async () => {
        throw new Error("o banco caiu bem nesta hora");
      },
    });
    expect(r.ok).toBe(true);
    const [foto] = fotosNoBucket();
    expect(foto).toBeDefined();
    expect(regras.fotosDaArte(await arteDe(id), 5)).toEqual({ 2: foto });
    expect((await linhas())[0].estado).toBe("gerando");
  });

  it("a OpenAI que lança fica falhou, com a frase sem motivo", async () => {
    const id = await carrossel();
    const r = await imagem.gerarImagem({
      reservaId: await reservado(id),
      id,
      numero: 2,
      descricao: CENA,
      contas,
      gerar: async () => {
        throw new Error("explodiu");
      },
    });
    expect(r).toEqual({ ok: false, motivo: textos.TEXTO_IMAGEM_FALHOU_SEM_MOTIVO });
    expect((await linhas())[0]).toMatchObject({ estado: "falhou", motivo: textos.TEXTO_IMAGEM_FALHOU_SEM_MOTIVO });
  });
});

// A CONSULTA DE UM SLIDE (spec da Etapa 6, "O acompanhar"): o que a rota GET devolve ao card, que pergunta
// a cada 2 s enquanto a imagem gera. A rota só confere a sessão e o carrossel e chama esta consulta.
describe("a consulta de um slide", () => {
  const consultar = async (id: string, numero = 2) => {
    const linha = await carrosselRepo.lerCarrossel(id);
    if (!linha) throw new Error("o carrossel devia existir");
    return consulta.consultarImagem({ linha, numero });
  };

  it("sem pedido, nenhuma, com a conta do dia", async () => {
    const id = await carrossel();
    expect(await consultar(id)).toEqual({ estado: "nenhuma", hoje: 0 });
  });

  it("gerando, enquanto a geração não termina; o outro slide segue sem pedido", async () => {
    const id = await carrossel();
    await reservado(id);
    expect(await consultar(id)).toEqual({ estado: "gerando", hoje: 1 });
    expect(await consultar(id, 3)).toEqual({ estado: "nenhuma", hoje: 1 });
  });

  it("pronta, com a versão nova da miniatura, a mesma que a página desenharia", async () => {
    const id = await carrossel();
    const r = await imagem.gerarImagem({ reservaId: await reservado(id), id, numero: 2, descricao: CENA, contas, gerar: openaiQueGera });
    if (!r.ok) throw new Error(`a geração devia passar: ${r.motivo}`);
    const conta = contas.find((c) => c.ig_user_id === CONTA) ?? null;
    const comFoto = tela.versoesDosSlides(slides.slidesDoTexto(TEXTO), [1, 5], tela.cabecalhoParaVersao(conta), { 2: r.caminho })[1];
    const semFoto = tela.versoesDosSlides(slides.slidesDoTexto(TEXTO), [1, 5], tela.cabecalhoParaVersao(conta), {})[1];
    expect(comFoto).not.toBe(semFoto);
    expect(await consultar(id)).toEqual({ estado: "pronta", hoje: 1, versao: expect.any(String), versaoDaMiniatura: comFoto });
  });

  it("falhou, com o motivo da linha", async () => {
    const id = await carrossel();
    const erro = "A OpenAI recusou o pedido.";
    await imagem.gerarImagem({ reservaId: await reservado(id), id, numero: 2, descricao: CENA, contas, gerar: async () => ({ ok: false, erro }) });
    expect(await consultar(id)).toEqual({ estado: "falhou", hoje: 1, texto: erro });
  });

  it("a linha travada pelo prazo vira falha, com a frase da travada", async () => {
    const id = await carrossel();
    await reservado(id);
    await banco.db().sql().query(`update imagens_geradas set criado_em = now() - interval '4 minutes'`);
    expect(await consultar(id)).toEqual({ estado: "falhou", hoje: 1, texto: textos.TEXTO_IMAGEM_TRAVADA });
  });
});
