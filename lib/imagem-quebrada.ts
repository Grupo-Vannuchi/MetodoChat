// A PERGUNTA QUE SÓ O `<img>` MONTADO SABE RESPONDER — e por que ela precisa
// existir como função, em vez de virar um `if` dentro do componente.
//
// MÓDULO PURO, e sem `server-only` de propósito: quem faz a pergunta é
// `app/avatar.tsx`, que é `"use client"`. É a mesma disciplina de
// `lib/conexao.ts` e de `lib/initials.ts` — a decisão fica num arquivo que a
// suíte pura alcança, e o componente fica sendo só a moldura. A suíte padrão
// deste repositório não tem DOM (vitest.config.ts diz isso com todas as
// letras), então um `if` escondido no meio do JSX seria lógica sem nenhum teste
// possível.

/**
 * A imagem já terminou de tentar carregar E falhou?
 *
 * POR QUE ISTO EXISTE, medido em produção em 16/09/2026: `app/avatar.tsx` tem
 * um `onError` que troca a foto pela inicial, e ele NÃO ESTAVA FUNCIONANDO para
 * a maior parte dos casos reais. Na tela `/conversas`, 13 de 46 fotos ficavam
 * como círculo cinza vazio; em `/contatos`, 7 de 30.
 *
 * A CAUSA NÃO É O `onError` ESTAR ERRADO — é ele chegar TARDE. O `<img>` vem
 * pronto no HTML do servidor, o navegador tenta baixar a foto durante o
 * carregamento da página, e a URL assinada do CDN do Instagram já venceu (as de
 * contato de agosto devolvem 403; as de setembro ainda carregam). O evento
 * `error` dispara ANTES de o React hidratar e pendurar o `onError`, e o React
 * não redispara `error` para uma imagem que já falhou. O aviso se perde, e a
 * foto quebrada fica na tela para sempre.
 *
 * Conferido na produção antes de consertar: numa carga limpa o `<img>` quebrado
 * TEM as chaves `__react` — ou seja, o `onError` está pendurado —, a imagem
 * está falhada, e três segundos depois nada acontece. Handler ligado, evento
 * perdido.
 *
 * AS DUAS PERGUNTAS, e nenhuma sozinha responde:
 *
 * - `complete` é `true` quando a tentativa TERMINOU — tanto faz se deu certo ou
 *   errado. Sozinho, ele acusaria toda imagem carregada com sucesso.
 * - `naturalWidth === 0` é o que distingue o fracasso: imagem que carregou tem
 *   largura, imagem que falhou não tem. Sozinho, ele acusaria toda imagem que
 *   AINDA ESTÁ BAIXANDO, e a foto boa viraria inicial antes de ter chance.
 */
export function imagemJaFalhou(img: { complete: boolean; naturalWidth: number }): boolean {
  return img.complete && img.naturalWidth === 0;
}
