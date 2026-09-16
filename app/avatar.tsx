"use client";
import { initial } from "@/lib/initials";
import { useImagemQuebrada } from "./usar-imagem-quebrada";

// Foto de perfil com recuo para a inicial — as URLs do CDN do Instagram
// expiram depois de um tempo, então a imagem pode falhar mesmo salva no banco.
//
// As duas redes e o porquê de serem duas vivem em `app/usar-imagem-quebrada.ts`,
// que é o dono da regra. Aqui fica só o que é desta tela: qual recuo mostrar.
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
  const { quebrou, aoMontar, aoErro } = useImagemQuebrada(src);

  if (src && !quebrou) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        ref={aoMontar}
        onError={aoErro}
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
