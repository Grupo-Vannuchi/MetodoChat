import { skeleton } from "./ui";

// O ESQUELETO DO INÍCIO, e ele descreve o Início de HOJE.
//
// Sem um loading.tsx, o App Router segura a tela ANTIGA até o servidor terminar
// de renderizar a nova rota — é o que dá a sensação de travamento ao trocar de
// página. Com este arquivo, o esqueleto aparece na hora.
//
// ATÉ 11/09/2026 ELE DESCREVIA A TELA ERRADA: quatro cartões de métrica e um
// gráfico largo, que era o Início antes da Parte 2. Quando os números foram
// para `/desempenho`, este arquivo ficou onde estava — e o Início piscava
// quatro caixas grandes antes de mostrar um cartão de duas linhas dizendo "Nada
// precisa de você agora". Dez vezes por dia, na tela que a spec diz que se abre
// dez vezes por dia.
//
// A FORMA AQUI É A DA LISTA "Precisa de você", que é o pior caso desta tela: o
// estado calmo é MENOR que isto, e um esqueleto que encolhe incomoda menos do
// que um que cresce — a página não empurra o que a pessoa já começou a ler.
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="flex items-center gap-3">
        <div className={`${skeleton} h-10 w-10 rounded-full`} />
        <div className="space-y-2">
          <div className={`${skeleton} h-7 w-40`} />
          <div className={`${skeleton} h-4 w-52 max-w-full`} />
        </div>
      </div>
      <div className={`${skeleton} h-56`} />
    </div>
  );
}
