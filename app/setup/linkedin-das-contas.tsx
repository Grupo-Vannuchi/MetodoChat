"use client";
import { useActionState, useState } from "react";
import CopyField from "./copy-field";
import { desconectarLinkedin, gerarConviteDoLinkedin } from "./actions";
import type { EstadoDoGerar } from "@/lib/convites";
import { alertError, btnPrimary, btnSecondary, muted } from "../ui";

// O LINKEDIN DAS CONTAS NA CONFIGURAÇÃO (docs/specs/2026-11-06-linkedin-no-perfil.md, §7; a parte 1, a
// conexão). Cada conta do painel pode ter o LinkedIn pessoal do dono, conectado por ele mesmo pelo link de
// convite. A página (./page.tsx) manda só o nome e o vencimento já decidido (`vencimentoDoLinkedin`), e NUNCA a
// autorização: tests/linkedin-token-fora-do-cliente.test.ts prende isso.

export type LinhaDoLinkedin = {
  contaId: string;
  arroba: string;
  conexao: { nome: string; estado: "valido" | "perto" | "vencido"; frase: string } | null;
};

function LinhaDaConta({ linha, chavesOk }: { linha: LinhaDoLinkedin; chavesOk: boolean }) {
  const [estado, gerar, gerando] = useActionState<EstadoDoGerar, FormData>(gerarConviteDoLinkedin, null);
  const [confirmando, setConfirmando] = useState(false);
  const c = linha.conexao;

  return (
    <li className="space-y-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
      <p>
        <b>{linha.arroba}</b>
      </p>
      {!c ? (
        <p className={muted}>Sem LinkedIn.</p>
      ) : c.estado === "vencido" ? (
        <p>
          O LinkedIn de <b>{c.nome}</b> venceu. Mande um convite novo.
        </p>
      ) : (
        <>
          <p>
            LinkedIn conectado como <b>{c.nome}</b>, {c.frase}.
          </p>
          {c.estado === "perto" && <p className={`text-xs ${muted}`}>Falta pouco para vencer: mande um convite novo.</p>}
        </>
      )}
      <div className="flex flex-wrap gap-2">
        <form action={gerar}>
          <input type="hidden" name="conta" value={linha.contaId} />
          <button type="submit" disabled={!chavesOk || gerando} className={btnPrimary}>
            Convidar a conectar o LinkedIn
          </button>
        </form>
        {c && !confirmando && (
          <button type="button" onClick={() => setConfirmando(true)} className={btnSecondary}>
            Desconectar
          </button>
        )}
      </div>
      {c && confirmando && (
        // O QUE O DESCONECTAR FAZ, E O QUE ELE NÃO FAZ (achado 206): o LinkedIn não tem como revogar a autorização
        // de fora, então ela vence sozinha lá. A frase vem antes do botão que apaga.
        <div className="space-y-2 rounded-lg border border-zinc-200 p-2 dark:border-zinc-800">
          <p className="text-xs">
            O painel apaga a autorização do LinkedIn de {c.nome} e para de usá-la. No LinkedIn, ela vence sozinha em até
            60 dias.
          </p>
          <div className="flex gap-2">
            <form action={desconectarLinkedin}>
              <input type="hidden" name="conta" value={linha.contaId} />
              <button type="submit" className={btnPrimary}>
                Sim, desconectar
              </button>
            </form>
            <button type="button" onClick={() => setConfirmando(false)} className={btnSecondary}>
              Cancelar
            </button>
          </div>
        </div>
      )}
      {estado && "erro" in estado && (
        <p role="alert" className={alertError}>
          {estado.erro}
        </p>
      )}
      {estado && "link" in estado && (
        <div className="space-y-1">
          <CopyField label={`Link de convite do LinkedIn para ${estado.paraQuem}`} value={estado.link} />
          <p className={`text-xs ${muted}`}>Este link aparece só agora. Se ele se perder, gere outro.</p>
        </div>
      )}
    </li>
  );
}

export default function LinkedinDasContas({ linhas, chavesOk }: { linhas: LinhaDoLinkedin[]; chavesOk: boolean }) {
  return (
    <div className="space-y-3">
      <p className={`text-xs ${muted}`}>
        Cada conta pode ter o LinkedIn pessoal do dono, para publicar nele. Quem conecta é o próprio dono do perfil,
        pelo link de convite, com o login dele. A autorização vale 60 dias; para renovar, mande um convite novo.
      </p>
      {!chavesOk && (
        <p role="status" className={alertError}>
          O LinkedIn está desligado: faltam as chaves do app do LinkedIn (LINKEDIN_CLIENT_ID e LINKEDIN_CLIENT_SECRET)
          nas variáveis da Vercel.
        </p>
      )}
      <ul className="space-y-2">
        {linhas.map((l) => (
          <LinhaDaConta key={l.contaId} linha={l} chavesOk={chavesOk} />
        ))}
      </ul>
    </div>
  );
}
