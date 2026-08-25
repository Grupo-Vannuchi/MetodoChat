// O TERCEIRO CAMINHO DA FRENTE 2: o toque e o braço.
//
// A PROMESSA, escrita como teste: **o payload de quatro partes leva ao destino
// DAQUELE botão — não ao do outro botão, não ao `senao` — e quem DIGITA em vez
// de tocar vai pelo `senao`.**
//
// Ela é provada com o motor de verdade (`handleMessagingEvent`, lib/engine.ts)
// contra um banco de verdade (o schema descartável de `harness.ts`), e a prova é
// feita OLHANDO A FILA e O CURSOR — o que foi enfileirado para a pessoa e onde
// ela ficou —, e não o que uma função devolveu.
//
// -----------------------------------------------------------------------------
// ESTE CAMINHO NÃO NASCEU PARA MATAR ITEM DE LISTA, E ISSO PRECISA ESTAR DITO
//
// Os dois primeiros caminhos nasceram contra defeitos conhecidos que sobreviviam
// a tudo. Este não: dos oito sobreviventes daquela medição, cinco já morreram, e
// os três que restam não são alcançáveis daqui — dois vivem em
// `app/automacoes/actions.ts`, que este arquivo não importa, e um num componente
// de tela.
//
// Então o valor dele é OUTRO, e só se prova de um jeito: plantando defeitos
// plausíveis nos arquivos que este caminho de fato executa (`lib/engine.ts`,
// `lib/steps.ts`) e medindo se ele acusa. A tabela dessas medições está no
// relatório da tarefa (`scratchpad/frente2-toque-e-gatilho.md`) e no plano da
// Frente 2. O que este cabeçalho registra é a regra: **um caso que não morre com
// nenhum plantio não tem dentes, e é melhor saber disso do que tê-lo verde.**
//
// -----------------------------------------------------------------------------
// O CENÁRIO É MONTADO COMO A PRODUÇÃO MONTA, E CONFERIDO PELO QUE SAIU
//
// A armadilha que já custou caro nesta base é o teste que monta o cenário com as
// MESMAS funções que ele testa — ele concorda consigo mesmo. Aqui:
//
//   MONTAR é gravar em `automations` o `steps` e as `ligacoes` que o editor
//     gravaria, por `insert` cru. Nenhuma função de decisão participa.
//   TOCAR é devolver ao motor o payload QUE O MOTOR ESCREVEU NA FILA, achado
//     pelo RÓTULO do botão — que é exatamente o que a Meta faz quando a pessoa
//     toca no botão que mostra aquele rótulo. Nenhuma string é montada à mão.
//   CONFERIR é ler a fila (`queue.payload.text`), o cursor (`contacts.
//     flow_step_id`) e a Atividade (`events`). Nunca perguntar de novo à função
//     que decidiu.
//
// -----------------------------------------------------------------------------
// AS TRÊS FORMAS DE PAYLOAD CONVIVEM PARA SEMPRE, e o caso 3 depende disso
//
// `AUTO:<automação>`, `AUTO:<automação>:<bloco>` e
// `AUTO:<automação>:<bloco>:<botão>` são finais — um botão entregue vive na
// conversa da pessoa indefinidamente e continua tocável. É por isso que o caso
// "o botão ANTIGO continua levando ao braço dele" não é curiosidade: é o
// comportamento que o produto promete, e é o que separa a forma de quatro partes
// das outras duas — ela NÃO passa pelo cursor.
//
// -----------------------------------------------------------------------------
// NADA DE MOCK, E NADA SAI DA MÁQUINA
//
// Não há `vi.mock`, não há `vi.stubGlobal`, não há banco de mentira. O motor
// consulta o perfil de quem manda a primeira DM (`getUserProfile`), e essa
// consulta é HTTP de verdade — para um servidor desta máquina, pelo mesmo
// mecanismo dos dois primeiros caminhos: `IG_GRAPH_BASE` + `baseDoGraph()`
// (lib/ig.ts), com as duas travas dele. A guarda que falha ANTES de qualquer
// requisição sair está no `beforeAll`, herdada dali.
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { bancoDescartavel } from "./harness";
// `lib/steps.ts` não tem import nenhum e não fala com o banco: pode ser
// importado no topo. Os módulos que tocam o banco (ou a rede) são importados
// dentro do `beforeAll`, depois de a DATABASE_URL estar pronta.
//
// `lerPayload` entra aqui como LEITORA, e nunca como escritora: ela é usada para
// afirmar o que o payload que o motor gravou carrega dentro. Quem escreve os
// payloads deste arquivo é o motor, e nada mais.
import { lerPayload } from "@/lib/steps";

type ModuloEngine = typeof import("@/lib/engine");
type ModuloIg = typeof import("@/lib/ig");

const banco = bancoDescartavel();

const CONTA = "17800000000000789";
// Valor inventado. Nenhuma credencial de verdade entra em teste.
const TOKEN = "token-de-teste-que-nao-vale-nada";

// ---------------------------------------------------------------------------
// A META FALSA — a outra ponta do fio, e nada além disso.
//
// Este caminho não envia mensagem: ele mede a FILA, que é onde o motor para.
// O único pedido que sai é o perfil de quem mandou a primeira DM. Qualquer
// outro caminho volta 404, para que uma pergunta nova apareça na lista em vez
// de receber resposta inventada.
// ---------------------------------------------------------------------------

const meta = { desconhecidos: [] as string[] };

let servidor: Server;
let engine: ModuloEngine;
let ig: ModuloIg;

beforeAll(async () => {
  servidor = createServer((req, res) => {
    const u = new URL(req.url ?? "/", "http://127.0.0.1");
    const campos = u.searchParams.get("fields") ?? "";
    if (campos.includes("username")) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ username: "pessoa_de_teste", name: "Pessoa de teste" }));
      return;
    }
    meta.desconhecidos.push(`${req.method} ${u.pathname}?${u.searchParams.toString()}`);
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: { message: `a Meta falsa não conhece ${u.pathname}` } }));
  });

  await new Promise<void>((pronto) => servidor.listen(0, "127.0.0.1", pronto));
  const porta = (servidor.address() as AddressInfo).port;
  process.env.IG_GRAPH_BASE = `http://127.0.0.1:${porta}`;

  engine = await import("@/lib/engine");
  ig = await import("@/lib/ig");

  // FALHA ANTES DE QUALQUER REQUISIÇÃO, e não depois — a mesma guarda dos dois
  // primeiros caminhos, pela mesma razão. Sem o desvio, o `getUserProfile` deste
  // teste sairia para `graph.instagram.com` com um token inventado.
  if (ig.baseDoGraph() !== process.env.IG_GRAPH_BASE) {
    throw new Error(
      `RECUSADO: a base do Graph é ${ig.baseDoGraph()}, e tinha de ser a desta ` +
        `rodada (${process.env.IG_GRAPH_BASE}). Sem o desvio, este teste falaria ` +
        `com a Meta de verdade.`
    );
  }

  await banco.db().upsertAccount({
    ig_user_id: CONTA,
    username: "conta_do_toque",
    name: "Conta do toque",
    profile_picture_url: null,
    access_token: TOKEN,
    token_expires_at: null,
  });
});

afterAll(async () => {
  delete process.env.IG_GRAPH_BASE;
  await new Promise<void>((pronto) => servidor.close(() => pronto()));
});

// ---------------------------------------------------------------------------
// Semear e ler. Nada aqui decide nada: as decisões são todas do motor.
// ---------------------------------------------------------------------------

// `$n::text::jsonb`, e nunca `$n::jsonb` sobre string — a segunda forma grava um
// ESCALAR JSON e o motor registra `step_ignorado`. (O porquê inteiro está no
// primeiro caminho.)
async function semear(
  nome: string,
  palavra: string,
  steps: unknown[],
  ligacoes: unknown[]
): Promise<string> {
  const linhas = (await banco
    .db()
    .sql()
    .query(
      `insert into automations
         (account_id, name, active, triggers, keywords, match_type, steps, ligacoes)
       values ($1, $2, true, '{dm}'::text[], string_to_array($3, ','), 'contains',
               $4::text::jsonb, $5::text::jsonb)
       returning id`,
      [CONTA, nome, palavra, JSON.stringify(steps), JSON.stringify(ligacoes)]
    )) as { id: string }[];
  return linhas[0].id;
}

type LinhaDaFila = {
  kind: string;
  payload: {
    text?: string;
    quick_reply_labels?: string[];
    quick_reply_payloads?: string[];
  };
};

async function fila(contatoIgId: string): Promise<LinhaDaFila[]> {
  return (await banco
    .db()
    .sql()
    .query(
      `select kind, payload from queue
        where account_id = $1 and contact_ig_id = $2
        order by created_at asc, id asc`,
      [CONTA, contatoIgId]
    )) as LinhaDaFila[];
}

// O que a pessoa RECEBEU, na ordem — é a lista que cada caso afirma.
async function textos(contatoIgId: string): Promise<string[]> {
  return (await fila(contatoIgId)).map((l) => l.payload.text ?? "");
}

// Onde a pessoa ficou, lido da coluna e não de `lerCursor`: a pergunta é "o que
// está gravado no banco", e quem responde é o banco.
async function cursor(contatoIgId: string): Promise<string | null> {
  const linhas = (await banco
    .db()
    .sql()
    .query(`select flow_step_id from contacts where account_id = $1 and ig_id = $2`, [
      CONTA,
      contatoIgId,
    ])) as { flow_step_id: string | null }[];
  return linhas[0]?.flow_step_id ?? null;
}

async function eventos(tipo: string): Promise<Record<string, unknown>[]> {
  const linhas = (await banco
    .db()
    .sql()
    .query(
      `select payload from events where account_id = $1 and type = $2 order by created_at asc`,
      [CONTA, tipo]
    )) as { payload: Record<string, unknown> }[];
  return linhas.map((l) => l.payload);
}

// Uma mensagem de texto chegando pelo webhook, como a Meta a entrega.
async function mensagem(igId: string, texto: string, mid: string) {
  await engine.handleMessagingEvent(CONTA, { sender: { id: igId }, message: { mid, text: texto } });
}

// Um toque em botão de resposta rápida, como a Meta o entrega.
async function toque(igId: string, payload: string, mid: string) {
  await engine.handleMessagingEvent(CONTA, {
    sender: { id: igId },
    message: { mid, text: "", quick_reply: { payload } },
  });
}

// O PAYLOAD DO BOTÃO QUE MOSTRA ESTE RÓTULO, achado na fila.
//
// É a peça que impede este teste de concordar consigo mesmo. A pessoa não
// escolhe um payload: ela vê rótulos e toca num deles, e a Meta devolve o
// payload que estava pareado com aquele rótulo. Aqui é a mesma coisa — o rótulo
// é procurado em `quick_reply_labels`, e o payload sai do MESMO índice em
// `quick_reply_payloads`, que é a correspondência que o motor gravou.
//
// Falha alto quando o rótulo não está lá, em vez de devolver `undefined` e
// deixar o caso morrer três linhas adiante por outro motivo.
async function payloadDoRotulo(igId: string, rotulo: string): Promise<string> {
  for (const linha of await fila(igId)) {
    const rotulos = linha.payload.quick_reply_labels ?? [];
    const payloads = linha.payload.quick_reply_payloads ?? [];
    const i = rotulos.indexOf(rotulo);
    if (i !== -1 && typeof payloads[i] === "string") return payloads[i];
  }
  throw new Error(`nenhum botão com o rótulo ${JSON.stringify(rotulo)} na fila de ${igId}`);
}

// ---------------------------------------------------------------------------

describe("o toque em botão leva ao braço daquele botão", () => {
  // O MENU DE DUAS OPÇÕES COM UM `senao`, que é a forma mais banal do quadro e a
  // que junta as duas metades da promessa deste caminho: dois braços de `botao`
  // e um de `senao`, saindo do MESMO bloco.
  //
  // A ORDEM DO ARRAY É DE PROPÓSITO DIFERENTE DA ORDEM DO GRAFO — o braço da
  // planilha vem ANTES do braço do guia na lista, e o `senao` vem antes dos
  // dois. Com a ordem alinhada, um motor que caminhasse pelo array passaria em
  // qualquer afirmação abaixo por coincidência.
  const MENU = {
    id: "b_menu001",
    tipo: "dm",
    texto: "Escolhe aí:",
    botoes: [
      { id: "op_guia01", rotulo: "Quero o guia" },
      { id: "op_plani2", rotulo: "Quero a planilha" },
    ],
  };
  const GUIA = "Aqui está o guia.";
  const PLANILHA = "Aqui está a planilha.";
  const SENAO = "Não entendi — toca num dos botões.";

  let AUTO = "";

  beforeAll(async () => {
    AUTO = await semear(
      "A · menu com dois braços e um senão",
      "quero-o-menu",
      [
        MENU,
        { id: "b_senao01", tipo: "dm", texto: SENAO },
        { id: "b_plani01", tipo: "dm", texto: PLANILHA },
        { id: "b_guia001", tipo: "dm", texto: GUIA },
      ],
      [
        { de: "b_menu001", quando: { tipo: "botao", botao: "op_guia01" }, para: "b_guia001" },
        { de: "b_menu001", quando: { tipo: "botao", botao: "op_plani2" }, para: "b_plani01" },
        { de: "b_menu001", quando: { tipo: "senao" }, para: "b_senao01" },
      ]
    );
  });

  test("CADA BOTÃO AO BRAÇO DELE: nem o do vizinho, nem o do `senao`", async () => {
    // Duas pessoas, o MESMO menu, botões DIFERENTES. Uma pessoa só não provaria
    // nada: um motor que mandasse todo mundo para o primeiro braço passaria.
    const DA_PLANILHA = "9200000000000001";
    const DO_GUIA = "9200000000000002";

    await mensagem(DA_PLANILHA, "quero-o-menu", "m-toque-1");
    await mensagem(DO_GUIA, "quero-o-menu", "m-toque-2");

    // A caminhada PARA no menu — ele espera um toque —, então até aqui as duas
    // receberam só ele, e o cursor de cada uma está nele.
    expect(await textos(DA_PLANILHA)).toEqual(["Escolhe aí:"]);
    expect(await textos(DO_GUIA)).toEqual(["Escolhe aí:"]);
    expect(await cursor(DA_PLANILHA)).toBe("b_menu001");

    // O PAYLOAD VEM DA FILA, achado pelo RÓTULO — é o que a Meta devolveria.
    const daPlanilha = await payloadDoRotulo(DA_PLANILHA, "Quero a planilha");
    const doGuia = await payloadDoRotulo(DO_GUIA, "Quero o guia");

    // QUATRO PARTES, e cada parte com o que o rótulo prometia. `lerPayload` aqui
    // é leitora: quem escreveu foi o motor.
    expect(lerPayload(daPlanilha)).toEqual({
      prefixo: "AUTO",
      automationId: AUTO,
      passoId: "b_menu001",
      botaoId: "op_plani2",
    });
    expect(lerPayload(doGuia)).toEqual({
      prefixo: "AUTO",
      automationId: AUTO,
      passoId: "b_menu001",
      botaoId: "op_guia01",
    });
    // Os dois botões do mesmo menu não podem ter o mesmo payload — sem esta
    // linha, um motor que emitisse o mesmo payload duas vezes passaria nas
    // afirmações de baixo pela metade certa.
    expect(daPlanilha).not.toBe(doGuia);

    // O TOQUE, e o que sai dele.
    await toque(DA_PLANILHA, daPlanilha, "m-toque-3");
    await toque(DO_GUIA, doGuia, "m-toque-4");

    // CADA UMA NO BRAÇO DELA. A lista inteira é afirmada, e não só "contém":
    // é ela que diz que o braço do vizinho NÃO chegou junto.
    expect(await textos(DA_PLANILHA)).toEqual(["Escolhe aí:", PLANILHA]);
    expect(await textos(DO_GUIA)).toEqual(["Escolhe aí:", GUIA]);

    // E O `senao` NÃO SAIU PARA NENHUMA DAS DUAS. Ele existe no grafo, sai do
    // MESMO bloco, e é o destino errado mais provável de um toque: um motor que
    // não achasse a ligação do botão e "caísse" no `senao` passaria em tudo
    // acima se o `senao` não fosse afirmado ausente.
    expect(await textos(DA_PLANILHA)).not.toContain(SENAO);
    expect(await textos(DO_GUIA)).not.toContain(SENAO);

    // Os braços não param nada, então a lista acabou e o cursor foi limpo.
    expect(await cursor(DA_PLANILHA)).toBe(null);
    expect(await cursor(DO_GUIA)).toBe(null);

    expect(meta.desconhecidos).toEqual([]);
  });

  test("QUEM DIGITA em vez de tocar vai pelo `senao` — e não pelos braços", async () => {
    const QUE_DIGITA = "9200000000000003";
    await mensagem(QUE_DIGITA, "quero-o-menu", "m-texto-1");
    expect(await textos(QUE_DIGITA)).toEqual(["Escolhe aí:"]);
    expect(await cursor(QUE_DIGITA)).toBe("b_menu001");

    // Texto solto, e de propósito um texto que MENCIONA uma das opções: se o
    // motor casasse botão por RÓTULO em vez de por id, esta mensagem viraria o
    // braço da planilha. Ela não é palavra-chave de automação nenhuma, então
    // `interrompeOFluxo` não cede a vez e este é mesmo o ramo de texto.
    await mensagem(QUE_DIGITA, "eu queria a planilha, como faz?", "m-texto-2");

    expect(await textos(QUE_DIGITA)).toEqual(["Escolhe aí:", SENAO]);
    // Nem o braço do guia, nem o da planilha.
    expect(await textos(QUE_DIGITA)).not.toContain(GUIA);
    expect(await textos(QUE_DIGITA)).not.toContain(PLANILHA);
  });

  test("BOTÃO ANTIGO: a pessoa já avançou, e o toque continua indo ao braço DELE", async () => {
    // A forma de quatro partes NÃO passa pelo cursor, e é isso que este caso
    // mede — a diferença entre ela e as duas formas antigas, em que o cursor
    // manda. Um botão entregue vive na conversa da pessoa indefinidamente: ela
    // toca no menu de ontem depois de já ter andado, e o que tem de acontecer é
    // o braço DAQUELE botão.
    //
    // O grafo tem DOIS menus em série, e o segundo é o que segura o cursor
    // depois do primeiro toque:
    //
    //   MENU 1 --op_seg001--> MENU 2 --op_fim002--> fim do segundo
    //   MENU 1 --op_lad001--> lado do primeiro
    const AUTO2 = await semear(
      "B · dois menus em série",
      "quero-a-serie",
      [
        {
          id: "b_umenu01",
          tipo: "dm",
          texto: "Primeiro menu:",
          botoes: [
            { id: "op_seg001", rotulo: "Ir para o segundo" },
            { id: "op_lad001", rotulo: "Ir para o lado" },
          ],
        },
        {
          id: "b_domenu2",
          tipo: "dm",
          texto: "Segundo menu:",
          botoes: [{ id: "op_fim002", rotulo: "Terminar aqui" }],
        },
        { id: "b_lado001", tipo: "dm", texto: "Braço lateral do PRIMEIRO menu." },
        { id: "b_fim0002", tipo: "dm", texto: "Fim do SEGUNDO menu." },
      ],
      [
        { de: "b_umenu01", quando: { tipo: "botao", botao: "op_seg001" }, para: "b_domenu2" },
        { de: "b_umenu01", quando: { tipo: "botao", botao: "op_lad001" }, para: "b_lado001" },
        { de: "b_domenu2", quando: { tipo: "botao", botao: "op_fim002" }, para: "b_fim0002" },
      ]
    );
    expect(AUTO2).not.toBe(AUTO);

    const EU = "9200000000000004";
    await mensagem(EU, "quero-a-serie", "m-antigo-1");
    const paraOSegundo = await payloadDoRotulo(EU, "Ir para o segundo");
    const paraOLado = await payloadDoRotulo(EU, "Ir para o lado");

    // Ela anda: toca em "Ir para o segundo" e para no SEGUNDO menu.
    await toque(EU, paraOSegundo, "m-antigo-2");
    expect(await textos(EU)).toEqual(["Primeiro menu:", "Segundo menu:"]);
    // O CURSOR MUDOU DE LUGAR, e é essa mudança que dá sentido ao resto do caso.
    expect(await cursor(EU)).toBe("b_domenu2");

    // AGORA O BOTÃO ANTIGO, o do PRIMEIRO menu, que continua na conversa dela.
    // O cursor aponta para o segundo menu, e o segundo menu não tem botão nenhum
    // com este id: um motor que resolvesse a ligação a partir do CURSOR não
    // acharia caminho e não entregaria nada.
    await toque(EU, paraOLado, "m-antigo-3");
    expect(await textos(EU)).toEqual([
      "Primeiro menu:",
      "Segundo menu:",
      "Braço lateral do PRIMEIRO menu.",
    ]);
    // E não é o braço do segundo menu que chegou.
    expect(await textos(EU)).not.toContain("Fim do SEGUNDO menu.");
  });

  test("BOTÃO SEM CAMINHO: nada é entregue, e a Atividade diz qual botão e por quê", async () => {
    // As DUAS formas de botão órfão, e elas se arrumam em lugares diferentes do
    // editor — por isso são dois motivos e não um. Cada uma numa automação
    // própria: `logEventThrottled` tem janela de 10 minutos discriminada por
    // `automation_id`, então as duas na mesma automação dariam UMA linha só, e o
    // caso passaria a medir o throttle em vez do registro.
    //
    // Nenhuma das duas é produzível pelo editor desde a Tarefa 5 — a conferência
    // recusa ATIVAR assim. O que chega aqui é ligação gravada fora do painel, ou
    // bloco apagado depois de o botão já ter saído, e é exatamente por isso que
    // o registro precisa existir: a pessoa toca, nada acontece, e sem a linha em
    // Atividade não há erro em lugar nenhum para quem for procurar.
    //
    // A PRIMEIRA TEM UM `senao`, e ele não é enfeite: é o destino errado mais
    // provável de um botão órfão. `ligacaoEscolhida` recusa mandar botão sem
    // ligação para a `senao` de propósito — a `senao` é de quem DIGITOU —, e sem
    // um `senao` no grafo essa recusa não seria observável aqui.
    const SEM_LIGACAO = await semear(
      "C · botão sem ligação de saída",
      "quero-o-orfao",
      [
        {
          id: "b_orfao01",
          tipo: "dm",
          texto: "Menu órfão:",
          botoes: [{ id: "op_orfa01", rotulo: "Não vai a lugar nenhum" }],
        },
        { id: "b_orfsen1", tipo: "dm", texto: "Isto é para quem DIGITOU." },
      ],
      [{ de: "b_orfao01", quando: { tipo: "senao" }, para: "b_orfsen1" }]
    );
    const DESTINO_SUMIDO = await semear(
      "D · botão que leva a bloco apagado",
      "quero-o-sumido",
      [
        {
          id: "b_sumid01",
          tipo: "dm",
          texto: "Menu apontando para o vazio:",
          botoes: [{ id: "op_sumi01", rotulo: "Leva a um bloco apagado" }],
        },
      ],
      // A seta ficou; o bloco `b_apagad1` não está na lista.
      [{ de: "b_sumid01", quando: { tipo: "botao", botao: "op_sumi01" }, para: "b_apagad1" }]
    );

    const SEM = "9200000000000005";
    const SUMIU = "9200000000000006";
    await mensagem(SEM, "quero-o-orfao", "m-orfao-1");
    await mensagem(SUMIU, "quero-o-sumido", "m-orfao-2");

    const pSem = await payloadDoRotulo(SEM, "Não vai a lugar nenhum");
    const pSumiu = await payloadDoRotulo(SUMIU, "Leva a um bloco apagado");

    await toque(SEM, pSem, "m-orfao-3");
    await toque(SUMIU, pSumiu, "m-orfao-4");

    // NADA NOVO NA FILA. Só o menu que já estava lá — o toque não entregou coisa
    // nenhuma, que é o certo: não há braço para onde ir.
    expect(await textos(SEM)).toEqual(["Menu órfão:"]);
    expect(await textos(SUMIU)).toEqual(["Menu apontando para o vazio:"]);

    // E NÃO FOI CALADO. Duas linhas em Atividade, uma por automação, cada uma
    // dizendo o bloco, o botão e QUAL das duas coisas aconteceu.
    const linhas = await eventos("botao_sem_caminho");
    const doSem = linhas.find((l) => l.automation_id === SEM_LIGACAO);
    const doSumiu = linhas.find((l) => l.automation_id === DESTINO_SUMIDO);

    expect(doSem).toBeDefined();
    expect(doSem!.bloco).toBe("b_orfao01");
    expect(doSem!.botao).toBe("op_orfa01");
    expect(doSem!.contact_ig_id).toBe(SEM);
    expect(String(doSem!.motivo)).toContain("não tem ligação de saída");

    expect(doSumiu).toBeDefined();
    expect(doSumiu!.bloco).toBe("b_sumid01");
    expect(doSumiu!.botao).toBe("op_sumi01");
    // O outro motivo, e ele nomeia o bloco que sumiu — é por ele que o dono
    // descobre o que apagou.
    expect(String(doSumiu!.motivo)).toContain("b_apagad1");

    // O CURSOR NÃO SE MEXEU. A pessoa continua parada no menu, e não foi
    // rebobinada nem solta por um toque que não tinha para onde ir.
    expect(await cursor(SEM)).toBe("b_orfao01");
    expect(await cursor(SUMIU)).toBe("b_sumid01");
  });
});
