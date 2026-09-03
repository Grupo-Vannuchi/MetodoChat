import { NextRequest, NextResponse } from "next/server";
import { getSelectedAccount } from "@/lib/account";
import { isValidSession, SESSION_COOKIE } from "@/lib/auth";
import { decisaoDeAssinatura } from "@/lib/publicacao";
import { caminhoDoObjeto, tetoDoBucket, urlAssinadaDeUpload, urlPublicaDoObjeto } from "@/lib/bucket";

// A PORTA QUE ENTREGA AO NAVEGADOR A PERMISSÃO DE SUBIR UM ARQUIVO.
//
// Ela existe porque o arquivo NÃO pode passar por aqui: a Vercel recusa corpo
// acima de 4,5 MB e um reels vai a 300 MB (medido, ver `lib/bucket.ts`). Então
// esta rota não recebe mídia — ela recebe a DESCRIÇÃO da mídia, decide se ela
// serve, e devolve uma URL assinada que vale para um caminho só, por 2 horas.
//
// =============================================================================
// A VALIDAÇÃO AQUI É A SEGUNDA BARREIRA, NÃO A PRIMEIRA.
//
// O navegador valida antes (Tarefa 5) para dar mensagem boa e não gastar o
// upload; o servidor valida porque O NAVEGADOR É DO USUÁRIO. Quem quiser pode
// chamar esta rota direto, com `bytes` inventado ou `mime` mentido — e o que
// impede um AVI de 300 MB de ocupar o bucket é `decisaoDeAssinatura`
// (lib/publicacao.ts), não esta rota.
//
// A DECISÃO SAIU DA FIAÇÃO — medido no plantio de 03/09/2026: apagar a
// VALIDAÇÃO inteira de dentro desta rota passava por lint, typecheck, os 1.081
// testes puros, os 88 de integração e a varredura, TODOS VERDES. A rota não
// tinha rede nenhuma, e não podia ganhar uma: ela exige cookie de sessão, e
// forjar cookie é proibido nesta base (ver o cabeçalho de
// `testes-integracao/semear-requisicao.ts`). O conserto foi o mesmo que
// `lib/webhook-messaging.ts` já tinha feito para a porta do webhook: a decisão
// sobre o corpo virou `decisaoDeAssinatura`, função pura, com caso para cada
// saída — ela é a rede, e mora em `tests/publicacao.test.ts`.
//
// O QUE ISTO MUDOU DE VERDADE, E O QUE NÃO MUDOU. Antes, apagar a VALIDAÇÃO
// (as checagens e a chamada a `problemaDoArquivo`) não deixava nada vermelho.
// Agora, apagar a REGRA — editar dentro de `decisaoDeAssinatura` — deixa,
// porque ela tem teste direto. Mas apagar a CHAMADA a `decisaoDeAssinatura`
// bem daqui de baixo continua SEM deixar nada vermelho: esta rota, como a do
// webhook, continua sem rede própria — o que ela tem de rede é a que a função
// pura carrega.
//
// As duas usam a MESMA `decisaoDeAssinatura`, de propósito: duas validações
// escritas separado são duas regras para manter iguais, e elas divergem.
//
// O QUE FICA EMBAIXO DELA é só o teto do próprio bucket (tamanho, e nada mais)
// e a recusa da Meta, que chega depois do upload inteiro.
//
// O QUE ELA NÃO É: prova de que o arquivo é o que diz ser. `mime`, `bytes`,
// `segundos` e as dimensões são DECLARADOS pelo navegador, e o servidor não vê
// os bytes para conferir. A barreira final de tamanho é o próprio bucket, que
// recusa o `PUT` acima do `file_size_limit`; a de conteúdo é a Meta, que recusa
// o contêiner. Esta rota corta cedo o que já dá para saber que não serve.

export async function POST(req: NextRequest) {
  if (!isValidSession(req.cookies.get(SESSION_COOKIE)?.value)) {
    return new NextResponse("unauthorized", { status: 401 });
  }

  // A CONTA SAI DO COOKIE DE SELEÇÃO, e NÃO do corpo da requisição. Deixar o
  // navegador dizer para qual conta o arquivo vai seria a mesma porta que
  // `alvoDoLote` fecha no envio: o post da conta A saindo pela conta B, aqui na
  // forma de um arquivo escrito na pasta de outro dono.
  const account = await getSelectedAccount();
  if (!account) {
    return NextResponse.json({ error: "Conecte o Instagram primeiro" }, { status: 400 });
  }

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo invalido" }, { status: 400 });
  }

  // O TETO É PERGUNTADO AO BUCKET, e nunca é constante. Ele está em 50 MB hoje
  // só porque o pagamento do plano atrasou, e vai subir sozinho quando entrar —
  // o porquê inteiro está em `tetoDoBucket` (lib/bucket.ts).
  const teto = await tetoDoBucket();

  const decisao = decisaoDeAssinatura(corpo, teto);
  if (!decisao.ok) {
    // `teto` só volta junto quando a recusa veio de `problemaDoArquivo` — é o
    // que `decisao.problema` marca. As outras recusas (forma, mime, bytes) não
    // levavam `teto` antes, e continuam sem levar.
    return NextResponse.json(
      decisao.problema !== undefined
        ? { error: decisao.erro, problema: decisao.problema, teto }
        : { error: decisao.erro },
      { status: decisao.status }
    );
  }

  const caminho = caminhoDoObjeto(account.ig_user_id, decisao.nome);
  try {
    const { url, token } = await urlAssinadaDeUpload(caminho);
    // A URL PÚBLICA VOLTA JUNTO porque é ela que a Meta vai buscar depois, e
    // montá-la de novo na tela seria a segunda cópia da mesma regra.
    return NextResponse.json({ caminho, url, token, publica: urlPublicaDoObjeto(caminho), teto });
  } catch (err) {
    // A mensagem do Supabase passa, a chave não — `lib/bucket.ts` nunca a põe
    // no texto do erro, e é por isso que este `message` pode ir para a tela.
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "erro" },
      { status: 502 }
    );
  }
}
