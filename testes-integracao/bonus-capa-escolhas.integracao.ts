// LIGAR E DESLIGAR A CAPA, CONTRA O BANCO DE VERDADE (o container; spec da Etapa 11, "O jeito guardado").
//
// A capa se grava pela mesma escrita do "só texto" (`salvarSoTextoDaArte`), com a linha travada e a trava
// do publicar. As proteções são o `where` e a trava, invisíveis ao tsc e à suíte pura: só um caminho que
// fale com o Postgres acusa. A IA é sempre um gerador falso: nada sai para a Anthropic.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { ContaGuardada } from "@/lib/bonus/arte-conta";
import type { TextoDeCarrossel } from "@/lib/bonus/carrossel-texto";
import { bancoDescartavel } from "./harness";

type ModuloRepo = typeof import("@/lib/bonus/carrossel-repositorio");
type ModuloProcesso = typeof import("@/lib/bonus/carrossel-processo");
type ModuloEscolhas = typeof import("@/lib/bonus/arte-escolhas");

const banco = bancoDescartavel();

const THIAGO: ContaGuardada = { conta: "17841400000000001", nome: "Thiago Vannuchi", arroba: "thiagovannuchi" };
const FOTO = "17841400000000001/bonus-foto/0b2f4c1e-7a9d-4e3b-9c5f-1d2e3f4a5b6c.jpg";
const CONTEXTO = {
  tema: "Vendas",
  titulo: "Mensagens para Reativar Clientes Sumidos no WhatsApp",
  descricao: "Mensagens prontas para trazer de volta quem sumiu.",
  oQueResolve: "Reativar clientes que pararam de comprar pelo WhatsApp.",
};
const MEDICAO = { modelo: "claude-opus-5-5", tokensEntrada: 1, tokensSaida: 1, cacheCriado: 0, cacheLido: 0 };
const TEXTO: TextoDeCarrossel = {
  tipo: "carrossel",
  titulo: "Mensagens para reativar clientes",
  gancho: "Seu cliente sumiu? Não é culpa dele.",
  slides: [1, 2, 3].map((i) => ({ titulo: `Título do slide ${i}`, texto: `Texto do slide ${i}, com mais de trinta caracteres.` })),
  chamada: "Comente SUMIDO e receba as mensagens prontas.",
  legenda: "Quem sumiu ainda pode voltar. Comente SUMIDO que eu te mando as mensagens prontas para usar hoje mesmo.",
};

let repo: ModuloRepo;
let processo: ModuloProcesso;
let escolhas: ModuloEscolhas;
let bonusId: string;

beforeAll(async () => {
  repo = await import("@/lib/bonus/carrossel-repositorio");
  processo = await import("@/lib/bonus/carrossel-processo");
  escolhas = await import("@/lib/bonus/arte-escolhas");
});

beforeEach(async () => {
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

async function pronto(): Promise<string> {
  const r = await repo.criarPedidoDeCarrossel({ bonusId, total: 5, palavra: "SUMIDO", contexto: CONTEXTO, conta: THIAGO });
  if (!r.ok) throw new Error("teto no meio do teste");
  await processo.processarCarrossel(r.id, async () => ({ ok: true as const, texto: TEXTO, medicao: MEDICAO }));
  return r.id;
}

const arte = async (id: string) => (await repo.lerCarrossel(id))?.arte;
const definirArte = (id: string, valor: unknown) =>
  banco.db().sql().query(`update carrosseis_gerados set arte = $2::jsonb where id = $1`, [id, valor]);

describe("ligar e desligar a capa", () => {
  it("ligar grava capa: true junto do só texto, sem apagar a conta", async () => {
    const id = await pronto();
    expect(await repo.salvarSoTextoDaArte(id, [3], null, true)).toEqual({ ok: true });
    expect(await arte(id)).toEqual({ ...THIAGO, soTexto: [3], capa: true });
    expect(escolhas.escolhasDaArte(await arte(id), 5)).toMatchObject({ capa: true, soTexto: [3] });
  });

  it("desligar tira a chave: a arte volta a ser a de antes da capa", async () => {
    const id = await pronto();
    await repo.salvarSoTextoDaArte(id, [3], null, true);
    expect(await repo.salvarSoTextoDaArte(id, [3], null, false)).toEqual({ ok: true });
    expect(await arte(id)).toEqual({ ...THIAGO, soTexto: [3] });
  });

  it("a imagem guardada no slide 1 fica ao ligar a capa: ela só deixa de valer", async () => {
    const id = await pronto();
    const imagens = { "1": { caminho: FOTO, versao: "v1" } };
    await definirArte(id, { ...THIAGO, imagens });
    await repo.salvarSoTextoDaArte(id, [], null, true);
    expect(await arte(id)).toEqual({ ...THIAGO, imagens, soTexto: [], capa: true });
  });

  it("com o carrossel na fila de publicação, recusa e não grava a capa", async () => {
    const id = await pronto();
    const publicacao = { chave: "pub:capa-1", caminhos: ["17841400000000001/bonus-fila/0b2f4c1e-7a9d-4e3b-9c5f-1d2e3f4a5b6c.jpg"] };
    await banco
      .db()
      .sql()
      .query(`update carrosseis_gerados set arte = arte || jsonb_build_object('publicacao', $2::jsonb || jsonb_build_object('reservada_em', now())) where id = $1`, [
        id,
        publicacao,
      ]);
    const r = await repo.salvarSoTextoDaArte(id, [], null, true);
    expect(r).toMatchObject({ ok: false, motivo: "travado" });
    expect(await arte(id)).not.toHaveProperty("capa");
  });

  it("o carrossel que não está pronto recusa", async () => {
    const r = await repo.criarPedidoDeCarrossel({ bonusId, total: 5, palavra: "SUMIDO", contexto: CONTEXTO, conta: THIAGO });
    if (!r.ok) throw new Error("teto no meio do teste");
    expect(await repo.salvarSoTextoDaArte(r.id, [], null, true)).toEqual({ ok: false, motivo: "nao_pronto" });
    expect(await arte(r.id)).toEqual(THIAGO);
  });
});
