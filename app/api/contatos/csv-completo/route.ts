import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSelectedAccount } from "@/lib/account";
import { isValidSession, SESSION_COOKIE } from "@/lib/auth";
import { diaDaChave } from "@/lib/dedupe";
import {
  recorteDaUrl,
  peneirar,
  csvCompletoDeContatos,
  nomeDoArquivo,
  type ContatoExportavel,
} from "@/lib/exportacao-de-contatos";

// "EXPORTAR TODOS OS DADOS" — o segundo botão, e o que ele leva.
//
// SÃO DOIS BOTÕES SEPARADOS, por decisão do dono: "Exportar CSV" (a rota vizinha,
// `../csv`) continua sendo A LISTA DE E-MAIL, com duas colunas e só quem tem
// e-mail, e o CONTEÚDO dele não muda. Este leva TODO contato do recorte, tenha
// e-mail ou não, com as colunas do catálogo (lib/campos.ts) e os campos livres
// que o próprio marketing nomeou.
//
// O QUE OS DOIS COMPARTILHAM, ALÉM DAS PENEIRAS, é a neutralização de fórmula
// de planilha: ela mora dentro da `cell` do módulo, então nenhum dos dois
// arquivos pode ganhar ou perder a proteção sozinho. As colunas deste aqui são
// as mais expostas — a resposta do campo livre é texto que o lead digitou numa
// DM, e o arquivo é aberto com dois cliques na máquina do marketing.
//
// ESTA ROTA É CASCA FINA, E ISSO É A DECISÃO ESTRUTURAL DA TAREFA. O handler
// começa em `isValidSession`, e sessão não se forja: nada que more aqui dentro
// pode ter teste de integração. Então aqui só ficam as quatro coisas que
// PRECISAM de servidor — autenticar, achar a conta, consultar, devolver — e
// tudo o que DECIDE o arquivo (as peneiras, as colunas, a ordem, cada célula)
// mora em `lib/exportacao-de-contatos.ts`, que é puro e tem caso. Numa base em
// que plantio já derrubou mais de dez guardas órfãs nesta funcionalidade, o que
// nasce aqui dentro nasce sem rede nenhuma.

export async function GET(req: NextRequest) {
  if (!isValidSession(req.cookies.get(SESSION_COOKIE)?.value)) {
    return new NextResponse("unauthorized", { status: 401 });
  }
  const account = await getSelectedAccount();
  if (!account) {
    return NextResponse.json({ error: "Conecte o Instagram primeiro" }, { status: 400 });
  }

  // O MESMO RECORTE DO OUTRO BOTÃO, lido pela MESMA função — e o botão da tela
  // o escreve por `urlDaExportacao`, que é a outra ponta dela. É o que impede
  // este botão de nascer repetindo o defeito de 11/09/2026 (o link levava a
  // categoria e esquecia a busca, e a frase da tela discordava do arquivo).
  const recorte = recorteDaUrl(req.nextUrl.searchParams);

  // SEM `where c.email is not null`, e é isso que distingue este arquivo do
  // outro: quem interagiu e nunca deu e-mail pode ter dado telefone, cidade ou
  // qualquer campo que a automação tenha perguntado.
  //
  // `username`, `name` e `email` vêm separados porque `casaComBusca` procura
  // pelos MESMOS três campos que a tabela da tela procura; `categoria` porque é
  // por ela que `contatosDoFiltro` peneira; `campos` é o `jsonb` cru, lido por
  // `lerCampos` dentro do módulo. `account_id` fecha a consulta na conta
  // selecionada, como toda consulta desta base.
  //
  // A ORDEM É A DA TELA (`first_contact_at desc`), a mesma das duas tabelas e a
  // mesma do outro botão: a planilha sai na ordem em que o dono acabou de ver
  // as pessoas.
  const todos = (await sql().query(
    `select c.username, c.name, c.email, c.categoria, c.campos
     from contacts c
     where c.account_id = $1
     order by c.first_contact_at desc`,
    [account.ig_user_id]
  )) as ContatoExportavel[];

  // AS DUAS PENEIRAS, NA MESMA ORDEM DA TELA E COM AS MESMAS FUNÇÕES —
  // `contatosDoFiltro` e `casaComBusca`, por dentro de `peneirar`. Nunca um
  // `where`/`ilike` equivalente em SQL: duas regras iguais escritas em lugares
  // diferentes são duas regras para manter iguais.
  const csv = csvCompletoDeContatos(peneirar(todos, recorte));

  // O PREFIXO `contatos-` separa este arquivo do `emails-` na pasta de
  // downloads — os dois botões exportam recortes diferentes da mesma tela, e
  // dois arquivos de nome idêntico não teriam como ser distinguidos sem abrir.
  // Brasília, não UTC: exportar às 22h nomeava o arquivo com a data de amanhã.
  const nome = nomeDoArquivo(
    "contatos",
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
