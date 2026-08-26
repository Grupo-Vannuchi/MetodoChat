// O ÚNICO PONTO DE CHAMADA DA CONFERÊNCIA DE PARTIDA.
//
// `register` é chamada **uma vez** quando uma instância nova do servidor Next
// nasce, e **tem de terminar antes de o servidor aceitar requisições** — é a
// documentação do próprio Next que diz isso, em
// `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md`,
// e é exatamente o momento que o `ensureSchema` apagado ocupava sem ter onde
// morar: ele era chamado de 24 lugares porque não existia um lugar só.
//
// AGORA EXISTE, E É AQUI. Um ponto de chamada, uma vez por instância, antes da
// primeira requisição.
//
// -----------------------------------------------------------------------------
// O `NEXT_RUNTIME`, E POR QUE ELE NÃO É ZELO
//
// A mesma documentação diz que o Next chama `register` em TODOS os ambientes,
// inclusive no runtime Edge, e manda importar condicionalmente o que não roda
// nos dois. `lib/esquema.ts` importa `lib/db.ts`, que é `server-only` e abre
// socket TCP com o Postgres — no Edge isso não existe. O `import` mora DENTRO do
// `if`, e não no topo do arquivo, que é a forma que a documentação recomenda
// justamente para os efeitos ficarem todos num lugar.
//
// -----------------------------------------------------------------------------
// O QUE ACONTECE SE A CONFERÊNCIA REPROVAR
//
// A promessa é rejeitada, e a inicialização do servidor com ela. É o
// comportamento que se quer: **recusar servir é melhor do que servir errado em
// silêncio**, e o silêncio foi medido — sem a coluna `ligacoes`, uma automação
// de três blocos entrega UM bloco, com `ignorados = 0` e nenhum erro.
//
// A mensagem que sobe diz O QUE falta e COMO consertar. Ver `lib/esquema.ts`.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { exigirEsquema } = await import("./lib/esquema");
  await exigirEsquema();
}
