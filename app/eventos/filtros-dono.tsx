"use client";

import {
  createContext,
  useContext,
  useOptimistic,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  aplicarMudanca,
  queryDaPagina,
  type FiltrosDaPagina,
  type MudancaDeFiltro,
  type Secao,
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
  // Qual seção está esperando dado novo, ou null. Serve para as LISTAS
  // indicarem carregamento; as barras seguem vivas.
  secaoEmVoo: Secao | null;
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
  const [ultimaSecao, setUltimaSecao] = useState<Secao | null>(null);

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
    setUltimaSecao(m.secao);
    iniciar(() => {
      aplicar(m);
      // Sem rolar: nenhuma das duas trocas de filtro pode arrancar o leitor do
      // lugar onde ele está lendo. A barra de baixo era a que fazia isso.
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  return (
    <Contexto.Provider
      value={{ filtros, atualizar, secaoEmVoo: pendente ? ultimaSecao : null }}
    >
      {children}
    </Contexto.Provider>
  );
}

// Onde o dado muda, e portanto onde o carregamento aparece.
//
// O apagamento saiu das barras: apagar o controle que a pessoa acabou de clicar
// é dizer "não use isto agora", justo quando ela quer continuar filtrando. Quem
// fica esperando é a lista, e é a lista que esmaece — de leve, e sem sair do
// fluxo, para o conteúdo antigo continuar legível enquanto o novo não chega.
//
// ESMAECE SÓ A SEÇÃO MEXIDA, e a decisão é de experiência, não de exatidão.
//
// É verdade que a página inteira é refeita no servidor a cada navegação — as
// duas consultas rodam de novo. Mas trocar um filtro de ENVIOS não pode mudar a
// lista de interações: ela é consultada com exatamente os mesmos parâmetros.
// Apagar 7.900px de conteúdo que não vai mudar é ruído, não informação.
//
// O que se abre mão: se um evento novo chegar do Instagram entre uma
// renderização e outra, a lista de interações muda sem ter esmaecido antes. É o
// mesmo que acontece em qualquer recarregamento de página, e ninguém esmaece por
// isso.
export function Carregando({ secao, children }: { secao: Secao; children: ReactNode }) {
  const { secaoEmVoo } = useFiltros();
  const esperando = secaoEmVoo === secao;
  return (
    <div
      aria-busy={esperando}
      className={`transition-opacity duration-200 ${esperando ? "opacity-50" : ""}`}
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
