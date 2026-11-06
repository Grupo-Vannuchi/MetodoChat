import { describe, expect, it } from "vitest";
import {
  AVISOS_DA_PAGINA,
  avisoDaPagina,
  FRASE_CARROSSEL_DE_OUTRA_CONTA,
  FRASE_CONTAS_SALVAS,
  FRASE_DA_CONTA_QUE_NAO_EXISTE,
  FRASE_DO_LOGIN_ADMINISTRADOR,
  FRASE_SEM_ACESSO_A_CONTA,
  FRASE_SEM_CONTAS,
  textoSemConta,
} from "@/lib/logins-textos";

// O AVISO DA PÁGINA LOGINS VEM DA URL (docs/specs/2026-11-04-logins.md, seção 4), e a lista é fechada: o
// texto que veio na URL nunca aparece na tela.
describe("o aviso da página Logins", () => {
  it("cada chave da lista vira a frase dela", () => {
    for (const [chave, frase] of Object.entries(AVISOS_DA_PAGINA)) {
      expect(avisoDaPagina(chave)).toBe(frase);
    }
  });

  it("o que não está na lista não vira nada, nem as chaves herdadas de objeto", () => {
    for (const fora of [undefined, "", "outro", "<b>vazado</b>", "toString", "__proto__", ["desativado"]]) {
      expect(avisoDaPagina(fora as string | string[] | undefined), String(fora)).toBeNull();
    }
  });

  it("as duas travas têm frase própria", () => {
    expect(AVISOS_DA_PAGINA.proprio).toMatch(/próprio login/);
    expect(AVISOS_DA_PAGINA.ultimo_administrador).toMatch(/último administrador/);
  });

  // AS CONTAS POR LOGIN (docs/specs/2026-11-05-contas-por-login.md, seção 4): o papel tem a trava do próprio, e
  // a do último administrador é a mesma do desativar.
  it("a troca do papel tem os avisos dela, e o próprio papel tem trava própria", () => {
    expect(AVISOS_DA_PAGINA.papel_proprio).toBe("Você não pode mudar o seu próprio papel.");
    expect(AVISOS_DA_PAGINA.virou_administrador).toBe("Login agora é administrador. Ele vê todas as contas.");
    expect(AVISOS_DA_PAGINA.virou_comum).toBe("Login agora é comum. Ele vê só as contas marcadas.");
  });
});

describe("as frases das contas por login", () => {
  it("são as da spec, uma para cada recusa", () => {
    expect(FRASE_SEM_ACESSO_A_CONTA).toBe("Você não tem acesso a essa conta.");
    expect(FRASE_CARROSSEL_DE_OUTRA_CONTA).toBe("Esse carrossel é de uma conta que você não tem.");
    expect(FRASE_SEM_CONTAS).toBe("Você ainda não tem contas. Peça ao administrador.");
    expect(FRASE_CONTAS_SALVAS).toBe("Contas salvas. Valem já no próximo clique desse login.");
  });

  // AS CONTAS DE UM LOGIN, NA PÁGINA LOGINS (seção 4): as duas recusas do "Salvar contas".
  it("o salvar contas recusa o administrador e a conta que não existe, cada um com a sua frase", () => {
    expect(FRASE_DO_LOGIN_ADMINISTRADOR).toBe("Esse login é administrador e já vê todas as contas.");
    expect(FRASE_DA_CONTA_QUE_NAO_EXISTE).toBe("Uma das contas marcadas não existe mais. Recarregue a página.");
  });

  // A PÁGINA SEM CONTA (seção 3): o administrador continua vendo o texto de hoje, que manda conectar uma
  // conta; o comum não conecta conta, e vê a frase que manda pedir ao administrador.
  it("a página sem conta mostra o texto de hoje ao administrador e a frase do comum ao comum", () => {
    const deHoje = "Conecte uma conta do Instagram primeiro.";
    expect(textoSemConta(true, deHoje)).toBe(deHoje);
    expect(textoSemConta(false, deHoje)).toBe(FRASE_SEM_CONTAS);
  });
});
