import { urlComFiltro, type FiltroDeCategoria } from "./categorias";

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
 */
export function avisoDoLoteEnviado(agora: number, guardadas: number, pendentes: number): Aviso {
  if (agora === 0 && guardadas === 0 && pendentes > 0) {
    return {
      tom: "erro",
      texto:
        `${pendentes} ${pendentes === 1 ? "mensagem entrou" : "mensagens entraram"} na fila, ` +
        "mas o envio não terminou a tempo de confirmar — elas saem sozinhas em instantes.",
    };
  }
  return { tom: "ok", texto: textoDoLoteEnviado(agora, guardadas) };
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
 * cru — mesmo já validado por quem chama nos dois caminhos de sucesso. No
 * caminho de recusa por formato (`definirCategoria`, quando o id não bate
 * `/^\d{1,32}$/`), o valor ainda não foi validado quando este redirect é
 * montado: ele vem direto do FormData, que é o navegador de alguém, e pode
 * conter qualquer coisa — inclusive `/` ou `?`. Sem codificar, esse texto
 * quebraria o caminho da URL (uma barra a mais insere um segmento de rota que
 * não existe) em vez de simplesmente cair no `notFound()` que a página já
 * faz para um id que não bate o formato.
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
