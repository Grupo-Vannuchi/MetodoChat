import { NextRequest, NextResponse } from "next/server";
import { armarTiquesDoDia, cancelarLotesVencidos, drainQueue } from "@/lib/queue-drain";
import { refreshLongLivedToken, getUserProfile, getProfile } from "@/lib/ig";
import { listAccounts, updateAccountToken, sql } from "@/lib/db";
import { safeEqualSecret } from "@/lib/crypto";
import {
  JANELA_DAS_FOTOS,
  escolherParaRenovar,
  fotoDepoisDaFalha,
  fotoDepoisDaResposta,
} from "@/lib/fotos-dos-contatos";

export const maxDuration = 60;

// Cron diário da Vercel (o plano grátis permite 1x/dia). Para CADA conta
// conectada:
// 1) renova o token longo do Instagram quando ele tem mais de 7 dias
// 2) renova nome/foto dos contatos mais recentes cuja foto venceu ou vence
//    antes da próxima passagem (as URLs de foto expiram; lib/fotos-dos-contatos.ts)
// 3) encerra os lotes guardados cujo prazo venceu
// e no fim drena a fila como rede de segurança.
export async function GET(req: NextRequest) {
  // Com CRON_SECRET, a Vercel manda "Authorization: Bearer <segredo>". SEM ela, a rotina RECUSA, como o
  // tique da fila (app/api/queue/tick/route.ts): até 27/10/2026 ela liberava, e a variável só existe em
  // produção, então os previews (que leem o banco de produção) rodavam a rotina para qualquer pedido
  // (docs/specs/2026-10-27-cron-e-oauth.md).
  const secret = process.env.CRON_SECRET;
  if (!secret || !safeEqualSecret(req.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return new NextResponse("unauthorized", { status: 401 });
  }

  let refreshed = 0;
  let profiles = 0;
  // Contado à parte de `profiles`: uma é a foto da conta conectada, a outra a
  // dos contatos. Somar as duas esconderia justamente o caso que quebrou.
  let ownProfiles = 0;
  const accounts = await listAccounts();

  for (const account of accounts) {
    let token = account.access_token;

    if (account.token_expires_at) {
      const expires = new Date(account.token_expires_at).getTime();
      const ageDays = 60 - (expires - Date.now()) / 86_400_000; // token longo dura 60 dias
      if (ageDays >= 7) {
        try {
          const r = await refreshLongLivedToken(token);
          await updateAccountToken(
            account.ig_user_id,
            r.access_token,
            new Date(Date.now() + r.expires_in * 1000)
          );
          token = r.access_token;
          refreshed++;
        } catch {
          // token com menos de 24h ou erro transitório: tenta de novo amanhã
        }
      }
    }

    // A foto da PRÓPRIA conta expira igual à dos contatos, e ninguém a
    // renovava: era gravada uma vez no OAuth e ficava lá. Semanas depois a URL
    // morria e o avatar do painel aparecia quebrado — sem erro, sem log, e sem
    // conserto possível a não ser reconectar a conta inteira.
    //
    // Foi assim que apareceu: a do install ficou 403 enquanto as 31 dos
    // contatos carregavam, porque só elas passavam por aqui.
    // `contaLida` É A PROVA DE QUE O TOKEN VALE nesta passagem, e só com ela uma
    // recusa da Meta anula a foto de um contato (`fotoDepoisDaFalha`).
    let contaLida = false;
    try {
      const meu = await getProfile(token);
      contaLida = true;
      await sql().query(
        `update accounts set
           username = coalesce($2, username),
           name = coalesce($3, name),
           profile_picture_url = coalesce($4, profile_picture_url)
         where ig_user_id = $1`,
        [account.ig_user_id, meu.username, meu.name ?? null, meu.profile_picture_url ?? null]
      );
      ownProfiles++;
    } catch {
      // token recém-renovado às vezes demora a valer; amanhã tenta de novo
    }

    // AS 20 VAGAS VÃO PARA QUEM PRECISA (achado 135): até 03/11/2026 eram as
    // mesmas 20 mais recentes todo dia, e o resto das fotos vencia. A ordem da
    // recência é a de antes; quem entra e quem sai está em
    // lib/fotos-dos-contatos.ts. O nome e o arroba vêm junto com a foto, então
    // passam a ser relidos a cada ~4 dias, e não mais todo dia.
    const agora = Date.now();
    const contacts = (await sql().query(
      `select ig_id, profile_pic from contacts
       where account_id = $1 and profile_pic is not null
       order by coalesce(last_reply_at, first_contact_at) desc
       limit $2`,
      [account.ig_user_id, JANELA_DAS_FOTOS]
    )) as { ig_id: string; profile_pic: string | null }[];

    for (const c of escolherParaRenovar(contacts, agora)) {
      // `escolherParaRenovar` só devolve quem tem foto.
      const atual = c.profile_pic as string;
      try {
        const p = await getUserProfile(c.ig_id, token);
        await sql().query(
          `update contacts set
             username = coalesce($3, username),
             name = coalesce($4, name),
             profile_pic = $5
           where account_id = $1 and ig_id = $2`,
          [
            account.ig_user_id,
            c.ig_id,
            p.username ?? null,
            p.name ?? null,
            fotoDepoisDaResposta(atual, p.profile_pic, agora),
          ]
        );
        profiles++;
      } catch (erro) {
        // conta privada/apagada ou só comentou: mantém o que já temos, menos a
        // foto JÁ vencida que a Meta recusou de verdade. Ela não volta mais (o
        // motor só busca o perfil na 1ª mensagem), e sem anular tomaria uma
        // vaga por dia para sempre.
        if (fotoDepoisDaFalha(atual, erro, contaLida, agora) === "anular") {
          await sql().query(
            `update contacts set profile_pic = null where account_id = $1 and ig_id = $2`,
            [account.ig_user_id, c.ig_id]
          );
        }
      }
    }
  }

  // A VARREDURA DOS LOTES VENCIDOS mora aqui porque é o único relógio do
  // produto: um item `guardado` espera uma PESSOA, e quem nunca mais fala nunca
  // faz nada acontecer. Uma vez por dia basta — o prazo é um dia inteiro
  // (`validadeDoDia`, lib/lote.ts) — e ela não toca em `pending`, então não
  // devolve nada à disputa da fila.
  const { vencidos } = await cancelarLotesVencidos();

  // OS TIQUES DO DIA, e eles moram aqui pelo mesmo motivo que a varredura de
  // lotes vencidos mora: este é o único relógio garantido do produto.
  //
  // O QUE ELA RESOLVE: um post agendado para o mês que vem não pode depender de
  // o QStash aceitar 30 dias de atraso — horizonte que nunca foi verificado, e
  // cuja recusa some dentro do `catch` de `scheduleTick`. `enqueuePublicacao`
  // não arma nada além de um dia, e esta linha arma o que entrou na janela das
  // próximas 24 h. Como ela roda a cada 24 h, todo post tem uma passagem do
  // cron dentro do dia anterior à sua hora — não há buraco.
  //
  // ANTES DA DRENAGEM, de propósito: ela olha `not_before > now()`, e o que já
  // está na hora sai na linha seguinte, sem precisar de tique nenhum.
  //
  // ABERTO E DECLARADO — O ORÇAMENTO DE 60 SEGUNDOS. `maxDuration` é 60 (topo
  // deste arquivo) e esta varredura faz até 200 publicações SEQUENCIAIS no
  // QStash, uma ida de rede cada; a ~200 ms por ida são ~40 s, em cima do laço
  // das contas que já rodou. Estourado o teto, a drenagem da linha de baixo não
  // acontece naquele dia.
  //
  // NÃO FOI MEXIDO PORQUE AS DUAS SAÍDAS TROCAM UM PERDEDOR POR OUTRO, e não
  // tenho medição para escolher: inverter a ordem (drenar primeiro) salva a
  // drenagem e passa a arriscar o armamento — e aí um post de daqui a 12 h só
  // sairia no webhook seguinte, porque a passagem seguinte do cron é 24 h
  // depois, já passada a hora dele. Baixar o `limit` corta horários do dia.
  // Nada se PERDE em nenhum dos dois: a fila continua drenando por webhook.
  // Medir quanto uma passagem do cron custa hoje, em produção, é o que decide.
  const { armados } = await armarTiquesDoDia();

  const drained = await drainQueue();
  return NextResponse.json({
    accounts: accounts.length,
    refreshed,
    ownProfiles,
    profiles,
    vencidos,
    armados,
    ...drained,
  });
}
