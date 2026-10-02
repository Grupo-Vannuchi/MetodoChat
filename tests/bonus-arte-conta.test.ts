import { describe, expect, it } from "vitest";
import { iniciais, resolverConta, type ContaDoCabecalho } from "@/lib/bonus/arte-conta";

// A CONTA DO CABEÇALHO DA ARTE (decisões do Eduardo em 01/10): a gravada no carrossel; sem ela, a
// selecionada no Chat agora; e a gravada que foi desconectada cai na selecionada, com aviso
// (achado 61). A selecionada segue a regra do painel (lib/account.ts): o cookie, e sem ele a
// primeira conectada.

const conta = (id: string, username: string): ContaDoCabecalho => ({
  ig_user_id: id,
  username,
  name: `Nome de ${username}`,
  profile_picture_url: null,
});
const A = conta("1001", "thiagovannuchi");
const B = conta("1002", "outraconta");
const CONTAS = [A, B];

describe("qual conta vai no cabeçalho", () => {
  it("a gravada no carrossel, quando ela ainda está conectada", () => {
    expect(resolverConta(CONTAS, "1002", "1001")).toEqual({ conta: B, origem: "gravada" });
  });

  it("sem gravada, a selecionada pelo cookie do painel", () => {
    expect(resolverConta(CONTAS, null, "1002")).toEqual({ conta: B, origem: "selecionada" });
  });

  it("sem gravada e sem cookie válido, a primeira conectada, como o painel faz", () => {
    expect(resolverConta(CONTAS, null, undefined)).toEqual({ conta: A, origem: "selecionada" });
    expect(resolverConta(CONTAS, null, "9999")).toEqual({ conta: A, origem: "selecionada" });
  });

  it("a gravada que foi desconectada cai na selecionada, e diz que saiu (achado 61)", () => {
    expect(resolverConta(CONTAS, "7777", "1002")).toEqual({ conta: B, origem: "gravada_saiu" });
  });

  it("sem conta nenhuma conectada, não há cabeçalho", () => {
    expect(resolverConta([], "1001", "1001")).toEqual({ conta: null, origem: "gravada_saiu" });
    expect(resolverConta([], null, undefined)).toEqual({ conta: null, origem: "selecionada" });
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
