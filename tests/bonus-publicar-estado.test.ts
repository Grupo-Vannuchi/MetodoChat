import { describe, expect, it } from "vitest";
import { fmtDate } from "@/lib/format";
import {
  ESPERA_DA_RESERVA_MS,
  estadoDaPublicacao,
  faltasParaPublicar,
  publicacaoLivre,
  type EstadoDaPublicacao,
  type LinhaDaFila,
} from "@/lib/bonus/publicar-estado";
import type { PublicacaoGuardada } from "@/lib/bonus/publicar-regras";
import {
  listaDeSlides,
  textoDaFalta,
  textoDaRecusaDaPublicacaoDoCarrossel,
  textoDaTrava,
  textoDoCalendario,
  textoDoEstadoDaPublicacao,
  textoDoProblemaDaFoto,
  tomDoEstadoDaPublicacao,
  type RecusaDaPublicacaoDoCarrossel,
} from "@/lib/bonus/publicar-textos";

// O ESTADO DA PUBLICAÇÃO E A TRAVA (spec da Etapa 5, "O estado da publicação" e "A trava no
// servidor"). A trava se escreve pelo que LIBERA, e todo o resto trava: um estado novo da fila trava
// sozinho.

const AGORA = new Date("2026-10-05T15:00:00Z");
const antes = (ms: number) => new Date(AGORA.getTime() - ms);
const depois = (ms: number) => new Date(AGORA.getTime() + ms);

const reserva = (p: Partial<PublicacaoGuardada> = {}): PublicacaoGuardada => ({
  chave: "pub:178:carrossel:a,b",
  caminhos: ["a", "b"],
  reservadaEm: antes(1_000),
  enfileiradaEm: antes(900),
  ...p,
});
const linha = (p: Partial<LinhaDaFila> = {}): LinhaDaFila => ({
  id: "fila-1",
  status: "pending",
  not_before: depois(3_600_000),
  sent_at: null,
  error: null,
  ...p,
});

describe("o estado da publicação, lido da fila", () => {
  it("sem publicação, o carrossel está livre", () => {
    expect(estadoDaPublicacao(null, null, AGORA)).toEqual({ tipo: "livre" });
  });

  it("pendente com hora no futuro é agendado", () => {
    expect(estadoDaPublicacao(reserva(), linha(), AGORA)).toEqual({ tipo: "agendado", quando: depois(3_600_000), filaId: "fila-1" });
  });

  it("pendente com a hora vencida, ou enviando, é publicando", () => {
    expect(estadoDaPublicacao(reserva(), linha({ not_before: AGORA }), AGORA)).toEqual({ tipo: "publicando", filaId: "fila-1" });
    expect(estadoDaPublicacao(reserva(), linha({ status: "sending", not_before: antes(5) }), AGORA)).toEqual({
      tipo: "publicando",
      filaId: "fila-1",
    });
  });

  it("enviado é publicado, com a hora do envio", () => {
    expect(estadoDaPublicacao(reserva(), linha({ status: "sent", sent_at: antes(60_000) }), AGORA)).toEqual({
      tipo: "publicado",
      em: antes(60_000),
      filaId: "fila-1",
    });
  });

  it("falhou leva o motivo da fila, e cancelado é cancelado", () => {
    expect(estadoDaPublicacao(reserva(), linha({ status: "failed", error: "a Meta recusou" }), AGORA)).toEqual({
      tipo: "falhou",
      motivo: "a Meta recusou",
      filaId: "fila-1",
    });
    expect(estadoDaPublicacao(reserva(), linha({ status: "skipped" }), AGORA)).toEqual({ tipo: "cancelado", filaId: "fila-1" });
  });

  it("um estado que a fila venha a ter, e que o Chat não conhece, é desconhecido", () => {
    expect(estadoDaPublicacao(reserva(), linha({ status: "guardado" }), AGORA)).toEqual({ tipo: "desconhecido", status: "guardado" });
  });

  it("a publicação de forma estranha é desconhecida, com ou sem linha", () => {
    expect(estadoDaPublicacao("estranha", null, AGORA)).toEqual({ tipo: "desconhecido" });
  });

  it("a reserva nunca enfileirada, sem linha, é publicando por 10 minutos, e depois não entrou", () => {
    const nunca = (ms: number) => reserva({ reservadaEm: antes(ms), enfileiradaEm: null });
    expect(ESPERA_DA_RESERVA_MS).toBe(10 * 60_000);
    expect(estadoDaPublicacao(nunca(ESPERA_DA_RESERVA_MS - 1), null, AGORA)).toEqual({ tipo: "publicando", filaId: null });
    expect(estadoDaPublicacao(nunca(ESPERA_DA_RESERVA_MS), null, AGORA)).toEqual({ tipo: "nao_entrou" });
  });

  // ACHADO 75: desconectar a conta apaga as linhas da fila dela (lib/db.ts:469-474). O carrossel
  // publicado não pode cair em "não entrou" e ficar livre: um clique publicaria de novo.
  it("a enfileirada sem linha saiu da fila, mesmo depois dos 10 minutos", () => {
    expect(estadoDaPublicacao(reserva({ reservadaEm: antes(86_400_000), enfileiradaEm: antes(86_399_000) }), null, AGORA)).toEqual({
      tipo: "saiu_da_fila",
    });
  });
});

describe("a trava: o que libera", () => {
  const estados: [EstadoDaPublicacao, boolean][] = [
    [{ tipo: "livre" }, true],
    [{ tipo: "falhou", motivo: null, filaId: "f" }, true],
    [{ tipo: "cancelado", filaId: "f" }, true],
    [{ tipo: "nao_entrou" }, true],
    [{ tipo: "agendado", quando: AGORA, filaId: "f" }, false],
    [{ tipo: "publicando", filaId: null }, false],
    [{ tipo: "publicado", em: AGORA, filaId: "f" }, false],
    [{ tipo: "saiu_da_fila" }, false],
    [{ tipo: "desconhecido" }, false],
  ];
  it.each(estados)("%o: livre = %s", (estado, livre) => {
    expect(publicacaoLivre(estado)).toBe(livre);
  });
});

describe("as frases do estado", () => {
  it("livre não tem frase; os outros têm", () => {
    expect(textoDoEstadoDaPublicacao({ tipo: "livre" })).toBeNull();
    expect(textoDoEstadoDaPublicacao({ tipo: "agendado", quando: depois(3_600_000), filaId: "f" })).toBe(
      `Agendado para ${fmtDate(depois(3_600_000))} (horário de Brasília).`
    );
    expect(textoDoEstadoDaPublicacao({ tipo: "publicado", em: antes(60_000), filaId: "f" })).toBe(`Publicado em ${fmtDate(antes(60_000))}.`);
    expect(textoDoEstadoDaPublicacao({ tipo: "publicado", em: null, filaId: "f" })).toBe("Publicado.");
    expect(textoDoEstadoDaPublicacao({ tipo: "falhou", motivo: "a Meta recusou", filaId: "f" })).toBe(
      "Não publicou: a Meta recusou. Dá para publicar de novo."
    );
    expect(textoDoEstadoDaPublicacao({ tipo: "falhou", motivo: null, filaId: "f" })).toBe(
      "Não publicou, e a fila não disse o motivo. Dá para publicar de novo."
    );
    expect(textoDoEstadoDaPublicacao({ tipo: "nao_entrou" })).toBe("A última tentativa não entrou na fila. Dá para publicar de novo.");
    expect(textoDoEstadoDaPublicacao({ tipo: "saiu_da_fila" })).toContain("A conta foi desconectada?");
    for (const e of [
      { tipo: "publicando", filaId: null },
      { tipo: "cancelado", filaId: "f" },
      { tipo: "desconhecido" },
    ] as EstadoDaPublicacao[]) {
      expect(textoDoEstadoDaPublicacao(e)).toMatch(/\.$/);
    }
  });

  it("a trava das edições diz por que o carrossel não muda", () => {
    expect(textoDaTrava({ tipo: "agendado", quando: AGORA, filaId: "f" })).toBe("Agendado: para mudar, cancele no calendário.");
    expect(textoDaTrava({ tipo: "publicando", filaId: null })).toBe("Publicando: o carrossel não muda até o post sair.");
    expect(textoDaTrava({ tipo: "publicado", em: AGORA, filaId: "f" })).toBe("Este carrossel já foi publicado, e fica só para leitura.");
    expect(textoDaTrava({ tipo: "saiu_da_fila" })).toBe(textoDoEstadoDaPublicacao({ tipo: "saiu_da_fila" }));
    expect(textoDaTrava({ tipo: "desconhecido" })).toBe(textoDoEstadoDaPublicacao({ tipo: "desconhecido" }));
  });

  it("o calendário é da conta selecionada no menu", () => {
    expect(textoDoCalendario("Thiago Vannuchi")).toBe("Para ver no calendário, selecione Thiago Vannuchi no menu.");
  });
});

describe("o que falta para publicar", () => {
  const base = {
    total: 5,
    soTexto: [1, 5],
    imagens: { 2: { caminho: "c2", versao: "v" }, 3: { caminho: "c3", versao: "v" } },
    origem: "gravada" as const,
    slidesNaoSalvos: [],
    legendaNaoSalva: false,
  };

  it("nada falta quando todo slide com espaço tem imagem e nada está sem salvar", () => {
    expect(faltasParaPublicar({ ...base, imagens: { ...base.imagens, 4: { caminho: "c4", versao: "v" } } })).toEqual([]);
  });

  it("os slides com espaço sem imagem; os só texto não pedem", () => {
    expect(faltasParaPublicar(base)).toEqual([{ tipo: "imagens", slides: [4] }]);
    expect(faltasParaPublicar({ ...base, imagens: {} })).toEqual([{ tipo: "imagens", slides: [2, 3, 4] }]);
  });

  // Adendo da foto no espaço: todo slide com espaço tem uma imagem, de qualquer jeito.
  it("a foto e o slide pronto contam do mesmo jeito", () => {
    const imagens = { 2: { jeito: "foto" }, 3: { jeito: "slide" }, 4: { jeito: "foto" } };
    expect(faltasParaPublicar({ ...base, imagens })).toEqual([]);
  });

  it("o não salvo, porque o que sai é o texto salvo", () => {
    const tudo = { ...base, imagens: { ...base.imagens, 4: { caminho: "c4", versao: "v" } } };
    expect(faltasParaPublicar({ ...tudo, slidesNaoSalvos: [3], legendaNaoSalva: true })).toEqual([
      { tipo: "nao_salvo", slides: [3], legenda: true },
    ]);
  });

  it("a conta vem antes de tudo: sem conta gravada, ou desconectada", () => {
    expect(faltasParaPublicar({ ...base, origem: "selecionada" })[0]).toEqual({ tipo: "sem_conta" });
    expect(faltasParaPublicar({ ...base, origem: "guardada" })[0]).toEqual({ tipo: "conta_desconectada" });
    expect(faltasParaPublicar({ ...base, origem: "gravada_saiu" })[0]).toEqual({ tipo: "conta_desconectada" });
  });

  it("as frases", () => {
    expect(listaDeSlides([2])).toBe("o slide 2");
    expect(listaDeSlides([2, 5])).toBe("os slides 2 e 5");
    expect(listaDeSlides([2, 3, 5])).toBe("os slides 2, 3 e 5");
    expect(textoDaFalta({ tipo: "imagens", slides: [2] })).toBe("Falta a imagem do slide 2.");
    expect(textoDaFalta({ tipo: "imagens", slides: [2, 5] })).toBe("Falta a imagem dos slides 2 e 5.");
    expect(textoDaFalta({ tipo: "nao_salvo", slides: [3], legenda: false })).toBe("Salve o slide 3 antes de publicar.");
    expect(textoDaFalta({ tipo: "nao_salvo", slides: [], legenda: true })).toBe("Salve a legenda antes de publicar.");
    expect(textoDaFalta({ tipo: "nao_salvo", slides: [2, 3], legenda: true })).toBe("Salve os slides 2 e 3 e a legenda antes de publicar.");
    expect(textoDaFalta({ tipo: "sem_conta" })).toContain("Fixar nesta conta");
    expect(textoDaFalta({ tipo: "conta_desconectada" })).toContain("desconectada");
  });
});

describe("as frases da foto no espaço", () => {
  it("cada problema da foto tem frase própria, terminada em ponto", () => {
    const frases = (["sem_medida", "proporcao", "pequena", "grande", "pesada"] as const).map(textoDoProblemaDaFoto);
    for (const f of frases) expect(f).toMatch(/\.$/);
    expect(new Set(frases).size).toBe(frases.length);
  });

  it("a pequena diz o mínimo do espaço, e a pesada diz os 2 MB (achado 79)", () => {
    expect(textoDoProblemaDaFoto("pequena")).toBe("A foto é pequena para o espaço da arte: o mínimo é 860×573.");
    expect(textoDoProblemaDaFoto("pesada")).toContain("2 MB");
  });
});

describe("as recusas da publicação têm frase, cada uma", () => {
  const recusas: RecusaDaPublicacaoDoCarrossel[] = [
    { motivo: "nao_pronto" },
    { motivo: "sem_conta" },
    { motivo: "conta_desconectada" },
    { motivo: "travado", estado: { tipo: "agendado", quando: AGORA, filaId: "f" } },
    { motivo: "slide" },
    { motivo: "sem_espaco", numero: 2 },
    { motivo: "nao_e_so_texto", numero: 3 },
    { motivo: "tipo" },
    { motivo: "proporcao", problema: "proporcao" },
    { motivo: "proporcao", problema: "sem_medida" },
    { motivo: "arquivo", texto: "A imagem é estreita demais: a largura mínima é 320 pixels." },
    { motivo: "caminho" },
    { motivo: "faltam_imagens", slides: [2, 4] },
    { motivo: "arte_so_texto", numero: 5 },
    { motivo: "arte_velha", numero: 5 },
    { motivo: "caminho_na_fila" },
    { motivo: "legenda", texto: "A legenda passa de 2.200 caracteres." },
    { motivo: "quantidade", texto: "Um carrossel precisa de pelo menos duas mídias." },
    { motivo: "copia", numero: 2 },
    { motivo: "mudou" },
    { motivo: "fila" },
    { motivo: "armazenamento", texto: "Nao foi possivel assinar o upload no bucket: HTTP 500" },
  ];

  it("toda recusa tem frase própria, terminada em ponto", () => {
    const frases = recusas.map(textoDaRecusaDaPublicacaoDoCarrossel);
    for (const f of frases) expect(f).toMatch(/\.$/);
    expect(new Set(frases).size).toBe(frases.length);
  });

  it("a proporção diz o 4:5 e o tamanho da arte", () => {
    expect(textoDaRecusaDaPublicacaoDoCarrossel({ motivo: "proporcao", problema: "proporcao" })).toBe(
      "A imagem do slide tem de ser 4:5, como a arte (1080×1350)."
    );
  });

  it("a travada usa a frase da trava, e a de imagens usa a lista de slides", () => {
    const estado: EstadoDaPublicacao = { tipo: "publicado", em: AGORA, filaId: "f" };
    expect(textoDaRecusaDaPublicacaoDoCarrossel({ motivo: "travado", estado })).toBe(textoDaTrava(estado));
    expect(textoDaRecusaDaPublicacaoDoCarrossel({ motivo: "faltam_imagens", slides: [2, 4] })).toBe("Falta a imagem dos slides 2 e 4.");
  });
});

describe("a cor do estado na página", () => {
  it("verde no agendado e no publicado; amarelo no publicando, cancelado e não entrou; vermelho no resto", () => {
    expect(tomDoEstadoDaPublicacao({ tipo: "livre" })).toBeNull();
    expect(tomDoEstadoDaPublicacao({ tipo: "agendado", quando: AGORA, filaId: "f" })).toBe("ok");
    expect(tomDoEstadoDaPublicacao({ tipo: "publicado", em: AGORA, filaId: "f" })).toBe("ok");
    expect(tomDoEstadoDaPublicacao({ tipo: "publicando", filaId: null })).toBe("atencao");
    expect(tomDoEstadoDaPublicacao({ tipo: "cancelado", filaId: "f" })).toBe("atencao");
    expect(tomDoEstadoDaPublicacao({ tipo: "nao_entrou" })).toBe("atencao");
    expect(tomDoEstadoDaPublicacao({ tipo: "falhou", motivo: null, filaId: "f" })).toBe("erro");
    expect(tomDoEstadoDaPublicacao({ tipo: "saiu_da_fila" })).toBe("erro");
    expect(tomDoEstadoDaPublicacao({ tipo: "desconhecido" })).toBe("erro");
  });
});
