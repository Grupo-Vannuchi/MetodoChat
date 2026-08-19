import { describe, it, expect } from "vitest";
import {
  alcasDeSaida,
  blocoNovo,
  comoTexto,
  indiceDaAlca,
  PALETA,
  resumoDoBloco,
} from "../app/automacoes/editor/modelos";
import {
  conferirLista,
  desligarBotao,
  envioDaDm,
  desligarSenao,
  ligacaoEscolhida,
  ligar,
  novoIdDeBotao,
  podeFicarAtiva,
  seguinteDe,
  type Passo,
} from "../lib/steps";

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

// A VIZINHA DA CONVENÇÃO (Tarefa 7): o MENU é classificado pela FORMA
// (`envioDaDm`), e não pela chave. O motivo está por extenso em `modelos.ts`, e
// é o que estes três casos fixam — em especial o do meio, que é o único jeito de
// a diferença entre chave e forma aparecer.
describe("resumoDoBloco classifica o MENU pela FORMA", () => {
  it("bloco com botões é MENSAGEM COM OPÇÕES", () => {
    const r = resumoDoBloco(doBanco({ tipo: "dm", texto: "t", botoes: [{ id: "op_1", rotulo: "A" }] }));
    expect(r.titulo).toBe("MENSAGEM COM OPÇÕES");
  });

  it("lista de botões VAZIA volta a ser MENSAGEM: é texto puro que sai", () => {
    // Pela CHAVE este bloco seria "MENSAGEM COM OPÇÕES", e a tela prometeria um
    // menu que o motor não manda — sem nada acusando, porque `botoesCrus`
    // aceita `[]`.
    expect(resumoDoBloco(doBanco({ tipo: "dm", texto: "t", botoes: [] })).titulo).toBe("MENSAGEM");
    expect(
      conferirLista([{ id: "b_abc123", tipo: "dm", texto: "t", botoes: [] }], "dm")
    ).toEqual([]);
  });

  it("com `url` de verdade continua sendo MENSAGEM COM LINK, e é o que o motor envia", () => {
    const r = resumoDoBloco(
      doBanco({ tipo: "dm", texto: "t", url: "https://x", botoes: [{ id: "op_1", rotulo: "A" }] })
    );
    expect(r.titulo).toBe("MENSAGEM COM LINK");
    // "É O QUE O MOTOR ENVIA" VALE PARA URL DE VERDADE, e não para a chave
    // `url` em si — a frase daqui generalizava além do caso testado. Medido:
    // com `url: ""` o título é o MESMO "MENSAGEM COM LINK" e `envioDaDm`
    // devolve `{forma:"botoes"}`, ou seja o resumo e o motor discordam. Não é
    // defeito a consertar: `conferirLista` trava o SALVAR desse bloco ("Esta
    // mensagem com link está sem endereço…") e o painel não tem gesto que
    // produza a chave `url` num menu. É canto de dado vindo de fora, e está
    // aqui para a frase acima não valer mais do que mediu.
    const vazia = doBanco({ tipo: "dm", texto: "t", url: "", botoes: [{ id: "op_1", rotulo: "A" }] });
    expect(resumoDoBloco(vazia).titulo).toBe("MENSAGEM COM LINK");
    expect(envioDaDm(vazia as never).forma).toBe("botoes");
    expect(
      conferirLista(
        [{ id: "b_abc12345", tipo: "dm", texto: "t", url: "", botoes: [{ id: "op_1", rotulo: "A" }] }],
        "dm"
      ).filter((p) => p.nivel === "erro" && p.quando === "salvar")
    ).toHaveLength(1);
  });

  it("com rótulo E botões ganha o título do MENU, na mesma ordem de `envioDaDm`", () => {
    const r = resumoDoBloco(
      doBanco({ tipo: "dm", texto: "t", botao_label: "Quero", botoes: [{ id: "op_1", rotulo: "A" }] })
    );
    expect(r.titulo).toBe("MENSAGEM COM OPÇÕES");
  });
});

describe("blocoNovo", () => {
  it("os nove itens da paleta nascem desenháveis", () => {
    // Se um item novo da paleta produzisse um tipo que `resumoDoBloco` não
    // conhece, ele nasceria como "BLOCO DESCONHECIDO" — visível, mas com o
    // salvar travado desde o arrasto.
    const chaves = [
      "dm",
      "dm_botao",
      "dm_link",
      "dm_opcoes",
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

  // A LISTA DA PALETA E O `switch` SÃO A MESMA COISA, e este teste é o que
  // impede um item novo de cair no ramo padrão em silêncio — que é como ele
  // viraria uma "Mensagem" comum, com o nome certo na faixa e o bloco errado no
  // quadro.
  //
  // "dm" FICA DE FORA da comparação, e não por conveniência: o ramo padrão
  // devolve exatamente o bloco de "dm" de propósito, então ele é o único item da
  // paleta indistinguível do padrão. É a chave cujo item já é o padrão.
  it("toda chave da PALETA tem ramo próprio: nenhuma cai no padrão", () => {
    const padrao = blocoNovo("chave-que-nao-existe");
    for (const item of PALETA) {
      if (item.chave === "dm") continue;
      expect({ ...blocoNovo(item.chave), id: "" }).not.toEqual({ ...padrao, id: "" });
    }
  });

  // O ITEM DESTA TAREFA. Ele é o primeiro — e hoje o único — lugar do sistema
  // que ESCREVE `botoes`: até aqui o motor, a conferência e as alças do quadro
  // liam a chave e nada a gravava.
  describe("dm_opcoes", () => {
    const menu = blocoNovo("dm_opcoes");
    const botoes = menu.tipo === "dm" ? menu.botoes : undefined;

    it("nasce com DOIS botões, cada um com id próprio e rótulo escrito", () => {
      expect(botoes).toHaveLength(2);
      expect(botoes?.[0].id).not.toBe(botoes?.[1].id);
      for (const b of botoes ?? []) {
        expect(b.id).toMatch(/^op_/);
        expect(b.rotulo.trim()).not.toBe("");
      }
    });

    it("não semeia `botao_label` nem `url` — é a vizinha da convenção", () => {
      expect(menu.tipo === "dm" && menu.botao_label).toBeUndefined();
      expect(menu.tipo === "dm" && menu.url).toBeUndefined();
    });

    it("nasce SEM erro e SEM aviso de conteúdo: só falta ligar os braços", () => {
      // Um bloco recém-criado é o único da lista, então ele é a entrada e as
      // regras de grafo ficam caladas (não há seta nenhuma). O que este teste
      // fixa é que o CONTEÚDO do menu nasce inteiro: nada de rótulo em branco,
      // nada de menu de um botão só.
      expect(conferirLista([menu], "dm")).toEqual([]);
    });

    it("dois blocos criados na mesma sessão não compartilham id de botão", () => {
      // O id do botão é o que casa com a ligação do braço. Repetido entre dois
      // blocos ele não quebra nada por si (a ligação também traz o bloco), mas é
      // exatamente o tipo de coincidência que faz uma medição parecer certa.
      const outro = blocoNovo("dm_opcoes");
      const ids = new Set([
        ...(botoes ?? []).map((b) => b.id),
        ...((outro.tipo === "dm" && outro.botoes) || []).map((b) => b.id),
      ]);
      expect(ids.size).toBe(4);
    });
  });
});

// ---------------------------------------------------------------------------
// OS GESTOS DO PAINEL DE BOTÕES (Tarefa 7), NO DADO.
//
// O QUE ESTE BLOCO É E O QUE ELE NÃO É: ele refaz, com as mesmas funções puras
// que o painel chama, a sequência que a conferência à mão pediu — criar pela
// paleta, ligar um braço, renomear, acrescentar, apagar. NÃO é prova de tela:
// não há render aqui, e a suíte deste projeto não testa componente. O que ele
// fixa é que o DADO que cada gesto escreve é o que o motor e a conferência leem.
//
// O gesto de renomear é `{...botao, rotulo}` — o mesmo objeto com o rótulo
// trocado, que é literalmente o que o `onChange` do campo grava.
//
// O QUE O SEGUNDO TESTE NÃO ACUSA, e a frase que estava aqui dizia que sim:
// alguém trocar aquele `onChange` por "monta um botão novo com o rótulo
// digitado". Ele refaz o gesto À MÃO, então uma troca no componente passa por
// ele intocada — é a mesma ressalva do parágrafo acima, aplicada a este teste.
// O QUE ELE ACUSA, medido por mutação: `alcasDeSaida` deixar de casar por id.
// Com a chave montada a partir do rótulo, ele cai (junto de outros três deste
// arquivo), e é essa a propriedade que ele guarda.
// ---------------------------------------------------------------------------
describe("os gestos do painel de botões, no dado", () => {
  const menu = blocoNovo("dm_opcoes");
  const botoes = (menu.tipo === "dm" && menu.botoes) || [];
  const idDoMenu = menu.id!;
  const destino: Passo = { id: "b_dest0001", tipo: "dm", texto: "braço um" };
  const lista = [menu, destino];
  const ligado = ligar([], idDoMenu, { tipo: "botao", botao: botoes[0].id }, destino.id!);

  it("o menu criado pela paleta desenha duas alças de botão, mais a do “senão”", () => {
    expect(alcasDeSaida(menu).map((a) => a.rotulo)).toEqual(["Opção 1", "Opção 2", "digitou"]);
  });

  it("renomear um botão NÃO troca o caminho: quem manda é o id", () => {
    const renomeado: Passo = {
      ...menu,
      tipo: "dm",
      texto: "Escolha",
      botoes: botoes.map((b, i) => (i === 0 ? { ...b, rotulo: "Outro nome" } : b)),
    };
    // A pergunta é a MESMA que o motor faz no toque, e a resposta é o DESTINO.
    expect(ligacaoEscolhida(ligado, idDoMenu, { tipo: "botao", botao: botoes[0].id })).toBe(
      destino.id
    );
    // E a alça continua a mesma, só com o nome novo escrito nela.
    expect(alcasDeSaida(renomeado)[0].chave).toBe(alcasDeSaida(menu)[0].chave);
    expect(alcasDeSaida(renomeado)[0].rotulo).toBe("Outro nome");
  });

  it("acrescentar um botão cria a alça, e o novo nasce sem destino e sem texto", () => {
    const acrescido: Passo = {
      ...menu,
      tipo: "dm",
      texto: "Escolha",
      botoes: [...botoes, { id: novoIdDeBotao(), rotulo: "" }],
    };
    expect(alcasDeSaida(acrescido).map((a) => a.rotulo)).toEqual([
      "Opção 1",
      "Opção 2",
      "sem texto",
      "digitou",
    ]);

    // AS DUAS PORTAS, e é a decisão da Tarefa 5: rótulo em branco e botão sem
    // destino impedem PUBLICAR, e nenhum dos dois impede GUARDAR o trabalho.
    const problemas = conferirLista([acrescido, destino], "dm", ligado);
    expect(problemas.filter((p) => p.nivel === "erro" && p.quando === "salvar")).toEqual([]);
    expect(podeFicarAtiva(problemas)).toBe(false);
    expect(problemas.map((p) => p.mensagem)).toContain(
      "Um dos botões deste bloco está sem texto, e botão sem texto não é entregue: ele some da mensagem."
    );
  });

  it("a conferência acusa botão sem destino, e o salvar continua permitido", () => {
    // O menu inteiro, com um braço ligado e o outro não.
    const problemas = conferirLista(lista, "dm", ligado);
    expect(problemas.filter((p) => p.nivel === "erro" && p.quando === "salvar")).toEqual([]);
    expect(problemas).toContainEqual({
      nivel: "erro",
      quando: "ativar",
      indice: 0,
      mensagem: "O botão “Opção 2” não leva a lugar nenhum: quem tocar nele não recebe nada.",
    });
    expect(podeFicarAtiva(problemas)).toBe(false);
  });

  it("apagar um botão apaga a ligação dele, e o bloco que sobrou fica acusado", () => {
    // O menu INTEIRO ligado: um braço para cada bloco. Os dois braços são
    // precisos aqui — com um só, apagá-lo deixa a lista SEM NENHUMA SETA, e aí
    // as regras de grafo ficam caladas por decisão (o comentário de
    // `conferirLista` diz por quê), o que esconderia o que este teste mede.
    const outro: Passo = { id: "b_outro002", tipo: "dm", texto: "braço dois" };
    const doisBracos = ligar(ligado, idDoMenu, { tipo: "botao", botao: botoes[1].id }, outro.id!);

    // O gesto do ✕: o botão sai da lista (painel) e a seta sai das ligações
    // (`desligarBotao`, no quadro). As duas metades juntas.
    const semOBotao: Passo = {
      ...menu,
      tipo: "dm",
      texto: "Escolha",
      botoes: botoes.filter((_, i) => i !== 0),
    };
    const semASeta = desligarBotao(doisBracos, idDoMenu, botoes[0].id);
    expect(semASeta.map((l) => l.para)).toEqual([outro.id]);

    // E O ERRO QUE A ÓRFÃ ESCONDERIA: com a seta apagada, o primeiro braço não
    // é alcançado por ninguém, e a conferência diz isso. Deixando a órfã, ela
    // fica calada — é a medição que está escrita em `desligarBotao`.
    const problemas = conferirLista([semOBotao, destino, outro], "dm", semASeta);
    expect(problemas.map((p) => p.mensagem)).toContain(
      "Nenhuma seta chega neste bloco a partir do começo do fluxo, então ele nunca é entregue."
    );
    expect(
      conferirLista([semOBotao, destino, outro], "dm", doisBracos).map((p) => p.mensagem)
    ).not.toContain(
      "Nenhuma seta chega neste bloco a partir do começo do fluxo, então ele nunca é entregue."
    );
  });

  // ---------------------------------------------------------------------
  // O SEGUNDO CLIQUE NO ✕ — o que sobra quando a lista de botões esvazia.
  //
  // O painel mantém o editor aberto com a lista vazia de propósito (ele
  // aparece pela CHAVE, `botoes !== undefined`), então este estado é
  // alcançável com dois cliques e não é canto nenhum.
  //
  // O gesto refeito aqui é o de `apagarBotao` (quadro.tsx) INTEIRO: o painel
  // corta o botão da lista, `desligarBotao` corta a seta dele, e
  // `desligarSenao` corta a `senao` quando o bloco deixou de ter a alça do
  // "digitou" — que é a pergunta feita a `alcasDeSaida`.
  // ---------------------------------------------------------------------
  it("apagar o ÚLTIMO botão tira a alça do “digitou”, e a `senao` fica órfã", () => {
    const vazio: Passo = { ...menu, tipo: "dm", texto: "Escolha", botoes: [] };
    // Some a alça: o bloco volta a ter só a de continuação.
    expect(alcasDeSaida(vazio).map((a) => a.chave)).toEqual(["sempre"]);
    // E a seta da `senao` passa a ser desenhada SAINDO DELA — `indiceDaAlca`
    // não acha a chave e cai na primeira.
    expect(indiceDaAlca(vazio, { tipo: "senao" })).toBe(0);
  });

  it("o gesto do ✕ tira a `senao` junto, e o erro escondido reaparece", () => {
    // O MENU NÃO É O PRIMEIRO BLOCO aqui, e a `sempre` que chega nele é
    // precisa: sem seta nenhuma sobrando, as regras de grafo ficam caladas por
    // decisão (o comentário de `conferirLista` diz por quê), e o que este teste
    // mede sumiria junto.
    const entrada: Passo = { id: "b_entra001", tipo: "dm", texto: "oi" };
    const vazio: Passo = { ...menu, tipo: "dm", texto: "Escolha", botoes: [] };
    const perdeuOSenao = !alcasDeSaida(vazio).some((a) => a.chave === "senao");
    expect(perdeuOSenao).toBe(true);

    const comSenao = ligar(
      ligar(ligado, entrada.id!, { tipo: "sempre" }, idDoMenu),
      idDoMenu,
      { tipo: "senao" },
      destino.id!
    );
    // Os dois cliques no ✕: cada botão sai da lista e a seta dele sai junto.
    const so = desligarBotao(
      desligarBotao(comSenao, idDoMenu, botoes[0].id),
      idDoMenu,
      botoes[1].id
    );
    expect(so.map((l) => l.quando.tipo)).toEqual(["sempre", "senao"]);

    // COM a `senao` sobrando, a conferência fica calada sobre o braço solto.
    const acusa = (ls: typeof so) =>
      conferirLista([entrada, vazio, destino], "dm", ls)
        .map((p) => p.mensagem)
        .filter((m) => m.startsWith("Nenhuma seta chega"));
    expect(acusa(so)).toEqual([]);
    // E o quadro desenharia a continuação daquele bloco, que o motor não tem.
    expect(seguinteDe(so, idDoMenu)).toBeNull();

    // SEM ela, o erro que ela escondia aparece.
    expect(acusa(desligarSenao(so, idDoMenu))).toEqual([
      "Nenhuma seta chega neste bloco a partir do começo do fluxo, então ele nunca é entregue.",
    ]);
  });

  it("a pergunta é a `alcasDeSaida`, e não `botoes.length`: `[null]` já perdeu a alça", () => {
    // A lista tem comprimento 1 e NENHUM botão aproveitável, então a alça do
    // "digitou" já não existe — contar o comprimento deixaria a `senao` órfã
    // exatamente aqui. É a causa mais cara de `botoesCrus`, e o ✕ dela é o
    // gesto de conserto.
    const soLixo = doBanco({ ...menu, tipo: "dm", texto: "Escolha", botoes: [null] });
    expect((soLixo as unknown as { botoes: unknown[] }).botoes).toHaveLength(1);
    expect(alcasDeSaida(soLixo).some((a) => a.chave === "senao")).toBe(false);
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
