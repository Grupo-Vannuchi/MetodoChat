// A LINHA DO BANCO CHEGA INTEIRA NA EXPORTAÇÃO COMPLETA — o degrau que a rota
// não consegue provar sozinha.
//
// A ROTA COMEÇA EM `isValidSession`, E SESSÃO NÃO SE FORJA: nada desta base
// entra no handler de `app/api/contatos/csv-completo/route.ts`, e não é este
// arquivo que vai tentar. O que dá para medir sem forjar uma é o degrau logo
// abaixo dele — a PROJEÇÃO da consulta atravessando o driver de verdade e
// sendo lida por `contatoExportavelDaLinha`.
//
// POR QUE ISSO PRECISA DE BANCO, e não cabe num caso puro:
//
//   1. `contacts.campos` é `jsonb`. Se o driver o entregasse como TEXTO,
//      `lerCampos` (lib/campos.ts) devolveria registro VAZIO — ela recusa o que
//      não é objeto — e TODAS as colunas de campo livre sumiriam do arquivo, em
//      silêncio, que é exatamente o desfecho que o achado A6 descreve. Nenhum
//      caso puro pode dizer o que o driver entrega; ele monta o `jsonb` à mão.
//   2. `contatoExportavelDaLinha` PASSOU A LANÇAR quando uma coluna não vem, e
//      guarda nova que dispara por engano derruba o botão para gente de verdade,
//      em produção. Este arquivo é o que diz que ela NÃO dispara sobre a linha
//      que o Postgres devolve de fato.
//
// O `select` DAQUI É CÓPIA DO DA ROTA, e a limitação fica escrita em vez de
// vendida: se alguém tirar uma coluna de LÁ, este arquivo não acusa — ele mede
// o DRIVER, não a rota. Quem acusa a coluna que não veio é a própria
// `contatoExportavelDaLinha`, alto, no primeiro clique depois da edição; e os
// casos dela vivem em tests/exportacao-de-contatos.test.ts.
import { beforeAll, describe, expect, test } from "vitest";
import { bancoDescartavel } from "./harness";
import {
  contatoExportavelDaLinha,
  csvCompletoDeContatos,
} from "@/lib/exportacao-de-contatos";

const banco = bancoDescartavel();

const CONTA = "17800000000000999";

// A MESMA PROJEÇÃO DA ROTA. Ver o comentário do topo sobre o que isto mede e o
// que não mede.
const PROJECAO_DA_ROTA = `select c.username, c.name, c.email, c.categoria, c.campos
     from contacts c
     where c.account_id = $1
     order by c.first_contact_at desc`;

let linhas: Record<string, unknown>[];

beforeAll(async () => {
  // DUAS LINHAS, E AS DUAS PONTAS: uma com tudo preenchido (inclusive um campo
  // livre, que é a coluna que esta tarefa criou) e uma com todas as colunas
  // opcionais nulas — porque coluna PRESENTE E NULA é o normal desta tabela, e
  // não pode ser confundida com coluna ausente.
  // O `campos` É MONTADO POR `jsonb_build_object`, COMO O MOTOR MONTA
  // (`gravarCampo`, lib/engine.ts) — e não por um `JSON.stringify` passado como
  // parâmetro. A diferença não é estilo, e foi MEDIDA ao escrever este arquivo:
  // o driver serializa o parâmetro para `jsonb` sozinho, então uma string já
  // codificada vira um jsonb que é um TEXTO (`"{\"qual_sua_cidade\":…}"`), e na
  // volta ela chega como `string`. `lerCampos` recusa o que não é objeto, e a
  // coluna do campo livre sumiria do arquivo — verde por semear errado, que é o
  // verde mais caro que existe. Semear como o motor grava é o que faz este caso
  // falar da linha de produção.
  await banco.db().sql().query(
    `insert into contacts (account_id, ig_id, username, name, email, categoria, campos, last_reply_at)
     values ($1, 'ig-cheia', 'ana.cheia', 'Ana Souza', 'ana@email.com', 'aluno',
             jsonb_build_object($2::text, jsonb_build_object('valor', $3::text, 'em', $4::text)),
             now())`,
    [CONTA, "qual_sua_cidade", "Osasco", "2026-09-01T12:00:00.000Z"]
  );
  // A SEGUNDA NÃO DECLARA `campos`: a coluna é NOT NULL com `'{}'` de padrão
  // (migrations/011), e é assim que nasce todo contato que nunca respondeu a um
  // pedido de dado. O registro vazio é o normal, não a exceção.
  await banco.db().sql().query(
    `insert into contacts (account_id, ig_id, username, name, email, categoria, last_reply_at)
     values ($1, 'ig-vazia', 'bia.vazia', null, null, null, now())`,
    [CONTA]
  );
  linhas = (await banco.db().sql().query(PROJECAO_DA_ROTA, [CONTA])) as Record<
    string,
    unknown
  >[];
});

describe("a linha que o driver devolve", () => {
  test("tem as cinco colunas, e a leitura da exportação a aceita", () => {
    expect(linhas).toHaveLength(2);
    for (const linha of linhas) {
      expect(
        () => contatoExportavelDaLinha(linha),
        "a guarda de coluna ausente não pode disparar sobre a linha REAL — se " +
          "disparar, o botão de exportar passa a dar erro para gente de verdade"
      ).not.toThrow();
    }
  });

  // O CASO QUE MEDE O `jsonb` DE VERDADE. Com o driver entregando texto no
  // lugar de objeto, `lerCampos` devolve registro vazio e a coluna do campo
  // livre desaparece do cabeçalho — calada, que é a forma cara do defeito.
  test("o `jsonb` de `campos` vira coluna de campo livre no arquivo", () => {
    const csv = csvCompletoDeContatos(linhas.map(contatoExportavelDaLinha));
    const [cabecalho, ...corpo] = csv.replace(/^﻿/, "").split("\r\n");
    const i = cabecalho.split(";").indexOf("qual_sua_cidade");
    expect(
      i,
      `o campo livre gravado em \`contacts.campos\` tem de virar coluna. ` +
        `Cabeçalho que saiu: ${cabecalho}`
    ).toBeGreaterThan(-1);
    expect(corpo.map((l) => l.split(";")[i])).toContain("Osasco");
  });

  // A queda do e-mail e a coluna da categoria atravessando o driver: é o mesmo
  // arquivo, mas a garantia aqui é que os tipos do Postgres (`text` nulo) não
  // viram "null" na planilha.
  test("coluna nula do banco vira célula vazia, e não o texto 'null'", () => {
    const csv = csvCompletoDeContatos(linhas.map(contatoExportavelDaLinha));
    expect(csv).not.toContain(";null");
  });
});
