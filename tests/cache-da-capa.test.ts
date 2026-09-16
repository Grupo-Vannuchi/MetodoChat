import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { chaveDaLista, chaveDoPost, VIDA_DA_LISTA_S, VIDA_DO_POST_S } from "@/lib/media-lookup";

// O DESENHO DESTE CACHE SE APOIA NUM FATO DA FONTE DO NEXT, e não na doc dele.
//
// A doc diz que `dynamic = "force-dynamic"` equivale a
// `fetchCache = 'force-no-store'`. Se isso valesse para `unstable_cache`, o
// cache das capas não guardaria NADA em producao — as quatro telas sao
// `force-dynamic` — e ninguem perceberia: a tela continuaria certa, so lenta.
//
// MEDIDO na fonte do Next 16.2.10: `unstable_cache` so desiste quando
// `workStore.fetchCache === 'force-no-store'`, e NUNCA olha
// `workStore.forceDynamic`, que e o unico campo que `force-dynamic` seta
// (create-component-tree.js:151). Quem trata `forceDynamic` e o `fetch`,
// noutro arquivo (patch-fetch.js:353).
//
// ESTE CASO EXISTE PARA MORRER EM VERMELHO numa atualizacao do Next que junte
// os dois. Sem ele, a juncao viraria uma perda de desempenho silenciosa.
const FONTE = "node_modules/next/dist/server/web/spec-extension/unstable-cache.js";

describe("o fato do Next em que este cache se apoia", () => {
  const fonte = readFileSync(FONTE, "utf8");

  test("o ramo que LE do cache existe e pergunta por `fetchCache`", () => {
    expect(fonte).toContain("workStore.fetchCache !== 'force-no-store'");
  });

  test("o ramo que LE do cache NAO consulta `forceDynamic`", () => {
    // Recorte generoso ao redor da condicao, para pegar uma consulta
    // acrescentada perto dela.
    const i = fonte.indexOf("workStore.fetchCache !== 'force-no-store'");
    expect(i).toBeGreaterThan(-1);
    const trecho = fonte.slice(i - 600, i + 600);
    expect(trecho).not.toContain("forceDynamic");
  });
});

const TOKEN = "IGQVJXtoken-que-nao-pode-vazar-para-lugar-nenhum";

describe("a chave do cache", () => {
  test("a lista e por conta, e o token NAO entra", () => {
    const k = chaveDaLista("17900000000000901");
    expect(k).toContain("17900000000000901");
    expect(k.join("|")).not.toContain(TOKEN);
    expect(k.join("|")).not.toContain("token");
  });

  test("o post e por id, e o token NAO entra", () => {
    const k = chaveDoPost("17900000000000002");
    expect(k).toContain("17900000000000002");
    expect(k.join("|")).not.toContain(TOKEN);
  });

  test("duas contas nunca compartilham chave", () => {
    expect(chaveDaLista("111")).not.toEqual(chaveDaLista("222"));
  });

  test("as vidas ficam MUITO abaixo do prazo da miniatura (~2 semanas)", () => {
    // Medido em 15/09/2026: URL de 14/09 -> 200; de 31/08 e 24/08 -> 403.
    const DUAS_SEMANAS_S = 14 * 24 * 3600;
    expect(VIDA_DA_LISTA_S).toBeLessThan(DUAS_SEMANAS_S / 100);
    expect(VIDA_DO_POST_S).toBeLessThan(DUAS_SEMANAS_S / 10);
  });
});

// ---------------------------------------------------------------------------
// O PORTÃO DA FIAÇÃO — o defeito que passa em tudo e não faz nada
// ---------------------------------------------------------------------------
//
// O QUE ESTE BLOCO FECHA: até aqui, os casos acima mediam a CHAVE e as VIDAS.
// Nenhum deles falharia se alguém trocasse `listaRecenteCacheada` de volta por
// `getMedia` dentro de `resolvePosts`: as constantes continuariam certas, as
// chaves continuariam sem token, e o cache teria sumido — 9 chamadas e ~1,5 s
// por render de volta, com a suíte inteira verde. É a classe de defeito mais
// comum desta base: a mudança que passa em tudo e não faz nada.
//
// A FORMA É A DE `tests/vocabulario-da-fila.test.ts`: portão textual sobre o
// código-fonte, que (1) tira comentário ANTES de olhar, (2) prova que ENXERGA
// o que diz enxergar, (3) prova que ACUSA quando há o que acusar — porque uma
// varredura que não acha nada passa por vacuidade, medindo o nada.
//
// AS DUAS COISAS PRESAS AQUI:
//
//   1. `resolvePosts` chama os embrulhos e NÃO chama `getMedia(` /
//      `getMediaById(` direto. As chamadas cruas só podem existir DENTRO dos
//      embrulhos — é lá que o `unstable_cache` as envolve.
//   2. Cada embrulho passa `revalidate`. `unstable_cache` SEM `revalidate`
//      guarda PARA SEMPRE, e uma miniatura do CDN do Instagram guardada para
//      sempre é exatamente a imagem quebrada que o cabeçalho de
//      `lib/media-lookup.ts` descreve e que a branch anterior consertou. Um
//      embrulho sem vida seria PIOR que nenhum embrulho.
const FONTE_DA_CAPA = fileURLToPath(new URL("../lib/media-lookup.ts", import.meta.url));

// `semComentarios` é a função de `tests/escala.test.ts`, copiada com crédito
// (`tests/vocabulario-da-fila.test.ts` a copiou pelo mesmo motivo): o portão
// precisa dela para não acusar um comentário que CITE `getMedia(` ao explicar
// por que o embrulho existe — `lib/media-lookup.ts` é cheio desse gênero de
// frase, e é bom que seja. Aqui ela vai SEM o acréscimo de `--` que o
// vocabulário da fila fez, porque não há SQL nenhum no caminho da capa.
function semComentarios(fonte: string): string {
  return fonte.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

// Índice LOGO DEPOIS da aspa que fecha a string aberta em `texto[abre]`,
// tratando `\` como escape. Mesma família de `tests/vocabulario-da-fila.test.ts`.
// Uma crase engole o `${...}` inteiro — aqui isso é exatamente o que se quer,
// porque as chaves de `` `ig:lista:${igUserId}` `` não são chaves de bloco e
// não podem contar para o casamento de `{}` logo abaixo.
function fecharString(texto: string, abre: number, aspa: string): number {
  let i = abre + 1;
  while (i < texto.length) {
    if (texto[i] === "\\") {
      i += 2;
      continue;
    }
    if (texto[i] === aspa) return i + 1;
    i++;
  }
  return texto.length;
}

// O corpo de uma função, do `{` que a abre ao `}` que a fecha, contando
// aninhamento e pulando o que estiver dentro de string. Devolve `null` quando
// a função não existe — quem chama trata isso como FURO, e não como "nada a
// dizer": uma função que sumiu é a primeira forma de a fiação se desfazer.
//
// O primeiro `{` depois do nome é o corpo porque nenhuma destas três funções
// tem chave antes dele — os parâmetros são tipos simples e o retorno de
// `resolvePosts` é `Promise<Map<string, PostRef>>`, sem `{}`. O caso "enxerga"
// abaixo é o que PROVA que o recorte acerta, em vez de eu afirmar que acerta.
function corpoDaFuncao(fonte: string, nome: string): string | null {
  const decl = new RegExp(`function\\s+${nome}\\s*\\(`).exec(fonte);
  if (!decl) return null;
  const abre = fonte.indexOf("{", decl.index);
  if (abre === -1) return null;
  let profundidade = 1;
  let i = abre + 1;
  while (i < fonte.length) {
    const c = fonte[i];
    if (c === "{") {
      profundidade++;
      i++;
    } else if (c === "}") {
      profundidade--;
      i++;
      if (profundidade === 0) return fonte.slice(abre + 1, i - 1);
    } else if (c === "'" || c === '"' || c === "`") {
      i = fecharString(fonte, i, c);
    } else {
      i++;
    }
  }
  return null; // chaves não fecham — arquivo truncado; quem chama vira furo
}

// O QUE FAZER está DENTRO da mensagem, de propósito, na disciplina de
// `baseDoGraph()` (lib/ig.ts) e do guarda de
// `testes-integracao/semear-requisicao.ts`: quem quebrar isto tem de ler "o
// cache sumiu, e a tela voltou a comprar a capa a cada carregamento", e não
// "um teste chato quebrou".
const EMBRULHOS = [
  { embrulho: "listaRecenteCacheada", cru: "getMedia(", vida: "VIDA_DA_LISTA_S", quanto: "120 s" },
  { embrulho: "postCacheado", cru: "getMediaById(", vida: "VIDA_DO_POST_S", quanto: "6 h" },
] as const;

function furosDaFiacao(fonte: string): string[] {
  const furos: string[] = [];
  const limpa = semComentarios(fonte);

  const corpo = corpoDaFuncao(limpa, "resolvePosts");
  if (corpo === null) {
    furos.push(
      "RESOLVEPOSTS SUMIU: não achei `function resolvePosts(` em lib/media-lookup.ts. " +
        "Ou ela foi renomeada, ou este portão deixou de saber onde olhar — nos dois " +
        "casos ele parou de medir a fiação do cache. Conserte o nome aqui, ou releia o " +
        "que aconteceu com a função; NÃO apague o caso."
    );
    return furos;
  }

  for (const { embrulho, cru, vida, quanto } of EMBRULHOS) {
    if (!corpo.includes(`${embrulho}(`)) {
      furos.push(
        `O CACHE SUMIU: resolvePosts não chama mais \`${embrulho}(\`. Sem esse embrulho ` +
          `a chamada à Meta volta a sair a CADA carregamento das quatro telas (medido ` +
          `antes desta branch: 9 chamadas e ~1,5 s por render), e nada mais nesta suíte ` +
          `reclama — a tela continua certa, só lenta. Volte a chamar \`${embrulho}\`, ` +
          `que é quem embrulha \`${cru}...)\` com ${vida} (${quanto}).`
      );
    }
    if (corpo.includes(cru)) {
      furos.push(
        `CHAMADA CRUA DENTRO DE RESOLVEPOSTS: \`${cru}...)\` aparece no corpo dela. A ` +
          `chamada crua só pode existir DENTRO de \`${embrulho}\` — é lá que o ` +
          `unstable_cache a envolve. Chamada direto daqui, ela não passa por cache ` +
          `nenhum: o cache existe no arquivo e não guarda nada do que a tela pede.`
      );
    }

    const corpoDoEmbrulho = corpoDaFuncao(limpa, embrulho);
    if (corpoDoEmbrulho === null) {
      furos.push(
        `EMBRULHO AUSENTE: não achei \`function ${embrulho}(\` em lib/media-lookup.ts. ` +
          `Era ele que punha ${vida} (${quanto}) em volta de \`${cru}...)\`. Sem ele não ` +
          `há cache nenhum nesse caminho.`
      );
      continue;
    }
    if (!/revalidate\s*:/.test(corpoDoEmbrulho)) {
      furos.push(
        `EMBRULHO SEM VIDA: \`${embrulho}\` não passa \`revalidate\` ao unstable_cache. ` +
          `Sem \`revalidate\` ele guarda PARA SEMPRE — e a miniatura do CDN do Instagram ` +
          `expira em ~2 semanas (medido em 15/09/2026: URL de 14/09 -> 200; de 31/08 e ` +
          `24/08 -> 403). O resultado não é lentidão, é a IMAGEM QUEBRADA que o ` +
          `cabeçalho de lib/media-lookup.ts descreve e que esta branch existe para não ` +
          `criar. Devolva \`revalidate: ${vida}\`.`
      );
    }
  }

  return furos;
}

describe("o portão da fiação do cache", () => {
  const fonte = readFileSync(FONTE_DA_CAPA, "utf8");

  test("enxerga o que diz enxergar — o recorte acerta as três funções", () => {
    // Um recorte que pega o pedaço errado passa por vacuidade. Este caso é o
    // que impede isso: cada corpo tem de conter o que é SÓ dele, e não conter
    // o que é do vizinho.
    const limpa = semComentarios(fonte);

    const corpo = corpoDaFuncao(limpa, "resolvePosts");
    expect(corpo, "não recortei o corpo de resolvePosts").not.toBeNull();
    // Não terminou cedo demais: `Promise.allSettled` está no meio e
    // `return mapa` é a última linha da função.
    expect(corpo).toContain("Promise.allSettled");
    expect(corpo).toContain("return mapa");
    // Nem começou cedo demais: `chaveDaLista` é do embrulho, que vem ANTES
    // dela no arquivo, e não pode ter sido engolido pelo recorte.
    //
    // ESTA ASSERÇÃO NÃO CITA `RECENT_MEDIA_LIMIT` de propósito: citá-la
    // acoplaria este caso ao plantio "resolvePosts volta a chamar getMedia
    // direto" (que reintroduz a constante ali dentro), e o plantio ficaria
    // vermelho AQUI, com uma mensagem sobre recorte, em vez de só no portão,
    // com a mensagem que diz "o cache sumiu". Medido: era o que acontecia.
    expect(corpo).not.toContain("chaveDaLista");

    const daLista = corpoDaFuncao(limpa, "listaRecenteCacheada");
    expect(daLista, "não recortei o corpo de listaRecenteCacheada").not.toBeNull();
    expect(daLista).toContain("chaveDaLista");
    expect(daLista).not.toContain("chaveDoPost");

    const doPost = corpoDaFuncao(limpa, "postCacheado");
    expect(doPost, "não recortei o corpo de postCacheado").not.toBeNull();
    expect(doPost).toContain("chaveDoPost");
    expect(doPost).not.toContain("chaveDaLista");

    expect(corpoDaFuncao(limpa, "funcaoQueNaoExiste")).toBeNull();
  });

  test("acusa quando há o que acusar — se não acusa nada, não mede nada", () => {
    // As formas de desfazer a fiação, escritas à mão aqui para que o portão
    // seja medido contra elas, e não só contra o arquivo que já está certo.
    const semEmbrulho = `
      function listaRecenteCacheada(a: string, t: string) { return unstable_cache(
        () => getMedia(a, t, 40), chaveDaLista(a), { revalidate: 120 })(); }
      function postCacheado(m: string, t: string) { return unstable_cache(
        () => getMediaById(m, t), chaveDoPost(m), { revalidate: 21600 })(); }
      export async function resolvePosts(a: string, t: string, ids: string[]) {
        for (const m of await getMedia(a, t, 40)) { void m; }
        return ids;
      }`;
    const acusado = furosDaFiacao(semEmbrulho).join("\n");
    expect(acusado).toContain("O CACHE SUMIU");
    expect(acusado).toContain("CHAMADA CRUA DENTRO DE RESOLVEPOSTS");

    const semVida = `
      function listaRecenteCacheada(a: string, t: string) { return unstable_cache(
        () => getMedia(a, t, 40), chaveDaLista(a), { tags: ["ig:lista:" + a] })(); }
      function postCacheado(m: string, t: string) { return unstable_cache(
        () => getMediaById(m, t), chaveDoPost(m), { revalidate: 21600 })(); }
      export async function resolvePosts(a: string, t: string, ids: string[]) {
        for (const m of await listaRecenteCacheada(a, t)) { void m; }
        await Promise.allSettled(ids.map((i) => postCacheado(i, t)));
        return ids;
      }`;
    expect(furosDaFiacao(semVida).join("\n")).toContain("EMBRULHO SEM VIDA");

    // E o sumiço do embrulho inteiro, que é a terceira forma.
    expect(furosDaFiacao("export async function resolvePosts() { return 1; }").join("\n")).toContain(
      "EMBRULHO AUSENTE"
    );
  });

  test("NÃO acusa a chamada crua citada em COMENTÁRIO — a armadilha que já mordeu este repositório", () => {
    // `lib/media-lookup.ts` explica, em português, por que a chamada é
    // embrulhada. Um portão que lesse comentário reprovaria a própria
    // explicação — e um portão que reprova código certo é um portão que
    // alguém desliga.
    const comComentario = `
      function listaRecenteCacheada(a: string, t: string) { return unstable_cache(
        () => getMedia(a, t, 40), chaveDaLista(a), { revalidate: 120 })(); }
      function postCacheado(m: string, t: string) { return unstable_cache(
        () => getMediaById(m, t), chaveDoPost(m), { revalidate: 21600 })(); }
      export async function resolvePosts(a: string, t: string, ids: string[]) {
        // aqui NAO se chama getMedia( direto: quem faz isso e o embrulho
        /* nem getMediaById( — mesmo motivo */
        for (const m of await listaRecenteCacheada(a, t)) { void m; }
        await Promise.allSettled(ids.map((i) => postCacheado(i, t)));
        return ids;
      }`;
    expect(furosDaFiacao(comComentario)).toEqual([]);
  });

  test("a fiação de lib/media-lookup.ts está de pé", () => {
    expect(furosDaFiacao(fonte)).toEqual([]);
  });
});
