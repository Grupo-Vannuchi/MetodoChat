import Link from "next/link";
import { getSelectedAccount } from "@/lib/account";
import { tetoDoBucket } from "@/lib/bucket";
import { avisoDaUrl } from "@/lib/avisos";
import { PUBLICACOES_POR_DIA } from "@/lib/publicacao";
import Enviador from "../enviador";
import { publicar } from "../actions";
import {
  card,
  subtle,
  input,
  label,
  hint,
  muted,
  btnPrimary,
  pageTitle,
  pageSubtitle,
  alertOk,
  alertError,
  alertWarn,
  emptyWrap,
  link,
} from "../../ui";

// A TELA DE COMPOR — componente de SERVIDOR.
//
// O único pedaço de cliente desta rota é `<Enviador>` (e a janelinha do canto,
// que mora no `app-shell`), e o motivo está escrito no cabeçalho dele: o
// navegador é quem envia o arquivo porque a Vercel recusa corpo acima de 4,5 MB.
// Tudo o mais aqui é HTML de servidor, como no resto da base.
//
// NENHUMA DECISÃO NO JSX: o aviso vem de `avisoDaUrl`, os limites de legenda e
// de formato vêm de `lib/publicacao.ts`, e o teto do armazenamento vem do
// bucket — nunca cravado.

export const dynamic = "force-dynamic";
// O TETO VALE PARA A AÇÃO DESTA PÁGINA: `publicar` drena a fila antes de
// responder quando o post é para agora, e uma drenagem fala com a Meta. Mesmo
// teto de `/contatos` e das rotas que drenam.
export const maxDuration = 60;

export default async function Publicar({
  searchParams,
}: {
  searchParams: Promise<{ aviso?: string; tom?: string }>;
}) {
  const params = await searchParams;
  const aviso = avisoDaUrl(params.aviso, params.tom);
  const conta = await getSelectedAccount();

  // O TETO É PERGUNTADO AO BUCKET, E A PERGUNTA PODE FALHAR. Um `throw` aqui
  // seria a tela inteira em branco por causa de um número que só serve para
  // avisar cedo — e a barreira de verdade (a rota que assina, e o próprio
  // bucket) continua de pé sem ele. `null` é "não deu para saber", e a tela diz
  // isso em vez de inventar um limite.
  let teto: number | null = null;
  try {
    teto = await tetoDoBucket();
  } catch {
    teto = null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className={pageTitle}>Novo post</h1>
        <p className={pageSubtitle}>
          {conta
            ? `no perfil de @${conta.username ?? conta.ig_user_id}`
            : "Nenhuma conta selecionada."}
        </p>
        {/* O LINK PARA OS AGENDADOS, e ele e obrigatorio: uma tela sem link nao
            existe para quem usa, e este produto ja pagou por isso. Ele fica
            fora do `!conta`, junto do titulo, porque quem chega aqui para
            agendar precisa saber que da para VOLTAR e cancelar — a API do
            Instagram nao apaga midia, entao a janela de conserto e antes de o
            post sair. */}
        {/* O LINK DE VOLTA, e ele TROCOU DE SENTIDO em 11/09/2026: era "Ver
            os posts agendados", apontando para uma tela subordinada a esta.
            Agora esta é a subordinada, e o link é o caminho de volta — mesmo
            gesto e mesmas palavras do "← Publicações" da tela de detalhe.
            Três nomes para um lugar era um achado de revisão. */}
        <p className="mt-2 text-sm">
          <Link href="/publicar" className={link}>
            ← Publicações
          </Link>
        </p>
      </div>

      {aviso && <div className={aviso.tom === "ok" ? alertOk : alertError}>{aviso.texto}</div>}

      {!conta ? (
        <div className={emptyWrap}>
          <p className={muted}>
            Conecte uma conta do Instagram em Configuração para publicar pelo painel.
          </p>
        </div>
      ) : (
        <>
          {/* O QUE ESTA TELA NÃO PROMETE, dito ANTES de alguém compor.
              A especificação (§4 e §5) recusou as duas coisas com motivo
              medido, e descobri-las pelo resultado é tarde: quem monta um reels
              esperando trilha da biblioteca já montou errado. */}
          <div className={alertWarn}>
            <p className="font-semibold">Duas coisas que o Instagram não deixa fazer por aqui.</p>
            <p className="mt-1">
              Música da biblioteca do Instagram é só pelo celular — a API só nomeia o áudio que
              já está no vídeo. E um post que falhar aparece na tela de Atividade, e em nenhum
              outro lugar: o painel não manda aviso.
            </p>
          </div>

          <form action={publicar} className={`${card} space-y-6 p-5`}>
            <Enviador teto={teto} />

            {/* QUANDO — refeito em 11/09/2026 porque o dono disse que estava
                feio, e ele estava. Três coisas erradas, e a primeira não era
                estética:

                1. O CAMPO DE DATA FICAVA VISÍVEL COM "agora" MARCADO, que é o
                   padrão — ou seja, a tela abria com um campo morto e uma
                   frase inteira explicando que ele não se aplicava. A
                   explicação existia POR CAUSA do layout.

                   O comentário antigo justificava isso dizendo que esconder
                   "pediria estado no navegador". NÃO PEDE MAIS: `:has()` faz
                   pelo CSS, e esta tela continua sendo servidor puro.

                2. OS BOTÕES DE RÁDIO ERAM OS DO SISTEMA OPERACIONAL, num azul
                   que é o único deste painel — a mesma família do achado D6.
                   Viraram cartões de escolha, a MESMA forma dos cartões de
                   gatilho de `/automacoes/nova`, que a auditoria pôs na lista
                   do que está bom e não se mexe. Lá o estado vem do React;
                   aqui vem de `has-checked:`, e o rádio de verdade continua
                   embaixo (`sr-only`), então teclado e leitor de tela não
                   perdem nada.

                3. O AVISO DE IRREVERSIBILIDADE ESTAVA NA FRASE ERRADA. Ele
                   morava no rodapé do campo de data — ou seja, pendurado na
                   opção que NÃO é irreversível. Agora cada cartão diz a sua
                   consequência, e a de agendar ("dá para cancelar ou remarcar")
                   nunca tinha sido dita em lugar nenhum. */}
            <fieldset className={`${subtle} group space-y-3 p-4`}>
              <legend className="sr-only">Quando publicar</legend>
              <p className="titulo text-sm font-semibold">Quando</p>

              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  {
                    valor: "agora",
                    titulo: "Publicar agora",
                    consequencia: "sai em instantes, e não dá para desfazer",
                    padrao: true,
                  },
                  {
                    valor: "depois",
                    titulo: "Publicar em outra hora",
                    consequencia: "dá para cancelar ou remarcar até a hora chegar",
                    padrao: false,
                  },
                ].map((o) => (
                  <label
                    key={o.valor}
                    className="cursor-pointer rounded-xl border border-traco bg-white p-3 transition-colors hover:border-quieto/50 has-checked:border-acao has-checked:bg-acao/10 has-checked:ring-1 has-checked:ring-acao has-focus-visible:ring-4 has-focus-visible:ring-acao/25 dark:border-traco-escuro dark:bg-papel-escuro/60 dark:hover:border-quieto-escuro/50 dark:has-checked:border-acao-escuro dark:has-checked:bg-acao-escuro/15 dark:has-checked:ring-acao-escuro dark:has-focus-visible:ring-acao-escuro/25"
                  >
                    {/* O RÁDIO DE VERDADE, só invisível: `sr-only` o tira do
                        desenho sem o tirar do formulário nem da ordem de
                        tabulação. O nome e os valores são os mesmos de antes —
                        `momentoDaPublicacao` (lib/publicacao.ts) continua
                        recebendo exatamente o que recebia. */}
                    <input
                      type="radio"
                      name="quando"
                      value={o.valor}
                      defaultChecked={o.padrao}
                      className="sr-only"
                    />
                    <span className="block text-sm font-semibold">{o.titulo}</span>
                    <span className={`mt-0.5 block text-xs ${muted}`}>{o.consequencia}</span>
                  </label>
                ))}
              </div>

              {/* O CAMPO SÓ APARECE QUANDO SERVE.

                  O SENTIDO DA REGRA É DELIBERADO: o padrão é VISÍVEL, e o que a
                  variante faz é ESCONDER quando "agora" está marcado. Se
                  `group-has-*` não compilar num navegador antigo, o campo fica
                  visível — que é exatamente o comportamento de hoje. Escrito ao
                  contrário, uma falha de CSS esconderia o campo e quebraria o
                  agendamento CALADO. */}
              <div className="group-has-[input[value=agora]:checked]:hidden">
                <label className={label} htmlFor="data_hora">
                  Data e hora
                </label>
                <input
                  id="data_hora"
                  name="data_hora"
                  type="datetime-local"
                  className={input}
                />
                {/* SEM `min`, E DE PROPÓSITO: o piso do campo teria de ser
                    calculado no servidor, que roda em UTC, e mostraria uma hora
                    três horas adiante da do dono. Quem recusa o passado é a
                    ação, com a frase que diz por quê — e ela sabe o fuso,
                    porque o enviador o manda. */}
                <p className={hint}>Uma hora que já passou é recusada.</p>
              </div>
            </fieldset>

            <fieldset className={`${subtle} space-y-3 p-4`}>
              {/* MESMO TRATAMENTO DO "Quando", e por isso: `<legend>` fica em
                  cima da borda por padrão do navegador, e era o único
                  cabeçalho do painel desenhado assim. Ele continua existindo
                  para o leitor de tela (`sr-only`), e o título visível usa a
                  mesma classe dos outros cabeçalhos de seção. */}
              <legend className="sr-only">Opções de reels</legend>
              <p className="titulo text-sm font-semibold">Só para reels</p>
              {/* ESTES DOIS SÓ VALEM EM REELS, e `parametrosDoContainer`
                  (lib/publicacao.ts) já os DESCARTA nas outras formas — a Meta
                  os ignoraria calada, e calado é o que esta base não aceita.
                  Por isso eles ficam visíveis sempre em vez de aparecerem por
                  estado de navegador: a regra está do lado que tem teste. */}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="compartilhar_no_feed" value="1" defaultChecked />
                Mostrar também no feed
              </label>
              <div>
                <label className={label} htmlFor="nome_do_audio">
                  Nome do áudio
                </label>
                <input
                  id="nome_do_audio"
                  name="nome_do_audio"
                  className={input}
                  placeholder="Como o áudio do seu vídeo aparece no Instagram"
                />
                <p className={hint}>
                  Ele nomeia o áudio que já está no vídeo. Não escolhe música da biblioteca do
                  Instagram — isso a API não permite.
                </p>
              </div>
            </fieldset>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className={`text-xs ${muted}`}>
                O Instagram aceita até {PUBLICACOES_POR_DIA} publicações por conta a cada 24
                horas.
              </p>
              <button className={btnPrimary}>Publicar</button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
