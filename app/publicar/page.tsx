import { getSelectedAccount } from "@/lib/account";
import { tetoDoBucket } from "@/lib/bucket";
import { avisoDaUrl } from "@/lib/avisos";
import { PUBLICACOES_POR_DIA } from "@/lib/publicacao";
import Enviador from "./enviador";
import { publicar } from "./actions";
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
} from "../ui";

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
        <h1 className={pageTitle}>Publicar</h1>
        <p className={pageSubtitle}>
          {conta
            ? `no perfil de @${conta.username ?? conta.ig_user_id}`
            : "Nenhuma conta selecionada."}
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

            <fieldset className={`${subtle} space-y-4 p-4`}>
              <legend className="px-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Quando
              </legend>

              {/* OS DOIS CAMPOS APARECEM SEMPRE, e o de data não se esconde
                  quando "agora" está marcado: esconder pediria estado no
                  navegador para uma tela que não precisa dele, e esta base só
                  paga esse preço onde não há alternativa (o envio do arquivo).
                  Quem decide o que a combinação significa é
                  `momentoDaPublicacao` (lib/publicacao.ts), no servidor. */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="quando" value="agora" defaultChecked />
                  Publicar agora
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="quando" value="depois" />
                  Publicar em outra hora
                </label>
              </div>

              <div>
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
                <p className={hint}>
                  Só é usada quando &quot;publicar em outra hora&quot; está marcado. Uma hora que
                  já passou é recusada — publicar agora é a outra opção, e é a que não dá para
                  desfazer.
                </p>
              </div>
            </fieldset>

            <fieldset className={`${subtle} space-y-3 p-4`}>
              <legend className="px-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Só para reels
              </legend>
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
