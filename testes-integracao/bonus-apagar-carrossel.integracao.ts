// O APAGAR CONTRA O BANCO E UM BUCKET FALSO (spec da Etapa 10, "O apagar no servidor").
//
// A FORMA É A DE `bonus-imagem-processo.integracao.ts`: o bucket é um servidor HTTP nesta máquina, as
// três variáveis do Supabase apontam para ele, e o `beforeAll` recusa rodar se a `SUPABASE_URL` não for
// loopback. **A OpenAI é sempre uma função falsa: nada sai desta máquina.**
//
// O que este arquivo prende: a linha que some e o que fica (as linhas de `imagens_geradas` com o
// carrossel nulo, as da fila); os arquivos que saem do bucket, só depois do commit; as recusas, sem apagar
// nada nem tocar no bucket; e as duas corridas, com o agendar e com a reserva de uma imagem (achado 96),
// forçadas por uma transação do próprio teste que segura a linha.
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { TextoDeCarrossel } from "@/lib/bonus/carrossel-texto";
import { bancoDescartavel } from "./harness";

type ModuloApagar = typeof import("@/lib/bonus/apagar-carrossel");
type ModuloImagemRepo = typeof import("@/lib/bonus/imagem-repositorio");
type ModuloImagem = typeof import("@/lib/bonus/imagem-processo");
type ModuloPublicar = typeof import("@/lib/bonus/publicar-repositorio");
type ModuloCarrossel = typeof import("@/lib/bonus/carrossel-repositorio");
type ContaDoCabecalho = import("@/lib/bonus/arte-conta").ContaDoCabecalho;
type Tx = { query: (texto: string, params?: unknown[]) => Promise<unknown[]> };

const banco = bancoDescartavel();

const CONTA = "17841400000000001";
const CHAVE_DO_BUCKET_FALSO = "chave-de-servico-inventada-para-o-teste";
const BUCKET = "MetodoChatDeTeste";
const AMBIENTE = { OPENAI_API_KEY: "chave-inventada-para-o-teste" };
const CENA = "/marketing uma pessoa usando o celular numa loja de roupas";
const BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

const u = (n: number) => `${String(n).repeat(8)}-1111-4111-8111-111111111111`;
const FOTO = `${CONTA}/bonus-foto/${u(1)}.jpg`;
const PRONTO = `${CONTA}/bonus/${u(2)}.jpg`;
const FILA = `${CONTA}/bonus-fila/${u(3)}.jpg`;
/** O arquivo de outro carrossel, na mesma pasta: fica. */
const ALHEIO = `${CONTA}/bonus-foto/${u(9)}.jpg`;

const slide = (i: number) => ({ titulo: `Título do slide ${i}`, texto: `Texto do slide ${i}, com mais de trinta caracteres.` });
const TEXTO: TextoDeCarrossel = {
  tipo: "carrossel",
  titulo: "Mensagens para reativar clientes",
  gancho: "Seu cliente sumiu? Não é culpa dele.",
  slides: [slide(1), slide(2), slide(3)],
  chamada: "Comente SUMIDO e receba as mensagens prontas.",
  legenda: "Quem sumiu ainda pode voltar. Comente SUMIDO que eu te mando as mensagens prontas para usar hoje mesmo.",
};
const ARTE = { conta: CONTA, nome: "Thiago Vannuchi", arroba: "thiagovannuchi" };
const COM_ARQUIVOS = { ...ARTE, imagens: { "2": { caminho: FOTO, versao: "v" }, "3": { caminho: PRONTO, versao: "v" } } };

// O BUCKET FALSO: os objetos ficam num Map, e cada chamada fica anotada. `falhar` derruba o DELETE.
const bucket = { objetos: new Map<string, Uint8Array>(), chamadas: [] as string[], falhar: false };
let servidor: Server;
let apagar: ModuloApagar;
let imagemRepo: ModuloImagemRepo;
let imagem: ModuloImagem;
let publicar: ModuloPublicar;
let carrosselRepo: ModuloCarrossel;
let contas: ContaDoCabecalho[];

beforeAll(async () => {
  servidor = createServer(async (req, res) => {
    const u = new URL(req.url ?? "/", "http://127.0.0.1");
    for await (const _ of req) void _;
    const responder = (status: number, json: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(json));
    };
    const objeto = `/storage/v1/object/${BUCKET}/`;
    if (req.method === "DELETE" && u.pathname.startsWith(objeto)) {
      if (req.headers["apikey"] !== CHAVE_DO_BUCKET_FALSO) return responder(401, { message: "sem apikey" });
      const caminho = decodeURIComponent(u.pathname.slice(objeto.length));
      bucket.chamadas.push(`apagou ${caminho}`);
      if (bucket.falhar) return responder(500, { message: "o bucket falso caiu" });
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
    throw new Error("RECUSADO: a SUPABASE_URL desta rodada nao e loopback. Sem isso, este teste apagaria no bucket de verdade.");
  }
  apagar = await import("@/lib/bonus/apagar-carrossel");
  imagemRepo = await import("@/lib/bonus/imagem-repositorio");
  imagem = await import("@/lib/bonus/imagem-processo");
  publicar = await import("@/lib/bonus/publicar-repositorio");
  carrosselRepo = await import("@/lib/bonus/carrossel-repositorio");
  await banco.db().upsertAccount({
    ig_user_id: CONTA,
    username: "thiagovannuchi",
    name: "thiagovannuchi",
    profile_picture_url: null,
    access_token: "token-que-nao-vale-nada",
    token_expires_at: null,
  });
  contas = await carrosselRepo.contasParaArte();
});

afterAll(async () => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_BUCKET;
  await new Promise<void>((pronto) => servidor.close(() => pronto()));
});

beforeEach(async () => {
  await sql().query(`delete from queue`);
  await sql().query(`delete from imagens_geradas`);
  await sql().query(`delete from carrosseis_gerados`);
  bucket.objetos.clear();
  bucket.chamadas = [];
  bucket.falhar = false;
});

const sql = () => banco.db().sql();

/** O carrossel avulso do texto livre, com a arte dada; pronto, salvo pedido o contrário. */
async function carrossel(p: { arte?: Record<string, unknown>; estado?: "pronto" | "gerando" | "falhou"; criadoHaMs?: number } = {}) {
  const estado = p.estado ?? "pronto";
  const [c] = (await sql().query(
    `insert into carrosseis_gerados (origem, total_slides, palavra, contexto, estado, gerado, erro, arte, criado_em)
     values ('livre', 5, 'SUMIDO', $1::jsonb, $2, $3::jsonb, $4, $5::jsonb, now() - $6::int * interval '1 millisecond') returning id`,
    [
      { tipo: "livre", tema: "Vendas", conteudo: "Mensagens para trazer de volta quem sumiu." },
      estado,
      estado === "pronto" ? TEXTO : null,
      estado === "falhou" ? "A IA não respondeu." : null,
      p.arte ?? ARTE,
      p.criadoHaMs ?? 0,
    ]
  )) as { id: string }[];
  return c.id;
}

/** A publicação guardada na arte, como `reservarPublicacao` e `marcarEnfileirada` a gravam. */
const publicacao = (chave: string, p: { enfileirada?: boolean; reservadaHaMin?: number } = {}) => ({
  chave,
  caminhos: [FILA],
  reservada_em: new Date(Date.now() - (p.reservadaHaMin ?? 0) * 60_000).toISOString(),
  ...(p.enfileirada === false ? {} : { enfileirada_em: new Date().toISOString() }),
});

/** A linha da fila do /publicar, pela chave exata. */
async function fila(chave: string, status: string, adiante = "1 hour") {
  await sql().query(
    `insert into queue (account_id, kind, payload, dedupe_key, status, not_before)
     values ($1, 'publicacao', $2::jsonb, $3, $4, now() + $5::interval)`,
    [CONTA, { forma: "carrossel", caminhos: [FILA] }, chave, status, adiante]
  );
}

/** Uma linha de `imagens_geradas` do carrossel, no estado dado, criada há tantos ms. */
async function imagemGerada(id: string, estado: "gerando" | "pronta", criadoHaMs = 0) {
  await sql().query(
    `insert into imagens_geradas (carrossel_id, numero, descricao, estado, caminho, terminado_em, criado_em)
     values ($1, 2, 'uma cena', $2, $3, $4, now() - $5::int * interval '1 millisecond')`,
    [id, estado, estado === "pronta" ? FOTO : null, estado === "pronta" ? new Date() : null, criadoHaMs]
  );
}

async function existe(id: string): Promise<boolean> {
  return (await sql().query(`select 1 from carrosseis_gerados where id = $1`, [id])).length === 1;
}

const noBucket = (...caminhos: string[]) => caminhos.forEach((c) => bucket.objetos.set(c, BYTES));

/**
 * Uma transação do próprio teste que faz `passo` e segura a linha até o teste mandar soltar. A chamada
 * que corre contra ela fica DENTRO do `try` (achado 74): se ela lançar, o `finally` solta assim mesmo.
 */
async function segurando<T>(passo: (tx: Tx) => Promise<void>, corrida: () => Promise<T>): Promise<T> {
  let soltar!: () => void;
  const segura = new Promise<void>((f) => (soltar = f));
  let travou!: () => void;
  const travado = new Promise<void>((f) => (travou = f));
  const transacao = sql().begin(async (tx) => {
    await passo(tx);
    travou();
    await segura;
  });
  await travado;
  const corridas: Promise<T>[] = [];
  try {
    corridas.push(corrida());
    await new Promise((f) => setTimeout(f, 300));
  } finally {
    soltar();
    await transacao;
  }
  const [r] = await Promise.all(corridas);
  return r;
}

describe("apagar um rascunho", () => {
  // A CÓPIA QUE UM ITEM DA FILA AINDA USA FICA (achado 97): o item que falhou mantém o arquivo, pela regra
  // do dono (lib/queue-drain.ts:301-303), e o apagar não a leva, como o publicar já não leva (`caminhosNaFila`).
  it("a linha some; as imagens geradas ficam com o carrossel nulo; a fila fica; os arquivos dele saem do bucket, menos a cópia que um item da fila ainda usa (achado 97)", async () => {
    const id = await carrossel({ arte: { ...COM_ARQUIVOS, publicacao: publicacao("pub:falhou") } });
    await fila("pub:falhou", "failed");
    await imagemGerada(id, "pronta");
    noBucket(FOTO, PRONTO, FILA, ALHEIO);

    expect(await apagar.apagarCarrossel(id)).toEqual({ ok: true });

    expect(await existe(id)).toBe(false);
    expect(await sql().query(`select carrossel_id, caminho from imagens_geradas`)).toEqual([{ carrossel_id: null, caminho: FOTO }]);
    expect(await sql().query(`select dedupe_key, status from queue`)).toEqual([{ dedupe_key: "pub:falhou", status: "failed" }]);
    expect([...bucket.objetos.keys()].sort()).toEqual([FILA, ALHEIO].sort());
    expect([...bucket.chamadas].sort()).toEqual([`apagou ${FOTO}`, `apagou ${PRONTO}`].sort());
  });

  it("a cópia de uma reserva que não entrou na fila sai do bucket: nenhum item a usa (achado 97)", async () => {
    const id = await carrossel({ arte: { ...ARTE, publicacao: publicacao("pub:sem-linha", { enfileirada: false, reservadaHaMin: 11 }) } });
    noBucket(FILA, ALHEIO);
    expect(await apagar.apagarCarrossel(id)).toEqual({ ok: true });
    expect([...bucket.objetos.keys()]).toEqual([ALHEIO]);
    expect(bucket.chamadas).toEqual([`apagou ${FILA}`]);
  });

  it("o cancelado no calendário e o que não entrou na fila também se apagam", async () => {
    const cancelado = await carrossel({ arte: { ...ARTE, publicacao: publicacao("pub:cancelado") } });
    await fila("pub:cancelado", "skipped");
    const naoEntrou = await carrossel({ arte: { ...ARTE, publicacao: publicacao("pub:sem-linha", { enfileirada: false, reservadaHaMin: 11 }) } });
    expect(await apagar.apagarCarrossel(cancelado)).toEqual({ ok: true });
    expect(await apagar.apagarCarrossel(naoEntrou)).toEqual({ ok: true });
    expect([await existe(cancelado), await existe(naoEntrou)]).toEqual([false, false]);
  });

  it("o que falhou ou travou na geração também se apaga", async () => {
    const falhou = await carrossel({ estado: "falhou" });
    const travou = await carrossel({ estado: "gerando", criadoHaMs: 201_000 });
    expect(await apagar.apagarCarrossel(falhou)).toEqual({ ok: true });
    expect(await apagar.apagarCarrossel(travou)).toEqual({ ok: true });
  });

  it("a imagem travada pelo prazo não segura o apagar", async () => {
    const id = await carrossel();
    await imagemGerada(id, "gerando", 211_000);
    expect(await apagar.apagarCarrossel(id)).toEqual({ ok: true });
  });
});

describe("as recusas, sem apagar nada nem tocar no bucket", () => {
  it.each([
    ["agendado", "pending", "1 hour", "agendado"],
    ["publicando", "sending", "0 seconds", "agendado"],
    ["publicado", "sent", "0 seconds", "publicado"],
  ] as const)("a publicação %s", async (_nome, status, adiante, motivo) => {
    const id = await carrossel({ arte: { ...COM_ARQUIVOS, publicacao: publicacao("pub:k") } });
    await fila("pub:k", status, adiante);
    noBucket(FOTO, PRONTO, FILA);
    expect(await apagar.apagarCarrossel(id)).toEqual({ ok: false, motivo });
    expect(await existe(id)).toBe(true);
    expect(bucket.chamadas).toEqual([]);
  });

  it("a reserva que acabou de ser feita, ainda sem linha na fila (publicando)", async () => {
    const id = await carrossel({ arte: { ...ARTE, publicacao: publicacao("pub:agora", { enfileirada: false }) } });
    expect(await apagar.apagarCarrossel(id)).toEqual({ ok: false, motivo: "agendado" });
    expect(await existe(id)).toBe(true);
  });

  it("a publicação que saiu da fila (enfileirada, e sem linha)", async () => {
    const id = await carrossel({ arte: { ...ARTE, publicacao: publicacao("pub:sumiu") } });
    expect(await apagar.apagarCarrossel(id)).toEqual({ ok: false, motivo: "desconhecido" });
    expect(await existe(id)).toBe(true);
  });

  it("a geração do texto em andamento", async () => {
    const id = await carrossel({ estado: "gerando" });
    expect(await apagar.apagarCarrossel(id)).toEqual({ ok: false, motivo: "geracao" });
    expect(await existe(id)).toBe(true);
  });

  it("uma imagem do carrossel sendo gerada (achado 95)", async () => {
    const id = await carrossel({ arte: COM_ARQUIVOS });
    await imagemGerada(id, "gerando");
    noBucket(FOTO, PRONTO);
    expect(await apagar.apagarCarrossel(id)).toEqual({ ok: false, motivo: "imagem" });
    expect(await existe(id)).toBe(true);
    expect(bucket.chamadas).toEqual([]);
  });

  it("o carrossel que não existe, e o id que não é de carrossel", async () => {
    expect(await apagar.apagarCarrossel(u(7))).toEqual({ ok: false, motivo: "nao_existe" });
    expect(await apagar.apagarCarrossel("nao-e-uuid")).toEqual({ ok: false, motivo: "nao_existe" });
  });
});

describe("o bucket, depois do commit", () => {
  it("quem apaga os arquivos já não acha a linha", async () => {
    const id = await carrossel({ arte: COM_ARQUIVOS });
    const vistos: { caminhos: string[]; linhaAinda: boolean }[] = [];
    const r = await apagar.apagarCarrossel(id, async (caminhos) => {
      vistos.push({ caminhos, linhaAinda: await existe(id) });
    });
    expect(r).toEqual({ ok: true });
    expect(vistos).toEqual([{ caminhos: [FOTO, PRONTO], linhaAinda: false }]);
  });

  it("a recusa não chama quem apaga os arquivos", async () => {
    const id = await carrossel({ estado: "gerando" });
    const vistos: string[][] = [];
    await apagar.apagarCarrossel(id, async (caminhos) => void vistos.push(caminhos));
    expect(vistos).toEqual([]);
  });

  it("a falha do bucket não desfaz o banco: o carrossel já está apagado, e o arquivo fica sem dono", async () => {
    bucket.falhar = true;
    const id = await carrossel({ arte: COM_ARQUIVOS });
    noBucket(FOTO, PRONTO);
    expect(await apagar.apagarCarrossel(id)).toEqual({ ok: true });
    expect(await existe(id)).toBe(false);
    expect([...bucket.objetos.keys()].sort()).toEqual([FOTO, PRONTO].sort());
  });
});

describe("o apagar e o agendar ao mesmo tempo: um espera o outro", () => {
  // O AGENDAR TRAVA A LINHA (`for update`) e grava a reserva antes da fila (reservarPublicacao). Aqui o
  // cruzamento é forçado: a transação do teste é o agendar no meio do caminho. O apagar que trava a linha
  // espera, vê a reserva e recusa; o que lesse sem travar veria a linha sem reserva, e o `delete` dele
  // esperaria só para apagar o carrossel que acabou de ser agendado.
  it("o agendar passa antes: o apagar espera a linha, vê a reserva e recusa", async () => {
    const id = await carrossel();
    const r = await segurando(
      async (tx) => {
        await tx.query(`select id from carrosseis_gerados where id = $1 for update`, [id]);
        await tx.query(
          `update carrosseis_gerados set arte = arte || jsonb_build_object('publicacao',
             $2::jsonb || jsonb_build_object('reservada_em', now())) where id = $1`,
          [id, { chave: "pub:no-meio", caminhos: [FILA] }]
        );
      },
      () => apagar.apagarCarrossel(id)
    );
    expect(r).toEqual({ ok: false, motivo: "agendado" });
    expect(await existe(id)).toBe(true);
  });

  it("o apagar passa antes: o agendar espera a linha e não acha o carrossel", async () => {
    const id = await carrossel();
    const r = await segurando(
      async (tx) => {
        await tx.query(`select id from carrosseis_gerados where id = $1 for update`, [id]);
        await tx.query(`delete from carrosseis_gerados where id = $1`, [id]);
      },
      () => publicar.reservarPublicacao(id, { texto: JSON.stringify(TEXTO), soTexto: [], imagens: {} }, "pub:tarde", [FILA])
    );
    expect(r).toEqual({ ok: false, recusa: { motivo: "nao_pronto" } });
  });
});

describe("o apagar e a reserva de uma imagem ao mesmo tempo (achado 96)", () => {
  // A RESERVA DA IMAGEM TRAVA A LINHA DO CARROSSEL EM `key share`, pela chave estrangeira da 018, e o
  // `for update` do apagar espera por ela (e vice-versa).
  it("a reserva passa antes: o apagar espera, vê a imagem gerando e recusa", async () => {
    const id = await carrossel();
    const r = await segurando(
      async (tx) => {
        await tx.query(`insert into imagens_geradas (carrossel_id, numero, descricao) values ($1, 2, 'uma cena')`, [id]);
      },
      () => apagar.apagarCarrossel(id)
    );
    expect(r).toEqual({ ok: false, motivo: "imagem" });
    expect(await existe(id)).toBe(true);
  });

  it("o apagar passa antes: a reserva bate na chave estrangeira e devolve a recusa, sem linha nova", async () => {
    const id = await carrossel();
    const r = await segurando(
      async (tx) => {
        await tx.query(`select id from carrosseis_gerados where id = $1 for update`, [id]);
        await tx.query(`delete from carrosseis_gerados where id = $1`, [id]);
      },
      () => imagemRepo.reservarImagem({ carrosselId: id, numero: 2, descricao: CENA })
    );
    expect(r).toEqual({ ok: false, motivo: "nao_pronto" });
    expect(await sql().query(`select 1 from imagens_geradas`)).toEqual([]);
  });

  it("pelo pedido de imagem inteiro: a recusa de carrossel que não existe mais, com a frase dela, e não um erro", async () => {
    const id = await carrossel();
    const r = await segurando(
      async (tx) => {
        await tx.query(`select id from carrosseis_gerados where id = $1 for update`, [id]);
        await tx.query(`delete from carrosseis_gerados where id = $1`, [id]);
      },
      () => imagem.pedirImagem({ id, numero: 2, descricao: CENA, contas, ambiente: AMBIENTE })
    );
    expect(r).toEqual({ ok: false, recusa: { motivo: "nao_pronto" } });
    expect(await sql().query(`select 1 from imagens_geradas`)).toEqual([]);
  });

  it("outro erro do insert não vira recusa: sobe (só o 23503 da chave do carrossel é pego)", async () => {
    const id = await carrossel();
    await expect(imagemRepo.reservarImagem({ carrosselId: id, numero: 11, descricao: CENA })).rejects.toMatchObject({
      code: "23514",
      constraint_name: "imagens_geradas_numero_check",
    });
  });
});

describe("a leitura da página", () => {
  it("lê o mesmo que o servidor: a fila agendada e a imagem gerando travam; o rascunho parado pode", async () => {
    const livre = await carrossel();
    const agendado = await carrossel({ arte: { ...ARTE, publicacao: publicacao("pub:k") } });
    await fila("pub:k", "pending");
    const comImagem = await carrossel();
    await imagemGerada(comImagem, "gerando");
    const ler = async (id: string) => apagar.podeApagarAgora((await carrosselRepo.lerCarrossel(id))!, "pronto");
    expect(await ler(livre)).toEqual({ ok: true });
    expect(await ler(agendado)).toEqual({ ok: false, motivo: "agendado" });
    expect(await ler(comImagem)).toEqual({ ok: false, motivo: "imagem" });
  });
});
