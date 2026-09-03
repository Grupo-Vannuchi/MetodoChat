import { describe, it, expect } from "vitest";
import {
  problemaDoArquivo,
  textoDoProblema,
  parametrosDoContainer,
  estadoDoContainer,
  problemaDaLegenda,
  PUBLICACOES_POR_DIA,
  JANELA_DA_COTA_EM_SEGUNDOS,
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
