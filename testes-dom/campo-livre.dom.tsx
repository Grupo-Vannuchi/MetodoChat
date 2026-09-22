import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Painel, { type Configuracao } from "@/app/automacoes/editor/painel";
import { conferirLista, type Passo } from "@/lib/steps";

// O NOME DO CAMPO LIVRE, NA TELA — e por que ele precisa de casos de DOM.
//
// O QUE O DONO DIGITA NÃO É O QUE FICA GRAVADO: ele escreve "Qual sua Cidade" e
// o que vai para o banco é `qual_sua_cidade`, porque é essa string que vira
// `{{qual_sua_cidade}}` numa mensagem e a coluna do CSV. Sem a tela mostrar a
// forma normalizada, o dono escreve a variável errada na mensagem seguinte e o
// texto sai com `{{Qual sua Cidade}}` cru para uma pessoa de verdade.
//
// A NORMALIZAÇÃO TEM UM DONO SÓ, `normalizarChaveLivre` (lib/campos.ts), e
// estes casos medem a TELA usando aquela função — não uma cópia dela. É a mesma
// razão de `chaveDoPedido` (lib/steps.ts) chamá-la em vez de reescrevê-la: as
// duas pontas têm de gravar a MESMA string, senão o dado da pessoa cai numa
// chave que nem a variável nem o CSV conhecem.
//
// O COMPONENTE É O `Painel`, e não um cartão próprio: quem desenha o corpo de
// um passo neste editor é ele (o arquivo inteiro é um `switch` por
// `passo.tipo`), e ele já é exportado. É o mesmo caminho de
// `testes-dom/aviso-do-pedido-de-dado.dom.tsx`, e usar outro componente aqui
// seria medir uma tela que ninguém abre.

const CONFIGURACAO: Configuracao = {
  nome: "automação de teste",
  ativo: false,
  gatilho: "dm",
  palavras: ["oi"],
  correspondencia: "contains",
  post: null,
  story: null,
  entregaSemPortao: false,
};

// Devolve o ÚLTIMO passo que o painel mandou gravar. É por aqui que os casos
// perguntam o que seria SALVO — e não só o que está desenhado —, porque é o
// passo gravado que `conferirLista` confere e que trava o botão de salvar.
function abrirPainelCom(passo: { tipo: string; [k: string]: unknown }) {
  const gravados: Passo[] = [];
  render(
    <Painel
      // O bloco vem CRU do banco em produção (`passosDoBanco`,
      // app/automacoes/[id]/page.tsx afirma `Passo` sobre um `unknown`).
      passo={passo as never}
      indice={0}
      configuracao={CONFIGURACAO}
      editandoGatilho={false}
      problemas={[]}
      aoMudar={(p) => gravados.push(p)}
      aoApagarBotao={() => {}}
      aoMudarConfiguracao={() => {}}
      aoFechar={() => {}}
    />
  );
  return {
    ultimoGravado: () => gravados[gravados.length - 1],
  };
}

const PASSO_LIVRE = { id: "b_liv001", tipo: "pedir_dado", campo: "livre", texto: "?", chave: "" };

describe("o nome do campo livre no editor", () => {
  it("a chave livre aparece normalizada enquanto se digita", async () => {
    abrirPainelCom(PASSO_LIVRE);

    await userEvent.type(screen.getByLabelText(/nome do campo/i), "Qual sua Cidade");

    // O `closest("p")` é porque a frase é feita de pedaços — o trecho em
    // negrito é um nó, a chave é outro —, e `getByText` devolve o menor deles.
    // A pergunta do caso é sobre a linha inteira que o dono lê.
    expect(screen.getByText(/vai virar/).closest("p")!.textContent).toContain(
      "{{qual_sua_cidade}}"
    );
  });

  it("chave que colide com campo conhecido é recusada, com o caminho", async () => {
    abrirPainelCom(PASSO_LIVRE);

    await userEvent.type(screen.getByLabelText(/nome do campo/i), "e-mail");

    expect(screen.getByText(/já é um campo do sistema/i)).toBeTruthy();
    // "COM O CAMINHO": a recusa que só diz "não pode" deixa o dono sem saber o
    // que fazer. O bloco do próprio campo existe, valida a resposta e grava no
    // lugar certo — é essa a saída, e ela tem de estar escrita.
    expect(screen.getByText(/já é um campo do sistema/i).closest("p")!.textContent).toMatch(
      /bloco do pr[óo]prio campo/i
    );
  });

  it("chave sem nenhuma letra é recusada antes de salvar", async () => {
    // A DÍVIDA HERDADA DA TAREFA 4. `conferirBloco` (lib/steps.ts) recusa só a
    // COLISÃO, de propósito: `"123"` atravessa o salvar, `chaveDoPedido`
    // devolve `null` no motor, e o fluxo segue CALADO sem o dado — o dono nunca
    // fica sabendo. Quem tem de recusar isso na cara dele é esta tela.
    abrirPainelCom(PASSO_LIVRE);

    await userEvent.type(screen.getByLabelText(/nome do campo/i), "123");

    expect(screen.getByText(/precisa ter pelo menos uma letra/i)).toBeTruthy();
  });

  it("a chave recusada não chega ao passo, e por isso o salvar fica travado", async () => {
    // O AVISO SOZINHO NÃO BASTA, e isto é o resto da mesma decisão: se o botão
    // de salvar continuasse disponível, o dono salvaria mesmo assim e cairia no
    // caso calado que o aviso existe para evitar.
    //
    // QUEM TRAVA O SALVAR É `conferirLista` (`quadro.tsx` desabilita o botão com
    // `erro` de `quando: "salvar"`), então o jeito de travá-lo a partir daqui é
    // NÃO GRAVAR a chave recusada: o passo fica sem chave, e a regra
    // "`pedir_dado` livre sem chave" — que já existe desde a Tarefa 4 — acende.
    // A alternativa seria apertar `conferirBloco`, e a Tarefa 4 decidiu o
    // contrário com motivo escrito: o motor não deve estourar por dado ruim no
    // meio de uma conversa com cliente.
    const painel = abrirPainelCom(PASSO_LIVRE);

    await userEvent.type(screen.getByLabelText(/nome do campo/i), "123");

    const gravado = painel.ultimoGravado();
    expect(gravado.tipo === "pedir_dado" && gravado.chave).toBe("");
    const trava = conferirLista([gravado], "dm", []).filter(
      (p) => p.nivel === "erro" && p.quando === "salvar"
    );
    expect(trava.length).toBeGreaterThan(0);
  });

  it("a chave aceita CHEGA ao passo já normalizada, e o salvar destrava", async () => {
    // A contraprova do caso acima: o que trava não é o campo existir, é a chave
    // ser recusada. E o que chega ao passo é a forma NORMALIZADA — se fosse o
    // texto cru, o editor gravaria `Qual sua Cidade` e `chaveDoPedido`
    // (lib/steps.ts) normalizaria de novo do outro lado, com as duas pontas
    // escrevendo strings diferentes.
    const painel = abrirPainelCom(PASSO_LIVRE);

    await userEvent.type(screen.getByLabelText(/nome do campo/i), "Qual sua Cidade");

    const gravado = painel.ultimoGravado();
    expect(gravado.tipo === "pedir_dado" && gravado.chave).toBe("qual_sua_cidade");
    expect(
      conferirLista([gravado], "dm", []).filter(
        (p) => p.nivel === "erro" && p.quando === "salvar"
      )
    ).toEqual([]);
  });

  it("campo do catálogo não tem nome de campo nenhum para digitar", () => {
    // O campo só existe para o LIVRE. Num pedido de e-mail a chave é o próprio
    // campo (`chaveDoPedido`, lib/steps.ts), e oferecer um nome editável ali
    // convidaria o dono a inventar uma chave que o motor ignora.
    abrirPainelCom({ id: "b_eml001", tipo: "pedir_dado", campo: "email", texto: "Seu e-mail?" });

    expect(screen.queryByLabelText(/nome do campo/i)).toBeNull();
    // A pergunta, essa, aparece nos dois. Ela é procurada pelo TEXTO do
    // rótulo, e não por `getByLabelText`: `MessageField`
    // (app/automacoes/variable-picker.tsx) desenha um `<label>` solto, sem
    // `htmlFor`, e consertar aquele componente não é trabalho desta tarefa.
    expect(screen.getByText(/mensagem do pedido/i)).toBeTruthy();
  });

  it("a pergunta aparece também no campo livre", () => {
    abrirPainelCom(PASSO_LIVRE);

    expect(screen.getByText(/mensagem do pedido/i)).toBeTruthy();
  });
});
