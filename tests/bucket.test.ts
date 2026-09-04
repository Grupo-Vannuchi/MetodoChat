import { describe, it, expect } from "vitest";

// O QUE ESTE ARQUIVO PROTEGE são as DUAS funções puras de `lib/bucket.ts` — o
// nome do objeto no bucket e o endereço público dele. As outras três
// (`urlAssinadaDeUpload`, `apagarObjeto`, `tetoDoBucket`) falam com o Supabase
// pela rede e NÃO têm teste puro; fingir cobertura para elas aqui seria pior do
// que não ter nenhuma, porque esconderia onde a rede realmente acaba.
//
// AS DUAS QUE ESTÃO AQUI CARREGAM DUAS REGRAS QUE NÃO SÃO ESTÉTICA:
//
//   1. O CAMINHO LEVA A CONTA. O bucket é um só para as quatro contas, e dois
//      donos que subissem "foto.jpg" no mesmo instante escreveriam um por cima
//      do outro. A conta na frente do caminho é o que torna a colisão
//      impossível — e é a mesma razão pela qual `alvoDoLote` existe no envio.
//
//   2. O CAMINHO NÃO LEVA O NOME CRU. Nome de arquivo é texto de gente: tem
//      acento, espaço, aspas, e pode ter "../". Ele vira parte de uma URL que
//      a META vai buscar — e um caractere que o Supabase aceita mas a Meta não
//      resolve viraria uma publicação que falha depois de 200 MB enviados.
//
// A EXTENSÃO SOBREVIVE, e isso é decisão e não descuido: a Tarefa 4 monta o
// pedido da Meta a partir da URL guardada no payload, e `pareceVideo`
// (lib/publicacao.ts) escolhe entre `image_url` e `video_url` por ela. Um
// caminho sem extensão faria todo vídeo virar imagem.
//
//   3. E POR ISSO A EXTENSÃO SAI DO `mime`, e não do nome do arquivo. Foi
//      MEDIDO que um MP4 chamado "clipe" (ou "clipe.mpeg") passa inteiro por
//      `problemaDoArquivo` — ela olha o `mime`, nunca o nome — e virava `.bin`
//      no bucket, e daí um story de vídeo saía com `image_url` para a Meta
//      recusar depois do upload inteiro. O `mime` já vem validado por
//      `decisaoDeAssinatura`, e é a única coisa neste caminho que sabe o que o
//      arquivo é.

process.env.SUPABASE_URL = "https://exemplo.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "chave-de-teste-que-nao-e-usada-aqui";
process.env.SUPABASE_BUCKET = "MetodoChat";

const { caminhoDoObjeto, urlPublicaDoObjeto, pastaDaConta } = await import("@/lib/bucket");

const CONTA_A = "17841400000000001";
const CONTA_B = "17841400000000002";

describe("caminhoDoObjeto", () => {
  it("leva a conta na frente, e dois donos nao colidem", () => {
    const a = caminhoDoObjeto(CONTA_A, "foto.jpg", "id-fixo");
    const b = caminhoDoObjeto(CONTA_B, "foto.jpg", "id-fixo");
    expect(a.startsWith(`${CONTA_A}/`)).toBe(true);
    expect(b.startsWith(`${CONTA_B}/`)).toBe(true);
    expect(a).not.toBe(b);
  });

  it("nao leva o nome cru do arquivo", () => {
    const c = caminhoDoObjeto(CONTA_A, "Minha Arte de Férias (final).JPG", "id-fixo");
    expect(c).toBe(`${CONTA_A}/id-fixo.jpg`);
  });

  // "../" NUM NOME DE ARQUIVO É O CASO QUE NÃO PODE PASSAR: o caminho vira
  // parte da URL do objeto, e um salto de diretório escreveria fora da pasta
  // da conta — que é justamente a separação que a regra 1 existe para manter.
  it("nome com barra e ponto-ponto nao escapa da pasta da conta", () => {
    const c = caminhoDoObjeto(CONTA_A, "../../outra-conta/segredo.jpg", "id-fixo");
    expect(c).toBe(`${CONTA_A}/id-fixo.jpg`);
    expect(c.split("/")).toHaveLength(2);
  });

  it("a extensao sobrevive, em minusculas, para video e imagem", () => {
    expect(caminhoDoObjeto(CONTA_A, "reels.MP4", "x")).toBe(`${CONTA_A}/x.mp4`);
    expect(caminhoDoObjeto(CONTA_A, "clipe.mov", "x")).toBe(`${CONTA_A}/x.mov`);
    expect(caminhoDoObjeto(CONTA_A, "arte.jpeg", "x")).toBe(`${CONTA_A}/x.jpeg`);
  });

  // Extensão que não conhecemos não vira caminho: ".php", ".svg" ou nada.
  it("extensao desconhecida ou ausente vira bin", () => {
    expect(caminhoDoObjeto(CONTA_A, "arquivo.svg", "x")).toBe(`${CONTA_A}/x.bin`);
    expect(caminhoDoObjeto(CONTA_A, "sem-extensao", "x")).toBe(`${CONTA_A}/x.bin`);
  });

  it("sem identificador dado, dois pedidos seguidos nao colidem", () => {
    expect(caminhoDoObjeto(CONTA_A, "foto.jpg")).not.toBe(caminhoDoObjeto(CONTA_A, "foto.jpg"));
  });

  // O DEFEITO MEDIDO, e o que o conserto fecha. `problemaDoArquivo` olha o
  // `mime` e NUNCA o nome, entao um MP4 chamado "clipe" passa pela porta
  // inteira; sem esta regra ele virava `<conta>/<id>.bin`, e o story dele saia
  // com `image_url`.
  it("o mime manda mais que o nome: video sem extensao nao vira bin", () => {
    expect(caminhoDoObjeto(CONTA_A, "clipe", "x", "video/mp4")).toBe(`${CONTA_A}/x.mp4`);
    expect(caminhoDoObjeto(CONTA_A, "clipe.mpeg", "x", "video/quicktime")).toBe(`${CONTA_A}/x.mov`);
    expect(caminhoDoObjeto(CONTA_A, "arte", "x", "image/jpeg")).toBe(`${CONTA_A}/x.jpg`);
  });

  it("o mime ganha do nome quando os dois discordam", () => {
    // Quem diz a verdade sobre o arquivo e o `mime`, e e ele que
    // `decisaoDeAssinatura` validou. O nome e texto de gente.
    expect(caminhoDoObjeto(CONTA_A, "arte.jpg", "x", "video/mp4")).toBe(`${CONTA_A}/x.mp4`);
  });

  it("mime que nao esta na lista deixa o nome decidir, como sempre foi", () => {
    expect(caminhoDoObjeto(CONTA_A, "arte.jpg", "x", "image/png")).toBe(`${CONTA_A}/x.jpg`);
    expect(caminhoDoObjeto(CONTA_A, "arquivo.svg", "x", "image/svg+xml")).toBe(`${CONTA_A}/x.bin`);
  });
});

// ---------------------------------------------------------------------------

// AS DUAS PONTAS DO MESMO CAMINHO, no mesmo caso: quem ESCREVE a extensao e
// `caminhoDoObjeto`, quem a LE e `parametrosDoContainer`. Elas moram em arquivos
// diferentes e nada as obrigava a concordar -- e era exatamente ai que o defeito
// vivia, porque cada uma sozinha estava "certa".
describe("a extensao gravada e a chave que a Meta recebe", () => {
  it("um MP4 chamado 'clipe' vira story de VIDEO, e nao de imagem", async () => {
    const { parametrosDoContainer } = await import("@/lib/publicacao");
    const caminho = caminhoDoObjeto(CONTA_A, "clipe", "x", "video/mp4");
    const p = parametrosDoContainer({ forma: "story", url: `https://exemplo/${caminho}` });
    expect(p.video_url).toBe(`https://exemplo/${caminho}`);
    expect(p.image_url).toBeUndefined();
  });

  it("um JPEG chamado 'arte' vira filho de carrossel de IMAGEM", async () => {
    const { parametrosDoContainer } = await import("@/lib/publicacao");
    const caminho = caminhoDoObjeto(CONTA_A, "arte", "x", "image/jpeg");
    const p = parametrosDoContainer({
      forma: "carrossel",
      filho: true,
      url: `https://exemplo/${caminho}`,
    });
    expect(p.image_url).toBe(`https://exemplo/${caminho}`);
    expect(p.video_url).toBeUndefined();
  });
});

// MEDIDO NO PLANTIO DE 04/09/2026, e por isso este bloco existe: apagar a
// higienizacao da CONTA (`contaIgId.replace(...)`) passava por lint, typecheck e
// pelos 1.191 testes puros sem uma linha vermelha. Os casos acima cobrem o NOME
// do arquivo, que e texto de gente — mas nenhum cobria a CONTA, que e o
// primeiro segmento do caminho, e o unico que separa um dono do outro.
//
// A conta e numerica hoje, e por isso o buraco nao tinha sintoma. O dia em que
// ela deixar de ser nao pode ser o dia em que alguem escreve fora da propria
// pasta — e agora esse dia fica vermelho aqui, e nao em producao.
//
// A funcao e exportada porque ha DOIS lados do mesmo caminho: `caminhoDoObjeto`
// a usa para ESCREVER, e a acao de publicar (app/publicar/actions.ts) a usa
// para CONFERIR que o caminho vindo do formulario esta dentro da pasta da conta
// do cookie. Duas versoes desta higienizacao seriam duas regras para manter
// iguais, e elas divergem.
describe("pastaDaConta", () => {
  it("a conta comum atravessa inteira", () => {
    expect(pastaDaConta(CONTA_A)).toBe(CONTA_A);
  });

  // O SALTO DE DIRETORIO PELA CONTA e o mesmo defeito que o caso do NOME ja
  // prendia, pela outra metade do caminho.
  it("barra e ponto-ponto na conta nao viram pasta", () => {
    expect(pastaDaConta("../outra")).toBe("outra");
    // O PONTO TAMBEM SOME: ele nao esta em [A-Za-z0-9_-]. Medido — a primeira
    // versao deste caso esperava "conta..etc", e a funcao e mais estrita do que
    // isso.
    expect(pastaDaConta("conta/../../etc")).toBe("contaetc");
    expect(pastaDaConta("a/b")).toBe("ab");
  });

  it("o que precisaria ser escapado numa URL some", () => {
    expect(pastaDaConta("conta com espaco")).toBe("contacomespaco");
    expect(pastaDaConta("conta?x=1#y")).toBe("contax1y");
    expect(pastaDaConta("cont@")).toBe("cont");
  });

  // `caminhoDoObjeto` USA ESTA FUNCAO, e nao a propria copia. O caso prende os
  // dois lados juntos: se alguem reescrever a higienizacao dentro de
  // `caminhoDoObjeto`, as duas deixam de concordar e isto fica vermelho.
  it("e a mesma pasta que caminhoDoObjeto escreve", () => {
    expect(caminhoDoObjeto("../outra", "foto.jpg", "x")).toBe(`${pastaDaConta("../outra")}/x.jpg`);
  });
});

describe("urlPublicaDoObjeto", () => {
  // MEDIDO em 03/09/2026 contra o projeto real: este endereço responde HTTP 200
  // SEM autenticação nenhuma, que é exatamente o que a Meta exige para baixar a
  // mídia. Qualquer forma diferente desta é uma URL que a Meta não consegue ler.
  it("monta o endereco publico medido, uma vez so", () => {
    const u = urlPublicaDoObjeto(`${CONTA_A}/id-fixo.jpg`);
    expect(u).toBe(
      `https://exemplo.supabase.co/storage/v1/object/public/MetodoChat/${CONTA_A}/id-fixo.jpg`
    );
    expect(u.match(/\/object\/public\//g)).toHaveLength(1);
  });

  // O NOME DO BUCKET TEM MAIÚSCULAS, é escolha do dono e não pode ser alterado
  // depois de criado. Normalizar aqui daria 404 em tudo.
  it("preserva as maiusculas do nome do bucket", () => {
    expect(urlPublicaDoObjeto("a/b.jpg")).toContain("/MetodoChat/");
  });

  it("nao leva token nem chave nenhuma", () => {
    const u = urlPublicaDoObjeto(`${CONTA_A}/id-fixo.jpg`);
    expect(u).not.toContain("?");
    expect(u).not.toContain(process.env.SUPABASE_SERVICE_ROLE_KEY!);
  });

  it("barra sobrando no SUPABASE_URL nao dobra na URL", () => {
    const antes = process.env.SUPABASE_URL;
    process.env.SUPABASE_URL = "https://exemplo.supabase.co/";
    try {
      expect(urlPublicaDoObjeto("a/b.jpg")).toBe(
        "https://exemplo.supabase.co/storage/v1/object/public/MetodoChat/a/b.jpg"
      );
    } finally {
      process.env.SUPABASE_URL = antes;
    }
  });
});

// A MENSAGEM DE VARIÁVEL FALTANDO É TESTE DE SEGURANÇA, e não de conveniência:
// ela tem de dizer QUAL falta e não pode mostrar valor de nenhuma. Uma mensagem
// de erro é a coisa mais copiada e colada que existe — vai para o log da
// Vercel, para o print no WhatsApp e para o chat.
describe("variavel faltando", () => {
  it("nomeia a variavel e nao mostra valor nenhum", () => {
    const antes = process.env.SUPABASE_URL;
    delete process.env.SUPABASE_URL;
    try {
      expect(() => urlPublicaDoObjeto("a/b.jpg")).toThrow(/SUPABASE_URL/);
      expect(() => urlPublicaDoObjeto("a/b.jpg")).not.toThrow(
        new RegExp(process.env.SUPABASE_SERVICE_ROLE_KEY!)
      );
    } finally {
      process.env.SUPABASE_URL = antes;
    }
  });

  it("o bucket faltando tambem e nomeado", () => {
    const antes = process.env.SUPABASE_BUCKET;
    delete process.env.SUPABASE_BUCKET;
    try {
      expect(() => urlPublicaDoObjeto("a/b.jpg")).toThrow(/SUPABASE_BUCKET/);
    } finally {
      process.env.SUPABASE_BUCKET = antes;
    }
  });
});
