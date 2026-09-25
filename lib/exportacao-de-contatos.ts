// O QUE DECIDE O ARQUIVO CSV — os dois botões de exportar, num módulo PURO.
//
// MÓDULO PURO, e sem `server-only` de propósito, pela mesma disciplina de
// `lib/campos.ts` e `lib/categorias.ts`: a suíte padrão (vitest.config.ts) não
// tem banco nem DOM, e é ali que este arquivo precisa rodar.
//
// E AQUI A PUREZA NÃO É ESTILO, É A ÚNICA REDE POSSÍVEL. As duas rotas de
// exportação (`app/api/contatos/csv/route.ts` e
// `app/api/contatos/csv-completo/route.ts`) começam em `isValidSession`, e
// sessão não se forja: nenhum teste de integração desta base alcança o que elas
// fazem depois dessa linha. O comentário da rota antiga já dizia isso, e o que
// ele descrevia como "o que dava para prender puro está preso" era pouco — o
// conteúdo do arquivo não estava preso em lugar nenhum. Com tudo o que DECIDE o
// arquivo aqui dentro, a rota vira casca: autentica, consulta, peneira, chama,
// devolve.
//
// -----------------------------------------------------------------------------
// SÃO DOIS BOTÕES, E O ANTIGO NÃO MUDA — decisão do dono.
//
//   "Exportar CSV" (seção "Com e-mail") é A LISTA DE E-MAIL: duas colunas, só
//     quem tem e-mail, e o CONTEÚDO dele — quais contatos, quais colunas — não
//     muda nem um byte. `csvDaListaDeEmail`, abaixo, é a MONTAGEM daquele
//     arquivo, e o caso byte a byte de tests/exportacao-de-contatos.test.ts é a
//     única coisa nesta base capaz de acusar uma mudança nela;
//     `listaDeEmailDaTela` é o CONTEÚDO — quem entra e com que e-mail — e tem o
//     caso byte a byte do arquivo inteiro, do recorte ao CSV.
//     A EXCEÇÃO, DECIDIDA PELO DONO DEPOIS, é a neutralização de fórmula
//     (`neutralizarFormula`): ela muda os bytes da linha cujo nome COMEÇA com
//     `=`, `+`, `-`, `@`, TAB ou CR, e vale para os dois arquivos pela MESMA
//     função — o porquê está escrito nela.
//     "QUEM TEM E-MAIL" DEIXOU DE SER `where c.email is not null`, e a troca é
//     o Passo 1 da Parte 2: o corte é `temEmail`, em JS, o mesmo da seção da
//     tela onde este botão mora — ver o que saiu da rota, com a medição, em
//     app/api/contatos/csv/route.ts.
//   "Exportar todos os dados" leva TODO contato do recorte, tenha e-mail ou
//     não, com as colunas do catálogo (lib/campos.ts) e os campos livres que o
//     próprio marketing nomeou. `csvCompletoDeContatos`.
//
// OS DOIS RESPEITAM AS MESMAS DUAS PENEIRAS (`peneirar`) e montam o link pela
// MESMA função (`urlDaExportacao`). Duas regras iguais escritas em lugares
// diferentes são duas regras para manter iguais, e foi assim que a tela e o
// arquivo divergiram em 11/09/2026.

import { CAMPOS, lerCampos, type Campo } from "./campos";
import {
  VARIABLES,
  valorDaVariavel,
  type VariableContext,
  type VariableDef,
} from "./variables";
import {
  casoDaListaDeEmail,
  contatosDoFiltro,
  filtroDaUrl,
  urlComFiltro,
  type CasoDaListaDeEmail,
  type FiltroDeCategoria,
} from "./categorias";
import { casaComBusca, normalizarBusca, type ContatoBuscavel } from "./busca-de-contatos";

// -----------------------------------------------------------------------------
// A MECÂNICA DO ARQUIVO — separador, BOM e escape.
//
// Separador ";" e BOM de UTF-8 porque é assim que o Excel em português abre o
// arquivo com acento certo, sem passar pelo assistente de importação. Isto
// morava dentro da rota antiga e foi trazido para cá INTEIRO, e não copiado:
// uma segunda `cell` num segundo arquivo seria duas regras de escape para
// manter iguais — e a que divergisse produziria planilha torta em silêncio.

export const SEP = ";";
const BOM = "﻿";
// `\r\n` e não `\n`: é o fim de linha que o Excel espera num arquivo que ele
// abre com dois cliques.
const FIM_DE_LINHA = "\r\n";

/**
 * O PRIMEIRO CARACTERE QUE FAZ A PLANILHA EXECUTAR A CÉLULA.
 *
 * `=`, `+`, `-` e `@` abrem fórmula no Excel e no Google Sheets. TAB e CR na
 * frente entram na lista porque alguns leitores os descartam ANTES de decidir o
 * que a célula é, e aí quem estava em segundo lugar vira o primeiro.
 *
 * É O COMEÇO DA CÉLULA, E SÓ ELE: um `=` no meio de um nome ("a=b") não é
 * fórmula em leitor nenhum, e recusá-lo ali estragaria dado por nada.
 */
const ABRE_FORMULA = /^[=+\-@\t\r]/;

/**
 * A NEUTRALIZAÇÃO DA FÓRMULA — e por que ela vale para OS DOIS ARQUIVOS.
 *
 * O DADO DESTAS COLUNAS VEM DE DM DO INSTAGRAM: o nome do perfil, o @ e, desde
 * a coleta de dados, a resposta que o próprio lead digitou num campo que o
 * marketing inventou. É entrada não confiável por definição, e o arquivo é
 * aberto com dois cliques na máquina de quem trabalha aqui. Um nome como
 * `=HYPERLINK("http://…"&A1,"clique")` manda a planilha inteira embora, e o
 * Excel o executa ao ABRIR — ninguém precisa clicar em nada.
 *
 * ASPAS NÃO RESOLVEM, E ISSO FOI MEDIDO: o escape de CSV logo abaixo já põe
 * entre aspas toda célula com `;`, aspa ou quebra de linha, e a fórmula era
 * avaliada do mesmo jeito. As aspas são do FORMATO DO ARQUIVO, e o leitor as
 * tira antes de olhar o conteúdo; o que decide é o primeiro caractere do que
 * sobra.
 *
 * A APÓSTROFE NA FRENTE É O QUE MUDA ESSE PRIMEIRO CARACTERE, e a perda fica
 * escrita: um nome que legitimamente comece com `+` ou `-` ("+55 Ana", "- sem
 * nome -") sai do arquivo com uma apóstrofe que não estava no dado. O preço é
 * pago só por quem começa com um dos seis caracteres acima — que é exatamente o
 * conjunto do ataque —, e a troca contrária (executar a fórmula de um estranho
 * na máquina do marketing para preservar a pontuação de um nome raro) não é uma
 * troca que alguém faria de propósito.
 *
 * ELA MORA DENTRO DE `cell`, E É POR ISSO QUE OS DOIS ARQUIVOS A GANHAM JUNTOS.
 * A decisão do dono de o arquivo antigo "não mudar nem um byte" era sobre
 * CONTEÚDO — quais contatos, quais colunas — e cede aqui, por decisão dele:
 * tratar o MESMO dado de dois jeitos em dois arquivos seria a regra com dois
 * donos que esta base persegue em toda parte, e a mais cara de todas, porque o
 * lado frouxo seria justamente o arquivo que já está em produção. O caso byte a
 * byte do botão antigo foi atualizado junto, com linhas que atravessam esta
 * função.
 */
export function neutralizarFormula(s: string): string {
  return ABRE_FORMULA.test(s) ? `'${s}` : s;
}

export function cell(v: unknown): string {
  const bruto = v === null || v === undefined ? "" : String(v);
  // A NEUTRALIZAÇÃO VEM ANTES DO ESCAPE, e a ordem é a decisão. O escape olha o
  // CONTEÚDO para saber se precisa de aspas, e a apóstrofe é conteúdo: depois
  // dele, ela cairia do lado de fora das aspas numa célula citada, onde não é
  // conteúdo de nada — e a fórmula voltaria a ser a primeira coisa dentro delas.
  const s = neutralizarFormula(bruto);
  return /["\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function montarCsv(linhas: string[][]): string {
  return BOM + linhas.map((l) => l.map(cell).join(SEP)).join(FIM_DE_LINHA);
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
export function apelidoDoRecorte(nome: string | null): string {
  const limpo = (nome ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return limpo || "sem-categoria";
}

/**
 * O nome do arquivo baixado — o mesmo molde para os dois botões.
 *
 * O PREFIXO É O QUE OS DISTINGUE na pasta de downloads (`emails-…` e
 * `contatos-…`), e ele é parâmetro e não constante porque os dois arquivos são
 * coisas diferentes: um é a lista de e-mail, o outro é o dado inteiro. O resto
 * — a conta, o apelido do recorte, o dia — é igual, e por isso mora num lugar
 * só: o nome do arquivo antigo tem caso byte a byte no teste, e é ele que
 * garante que a extração não o mudou.
 */
export function nomeDoArquivo(
  prefixo: string,
  conta: string,
  filtro: FiltroDeCategoria,
  dia: string
): string {
  const recorte = filtro.tipo === "tudo" ? "" : `-${apelidoDoRecorte(filtro.nome)}`;
  return `${prefixo}-${conta}${recorte}-${dia}.csv`;
}

// -----------------------------------------------------------------------------
// O RECORTE — o que a tela mandou, lido num lugar só.
//
// A TELA E O ARQUIVO TÊM DE FALAR DO MESMO CONJUNTO. Em 11/09/2026 não falavam:
// com `categoria=aluno` (40 com e-mail) e busca "maria", a tela dizia "1 pessoa
// — pronta para sua lista" e o botão logo abaixo baixava os 40. A frase e o
// botão discordando sobre o mesmo clique é a assinatura do Crítico de 01/09.
//
// O TIPO CARREGA AS DUAS PENEIRAS JUNTAS de propósito: enquanto o link do botão
// montava a categoria por uma função e a busca por concatenação à mão no JSX,
// esquecer a busca era uma linha de distância. Agora quem escreve o link e quem
// o lê são as duas pontas da MESMA função, e o caso de ida-e-volta do teste
// falha se uma delas deixar a busca para trás.

export type Recorte = { filtro: FiltroDeCategoria; busca: string | null };

/** O recorte que a URL pede — a leitura, do lado da rota. */
export function recorteDaUrl(params: URLSearchParams): Recorte {
  return {
    // `?categoria=` AUSENTE é "tudo"; PRESENTE E VAZIO é a ficha "sem
    // categoria". Quem guarda essa distinção é `filtroDaUrl`, e o `?? undefined`
    // é o que preserva a ausência — `params.get` devolve `null` para as duas.
    filtro: filtroDaUrl(params.get("categoria") ?? undefined),
    busca: normalizarBusca(params.get("q") ?? undefined),
  };
}

// -----------------------------------------------------------------------------
// O E-MAIL DE UMA PESSOA — a pergunta que a Parte 2 mudou de lugar, e que agora
// tem uma fonte só.
//
// A JANELA DE DIVERGÊNCIA, em uma frase: o e-mail — e SÓ ele — era gravado nos
// DOIS lugares (`contacts.campos` e a coluna antiga `contacts.email`), por
// UM escritor só (`gravarCampo`, lib/engine.ts). Era assim que a Parte 1
// entregava valor sem mexer em nenhuma tela. A Parte 2 fecha a janela em
// passos, e a ORDEM é o que impede a tela de quebrar:
//
//   PASSO 1 (feito, no ar): todo leitor parou de olhar `contacts.email` e passou
//     a fazer a pergunta AQUI — que respondia pelo registro e, na falta dele,
//     pela coluna, porque era isso que `lib/variables.ts` decidia.
//   PASSO 2a (feito, este): o produto parou de ESCREVER a coluna, a queda saiu
//     de `lib/variables.ts` e a coluna saiu de todos os `select`. Dentro do
//     passo a ordem também foi essa — a escrita primeiro, a queda depois —,
//     para que em nenhum instante houvesse e-mail entrando num lugar que
//     ninguém lê.
//   PASSO 2b (depois, à mão): o `drop column`. Ele não mexe em código nenhum:
//     quando chegar, nada do produto olha para aquela coluna.
//
// A ORDEM INVERTIDA QUEBRARIA A TELA: enquanto a migração `012` não tivesse
// rodado, haveria contato com a COLUNA cheia e o registro vazio, e tirar a
// leitura antes da migração deixaria essas pessoas sem e-mail nenhum na tela e
// no arquivo. A `012` rodou, e a medição do dono em produção (25/09/2026) é o
// que autorizou o Passo 2a: 9 contatos com e-mail, 9 com `campos->'email'`, 0
// divergentes.

/**
 * O que basta para responder "qual é o e-mail desta pessoa".
 *
 * `campos` chega como o `jsonb` CRU, e não como o `Registro` já lido, pela mesma
 * razão de `ContatoExportavel` e de `ContatoDaFicha` (lib/ficha-do-coletado.ts):
 * é o que mantém a página e as rotas como cascas — elas entregam o que o banco
 * devolveu, e quem entende o formato é `lerCampos` (lib/campos.ts), num lugar só.
 *
 * ELE TINHA UM `email: string | null` — a coluna antiga —, e é o Passo 2a que o
 * tirou. Enquanto ele existia, toda consulta que produzisse um destes objetos
 * era OBRIGADA a trazer a coluna, e o tipo sozinho mantinha a coluna viva em
 * quatro `select`. O nome do tipo fica: a pergunta que ele serve continua sendo
 * "qual é o e-mail desta pessoa".
 */
export type ContatoComEmail = { campos: unknown };

/**
 * O E-MAIL QUE VALE, OU TEXTO VAZIO — e a resposta não é decidida aqui.
 *
 * QUEM DECIDE É `lib/variables.ts`: vale o valor COLETADO, em `contacts.campos`.
 * É a MESMA porta que a DM enviada (`renderVariables`, por dentro de
 * `processItem`, lib/queue-drain.ts), a ficha da conversa
 * (lib/ficha-do-coletado.ts) e a planilha completa (`colunasDoCatalogo`, logo
 * abaixo) já usavam. Esta função não acrescenta regra nenhuma: ela só faz a
 * pergunta sem token, sem substituto e sem texto em volta — que é a forma de que
 * o corte, a busca e a célula da tabela precisam.
 *
 * ESCREVER A REGRA AQUI SERIA A SEGUNDA REGRA que esta base persegue em toda
 * parte, e a mais cara possível: o lado frouxo seria justamente o arquivo que o
 * marketing já baixa.
 *
 * VAZIO É AUSÊNCIA, e não `null`: `valorDaVariavel` apara, então registro
 * ausente, registro em branco e registro só de espaço chegam todos como `""`. É
 * a MESMA régua que a migração `012` já tinha escolhido (`btrim(email) <> ''`,
 * com o motivo escrito lá: "é o que separa TEM E-MAIL de TEM A COLUNA
 * PREENCHIDA"), e é por isso que ela não é decidida de novo aqui.
 */
export function emailDoContato(contato: ContatoComEmail): string {
  return valorDaVariavel("email", contextoDoContato(contato));
}

/**
 * SE ESTA PESSOA TEM E-MAIL — uma pergunta, uma dona.
 *
 * Ela existe para o corte (`comEmail`/`semEmail`) e para o arquivo congelado
 * responderem com a MESMA frase. Enquanto a tela perguntava `c.email` em JS e a
 * rota perguntava `c.email is not null` em SQL, eram duas regras — e elas JÁ
 * DISCORDAVAM, medido em 25/09/2026 contra o Postgres de teste: a coluna com
 * string VAZIA passava no `where` (entrava no arquivo, com a célula de e-mail em
 * branco) e caía fora do `filter` da tela (que contava zero). Arquivo e frase
 * dizendo coisas diferentes sobre o mesmo clique é a assinatura do defeito de
 * 11/09/2026, e ele estava de pé há semanas por uma porta que ninguém olhava.
 */
export function temEmail(contato: ContatoComEmail): boolean {
  return emailDoContato(contato) !== "";
}

/** O endereço que o botão carrega — a escrita, do lado da tela. */
export function urlDaExportacao(base: string, recorte: Recorte): string {
  // A categoria vai pelo MESMO `urlComFiltro` das fichas da lista: é ele que
  // sabe que "tudo" não leva parâmetro nenhum e que a ficha do nulo leva o
  // parâmetro vazio.
  const comCategoria = urlComFiltro(base, recorte.filtro);
  if (!recorte.busca) return comCategoria;
  const separador = comCategoria.includes("?") ? "&" : "?";
  return `${comCategoria}${separador}q=${encodeURIComponent(recorte.busca)}`;
}

/**
 * AS DUAS PENEIRAS DA TELA, NA MESMA ORDEM: categoria primeiro, busca depois.
 *
 * COM AS MESMAS FUNÇÕES, e nunca um `where`/`ilike` equivalente em SQL.
 * `contatosDoFiltro` é também a única que trata o balde do nulo — `categoria =
 * null` em SQL não casa NINGUÉM, e a ficha "sem categoria" sairia vazia.
 * `casaComBusca` tira acento dos dois lados, e um `ilike` não tiraria.
 *
 * A ORDEM ENTRE AS DUAS É INERTE, e isto fica escrito para ninguém prometer
 * demais: as duas são predicados independentes sobre a mesma linha, então
 * trocá-las de lugar não muda conjunto nenhum. O que os casos prendem — e o que
 * importa — é que as DUAS são aplicadas. A ordem está escrita assim porque é a
 * da tela (app/contatos/page.tsx), e ler as duas na mesma ordem nos dois lugares
 * é o que faz a comparação ser possível.
 *
 * O E-MAIL ENTREGUE A `casaComBusca` É RESOLVIDO AQUI, e não lido de `c.email`.
 * `lib/busca-de-contatos.ts` é texto e aritmética, sem um import — é o que
 * permite a ele não saber que existe banco, `jsonb` ou catálogo. Ensiná-lo a ler
 * o registro custaria essa propriedade e poria uma SEGUNDA leitura do e-mail
 * dentro dele; resolver na entrada deixa a busca continuar sendo "casa este
 * texto com estes três campos?" e mantém a resposta de "qual e-mail" num lugar
 * só. O caso que prende isto é "a busca acha pelo e-mail COLETADO, que não está
 * na coluna" (tests/exportacao-de-contatos.test.ts).
 */
export function peneirar<T extends ContatoDaTela>(contatos: T[], recorte: Recorte): T[] {
  const naCategoria = contatosDoFiltro(contatos, recorte.filtro);
  const busca = recorte.busca;
  if (!busca) return naCategoria;
  return naCategoria.filter((c) =>
    casaComBusca({ username: c.username, name: c.name, email: emailDoContato(c) }, busca)
  );
}

// -----------------------------------------------------------------------------
// A TELA INTEIRA, DERIVADA DE UMA VEZ — e por que ela não é um conjunto solto.
//
// O QUE ESTA FUNÇÃO TIRA DE QUEM MEXE NA PÁGINA É A ESCOLHA. Até 24/09/2026
// `app/contatos/page.tsx` derivava, uma linha embaixo da outra, quatro
// conjuntos DO MESMO TIPO — `rows`, `achados`, `comEmail`, `semEmail` — e
// entregava à mão um deles para a faixa de exportar. Escolher errado passava
// batido: `contatos={comEmail}` no lugar de `contatos={rows}` atravessou `tsc`,
// `eslint`, 1808 casos puros e 47 de DOM, e é o defeito de 11/09/2026 com os
// papéis trocados — a frase contando só quem tem e-mail e o botão baixando todo
// mundo do recorte. `comEmail` e `semEmail` estavam DUAS LINHAS acima da faixa
// e alimentam as tabelas logo abaixo dela: era o erro natural de quem mexesse
// ali, não uma distração improvável.
//
// A TROCA FOI DE "PASSAR O NÚMERO ERRADO" POR "PASSAR O CONJUNTO ERRADO", e só
// o primeiro tinha rede. O desenho anterior derivava o número DENTRO da faixa,
// o que fechava a discordância entre a frase e o botão — mas deixava a página
// escolhendo qual conjunto mandar, e nenhum caso alcança essa escolha (a página
// é `async` e consulta o Postgres; nada em `testes-dom/` a monta).
//
// AGORA HÁ UM PRODUTOR SÓ, e a faixa recebe O OBJETO. Sem um segundo conjunto
// para escolher, `contatos={comEmail}` deixa de existir como expressão; sem um
// `Recorte` solto no JSX, um SEGUNDO recorte também não tem como nascer ali.
//
// O QUE ISTO NÃO PRENDE, e fica escrito para não prometer rede que não existe.
// DUAS formas passaram na medição, e as duas exigem escrever código novo de
// propósito: ADULTERAR o objeto na passagem (`{...tela, achados: tela.comEmail}`
// — o espalhamento copia os campos, `tsc` aceita, e marca opaca não resolveria
// porque o espalhamento copiaria a marca junto) e DERIVAR UM SEGUNDO objeto no
// JSX (`recortarTela(rows, filtro, null)` passado direto à faixa — ali a frase e
// o botão continuam de acordo entre si, e quem discorda é a faixa contra as
// tabelas abaixo). O que o desenho fecha é o erro por ENGANO — entregar o
// conjunto vizinho, que nasce duas linhas acima —, e é a forma que esta tela já
// viu duas vezes.

/**
 * O que a tela de contatos precisa de cada linha para se recortar.
 *
 * `campos` ENTROU NO PASSO 1 DA PARTE 2, e não é enfeite: sem o registro, nem o
 * corte (`comEmail`/`semEmail`) nem a busca conseguem perguntar qual é o e-mail
 * desta pessoa — os dois voltariam a olhar a coluna, que é justamente o que este
 * passo tira do caminho. Quem a consulta esquecer de trazer `c.campos` não
 * compila: o tipo a exige, e as duas rotas e a página já a selecionam.
 *
 * E O `email` SAIU DA INTERSEÇÃO NO PASSO 2a. Ele vinha de `ContatoBuscavel`
 * (lib/busca-de-contatos.ts) e de `ContatoComEmail`, e nos dois casos era a
 * COLUNA — enquanto estivesse aqui, toda consulta que alimentasse a tela era
 * obrigada a trazê-la. O `Pick` guarda o que de `ContatoBuscavel` a tela de fato
 * precisa: renomear `username` ou `name` lá continua quebrando aqui, que é a
 * ligação que a interseção existia para manter. O `email` DAQUELE tipo continua
 * sendo pedido por `casaComBusca`, e é `peneirar` (acima) que o RESOLVE na
 * entrada — ele nunca foi a coluna, do lado de lá.
 */
export type ContatoDaTela = Pick<ContatoBuscavel, "username" | "name"> &
  ContatoComEmail & { categoria: string | null };

/**
 * A tela recortada: o recorte, os três conjuntos e o caso da seção — juntos,
 * porque separados eles são quatro coisas para manter iguais.
 */
export type TelaDeContatos<T extends ContatoDaTela> = {
  /** O que os DOIS botões de exportar carregam no link. */
  recorte: Recorte;
  /** Quem o recorte deixa — o conjunto da LEITURA, e o que a faixa conta. */
  achados: T[];
  /** O pedaço de `achados` com e-mail: a seção "Com e-mail" e o botão antigo. */
  comEmail: T[];
  /** O outro pedaço. `comEmail` + `semEmail` é exatamente `achados`. */
  semEmail: T[];
  /** Qual frase a seção "Com e-mail" mostra — ver `casoDaListaDeEmail`. */
  caso: CasoDaListaDeEmail;
};

/**
 * TUDO O QUE A TELA DERIVA DO RECORTE, num lugar só.
 *
 * ELA SUBSTITUI `recorteDaTela`, que só montava o `Recorte`. A montagem
 * continua aqui dentro (a TERCEIRA PONTA: `recorteDaUrl` é a leitura do lado da
 * rota, `urlDaExportacao` é a escrita do lado da tela, e esta é a montagem), e
 * junto vêm os conjuntos que saem dela — que é o ponto: quem tem o recorte tem
 * os conjuntos, e não há como entregar um sem o outro.
 *
 * O `caso` VEM JUNTO PORQUE A FIAÇÃO DELE É O MESMO GÊNERO DE DEFEITO.
 * `casoDaListaDeEmail` recebe um campo chamado `visiveis`, e na página existe
 * uma variável com esse nome que é OUTRO conjunto — a categoria SEM a busca, o
 * conjunto do ENVIO. Enquanto a chamada morava lá, trocar `visiveis:
 * achados.length` por `visiveis: visiveis.length` atravessava `tsc` e as três
 * suítes, e reabria em silêncio o ramo `busca_vazia`: busca sem resultado
 * voltava a mostrar a categoria inteira, com "0 pessoas neste recorte" e um
 * botão que baixa arquivo vazio. Aqui os quatro campos saem todos do mesmo
 * recorte, e não há um segundo conjunto ao alcance.
 *
 * O QUE ELA NÃO DERIVA: o conjunto do ENVIO (`contatosDoFiltro(rows, filtro)`,
 * a categoria sem a busca). Ele fica na página de propósito, e o porquê está
 * escrito lá: o envio IGNORA a busca — quem clica em "todos (127)" e confirma
 * manda para 127, busque ou não busque. Trazê-lo para cá o poria ao lado dos
 * conjuntos da leitura, que é justamente a vizinhança que esta função existe
 * para desfazer.
 *
 * PURA E SEM BANCO, como o resto deste módulo: é o que permite a
 * `tests/exportacao-de-contatos.test.ts` percorrer cada ramo do `caso`, que
 * enquanto morou na página era guarda sem rede nenhuma.
 */
export function recortarTela<T extends ContatoDaTela>(
  contatos: T[],
  filtro: FiltroDeCategoria,
  busca: string | null
): TelaDeContatos<T> {
  const recorte: Recorte = { filtro, busca };
  // PELA MESMA `peneirar` DAS DUAS ROTAS, e nunca um `filter` equivalente
  // escrito aqui: duas regras iguais em lugares diferentes são duas regras para
  // manter iguais, e foi assim que a tela e o arquivo divergiram em 11/09/2026.
  const achados = peneirar(contatos, recorte);
  // OS DOIS PEDAÇOS SAEM DE `achados`, E NÃO DE `contatos`. Tirados da conta
  // inteira, a seção "Com e-mail" contaria gente que a tabela dela não mostra.
  //
  // E A PERGUNTA É `temEmail`, E NÃO `c.email` — é o Passo 1 da Parte 2 nesta
  // linha. Com a coluna, quem coletou o e-mail depois desta fase (registro
  // cheio, coluna vazia — o estado que o Passo 2 cria para TODO MUNDO) caía em
  // `semEmail` com o e-mail em mãos, sumia da seção que o dono lê e do arquivo
  // que ele baixa. Os casos que prendem os dois lados estão em
  // tests/exportacao-de-contatos.test.ts, um por estado de divergência.
  const comEmail = achados.filter(temEmail);
  const semEmail = achados.filter((c) => !temEmail(c));
  return {
    recorte,
    achados,
    comEmail,
    semEmail,
    caso: casoDaListaDeEmail({
      buscando: busca !== null,
      visiveis: achados.length,
      comEmail: comEmail.length,
      filtrado: filtro.tipo === "uma",
    }),
  };
}

// -----------------------------------------------------------------------------
// O BOTÃO ANTIGO — a lista de e-mail, exatamente como sempre foi.

/** O que a lista de e-mail precisa de cada linha, e nada mais. */
export type ContatoDaListaDeEmail = { nome: string | null; email: string };

/**
 * O ARQUIVO DO BOTÃO "Exportar CSV" — duas colunas, e o conteúdo dele não muda.
 *
 * Ele veio para cá do JSX da rota não para mudar, mas justamente para PARAR de
 * poder mudar sem ninguém ver: aqui ele tem um caso que compara os bytes.
 *
 * A ÚNICA MUDANÇA DE BYTE QUE ELE JÁ SOFREU é a neutralização de fórmula
 * (`neutralizarFormula`, acima), decidida pelo dono depois — e ela chega por
 * `cell`, que é compartilhada, e não por nada escrito aqui. O caso byte a byte
 * mede as duas coisas de uma vez: as linhas de sempre continuam iguais, e as de
 * começo perigoso ganham a apóstrofe.
 *
 * OS DOIS CABEÇALHOS SÃO ESCRITOS À MÃO, e continuam sendo, de propósito.
 * "Nome" aqui não é o rótulo de um campo do catálogo — é o `coalesce(name,
 * username)` que a consulta desta rota monta. E "E-mail", que POR ACASO é igual
 * ao `rotulo` do campo `email`, tem de ficar preso ao que já está no ar: se um
 * dia o catálogo renomear aquele rótulo, este arquivo não pode acompanhar.
 * Este é o arquivo congelado; quem lê o catálogo é o outro.
 */
export function csvDaListaDeEmail(contatos: ContatoDaListaDeEmail[]): string {
  // O TIPO LITERAL É A GUARDA, e ele existe por causa de um plantio que
  // SOBREVIVEU. Com `["Nome", "E-mail"]` escrito solto aqui, trocar o segundo
  // por `CAMPOS[0].rotulo` — o arquivo congelado passando a LER o catálogo —
  // atravessava `tsc` e os 1804 casos puros, porque as duas strings coincidem
  // HOJE. Nenhum caso conseguia separar "está preso" de "coincide": o catálogo
  // é constante de módulo, e esta função não o recebe (nem deve receber).
  //
  // ENTÃO QUEM SEPARA É O COMPILADOR, que olha o TIPO e não o valor: `rotulo` é
  // `string`, e `string` não cabe em `"E-mail"`. O `satisfies` fica NA LINHA do
  // cabeçalho, e não numa constante ao lado, para a renomeação não ter como
  // chegar aqui por baixo dele: quem escrever `CAMPOS[0].rotulo` neste lugar
  // tem de apagar a guarda no mesmo gesto, de propósito e à vista.
  //
  // É o espelho da técnica usada do outro lado, e pelo mesmo motivo invertido:
  // em `colunasDoCsvCompleto` o catálogo é PARÂMETRO porque lá ele tem de
  // entrar (e um `Campo` de mesma `chave` e outro `rotulo` prova que entrou);
  // aqui ele não pode entrar de jeito nenhum, e a prova mais forte disso é ele
  // não caber.
  return montarCsv([
    ["Nome", "E-mail"] satisfies ["Nome", "E-mail"],
    ...contatos.map((r) => [r.nome ?? "", r.email]),
  ]);
}

/**
 * AS LINHAS DO ARQUIVO CONGELADO — quem entra, e com que e-mail.
 *
 * ELA NASCEU NO PASSO 1 DA PARTE 2, e o que ela tirou da rota foi a segunda
 * regra sobre "quem tem e-mail". Até aqui a rota peneirava no BANCO
 * (`where c.email is not null`) enquanto a seção "Com e-mail" da tela peneirava
 * em JS (`filter(c => c.email)`) — duas regras para manter iguais, sobre o
 * arquivo que fica DENTRO daquela seção, embaixo daquele número. O porquê de
 * elas não poderem sobreviver ao Passo 1 está no `where` que saiu
 * (app/api/contatos/csv/route.ts).
 *
 * ELA RECEBE A TELA INTEIRA, E NÃO UM CONJUNTO SOLTO — a mesma disciplina de
 * `FaixaDaExportacaoCompleta` (app/contatos/faixa-da-exportacao.tsx), pelo mesmo
 * motivo medido em 24/09/2026: com `achados`, `comEmail` e `semEmail` soltos ao
 * alcance, entregar o vizinho é uma linha de distância e atravessa `tsc`,
 * `eslint` e as três suítes. Aqui não há o que escolher — o arquivo é
 * `tela.comEmail`, por construção, e é literalmente o conjunto que a frase da
 * seção contou.
 *
 * E O E-MAIL DA CÉLULA É `emailDoContato`, PELA MESMA RAZÃO DO CORTE: é a mesma
 * pergunta que decidiu quem entra, então a célula não tem como discordar da
 * linha. Enquanto a coluna `contacts.email` existia no caminho, ler `c.email`
 * aqui levaria o valor VELHO dela para quem trocou de e-mail depois da Parte 1 —
 * o Passo 2a tirou a coluna do caminho e essa divergência deixou de ser
 * possível. O caso byte a byte de `csvDaListaDeEmail` não pega nada disso:
 * aquele caso mede a MONTAGEM do arquivo, e esta função mede o CONTEÚDO dele.
 *
 * O ARQUIVO CONTINUA SENDO O MESMO ARQUIVO: `csvDaListaDeEmail` não mudou uma
 * linha, e o caso que compara os bytes dela segue exatamente como estava.
 */
export function listaDeEmailDaTela<T extends ContatoDaTela & { nome: string | null }>(
  tela: TelaDeContatos<T>
): ContatoDaListaDeEmail[] {
  return tela.comEmail.map((c) => ({ nome: c.nome, email: emailDoContato(c) }));
}

/** O que a lista de e-mail precisa da consulta — as seis, e todas são usadas. */
export type LinhaDaListaDeEmail = ContatoDaTela & { nome: string | null };

// A COLUNA `email` SAIU DESTA LISTA NO PASSO 2a, junto com o `c.email` do
// `select` da rota. Ela era a fonte de ontem; hoje o e-mail sai de `campos`, e
// exigir da consulta uma coluna que ninguém lê é exigir que ela continue
// existindo — exatamente o que o Passo 2b vai derrubar.
const COLUNAS_DA_LISTA_DE_EMAIL = ["nome", "username", "name", "campos", "categoria"] as const;

/**
 * A LINHA DO BANCO LIDA COMO LINHA DA LISTA DE E-MAIL.
 *
 * ELA EXISTE PELO MESMO MOTIVO DE `contatoExportavelDaLinha` (abaixo), e o
 * buraco dela foi MEDIDO nesta tarefa, em 25/09/2026: tirando `c.campos` do
 * `select` da rota — uma vírgula a menos na parte que as pessoas de fato editam
 * — `tsc` passava VERDE e os 1884 casos puros passavam VERDE. A asserção `as`
 * é uma promessa do autor ao compilador, não uma checagem: as linhas chegariam
 * com `campos: undefined`, `lerCampos` devolveria registro VAZIO para todo
 * mundo, e o arquivo inteiro voltaria a sair da COLUNA — ou seja, esta tarefa
 * inteira desfeita em silêncio, com quem só tem o e-mail no registro sumindo da
 * lista que o marketing importa.
 *
 * O COMENTÁRIO DA ROTA CHEGOU A AFIRMAR QUE O TIPO PEGAVA ISSO, e era falso. É
 * por isso que a medição virou função: comentário que mente sobre a própria rede
 * é pior que comentário nenhum.
 *
 * AS CINCO COLUNAS SÃO TODAS USADAS, e é o que torna honesto exigir as cinco:
 * `nome` é a primeira coluna do arquivo; `username`, `name` e o e-mail
 * resolvido são os três campos da busca; `campos` é de onde o e-mail sai; e
 * `categoria` é a peneira do recorte. Eram SEIS até o Passo 2a — a sexta era a
 * coluna `email`, e o e-mail resolvido já não vem dela.
 *
 * `in`, E NÃO "TEM VALOR": coluna presente e nula é o normal desta tabela — a
 * maioria dos contatos não tem categoria, e muitos não têm e-mail. O que se
 * procura é a coluna que NÃO VEIO.
 *
 * O DESFECHO RUIDOSO É O BARATO AQUI, como lá: a consulta é fixa, então isto só
 * dispara depois de alguém EDITAR o `select` — e a escolha é entre um erro na
 * cara de quem acabou de editar e uma lista de e-mail silenciosamente errada,
 * descoberta semanas depois, do lado de fora do painel.
 */
export function linhaDaListaDeEmail(linha: Record<string, unknown>): LinhaDaListaDeEmail {
  const faltando = COLUNAS_DA_LISTA_DE_EMAIL.filter((coluna) => !(coluna in linha));
  if (faltando.length > 0) {
    throw new Error(
      `A consulta da lista de e-mail não trouxe: ${faltando.join(", ")}. ` +
        "Sem `campos`, o e-mail some do arquivo para TODO MUNDO — desde o Passo 2a " +
        "da Parte 2 não há coluna antiga para onde cair —, e a lista sai vazia; " +
        "sem as outras, a busca ou o recorte param de peneirar."
    );
  }
  return {
    nome: linha.nome as string | null,
    username: linha.username as string | null,
    name: linha.name as string | null,
    campos: linha.campos,
    categoria: linha.categoria as string | null,
  };
}

// -----------------------------------------------------------------------------
// O BOTÃO NOVO — todo contato do recorte, com todo dado coletado.

/**
 * O que a exportação completa precisa de cada linha.
 *
 * `campos` chega como o `jsonb` CRU da coluna `contacts.campos` e é lido por
 * `lerCampos` (lib/campos.ts) — a mesma leitura do motor, que descarta o que
 * não tem forma em vez de estourar. Receber o cru, e não o `Registro` já lido,
 * é o que mantém a rota como casca: ela entrega o que o banco devolveu.
 */
export type ContatoExportavel = {
  username: string | null;
  name: string | null;
  categoria: string | null;
  campos: unknown;
};

// AS QUATRO COLUNAS QUE A CONSULTA TEM DE TRAZER — a lista que a rota promete.
// Eram CINCO até o Passo 2a: a coluna `email` saiu daqui e do `select` da rota
// no mesmo gesto, porque a célula de e-mail do arquivo passou a sair de `campos`
// como a de qualquer outro campo do catálogo.
const COLUNAS_DO_CONTATO_EXPORTAVEL = ["username", "name", "categoria", "campos"] as const;

/**
 * A LINHA QUE O BANCO DEVOLVEU, LIDA COMO CONTATO EXPORTÁVEL.
 *
 * ELA EXISTE PORQUE `as ContatoExportavel[]` NÃO É CHECAGEM. A rota afirmava o
 * tipo sobre o `unknown[]` do driver, e asserção é uma promessa do autor ao
 * compilador: tirar `c.campos` do `select` — uma vírgula a menos na parte que as
 * pessoas de fato editam — passava por `tsc` sem um pio, e o arquivo saía com
 * TODAS as colunas de campo livre sumidas e três das quatro do catálogo em
 * branco. Calado, na planilha que o marketing abre.
 *
 * ENTÃO A FALTA VIRA ERRO, E ALTO. O desfecho ruidoso é o barato aqui: a
 * consulta é fixa, então isto só dispara depois de alguém EDITAR o `select` — e
 * aí a escolha é entre um erro na cara de quem acabou de editar e uma planilha
 * em branco descoberta semanas depois, do lado de fora do painel.
 *
 * `in`, E NÃO "TEM VALOR": coluna presente e nula é o normal desta tabela
 * (quase todo contato tem `categoria` nula, e a maioria não tem e-mail). O que
 * se procura é a coluna que NÃO VEIO.
 *
 * O TIPO DAS CÉLULAS CONTINUA AFIRMADO, e a fronteira fica escrita: o que esta
 * função prende é a coluna AUSENTE, que era o defeito calado. Uma coluna
 * presente com outro tipo atravessa — e atravessa sem estragar o arquivo,
 * porque `cell` transforma o que chegar em texto e `lerCampos` descarta o que
 * não tem forma.
 */
export function contatoExportavelDaLinha(linha: Record<string, unknown>): ContatoExportavel {
  const faltando = COLUNAS_DO_CONTATO_EXPORTAVEL.filter((coluna) => !(coluna in linha));
  if (faltando.length > 0) {
    throw new Error(
      `A consulta da exportação completa não trouxe: ${faltando.join(", ")}. ` +
        "O `select` da rota tem de trazer as cinco colunas — sem `campos`, todas as " +
        "colunas de campo livre somem do arquivo e três das quatro do catálogo saem " +
        "em branco."
    );
  }
  return {
    username: linha.username as string | null,
    name: linha.name as string | null,
    categoria: linha.categoria as string | null,
    campos: linha.campos,
  };
}

/** Uma coluna do arquivo: o cabeçalho e de onde sai a célula. */
export type ColunaDoCsv = {
  cabecalho: string;
  valor: (ctx: VariableContext, contato: ContatoExportavel) => string;
};

// AS COLUNAS DE QUEM É A PESSOA SAEM DE `VARIABLES` (lib/variables.ts) — o
// rótulo E o valor, do mesmo dono.
//
// São as duas variáveis do PERFIL que identificam alguém numa planilha: o nome
// completo (que já cai no @ quando não há nome público, como na tela) e o @.
// `first_name` fica de fora porque é recorte do nome completo — numa planilha
// seria uma coluna que não acrescenta dado nenhum.
//
// LIDAS DA LISTA, E NÃO ESCRITAS AQUI: o rótulo "Username (@)" e a regra "sem
// nome público, vale o @" já têm dono, e reescrevê-los seria a segunda verdade
// que esta base persegue em toda parte. Se uma dessas duas chaves mudar de nome
// lá, a coluna some daqui — e o caso "a ordem é: quem é a pessoa, a categoria, o
// catálogo…" (tests/exportacao-de-contatos.test.ts) fica vermelho, que é
// exatamente o aviso que se quer.
const CHAVES_DO_PERFIL_NA_PLANILHA = ["full_name", "username"];

const COLUNAS_DO_PERFIL: ColunaDoCsv[] = CHAVES_DO_PERFIL_NA_PLANILHA.flatMap((chave) => {
  const def = VARIABLES.find((v) => v.key === chave);
  return def ? [colunaDaVariavel(def.label, def)] : [];
});

function colunaDaVariavel(cabecalho: string, def: VariableDef): ColunaDoCsv {
  return { cabecalho, valor: (ctx) => def.resolve(ctx) };
}

// A CATEGORIA É O ÚNICO CABEÇALHO ESCRITO À MÃO DESTE ARQUIVO, e a exceção é
// medida: categoria não é campo do catálogo nem variável de mensagem — não
// existe, nesta base, um dono de quem ela se chama. Escrevê-la aqui não cria
// segunda verdade nenhuma porque não há primeira.
//
// A ficha do nulo sai como célula VAZIA, e não como "sem categoria": numa
// planilha, célula vazia é o que se filtra e se ordena; um texto inventado
// viraria uma categoria de mentira na coluna.
const COLUNA_DA_CATEGORIA: ColunaDoCsv = {
  cabecalho: "Categoria",
  valor: (_ctx, contato) => contato.categoria ?? "",
};

/**
 * As colunas dos campos do catálogo — o RÓTULO de `CAMPOS`, nunca escrito à mão.
 *
 * O `rotulo` E NÃO O `nomeCurto`, e a escolha é medida:
 *
 *   1. `nomeCurto` existe para TRÊS TELAS ESTREITAS DO EDITOR, e o comentário
 *      dele em lib/campos.ts nomeia as três (a faixa da paleta, o título do nó,
 *      a frase do campo repetido). Uma coluna de planilha não é nenhuma delas —
 *      ela tem a largura que o Excel der.
 *   2. Quem lê esta planilha está FORA do painel, e pode nem ser quem montou a
 *      automação. "Telefone / WhatsApp" diz para que aquele número serve; a
 *      barra é valor de brief, e "Telefone" a perde.
 *   3. A coluna do perfil ao lado se chama "Nome completo". Com `nomeCurto`, a
 *      coluna do campo coletado se chamaria só "Nome" — duas colunas quase
 *      homônimas, com origens diferentes (o que o Instagram diz e o que a pessoa
 *      respondeu). "Nome informado" é o que conta essa diferença.
 *
 * É A MESMA ESCOLHA QUE `lib/variables.ts` JÁ FEZ para o seletor de variáveis, e
 * pelo mesmo argumento — o que não é tela apertada lê o rótulo cheio.
 *
 * O CATÁLOGO É PARÂMETRO, com `CAMPOS` só como valor padrão, e isso é o que
 * torna a regra verificável. `CAMPOS` tem quatro campos e nenhum caso pode
 * fazê-lo ter outros; com os rótulos digitados no código, um teste que
 * comparasse com `CAMPOS` passaria igual, porque as strings hoje coincidem. É a
 * mesma razão de `listaEmProsa` (lib/campos.ts) ser separada do catálogo:
 * guarda que nenhum caso consegue exercer é guarda que a próxima limpeza leva
 * embora.
 */
function colunasDoCatalogo(catalogo: Campo[]): ColunaDoCsv[] {
  return catalogo.flatMap((campo) => {
    // O VALOR DA CÉLULA É A REGRA DE `lib/variables.ts`, e não uma segunda
    // leitura escrita aqui. Desde o Passo 2a da Parte 2 ela decide uma coisa
    // só, e vale para TODOS os campos do catálogo igualmente: o valor COLETADO,
    // em `contacts.campos`. O e-mail tinha uma segunda fonte — a coluna
    // `contacts.email` —, e ela saiu junto com a escrita dela; quem não coletou
    // sai com a célula vazia, como em qualquer outra coluna deste arquivo.
    //
    // A BUSCA PODE NÃO ACHAR só se o catálogo recebido tiver um campo que não
    // está em `CAMPOS` — `VARIABLES` gera uma variável para CADA campo do
    // catálogo (e o caso "todo campo do catálogo tem variável" em
    // tests/variables.test.ts prende isso). Quem prende o outro lado, aqui, é o
    // caso "todo campo do catálogo vira coluna, com o `rotulo` dele".
    const def = VARIABLES.find((v) => v.key === campo.chave);
    return def ? [colunaDaVariavel(campo.rotulo, def)] : [];
  });
}

/**
 * AS CHAVES DOS CAMPOS LIVRES, descobertas a partir do dado exportado.
 *
 * A ORDEM É ALFABÉTICA, E ISSO É O REQUISITO, não gosto. Duas exportações do
 * mesmo dado têm de dar as mesmas colunas na mesma ordem, senão o marketing não
 * consegue empilhar planilhas. Ordenar por PRIMEIRA APARIÇÃO seria determinístico
 * para uma lista fixa e mentiria no uso real: a ordem das LINHAS é
 * `first_contact_at desc`, então um contato novo entra na frente e reordenaria
 * as colunas do arquivo de amanhã. A ordem das chaves DENTRO do registro também
 * não serve de âncora — o `jsonb` do Postgres não devolve as chaves na ordem em
 * que foram gravadas.
 *
 * `sort()` sem comparador de propósito: chave livre é `[a-z0-9_]`
 * (`formaDaChave`, lib/campos.ts), ASCII puro, onde a ordem de unidades UTF-16 é
 * estável e não depende de locale — um `localeCompare` aqui introduziria a
 * pergunta "em qual idioma?" sobre um alfabeto que não tem acento nenhum.
 *
 * O CABEÇALHO É A CHAVE NORMALIZADA, e há perda escrita nisso: o marketing
 * digitou "Qual sua cidade?" no editor e o que está gravado em `contacts.campos`
 * é `qual_sua_cidade` — a interrogação, a maiúscula e os espaços não estão em
 * lugar nenhum daquela coluna. Reconstruir o texto original cruzando com
 * `automations.steps` seria fragilidade disfarçada de esperteza: a automação
 * pode ter sido editada ou apagada depois da coleta, e o cabeçalho passaria a
 * depender de um dado que não é o dado exportado. O que existe é a chave, e é a
 * chave que vai — e é também a forma que o painel mostra ao dono enquanto ele
 * digita o nome do campo.
 *
 * ELA PEDE SÓ `campos`, E NÃO UM `ContatoExportavel` INTEIRO — e a diferença
 * nasceu quando a ficha da conversa (lib/ficha-do-coletado.ts) precisou da MESMA
 * pergunta: "o que está no registro e não está no catálogo, em que ordem?". A
 * resposta já morava aqui, e a alternativa era reescrevê-la lá — a segunda
 * verdade que esta base persegue em toda parte, com a tela e a planilha livres
 * para listar os campos livres em ordens diferentes.
 *
 * O TIPO SÓ AFROUXOU PARA O QUE A FUNÇÃO SEMPRE USOU: `contato.campos`, e nada
 * mais. Nenhum chamador de antes mudou (um `ContatoExportavel` continua servindo
 * como `{ campos: unknown }`), e o que se ganhou foi a ficha poder perguntar com
 * uma pessoa só em mãos, sem inventar os outros quatro campos da planilha.
 */
export function chavesLivres(
  contatos: { campos: unknown }[],
  catalogo: Campo[] = CAMPOS
): string[] {
  const doCatalogo = new Set(catalogo.map((c) => c.chave));
  const achadas = new Set<string>();
  for (const contato of contatos) {
    for (const chave of lerCampos(contato.campos).keys()) {
      if (!doCatalogo.has(chave)) achadas.add(chave);
    }
  }
  return [...achadas].sort();
}

/**
 * A célula de um campo livre: o valor gravado no registro.
 *
 * NÃO PASSA POR `renderVariables`, e a ausência é decisão escrita. Lá a lista
 * fixa GANHA do registro (`{{full_name}}` devolve o nome do Instagram), e é o
 * certo numa mensagem — o dono escreveu um token. Aqui não há token: o
 * cabeçalho É a chave gravada, e a coluna promete exatamente "o que está
 * guardado sob este nome". Um registro antigo com a chave `full_name` (gravado
 * antes de `normalizarChaveLivre` passar a recusá-la) tem de mostrar a resposta
 * que a pessoa deu, e não o nome do perfil, que já tem coluna própria.
 *
 * O `trim` é o mesmo de `valorColetado` (lib/variables.ts) pela mesma razão:
 * valor só de espaço, gravado por fora, é ausência — numa planilha ele seria
 * uma célula que parece cheia e não tem nada.
 */
function colunaDeCampoLivre(chave: string): ColunaDoCsv {
  return {
    cabecalho: chave,
    valor: (ctx) => (ctx.campos?.get(chave)?.valor ?? "").trim(),
  };
}

/**
 * As colunas do arquivo completo, na ordem em que aparecem.
 *
 * QUEM É A PESSOA vem primeiro (é por onde se procura alguém numa planilha), a
 * CATEGORIA depois (é o recorte que o dono já usa na tela), então o CATÁLOGO na
 * ordem em que ele está declarado, e por fim os CAMPOS LIVRES em ordem
 * alfabética.
 *
 * AS DUAS FAMÍLIAS DE CABEÇALHO NÃO PODEM COLIDIR POR CONSTRUÇÃO: chave livre é
 * `[a-z0-9_]` e todo cabeçalho fixo tem maiúscula (ou espaço). O caso "nenhum
 * cabeçalho aparece duas vezes" é o que acusaria se algum dos dois lados mudasse.
 */
export function colunasDoCsvCompleto(
  contatos: ContatoExportavel[],
  catalogo: Campo[] = CAMPOS
): ColunaDoCsv[] {
  return [
    ...COLUNAS_DO_PERFIL,
    COLUNA_DA_CATEGORIA,
    ...colunasDoCatalogo(catalogo),
    ...chavesLivres(contatos, catalogo).map(colunaDeCampoLivre),
  ];
}

/**
 * O ARQUIVO DO BOTÃO "Exportar todos os dados".
 *
 * Todo contato que a peneira deixou passar entra, TENHA E-MAIL OU NÃO — é a
 * razão de este botão existir ao lado do outro. Quem não coletou um campo sai
 * com a célula vazia, que numa planilha é o que se filtra.
 *
 * O CONTEXTO DE VARIÁVEL É MONTADO UMA VEZ POR CONTATO, e não por célula: ler o
 * `jsonb` uma vez por coluna seria a mesma leitura repetida sete vezes por
 * linha.
 */
export function csvCompletoDeContatos(
  contatos: ContatoExportavel[],
  catalogo: Campo[] = CAMPOS
): string {
  const colunas = colunasDoCsvCompleto(contatos, catalogo);
  return montarCsv([
    colunas.map((c) => c.cabecalho),
    ...contatos.map((contato) => {
      const ctx = contextoDoContato(contato);
      return colunas.map((coluna) => coluna.valor(ctx, contato));
    }),
  ]);
}

// O contato do banco visto como o contexto que `lib/variables.ts` resolve. É a
// mesma montagem de `variableContext` (lib/queue-drain.ts), e por isso as
// células desta planilha valem exatamente o que a mensagem enviada valeria.
//
// O PERFIL É OPCIONAL, e foi o Passo 1 da Parte 2 que o afrouxou: `emailDoContato`
// (lá em cima) pergunta com uma linha de tabela em mãos, que tem o `jsonb` mas
// não precisa do `username` nem do `name`. Um SEGUNDO montador ali — mais um
// `lerCampos` escrito à mão — seria a terceira grafia do mesmo contexto nesta
// base, e a primeira a poder divergir das outras duas em silêncio.
//
// AS DUAS DO PERFIL NÃO ENTRAM NA RESPOSTA DO E-MAIL: nenhuma `resolve` de campo
// do catálogo as lê. Elas ficam aqui porque a PLANILHA precisa delas
// (`COLUNAS_DO_PERFIL`), e é o mesmo contexto que serve os dois usos.
function contextoDoContato(
  contato: ContatoComEmail & { username?: string | null; name?: string | null }
): VariableContext {
  return {
    username: contato.username ?? null,
    name: contato.name ?? null,
    campos: lerCampos(contato.campos),
  };
}
