// A PROVA DOS DOIS LADOS DA VERIFICAÇÃO DE `public` — e ela roda inteira DENTRO
// de um schema descartável. Nenhuma linha deste arquivo escreve em `public`.
//
// A verificação que este arquivo mede é a de `compararInventarios`, a mesma que
// `fundacao.integracao.ts` aponta para `public`. Só que aqui ela é apontada para
// o schema temporário, onde é seguro APAGAR e ALTERAR de propósito — que é a
// única forma honesta de saber se ela ainda acusa.
//
// -----------------------------------------------------------------------------
// POR QUE ESTE ARQUIVO EXISTE
//
// A verificação foi AFROUXADA: ela deixou de julgar o conteúdo de linha velha,
// porque o banco é de produção e está vivo, e produção reescreve linha velha o
// tempo todo (medido: 1432 atualizações em `contacts` em 32 dias, contra 134
// inserções). Um teste que fica vermelho por motivo alheio à mudança destrói a
// confiança na suíte inteira.
//
// Mas afrouxar até parar de acusar troca um teste instável por um teste cego, e
// esta base já pagou por instrumento mudo duas vezes. Então cada afrouxamento
// tem aqui um caso que mostra o que ele PARA de pegar, e cada coisa que ele
// continua pegando tem um caso que a mostra VERMELHA.
//
// A lista completa, e ela é o índice deste arquivo:
//
//   CONTINUA ACUSANDO          | linha apagada, linha que virou outra linha,
//                              | coluna que sumiu, tabela que sumiu, e — em
//                              | tabela sem chave primária — qualquer alteração
//   PAROU DE ACUSAR (o PREÇO)  | conteúdo de linha velha alterado, com a chave
//                              | e o carimbo intactos
//   NUNCA ACUSOU, de propósito | linha NOVA, nascida depois do corte
import { describe, expect, test } from "vitest";
import { bancoDescartavel } from "./harness";
import {
  compararInventarios,
  corteDoBanco,
  inventarioDoSchema,
} from "./banco-descartavel";

const banco = bancoDescartavel();

function sql() {
  return banco.db().sql();
}

// Semeia linhas, e só DEPOIS tira o corte: assim o que foi semeado é "linha
// anterior ao corte", que é a única categoria que a verificação julga.
async function semearEFotografar(): Promise<{
  corte: string;
  antes: Awaited<ReturnType<typeof inventarioDoSchema>>;
}> {
  const corte = await corteDoBanco();
  const antes = await inventarioDoSchema(banco.nome(), corte);
  return { corte, antes };
}

async function semearEventos(quantos: number): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < quantos; i++) {
    const linhas = (await sql().query(
      `insert into events (type, payload) values ($1, $2::jsonb) returning id`,
      ["semente_da_prova", JSON.stringify({ i })]
    )) as { id: string }[];
    ids.push(linhas[0].id);
  }
  return ids;
}

describe("o que a verificação de `public` ainda acusa, e o que ela deixa passar", () => {
  test("LINHA APAGADA fica vermelha", async () => {
    const ids = await semearEventos(3);
    const { corte, antes } = await semearEFotografar();

    await sql().query(`delete from events where id = $1`, [ids[0]]);

    const depois = await inventarioDoSchema(banco.nome(), corte);
    const { perdas } = compararInventarios(antes, depois);

    expect(perdas.join(" | ")).toMatch(/events: linhas até o corte CAÍRAM de 3 para 2/);
    expect(perdas.length).toBeGreaterThan(0);
    // E a mesma perda continua sendo perda com o corte no lugar: a contagem que
    // caiu é das linhas ANTERIORES ao corte, não do total.
    expect(antes.linhas.events.n).toBe(3);
    expect(depois.linhas.events.n).toBe(2);
  });

  test("LINHA QUE VIROU OUTRA LINHA fica vermelha, mesmo com a contagem igual", async () => {
    const ids = await semearEventos(2);
    const { corte, antes } = await semearEFotografar();

    // A chave primária de uma linha velha passa a ser outra. A contagem não se
    // mexe — é justamente por isso que contar não basta, e a identidade precisa
    // entrar na conta.
    await sql().query(`update events set id = gen_random_uuid() where id = $1`, [ids[0]]);

    const depois = await inventarioDoSchema(banco.nome(), corte);
    const { perdas } = compararInventarios(antes, depois);

    expect(depois.linhas.events.n).toBe(antes.linhas.events.n);
    expect(perdas.join(" | ")).toMatch(/events: a IDENTIDADE das linhas até o corte mudou/);
  });

  test("TABELA SEM CHAVE PRIMÁRIA cai no lado estrito: qualquer alteração fica vermelha", async () => {
    // `login_attempts` não tem chave primária, e por isso a identidade dela é a
    // LINHA INTEIRA. Este caso existe para provar que a falta de chave leva ao
    // caso mais rígido, e não ao mais frouxo — que é o jeito de um instrumento
    // emudecer sem ninguém ver.
    await sql().query(`insert into login_attempts (ip) values ($1)`, ["203.0.113.7"]);
    const { corte, antes } = await semearEFotografar();
    expect(antes.linhas.login_attempts.chave).toEqual([
      "<linha inteira: tabela sem chave primária>",
    ]);

    await sql().query(`update login_attempts set ip = $1 where ip = $2`, [
      "203.0.113.8",
      "203.0.113.7",
    ]);

    const depois = await inventarioDoSchema(banco.nome(), corte);
    const { perdas } = compararInventarios(antes, depois);
    expect(perdas.join(" | ")).toMatch(/login_attempts: a IDENTIDADE das linhas até o corte mudou/);
  });

  test("O PREÇO: conteúdo de linha velha alterado NÃO fica mais vermelho", async () => {
    // As duas escritas abaixo são as que a PRODUÇÃO faz em linha velha, copiadas
    // dos arquivos de verdade: o `upsertContact` de lib/engine.ts:296, por onde
    // passa todo webhook de DM, e o registro de entrega de lib/queue-drain.ts:82.
    // Foram elas que deixaram este teste vermelho duas vezes sem relação nenhuma
    // com a mudança que estava sendo medida.
    await sql().query(
      `insert into contacts (account_id, ig_id, username, last_reply_at)
       values ($1, $2, $3, now())`,
      ["17800000000000042", "9900000000001", "contato_da_prova"]
    );
    const { corte, antes } = await semearEFotografar();

    await sql().query(
      `update contacts set username = $3, name = $4, last_reply_at = now()
        where account_id = $1 and ig_id = $2`,
      ["17800000000000042", "9900000000001", "contato_renomeado", "Contato Renomeado"]
    );

    const depois = await inventarioDoSchema(banco.nome(), corte);
    const { perdas, vida } = compararInventarios(antes, depois);

    // ESTE É O PREÇO, e ele está escrito como asserção e não só como comentário:
    // a linha MUDOU — a digital da linha inteira prova isso, e é exatamente ela
    // que a regra antiga usava para reprovar — e a verificação fica VERDE.
    expect(antes.linhas.contacts.digital).not.toBe(depois.linhas.contacts.digital);
    expect(perdas).toEqual([]);

    // Verde, mas não mudo: a divergência é dita em voz alta, no outro balde.
    expect(vida.join(" | ")).toMatch(/contacts: conteúdo de linha anterior ao corte mudou/);
    expect(vida.join(" | ")).toMatch(/name/);
    expect(vida.join(" | ")).toMatch(/username/);

    // E a identidade continua sendo a chave primária mais o carimbo, perguntada
    // ao catálogo do banco e não escrita numa lista à mão.
    expect(antes.linhas.contacts.chave).toEqual(["account_id", "ig_id", "first_contact_at"]);
  });

  test("LINHA NOVA, nascida depois do corte, continua não reprovando", async () => {
    const { corte, antes } = await semearEFotografar();
    await semearEventos(2);

    const depois = await inventarioDoSchema(banco.nome(), corte);
    const { perdas, vida } = compararInventarios(antes, depois);

    expect(perdas).toEqual([]);
    expect(depois.linhas.events.total).toBe(antes.linhas.events.total + 2);
    expect(depois.linhas.events.n).toBe(antes.linhas.events.n);
    expect(vida.join(" | ")).toMatch(/events: total de linhas/);
  });

  // Os dois casos que estragam a estrutura ficam por ÚLTIMO, e a ordem é parte
  // do arranjo: o vitest roda os casos de um arquivo na ordem em que estão
  // escritos, e o schema é um só por arquivo. O `afterAll` do harness derruba
  // tudo em seguida.
  test("COLUNA QUE SUMIU fica vermelha", async () => {
    const { corte, antes } = await semearEFotografar();

    await sql().query(`alter table events drop column payload`);

    const depois = await inventarioDoSchema(banco.nome(), corte);
    const { perdas } = compararInventarios(antes, depois);
    expect(perdas.join(" | ")).toMatch(/colunas que sumiram de teste_tmp_[a-z0-9_]+: events\.payload/);
  });

  test("TABELA QUE SUMIU fica vermelha", async () => {
    const { corte, antes } = await semearEFotografar();

    await sql().query(`drop table events`);

    const depois = await inventarioDoSchema(banco.nome(), corte);
    const { perdas } = compararInventarios(antes, depois);
    expect(perdas.join(" | ")).toMatch(/tabelas que sumiram de teste_tmp_[a-z0-9_]+: events/);
  });
});
