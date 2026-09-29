// A LINHA DE `bonus_gerados` como o driver a devolve (migrations/013-bonus-gerados.sql).
// Só tipos: é o que repositorio.ts (server-only) e tela.ts (puro) compartilham.
import type { EstadoDoEnvio } from "./desfecho";
import type { EstadoDaGeracao } from "./tempos";

export type LinhaDoBonus = {
  id: string;
  criado_em: Date;
  tema: string;
  o_que_resolve: string;
  palavra_digitada: string | null;
  estado: EstadoDaGeracao;
  gerado: unknown;
  revisado: unknown;
  erro: string | null;
  medicao: unknown;
  gerado_em: Date | null;
  slug: string | null;
  corpo_enviado: string | null;
  envio_estado: EstadoDoEnvio | "enviando" | null;
  incerto_pendente: boolean;
  conferido_pelo_operador: boolean;
  envio_resposta: unknown;
  tentativas: number;
  envio_iniciado_em: Date | null;
  enviado_em: Date | null;
};
