// O QUINTO CAMINHO DA FRENTE 2: as duas PORTAS que decidem se um desenho pode
// ser publicado — `salvarAutomacao` e `toggleAutomation`, de
// `app/automacoes/actions.ts`, rodadas de verdade contra o schema descartável.
//
// O NOME é o que as duas fazem juntas. Elas não são "as ações da automação"
// (`deleteAutomation` e `duplicateAutomation` também são, e não estão aqui): são
// as duas únicas que respondem à pergunta "isto pode ir ao ar?", cada uma de um
// lado, e é a DIVISÃO ENTRE AS DUAS que este arquivo mede.
//
// E ENTROU UM CASO DE `criarAutomacao`, no fim, por uma razão só: a guarda de
// palavra-chave por gatilho é a MESMA linha escrita duas vezes, uma em cada
// função (`actions.ts`; o porquê inteiro está em `gatilhoPedePalavraChave`,
// @/lib/steps). Medir uma e deixar a outra sem rede é deixar metade da correção
// que desbloqueou o gatilho de abertura sem teste nenhum.
//
// -----------------------------------------------------------------------------
// POR QUE ELE EXISTE — e a regra da Frente 2 é explícita sobre isto.
//
// "Um caminho novo entra só quando um defeito real escapou por ele." Escaparam
// DOIS. Dos oito defeitos que sobreviviam a `tsc`, `eslint`, aos 677 puros e à
// varredura, dois moram neste arquivo, e ele não tinha NENHUM teste que o
// importasse — nem podia ter, porque o nó dele não era o banco.
//
// O NÓ ERA O ESCOPO DE REQUISIÇÃO DO NEXT: as duas funções passam por
// `getSelectedAccountId` (lib/account.ts), que chama `cookies()`. Ele está
// desatado em `semear-requisicao.ts`, ao lado — leia o cabeçalho de lá antes de
// mexer aqui, e em especial a parte da jarra vazia.
//
// -----------------------------------------------------------------------------
// NENHUMA SESSÃO É FORJADA AQUI, e isto está escrito para ninguém no futuro ler
// este arquivo e achar que aqui se inventa credencial.
//
// A jarra de cookies sai VAZIA — sem `metodochat_session`, sem
// `metodochat_account`. `getSelectedAccount` (lib/account.ts) cai na PRIMEIRA
// conta quando o cookie está ausente, e o schema descartável tem exatamente uma:
// a que o `beforeAll` abaixo cria. Esse tombo é o comportamento DECLARADO da
// função, escrito no comentário que está em cima dela — não é brecha, não é
// atalho, e não é uma sessão inventada. A conta que estas duas portas enxergam é
// a conta deste teste por construção do schema, e não por credencial.
//
// -----------------------------------------------------------------------------
// O QUE ELE MEDE, e por que não bastava função pura.
//
// `conferirLista` e `podeFicarAtiva` (lib/steps.ts) são puras e já têm teste.
// Os dois defeitos que este caminho pega PASSAM POR BAIXO delas:
//
//   1. QUAL DAS DUAS LISTAS CADA PORTA USA. `salvarAutomacao` filtra
//      `nivel === "erro" && quando === "salvar"`; `toggleAutomation` filtra só
//      `nivel === "erro"`, os dois níveis. Trocar as duas linhas de porta é
//      edição de duas linhas, `conferirLista` continua devolvendo exatamente os
//      mesmos problemas, e nenhum teste puro enxerga a troca. O estrago é dos
//      dois lados: o ATIVAR passa a deixar subir botão sem destino, bloco
//      inalcançável, portão sem saída e link contornável; e o SALVAR passa a
//      recusar todo desenho pela metade, que é o estado normal de quem monta.
//
//   2. DE ONDE `toggleAutomation` LÊ A CHAVE DO DONO. O quarto argumento de
//      `conferirLista` é `Boolean(a.entrega_sem_portao)` — a coluna, lida do
//      banco. Trocado por `true`, toda automação passa a poder publicar
//      entregando o link a quem não segue. É FIAÇÃO, não decisão: a função pura
//      recebe o argumento errado e responde certo para a pergunta errada.
//
// Por isso a prova é feita OLHANDO A COLUNA `active` NO BANCO, e não só o objeto
// devolvido: é ela que decide se o motor entrega.
//
// -----------------------------------------------------------------------------
// A FORMA QUE ISOLA UMA REGRA SÓ, medida em `conferirLista`: com a chave
// desligada dá exatamente UM problema — erro de ATIVAR, "dá para chegar neste
// link sem passar pelo pedido de follow" — e com a chave ligada, NENHUM. Nenhum
// erro de salvar, nenhum bloco solto, nenhum portão sem saída.
//
//     LINK (dm, com url) --sempre--> PORTÃO (pedir_follow) --sempre--> FIM (dm)
//
// O link é o bloco de ENTRADA: chega-se nele sem nunca passar pelo portão. É essa
// unicidade que faz cada vermelho apontar para uma causa só.
//
// -----------------------------------------------------------------------------
// O LIMITE HONESTO, o mesmo dos outros quatro caminhos: sob o vitest o
// `"use server"` é inerte, então as duas funções são chamadas DIRETO. Isto
// exercita o CORPO do Server Action, e não a fronteira de serialização do POST.
import { beforeAll, describe, expect, test } from "vitest";
import { bancoDescartavel } from "./harness";
import { comoNumaRequisicao } from "./semear-requisicao";

type ModuloAcoes = typeof import("@/app/automacoes/actions");

const banco = bancoDescartavel();

// A ÚNICA conta do schema descartável — é nela que `getSelectedAccount` cai
// quando não há cookie, que é sempre, porque cookie nenhum é forjado.
const CONTA = "17841400000000999";

let acoes: ModuloAcoes;

const LINK = {
  id: "b_linkzz1",
  tipo: "dm",
  texto: "Toma o material 👇",
  url: "https://exemplo.test/recompensa",
  botao_label: "Abrir",
};
const PORTAO = {
  id: "b_portao1",
  tipo: "pedir_follow",
  texto: "Segue lá primeiro 🙏",
  botao_label: "Já sigo!",
};
const FIM = { id: "b_fimzz01", tipo: "dm", texto: "Valeu!" };

const PASSOS = [LINK, PORTAO, FIM];
const LIGACOES = [
  { de: "b_linkzz1", quando: { tipo: "sempre" }, para: "b_portao1" },
  { de: "b_portao1", quando: { tipo: "sempre" }, para: "b_fimzz01" },
];

// A frase é a de `conferirLista`, e não uma cópia reescrita: se ela mudar de
// palavras, o teste tem de saber — a mesma disciplina de "duas frases diferentes
// para o mesmo problema é doença" que o cabeçalho de `Resultado` registra.
const FRASE_DO_PORTAO = /sem passar pelo pedido de follow/;

beforeAll(async () => {
  await banco.db().upsertAccount({
    ig_user_id: CONTA,
    username: "conta_do_quinto_caminho",
    name: "Conta do quinto caminho",
    profile_picture_url: null,
    access_token: "token_de_teste",
    token_expires_at: null,
  });
  // O import vem DEPOIS do harness ter apontado a DATABASE_URL para o schema
  // temporário: `app/automacoes/actions.ts` puxa `lib/db`, e o `_sql` de lá é
  // singleton de módulo que lê o ambiente na primeira chamada.
  acoes = (await import("@/app/automacoes/actions")) as ModuloAcoes;
});

/**
 * Uma automação PAUSADA com a forma acima, diferindo apenas na coluna que guarda
 * a decisão do dono. É a única variável entre os dois primeiros casos.
 */
async function semear(nome: string, entregaSemPortao: boolean): Promise<string> {
  const linhas = (await banco
    .db()
    .sql()
    .query(
      `insert into automations
         (account_id, name, active, triggers, keywords, match_type, steps, ligacoes, entrega_sem_portao)
       values ($1, $2, false, '{dm}'::text[], '{oi}'::text[], 'contains',
               $3::text::jsonb, $4::text::jsonb, $5)
       returning id`,
      [CONTA, nome, JSON.stringify(PASSOS), JSON.stringify(LIGACOES), entregaSemPortao]
    )) as { id: string }[];
  return linhas[0].id;
}

/**
 * O QUE FICOU GRAVADO NO LUGAR DA PALAVRA-CHAVE — as três colunas que a lista de
 * automações e o cartão do gatilho leem para se descrever. É por elas que se vê
 * se a porta gravou o dado INERTE (`contains` com a lista vazia) ou o atalho
 * `"any"`, que poria "casa com qualquer mensagem" numa automação que não casa
 * com mensagem nenhuma.
 */
async function configuracaoNoBanco(
  id: string
): Promise<{ triggers: string[]; match_type: string; keywords: string[] }> {
  const linhas = (await banco
    .db()
    .sql()
    .query(`select triggers, match_type, keywords from automations where id = $1`, [id])) as {
    triggers: string[];
    match_type: string;
    keywords: string[];
  }[];
  return linhas[0];
}

/** A PROVA FINAL: a coluna que o motor lê, e não o objeto que a porta devolveu. */
async function ativaNoBanco(id: string): Promise<boolean> {
  const linhas = (await banco
    .db()
    .sql()
    .query(`select active from automations where id = $1`, [id])) as { active: boolean }[];
  return linhas[0].active;
}

describe("as duas portas de publicar, com o contexto de requisição semeado", () => {
  test("a conta chega às portas sem cookie nenhum, pelo tombo declarado", async () => {
    const { valor } = await comoNumaRequisicao("/automacoes", async () => {
      const conta = await import("@/lib/account");
      return conta.getSelectedAccountId();
    });
    expect(valor).toBe(CONTA);
  });

  // --------------------------------------------------------------------------
  // DEFEITO 2 — `toggleAutomation` tratando toda automação como se a chave
  // `entrega_sem_portao` estivesse LIGADA (`actions.ts`, quarto argumento de
  // `conferirLista`).
  //
  // Os dois casos abaixo são o par: MESMA lista de blocos, MESMAS ligações,
  // MESMO gatilho. A única diferença é a coluna. Se a porta parar de lê-la, o
  // primeiro fica vermelho e o segundo continua verde — que é exatamente a
  // assimetria que nomeia o defeito.
  // --------------------------------------------------------------------------
  test("ATIVAR recusa o link contornável quando a chave está DESLIGADA", async () => {
    const id = await semear("chave desligada", false);
    const { valor, tags } = await comoNumaRequisicao("/automacoes", () =>
      acoes.toggleAutomation(id, true)
    );
    expect(valor.ok).toBe(false);
    expect((valor as { erro: string }).erro).toMatch(FRASE_DO_PORTAO);
    expect(await ativaNoBanco(id)).toBe(false);
    // Recusou ANTES de revalidar: a porta nem chegou ao `update`.
    expect(tags).toEqual([]);
  });

  test("ATIVAR aceita a MESMA lista quando a chave está LIGADA", async () => {
    const id = await semear("chave ligada", true);
    const { valor, tags } = await comoNumaRequisicao("/automacoes", () =>
      acoes.toggleAutomation(id, true)
    );
    expect(valor.ok).toBe(true);
    expect(await ativaNoBanco(id)).toBe(true);
    expect(JSON.stringify(tags)).toContain("/automacoes");
  });

  // --------------------------------------------------------------------------
  // DEFEITO 1 — a troca de qual porta recusa o quê.
  //
  // Os dois casos abaixo usam a MESMA lista que o ATIVAR recusa acima. É essa
  // repetição que faz a divisão entre as portas ser o objeto da medida: a mesma
  // entrada tem de ser ACEITA por uma porta e RECUSADA pela outra.
  // --------------------------------------------------------------------------
  test("SALVAR não trava por erro de ATIVAR: grava e devolve ok", async () => {
    const id = await semear("salvar com erro de ativar", false);
    const { valor } = await comoNumaRequisicao("/automacoes", () =>
      acoes.salvarAutomacao(id, PASSOS, LIGACOES, {
        nome: "salvo pela metade",
        ativo: false,
        gatilho: "dm",
        correspondencia: "contains",
        palavras: ["oi"],
        entregaSemPortao: false,
      })
    );
    // Guardar o meio do trabalho é trabalho normal: recusar isto deixaria o dono
    // sem onde pôr um desenho que ele volta a montar amanhã.
    expect(valor.ok).toBe(true);
    expect(await ativaNoBanco(id)).toBe(false);
  });

  test("SALVAR com a caixa Ativa marcada grava PAUSADA e diz por quê", async () => {
    const id = await semear("salvar marcando ativa", false);
    const { valor } = await comoNumaRequisicao("/automacoes", () =>
      acoes.salvarAutomacao(id, PASSOS, LIGACOES, {
        nome: "queria publicar",
        ativo: true,
        gatilho: "dm",
        correspondencia: "contains",
        palavras: ["oi"],
        entregaSemPortao: false,
      })
    );
    // Grava, mas PAUSADA — e com a mesma frase que o botão "Ativar" mostraria.
    expect(valor.ok).toBe(true);
    expect((valor as { pausada?: string }).pausada).toMatch(FRASE_DO_PORTAO);
    expect((valor as { ativoGravado?: boolean }).ativoGravado).toBe(false);
    expect(await ativaNoBanco(id)).toBe(false);
  });

  // --------------------------------------------------------------------------
  // O ACHADO DA REVISÃO DA TAREFA 2 (fase "portas de entrada"): `GATILHOS`, em
  // `actions.ts`, é ALLOW-LIST — o oposto de `conferirLista` (lib/steps.ts), que
  // é deny-list e por isso já aceitava "abertura" sem mudança nenhuma (medido em
  // tests/steps.test.ts, describe "o gatilho abertura"). `GATILHOS` roda ANTES
  // daquela conferência, então sem "abertura" nela `salvarAutomacao` recusa com
  // "Escolha o gatilho da automação." antes mesmo de perguntar a `conferirLista`
  // qualquer coisa — nenhum teste puro enxerga essa porta, porque ela mora num
  // arquivo `"use server"`.
  //
  // POR QUE ISTO TEM DE SER INTEGRAÇÃO, E NÃO PURO: `GATILHOS` é uma constante
  // de módulo dentro de `app/automacoes/actions.ts`, que não é importável pelos
  // testes puros (o arquivo tem `"use server"`, e não exporta a lista). Não há
  // função pura por trás dela para isolar — a única forma de medir se o valor
  // novo é aceito é chamar a porta de verdade, como as demais deste arquivo.
  // --------------------------------------------------------------------------
  test("SALVAR aceita o gatilho abertura com o payload que o PAINEL manda", async () => {
    const id = await semear("gatilho abertura", false);
    const { valor } = await comoNumaRequisicao("/automacoes", () =>
      acoes.salvarAutomacao(id, [{ id: "b_abert01", tipo: "dm", texto: "Que bom te ver!" }], [], {
        nome: "porta de entrada",
        ativo: false,
        gatilho: "abertura",
        // ESTE PAR DE LINHAS É O CASO INTEIRO, e ele já esteve errado aqui.
        //
        // Este caso mandava `correspondencia: "any"` — o ATALHO que a tarefa
        // recusou por escrito, porque gravaria "casa com qualquer mensagem" no
        // banco de uma automação que não casa com mensagem nenhuma. Com "any" a
        // guarda de palavra-chave nem chega a ser alcançada
        // (`correspondencia !== "any"` é falso), então este caso passava com as
        // duas guardas revertidas: medido, os 54 de integração e os 721 puros
        // continuavam verdes com o defeito plantado.
        //
        // O que o painel manda de verdade é isto. Ele ESCONDE o par de campos
        // no gatilho de abertura (`gatilhoPedePalavraChave`, @/lib/steps), então
        // o pedido sai com a correspondência padrão e a lista vazia — e era
        // exatamente esse payload que a linha original recusava, com "Informe as
        // palavras-chave" sobre um campo que a tela não mostra.
        correspondencia: "contains",
        palavras: [],
        entregaSemPortao: false,
      })
    );
    expect(valor.ok).toBe(true);

    // E O DADO QUE FICOU NO BANCO É O INERTE, e não o "any" que passaria pela
    // porta mentindo: `list-client.tsx` e o cartão do gatilho leem `match_type`
    // para se descrever. A correção mudou a PERGUNTA, não o dado, e sem estas
    // três linhas gravar "any" às escondidas continuaria verde aqui.
    const linha = await configuracaoNoBanco(id);
    expect(linha.triggers).toEqual(["abertura"]);
    expect(linha.match_type).toBe("contains");
    expect(linha.keywords).toEqual([]);
  });

  // --------------------------------------------------------------------------
  // A MESMA GUARDA, DO OUTRO LADO — `criarAutomacao`.
  //
  // A pergunta de palavra-chave por gatilho está escrita DUAS VEZES em
  // `actions.ts`, uma em cada porta. Quem "simplificar" uma tende a simplificar
  // a outra no mesmo gesto, e a de criar é a PRIMEIRA que o dono atravessa: sem
  // ela a automação de abertura nem chega a existir para o painel salvar.
  // Nenhum outro teste deste projeto chama esta função.
  //
  // O PEDIDO É O DO FORMULÁRIO DE `/nova`, campo por campo. Lá o campo de
  // palavras-chave e o `select` de correspondência DESMONTAM no gatilho de
  // abertura (`form-nova.tsx`), então nem `keywords` nem `match_type` são
  // enviados — o servidor cai no padrão `"contains"` com a lista vazia, que é o
  // par que a linha original recusava.
  //
  // O FIM DELA É UM `redirect`, e em Server Action isso é uma EXCEÇÃO de
  // controle de fluxo: chegar até ela é a prova de que a porta deixou passar. A
  // recusa não lança nada — devolve a frase de erro —, então é o `digest`
  // ausente que fica vermelho no dia em que a guarda voltar.
  // --------------------------------------------------------------------------
  test("CRIAR aceita o gatilho abertura com o pedido que o formulario de /nova manda", async () => {
    const form = new FormData();
    form.set("name", "porta de entrada recem-criada");
    form.set("trigger", "abertura");

    const { valor } = await comoNumaRequisicao("/automacoes/nova", async () => {
      try {
        const erro = await acoes.criarAutomacao(null, form);
        return { erro, digest: null as string | null };
      } catch (e) {
        // `redirect` marca a exceção no `digest`, e afirmar o formato dele é de
        // propósito: o dia em que o Next mudar essa marca, este caso fica
        // VERMELHO em vez de passar a não medir nada.
        return { erro: null, digest: (e as { digest?: string }).digest ?? null };
      }
    });

    expect(valor.erro).toBe(null);
    expect(valor.digest ?? "").toMatch(/^NEXT_REDIRECT/);

    // A LINHA EXISTE E O DADO É O INERTE — a mesma prova do caso de salvar, pelo
    // mesmo motivo. O id sai do destino do redirecionamento, que é o único lugar
    // onde a função o publica.
    const id = (valor.digest ?? "").match(/\/automacoes\/([0-9a-fA-F-]+)/)?.[1];
    expect(id).toBeTruthy();
    const linha = await configuracaoNoBanco(id!);
    expect(linha.triggers).toEqual(["abertura"]);
    expect(linha.match_type).toBe("contains");
    expect(linha.keywords).toEqual([]);
  });
});
