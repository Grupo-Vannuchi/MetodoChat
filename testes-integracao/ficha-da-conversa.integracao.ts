// A FICHA DO COLETADO, MEDIDA DENTRO DA TELA — a consulta, o `jsonb` de verdade
// e a migração `012` de verdade, do banco até o que a ficha recebe.
//
// POR QUE ESTE ARQUIVO EXISTE, se a regra já é pura e tem caso: porque a
// COSTURA consulta→tela não é pura, e é nela que moram os dois defeitos que
// nenhuma das outras suítes alcança.
//
//   1. `account_id` FORA DO `where`. A chave de `contacts` é COMPOSTA
//      (migrations/005-contatos-chave-composta.sql), então a mesma pessoa
//      falando com duas contas do produto tem DUAS linhas. Sem o filtro, esta
//      tela mostra na ficha o telefone que alguém entregou à conta do VIZINHO —
//      dado de um cliente dentro do painel de outro. `tsc`, `eslint` e as duas
//      suítes offline ficam verdes com o filtro fora: a consulta é uma string.
//   2. A COLUNA QUE NÃO VEIO NO `select`. Sem `campos`, a ficha fica vazia para
//      todo mundo; sem `email`, ela fica sem e-mail para todo contato anterior à
//      migração `012` — que é aplicada À MÃO, fora do build, e que em produção
//      já rodou.
//
// É A MESMA CLASSE DOS TRÊS PLANTIOS QUE SOBREVIVERAM A TUDO EM 09/09/2026
// (ver o bloco "A TELA, E OS DOIS PLANTIOS" em agendados.integracao.ts), e o
// instrumento é o mesmo: chamar a função da página dentro de um contexto de
// requisição e ler a árvore que ela devolve.
//
// -----------------------------------------------------------------------------
// A LEITURA NÃO É `textoDaArvore`, E A ESCOLHA FOI MEDIDA NOUTRO ARQUIVO PRIMEIRO
//
// `FichaDoColetado` (app/conversas/[id]/ficha-do-coletado.tsx) recebe a lista
// inteira num prop só, e `textoDaArvore` (./texto-da-arvore.ts) NUNCA executa
// componente filho — ela anda pelo ELEMENTO sem chamar o `type` — e só imprime
// prop de valor primitivo. `itens` é um ARRAY DE OBJETOS: ele não chega ao texto
// nem com o defeito nem sem ele, e um `not.toContain(...)` sobre esse texto
// passaria SEMPRE. É a armadilha que `acharLinhas` (capa-do-post.integracao.ts)
// e `acharConfiguracao` já documentaram; `itensDaFicha`, abaixo, é a mesma saída
// pela terceira vez: anda pela mesma árvore, sem tocar `type` de elemento
// nenhum, procurando o prop pelo NOME.
import { beforeAll, describe, expect, test } from "vitest";
import { bancoDescartavel } from "./harness";
import { comoNumaRequisicao } from "./semear-requisicao";
import { migracoesEmOrdem } from "./migracoes";
// `lib/ficha-do-coletado.ts` é módulo puro (não fala com o banco): pode ser
// importado no topo, como `migracao-dos-dados-legados.integracao.ts` já faz com
// `lib/campos.ts`.
import type { ItemDaFicha } from "@/lib/ficha-do-coletado";

const banco = bancoDescartavel();

// A CONTA DESTA SUÍTE e a VIZINHA. `listAccounts` (lib/db.ts) ordena por
// `created_at asc` e `getSelectedAccount` (lib/account.ts) cai na PRIMEIRA
// quando não há cookie — que é o caso aqui, porque esta fundação não forja
// cookie nenhum. Então a vizinha é criada DEPOIS, e o primeiro caso abaixo
// confere isso em voz alta: uma suposição de ordem que ninguém mede é uma suíte
// verde sobre a conta errada.
const CONTA = "17800000000000771";
const VIZINHA = "17800000000000772";
const TOKEN = "token-da-ficha-que-nao-vale-nada";

const NOME_DA_MIGRACAO = "012-migrar-email-para-campos.sql";

/**
 * Os itens que a página entregou à ficha.
 *
 * LANÇA QUANDO NÃO ACHA, e o desfecho ruidoso é o barato aqui: se a página
 * deixar de renderizar a ficha — ou se o prop mudar de nome —, um `toEqual([])`
 * silencioso passaria a ser o resultado de TODO caso deste arquivo, inclusive o
 * do vazamento entre contas. Vacuidade tem de virar erro, não verde.
 */
function itensDaFicha(raiz: unknown): ItemDaFicha[] {
  const visto = new Set<unknown>();
  const andar = (no: unknown): ItemDaFicha[] | null => {
    if (Array.isArray(no)) {
      for (const filho of no) {
        const achado = andar(filho);
        if (achado) return achado;
      }
      return null;
    }
    if (typeof no !== "object" || no === null || visto.has(no)) return null;
    visto.add(no);
    const props = (no as { props?: Record<string, unknown> }).props;
    if (!props) return null;
    if (Array.isArray(props.itens)) return props.itens as ItemDaFicha[];
    return andar(props.children);
  };
  const achado = andar(raiz);
  if (achado === null) {
    throw new Error(
      "o prop `itens` não foi achado na árvore de /conversas/[id] — a ficha saiu " +
        "da página, ou o prop mudou de nome, e este achador precisa acompanhar."
    );
  }
  return achado;
}

/** A ficha que a tela da conversa monta para este contato. */
async function fichaNaTela(igId: string): Promise<ItemDaFicha[]> {
  const { valor } = await comoNumaRequisicao(`/conversas/${igId}`, async () => {
    const tela = await import("@/app/conversas/[id]/page");
    return itensDaFicha(
      await tela.default({
        params: Promise.resolve({ id: igId }),
        searchParams: Promise.resolve({}),
      })
    );
  });
  return valor;
}

/** Um contato de uma conta, com o `jsonb` de `campos` e a coluna `email` postos à mão. */
async function semearContato(
  conta: string,
  igId: string,
  dados: { email?: string | null; campos?: Record<string, unknown> } = {}
): Promise<void> {
  await banco
    .db()
    .sql()
    .query(
      `insert into contacts (account_id, ig_id, email, campos)
       values ($1, $2, $3, $4::text::jsonb)
       on conflict (account_id, ig_id) do update
          set email = excluded.email, campos = excluded.campos`,
      [conta, igId, dados.email ?? null, JSON.stringify(dados.campos ?? {})]
    );
}

/** A `012` de verdade, lida da pasta — nenhuma linha de SQL é copiada para cá. */
async function rodarMigracaoDoEmail(): Promise<void> {
  const achada = migracoesEmOrdem().find((m) => m.nome === NOME_DA_MIGRACAO);
  if (!achada) {
    throw new Error(
      `migrations/${NOME_DA_MIGRACAO} não está na pasta. O caso do e-mail migrado ` +
        "prova ESSA migração; sem ela não há o que provar."
    );
  }
  await banco.db().sql().query(achada.comandos);
}

const EM = "2026-09-20T10:00:00Z";
const coletado = (valor: string) => ({ valor, em: EM, automacao: "a-1" });

beforeAll(async () => {
  await banco.db().upsertAccount({
    ig_user_id: CONTA,
    username: "conta_da_ficha",
    name: "Conta da ficha",
    profile_picture_url: null,
    access_token: TOKEN,
    token_expires_at: null,
  });
  await banco.db().upsertAccount({
    ig_user_id: VIZINHA,
    username: "conta_vizinha_da_ficha",
    name: "Conta vizinha",
    profile_picture_url: null,
    access_token: TOKEN,
    token_expires_at: null,
  });
});

describe("a ficha que a tela da conversa monta", () => {
  test("a conta que a tela usa é a desta suíte, e não a vizinha", async () => {
    const { valor } = await comoNumaRequisicao("/conversas", async () => {
      const conta = await import("@/lib/account");
      return conta.getSelectedAccountId();
    });
    expect(
      valor,
      "`listAccounts` ordena por `created_at asc` e `getSelectedAccount` cai na " +
        "primeira sem cookie. Se este caso ficar vermelho, os de baixo estão " +
        "medindo a conta errada."
    ).toBe(CONTA);
  });

  // O CASO QUE IMPEDE OS OUTROS DE PASSAREM POR VACUIDADE: o instrumento
  // enxerga dado de verdade, vindo do `jsonb` de verdade, pela consulta da
  // página.
  test("o que a automação coletou chega à ficha, com valor e data", async () => {
    const EU = "9200000000000101";
    await semearContato(CONTA, EU, {
      campos: { telefone: coletado("11999998888"), qual_sua_cidade: coletado("Osasco") },
    });

    const itens = await fichaNaTela(EU);

    expect(itens.map((i) => i.chave)).toEqual(["telefone", "qual_sua_cidade"]);
    expect(itens[0].valor).toBe("11999998888");
    expect(itens[0].em).toBe(EM);
  });

  // -------------------------------------------------------------------------
  // O PLANTIO: tirar `account_id` do `where` da consulta do contato.
  //
  // A FORMA DESTE CASO É O CONSERTO DE UMA TENTATIVA QUE FICARIA VERDE NA MOEDA.
  // Semear a MESMA pessoa nas duas contas e exigir o valor daqui depende de QUAL
  // linha o `rows[0]` devolve sem o filtro — detalhe de plano, não contrato, e
  // a revisão de `coleta-de-dados.integracao.ts` já mediu essa armadilha.
  //
  // AQUI A LINHA DESTA CONTA NÃO EXISTE. Há UMA linha no banco com este `ig_id`,
  // e ela é da vizinha. Com o filtro, a consulta devolve ZERO linhas e a ficha
  // sai vazia; sem o filtro, ela devolve aquela única linha e a ficha mostra o
  // telefone do cliente do vizinho. Não há moeda a jogar: os dois desfechos são
  // determinísticos.
  // -------------------------------------------------------------------------
  test("a ficha é POR CONTA: o contato que só existe na conta vizinha não chega aqui", async () => {
    const SO_DA_VIZINHA = "9200000000000102";
    await semearContato(VIZINHA, SO_DA_VIZINHA, {
      campos: { telefone: coletado("11888887777") },
    });

    const itens = await fichaNaTela(SO_DA_VIZINHA);

    expect(
      itens,
      "esta pessoa não tem linha NESTA conta — só na vizinha. Sem `account_id` no " +
        "`where`, a consulta devolve a linha da vizinha e a ficha mostra o dado que " +
        "ela entregou a OUTRO cliente do produto."
    ).toEqual([]);
  });

  // O PLANTIO: tirar `email` do `select`. A queda do registro para a coluna
  // antiga é decidida por `lib/variables.ts`, mas ela só tem o que ler se a
  // página trouxer a coluna — e a suíte pura não alcança o `select`.
  test("o e-mail que só existe na coluna antiga chega à ficha, e sem data", async () => {
    const DE_ANTES = "9200000000000103";
    await semearContato(CONTA, DE_ANTES, { email: "antigo@exemplo-do-teste.invalid" });

    const itens = await fichaNaTela(DE_ANTES);

    expect(itens.map((i) => i.chave)).toEqual(["email"]);
    expect(itens[0].valor).toBe("antigo@exemplo-do-teste.invalid");
    expect(
      itens[0].em,
      "a coluna `contacts.email` nunca guardou quando o e-mail chegou — não há data " +
        "a mostrar, e inventar uma é o defeito que esta tarefa existe para não repetir."
    ).toBe(null);
  });

  // -------------------------------------------------------------------------
  // A ARMADILHA CENTRAL, MEDIDA CONTRA A MIGRAÇÃO DE VERDADE.
  //
  // Nove contatos em produção passaram por aqui: a `012` moveu o e-mail da
  // coluna para `contacts.campos` gravando `em = now()` — o instante em que ELA
  // rodou — e NÃO gravando a chave `automacao`. A data é um SUBSTITUTO, e está
  // escrito assim no topo daquele arquivo.
  //
  // ESTE CASO NÃO MONTA O `jsonb` À MÃO de propósito: ele semeia o estado que
  // produção tinha (e-mail na coluna, `campos` vazio), roda a MIGRAÇÃO LIDA DA
  // PASTA e lê a tela. É a única forma de o caso continuar valendo se a `012`
  // mudar de forma — um literal aqui provaria a minha cópia dela, não ela.
  // -------------------------------------------------------------------------
  test("o e-mail que a `012` migrou chega à ficha SEM data de coleta", async () => {
    const MIGRADO = "9200000000000104";
    await semearContato(CONTA, MIGRADO, { email: "migrado@exemplo-do-teste.invalid" });
    await rodarMigracaoDoEmail();

    // A migração de verdade gravou o registro — e sem a chave `automacao`.
    const linhas = (await banco
      .db()
      .sql()
      .query(
        `select campos -> 'email' ->> 'em' as em, campos -> 'email' ? 'automacao' as tem
           from contacts where account_id = $1 and ig_id = $2`,
        [CONTA, MIGRADO]
      )) as { em: string | null; tem: boolean }[];
    expect(linhas[0].em, "a `012` não gravou o registro; o caso abaixo mediria outra coisa").not.toBe(
      null
    );
    expect(linhas[0].tem).toBe(false);

    const itens = await fichaNaTela(MIGRADO);

    expect(itens.map((i) => i.chave)).toEqual(["email"]);
    expect(itens[0].valor).toBe("migrado@exemplo-do-teste.invalid");
    expect(
      itens[0].em,
      "o `em` deste registro é o instante em que a MIGRAÇÃO rodou, e o banco acabou " +
        "de confirmar que ele está lá. A ficha tem de devolver `null` mesmo assim: " +
        "quem separa substituto de fato é a AUSÊNCIA da chave `automacao`, nunca a data."
    ).toBe(null);
  });

  test("quem nunca teve nada coletado chega à ficha como lista vazia", async () => {
    const VAZIO = "9200000000000105";
    await semearContato(CONTA, VAZIO);
    expect(await fichaNaTela(VAZIO)).toEqual([]);
  });
});
