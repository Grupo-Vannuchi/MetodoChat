import Link from "next/link";
import { sql, getConfig, isMetaConfigured } from "@/lib/db";
import { getSelectedAccount } from "@/lib/account";
import { listConversations } from "@/lib/conversations";
import { windowState } from "@/lib/inbox-window";
import {
  oQuePrecisaDeVoce,
  legendaDoPrazo,
  recorteDasOportunidades,
  type FatosDoInicio,
  type Oportunidade,
} from "@/lib/precisa-de-voce";
import {
  DIAS_DE_AVISO_DA_PUBLICACAO,
  HORAS_DE_AVISO_DA_MENSAGEM,
} from "@/lib/publicacao";
import { oportunidadesDaConta } from "@/lib/oportunidades";
import { fraseDoPulso, fraseDas24h } from "@/lib/pulso";
// KINDS_FORA_DA_ENTREGA_DO_MOTOR É A LISTA DE VERDADE DE "ISSO NÃO É O MOTOR
// ENTREGANDO": o pulso não pode escrever `'dm_manual'` nem `'publicacao'` de
// próprio punho, porque as duas strings já moram em lib/envio-filters.ts
// (espelhadas pelo SQL de Envios) — uma segunda definição aqui é a próxima
// divergência. STATUS_DE_FILA_VIVA é a mesma ideia para "o que ainda vai
// sair" (mora ao lado, no mesmo arquivo).
import { KINDS_FORA_DA_ENTREGA_DO_MOTOR, STATUS_DE_FILA_VIVA } from "@/lib/envio-filters";
// TIPOS_DE_MENSAGEM_RECEBIDA É A MESMA LISTA QUE app/contatos/page.tsx e
// app/contatos/actions.ts usam: os quatro `type` de evento que significam
// "alguém falou com a conta". Escrevê-la à mão aqui foi o defeito medido em
// 15/09/2026 — ver o comentário no próprio arquivo.
import { TIPOS_DE_MENSAGEM_RECEBIDA } from "@/lib/event-filters";
import { resolvePosts, type PostRef } from "@/lib/media-lookup";
import { fmtRelative } from "@/lib/format";
import { card, btnPrimary, btnGhost, muted, link, alertError, alertOk, rowDivide, badgeAcao } from "./ui";
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
  entregues_hoje: number;
  ultima_entrega: Date | null;
  na_fila: number;
  com24: number;
  msg24: number;
  env24: number;
  // MEDIDO DIZ SE ESTE OBJETO VEIO DO BANCO. A consulta de sinais não tem rede
  // própria (item 4 da revisão de 15/09/2026): um erro nela não pode derrubar
  // o Início inteiro, então ela ganha `try/catch` — mas devolver ZERO calado
  // no catch reabriria o MESMO silêncio-que-parece-saúde que o pulso existe
  // para fechar ("nada entregue hoje · nenhuma entrega ainda · fila vazia" é
  // exatamente a frase de uma conta saudável e ociosa). `medido: false` é o
  // que distingue "não aconteceu nada" de "não consegui medir".
  medido: boolean;
};

const ZERO: Sinais = {
  autos: 0,
  sent7: 0,
  falhas_publicacao: 0,
  falhas_mensagem: 0,
  last_event: null,
  entregues_hoje: 0,
  ultima_entrega: null,
  na_fila: 0,
  com24: 0,
  msg24: 0,
  env24: 0,
  medido: false,
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ conectado?: string; erro?: string }>;
}) {
  const sp = await searchParams; // Next 16: searchParams é assíncrono
  const [config, account] = await Promise.all([getConfig(), getSelectedAccount()]);

  const [sinais, conversas, oportunidadesCruas] = await Promise.all([
    // CADA BLOCO FALHA SOZINHO (mesma restrição das oportunidades, abaixo): um
    // erro nesta consulta não pode derrubar o Início inteiro. O `try/catch`
    // devolve ZERO com `medido: false` — e é o `medido` que evita o outro
    // silêncio-que-parece-saúde: ZERO cru renderizaria "nada entregue hoje ·
    // nenhuma entrega ainda · fila vazia", a MESMA frase de uma conta saudável
    // e ociosa. `medido: false` deixa a tela dizer "não consegui medir",
    // que é a verdade.
    (async () => {
      if (!account) return ZERO;
      try {
        const linhas = (await sql().query(
          `select
                 (select count(*)::int from automations where account_id = $1 and active = true) as autos,
                 -- "MENSAGENS ENTREGUES" NÃO CONTA POST PUBLICADO.
                 --
                 -- O DEFEITO, medido em producao em 15/09/2026: a tela de
                 -- Desempenho dizia "Mensagens entregues: 5" e o motor tinha
                 -- entregue 3 — os outros dois eram POSTS. Esta subconsulta
                 -- nao tinha NENHUM filtro de kind, e e a mesma que alimenta o
                 -- estado calmo do Inicio ("N mensagens entregues em 7 dias").
                 -- A exclusao e a MESMA lista ($4) que o pulso ja usa logo
                 -- abaixo, e nao uma segunda.
                 -- (sem crases neste comentario: ele mora DENTRO de um template
                 --  literal, e uma crase o fecharia no meio.)
                 (select count(*)::int from queue where account_id = $1 and status = 'sent'
                    and sent_at > now() - interval '7 days'
                    and not (kind = any($4::text[]))) as sent7,
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
                 -- O PULSO. "hoje" e o dia de SAO PAULO, e nao de UTC: o
                 -- servidor roda em UTC, e as 21h de Brasilia ja sao o dia
                 -- seguinte la. Sem o at time zone, toda entrega do fim da
                 -- tarde apareceria como "de amanha" e o painel diria "nada
                 -- entregue hoje" com tres envios no relogio do dono.
                 -- (sem crases neste comentario, pelo mesmo motivo do de cima:
                 --  o comentario mora dentro do template literal da consulta.)
                 --
                 -- O PULSO CONTA O QUE O MOTOR ENTREGOU SOZINHO, e por isso as
                 -- duas subconsultas abaixo excluem UMA lista so ($4,
                 -- KINDS_FORA_DA_ENTREGA_DO_MOTOR de lib/envio-filters.ts):
                 -- "dm_manual" e a resposta que uma PESSOA digitou na tela de
                 -- conversa, e "publicacao" e post, nao mensagem. Ate
                 -- 15/09/2026 o "kind <> 'publicacao'" vinha escrito a mao ao
                 -- lado do parametro — a MESMA divergencia que inflou
                 -- "Mensagens entregues" em /desempenho. Sem este filtro,
                 -- alguem respondendo a mao com o motor morto faria o pulso
                 -- dizer "3 entregues hoje" - o silencio-que-parece-saude que
                 -- este arquivo existe para fechar.
                 (select count(*)::int from queue
                   where account_id = $1 and status = 'sent'
                     and (sent_at at time zone 'America/Sao_Paulo')::date
                         = (now() at time zone 'America/Sao_Paulo')::date
                     and not (kind = any($4::text[]))) as entregues_hoje,
                 (select max(sent_at) from queue
                   where account_id = $1 and status = 'sent'
                     and not (kind = any($4::text[]))) as ultima_entrega,
                 -- "GUARDADO" E FILA VIVA (migrations/009-fila-estado-guardado.sql):
                 -- um lote inteiro pode estar esperando a pessoa voltar a
                 -- falar, e isso nao e "fila vazia". app/desempenho/page.tsx
                 -- ja soma os dois estados pelo mesmo motivo, e os dois agora
                 -- leem STATUS_DE_FILA_VIVA ($5, lib/envio-filters.ts) por
                 -- parametro, e nao uma lista escrita a mao aqui.
                 (select count(*)::int from queue
                   where account_id = $1 and status = any($5::text[])) as na_fila,
                 -- AS 24H CONTAM EVENTOS, e o pulso conta a FILA. Ver o
                 -- comentario de fraseDas24h (lib/pulso.ts): os dois numeros
                 -- divergem de proposito, porque message_sent inclui a
                 -- resposta que alguem digitou na tela de conversa.
                 (select count(*)::int from events
                   where account_id = $1 and type = 'comment'
                     and created_at > now() - interval '24 hours') as com24,
                 -- QUATRO TIPOS SAO "mensagem recebida", e nao um: o motor
                 -- grava 'message', 'story_reply', 'quick_reply' e 'abertura'
                 -- (lib/engine.ts). A mesma lista ja vive em
                 -- app/contatos/actions.ts e app/contatos/page.tsx, e agora as
                 -- tres leem TIPOS_DE_MENSAGEM_RECEBIDA ($6,
                 -- lib/event-filters.ts) por parametro, em vez de cada uma
                 -- escrever os quatro tipos a mao.
                 (select count(*)::int from events
                   where account_id = $1
                     and type = any($6::text[])
                     and created_at > now() - interval '24 hours') as msg24,
                 (select count(*)::int from events
                   where account_id = $1 and type = 'message_sent'
                     and created_at > now() - interval '24 hours') as env24,
                 (select max(created_at) from events where account_id = $1) as last_event`,
          [
            account.ig_user_id,
            DIAS_DE_AVISO_DA_PUBLICACAO,
            HORAS_DE_AVISO_DA_MENSAGEM,
            Array.from(KINDS_FORA_DA_ENTREGA_DO_MOTOR),
            Array.from(STATUS_DE_FILA_VIVA),
            Array.from(TIPOS_DE_MENSAGEM_RECEBIDA),
          ]
        )) as Omit<Sinais, "medido">[];
        return linhas[0] ? { ...linhas[0], medido: true } : ZERO;
      } catch (e) {
        console.error("inicio: os sinais falharam", e);
        return ZERO;
      }
    })(),

    // QUEM ESTA ESPERANDO. A mesma consulta da lista de conversas, e não uma
    // segunda: `sem_resposta` (a última palavra foi dela) e `last_reply_at` (o
    // que abre a janela) já saem dali prontos.
    //
    // O LIMITE DE 50 NÃO PERDE NINGUÉM QUE IMPORTE: a lista vem em `last_at
    // desc`, e só tem janela aberta quem falou nas últimas 24h — para alguém
    // com janela aberta ficar de fora, seria preciso ter havido mais de 50
    // conversas distintas em 24 horas nesta conta.
    (async () => (account ? await listConversations(account.ig_user_id, 50) : []))(),

    // CADA BLOCO FALHA SOZINHO. Uma consulta que estoura nao pode levar a tela
    // junto: o Inicio e a pagina de maior frequencia do painel, e uma falha
    // aqui e a doenca de 09/09 (500 com corpo vazio) por outra porta. Sem as
    // oportunidades a tela serve; sem a tela, nada serve.
    (async () => {
      if (!account) return [] as Oportunidade[];
      try {
        return await oportunidadesDaConta(account.ig_user_id);
      } catch (e) {
        console.error("inicio: oportunidades falharam", e);
        return [] as Oportunidade[];
      }
    })(),
  ]);

  // O NOME DO POST, E ELE É OPCIONAL POR CONSTRUÇÃO.
  //
  // `resolvePosts` (lib/media-lookup.ts) fala com a Meta: uma listagem dos 40
  // recentes mais até 8 buscas avulsas, com `try/catch` interno que devolve
  // mapa parcial ou vazio. Já está em produção em `/eventos`.
  //
  // SÓ AS QUE VÃO APARECER SÃO PROCURADAS: `recorteDasOportunidades` corta em
  // três ANTES, então o pior caso desta tela são três ids — que cabem na
  // listagem dos recentes, porque post que está recebendo comentário agora é
  // post recente. Uma chamada, e nenhuma busca avulsa no caso comum.
  //
  // E ELA NÃO ESTÁ NO CAMINHO CRÍTICO: sem o nome, a linha renderiza inteira
  // ("100 comentários sem automação · último há 2 h"). O `catch` aqui é a
  // segunda rede, para o caso de `resolvePosts` lançar por algo que o
  // `try/catch` de dentro dele não cobre.
  //
  // MAS `try/catch` SÓ COBRE REJEIÇÃO, E NÃO SILÊNCIO — POR ISSO A CORRIDA
  // ABAIXO CONTINUA. `graphFetch` (lib/ig.ts) já tem o TETO DA LEITURA
  // (`TETO_DA_LEITURA_MS`, 8s por requisição): uma chamada de leitura
  // pendurada termina sozinha, em vez de travar para sempre. Mas 8s por
  // requisição ainda é mais devagar do que esta tela — a de maior frequência
  // do painel — deveria esperar, então a corrida abaixo continua valendo por
  // outro motivo: ela é o teto da TELA, mais apertado (2,5s) que o teto da
  // rede. Perde a corrida, a tela renderiza sem os nomes; a requisição por
  // baixo segue — `resolvePosts` (lib/media-lookup.ts) encadeia duas etapas
  // sequenciais (`getMedia`, depois um `Promise.allSettled` de até 8
  // `getMediaById`), então o pior caso por baixo é ~16s, não 8 — não pendurada
  // para sempre, como antes.
  const TETO_DO_NOME_DO_POST_MS = 2500;
  const escolhidas = recorteDasOportunidades(oportunidadesCruas);
  let nomes = new Map<string, PostRef>();
  if (account && escolhidas.length) {
    // `idDoTimer` cancela o `setTimeout` quando `resolvePosts` ganha a
    // corrida primeiro — o caso comum. Sem o `clearTimeout`, um timer de
    // 2,5s sobrevive a cada carregamento do Início, pendurado à toa.
    let idDoTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      nomes = await Promise.race([
        resolvePosts(
          account.ig_user_id,
          account.access_token,
          escolhidas.map((o) => o.mediaId)
        ),
        new Promise<Map<string, PostRef>>((resolve) => {
          idDoTimer = setTimeout(() => resolve(new Map()), TETO_DO_NOME_DO_POST_MS);
        }),
      ]);
    } catch (e) {
      console.error("inicio: nomes dos posts falharam", e);
    } finally {
      clearTimeout(idDoTimer);
    }
  }
  const oportunidades = escolhidas.map((o) => ({
    ...o,
    nome: nomes.get(o.mediaId)?.caption ?? null,
  }));

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
    oportunidades,
  };

  // QUANDO A CONSULTA NAO RODOU (`medido: false`), NAO CHAMAMOS `fraseDoPulso`
  // COM ZEROS: ela diria "nada entregue hoje · nenhuma entrega ainda · fila
  // vazia", que é a mesma frase de uma conta saudável e ociosa — o
  // silêncio-que-parece-saúde por outra porta. "não consegui medir" é a frase
  // honesta para esse caso.
  const pulso = sinais.medido
    ? fraseDoPulso({
        entreguesHoje: sinais.entregues_hoje,
        ultimaEntrega: sinais.ultima_entrega,
        naFila: sinais.na_fila,
      })
    : "não consegui medir o pulso agora";
  const vinte4h = fraseDas24h({
    comentarios: sinais.com24,
    mensagens: sinais.msg24,
    enviadas: sinais.env24,
  });

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
            {/*
              O "Reconectar" perde o lugar de honra: era renderizado SEMPRE
              que existe conta — não é condicional a problema nenhum — e era
              o único botão da tela, anunciando avaria numa conta saudável.
              Ele vira link de texto discreto, ao lado do @usuário.
            */}
            <p className={`mt-0.5 flex flex-wrap items-center gap-2 text-sm ${muted}`}>
              {account ? (
                <>
                  <span>@{account.username ?? account.ig_user_id}</span>
                  <a href="/api/oauth/login" className={`text-xs ${link}`}>
                    Reconectar
                  </a>
                </>
              ) : (
                "Comece conectando sua conta do Instagram"
              )}
            </p>
          </div>
        </div>
        {account ? (
          // O QUE ENTRA NO LUGAR DO "RECONECTAR": as duas ações que esta tela
          // realmente convida — publicar e automatizar.
          <div className="flex items-center gap-2">
            <Link href="/publicar/novo" className={btnPrimary}>
              Criar post
            </Link>
            <Link href="/automacoes/nova" className={btnGhost}>
              Nova automação
            </Link>
          </div>
        ) : (
          <Link href="/setup" className={btnPrimary}>
            {isMetaConfigured(config) ? "Continuar configuração" : "Começar configuração"}
          </Link>
        )}
      </header>

      {/* O PULSO. Uma linha, sempre visível, inclusive quando está tudo bem:
          silêncio não responde "está rodando?", porque silêncio é também o que
          aparece quando a medição quebrou. Ela é discreta de propósito — não
          compete com quem está esperando, que é o assunto principal da tela. */}
      {account && <p className={`text-xs ${muted}`}>{pulso}</p>}

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
                  {/* A LINHA DA OPORTUNIDADE SE DISTINGUE DA CONVERSA: o selo é
                      a affordance, e a linha inteira já é o link para
                      `/automacoes/nova?post=…` (Tarefa 1). O selo vem do
                      próprio item (`ItemDoInicio.selo`), e não de checar o
                      formato de `chave` — a chave é identidade de lista, não
                      contrato de desenho. */}
                  {i.selo && <span className={`${badgeAcao} shrink-0`}>{i.selo}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* AS DUAS COLUNAS, abaixo da lista de "Precisa de você" — o corpo que
          faltava na tela: o que vem a seguir, e o que já aconteceu. */}
      {account && (
        <div className="grid gap-4 sm:grid-cols-2">
          <section className={`p-4 ${card}`}>
            <h2 className="titulo text-sm font-semibold">Adiante</h2>
            {/* O "ADIANTE" NASCE SÓ COMO CONVITE, E É DÍVIDA DECLARADA: medido
                em 14/09, a fila não tem NENHUM item pendente, de nenhum tipo.
                Escrever a lista agora seria escrever código que nunca
                renderizou uma linha — quando houver agendamento de verdade,
                esta seção passa a listar até três, e a consulta entra na
                Tarefa 3. */}
            <p className={`mt-2 text-sm ${muted}`}>Nada agendado.</p>
            <p className="mt-3 text-sm">
              <Link href="/publicar/novo" className={link}>
                Criar post →
              </Link>
            </p>
          </section>
          <section className={`p-4 ${card}`}>
            <h2 className="titulo text-sm font-semibold">Nas últimas 24h</h2>
            <p className={`mt-2 text-sm ${muted}`}>{vinte4h}</p>
            <p className="mt-3 text-sm">
              <Link href="/eventos" className={link}>
                Ver a atividade →
              </Link>
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
