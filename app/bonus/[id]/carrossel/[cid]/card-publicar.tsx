"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { alertError, alertOk, alertWarn, btnPrimary, card, hint, input, link } from "@/app/ui";
import { faltasParaPublicar } from "@/lib/bonus/publicar-estado";
import { textoDaFalta, type AvisoDaPublicacao } from "@/lib/bonus/publicar-textos";
import type { TomDoQuadro } from "@/lib/bonus/textos";
import { publicarDaTela } from "./imagem-no-navegador";
import type { ImagemNaTela, PublicacaoNaTela } from "./publicacao-na-tela";

// O CARD "PUBLICAR" (spec da Etapa 5, "A página"), no fim da página do carrossel: a conta em que o
// post vai sair, o "Agora" ou o "Agendar", e o botão, travado com a frase de cada falta (a conta, a
// imagem dos slides com espaço, o "não salvo"). Depois de mandar, o estado lido da fila toma o lugar do
// botão, com o post no /publicar, onde se cancela ou remarca.
//
// NO SUCESSO A PÁGINA RECARREGA (`router.refresh`), ao contrário do salvar da Etapa 4 (achados 52 e
// 54): aqui é seguro, porque o botão só destrava com nenhum card "não salvo", e a página recarregada
// é a que mostra o estado e a trava.
const QUADRO: Record<TomDoQuadro, string> = { ok: alertOk, atencao: alertWarn, erro: alertError };

export default function CardPublicar({
  publicacao,
  bonusId,
  carrosselId,
  total,
  soTexto,
  imagens,
  versoesDaMiniatura,
  slidesNaoSalvos,
  legendaNaoSalva,
}: {
  publicacao: PublicacaoNaTela;
  bonusId: string;
  carrosselId: string;
  total: number;
  soTexto: number[];
  imagens: Record<number, ImagemNaTela>;
  versoesDaMiniatura: string[];
  slidesNaoSalvos: number[];
  legendaNaoSalva: boolean;
}) {
  const router = useRouter();
  const [quando, setQuando] = useState<"agora" | "depois">("agora");
  const [dataHora, setDataHora] = useState("");
  const [aviso, setAviso] = useState<AvisoDaPublicacao | null>(null);
  const [pendente, iniciar] = useTransition();
  const { estado } = publicacao;
  const faltas = faltasParaPublicar({ total, soTexto, imagens, origem: publicacao.origem, slidesNaoSalvos, legendaNaoSalva });
  const travado = pendente || faltas.length > 0 || (quando === "depois" && !dataHora);

  function publicar() {
    iniciar(async () => {
      const r = await publicarDaTela({
        bonusId,
        carrosselId,
        soTexto,
        versoesDaMiniatura,
        versoesDoTexto: publicacao.versoesDoTexto,
        quando,
        dataHora: quando === "depois" ? dataHora : "",
        assinar: publicacao.acaoDaAssinatura,
        publicar: publicacao.acaoDaPublicacao,
      });
      setAviso(r);
      if (r.tom === "ok") router.refresh();
    });
  }

  return (
    <section className={`${card} space-y-3 p-6`}>
      <h2 className="text-base font-semibold">Publicar</h2>
      {estado.texto && <p className={QUADRO[estado.tom ?? "atencao"]}>{estado.texto}</p>}
      {estado.filaId && (
        <a href={`/publicar/post/${estado.filaId}`} className={link}>
          Ver no /publicar
        </a>
      )}
      {publicacao.avisoDoCalendario && <p className={hint}>{publicacao.avisoDoCalendario}</p>}
      {estado.livre && (
        <div className="space-y-3">
          {publicacao.arroba && (
            <p className="text-sm">
              Vai sair em <strong>@{publicacao.arroba}</strong>.
            </p>
          )}
          <fieldset className="flex flex-wrap items-center gap-4 text-sm">
            <legend className="sr-only">Quando publicar</legend>
            <label className="flex items-center gap-2">
              <input type="radio" name="quando" checked={quando === "agora"} onChange={() => setQuando("agora")} />
              Agora
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="quando" checked={quando === "depois"} onChange={() => setQuando("depois")} />
              Agendar
            </label>
          </fieldset>
          {quando === "depois" && (
            <input
              type="datetime-local"
              aria-label="Data e hora"
              value={dataHora}
              onChange={(e) => setDataHora(e.target.value)}
              className={input}
            />
          )}
          {faltas.map((f) => (
            <p key={f.tipo} className={hint}>
              {textoDaFalta(f)}
            </p>
          ))}
          <button type="button" onClick={publicar} disabled={travado} className={btnPrimary}>
            {pendente ? "Publicando…" : "Publicar"}
          </button>
        </div>
      )}
      {aviso && (
        <p role="status" className={aviso.tom === "ok" ? alertOk : alertError}>
          {aviso.texto}
        </p>
      )}
    </section>
  );
}
