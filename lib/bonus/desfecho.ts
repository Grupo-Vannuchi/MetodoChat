// O QUE A RESPOSTA DO LABS QUER DIZER PARA ESTE BÔNUS.
//
// Função pura: toda decisão da tabela "O que cada resposta vira"
// (docs/specs/2026-09-29-gerador-de-bonus.md) mora aqui, com caso de teste para
// cada linha. A ordem da rota do Labs, de onde as regras saem (site-ia,
// src/app/api/bonus/route.ts, commit 1813fd0): limitador (82) → tamanho (92, 105)
// → assinatura (112) → JSON (132) → campos (137) → tema (148, 152) → palavra
// ausente (171) → SLUG (184) → título (192) → palavra repetida (203) → criação.
//
// A REGRA POR TRÁS DE TUDO: com uma tentativa anterior de desfecho incerto, só
// libera a resposta que vem DEPOIS da checagem de slug e aponta para outro dono.
// O que vem antes dela não diz nada sobre a tentativa incerta, e aí quem decide é
// uma pessoa olhando o /admin do Labs (`conferir`).
//
// O CONTRATO DE 29/09 (site-ia d582f3c e 485573e): o `duplicate` só sai com slug E
// título iguais, e traz o `id`; slug igual com outro título é `409 slug_ocupado`. A
// rota não sabe se houve tentativa anterior: quem sabe é o Chat. Por isso o
// `duplicate` só vira `criado` com incerta antes E com o `id`. Sem o `id` é o
// contrato antigo, em que o `duplicate` olhava só o slug, e continua `conferir`.

export type RespostaCrua =
  | { tipo: "http"; status: number; texto: string }
  | { tipo: "falha"; motivo: "timeout" | "rede" | "grande" };

export type EstadoDoEnvio =
  | "criado"
  | "colisao"
  | "recusado"
  | "esperar"
  | "incerto"
  | "conferir"
  | "porta_desligada";

export const MOTIVOS_DO_ENVIO = [
  "criado",
  "criado_pelo_titulo",
  "criado_pela_duplicata",
  "conferido_existe",
  "conferido_nao_existe",
  "colisao",
  "slug_ocupado",
  "conferir",
  "titulo_repetido",
  "palavra_repetida",
  "campos_invalidos",
  "tema_fora_do_catalogo",
  "tema_ausente",
  "palavra_ausente",
  "grande_demais",
  "relogio",
  "assinatura",
  "esperar",
  "porta_desligada",
  "timeout",
  "rede",
  "resposta_grande",
  "erro_do_labs",
  "fora_do_contrato",
] as const;

export type MotivoDoEnvio = (typeof MOTIVOS_DO_ENVIO)[number];

export type Detalhe = {
  status: number | null;
  erro: string | null;
  /** O id do bônus no Labs, como texto: o contrato o manda no `duplicate`. */
  id: string | null;
  slugExistente: string | null;
  palavra: string | null;
  isActive: boolean | null;
  temasValidos: string[];
  problemas: { campo: string; erro: string }[];
};

export type Desfecho = {
  estado: EstadoDoEnvio;
  motivo: MotivoDoEnvio;
  incertoPendente: boolean;
  detalhe: Detalhe;
};

// A resposta do Labs é entrada de fora: só os campos conhecidos, com teto.
const TEXTO_MAX = 200;
const LISTA_MAX = 50;

function objeto(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function textoDe(o: Record<string, unknown> | null, chave: string): string | null {
  const v = o?.[chave];
  return typeof v === "string" ? v.slice(0, TEXTO_MAX) : null;
}

/** O id vem número ou texto, conforme o banco do Labs; guardado sempre como texto. */
function idDe(o: Record<string, unknown> | null): string | null {
  const v = o?.id;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return typeof v === "string" ? v.slice(0, TEXTO_MAX) : null;
}

function textosDe(o: Record<string, unknown> | null, chave: string): string[] {
  const v = o?.[chave];
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string")
    .slice(0, LISTA_MAX)
    .map((x) => x.slice(0, TEXTO_MAX));
}

function problemasDe(o: Record<string, unknown> | null): { campo: string; erro: string }[] {
  const v = o?.problemas;
  if (!Array.isArray(v)) return [];
  const achados: { campo: string; erro: string }[] = [];
  for (const item of v.slice(0, LISTA_MAX)) {
    const i = objeto(item);
    if (typeof i?.campo === "string" && typeof i.erro === "string") {
      achados.push({ campo: i.campo.slice(0, TEXTO_MAX), erro: i.erro.slice(0, TEXTO_MAX) });
    }
  }
  return achados;
}

/**
 * Os campos conhecidos de uma resposta do Labs, ou de um `envio_resposta` gravado.
 * `status` vem de fora quando é resposta viva, e do próprio objeto quando é gravado.
 */
export function detalheDe(bruto: unknown, status: number | null = null): Detalhe {
  const o = objeto(bruto);
  return {
    status: status ?? (typeof o?.status === "number" ? o.status : null),
    erro: textoDe(o, "erro"),
    id: idDe(o),
    slugExistente: textoDe(o, "slugExistente"),
    palavra: textoDe(o, "palavra"),
    isActive: typeof o?.isActive === "boolean" ? o.isActive : null,
    temasValidos: textosDe(o, "temasValidos"),
    problemas: problemasDe(o),
  };
}

function lerJson(texto: string): Record<string, unknown> | null {
  try {
    return objeto(JSON.parse(texto));
  } catch {
    return null;
  }
}

export function lerResposta(
  r: RespostaCrua,
  ctx: { incertoAntes: boolean; nossoSlug: string }
): Desfecho {
  if (r.tipo === "falha") {
    const motivo: MotivoDoEnvio =
      r.motivo === "timeout" ? "timeout" : r.motivo === "rede" ? "rede" : "resposta_grande";
    return { estado: "incerto", motivo, incertoPendente: true, detalhe: detalheDe(null) };
  }

  const o = lerJson(r.texto);
  const detalhe = detalheDe(o, r.status);
  const d = (estado: EstadoDoEnvio, motivo: MotivoDoEnvio, incertoPendente: boolean): Desfecho => ({
    estado,
    motivo,
    incertoPendente,
    detalhe,
  });
  const incerto = (): Desfecho =>
    d("incerto", r.status >= 500 ? "erro_do_labs" : "fora_do_contrato", true);
  // Recusa que vem ANTES da checagem de slug: com incerta antes, não prova nada.
  const recusaAntesDoSlug = (motivo: MotivoDoEnvio): Desfecho =>
    ctx.incertoAntes ? d("conferir", "conferir", true) : d("recusado", motivo, false);

  if (!o) return incerto();
  const erro = detalhe.erro;

  switch (r.status) {
    case 201:
      return o.ok === true ? d("criado", "criado", false) : incerto();
    case 200:
      if (o.ok === true && o.duplicate === true) {
        if (!ctx.incertoAntes) return d("colisao", "colisao", false);
        return detalhe.id !== null ? d("criado", "criado_pela_duplicata", false) : d("conferir", "conferir", true);
      }
      return incerto();
    case 409:
      // O slug é de outro bônus, com outro título. Com incerta antes, pode ser o nosso
      // com o título mudado no /admin entre o timeout e o reenvio: uma pessoa confere.
      if (erro === "slug_ocupado") {
        return ctx.incertoAntes ? d("conferir", "conferir", true) : d("colisao", "slug_ocupado", false);
      }
      if (erro === "titulo_repetido") {
        return detalhe.slugExistente === ctx.nossoSlug
          ? d("criado", "criado_pelo_titulo", false)
          : d("recusado", "titulo_repetido", false);
      }
      if (erro === "palavra_chave_repetida") {
        return ctx.incertoAntes ? d("conferir", "conferir", true) : d("recusado", "palavra_repetida", false);
      }
      return incerto();
    case 422:
      if (erro === "campos_invalidos") return recusaAntesDoSlug("campos_invalidos");
      if (erro === "tema_fora_do_catalogo") return recusaAntesDoSlug("tema_fora_do_catalogo");
      if (erro === "tema_ausente") return recusaAntesDoSlug("tema_ausente");
      if (erro === "palavra_chave_ausente") return recusaAntesDoSlug("palavra_ausente");
      return incerto();
    case 413:
      return recusaAntesDoSlug("grande_demais");
    case 401:
      if (erro === "timestamp_fora_da_janela") return d("recusado", "relogio", ctx.incertoAntes);
      if (erro === "header_ausente" || erro === "header_malformado" || erro === "assinatura_invalida") {
        return d("recusado", "assinatura", ctx.incertoAntes);
      }
      return incerto();
    case 429:
      return d("esperar", "esperar", ctx.incertoAntes);
    case 503:
      return erro === "porta_nao_configurada"
        ? d("porta_desligada", "porta_desligada", ctx.incertoAntes)
        : incerto();
    default:
      return incerto();
  }
}
