"use client";
import { useMemo, useState } from "react";
import { avisosDeCabimento, campoDoAviso } from "@/lib/bonus/arte-cabimento";
import type { AvisoDaArte } from "@/lib/bonus/arte-textos";
import type { CampoDoCarrossel } from "@/lib/bonus/carrossel-texto";
import type { AvisoDaRevisao } from "@/lib/bonus/carrossel-textos";
import ArteDoCarrossel from "./arte-do-carrossel";
import FormularioDaRevisao from "./formulario-da-revisao";

// O EDITOR E A ARTE DO CARROSSEL NUM COMPONENTE SÓ (spec da Etapa 3, "A prévia e o não cabe").
//
// Ele guarda o que é dos dois: o que está nos campos agora (para o "não cabe" acompanhar a
// digitação), o "só texto" de cada slide, a conta do cabeçalho e a hora da última "Revisão
// salva.". Quando a revisão salva, a versão das miniaturas muda, e elas são pedidas de novo. Nada
// disso usa redirect nem `router.refresh`: a lição dos achados 52 e 54 é que recriar a página
// apaga o que estava na tela.
export default function EditorDoCarrossel({
  acaoDaRevisao,
  acaoDaArte,
  bonusId,
  carrosselId,
  palavra,
  total,
  campos,
  valores,
  contas,
  contaInicial,
  avisoDaConta,
  soTextoInicial,
  versaoBase,
}: {
  acaoDaRevisao: (anterior: AvisoDaRevisao | null, form: FormData) => Promise<AvisoDaRevisao | null>;
  acaoDaArte: (anterior: AvisoDaArte | null, form: FormData) => Promise<AvisoDaArte | null>;
  bonusId: string;
  carrosselId: string;
  palavra: string;
  total: number;
  campos: CampoDoCarrossel[];
  valores: Record<string, string>;
  contas: { id: string; rotulo: string }[];
  contaInicial: string | null;
  avisoDaConta: string | null;
  soTextoInicial: number[];
  versaoBase: string;
}) {
  const [atuais, setAtuais] = useState(valores);
  const [soTexto, setSoTexto] = useState(soTextoInicial);
  const [conta, setConta] = useState(contaInicial);
  const [revisaoEm, setRevisaoEm] = useState(0);

  const porCampo = useMemo(() => avisosDeCabimento(total, atuais, soTexto), [total, atuais, soTexto]);
  const porSlide = useMemo(() => {
    const r: Record<number, string> = {};
    for (let n = 1; n <= total; n++) {
      const aviso = porCampo[campoDoAviso(n, total)];
      if (aviso) r[n] = aviso;
    }
    return r;
  }, [porCampo, total]);

  return (
    <div className="space-y-6">
      <ArteDoCarrossel
        acao={acaoDaArte}
        bonusId={bonusId}
        carrosselId={carrosselId}
        total={total}
        contas={contas}
        conta={conta}
        aoMudarConta={setConta}
        soTexto={soTexto}
        aoMudarSoTexto={setSoTexto}
        avisoDaConta={avisoDaConta}
        avisos={porSlide}
        versaoBase={`${versaoBase}-${revisaoEm}`}
      />
      <FormularioDaRevisao
        acao={acaoDaRevisao}
        carrosselId={carrosselId}
        palavra={palavra}
        campos={campos}
        valores={valores}
        avisosDeCabimento={porCampo}
        aoEditar={setAtuais}
        aoSalvar={setRevisaoEm}
      />
    </div>
  );
}
