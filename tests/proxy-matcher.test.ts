import { AsyncLocalStorage } from "node:async_hooks";
import { beforeAll, describe, expect, it } from "vitest";
import { config } from "@/proxy";

// O MATCHER DO PROXY, conferido pelo verificador do próprio Next (docs/specs/2026-10-26-sessao-conferida.md).
//
// O MATCHER ANTIGO TIRAVA DO PORTEIRO QUALQUER ENDEREÇO QUE TERMINASSE EM .svg, .png, .jpg OU .ico,
// inclusive o de uma tela de segmento dinâmico (`/conversas/x.png`). O novo tira só o que é de fato
// arquivo do Next e o favicon.
//
// A FUNÇÃO SE CHAMA `unstable_doesMiddlewareMatch` NESTA VERSÃO (a doc do proxy a chama de
// `unstable_doesProxyMatch`), e ela exige o `AsyncLocalStorage` global que o servidor do Next instala:
// sem ele, carregar o módulo lança "AsyncLocalStorage accessed in runtime where it is not available".
// Por isso o import é dinâmico, depois de instalá-lo.
//
// O MATCHER NÃO OLHA O MÉTODO: um POST de Server Action para um caminho passa pelo porteiro exatamente
// como um GET para o mesmo caminho.
let casa: (url: string) => boolean;

beforeAll(async () => {
  const g = globalThis as { AsyncLocalStorage?: typeof AsyncLocalStorage };
  g.AsyncLocalStorage ??= AsyncLocalStorage;
  const { unstable_doesMiddlewareMatch } = await import("next/experimental/testing/server");
  casa = (url) => unstable_doesMiddlewareMatch({ config, url });
});

describe("o porteiro do painel", () => {
  it.each([
    "/",
    "/setup",
    "/automacoes",
    "/contatos",
    "/conversas/x.png",
    "/automacoes/1.svg",
    "/publicar/post/a.jpg",
    "/bonus/b.ico",
    "/setup/x.png",
    "/next.svg",
  ])("%s passa pelo porteiro", (url) => {
    expect(casa(url)).toBe(true);
  });

  it.each(["/_next/static/chunks/a.js", "/_next/image?url=x&w=64&q=75", "/favicon.ico"])(
    "%s fica fora dele, porque é arquivo do Next ou o favicon",
    (url) => {
      expect(casa(url)).toBe(false);
    }
  );
});
