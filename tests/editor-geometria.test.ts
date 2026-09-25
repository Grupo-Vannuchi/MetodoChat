import { describe, it, expect } from "vitest";
import {
  distanciaAoSegmento,
  fracaoDaAlca,
  ligacoesDoBloco,
  pontasDaSeta,
  setasAoAlcance,
  setaSobOPonto,
  alvoDoArraste,
  alvoDaPaleta,
  lugarDoBlocoNovo,
  seCobrem,
  ALCANCE_DA_SETA,
  ALTURA_SUPOSTA,
  LARGURA_DO_BLOCO,
  POSICAO_DO_GATILHO,
  ID_DO_GATILHO,
  type Medidas,
  type Ponto,
} from "../app/automacoes/editor/geometria";
// A IDENTIDADE VEM DE `lib/steps`, e não é reescrita aqui: é por ela que as
// medidas do React Flow são achadas, e o quadro passa exatamente esta lista.
import { identidadeDoPasso, type Ligacao, type Passo } from "../lib/steps";
// O VÃO ENTRE DOIS BLOCOS, lido de quem o define: escrever 250 à mão aqui
// faria o caso continuar verde no dia em que o vão mudasse.
import { PASSO_ENTRE_BLOCOS } from "../app/automacoes/editor/modelos";

// Um passo mínimo, só com a posição que a geometria lê. O `tipo`/`texto` são
// irrelevantes aqui — a geometria só os olha para saber quantas ALÇAS o bloco
// tem, e um `dm` sem botões tem uma só.
function passoEm(x: number, y: number): Passo {
  return { tipo: "dm", texto: "x", pos: { x, y } };
}

// A CORRENTE, agora explícita. Ela era deduzida da ordem do array, e a Tarefa 6
// tirou essa dedução: a seta `i` deixou de ser o par `i → i + 1` e passou a ser
// a LIGAÇÃO de índice `i`. Escrevê-la à mão aqui é o que faz os casos medidos
// continuarem sendo os mesmos casos.
function corrente(identidades: string[]): Ligacao[] {
  return identidades
    .slice(0, -1)
    .map((de, i) => ({ de, quando: { tipo: "sempre" } as const, para: identidades[i + 1] }));
}

describe("distanciaAoSegmento", () => {
  it("é zero para um ponto sobre o segmento", () => {
    expect(distanciaAoSegmento(5, 0, 0, 0, 10, 0)).toBe(0);
  });

  it("mede a perpendicular quando o ponto projeta dentro do segmento", () => {
    expect(distanciaAoSegmento(5, 3, 0, 0, 10, 0)).toBe(3);
  });

  it("clampa na ponta mais próxima quando a projeção cai fora do segmento", () => {
    // Ponto "antes" do início: a distância é até (0,0), não até a reta infinita.
    expect(distanciaAoSegmento(-4, 3, 0, 0, 10, 0)).toBe(5); // 3-4-5
    // Ponto "depois" do fim: distância até (10,0).
    expect(distanciaAoSegmento(14, 3, 0, 0, 10, 0)).toBe(5); // 3-4-5
  });

  it("segmento degenerado (as duas pontas iguais) vira distância a um ponto", () => {
    expect(distanciaAoSegmento(3, 4, 0, 0, 0, 0)).toBe(5);
  });
});

// A ALTURA DA ALÇA. Esta conta é escrita em DOIS lugares que precisam concordar:
// aqui ela decide onde a mira acha que a seta começa, e `no.tsx` a escreve no
// `style` da alça. Por isso ela é exportada em vez de embutida.
describe("fracaoDaAlca", () => {
  it("uma alça só fica no meio do bloco", () => {
    expect(fracaoDaAlca(0, 1)).toBe(0.5);
  });

  it("três alças ficam em 1/4, 2/4 e 3/4 — folga igual nas duas pontas", () => {
    expect([0, 1, 2].map((k) => fracaoDaAlca(k, 3))).toEqual([0.25, 0.5, 0.75]);
  });

  it("nenhuma alça encosta no topo nem na base", () => {
    for (const total of [1, 2, 5, 13]) {
      for (let k = 0; k < total; k++) {
        expect(fracaoDaAlca(k, total)).toBeGreaterThan(0);
        expect(fracaoDaAlca(k, total)).toBeLessThan(1);
      }
    }
  });
});

describe("pontasDaSeta", () => {
  const passos = [passoEm(0, 0), passoEm(300, 0)];
  const identidades = ["0", "1"];

  it("sai da alça direita do bloco de origem e chega no meio da esquerda do destino", () => {
    const l: Ligacao = { de: "0", quando: { tipo: "sempre" }, para: "1" };
    const r = pontasDaSeta(passos, {}, identidades, [l], l);
    // Sem medida: LARGURA_DO_BLOCO 190, ALTURA_SUPOSTA 48, alça única no meio.
    expect(r).toEqual({ de: { x: 190, y: 24 }, para: { x: 300, y: 24 } });
  });

  // A LIGAÇÃO PARA UM BLOCO QUE NÃO ESTÁ NA LISTA é forma VÁLIDA
  // (`conferirLigacao`, lib/steps.ts) e não tem traço a desenhar: quem fala
  // sobre o que ela causa é `conferirLista`, não a geometria.
  it("ligação para um bloco que não existe não tem traço", () => {
    const l: Ligacao = { de: "0", quando: { tipo: "sempre" }, para: "sumiu" };
    expect(pontasDaSeta(passos, {}, identidades, [l], l)).toBeNull();
  });

  it("bloco ainda sem posição não tem traço", () => {
    const semPos: Passo[] = [{ tipo: "dm", texto: "x" }, passoEm(300, 0)];
    const l: Ligacao = { de: "0", quando: { tipo: "sempre" }, para: "1" };
    expect(pontasDaSeta(semPos, {}, identidades, [l], l)).toBeNull();
  });

  // O CASO QUE A TAREFA 6 CRIOU: um bloco com botões tem uma alça por botão,
  // espalhadas pela altura. A seta de cada botão sai de uma altura diferente, e
  // é isso que a mira precisa acertar.
  it("cada botão sai de uma altura própria, e o “senão” da última", () => {
    const menu = {
      tipo: "dm",
      texto: "Escolha",
      pos: { x: 0, y: 0 },
      botoes: [
        { id: "op_1", rotulo: "A" },
        { id: "op_2", rotulo: "B" },
      ],
    } as unknown as Passo;
    const comMenu = [menu, passoEm(300, 0)];
    const medidas = { "0": { width: 190, height: 80 } };
    const ls: Ligacao[] = (
      [
        { tipo: "botao", botao: "op_1" },
        { tipo: "botao", botao: "op_2" },
        { tipo: "senao" },
      ] as const
    ).map((quando) => ({ de: "0", quando, para: "1" }));
    const alturas = ls.map((l) => pontasDaSeta(comMenu, medidas, identidades, ls, l)!.de.y);
    // Três alças em 1/4, 2/4 e 3/4 de 80.
    expect(alturas).toEqual([20, 40, 60]);
  });

  // A SETA QUE PERDEU A ALÇA GANHA A DELA, e a altura muda por causa disso: a
  // `sempre` de um menu não tem alça de tipo nenhum (`alcasDeSaida`), e até esta
  // onda ela era desenhada saindo do ÍNDICE 0 — a alça do PRIMEIRO BOTÃO, no
  // mesmo pixel da seta daquele botão. `alcasDoQuadro` lhe dá uma alça própria,
  // no fim, e o bloco passa a ter quatro.
  it("a `sempre` de um menu sai de uma alça só dela, e não da do primeiro botão", () => {
    const menu = {
      tipo: "dm",
      texto: "Escolha",
      pos: { x: 0, y: 0 },
      botoes: [
        { id: "op_1", rotulo: "A" },
        { id: "op_2", rotulo: "B" },
      ],
    } as unknown as Passo;
    const comMenu = [menu, passoEm(300, 0)];
    const medidas = { "0": { width: 190, height: 80 } };
    const doBotao: Ligacao = { de: "0", quando: { tipo: "botao", botao: "op_1" }, para: "1" };
    const aSempre: Ligacao = { de: "0", quando: { tipo: "sempre" }, para: "1" };
    const ls = [doBotao, aSempre];
    const yBotao = pontasDaSeta(comMenu, medidas, identidades, ls, doBotao)!.de.y;
    const ySempre = pontasDaSeta(comMenu, medidas, identidades, ls, aSempre)!.de.y;
    // Quatro alças (dois botões, "digitou" e a continuação) em 1/5..4/5 de 80.
    expect(yBotao).toBe(16);
    expect(ySempre).toBe(64);
    expect(ySempre).not.toBe(yBotao);
  });
});

describe("ligacoesDoBloco", () => {
  const ligacoes = corrente(["0", "1", "2"]);

  it("acha as setas das duas pontas", () => {
    expect(ligacoesDoBloco(ligacoes, "1")).toEqual([0, 1]);
    expect(ligacoesDoBloco(ligacoes, "0")).toEqual([0]);
    expect(ligacoesDoBloco(ligacoes, "2")).toEqual([1]);
  });

  it("bloco solto não toca seta nenhuma", () => {
    expect(ligacoesDoBloco(ligacoes, "9")).toEqual([]);
  });
});

describe("setasAoAlcance / setaSobOPonto — dois blocos, uma seta", () => {
  // A(0,0) -> B(300,0), ambos sem medida (cai no palpite: LARGURA 190,
  // ALTURA 48). A alça de saída de A fica em (190,24); a de entrada de B em
  // (300,24). Como as duas alças estão na mesma altura, o traçado inteiro é
  // uma linha reta em y=24 entre x=190 e x=300 — o "meio" do smoothstep é
  // degenerado, e o caso vale exatamente porque isso acontece de verdade
  // (dois blocos na mesma linha).
  const passos = [passoEm(0, 0), passoEm(300, 0)];
  const identidades = ["0", "1"];
  const ligacoes = corrente(identidades);
  const medidas = {};

  it("um ponto sobre a seta tem distância zero e é achado", () => {
    const r = setasAoAlcance({ x: 245, y: 24 }, passos, medidas, identidades, ligacoes, []);
    expect(r).toEqual([{ i: 0, d: 0 }]);
    expect(setaSobOPonto({ x: 245, y: 24 }, passos, medidas, identidades, ligacoes, [])).toBe(0);
  });

  it("respeita a lista `ignorar`", () => {
    expect(setaSobOPonto({ x: 245, y: 24 }, passos, medidas, identidades, ligacoes, [0])).toBeNull();
  });

  // SEM LIGAÇÃO NENHUMA NÃO HÁ SETA A ACERTAR, e este é o estado normal do
  // quadro desde a Tarefa 6: bloco solto é possível, e uma automação recém-criada
  // pode ter blocos e nenhuma seta.
  it("lista de ligações vazia não acha nada", () => {
    expect(setaSobOPonto({ x: 245, y: 24 }, passos, medidas, identidades, [], [])).toBeNull();
  });

  // A FRONTEIRA DO ALCANCE, NOS DOIS LADOS. `ALCANCE_DA_SETA` é comparado com
  // `<` estrito em `setasAoAlcance` — a distância exatamente igual ao alcance
  // já fica de fora.
  it("dentro do alcance: uma distância logo abaixo de ALCANCE_DA_SETA conta", () => {
    const d = ALCANCE_DA_SETA - 0.5;
    const alvo = setaSobOPonto({ x: 245, y: 24 + d }, passos, medidas, identidades, ligacoes, []);
    expect(alvo).toBe(0);
  });

  it("fora do alcance: a distância exatamente igual a ALCANCE_DA_SETA já não conta", () => {
    const alvo = setaSobOPonto(
      { x: 245, y: 24 + ALCANCE_DA_SETA },
      passos,
      medidas,
      identidades,
      ligacoes,
      []
    );
    expect(alvo).toBeNull();
  });

  it("fora do alcance: uma distância logo acima de ALCANCE_DA_SETA não conta", () => {
    const d = ALCANCE_DA_SETA + 0.5;
    const alvo = setaSobOPonto({ x: 245, y: 24 + d }, passos, medidas, identidades, ligacoes, []);
    expect(alvo).toBeNull();
  });
});

// O CASO MEDIDO NO NAVEGADOR (ver o comentário de `ALCANCE_DA_SETA` em
// `geometria.ts`): um bloco parado a 27,5 unidades de uma seta que não é
// vizinha dele, e um empurrão de poucos pixels na horizontal que NÃO muda a
// distância — porque o traçado ali é horizontal, e mexer ao longo dele não
// aproxima nem afasta. Com o alcance antigo (30) isso reordenava; com o
// atual (16) não acontece mais.
describe("o caso medido: 27,5 unidades de uma seta alheia", () => {
  const passos = [passoEm(0, 0), passoEm(300, 0)];
  const identidades = ["0", "1"];
  const ligacoes = corrente(identidades);
  const medidas = {};
  // Mesma seta reta do bloco anterior (x de 190 a 300, y=24). Um ponto a
  // 27,5 unidades verticais, com x dentro do vão, mede exatamente 27,5 de
  // distância perpendicular.
  const pontoParado = { x: 245, y: 24 + 27.5 };
  // O "empurrão de 4 pixels": um deslocamento horizontal pequeno. Como o x
  // continua dentro do vão (190–300) e o traçado ali é horizontal, a
  // distância não muda — é exatamente o que foi medido no navegador.
  const pontoEmpurrado = { x: 247, y: 24 + 27.5 };

  it("27,5 está entre o alcance atual e o antigo — ficaria pego com 30, não com 16", () => {
    const d = distanciaAoSegmento(pontoParado.x, pontoParado.y, 190, 24, 300, 24);
    expect(d).toBe(27.5);
    expect(d).toBeLessThan(30); // o alcance antigo pegava
    expect(d).toBeGreaterThanOrEqual(ALCANCE_DA_SETA); // o atual não pega
  });

  it("o empurrão não muda a distância (é essa a armadilha medida)", () => {
    const antes = distanciaAoSegmento(pontoParado.x, pontoParado.y, 190, 24, 300, 24);
    const depois = distanciaAoSegmento(pontoEmpurrado.x, pontoEmpurrado.y, 190, 24, 300, 24);
    expect(depois).toBe(antes);
  });

  it("com o alcance atual, nem parado nem empurrado a seta é alcançada", () => {
    expect(setaSobOPonto(pontoParado, passos, medidas, identidades, ligacoes, [])).toBeNull();
    expect(setaSobOPonto(pontoEmpurrado, passos, medidas, identidades, ligacoes, [])).toBeNull();
  });
});

// A REGRA DAS SETAS JÁ AO ALCANCE NO INÍCIO DO GESTO (`alvoDoArraste`). Esta
// é a segunda defesa — a que fecha a CLASSE do defeito, e não só o caso
// medido: mesmo uma seta dentro do alcance atual (16) não pode ser
// "conquistada" só porque o bloco já nasceu perto dela.
//
// O QUE ELA PROTEGE MUDOU DE NOME NA TAREFA 6 e não de natureza: era a ORDEM do
// array, e é o DESENHO das setas. O estrago é o mesmo — o cliente recebe outra
// coisa, sem erro e sem aviso.
describe("alvoDoArraste — a seta precisa ser conquistada pelo gesto", () => {
  // Cinco blocos: A(0) B(1) C(2) D(3) E(4). B é o bloco arrastado (identidade
  // "1"). A seta D->E (ligação 3) não toca B (as que tocam B são as ligações 0
  // e 1). C fica fora do caminho (y=500) para não interferir na medição.
  const passos = [
    passoEm(0, 0), // A (0)
    passoEm(300, 0), // B (1) — o bloco arrastado
    passoEm(300, 500), // C (2) — fora do caminho de propósito
    passoEm(600, 0), // D (3)
    passoEm(900, 0), // E (4)
  ];
  const identidades = ["0", "1", "2", "3", "4"];
  const ligacoes = corrente(identidades);
  const medidas = {};
  const blocoArrastado = "1";

  // A seta D->E vai de (600+190, 24) = (790,24) a (900,24). Um ponto a 10
  // unidades dela, dentro do alcance atual (16).
  const pontoPertoDeDE = { x: 845, y: 34 };

  it("confere a distância e que a ligação 3 é mesmo a candidata (setup do teste)", () => {
    const r = setasAoAlcance(pontoPertoDeDE, passos, medidas, identidades, ligacoes, []);
    expect(r).toEqual([{ i: 3, d: 10 }]);
  });

  it("sem setas conquistadas no início, a seta 3 é um alvo válido", () => {
    const alvo = alvoDoArraste(
      pontoPertoDeDE,
      passos,
      medidas,
      identidades,
      ligacoes,
      blocoArrastado,
      new Set()
    );
    expect(alvo).toBe(3);
  });

  it("se a seta 3 já estava ao alcance no início do gesto, ela deixa de ser alvo", () => {
    // Isto é a reprodução funcional do defeito medido: uma seta alheia,
    // dentro do alcance, perto de onde o bloco JÁ estava — e que não pode
    // ser "ganha" só por o bloco continuar ali ou tremer um pouco.
    const alvo = alvoDoArraste(
      pontoPertoDeDE,
      passos,
      medidas,
      identidades,
      ligacoes,
      blocoArrastado,
      new Set([3])
    );
    expect(alvo).toBeNull();
  });

  it("as setas que tocam o próprio bloco nunca são alvo, mesmo fora de setasNoInicio", () => {
    // Arrastando D (identidade "3"): a ligação 3 (D->E) sai do próprio bloco,
    // então fica de fora mesmo sem ter sido marcada como já-ao-alcance.
    const alvo = alvoDoArraste(
      pontoPertoDeDE,
      passos,
      medidas,
      identidades,
      ligacoes,
      "3",
      new Set()
    );
    expect(alvo).toBeNull();
  });
});

// O BLOCO PRECISA TER `sempre` PARA DAR — o Crítico desta onda.
//
// Partir uma seta escreve `MEIO --sempre--> B` (`partirLigacao`, lib/steps.ts).
// O menu de `botoes` não tem alça de `sempre` (`alcasDeSaida`, ./modelos), e o
// gesto escrevia a seta assim mesmo: `indiceDaAlca` caía no índice 0 e o quadro
// a desenhava saindo da alça do PRIMEIRO BOTÃO — dois caminhos do mesmo ponto,
// e o toque naquele botão nunca percorre o segundo.
//
// A ORDEM DAS PERGUNTAS IMPORTA e está medida aqui: o mesmo ponto, as mesmas
// setas e o mesmo `setasNoInicio` vazio devolvem 3 para um bloco comum e `null`
// para o menu. Ou seja, o que muda é só o BLOCO.
describe("alvoDoArraste — quem não tem `sempre` não entra no meio da seta", () => {
  const menuEm = (x: number, y: number): Passo => ({
    tipo: "dm",
    texto: "Escolha",
    botoes: [
      { id: "op_aaaaaa", rotulo: "A" },
      { id: "op_bbbbbb", rotulo: "B" },
    ],
    pos: { x, y },
  });

  const identidades = ["0", "1", "2", "3", "4"];
  const ligacoes = corrente(identidades);
  const medidas = {};
  const pontoPertoDeDE = { x: 845, y: 34 };
  const comuns = [passoEm(0, 0), passoEm(300, 0), passoEm(300, 500), passoEm(600, 0), passoEm(900, 0)];

  it("um bloco comum arrastado até a seta 3 continua sendo alvo", () => {
    expect(
      alvoDoArraste(pontoPertoDeDE, comuns, medidas, identidades, ligacoes, "1", new Set())
    ).toBe(3);
  });

  it("o MESMO gesto com um MENU no lugar do bloco arrastado não tem alvo", () => {
    const comMenu = [...comuns];
    comMenu[1] = menuEm(300, 0);
    expect(
      alvoDoArraste(pontoPertoDeDE, comMenu, medidas, identidades, ligacoes, "1", new Set())
    ).toBeNull();
  });

  it("identidade que não está na lista não tem alvo — é o nó do gatilho", () => {
    // `identidades.indexOf("gatilho")` é -1, e sem a guarda a pergunta sobre as
    // alças seria feita a `passos[-1]`.
    expect(
      alvoDoArraste(pontoPertoDeDE, comuns, medidas, identidades, ligacoes, "gatilho", new Set())
    ).toBeNull();
  });

  // A PALETA PASSA PELA MESMA PERGUNTA, e é o caminho do gesto que produziu o
  // defeito: "Mensagem com opções" arrastada da faixa e solta em cima da seta.
  it("alvoDaPaleta: bloco comum acha a seta, menu não acha", () => {
    expect(
      alvoDaPaleta(pontoPertoDeDE, comuns, medidas, identidades, ligacoes, {
        tipo: "dm",
        texto: "novo",
      })
    ).toBe(3);
    expect(
      alvoDaPaleta(pontoPertoDeDE, comuns, medidas, identidades, ligacoes, menuEm(0, 0))
    ).toBeNull();
    // Sem bloco nenhum (o arrasto ainda não disse qual item é) também não
    // acende: o destaque não pode prometer o que o soltar vai recusar.
    expect(
      alvoDaPaleta(pontoPertoDeDE, comuns, medidas, identidades, ligacoes, null)
    ).toBeNull();
  });
});

describe("setasAoAlcance — usa a medida real do bloco quando ela existe", () => {
  it("uma medida maior estica a alça de saída, e muda a seta encontrada", () => {
    const passos = [passoEm(0, 0), passoEm(300, 0)];
    const identidades = ["0", "1"];
    const ligacoes = corrente(identidades);
    // Sem medida: alça de saída em x=190 (0 + LARGURA_DO_BLOCO palpite).
    // Com uma medida de largura 280, a alça de saída vai para x=280 — bem
    // mais perto de x=300, e a distância medida no eixo x muda de acordo.
    const semMedida = distanciaAoSegmento(200, 24, 190, 24, 300, 24);
    const comMedida = distanciaAoSegmento(200, 24, 280, 24, 300, 24);
    expect(semMedida).toBe(0); // x=200 cai dentro do vão 190–300
    expect(comMedida).toBe(80); // x=200 cai antes do vão 280–300 agora
    const medidas = { "0": { width: 280, height: 48 } };
    expect(
      setaSobOPonto({ x: 200, y: 24 }, passos, medidas, identidades, ligacoes, [])
    ).toBeNull();
  });
});

// A RÉGUA DE "dá para ler os dois", sozinha. Ela é a peça de que a cascata
// depende — o passo só escolhe ONDE tentar, e é `seCobrem` que diz se a
// tentativa vale —, e por isso ela tem casos próprios: medido em 24/09/2026,
// plantar de volta SÓ a diagonal de 24 (deixando esta régua nova no lugar)
// mantém os seis blocos sem se cobrir, porque a cascata passa a pular os
// candidatos ruins. Quem de fato garante a não-sobreposição é esta função.
describe("seCobrem", () => {
  const canto = { x: 0, y: 0 };

  it("a diagonal de 24 do empilhamento É sobreposição — foi ela que o dono mediu", () => {
    // `{x:-200,y:72}` e `{x:-176,y:96}` no banco: 24 nos dois eixos, com 190 de
    // largura de bloco. É o caso que esta correção veio tirar da tela.
    expect(seCobrem(canto, ALTURA_SUPOSTA, { x: 24, y: 24 }, ALTURA_SUPOSTA)).toBe(true);
  });

  it("é retângulo, e não distância entre pontos", () => {
    // 34 de distância reta (24/24) cobre; 200 de distância reta na horizontal
    // não cobre. Um raio não separa esses dois casos.
    expect(Math.hypot(24, 24)).toBeLessThan(200);
    expect(seCobrem(canto, ALTURA_SUPOSTA, { x: 200, y: 0 }, ALTURA_SUPOSTA)).toBe(false);
  });

  it("encostar não é cobrir — a borda de um na borda do outro deixa os dois legíveis", () => {
    // É o desfecho que a saída de baixo da cascata produz quando o quadro está
    // cheio, e por isso a régua precisa dizer que ele é aceitável.
    expect(seCobrem(canto, ALTURA_SUPOSTA, { x: LARGURA_DO_BLOCO, y: 0 }, ALTURA_SUPOSTA)).toBe(
      false
    );
    expect(seCobrem(canto, ALTURA_SUPOSTA, { x: 0, y: ALTURA_SUPOSTA }, 300)).toBe(false);
    // E um pixel a menos já é cobrir, nos dois eixos.
    expect(seCobrem(canto, ALTURA_SUPOSTA, { x: LARGURA_DO_BLOCO - 1, y: 0 }, ALTURA_SUPOSTA)).toBe(
      true
    );
    expect(seCobrem(canto, ALTURA_SUPOSTA, { x: 0, y: ALTURA_SUPOSTA - 1 }, 300)).toBe(true);
  });

  it("a ALTURA de cada um entra separada, porque elas têm origens diferentes", () => {
    // A de baixo vem MEDIDA pelo React Flow; a do que ainda vai nascer é
    // `ALTURA_SUPOSTA`. Um bloco alto alcança quem está 100 abaixo dele; um
    // baixo, não — e é só a altura que muda entre as duas chamadas.
    expect(seCobrem({ x: 0, y: 100 }, ALTURA_SUPOSTA, canto, 220)).toBe(true);
    expect(seCobrem({ x: 0, y: 100 }, ALTURA_SUPOSTA, canto, ALTURA_SUPOSTA)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ONDE CAI O BLOCO CRIADO POR CLIQUE NA PALETA.
//
// O DEFEITO MEDIDO, montando uma automação de verdade: dois blocos criados pela
// paleta nasceram um em cima do outro. No banco, `pos` do primeiro
// `{x:-200, y:72}` e do segundo `{x:-176, y:96}` — 24 pixels na diagonal, com o
// bloco de cima cobrindo quase todo o de baixo. Com 3 o quadro já não se lê, e
// com 6 o dono arrasta um por um antes de conseguir trabalhar.
//
// O ALVO NÃO É "os dois primeiros não se tocam": é montar SEIS pela paleta e ler
// os seis sem arrastar nenhum. Por isso o caso central daqui SIMULA a sequência
// de cliques — cada bloco entra na lista e o seguinte é posicionado já sabendo
// dele, que é exatamente o que `inserirNoCentro` (quadro.tsx) faz.
// ---------------------------------------------------------------------------
describe("lugarDoBlocoNovo", () => {
  // O centro da area visivel usado em quase todos os casos. Com LARGURA 190 e
  // ALTURA_SUPOSTA 48, o canto esperado e (500 - 95, 300 - 24) = (405, 276).
  const centro = { x: 500, y: 300 };
  const canto = {
    x: centro.x - LARGURA_DO_BLOCO / 2,
    y: centro.y - ALTURA_SUPOSTA / 2,
  };

  // A ALTURA QUE O REACT FLOW MEDE no bloco mais alto que a paleta produz — o
  // menu (`dm_opcoes`), 82px medidos na tela (a medição está em `./geometria`).
  // Ela entra nos casos porque é o pior caso REAL do que já está no quadro
  // quando o próximo bloco nasce: o React Flow mede o bloco assim que ele
  // aparece, então o segundo clique já encontra a medida do primeiro.
  const MAIS_ALTO = 82;

  /** O que o quadro passa: as medidas por identidade, e as identidades. */
  function lugar(c: Ponto, passos: Passo[], altura?: number): Ponto {
    const identidades = passos.map(identidadeDoPasso);
    const medidas: Medidas = {};
    if (altura !== undefined) {
      for (const id of identidades) medidas[id] = { width: LARGURA_DO_BLOCO, height: altura };
    }
    return lugarDoBlocoNovo(c, passos, medidas, identidades);
  }

  /** Os N cliques na paleta, um depois do outro, do jeito que `inserirNoCentro` faz. */
  function cliquesNaPaleta(n: number, c = centro, altura?: number): Passo[] {
    const passos: Passo[] = [];
    for (let k = 0; k < n; k++) {
      const pos = lugar(c, passos, altura);
      passos.push({ id: `b_novo0${k}`, tipo: "dm", texto: "x", pos });
    }
    return passos;
  }

  /** Os pares de blocos que se cobrem na tela, pela régua de `seCobrem`. */
  function cobertos(passos: Passo[], altura = ALTURA_SUPOSTA): string[] {
    const pares: string[] = [];
    for (let i = 0; i < passos.length; i++) {
      for (let j = i + 1; j < passos.length; j++) {
        if (seCobrem(passos[i].pos!, altura, passos[j].pos!, altura)) pares.push(`${i} sobre ${j}`);
      }
    }
    return pares;
  }

  it("poe o CENTRO do bloco no ponto pedido, devolvendo o canto", () => {
    expect(lugar(centro, [])).toEqual({ x: 405, y: 276 });
    expect(lugar(centro, [])).toEqual(canto);
  });

  it("arredonda, para nao repetir o `73.00000000000001` que ja apareceu no banco", () => {
    // `screenToFlowPosition` devolve fracionario, e o centro de um retangulo de
    // largura impar cai no meio de um pixel.
    const l = lugar({ x: 500.4, y: 300.7 }, []);
    expect(Number.isInteger(l.x)).toBe(true);
    expect(Number.isInteger(l.y)).toBe(true);
  });

  it("nao desvia por causa de bloco que esta longe do centro", () => {
    expect(lugar(centro, [passoEm(0, 0), passoEm(2000, 900)])).toEqual(canto);
  });

  it("nao desvia por causa de bloco sem `pos` — ele nao esta em lugar nenhum", () => {
    // Bloco sem posicao e forma valida (toda lista anterior a Fase 1b e assim),
    // e ele nao pode reivindicar o centro do quadro.
    const semPos: Passo = { tipo: "dm", texto: "x" };
    expect(lugar(centro, [semPos, semPos])).toEqual(canto);
  });

  it("SEIS blocos pela paleta, e nenhum cobre nenhum", () => {
    // O ALVO DESTA CORREÇÃO, medido do jeito que o dono o mediu: seis cliques
    // seguidos na faixa, sem arrastar nada no meio. Antes, os seis saíam numa
    // diagonal de 24 em 24 e mesmo o primeiro e o sexto ficavam a 120 nos dois
    // eixos — dentro dos 190 de largura do bloco, ou seja, cobrindo-se.
    const comMedida = cliquesNaPaleta(6, centro, MAIS_ALTO);
    expect(cobertos(comMedida, MAIS_ALTO), "blocos sobrepostos na tela").toEqual([]);
    // E TAMBÉM ANTES DA PRIMEIRA MEDIÇÃO: o React Flow mede depois de desenhar,
    // e um clique rápido pode chegar antes disso. Com a altura suposta o
    // desfecho tem de ser o mesmo.
    expect(cobertos(cliquesNaPaleta(6)), "blocos sobrepostos sem medida").toEqual([]);
  });

  it("e os seis cabem juntos no que se esta olhando — nao marcham para fora da tela", () => {
    // A OUTRA METADE DE "ler os seis": não basta não se cobrirem. Uma cascata em
    // linha reta — 250 de passo, seis blocos — daria 1250 de largura, e uma
    // coluna reta daria 480 de altura; nos dois casos os últimos nascem fora do
    // que a pessoa está vendo, que é o MESMO sintoma do empilhamento (clicar e
    // não ver nada acontecer).
    //
    // O NÚMERO NÃO É DE NAVEGADOR, e é por isso que ele é folgado: o que o caso
    // prende é a FORMA — o conjunto cresce nos dois eixos e volta, em vez de
    // marchar num só. Medir o quadro de verdade é do `conferir:navegador`.
    const passos = cliquesNaPaleta(6, centro, MAIS_ALTO);
    const xs = passos.map((p) => p.pos!.x);
    const ys = passos.map((p) => p.pos!.y);
    expect(Math.max(...xs) + LARGURA_DO_BLOCO - Math.min(...xs)).toBeLessThanOrEqual(500);
    expect(Math.max(...ys) + MAIS_ALTO - Math.min(...ys)).toBeLessThanOrEqual(300);
  });

  it("nao atropela o bloco que o dono ja arrastou para onde queria", () => {
    // O bloco parado está EXATAMENTE onde o segundo clique cairia. O lugar
    // devolvido não pode cobri-lo: arrumar o quadro é gesto de quem monta, e um
    // bloco novo por cima desfaz esse gesto sem dizer nada.
    const primeiro = cliquesNaPaleta(1, centro, MAIS_ALTO);
    const segundo = lugar(centro, primeiro, MAIS_ALTO);
    const arrastado: Passo = { id: "b_maonaa1", tipo: "dm", texto: "x", pos: segundo };
    const terceiro = lugar(centro, [...primeiro, arrastado], MAIS_ALTO);
    expect(seCobrem(terceiro, ALTURA_SUPOSTA, segundo, MAIS_ALTO)).toBe(false);
    expect(seCobrem(terceiro, ALTURA_SUPOSTA, primeiro[0].pos!, MAIS_ALTO)).toBe(false);
  });

  it("desvia pela altura MEDIDA, e nao pela suposta", () => {
    // UM BLOCO ALTO OCUPA MAIS LINHAS. `ALTURA_SUPOSTA` é 48 e um menu de muitos
    // botões passa de 200 — com a altura suposta, o lugar devolvido cairia
    // DENTRO dele. A medida existe para o que já está na tela (o React Flow a
    // entrega); quem ainda vai nascer continua valendo pela suposta, e essa é a
    // única metade que este arquivo não tem como saber.
    const alto: Passo = { id: "b_altoo01", tipo: "dm", texto: "x", pos: canto };
    const identidades = [identidadeDoPasso(alto, 0)];
    const medidas: Medidas = { b_altoo01: { width: LARGURA_DO_BLOCO, height: 220 } };
    const l = lugarDoBlocoNovo(centro, [alto], medidas, identidades);
    expect(
      seCobrem(l, ALTURA_SUPOSTA, canto, 220),
      `o lugar ${JSON.stringify(l)} caiu DENTRO do bloco de 220 de altura que começa em ` +
        `${JSON.stringify(canto)} — a medida do React Flow foi ignorada`
    ).toBe(false);
    // E o mesmo bloco, se fosse baixo, deixaria livre um lugar que agora não
    // está — é isso que prova que a medida foi LIDA, e não ignorada.
    expect(lugarDoBlocoNovo(centro, [alto], {}, identidades)).not.toEqual(l);
  });

  it("vale em qualquer rolagem e qualquer zoom — a conta e toda em coordenada do quadro", () => {
    // O zoom e a rolagem já foram resolvidos por `screenToFlowPosition`
    // (quadro.tsx) antes de chegar aqui: o que muda é o `centro`, e ele chega
    // FRACIONÁRIO quando o zoom não é 1. O desfecho tem de ser o mesmo conjunto
    // legível, em volta do novo centro.
    const longe = { x: -1840.37, y: 2611.62 };
    const passos = cliquesNaPaleta(6, longe, MAIS_ALTO);
    expect(cobertos(passos, MAIS_ALTO)).toEqual([]);
    expect(passos.every((p) => Number.isInteger(p.pos!.x) && Number.isInteger(p.pos!.y))).toBe(true);
    // O primeiro nasce no centro de onde se está olhando, e não perto do lugar
    // de onde a tela rolou.
    expect(passos[0].pos).toEqual({
      x: Math.round(longe.x - LARGURA_DO_BLOCO / 2),
      y: Math.round(longe.y - ALTURA_SUPOSTA / 2),
    });
  });

  it("com as colunas da frente barradas, procura ADIANTE em vez de cair no fim do mundo", () => {
    // O QUE ESTE CASO PRENDE: o `2 *` do limite do laço. Um bloco parado pode
    // barrar DUAS colunas — as colunas distam 250 e o cruzamento em x exige
    // menos de 190 de afastamento, então um bloco no meio do vão alcança as duas
    // vizinhas. Com dois blocos altos, plantados um no meio de cada par, as
    // colunas 0 a 3 ficam inteiramente barradas e a primeira vaga é a 4.
    //
    // COM `passos.length + 1` COLUNAS o laço olharia só 0, 1 e 2, sairia sem
    // achar nada e cairia na saída de baixo de tudo — que é livre, mas fica
    // longe de onde a pessoa está olhando. A resposta certa está a uma coluna
    // dali, e é o `2 *` que a alcança.
    const alto = (x: number, id: string): Passo => ({
      id,
      tipo: "dm",
      texto: "x",
      pos: { x, y: canto.y - 10 },
    });
    const passos = [alto(canto.x + 125, "b_barra01"), alto(canto.x + 625, "b_barra02")];
    const medidas: Medidas = {
      b_barra01: { width: LARGURA_DO_BLOCO, height: 300 },
      b_barra02: { width: LARGURA_DO_BLOCO, height: 300 },
    };
    const l = lugarDoBlocoNovo(centro, passos, medidas, passos.map(identidadeDoPasso));
    expect(l).toEqual({ x: canto.x + 4 * PASSO_ENTRE_BLOCOS.x, y: canto.y });
  });

  it("vinte cliques seguidos continuam sem cobrir nenhum", () => {
    // O laço não esgota e não devolve lugar ocupado. Vinte é o número do caso
    // antigo, mantido: ele passa de qualquer limite plausível.
    expect(cobertos(cliquesNaPaleta(20, centro, MAIS_ALTO), MAIS_ALTO)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// O NÓ DE GATILHO TAMBÉM OCUPA LUGAR, e esta é a metade que faltava.
//
// MEDIDO NA PRODUÇÃO em 25/09/2026, criando uma automação e jogando cinco
// blocos da paleta, lendo as caixas pelo navegador:
//
//   GATILHO · DM        x=347  y=293  h=96   → ocupa até 389
//   MENSAGEM (1º bloco) x=347  y=300  h=96   ← NASCEU EM CIMA DELE
//   PEDIR TELEFONE      x=347  y=467              ok
//   PEDIR NOME          x=347  y=634              ok
//   PEDIR NASCIMENTO    x=782  y=300              ok (coluna nova)
//
// Do SEGUNDO bloco em diante a cascata funciona — ela desvia dos blocos. O
// primeiro caía 7 pixels abaixo do gatilho, na mesma coluna, e o cobria quase
// inteiro: na captura de tela sobrava uma fresta da borda, e o texto do gatilho
// ficava invisível.
//
// POR QUE OS CASOS DE ONTEM NÃO PEGARAM: eles alimentam `passos`, e o gatilho
// NÃO é um passo — ele não é gravado, e por isso nunca entrou na ocupação. O
// caso abaixo não mede "os dois primeiros não se tocam", que era o desfecho que
// já passava; ele mede a sobreposição com o GATILHO, com ZERO blocos na tela.
describe("lugarDoBlocoNovo e o nó de gatilho", () => {
  it("o PRIMEIRO bloco não nasce em cima do gatilho", () => {
    // O centro exato do gatilho: é o pior caso, e é o que a produção fez — o
    // centro da área visível caiu praticamente em cima dele.
    const centro = {
      x: POSICAO_DO_GATILHO.x + LARGURA_DO_BLOCO / 2,
      y: POSICAO_DO_GATILHO.y + ALTURA_SUPOSTA / 2,
    };
    const lugar = lugarDoBlocoNovo(centro, [], {}, []);
    expect(
      seCobrem(lugar, ALTURA_SUPOSTA, POSICAO_DO_GATILHO, ALTURA_SUPOSTA),
      `o bloco novo nasceu sobre o gatilho: bloco em ${JSON.stringify(lugar)}, ` +
        `gatilho em ${JSON.stringify(POSICAO_DO_GATILHO)}`
    ).toBe(false);
  });

  it("a ALTURA MEDIDA do gatilho entra na conta, e não a suposta", () => {
    // Um gatilho alto (palavras-chave em várias linhas) ocupa mais que
    // `ALTURA_SUPOSTA`. Sem ler a medida, o bloco cairia dentro dele.
    const alto = 200;
    const centro = {
      x: POSICAO_DO_GATILHO.x + LARGURA_DO_BLOCO / 2,
      y: POSICAO_DO_GATILHO.y + ALTURA_SUPOSTA / 2,
    };
    const lugar = lugarDoBlocoNovo(centro, [], { [ID_DO_GATILHO]: { width: LARGURA_DO_BLOCO, height: alto } }, []);
    expect(
      seCobrem(lugar, ALTURA_SUPOSTA, POSICAO_DO_GATILHO, alto),
      `o bloco caiu dentro de um gatilho de ${alto} de altura: ${JSON.stringify(lugar)}`
    ).toBe(false);
  });
});
