import { skeleton } from "../../ui";

// O ESQUELETO DO EDITOR, e ele existe para NÃO herdar o da lista.
//
// `loading.tsx` cria uma fronteira de Suspense que embrulha o segmento e tudo
// abaixo dele, então `app/automacoes/loading.tsx` — o esqueleto da LISTA, com
// barra de filtros e linhas — era o que aparecia enquanto o editor carregava.
// Ele foi desenhado para viver dentro da casca do aplicativo, e a casca
// (`app/app-shell.tsx`) sai justamente nesta rota: o resultado era o esqueleto
// da tela errada, colado nas bordas da janela. A fronteira mais interna é a que
// vale, então este arquivo é o que responde por `/automacoes/<id>`.
//
// A FORMA É A DO QUADRO (`../editor/quadro.tsx`): `h-dvh`, barra fina no topo e
// o resto da altura para a tela de edição — assim o conteúdo não pula quando os
// dados chegam. `h-dvh` e não `h-screen` pelo mesmo motivo que lá: no celular
// `100vh` conta a faixa da barra de endereço e a coluna fica mais alta que o
// visível.
export default function Loading() {
  return (
    <div className="flex h-dvh flex-col" aria-busy="true" aria-live="polite">
      <div className="flex shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-4 py-2 dark:border-zinc-800 dark:bg-zinc-950">
        <div className={`${skeleton} h-5 w-28`} />
        <div className={`${skeleton} h-5 w-40`} />
        <div className={`${skeleton} ml-auto hidden h-10 w-44 sm:block`} />
      </div>
      <div className="flex-1 p-4">
        <div className={`${skeleton} h-full w-full`} />
      </div>
    </div>
  );
}
