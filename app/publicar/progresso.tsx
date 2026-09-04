"use client";
import { useSyncExternalStore } from "react";
import { resumoDoProgresso } from "@/lib/publicacao";
import { assinarEnvios, lerEnvios, lerEnviosNoServidor, limparEnvios } from "./envios";

// A JANELINHA DO CANTO — a segunda metade da exceção declarada na
// especificação (§3).
//
// Ela mora no `app-shell` para SOBREVIVER À NAVEGAÇÃO: um reels de 200 MB leva
// minutos, e prender a pessoa na tela de publicar durante esse tempo seria
// desenhar o produto em volta de uma limitação técnica.
//
// =============================================================================
// NENHUMA DECISÃO MORA AQUI, E ISSO É VERIFICÁVEL LENDO O ARQUIVO
//
// A suíte não testa componente — o que for decidido neste arquivo fica sem rede
// nenhuma. Então tudo o que se pergunta sobre os envios já vem respondido por
// `resumoDoProgresso` (lib/publicacao.ts): se há janelinha (`null`), o título,
// a largura da barra, se acabou, se houve falha e a frase de cada arquivo.
//
// O que sobra abaixo é cor, posição e o botão de fechar. Se alguém precisar
// escrever aqui um `if` sobre o que os envios SIGNIFICAM, o lugar dele é
// `lib/publicacao.ts`, com caso de teste.

export default function Progresso() {
  const envios = useSyncExternalStore(assinarEnvios, lerEnvios, lerEnviosNoServidor);
  const resumo = resumoDoProgresso(envios);

  // SEM ENVIO NÃO HÁ MODAL. O `null` vem da função pura, e não de um
  // `envios.length === 0` escrito aqui — é a mesma pergunta, e ela tem caso.
  if (!resumo) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.25)] dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex items-start justify-between gap-3">
        <p
          className={`text-sm font-semibold ${
            resumo.houveFalha
              ? "text-red-600 dark:text-red-400"
              : "text-zinc-900 dark:text-zinc-100"
          }`}
        >
          {resumo.titulo}
        </p>
        {/* O BOTÃO DE FECHAR SÓ APARECE NO FIM. Fechar no meio abandonaria um
            upload vivo sem dizer isso a ninguém — e `encerrado` é a pergunta
            que a função pura já responde, inclusive no caso do conjunto em que
            um falhou e outro ainda anda. */}
        {resumo.encerrado && (
          <button
            type="button"
            onClick={limparEnvios}
            aria-label="Fechar o andamento dos envios"
            className="-mr-1 -mt-1 rounded-lg px-2 py-1 text-xs text-zinc-500 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Fechar
          </button>
        )}
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div
          className={`h-full rounded-full transition-[width] duration-200 ${
            resumo.houveFalha ? "bg-red-500" : "bg-indigo-500"
          }`}
          style={{ width: `${resumo.porcentagem}%` }}
        />
      </div>

      <ul className="mt-3 space-y-1">
        {resumo.linhas.map((linha, i) => (
          // A CHAVE É O ÍNDICE de propósito: a lista não é reordenada nem
          // filtrada enquanto a janelinha existe — ela é trocada inteira por
          // `definirEnvios` —, e o nome do arquivo se repetiria se alguém
          // escolhesse duas vezes o mesmo.
          <li key={i} className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
            {linha}
          </li>
        ))}
      </ul>
    </div>
  );
}
