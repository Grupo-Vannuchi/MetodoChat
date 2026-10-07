"use client";
import { useActionState, useMemo, useState, useTransition } from "react";
import { alertWarn, btnPrimary, btnSecondary, hint, input, label } from "@/app/ui";
import AvisoDoFormulario from "@/app/bonus/aviso-do-formulario";
import Campo from "@/app/bonus/[id]/carrossel/[cid]/campo";
import { CONTEUDO_MAX, DESTAQUE_MAX, type JeitoDoTexto } from "@/lib/bonus/avulso-pedido";
import type { AvisoDoAvulso } from "@/lib/bonus/avulso-textos";
import { SLIDES_MAX, SLIDES_MIN, SLIDES_PADRAO, TETO_CARROSSEL_DIARIO } from "@/lib/bonus/carrossel-pedido";
import { camposDoFormulario } from "@/lib/bonus/carrossel-texto";
import { PALAVRA_MAX, TEMA_MAX, normalizarPalavra } from "@/lib/bonus/pedido";
import type { BonusDoLabs } from "@/lib/bonus/publicado";

// O "NOVO CARROSSEL" (spec da Etapa 7): de um bônus que já está no Labs, ou de um texto livre; a IA
// escreve, ou o operador escreve à mão. Do bônus do Labs, o formulário só manda o código: a palavra e
// o contexto o servidor lê de lá (app/carrosseis/actions.ts).
//
// "ESCREVER À MÃO" mostra os campos do carrossel para o número de slides escolhido, os mesmos da
// página do carrossel (`camposDoFormulario` e campo.tsx), com o aviso da palavra na hora. A conferência
// de verdade é a do servidor, o carrossel inteiro de uma vez.
//
// ⚠️ SEM `<form action>`, E É DE PROPÓSITO, como o pedido de carrossel de bônus
// (app/bonus/[id]/pedido-de-carrossel.tsx): com `action`, o React 19 reinicia o formulário depois da
// action, e o `<select>` controlado volta para a opção do HTML do servidor. A recusa volta como estado
// (achado 52), e o que se escreveu fica na tela. A action entra por propriedade, para o teste de tela
// usar uma falsa.

/** A busca pelo título, sem acento e sem diferença de maiúscula. */
function semAcento(t: string): string {
  return t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

export default function FormularioDoAvulso({
  acao,
  bonus,
  falhaDaLista,
  restam,
}: {
  acao: (anterior: AvisoDoAvulso | null, form: FormData) => Promise<AvisoDoAvulso | null>;
  /** Os bônus do Labs que o Chat consegue usar (`listaDoLabs`), do mais novo para o mais velho. */
  bonus: BonusDoLabs[];
  /** A frase da falha da leitura do Labs; null quando a lista veio. */
  falhaDaLista: string | null;
  restam: number;
}) {
  // `pendente` desliga os botões enquanto o pedido roda: um clique duplo criaria dois carrosséis.
  const [resposta, enviar, pendente] = useActionState(acao, null);
  const [, iniciar] = useTransition();
  const [origem, setOrigem] = useState<"labs" | "livre">("labs");
  const [jeito, setJeito] = useState<JeitoDoTexto>("ia");
  const [busca, setBusca] = useState("");
  const [codigo, setCodigo] = useState("");
  const [destaque, setDestaque] = useState("");
  const [tema, setTema] = useState("");
  const [palavra, setPalavra] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [total, setTotal] = useState(String(SLIDES_PADRAO));

  const escolhido = bonus.find((b) => b.codigo === codigo) ?? null;
  // O escolhido fica na lista mesmo fora da busca: um `<select>` com o valor fora das opções mostraria
  // outro bônus do que o que vai.
  const filtrados = useMemo(() => {
    const q = semAcento(busca.trim());
    return bonus.filter((b) => b === escolhido || !q || semAcento(b.titulo).includes(q));
  }, [bonus, busca, escolhido]);
  const palavraDoPost = origem === "labs" ? (escolhido?.palavra ?? "") : normalizarPalavra(palavra);
  const semLista = origem === "labs" && falhaDaLista !== null;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const dados = new FormData(e.currentTarget);
        iniciar(() => enviar(dados));
      }}
      className="space-y-5"
    >
      <input type="hidden" name="jeito" value={jeito} />
      <fieldset className="space-y-2">
        <legend className={label}>De onde vem o carrossel</legend>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" name="origem" value="labs" checked={origem === "labs"} onChange={() => setOrigem("labs")} />
            De um bônus do Labs
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="origem" value="livre" checked={origem === "livre"} onChange={() => setOrigem("livre")} />
            De um texto livre
          </label>
        </div>
      </fieldset>

      {origem === "labs" &&
        (falhaDaLista !== null ? (
          <p className={alertWarn}>{falhaDaLista}</p>
        ) : (
          <div className="space-y-4">
            <div>
              <label htmlFor="busca" className={label}>
                Buscar pelo título
              </label>
              <input id="busca" type="search" value={busca} onChange={(e) => setBusca(e.target.value)} className={input} />
            </div>
            <div>
              <label htmlFor="codigo" className={label}>
                Bônus do Labs
              </label>
              <select id="codigo" name="codigo" value={codigo} onChange={(e) => setCodigo(e.target.value)} className={input}>
                <option value="">Escolha um bônus</option>
                {filtrados.map((b) => (
                  <option key={b.codigo} value={b.codigo}>
                    {b.titulo}
                  </option>
                ))}
              </select>
              {escolhido && (
                <p className={hint}>
                  Palavra {escolhido.palavra} · {escolhido.tema}
                </p>
              )}
              {bonus.length === 0 && <p className={hint}>Nenhum bônus publicado no Labs com palavra-chave e tema.</p>}
            </div>
            <div>
              <label htmlFor="destaque" className={label}>
                O que destacar (opcional)
              </label>
              <textarea
                id="destaque"
                name="destaque"
                value={destaque}
                maxLength={DESTAQUE_MAX}
                rows={3}
                onChange={(e) => setDestaque(e.target.value)}
                className={input}
              />
              <p className={hint}>Vai para a IA no lugar do que o bônus resolve. Vazio, ela parte da descrição do bônus.</p>
            </div>
          </div>
        ))}

      {origem === "livre" && (
        <div className="space-y-4">
          <div>
            <label htmlFor="tema" className={label}>
              Tema
            </label>
            <input id="tema" name="tema" value={tema} maxLength={TEMA_MAX} onChange={(e) => setTema(e.target.value)} className={input} />
          </div>
          <div>
            <label htmlFor="palavra" className={label}>
              Palavra-chave
            </label>
            <input
              id="palavra"
              name="palavra"
              value={palavra}
              maxLength={PALAVRA_MAX}
              onChange={(e) => setPalavra(e.target.value)}
              className={input}
            />
            <p className={hint}>A palavra que a pessoa comenta para receber. Uma palavra só, com letras e números.</p>
          </div>
          <div>
            <label htmlFor="conteudo" className={label}>
              Conteúdo
            </label>
            <textarea
              id="conteudo"
              name="conteudo"
              value={conteudo}
              maxLength={CONTEUDO_MAX}
              rows={8}
              onChange={(e) => setConteudo(e.target.value)}
              className={input}
            />
            <p className={hint}>O que o post divulga, escrito ou colado do Notion.</p>
          </div>
        </div>
      )}

      <div>
        <label htmlFor="total" className={label}>
          Quantos slides?
        </label>
        <select id="total" name="total" value={total} onChange={(e) => setTotal(e.target.value)} className={input}>
          {Array.from({ length: SLIDES_MAX - SLIDES_MIN + 1 }, (_, i) => SLIDES_MIN + i).map((n) => (
            <option key={n} value={n}>
              {n === 1 ? "1 (post de imagem única)" : `${n} slides`}
            </option>
          ))}
        </select>
      </div>

      {jeito === "mao" && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">O texto do carrossel</h3>
          {camposDoFormulario(Number(total)).map((c) => (
            <Campo
              key={c.nome}
              nome={c.nome}
              rotulo={c.rotulo}
              valorInicial=""
              max={c.max}
              linhas={c.linhas}
              palavra={c.pedePalavra && palavraDoPost ? palavraDoPost : undefined}
              soAPalavra={c.soAPalavra}
            />
          ))}
        </div>
      )}

      {resposta && <AvisoDoFormulario key={resposta.em} aviso={resposta} />}

      {jeito === "ia" ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={btnPrimary} disabled={pendente || restam === 0 || semLista}>
              Gerar com a IA
            </button>
            <button type="button" className={btnSecondary} disabled={semLista} onClick={() => setJeito("mao")}>
              Escrever à mão
            </button>
          </div>
          <p className={hint}>
            Restam {restam} de {TETO_CARROSSEL_DIARIO} gerações de carrossel nas últimas 24 horas.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={btnPrimary} disabled={pendente || semLista}>
              Criar com este texto
            </button>
            <button type="button" className={btnSecondary} onClick={() => setJeito("ia")}>
              Voltar para a IA
            </button>
          </div>
          <p className={hint}>Escrito à mão, o carrossel não gasta IA nem conta no limite do dia.</p>
        </div>
      )}
    </form>
  );
}
