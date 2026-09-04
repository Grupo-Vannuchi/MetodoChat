import { describe, it, expect } from "vitest";
import {
  problemaDoArquivo,
  textoDoProblema,
  parametrosDoContainer,
  estadoDoContainer,
  problemaDaLegenda,
  decisaoDeAssinatura,
  PUBLICACOES_POR_DIA,
  JANELA_DA_COTA_EM_SEGUNDOS,
  leituraDoContainer,
  cotaDePublicacao,
  cotaEstourada,
  payloadDaPublicacao,
  lerPayloadDaPublicacao,
  planoDaConversao,
  nomeDepoisDaConversao,
  QUALIDADE_DO_JPEG,
  porcentagemDoEnvio,
  fraseDoEnvio,
  resumoDoProgresso,
  formaQueATelaPublica,
  camposDaDataHora,
  momentoDaPublicacao,
  textoDoProblemaDaLegenda,
  caminhosDoCampo,
  fusoDoCampo,
  FUSO_DO_PAINEL_EM_MINUTOS,
  instanteDoAgendamento,
  textoDaRecusaDaPublicacao,
  tiposQueOCampoAceita,
  parametrosDoContainerPai,
  recusaDaQuantidade,
  moverNaOrdem,
  rotuloDoEnvio,
} from "../lib/publicacao";

const MB = 1024 * 1024;

// OS DOIS TETOS DE BUCKET QUE ESTES CASOS USAM, e por que são dois.
//
// `problemaDoArquivo` recebe o teto do bucket COMO PARÂMETRO (ver o cabeçalho
// de `lib/publicacao.ts`): o projeto do Supabase está hoje em 50 MB porque o
// pagamento do plano pago atrasou, e o teto sobe sozinho quando ele entrar.
// Cravar 50 MB no código criaria uma dívida que ninguém lembra de pagar.
//
// `TETO_HOJE` é o número MEDIDO em 03/09/2026 contra a API do Supabase
// (`file_size_limit: 52428800`); `TETO_PAGO` é o do plano pago, e ele existe
// aqui para provar que o MESMO arquivo muda de resposta quando o teto muda —
// que é a coisa que um número cravado não conseguiria dizer.
const TETO_HOJE = 50 * MB;
const TETO_PAGO = 500 * 1024 * MB;

describe("problemaDoArquivo — imagem", () => {
  it("JPEG dentro das regras serve", () => {
    expect(
      problemaDoArquivo(
        "imagem",
        { mime: "image/jpeg", bytes: 2 * MB, largura: 1080, altura: 1080 },
        TETO_PAGO
      )
    ).toBeNull();
  });
  // A META SO ACEITA JPEG, e PNG e o formato mais comum de quem monta arte.
  // Recusar aqui, ANTES do upload, e a diferenca entre um aviso na hora e 8 MB
  // enviados para a Meta recusar depois.
  it("PNG nao serve", () => {
    expect(
      problemaDoArquivo(
        "imagem",
        { mime: "image/png", bytes: 1 * MB, largura: 1080, altura: 1080 },
        TETO_PAGO
      )
    ).toBe("tipo_nao_suportado");
  });
  it("acima de 8 MB nao serve", () => {
    expect(
      problemaDoArquivo(
        "imagem",
        { mime: "image/jpeg", bytes: 9 * MB, largura: 1080, altura: 1080 },
        TETO_PAGO
      )
    ).toBe("grande_demais");
  });
  // Faixa 4:5 (0,8) a 1.91:1. As duas BORDAS entram, e o teste as prende: um
  // `<` no lugar de `<=` recusaria arte quadrada-vertical legitima.
  it("as bordas da proporcao entram", () => {
    expect(
      problemaDoArquivo("imagem", { mime: "image/jpeg", bytes: MB, largura: 800, altura: 1000 }, TETO_PAGO)
    ).toBeNull();
    expect(
      problemaDoArquivo("imagem", { mime: "image/jpeg", bytes: MB, largura: 1910, altura: 1000 }, TETO_PAGO)
    ).toBeNull();
  });
  it("mais vertical que 4:5 nao serve", () => {
    expect(
      problemaDoArquivo("imagem", { mime: "image/jpeg", bytes: MB, largura: 700, altura: 1000 }, TETO_PAGO)
    ).toBe("proporcao_fora");
  });
  it("abaixo de 320px de largura nao serve", () => {
    expect(
      problemaDoArquivo("imagem", { mime: "image/jpeg", bytes: MB, largura: 300, altura: 300 }, TETO_PAGO)
    ).toBe("estreito_demais");
  });
});

describe("problemaDoArquivo — reels e story", () => {
  it("reels de 10 minutos e 200 MB serve", () => {
    expect(
      problemaDoArquivo("reels", { mime: "video/mp4", bytes: 200 * MB, segundos: 600 }, TETO_PAGO)
    ).toBeNull();
  });
  it("reels acima de 15 minutos nao serve", () => {
    expect(
      problemaDoArquivo("reels", { mime: "video/mp4", bytes: 10 * MB, segundos: 16 * 60 }, TETO_PAGO)
    ).toBe("longo_demais");
  });
  it("menos de 3 segundos nao serve, nas duas formas", () => {
    expect(problemaDoArquivo("reels", { mime: "video/mp4", bytes: MB, segundos: 2 }, TETO_PAGO)).toBe(
      "curto_demais"
    );
    expect(problemaDoArquivo("story", { mime: "video/mp4", bytes: MB, segundos: 2 }, TETO_PAGO)).toBe(
      "curto_demais"
    );
  });
  // OS LIMITES DE STORY SAO OUTROS, e este par e o que impede alguem de
  // reaproveitar a regra do reels: 60s contra 15min, 100 MB contra 300 MB.
  it("story de 90 segundos nao serve, mas reels serve", () => {
    expect(problemaDoArquivo("story", { mime: "video/mp4", bytes: MB, segundos: 90 }, TETO_PAGO)).toBe(
      "longo_demais"
    );
    expect(
      problemaDoArquivo("reels", { mime: "video/mp4", bytes: MB, segundos: 90 }, TETO_PAGO)
    ).toBeNull();
  });
  it("story de video acima de 100 MB nao serve, mas reels serve", () => {
    expect(
      problemaDoArquivo("story", { mime: "video/mp4", bytes: 150 * MB, segundos: 30 }, TETO_PAGO)
    ).toBe("grande_demais");
    expect(
      problemaDoArquivo("reels", { mime: "video/mp4", bytes: 150 * MB, segundos: 30 }, TETO_PAGO)
    ).toBeNull();
  });
  // A PROPORCAO DO VIDEO E OUTRA FAIXA, e ela e larguissima: 0.01:1 a 10:1.
  // Ela nao existe para enquadrar arte — existe para pegar arquivo absurdo. E
  // a de IMAGEM (4:5 a 1.91:1) nao vale aqui: um reels 9:16 (0,5625) e mais
  // vertical que 4:5 e tem de passar. Este par e o que impede alguem de
  // reaproveitar a faixa da imagem no video.
  it("reels 9:16 passa, e uma faixa de 100:1 nao", () => {
    expect(
      problemaDoArquivo(
        "reels",
        { mime: "video/mp4", bytes: MB, segundos: 10, largura: 1080, altura: 1920 },
        TETO_PAGO
      )
    ).toBeNull();
    expect(
      problemaDoArquivo(
        "reels",
        { mime: "video/mp4", bytes: MB, segundos: 10, largura: 1000, altura: 10 },
        TETO_PAGO
      )
    ).toBe("proporcao_fora");
  });
  // VIDEO SEM DIMENSAO MEDIDA PASSA. O navegador nem sempre entrega largura e
  // altura (`videoWidth` pode ser 0 antes dos metadados), e recusar por falta
  // de medicao bloquearia arquivo bom.
  it("video sem largura e altura nao e recusado por proporcao", () => {
    expect(
      problemaDoArquivo("reels", { mime: "video/mp4", bytes: MB, segundos: 10 }, TETO_PAGO)
    ).toBeNull();
  });
  it("MOV serve, AVI nao", () => {
    expect(
      problemaDoArquivo("reels", { mime: "video/quicktime", bytes: MB, segundos: 10 }, TETO_PAGO)
    ).toBeNull();
    expect(
      problemaDoArquivo("reels", { mime: "video/x-msvideo", bytes: MB, segundos: 10 }, TETO_PAGO)
    ).toBe("tipo_nao_suportado");
  });
});

// ============================================================
// O TETO DO BUCKET — a distinção que existe porque a frase que ajuda o dono é
// diferente em cada caso.
//
// "Exporte um vídeo menor" é conselho útil quando a META recusaria de qualquer
// jeito. Quando quem recusa somos NÓS — plano do Supabase em 50 MB desde que o
// pagamento atrasou — o mesmo conselho é mentira por omissão: o arquivo está
// certo, e o que falta é o plano. Por isso são dois problemas, e não um.
// ============================================================
describe("problemaDoArquivo — o teto do bucket", () => {
  // O PAR QUE PRENDE A DISTINÇÃO: o MESMO arquivo, dois tetos, duas respostas.
  // Um número cravado em 50 MB não conseguiria produzir a segunda linha, e o
  // sintoma no dia em que o plano voltasse seria "não sei por que não sobe".
  it("80 MB nao cabe no bucket de hoje, e cabe no do plano pago", () => {
    const video = { mime: "video/mp4", bytes: 80 * MB, segundos: 30 };
    expect(problemaDoArquivo("reels", video, TETO_HOJE)).toBe("grande_para_o_bucket");
    expect(problemaDoArquivo("reels", video, TETO_PAGO)).toBeNull();
  });

  // QUANDO OS DOIS TETOS SAO ESTOURADOS, QUEM MANDA E A META. Um story de
  // 150 MB passa de 100 MB (Meta) e de 50 MB (bucket) ao mesmo tempo; a resposta
  // tem de ser `grande_demais`, porque subir o plano NAO faria este arquivo
  // funcionar. Dizer "nosso plano nao aceita" aqui mandaria o dono cobrar um
  // pagamento que nao resolveria nada.
  it("estourando os dois tetos, a recusa e a da Meta", () => {
    expect(
      problemaDoArquivo("story", { mime: "video/mp4", bytes: 150 * MB, segundos: 30 }, TETO_HOJE)
    ).toBe("grande_demais");
  });

  // A IMAGEM QUASE NUNCA ENCOSTA NO TETO DO BUCKET, porque o da Meta (8 MB) e
  // menor que o nosso (50 MB) — e este caso registra isso em vez de deixar
  // alguem supor.
  it("imagem de 9 MB e recusada pela Meta mesmo com o bucket de hoje", () => {
    expect(
      problemaDoArquivo(
        "imagem",
        { mime: "image/jpeg", bytes: 9 * MB, largura: 1080, altura: 1080 },
        TETO_HOJE
      )
    ).toBe("grande_demais");
  });

  // O TIPO VEM ANTES DO TAMANHO: um AVI de 80 MB tem dois problemas, e o que
  // ajuda e o do formato — trocar de plano nao faria a Meta aceitar AVI.
  it("formato errado ganha do teto do bucket", () => {
    expect(
      problemaDoArquivo("reels", { mime: "video/x-msvideo", bytes: 80 * MB, segundos: 10 }, TETO_HOJE)
    ).toBe("tipo_nao_suportado");
  });

  // AS DUAS FRASES SAO DIFERENTES, e este caso e o que impede alguem de
  // "simplificar" os dois problemas para o mesmo texto — que apagaria a razao
  // inteira de eles serem dois.
  it("cada recusa de tamanho tem a sua frase", () => {
    expect(textoDoProblema("grande_demais")).not.toBe(textoDoProblema("grande_para_o_bucket"));
    expect(textoDoProblema("grande_para_o_bucket")).toMatch(/plano/i);
  });

  // Nenhum problema pode sair sem frase: a tela mostra o que sai daqui, e uma
  // string vazia seria um aviso invisivel.
  it("todo problema tem texto, e nenhum e vazio", () => {
    const todos = [
      "tipo_nao_suportado",
      "grande_demais",
      "grande_para_o_bucket",
      "curto_demais",
      "longo_demais",
      "proporcao_fora",
      "estreito_demais",
    ] as const;
    for (const p of todos) expect(textoDoProblema(p).length).toBeGreaterThan(10);
  });
});

// A QUARTA FORMA NAO PODE CAIR NUM RAMO PERMISSIVO. `carrossel` existe no tipo
// desde o primeiro dia, e um `switch` sem ela devolveria `null` para tudo — o
// jeito mais silencioso de deixar 9 MB de JPEG subirem para a Meta recusar.
describe("problemaDoArquivo — carrossel", () => {
  it("item de carrossel em imagem segue a regra da imagem", () => {
    expect(
      problemaDoArquivo(
        "carrossel",
        { mime: "image/jpeg", bytes: 9 * MB, largura: 1080, altura: 1080 },
        TETO_PAGO
      )
    ).toBe("grande_demais");
    expect(
      problemaDoArquivo(
        "carrossel",
        { mime: "image/jpeg", bytes: 2 * MB, largura: 1080, altura: 1080 },
        TETO_PAGO
      )
    ).toBeNull();
  });
  it("item de carrossel em video ainda recusa formato que a Meta nao aceita", () => {
    expect(
      problemaDoArquivo("carrossel", { mime: "video/x-msvideo", bytes: MB, segundos: 10 }, TETO_PAGO)
    ).toBe("tipo_nao_suportado");
  });
});

describe("parametrosDoContainer", () => {
  it("imagem manda image_url e NAO manda media_type", () => {
    const p = parametrosDoContainer({ forma: "imagem", url: "https://x/a.jpg", legenda: "oi" });
    expect(p.image_url).toBe("https://x/a.jpg");
    expect(p.caption).toBe("oi");
    expect(p.media_type).toBeUndefined();
  });
  it("reels manda media_type REELS e video_url", () => {
    const p = parametrosDoContainer({ forma: "reels", url: "https://x/a.mp4", compartilharNoFeed: true });
    expect(p.media_type).toBe("REELS");
    expect(p.video_url).toBe("https://x/a.mp4");
    expect(p.share_to_feed).toBe("true");
  });
  it("story manda media_type STORIES", () => {
    expect(parametrosDoContainer({ forma: "story", url: "https://x/a.mp4" }).media_type).toBe("STORIES");
  });
  // FILHO DE CARROSSEL NAO LEVA LEGENDA NEM media_type, e leva
  // is_carousel_item. A legenda mora no PAI — repeti-la no filho e o erro
  // natural de quem reaproveita a funcao.
  it("filho de carrossel leva is_carousel_item e nao leva legenda", () => {
    const p = parametrosDoContainer({
      forma: "imagem",
      url: "https://x/a.jpg",
      legenda: "oi",
      filho: true,
    });
    expect(p.is_carousel_item).toBe("true");
    expect(p.caption).toBeUndefined();
  });
  // REELS NAO ENTRA EM CARROSSEL — regra da Meta, e a funcao tem de recusar em
  // vez de montar um pedido que a Meta rejeita depois de dois uploads.
  it("reels como filho de carrossel e recusado", () => {
    expect(() => parametrosDoContainer({ forma: "reels", url: "https://x/a.mp4", filho: true })).toThrow();
  });
  // STORY EM CARROSSEL E O MESMO ABSURDO, por outra porta: story nao e item de
  // feed. Sem este caso, a recusa do reels pareceria uma regra sobre video.
  it("story como filho de carrossel tambem e recusado", () => {
    expect(() => parametrosDoContainer({ forma: "story", url: "https://x/a.mp4", filho: true })).toThrow();
  });
  // share_to_feed E audio_name SO valem em reels. Mandados em imagem, a Meta
  // ignora calada — e calado e o que esta base nao aceita.
  it("compartilharNoFeed em imagem nao vira parametro", () => {
    const p = parametrosDoContainer({ forma: "imagem", url: "https://x/a.jpg", compartilharNoFeed: true });
    expect(p.share_to_feed).toBeUndefined();
  });
  it("nomeDoAudio so vale em reels", () => {
    expect(parametrosDoContainer({ forma: "reels", url: "https://x/a.mp4", nomeDoAudio: "trilha" }).audio_name).toBe(
      "trilha"
    );
    expect(
      parametrosDoContainer({ forma: "story", url: "https://x/a.mp4", nomeDoAudio: "trilha" }).audio_name
    ).toBeUndefined();
  });

  // STORY ACEITA IMAGEM E VIDEO, e a Meta pede CHAVES DIFERENTES para cada um
  // (`image_url` contra `video_url`). Mandar a chave errada faz o container
  // nascer errado.
  //
  // QUEM DECIDE E A EXTENSAO DO OBJETO, e ela deixou de ser palpite: quem a
  // grava e `caminhoDoObjeto` (lib/bucket.ts), a partir do `mime` validado. O
  // campo `mime` de `PedidoDeContainer` existiu para este caso e nenhum chamador
  // jamais o passou — estes casos mediam uma saida que a producao nao alcancava.
  it("story de imagem manda image_url; story de video manda video_url", () => {
    const imagem = parametrosDoContainer({ forma: "story", url: "https://x/a.jpg" });
    expect(imagem.image_url).toBe("https://x/a.jpg");
    expect(imagem.video_url).toBeUndefined();
    const video = parametrosDoContainer({ forma: "story", url: "https://x/a.mp4" });
    expect(video.video_url).toBe("https://x/a.mp4");
    expect(video.image_url).toBeUndefined();
  });

  // O CONTAINER PAI DO CARROSSEL NAO NASCE AQUI — ele precisa da lista de
  // filhos, que esta funcao nao recebe. Recusar alto e o que impede um pedido
  // sem `children` de chegar a Meta parecendo um carrossel de zero itens.
  it("a forma carrossel e recusada nesta funcao", () => {
    expect(() => parametrosDoContainer({ forma: "carrossel", url: "https://x/a.jpg" })).toThrow();
  });
});

describe("estadoDoContainer", () => {
  it("os cinco estados da Meta viram os nossos", () => {
    expect(estadoDoContainer("FINISHED")).toBe("pronto");
    expect(estadoDoContainer("IN_PROGRESS")).toBe("esperando");
    expect(estadoDoContainer("ERROR")).toBe("erro");
    expect(estadoDoContainer("EXPIRED")).toBe("vencido");
    expect(estadoDoContainer("PUBLISHED")).toBe("publicado");
  });
  // ESTADO DESCONHECIDO E "erro", E NAO "esperando". Tratar o que nao se
  // conhece como "ainda processando" faria o item girar na fila para sempre,
  // gastando tentativa e nunca terminando — a fome de fila que o lote de 01/09
  // fechou, por outra porta.
  it("estado desconhecido e erro, nunca espera", () => {
    expect(estadoDoContainer("VAI_SABER")).toBe("erro");
    expect(estadoDoContainer(null)).toBe("erro");
    expect(estadoDoContainer(undefined)).toBe("erro");
  });
  // A RESPOSTA DA META CHEGA COMO JSON, e ninguem garante que ela seja string.
  // Um objeto, um numero ou uma lista caindo aqui tem de virar "erro" pela mesma
  // razao do caso acima — e sem estourar, porque quem chama e o dreno.
  it("o que nao e string tambem e erro, sem estourar", () => {
    expect(estadoDoContainer({ status_code: "FINISHED" })).toBe("erro");
    expect(estadoDoContainer(42)).toBe("erro");
    expect(estadoDoContainer([])).toBe("erro");
    expect(estadoDoContainer("")).toBe("erro");
  });
  // A META ESCREVE EM MAIUSCULAS, e este caso registra que a comparacao NAO e
  // frouxa: aceitar "finished" seria inventar um contrato que a Meta nao
  // prometeu. Ele cai no ramo do desconhecido, que e o ramo seguro.
  it("minuscula nao e um dos cinco, e cai no ramo seguro", () => {
    expect(estadoDoContainer("finished")).toBe("erro");
  });
});

describe("problemaDaLegenda", () => {
  it("legenda comum passa", () => {
    expect(problemaDaLegenda("Lancamento hoje #promo @vannuchi.eng")).toBeNull();
  });
  it("acima de 2200 caracteres nao passa", () => {
    expect(problemaDaLegenda("a".repeat(2201))).toBe("longa");
  });
  it("31 hashtags nao passa, 30 passa", () => {
    expect(problemaDaLegenda(Array.from({ length: 30 }, (_, i) => `#t${i}`).join(" "))).toBeNull();
    expect(problemaDaLegenda(Array.from({ length: 31 }, (_, i) => `#t${i}`).join(" "))).toBe(
      "hashtags_demais"
    );
  });
  it("21 mencoes nao passa", () => {
    expect(problemaDaLegenda(Array.from({ length: 21 }, (_, i) => `@u${i}`).join(" "))).toBe(
      "mencoes_demais"
    );
  });
  // A BORDA DE 2200 ENTRA, e ela e a que a tela mostra na contagem: um `>=` no
  // lugar de `>` recusaria a legenda mais comprida que a Meta aceita.
  it("exatamente 2200 caracteres passa", () => {
    expect(problemaDaLegenda("a".repeat(2200))).toBeNull();
  });
  it("legenda vazia passa — publicar sem legenda e permitido", () => {
    expect(problemaDaLegenda("")).toBeNull();
  });
});

// ============================================================
// OS NUMEROS QUE A TAREFA 1 MEDIU CONTRA A META, e nao os que a documentacao
// diz. A pagina da Meta se contradiz (50 num lugar, 100 noutro); estes vieram
// de `GET /{ig-user-id}/content_publishing_limit` em 03/09/2026.
//
// ELES SAO REFERENCIA, E NAO O PORTAO: quem decide se cabe publicar e a
// resposta da Meta no momento (Tarefa 4, passo 4). Uma constante nao sabe que a
// cota ja foi gasta hoje.
// ============================================================
describe("os limites medidos", () => {
  it("a cota medida e 100 publicacoes por 24 horas", () => {
    expect(PUBLICACOES_POR_DIA).toBe(100);
    expect(JANELA_DA_COTA_EM_SEGUNDOS).toBe(86400);
  });
});

// ============================================================
// decisaoDeAssinatura — A DECISAO INTEIRA QUE SAIU DA ROTA
// `app/api/midia/assinar/route.ts`, medida no plantio de 03/09/2026: apagar a
// VALIDACAO inteira de dentro da rota passava por lint, typecheck, os 1.081
// testes puros, os 88 de integracao e a varredura, todos verdes — a rota nao
// tinha rede nenhuma. Esta suite e essa rede: dado um corpo de JSON
// desconhecido e o teto do bucket, o que a rota deve responder.
//
// A rota nao pode ganhar teste de integracao (exige cookie de sessao, e forjar
// cookie e proibido — ver o cabecalho de `testes-integracao/semear-requisicao.ts`),
// entao a unica rede possivel e esta: a decisao virou funcao pura, com caso
// para cada saida, do mesmo jeito que `lib/webhook-messaging.ts` fez para a
// porta do webhook.
// ============================================================
describe("decisaoDeAssinatura", () => {
  // `null` DERRUBAVA a rota antiga: `corpo.forma` em cima de `null` estoura
  // TypeError antes de qualquer checagem. Lista, string e numero NUNCA
  // derrubavam — ler `.forma` de qualquer um deles ja devolve `undefined`, sem
  // estourar — e por isso os quatro caem na MESMA frase que "forma ausente"
  // usa: para quem chama a rota, nenhum deles tem uma forma valida para ler.
  describe("corpo que nao e objeto", () => {
    it.each([
      ["null", null],
      ["lista", ["imagem"]],
      ["string", "imagem"],
      ["numero", 42],
    ])("%s e recusado como forma desconhecida, sem estourar", (_nome, corpo) => {
      const d = decisaoDeAssinatura(corpo, TETO_PAGO);
      expect(d).toEqual({ ok: false, erro: "Forma de publicacao desconhecida", status: 400 });
    });
  });

  describe("forma", () => {
    it("ausente e recusada", () => {
      const d = decisaoDeAssinatura({ mime: "image/jpeg", bytes: MB }, TETO_PAGO);
      expect(d).toEqual({ ok: false, erro: "Forma de publicacao desconhecida", status: 400 });
    });
    it.each(["video", "REELS", ""])("%s desconhecida e recusada", (forma) => {
      const d = decisaoDeAssinatura({ forma, mime: "image/jpeg", bytes: MB }, TETO_PAGO);
      expect(d).toEqual({ ok: false, erro: "Forma de publicacao desconhecida", status: 400 });
    });
  });

  describe("mime e bytes ausentes", () => {
    it("mime ausente e recusado", () => {
      const d = decisaoDeAssinatura({ forma: "imagem", bytes: MB }, TETO_PAGO);
      expect(d).toEqual({ ok: false, erro: "Informe o tipo e o tamanho do arquivo", status: 400 });
    });
    it("mime vazio e recusado", () => {
      const d = decisaoDeAssinatura({ forma: "imagem", mime: "", bytes: MB }, TETO_PAGO);
      expect(d).toEqual({ ok: false, erro: "Informe o tipo e o tamanho do arquivo", status: 400 });
    });
    it("bytes ausente e recusado", () => {
      const d = decisaoDeAssinatura({ forma: "imagem", mime: "image/jpeg" }, TETO_PAGO);
      expect(d).toEqual({ ok: false, erro: "Informe o tipo e o tamanho do arquivo", status: 400 });
    });
  });

  // CADA UM E UM ERRO DIFERENTE DE QUEM CHAMA — string que devia ser numero,
  // numero que nao termina (NaN, Infinity) e numero negativo sao tres jeitos
  // distintos de um corpo mal formado, e cada um precisa do seu caso: um `+`
  // trocado por outro operador na leitura poderia acertar um e errar os
  // outros sem que teste nenhum percebesse.
  describe("bytes que nao e numero valido", () => {
    it.each([
      ["string numerica", "1024"],
      ["NaN", NaN],
      ["Infinity", Infinity],
      ["negativo", -100],
    ])("bytes %s e recusado", (_nome, bytes) => {
      const d = decisaoDeAssinatura({ forma: "imagem", mime: "image/jpeg", bytes }, TETO_PAGO);
      expect(d).toEqual({ ok: false, erro: "Informe o tipo e o tamanho do arquivo", status: 400 });
    });
  });

  // BYTES 0 NAO E "AUSENTE" — `numeroOuNada` (lib/publicacao.ts) preserva essa
  // distincao de proposito, e o comentario dela sempre disse isso. O que a
  // rota ANTIGA nunca fazia era usar a distincao: um corpo com `bytes: 0`
  // tinha um NUMERO valido, passava pelo `bytes === undefined` ileso, e
  // `problemaDoArquivo` nao tem piso minimo — o arquivo de tamanho zero
  // seguia para a assinatura. Estes dois casos prendem os dois lados: o valor
  // ausente e recusado por FALTAR numero, o valor zero e recusado por SER
  // zero, e sao dois `if` diferentes, nao um so.
  describe("arquivo de tamanho zero", () => {
    it("bytes ausente e recusado (falta o numero)", () => {
      const d = decisaoDeAssinatura({ forma: "imagem", mime: "image/jpeg" }, TETO_PAGO);
      expect(d.ok).toBe(false);
    });
    it("bytes: 0 e recusado (o numero diz zero)", () => {
      const d = decisaoDeAssinatura({ forma: "imagem", mime: "image/jpeg", bytes: 0 }, TETO_PAGO);
      expect(d).toEqual({ ok: false, erro: "Informe o tipo e o tamanho do arquivo", status: 400 });
    });
  });

  // CADA SAIDA DE `problemaDoArquivo` CHEGA COMO RECUSA, com a MESMA frase de
  // `textoDoProblema` (a tela e a rota nao podem discordar sobre o que e um
  // "nao") e o `problema` junto, para a tela decidir o que fazer sem parsear
  // string.
  describe("cada problema do arquivo vira recusa com a frase e o problema", () => {
    const casos: Array<[ReturnType<typeof problemaDoArquivo> & string, Record<string, unknown>]> = [
      ["tipo_nao_suportado", { forma: "imagem", mime: "image/png", bytes: MB, largura: 1080, altura: 1080 }],
      ["grande_demais", { forma: "imagem", mime: "image/jpeg", bytes: 9 * MB, largura: 1080, altura: 1080 }],
      ["grande_para_o_bucket", { forma: "reels", mime: "video/mp4", bytes: 80 * MB, segundos: 30 }],
      ["curto_demais", { forma: "reels", mime: "video/mp4", bytes: MB, segundos: 2 }],
      ["longo_demais", { forma: "reels", mime: "video/mp4", bytes: MB, segundos: 16 * 60 }],
      ["proporcao_fora", { forma: "imagem", mime: "image/jpeg", bytes: MB, largura: 700, altura: 1000 }],
      ["estreito_demais", { forma: "imagem", mime: "image/jpeg", bytes: MB, largura: 300, altura: 300 }],
    ];
    it.each(casos)("%s", (problema, corpo) => {
      // grande_para_o_bucket precisa do teto de hoje; os outros usam o do
      // plano pago para nao serem confundidos com o teto do bucket.
      const teto = problema === "grande_para_o_bucket" ? TETO_HOJE : TETO_PAGO;
      const d = decisaoDeAssinatura(corpo, teto);
      expect(d).toEqual({
        ok: false,
        erro: textoDoProblema(problema),
        status: 400,
        problema,
      });
    });
  });

  // O CAMINHO FELIZ DAS QUATRO FORMAS — a decisao devolve o suficiente para a
  // rota assinar: a forma (para o registro), o nome (para o caminho do
  // objeto) e o arquivo declarado (que a rota nao usa mais depois daqui, mas
  // que fecha o tipo com o que `problemaDoArquivo` recebeu).
  describe("caminho feliz", () => {
    it("imagem", () => {
      const d = decisaoDeAssinatura(
        { forma: "imagem", nome: "foto.jpg", mime: "image/jpeg", bytes: 2 * MB, largura: 1080, altura: 1080 },
        TETO_PAGO
      );
      expect(d).toEqual({
        ok: true,
        forma: "imagem",
        nome: "foto.jpg",
        arquivo: { mime: "image/jpeg", bytes: 2 * MB, segundos: undefined, largura: 1080, altura: 1080 },
      });
    });
    it("reels", () => {
      const d = decisaoDeAssinatura(
        { forma: "reels", nome: "video.mp4", mime: "video/mp4", bytes: 10 * MB, segundos: 30 },
        TETO_PAGO
      );
      expect(d).toEqual({
        ok: true,
        forma: "reels",
        nome: "video.mp4",
        arquivo: { mime: "video/mp4", bytes: 10 * MB, segundos: 30, largura: undefined, altura: undefined },
      });
    });
    it("story", () => {
      const d = decisaoDeAssinatura(
        { forma: "story", nome: "story.mp4", mime: "video/mp4", bytes: 10 * MB, segundos: 10 },
        TETO_PAGO
      );
      expect(d).toEqual({
        ok: true,
        forma: "story",
        nome: "story.mp4",
        arquivo: { mime: "video/mp4", bytes: 10 * MB, segundos: 10, largura: undefined, altura: undefined },
      });
    });
    it("carrossel", () => {
      const d = decisaoDeAssinatura(
        { forma: "carrossel", nome: "item1.jpg", mime: "image/jpeg", bytes: 2 * MB, largura: 1080, altura: 1080 },
        TETO_PAGO
      );
      expect(d).toEqual({
        ok: true,
        forma: "carrossel",
        nome: "item1.jpg",
        arquivo: { mime: "image/jpeg", bytes: 2 * MB, segundos: undefined, largura: 1080, altura: 1080 },
      });
    });
  });

  // O TETO DO BUCKET MUDANDO O RESULTADO — o mesmo arquivo, o mesmo corpo, e
  // so o teto muda. Isto e o que prende a razao de `decisaoDeAssinatura`
  // receber o teto como PARAMETRO em vez de ler uma constante: sem isto, o dia
  // em que o plano pago entrar e o teto do bucket subir sozinho (ver
  // `lib/bucket.ts`) nao teria caso nenhum provando que a mudanca chega ate a
  // decisao.
  describe("o teto do bucket muda o resultado", () => {
    it("80 MB e recusado no teto de hoje e aceito no teto do plano pago", () => {
      const corpo = { forma: "reels", nome: "video.mp4", mime: "video/mp4", bytes: 80 * MB, segundos: 30 };
      const recusado = decisaoDeAssinatura(corpo, TETO_HOJE);
      expect(recusado).toEqual({
        ok: false,
        erro: textoDoProblema("grande_para_o_bucket"),
        status: 400,
        problema: "grande_para_o_bucket",
      });
      const aceito = decisaoDeAssinatura(corpo, TETO_PAGO);
      expect(aceito.ok).toBe(true);
    });
  });
});

// =============================================================================
// AS TRÊS DECISÕES QUE A TAREFA 4 TIROU DO DRENO
//
// `lib/queue-drain.ts` é `server-only` e NENHUM teste da suíte pura o executa —
// é o achado que está escrito no cabeçalho dele, e que já custou dois defeitos
// (o pareamento de rótulo com payload e o mapeamento uma linha abaixo, os dois
// com a suíte inteira verde). O ramo da publicação é novo, e a regra vale
// igual: o que ele DECIDE mora aqui, e o que sobra lá é fiação.
//
// As três: ler a resposta do contêiner, ler a cota, e ler o payload de volta.
// =============================================================================

describe("leituraDoContainer", () => {
  it("a resposta comum da Meta vira estado e detalhe", () => {
    expect(leituraDoContainer({ id: "17900", status_code: "FINISHED" })).toEqual({
      estado: "pronto",
      detalhe: null,
    });
  });

  // A FRASE DO `status` É O QUE VAI PARA A TELA DE ENVIOS quando a Meta recusa
  // o conteúdo. Sem ela, o dono lê "a Meta recusou" e não tem o que fazer com
  // isso; com ela, lê que o vídeo tem codec errado. Ela só acompanha o ERRO —
  // a Meta manda `status` em todo estado, e repetir "Finished" no motivo de um
  // post que deu certo seria ruído.
  it("no erro, a frase da Meta acompanha o estado", () => {
    expect(
      leituraDoContainer({
        status_code: "ERROR",
        status: "Error: The video format is not supported",
      })
    ).toEqual({ estado: "erro", detalhe: "Error: The video format is not supported" });
  });

  it("o vencido também carrega a frase, quando ela vem", () => {
    expect(leituraDoContainer({ status_code: "EXPIRED", status: "Expired" })).toEqual({
      estado: "vencido",
      detalhe: "Expired",
    });
  });

  it("processando é espera, e sem detalhe", () => {
    expect(leituraDoContainer({ status_code: "IN_PROGRESS", status: "In progress" })).toEqual({
      estado: "esperando",
      detalhe: null,
    });
  });

  // O MESMO PRINCÍPIO DE `estadoDoContainer`: o que não se conhece é ERRO, e
  // nunca espera. Uma resposta que não é objeto, um corpo vazio, um `null` — a
  // Meta ficando estranha é notícia, não é "ainda processando". Girar na fila
  // para sempre é a fome de fila voltando por outra porta.
  it("resposta que não é objeto vira erro, e nunca espera", () => {
    expect(leituraDoContainer(null).estado).toBe("erro");
    expect(leituraDoContainer(undefined).estado).toBe("erro");
    expect(leituraDoContainer("FINISHED").estado).toBe("erro");
    expect(leituraDoContainer({}).estado).toBe("erro");
    expect(leituraDoContainer({ status_code: "VAI_SABER" }).estado).toBe("erro");
  });

  it("detalhe que não é texto não vira detalhe", () => {
    expect(leituraDoContainer({ status_code: "ERROR", status: { m: 1 } }).detalhe).toBeNull();
  });
});

describe("cotaDePublicacao", () => {
  // A FORMA MEDIDA em 03/09/2026 contra a conta do dono, e não a da documentação.
  it("a resposta medida da Meta é lida inteira", () => {
    expect(
      cotaDePublicacao({
        config: { quota_total: 100, quota_duration: 86400 },
        quota_usage: 7,
      })
    ).toEqual({ usadas: 7, total: 100, janelaEmSegundos: 86400 });
  });

  // A META MANDA NÚMERO COMO TEXTO em vários endpoints, e este produto já
  // tropeçou nisso uma vez (`numeroOuNulo`, lib/steps.ts, nasceu por causa do
  // `code: "230"`). Um "100" lido como não-número faria a cota virar
  // desconhecida e o post esperar por nada.
  it("número que veio como texto continua sendo número", () => {
    expect(
      cotaDePublicacao({
        config: { quota_total: "100", quota_duration: "86400" },
        quota_usage: "0",
      })
    ).toEqual({ usadas: 0, total: 100, janelaEmSegundos: 86400 });
  });

  // `null` É "NÃO DEU PARA SABER", E NÃO "PODE PUBLICAR". Quem chama trata as
  // duas coisas diferente: sem saber a cota, o dreno segue e deixa a Meta
  // recusar — o que não pode é INVENTAR que a cota está livre e depois usar
  // esse palpite como se fosse medição.
  it("resposta que não dá para ler vira null", () => {
    expect(cotaDePublicacao(null)).toBeNull();
    expect(cotaDePublicacao({})).toBeNull();
    expect(cotaDePublicacao({ config: {}, quota_usage: 3 })).toBeNull();
    expect(cotaDePublicacao({ config: { quota_total: 100 } })).toBeNull();
    expect(cotaDePublicacao("100")).toBeNull();
  });

  // QUOTA SEM JANELA CAI NA JANELA MEDIDA, e não em zero: `quota_duration` é o
  // único dos três que tem valor conhecido e estável (86400 em toda medição).
  it("sem quota_duration, a janela é a medida", () => {
    expect(cotaDePublicacao({ config: { quota_total: 100 }, quota_usage: 2 })).toEqual({
      usadas: 2,
      total: 100,
      janelaEmSegundos: JANELA_DA_COTA_EM_SEGUNDOS,
    });
  });

  it("a cota estourada é a que já usou tudo, e a borda entra", () => {
    expect(cotaEstourada({ usadas: 99, total: 100, janelaEmSegundos: 86400 })).toBe(false);
    expect(cotaEstourada({ usadas: 100, total: 100, janelaEmSegundos: 86400 })).toBe(true);
    expect(cotaEstourada({ usadas: 101, total: 100, janelaEmSegundos: 86400 })).toBe(true);
  });

  // NÃO SABER NÃO É ESTAR ESTOURADA. Recusar publicar porque a leitura da cota
  // falhou seria transformar uma indisponibilidade da Meta em post que não sai.
  it("cota desconhecida não é cota estourada", () => {
    expect(cotaEstourada(null)).toBe(false);
  });
});

describe("payloadDaPublicacao e lerPayloadDaPublicacao", () => {
  it("o que se grava é o que se lê de volta", () => {
    const p = payloadDaPublicacao({
      forma: "reels",
      caminhos: ["1780/abc.mp4"],
      legenda: "  oi  ",
      compartilharNoFeed: true,
      nomeDoAudio: "trilha",
    });
    expect(lerPayloadDaPublicacao(p)).toEqual({
      forma: "reels",
      caminhos: ["1780/abc.mp4"],
      legenda: "oi",
      compartilharNoFeed: true,
      nomeDoAudio: "trilha",
      containerId: null,
      // NENHUM FILHO, e a lista vazia é a resposta certa para uma forma que não
      // é carrossel: `filhos` é sempre uma lista, nunca `undefined`, para o
      // dreno não precisar decidir entre "não tem" e "não é carrossel".
      filhos: [],
      consultas: 0,
    });
  });

  it("o que é vazio não vira chave no payload", () => {
    const p = payloadDaPublicacao({ forma: "imagem", caminhos: ["1780/a.jpg"] });
    expect(p.legenda).toBeUndefined();
    expect(p.compartilhar_no_feed).toBeUndefined();
    expect(p.nome_do_audio).toBeUndefined();
    expect(lerPayloadDaPublicacao(p)?.legenda).toBeUndefined();
  });

  // O CONTÊINER GUARDADO É O QUE IMPEDE A SEGUNDA PASSADA DE CRIAR OUTRO.
  // Sem ele, um reels que demora 32 segundos nasceria de novo a cada passada:
  // cinco contêineres para um post, cinco vezes o vídeo baixado pela Meta, e o
  // teto de 400 contêineres por dia gasto por engano.
  it("o contêiner e as consultas voltam do payload", () => {
    const lido = lerPayloadDaPublicacao({
      forma: "imagem",
      caminhos: ["1780/a.jpg"],
      container_id: "17900",
      consultas: 3,
    });
    expect(lido?.containerId).toBe("17900");
    expect(lido?.consultas).toBe(3);
  });

  // A COLUNA É `jsonb` E EDITÁVEL POR FORA DO PAINEL — o mesmo motivo pelo qual
  // `lerPayloadDoLote` (lib/lote.ts) recusa, e pelo qual o dreno defende em vez
  // de confiar em quem enfileirou. `null` aqui vira um item `failed` com motivo
  // escrito, que é um desfecho VISÍVEL; confiar viraria um `POST /media` com
  // `undefined` dentro.
  it("payload que não é de publicação vira null", () => {
    expect(lerPayloadDaPublicacao(null)).toBeNull();
    expect(lerPayloadDaPublicacao({ text: "oi" })).toBeNull();
    expect(lerPayloadDaPublicacao({ forma: "novela", caminhos: ["a"] })).toBeNull();
    expect(lerPayloadDaPublicacao({ forma: "imagem", caminhos: [] })).toBeNull();
    expect(lerPayloadDaPublicacao({ forma: "imagem", caminhos: "1780/a.jpg" })).toBeNull();
    expect(lerPayloadDaPublicacao({ forma: "imagem", caminhos: [1, 2] })).toBeNull();
  });

  it("consultas que não é número conta como zero, e não trava o teto", () => {
    expect(
      lerPayloadDaPublicacao({ forma: "imagem", caminhos: ["a.jpg"], consultas: "muitas" })
        ?.consultas
    ).toBe(0);
  });
});

// =============================================================================
// AS DECISÕES DA TELA DE COMPOR (Tarefa 5)
//
// A tela de publicar é a EXCEÇÃO declarada na especificação (§3): ela tem
// componente de cliente, porque o progresso do upload só existe se o navegador
// for quem envia o arquivo — e ele é, porque a Vercel recusa corpo acima de
// 4,5 MB e um reels vai a 300 MB.
//
// ESTES CASOS SÃO A MITIGAÇÃO INTEIRA DESSA EXCEÇÃO. A suíte não testa
// componente: o que ficar decidido dentro do JSX fica sem rede. Então a
// conversão, a frase de cada estado do envio, a hora do agendamento e a forma
// escolhida decidem-se AQUI, e o componente só desenha o que sai destas
// funções.
// =============================================================================

describe("planoDaConversao", () => {
  // PNG É O FORMATO MAIS COMUM DE QUEM MONTA ARTE, e a Meta só aceita JPEG.
  // Sem conversão, esta é a recusa nº 1 da tela — e ela é evitável no
  // navegador, de graça, antes de qualquer upload.
  it("PNG sempre converte", () => {
    expect(planoDaConversao({ mime: "image/png", largura: 1080, altura: 1080 })).toEqual({
      converter: true,
      largura: 1080,
      altura: 1080,
      qualidade: QUALIDADE_DO_JPEG,
    });
  });

  // JPEG DENTRO DA FAIXA NÃO PASSA PELO CANVAS, e isto é decisão: o `canvas`
  // RE-COMPRIME, e re-comprimir um JPEG que já serve é perda de qualidade sem
  // ganho nenhum. Converter "por via das dúvidas" degradaria toda arte que já
  // chegou certa.
  it("JPEG dentro de 1440px não converte", () => {
    expect(planoDaConversao({ mime: "image/jpeg", largura: 1440, altura: 1440 })).toEqual({
      converter: false,
    });
  });

  // ACIMA DE 1440px CONVERTE ATÉ JPEG, porque aí a conversão não é de formato,
  // é de TAMANHO: são bytes que não precisam subir.
  it("JPEG largo demais é reduzido para 1440, na proporção", () => {
    expect(planoDaConversao({ mime: "image/jpeg", largura: 3000, altura: 2000 })).toEqual({
      converter: true,
      largura: 1440,
      altura: 960,
      qualidade: QUALIDADE_DO_JPEG,
    });
  });

  // VÍDEO NÃO PASSA PELO CANVAS NUNCA. O `canvas` desenha quadro, não vídeo —
  // e um reels de 200 MB "convertido" no navegador seria a aba travada.
  it("vídeo nunca converte", () => {
    expect(planoDaConversao({ mime: "video/mp4" })).toEqual({ converter: false });
    expect(planoDaConversao({ mime: "video/quicktime", largura: 1080, altura: 1920 })).toEqual({
      converter: false,
    });
  });

  // O QUE O CANVAS NÃO SABE DESENHAR NÃO É CONVERTIDO — e `problemaDoArquivo`
  // é quem recusa depois, com a frase que nomeia o formato. Um GIF "convertido"
  // viraria um quadro parado sem ninguém ter pedido isso.
  it("formato que não sabemos converter passa direto para a recusa", () => {
    expect(planoDaConversao({ mime: "image/gif", largura: 800, altura: 800 })).toEqual({
      converter: false,
    });
    expect(planoDaConversao({ mime: "image/svg+xml", largura: 800, altura: 800 })).toEqual({
      converter: false,
    });
  });

  // SEM MEDIDA NÃO HÁ REDIMENSIONAMENTO, mas ainda há conversão de formato: o
  // navegador entrega `naturalWidth: 0` enquanto a imagem não carregou, e
  // cravar zero no `canvas` daria um arquivo de zero pixel.
  it("PNG sem medidas converte sem redimensionar", () => {
    expect(planoDaConversao({ mime: "image/png" })).toEqual({
      converter: true,
      largura: 0,
      altura: 0,
      qualidade: QUALIDADE_DO_JPEG,
    });
  });

  // A ALTURA ACOMPANHA, ARREDONDADA — meio pixel não existe no `canvas`, e um
  // `height` fracionário vira medida truncada com faixa transparente na borda.
  it("a altura é inteira", () => {
    const p = planoDaConversao({ mime: "image/png", largura: 1921, altura: 1000 });
    expect(p).toEqual({ converter: true, largura: 1440, altura: 750, qualidade: QUALIDADE_DO_JPEG });
  });
});

describe("nomeDepoisDaConversao", () => {
  // O NOME VIAJA ATÉ O CAMINHO NO BUCKET: `caminhoDoObjeto` (lib/bucket.ts) lê
  // a EXTENSÃO dele para nomear o objeto, e o que não está na lista vira
  // ".bin". Um PNG convertido que chegasse lá chamando-se "arte.png" viraria um
  // objeto ".bin" — e a URL que a META vai buscar terminaria em ".bin".
  it("a extensão vira jpg", () => {
    expect(nomeDepoisDaConversao("arte final.png")).toBe("arte final.jpg");
    expect(nomeDepoisDaConversao("foto.WEBP")).toBe("foto.jpg");
  });
  it("nome sem extensão ganha uma", () => {
    expect(nomeDepoisDaConversao("arte")).toBe("arte.jpg");
  });
  it("nome vazio não vira só um ponto", () => {
    expect(nomeDepoisDaConversao("")).toBe("imagem.jpg");
    expect(nomeDepoisDaConversao("   ")).toBe("imagem.jpg");
  });
});

describe("porcentagemDoEnvio", () => {
  it("a metade dos bytes é metade da barra", () => {
    expect(porcentagemDoEnvio({ nome: "a.jpg", estado: "enviando", enviados: 50, total: 100 })).toBe(
      50
    );
  });
  // TOTAL ZERO NÃO É NaN. `XMLHttpRequest` dispara `progress` com
  // `lengthComputable: false` — e `0/0` numa largura de CSS é uma barra que
  // some da tela sem ninguém entender por quê.
  it("total zero é zero, e nunca NaN", () => {
    expect(porcentagemDoEnvio({ nome: "a.jpg", estado: "enviando", enviados: 0, total: 0 })).toBe(0);
  });
  // O ESTADO MANDA MAIS QUE OS BYTES: o último `progress` costuma chegar antes
  // do `load`, e uma barra que para em 99% depois de o arquivo estar no bucket
  // é a tela mentindo por arredondamento.
  it("pronto é 100 mesmo com os bytes atrasados", () => {
    expect(porcentagemDoEnvio({ nome: "a.jpg", estado: "pronto", enviados: 99, total: 100 })).toBe(
      100
    );
  });
  // FALHA NÃO ENCHE A BARRA. Ela para onde parou — a barra cheia de um envio
  // que não foi seria a comemoração errada, que é a doença que o conserto de
  // 02/09 curou nas ações.
  it("falha não completa a barra", () => {
    expect(porcentagemDoEnvio({ nome: "a.jpg", estado: "falhou", enviados: 40, total: 100 })).toBe(
      40
    );
  });
  it("mais bytes que o total ainda é 100", () => {
    expect(porcentagemDoEnvio({ nome: "a.jpg", estado: "enviando", enviados: 120, total: 100 })).toBe(
      100
    );
  });
});

describe("fraseDoEnvio", () => {
  it("cada estado tem a sua frase, e nenhuma é vazia", () => {
    const estados = [
      "escolhido",
      "convertendo",
      "assinando",
      "enviando",
      "pronto",
      "recusado",
      "falhou",
    ] as const;
    for (const estado of estados) {
      expect(fraseDoEnvio({ nome: "arte.jpg", estado, enviados: 0, total: 0 }).length).toBeGreaterThan(
        0
      );
    }
  });
  // O MOTIVO ENTRA NA FRASE quando ele existe. "Falhou" sozinho não diz o que
  // fazer, e o motivo é justamente o que `textoDoProblema` já sabe escrever.
  it("o motivo da recusa entra na frase", () => {
    const frase = fraseDoEnvio({
      nome: "arte.png",
      estado: "recusado",
      enviados: 0,
      total: 0,
      detalhe: textoDoProblema("grande_demais"),
    });
    expect(frase).toContain(textoDoProblema("grande_demais"));
  });
  // O NOME DO ARQUIVO APARECE, porque com dois envios em andamento a frase sem
  // nome não diz de qual arquivo ela fala.
  it("a frase nomeia o arquivo", () => {
    expect(fraseDoEnvio({ nome: "reels.mp4", estado: "enviando", enviados: 1, total: 2 })).toContain(
      "reels.mp4"
    );
  });
});

describe("resumoDoProgresso", () => {
  // SEM ENVIO NÃO HÁ MODAL. `null` é o que faz a janelinha do canto não existir
  // na tela de quem não está enviando nada — inclusive nas outras telas, já que
  // ela mora no `app-shell`.
  it("sem envio nenhum não há resumo", () => {
    expect(resumoDoProgresso([])).toBeNull();
  });

  it("um envio em andamento mostra a porcentagem dele", () => {
    const r = resumoDoProgresso([{ nome: "a.jpg", estado: "enviando", enviados: 25, total: 100 }]);
    expect(r?.porcentagem).toBe(25);
    expect(r?.encerrado).toBe(false);
    expect(r?.houveFalha).toBe(false);
  });

  // A PORCENTAGEM DO CONJUNTO É PESADA POR BYTES, e não a média das barras: um
  // reels de 200 MB ao lado de uma capa de 200 KB andaria "50%" assim que a
  // capa terminasse, e ficaria lá por minutos.
  it("a porcentagem do conjunto é pesada pelo tamanho", () => {
    const r = resumoDoProgresso([
      { nome: "capa.jpg", estado: "pronto", enviados: 100, total: 100 },
      { nome: "reels.mp4", estado: "enviando", enviados: 0, total: 900 },
    ]);
    expect(r?.porcentagem).toBe(10);
  });

  it("todos prontos é encerrado, sem falha", () => {
    const r = resumoDoProgresso([{ nome: "a.jpg", estado: "pronto", enviados: 100, total: 100 }]);
    expect(r?.encerrado).toBe(true);
    expect(r?.houveFalha).toBe(false);
    expect(r?.porcentagem).toBe(100);
  });

  // UM ENVIO QUE NÃO FOI NÃO PODE SUMIR DA JANELINHA COMO SE TIVESSE IDO. É a
  // mesma regra de `avisoDoLoteEnviado` (lib/avisos.ts): o desfecho ruim é o
  // que mais precisa aparecer.
  it("falha aparece no resumo, e o conjunto não se diz concluído", () => {
    const r = resumoDoProgresso([
      { nome: "a.jpg", estado: "pronto", enviados: 100, total: 100 },
      { nome: "b.mp4", estado: "falhou", enviados: 10, total: 100, detalhe: "a rede caiu" },
    ]);
    expect(r?.encerrado).toBe(true);
    expect(r?.houveFalha).toBe(true);
    expect(r?.titulo).not.toContain("concluído");
  });

  // ENQUANTO UM ANDA, O CONJUNTO NÃO ESTÁ ENCERRADO — nem que o outro já tenha
  // falhado. Encerrar cedo fecharia a janelinha em cima de um upload vivo.
  it("um envio ainda andando segura o encerramento", () => {
    const r = resumoDoProgresso([
      { nome: "a.jpg", estado: "falhou", enviados: 0, total: 100 },
      { nome: "b.mp4", estado: "enviando", enviados: 50, total: 100 },
    ]);
    expect(r?.encerrado).toBe(false);
    expect(r?.houveFalha).toBe(true);
  });
});

describe("formaQueATelaPublica", () => {
  it("as três formas que já publicam passam", () => {
    expect(formaQueATelaPublica("imagem")).toBe("imagem");
    expect(formaQueATelaPublica("reels")).toBe("reels");
    expect(formaQueATelaPublica("story")).toBe("story");
  });
  // O CARROSSEL PASSOU A PASSAR NA TAREFA 6. Enquanto ele não publicava, esta
  // função o recusava para não gravar um item de fila que o dreno já recusaria
  // — um post que nasce morto, depois de o arquivo ter subido. Agora o dreno
  // sabe montá-lo, e a recusa que sobra é a de QUANTIDADE
  // (`recusaDaQuantidade`), que é outra pergunta.
  it("o carrossel passa, desde a Tarefa 6", () => {
    expect(formaQueATelaPublica("carrossel")).toBe("carrossel");
  });
  it("qualquer outra coisa é null", () => {
    expect(formaQueATelaPublica("")).toBeNull();
    expect(formaQueATelaPublica(null)).toBeNull();
    expect(formaQueATelaPublica(42)).toBeNull();
    expect(formaQueATelaPublica("IMAGEM")).toBeNull();
  });
});

describe("camposDaDataHora", () => {
  it("o que o campo datetime-local manda é lido", () => {
    expect(camposDaDataHora("2026-09-10T14:30")).toEqual({
      ano: 2026,
      mes: 9,
      dia: 10,
      hora: 14,
      minuto: 30,
    });
  });
  // ALGUNS NAVEGADORES MANDAM OS SEGUNDOS. Recusar por causa deles seria um
  // agendamento que não sai, por um formato que o próprio HTML permite.
  it("os segundos, quando vêm, não atrapalham", () => {
    expect(camposDaDataHora("2026-09-10T14:30:00")?.minuto).toBe(30);
  });
  // DIA QUE NÃO EXISTE NÃO VIRA DATA. `Date.UTC(2026, 1, 30)` TRANSBORDA para
  // 2 de março — o mesmo cuidado que `validadeDoDia` (lib/lote.ts) documenta,
  // e aqui ele decide a HORA em que um post aparece no perfil.
  it("data impossível é recusada, e não transborda", () => {
    expect(camposDaDataHora("2026-02-30T10:00")).toBeNull();
    expect(camposDaDataHora("2026-13-01T10:00")).toBeNull();
    expect(camposDaDataHora("2026-09-10T25:00")).toBeNull();
    expect(camposDaDataHora("2026-09-10T10:61")).toBeNull();
  });
  it("o que não é data é null", () => {
    expect(camposDaDataHora("")).toBeNull();
    expect(camposDaDataHora("amanha cedo")).toBeNull();
    expect(camposDaDataHora(null)).toBeNull();
    expect(camposDaDataHora(undefined)).toBeNull();
    expect(camposDaDataHora(20260910)).toBeNull();
  });
});

describe("momentoDaPublicacao", () => {
  const AGORA = Date.parse("2026-09-03T12:00:00Z");

  it("agora é agora, e não leva data", () => {
    expect(momentoDaPublicacao("agora", null, AGORA)).toEqual({ ok: true, quando: null });
  });

  it("depois leva o instante escolhido", () => {
    const daqui = AGORA + 3600_000;
    expect(momentoDaPublicacao("depois", daqui, AGORA)).toEqual({
      ok: true,
      quando: new Date(daqui),
    });
  });

  // O CAMPO ILEGÍVEL NÃO CAI EM "AGORA", E ESTE É O CASO MAIS IMPORTANTE DESTA
  // FUNÇÃO. Publicar AGORA quando a pessoa pediu para agendar é irreversível:
  // `DELETE /{ig-media-id}` NÃO existe no Login do Instagram (medido em 03/09),
  // então o post fica no perfil de 2.933 publicações até alguém apagá-lo pelo
  // celular. Um pedido que não se entende é recusado, nunca adivinhado.
  it("campo que não se entende é recusado, e nunca vira agora", () => {
    expect(momentoDaPublicacao("", null, AGORA)).toEqual({ ok: false, motivo: "quando_ilegivel" });
    expect(momentoDaPublicacao(null, null, AGORA)).toEqual({ ok: false, motivo: "quando_ilegivel" });
    expect(momentoDaPublicacao("talvez", null, AGORA)).toEqual({
      ok: false,
      motivo: "quando_ilegivel",
    });
  });

  it("depois sem data legível é recusado", () => {
    expect(momentoDaPublicacao("depois", null, AGORA)).toEqual({
      ok: false,
      motivo: "data_invalida",
    });
  });

  // DIA PASSADO NÃO É ADIANTAMENTO. `enqueuePublicacao` (lib/engine.ts) trata
  // atraso negativo como zero — ou seja, o post sairia NA HORA. Quem escolheu
  // ontem por engano publicaria agora, no perfil público, sem desfazer.
  it("hora no passado é recusada", () => {
    expect(momentoDaPublicacao("depois", AGORA - 3600_000, AGORA)).toEqual({
      ok: false,
      motivo: "data_no_passado",
    });
  });

  // A TOLERÂNCIA DE UM MINUTO É O CAMPO, E NÃO GENEROSIDADE: o `datetime-local`
  // tem resolução de MINUTO, então quem escolhe "12:00" e confirma às 12:00:30
  // manda um instante 30 segundos no passado. Sem a tolerância, a tela
  // recusaria o pedido mais comum que existe — "publicar neste minuto".
  it("o minuto corrente ainda vale", () => {
    expect(momentoDaPublicacao("depois", AGORA - 30_000, AGORA)).toEqual({
      ok: true,
      quando: new Date(AGORA - 30_000),
    });
  });
});

describe("textoDoProblemaDaLegenda", () => {
  // A TELA E A AÇÃO DIZEM A MESMA COISA. Duas redações do mesmo "não" fazem
  // quem lê achar que são dois problemas — o mesmo motivo pelo qual
  // `decisaoDeAssinatura` usa `textoDoProblema` em vez de escrever a própria.
  it("cada problema tem frase, e ela diz o número", () => {
    expect(textoDoProblemaDaLegenda("longa")).toContain("2.200");
    expect(textoDoProblemaDaLegenda("hashtags_demais")).toContain("30");
    expect(textoDoProblemaDaLegenda("mencoes_demais")).toContain("20");
  });
});

// =============================================================================
// O QUE A AÇÃO DE SERVIDOR DECIDE (Tarefa 5, segundo commit)
//
// Estes casos foram acrescentados DEPOIS dos 38 acima, junto da tela — nenhum
// dos 38 foi tocado. Eles cobrem as funções que nasceram para a ação
// `app/publicar/actions.ts` não decidir nada por conta própria: ela lê o
// formulário, chama estas, e o que sai delas é o que vira aviso ou item de
// fila.
// =============================================================================

describe("caminhosDoCampo", () => {
  const PASTA = "17841400000000000";

  it("o caminho que o enviador escreveu passa", () => {
    expect(caminhosDoCampo(`${PASTA}/abc-123.jpg`, PASTA)).toEqual([`${PASTA}/abc-123.jpg`]);
  });

  it("vários caminhos vêm um por linha, e a ordem é preservada", () => {
    expect(caminhosDoCampo(`${PASTA}/a.jpg\n${PASTA}/b.jpg`, PASTA)).toEqual([
      `${PASTA}/a.jpg`,
      `${PASTA}/b.jpg`,
    ]);
  });

  // O CAMPO É DO USUÁRIO, E ELE ESCOLHE O QUE VAI AO PERFIL PÚBLICO. Um
  // `<input type="hidden">` trocado à mão apontaria para o objeto de OUTRA
  // conta — é o "post da conta A saindo pela conta B" que `alvoDoLote` fecha no
  // envio em lote, aqui pela porta do arquivo. A pasta vem do COOKIE de
  // seleção, nunca do formulário.
  it("caminho de outra conta é descartado", () => {
    expect(caminhosDoCampo("99999999/roubado.jpg", PASTA)).toEqual([]);
    // E nem o prefixo salva: "1784140000000000099" começa com a pasta como
    // TEXTO, mas não é a pasta — a barra é o que separa.
    expect(caminhosDoCampo(`${PASTA}99/x.jpg`, PASTA)).toEqual([]);
  });

  // ESTE TEXTO VIRA PARTE DE UMA URL PÚBLICA QUE A META VAI BUSCAR, e por isso
  // a forma é conferida: "../" sobe de pasta, e barra a mais inventa segmento.
  it("caminho de forma estranha é descartado", () => {
    expect(caminhosDoCampo(`${PASTA}/../outra/x.jpg`, PASTA)).toEqual([]);
    expect(caminhosDoCampo(`${PASTA}/pasta/x.jpg`, PASTA)).toEqual([]);
    expect(caminhosDoCampo(`${PASTA}/sem-extensao`, PASTA)).toEqual([]);
  });

  it("o que não é texto, e a pasta vazia, dão lista vazia", () => {
    expect(caminhosDoCampo(null, PASTA)).toEqual([]);
    expect(caminhosDoCampo(42, PASTA)).toEqual([]);
    expect(caminhosDoCampo("", PASTA)).toEqual([]);
    // PASTA VAZIA NÃO LIBERA TUDO. Sem ela não há a quem conferir, e o `filter`
    // de um prefixo "" deixaria passar caminho de qualquer conta.
    expect(caminhosDoCampo(`${PASTA}/a.jpg`, "")).toEqual([]);
  });
});

describe("fusoDoCampo e instanteDoAgendamento", () => {
  it("o fuso do navegador é lido como número", () => {
    expect(fusoDoCampo("180")).toBe(180);
    expect(fusoDoCampo("-60")).toBe(-60);
    expect(fusoDoCampo("0")).toBe(0);
  });

  // O CAMPO SÓ CHEGA VAZIO NUM NAVEGADOR QUE NÃO RODOU JAVASCRIPT — e nesse
  // navegador o arquivo também não subiu, então a ação já recusou por
  // `sem_arquivo`. O padrão é piso, e não palpite.
  it("campo ausente ou inventado cai no fuso do painel", () => {
    expect(fusoDoCampo(null)).toBe(FUSO_DO_PAINEL_EM_MINUTOS);
    expect(fusoDoCampo("")).toBe(FUSO_DO_PAINEL_EM_MINUTOS);
    expect(fusoDoCampo("amanha")).toBe(FUSO_DO_PAINEL_EM_MINUTOS);
    expect(fusoDoCampo(180)).toBe(FUSO_DO_PAINEL_EM_MINUTOS);
    // Número absurdo jogaria a publicação para outro dia.
    expect(fusoDoCampo("999999")).toBe(FUSO_DO_PAINEL_EM_MINUTOS);
  });

  // A ARMADILHA INTEIRA DO `datetime-local`: ele manda "14:30" e CALA sobre
  // onde são 14:30. Lido no servidor da Vercel, que roda em UTC, esse texto
  // viraria 14:30 UTC — 11:30 em Brasília, TRÊS HORAS antes do que a pessoa
  // marcou. Este par é o que prende a conta.
  it("14:30 em Brasília é 17:30 UTC", () => {
    const campos = camposDaDataHora("2026-09-10T14:30")!;
    expect(instanteDoAgendamento(campos, 180)).toBe(Date.parse("2026-09-10T17:30:00Z"));
  });

  it("o mesmo horário em UTC não desloca nada", () => {
    const campos = camposDaDataHora("2026-09-10T14:30")!;
    expect(instanteDoAgendamento(campos, 0)).toBe(Date.parse("2026-09-10T14:30:00Z"));
  });

  // A VIRADA DO DIA É O CASO QUE UM `-3h` ESCRITO À MÃO ERRA: 23:00 do dia 10
  // em Brasília é 02:00 do dia 11 em UTC.
  it("a virada do dia atravessa certo", () => {
    const campos = camposDaDataHora("2026-09-10T23:00")!;
    expect(instanteDoAgendamento(campos, 180)).toBe(Date.parse("2026-09-11T02:00:00Z"));
  });
});

describe("textoDaRecusaDaPublicacao", () => {
  it("cada motivo tem frase, e nenhuma é vazia", () => {
    const motivos = [
      "sem_conta",
      "sem_arquivo",
      "forma_desconhecida",
      "quando_ilegivel",
      "data_invalida",
      "data_no_passado",
      "ja_enfileirado",
      "um_arquivo_so",
      "carrossel_curto_demais",
      "carrossel_longo_demais",
    ] as const;
    for (const m of motivos) {
      expect(textoDaRecusaDaPublicacao(m).length).toBeGreaterThan(0);
    }
  });

  // AS TRÊS RECUSAS DE HORA SÃO TRÊS CONSELHOS DIFERENTES, e é por isso que
  // `momentoDaPublicacao` devolve três motivos em vez de um "não deu". Se as
  // frases fossem iguais, a distinção que aquela função faz não chegaria a
  // ninguém.
  it("as três recusas de hora não dizem a mesma coisa", () => {
    const frases = new Set([
      textoDaRecusaDaPublicacao("quando_ilegivel"),
      textoDaRecusaDaPublicacao("data_invalida"),
      textoDaRecusaDaPublicacao("data_no_passado"),
    ]);
    expect(frases.size).toBe(3);
  });

  // "JÁ ENFILEIRADO" NÃO É FALHA, E A FRASE TEM DE DIZER ISSO. `enqueue`
  // (lib/engine.ts) devolve `false` quando a `dedupe_key` já existe — o post
  // está na fila, e não perdido. Uma frase que soasse a erro faria alguém subir
  // o arquivo de novo e publicar duas vezes.
  it("a recusa por duplicata diz que nada foi duplicado", () => {
    expect(textoDaRecusaDaPublicacao("ja_enfileirado")).toContain("Nada foi duplicado");
  });
});

describe("tiposQueOCampoAceita", () => {
  // O CAMPO DE IMAGEM ACEITA MAIS DO QUE A META, e é de propósito: PNG e WEBP
  // entram porque `planoDaConversao` os converte para JPEG antes de subir.
  // Bloqueá-los no seletor recusaria o formato mais comum de quem monta arte,
  // num caso em que o produto sabe resolver sozinho.
  it("imagem oferece o que a conversão sabe resolver", () => {
    const aceita = tiposQueOCampoAceita("imagem");
    expect(aceita).toContain("image/jpeg");
    expect(aceita).toContain("image/png");
    expect(aceita).not.toContain("video/");
  });
  it("reels oferece só vídeo", () => {
    const aceita = tiposQueOCampoAceita("reels");
    expect(aceita).toContain("video/mp4");
    expect(aceita).not.toContain("image/");
  });
  it("story oferece as duas mídias", () => {
    const aceita = tiposQueOCampoAceita("story");
    expect(aceita).toContain("image/jpeg");
    expect(aceita).toContain("video/mp4");
  });
  // O QUE ESTA FUNÇÃO NÃO É: barreira. O `accept` é sugestão do seletor, e
  // quem escolher "todos os arquivos" passa por cima dele — quem recusa é
  // `problemaDoArquivo`, no navegador e de novo no servidor. Este caso existe
  // para o nome não prometer o que a função não faz: AVI não está na lista, e
  // isso não impede ninguém de escolher um.
  it("o que ela oferece não é o que ela recusa", () => {
    expect(tiposQueOCampoAceita("reels")).not.toContain("video/x-msvideo");
    expect(problemaDoArquivo("reels", { mime: "video/x-msvideo", bytes: MB, segundos: 10 }, TETO_PAGO)).toBe(
      "tipo_nao_suportado"
    );
  });
});

// =============================================================================
// O CARROSSEL (Tarefa 6)
//
// AS REGRAS DA META, lidas na referencia do endpoint em 03/09/2026:
//
//   - `media_type=CAROUSEL` no PAI, e `children` e a lista de ate 10
//     identificadores de container.
//   - os FILHOS levam `is_carousel_item=true` e NAO levam legenda: ela mora no
//     pai.
//   - reels NAO entra em carrossel (video em carrossel e video comum).
//   - todos os itens sao cortados pela proporcao do PRIMEIRO — por isso a ordem
//     importa, e por isso ela e editavel na tela.
//   - carrossel nao aceita marcacao de localizacao.
//   - carrossel conta como UMA publicacao no limite de 100/24h.
// =============================================================================

describe("parametrosDoContainerPai", () => {
  const dez = Array.from({ length: 10 }, (_, i) => `container-${i + 1}`);

  it("o pai leva CAROUSEL, a lista de filhos e a legenda", () => {
    const p = parametrosDoContainerPai({ filhos: ["a", "b", "c"], legenda: "oi" });
    expect(p.media_type).toBe("CAROUSEL");
    expect(p.children).toBe("a,b,c");
    // A LEGENDA MORA NO PAI. E o outro lado do caso do filho que nao a leva —
    // sem este par, mover a legenda de lugar nao acusaria em teste nenhum.
    expect(p.caption).toBe("oi");
  });

  // A ORDEM E CONTEUDO, E NAO ARRUMACAO: todos os itens sao cortados pela
  // proporcao do PRIMEIRO. Uma lista reordenada no caminho publica um post
  // enquadrado por outro arquivo.
  it("a ordem escolhida atravessa intacta", () => {
    expect(parametrosDoContainerPai({ filhos: ["c", "a", "b"] }).children).toBe("c,a,b");
  });

  it("dez itens entram", () => {
    expect(parametrosDoContainerPai({ filhos: dez }).children.split(",").length).toBe(10);
  });

  // ONZE E RECUSADO ALTO, e nao mandado para a Meta recusar: chegar ate aqui
  // com onze quer dizer que onze arquivos ja subiram ao bucket e onze
  // containers ja nasceram. O erro tem de aparecer antes disso.
  it("onze itens sao recusados", () => {
    expect(() => parametrosDoContainerPai({ filhos: [...dez, "container-11"] })).toThrow();
  });

  // ZERO E UM NAO SAO CARROSSEL. Zero e o caso que a Tarefa 2 nomeou ao
  // declarar que o pai precisa de funcao propria (`parametrosDoContainer`
  // montaria um pedido sem `children`); um e um post comum, e publicar um
  // carrossel de um item so entrega uma peca com seta de deslizar que nao
  // desliza.
  it("carrossel de zero e de um item sao recusados", () => {
    expect(() => parametrosDoContainerPai({ filhos: [] })).toThrow();
    expect(() => parametrosDoContainerPai({ filhos: ["a"] })).toThrow();
  });

  it("a legenda vazia nao vira caption", () => {
    expect(parametrosDoContainerPai({ filhos: ["a", "b"], legenda: "   " }).caption).toBeUndefined();
    expect(parametrosDoContainerPai({ filhos: ["a", "b"] }).caption).toBeUndefined();
  });

  // O QUE O PAI NAO TEM, dito como teste porque o esquecimento aqui e mudo: a
  // Meta IGNORA parametro que nao vale para a forma, sem dizer nada, e o post
  // sai diferente do que a tela prometeu. `share_to_feed` e `audio_name` sao de
  // reels, e reels nao entra em carrossel; localizacao o carrossel nao aceita.
  it("o pai nao leva nada de reels, nem localizacao, nem URL de midia", () => {
    const p = parametrosDoContainerPai({ filhos: ["a", "b"], legenda: "oi" });
    expect(p.share_to_feed).toBeUndefined();
    expect(p.audio_name).toBeUndefined();
    expect(p.location_id).toBeUndefined();
    expect(p.image_url).toBeUndefined();
    expect(p.video_url).toBeUndefined();
    expect(p.is_carousel_item).toBeUndefined();
  });
});

describe("parametrosDoContainer — os filhos do carrossel", () => {
  // O FILHO NASCE COM `forma: "carrossel"` E `filho: true`. A forma diz de que
  // post ele e item; a midia dele decide a CHAVE da URL, como no story.
  it("filho de imagem leva image_url, is_carousel_item, e nenhuma legenda", () => {
    const p = parametrosDoContainer({
      forma: "carrossel",
      url: "https://x/a.jpg",
      legenda: "esta legenda e do pai",
      filho: true,
    });
    expect(p.image_url).toBe("https://x/a.jpg");
    expect(p.is_carousel_item).toBe("true");
    expect(p.caption).toBeUndefined();
    expect(p.media_type).toBeUndefined();
  });

  // VIDEO EM CARROSSEL E VIDEO COMUM: sem `share_to_feed`, sem `audio_name`,
  // sem capa — e sem `media_type`, porque a referencia do endpoint lista
  // CAROUSEL, REELS e STORIES e mais nada (ver a especificacao).
  it("filho de video leva video_url e nenhum media_type", () => {
    const p = parametrosDoContainer({
      forma: "carrossel",
      url: "https://x/a.mp4",
      filho: true,
      compartilharNoFeed: true,
      nomeDoAudio: "trilha",
    });
    expect(p.video_url).toBe("https://x/a.mp4");
    expect(p.media_type).toBeUndefined();
    expect(p.share_to_feed).toBeUndefined();
    expect(p.audio_name).toBeUndefined();
  });

  // A EXTENSAO DECIDE, e ela e o UNICO caminho: o dreno monta o filho a partir
  // do CAMINHO no bucket, e o payload nao guarda o tipo do arquivo. E por isso
  // que a extensao gravada tem de ser verdadeira — ver `caminhoDoObjeto`.
  it("a extensao do caminho decide a chave", () => {
    expect(
      parametrosDoContainer({ forma: "carrossel", url: "https://x/a.mp4", filho: true }).video_url
    ).toBe("https://x/a.mp4");
    expect(
      parametrosDoContainer({ forma: "carrossel", url: "https://x/a.jpg", filho: true }).image_url
    ).toBe("https://x/a.jpg");
  });

  // O PAI CONTINUA RECUSADO NESTA FUNCAO, e o caso da Tarefa 2 segue de pe: sem
  // `filho: true`, `forma: "carrossel"` e um pedido de PAI, e o pai precisa da
  // lista de filhos que esta funcao nao recebe.
  it("carrossel sem filho continua sendo recusado aqui", () => {
    expect(() => parametrosDoContainer({ forma: "carrossel", url: "https://x/a.jpg" })).toThrow();
  });
});

describe("recusaDaQuantidade", () => {
  it("nenhum arquivo e sempre sem_arquivo", () => {
    expect(recusaDaQuantidade("imagem", 0)).toBe("sem_arquivo");
    expect(recusaDaQuantidade("carrossel", 0)).toBe("sem_arquivo");
  });

  it("as tres formas de um arquivo so publicam um arquivo so", () => {
    expect(recusaDaQuantidade("imagem", 1)).toBeNull();
    expect(recusaDaQuantidade("reels", 1)).toBeNull();
    expect(recusaDaQuantidade("story", 1)).toBeNull();
    // O DRENO PUBLICA `caminhos[0]` E DESCARTA O RESTO, calado. Dois arquivos
    // numa forma de um so nao e um detalhe de tela: e um arquivo que subiu, que
    // fica no bucket, e que a pessoa acha que publicou.
    expect(recusaDaQuantidade("imagem", 2)).toBe("um_arquivo_so");
  });

  it("o carrossel vai de dois a dez", () => {
    expect(recusaDaQuantidade("carrossel", 1)).toBe("carrossel_curto_demais");
    expect(recusaDaQuantidade("carrossel", 2)).toBeNull();
    expect(recusaDaQuantidade("carrossel", 10)).toBeNull();
    expect(recusaDaQuantidade("carrossel", 11)).toBe("carrossel_longo_demais");
  });

  it("cada recusa de quantidade tem a sua frase, e elas nao se repetem", () => {
    const frases = new Set([
      textoDaRecusaDaPublicacao("um_arquivo_so"),
      textoDaRecusaDaPublicacao("carrossel_curto_demais"),
      textoDaRecusaDaPublicacao("carrossel_longo_demais"),
    ]);
    expect(frases.size).toBe(3);
    for (const f of frases) expect(f.length).toBeGreaterThan(10);
  });
});

describe("moverNaOrdem", () => {
  it("para cima e para baixo", () => {
    expect(moverNaOrdem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(moverNaOrdem(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
  });

  // FORA DA FAIXA DEVOLVE A MESMA LISTA, e a MESMA por identidade: quem desenha
  // a lista compara por identidade, e uma copia devolvida a cada clique no
  // botao de subir do PRIMEIRO item seria um render por clique que nao muda
  // nada.
  it("fora da faixa devolve a mesma lista, sem copia", () => {
    const lista = ["a", "b", "c"];
    expect(moverNaOrdem(lista, 0, -1)).toBe(lista);
    expect(moverNaOrdem(lista, 2, 3)).toBe(lista);
    expect(moverNaOrdem(lista, -1, 0)).toBe(lista);
    expect(moverNaOrdem(lista, 9, 0)).toBe(lista);
    expect(moverNaOrdem(lista, 1, 1)).toBe(lista);
  });

  it("nao mexe na lista original", () => {
    const lista = ["a", "b", "c"];
    moverNaOrdem(lista, 0, 2);
    expect(lista).toEqual(["a", "b", "c"]);
  });
});

describe("rotuloDoEnvio", () => {
  // A POSICAO ENTRA NO ROTULO QUANDO HA MAIS DE UM ARQUIVO, e ela nao e
  // enfeite: no carrossel a ordem decide o enquadramento de todos, e a
  // janelinha e o unico lugar onde os arquivos aparecem enquanto sobem. Ela
  // tambem e o que separa dois arquivos de MESMO NOME, que a janelinha
  // identifica pelo rotulo.
  it("um arquivo so nao ganha posicao", () => {
    expect(rotuloDoEnvio("arte.jpg", 0, 1)).toBe("arte.jpg");
  });
  it("com mais de um, o rotulo diz a posicao", () => {
    expect(rotuloDoEnvio("arte.jpg", 0, 3)).toBe("1/3 arte.jpg");
    expect(rotuloDoEnvio("arte.jpg", 2, 3)).toBe("3/3 arte.jpg");
  });
});

describe("payloadDaPublicacao — os filhos que ja nasceram", () => {
  // A MEDICAO QUE OBRIGOU ESTA CHAVE (Tarefa 6, medida no codigo da Tarefa 4):
  // um filho que falha por 5xx devolve o item a fila (`retryInSeconds: 120`,
  // lib/queue-drain.ts), e o container da Meta VENCE EM 24 HORAS. Entre a falha
  // e a passada seguinte passam dois minutos — os filhos que ja nasceram
  // continuam validos por muito tempo. Recria-los seria baixar a midia de novo
  // e gastar o teto de 400 containers por dia por engano.
  it("os filhos voltam do payload, na ordem", () => {
    const lido = lerPayloadDaPublicacao({
      forma: "carrossel",
      caminhos: ["a/1.jpg", "a/2.jpg", "a/3.jpg"],
      filhos: ["c1", "c2"],
    });
    expect(lido?.filhos).toEqual(["c1", "c2"]);
  });

  it("payload sem filhos devolve lista vazia, e nunca undefined", () => {
    const lido = lerPayloadDaPublicacao({ forma: "carrossel", caminhos: ["a/1.jpg", "a/2.jpg"] });
    expect(lido?.filhos).toEqual([]);
  });

  // FILHO QUE NAO E TEXTO CONTA COMO NENHUM. A coluna e `jsonb` e editavel por
  // fora do painel: uma lista com um buraco no meio desalinharia os filhos dos
  // caminhos, e o carrossel sairia com a peca errada na posicao errada.
  // Recomecar do zero custa containers; publicar embaralhado custa o perfil.
  it("lista com qualquer coisa que nao seja texto conta como nenhum filho", () => {
    for (const filhos of [["c1", 2], "c1", [null], [""], {}]) {
      expect(
        lerPayloadDaPublicacao({ forma: "carrossel", caminhos: ["a/1.jpg", "a/2.jpg"], filhos })
          ?.filhos
      ).toEqual([]);
    }
  });
});
