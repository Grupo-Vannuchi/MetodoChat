import { describe, it, expect } from "vitest";
import {
  motivoDoLoteVazio, textoDaRecusaDoLote, textoDoLoteEnviado,
  urlComAviso, urlDoAviso, avisoDaUrl, avisoDosPerfis,
} from "../lib/avisos";

describe("motivoDoLoteVazio", () => {
  // A ORDEM DOS MOTIVOS IMPORTA, e este caso é o que a segura: sem confirmação
  // E sem ninguém no filtro é possível ao mesmo tempo, e a frase útil é a que
  // diz o que FAZER — marcar a caixa —, não a que descreve o filtro.
  it("sem confirmacao vence, mesmo com o filtro vazio", () => {
    expect(motivoDoLoteVazio(false, true, 0)).toBe("sem_confirmacao");
  });
  // OS TRES VAZIOS SAO TRES CONSELHOS DIFERENTES. A primeira versao devolvia
  // "ninguem_no_filtro" para os tres, e o nome deste caso ja denunciava a
  // contradicao: ele afirma a distincao e media a ausencia dela.
  it("filtro que nao foi entendido nao e confundido com filtro vazio", () => {
    expect(motivoDoLoteVazio(true, false, 10)).toBe("filtro_ilegivel");
  });
  it("conta sem contato nenhum nao manda procurar outra categoria", () => {
    expect(motivoDoLoteVazio(true, true, 0)).toBe("conta_sem_contatos");
  });
  it("confirmado e com gente na conta, mas ninguem no recorte", () => {
    expect(motivoDoLoteVazio(true, true, 10)).toBe("ninguem_no_filtro");
  });
  // AS TRES FRASES TEM DE SER DIFERENTES DE FATO: motivos distintos que
  // devolvessem o mesmo texto seriam a mesma confusao, um andar acima.
  it("as tres frases de vazio sao distintas entre si", () => {
    const frases = (["filtro_ilegivel", "conta_sem_contatos", "ninguem_no_filtro"] as const)
      .map(textoDaRecusaDoLote);
    expect(new Set(frases).size).toBe(3);
  });
});

describe("urlComAviso", () => {
  // AS DUAS ARMADILHAS NUM CASO SÓ: "tudo" não tem parâmetro nenhum e o aviso
  // entra com "?"; "uma" já tem "?categoria=" e o aviso PRECISA entrar com "&".
  // Concatenar "?" nos dois casos produziria "?categoria=x?aviso=y", que o
  // Next lê como categoria = "x?aviso=y" — e o filtro do redirect passaria a
  // ser uma categoria que não existe.
  it("filtro tudo: o aviso entra com interrogacao", () => {
    expect(urlComAviso("/contatos", { tipo: "tudo" }, "enviado"))
      .toBe("/contatos?aviso=enviado");
  });
  it("filtro com nome: o aviso entra com e-comercial", () => {
    expect(urlComAviso("/contatos", { tipo: "uma", nome: "aluno" }, "enviado"))
      .toBe("/contatos?categoria=aluno&aviso=enviado");
  });
  // O CASO QUE E O CRITICO DE HOJE VOLTANDO POR OUTRA PORTA: "sem categoria" e
  // `?categoria=` PRESENTE E VAZIO. Se o redirect o perder, a tela volta
  // mostrando a conta inteira depois de um envio.
  it("a ficha sem categoria sobrevive ao redirect", () => {
    expect(urlComAviso("/contatos", { tipo: "uma", nome: null }, "enviado"))
      .toBe("/contatos?categoria=&aviso=enviado");
  });
  it("categoria com espaco e e-comercial continua codificada", () => {
    expect(urlComAviso("/contatos", { tipo: "uma", nome: "turma & cia" }, "enviado"))
      .toBe("/contatos?categoria=turma%20%26%20cia&aviso=enviado");
  });
});

describe("textoDoLoteEnviado", () => {
  it("diz o repartimento, e nao so 'enviado'", () => {
    expect(textoDoLoteEnviado(3, 0)).toContain("3");
    expect(textoDoLoteEnviado(3, 0)).toContain("agora");
  });
  it("o singular nao sai errado", () => {
    expect(textoDoLoteEnviado(1, 1)).not.toContain("1 pessoas");
  });
  it("tudo guardado NAO diz que alguem recebeu agora", () => {
    const t = textoDoLoteEnviado(0, 5);
    expect(t).toContain("5");
    expect(t.toLowerCase()).not.toMatch(/0 receber/);
  });
});

describe("avisoDaUrl", () => {
  it("aviso ausente e nulo", () => {
    expect(avisoDaUrl(undefined, undefined)).toBeNull();
  });
  // O TOM VEM DA URL, E A URL E DIGITAVEL: um tom desconhecido tem de cair em
  // "erro", e nunca virar classe de CSS montada com texto de fora.
  it("tom desconhecido cai em erro, e nao vira classe solta", () => {
    expect(avisoDaUrl("qualquer coisa", "roxo")?.tom).toBe("erro");
  });
});

// A URL do redirect precisa carregar DUAS coisas, e `urlComAviso` só carrega
// uma. `avisoDaUrl` lê `aviso` e `tom`, e um tom ausente cai em "erro" de
// propósito (tom desconhecido não pode virar classe de CSS montada com texto de
// fora) — então um aviso de SUCESSO enviado só com `urlComAviso` voltaria
// vermelho. É por isso que `urlDoAviso` existe, e é por isso que a ação não
// pode montar esse "&tom=" à mão.
describe("urlDoAviso", () => {
  it("o tom viaja junto com o texto", () => {
    expect(urlDoAviso("/contatos", { tipo: "tudo" }, { tom: "ok", texto: "3 receberam" })).toBe(
      "/contatos?aviso=3%20receberam&tom=ok"
    );
  });
  // O CRÍTICO DE 01/09 PELA TERCEIRA PORTA: `?categoria=` presente-e-vazio é a
  // ficha "sem categoria", e perdê-lo no redirect faz a tela voltar mostrando a
  // conta INTEIRA logo depois de um envio.
  it("nao perde o filtro presente-e-vazio", () => {
    expect(urlDoAviso("/contatos", { tipo: "uma", nome: null }, { tom: "erro", texto: "x" })).toBe(
      "/contatos?categoria=&aviso=x&tom=erro"
    );
  });
  it("o aviso volta inteiro de `avisoDaUrl`, e o filtro tambem", () => {
    const aviso = { tom: "ok", texto: "3 pessoas receberam agora · 0 guardadas" } as const;
    const u = new URL(urlDoAviso("/contatos", { tipo: "uma", nome: "aluno" }, aviso), "https://x");
    expect(
      avisoDaUrl(u.searchParams.get("aviso") ?? undefined, u.searchParams.get("tom") ?? undefined)
    ).toEqual(aviso);
    expect(u.searchParams.get("categoria")).toBe("aluno");
  });
  it("sem o tom, o sucesso voltaria vermelho — e e por isso que urlDoAviso existe", () => {
    const u = new URL(urlComAviso("/contatos", { tipo: "tudo" }, "deu certo"), "https://x");
    expect(
      avisoDaUrl(u.searchParams.get("aviso") ?? undefined, u.searchParams.get("tom") ?? undefined)
        ?.tom
    ).toBe("erro");
  });
});

describe("avisoDosPerfis", () => {
  it("perfil que veio e sucesso, e diz quantos", () => {
    const a = avisoDosPerfis(4, 10);
    expect(a.tom).toBe("ok");
    expect(a.texto).toContain("4");
  });
  // NENHUM PERFIL VEIO NÃO É SUCESSO. O botão roda 30 buscas na Meta e engole
  // cada falha; verde sobre zero seria a mesma mentira do silêncio, pintada.
  it("nenhum perfil veio NAO e sucesso", () => {
    expect(avisoDosPerfis(0, 10).tom).toBe("erro");
  });
  it("o singular nao sai errado", () => {
    expect(avisoDosPerfis(1, 1).texto).not.toContain("1 perfis");
  });
  // Nada a buscar é a ação terminando certo, e não uma falha: ninguém está sem
  // nome. (Acontece com dois cliques seguidos no botão.)
  it("nada para buscar nao e erro", () => {
    const a = avisoDosPerfis(0, 0);
    expect(a.tom).toBe("ok");
    expect(a.texto).not.toContain("0");
  });
});
