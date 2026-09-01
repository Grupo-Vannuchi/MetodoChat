import "server-only";
import { sql, listAccounts, getConfig, QueueItem } from "./db";
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
import { lerPayloadDoLote, loteExpirou } from "./lote";
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
//
// A SEGUNDA METADE DO MESMO ACHADO só fechou na revisão do MOTOR: a Tarefa 4
// levou o PAREAMENTO para a função pura e deixou o MAPEAMENTO uma linha abaixo,
// aqui, montando `{content_type, title, payload}` a partir do par. Plantar os
// dois campos trocados nessa linha deixava 671/671 verdes. Agora
// `botoesDaMensagem` devolve a forma FINAL e o dreno só a entrega — não sobra
// transformação nenhuma neste arquivo para plantar.

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

    // SEM `map` NENHUM AQUI, E A AUSÊNCIA É O CONSERTO. Esta linha era
    // `menu.botoes.map((b) => ({content_type: "text", title: b.rotulo, payload:
    // b.payload}))`, e a revisão do motor plantou os dois campos trocados: 671
    // testes verdes, `tsc` e `eslint` limpos, e em produção nenhum botão do
    // produto funcionaria — `lerPayload` recusaria o rótulo e o toque não geraria
    // nem linha em Atividade. Nenhum teste alcança este arquivo, então a única
    // defesa possível era não haver o que plantar: `botoesDaMensagem`
    // (lib/steps.ts) passou a devolver a forma final, e aqui só sobra entregá-la.
    message = menu.botoes.length ? { text: texto, quick_replies: menu.botoes } : { text: texto };
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

// O QUARTO CONTADOR, E ELE FECHA UMA DRENAGEM QUE NÃO SOMAVA NADA.
//
// Até 01/09/2026 o item de lote guardado não incrementava contador nenhum: uma
// drenagem inteira gasta adormecendo quarenta itens devolvia `{sent: 0,
// skipped: 0, failed: 0}` — indistinguível, para quem lê a resposta da rota, de
// uma drenagem que não achou nada para fazer. O sintoma que a fome de fila
// produzia era exatamente esse zero triplo, e ele era invisível.
//
// OS TRÊS PRIMEIROS SÃO INGLÊS E O QUARTO NÃO, e é de propósito: ele conta itens
// que foram para o estado `guardado`, e o nome do estado é `guardado` — o
// porquê inteiro está em `migrations/009-fila-estado-guardado.sql`. Duas
// palavras para a mesma coisa seria pior do que um plural fora do idioma.
//
// A resposta das rotas `/api/queue/tick` e `/api/cron/daily` é este objeto
// espalhado em JSON, então o campo novo aparece na monitoração sem mais nada.
export type ResumoDaDrenagem = {
  sent: number;
  skipped: number;
  failed: number;
  guardados: number;
};

/**
 * O LOTE VENCIDO DE QUEM NUNCA MAIS FALA.
 *
 * `drainQueue` é o único lugar que avaliava `loteExpirou`, e ele só enxerga item
 * `pending`. Item `guardado` só volta a ser `pending` quando a PESSOA escreve
 * (`upsertContact`, lib/engine.ts) — e 40% dos contatos deste produto falaram
 * uma vez e nunca mais (medição da especificação). Para esses, o item ficava
 * `guardado` PARA SEMPRE, e a tela de Envios seguia dizendo "sai assim que ela
 * voltar a falar" semanas depois de o prazo ter acabado. A especificação
 * promete o contrário: "Ele é encerrado com o motivo escrito, e aparece assim
 * na tela de envios."
 *
 * UMA VARREDURA POR DIA, NO CRON QUE JÁ EXISTE, E ELA NÃO TOCA EM `pending`.
 * Essa metade é a que importa: devolver item guardado à fila viva — mesmo para
 * matá-lo — reabriria a fome de fila que `migrations/009-fila-estado-guardado.sql`
 * fechou, porque um item com `not_before` no passado é sempre elegível e é o
 * mais antigo. Aqui ele vai de `guardado` direto para `skipped`, sem passar pela
 * disputa.
 *
 * QUEM DECIDE SE VENCEU É `loteExpirou`, A MESMA FUNÇÃO DO DRENO, e não um
 * `where` em SQL. Duas regras de validade em dois lugares é o defeito que esta
 * branch inteira existe para não repetir — e a diferença apareceria justo no
 * caso mudo: `loteExpirou` trata data inválida como "sem prazo" DE PROPÓSITO
 * (cancelar em silêncio é pior), e um `(payload->>'valido_ate')::timestamptz`
 * ou trataria lixo como vencido ou estouraria no meio do cron diário.
 *
 * O RELÓGIO É O DO BANCO, pelo mesmo motivo escrito no dreno.
 *
 * O `status = 'guardado'` NO `update` NÃO É SOBRA: entre a leitura e a escrita a
 * pessoa pode ter voltado a falar, e o despertar de `upsertContact` já teria
 * posto o item em `pending`. Cancelá-lo dali seria escrever por cima de uma
 * decisão mais nova; deixado em `pending`, o dreno confere a validade de novo,
 * antes de enviar, e grava o desfecho dele.
 */
export async function cancelarLotesVencidos(): Promise<{ vencidos: number }> {
  const linhas = (await sql()`
    select id, payload, now() as agora_do_banco from queue
    where kind = 'dm_lote' and status = 'guardado'
  `) as { id: string; payload: unknown; agora_do_banco: Date }[];
  if (!linhas.length) return { vencidos: 0 };

  const marcado = linhas[0].agora_do_banco;
  const agoraNoBanco = marcado instanceof Date ? marcado.getTime() : Date.now();

  const vencidos = linhas
    .filter((l) => {
      const doLote = lerPayloadDoLote(l.payload);
      // Payload que não é de lote NÃO é problema desta função: o dreno já o
      // encerra com o motivo escrito, e ele nunca chega a ficar guardado.
      return doLote !== null && loteExpirou(doLote.validoAte, agoraNoBanco);
    })
    .map((l) => l.id);
  if (!vencidos.length) return { vencidos: 0 };

  // O texto CASA COM `friendlyError` (app/labels.ts) por "o lote venceu", que é
  // o pedaço que ela procura — o mesmo desfecho que o dreno já escreve, com o
  // motivo desta rota.
  await sql().query(
    `update queue set status = 'skipped', error = $2
      where id = any($1::uuid[]) and status = 'guardado'`,
    [vencidos, "o lote venceu enquanto esperava a pessoa voltar a falar"]
  );
  return { vencidos: vencidos.length };
}

export async function drainQueue(): Promise<ResumoDaDrenagem> {
  const result = { sent: 0, skipped: 0, failed: 0, guardados: 0 };
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
  //
  // O `with` NÃO É ENFEITE, E A ORDEM DELE É O CONSERTO DE UM DEFEITO DE
  // PRODUÇÃO. Esta consulta já tinha um `order by created_at`, e ele continua
  // aqui embaixo — mas ele vive DENTRO da subconsulta, onde decide QUAIS itens
  // entram no lote e não em que ordem eles voltam. A ordem do `returning` de um
  // `update` não é especificada pelo Postgres, e medindo dá bem isso: oito itens
  // gravados em ordem voltaram `u8 u5 u6 u7 u1 u4 u2 u3`. O laço abaixo envia na
  // ordem que vier, então "Toca no botão pra receber o link" podia chegar DEPOIS
  // do cartão com o link, na conversa da pessoa. Achado por teste de integração
  // (`testes-integracao/gatilho-entrega.integracao.ts`, o primeiro caso), e não
  // por relato — nenhum teste executava o dreno até a Frente 2 existir.
  //
  // POR QUE NO SQL, E NÃO UM `items.sort()` EM JAVASCRIPT. Ordenar em JS parece
  // mais simples e é ERRADO aqui, e a medição é curta: o driver (postgres.js)
  // entrega `created_at` como `Date`, que tem resolução de MILISSEGUNDO, e o
  // Postgres guarda MICROSSEGUNDO. Com oito itens separados por 200 µs — que é o
  // que acontece quando o banco está perto do app, e não a 26 ms de distância
  // como nesta máquina — o `sort` em JS devolveu `u1 u4 u3 u2 u8 u6 u5 u7`: os
  // microssegundos já tinham sido jogados fora antes de o JavaScript ver a
  // coluna. Ordenar aqui compara a coluna inteira. Custo medido: 833 ms contra
  // 835 ms em 20 rodadas — empate.
  //
  // E O `, id` É O DESEMPATE. Dois itens gravados no MESMO instante existem, e
  // `order by created_at` sozinho deixaria a ordem entre eles por conta da ordem
  // de entrada do sort — que é justamente a do `returning`, a que não se pode
  // prometer. Com `(created_at, id)` a ordem é a mesma em toda drenagem e em toda
  // retentativa (medido: 6 leituras de 12 empatados, 1 resultado distinto). Ela
  // não recupera a ordem de INSERÇÃO dos empatados — o `id` é
  // `gen_random_uuid()`, e não há coluna monotônica em `queue` —; o que ela
  // promete é estabilidade, não adivinhação. Recuperar inserção exigiria coluna
  // nova, que é migração em banco vivo e decisão de outro dia.
  //
  // O `skip locked` continua onde estava: o `explain` mostra o `LockRows`
  // debaixo do `Limit` dentro da CTE, e o `Sort` só por cima do `CTE Scan`.
  const items = (await sql().query(
    `with lote as (
       update queue q
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
       returning q.*
     )
     select *, now() as agora_do_banco from lote order by created_at, id`,
    [BATCH_SIZE, blocked]
  )) as (QueueItem & { agora_do_banco: Date })[];

  // O RELOGIO QUE JULGA A VALIDADE É O DO BANCO, E NÃO O DA APLICAÇÃO.
  //
  // `loteExpirou` (lib/lote.ts) cai em `Date.now()` quando ninguém lhe diz que
  // horas são, e todo o resto desta fila conta pelo `now()` do Postgres: o
  // `not_before` do enqueue, a seleção lá em cima, o backoff do `finish`.
  // Misturar os dois é o defeito que `enqueue` (lib/engine.ts) já documenta com
  // medição própria: 53,9 segundos de diferença NESTA máquina, milissegundos
  // na Vercel. Cinquenta e quatro segundos decidem o caso de um prazo que
  // acabou de vencer — e um lote grande passa horas saindo por causa do
  // `HOURLY_CAP`, então esse caso acontece.
  //
  // NÃO CUSTA IDA NOVA: é uma coluna a mais na consulta que já reivindicou o
  // lote. Ela é lida UMA VEZ por drenagem, e não por item, e isso basta: uma
  // drenagem é no máximo `BATCH_SIZE` itens com `GAP_MS` entre eles, ou seja
  // ~9 segundos de ponta a ponta.
  //
  // O `?? Date.now()` é para a lista vazia (nenhum item, o laço nem roda) e
  // para o dia em que o driver devolver outra coisa que não `Date`. Cair no
  // relógio da aplicação é exatamente o que se fazia antes; nunca é pior.
  const marcado = items[0]?.agora_do_banco;
  const agoraNoBanco = marcado instanceof Date ? marcado.getTime() : Date.now();

  for (const item of items) {
    const account = item.account_id ? byId.get(item.account_id) : undefined;
    if (!account) {
      // conta desconectada (ou item órfão antigo): não há token para enviar
      await finish(item.id, { status: "skipped", error: "conta não conectada" });
      result.skipped++;
      continue;
    }

    // A VALIDADE É CONFERIDA ANTES DE ENVIAR, E É POR ISSO QUE ELA MORA AQUI.
    //
    // Ela morava LÁ EMBAIXO, dentro do ramo em que a janela está FECHADA — o
    // único lugar em que era consultada. No caminho de envio ninguém a olhava:
    // `processItem` via a janela aberta e mandava.
    //
    // O CENÁRIO, medido em `testes-integracao/lote.integracao.ts` ("lote
    // VENCIDO com a janela ABERTA"): sexta o dono manda "a turma abre segunda,
    // vagas até domingo" para 111 pessoas fora da janela. Terça uma delas volta
    // a falar. O item acorda, a janela está aberta, e ela recebia a oferta que
    // venceu há dois dias.
    //
    // E O SEGUNDO CENÁRIO NÃO PRECISA DE NINGUÉM VOLTANDO A FALAR: `HOURLY_CAP`
    // é 190 POR CONTA, então um lote de 800 com a janela aberta leva ~4h20 para
    // sair inteiro — tudo o que fica depois do teto saía DEPOIS do prazo, sem
    // nunca ter passado por uma janela fechada. Conferir aqui, uma vez, cobre
    // os dois caminhos porque este é o ponto por onde todo item passa.
    if (item.kind === "dm_lote") {
      const doLote = lerPayloadDoLote(item.payload);

      // ITEM DE LOTE COM PAYLOAD QUE NÃO É DE LOTE NÃO ESPERA PARA SEMPRE.
      //
      // `lerPayloadDoLote` devolve `null` quando falta `lote_id` ou `text`, e
      // `null` era lido aqui como "sem prazo" — a mesma resposta que um lote
      // deliberadamente eterno dá. O item ficava guardado indefinidamente, sem
      // texto para enviar e sem uma linha dizendo por quê.
      //
      // A COLUNA É `jsonb` E EDITÁVEL POR FORA do painel — é o mesmo motivo
      // pelo qual `botoesDaMensagem` defende no dreno e não só no editor (ver o
      // cabeçalho deste arquivo). Aqui a defesa é recusar: `skipped` é um
      // desfecho, e um desfecho errado aparece na tela de Envios; "guardado
      // para sempre" não aparece em lugar nenhum.
      if (!doLote) {
        await logEventThrottled(
          account.ig_user_id,
          "lote_com_payload_invalido",
          { queue_id: item.id, contact_ig_id: item.contact_ig_id },
          10,
          { campo: "contact_ig_id", valor: item.contact_ig_id ?? "" }
        );
        await finish(item.id, {
          status: "skipped",
          error: "o payload deste item de lote nao e de lote",
        });
        result.skipped++;
        continue;
      }

      if (loteExpirou(doLote.validoAte, agoraNoBanco)) {
        await finish(item.id, { status: "skipped", error: "o lote venceu antes de sair" });
        result.skipped++;
        continue;
      }
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
      } else if (item.kind === "dm_lote") {
        // O ITEM DE LOTE ESPERA, e é só isto que este projeto muda no motor.
        //
        // Todo outro tipo continua sendo DESCARTADO ao perder a janela, e isso
        // é deliberado: medido em 01/09/2026, a janela descartou 6 itens na
        // vida inteira do produto, quase sempre porque a automação disparou
        // para alguém cuja conversa já tinha esfriado. Fazer esses esperarem
        // entregaria uma boas-vindas dias depois, fora de contexto.
        //
        // ELE ESPERA NUM ESTADO PRÓPRIO, E NÃO NO `pending` DAS MENSAGENS
        // VIVAS — e esta linha é o redesenho inteiro.
        //
        // Ele já morou em `pending` com `not_before` um dia à frente, e o dia
        // não era enfeite: a seleção do dreno é `status = 'pending' and
        // not_before <= now()`, `order by created_at`, `limit 15`, e um item
        // guardado com `not_before` no passado é SEMPRE elegível e é o MAIS
        // VELHO. Com quarenta esperando, três drenagens inteiras não deixavam
        // sair uma mensagem de verdade. Dormir um dia ADIAVA a fome; não a
        // tirava — passado o dia, os quarenta voltavam, e o ciclo se repetia
        // TODO DIA. É o que o caso "quarenta itens guardados... hoje nem amanhã"
        // (testes-integracao/lote.integracao.ts) mede, e era a segunda metade
        // dele que ficava vermelha.
        //
        // OS CINCO DEFEITOS QUE ESTE ESTADO FECHA DE UMA VEZ estão listados em
        // `migrations/009-fila-estado-guardado.sql`, que é onde ele nasce. Os
        // quatro que se resolvem AQUI, sem mais nenhuma linha, resolvem-se por
        // SUBTRAÇÃO — a seleção do dreno, a reivindicação, o rodapé do QStash
        // e a consulta do despertar perguntam todos por `pending`, e o item
        // guardado deixou de responder a essa pergunta:
        //
        //   FOME DE FILA — a seleção não o vê mais, hoje nem amanhã.
        //   `attempts` — quem faz `attempts + 1` é a reivindicação, e ela só
        //     alcança `pending`. O item deixou de gastar uma tentativa por dia
        //     dormindo; guardado quatro dias ele chegava com `attempts >= 3` e
        //     `giveUp` o matava em `failed` no primeiro 500 da Meta. Agora ele
        //     chega ao primeiro erro com o contador que de fato ganhou.
        //   O TIQUE ETERNO DO QSTASH — o rodapé lá embaixo agenda o próximo
        //     por `min(not_before)` sobre `pending`. Item guardado não entra
        //     mais nesse mínimo, e o dreno para de publicar um tique por
        //     webhook, indefinidamente.
        //   O DESPERTAR — `upsertContact` (lib/engine.ts) casava com todo
        //     `dm_lote` `pending`, inclusive o que o `catch` logo abaixo tinha
        //     acabado de marcar `pending, retryInSeconds: 120` depois de um 500
        //     da Meta: o despertar zerava o backoff de erro. Agora ele pede
        //     `guardado`, e os dois deixaram de ser a mesma linha.
        //
        // SEM `retryInSeconds`, E A AUSÊNCIA É INTENCIONAL: `not_before` deixou
        // de ser o que segura o item, então mexê-lo aqui só escreveria uma data
        // que ninguém lê.
        //
        // A MÁQUINA DE ACORDAR NÃO MUDOU: `drainQueue` roda DENTRO do webhook
        // (`app/api/webhook/route.ts`, no `after()`), e o `last_reply_at` do
        // contato é gravado ANTES disso, por `upsertContact` — que na mesma ida
        // devolve o item para `pending`. Quando a pessoa escreve, a janela dela
        // abre e o dreno roda em seguida: o item encontra a janela aberta sem
        // precisar de tarefa agendada.
        //
        // O QUE SE PERDEU COM O DIA, dito em voz alta: ele era a rede de
        // segurança para o caso de o despertar falhar, e não há mais rede. É
        // troca consciente — a rede custava a fome de fila TODO DIA, e o
        // despertar é a única porta por onde uma janela abre (o comentário dele
        // em lib/engine.ts diz por quê). Um item cujo despertar falhe fica
        // guardado, visível na tela de Envios com esse nome, em vez de sair fora
        // de hora.
        await finish(item.id, {
          status: "guardado",
          error: "guardado ate a pessoa voltar a falar",
        });
        result.guardados++;
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
  //
  // `status = 'pending'` NÃO ALCANÇA O ITEM GUARDADO, e isso é o conserto de um
  // crescimento sem fim: enquanto ele morava em `pending`, sempre havia um
  // `min(not_before)` para devolver, então TODO webhook publicava um tique no
  // QStash — indefinidamente, mesmo com a fila viva vazia. Agendar por um item
  // que espera uma PESSOA é agendar para nada: quem o acorda não é relógio.
  // Ver `migrations/009-fila-estado-guardado.sql`.
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
