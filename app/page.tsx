import Link from "next/link";
import { sql, getConfig, isMetaConfigured } from "@/lib/db";
import { getSelectedAccount } from "@/lib/account";
import { listConversations } from "@/lib/conversations";
import { windowState } from "@/lib/inbox-window";
import {
  oQuePrecisaDeVoce,
  legendaDoPrazo,
  type FatosDoInicio,
} from "@/lib/precisa-de-voce";
import {
  DIAS_DE_AVISO_DA_PUBLICACAO,
  HORAS_DE_AVISO_DA_MENSAGEM,
} from "@/lib/publicacao";
import { fmtRelative } from "@/lib/format";
import { card, btnPrimary, btnGhost, muted, link, alertError, alertOk, rowDivide } from "./ui";
import { TracoDaJanela, PontoDaLinha } from "./traco-da-janela";
import Avatar from "./avatar";

export const dynamic = "force-dynamic";

// O INÍCIO RESPONDE UMA PERGUNTA SÓ: "precisa de mim?".
//
// Até 10/09/2026 esta tela respondia três ao mesmo tempo — "precisa de mim?",
// "o que aconteceu?" e "está funcionando?" — empilhadas em quatro contadores,
// um gráfico sem eixo e uma lista de eventos. As três têm RITMOS diferentes
// (dez vezes por dia, uma vez por dia, uma vez por semana), e empilhá-las é o
// que produzia o amontoado que a auditoria de design mediu.
//
// As outras duas foram para onde já pertenciam: "o que aconteceu?" é
// `/eventos`, que já existia, e "está funcionando?" é `/desempenho`, que nasceu
// nesta entrega com os quatro números e o gráfico — agora com eixo e valor.
//
// E ESTA TELA QUER FICAR VAZIA. Quando nada precisa do dono, ela diz isso e
// para de falar. O vazio é a resposta, e não um espaço a preencher.
//
// A DECISÃO NÃO MORA AQUI: `oQuePrecisaDeVoce` (lib/precisa-de-voce.ts) decide
// o que entra e em que ordem, e tem 20 casos. A suíte não testa componente.

type Sinais = {
  autos: number;
  sent7: number;
  falhas_publicacao: number;
  falhas_mensagem: number;
  last_event: Date | null;
};

const ZERO: Sinais = {
  autos: 0,
  sent7: 0,
  falhas_publicacao: 0,
  falhas_mensagem: 0,
  last_event: null,
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ conectado?: string; erro?: string }>;
}) {
  const sp = await searchParams; // Next 16: searchParams é assíncrono
  const [config, account] = await Promise.all([getConfig(), getSelectedAccount()]);

  const [sinais, conversas] = await Promise.all([
    (async () =>
      account
        ? ((
            (await sql().query(
              `select
                 (select count(*)::int from automations where account_id = $1 and active = true) as autos,
                 (select count(*)::int from queue where account_id = $1 and status = 'sent'
                    and sent_at > now() - interval '7 days') as sent7,
                 -- AS DUAS JANELAS SAO DIFERENTES DE PROPOSITO, e as duas sao
                 -- parametro: publicacao vai a 7 dias porque o modo de falha
                 -- declarado e "falha na sexta a noite, ninguem ve ate segunda";
                 -- mensagem fica nas 24 horas de sempre. Os numeros vem das
                 -- constantes que a FRASE tambem le (lib/publicacao.ts).
                 --
                 -- E A COLUNA DA PUBLICACAO E claimed_at, E NAO created_at:
                 -- created_at e quando o post foi AGENDADO, e um lancamento
                 -- marcado com tres semanas de antecedencia cairia fora de
                 -- qualquer janela no dia em que falhasse. O coalesce e a rede
                 -- do item que nunca foi reivindicado, e ele e MEDIDO em
                 -- testes-integracao/nao-saiu.integracao.ts.
                 -- (sem crases neste comentario: ele mora DENTRO de um template
                 --  literal, e uma crase o fecharia no meio.)
                 (select count(*)::int from queue where account_id = $1 and status = 'failed'
                    and kind = 'publicacao'
                    and coalesce(claimed_at, not_before)
                        > now() - make_interval(days => $2::int)) as falhas_publicacao,
                 (select count(*)::int from queue where account_id = $1 and status = 'failed'
                    and kind <> 'publicacao'
                    and created_at > now() - make_interval(hours => $3::int))
                    as falhas_mensagem,
                 (select max(created_at) from events where account_id = $1) as last_event`,
              [account.ig_user_id, DIAS_DE_AVISO_DA_PUBLICACAO, HORAS_DE_AVISO_DA_MENSAGEM]
            )) as Sinais[]
          )[0] ?? ZERO)
        : ZERO)(),

    // QUEM ESTA ESPERANDO. A mesma consulta da lista de conversas, e não uma
    // segunda: `sem_resposta` (a última palavra foi dela) e `last_reply_at` (o
    // que abre a janela) já saem dali prontos.
    //
    // O LIMITE DE 50 NÃO PERDE NINGUÉM QUE IMPORTE: a lista vem em `last_at
    // desc`, e só tem janela aberta quem falou nas últimas 24h — para alguém
    // com janela aberta ficar de fora, seria preciso ter havido mais de 50
    // conversas distintas em 24 horas nesta conta.
    (async () => (account ? await listConversations(account.ig_user_id, 50) : []))(),
  ]);

  const agora = Date.now();
  const fatos: FatosDoInicio = {
    esperando: conversas
      .filter((c) => c.sem_resposta)
      .map((c) => ({
        igId: c.ig_id,
        quem: c.username,
        // A JANELA TEM UMA FONTE SÓ. `windowState` é a mesma função que o motor
        // usa para recusar envio — restrição declarada na spec.
        msLeft: windowState(c.last_reply_at, agora).msLeft,
      })),
    falhasPublicacao: sinais.falhas_publicacao,
    falhasMensagem: sinais.falhas_mensagem,
    automacoesAtivas: sinais.autos,
  };

  const itens = account ? oQuePrecisaDeVoce(fatos) : [];

  return (
    <div className="space-y-6">
      {sp.conectado && (
        <div className={alertOk}>
          Instagram conectado com sucesso! Os webhooks da conta foram assinados.
        </div>
      )}
      {sp.erro && <div className={alertError}>Erro: {sp.erro}</div>}

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {account && (
            <Avatar
              src={account.profile_picture_url}
              name={account.username ?? "?"}
              className="h-10 w-10"
              textClassName="text-sm"
            />
          )}
          <div>
            <h1 className="titulo text-2xl font-bold">Início</h1>
            <p className={`mt-0.5 text-sm ${muted}`}>
              {account
                ? `@${account.username ?? account.ig_user_id}`
                : "Comece conectando sua conta do Instagram"}
            </p>
          </div>
        </div>
        {account ? (
          <a href="/api/oauth/login" className={btnGhost}>
            Reconectar
          </a>
        ) : (
          <Link href="/setup" className={btnPrimary}>
            {isMetaConfigured(config) ? "Continuar configuração" : "Começar configuração"}
          </Link>
        )}
      </header>

      {!account ? (
        <div className={`p-6 text-sm ${card} ${muted}`}>
          Nenhuma conta conectada ainda. Vá em{" "}
          <Link href="/setup" className={link}>
            Configuração
          </Link>{" "}
          — o assistente te guia passo a passo (leva uns 15 minutos, só na primeira vez).
        </div>
      ) : itens.length === 0 ? (
        // O ESTADO CALMO — o desfecho comum, e o que esta tela existe para
        // poder dizer. Não é tela de erro nem espaço à espera de conteúdo: é a
        // resposta "não, não precisa de você". Por isso a frase é grande e
        // afirmativa, e por isso o que vem depois é UMA linha de tranquilização
        // — o bastante para saber que a máquina trabalhou, e não o bastante
        // para começar a ler relatório numa tela que se abre dez vezes por dia.
        //
        // ELE É ESCRITO AQUI, E NÃO NUM COMPONENTE À PARTE, e a razão é do
        // instrumento: `textoDaArvore` (testes-integracao/) anda pelos `props`
        // da árvore e NUNCA chama a função de um componente filho. Um `<Calmo
        // …/>` apareceria no texto como `autos=1 sent7=0` e nenhuma das frases
        // dele — e os casos que medem o silêncio do painel ficariam medindo
        // uma tela que não conseguem ler. Foi o que aconteceu em 10/09/2026.
        <section className={`px-6 py-16 text-center ${card}`}>
          <p className="titulo text-2xl font-bold sm:text-3xl">Nada precisa de você agora.</p>
          <p className={`mx-auto mt-3 max-w-lg text-sm ${muted}`}>
            {[
              `${sinais.autos} ${sinais.autos === 1 ? "automação respondendo" : "automações respondendo"}`,
              `${sinais.sent7} ${sinais.sent7 === 1 ? "mensagem entregue" : "mensagens entregues"} em 7 dias`,
              ...(sinais.last_event ? [`última interação ${fmtRelative(sinais.last_event)}`] : []),
            ].join(" · ")}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
            <Link href="/desempenho" className={link}>
              Ver o desempenho
            </Link>
            <Link href="/eventos" className={link}>
              Ver o que aconteceu
            </Link>
          </div>
        </section>
      ) : (
        <section className={card}>
          <h2 className="border-b border-traco px-5 py-3.5 text-sm font-semibold dark:border-traco-escuro">
            <span className="titulo">Precisa de você</span>
          </h2>
          <ul className={rowDivide}>
            {itens.map((i) => (
              <li key={i.chave}>
                <Link
                  href={i.href}
                  className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-papel focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acao/25 dark:hover:bg-traco-escuro/30 dark:focus-visible:ring-acao-escuro/25"
                >
                  {i.msLeft !== undefined ? (
                    <TracoDaJanela msLeft={i.msLeft} urgencia={i.urgencia} />
                  ) : (
                    <PontoDaLinha urgencia={i.urgencia} />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{i.titulo}</span>
                    <span className={`block truncate text-xs ${muted}`}>{i.detalhe}</span>
                  </span>
                  {i.msLeft !== undefined && (
                    <span className={`shrink-0 text-xs ${muted}`}>
                      {legendaDoPrazo(i.msLeft)}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
