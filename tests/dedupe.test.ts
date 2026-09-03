import { describe, it, expect } from "vitest";
import {
  privateReplyKey,
  commentReplyKey,
  followGateKey,
  emailAskKey,
  followupKey,
  emailAnswerKey,
  welcomeMessageKey,
  storyReactionKey,
  passoKey,
  loteKey,
  publicacaoKey,
  diaDaChave,
} from "@/lib/dedupe";
// A afirmação "o id sobrevive à reordenação" é sobre a COMPOSIÇÃO das duas
// funções: `identidadeDoPasso` é quem lê a posição, e `passoKey` é quem a
// transforma em chave. Testar só uma delas não afirma nada sobre arrastar.
import { identidadeDoPasso } from "@/lib/steps";

// A coluna dedupe_key é UNIQUE e o enqueue usa `on conflict do nothing`. Esse
// par é a ÚNICA coisa que impede a mesma pessoa de receber a mesma mensagem
// duas vezes.
//
// Os formatos abaixo estão escritos por extenso de propósito. Não são um
// espelho da implementação: são o valor que já existe no banco de quem está
// usando o sistema. Mudar um deles faz os itens antigos deixarem de casar com
// os novos — ou seja, libera envio em dobro. Se um destes testes ficar
// vermelho, a pergunta certa é "eu quis mesmo mudar isso?", não "como faço o
// teste passar?".

describe("chaves vindas de comentário", () => {
  it("usa o id do comentário, que já é único e permanente", () => {
    expect(privateReplyKey("17900112233")).toBe("pr:17900112233");
    expect(commentReplyKey("17900112233")).toBe("cr:17900112233");
  });

  it("separa resposta privada de resposta pública do MESMO comentário", () => {
    // Sem prefixos diferentes, mandar as duas cairia no UNIQUE e uma sumiria.
    expect(privateReplyKey("abc")).not.toBe(commentReplyKey("abc"));
  });
});

describe("chaves com balde de dia", () => {
  it("mantém o formato por automação, pessoa e dia", () => {
    expect(emailAskKey("auto-1", "user-9", "2026-07-28")).toBe("ea:auto-1:user-9:2026-07-28");
    expect(followupKey("fup-3", "user-9", "2026-07-28")).toBe("fu:fup-3:user-9:2026-07-28");
  });

  it("o portão de seguidor inclui a tentativa, para cada pedido ser um item novo", () => {
    expect(followGateKey("auto-1", "user-9", "2026-07-28", 0)).toBe(
      "fg:auto-1:user-9:2026-07-28:0"
    );
    expect(followGateKey("auto-1", "user-9", "2026-07-28", 1)).toBe(
      "fg:auto-1:user-9:2026-07-28:1"
    );
  });

  it("libera de novo no dia seguinte, mas não duas vezes no mesmo dia", () => {
    const hoje = followupKey("fup-3", "user-9", "2026-07-28");
    const amanha = followupKey("fup-3", "user-9", "2026-07-29");
    expect(hoje).not.toBe(amanha);
    expect(followupKey("fup-3", "user-9", "2026-07-28")).toBe(hoje);
  });

  it("não confunde pessoas diferentes na mesma automação", () => {
    expect(followupKey("fup-3", "user-1", "2026-07-28")).not.toBe(
      followupKey("fup-3", "user-2", "2026-07-28")
    );
  });
});

describe("passoKey", () => {
  // É a chave de TODO passo `dm` que não sai como resposta privada — ou seja, a
  // que segura a repetição do fluxo novo inteiro. Estava sem teste enquanto o
  // arquivo afirmava, logo acima, que os testes existem para nenhuma mudança de
  // formato passar despercebida.

  it("mantém o formato por automação, pessoa, IDENTIDADE e dia", () => {
    expect(passoKey("auto-1", "user-9", "b_7f3a91c2", "2026-07-28")).toBe(
      "passo:auto-1:user-9:b_7f3a91c2:2026-07-28"
    );
  });

  it("a chave de um bloco SEM id é byte a byte a mesma de antes", () => {
    // Este teste é o que garante que o deploy não reenvia: a fila já tem
    // linhas `passo:...:2:...` gravadas com o índice, e elas precisam
    // continuar casando.
    expect(passoKey("auto-1", "user-9", "2", "2026-07-28")).toBe(
      "passo:auto-1:user-9:2:2026-07-28"
    );
  });

  it("a identidade separa blocos da MESMA automação no mesmo dia", () => {
    expect(passoKey("auto-1", "user-9", "b_aaa111", "2026-07-28")).not.toBe(
      passoKey("auto-1", "user-9", "b_bbb222", "2026-07-28")
    );
  });

  it("o id sobrevive à reordenação — é o ponto desta fase", () => {
    // A MESMA lista em duas ordens. O bloco muda de posição e a chave não muda —
    // é isto que faz arrastar deixar de reenviar mensagem.
    //
    // A versão anterior deste teste chamava `passoKey` duas vezes com os mesmos
    // quatro literais e comparava os resultados: passava com
    // `passoKey = () => "x"`, e nenhuma posição entrava nele. Quem carrega a
    // afirmação é a COMPOSIÇÃO com `identidadeDoPasso`, porque é ela que lê a
    // posição — sem ela não há reordenação nenhuma no teste.
    const a = { id: "b_aaa111", tipo: "dm", texto: "um" };
    const b = { id: "b_bbb222", tipo: "dm", texto: "dois" };
    const antes = [a, b];
    const depois = [b, a];
    expect(passoKey("auto-1", "user-9", identidadeDoPasso(depois[1], 1), "2026-07-28")).toBe(
      passoKey("auto-1", "user-9", identidadeDoPasso(antes[0], 0), "2026-07-28")
    );
  });

  // As duas guardas abaixo se perderam quando os testes por índice foram
  // substituídos pelos de identidade. Elas continuavam cobertas só via
  // `followupKey`, que o topo de lib/dedupe.ts marca como MORTA — na prática,
  // guarda de função viva trocada por guarda de função sem chamador.

  it("o balde de dia separa: a mesma identidade em dias diferentes não colide", () => {
    // O balde é o que deixa a mesma automação entregar de novo AMANHÃ sem
    // entregar duas vezes hoje. Sem ele, quem acionasse a automação de novo no
    // dia seguinte não receberia nada.
    const hoje = passoKey("auto-1", "user-9", "b_aaa111", "2026-07-28");
    const amanha = passoKey("auto-1", "user-9", "b_aaa111", "2026-07-29");
    expect(hoje).not.toBe(amanha);
    // E, dentro do mesmo dia, a chave é estável — é ela que segura a repetição.
    expect(passoKey("auto-1", "user-9", "b_aaa111", "2026-07-28")).toBe(hoje);
  });

  it("pessoas diferentes e automações diferentes não colidem", () => {
    // Colisão aqui não dá erro: o `on conflict do nothing` engole o segundo item
    // e alguém simplesmente deixa de receber a mensagem, sem rastro.
    expect(passoKey("auto-1", "user-1", "b_aaa111", "2026-07-28")).not.toBe(
      passoKey("auto-1", "user-2", "b_aaa111", "2026-07-28")
    );
    expect(passoKey("auto-1", "user-9", "b_aaa111", "2026-07-28")).not.toBe(
      passoKey("auto-2", "user-9", "b_aaa111", "2026-07-28")
    );
  });
});

describe("chaves vindas de mensagem recebida", () => {
  it("usa o id da mensagem quando a Meta manda", () => {
    expect(emailAnswerKey("mid-42", "user-9", 1_700_000_000_000)).toBe("ear:mid-42");
    expect(welcomeMessageKey("mid-42", "user-9", 1_700_000_000_000)).toBe("wm:mid-42");
  });

  it("sem id da mensagem, cai em remetente + instante", () => {
    // Não deduplica de verdade, mas é melhor que uma chave fixa: esta barraria
    // envio legítimo para pessoas diferentes por colisão no UNIQUE.
    expect(emailAnswerKey(undefined, "user-9", 1_700_000_000_000)).toBe(
      "ear:user-9:1700000000000"
    );
    expect(welcomeMessageKey(undefined, "user-9", 1_700_000_000_000)).toBe(
      "wm:user-9:1700000000000"
    );
  });

  it("na ausência de id, pessoas diferentes no mesmo instante não colidem", () => {
    const agora = 1_700_000_000_000;
    expect(welcomeMessageKey(undefined, "user-1", agora)).not.toBe(
      welcomeMessageKey(undefined, "user-2", agora)
    );
  });

  it("reação a story usa o id da mensagem", () => {
    expect(storyReactionKey("mid-42")).toBe("rx:mid-42");
  });
});

describe("o dia da chave é o dia de Brasília, não o de UTC", () => {
  // Estes três são a correção inteira. Antes, o dia virava às 21h locais, e
  // quem acionasse às 20h e às 22h da mesma noite recebia a sequência duas
  // vezes. Os instantes estão em UTC (o `Z`) de propósito: é assim que o
  // servidor da Vercel enxerga o relógio, e é dali que a conversão parte.
  it("às 20h de Brasília ainda é o mesmo dia", () => {
    // 2026-08-06 23:00Z = 2026-08-06 20:00 em São Paulo
    expect(diaDaChave(new Date("2026-08-06T23:00:00Z"))).toBe("2026-08-06");
  });

  it("às 22h de Brasília CONTINUA sendo o mesmo dia — era aqui que virava", () => {
    // 2026-08-07 01:00Z = 2026-08-06 22:00 em São Paulo.
    // Em UTC isto dava "2026-08-07": balde novo, mensagem repetida.
    expect(diaDaChave(new Date("2026-08-07T01:00:00Z"))).toBe("2026-08-06");
    expect(diaDaChave(new Date("2026-08-07T01:00:00Z"))).not.toBe("2026-08-07");
  });

  it("à meia-noite de Brasília o dia vira", () => {
    // 2026-08-07 02:59Z = 2026-08-06 23:59 | 03:00Z = 2026-08-07 00:00
    expect(diaDaChave(new Date("2026-08-07T02:59:00Z"))).toBe("2026-08-06");
    expect(diaDaChave(new Date("2026-08-07T03:00:00Z"))).toBe("2026-08-07");
  });

  it("o formato continua YYYY-MM-DD, senão as chaves já gravadas não casam", () => {
    expect(diaDaChave(new Date("2026-01-09T15:00:00Z"))).toBe("2026-01-09");
  });

  it("dois instantes do mesmo dia local dão a MESMA chave", () => {
    const manha = passoKey("a", "c", "0", diaDaChave(new Date("2026-08-06T13:00:00Z")));
    const noite = passoKey("a", "c", "0", diaDaChave(new Date("2026-08-07T01:00:00Z")));
    expect(noite).toBe(manha);
  });
});

describe("os prefixos não se repetem entre tipos", () => {
  it("cada tipo de envio tem o seu", () => {
    const prefixos = [
      privateReplyKey("x"),
      commentReplyKey("x"),
      followGateKey("a", "c", "d", 0),
      emailAskKey("a", "c", "d"),
      followupKey("f", "c", "d"),
      emailAnswerKey("m", "s", 1),
      welcomeMessageKey("m", "s", 1),
      storyReactionKey("m"),
      passoKey("a", "c", "0", "d"),
      loteKey("acc-1", "L1", "c"),
      publicacaoKey("acc-1", "acc-1/abc.jpg"),
    ].map((k) => k.split(":")[0]);

    expect(new Set(prefixos).size).toBe(prefixos.length);
  });
});

describe("publicacaoKey", () => {
  it("mantém o formato: pub, conta e caminho do objeto", () => {
    expect(publicacaoKey("acc-1", "acc-1/abc.jpg")).toBe("pub:acc-1:acc-1/abc.jpg");
  });

  // O CAMINHO DO OBJETO É O QUE TORNA O POST ÚNICO, e não um identificador
  // inventado na tela. `caminhoDoObjeto` (lib/bucket.ts) sorteia um `randomUUID`
  // por upload, então dois posts nunca compartilham caminho — e o MESMO post
  // pedido duas vezes (clique duplo em "publicar", ou a aba recarregada com o
  // formulário preenchido) traz o mesmo caminho e vira um item só.
  it("dois uploads diferentes são dois posts", () => {
    expect(publicacaoKey("acc-1", "acc-1/um.jpg")).not.toBe(
      publicacaoKey("acc-1", "acc-1/dois.jpg")
    );
  });

  // A CONTA ENTRA PELO MESMO MOTIVO DE `loteKey`: `dedupe_key` é `unique` na
  // TABELA INTEIRA (migrations/000-esquema-base.sql), sem coluna de conta na
  // restrição. O caminho do objeto já começa pela conta hoje, mas ele vem do
  // payload — dado de fora — e a defesa aqui é estrutural, e não a confiança
  // em como outro arquivo monta a string.
  it("o mesmo caminho em duas contas não colide", () => {
    expect(publicacaoKey("conta-a", "objeto.jpg")).not.toBe(
      publicacaoKey("conta-b", "objeto.jpg")
    );
  });

  // O PRIMEIRO CAMINHO É A IDENTIDADE DO CARROSSEL (Tarefa 6): dez arquivos
  // fazem um post, e o post é um item de fila só. Repetir os dez na chave
  // deixaria a chave gigante sem tornar nada mais único.
  it("o carrossel é identificado pelo primeiro arquivo", () => {
    expect(publicacaoKey("acc-1", "acc-1/primeiro.jpg")).toBe("pub:acc-1:acc-1/primeiro.jpg");
  });
});

describe("loteKey", () => {
  it("mantém o formato: lote, conta, lote e contato", () => {
    expect(loteKey("acc-1", "L1", "user-9")).toBe("lote:acc-1:L1:user-9");
  });

  // O ACHADO: a mesma pessoa (mesmo ig_id) pode falar com duas contas
  // conectadas — migrations/005-contatos-chave-composta.sql é a prova de que
  // isso acontece de verdade. Sem o accountId na chave, um loteId igual nas
  // duas contas colidiria no dedupe_key (unique na tabela inteira) e o
  // segundo envio desapareceria no `on conflict do nothing`.
  it("o mesmo loteId para a mesma pessoa NÃO colide entre contas diferentes", () => {
    expect(loteKey("conta-a", "L1", "user-9")).not.toBe(loteKey("conta-b", "L1", "user-9"));
  });

  it("loteId diferente para a mesma pessoa na mesma conta continua distinto", () => {
    expect(loteKey("acc-1", "L1", "user-9")).not.toBe(loteKey("acc-1", "L2", "user-9"));
  });

  it("mesmo lote, pessoas diferentes, não colidem", () => {
    expect(loteKey("acc-1", "L1", "user-1")).not.toBe(loteKey("acc-1", "L1", "user-2"));
  });
});
