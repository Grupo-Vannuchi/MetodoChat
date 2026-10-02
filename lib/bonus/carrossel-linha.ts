// A LINHA DE `carrosseis_gerados` como o driver a devolve (migrations/014-carrosseis-gerados.sql).
// Só tipos: é o que carrossel-repositorio.ts (server-only) e carrossel-tela.ts (puro) compartilham.
import type { EstadoDaGeracao } from "./tempos";

export type LinhaDoCarrossel = {
  id: string;
  bonus_id: string;
  criado_em: Date;
  total_slides: number;
  palavra: string;
  contexto: unknown;
  estado: EstadoDaGeracao;
  gerado: unknown;
  revisado: unknown;
  erro: string | null;
  medicao: unknown;
  gerado_em: Date | null;
  revisado_em: Date | null;
  /** As escolhas da arte (migrations/015-arte-do-carrossel.sql), lidas por `escolhasDaArte`. */
  arte: unknown;
};
