import { describe, expect, it } from "vitest";
import { render, within } from "@testing-library/react";
import { FaixaDaExportacaoCompleta } from "@/app/contatos/faixa-da-exportacao";
import {
  peneirar,
  recortarTela,
  recorteDaUrl,
  type ContatoDaTela,
} from "@/lib/exportacao-de-contatos";
import type { FiltroDeCategoria } from "@/lib/categorias";

// A FRASE E O BOTÃO NÃO PODEM DISCORDAR SOBRE O MESMO CLIQUE — do lado da TELA.
//
// ESTE É O DEFEITO DE 11/09/2026, e ele já voltou uma vez por porta nova: com
// `categoria=aluno` (40 pessoas) e busca "maria", a tela dizia "1 pessoa —
// pronta para sua lista" e o botão logo abaixo baixava os 40. O conserto
// daquela vez foi na ROTA, e a rota ganhou casos puros
// (tests/exportacao-de-contatos.test.ts). O LADO DA TELA nunca ganhou nenhum:
// `/contatos` não tinha teste de DOM, e a revisão de 23/09/2026 mediu o preço
// disso plantando o 11/09 literal em `app/contatos/page.tsx` — a frase contando
// um conjunto e o botão baixando outro atravessou `tsc`, `eslint`, 1804 casos
// puros e 39 de DOM sem uma única luz vermelha.
//
// O QUE ESTES CASOS AFIRMAM é uma coisa só, e é a regra mais importante desta
// tela: O NÚMERO DA FRASE E O `href` DO BOTÃO SAEM DO MESMO `Recorte`. Não é
// "os dois existem" nem "o link tem `q`": é que as pessoas que o arquivo traz
// são EXATAMENTE as que a frase contou — medido lendo o link do jeito que a
// ROTA o lê (`recorteDaUrl`) e aplicando as MESMAS peneiras que ela aplica
// (`peneirar`), sobre a mesma lista que a faixa recebeu.
//
// SEM SESSÃO E SEM BANCO. As duas rotas de exportação começam em
// `isValidSession`, e sessão não se forja — nenhum teste desta base entra
// nelas. Por isso a faixa foi extraída para
// `app/contatos/faixa-da-exportacao.tsx`: é o que permite montá-la aqui com um
// conjunto conhecido, sem subir a página inteira, que é `async`, consulta o
// Postgres e lê a conta selecionada.

const ALUNO: FiltroDeCategoria = { tipo: "uma", nome: "aluno" };
const TUDO: FiltroDeCategoria = { tipo: "tudo" };

// TRÊS PESSOAS ESCOLHIDAS PARA AS DUAS PENEIRAS MORDEREM SEPARADO, que é o
// arranjo do 11/09: a categoria sozinha deixa DUAS, a busca sozinha deixa
// DUAS, e as duas juntas deixam UMA. Num conjunto em que as peneiras dessem o
// mesmo resultado, nada distinguiria "leu as duas" de "leu só uma".
// `campos` É O REGISTRO CRU DE `contacts.campos`, e ele entrou aqui com o Passo
// 1 da Parte 2: desde ele, o corte e a busca perguntam o e-mail ao registro
// (caindo na coluna quando ele não tem), e não mais a `c.email`. Estas três
// pessoas continuam sendo sobre as PENEIRAS, então o registro delas é vazio e o
// e-mail vem da coluna — o estado de quem foi coletado antes da migração `012`.
// Os estados de divergência têm casos próprios, puros, em
// tests/exportacao-de-contatos.test.ts.
const TODOS: ContatoDaTela[] = [
  {
    username: "maria.aluna",
    name: "Maria Silva",
    email: "maria@email.com",
    campos: {},
    categoria: "aluno",
  },
  { username: "joao.aluno", name: "João Souza", email: null, campos: {}, categoria: "aluno" },
  {
    username: "maria.curiosa",
    name: "Maria Lima",
    email: null,
    campos: {},
    categoria: "interessado",
  },
];

/**
 * Monta a faixa com a MESMA `recortarTela` que `app/contatos/page.tsx` chama.
 *
 * NADA AQUI É OBJETO LITERAL, e isso é metade do ponto: é `recortarTela` que
 * deriva o recorte E os conjuntos de uma vez, e a página inteira consome o que
 * ela devolve. Com um literal montado neste arquivo, a derivação da tela
 * continuaria sem ninguém a exercitar — que é exatamente o buraco que estes
 * casos existem para fechar.
 *
 * A FAIXA RECEBE O OBJETO, e não um conjunto solto: é o que tirou da página a
 * escolha de QUAL conjunto mandar. Medido em 24/09/2026, no desenho anterior:
 * `contatos={comEmail}` no lugar de `contatos={rows}` atravessou `tsc`,
 * `eslint`, 1808 casos puros e 47 de DOM.
 *
 * As buscas são feitas DENTRO do container deste `render`: a suíte monta a
 * faixa várias vezes no mesmo caso, e `screen` enxergaria todas de uma vez.
 */
function montar(filtro: FiltroDeCategoria, busca: string | null) {
  const { container } = render(
    <FaixaDaExportacaoCompleta tela={recortarTela(TODOS, filtro, busca)} />
  );
  const tela = within(container);
  return {
    frase: tela.getByText(/neste recorte/),
    botao: tela.getByRole("link", { name: "Exportar todos os dados" }),
  };
}

/** O número que o dono lê na frase — do DOM, e não recalculado aqui. */
function numeroDaFrase(frase: HTMLElement): number {
  const texto = frase.textContent ?? "";
  const achado = /^\s*(\d+)\s/.exec(texto);
  if (!achado) throw new Error(`a frase não começa com um número: ${JSON.stringify(texto)}`);
  return Number(achado[1]);
}

/**
 * QUEM O ARQUIVO TRARIA — o link lido como a ROTA o lê.
 *
 * `recorteDaUrl` é a leitura de `app/api/contatos/csv-completo/route.ts`, e
 * `peneirar` é a peneira que ela aplica sobre o que o banco devolveu. Usar aqui
 * as duas funções DA ROTA — e não um `filter` equivalente escrito neste arquivo
 * — é o que faz esta conferência valer: se o link perder a busca, este número
 * muda.
 */
function quemOArquivoTraria(botao: HTMLElement): string[] {
  const href = botao.getAttribute("href") ?? "";
  const lidoPelaRota = recorteDaUrl(new URL(href, "http://x").searchParams);
  return peneirar(TODOS, lidoPelaRota).map((c) => c.username ?? "");
}

describe("a frase da faixa", () => {
  // O PLANTIO QUE ESTE CASO ACUSA: a frase contando o conjunto de ANTES da
  // busca (`visiveis` no lugar de `achados`, na forma que sobreviveu a tudo em
  // 23/09/2026). Com "aluno" e "maria", esse conjunto tem DUAS pessoas e o
  // arquivo tem UMA — que é o 11/09 com os números trocados de lado.
  it("conta as DUAS peneiras da tela, e não só a categoria", () => {
    const { frase } = montar(ALUNO, "maria");
    expect(
      numeroDaFrase(frase),
      "a categoria 'aluno' deixa duas pessoas e a busca 'maria' deixa uma delas: " +
        "a frase tem de contar UMA. Contar mais é a tela prometendo gente que o " +
        "arquivo não traz — o defeito de 11/09/2026."
    ).toBe(1);
  });

  it("sem busca, conta a categoria inteira", () => {
    expect(numeroDaFrase(montar(ALUNO, null).frase)).toBe(2);
  });

  it("sem recorte nenhum, conta a conta inteira", () => {
    expect(numeroDaFrase(montar(TUDO, null).frase)).toBe(3);
  });

  // Uma pessoa não é "1 pessoas". O número vem do conjunto do recorte, e a
  // palavra ao lado dele também.
  it("uma pessoa é 'pessoa', e duas são 'pessoas'", () => {
    expect(montar(ALUNO, "maria").frase.textContent).toContain("1 pessoa neste recorte");
    expect(montar(ALUNO, null).frase.textContent).toContain("2 pessoas neste recorte");
  });
});

describe("a frase e o botão, sobre o mesmo clique", () => {
  // O CASO QUE FECHA OS DOIS ACHADOS DA REVISÃO. Ele não olha o formato do
  // link: ele PERGUNTA À ROTA quem viria no arquivo, e compara com o número que
  // o dono acabou de ler logo acima do botão.
  it("o arquivo traz exatamente as pessoas que a frase contou", () => {
    const { frase, botao } = montar(ALUNO, "maria");
    expect(
      quemOArquivoTraria(botao),
      "o link do botão, lido pela rota, tem de selecionar as MESMAS pessoas que " +
        "a frase contou. Se o `Recorte` do link não for o mesmo da frase (a busca " +
        "deixada para trás, por exemplo), a tela promete um arquivo e baixa outro."
    ).toEqual(["maria.aluna"]);
    expect(quemOArquivoTraria(botao)).toHaveLength(numeroDaFrase(frase));
  });

  it("vale para os quatro recortes, e não só para o do meio", () => {
    const casos = [
      { filtro: TUDO, busca: null, esperado: 3 },
      { filtro: ALUNO, busca: null, esperado: 2 },
      { filtro: ALUNO, busca: "maria", esperado: 1 },
      { filtro: TUDO, busca: "maria", esperado: 2 },
    ] as const;
    for (const { filtro, busca, esperado } of casos) {
      const { frase, botao } = montar(filtro, busca);
      const rotulo = `filtro ${JSON.stringify(filtro)} e busca ${JSON.stringify(busca)}`;
      expect(numeroDaFrase(frase), `a frase conta errado com ${rotulo}`).toBe(esperado);
      expect(
        quemOArquivoTraria(botao),
        `com ${rotulo}, o arquivo tem de trazer a mesma gente que a frase conta`
      ).toHaveLength(esperado);
    }
  });

  // O BOTÃO É O DO ARQUIVO COMPLETO, e a frase é a promessa dele: "com e-mail
  // ou sem". A rota vizinha (`/api/contatos/csv`, a lista de e-mail) tem
  // `where c.email is not null` — apontar para lá deixaria a frase contando
  // três e o arquivo trazendo só quem tem e-mail, calado.
  it("o botão aponta para a rota do arquivo completo, e não para a lista de e-mail", () => {
    const { botao } = montar(TUDO, null);
    expect(
      new URL(botao.getAttribute("href") ?? "", "http://x").pathname,
      "a frase promete 'com e-mail ou sem'; a rota da lista de e-mail filtra " +
        "`email is not null` e traria menos gente do que a frase contou."
    ).toBe("/api/contatos/csv-completo");
  });

  // O ATRIBUTO `download` É O QUE FAZ O ARQUIVO CAIR NA PASTA em vez de o CSV
  // abrir como página. Sem ele o dono vê texto cru numa aba.
  it("o botão baixa o arquivo, e não navega para ele", () => {
    expect(montar(TUDO, null).botao.hasAttribute("download")).toBe(true);
  });
});
