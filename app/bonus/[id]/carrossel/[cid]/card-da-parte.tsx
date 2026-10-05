"use client";
import { useActionState, useMemo, useState } from "react";
import { badgeWarn, btnPrimary, btnSecondary, card, hint } from "@/app/ui";
import AvisoDoFormulario from "@/app/bonus/aviso-do-formulario";
import { avisosDeCabimento, campoDoAviso } from "@/lib/bonus/arte-cabimento";
import { urlDaArte } from "@/lib/bonus/arte-tela";
import type { CampoDoCarrossel, ParteDoCarrossel } from "@/lib/bonus/carrossel-texto";
import type { AvisoDoSlide } from "@/lib/bonus/carrossel-textos";
import Campo from "./campo";

// O CARD DE UMA PARTE DO CARROSSEL (spec da Etapa 4, "Um card por slide"): a miniatura do slide, o
// "Só texto" e o "Baixar" à esquerda, e ao lado o editor daquele slide, que abre no "Editar" e grava
// só ele no "Salvar slide N". A legenda tem um card igual, sem miniatura.
//
// A RESPOSTA VOLTA COMO ESTADO DO CARD (useActionState), E NUNCA POR REDIRECT (achado 52): numa
// recusa a edição fica, e o motivo aparece junto do botão. Salvo, a miniatura troca pela versão que
// a action devolve, e só ela é pedida de novo. Os campos são controlados (campo.tsx), e ficam
// montados com o card fechado: fechar não apaga o que se digitou.
//
// "NÃO SALVO" compara o que está nos campos com o que foi gravado por último neste card: sair da
// página perde o que não foi salvo. O "não cabe" é a conta da arte sobre o que está nos campos agora
// (arte-cabimento.ts), junto do campo e embaixo da miniatura.
//
// A versão da miniatura e o "só texto" moram no pai (editor-do-carrossel.tsx): o "só texto" se grava
// por outra action, que devolve as versões, e o "Baixar todos" precisa das versões de todos.
export default function CardDaParte({
  acao,
  bonusId,
  carrosselId,
  palavra,
  total,
  parte,
  campos,
  valores,
  versao,
  aoNovaVersao,
  soTexto,
  aoMudarSoTexto,
  soTextoPendente,
}: {
  acao: (anterior: AvisoDoSlide | null, form: FormData) => Promise<AvisoDoSlide | null>;
  bonusId: string;
  carrosselId: string;
  palavra: string;
  total: number;
  parte: ParteDoCarrossel;
  campos: CampoDoCarrossel[];
  valores: Record<string, string>;
  /** A versão da miniatura; null na legenda, que não tem. */
  versao: string | null;
  aoNovaVersao: (versao: string) => void;
  soTexto: boolean;
  aoMudarSoTexto: (marcado: boolean) => void;
  soTextoPendente: boolean;
}) {
  const doCard = (v: Record<string, string>) => Object.fromEntries(campos.map((c) => [c.nome, v[c.nome] ?? ""]));
  const [atuais, setAtuais] = useState(() => doCard(valores));
  const [salvos, setSalvos] = useState(() => doCard(valores));
  const [aberto, setAberto] = useState(false);
  const [resposta, enviar, pendente] = useActionState(async (anterior: AvisoDoSlide | null, form: FormData) => {
    const r = await acao(anterior, form);
    if (r?.tom === "ok") {
      setSalvos(Object.fromEntries(campos.map((c) => [c.nome, String(form.get(c.nome) ?? "")])));
      if (r.versao) aoNovaVersao(r.versao);
    }
    return r;
  }, null);

  const numero = parte.tipo === "slide" ? parte.numero : null;
  const naoSalvo = campos.some((c) => atuais[c.nome] !== salvos[c.nome]);
  const campoDoNaoCabe = numero ? campoDoAviso(numero, total) : null;
  const naoCabe = useMemo(
    () => (numero && campoDoNaoCabe ? avisosDeCabimento(total, atuais, soTexto ? [numero] : [])[campoDoNaoCabe] : undefined),
    [numero, campoDoNaoCabe, total, atuais, soTexto]
  );

  return (
    <li className={`${card} p-4`}>
      <div className="flex flex-col gap-4 sm:flex-row">
        {numero !== null && versao !== null && (
          <div className="w-full shrink-0 space-y-2 sm:w-56">
            {/* eslint-disable-next-line @next/next/no-img-element -- a arte está atrás de sessão, e o
                otimizador de imagem do Next buscaria a URL sem o cookie: a miniatura voltaria 401. */}
            <img
              src={urlDaArte(bonusId, carrosselId, numero, versao)}
              alt={`Slide ${numero} de ${total}`}
              width={216}
              height={270}
              className="w-full rounded-lg border border-traco dark:border-traco-escuro"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                aria-label={`Slide ${numero}: só texto, sem o espaço da imagem`}
                checked={soTexto}
                disabled={soTextoPendente}
                onChange={(e) => aoMudarSoTexto(e.target.checked)}
              />
              Só texto
            </label>
            {naoCabe && <p className="text-xs font-medium text-fecha dark:text-fecha-escuro">{naoCabe}</p>}
            <a href={urlDaArte(bonusId, carrosselId, numero, versao, true)} download className={btnSecondary}>
              Baixar o slide {numero}
            </a>
          </div>
        )}
        <form
          action={enviar}
          onInput={(e) => {
            const dados = new FormData(e.currentTarget);
            setAtuais(Object.fromEntries(campos.map((c) => [c.nome, String(dados.get(c.nome) ?? "")])));
          }}
          className="min-w-0 flex-1 space-y-3"
        >
          <input type="hidden" name="id" value={carrosselId} />
          <input type="hidden" name="parte" value={numero !== null ? `slide_${numero}` : "legenda"} />
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">{numero !== null ? `Slide ${numero}` : "Legenda"}</h3>
            <div className="flex items-center gap-2">
              {naoSalvo && <span className={badgeWarn}>não salvo</span>}
              <button type="button" aria-expanded={aberto} onClick={() => setAberto(!aberto)} className={btnSecondary}>
                {aberto ? "Fechar" : "Editar"}
              </button>
            </div>
          </div>
          {!aberto && <p className={`${hint} whitespace-pre-line`}>{campos.map((c) => atuais[c.nome]).join("\n")}</p>}
          <div hidden={!aberto} className="space-y-3">
            {campos.map((c) => (
              <Campo
                key={c.nome}
                nome={c.nome}
                rotulo={c.rotulo}
                valorInicial={valores[c.nome] ?? ""}
                max={c.max}
                linhas={c.linhas}
                palavra={c.pedePalavra ? palavra : undefined}
                soAPalavra={c.soAPalavra}
                avisoDeCabimento={c.nome === campoDoNaoCabe ? naoCabe : undefined}
              />
            ))}
            {resposta && <AvisoDoFormulario key={resposta.em} aviso={resposta} />}
            <button type="submit" disabled={pendente} className={btnPrimary}>
              {numero !== null ? `Salvar slide ${numero}` : "Salvar legenda"}
            </button>
          </div>
        </form>
      </div>
    </li>
  );
}
