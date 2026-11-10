import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// A AUTORIZAÇÃO DO LINKEDIN NUNCA VAI AO NAVEGADOR (docs/specs/2026-11-06-linkedin-no-perfil.md, §2), no molde
// do achado 60 (tests/bonus-arte-paginas.test.ts): a `linkedin_conexoes` guarda o token em texto puro, e só
// lib/linkedin-conexoes.ts a lê. As telas recebem o resumo (o nome e o vencimento), e nada mais.
//
// ESTE ARQUIVO VALE PARA O QUE AINDA NÃO EXISTE: ele procura os arquivos em vez de uma lista. Um componente de
// cliente novo que importe o repositório, ou um ponto novo que leia a linha inteira, faz ele cair.

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const ler = (rel: string) => readFileSync(join(RAIZ, rel), "utf8");

function arquivosDe(pasta: string): string[] {
  const saida: string[] = [];
  const andar = (abs: string) => {
    for (const nome of readdirSync(abs)) {
      const caminho = join(abs, nome);
      if (statSync(caminho).isDirectory()) andar(caminho);
      else if (/\.tsx?$/.test(nome)) saida.push(relative(RAIZ, caminho).split(sep).join("/"));
    }
  };
  andar(join(RAIZ, pasta));
  return saida.sort();
}

const CODIGO = [...arquivosDe("app"), ...arquivosDe("lib")];
const ehCliente = (fonte: string) => /^\s*(?:\/\/[^\n]*\n\s*)*["']use client["']/.test(fonte);
const IMPORTA_O_REPOSITORIO = /from\s+["'](?:@\/lib\/|\.{1,2}\/(?:[\w.-]+\/)*)linkedin-conexoes["']/;
const IMPORTA_O_CLIENTE = /from\s+["'](?:@\/lib\/|\.{1,2}\/(?:[\w.-]+\/)*)linkedin["']/;

describe("a autorização do LinkedIn fica no servidor", () => {
  it("nenhum componente de cliente importa o repositório da conexão nem o cliente do LinkedIn", () => {
    const clientes = CODIGO.filter((rel) => ehCliente(ler(rel)));
    expect(clientes.length).toBeGreaterThan(0);
    const errados = clientes.filter((rel) => IMPORTA_O_REPOSITORIO.test(ler(rel)) || IMPORTA_O_CLIENTE.test(ler(rel)));
    expect(errados).toEqual([]);
  });

  it("só estes arquivos importam o repositório da conexão", () => {
    const importam = CODIGO.filter((rel) => IMPORTA_O_REPOSITORIO.test(ler(rel)));
    // A parte 2a: a tela de compor e a action de publicar leem só o resumo (a disponibilidade do LinkedIn).
    expect(importam).toEqual([
      "app/publicar/actions.ts",
      "app/publicar/novo/page.tsx",
      "app/setup/actions.ts",
      "app/setup/page.tsx",
      "lib/convites-repositorio.ts",
      "lib/linkedin-fila.ts",
    ]);
  });

  it("a tela de compor e a action de publicar leem só o resumo", () => {
    for (const rel of ["app/publicar/actions.ts", "app/publicar/novo/page.tsx"]) {
      const fonte = ler(rel);
      expect(fonte, rel).toMatch(/\bresumoDaConexao\(/);
      expect(fonte, rel).not.toMatch(/conexaoDaConta|access_token|accessToken/);
    }
  });

  it("a linha inteira, com o token, só sai pela conexaoDaConta, e só o post da fila a chama", () => {
    // A parte 2a: o post do LinkedIn pela fila (lib/linkedin-fila.ts, chamado pelo dreno) é o único que precisa da
    // autorização.
    const chamam = CODIGO.filter((rel) => rel !== "lib/linkedin-conexoes.ts" && /\bconexaoDaConta\b/.test(ler(rel)));
    expect(chamam).toEqual(["lib/linkedin-fila.ts"]);
  });

  it("a Configuração lê só os resumos, e o componente de cliente dela não fala de token", () => {
    const pagina = ler("app/setup/page.tsx");
    expect(pagina).toMatch(/\bresumosDasConexoes\(/);
    const tela = ler("app/setup/linkedin-das-contas.tsx");
    expect(ehCliente(tela)).toBe(true);
    expect(tela).not.toMatch(/access_token|accessToken|pessoa_id/);
  });
});
