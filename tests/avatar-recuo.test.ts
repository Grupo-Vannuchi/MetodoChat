import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { imagemJaFalhou } from "@/lib/imagem-quebrada";

// O RECUO DO AVATAR PARA A INICIAL — a decisão pura, e o portão que prende a
// fiação dela ao componente.
//
// O DEFEITO, medido na produção em 16/09/2026: `app/avatar.tsx` já tinha um
// `onError` para trocar foto vencida pela inicial, e ele não funcionava no caso
// comum. 13 de 46 fotos em `/conversas` e 7 de 30 em `/contatos` ficavam como
// círculo cinza vazio. A causa está inteira no cabeçalho de
// `lib/imagem-quebrada.ts`: o `error` dispara antes de o React hidratar, e o
// React não o redispara para imagem que já falhou.

const RAIZ = fileURLToPath(new URL("..", import.meta.url));

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
    // `complete: false` manda, mesmo que alguma largura já se conheça.
    expect(imagemJaFalhou({ complete: false, naturalWidth: 320 })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// O PORTÃO, e por que ele é textual.
//
// A suíte padrão deste repositório NÃO TEM DOM — `vitest.config.ts` diz isso
// com todas as letras, e não há jsdom nem testing-library instalados. Então
// nada aqui consegue montar `<Avatar>` e ver a inicial aparecer. O que dá para
// prender é a FIAÇÃO: que o componente pergunta na montagem, que ele continua
// tendo a rede do `onError`, e que o recuo é por `src` e não por booleano.
//
// Sem isto, apagar o `ref={aoMontar}` devolveria o defeito de 16/09 com a suíte
// inteira verde — que é exatamente como este defeito nasceu. Mesma forma de
// `tests/vocabulario-da-fila.test.ts` e do portão de `tests/cache-da-capa.test.ts`.
//
// O `semComentarios` é copiado de `tests/escala.test.ts`, com crédito: sem ele,
// o portão passaria a ser satisfeito por uma MENÇÃO em comentário, e a
// explicação de um conserto viraria o álibi dele.
function semComentarios(fonte: string): string {
  return fonte.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const AVATAR = "app/avatar.tsx";
const fonte = semComentarios(readFileSync(new URL(AVATAR, `file://${RAIZ}`), "utf8"));

describe("o portão da fiação do avatar", () => {
  it("enxerga o componente que diz enxergar", () => {
    // Uma varredura de arquivo vazio passa por vacuidade. Este caso impede isso:
    // se o arquivo mudar de lugar ou o `semComentarios` comer o código todo, a
    // queixa aparece aqui, com nome, e não como um silêncio verde adiante.
    expect(fonte).toContain("export default function Avatar");
    expect(fonte).toContain("initial(name)");
  });

  it("pergunta na MONTAGEM se a imagem já falhou — a rede que faltava", () => {
    // `imagemJaFalhou(` COM O PARÊNTESE, e isso não é preciosismo: a primeira
    // versão deste caso pedia só o nome, e SOBREVIVEU ao plantio que troca a
    // chamada por um `if (img.naturalWidth === 0)` inline — a linha de `import`
    // sozinha já satisfazia a busca. E esse é o plantio que mais importa: o `if`
    // inline é justamente onde se esquece o `complete`, e aí toda foto que ainda
    // está baixando vira inicial.
    expect(
      fonte.includes("imagemJaFalhou("),
      "A REDE DA MONTAGEM SUMIU: `" +
        AVATAR +
        "` não chama mais `imagemJaFalhou`. Sem ela, volta o defeito medido em " +
        "16/09/2026 — a foto do CDN do Instagram vence, o `error` dispara ANTES " +
        "de o React hidratar, o `onError` nunca é avisado, e a pessoa fica com " +
        "um círculo cinza vazio no lugar da inicial. Eram 13 de 46 em " +
        "/conversas e 7 de 30 em /contatos. Ver lib/imagem-quebrada.ts."
    ).toBe(true);

    expect(
      /ref=\{/.test(fonte),
      "A PERGUNTA PERDEU O ELEMENTO: `" +
        AVATAR +
        "` não passa mais `ref` para o `<img>`, então `imagemJaFalhou` nunca " +
        "recebe a imagem montada e a rede da montagem não roda."
    ).toBe(true);
  });

  it("mantém a rede do `onError`, que pega a falha DEPOIS", () => {
    expect(
      /onError=\{/.test(fonte),
      "A SEGUNDA REDE SUMIU: `" +
        AVATAR +
        "` não tem mais `onError`. A pergunta da montagem só cobre a foto que já " +
        "estava vencida quando a página chegou; a URL que vence com a aba aberta, " +
        "ou a rede que cai no meio do download, é o `onError` que pega."
    ).toBe(true);
  });

  it("o recuo é por `src`, e não por um booleano grudento", () => {
    expect(
      fonte.includes("srcQueFalhou !== src"),
      "O RECUO VOLTOU A SER BOOLEANO: `" +
        AVATAR +
        "` precisa comparar QUAL `src` falhou com o `src` de agora. Numa lista o " +
        "React reaproveita o componente por POSIÇÃO — a linha 3 de /conversas é a " +
        "mesma instância quando a conversa que ocupa a linha 3 muda —, e um " +
        "`failed` de sim/não fica grudado e esconde a foto BOA da pessoa seguinte."
    ).toBe(true);
  });

  it("não se satisfaz com menção em comentário", () => {
    // A contraprova do próprio portão: ele lê a fonte SEM comentários, então
    // escrever "imagemJaFalhou" numa explicação não paga a conta.
    const sóComentário = semComentarios(
      "// imagemJaFalhou ref={x} onError={y} srcQueFalhou !== src\nconst a = 1;\n"
    );
    expect(sóComentário).not.toContain("imagemJaFalhou");
    expect(sóComentário).not.toContain("onError=");
  });
});
