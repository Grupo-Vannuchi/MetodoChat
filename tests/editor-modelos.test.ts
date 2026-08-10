import { describe, it, expect } from "vitest";
import { blocoNovo, comoTexto, resumoDoBloco } from "../app/automacoes/editor/modelos";
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
