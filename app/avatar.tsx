"use client";
import { useCallback, useState } from "react";
import { initial } from "@/lib/initials";
import { imagemJaFalhou } from "@/lib/imagem-quebrada";

// Foto de perfil com recuo para a inicial — as URLs do CDN do Instagram
// expiram depois de um tempo, então a imagem pode falhar mesmo salva no banco.
//
// O `onError` SOZINHO NÃO BASTA, e isso foi medido na produção em 16/09/2026:
// 13 de 46 fotos em `/conversas` e 7 de 30 em `/contatos` ficavam como círculo
// cinza vazio, porque o `<img>` vem pronto do servidor e o `error` dispara
// ANTES de o React hidratar e pendurar o handler. O porquê inteiro está em
// `lib/imagem-quebrada.ts`. Por isso são DUAS redes, e não uma:
//
//   1. `aoMontar` pergunta, no instante em que o elemento aparece, se ele JÁ
//      falhou — é esta que pega o caso comum, o da foto vencida;
//   2. `onError` continua pegando a falha que acontece DEPOIS, com a página já
//      viva (rede que cai no meio, URL que vence com a aba aberta).
export default function Avatar({
  src,
  name,
  className = "h-10 w-10",
  textClassName = "text-sm",
}: {
  src: string | null;
  name: string;
  className?: string;
  textClassName?: string;
}) {
  // GUARDA QUAL `src` FALHOU, e não um `failed` de sim/não — a versão anterior
  // usava booleano e isso era um segundo defeito, latente. Numa lista, o React
  // reaproveita o componente por POSIÇÃO: a linha 3 de `/conversas` continua
  // sendo a mesma instância quando a conversa que ocupa a linha 3 muda. Com
  // booleano, o `true` de uma foto vencida ficava grudado e escondia a foto BOA
  // da pessoa seguinte. Comparando o `src` que falhou com o `src` de agora,
  // trocar de pessoa naturalmente desfaz o recuo.
  const [srcQueFalhou, setSrcQueFalhou] = useState<string | null>(null);

  // A dependência `[src]` é obrigatória: é ela que faz o React chamar de novo
  // quando a foto muda, e reperguntar sobre o elemento novo. E o callback NÃO
  // devolve nada — no React 19 um retorno de função vira limpeza do ref.
  const aoMontar = useCallback(
    (img: HTMLImageElement | null) => {
      if (img && imagemJaFalhou(img)) setSrcQueFalhou(src);
    },
    [src]
  );

  if (src && srcQueFalhou !== src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        ref={aoMontar}
        onError={() => setSrcQueFalhou(src)}
        className={`${className} shrink-0 rounded-full border border-zinc-200 object-cover dark:border-zinc-700`}
      />
    );
  }
  return (
    <span
      className={`${className} flex shrink-0 items-center justify-center rounded-full bg-tinta font-bold text-papel dark:bg-tinta-escuro dark:text-papel-escuro ${textClassName}`}
    >
      {initial(name)}
    </span>
  );
}
