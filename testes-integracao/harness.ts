// A FUNDAÇÃO DA FRENTE 2, parte de cima: os ganchos que um teste de integração
// usa. A mecânica do banco descartável mora em `banco-descartavel.ts`; aqui só
// vive o que precisa do vitest.
//
// Leia o cabeçalho de `banco-descartavel.ts` antes de mexer em qualquer coisa:
// é lá que estão as quatro medições que sustentam o arranjo e a armadilha do
// `search_path` com `public` na cauda, que esta fundação existe para impedir.
import { afterAll, beforeAll } from "vitest";
import {
  conferirCaminho,
  corteDoBanco,
  criarSchema,
  destruirSchema,
  fecharAdmin,
  inventarioDoPublic,
  novoNomeDeSchema,
  urlComSchema,
  urlDoBanco,
  type InventarioPublic,
} from "./banco-descartavel";

type ModuloDb = typeof import("@/lib/db");

export type BancoDescartavel = {
  /** O nome do schema temporário desta rodada. */
  nome(): string;
  /** O `lib/db` de verdade, carregado DEPOIS de a DATABASE_URL estar pronta. */
  db(): ModuloDb;
  /** O instante, pelo relógio do banco, anterior a qualquer trabalho. */
  corte(): string;
  /** O retrato de `public` tirado antes de o schema temporário existir. */
  inventarioAntes(): InventarioPublic;
};

function aindaNao<T>(o: T | null, oQue: string): T {
  if (o === null) {
    throw new Error(`${oQue} só existe depois do beforeAll de bancoDescartavel().`);
  }
  return o;
}

/**
 * Chame no topo do arquivo de teste. Registra os ganchos que criam o schema
 * temporário antes de tudo e o derrubam depois de tudo — o `afterAll` do vitest
 * roda mesmo quando o teste falha, e é essa a garantia de que o schema não fica
 * órfão em produção.
 *
 * O retrato de `public` é tirado DENTRO deste `beforeAll`, e não no arquivo de
 * teste, porque ele precisa ser o primeiro acesso ao banco de todos. Ganchos do
 * vitest rodam na ordem em que foram registrados, e um `beforeAll` escrito no
 * teste correria depois deste — retratando `public` quando o trabalho já tivesse
 * começado, que é exatamente o retrato que não prova nada.
 *
 * Um schema por ARQUIVO de teste, e não por caso: `schemaReady` memoriza a
 * promessa dentro do módulo `lib/db` (lib/db.ts:633), então dois schemas no
 * mesmo arquivo exigiriam recarregar o módulo. O isolamento por arquivo do
 * vitest já dá um registro de módulos limpo para cada um.
 */
export function bancoDescartavel(): BancoDescartavel {
  let nome: string | null = null;
  let db: ModuloDb | null = null;
  let corte: string | null = null;
  let antes: InventarioPublic | null = null;

  beforeAll(async () => {
    // 1) o retrato de `public` vem ANTES de qualquer coisa nascer
    corte = await corteDoBanco();
    antes = await inventarioDoPublic(corte);

    // 2) o schema temporário
    const escolhido = novoNomeDeSchema();
    await criarSchema(escolhido);
    nome = escolhido;

    try {
      // 3) a DATABASE_URL tem de estar pronta ANTES do primeiro sql(): `_sql` é
      //    singleton de módulo (lib/db.ts:43) e só lê o ambiente lá dentro.
      //    POSTGRES_URL e NEON_DATABASE_URL saem porque `findDatabaseUrl` os
      //    aceita, e um deles vazando levaria o teste ao banco errado sem avisar.
      process.env.DATABASE_URL = urlComSchema(urlDoBanco(), escolhido);
      delete process.env.POSTGRES_URL;
      delete process.env.NEON_DATABASE_URL;

      const carregado = (await import("@/lib/db")) as ModuloDb;

      // 4) o caminho é conferido NO BANCO antes de a estrutura nascer
      await conferirCaminho((texto) => carregado.sql().query(texto), escolhido);

      // 5) a estrutura, pelo `ensureSchema()` de verdade
      await carregado.ensureSchema();
      db = carregado;
    } catch (erro) {
      // Se a montagem morrer no meio, o schema meio-feito morre junto. O
      // afterAll ainda rodaria, mas não se paga por depender só dele.
      await destruirSchema(escolhido);
      nome = null;
      throw erro;
    }
  });

  afterAll(async () => {
    try {
      if (nome) await destruirSchema(nome);
    } finally {
      await fecharAdmin();
    }
  });

  return {
    nome: () => aindaNao(nome, "o schema temporário"),
    db: () => aindaNao(db, "o lib/db do schema temporário"),
    corte: () => aindaNao(corte, "o corte"),
    inventarioAntes: () => aindaNao(antes, "o inventário de antes"),
  };
}
