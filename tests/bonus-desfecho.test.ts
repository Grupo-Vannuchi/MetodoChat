import { describe, expect, it } from "vitest";
import { detalheDe, lerResposta, type Desfecho, type RespostaCrua } from "@/lib/bonus/desfecho";

const NOSSO = "kit-de-lancamento";
const http = (status: number, corpo: unknown): RespostaCrua => ({
  tipo: "http",
  status,
  texto: JSON.stringify(corpo),
});
const TIMEOUT: RespostaCrua = { tipo: "falha", motivo: "timeout" };

type Caso = [
  nome: string,
  r: RespostaCrua,
  incertoAntes: boolean,
  estado: string,
  motivo: string,
  incertoDepois: boolean,
];

// Cada linha da tabela "O que cada resposta vira" da spec, nas duas colunas.
const CASOS: Caso[] = [
  ["201", http(201, { ok: true, slug: NOSSO, id: 7, isActive: false }), false, "criado", "criado", false],
  ["201 com incerta antes", http(201, { ok: true, slug: NOSSO, id: 7, isActive: false }), true, "criado", "criado", false],
  ["duplicate sem incerta é colisão", http(200, { ok: true, duplicate: true, slug: NOSSO, isActive: false }), false, "colisao", "colisao", false],
  ["duplicate com incerta é conferir", http(200, { ok: true, duplicate: true, slug: NOSSO, isActive: false }), true, "conferir", "conferir", true],
  ["duplicate ativo com incerta também é conferir", http(200, { ok: true, duplicate: true, slug: NOSSO, isActive: true }), true, "conferir", "conferir", true],
  ["409 título apontando o nosso slug é o nosso", http(409, { ok: false, erro: "titulo_repetido", slugExistente: NOSSO }), true, "criado", "criado_pelo_titulo", false],
  ["409 título de outro slug libera, mesmo com incerta", http(409, { ok: false, erro: "titulo_repetido", slugExistente: "outro" }), true, "recusado", "titulo_repetido", false],
  ["409 palavra sem incerta", http(409, { ok: false, erro: "palavra_chave_repetida", palavra: "KIT" }), false, "recusado", "palavra_repetida", false],
  ["409 palavra com incerta é conferir", http(409, { ok: false, erro: "palavra_chave_repetida", palavra: "KIT" }), true, "conferir", "conferir", true],
  ["422 campos sem incerta", http(422, { ok: false, erro: "campos_invalidos", problemas: [{ campo: "title", erro: "curto" }] }), false, "recusado", "campos_invalidos", false],
  ["422 tema sem incerta", http(422, { ok: false, erro: "tema_fora_do_catalogo", tema: "X", temasValidos: ["Marketing", "Vendas"] }), false, "recusado", "tema_fora_do_catalogo", false],
  ["422 tema com incerta é conferir", http(422, { ok: false, erro: "tema_fora_do_catalogo", tema: "X", temasValidos: ["Marketing"] }), true, "conferir", "conferir", true],
  ["422 tema ausente", http(422, { ok: false, erro: "tema_ausente" }), false, "recusado", "tema_ausente", false],
  ["422 palavra ausente", http(422, { ok: false, erro: "palavra_chave_ausente" }), false, "recusado", "palavra_ausente", false],
  ["413 sem incerta", http(413, { ok: false, erro: "corpo_grande_demais", limiteBytes: 64_000 }), false, "recusado", "grande_demais", false],
  ["413 com incerta é conferir", http(413, { ok: false, erro: "corpo_grande_demais", limiteBytes: 64_000 }), true, "conferir", "conferir", true],
  ["401 relógio sem incerta libera", http(401, { ok: false, erro: "timestamp_fora_da_janela" }), false, "recusado", "relogio", false],
  ["401 relógio com incerta continua congelado", http(401, { ok: false, erro: "timestamp_fora_da_janela" }), true, "recusado", "relogio", true],
  ["401 assinatura inválida", http(401, { ok: false, erro: "assinatura_invalida" }), false, "recusado", "assinatura", false],
  ["401 cabeçalho ausente", http(401, { ok: false, erro: "header_ausente" }), false, "recusado", "assinatura", false],
  ["401 que o contrato não conhece", http(401, { ok: false, erro: "novidade" }), false, "incerto", "fora_do_contrato", true],
  ["429 sem incerta", http(429, { ok: false, erro: "muitas_requisicoes" }), false, "esperar", "esperar", false],
  ["429 com incerta mantém a incerteza", http(429, { ok: false, erro: "muitas_requisicoes" }), true, "esperar", "esperar", true],
  ["503 porta desligada", http(503, { ok: false, erro: "porta_nao_configurada" }), false, "porta_desligada", "porta_desligada", false],
  ["503 sem o erro do contrato (o Labs no meio de um deploy)", { tipo: "http", status: 503, texto: "<html>Service Unavailable</html>" }, false, "incerto", "erro_do_labs", true],
  ["500 erro temporário", http(500, { ok: false, erro: "erro_temporario" }), false, "incerto", "erro_do_labs", true],
  ["400 json inválido está fora do contrato", http(400, { ok: false, erro: "json_invalido" }), false, "incerto", "fora_do_contrato", true],
  ["200 sem duplicate está fora do contrato", http(200, { ok: true }), false, "incerto", "fora_do_contrato", true],
  ["201 com corpo que não é JSON", { tipo: "http", status: 201, texto: "ok" }, false, "incerto", "fora_do_contrato", true],
  ["timeout", TIMEOUT, false, "incerto", "timeout", true],
  ["queda de rede", { tipo: "falha", motivo: "rede" }, false, "incerto", "rede", true],
  ["resposta grande demais", { tipo: "falha", motivo: "grande" }, false, "incerto", "resposta_grande", true],
];

describe("lerResposta", () => {
  it.each(CASOS)("%s", (_nome, r, incertoAntes, estado, motivo, incertoDepois) => {
    const d = lerResposta(r, { incertoAntes, nossoSlug: NOSSO });
    expect({ estado: d.estado, motivo: d.motivo, incertoPendente: d.incertoPendente }).toEqual({
      estado,
      motivo,
      incertoPendente: incertoDepois,
    });
  });
});

/** Aplica as respostas em ordem, levando a incerteza de uma para a outra, como a tabela faz. */
function sequencia(...respostas: RespostaCrua[]): Desfecho {
  let incerto = false;
  let ultimo: Desfecho | null = null;
  for (const r of respostas) {
    ultimo = lerResposta(r, { incertoAntes: incerto, nossoSlug: NOSSO });
    incerto = ultimo.incertoPendente;
  }
  if (!ultimo) throw new Error("sequência vazia");
  return ultimo;
}

describe("as sequências que a revisão levantou", () => {
  it("[timeout, 409 título do nosso slug] termina em criado (proposto pelo auditor)", () => {
    const d = sequencia(TIMEOUT, http(409, { ok: false, erro: "titulo_repetido", slugExistente: NOSSO }));
    expect(d.estado).toBe("criado");
  });

  it("[timeout, 409 palavra] termina em conferir, congelado", () => {
    const d = sequencia(TIMEOUT, http(409, { ok: false, erro: "palavra_chave_repetida", palavra: "KIT" }));
    expect([d.estado, d.incertoPendente]).toEqual(["conferir", true]);
  });

  it("[timeout, duplicate ativo] termina em conferir, e não em colisão", () => {
    const d = sequencia(TIMEOUT, http(200, { ok: true, duplicate: true, slug: NOSSO, isActive: true }));
    expect(d.estado).toBe("conferir");
  });

  it("[timeout, 422 tema fora do catálogo] termina em conferir, congelado (proposto pelo auditor)", () => {
    const d = sequencia(TIMEOUT, http(422, { ok: false, erro: "tema_fora_do_catalogo", temasValidos: [] }));
    expect([d.estado, d.incertoPendente]).toEqual(["conferir", true]);
  });

  it("[timeout, 401 relógio] continua congelado", () => {
    const d = sequencia(TIMEOUT, http(401, { ok: false, erro: "timestamp_fora_da_janela" }));
    expect(d.incertoPendente).toBe(true);
  });

  it("[timeout, 429, duplicate] ainda é conferir: o 429 não apaga a incerteza", () => {
    const d = sequencia(TIMEOUT, http(429, { ok: false, erro: "muitas_requisicoes" }), http(200, { ok: true, duplicate: true, slug: NOSSO, isActive: false }));
    expect(d.estado).toBe("conferir");
  });

  it("[429, duplicate] é colisão: o 429 não cria incerteza", () => {
    const d = sequencia(http(429, { ok: false, erro: "muitas_requisicoes" }), http(200, { ok: true, duplicate: true, slug: NOSSO, isActive: false }));
    expect(d.estado).toBe("colisao");
  });

  it("[503 porta, 201] termina em criado", () => {
    const d = sequencia(http(503, { ok: false, erro: "porta_nao_configurada" }), http(201, { ok: true, slug: NOSSO, id: 1, isActive: false }));
    expect(d.estado).toBe("criado");
  });
});

describe("detalheDe", () => {
  it("guarda só os campos conhecidos, com teto de tamanho", () => {
    const d = detalheDe(
      { erro: "x".repeat(500), temasValidos: Array.from({ length: 80 }, (_, i) => `Tema ${i}`), segredo: "não guarda" },
      422
    );
    expect(d.erro).toHaveLength(200);
    expect(d.temasValidos).toHaveLength(50);
    expect(d.status).toBe(422);
    expect(JSON.stringify(d)).not.toContain("não guarda");
  });

  it("ignora item de `problemas` fora da forma do contrato", () => {
    const d = detalheDe({ problemas: [{ campo: "title", erro: "curto" }, "lixo", { campo: 1 }] }, 422);
    expect(d.problemas).toEqual([{ campo: "title", erro: "curto" }]);
  });

  it("lê de volta o que foi gravado, com o status junto", () => {
    expect(detalheDe({ status: 409, erro: "titulo_repetido", slugExistente: "a" }).status).toBe(409);
  });
});
