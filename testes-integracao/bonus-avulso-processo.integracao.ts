// O PROCESSO DO CARROSSEL AVULSO CONTRA O BANCO DE VERDADE (o container), spec da Etapa 7: o pedido
// lido, a situação do bônus no Labs (sempre uma falsa: nada sai para o Labs), o texto escrito à mão
// conferido, e o "Gerar de novo". As actions só conferem a sessão e chamam isto; o harness não forja
// sessão, então o caminho com sessão se prova aqui.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { ContaGuardada } from "@/lib/bonus/arte-conta";
import type { PedidoAvulso } from "@/lib/bonus/avulso-pedido";
import type { SituacaoNoLabs } from "@/lib/bonus/publicado";
import { bancoDescartavel } from "./harness";

type ModuloProcesso = typeof import("@/lib/bonus/avulso-processo");
type ModuloRepo = typeof import("@/lib/bonus/carrossel-repositorio");

const banco = bancoDescartavel();

const CODIGO = "conselheiro-brutalmente-honesto";
const NO_LABS = {
  palavra: "BRUTAL",
  titulo: "Conselheiro brutalmente honesto",
  descricao: "Um prompt que critica o seu plano sem dó.",
  tema: "Produtividade",
};
const publicado = (troca: Partial<typeof NO_LABS> = {}): SituacaoNoLabs => ({ tipo: "publicado", bonus: { ...NO_LABS, ...troca } });
const THIAGO: ContaGuardada = { conta: "17841400000000001", nome: "Thiago Vannuchi", arroba: "thiagovannuchi" };

/** Os campos do carrossel de 5 slides escritos à mão, na forma que o formulário manda. */
const A_MAO = {
  gancho: "Seu plano tem um furo. Você só não quer ver.",
  slide_1_titulo: "O que ele faz",
  slide_1_texto: "Ele lê o seu plano e aponta o que você está evitando olhar.",
  slide_2_titulo: "Como usar",
  slide_2_texto: "Cole o plano, peça a crítica e responda às perguntas dele.",
  slide_3_titulo: "O que esperar",
  slide_3_texto: "Um texto duro, mas com o que fazer em cada ponto fraco.",
  chamada: "Comente BRUTAL e receba o prompt agora.",
  legenda: "Quer ouvir a verdade sobre o seu plano? Comente BRUTAL que eu te mando o prompt do conselheiro.",
};

const doLabs = (troca: Partial<Extract<PedidoAvulso, { origem: "labs" }>> = {}): PedidoAvulso => ({
  origem: "labs",
  codigo: CODIGO,
  destaque: "Mostre o antes e o depois.",
  total: 5,
  jeito: "ia",
  ...troca,
});
const livre = (troca: Partial<Extract<PedidoAvulso, { origem: "livre" }>> = {}): PedidoAvulso => ({
  origem: "livre",
  tema: "Produtividade",
  palavra: "BRUTAL",
  conteudo: "Um prompt que critica o seu plano sem dó nenhum.",
  total: 5,
  jeito: "ia",
  ...troca,
});

let processo: ModuloProcesso;
let repo: ModuloRepo;

beforeAll(async () => {
  processo = await import("@/lib/bonus/avulso-processo");
  repo = await import("@/lib/bonus/carrossel-repositorio");
});

beforeEach(async () => {
  await banco.db().sql().query(`delete from carrosseis_gerados`);
});

async function contar(): Promise<number> {
  const [{ n }] = (await banco.db().sql().query(`select count(*)::int as n from carrosseis_gerados`)) as { n: number }[];
  return n;
}

/** Quem lê a situação no Labs, falso, e o que ele foi perguntado. */
function labs(situacao: SituacaoNoLabs) {
  const perguntados: string[] = [];
  return {
    perguntados,
    lerSituacao: async (codigo: string) => {
      perguntados.push(codigo);
      return situacao;
    },
  };
}

describe("pedir o carrossel avulso", () => {
  it("do Labs, pela IA: a palavra e o contexto vêm do Labs, com o destaque, e a geração é pedida", async () => {
    const l = labs(publicado());
    const r = await processo.pedirAvulso({ pedido: doLabs(), bruto: {}, conta: THIAGO, lerSituacao: l.lerSituacao });
    expect(l.perguntados).toEqual([CODIGO]);
    if (!r.ok) throw new Error(r.texto);
    expect(r.gerar).toBe(true);
    expect(await repo.lerCarrossel(r.id)).toMatchObject({
      origem: "labs",
      labs_codigo: CODIGO,
      palavra: "BRUTAL",
      estado: "pendente",
      contexto: { tema: "Produtividade", titulo: NO_LABS.titulo, descricao: NO_LABS.descricao, oQueResolve: "Mostre o antes e o depois." },
      arte: THIAGO,
    });
  });

  it.each([
    ["despublicado", { tipo: "nao_publicado" } as SituacaoNoLabs, "Criado no Labs como oculto"],
    ["com a palavra fora do padrão", { tipo: "palavra_fora_do_padrao", palavra: "SEM-DOR" } as SituacaoNoLabs, "SEM-DOR"],
    ["sem resposta", { tipo: "sem_resposta" } as SituacaoNoLabs, "Não consegui consultar o Labs"],
  ])("o bônus do Labs %s é recusado com a frase, sem gravar nada", async (_nome, situacao, frase) => {
    const r = await processo.pedirAvulso({ pedido: doLabs(), bruto: {}, conta: null, lerSituacao: labs(situacao).lerSituacao });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.texto).toContain(frase);
    expect(await contar()).toBe(0);
  });

  it("do texto livre, pela IA: o tema, o conteúdo e a palavra do formulário, sem perguntar ao Labs", async () => {
    const l = labs(publicado());
    const r = await processo.pedirAvulso({ pedido: livre(), bruto: {}, conta: null, lerSituacao: l.lerSituacao });
    expect(l.perguntados).toEqual([]);
    if (!r.ok) throw new Error(r.texto);
    expect(r.gerar).toBe(true);
    expect(await repo.lerCarrossel(r.id)).toMatchObject({
      origem: "livre",
      labs_codigo: null,
      palavra: "BRUTAL",
      contexto: { tipo: "livre", tema: "Produtividade", conteudo: "Um prompt que critica o seu plano sem dó nenhum." },
    });
  });

  it("escrito à mão, do texto livre: nasce pronto com o texto, o título é o tema, e a geração não é pedida", async () => {
    const r = await processo.pedirAvulso({ pedido: livre({ jeito: "mao" }), bruto: A_MAO, conta: null, lerSituacao: labs(publicado()).lerSituacao });
    if (!r.ok) throw new Error(r.texto);
    expect(r.gerar).toBe(false);
    const l = await repo.lerCarrossel(r.id);
    expect(l).toMatchObject({ estado: "pronto", texto_a_mao: true });
    expect(l?.gerado).toMatchObject({ tipo: "carrossel", titulo: "Produtividade", gancho: A_MAO.gancho, chamada: A_MAO.chamada });
  });

  it("escrito à mão, do Labs: o título é o do bônus, e a palavra conferida é a do Labs", async () => {
    const r = await processo.pedirAvulso({ pedido: doLabs({ jeito: "mao" }), bruto: A_MAO, conta: null, lerSituacao: labs(publicado()).lerSituacao });
    if (!r.ok) throw new Error(r.texto);
    expect((await repo.lerCarrossel(r.id))?.gerado).toMatchObject({ titulo: NO_LABS.titulo });

    const outra = await processo.pedirAvulso({
      pedido: doLabs({ jeito: "mao" }),
      bruto: A_MAO,
      conta: null,
      lerSituacao: labs(publicado({ palavra: "CONSELHO" })).lerSituacao,
    });
    expect(!outra.ok && outra.texto).toContain("precisa pedir a palavra CONSELHO");
  });

  it("o escrito à mão com problema é recusado com o campo e o motivo, sem gravar nada", async () => {
    const r = await processo.pedirAvulso({
      pedido: livre({ jeito: "mao" }),
      bruto: { ...A_MAO, chamada: "Comente e receba o prompt agora mesmo.", gancho: "curto" },
      conta: null,
      lerSituacao: labs(publicado()).lerSituacao,
    });
    expect(r).toEqual({
      ok: false,
      texto: "Corrija antes de criar. Gancho (slide 1): precisa de pelo menos 15 caracteres. Chamada (slide 5): precisa pedir a palavra BRUTAL.",
    });
    expect(await contar()).toBe(0);
  });

  it("com o teto cheio, o da IA é recusado com a frase do teto, e o escrito à mão entra", async () => {
    for (let i = 0; i < 10; i++) {
      const r = await processo.pedirAvulso({ pedido: livre(), bruto: {}, conta: null, lerSituacao: labs(publicado()).lerSituacao });
      expect(r.ok).toBe(true);
    }
    const ia = await processo.pedirAvulso({ pedido: livre(), bruto: {}, conta: null, lerSituacao: labs(publicado()).lerSituacao });
    expect(!ia.ok && ia.texto).toContain("que é o limite");
    const aMao = await processo.pedirAvulso({ pedido: livre({ jeito: "mao" }), bruto: A_MAO, conta: null, lerSituacao: labs(publicado()).lerSituacao });
    expect(aMao.ok).toBe(true);
  });
});

describe("gerar de novo o carrossel avulso", () => {
  const AGORA = () => Date.now();

  async function falhou(pedido: PedidoAvulso, situacao = publicado()): Promise<string> {
    const r = await processo.pedirAvulso({ pedido, bruto: {}, conta: THIAGO, lerSituacao: labs(situacao).lerSituacao });
    if (!r.ok) throw new Error(r.texto);
    await banco.db().sql().query(`update carrosseis_gerados set estado = 'falhou', erro = 'A API recusou.' where id = $1`, [r.id]);
    return r.id;
  }

  it("o do texto livre reaproveita o tema, o conteúdo, a palavra e o total gravados", async () => {
    const id = await falhou(livre({ total: 4 }));
    const l = labs(publicado());
    const r = await processo.gerarAvulsoDeNovo({ linha: (await repo.lerCarrossel(id))!, conta: THIAGO, lerSituacao: l.lerSituacao, agora: AGORA() });
    expect(l.perguntados).toEqual([]);
    if (!r.ok) throw new Error(r.texto);
    expect(r.id).not.toBe(id);
    expect(await repo.lerCarrossel(r.id)).toMatchObject({
      origem: "livre",
      estado: "pendente",
      total_slides: 4,
      palavra: "BRUTAL",
      contexto: { tipo: "livre", tema: "Produtividade", conteudo: "Um prompt que critica o seu plano sem dó nenhum." },
      arte: THIAGO,
    });
  });

  it("o do Labs relê o Labs pelo código, com a palavra de agora, e mantém o destaque", async () => {
    const id = await falhou(doLabs());
    const l = labs(publicado({ palavra: "CONSELHO" }));
    const r = await processo.gerarAvulsoDeNovo({ linha: (await repo.lerCarrossel(id))!, conta: null, lerSituacao: l.lerSituacao, agora: AGORA() });
    expect(l.perguntados).toEqual([CODIGO]);
    if (!r.ok) throw new Error(r.texto);
    expect(await repo.lerCarrossel(r.id)).toMatchObject({
      origem: "labs",
      labs_codigo: CODIGO,
      palavra: "CONSELHO",
      contexto: { oQueResolve: "Mostre o antes e o depois." },
    });
  });

  it("o do Labs que saiu do ar é recusado com a frase, sem gravar nada", async () => {
    const id = await falhou(doLabs());
    const r = await processo.gerarAvulsoDeNovo({
      linha: (await repo.lerCarrossel(id))!,
      conta: null,
      lerSituacao: labs({ tipo: "nao_publicado" }).lerSituacao,
      agora: AGORA(),
    });
    expect(!r.ok && r.texto).toContain("Criado no Labs como oculto");
    expect(await contar()).toBe(1);
  });

  it("só o que falhou ou travou gera de novo", async () => {
    const r = await processo.pedirAvulso({ pedido: livre(), bruto: {}, conta: null, lerSituacao: labs(publicado()).lerSituacao });
    if (!r.ok) throw new Error(r.texto);
    const novo = await processo.gerarAvulsoDeNovo({
      linha: (await repo.lerCarrossel(r.id))!,
      conta: null,
      lerSituacao: labs(publicado()).lerSituacao,
      agora: AGORA(),
    });
    expect(!novo.ok && novo.texto).toBe("Só dá para gerar de novo um carrossel cuja geração falhou ou travou.");
    expect(await contar()).toBe(1);
  });
});

// O "GERAR DE NOVO" SEM PALAVRA-CHAVE (spec da Etapa 8): o do texto livre repete a ação gravada.
describe("gerar de novo o carrossel avulso sem palavra-chave", () => {
  it("o do texto livre repete a palavra nula e a ação gravadas", async () => {
    const criado = await repo.criarCarrosselAvulso({
      origem: "livre",
      labsCodigo: null,
      total: 4,
      palavra: null,
      acao: "compartilhar",
      contexto: { tipo: "livre", tema: "Vendas", conteudo: "Como vender sem parecer chato, em cinco passos." },
      conta: THIAGO,
      texto: null,
    });
    if (!criado.ok) throw new Error("teto no meio do teste");
    await banco.db().sql().query(`update carrosseis_gerados set estado = 'falhou', erro = 'A API recusou.' where id = $1`, [criado.id]);
    const l = labs(publicado());
    const r = await processo.gerarAvulsoDeNovo({ linha: (await repo.lerCarrossel(criado.id))!, conta: THIAGO, lerSituacao: l.lerSituacao, agora: Date.now() });
    if (!r.ok) throw new Error(r.texto);
    expect(l.perguntados).toEqual([]);
    expect(await repo.lerCarrossel(r.id)).toMatchObject({ origem: "livre", estado: "pendente", palavra: null, acao_da_chamada: "compartilhar", total_slides: 4 });
  });
});
