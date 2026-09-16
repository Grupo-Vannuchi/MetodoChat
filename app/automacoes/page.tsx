import Link from "next/link";
import { sql, Automation } from "@/lib/db";
import { getSelectedAccount } from "@/lib/account";
import {
  resolvePosts,
  TETO_DA_CAPA_NA_TELA_MS,
  type PostRef,
} from "@/lib/media-lookup";
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
  // O NÚMERO REAL DE CHAMADAS, e ele MUDOU DE NATUREZA em 16/09/2026.
  //
  // `resolvePosts` (lib/media-lookup.ts) faz `getMedia(limit=40)` MAIS até
  // `MAX_INDIVIDUAL_LOOKUPS` buscas avulsas para o que não estiver nos 40
  // recentes. O que mudou é que essas chamadas agora são CACHEADAS na camada
  // semântica — lista dos recentes por 120 s, post pelo id por 6 h —, então
  // elas deixaram de sair a CADA CARREGAMENTO.
  //
  // MAS SAEM A CADA MUTAÇÃO, E ISSO NÃO É UM DETALHE: `revalidatePath`
  // DERRUBA TAMBÉM O CACHE DA META, e não só o da página. Lido na fonte do
  // Next 16.2.10 instalado:
  // node_modules/next/dist/server/lib/incremental-cache/file-system-cache.js:229-246
  // monta `combinedTags = [...ctx.tags, ...ctx.softTags]` e devolve `null` —
  // MISS INTEIRO, não stale — quando alguma delas está expirada; e as
  // `softTags` são as tags IMPLÍCITAS do render corrente, que `unstable_cache`
  // passa na leitura (unstable-cache.js:148-152). A implícita deste caminho é
  // `_N_T_/automacoes`, que é exatamente a que `revalidatePath("/automacoes")`
  // grava.
  //
  // CONSEQUÊNCIA: cada salvar, ativar, pausar, duplicar e excluir
  // (`actions.ts:383,470,587,612,663`) devolve esta tela ao CAMINHO FRIO
  // INTEIRO — 1 listagem + até `MAX_INDIVIDUAL_LOOKUPS` avulsas, os ~1,2 s
  // medidos em 16/09/2026. E não para por aqui: `selectAccount`
  // (`app/account-actions.ts:39`) faz `revalidatePath("/", "layout")`, cuja
  // tag `_N_T_/layout` é implícita em TODO render — trocar de conta zera a
  // capa das QUATRO telas de uma vez.
  //
  // E A MEDIÇÃO DE ACEITAÇÃO DO PLANO NÃO PEGA ISSO. Ela manda recarregar
  // `/automacoes` três vezes seguidas, SEM mutação no meio: mede o caminho
  // comum, onde o ganho é real, e nunca dispara `revalidatePath`. Depois de
  // uma mutação o caminho é frio de novo, então aqueles três cronômetros não
  // têm como acusar o custo do fluxo de trabalho desta tela. Medir esse fluxo
  // é outra medição — salvar uma automação, recarregar, cronometrar — e ela
  // não foi feita.
  //
  // Este comentário já disse "MAX_INDIVIDUAL_LOOKUPS = 8", "até 9 chamadas por
  // carregamento" e "a tela vira recentes + 8". As três frases ficaram falsas
  // no mesmo dia em que o teto subiu para 32, e o texto sobreviveu a elas —
  // por isso está reescrito com o número vindo da constante, e não copiado.
  //
  // MEDIDO em 16/09/2026 contra a Meta, com o token da conta DONA de cada post
  // (a primeira medição errou isso e cruzou conta com token, o que faz TODA
  // busca avulsa devolver 400): listagem dos 40 = 498 ms; 8 avulsas em
  // paralelo = 497 ms; 21 = 572 ms; 32 = 721 ms. Subir o teto custa ~200 ms no
  // caminho frio, uma vez por janela de cache, e é o que tira esta tela de
  // "recentes + 8": das 23 automações com post da conta do painel, 18 estavam
  // fora dos 40 recentes e só 8 resolviam capa.
  const idsDosPosts = [
    ...new Set(automations.map((a) => a.media_id).filter((id): id is string => !!id)),
  ];
  let capas = new Map<string, PostRef>();
  if (account && idsDosPosts.length) {
    // TETO DE TEMPO NO CALL SITE — HOJE ELE É A REDE DE FORA, E NÃO A ÚNICA.
    //
    // O teto de verdade passou para dentro de `resolvePosts`:
    // `TETO_DA_RESOLUCAO_MS` = 2000 ms (lib/media-lookup.ts), orçamento TOTAL
    // das duas etapas. Antes, o número certo aqui era "~16s" — duas etapas
    // encadeadas, cada uma até o `TETO_DA_LEITURA_MS` de 8 s do `graphFetch`
    // (lib/ig.ts) — e esta corrida era a ÚNICA proteção da tela. Não é mais:
    // ela agora vence depois do teto de dentro, e por isso quase nunca vence.
    //
    // E POR QUE ELA FICA. O de dentro devolve MAPA PARCIAL quando vence — as
    // capas que a listagem dos 40 já tinha resolvido de graça ficam. Esta
    // corrida, quando vencia, devolvia `new Map()`: descarte tudo ou nada, tela
    // sem capa nenhuma. Ela sobra só para o que o teto de dentro não cobre (a
    // função travar antes de marcar o próprio início, por exemplo), junto com o
    // `try/catch` abaixo. Sem capa a lista renderiza igual; sem a tela, nada
    // renderiza.
    // `idDoTimer` SAI DA CORRIDA porque `resolvePosts` normalmente ganha
    // antes do teto — e um `setTimeout` que ninguém cancela sobrevive ao
    // `await`, pendurado por todo o teto a cada carregamento desta tela (nit: o
    // processo do Node segue rodando de qualquer jeito, mas um timer solto
    // por requisição não é o padrão a copiar). `clearTimeout` depois da
    // corrida é inofensivo mesmo quando é o próprio timer que venceu.
    // FALSO POSITIVO DE ALCANCE DA REGRA, e por isso o silêncio vem com motivo.
    //
    // `react-hooks/immutability` ("Cannot reassign variable after render
    // completes") é uma das regras novas do React Compiler em
    // `eslint-plugin-react-hooks` 7.1.1, e ela fala sobre PUREZA DE RENDER no
    // cliente, onde um render pode ser repetido. Este arquivo é um Server
    // Component `async` (`export default async function AutomacoesPage`, sem
    // `"use client"`), que roda UMA vez por requisição no servidor e pode dar
    // `await` — a versão 7.1.1 do plugin não distingue os dois casos e trata
    // todo arquivo como cliente.
    //
    // A reatribuição aqui é a forma normal de guardar o id de um `setTimeout`
    // criado dentro do executor de uma `Promise`, e ela existe justamente para o
    // `clearTimeout` do `finally` poder cancelar o timer quando `resolvePosts`
    // ganha a corrida — sem ela, um timer solto sobrevive a cada carregamento.
    //
    // O SILÊNCIO FICA NA ATRIBUIÇÃO, e não na declaração: a regra acusa o
    // `idDoTimer = ...` lá dentro do executor, não o `let` daqui.
    let idDoTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      capas = await Promise.race([
        resolvePosts(account.ig_user_id, account.access_token, idsDosPosts),
        new Promise<Map<string, PostRef>>((resolve) => {
          // eslint-disable-next-line react-hooks/immutability
          idDoTimer = setTimeout(() => resolve(new Map()), TETO_DA_CAPA_NA_TELA_MS);
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
