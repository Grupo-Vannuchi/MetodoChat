import { describe, it, expect } from "vitest";
import {
  alcasDeSaida,
  blocoNovo,
  comoTexto,
  indiceDaAlca,
  resumoDoBloco,
} from "../app/automacoes/editor/modelos";
import { conferirLista, type Passo } from "../lib/steps";

// O QUE ESTE ARQUIVO FIXA: `resumoDoBloco` é TOTAL sobre jsonb.
//
// Ele recebe `Passo`, mas `Passo` ali é uma AFIRMAÇÃO de `passosDoBanco`
// (app/automacoes/[id]/page.tsx) sobre um `unknown` vindo do banco — nada
// confere a forma dos campos em runtime. Uma queda aqui não é um nó feio: é a
// desestruturação de `{ titulo, corpo }` derrubando o nó e, com ele, a página
// inteira do editor. Quem perdeu o acesso perdeu junto a chance de consertar o
// bloco que causou a queda.
//
// O molde `as unknown as Passo` é o ponto de cada teste, e não um atalho de
// tipo: ele é exatamente o que a página faz ao afirmar que aquele jsonb é um
// `Passo`.
const doBanco = (o: unknown) => o as unknown as Passo;

describe("resumoDoBloco não derruba a página com o que está no banco", () => {
  it("resposta pública SEM `textos` tem título e corpo, em vez de estourar", () => {
    // O caso nomeado pela revisão: `{tipo:"resposta_publica"}` tem tipo
    // desenhável, passa por `passosDoBanco` inteiro, e `p.textos.join(" · ")`
    // estourava. A função existe para impedir esse desfecho, e ela não impedia.
    const r = resumoDoBloco(doBanco({ tipo: "resposta_publica" }));
    expect(r.titulo).toBe("RESPOSTA PÚBLICA");
    expect(r.corpo).toBe("");
  });

  it("campo de texto que não é texto vira string vazia, e não filho de React inválido", () => {
    // `corpo` é desenhado direto como filho no nó (`no.tsx`). Um objeto ali
    // derruba o render do mesmo jeito que o `.join` derrubava.
    expect(resumoDoBloco(doBanco({ tipo: "dm", texto: { a: 1 } })).corpo).toBe("");
    expect(resumoDoBloco(doBanco({ tipo: "reagir_story", emoji: null })).corpo).toBe("");
    expect(resumoDoBloco(doBanco({ tipo: "pedir_email" })).corpo).toBe("");
  });

  it("`esperar` com minutos estranho não estoura — o template é total", () => {
    // Sem guarda de propósito: `${p.minutos} minutos` é total para todo valor
    // que o JSON produz. O teste fixa a demonstração.
    expect(resumoDoBloco(doBanco({ tipo: "esperar" })).corpo).toBe("undefined minutos");
    expect(resumoDoBloco(doBanco({ tipo: "esperar", minutos: 60 })).corpo).toBe("60 minutos");
  });

  it("TIPO DESCONHECIDO aparece nomeado, em vez de sumir", () => {
    // A correção do item 6, e ela é o mesmo argumento do bloco incompleto: sem
    // o ramo padrão, o `switch` devolvia `undefined` e a única saída era
    // `passosDoBanco` FILTRAR o bloco — ou seja, apagá-lo do banco no primeiro
    // salvamento, calado. Com o ramo, ele é desenhado.
    const r = resumoDoBloco(doBanco({ tipo: "ramificar" }));
    expect(r.titulo).toBe("BLOCO DESCONHECIDO");
    expect(r.corpo).toContain("ramificar");
  });

  it("e a perda dele é NOMEADA: `conferirLista` acende erro e trava o salvar", () => {
    // A outra metade da mesma decisão. Desenhar o bloco só vale a pena porque a
    // conferência fala sobre ele — é isso que troca "apagado em silêncio" por
    // "o dono decide".
    const problemas = conferirLista([{ id: "b_abc123", tipo: "ramificar" }], "dm");
    expect(problemas.filter((p) => p.nivel === "erro")).toHaveLength(1);
    expect(problemas[0].indice).toBe(0);
  });
});

describe("resumoDoBloco classifica a `dm` pela CHAVE `url`", () => {
  // A convenção inteira está em `modelos.ts`. Aqui ficam as três formas, porque
  // ler o VALOR em vez da chave intitularia MENSAGEM COM BOTÃO justamente o
  // bloco em que `conferirLista` acende "link sem endereço".
  it("chave presente e vazia continua sendo MENSAGEM COM LINK", () => {
    const r = resumoDoBloco(doBanco({ tipo: "dm", texto: "t", botao_label: "Abrir", url: "" }));
    expect(r.titulo).toBe("MENSAGEM COM LINK");
  });

  it("rótulo sem a chave é MENSAGEM COM BOTÃO", () => {
    const r = resumoDoBloco(doBanco({ tipo: "dm", texto: "t", botao_label: "Quero" }));
    expect(r.titulo).toBe("MENSAGEM COM BOTÃO");
  });

  it("sem rótulo e sem chave é MENSAGEM", () => {
    expect(resumoDoBloco(doBanco({ tipo: "dm", texto: "t" })).titulo).toBe("MENSAGEM");
  });
});

describe("blocoNovo", () => {
  it("os oito itens da paleta nascem desenháveis", () => {
    // Se um item novo da paleta produzisse um tipo que `resumoDoBloco` não
    // conhece, ele nasceria como "BLOCO DESCONHECIDO" — visível, mas com o
    // salvar travado desde o arrasto.
    const chaves = [
      "dm",
      "dm_botao",
      "dm_link",
      "esperar",
      "pedir_follow",
      "pedir_email",
      "resposta_publica",
      "reagir_story",
    ];
    for (const chave of chaves) {
      expect(resumoDoBloco(blocoNovo(chave)).titulo).not.toBe("BLOCO DESCONHECIDO");
    }
  });
});

// A COERÇÃO QUE O PAINEL DO BLOCO USA (`comoTexto`), e ela é exportada por causa
// dele. O painel passava `passo.texto` cru para `../variable-picker`, que faz
// `value.includes("{{")` no corpo do componente — um bloco vindo do jsonb sem
// `texto` string derrubava a ROTA INTEIRA no instante em que alguém o
// SELECIONAVA, e não há `error.tsx` em lugar nenhum sob `app/`. Selecionar o
// bloco incompleto para consertá-lo é justamente o que `passosDoBanco`
// (app/automacoes/[id]/page.tsx) deixa acontecer de propósito.
describe("comoTexto", () => {
  it("tudo o que o jsonb produz e não é string vira texto vazio", () => {
    // A lista é o que um campo pode ser depois de um `JSON.parse`: a chave
    // ausente, nulo, número, booleano, lista e objeto.
    for (const v of [undefined, null, 0, 7, false, true, [], ["a"], {}, { a: 1 }]) {
      expect(comoTexto(v)).toBe("");
    }
  });

  it("string passa inteira, inclusive vazia e só com espaços", () => {
    // Não é `trim` nem placeholder: o que a pessoa digitou é o que ela vê no
    // campo. Quem recusa o texto em branco é `conferir` (lib/steps.ts).
    expect(comoTexto("Oi {{first_name}}")).toBe("Oi {{first_name}}");
    expect(comoTexto("")).toBe("");
    expect(comoTexto("   ")).toBe("   ");
  });
});

// ---------------------------------------------------------------------------
// AS ALÇAS DE SAÍDA (Tarefa 6). O mesmo cuidado do resto deste arquivo vale
// aqui: `alcasDeSaida` recebe um `Passo` que é uma AFIRMAÇÃO sobre jsonb, e uma
// queda dela derruba o nó e a página.
// ---------------------------------------------------------------------------
describe("alcasDeSaida", () => {
  it("bloco sem botões tem uma alça só, a de continuação", () => {
    for (const p of [
      { tipo: "dm", texto: "oi" },
      { tipo: "dm", texto: "oi", botao_label: "Quero" },
      { tipo: "esperar", minutos: 5 },
      { tipo: "pedir_follow", texto: "segue", botao_label: "Já sigo" },
      { tipo: "pedir_email", texto: "email" },
    ]) {
      const alcas = alcasDeSaida(doBanco(p));
      expect(alcas).toHaveLength(1);
      expect(alcas[0].chave).toBe("sempre");
      expect(alcas[0].rotulo).toBe("");
    }
  });

  it("bloco com botões tem uma alça por botão, mais a do “senão”", () => {
    const alcas = alcasDeSaida(
      doBanco({
        tipo: "dm",
        texto: "Escolha",
        botoes: [
          { id: "op_1", rotulo: "Quero" },
          { id: "op_2", rotulo: "Não quero" },
        ],
      })
    );
    expect(alcas.map((a) => a.chave)).toEqual(["botao:op_1", "botao:op_2", "senao"]);
    expect(alcas.map((a) => a.rotulo)).toEqual(["Quero", "Não quero", "digitou"]);
  });

  // A CHAVE `url` MANDA (`envioDaDm`): o motor envia isto como LINK e nunca olha
  // `botoes`. Três alças aqui seriam três caminhos que ninguém percorre.
  it("mensagem com link não ganha alça de botão, mesmo com `botoes` preenchido", () => {
    const alcas = alcasDeSaida(
      doBanco({
        tipo: "dm",
        texto: "link",
        url: "https://x",
        botoes: [{ id: "op_1", rotulo: "Quero" }],
      })
    );
    expect(alcas.map((a) => a.chave)).toEqual(["sempre"]);
  });

  it("botão sem texto ganha um nome, para a alça não ficar anônima", () => {
    const alcas = alcasDeSaida(
      doBanco({ tipo: "dm", texto: "x", botoes: [{ id: "op_1", rotulo: "   " }] })
    );
    expect(alcas[0].rotulo).toBe("sem texto");
  });

  it("botão corrompido não derruba a tela: ele é pulado", () => {
    const alcas = alcasDeSaida(
      doBanco({ tipo: "dm", texto: "x", botoes: [null, { id: "op_1", rotulo: "Ok" }, 7] })
    );
    expect(alcas.map((a) => a.chave)).toEqual(["botao:op_1", "senao"]);
  });

  it("lista de botões sem nenhum aproveitável volta para a alça de continuação", () => {
    const alcas = alcasDeSaida(doBanco({ tipo: "dm", texto: "x", botoes: [null, {}] }));
    expect(alcas.map((a) => a.chave)).toEqual(["sempre"]);
  });
});

describe("indiceDaAlca", () => {
  const menu = doBanco({
    tipo: "dm",
    texto: "Escolha",
    botoes: [
      { id: "op_1", rotulo: "A" },
      { id: "op_2", rotulo: "B" },
    ],
  });

  it("acha a alça de cada condição", () => {
    expect(indiceDaAlca(menu, { tipo: "botao", botao: "op_1" })).toBe(0);
    expect(indiceDaAlca(menu, { tipo: "botao", botao: "op_2" })).toBe(1);
    expect(indiceDaAlca(menu, { tipo: "senao" })).toBe(2);
  });

  // A seta de um botão apagado continua desenhada, presa à primeira alça. Sumir
  // com ela esconderia do dono o que `conferirLista` ainda enxerga.
  it("condição sem alça cai na primeira, em vez de sumir", () => {
    expect(indiceDaAlca(menu, { tipo: "botao", botao: "op_apagado" })).toBe(0);
    expect(indiceDaAlca(menu, { tipo: "sempre" })).toBe(0);
  });
});
