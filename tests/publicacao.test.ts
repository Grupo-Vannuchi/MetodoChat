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
  // nascer errado — por isso o `mime` decide, e a extensao da URL e so o
  // recurso de ultimo caso.
  it("story de imagem manda image_url; story de video manda video_url", () => {
    expect(
      parametrosDoContainer({ forma: "story", url: "https://x/a.jpg", mime: "image/jpeg" }).image_url
    ).toBe("https://x/a.jpg");
    expect(
      parametrosDoContainer({ forma: "story", url: "https://x/a.mp4", mime: "video/mp4" }).video_url
    ).toBe("https://x/a.mp4");
  });
  it("sem mime, a extensao da URL decide o story", () => {
    const p = parametrosDoContainer({ forma: "story", url: "https://x/a.mp4" });
    expect(p.video_url).toBe("https://x/a.mp4");
    expect(p.image_url).toBeUndefined();
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
