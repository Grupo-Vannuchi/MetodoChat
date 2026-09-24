import { describe, it, expect } from "vitest";
import { CAMPOS, campoPorChave, type Campo } from "@/lib/campos";
import { fichaDoColetado, type ContatoDaFicha } from "@/lib/ficha-do-coletado";

// ============================================================
// O QUE A FICHA DA CONVERSA MOSTRA — quais campos, em que ordem, com que
// rótulo, e QUANDO cada um foi coletado.
//
// POR QUE ESTA LÓGICA É PURA, E NÃO MORA NA PÁGINA: `app/conversas/[id]/page.tsx`
// é um componente `async` que consulta o Postgres, e caso nenhum de `testes-dom/`
// consegue montá-lo. Escrita lá dentro, a regra nasceria sem rede — é o mesmo
// movimento que `app/contatos/faixa-da-exportacao.tsx` fez, e o cabeçalho
// daquele arquivo conta o preço medido de não o ter feito antes.
//
// A ARMADILHA CENTRAL DESTE ARQUIVO é a data. Nove contatos em produção têm o
// e-mail no registro com `em` = o instante em que a migração `012` rodou, e não
// a data em que o e-mail foi coletado — o próprio arquivo da migração diz, com
// todas as letras, que aquela data é um SUBSTITUTO e não um fato. Uma ficha que
// dissesse "coletado em <data da migração>" para essas pessoas estaria mentindo,
// e seria a sexta tela desta funcionalidade a afirmar o contrário da verdade.
//
// O DISCRIMINADOR É A CHAVE `automacao`, e não a data: a `012` NÃO a grava,
// `gravarCampo` (lib/engine.ts) SEMPRE a grava — com `null` quando não há
// automação de origem, mas grava. Os dois casos do bloco "a data" abaixo são as
// duas pontas disso, e o segundo (`automacao: null` É coleta de verdade) existe
// porque a leitura ingênua — perguntar pelo VALOR da chave em vez da presença
// dela — erra justamente para o lado contrário, chamando de migrado quem foi
// coletado.
// ============================================================

// A data de uma coleta DE VERDADE, cravada: nada aqui mede recência, então não
// há `Date.now()` por perto para apodrecer o caso (dois testes desta base
// ficaram vermelhos sozinhos por cravar data, em 21/09/2026 — e a cura foi
// justamente parar de comparar com o relógio).
const EM = "2026-09-20T10:00:00Z";

/** Um campo COLETADO pelo motor: `gravarCampo` sempre grava a chave `automacao`. */
const coletado = (valor: string, automacao: string | null = "a-1") => ({
  valor,
  em: EM,
  automacao,
});

/** Um campo MIGRADO pela `012`: a chave `automacao` NÃO existe no registro. */
const migrado = (valor: string, em: string = "2026-09-24T09:00:00Z") => ({ valor, em });

function contato(p: Partial<ContatoDaFicha> = {}): ContatoDaFicha {
  return { email: null, campos: {}, ...p };
}

/** Um catálogo de mentira, com os rótulos e a ordem escolhidos pelo caso. */
function catalogoDe(...pares: [chave: string, rotulo: string][]): Campo[] {
  return pares.map(([chave, rotulo]) => {
    const real = campoPorChave(chave);
    if (!real) throw new Error(`o catálogo de mentira citou um campo que não existe: ${chave}`);
    return { ...real, rotulo };
  });
}

describe("quais campos entram na ficha", () => {
  it("mostra só o que a pessoa tem — campo não coletado não vira linha vazia", () => {
    const itens = fichaDoColetado(
      contato({ campos: { telefone: coletado("11999998888") } })
    );
    expect(itens.map((i) => i.chave)).toEqual(["telefone"]);
    expect(itens[0].valor).toBe("11999998888");
  });

  it("a pessoa sem nada coletado devolve lista vazia — e não um item em branco", () => {
    expect(fichaDoColetado(contato())).toEqual([]);
    // `campos` nulo é o que o banco devolve para quem nunca passou por coleta
    // nenhuma; `lerCampos` (lib/campos.ts) já o trata, e aqui o que se prende é
    // que a ficha não estoura no caminho.
    expect(fichaDoColetado(contato({ campos: null }))).toEqual([]);
  });

  it("valor em branco no registro não vira item — célula cheia sem nada dentro é pior que ausência", () => {
    const itens = fichaDoColetado(contato({ campos: { telefone: coletado("   ") } }));
    expect(itens).toEqual([]);
  });

  // A GUARDA DO CAMPO SEM VARIÁVEL, EXERCIDA — e ela existe aqui pelo mesmo
  // motivo que existe em `colunasDoCatalogo` (lib/exportacao-de-contatos.ts): o
  // valor de um campo do catálogo sai da `resolve` da variável dele, e um campo
  // que não esteja em `VARIABLES` não tem de onde tirar valor nenhum. Em
  // produção isso não acontece — `VARIABLES` é GERADA de `CAMPOS`, e o caso
  // "todo campo do catálogo tem variável" (tests/variables.test.ts) prende isso
  // —, mas o catálogo é parâmetro, e este caso é o que impede a guarda de ficar
  // sem ninguém que a exerça: guarda que nenhum caso alcança é guarda que a
  // próxima limpeza leva embora, e a limpeza aqui seria um `!` mentindo para o
  // compilador.
  it("campo de catálogo sem variável não vira linha — e não derruba a ficha", () => {
    const inventado: Campo = { ...campoPorChave("telefone")!, chave: "cor_favorita" };
    const itens = fichaDoColetado(
      contato({ campos: { cor_favorita: coletado("azul"), telefone: coletado("11999998888") } }),
      [inventado]
    );
    // `cor_favorita` some: ela ESTÁ no catálogo recebido (então não é campo
    // livre) e não tem variável (então não há valor a mostrar). `telefone`
    // aparece como campo LIVRE — este catálogo de mentira não o contém, e campo
    // livre é lido direto do registro, sem passar por variável nenhuma.
    expect(itens.map((i) => i.chave)).toEqual(["telefone"]);
  });
});

describe("a ordem e o rótulo saem do catálogo", () => {
  // O PLANTIO QUE ESTE CASO ACUSA: ordenar a ficha por qualquer outra coisa que
  // não a ordem declarada em `CAMPOS` — alfabética, ordem do `jsonb`, ordem de
  // coleta. O catálogo tem quatro campos e nenhum caso pode fazê-lo ter outros,
  // então a ordem é cobrada aqui contra um catálogo DE MENTIRA, invertido: com a
  // ordem escrita à mão no código, um caso que comparasse com `CAMPOS` passaria
  // igual, porque as duas listas hoje coincidem. É a mesma razão pela qual
  // `colunasDoCsvCompleto` (lib/exportacao-de-contatos.ts) recebe o catálogo.
  it("segue a ordem do catálogo que recebeu, e não uma ordem própria", () => {
    const campos = {
      nascimento: coletado("1990-02-01"),
      email: coletado("ana@email.com"),
      telefone: coletado("11999998888"),
    };
    const invertido = catalogoDe(
      ["nascimento", "Nascimento"],
      ["telefone", "Telefone"],
      ["email", "E-mail"]
    );
    expect(fichaDoColetado(contato({ campos }), invertido).map((i) => i.chave)).toEqual([
      "nascimento",
      "telefone",
      "email",
    ]);
  });

  it("com o catálogo de verdade, a ordem é a dele — e não a alfabética", () => {
    const campos = Object.fromEntries(CAMPOS.map((c) => [c.chave, coletado("x")]));
    expect(fichaDoColetado(contato({ campos })).map((i) => i.chave)).toEqual(
      CAMPOS.map((c) => c.chave)
    );
  });

  // O PLANTIO QUE ESTE CASO ACUSA: o rótulo escrito à mão na ficha ("Telefone",
  // "E-mail") em vez de lido do catálogo. Com o rótulo de mentira, quem escreve
  // o nome no código devolve o nome de sempre e fica vermelho aqui.
  it("o rótulo é o do catálogo, e não um nome escrito na ficha", () => {
    const itens = fichaDoColetado(
      contato({ campos: { telefone: coletado("11999998888") } }),
      catalogoDe(["telefone", "RÓTULO QUE SÓ ESTE CASO CONHECE"])
    );
    expect(itens[0].rotulo).toBe("RÓTULO QUE SÓ ESTE CASO CONHECE");
  });

  // O `rotulo` CHEIO, E NÃO O `nomeCurto`: o comentário do `nomeCurto`
  // (lib/campos.ts) nomeia as TRÊS telas estreitas do editor para as quais ele
  // existe, e a ficha da conversa não é nenhuma delas. É a mesma escolha que o
  // seletor de variáveis e a planilha já fizeram, pelo mesmo argumento — o que
  // não é tela apertada lê o nome cheio, e é a barra de "Telefone / WhatsApp"
  // que diz para que aquele número serve.
  it("usa o rótulo cheio, e não o nome curto das telas estreitas", () => {
    const telefone = campoPorChave("telefone")!;
    const itens = fichaDoColetado(contato({ campos: { telefone: coletado("11999998888") } }));
    expect(itens[0].rotulo).toBe(telefone.rotulo);
    // A guarda do caso: os dois nomes PRECISAM ser diferentes, senão ele passaria
    // por coincidência e não por medição.
    expect(telefone.rotulo).not.toBe(telefone.nomeCurto);
  });
});

describe("os campos livres", () => {
  it("vêm depois do catálogo, em ordem alfabética", () => {
    const itens = fichaDoColetado(
      contato({
        campos: {
          qual_sua_cidade: coletado("Osasco"),
          telefone: coletado("11999998888"),
          como_conheceu: coletado("Instagram"),
        },
      })
    );
    expect(itens.map((i) => i.chave)).toEqual(["telefone", "como_conheceu", "qual_sua_cidade"]);
  });

  // A PERDA, MEDIDA E ESCRITA: o marketing digitou "Qual sua cidade?" no editor,
  // e o que está gravado em `contacts.campos` é `qual_sua_cidade` — a
  // interrogação, a maiúscula e os espaços não estão em lugar nenhum daquela
  // coluna. A ficha mostra a CHAVE, que é o que existe. Reconstruir o texto
  // original cruzando com `automations.steps` seria fragilidade disfarçada de
  // esperteza: a automação pode ter sido editada ou apagada depois da coleta.
  // É a mesma decisão, com o mesmo motivo, que o cabeçalho da planilha tomou.
  it("o rótulo do campo livre é a chave normalizada — o texto que o dono digitou não existe no banco", () => {
    const itens = fichaDoColetado(contato({ campos: { qual_sua_cidade: coletado("Osasco") } }));
    expect(itens[0].rotulo).toBe("qual_sua_cidade");
  });

  it("campo livre em branco também não vira item", () => {
    expect(fichaDoColetado(contato({ campos: { qual_sua_cidade: coletado("  ") } }))).toEqual([]);
  });
});

describe("a data: coletado de verdade x migrado da coluna antiga", () => {
  it("a coleta de verdade leva o instante em que aconteceu", () => {
    const itens = fichaDoColetado(contato({ campos: { telefone: coletado("11999998888") } }));
    expect(itens[0].em).toBe(EM);
  });

  // O PLANTIO CENTRAL DESTA TAREFA: devolver `registro.em` sem olhar a chave
  // `automacao`. Com ele, os nove contatos migrados em produção passariam a ter
  // na ficha uma data de coleta que ninguém nunca mediu — a data em que a
  // migração rodou, vestida de fato.
  it("o registro MIGRADO não tem data de coleta — o `em` dele é um substituto", () => {
    const itens = fichaDoColetado(contato({ campos: { email: migrado("ana@email.com") } }));
    expect(itens[0].valor).toBe("ana@email.com");
    expect(
      itens[0].em,
      "o registro sem a chave `automacao` veio da migração 012, e o `em` dele é o " +
        "instante em que a migração rodou — não a data da coleta. A ficha não pode " +
        "prometer uma data que não existe."
    ).toBe(null);
  });

  // A PONTA CONTRÁRIA, e ela é tão fácil de errar quanto a primeira: perguntar
  // pelo VALOR de `automacao` (`registro.automacao != null`) em vez da PRESENÇA
  // da chave chamaria de migrado todo campo coletado fora de uma automação — que
  // `gravarCampo` grava com `automacao: null`, mas grava.
  it("coleta com `automacao: null` continua sendo coleta de verdade", () => {
    const itens = fichaDoColetado(
      contato({ campos: { telefone: coletado("11999998888", null) } })
    );
    expect(
      itens[0].em,
      "`gravarCampo` (lib/engine.ts) grava `automacao: null` quando não há automação " +
        "de origem — a CHAVE está lá, e é a presença dela que diz que a data é real."
    ).toBe(EM);
  });
});

describe("o e-mail da coluna antiga", () => {
  // `contacts.email` continua sendo escrita e lida em paralelo (a remoção é da
  // Parte 2), e a queda do registro para a coluna JÁ TEM DONA: é a `resolve` da
  // variável do e-mail, em lib/variables.ts, a mesma que a mensagem enviada e a
  // planilha usam. A ficha a reúsa em vez de reescrevê-la — uma segunda leitura
  // aqui divergiria da primeira na primeira mudança, e a tela passaria a dizer
  // sobre o e-mail algo diferente do que a DM entrega.
  it("aparece na ficha quando o registro não o tem", () => {
    const itens = fichaDoColetado(contato({ email: "antigo@email.com" }));
    expect(itens.map((i) => i.chave)).toEqual(["email"]);
    expect(itens[0].valor).toBe("antigo@email.com");
  });

  it("não promete data nenhuma: a coluna nunca guardou quando o e-mail chegou", () => {
    expect(fichaDoColetado(contato({ email: "antigo@email.com" }))[0].em).toBe(null);
  });

  it("o registro ganha da coluna — e a data que vai junto é a do registro", () => {
    const itens = fichaDoColetado(
      contato({ email: "antigo@email.com", campos: { email: coletado("novo@email.com") } })
    );
    expect(itens[0].valor).toBe("novo@email.com");
    expect(itens[0].em).toBe(EM);
  });

  // A BORDA QUE JUNTA AS DUAS REGRAS: registro EM BRANCO com a coluna cheia. O
  // valor mostrado é o da COLUNA (é o que `resolve` devolve), então a data do
  // registro não fala sobre ele — ela é de um valor que a tela não está
  // mostrando. Sem esta guarda, a ficha diria "coletado em <data>" ao lado de um
  // e-mail que veio de outro lugar.
  it("registro em branco com a coluna cheia: mostra a coluna, e sem data", () => {
    const itens = fichaDoColetado(
      contato({ email: "antigo@email.com", campos: { email: coletado("  ") } })
    );
    expect(itens[0].valor).toBe("antigo@email.com");
    expect(itens[0].em).toBe(null);
  });

  // A queda é SÓ do e-mail, e isso não é escolha desta ficha: é o que
  // `lib/variables.ts` decide, porque só o e-mail tem coluna paralela.
  it("nenhum outro campo do catálogo cai para coluna nenhuma", () => {
    expect(fichaDoColetado(contato({ email: "antigo@email.com" })).map((i) => i.chave)).toEqual([
      "email",
    ]);
  });
});
