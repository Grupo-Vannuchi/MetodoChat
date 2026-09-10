import type { PostRef } from "@/lib/media-lookup";
import { subtle } from "../ui";

// A linha "veio deste post" logo abaixo do comentário. Quem chama só renderiza
// quando o evento tem post de origem, então DM e resposta de story continuam
// com o cartão de sempre.

const wrap = `mt-2.5 inline-flex max-w-full items-center gap-2.5 py-1.5 pl-1.5 pr-3 ${subtle}`;
const thumbBox = "h-8 w-8 flex-none rounded-lg object-cover";

export default function PostLine({ kind, post }: { kind: string; post: PostRef | null }) {
  const legenda = post?.caption?.replace(/\s+/g, " ").trim();

  const conteudo = (
    <>
      {post?.thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.thumb}
          alt=""
          className={`${thumbBox} border border-zinc-200 dark:border-zinc-700`}
        />
      ) : (
        <span
          className={`${thumbBox} flex items-center justify-center border border-dashed border-zinc-300 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-400`}
          aria-hidden="true"
        >
          ?
        </span>
      )}
      <span className="flex min-w-0 flex-col">
        <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-zinc-600 dark:text-zinc-400">
          {kind}
        </span>
        <span className="max-w-[22rem] truncate text-xs text-zinc-600 dark:text-zinc-300">
          {legenda || (post ? "Sem legenda" : "Post não identificado")}
        </span>
      </span>
      {post?.permalink && (
        <span className="flex-none text-[11px] text-zinc-600 dark:text-zinc-400" aria-hidden="true">
          ↗
        </span>
      )}
    </>
  );

  // Sem permalink (anúncio, ou post que não resolvemos) a linha ainda informa
  // de onde veio — só não leva a lugar nenhum.
  if (!post?.permalink) return <div className={wrap}>{conteudo}</div>;

  return (
    <a
      href={post.permalink}
      target="_blank"
      rel="noopener noreferrer"
      className={`${wrap} transition-colors hover:border-tinta focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-tinta/20 dark:hover:border-tinta-escuro dark:focus-visible:ring-tinta-escuro/25`}
    >
      {conteudo}
    </a>
  );
}
