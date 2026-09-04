import Link from "next/link";
import { sql, type QueueItem } from "@/lib/db";
import { getSelectedAccount } from "@/lib/account";
import { fmtDate } from "@/lib/format";
import { avisoDaUrl } from "@/lib/avisos";
import {
  dataDaLinhaDeEnvio,
  lerPayloadDaPublicacao,
  resumoDaLegenda,
  rotuloDaForma,
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
// O aviso vem de `avisoDaUrl`; a data de `dataDaLinhaDeEnvio`; o nome da forma
// de `rotuloDaForma`; o começo da legenda de `resumoDaLegenda`; o payload de
// `lerPayloadDaPublicacao`, que RECUSA em vez de confiar num `jsonb` que pode
// ter sido editado por fora. A suíte não testa componente — o que ficar
// decidido aqui fica sem rede nenhuma.
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
  const itens = conta
    ? ((await sql().query(
        `select * from queue
          where account_id = $1 and kind = 'publicacao' and status = 'pending'
          order by not_before, id
          limit $2`,
        [conta.ig_user_id, AGENDADOS_NA_TELA]
      )) as QueueItem[])
    : [];

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
            return (
              <li key={item.id} className={`${card} space-y-4 p-5`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">
                    {/* "Sai em" É A FRASE DO FUTURO. Uma data solta na tela de
                        um agendamento é ambígua entre "foi marcado" e "vai
                        sair", e é a mesma ambiguidade que esta entrega apagou
                        da linha de Envios. */}
                    {quando.futuro ? "Sai em " : "Estava marcado para "}
                    {fmtDate(quando.quando)}
                  </p>
                  <span className={`text-xs ${muted}`}>
                    {p ? rotuloDaForma(p.forma) : "Forma não reconhecida"}
                  </span>
                </div>

                {!quando.futuro && (
                  // A HORA JÁ VENCEU E O ITEM AINDA ESTÁ `pending`: ele está
                  // ATRASADO, esperando a próxima drenagem — não é futuro, e a
                  // tela não pode prometer uma saída que já devia ter
                  // acontecido. Dizê-lo aqui é o que evita que alguém conte com
                  // um cancelamento que a corrida com o dreno já perdeu.
                  <p className={`text-xs ${muted}`}>
                    A hora já passou e o post ainda não saiu: ele sai na próxima
                    drenagem, e a partir daí não dá mais para cancelar.
                  </p>
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
    </div>
  );
}
