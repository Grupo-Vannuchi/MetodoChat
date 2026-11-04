import { describe, expect, it } from "vitest";
import {
  codigoDeSessaoBemFormado,
  FRASE_DA_ENTRADA_ERRADA,
  hashDaSenha,
  hashDoCodigoDeSessao,
  nomeValido,
  normalizarEmail,
  novoCodigoDeSessao,
  PARAMETROS_DO_SCRYPT,
  senhaConfere,
  senhaValida,
} from "@/lib/logins";

// AS REGRAS PURAS DOS LOGINS (docs/specs/2026-11-04-logins.md): o e-mail, o nome, a senha, o hash da senha
// e o código da sessão. Nenhuma toca o banco.

describe("o e-mail", () => {
  it("sai sem espaços nas pontas e em minúsculas", () => {
    expect(normalizarEmail("  Fulano.Silva@Exemplo.INVALID ")).toBe("fulano.silva@exemplo.invalid");
  });

  it("recusa o vazio, o sem arroba, o sem domínio, o com espaço no meio e o comprido demais", () => {
    expect(normalizarEmail("")).toBeNull();
    expect(normalizarEmail("   ")).toBeNull();
    expect(normalizarEmail("fulano.exemplo.invalid")).toBeNull();
    expect(normalizarEmail("fulano@exemplo")).toBeNull();
    expect(normalizarEmail("ful ano@exemplo.invalid")).toBeNull();
    const local = "a".repeat(64);
    const dominio = `${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(55)}.invalid`;
    expect(`${local}@${dominio}`.length).toBe(256);
    expect(normalizarEmail(`${local}@${dominio}`)).toBeNull();
    expect(normalizarEmail(`${local}@${dominio.slice(2)}`)).toBe(`${local}@${dominio.slice(2)}`);
  });
});

describe("o nome", () => {
  it("vai de 1 a 60 caracteres, sem os espaços das pontas", () => {
    expect(nomeValido("  Eduardo ")).toBe("Eduardo");
    expect(nomeValido("")).toBeNull();
    expect(nomeValido("   ")).toBeNull();
    expect(nomeValido("x".repeat(60))).toBe("x".repeat(60));
    expect(nomeValido("x".repeat(61))).toBeNull();
  });
});

describe("a senha", () => {
  it("vai de 10 a 200 caracteres", () => {
    expect(senhaValida("x".repeat(9))).toBe(false);
    expect(senhaValida("x".repeat(10))).toBe(true);
    expect(senhaValida("x".repeat(200))).toBe(true);
    expect(senhaValida("x".repeat(201))).toBe(false);
  });

  it("o hash leva o formato scrypt$N$r$p$sal$hash, com os parâmetros escolhidos", async () => {
    const h = await hashDaSenha("uma senha de teste");
    const partes = h.split("$");
    expect(partes).toHaveLength(6);
    expect(partes[0]).toBe("scrypt");
    expect(partes.slice(1, 4)).toEqual([
      String(PARAMETROS_DO_SCRYPT.N),
      String(PARAMETROS_DO_SCRYPT.r),
      String(PARAMETROS_DO_SCRYPT.p),
    ]);
    expect(Buffer.from(partes[4], "base64").length).toBe(16);
    expect(Buffer.from(partes[5], "base64").length).toBe(64);
  });

  it("a mesma senha dá hashes diferentes, e cada um confere", async () => {
    const a = await hashDaSenha("uma senha de teste");
    const b = await hashDaSenha("uma senha de teste");
    expect(a).not.toBe(b);
    expect(await senhaConfere("uma senha de teste", a)).toBe(true);
    expect(await senhaConfere("uma senha de teste", b)).toBe(true);
  });

  it("a senha errada não confere", async () => {
    const h = await hashDaSenha("uma senha de teste");
    expect(await senhaConfere("uma senha de testE", h)).toBe(false);
    expect(await senhaConfere("", h)).toBe(false);
  });

  it("um hash torto é recusado sem estourar", async () => {
    for (const torto of ["", "scrypt", "scrypt$1$8$1$x$y", "bcrypt$16384$8$1$AAAA$BBBB", "scrypt$abc$8$1$AAAA$BBBB"]) {
      expect(await senhaConfere("uma senha de teste", torto), torto).toBe(false);
    }
  });

  it("confere um hash feito com outro N, porque o N mora no próprio hash", async () => {
    const { scryptSync, randomBytes } = await import("node:crypto");
    const sal = randomBytes(16);
    const hash = scryptSync("uma senha de teste", sal, 64, { N: 16384, r: 8, p: 1 });
    const guardado = `scrypt$16384$8$1$${sal.toString("base64")}$${hash.toString("base64")}`;
    expect(await senhaConfere("uma senha de teste", guardado)).toBe(true);
    expect(await senhaConfere("outra senha qualquer", guardado)).toBe(false);
  });
});

describe("o código da sessão", () => {
  it("tem 43 caracteres base64url e não se repete", () => {
    const vistos = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const c = novoCodigoDeSessao();
      expect(codigoDeSessaoBemFormado(c)).toBe(true);
      vistos.add(c);
    }
    expect(vistos.size).toBe(1000);
  });

  it("o hash tem 64 hex e é o mesmo para o mesmo código", () => {
    const c = novoCodigoDeSessao();
    expect(hashDoCodigoDeSessao(c)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashDoCodigoDeSessao(c)).toBe(hashDoCodigoDeSessao(c));
  });

  it("o formato torto é recusado, inclusive o cookie v2 de antes", () => {
    for (const torto of [undefined, "", "a".repeat(42), "a".repeat(44), `${"a".repeat(42)}=`, "v2.1790000000.abcdef"]) {
      expect(codigoDeSessaoBemFormado(torto), String(torto)).toBe(false);
    }
  });
});

describe("a frase da entrada errada", () => {
  it("é uma só, e não diz se o erro foi o e-mail ou a senha", () => {
    expect(FRASE_DA_ENTRADA_ERRADA).toBe("E-mail ou senha incorretos.");
  });
});
