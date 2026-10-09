"use client";
import { useActionState, useCallback, useRef, useState, useTransition } from "react";
import { alertError, alertOk, alertWarn, btnPrimary, btnSecondary, card, hint } from "@/app/ui";
import { rotuloDaAcao, type AcaoDaChamada } from "@/lib/bonus/acao-da-chamada";
import { urlDaArte } from "@/lib/bonus/arte-tela";
import { textoDoBaixarTodos, type AvisoDaArte } from "@/lib/bonus/arte-textos";
import { camposDaParte, type CampoDoCarrossel, type ParteDoCarrossel } from "@/lib/bonus/carrossel-texto";
import type { AvisoDoSlide } from "@/lib/bonus/carrossel-textos";
import { juntarCortes, type Corte } from "@/lib/bonus/publicar-cabimento";
import type { JeitoDaImagem } from "@/lib/bonus/publicar-regras";
import type { AvisoDaImagem } from "@/lib/bonus/publicar-textos";
import { INTERVALO_CONSULTA_MS } from "@/lib/bonus/tempos";
import CardDaParte from "./card-da-parte";
import CardPublicar from "./card-publicar";
import type { GeradorDoSlide } from "./gerar-imagem";
import { enviarImagemDoSlide } from "./imagem-no-navegador";
import type { ImagemGeradaNaTela, ImagemNaTela, PublicacaoNaTela } from "./publicacao-na-tela";

// O EDITOR DO CARROSSEL, SLIDE A SLIDE (spec da Etapa 4, "A página"): a conta do carrossel, um card
// por slide (a miniatura e, ao lado, o editor dele: card-da-parte.tsx), o card da legenda, e o
// "Baixar todos". Nada disso usa redirect nem `router.refresh`: a lição dos achados 52 e 54 é que
// recriar a página apaga o que estava na tela.
//
// A CONTA NÃO SE TROCA AQUI: o carrossel é da conta em que nasceu (decisão do Eduardo em 02/10). A
// página mostra qual é, avisa quando ela foi desconectada, e oferece "Fixar nesta conta" ao carrossel
// de antes de a conta ser gravada.
//
// O "SÓ TEXTO" se grava na hora, pela action da arte, e a resposta traz as versões das miniaturas. A
// escolha muda na tela antes da resposta, para a caixa responder ao clique; numa recusa, volta para a
// última aceita (achado 67), porque a miniatura e o "Baixar" seguem o que está gravado. O formulário é
// montado aqui e despachado numa transição, sem `<form action>` (medido no PR #5).
//
// A PUBLICAÇÃO (spec da Etapa 5) entra por `publicacao`, e sem ela a página é a da Etapa 4. As imagens
// guardadas moram aqui, de um dos dois jeitos (a foto do espaço ou o slide pronto), e cada card sobe a
// do seu slide (imagem-no-navegador.ts). Guardada a imagem, a versão da miniatura daquele slide vem
// na resposta: a foto muda a arte. Com o carrossel na fila ou publicado, a trava aparece no topo e cada
// card fica só para leitura.
//
// O CRIADOR DE IMAGEM (spec da Etapa 6) entra por `publicacao.imagemGerada`: cada card com espaço ganha o
// "Gerar imagem" (gerar-imagem.tsx). A conta do dia mora aqui, comum a todos os cards; pronta a imagem,
// ela entra como foto, e a miniatura daquele slide ganha a versão que a consulta trouxe.
//
// As actions entram por propriedade, para o teste de tela usar falsas.
export default function EditorDoCarrossel({
  acaoDoSlide,
  acaoDaArte,
  acaoDaConta,
  caminho,
  carrosselId,
  palavra,
  acaoDaChamada = null,
  total,
  campos,
  valores,
  rotuloDaConta,
  avisoDaConta,
  podeFixar,
  soTextoInicial,
  versoes: versoesIniciais,
  pausaMs = 400,
  intervaloDaConsultaMs = INTERVALO_CONSULTA_MS,
  publicacao,
}: {
  acaoDoSlide: (anterior: AvisoDoSlide | null, form: FormData) => Promise<AvisoDoSlide | null>;
  acaoDaArte: (anterior: AvisoDaArte | null, form: FormData) => Promise<AvisoDaArte | null>;
  acaoDaConta: (anterior: AvisoDaArte | null, form: FormData) => Promise<AvisoDaArte | null>;
  caminho: string;
  carrosselId: string;
  /** Nula no carrossel sem palavra-chave (spec da Etapa 8), que traz a ação em `acaoDaChamada`. */
  palavra: string | null;
  acaoDaChamada?: AcaoDaChamada | null;
  total: number;
  campos: CampoDoCarrossel[];
  valores: Record<string, string>;
  rotuloDaConta: string | null;
  avisoDaConta: string | null;
  podeFixar: boolean;
  soTextoInicial: number[];
  versoes: string[];
  pausaMs?: number;
  /** O intervalo entre as perguntas da consulta da imagem; o teste de tela usa um menor. */
  intervaloDaConsultaMs?: number;
  publicacao?: PublicacaoNaTela;
}) {
  const [versoes, setVersoes] = useState(versoesIniciais);
  const [imagens, setImagens] = useState<Record<number, ImagemNaTela>>(publicacao?.imagens ?? {});
  const [hojeDeImagens, setHojeDeImagens] = useState(publicacao?.imagemGerada?.hoje ?? 0);
  const travado = publicacao?.travado ?? null;
  // As partes "não salvas" ("slide_N" e "legenda"): o "Publicar" trava com elas, porque o que sai é o
  // texto salvo. Cada card avisa quando muda.
  const [naoSalvos, setNaoSalvos] = useState<string[]>([]);
  const marcarNaoSalvo = useCallback((chave: string, sim: boolean) => {
    setNaoSalvos((atuais) => (atuais.includes(chave) === sim ? atuais : sim ? [...atuais, chave] : atuais.filter((k) => k !== chave)));
  }, []);
  // Os slides que sairiam cortados na imagem publicada (spec da Etapa 9): o "Publicar" trava com eles.
  // Cada card avisa quando o corte do slide dele muda, como no "não salvo".
  const [cortes, setCortes] = useState<Record<number, Corte | null>>({});
  const marcarCorte = useCallback((numero: number, corte: Corte | null) => {
    setCortes((atuais) => ((atuais[numero] ?? null) === corte ? atuais : { ...atuais, [numero]: corte }));
  }, []);
  const [soTexto, setSoTexto] = useState(soTextoInicial);
  const aceito = useRef(soTextoInicial);
  const [respostaDaArte, despacharArte, artePendente] = useActionState(
    async (anterior: AvisoDaArte | null, form: FormData) => {
      const r = await acaoDaArte(anterior, form);
      if (r?.tom === "ok") {
        aceito.current = form.getAll("so_texto").map(Number);
        if (r.versoes) setVersoes(r.versoes);
      } else if (r?.tom === "erro") {
        setSoTexto(aceito.current);
      }
      return r;
    },
    null
  );
  const [, iniciar] = useTransition();
  const [respostaDaConta, fixar, contaPendente] = useActionState(acaoDaConta, null);
  const [baixando, setBaixando] = useState(false);
  const fixada = respostaDaConta?.tom === "ok";
  const slides = Array.from({ length: total }, (_, i) => i + 1);

  const camposDe = (parte: ParteDoCarrossel) => {
    const nomes = camposDaParte(total, parte);
    return campos.filter((c) => nomes.includes(c.nome));
  };

  function mudarSoTexto(numero: number, marcado: boolean) {
    const novo = marcado ? [...soTexto, numero].sort((a, b) => a - b) : soTexto.filter((n) => n !== numero);
    setSoTexto(novo);
    const form = new FormData();
    form.set("id", carrosselId);
    for (const n of novo) form.append("so_texto", String(n));
    iniciar(() => despacharArte(form));
  }

  /**
   * Sobe a imagem de um slide, no jeito escolhido. Guardada, ela entra no card com o jeito que o
   * servidor leu do caminho, e a miniatura daquele slide ganha a versão nova.
   */
  async function enviarImagem(p: PublicacaoNaTela, numero: number, arquivo: File, jeito: JeitoDaImagem): Promise<AvisoDaImagem> {
    const r = await enviarImagemDoSlide({ carrosselId, numero, jeito, arquivo, assinar: p.acaoDaAssinatura, guardar: p.acaoDaImagem });
    const { versao, versaoDaMiniatura } = r;
    if (r.tom === "ok" && versao) {
      setImagens((atuais) => ({ ...atuais, [numero]: { url: r.imagem ?? null, versao, jeito: r.jeito ?? jeito } }));
      if (versaoDaMiniatura) setVersoes((vs) => vs.map((x, i) => (i === numero - 1 ? versaoDaMiniatura : x)));
    }
    return r;
  }

  /**
   * O gerador de imagem de um slide (Etapa 6): a action do pedido, a conta do dia, a última descrição e
   * a geração em andamento. Pronta a imagem, ela entra como foto, e a miniatura ganha a versão nova.
   */
  function geradorDoSlide(g: ImagemGeradaNaTela, numero: number): GeradorDoSlide {
    return {
      acao: g.acaoDoPedido,
      hoje: hojeDeImagens,
      aoMudarHoje: setHojeDeImagens,
      descricaoInicial: g.descricoes[numero] ?? null,
      gerandoInicial: g.gerando.includes(numero),
      aoPronta: ({ versao, versaoDaMiniatura }) => {
        setImagens((atuais) => ({ ...atuais, [numero]: { url: null, versao: versao ?? "", jeito: "foto" } }));
        setVersoes((vs) => vs.map((x, i) => (i === numero - 1 ? versaoDaMiniatura : x)));
      },
      intervaloMs: intervaloDaConsultaMs,
    };
  }

  async function baixarTodos() {
    setBaixando(true);
    for (const n of slides) {
      const a = document.createElement("a");
      a.href = urlDaArte(caminho, n, versoes[n - 1], true);
      a.setAttribute("download", "");
      document.body.appendChild(a);
      a.click();
      a.remove();
      if (n < total) await new Promise((pronto) => setTimeout(pronto, pausaMs));
    }
    setBaixando(false);
  }

  return (
    <div className="space-y-6">
      <section className={`${card} space-y-4 p-6`}>
        <h2 className="text-base font-semibold">Arte e texto dos slides</h2>
        {travado && (
          <p role="status" className={alertWarn}>
            {travado}
          </p>
        )}
        <div>
          <p className="text-sm">
            Conta do carrossel: <strong>{rotuloDaConta ?? "nenhuma conta conectada"}</strong>
          </p>
          {avisoDaConta && !fixada && <p className={hint}>{avisoDaConta}</p>}
          {podeFixar && !fixada && (
            <button
              type="button"
              disabled={contaPendente}
              onClick={() => {
                const form = new FormData();
                form.set("id", carrosselId);
                iniciar(() => fixar(form));
              }}
              className={`${btnSecondary} mt-2`}
            >
              Fixar nesta conta
            </button>
          )}
          {respostaDaConta && (
            <p role="status" className={`${respostaDaConta.tom === "ok" ? alertOk : alertError} mt-2`}>
              {respostaDaConta.texto}
            </p>
          )}
        </div>
        {palavra !== null ? (
          <p className={hint}>
            A chamada pede a palavra <strong>{palavra}</strong>. Ela vem do bônus e não se edita aqui.
          </p>
        ) : (
          <p className={hint}>
            Este carrossel não tem palavra-chave: a chamada pede{" "}
            <strong>{acaoDaChamada ? rotuloDaAcao(acaoDaChamada).toLowerCase() : "outra ação"}</strong>, e não pode ter
            palavra em maiúsculas.
          </p>
        )}

        <ul className="space-y-4">
          {slides.map((n) => (
            <CardDaParte
              key={n}
              acao={acaoDoSlide}
              caminho={caminho}
              carrosselId={carrosselId}
              palavra={palavra}
              total={total}
              parte={{ tipo: "slide", numero: n }}
              campos={camposDe({ tipo: "slide", numero: n })}
              valores={valores}
              versao={versoes[n - 1]}
              aoNovaVersao={(v) => setVersoes((vs) => vs.map((x, i) => (i === n - 1 ? v : x)))}
              soTexto={soTexto.includes(n)}
              aoMudarSoTexto={(marcado) => mudarSoTexto(n, marcado)}
              soTextoPendente={artePendente}
              imagem={imagens[n] ?? null}
              versaoDoTexto={publicacao?.versoesDoTexto[n - 1] ?? null}
              enviarImagem={publicacao ? (arquivo, jeito) => enviarImagem(publicacao, n, arquivo, jeito) : null}
              travado={travado}
              aoMudarNaoSalvo={(sim) => marcarNaoSalvo(`slide_${n}`, sim)}
              aoMudarCorte={(corte) => marcarCorte(n, corte)}
              gerarImagem={publicacao?.imagemGerada ? geradorDoSlide(publicacao.imagemGerada, n) : null}
            />
          ))}
          <CardDaParte
            acao={acaoDoSlide}
            caminho={caminho}
            carrosselId={carrosselId}
            palavra={palavra}
            total={total}
            parte={{ tipo: "legenda" }}
            campos={camposDe({ tipo: "legenda" })}
            valores={valores}
            versao={null}
            aoNovaVersao={() => {}}
            soTexto={false}
            aoMudarSoTexto={() => {}}
            soTextoPendente={false}
            travado={travado}
            aoMudarNaoSalvo={(sim) => marcarNaoSalvo("legenda", sim)}
          />
        </ul>

        {respostaDaArte?.tom === "erro" && (
          <p role="status" className={alertError}>
            {respostaDaArte.texto}
          </p>
        )}

        <div className="space-y-2">
          <p className={hint}>{textoDoBaixarTodos(total)}</p>
          <button type="button" onClick={baixarTodos} disabled={baixando} className={btnPrimary}>
            Baixar todos
          </button>
        </div>
      </section>
      {publicacao && (
        <CardPublicar
          publicacao={publicacao}
          caminho={caminho}
          carrosselId={carrosselId}
          total={total}
          soTexto={soTexto}
          imagens={imagens}
          versoesDaMiniatura={versoes}
          slidesNaoSalvos={naoSalvos.filter((k) => k.startsWith("slide_")).map((k) => Number(k.slice("slide_".length)))}
          legendaNaoSalva={naoSalvos.includes("legenda")}
          cortados={juntarCortes(cortes)}
        />
      )}
    </div>
  );
}
