import { describe, expect, it } from "vitest";
import {
  FRASE_DO_LINK_QUE_NAO_VALE,
  FRASE_DO_MOTIVO,
  LIMITE_DO_ERRO,
  LIMITE_DO_PARA_QUEM,
  VALIDADE_DO_CONVITE_DIAS,
  codigoBemFormado,
  estadoDoConvite,
  hashDoCodigo,
  motivoDoErro,
  novoCodigoDeConvite,
  paraQuemDoFormulario,
  textoParaOPainel,
} from "@/lib/convites";

// O LINK DE CONVITE (docs/specs/2026-11-03-link-de-convite.md): as regras puras. O relógio é fixo,
// para a fronteira do vencimento não depender da máquina.
const AGORA = Date.UTC(2026, 10, 3, 15, 0, 0);

describe("o código do link", () => {
  it("tem 32 bytes em base64url (43 caracteres) e não se repete", () => {
    const codigos = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const c = novoCodigoDeConvite();
      expect(c).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(codigoBemFormado(c)).toBe(true);
      codigos.add(c);
    }
    expect(codigos.size).toBe(1000);
  });

  it("recusa o que não tem o formato antes de qualquer consulta", () => {
    expect(codigoBemFormado("")).toBe(false);
    expect(codigoBemFormado("a".repeat(42))).toBe(false);
    expect(codigoBemFormado("a".repeat(44))).toBe(false);
    expect(codigoBemFormado(`${"a".repeat(42)}=`)).toBe(false);
    expect(codigoBemFormado(`${"a".repeat(42)}/`)).toBe(false);
  });

  it("o banco guarda o SHA-256 em hex, o mesmo para o mesmo código, e nunca o código", () => {
    const c = novoCodigoDeConvite();
    expect(hashDoCodigo(c)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashDoCodigo(c)).toBe(hashDoCodigo(c));
    expect(hashDoCodigo(c)).not.toBe(hashDoCodigo(novoCodigoDeConvite()));
    expect(hashDoCodigo(c)).not.toContain(c);
    // O vetor fixo do SHA-256 de "abc": a função é a de sempre, e não uma variação.
    expect(hashDoCodigo("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("o estado do convite", () => {
  const base = { cancelado_em: null, usado_em: null, expira_em: new Date(AGORA + 1000) };

  it("é pendente até vencer, e vence no próprio instante do prazo", () => {
    expect(VALIDADE_DO_CONVITE_DIAS).toBe(7);
    expect(estadoDoConvite(base, AGORA)).toBe("pendente");
    expect(estadoDoConvite({ ...base, expira_em: new Date(AGORA) }, AGORA)).toBe("vencido");
    expect(estadoDoConvite({ ...base, expira_em: new Date(AGORA - 1) }, AGORA)).toBe("vencido");
    expect(estadoDoConvite({ ...base, expira_em: new Date(AGORA).toISOString() }, AGORA)).toBe("vencido");
  });

  it("o cancelado vence o usado, e o usado vence o vencido", () => {
    const t = new Date(AGORA - 5000);
    expect(estadoDoConvite({ ...base, usado_em: t }, AGORA)).toBe("usado");
    expect(estadoDoConvite({ ...base, cancelado_em: t }, AGORA)).toBe("cancelado");
    expect(estadoDoConvite({ ...base, cancelado_em: t, usado_em: t }, AGORA)).toBe("cancelado");
    expect(estadoDoConvite({ cancelado_em: null, usado_em: t, expira_em: t }, AGORA)).toBe("usado");
  });
});

describe("o \"para quem\"", () => {
  it("aceita de 1 a 60 caracteres, sem os espaços das pontas", () => {
    expect(LIMITE_DO_PARA_QUEM).toBe(60);
    expect(paraQuemDoFormulario("  Dr. Marcus  ")).toBe("Dr. Marcus");
    expect(paraQuemDoFormulario("x".repeat(60))).toBe("x".repeat(60));
    expect(paraQuemDoFormulario("ç".repeat(60))).toBe("ç".repeat(60));
  });

  it("recusa o vazio, só espaços, 61 caracteres e o que não é texto", () => {
    expect(paraQuemDoFormulario("")).toBeNull();
    expect(paraQuemDoFormulario("   ")).toBeNull();
    expect(paraQuemDoFormulario("x".repeat(61))).toBeNull();
    expect(paraQuemDoFormulario(null)).toBeNull();
    expect(paraQuemDoFormulario(42)).toBeNull();
  });

  it("conta caractere, e não pedaço de UTF-16, como o char_length do banco", () => {
    expect(paraQuemDoFormulario("😀".repeat(60))).toBe("😀".repeat(60));
    expect(paraQuemDoFormulario("😀".repeat(61))).toBeNull();
  });
});

describe("o que o cliente lê quando dá errado", () => {
  it("só os três motivos da lista viram frase, e qualquer outro vira \"falhou\"", () => {
    expect(motivoDoErro("negado")).toBe("negado");
    expect(motivoDoErro("vencido")).toBe("vencido");
    expect(motivoDoErro("falhou")).toBe("falhou");
    expect(motivoDoErro("Instagram API 400: algo")).toBe("falhou");
    expect(motivoDoErro(null)).toBe("falhou");
    expect(motivoDoErro(["negado"])).toBe("falhou");
    expect(Object.keys(FRASE_DO_MOTIVO).sort()).toEqual(["falhou", "negado", "vencido"]);
  });

  it("a página do link que não vale tem uma frase só", () => {
    expect(FRASE_DO_LINK_QUE_NAO_VALE).toBe("Este link não vale mais. Peça um novo a quem te mandou.");
  });
});

describe("o texto do erro que vai para o painel (achado 159)", () => {
  it("troca os segredos por OCULTO: a query da Meta, o code, o token e o código do convite", () => {
    const code = "AQBcodigoDaVoltaDoInstagram123";
    const token = "IGAAtokenLongoDeVerdade456";
    const codigo = novoCodigoDeConvite();
    const texto = textoParaOPainel(
      `falhou com access_token=xyz&client_secret=abc code=${code} token ${token} link ${codigo}`,
      [code, token, codigo]
    );
    expect(texto).not.toContain("xyz");
    expect(texto).not.toContain("=abc");
    expect(texto).not.toContain(code);
    expect(texto).not.toContain(token);
    expect(texto).not.toContain(codigo);
    expect(texto).toContain("access_token=OCULTO");
    expect(texto).toContain("OCULTO");
  });

  it("corta em 160 caracteres, e corta depois de trocar, para não sobrar pedaço de segredo", () => {
    expect(LIMITE_DO_ERRO).toBe(160);
    expect(textoParaOPainel("x".repeat(400), [])).toHaveLength(160);
    expect(textoParaOPainel("curto", [])).toBe("curto");
    const segredo = "S".repeat(30);
    const texto = textoParaOPainel(`${"x".repeat(150)}${segredo}`, [segredo]);
    expect(texto).not.toContain("SSS");
    expect(texto).toHaveLength(156);
  });

  it("ignora segredo vazio ou ausente", () => {
    expect(textoParaOPainel("abc", ["", null, undefined])).toBe("abc");
  });
});
