// OS PARÂMETROS DA CHAMADA À IA PARA O CARROSSEL, PUROS, para o teste ver o que sai sem gastar
// nada. A política (modelo, esforço, fallback, sem cache) é a do bônus (ia-parametros.ts), e o
// formato da mensagem é o do `gerar` do Labs (site-ia, src/lib/ia/gerar.ts): "Tema", "O que
// deve resolver" e o pedido extra no fim.
//
// O QUE MUDA A CADA PEDIDO VAI NA MENSAGEM, E NUNCA NA INSTRUÇÃO: a instrução é a do Labs,
// intacta. O total, a palavra (ou, sem ela, a ação) e o bônus mudam; ela não.
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { pedidoDaAcao, type AcaoDaChamada } from "./acao-da-chamada";
import { slidesDeConteudo } from "./carrossel-pedido";
import { CarrosselDoChatSchema, PostDoChatSchema } from "./carrossel-schema";
import { BETA_DO_FALLBACK, MODELO } from "./ia-parametros";
import { INSTRUCAO_CARROSSEL } from "./instrucao-carrossel";
import { INSTRUCAO_POST } from "./instrucao-post";

/**
 * O que o Labs dizia do bônus no momento do pedido, mais o que o operador pediu na Etapa 1. O avulso
 * de um bônus do Labs (Etapa 7) usa a mesma forma, com o "O que destacar" no `oQueResolve`.
 */
export type ContextoDeBonus = { tema: string; titulo: string; descricao: string; oQueResolve: string };

/** O texto livre do carrossel avulso (Etapa 7): o tema e o conteúdo que o post divulga, sem bônus. */
export type ContextoLivre = { tipo: "livre"; tema: string; conteudo: string };

export type ContextoDoCarrossel = ContextoDeBonus | ContextoLivre;

/**
 * O pedido de uma geração. Com palavra, a chamada pede a palavra; sem palavra (spec da Etapa 8), a
 * ação escolhida pelo operador.
 */
export type PedidoParaIA =
  | { total: number; palavra: string; contexto: ContextoDoCarrossel }
  | { total: number; palavra: null; acao: AcaoDaChamada; contexto: ContextoDoCarrossel };

/** O que a chamada pede, no pedido extra: a palavra, ou a ação. */
export type ChamadaDoPedido = string | { acao: AcaoDaChamada };

/**
 * O contexto como a action o gravou em `carrosseis_gerados.contexto`. Forma errada → null. O de
 * bônus não tem `tipo` (as linhas de antes da Etapa 7 ficam como estão); um `tipo` desconhecido
 * também é forma errada, e não vira bônus.
 */
export function contextoGravado(v: unknown): ContextoDoCarrossel | null {
  if (v === null || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (o.tipo === "livre") {
    return typeof o.tema === "string" && typeof o.conteudo === "string" ? { tipo: "livre", tema: o.tema, conteudo: o.conteudo } : null;
  }
  if (o.tipo !== undefined) return null;
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
 * SEM PALAVRA-CHAVE (spec da Etapa 8): a instrução do Labs diz que o pedido padrão da chamada é
 * comentar uma palavra-chave (instrucao-carrossel.ts), e este trecho a contradiz, como o total já
 * contradiz a faixa de 6 a 9. Nenhuma palavra em maiúsculas: é a regra da conferência sem palavra.
 */
function pedirAcao(acao: AcaoDaChamada): string {
  return (
    `Na chamada para ação, ${pedidoDaAcao(acao)}. Este post não tem palavra-chave: não peça para comentar uma palavra. ` +
    "Na chamada, nenhuma palavra vai toda em maiúsculas, fora VENCE do bordão. Termine a legenda no mesmo pedido."
  );
}

function pedirChamada(c: ChamadaDoPedido): string {
  return typeof c === "string" ? pedirPalavra(c) : pedirAcao(c.acao);
}

/**
 * O pedido que muda a cada geração. O TOTAL SUBSTITUI a faixa de 6 a 9 que a instrução do
 * carrossel escreve (no parágrafo dos slides do meio e no campo `slides`), porque aqui o total vai
 * de 2 a 10; e o post único leva o teto de 300 que o formato impõe (a instrução do post fala em
 * "~350" no campo `texto`). Achado 47 do auditor.
 */
export function pedidoExtra(total: number, chamada: ChamadaDoPedido): string {
  if (total === 1) {
    return (
      "Este post PEDE uma ação: preencha `chamadaParaAcao`. " +
      pedirChamada(chamada) +
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
    `Esse número substitui a faixa de 6 a 9 da instrução. ${pedirChamada(chamada)}`
  );
}

/**
 * A mensagem do pedido. A do texto livre (Etapa 7) leva o tema e o conteúdo, e não fala de um bônus
 * nem do que ele resolve: não há bônus.
 */
export function mensagemDoCarrossel(p: PedidoParaIA): string {
  const c = p.contexto;
  const chamada: ChamadaDoPedido = p.palavra === null ? { acao: p.acao } : p.palavra;
  if ("tipo" in c) return `Tema: ${c.tema}\n\nO conteúdo que este post divulga:\n${c.conteudo}\n\n` + pedidoExtra(p.total, chamada);
  return (
    `Tema: ${c.tema}\n\nO que deve resolver:\n${c.oQueResolve}\n\n` +
    `O bônus que este post divulga: "${c.titulo}". ${c.descricao}\n\n` +
    pedidoExtra(p.total, chamada)
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
