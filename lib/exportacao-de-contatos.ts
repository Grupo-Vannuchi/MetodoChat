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
//   "Exportar CSV" (seção "Com e-mail") é A LISTA DE E-MAIL: duas colunas,
//     `where c.email is not null`, e o CONTEÚDO dele — quais contatos, quais
//     colunas — não muda nem um byte. `csvDaListaDeEmail`, abaixo, é aquele
//     arquivo, e o caso byte a byte de tests/exportacao-de-contatos.test.ts é a
//     única coisa nesta base capaz de acusar uma mudança nele.
//     A EXCEÇÃO, DECIDIDA PELO DONO DEPOIS, é a neutralização de fórmula
//     (`neutralizarFormula`): ela muda os bytes da linha cujo nome COMEÇA com
//     `=`, `+`, `-`, `@`, TAB ou CR, e vale para os dois arquivos pela MESMA
//     função — o porquê está escrito nela.
//   "Exportar todos os dados" leva TODO contato do recorte, tenha e-mail ou
//     não, com as colunas do catálogo (lib/campos.ts) e os campos livres que o
//     próprio marketing nomeou. `csvCompletoDeContatos`.
//
// OS DOIS RESPEITAM AS MESMAS DUAS PENEIRAS (`peneirar`) e montam o link pela
// MESMA função (`urlDaExportacao`). Duas regras iguais escritas em lugares
// diferentes são duas regras para manter iguais, e foi assim que a tela e o
// arquivo divergiram em 11/09/2026.

import { CAMPOS, lerCampos, type Campo } from "./campos";
import { VARIABLES, type VariableContext, type VariableDef } from "./variables";
import {
  contatosDoFiltro,
  filtroDaUrl,
  urlComFiltro,
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
 */
export function peneirar<T extends ContatoBuscavel & { categoria: string | null }>(
  contatos: T[],
  recorte: Recorte
): T[] {
  const naCategoria = contatosDoFiltro(contatos, recorte.filtro);
  const busca = recorte.busca;
  return busca ? naCategoria.filter((c) => casaComBusca(c, busca)) : naCategoria;
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
  return montarCsv([
    ["Nome", "E-mail"],
    ...contatos.map((r) => [r.nome ?? "", r.email]),
  ]);
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
  email: string | null;
  categoria: string | null;
  campos: unknown;
};

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
    // leitura escrita aqui. É ela que decide, para o e-mail, que vale o valor
    // COLETADO e, na falta dele, a coluna `contacts.email` — a queda
    // transitória até a Parte 2, sem a qual este arquivo sairia com a coluna de
    // e-mail em branco para todo contato anterior à migração `012` (que hoje
    // NÃO roda no build: ela é aplicada à mão).
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
 */
export function chavesLivres(
  contatos: ContatoExportavel[],
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
function contextoDoContato(contato: ContatoExportavel): VariableContext {
  return {
    username: contato.username,
    name: contato.name,
    email: contato.email,
    campos: lerCampos(contato.campos),
  };
}
