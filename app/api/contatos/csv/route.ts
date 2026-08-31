import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSelectedAccount } from "@/lib/account";
import { isValidSession, SESSION_COOKIE } from "@/lib/auth";
import { diaDaChave } from "@/lib/dedupe";
import { filtroDaUrl, contatosDoFiltro } from "@/lib/categorias";

// Exporta os contatos da conta selecionada. Separador ";" e BOM de UTF-8
// porque é assim que o Excel em português abre o arquivo com acento certo,
// sem passar pelo assistente de importação.
const SEP = ";";

function cell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /["\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * O apelido do recorte no NOME do arquivo.
 *
 * Sem ele, exportar "aluno" e depois "interessado" deixa dois arquivos de nome
 * idêntico na pasta de downloads, e não há como saber qual é qual sem abrir.
 *
 * Vira ASCII, e só aqui: a categoria em si guarda o acento de propósito
 * (`normalizarCategoria`, lib/categorias.ts — "é nome que gente lê"). O que não
 * cabe é no `Content-Disposition`, cujo nome entre aspas é ASCII — e onde uma
 * aspa ou um ponto e vírgula digitados na categoria quebrariam o cabeçalho.
 */
function apelidoDoRecorte(nome: string | null): string {
  const limpo = (nome ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return limpo || "sem-categoria";
}

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
  const filtro = filtroDaUrl(req.nextUrl.searchParams.get("categoria") ?? undefined);

  // Só quem tem e-mail: o arquivo existe para ser importado numa ferramenta
  // de e-mail, e linha sem e-mail lá não serve para nada.
  const comEmail = (await sql().query(
    `select coalesce(nullif(c.name, ''), c.username) as nome, c.email, c.categoria
     from contacts c
     where c.account_id = $1 and c.email is not null
     order by c.first_contact_at desc`,
    [account.ig_user_id]
  )) as { nome: string | null; email: string; categoria: string | null }[];

  // O MESMO `contatosDoFiltro` que a lista usa, e não um `where` equivalente:
  // duas regras iguais escritas em lugares diferentes são duas regras para
  // manter iguais, e foi exatamente assim que a tela e o arquivo divergiram.
  // Ela também é a única que trata o balde do nulo — `categoria = null` em SQL
  // não casa NINGUÉM, e a ficha "sem categoria" sairia vazia.
  //
  // NÃO HÁ TESTE DE INTEGRAÇÃO DESTA ROTA porque ele exigiria uma sessão
  // (`isValidSession`, na primeira linha do handler), e sessão não se forja. O
  // que dava para prender puro está preso: `contatosDoFiltro` e o link que este
  // botão carrega (`urlComFiltro`) têm caso em tests/categorias.test.ts.
  const rows = contatosDoFiltro(comEmail, filtro);

  const linhas = [
    ["Nome", "E-mail"],
    ...rows.map((r) => [r.nome ?? "", r.email]),
  ];

  const csv = "﻿" + linhas.map((l) => l.map(cell).join(SEP)).join("\r\n");
  // Brasília, não UTC: exportar às 22h nomeava o arquivo com a data de amanhã.
  const hoje = diaDaChave(new Date());
  const recorte = filtro.tipo === "tudo" ? "" : `-${apelidoDoRecorte(filtro.nome)}`;
  const nome = `emails-${account.username ?? account.ig_user_id}${recorte}-${hoje}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nome}"`,
    },
  });
}
