// O QUE A FICHA DA CONVERSA MOSTRA — quais campos a pessoa tem, em que ordem,
// com que rótulo, e QUANDO cada um foi coletado.
//
// MÓDULO PURO, e sem `server-only` de propósito, pela mesma disciplina de
// `lib/campos.ts` e `lib/exportacao-de-contatos.ts`: a suíte padrão
// (vitest.config.ts) não tem banco nem DOM, e é ali que esta regra precisa
// rodar.
//
// E AQUI A PUREZA NÃO É ESTILO, É A ÚNICA REDE POSSÍVEL. A tela que consome
// isto (`app/conversas/[id]/page.tsx`) é um componente `async` que consulta o
// Postgres: caso nenhum de `testes-dom/` consegue montá-lo, e um fragmento
// escrito lá dentro nasceria sem teste. É o mesmo movimento — e o mesmo motivo —
// de `app/contatos/faixa-da-exportacao.tsx`, cujo cabeçalho conta o preço medido
// de não o ter feito antes: o defeito plantado ali atravessou `tsc`, `eslint`,
// 1804 casos puros e 39 de DOM.
//
// -----------------------------------------------------------------------------
// O QUE ESTE ARQUIVO NÃO DECIDE, para o dono da regra continuar sendo um só:
//
//   O VALOR de um campo do catálogo sai de `VARIABLES` (lib/variables.ts) — a
//     mesma porta que a mensagem enviada e a planilha usam. É ela que decide,
//     para o e-mail, que vale o valor COLETADO e, na falta dele, a coluna
//     `contacts.email` (a queda transitória até a Parte 2). Uma segunda leitura
//     escrita aqui divergiria da primeira na primeira mudança, e a ficha passaria
//     a dizer sobre o e-mail algo diferente do que a DM entrega.
//   QUAIS SÃO AS CHAVES LIVRES sai de `chavesLivres`
//     (lib/exportacao-de-contatos.ts): "o que está no registro e não está no
//     catálogo, em ordem alfabética". A ordem alfabética serve aqui pelo mesmo
//     motivo que serve lá, e por mais um: o `jsonb` do Postgres não devolve as
//     chaves na ordem em que foram gravadas, então sem ordenar a ficha poderia
//     listar os campos livres numa ordem diferente a cada carregamento.
//   O RÓTULO de um campo do catálogo sai de `CAMPOS` (lib/campos.ts), nunca
//     escrito à mão.
//
// O QUE ELE DECIDE, e é pergunta que ninguém mais responde nesta base: SE A DATA
// GRAVADA É UMA DATA DE COLETA. Ver o bloco de `instanteDaColeta`, abaixo.
import { CAMPOS, lerCampos, type Campo, type CampoColetado } from "./campos";
import { chavesLivres } from "./exportacao-de-contatos";
import { VARIABLES, type VariableContext } from "./variables";

/**
 * Uma linha da ficha.
 *
 * `em` É O INSTANTE REAL DA COLETA, OU `null` — e o `null` é o assunto inteiro
 * deste módulo. Ele quer dizer "este dado está aqui e não se sabe quando
 * chegou", e não "faltou consultar": é o desfecho honesto para o e-mail que veio
 * da coluna antiga, com ou sem a migração `012` no meio. Quem desenha a tela tem
 * de dizer isso com todas as letras, e não escolher uma data qualquer para pôr
 * no lugar.
 *
 * `rotulo` é o nome cheio do catálogo para campo do catálogo, e a CHAVE
 * NORMALIZADA para campo livre — com a perda que isso carrega, escrita em
 * `camposLivresDa`, abaixo.
 */
export type ItemDaFicha = {
  chave: string;
  rotulo: string;
  valor: string;
  em: string | null;
};

/**
 * O que a ficha precisa do contato.
 *
 * `campos` chega como o `jsonb` CRU da coluna `contacts.campos`, e não como o
 * `Registro` já lido: é o que mantém a página como casca — ela entrega o que o
 * banco devolveu. Mesma escolha, mesmo motivo, de `ContatoExportavel`
 * (lib/exportacao-de-contatos.ts).
 *
 * `email` é a coluna `contacts.email`, que ainda existe em paralelo. Ela entra
 * aqui porque a queda do registro para a coluna é feita por `lib/variables.ts`,
 * e sem este campo a ficha sairia sem e-mail nenhum para todo contato anterior à
 * migração `012` — que é aplicada à mão, fora do build.
 */
export type ContatoDaFicha = {
  email: string | null;
  campos: unknown;
};

// A DATA SÓ É DATA DE COLETA QUANDO ALGUÉM A MEDIU — e quem separa os dois casos
// é a AUSÊNCIA da chave `automacao`, nunca o valor dela e nunca a própria data.
//
// A migração `012-migrar-email-para-campos.sql` grava `em = now()`, o instante
// em que ELA rodou, e NÃO grava a chave `automacao`. `gravarCampo`
// (lib/engine.ts) SEMPRE grava a chave — com `null` quando não há automação de
// origem, mas grava. Então:
//
//   sem a chave `automacao`  → o `em` é um SUBSTITUTO. Não houve medição
//                              nenhuma: o e-mail sempre viveu como coluna solta,
//                              sem quando nem quem.
//   com a chave `automacao`  → o `em` é o instante real da coleta, inclusive
//                              quando o valor dela é `null`.
//
// PERGUNTAR PELO VALOR (`registrado.automacao != null`) SERIA O ERRO ESPELHO, e
// ele é mais fácil de escrever do que o certo: chamaria de migrado todo campo
// coletado fora de uma automação. Por isso a pergunta é `in`, e por isso os dois
// casos têm teste.
//
// E A DATA NÃO DISTINGUE MAIS NADA desde que a `012` passou a gravar `now()`:
// um registro migrado hoje e um coletado hoje têm `em` parecidos. Quem tentar
// separar os dois por idade vai acertar hoje e errar amanhã.
//
// O VALOR EM BRANCO TAMBÉM ZERA A DATA, e essa é a terceira condição: quando o
// registro está em branco, quem aparece na tela é a COLUNA (é o que a `resolve`
// de `lib/variables.ts` devolve), e a data do registro fala de um valor que a
// ficha não está mostrando. Sem esta linha, a tela diria "coletado em <data>" ao
// lado de um e-mail que veio de outro lugar.
function instanteDaColeta(registrado: CampoColetado | undefined): string | null {
  if (registrado === undefined) return null;
  if (registrado.valor.trim() === "") return null;
  if (!("automacao" in registrado)) return null;
  return registrado.em;
}

/**
 * A ficha de uma pessoa: os campos do catálogo que ela tem, na ordem do
 * catálogo, e depois os campos livres em ordem alfabética.
 *
 * O CATÁLOGO É PARÂMETRO, com `CAMPOS` só como valor padrão, e isso é o que
 * torna a ordem e o rótulo verificáveis. `CAMPOS` tem quatro campos e nenhum
 * caso pode fazê-lo ter outros; com a ordem ou os rótulos escritos no código
 * daqui, um caso que comparasse com `CAMPOS` passaria igual, porque as duas
 * listas hoje coincidem. É a mesma razão pela qual `colunasDoCsvCompleto`
 * (lib/exportacao-de-contatos.ts) recebe o catálogo, e a mesma de `listaEmProsa`
 * ser separada de `camposDoSistemaEmProsa` (lib/campos.ts): guarda que nenhum
 * caso consegue exercer é guarda que a próxima limpeza leva embora.
 *
 * QUEM NÃO TEM O CAMPO NÃO GANHA LINHA. Uma linha com o rótulo e nada ao lado
 * afirmaria uma coleta que não aconteceu, e a tela inteira existe para parar de
 * afirmar o que não é. O vazio tem desenho próprio, e ele está em
 * `app/conversas/[id]/ficha-do-coletado.tsx`.
 */
export function fichaDoColetado(
  contato: ContatoDaFicha,
  catalogo: Campo[] = CAMPOS
): ItemDaFicha[] {
  const registro = lerCampos(contato.campos);
  // O CONTEXTO NÃO LEVA `username` NEM `name`, e a ausência é declarada: as três
  // variáveis do perfil do Instagram não são dado COLETADO — não saem de
  // `contacts.campos` — e nenhuma delas vira campo do catálogo. As `resolve` que
  // este arquivo chama são só as do catálogo, e elas leem o registro e, no caso
  // do e-mail, a coluna. Passar o perfil aqui sugeriria que ele entra na ficha.
  const ctx: VariableContext = { email: contato.email, campos: registro };

  return [
    ...catalogo.flatMap((campo) => {
      // A BUSCA PODE NÃO ACHAR só se o catálogo recebido tiver um campo que não
      // está em `CAMPOS` — `VARIABLES` gera uma variável para CADA campo do
      // catálogo, e o caso "todo campo do catálogo tem variável"
      // (tests/variables.test.ts) prende isso. O `flatMap` é o mesmo desfecho
      // silencioso de `colunasDoCatalogo` (lib/exportacao-de-contatos.ts): sem
      // variável não há de onde tirar o valor.
      //
      // QUEM EXERCE ESTA GUARDA é o caso "campo de catálogo sem variável não
      // vira linha — e não derruba a ficha" (tests/ficha-do-coletado.test.ts),
      // que passa um catálogo com uma chave inventada. Sem ele, o `if` aqui
      // seria guarda que nenhum caso alcança — e a limpeza seguinte o trocaria
      // por um `!`, que é exatamente o que ele existe para evitar.
      const def = VARIABLES.find((v) => v.key === campo.chave);
      if (!def) return [];
      const valor = def.resolve(ctx);
      if (!valor) return [];
      return [
        {
          chave: campo.chave,
          rotulo: campo.rotulo,
          valor,
          em: instanteDaColeta(registro.get(campo.chave)),
        },
      ];
    }),
    ...camposLivresDa(contato, registro, catalogo),
  ];
}

/**
 * Os campos que o marketing nomeou, depois dos do catálogo.
 *
 * O RÓTULO É A CHAVE NORMALIZADA, E HÁ PERDA NISSO: o marketing digitou "Qual
 * sua cidade?" no editor e o que está gravado em `contacts.campos` é
 * `qual_sua_cidade` — a interrogação, a maiúscula e os espaços não estão em
 * lugar nenhum daquela coluna. Reconstruir o texto original cruzando com
 * `automations.steps` seria fragilidade disfarçada de esperteza: a automação
 * pode ter sido editada ou apagada depois da coleta, e o rótulo passaria a
 * depender de um dado que não é o dado mostrado. O que existe é a chave — e é
 * também a forma que o painel mostra ao dono enquanto ele digita o nome do
 * campo, e a que vira cabeçalho de coluna na planilha.
 *
 * O VALOR É LIDO DIRETO DO REGISTRO, e não por `renderVariables`: é a mesma
 * decisão de `colunaDeCampoLivre` (lib/exportacao-de-contatos.ts), pelo mesmo
 * motivo escrito lá. Na resolução de uma mensagem a lista fixa GANHA do registro
 * (`{{full_name}}` devolve o nome do Instagram); aqui não há token, o rótulo É a
 * chave gravada, e a linha promete exatamente "o que está guardado sob este
 * nome". Um registro antigo com a chave `full_name` — gravado antes de
 * `normalizarChaveLivre` passar a recusá-la — tem de mostrar a resposta que a
 * pessoa deu.
 *
 * O `trim` é o mesmo de `valorColetado` (lib/variables.ts) pela mesma razão:
 * valor só de espaço, gravado por fora, é ausência.
 */
function camposLivresDa(
  contato: ContatoDaFicha,
  registro: ReturnType<typeof lerCampos>,
  catalogo: Campo[]
): ItemDaFicha[] {
  return chavesLivres([{ campos: contato.campos }], catalogo).flatMap((chave) => {
    // O `?.` É EXIGÊNCIA DO TIPO, E NÃO UMA GUARDA COM DESFECHO PRÓPRIO: a chave
    // acabou de sair DESTE registro (`chavesLivres` leu o mesmo `jsonb`), então
    // o `get` não volta vazio. Está escrito para ninguém procurar o caso que o
    // exercita — ele não existe, e inventar um seria inventar um estado que o
    // código não produz.
    const registrado = registro.get(chave);
    const valor = (registrado?.valor ?? "").trim();
    if (!valor) return [];
    return [{ chave, rotulo: chave, valor, em: instanteDaColeta(registrado) }];
  });
}
