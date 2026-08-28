import { describe, it, expect } from "vitest";
import {
  GATILHO_DE_ABERTURA,
  TETO_DE_POSICOES,
  contaDoFormulario,
  escreverRascunho,
  formularioDasPortas,
  lerRascunho,
  linhasComRascunho,
  linhasDasPortas,
  linhasDoFormulario,
  opcoesDeAutomacao,
  perguntasDoFormulario,
  resumoDoLimite,
  LIGAR_FUNCIONA,
  type AutomacaoConhecida,
  type Linha,
} from "@/app/setup/portas";
import { MAXIMO_DE_PERGUNTAS, identificadorSobrevive } from "@/lib/perguntas-de-abertura";
import { PAYLOAD_SEM_AUTOMACAO, lerPayload, payloadDaPergunta } from "@/lib/steps";

// O QUE ESTE ARQUIVO PROTEGE é a tela das quatro portas de entrada.
//
// A suíte deste projeto NÃO TESTA COMPONENTE, e isso não vai mudar. Foi medido
// na fase: defeito plantado em três telas, 743 testes verdes. Toda decisão que
// mora no JSX é rede zero — então nenhuma decisão desta tela mora lá, e é este
// arquivo que as segura.

const OK: AutomacaoConhecida = {
  id: "a-viva",
  name: "Turma de setembro",
  active: true,
  triggers: [GATILHO_DE_ABERTURA],
};
const PAUSADA: AutomacaoConhecida = {
  id: "a-pausada",
  name: "Lista de espera",
  active: false,
  triggers: [GATILHO_DE_ABERTURA],
};
const OUTRO_GATILHO: AutomacaoConhecida = {
  id: "a-dm",
  name: "Palavra-chave preço",
  active: true,
  triggers: ["dm"],
};
const TODAS = [OK, PAUSADA, OUTRO_GATILHO];

describe("as quatro posições, na ordem em que o Instagram exibe", () => {
  it("conta vazia mostra as quatro posições livres, e não uma tela vazia", () => {
    const linhas = linhasDasPortas([], TODAS);
    expect(linhas).toHaveLength(MAXIMO_DE_PERGUNTAS);
    expect(linhas.map((l) => l.posicao)).toEqual([1, 2, 3, 4]);
    for (const l of linhas) {
      expect(l.texto).toBe("");
      expect(l.automacaoId).toBeNull();
      expect(l.aviso).toBeNull();
    }
  });

  it("preenche na ordem da Meta e completa o resto com posição livre", () => {
    const linhas = linhasDasPortas(
      [
        { question: "Primeira", payload: payloadDaPergunta(OK.id) },
        { question: "Segunda", payload: payloadDaPergunta(OK.id) },
      ],
      TODAS
    );
    // A ORDEM É O PRODUTO: é ela que a pessoa vê ao abrir a conversa. Ordenar
    // por texto ou por automação continuaria compilando.
    expect(linhas.map((l) => l.texto)).toEqual(["Primeira", "Segunda", "", ""]);
    expect(linhas).toHaveLength(MAXIMO_DE_PERGUNTAS);
  });

  it("conta com mais perguntas que o limite mostra TODAS, sem cortar", () => {
    // Uma conta com perguntas em vários idiomas tem quatro por idioma. Cortar
    // em quatro esconderia perguntas que estão no ar.
    const seis = Array.from({ length: 6 }, (_, i) => ({
      question: `p${i}`,
      payload: payloadDaPergunta(OK.id),
    }));
    expect(linhasDasPortas(seis, TODAS)).toHaveLength(6);
  });
});

describe("qual automação cada pergunta dispara — ou nenhuma", () => {
  it("aponta para automação viva com o gatilho certo: nome e nenhum aviso", () => {
    const [l] = linhasDasPortas([{ question: "Oi", payload: payloadDaPergunta(OK.id) }], TODAS);
    expect(l.automacaoId).toBe(OK.id);
    expect(l.dispara).toBe(OK.name);
    expect(l.aviso).toBeNull();
  });

  // O CASO QUE ESTÁ NO AR HOJE, em três contas de produção: as perguntas de
  // teste usam `abertura-...`, escolhido de propósito para que `lerPayload`
  // devolva null e nada dispare. A tela tem de lidar com elas sem quebrar, e
  // "não aponta para automação nenhuma" é a resposta CERTA — é o que elas
  // fazem. Uma tela que estourasse aqui, ou que as mostrasse como se
  // disparassem algo, seria pior que não existir.
  it("identificador de outro formato aparece como 'não dispara nada'", () => {
    const [l] = linhasDasPortas(
      [{ question: "Quais são os valores?", payload: "abertura-valores" }],
      TODAS
    );
    expect(l.automacaoId).toBeNull();
    expect(l.dispara).toBe("Não dispara nada");
    expect(l.aviso?.grau).toBe("aviso");
    // O TEXTO CRU SOBREVIVE: é ele que o formulário devolve intacto quando o
    // dono salva sem mexer nesta linha.
    expect(l.payload).toBe("abertura-valores");
  });

  it("automação apagada da conta vira erro, porque quem tocar não recebe nada", () => {
    const [l] = linhasDasPortas([{ question: "Oi", payload: payloadDaPergunta("sumiu") }], TODAS);
    expect(l.automacaoId).toBeNull();
    expect(l.dispara).toBe("Não dispara nada");
    expect(l.aviso?.grau).toBe("erro");
  });

  // `loadAutomation` (lib/engine.ts) exige `active = true`: pausada é silêncio
  // do mesmo jeito, e o dono precisa ver a diferença entre as duas causas.
  it("automação pausada mostra o nome e um erro que diz o motivo", () => {
    const [l] = linhasDasPortas([{ question: "Oi", payload: payloadDaPergunta(PAUSADA.id) }], TODAS);
    expect(l.automacaoId).toBe(PAUSADA.id);
    expect(l.dispara).toBe(PAUSADA.name);
    expect(l.aviso?.grau).toBe("erro");
    expect(l.aviso?.texto).toContain("pausada");
  });

  // O motor EXECUTA mesmo com o gatilho trocado, de propósito, e registra
  // `abertura_com_gatilho_trocado`. Marcar isto como erro faria a tela dizer
  // que não funciona uma coisa que funciona.
  it("gatilho trocado é aviso, não erro — ela roda assim mesmo", () => {
    const [l] = linhasDasPortas(
      [{ question: "Oi", payload: payloadDaPergunta(OUTRO_GATILHO.id) }],
      TODAS
    );
    expect(l.automacaoId).toBe(OUTRO_GATILHO.id);
    expect(l.dispara).toBe(OUTRO_GATILHO.name);
    expect(l.aviso?.grau).toBe("aviso");
  });

  it("os quatro problemas se distinguem — não é um sim/não", () => {
    const linhas = linhasDasPortas(
      [
        { question: "a", payload: payloadDaPergunta(OK.id) },
        { question: "b", payload: "abertura-antiga" },
        { question: "c", payload: payloadDaPergunta("sumiu") },
        { question: "d", payload: payloadDaPergunta(PAUSADA.id) },
      ],
      TODAS
    );
    const textos = linhas.map((l) => l.aviso?.texto ?? "sem aviso");
    expect(new Set(textos).size).toBe(4);
  });
});

describe("o limite de quatro é da CONTA, e a tela diz isso antes do erro da Meta", () => {
  it("conta vazia diz quantas posições existem no total", () => {
    const r = resumoDoLimite(0);
    expect(r.livres).toBe(MAXIMO_DE_PERGUNTAS);
    expect(r.cheio).toBe(false);
    expect(r.texto).toContain(String(MAXIMO_DE_PERGUNTAS));
  });

  it("conta o que sobra, no singular quando é uma", () => {
    expect(resumoDoLimite(3).livres).toBe(1);
    expect(resumoDoLimite(3).texto).toContain("1 livre");
    expect(resumoDoLimite(2).texto).toContain("2 livres");
  });

  it("cheia diz que não cabe mais nenhuma", () => {
    const r = resumoDoLimite(MAXIMO_DE_PERGUNTAS);
    expect(r.cheio).toBe(true);
    expect(r.livres).toBe(0);
    expect(r.acima).toBe(false);
  });

  it("acima do limite não afirma '0 livres', diz que está sobrando", () => {
    const r = resumoDoLimite(MAXIMO_DE_PERGUNTAS + 2);
    expect(r.acima).toBe(true);
    expect(r.cheio).toBe(false);
    expect(r.texto).toContain("acima do limite");
  });

  it("o número sai da constante, e não digitado no texto", () => {
    expect(resumoDoLimite(0).maximo).toBe(MAXIMO_DE_PERGUNTAS);
  });
});

describe("do formulário para a Meta", () => {
  const linha = (texto: string, automacaoId = "", payload = "") => ({ texto, automacaoId, payload });

  it("escolher automação escreve o identificador de verdade", () => {
    const { perguntas } = perguntasDoFormulario([linha("Quero saber mais", OK.id)]);
    expect(perguntas).toEqual([
      { question: "Quero saber mais", payload: payloadDaPergunta(OK.id) },
    ]);
  });

  it("linha em branco some, e é assim que se tira uma pergunta do ar", () => {
    const { perguntas } = perguntasDoFormulario([
      linha("Fica", OK.id),
      linha("   ", "", "abertura-antiga"),
      linha("", ""),
    ]);
    expect(perguntas).toEqual([{ question: "Fica", payload: payloadDaPergunta(OK.id) }]);
  });

  // A LINHA QUE PROTEGE PRODUÇÃO. Três contas têm perguntas `abertura-...` no
  // ar. Salvar a tela para mexer na posição 4 NÃO PODE reescrever nem apagar as
  // outras três — sem herdar o identificador, `payload` sairia vazio e a
  // gravação recusaria (ou, pior, escreveria uma pergunta sem destino).
  it("quem não escolheu automação fica com o identificador que já estava lá", () => {
    const { perguntas, motivo } = perguntasDoFormulario([
      linha("Quais são os valores?", "", "abertura-valores"),
      linha("Nova", OK.id),
    ]);
    expect(motivo).toBeUndefined();
    expect(perguntas).toEqual([
      { question: "Quais são os valores?", payload: "abertura-valores" },
      { question: "Nova", payload: payloadDaPergunta(OK.id) },
    ]);
  });

  it("escolher automação numa linha antiga TROCA o identificador antigo", () => {
    const { perguntas } = perguntasDoFormulario([
      linha("Quais são os valores?", OK.id, "abertura-valores"),
    ]);
    expect(perguntas).toEqual([
      { question: "Quais são os valores?", payload: payloadDaPergunta(OK.id) },
    ]);
  });

  // O CASO QUE A SPEC NOMEIA COM TODAS AS LETRAS: "uma pergunta que não dispara
  // automação nenhuma. 'Quais são os valores?' pode ser só uma pergunta que o
  // dono responde à mão — e ainda assim vale estar no menu."
  //
  // Ele era EXIBÍVEL e não CRIÁVEL: o seletor oferece "Nenhuma automação" e a
  // coluna imprime "Não dispara nada" para as perguntas que já existem, mas
  // salvar recusava com "precisa apontar para uma automação". A tela oferecendo
  // o que o salvar nega é a mesma doença que esta branch fechou na paleta.
  it("pergunta sem automação nenhuma é CRIÁVEL — a spec a nomeia", () => {
    const { perguntas, motivo } = perguntasDoFormulario([linha("Quais são os valores?")]);
    expect(motivo).toBeUndefined();
    expect(perguntas).toEqual([
      { question: "Quais são os valores?", payload: PAYLOAD_SEM_AUTOMACAO },
    ]);
  });

  // AS TRÊS COISAS QUE O IDENTIFICADOR INERTE TEM DE SER, e nenhuma delas é
  // opinião: sem elas a pergunta ou não fica na Meta, ou dispara alguma coisa,
  // ou aparece na tela pintada de vermelho.
  it("o identificador inerte sobrevive à Meta, não dispara nada e não é erro", () => {
    const [p] = perguntasDoFormulario([linha("Quais são os valores?")]).perguntas!;
    // 1. A Meta guarda: sem `:` e sem `|`.
    expect(identificadorSobrevive(p.payload)).toBe(true);
    // 2. O MOTOR não vê automação nenhuma nele — é `lerPayload` quem decide, e
    //    é a mesma função que `handleMessagingEvent` chama.
    expect(lerPayload(p.payload)).toBeNull();
    // 3. E a TELA o reconhece como escolha, e não como pergunta estranha: sem
    //    aviso nenhum. Se ele começasse por `ABERTURA_`, esta linha seria o
    //    vermelho "aponta para uma automação que não existe mais nesta conta".
    const [l] = linhasDasPortas([p], TODAS);
    expect(l.dispara).toBe("Não dispara nada");
    expect(l.aviso).toBeNull();
    expect(l.automacaoId).toBeNull();
  });

  it("a pergunta inerte sobrevive a um Salvar que não a tocou", () => {
    const { perguntas } = perguntasDoFormulario([
      linha("Quais são os valores?", "", PAYLOAD_SEM_AUTOMACAO),
      linha("Nova", OK.id),
    ]);
    expect(perguntas?.[0].payload).toBe(PAYLOAD_SEM_AUTOMACAO);
  });

  // A OUTRA METADE DA MESMA HONESTIDADE: pôr o seletor em "Nenhuma automação"
  // numa pergunta que este painel ligou tem de DESLIGAR. Quem separa este caso
  // da herança é o formulário — `formularioDasPortas` não manda o identificador
  // herdado das linhas que o seletor sabe representar —, e é por isso que o
  // caso está medido a partir do formulário, e não desta função sozinha.
  it("tirar a automação de uma pergunta ligada desliga mesmo", () => {
    const ligada = [{ question: "Quero saber mais", payload: payloadDaPergunta(OK.id) }];
    const form = formularioDasPortas("conta", linhasDasPortas(ligada, TODAS));
    // O seletor representa a linha, então o payload herdado NÃO vai no
    // formulário: mandá-lo faria a herança vencer a escolha do dono.
    expect(form.linhas[0].automacao.valor).toBe(OK.id);
    expect(form.linhas[0].payload.valor).toBe("");

    // O dono põe o seletor em "Nenhuma automação".
    const { perguntas } = perguntasDoFormulario([
      { texto: "Quero saber mais", automacaoId: "", payload: form.linhas[0].payload.valor },
    ]);
    expect(perguntas).toEqual([
      { question: "Quero saber mais", payload: PAYLOAD_SEM_AUTOMACAO },
    ]);
  });

  // E A REGRA 3 CONTINUA DE PÉ, que é a linha que protege produção: três contas
  // têm perguntas `abertura-...` no ar, o painel não as entende, o seletor não
  // as representa — então o identificador delas VAI no formulário e é herdado.
  it("o identificador que o painel não entende continua sendo herdado", () => {
    const antiga = [{ question: "Quais são os valores?", payload: "abertura-valores" }];
    const form = formularioDasPortas("conta", linhasDasPortas(antiga, TODAS));
    expect(form.linhas[0].payload.valor).toBe("abertura-valores");
    const { perguntas } = perguntasDoFormulario([
      { texto: "Quais são os valores?", automacaoId: "", payload: form.linhas[0].payload.valor },
    ]);
    expect(perguntas?.[0].payload).toBe("abertura-valores");
  });

  it("automação escolhida sem texto é recusada, e o recado diz a posição", () => {
    const { motivo } = perguntasDoFormulario([linha("Primeira", OK.id), linha("", OK.id)]);
    expect(motivo).toContain("posição 2");
  });

  it("apara o texto antes de mandar para a Meta", () => {
    const { perguntas } = perguntasDoFormulario([linha("  Oi  ", OK.id)]);
    expect(perguntas?.[0].question).toBe("Oi");
  });

  it("tudo em branco devolve lista vazia — que é o pedido de apagar", () => {
    expect(perguntasDoFormulario([linha(""), linha(""), linha(""), linha("")]).perguntas).toEqual([]);
  });
});

// ===========================================================================
// A COSTURA DE NOMES ENTRE A TELA E A AÇÃO.
//
// POR QUE ESTE BLOCO EXISTE, e a razão é medida: cinco desencontros entre o
// `name=` que o JSX escreve e o `formData.get()` que a ação pede foram plantados
// e passaram por `tsc`, por `eslint`, pelos 805 puros e pelos 56 de integração —
// os cinco verdes. O pior deles fazia toda linha voltar em branco, a lista sair
// vazia, `acaoDaEscrita` traduzir isso em DELETE, e a conta perder o campo
// `ice_breakers` inteiro com a tela dizendo "ficou sem pergunta de abertura
// nenhuma ✓".
//
// O CASO DE INTEGRAÇÃO NÃO ALCANÇAVA ISSO, e não por descuido: ele começa em
// `perguntasDoFormulario(...)`, que é função pura, e nunca atravessa o
// `FormData`. A travessia é o que está medido aqui, com um `FormData` DE
// VERDADE, montado a partir do descritor que o JSX desenha — o que a tela manda,
// campo por campo, e não uma lista remontada por este arquivo.
// ===========================================================================
describe("o que a TELA escreve é o que a AÇÃO lê", () => {
  const CONTA = "17800000000000222";

  /**
   * O formulário como o navegador o manda: um `FormData` montado a partir de
   * `formularioDasPortas`, que é exatamente o que o JSX desenha. Nenhum nome de
   * campo é digitado aqui — digitá-los seria este arquivo concordando consigo
   * mesmo sobre a costura que ele existe para medir.
   */
  function comoOFormularioManda(linhas: Linha[]): FormData {
    const f = new FormData();
    const form = formularioDasPortas(CONTA, linhas);
    f.set(form.conta.nome, form.conta.valor);
    f.set(form.posicoes.nome, form.posicoes.valor);
    for (const l of form.linhas) {
      f.set(l.texto.nome, l.texto.valor);
      f.set(l.automacao.nome, l.automacao.valor);
      f.set(l.payload.nome, l.payload.valor);
    }
    return f;
  }

  const NO_AR = [
    { question: "Quero saber mais", payload: payloadDaPergunta(OK.id) },
    { question: "Quais são os valores?", payload: "abertura-valores" },
    { question: "Como funciona?", payload: payloadDaPergunta(PAUSADA.id) },
  ];

  it("a conta atravessa o formulário", () => {
    expect(contaDoFormulario(comoOFormularioManda(linhasDasPortas([], TODAS)))).toBe(CONTA);
  });

  it("cada posição volta com o texto, a automação e o payload dela", () => {
    const { linhas, motivo } = linhasDoFormulario(
      comoOFormularioManda(linhasDasPortas(NO_AR, TODAS))
    );
    expect(motivo).toBeUndefined();
    expect(linhas).toHaveLength(MAXIMO_DE_PERGUNTAS);
    expect(linhas!.map((l) => l.texto)).toEqual([
      "Quero saber mais",
      "Quais são os valores?",
      "Como funciona?",
      "",
    ]);
    // O SELETOR DE CADA POSIÇÃO, e a segunda é a que distingue "leu o campo
    // certo" de "leu o campo de outra linha": a do meio não aponta para
    // automação nenhuma deste painel.
    expect(linhas!.map((l) => l.automacaoId)).toEqual([OK.id, "", PAUSADA.id, ""]);
    // O IDENTIFICADOR HERDADO SÓ ATRAVESSA O FORMULÁRIO QUANDO O SELETOR NÃO
    // SABE DIZÊ-LO. As posições 1 e 3 o seletor representa (a automação está na
    // lista da conta, pausada inclusive), e o "Salvar" reconstrói o
    // identificador delas a partir da escolha; a 2 ele não representa, e é
    // justamente essa que precisa herdar para não ser reescrita. Ver a regra 4
    // de `perguntasDoFormulario`.
    expect(linhas!.map((l) => l.payload)).toEqual(["", "abertura-valores", "", ""]);
  });

  // O CASO QUE CUSTA A CONTA INTEIRA. Salvar sem mexer em nada tem de devolver à
  // Meta exatamente o que estava lá. Qualquer desencontro de nome faz esta lista
  // sair VAZIA — e lista vazia é o pedido legítimo de apagar tudo.
  it("salvar sem mexer em nada devolve as MESMAS perguntas, e nunca a lista vazia", () => {
    const { linhas } = linhasDoFormulario(comoOFormularioManda(linhasDasPortas(NO_AR, TODAS)));
    const { perguntas, motivo } = perguntasDoFormulario(linhas!);
    expect(motivo).toBeUndefined();
    expect(perguntas).toEqual(NO_AR);
    expect(perguntas).not.toEqual([]);
  });

  // A CONTA MULTI-IDIOMA: a Meta devolve quatro perguntas POR IDIOMA, a tela
  // desenha as seis, e o formulário tem de dizer SEIS. Fixar este número em
  // `MAXIMO_DE_PERGUNTAS` faria o "Salvar" apagar calado tudo da quinta em
  // diante — e o dono veria "2 perguntas no ar ✓" depois de perder quatro.
  it("conta com mais perguntas que o limite manda TODAS as posições", () => {
    const seis = Array.from({ length: 6 }, (_, i) => ({
      question: `p${i}`,
      payload: payloadDaPergunta(OK.id),
    }));
    const { linhas } = linhasDoFormulario(comoOFormularioManda(linhasDasPortas(seis, TODAS)));
    expect(linhas).toHaveLength(6);
    expect(perguntasDoFormulario(linhas!).perguntas).toHaveLength(6);
  });

  it("o dono editando UMA posição não mexe nas outras", () => {
    const f = comoOFormularioManda(linhasDasPortas(NO_AR, TODAS));
    // A posição 4 estava livre; o dono escreve nela e escolhe uma automação.
    const form = formularioDasPortas(CONTA, linhasDasPortas(NO_AR, TODAS));
    f.set(form.linhas[3].texto.nome, "Tem desconto?");
    f.set(form.linhas[3].automacao.nome, OUTRO_GATILHO.id);

    const { linhas } = linhasDoFormulario(f);
    const { perguntas } = perguntasDoFormulario(linhas!);
    expect(perguntas).toEqual([
      ...NO_AR,
      { question: "Tem desconto?", payload: payloadDaPergunta(OUTRO_GATILHO.id) },
    ]);
  });

  // FORMULÁRIO QUE NÃO DIZ QUANTAS POSIÇÕES MANDOU É RECUSADO, e não vira "zero
  // posições". Medido: `Number("abc")` é `NaN`, e o `Math.min(Math.max(0, NaN))`
  // que estava aqui também é `NaN` — o laço rodava zero vezes e o "Salvar"
  // virava o DELETE do campo inteiro anunciado com ✓.
  it("formulário sem posições legíveis é recusado, e não vira apagar tudo", () => {
    for (const valor of ["abc", "", "  ", "2.5", "-1", "0", "1e3x"]) {
      const f = new FormData();
      f.set("conta", CONTA);
      f.set("posicoes", valor);
      const { linhas, motivo } = linhasDoFormulario(f);
      expect(linhas, `posicoes=${JSON.stringify(valor)} devolveu lista`).toBeUndefined();
      expect(motivo).toBeTruthy();
    }
  });

  it("o campo `posicoes` que falta inteiro também é recusado", () => {
    const f = new FormData();
    f.set("conta", CONTA);
    expect(linhasDoFormulario(f).linhas).toBeUndefined();
  });

  // O TETO É DO SERVIDOR. Um formulário adulterado dizendo 5000 posições não
  // pode fazer o servidor montar 5000 linhas.
  it("o número que veio do navegador é cortado pelo teto do servidor", () => {
    const f = new FormData();
    f.set("conta", CONTA);
    f.set("posicoes", "5000");
    expect(linhasDoFormulario(f).linhas).toHaveLength(TETO_DE_POSICOES);
  });
});

// ===========================================================================
// A RECUSA NÃO PODE CUSTAR O RESTO DO FORMULÁRIO.
//
// A ação responde a toda recusa com `redirect("/setup?erro=…")`, e a tela
// recarrega DA META. O dono que reescreve as quatro perguntas e erra uma delas
// perdia as outras três — e lia o motivo do erro numa tela que já tinha voltado
// ao que estava antes.
// ===========================================================================
describe("o rascunho: o que o dono escreveu volta com a recusa", () => {
  const CONTA = "17800000000000222";
  const OUTRA = "17800000000000111";

  const escritas = [
    { texto: "Quero saber mais", automacaoId: OK.id, payload: "" },
    { texto: "Quais são os valores?", automacaoId: "", payload: "" },
    { texto: "", automacaoId: OUTRO_GATILHO.id, payload: "" }, // a que causa a recusa
    { texto: "", automacaoId: "", payload: "" },
  ];

  function comORascunho(conta: string, linhas: typeof escritas) {
    return linhasComRascunho(
      linhasDasPortas([], TODAS),
      TODAS,
      lerRascunho(escreverRascunho(conta, linhas)),
      CONTA
    );
  }

  it("as três posições que o dono escreveu voltam na tela", () => {
    const linhas = comORascunho(CONTA, escritas);
    expect(linhas.map((l) => l.texto)).toEqual(["Quero saber mais", "Quais são os valores?", "", ""]);
    // E a posição que causou a recusa volta COM a automação escolhida, para o
    // recado ("escreva a pergunta ou tire a automação") ter do que falar.
    expect(linhas[2].automacaoId).toBe(OUTRO_GATILHO.id);
    expect(linhas[0].automacaoId).toBe(OK.id);
  });

  // O QUE A TELA REDESENHA TEM DE SER O QUE O SALVAR SEGUINTE VAI ESCREVER:
  // as duas pontas passam por `payloadDaLinha`. Redesenhar com outra regra faria
  // a tela mostrar um destino e a gravação escrever outro.
  it("o destino redesenhado é o mesmo que a gravação escreveria", () => {
    const linhas = comORascunho(CONTA, escritas);
    expect(linhas[0].payload).toBe(payloadDaPergunta(OK.id));
    expect(linhas[0].dispara).toBe(OK.name);
    // A pergunta sem automação volta como o que ela é: inerte, e sem aviso.
    expect(linhas[1].payload).toBe(PAYLOAD_SEM_AUTOMACAO);
    expect(linhas[1].aviso).toBeNull();
  });

  // O RASCUNHO É DE UMA CONTA SÓ, e a tela desenha todas as conectadas. Sem
  // isto, o "Salvar" recusado de uma conta reescreveria a tela da outra com as
  // perguntas da primeira.
  it("o rascunho de outra conta não encosta nesta", () => {
    const daMeta = linhasDasPortas([{ question: "A que está no ar", payload: "abertura-x" }], TODAS);
    const linhas = linhasComRascunho(
      daMeta,
      TODAS,
      lerRascunho(escreverRascunho(OUTRA, escritas)),
      CONTA
    );
    expect(linhas).toEqual(daMeta);
  });

  // O QUE CHEGA É TEXTO DE URL, e portanto não é confiável. Tudo que não for
  // exatamente o esperado tem de virar `null` — e `null` faz a tela desenhar o
  // que a Meta diz, que é o comportamento de sempre.
  it("qualquer coisa torta na URL vira nada, e a tela volta a ser a da Meta", () => {
    const tortos: unknown[] = [
      undefined,
      "",
      "{",
      "null",
      '"texto"',
      "[]",
      JSON.stringify({ linhas: [] }),
      JSON.stringify({ conta: CONTA }),
      JSON.stringify({ conta: 7, linhas: [] }),
      JSON.stringify({ conta: CONTA, linhas: [{ texto: 1, automacaoId: "", payload: "" }] }),
      JSON.stringify({ conta: CONTA, linhas: [{ texto: "a", payload: "" }] }),
      JSON.stringify({ conta: CONTA, linhas: Array(50).fill({ texto: "a", automacaoId: "", payload: "" }) }),
      JSON.stringify({ conta: CONTA, linhas: [{ texto: "a".repeat(5000), automacaoId: "", payload: "" }] }),
    ];
    for (const t of tortos) {
      expect(lerRascunho(t), `${String(t).slice(0, 40)} passou`).toBeNull();
    }
    const daMeta = linhasDasPortas([], TODAS);
    expect(linhasComRascunho(daMeta, TODAS, lerRascunho("{"), CONTA)).toEqual(daMeta);
  });

  // Um `Location` de cabeçalho não é lugar para carga arbitrária: rascunho que
  // não cabe é perdido de propósito, e o dono vê o motivo da recusa em vez de um
  // erro de infraestrutura.
  it("rascunho grande demais não vai para a URL", () => {
    const enorme = Array.from({ length: 8 }, () => ({
      texto: "x".repeat(900),
      automacaoId: "",
      payload: "",
    }));
    expect(escreverRascunho(CONTA, enorme)).toBeNull();
    expect(escreverRascunho(CONTA, escritas)).toBeTruthy();
  });
});

describe("o seletor oferece todas as automações, e marca as que divergem", () => {
  // Oferecer só as de gatilho `abertura` é a armadilha: o motor não confere
  // gatilho ao entrar por identificador, então uma automação de outro gatilho
  // apontada por engano continuaria disparando — e não estaria na lista para o
  // dono desapontar.
  it("nenhuma automação da conta fica de fora", () => {
    expect(opcoesDeAutomacao(TODAS).map((o) => o.id)).toEqual(TODAS.map((a) => a.id));
  });

  it("a pausada e a de outro gatilho vêm marcadas no rótulo", () => {
    const rotulos = new Map(opcoesDeAutomacao(TODAS).map((o) => [o.id, o.rotulo]));
    expect(rotulos.get(OK.id)).toBe(OK.name);
    expect(rotulos.get(PAUSADA.id)).toContain("pausada");
    expect(rotulos.get(OUTRO_GATILHO.id)).toContain("gatilho");
  });
});

describe("a tela DEIXOU de recusar, e não foi editada para isso", () => {
  // A HISTÓRIA INTEIRA, porque ela é a razão de este bloco existir.
  //
  // Até 28/08/2026 `payloadDaPergunta` emitia `AUTO:<automação>`, e a Meta come
  // o dois-pontos: o `messenger_profile` responde 200 `{"result":"success"}` e
  // some com a pergunta. A tela recusava ANTES da chamada, com o motivo
  // escrito, e dizia na abertura da seção que ligar estava indisponível.
  //
  // A forma mudou (`ABERTURA_<automação>`, lib/steps.ts, medida contra a Meta
  // com controle pareado) e A RECUSA SAIU SOZINHA. Nenhuma linha de
  // `app/setup/portas.ts` nem de `portas-de-entrada.tsx` foi editada para isso
  // — `LIGAR_FUNCIONA` é derivado das duas regras, e era exatamente esta a
  // promessa. O que mudou aqui foi só o que este arquivo AFIRMAVA sobre o dia
  // de ontem.
  it("a resposta é CALCULADA das duas regras, e não escrita à mão", () => {
    // A linha que não mudou, e é a que segura a promessa nos dois sentidos: se
    // alguém devolver `payloadDaPergunta` a uma forma que a Meta não guarda, a
    // recusa volta sozinha do mesmo jeito que saiu.
    expect(LIGAR_FUNCIONA).toBe(identificadorSobrevive(payloadDaPergunta("qualquer-id")));
  });

  it("hoje ela é VERDADEIRA, e é porque a forma perdeu o dois-pontos", () => {
    // Os dois caracteres, e não só o dois-pontos: o `|` é pior, porque TRUNCA
    // em vez de sumir — `AUTO|x` volta como `AUTO`, um identificador diferente
    // do que se mandou.
    expect(payloadDaPergunta("x")).not.toContain(":");
    expect(payloadDaPergunta("x")).not.toContain("|");
    expect(LIGAR_FUNCIONA).toBe(true);
  });

  it("o conselho de escolher automação aparece, agora que ele funciona", () => {
    // Mandar "escolha uma automação" enquanto a ligação estava bloqueada era
    // fazer o dono descobrir no clique — o mesmo defeito que o limite de quatro
    // evita. O conselho continua amarrado a `LIGAR_FUNCIONA`, e a segunda linha
    // é a que registra que ele agora APARECE de verdade.
    const [l] = linhasDasPortas([{ question: "Antiga", payload: "abertura-valores" }], TODAS);
    expect(l.aviso?.texto.includes("Escolha uma automação")).toBe(LIGAR_FUNCIONA);
    expect(l.aviso?.texto).toContain("Escolha uma automação");
  });

  it("uma pergunta ligada pela tela passa a apontar para a automação", () => {
    // PONTA A PONTA DO LADO PURO, e é o que estava impossível: a tela monta o
    // identificador (`perguntasDoFormulario`), e `linhasDasPortas` — que lê pelo
    // motor, `lerPayload` — o reconhece de volta como aquela automação, sem
    // aviso nenhum. Antes desta parte, este caso não existia: a gravação
    // recusava antes de chegar aqui.
    const { perguntas, motivo } = perguntasDoFormulario([
      { texto: "Quero saber mais", automacaoId: OK.id, payload: "" },
    ]);
    expect(motivo).toBe(undefined);
    expect(perguntas!.length).toBe(1);
    // E ele SOBREVIVE À META, que é a conferência que a gravação faz antes de
    // gastar a chamada. Era aqui que a tela parava.
    expect(identificadorSobrevive(perguntas![0].payload)).toBe(true);
    const [l] = linhasDasPortas(perguntas!, TODAS);
    expect(l.automacaoId).toBe(OK.id);
    expect(l.dispara).toBe(OK.name);
    expect(l.aviso).toBe(null);
  });
});
