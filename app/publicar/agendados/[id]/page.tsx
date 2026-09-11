import Link from "next/link";
import Script from "next/script";
import { notFound } from "next/navigation";
import { sql, type QueueItem } from "@/lib/db";
import { getSelectedAccount } from "@/lib/account";
import { fmtDate } from "@/lib/format";
import { avisoDaUrl } from "@/lib/avisos";
import { statusBadge } from "../../../labels";
import { urlPublicaSeDerParaMontar } from "@/lib/bucket";
import {
  avisoDoAtrasoNaLista,
  dataDaLinhaDeEnvio,
  fraseDaDataDaLinha,
  lerPayloadDaPublicacao,
  rotuloDaFormaDoItem,
  fraseSobreAMidia,
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
  numero,
} from "../../../ui";
import { cancelarPublicacao, remarcarPublicacao } from "../actions";

export const dynamic = "force-dynamic";

// O DETALHE DE UMA PUBLICAÇÃO — para onde o clique no calendário leva.
//
// POR QUE ELA EXISTE: a lista de agendados virou calendário, e num quadrado de
// dia não cabe um formulário de remarcar com campo de data mais uma caixa de
// confirmação de cancelamento. As ações vieram para cá inteiras — mesma ação de
// servidor, mesmos campos, mesmas frases.
//
// O QUE NÃO MUDOU, E É O QUE OS TESTES DE INTEGRAÇÃO PRENDEM: `cancelarPublicacao`
// e `remarcarPublicacao` (../actions.ts) não foram tocadas. Elas continuam
// recusando item de outra conta, item já em voo e item que não é publicação, e
// os casos que medem isso passam por `comoNumaRequisicao`, não pela tela. O que
// mudou de endereço foi só onde o formulário é DESENHADO.
//
// ELA É DE UM ITEM SÓ, e por isso pode mostrar o que a lista não mostrava: a
// mídia. Enquanto o post está agendado o arquivo ainda está no bucket — o dreno
// só o apaga DEPOIS de publicar (`limparOBucket`, lib/queue-drain.ts) —, então
// aqui dá para ver o que vai sair. Num post já publicado, não dá: o arquivo não
// existe mais, e a tela diz isso em vez de mostrar uma imagem quebrada.

type Linha = QueueItem & { conta_username: string | null };

export default async function DetalheDaPublicacao({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aviso?: string; tom?: string; volta?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const aviso = avisoDaUrl(sp.aviso, sp.tom);
  const conta = await getSelectedAccount();

  // ID QUE NÃO É UUID VIRA 404, E NÃO ERRO DE BANCO. O caminho é digitável, e
  // `where id = 'banana'::uuid` estoura no Postgres com uma tela de erro em vez
  // de um "não achei". É a mesma defesa de `cancelarPublicacao`.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    notFound();
  }

  // A CONTA ENTRA NA CONSULTA, e não só na conferência depois: um item de outra
  // conta não pode nem ser LIDO por aqui. A ação já recusa agir sobre ele, mas
  // uma tela que mostra a legenda de um post alheio já vazou o que importava.
  const linhas = conta
    ? ((await sql().query(
        `select q.*, a.username as conta_username
           from queue q
           left join accounts a on a.ig_user_id = q.account_id
          where q.id = $1::uuid and q.account_id = $2 and q.kind = 'publicacao'`,
        [id, conta.ig_user_id]
      )) as Linha[])
    : [];

  const item = linhas[0];
  if (!item) notFound();

  const p = lerPayloadDaPublicacao(item.payload);
  const quando = dataDaLinhaDeEnvio(item);
  const atrasado = avisoDoAtrasoNaLista(quando);
  // `podeMexer` é sobre a AÇÃO (só `pending` se cancela ou se remarca), e a
  // frase sobre a MÍDIA é outra pergunta — ela depende de o post ter SAÍDO. As
  // duas moravam nesta mesma variável, e por isso um post falhado recebia
  // "este post já saiu". Ver `fraseSobreAMidia`.
  const podeMexer = item.status === "pending";
  const sobreAMidia = fraseSobreAMidia(quando);
  // A MÍDIA SÓ EXISTE ENQUANTO O POST NÃO SAIU. Ver o cabeçalho.
  // AS URLS SÃO MONTADAS AQUI, e as que não derem saem da lista: `null` vira
  // imagem quebrada se chegar num `src`. Ver `urlPublicaSeDerParaMontar`.
  const midia = (podeMexer ? (p?.caminhos ?? []) : [])
    .map((caminho) => ({ caminho, url: urlPublicaSeDerParaMontar(caminho) }))
    .filter((m): m is { caminho: string; url: string } => m.url !== null);
  const voltarPara = sp.volta === "semana" ? "/publicar/agendados?v=semana" : "/publicar/agendados";

  return (
    <div className="space-y-6">
      <div>
        <Link href={voltarPara} className={`text-sm ${link}`}>
          ← Calendário
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className={pageTitle}>{rotuloDaFormaDoItem(p)}</h1>
          {/* O SELO DIZ O ESTADO, e ele vem de `statusBadge` — a mesma função
              da tela de Atividade, que distingue o post que o DONO cancelou
              daquele que o SISTEMA pulou. Sem ele, esta tela não tinha como
              dizer o que o post é: um cancelado parecia um agendado sem
              formulário. */}
          {!podeMexer && (
            <span className={statusBadge(item.status, item.error).className}>
              {statusBadge(item.status, item.error).label}
            </span>
          )}
        </div>
        <p className={pageSubtitle}>
          {/* `fmtDate` JA TRAZ A HORA. A primeira versao desta linha somava
              `horaDoDia` ao lado e a tela dizia "09/09/2026, 15:11 · 15:11". */}
          {fraseDaDataDaLinha(quando)}
          <span className={numero}>{fmtDate(quando.quando)}</span>
        </p>
      </div>

      {aviso && <div className={aviso.tom === "ok" ? alertOk : alertError}>{aviso.texto}</div>}

      {atrasado && <p className={`text-xs ${muted}`}>{atrasado}</p>}

      <section className={`space-y-4 p-5 ${card}`}>
        <div>
          <h2 className="titulo text-sm font-semibold">Legenda</h2>
          {/* A LEGENDA INTEIRA, e não o resumo da lista: esta tela é de um item
              só, e quem chegou aqui veio justamente conferir o que vai sair. */}
          <p className="mt-1 whitespace-pre-wrap text-sm">
            {p?.legenda?.trim() ? p.legenda : <span className={muted}>Sem legenda.</span>}
          </p>
        </div>

        {midia.length > 0 && (
          <div>
            <h2 className="titulo text-sm font-semibold">
              {midia.length === 1 ? "Mídia" : `${midia.length} mídias`}
            </h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {midia.map((m) => (
                // O BUCKET É PÚBLICO POR EXIGÊNCIA DA META, que baixa a mídia do
                // nosso endereço com um cliente sem token (lib/bucket.ts). Então
                // a prévia não custa assinatura nenhuma.
                //
                // `<img>` E NÃO `next/image`: o endereço é do Supabase e mudaria
                // a cada post, e configurar domínio remoto para uma prévia de
                // 96px é pagar caro por nada. `alt` vazio de propósito — a
                // legenda ao lado já diz o que é, e um alt inventado sobre uma
                // imagem que ninguém descreveu seria pior que silêncio.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={m.caminho}
                  src={m.url}
                  alt=""
                  className="h-24 w-24 rounded-xl border border-traco object-cover dark:border-traco-escuro"
                />
              ))}
            </div>
          </div>
        )}

        {sobreAMidia && <p className={`text-xs ${muted}`}>{sobreAMidia}</p>}
      </section>

      {podeMexer && (
        <section className={`space-y-5 p-5 ${card}`}>
          {/* REMARCAR — a data passa por `momentoDaPublicacao` no servidor, que
              é quem recusa o passado, com a MESMA frase da tela de compor. Sem
              `min` aqui, e de propósito: o piso teria de ser calculado neste
              servidor, que roda em UTC, e mostraria uma hora três horas adiante
              da do dono. */}
          <form action={remarcarPublicacao} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="id" value={item.id} />
            {/* O FUSO DO NAVEGADOR, e sem ele esta tela só acertava a hora por
                acidente. O `<input type="datetime-local">` manda "14:30" e CALA
                sobre onde são 14:30; lido neste servidor, que roda em UTC, isso
                seria 14:30Z — TRÊS HORAS antes do que a pessoa marcou. Ver
                `instanteDoAgendamento` (lib/publicacao.ts).

                Ele nasce VAZIO e é preenchido pelo `<Script>` do fim desta tela
                — nunca calculado no render, que aqui é servidor e não sabe onde
                a pessoa está. Vazio, `fusoDoCampo` cai no padrão de Brasília
                (180), que é a rede de quem não rodou JavaScript. */}
            <input type="hidden" name="fuso" defaultValue="" />
            <div>
              <label className={label} htmlFor="data_hora">
                Nova data e hora
              </label>
              <input
                id="data_hora"
                name="data_hora"
                type="datetime-local"
                className={`${input} w-auto!`}
              />
            </div>
            <button className={btnGhost}>Remarcar</button>
          </form>

          {/* CANCELAR PEDE CONFIRMAÇÃO, e a confirmação é um campo do
              formulário — não um `confirm()` do navegador, que exigiria
              `"use client"` numa tela que não precisa de nenhum. */}
          <form action={cancelarPublicacao} className={`${subtle} space-y-2 p-3`}>
            <input type="hidden" name="id" value={item.id} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="confirmo" value="1" required />
              Confirmo o cancelamento
            </label>
            <button className={btnDanger}>Cancelar este post</button>
          </form>

          <p className={hint}>
            Cancelar tira o post da fila e ele não sai. Se ele já tiver saído, só o
            aplicativo do Instagram apaga — a API não apaga mídia.
          </p>
        </section>
      )}

      {/* O MESMO `<Script>` da tela antiga, e pelo mesmo motivo: a única coisa
          que esta página precisa do navegador é UM NÚMERO que só existe lá. Se
          ele não rodar, nada quebra — `fusoDoCampo` cai no padrão de Brasília. */}
      <Script id="fuso-do-remarcar">
        {`document.querySelectorAll('input[name="fuso"]').forEach(function(c){c.value=String(new Date().getTimezoneOffset())})`}
      </Script>
    </div>
  );
}
