import { describe, it, expect } from "vitest";
import {
  LIMITE_DA_CATEGORIA,
  normalizarCategoria,
  semCategoria,
  quantasSemCategoria,
  filtroDaUrl,
  contatosDoFiltro,
  fichaSelecionada,
  urlComFiltro,
  resumoDasCategorias,
  casoDaListaDeEmail,
  type FichaDeCategoria,
  type FiltroDeCategoria,
} from "@/lib/categorias";

// ============================================================
// A NORMALIZAÇÃO É O QUE SUBSTITUI A GOVERNANÇA.
//
// Este produto NÃO tem tela para criar e renomear categorias, por decisão de
// desenho: a lista é o conjunto de valores em uso. Isso só se sustenta se
// `Aluno`, `aluno ` e `ALUNO` forem a MESMA categoria — sem isso a lista
// apodrece em três semanas e ninguém confia mais no filtro.
// ============================================================
describe("normalizarCategoria", () => {
  it("maiúscula e espaço nas pontas não criam categoria nova", () => {
    expect(normalizarCategoria("Aluno")).toBe("aluno");
    expect(normalizarCategoria("  aluno  ")).toBe("aluno");
    expect(normalizarCategoria("ALUNO")).toBe("aluno");
  });

  it("espaço repetido no meio vira um só", () => {
    expect(normalizarCategoria("turma   de    setembro")).toBe("turma de setembro");
    expect(normalizarCategoria("ex\tAluno")).toBe("ex aluno");
  });

  // \s não cobre os invisíveis de largura zero (categoria Unicode Cf) que
  // texto colado do Instagram e de teclado de celular carrega nas pontas.
  // Sem tratar isso, a ficha "sem categoria" ganha uma terceira forma —
  // invisível — além do nulo e do vazio.
  it("caracteres invisíveis (zero-width) não sobrevivem à normalização", () => {
    expect(normalizarCategoria("​")).toBe(null);
    expect(normalizarCategoria("​aluno​")).toBe("aluno");
  });

  // Devolver "" faria a coluna guardar texto vazio, e a ficha "sem categoria"
  // passaria a ter DUAS formas — o balde do null e o balde do vazio.
  it("vazio e só-espaço viram null, e não texto vazio", () => {
    expect(normalizarCategoria("")).toBe(null);
    expect(normalizarCategoria("   ")).toBe(null);
    expect(normalizarCategoria("\n\t ")).toBe(null);
  });

  it("o que não é texto vira null em vez de estourar", () => {
    expect(normalizarCategoria(null)).toBe(null);
    expect(normalizarCategoria(undefined)).toBe(null);
    expect(normalizarCategoria(42)).toBe(null);
    expect(normalizarCategoria({})).toBe(null);
    expect(normalizarCategoria([])).toBe(null);
  });

  // O limite existe para a coluna da tabela não virar um parágrafo. Cortar é
  // melhor que recusar: quem colou um texto longo por engano vê o que ficou.
  //
  // Números fixos aqui, de propósito: se o teste gerasse a entrada e a saída
  // esperada a partir de LIMITE_DA_CATEGORIA, mudar a constante para
  // qualquer valor — inclusive um grande o bastante para a coluna virar um
  // parágrafo, o problema que ela existe para evitar — não deixaria nenhum
  // caso vermelho. O teste tem que prender o limite, não seguí-lo.
  it("corta em 40 caracteres, e o corte não deixa espaço na ponta", () => {
    expect(LIMITE_DA_CATEGORIA).toBe(40);
    const longo = "a".repeat(60);
    expect(normalizarCategoria(longo)).toBe("a".repeat(40));
    const comEspaco = "b".repeat(39) + "   fim";
    expect(normalizarCategoria(comEspaco)).toBe("b".repeat(39));
  });

  // slice corta em unidades UTF-16, não em caracteres: um emoji fora do
  // plano básico ocupa duas unidades, e cortar no meio deixa um surrogate
  // solto (vira "�" ao serializar). Não é espaço, então .trim() não limpa.
  it("não corta um emoji ao meio (par substituto)", () => {
    const resultado = normalizarCategoria("a".repeat(39) + "😀");
    // 39 "a" + 1 emoji = 40 pontos de código (cabe no limite), mas 41
    // unidades UTF-16 — se tivesse sobrado só metade do par substituto, o
    // length UTF-16 seria 40, não 41.
    expect(resultado).toBe("a".repeat(39) + "😀");
    expect(resultado).toHaveLength(41);
  });

  it("acento é preservado: é nome de gente, não identificador", () => {
    expect(normalizarCategoria("Não respondeu")).toBe("não respondeu");
  });
});

describe("semCategoria", () => {
  it("null e sem categoria", () => {
    expect(semCategoria(null)).toBe(true);
  });
  it("texto de verdade tem categoria", () => {
    expect(semCategoria("aluno")).toBe(false);
  });
  // O CASO QUE JUSTIFICA A FUNCAO EXISTIR. Uma categoria de espacos em branco
  // marcaria a conversa como resolvida sem ninguem ter decidido nada, e ela
  // deixaria de pedir marcacao PARA SEMPRE — numa tela cheia, nenhum olho pega.
  it("so espacos conta como SEM categoria", () => {
    expect(semCategoria("   ")).toBe(true);
    expect(semCategoria("")).toBe(true);
  });
  // `normalizarCategoria` remove os invisiveis de largura zero ANTES de
  // colapsar espaco. Uma categoria feita so deles tem de cair no mesmo balde.
  it("so invisiveis conta como SEM categoria", () => {
    expect(semCategoria("‍​")).toBe(true);
  });
  it("o que nao e string conta como SEM categoria", () => {
    expect(semCategoria(42)).toBe(true);
    expect(semCategoria(undefined)).toBe(true);
  });
});

describe("quantasSemCategoria", () => {
  it("conta so as que faltam, e a mesma regra da marca", () => {
    expect(
      quantasSemCategoria([
        { categoria: "aluno" },
        { categoria: null },
        { categoria: "   " },
        { categoria: "interessado" },
      ])
    ).toBe(2);
  });
  it("lista vazia e zero", () => {
    expect(quantasSemCategoria([])).toBe(0);
  });
});

// ============================================================
// AS FICHAS, E O NÚMERO QUE ELAS EXISTEM PARA CONTAR.
//
// Medido em 31/08/2026 no banco de produção: 126 contatos, 9 alcançáveis —
// 7,1%. Duas das quatro contas com ZERO. É esse número que a ficha mostra, e
// mostrá-lo ANTES de existir botão de enviar é a razão de esta funcionalidade
// vir primeiro.
// ============================================================
describe("resumoDasCategorias", () => {
  const AGORA = new Date("2026-08-31T12:00:00Z").getTime();
  const HORAS = (h: number) => new Date(AGORA - h * 3_600_000);

  it("conta por categoria, e conta quantos estão alcançáveis", () => {
    // O tipo aqui, explícito, é o que prende a ficha exportada — mudar a forma
    // de `FichaDeCategoria` sem mudar este teste já quebra no typecheck.
    const fichas: FichaDeCategoria[] = resumoDasCategorias(
      [
        { categoria: "aluno", last_reply_at: HORAS(1) },
        { categoria: "aluno", last_reply_at: HORAS(30) },
        { categoria: "aluno", last_reply_at: null },
        { categoria: "interessado", last_reply_at: HORAS(2) },
      ],
      AGORA
    );
    expect(fichas).toEqual([
      { nome: "aluno", total: 3, alcancaveis: 1 },
      { nome: "interessado", total: 1, alcancaveis: 1 },
    ]);
  });

  // O balde do `null` é uma ficha como as outras — sem ele as contagens não
  // somam o total, e a tela passa a esconder gente.
  it("quem não tem categoria vira a ficha `sem categoria`, sempre por último", () => {
    const fichas = resumoDasCategorias(
      [
        { categoria: null, last_reply_at: HORAS(1) },
        { categoria: null, last_reply_at: HORAS(99) },
        { categoria: "aluno", last_reply_at: HORAS(99) },
      ],
      AGORA
    );
    expect(fichas.map((f) => f.nome)).toEqual(["aluno", null]);
    expect(fichas.at(-1)).toEqual({ nome: null, total: 2, alcancaveis: 1 });
  });

  it("a ordem é por tamanho, e empate desempata pelo nome", () => {
    const fichas = resumoDasCategorias(
      [
        { categoria: "zeta", last_reply_at: null },
        { categoria: "alfa", last_reply_at: null },
        { categoria: "meio", last_reply_at: null },
        { categoria: "meio", last_reply_at: null },
      ],
      AGORA
    );
    expect(fichas.map((f) => f.nome)).toEqual(["meio", "alfa", "zeta"]);
  });

  // ESTE É O CASO QUE PRENDE A HONESTIDADE, e ele existe por uma medição:
  // `windowState` fecha 5 minutos ANTES das 24h (WINDOW_MARGIN_MS), e o motor de
  // envio usa exatamente essa regra. Uma contagem por "menos de 24h" seria
  // QUASE sempre certa — e erraria ~7 vezes por dia, por 5 minutos cada,
  // prometendo alcance que o envio recusa. Erro que some sozinho é erro que
  // ninguém reproduz.
  it("quem está nos últimos 5 minutos da janela conta como FORA", () => {
    const fichas = resumoDasCategorias(
      [{ categoria: "aluno", last_reply_at: new Date(AGORA - (24 * 60 - 2) * 60_000) }],
      AGORA
    );
    expect(fichas[0]).toEqual({ nome: "aluno", total: 1, alcancaveis: 0 });
  });

  it("as contagens somam o total de contatos", () => {
    const contatos = [
      { categoria: "a", last_reply_at: HORAS(1) },
      { categoria: "b", last_reply_at: HORAS(1) },
      { categoria: null, last_reply_at: HORAS(1) },
    ];
    const fichas = resumoDasCategorias(contatos, AGORA);
    expect(fichas.reduce((s, f) => s + f.total, 0)).toBe(contatos.length);
  });

  it("lista vazia devolve lista vazia, e não estoura", () => {
    expect(resumoDasCategorias([], AGORA)).toEqual([]);
  });
});

// ============================================================
// O TEXTO DA SEÇÃO "COM E-MAIL", DEPOIS QUE A FONTE VIROU `visiveis`.
//
// A lista passou a derivar as duas tabelas de `visiveis` (o filtrado por
// categoria) em vez de `rows` (a conta inteira) — mas a frase "Ninguém
// informou o e-mail ainda" não mudou uma vírgula. Ela era verdade sobre a
// CONTA; virou, calada, uma alegação sobre o FILTRO.
// ============================================================
describe("casoDaListaDeEmail", () => {
  // O CASO QUE PRENDE O DEFEITO: o dono filtra por "aluno" — ninguém em
  // "aluno" deu e-mail, mas 40 pessoas em "interessado" deram. Sem separar
  // `filtrado`, a tela diria "ninguém informou e-mail" (só verdade da conta
  // inteira) e mandaria ligar uma automação que já está ligada.
  it("sem e-mail COM filtro ativo não é a mesma frase que sem e-mail geral", () => {
    expect(casoDaListaDeEmail({ visiveis: 5, comEmail: 0, filtrado: true })).toBe(
      "sem_email_no_filtro"
    );
    expect(casoDaListaDeEmail({ visiveis: 5, comEmail: 0, filtrado: false })).toBe(
      "sem_email_geral"
    );
  });

  // O CASO PIOR: um filtro que não casa ninguém (categoria que deixou de
  // existir, por exemplo). Sem um caso PRÓPRIO para ele, zero-de-zero cai na
  // checagem de "sem e-mail" e a tela nunca diz que o filtro não achou NINGUÉM.
  //
  // ISTO PRENDE A EXISTÊNCIA DA CHECAGEM, e não a POSIÇÃO dela: as duas
  // asserções passam `comEmail: 0`, e não poderiam passar outra coisa —
  // `comEmail` é subconjunto de `visiveis`, então `visiveis: 0` com
  // `comEmail > 0` é um par que chamador nenhum produz. A ordem entre as duas
  // primeiras checagens de `casoDaListaDeEmail` é inerte, e está escrito lá.
  it("filtro sem ninguém tem caso próprio, e não cai no de sem e-mail", () => {
    expect(casoDaListaDeEmail({ visiveis: 0, comEmail: 0, filtrado: true })).toBe("filtro_vazio");
    expect(casoDaListaDeEmail({ visiveis: 0, comEmail: 0, filtrado: false })).toBe(
      "filtro_vazio"
    );
  });

  it("quem tem e-mail manda no resultado, com ou sem filtro", () => {
    expect(casoDaListaDeEmail({ visiveis: 5, comEmail: 2, filtrado: true })).toBe("tem_email");
    expect(casoDaListaDeEmail({ visiveis: 5, comEmail: 5, filtrado: false })).toBe("tem_email");
  });
});
// ============================================================
// O QUE A URL PEDE, E QUAIS LINHAS ISSO DEIXA PASSAR.
//
// `?categoria=` AUSENTE (`/contatos`) e `?categoria=` PRESENTE E VAZIO
// (`/contatos?categoria=`) normalizam para o MESMO nome — `null` — e NÃO são o
// mesmo pedido: o primeiro é "tudo", o segundo é "filtrar por sem categoria", e
// é exatamente o link que a ficha "sem categoria" gera na lista.
//
// ISTO VIVIA INLINE NO JSX, defendido por um comentário de vinte linhas. Medido
// em 31/08/2026: trocar a checagem da PRESENÇA do parâmetro pela do VALOR
// normalizado (`filtro === null`) quebra `/contatos?categoria=` — que passa a
// mostrar a conta inteira — com lint, typecheck, 897 testes puros e 61 de
// integração TODOS verdes. Comentário não é rede; os casos abaixo são.
// ============================================================
describe("filtroDaUrl", () => {
  it("parâmetro AUSENTE é a conta inteira", () => {
    expect(filtroDaUrl(undefined)).toEqual({ tipo: "tudo" });
  });

  // O CASO QUE PRENDE A LINHA: vazio é PEDIDO, e não ausência de pedido.
  it("parâmetro PRESENTE e vazio é o filtro `sem categoria`, e não `tudo`", () => {
    expect(filtroDaUrl("")).toEqual({ tipo: "uma", nome: null });
    // Só-espaço normaliza para o mesmo nome, e continua sendo um pedido.
    expect(filtroDaUrl("   ")).toEqual({ tipo: "uma", nome: null });
  });

  it("o nome chega normalizado, para casar com o que foi gravado", () => {
    expect(filtroDaUrl("  Aluno ")).toEqual({ tipo: "uma", nome: "aluno" });
  });
});

describe("contatosDoFiltro", () => {
  const contatos = [
    { categoria: "aluno" },
    { categoria: "interessado" },
    { categoria: null },
    { categoria: null },
  ];

  it("sem parâmetro, passa a conta inteira", () => {
    expect(contatosDoFiltro(contatos, filtroDaUrl(undefined))).toHaveLength(4);
  });

  // O MESMO caso pelo outro lado: com `filtro === null` no lugar da presença do
  // parâmetro, esta asserção devolve os 4 — a conta inteira — em vez dos 2.
  it("com `?categoria=` vazio, passa só quem NÃO tem categoria", () => {
    expect(contatosDoFiltro(contatos, filtroDaUrl(""))).toEqual([
      { categoria: null },
      { categoria: null },
    ]);
  });

  it("com nome, passa só quem casa, e casa pelo nome normalizado", () => {
    expect(contatosDoFiltro(contatos, filtroDaUrl("ALUNO "))).toEqual([{ categoria: "aluno" }]);
  });

  it("filtro que não casa ninguém devolve lista vazia, e não a conta inteira", () => {
    expect(contatosDoFiltro(contatos, filtroDaUrl("ex-aluno"))).toEqual([]);
  });
});

describe("fichaSelecionada", () => {
  it("sem parâmetro, ficha nenhuma está marcada — nem a `sem categoria`", () => {
    expect(fichaSelecionada(filtroDaUrl(undefined), null)).toBe(false);
    expect(fichaSelecionada(filtroDaUrl(undefined), "aluno")).toBe(false);
  });

  // A ficha "sem categoria" é a que gera o link vazio; se ela deixar de se
  // marcar, o dono clica e a tela não muda de aparência nenhuma.
  it("com `?categoria=` vazio, a ficha marcada é a `sem categoria`", () => {
    expect(fichaSelecionada(filtroDaUrl(""), null)).toBe(true);
    expect(fichaSelecionada(filtroDaUrl(""), "aluno")).toBe(false);
  });

  it("com nome, a ficha marcada é a daquele nome", () => {
    expect(fichaSelecionada(filtroDaUrl("aluno"), "aluno")).toBe(true);
    expect(fichaSelecionada(filtroDaUrl("aluno"), null)).toBe(false);
  });
});

describe("urlComFiltro", () => {
  const paramDe = (u: string) => new URL(u, "http://x").searchParams.get("categoria") ?? undefined;

  it("`tudo` não leva parâmetro nenhum", () => {
    expect(urlComFiltro("/contatos", { tipo: "tudo" })).toBe("/contatos");
    expect(paramDe(urlComFiltro("/contatos", { tipo: "tudo" }))).toBe(undefined);
  });

  // A VOLTA É O QUE IMPORTA: o link que a ficha gera tem de ser lido de volta
  // como o MESMO filtro. É esta ida-e-volta que amarra o link da ficha à
  // leitura da página — e é ela que a troca por `filtro === null` quebra, no
  // caso do nome nulo.
  it("o que a ficha gera, a página lê de volta igual", () => {
    for (const nome of [null, "aluno", "turma de setembro", "não respondeu", "a&b=c"]) {
      const filtro: FiltroDeCategoria = { tipo: "uma", nome };
      expect(filtroDaUrl(paramDe(urlComFiltro("/contatos", filtro)))).toEqual(filtro);
    }
  });

  it("o mesmo filtro serve a qualquer base — a lista e o CSV não divergem", () => {
    const filtro: FiltroDeCategoria = { tipo: "uma", nome: "aluno" };
    expect(urlComFiltro("/contatos", filtro)).toBe("/contatos?categoria=aluno");
    expect(urlComFiltro("/api/contatos/csv", filtro)).toBe("/api/contatos/csv?categoria=aluno");
  });
});
