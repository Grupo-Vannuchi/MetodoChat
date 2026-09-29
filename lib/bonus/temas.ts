// AS SUGESTÕES DE TEMA, lidas do catálogo público do Labs.
//
// ⚠️ ESTA LEITURA NÃO ESTÁ NO CONTRATO: o `GET /api/bonus` do Labs lista os bônus
// ATIVOS, sem autenticação (site-ia, route.ts:20-32). Se ele mudar, só as sugestões
// somem: a lista completa chega na recusa `tema_fora_do_catalogo`, que está no
// contrato. Por isso toda falha aqui vira lista vazia, e nada mais para.
//
// SEM CACHE, e de propósito dito: as páginas de app/bonus/ são `force-dynamic`
// (o padrão do dono), e isso põe `no-store` em todo fetch da página
// (node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md).
// Um `revalidate` aqui seria ignorado e só fingiria cache. Cada render faz um GET,
// com teto de 3 s.
import { urlDaPorta } from "./labs";

export function temasDoCatalogo(corpo: unknown): string[] {
  const itens =
    corpo !== null && typeof corpo === "object" ? (corpo as { items?: unknown }).items : null;
  if (!Array.isArray(itens)) return [];
  const temas = new Set<string>();
  for (const item of itens) {
    const tema = (item as { tema?: unknown } | null)?.tema;
    if (typeof tema === "string" && tema.trim() && tema.length <= 80) temas.add(tema.trim());
  }
  return [...temas].sort((a, b) => a.localeCompare(b, "pt-BR")).slice(0, 100);
}

export async function temasSugeridos(
  base: string | undefined,
  fetchImpl: typeof fetch = fetch
): Promise<string[]> {
  const porta = urlDaPorta(base);
  if (porta === null) return [];
  try {
    const res = await fetchImpl(porta, { method: "GET", signal: AbortSignal.timeout(3_000) });
    if (!res.ok) return [];
    return temasDoCatalogo(await res.json());
  } catch {
    return [];
  }
}
