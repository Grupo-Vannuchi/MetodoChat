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

// ---------------------------------------------------------------------------
// O INSTRUMENTO É O COMPONENTE DE VERDADE. Estes casos CHAMAM a função de cada
// página dentro de um contexto de requisição e leem a árvore que ela devolve.
// Não há DOM e não há renderizador — não é preciso: uma árvore de elementos
// React já carrega todo o texto, todo `href` e todo `value`, que é tudo o que
// estes casos precisam exigir.
//
// -----------------------------------------------------------------------------
// POR QUE NÃO `JSON.stringify`, QUE É O QUE `agendados.integracao.ts` USA
//
// Medido em 09/09/2026: ele ESTOURA nestas duas telas, com
// "Converting circular structure to JSON --- property 'default' closes the
// circle". A causa é `next/link`. Fora do empacotador do Next, o módulo dele
// resolve para um objeto CommonJS cujo `default` aponta para o próprio módulo, e
// esse objeto vira o `type` do elemento `<Link>` — que `JSON.stringify` visita.
//
// O ARQUIVO IRMÃO NÃO TROPEÇA NISSO POR SORTE, e não por desenho: todos os
// casos dele semeiam um item PENDENTE, então a tela nunca cai no estado vazio —
// que é o único lugar onde ela desenha um `<Link>`. O painel desenha vários
// sempre.
//
// ENTÃO A LEITURA DESCE PELA ÁRVORE, e não pelo objeto: ela junta o texto, a
// `key` e os `props` de valor simples, e NÃO visita o `type` de elemento nenhum.
// Além de não estourar, ela não arrasta as entranhas do Next para dentro do
// texto onde os `toContain` procuram.
// ---------------------------------------------------------------------------

/** O texto, as `key` e os `props` simples de uma árvore de elementos React. */
function textoDaArvore(no: unknown, saida: string[] = []): string[] {
  if (no === null || no === undefined || typeof no === "boolean") return saida;
  if (typeof no === "string" || typeof no === "number") {
    saida.push(String(no));
    return saida;
  }
  if (Array.isArray(no)) {
    for (const filho of no) textoDaArvore(filho, saida);
    return saida;
  }
  if (typeof no !== "object") return saida;
  const elemento = no as { key?: unknown; props?: unknown };
  // A `key` é onde o identificador da linha aparece — é por ela que os casos
  // perguntam se um item entrou ou não na lista.
  if (typeof elemento.key === "string") saida.push(elemento.key);
  const props = elemento.props;
  if (props && typeof props === "object") {
    for (const [chave, valor] of Object.entries(props as Record<string, unknown>)) {
      if (chave === "children") textoDaArvore(valor, saida);
      else if (typeof valor === "string" || typeof valor === "number") {
        saida.push(`${chave}=${valor}`);
      }
    }
  }
  return saida;
}

async function arvoreDosAgendados(): Promise<string> {
  const { valor } = await comoNumaRequisicao("/publicar/agendados", async () =>
    textoDaArvore(await telaDosAgendados.default({ searchParams: Promise.resolve({}) })).join("\n")
  );
  return valor;
}

async function arvoreDoPainel(): Promise<string> {
  const { valor } = await comoNumaRequisicao("/", async () =>
    textoDaArvore(await telaDoPainel.default({ searchParams: Promise.resolve({}) })).join("\n")
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
    // A HORA É A QUE ELE DEVERIA TER SAÍDO, e a frase que vem antes dela é a
    // mesma das outras duas telas (`fraseDaDataDaLinha`).
    expect(arvore).toContain(formato.fmtDate(await notBeforeDe(id)));
    expect(arvore).toContain("Estava marcado para ");
    // A FORMA E O COMEÇO DA LEGENDA, pelas mesmas funções da lista de cima.
    expect(arvore).toContain(publicacao.rotuloDaForma("reels"));
    expect(arvore).toContain("Lancamento de setembro");
    // E NÃO HÁ BOTÃO NENHUM nesta seção: não há o que cancelar num post que já
    // falhou. Se o item falhado tivesse ganhado formulário, o `value` dele
    // apareceria na árvore ao lado do identificador.
    expect(arvore).not.toContain(`value=${id}`);
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
    // O ITEM PENDENTE CONTINUA COM OS BOTÕES: é o `value` do `<input hidden>`
    // dos formulários de cancelar e remarcar.
    expect(arvore).toContain(`value=${agendado}`);
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
    // E O PAINEL NÃO FICA MUDO POR ACIDENTE: o cartão de saúde saiu do ramo
    // vermelho, que é o que "sai do aviso" quer dizer.
    expect(painel).not.toContain("Precisa de atenção");
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
      expect(painel).toContain("Precisa de atenção");
      expect(painel).toContain("/publicar/agendados");
      // E O CARTÃO NÃO É O DO CONVITE: era ele que engolia o aviso. Sem esta
      // linha o caso passaria com os dois cartões ao mesmo tempo, que é
      // impossível — mas quem lê o teste não saberia qual dos dois ganhou.
      expect(painel).not.toContain("Nenhuma automação ativa");
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
      expect(painel).not.toContain("Precisa de atenção");
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
  // =========================================================================
  test("uma mensagem falhada ha 3 dias NAO avisa — as 24h dela ficam como estavam", async () => {
    await limparAFila();
    await semear({
      conta: CONTA_A,
      kind: "dm_manual",
      status: "failed",
      emSegundos: -3 * DIA,
      reivindicadoEm: -3 * DIA,
      criadoEm: -3 * DIA,
      error: "mensagem falhada ha tres dias",
    });

    const painel = await arvoreDoPainel();

    expect(painel).not.toContain("mensagem não saiu");
    expect(painel).not.toContain("mensagens não saíram");
    expect(painel).not.toContain("Precisa de atenção");
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
