// OS PARÂMETROS DA CHAMADA À IA PARA O CARROSSEL, PUROS, para o teste ver o que sai sem gastar
// nada. A política (modelo, esforço, fallback, sem cache) é a do bônus (ia-parametros.ts), e o
// formato da mensagem é o do `gerar` do Labs (site-ia, src/lib/ia/gerar.ts): "Tema", "O que
// deve resolver" e o pedido extra no fim.
//
// O QUE MUDA A CADA PEDIDO VAI NA MENSAGEM, E NUNCA NA INSTRUÇÃO: a instrução é a do Labs,
// intacta. O total, a palavra e o bônus mudam; ela não.
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { slidesDeConteudo } from "./carrossel-pedido";
import { CarrosselDoChatSchema, PostDoChatSchema } from "./carrossel-schema";
import { BETA_DO_FALLBACK, MODELO } from "./ia-parametros";
import { INSTRUCAO_CARROSSEL } from "./instrucao-carrossel";
import { INSTRUCAO_POST } from "./instrucao-post";

/** O que o Labs dizia do bônus no momento do pedido, mais o que o operador pediu na Etapa 1. */
export type ContextoDoCarrossel = { tema: string; titulo: string; descricao: string; oQueResolve: string };

export type PedidoParaIA = { total: number; palavra: string; contexto: ContextoDoCarrossel };

/** O contexto como a action o gravou em `carrosseis_gerados.contexto`. Forma errada → null. */
export function contextoGravado(v: unknown): ContextoDoCarrossel | null {
  if (v === null || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const { tema, titulo, descricao, oQueResolve } = o;
  if (
    typeof tema !== "string" ||
    typeof titulo !== "string" ||
    typeof descricao !== "string" ||
    typeof oQueResolve !== "string"
  ) {
    return null;
  }
  return { tema, titulo, descricao, oQueResolve };
}

/**
 * O PEDIDO É MAIS ESTREITO QUE A CONFERÊNCIA: a mensagem proíbe na chamada toda outra palavra em
 * maiúsculas, menos VENCE, e `outrasGritadas` (carrossel-texto.ts) ainda deixa passar as exceções
 * do Labs. Pedir mais do que se confere poupa gerações recusadas.
 */
function pedirPalavra(palavra: string): string {
  return (
    `Na chamada para ação, peça para comentar a palavra ${palavra}, escrita exatamente assim, em maiúsculas, e termine a legenda no mesmo pedido. ` +
    "Na chamada, nenhuma outra palavra vai toda em maiúsculas, fora VENCE do bordão."
  );
}

/**
 * O pedido que muda a cada geração. O TOTAL SUBSTITUI a faixa de 6 a 9 que a instrução do
 * carrossel escreve (no parágrafo dos slides do meio e no campo `slides`), porque aqui o total vai
 * de 2 a 10; e o post único leva o teto de 300 que o formato impõe (a instrução do post fala em
 * "~350" no campo `texto`). Achado 47 do auditor.
 */
export function pedidoExtra(total: number, palavra: string): string {
  if (total === 1) {
    return (
      "Este post PEDE uma ação: preencha `chamadaParaAcao`. " +
      pedirPalavra(palavra) +
      " O texto da imagem tem no máximo 300 caracteres."
    );
  }
  const conteudo = slidesDeConteudo(total);
  const meio =
    conteudo === 0
      ? "Ou seja, nenhum slide de conteúdo: o campo `slides` vem vazio."
      : `Ou seja, ${conteudo} slides de conteúdo entre os dois.`;
  return (
    `Este post precisa ter ${total} slides no total, contando o gancho e a chamada para ação. ${meio} ` +
    `Esse número substitui a faixa de 6 a 9 da instrução. ${pedirPalavra(palavra)}`
  );
}

export function mensagemDoCarrossel(p: PedidoParaIA): string {
  const c = p.contexto;
  return (
    `Tema: ${c.tema}\n\nO que deve resolver:\n${c.oQueResolve}\n\n` +
    `O bônus que este post divulga: "${c.titulo}". ${c.descricao}\n\n` +
    pedidoExtra(p.total, p.palavra)
  );
}

/** De 2 a 10 slides. */
export function parametrosDoCarrossel(p: PedidoParaIA) {
  return {
    model: MODELO,
    max_tokens: 16_000,
    betas: [BETA_DO_FALLBACK],
    fallbacks: "default" as const,
    system: INSTRUCAO_CARROSSEL,
    messages: [{ role: "user" as const, content: mensagemDoCarrossel(p) }],
    output_config: { effort: "high" as const, format: betaZodOutputFormat(CarrosselDoChatSchema) },
  };
}

/** 1 slide: o post de imagem única, com instrução própria (ver o topo de instrucao-post.ts). */
export function parametrosDoPost(p: PedidoParaIA) {
  return {
    model: MODELO,
    max_tokens: 16_000,
    betas: [BETA_DO_FALLBACK],
    fallbacks: "default" as const,
    system: INSTRUCAO_POST,
    messages: [{ role: "user" as const, content: mensagemDoCarrossel(p) }],
    output_config: { effort: "high" as const, format: betaZodOutputFormat(PostDoChatSchema) },
  };
}
