import Link from "next/link";
import { cookies } from "next/headers";
import { alertError, alertOk, btnPrimary, pageSubtitle, pageTitle } from "@/app/ui";
import { ACCOUNT_COOKIE } from "@/lib/account";
import { avisoDaUrl } from "@/lib/avisos";
import { urlPublicaSeDerParaMontar } from "@/lib/bucket";
import { abaDoEndereco, capaDoCarrossel, itemDaListaDeCarrosseis, separarPorAba } from "@/lib/bonus/carrosseis-tela";
import type { LinhaDoCarrossel } from "@/lib/bonus/carrossel-linha";
import { contasParaArte, listarCarrosseis } from "@/lib/bonus/carrossel-repositorio";
import { TEXTO_TABELA_CARROSSEL_AUSENTE } from "@/lib/bonus/carrossel-textos";
import { ehTabelaAusente } from "@/lib/bonus/erros";
import { publicacaoDaArte } from "@/lib/bonus/publicar-regras";
import { estadoDoCarrossel } from "@/lib/bonus/publicar-repositorio";
import ListaDeCarrosseis from "./lista";

// O MENU "CARROSSÉIS" (spec da Etapa 7): todos os carrosséis, os dos bônus e os avulsos, e o botão "Novo
// carrossel". Cada linha leva à página do carrossel (a de bônus, ou a do avulso), e o que ela mostra é
// decidido fora do JSX (carrosseis-tela.ts).
//
// AS ABAS (spec da Etapa 10): "Rascunhos", "Agendados" e "Publicados", pelo estado da publicação de hoje,
// com a aba no endereço (`?aba=`). A CAPA de cada linha é a miniatura do slide 1, calculada como a página
// do carrossel calcula: as contas do cabeçalho são lidas uma vez, com o cookie da conta.
//
// O ESTADO DA PUBLICAÇÃO é lido da fila só para o carrossel que tem publicação guardada: os outros
// não pagam a consulta.

export const dynamic = "force-dynamic";

export default async function Carrosseis({
  searchParams,
}: {
  searchParams: Promise<{ aviso?: string; tom?: string; aba?: string | string[] }>;
}) {
  const sp = await searchParams;
  const aviso = avisoDaUrl(sp.aviso, sp.tom);
  const aba = abaDoEndereco(sp.aba);

  let linhas: LinhaDoCarrossel[];
  try {
    linhas = await listarCarrosseis();
  } catch (erro) {
    if (!ehTabelaAusente(erro)) throw erro;
    return (
      <div className="space-y-6">
        <h1 className={pageTitle}>Carrosséis</h1>
        <div className={alertError}>{TEXTO_TABELA_CARROSSEL_AUSENTE}</div>
      </div>
    );
  }
  const estados = await Promise.all(linhas.map((l) => (publicacaoDaArte(l.arte) === null ? null : estadoDoCarrossel(l.arte))));
  const contas = await contasParaArte();
  const doCookie = (await cookies()).get(ACCOUNT_COOKIE)?.value;
  // Server Component `async` e `force-dynamic`: roda UMA vez por requisição, e ler o
  // relógio aqui é o comportamento pedido. A regra trata todo arquivo como cliente;
  // o dono silencia do mesmo jeito, com o motivo por extenso, em app/page.tsx:322-333.
  // eslint-disable-next-line react-hooks/purity
  const agora = Date.now();
  const { contagem, daAba } = separarPorAba(
    linhas.map((linha, i) => ({ linha, estado: estados[i] })),
    aba
  );
  const contexto = { contas, doCookie, urlPublica: urlPublicaSeDerParaMontar };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className={pageTitle}>Carrosséis</h1>
          <p className={pageSubtitle}>Os carrosséis dos bônus e os avulsos, de um bônus do Labs ou de um texto livre.</p>
        </div>
        <Link href="/carrosseis/novo" className={btnPrimary}>
          Novo carrossel
        </Link>
      </div>

      {aviso && <div className={aviso.tom === "ok" ? alertOk : alertError}>{aviso.texto}</div>}

      <ListaDeCarrosseis
        aba={aba}
        contagem={contagem}
        linhas={daAba.map(({ linha, estado }) => ({
          item: itemDaListaDeCarrosseis(linha, estado, agora),
          capa: capaDoCarrossel(linha, agora, contexto),
        }))}
      />
    </div>
  );
}
