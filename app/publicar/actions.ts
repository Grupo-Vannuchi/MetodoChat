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
import { exigirSessao } from "@/lib/exigir-sessao";
// O POST NO LINKEDIN (a parte 2a): a conexão só pelo resumo (o token fica no repositório, e só o dreno o lê), as
// regras puras do pedido e o enfileirar e o "agora" da fila do LinkedIn.
import { resumoDaConexao } from "@/lib/linkedin-conexoes";
import {
  avisoDoPostNoLinkedin,
  disponibilidadeDoLinkedin,
  formaNoLinkedinDoCampo,
  recusaDoPedidoNoLinkedin,
  textoDaRecusaNoLinkedin,
} from "@/lib/linkedin-publicacao";
import {
  aChaveDoLinkedinJaExiste,
  desfazerLinhaDoLinkedin,
  enqueuePublicacaoNoLinkedin,
  erroDaLinha,
  type ResultadoDoLinkedin,
} from "@/lib/linkedin-fila";
import { armarOTiqueDaLinha, drenarUmaPublicacaoDoLinkedin } from "@/lib/queue-drain";
// O POST DAS DUAS REDES (a parte 2b): as regras puras das duas, e a cópia da imagem para a linha do LinkedIn.
import { avisoDasDuasRedes, redeAceitaAForma, textoQueVaiAoLinkedin } from "@/lib/redes-do-post";
import { apagarACopiaSemDerrubar, copiarImagemParaOLinkedin } from "@/lib/linkedin-copia";
import type { ResultadoDaPublicacao } from "@/lib/engine";

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
  await exigirSessao();
  const inicioDaFuncaoMs = Date.now();
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

  const r = await enqueuePublicacao(
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

  if (!r.entrou) {
    // `enqueuePublicacao` DEVOLVE `entrou: false` QUANDO A `dedupe_key` JÁ
    // EXISTE, e isso não é falha: o post está na fila. Dizer "deu erro" faria
    // alguém subir o arquivo de novo e publicar duas vezes — no perfil público,
    // sem desfazer.
    redirect(
      urlDePublicarComAviso({ tom: "erro", texto: textoDaRecusaDaPublicacao("ja_enfileirado") })
    );
  }

  // ENFILEIRAR NÃO ENVIA, e esta linha é a mesma que faltava no lote até 02/09.
  // O que já vale não ganha tique (`atrasoDoTiqueDaPublicacao`, lib/publicacao.ts):
  // sem esta drenagem, o post sairia quando chegasse um webhook de fora, ou no
  // cron do dia seguinte.
  //
  // QUEM DIZ QUE JÁ VALE É O BANCO (`r.jaVale`), e não a palavra "agora". O
  // "depois" no minuto corrente passa pela tolerância de `momentoDaPublicacao`
  // e nasce vencido: até 15/10/2026 só o "agora" drenava, o `enqueue` não
  // armava tique abaixo de 15 s, e esse post ficava parado (achado 99).
  //
  // A DRENAGEM NÃO ESPERA A META. O ramo da publicação (Tarefa 4) cria o
  // contêiner, consulta o `status_code` UMA vez e devolve o item à fila com
  // `retryInSeconds: 60` se ainda estiver processando — um reels leva 32
  // segundos (medido), então a segunda passada é o caso normal. Quem clicou
  // espera pela ida, não pela publicação.
  //
  // O QUE AINDA NÃO VALE NÃO DRENA: o item tem `not_before` no futuro, a
  // drenagem não o pegaria, e o que ela faria era gastar o tempo de quem clicou
  // drenando os itens dos outros.
  if (r.jaVale) {
    try {
      // O DRENO DO CLIQUE (a 3a-0): com o começo da função, e sem o post do LinkedIn, que pode levar a passada inteira.
      await drainQueue({ inicioDaFuncaoMs, doClique: true });
    } catch {
      // A trava atômica garante que o próximo dreno recupera. O item fica
      // 'pending' e a tela de Atividade mostra isso — que aqui é verdade. É o
      // mesmo `catch` de `enviarLote`, pelo mesmo motivo.
    }
  }

  revalidatePath("/publicar/novo");
  revalidatePath("/publicar");
  revalidatePath("/eventos");

  // O SUCESSO NÃO DIZ "PUBLICADO". Enfileirar não é publicar: a Meta leva de 10
  // a 32 segundos (medido), o item sai pela fila e esta tela não espera. O que
  // aconteceu de verdade é "está na fila", e é isso que o aviso diz.
  //
  // A HORA ECOADA VEM DOS CAMPOS ESCOLHIDOS, e não do `Date`: este servidor
  // roda em UTC, e formatar o instante aqui mostraria três horas a mais do que
  // a pessoa digitou. O QUE JÁ VALE LEVA A FRASE DO "AGORA": ecoar a hora do
  // minuto corrente prometeria uma espera que não existe.
  redirect(urlDePublicarComAviso(avisoDaPublicacaoEnfileirada(r.jaVale ? null : campos)));
}

/**
 * ENFILEIRA UM POST NO LINKEDIN para a conta selecionada (docs/specs/2026-11-06-linkedin-no-perfil.md, §7; a
 * parte 2a: só texto ou imagem, uma rede por post).
 *
 * AS MESMAS REGRAS DA ACTION DE CIMA: nenhuma saída muda (toda saída é `redirect` com aviso de função pura); a
 * conta vem da regra das contas (`getSelectedAccount`, lib/account.ts), e nunca do formulário; e os caminhos
 * passam por `caminhosDoCampo` com a pasta dessa conta, que descarta o que for de outra pasta.
 *
 * E MAIS TRÊS:
 *   - a conexão é conferida de novo aqui, pela mesma `disponibilidadeDoLinkedin` da tela: a tela pode ter sido
 *     aberta antes de a autorização vencer;
 *   - o pedido passa pela mesma `recusaDoPedidoNoLinkedin` da tela, que conta o texto pela mesma função do
 *     contador (achado 212);
 *   - o "agora" publica SÓ a própria linha (`drenarUmaPublicacaoDoLinkedin`, achado 211), com o prazo contado do
 *     começo desta função (a segunda linha: a primeira de toda action é a sessão, tests/sessao-nas-actions.test.ts),
 *     e o aviso diz o desfecho. Sem o drenar, o preview, que não tem QStash, nunca publicaria (nota 198).
 */
export async function publicarNoLinkedin(formData: FormData): Promise<void> {
  await exigirSessao();
  const inicioDaFuncaoMs = Date.now();
  const conta = await getSelectedAccount();
  if (!conta) {
    redirect(urlDePublicarComAviso({ tom: "erro", texto: textoDaRecusaDaPublicacao("sem_conta") }));
  }

  const disponivel = disponibilidadeDoLinkedin(await resumoDaConexao(conta.ig_user_id), Date.now());
  if (!disponivel.disponivel) {
    redirect(urlDePublicarComAviso({ tom: "erro", texto: disponivel.motivo }));
  }

  const forma = formaNoLinkedinDoCampo(formData.get("forma_linkedin"));
  const caminhos = caminhosDoCampo(formData.get("caminhos"), pastaDaConta(conta.ig_user_id));
  const texto = String(formData.get("texto") ?? "").trim();
  const idDoEnvio = String(formData.get("id_do_envio") ?? "");
  const recusa = recusaDoPedidoNoLinkedin({ forma, caminhos, texto, idDoEnvio });
  if (recusa || !forma) {
    redirect(urlDePublicarComAviso({ tom: "erro", texto: textoDaRecusaNoLinkedin(recusa ?? "forma_desconhecida") }));
  }

  // A HORA, pelos mesmos três passos da action de cima.
  const campos = camposDaDataHora(formData.get("data_hora"));
  const fuso = fusoDoCampo(formData.get("fuso"));
  const momento = momentoDaPublicacao(
    formData.get("quando"),
    campos ? instanteDoAgendamento(campos, fuso) : null,
    Date.now()
  );
  if (!momento.ok) {
    redirect(urlDePublicarComAviso({ tom: "erro", texto: textoDaRecusaDaPublicacao(momento.motivo) }));
  }

  const r = await enqueuePublicacaoNoLinkedin(conta.ig_user_id, { forma, caminhos, texto, idDoEnvio }, momento.quando);
  if (!r.entrou) {
    // O MESMO ENVIO DE NOVO (a chave já existe): o post já está na fila, ou já saiu. Dizer "deu erro" faria alguém
    // mandar de novo, com outro envio, e publicar duas vezes.
    redirect(urlDePublicarComAviso({ tom: "erro", texto: textoDaRecusaDaPublicacao("ja_enfileirado") }));
  }

  // O "AGORA": o que já vale publica na mesma ida, só esta linha. O erro daqui não derruba o que entrou: a linha
  // está na fila, e o aviso diz "vai sair em instantes".
  let desfecho: "publicado" | "aguardando" | "falhou" | null = null;
  let motivo: string | null = null;
  if (r.jaVale) {
    try {
      desfecho = await drenarUmaPublicacaoDoLinkedin(r.id, inicioDaFuncaoMs);
      if (desfecho === "falhou") motivo = await erroDaLinha(r.id);
    } catch {
      // O "AGORA" LANÇOU, talvez antes de pegar a linha (o banco engasgou no `update`), e aí ela ficou `pending`
      // sem tique: o enfileirar não arma tique para o que já vale. Este tique é o que faz o "vai sair em instantes"
      // ser verdade (nota da auditoria sobre a F4). Calado, como os outros.
      desfecho = null;
      await armarOTiqueDaLinha(r.id);
    }
  }

  revalidatePath("/publicar/novo");
  revalidatePath("/publicar");
  revalidatePath("/eventos");
  redirect(urlDePublicarComAviso(avisoDoPostNoLinkedin({ desfecho, motivo, agendadoPara: r.jaVale ? null : campos })));
}

/**
 * O POST DE IMAGEM NAS DUAS REDES, Instagram e LinkedIn, para a conta selecionada (docs/specs/2026-11-06-linkedin-
 * no-perfil.md, §6 e §7; a parte 2b). Uma linha por rede, cada uma com a sua chave, o seu andamento e as suas
 * tentativas: se uma rede falhar ao publicar, a outra segue.
 *
 * AS MESMAS REGRAS DAS DUAS ACTIONS DE CIMA: a sessão primeiro; nenhuma saída muda; a conta da regra das contas, e
 * nunca do formulário; os caminhos pela pasta dessa conta; a conexão e o pedido do LinkedIn conferidos de novo
 * aqui, pelas mesmas funções da tela.
 *
 * A ORDEM, QUANDO UMA PARTE FALHA NO MEIO (achado 192, com o ajuste da auditoria de 10/11):
 *   1. todas as conferências, sem gravar nada;
 *   2. a chave do LinkedIn já está na fila? Então ele "já existia", e não há cópia (depois de um "agora", o dreno do
 *      Instagram já apagou o original, e copiar falharia);
 *   3. a cópia da imagem para a linha do LinkedIn (lib/linkedin-copia.ts). Se falha, nada é gravado;
 *   4. a linha do LinkedIn, com a cópia, e a chave pelo caminho ORIGINAL. Se ela não entra (o banco recusou, ou a
 *      chave apareceu entre a conferência e o insert), a cópia sai, e nada é gravado;
 *   5. a linha do Instagram, pelo `enqueuePublicacao` de hoje, sem mudança. Se ele LANÇA, a do LinkedIn é desfeita
 *      só se ainda estiver pendente (achado 199), e só então a cópia sai; um dreno que já a pegou segue com ela.
 *      A chave do Instagram que já existia não é falha: a tela diz que ele já estava na fila.
 *
 * O "AGORA" (a escolha (a) da auditoria): primeiro o LinkedIn, só a própria linha (`drenarUmaPublicacaoDoLinkedin`,
 * achado 211), que só começa o passo que tem tempo de terminar; depois o dreno de hoje para o Instagram, com o
 * mesmo começo da função, para outra linha do LinkedIn que ele pegue respeitar o prazo. O dreno não muda nesta
 * entrega.
 */
export async function publicarNasDuasRedes(formData: FormData): Promise<void> {
  await exigirSessao();
  const inicioDaFuncaoMs = Date.now();
  const conta = await getSelectedAccount();
  if (!conta) {
    redirect(urlDePublicarComAviso({ tom: "erro", texto: textoDaRecusaDaPublicacao("sem_conta") }));
  }

  // 1. AS CONFERÊNCIAS, sem gravar nada.
  const disponivel = disponibilidadeDoLinkedin(await resumoDaConexao(conta.ig_user_id), Date.now());
  if (!disponivel.disponivel) {
    redirect(urlDePublicarComAviso({ tom: "erro", texto: disponivel.motivo }));
  }

  // NESTA ENTREGA, AS DUAS REDES JUNTAS SÓ NA IMAGEM: o carrossel e o vídeo chegam ao LinkedIn na parte 3, e o story
  // não existe lá. O motivo é o mesmo que a tela mostra na caixinha desligada.
  const forma = formaQueATelaPublica(formData.get("forma"));
  if (forma !== "imagem") {
    redirect(
      urlDePublicarComAviso({
        tom: "erro",
        texto: (forma && redeAceitaAForma("linkedin", forma)) || textoDaRecusaDaPublicacao("forma_desconhecida"),
      })
    );
  }

  const caminhos = caminhosDoCampo(formData.get("caminhos"), pastaDaConta(conta.ig_user_id));
  const quantidade = recusaDaQuantidade(forma, caminhos.length);
  if (quantidade) {
    redirect(urlDePublicarComAviso({ tom: "erro", texto: textoDaRecusaDaPublicacao(quantidade) }));
  }

  const legenda = String(formData.get("legenda") ?? "").trim();
  const problema = problemaDaLegenda(legenda);
  if (problema) {
    redirect(urlDePublicarComAviso({ tom: "erro", texto: textoDoProblemaDaLegenda(problema) }));
  }

  // O TEXTO DO LINKEDIN: o próprio, quando há; sem ele, a legenda. Contado pela mesma função do contador (212).
  const texto = textoQueVaiAoLinkedin({ legenda, textoProprio: String(formData.get("texto_linkedin") ?? "") });
  const idDoEnvio = String(formData.get("id_do_envio") ?? "");
  const recusa = recusaDoPedidoNoLinkedin({ forma, caminhos, texto, idDoEnvio });
  if (recusa) {
    redirect(urlDePublicarComAviso({ tom: "erro", texto: textoDaRecusaNoLinkedin(recusa) }));
  }

  const campos = camposDaDataHora(formData.get("data_hora"));
  const fuso = fusoDoCampo(formData.get("fuso"));
  const momento = momentoDaPublicacao(
    formData.get("quando"),
    campos ? instanteDoAgendamento(campos, fuso) : null,
    Date.now()
  );
  if (!momento.ok) {
    redirect(urlDePublicarComAviso({ tom: "erro", texto: textoDaRecusaDaPublicacao(momento.motivo) }));
  }

  // 2 A 4. O LINKEDIN: a chave, a cópia e a linha.
  const pedidoDoLinkedin = { forma, caminhos, texto, idDoEnvio };
  let linkedin: ResultadoDoLinkedin = { entrou: false };
  let copia: string | null = null;
  if (!(await aChaveDoLinkedinJaExiste(conta.ig_user_id, pedidoDoLinkedin))) {
    let falhaDoLinkedin: string | null = null;
    try {
      copia = await copiarImagemParaOLinkedin(caminhos[0], conta.ig_user_id);
    } catch (e) {
      falhaDoLinkedin = e instanceof Error ? e.message : "a cópia da imagem falhou";
    }
    if (copia) {
      try {
        linkedin = await enqueuePublicacaoNoLinkedin(
          conta.ig_user_id,
          { ...pedidoDoLinkedin, caminhos: [copia] },
          momento.quando,
          { caminhosDaChave: caminhos }
        );
      } catch {
        falhaDoLinkedin = "a fila do LinkedIn não respondeu";
      }
      // A CÓPIA QUE NÃO VAI SER USADA SAI: o banco recusou a linha, ou a chave apareceu entre a conferência e o
      // insert (dois cliques juntos). No segundo caso, o LinkedIn "já existia", e o Instagram segue.
      if (!linkedin.entrou) {
        await apagarACopiaSemDerrubar(copia);
        copia = null;
      }
    }
    if (falhaDoLinkedin) {
      redirect(urlDePublicarComAviso(avisoDasDuasRedes({ tipo: "linkedin_nao_entrou", motivo: falhaDoLinkedin })));
    }
  }

  // 5. O INSTAGRAM, pelo enfileirar de hoje. Se ele lança, a compensação do 192 e do 199.
  let instagram: ResultadoDaPublicacao | null = null;
  try {
    instagram = await enqueuePublicacao(conta.ig_user_id, { forma, caminhos, legenda: legenda || undefined }, momento.quando);
  } catch {
    instagram = null;
  }
  if (!instagram) {
    let lado: "desfeito" | "seguiu" | "ja_existia" = "ja_existia";
    if (linkedin.entrou) {
      let desfeita = false;
      try {
        desfeita = await desfazerLinhaDoLinkedin(linkedin.id);
      } catch {
        // Sem a resposta do banco, a linha continua como estava: pendente, ela sai sozinha. A cópia fica.
      }
      lado = desfeita ? "desfeito" : "seguiu";
      if (desfeita && copia) await apagarACopiaSemDerrubar(copia);
    }
    redirect(urlDePublicarComAviso(avisoDasDuasRedes({ tipo: "instagram_nao_entrou", linkedin: lado })));
  }

  // 6. O "AGORA": o LinkedIn primeiro, só a própria linha; depois o dreno de hoje, para o Instagram.
  let desfecho: "publicado" | "aguardando" | "falhou" | null = null;
  let motivo: string | null = null;
  if (linkedin.entrou && linkedin.jaVale) {
    try {
      desfecho = await drenarUmaPublicacaoDoLinkedin(linkedin.id, inicioDaFuncaoMs);
      if (desfecho === "falhou") motivo = await erroDaLinha(linkedin.id);
    } catch {
      // O mesmo `catch` do `publicarNoLinkedin`: a linha pode ter ficado pendente sem tique, e este tique é o que
      // faz o "vai sair em instantes" ser verdade.
      desfecho = null;
      await armarOTiqueDaLinha(linkedin.id);
    }
  }
  if (instagram.entrou && instagram.jaVale) {
    try {
      await drainQueue({ inicioDaFuncaoMs, doClique: true });
    } catch {
      // O mesmo `catch` do `publicar`: a trava atômica garante que o próximo dreno recupera.
    }
  }

  revalidatePath("/publicar/novo");
  revalidatePath("/publicar");
  revalidatePath("/eventos");
  redirect(
    urlDePublicarComAviso(
      avisoDasDuasRedes({
        tipo: "entrou",
        campos,
        instagram: instagram.entrou ? { entrou: true, jaVale: instagram.jaVale } : { entrou: false },
        linkedin: linkedin.entrou ? { entrou: true, jaVale: linkedin.jaVale, desfecho, motivo } : { entrou: false },
      })
    )
  );
}
