import { urlComFiltro, type FiltroDeCategoria } from "./categorias";
import { textoDoDesfecho, type DesfechoDaMudanca } from "./publicacao";

// AS FRASES E AS DECISOES DE AVISO, fora do JSX.
//
// Uma acao de servidor que recusa ou conclui em silencio e indistinguivel de
// sucesso: a tela recarrega igual. Este arquivo e a fonte unica do TEXTO e do
// TOM de cada aviso, e da URL que os carrega pelo redirect ate a tela. As
// telas (Tarefas 2 e 3) so leem o que sai daqui — nenhuma decisao mora no JSX,
// porque a suite nao testa componente.

export type TomDoAviso = "ok" | "erro";
export type Aviso = { tom: TomDoAviso; texto: string };

/**
 * Por que o lote saiu vazio — as cinco saidas mudas de `enviarLote` viram
 * quatro motivos aqui (a de sucesso nao e recusa, e sai por outra funcao).
 *
 * "sem_conta" e "sem_texto" e "url_invalida" nao moram nesta funcao: elas sao
 * decididas antes de chegar em `alvoDoLote`, direto no corpo da acao (Tarefa
 * 2), porque so ali se sabe se ha conta, se ha texto e se a URL do botao e
 * valida. Esta funcao resolve o caso que `alvoDoLote` deixa ambiguo: alvo
 * vazio pode ser "ninguem confirmou" ou "ninguem no filtro", e as duas
 * checagens (`confirmado`, `filtroEntendido`) sao o que ela ja distingue
 * internamente — o aviso so precisa repetir a distincao para quem chamou.
 */
export type RecusaDoLote =
  | "sem_conta" | "sem_texto" | "url_invalida"
  | "sem_confirmacao" | "filtro_ilegivel" | "conta_sem_contatos" | "ninguem_no_filtro";

/**
 * O motivo do lote vazio, quando `alvo.length === 0`.
 *
 * A ORDEM DOS DOIS PRIMEIROS RAMOS IMPORTA, e nao e estetica: sem confirmacao
 * E sem ninguem no filtro podem ser verdade ao mesmo tempo (o dono nao marcou
 * a caixa E filtrou por uma categoria vazia), e so uma frase pode aparecer.
 * "Marque a confirmacao" e a frase que diz o que FAZER; "ninguem nesta
 * categoria" descreve um filtro que, sem a confirmacao, nem chegou a ser
 * avaliado de verdade — por isso sem_confirmacao vem primeiro.
 *
 * OS TRES VAZIOS SEGUINTES SAO TRES CONSELHOS DIFERENTES, e por isso os tres
 * parametros existem. A primeira versao desta funcao devolvia
 * "ninguem_no_filtro" para todos, e o proprio nome do caso de teste ("filtro
 * que nao foi entendido nao e confundido com filtro vazio") ja denunciava a
 * contradicao — ele afirmava a distincao e media a ausencia dela.
 *
 * - `filtroEntendido === false`: `filtroDoCampo` (lib/lote.ts) devolveu `null`,
 *   ou seja o campo do formulario nao era um recorte reconhecivel. Isso NAO e
 *   "a categoria esta vazia": e um pedido quebrado, e o que resolve e recarregar
 *   a pagina — nunca escolher outra categoria.
 * - `quantosNaConta === 0`: a conta nao tem contato nenhum. Mandar o dono
 *   procurar outra categoria seria conselho inutil; nao ha nenhuma.
 * - o resto: ha gente na conta, mas ninguem neste recorte. Aqui, sim, trocar o
 *   filtro e a saida.
 */
export function motivoDoLoteVazio(
  confirmado: boolean,
  filtroEntendido: boolean,
  quantosNaConta: number
): RecusaDoLote {
  if (!confirmado) return "sem_confirmacao";
  if (!filtroEntendido) return "filtro_ilegivel";
  if (quantosNaConta === 0) return "conta_sem_contatos";
  return "ninguem_no_filtro";
}

/** A frase de cada recusa — spec §3, nomeando o que fazer, nunca "falhou". */
export function textoDaRecusaDoLote(motivo: RecusaDoLote): string {
  switch (motivo) {
    case "sem_conta":
      return "Conecte uma conta do Instagram primeiro.";
    case "sem_texto":
      return "Escreva a mensagem antes de mandar.";
    case "url_invalida":
      return "O endereço do botão não é uma URL válida — confira e mande de novo.";
    case "ninguem_no_filtro":
      return "Ninguém nesta categoria; nada foi enfileirado.";
    case "conta_sem_contatos":
      return "Esta conta ainda não tem contatos — ninguém foi enfileirado.";
    case "filtro_ilegivel":
      return "Não entendi o recorte — recarregue a página e tente de novo.";
    case "sem_confirmacao":
      return "Marque a confirmação antes de mandar.";
  }
}

/**
 * O aviso de sucesso do lote: quantos receberam AGORA e quantos ficaram
 * GUARDADOS para quando a janela abrir de novo.
 *
 * `agora` e `guardadas` vem de uma consulta pelos itens do PROPRIO lote — a
 * Tarefa 2 e quem garante isso, contando pelo identificador que `enqueueLote`
 * gera. Esta funcao so formata o que ja foi contado direito; ela nao pode
 * consertar uma contagem errada.
 */
export function textoDoLoteEnviado(agora: number, guardadas: number): string {
  const partes: string[] = [];
  // "0 pessoas" e "0 receberam" nao aparecem: quando ninguem recebeu agora, a
  // frase nao afirma um recebimento que nao aconteceu.
  if (agora > 0) {
    partes.push(`${agora} ${agora === 1 ? "pessoa recebeu" : "pessoas receberam"} agora`);
  } else {
    partes.push("ninguém recebeu agora");
  }
  partes.push(
    `${guardadas} ${guardadas === 1 ? "guardada" : "guardadas"} para quando voltarem a falar`
  );
  return partes.join(" · ");
}

/**
 * O aviso do lote inteiro — texto E tom —, resolvendo a ambiguidade que
 * `textoDoLoteEnviado(0, 0)` sozinha não sabe resolver.
 *
 * `enviarLote` (app/contatos/actions.ts) tem `try { await drainQueue(); }
 * catch {}`. Quando o dreno LANÇA — que é o motivo de o `catch` existir —,
 * nenhum item deste lote chega a virar `sent` nem `guardado`: os dois ficam
 * ZERO, e os itens ficam `pending` (nem enviados, nem guardados — só ainda não
 * tentados). `textoDoLoteEnviado(0, 0)` devolve "ninguém recebeu agora · 0
 * guardadas", e a ação mandava isso com tom "ok" — faixa VERDE logo depois de
 * um envio de verdade. É MENTIRA TRANQUILIZADORA: as mensagens ENTRARAM na
 * fila e vão sair (a trava atômica garante que o próximo dreno recupera), não
 * sumiram — mas isto não é um envio CONCLUÍDO, e fingir que é apaga a
 * diferença entre "terminou" e "está a caminho".
 *
 * A TERCEIRA CONTAGEM DESFAZ A AMBIGUIDADE. `agora === 0 && guardadas === 0`
 * sozinho não distingue "o dreno não deu tempo" de "ninguém confirmou" — mas
 * este segundo caso é IMPOSSÍVEL aqui: `alvoDoLote` (lib/lote.ts) já recusou
 * lote vazio antes de `enviarLote` chegar a montar esta contagem, então
 * `pendentes > 0` é o sinal de que existe gente no lote que nem `sent` nem
 * `guardado` ficou — a mesma pergunta que `motivoDoLoteVazio` resolve para o
 * vazio, resolvida aqui para o cheio que não terminou.
 *
 * NÃO DISPARA COM LOTE GRANDE NORMAL. Uma drenagem processa no máximo
 * `BATCH_SIZE` itens (comentário de `enviarLote`); um lote de 20 confirmados
 * deixa 5 `pending` de propósito, e os 15 já viraram `sent` ou `guardado` —
 * `agora` ou `guardadas` (ou os dois) já são maiores que zero, então o ramo de
 * baixo (o normal) é quem responde, com a MESMA frase de sempre.
 *
 * O TOM NÃO PODE SER "ok" NO RAMO DE CIMA, e como `TomDoAviso` só tem "ok" e
 * "erro" — e `avisoDaUrl` já colapsa qualquer tom que não seja exatamente "ok"
 * em "erro" —, a escolha possível é "erro". Não é a palavra perfeita (nada
 * FALHOU do ponto de vista de quem clicou; o pedido foi aceito), mas é a única
 * que a faixa vermelha já sabe desenhar sem tocar `app/contatos/page.tsx` — e
 * a frase deste ramo é escrita para não soar como um erro do dono, e sim como
 * "ainda não, mas já está a caminho".
 *
 * -----------------------------------------------------------------------------
 * A SEGUNDA PORTA DA MESMA DOENÇA, fechada em 02/09/2026.
 *
 * O texto acima descreve a MENTIRA TRANQUILIZADORA e fecha UMA das duas portas
 * dela (`pendentes > 0`). A outra ficou aberta por um ano de comentário: a
 * consulta perguntava por TRÊS status — `sent`, `guardado`, `pending` — e o
 * dreno grava CINCO para `dm_lote`. Os dois que faltavam são justamente os
 * desfechos ruins:
 *
 *   `skipped` — "o lote venceu antes de sair" e "janela de 24h fechada"
 *   `failed`  — a Meta recusou de vez (IgError 4xx, token vencido)
 *
 * E o caminho até lá era um CLIQUE ERRADO, não um caso de laboratório: o campo
 * de data não tinha `min`, o dono escolhia um dia no passado, `loteExpirou`
 * dava verdadeiro na primeira drenagem e os até 15 itens do primeiro punhado
 * viravam `skipped` ANTES de `processItem`. Os três contadores zeravam,
 * `pendentes > 0` não disparava, e a faixa saía VERDE dizendo "ninguém recebeu
 * agora · 0 guardadas". Nada saiu, nada ia sair, e o painel não dizia palavra.
 *
 * POR QUE A ASSINATURA VIROU UM OBJETO COM `total`, e isto é o coração do
 * conserto: os quatro baldes são listas de status ESCRITAS À MÃO, e a lição do
 * defeito é que uma lista dessas envelhece calada. `total` é `count(*)` sem
 * filtro nenhum — então um SEXTO status (ou um sétimo, amanhã) não some: ele
 * faz a soma dos baldes ficar MENOR que o total, e o ramo do meio ACUSA isso
 * em vez de pintar de verde o que não sabe ler. É a diferença entre um aviso
 * que erra e um aviso que mente.
 */
export type ContagemDoLote = {
  /** `status = 'sent'`: saiu agora. */
  agora: number;
  /** `status = 'guardado'`: espera a pessoa voltar a falar. */
  guardadas: number;
  /** `status in ('pending','sending')`: ainda a caminho, sai sozinha. */
  pendentes: number;
  /** `status in ('failed','skipped')`: NÃO saiu e NÃO vai sair. */
  paradas: number;
  /** `count(*)` sem filtro: quantos itens deste lote existem na fila. */
  total: number;
};

export function avisoDoLoteEnviado(c: ContagemDoLote): Aviso {
  // NENHUM ITEM ENCONTRADO não é "envio vazio": `alvoDoLote` (lib/lote.ts) já
  // recusou o lote sem gente muito antes daqui, e `enqueueLote` acabou de
  // gravar. Zero itens é a CONSULTA não achando o lote — a chave do payload
  // errada, o `kind` errado, a conta errada —, e nesse caso o aviso não tem
  // como afirmar coisa nenhuma sobre o envio.
  if (c.total === 0) {
    return {
      tom: "erro",
      texto:
        "O pedido foi aceito, mas não achei nenhuma mensagem deste envio na fila — " +
        "não dá para confirmar que saiu. Confira a tela de Envios antes de mandar de novo.",
    };
  }

  // A SOMA TEM DE FECHAR. Ver o comentário acima: é este ramo que impede um
  // status novo de sumir dentro do "ok".
  const somados = c.agora + c.guardadas + c.pendentes + c.paradas;
  if (somados !== c.total) {
    return {
      tom: "erro",
      texto:
        `${c.total - somados} de ${c.total} mensagens deste envio estão num estado que ` +
        "este aviso não sabe ler — confira a tela de Envios.",
    };
  }

  // O QUE NÃO SAIU VENCE O QUE SAIU, e por isso este ramo vem antes do normal:
  // um envio em que metade morreu por prazo vencido ou token revogado não é um
  // envio concluído, mesmo com a outra metade entregue. A frase diz os dois
  // números quando há os dois, e manda ver o motivo de cada uma em Envios —
  // que é onde `queue.error` já está escrito, item por item.
  if (c.paradas > 0) {
    const partes: string[] = [];
    if (c.agora > 0 || c.guardadas > 0) partes.push(textoDoLoteEnviado(c.agora, c.guardadas));
    partes.push(
      `${c.paradas} ${c.paradas === 1 ? "não saiu e não vai" : "não saíram e não vão"} sair ` +
        "— prazo vencido, ou o Instagram recusou. O motivo de cada uma está em Envios."
    );
    return { tom: "erro", texto: partes.join(" · ") };
  }

  if (c.agora === 0 && c.guardadas === 0 && c.pendentes > 0) {
    return {
      tom: "erro",
      texto:
        `${c.pendentes} ${c.pendentes === 1 ? "mensagem entrou" : "mensagens entraram"} na fila, ` +
        "mas o envio não terminou a tempo de confirmar — elas saem sozinhas em instantes.",
    };
  }
  return { tom: "ok", texto: textoDoLoteEnviado(c.agora, c.guardadas) };
}

/**
 * A URL de volta, com o aviso pendurado nela.
 *
 * TEM de ser construida sobre `urlComFiltro` (`lib/categorias.ts`), nunca
 * remontando `?categoria=` por conta propria: a distincao entre `?categoria=`
 * AUSENTE ("tudo") e PRESENTE-E-VAZIO ("sem categoria") foi o Critico de
 * 01/09, e recair nele por uma porta nova — concatenando string a mao aqui —
 * e exatamente o que este desenho existe para impedir.
 *
 * A escolha entre "?" e "&" nao e um `if (filtro.tipo === "tudo")` duplicado:
 * ela olha se `urlComFiltro` ja devolveu um "?" (filtro "uma" sempre devolve;
 * filtro "tudo" nunca devolve). Duplicar a checagem do tipo seria confiar
 * duas vezes na mesma decisao por caminhos diferentes — e um dia divergirem.
 */
export function urlComAviso(base: string, filtro: FiltroDeCategoria, aviso: string): string {
  const comFiltro = urlComFiltro(base, filtro);
  const separador = comFiltro.includes("?") ? "&" : "?";
  return `${comFiltro}${separador}aviso=${encodeURIComponent(aviso)}`;
}

/**
 * O aviso vindo dos `searchParams` do redirect, ja tipado.
 *
 * `bruto` e `tomBruto` sao texto de URL — DIGITAVEL por qualquer um — e por
 * isso um tom desconhecido cai em "erro" em vez de virar classe de CSS
 * montada com o que veio de fora. `null` (nao "ok" por omissao) e o caso de
 * nenhum aviso: a tela so mostra a faixa quando ha aviso de fato.
 */
export function avisoDaUrl(bruto: string | undefined, tomBruto: string | undefined): Aviso | null {
  if (bruto === undefined) return null;
  const tom: TomDoAviso = tomBruto === "ok" ? "ok" : "erro";
  return { tom, texto: bruto };
}

/**
 * A URL de volta com o aviso INTEIRO — texto e tom.
 *
 * `urlComAviso` carrega so o texto, e `avisoDaUrl` le DOIS parametros: sem o
 * `tom` na URL, todo aviso volta como "erro" (a omissao cai em vermelho de
 * proposito, porque o parametro e digitavel e um tom desconhecido nao pode
 * virar classe de CSS). Um sucesso mandado so por `urlComAviso` chegaria na
 * tela pintado de falha — e por isso o par nao pode ser costurado a mao dentro
 * da acao, que e onde a costura ficaria sem teste.
 *
 * Construida SOBRE `urlComAviso`, que por sua vez e construida sobre
 * `urlComFiltro`: a distincao entre `?categoria=` ausente e presente-e-vazio
 * continua decidida num lugar so.
 */
export function urlDoAviso(base: string, filtro: FiltroDeCategoria, aviso: Aviso): string {
  // O separador aqui e sempre "&": `urlComAviso` acabou de escrever "aviso=",
  // entao a interrogacao ja existe. Nao ha ramo a escolher — e nao ha ramo a
  // errar.
  return `${urlComAviso(base, filtro, aviso.texto)}&tom=${aviso.tom}`;
}

/**
 * A URL de volta da tela de CONVERSA, com o aviso pendurado nela.
 *
 * NÃO É CONSTRUÍDA SOBRE `urlDoAviso`, e essa não-escolha é a decisão desta
 * função. `urlDoAviso` existe para `/contatos`, uma tela com FILTRO DE
 * CATEGORIA — e é por isso que ela pede um `FiltroDeCategoria` e o preserva
 * pelo redirect. `/conversas/[id]` não tem esse conceito: o "recorte" dela é
 * um id de conversa só, sempre presente, nunca ambíguo entre ausente e
 * presente-e-vazio — a armadilha que `urlComFiltro`/`urlComAviso` existem para
 * evitar simplesmente não existe aqui. Forçar `urlDoAviso` exigiria inventar
 * um `FiltroDeCategoria` que não representa nada desta tela, só para chegar
 * a uma URL que aquela função nunca foi desenhada para produzir
 * (`/conversas/[id]?...`, e não `/contatos?...`).
 *
 * `contactIgId` VAI CODIFICADO NO CAMINHO (`encodeURIComponent`), e não colado
 * cru — mesmo já validado por quem chama no caminho de sucesso. Na recusa
 * "sem conta" de `definirCategoria` ele AINDA NÃO FOI validado quando este
 * redirect é montado: a conferência de formato vem depois, e o valor chega
 * direto do FormData, que é o navegador de alguém — pode conter qualquer
 * coisa, inclusive `/` ou `?`. Sem codificar, esse texto quebraria o caminho da
 * URL (uma barra a mais insere um segmento de rota que não existe) em vez de
 * simplesmente cair no `notFound()` que a página já faz para um id que não
 * bate o formato.
 */
export function urlDaConversaComAviso(contactIgId: string, aviso: Aviso): string {
  return `/conversas/${encodeURIComponent(contactIgId)}?aviso=${encodeURIComponent(aviso.texto)}&tom=${aviso.tom}`;
}

/**
 * O aviso de sucesso ao salvar a categoria de um contato (`definirCategoria`,
 * app/conversas/[id]/actions.ts).
 *
 * A FRASE MUDA ENTRE GRAVAR E TIRAR, porque são dois pedidos diferentes na
 * cabeça de quem clicou: `normalizarCategoria` (lib/categorias.ts) devolve
 * `null` para campo em branco, e isso é o pedido LEGÍTIMO de "tirar a
 * categoria" — dizer "categoria salva" sobre um campo que ficou vazio seria
 * confuso, e a comemoração errada.
 */
export function avisoDaCategoriaSalva(categoria: string | null): Aviso {
  if (categoria === null) {
    return { tom: "ok", texto: "Categoria removida." };
  }
  return { tom: "ok", texto: `Categoria definida como "${categoria}".` };
}

/**
 * O aviso do botao "Buscar nomes" — quantos perfis a Meta devolveu.
 *
 * O TOM E DECISAO, E NAO ENFEITE. A acao roda ate 30 buscas na Meta e engole
 * cada falha individualmente (conta privada, apagada, ou quem so comentou num
 * post nunca da perfil). Terminar com ZERO e o desfecho mais comum quando algo
 * esta errado — token vencido, permissao revogada —, e pintar isso de verde
 * seria trocar o silencio por uma mentira mais bonita.
 *
 * `tentados === 0` e outra coisa: nao ha ninguem sem nome para buscar. A acao
 * terminou certo, e o numero zero nem aparece na frase.
 */
export function avisoDosPerfis(atualizados: number, tentados: number): Aviso {
  if (tentados === 0) {
    return { tom: "ok", texto: "Todo mundo já tem nome — nada a buscar." };
  }
  if (atualizados === 0) {
    return {
      tom: "erro",
      texto:
        `Nenhum dos ${tentados} perfis veio da Meta. ` +
        "Contas privadas ou apagadas não devolvem perfil; se for todo mundo, confira a conexão da conta.",
    };
  }
  return {
    tom: "ok",
    texto: `${atualizados} ${atualizados === 1 ? "perfil atualizado" : "perfis atualizados"}.`,
  };
}

/**
 * A URL de volta da tela de PUBLICAR, com o aviso pendurado nela.
 *
 * NAO E CONSTRUIDA SOBRE `urlDoAviso`, pelo mesmo motivo de
 * `urlDaConversaComAviso`: `urlDoAviso` existe para `/contatos`, uma tela com
 * FILTRO DE CATEGORIA, e por isso pede um `FiltroDeCategoria` e o preserva pelo
 * redirect. `/publicar` nao tem recorte nenhum — forcar aquela funcao exigiria
 * inventar um filtro que nao representa nada desta tela.
 *
 * O TOM VAI JUNTO DO TEXTO, e essa e a razao de a funcao existir em vez de a
 * acao costurar a string: `avisoDaUrl` le DOIS parametros, e um sucesso mandado
 * sem `tom` chega na tela pintado de falha.
 */
export function urlDePublicarComAviso(aviso: Aviso): string {
  return `/publicar?aviso=${encodeURIComponent(aviso.texto)}&tom=${aviso.tom}`;
}

/**
 * O aviso de sucesso da acao de publicar.
 *
 * A FRASE MUDA ENTRE AGORA E AGENDADO, e nao e enfeite: sao dois desfechos
 * diferentes, e confundi-los e caro nos dois sentidos. Quem agendou e le "vai
 * sair agora" corre para desfazer o que nao aconteceu; quem publicou agora e le
 * "agendado" fica esperando um post que ja esta no ar — e, medido em 03/09,
 * `DELETE /{ig-media-id}` NAO existe no nosso caminho, entao o post no ar so
 * sai a mao pelo celular.
 *
 * A HORA VEM DOS CAMPOS ESCOLHIDOS, e nao do `Date` do agendamento, e isso e
 * deliberado: o `Date` e um instante em UTC, e formata-lo no servidor da Vercel
 * — que roda em UTC — mostraria uma hora tres horas adiante da que a pessoa
 * digitou. Ecoar os campos devolve exatamente o que ela escreveu, sem conta
 * nenhuma no meio para errar.
 *
 * E ELE NAO PROMETE QUE O POST SAIU. Enfileirar nao e publicar: a Meta leva de
 * 10 a 32 segundos (medido), o item sai pela fila e a tela nao espera. "Na
 * fila" e o que de fato aconteceu, e apontar a tela de Atividade e o que
 * permite conferir o desfecho — inclusive o ruim, que e o unico lugar onde ele
 * aparece (especificacao, secao 5: nao ha aviso fora da tela).
 */
export function avisoDaPublicacaoEnfileirada(
  quando: { dia: number; mes: number; hora: number; minuto: number } | null
): Aviso {
  if (!quando) {
    return {
      tom: "ok",
      texto: "Publicação na fila. Ela sai em instantes — acompanhe o desfecho em Atividade.",
    };
  }
  const d = String(quando.dia).padStart(2, "0");
  const m = String(quando.mes).padStart(2, "0");
  const h = String(quando.hora).padStart(2, "0");
  const min = String(quando.minuto).padStart(2, "0");
  return {
    tom: "ok",
    texto: `Publicação agendada para ${d}/${m} às ${h}:${min}. Acompanhe o desfecho em Atividade.`,
  };
}

/**
 * A URL de volta da LISTA DE AGENDADOS, com o aviso pendurado nela.
 *
 * A VOLTA E PARA A LISTA, e essa e a decisao: quem clicou em cancelar estava
 * olhando os agendados, e mandar a pessoa para `/publicar` depois de cancelar
 * esconderia a unica prova de que o post sumiu — a propria lista, um item mais
 * curta.
 *
 * NAO E CONSTRUIDA SOBRE `urlDoAviso`, pelo mesmo motivo de
 * `urlDePublicarComAviso` e `urlDaConversaComAviso`: aquela funcao existe para
 * `/contatos`, que tem FILTRO DE CATEGORIA, e forcar seu uso aqui exigiria
 * inventar um filtro que nao representa nada desta tela.
 *
 * O TOM VAI JUNTO DO TEXTO: `avisoDaUrl` le DOIS parametros, e um sucesso
 * mandado sem `tom` chega na tela pintado de falha.
 */
export function urlDeAgendadosComAviso(aviso: Aviso): string {
  return `/publicar/agendados?aviso=${encodeURIComponent(aviso.texto)}&tom=${aviso.tom}`;
}

/**
 * O aviso inteiro — texto E tom — de um cancelar ou remarcar.
 *
 * O TOM E A METADE QUE MENTE MAIS RAPIDO. A faixa e verde ou vermelha antes de
 * qualquer palavra ser lida, e um `tarde_demais` pintado de verde contaria a
 * mentira central desta entrega so pela cor — o dono fecharia a tela achando
 * que impediu um post que ja esta no ar.
 *
 * SO `feito` E VERDE. Os outros quatro sao pedidos que NAO aconteceram, e nao
 * ha meio-termo a pintar: ou o `update` afetou a linha, ou nao afetou.
 *
 * O TEXTO VEM DE `textoDoDesfecho`, nunca escrito aqui — a mesma disciplina que
 * faz a acao de publicar nao escrever string nenhuma.
 */
export function avisoDoDesfecho(
  d: DesfechoDaMudanca,
  acao: "cancelar" | "remarcar"
): Aviso {
  return { tom: d === "feito" ? "ok" : "erro", texto: textoDoDesfecho(d, acao) };
}
