// O TETO E AS LINHAS DO CRIADOR DE IMAGEM CONTRA O BANCO DE VERDADE (o container), spec da Etapa 6, "O
// teto e a migração 018".
//
// As proteções desta fase são uma trava de transação e `update`s condicionais, que nem o tsc nem a
// suíte pura enxergam: apagar qualquer uma passa por todos. Só um caminho que fale com o Postgres acusa.
// Nada aqui chama a OpenAI.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bancoDescartavel } from "./harness";

type ModuloRepo = typeof import("@/lib/bonus/imagem-repositorio");

const banco = bancoDescartavel();

let repo: ModuloRepo;
let carrosselId: string;

beforeAll(async () => {
  repo = await import("@/lib/bonus/imagem-repositorio");
});

beforeEach(async () => {
  await banco.db().sql().query(`delete from imagens_geradas`);
  await banco.db().sql().query(`delete from carrosseis_gerados`);
  const [c] = (await banco
    .db()
    .sql()
    .query(
      `insert into carrosseis_gerados (origem, total_slides, palavra, acao_da_chamada, contexto)
       values ('livre', 3, null, 'salvar', '{}'::jsonb) returning id`
    )) as { id: string }[];
  carrosselId = c.id;
});

const pedido = (numero = 1) => ({ carrosselId, numero, descricao: "/marketing uma pessoa usando o celular numa loja" });

/** Linhas gravadas direto, de qualquer estado, para encher o teto. */
async function linhasNoDia(n: number, estado: "gerando" | "pronta" | "falhou" = "falhou") {
  for (let i = 0; i < n; i++) {
    await banco
      .db()
      .sql()
      .query(
        `insert into imagens_geradas (carrossel_id, numero, descricao, estado, motivo, caminho, terminado_em)
         values ($1, 2, 'uma cena antiga', $2, $3, $4, case when $2 = 'gerando' then null else now() end)`,
        [carrosselId, estado, estado === "falhou" ? "falhou no teste" : null, estado === "pronta" ? "p/bonus-foto/x.jpg" : null]
      );
  }
}

async function contar(): Promise<number> {
  const [{ n }] = (await banco.db().sql().query(`select count(*)::int as n from imagens_geradas`)) as { n: number }[];
  return n;
}

describe("a reserva de uma imagem", () => {
  it("nasce gerando, com a descrição, e a conta do dia sobe", async () => {
    const r = await repo.reservarImagem(pedido());
    expect(r).toMatchObject({ ok: true, hoje: 1 });
    const [l] = (await banco.db().sql().query(`select numero, descricao, estado from imagens_geradas`)) as Record<string, unknown>[];
    expect(l).toEqual({ numero: 1, descricao: pedido().descricao, estado: "gerando" });
    expect(await repo.imagensNasUltimas24h()).toBe(1);
  });
});

describe("o teto de imagens", () => {
  it("com 10 em 24 h, de qualquer estado, o décimo primeiro é recusado, sem linha nova", async () => {
    await linhasNoDia(4, "falhou");
    await linhasNoDia(5, "pronta");
    await linhasNoDia(1, "falhou");
    expect(await repo.reservarImagem(pedido())).toEqual({ ok: false, motivo: "teto", hoje: 10 });
    expect(await contar()).toBe(10);
  });

  it("a linha do carrossel apagado continua contando", async () => {
    await linhasNoDia(10, "pronta");
    await banco.db().sql().query(`delete from carrosseis_gerados`);
    expect(await repo.imagensNasUltimas24h()).toBe(10);
  });

  it("pedido de mais de 24 h, pelo relógio do banco, não conta", async () => {
    await linhasNoDia(10, "pronta");
    await banco.db().sql().query(`update imagens_geradas set criado_em = now() - interval '25 hours'`);
    expect(await repo.imagensNasUltimas24h()).toBe(0);
    expect((await repo.reservarImagem(pedido())).ok).toBe(true);
  });

  // A trava é segurada por uma transação do próprio teste, com DEZ linhas invisíveis até o commit: quem
  // conta depois de pegar a trava vê 10 e recusa; quem conta antes vê 0 e insere. Assim o caso pega a trava
  // ausente e a trava no lugar errado (o molde do teto do carrossel).
  it("a reserva espera a trava do teto: contar e inserir não correm em paralelo", async () => {
    let soltar!: () => void;
    const segurando = new Promise<void>((f) => (soltar = f));
    let travou!: () => void;
    const travado = new Promise<void>((f) => (travou = f));
    const transacao = banco
      .db()
      .sql()
      .begin(async (tx) => {
        await tx.query(`select pg_advisory_xact_lock($1::bigint)`, [repo.TRAVA_DO_TETO_DA_IMAGEM]);
        for (let i = 0; i < 10; i++) {
          await tx.query(`insert into imagens_geradas (carrossel_id, numero, descricao) values ($1, 3, 'uma cena')`, [carrosselId]);
        }
        travou();
        await segurando;
      });
    await travado;

    const tentativa = repo.reservarImagem(pedido());
    let venceu: unknown;
    try {
      venceu = await Promise.race([tentativa.then(() => "pedido"), new Promise((f) => setTimeout(() => f("relogio"), 300))]);
    } finally {
      // Solta a trava antes de qualquer `expect`: com o caso caindo e a trava presa, o `delete` dos
      // casos seguintes esperaria por ela (medido no ensaio da Etapa 2).
      soltar();
      await transacao;
    }
    expect(venceu).toBe("relogio");
    expect(await tentativa).toMatchObject({ ok: false, motivo: "teto" });
  });

  it("a trava da imagem não é a do carrossel nem a do bônus", async () => {
    const carrossel = await import("@/lib/bonus/carrossel-repositorio");
    const bonus = await import("@/lib/bonus/repositorio");
    expect(repo.TRAVA_DO_TETO_DA_IMAGEM).not.toBe(carrossel.TRAVA_DO_TETO_DO_CARROSSEL);
    expect(repo.TRAVA_DO_TETO_DA_IMAGEM).not.toBe(bonus.TRAVA_DO_TETO);
  });
});

describe("um slide gera uma imagem de cada vez", () => {
  it("o segundo pedido do mesmo slide é recusado; outro slide passa", async () => {
    expect((await repo.reservarImagem(pedido(1))).ok).toBe(true);
    expect(await repo.reservarImagem(pedido(1))).toEqual({ ok: false, motivo: "gerando", hoje: 1 });
    expect((await repo.reservarImagem(pedido(2))).ok).toBe(true);
  });

  it("a linha travada pelo prazo não segura o slide", async () => {
    expect((await repo.reservarImagem(pedido(1))).ok).toBe(true);
    await banco.db().sql().query(`update imagens_geradas set criado_em = now() - interval '4 minutes'`);
    expect((await repo.reservarImagem(pedido(1))).ok).toBe(true);
  });

  it("depois de pronta ou de falhar, o slide pede de novo", async () => {
    const r = await repo.reservarImagem(pedido(1));
    if (!r.ok) throw new Error("a reserva devia passar");
    expect(await repo.marcarFalhou(r.id, "falhou no teste")).toBe(true);
    expect((await repo.reservarImagem(pedido(1))).ok).toBe(true);
  });
});

describe("o fim de uma geração", () => {
  it("pronta e falhou só saem de gerando, e uma vez", async () => {
    const a = await repo.reservarImagem(pedido(1));
    const b = await repo.reservarImagem(pedido(2));
    if (!a.ok || !b.ok) throw new Error("as reservas deviam passar");
    expect(await repo.marcarPronta(a.id, "p/bonus-foto/a.jpg")).toBe(true);
    expect(await repo.marcarPronta(a.id, "p/bonus-foto/outra.jpg")).toBe(false);
    expect(await repo.marcarFalhou(a.id, "tarde demais")).toBe(false);
    expect(await repo.marcarFalhou(b.id, "a OpenAI recusou")).toBe(true);
    const linhas = (await banco
      .db()
      .sql()
      .query(`select numero, estado, caminho, motivo, terminado_em is not null as fim from imagens_geradas order by numero`)) as Record<
      string,
      unknown
    >[];
    expect(linhas).toEqual([
      { numero: 1, estado: "pronta", caminho: "p/bonus-foto/a.jpg", motivo: null, fim: true },
      { numero: 2, estado: "falhou", caminho: null, motivo: "a OpenAI recusou", fim: true },
    ]);
  });
});

describe("a leitura para a página e para a consulta", () => {
  it("a última linha de cada slide do carrossel, com a hora do banco", async () => {
    const velha = await repo.reservarImagem({ ...pedido(1), descricao: "a primeira descrição" });
    if (!velha.ok) throw new Error("a reserva devia passar");
    await repo.marcarFalhou(velha.id, "falhou no teste");
    await banco.db().sql().query(`update imagens_geradas set criado_em = now() - interval '1 minute'`);
    await repo.reservarImagem({ ...pedido(1), descricao: "a segunda descrição" });
    await repo.reservarImagem({ ...pedido(3), descricao: "a do slide três" });

    const lidas = await repo.ultimasDoCarrossel(carrosselId);
    expect(lidas.agora).toBeInstanceOf(Date);
    expect(Object.keys(lidas.linhas).map(Number)).toEqual([1, 3]);
    expect(lidas.linhas[1]).toMatchObject({ numero: 1, descricao: "a segunda descrição", estado: "gerando" });
    expect(lidas.linhas[3]).toMatchObject({ numero: 3, descricao: "a do slide três" });
  });

  it("o carrossel sem pedido não tem linha", async () => {
    expect((await repo.ultimasDoCarrossel(carrosselId)).linhas).toEqual({});
  });
});
