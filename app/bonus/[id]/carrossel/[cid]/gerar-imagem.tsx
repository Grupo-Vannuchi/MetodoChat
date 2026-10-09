"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { btnPrimary, btnSecondary, hint, input } from "@/app/ui";
import type { ConsultaDaImagem } from "@/lib/bonus/imagem-consulta";
import { TETO_IMAGEM_DIARIO, urlDaConsultaDaImagem } from "@/lib/bonus/imagem-regras";
import {
  TEXTO_GERANDO_A_IMAGEM,
  TEXTO_IMAGEM_FALHOU_SEM_MOTIVO,
  TEXTO_IMAGEM_GERADA,
  TEXTO_REGRAS_DA_IMAGEM,
  textoDaRecusaDaImagem,
  textoDoAvisoDeTexto,
  textoDoContador,
  type AvisoDoPedidoDeImagem,
} from "@/lib/bonus/imagem-textos";
import { ATALHOS, ESTILOS, comEstilo, separarEstiloDaDescricao, type ChaveDoEstilo } from "@/lib/bonus/prompt-ilustracao";

// O "GERAR IMAGEM" DE UM SLIDE (spec da Etapa 6, "A tela" e "Pedir e acompanhar"), na linha dos botões da
// imagem do card, ao lado do "Subir foto" e do "Slide pronto do Canva".
//
// O botão abre o campo da cena, com a escolha do estilo (adendo de 09/10), os cinco atalhos, a regra do
// manual do perfil, o aviso de texto e o contador do dia. O estilo vai para o começo da descrição
// (`comEstilo`), e o "Gerar de novo" o lê de volta (`separarEstiloDaDescricao`). O "Gerar" chama a action do pedido, que confere, reserva e VOLTA NA HORA (achado 88):
// a imagem é gerada no servidor, e este componente pergunta pela rota GET da consulta, uma pergunta de cada
// vez, até ela ficar pronta ou falhar. Enquanto isso, o resto da página funciona. A página que abre com uma
// geração em andamento começa aqui em "Gerando…" e acompanha.

/** O que o editor entrega a cada card para gerar a imagem do slide dele. */
export type GeradorDoSlide = {
  acao: (pedido: unknown) => Promise<AvisoDoPedidoDeImagem>;
  /** A conta das últimas 24 horas, comum a todos os cards. */
  hoje: number;
  aoMudarHoje: (hoje: number) => void;
  /** A última descrição deste slide, com o estilo no começo, para o "Gerar de novo". */
  descricaoInicial: string | null;
  /** Uma geração deste slide estava em andamento quando a página abriu. */
  gerandoInicial: boolean;
  /** A imagem ficou pronta: o editor guarda a foto e troca a versão da miniatura. */
  aoPronta: (r: { versao: string | null; versaoDaMiniatura: string }) => void;
  /** O intervalo entre as perguntas (`INTERVALO_CONSULTA_MS`; o teste usa um menor). */
  intervaloMs: number;
};

type AvisoNaTela = { tom: "ok" | "atencao" | "erro"; texto: string };

const COR: Record<AvisoNaTela["tom"], string> = {
  ok: "text-aberto dark:text-aberto-escuro",
  atencao: "text-fecha dark:text-fecha-escuro",
  erro: "text-parou dark:text-parou-escuro",
};

export default function GerarImagem({
  caminho,
  carrosselId,
  numero,
  gerador,
  aoMudarGerando,
}: {
  caminho: string;
  carrosselId: string;
  numero: number;
  gerador: GeradorDoSlide;
  /** Avisa o card quando a geração começa ou termina: os outros botões da imagem ficam desligados. */
  aoMudarGerando: (gerando: boolean) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [inicial] = useState(() => separarEstiloDaDescricao(gerador.descricaoInicial ?? ""));
  const [estilo, setEstilo] = useState<ChaveDoEstilo>(inicial.estilo);
  const [descricao, setDescricao] = useState(inicial.resto);
  const [jaPediu, setJaPediu] = useState(gerador.descricaoInicial !== null);
  const [gerando, setGerando] = useState(gerador.gerandoInicial);
  const [aviso, setAviso] = useState<AvisoNaTela | null>(gerador.gerandoInicial ? { tom: "atencao", texto: TEXTO_GERANDO_A_IMAGEM } : null);
  const [rodada, setRodada] = useState(0);
  const [pendente, iniciar] = useTransition();
  // As funções do editor mudam a cada desenho; a consulta usa sempre as de agora.
  const doEditor = useRef(gerador);
  useEffect(() => {
    doEditor.current = gerador;
  });

  const ocupado = gerando || pendente;
  useEffect(() => {
    aoMudarGerando(ocupado);
  }, [ocupado, aoMudarGerando]);

  // A CONSULTA, uma pergunta de cada vez: a próxima só é marcada depois de a anterior responder.
  useEffect(() => {
    if (!gerando) return;
    let vivo = true;
    const relogio = setTimeout(async () => {
      try {
        const resposta = await fetch(urlDaConsultaDaImagem(caminho, numero), { cache: "no-store" });
        const corpo = (await resposta.json()) as ConsultaDaImagem | { erro?: string };
        if (!vivo) return;
        if (!resposta.ok || !("estado" in corpo)) {
          setGerando(false);
          setAviso({ tom: "erro", texto: ("erro" in corpo && corpo.erro) || TEXTO_IMAGEM_FALHOU_SEM_MOTIVO });
          return;
        }
        doEditor.current.aoMudarHoje(corpo.hoje);
        if (corpo.estado === "pronta") {
          doEditor.current.aoPronta({ versao: corpo.versao, versaoDaMiniatura: corpo.versaoDaMiniatura });
          setGerando(false);
          setAviso({ tom: "ok", texto: TEXTO_IMAGEM_GERADA });
          return;
        }
        if (corpo.estado === "falhou") {
          setGerando(false);
          setAviso({ tom: "erro", texto: corpo.texto });
          return;
        }
        if (corpo.estado === "nenhuma") {
          setGerando(false);
          setAviso(null);
          return;
        }
      } catch {
        // A rede caiu nesta pergunta: a próxima tenta de novo.
      }
      if (vivo) setRodada((r) => r + 1);
    }, gerador.intervaloMs);
    return () => {
      vivo = false;
      clearTimeout(relogio);
    };
  }, [gerando, rodada, caminho, numero, gerador.intervaloMs]);

  const avisoDeTexto = textoDoAvisoDeTexto(descricao);
  const noTeto = gerador.hoje >= TETO_IMAGEM_DIARIO;

  function pedir() {
    iniciar(async () => {
      const r = await gerador.acao({ id: carrosselId, numero, descricao: comEstilo(estilo, descricao) });
      if (r.hoje !== undefined) gerador.aoMudarHoje(r.hoje);
      if (r.tom !== "ok") {
        setAviso({ tom: "erro", texto: r.texto });
        return;
      }
      setJaPediu(true);
      setAviso({ tom: "atencao", texto: r.texto });
      setGerando(true);
    });
  }

  return (
    <>
      <button type="button" aria-expanded={aberto} onClick={() => setAberto(!aberto)} className={`${btnSecondary} whitespace-nowrap`}>
        {jaPediu ? "Gerar de novo" : "Gerar imagem"}
      </button>
      {(aberto || aviso) && (
        <div className="order-last basis-full space-y-2">
          {aberto && (
            <div className="space-y-2">
              <fieldset className="space-y-1">
                <legend className="text-sm font-medium">Estilo</legend>
                {ESTILOS.map((e) => (
                  <label key={e.chave} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={`estilo-do-slide-${numero}`}
                      value={e.chave}
                      checked={estilo === e.chave}
                      onChange={() => setEstilo(e.chave)}
                    />
                    <span>
                      {e.rotulo}: {e.resumo}
                    </span>
                  </label>
                ))}
              </fieldset>
              <p className="text-sm font-medium">Descreva a cena</p>
              <textarea
                aria-label={`Slide ${numero}: descreva a cena`}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={3}
                className={input}
              />
              {/* Os atalhos em linhas, e não numa lista: os cards já são os itens da lista da página. */}
              <div className={`${hint} space-y-0.5`}>
                {ATALHOS.map((e) => (
                  <p key={e.chave}>
                    <code>{`/${e.chave}`}</code> {e.rotulo}: {e.resumo}
                  </p>
                ))}
              </div>
              <p className={hint}>{TEXTO_REGRAS_DA_IMAGEM}</p>
              {avisoDeTexto && <p className="text-xs font-medium text-fecha dark:text-fecha-escuro">{avisoDeTexto}</p>}
              <p className={hint}>{textoDoContador(gerador.hoje)}</p>
              {noTeto && <p className="text-xs font-medium text-parou dark:text-parou-escuro">{textoDaRecusaDaImagem({ motivo: "teto" })}</p>}
              <button type="button" onClick={pedir} disabled={ocupado || noTeto} className={btnPrimary}>
                Gerar
              </button>
            </div>
          )}
          {aviso && (
            <p role="status" className={`text-xs font-medium ${COR[aviso.tom]}`}>
              {aviso.texto}
            </p>
          )}
        </div>
      )}
    </>
  );
}
