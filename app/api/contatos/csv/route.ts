import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSelectedAccount } from "@/lib/account";
import { isValidSession, SESSION_COOKIE } from "@/lib/auth";
import { diaDaChave } from "@/lib/dedupe";
import {
  recorteDaUrl,
  recortarTela,
  linhaDaListaDeEmail,
  listaDeEmailDaTela,
  csvDaListaDeEmail,
  nomeDoArquivo,
} from "@/lib/exportacao-de-contatos";

// A LISTA DE E-MAIL — e o CONTEÚDO deste arquivo não muda, por decisão do dono.
//
// O que ele monta continua sendo exatamente o que sempre montou: duas colunas
// (Nome, E-mail), só quem tem e-mail, separador ";" e BOM de UTF-8. O que
// mudou foi ONDE isso é decidido: a montagem, o escape, o nome do arquivo e as
// duas peneiras saíram daqui para `lib/exportacao-de-contatos.ts`, que é puro e
// tem caso — inclusive um que compara os BYTES deste arquivo.
//
// A ÚNICA EXCEÇÃO À PROMESSA DE BYTE, e ela é do dono: a neutralização de
// fórmula de planilha (`neutralizarFormula`, no módulo). O nome do perfil vem
// de DM do Instagram, e um nome que começa com `=` é executado pelo Excel ao
// abrir o arquivo na máquina do marketing. A restrição do dono era sobre
// CONTEÚDO — quais contatos, quais colunas —, e ela cede aqui; os dois arquivos
// neutralizam pela MESMA `cell`, porque tratar o mesmo dado de dois jeitos era
// o defeito maior. Só muda a linha cujo nome começa com `=`, `+`, `-`, `@`,
// TAB ou CR.
//
// A MUDANÇA É JUSTAMENTE O QUE PRENDE A PROMESSA. Este handler começa em
// `isValidSession`, e sessão não se forja: teste de integração nenhum alcança o
// que vem depois. Enquanto o conteúdo do arquivo era montado aqui dentro,
// "não muda nem um byte" era uma frase sem ninguém conferindo — e é por haver
// quem confira que a exceção de segurança acima pôde ser feita de propósito, e
// medida, em vez de acontecer calada. O botão novo ("Exportar todos os dados",
// app/api/contatos/csv-completo/route.ts) reusa a mesma `cell` em vez de copiá-la.
//
// -----------------------------------------------------------------------------
// A PARTE 2 / PASSO 1 MUDOU DE ONDE O E-MAIL SAI, E NÃO O QUE O ARQUIVO É.
//
// Duas colunas, os mesmos cabeçalhos, o mesmo separador, o mesmo BOM, a mesma
// ordem (`first_contact_at desc`) e as mesmas duas peneiras. `csvDaListaDeEmail`
// não mudou uma linha, e o caso que compara os BYTES dela continua exatamente
// como estava. O que mudou é que "o e-mail desta pessoa" deixou de ser a coluna
// `contacts.email` e passou a ser a pergunta de `emailDoContato` — registro
// primeiro, coluna na falta dele —, a MESMA que a tela, a ficha da conversa e a
// DM enviada já faziam.
//
// ONDE O CONTEÚDO PODE MUDAR, DITO SEM ENFEITE, porque "deveria dar igual" é o
// tipo de suposição que esta base pune. Hoje coluna e registro estão em
// sincronia (a `012` copiou o que havia; `gravarCampo` escreve nos dois), então
// para todo contato com e-mail de verdade o arquivo sai idêntico. As linhas que
// podem mudar são as que a coluna aceita e ninguém chamaria de e-mail:
//
//   coluna `''` ou só de espaço  →  SAI do arquivo. Antes entrava, com a célula
//                                   de e-mail em branco, numa lista que existe
//                                   para ser importada numa ferramenta de
//                                   e-mail. A tela já as contava como ZERO.
//   coluna com espaço nas pontas →  sai APARADA, porque a regra apara.
//
// Nos dois casos o arquivo deixa de discordar do resto do produto, e a régua não
// foi inventada agora: é a mesma da migração `012` (`btrim(email) <> ''`).

export async function GET(req: NextRequest) {
  if (!isValidSession(req.cookies.get(SESSION_COOKIE)?.value)) {
    return new NextResponse("unauthorized", { status: 401 });
  }
  const account = await getSelectedAccount();
  if (!account) {
    return NextResponse.json({ error: "Conecte o Instagram primeiro" }, { status: 400 });
  }

  // O ARQUIVO SEGUE O FILTRO DA TELA, e esta é a correção de uma regressão.
  //
  // O botão "Exportar CSV" vive DENTRO da seção "Com e-mail", debaixo da frase
  // que conta o filtro ("3 pessoas — prontas para sua lista"). Enquanto a rota
  // ignorava `?categoria=`, quem filtrava por "aluno", lia 3 e clicava, baixava
  // os e-mails da CONTA INTEIRA — com "interessado" e "ex-aluno" dentro. A
  // frase e o botão diziam coisas diferentes sobre o mesmo clique.
  //
  // A ESCOLHA FOI RESPEITAR O FILTRO, e não avisar que exporta tudo: o botão
  // está dentro da seção filtrada, embaixo do número filtrado, e é ali que ele
  // é lido. Um aviso deixaria o dono com o filtro na tela e nenhuma maneira de
  // exportar o recorte que ele acabou de fazer — que é justamente para o que a
  // categoria existe. Sem parâmetro nenhum (`/api/contatos/csv`, o link de
  // `/contatos` sem filtro) o comportamento é o mesmo de sempre: a conta
  // inteira.
  //
  // E A BUSCA TAMBEM, pelo MESMO argumento. O DEFEITO, achado por revisao em
  // 11/09/2026: com `categoria=aluno` (40 com e-mail) e busca "maria", a tela
  // dizia "1 pessoa — pronta para sua lista" e o botao logo abaixo baixava os 40
  // e-mails.
  //
  // AS DUAS CHEGAM JUNTAS, num tipo só (`recorteDaUrl`), e isso não é arrumação:
  // enquanto a categoria era lida por uma função e a busca por outra linha, o
  // botão NOVO podia nascer lendo só metade. O mesmo `Recorte` é o que a tela
  // escreve no link (`urlDaExportacao`), e o caso de ida-e-volta em
  // tests/exportacao-de-contatos.test.ts liga as duas pontas.
  const recorte = recorteDaUrl(req.nextUrl.searchParams);

  // O `where c.email is not null` SAIU DAQUI, e a saída é o Passo 1 da Parte 2.
  //
  // ELE ERA UMA SEGUNDA REGRA SOBRE QUEM TEM E-MAIL, e a partir do momento em
  // que a fonte passa a ser o registro ele não tem como ser a mesma que a tela
  // aplica: a coluna pode estar vazia para quem tem o e-mail COLETADO (o estado
  // que o Passo 2 cria para todo mundo), e o `where` deixaria essa pessoa de
  // fora do arquivo enquanto a seção "Com e-mail" — que é onde este botão MORA,
  // embaixo do número dela — a contaria dentro. É o defeito de 11/09/2026 por
  // uma porta nova: a frase e o botão falando de conjuntos diferentes.
  //
  // E AS DUAS JÁ DISCORDAVAM, ANTES DESTA TAREFA — medido em 25/09/2026 contra
  // o Postgres de teste, com as quatro formas que a coluna aceita (ela não tem
  // `check` de conteúdo, como a migração `012` registra):
  //
  //   coluna `''`        passava no `where`  →  entrava no arquivo, com a célula
  //                                             de e-mail EM BRANCO
  //   coluna `'   '`     passava no `where`  →  idem
  //   e as duas caíam fora do `filter(c => c.email)` da tela, que contava ZERO
  //
  // Ou seja: o arquivo do marketing já levava linhas que a tela dizia não
  // existir. Regra com dois donos é O defeito desta base, e esta era uma delas
  // de pé há semanas, calada, porque ninguém compara SQL com JS.
  //
  // A PENEIRA AGORA É UMA SÓ, EM JS, e é a MESMA da tela: `temEmail`, por dentro
  // de `recortarTela`. A régua que ela usa ("valor aparado não vazio") também
  // não é nova — é a que a própria migração `012` escolheu quando peneirou com
  // `btrim(email) <> ''`, com o motivo escrito lá: "é o que separa TEM E-MAIL de
  // TEM A COLUNA PREENCHIDA".
  //
  // O QUE ISTO CUSTA, ESCRITO: a consulta passa a trazer a conta INTEIRA em vez
  // de só quem tem e-mail. É o mesmo custo que `/contatos` já paga, pela mesma
  // razão e com o mesmo tamanho (127 contatos, a maior conta com 106) — e o
  // comentário da consulta de lá explica por que contar em SQL não serve quando
  // quem decide é uma função de JS. Trocar isso por um `where` que soubesse ler
  // `campos` seria escrever a regra pela TERCEIRA vez, agora em jsonb.
  const todos = (await sql().query(
    // `username` E `name` VEM SEPARADOS, e nao so o `nome` colapsado: e o que
    // permite `casaComBusca` procurar pelos MESMOS tres campos que a tabela
    // procura. Com o coalesce sozinho, buscar pelo @ de alguem que TEM nome
    // falharia aqui e funcionaria na tela — duas buscas com o mesmo nome
    // devolvendo conjuntos diferentes.
    //
    // `c.campos` ENTROU COM O PASSO 1: é de lá que sai o e-mail que vale. Sem
    // ela o arquivo inteiro volta a sair da coluna antiga, em silêncio — e o
    // `as` NÃO pega isso, medido em 25/09/2026 (tsc verde, 1884 casos verdes).
    // Quem pega é `linhaDaListaDeEmail`, logo abaixo, e alto.
    `select coalesce(nullif(c.name, ''), c.username) as nome,
            c.username, c.name, c.email, c.campos, c.categoria
     from contacts c
     where c.account_id = $1
     order by c.first_contact_at desc`,
    [account.ig_user_id]
  )) as Record<string, unknown>[];

  // A TELA INTEIRA, PELA MESMA `recortarTela` QUE `app/contatos/page.tsx` CHAMA.
  //
  // AS DUAS PENEIRAS CONTINUAM SENDO AS MESMAS — `contatosDoFiltro` e
  // `casaComBusca`, por dentro de `peneirar`, e nunca um `where`/`ilike`
  // equivalente em SQL. `contatosDoFiltro` também é a única que trata o balde do
  // nulo: `categoria = null` em SQL não casa NINGUÉM, e a ficha "sem categoria"
  // sairia vazia.
  //
  // O QUE MUDOU É QUE O CORTE VEM JUNTO. Antes a rota peneirava (JS) sobre um
  // conjunto que o banco já tinha cortado (SQL); agora ela deriva a tela toda e
  // o arquivo É `tela.comEmail` — literalmente o conjunto que a frase da seção
  // conta, e não um conjunto parecido montado por outro caminho.
  const tela = recortarTela(todos.map(linhaDaListaDeEmail), recorte.filtro, recorte.busca);

  // `listaDeEmailDaTela` RECEBE O OBJETO, e não um conjunto solto: é o que tira
  // desta rota a escolha de qual conjunto mandar — a mesma disciplina, e o mesmo
  // defeito medido, da faixa de exportar (app/contatos/faixa-da-exportacao.tsx).
  const csv = csvDaListaDeEmail(listaDeEmailDaTela(tela));
  // Brasília, não UTC: exportar às 22h nomeava o arquivo com a data de amanhã.
  const nome = nomeDoArquivo(
    "emails",
    account.username ?? account.ig_user_id,
    recorte.filtro,
    diaDaChave(new Date())
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nome}"`,
    },
  });
}
