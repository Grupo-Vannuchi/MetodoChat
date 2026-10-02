// O CARROSSEL CONTRA O BANCO DE VERDADE (o container).
//
// As proteções desta fase são uma trava de transação e `update`s condicionais, e nenhuma delas é
// visível para tsc, lint ou a suíte pura: apagar qualquer uma passa por todos. Só um caminho que
// fale com o Postgres acusa. A IA é sempre um gerador falso: nada sai para a Anthropic.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { ContaGuardada } from "@/lib/bonus/arte-conta";
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

const pedido = (total: number, conta: ContaGuardada | null = null) => ({
  bonusId,
  total,
  palavra: "SUMIDO",
  contexto: CONTEXTO,
  conta,
});

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

// A revisão se grava por parte (salvarParteDoCarrossel, mais abaixo), desde a Etapa 4.
describe("a lista", () => {
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

// SALVAR UMA PARTE (spec da Etapa 4): um slide, ou a legenda, juntado ao texto salvo numa transação
// com a linha travada. A trava é o que impede dois salvamentos de slides diferentes de apagarem um
// ao outro, e só um caminho que fale com o Postgres a acusa.
describe("salvar uma parte do carrossel", () => {
  const GANCHO = "Seu cliente sumiu? Traga ele de volta.";
  const CHAMADA = "Comente SUMIDO e receba as mensagens agora.";
  async function pronto(): Promise<string> {
    const id = await criado(5);
    await processo.processarCarrossel(id, devolve(TEXTO));
    return id;
  }

  it("troca só a parte, junta ao texto salvo e grava quando", async () => {
    const id = await pronto();
    const r = await repo.salvarParteDoCarrossel(id, { tipo: "slide", numero: 1 }, { gancho: GANCHO }, null);
    expect(r).toEqual({ ok: true, texto: { ...TEXTO, gancho: GANCHO }, avisos: [] });
    const l = await repo.lerCarrossel(id);
    expect(l?.revisado).toEqual({ ...TEXTO, gancho: GANCHO });
    expect(l?.revisado_em).toBeInstanceOf(Date);

    // A segunda parte junta sobre a primeira, e não sobre o gerado.
    await repo.salvarParteDoCarrossel(id, { tipo: "slide", numero: 5 }, { chamada: CHAMADA }, null);
    expect((await repo.lerCarrossel(id))?.revisado).toEqual({ ...TEXTO, gancho: GANCHO, chamada: CHAMADA });
  });

  it("recusa pelo problema da parte, e não grava nada", async () => {
    const id = await pronto();
    expect(await repo.salvarParteDoCarrossel(id, { tipo: "slide", numero: 5 }, { chamada: "Comente PROMPT agora." }, null)).toEqual({
      ok: false,
      motivo: "problemas",
      problemas: [{ campo: "chamada", erro: "precisa pedir a palavra SUMIDO" }],
    });
    expect((await repo.lerCarrossel(id))?.revisado).toBeNull();
  });

  it("só carrossel pronto, e o que não existe também é recusado", async () => {
    const pendente = await criado(5);
    expect(await repo.salvarParteDoCarrossel(pendente, { tipo: "slide", numero: 1 }, { gancho: GANCHO }, null)).toEqual({
      ok: false,
      motivo: "nao_pronto",
    });
    expect(
      await repo.salvarParteDoCarrossel("0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f", { tipo: "slide", numero: 1 }, { gancho: GANCHO }, null)
    ).toEqual({ ok: false, motivo: "nao_pronto" });
  });

  it("completa o nome que falta da conta, na mesma gravação", async () => {
    const id = await pronto();
    await banco.db().sql().query(`update carrosseis_gerados set arte = '{"conta":"1001","soTexto":[2]}'::jsonb where id = $1`, [id]);
    await repo.salvarParteDoCarrossel(id, { tipo: "slide", numero: 1 }, { gancho: GANCHO }, { nome: "Thiago Vannuchi", arroba: "thiagovannuchi" });
    expect((await repo.lerCarrossel(id))?.arte).toEqual({ conta: "1001", nome: "Thiago Vannuchi", arroba: "thiagovannuchi", soTexto: [2] });
  });

  // A linha é travada por uma transação do próprio teste, e os dois salvamentos partem enquanto ela
  // está presa. Com a trava (`for update`), cada um lê o texto DEPOIS de pegar a linha, e o segundo
  // junta sobre o primeiro. Sem ela, os dois leem o texto velho antes da trava soltar, e o segundo
  // apaga o primeiro.
  it("dois salvamentos ao mesmo tempo, de slides diferentes, não apagam um ao outro", async () => {
    const id = await pronto();
    let soltar!: () => void;
    const segurando = new Promise<void>((f) => (soltar = f));
    let travou!: () => void;
    const travado = new Promise<void>((f) => (travou = f));
    const transacao = banco
      .db()
      .sql()
      .begin(async (tx) => {
        await tx.query(`select id from carrosseis_gerados where id = $1 for update`, [id]);
        travou();
        await segurando;
      });
    await travado;
    // As chamadas ficam DENTRO do `try` (achado 74): se uma delas lançar antes de devolver a
    // promessa (a função sumida, por exemplo), o `finally` solta a trava assim mesmo, e o caso cai
    // em segundos, e não depois de a limpeza esperar a transação presa até o fim do prazo.
    const salvamentos: Promise<unknown>[] = [];
    try {
      salvamentos.push(
        repo.salvarParteDoCarrossel(id, { tipo: "slide", numero: 1 }, { gancho: GANCHO }, null),
        repo.salvarParteDoCarrossel(id, { tipo: "slide", numero: 5 }, { chamada: CHAMADA }, null)
      );
      await new Promise((f) => setTimeout(f, 300));
    } finally {
      // Solta a trava antes de qualquer `expect` (a lição do teste do teto, logo acima).
      soltar();
      await transacao;
    }
    await Promise.all(salvamentos);
    expect((await repo.lerCarrossel(id))?.revisado).toEqual({ ...TEXTO, gancho: GANCHO, chamada: CHAMADA });
  });
});

// A ARTE (Etapas 3 e 4): a conta do carrossel, com o nome e o @, gravada no pedido; o "só texto"
// gravado só em carrossel pronto e SEM apagar a conta; o "Fixar nesta conta" uma vez só; e as contas
// lidas SÓ pelas colunas do cabeçalho: a tabela `accounts` guarda o token de acesso de cada conta, e
// ele nunca sai daqui (achado 60).
describe("a arte", () => {
  const THIAGO: ContaGuardada = { conta: "17841400000000001", nome: "Thiago Vannuchi", arroba: "thiagovannuchi" };
  const arte = async (id: string) => (await repo.lerCarrossel(id))?.arte;
  async function pronto(conta: ContaGuardada | null = null): Promise<string> {
    const r = await repo.criarPedidoDeCarrossel(pedido(5, conta));
    if (!r.ok) throw new Error("teto no meio do teste");
    await processo.processarCarrossel(r.id, devolve(TEXTO));
    return r.id;
  }

  it("o pedido grava a conta com o nome e o @; sem conta, a arte nasce vazia", async () => {
    const r = await repo.criarPedidoDeCarrossel(pedido(5, THIAGO));
    if (!r.ok) throw new Error("teto no meio do teste");
    expect(await arte(r.id)).toEqual(THIAGO);
    expect(await arte(await criado(3))).toEqual({});
  });

  it("gravar o só texto mantém a conta, e só vale em carrossel pronto", async () => {
    const id = await pronto(THIAGO);
    expect(await repo.salvarSoTextoDaArte(id, [2, 4], null)).toBe(true);
    expect(await arte(id)).toEqual({ ...THIAGO, soTexto: [2, 4] });
    expect(await repo.salvarSoTextoDaArte(id, [], null)).toBe(true);
    expect(await arte(id)).toEqual({ ...THIAGO, soTexto: [] });

    const pendente = await criado(5);
    expect(await repo.salvarSoTextoDaArte(pendente, [2], null)).toBe(false);
    expect(await arte(pendente)).toEqual({});
  });

  it("gravar o só texto completa o nome que falta da conta gravada na Etapa 3", async () => {
    const id = await pronto();
    await banco.db().sql().query(`update carrosseis_gerados set arte = '{"conta":"1001"}'::jsonb where id = $1`, [id]);
    expect(await repo.salvarSoTextoDaArte(id, [3], { nome: "Thiago Vannuchi", arroba: "thiagovannuchi" })).toBe(true);
    expect(await arte(id)).toEqual({ conta: "1001", nome: "Thiago Vannuchi", arroba: "thiagovannuchi", soTexto: [3] });
  });

  it("Fixar nesta conta grava uma vez, mantém o só texto, e recusa o carrossel que já tem conta", async () => {
    const id = await pronto();
    expect(await repo.salvarSoTextoDaArte(id, [2], null)).toBe(true);
    expect(await repo.fixarContaDoCarrossel(id, THIAGO)).toBe(true);
    expect(await arte(id)).toEqual({ ...THIAGO, soTexto: [2] });
    expect(await repo.fixarContaDoCarrossel(id, { conta: "1002", nome: "N8X", arroba: "n8x" })).toBe(false);
    expect(await arte(id)).toEqual({ ...THIAGO, soTexto: [2] });

    const pendente = await criado(5);
    expect(await repo.fixarContaDoCarrossel(pendente, THIAGO)).toBe(false);
    expect(await arte(pendente)).toEqual({});
  });

  it("as contas do cabeçalho vêm só com as quatro colunas, na ordem do painel, e nunca com o token", async () => {
    await banco.db().sql().query(`delete from accounts`);
    await banco
      .db()
      .sql()
      .query(
        `insert into accounts (ig_user_id, username, name, profile_picture_url, access_token, created_at) values
         ('1002', 'segunda', 'Segunda Conta', null, 'token-de-teste-2', now()),
         ('1001', 'primeira', 'Primeira Conta', 'https://scontent-gru2-1.cdninstagram.com/v/foto.jpg', 'token-de-teste-1', now() - interval '1 day')`
      );
    const contas = await repo.contasParaArte();
    expect(contas).toEqual([
      {
        ig_user_id: "1001",
        username: "primeira",
        name: "Primeira Conta",
        profile_picture_url: "https://scontent-gru2-1.cdninstagram.com/v/foto.jpg",
      },
      { ig_user_id: "1002", username: "segunda", name: "Segunda Conta", profile_picture_url: null },
    ]);
    expect(JSON.stringify(contas)).not.toContain("token-de-teste");
  });
});
