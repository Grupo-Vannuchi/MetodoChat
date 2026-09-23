import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSelectedAccount } from "@/lib/account";
import { isValidSession, SESSION_COOKIE } from "@/lib/auth";
import { diaDaChave } from "@/lib/dedupe";
import {
  recorteDaUrl,
  peneirar,
  csvDaListaDeEmail,
  nomeDoArquivo,
  type ContatoDaListaDeEmail,
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

  // Só quem tem e-mail: o arquivo existe para ser importado numa ferramenta
  // de e-mail, e linha sem e-mail lá não serve para nada. É ESTA LINHA que
  // separa este botão do outro — "Exportar todos os dados" leva todo contato do
  // recorte, tenha e-mail ou não.
  const comEmail = (await sql().query(
    // `username` E `name` VEM SEPARADOS, e nao so o `nome` colapsado: e o que
    // permite `casaComBusca` procurar pelos MESMOS tres campos que a tabela
    // procura. Com o coalesce sozinho, buscar pelo @ de alguem que TEM nome
    // falharia aqui e funcionaria na tela — duas buscas com o mesmo nome
    // devolvendo conjuntos diferentes.
    `select coalesce(nullif(c.name, ''), c.username) as nome,
            c.username, c.name, c.email, c.categoria
     from contacts c
     where c.account_id = $1 and c.email is not null
     order by c.first_contact_at desc`,
    [account.ig_user_id]
  )) as (ContatoDaListaDeEmail & {
    username: string | null;
    name: string | null;
    categoria: string | null;
  })[];

  // AS DUAS PENEIRAS, NA MESMA ORDEM DA TELA, e com as MESMAS funções que ela
  // usa — `contatosDoFiltro` e `casaComBusca`, por dentro de `peneirar`, e
  // nunca um `where`/`ilike` equivalente em SQL. Duas regras iguais escritas em
  // lugares diferentes são duas regras para manter iguais, e foi exatamente
  // assim que a tela e o arquivo divergiram. `contatosDoFiltro` também é a
  // única que trata o balde do nulo — `categoria = null` em SQL não casa
  // NINGUÉM, e a ficha "sem categoria" sairia vazia.
  const rows = peneirar(comEmail, recorte);

  const csv = csvDaListaDeEmail(rows);
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
