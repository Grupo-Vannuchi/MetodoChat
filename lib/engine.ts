import "server-only";
import {
  sql,
  ensureSchema,
  getConfig,
  listAccounts,
  Account,
  Automation,
  QueueItem,
} from "./db";
import { matches, pickRandom, extractEmail } from "./match";
import { getUserProfile, checkFollowsAccount } from "./ig";
import { scheduleTick } from "./qstash";
// `retomadaDoFallback`, `interrompeOFluxo`, `retomadaDoBotao` e
// `retomadaDoFollow` moraram aqui e agora vêm de lib/steps.ts: as quatro são
// decisão pura, e dentro de um arquivo `server-only` nenhum teste as alcançava.
// Foram justamente as que mais deram defeito. As duas últimas saíram inteiras, e
// não em pedaços: as peças (`cursorDesta`, `indiceDoPortao`, `passoEsperado`) já
// eram testadas uma a uma — o que estava descoberto era a COMPOSIÇÃO delas.
//
// `cursorDaRetomada` seguiu o mesmo caminho, e pelo mesmo motivo: ela era o
// `const cursor = p.passoId ? ... : ...` daqui de baixo, e escolher errado ali
// desfazia, sem teste nenhum acusar, o que `retomadaDoFollow` garante.
//
// `retomadaDoTexto` é a QUARTA, e a última: ela era o `const retomarDe =
// passo.tipo === "pedir_follow" ? indiceParado : indiceParado + 1` do ramo de
// texto, calculado aqui por conta própria e sem passar por nenhuma das outras
// três. É por ela que a primeira das duas entradas da regra do portão é
// alcançável (o porquê está escrito lá), então deixá-la aqui deixaria a regra
// pela metade — e sem teste, como as outras estavam.
import {
  interpretar,
  envioDaDm,
  passoEsperado,
  retomadaDoFallback,
  retomadaDoBotao,
  retomadaDoFollow,
  retomadaDoTexto,
  cursorDaRetomada,
  interrompeOFluxo,
  identidadeDoPasso,
  identidadeNoIndice,
  indiceDoId,
  lerPayload,
  ligacaoEscolhida,
  oQuePortaoFaz,
  type AcaoEnfileirar,
  type Cursor,
  type Retomada,
} from "./steps";
// `welcomeMessageKey` não é mais importado aqui: era a chave do enfileiramento
// de boas-vindas por coluna, que saiu. Ela continua em lib/dedupe.ts, com teste,
// e o motivo está escrito lá (lib/dedupe.ts, nota do topo) — não é a fila ter
// linhas antigas com esse prefixo, que era a justificativa errada: a tabela só
// tem `mr:` e `passo:`. É o desmonte pela metade das colunas órfãs.
//
// `privateReplyKey` voltou a ser usado. Não é resíduo: a resposta privada ao
// comentário é o ÚNICO caminho de entrega de uma automação disparada por
// comentário (ver `gastarRespostaPrivada`), e a chave dela continua sendo o id
// do comentário, como sempre foi.
import {
  privateReplyKey,
  commentReplyKey,
  followGateKey,
  emailAskKey,
  passoKey,
  emailAnswerKey,
  storyReactionKey,
  manualReplyKey,
  diaDaChave,
} from "./dedupe";

// ============================================================
// Recepção: transforma eventos do webhook em itens na fila
// ============================================================

// Exportados porque o webhook precisa nomear o que está entregando. Todos os
// campos são opcionais de propósito: é JSON vindo da Meta, e a única garantia é
// a assinatura do corpo — não o formato dele.
export type CommentValue = {
  id: string; // comment_id
  from?: { id?: string; username?: string };
  media?: { id?: string; media_product_type?: string };
  text?: string;
  parent_id?: string;
};

export type MessagingEvent = {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: {
    mid?: string;
    text?: string;
    is_echo?: boolean;
    quick_reply?: { payload?: string };
    reply_to?: { story?: { url?: string; id?: string }; mid?: string };
  };
};

export async function logEvent(accountId: string | null, type: string, payload: unknown) {
  await ensureSchema();
  // O payload vai CRU para uma coluna jsonb — sem JSON.stringify.
  //
  // Isto já foi `JSON.stringify(payload)` e estava certo no driver HTTP, que só
  // aceitava texto. O driver por TCP tipa o parâmetro como json sozinho, então a
  // string pré-serializada era gravada como ESCALAR json — o texto `{"a":1}` em
  // vez do objeto {a:1}. Nada acusava: o insert passava, a coluna aceitava.
  //
  // O estrago aparecia depois, na leitura: `payload->'sender'->>'id'` devolvia
  // nulo em escalar, derrubando o inbox e os filtros de /eventos, e o jsonb_set
  // do dreno falhava com "cannot set path in scalar".
  //
  // Cru funciona para toda forma que este parâmetro recebe — objeto, array,
  // string, número —, verificado uma a uma contra o banco.
  await sql().query(`insert into events (account_id, type, payload) values ($1, $2, $3)`, [
    accountId,
    type,
    payload,
  ]);
}

// Registra no máximo um evento deste tipo por janela.
//
// Para diagnósticos que nascem de requisição NÃO autenticada. O webhook aceita
// qualquer coisa da internet, e gravar uma linha por tentativa transforma o
// diagnóstico num canal de escrita aberto: quem quiser enche a tabela e a cota
// do banco. Um aviso a cada 10 minutos diz a mesma coisa ao dono do painel.
//
// A corrida entre duas requisições simultâneas pode gravar duas linhas em vez
// de uma. Tudo bem: o que não pode é gravar dez mil.
//
// O `discriminador` ESTREITA a janela, e é opcional porque os dois usos são
// diferentes:
//
//   SEM ele a janela é por TIPO e só por tipo — global, atravessando contas.
//     É o que os diagnósticos de webhook não autenticado querem: eles nascem de
//     requisição anônima, o `accountId` pode ser null, e o ponto é justamente
//     não deixar a internet encher a tabela, doa a quem doer.
//   COM ele a janela passa a ser por tipo + conta + um campo do payload. Sem
//     isso, um passo quebrado da automação A silenciava por 10 minutos o aviso
//     de OUTRA automação — e, em painel multi-conta, uma conta silenciava a
//     outra. Isso não é redução de ruído, é perda de diagnóstico.
//
// O `account_id` só entra no filtro quando não é null: `account_id = null` não
// casa com nada em SQL, e a janela por conta nunca fecharia — o throttle viraria
// enfeite. Sem conta, discrimina só pelo campo do payload.
export async function logEventThrottled(
  accountId: string | null,
  type: string,
  payload: unknown,
  minutos = 10,
  discriminador?: { campo: string; valor: string }
): Promise<void> {
  await ensureSchema();
  // `payload` é jsonb (ver lib/db.ts), então `->>` devolve o campo como texto —
  // e a CHAVE também vai como parâmetro, verificado contra o banco.
  const filtros = ["type = $1", "created_at > now() - make_interval(mins => $2::int)"];
  const params: unknown[] = [type, minutos];
  if (discriminador) {
    params.push(discriminador.campo, discriminador.valor);
    filtros.push(`payload->>$${params.length - 1} = $${params.length}`);
    if (accountId !== null) {
      params.push(accountId);
      filtros.push(`account_id = $${params.length}`);
    }
  }
  const recentes = (await sql().query(
    `select 1 from events where ${filtros.join(" and ")} limit 1`,
    params
  )) as unknown[];
  if (recentes.length) return;
  await logEvent(accountId, type, payload);
}

// A Meta manda o id da conta que recebeu o evento em entry.id — é ele que diz
// qual das contas conectadas deve responder. Se não bater (id em formato
// inesperado) e só existir uma conta, ela assume.
async function resolveAccount(entryId: string | undefined): Promise<Account | null> {
  const accounts = await listAccounts();
  if (!accounts.length) return null;
  if (entryId) {
    const found = accounts.find((a) => a.ig_user_id === entryId);
    if (found) return found;
  }
  return accounts.length === 1 ? accounts[0] : null;
}

async function activeAutomations(accountId: string): Promise<Automation[]> {
  return (await sql().query(
    `select * from automations
     where account_id = $1 and active = true
     order by created_at asc`,
    [accountId]
  )) as Automation[];
}

function findMatch(
  automations: Automation[],
  trigger: "comment" | "story" | "dm",
  text: string,
  mediaId?: string
): Automation | undefined {
  const candidates = automations.filter((a) => {
    if (!a.triggers.includes(trigger)) return false;
    if (trigger === "comment" && a.media_id && a.media_id !== mediaId) return false;
    if (trigger === "story" && a.story_id && a.story_id !== mediaId) return false;
    return matches(text, a.keywords, a.match_type);
  });
  // automação presa a um post/story específico ganha da genérica
  return (
    candidates.find((a) => (trigger === "story" ? a.story_id : a.media_id)) ?? candidates[0]
  );
}

// O atraso vem em SEGUNDOS a partir de agora, não como instante absoluto — e a
// conta de "agora" é feita pelo BANCO.
//
// Antes isto recebia um Date do relógio da aplicação. Só que quem busca o item
// compara com `now()`, o relógio do banco. Dois relógios na mesma comparação: se
// a aplicação estiver adiantada, o item nasce no futuro e ninguém o pega até a
// diferença passar.
//
// Não é hipótese. Medido nesta máquina: 53,9 segundos de diferença, e toda
// resposta manual ficava presa quase um minuto. Na Vercel os relógios são
// sincronizados e a diferença é de milissegundos, e foi por isso que isso nunca
// apareceu em produção.
async function enqueue(item: {
  account_id: string;
  kind: QueueItem["kind"];
  contact_ig_id?: string;
  automation_id?: string;
  comment_id?: string;
  payload: Record<string, unknown>;
  dedupe_key: string;
  delaySeconds?: number;
}): Promise<boolean> {
  const atraso = Math.max(0, Math.round(item.delaySeconds ?? 0));
  const rows = (await sql().query(
    `insert into queue (account_id, kind, contact_ig_id, automation_id, comment_id, payload, dedupe_key, not_before)
     values ($1, $2, $3, $4, $5, $6, $7, now() + make_interval(secs => $8::int))
     on conflict (dedupe_key) do nothing
     returning id`,
    [
      item.account_id,
      item.kind,
      item.contact_ig_id ?? null,
      item.automation_id ?? null,
      item.comment_id ?? null,
      // Cru, não JSON.stringify — mesmo motivo explicado em logEvent. Aqui a
      // consequência seria mais visível: o dreno faz jsonb_set neste payload
      // para registrar o texto entregue, e sobre escalar isso é erro duro.
      item.payload,
      item.dedupe_key,
      atraso,
    ]
  )) as { id: string }[];
  const inserted = rows.length > 0;

  // item com atraso: pede pro QStash acordar o app na hora certa
  if (inserted && atraso > 15) {
    const config = await getConfig();
    await scheduleTick(config.app_url ?? "", atraso + 5);
  }
  return inserted;
}

async function upsertContact(
  accountId: string,
  igId: string,
  fields: {
    username?: string | null;
    name?: string | null;
    profile_pic?: string | null;
    last_reply_at?: Date;
    last_automation_id?: string;
  }
) {
  await sql().query(
    `insert into contacts (account_id, ig_id, username, name, profile_pic, last_reply_at, last_automation_id)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (account_id, ig_id) do update set
       username = coalesce(excluded.username, contacts.username),
       name = coalesce(excluded.name, contacts.name),
       profile_pic = coalesce(excluded.profile_pic, contacts.profile_pic),
       last_reply_at = coalesce(excluded.last_reply_at, contacts.last_reply_at),
       last_automation_id = coalesce(excluded.last_automation_id, contacts.last_automation_id)`,
    [
      accountId,
      igId,
      fields.username ?? null,
      fields.name ?? null,
      fields.profile_pic ?? null,
      fields.last_reply_at?.toISOString() ?? null,
      fields.last_automation_id ?? null,
    ]
  );
}

// O webhook de mensagens só traz o IGSID (um número). Busca o perfil na
// primeira mensagem para o contato não ficar salvo como "1436974448...".
async function fetchProfileFields(
  accountId: string,
  igId: string,
  token: string | null
): Promise<{ username?: string | null; name?: string | null; profile_pic?: string | null }> {
  if (!token) return {};
  const rows = (await sql().query(
    `select username from contacts where account_id = $1 and ig_id = $2`,
    [accountId, igId]
  )) as { username: string | null }[];
  if (rows[0]?.username) return {}; // já conhecido
  try {
    const p = await getUserProfile(igId, token);
    return { username: p.username ?? null, name: p.name ?? null, profile_pic: p.profile_pic ?? null };
  } catch {
    return {}; // perfil indisponível (conta privada/apagada): segue só com o id
  }
}

// 1 sequência por pessoa/automação/dia. Qual dia é "hoje" mora em
// `diaDaChave` (lib/dedupe.ts), junto das chaves que o consomem e com teste —
// aqui fica só a leitura do relógio, que é o que não dá para testar.
function dayBucket(): string {
  return diaDaChave(new Date());
}

async function loadAutomation(
  accountId: string,
  automationId: string
): Promise<Automation | undefined> {
  const rows = (await sql().query(
    `select * from automations where id = $1 and account_id = $2 and active = true`,
    [automationId, accountId]
  )) as Automation[];
  return rows[0];
}

// Quantas vezes repetimos o pedido antes de parar de insistir. É por CONTATO e
// NA VIDA: não há contador por dia, e o motivo está em `oQuePortaoFaz`
// (lib/steps.ts).
//
// Atingido o limite, param DUAS coisas — e a segunda é o que a frase antiga
// deixava de fora: para o lembrete, para não virar spam (e não chamar a atenção
// da Meta), E para o portão de segurar o cursor, que era o que capturava a
// pessoa depois de parar de cobrá-la.
//
// A VERIFICAÇÃO continua acontecendo depois disso: `checkFollowsAccount` roda
// ANTES de o contador ser olhado, então quem seguir o perfil passa na hora e
// tem o contador zerado — inclusive quem já foi solto.
const MAX_FOLLOW_REQUESTS = 5;

// Executa o fluxo desta automação a partir de `deIndice`.
//
// A sequência não está mais aqui: ela vem de `auto.steps`, e quem decide o que
// fazer é o interpretador puro de lib/steps.ts. Esta função é só a casca que
// toca banco, chama a Meta e enfileira.
// `contexto` carrega os ids que só o gatilho conhece. Sem ele, `resposta_publica`
// e `reagir_story` não teriam como ser enfileirados aqui e continuariam tratados
// à parte, lendo as colunas antigas — a lista teria dois passos decorativos e o
// fluxo não seria dado de verdade.
export type ContextoGatilho = {
  commentId?: string;
  messageId?: string;
  // Mutável de propósito, e escrito só por `gastarRespostaPrivada`: marca que a
  // resposta privada deste comentário já foi gasta. Fica no contexto, e não numa
  // variável local, porque `executarFluxo` chama a si mesmo (portão de follow,
  // e-mail já conhecido) passando o MESMO objeto — a marca precisa atravessar
  // essas chamadas, senão a segunda mensagem gastaria a resposta privada de novo.
  respostaPrivadaGasta?: boolean;
};

// A resposta privada ao comentário: a única mensagem que fura a janela de 24h.
//
// POR QUE isto existe: quem comenta num post quase nunca mandou DM para a conta
// antes, então NÃO existe janela de 24h aberta para essa pessoa. `processItem`
// descarta como `skipped`, em silêncio, toda DM comum fora da janela. Sem
// resposta privada, automação com gatilho de comentário — o recurso central
// deste produto — não entrega absolutamente nada.
//
// A Meta permite UMA resposta privada por comentário; a segunda falha. Por isso
// esta função é um consumo, não uma consulta: a primeira mensagem da execução
// gasta o direito e marca o contexto. As seguintes (o link, o lembrete) saem
// pelos tipos normais — a essa altura a pessoa já tocou no botão ou respondeu, e
// a janela está aberta.
//
// Na prática a primeira costuma ser a de boas-vindas, porque o fluxo para nela
// esperando o toque. Mas isso é consequência da FORMA de lista que o formulário
// gravava e que o quadro reproduz na maioria das vezes, não uma garantia: a
// marca no contexto vale para qualquer lista, inclusive uma que não tenha passo
// de espera logo no começo.
//
// Devolve o id do comentário quando esta mensagem deve sair como resposta
// privada, e null quando deve sair como DM comum.
function gastarRespostaPrivada(contexto: ContextoGatilho): string | null {
  if (!contexto.commentId || contexto.respostaPrivadaGasta) return null;
  contexto.respostaPrivadaGasta = true;
  return contexto.commentId;
}

// O `de` aceita as DUAS formas, e a união é o que mantém a mudança contida.
//
// NÚMERO é o caso de dentro: o gatilho começando do zero, e as chamadas que esta
// função faz a si mesma (portão vencido no caminho, e-mail já conhecido). Não há
// portão a atravessar antes — o índice já é o próximo passo a executar.
//
// `Retomada` é o caso de fora: os três pontos em que alguém volta a um fluxo
// parado (`retomadaDoBotao`, `retomadaDoFollow`, `retomadaDoTexto`, lib/steps.ts).
// Só eles podem cair do outro lado de um portão, e é só por eles que a regra do
// portão precisa entrar aqui.
async function executarFluxo(
  account: Account,
  auto: Automation,
  contactIgId: string,
  de: number | Retomada,
  contexto: ContextoGatilho = {}
): Promise<void> {
  const retomada: Retomada = typeof de === "number" ? { portao: null, destino: de } : de;

  // O PORTÃO DE PASSAGEM: atravessa, e segue para o destino.
  //
  // A regra e o porquê dela moram em `atravessandoOPortao` (lib/steps.ts), que é
  // pura e tem teste. Aqui fica só o que ela não pode fazer: consultar a Meta.
  //
  // O que este bloco NÃO faz, e é o ponto inteiro da correção: ele não retoma de
  // `portao + 1`. Vencido o portão, o fluxo continua de `retomada.destino`, que
  // é para onde ele ia. Retomar do seguinte reinterpretaria a lista e pararia na
  // primeira parada dura do caminho — e numa lista com resposta rápida depois do
  // portão essa parada é a própria, o que prende TODO MUNDO antes do link, sem
  // saída. `interpretar` começando em `destino` também garante o outro lado:
  // nada entre o portão e o destino é reenfileirado, então a passagem não custa
  // mensagem repetida a ninguém.
  //
  // BARRADO, para no portão exatamente como o ramo de dentro (mais abaixo): o
  // cursor passa a ser o portão, o pedido foi ENFILEIRADO — com a ressalva do
  // `on conflict` que o ramo de dentro descreve —, e a pessoa destrava seguindo
  // o perfil e voltando a falar.
  //
  // SOLTO é a terceira resposta, e ela é nova: esgotadas as tentativas,
  // `resolverFollow` não tem pedido nenhum a enfileirar, e segurar o cursor
  // seria segurar calado. Aqui o cursor é LIMPO e o fluxo para — o destino fica
  // do outro lado de um portão que a pessoa não venceu, e ele continua não sendo
  // entregue.
  //
  // QUEM ESTÁ ADIANTE DO PORTÃO perde a posição dele, e isso é preciso estar
  // dito porque parece perda nova, e não é: barrado, este ramo já sobrescrevia o
  // cursor com o PORTÃO (`gravarCursor` logo abaixo), então a posição adiante já
  // se perdia do mesmo jeito. O que muda é o destino da pessoa — antes ela
  // ficava parada num portão que não pergunta mais nada, e o ramo de texto lia
  // toda mensagem dela como resposta a ele; agora ela fica sem cursor, e
  // qualquer palavra-chave de qualquer automação volta a alcançá-la.
  //
  // E LIMPAR é mais seguro do que deixar o cursor intacto, que era a alternativa
  // óbvia para preservar a posição: o destino de uma retomada adiante do portão
  // pode ser um `pedir_email` ou um SEGUNDO `pedir_follow`, e os dois capturam
  // toda mensagem pelo mesmo motivo (`interrompeOFluxo` só cede a vez quando o
  // passo parado é `dm`). Preservar a posição reabriria a captura justamente
  // para esses casos.
  //
  // O `pedir_follow` conferido é obrigação de TIPO e não desconfiança:
  // `retomada.portao` só é não-nulo quando `indiceDoPortao` (lib/steps.ts) o
  // achou, e ela valida o passo com o mesmo `conferir` do interpretador. Sem a
  // conferência, porém, não há como estreitar `Passo` para o que
  // `resolverFollow` recebe.
  //
  // E ELA FALHA FECHADA, que é a diferença desta versão. Antes, portão que não
  // resolvesse para um `pedir_follow` válido caía direto no `interpretar` lá
  // embaixo: o destino era entregue COM O PORTÃO NUNCA AVALIADO, sem erro e sem
  // linha em Atividade. Era a única linha do sistema em que a promessa "ninguém
  // atravessa um portão sem ele ser avaliado" era abandonada por OMISSÃO — e
  // justamente a linha que torna a promessa executável.
  //
  // Hoje isso é inalcançável, e dá para demonstrar: `indiceDoPortao` e
  // `passoEsperado` (lib/steps.ts) chamam o MESMO `conferir` sobre o MESMO array
  // e `esperaResposta` diz sim a todo `pedir_follow`, então o índice que a
  // primeira devolveu a segunda reconhece. Só que a invariante é entre DUAS
  // funções, e nada obriga as duas a continuarem concordando: basta alguém
  // passar a reler `steps` do banco entre o cálculo da `Retomada` (que acontece
  // em `handleMessagingEvent`) e a execução daqui, e as duas passam a olhar
  // listas diferentes. Uma edição da automação nesse intervalo é tudo o que
  // falta.
  //
  // A SAÍDA ESCOLHIDA é PARAR e REGISTRAR, sem tocar no cursor, e cada metade
  // tem motivo próprio:
  //
  //   PARAR é o ponto inteiro: o destino fica do outro lado de um portão que
  //     ninguém avaliou, então ele não sai. Falha fechada custa mensagem que
  //     deixa de chegar; falha aberta custa o link entregue a quem não segue,
  //     que é o defeito que esta branch gastou duas ondas para matar.
  //   REGISTRAR porque parar calado seria trocar uma omissão por outra. A linha
  //     em Atividade é o que faz o dono do painel descobrir sem depender de
  //     cliente reclamando. Vai por `logEventThrottled`, e pelo mesmo motivo dos
  //     `step_ignorado`: o webhook aceita o que a Meta mandar, e sem janela o
  //     diagnóstico viraria o maior escritor da tabela.
  //   NÃO ESCREVER O CURSOR porque a única identidade disponível aqui sairia de
  //     `identidadeDoPasso(portao, retomada.portao)` com `portao` UNDEFINED —
  //     ou seja, o índice em texto. Depois da migração (`dar-ids-aos-passos.mjs`)
  //     todo bloco tem id, e `indiceDoId` não acha índice em texto em lista
  //     nenhuma: o cursor nasceria morto E por cima teria apagado o cursor real
  //     da pessoa, que é o único registro de onde ela estava. Deixando-o intacto
  //     ela não fica pior do que estava, e a interação seguinte tenta de novo —
  //     arrumada a lista, o fluxo volta sozinho.
  //
  // ESTAS LINHAS NÃO TÊM TESTE, e é a mesma classe de risco que o comentário de
  // `cursorDaRetomada` (lib/steps.ts) descreve: trocar `retomada.destino` por
  // `retomada.portao + 1` aqui embaixo não acende luz em teste nenhum, porque a
  // função pura continuaria devolvendo a mesma coisa. O que existe contra isso é
  // o teste "A ARMADILHA SUMIU" (tests/steps.test.ts), que mede `interpretar`
  // nos DOIS índices e fixa a diferença: do destino sai o link, do `portão + 1`
  // sai a resposta rápida de novo, para sempre. Quem mexer aqui tem lá os dois
  // números.
  //
  // E uma diferença pequena, dita para não ser descoberta como surpresa: barrado
  // no portão de passagem, `interpretar` não chega a rodar, então os
  // `step_ignorado` desta lista não são registrados NESTA passagem. O throttle
  // de 10 minutos já os suprimiria na maioria dos casos, e a interpretação
  // seguinte os registra.
  if (retomada.portao !== null) {
    const portao = passoEsperado(auto.steps, retomada.portao);
    if (portao?.tipo !== "pedir_follow") {
      await logEventThrottled(
        account.ig_user_id,
        "portao_nao_avaliado",
        {
          automation_id: auto.id,
          contact_ig_id: contactIgId,
          // o portão que a `Retomada` mandou atravessar, e para onde o fluxo ia
          indice: retomada.portao,
          destino: retomada.destino,
        },
        10,
        { campo: "automation_id", valor: auto.id }
      );
      return;
    }
    const r = await resolverFollow(
      account, auto, contactIgId, portao, retomada.portao, contexto
    );
    if (r === "soltar") {
      // Solta em vez de gravar o cursor, e NÃO segue para o destino: o portão
      // não foi vencido. A pessoa deixa de ser capturada e volta a ser
      // alcançável por qualquer automação. O portão não volta a pedir — os cinco
      // pedidos são na vida —, mas a consulta à Meta continua acontecendo a cada
      // passagem: quem seguir o perfil passa na hora e tem o contador zerado.
      await limparCursor(account.ig_user_id, contactIgId);
      return;
    }
    if (r === "barrar") {
      await gravarCursor(
        account.ig_user_id, contactIgId, auto.id,
        identidadeDoPasso(portao, retomada.portao)
      );
      return;
    }
  }

  // A ÚNICA chamada de `interpretar` do motor, e ela é a fronteira entre as duas
  // metades do sistema nesta fase.
  //
  // `interpretar` passou a CAMINHAR O GRAFO: ela recebe as ligações e a
  // IDENTIDADE do bloco de partida, e a ordem do array não diz mais o que vem
  // depois. Quem calcula `retomada.destino`, porém, ainda fala em POSIÇÃO — as
  // quatro retomadas de lib/steps.ts devolvem número —, e a conversão de posição
  // para identidade é `identidadeNoIndice` (lib/steps.ts), pura e com teste.
  //
  // A conversão devolve null quando a posição não existe, e o caso é comum, não
  // defensivo: é o `+1` de quem estava parado no último bloco. `interpretar`
  // trata o null SAINDO CALADA — sem `ignorados` e sem sinalizador —, e o motor
  // limpa o cursor logo abaixo como em qualquer fim de fluxo. A razão de o sinal
  // ter sido removido está escrita no ramo `deBloco === null` de `interpretar`
  // (lib/steps.ts): ele dispara se e só se a pessoa passou o ÚLTIMO bloco, o que
  // é fim NORMAL na maioria das vezes, e os casos que são defeito de verdade são
  // de MONTAGEM — a conferência os pega no salvar, não na entrega.
  //
  // O QUE FICA EM ABERTO, e precisa estar dito porque é a metade que esta tarefa
  // não fechou: `retomada.destino` é aritmética de POSIÇÃO (`indice + 1`), e o
  // grafo não reproduz essa aritmética. Enquanto as ligações forem a corrente
  // que a migração gerou (bloco i → bloco i+1), as duas concordam em toda
  // entrada. No dia em que o editor deixar o dono desenhar um braço de verdade,
  // "o seguinte na lista" e "o destino da seta `sempre`" passam a ser blocos
  // diferentes, e é este argumento que fica errado — não a caminhada.
  const r = interpretar(
    auto.steps,
    auto.ligacoes,
    identidadeNoIndice(auto.steps, retomada.destino)
  );

  // Passo mal montado vira linha em Atividade, não exceção. Automação quebrada
  // não pode derrubar o webhook: a Meta reenviaria o evento por 36 horas.
  //
  // UMA linha por interpretação, com TODOS os ignorados dentro dela. As duas
  // decisões — juntar e limitar por janela — resolvem coisas diferentes:
  //
  // JUNTAR resolve a auto-supressão. Uma chamada por ignorado, dentro do laço,
  // se estrangulava sozinha: a primeira volta INSERE a linha do tipo, e da
  // segunda em diante, na MESMA interpretação, todas a encontram e desistem.
  // Uma automação com N passos quebrados reportava só o de menor índice, e como
  // a ordem do laço é estável os outros não apareciam NUNCA — perda permanente
  // de diagnóstico, não redução de ruído.
  //
  // A JANELA resolve a repetição entre eventos: os ignorados são recalculados a
  // cada interpretação, `executarFluxo` chama a si mesmo (portão vencido, e-mail
  // já conhecido) e o webhook aceita o que a Meta mandar — sem throttle o
  // diagnóstico virava o maior escritor da tabela.
  //
  // O que AINDA é suprimido, dito por inteiro: dentro de 10 minutos, a mesma
  // automação da mesma conta só grava uma vez. Se a lista for editada nesse
  // intervalo e passar a ignorar OUTROS passos, essa segunda leva não aparece
  // até a janela virar. Outra automação, ou outra conta, não é mais afetada — o
  // discriminador limita a janela a `automation_id` + `account_id`.
  if (r.ignorados.length) {
    await logEventThrottled(
      account.ig_user_id,
      "step_ignorado",
      { automation_id: auto.id, passos: r.ignorados },
      10,
      { campo: "automation_id", valor: auto.id }
    );
  }

  for (const acao of r.enfileirar) {
    const p = acao.passo;

    if (p.tipo === "pedir_follow") {
      // O portão é o único passo que consulta a Meta antes de decidir.
      const r = await resolverFollow(account, auto, contactIgId, p, acao.indice, contexto);
      // Passou: `interpretar` PAROU neste passo, então o resto da lista sequer
      // foi olhado — este é o último item que ele devolveu, e seguir o laço não
      // faria nada. Retoma do próximo índice, senão vencer o portão seria o fim
      // do fluxo e o link nunca chegaria a quem seguiu.
      if (r === "passou") return executarFluxo(account, auto, contactIgId, acao.indice + 1, contexto);
      if (r === "soltar") {
        // Solta em vez de gravar o cursor: a pessoa deixa de ser capturada por
        // este portão e volta a ser alcançável por qualquer automação. Ela não
        // recebe o link — o portão fez o trabalho dele —, e se reacionar a
        // automação depois, o portão roda de novo e solta de novo. Nunca prende.
        await limparCursor(account.ig_user_id, contactIgId);
        return;
      }
      // BARRADO: o cursor passa a ser o portão e o fluxo para nele. Passado o
      // limite, isto não acontece mais calado — esse caso é `soltar`, logo
      // acima, e era essa a captura que faltava resolver.
      //
      // O PEDIDO FOI ENFILEIRADO, e o verbo certo é esse, não "saiu".
      // `resolverFollow` chama `enqueue` antes de devolver `barrar`, mas
      // `enqueue` devolve um booleano que ninguém lê e o `on conflict do
      // nothing` engole a colisão em silêncio. Há caminho real que colide:
      // pedido nº1 sai; a pessoa segue e passa; `zerarTentativasFollow` zera o
      // contador; ela dá unfollow e volta ao portão; o contador volta a 1 e a
      // `followGateKey` — automação, contato, dia, tentativa — é a MESMA do
      // pedido nº1. O DM é descartado calado e o motor grava o cursor achando
      // que pediu.
      //
      // É comportamento PRÉ-EXISTENTE, e continua fora do alcance desta
      // correção: fechá-lo é trabalho na chave de deduplicação, não aqui. O que
      // esta linha deve ao leitor é não prometer o contrário.
      await gravarCursor(
        account.ig_user_id, contactIgId, auto.id,
        identidadeDoPasso(p, acao.indice)
      );
      return;
    }

    if (p.tipo === "pedir_email") {
      const rows = (await sql().query(
        `select email from contacts where account_id = $1 and ig_id = $2`,
        [account.ig_user_id, contactIgId]
      )) as { email: string | null }[];
      // Mesmo motivo do portão: o e-mail que já temos resolve este passo, e o
      // que vem depois dele só é visto numa nova interpretação.
      if (rows[0]?.email) {
        return executarFluxo(account, auto, contactIgId, acao.indice + 1, contexto);
      }
      // Quando o pedido de e-mail é o primeiro envio de uma execução nascida de
      // comentário, ele também tem que furar a janela: como DM comum seria
      // descartado e o fluxo morreria antes de mandar qualquer coisa.
      const comentario = gastarRespostaPrivada(contexto);
      await enqueue({
        account_id: account.ig_user_id,
        kind: comentario ? "private_reply" : "dm_email_ask",
        contact_ig_id: contactIgId,
        automation_id: auto.id,
        comment_id: comentario ?? undefined,
        payload: { text: p.texto },
        dedupe_key: comentario
          ? privateReplyKey(comentario)
          : emailAskKey(auto.id, contactIgId, dayBucket()),
      });
      await gravarCursor(
        account.ig_user_id, contactIgId, auto.id,
        identidadeDoPasso(p, acao.indice)
      );
      return;
    }

    await enfileirarPasso(account, auto, contactIgId, acao, contexto);
  }

  // Chegar aqui com um ponto de parada só acontece quando quem para é uma `dm`
  // de resposta rápida — portão e e-mail já retornaram acima. Ela espera o toque
  // da pessoa, e sem gravar o cursor o toque recomeçaria a lista do zero e
  // pararia no mesmo passo, para sempre.
  //
  // `r.pararEm` JÁ É A IDENTIDADE, e o cursor é gravado com ela direto.
  //
  // Aqui havia `identidadeDoPasso((auto.steps as unknown[])[r.pararEm],
  // r.pararEm)`: um cast SEM CONFERÊNCIA, sustentado por uma invariante de
  // `interpretar` que precisava de treze linhas de comentário para ser afirmada
  // — "ela devolve `pararEm: null` sempre que `steps` não é array, logo o cast é
  // seguro". A invariante continua valendo, mas ninguém mais depende dela: a
  // caminhada não tem índice a converter, porque ela nunca falou em índice.
  //
  // É a conversão que o comentário daquela linha avisava ser frágil, e ela sumiu
  // por deixar de existir, não por ter sido consertada.
  if (r.pararEm !== null) {
    await gravarCursor(account.ig_user_id, contactIgId, auto.id, r.pararEm);
    return;
  }

  // A CAMINHADA QUEBROU NO MEIO — `steps` que não é lista, ligação pendurada, ou
  // teto estourado — e aqui o cursor NÃO é tocado.
  //
  // É a mesma preferência que o ramo do portão não avaliado registra lá em cima:
  // "deixando-o intacto ela não fica pior do que estava". Lá o risco era
  // escrever um cursor que nasceria morto; aqui é APAGAR o único registro de
  // onde a pessoa estava por causa de uma seta quebrada — arrumada a seta, o
  // cursor intacto faz o fluxo voltar exatamente de onde parou, e o cursor
  // apagado não faz voltar de lugar nenhum.
  //
  // O PREÇO TEM DUAS METADES, e esta linha só paga a primeira: enquanto o dado
  // não for arrumado, cada mensagem da pessoa refaz a mesma caminhada e
  // reenfileira o trecho que vem ANTES da quebra. A `passoKey` colapsa isso
  // dentro do dia; virado o balde, o trecho sai de novo — e no ramo do teto não
  // custa nada, porque `interpretar` já devolve a lista de ações vazia.
  //
  // A SEGUNDA METADE É A CARA, e ela está escrita por inteiro junto da decisão,
  // no comentário de `cursorNoFim` (lib/steps.ts): cursor não nulo faz
  // `handleMessagingEvent` (mais abaixo neste arquivo) ler toda mensagem da
  // pessoa como resposta ao passo parado. É a mesma captura que este arquivo
  // recusa em "automação desativada não pode sequestrar o contato" — só que aqui
  // ela é aceita de propósito, por tempo indeterminado, e a única fuga é
  // `interrompeOFluxo`, que só cede a vez quando o bloco parado é `dm`.
  //
  // Quem decide isto é `interpretar` (lib/steps.ts, `cursorNoFim`), e não uma
  // condição escrita aqui: a distinção entre "o caminho acabou" e "o caminho
  // quebrou" é da caminhada, e regra dentro deste arquivo é a que nenhum teste
  // alcança.
  if (r.cursorNoFim === "manter") return;

  // A lista acabou: esta pessoa não está mais no meio de nada.
  await limparCursor(account.ig_user_id, contactIgId);
}

async function gravarCursor(
  accountId: string,
  contactIgId: string,
  automationId: string,
  passoId: string
) {
  await sql().query(
    `update contacts set flow_step_id = $3, flow_step_index = null, last_automation_id = $4
     where account_id = $1 and ig_id = $2`,
    [accountId, contactIgId, passoId, automationId]
  );
}

async function limparCursor(accountId: string, contactIgId: string) {
  await sql().query(
    `update contacts set flow_step_id = null, flow_step_index = null
     where account_id = $1 and ig_id = $2`,
    [accountId, contactIgId]
  );
}

// Lê o cursor JUNTO com a automação dona dele.
//
// O bloco sozinho não quer dizer nada: a identidade só é única dentro de UMA
// lista de passos, e cada automação tem a sua. É a dupla que responde "qual
// automação, em que ponto" — o ramo de texto de `handleMessagingEvent` já lia
// assim.
//
// A dupla NÃO é garantida por `gravarCursor` sozinho, e afirmar isso seria
// falso: `last_automation_id` tem três escritores, e dois deles escrevem só ele
// — os `upsertContact` do gatilho de comentário e do gatilho de texto, que
// deixam o cursor intocado. O que mantém a dupla coerente é o PAR: os dois são
// imediatamente seguidos de um `executarFluxo`, e todo caminho de
// `executarFluxo` termina em `gravarCursor` (que escreve os dois campos) ou em
// `limparCursor`. A invariante é da sequência escrita-seguida-de-execução, não
// de uma função só; quem inserir uma escrita de `last_automation_id` sem
// execução logo depois a quebra.
//
// Ler só o cursor era o defeito: quem recebeu o botão da automação A, foi
// interrompido pela B e depois tocou no botão antigo de A tinha o cursor de B
// aplicado à lista de A. Eram dois estragos, e ler a dupla mata UM:
//
//   SUMIU — cursor de B que resolve dentro da lista de A pulava passos de A, o
//     portão de follow inclusive, e entregava o link a quem não segue. Com
//     `cursorDesta` (lib/steps.ts), o cursor emprestado nunca mais é aplicado.
//   CONTINUA DE PÉ — o lugar da pessoa em B se perde, e pelas DUAS formas, que
//     coexistem. A comum é a sobrescrita: `executarFluxo(A, ...)` termina em
//     `gravarCursor(A, ...)`, que escreve `flow_step_id` sem olhar de quem era.
//     A outra é o apagamento, exatamente como antes: se o portão de A passa e a
//     lista de A termina, `executarFluxo` cai no `limparCursor` (logo acima) e o
//     cursor de B some. Qual das duas acontece depende só de a lista de A
//     terminar ou parar; o resultado para B é o mesmo.
//
// A causa do que continua é outra: `gravarCursor` e `limparCursor` não conferem
// de quem é o cursor antes de escrever — há um cursor só por contato, e ele é do
// último a escrever. Consertar isso é mudar a ESCRITA do cursor (dono, ou um
// cursor por automação), e ramo de cursor já produziu defeito pior que o
// original duas vezes nesta branch. Fica para uma mudança própria, com o
// desenho decidido antes: aqui seria correção de escrita embutida numa onda de
// correção de leitura.
async function lerCursor(accountId: string, contactIgId: string): Promise<Cursor> {
  const rows = (await sql().query(
    `select flow_step_id, flow_step_index, last_automation_id from contacts
     where account_id = $1 and ig_id = $2`,
    [accountId, contactIgId]
  )) as {
    flow_step_id: string | null;
    flow_step_index: number | null;
    last_automation_id: string | null;
  }[];
  const r = rows[0];
  // A CONCLUSÃO PRIMEIRO, porque o resto do comentário já saiu daqui com a
  // informação invertida: o `String()` abaixo NÃO faz o cursor velho voltar a
  // funcionar. Depois da migração (`scripts/dar-ids-aos-passos.mjs`), todo
  // bloco de toda automação gravada tem id, e `identidadeDoPasso` (lib/steps.ts)
  // só devolve o índice para bloco SEM id. Então `indiceDoId` não acha "2" em
  // lista nenhuma e o cursor velho resolve para NULL. Na prática esta reserva
  // vale só para automação que a migração não alcançou.
  //
  // O `String()` está certo mesmo assim, e é só isso que ele é: a forma. Quem
  // foi gravado antes desta fase tem só `flow_step_index`, e a identidade de um
  // bloco sem id é justamente o índice em texto — o valor antigo já está na
  // forma da coluna nova, não precisa de conversão nenhuma além dessa.
  // `gravarCursor` zera a coluna velha ao escrever a nova, para as duas nunca
  // discordarem. "Forma certa" não é "resolve", e é a segunda que falta.
  //
  // É aceitável, e o motivo é a DIREÇÃO da falha, não a raridade dela: cursor
  // que não resolve nunca pula passo. `retomadaDoBotao` volta ao zero (a lista
  // reinicia e para na primeira parada dura, com a `passoKey` segurando o dia),
  // `retomadaDoFollow` cai no portão, e o ramo de texto limpa o cursor e deixa
  // o evento seguir. Nenhum dos três atravessa o portão de follow — o estrago
  // possível é mensagem repetida, não link para quem não segue.
  //
  // Converter os cursores velhos para id seria o conserto de verdade, e ele NÃO
  // cabe aqui: exige ler a lista de cada automação para traduzir índice em id,
  // ou seja escrita no banco. O script existe — `scripts/converter-cursores.mjs`
  // —, e rodá-lo é passo de DEPLOY, não de código.
  return {
    passoId: r?.flow_step_id ?? (r?.flow_step_index != null ? String(r.flow_step_index) : null),
    automationId: r?.last_automation_id ?? null,
  };
}

// Enfileira um passo que não espera resposta.
async function enfileirarPasso(
  account: Account,
  auto: Automation,
  contactIgId: string,
  acao: AcaoEnfileirar,
  contexto: ContextoGatilho
) {
  const p = acao.passo;
  const base = {
    account_id: account.ig_user_id,
    contact_ig_id: contactIgId,
    automation_id: auto.id,
    delaySeconds: acao.atrasoSegundos,
  };

  if (p.tipo === "dm") {
    // UM tipo de passo, TRÊS mensagens diferentes — e QUEM DECIDE QUAL NÃO É
    // ESTA LINHA. Aqui havia `const respostaRapida = Boolean(p.botao_label) &&
    // !p.url`, uma segunda cópia da regra que `esperaResposta` (lib/steps.ts)
    // também escrevia, e as duas divergiram: com `botoes` no bloco, a de lá
    // passou a PARAR o fluxo e esta continuou montando texto puro — o motor
    // parava esperando um toque que ele mesmo não entregava. O motivo por
    // inteiro, com a medição, está em `envioDaDm` (lib/steps.ts).
    //
    // A pergunta agora é feita, não repetida. O que cada forma vira aqui:
    //   `resposta_rapida` → `dm_welcome`, o único caminho do dreno que monta
    //     `quick_replies` (`processItem`, lib/queue-drain.ts). O payload volta
    //     no webhook como `AUTO:<id da automação>:<id do bloco>` (`lerPayload`,
    //     lib/steps.ts), e é ele que `handleMessagingEvent` lê para decidir de
    //     onde retomar — o cursor do contato manda, este bloco é a reserva.
    //   `link` → `dm_link`, que `linkMessage` (lib/ig.ts) transforma em template
    //     de botão. Vale também sem rótulo: aí o título cai no padrão "Abrir
    //     link" do próprio `linkMessage`, em vez de a url desaparecer da
    //     mensagem.
    //   `texto` → `dm_link` sem url, que é como o mesmo `linkMessage` devolve
    //     só `{ text }`.
    //
    // As duas últimas dividem `kind` e payload de propósito: o que as separa é a
    // presença da url DENTRO do mesmo payload, e é `linkMessage` quem lê isso.
    const envio = envioDaDm(p);

    // ...e sobre essas três formas vem uma quarta decisão, que é de ENTREGA, não
    // de conteúdo: a primeira mensagem de uma execução disparada por comentário
    // sai como `private_reply`, presa ao id do comentário. É o que fura a janela
    // de 24h (ver `gastarRespostaPrivada`) — sem isso ela é descartada como
    // `skipped` e a automação por comentário não entrega nada.
    //
    // O `payload` NÃO muda por causa disso, e é isso que preserva o botão: o
    // dreno só desvia para `linkMessage` quando o tipo é `dm_link`/`dm_reminder`
    // ou quando há url; fora daí, rótulo + payload de resposta rápida viram
    // `quick_replies`. Então a resposta privada sai com o mesmo botão e o mesmo
    // `AUTO:<id da automação>:<id do bloco>` que retoma o fluxo quando a
    // pessoa toca.
    const comentario = gastarRespostaPrivada(contexto);

    await enqueue({
      ...base,
      kind: comentario
        ? "private_reply"
        : envio.forma === "resposta_rapida"
          ? "dm_welcome"
          : "dm_link",
      comment_id: comentario ?? undefined,
      payload:
        envio.forma === "resposta_rapida"
        ? {
            text: p.texto,
            // O rótulo vem do `envio`, e não de `p.botao_label`: é o mesmo
            // valor, mas aqui ele chega como `string` NÃO OPCIONAL, em vez de um
            // campo que este ramo teria de afirmar existir e não ser vazio.
            //
            // O TIPO DIZ `string`, E O RUNTIME NÃO GARANTE ISSO — a frase antiga
            // dizia "garantido pelo tipo" e essa garantia não existe. O ramo `dm`
            // de `conferir` (lib/steps.ts) valida só `texto` e devolve
            // `p as Passo`, então `botao_label` entra CRU do `jsonb`: pode ser
            // número, objeto, o que estiver gravado na coluna. `envioDaDm` só
            // exige que ele seja verdadeiro, e o cast é que o chama de `string`.
            // A exposição é anterior a esta linha e não se conserta aqui — o que
            // esta linha pode fazer é não mentir sobre ela.
            quick_reply_label: envio.rotulo,
            // O payload leva o BLOCO junto da automação, e é o que faz o toque
            // dizer de qual botão ele veio. Sem isso, dois botões antigos da
            // mesma automação na mesma conversa são indistinguíveis, e o motor
            // só tem o cursor — que diz onde a pessoa parou, não no que tocou.
            //
            // A identidade é a MESMA que entra na `passoKey` e no cursor
            // (`identidadeDoPasso`), de propósito: é ela que `indiceDoId`
            // procura de volta lá em `handleMessagingEvent`.
            quick_reply_payload: `AUTO:${auto.id}:${identidadeDoPasso(p, acao.indice)}`,
          }
        : { text: p.texto, button_label: p.botao_label ?? null, url: p.url ?? null },
      // A chave da resposta privada é a mesma do motor antigo: o id do
      // comentário. É ele que garante uma única resposta privada por comentário,
      // que é exatamente o que a Meta permite — `passoKey` (por passo e por dia)
      // deixaria dois eventos do mesmo comentário virarem dois envios, e o
      // segundo falharia.
      dedupe_key: comentario
        ? privateReplyKey(comentario)
        : passoKey(
            auto.id,
            contactIgId,
            identidadeDoPasso(acao.passo, acao.indice),
            dayBucket()
          ),
    });
    return;
  }

  if (p.tipo === "resposta_publica") {
    // Só faz sentido quando o gatilho foi comentário: sem o id, não há o que
    // responder. Numa automação de DM este passo simplesmente não acontece —
    // e isso é comportamento, não erro, então não vira `step_ignorado`.
    if (!contexto.commentId) return;
    // O sorteio pode sair vazio: `conferir` (lib/steps.ts) só exige que a lista
    // não esteja vazia, então `{"textos":[""]}` passa na validação. A Meta
    // recusa comentário sem texto com 400, e o item viraria `failed` em
    // Atividade sem que ninguém tivesse escrito nada errado de propósito.
    // Melhor não enfileirar — a resposta pública é enfeite, não o fluxo.
    const texto = pickRandom(p.textos);
    if (!texto?.trim()) return;
    await enqueue({
      ...base,
      kind: "comment_reply",
      comment_id: contexto.commentId,
      payload: { text: texto },
      dedupe_key: commentReplyKey(contexto.commentId),
    });
    return;
  }

  if (p.tipo === "reagir_story") {
    // Mesma lógica: sem mensagem para reagir, o passo não acontece.
    if (!contexto.messageId) return;
    await enqueue({
      ...base,
      kind: "story_reaction",
      payload: { message_id: contexto.messageId, reaction: p.emoji },
      dedupe_key: storyReactionKey(contexto.messageId),
    });
    return;
  }
}

// Zera o contador de pedidos de follow deste contato.
//
// Sem isto o contador só sobe: `clearFollowState` saiu junto com o fluxo antigo
// e nada mais repõe o valor.
//
// O QUE ERA, e vale ficar registrado porque foi o defeito mais caro desta fase:
// o contador nunca zerava por conta própria, só quando o portão PASSAVA. Passado
// o `MAX_FOLLOW_REQUESTS`, o motor parava de mandar o pedido E CONTINUAVA
// gravando o cursor no portão. A pessoa ficava capturada — o ramo de texto lia
// toda mensagem dela como resposta ao portão, e `interrompeOFluxo` só cede a vez
// a outra automação quando o passo parado é `dm`, então nem a palavra-chave de
// outra automação a alcançava. Ela parava de ser cobrada, parava de receber
// explicação, e ninguém a alcançava. A revisão final mediu 4.078 estados
// alcançáveis sem saída, todos desta forma.
//
// O QUE PASSOU A SER, e é UMA mudança só: esgotadas as tentativas, o portão
// SOLTA o cursor em vez de gravá-lo (`oQuePortaoFaz`, lib/steps.ts). A pessoa
// nunca mais fica presa — no máximo `MAX_FOLLOW_REQUESTS` pedidos, e passado
// isso ela é alcançável por qualquer automação. A frase é literal: com a
// soltura, não existe estado em que o portão pare de cobrar e continue segurando.
//
// CHEGOU A HAVER UM CONTADOR POR DIA JUNTO, e ele saiu porque IMPEDIA esta
// soltura de acontecer. Quem manda uma mensagem por dia recomeça o contador em 1
// toda vez, nunca chega ao limite, nunca é solto — e, com o portão pedindo de
// novo a cada dia, passa a receber um DM diário indefinidamente. "5 na vida"
// virava "5 por dia, para sempre", que é o oposto do que este limite existe para
// fazer. A justificativa dada para ele — sem contador por dia a pessoa nunca
// mais receberia o link, mesmo seguindo depois — também não se sustenta: ver o
// parágrafo seguinte.
//
// O QUE CONTINUA VALENDO, e é o que torna a segunda chance gratuita: a
// reconsulta nunca foi cortada pelo limite. `resolverFollow` consulta a Meta
// ANTES de olhar o contador, então toda passagem pelo portão pergunta de novo —
// quem seguir passa na hora e é zerado aqui, com o contador esgotado ou não. E a
// saída sem banco continua a mesma: seguir o perfil e mandar QUALQUER mensagem
// de texto, que retoma do próprio portão. O botão é conveniência, não a única
// porta.
//
// O QUE SOBRA, dito com a medida certa: o contador é por CONTATO, não por
// automação (`follow_attempts` é coluna de `contacts`). Quem gastou os cinco
// pedidos no portão da automação A não recebe o pedido da B — é solto por ela
// também, e volta a receber pedido só depois de passar por um portão, que é o
// que zera o contador. Isto NÃO muda aqui, e mudar exigiria contador por
// (contato, automação), ou seja, outra tabela.
//
// A condição no fim evita escrever à toa em quem já está zerado, que é o caso
// comum: todo passo de follow vencido passaria por aqui.
async function zerarTentativasFollow(accountId: string, contactIgId: string) {
  await sql().query(
    `update contacts set follow_attempts = 0
     where account_id = $1 and ig_id = $2 and follow_attempts > 0`,
    [accountId, contactIgId]
  );
}

// Resolve o passo de follow: consulta a Meta e decide o que o fluxo faz.
//
// TRÊS respostas, e a terceira é a mudança desta tarefa:
//
//   `passou`  — segue, ou a Meta não informou. O fluxo continua.
//   `barrar`  — não segue, e ainda cabe pedido. O pedido foi ENFILEIRADO (com a
//                ressalva do `on conflict` escrita no `enqueue` mais abaixo) e
//                quem chama grava o cursor no portão: a pessoa para nele.
//   `soltar`  — não segue, e as tentativas acabaram. NÃO há pedido a
//                enfileirar, então segurar o cursor seria segurar calado. Quem
//                chama LIMPA o cursor, e a pessoa volta a ser alcançável.
//
// A decisão entre `barrar` e `soltar` é de `oQuePortaoFaz` (lib/steps.ts), que é
// pura e testada. Aqui fica o efeito, e a contagem — que é SQL, pelo motivo
// escrito no `update` mais abaixo.
async function resolverFollow(
  account: Account,
  auto: Automation,
  contactIgId: string,
  // O `id` entra no tipo porque o payload do botão passou a carregá-lo: sem ele
  // declarado, `identidadeDoPasso(passo, indice)` lá embaixo lê uma propriedade
  // que o tipo diz não existir e cai SEMPRE no índice — o botão voltaria a
  // nomear a posição, e o motivo desta fase se perderia sem um erro sequer.
  passo: { id?: string; texto: string; botao_label: string },
  indice: number,
  contexto: ContextoGatilho
): Promise<"passou" | "barrar" | "soltar"> {
  const segue = await checkFollowsAccount(contactIgId, account.access_token);

  if (segue === null) {
    // A Meta não informou. Barrar aqui deixaria TODA a base presa caso o campo
    // fique indisponível — e o dono do painel só descobriria pelos clientes
    // reclamando. Libera e registra, para o erro aparecer em Atividade.
    await logEvent(account.ig_user_id, "follow_check_unavailable", {
      contact_ig_id: contactIgId,
      automation_id: auto.id,
      // qual passo da lista foi liberado sem confirmação
      indice,
    });
    await zerarTentativasFollow(account.ig_user_id, contactIgId);
    return "passou";
  }
  if (segue) {
    await zerarTentativasFollow(account.ig_user_id, contactIgId);
    return "passou";
  }

  // Conta o pedido NUMA INSTRUÇÃO SÓ — ler e depois escrever não serve —, e a
  // atomicidade é a única coisa que sobrou da tentativa do contador por dia.
  // Ela não é preciosismo: a versão que lia e depois escrevia deixava duas
  // mensagens chegando juntas lerem o mesmo valor, escreverem o mesmo valor e
  // gerarem a MESMA `followGateKey` — a fila colapsava as duas num envio, e o
  // contador subia menos que as interações. `follow_attempts + 1 returning` é a
  // forma original, e ela já era atômica.
  //
  // NÃO HÁ VIRADA DE DIA aqui, e não deve haver: o contador é na vida, e o
  // porquê está em `oQuePortaoFaz` (lib/steps.ts). Ele só volta a zero em
  // `zerarTentativasFollow`, quando a pessoa PASSA pelo portão.
  //
  // O `hoje` abaixo é só da chave de deduplicação — `followGateKey` guarda o
  // envio dentro do balde de dia, e o balde tem que ser o mesmo de `diaDaChave`
  // (lib/dedupe.ts), que é o que `dayBucket` garante.
  const hoje = dayBucket();
  const linhas = (await sql().query(
    `update contacts set follow_attempts = follow_attempts + 1
     where account_id = $1 and ig_id = $2
     returning follow_attempts`,
    [account.ig_user_id, contactIgId]
  )) as { follow_attempts: number }[];

  const tentativa = linhas[0]?.follow_attempts ?? 1;

  // A decisão é sobre quantos pedidos já tinham saído ANTES deste — por isso
  // `tentativa - 1`. Percorridos os valores, com `MAX_FOLLOW_REQUESTS` = 5:
  // `returning` 1, 2, 3, 4 e 5 dão 0, 1, 2, 3 e 4, e todos mandam pedido;
  // `returning` 6 dá 5 e é o PRIMEIRO que solta. Cinco pedidos, soltura no
  // sexto.
  //
  // O contador sobe também quando o portão solta, e cresce sem teto. É
  // inofensivo: a única comparação que existe é contra o máximo, e depois do
  // máximo toda passagem solta do mesmo jeito. Não há outro leitor desta coluna
  // no sistema — `resolverFollow` é o único.
  if (oQuePortaoFaz(tentativa - 1, MAX_FOLLOW_REQUESTS) === "soltar") {
    // Parou de pedir, então para de segurar. Quem chama solta o cursor.
    //
    // Registrado em Atividade porque, sem isso, o dono do painel vê a pessoa
    // simplesmente sumir do fluxo — que é exatamente o sintoma que esta mudança
    // existe para acabar.
    //
    // COM THROTTLE, e o motivo é que este evento nasce de um ESTADO que se
    // repete, não de uma transição: quem foi solto fica sem cursor, e sem cursor
    // toda mensagem dela cai no fallback, que chega ao portão, que solta de
    // novo. Sem throttle seria uma linha por mensagem recebida, por dias — a
    // mesma razão que o `portao_nao_avaliado` aqui do lado já registra.
    //
    // O DISCRIMINADOR É O CONTATO, e não a automação. O evento existe para o
    // dono não ver A PESSOA sumir do fluxo, então a janela tem que ser por
    // pessoa: discriminando por `automation_id`, o primeiro contato solto
    // gravaria a linha e todos os outros soltos nos 10 minutos seguintes não
    // gravariam nada — a mesma perda de diagnóstico que o comentário de
    // `logEventThrottled` descreve, só que entre contatos.
    await logEventThrottled(
      account.ig_user_id,
      "portao_soltou",
      // `tentativas` e não `tentativas_hoje`: o contador é na vida.
      { contact_ig_id: contactIgId, automation_id: auto.id, tentativas: tentativa - 1 },
      10,
      { campo: "contact_ig_id", valor: contactIgId }
    );
    return "soltar";
  }

  // Mesma regra do passo `dm`: se o pedido de follow é o primeiro envio de uma
  // execução nascida de comentário, ele sai como resposta privada. É o único
  // jeito de ele chegar — e ele é um portão, então sem ele o fluxo inteiro
  // fica parado esperando um toque num botão que nunca foi entregue.
  const comentario = gastarRespostaPrivada(contexto);
  await enqueue({
    account_id: account.ig_user_id,
    kind: comentario ? "private_reply" : "dm_follow_gate",
    contact_ig_id: contactIgId,
    automation_id: auto.id,
    comment_id: comentario ?? undefined,
    payload: {
      text:
        tentativa === 1
          ? passo.texto
          : "Ainda não consegui ver você na minha lista de seguidores 👀 Segue lá e toca no botão de novo.",
      quick_reply_label: passo.botao_label,
      // Mesma razão do `AUTO:` — e aqui ela paga uma dívida nomeada: o
      // comentário de `indiceDoPortao` (lib/steps.ts) dizia que `FOLLOW:<id>`
      // nomeia a automação e não o PORTÃO, de modo que numa lista com dois
      // portões o toque no segundo retomava no primeiro. Com o bloco no
      // payload, o toque nomeia o portão em que a pessoa tocou.
      quick_reply_payload: `FOLLOW:${auto.id}:${identidadeDoPasso(passo, indice)}`,
    },
    dedupe_key: comentario
      ? privateReplyKey(comentario)
      : followGateKey(auto.id, contactIgId, hoje, tentativa),
  });
  return "barrar";
}

// Já houve boas-vindas recentes (e o link ainda não saiu)?
// Evita reenviar o link quando a pessoa só manda "obrigado" depois.
//
// Os dois `exists` voltaram a olhar coisas diferentes agora que o passo `dm`
// escolhe o tipo pela forma: o `dm` de resposta rápida (rótulo, sem url) é
// `dm_welcome` e o de link é `dm_link`, exatamente a distinção que esta consulta
// sempre pressupôs. Enquanto todo passo `dm` virava `dm_link`, `welcomed` ficava
// sempre falso para tráfego novo e este fallback não disparava.
//
// `private_reply` na lista não é só compatibilidade com as linhas antigas: é
// como as boas-vindas de um fluxo disparado por comentário são gravadas HOJE
// (ver `gastarRespostaPrivada`). Tirá-la daqui faria `welcomed` ser sempre falso
// justamente para o gatilho mais usado do produto.
async function shouldFallbackFollowup(
  accountId: string,
  automationId: string,
  contactIgId: string
): Promise<boolean> {
  const rows = (await sql().query(
    `select
       exists(
         select 1 from queue
         where account_id = $1 and contact_ig_id = $2 and automation_id = $3
           and kind in ('private_reply','dm_welcome') and status = 'sent'
           and sent_at > now() - interval '7 days'
       ) as welcomed,
       exists(
         select 1 from queue
         where account_id = $1 and contact_ig_id = $2 and automation_id = $3
           and kind = 'dm_link' and status in ('pending','sending','sent')
           and created_at > now() - interval '7 days'
       ) as linked`,
    [accountId, contactIgId, automationId]
  )) as { welcomed: boolean; linked: boolean }[];
  return Boolean(rows[0]?.welcomed) && !rows[0]?.linked;
}

export async function handleCommentEvent(entryId: string | undefined, value: CommentValue) {
  const account = await resolveAccount(entryId);
  if (!account) return;
  const fromId = value.from?.id;
  const commentId = value.id;
  if (!fromId || !commentId) return;
  // ignora comentários da própria conta (senão a resposta pública vira loop)
  if (fromId === account.ig_user_id) return;

  await logEvent(account.ig_user_id, "comment", value);

  const automations = await activeAutomations(account.ig_user_id);
  const auto = findMatch(automations, "comment", value.text ?? "", value.media?.id);
  if (!auto) return;

  await upsertContact(account.ig_user_id, fromId, {
    username: value.from?.username ?? null,
    last_automation_id: auto.id,
  });

  // Não há enfileiramento de boas-vindas aqui, e a ausência é de propósito: a
  // mensagem de boas-vindas virou um passo `dm` da lista (o formulário gravava
  // `welcome_text` como o primeiro passo; hoje é um bloco como os outros),
  // então quem a envia é `executarFluxo`.
  // O `enqueue` de `private_reply` lido da coluna `auto.welcome_text` continuava
  // aqui por resíduo da migração, e o resultado era a pessoa receber a mesma
  // mensagem DUAS vezes — uma por coluna, outra por passo. As chaves de
  // deduplicação são diferentes (`privateReplyKey` por comentário contra
  // `passoKey` por passo/dia), então nada barrava a segunda.
  //
  // O resto do fluxo é a lista: a resposta pública deixou de ser um caso à
  // parte lido de `public_replies` e virou um passo como qualquer outro.
  //
  // O id do comentário vai junto por DOIS motivos. O primeiro é a resposta
  // pública, que sem ele não teria o que responder. O segundo é a entrega: é
  // esse id que faz a primeira mensagem sair como resposta privada e furar a
  // janela de 24h (ver `gastarRespostaPrivada`). Sem ele, esta automação
  // enfileira tudo como DM comum e o dreno descarta tudo, em silêncio.
  await executarFluxo(account, auto, fromId, 0, { commentId });
}

export async function handleMessagingEvent(entryId: string | undefined, ev: MessagingEvent) {
  const account = await resolveAccount(entryId);
  if (!account) return;
  const msg = ev.message;
  const senderId = ev.sender?.id;
  if (!msg || !senderId) return;

  // Mensagem que a PRÓPRIA conta enviou — o "eco" da Meta. Acontece quando
  // alguém responde pelo Instagram do celular, ou por outra ferramenta.
  //
  // A automação continua ignorando: reagir à própria mensagem viraria laço. Mas
  // ela é gravada antes de sair daqui, porque é METADE da conversa. A API do
  // Instagram devolve só as 20 mensagens mais recentes de cada conversa, então
  // o que não for gravado na hora não é recuperável depois — não existe
  // importar histórico.
  if (msg.is_echo || senderId === account.ig_user_id) {
    await logEvent(account.ig_user_id, "message_sent", ev);
    return;
  }

  const isStoryReply = Boolean(msg.reply_to?.story);
  const isQuickReply = Boolean(msg.quick_reply?.payload);
  const type = isQuickReply ? "quick_reply" : isStoryReply ? "story_reply" : "message";
  await logEvent(account.ig_user_id, type, ev);

  // Qualquer mensagem recebida abre/renova a janela de 24h
  const profile = await fetchProfileFields(account.ig_user_id, senderId, account.access_token);
  await upsertContact(account.ig_user_id, senderId, { ...profile, last_reply_at: new Date() });

  // Toque num botão de resposta rápida → segue o fluxo
  if (isQuickReply) {
    // As DUAS formas de payload são lidas pela mesma função (`lerPayload`,
    // lib/steps.ts), e as duas são finais — a antiga não é dívida a limpar. Ver
    // o comentário de lá: um botão entregue vive na conversa da pessoa
    // indefinidamente.
    //
    // Onde a lista retoma é decisão pura, e ela mora em `retomadaDoBotao` e
    // `retomadaDoFollow` (lib/steps.ts) — com o porquê de cada ramo e com teste.
    // Aqui eram expressões soltas dentro de `server-only`, que nenhum teste
    // alcança, e foi uma delas que entregou o link a quem não segue.
    //
    // Os dois ramos são uma chamada cada de propósito: a assimetria entre eles é
    // regra de produto — o `AUTO:` sem nada a afirmar começa do zero, o
    // `FOLLOW:` cai no portão —, e regra de produto sem teste foi o que quebrou
    // duas vezes nesta branch.
    const p = lerPayload(msg.quick_reply!.payload);
    if (p) {
      const auto = await loadAutomation(account.ig_user_id, p.automationId);
      if (auto) {
        // COM BOTÃO (`AUTO:<automação>:<bloco>:<botão>`), a bifurcação decide
        // sozinha — e NÃO passa pelo cursor. Esta é a medição que a Tarefa 3
        // pediu, e ela muda a regra:
        //
        // "O CURSOR MANDA; o PAYLOAD é RESERVA" (`cursorDaRetomada`, abaixo) foi
        // escrita para a FILA: ali o payload só respondia "de qual bloco
        // continuar", e qualquer resposta rápida da lista servia igual — a
        // aritmética era a mesma para todo mundo, `indice + 1`. Nesse mundo,
        // preferir o cursor fazia sentido: ele é a informação mais recente.
        //
        // Com bloco de vários botões (Tarefa 4), a pergunta deixa de ser "de
        // qual bloco continuar" e passa a ser "qual ligação SAI DESTE botão
        // específico" — e uma ligação de botão é `{de: <bloco que o emitiu>,
        // quando: {botao: <este id>}}`. O bloco que emitiu o botão é dado
        // NO MOMENTO DO ENVIO e gravado no próprio payload; nada no cursor do
        // contato guarda essa informação, porque o cursor fala de onde a
        // pessoa ESTÁ agora, não de qual bloco mandou qual botão no passado.
        //
        // Se este ramo usasse "cursor manda" (isto é, buscasse a ligação a
        // partir do bloco do CURSOR em vez do bloco do PAYLOAD), um botão
        // antigo tocado depois de a pessoa já ter avançado por outro caminho
        // buscaria a ligação no bloco ERRADO — o de onde ela está agora, que
        // não é o bloco que desenhou aquele botão — e o toque não acharia
        // ligação nenhuma (ou, pior, coincidiria com o id de um botão de
        // outro menu). Um botão que a pessoa vê na tela, tocável, deixaria de
        // fazer efeito, calado, sempre que ela tivesse seguido em frente
        // antes de tocar — que é justamente o caso comum de um botão entregue
        // há tempo, com toque atrasado.
        //
        // A REGRA AQUI, então, é a oposta: o payload manda, porque só ele
        // sabe de qual bloco este botão é. O cursor nem é lido neste ramo — a
        // consulta que `cursorDaRetomada` faz é dispensável quando a origem
        // já está afirmada pelo próprio toque.
        if (p.prefixo === "AUTO" && p.botaoId !== null && p.passoId !== null) {
          const destino = ligacaoEscolhida(auto.ligacoes, p.passoId, {
            tipo: "botao",
            botao: p.botaoId,
          });
          const indice = destino === null ? null : indiceDoId(auto.steps, destino);
          // Sem ligação (botão órfão) ou bloco de destino que sumiu da lista:
          // nada a entregar. O silêncio é o mesmo de `ligacaoEscolhida` — não
          // afirma o que não sabe, e não inventa caminho.
          //
          // `executarFluxo` recebe NÚMERO, não `Retomada`, e é de propósito: o
          // número cai no ramo `{portao: null, destino}`, sem passar pela
          // REGRA DO PORTÃO (`atravessandoOPortao`, lib/steps.ts). Essa regra
          // existe para consertar um jeito específico de errar — a aritmética
          // `indice + 1` podia PULAR por cima de um `pedir_follow` que ficasse
          // entre a posição antiga e a nova, entregando o que vem depois a
          // quem não segue. Aqui não há salto: `destino` é o próximo passo do
          // GRAFO, um vizinho direto do bloco do botão, e `interpretar`
          // caminha ligação por ligação, visitando e conferindo cada bloco do
          // caminho — um `pedir_follow` nesse caminho não é saltado, é
          // encontrado, e o fluxo para nele como em qualquer outra parada.
          if (indice !== null) await executarFluxo(account, auto, senderId, indice);
          return;
        }

        // SEM BOTÃO (as duas formas antigas), o comportamento é o de sempre: O
        // CURSOR MANDA; o bloco do payload é RESERVA. A escolha entre os dois
        // é pura e mora em `cursorDaRetomada` (lib/steps.ts), com o porquê de
        // cada ramo e com teste — aqui ela era uma expressão solta, e uma
        // expressão solta com a ordem invertida foi o defeito desta fase.
        //
        // Que ela viva LÁ e não aqui é o ponto, e o comentário de
        // `cursorDaRetomada` explica por quê: teste de função pura não vê o
        // motor trocar o argumento que passa para ela. Enquanto a escolha estiver
        // dentro de `server-only`, trocá-la não acende luz em teste nenhum.
        //
        // O cursor passa a ser lido SEMPRE, e não só quando o payload não traz
        // bloco. É uma consulta a mais por toque de botão, e é o preço de o
        // cursor mandar: sem ler, não há como saber se ele serve.
        const cursor = cursorDaRetomada(
          await lerCursor(account.ig_user_id, senderId),
          auto.id,
          p.passoId,
          auto.steps
        );
        const de =
          p.prefixo === "AUTO"
            ? retomadaDoBotao(cursor, auto.id, auto.steps)
            : // "Já sigo!" — `resolverFollow` consulta a API de novo, então só
              // passa quem realmente seguir.
              retomadaDoFollow(cursor, auto.id, auto.steps);
        await executarFluxo(account, auto, senderId, de);
      }
    }
    return;
  }

  const text = msg.text ?? "";

  // A palavra-chave é resolvida ANTES do cursor, embora só seja usada depois
  // dele: o ramo do cursor precisa saber se esta mensagem é, na verdade, o
  // gatilho de outra automação (ver ali embaixo).
  const automations = await activeAutomations(account.ig_user_id);
  const trigger = isStoryReply ? "story" : "dm";
  const auto = findMatch(automations, trigger, text, msg.reply_to?.story?.id);

  // Esta pessoa está parada em algum passo?
  //
  // Pela FUNÇÃO, e não por consulta solta como era aqui: a consulta duplicava
  // `lerCursor` e agora divergiria dela — ela lia só `flow_step_index`, que
  // `gravarCursor` deixou de escrever, e este ramo ficaria cego para todo cursor
  // gravado a partir desta fase.
  const cursor = await lerCursor(account.ig_user_id, senderId);
  const idParado = cursor.passoId;
  if (idParado !== null) {
    const autoParada = cursor.automationId
      ? await loadAutomation(account.ig_user_id, cursor.automationId)
      : undefined;

    // Sem automação carregável não há passo para retomar — ela foi desativada
    // ou apagada. Voltar daqui deixaria o `flow_step_id` gravado PARA
    // SEMPRE, porque nada mais o limpa: a pessoa ficaria surda a toda palavra-
    // chave, de toda automação, até alguém mexer no banco. Automação desativada
    // não pode sequestrar o contato: limpa o cursor e deixa o evento seguir.
    if (!autoParada) {
      await limparCursor(account.ig_user_id, senderId);
    } else {
      // Onde, na lista de HOJE, está o bloco em que a pessoa parou. Uma vez só:
      // todo o resto do ramo trabalha com o índice, porque `passoEsperado` e
      // `executarFluxo` continuam falando em posição — é o cursor que deixou de
      // falar, não o interpretador.
      const indiceParado = indiceDoId(autoParada.steps, idParado);
      // Bloco apagado depois de o cursor ser gravado: não há passo para
      // retomar, então o cursor sai da frente e o evento segue o fluxo normal.
      // Era o `índice que não existe mais` do caso abaixo, e sai de lá porque
      // agora é distinguível — e ficou raro: com id, só apagar aquele bloco.
      if (indiceParado === null) {
        await limparCursor(account.ig_user_id, senderId);
      } else {
        // O passo vem CRU do banco, então passa pela mesma validação que o
        // interpretador faz — e `passoEsperado` ainda confirma que ele espera
        // alguma coisa. Undefined aqui é cursor obsoleto (lista editada depois de
        // gravado, passo inválido, bloco que deixou de esperar resposta): não há
        // resposta a esperar, então o cursor sai da frente e o evento segue.
        const passo = passoEsperado(autoParada.steps, indiceParado);

        // Este ramo só pode CAPTURAR a mensagem quando ela é mesmo a resposta do
        // passo esperado. O critério, por tipo de passo:
        //   pedir_email  → a mensagem é candidata a e-mail. Captura.
        //   pedir_follow → qualquer mensagem vale como "quero continuar". Captura.
        //   dm de resposta rápida → o que ela espera é o TOQUE no botão, não
        //     texto. Então só deixa passar o que for gatilho de OUTRA automação:
        //     toda boas-vindas estaciona o cursor, e sem esta condição quem
        //     recebeu a boas-vindas da automação A e não tocou no botão ficaria
        //     preso — mandar a palavra-chave da automação B seria lido como
        //     "quero continuar em A", e B nunca dispararia.
        if (!passo) {
          await limparCursor(account.ig_user_id, senderId);
        } else if (passo.tipo === "dm" && interrompeOFluxo(auto, autoParada)) {
          // Não é resposta ao passo: é o gatilho de outra automação. Cai fora do
          // ramo e segue para o fluxo normal, que reinicia naquela automação. O
          // cursor não precisa ser limpo aqui — `executarFluxo` da automação nova
          // o reescreve (ou o apaga, se a lista terminar).
        } else {
          if (passo.tipo === "pedir_email") {
            const email = extractEmail(text);
            if (!email) {
              // Não parecia e-mail: pede de novo, uma vez por mensagem recebida.
              await enqueue({
                account_id: account.ig_user_id,
                kind: "dm_email_ask",
                contact_ig_id: senderId,
                automation_id: autoParada.id,
                payload: {
                  text: "Acho que esse e-mail saiu errado 🤔 Me manda de novo, só o e-mail.",
                },
                dedupe_key: emailAnswerKey(msg.mid, senderId, Date.now()),
              });
              return;
            }
            await sql().query(
              `update contacts set email = $3 where account_id = $1 and ig_id = $2`,
              [account.ig_user_id, senderId, email]
            );
          }

          // Onde a lista retoma é decisão pura, e ela mora em `retomadaDoTexto`
          // (lib/steps.ts) — com o porquê de cada ramo, com a regra do portão
          // aplicada, e com teste.
          //
          // Aqui era o quarto ponto de retomada, e o único que ainda calculava
          // por conta própria: `passo.tipo === "pedir_follow" ? indiceParado :
          // indiceParado + 1`. Ele não passava por nenhuma das outras três
          // funções, e é justamente por ele que a lista reordenada para
          // `[portão, boas-vindas, link]` entregava o link a quem não segue —
          // qualquer texto de quem estava parado na boas-vindas caía no `+1`,
          // que é o link, com o portão nunca avaliado.
          await executarFluxo(
            account, autoParada, senderId,
            retomadaDoTexto(autoParada.steps, indiceParado)
          );
          return;
        }
      }
    }
  }

  if (auto) {
    // Marca de quem é a conversa a partir de agora. Ficava dentro do `if
    // (auto.welcome_text)` que enfileirava as boas-vindas; saiu junto com ele e
    // passou a ser incondicional, porque não tem nada a ver com boas-vindas: é o
    // que faz o ramo do cursor e o de fallback, mais abaixo, saberem qual
    // automação retomar quando a pessoa responder com texto.
    await upsertContact(account.ig_user_id, senderId, { last_automation_id: auto.id });

    // Também aqui não há enfileiramento de boas-vindas, pelo mesmo motivo do
    // gatilho de comentário: ela é um passo `dm` da lista, e `executarFluxo`
    // logo abaixo a envia. O `enqueue` de `dm_welcome` a partir da coluna
    // `auto.welcome_text` era resíduo da migração e mandava a mensagem duas
    // vezes — `welcomeMessageKey` (por mid/instante) e `passoKey` (por
    // passo/dia) nunca colidem, então a deduplicação não pegava a repetição.
    //
    // O coraçãozinho na resposta de story deixou de ser caso à parte lido de
    // `story_reaction` e virou passo da lista. O id da mensagem vai junto
    // porque só o gatilho o conhece.
    await executarFluxo(account, auto, senderId, 0, { messageId: msg.mid });
    return;
  }

  // Sem palavra-chave, mas a pessoa respondeu com texto em vez de tocar no
  // botão: se a última automação dela ainda está ativa e a boas-vindas já saiu
  // sem o link, segue o fluxo DE ONDE ELE PAROU — não do começo.
  //
  // Do começo era o que estava aqui, e reinterpretava a lista inteira: a
  // boas-vindas voltava para a fila e o fluxo parava nela de novo, exatamente a
  // mensagem que a pessoa já tinha recebido, e o link continuava sem sair. E
  // repetir DUPLICA de verdade: a boas-vindas de um fluxo por comentário é
  // gravada com `privateReplyKey(commentId)`, e a repetição sai com `passoKey`
  // (por passo/pessoa/dia) — chaves diferentes, nada colide, dois envios.
  // De qual automação era a última conversa. Vem do mesmo `lerCursor` lido lá
  // em cima, e não de uma consulta própria: é a leitura de ANTES do ramo do
  // cursor, exatamente como era com a consulta solta.
  //
  // O motivo de não reler é UM só, e é economia: entre aquele `lerCursor` e
  // aqui não há escrita em `last_automation_id` — `limparCursor` zera
  // `flow_step_id` e `flow_step_index`, e não toca nesta coluna —, então a
  // segunda leitura devolveria exatamente o mesmo valor. Seria uma ida ao banco
  // a mais sem nada a mostrar por ela.
  //
  // Ou seja: reler não mudaria o comportamento. Quem escrever aqui uma escrita
  // em `last_automation_id` entre as duas passa a precisar da releitura.
  const lastAuto = cursor.automationId;
  const autoAnterior = lastAuto ? automations.find((a) => a.id === lastAuto) : undefined;
  if (
    autoAnterior &&
    (await shouldFallbackFollowup(account.ig_user_id, autoAnterior.id, senderId))
  ) {
    const de = retomadaDoFallback(autoAnterior.steps, autoAnterior.ligacoes);
    if (de !== null) await executarFluxo(account, autoAnterior, senderId, de);
  }
}

// Resposta escrita por uma pessoa no painel.
//
// Entra na MESMA fila das automáticas de propósito: assim ela herda a trava
// atômica, o limite de ~190 envios/hora por conta, as novas tentativas e a
// checagem da janela de 24h. Um caminho de envio paralelo teria que reimplementar
// tudo isso — e erraria em algum ponto.
//
// O processItem já sabe tratar este caso: "dm_manual" não é comment_reply nem
// story_reaction, então cai no caminho de DM comum com texto simples.
export async function enqueueManualReply(
  accountId: string,
  contactIgId: string,
  text: string
): Promise<boolean> {
  return enqueue({
    account_id: accountId,
    kind: "dm_manual",
    contact_ig_id: contactIgId,
    payload: { text },
    dedupe_key: manualReplyKey(contactIgId, Date.now()),
  });
}
