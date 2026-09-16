// AS OPORTUNIDADES SÃO DA CONTA, E SÓ DE POST SEM AUTOMAÇÃO ATIVA.
//
// A PROMESSA: **um post com automação ativa não vira oportunidade, e comentário
// da conta vizinha não entra na conta de ninguém.**
//
// POR QUE DE INTEGRAÇÃO: a pergunta é sobre o `left join` e o `account_id` da
// consulta. `recorteDasOportunidades` já tem os casos dela em
// `tests/precisa-de-voce.test.ts` e continua verde com o join errado — ela corta
// certo a lista errada. O que só se mede pelo EFEITO é QUAIS posts chegam nela.
import { beforeAll, describe, expect, test } from "vitest";
import { bancoDescartavel } from "./harness";
import { comoNumaRequisicao } from "./semear-requisicao";

const banco = bancoDescartavel();

const CONTA = "17800000000000901";
const VIZINHA = "17800000000000902";
// CONTA À PARTE para a automação GLOBAL: ela vale para QUALQUER post da
// conta (media_id nulo), então rodá-la em cima de CONTA contaminaria os
// posts que os outros casos deste arquivo ainda esperam ver como órfãos.
const CONTA_GLOBAL = "17800000000000903";

// A consulta REAL do Início, copiada aqui? NÃO — ela é importada da página no
// Passo 3. Este arquivo a exercita, para que mudá-la lá quebre aqui.
type ModuloInicio = typeof import("@/lib/oportunidades");
let mod: ModuloInicio;

async function comentario(conta: string, mediaId: string, quandoHorasAtras: number) {
  await banco.db().sql().query(
    `insert into events (account_id, type, payload, created_at)
     values ($1, 'comment', jsonb_build_object('media', jsonb_build_object('id', $2::text)),
             now() - make_interval(hours => $3::int))`,
    [conta, mediaId, quandoHorasAtras]
  );
}

async function automacao(
  conta: string,
  mediaId: string | null,
  ativa: boolean,
  triggers: string[] = ["comment"]
) {
  await banco.db().sql().query(
    `insert into automations (account_id, name, active, triggers, keywords, match_type, steps, media_id)
     values ($1, 'de teste', $2, $4::text[], array[]::text[], 'contains', '[]'::jsonb, $3)`,
    [conta, ativa, mediaId, triggers]
  );
}

beforeAll(async () => {
  mod = (await import("@/lib/oportunidades")) as ModuloInicio;
  for (const c of [CONTA, VIZINHA, CONTA_GLOBAL]) {
    await banco.db().upsertAccount({
      ig_user_id: c,
      username: "conta_" + c.slice(-3),
      name: null,
      profile_picture_url: null,
      access_token: "t",
      token_expires_at: null,
    });
  }
});

describe("oportunidades do Início", () => {
  test("post SEM automação entra; post COM automação ativa não", async () => {
    for (let i = 0; i < 8; i++) await comentario(CONTA, "POST_ORFAO", 2);
    for (let i = 0; i < 9; i++) await comentario(CONTA, "POST_COBERTO", 2);
    await automacao(CONTA, "POST_COBERTO", true);

    const r = await mod.oportunidadesDaConta(CONTA);
    const ids = r.map((o) => o.mediaId);
    expect(ids).toContain("POST_ORFAO");
    expect(ids).not.toContain("POST_COBERTO");
  });

  test("automação PAUSADA não protege o post", async () => {
    // Automação existe mas está desligada: ninguém está respondendo, então o
    // post continua sendo oportunidade. É o caso que separa "tem automação" de
    // "tem automação ATIVA".
    for (let i = 0; i < 6; i++) await comentario(CONTA, "POST_PAUSADO", 2);
    await automacao(CONTA, "POST_PAUSADO", false);

    expect((await mod.oportunidadesDaConta(CONTA)).map((o) => o.mediaId)).toContain(
      "POST_PAUSADO"
    );
  });

  test("comentário da conta vizinha não entra", async () => {
    for (let i = 0; i < 20; i++) await comentario(VIZINHA, "POST_DA_VIZINHA", 2);
    expect((await mod.oportunidadesDaConta(CONTA)).map((o) => o.mediaId)).not.toContain(
      "POST_DA_VIZINHA"
    );
  });

  test("comentário velho não conta: a janela é de 7 dias", async () => {
    for (let i = 0; i < 30; i++) await comentario(CONTA, "POST_VELHO", 24 * 9);
    expect((await mod.oportunidadesDaConta(CONTA)).map((o) => o.mediaId)).not.toContain(
      "POST_VELHO"
    );
  });

  test("devolve a contagem e o último comentário", async () => {
    const achado = (await mod.oportunidadesDaConta(CONTA)).find(
      (o) => o.mediaId === "POST_ORFAO"
    );
    expect(achado?.comentarios).toBe(8);
    expect(achado?.ultimo).toBeInstanceOf(Date);
    // PRENDE O VALOR SEM PRENDER O RELÓGIO: os comentários deste caso nasceram
    // "2 horas atrás" (`comentario(CONTA, "POST_ORFAO", 2)`, acima) — uma janela
    // de 3 horas prova que `ultimo` é de fato recente, sem cravar um instante
    // exato que o próximo run em outro fuso ou outra hora derrubaria.
    expect((achado!.ultimo as Date).getTime()).toBeGreaterThan(Date.now() - 3 * 3600_000);
  });

  // ACHADO 1: `findMatch` (lib/engine.ts) trata `media_id` NULO como "vale
  // para QUALQUER post" — é o que a tela do editor promete ("Sem post
  // escolhido, vale para todos os posts"). `NULL = x` nunca é verdadeiro em
  // SQL, então sem o `or a.media_id is null` a consulta não reconheceria essa
  // automação, e o post cairia como órfão por baixo de uma cobertura real.
  test("automação GLOBAL (media_id nulo) protege o post", async () => {
    for (let i = 0; i < 8; i++) await comentario(CONTA_GLOBAL, "POST_GLOBAL", 2);
    await automacao(CONTA_GLOBAL, null, true, ["comment"]);

    const ids = (await mod.oportunidadesDaConta(CONTA_GLOBAL)).map((o) => o.mediaId);
    expect(ids).not.toContain("POST_GLOBAL");
  });

  // ACHADO 2: `findMatch` exige `a.triggers.includes("comment")` antes de
  // qualquer outra checagem. Uma automação ativa presa ao post mas que só
  // dispara por DM não responde comentário nenhum — sem o
  // `'comment' = any(a.triggers)` ela "protegeria" o post do mesmo jeito.
  test("automação que não dispara por comentário NÃO protege", async () => {
    for (let i = 0; i < 6; i++) await comentario(CONTA, "POST_SO_DM", 2);
    await automacao(CONTA, "POST_SO_DM", true, ["dm"]);

    const ids = (await mod.oportunidadesDaConta(CONTA)).map((o) => o.mediaId);
    expect(ids).toContain("POST_SO_DM");
  });
});

describe("o post atravessa para a automação nova", () => {
  test("`post` válido vira `media_id` na automação criada", async () => {
    const acoes = await import("@/app/automacoes/actions");
    const form = new FormData();
    form.set("name", "nascida do Início");
    form.set("trigger", "comment");
    form.set("match_type", "any");
    form.set("post", "18056760980769921");

    // `criarAutomacao` termina em `redirect`, que LANÇA. O digest é o desfecho.
    await comoNumaRequisicao("/automacoes/nova", async () => {
      try {
        await acoes.criarAutomacao(null, form);
      } catch {
        /* o redirect do Next */
      }
      return null;
    });

    const linhas = (await banco.db().sql().query(
      `select media_id from automations where account_id = $1 and name = 'nascida do Início'`,
      [CONTA]
    )) as { media_id: string | null }[];
    expect(linhas[0]?.media_id).toBe("18056760980769921");
  });

  test("`post` fora do formato é IGNORADO, e a automação nasce sem post", async () => {
    // O valor vem da URL, e URL é digitável. Recusar o campo é diferente de
    // recusar a automação: quem clicou quer criar automação, e o post é um
    // atalho — perdê-lo não pode custar a criação.
    const acoes = await import("@/app/automacoes/actions");
    const form = new FormData();
    form.set("name", "com post torto");
    form.set("trigger", "comment");
    form.set("match_type", "any");
    form.set("post", "nao-e-um-id");

    await comoNumaRequisicao("/automacoes/nova", async () => {
      try {
        await acoes.criarAutomacao(null, form);
      } catch {
        /* o redirect do Next */
      }
      return null;
    });

    const linhas = (await banco.db().sql().query(
      `select media_id from automations where account_id = $1 and name = 'com post torto'`,
      [CONTA]
    )) as { media_id: string | null }[];
    expect(linhas).toHaveLength(1);
    expect(linhas[0].media_id).toBeNull();
  });
  test("`post` com gatilho que NAO usa post e ignorado, e a automacao nasce sem media_id", async () => {
    // O DEFEITO, achado em 16/09/2026 por um plantio que SOBREVIVEU.
    //
    // `salvarAutomacao` (app/automacoes/actions.ts) recusa post fora do gatilho
    // `comment` desde sempre, com um comentario explicando o motivo. Este
    // caminho — o atalho do Inicio, `/automacoes/nova?post=…` — NAO tinha a
    // mesma guarda: o `media_id` da URL entrava seja qual for o gatilho.
    //
    // E NAO E DADO MORTO. `findMatch` (lib/engine.ts:263) desempata com
    // `candidates.find((a) => trigger === "story" ? a.story_id : a.media_id)`,
    // e para o gatilho `dm` esse `a.media_id` continua sendo consultado: a
    // automacao com media_id sobrando GANHA o desempate de uma DM por causa de
    // um post que nao tem nada a ver com a conversa. O sintoma seria "a
    // automacao errada respondeu".
    //
    // MEDIDO em producao antes do conserto: 27 automacoes com media_id, todas
    // com gatilho `comment`, e NENHUMA automacao de `dm`. Latente — e e por isso
    // que precisa de portao: quando a primeira automacao de DM nascer, ninguem
    // vai estar procurando por isto.
    const acoes = await import("@/app/automacoes/actions");
    const form = new FormData();
    form.set("name", "dm que veio com post na URL");
    form.set("trigger", "dm");
    form.set("match_type", "any");
    form.set("post", "18056760980769922");

    await comoNumaRequisicao("/automacoes/nova", async () => {
      try {
        await acoes.criarAutomacao(null, form);
      } catch {
        /* o redirect do Next */
      }
      return null;
    });

    const linhas = (await banco.db().sql().query(
      `select media_id, triggers from automations
        where account_id = $1 and name = 'dm que veio com post na URL'`,
      [CONTA]
    )) as { media_id: string | null; triggers: string[] }[];
    // A automacao NASCEU — a guarda recusa o atalho, nunca a criacao.
    expect(linhas).toHaveLength(1);
    expect(linhas[0].triggers).toEqual(["dm"]);
    expect(linhas[0].media_id).toBeNull();
  });
});
