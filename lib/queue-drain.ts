import "server-only";
import { sql, ensureSchema, listAccounts, getConfig, QueueItem } from "./db";
import { windowState } from "./inbox-window";
import { scheduleTick } from "./qstash";
import {
  sendMessage,
  replyToComment,
  linkMessage,
  sendReaction,
  IgError,
  OutgoingMessage,
} from "./ig";
import { renderVariables, type VariableContext } from "./variables";
// Só para registrar em Atividade o que este arquivo tira da mensagem — o corte
// além do limite da Meta e o botão sem rótulo (ver `botoesDaMensagem`, abaixo).
// Não há import na direção oposta — lib/engine.ts não importa deste arquivo —
// então não há ciclo.
//
// A REVISÃO SUGERIU MUDAR `logEvent`/`logEventThrottled` DE CASA (para
// `lib/db.ts` ou um `lib/activity.ts` novo), e a sugestão está certa no mérito:
// elas não têm nada de motor, e este import traz um `server-only` grande para o
// grafo do dreno. A decisão é NÃO FAZER AGORA — o custo, a contagem de
// chamadas e o que o movimento compra estão escritos JUNTO DA DEFINIÇÃO, em
// lib/engine.ts, que é por onde quem for mover começa. Esta nota já morou só
// aqui, no importador, que é o último lugar em que alguém olharia.
import { logEventThrottled } from "./engine";
import { botoesDaMensagem, LIMITE_DE_BOTOES } from "./steps";

// ============================================================
// Envio: drena a fila respeitando limites da Meta
// ============================================================

const HOURLY_CAP = 190; // margem sobre o limite prático de ~200/h, POR CONTA
const BATCH_SIZE = 15;
const GAP_MS = 600; // ~1,6 envios/segundo

// O LIMITE DA META (13) E O CORTE SAÍRAM DAQUI, e viraram `LIMITE_DE_BOTOES` e
// `botoesDaMensagem` em lib/steps.ts. O motivo é o achado principal da revisão
// da Tarefa 4: este arquivo é `server-only` e NENHUM teste da suíte o executa,
// então o pareamento rótulo↔payload e o corte eram regra viva que nada podia
// medir — plantar os rótulos ao contrário aqui deixava 485/485 verdes.
//
// A DEFESA CONTINUA SENDO NO DRENO, e não só na conferência do editor (Tarefa
// 5): a coluna `payload` é `jsonb` e pode ser editada por fora do painel. O que
// mudou é onde a regra está escrita, não onde ela roda.

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function windowOpen(accountId: string, contactIgId: string | null): Promise<boolean> {
  if (!contactIgId) return false;
  const rows = (await sql().query(
    `select last_reply_at from contacts where account_id = $1 and ig_id = $2`,
    [accountId, contactIgId]
  )) as { last_reply_at: Date | null }[];
  return windowState(rows[0]?.last_reply_at ?? null).open;
}

async function finish(
  id: string,
  fields: {
    status: string;
    sent_at?: Date;
    // Segundos a partir de agora, contados pelo BANCO — mesmo motivo do enqueue:
    // misturar o relógio da aplicação com o do banco atrasa o item pela diferença.
    retryInSeconds?: number;
    error?: string;
    message_id?: string | null;
    // O texto COM as variáveis já resolvidas, exatamente como foi entregue.
    sentText?: string;
  }
) {
  await sql().query(
    `update queue set
       status = $2,
       sent_at = coalesce($3, sent_at),
       not_before = case when $4::int is null then not_before
                          else now() + make_interval(secs => $4::int) end,
       error = coalesce($5, error),
       message_id = coalesce($6, message_id),
       -- Guarda o texto entregue AO LADO do template, sem substituí-lo. A fila é
       -- a única memória do que saiu: a Meta não devolve eco de mensagem enviada
       -- pela API, então sem isto o inbox mostra "ola {name}" para sempre — um
       -- texto que nunca chegou a ninguém. Manter o template junto ajuda a
       -- depurar automação depois.
       payload = case
         when $7::text is null then payload
         else jsonb_set(payload, '{sent_text}', to_jsonb($7::text))
       end
     where id = $1`,
    [
      id,
      fields.status,
      fields.sent_at?.toISOString() ?? null,
      fields.retryInSeconds ?? null,
      fields.error ?? null,
      fields.message_id ?? null,
      fields.sentText ?? null,
    ]
  );
}

// Dados de quem vai receber a mensagem, para resolver as variáveis
// ({{first_name}} e afins). Uma consulta só, no momento do envio — assim vale
// para toda automação, inclusive as criadas antes deste recurso existir.
async function variableContext(
  accountId: string,
  contactIgId: string | null | undefined
): Promise<VariableContext> {
  if (!contactIgId) return {};
  try {
    const rows = (await sql().query(
      `select username, name, email from contacts where account_id = $1 and ig_id = $2`,
      [accountId, contactIgId]
    )) as { username: string | null; name: string | null; email: string | null }[];
    return rows[0] ?? {};
  } catch {
    // sem contato salvo: as variáveis caem no fallback (ou somem)
    return {};
  }
}

type ItemOutcome = {
  outcome: "sent" | "skipped";
  messageId?: string | null;
  // Texto com as variáveis resolvidas, para o finish() registrar o que saiu.
  sentText?: string;
};

async function processItem(
  item: QueueItem,
  igUserId: string,
  token: string
): Promise<ItemOutcome> {
  const p = item.payload as {
    text?: string;
    quick_reply_label?: string;
    quick_reply_payload?: string;
    // A forma PLURAL, ao lado da singular — não no lugar dela. `lib/engine.ts`
    // (`enfileirarPasso`) só grava um par por item: os dois nunca convivem no
    // MESMO item, mas a coluna é `jsonb` e nada garante isso em runtime, então
    // este arquivo lê os dois pares independentemente. Itens enfileirados
    // antes desta tarefa só têm a forma singular, e continuam sendo lidos por
    // ela — é por isso que ela não sai daqui.
    // `unknown[]`, e não `string[]`: o `jsonb` não garante o tipo dos
    // elementos, e declará-los como texto faria o `tsc` apagar as guardas de
    // runtime como código morto. Quem os valida um a um é `botoesDaMensagem`
    // (lib/steps.ts).
    quick_reply_labels?: unknown[];
    quick_reply_payloads?: unknown[];
    button_label?: string;
    url?: string;
    message_id?: string;
    reaction?: string;
  };

  // Único ponto de saída de texto do sistema: resolver as variáveis aqui faz
  // TODA mensagem — atual ou futura — suportá-las, sem tocar em cada fluxo.
  const ctx = await variableContext(igUserId, item.contact_ig_id);
  const texto = renderVariables(p.text ?? "", ctx);
  const rotuloBotao = renderVariables(p.button_label ?? "", ctx);
  const rotuloResposta = renderVariables(p.quick_reply_label ?? "", ctx);

  if (item.kind === "comment_reply") {
    await replyToComment(item.comment_id!, token, texto);
    return { outcome: "sent", sentText: texto };
  }

  // Reação (coraçãozinho) na mensagem que a pessoa mandou
  if (item.kind === "story_reaction") {
    if (!p.message_id || !item.contact_ig_id) return { outcome: "skipped" };
    if (!(await windowOpen(igUserId, item.contact_ig_id))) return { outcome: "skipped" };
    await sendReaction(igUserId, token, item.contact_ig_id, p.message_id, p.reaction || "❤️");
    return { outcome: "sent" };
  }

  let recipient: { comment_id: string } | { id: string };
  if (item.kind === "private_reply") {
    // A resposta privada é endereçada ao COMENTÁRIO, não à pessoa, e é por isso
    // que ela não passa pela checagem de janela: a Meta permite uma por
    // comentário justamente para quem comentou e nunca mandou DM — ou seja,
    // quem nunca teve janela aberta. Sem este ramo, toda automação com gatilho
    // de comentário viraria `skipped`.
    recipient = { comment_id: item.comment_id! };
  } else {
    // DMs comuns só dentro da janela de 24h — regra da Meta
    if (!(await windowOpen(igUserId, item.contact_ig_id))) return { outcome: "skipped" };
    recipient = { id: item.contact_ig_id! };
  }

  let message: OutgoingMessage;
  // `p.url` entra na condição por causa da resposta privada: um passo `dm` com
  // url pode ser a PRIMEIRA mensagem de um fluxo disparado por comentário, e aí
  // ele é enfileirado como `private_reply` (é a única forma de chegar). Só pelo
  // tipo, ele cairia no `else` de texto puro e o link — o motivo de a automação
  // existir — sumiria da mensagem. Nenhum outro tipo grava url no payload, então
  // isto não muda o caminho de mais ninguém.
  if (item.kind === "dm_link" || item.kind === "dm_reminder" || p.url) {
    message = linkMessage(texto, rotuloBotao || "Abrir link", p.url ?? "");
  } else if (Array.isArray(p.quick_reply_payloads) && p.quick_reply_payloads.length) {
    // A forma PLURAL: vários botões na mesma mensagem, a novidade da Tarefa 4.
    // `lib/ig.ts` já aceitava `quick_replies` como lista — o que faltava era
    // este arquivo montar mais de uma entrada.
    //
    // QUEM PAREIA E QUEM CORTA É `botoesDaMensagem` (lib/steps.ts): pareamento
    // por índice, descarte do par sem rótulo, corte no limite da Meta. Os três
    // porquês estão lá, junto do teste que os fixa.
    //
    // AS VARIÁVEIS SÃO RESOLVIDAS ANTES DO PAREAMENTO, e a ordem é o que fecha
    // um buraco: um rótulo `{{first_name}}` de contato sem nome vira "" depois
    // do `render`, e a Meta recusa a mensagem inteira por título vazio. Se o
    // descarte olhasse o rótulo CRU, esse caso passaria batido. Elemento que
    // não é texto atravessa intocado — quem o recusa é a função pura.
    const rotulos = (Array.isArray(p.quick_reply_labels) ? p.quick_reply_labels : []).map((r) =>
      typeof r === "string" ? renderVariables(r, ctx) : r
    );
    const menu = botoesDaMensagem(rotulos, p.quick_reply_payloads);

    // OS DOIS REGISTROS, e são dois porque se arrumam em lugares diferentes: o
    // corte é o dono ter desenhado botões demais; o descarte é botão com
    // rótulo em branco (ou payload em branco, que só chega por `jsonb` editado
    // à mão). Sem eles, o botão some da mensagem e não há linha nenhuma
    // dizendo por quê — que é a falha muda que esta fase inteira passou
    // fechando.
    if (menu.pareados > LIMITE_DE_BOTOES) {
      await logEventThrottled(
        igUserId,
        "quick_replies_cortados",
        {
          queue_id: item.id,
          automation_id: item.automation_id,
          total: menu.pareados,
          limite: LIMITE_DE_BOTOES,
        },
        10,
        { campo: "automation_id", valor: item.automation_id ?? "" }
      );
    }
    if (menu.descartados) {
      await logEventThrottled(
        igUserId,
        "quick_replies_sem_rotulo",
        {
          queue_id: item.id,
          automation_id: item.automation_id,
          descartados: menu.descartados,
        },
        10,
        { campo: "automation_id", valor: item.automation_id ?? "" }
      );
    }

    // MENU QUE SOBROU VAZIO SAI COMO TEXTO PURO, e não como `quick_replies: []`:
    // a lista vazia é justamente a forma malformada que faz a Meta recusar a
    // mensagem inteira. É a mesma escolha do ramo singular, logo abaixo, que
    // cai no texto quando falta rótulo ou payload — o texto ainda chega.
    //
    // E ELE TEM NOME PRÓPRIO, que é a outra metade e faltava: o texto chegar é
    // ganho, mas `esperaResposta` (lib/steps.ts) já disse que este bloco PARA e
    // o motor já gravou o cursor. A mensagem sai sem botão nenhum, e o menu
    // inteiro — cada braço de `botao` que saía dele — deixa de ser alcançável.
    //
    // É LITERALMENTE A MEDIÇÃO PRÉ-TAREFA-4, a que está escrita no comentário de
    // `envioDaDm`: "o motor gravava o cursor esperando um toque que nunca
    // chegaria". A Tarefa 4 fechou o caminho do bloco sem `botao_label`; este é
    // o mesmo desfecho chegando pelo outro lado, o dos rótulos.
    //
    // É ALCANÇÁVEL HOJE: `botoes: [{id: "op_x"}]` sem `rotulo` atravessa
    // `envioDaDm`, que valida a LISTA e não os elementos (é comentário dela), e
    // a conferência de conteúdo é da Tarefa 5.
    //
    // O QUE ACONTECE COM A PESSOA, medido em vez de suposto — a versão desta
    // nota que dizia "fica parada para sempre" exagerava: o cursor está num
    // `dm`, e `handleMessagingEvent` (lib/engine.ts) cede a vez a outra
    // automação nesse caso (`interrompeOFluxo`); e o texto solto dela cai em
    // `retomadaDoTexto`, que segue a seta `sempre` do menu — normalmente
    // inexistente num menu, e aí a caminhada acaba e o cursor é LIMPO. Ou seja:
    // ela não fica capturada, ela SAI DO FLUXO CALADA, sem nunca receber o
    // braço que o botão levava. É por ser calado que o caso precisa de linha
    // própria.
    //
    // POR QUE UM EVENTO E NÃO UM CONSERTO AQUI: o dreno não tem como desfazer a
    // parada — o cursor é do motor, e reescrevê-lo daqui poria decisão de fluxo
    // dentro do arquivo que menos pode tê-la (nenhum teste o alcança). O
    // conserto de verdade é a Tarefa 5, que recusa SALVAR botão sem rótulo.
    // Até lá, o que este arquivo pode fazer é não deixar o caso ser mudo.
    //
    // E ELE NÃO CABE DENTRO DE `quick_replies_sem_rotulo`: aquele evento conta
    // descartes, e o menu vazio acontece TAMBÉM com `descartados: 0` — basta a
    // lista de rótulos faltar ou vir mais curta, e a sobra sai de fininho
    // (`botoesDaMensagem`, lib/steps.ts, e o teste "MENU INTEIRAMENTE
    // DESCARTADO"). Dobrado lá dentro, o caso grave seria invisível
    // justamente na forma em que nada é "descartado".
    if (!menu.botoes.length) {
      await logEventThrottled(
        igUserId,
        "menu_sem_botoes",
        {
          queue_id: item.id,
          automation_id: item.automation_id,
          contact_ig_id: item.contact_ig_id,
          pareados: menu.pareados,
          descartados: menu.descartados,
        },
        10,
        { campo: "automation_id", valor: item.automation_id ?? "" }
      );
    }

    message = menu.botoes.length
      ? {
          text: texto,
          quick_replies: menu.botoes.map((b) => ({
            content_type: "text" as const,
            title: b.rotulo,
            payload: b.payload,
          })),
        }
      : { text: texto };
  } else if (p.quick_reply_label && p.quick_reply_payload) {
    message = {
      text: texto,
      quick_replies: [
        { content_type: "text", title: rotuloResposta, payload: p.quick_reply_payload },
      ],
    };
  } else {
    message = { text: texto };
  }

  const enviada = await sendMessage(igUserId, token, recipient, message);
  return { outcome: "sent", messageId: enviada.message_id, sentText: texto };
}

export async function drainQueue(): Promise<{ sent: number; skipped: number; failed: number }> {
  const result = { sent: 0, skipped: 0, failed: 0 };
  await ensureSchema();
  const accounts = await listAccounts();
  if (!accounts.length) return result;
  const byId = new Map(accounts.map((a) => [a.ig_user_id, a]));

  // O limite horário da Meta é POR CONTA: contas no teto ficam de fora do
  // lote (em vez de serem reivindicadas e devolvidas, o que inflaria attempts).
  const capRows = (await sql()`
    select account_id, count(*)::int as n from queue
    where status = 'sent' and sent_at > now() - interval '1 hour'
    group by account_id
  `) as { account_id: string | null; n: number }[];
  const blocked = capRows
    .filter((r) => r.account_id && r.n >= HOURLY_CAP)
    .map((r) => r.account_id as string);

  // Trava atômica: FOR UPDATE SKIP LOCKED garante que dois drenos
  // simultâneos nunca peguem o mesmo item. Itens presos em 'sending'
  // há mais de 3 minutos são recuperados.
  const items = (await sql().query(
    `update queue q
     set status = 'sending', claimed_at = now(), attempts = q.attempts + 1
     where q.id in (
       select id from queue
       where ((status = 'pending' and not_before <= now())
          or (status = 'sending' and claimed_at < now() - interval '3 minutes'))
         and (account_id is null or not (account_id = any($2::text[])))
       order by created_at
       limit $1
       for update skip locked
     )
     returning q.*`,
    [BATCH_SIZE, blocked]
  )) as QueueItem[];

  for (const item of items) {
    const account = item.account_id ? byId.get(item.account_id) : undefined;
    if (!account) {
      // conta desconectada (ou item órfão antigo): não há token para enviar
      await finish(item.id, { status: "skipped", error: "conta não conectada" });
      result.skipped++;
      continue;
    }
    try {
      const { outcome, messageId, sentText } = await processItem(
        item,
        account.ig_user_id,
        account.access_token
      );
      if (outcome === "sent") {
        await finish(item.id, { status: "sent", sent_at: new Date(), message_id: messageId, sentText });
        result.sent++;
        await sleep(GAP_MS);
      } else {
        await finish(item.id, { status: "skipped", error: "janela de 24h fechada" });
        result.skipped++;
      }
    } catch (err) {
      const permanent = err instanceof IgError && err.status >= 400 && err.status < 500;
      const giveUp = permanent || item.attempts >= 3;
      await finish(item.id, {
        status: giveUp ? "failed" : "pending",
        retryInSeconds: 120,
        error: err instanceof Error ? err.message.slice(0, 500) : String(err),
      });
      result.failed++;
    }
  }

  // sobrou item pendente? agenda o próximo despertar
  // (item já vencido — ex.: lote cheio — volta em ~20s)
  const nextRows = (await sql()`
    select extract(epoch from (min(not_before) - now()))::float8 as secs
    from queue where status = 'pending'
  `) as { secs: number | null }[];
  const secs = nextRows[0]?.secs;
  if (secs !== null && secs !== undefined) {
    const config = await getConfig();
    await scheduleTick(config.app_url ?? "", Math.max(secs + 5, 20));
  }

  return result;
}
