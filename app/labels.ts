// Tradução dos nomes internos do sistema para a linguagem de quem usa o painel.
// Ninguém deveria precisar saber o que é "dm_link" ou "story_reply".

type Badge = { label: string; className: string };

const BADGE_BASE = "rounded-full px-2 py-0.5 text-[10px] font-medium";

// ---------- O que a pessoa fez no seu Instagram ----------

const EVENT: Record<string, Badge> = {
  comment: {
    label: "Comentou no post",
    className: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-400",
  },
  message: {
    label: "Mandou mensagem",
    className: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-400",
  },
  story_reply: {
    label: "Respondeu seu story",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  },
  quick_reply: {
    label: "Tocou no botão",
    className: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-400",
  },
  // Resposta enviada pela própria conta, fora do robô (pelo celular, por
  // exemplo). Gravada para o histórico de conversa; hoje não aparece nas listas
  // de "o que chegou até você", que são sobre interações RECEBIDAS.
  message_sent: {
    label: "Você respondeu",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400",
  },
  error: {
    label: "Algo deu errado",
    className: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400",
  },
  follow_check_unavailable: {
    label: "Não deu para conferir o seguidor",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  },
  // Um passo da automação estava mal montado e foi pulado. O fluxo seguiu, mas
  // alguém precisa arrumar a automação — por isso aparece nomeado.
  step_ignorado: {
    label: "Passo da automação ignorado",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  },
  // O fluxo ia atravessar um portão de follow e o portão não resolveu — bloco
  // apagado ou editado entre o cálculo da retomada e a execução. O motor PARA
  // em vez de entregar o destino sem avaliar o portão (lib/engine.ts), e esta é
  // a linha que conta isso a quem pode arrumar a automação. Aparece em vermelho:
  // diferente do passo ignorado, aqui alguém deixou de receber mensagem.
  portao_nao_avaliado: {
    label: "Portão de follow não pôde ser avaliado",
    className: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400",
  },
  // A pessoa não segue, os pedidos de follow dela acabaram (cinco, por contato,
  // na vida) e o fluxo a SOLTOU: em vez de continuar segurando o cursor no
  // portão sem lhe pedir mais nada, o motor limpou o cursor. Ela não recebeu o
  // link, e voltou a ser alcançável por qualquer automação. O portão não volta a
  // pedir, mas continua consultando a Meta a cada passagem: se ela seguir o
  // perfil, passa na hora.
  //
  // Âmbar e não vermelho: nada quebrou, e ninguém deixou de receber o que tinha
  // direito de receber. É a linha que impede a pessoa de simplesmente sumir do
  // fluxo aos olhos de quem lê o painel.
  // O fluxo não tinha bloco por onde continuar: a retomada caiu depois do
  // último bloco da lista. Na esmagadora maioria das vezes isso é um fim de
  // fluxo NORMAL — a pessoa estava parada no último bloco e respondeu.
  //
  // Aparece nomeado, e não escondido, porque também é o que se vê quando a
  // lista foi editada e encolheu debaixo de quem estava no fim dela. Zinco, e
  // não âmbar: nada quebrou, e ninguém deixou de receber o que tinha para
  // receber.
  //
  // TIPO PRÓPRIO de propósito. Isto já saiu como `step_ignorado`, e a janela de
  // 10 minutos daquele tipo é por automação: um fim de fluxo normal calava por
  // 10 minutos os avisos de passo mal montado da mesma automação.
  fluxo_sem_partida: {
    label: "Fluxo sem bloco para continuar",
    className: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
  },
  portao_soltou: {
    label: "Portão de follow soltou o contato",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  },
};

const UNKNOWN: Badge = {
  label: "Interação",
  className: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
};

export function eventBadge(type: string): Badge {
  const b = EVENT[type] ?? UNKNOWN;
  return { ...b, className: `${BADGE_BASE} ${b.className}` };
}

// ---------- O que saiu da conta ----------

// Todos os `kind` que a tabela `queue` aceita (o `check` em lib/db.ts) precisam
// estar aqui. Faltando um, ele ia CRU para a tela — foi o que aconteceu com
// `dm_manual`, que é o rótulo mais frequente da lista e aparecia como
// identificador técnico.
const KIND: Record<string, string> = {
  private_reply: "Boas-vindas no privado",
  comment_reply: "Resposta no comentário",
  dm_welcome: "Boas-vindas na DM",
  dm_link: "DM com o seu link",
  dm_reminder: "Lembrete",
  dm_follow_gate: "Pedido para seguir o perfil",
  dm_email_ask: "Pedido de e-mail",
  story_reaction: "Reação no story",
  // Resposta que uma pessoa digitou na caixa de entrada do painel. Entra na
  // mesma fila das automáticas (lib/engine.ts, enqueueManualReply) e por isso
  // aparece nesta lista junto com o que o robô mandou.
  dm_manual: "Resposta sua",
};

// Kind sem rótulo devolve algo legível, e nunca o nome interno — como
// eventBadge() já fazia com UNKNOWN. Um kind novo no motor pode aparecer na tela
// antes de alguém lembrar deste dicionário.
//
// A reserva é "Outro envio", e não "Mensagem", porque "Mensagem" é uma
// AFIRMAÇÃO: um kind novo pode ser reação a story, resposta pública a
// comentário, qualquer coisa — e a tela estaria dizendo que é DM sem saber.
// "Outro envio" não vaza jargão e não mente; de quebra, deixa perceber que
// apareceu algo que este dicionário ainda não conhece.
export function kindLabel(kind: string): string {
  return KIND[kind] ?? "Outro envio";
}

// ---------- Quem mandou ----------

// As chaves vivem em lib/envio-filters.ts, junto da regra que decide a origem a
// partir do kind; aqui fica só como elas se chamam para quem lê o painel.
const ORIGEM: Record<string, string> = {
  robo: "O robô enviou",
  voce: "Você respondeu",
};

export function origemLabel(origem: string): string {
  return ORIGEM[origem] ?? "Todas as origens";
}

// ---------- Situação do envio ----------

const STATUS: Record<string, Badge> = {
  pending: {
    label: "Na fila",
    className: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
  },
  sending: {
    label: "Enviando",
    className: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-400",
  },
  sent: {
    label: "Entregue",
    className: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-400",
  },
  failed: {
    label: "Não saiu",
    className: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400",
  },
  skipped: {
    label: "Não enviada",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  },
};

export function statusBadge(status: string): Badge {
  const b = STATUS[status] ?? UNKNOWN;
  return { ...b, className: `${BADGE_BASE} ${b.className}` };
}

// ---------- Erros em português de gente ----------

export function friendlyError(raw: string | null): string | null {
  if (!raw) return null;
  if (raw.includes("janela de 24h"))
    return "A pessoa não respondeu dentro de 24h. A Meta só deixa enviar nesse intervalo.";
  if (raw.includes("conta não conectada"))
    return "Esta conta do Instagram não está mais conectada ao painel.";
  if (/Instagram API 4\d\d/.test(raw))
    return "O Instagram recusou este envio. Confira em Configuração se a conta segue conectada.";
  if (/Instagram API 5\d\d/.test(raw))
    return "O Instagram ficou instável na hora. O sistema tenta de novo sozinho.";
  return "Não conseguimos enviar desta vez. O sistema tenta de novo automaticamente.";
}

// ---------- Quem falou e o que disse ----------

type EventPayload = {
  text?: string;
  from?: { id?: string; username?: string };
  sender?: { id?: string };
  media?: { id?: string; media_product_type?: string };
  message?: { text?: string; quick_reply?: { payload?: string } };
};

// Texto que a pessoa escreveu (o botão de resposta rápida não tem texto útil:
// o payload dele é um identificador interno da automação)
export function eventText(payload: unknown, type: string): string | null {
  if (type === "quick_reply") return null;
  const p = (payload ?? {}) as EventPayload;
  const t = p.text ?? p.message?.text;
  return t?.trim() ? t.trim() : null;
}

// @ de quem interagiu, quando o próprio evento carrega (comentários trazem)
export function eventUsername(payload: unknown): string | null {
  const p = (payload ?? {}) as EventPayload;
  return p.from?.username ?? null;
}

// ---------- De onde veio ----------

// O tipo da publicação vem no próprio evento, então não custa chamada de API.
function mediaKind(tipo?: string): string {
  if (tipo === "REELS") return "no reels";
  if (tipo === "AD") return "no anúncio";
  if (tipo === "STORY") return "no story";
  return "no post";
}

// Publicação onde o comentário aconteceu. Só comentários trazem: DM e resposta
// de story não nascem de um post.
export function eventMedia(payload: unknown): { id: string; kind: string } | null {
  const m = ((payload ?? {}) as EventPayload).media;
  if (!m?.id) return null;
  return { id: m.id, kind: mediaKind(m.media_product_type) };
}
