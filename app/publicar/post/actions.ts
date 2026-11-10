"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSelectedAccount } from "@/lib/account";
import { getConfig, sql } from "@/lib/db";
import { HORIZONTE_DO_TIQUE_EM_SEGUNDOS, scheduleTick } from "@/lib/qstash";
import { drainQueue, drenarUmaPublicacaoDoLinkedin, limparOBucket } from "@/lib/queue-drain";
import {
  atrasoDoTiqueDaPublicacao,
  camposDaDataHora,
  confirmouOCancelamento,
  desfechoDaMudanca,
  desfechoDaRecusaDaData,
  fusoDoCampo,
  identificadorDaFila,
  instanteDoAgendamento,
  momentoDaPublicacao,
  textoDaRecusaDaPublicacao,
  MOTIVO_CANCELADO_PELO_DONO,
  TEXTO_SEM_CONFIRMACAO_DO_CANCELAMENTO,
} from "@/lib/publicacao";
import { avisoDoDesfecho, urlDeAgendadosComAviso } from "@/lib/avisos";
import { exigirSessao } from "@/lib/exigir-sessao";
// O POST DE QUALQUER REDE (a parte 2a do LinkedIn): as duas ações valem para os tipos de post da fila, os arquivos
// a apagar e o aviso do "já saiu" saem do payload e da rede da linha.
import { TIPOS_DE_PUBLICACAO } from "@/lib/fila-tipos";
import { avisoDoDesfechoDoPost, caminhosDoPostDaFila, ehPostDoLinkedin } from "@/lib/post-da-fila";

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
 *   `kind` na lista dos tipos de post (`TIPOS_DE_PUBLICACAO`, lib/fila-tipos.ts:
 *                        o do Instagram e o do LinkedIn) impede que um
 *                        identificador trocado atinja uma MENSAGEM da fila — o
 *                        `id` é `uuid` e a tabela é a mesma para os doze tipos.
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
 *  Ele é constante do código, e os valores entram como `$1`/`$2`/`$4` (os tipos
 *  de post) — nenhum texto do navegador é concatenado aqui. */
const ALVO_DA_MUDANCA =
  `where id = $1 and account_id = $2 and kind = any($4::text[]) and status = 'pending'`;

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
async function statusNaConta(id: string, contaId: string): Promise<{ status: string; kind: string } | null> {
  // O `kind` VOLTA JUNTO (a parte 2a do LinkedIn): é ele que escolhe o aviso do "já saiu" de cada rede.
  const linhas = (await sql().query(
    `select status, kind from queue where id = $1 and account_id = $2 and kind = any($3::text[])`,
    [id, contaId, Array.from(TIPOS_DE_PUBLICACAO)]
  )) as { status: string; kind: string }[];
  return linhas[0] ?? null;
}

/** As duas telas que uma mudança desatualiza: a lista de agendados (um item a
 *  menos, ou com outra hora) e Envios, onde o mesmo item aparece. */
function revalidarAsDuasTelas(): void {
  revalidatePath("/publicar");
  revalidatePath("/eventos");
}

export async function cancelarPublicacao(formData: FormData): Promise<void> {
  await exigirSessao();
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
  //
  // O MOTIVO É CONSTANTE COMPARTILHADA desde 10/09/2026, e não mais um literal
  // aqui. `skipped` é o mesmo status que o sistema usa quando ELE pula um item
  // (janela de 24h fechada, lote vencido), e era por isso que a tela chamava o
  // post cancelado de "Não enviada" e lhe prometia nova tentativa. Quem separa
  // os dois é este texto: escrito aqui, lido por `statusBadge` e `friendlyError`
  // (app/labels.ts). Ver `MOTIVO_CANCELADO_PELO_DONO` (lib/publicacao.ts), que
  // explica por que o par bastou no lugar de um estado novo na fila.
  //
  // O `payload` VOLTA JUNTO porque é dele que sai o caminho do arquivo a apagar
  // — ver o bloco logo abaixo. Ele é lido da MESMA linha que o `update` acabou
  // de mudar, e não de uma segunda consulta: uma segunda ida ao banco poderia
  // ler outra coisa, e aqui o que se apaga é arquivo do perfil de alguém.
  const afetadas = (await sql().query(
    `update queue set status = 'skipped', error = $3
     ${ALVO_DA_MUDANCA}
     returning id, kind, payload`,
    [id, conta.ig_user_id, MOTIVO_CANCELADO_PELO_DONO, Array.from(TIPOS_DE_PUBLICACAO)]
  )) as { id: string; kind: string; payload: unknown }[];

  // A SEGUNDA CONSULTA SÓ NO CAMINHO DE FALHA, e é o `?` que garante isso: com
  // linha afetada não há pergunta a fazer, e o `null` que entra é lido como
  // "não interessa" por `desfechoDaMudanca`, que já respondeu "feito" antes.
  const naConta = afetadas.length > 0 ? null : await statusNaConta(id, conta.ig_user_id);
  const desfecho = desfechoDaMudanca(afetadas.length, naConta?.status ?? null);
  const rede = afetadas[0]?.kind ?? naConta?.kind ?? null;

  // A MÍDIA DO POST CANCELADO SAI DO BUCKET, e o cancelamento é o outro caso em
  // que o arquivo é ÓRFÃO DE VERDADE.
  //
  // `limparOBucket` (lib/queue-drain.ts) só era chamada no ramo de sucesso da
  // publicação, e o comentário dela explica por quê: item `failed` mantém o
  // arquivo, porque quem for tentar de novo precisa da mídia. ITEM CANCELADO
  // NÃO VAI SER TENTADO DE NOVO — o arquivo ficava no bucket para sempre. O
  // próprio código já precificava isso: "um arquivo que fica no bucket não
  // incomoda ninguém hoje e vira a conta do Supabase em três meses — um reels
  // são 200 MB".
  //
  // SÓ QUANDO O `update` AFETOU LINHA, e a condição é a defesa inteira: com zero
  // linhas o item não é nosso, ou está em voo (`sending`) — e apagar a mídia de
  // um post que a Meta está BAIXANDO neste instante quebraria a publicação, do
  // jeito difícil de ler que o cabeçalho daquela função descreve.
  //
  // PAYLOAD ILEGÍVEL NÃO APAGA NADA: o leitor do payload de cada rede
  // (`caminhosDoPostDaFila`, lib/post-da-fila.ts) recusa em vez de
  // confiar num `jsonb` que pode ter sido editado por fora, e um caminho vindo
  // de um payload que ninguém entende é a última coisa que se quer entregar a um
  // `DELETE`.
  //
  // E ELA NÃO DERRUBA A AÇÃO: `limparOBucket` já tem o `try/catch` por caminho —
  // `apagarObjeto` LANÇA quando o objeto não existe, que é o caso NORMAL de uma
  // segunda tentativa —, e o que ela faz na falha é registrar em Atividade. O
  // `redirect` de baixo continua sendo a única saída desta ação.
  if (afetadas.length > 0) {
    // Os caminhos saem do payload da rede da linha (`caminhosDoPostDaFila`): o post do LinkedIn só de texto não
    // tem arquivo, e o com imagem tem um.
    const caminhos = caminhosDoPostDaFila(afetadas[0].kind, afetadas[0].payload);
    if (caminhos) await limparOBucket(afetadas[0], caminhos, conta.ig_user_id);
  }

  revalidarAsDuasTelas();
  redirect(urlDeAgendadosComAviso(avisoDoDesfechoDoPost(desfecho, "cancelar", rede)));
}

export async function remarcarPublicacao(formData: FormData): Promise<void> {
  await exigirSessao();
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

  // A HORA NOVA É GRAVADA COMO VEIO, e o `greatest` é o mesmo de
  // `enqueuePublicacao` (lib/engine.ts): a tolerância de `momentoDaPublicacao`
  // aceita o minuto corrente, que já passou, e ele vira "agora" pelo relógio do
  // banco. O `returning` devolve o que o banco mediu no mesmo statement: se o
  // item já vale, e quantos segundos faltam (spec da hora marcada).
  const afetadas = (await sql().query(
    `update queue set not_before = greatest(now(), $3::timestamptz)
     ${ALVO_DA_MUDANCA}
     returning id, kind,
               (not_before <= now()) as ja_vale,
               greatest(0, ceil(extract(epoch from (not_before - now()))))::int as falta`,
    [id, conta.ig_user_id, momento.quando, Array.from(TIPOS_DE_PUBLICACAO)]
  )) as { id: string; kind: string; ja_vale: boolean; falta: number }[];

  const naConta = afetadas.length > 0 ? null : await statusNaConta(id, conta.ig_user_id);
  const desfecho = desfechoDaMudanca(afetadas.length, naConta?.status ?? null);

  // O TIQUE DA HORA NOVA, e ele é o outro lado de "Ele sai na hora nova".
  //
  // ATÉ 09/09/2026 NÃO HAVIA TIQUE AQUI, e o comentário que justificava a
  // ausência LIA ERRADO o código que citava: ele afirmava que
  // `enqueuePublicacao` não armava tique de propósito. Ela armava sempre que a
  // hora cabia em 24 h; remarcar não armava nunca.
  //
  // E O CRON DIÁRIO NÃO COBRIA O BURACO: `armarTiquesDoDia` só é honesta para
  // `not_before` escrito ANTES da passagem dela, e remarcar move a hora para
  // dentro de uma janela JÁ VARRIDA. Medido: compor para +2 h gera 1 tique;
  // remarcar para +2 h gerava 0, e o post podia sair ~23 h depois, calado.
  //
  // O QUE JÁ VALE DRENA, como no compor (achado 99): o remarcar para o minuto
  // corrente gravava uma hora vencida sem dreno e sem tique, e o post ficava
  // parado até a próxima drenagem de outra coisa.
  //
  // O QUE AINDA NÃO VALE GANHA O TIQUE pela distância que o banco mediu
  // (`atrasoDoTiqueDaPublicacao`, lib/publicacao.ts), a mesma regra do compor:
  // nada além do horizonte (além de um dia quem arma é o cron), e cinco
  // segundos de folga com o teto aplicado depois.
  //
  // NADA DISTO PODE DERRUBAR A AÇÃO (achado 101): a hora nova já está gravada.
  // Sem tique o post ainda sai — pelo próximo webhook ou pelo cron —, só mais
  // tarde; com uma exceção subindo daqui, o `redirect` de baixo nunca
  // aconteceria e a ação voltaria muda.
  if (desfecho === "feito") {
    const { ja_vale, falta, kind } = afetadas[0];
    if (ja_vale) {
      try {
        // O POST DO LINKEDIN DRENA SÓ A PRÓPRIA LINHA (achado 211), como o "agora" do compor: o dreno inteiro
        // mandaria também as mensagens vencidas do banco, que é um só para a produção e os previews.
        if (ehPostDoLinkedin(kind)) await drenarUmaPublicacaoDoLinkedin(id);
        else await drainQueue();
      } catch {
        // A trava atômica garante que o próximo dreno recupera, como no compor.
      }
    } else {
      const atrasoDoTique = atrasoDoTiqueDaPublicacao(falta, HORIZONTE_DO_TIQUE_EM_SEGUNDOS);
      if (atrasoDoTique !== null) {
        try {
          await scheduleTick((await getConfig()).app_url ?? "", atrasoDoTique);
        } catch {
          // Calado de propósito: a hora nova está gravada, e é isso que a tela diz.
        }
      }
    }
  }

  revalidarAsDuasTelas();
  redirect(urlDeAgendadosComAviso(avisoDoDesfecho(desfecho, "remarcar")));
}
