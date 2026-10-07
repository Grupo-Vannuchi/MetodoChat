"use client";
import { useActionState, useEffect, useMemo, useState, useTransition, type ChangeEvent } from "react";
import { badgeWarn, btnPrimary, btnSecondary, card, hint } from "@/app/ui";
import AvisoDoFormulario from "@/app/bonus/aviso-do-formulario";
import { avisosDeCabimento, campoDoAviso } from "@/lib/bonus/arte-cabimento";
import { urlDaArte } from "@/lib/bonus/arte-tela";
import type { CampoDoCarrossel, ParteDoCarrossel } from "@/lib/bonus/carrossel-texto";
import type { AvisoDoSlide } from "@/lib/bonus/carrossel-textos";
import type { JeitoDaImagem } from "@/lib/bonus/publicar-regras";
import { TEXTO_TEXTO_MUDOU, type AvisoDaImagem } from "@/lib/bonus/publicar-textos";
import Campo from "./campo";
import type { ImagemNaTela } from "./publicacao-na-tela";

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
//
// A IMAGEM DO SLIDE (spec da Etapa 5 e o adendo de 05/10), de dois jeitos, no slide com espaço:
// - a FOTO, o jeito principal: "Subir foto" (ou "Trocar foto"), ao lado do "Baixar". Ela entra no
//   espaço da arte, e a miniatura é a própria arte da rota, com a foto;
// - o SLIDE PRONTO do Canva, embaixo: "Slide pronto do Canva" (ou "Trocar slide pronto"). Ele é o
//   slide inteiro, e a miniatura passa a ser ele. Com o texto salvo depois dele, o card avisa.
// Subir um jeito troca o outro. O "Baixar" continua baixando a arte do Chat, para levar ao Canva.
// Com o carrossel na fila ou publicado (`travado`), o card fica só para leitura: sem "Editar", sem
// upload, e o "Só texto" desligado. A trava vale no servidor; aqui ela só se mostra.
export default function CardDaParte({
  acao,
  caminho,
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
  imagem = null,
  versaoDoTexto = null,
  enviarImagem = null,
  travado = null,
  aoMudarNaoSalvo,
}: {
  acao: (anterior: AvisoDoSlide | null, form: FormData) => Promise<AvisoDoSlide | null>;
  caminho: string;
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
  /** A imagem guardada neste slide, de um dos dois jeitos (Etapa 5). */
  imagem?: ImagemNaTela | null;
  /** A versão do texto salvo deste slide, para o aviso "o texto mudou depois desta imagem". */
  versaoDoTexto?: string | null;
  /** Sobe a imagem deste slide, no jeito escolhido. Sem ela, o card não tem upload. */
  enviarImagem?: ((arquivo: File, jeito: JeitoDaImagem) => Promise<AvisoDaImagem>) | null;
  /** A frase da trava, com o carrossel na fila ou publicado. */
  travado?: string | null;
  /** Avisa o editor quando o card fica, ou deixa de ficar, "não salvo": o "Publicar" trava com ele. */
  aoMudarNaoSalvo?: (naoSalvo: boolean) => void;
}) {
  const doCard = (v: Record<string, string>) => Object.fromEntries(campos.map((c) => [c.nome, v[c.nome] ?? ""]));
  const [atuais, setAtuais] = useState(() => doCard(valores));
  const [salvos, setSalvos] = useState(() => doCard(valores));
  const [aberto, setAberto] = useState(false);
  const [versaoDoTextoSalvo, setVersaoDoTextoSalvo] = useState(versaoDoTexto);
  const [resposta, enviar, pendente] = useActionState(async (anterior: AvisoDoSlide | null, form: FormData) => {
    const r = await acao(anterior, form);
    if (r?.tom === "ok") {
      setSalvos(Object.fromEntries(campos.map((c) => [c.nome, String(form.get(c.nome) ?? "")])));
      if (r.versao) aoNovaVersao(r.versao);
      if (r.versaoDoTexto) setVersaoDoTextoSalvo(r.versaoDoTexto);
    }
    return r;
  }, null);
  const [avisoDaImagem, setAvisoDaImagem] = useState<AvisoDaImagem | null>(null);
  const [enviando, iniciarEnvio] = useTransition();
  const [jeitoEnviado, setJeitoEnviado] = useState<JeitoDaImagem | null>(null);

  const numero = parte.tipo === "slide" ? parte.numero : null;
  const naoSalvo = campos.some((c) => atuais[c.nome] !== salvos[c.nome]);
  useEffect(() => {
    aoMudarNaoSalvo?.(naoSalvo);
  }, [naoSalvo, aoMudarNaoSalvo]);
  const campoDoNaoCabe = numero ? campoDoAviso(numero, total) : null;
  const naoCabe = useMemo(
    () => (numero && campoDoNaoCabe ? avisosDeCabimento(total, atuais, soTexto ? [numero] : [])[campoDoNaoCabe] : undefined),
    [numero, campoDoNaoCabe, total, atuais, soTexto]
  );
  // Marcado "Só texto", o slide sai com a arte do Chat: a imagem guardada fica, mas não se usa.
  const comImagem = numero !== null && !soTexto ? imagem : null;
  // O aviso é só do slide pronto: com a foto no espaço, a arte se redesenha com o texto novo.
  const desatualizada = comImagem?.jeito === "slide" && versaoDoTextoSalvo !== null && comImagem.versao !== versaoDoTextoSalvo;
  const podeSubir = enviarImagem !== null && !soTexto && travado === null;

  function aoEscolherImagem(e: ChangeEvent<HTMLInputElement>, jeito: JeitoDaImagem) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo || !enviarImagem) return;
    setJeitoEnviado(jeito);
    iniciarEnvio(async () => {
      setAvisoDaImagem(await enviarImagem(arquivo, jeito));
    });
  }

  /** O botão de um jeito: o rótulo diz se o slide já tem uma imagem daquele jeito. */
  const botaoDeImagem = (jeito: JeitoDaImagem) => {
    const tem = imagem?.jeito === jeito;
    const rotulo = jeito === "foto" ? (tem ? "Trocar foto" : "Subir foto") : tem ? "Trocar slide pronto" : "Slide pronto do Canva";
    return (
      <label className={`${btnSecondary} cursor-pointer whitespace-nowrap`}>
        {enviando && jeitoEnviado === jeito ? "Subindo…" : rotulo}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-label={jeito === "foto" ? `Slide ${numero}: foto para o espaço da arte` : `Slide ${numero}: slide pronto do Canva`}
          className="sr-only"
          disabled={enviando}
          onChange={(e) => aoEscolherImagem(e, jeito)}
        />
      </label>
    );
  };

  return (
    <li className={`${card} p-4`}>
      <div className="flex flex-col gap-4 sm:flex-row">
        {numero !== null && versao !== null && (
          <div className="w-full shrink-0 space-y-2 sm:w-56">
            {/* eslint-disable-next-line @next/next/no-img-element -- a arte está atrás de sessão, e o
                otimizador de imagem do Next buscaria a URL sem o cookie: a miniatura voltaria 401. */}
            <img
              src={(comImagem?.jeito === "slide" ? comImagem.url : null) ?? urlDaArte(caminho, numero, versao)}
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
                disabled={soTextoPendente || travado !== null}
                onChange={(e) => aoMudarSoTexto(e.target.checked)}
              />
              Só texto
            </label>
            {naoCabe && <p className="text-xs font-medium text-fecha dark:text-fecha-escuro">{naoCabe}</p>}
            {/* A FOTO AO LADO DO "BAIXAR", na mesma linha (pedido do Eduardo na prova de 05/10). A
                coluna tem 224px, e os rótulos inteiros não cabiam lado a lado: o texto é curto, e o nome
                acessível do "Baixar" continua dizendo o slide. Se faltar espaço, a linha quebra. O slide
                pronto, que é o jeito de exceção, fica embaixo. */}
            <div className="flex flex-wrap gap-2">
              {podeSubir && botaoDeImagem("foto")}
              <a
                href={urlDaArte(caminho, numero, versao, true)}
                download
                aria-label={`Baixar o slide ${numero}`}
                className={`${btnSecondary} whitespace-nowrap`}
              >
                Baixar
              </a>
            </div>
            {podeSubir && <div className="flex">{botaoDeImagem("slide")}</div>}
            {desatualizada && <p className="text-xs font-medium text-fecha dark:text-fecha-escuro">{TEXTO_TEXTO_MUDOU}</p>}
            {avisoDaImagem && (
              <p
                role="status"
                className={`text-xs font-medium ${
                  avisoDaImagem.tom === "ok" ? "text-aberto dark:text-aberto-escuro" : "text-parou dark:text-parou-escuro"
                }`}
              >
                {avisoDaImagem.texto}
              </p>
            )}
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
              {travado === null && (
                <button type="button" aria-expanded={aberto} onClick={() => setAberto(!aberto)} className={btnSecondary}>
                  {aberto ? "Fechar" : "Editar"}
                </button>
              )}
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
