import { skeleton } from "../ui";

// Sem um loading.tsx, o App Router segura a tela ANTIGA até o servidor
// terminar de renderizar a nova rota — é o que dá a sensação de travamento ao
// trocar de página. Com este arquivo, o esqueleto aparece na hora.
//
// ESTE ESQUELETO ESTAVA NA ROTA ERRADA ATÉ 11/09/2026. Ele descreve quatro
// cartões de métrica e um gráfico largo, que era o Início ANTIGO — e quando a
// Parte 2 moveu esses números para cá, o arquivo ficou onde estava. O Início
// piscava quatro caixas grandes antes de mostrar um cartão de duas linhas, dez
// vezes por dia; e /desempenho, que TEM esse layout, não tinha esqueleto nenhum.
// Esqueleto que não descreve a tela que vem é pior que nenhum: ele promete uma
// forma e entrega outra.
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <div className={`${skeleton} h-7 w-52`} />
        <div className={`${skeleton} h-4 w-80 max-w-full`} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`${skeleton} h-24`} />
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className={`${skeleton} h-72`} />
        <div className={`${skeleton} hidden h-72 lg:block`} />
      </div>
    </div>
  );
}
