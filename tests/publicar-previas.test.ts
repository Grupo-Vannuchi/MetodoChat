import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// AS PRÉVIAS COM VÍDEO DO /publicar (spec 2026-10-19-enquadrar-imagens, "As prévias com vídeo"). A
// página do post desenhava `<img>` para todo caminho, e o calendário usava o primeiro caminho como capa:
// o vídeo saía como imagem quebrada, nas quatro formas. A decisão (é vídeo? qual é a capa?) é pura e tem
// caso em tests/publicacao-enquadramento.test.ts; aqui se cobra que as duas telas a perguntem, e não a
// refaçam no JSX.
//
// É UMA GUARDA DE TEXTO, E NÃO UMA SUÍTE QUE MONTA A URL, como a spec pedia (desvio declarado): as duas
// páginas são de servidor e leem o banco, e a integração de `nao-saiu` não liga o bucket (a capa ali é
// nula). Por isso as expressões são as inteiras, com o ramo: um `!` na frente da pergunta, ou os ramos
// trocados, derrubam o caso.

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const ler = (rel: string) => readFileSync(`${RAIZ}/${rel}`, "utf8").replace(/\r\n/g, "\n");

// DESDE A PARTE 2a DO LINKEDIN, as duas decisões moram em lib/post-da-fila.ts (`paginaDoPost` e `cartaoDoPost`),
// que lê o post do Instagram como as telas liam e o do LinkedIn com a rede no nome. A guarda cobra as duas
// metades: a tela pergunta à função, e a função pergunta à regra pura, com as mesmas expressões de antes.
// tests/post-da-fila.test.ts prende o resultado, inclusive o do vídeo.
const postDaFila = ler("lib/post-da-fila.ts");

describe("a página do post", () => {
  const pagina = ler("app/publicar/post/[id]/page.tsx");

  it("pergunta à regra pura se cada caminho é vídeo, e o ramo do sim desenha <video>; o do não, <img>", () => {
    expect(pagina).toMatch(
      /pagina\.ehVideo\(m\.caminho\) \? \(\s*<span[^>]*>\s*<video\s[\s\S]*?muted[\s\S]*?preload="metadata"[\s\S]*?\) : \([\s\S]*?<img\s/
    );
    expect(postDaFila).toContain("ehVideo: (caminho) => !!p && ehVideoNoPost(p.forma, caminho),");
  });
});

describe("o calendário", () => {
  const pagina = ler("app/publicar/page.tsx");

  it("pede a capa à regra pura, e não pega o primeiro caminho", () => {
    expect(pagina).toContain("const cartao = cartaoDoPost(item, saiu);");
    expect(pagina).toContain("const primeira = cartao.capa;");
    expect(postDaFila).toContain("const capa = !saiu && p ? capaDoPost(p.forma, p.caminhos) : null;");
    expect(pagina).not.toContain("p?.caminhos?.[0]");
  });

  it("o post só de vídeo, que não saiu, mostra o ícone de vídeo no lugar da capa", () => {
    expect(pagina).toContain("const soVideo = cartao.soVideo;");
    expect(postDaFila).toContain("soVideo: !saiu && !!p && p.caminhos.length > 0 && capa === null");
    expect(pagina).toContain('{saiu ? "✓" : soVideo ? "▶" : "•"}');
  });
});
