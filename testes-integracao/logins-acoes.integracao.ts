// A PÁGINA LOGINS E AS AÇÕES DELA (docs/specs/2026-11-04-logins.md, seção 4), com a sessão do login de
// teste, no contexto de requisição semeado e no banco descartável. E o convite, que passou a ser só do
// administrador.
//
// O login de teste nasce administrador (./semear-requisicao.ts diz isso explícito). Para o caso de quem não é,
// ele perde o marcador no próprio caso e o recebe de volta no `beforeEach` seguinte; e o login comum de teste
// (`comoNumaRequisicaoComoComum`) mede o comum de verdade.
//
// DESDE AS CONTAS POR LOGIN (docs/specs/2026-11-05-contas-por-login.md, seção 4), a página cria o comum e o
// administrador pela caixinha, dá as contas a cada comum e troca o papel, com as travas do desativar.
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bancoDescartavel } from "./harness";
import { comoNumaRequisicaoComoComum, comoNumaRequisicaoComSessao, EMAIL_DE_TESTE } from "./semear-requisicao";

type ModuloAcoes = typeof import("@/app/logins/actions");
type ModuloPagina = typeof import("@/app/logins/page");
type ModuloSetup = typeof import("@/app/setup/actions");
type ModuloRepositorio = typeof import("@/lib/logins-repositorio");
type ModuloLogins = typeof import("@/lib/logins");
type ModuloTextos = typeof import("@/lib/logins-textos");

const banco = bancoDescartavel();
const q = (texto: string, params: unknown[] = []) => banco.db().sql().query(texto, params) as Promise<Record<string, unknown>[]>;

let acoes: ModuloAcoes;
let pagina: ModuloPagina;
let setup: ModuloSetup;
let repo: ModuloRepositorio;
let logins: ModuloLogins;
let textos: ModuloTextos;

beforeAll(async () => {
  acoes = await import("@/app/logins/actions");
  pagina = await import("@/app/logins/page");
  setup = await import("@/app/setup/actions");
  repo = await import("@/lib/logins-repositorio");
  logins = await import("@/lib/logins");
  textos = await import("@/lib/logins-textos");
  // AS DUAS CONTAS DO PAINEL, para as contas de um login comum. Valores inventados: nenhuma credencial de verdade
  // entra em teste, e o token é conferido fora da página.
  for (const id of [CONTA_A, CONTA_B]) {
    await banco.db().upsertAccount({
      ig_user_id: id,
      username: `arroba_${id}`,
      name: `Nome da ${id}`,
      profile_picture_url: null,
      access_token: TOKEN_DAS_CONTAS,
      token_expires_at: null,
    });
  }
});

const CONTA_A = "17800000000071001";
const CONTA_B = "17800000000071002";
const TOKEN_DAS_CONTAS = "token-das-contas-da-pagina-logins-que-nao-vale-nada";

beforeEach(async () => {
  await q(`delete from logins where email <> $1`, [EMAIL_DE_TESTE]);
  await q(`update logins set administrador = true, desativado_em = null where email = $1`, [EMAIL_DE_TESTE]);
  await q(`delete from convites_de_conexao`);
});

const form = (campos: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
};

/** Roda o corpo com a sessão de teste e devolve o destino do redirect (ou null) e o valor. */
async function comSessao<T>(rota: string, corpo: () => Promise<T>): Promise<{ destino: string | null; valor?: T }> {
  const { valor } = await comoNumaRequisicaoComSessao(rota, async () => {
    try {
      return { destino: null, valor: await corpo() };
    } catch (e) {
      const d = (e as { digest?: unknown }).digest;
      if (typeof d !== "string" || !d.startsWith("NEXT_REDIRECT;")) throw e;
      return { destino: d.split(";").slice(2, -2).join(";") };
    }
  });
  return valor;
}

async function outroLogin(email: string, administrador = true, nome = "Outra pessoa"): Promise<string> {
  const r = await repo.criarLogin({
    email,
    nome,
    senhaHash: await logins.hashDaSenha("a senha da outra pessoa"),
    administrador,
  });
  if ("erro" in r) throw new Error(r.erro);
  return r.id;
}

const idDoTeste = async () => String((await q(`select id from logins where email = $1`, [EMAIL_DE_TESTE]))[0].id);
const sessoesDo = async (id: string) => Number((await q(`select count(*)::int as n from sessoes where login_id = $1`, [id]))[0].n);

describe("criar um login", () => {
  it("grava o login com o hash da senha, e não a senha", async () => {
    const r = await comSessao("/logins", () =>
      acoes.criarLoginAction({}, form({ nome: "  Maria  ", email: " Maria@Exemplo.INVALID ", senha: "a senha inicial da maria" }))
    );
    expect(r.valor?.ok).toMatch(/Login de Maria criado/);
    const [linha] = await q(`select nome, senha_hash, administrador from logins where email = 'maria@exemplo.invalid'`);
    expect(linha.nome).toBe("Maria");
    // SEM A CAIXINHA "Administrador", O LOGIN NASCE COMUM (spec das contas por login, seção 4).
    expect(linha.administrador).toBe(false);
    expect(String(linha.senha_hash)).not.toContain("a senha inicial da maria");
    expect(await logins.senhaConfere("a senha inicial da maria", String(linha.senha_hash))).toBe(true);
  });

  it("recusa o e-mail repetido, o nome vazio, o e-mail torto e a senha curta, sem gravar", async () => {
    await outroLogin("repetido@exemplo.invalid");
    const casos: [Record<string, string>, string][] = [
      [{ nome: "X", email: "repetido@exemplo.invalid", senha: "uma senha comprida" }, textos.FRASE_DO_EMAIL_REPETIDO],
      [{ nome: "  ", email: "novo@exemplo.invalid", senha: "uma senha comprida" }, textos.FRASE_DO_NOME],
      [{ nome: "X", email: "novo.exemplo.invalid", senha: "uma senha comprida" }, textos.FRASE_DO_EMAIL],
      [{ nome: "X", email: "novo@exemplo.invalid", senha: "curta" }, textos.FRASE_DA_SENHA],
    ];
    for (const [campos, frase] of casos) {
      const r = await comSessao("/logins", () => acoes.criarLoginAction({}, form(campos)));
      expect(r.valor, JSON.stringify(campos)).toEqual({ erro: frase });
    }
    expect((await q(`select email from logins where email = 'novo@exemplo.invalid'`)).length).toBe(0);
  });
});

describe("a senha nova e a desativação", () => {
  it("a senha nova derruba as sessões daquele login, e a senha nova entra", async () => {
    const id = await outroLogin("esqueceu@exemplo.invalid");
    await repo.criarSessao(id);
    await repo.criarSessao(id);
    const r = await comSessao("/logins", () => acoes.definirSenhaAction({}, form({ id, senha: "a senha nova da pessoa" })));
    expect(r.valor).toEqual({ ok: textos.FRASE_DA_SENHA_NOVA_DEFINIDA });
    expect(await sessoesDo(id)).toBe(0);
    const hash = String((await q(`select senha_hash from logins where id = $1`, [id]))[0].senha_hash);
    expect(await logins.senhaConfere("a senha nova da pessoa", hash)).toBe(true);
  });

  it("desativar outro login derruba as sessões dele; reativar devolve a entrada", async () => {
    const id = await outroLogin("sai@exemplo.invalid");
    await repo.criarSessao(id);
    expect((await comSessao("/logins", () => acoes.desativarLoginAction(form({ id })))).destino).toBe("/logins?aviso=desativado");
    expect(await sessoesDo(id)).toBe(0);
    expect((await q(`select desativado_em from logins where id = $1`, [id]))[0].desativado_em).not.toBeNull();
    expect((await comSessao("/logins", () => acoes.reativarLoginAction(form({ id })))).destino).toBe("/logins?aviso=reativado");
    expect((await q(`select desativado_em from logins where id = $1`, [id]))[0].desativado_em).toBeNull();
  });

  it("ninguém desativa o próprio login pela página", async () => {
    await comSessao("/logins", async () => null); // garante que o login de teste já nasceu
    const id = await idDoTeste();
    expect((await comSessao("/logins", () => acoes.desativarLoginAction(form({ id })))).destino).toBe("/logins?aviso=proprio");
    expect((await q(`select desativado_em from logins where id = $1`, [id]))[0].desativado_em).toBeNull();
  });
});

describe("quem não é administrador", () => {
  it("volta para o início em cada ação da página Logins, sem gravar nada", async () => {
    const alvo = await outroLogin("alvo@exemplo.invalid");
    await q(`update logins set administrador = false where email = $1`, [EMAIL_DE_TESTE]);
    const tentativas: (() => Promise<unknown>)[] = [
      () => acoes.criarLoginAction({}, form({ nome: "X", email: "intruso@exemplo.invalid", senha: "uma senha comprida" })),
      () => acoes.definirSenhaAction({}, form({ id: alvo, senha: "uma senha comprida" })),
      () => acoes.desativarLoginAction(form({ id: alvo })),
      () => acoes.reativarLoginAction(form({ id: alvo })),
    ];
    for (const t of tentativas) expect((await comSessao("/logins", t)).destino).toBe("/");
    expect((await q(`select email from logins where email = 'intruso@exemplo.invalid'`)).length).toBe(0);
    expect((await q(`select desativado_em from logins where id = $1`, [alvo]))[0].desativado_em).toBeNull();
  });

  it("volta para o início no convite, sem gravar nada", async () => {
    await q(`update logins set administrador = false where email = $1`, [EMAIL_DE_TESTE]);
    expect((await comSessao("/setup", () => setup.gerarConvite(null, form({ para_quem: "Alguém" })))).destino).toBe("/");
    expect((await comSessao("/setup", () => setup.cancelarConvite(form({ id: "00000000-0000-0000-0000-000000000000" })))).destino).toBe("/");
    expect((await q(`select id from convites_de_conexao`)).length).toBe(0);
  });

  it("volta para o início na página Logins", async () => {
    await q(`update logins set administrador = false where email = $1`, [EMAIL_DE_TESTE]);
    expect((await comSessao("/logins", () => pagina.default({ searchParams: Promise.resolve({}) }))).destino).toBe("/");
  });
});

describe("a página Logins", () => {
  it("lista os logins, marca quem está usando e mostra só o aviso da lista fechada", async () => {
    await outroLogin("outra@exemplo.invalid");
    const desenhar = async (aviso: string) => {
      const r = await comSessao("/logins", async () =>
        renderToStaticMarkup(await pagina.default({ searchParams: Promise.resolve({ aviso }) }))
      );
      return String(r.valor);
    };
    const h = await desenhar("desativado");
    expect(h).toContain("outra@exemplo.invalid");
    expect(h).toContain(EMAIL_DE_TESTE);
    expect(h).toContain(">você<");
    expect(h).toContain(textos.AVISOS_DA_PAGINA.desativado);
    expect(h).not.toContain("scrypt$");
    // O próprio login não tem o botão de desativar: um só "Desativar", o da outra pessoa.
    expect(h.match(/>Desativar</g)?.length).toBe(1);
    // Nem a senha nova: ela derruba TODAS as sessões do login, e quem a usasse em si mesmo se derrubaria
    // (nota da auditoria ao plano, 04/11). Para a própria senha, a página aponta a Minha conta.
    expect(h).toContain("Senha nova para Outra pessoa");
    expect(h).not.toContain("Senha nova para Login de teste");
    expect(h).toContain('href="/minha-conta"');
    const torto = await desenhar("<b>vazado</b>");
    expect(torto).not.toContain("vazado");
  });
});

// ===================================================================================================
// AS CONTAS POR LOGIN NA PÁGINA LOGINS (docs/specs/2026-11-05-contas-por-login.md, seção 4)
// ===================================================================================================

/** O formulário das contas de um login: o id e uma `contas` por caixinha marcada, como o navegador manda. */
const formDasContas = (id: string, contas: string[]) => {
  const f = form({ id });
  for (const c of contas) f.append("contas", c);
  return f;
};

const papelDe = async (id: string) => (await q(`select administrador from logins where id = $1`, [id]))[0]?.administrador;

describe("criar um login, comum ou administrador", () => {
  it("sem a caixinha nasce comum, e com ela nasce administrador", async () => {
    const criar = (email: string, administrador: boolean) =>
      comSessao("/logins", () =>
        acoes.criarLoginAction(
          {},
          form({ nome: "Pessoa nova", email, senha: "a senha inicial dela", ...(administrador ? { administrador: "on" } : {}) })
        )
      );
    expect((await criar("comum-novo@exemplo.invalid", false)).valor?.ok).toMatch(/criado/);
    expect((await criar("adm-novo@exemplo.invalid", true)).valor?.ok).toMatch(/criado/);
    const linhas = await q(`select email, administrador from logins where email like '%-novo@exemplo.invalid' order by email`);
    expect(linhas).toEqual([
      { email: "adm-novo@exemplo.invalid", administrador: true },
      { email: "comum-novo@exemplo.invalid", administrador: false },
    ]);
  });
});

describe("as contas de um login comum", () => {
  it("salvar troca o conjunto de uma vez, e diz que vale no próximo clique", async () => {
    const comum = await outroLogin("comum@exemplo.invalid", false);
    const salvar = (contas: string[]) => comSessao("/logins", () => acoes.definirContasDoLoginAction({}, formDasContas(comum, contas)));
    expect((await salvar([CONTA_A])).valor).toEqual({ ok: textos.FRASE_CONTAS_SALVAS });
    expect(await repo.idsDasContasDoLogin(comum)).toEqual([CONTA_A]);
    expect((await salvar([CONTA_B])).valor).toEqual({ ok: textos.FRASE_CONTAS_SALVAS });
    expect(await repo.idsDasContasDoLogin(comum)).toEqual([CONTA_B]);
    // Nenhuma marcada também é um conjunto: o comum fica sem contas.
    expect((await salvar([])).valor).toEqual({ ok: textos.FRASE_CONTAS_SALVAS });
    expect(await repo.idsDasContasDoLogin(comum)).toEqual([]);
  });

  it("a conta que não existe é recusada, e nada muda", async () => {
    const comum = await outroLogin("comum@exemplo.invalid", false);
    expect(await repo.definirContasDoLogin(comum, [CONTA_A])).toBe("ok");
    const r = await comSessao("/logins", () =>
      acoes.definirContasDoLoginAction({}, formDasContas(comum, [CONTA_B, "17800000000079999"]))
    );
    expect(r.valor).toEqual({ erro: textos.FRASE_DA_CONTA_QUE_NAO_EXISTE });
    expect(await repo.idsDasContasDoLogin(comum)).toEqual([CONTA_A]);
  });

  it("as contas de um administrador são recusadas: ele já vê todas", async () => {
    const adm = await outroLogin("adm@exemplo.invalid", true);
    const r = await comSessao("/logins", () => acoes.definirContasDoLoginAction({}, formDasContas(adm, [CONTA_A])));
    expect(r.valor).toEqual({ erro: textos.FRASE_DO_LOGIN_ADMINISTRADOR });
    expect(await repo.idsDasContasDoLogin(adm)).toEqual([]);
  });

  it("o login que não existe é recusado com a frase de sempre", async () => {
    const r = await comSessao("/logins", () =>
      acoes.definirContasDoLoginAction({}, formDasContas("00000000-0000-4000-8000-000000000000", [CONTA_A]))
    );
    expect(r.valor).toEqual({ erro: textos.FRASE_DO_LOGIN_QUE_NAO_EXISTE });
  });
});

describe("o papel de um login", () => {
  const trocar = (id: string, papel: string) => comSessao("/logins", () => acoes.definirPapelDoLoginAction(form({ id, papel })));

  it("o comum vira administrador, e volta a comum", async () => {
    const id = await outroLogin("comum@exemplo.invalid", false);
    expect((await trocar(id, "administrador")).destino).toBe("/logins?aviso=virou_administrador");
    expect(await papelDe(id)).toBe(true);
    expect((await trocar(id, "comum")).destino).toBe("/logins?aviso=virou_comum");
    expect(await papelDe(id)).toBe(false);
  });

  it("ninguém muda o próprio papel", async () => {
    await comSessao("/logins", async () => null); // garante que o login de teste já nasceu
    const eu = await idDoTeste();
    expect((await trocar(eu, "comum")).destino).toBe("/logins?aviso=papel_proprio");
    expect(await papelDe(eu)).toBe(true);
  });

  it("um papel que não é dos dois vira o aviso de não achado, e nada muda", async () => {
    const id = await outroLogin("comum@exemplo.invalid", false);
    expect((await trocar(id, "dono")).destino).toBe("/logins?aviso=nao_encontrado");
    expect(await papelDe(id)).toBe(false);
  });

  // O ÚLTIMO ADMINISTRADOR, PELA ACTION. Em série ele não se alcança: quem pede é um administrador ativo, e o
  // outro também, então há sempre dois. Ele aparece quando dois administradores rebaixam um ao outro ao mesmo
  // tempo (achado 168). O ACERTO DO TEMPO É FEITO PELO BANCO: uma transação de fora rebaixa o login de teste e
  // segura a linha dele; a action, pedida por ele, passa pela sessão (que lê a linha de antes) e para no
  // `for update` dos administradores; a transação solta só depois de o banco mostrar a espera, e a action conta
  // de novo, já sem o login de teste.
  it("o último administrador ativo não vira comum, mesmo com os dois rebaixando um ao outro (168)", async () => {
    await comSessao("/logins", async () => null); // a sessão do login de teste nasce antes da trava
    const eu = await idDoTeste();
    const outro = await outroLogin("outro-adm@exemplo.invalid", true);
    let acao: Promise<{ destino: string | null }> | undefined;
    await banco
      .db()
      .sql()
      .begin(async (tx) => {
        await tx.query(`update logins set administrador = false where id = $1`, [eu]);
        acao = trocar(outro, "comum");
        for (let i = 0; i < 100; i++) {
          const [{ n }] = (await q(`select count(*)::int as n from pg_locks where not granted`)) as { n: number }[];
          if (Number(n) > 0) break;
          await new Promise((r) => setTimeout(r, 50));
        }
      });
    expect((await acao!).destino).toBe("/logins?aviso=ultimo_administrador");
    expect(await papelDe(outro)).toBe(true);
  });
});

describe("o login comum na página Logins", () => {
  /** Roda o corpo com o login COMUM de teste e devolve o destino do redirect (ou null). */
  async function comoComum(corpo: () => Promise<unknown>): Promise<string | null> {
    const { valor } = await comoNumaRequisicaoComoComum(
      "/logins",
      async () => {
        try {
          await corpo();
          return null;
        } catch (e) {
          const d = (e as { digest?: unknown }).digest;
          if (typeof d !== "string" || !d.startsWith("NEXT_REDIRECT;")) throw e;
          return d.split(";").slice(2, -2).join(";");
        }
      },
      { contas: [CONTA_A] }
    );
    return valor;
  }

  it("volta para o início em cada ação da página, as novas e as de antes, sem gravar nada", async () => {
    const alvo = await outroLogin("alvo@exemplo.invalid", false);
    const tentativas: [string, () => Promise<unknown>][] = [
      ["criarLoginAction", () => acoes.criarLoginAction({}, form({ nome: "X", email: "intruso@exemplo.invalid", senha: "uma senha comprida" }))],
      ["definirSenhaAction", () => acoes.definirSenhaAction({}, form({ id: alvo, senha: "uma senha comprida" }))],
      ["desativarLoginAction", () => acoes.desativarLoginAction(form({ id: alvo }))],
      ["reativarLoginAction", () => acoes.reativarLoginAction(form({ id: alvo }))],
      ["definirContasDoLoginAction", () => acoes.definirContasDoLoginAction({}, formDasContas(alvo, [CONTA_A]))],
      ["definirPapelDoLoginAction", () => acoes.definirPapelDoLoginAction(form({ id: alvo, papel: "administrador" }))],
    ];
    for (const [nome, t] of tentativas) expect(await comoComum(t), nome).toBe("/");
    expect((await q(`select email from logins where email = 'intruso@exemplo.invalid'`)).length).toBe(0);
    const [linha] = await q(`select administrador, desativado_em from logins where id = $1`, [alvo]);
    expect(linha).toEqual({ administrador: false, desativado_em: null });
    expect(await repo.idsDasContasDoLogin(alvo)).toEqual([]);
  });

  it("volta para o início na página", async () => {
    expect(await comoComum(() => pagina.default({ searchParams: Promise.resolve({}) }))).toBe("/");
  });
});

describe("a página Logins com o papel e as contas", () => {
  /** Os `props` de todo elemento da árvore que casam com `casa`, andando pelos filhos (o molde de acoes-que-falam). */
  function propsDaArvore(raiz: unknown, casa: (p: Record<string, unknown>) => boolean): Record<string, unknown>[] {
    const achados: Record<string, unknown>[] = [];
    const visto = new Set<unknown>();
    const andar = (no: unknown): void => {
      if (Array.isArray(no)) return no.forEach(andar);
      if (typeof no !== "object" || no === null || visto.has(no)) return;
      visto.add(no);
      const props = (no as { props?: Record<string, unknown> }).props;
      if (!props) return;
      if (casa(props)) achados.push(props);
      andar(props.children);
    };
    andar(raiz);
    return achados;
  }

  it("mostra o papel, as contas do comum, o 'Vê todas as contas' do administrador e o trocar o papel", async () => {
    const comum = await outroLogin("comum@exemplo.invalid", false, "Pessoa comum");
    await outroLogin("adm@exemplo.invalid", true, "Pessoa administradora");
    const parado = await outroLogin("parado@exemplo.invalid", false, "Pessoa desativada");
    await q(`update logins set desativado_em = now() where id = $1`, [parado]);
    expect(await repo.definirContasDoLogin(comum, [CONTA_B])).toBe("ok");

    const { valor } = await comoNumaRequisicaoComSessao("/logins", () => pagina.default({ searchParams: Promise.resolve({}) }));
    const h = renderToStaticMarkup(valor as Parameters<typeof renderToStaticMarkup>[0]);
    expect(h).not.toContain("Nesta versão, todo login é administrador.");
    // O selo do papel em cada linha: o login de teste e a outra administradora; a comum e a desativada.
    expect(h.match(/>administrador</g)?.length).toBe(2);
    expect(h.match(/>comum</g)?.length).toBe(2);
    // As contas só na linha da comum ativa, e a desativada não tem o formulário.
    expect(h.match(/>Salvar contas</g)?.length).toBe(1);
    expect(h.match(/Vê todas as contas/g)?.length).toBe(2);
    expect(h).toMatch(new RegExp(`value="${CONTA_B}"[^>]*checked|checked[^>]*value="${CONTA_B}"`));
    expect(h).not.toMatch(new RegExp(`value="${CONTA_A}"[^>]*checked|checked[^>]*value="${CONTA_A}"`));
    // O trocar o papel em toda linha que não é a sua: a administradora vira comum; as duas comuns, administradoras.
    expect(h.match(/>Tornar comum</g)?.length).toBe(1);
    expect(h.match(/>Tornar administrador</g)?.length).toBe(2);
    // O TOKEN DAS CONTAS NÃO VAI AO NAVEGADOR: o formulário é de cliente, e o que ele recebe vai na resposta.
    expect(h).not.toContain(TOKEN_DAS_CONTAS);
    const formularios = propsDaArvore(valor, (p) => Array.isArray(p.contas) && Array.isArray(p.marcadas));
    expect(formularios).toHaveLength(1);
    for (const c of formularios[0].contas as Record<string, unknown>[]) {
      expect(Object.keys(c).sort()).toEqual(["ig_user_id", "name", "username"]);
    }
    expect(formularios[0].marcadas).toEqual([CONTA_B]);
  });
});
