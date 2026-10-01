// O CARROSSEL CONTRA O BANCO DE VERDADE (o container).
//
// As proteções desta fase são uma trava de transação e `update`s condicionais, e nenhuma delas é
// visível para tsc, lint ou a suíte pura: apagar qualquer uma passa por todos. Só um caminho que
// fale com o Postgres acusa. A IA é sempre um gerador falso: nada sai para a Anthropic.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { TextoDeCarrossel } from "@/lib/bonus/carrossel-texto";
import { bancoDescartavel } from "./harness";

type ModuloRepo = typeof import("@/lib/bonus/carrossel-repositorio");
type ModuloProcesso = typeof import("@/lib/bonus/carrossel-processo");

const banco = bancoDescartavel();

const CONTEXTO = {
  tema: "Vendas",
  titulo: "Mensagens para Reativar Clientes Sumidos no WhatsApp",
  descricao: "Mensagens prontas para trazer de volta quem sumiu.",
  oQueResolve: "Reativar clientes que pararam de comprar pelo WhatsApp.",
};
const MEDICAO = { modelo: "claude-opus-5-5", tokensEntrada: 1, tokensSaida: 1, cacheCriado: 0, cacheLido: 0 };
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

let repo: ModuloRepo;
let processo: ModuloProcesso;
let bonusId: string;

beforeAll(async () => {
  repo = await import("@/lib/bonus/carrossel-repositorio");
  processo = await import("@/lib/bonus/carrossel-processo");
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

const pedido = (total: number) => ({ bonusId, total, palavra: "SUMIDO", contexto: CONTEXTO });

async function criado(total: number): Promise<string> {
  const r = await repo.criarPedidoDeCarrossel(pedido(total));
  if (!r.ok) throw new Error("teto no meio do teste: o beforeEach devia ter limpado a tabela");
  return r.id;
}

const devolve = (texto: TextoDeCarrossel) => async () => ({ ok: true as const, texto, medicao: MEDICAO });

describe("o teto de carrosséis", () => {
  // A trava é segurada por uma transação do próprio teste, com DEZ linhas invisíveis até o
  // commit: quem conta depois de pegar a trava vê 10 e recusa; quem conta antes vê 0 e insere.
  // Assim o caso pega a trava ausente e a trava no lugar errado (o reforço do auditor na 1.7).
  it("o pedido espera a trava do teto: contar e inserir não correm em paralelo", async () => {
    let soltar!: () => void;
    const segurando = new Promise<void>((f) => (soltar = f));
    let travou!: () => void;
    const travado = new Promise<void>((f) => (travou = f));
    const transacao = banco
      .db()
      .sql()
      .begin(async (tx) => {
        await tx.query(`select pg_advisory_xact_lock($1::bigint)`, [repo.TRAVA_DO_TETO_DO_CARROSSEL]);
        for (let i = 0; i < 10; i++) {
          await tx.query(
            `insert into carrosseis_gerados (bonus_id, total_slides, palavra, contexto) values ($1, 5, 'SUMIDO', '{}'::jsonb)`,
            [bonusId]
          );
        }
        travou();
        await segurando;
      });
    await travado;

    const tentativa = repo.criarPedidoDeCarrossel(pedido(5));
    let venceu: unknown;
    try {
      venceu = await Promise.race([
        tentativa.then(() => "pedido"),
        new Promise((f) => setTimeout(() => f("relogio"), 300)),
      ]);
    } finally {
      // SOLTA A TRAVA ANTES DE QUALQUER `expect`. Medido no ensaio do plano, em 30/09: com o
      // caso caindo e a trava presa, a transação ficava aberta, e o `delete` de cada caso
      // seguinte esperava por ela até o limite de 120 s, um depois do outro. A rodada ficou
      // parada mais de 11 minutos, até ser interrompida.
      soltar();
      await transacao;
    }
    expect(venceu).toBe("relogio");
    expect((await tentativa).ok).toBe(false);
  });

  it("com 10 no dia, o décimo primeiro é recusado", async () => {
    for (let i = 0; i < 10; i++) await criado(5);
    expect((await repo.criarPedidoDeCarrossel(pedido(5))).ok).toBe(false);
    expect(await repo.carrosseisNasUltimas24h()).toBe(10);
  });

  it("pedido de mais de 24 h, pelo relógio do banco, não conta", async () => {
    const id = await criado(5);
    await banco
      .db()
      .sql()
      .query(`update carrosseis_gerados set criado_em = now() - interval '25 hours' where id = $1`, [id]);
    expect(await repo.carrosseisNasUltimas24h()).toBe(0);
  });

  it("a trava do carrossel não é a do bônus", async () => {
    const bonus = await import("@/lib/bonus/repositorio");
    expect(repo.TRAVA_DO_TETO_DO_CARROSSEL).not.toBe(bonus.TRAVA_DO_TETO);
  });
});

describe("processarCarrossel", () => {
  it("pronto: o gerador recebe o que a linha guardou, e o texto vai como objeto", async () => {
    const id = await criado(5);
    let recebido: unknown = null;
    await processo.processarCarrossel(id, async (p) => {
      recebido = p;
      return { ok: true as const, texto: TEXTO, medicao: MEDICAO };
    });
    expect(recebido).toEqual({ total: 5, palavra: "SUMIDO", contexto: CONTEXTO });
    const l = await repo.lerCarrossel(id);
    expect([l?.estado, l?.gerado, l?.medicao, l?.erro]).toEqual(["pronto", TEXTO, MEDICAO, null]);
  });

  it("a conferência barra o número errado de slides, com a frase", async () => {
    const id = await criado(6);
    await processo.processarCarrossel(id, devolve(TEXTO));
    const l = await repo.lerCarrossel(id);
    expect(l?.estado).toBe("falhou");
    expect(l?.erro).toContain("Vieram 3 slides de conteúdo, e o pedido era 4");
  });

  it("a conferência barra a chamada que pede outra palavra", async () => {
    const id = await criado(5);
    await processo.processarCarrossel(id, devolve({ ...TEXTO, chamada: "Comente SUMIDO ou GUIA e receba as mensagens." }));
    const l = await repo.lerCarrossel(id);
    expect([l?.estado, l?.erro]).toEqual(["falhou", "A chamada pede também GUIA, além de SUMIDO. Gere de novo."]);
  });

  it("a falha da IA fica escrita na linha", async () => {
    const id = await criado(5);
    await processo.processarCarrossel(id, async () => ({ ok: false as const, erro: "A API recusou.", medicao: null }));
    const l = await repo.lerCarrossel(id);
    expect([l?.estado, l?.erro]).toEqual(["falhou", "A API recusou."]);
  });

  it("dois disparos da mesma linha chamam a IA uma vez só", async () => {
    const id = await criado(5);
    let chamadas = 0;
    const lento = async () => {
      chamadas++;
      await new Promise((f) => setTimeout(f, 200));
      return { ok: true as const, texto: TEXTO, medicao: MEDICAO };
    };
    await Promise.all([processo.processarCarrossel(id, lento), processo.processarCarrossel(id, lento)]);
    expect(chamadas).toBe(1);
  });

  it("uma exceção nossa também vira falha escrita, e não linha girando até travar", async () => {
    const id = await criado(5);
    await processo.processarCarrossel(id, async () => {
      throw new Error("defeito plantado");
    });
    const l = await repo.lerCarrossel(id);
    expect(l?.estado).toBe("falhou");
    expect(l?.erro).toContain("defeito plantado");
  });
});

describe("a revisão e a lista", () => {
  it("só salva carrossel pronto, e grava quando", async () => {
    const pronto = await criado(5);
    await processo.processarCarrossel(pronto, devolve(TEXTO));
    const revisado = { ...TEXTO, gancho: "Seu cliente sumiu? Traga ele de volta." };
    expect(await repo.salvarRevisaoDoCarrossel(pronto, revisado)).toBe(true);
    const l = await repo.lerCarrossel(pronto);
    expect(l?.revisado).toEqual(revisado);
    expect(l?.revisado_em).toBeInstanceOf(Date);

    const falho = await criado(6);
    await processo.processarCarrossel(falho, devolve(TEXTO));
    expect(await repo.salvarRevisaoDoCarrossel(falho, revisado)).toBe(false);
  });

  it("a lista do bônus vem do mais novo para o mais velho, e só dele", async () => {
    const velho = await criado(5);
    const novo = await criado(3);
    const lista = await repo.listarCarrosseisDoBonus(bonusId);
    expect(lista.map((l) => l.id)).toEqual([novo, velho]);
  });

  it("id que não é uuid não chega ao banco", async () => {
    expect(await repo.lerCarrossel("nao-e-uuid")).toBeNull();
  });
});
