import { listAccounts, sql } from "@/lib/db";
import { lerPerguntas, MAXIMO_DE_PERGUNTAS } from "@/lib/perguntas-de-abertura";
import {
  AVISO_DA_LIGACAO,
  LIGAR_FUNCIONA,
  linhasDasPortas,
  opcoesDeAutomacao,
  resumoDoLimite,
  type AutomacaoConhecida,
} from "./portas";
import { salvarPerguntasDeAbertura } from "./actions";
import SubmitButton from "./submit-button";
import {
  btnPrimary,
  input,
  muted,
  subtle,
  alertWarn,
  alertInfo,
  alertError,
  badgeWarn,
  badgeErr,
} from "../ui";

// AS QUATRO PORTAS DE ENTRADA DE CADA CONTA.
//
// Quem abre a conversa da conta pela primeira vez vê até quatro perguntas,
// toca numa, e vira contato com uma automação rodando. Esta é a tela onde o
// dono decide quais são as quatro — antes dela, só dava por linha de comando
// (`scripts/perguntas-de-abertura.mjs`).
//
// ESTE JSX NÃO DECIDE NADA. Toda decisão — o que cada posição mostra, o que
// dispara, qual aviso acende, quantas posições sobram — vem de `./portas.ts`,
// que tem teste puro (`tests/setup-portas.test.ts`). A suíte deste projeto NÃO
// testa componente, por decisão do dono: uma cláusula escrita aqui dentro seria
// rede zero, e isso foi medido plantando defeito em três telas com 743 testes
// verdes. O que este arquivo faz é mapear e desenhar.
//
// CHAMADAS EXTERNAS, UMA POR CONTA: como `subscription-status.tsx`, ele é
// isolado e carregado dentro de um <Suspense> para não segurar o /setup inteiro
// até a Meta responder.
//
// LÊ DA META, E NÃO DO BANCO. As perguntas vivem no perfil da conta na Meta, e
// o dono pode ter mexido pelo painel dela — o banco não saberia. A Meta é a
// verdade, e é o que esta tela mostra; o banco entra só para dar NOME às
// automações que os identificadores apontam.
export default async function PortasDeEntrada() {
  const accounts = await listAccounts();
  if (!accounts.length) return null;

  const contas = await Promise.all(
    accounts.map(async (a) => ({
      igUserId: a.ig_user_id,
      username: a.username ?? a.ig_user_id,
      leitura: await lerPerguntas(a.ig_user_id, a.access_token),
      automacoes: (await sql().query(
        `select id, name, active, triggers from automations where account_id = $1 order by created_at desc`,
        [a.ig_user_id]
      )) as AutomacaoConhecida[],
    }))
  );

  return (
    <div className="space-y-4">
      {/* OS DOIS AVISOS, VISÍVEIS. Eles não estão escondidos atrás de um "saiba
          mais" de propósito: os dois explicam por que a pergunta que o dono
          acabou de salvar "não apareceu", e é a dúvida que ele teria em
          seguida. Sem eles, o caminho para descobrir é achar que quebrou. */}
      <div className={alertWarn}>
        <b>Estas perguntas só aparecem no aplicativo do celular.</b> No Instagram do computador
        elas não são exibidas — se você for conferir por lá, não vai vê-las.
      </div>
      <div className={alertInfo}>
        <b>E só aparecem em conversa nova.</b> Quem já trocou mensagem com a conta alguma vez
        nunca mais vê as perguntas. Para testar, use um perfil que nunca falou com esta conta.
      </div>

      {/* O TERCEIRO AVISO, e ele some sozinho quando deixar de ser verdade:
          `LIGAR_FUNCIONA` é CALCULADO das duas regras (o formato do
          identificador e o que a Meta guarda), não escrito à mão. */}
      {!LIGAR_FUNCIONA && <div className={alertError}>{AVISO_DA_LIGACAO}</div>}

      {contas.map((c) => {
        const linhas = linhasDasPortas(c.leitura.perguntas, c.automacoes);
        const resumo = resumoDoLimite(c.leitura.perguntas.length);
        const opcoes = opcoesDeAutomacao(c.automacoes);
        const falhou = c.leitura.status !== 200;
        return (
          <div key={c.igUserId} className={`p-4 ${subtle}`}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="font-medium">@{c.username}</span>
              {/* O LIMITE É DA CONTA, e ele fica escrito ao lado do nome dela —
                  não numa nota de rodapé, e não no erro da Meta depois de
                  tentar a quinta. */}
              <span className={`text-xs ${muted}`}>{resumo.texto}</span>
              {resumo.acima && <span className={badgeErr}>acima do limite</span>}
              {resumo.cheio && <span className={badgeWarn}>cheia</span>}
            </div>

            {falhou ? (
              <p className={`text-sm ${muted}`}>
                Não deu para consultar as perguntas desta conta na Meta (HTTP {c.leitura.status}).
                Confira o diagnóstico das contas acima.
              </p>
            ) : (
              <form action={salvarPerguntasDeAbertura} className="space-y-3">
                <input type="hidden" name="conta" value={c.igUserId} />
                {/* Quantas posições este formulário mandou. Normalmente quatro;
                    pode ser mais numa conta com perguntas em vários idiomas, e
                    aí a tela mostra todas em vez de esconder o que está no ar. */}
                <input type="hidden" name="posicoes" value={linhas.length} />
                {linhas.map((l) => (
                  <div key={l.posicao} className="flex flex-col gap-2 sm:flex-row sm:items-start">
                    <span
                      className={`mt-2.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-bold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200`}
                    >
                      {l.posicao}
                    </span>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <input
                        name={`texto-${l.posicao}`}
                        defaultValue={l.texto}
                        placeholder="Pergunta que a pessoa vê ao abrir a conversa"
                        className={input}
                      />
                      {l.aviso && (
                        <p
                          className={`text-xs ${
                            l.aviso.grau === "erro"
                              ? "text-red-600 dark:text-red-400"
                              : "text-amber-700 dark:text-amber-400"
                          }`}
                        >
                          {l.aviso.texto}
                        </p>
                      )}
                    </div>
                    <div className="w-full space-y-1.5 sm:w-64">
                      <select
                        name={`automacao-${l.posicao}`}
                        defaultValue={l.automacaoId ?? ""}
                        className={input}
                      >
                        <option value="">Nenhuma automação</option>
                        {opcoes.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.rotulo}
                          </option>
                        ))}
                      </select>
                      <p className={`text-xs ${muted}`}>Dispara: {l.dispara}</p>
                    </div>
                    {/* O identificador que veio da Meta, intacto. É ele que faz
                        uma pergunta que este painel não entende sobreviver a um
                        "Salvar" que não a tocou (`perguntasDoFormulario`). */}
                    <input type="hidden" name={`payload-${l.posicao}`} value={l.payload} />
                  </div>
                ))}
                <SubmitButton
                  className={btnPrimary}
                  etapas={["Falando com a Meta…", "Lendo de volta para conferir…"]}
                >
                  Salvar as perguntas de @{c.username}
                </SubmitButton>
                <p className={`text-xs ${muted}`}>
                  Apagar o texto de uma posição tira aquela pergunta do ar. Apagar as{" "}
                  {MAXIMO_DE_PERGUNTAS} deixa a conta sem pergunta nenhuma.
                </p>
              </form>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function PortasDeEntradaSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-12 rounded-xl bg-zinc-200/70 dark:bg-zinc-800/70" />
      <div className="h-48 rounded-xl bg-zinc-200/70 dark:bg-zinc-800/70" />
    </div>
  );
}
