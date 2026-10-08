// O CARROSSEL AVULSO CONTRA O BANCO DE VERDADE (o container), spec da Etapa 7: ele nasce sem bônus do
// Chat, pela IA (pendente, dentro do teto e da trava) ou escrito à mão (pronto, fora dos dois). A IA é
// sempre um gerador falso: nada sai para a Anthropic.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { ContaGuardada } from "@/lib/bonus/arte-conta";
import type { TextoDeCarrossel } from "@/lib/bonus/carrossel-texto";
import { bancoDescartavel } from "./harness";

type ModuloRepo = typeof import("@/lib/bonus/carrossel-repositorio");
type ModuloProcesso = typeof import("@/lib/bonus/carrossel-processo");

const banco = bancoDescartavel();

const CODIGO = "conselheiro-brutalmente-honesto";
const DO_LABS = {
  tema: "Produtividade",
  titulo: "Conselheiro brutalmente honesto",
  descricao: "Um prompt que critica o seu plano sem dó.",
  oQueResolve: "Mostre o antes e o depois.",
};
const LIVRE = { tipo: "livre" as const, tema: "Produtividade", conteudo: "Um prompt que critica o seu plano sem dó nenhum." };
const THIAGO: ContaGuardada = { conta: "17841400000000001", nome: "Thiago Vannuchi", arroba: "thiagovannuchi" };
const MEDICAO = { modelo: "claude-opus-5-5", tokensEntrada: 1, tokensSaida: 1, cacheCriado: 0, cacheLido: 0 };
const TEXTO: TextoDeCarrossel = {
  tipo: "carrossel",
  titulo: "Conselheiro brutalmente honesto",
  gancho: "Seu plano tem um furo. Você só não quer ver.",
  slides: [
    { titulo: "O que ele faz", texto: "Ele lê o seu plano e aponta o que você está evitando olhar." },
    { titulo: "Como usar", texto: "Cole o plano, peça a crítica e responda às perguntas dele." },
    { titulo: "O que esperar", texto: "Um texto duro, mas com o que fazer em cada ponto fraco." },
  ],
  chamada: "Comente BRUTAL e receba o prompt agora.",
  legenda: "Quer ouvir a verdade sobre o seu plano? Comente BRUTAL que eu te mando o prompt do conselheiro.",
};

let repo: ModuloRepo;
let processo: ModuloProcesso;

beforeAll(async () => {
  repo = await import("@/lib/bonus/carrossel-repositorio");
  processo = await import("@/lib/bonus/carrossel-processo");
});

beforeEach(async () => {
  await banco.db().sql().query(`delete from carrosseis_gerados`);
  await banco.db().sql().query(`delete from bonus_gerados`);
});

type PedidoAvulso = Parameters<ModuloRepo["criarCarrosselAvulso"]>[0];
// A palavra e a ação são uma união (com palavra, ou sem palavra e com a ação, Etapa 8): a troca parcial
// não sabe disso, e o resultado é conferido pelo banco.
const doLabs = (troca: Partial<PedidoAvulso> = {}): PedidoAvulso =>
  ({
    origem: "labs",
    labsCodigo: CODIGO,
    total: 5,
    palavra: "BRUTAL",
    contexto: DO_LABS,
    conta: null,
    texto: null,
    ...troca,
  }) as PedidoAvulso;
const livre = (troca: Partial<PedidoAvulso> = {}): PedidoAvulso =>
  ({
    origem: "livre",
    labsCodigo: null,
    total: 5,
    palavra: "BRUTAL",
    contexto: LIVRE,
    conta: null,
    texto: null,
    ...troca,
  }) as PedidoAvulso;

async function criado(p: PedidoAvulso): Promise<string> {
  const r = await repo.criarCarrosselAvulso(p);
  if (!r.ok) throw new Error("teto no meio do teste: o beforeEach devia ter limpado a tabela");
  return r.id;
}

describe("criar o carrossel avulso", () => {
  it("do Labs, pela IA: nasce pendente, sem bônus, com o código, a palavra, o contexto e a conta", async () => {
    const l = await repo.lerCarrossel(await criado(doLabs({ conta: THIAGO })));
    expect(l).toMatchObject({
      origem: "labs",
      bonus_id: null,
      labs_codigo: CODIGO,
      estado: "pendente",
      texto_a_mao: false,
      palavra: "BRUTAL",
      total_slides: 5,
      contexto: DO_LABS,
      arte: THIAGO,
      gerado: null,
    });
  });

  it("do texto livre, pela IA: sem bônus e sem código, e sem conta a arte nasce vazia", async () => {
    const l = await repo.lerCarrossel(await criado(livre()));
    expect(l).toMatchObject({ origem: "livre", bonus_id: null, labs_codigo: null, estado: "pendente", contexto: LIVRE, arte: {} });
  });

  it("escrito à mão: nasce pronto, com o texto e a hora, sem medição de IA, e marcado à mão", async () => {
    const l = await repo.lerCarrossel(await criado(livre({ texto: TEXTO, conta: THIAGO })));
    expect(l).toMatchObject({ origem: "livre", estado: "pronto", gerado: TEXTO, medicao: null, texto_a_mao: true, arte: THIAGO });
    expect(l?.gerado_em).toBeInstanceOf(Date);
  });

  it("a IA recebe o contexto do texto livre que a linha guardou", async () => {
    const id = await criado(livre());
    let recebido: unknown = null;
    await processo.processarCarrossel(id, async (p) => {
      recebido = p;
      return { ok: true as const, texto: { ...TEXTO, slides: TEXTO.slides }, medicao: MEDICAO };
    });
    expect(recebido).toEqual({ total: 5, palavra: "BRUTAL", contexto: LIVRE });
    expect((await repo.lerCarrossel(id))?.estado).toBe("pronto");
  });
});

// O TETO CONTA SÓ O QUE PEDIU A IA (spec da Etapa 7, "O teto"): as duas contagens, a da tela e a do
// pedido, dentro da trava. O escrito à mão não gasta IA, e não passa pela trava.
describe("o teto e o escrito à mão", () => {
  it("com 10 da IA no dia, o avulso pela IA é recusado, e o escrito à mão entra", async () => {
    for (let i = 0; i < 10; i++) await criado(doLabs());
    expect((await repo.criarCarrosselAvulso(livre())).ok).toBe(false);
    expect((await repo.criarCarrosselAvulso(livre({ texto: TEXTO }))).ok).toBe(true);
    expect(await repo.carrosseisNasUltimas24h()).toBe(10);
  });

  it("o pedido de carrossel de bônus também não conta o escrito à mão", async () => {
    for (let i = 0; i < 10; i++) await criado(livre({ texto: TEXTO }));
    expect(await repo.carrosseisNasUltimas24h()).toBe(0);
    const [b] = (await banco
      .db()
      .sql()
      .query(`insert into bonus_gerados (tema, o_que_resolve) values ('Vendas', 'um pedido de teste com mais de vinte letras') returning id`)) as {
      id: string;
    }[];
    const r = await repo.criarPedidoDeCarrossel({ bonusId: b.id, total: 5, palavra: "SUMIDO", contexto: DO_LABS, conta: null });
    expect(r.ok).toBe(true);
    expect(await repo.carrosseisNasUltimas24h()).toBe(1);
  });

  // O MOLDE DO TESTE DO TETO DA ETAPA 2 (bonus-carrossel-processo.integracao.ts): uma transação do teste
  // segura a trava. O avulso pela IA espera por ela; o escrito à mão não a pede, e termina antes.
  async function comATravaPresa<T>(linhasNaTrava: number, enquanto: () => Promise<T>): Promise<{ venceu: unknown; resultado: Promise<T> }> {
    let soltar!: () => void;
    const segurando = new Promise<void>((f) => (soltar = f));
    let travou!: () => void;
    const travado = new Promise<void>((f) => (travou = f));
    const transacao = banco
      .db()
      .sql()
      .begin(async (tx) => {
        await tx.query(`select pg_advisory_xact_lock($1::bigint)`, [repo.TRAVA_DO_TETO_DO_CARROSSEL]);
        for (let i = 0; i < linhasNaTrava; i++) {
          await tx.query(`insert into carrosseis_gerados (origem, total_slides, palavra, contexto) values ('livre', 5, 'BRUTAL', '{}'::jsonb)`);
        }
        travou();
        await segurando;
      });
    await travado;
    let resultado!: Promise<T>;
    let venceu: unknown;
    try {
      resultado = enquanto();
      venceu = await Promise.race([resultado.then(() => "pedido"), new Promise((f) => setTimeout(() => f("relogio"), 300))]);
    } finally {
      // Solta a trava antes de qualquer `expect` (a lição do teste do teto da Etapa 2).
      soltar();
      await transacao;
    }
    return { venceu, resultado };
  }

  it("o avulso pela IA espera a trava do teto: contar e inserir não correm em paralelo", async () => {
    const { venceu, resultado } = await comATravaPresa(10, () => repo.criarCarrosselAvulso(livre()));
    expect(venceu).toBe("relogio");
    expect((await resultado).ok).toBe(false);
  });

  it("o escrito à mão não pede a trava do teto", async () => {
    const { venceu, resultado } = await comATravaPresa(0, () => repo.criarCarrosselAvulso(livre({ texto: TEXTO })));
    expect(venceu).toBe("pedido");
    expect((await resultado).ok).toBe(true);
  });
});

describe("a lista de todos os carrosséis", () => {
  it("traz os de bônus e os avulsos, do mais novo para o mais velho", async () => {
    const [b] = (await banco
      .db()
      .sql()
      .query(`insert into bonus_gerados (tema, o_que_resolve) values ('Vendas', 'um pedido de teste com mais de vinte letras') returning id`)) as {
      id: string;
    }[];
    const r = await repo.criarPedidoDeCarrossel({ bonusId: b.id, total: 5, palavra: "SUMIDO", contexto: DO_LABS, conta: null });
    if (!r.ok) throw new Error("teto no meio do teste");
    const doLabsId = await criado(doLabs());
    const livreId = await criado(livre({ texto: TEXTO }));
    await banco.db().sql().query(`update carrosseis_gerados set criado_em = now() - interval '1 minute' where id = $1`, [r.id]);
    await banco.db().sql().query(`update carrosseis_gerados set criado_em = now() - interval '30 seconds' where id = $1`, [doLabsId]);
    const lista = await repo.listarCarrosseis();
    expect(lista.map((l) => [l.id, l.origem])).toEqual([
      [livreId, "livre"],
      [doLabsId, "labs"],
      [r.id, "bonus"],
    ]);
  });
});

// O CARROSSEL SEM PALAVRA-CHAVE (spec da Etapa 8): a palavra nula e a ação gravadas, a IA recebendo a
// ação, a conferência sem palavra gritada na chamada, e o salvar de cada slide pela mesma regra.
describe("o carrossel sem palavra-chave", () => {
  const SEM: TextoDeCarrossel = {
    ...TEXTO,
    chamada: "Salve este post para reler antes de mostrar o plano a alguém.",
    legenda: "Antes de mostrar o seu plano a alguém, leia de novo estes pontos e salve para não esquecer.",
  };

  it("do texto livre e do Labs, pela IA: a palavra nula e a ação gravadas", async () => {
    expect(await repo.lerCarrossel(await criado(livre({ palavra: null, acao: "salvar" })))).toMatchObject({
      origem: "livre",
      palavra: null,
      acao_da_chamada: "salvar",
      estado: "pendente",
    });
    expect(await repo.lerCarrossel(await criado(doLabs({ palavra: null, acao: "comentar" })))).toMatchObject({
      origem: "labs",
      labs_codigo: CODIGO,
      palavra: null,
      acao_da_chamada: "comentar",
    });
  });

  it("com a palavra, a ação fica nula, como hoje", async () => {
    expect(await repo.lerCarrossel(await criado(livre()))).toMatchObject({ palavra: "BRUTAL", acao_da_chamada: null });
  });

  it("escrito à mão: nasce pronto, sem palavra e com a ação", async () => {
    expect(await repo.lerCarrossel(await criado(livre({ palavra: null, acao: "seguir", texto: SEM })))).toMatchObject({
      estado: "pronto",
      texto_a_mao: true,
      palavra: null,
      acao_da_chamada: "seguir",
      gerado: SEM,
    });
  });

  it("a IA recebe a ação, e a chamada sem palavra gritada fica pronta", async () => {
    const id = await criado(livre({ palavra: null, acao: "seguir" }));
    let recebido: unknown = null;
    await processo.processarCarrossel(id, async (p) => {
      recebido = p;
      return { ok: true as const, texto: SEM, medicao: MEDICAO };
    });
    expect(recebido).toEqual({ total: 5, palavra: null, acao: "seguir", contexto: LIVRE });
    expect(await repo.lerCarrossel(id)).toMatchObject({ estado: "pronto", gerado: SEM });
  });

  it("a chamada com palavra gritada falha, com a frase", async () => {
    const id = await criado(livre({ palavra: null, acao: "salvar" }));
    await processo.processarCarrossel(id, async () => ({ ok: true as const, texto: TEXTO, medicao: MEDICAO }));
    expect(await repo.lerCarrossel(id)).toMatchObject({
      estado: "falhou",
      erro: "A chamada tem BRUTAL em maiúsculas, e este carrossel não tem palavra-chave. Gere de novo.",
    });
  });

  it("salvar a chamada (o último slide) segue a regra sem palavra", async () => {
    const id = await criado(livre({ palavra: null, acao: "salvar", texto: SEM }));
    const ultimo = { tipo: "slide" as const, numero: 5 };
    expect(await repo.salvarParteDoCarrossel(id, ultimo, { chamada: "Comente GUIA e receba o roteiro." }, null)).toEqual({
      ok: false,
      motivo: "problemas",
      problemas: [{ campo: "chamada", erro: "não pode ter palavra em maiúsculas (GUIA): este carrossel não tem palavra-chave" }],
    });
    const nova = "Compartilhe com quem precisa ouvir isso hoje.";
    const r = await repo.salvarParteDoCarrossel(id, ultimo, { chamada: nova }, null);
    expect(r.ok && r.texto.chamada).toBe(nova);
  });
});
