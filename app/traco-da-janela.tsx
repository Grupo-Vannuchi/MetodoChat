import { fracaoDaJanela } from "@/lib/inbox-window";
import type { Urgencia } from "@/lib/precisa-de-voce";

// O TRAÇO DA JANELA — a assinatura visual desta reformulação.
//
// A janela de 24h é a LEI deste produto: fora dela a Meta recusa a mensagem, e
// o motor recusa antes de tentar. Até aqui ela aparecia como uma pílula verde
// no canto da conversa, ou seja, tratada como enfeite. Ela passa a ser um traço
// no começo de toda linha que tem prazo, e o preenchimento dele é o tempo que
// resta. O olho o lê antes do texto.
//
// A FONTE DO NÚMERO É `fracaoDaJanela` (lib/inbox-window.ts), a mesma janela
// que o motor usa para recusar envio. Nenhuma segunda régua de tempo entra
// neste produto — é restrição declarada na spec.
//
// ELE É LIDO EM VOZ ALTA QUANDO FOR A ÚNICA VOZ, e só então — é o que `rotulo`
// decide.
//
// A PRIMEIRA VERSÃO ERA `aria-hidden` SEMPRE, com esta justificativa: "a linha
// já diz 'fecha em 2h10' em texto, e um leitor de tela que anunciasse a barra
// leria a mesma informação duas vezes". Verdade na tela inicial e no cabeçalho
// da conversa. FALSA na lista de conversas — e falsa por causa do MESMO commit
// que pôs o traço lá, que apagou a pílula verde com `formatWindowLeft` e não
// pôs texto nenhum no lugar.
//
// O efeito: quem usa leitor de tela abria `/conversas`, tabulava por cinquenta
// linhas e não recebia NADA sobre a janela de 24h — a lei do produto, a coisa
// que decide se ainda dá para responder. Antes ouvia "3h20". A informação não
// ficou pior; ficou exclusivamente visual, que é como ela desaparece por
// inteiro para uma parte das pessoas.
//
// `rotulo` custa zero pixel, que é o motivo de o traço ter ido para aquela
// coluna. Onde o texto existe ao lado, ele continua ausente e o traço continua
// mudo.

/** A cor do preenchimento, por urgência — o mesmo vocabulário do resto. */
const TOM: Record<Urgencia, string> = {
  aberto: "bg-aberto dark:bg-aberto-escuro",
  fecha: "bg-fecha dark:bg-fecha-escuro",
  parou: "bg-parou dark:bg-parou-escuro",
  // O convite não é estado de nada, e por isso não gasta cor de estado.
  quieto: "bg-quieto/60 dark:bg-quieto-escuro/60",
};

// A TRILHA VAZIA TEM DE SER VISÍVEL, senão só o COMPRIMENTO se lê e a razão
// "quanto falta do total" se perde — que é a leitura inteira deste traço. No
// tema escuro, `traco-escuro` sobre o cartão dá 1,35:1 e some; o `quieto` a 30%
// sobe para perto de 1,6:1 sem virar uma segunda barra ao lado da primeira.
//
// DUAS ORIENTAÇÕES, E A REGRA NÃO É ESTÉTICA — É LARGURA MEDIDA.
//
// `deitado` é a forma normal, e é a da spec: um traço de 44px no começo da
// linha, em tela larga. `em pe` existe porque a lista de conversas é uma coluna
// de 320px com 224px ÚTEIS, e esse número não é estimativa — está medido no
// comentário de `app/conversas/lista.tsx`, que documenta a linha inteira sendo
// disputada pixel a pixel (os separadores "·" saíram de lá por custarem 49px).
// Um traço deitado ali custaria 44px mais o espaçamento, ou seja, um quarto da
// linha; em pé custa 3px e ainda DEVOLVE os ~45px da pílula verde que ele
// substitui.
//
// O SENTIDO DO PREENCHIMENTO É O MESMO NOS DOIS: cheio é o dia inteiro pela
// frente, vazio é fechada. Em pé ele enche de BAIXO para cima, que é como se lê
// nível — o de um tanque, o de uma bateria —, e é a única leitura de barra
// vertical que não precisa ser aprendida.
export function TracoDaJanela({
  msLeft,
  urgencia,
  orientacao = "deitado",
  rotulo,
}: {
  msLeft: number;
  urgencia: Urgencia;
  orientacao?: "deitado" | "em-pe";
  /** O que o leitor de tela anuncia. Sem ele, o traço é mudo — ver o cabeçalho. */
  rotulo?: string;
}) {
  const fracao = fracaoDaJanela(msLeft);
  const porcento = `${(fracao * 100).toFixed(1)}%`;
  // `role="img"` com nome é o que faz um desenho ser anunciado como UMA coisa,
  // com o nome que se deu a ela — em vez de um `<span>` vazio, que não é
  // anunciado de jeito nenhum.
  const voz = rotulo ? ({ role: "img", "aria-label": rotulo } as const) : ({ "aria-hidden": true } as const);

  if (orientacao === "em-pe") {
    return (
      <span
        {...voz}
        className="flex w-[3px] shrink-0 flex-col justify-end self-stretch overflow-hidden rounded-full bg-traco dark:bg-quieto-escuro/30"
      >
        <span className={`block w-full rounded-full ${TOM[urgencia]}`} style={{ height: porcento }} />
      </span>
    );
  }

  return (
    <span
      {...voz}
      className="block h-1.5 w-11 shrink-0 overflow-hidden rounded-full bg-traco dark:bg-quieto-escuro/30"
    >
      <span
        className={`block h-full rounded-full ${TOM[urgencia]}`}
        // A largura é um número contínuo e não cabe numa classe do Tailwind:
        // `w-[37%]` teria de existir para cada porcentagem possível, e o
        // compilador só gera as classes que encontra escritas na árvore.
        style={{ width: porcento }}
      />
    </span>
  );
}

/**
 * O ponto das linhas SEM prazo, no lugar do traço.
 *
 * Ele existe para a coluna não desalinhar: uma lista em que metade das linhas
 * começa com um traço e a outra metade começa com o texto vira duas listas
 * coladas. O ponto ocupa a mesma largura e diz a mesma coisa que o traço diz
 * pela cor — sem prometer um prazo que aquela linha não tem.
 */
export function PontoDaLinha({ urgencia }: { urgencia: Urgencia }) {
  return (
    <span aria-hidden className="flex h-1.5 w-11 shrink-0 items-center justify-center">
      <span className={`block h-1.5 w-1.5 rounded-full ${TOM[urgencia]}`} />
    </span>
  );
}
