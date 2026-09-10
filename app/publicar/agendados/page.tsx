import Link from "next/link";
import Script from "next/script";
import { sql, type QueueItem } from "@/lib/db";
import { getSelectedAccount } from "@/lib/account";
import { fmtDate } from "@/lib/format";
import { avisoDaUrl } from "@/lib/avisos";
import {
  avisoDoAtrasoNaLista,
  dataDaLinhaDeEnvio,
  fraseDaDataDaLinha,
  lerPayloadDaPublicacao,
  linhaDaFalha,
  resumoDaLegenda,
  rotuloDaFormaDoItem,
  FRASE_DA_FALHA,
  LEGENDA_NA_LISTA,
} from "@/lib/publicacao";
import {
  card,
  subtle,
  input,
  label,
  hint,
  muted,
  link,
  btnGhost,
  btnDanger,
  pageTitle,
  pageSubtitle,
  alertOk,
  alertError,
  emptyWrap,
} from "../../ui";
import { cancelarPublicacao, remarcarPublicacao } from "./actions";

// A TELA DOS AGENDADOS — componente de SERVIDOR, sem uma linha de cliente.
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

/** A lista é curta por natureza — são os posts que uma pessoa agendou à mão —,
 *  mas o teto existe para a tela não virar parede no dia em que alguém agendar
 *  um mês inteiro de uma vez. */
const AGENDADOS_NA_TELA = 50;

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
  searchParams: Promise<{ aviso?: string; tom?: string }>;
}) {
  const params = await searchParams;
  const aviso = avisoDaUrl(params.aviso, params.tom);
  const conta = await getSelectedAccount();

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
  const [itens, falhadas] = conta
    ? ((await Promise.all([
        sql().query(
          `select * from queue
            where account_id = $1 and kind = 'publicacao' and status = 'pending'
            order by not_before, id
            limit $2`,
          [conta.ig_user_id, AGENDADOS_NA_TELA]
        ),
        sql().query(
          `select * from queue
            where account_id = $1 and kind = 'publicacao' and status = 'failed'
            order by coalesce(claimed_at, not_before) desc, id
            limit $2`,
          [conta.ig_user_id, FALHADAS_NA_TELA]
        ),
      ])) as [QueueItem[], QueueItem[]])
    : ([[], []] as [QueueItem[], QueueItem[]]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className={pageTitle}>Posts agendados</h1>
        <p className={pageSubtitle}>
          {conta
            ? `o que ainda vai sair no perfil de @${conta.username ?? conta.ig_user_id}`
            : "Nenhuma conta selecionada."}
        </p>
      </div>

      {aviso && <div className={aviso.tom === "ok" ? alertOk : alertError}>{aviso.texto}</div>}

      {!conta ? (
        <div className={emptyWrap}>
          <p className={muted}>
            Conecte uma conta do Instagram em Configuração para ver o que está agendado.
          </p>
        </div>
      ) : !itens.length ? (
        <div className={emptyWrap}>
          <p className={muted}>Nada agendado nesta conta.</p>
          <Link href="/publicar" className={link}>
            Agendar um post
          </Link>
        </div>
      ) : (
        <ul className="space-y-4">
          {itens.map((item) => {
            // O PAYLOAD PODE ESTAR QUEBRADO, e a tela não pode sumir por causa
            // disso: `lerPayloadDaPublicacao` devolve `null` para um `jsonb` que
            // não é item de publicação, e a linha continua existindo — porque é
            // dela que sai o botão de CANCELAR, que é justamente o que se quer
            // ter à mão num item que ninguém entende.
            const p = lerPayloadDaPublicacao(item.payload);
            const quando = dataDaLinhaDeEnvio(item);
            // AS TRÊS FRASES DESTA LINHA SAEM DE FUNÇÃO PURA, e nenhuma delas é
            // escolhida aqui. Até 09/09/2026 as três moravam no JSX, e uma
            // delas discordava da tela de Envios sobre o mesmo fato.
            const atrasado = avisoDoAtrasoNaLista(quando);
            return (
              <li key={item.id} className={`${card} space-y-4 p-5`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">
                    {/* "Sai em" É A FRASE DO FUTURO, e ela vem de
                        `fraseDaDataDaLinha` — a MESMA que a linha de Envios lê.
                        Uma data solta é ambígua entre "foi marcado" e "vai
                        sair", e duas telas escolhendo palavras diferentes para
                        o mesmo fato é o defeito que aquela função fechou. */}
                    {fraseDaDataDaLinha(quando)}
                    {fmtDate(quando.quando)}
                  </p>
                  <span className={`text-xs ${muted}`}>{rotuloDaFormaDoItem(p)}</span>
                </div>

                {atrasado && (
                  // A HORA JÁ VENCEU E O ITEM AINDA ESTÁ `pending`: ele está
                  // ATRASADO, esperando a próxima drenagem — não é futuro, e a
                  // tela não pode prometer uma saída que já devia ter
                  // acontecido. Dizê-lo aqui é o que evita que alguém conte com
                  // um cancelamento que a corrida com o dreno já perdeu. A
                  // decisão (quando avisar, e o que dizer) é de
                  // `avisoDoAtrasoNaLista`; aqui só se desenha o que ela deu.
                  <p className={`text-xs ${muted}`}>{atrasado}</p>
                )}

                <p className="text-sm">{resumoDaLegenda(p?.legenda, LEGENDA_NA_LISTA)}</p>

                <div className="flex flex-wrap items-end gap-6">
                  {/* REMARCAR — a data passa por `momentoDaPublicacao` no
                      servidor, que é quem recusa o passado, com a MESMA frase da
                      tela de compor. Sem `min` aqui, e de propósito: o piso teria
                      de ser calculado neste servidor, que roda em UTC, e
                      mostraria uma hora três horas adiante da do dono. */}
                  <form action={remarcarPublicacao} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="id" value={item.id} />
                    {/* O FUSO DO NAVEGADOR, e sem ele esta tela só acertava a
                        hora por acidente. O `<input type="datetime-local">`
                        manda "14:30" e CALA sobre onde são 14:30; lido neste
                        servidor, que roda em UTC, isso seria 14:30Z — TRÊS
                        HORAS antes do que a pessoa marcou. Ver
                        `instanteDoAgendamento` (lib/publicacao.ts).

                        Ele nasce VAZIO e é preenchido pelo `<Script>` do fim
                        desta tela — nunca calculado no render, que aqui é
                        servidor e não sabe onde a pessoa está. Vazio,
                        `fusoDoCampo` cai no padrão de Brasília (180), que é o
                        comportamento que esta tela tinha antes e continua
                        sendo a rede de quem não rodou JavaScript. */}
                    <input type="hidden" name="fuso" defaultValue="" />
                    <div>
                      <label className={label} htmlFor={`data_hora_${item.id}`}>
                        Nova data e hora
                      </label>
                      <input
                        id={`data_hora_${item.id}`}
                        name="data_hora"
                        type="datetime-local"
                        className={`${input} w-auto!`}
                      />
                    </div>
                    <button className={btnGhost}>Remarcar</button>
                  </form>

                  {/* CANCELAR PEDE CONFIRMAÇÃO, e a confirmação é um campo do
                      formulário — não um `confirm()` do navegador, que exigiria
                      `"use client"` numa tela que não precisa de nenhum. A caixa
                      é a mesma disciplina do envio em lote. */}
                  <form action={cancelarPublicacao} className={`${subtle} space-y-2 p-3`}>
                    <input type="hidden" name="id" value={item.id} />
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="confirmo" value="1" required />
                      Confirmo o cancelamento
                    </label>
                    <button className={btnDanger}>Cancelar este post</button>
                  </form>
                </div>

                <p className={hint}>
                  Cancelar tira o post da fila e ele não sai. Se ele já tiver saído, só o
                  aplicativo do Instagram apaga — a API não apaga mídia.
                </p>
              </li>
            );
          })}
        </ul>
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
            <h2 className="text-lg font-semibold">Não saíram</h2>
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

      {/* O FUSO DE TODOS OS FORMULÁRIOS DE REMARCAR, escrito uma vez.
          =====================================================================
          POR QUE UM `<Script>` E NÃO UM COMPONENTE DE CLIENTE

          Esta tela é 100% servidor, e a única coisa que ela precisa do
          navegador é UM NÚMERO que só existe lá: o deslocamento do fuso. Um
          `"use client"` para isso arrastaria a lista inteira — os formulários,
          os botões, o payload — para o pacote do cliente por causa de uma
          linha. `next/script` com script embutido é o caminho que o próprio
          Next documenta para isto, e já é o que `app/layout.tsx` usa para o
          tema.

          A ESTRATÉGIA É `afterInteractive` (a padrão), e não `beforeInteractive`:
          esta última só é suportada dentro do layout raiz.

          E O VALOR É ESCRITO NO DOM, e não no render: o servidor roda em UTC e
          o navegador não, então um `value` calculado durante o render seria
          diferente dos dois lados e o React acusaria divergência de hidratação.
          É exatamente o que `app/publicar/enviador.tsx` já faz no `useEffect`
          dele, pelo mesmo motivo.

          SE ELE NÃO RODAR, NADA QUEBRA: o campo fica vazio, `fusoDoCampo`
          (lib/publicacao.ts) cai no padrão de Brasília, e a tela se comporta
          como se comportava antes desta linha existir. */}
      <Script id="fuso-do-remarcar">
        {`document.querySelectorAll('input[name="fuso"]').forEach(function(c){c.value=String(new Date().getTimezoneOffset())})`}
      </Script>
    </div>
  );
}
