import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Painel, { type Configuracao } from "@/app/automacoes/editor/painel";
import { chaveDoPedido, conferirLista, type Passo } from "@/lib/steps";
import { fraseDaChaveQueColide, fraseDaChaveSemLetra } from "@/lib/campos";

// O NOME DO CAMPO LIVRE, NA TELA — e por que ele precisa de casos de DOM.
//
// O QUE O DONO DIGITA NÃO É O QUE VIRA VARIÁVEL: ele escreve "Qual sua Cidade"
// e a variável é `{{qual_sua_cidade}}`, porque é essa a string que
// `chaveDoPedido` (lib/steps.ts) monta a cada mensagem. Sem a tela mostrar a
// forma normalizada, o dono escreve a variável errada na mensagem seguinte e o
// texto sai com `{{Qual sua Cidade}}` cru para uma pessoa de verdade.
//
// O QUE FICA GRAVADO NO BLOCO É O TEXTO CRU, e essa é a outra metade: o editor
// normalizava na gravação e, ao recusar uma chave, apagava o que a pessoa tinha
// digitado — inclusive o que já estava salvo. Quem recusa hoje é
// `conferirLista`, que enxerga o texto cru e por isso consegue dizer QUAL é o
// problema. Os casos abaixo medem as duas pontas.
//
// A NORMALIZAÇÃO TEM UM DONO SÓ, `normalizarChaveLivre` (lib/campos.ts), e
// estes casos medem a TELA usando aquela função — não uma cópia dela. É a mesma
// razão de `chaveDoPedido` (lib/steps.ts) chamá-la em vez de reescrevê-la: as
// duas pontas têm de gravar a MESMA string, senão o dado da pessoa cai numa
// chave que a variável `{{...}}` das mensagens não conhece. (O CSV NÃO está
// nessa conta: app/api/contatos/csv/route.ts tem duas colunas fixas e não lê
// `contacts.campos`.)
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
  const tela = render(
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
    // TROCAR DE BLOCO SEM REMONTAR O PAINEL — é o gesto do quadro, e não um
    // atalho de teste: `<Painel>` é montado SEM `key`
    // (app/automacoes/editor/quadro.tsx), então clicar noutro nó troca só a
    // prop `passo`. Um `render` novo a cada bloco mediria uma tela que ninguém
    // abre, e é justamente a montagem que esconde o defeito.
    trocarPara: (outro: { tipo: string; [k: string]: unknown } | null) =>
      tela.rerender(
        <Painel
          passo={outro as never}
          indice={outro ? 0 : -1}
          configuracao={CONFIGURACAO}
          editandoGatilho={false}
          problemas={[]}
          aoMudar={(p) => gravados.push(p)}
          aoApagarBotao={() => {}}
          aoMudarConfiguracao={() => {}}
          aoFechar={() => {}}
        />
      ),
  };
}

// Os erros que TRAVAM O SALVAR para uma lista de um bloco só. `quadro.tsx`
// desabilita o botão com exatamente este filtro.
function travasDoSalvar(passo: Passo) {
  return conferirLista([passo], "dm", []).filter(
    (p) => p.nivel === "erro" && p.quando === "salvar"
  );
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

    // A FRASE INTEIRA, E VINDA DO CATÁLOGO. Ela estava escrita à mão aqui e em
    // `conferirBloco` (lib/steps.ts), as duas com a lista dos campos digitada —
    // e as duas já discordavam sobre como chamar o bloco. Comparar com
    // `fraseDaChaveQueColide` é o que acusa a volta da cópia.
    //
    // "COM O CAMINHO": a recusa que só diz "não pode" deixa o dono sem saber o
    // que fazer. O bloco do próprio campo existe, valida a resposta e grava no
    // lugar certo — é essa a saída, e ela faz parte da frase.
    expect(screen.getByText(/já é um campo do sistema/i).textContent).toBe(
      fraseDaChaveQueColide("e-mail")
    );
  });

  it("chave que é variável do PERFIL é recusada com a frase que serve para ela", async () => {
    // A FRASE DOS CAMPOS DO SISTEMA NÃO SERVE AQUI, e é por isso que este caso
    // existe na tela e não só na suíte pura: "já é um campo do sistema (e-mail,
    // telefone, nome informado ou data de nascimento) — use o bloco do próprio
    // campo" manda o dono procurar um bloco de `username` que NÃO EXISTE, e
    // lista quatro nomes, nenhum deles o que ele acabou de digitar.
    //
    // E O RAMO DA TELA É OUTRO: o painel escolhe entre as duas recusas com
    // `chaveReservada` (lib/campos.ts). Antes das três chaves do perfil
    // entrarem nela, "Username" caía no ramo do "precisa ter pelo menos uma
    // letra" — uma frase falsa sobre um nome que tem oito.
    abrirPainelCom(PASSO_LIVRE);

    await userEvent.type(screen.getByLabelText(/nome do campo/i), "Username");

    const recusa = screen.getByText(/variável do perfil/i);
    expect(recusa.textContent).toBe(fraseDaChaveQueColide("Username"));
    // Ela nomeia o token que ia ganhar, que é o estrago que o dono não veria:
    // a mensagem sairia preenchida, com o nome do Instagram.
    expect(recusa.textContent).toContain("{{username}}");
    expect(screen.queryByText(fraseDaChaveSemLetra())).toBeNull();
  });

  it("chave sem nenhuma letra é recusada antes de salvar", async () => {
    // A DÍVIDA HERDADA DA TAREFA 4. `conferirBloco` (lib/steps.ts) recusa só a
    // COLISÃO, de propósito: `"123"` atravessa o salvar, `chaveDoPedido`
    // devolve `null` no motor, e o fluxo segue CALADO sem o dado — o dono nunca
    // fica sabendo. Quem tem de recusar isso na cara dele é esta tela.
    abrirPainelCom(PASSO_LIVRE);

    await userEvent.type(screen.getByLabelText(/nome do campo/i), "123");

    expect(screen.getByText(/precisa ter pelo menos uma letra/i).textContent).toBe(
      fraseDaChaveSemLetra()
    );
  });

  it("a chave recusada chega crua ao passo, e mesmo assim o salvar fica travado", async () => {
    // O AVISO SOZINHO NÃO BASTA, e isto é o resto da mesma decisão: se o botão
    // de salvar continuasse disponível, o dono salvaria mesmo assim e cairia no
    // caso calado que o aviso existe para evitar.
    //
    // QUEM TRAVA O SALVAR É `conferirLista` (`quadro.tsx` desabilita o botão com
    // `erro` de `quando: "salvar"`), e ELA GANHOU A REGRA: chave livre presente
    // que não vira variável é erro de salvar, com a frase que diz o que fazer.
    //
    // O editor travava por outro caminho — gravando `""` no lugar do que a
    // pessoa digitou, para cair na regra "livre sem chave". Isso apagava dado
    // do dono e fazia o nó dizer que ele não escolheu nome nenhum, quando ele
    // escolheu. A regra NÃO foi para `conferirBloco` de propósito: lá ela faria
    // `interpretar` ignorar o bloco e faria `conferirLista` PULAR este passo,
    // levando junto duas guardas que dependem de ele chegar ao fim do laço.
    const painel = abrirPainelCom(PASSO_LIVRE);

    await userEvent.type(screen.getByLabelText(/nome do campo/i), "123");

    // A CHAVE CHEGA CRUA. Ela chegava como `""` — o editor apagava o que a
    // pessoa digitou —, e o preço está medido no caso "o que foi digitado
    // sobrevive", logo abaixo.
    const gravado = painel.ultimoGravado();
    expect(gravado.tipo === "pedir_dado" && gravado.chave).toBe("123");
    // E O SALVAR CONTINUA TRAVADO: quem o trava agora é a regra da chave que
    // não vira variável (`conferirLista`, lib/steps.ts), e não a ausência de
    // chave. A frase é a mesma que esta tela mostra.
    const trava = travasDoSalvar(gravado);
    expect(trava.length).toBeGreaterThan(0);
    expect(trava[0].mensagem).toBe(fraseDaChaveSemLetra());
  });

  it("a chave aceita chega ao passo COMO FOI DIGITADA, e o salvar destrava", async () => {
    // A contraprova do caso acima: o que trava não é o campo existir, é a chave
    // ser recusada.
    const painel = abrirPainelCom(PASSO_LIVRE);

    await userEvent.type(screen.getByLabelText(/nome do campo/i), "Qual sua Cidade");

    const gravado = painel.ultimoGravado();
    // O QUE CHEGA É O QUE ELE DIGITOU. A normalização não sumiu: quem a aplica
    // é `chaveDoPedido` (lib/steps.ts), do lado que LÊ, a cada mensagem — e a
    // linha de baixo é a que prende as duas pontas escrevendo a MESMA string,
    // que era o motivo de o editor normalizar na gravação.
    expect(gravado.tipo === "pedir_dado" && gravado.chave).toBe("Qual sua Cidade");
    expect(chaveDoPedido(gravado)).toBe("qual_sua_cidade");
    expect(travasDoSalvar(gravado)).toEqual([]);
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

  // ---------------------------------------------------------------------------
  // TROCAR DE BLOCO SELECIONADO — o caso da `key`.
  // ---------------------------------------------------------------------------

  it("trocar de bloco troca o nome na tela, e a primeira tecla grava no bloco certo", async () => {
    // O QUE ESTE CASO PRENDE é `key={passo.id}` em `<ChaveDoCampoLivre>`
    // (app/automacoes/editor/painel.tsx). Sem ela as três suítes ficam verdes e
    // a tela perde dado do dono.
    //
    // O MECANISMO: `ChaveDoCampoLivre` guarda o texto CRU em `useState`, e
    // `<Painel>` é montado SEM `key` (quadro.tsx) — clicar noutro nó troca só a
    // prop `passo`, sem remontar nada. Sem a `key`, o React reaproveita este
    // componente e o estado do bloco anterior continua na tela sobre o bloco
    // novo: o painel do bloco "profissao" mostra "cidade", e a PRIMEIRA TECLA
    // digitada grava o nome de um bloco dentro do outro.
    const CIDADE = { id: "b_liv101", tipo: "pedir_dado", campo: "livre", chave: "cidade", texto: "?" };
    const PROFISSAO = {
      id: "b_liv102", tipo: "pedir_dado", campo: "livre", chave: "profissao", texto: "?",
    };
    const painel = abrirPainelCom(CIDADE);
    const campo = () => screen.getByLabelText(/nome do campo/i) as HTMLInputElement;
    expect(campo().value).toBe("cidade");

    painel.trocarPara(PROFISSAO);

    // A METADE VISÍVEL: o painel mostra o nome DESTE bloco.
    expect(campo().value).toBe("profissao");

    // A METADE QUE CUSTA DADO: a primeira tecla continua no bloco certo, e não
    // leva o nome do anterior junto.
    await userEvent.type(campo(), "x");
    const gravado = painel.ultimoGravado();
    expect(gravado.id).toBe("b_liv102");
    expect(gravado.tipo === "pedir_dado" && gravado.chave).toBe("profissaox");
  });

  // ---------------------------------------------------------------------------
  // FECHAR E REABRIR O PAINEL — o que o dono digitou tem de sobreviver, e o nó
  // tem de dizer a verdade sobre o que ele fez.
  // ---------------------------------------------------------------------------

  it("o que ele digitou sobrevive ao fechar e reabrir o painel", async () => {
    // MEDIDO NA REVISÃO, com o editor gravando a forma normalizada: partindo de
    // um campo livre JÁ SALVO com `chave: "cidade"`, apagar e digitar "e-mail"
    // gravava `chave: ""` — o `"cidade"` que estava no banco sumia do rascunho,
    // e ao reabrir o painel o campo voltava VAZIO. Não é "perde o que digitou";
    // é perde o que já estava gravado, e o salvar fica travado até ele
    // redigitar um nome que nem sabe qual era.
    const SALVO = { id: "b_liv201", tipo: "pedir_dado", campo: "livre", chave: "cidade", texto: "?" };
    const painel = abrirPainelCom(SALVO);

    await userEvent.clear(screen.getByLabelText(/nome do campo/i));
    await userEvent.type(screen.getByLabelText(/nome do campo/i), "e-mail");
    const gravado = painel.ultimoGravado();
    expect(gravado.tipo === "pedir_dado" && gravado.chave).toBe("e-mail");

    // FECHAR E REABRIR: o painel some (`passo: null`) e volta com o rascunho
    // que o quadro guardou. O estado do componente morre junto com o painel, e
    // é por isso que o texto cru precisa estar NO PASSO.
    painel.trocarPara(null);
    expect(screen.queryByLabelText(/nome do campo/i)).toBeNull();
    painel.trocarPara(gravado as never);

    expect((screen.getByLabelText(/nome do campo/i) as HTMLInputElement).value).toBe("e-mail");
    // E O DIAGNÓSTICO PRECISO VOLTA COM ELE, em vez de morrer com o painel.
    expect(screen.getByText(/já é um campo do sistema/i)).toBeTruthy();
  });

  it("o nó diz o que ele fez: nome do sistema, e não “sem nome”", async () => {
    // A FRASE DO NÓ ERA FALSA SOBRE O GESTO DELE. Com a chave apagada na
    // gravação, quem fechava o painel depois de digitar "e-mail" lia "Este
    // pedido de dado está sem o nome do campo que guarda a resposta" — e ele
    // não deixou nome nenhum em branco: ele escolheu um nome, e o problema é
    // qual. A frase certa diz qual é o problema e o que fazer.
    const painel = abrirPainelCom(PASSO_LIVRE);

    await userEvent.type(screen.getByLabelText(/nome do campo/i), "e-mail");

    const travas = travasDoSalvar(painel.ultimoGravado());
    expect(travas.map((t) => t.mensagem)).toContain(fraseDaChaveQueColide("e-mail"));
    expect(travas.map((t) => t.mensagem).join(" ")).not.toMatch(/está sem o nome do campo/i);
  });

  // ---------------------------------------------------------------------------
  // NASCER ACUSADO É O MESMO DEFEITO DE NASCER AVISADO.
  // ---------------------------------------------------------------------------

  it("o bloco recém-arrastado NÃO nasce acusado — só explicado", () => {
    // O QUE ESTE CASO PRENDE é `const vazio = !digitado.trim()`
    // (app/automacoes/editor/painel.tsx). Trocá-lo por `false` fazia o bloco
    // nascer com a acusação vermelha da chave sem letra na cara de quem acabou
    // de arrastá-lo, e os 31 casos de DOM continuavam verdes.
    //
    // É a mesma doutrina que `blocoNovo` (./modelos) escreve para os outros
    // blocos: o que trava o salvar aqui é `conferirLista`, com a frase dela.
    abrirPainelCom(PASSO_LIVRE);

    expect(screen.queryByText(/precisa ter pelo menos uma letra/i)).toBeNull();
    expect(screen.queryByText(/já é um campo do sistema/i)).toBeNull();
    // E a linha que explica PARA QUE serve o nome continua na tela.
    expect(screen.getByText(/vira a variável das mensagens/i)).toBeTruthy();
  });
});
