// A CAPA DO POST NÃO APODRECE — /automacoes para de ler do banco uma URL que
// expira.
//
// -----------------------------------------------------------------------------
// O DEFEITO MEDIDO EM 15/09/2026
//
// Em /automacoes: 22 imagens, 19 quebradas. `media_thumbnail_url` é uma URL
// assinada do CDN do Instagram, e ela expira em ~2 semanas — uma automação de
// 31/08 já devolvia 403 quando medida. `lib/media-lookup.ts` já resolvia esse
// mesmo problema para /eventos e para o Início: capa e link do post buscados
// NA HORA de exibir, nunca guardados. Esta suíte prende /automacoes na mesma
// regra.
//
// -----------------------------------------------------------------------------
// POR QUE ESTE CASO NÃO DEPENDE DE A META RESPONDER
//
// O token semeado abaixo é inventado — não vale nada contra a Graph API de
// verdade. Isso é DE PROPÓSITO, e não uma lacuna: `resolvePosts`
// (lib/media-lookup.ts) tem `try/catch` interno e devolve mapa vazio quando a
// busca falha, e é exatamente esse ramo que este caso mede. A pergunta não é
// "a Meta respondeu com a capa certa?" — é "quando a Meta NÃO responde, a URL
// podre do banco ainda assim vaza para a tela?". Se vazar, o caso fica
// vermelho. Se a tela ficar sem capa, o caso passa: sem capa é o desfecho
// certo, imagem quebrada não é.
//
// -----------------------------------------------------------------------------
// POR QUE ESTE ARQUIVO NÃO USA `textoDaArvore` PARA A ASSERÇÃO PRINCIPAL —
// E ISSO FOI MEDIDO, NÃO SUPOSTO.
//
// O padrão de `nao-saiu.integracao.ts` é chamar a página dentro de
// `comoNumaRequisicao` e ler o resultado com `textoDaArvore`. Tentei exatamente
// isso primeiro, e o `toContain("Carrossel de teste")` deu VERMELHO mesmo
// depois da correção — não por a correção estar errada, mas porque a asserção
// não conseguia enxergar a linha nenhuma.
//
// A CAUSA: `AutomationsList` (./list-client.tsx) é `"use client"`, e a página
// a invoca UMA VEZ, com a lista inteira num prop só — `<AutomationsList
// automations={rows} />`. `textoDaArvore` (ver o cabeçalho dela) NUNCA executa
// o componente filho — ela anda pelo ELEMENTO (`{ type, props }`) sem chamar
// `type` — e só imprime um prop se o valor for STRING ou NUMBER, ou desce
// quando a chave é `children`. `automations` não é nem uma coisa nem outra: é
// um ARRAY DE OBJETOS. Resultado: nenhuma miniatura, nenhuma legenda, nenhum
// `id` de linha chega a `textoDaArvore` — a URL podre "desaparece" tanto com o
// defeito quanto sem ele. Um `not.toContain(PODRE)` sobre esse texto passaria
// SEMPRE, vazando ou não — a mesma armadilha de asserção vazia que o cabeçalho
// de `nao-saiu.integracao.ts` describe alhures ("Nada precisa de você agora").
//
// A SAÍDA: `acharLinhas`, abaixo, anda pela MESMA árvore que `textoDaArvore`
// caminha — sem jamais tocar `type` de elemento nenhum, e por isso sem cruzar
// o `<Link>` que faz `JSON.stringify` estourar — só que, em vez de filtrar por
// tipo primitivo, ela procura o prop chamado `automations` e o devolve inteiro.
// O array em si não tem elemento React dentro (é dado de linha: id, thumb,
// legenda, string e boolean puros), então inspecioná-lo direto é seguro — o
// mesmo motivo que `textoDaArvore` já invoca para não estourar.
import { beforeAll, describe, expect, test } from "vitest";
import { bancoDescartavel } from "./harness";
import { comoNumaRequisicao } from "./semear-requisicao";
import type { AutomationRow } from "@/app/automacoes/list-client";

const banco = bancoDescartavel();

const CONTA = "17900000000000901";
// Inventado, não vale nada — a mesma disciplina de `nao-saiu.integracao.ts`.
const TOKEN = "token-da-capa-que-nao-apodrece-que-nao-vale-nada";

type ModuloTelaDeAutomacoes = typeof import("@/app/automacoes/page");
let telaDeAutomacoes: ModuloTelaDeAutomacoes;

beforeAll(async () => {
  telaDeAutomacoes = (await import("@/app/automacoes/page")) as ModuloTelaDeAutomacoes;

  await banco.db().upsertAccount({
    ig_user_id: CONTA,
    username: "conta_da_capa_que_nao_apodrece",
    name: "conta_da_capa_que_nao_apodrece",
    profile_picture_url: null,
    access_token: TOKEN,
    token_expires_at: null,
  });
});

// ---------------------------------------------------------------------------
// Semear e ler. Nada aqui decide nada — a decisão é da página.
// ---------------------------------------------------------------------------

let semente = 0;

/** Uma automação presa a um post, gravada direto — como o editor grava. */
async function semearAutomacao(item: {
  mediaId: string;
  thumb: string | null;
  caption: string;
}): Promise<string> {
  semente++;
  const linhas = (await banco
    .db()
    .sql()
    .query(
      `insert into automations
         (account_id, name, active, triggers, keywords, match_type,
          media_id, media_thumbnail_url, media_caption, steps, ligacoes)
       values ($1, $2, true, '{dm}'::text[], '{}'::text[], 'contains',
               $3, $4, $5, '[]'::jsonb, '[]'::jsonb)
       returning id`,
      [
        CONTA,
        `automação da capa que não apodrece ${semente}`,
        item.mediaId,
        item.thumb,
        item.caption,
      ]
    )) as { id: string }[];
  return linhas[0].id;
}

/** Acha o prop `automations` na árvore — ver o cabeçalho para o porquê. */
function acharLinhas(no: unknown): AutomationRow[] | null {
  if (no === null || no === undefined || typeof no !== "object") return null;
  if (Array.isArray(no)) {
    for (const filho of no) {
      const achado = acharLinhas(filho);
      if (achado) return achado;
    }
    return null;
  }
  const props = (no as { props?: Record<string, unknown> }).props;
  if (!props || typeof props !== "object") return null;
  if (Array.isArray(props.automations)) return props.automations as AutomationRow[];
  for (const valor of Object.values(props)) {
    const achado = acharLinhas(valor);
    if (achado) return achado;
  }
  return null;
}

async function linhasDasAutomacoes(): Promise<AutomationRow[]> {
  const { valor } = await comoNumaRequisicao("/automacoes", () =>
    telaDeAutomacoes.default({ searchParams: Promise.resolve({}) })
  );
  const linhas = acharLinhas(valor);
  if (!linhas) {
    throw new Error(
      "`acharLinhas` não achou o prop `automations` na árvore de /automacoes — " +
        "a estrutura da página (ou de AutomationsList) mudou, e este achador " +
        "precisa acompanhar."
    );
  }
  return linhas;
}

describe("a capa de /automacoes não apodrece", () => {
  const PODRE = "https://scontent.cdninstagram.com/v/expirada-ha-semanas.jpg";

  test("a URL guardada no banco NÃO chega na tela", async () => {
    // A prova do defeito de 15/09/2026: 19 de 22 imagens quebradas em
    // /automacoes, porque a tela lia uma URL assinada que expira em ~2 semanas.
    // Este caso não depende da Meta responder: ele exige que o valor PODRE do
    // banco não seja usado. Se a busca na hora falhar (e com o token inventado
    // acima ela vai falhar), a tela fica sem capa — que é o desfecho certo, e
    // não uma imagem quebrada.
    await semearAutomacao({
      mediaId: "17900000000000001",
      thumb: PODRE,
      caption: "Carrossel de teste",
    });

    const linhas = await linhasDasAutomacoes();

    expect(linhas.some((l) => l.thumb === PODRE)).toBe(false);
    // E a legenda CONTINUA aparecendo, porque legenda não apodrece: a busca
    // falhou, mas `media_caption` é o recuo guardado, e ele não tem prazo de
    // validade.
    expect(linhas.some((l) => l.postCaption === "Carrossel de teste")).toBe(true);
  });
});
