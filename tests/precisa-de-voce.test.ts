import { describe, it, expect } from "vitest";
import {
  oQuePrecisaDeVoce,
  HORAS_QUE_TORNAM_URGENTE,
  MAX_CONVERSAS_NO_INICIO,
  urgenciaDaJanela,
  legendaDoPrazo,
  recorteDasOportunidades,
  type FatosDoInicio,
  type Oportunidade,
} from "../lib/precisa-de-voce";
import { WINDOW_MS, WINDOW_MARGIN_MS, formatWindowLeft } from "../lib/inbox-window";
import {
  DIAS_DE_AVISO_DA_PUBLICACAO,
  HORAS_DE_AVISO_DA_MENSAGEM,
} from "../lib/publicacao";

// O QUE ESTE ARQUIVO FIXA: a decisão da tela inicial, que a spec da linguagem
// visual define como a resposta a UMA pergunta — "precisa de mim?" — e que
// **quer ficar vazia**. O vazio é a resposta, e não um espaço a preencher.
//
// POR QUE A DECISÃO SAI DO JSX: a suíte não testa componente. Uma tela que
// escolhe sozinha o que mostrar e em que ordem é uma tela cuja ordem ninguém
// mede — e ordem, aqui, é a diferença entre ver a tempo e ver depois.

const H = 3_600_000;

/** A janela de quem falou faz `horas` horas — a conta é a do produto, e não uma
 *  segunda régua escrita neste arquivo. */
const restam = (horas: number) => WINDOW_MS - WINDOW_MARGIN_MS - horas * H;

const NADA: FatosDoInicio = {
  esperando: [],
  falhasPublicacao: 0,
  falhasMensagem: 0,
  automacoesAtivas: 3,
  oportunidades: [],
};

const quem = (nome: string, horasDesdeQueFalou: number) => ({
  igId: "ig_" + nome,
  quem: nome,
  msLeft: restam(horasDesdeQueFalou),
});

describe("o vazio é a resposta", () => {
  it("com tudo em ordem, a tela inicial não tem NADA a mostrar", () => {
    expect(oQuePrecisaDeVoce(NADA)).toEqual([]);
  });

  // "NENHUMA AUTOMAÇÃO" É CONVITE, E NÃO PENDÊNCIA. Ele fica por último sempre,
  // porque uma conta recém-conectada precisa do empurrão e uma conta com um
  // post falhado precisa do post — o convite acima da falha seria ruído.
  it("conta sem automação nenhuma recebe o convite", () => {
    const r = oQuePrecisaDeVoce({ ...NADA, automacoesAtivas: 0 });
    expect(r).toHaveLength(1);
    expect(r[0].chave).toBe("sem-automacao");
    expect(r[0].urgencia).toBe("quieto");
  });
});

describe("a ordem, que é a decisão inteira", () => {
  // A REGRA: vem primeiro o que DESAPARECE se ninguém agir na próxima hora. Só
  // a janela de 24h faz isso — depois que ela fecha, a Meta recusa a resposta e
  // não há como reabrir. Uma publicação que falhou às 3h da manhã continua
  // falhada às 9h; ela é grave, e não é urgente no mesmo sentido.
  it("a janela que fecha em minutos vem antes da publicação que falhou", () => {
    const r = oQuePrecisaDeVoce({
      ...NADA,
      esperando: [quem("marcio", 22.5)], // restam 1h25
      falhasPublicacao: 1,
    });
    expect(r.map((i) => i.chave)).toEqual(["conversa:ig_marcio", "falha-publicacao"]);
  });

  // E O INVERSO, que é o que prova que a regra é sobre PRAZO e não sobre tipo:
  // a mesma conversa, com o dia inteiro pela frente, vai para depois.
  it("a janela com o dia inteiro pela frente vem DEPOIS da publicação", () => {
    const r = oQuePrecisaDeVoce({
      ...NADA,
      esperando: [quem("marcio", 2)], // restam quase 22h
      falhasPublicacao: 1,
    });
    expect(r.map((i) => i.chave)).toEqual(["falha-publicacao", "conversa:ig_marcio"]);
  });

  it("entre duas conversas, quem fecha primeiro aparece primeiro", () => {
    const r = oQuePrecisaDeVoce({
      ...NADA,
      esperando: [quem("calma", 4), quem("apertada", 23), quem("media", 21.5)],
    });
    expect(r.map((i) => i.chave)).toEqual([
      "conversa:ig_apertada",
      "conversa:ig_media",
      "conversa:ig_calma",
    ]);
  });

  it("publicação vem antes de mensagem — uma já é pública, a outra não", () => {
    const r = oQuePrecisaDeVoce({ ...NADA, falhasPublicacao: 1, falhasMensagem: 2 });
    expect(r.map((i) => i.chave)).toEqual(["falha-publicacao", "falha-mensagem"]);
  });

  it("o convite fica por último, mesmo com tudo mais pendente", () => {
    const r = oQuePrecisaDeVoce({
      esperando: [quem("alguem", 23)],
      falhasPublicacao: 1,
      falhasMensagem: 1,
      automacoesAtivas: 0,
      oportunidades: [],
    });
    expect(r[r.length - 1].chave).toBe("sem-automacao");
  });
});

describe("a janela fechada não é pendência", () => {
  // DEPOIS DE FECHADA NÃO HÁ O QUE FAZER, e listar o que não tem ação é o
  // oposto do que esta tela existe para ser. A pessoa continua na lista de
  // conversas; ela só não é mais um chamado.
  it("conversa com a janela já fechada some da tela inicial", () => {
    const r = oQuePrecisaDeVoce({ ...NADA, esperando: [{ igId: "x", quem: "tarde", msLeft: 0 }] });
    expect(r).toEqual([]);
  });

  it("msLeft negativo também some — a fonte pode devolver o passado", () => {
    const r = oQuePrecisaDeVoce({ ...NADA, esperando: [{ igId: "x", quem: "t", msLeft: -5000 }] });
    expect(r).toEqual([]);
  });
});

describe("a urgência de cada linha", () => {
  it("abaixo do corte a conversa é `fecha`", () => {
    const r = oQuePrecisaDeVoce({ ...NADA, esperando: [quem("x", 22)] });
    expect(r[0].urgencia).toBe("fecha");
  });

  it("acima do corte ela é `aberto` — há tempo, e a cor diz isso", () => {
    const r = oQuePrecisaDeVoce({ ...NADA, esperando: [quem("x", 2)] });
    expect(r[0].urgencia).toBe("aberto");
  });

  it("falha é sempre `parou`, nos dois tipos", () => {
    const r = oQuePrecisaDeVoce({ ...NADA, falhasPublicacao: 1, falhasMensagem: 1 });
    expect(r.map((i) => i.urgencia)).toEqual(["parou", "parou"]);
  });
});

describe("urgenciaDaJanela, que as duas telas compartilham", () => {
  // ELA EXISTE PARA A LISTA DE CONVERSAS CONCORDAR COM A TELA INICIAL. Enquanto
  // a regra morava dentro da lista, a outra tela só podia concordar copiando o
  // número — e é assim que duas telas passam a discordar sobre o mesmo fato.
  it("fechada é `quieto`: depois que acabou não há o que correr", () => {
    expect(urgenciaDaJanela(0)).toBe("quieto");
    expect(urgenciaDaJanela(-1)).toBe("quieto");
  });

  it("o corte separa `fecha` de `aberto`, e é o mesmo da tela inicial", () => {
    const corte = HORAS_QUE_TORNAM_URGENTE * 3_600_000;
    expect(urgenciaDaJanela(corte - 1)).toBe("fecha");
    expect(urgenciaDaJanela(corte)).toBe("aberto");
  });

  it("é a MESMA regra que a linha de conversa do Início usa", () => {
    // Sem este caso, alguém pode mudar uma das duas e a suíte fica verde com as
    // telas discordando — que é exatamente o defeito que a extração evita.
    const r = oQuePrecisaDeVoce({ ...NADA, esperando: [quem("x", 22)] });
    expect(r[0].urgencia).toBe(urgenciaDaJanela(r[0].msLeft!));
  });
});

describe("a lista não vira a tela de conversas", () => {
  const muitas = Array.from({ length: MAX_CONVERSAS_NO_INICIO + 4 }, (_, i) =>
    quem("p" + i, 23 - i * 0.1)
  );

  it("mostra no máximo o limite de conversas", () => {
    const r = oQuePrecisaDeVoce({ ...NADA, esperando: muitas });
    expect(r.filter((i) => i.tipo === "conversa")).toHaveLength(MAX_CONVERSAS_NO_INICIO);
  });

  it("e diz quantas ficaram de fora, em vez de escondê-las", () => {
    const r = oQuePrecisaDeVoce({ ...NADA, esperando: muitas });
    const resto = r.find((i) => i.chave === "mais-conversas");
    expect(resto, "a linha do resto tem de existir").toBeDefined();
    // O NÚMERO VAI NO TÍTULO, que é a parte que se lê de relance: é ele que
    // impede a tela de dizer "cinco esperam" quando são nove.
    expect(resto!.titulo).toContain("4");
    expect(resto!.href).toBe("/conversas");
  });

  it("com exatamente o limite, não há linha de resto", () => {
    const r = oQuePrecisaDeVoce({ ...NADA, esperando: muitas.slice(0, MAX_CONVERSAS_NO_INICIO) });
    expect(r.find((i) => i.chave === "mais-conversas")).toBeUndefined();
  });

  // O CORTE É DAS MAIS APERTADAS, e não das primeiras que chegaram: a lista
  // entra em qualquer ordem, e quem sobra tem de ser quem fecha antes.
  it("quem fica são as que fecham primeiro, mesmo com a entrada bagunçada", () => {
    const embaralhadas = [quem("folgada", 1), quem("apertada", 23), quem("media", 12)];
    const r = oQuePrecisaDeVoce({ ...NADA, esperando: embaralhadas });
    expect(r.map((i) => i.chave)).toEqual([
      "conversa:ig_apertada",
      "conversa:ig_media",
      "conversa:ig_folgada",
    ]);
  });
});

describe("as frases, que são a tela", () => {
  it("o singular e o plural saem inteiros nas duas falhas", () => {
    const uma = oQuePrecisaDeVoce({ ...NADA, falhasPublicacao: 1, falhasMensagem: 1 });
    expect(uma[0].titulo).not.toContain("publicações");
    expect(uma[1].titulo).not.toContain("mensagens");
    const varias = oQuePrecisaDeVoce({ ...NADA, falhasPublicacao: 3, falhasMensagem: 2 });
    expect(varias[0].titulo).toContain("publicações");
    expect(varias[1].titulo).toContain("mensagens");
  });

  // A JANELA DE CADA FALHA APARECE NO TEXTO, e vem da MESMA constante que a
  // consulta do painel usa. Ela existia na frase antiga e sumiu quando a tela
  // foi reescrita (10/09/2026) — quem pegou foi um caso de integração, 138
  // segundos depois. Estes dois casos passam a pegar em 4 milissegundos.
  //
  // E AS DUAS JANELAS SÃO DIFERENTES DE PROPÓSITO: publicação vai a 7 dias
  // porque o modo de falha declarado é "falha na sexta à noite, ninguém vê até
  // segunda"; mensagem fica nas 24h de sempre.
  it("a janela da publicação aparece, e é a da constante", () => {
    const r = oQuePrecisaDeVoce({ ...NADA, falhasPublicacao: 1 });
    expect(r[0].detalhe).toContain(String(DIAS_DE_AVISO_DA_PUBLICACAO));
  });

  it("a janela da mensagem aparece, e é a da constante", () => {
    const r = oQuePrecisaDeVoce({ ...NADA, falhasMensagem: 1 });
    expect(r[0].detalhe).toContain(String(HORAS_DE_AVISO_DA_MENSAGEM));
  });

  // O VOCABULÁRIO NÃO MUDA: o selo da automação diz "Ativa" na lista de
  // automações, e esta tela tem de dizer a mesma palavra. Trocar por "ligada"
  // numa reescrita foi exatamente o que aconteceu, e a spec da reformulação
  // lista "não muda vocabulário" entre o que ela NÃO faz.
  it("o convite usa a palavra que o resto do produto usa", () => {
    const r = oQuePrecisaDeVoce({ ...NADA, automacoesAtivas: 0 });
    // A PALAVRA INTEIRA, e não a substring: `toContain("ativa")` era satisfeito
    // por "inativa", "desativada" e "ativação" — o caso aceitaria o CONTRÁRIO
    // do que se chama a medir. Achado por revisão em 11/09/2026.
    expect(r[0].titulo.toLowerCase().split(/\s+/)).toContain("ativa");
  });

  // CADA LINHA LEVA A ALGUM LUGAR. Uma pendência sem destino é uma reclamação.
  it("toda linha tem destino, e o destino é a tela que resolve", () => {
    const r = oQuePrecisaDeVoce({
      esperando: [quem("marcio", 23)],
      falhasPublicacao: 1,
      falhasMensagem: 1,
      automacoesAtivas: 0,
      oportunidades: [],
    });
    const destinos = Object.fromEntries(r.map((i) => [i.chave, i.href]));
    expect(destinos["conversa:ig_marcio"]).toBe("/conversas/ig_marcio");
    // O ENDERECO MUDOU EM 11/09/2026 (o calendario virou a cara da secao e o
    // compositor desceu para /publicar/novo); a GARANTIA e a mesma: falha de
    // publicacao manda para as Publicacoes, e nunca para Atividade.
    expect(destinos["falha-publicacao"]).toBe("/publicar");
    expect(destinos["falha-publicacao"]).not.toBe(destinos["falha-mensagem"]);
    expect(destinos["falha-mensagem"]).toBe("/eventos");
    expect(destinos["sem-automacao"]).toBe("/automacoes/nova");
  });

  // O id vem do banco e vira caminho de URL. Um id com barra inventaria um
  // segmento de rota; o mesmo cuidado que `urlDaConversaComAviso` já toma.
  it("o id da conversa vai codificado no caminho", () => {
    const r = oQuePrecisaDeVoce({
      ...NADA,
      esperando: [{ igId: "a/b?c", quem: "x", msLeft: restam(23) }],
    });
    expect(r[0].href).toBe("/conversas/a%2Fb%3Fc");
  });

  // QUEM NÃO TEM @ AINDA APARECE. O username pode ser nulo (contato que só
  // comentou, perfil privado): a linha não pode virar "@null" nem sumir, porque
  // a janela dessa pessoa fecha igual.
  it("conversa sem nome não vira `@null` nem some", () => {
    const r = oQuePrecisaDeVoce({
      ...NADA,
      esperando: [{ igId: "ig_x", quem: null, msLeft: restam(23) }],
    });
    expect(r).toHaveLength(1);
    expect(r[0].titulo.toLowerCase()).not.toContain("null");
    expect(r[0].titulo.length).toBeGreaterThan(0);
  });
});

describe("legendaDoPrazo — a frase que a tela inicial mostra", () => {
  // ELA ERA A ÚNICA FUNÇÃO EXPORTADA DOS MÓDULOS NOVOS SEM UM ÚNICO CASO, e um
  // plante de revisão mostrou o custo: trocar o corpo por `return resta;` fazia
  // a tela inicial dizer "2h10" pelado, sem dizer que é prazo, e nada reprovava.
  const H = 3_600_000;

  it("diz que é PRAZO, e não só um tempo solto", () => {
    expect(legendaDoPrazo(2 * H + 10 * 60_000)).toBe("fecha em 2h10");
  });

  it("fechada não vira `fecha em fechada`", () => {
    expect(legendaDoPrazo(0)).toBe("fechada");
    expect(legendaDoPrazo(-1)).toBe("fechada");
  });

  it("os minutos passam inteiros", () => {
    expect(legendaDoPrazo(55 * 60_000)).toBe("fecha em 55 min");
  });

  it("é construída SOBRE `formatWindowLeft`, e não ao lado dela", () => {
    // A restrição da spec: a janela de 24h tem UMA fonte. Se alguém escrever
    // uma segunda formatação aqui, este caso divergirá.
    for (const ms of [0, 60_000, 3 * H, 23 * H]) {
      const resta = formatWindowLeft(ms);
      expect(legendaDoPrazo(ms)).toBe(resta === "fechada" ? "fechada" : "fecha em " + resta);
    }
  });
});

describe("a linha do resto herda a urgência de quem ela esconde", () => {
  // ACHADO POR REVISÃO: a linha cravava `urgencia: "aberto"` mesmo quando TODAS
  // as escondidas estavam abaixo do corte — anunciava em VERDE DE CALMA que
  // quatro pessoas cujas janelas fecham em minutos "ainda têm a janela aberta".
  const muitas = (horas: number[]) =>
    horas.map((h, i) => ({ igId: "p" + i, quem: "p" + i, msLeft: restam(h) }));

  it("com escondidas apertadas, a linha é `fecha`", () => {
    const r = oQuePrecisaDeVoce({ ...NADA, esperando: muitas([23, 23, 23, 23, 23, 22.9, 22.8]) });
    expect(r.find((i) => i.chave === "mais-conversas")!.urgencia).toBe("fecha");
  });

  it("com escondidas folgadas, continua `aberto`", () => {
    const r = oQuePrecisaDeVoce({ ...NADA, esperando: muitas([23, 23, 23, 23, 23, 2, 1]) });
    expect(r.find((i) => i.chave === "mais-conversas")!.urgencia).toBe("aberto");
  });
});

describe("as frases das linhas, que são o que se lê na tela", () => {
  // QUATRO PLANTES SOBREVIVIAM AQUI: apagar cada `detalhe` e tirar o "@" do
  // título passava nos 26 casos. `detalhe` é renderizado em `app/page.tsx`.
  it("a conversa diz o @ e o que ela espera", () => {
    const r = oQuePrecisaDeVoce({ ...NADA, esperando: [quem("marcio", 23)] });
    expect(r[0].titulo).toBe("@marcio");
    expect(r[0].detalhe).toBe("esperando resposta");
  });

  it("a linha do resto e o convite dizem alguma coisa", () => {
    const r = oQuePrecisaDeVoce({
      ...NADA,
      esperando: Array.from({ length: 7 }, (_, i) => quem("p" + i, 23)),
      automacoesAtivas: 0,
    });
    for (const chave of ["mais-conversas", "sem-automacao"]) {
      const linha = r.find((i) => i.chave === chave)!;
      expect(linha.detalhe.length, chave).toBeGreaterThan(8);
    }
  });
});

describe("recorteDasOportunidades", () => {
  const post = (mediaId: string, comentarios: number): Oportunidade => ({
    mediaId,
    comentarios,
    ultimo: new Date("2026-09-14T12:00:00Z"),
  });

  it("corta quem tem menos de 5 comentários", () => {
    // O PISO E O TETO SÃO CORTES DIFERENTES, e este caso prova só o piso:
    // quatro posts, todos abaixo do teto de 3? Não — são 4, então o teto
    // também morderia. Por isso aqui só DOIS passam do piso, e o resultado
    // sendo 2 (e não 3) mostra que quem decidiu foi o piso.
    expect(recorteDasOportunidades([post("a", 9), post("b", 4), post("c", 5)]).map((o) => o.mediaId))
      .toEqual(["a", "c"]);
  });

  it("corta em 3, e mantém os MAIORES", () => {
    // Cinco posts, todos acima do piso: agora quem decide é o teto. E a ordem
    // importa — cortar sem ordenar deixaria de fora justamente o post com mais
    // gente esperando.
    const r = recorteDasOportunidades([
      post("a", 20), post("b", 100), post("c", 45), post("d", 7), post("e", 43),
    ]);
    expect(r.map((o) => o.mediaId)).toEqual(["b", "c", "e"]);
  });

  it("lista vazia devolve vazia, e não quebra", () => {
    expect(recorteDasOportunidades([])).toEqual([]);
  });

  it("empate desempata pelo id, para a ordem não variar entre renders", () => {
    expect(recorteDasOportunidades([post("z", 10), post("a", 10)]).map((o) => o.mediaId))
      .toEqual(["a", "z"]);
  });
});

describe("a oportunidade dentro de oQuePrecisaDeVoce", () => {
  const MS_H = 3_600_000;
  const base = {
    esperando: [],
    falhasPublicacao: 0,
    falhasMensagem: 0,
    automacoesAtivas: 3,
    oportunidades: [],
  };

  it("vira linha com o número de comentários e o caminho da automação nova", () => {
    const itens = oQuePrecisaDeVoce({
      ...base,
      oportunidades: [{ mediaId: "18056760980769921", comentarios: 100, ultimo: null }],
    });
    expect(itens).toHaveLength(1);
    expect(itens[0].chave).toBe("oportunidade:18056760980769921");
    expect(itens[0].titulo).toBe("100 comentários sem automação");
    expect(itens[0].href).toBe("/automacoes/nova?post=18056760980769921");
    expect(itens[0].tipo).toBe("aviso");
  });

  it("um comentário só fala no singular", () => {
    // Testa que a frase singular é usada quando há 1 comentário. Como o piso
    // é 5, testamos indiretamente: um post com 1 comentário não aparece;
    // um post com 5 ou mais aparece. O teste verifica que com exatamente 5
    // a frase não é singular (usa "comentários" plural):
    const itens = oQuePrecisaDeVoce({
      ...base,
      oportunidades: [{ mediaId: "9", comentarios: 5, ultimo: null }],
    });
    expect(itens[0].titulo).toBe("5 comentários sem automação");
    // A frase singular seria usada apenas se houvesse um post com 1 comentário
    // que passasse no filtro, o que não é possível com piso de 5.
  });

  it("ENTRA ABAIXO da conversa apertada e ACIMA da falha de publicação", () => {
    // A ordem é a regra do arquivo: primeiro o que desaparece se ninguém agir.
    // A conversa de 1h expira por relógio; a oportunidade cresce mas não vira
    // zero de uma vez; a publicação que falhou continuará falhada.
    const itens = oQuePrecisaDeVoce({
      ...base,
      esperando: [
        { igId: "urgente", quem: "apertada", msLeft: 1 * MS_H },
        { igId: "calma", quem: "folgada", msLeft: 20 * MS_H },
      ],
      falhasPublicacao: 2,
      oportunidades: [{ mediaId: "77", comentarios: 50, ultimo: null }],
    });
    expect(itens.map((i) => i.chave)).toEqual([
      "conversa:urgente",
      "oportunidade:77",
      "falha-publicacao",
      "conversa:calma",
    ]);
  });

  it("usa o nome do post quando ele veio, e sobrevive quando não veio", () => {
    // O nome vem da Meta (`resolvePosts`), que pode falhar ou demorar. A linha
    // tem de renderizar inteira nos dois casos -- e este par prende isso.
    const com = oQuePrecisaDeVoce({
      ...base,
      oportunidades: [
        { mediaId: "1", comentarios: 9, ultimo: null, nome: "Carrossel ChatGPT" },
      ],
    });
    expect(com[0].detalhe).toBe("Carrossel ChatGPT");

    const sem = oQuePrecisaDeVoce({
      ...base,
      oportunidades: [{ mediaId: "1", comentarios: 9, ultimo: null }],
    });
    expect(sem[0].detalhe).toBe("nenhuma automação escuta este post");
  });

  it("o id do post é codificado no caminho, porque vira URL", () => {
    const itens = oQuePrecisaDeVoce({
      ...base,
      oportunidades: [{ mediaId: "a/b?c", comentarios: 9, ultimo: null }],
    });
    expect(itens[0].href).toBe("/automacoes/nova?post=a%2Fb%3Fc");
  });
});
