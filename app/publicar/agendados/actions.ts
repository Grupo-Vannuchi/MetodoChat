"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSelectedAccount } from "@/lib/account";
import { getConfig, sql } from "@/lib/db";
import { HORIZONTE_DO_TIQUE_EM_SEGUNDOS, scheduleTick } from "@/lib/qstash";
import {
  atrasoDoTiqueDoRemarcar,
  camposDaDataHora,
  confirmouOCancelamento,
  desfechoDaMudanca,
  desfechoDaRecusaDaData,
  fusoDoCampo,
  identificadorDaFila,
  instanteDoAgendamento,
  momentoDaPublicacao,
  textoDaRecusaDaPublicacao,
  TEXTO_SEM_CONFIRMACAO_DO_CANCELAMENTO,
} from "@/lib/publicacao";
import { avisoDoDesfecho, urlDeAgendadosComAviso } from "@/lib/avisos";

/**
 * CANCELAR E REMARCAR UM POST AGENDADO.
 *
 * =============================================================================
 * A CORRIDA COM O DRENO É A PEÇA CENTRAL DESTE ARQUIVO, E ELA É REAL
 *
 * O dreno reivindica o item com
 *
 *   update queue set status = 'sending', claimed_at = now(), attempts = ...
 *    where status = 'pending' and not_before <= now() ... for update skip locked
 *
 * e ele roda DENTRO DO WEBHOOK (`lib/queue-drain.ts`), a qualquer instante.
 * Entre a lista ser desenhada e o clique em cancelar, o item pode já estar em
 * voo. Por isso os dois `update` abaixo são CONDICIONAIS, e por isso ZERO
 * LINHAS AFETADAS NÃO PODE RESPONDER "CANCELADO": a frase tem de dizer que o
 * post já saiu ou está saindo (`desfechoDaMudanca`, lib/publicacao.ts).
 *
 * Fingir sucesso aqui seria a pior mentira que este painel pode contar — e a
 * API do Instagram NÃO APAGA MÍDIA (`DELETE /{ig-media-id}` só existe no
 * caminho do Login do Facebook, medido em 03/09), então o post no ar só sai à
 * mão pelo celular.
 *
 * =============================================================================
 * AS TRÊS CONDIÇÕES DO `where` SÃO TRÊS DEFESAS DIFERENTES
 *
 *   `status = 'pending'` fecha a corrida com o dreno (acima);
 *   `account_id`         impede cancelar o post de OUTRA conta;
 *   `kind = 'publicacao'` impede que um identificador trocado atinja uma
 *                        MENSAGEM da fila — o `id` é `uuid` e a tabela é a
 *                        mesma para os onze tipos.
 *
 * A CONTA VEM DO COOKIE DE SELEÇÃO, NUNCA DO FORMULÁRIO. É a mesma porta que
 * `alvoDoLote` (lib/lote.ts) fecha no envio em lote e que `caminhosDoCampo`
 * fecha na publicação, aqui pela porta do identificador.
 *
 * =============================================================================
 * NENHUMA SAÍDA MUDA, e nenhum `try/catch` neste arquivo
 *
 * `redirect()` funciona LANÇANDO — é assim que o Next corta a renderização —, e
 * um `catch` que devia proteger outra coisa engole esse lançamento junto,
 * deixando a ação voltar calada: a tela recarrega igual, e ninguém fica sabendo
 * de nada. Foi o defeito que o conserto de 02/09 fechou em cinco ações desta
 * base, e é o quinto plantio que `testes-integracao/agendados.integracao.ts`
 * mede. Toda saída daqui sai por `redirect` com aviso, e o texto e o tom de
 * cada uma vêm de função pura (`avisoDoDesfecho`), nunca de string escrita aqui.
 *
 * =============================================================================
 * E ELAS NÃO DECIDEM NADA POR CONTA PRÓPRIA
 *
 * Cada `if` abaixo é a leitura de uma função pura com caso de teste — a lição
 * medida em `enviarLote` (app/contatos/actions.ts), onde as três perguntas que
 * moravam soltas no corpo da ação eram invisíveis para os quatro portões.
 */

/** O `where` das duas ações, escrito UMA vez. Ver as três defesas no cabeçalho.
 *  Ele é constante do código, e os valores entram como `$1`/`$2` — nenhum texto
 *  do navegador é concatenado aqui. */
const ALVO_DA_MUDANCA =
  `where id = $1 and account_id = $2 and kind = 'publicacao' and status = 'pending'`;

/**
 * O STATUS do item, ignorando o filtro de status — ou `null` se ele não existe.
 *
 * É a segunda ida ao banco, e ela só acontece no caminho de falha — que é o
 * raro. Sem ela, "zero linhas" seria uma resposta só para dois fatos opostos: o
 * post é seu e já saiu (`tarde_demais`), ou ele nunca foi seu (`nao_encontrado`).
 *
 * ELA DEVOLVE O STATUS, E NÃO UM `boolean`, e a diferença foi um defeito medido
 * em 09/09/2026: com `boolean`, todo "zero linhas com o item existindo" virava
 * `tarde_demais`, e um item `skipped` (que o próprio dono cancelou na outra
 * aba) ou `failed` (que a Meta recusou) recebia a frase "este post já saiu... só
 * o aplicativo do Instagram apaga". Ver `desfechoDaMudanca` (lib/publicacao.ts),
 * que é quem decide — aqui só se lê a coluna.
 *
 * `account_id` E `kind` CONTINUAM NO `where`, e só `status` sai: a pergunta é
 * "qual é o status do post SEU com este identificador?". Um item de outra conta
 * responderia um status e faria a tela dizer que o post de outra pessoa já saiu —
 * que é contar sobre a fila alheia.
 */
async function statusNaConta(id: string, contaId: string): Promise<string | null> {
  const linhas = (await sql().query(
    `select status from queue where id = $1 and account_id = $2 and kind = 'publicacao'`,
    [id, contaId]
  )) as { status: string }[];
  return linhas[0]?.status ?? null;
}

/** As duas telas que uma mudança desatualiza: a lista de agendados (um item a
 *  menos, ou com outra hora) e Envios, onde o mesmo item aparece. */
function revalidarAsDuasTelas(): void {
  revalidatePath("/publicar/agendados");
  revalidatePath("/eventos");
}

export async function cancelarPublicacao(formData: FormData): Promise<void> {
  const conta = await getSelectedAccount();
  if (!conta) {
    redirect(
      urlDeAgendadosComAviso({ tom: "erro", texto: textoDaRecusaDaPublicacao("sem_conta") })
    );
  }

  // A CONFIRMAÇÃO É CONFERIDA AQUI, e não só pelo `required` da caixa: aquele
  // atributo é do navegador e não chega ao servidor. Ver `confirmouOCancelamento`.
  if (!confirmouOCancelamento(formData.get("confirmo"))) {
    redirect(
      urlDeAgendadosComAviso({ tom: "erro", texto: TEXTO_SEM_CONFIRMACAO_DO_CANCELAMENTO })
    );
  }

  // O CAMPO É DO USUÁRIO, e a coluna é `uuid`: um texto qualquer não daria zero
  // linhas, daria uma EXCEÇÃO do Postgres subindo pela ação. Ver
  // `identificadorDaFila`.
  const id = identificadorDaFila(formData.get("id"));
  if (!id) {
    redirect(urlDeAgendadosComAviso(avisoDoDesfecho("nao_encontrado", "cancelar")));
  }

  // `skipped` E NÃO `failed`, e a distinção é a que a tela de Envios já lê: o
  // post não falhou, ele foi retirado de propósito. O `error` guarda o motivo,
  // que é o que aparece na linha.
  const afetadas = await sql().query(
    `update queue set status = 'skipped', error = 'cancelado por voce'
     ${ALVO_DA_MUDANCA}
     returning id`,
    [id, conta.ig_user_id]
  );

  // A SEGUNDA CONSULTA SÓ NO CAMINHO DE FALHA, e é o `?` que garante isso: com
  // linha afetada não há pergunta a fazer, e o `null` que entra é lido como
  // "não interessa" por `desfechoDaMudanca`, que já respondeu "feito" antes.
  const desfecho = desfechoDaMudanca(
    afetadas.length,
    afetadas.length > 0 ? null : await statusNaConta(id, conta.ig_user_id)
  );

  revalidarAsDuasTelas();
  redirect(urlDeAgendadosComAviso(avisoDoDesfecho(desfecho, "cancelar")));
}

export async function remarcarPublicacao(formData: FormData): Promise<void> {
  const conta = await getSelectedAccount();
  if (!conta) {
    redirect(
      urlDeAgendadosComAviso({ tom: "erro", texto: textoDaRecusaDaPublicacao("sem_conta") })
    );
  }

  const id = identificadorDaFila(formData.get("id"));
  if (!id) {
    redirect(urlDeAgendadosComAviso(avisoDoDesfecho("nao_encontrado", "remarcar")));
  }

  // A HORA É LIDA PELOS MESMOS TRÊS PASSOS DA TELA DE COMPOR, e nenhuma regra de
  // data nova nasce aqui: os campos (que recusam 30 de fevereiro em vez de
  // deixar `Date.UTC` transbordar), o instante (que aplica o fuso do navegador,
  // porque `datetime-local` não tem fuso) e o momento (que recusa o passado).
  //
  // A PALAVRA É FIXA EM "depois": remarcar é sempre para outra hora — não há
  // par de rádios nesta tela, e "remarcar para agora" seria publicar agora, que
  // é a decisão irreversível que nenhum botão desta lista toma por engano.
  const campos = camposDaDataHora(formData.get("data_hora"));
  const fuso = fusoDoCampo(formData.get("fuso"));
  const momento = momentoDaPublicacao(
    "depois",
    campos ? instanteDoAgendamento(campos, fuso) : null,
    Date.now()
  );
  if (!momento.ok) {
    redirect(urlDeAgendadosComAviso(avisoDoDesfecho(desfechoDaRecusaDaData(momento.motivo), "remarcar")));
  }
  // `quando` é `Date | null` porque "agora" é resposta legítima de
  // `momentoDaPublicacao` — e "agora" só nasce da palavra "agora", que a linha
  // acima não usa. O ramo é inalcançável; ele existe porque o compilador cobra
  // a união, e recusar é a única saída que não inventa uma hora.
  if (momento.quando === null) {
    redirect(urlDeAgendadosComAviso(avisoDoDesfecho("data_invalida", "remarcar")));
  }

  const afetadas = await sql().query(
    `update queue set not_before = $3
     ${ALVO_DA_MUDANCA}
     returning id`,
    [id, conta.ig_user_id, momento.quando]
  );

  const desfecho = desfechoDaMudanca(
    afetadas.length,
    afetadas.length > 0 ? null : await statusNaConta(id, conta.ig_user_id)
  );

  // O TIQUE DA HORA NOVA, e ele é o outro lado de "Ele sai na hora nova".
  //
  // ATÉ 09/09/2026 NÃO HAVIA TIQUE AQUI, e o comentário que justificava a
  // ausência LIA ERRADO o código que citava: ele afirmava que
  // `enqueuePublicacao` passa `agendarTique: false` de propósito. Ela não
  // passa — `lib/engine.ts` passa `agendarTique: atraso <= HORIZONTE`. Compor
  // arma o tique sempre que a hora cabe em 24 h; remarcar não armava nunca.
  //
  // E O CRON DIÁRIO NÃO COBRIA O BURACO: `armarTiquesDoDia` só é honesta para
  // `not_before` escrito ANTES da passagem dela, e remarcar move a hora para
  // dentro de uma janela JÁ VARRIDA. Medido: compor para +2 h gera 1 tique;
  // remarcar para +2 h gerava 0, e o post podia sair ~23 h depois, calado.
  //
  // A DECISÃO É DE `atrasoDoTiqueDoRemarcar` (lib/publicacao.ts), com caso de
  // teste, e não de um `if` escrito aqui — a mesma disciplina de todo o resto
  // deste arquivo. Ela respeita as três regras de `enqueue`: nada abaixo de
  // 15 s, nada além do horizonte (além de um dia quem arma é o cron), e cinco
  // segundos de folga com o teto aplicado depois.
  //
  // ELE NÃO PODE DERRUBAR A AÇÃO, e não derruba: `scheduleTick` (lib/qstash.ts)
  // engole todo erro por desenho. Sem tique o post ainda sai — pelo próximo
  // webhook ou pelo cron —, só mais tarde; com uma exceção subindo daqui, o
  // `redirect` de baixo nunca aconteceria e a ação voltaria muda.
  if (desfecho === "feito") {
    const atrasoDoTique = atrasoDoTiqueDoRemarcar(
      momento.quando,
      Date.now(),
      HORIZONTE_DO_TIQUE_EM_SEGUNDOS
    );
    if (atrasoDoTique !== null) {
      await scheduleTick((await getConfig()).app_url ?? "", atrasoDoTique);
    }
  }

  revalidarAsDuasTelas();
  redirect(urlDeAgendadosComAviso(avisoDoDesfecho(desfecho, "remarcar")));
}
