import { describe, it, expect } from "vitest";
import {
  MAXIMO_DE_PERGUNTAS,
  LOCALE,
  acaoDaEscrita,
  conferirPerguntas,
  corpoDeApagar,
  corpoDeEscrita,
  perguntasDaResposta,
  identificadorSobrevive,
  perguntasQueNaoFicaram,
  CARACTERES_QUE_A_META_NAO_GUARDA,
} from "@/lib/perguntas-de-abertura";

// O QUE ESTE ARQUIVO PROTEGE é a regra da Meta para as perguntas de abertura.
//
// Ela nasceu dentro de `scripts/perguntas-de-abertura.mjs`, exercitada à mão
// contra a API, e nenhum harness deste projeto passava por ela. Ao virar módulo
// — porque a tela de Configuração precisa das mesmas três chamadas — o que é
// PURO nela ganhou rede: os corpos das chamadas, o limite e a leitura da
// resposta. O `fetch` continua sem teste, e continua sendo a única parte sem.

describe("o corpo do POST carrega o locale", () => {
  // O ACHADO INTEIRO DO EXPERIMENTO, e o único que a documentação da Meta OMITE.
  // Sem `locale`, a resposta é 400 com subcode 2534058. Um teste que só olhasse
  // `call_to_actions` deixaria apagar esta chave sem ficar vermelho.
  it("tem platform, locale e as perguntas na ordem em que chegaram", () => {
    const corpo = JSON.parse(
      corpoDeEscrita([
        { question: "Quero saber mais", payload: "AUTO:a1" },
        { question: "Quais são os valores?", payload: "AUTO:a2" },
      ])
    );
    expect(corpo.platform).toBe("instagram");
    expect(corpo.ice_breakers).toHaveLength(1);
    expect(corpo.ice_breakers[0].locale).toBe(LOCALE);
    expect(corpo.ice_breakers[0].call_to_actions).toEqual([
      { question: "Quero saber mais", payload: "AUTO:a1" },
      { question: "Quais são os valores?", payload: "AUTO:a2" },
    ]);
  });

  it("o locale é 'default', que é o valor que a Meta aceitou", () => {
    expect(LOCALE).toBe("default");
  });

  // A ORDEM É O PRODUTO: as posições aparecem na conversa na ordem do array, e
  // é essa ordem que a tela deixa o dono arrastar. Um corpo que ordenasse por
  // texto ou por identificador continuaria sendo aceito pela Meta.
  it("não reordena nada", () => {
    const perguntas = ["z", "a", "m"].map((s) => ({ question: s, payload: `AUTO:${s}` }));
    const corpo = JSON.parse(corpoDeEscrita(perguntas));
    expect(corpo.ice_breakers[0].call_to_actions.map((p: { question: string }) => p.question)).toEqual(
      ["z", "a", "m"]
    );
  });
});

describe("o corpo do DELETE apaga o campo inteiro", () => {
  // Não há como apagar uma pergunta só; é por isso que a tela reescreve as
  // quatro a cada gravação.
  it("nomeia ice_breakers e mais nada", () => {
    expect(JSON.parse(corpoDeApagar())).toEqual({ fields: ["ice_breakers"] });
  });
});

describe("lista vazia é DELETE, e não POST com zero perguntas", () => {
  // MEDIDO no formato do endpoint: `call_to_actions: []` não é nenhum dos dois
  // conjuntos de chaves que a Meta aceita. Sem esta decisão escrita, salvar a
  // tela com todas as linhas em branco viraria um 400 sem explicação.
  it("zero perguntas manda apagar", () => {
    expect(acaoDaEscrita([])).toBe("apagar");
  });
  it("uma pergunta já manda escrever", () => {
    expect(acaoDaEscrita([{ question: "Oi", payload: "AUTO:a1" }])).toBe("escrever");
  });
});

describe("a conferência recusa antes de gastar chamada", () => {
  it("o limite de quatro é da CONTA inteira", () => {
    const cinco = Array.from({ length: MAXIMO_DE_PERGUNTAS + 1 }, (_, i) => ({
      question: `p${i}`,
      payload: `auto-a${i}`,
    }));
    const { perguntas, motivo } = conferirPerguntas(cinco);
    expect(perguntas).toBeUndefined();
    expect(motivo).toContain("máximo");
    // O NÚMERO SAI DA CONSTANTE, e não do texto: um recado que dissesse "4" à
    // mão continuaria dizendo 4 se a Meta mudasse o limite.
    expect(motivo).toContain(String(MAXIMO_DE_PERGUNTAS));
  });

  it("quatro passa", () => {
    // Identificadores sem dois-pontos de propósito: com eles a conferência
    // recusaria por OUTRO motivo (ver "o identificador que a Meta engole", mais
    // abaixo), e este caso deixaria de medir o limite.
    const quatro = Array.from({ length: MAXIMO_DE_PERGUNTAS }, (_, i) => ({
      question: `p${i}`,
      payload: `auto-a${i}`,
    }));
    expect(conferirPerguntas(quatro).perguntas).toHaveLength(MAXIMO_DE_PERGUNTAS);
  });

  it("zero passa, porque zero é pedido legítimo", () => {
    expect(conferirPerguntas([]).perguntas).toEqual([]);
  });

  // Pergunta sem texto aparece EM BRANCO na conversa de todo mundo que abrir a
  // conta; pergunta sem identificador é pergunta que não responde ao toque.
  it("recusa texto vazio", () => {
    expect(conferirPerguntas([{ question: "   ", payload: "AUTO:a1" }]).motivo).toContain("texto");
  });
  it("recusa identificador vazio, e diz de qual pergunta", () => {
    const motivo = conferirPerguntas([{ question: "Quais os valores?", payload: "" }]).motivo;
    expect(motivo).toContain("identificador");
    expect(motivo).toContain("Quais os valores?");
  });

  it("apara o texto, porque espaço na ponta vira espaço na conversa", () => {
    expect(conferirPerguntas([{ question: "  Oi  ", payload: " auto-a1 " }]).perguntas).toEqual([
      { question: "Oi", payload: "auto-a1" },
    ]);
  });

  it("o que não é lista é recusado, e não tratado como lista vazia", () => {
    // Tratar como vazio seria APAGAR as perguntas da conta por causa de um
    // formulário malformado — o pior desfecho possível desta função.
    for (const lixo of [null, undefined, "AUTO:a1", 4, {}]) {
      const r = conferirPerguntas(lixo);
      expect(r.perguntas, String(lixo)).toBeUndefined();
      expect(r.motivo, String(lixo)).toBeTruthy();
    }
  });
});

describe("a leitura da resposta da Meta", () => {
  // FORMA MEDIDA contra @vannuchi.eng em 28/08/2026, copiada da resposta real.
  const REAL = {
    data: [
      {
        ice_breakers: [
          {
            locale: "default",
            call_to_actions: [
              { question: "Quando começa a próxima turma?", payload: "abertura-proxima-turma" },
              { question: "O que o curso cobre?", payload: "abertura-conteudo" },
              { question: "Quais são os valores?", payload: "abertura-valores" },
              { question: "Como faço a inscrição?", payload: "abertura-inscricao" },
            ],
          },
        ],
      },
    ],
  };

  it("lê as quatro na ordem em que a Meta as devolveu", () => {
    expect(perguntasDaResposta(REAL)).toEqual([
      { question: "Quando começa a próxima turma?", payload: "abertura-proxima-turma" },
      { question: "O que o curso cobre?", payload: "abertura-conteudo" },
      { question: "Quais são os valores?", payload: "abertura-valores" },
      { question: "Como faço a inscrição?", payload: "abertura-inscricao" },
    ]);
  });

  // O OUTRO FORMATO que a própria mensagem de erro da Meta declara válido:
  // `(question, payload)` solto, sem `call_to_actions` e sem `locale`. Quem
  // escreveu pelo painel da Meta pode ter gravado assim, e a tela lê da META —
  // devolver lista vazia aqui faria o dono acrescentar a quinta pergunta e
  // levar um 400 sem entender por quê.
  it("lê também a forma sem call_to_actions", () => {
    expect(
      perguntasDaResposta({
        data: [{ ice_breakers: [{ question: "Oi", payload: "AUTO:a1" }] }],
      })
    ).toEqual([{ question: "Oi", payload: "AUTO:a1" }]);
  });

  it("não filtra por locale, porque uma conta traduzida ainda ocupa as posições", () => {
    const traduzida = {
      data: [
        {
          ice_breakers: [
            { locale: "pt_BR", call_to_actions: [{ question: "Oi", payload: "AUTO:a1" }] },
            { locale: "default", call_to_actions: [{ question: "Hi", payload: "AUTO:a2" }] },
          ],
        },
      ],
    };
    expect(perguntasDaResposta(traduzida).map((p) => p.payload)).toEqual(["AUTO:a1", "AUTO:a2"]);
  });

  it("conta sem pergunta nenhuma devolve lista vazia, sem estourar", () => {
    for (const vazio of [{ data: [] }, { data: [{}] }, {}, null, undefined, { data: "nada" }]) {
      expect(perguntasDaResposta(vazio), JSON.stringify(vazio)).toEqual([]);
    }
  });

  it("item sem question ou sem payload é pulado, não vira pergunta em branco", () => {
    expect(
      perguntasDaResposta({
        data: [
          {
            ice_breakers: [
              {
                locale: "default",
                call_to_actions: [
                  { question: "Vale", payload: "AUTO:a1" },
                  { question: "Sem payload" },
                  { payload: "AUTO:a3" },
                  null,
                ],
              },
            ],
          },
        ],
      })
    ).toEqual([{ question: "Vale", payload: "AUTO:a1" }]);
  });
});

describe("o identificador que a Meta engole", () => {
  // MEDIDO EM 28/08/2026, com controle pareado na conta de teste
  // @saas.metodoia: a mesma string trocando um caractere só.
  //
  //   "AUTO:436412ba-…"  -> 200 success, e a leitura de volta traz a pergunta
  //                         SEM payload nenhum
  //   "AUTO-436412ba-…"  -> 200 success, e o payload volta inteiro
  //
  // Sem esta guarda, a tela põe no ar — para TODA pessoa que abrir a conversa
  // da conta — uma pergunta que não dispara nada, e diz "salvo ✓".
  it("dois-pontos não sobrevive", () => {
    expect(identificadorSobrevive("AUTO:436412ba-e0b8-4721-af41-a677aa3c03c8")).toBe(false);
    expect(identificadorSobrevive("a:b")).toBe(false);
  });

  it("barra vertical não sobrevive — ela TRUNCA, e isso é pior que sumir", () => {
    // `AUTO|x` volta como `AUTO`: um identificador diferente do que se mandou.
    expect(identificadorSobrevive("AUTO|x")).toBe(false);
  });

  it("o que foi medido sobrevivendo continua passando", () => {
    for (const p of ["ab", "AUTO_x", "AUTO%3Ax", "AUTO-436412ba", "abertura-saber-mais"]) {
      expect(identificadorSobrevive(p), p).toBe(true);
    }
  });

  it("a conferência recusa antes da chamada, e o recado diz o que aconteceria", () => {
    const { perguntas, motivo } = conferirPerguntas([
      { question: "Quero saber mais", payload: "AUTO:auto-1" },
    ]);
    expect(perguntas).toBeUndefined();
    expect(motivo).toContain("Quero saber mais");
    expect(motivo).toContain("sem disparar nada");
  });

  it("a lista de caracteres é uma só, e o recado a cita", () => {
    for (const c of CARACTERES_QUE_A_META_NAO_GUARDA) {
      expect(identificadorSobrevive(`x${c}y`), c).toBe(false);
    }
  });
});

describe("a leitura de volta conferida contra o que se mandou", () => {
  // A guarda acima cobre o que foi medido; esta cobre o que não foi. Um 200 da
  // Meta não é prova de nada — foi assim que o caso do dois-pontos apareceu.
  const a = { question: "A", payload: "auto-a" };
  const b = { question: "B", payload: "auto-b" };

  it("nada sumiu quando a leitura traz o mesmo", () => {
    expect(perguntasQueNaoFicaram([a, b], [a, b])).toEqual([]);
  });

  it("pergunta que a Meta não guardou aparece nomeada", () => {
    expect(perguntasQueNaoFicaram([a, b], [a])).toEqual([b]);
  });

  it("identificador trocado pela Meta conta como não ficou", () => {
    // O caso do `|`: a pergunta volta, o identificador volta TRUNCADO. Comparar
    // só o texto diria que está tudo certo.
    expect(perguntasQueNaoFicaram([b], [{ question: "B", payload: "auto" }])).toEqual([b]);
  });
});
