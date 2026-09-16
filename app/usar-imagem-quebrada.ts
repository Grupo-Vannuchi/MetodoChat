"use client";
import { useCallback, useState } from "react";
import { imagemJaFalhou } from "@/lib/imagem-quebrada";

// AS DUAS REDES CONTRA A IMAGEM QUE JÁ CHEGOU QUEBRADA — num lugar só.
//
// POR QUE ISTO EXISTE COM DONO ÚNICO, e não como três `useState` parecidos:
// esta base já foi mordida exatamente assim. Em 15/09/2026 o cabeçalho de
// `lib/media-lookup.ts` mandava buscar a capa do post na hora de exibir e nunca
// guardá-la; `/eventos` seguia e `/automacoes` não, e a tela que não seguia
// ficou com 19 de 22 miniaturas quebradas por semanas. A regra existia e não
// tinha dono, então uma cópia divergiu em silêncio.
//
// Três componentes mostram imagem cuja URL vem assinada da Meta e VENCE:
// `app/avatar.tsx` (foto de contato), `MiniAvatar` em
// `app/automacoes/editor/previa.tsx` (foto da conta) e
// `app/conversas/[id]/anexo-imagem.tsx` (anexo da mensagem). Os três tinham a
// mesma rede e o mesmo furo.
//
// O FURO, medido na produção em 16/09/2026: 13 de 46 fotos em `/conversas` e 7
// de 30 em `/contatos` ficavam como círculo cinza vazio. O `onError` sozinho
// chega tarde — o `<img>` vem pronto no HTML do servidor, a imagem falha
// durante o carregamento da página, e o evento `error` dispara ANTES de o React
// hidratar e pendurar o handler. O React não redispara `error` para imagem que
// já falhou. O porquê inteiro está em `lib/imagem-quebrada.ts`.
//
// Por isso são DUAS redes, e nenhuma cobre o caso da outra:
//   `aoMontar` pega a imagem que JÁ falhou quando o elemento apareceu;
//   `aoErro`  pega a que falhar DEPOIS, com a página viva.

/**
 * Diz se a imagem de `src` está quebrada, e devolve as duas redes para pendurar
 * no `<img>`.
 *
 * GUARDA QUAL `src` FALHOU, e não um booleano — a versão anterior de
 * `app/avatar.tsx` usava booleano e isso era um segundo defeito, latente. Numa
 * lista o React reaproveita o componente por POSIÇÃO: a linha 3 de
 * `/conversas` continua sendo a mesma instância quando a conversa que ocupa a
 * linha 3 muda. Com booleano, o `true` de uma foto vencida ficava grudado e
 * escondia a foto BOA da pessoa seguinte.
 */
export function useImagemQuebrada(src: string | null | undefined) {
  const atual = src ?? null;
  const [srcQueFalhou, setSrcQueFalhou] = useState<string | null>(null);

  // A dependência `[atual]` é obrigatória: sem ela o callback congela o `src`
  // da primeira renderização e passa a marcar a foto errada como quebrada.
  //
  // E o callback NÃO DEVOLVE NADA: no React 19 um retorno de função vira a
  // limpeza do ref, e devolver o resultado de `setSrcQueFalhou` por engano —
  // escrevendo o corpo sem chaves — faria o React tratar isso como limpeza.
  const aoMontar = useCallback(
    (img: HTMLImageElement | null) => {
      if (img && imagemJaFalhou(img)) setSrcQueFalhou(atual);
    },
    [atual]
  );

  const aoErro = useCallback(() => setSrcQueFalhou(atual), [atual]);

  return { quebrou: atual !== null && srcQueFalhou === atual, aoMontar, aoErro };
}
