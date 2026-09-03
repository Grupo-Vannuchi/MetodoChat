import { NextRequest, NextResponse } from "next/server";
import { getSelectedAccount } from "@/lib/account";
import { isValidSession, SESSION_COOKIE } from "@/lib/auth";
import { problemaDoArquivo, textoDoProblema } from "@/lib/publicacao";
import type { ArquivoDeclarado, FormaDePublicacao } from "@/lib/publicacao";
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
// impede um AVI de 300 MB de ocupar o bucket é esta chamada, não a de lá.
//
// As duas usam a MESMA `problemaDoArquivo`, de propósito: duas validações
// escritas separado são duas regras para manter iguais, e elas divergem.
//
// E ESTA LINHA NÃO TEM TESTE QUE A ALCANCE — medido no plantio de 03/09,
// apagando a chamada daqui: lint, typecheck, os 1.081 testes puros, os 88 de
// integração e a varredura ficaram TODOS VERDES. Quem mexer nela não vai ser
// avisado por vermelho nenhum. O que fica embaixo dela é só o teto do próprio
// bucket (tamanho, e nada mais) e a recusa da Meta, que chega depois do upload
// inteiro. Está escrito aqui porque o próximo a passar precisa saber que a rede
// é curta.
//
// O QUE ELA NÃO É: prova de que o arquivo é o que diz ser. `mime`, `bytes`,
// `segundos` e as dimensões são DECLARADOS pelo navegador, e o servidor não vê
// os bytes para conferir. A barreira final de tamanho é o próprio bucket, que
// recusa o `PUT` acima do `file_size_limit`; a de conteúdo é a Meta, que recusa
// o contêiner. Esta rota corta cedo o que já dá para saber que não serve.

/** As quatro formas, escritas UMA vez, para a checagem de corpo vindo de fora. */
const FORMAS: readonly FormaDePublicacao[] = ["imagem", "reels", "story", "carrossel"];

/** Um número que veio de JSON e pode ser qualquer coisa. `undefined` quando não
 *  veio ou não é número — e não zero, que seria um arquivo de tamanho zero. */
function numeroOuNada(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined;
}

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

  let corpo: Record<string, unknown>;
  try {
    corpo = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Corpo invalido" }, { status: 400 });
  }

  const forma = corpo.forma as FormaDePublicacao;
  if (!FORMAS.includes(forma)) {
    return NextResponse.json({ error: "Forma de publicacao desconhecida" }, { status: 400 });
  }

  const nome = typeof corpo.nome === "string" ? corpo.nome : "";
  const mime = typeof corpo.mime === "string" ? corpo.mime : "";
  const bytes = numeroOuNada(corpo.bytes);
  if (!mime || bytes === undefined) {
    return NextResponse.json({ error: "Informe o tipo e o tamanho do arquivo" }, { status: 400 });
  }

  const arquivo: ArquivoDeclarado = {
    mime,
    bytes,
    segundos: numeroOuNada(corpo.segundos),
    largura: numeroOuNada(corpo.largura),
    altura: numeroOuNada(corpo.altura),
  };

  // O TETO É PERGUNTADO AO BUCKET, e nunca é constante. Ele está em 50 MB hoje
  // só porque o pagamento do plano atrasou, e vai subir sozinho quando entrar —
  // o porquê inteiro está em `tetoDoBucket` (lib/bucket.ts).
  const teto = await tetoDoBucket();

  const problema = problemaDoArquivo(forma, arquivo, teto);
  if (problema) {
    // A FRASE VEM DE `textoDoProblema`, e não é escrita aqui: ela é a mesma que
    // a tela mostra antes do upload, e duas redações do mesmo "não" fariam a
    // pessoa achar que são dois problemas.
    return NextResponse.json(
      { error: textoDoProblema(problema), problema, teto },
      { status: 400 }
    );
  }

  const caminho = caminhoDoObjeto(account.ig_user_id, nome);
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
