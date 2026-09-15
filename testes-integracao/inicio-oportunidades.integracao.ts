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

const banco = bancoDescartavel();

const CONTA = "17800000000000901";
const VIZINHA = "17800000000000902";

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

async function automacao(conta: string, mediaId: string, ativa: boolean) {
  await banco.db().sql().query(
    `insert into automations (account_id, name, active, triggers, keywords, match_type, steps, media_id)
     values ($1, 'de teste', $2, array['comment'], array[]::text[], 'contains', '[]'::jsonb, $3)`,
    [conta, ativa, mediaId]
  );
}

beforeAll(async () => {
  mod = (await import("@/lib/oportunidades")) as ModuloInicio;
  for (const c of [CONTA, VIZINHA]) {
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
  });
});
