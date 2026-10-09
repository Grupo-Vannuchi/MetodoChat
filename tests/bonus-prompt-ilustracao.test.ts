// CÓPIA DO TESTE DO LABS (site-ia, src/lib/ia/prompt-ilustracao.test.ts, main 672ee71, blob 75993a0c), com só o
// caminho do import trocado para o do Chat (spec da Etapa 6, "As regras, copiadas do Labs"). Os casos
// são os mesmos de lá, de propósito: as regras são as mesmas, e a cópia delas é conferida em
// tests/bonus-ilustracao-copia.test.ts.
import { describe, expect, it } from "vitest";
import {
  ESTILO,
  ESTILOS,
  FUNDO,
  MAX_DESCRICAO,
  MIN_DESCRICAO,
  PROIBICAO_DE_PESSOA_REAL,
  PROIBICAO_DE_TEXTO,
  pedeTextoNaImagem,
  montarPrompt,
  separarEstilo,
  validarDescricao,
} from "@/lib/bonus/prompt-ilustracao";

describe("validarDescricao", () => {
  it("recusa descrição vazia", () => {
    expect(validarDescricao("").ok).toBe(false);
    expect(validarDescricao("   ").ok).toBe(false);
  });

  it("recusa descrição curta demais, porque a chamada é paga", () => {
    const r = validarDescricao("uma lousa");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.mensagem).toContain(String(MIN_DESCRICAO));
  });

  it("aceita exatamente no mínimo", () => {
    expect(validarDescricao("a".repeat(MIN_DESCRICAO)).ok).toBe(true);
  });

  it("recusa acima do máximo e aceita exatamente nele", () => {
    expect(validarDescricao("a".repeat(MAX_DESCRICAO)).ok).toBe(true);
    expect(validarDescricao("a".repeat(MAX_DESCRICAO + 1)).ok).toBe(false);
  });

  it("mede DEPOIS de aparar os espaços — senão espaço em branco vira descrição válida", () => {
    expect(validarDescricao(`  ${"a".repeat(MIN_DESCRICAO - 1)}   `).ok).toBe(false);
  });
});

describe("montarPrompt", () => {
  const cena = "uma lousa de sala de aula com um professor apontando para ela";

  it("mantém a cena que a pessoa descreveu", () => {
    expect(montarPrompt(cena)).toContain(cena);
  });

  it("SEMPRE proíbe texto — é a regra que não pode depender de quem digita", () => {
    expect(montarPrompt(cena)).toContain(PROIBICAO_DE_TEXTO);
    expect(montarPrompt("qualquer coisa curta assim")).toContain(PROIBICAO_DE_TEXTO);
  });

  it("põe a proibição no FIM, que é a última coisa que o modelo lê", () => {
    expect(montarPrompt(cena).endsWith(PROIBICAO_DE_TEXTO)).toBe(true);
  });

  it("sempre pede o estilo e o enquadramento", () => {
    const p = montarPrompt(cena);
    expect(p).toContain(ESTILO);
    expect(p).toContain(FUNDO);
  });

  it("fecha a cena com ponto, para ela não se fundir na frase de estilo", () => {
    expect(montarPrompt("uma planilha flutuando")).toContain("uma planilha flutuando. ");
  });

  it("não duplica o ponto quando a pessoa já pontuou", () => {
    expect(montarPrompt("uma planilha flutuando.")).not.toContain("flutuando.. ");
    expect(montarPrompt("e agora?")).toContain("e agora? ");
  });

  it("normaliza espaços e quebras de linha coladas pelo teclado", () => {
    expect(montarPrompt("uma   lousa\n\ncom giz")).toContain("uma lousa com giz.");
  });

  it("a ordem é cena → estilo → fundo → proibição", () => {
    const p = montarPrompt(cena);
    expect(p.indexOf(cena)).toBeLessThan(p.indexOf(ESTILO));
    expect(p.indexOf(ESTILO)).toBeLessThan(p.indexOf(FUNDO));
    expect(p.indexOf(FUNDO)).toBeLessThan(p.indexOf(PROIBICAO_DE_TEXTO));
  });
});

describe("atalhos de estilo", () => {
  it("reconhece o atalho e tira ele da cena", () => {
    const r = separarEstilo("/showcase uma caixa de papelao aberta sobre a mesa");
    expect(r.estilo?.chave).toBe("showcase");
    expect(r.cena).toBe("uma caixa de papelao aberta sobre a mesa");
    expect(r.desconhecido).toBeNull();
  });

  it("aceita o atalho em maiuscula", () => {
    expect(separarEstilo("/SHOWCASE uma caixa sobre a mesa").estilo?.chave).toBe("showcase");
  });

  it("descricao sem barra continua sendo cena inteira", () => {
    const r = separarEstilo("uma lousa de sala de aula com um professor apontando");
    expect(r.estilo).toBeNull();
    expect(r.cena).toBe("uma lousa de sala de aula com um professor apontando");
  });

  // ⚠️ AS ÂNCORAS SAEM DAS CONSTANTES, e não de um pedaço do texto delas. Até 21/09 esta
  // asserção procurava o literal "Ilustração editorial", e a troca do estilo para fotografia
  // a derrubou — sem que a ORDEM, que é o que ela existe para provar, tivesse mudado. Teste
  // que reprova quando a redação muda ensina a mexer no teste em vez de olhar o defeito.
  it("o texto do estilo entra no prompt, depois da cena e antes do estilo fixo", () => {
    const enquadramento = ESTILOS.find((e) => e.chave === "grafico")!;
    const p = montarPrompt("/grafico tres barras subindo lado a lado");
    const posCena = p.indexOf("tres barras");
    const posEnquadramento = p.indexOf(enquadramento.texto);
    const posEstiloFixo = p.indexOf(ESTILO);
    expect(posCena).toBeGreaterThanOrEqual(0);
    expect(posEnquadramento).toBeGreaterThanOrEqual(0);
    expect(posEstiloFixo).toBeGreaterThanOrEqual(0);
    expect(posCena).toBeLessThan(posEnquadramento);
    expect(posEnquadramento).toBeLessThan(posEstiloFixo);
  });

  it("o estilo fixo e a proibicao continuam valendo com atalho", () => {
    const p = montarPrompt("/passo tres caixas ligadas por setas");
    expect(p).toContain(ESTILO);
    expect(p).toContain(PROIBICAO_DE_TEXTO);
    expect(p).toContain(FUNDO);
  });

  // ⚠️ AS DUAS SAIDAS SILENCIOSAS, e por que nenhuma serve. Ignorar o atalho faz a pessoa
  // achar que aplicou um estilo que nao existe; trata-lo como cena manda o modelo desenhar
  // a palavra "/showkase" no meio da arte — e a chamada e paga nos dois casos.
  it("atalho que nao existe e RECUSADO, com a lista do que existe", () => {
    const r = validarDescricao("/showkase uma caixa de papelao sobre a mesa");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.mensagem).toContain("/showkase");
      expect(r.mensagem).toContain("/showcase");
    }
  });

  it("atalho que nao existe nao vira texto da cena", () => {
    expect(montarPrompt("/showkase uma caixa")).not.toContain("showkase");
  });

  // O minimo mede a CENA, nao o que foi digitado: senao "/showcase uma" passaria de raspao
  // e geraria a imagem vaga que este limite existe para impedir.
  it("o atalho nao conta para o minimo de caracteres", () => {
    expect(validarDescricao("/showcase uma").ok).toBe(false);
    expect(validarDescricao("/showcase uma caixa de papelao").ok).toBe(true);
  });

  it("barra sozinha, sem cena, e recusada", () => {
    expect(validarDescricao("/showcase").ok).toBe(false);
  });

  it("todo atalho da lista funciona de ponta a ponta", () => {
    for (const e of ESTILOS) {
      const r = validarDescricao(`/${e.chave} uma cena qualquer com objetos`);
      expect(r.ok, `atalho /${e.chave} recusado`).toBe(true);
      expect(montarPrompt(`/${e.chave} uma cena qualquer com objetos`)).toContain(e.texto);
    }
  });

  // A PROIBICAO DE TEXTO vem depois de todo atalho e venceria de qualquer jeito. Mas um
  // atalho que PEDE o que o prompt proibe logo abaixo produz imagem confusa, nao recusa.
  it("nenhum atalho pede texto, numero ou rotulo", () => {
    for (const e of ESTILOS) {
      expect(e.texto, `/${e.chave} pede algo escrito`).not.toMatch(/\b(texto|palavra|letra|título|legenda)\b/i);
    }
  });
});

describe("o informativo de cada atalho", () => {
  // ⚠️ ESTE TESTE EXISTE PARA UM ATALHO FUTURO NAO NASCER MUDO. A explicacao vivia num
  // `title` de hover — invisivel no celular, e o projeto ja rejeitou tooltip por escrito
  // duas vezes. Agora ela e texto na tela, e um atalho sem `resumo` seria um botao que nao
  // diz nada: `/passo` e `/grafico` nao se adivinham.
  it("todo atalho tem resumo, e ele cabe numa linha", () => {
    for (const e of ESTILOS) {
      expect(e.resumo, `/${e.chave} sem resumo`).toBeTruthy();
      expect(e.resumo.length, `/${e.chave} tem resumo longo demais para a linha`).toBeLessThanOrEqual(90);
    }
  });

  // O resumo e para a PESSOA; o texto e para o modelo de imagem. Se alguem colar um no
  // outro, a tela mostra jargao de composicao e o prompt perde a instrucao.
  it("o resumo nao e o texto do prompt", () => {
    for (const e of ESTILOS) {
      expect(e.resumo, `/${e.chave} usa o texto do prompt como resumo`).not.toBe(e.texto);
    }
  });

  it("todo atalho tem rotulo curto", () => {
    for (const e of ESTILOS) {
      expect(e.rotulo, `/${e.chave} sem rotulo`).toBeTruthy();
      expect(e.rotulo.length).toBeLessThanOrEqual(30);
    }
  });
});

describe("ninguem reconhecivel na ilustracao", () => {
  // Regra do manual do perfil (02/09): foto de figura publica nao pode ser usada, e
  // ilustracao de icone entra no lugar. E direito de imagem, nao estetica — um post no ar
  // com o rosto de alguem identificavel e problema que ajuste de arte nao desfaz depois.
  it("a proibicao entra em toda ilustracao, com atalho ou sem", () => {
    expect(montarPrompt("uma caixa de papelao sobre a mesa")).toContain(PROIBICAO_DE_PESSOA_REAL);
    for (const e of ESTILOS) {
      expect(
        montarPrompt(`/${e.chave} uma cena qualquer com objetos`),
        `/${e.chave} sai sem a proibicao de pessoa real`,
      ).toContain(PROIBICAO_DE_PESSOA_REAL);
    }
  });

  // ⚠️ O CONTRAPESO QUE IMPEDE A REGRA DE SER LARGA DEMAIS — o mesmo erro que eu cometi no
  // aviso do `"use server"`, onde o enunciado passou da causa.
  //
  // O atalho `/marketing` PEDE "uma pessoa estilizada em acao". Escrita como "sem pessoas",
  // a proibicao contradiria o atalho que aparece logo acima dela no mesmo prompt — e o
  // modelo entrega imagem confusa em vez de recusar.
  it("proibe pessoa RECONHECIVEL, nao pessoa", () => {
    expect(PROIBICAO_DE_PESSOA_REAL).toMatch(/identific|reconhec/i);
    expect(PROIBICAO_DE_PESSOA_REAL).toMatch(/figura pública|celebridade|pessoa real/i);
    // Nao pode virar uma proibicao categorica de figura humana.
    expect(PROIBICAO_DE_PESSOA_REAL).not.toMatch(/sem pessoas|sem figuras humanas|nenhuma pessoa/i);
  });

  it("o atalho que pede pessoa continua pedindo pessoa", () => {
    const marketing = ESTILOS.find((e) => e.chave === "marketing");
    expect(marketing?.texto).toMatch(/pessoa/i);
  });

  // A ORDEM importa: as duas proibicoes ficam no fim, que e a ultima coisa que o modelo le.
  it("as proibicoes vem depois da cena e do estilo", () => {
    const p = montarPrompt("/marketing uma pessoa apontando para um grafico na parede");
    expect(p.indexOf("pessoa apontando")).toBeLessThan(p.indexOf(PROIBICAO_DE_PESSOA_REAL));
    expect(p.indexOf(ESTILO)).toBeLessThan(p.indexOf(PROIBICAO_DE_PESSOA_REAL));
    expect(p.indexOf(PROIBICAO_DE_PESSOA_REAL)).toBeLessThan(p.indexOf(PROIBICAO_DE_TEXTO));
  });
});

// ⚠️ ESTE BLOCO NASCEU DE UM CASO REAL, em 21/09 — a descricao do Eduardo, copiada do banco.
// Ele pediu texto na lousa, o prompt proibia texto no fim, e a imagem saiu com "ORGANICA"
// acentuado errado. O aviso existe para que o proximo pedido desses custe zero em vez de uma
// ilustracao paga.
describe("pedeTextoNaImagem", () => {
  it("reconhece a descricao REAL que produziu a imagem torta", () => {
    const real =
      "Uma reunião de marketing discutindo sobre a queda da vendas organicas, uma pessoa triste por isso \n" +
      "na lousa/ projetor (uma dessas opções, estar escrito, Analise queda ORGANICA)";
    expect(pedeTextoNaImagem(real)).toBe("escrito");
  });

  // ⚠️ O FALSO POSITIVO MAIS PROVAVEL, e o motivo de a fronteira nao poder ser `\b`.
  // "escritorio" comeca com "escrito", e escritorio e a palavra mais esperada numa descricao
  // de cena corporativa — a lista inteira ficaria inutil se ela disparasse.
  it("NAO dispara em escritorio, que contem 'escrito'", () => {
    expect(pedeTextoNaImagem("uma reuniao num escritorio com quatro pessoas")).toBeNull();
    expect(pedeTextoNaImagem("uma reunião num escritório com quatro pessoas")).toBeNull();
  });

  it("acha o termo com e sem acento, e no meio da frase", () => {
    expect(pedeTextoNaImagem("uma lousa com o título do projeto")).toBe("título");
    expect(pedeTextoNaImagem("uma lousa com o titulo do projeto")).toBe("titulo");
    expect(pedeTextoNaImagem("um grafico com numeros grandes")).toBe("numeros");
  });

  it("cala quando a cena nao pede texto nenhum", () => {
    expect(pedeTextoNaImagem("uma reuniao de equipe olhando um grafico de vendas em queda")).toBeNull();
  });

  // O atalho nao conta: quem escreve os atalhos somos nos, e nenhum deles pede texto — a
  // mesma razao pela qual `validarDescricao` mede a CENA e nao o texto digitado.
  it("mede a cena, e nao o atalho", () => {
    expect(pedeTextoNaImagem("/grafico tres barras subindo lado a lado")).toBeNull();
  });

  // ⚠️ O CONTRAPESO: sem isto, uma funcao que sempre devolve null passaria em tudo que
  // importa acima, porque a maioria dos casos e "nao dispara".
  it("dispara em todos os termos da lista, um a um", () => {
    for (const t of ["escrito", "escreva", "texto", "letras", "palavra", "frase", "placa", "legenda"]) {
      expect(pedeTextoNaImagem(`uma cena com ${t} no meio`), `${t} deveria disparar`).not.toBeNull();
    }
  });
});
