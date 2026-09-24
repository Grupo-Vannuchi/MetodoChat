import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import MessageField from "@/app/automacoes/variable-picker";
import Previa from "@/app/automacoes/editor/previa";
import { campoPorChave } from "@/lib/campos";
import type { Passo } from "@/lib/steps";

// AS DUAS PRÉVIAS DO EDITOR, NA MESMA TELA, SOBRE A MESMA MENSAGEM.
//
// O DEFEITO MEDIDO, montando uma automação de verdade na produção: o dono
// escrevia `Anotei: {{telefone}} - fim do teste.` e lia, ao mesmo tempo, duas
// respostas diferentes sobre o que o lead recebe —
//
//   a do CAMPO (`app/automacoes/variable-picker.tsx`): "Vai chegar assim:
//     Anotei: (11) 99999-9999 - fim do teste.";
//   a da CONVERSA (o celular à direita): `Anotei: {{telefone}} - fim do teste.`,
//     com o token CRU.
//
// A ERRADA ERA A DA CONVERSA, e quem decide isso é o cabeçalho dela
// (`quadro.tsx`): "Como a lista fica para quem recebe, agora — antes de salvar".
// Quem recebe lê o VALOR ou nada — `renderVariables` (lib/variables.ts) nunca
// entrega `{{telefone}}` a ninguém.
//
// POR QUE O CASO É DE DOM, e não mais um em `tests/editor-roteiro.test.ts`: a
// pergunta aqui não é "o roteiro resolve?" — aquela é pura, tem caso lá, e é a
// que prende a correção. A pergunta daqui é a do defeito: DUAS TELAS, uma ao
// lado da outra, dizendo a MESMA coisa sobre a mesma mensagem. Uma delas
// (`MessageField`) é componente e não tem função pura por onde ser perguntada, e
// a outra só mostra o que o roteiro devolve se o JSX dela de fato imprimir o
// `texto` da bolha. Nenhum caso puro alcança as duas juntas.
//
// COMO AS DUAS FRASES SÃO ACHADAS: `getAllByText` casa pelo texto DIRETO do
// elemento (os filhos que são nó de texto, sem descer nos filhos-elemento), e
// nas duas telas a mensagem é exatamente isso — no campo, o `<p>` tem o "Vai
// chegar assim:" dentro de um `<span>` e a mensagem solta ao lado; na conversa,
// o `<p>` do balão tem só a mensagem. Então a mesma busca acha uma frase em cada
// tela, e o caso compara as duas sem precisar saber qual é qual.
//
// E A COMPARAÇÃO LÊ O MESMO TEXTO DIRETO, e não o `textContent`: o rótulo "Vai
// chegar assim:" é um `<span>` DENTRO do `<p>` do campo, então o `textContent`
// traria o rótulo de uma tela e não da outra, e as duas nunca poderiam ser
// iguais. Comparar pela mesma noção com que elas foram achadas é o que faz a
// igualdade falar da MENSAGEM, e não da moldura de cada tela.

/** O texto solto de um elemento — os filhos que são nó de texto, sem os `<span>` de moldura. */
function textoDireto(el: Element): string {
  return Array.from(el.childNodes)
    .filter((n) => n.nodeType === n.TEXT_NODE)
    .map((n) => n.textContent ?? "")
    .join("");
}

const DO_TELEFONE = campoPorChave("telefone")!.exemplo;

/** As duas prévias montadas juntas, como ficam no editor. */
function asDuasPrevias(texto: string) {
  render(
    <>
      <MessageField name="texto" label="Mensagem" value={texto} onChange={() => {}} />
      <Previa
        passos={[{ id: "b_dm00001", tipo: "dm", texto }] as Passo[]}
        gatilho="dm"
        ligacoes={[]}
        palavras={["oi"]}
        correspondencia="contains"
        post={null}
        story={null}
        selecionado={null}
      />
    </>
  );
  // A âncora é a parte da mensagem que NÃO tem token: ela é igual nas duas
  // telas aconteça o que acontecer com a variável, então a busca continua
  // achando as duas frases mesmo quando elas discordam — que é justamente o
  // caso que este arquivo precisa conseguir ver falhar.
  //
  // SÓ `<p>`, E A EXCLUSÃO É DE UM TERCEIRO ACHADO LEGÍTIMO: o `<textarea>` que
  // se está editando também casa com a âncora, porque ele guarda o texto CRU —
  // com `{{telefone}}` escrito, que é o certo, é o que o dono digitou. Ele não é
  // prévia de nada, e sem este filtro ele entraria na comparação e faria as duas
  // prévias "discordarem" por causa do campo de edição.
  return screen.getAllByText(/^Anotei:/, { selector: "p" }).map(textoDireto);
}

describe("as duas prévias do editor", () => {
  it("dizem a MESMA frase sobre a mesma mensagem", () => {
    const frases = asDuasPrevias("Anotei: {{telefone}} - fim do teste.");
    // DUAS, e a contagem é o que impede o caso de passar por vacuidade: se uma
    // das prévias deixar de desenhar a mensagem, o conjunto de uma frase só
    // continuaria "concordando" consigo mesmo.
    expect(frases).toHaveLength(2);
    expect(new Set(frases).size, `as prévias discordam: ${JSON.stringify(frases)}`).toBe(1);
  });

  it("e a frase é o VALOR, e não o token cru", () => {
    // Concordar não basta: as duas poderiam concordar no token cru, que é a
    // metade errada do defeito. O que o lead recebe é o exemplo do catálogo.
    const frases = asDuasPrevias("Anotei: {{telefone}} - fim do teste.");
    for (const frase of frases) {
      expect(frase).toBe(`Anotei: ${DO_TELEFONE} - fim do teste.`);
      expect(frase).not.toContain("{{");
    }
  });

  it("concordam também no token que o envio APAGA", () => {
    // `{{123}}` é chave que `formaDaChave` (lib/campos.ts) recusa: o envio não
    // acha valor nenhum e o token some da mensagem. É o limite declarado de
    // `previewVariables` (lib/variables.ts), e ele vale nas duas telas porque as
    // duas chamam a MESMA função — se a conversa ganhasse régua própria, é aqui
    // que a terceira regra apareceria.
    const frases = asDuasPrevias("Anotei: {{123}} - fim do teste.");
    expect(frases).toHaveLength(2);
    for (const frase of frases) expect(frase).toBe("Anotei:  - fim do teste.");
  });
});
