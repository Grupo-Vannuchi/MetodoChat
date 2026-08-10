"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { criarAutomacao } from "../actions";
import type { TriggerKind } from "../types";
import { IconComment, IconStory, IconSend } from "../../icons";
import {
  card,
  input,
  label as labelCls,
  hint as hintCls,
  btnPrimary,
  btnSecondary,
  alertError,
} from "../../ui";

// O PASSO CURTO ANTES DO QUADRO — nome, gatilho e palavras-chave, e nada mais.
//
// POR QUE ELE EXISTE: `salvarPassos` (app/automacoes/actions.ts) precisa de um
// id de automação, e automação nova não tem nenhum. Criar primeiro e editar
// depois é mais honesto do que segurar a lista de blocos em memória esperando um
// id aparecer — nesse caminho o primeiro salvamento teria de criar e gravar de
// uma vez, com dois caminhos diferentes na mesma tela.
//
// O QUE ELE NÃO PERGUNTA: a DM de boas-vindas, o link, o lembrete, o portão de
// follow, o pedido de e-mail. Isso tudo virou BLOCO, e bloco se monta no quadro.
// Repetir esses campos aqui seria ressuscitar o formulário de 612 linhas em
// tamanho menor, e as duas telas passariam a discordar sobre o mesmo fluxo.
//
// A AUTOMAÇÃO NASCE PAUSADA — o motivo (uma automação vazia e ativa rouba o
// disparo de uma que funciona) está escrito em `criarAutomacao`. Aqui só a
// consequência: a frase abaixo do botão diz isso, para ninguém montar o fluxo
// inteiro e ficar esperando uma automação que ninguém ligou.

const GATILHOS: {
  valor: TriggerKind;
  icone: (props: { className?: string }) => React.ReactNode;
  titulo: string;
  descricao: string;
}[] = [
  {
    valor: "comment",
    icone: IconComment,
    titulo: "Comentário em post/reels",
    descricao: "Alguém comenta a palavra-chave e recebe sua DM.",
  },
  {
    valor: "story",
    icone: IconStory,
    titulo: "Resposta a story",
    descricao: "Alguém responde seu story com a palavra-chave.",
  },
  {
    valor: "dm",
    icone: IconSend,
    titulo: "DM recebida",
    descricao: "Alguém manda a palavra-chave direto na sua DM.",
  },
];

const DICA_DA_PALAVRA: Record<TriggerKind, string> = {
  comment: "O que a pessoa precisa comentar no post.",
  story: "O que a pessoa precisa responder no seu story.",
  dm: "O que a pessoa precisa mandar na sua DM.",
};

export default function FormNovaAutomacao() {
  // O ERRO VOLTA DO SERVIDOR E A TELA FICA COMO ESTAVA. O formulário antigo
  // redirecionava para `/automacoes?erro=…` e quem errou uma palavra-chave
  // perdia tudo o que tinha digitado.
  const [erro, acao, enviando] = useActionState(criarAutomacao, null);

  // Os dois campos que se afetam: com "Qualquer texto" não há palavra-chave a
  // pedir. É o mesmo par de estados do painel do gatilho, e por isso o `select`
  // é controlado enquanto o resto do formulário não é.
  const [gatilho, setGatilho] = useState<TriggerKind>("comment");
  const [correspondencia, setCorrespondencia] = useState("contains");

  return (
    <form action={acao} className={`${card} max-w-2xl space-y-5 p-5`}>
      {erro && <div className={alertError}>{erro}</div>}

      <div>
        <label className={labelCls}>Nome da automação</label>
        <input name="name" required className={input} placeholder="Ex.: Link do e-book" />
        <p className={hintCls}>Só você vê esse nome, na lista de automações.</p>
      </div>

      <div>
        <span className={labelCls}>Quando alguém…</span>
        <div className="grid gap-3 sm:grid-cols-3">
          {GATILHOS.map((o) => {
            const escolhido = gatilho === o.valor;
            const Icone = o.icone;
            return (
              <label
                key={o.valor}
                className={`cursor-pointer rounded-xl border p-3 transition-colors ${
                  escolhido
                    ? "border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500"
                    : "border-zinc-300 bg-white hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:border-zinc-500"
                }`}
              >
                <input
                  type="radio"
                  name="trigger"
                  value={o.valor}
                  checked={escolhido}
                  onChange={() => setGatilho(o.valor)}
                  className="sr-only"
                />
                <Icone
                  className={`h-5 w-5 ${
                    escolhido
                      ? "text-indigo-600 dark:text-indigo-400"
                      : "text-zinc-500 dark:text-zinc-400"
                  }`}
                />
                <p
                  className={`mt-2 text-sm font-semibold ${
                    escolhido
                      ? "text-indigo-600 dark:text-indigo-400"
                      : "text-zinc-800 dark:text-zinc-200"
                  }`}
                >
                  {o.titulo}
                </p>
                <p className="mt-1 text-xs text-zinc-500">{o.descricao}</p>
              </label>
            );
          })}
        </div>
        <p className={hintCls}>
          O gatilho decide quais blocos a paleta oferece no quadro. Dá para trocá-lo depois, no nó
          de gatilho.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Palavras-chave (separadas por vírgula)</label>
          <input
            name="keywords"
            required={correspondencia !== "any"}
            disabled={correspondencia === "any"}
            className={input}
            placeholder="quero, link, eu quero"
          />
          <p className={hintCls}>
            {DICA_DA_PALAVRA[gatilho]} Sem diferença de maiúsculas ou acentos.
          </p>
        </div>
        <div>
          <label className={labelCls}>Tipo de correspondência</label>
          <select
            name="match_type"
            value={correspondencia}
            onChange={(e) => setCorrespondencia(e.target.value)}
            className={input}
          >
            <option value="contains">Contém a palavra</option>
            <option value="exact">Texto exato</option>
            <option value="any">Qualquer texto</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={enviando} className={btnPrimary}>
          {enviando ? "Criando…" : "Criar e montar o fluxo"}
        </button>
        <Link href="/automacoes" className={btnSecondary}>
          Cancelar
        </Link>
      </div>
      <p className={hintCls}>
        Ela nasce <strong>pausada</strong>: monte o fluxo no quadro e marque “Ativa” no nó de
        gatilho quando estiver pronta.
      </p>
    </form>
  );
}
