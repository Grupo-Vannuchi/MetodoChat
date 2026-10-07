// A LINHA DE `carrosseis_gerados` como o driver a devolve (migrations/014-carrosseis-gerados.sql).
// Só tipos: é o que carrossel-repositorio.ts (server-only) e carrossel-tela.ts (puro) compartilham.
import type { EstadoDaGeracao } from "./tempos";

/**
 * De onde o carrossel veio (migrations/016-carrossel-avulso.sql): do bônus do Chat (`bonus_id`), de
 * um bônus do Labs (`labs_codigo`) ou de um texto livre. O banco amarra as colunas à origem.
 */
export type OrigemDoCarrossel = "bonus" | "labs" | "livre";

export type LinhaDoCarrossel = {
  id: string;
  /** Só na origem "bonus" (a 016 tirou o `not null`). */
  bonus_id: string | null;
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
  origem: OrigemDoCarrossel;
  /** O código (o slug) do bônus do Labs, só na origem "labs". */
  labs_codigo: string | null;
  /** Escrito à mão pelo operador: não gastou IA e não conta no teto. */
  texto_a_mao: boolean;
};
