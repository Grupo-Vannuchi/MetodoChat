// LER A ÁRVORE QUE UM COMPONENTE DE SERVIDOR DEVOLVE — em texto, e sem estourar.
//
// -----------------------------------------------------------------------------
// POR QUE ISTO EXISTE, E POR QUE NÃO É `JSON.stringify`
//
// O instrumento das telas desta base é o COMPONENTE DE VERDADE: os casos chamam
// a função da página dentro de um contexto de requisição
// (`./semear-requisicao.ts`) e leem a árvore que ela devolve. Não há DOM e não
// há renderizador — não é preciso: uma árvore de elementos React já carrega todo
// o texto, todo `href` e todo `value`, que é tudo o que esses casos exigem.
//
// O JEITO ÓBVIO DE VIRAR ISSO EM TEXTO É `JSON.stringify`, E ELE ESTOURA.
// Medido em 09/09/2026, nas duas telas do post que não saiu:
//
//     JSON.stringify(/publicar/agendados sem pendente) -> ESTOUROU
//     JSON.stringify(/)                                -> ESTOUROU
//     JSON.stringify(/publicar/agendados COM pendente) -> OK
//
//     "Converting circular structure to JSON --- property 'default' closes the
//      circle"
//
// A CAUSA É `next/link`. Fora do empacotador do Next, o módulo dele resolve para
// um objeto CommonJS cujo `default` aponta para o próprio módulo, e esse objeto
// vira o `type` do elemento `<Link>` — que `JSON.stringify` visita.
//
// E ISSO É UMA ARMADILHA, E NÃO UM DETALHE. `agendados.integracao.ts` usou
// `JSON.stringify` durante meses sem tropeçar — POR SORTE, e não por desenho:
// todo caso daquele arquivo semeia um item PENDENTE, então a tela nunca cai no
// estado vazio, que é o único lugar onde ela desenha um `<Link>`. A primeira
// pessoa a escrever um caso de estado vazio ali receberia um rastro de pilha
// sobre `next/link` no lugar de um vermelho sobre o teste dela — e gastaria a
// tarde procurando o defeito no lugar errado.
//
// -----------------------------------------------------------------------------
// ENTÃO A LEITURA DESCE PELA ÁRVORE, e não pelo objeto.
//
// Ela junta o texto, a `key` e os `props` de valor simples, e NÃO VISITA O
// `type` DE ELEMENTO NENHUM — que é onde mora o ciclo. Além de não estourar, ela
// não arrasta as entranhas do Next para dentro do texto onde os `toContain`
// procuram: o que sai é o que a tela DIZ, e não o que o Next carregou para
// dizê-lo.

/** O texto, as `key` e os `props` simples de uma árvore de elementos React. */
function descer(no: unknown, saida: string[]): string[] {
  if (no === null || no === undefined || typeof no === "boolean") return saida;
  if (typeof no === "string" || typeof no === "number") {
    saida.push(String(no));
    return saida;
  }
  if (Array.isArray(no)) {
    for (const filho of no) descer(filho, saida);
    return saida;
  }
  if (typeof no !== "object") return saida;
  const elemento = no as { key?: unknown; props?: unknown };
  // A `key` é onde o identificador da linha aparece — é por ela que os casos
  // perguntam se um item entrou ou não na lista.
  if (typeof elemento.key === "string") saida.push(elemento.key);
  const props = elemento.props;
  if (props && typeof props === "object") {
    for (const [chave, valor] of Object.entries(props as Record<string, unknown>)) {
      if (chave === "children") descer(valor, saida);
      else if (typeof valor === "string" || typeof valor === "number") {
        saida.push(`${chave}=${valor}`);
      }
    }
  }
  return saida;
}

/**
 * A árvore que um componente de servidor devolveu, em texto.
 *
 * UMA LINHA POR PEDAÇO. O `\n` entre eles é o que impede dois textos vizinhos de
 * colarem e formarem uma frase que a tela nunca escreveu — um `toContain` sobre
 * essa frase inventada passaria, e mediria o nada.
 *
 * OS `props` SAEM COMO `chave=valor` (`href=/publicar`, `value=<id>`,
 * `name=fuso`), que é a forma que os casos usam para perguntar por um campo de
 * formulário ou pelo destino de um link.
 */
export function textoDaArvore(no: unknown): string {
  return descer(no, []).join("\n");
}
