import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { imagemJaFalhou } from "@/lib/imagem-quebrada";

// O RECUO DA IMAGEM QUEBRADA — a decisão pura, e o portão que prende a fiação
// dela aos três componentes que a usam.
//
// O DEFEITO, medido na produção em 16/09/2026: `app/avatar.tsx` já tinha um
// `onError` para trocar foto vencida pela inicial, e ele não funcionava no caso
// comum. 13 de 46 fotos em `/conversas` e 7 de 30 em `/contatos` ficavam como
// círculo cinza vazio. A causa está inteira no cabeçalho de
// `lib/imagem-quebrada.ts`: o `error` dispara antes de o React hidratar, e o
// React não o redispara para imagem que já falhou.

describe("imagemJaFalhou", () => {
  it("acusa a imagem que terminou de tentar e não tem largura", () => {
    expect(imagemJaFalhou({ complete: true, naturalWidth: 0 })).toBe(true);
  });

  it("NÃO acusa a imagem que carregou", () => {
    expect(imagemJaFalhou({ complete: true, naturalWidth: 320 })).toBe(false);
  });

  it("NÃO acusa a imagem que AINDA está baixando", () => {
    // Este é o caso que `naturalWidth === 0` sozinho estragaria: enquanto a foto
    // não chegou, ela também não tem largura. Acusar aqui trocaria toda foto boa
    // pela inicial antes de ela ter chance de aparecer.
    expect(imagemJaFalhou({ complete: false, naturalWidth: 0 })).toBe(false);
  });

  it("NÃO acusa a imagem grande que ainda está baixando", () => {
    expect(imagemJaFalhou({ complete: false, naturalWidth: 320 })).toBe(false);
  });

  it("acusa o `<img>` SEM src — e quem chama é que precisa saber disso", () => {
    // Estado nomeado de propósito, apontado pela revisão de 16/09: um `<img>`
    // sem `src` tem `complete === true` por especificação e largura zero, então
    // esta função responde "falhou". Está certo para o que ela mede — "a
    // tentativa terminou sem imagem" —, e é inalcançável pelos três chamadores
    // de hoje, que só montam o `<img>` quando há `src`. Fica escrito porque a
    // função é exportada, e o próximo chamador é quem pagaria a conta.
    expect(imagemJaFalhou({ complete: true, naturalWidth: 0 })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// O PORTÃO, e por que ele é textual.
//
// A suíte padrão deste repositório NÃO TEM DOM — `vitest.config.ts` diz isso
// com todas as letras, e não há jsdom nem testing-library instalados. Então
// nada aqui consegue montar os componentes e ver o recuo acontecer. O que dá
// para prender é a FIAÇÃO: que os três usam o MESMO dono da regra, e que as
// duas redes estão penduradas NO `<img>` — não em qualquer lugar do arquivo.
//
// Sem isto, apagar o `ref={aoMontar}` devolveria o defeito de 16/09 com a suíte
// inteira verde — que é exatamente como este defeito nasceu. Mesma forma de
// `tests/vocabulario-da-fila.test.ts` e do portão de `tests/cache-da-capa.test.ts`.
//
// TRÊS FRESTAS QUE A REVISÃO DE 16/09 ABRIU NA PRIMEIRA VERSÃO, e que a forma
// abaixo fecha — vale saber quais foram, porque são o motivo de cada linha:
//   1. pedir só o nome `imagemJaFalhou` deixava a linha de `import` pagar a
//      conta, e o plantio que troca a chamada por um `if` inline passava verde;
//   2. pedir `ref={` em qualquer lugar do arquivo deixava pendurar a rede no
//      `<span>` do recuo — elemento errado — com tudo verde;
//   3. ler a fonte só sem COMENTÁRIO deixava uma string qualquer servir de
//      álibi. Agora caem comentário E literal de texto.
function semComentariosNemTexto(fonte: string): string {
  // `semComentarios` é de `tests/escala.test.ts`, com crédito. O `//` só cai
  // quando NÃO vem depois de `:`, para `https://` continuar inteiro.
  const semComentarios = fonte
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
  // E os literais de texto, para menção em string não pagar a conta.
  return semComentarios
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''");
}

/** O trecho da tag `<img ...>`, que é onde as redes precisam estar penduradas. */
function tagDaImagem(fonte: string): string {
  const i = fonte.indexOf("<img");
  if (i < 0) return "";
  const f = fonte.indexOf("/>", i);
  return f < 0 ? "" : fonte.slice(i, f + 2);
}

const DONO = "app/usar-imagem-quebrada.ts";

// Os três componentes que mostram imagem de URL assinada da Meta, que VENCE.
const CHAMADORES = [
  { arquivo: "app/avatar.tsx", oQueMostra: "a foto do contato" },
  { arquivo: "app/automacoes/editor/previa.tsx", oQueMostra: "a foto da conta na prévia" },
  { arquivo: "app/conversas/[id]/anexo-imagem.tsx", oQueMostra: "o anexo da mensagem" },
];

function ler(caminho: string): string {
  return semComentariosNemTexto(
    readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8")
  );
}

describe("o dono da regra das duas redes", () => {
  const fonte = ler(DONO);

  it("enxerga o arquivo que diz enxergar", () => {
    // Uma varredura de arquivo vazio passa por vacuidade. Este caso impede isso.
    expect(fonte).toContain("export function useImagemQuebrada");
    expect(fonte.length).toBeGreaterThan(400);
  });

  it("pergunta na MONTAGEM, chamando `imagemJaFalhou(` de verdade", () => {
    expect(
      fonte.includes("imagemJaFalhou("),
      `A REDE DA MONTAGEM SUMIU: \`${DONO}\` não CHAMA mais \`imagemJaFalhou(\`. ` +
        "Sem ela volta o defeito medido em 16/09/2026 — a URL assinada da Meta " +
        "vence, o `error` dispara ANTES de o React hidratar, o `onError` nunca é " +
        "avisado, e sobra um círculo cinza vazio no lugar da inicial. Eram 13 de " +
        "46 em /conversas e 7 de 30 em /contatos. O parêntese é exigido de " +
        "propósito: sem ele, a linha de `import` sozinha pagava a conta e um `if` " +
        "inline passava verde. Ver lib/imagem-quebrada.ts."
    ).toBe(true);
  });

  it("o recuo é por `src`, e não por um booleano grudento", () => {
    expect(
      fonte.includes("srcQueFalhou === atual"),
      `O RECUO VOLTOU A SER BOOLEANO: \`${DONO}\` precisa comparar QUAL \`src\` ` +
        "falhou com o `src` de agora. Numa lista o React reaproveita o componente " +
        "por POSIÇÃO — a linha 3 de /conversas é a mesma instância quando a " +
        "conversa que ocupa a linha 3 muda —, e um booleano fica grudado e esconde " +
        "a foto BOA da pessoa seguinte."
    ).toBe(true);
  });

  it("entrega as DUAS redes, e elas são diferentes uma da outra", () => {
    expect(fonte).toContain("aoMontar");
    expect(fonte).toContain("aoErro");
  });
});

describe.each(CHAMADORES)("$arquivo pendura as duas redes no <img>", ({ arquivo, oQueMostra }) => {
  const fonte = ler(arquivo);
  const img = tagDaImagem(fonte);

  it("enxerga a tag que diz enxergar", () => {
    expect(
      img.length,
      `SEM <img> EM \`${arquivo}\`: o portão não achou a tag, então ele não mede ` +
        "nada neste arquivo. Se a imagem saiu de vez, tire este arquivo da lista " +
        "CHAMADORES; se ela só mudou de forma, ajuste `tagDaImagem`."
    ).toBeGreaterThan(20);
  });

  it("usa o dono da regra, e não uma cópia local", () => {
    expect(
      fonte.includes("useImagemQuebrada("),
      `CÓPIA DA REGRA EM \`${arquivo}\`: ele mostra ${oQueMostra}, cuja URL é ` +
        `assinada pela Meta e VENCE, e precisa chamar \`useImagemQuebrada(\` de ` +
        `\`${DONO}\`. Um \`useState\` local parece igual e diverge em silêncio — ` +
        "foi assim que /automacoes ficou com 19 de 22 miniaturas quebradas em " +
        "15/09/2026 enquanto /eventos, com a mesma regra, estava certa."
    ).toBe(true);
  });

  it("a rede da montagem está no <img>, e não em outro elemento", () => {
    expect(
      img.includes("ref={aoMontar}"),
      `REDE NO ELEMENTO ERRADO em \`${arquivo}\`: \`ref={aoMontar}\` precisa estar ` +
        "DENTRO da tag `<img>`. Pendurada no `<span>` do recuo, ou em qualquer " +
        "outro nó, ela nunca recebe a imagem e o defeito de 16/09 volta — com a " +
        "suíte verde, porque procurar `ref={` no arquivo inteiro não distingue os " +
        "dois casos."
    ).toBe(true);
  });

  it("a rede do DEPOIS está no <img>, e chama o mesmo dono", () => {
    expect(
      img.includes("onError={aoErro}"),
      `SEGUNDA REDE FROUXA em \`${arquivo}\`: o \`<img>\` precisa de ` +
        "`onError={aoErro}`, o handler do dono da regra. Um `onError` qualquer — " +
        "inclusive `onError={() => {}}` — satisfaz uma busca por `onError={` e não " +
        "protege nada. É esta rede que pega a URL que vence com a aba aberta."
    ).toBe(true);
  });
});

describe("a contraprova do próprio portão", () => {
  it("não se satisfaz com menção em comentário nem em string", () => {
    const alibi = semComentariosNemTexto(
      '// imagemJaFalhou( ref={aoMontar} onError={aoErro}\n' +
        'const NOTA = "useImagemQuebrada( ref={aoMontar} onError={aoErro}";\n'
    );
    expect(alibi).not.toContain("imagemJaFalhou(");
    expect(alibi).not.toContain("useImagemQuebrada(");
    expect(alibi).not.toContain("ref={aoMontar}");
  });

  it("`tagDaImagem` recorta a tag, e não o arquivo inteiro", () => {
    const falso = '<span ref={aoMontar} />\n<img src={x} onError={aoErro} />\n<b>fim</b>';
    const recorte = tagDaImagem(falso);
    expect(recorte).toContain("onError={aoErro}");
    expect(recorte).not.toContain("<span");
    expect(recorte).not.toContain("<b>");
  });
});
