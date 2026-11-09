// A POLÍTICA DE PRIVACIDADE E A EXCLUSÃO DE DADOS DIZEM O QUE O PAINEL GUARDA DO LINKEDIN
// (docs/specs/2026-11-06-linkedin-no-perfil.md, §7): o identificador, o nome e a autorização; para que serve;
// e como apagar. O app do LinkedIn pede o endereço da política, e as duas páginas falavam só do Instagram.
//
// O "DESCONECTAR" NÃO PROMETE O QUE NÃO FAZ (achado 206): o LinkedIn não tem como revogar a autorização de
// fora, então as duas páginas dizem que ela vence sozinha lá. As páginas são desenhadas em HTML de verdade,
// contra o banco descartável (elas leem a `config`).
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import { bancoDescartavel } from "./harness";

type ModuloPrivacidade = typeof import("@/app/privacidade/page");
type ModuloExclusao = typeof import("@/app/exclusao-de-dados/page");

bancoDescartavel();

let privacidade: ModuloPrivacidade;
let exclusao: ModuloExclusao;

beforeAll(async () => {
  privacidade = await import("@/app/privacidade/page");
  exclusao = await import("@/app/exclusao-de-dados/page");
});

// O `renderToStaticMarkup` troca as aspas por entidade; o texto lido é o que a pessoa vê.
const texto = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/\s+/g, " ");

describe("o LinkedIn nas páginas abertas de privacidade", () => {
  it("a política diz o que guarda do LinkedIn, para que serve e como apagar", async () => {
    const t = texto(renderToStaticMarkup(await privacidade.default()));
    expect(t).toContain("o identificador dele no LinkedIn, o nome e a autorização de publicar");
    expect(t).toContain("válida por 60 dias");
    expect(t).toContain("servem só para publicar no perfil dele o que for agendado no painel");
    expect(t).toContain('o administrador usa o "Desconectar" na Configuração, ou você faz o pedido de exclusão');
    expect(t).toContain("O aplicativo apaga a autorização e para de usá-la; no LinkedIn, ela vence sozinha em até 60 dias.");
  });

  it("a exclusão de dados diz o mesmo, sem prometer que o LinkedIn revoga", async () => {
    const t = texto(renderToStaticMarkup(await exclusao.default()));
    expect(t).toContain("o seu identificador no LinkedIn, o seu nome e a autorização de publicar");
    expect(t).toContain("no LinkedIn, ela vence sozinha em até 60 dias");
    expect(t).toContain('pelo "Desconectar" da Configuração');
    expect(t).not.toMatch(/revoga/i);
  });
});
