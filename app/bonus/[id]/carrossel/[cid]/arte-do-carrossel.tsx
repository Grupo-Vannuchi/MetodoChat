"use client";
import { useActionState, useRef, useState, useTransition } from "react";
import { alertError, btnPrimary, btnSecondary, card, hint, input, label } from "@/app/ui";
import { urlDaArte } from "@/lib/bonus/arte-tela";
import { textoDoBaixarTodos, type AvisoDaArte } from "@/lib/bonus/arte-textos";

// A SEÇÃO DA ARTE DO CARROSSEL (spec da Etapa 3, "As telas"): a conta do cabeçalho, a grade das
// miniaturas com o "só texto" e o "Baixar" de cada slide, e o "Baixar todos".
//
// AS ESCOLHAS SE GRAVAM NA HORA, pela action, e a resposta volta como ESTADO (useActionState), e
// nunca por redirect: a seção fica na página do editor, e recriar a página apagaria a edição
// (achado 52). O formulário é montado aqui, a partir do estado, e despachado numa transição: sem
// `<form action>`, não há o reinício de formulário que o React 19 faz depois da action, e que um
// `<select>` controlado não aguenta (medido no PR #5).
//
// A MINIATURA SÓ É PEDIDA DE NOVO QUANDO A URL MUDA: a rota responde `no-store`, mas a `<img>` não
// refaz o pedido com o mesmo `src`. A versão leva o que veio do servidor (`versaoBase`, com a
// revisão salva somada pelo pai) e a hora da última escolha gravada aqui.
//
// A conta e o "só texto" moram no pai (editor-do-carrossel.tsx), que precisa do "só texto" para o
// aviso de cabimento do editor. A action entra por propriedade, para o teste de tela usar uma falsa.
//
// NUMA RECUSA, A CONTA E O "SÓ TEXTO" VOLTAM PARA A ÚLTIMA ESCOLHA ACEITA (achado 67): a escolha
// muda na tela antes da action, para a caixa responder ao clique, mas a miniatura e o "Baixar"
// seguem o que está gravado. Sem a volta, a caixa e o "não cabe" mostrariam uma escolha que o
// servidor recusou. A primeira aceita é a que veio com a página.
export default function ArteDoCarrossel({
  acao,
  bonusId,
  carrosselId,
  total,
  contas,
  conta,
  aoMudarConta,
  soTexto,
  aoMudarSoTexto,
  avisoDaConta,
  avisos,
  versaoBase,
  pausaMs = 400,
}: {
  acao: (anterior: AvisoDaArte | null, form: FormData) => Promise<AvisoDaArte | null>;
  bonusId: string;
  carrosselId: string;
  total: number;
  contas: { id: string; rotulo: string }[];
  conta: string | null;
  aoMudarConta: (id: string | null) => void;
  soTexto: number[];
  aoMudarSoTexto: (slides: number[]) => void;
  avisoDaConta: string | null;
  avisos: Record<number, string>;
  versaoBase: string;
  pausaMs?: number;
}) {
  const [gravadaEm, setGravadaEm] = useState(0);
  const aceita = useRef({ conta, soTexto });
  const [resposta, despachar, pendente] = useActionState(async (anterior: AvisoDaArte | null, form: FormData) => {
    const r = await acao(anterior, form);
    if (r?.tom === "ok") {
      const enviada = form.get("conta");
      aceita.current = {
        conta: typeof enviada === "string" ? enviada : null,
        soTexto: form.getAll("so_texto").map(Number),
      };
      setGravadaEm(r.em);
    } else if (r?.tom === "erro") {
      aoMudarConta(aceita.current.conta);
      aoMudarSoTexto(aceita.current.soTexto);
    }
    return r;
  }, null);
  const [, iniciar] = useTransition();
  const [baixando, setBaixando] = useState(false);
  const versao = `${versaoBase}-${gravadaEm}`;
  const slides = Array.from({ length: total }, (_, i) => i + 1);

  function gravar(contaNova: string | null, soTextoNovo: number[]) {
    const form = new FormData();
    form.set("id", carrosselId);
    if (contaNova) form.set("conta", contaNova);
    for (const n of soTextoNovo) form.append("so_texto", String(n));
    iniciar(() => despachar(form));
  }

  async function baixarTodos() {
    setBaixando(true);
    for (const n of slides) {
      const a = document.createElement("a");
      a.href = urlDaArte(bonusId, carrosselId, n, versao, true);
      a.setAttribute("download", "");
      document.body.appendChild(a);
      a.click();
      a.remove();
      if (n < total) await new Promise((pronto) => setTimeout(pronto, pausaMs));
    }
    setBaixando(false);
  }

  return (
    <section className={`${card} space-y-4 p-6`}>
      <h2 className="text-base font-semibold">Arte dos slides</h2>
      <div>
        <label htmlFor="conta-da-arte" className={label}>
          Conta do cabeçalho
        </label>
        <select
          id="conta-da-arte"
          value={conta ?? ""}
          disabled={pendente}
          onChange={(e) => {
            aoMudarConta(e.target.value);
            gravar(e.target.value, soTexto);
          }}
          className={input}
        >
          {contas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.rotulo}
            </option>
          ))}
        </select>
        {avisoDaConta && gravadaEm === 0 && <p className={hint}>{avisoDaConta}</p>}
      </div>

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {slides.map((n) => (
          <li key={n} className="space-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- a arte está atrás de sessão, e o
                otimizador de imagem do Next buscaria a URL sem o cookie: a miniatura voltaria 401. */}
            <img
              src={urlDaArte(bonusId, carrosselId, n, versao)}
              alt={`Slide ${n} de ${total}`}
              width={216}
              height={270}
              className="w-full rounded-lg border border-traco dark:border-traco-escuro"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                aria-label={`Slide ${n}: só texto, sem o espaço da imagem`}
                checked={soTexto.includes(n)}
                disabled={pendente}
                onChange={(e) => {
                  const novo = e.target.checked ? [...soTexto, n].sort((a, b) => a - b) : soTexto.filter((s) => s !== n);
                  aoMudarSoTexto(novo);
                  gravar(conta, novo);
                }}
              />
              Só texto
            </label>
            {avisos[n] && <p className="text-xs font-medium text-fecha dark:text-fecha-escuro">{avisos[n]}</p>}
            <a href={urlDaArte(bonusId, carrosselId, n, versao, true)} download className={btnSecondary}>
              Baixar o slide {n}
            </a>
          </li>
        ))}
      </ul>

      {resposta?.tom === "erro" && (
        <p role="status" className={alertError}>
          {resposta.texto}
        </p>
      )}

      <div className="space-y-2">
        <p className={hint}>{textoDoBaixarTodos(total)}</p>
        <button type="button" onClick={baixarTodos} disabled={baixando} className={btnPrimary}>
          Baixar todos
        </button>
      </div>
    </section>
  );
}
