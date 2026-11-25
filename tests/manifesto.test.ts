import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import { LADOS_DO_ICONE } from "@/lib/desenho-do-icone";
import { DESCRICAO_DO_PAINEL } from "@/lib/marca";

// O MANIFESTO DO CELULAR (docs/specs/2026-11-24-celular-onda-1.md, "Os testes").
//
// O manifesto é o que deixa pôr o painel na tela inicial do celular. O primeiro caso confere o que a spec decidiu:
// o nome, o endereço de início, o abrir sem a barra do navegador e as duas cores do sistema.
//
// A DESCRIÇÃO TEM UMA FONTE SÓ (o achado 343): o layout e o manifesto usam a constante de lib/marca.ts. Comparar
// os valores não bastaria, porque um texto escrito à mão igual passaria hoje e divergiria na próxima mudança. Por
// isso o segundo caso lê o código dos dois arquivos, como tests/layout-contas.test.ts faz com o layout.

const RAIZ = fileURLToPath(new URL("..", import.meta.url));

/** O código de cada valor das propriedades `<nome>:` de um arquivo (o identificador ou o literal, como texto). */
function valoresDe(caminho: string, nome: string): string[] {
  const fonte = readFileSync(`${RAIZ}${caminho}`, "utf8");
  const sf = ts.createSourceFile(caminho, fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const achados: string[] = [];
  const visitar = (n: ts.Node) => {
    if (ts.isPropertyAssignment(n) && ts.isIdentifier(n.name) && n.name.text === nome) {
      achados.push(n.initializer.getText(sf));
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return achados;
}

describe("o manifesto do celular", () => {
  it("abre o painel sem a barra do navegador, no endereço de início, com o nome e as cores da marca", () => {
    const m = manifest();
    expect(m.name).toBe("MetodoChat");
    expect(m.short_name).toBe("MetodoChat");
    expect(m.lang).toBe("pt-BR");
    expect(m.start_url).toBe("/");
    expect(m.display).toBe("standalone");
    expect(m.background_color).toBe("#0b0a0e");
    expect(m.theme_color).toBe("#0b0a0e");
    expect(m.description).toBe(DESCRICAO_DO_PAINEL);
  });

  it("tira a descrição da mesma constante que o layout usa", () => {
    expect(valoresDe("app/manifest.ts", "description")).toEqual(["DESCRICAO_DO_PAINEL"]);
    expect(valoresDe("app/layout.tsx", "description")).toEqual(["DESCRICAO_DO_PAINEL"]);
  });

  // OS ÍCONES DO MANIFESTO SAEM DOS LADOS QUE O app/icon.tsx GERA (lib/desenho-do-icone.tsx). Um tamanho mudado
  // num lado e não no outro faria o manifesto apontar para um /icon/… que não existe, e o celular não instalaria.
  it("aponta os ícones da tela inicial para os tamanhos que o app/icon.tsx gera", () => {
    const icones = manifest().icons ?? [];
    expect(icones.map((i) => i.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    for (const i of icones) {
      const lado = Number(i.src.replace("/icon/", ""));
      expect(LADOS_DO_ICONE, i.src).toContain(lado);
      expect(i.src).toBe(`/icon/${lado}`);
      expect(i.sizes).toBe(`${lado}x${lado}`);
      expect(i.type).toBe("image/png");
    }
    expect(icones.some((i) => i.purpose === "maskable" && i.sizes === "512x512")).toBe(true);
  });
});
