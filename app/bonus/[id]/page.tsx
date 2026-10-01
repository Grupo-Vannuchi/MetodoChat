import Link from "next/link";
import { notFound } from "next/navigation";
import {
  alertError,
  alertOk,
  alertWarn,
  btnPrimary,
  btnSecondary,
  card,
  hint,
  link,
  pageSubtitle,
  pageTitle,
  skeleton,
} from "@/app/ui";
import { avisoDaUrl } from "@/lib/avisos";
import { LIMITES, type CampoRevisado } from "@/lib/bonus/contrato";
import { ehTabelaAusente } from "@/lib/bonus/erros";
import { urlPublicaDoBonus } from "@/lib/bonus/labs";
import type { LinhaDoBonus } from "@/lib/bonus/linha";
import { PALAVRA_MAX, TETO_DIARIO } from "@/lib/bonus/pedido";
import { lerLinha } from "@/lib/bonus/repositorio";
import { corpoCongelado, detalheGravado, envioNaTela, quadroDaLinha, tituloDaLinha, valoresDoFormulario } from "@/lib/bonus/tela";
import { temasSugeridos } from "@/lib/bonus/temas";
import { geracaoNaTela } from "@/lib/bonus/tempos";
import {
  ROTULO_DO_CAMPO,
  TEXTO_SEM_VALORES,
  TEXTO_TABELA_AUSENTE,
  TEXTO_TRAVOU,
  type TomDoQuadro,
} from "@/lib/bonus/textos";
import { conferirNoLabs, enviarAoLabs, gerarDeNovo } from "../actions";
import Acompanhar from "./acompanhar";
import FormularioDoEnvio from "./formulario-do-envio";
import NoLabs from "./no-labs";

// O teto de lib/bonus/tempos.ts (MAX_DURATION_S). O Next exige literal aqui, e
// tests/bonus-paginas.test.ts confere que é o mesmo número. As actions desta
// página (enviar, conferir, gerar de novo) correm sob este teto.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const QUADRO: Record<TomDoQuadro, string> = { ok: alertOk, atencao: alertWarn, erro: alertError };

const CAMPOS: { nome: CampoRevisado; max: number; linhas?: number }[] = [
  { nome: "titulo", max: LIMITES.titulo.max },
  { nome: "slug", max: LIMITES.slug.max },
  { nome: "palavra", max: PALAVRA_MAX },
  { nome: "tema", max: LIMITES.tema.max },
  { nome: "descricao", max: LIMITES.descricao.max, linhas: 3 },
  { nome: "intro", max: LIMITES.intro.max, linhas: 4 },
  { nome: "prompt", max: LIMITES.prompt.max, linhas: 14 },
];

export default async function BonusGerado({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aviso?: string; tom?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const aviso = avisoDaUrl(sp.aviso, sp.tom);

  let linha: LinhaDoBonus | null;
  try {
    linha = await lerLinha(id);
  } catch (erro) {
    if (!ehTabelaAusente(erro)) throw erro;
    return <div className={alertError}>{TEXTO_TABELA_AUSENTE}</div>;
  }
  if (!linha) notFound();

  // Server Component `async` e `force-dynamic`: roda UMA vez por requisição, e ler o
  // relógio aqui é o comportamento pedido. A regra trata todo arquivo como cliente;
  // o dono silencia do mesmo jeito, com o motivo por extenso, em app/page.tsx:322-333.
  // eslint-disable-next-line react-hooks/purity
  const agora = Date.now();
  const geracao = geracaoNaTela(linha.estado, linha.criado_em, agora);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/bonus" className={link}>
          Voltar para Bônus
        </Link>
        <h1 className={`mt-2 ${pageTitle}`}>{tituloDaLinha(linha)}</h1>
        <p className={pageSubtitle}>Tema: {linha.tema}</p>
      </div>

      {aviso && <div className={aviso.tom === "ok" ? alertOk : alertError}>{aviso.texto}</div>}

      {geracao === "gerando" && (
        <section className={`${card} space-y-3 p-6`}>
          <div className={`h-4 w-2/3 ${skeleton}`} />
          <div className={`h-4 w-1/2 ${skeleton}`} />
          <div className={`h-24 ${skeleton}`} />
          <Acompanhar criadoEmMs={linha.criado_em.getTime()} />
        </section>
      )}

      {(geracao === "falhou" || geracao === "travou") && (
        <section className={`${card} space-y-4 p-6`}>
          <div className={alertError}>
            {geracao === "travou" ? TEXTO_TRAVOU : (linha.erro ?? "A geração falhou sem dizer o motivo.")}
          </div>
          <form action={gerarDeNovo}>
            <input type="hidden" name="id" value={linha.id} />
            <button type="submit" className={btnPrimary}>
              Gerar de novo
            </button>
          </form>
          <p className={hint}>Conta como uma das {TETO_DIARIO} gerações do dia.</p>
        </section>
      )}

      {geracao === "pronto" && <Pronto linha={linha} agora={agora} />}
    </div>
  );
}

async function Pronto({ linha, agora }: { linha: LinhaDoBonus; agora: number }) {
  const envio = envioNaTela(linha, agora);
  const quadro = quadroDaLinha(linha, agora);
  const valores = valoresDoFormulario(linha);
  const temas = [...new Set([...(await temasSugeridos(process.env.LABS_URL)), ...detalheGravado(linha).temasValidos])];
  const publico = linha.slug ? urlPublicaDoBonus(process.env.LABS_URL, linha.slug) : null;

  return (
    <>
      {quadro && (
        <div className={QUADRO[quadro.tom]}>
          <p className="font-semibold">{quadro.titulo}</p>
          <p className="mt-1">{quadro.texto}</p>
        </div>
      )}

      {envio === "criado" && <NoLabs linha={linha} publico={publico} agora={agora} />}

      {envio === "conferir" && (
        <section className={`${card} space-y-3 p-6`}>
          <p className="text-sm">
            Procure o endereço <code>{linha.slug}</code> no /admin do Labs e diga o que achou.
          </p>
          <div className="flex flex-wrap gap-3">
            <form action={conferirNoLabs}>
              <input type="hidden" name="id" value={linha.id} />
              <input type="hidden" name="existe" value="sim" />
              <button type="submit" className={btnPrimary}>
                Existe, com o título {tituloDaLinha(linha)}
              </button>
            </form>
            <form action={conferirNoLabs}>
              <input type="hidden" name="id" value={linha.id} />
              <input type="hidden" name="existe" value="nao" />
              <button type="submit" className={btnSecondary}>
                Não existe
              </button>
            </form>
          </div>
        </section>
      )}

      {envio !== "criado" &&
        envio !== "conferir" &&
        envio !== "enviando" &&
        (valores ? (
          <FormularioDoEnvio
            acao={enviarAoLabs}
            id={linha.id}
            campos={CAMPOS.map((c) => ({ ...c, rotulo: ROTULO_DO_CAMPO[c.nome] }))}
            valores={valores}
            congelado={corpoCongelado(linha)}
            temas={temas}
          />
        ) : (
          <div className={alertError}>{TEXTO_SEM_VALORES}</div>
        ))}
    </>
  );
}
