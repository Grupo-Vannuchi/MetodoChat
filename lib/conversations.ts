import "server-only";
import { sql } from "./db";

// De onde vem uma conversa.
//
// Não existe tabela de mensagens. As recebidas estão em `events` desde que o
// app subiu (o webhook grava o evento inteiro); as enviadas saem pela `queue` e
// voltam como eco, também em `events`. Costurar as duas fontes aproveita todo o
// histórico já acumulado, sem migração e sem backfill.
//
// A dedução pelo `mid` existe porque uma mensagem enviada pelo sistema aparece
// NAS DUAS fontes: na fila, porque nós a enfileiramos, e no eco, porque a Meta
// nos devolve o que foi enviado.

// Em que pé está o envio, do ponto de vista de quem olha a conversa.
//
// Traduz os seis status da fila para os quatro que interessam na tela. O
// atendente não precisa saber a diferença entre 'pending' e 'sending', nem entre
// 'failed' e 'skipped' — precisa saber se saiu, se está saindo ou se não vai
// sair.
//
// `guardado` É O QUARTO, E ELE NÃO CABIA EM NENHUM DOS TRÊS. É o item de lote
// que espera a pessoa voltar a falar (`migrations/009-fila-estado-guardado.sql`):
// não saiu, não está saindo, e não é que não vá sair. Enquanto ele caía no
// `else` do `case` abaixo, a mensagem aparecia como "enviando…" PARA SEMPRE no
// balão — e o balão é o lugar onde essa mentira dura mais tempo, porque pode
// levar semanas até a pessoa voltar.
export type MessageDelivery = "sent" | "sending" | "failed" | "guardado";

// Anexo recebido. A v1 não ENVIA mídia, mas recebe o tempo todo — gente
// compartilha reel na DM o tempo inteiro. O payload já traz tipo e link; sem
// isto a conversa mostrava só "(sem texto)" e o atendente não fazia ideia do que
// a pessoa tinha mandado.
// `title` é a legenda do reel ou do post compartilhado — a Meta manda em
// ig_reel e ig_post, e é o mais perto de uma prévia que dá para chegar. Ela NÃO
// manda miniatura em tipo nenhum, então a imagem do cartão não existe: pegá-la
// exigiria a permissão oembed_read, que passa por revisão da Meta.
export type InboxAttachment = { type: string; url: string | null; title: string | null };

export type InboxMessage = {
  mid: string | null;
  direction: "in" | "out";
  text: string;
  at: Date;
  delivery: MessageDelivery;
  attachment: InboxAttachment | null;
};

// Como cada tipo de anexo se apresenta. O que a Meta manda hoje em DM do
// Instagram; tipo desconhecido cai no rótulo genérico em vez de sumir.
const ANEXOS: Record<string, string> = {
  ig_reel: "🎬 Reel",
  ig_post: "🖼️ Post",
  share: "🔗 Publicação",
  image: "📷 Foto",
  video: "🎥 Vídeo",
  audio: "🎤 Áudio",
  file: "📎 Arquivo",
  story_mention: "📖 Menção no story",
  location: "📍 Localização",
  // A API diz "não suportado", mas o arquivo VEM: testando a URL desses casos,
  // voltou video/mp4. É a Meta não sabendo classificar, não a Meta se recusando
  // a entregar — então o rótulo diz que há mídia, e o link abre.
  unsupported_type: "🎞️ Mídia",
};

export function attachmentLabel(type: string): string {
  return ANEXOS[type] ?? "📎 Anexo";
}

// Para quais tipos a `url` é o ARQUIVO, e não uma página.
//
// Confirmado contra o CDN da Meta: ig_post e share devolvem image/jpeg. ig_reel
// é o único que devolve permalink do instagram.com, sem mídia direta —
// justamente o tipo mais comum, então a maioria dos cartões segue sem imagem.
//
// unsupported_type fica de fora de propósito: veio vídeo de 11 MB, e carregar
// isso dentro da lista de mensagens seria hostil com quem está no celular.
const COM_IMAGEM = new Set(["ig_post", "share", "image"]);

export function attachmentHasImage(type: string): boolean {
  return COM_IMAGEM.has(type);
}

export function mergeMessages(
  fromEvents: InboxMessage[],
  fromQueue: InboxMessage[]
): InboxMessage[] {
  const jaVistos = new Set(fromEvents.map((m) => m.mid).filter((m): m is string => Boolean(m)));
  const daFila = fromQueue.filter((m) => !m.mid || !jaVistos.has(m.mid));
  return [...fromEvents, ...daFila].sort((a, b) => a.at.getTime() - b.at.getTime());
}

// `abertura` está aqui porque ela É uma troca recebida: é a PRIMEIRA coisa que
// acontece na conversa, e sem ela a linha de quem entrou pela porta de entrada
// nasceria sem começo. TIPO NOVO DE EVENTO RECEBIDO PRECISA ENTRAR AQUI —
// esquecer some a mensagem da conversa em silêncio, do mesmo jeito que a lista
// de kinds da fila, logo abaixo.
//
// E ESTE AVISO TEM REDE, que é o que o distingue de um aviso. Tirar `"abertura"`
// daqui passa por tsc, por eslint e pelos testes puros — um comentário sozinho
// não segura nada, e esta base já pagou três vezes por confiar num. Quem fica
// vermelho é `testes-integracao/porta-de-entrada.integracao.ts`, no caso "quem
// entra pela porta aparece na caixa de entrada": ele grava o evento com o motor
// de verdade e abre a caixa pelas duas funções abaixo. A rede é de INTEGRAÇÃO
// porque as duas peças só se medem pelo efeito — a lista alimenta SQL, e afirmar
// aqui que a constante contém `"abertura"` seria perguntar de novo à linha que
// decide.
const TIPOS_RECEBIDOS = ["message", "story_reply", "quick_reply", "abertura"];

// Lista de conversas: uma linha por pessoa, ordenada pela última troca.
//
// Devolve três grandezas por conversa:
//   total         todas as trocas, como antes
//   nao_lidas     recebidas depois da última vez que a conversa foi aberta
//   sem_resposta  a última mensagem foi da pessoa (SEM considerar a janela)
//
// A janela de 24h NÃO entra aqui, e isso é deliberado: ela depende da hora atual
// e envelheceria dentro do resultado. Uma conversa cuja janela fecha às 14h03
// continuaria marcada até a próxima consulta. Quem aplica a janela é a lista, no
// componente, onde `windowState` já é calculado a cada renderização e expira
// sozinho.
//
// Que a janela precise entrar em algum lugar é medido, não estético: sem ela, 32
// das 34 conversas ficam marcadas, porque fora da janela a Meta recusa o envio e
// ninguém nunca respondeu. Com ela, sobram 8 — as que dá para atender.
export async function listConversations(accountId: string, limite = 50) {
  return (await sql().query(
    `with recebidas as (
       select e.payload->'sender'->>'id' as cid, e.created_at as at
       from events e
       where e.account_id = $1 and e.type = any($2::text[])
     ),
     enviadas as (
       select e.payload->'recipient'->>'id' as cid, e.created_at as at
       from events e
       where e.account_id = $1 and e.type = 'message_sent'
     ),
     trocas as (
       select cid, at from recebidas
       union all
       select cid, at from enviadas
     )
     select t.cid as ig_id,
            max(t.at) as last_at,
            count(*)::int as total,
            c.username, c.name, c.profile_pic, c.last_reply_at, c.categoria,
            -- Sem last_seen_at (nunca aberta), tudo que chegou conta.
            (select count(*)::int from recebidas r
              where r.cid = t.cid
                and r.at > coalesce(c.last_seen_at, 'epoch'::timestamptz)) as nao_lidas,
            -- A comparação usa max() dos dois lados: "a última palavra foi
            -- dela". Os DOIS lados precisam de coalesce, não só 'enviadas':
            -- contato que existe só em 'enviadas' (a conta mandou DM por
            -- automação de comentário e a pessoa nunca respondeu) deixa
            -- max(r.at) NULL, e 'NULL > qualquer_coisa' é NULL em SQL, não
            -- false — e o campo é boolean não-nulo, não boolean | null.
            (coalesce((select max(r.at) from recebidas r where r.cid = t.cid),
                      'epoch'::timestamptz) >
             coalesce((select max(s.at) from enviadas s where s.cid = t.cid),
                      'epoch'::timestamptz)) as sem_resposta
     from trocas t
     left join contacts c on c.account_id = $1 and c.ig_id = t.cid
     where t.cid is not null
     group by t.cid, c.username, c.name, c.profile_pic, c.last_reply_at, c.last_seen_at, c.categoria
     order by last_at desc
     limit $3`,
    [accountId, TIPOS_RECEBIDOS, limite]
  )) as {
    ig_id: string;
    last_at: Date;
    total: number;
    username: string | null;
    name: string | null;
    profile_pic: string | null;
    last_reply_at: Date | null;
    categoria: string | null;
    nao_lidas: number;
    sem_resposta: boolean;
  }[];
}

// Mensagens de UMA conversa, já fundidas e em ordem.
export async function conversationMessages(
  accountId: string,
  contactIgId: string,
  limite = 200
): Promise<InboxMessage[]> {
  // O driver do Neon devolve linha sem tipo. Este é o formato cru das duas
  // consultas abaixo — a conversão vai no resultado já resolvido, que é o
  // idioma usado no resto do projeto.
  type LinhaCrua = {
    direction: "in" | "out";
    at: string | Date;
    mid: string | null;
    text: string;
    delivery: MessageDelivery;
    attachment_type: string | null;
    attachment_url: string | null;
    attachment_title: string | null;
  };

  const [doEvents, daFila] = (await Promise.all([
    sql().query(
      `select case when e.type = 'message_sent' then 'out' else 'in' end as direction,
              e.created_at as at,
              e.payload->'message'->>'mid' as mid,
              -- O postback da porta de entrada não tem 'message': o texto dele
              -- é o 'title', a pergunta que a pessoa leu antes de tocar. Sem
              -- este segundo termo a conversa começava com uma bolha vazia.
              -- Apagá-lo não quebra nada que o tsc veja: quem fica vermelho é o
              -- caso da caixa de entrada em porta-de-entrada.integracao.ts, que
              -- afirma o TEXTO da bolha e não só a existência dela.
              coalesce(e.payload->'message'->>'text', e.payload->'postback'->>'title', '') as text,
              -- Evento é fato consumado: chegou ou saiu, não há meio caminho.
              'sent' as delivery,
              -- Só o primeiro anexo. A Meta manda um array, mas na prática vem
              -- um por mensagem; mostrar "📎 Anexo" para o primeiro é melhor do
              -- que a bolha vazia que aparecia antes.
              e.payload->'message'->'attachments'->0->>'type' as attachment_type,
              e.payload->'message'->'attachments'->0->'payload'->>'url' as attachment_url,
              e.payload->'message'->'attachments'->0->'payload'->>'title' as attachment_title
       from events e
       where e.account_id = $1
         and (
           (e.type = any($3::text[]) and e.payload->'sender'->>'id' = $2)
           or (e.type = 'message_sent' and e.payload->'recipient'->>'id' = $2)
         )
       order by e.created_at desc
       limit $4`,
      [accountId, contactIgId, TIPOS_RECEBIDOS, limite]
    ),
    sql().query(
      `select 'out' as direction,
              coalesce(q.sent_at, q.created_at) as at,
              q.message_id as mid,
              -- 'sent_text' é o texto COM as variáveis resolvidas, gravado no
              -- envio. 'text' é o template. Mensagem anterior a este registro só
              -- tem o template, e aí é ele mesmo — melhor mostrar "ola {name}"
              -- do que uma bolha vazia.
              coalesce(q.payload->>'sent_text', q.payload->>'text', '') as text,
              case q.status
                when 'sent' then 'sent'
                when 'failed' then 'failed'
                when 'skipped' then 'failed'
                -- O item de lote fora da janela. Sem este braço ele caía no
                -- 'sending' do else e o balão dizia "enviando…" por semanas.
                when 'guardado' then 'guardado'
                else 'sending'
              end as delivery,
              -- A v1 não envia mídia, então o que sai nunca tem anexo.
              null as attachment_type,
              null as attachment_url,
              null as attachment_title
       from queue q
       -- SEM filtro de status, de propósito. Antes só entrava 'sent', e por isso
       -- uma resposta recém-enviada ficava invisível: ela nasce 'pending' e a
       -- drenagem acontece depois da resposta da ação. O atendente clicava em
       -- Enviar, a conversa não mudava, e ele clicava de novo — mandando duas.
       -- Item que falhou ou foi descartado também precisa aparecer: some em
       -- silêncio é pior do que aparecer marcado.
       where q.account_id = $1 and q.contact_ig_id = $2
         -- Só DM de verdade. 'comment_reply' é resposta PÚBLICA no comentário e
         -- 'story_reaction' é reação sem texto: os dois têm contact_ig_id e
         -- entrariam na conversa privada como mensagem que nunca existiu.
         -- Nenhum dos dois recebe message_id, então ficariam com mid nulo e
         -- jamais seriam deduplicados.
         --
         -- KIND NOVO DE DM PRECISA ENTRAR AQUI. A lista de kinds válidos é a
         -- constraint queue_kind_check, em lib/db.ts. Esquecer de acrescentar
         -- aqui faz a mensagem sumir da conversa em silêncio: sem erro, sem
         -- log, sem teste vermelho. A lista é positiva de propósito — o defeito
         -- que motivou este filtro nasceu justamente de deixar entrar por
         -- omissão, e sumir é mais fácil de perceber do que poluir.
         --
         -- dm_lote ENTROU AQUI EM 01/09/2026, e o aviso acima tinha previsto o
         -- proprio defeito: o kind nasceu em migrations/008-fila-tipo-lote.sql e
         -- ninguem o acrescentou nesta lista, entao a mensagem do lote sumia da
         -- conversa em silencio. Ela importa mais do que uma mensagem automatica
         -- qualquer: o valor inteiro do lote e a pessoa RESPONDER, e o dono abria
         -- a conversa para ver "quanto custa?" pendurado no vazio, sem a mensagem
         -- que provocou a pergunta.
         -- (sem crases aqui: este comentario mora DENTRO de um template literal.)
         and q.kind in (
           'private_reply','dm_welcome','dm_link','dm_reminder',
           'dm_follow_gate','dm_email_ask','dm_manual','dm_lote'
         )
       order by coalesce(q.sent_at, q.created_at) desc
       limit $3`,
      [accountId, contactIgId, limite]
    ),
  ])) as [LinhaCrua[], LinhaCrua[]];

  const paraInbox = (linhas: LinhaCrua[]): InboxMessage[] =>
    linhas.map(({ attachment_type, attachment_url, attachment_title, ...l }) => ({
      ...l,
      at: new Date(l.at),
      attachment: attachment_type
        ? { type: attachment_type, url: attachment_url, title: attachment_title }
        : null,
    }));

  return mergeMessages(paraInbox(doEvents), paraInbox(daFila));
}
