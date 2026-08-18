import { describe, it, expect } from "vitest";
import {
  distanciaAoSegmento,
  fracaoDaAlca,
  ligacoesDoBloco,
  pontasDaSeta,
  setasAoAlcance,
  setaSobOPonto,
  alvoDoArraste,
  lugarDoBlocoNovo,
  ALCANCE_DA_SETA,
  ALTURA_SUPOSTA,
  DESVIO_DO_EMPILHAMENTO,
  LARGURA_DO_BLOCO,
} from "../app/automacoes/editor/geometria";
import type { Ligacao, Passo } from "../lib/steps";

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
    const r = pontasDaSeta(passos, {}, identidades, {
      de: "0",
      quando: { tipo: "sempre" },
      para: "1",
    });
    // Sem medida: LARGURA_DO_BLOCO 190, ALTURA_SUPOSTA 48, alça única no meio.
    expect(r).toEqual({ de: { x: 190, y: 24 }, para: { x: 300, y: 24 } });
  });

  // A LIGAÇÃO PARA UM BLOCO QUE NÃO ESTÁ NA LISTA é forma VÁLIDA
  // (`conferirLigacao`, lib/steps.ts) e não tem traço a desenhar: quem fala
  // sobre o que ela causa é `conferirLista`, não a geometria.
  it("ligação para um bloco que não existe não tem traço", () => {
    expect(
      pontasDaSeta(passos, {}, identidades, {
        de: "0",
        quando: { tipo: "sempre" },
        para: "sumiu",
      })
    ).toBeNull();
  });

  it("bloco ainda sem posição não tem traço", () => {
    const semPos: Passo[] = [{ tipo: "dm", texto: "x" }, passoEm(300, 0)];
    expect(
      pontasDaSeta(semPos, {}, identidades, { de: "0", quando: { tipo: "sempre" }, para: "1" })
    ).toBeNull();
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
    const alturas = (
      [
        { tipo: "botao", botao: "op_1" },
        { tipo: "botao", botao: "op_2" },
        { tipo: "senao" },
      ] as const
    ).map(
      (quando) => pontasDaSeta(comMenu, medidas, identidades, { de: "0", quando, para: "1" })!.de.y
    );
    // Três alças em 1/4, 2/4 e 3/4 de 80.
    expect(alturas).toEqual([20, 40, 60]);
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

describe("lugarDoBlocoNovo", () => {
  // O centro da area visivel usado em quase todos os casos. Com LARGURA 190 e
  // ALTURA_SUPOSTA 48, o canto esperado e (500 - 95, 300 - 24) = (405, 276).
  const centro = { x: 500, y: 300 };
  const canto = {
    x: centro.x - LARGURA_DO_BLOCO / 2,
    y: centro.y - ALTURA_SUPOSTA / 2,
  };

  it("poe o CENTRO do bloco no ponto pedido, devolvendo o canto", () => {
    expect(lugarDoBlocoNovo(centro, [])).toEqual({ x: 405, y: 276 });
    expect(lugarDoBlocoNovo(centro, [])).toEqual(canto);
  });

  it("arredonda, para nao repetir o `73.00000000000001` que ja apareceu no banco", () => {
    // `screenToFlowPosition` devolve fracionario, e o centro de um retangulo de
    // largura impar cai no meio de um pixel.
    const lugar = lugarDoBlocoNovo({ x: 500.4, y: 300.7 }, []);
    expect(Number.isInteger(lugar.x)).toBe(true);
    expect(Number.isInteger(lugar.y)).toBe(true);
  });

  it("nao desvia por causa de bloco que esta longe do centro", () => {
    expect(lugarDoBlocoNovo(centro, [passoEm(0, 0), passoEm(2000, 900)])).toEqual(canto);
  });

  it("nao desvia por causa de bloco sem `pos` — ele nao esta em lugar nenhum", () => {
    // Bloco sem posicao e forma valida (toda lista anterior a Fase 1b e assim),
    // e ele nao pode reivindicar o centro do quadro.
    const semPos: Passo = { tipo: "dm", texto: "x" };
    expect(lugarDoBlocoNovo(centro, [semPos, semPos])).toEqual(canto);
  });

  it("desvia na diagonal quando o centro ja esta ocupado", () => {
    const lugar = lugarDoBlocoNovo(centro, [passoEm(canto.x, canto.y)]);
    expect(lugar).toEqual({
      x: canto.x + DESVIO_DO_EMPILHAMENTO,
      y: canto.y + DESVIO_DO_EMPILHAMENTO,
    });
  });

  it("desvia de novo quando o primeiro desvio tambem esta ocupado", () => {
    const passos = [
      passoEm(canto.x, canto.y),
      passoEm(canto.x + DESVIO_DO_EMPILHAMENTO, canto.y + DESVIO_DO_EMPILHAMENTO),
    ];
    expect(lugarDoBlocoNovo(centro, passos)).toEqual({
      x: canto.x + 2 * DESVIO_DO_EMPILHAMENTO,
      y: canto.y + 2 * DESVIO_DO_EMPILHAMENTO,
    });
  });

  it("cobrir e coisa de retangulo: desvia por CHEBYSHEV, nao por distancia reta", () => {
    // Um bloco 20 para o lado e 20 para baixo do canto: a distancia reta e
    // 28,3 — passaria por um raio de 24 —, mas na tela ele cobre quase todo o
    // lugar pedido. O maior dos dois afastamentos e 20, e 20 < 24, entao desvia.
    const vizinho = passoEm(canto.x + 20, canto.y + 20);
    expect(Math.hypot(20, 20)).toBeGreaterThan(DESVIO_DO_EMPILHAMENTO);
    expect(lugarDoBlocoNovo(centro, [vizinho])).not.toEqual(canto);
  });

  it("um bloco entre duas posicoes da diagonal barra as DUAS, e o laco passa por cima", () => {
    // Um unico bloco a 12/12 do canto barra as posicoes k=0 e k=1 (afastamentos
    // 12 e 12 dele), e a resposta e k=2 — prova que o laco pula por cima de DOIS
    // candidatos barrados pelo mesmo obstaculo.
    //
    // O QUE ISTO NAO PROVA, medido: que o multiplicador precisa ser `2`. Com um
    // so obstaculo, mutar o limite para `passos.length + 1` (n=1 -> limite=2)
    // ainda passa aqui — o laco para em k=0,1 sem achar vaga, e o `return` de
    // fora do laco reusa a mesma variavel `limite` (ja mutada) para devolver
    // k=2, que acerta POR SORTE: aquele `return` nao sabe que k=2 esta livre, so
    // repete o ultimo `limite` tentado. Quem prova o multiplicador de verdade e
    // o caso seguinte, com dois obstaculos ENCADEADOS.
    const meio = passoEm(canto.x + 12, canto.y + 12);
    expect(lugarDoBlocoNovo(centro, [meio])).toEqual({
      x: canto.x + 2 * DESVIO_DO_EMPILHAMENTO,
      y: canto.y + 2 * DESVIO_DO_EMPILHAMENTO,
    });

    // DOIS obstaculos encadeados: o primeiro (12/12 do canto) barra k=0 e k=1;
    // o segundo (60/60 do canto) barra k=2 e k=3 (afastamentos 12 e 12 dele). A
    // primeira vaga livre e k=4.
    //
    // Com `passos.length + 1` (n=2 -> limite=3) o laco testa so k=0,1,2 — todos
    // ocupados — e sai sem `return`. O `return` de fora do laco devolve
    // `limite` (3, ja mutado): k=3, que TAMBEM esta ocupado, pelo segundo
    // bloco. A resposta errada deixa de coincidir com a certa aqui, e e por
    // isso que este segundo caso — e nao o de um obstaculo so, acima — e quem
    // obriga o multiplicador a ser `2 * passos.length + 1`.
    const passos = [passoEm(canto.x + 12, canto.y + 12), passoEm(canto.x + 60, canto.y + 60)];
    expect(lugarDoBlocoNovo(centro, passos)).toEqual({
      x: canto.x + 4 * DESVIO_DO_EMPILHAMENTO,
      y: canto.y + 4 * DESVIO_DO_EMPILHAMENTO,
    });
  });

  it("sempre acha lugar livre — nenhuma pilha devolve um canto ja ocupado", () => {
    // Vinte blocos plantados EM CIMA da diagonal, um por posicao, para provar
    // que o laco nao esgota e nao devolve posicao ocupada.
    const passos = Array.from({ length: 20 }, (_, k) =>
      passoEm(canto.x + k * DESVIO_DO_EMPILHAMENTO, canto.y + k * DESVIO_DO_EMPILHAMENTO)
    );
    const lugar = lugarDoBlocoNovo(centro, passos);
    const colide = passos.some(
      (p) =>
        Math.abs(p.pos!.x - lugar.x) < DESVIO_DO_EMPILHAMENTO &&
        Math.abs(p.pos!.y - lugar.y) < DESVIO_DO_EMPILHAMENTO
    );
    expect(colide).toBe(false);
  });
});
