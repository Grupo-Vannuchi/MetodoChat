import type { ReactNode } from "react";
import { card, muted } from "@/app/ui";
import { TITULO_DA_REDE, type Rede } from "@/lib/convites";

// O CARTÃO DAS PÁGINAS DO LINK DE CONVITE (o print do Eduardo, 04/11/2026). É o invólucro da tela de entrar
// (app/entrar/page.tsx): o cartão no centro, a pastilha "M" e o título. As três páginas do convite moram nele,
// para o cliente ver o mesmo produto do painel, e não texto solto no fundo. A largura é a `max-w-md`, um
// degrau acima da `max-w-sm` da tela de entrar, por causa dos três passos de texto. O título é o da rede do
// convite (docs/specs/2026-11-06-linkedin-no-perfil.md, §3); sem a rede, é o do Instagram de sempre.
export default function CartaoDoConvite({
  subtitulo,
  rede = "instagram",
  children,
}: {
  subtitulo?: string;
  rede?: Rede;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto mt-16 max-w-md">
      <div className={`p-6 ${card}`}>
        <div className="mb-6 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-tinta text-base font-bold text-papel dark:bg-tinta-escuro dark:text-papel-escuro">
            M
          </span>
          <div>
            <h1 className="titulo text-lg font-bold leading-tight">{TITULO_DA_REDE[rede]}</h1>
            {subtitulo && <p className={`text-xs ${muted}`}>{subtitulo}</p>}
          </div>
        </div>
        <div className="space-y-4 text-sm leading-relaxed">{children}</div>
      </div>
    </div>
  );
}
