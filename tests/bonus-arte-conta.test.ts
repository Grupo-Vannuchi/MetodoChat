import { describe, expect, it } from "vitest";
import {
  contaParaGerarDeNovo,
  contaParaGuardar,
  contaSelecionada,
  iniciais,
  nomeQueFalta,
  resolverConta,
  type ContaDoCabecalho,
  type ContaGuardada,
} from "@/lib/bonus/arte-conta";

// A CONTA DO CARROSSEL (decisões do Eduardo em 02/10, spec da Etapa 4): o carrossel é da conta
// logada quando ele nasceu, e nunca vira de outra. Ele guarda o id, o nome e o @ dela. Conectada, a
// arte usa os dados atuais (com a foto); desconectada, os guardados (com as iniciais). A conta
// logada é a selecionada no painel (lib/account.ts): o cookie, e sem ele a primeira conectada.

const conta = (id: string, username: string): ContaDoCabecalho => ({
  ig_user_id: id,
  username,
  name: `Nome de ${username}`,
  profile_picture_url: `https://scontent.cdninstagram.com/${username}.jpg`,
});
const A = conta("1001", "thiagovannuchi");
const B = conta("1002", "n8x");
const CONTAS = [A, B];
const guardada = (id: string | null, nome: string | null = null, arroba: string | null = null): ContaGuardada => ({
  conta: id,
  nome,
  arroba,
});

describe("qual conta vai no cabeçalho", () => {
  it("a do carrossel, conectada: os dados atuais dela, com a foto", () => {
    expect(resolverConta(CONTAS, guardada("1002", "Nome antigo", "antigo"), "1001")).toEqual({ conta: B, origem: "gravada" });
  });

  it("a do carrossel, desconectada, com o nome guardado: o nome e o @ guardados, sem foto", () => {
    expect(resolverConta(CONTAS, guardada("7777", "N8X Oficial", "n8xoficial"), "1001")).toEqual({
      conta: { ig_user_id: "7777", username: "n8xoficial", name: "N8X Oficial", profile_picture_url: null },
      origem: "guardada",
    });
  });

  it("a do carrossel, desconectada, sem o nome guardado (gravada na Etapa 3): a logada, e diz que saiu", () => {
    expect(resolverConta(CONTAS, guardada("7777"), "1002")).toEqual({ conta: B, origem: "gravada_saiu" });
  });

  it("sem conta no carrossel: a logada, pelo cookie do painel", () => {
    expect(resolverConta(CONTAS, guardada(null), "1002")).toEqual({ conta: B, origem: "selecionada" });
  });

  it("sem conta e sem cookie válido: a primeira conectada, como o painel faz", () => {
    expect(resolverConta(CONTAS, guardada(null), undefined)).toEqual({ conta: A, origem: "selecionada" });
    expect(resolverConta(CONTAS, guardada(null), "9999")).toEqual({ conta: A, origem: "selecionada" });
  });

  it("sem conta nenhuma conectada, só a guardada com nome desenha o cabeçalho", () => {
    expect(resolverConta([], guardada("1001", "Thiago", "thiagovannuchi"), undefined).origem).toBe("guardada");
    expect(resolverConta([], guardada("1001"), "1001")).toEqual({ conta: null, origem: "gravada_saiu" });
    expect(resolverConta([], guardada(null), undefined)).toEqual({ conta: null, origem: "selecionada" });
  });
});

describe("a conta que o carrossel guarda ao nascer", () => {
  it("o id, o nome e o @ da conta", () => {
    expect(contaParaGuardar(B)).toEqual(guardada("1002", "Nome de n8x", "n8x"));
  });

  it("a logada: a do cookie, senão a primeira, senão nenhuma", () => {
    expect(contaSelecionada(CONTAS, "1002")).toBe(B);
    expect(contaSelecionada(CONTAS, "9999")).toBe(A);
    expect(contaSelecionada([], "1001")).toBeNull();
  });
});

// "GERAR DE NOVO" HERDA A CONTA DO ORIGINAL (decisão do Eduardo em 02/10), e não usa a logada agora:
// gerar de novo um carrossel do Thiago com o Chat na N8X faz outro do Thiago.
describe("a conta do Gerar de novo", () => {
  it("o original com conta e nome: herda os três, mesmo com a conta desconectada", () => {
    expect(contaParaGerarDeNovo(CONTAS, guardada("7777", "N8X Oficial", "n8xoficial"), "1001")).toEqual(
      guardada("7777", "N8X Oficial", "n8xoficial")
    );
  });

  it("o original com conta e sem nome, conectada: o nome e o @ vêm da tabela de contas", () => {
    expect(contaParaGerarDeNovo(CONTAS, guardada("1002"), "1001")).toEqual(guardada("1002", "Nome de n8x", "n8x"));
  });

  it("o original com conta e sem nome, desconectada: herda a conta sem nome, como o original", () => {
    expect(contaParaGerarDeNovo(CONTAS, guardada("7777"), "1001")).toEqual(guardada("7777"));
  });

  it("o original sem conta: a logada agora; sem conta nenhuma, nenhuma", () => {
    expect(contaParaGerarDeNovo(CONTAS, guardada(null), "1002")).toEqual(guardada("1002", "Nome de n8x", "n8x"));
    expect(contaParaGerarDeNovo([], guardada(null), undefined)).toBeNull();
  });
});

// O NOME QUE FALTA: os carrosséis que ganharam conta na Etapa 3 a guardaram sem o nome. As actions
// que já gravam num carrossel completam o nome e o @, quando a conta está conectada.
describe("o nome que falta", () => {
  it("conta conectada e sem nome: o nome e o @ da tabela", () => {
    expect(nomeQueFalta(CONTAS, guardada("1002"))).toEqual({ nome: "Nome de n8x", arroba: "n8x" });
  });

  it.each([
    ["com o nome já guardado", guardada("1002", "N8X", "n8x")],
    ["com a conta desconectada", guardada("7777")],
    ["sem conta", guardada(null)],
  ])("%s: nada a completar", (_nome, g) => {
    expect(nomeQueFalta(CONTAS, g)).toBeNull();
  });
});

// AS INICIAIS, quando a foto não vem: a mesma regra do Labs (site-ia, src/lib/foto-de-perfil.ts).
describe("as iniciais no lugar da foto", () => {
  it.each([
    ["Thiago Vannuchi", "TV"],
    ["Método Chat Oficial", "MO"],
    ["thiago", "TH"],
    ["  ", "IG"],
    [null, "IG"],
  ])("%j vira %s", (nome, esperado) => {
    expect(iniciais(nome, "IG")).toBe(esperado);
  });
});
