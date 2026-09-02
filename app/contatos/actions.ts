"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { getSelectedAccount } from "@/lib/account";
import { getUserProfile } from "@/lib/ig";
import { enqueueLote } from "@/lib/engine";
import { drainQueue } from "@/lib/queue-drain";
import { alvoDoLote, filtroDoCampo, urlDeLoteValida, validadeDoDia } from "@/lib/lote";
import {
  motivoDoLoteVazio,
  textoDaRecusaDoLote,
  avisoDoLoteEnviado,
  urlDoAviso,
  avisoDosPerfis,
  type ContagemDoLote,
} from "@/lib/avisos";

/**
 * Preenche nome/@ dos contatos que ficaram salvos só com o número (IGSID),
 * criados antes de o app buscar o perfil na hora do webhook.
 *
 * O QUE ELA FAZ É SOBRE A CONTA INTEIRA, E A VOLTA É PARA O RECORTE — e as
 * duas coisas são diferentes, o que aqui já foi confundido por escrito.
 *
 * Esta função não recebia `FormData`: a assinatura era `(): Promise<void>` e os
 * dois `redirect` cravavam `{ tipo: "tudo" }`, enquanto `page.tsx` mandava um
 * `<input type="hidden" name="categoria">` no formulário com um comentário
 * dizendo "O RECORTE VAI JUNTO". Havia DOIS comentários afirmando coisas
 * opostas, e o campo era código morto. A consequência era medida: quem estava
 * em `/contatos?categoria=` (a ficha "sem categoria") e clicava em "Buscar
 * nomes" voltava para `/contatos` — ou seja, o pedido PRESENTE-E-VAZIO era
 * remontado como AUSENTE, que é o Crítico de 01/09 por uma terceira porta.
 *
 * A TELA É QUEM DECIDE ISSO: o botão aparece dentro da tela já filtrada, e
 * devolver o dono para a conta inteira é uma surpresa gratuita. Então o campo
 * passa a ser lido, do jeito que `enviarLote` já lê — `filtroDoCampo`
 * (lib/lote.ts) é quem distingue "tudo" de "sem categoria", e `null` (campo
 * ilegível) cai em "tudo", que aqui é o recorte certo porque a AÇÃO é sobre a
 * conta inteira mesmo.
 *
 * O QUE NÃO MUDOU: a busca continua varrendo a conta INTEIRA (`where
 * account_id = $1 and username is null`), e não o recorte. O filtro aqui é o
 * caminho de VOLTA, e nada além disso.
 */
export async function atualizarPerfis(formData: FormData): Promise<void> {
  // Antes de qualquer recusa, como em `enviarLote`: as duas saídas desta função
  // devolvem o dono para a mesma ficha em que ele estava.
  const filtro = filtroDoCampo(formData.get("categoria"));

  const account = await getSelectedAccount();
  if (!account) {
    redirect(
      urlDoAviso("/contatos", filtro ?? { tipo: "tudo" }, {
        tom: "erro",
        texto: textoDaRecusaDoLote("sem_conta"),
      })
    );
  }

  const rows = (await sql().query(
    `select ig_id from contacts
     where account_id = $1 and username is null
     order by first_contact_at desc limit 30`,
    [account.ig_user_id]
  )) as { ig_id: string }[];

  let atualizados = 0;
  for (const r of rows) {
    try {
      const p = await getUserProfile(r.ig_id, account.access_token);
      await sql().query(
        `update contacts set
           username = coalesce($3, username),
           name = coalesce($4, name),
           profile_pic = coalesce($5, profile_pic)
         where account_id = $1 and ig_id = $2`,
        [account.ig_user_id, r.ig_id, p.username ?? null, p.name ?? null, p.profile_pic ?? null]
      );
      // SÓ CONTA QUANDO A ATUALIZAÇÃO ACONTECE DE VERDADE. Antes disto o
      // `try/catch` do laço engolia toda falha e a função nunca soube quantos
      // perfis vieram da Meta de fato — `avisoDosPerfis` (lib/avisos.ts)
      // precisa dos dois números para distinguir "nenhum veio" (token vencido,
      // permissão revogada) de "todo mundo já tinha nome".
      atualizados++;
    } catch {
      // perfil indisponível (conta privada/apagada ou só comentou): pula
    }
  }
  revalidatePath("/contatos");
  redirect(
    urlDoAviso("/contatos", filtro ?? { tipo: "tudo" }, avisoDosPerfis(atualizados, rows.length))
  );
}

/**
 * Enfileira um lote para os contatos do filtro atual.
 *
 * QUEM DECIDE QUEM RECEBE É `alvoDoLote` (lib/lote.ts), E NÃO ESTA FUNÇÃO. As
 * três perguntas que ela responde — o recorte, a confirmação e a conta — moravam
 * aqui soltas, e as três eram invisíveis para os portões: apagar cada uma
 * passava por lint, typecheck, 938 testes puros e 70 de integração sem uma linha
 * vermelha. Uma delas mandava a ficha "sem categoria" para a conta INTEIRA.
 * Agora elas têm caso em `tests/lote.test.ts`.
 *
 * O `account_id` do `where` continua vindo do cookie, nunca do formulário — o
 * mesmo cuidado de `definirCategoria` —, e `alvoDoLote` o confere DE NOVO sobre
 * a linha que voltou.
 */
export async function enviarLote(formData: FormData): Promise<void> {
  // O FILTRO VEM PRIMEIRO DE TUDO, antes de qualquer recusa: cada `redirect`
  // abaixo devolve o dono para a MESMA categoria que ele estava olhando, e não
  // para "tudo" — ele só perde o recorte quando o próprio campo não é legível
  // (comentário mais abaixo, junto de `motivoDoLoteVazio`).
  const filtro = filtroDoCampo(formData.get("categoria"));

  const account = await getSelectedAccount();
  if (!account) {
    redirect(
      urlDoAviso("/contatos", filtro ?? { tipo: "tudo" }, {
        tom: "erro",
        texto: textoDaRecusaDoLote("sem_conta"),
      })
    );
  }

  const texto = String(formData.get("texto") ?? "").trim();
  if (!texto) {
    redirect(
      urlDoAviso("/contatos", filtro ?? { tipo: "tudo" }, {
        tom: "erro",
        texto: textoDaRecusaDoLote("sem_texto"),
      })
    );
  }

  const url = String(formData.get("url") ?? "").trim();
  // A URL ERRADA BARRA O PEDIDO INTEIRO, e não vira mensagem sem link: quem
  // digitou um endereço esperava um botão de verdade, e mandar o texto calado
  // sem avisar seria trocar o pedido do dono por outro que ele não fez. Ver o
  // porquê em `urlDeLoteValida` (lib/lote.ts).
  if (url && !urlDeLoteValida(url)) {
    redirect(
      urlDoAviso("/contatos", filtro ?? { tipo: "tudo" }, {
        tom: "erro",
        texto: textoDaRecusaDoLote("url_invalida"),
      })
    );
  }

  const rotulo = String(formData.get("rotulo") ?? "").trim();
  const prazo = String(formData.get("valido_ate") ?? "").trim();
  // O CAMPO NÃO CARREGA MAIS O VALOR CRU DA URL: `?categoria=` ausente e
  // `?categoria=` vazio são pedidos DIFERENTES, e um `<input type="hidden">`
  // sempre existe no DOM — os dois chegavam aqui como `""`. Ver `campoDoFiltro`
  // (lib/lote.ts) para a medição. `filtro` já foi lido lá em cima, antes das
  // primeiras recusas.

  const linhas = (await sql().query(
    `select c.ig_id, c.account_id, c.categoria, c.last_reply_at,
            (select count(*)::int from events e
              where e.account_id = c.account_id
                and e.payload->'sender'->>'id' = c.ig_id
                and e.type in ('message','story_reply','abertura','quick_reply')) as recebidas
       from contacts c where c.account_id = $1`,
    [account.ig_user_id]
  )) as {
    ig_id: string;
    account_id: string;
    categoria: string | null;
    last_reply_at: Date | null;
    recebidas: number;
  }[];

  const confirmado = formData.get("confirmado") === "1";
  const alvo = alvoDoLote(linhas, {
    conta: account.ig_user_id,
    filtro,
    confirmado,
  });
  if (!alvo.length) {
    // OS TRÊS VAZIOS SÃO TRÊS CONSELHOS DIFERENTES, e `motivoDoLoteVazio`
    // (lib/avisos.ts) é quem os distingue: sem confirmação, filtro ilegível ou
    // ninguém no recorte. `linhas` JÁ veio filtrada pelo `where c.account_id =
    // $1` acima, então `linhas.length` é exatamente "quantos contatos esta
    // conta tem" — o terceiro parâmetro que a função pede.
    const motivo = motivoDoLoteVazio(confirmado, filtro !== null, linhas.length);
    redirect(
      urlDoAviso("/contatos", filtro ?? { tipo: "tudo" }, {
        tom: "erro",
        texto: textoDaRecusaDoLote(motivo),
      })
    );
  }

  // GUARDADO EM VARIÁVEL, e não descartado: é por ele que a contagem do
  // sucesso, mais abaixo, consulta a fila DEPOIS do dreno — e não pelo
  // retorno de `drainQueue`, que drena a fila inteira e contaria itens de
  // outros envios que saíram no mesmo dreno.
  const loteId = crypto.randomUUID();
  await enqueueLote(account.ig_user_id, loteId, alvo.map((c) => c.ig_id), {
    text: texto,
    url: url || undefined,
    buttonLabel: rotulo || undefined,
    // O DIA ESCOLHIDO VALE INTEIRO, e quem sabe disso é `validadeDoDia`
    // (lib/lote.ts): `new Date("2026-09-07")` é meia-noite UTC, ou seja 06/09 às
    // 21:00 em Brasília — o prazo vencia 27 horas antes do que o dono pediu.
    // Data vazia (e data impossível) continua sendo "sem prazo".
    validoAte: validadeDoDia(prazo),
  });

  // ENFILEIRAR NÃO ENVIA, e sem esta linha o lote não saía AGORA de jeito
  // nenhum. Os cinco chamadores de `drainQueue` eram o webhook, o tique do
  // QStash, o cron das 09:00 e `sendReply` — o lote não estava entre eles —, e
  // `enqueue` (lib/engine.ts) só pede um tique ao QStash quando o atraso passa
  // de 15 segundos: o item de lote nasce com atraso ZERO e nunca agendava nada.
  //
  // A tela prometia "3 recebem agora" e eles recebiam quando chegasse um
  // webhook de fora, ou às 09:00 do dia seguinte. Se a janela de 24h fechasse
  // nesse meio-tempo, os três viravam `guardado` sem ninguém ter decidido isso.
  //
  // ANTES DO `revalidatePath`, E NÃO DEPOIS — é o que o comentário de
  // `sendReply` (app/conversas/[id]/actions.ts) explica com dois casos de
  // produção: revalidar antes de o envio terminar faz a tela voltar dizendo
  // "enviando…", verdade naquele instante e mentira dois segundos depois. Pelo
  // mesmo motivo o `redirect` de sucesso, mais abaixo, vem depois dos DOIS —
  // um `redirect` dentro deste `try` seria engolido pelo `catch` e a ação
  // voltaria muda, o defeito exato que esta tarefa fecha.
  //
  // UMA DRENAGEM É NO MÁXIMO `BATCH_SIZE` (15) ITENS, ~9 segundos de ponta a
  // ponta; o resto do lote sai pelo tique que a própria drenagem agenda. Quem
  // clicou espera pelo primeiro punhado, e não pelos 126.
  try {
    await drainQueue();
  } catch {
    // A trava atômica garante que o próximo dreno recupera. Os itens ficam
    // 'pending' e a tela de Envios mostra isso — que aqui é verdade.
  }

  revalidatePath("/contatos");
  revalidatePath("/eventos");

  // A CONTAGEM NÃO VEM DO RETORNO DE `drainQueue` — ver o comentário acima do
  // `loteId`. Conta-se pelos itens do PRÓPRIO lote, achados pelo `lote_id` que
  // `payloadDoLote` (lib/lote.ts) grava em cada item deste envio. Saiu agora =
  // `status = 'sent'`; ficou esperando a pessoa voltar a falar = `status =
  // 'guardado'` (migrations/009-fila-estado-guardado.sql).
  //
  // `pendentes` ENTROU JUNTO, e é o que desfaz a mentira tranquilizadora do
  // caso (0, 0): se o `catch` silencioso do dreno, acima, engoliu uma falha
  // ANTES de tocar qualquer item deste lote, `agora` e `guardadas` saem os
  // dois zerados — mas os itens não sumiram, ficaram `pending`. Sem esta
  // coluna, `avisoDoLoteEnviado` (lib/avisos.ts) não teria como distinguir
  // esse caso do vazio genuíno, que `alvoDoLote` já recusou bem mais acima.
  //
  // OS CINCO STATUS, E NÃO TRÊS (conserto de 02/09/2026). Esta consulta
  // perguntava por `sent`, `guardado` e `pending`, e o dreno grava CINCO para
  // `dm_lote`: faltavam `skipped` ("o lote venceu antes de sair", "janela de
  // 24h fechada") e `failed` (a Meta recusou de vez) — ou seja, os dois
  // desfechos RUINS eram os dois que ninguém contava, e o aviso saía verde
  // sobre um envio em que nada saiu. O porquê inteiro está em
  // `avisoDoLoteEnviado`.
  //
  // `sending` VAI COM OS PENDENTES: é item reivindicado por uma drenagem
  // concorrente, "a caminho", e não um desfecho. `total` é `count(*)` sem
  // filtro, e é ele que impede a próxima lista de status escrita à mão de
  // envelhecer calada — um status novo faz a soma não fechar, e o aviso acusa.
  const contagem = (await sql().query(
    `select
       count(*) filter (where status = 'sent')::int as agora,
       count(*) filter (where status = 'guardado')::int as guardadas,
       count(*) filter (where status in ('pending','sending'))::int as pendentes,
       count(*) filter (where status in ('failed','skipped'))::int as paradas,
       count(*)::int as total
     from queue
     where account_id = $1 and kind = 'dm_lote' and payload->>'lote_id' = $2`,
    [account.ig_user_id, loteId]
  )) as ContagemDoLote[];
  const contado: ContagemDoLote = contagem[0] ?? {
    agora: 0,
    guardadas: 0,
    pendentes: 0,
    paradas: 0,
    total: 0,
  };

  redirect(urlDoAviso("/contatos", filtro ?? { tipo: "tudo" }, avisoDoLoteEnviado(contado)));
}
