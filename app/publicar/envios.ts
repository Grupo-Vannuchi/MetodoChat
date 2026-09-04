import type { EnvioEmAndamento } from "@/lib/publicacao";

// O DEPÓSITO DOS ENVIOS EM ANDAMENTO — a única coisa desta tarefa que é estado
// de navegador, e o motivo pelo qual ela é a exceção declarada na especificação
// (§3).
//
// =============================================================================
// POR QUE ELE NÃO É `useState` DENTRO DA TELA
//
// O modal de progresso mora no `app-shell` para SOBREVIVER À NAVEGAÇÃO: quem
// está enviando um reels de 200 MB pode ir para Conversas e continuar vendo o
// andamento. O enviador mora em `/publicar`. São duas árvores de React
// diferentes — o `app-shell` envolve `children`, e não o contrário —, então não
// há estado de componente que os dois possam compartilhar, e um `context` no
// `layout` seria remontado do mesmo jeito quando a rota mudasse.
//
// Um módulo é o que sobrevive: a navegação do App Router troca a árvore, não o
// registro de módulos do navegador. O envio continua andando porque quem o
// carrega é o `XMLHttpRequest`, que não é da árvore de ninguém.
//
// =============================================================================
// E ELE NÃO DECIDE NADA
//
// Guardar e avisar, e mais nada. Quem lê esta lista e diz o que ela significa é
// `resumoDoProgresso` (lib/publicacao.ts), que é pura e tem caso para cada
// saída — inclusive o `null` que faz a janelinha não existir. Este arquivo não
// sabe o que é uma falha, nem o que é estar encerrado.

/** A lista vazia é uma CONSTANTE, e isso não é economia: `useSyncExternalStore`
 *  compara o retorno de `lerEnvios` por identidade a cada render, e um `[]`
 *  novo a cada chamada seria um laço de render infinito. */
const VAZIO: EnvioEmAndamento[] = [];

let envios: EnvioEmAndamento[] = VAZIO;
const ouvintes = new Set<() => void>();

/** Assina as mudanças. A volta é a função que desassina — o contrato de
 *  `useSyncExternalStore`. */
export function assinarEnvios(aoMudar: () => void): () => void {
  ouvintes.add(aoMudar);
  return () => {
    ouvintes.delete(aoMudar);
  };
}

export function lerEnvios(): EnvioEmAndamento[] {
  return envios;
}

/** O que o SERVIDOR vê: ninguém enviando. Ele precisa existir para o
 *  `useSyncExternalStore` não estourar na renderização do servidor, e a
 *  resposta certa é a única que o servidor pode dar com honestidade — envio é
 *  coisa do navegador de uma pessoa, e o HTML é o mesmo para todo mundo. */
export function lerEnviosNoServidor(): EnvioEmAndamento[] {
  return VAZIO;
}

function avisar() {
  for (const ouvinte of ouvintes) ouvinte();
}

/** Troca a lista inteira. A lista é SEMPRE nova (nunca mutada no lugar), de
 *  novo por causa da comparação por identidade do `useSyncExternalStore`: uma
 *  lista mutada não seria vista como mudança e a janelinha ficaria parada. */
export function definirEnvios(proximos: EnvioEmAndamento[]): void {
  envios = proximos.length ? [...proximos] : VAZIO;
  avisar();
}

/** Muda um envio pelo nome do arquivo. É por nome porque é o que o enviador
 *  tem na mão dentro do `onprogress`, e o índice mudaria se a lista fosse
 *  reordenada. */
export function atualizarEnvio(nome: string, mudanca: Partial<EnvioEmAndamento>): void {
  definirEnvios(envios.map((e) => (e.nome === nome ? { ...e, ...mudanca } : e)));
}

export function limparEnvios(): void {
  definirEnvios(VAZIO);
}
