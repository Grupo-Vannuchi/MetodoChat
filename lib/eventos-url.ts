// A barra de endereço de /eventos, inteira, num lugar só.
//
// A página tem duas seções com filtro, e uma URL só. Enquanto cada barra montava
// o endereço com os SEUS parâmetros mais um retrato dos da outra, havia dois
// escritores para o mesmo endereço — e todo clique que chegasse durante uma
// navegação em voo escrevia por cima do que estava a caminho, porque carregava
// um retrato tirado antes. Atualização perdida, do mesmo feitio de dois `update`
// sem transação.
//
// Aqui não existe "os parâmetros da outra": existe o estado da PÁGINA. Quem
// muda alguma coisa aplica a mudança sobre o estado inteiro e serializa o
// resultado inteiro. Não há o que preservar, porque nada é de outra pessoa.
//
// Sem "server-only": o dono da URL é componente de cliente. A tradução para SQL
// continua em lib/event-query.ts e lib/envio-query.ts, que não saem do servidor.

import { NO_FILTERS, toQueryString, type EventFilters } from "./event-filters";
import { NO_ENVIO_FILTERS, toEnvioQueryString, type EnvioFilters } from "./envio-filters";

export type FiltrosDaPagina = {
  eventos: EventFilters;
  envios: EnvioFilters;
};

export const SEM_FILTROS: FiltrosDaPagina = {
  eventos: NO_FILTERS,
  envios: NO_ENVIO_FILTERS,
};

// A união discriminada amarra a seção à forma da mudança: pedir `origem` para a
// seção de eventos não compila.
// As duas metades da página. Nomeadas porque quem indica carregamento precisa
// dizer DE QUAL seção está falando, e não só que algo está em voo.
export type Secao = "eventos" | "envios";

export type MudancaDeFiltro =
  | { secao: "eventos"; mudanca: Partial<EventFilters> }
  | { secao: "envios"; mudanca: Partial<EnvioFilters> };

// O reducer do estado otimista, e a mesma função que decide o próximo endereço.
//
// Devolve sempre um objeto novo, e a mudança é ABSOLUTA — "período passa a ser
// 7d", não "avança um período". Isso é o que deixa reaplicar sem estragar: o
// React reaplica as mudanças ainda pendentes sobre o estado que chega do
// servidor, e uma mudança já aplicada, aplicada de novo, dá no mesmo.
export function aplicarMudanca(atual: FiltrosDaPagina, m: MudancaDeFiltro): FiltrosDaPagina {
  return m.secao === "eventos"
    ? { ...atual, eventos: { ...atual.eventos, ...m.mudanca } }
    : { ...atual, envios: { ...atual.envios, ...m.mudanca } };
}

// Estado da página → query string, na mesma ordem sempre: primeiro os
// parâmetros da lista de interações, depois os da lista de envios. Cada metade
// continua sendo montada por quem já sabia montá-la; o que esta função faz é
// não deixar mais ninguém decidir a ordem nem o que entra.
//
// Sem filtro nenhum, devolve string vazia — a URL de /eventos fica nua.
export function queryDaPagina(f: FiltrosDaPagina): string {
  return [toQueryString(f.eventos), toEnvioQueryString(f.envios)].filter(Boolean).join("&");
}
