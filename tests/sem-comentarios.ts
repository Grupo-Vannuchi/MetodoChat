// O RECORTE QUE OS PORTÕES TEXTUAIS USAM — num lugar só.
//
// Vários testes desta suíte leem código-fonte como texto para prender fiação
// (`tests/vocabulario-da-fila.test.ts`, `tests/cache-da-capa.test.ts`,
// `tests/avatar-recuo.test.ts`, `tests/teto-de-fora.test.ts`). Todos precisam da
// mesma coisa antes de procurar: tirar da vista o que NÃO é código.
//
// POR QUE COM DONO, e a história é de 16/09/2026: existiam DUAS cópias desta
// função, com o mesmo nome e comportamentos diferentes — uma já tirava template
// literal e a outra não. Uma correção de defeito vivia só numa delas. É o mesmo
// gênero de deriva que estes portões existem para impedir, acontecendo dentro
// dos próprios portões.

/**
 * A fonte sem comentário, sem literal de texto e sem template literal.
 *
 * SEM ISSO, um portão textual se satisfaz com MENÇÃO: escrever o nome da função
 * certa num comentário, ou numa string, pagaria a conta — e a explicação de uma
 * decisão viraria o álibi de tê-la desfeito.
 *
 * A ORDEM IMPORTA, e ela nasceu de um defeito medido. Tirar comentário PRIMEIRO
 * decapita a crase de fechamento quando há `//` dentro do template — e nesta
 * base há: URL e comentário de SQL (`--`) dentro de consulta escrita entre
 * crases. A crase órfã casava com a próxima e ENGOLIA o meio do arquivo: num
 * plantio, cerca de 50 linhas sumiram da vista do portão e um número cru passou
 * verde. Tirando o template literal primeiro, o `//` de dentro dele vai junto.
 *
 * O LIMITE HONESTO: isto NÃO é um analisador de TypeScript, e não precisa ser.
 * `${...}` aninhado não é entendido, e um `//` de comentário que contenha uma
 * crase ÍMPAR ainda desequilibra. A defesa contra os dois é a mesma e está do
 * lado de quem chama: todo portão desta base tem um caso "enxerga o que diz
 * enxergar", que exige que âncoras conhecidas SOBREVIVAM ao recorte. Se o
 * recorte comer o arquivo, é esse caso que fica vermelho — e não o portão
 * inteiro que fica mudo.
 */
export function semComentariosNemTexto(fonte: string): string {
  return (
    fonte
      // 1. TEMPLATE LITERAL PRIMEIRO — ver o parágrafo da ordem, acima.
      .replace(/`(?:[^`\\]|\\.)*`/g, "``")
      // 2. Comentário de bloco e de linha. O `//` só cai quando NÃO vem depois
      //    de `:`, para `https://` continuar inteiro (de `tests/escala.test.ts`).
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/(^|[^:])\/\/.*$/gm, "$1")
      // 3. E os literais de texto.
      .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
      .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
  );
}
