import Link from "next/link";
import { btnPrimary, muted, pageTitle } from "../../ui";

// O 404 DESTA ROTA, e ele existe porque o 404 padrão do Next ficava sem saída.
//
// A casca do aplicativo (`app/app-shell.tsx`) reconhece o editor pelo CAMINHO —
// `/automacoes/<id de 36 caracteres>` —, e não pelo que a página conseguiu
// renderizar. Um id com forma válida mas inexistente (automação apagada, link
// antigo, automação de outra conta) chama `notFound()` daqui de dentro, e o que
// aparecia era o 404 embutido do Next desenhado SEM menu, sem `<main>` e sem
// margem: a única saída era o botão de voltar do navegador.
//
// ESTA PÁGINA CAI EM DOIS CONTEXTOS, e é por isso que ela desenha o próprio
// espaçamento em vez de contar com a moldura de fora:
//
//   NO EDITOR (id com forma válida, automação inexistente) não há casca
//     nenhuma. Toda a tela é isto.
//   FORA DELE (id com forma inválida — `/automacoes/qualquer-coisa`) a casca
//     aparece normalmente e isto renderiza dentro do `<main>` dela.
//
// É `<div>` E NÃO `<main>` por causa do segundo caso: um `<main>` aqui ficaria
// aninhado no `<main>` da casca. O marco principal se perde no primeiro caso, e
// esse é o preço — pequeno, numa tela de erro, perto de não ter saída nenhuma.
//
// OS DOIS CAMINHOS DE VOLTA são de propósito: a lista é para onde quem clicou um
// link velho quer ir, e o painel é o começo de tudo para quem chegou aqui de
// outro jeito.
export default function AutomacaoNaoEncontrada() {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <p className="text-5xl" aria-hidden>
        🧭
      </p>
      <h1 className={pageTitle}>Automação não encontrada</h1>
      <p className={`${muted} text-sm leading-relaxed`}>
        Ela pode ter sido apagada, ou pertencer a outra conta conectada. O link que trouxe você até
        aqui não aponta mais para nada.
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <Link href="/automacoes" className={btnPrimary}>
          Ver minhas automações
        </Link>
        <Link
          href="/"
          className="text-sm font-medium text-zinc-500 transition-colors hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
        >
          Ir para o painel
        </Link>
      </div>
    </div>
  );
}
