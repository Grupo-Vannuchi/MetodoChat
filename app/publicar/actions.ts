"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSelectedAccount } from "@/lib/account";
import { pastaDaConta } from "@/lib/bucket";
import { enqueuePublicacao } from "@/lib/engine";
import { drainQueue } from "@/lib/queue-drain";
import {
  formaQueATelaPublica,
  camposDaDataHora,
  fusoDoCampo,
  instanteDoAgendamento,
  momentoDaPublicacao,
  caminhosDoCampo,
  recusaDaQuantidade,
  problemaDaLegenda,
  textoDoProblemaDaLegenda,
  textoDaRecusaDaPublicacao,
} from "@/lib/publicacao";
import { urlDePublicarComAviso, avisoDaPublicacaoEnfileirada } from "@/lib/avisos";

/**
 * Enfileira uma publicação para a conta selecionada.
 *
 * =============================================================================
 * NENHUMA SAÍDA MUDA. É a regra que o conserto de 02/09 fechou em cinco ações
 * desta base, e este arquivo nasce depois dele.
 *
 * Uma ação de servidor que recusa em silêncio é INDISTINGUÍVEL de uma que deu
 * certo: a tela recarrega igual nos dois casos. Aqui cada saída — toda recusa e
 * o sucesso — sai por `redirect` com aviso, e o TEXTO e o TOM de cada
 * uma vêm de função pura (`textoDaRecusaDaPublicacao`,
 * `textoDoProblemaDaLegenda`, `avisoDaPublicacaoEnfileirada`), nunca de string
 * escrita aqui. `urlDePublicarComAviso` carrega o par inteiro, porque `aviso`
 * sem `tom` chega na tela pintado de falha.
 *
 * =============================================================================
 * E ELA NÃO DECIDE NADA POR CONTA PRÓPRIA
 *
 * Cada `if` abaixo é a leitura de uma função pura com caso de teste. É a lição
 * medida em `enviarLote` (app/contatos/actions.ts): as três perguntas que
 * moravam soltas no corpo daquela ação eram invisíveis para os portões —
 * apagar cada uma passava por lint, typecheck e a suíte inteira, e uma delas
 * mandava a ficha "sem categoria" para a conta INTEIRA.
 *
 * =============================================================================
 * O ARQUIVO NÃO PASSA POR AQUI, E O CAMINHO DELE É DO USUÁRIO
 *
 * O que chega é o CAMINHO de um objeto que o navegador já subiu ao bucket. Esse
 * campo é um `<input type="hidden">`, ou seja: quem trocar o valor à mão escolhe
 * qualquer objeto do bucket para publicar, inclusive o de outra conta. Por isso
 * `caminhosDoCampo` recebe a pasta da conta do COOKIE de seleção — nunca a que
 * veio do formulário — e descarta o que estiver fora dela. É o mesmo cuidado do
 * `account_id` de `definirCategoria` e de `alvoDoLote`, aqui pela porta do
 * arquivo.
 */
export async function publicar(formData: FormData): Promise<void> {
  const conta = await getSelectedAccount();
  if (!conta) {
    redirect(
      urlDePublicarComAviso({ tom: "erro", texto: textoDaRecusaDaPublicacao("sem_conta") })
    );
  }

  const forma = formaQueATelaPublica(formData.get("forma"));
  if (!forma) {
    // O QUE NÃO É UMA DAS QUATRO FORMAS NÃO VIRA ITEM DE FILA. O `<select>` é
    // do usuário e manda o que quiser; deixar passar gravaria um item que nasce
    // morto DEPOIS de o arquivo ter subido e ocupado o bucket.
    redirect(
      urlDePublicarComAviso({
        tom: "erro",
        texto: textoDaRecusaDaPublicacao("forma_desconhecida"),
      })
    );
  }

  const caminhos = caminhosDoCampo(formData.get("caminhos"), pastaDaConta(conta.ig_user_id));
  // A QUANTIDADE É PERGUNTA DA FORMA, e não um `if (!caminhos.length)`: um
  // carrossel de um item não é carrossel, onze passam do teto da Meta, e dois
  // arquivos numa forma de um só publicariam o primeiro e descartariam o
  // segundo em silêncio — depois de ele ter subido. Ver `recusaDaQuantidade`.
  const quantidade = recusaDaQuantidade(forma, caminhos.length);
  if (quantidade) {
    redirect(
      urlDePublicarComAviso({ tom: "erro", texto: textoDaRecusaDaPublicacao(quantidade) })
    );
  }

  const legenda = String(formData.get("legenda") ?? "").trim();
  const problema = problemaDaLegenda(legenda);
  if (problema) {
    // A MESMA FRASE QUE A TELA JÁ MOSTRAVA enquanto se digitava. Uma segunda
    // redação faria quem lê achar que apareceu um problema novo no caminho.
    redirect(urlDePublicarComAviso({ tom: "erro", texto: textoDoProblemaDaLegenda(problema) }));
  }

  // A HORA É LIDA EM TRÊS PASSOS, e os três são funções puras: os campos (que
  // recusam 30 de fevereiro em vez de deixar `Date.UTC` transbordar), o
  // instante (que aplica o fuso do navegador, porque `datetime-local` não tem
  // fuso) e o momento (que recusa o passado e o campo ilegível).
  const campos = camposDaDataHora(formData.get("data_hora"));
  const fuso = fusoDoCampo(formData.get("fuso"));
  const momento = momentoDaPublicacao(
    formData.get("quando"),
    campos ? instanteDoAgendamento(campos, fuso) : null,
    Date.now()
  );
  if (!momento.ok) {
    redirect(
      urlDePublicarComAviso({ tom: "erro", texto: textoDaRecusaDaPublicacao(momento.motivo) })
    );
  }

  const entrou = await enqueuePublicacao(
    conta.ig_user_id,
    {
      forma,
      caminhos,
      legenda: legenda || undefined,
      compartilharNoFeed: formData.get("compartilhar_no_feed") === "1",
      nomeDoAudio: String(formData.get("nome_do_audio") ?? "").trim() || undefined,
    },
    momento.quando
  );

  if (!entrou) {
    // `enqueue` DEVOLVE `false` QUANDO A `dedupe_key` JÁ EXISTE, e isso não é
    // falha: o post está na fila. Dizer "deu erro" faria alguém subir o arquivo
    // de novo e publicar duas vezes — no perfil público, sem desfazer.
    redirect(
      urlDePublicarComAviso({ tom: "erro", texto: textoDaRecusaDaPublicacao("ja_enfileirado") })
    );
  }

  // ENFILEIRAR NÃO ENVIA, e esta linha é a mesma que faltava no lote até 02/09.
  // `enqueue` (lib/engine.ts:321) só pede um tique ao QStash quando o atraso
  // passa de 15 segundos — e "agora" nasce com atraso ZERO, ou seja não agenda
  // nada. Sem esta drenagem, o post sairia quando chegasse um webhook de fora,
  // ou às 09:00 do dia seguinte.
  //
  // A DRENAGEM NÃO ESPERA A META. O ramo da publicação (Tarefa 4) cria o
  // contêiner, consulta o `status_code` UMA vez e devolve o item à fila com
  // `retryInSeconds: 60` se ainda estiver processando — um reels leva 32
  // segundos (medido), então a segunda passada é o caso normal. Quem clicou
  // espera pela ida, não pela publicação.
  //
  // O AGENDADO NÃO DRENA: o item tem `not_before` no futuro, a drenagem não o
  // pegaria, e o que ela faria era gastar o tempo de quem clicou drenando os
  // itens dos outros.
  if (momento.quando === null) {
    try {
      await drainQueue();
    } catch {
      // A trava atômica garante que o próximo dreno recupera. O item fica
      // 'pending' e a tela de Atividade mostra isso — que aqui é verdade. É o
      // mesmo `catch` de `enviarLote`, pelo mesmo motivo.
    }
  }

  revalidatePath("/publicar");
  revalidatePath("/eventos");

  // O SUCESSO NÃO DIZ "PUBLICADO". Enfileirar não é publicar: a Meta leva de 10
  // a 32 segundos (medido), o item sai pela fila e esta tela não espera. O que
  // aconteceu de verdade é "está na fila", e é isso que o aviso diz.
  //
  // A HORA ECOADA VEM DOS CAMPOS ESCOLHIDOS, e não do `Date`: este servidor
  // roda em UTC, e formatar o instante aqui mostraria três horas a mais do que
  // a pessoa digitou.
  redirect(urlDePublicarComAviso(avisoDaPublicacaoEnfileirada(momento.quando ? campos : null)));
}
