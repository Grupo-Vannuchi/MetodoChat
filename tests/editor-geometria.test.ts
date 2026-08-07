import { describe, it, expect } from "vitest";
import {
  distanciaAoSegmento,
  setasAoAlcance,
  setaSobOPonto,
  alvoDoArraste,
  ALCANCE_DA_SETA,
} from "../app/automacoes/editor/geometria";
import type { Passo } from "../lib/steps";

// Um passo mínimo, só com a posição que a geometria lê. O `tipo`/`texto` são
// irrelevantes aqui — a geometria nunca os olha.
function passoEm(x: number, y: number): Passo {
  return { tipo: "dm", texto: "x", pos: { x, y } };
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

describe("setasAoAlcance / setaSobOPonto — dois blocos, uma seta", () => {
  // A(0,0) -> B(300,0), ambos sem medida (cai no palpite: LARGURA 190,
  // ALTURA 48). A alça de saída de A fica em (190,24); a de entrada de B em
  // (300,24). Como as duas alças estão na mesma altura, o traçado inteiro é
  // uma linha reta em y=24 entre x=190 e x=300 — o "meio" do smoothstep é
  // degenerado, e o caso vale exatamente porque isso acontece de verdade
  // (dois blocos na mesma linha).
  const passos = [passoEm(0, 0), passoEm(300, 0)];
  const identidades = ["0", "1"];
  const medidas = {};

  it("um ponto sobre a seta tem distância zero e é achado", () => {
    const r = setasAoAlcance({ x: 245, y: 24 }, passos, medidas, identidades, []);
    expect(r).toEqual([{ i: 0, d: 0 }]);
    expect(setaSobOPonto({ x: 245, y: 24 }, passos, medidas, identidades, [])).toBe(0);
  });

  it("respeita a lista `ignorar`", () => {
    expect(setaSobOPonto({ x: 245, y: 24 }, passos, medidas, identidades, [0])).toBeNull();
  });

  // A FRONTEIRA DO ALCANCE, NOS DOIS LADOS. `ALCANCE_DA_SETA` é comparado com
  // `<` estrito em `setasAoAlcance` — a distância exatamente igual ao alcance
  // já fica de fora.
  it("dentro do alcance: uma distância logo abaixo de ALCANCE_DA_SETA conta", () => {
    const d = ALCANCE_DA_SETA - 0.5;
    const alvo = setaSobOPonto({ x: 245, y: 24 + d }, passos, medidas, identidades, []);
    expect(alvo).toBe(0);
  });

  it("fora do alcance: a distância exatamente igual a ALCANCE_DA_SETA já não conta", () => {
    const alvo = setaSobOPonto(
      { x: 245, y: 24 + ALCANCE_DA_SETA },
      passos,
      medidas,
      identidades,
      []
    );
    expect(alvo).toBeNull();
  });

  it("fora do alcance: uma distância logo acima de ALCANCE_DA_SETA não conta", () => {
    const d = ALCANCE_DA_SETA + 0.5;
    const alvo = setaSobOPonto({ x: 245, y: 24 + d }, passos, medidas, identidades, []);
    expect(alvo).toBeNull();
  });
});

// O CASO MEDIDO NO NAVEGADOR (ver o comentário de `ALCANCE_DA_SETA` em
// `geometria.ts`): um bloco parado a 27,5 unidades de uma seta que não é
// vizinha dele, e um empurrão de poucos pixels na horizontal que NÃO muda a
// distância — porque o traçado ali é horizontal, e mexer ao longo dele não
// aproxima nem afasta. Com o alcance antigo (30) isso reordenava; com o
// atual (16) não reordena mais.
describe("o caso medido: 27,5 unidades de uma seta alheia", () => {
  const passos = [passoEm(0, 0), passoEm(300, 0)];
  const identidades = ["0", "1"];
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
    const d = distanciaAoSegmento(
      pontoParado.x,
      pontoParado.y,
      190,
      24,
      300,
      24
    );
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
    expect(setaSobOPonto(pontoParado, passos, medidas, identidades, [])).toBeNull();
    expect(setaSobOPonto(pontoEmpurrado, passos, medidas, identidades, [])).toBeNull();
  });
});

// A REGRA DAS SETAS JÁ AO ALCANCE NO INÍCIO DO GESTO (`alvoDoArraste`). Esta
// é a segunda defesa — a que fecha a CLASSE do defeito, e não só o caso
// medido: mesmo uma seta dentro do alcance atual (16) não pode ser
// "conquistada" só porque o bloco já nasceu perto dela.
describe("alvoDoArraste — a seta precisa ser conquistada pelo gesto", () => {
  // Cinco blocos: A(0) B(1) C(2) D(3) E(4). B é o bloco arrastado (índice 1).
  // A seta D->E (índice 3) não é vizinha de B (as vizinhas de B são as setas
  // 0 e 1). C fica fora do caminho (y=500) para não interferir na medição.
  const passos = [
    passoEm(0, 0), // A (0)
    passoEm(300, 0), // B (1) — o bloco arrastado
    passoEm(300, 500), // C (2) — fora do caminho de propósito
    passoEm(600, 0), // D (3)
    passoEm(900, 0), // E (4)
  ];
  const identidades = ["0", "1", "2", "3", "4"];
  const medidas = {};
  const indiceDoBlocoArrastado = 1;

  // A seta D->E vai de (600+190, 24) = (790,24) a (900,24). Um ponto a 10
  // unidades dela, dentro do alcance atual (16).
  const pontoPertoDeDE = { x: 845, y: 34 };

  it("confere a distância e que a seta 3 é mesmo a candidata (setup do teste)", () => {
    const r = setasAoAlcance(pontoPertoDeDE, passos, medidas, identidades, []);
    expect(r).toEqual([{ i: 3, d: 10 }]);
  });

  it("sem setas conquistadas no início, a seta 3 é um alvo válido", () => {
    const alvo = alvoDoArraste(
      pontoPertoDeDE,
      passos,
      medidas,
      identidades,
      indiceDoBlocoArrastado,
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
      indiceDoBlocoArrastado,
      new Set([3])
    );
    expect(alvo).toBeNull();
  });

  it("as setas que tocam o próprio bloco nunca são alvo, mesmo fora de setasNoInicio", () => {
    // Arrastando D (índice 3): a seta 3 (D->E) toca o próprio bloco, então
    // fica de fora mesmo sem ter sido marcada como já-ao-alcance.
    const alvo = alvoDoArraste(pontoPertoDeDE, passos, medidas, identidades, 3, new Set());
    expect(alvo).toBeNull();
  });
});

describe("setasAoAlcance — usa a medida real do bloco quando ela existe", () => {
  it("uma medida maior estica a alça de saída, e muda a seta encontrada", () => {
    const passos = [passoEm(0, 0), passoEm(300, 0)];
    const identidades = ["0", "1"];
    // Sem medida: alça de saída em x=190 (0 + LARGURA_DO_BLOCO palpite).
    // Com uma medida de largura 280, a alça de saída vai para x=280 — bem
    // mais perto de x=300, e a distância medida no eixo x muda de acordo.
    const semMedida = distanciaAoSegmento(200, 24, 190, 24, 300, 24);
    const comMedida = distanciaAoSegmento(200, 24, 280, 24, 300, 24);
    expect(semMedida).toBe(0); // x=200 cai dentro do vão 190–300
    expect(comMedida).toBe(80); // x=200 cai antes do vão 280–300 agora
    const medidas = { "0": { width: 280, height: 48 } };
    expect(setaSobOPonto({ x: 200, y: 24 }, passos, medidas, identidades, [])).toBeNull();
  });
});
