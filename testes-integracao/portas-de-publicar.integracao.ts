// O QUINTO CAMINHO DA FRENTE 2: as duas PORTAS que decidem se um desenho pode
// ser publicado — `salvarAutomacao` e `toggleAutomation`, de
// `app/automacoes/actions.ts`, rodadas de verdade contra o schema descartável.
//
// O NOME é o que as duas fazem juntas. Elas não são "as ações da automação"
// (`criarAutomacao`, `deleteAutomation` e `duplicateAutomation` também são, e
// não estão aqui): são as duas únicas que respondem à pergunta "isto pode ir ao
// ar?", cada uma de um lado, e é a DIVISÃO ENTRE AS DUAS que este arquivo mede.
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
});
