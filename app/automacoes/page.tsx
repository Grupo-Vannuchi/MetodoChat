import Link from "next/link";
import { sql, Automation } from "@/lib/db";
import { getSelectedAccount } from "@/lib/account";
import { resolvePosts, type PostRef } from "@/lib/media-lookup";
import AutomationsList, { ListaVazia, AutomationRow } from "./list-client";
import { card, btnPrimary, muted, alertError, link, pageTitle, pageSubtitle } from "../ui";

export const dynamic = "force-dynamic";

export default async function AutomacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const sp = await searchParams;
  const account = await getSelectedAccount();
  // cada automação pertence a uma conta conectada
  const automations = account
    ? ((await sql().query(
        `select * from automations where account_id = $1 order by created_at desc`,
        [account.ig_user_id]
      )) as Automation[])
    : [];

  // A CAPA NÃO VEM MAIS DO BANCO — ela é buscada na Meta na hora de exibir.
  //
  // `media_thumbnail_url` é uma URL assinada do CDN do Instagram, e ela expira
  // em ~2 semanas: medido em 15/09/2026, 19 das 22 miniaturas desta tela
  // estavam quebradas por isso (uma automação de 31/08 já devolvia 403).
  // `lib/media-lookup.ts` já resolve exatamente este problema para `/eventos` e
  // para o Início — capa e link do post buscados NA HORA, nunca guardados —, e
  // esta tela passa a seguir a mesma regra em vez de reler a coluna que apodrece.
  //
  // `story_thumbnail_url` CONTINUA vindo do banco, mas PARA DE ALIMENTAR
  // `<img>` — ver o comentário na montagem de `thumb`, abaixo.
  //
  // O NÚMERO REAL DE CHAMADAS: NÃO é "uma por carregamento", como o plano
  // desta branch (docs/plans/2026-09-15-a-capa-que-apodrece.md) chegou a
  // dizer — corrigido lá. `resolvePosts` (lib/media-lookup.ts) faz
  // `getMedia(limit=40)` MAIS até `MAX_INDIVIDUAL_LOOKUPS = 8` buscas avulsas
  // para o que não estiver nos 40 recentes — até 9 chamadas por carregamento
  // desta tela, e isso se repete a cada `revalidatePath("/automacoes")`
  // (salvar, ativar, pausar, duplicar, excluir).
  //
  // A CONSEQUÊNCIA: automação apontando para um post fora dos 40 recentes só
  // resolve capa nas 8 primeiras dessa sobra — o resto fica sem capa. A tela
  // não vira "22 capas certas"; vira "recentes + 8". Isso é esperado, e não
  // um defeito novo para abrir depois.
  const idsDosPosts = [
    ...new Set(automations.map((a) => a.media_id).filter((id): id is string => !!id)),
  ];
  let capas = new Map<string, PostRef>();
  if (account && idsDosPosts.length) {
    // TETO DE TEMPO NO CALL SITE, o mesmo padrão de app/page.tsx: `graphFetch`
    // (lib/ig.ts) não tem `AbortController` nem timeout próprio, então uma
    // Graph API que aceita a conexão e nunca responde travaria esta tela
    // inteira sem esta corrida. `resolvePosts` já tem `try/catch` interno e
    // devolve mapa parcial ou vazio quando a Meta falhar — o `try/catch` aqui
    // é a segunda rede, para o que ele não cobre. Sem capa a lista renderiza
    // igual; sem a tela, nada renderiza.
    const TETO_DA_CAPA_MS = 2500;
    // `idDoTimer` SAI DA CORRIDA porque `resolvePosts` normalmente ganha
    // antes do teto — e um `setTimeout` que ninguém cancela sobrevive ao
    // `await`, pendurado por 2,5s a cada carregamento desta tela (nit: o
    // processo do Node segue rodando de qualquer jeito, mas um timer solto
    // por requisição não é o padrão a copiar). `clearTimeout` depois da
    // corrida é inofensivo mesmo quando é o próprio timer que venceu.
    let idDoTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      capas = await Promise.race([
        resolvePosts(account.ig_user_id, account.access_token, idsDosPosts),
        new Promise<Map<string, PostRef>>((resolve) => {
          idDoTimer = setTimeout(() => resolve(new Map()), TETO_DA_CAPA_MS);
        }),
      ]);
    } catch (e) {
      console.error("automações: as capas dos posts falharam", e);
    } finally {
      clearTimeout(idDoTimer);
    }
  }

  // Só o que a lista precisa — a data vira string para atravessar a fronteira
  // servidor → cliente sem surpresa de serialização.
  const rows: AutomationRow[] = automations.map((a) => {
    const post = a.media_id ? capas.get(a.media_id) : undefined;
    return {
      id: a.id,
      name: a.name,
      active: a.active,
      triggers: a.triggers,
      keywords: a.keywords,
      match_type: a.match_type,
      created_at: new Date(a.created_at).toISOString(),
      // SEM `?? a.story_thumbnail_url`: aquela coluna é a MESMA classe de URL
      // assinada do CDN do Instagram que expira em ~2 semanas — e story
      // expira em 24h de qualquer jeito, então ela já teria apodrecido bem
      // antes de qualquer automação de story chegar a esta tela. Sem busca
      // fresca para substituí-la (fora de escopo — zero automações usam
      // story, medido), usá-la aqui garantiria `<img>` quebrado. Story fica
      // sem capa na lista, o que é honesto: nenhuma capa é melhor que uma
      // capa que mente.
      thumb: post?.thumb ?? null,
      // A LEGENDA GANHA UM RECUO: o que veio da Meta agora, o guardado depois.
      // `media_caption` não expira — é o nome que a pessoa reconhece quando a
      // busca falha e a capa não chega.
      postCaption: post?.caption ?? a.media_caption ?? null,
    };
  });

  return (
    <div className="space-y-6">
      {sp.erro && <div className={alertError}>{sp.erro}</div>}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className={pageTitle}>Automações</h1>
          <p className={pageSubtitle}>
            {account ? (
              <>
                {automations.length === 0
                  ? "Nenhuma automação"
                  : `${automations.length} ${
                      automations.length === 1 ? "automação" : "automações"
                    }`}{" "}
                em <span className="font-medium">@{account.username ?? account.ig_user_id}</span>
              </>
            ) : (
              "Conecte uma conta para começar"
            )}
          </p>
        </div>
        {account && automations.length > 0 && (
          <Link href="/automacoes/nova" className={btnPrimary}>
            Nova automação
          </Link>
        )}
      </div>

      {!account ? (
        <div className={`p-8 text-center text-sm ${card} ${muted}`}>
          Conecte uma conta do Instagram em{" "}
          <Link href="/setup" className={link}>
            Configuração
          </Link>{" "}
          para criar automações.
        </div>
      ) : rows.length === 0 ? (
        <ListaVazia />
      ) : (
        <AutomationsList automations={rows} />
      )}
    </div>
  );
}
