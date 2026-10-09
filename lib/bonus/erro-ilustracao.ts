// Tradução das recusas da API de imagem da OpenAI para algo que quem opera o painel consegue
// agir a respeito.
//
// ⚠️ **MÓDULO PURO, separado de `ilustracao.ts` de propósito.** Aquele tem `server-only` e não
// pode ser importado por teste; este é o mesmo par que o projeto já usa em `payment-logic` ×
// `payments` e `schemas` × `gerar`. Sem a separação, esta tradução ficaria sem teste — e ela é
// exatamente o tipo de código que só roda quando algo já deu errado.
//
// ⚠️ **A VERSÃO ANTERIOR DESCARTAVA `error.message` NO 401 E NO 403, e isso custou um dia.**
// Em 18/09 a geração passou a falhar em produção com "A chave da OpenAI foi recusada. Confira
// se ela existe no servidor e se tem permissão de escrita em imagens." — texto nosso, genérico,
// que serve para quatro causas diferentes. A OpenAI dizia qual era no campo `message`, e nós
// jogávamos fora justamente ele. Agora o detalhe dela vai junto SEMPRE.
//
// ⚠️ **E 401 NÃO É 403.** Estavam na mesma condição:
//   401 = a chave não foi reconhecida (errada, revogada, colada com espaço, de outra conta);
//   403 = a chave é válida e o acesso ao MODELO foi negado — no caso do `gpt-image-1`, quase
//         sempre organização não verificada ou o modelo não liberado naquele projeto.
// São consertos em telas diferentes da OpenAI; juntá-los manda procurar no lugar errado.

/** O que a API devolve no corpo quando recusa. Só os campos que usamos. */
type CorpoDeErro = { error?: { code?: string; message?: string } } | null;

/** Códigos que significam saldo/cota, e não excesso de requisições. */
const SEM_CREDITO = ["credit_balance_exhausted", "insufficient_quota", "billing_hard_limit_reached"];

/**
 * ⚠️ **A MENSAGEM DO 401 DA OPENAI TRAZ UM PEDAÇO DA CHAVE** — o começo e o fim, mascarados no
 * meio ("Incorrect API key provided: sk-proj-AbC1****xY9z"). Ela vai para a tela de quem opera,
 * que pode ser um EDITOR sem acesso ao resto do painel, e fica gravada em `IlustracaoIA.erro`.
 * Mascarada não é utilizável, mas não tem por que sair do servidor. Achado pelo DEV do Método
 * Chat em 09/10, que copia este arquivo byte a byte: mudança aqui vai a ele antes do commit.
 */
const PEDACO_DA_CHAVE = /\bsk-[A-Za-z0-9_*-]+/g;

export function mensagemDaOpenAI(status: number, corpo: unknown): string {
  const erro = (corpo as CorpoDeErro)?.error ?? {};
  const detalhe = erro.message?.trim().replace(PEDACO_DA_CHAVE, "sk-…");
  // A mensagem da OpenAI entra entre parênteses depois da nossa — a nossa diz o que fazer, a
  // dela diz o que aconteceu. Nunca uma sem a outra.
  const com = (nossa: string) => (detalhe ? `${nossa} (OpenAI: ${detalhe})` : nossa);

  if (erro.code && SEM_CREDITO.includes(erro.code)) {
    return com("A conta da OpenAI está sem crédito. Adicione fundos em platform.openai.com → Billing.");
  }

  if (status === 429) {
    // ⚠️ 429 SOZINHO NÃO É FALTA DE CRÉDITO — é limite de requisições. A versão anterior
    // mandava "adicione fundos" para quem só precisava esperar um minuto.
    return com("A OpenAI recusou por limite de requisições. Espere alguns minutos e tente de novo.");
  }

  if (status === 401) {
    return com(
      "A OpenAI não reconheceu a chave. Ela CHEGOU ao servidor, então não é variável faltando: confira se foi copiada inteira (sem espaço no fim), se não foi revogada e se é da mesma conta que tem o crédito."
    );
  }

  if (status === 403) {
    return com(
      "A chave é válida, mas o acesso ao modelo de imagem foi negado. Confira, nesta ordem: 1) a organização está verificada em platform.openai.com → Settings → Organization (o gpt-image-1 exige verificação, e ela é separada de ter crédito); 2) o modelo está liberado no projeto dessa chave; 3) a chave tem permissão de escrita em imagens."
    );
  }

  if (status === 400) {
    return com("A OpenAI recusou o pedido.");
  }

  return com(`A OpenAI respondeu ${status}.`);
}
