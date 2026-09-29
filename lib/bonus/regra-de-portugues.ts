// TRAZIDO COMO ESTÁ do Método Labs (site-ia, src/lib/ia/, commit 01e609f), quando o
// gerador passou a morar no Chat (decisão de 28/09). Em 29/09 o Labs deixou de gerar
// bônus pela tela (site-ia 4662222), mas a cópia de lá continua no repositório dele;
// esta é a que gera os bônus do Chat. Não edite o texto sem reconferir a régua do Labs
// numa geração real (spec, "A prova real").
// A REGRA DE PORTUGUÊS — uma só, usada pelas QUATRO instruções.
//
// ⚠️ **POR QUE EXISTE (09/09/2026): NENHUMA DAS QUATRO MANDAVA ESCREVER COM ACENTO.**
//
// O Eduardo levantou "sai sem acentuação" em 01/09, de novo em 02/09 e uma terceira vez em
// 09/09 — desta vez dizendo que vale para a MAIORIA dos prompts, não só o carrossel. Fui
// conferir: das quatro instruções, três não mencionavam acentuação **nenhuma vez**, e as duas
// menções da quarta diziam o CONTRÁRIO — que `slug` e `palavraChave` precisam ser sem acento,
// o que está certo e é outra coisa.
//
// O que existia era indireto: um teste conferindo que o TEXTO das instruções está acentuado,
// na teoria de que o modelo imita o registro do que lê. A teoria não é falsa, mas claramente
// não bastava — e três reclamações em nove dias é a medição disso.
//
// ⚠️ **FONTE ÚNICA, e não quatro cópias.** Quatro blocos de texto iguais divergiriam: alguém
// melhora um e os outros três ficam para trás, sem nada acusando. É o mesmo raciocínio que
// levou a geometria da arte para um módulo em 04/09.
//
// ⚠️ **ISTO INVALIDA O CACHE DE PREFIXO** das quatro instruções, uma vez. As instruções vão no
// `system` com `cache_control`, e cache é casamento de prefixo: qualquer byte novo derruba o
// que estava guardado. O custo é uma geração mais cara por instrução, uma vez só.

/**
 * Escrever em português correto — anexada às `REGRAS INEGOCIÁVEIS` das quatro instruções.
 *
 * ⚠️ **É ESPECÍFICA DE PROPÓSITO.** "Escreva bem" não muda comportamento nenhum: o modelo já
 * acha que escreve bem. Listar as palavras que mais aparecem sem acento dá ao pedido uma
 * forma que se pode obedecer — e, se voltar a falhar, uma forma que se pode conferir.
 */
export const REGRA_DE_PORTUGUES = `**Escreva em português do Brasil com ACENTUAÇÃO E GRAMÁTICA CORRETAS.** Não é preferência de estilo, é requisito do produto.

- **Acentue.** \`não\`, \`você\`, \`é\`, \`está\`, \`também\`, \`só\`, \`após\`, \`até\`, \`há\`, \`três\`, \`português\`, \`negócio\`, \`prático\`, \`análise\`, \`atenção\` — todas levam acento. Escrever sem não é registro informal, é erro.
- **Concorde.** Verbo com sujeito, adjetivo com substantivo. \`os dados mostram\`, não \`os dados mostra\`.
- **Use crase onde ela existe.** \`à noite\`, \`às vezes\`, \`devido à falta\`.
- **Pontue.** Frase sem ponto final e vírgula faltando entre orações também são erro.

A ÚNICA exceção são os campos que a lista de campos marca explicitamente como "sem acento" — eles são digitados à mão por quem recebe, e acento ali vira erro de digitação. Fora esses, tudo leva acento.

O texto que você devolve vai para o cliente do jeito que sai. Texto sem acento chega como descuido, e é a reclamação mais repetida sobre este gerador.`;
