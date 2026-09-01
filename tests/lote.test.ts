import { describe, it, expect } from "vitest";
import {
  destinoDoLote,
  lerPayloadDoLote,
  loteExpirou,
  payloadDoLote,
  urlDeLoteValida,
  alvoDoLote,
  campoDoFiltro,
  filtroDoCampo,
  validadeDoDia,
} from "@/lib/lote";

// ============================================================
// QUEM RECEBE AGORA E QUEM ESPERA — a decisão mais perigosa deste projeto.
//
// Este é o primeiro recurso do produto que manda mensagem para muita gente de
// uma vez. Um erro aqui não é uma mensagem errada, são quarenta, saindo do
// perfil de verdade para clientes de verdade.
//
// Medido em produção (01/09/2026): 126 contatos, 9 alcançáveis — 7,1%.
// ============================================================
const AGORA = new Date("2026-09-01T12:00:00Z").getTime();
const HORAS = (h: number) => new Date(AGORA - h * 3_600_000);

describe("destinoDoLote", () => {
  it("separa quem está na janela de quem vai esperar", () => {
    const d = destinoDoLote(
      [
        { ig_id: "a", last_reply_at: HORAS(1), recebidas: 5 },
        { ig_id: "b", last_reply_at: HORAS(30), recebidas: 5 },
        { ig_id: "c", last_reply_at: null, recebidas: 0 },
      ],
      AGORA
    );
    expect(d.agora).toEqual(["a"]);
    expect(d.esperam).toEqual(["b", "c"]);
  });

  // A MESMA MARGEM DO MOTOR. `windowState` fecha 5 minutos antes das 24h, e
  // `lib/queue-drain.ts` usa exatamente essa função para RECUSAR um envio. Uma
  // regra própria aqui faria a tela prometer alcance que o motor recusa.
  it("quem está nos últimos 5 minutos da janela ESPERA, não recebe agora", () => {
    const d = destinoDoLote(
      [{ ig_id: "a", last_reply_at: new Date(AGORA - (24 * 60 - 2) * 60_000), recebidas: 3 }],
      AGORA
    );
    expect(d.agora).toEqual([]);
    expect(d.esperam).toEqual(["a"]);
  });

  // O TERCEIRO NÚMERO É PALPITE, E A FUNÇÃO NÃO PODE FINGIR O CONTRÁRIO.
  // Medido: 48 de 120 pessoas falaram uma única vez na vida. Elas contam como
  // "provavelmente nunca" — mas continuam DENTRO de `esperam`, porque podem
  // voltar amanhã. O número é informativo, e não um terceiro balde.
  it("os improváveis são um subconjunto de quem espera, e não um balde à parte", () => {
    const d = destinoDoLote(
      [
        { ig_id: "a", last_reply_at: HORAS(30), recebidas: 1 },
        { ig_id: "b", last_reply_at: HORAS(30), recebidas: 9 },
      ],
      AGORA
    );
    expect(d.esperam).toEqual(["a", "b"]);
    expect(d.improvaveis).toBe(1);
    expect(d.agora.length + d.esperam.length).toBe(2);
  });

  // ZERO ENTRA NO MESMO BALDE DE UMA, e não por acaso: quem tem `recebidas: 0`
  // nunca escreveu (chegou por comentar num post), nunca teve janela aberta, e
  // por isso é o caso MAIS forte de "provavelmente nunca" — não um caso à
  // parte que o teste de cima, com `c: recebidas 0`, deixava passar sem
  // afirmar nada sobre `improvaveis`.
  it("quem nunca mandou mensagem (recebidas: 0) também conta como improvável", () => {
    const d = destinoDoLote(
      [{ ig_id: "c", last_reply_at: null, recebidas: 0 }],
      AGORA
    );
    expect(d.esperam).toEqual(["c"]);
    expect(d.improvaveis).toBe(1);
  });

  it("quem recebe agora nunca conta como improvável, mesmo tendo falado uma vez", () => {
    const d = destinoDoLote([{ ig_id: "a", last_reply_at: HORAS(1), recebidas: 1 }], AGORA);
    expect(d.agora).toEqual(["a"]);
    expect(d.improvaveis).toBe(0);
  });

  it("lista vazia não estoura e não inventa ninguém", () => {
    expect(destinoDoLote([], AGORA)).toEqual({ agora: [], esperam: [], improvaveis: 0 });
  });
});

describe("loteExpirou", () => {
  it("sem prazo nunca expira", () => {
    expect(loteExpirou(null, AGORA)).toBe(false);
  });

  it("antes da data, vale; depois, não", () => {
    expect(loteExpirou("2026-09-02T12:00:00.000Z", AGORA)).toBe(false);
    expect(loteExpirou("2026-08-31T12:00:00.000Z", AGORA)).toBe(true);
  });

  // O CASO DA BORDA, e ele importa: a validade é o último instante em que a
  // mensagem ainda faz sentido. Expirar exatamente nela cancelaria um envio que
  // o dono considera válido.
  it("no instante exato da validade, ainda vale", () => {
    expect(loteExpirou(new Date(AGORA).toISOString(), AGORA)).toBe(false);
  });

  it("data inválida NÃO expira o lote, e isso é escolha", () => {
    // Tratar lixo como "expirado" cancelaria envios em silêncio. Tratar como
    // "sem prazo" mantém a mensagem viva, e o dono vê que ela não venceu.
    expect(loteExpirou("nao e uma data", AGORA)).toBe(false);
    expect(loteExpirou("", AGORA)).toBe(false);
  });
});

// ============================================================
// A COSTURA DO PAYLOAD, e ela mora aqui pelo mesmo motivo das portas de entrada:
// quem escreve e quem lê estão em arquivos diferentes, ligados por STRING. Um
// `s` a mais de um lado não é erro de tipo nem de lint — é um campo que volta
// vazio, e neste caso seria uma mensagem em branco para quarenta pessoas.
// ============================================================
describe("payloadDoLote e lerPayloadDoLote", () => {
  it("o que escreve, lê de volta igual", () => {
    const p = payloadDoLote({
      loteId: "L1",
      text: "A turma abre segunda",
      url: "https://exemplo.invalid/turma",
      buttonLabel: "Quero entrar",
      validoAte: "2026-09-10T00:00:00.000Z",
    });
    expect(lerPayloadDoLote(p)).toEqual({
      loteId: "L1",
      text: "A turma abre segunda",
      url: "https://exemplo.invalid/turma",
      buttonLabel: "Quero entrar",
      validoAte: "2026-09-10T00:00:00.000Z",
    });
  });

  it("sem link e sem prazo também volta igual", () => {
    const p = payloadDoLote({ loteId: "L2", text: "Segue o material", validoAte: null });
    const lido = lerPayloadDoLote(p);
    expect(lido?.text).toBe("Segue o material");
    expect(lido?.url).toBeUndefined();
    expect(lido?.validoAte).toBe(null);
  });

  // O DRENO LÊ `p.url` PARA DECIDIR O FORMATO DA MENSAGEM (lib/queue-drain.ts):
  // com url ele monta mensagem com botão; sem url, texto puro. Gravar a chave
  // com url vazia faria toda mensagem de lote virar botão para lugar nenhum.
  it("url em branco não vira chave `url` no payload", () => {
    const p = payloadDoLote({ loteId: "L3", text: "oi", url: "   ", validoAte: null });
    expect("url" in p).toBe(false);
  });

  // A DECISÃO, NÃO O DESCUIDO: rótulo sem link some do payload calado. É
  // seguro porque `lib/queue-drain.ts`, para item `dm_lote`, só lê
  // `p.button_label` dentro do ramo que exige `p.url` — sem url, o rótulo
  // nunca teria efeito no texto enviado mesmo se fosse gravado.
  it("rótulo sem url some do payload, e a leitura de volta não inventa um", () => {
    const p = payloadDoLote({ loteId: "L4", text: "oi", buttonLabel: "Quero entrar", validoAte: null });
    expect("button_label" in p).toBe(false);
    expect(lerPayloadDoLote(p)?.buttonLabel).toBeUndefined();
  });

  it("payload que não é do lote devolve null em vez de meia informação", () => {
    expect(lerPayloadDoLote(null)).toBe(null);
    expect(lerPayloadDoLote({})).toBe(null);
    expect(lerPayloadDoLote({ text: "sem lote_id" })).toBe(null);
    expect(lerPayloadDoLote("texto")).toBe(null);
  });
});

// ============================================================
// A URL DO BOTÃO, e o que acontece quando ela está errada.
//
// `payloadDoLote` só apara espaço — ela não valida formato. Uma url digitada
// errada ("htps://...", ou texto solto sem protocolo) viraria um botão
// apontando para lugar nenhum, e sairia para dezenas de pessoas de uma vez.
// ============================================================
describe("urlDeLoteValida", () => {
  it("aceita http e https bem formados", () => {
    expect(urlDeLoteValida("https://exemplo.invalid/turma")).toBe(true);
    expect(urlDeLoteValida("http://exemplo.invalid")).toBe(true);
  });

  it("recusa protocolo escrito errado", () => {
    expect(urlDeLoteValida("htps://exemplo.invalid")).toBe(false);
  });

  it("recusa texto sem protocolo nenhum", () => {
    expect(urlDeLoteValida("quero entrar")).toBe(false);
    expect(urlDeLoteValida("exemplo.invalid/turma")).toBe(false);
  });

  it("recusa protocolo que não é http nem https", () => {
    expect(urlDeLoteValida("javascript:alert(1)")).toBe(false);
  });
});

// ============================================================
// QUEM O PEDIDO ALCANÇA — a função que decide, agora fora da ação.
//
// As três coisas que a ação de `app/contatos/actions.ts` decidia sozinha
// viraram uma função só, e cada uma delas passava por lint, typecheck, 938
// testes puros e 70 de integração sem deixar uma linha vermelha:
//
//   1. O RECORTE. `?categoria=` ausente ("tudo") e `?categoria=` vazio ("sem
//      categoria") chegavam ao formulário pelo mesmo `<input type="hidden">`, e
//      um campo escondido SEMPRE existe no DOM: as duas viravam `""`, e a ação
//      as reconstruía como "tudo". A tela prometia 16 pessoas e a ação
//      enfileirava para 126.
//   2. A CONFIRMAÇÃO. Apagá-la da ação não deixava nada vermelho — sobrava só o
//      `required` do navegador, que um POST direto ignora.
//   3. A CONTA. Tirar o `account_id` do `where` não deixava nada vermelho.
//
// Elas moram juntas porque a resposta é uma só ("estas pessoas, ou ninguém") e
// porque a lista que sai daqui é a que vira mensagem para gente de verdade.
// ============================================================
describe("filtroDoCampo e campoDoFiltro", () => {
  it("o que a tela escreve, a ação lê de volta igual", () => {
    for (const filtro of [
      { tipo: "tudo" } as const,
      { tipo: "uma", nome: null } as const,
      { tipo: "uma", nome: "aluno" } as const,
    ]) {
      expect(filtroDoCampo(campoDoFiltro(filtro))).toEqual(filtro);
    }
  });

  // O DEFEITO INTEIRO, num caso: "tudo" e "sem categoria" TÊM de sair deste
  // par com formas diferentes. Enquanto os dois viajavam como `""`, a ficha
  // "sem categoria" mandava para a conta inteira.
  it("“tudo” e “sem categoria” não têm a mesma forma no campo", () => {
    expect(campoDoFiltro({ tipo: "tudo" })).not.toBe(
      campoDoFiltro({ tipo: "uma", nome: null })
    );
  });

  it("o nome da categoria chega normalizado, como na URL", () => {
    expect(filtroDoCampo("uma:  Aluno ")).toEqual({ tipo: "uma", nome: "aluno" });
  });

  // CAMPO QUE NÃO SE RECONHECE É RECUSA, E NÃO PALPITE. Um POST montado à mão,
  // ou um campo que alguém renomeou, não pode cair em "tudo" — é o balde de
  // maior alcance do produto.
  it("campo ausente, vazio ou estranho não vira filtro nenhum", () => {
    expect(filtroDoCampo(null)).toBe(null);
    expect(filtroDoCampo(undefined)).toBe(null);
    expect(filtroDoCampo("")).toBe(null);
    expect(filtroDoCampo("tudo:")).toBe(null);
    expect(filtroDoCampo("aluno")).toBe(null);
    expect(filtroDoCampo(7)).toBe(null);
  });
});

describe("alvoDoLote", () => {
  const LINHAS = [
    { ig_id: "1", account_id: "C1", categoria: "aluno" },
    { ig_id: "2", account_id: "C1", categoria: "interessado" },
    { ig_id: "3", account_id: "C1", categoria: null },
  ];

  it("sem filtro de categoria, alcança a conta inteira", () => {
    const alvo = alvoDoLote(LINHAS, {
      conta: "C1",
      filtro: { tipo: "tudo" },
      confirmado: true,
    });
    expect(alvo.map((c) => c.ig_id)).toEqual(["1", "2", "3"]);
  });

  // O CASO DO ACHADO CRÍTICO, com os números medidos: a ficha "sem categoria"
  // alcança QUEM NÃO TEM CATEGORIA, e não a conta inteira.
  it("a ficha “sem categoria” alcança só quem não tem categoria", () => {
    const alvo = alvoDoLote(LINHAS, {
      conta: "C1",
      filtro: { tipo: "uma", nome: null },
      confirmado: true,
    });
    expect(alvo.map((c) => c.ig_id)).toEqual(["3"]);
  });

  it("uma categoria alcança só ela", () => {
    const alvo = alvoDoLote(LINHAS, {
      conta: "C1",
      filtro: { tipo: "uma", nome: "aluno" },
      confirmado: true,
    });
    expect(alvo.map((c) => c.ig_id)).toEqual(["1"]);
  });

  // A ÚLTIMA COISA ENTRE UM ENGANO E QUARENTA PESSOAS. O `required` do
  // navegador não é defesa: um POST direto não passa por ele.
  it("sem a confirmação marcada, não alcança NINGUÉM", () => {
    expect(
      alvoDoLote(LINHAS, { conta: "C1", filtro: { tipo: "tudo" }, confirmado: false })
    ).toEqual([]);
  });

  // A CONTA VEM DO COOKIE, e a linha do banco tem de casar com ela. Se a
  // consulta parar de filtrar por conta, esta função ainda para o envio.
  it("linha de outra conta não entra no alvo", () => {
    const alvo = alvoDoLote(
      [...LINHAS, { ig_id: "9", account_id: "C2", categoria: "aluno" }],
      { conta: "C1", filtro: { tipo: "tudo" }, confirmado: true }
    );
    expect(alvo.map((c) => c.ig_id)).toEqual(["1", "2", "3"]);
  });

  it("filtro que não se reconheceu não alcança ninguém", () => {
    expect(
      alvoDoLote(LINHAS, { conta: "C1", filtro: null, confirmado: true })
    ).toEqual([]);
  });

  it("filtro que não casa ninguém devolve vazio em vez da conta inteira", () => {
    expect(
      alvoDoLote(LINHAS, {
        conta: "C1",
        filtro: { tipo: "uma", nome: "turma de setembro" },
        confirmado: true,
      })
    ).toEqual([]);
  });
});

// ============================================================
// O PRAZO QUE O DONO ESCOLHE, e o fuso que ele não escolhe.
//
// `<input type="date">` entrega "2026-09-07", e `new Date("2026-09-07")` lê isso
// como MEIA-NOITE UTC — que é 06/09 às 21:00 em São Paulo. O dono escolhia "vale
// até domingo dia 7" e a mensagem parava de valer no SÁBADO às 9 da noite: 27
// horas antes do que ele pediu.
//
// É o mesmo fuso que `diaDaChave` (lib/dedupe.ts) já resolve, pela mesma razão:
// aqui o fuso não é exibição, é COMPORTAMENTO — ele decide quando um envio é
// cancelado.
// ============================================================
describe("validadeDoDia", () => {
  it("o dia escolhido vale INTEIRO, até a meia-noite de Brasília", () => {
    // 00:00 do dia 8 em São Paulo = 03:00Z do dia 8.
    expect(validadeDoDia("2026-09-07")).toBe("2026-09-08T03:00:00.000Z");
  });

  // O DEFEITO INTEIRO, em um caso: no sábado às 21h01 (Brasília), um lote que
  // vale "até domingo dia 7" TEM de continuar valendo. Com `new Date(prazo)`
  // ele já estava vencido.
  it("no sábado à noite, o prazo de domingo ainda não venceu", () => {
    const sabadoDe21h01 = Date.parse("2026-09-06T21:01:00-03:00");
    expect(loteExpirou(validadeDoDia("2026-09-07"), sabadoDe21h01)).toBe(false);
    // A prova de que o caso mede alguma coisa: o valor ANTIGO já tinha vencido
    // nesse mesmo instante.
    expect(loteExpirou(new Date("2026-09-07").toISOString(), sabadoDe21h01)).toBe(true);
  });

  it("no último minuto do dia escolhido ainda vale; no dia seguinte, não", () => {
    expect(loteExpirou(validadeDoDia("2026-09-07"), Date.parse("2026-09-07T23:59:00-03:00"))).toBe(
      false
    );
    expect(loteExpirou(validadeDoDia("2026-09-07"), Date.parse("2026-09-08T00:01:00-03:00"))).toBe(
      true
    );
  });

  it("a virada do mês e a do ano não estouram", () => {
    expect(validadeDoDia("2026-09-30")).toBe("2026-10-01T03:00:00.000Z");
    expect(validadeDoDia("2026-12-31")).toBe("2027-01-01T03:00:00.000Z");
  });

  // CAMPO VAZIO É "SEM PRAZO", E LIXO TAMBÉM. `new Date("lixo").toISOString()`
  // LANÇA (RangeError), e um POST montado à mão derrubava a ação inteira.
  // `null` desce para `loteExpirou`, que já trata "sem prazo" como o que nunca
  // vence — a mesma escolha, pelo mesmo motivo: cancelar envio em silêncio é a
  // falha muda que este produto passou semanas fechando.
  it("vazio, lixo e data que não existe viram “sem prazo”, e não estouram", () => {
    expect(validadeDoDia("")).toBe(null);
    expect(validadeDoDia("   ")).toBe(null);
    expect(validadeDoDia("domingo")).toBe(null);
    expect(validadeDoDia("07/09/2026")).toBe(null);
    expect(validadeDoDia("2026-13-01")).toBe(null);
    expect(validadeDoDia("2026-02-30")).toBe(null);
  });
});
