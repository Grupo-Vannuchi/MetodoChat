// A DECISÃO DE QUAIS MIGRAÇÕES RODAR — pura, e fora do script que fala com o
// banco.
//
// POR QUE ESTE ARQUIVO EXISTE, com a medição que o obrigou.
//
// Em 28/08/2026 dois builds de produção morreram assim, os dois exatamente aos
// 120 segundos, os dois no PRIMEIRO arquivo de migração:
//
//   MODO: APLICANDO (grava no banco)
//   PostgresError: canceling statement due to statement timeout   (57014)
//
// Nenhuma das seis migrações tinha o que fazer: todas já estavam aplicadas. O
// que matou o build foi a espera pela trava.
//
// A CAUSA É DO POSTGRES, E NÃO SE CONTORNA ESCREVENDO SQL MELHOR: `alter table
// ... if not exists` pega a trava EXCLUSIVA da tabela ANTES de descobrir que
// não há nada a fazer. Um único leitor parado numa transação aberta — no caso
// medido, um servidor de desenvolvimento apontando para o mesmo banco — segura
// `automations` e derruba qualquer deploy, mesmo o que não muda uma vírgula do
// esquema.
//
// Logo: a única defesa é NÃO RODAR O QUE JÁ RODOU. Num banco em dia, o deploy
// deixa de pedir trava porque deixa de executar DDL.
//
// POR QUE NÃO REAPROVEITAR A CONFERÊNCIA DE CATÁLOGO DE `migrar.mjs`:
//
// Aquele script já lê o catálogo do banco e confere colunas, chaves, tabelas e
// restrições — seria tentador decidir por ali. É armadilha, e o próprio script
// diz por quê: as listas `ESPERADAS*` são ESCRITAS À MÃO, e ficaram velhas uma
// vez (com `002` na pasta, ele imprimia "aplicada" para as duas e conferia só a
// coluna de `001`).
//
// Enquanto elas são a SEGUNDA OPINIÃO depois de aplicar, uma entrada esquecida
// custa conferir de menos — barulho a menos, nada quebrado. Se virassem a porta
// que decide aplicar, a mesma entrada esquecida faria uma migração NUNCA RODAR,
// em silêncio, e o deploy subiria contra um banco sem a coluna nova. Trocaríamos
// um build que falha alto por uma produção que falha baixo.
//
// Por isso são DUAS FONTES INDEPENDENTES decidindo COISAS DIFERENTES: o registro
// no banco decide o que rodar; o catálogo continua conferindo o que existe.

import { createHash } from "node:crypto";

/**
 * Só as linhas que RODAM, normalizadas.
 *
 * Duas coisas acontecem aqui, e a segunda é a que não é óbvia:
 *
 * 1. linhas de comentário e linhas vazias saem — era o que `migrar.mjs` já
 *    fazia em linha, para o ensaio a seco mostrar o comando em vez de despejar
 *    o comentário, que nestes arquivos é a maior parte;
 *
 * 2. `\r\n` vira `\n`. ISSO É OBRIGATÓRIO E FOI MEDIDO: o repositório tem
 *    `* text=auto` no `.gitattributes` e `core.autocrlf=true`, então o MESMO
 *    arquivo tem `\r\n` na máquina de quem desenvolve (Windows) e `\n` no build
 *    da Vercel (Linux). Conferido em `000-esquema-base.sql`: os bytes do disco
 *    e os bytes do git dão sha256 DIFERENTES. Sem esta normalização, a soma
 *    gravada por uma máquina discordaria da soma lida pela outra e o script
 *    acusaria "migração editada" em todo deploy — alarme falso que, repetido,
 *    ensina a ignorar o alarme.
 */
export function comandosDoArquivo(conteudo) {
  return String(conteudo)
    // A normalização vem ANTES do split, e não depois: assim nenhuma etapa
    // seguinte precisa saber que `\r` existe.
    .replace(/\r\n/g, "\n")
    .split("\n")
    // `startsWith("--")` sobre a linha JÁ APARADA: um comentário indentado é
    // comentário. E `--` no MEIO de uma linha não conta — aquela linha roda.
    .filter((l) => !l.trim().startsWith("--") && l.trim())
    .join("\n")
    .trim();
}

/**
 * A assinatura do que vai rodar.
 *
 * ASSINA OS COMANDOS, E NÃO O ARQUIVO CRU, de propósito: reescrever um
 * comentário de uma migração já aplicada é inofensivo e não deve acusar nada;
 * mexer numa linha de SQL não é, e tem de acusar. O que se promete não mudar é
 * o SQL que o banco recebeu.
 */
export function somaDoTexto(texto) {
  return createHash("sha256").update(String(texto), "utf8").digest("hex");
}

/**
 * O que rodar, o que pular, e o que é notícia.
 *
 * `arquivos` — `[{ nome, soma }]`, NA ORDEM DA PASTA.
 * `registro` — `[{ name, checksum }]`, como o banco devolveu, em qualquer ordem.
 *
 * Devolve:
 *   `aplicar`      nomes a rodar, NA ORDEM DOS ARQUIVOS
 *   `jaAplicadas`  nomes que o registro confirma, com a mesma assinatura
 *   `conflitos`    `[{ nome, registrada, atual }]` — aplicada, e depois editada
 *   `orfas`        nomes no registro sem arquivo na pasta
 *
 * A ORDEM DE `aplicar` É A DA PASTA, NUNCA A DO REGISTRO. O banco só chega ao
 * estado certo se `000` rodar antes de `001`, e o `order by` de quem leu o
 * registro não é contrato nenhum.
 */
export function decidirMigracoes(arquivos, registro) {
  const anotado = new Map((registro ?? []).map((r) => [r.name, r.checksum]));
  const aplicar = [];
  const jaAplicadas = [];
  const conflitos = [];

  for (const a of arquivos ?? []) {
    if (!anotado.has(a.nome)) {
      aplicar.push(a.nome);
      continue;
    }
    const registrada = anotado.get(a.nome);
    if (registrada === a.soma) {
      jaAplicadas.push(a.nome);
      continue;
    }
    // NÃO ENTRA EM `aplicar`, e essa é a decisão inteira deste ramo. Reaplicar
    // rodaria a versão NOVA do arquivo por cima de um banco que recebeu a
    // ANTIGA — e o resultado depende de qual DDL mudou, o que ninguém consegue
    // prever lendo o relatório. O certo é parar e alguém olhar.
    conflitos.push({ nome: a.nome, registrada, atual: a.soma });
  }

  const naPasta = new Set((arquivos ?? []).map((a) => a.nome));
  const orfas = (registro ?? []).map((r) => r.name).filter((n) => !naPasta.has(n));

  return { aplicar, jaAplicadas, conflitos, orfas };
}
