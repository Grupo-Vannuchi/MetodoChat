import Link from "next/link";
import { sql, type QueueItem } from "@/lib/db";
import { getSelectedAccount } from "@/lib/account";
import { fmtDate } from "@/lib/format";
import { avisoDaUrl } from "@/lib/avisos";
import {
  avisoDoAtrasoNaLista,
  dataDaLinhaDeEnvio,
  lerPayloadDaPublicacao,
  linhaDaFalha,
  rotuloDaFormaDoItem,
  FRASE_DA_FALHA,
} from "@/lib/publicacao";
import {
  card,
  muted,
  link,
  btnGhost,
  btnPrimary,
  numero,
  pageTitle,
  pageSubtitle,
  alertOk,
  alertError,
  emptyWrap,
} from "../ui";
import { urlPublicaSeDerParaMontar } from "@/lib/bucket";
import {
  chaveDoDia,
  horaDoDia,
  gradeDoMes,
  gradeDaSemana,
  visaoDaUrl,
  ancoraDaUrl,
  agruparPorDia,
  recorteDoDia,
  diaSomado,
} from "@/lib/calendario";

// A CARA DA SEÇÃO DE PUBLICAÇÕES — componente de SERVIDOR, sem uma linha de
// cliente.
//
// POR QUE O CALENDÁRIO É A PORTA, E NÃO O FORMULÁRIO DE COMPOR (11/09/2026).
//
// Até aqui `/publicar` abria direto num formulário — forma, arquivo, legenda.
// Era a ÚNICA seção do painel que fazia isso: Conversas abre a lista,
// Automações abre a lista com "Nova automação" como botão, e Contatos acabou
// de FECHAR o formulário de disparo em massa pelo mesmo motivo (achado D4:
// ação não pode ser o estado padrão de uma tela de leitura).
//
// E AQUI A REGRA VALE MAIS DO QUE EM QUALQUER OUTRO LUGAR, por um motivo deste
// produto e não de gosto: a API do Instagram NÃO APAGA MÍDIA. O erro que
// ver-antes-de-agir evita — postar em cima de um post que já existe, agendar
// duplicado — é o único erro do painel que não tem desfazer. Trocar a ordem põe
// a tela barata antes da ação cara.
//
// O compositor foi para `/publicar/novo`, e o "Criar post" daqui é a porta
// dele.
//
// =============================================================================
// POR QUE ELA EXISTE, e por que não é mais uma seção em Envios
//
// A publicação subiu em 03/09 sem NENHUMA forma de olhar para o que foi
// agendado. Envios (`/eventos`) é HISTÓRICO: passado, ordenado por quando
// aconteceu, com uma coluna de data que significa "quando saiu". Um agendamento
// faz a pergunta oposta — "o que vai acontecer, e posso mudar?" —, e enfiar
// futuro naquela lista obrigaria a mesma coluna a significar duas coisas.
//
// É urgente porque a API do Instagram NÃO APAGA MÍDIA (medido em 03/09): um
// post agendado por engano só se corrige ANTES de sair.
//
// =============================================================================
// NENHUMA DECISÃO NO JSX, e a lista aqui é curta de propósito
//
// O aviso vem de `avisoDaUrl`; a data de `dataDaLinhaDeEnvio`; a FRASE que vem
// antes dela de `fraseDaDataDaLinha` (a mesma que a linha de Envios lê); o nome
// da forma de `rotuloDaFormaDoItem`; a linha do item atrasado de
// `avisoDoAtrasoNaLista`; o começo da legenda de `resumoDaLegenda`; o payload de
// `lerPayloadDaPublicacao`, que RECUSA em vez de confiar num `jsonb` que pode
// ter sido editado por fora.
//
// QUATRO DECISÕES AINDA MORAVAM AQUI ATÉ 09/09/2026, e uma delas discordava da
// tela de Envios sobre o mesmo fato. A suíte pura não testa componente, mas
// `agendados.integracao.ts` agora CHAMA esta função e lê a árvore que ela
// devolve — que é o que finalmente prende a consulta abaixo.
//
// =============================================================================
// A CONTA VEM DO COOKIE, e o formulário só carrega o identificador
//
// O `<input type="hidden" name="id">` é do usuário, como todo campo. Quem
// impede que um identificador trocado atinja o post de outra conta (ou uma
// MENSAGEM da fila) são as três condições do `where` das ações — nunca esta
// tela. Ver o cabeçalho de `./actions.ts`.

export const dynamic = "force-dynamic";

/** Quantos posts a grade desenha num período.
 *
 *  MEDIDO EM 11/09/2026, na conta de produção: 3 publicações ao todo e pico de
 *  2 por mês. O teto é folga para anos, não um corte que morde — mas ele
 *  MORDE CALADO se um dia chegar lá, e a revisão pegou isso: a consulta passou
 *  de `status='pending'` (lista curta por natureza) para `pending + sent` numa
 *  janela de 42 dias, ordenada por data ASCENDENTE. O corte derruba o FIM do
 *  período, então as últimas semanas do mês apareceriam vazias e alguém
 *  agendaria em cima de post existente.
 *
 *  A resposta é a mesma disciplina do resto desta entrega — quem corta tem de
 *  contar —, e ela está logo abaixo da grade. */
const AGENDADOS_NA_TELA = 200;

/** Quantas falhas cabem na segunda seção.
 *
 *  ELA NÃO TEM RECORTE DE TEMPO, e o teto é o que a substitui: esta é a tela
 *  para onde se vai PROCURAR um post que sumiu, e uma falha antiga desaparecendo
 *  daqui seria o mesmo defeito por outro caminho (o prazo de 7 dias é só do
 *  AVISO do painel, `DIAS_DE_AVISO_DA_PUBLICACAO`). Elas são raras — duas em
 *  dois meses de produção —, então a lista não cresce; o teto existe pelo mesmo
 *  motivo que o de cima, para a tela não virar parede num dia ruim. */
const FALHADAS_NA_TELA = 50;

export default async function Agendados({
  searchParams,
}: {
  searchParams: Promise<{ aviso?: string; tom?: string; v?: string; em?: string }>;
}) {
  const params = await searchParams;
  const aviso = avisoDaUrl(params.aviso, params.tom);
  const conta = await getSelectedAccount();

  // A GRADE VEM ANTES DA CONSULTA, porque e ela que diz qual janela buscar.
  const hoje = chaveDoDia(new Date());
  const visao = visaoDaUrl(params.v);
  const ancora = ancoraDaUrl(params.em, visao, hoje);
  const grade = visao === "mes" ? gradeDoMes(ancora, hoje) : gradeDaSemana(ancora, hoje);
  // A FOLGA DE UM DIA DE CADA LADO e o que impede o post das 21h do primeiro
  // quadrado de sumir: as colunas sao dias de Brasilia e as colunas do banco
  // sao UTC, entao as bordas nao coincidem.
  const inicioDaJanela = diaSomado(grade.casas[0].chave, -1);
  const fimDaJanela = diaSomado(grade.casas[grade.casas.length - 1].chave, 2);

  // ORDENADO POR `not_before`, e não por `created_at`: a pergunta desta tela é
  // "o que sai primeiro?". Ordenar pela criação misturaria um post marcado para
  // amanhã depois de um marcado para o mês que vem, só porque foi agendado
  // antes. O `, id` desempata dois marcados para o mesmo instante — a mesma
  // estabilidade que `drainQueue` já garante na ordem de saída.
  //
  // A SEGUNDA CONSULTA É A DESTA ENTREGA, e ela é o conserto inteiro do lado da
  // tela: até 09/09/2026 havia SÓ a de cima, filtrando `pending`, e um post que
  // falhava não virava linha vermelha — ele DEIXAVA DE EXISTIR na única lista
  // onde alguém iria procurá-lo.
  //
  // AS DUAS FICAM SEPARADAS DE PROPÓSITO. Agendado e falhado são estados com
  // AÇÕES diferentes: um se cancela ou se remarca, o outro não tem o que
  // cancelar. Juntá-los numa lista só faria a mesma lista significar duas coisas
  // — o mesmo defeito que a coluna de data de Envios cometia, e que a entrega de
  // ontem consertou.
  //
  // ORDENADA POR `coalesce(claimed_at, not_before) desc`: a pergunta desta
  // seção é o oposto da de cima. Lá é "o que sai primeiro?"; aqui é "o que
  // acabou de falhar?", e a falha mais recente é a que ainda dá tempo de
  // republicar.
  //
  // E A COLUNA NÃO É `not_before`, desde 10/09/2026. `finish`
  // (lib/queue-drain.ts) grava `not_before = now() + retryInSeconds` sem olhar
  // o status, e o `catch` genérico do dreno o chama com 120 segundos também no
  // ramo `failed`: num item falhado essa coluna é a hora de uma retentativa que
  // nunca vai acontecer, e ordenar por ela põe na frente o post cuja máquina de
  // retentativa empurrou mais — e não o que acabou de falhar. `claimed_at` é o
  // instante da tentativa que falhou, a MESMA coluna que o painel escolheu para
  // a janela de 7 dias, e a MESMA que `linhaDaFalha` imprime na linha. O
  // `coalesce` é a rede do item que nunca foi reivindicado.
  //
  // EM PARALELO, e não em série: são independentes, e uma atrás da outra somaria
  // uma ida completa ao banco no tempo desta tela — a mesma conta que
  // `app/page.tsx` já faz.
  const [itens, falhadas, resumoFora] = conta
    ? ((await Promise.all([
        // O QUE O CALENDARIO DESENHA: o que ainda vai sair E o que ja saiu.
        //
        // MOSTRAR O PUBLICADO FOI DECISAO DO DONO (11/09/2026), e ela e o que
        // torna o calendario legivel: uma grade que so mostra o futuro fica
        // quase toda vazia, e quadrado vazio le como defeito da tela em vez de
        // "nao ha post marcado". Com o que ja saiu junto, a grade mostra o
        // RITMO do perfil, que e a pergunta de quem abre um planner.
        //
        // A JANELA E A DA GRADE, com folga de um dia de cada lado: `not_before`
        // e `sent_at` sao UTC, e a grade e de Brasilia — o primeiro e o ultimo
        // quadrado atravessam a virada. Cortar sem folga esconderia o post das
        // 21h do primeiro dia. Ver `lib/calendario.ts`.
        //
        // FALHADO NAO ENTRA AQUI: ele tem secao propria logo abaixo, com uma
        // ordem propria ("o que acabou de falhar?") e sem acao nenhuma. Junta-lo
        // faria a mesma lista significar duas coisas.
        //
        // =====================================================================
        // ESTA CONSULTA NÃO TEM ÍNDICE PRÓPRIO, E É DECISÃO MEDIDA — NÃO
        // ESQUECIMENTO. Não crie um sem reler os números abaixo.
        //
        // A ANOTAÇÃO DE 11/09/2026 dizia que `queue_pending_idx` — `(status,
        // not_before)` — "não cobre a consulta do calendário", que usa
        // `coalesce(sent_at, not_before)`. É verdade, e nenhum dos quatro
        // índices da tabela cobre: `(id)`, `(dedupe_key)`, `(status,
        // not_before)` e `(account_id, status)`. O que a anotação não tinha era
        // o TAMANHO do problema.
        //
        // MEDIDO EM 25/09/2026, no container de teste (`npm run banco:teste`),
        // com a MESMA tabela e os MESMOS quatro índices, e com a proporção real
        // de produção (de cada 258 linhas, 3 são `publicacao`). Três execuções
        // por ponto, descartando a primeira (cache frio do Postgres):
        //
        //   linhas na fila          sem índice        com índice dedicado
        //   ----------------------  ----------------  -------------------
        //      258  (hoje)           0,26 ms           0,21 ms
        //    2.580  (10x)            0,74 ms           --
        //   25.800  (100x)           6,1  ms           0,36 ms
        //   50.000                  13,5  ms           --
        //  100.000                  18,9  ms           --
        //  258.000  (1000x)         29-34  ms          0,46 ms
        //
        // O índice medido foi
        //   create index queue_calendario_idx
        //       on queue (account_id, kind, (coalesce(sent_at, not_before)));
        // — expressão, e não coluna, porque é a expressão que a consulta ordena.
        //
        // POR QUE "NÃO AGORA": a 258 linhas ele economiza 0,05 ms. Isso não é
        // pouco — é NADA: está abaixo do ruído entre duas execuções da mesma
        // consulta, e some inteiro ao lado do tempo de render desta tela, que
        // ainda faz outras duas consultas e monta a grade. Criar índice para
        // ganhar 50 microssegundos é pagar escrita e migração por um número que
        // ninguém consegue observar.
        //
        // O QUE O ÍNDICE CUSTARIA, também medido: a inserção na fila passa de
        // 22,68 ms para 25,99 ms por mil linhas (+15%), e ele ocupa 1,5 MB a
        // 25.800 linhas e 15 MB a 258.000. A fila recebe inserção em TODO
        // disparo de automação — o custo cai no caminho quente, e o ganho, num
        // caminho que roda quando alguém abre o calendário.
        //
        // O GATILHO, PARA NÃO SE REABRIR ESTA DISCUSSÃO SEM DADO:
        //
        //   >>> 50.000 LINHAS NA TABELA `queue`. <<<
        //
        // É onde a consulta cruza ~13 ms, cinquenta vezes a de hoje, e deixa de
        // se esconder no render. A partir daí o índice acima devolve a consulta
        // para menos de 0,5 ms e passa a valer os 15% de escrita. Abaixo disso,
        // o número diz para não mexer.
        //
        // COMO CONFERIR QUANDO CHEGAR A HORA: `select count(*) from queue`. Se
        // vier abaixo de 50.000, a resposta continua sendo esta, e o que mudou
        // foi só a data.
        //
        // A BORDA QUE ESTA MEDIÇÃO QUASE ERROU, escrita porque ela se repete: a
        // primeira semeadura punha todas as publicações 400 dias atrás, fora da
        // janela da grade, e a consulta voltava `rows=0`. Os tempos pareciam
        // ótimos e não mediam nada — era o filtro descartando tudo, não o
        // calendário. Medição de consulta que devolve vazio não é medição.
        // =====================================================================
        sql().query(
          `select * from queue
            where account_id = $1 and kind = 'publicacao'
              and status in ('pending', 'sent')
              and coalesce(sent_at, not_before) >= $2::timestamptz
              and coalesce(sent_at, not_before) < $3::timestamptz
            order by coalesce(sent_at, not_before), id
            limit $4`,
          [conta.ig_user_id, inicioDaJanela, fimDaJanela, AGENDADOS_NA_TELA]
        ),
        sql().query(
          `select * from queue
            where account_id = $1 and kind = 'publicacao' and status = 'failed'
            order by coalesce(claimed_at, not_before) desc, id
            limit $2`,
          [conta.ig_user_id, FALHADAS_NA_TELA]
        ),
        // O QUE ESTA AGENDADO FORA DESTA GRADE — e esta consulta existe por um
        // defeito que a revisao achou em 11/09/2026.
        //
        // A lista antiga trazia os 50 proximos ordenados por `not_before`, SEM
        // recorte de tempo: ela respondia "o que esta na fila?". O calendario
        // so pergunta pela janela da grade, e com isso o produto ficou SEM
        // NENHUMA tela que responda aquilo. A equipe marca um lancamento para
        // 12/11, abre a tela em setembro, ve o mes vazio depois do dia 20 e
        // conclui que nao ha nada agendado — e so descobre o contrario se ja
        // souber a data e clicar "›" duas vezes.
        //
        // NAO E UMA SEGUNDA LISTA: e uma CONTAGEM e a data do proximo, para a
        // tela poder dizer "ha 3 posts fora deste periodo, o proximo em 12 de
        // novembro" com um link que leva ate la. A resposta volta a existir sem
        // desfazer o calendario.
        sql().query(
          `select count(*)::int as fora, min(not_before) as proximo
             from queue
            where account_id = $1 and kind = 'publicacao' and status = 'pending'
              and (not_before < $2::timestamptz or not_before >= $3::timestamptz)`,
          [conta.ig_user_id, inicioDaJanela, fimDaJanela]
        ),
      ])) as [QueueItem[], QueueItem[], { fora: number; proximo: Date | null }[]])
    : ([[], [], [{ fora: 0, proximo: null }]] as [
        QueueItem[],
        QueueItem[],
        { fora: number; proximo: Date | null }[],
      ]);

  // O AGRUPAMENTO USA `dataDaLinhaDeEnvio`, e nao uma coluna escolhida aqui:
  // ela ja e a fonte unica de "qual data esta linha tem" -- `sent_at` em quem
  // saiu, `not_before` em quem espera. Reimplementar essa escolha seria a
  // segunda fonte para a mesma pergunta, e as duas divergiriam no dia em que um
  // status novo aparecesse.
  const porDia = agruparPorDia(itens, (i) => dataDaLinhaDeEnvio(i).quando);
  const fora = resumoFora[0] ?? { fora: 0, proximo: null };

  return (
    <div className="space-y-6">
      {/* O CABEÇALHO DO PLANNER — título, ação e as duas barras de controle,
          no molde do planner do Meta Business que o dono trouxe como
          referência. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className={pageTitle}>Publicações</h1>
          <p className={pageSubtitle}>
            {conta
              ? `o que sai e o que já saiu no perfil de @${conta.username ?? conta.ig_user_id}`
              : "Nenhuma conta selecionada."}
          </p>
        </div>
        <Link href="/publicar/novo" className={btnPrimary}>
          Criar post
        </Link>
      </div>

      {aviso && <div className={aviso.tom === "ok" ? alertOk : alertError}>{aviso.texto}</div>}

      {!conta ? (
        <div className={emptyWrap}>
          <p className={muted}>
            Conecte uma conta do Instagram em Configuração para ver o que está agendado.
          </p>
        </div>
      ) : (
        <section className={card}>
          {/* A BARRA DE CONTROLE. Tudo aqui é `<Link>`: a visão e a âncora vivem
              na barra de endereço, então esta tela continua 100% servidor — e a
              semana que alguém está olhando é um endereço que se copia e se
              manda para outra pessoa. */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-traco px-4 py-3 dark:border-traco-escuro">
            <div className="inline-flex gap-0.5 rounded-xl border border-traco p-0.5 dark:border-traco-escuro">
              {(
                [
                  ["semana", "Semana", `?v=semana&em=${hoje}`],
                  ["mes", "Mês", `?v=mes&em=${hoje.slice(0, 7)}`],
                ] as const
              ).map(([chave, rotulo, href]) => (
                <Link
                  key={chave}
                  href={`/publicar${href}`}
                  aria-current={visao === chave ? "page" : undefined}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                    visao === chave
                      ? "bg-acao text-papel dark:bg-acao-escuro dark:text-papel-escuro"
                      : "text-quieto hover:text-tinta dark:text-quieto-escuro dark:hover:text-tinta-escuro"
                  }`}
                >
                  {rotulo}
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-1">
              <Link
                href={`/publicar?v=${visao}&em=${grade.anterior}`}
                aria-label="Período anterior"
                className={`${btnGhost} px-2`}
              >
                &lsaquo;
              </Link>
              <Link
                href={`/publicar?v=${visao}&em=${visao === "mes" ? hoje.slice(0, 7) : hoje}`}
                className={`${btnGhost} px-3`}
              >
                Hoje
              </Link>
              <Link
                href={`/publicar?v=${visao}&em=${grade.seguinte}`}
                aria-label="Próximo período"
                className={`${btnGhost} px-2`}
              >
                &rsaquo;
              </Link>
            </div>

            <p className="titulo order-first w-full text-center text-base font-bold sm:order-none sm:w-auto">
              {grade.titulo}
            </p>
          </div>

          {/* A GRADE. `overflow-x-auto` porque sete colunas não cabem em 390px
              sem espremer o conteúdo até ele deixar de ser legível — e a regra
              desta base é que conteúdo largo rola DENTRO do próprio recipiente,
              nunca fazendo a página inteira rolar de lado. */}
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              <div className="grid grid-cols-7 border-b border-traco dark:border-traco-escuro">
                {grade.colunas.map((c) => (
                  <div
                    key={c}
                    className={`px-2 py-1.5 text-center text-[11px] font-semibold uppercase tracking-[0.04em] ${muted}`}
                  >
                    {c}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7">
                {grade.casas.map((casa) => {
                  const doDia = porDia.get(casa.chave) ?? [];
                  const { mostrados, escondidos } = recorteDoDia(
                    doDia,
                    visao === "mes" ? undefined : 20
                  );
                  return (
                    <div
                      key={casa.chave}
                      className={`space-y-1 border-b border-r border-traco p-1.5 dark:border-traco-escuro ${
                        visao === "semana" ? "min-h-[320px]" : "min-h-[104px]"
                      } ${casa.doMes ? "" : "bg-papel/60 dark:bg-papel-escuro/40"}`}
                    >
                      <p className="px-0.5 text-right">
                        <span
                          className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] ${numero} ${
                            casa.hoje
                              ? "bg-acao font-bold text-papel dark:bg-acao-escuro dark:text-papel-escuro"
                              : casa.doMes
                                ? muted
                                : "text-quieto/50 dark:text-quieto-escuro/50"
                          }`}
                        >
                          {casa.dia}
                        </span>
                      </p>

                      {mostrados.map((item) => {
                        const p = lerPayloadDaPublicacao(item.payload);
                        const quando = dataDaLinhaDeEnvio(item);
                        const saiu = quando.saiu;
                        // A MINIATURA SÓ EXISTE ENQUANTO O POST NÃO SAIU: o
                        // dreno apaga a mídia do bucket depois de publicar
                        // (`limparOBucket`). Num post publicado a prévia seria
                        // uma imagem quebrada, então nem se tenta.
                        const primeira = !saiu ? p?.caminhos?.[0] : undefined;
                        // `null` QUANDO O AMBIENTE NÃO DEIXA MONTAR A URL, e
                        // aí a célula desenha o símbolo em vez de uma imagem
                        // quebrada. Prévia não vale uma tela — ver
                        // `urlPublicaSeDerParaMontar` (lib/bucket.ts) para o
                        // defeito que ensinou isso.
                        const capa = primeira ? urlPublicaSeDerParaMontar(primeira) : null;
                        // ATRASADO: a hora passou e ele ainda esta na fila. A
                        // decisao e de `avisoDoAtrasoNaLista`, a mesma da tela
                        // de detalhe — aqui so se pergunta SE ha aviso, porque
                        // no quadrado nao cabe a frase.
                        const atrasado = avisoDoAtrasoNaLista(quando) !== null;
                        return (
                          <Link
                            key={item.id}
                            /* A VOLTA CARREGA A ÂNCORA, e não só a visão: sem
                               `em`, quem estava olhando dezembro e clicava em
                               "← Calendário" caía no mês de hoje. */
                            href={`/publicar/post/${item.id}?v=${visao}&em=${grade.ancora}`}
                            /* O CHIP NÃO PINTA ESTADO, e isso é conserto de um
                               defeito que a revisão achou em 11/09/2026.

                               A primeira versão dava `bg-aberto/8` ao post que
                               AINDA NÃO SAIU e cinza ao que JÁ SAIU — e em toda
                               outra tela deste painel verde quer dizer "deu
                               certo". Quem varria o calendário procurando
                               problema via os verdes como sucesso, quando eram
                               justamente os pendentes, um deles atrasado num dia
                               que já passou.

                               E a spec proíbe isso em uma linha: os três estados
                               "continuam sendo SINAL — pílula, texto, ponto — e
                               nunca preenchimento grande". A superfície volta a
                               ser neutra; quem carrega o estado é o símbolo à
                               esquerda, que é do tamanho de um sinal. */
                            className="flex items-center gap-1.5 rounded-lg border border-traco bg-papel p-1 transition-colors hover:border-quieto/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acao/25 dark:border-traco-escuro dark:bg-papel-escuro/50 dark:focus-visible:ring-acao-escuro/25"
                          >
                            {capa ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={capa}
                                alt=""
                                className="h-8 w-8 shrink-0 rounded-lg object-cover"
                              />
                            ) : (
                              <span
                                aria-hidden
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-traco text-[11px] dark:bg-traco-escuro"
                              >
                                {saiu ? "✓" : "•"}
                              </span>
                            )}
                            {/* O PONTO DE ESTADO — do tamanho de um sinal, que é
                                o que a spec permite para as três cores. Verde é
                                o que SAIU (o mesmo sentido de todas as outras
                                telas), âmbar é o que está ATRASADO e ainda na
                                fila, e nada aparece no que vai sair na hora —
                                porque aí não há sinal a dar. */}
                            {(saiu || atrasado) && (
                              <span
                                aria-hidden
                                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                                  saiu
                                    ? "bg-aberto dark:bg-aberto-escuro"
                                    : "bg-fecha dark:bg-fecha-escuro"
                                }`}
                              />
                            )}
                            <span className="min-w-0 flex-1">
                              <span className={`block text-[11px] font-semibold ${numero}`}>
                                {horaDoDia(quando.quando)}
                              </span>
                              <span className={`block truncate text-[11px] ${muted}`}>
                                {rotuloDaFormaDoItem(p)}
                              </span>
                            </span>
                          </Link>
                        );
                      })}

                      {/* QUEM CORTA TEM DE CONTAR — a mesma disciplina da tabela
                          de contatos e do feed de Atividade. O "+N" leva à
                          SEMANA daquele dia, que é onde todos cabem. */}
                      {escondidos > 0 && (
                        <Link
                          href={`/publicar?v=semana&em=${casa.chave}`}
                          className={`block px-1 text-[11px] font-medium ${link}`}
                        >
                          +{escondidos}
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* O CORTE DA GRADE, DECLARADO. Ele não morde hoje (medido: pico de 2
              posts por mês contra um teto de 200), e é justamente por isso que
              ele morderia CALADO no dia em que mordesse. A ordem da consulta é
              ascendente, então o que cai fora é o FIM do período — as últimas
              semanas apareceriam vazias. */}
          {itens.length >= AGENDADOS_NA_TELA && (
            <p
              className={`border-t border-traco px-4 py-2.5 text-center text-xs dark:border-traco-escuro ${muted}`}
            >
              Este período tem mais de{" "}
              <span className={`font-semibold ${numero} text-tinta dark:text-tinta-escuro`}>
                {AGENDADOS_NA_TELA}
              </span>{" "}
              posts, e o fim dele pode não estar aparecendo. Use a semana para ver por partes.
            </p>
          )}

          {/* O QUE ESTA MARCADO FORA DESTE PERIODO. Sem esta linha, o
              calendario responde "nao ha nada" quando a pergunta era "nao ha
              nada NESTE MES" — e as duas frases levam a decisoes opostas. O
              link leva ao mes do proximo, entao a resposta nao exige adivinhar
              a data. */}
          {fora.fora > 0 && fora.proximo && (
            <p
              className={`border-t border-traco px-4 py-2.5 text-center text-xs dark:border-traco-escuro ${muted}`}
            >
              <span className={`font-semibold ${numero} text-tinta dark:text-tinta-escuro`}>
                {fora.fora}
              </span>{" "}
              {fora.fora === 1 ? "post agendado" : "posts agendados"} fora deste período.{" "}
              <Link
                href={`/publicar?v=mes&em=${chaveDoDia(fora.proximo).slice(0, 7)}`}
                className={link}
              >
                O próximo sai em {fmtDate(fora.proximo)}
              </Link>
            </p>
          )}

          {/* O VAZIO DIZ O QUE FAZER. Um calendário sem nenhum post no período
              não é erro — é um mês em que ninguém marcou nada, e a frase tem de
              ser um convite e não um silêncio. */}
          {itens.length === 0 && (
            <p className={`px-4 py-6 text-center text-sm ${muted}`}>
              Nada marcado neste período.{" "}
              <Link href="/publicar/novo" className={link}>
                Agendar um post
              </Link>
            </p>
          )}
        </section>
      )}

      {/* ================================================================
          "NÃO SAÍRAM" — a seção que faz o post falhado parar de sumir.

          ELA SÓ APARECE QUANDO HÁ ALGUMA. Um cabeçalho vermelho permanente
          escrito "nenhuma falha" é ruído numa tela de diagnóstico, e ruído
          numa tela de diagnóstico ensina a ignorá-la.

          NÃO HÁ BOTÃO NENHUM, e isso é a decisão e não um esquecimento: não há
          o que cancelar num post que já falhou, e "tentar de novo" seria ação
          de ESCRITA nova — com todas as regras de saída muda — para um evento
          que aconteceu duas vezes em dois meses. Fica registrado na
          especificação como possível.

          AS TRÊS COISAS DA LINHA SAEM DE `linhaDaFalha`: a hora em que o post
          FALHOU (`claimed_at`, e não `not_before` — a máquina de retentativa
          reescreve o segundo, e o comentário daquela função mede o caso), a
          forma, o começo da legenda e o motivo escrito pelo dreno. Nenhuma
          delas se decide aqui. */}
      {falhadas.length > 0 && (
        <section className="space-y-4">
          <div>
            <h2 className="titulo text-lg font-semibold">Não saíram</h2>
            <p className={`text-sm ${muted}`}>
              Estes posts falharam e não estão mais na fila. O arquivo continua no
              armazenamento — para publicar de novo, agende outro post.
            </p>
          </div>
          <ul className="space-y-4">
            {falhadas.map((item) => {
              const falha = linhaDaFalha(item);
              return (
                <li
                  key={item.id}
                  className={`${card} space-y-2 border-red-300 p-5 dark:border-red-900`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-semibold">
                      {FRASE_DA_FALHA}
                      {fmtDate(falha.quando)}
                    </p>
                    <span className={`text-xs ${muted}`}>{falha.forma}</span>
                  </div>
                  <p className="text-sm">{falha.legenda}</p>
                  {/* O MOTIVO CHEGA INTEIRO, e sem tradução: é a resposta da
                      Meta, e é a única pista de por que o post não saiu.
                      `friendlyError` reescreve os erros de MENSAGEM que se
                      repetem, e nenhum deles é de publicação. */}
                  <p className={`text-xs ${muted}`}>{falha.motivo}</p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

    </div>
  );
}
