"use client";

import { createContext, useContext, useOptimistic, useTransition, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  aplicarMudanca,
  queryDaPagina,
  type FiltrosDaPagina,
  type MudancaDeFiltro,
} from "@/lib/eventos-url";
import { NO_FILTERS, type EventFilters } from "@/lib/event-filters";
import { NO_ENVIO_FILTERS, type EnvioFilters } from "@/lib/envio-filters";

// O dono da barra de endereço de /eventos.
//
// A página tem duas seções com filtro. Antes, cada barra escrevia na URL por
// conta própria, montando o endereço inteiro com os seus parâmetros mais um
// retrato dos da outra tirado no render do servidor. Dois escritores, cada um
// lendo antes e escrevendo depois: um clique que chegasse durante uma navegação
// em voo desfazia em silêncio a mudança que estava a caminho.
//
// Agora só este componente escreve. As barras recebem os valores e a função de
// atualizar, e não montam endereço nenhum — não existe mais nada da outra seção
// para "preservar", porque o estado é da PÁGINA e não da barra.
//
// O estado é otimista: o clique muda a interface na hora e a navegação acontece
// atrás. Isso não é só conforto, é o que fecha a corrida por construção — um
// segundo clique lê o estado deste componente, que já contém a primeira
// mudança, e as duas se somam. Não sobra retrato velho para perder.

type Dono = {
  filtros: FiltrosDaPagina;
  atualizar: (m: MudancaDeFiltro) => void;
  // Verdadeiro enquanto a navegação não terminou. Serve para as LISTAS
  // indicarem carregamento; as barras seguem vivas.
  pendente: boolean;
};

const Contexto = createContext<Dono | null>(null);

export function useFiltros(): Dono {
  const dono = useContext(Contexto);
  if (!dono) throw new Error("Faltou o DonoDosFiltros em volta desta parte da página.");
  return dono;
}

export default function DonoDosFiltros({
  eventos,
  envios,
  children,
}: {
  // Os dois conjuntos já validados pelo servidor, como as barras recebiam antes.
  eventos: EventFilters;
  envios: EnvioFilters;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pendente, iniciar] = useTransition();

  // A base é o que o servidor mandou; as mudanças ainda em voo são reaplicadas
  // por cima dela a cada render. Como toda mudança é absoluta, reaplicar uma
  // que o servidor já devolveu dá no mesmo.
  const [filtros, aplicar] = useOptimistic<FiltrosDaPagina, MudancaDeFiltro>(
    { eventos, envios },
    aplicarMudanca
  );

  function atualizar(m: MudancaDeFiltro) {
    // O endereço sai do estado deste instante — nunca de uma prop congelada no
    // render anterior. É aqui que a atualização perdida deixa de existir.
    const qs = queryDaPagina(aplicarMudanca(filtros, m));
    iniciar(() => {
      aplicar(m);
      // Sem rolar: nenhuma das duas trocas de filtro pode arrancar o leitor do
      // lugar onde ele está lendo. A barra de baixo era a que fazia isso.
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  return <Contexto.Provider value={{ filtros, atualizar, pendente }}>{children}</Contexto.Provider>;
}

// Onde o dado muda, e portanto onde o carregamento aparece.
//
// O apagamento saiu das barras: apagar o controle que a pessoa acabou de clicar
// é dizer "não use isto agora", justo quando ela quer continuar filtrando. Quem
// fica esperando é a lista, e é a lista que esmaece — de leve, e sem sair do
// fluxo, para o conteúdo antigo continuar legível enquanto o novo não chega.
//
// As duas listas esmaecem em qualquer troca de filtro, e não só a da seção
// mexida: a página inteira é refeita no servidor a cada navegação, então as duas
// realmente estão sendo recarregadas.
export function Carregando({ children }: { children: ReactNode }) {
  const { pendente } = useFiltros();
  return (
    <div
      aria-busy={pendente}
      className={`transition-opacity duration-200 ${pendente ? "opacity-50" : ""}`}
    >
      {children}
    </div>
  );
}

// "Limpar filtros" do estado vazio. Era um <a href> que montava a URL sozinho —
// o terceiro escritor da mesma barra de endereço. Agora passa pelo dono, como
// tudo mais.
export function LimparSecao({ secao, className }: { secao: "eventos" | "envios"; className: string }) {
  const { atualizar } = useFiltros();
  return (
    <button
      type="button"
      onClick={() =>
        secao === "eventos"
          ? atualizar({ secao, mudanca: NO_FILTERS })
          : atualizar({ secao, mudanca: NO_ENVIO_FILTERS })
      }
      className={className}
    >
      Limpar filtros
    </button>
  );
}
