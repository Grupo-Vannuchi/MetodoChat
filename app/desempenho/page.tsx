import Link from "next/link";
import { sql } from "@/lib/db";
import { getSelectedAccount } from "@/lib/account";
import { fmtDate } from "@/lib/format";
// A CHAVE DO DIA E O FUSO VÊM DE `lib/calendario.ts`, e não de uma cópia local.
// Esta tela nasceu com a quarta cópia byte a byte da mesma função — mesmo
// `America/Sao_Paulo`, mesmo `en-CA`, mesmas opções —, e a revisão pegou. O
// cabeçalho daquele arquivo argumenta por que TRÊS cópias valem a pena (cada uma
// responde a uma pergunta diferente); esta quarta ninguém argumentou, e ela
// vivia dentro do componente, sem teste.
import { chaveDoDia, FUSO } from "@/lib/calendario";
// AS MESMAS DUAS LISTAS QUE app/page.tsx JÁ LÊ POR PARÂMETRO, e não uma
// segunda cópia: "Mensagens entregues" é o número que a tela pesou ERRADO em
// produção (medido 15/09/2026, publicação contada como mensagem), e "Na fila"
// tinha a mesma exclusão de KINDS_FORA_DA_ENTREGA_DO_MOTOR de um lado
// (`sent7`) e nenhuma do outro — a mesma raiz, duas colunas desta tela.
import { KINDS_FORA_DA_ENTREGA_DO_MOTOR, STATUS_DE_FILA_VIVA } from "@/lib/envio-filters";
import { card, muted, link } from "../ui";
import { StatCard, SentChart } from "../dashboard-parts";
import { IconUsers, IconSend, IconZap, IconClock } from "../icons";

export const dynamic = "force-dynamic";

// DESEMPENHO RESPONDE "ESTÁ FUNCIONANDO?" — a terceira das três perguntas que
// estavam empilhadas no Início até 10/09/2026.
//
// ELA TEM O RITMO MAIS LENTO DAS TRÊS: uma vez por semana, e quando é olhada
// quer PROFUNDIDADE. Era exatamente por isso que ela não cabia no Início, que
// se abre dez vezes por dia e quer estar vazio — e era por isso que o gráfico
// vivia espremido num canto, SEM EIXO E SEM VALOR: dava para ver a forma, não a
// grandeza. Aqui ele tem a tela inteira, e ganhou os dois.
//
// Os quatro números e a série vieram inteiros do Início, sem mudança de
// significado: a mesma consulta, os mesmos nomes de coluna, os mesmos rótulos.
// Esta entrega move a pergunta de lugar; ela não redefine nenhuma resposta.

const DIAS_GRAFICO = 14;

type Counts = {
  autos: number;
  contacts: number;
  contacts7: number;
  pending: number;
  sent7: number;
  sent_prev7: number;
};

const ZERO: Counts = {
  autos: 0,
  contacts: 0,
  contacts7: 0,
  pending: 0,
  sent7: 0,
  sent_prev7: 0,
};

// Monta os últimos N dias já com a contagem de cada um. Fica fora do
// componente porque lê o relógio — o compilador do React exige render puro.
function montarSerie(porDia: Map<string, number>) {
  const hoje = Date.now();
  return Array.from({ length: DIAS_GRAFICO }, (_, i) => {
    const chave = chaveDoDia(new Date(hoje - (DIAS_GRAFICO - 1 - i) * 86_400_000));
    return { chave, rotulo: chave.slice(8), n: porDia.get(chave) ?? 0 };
  });
}

export default async function Desempenho() {
  const account = await getSelectedAccount();

  const [counts, serie] = await Promise.all([
    (async () =>
      account
        ? ((
            (await sql().query(
              `select
                 (select count(*)::int from automations where account_id = $1 and active = true) as autos,
                 (select count(*)::int from contacts where account_id = $1) as contacts,
                 (select count(*)::int from contacts where account_id = $1
                    and first_contact_at > now() - interval '7 days') as contacts7,
                 -- OS DOIS ESTADOS, para o numero desta tela nao mudar de
                 -- sentido sem ninguem decidir: o item de lote que espera saiu
                 -- de pending e foi para guardado (migrations/009), e lista-lo
                 -- aqui e o que mantem "Na fila" contando o mesmo que contava
                 -- ontem: tudo o que ainda nao saiu. QUAL dos dois e cada um se
                 -- responde na tela de Envios, que tem o filtro "guardadas".
                 -- A lista vem por parametro ($2, STATUS_DE_FILA_VIVA de
                 -- lib/envio-filters.ts), e nao escrita a mao aqui.
                 -- (sem crases neste comentario: ele mora DENTRO de um template
                 --  literal, e uma crase o fecharia no meio.)
                 (select count(*)::int from queue where account_id = $1
                    and status = any($2::text[])) as pending,
                 -- "MENSAGENS ENTREGUES" NAO CONTA POST PUBLICADO.
                 --
                 -- O DEFEITO, medido em producao em 15/09/2026: esta tela dizia
                 -- "Mensagens entregues: 5" e o motor tinha entregue 3 — os
                 -- outros dois eram POSTS. As duas subconsultas abaixo nao
                 -- tinham NENHUM filtro de kind. A exclusao e a MESMA lista
                 -- ($3, KINDS_FORA_DA_ENTREGA_DO_MOTOR de lib/envio-filters.ts)
                 -- que app/page.tsx usa para o pulso do Inicio — a mesma
                 -- subconsulta alimenta as duas telas.
                 (select count(*)::int from queue where account_id = $1 and status = 'sent'
                    and sent_at > now() - interval '7 days'
                    and not (kind = any($3::text[]))) as sent7,
                 (select count(*)::int from queue where account_id = $1 and status = 'sent'
                    and sent_at > now() - interval '14 days'
                    and sent_at <= now() - interval '7 days'
                    and not (kind = any($3::text[]))) as sent_prev7`,
              [account.ig_user_id, Array.from(STATUS_DE_FILA_VIVA), Array.from(KINDS_FORA_DA_ENTREGA_DO_MOTOR)]
            )) as Counts[]
          )[0] ?? ZERO)
        : ZERO)(),

    (async () =>
      account
        ? ((await sql().query(
            // O MESMO DEFEITO DE `sent7`, ACHADO NA MESMA REVISÃO: esta consulta
            // alimenta <SentChart>, que soma as barras exibidas embaixo do cartão
            // "Mensagens entregues". Sem o filtro, o cartão (consertado acima)
            // dizia "3" e o gráfico, na MESMA tela, somava "5" — post publicado
            // contado como mensagem, só que embaixo em vez de em cima. A exclusão
            // é a MESMA lista ($3, KINDS_FORA_DA_ENTREGA_DO_MOTOR), pelo mesmo
            // motivo.
            `select to_char(sent_at at time zone $2, 'YYYY-MM-DD') as dia, count(*)::int as n
             from queue
             where account_id = $1 and status = 'sent'
               and sent_at > now() - interval '14 days'
               and not (kind = any($3::text[]))
             group by 1`,
            [account.ig_user_id, FUSO, Array.from(KINDS_FORA_DA_ENTREGA_DO_MOTOR)]
          )) as { dia: string; n: number }[])
        : [])(),
  ]);

  const dias = montarSerie(new Map(serie.map((r) => [r.dia, r.n])));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="titulo text-2xl font-bold">Desempenho</h1>
        <p className={`mt-0.5 text-sm ${muted}`}>
          {account
            ? `Os últimos ${DIAS_GRAFICO} dias de @${account.username ?? account.ig_user_id}`
            : "Conecte uma conta do Instagram para ver os números"}
        </p>
      </header>

      {!account ? (
        <div className={`p-6 text-sm ${card} ${muted}`}>
          Nenhuma conta conectada ainda. Vá em{" "}
          <Link href="/setup" className={link}>
            Configuração
          </Link>
          .
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              icon={IconUsers}
              label="Pessoas alcançadas"
              value={counts.contacts}
              trend={counts.contacts7}
              hint="novas em 7 dias"
            />
            <StatCard
              icon={IconSend}
              label="Mensagens entregues"
              value={counts.sent7}
              trend={counts.sent7 - counts.sent_prev7}
              hint="vs. 7 dias antes"
            />
            <StatCard
              icon={IconZap}
              label="Automações ativas"
              value={counts.autos}
              hint={counts.autos ? "respondendo agora" : "nenhuma ligada"}
            />
            <StatCard
              icon={IconClock}
              label="Na fila"
              value={counts.pending}
              hint={counts.pending ? "a caminho" : "nada pendente"}
            />
          </div>

          <SentChart dias={dias} />

          <p className={`text-xs ${muted}`}>
            Conta conectada em {fmtDate(account.connected_at)} · acesso renovado
            automaticamente até {fmtDate(account.token_expires_at)}
          </p>
        </>
      )}
    </div>
  );
}
