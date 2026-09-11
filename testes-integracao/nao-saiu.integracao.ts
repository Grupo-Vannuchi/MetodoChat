// O CAMINHO DO POST QUE NÃO SAIU — a segunda seção dos agendados e o aviso do
// painel.
//
// -----------------------------------------------------------------------------
// POR QUE ELE EXISTE, E POR QUE É AQUI QUE O DEFEITO MORA
//
// A entrega de 09/09/2026 é DUAS CONSULTAS e NENHUMA escrita. Não há ação de
// servidor nova para exercitar, e é justamente por isso que este arquivo precisa
// existir: o que decide o que aparece na tela são as condições do `where` de
// cada consulta, e NENHUMA delas é visível para os quatro portões.
//
//   `app/publicar/agendados/page.tsx`, seção nova:
//     `account_id`          impede contar sobre a fila alheia
//     `kind = 'publicacao'` impede uma MENSAGEM falhada virar linha de post
//     `status = 'failed'`   é a seção inteira — lendo `pending`, ela vira a
//                           cópia da lista de cima
//
//   `app/page.tsx`:
//     `kind = 'publicacao'` / `kind <> 'publicacao'` são as duas contagens que
//                           eram uma só, e é delas que sai a palavra certa
//     a janela de 7 dias    é o que separa "precisa de atenção" de ruído
//
// Apagar qualquer uma passa por lint, typecheck, suíte pura e varredura. É a
// mesma cegueira que `agendados.integracao.ts` mediu com os plantios 7 e 11, e o
// instrumento aqui é o mesmo: as funções das duas páginas são CHAMADAS dentro de
// um contexto de requisição, e o que se lê é a árvore que elas devolvem.
//
// -----------------------------------------------------------------------------
// ESTE ARQUIVO NÃO PUBLICA NADA, e não precisa de Meta falsa nem de bucket
// falso: ele não chama o dreno e não chama ação nenhuma. Só LÊ. Um servidor de
// mentira aqui seria maquinaria que não mede nada — e que esconderia, atrás do
// próprio ruído, o fato de que esta entrega é de leitura pura.
//
// -----------------------------------------------------------------------------
// NENHUM COOKIE É FORJADO. A jarra sai vazia, e `getSelectedAccount` cai na
// PRIMEIRA conta do schema — o tombo DECLARADO da própria função. Por isso as
// contas nascem em ORDEM: CONTA_A primeiro, CONTA_B depois. O primeiro caso do
// bloco confere essa precondição antes de qualquer medida.
//
// -----------------------------------------------------------------------------
// A AUTOMAÇÃO ATIVA SEMEADA AQUI É CENÁRIO, E NÃO PRÉ-REQUISITO — desde
// 09/09/2026. Até essa data `saude` (app/page.tsx) respondia "Nenhuma automação
// ativa" ANTES de olhar para as falhas, e a automação viva do `beforeAll` era o
// que fazia todo caso do aviso chegar ao ramo vermelho. Isso era uma cegueira
// deste arquivo, e não uma montagem: PUBLICAR NÃO DEPENDE DE AUTOMAÇÃO NENHUMA,
// e a conta sem automação ficava sem aviso nenhum sobre o post que não saiu.
//
// A ORDEM DOS RAMOS FOI TROCADA, e os dois casos de `active = false` mais abaixo
// são o que a prende — um exige o vermelho com a automação desligada, o outro
// exige que o convite continue aparecendo quando não há falha. A automação viva
// continua no `beforeAll` porque ela é o estado NORMAL de uma conta em uso, e é
// nele que os demais casos devem medir.
import { beforeAll, describe, expect, test } from "vitest";
import { bancoDescartavel } from "./harness";
import { comoNumaRequisicao } from "./semear-requisicao";
import { textoDaArvore } from "./texto-da-arvore";

type ModuloConta = typeof import("@/lib/account");
type ModuloTelaDosAgendados = typeof import("@/app/publicar/agendados/page");
type ModuloTelaDoPainel = typeof import("@/app/page");
type ModuloPublicacao = typeof import("@/lib/publicacao");
type ModuloFormato = typeof import("@/lib/format");

const banco = bancoDescartavel();

const CONTA_A = "17800000000003001";
const CONTA_B = "17800000000003002";
// Valores inventados. Nenhuma credencial de verdade entra em teste.
const TOKEN_A = "token-da-conta-a-do-que-nao-saiu-que-nao-vale-nada";
const TOKEN_B = "token-da-conta-b-do-que-nao-saiu-que-nao-vale-nada";

const DIA = 24 * 3600;

let conta: ModuloConta;
let telaDosAgendados: ModuloTelaDosAgendados;
let telaDoPainel: ModuloTelaDoPainel;
let publicacao: ModuloPublicacao;
let formato: ModuloFormato;

beforeAll(async () => {
  // A FRONTEIRA DE SEMPRE: sem token, `scheduleTick` não sai da máquina. Este
  // arquivo não chama o dreno, mas as telas importam módulos que o alcançam.
  delete process.env.QSTASH_TOKEN;

  conta = (await import("@/lib/account")) as ModuloConta;
  telaDosAgendados = (await import("@/app/publicar/agendados/page")) as ModuloTelaDosAgendados;
  telaDoPainel = (await import("@/app/page")) as ModuloTelaDoPainel;
  publicacao = (await import("@/lib/publicacao")) as ModuloPublicacao;
  formato = (await import("@/lib/format")) as ModuloFormato;

  // AS CONTAS NASCEM EM ORDEM. CONTA_A primeiro — ver o cabeçalho.
  for (const [id, token, nome] of [
    [CONTA_A, TOKEN_A, "conta_a_do_que_nao_saiu"],
    [CONTA_B, TOKEN_B, "conta_b_do_que_nao_saiu"],
  ] as const) {
    await banco.db().upsertAccount({
      ig_user_id: id,
      username: nome,
      name: nome,
      profile_picture_url: null,
      access_token: token,
      token_expires_at: null,
    });
  }

  // A AUTOMAÇÃO ATIVA das DUAS contas — o estado normal de uma conta em uso.
  // Ver o cabeçalho: ela é CENÁRIO, e os dois casos de `active = false` medem o
  // lado de fora dela.
  for (const id of [CONTA_A, CONTA_B]) {
    await banco
      .db()
      .sql()
      .query(
        `insert into automations
           (account_id, name, active, triggers, keywords, match_type, steps, ligacoes)
         values ($1, 'automacao viva do que nao saiu', true, '{dm}'::text[],
                 '{quero}'::text[], 'contains', '[]'::jsonb, '[]'::jsonb)`,
        [id]
      );
  }
});

// ---------------------------------------------------------------------------
// Semear e ler. Nada aqui decide nada.
// ---------------------------------------------------------------------------

let semente = 0;

/**
 * Um item de fila, gravado direto.
 *
 * AS TRÊS DATAS SÃO PARÂMETRO — `not_before`, `claimed_at` e `created_at` — e
 * isso é a peça central deste arquivo. Elas são três instantes DIFERENTES na
 * vida de um post agendado: quando ele deveria sair, quando o dreno o pegou (e
 * portanto quando ele falhou), e quando alguém o agendou. A entrega inteira
 * depende de a janela do painel olhar para a segunda, e não para a terceira.
 *
 * TODAS CONTADAS PELO RELÓGIO DO BANCO (`now() + make_interval(...)`), e não
 * pelo da máquina: as janelas do painel são julgadas pelo relógio do banco, e os
 * dois estão a dezenas de segundos de distância aqui.
 */
async function semear(item: {
  conta: string;
  kind?: string;
  status?: string;
  /** Segundos a partir de agora para o `not_before`. Negativo é passado. */
  emSegundos?: number;
  /** Segundos a partir de agora para o `claimed_at`. `null` nunca foi pego. */
  reivindicadoEm?: number | null;
  /** Segundos a partir de agora para o `created_at`. */
  criadoEm?: number;
  error?: string | null;
  legenda?: string;
}): Promise<string> {
  semente++;
  const kind = item.kind ?? "publicacao";
  const payload =
    kind === "publicacao"
      ? {
          forma: "reels",
          caminhos: [`${item.conta}/nao-saiu-${semente}.mp4`],
          ...(item.legenda ? { legenda: item.legenda } : {}),
        }
      : { text: "uma mensagem qualquer" };
  const linhas = (await banco
    .db()
    .sql()
    .query(
      `insert into queue (account_id, kind, contact_ig_id, payload, dedupe_key, status,
                          not_before, claimed_at, created_at, error)
       values ($1, $2, $3, $4, $5, $6,
               now() + make_interval(secs => $7::int),
               case when $8::int is null then null
                    else now() + make_interval(secs => $8::int) end,
               now() + make_interval(secs => $9::int),
               $10)
       returning id`,
      [
        item.conta,
        kind,
        kind === "publicacao" ? null : "99000000000002",
        payload,
        `nao-saiu-teste-${semente}`,
        item.status ?? "pending",
        item.emSegundos ?? 3600,
        item.reivindicadoEm === undefined ? null : item.reivindicadoEm,
        item.criadoEm ?? -60,
        item.error ?? null,
      ]
    )) as { id: string }[];
  return linhas[0].id;
}

async function limparAFila() {
  await banco
    .db()
    .sql()
    .query(`delete from queue where account_id = any($1::text[])`, [[CONTA_A, CONTA_B]]);
}

/**
 * Liga ou desliga a automação de uma conta.
 *
 * É O ÚNICO JEITO HONESTO DE MEDIR O CASO DA CONTA SEM AUTOMAÇÃO. A conta desta
 * suíte é a PRIMEIRA do schema (o tombo declarado de `getSelectedAccount`, com a
 * jarra de cookies vazia), então não dá para trazer uma terceira conta e
 * selecioná-la — isso exigiria forjar cookie, que é regra do dono. O que dá é
 * apagar a automação da própria CONTA_A pela duração de um caso.
 */
async function automacaoAtiva(conta: string, ativa: boolean) {
  await banco
    .db()
    .sql()
    .query(`update automations set active = $2 where account_id = $1`, [conta, ativa]);
}

async function notBeforeDe(id: string): Promise<Date> {
  const linhas = (await banco
    .db()
    .sql()
    .query(`select not_before from queue where id = $1`, [id])) as { not_before: Date }[];
  return linhas[0].not_before;
}

async function claimedAtDe(id: string): Promise<Date> {
  const linhas = (await banco
    .db()
    .sql()
    .query(`select claimed_at from queue where id = $1`, [id])) as { claimed_at: Date }[];
  return linhas[0].claimed_at;
}

// ---------------------------------------------------------------------------
// O INSTRUMENTO É O COMPONENTE DE VERDADE. Estes casos CHAMAM a função de cada
// página dentro de um contexto de requisição e leem a árvore que ela devolve.
// Não há DOM e não há renderizador — não é preciso: uma árvore de elementos
// React já carrega todo o texto, todo `href` e todo `value`, que é tudo o que
// estes casos precisam exigir.
//
// A LEITURA MORA EM `./texto-da-arvore.ts` desde 10/09/2026, e o cabeçalho dela
// diz por que ela não é `JSON.stringify`: aquele estoura nestas duas telas, por
// causa do `<Link>` de `next/link`. Ela nasceu aqui e saiu daqui porque o
// arquivo irmão (`agendados.integracao.ts`) escapava do mesmo estouro POR
// SORTE — todo caso dele semeia um pendente, e o único `<Link>` daquela tela
// mora no estado vazio.
// ---------------------------------------------------------------------------

async function arvoreDosAgendados(): Promise<string> {
  const { valor } = await comoNumaRequisicao("/publicar/agendados", async () =>
    textoDaArvore(await telaDosAgendados.default({ searchParams: Promise.resolve({}) }))
  );
  return valor;
}

async function arvoreDoPainel(): Promise<string> {
  const { valor } = await comoNumaRequisicao("/", async () =>
    textoDaArvore(await telaDoPainel.default({ searchParams: Promise.resolve({}) }))
  );
  return valor;
}

describe("com a conta selecionada pelo tombo declarado (a primeira do schema)", () => {
  test("a condição deste bloco é CONTA_A vir sem cookie nenhum — e ele confere isso antes de medir", async () => {
    const { valor } = await comoNumaRequisicao("/publicar/agendados", () =>
      conta.getSelectedAccountId()
    );
    expect(valor).toBe(CONTA_A);
  });

  // =========================================================================
  // O CASO CENTRAL DA ENTREGA. Até 09/09/2026 a tela tinha UMA consulta, e ela
  // filtrava `pending`: um post que falhava não virava linha vermelha — ele
  // DEIXAVA DE EXISTIR na única lista onde alguém iria procurá-lo.
  // =========================================================================
  test("uma publicação failed aparece na seção das falhadas, com o motivo escrito pelo dreno", async () => {
    await limparAFila();
    const id = await semear({
      conta: CONTA_A,
      status: "failed",
      emSegundos: -2 * 3600,
      reivindicadoEm: -2 * 3600,
      error: "Instagram API 400: media nao encontrada",
      legenda: "Lancamento de setembro",
    });

    const arvore = await arvoreDosAgendados();

    expect(arvore).toContain(id);
    // O MOTIVO CHEGA INTEIRO. Sem ele a seção diria só que algo falhou, que é a
    // metade da informação que não ajuda ninguém.
    expect(arvore).toContain("media nao encontrada");
    // A HORA É A EM QUE ELE FALHOU (`claimed_at`), e a frase é a da falha. O
    // caso que separa essa coluna do `not_before` é o próximo — aqui os dois
    // instantes são o mesmo, de propósito: este é o caso do post comum.
    expect(arvore).toContain(formato.fmtDate(await claimedAtDe(id)));
    expect(arvore).toContain(publicacao.FRASE_DA_FALHA);
    // A FORMA E O COMEÇO DA LEGENDA, pelas mesmas funções da lista de cima.
    expect(arvore).toContain(publicacao.rotuloDaForma("reels"));
    expect(arvore).toContain("Lancamento de setembro");
    // E NÃO HÁ BOTÃO NENHUM nesta seção: não há o que cancelar num post que já
    // falhou. Se o item falhado tivesse ganhado formulário, o `value` dele
    // apareceria na árvore ao lado do identificador.
    expect(arvore).not.toContain(`value=${id}`);
  });

  // =========================================================================
  // O `not_before` NO FUTURO NUM POST QUE JÁ FALHOU — e este é o caso que a
  // entrega não tinha, o que fazia a tela prometer uma saída já recusada.
  //
  // Ele NÃO é um estado inventado: é o que o dreno fabrica. `finish`
  // (lib/queue-drain.ts) grava `not_before = now() + retryInSeconds` SEM olhar
  // o status, e o `catch` genérico do dreno o chama com `retryInSeconds: 120`
  // também no ramo `failed`. Todo post que falha por exceção — um 400 da Meta
  // ao criar o contêiner, um 500 repetido — nasce `failed` com `not_before`
  // dois minutos no futuro, e o laço de espera empurra mais.
  //
  // MEDIDO antes do conserto: a linha imprimia "Estava marcado para 16:10"
  // quando eram 16:09. Hora no futuro, num post que já não vai sair.
  //
  // OS DOIS INSTANTES ESTÃO A HORAS DE DISTÂNCIA AQUI de propósito: `fmtDate`
  // arredonda para o minuto, e um par de segundos de diferença deixaria as duas
  // colunas imprimindo a MESMA string — o caso passaria com qualquer uma das
  // duas.
  // =========================================================================
  test("um post falhado com not_before no FUTURO diz a hora em que FALHOU", async () => {
    await limparAFila();
    const id = await semear({
      conta: CONTA_A,
      status: "failed",
      // O QUE O DRENO ESCREVE: dois minutos à frente, no ramo `failed`.
      emSegundos: 120,
      reivindicadoEm: -3 * 3600,
      error: "Instagram API 400: o conteiner nao subiu",
    });

    const arvore = await arvoreDosAgendados();

    expect(arvore).toContain(id);
    expect(arvore).toContain(publicacao.FRASE_DA_FALHA);
    expect(arvore).toContain(formato.fmtDate(await claimedAtDe(id)));
    // E A HORA DA RETENTATIVA QUE NUNCA VAI ACONTECER NÃO APARECE. Sem esta
    // linha o caso passaria imprimindo as duas.
    expect(arvore).not.toContain(formato.fmtDate(await notBeforeDe(id)));
    // NEM A FRASE QUE PROMETE SAÍDA: as duas metades de `fraseDaDataDaLinha`
    // falam de um item que ainda está na fila, e este não está.
    expect(arvore).not.toContain("Estava marcado para ");
    expect(arvore).not.toContain("Sai em ");
  });

  // =========================================================================
  // A ORDEM DA SEÇÃO, e ela repousa na MESMA coluna da linha.
  //
  // A pergunta desta seção é "o que acabou de falhar?", porque a falha mais
  // recente é a que ainda dá tempo de republicar. Ordenar por `not_before`
  // responde outra pergunta: põe na frente o post cuja máquina de retentativa
  // empurrou MAIS longe — que é quase o contrário.
  //
  // Este caso mata os dois plantios de uma vez: a coluna trocada (o `desc` em
  // `not_before` põe o antigo na frente) e o sentido trocado (`asc` em
  // `coalesce` também).
  // =========================================================================
  test("as falhadas vêm da mais recente para a mais antiga, pela hora em que falharam", async () => {
    await limparAFila();
    // FALHOU HÁ UMA HORA, e o dreno empurrou o `not_before` para duas horas à
    // frente — a linha que uma ordem por `not_before` poria em primeiro.
    const antiga = await semear({
      conta: CONTA_A,
      status: "failed",
      emSegundos: 2 * 3600,
      reivindicadoEm: -3600,
      error: "a que falhou primeiro",
    });
    // FALHOU HÁ DEZ MINUTOS. É esta que a pessoa está procurando.
    const recente = await semear({
      conta: CONTA_A,
      status: "failed",
      emSegundos: -600,
      reivindicadoEm: -600,
      error: "a que acabou de falhar",
    });

    const arvore = await arvoreDosAgendados();

    expect(arvore).toContain(antiga);
    expect(arvore).toContain(recente);
    expect(arvore.indexOf(recente)).toBeLessThan(arvore.indexOf(antiga));
  });

  // =========================================================================
  // AS DUAS SEÇÕES FICAM SEPARADAS, e este é o par que prende a separação. Uma
  // consulta que perdesse o `status` faria as duas listas mostrarem a mesma
  // coisa — e a lista de baixo passaria a oferecer "não há o que cancelar"
  // sobre um post que ainda dá para cancelar.
  // =========================================================================
  test("a publicação pending fica na seção de agendados e NÃO aparece na das falhadas", async () => {
    await limparAFila();
    const agendado = await semear({ conta: CONTA_A, emSegundos: 4 * 3600 });

    const arvore = await arvoreDosAgendados();

    expect(arvore).toContain(agendado);
    // O ITEM PENDENTE CONTINUA ALCANCAVEL, e o que mudou em 11/09/2026 foi o
    // ENDERECO disso: a lista virou calendario, e os formularios de cancelar e
    // remarcar sairam do quadrado do dia para a tela de detalhe. O que se mede
    // aqui passa a ser o LINK que leva ate eles — sem ele, os formularios
    // existiriam numa tela que ninguem alcanca a partir daqui.
    expect(arvore).toContain(`/publicar/agendados/${agendado}`);
    // E A SEÇÃO DAS FALHADAS NEM APARECE: ela só existe quando há alguma.
    expect(arvore).not.toContain("Não saíram");
  });

  // =========================================================================
  // A FILA ALHEIA. É o plantio 7 de `agendados.integracao.ts` na consulta nova:
  // sem o `account_id`, a tela conta sobre o post de outra conta — e desta vez
  // não há ação nenhuma atrás para recusar, porque a seção não tem botão.
  // =========================================================================
  test("a falha de OUTRA conta não aparece em nenhuma das duas seções", async () => {
    await limparAFila();
    const meu = await semear({
      conta: CONTA_A,
      status: "failed",
      emSegundos: -3600,
      reivindicadoEm: -3600,
      error: "erro da conta A",
    });
    const alheio = await semear({
      conta: CONTA_B,
      status: "failed",
      emSegundos: -3600,
      reivindicadoEm: -3600,
      error: "erro da conta B que ninguem daqui pode ler",
    });
    const alheioAgendado = await semear({ conta: CONTA_B, emSegundos: 4 * 3600 });
    // E A MENSAGEM FALHADA DA PRÓPRIA CONTA, que é o outro vizinho: ela se
    // resolve em Envios, e uma linha dela aqui chamaria DM de post.
    const mensagem = await semear({
      conta: CONTA_A,
      kind: "dm_manual",
      status: "failed",
      emSegundos: -3600,
      reivindicadoEm: -3600,
      error: "erro de mensagem que nao e post",
    });

    const arvore = await arvoreDosAgendados();

    expect(arvore).toContain(meu);
    expect(arvore).not.toContain(alheio);
    expect(arvore).not.toContain(alheioAgendado);
    expect(arvore).not.toContain(mensagem);
    expect(arvore).not.toContain("erro da conta B");
    expect(arvore).not.toContain("erro de mensagem que nao e post");
  });

  // =========================================================================
  // O PAR QUE PRENDE A DIFERENÇA ENTRE AS DUAS REGRAS, e é o caso mais
  // importante deste arquivo.
  //
  // As duas telas têm prazos DIFERENTES de propósito: o painel para de avisar
  // depois de 7 dias, porque um aviso vermelho por um post que já é história é
  // ruído — e ruído numa tela de diagnóstico ensina a ignorá-la. A tela de
  // agendados NÃO tem recorte de tempo, porque é para onde se vai PROCURAR, e
  // uma falha antiga sumindo de lá é o mesmo defeito por outro caminho.
  //
  // Uma janela só, dos dois lados, apagaria um dos dois — e nenhum caso
  // sozinho acusaria.
  // =========================================================================
  test("uma falha de 8 dias sai do aviso do painel e CONTINUA na tela de agendados", async () => {
    await limparAFila();
    const antiga = await semear({
      conta: CONTA_A,
      status: "failed",
      emSegundos: -8 * DIA,
      reivindicadoEm: -8 * DIA,
      criadoEm: -9 * DIA,
      error: "falhou ha oito dias",
    });

    const agendados = await arvoreDosAgendados();
    expect(agendados).toContain(antiga);
    expect(agendados).toContain("falhou ha oito dias");

    const painel = await arvoreDoPainel();
    expect(painel).not.toContain("publicação não saiu");
    expect(painel).not.toContain("publicações não saíram");
    // E O PAINEL NÃO FICA MUDO POR ACIDENTE: ele diz, com todas as letras, que
    // não há nada a fazer — que é o que "sai do aviso" quer dizer.
    //
    // ISTO ERA `not.toContain("Precisa de atenção")` ATÉ 10/09/2026, e virou
    // asserção VAZIA no dia em que a tela inicial foi reescrita: aquela frase
    // deixou de existir na árvore, então a linha passava sem medir nada. Uma
    // asserção que não pode mais falhar é pior que nenhuma — ela ocupa o lugar
    // de uma garantia. A versão nova mede a PRESENÇA do estado calmo, que só
    // aparece quando `oQuePrecisaDeVoce` devolve lista vazia.
    expect(painel).toContain("Nada precisa de você agora");
  });

  // =========================================================================
  // O OUTRO LADO DOS 8 DIAS, e ele foi acrescentado DEPOIS DE MEDIR.
  //
  // O plano prometia que o plantio "janela de 7 dias virando 24h" ficaria
  // vermelho no caso dos 8 dias. MEDIDO: fica VERDE, e não podia ser diferente
  // — aquele caso exige que o painel NÃO avise, e encolher a janela só faz o
  // painel avisar MENOS. Um par de casos em que os dois lados exigem silêncio
  // não prende janela nenhuma; ele passaria igual com a janela em zero.
  //
  // ESTE É O LADO QUE FALTAVA: três dias estão dentro dos sete e fora das
  // vinte e quatro horas, então ele é o único caso do arquivo que a janela
  // encolhida derruba de verdade — e não pela margem de segundos com que o caso
  // de "ontem" bate no limite das 24h.
  // =========================================================================
  test("uma falha de 3 dias AINDA avisa — e e ela que prende os 7 dias", async () => {
    await limparAFila();
    await semear({
      conta: CONTA_A,
      status: "failed",
      emSegundos: -3 * DIA,
      reivindicadoEm: -3 * DIA,
      criadoEm: -3 * DIA,
      error: "falhou ha tres dias",
    });

    const painel = await arvoreDoPainel();

    expect(painel).toContain("publicação não saiu");
    expect(painel).toContain("/publicar/agendados");
  });

  // =========================================================================
  // A MEDIÇÃO QUE MUDOU A COLUNA DA CONSULTA (09/09/2026).
  //
  // O plano pedia a janela sobre `created_at`. Medido no dreno: `created_at` é
  // o instante em que o post foi AGENDADO, e `claimed_at` é o instante da
  // tentativa que falhou (`update queue set status='sending', claimed_at=now()`,
  // lib/queue-drain.ts, e nada nunca a limpa).
  //
  // Para uma equipe de marketing que agenda conteúdo com semanas de
  // antecedência, os dois estão a semanas de distância — e contar por
  // `created_at` faria um lançamento agendado há vinte dias e falhado ONTEM
  // nascer fora da janela. Ou seja: devolveria exatamente o modo de falha que
  // esta entrega existe para fechar, com o aviso calado no dia seguinte à
  // falha.
  //
  // ESTE CASO FICA VERMELHO com a consulta que o plano escreveu, e verde com a
  // que está no arquivo.
  // =========================================================================
  test("um post agendado ha 20 dias e falhado ONTEM continua no aviso do painel", async () => {
    await limparAFila();
    await semear({
      conta: CONTA_A,
      status: "failed",
      emSegundos: -1 * DIA,
      reivindicadoEm: -1 * DIA,
      // AGENDADO HÁ VINTE DIAS — bem fora dos 7 dias do aviso.
      criadoEm: -20 * DIA,
      error: "falhou ontem, num post agendado ha muito tempo",
    });

    const painel = await arvoreDoPainel();

    expect(painel).toContain("publicação não saiu");
    expect(painel).toContain("/publicar/agendados");
  });

  // =========================================================================
  // O ITEM FALHADO QUE NUNCA FOI REIVINDICADO — o braço do `coalesce`.
  //
  // POR QUE ELE É SEMEADO, E NÃO APAGADO. O `coalesce(claimed_at, not_before)`
  // aparece em TRÊS lugares que precisam concordar: a contagem da janela de 7
  // dias (app/page.tsx), a ordem da seção das falhadas e a data da linha
  // (`linhaDaFalha`). Hoje o braço da direita é inalcançável — `failed` só é
  // escrito por `finish`, que só roda depois da reivindicação, e nada nunca
  // limpa `claimed_at` —, e por isso ele sobreviveu a todos os cinco portões.
  //
  // Havia duas saídas defensáveis: tirar o `coalesce` ou semear o caso. Tirar
  // exigiria tirá-lo dos TRÊS, e deixaria a tela de diagnóstico imprimindo "—"
  // na hora e a linha subindo para o topo da seção (em `desc`, o Postgres põe
  // NULO primeiro) no dia em que uma linha adulterada à mão aparecesse — que é
  // o dia em que alguém está justamente olhando para esta tela. Semear custa um
  // caso e prende os três de uma vez.
  //
  // A COLUNA É `jsonb` E A TABELA É EDITÁVEL POR FORA DO PAINEL, e este arquivo
  // já mede o payload adulterado pelo mesmo motivo. A diferença é que aqui a
  // rede é de UMA linha de SQL, e sem este caso ela era código que nada media.
  // =========================================================================
  test("uma falha sem claimed_at cai no not_before — no aviso, na ordem e na linha", async () => {
    await limparAFila();
    const semReivindicacao = await semear({
      conta: CONTA_A,
      status: "failed",
      emSegundos: -2 * 3600,
      // NUNCA FOI REIVINDICADO. É o braço da direita do `coalesce`.
      reivindicadoEm: null,
      criadoEm: -2 * 3600,
      error: "a falha sem hora de reivindicacao",
    });
    // A VIZINHA COM `claimed_at`, e ela é o que mede a ORDEM: sem o `coalesce`
    // no `order by`, o `desc` do Postgres põe o NULO em primeiro.
    const recente = await semear({
      conta: CONTA_A,
      status: "failed",
      emSegundos: -600,
      reivindicadoEm: -600,
      error: "a que acabou de falhar",
    });

    // 1. A CONTAGEM DA JANELA. Sem o `coalesce`, a linha sem `claimed_at` não
    //    entra em janela nenhuma — e some do aviso.
    const painel = await arvoreDoPainel();
    expect(painel).toContain("publicações não saíram");

    const agendados = await arvoreDosAgendados();
    expect(agendados).toContain(semReivindicacao);
    // 2. A DATA DA LINHA. Sem o `??` de `linhaDaFalha`, `fmtDate` imprime "—" —
    //    e célula em branco numa tela de diagnóstico parece defeito DA TELA.
    expect(agendados).toContain(formato.fmtDate(await notBeforeDe(semReivindicacao)));
    // 3. A ORDEM. A que acabou de falhar continua em primeiro.
    expect(agendados.indexOf(recente)).toBeLessThan(agendados.indexOf(semReivindicacao));
  });

  // =========================================================================
  // A PALAVRA E O DESTINO. Até 09/09/2026 o painel escrevia "mensagem não saiu"
  // sobre QUALQUER falha, e mandava para `/eventos` — a tela onde uma
  // publicação não se resolve.
  // =========================================================================
  test("só publicação diz publicação, e manda para a tela dos agendados", async () => {
    await limparAFila();
    await semear({
      conta: CONTA_A,
      status: "failed",
      emSegundos: -3600,
      reivindicadoEm: -3600,
      error: "a unica falha desta rodada",
    });

    const painel = await arvoreDoPainel();

    expect(painel).toContain("publicação não saiu");
    expect(painel).not.toContain("mensagem não saiu");
    expect(painel).toContain("/publicar/agendados");
  });

  // =========================================================================
  // A CONTA SEM AUTOMAÇÃO ATIVA — e este é o caso que faltava, o que passava
  // por cima do portão sem ninguém querer.
  //
  // Até 09/09/2026 `saude` (app/page.tsx) respondia `!counts.autos` ANTES de
  // olhar para `falhas`, e PUBLICAR NÃO DEPENDE DE AUTOMAÇÃO NENHUMA: a equipe
  // de marketing que só agenda post tinha o post falhado na tela de agendados e
  // o painel calado sobre ele. Medido: avisa=false, atencao=false.
  //
  // O PRÓPRIO `beforeAll` DESTE ARQUIVO ESCONDIA ISSO. Ele semeia automação
  // viva nas duas contas — para os outros casos chegarem ao ramo vermelho — e
  // com isso nenhum caso jamais entrava pelo lado de fora. Este entra: desliga
  // a automação da conta pela duração da medida, e a religa no `finally`, para
  // não derrubar por tabela todo caso que vier depois.
  // =========================================================================
  test("a conta SEM automação ativa também é avisada da publicação que não saiu", async () => {
    await limparAFila();
    await automacaoAtiva(CONTA_A, false);
    try {
      await semear({
        conta: CONTA_A,
        status: "failed",
        emSegundos: -3600,
        reivindicadoEm: -3600,
        error: "o post que nao saiu numa conta sem automacao",
      });

      const painel = await arvoreDoPainel();

      expect(painel).toContain("publicação não saiu");
      expect(painel).toContain("Precisa de você");
      expect(painel).toContain("/publicar/agendados");
      // O QUE MUDOU EM 10/09/2026, E POR QUE A ASSERÇÃO FICOU MAIS FORTE.
      //
      // Até aqui o painel tinha UM cartão de saúde, e ou ele era o aviso ou era
      // o convite — por isso o caso media AUSÊNCIA do convite: era assim que se
      // sabia qual dos dois tinha ganhado o cartão único. A tela inicial virou
      // uma LISTA ordenada (lib/precisa-de-voce.ts), e nela os dois aparecem
      // juntos: a falha em cima, o convite embaixo. Nada é engolido.
      //
      // Medir ausência agora estaria medindo a tela errada. O que continua
      // valendo — e é o motivo original deste caso — é que a falha vem PRIMEIRO,
      // e é isso que passa a ser medido. É uma garantia mais forte do que a
      // anterior: antes, o convite não podia aparecer; agora ele aparece e não
      // pode passar na frente.
      expect(painel).toContain("Nenhuma automação ativa");
      expect(
        painel.indexOf("publicação não saiu"),
        "a falha tem de vir ANTES do convite"
      ).toBeLessThan(painel.indexOf("Nenhuma automação ativa"));
    } finally {
      await automacaoAtiva(CONTA_A, true);
    }
  });

  // O OUTRO LADO, e ele é o que impede a troca de ordem de virar "o convite
  // sumiu": sem falha nenhuma, a conta sem automação continua recebendo o
  // convite de sempre.
  test("sem falha nenhuma, a conta sem automação continua vendo o convite", async () => {
    await limparAFila();
    await automacaoAtiva(CONTA_A, false);
    try {
      const painel = await arvoreDoPainel();

      expect(painel).toContain("Nenhuma automação ativa");
      // E NENHUMA FALHA APARECE JUNTO. O título da seção ("Precisa de você") é
      // o mesmo nos dois casos agora — ele não distingue mais nada —, então o
      // que se mede é a ausência das duas frases de falha.
      expect(painel).not.toContain("não saiu");
      expect(painel).not.toContain("não saíram");
    } finally {
      await automacaoAtiva(CONTA_A, true);
    }
  });

  test("só mensagem continua dizendo mensagem, e mandando para eventos", async () => {
    await limparAFila();
    await semear({
      conta: CONTA_A,
      kind: "dm_manual",
      status: "failed",
      emSegundos: -3600,
      reivindicadoEm: -3600,
      criadoEm: -3600,
      error: "a mensagem que nao saiu",
    });

    const painel = await arvoreDoPainel();

    expect(painel).toContain("mensagem não saiu");
    expect(painel).not.toContain("publicação não saiu");
    expect(painel).toContain("/eventos");
    // E A JANELA DA MENSAGEM NÃO MUDOU: 24 horas, como sempre foram.
    expect(painel).toContain(`${publicacao.HORAS_DE_AVISO_DA_MENSAGEM}h`);
  });

  // =========================================================================
  // A JANELA DA MENSAGEM FICA ONDE ESTAVA, e este caso é o que impede a
  // generosidade dos 7 dias de escorregar para o lado dela. O comportamento de
  // mensagem não muda nesta entrega.
  //
  // VINTE E CINCO HORAS, E NÃO TRÊS DIAS — desde 10/09/2026, e a hora saiu de
  // uma medição, não de um gosto.
  //
  // Até essa data o caso semeava em -3 dias, e nessa distância ele não prendia
  // janela nenhuma no meio: com a janela plantada em 48 h o caso continuava
  // VERDE, porque -72 h está fora dos 48 h também. Ele só acusava a partir de
  // ~72 h, e ainda assim pela margem de milissegundos entre a transação que
  // semeia e a que lê — as duas contam do `now()` do banco, e a segunda é
  // sempre a mais tarde, então -72 h cai FORA de uma janela de exatamente 72 h.
  //
  // -2 DIAS TAMBÉM NÃO SERVE, e foi medido: -48 h contra uma janela de 48 h é a
  // MESMA margem exata, e o plantio de 48 h sobrevive.
  //
  // A distância certa é a que fica FORA das 24 h por folga e DENTRO de qualquer
  // janela maior. Medido em -25 h: a janela de 26 h fica vermelha, a de 48 h
  // fica vermelha, e as 24 h de verdade continuam verdes com uma hora inteira
  // de folga — e não com os milissegundos de que a margem exata dependia.
  // =========================================================================
  test("uma mensagem falhada ha 25 horas NAO avisa — as 24h dela ficam como estavam", async () => {
    await limparAFila();
    await semear({
      conta: CONTA_A,
      kind: "dm_manual",
      status: "failed",
      emSegundos: -25 * 3600,
      reivindicadoEm: -25 * 3600,
      criadoEm: -25 * 3600,
      error: "mensagem falhada ha vinte e cinco horas",
    });

    const painel = await arvoreDoPainel();

    expect(painel).not.toContain("mensagem não saiu");
    expect(painel).not.toContain("mensagens não saíram");
    // Mesma troca do caso dos 8 dias: presença do estado calmo, e não ausência
    // de uma frase que não existe mais.
    expect(painel).toContain("Nada precisa de você agora");
  });

  // =========================================================================
  // AS DUAS AO MESMO TEMPO. A frase diz as duas coisas, e o destino não pode
  // esconder metade — a publicação vem primeiro porque é a que ficou faltando
  // no perfil público.
  // =========================================================================
  test("publicação e mensagem juntas dizem as duas, e o destino é o dos agendados", async () => {
    await limparAFila();
    await semear({
      conta: CONTA_A,
      status: "failed",
      emSegundos: -3600,
      reivindicadoEm: -3600,
      error: "o post que nao saiu",
    });
    for (const n of [1, 2]) {
      await semear({
        conta: CONTA_A,
        kind: "dm_manual",
        status: "failed",
        emSegundos: -3600 * n,
        reivindicadoEm: -3600 * n,
        criadoEm: -3600 * n,
        error: "a mensagem que nao saiu",
      });
    }

    const painel = await arvoreDoPainel();

    expect(painel).toContain("publicação não saiu");
    expect(painel).toContain("mensagens não saíram");
    expect(painel).toContain("/publicar/agendados");
  });
});
