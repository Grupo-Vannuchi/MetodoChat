import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FORMAS_NO_LINKEDIN, soAFormaConhecidaDoLinkedin } from "@/lib/linkedin-publicacao";
import { AVISO_DO_REMARCAR_DA_FORMA_NOVA } from "@/lib/post-da-fila";

// A FORMA DO POST DO LINKEDIN QUE ESTE CÓDIGO CONHECE (a preparação da parte 3 do LinkedIn;
// docs/plans/2026-11-11-linkedin-forma-conhecida.md).
//
// O banco é um só para a produção e os previews. A parte 3 grava posts do LinkedIn de forma nova (o carrossel em PDF,
// o vídeo), e o dreno da produção, com o código de antes, pegaria a linha e a mandaria a `failed` por payload torto.
// O predicado deste arquivo é o que os quatro pontos do dreno e o remarcar usam para deixar essa linha intocada; o
// efeito dele contra o Postgres de verdade está em testes-integracao/dreno-forma-desconhecida.integracao.ts.

describe("as formas do post do LinkedIn que este código conhece", () => {
  it("são as que o ramo do dreno publica hoje: só texto, imagem e o carrossel em PDF (a parte 3a)", () => {
    expect([...FORMAS_NO_LINKEDIN]).toEqual(["texto", "imagem", "carrossel"]);
  });
});

describe("o predicado da forma conhecida", () => {
  it("deixa passar todo tipo que não é o post do LinkedIn, o post cuja forma não é texto, e a forma da lista", () => {
    expect(soAFormaConhecidaDoLinkedin("$5")).toBe(
      "(kind <> 'publicacao_linkedin' or jsonb_typeof(payload->'forma') is distinct from 'string' or payload->>'forma' = any($5::text[]))"
    );
  });

  it("aceita só um marcador de parâmetro ($ e número), para nenhum texto de fora entrar no SQL", () => {
    expect(soAFormaConhecidaDoLinkedin("$12")).toContain("any($12::text[])");
    expect(() => soAFormaConhecidaDoLinkedin("$5; drop table queue")).toThrow();
    expect(() => soAFormaConhecidaDoLinkedin("5")).toThrow();
    expect(() => soAFormaConhecidaDoLinkedin("$0")).toThrow();
    expect(() => soAFormaConhecidaDoLinkedin("")).toThrow();
  });
});

describe("o aviso do remarcar de um post de forma nova", () => {
  it("é erro, diz que esta versão ainda não publica o formato, e que nada foi remarcado", () => {
    expect(AVISO_DO_REMARCAR_DA_FORMA_NOVA).toEqual({
      tom: "erro",
      texto: "Este post do LinkedIn é de um formato que esta versão do painel ainda não publica. Ele não foi remarcado.",
    });
  });
});

// OS QUATRO PONTOS DO DRENO USAM O MESMO PREDICADO (nota da auditoria): a seleção, o tique do rodapé, os tiques do
// dia e o "agora". Um ponto sem ele pegaria, ou armaria tique por, a linha de forma nova. E o laço percorre o lote
// na ordem de `naOrdemDoLote` (lib/fila-tipos.ts).
describe("o dreno usa o predicado e a ordem do lote", () => {
  const dreno = readFileSync(join(process.cwd(), "lib/queue-drain.ts"), "utf8");

  it("o predicado da forma conhecida aparece nos quatro pontos, e só neles", () => {
    expect(dreno.match(/soAFormaConhecidaDoLinkedin\(/g)?.length).toBe(4);
    for (const ponto of [
      /export async function drenarUmaPublicacaoDoLinkedin[\s\S]*?soAFormaConhecidaDoLinkedin\([\s\S]*?returning \*/,
      /with lote as \([\s\S]*?soAFormaConhecidaDoLinkedin\([\s\S]*?for update skip locked/,
      /min\(not_before\)[\s\S]*?soAFormaConhecidaDoLinkedin\(/,
      /export async function armarTiquesDoDia[\s\S]*?soAFormaConhecidaDoLinkedin\(/,
    ]) {
      expect(dreno).toMatch(ponto);
    }
  });

  it("o laço do dreno percorre o lote na ordem de naOrdemDoLote", () => {
    expect(dreno.match(/for \(const item of naOrdemDoLote\(items\)\)/g)?.length).toBe(1);
    expect(dreno).not.toMatch(/for \(const item of items\)/);
  });
});

// O REMARCAR USA O MESMO PREDICADO (a preparação da parte 3): na gravação da hora nova e na leitura do status que
// separa a forma nova do "não encontrado". O cancelar não o usa: cancelar é a ação do dono, e vale para toda forma.
describe("o remarcar usa o predicado, e o cancelar não", () => {
  const acoes = readFileSync(join(process.cwd(), "app/publicar/post/actions.ts"), "utf8");
  const corpo = (nome: string) => {
    const inicio = acoes.indexOf(`export async function ${nome}(`);
    const fim = acoes.indexOf("\nexport async function ", inicio + 1);
    return acoes.slice(inicio, fim === -1 ? undefined : fim);
  };

  it("o predicado aparece duas vezes no arquivo: no update do remarcar e na leitura do status", () => {
    expect(acoes.match(/soAFormaConhecidaDoLinkedin\(/g)?.length).toBe(2);
    expect(corpo("remarcarPublicacao")).toMatch(/update queue set not_before[\s\S]*?soAFormaConhecidaDoLinkedin\(/);
    expect(acoes).toMatch(/async function statusNaConta[\s\S]*?soAFormaConhecidaDoLinkedin\([\s\S]*?\n\}/);
  });

  it("o remarcar recusa a forma nova com o aviso próprio, e o cancelar não fala dela", () => {
    expect(corpo("remarcarPublicacao")).toContain("AVISO_DO_REMARCAR_DA_FORMA_NOVA");
    expect(corpo("cancelarPublicacao")).not.toMatch(/soAFormaConhecidaDoLinkedin|AVISO_DO_REMARCAR_DA_FORMA_NOVA/);
  });
});
