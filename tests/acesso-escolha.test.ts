import { describe, expect, it } from "vitest";
import { escolherConta } from "@/lib/acesso-escolha";

// A CONTA ESCOLHIDA DE UM LOGIN (docs/specs/2026-11-05-contas-por-login.md, seção 2). A parte que escolhe é
// pura: entram as contas que o login pode ver e o cookie, e sai uma delas, ou nenhuma. Quem monta a lista é
// lib/acesso.ts; esta função só escolhe nela, e por isso o cookie de uma conta de fora nunca é a resposta.
const A = { ig_user_id: "111", username: "conta_a" };
const B = { ig_user_id: "222", username: "conta_b" };
const C = { ig_user_id: "333", username: "conta_c" };

describe("a conta escolhida", () => {
  it("é a do cookie, quando ela está entre as permitidas", () => {
    expect(escolherConta([A, B], "222")).toBe(B);
  });

  it("é a primeira permitida quando o cookie é de uma conta de fora, e nunca a de fora", () => {
    expect(escolherConta([A, B], "333")).toBe(A);
    expect(escolherConta([B], C.ig_user_id)).toBe(B);
  });

  it("é a primeira permitida sem cookie, com o cookie vazio ou nulo", () => {
    for (const doCookie of [undefined, "", null]) {
      expect(escolherConta([A, B], doCookie), String(doCookie)).toBe(A);
    }
  });

  it("não existe quando o login não tem conta nenhuma, nem com cookie", () => {
    expect(escolherConta([], undefined)).toBeNull();
    expect(escolherConta([], "111")).toBeNull();
  });

  it("segue a ordem da lista, e não a do cookie nem a do id", () => {
    expect(escolherConta([C, A, B], undefined)).toBe(C);
    expect(escolherConta([B, A], "999")).toBe(B);
  });
});
