// Tradução dos nomes internos do sistema para a linguagem de quem usa o painel.
// Ninguém deveria precisar saber o que é "dm_link" ou "story_reply".
//
// O ÚNICO IMPORT deste arquivo é `lib/steps.ts`, e ele entrou com `oQueDispara`
// (lá embaixo): a coluna "o que dispara" da lista de automações precisa fazer a
// MESMA pergunta que o salvar e o painel fazem sobre palavra-chave, e reescrevê-
// la aqui criaria a segunda resposta que esta fase inteira vem apagando.
import { gatilhoPedePalavraChave } from "@/lib/steps";

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
  // A PORTA DE ENTRADA: a pessoa abriu a conversa e tocou numa das perguntas de
  // abertura da conta (o gatilho `abertura`, lib/engine.ts).
  //
  // TIPO PRÓPRIO, e não `quick_reply`, porque a pergunta que esta tela precisa
  // responder é QUAL DAS QUATRO PORTAS traz gente. Com um tipo só, as quatro
  // ficavam iguais entre si e iguais aos botões de dentro do fluxo. Aqui o
  // rótulo separa a origem, e `eventText` (abaixo) mostra o texto da pergunta.
  abertura: {
    label: "Tocou numa pergunta de abertura",
    className: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-400",
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
  portao_soltou: {
    label: "Portão de follow soltou o contato",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  },
  // Alguém tocou num botão que não leva a lugar nenhum: a ligação de saída não
  // existe, ou o bloco de destino foi apagado da lista depois que o botão já
  // tinha saído. O motor não entrega nada (`caminhoDoBotao`, lib/steps.ts), e
  // sem esta linha o defeito seria invisível — a pessoa toca, não acontece
  // nada, e não há erro em canto nenhum.
  //
  // Vermelho, pelo mesmo critério de `portao_nao_avaliado`: alguém deixou de
  // receber mensagem. E não é ruído de operação normal — botão órfão é
  // montagem errada, que a conferência do editor recusa salvar.
  botao_sem_caminho: {
    label: "Botão sem caminho",
    className: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400",
  },
  // OS TRÊS DO MENU DE BOTÕES (lib/queue-drain.ts, Tarefa 4). Eles existiam no
  // banco e não existiam aqui: caíam no UNKNOWN, e o dono via uma linha cinza
  // escrita "Interação" — que não diz que um botão sumiu da mensagem. O
  // comentário logo acima de `KIND`, sobre o `dm_manual` que aparecia cru na
  // tela, é exatamente esta falha do outro lado do arquivo.
  //
  // Âmbar: a mensagem saiu e a pessoa tem no que tocar; o que se perdeu foram
  // as opções além da décima terceira, e quem arruma é o dono, desenhando
  // menos botões.
  quick_replies_cortados: {
    label: "Botões demais na mensagem",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  },
  // Âmbar pelo mesmo critério: os botões inteiros saíram, e o que caiu foi o
  // que estava sem rótulo. Ele some da mensagem, e sem esta linha some calado.
  quick_replies_sem_rotulo: {
    label: "Botão sem rótulo não foi enviado",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  },
  // Vermelho, pelo mesmo critério de `portao_nao_avaliado` e `botao_sem_caminho`:
  // alguém deixou de receber mensagem. O bloco PARA o fluxo (`esperaResposta`,
  // lib/steps.ts) e a mensagem saiu sem botão nenhum — nenhum braço daquele
  // menu é alcançável, e a pessoa sai do fluxo sem ver o que vinha depois.
  menu_sem_botoes: {
    label: "Menu saiu sem botão nenhum",
    className: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400",
  },
  // A PERGUNTA DE ABERTURA APONTA PARA UMA AUTOMAÇÃO QUE NÃO TEM O GATILHO
  // `abertura` (lib/engine.ts). A pergunta mora no perfil da conta na Meta, fora
  // do banco, e continua disparando — recusar aqui faria a pergunta que está no
  // ar parar de funcionar em silêncio, e nenhum outro caminho por identificador
  // deste motor reconfere gatilho.
  //
  // Esta linha é a terceira saída: executa, e o dono vê que a montagem
  // divergiu. Sem ela, quem trocasse o gatilho de uma automação esperando que a
  // pergunta parasse não teria NENHUM lugar onde ver que ela não parou.
  //
  // Âmbar: nada quebrou e ninguém deixou de receber. O que há é a configuração
  // dizendo uma coisa e a tela da Meta dizendo outra — e quem arruma é o dono,
  // ou tirando a pergunta da tela de Configuração, ou pondo o gatilho de volta.
  abertura_com_gatilho_trocado: {
    label: "Pergunta de abertura com gatilho trocado",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  },
  // OS DOIS DO WEBHOOK QUE NÃO ENTENDEU (app/api/webhook/route.ts). A Meta
  // mandou alguma coisa que não cai em nenhum ramo conhecido: um `field` em
  // `changes` que não é "comments", ou um item de `messaging` sem `message` —
  // que é a forma de `messaging_referral` e de `messaging_postbacks`.
  //
  // Âmbar, e não vermelho: nada quebrou e ninguém deixou de receber o que tinha
  // direito de receber. O que aconteceu é que apareceu uma forma nova, e ela
  // ficou guardada CRUA no payload em vez de sumir. É a linha que o dono manda
  // para quem for desenhar o ramo novo.
  //
  // Sem estas duas entradas os eventos cairiam no UNKNOWN e o painel escreveria
  // "Interação" — que é a mesma falha do `dm_manual` aparecendo cru na tela,
  // registrada no comentário de `kindLabel`, só que do lado do silêncio.
  webhook_campo_nao_tratado: {
    label: "Campo de webhook ainda sem tratamento",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  },
  webhook_messaging_nao_tratado: {
    label: "Evento de conversa ainda sem tratamento",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  },
  // O EVENTO CHEGOU E NÃO HÁ CONTA PARA ELE (lib/engine.ts). Ou nenhuma conta
  // está conectada — desconectar apaga a linha de `accounts`, e a assinatura do
  // webhook é do app, então a Meta continua entregando —, ou há várias e o
  // `entry.id` não bate com nenhuma.
  //
  // Sem esta linha o evento evaporava: o motor saía calado, e o toque numa
  // pergunta de abertura entregue depois de a conta ser desconectada não
  // deixava rastro nenhum.
  //
  // Âmbar: nada quebrou do lado do código. O que há é o painel e a Meta
  // discordando sobre quais contas existem, e quem arruma é o dono, reconectando
  // a conta em Configuração.
  //
  // HONESTIDADE SOBRE ESTE CRACHÁ: no caso do `entry.id` SEM PAR, o dono não o
  // vê. `lib/event-query.ts` traz só `account_id = $1 or account_id is null`, e
  // estas linhas nascem sob um id que não é a conta selecionada — elas são
  // forenses, para quem for ler a tabela. O rótulo continua aqui porque o outro
  // caso (NENHUMA conta conectada, com `entry.id` nulo) cai em `account_id is
  // null` e aparece.
  webhook_sem_conta: {
    label: "Evento sem conta conectada",
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
  // O ENVIO EM LOTE (lib/engine.ts, enqueueLote). Entra na mesma fila do
  // resto pelo mesmo motivo do `dm_manual` logo acima — e por isso corre o
  // mesmo risco: sem entrada aqui, cairia em "Outro envio", a MESMA falha que
  // o `dm_manual` já teve, registrada no comentário do topo deste dicionário.
  dm_lote: "Envio em lote",
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
  // AS TRÊS SAÍDAS PRÓPRIAS DO LOTE (lib/engine.ts e lib/queue-drain.ts). As
  // três caíam no texto genérico do fim desta função, que promete reenvio
  // automático — falso nas duas primeiras, que são decisão e não falha, e sem
  // sentido na terceira, que ainda está tentando.
  //
  // Um lote mais novo tomou o lugar deste antes de ele sair: foi o dono quem
  // decidiu, ao confirmar de novo para a mesma pessoa, e não vai haver nova
  // tentativa deste aqui.
  if (raw.includes("substituido por um lote mais novo"))
    return "Você confirmou um envio mais novo para esta pessoa antes deste sair. Foi decisão sua, e não há nova tentativa.";
  // A pessoa está fora da janela de 24h e a mensagem CONTINUA na fila
  // (`pending`, não `skipped` nem `failed`): ela sai sozinha assim que a
  // pessoa voltar a falar. É a linha que impede o dono de ler "Na fila" com
  // este texto embaixo e concluir que o envio travou.
  if (raw.includes("guardado ate a pessoa voltar a falar"))
    return "A pessoa está fora da janela de 24h. A mensagem fica guardada e sai assim que ela voltar a falar com você.";
  // O prazo da mensagem (validoAte) venceu antes de ela sair.
  //
  // CASA POR "o lote venceu", E NÃO PELA FRASE INTEIRA, de propósito: até
  // 01/09/2026 o dreno gravava "o lote venceu antes de a pessoa voltar", porque
  // a validade só era conferida no ramo da janela FECHADA — e essas linhas
  // continuam na fila, que é o histórico do produto. O texto novo é mais curto
  // porque a validade passou a ser conferida ANTES de enviar, nos dois
  // caminhos, e "a pessoa não voltou" deixou de ser a única forma de vencer:
  // um lote grande estoura o teto horário e vence com a janela ABERTA.
  if (raw.includes("o lote venceu"))
    return "O prazo desta mensagem acabou antes de ela sair, e por isso ela não foi enviada.";
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
  postback?: { title?: string; payload?: string };
  // `follow_check_unavailable` carrega UM dos dois, nunca os dois: `erro`
  // quando a chamada falhou, `motivo` quando a Meta respondeu sem o campo.
  erro?: { http?: number | null; codigo?: number | null; subcodigo?: number | null; mensagem?: string | null };
  motivo?: string;
};

// Texto que a pessoa escreveu (o botão de resposta rápida não tem texto útil:
// o payload dele é um identificador interno da automação)
//
// A PORTA DE ENTRADA É A EXCEÇÃO, e é a exceção porque ela TEM texto legível: o
// postback traz `title`, que é a pergunta escrita na tela da Meta e lida pela
// pessoa antes de tocar. É o `payload` dela que é identificador interno — e é
// justamente ele que não aparece. Sem esta linha as quatro portas viravam N
// linhas idênticas sem texto nenhum, que é a tela não respondendo à única
// pergunta que ela existe para responder.
export function eventText(payload: unknown, type: string): string | null {
  if (type === "quick_reply") return null;
  const p = (payload ?? {}) as EventPayload;
  // A CONFERÊNCIA DE SEGUIDOR QUE NÃO DEU: aqui o texto do evento é o MOTIVO.
  //
  // Esta linha é o conserto de um silêncio medido. O registro nasceu dizendo só
  // "não deu para conferir" — e diante disso o chat de monitoramento chutou
  // "erro 400 code 190" quando o número real era 230. O número e a frase da
  // Meta aparecerem aqui é a diferença entre diagnosticar e adivinhar.
  if (type === "follow_check_unavailable") {
    const e = p.erro;
    if (e) {
      const numeros = [e.codigo, e.subcodigo].filter((n): n is number => typeof n === "number");
      // O código da Meta vale mais que o HTTP para quem vai procurar: 230 e 190
      // chegam os dois em respostas de famílias diferentes de HTTP.
      const cabeca = numeros.length
        ? `Meta ${numeros.join("/")}`
        : typeof e.http === "number"
          ? `HTTP ${e.http}`
          : null;
      const frase = e.mensagem?.trim() || null;
      if (cabeca && frase) return `${cabeca}: ${frase}`;
      return cabeca ?? frase;
    }
    return p.motivo?.trim() ? p.motivo.trim() : null;
  }
  if (type === "abertura") {
    const t = p.postback?.title;
    return t?.trim() ? t.trim() : null;
  }
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

// ---------- O que faz uma automação disparar ----------

// A COLUNA "O QUE DISPARA" DA LISTA DE AUTOMAÇÕES.
//
// AS DUAS METADES SAEM JUNTAS, e não uma no lugar da outra. Isto já foi um
// `some` que ESCOLHIA: numa linha com `["dm","abertura"]` a coluna dizia
// "pergunta de abertura" e ESCONDIA as palavras do `dm`, que são dado de
// verdade daquela linha. A tela só escreve um gatilho por automação, mas
// `triggers` é coluna de array e já teve outros valores — é o mesmo argumento
// do caso "gatilho desconhecido aparece em vez de sumir".
//
// A PERGUNTA É `gatilhoPedePalavraChave` (lib/steps.ts), a mesma que o salvar e
// o painel fazem. `abertura` não casa por texto: quem dispara é o toque numa
// pergunta de abertura da conta, e sem esta pergunta a coluna saía VAZIA —
// `keywords` é `[]` e `match_type` não é "any", então o `join` devolvia "".
//
// ELA MORAVA DENTRO DO JSX de `list-client.tsx`, e ali era rede zero: a revisão
// reverteu as duas metades para o `some` que escolhia e a suíte ficou com 722
// VERDES. A suíte não testa componente, e não vai passar a testar.
//
// METADE VAZIA SOME SOZINHA, e é o `filter` que faz isso: um `dm` ainda sem
// palavra nenhuma não deixa " · " sobrando na ponta.
//
// SEM GATILHO NENHUM É DITO, e não deixado em branco. As duas metades perguntam
// por `triggers`, então uma lista VAZIA esvazia as duas e a coluna sumia — o
// JSX que esta função substituiu sempre imprimia alguma coisa. Isto não é a
// mesma coisa que o gatilho desconhecido logo abaixo: lá a função não SABE o que
// aquele gatilho dispara e calar é honesto; aqui ela sabe, e o que ela sabe é
// que não há gatilho. As duas portas de escrita garantem um gatilho hoje, então
// é defesa ausente e não regressão — mas uma linha em branco na lista é uma
// linha que não diz nada a ninguém.
const SEM_GATILHO = "sem gatilho definido";

export function oQueDispara(a: {
  triggers: string[];
  keywords: string[];
  match_type: string;
}): string {
  if (a.triggers.length === 0) return SEM_GATILHO;
  const semPalavra = a.triggers.some((t) => !gatilhoPedePalavraChave(t));
  const comPalavra = a.triggers.some((t) => gatilhoPedePalavraChave(t));
  return [
    semPalavra ? "pergunta de abertura" : "",
    comPalavra ? palavrasResumidas(a.keywords, a.match_type) : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

// AS PALAVRAS QUE CABEM NA LINHA, e quantas ficaram de fora.
//
// TRÊS E O RESTO CONTADO: a linha da lista é estreita e trunca por CSS, e uma
// lista de vinte palavras cortada no meio não diz quantas eram. "+17" diz.
//
// COM `any` NÃO HÁ PALAVRA A MOSTRAR — aquela automação casa com qualquer
// mensagem —, e escrever as `keywords` que sobraram no banco seria a lista
// prometendo um filtro que o motor não aplica.
function palavrasResumidas(palavras: string[], correspondencia: string): string {
  if (correspondencia === "any") return "qualquer texto";
  const sobra = palavras.length - 3;
  return palavras.slice(0, 3).join(", ") + (sobra > 0 ? ` +${sobra}` : "");
}
