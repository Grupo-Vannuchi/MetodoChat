// O CATÁLOGO DE CAMPOS QUE A AUTOMAÇÃO SABE PEDIR — e por que existe um único
// arquivo para isto.
//
// MÓDULO PURO, e sem `server-only` de propósito: a suíte padrão
// (vitest.config.ts) não tem banco nem DOM, e é ali que este arquivo precisa
// rodar — é a mesma disciplina de `lib/conexao.ts` e de `lib/imagem-quebrada.ts`.
// Antes desta peça, a automação só sabia pedir e-mail, com a regra espalhada
// pelo motor. Generalizar para telefone, nome e data de nascimento sem um dono
// único da regra "o que é um campo e como ele se extrai" teria criado uma
// cópia divergente por campo — o mesmo defeito que `KINDS_MANUAIS`
// (lib/envio-filters.ts) e `EVENT_TYPES` (lib/event-filters.ts) existem para
// evitar.
//
// O E-MAIL NÃO GANHA EXTRATOR NOVO: `extractEmail` (lib/match.ts) já é o que
// o motor usa hoje em produção para reconhecer e-mail dentro de uma frase.
// Reescrever a regex aqui criaria uma segunda verdade sobre o que é um e-mail
// válido — o par validaria diferente do que grava, e o defeito só apareceria
// na borda que um dos dois esquecesse.

import { extractEmail } from "./match.ts";

// Quantas RESPOSTAS RUINS a automação tolera antes de desistir do campo.
//
// O NÚMERO CONTA RESPOSTAS, NÃO REPERGUNTAS, e a distinção já mentiu neste
// comentário: ele dizia "quantas vezes repergunta", que lido ao pé da letra
// daria uma mensagem a mais do que o motor manda. A conversa real com o teto
// em 3 é esta:
//
//   pergunta → resposta ruim (1) → repergunta
//            → resposta ruim (2) → repergunta
//            → resposta ruim (3) → DESISTE, e o fluxo SEGUE sem o dado
//
// Ou seja: 3 chances para a pessoa, 2 reperguntas na tela dela. Quem for mudar
// o número mude pensando em CHANCES; quem quiser mudar a quantidade de
// reperguntas mexe na comparação (`tentativas < TETO`), não aqui.
//
// É constante do catálogo, e não campo do editor, porque a regra é do produto
// — não é ajuste que cada automação deva poder tornar diferente. E são 3, e não
// os 5 do `pedir_follow`: o portão de follow é condição do produto e vale
// insistir; um campo é um favor que se pede.
export const TETO_DE_TENTATIVAS = 3;

export type Campo = {
  chave: string;
  // O NOME CHEIO DO CAMPO — o que ele guarda, dito para quem monta a automação.
  // "Telefone / WhatsApp" é literal do brief da Tarefa 1, e a barra é o recado:
  // aquele campo serve para o zap. Quem lê este nome é a prosa
  // (`camposDoSistemaEmProsa`, abaixo), onde há espaço para explicar.
  rotulo: string;
  // O NOME DO BLOCO NAS TRÊS TELAS ESTREITAS DO EDITOR, e por que ele existe
  // separado do `rotulo`.
  //
  // Três lugares chamam o mesmo bloco pelo nome, e os três são apertados: a
  // faixa da paleta ("Pedir telefone"), o título do nó ("PEDIR TELEFONE") e a
  // frase do campo repetido ("Só pode haver um pedido de telefone"). Com o
  // rótulo cheio eles saíam "Pedir telefone / whatsapp", "PEDIR TELEFONE /
  // WHATSAPP" e "Só pode haver um pedido de telefone / whatsapp".
  //
  // A ONDA ANTERIOR RESOLVEU ISSO ENCURTANDO O `rotulo`, e estava errado:
  // encurtar o DADO para caber na TELA estraga o modelo para resolver
  // apresentação, e o "/ WhatsApp" — que é valor de brief de outra tarefa, já
  // completa — sumiu de onde ele servia. O que a tela precisa é de um campo de
  // apresentação, e é este. Continua um dono só (`CAMPOS`): campos diferentes
  // para usos diferentes.
  //
  // OS VALORES SÃO LITERAIS DO BRIEF DA TAREFA 5 ("Pedir e-mail", "Pedir
  // telefone", "Pedir nome", "Pedir nascimento"), e quem os prende são os casos
  // literais de tests/campos.test.ts e tests/editor-modelos.test.ts.
  nomeCurto: string;
  perguntaPadrao: string;
  reperguntar: string;
  extrair(texto: string): string | null;
  // O TOKEN DA MENSAGEM NÃO É CAMPO DESTE TIPO, e a ausência é decisão medida.
  //
  // Havia aqui um `variavel`, que era o nome escrito entre chaves numa mensagem
  // (`{{telefone}}`), ao lado da `chave`, que é onde o motor GRAVA o dado. A
  // razão escrita para os dois era poder renomear a variável sem migrar o
  // banco. Ela nunca foi exercida: os quatro campos tinham `variavel` IGUAL a
  // `chave`, o tipo inteiro tinha UM leitor (lib/variables.ts), e a revisão de
  // 22/09/2026 mediu que trocar um pelo outro na resolução deixava a suíte
  // inteira verde — o comentário que dizia haver rede para essa divergência
  // estava medindo errado a si mesmo.
  //
  // DOIS CAMPOS QUE PRECISAM SER SEMPRE IGUAIS SÃO UMA REGRA COM DOIS DONOS, e
  // é o defeito que esta base persegue em toda parte. O token é derivado da
  // `chave` (lib/variables.ts), que é o único nome que o banco conhece. Quem um
  // dia precisar de verdade renomear a variável sem migrar o banco traz o campo
  // de volta JUNTO com o caso que monta um `Campo` com os dois diferentes — sem
  // esse caso ele volta a ser um par que ninguém confere.
  exemplo: string;
};

// Acha um telefone dentro da frase e devolve só os dígitos, sem DDI — é o
// formato que dá para exportar e discar; a máscara que a pessoa digitou
// ("(11) 99999-9999") é enfeite, não dado.
//
// Exportada, junto com as duas seguintes, porque a Tarefa 1 pede os
// extratores testáveis por fora do catálogo — o teste de hoje chama por
// `campoPorChave(...).extrair`, mas tarefas futuras (o editor, a normalização
// de chave livre) podem precisar do extrator isolado sem montar um `Campo`.
//
// POR QUE OS DÍGITOS SÃO CONTADOS POR BLOCO, E NÃO NO TEXTO INTEIRO: é para
// não juntar dígitos que a pessoa nunca escreveu juntos — "fixo: 1133334444"
// não pode virar um número com o índice de "fixo" colado. O bloco aceita
// espaço, parênteses, `+`, hífen e PONTO: "11.99999-9999" é escrita comum de
// celular no Brasil (medido contra exemplo real, 21/09/2026), e sem aceitar
// ponto como separador esse formato era recusado à toa.
//
// A REGRA-MÃE CONTINUA SENDO CONTAGEM DE DÍGITOS, e não lista de exceções:
// "1990" não é telefone porque tem 4 dígitos, não porque "parece ano". MAS
// contar dígito sozinho NÃO separa CPF de celular — os dois têm 11, e aceitar
// ponto como separador (parágrafo acima) faz o CPF pontuado voltar a cair num
// bloco só, com 11 dígitos, igual a um celular. Quem separa é o plano de
// numeração: todo celular brasileiro de 11 dígitos tem "9" como TERCEIRO
// dígito (DDD + 9 + oito dígitos, regra vigente desde 2016) — CPF não segue
// essa forma. Isto NÃO é lista de exceções porque não é uma lista de valores
// proibidos, é a forma que todo celular tem; `ehCelularDeVerdade` decide pela
// forma do número, e não por reconhecer "isto é CPF". Fixo de 10 dígitos NÃO
// ganha regra parecida: a faixa do primeiro dígito do número varia por
// região, e uma regra ali recusaria fixo de verdade — dez dígitos com DDD
// plausível basta.
//
// O LIMITE HONESTO DA HEURÍSTICA: `ehCelularDeVerdade` aceita QUALQUER
// sequência de 11 dígitos cujo terceiro dígito calhe ser "9" — CPF incluso,
// se o CPF de alguém tiver um "9" bem ali (ex.: "11922233344" não é celular
// de ninguém, mas passaria). A regra reduz MUITO o falso positivo (de "todo
// CPF de 11 dígitos passa" para "só o CPF que imita a forma de celular
// passa"), ela não o elimina — quem for usar este retorno pra decidir algo
// mais sensível que "gravar o telefone que a pessoa digitou" precisa saber
// disso.
const BLOCO_DE_TELEFONE = /[\d\s()+.-]+/g;

function ehCelularDeVerdade(digitos: string): boolean {
  return digitos[2] === "9";
}

export function extrairTelefone(texto: string): string | null {
  for (const bloco of texto.match(BLOCO_DE_TELEFONE) ?? []) {
    const digitosBrutos = (bloco.match(/\d/g) ?? []).join("");
    // O DDI 55 só é removido quando sobra dígito demais para ser DDD+número —
    // do contrário um fixo de 10 dígitos que por acaso começa com "55"
    // perderia os dois primeiros à toa.
    const semDdi = digitosBrutos.startsWith("55") && digitosBrutos.length > 11
      ? digitosBrutos.slice(2)
      : digitosBrutos;
    // "(011)" é o "0 + DDD" do prefixo de interurbano antigo — o zero é
    // prefixo de discagem, não dado. Nenhum DDD brasileiro começa com zero;
    // sem tirar esse zero, "(011) 3333-4444" gravaria 11 dígitos com um DDD
    // de três dígitos que não disca nem exporta igual aos demais contatos.
    const semZero = semDdi.startsWith("0") ? semDdi.slice(1) : semDdi;
    if (semZero.length === 11 && ehCelularDeVerdade(semZero)) return semZero;
    if (semZero.length === 10) return semZero;
  }
  return null;
}

// O ARTIGO É OPCIONAL, e "eu sou" entra do lado de "sou": "sou Ana" (sem
// artigo) é tão comum quanto "sou a Ana", e as duas formas caíam fora antes
// desta extensão — a pessoa que responde assim recebia a frase inteira de
// volta como se fosse o nome. O "sou"/"eu sou" só pode comer o que vem depois
// SEGUIDO DE ESPAÇO (`\s+` logo após o literal) — sem essa exigência,
// "Sousa" (sobrenome de verdade, mesmas quatro letras + vogal) perderia
// "sou" e viraria "sa".
const PREFIXO_DE_NOME =
  /^\s*(?:eu\s+sou\s+(?:o\s+|a\s+)?|sou\s+(?:o\s+|a\s+)?|meu\s+nome\s+(?:é|eh|e)\s+|me\s+chamo\s+)/i;
const TEM_LETRA_OU_DIGITO = /[\p{L}\p{N}]/u;

// Tira o prefixo de apresentação ("sou a ", "eu sou ", "meu nome é ", ...) e
// devolve o que sobrou como nome.
//
// O PREFIXO É REMOVIDO SEMPRE, inclusive em "sou a ana" → "ana": quem responde
// assim está dizendo que o nome é Ana, e guardar a frase inteira faria
// `{{nome_informado}}` mandar "Oi sou a ana" de volta pra pessoa.
//
// A RECUSA É FRACA DE PROPÓSITO, e é sobre o que se ACEITA (emoji junto, sem
// maiúscula) — não sobre deixar o prefixo. Uma lista de palavras proibidas
// sempre erra alguém; o custo de aceitar "ana 😊" é menor que o de recusar um
// nome de verdade porque veio com emoji junto.
export function extrairNome(texto: string): string | null {
  const limpo = texto.replace(PREFIXO_DE_NOME, "").trim();
  // Não checa `!limpo` antes: string vazia (ou só espaço) já falha o teste de
  // letra/dígito abaixo — uma linha a mais aqui não muda resultado nenhum,
  // só duplicaria a checagem sem leitor que a acuse.
  if (!TEM_LETRA_OU_DIGITO.test(limpo)) return null; // vazio, só espaço, ou só emoji/pontuação
  if (limpo.length > 60) return null; // isto é frase, não nome
  return limpo;
}

// Lê data em BR (dd/mm/aaaa) ou ISO (aaaa-mm-dd) e devolve sempre em ISO.
//
// A CONFERÊNCIA DE VOLTA EXISTE PORQUE `new Date(...)` NÃO RECUSA DATA
// IMPOSSÍVEL — ele rola: `Date.UTC(1990, 1, 30)` (30 de fevereiro) vira 2 de
// março, calado. Sem comparar os componentes de volta com o que a `Date`
// devolveu, "30/02/1990" seria aceito como uma data real e errada.
export function extrairNascimento(texto: string): string | null {
  const br = texto.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  const iso = texto.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  let a: number, m: number, d: number;
  if (iso) {
    [, a, m, d] = iso.map(Number) as [unknown, number, number, number];
  } else if (br) {
    [, d, m, a] = br.map(Number) as [unknown, number, number, number];
  } else {
    return null;
  }

  const data = new Date(Date.UTC(a, m - 1, d));
  if (
    data.getUTCFullYear() !== a ||
    data.getUTCMonth() !== m - 1 ||
    data.getUTCDate() !== d
  ) {
    return null;
  }
  if (data.getTime() > Date.now()) return null; // nascer no futuro, não
  return `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export const CAMPOS: Campo[] = [
  {
    chave: "email",
    rotulo: "E-mail",
    nomeCurto: "E-mail",
    perguntaPadrao: "Me manda seu melhor e-mail que eu te envio o link 👇",
    reperguntar: "Acho que esse e-mail saiu errado 🤔 Me manda de novo, só o e-mail.",
    extrair: extractEmail,
    exemplo: "ana@email.com",
  },
  {
    chave: "telefone",
    // O RÓTULO CHEIO VOLTOU, e a volta é decisão registrada: ele era
    // "Telefone / WhatsApp" — literal do brief da Tarefa 1, que está COMPLETA
    // — e foi encurtado para caber na faixa e no nó. O "/ WhatsApp" existe para
    // dizer a quem monta a automação para que o campo serve, e some junto com a
    // barra. Quem cabe nas telas apertadas é o `nomeCurto`, logo abaixo.
    rotulo: "Telefone / WhatsApp",
    nomeCurto: "Telefone",
    perguntaPadrao: "Me manda seu WhatsApp com DDD 👇",
    reperguntar: "Não consegui ler esse número 🤔 Me manda com DDD, só os números.",
    extrair: extrairTelefone,
    exemplo: "(11) 99999-9999",
  },
  {
    chave: "nome_informado",
    rotulo: "Nome informado",
    nomeCurto: "Nome",
    perguntaPadrao: "Como você prefere que eu te chame?",
    reperguntar: "Não entendi 🤔 Me manda só o nome.",
    extrair: extrairNome,
    exemplo: "Ana",
  },
  {
    chave: "nascimento",
    rotulo: "Data de nascimento",
    nomeCurto: "Nascimento",
    perguntaPadrao: "Qual sua data de nascimento? (dia/mês/ano)",
    reperguntar: "Essa data não deu certo 🤔 Me manda como 01/02/1990.",
    extrair: extrairNascimento,
    exemplo: "01/02/1990",
  },
];

const POR_CHAVE = new Map(CAMPOS.map((c) => [c.chave, c]));

export function campoPorChave(chave: string): Campo | undefined {
  return POR_CHAVE.get(chave);
}

// -----------------------------------------------------------------------------
// O CAMPO LIVRE — o que `campo: "livre"` significa para quem VALIDA a resposta.
//
// `"livre"` NÃO ENTRA EM `CAMPOS` de propósito: `conferirBloco` (lib/steps.ts)
// aceita `campo === "livre"` OU uma chave do catálogo, e `normalizarChaveLivre`
// (abaixo) recusa toda chave livre que colida com o catálogo. Pôr `"livre"`
// dentro de `CAMPOS` quebraria as duas: o `conferir` passaria a ter dois
// caminhos para a mesma resposta, e `"livre"` viraria uma chave reservada a mais
// sem ser um campo de verdade.
//
// MAS O MOTOR PRECISA DE UM EXTRATOR PARA ELE, e é por isso que esta regra mora
// aqui e não em lib/engine.ts: sem ela, `campoPorChave("livre")` devolve
// `undefined` e o motor estouraria no meio de atender uma mensagem de verdade —
// em um passo que a conferência deixou passar de propósito.
//
// O EXTRATOR DO LIVRE É O TEXTO APARADO, e a fraqueza é deliberada: quem montou
// a automação acabou de inventar a pergunta ("De qual cidade você é?"), e não há
// como esta base saber o que é uma resposta válida para ela. Recusar só o que é
// vazio é o máximo que dá para afirmar sem inventar regra; validar mais faria a
// automação reperguntar para sempre a quem respondeu certo.
export function extrairTextoLivre(texto: string): string | null {
  const limpo = texto.trim();
  return limpo === "" ? null : limpo;
}

// A repergunta do livre não nomeia o dado ("me manda o e-mail", "me manda com
// DDD") porque não há nome para nomear: o rótulo é do editor, e esta camada não
// o conhece. Genérica é o que dá para prometer.
export const REPERGUNTAR_LIVRE = "Não consegui ler 🤔 Me manda de novo, por favor.";

// O QUE O MOTOR PERGUNTA AO CATÁLOGO, e o único jeito que ele deve perguntar:
// dado o `campo` do passo, como se extrai a resposta e o que se diz quando ela
// não serve. Existe para que `"livre"` e campo do catálogo tenham UMA porta só —
// um `if (campo === "livre")` dentro de lib/engine.ts seria a segunda verdade
// sobre o que o livre é, e ela divergiria desta na primeira mudança.
//
// Devolve `undefined` para campo que o catálogo não conhece. Isso não deveria
// chegar aqui (`conferirBloco` recusa o passo antes de salvar), e quem chama
// precisa tratar mesmo assim: automação salva ANTES desta fase pode ter um
// `campo` que não existe mais.
export type RegraDeCampo = { extrair(texto: string): string | null; reperguntar: string };

export function regraDoCampo(campo: string): RegraDeCampo | undefined {
  if (campo === "livre") return { extrair: extrairTextoLivre, reperguntar: REPERGUNTAR_LIVRE };
  return campoPorChave(campo);
}

// -----------------------------------------------------------------------------
// A LEITURA DE `contacts.campos` (migrations/011-campos-do-contato.sql) — e as
// duas funções que a acompanham: a normalização de chave livre e o teste de
// recência. O comentário da migração diz POR QUE a coluna é `jsonb` e não uma
// coluna por campo; aqui fica o porquê de cada função ser o que é.

// Um campo coletado guarda o VALOR e o QUANDO — a recência (abaixo) depende do
// "quando", e é esse par que uma coluna por campo não dá sem custar duas
// colunas cada. `automacao` é OPCIONAL: os e-mails que já existem em produção
// hoje (migração futura, que só move o que já está em `contacts.email`) nunca
// tiveram essa informação guardada — não existe data nem origem de coleta para
// eles — e quem lê o registro precisa aguentar a ausência, não presumir.
export type CampoColetado = { valor: string; em: string; automacao?: string | null };
export type Registro = Map<string, CampoColetado>;

// A recência é 30 dias — declarado como constante, e não número solto, porque
// `campoEstaFresco` e o teste que prende `RECENCIA_EM_DIAS === 30` (abaixo)
// precisam ler o MESMO valor: um número duplicado nos dois lugares poderia
// divergir sem que nenhum teste acusasse.
export const RECENCIA_EM_DIAS = 30;
const RECENCIA_EM_MS = RECENCIA_EM_DIAS * 24 * 60 * 60 * 1000;

// Decide se um campo já coletado ainda vale, ou se a automação deve perguntar
// de novo. `agora` é PARÂMETRO, com `Date.now()` só como valor padrão — não é
// preferência de estilo: em 21/09/2026 dois testes desta base ficaram
// vermelhos sozinhos, meses depois de escritos, por cravarem uma data que já
// tinha passado, num bloco cujo comentário já previa que isso ia acontecer.
// Um teste que chama `campoEstaFresco(data, AGORA_FIXO)` nunca apodrece.
//
// `null` e data ilegível contam como "não fresco" — o desfecho seguro é
// perguntar de novo, e não pular a pergunta por engano; `Date.parse` devolve
// `NaN` para lixo, e qualquer comparação com `NaN` é `false`, então a conta
// abaixo já cai no lado seguro sem `isNaN` explícito.
//
// A BORDA DOS 30 DIAS CONTA A FAVOR (`<=`, não `<`): exatos 30 dias atrás
// ainda é fresco. É a spec, prendida pelo caso "a borda de 30 dias é fresca"
// em tests/campos.test.ts — um `<` estrito faria esse caso ficar vermelho.
//
// A DISTÂNCIA TEM PISO EM ZERO, e não é detalhe: sem a checagem `distancia >=
// 0`, uma data no FUTURO (relógio de servidor errado, ou um `em` corrompido
// por outra falha) produz `agora - quando` NEGATIVO, que é sempre `<=
// RECENCIA_EM_MS` — a automação leria isso como "acabou de ser coletado" e
// PULARIA a pergunta para sempre. O desfecho seguro do "este dado é
// suspeito" é o mesmo do "não sei": perguntar de novo, nunca pular.
export function campoEstaFresco(em: string | null, agora: number = Date.now()): boolean {
  if (em === null) return false;
  const quando = Date.parse(em);
  const distancia = agora - quando;
  return distancia >= 0 && distancia <= RECENCIA_EM_MS;
}

// Lê a coluna `jsonb` e devolve um `Registro` — um `Map`, e não o objeto cru,
// porque todo lugar que precisa perguntar "este campo já foi coletado?" quer
// `.get`/`.has`, e um `Map` não corre o risco de colidir com `__proto__` ou
// outra chave herdada que um objeto literal aceitaria calado.
//
// IGNORA O QUE NÃO TEM FORMA, em vez de estourar: a coluna nasce com
// `default '{}'::jsonb` (migração 011), mas nada no banco impede alguém de
// gravar lixo ali por fora — e um valor sem `valor` (a chave `vazio` do teste)
// ou que não é nem objeto (a chave `lixo`) precisa ser descartado, não travar
// a leitura do registro inteiro.
export function lerCampos(jsonb: unknown): Registro {
  const registro: Registro = new Map();
  if (jsonb === null || typeof jsonb !== "object") return registro;
  for (const [chave, valor] of Object.entries(jsonb as Record<string, unknown>)) {
    if (
      valor !== null &&
      typeof valor === "object" &&
      typeof (valor as Record<string, unknown>).valor === "string" &&
      typeof (valor as Record<string, unknown>).em === "string"
    ) {
      registro.set(chave, valor as CampoColetado);
    }
  }
  return registro;
}

// Palavras que já são chave de campo do catálogo — usado só para a checagem de
// colisão abaixo, e não exportado: o catálogo (`CAMPOS`) continua sendo a
// única fonte de verdade sobre quais campos existem.
const CHAVES_DO_CATALOGO = new Set(CAMPOS.map((c) => c.chave));

// AS TRÊS VARIÁVEIS DO PERFIL DO INSTAGRAM, e por que elas também são chave
// proibida para campo livre.
//
// Elas não são campo de catálogo nenhum: saem do que o Instagram entrega sobre
// a pessoa (`{{first_name}}`, `{{full_name}}`, `{{username}}`), e por isso
// ficavam de fora desta recusa. Medido ponta a ponta na revisão de 22/09/2026:
// um campo livre chamado "Full Name" normaliza para `full_name`, o painel
// promete ao dono que a resposta "vai virar {{full_name}}", e
// `renderVariables` (lib/variables.ts) devolve **o nome do Instagram** — porque
// a lista fixa ganha do registro. O lead recebe um valor ERRADO com cara de
// certo, a mensagem sai preenchida, e ninguém descobre.
//
// É A MESMA CLASSE DA COLISÃO COM `email` que a Tarefa 4 fechou, e ela se fecha
// no MESMO lugar: `normalizarChaveLivre` é a dona única da pergunta "esta chave
// pode ser usada?", e espalhar a lista por quem pergunta é o que faz as
// respostas divergirem.
//
// A LISTA É ESCRITA AQUI, E NÃO LIDA DE `VARIABLES`: lib/variables.ts importa
// ESTE arquivo (o catálogo gera as variáveis dos campos coletados), e ler de lá
// para cá fecharia o ciclo de import — com `CAMPOS` ainda em construção na hora
// em que o outro módulo o pedisse. São duas listas que precisam concordar, e o
// dono da concordância é um caso: "as três chaves recusadas do perfil são as
// variáveis que NÃO nascem do catálogo" (tests/variables.test.ts), que é o
// único arquivo que enxerga os dois lados. Uma quarta variável de perfil
// escrita à mão lá sem entrar aqui deixa aquele caso vermelho.
export const CHAVES_DO_PERFIL = new Set(["first_name", "full_name", "username"]);

// O QUE O SISTEMA JÁ USA — as chaves do catálogo mais as do perfil. É este
// conjunto que a recusa consulta, e é por ele existir num lugar só que as duas
// perguntas (`normalizarChaveLivre` e `chaveReservada`) não podem discordar.
const CHAVES_RESERVADAS = new Set([...CHAVES_DO_CATALOGO, ...CHAVES_DO_PERFIL]);

// Transforma o rótulo que a pessoa digita no editor ("Qual sua Cidade") na
// chave que vira variável de template ("qual_sua_cidade"): minúscula, sem
// acento, espaço vira underscore.
//
// RECUSA O QUE JÁ É NOME DO SISTEMA (devolve `null`), e a recusa é o ponto
// inteiro da função. São DOIS estragos diferentes, e os dois acabam no lead:
// um campo livre chamado `email` gravaria por cima do e-mail de verdade sem
// passar pelo extrator, e `{{email}}` passaria a devolver o que a pessoa
// digitou em QUALQUER formato, sem validação nenhuma; um campo livre chamado
// `full_name` nem chega a ser lido — a variável do PERFIL ganha, e a mensagem
// sai com o nome do Instagram no lugar da resposta que a pessoa deu (o porquê
// inteiro está em `CHAVES_DO_PERFIL`, acima).
// A checagem roda DEPOIS da normalização ("E-mail" -> "email") porque é a
// forma normalizada que colide de fato — e é por isso que a pontuação
// ("-", "/", etc.) É REMOVIDA e não virada underscore: só o espaço vira
// underscore. Com o hífen sobrevivendo, "E-mail" normalizaria para "e-mail",
// que não é igual a "email", e a colisão passaria batido.
//
// O UNDERSCORE É A ÚNICA PONTUAÇÃO QUE SOBREVIVE, e não é gosto: sem isso esta
// função COME A PRÓPRIA SAÍDA ("qual_sua_cidade" voltaria "qualsuacidade"), e
// ela precisa ser idempotente porque o que chega a ela pode já ter passado por
// ela.
//
// SÃO DUAS FORMAS GRAVADAS, E UMA LEITURA SÓ. O editor grava o texto CRU que o
// dono digitou (`ChaveDoCampoLivre`, app/automacoes/editor/painel.tsx — o
// porquê, uma perda de dado medida na tela, está lá), mas as automações salvas
// ANTES desse conserto têm a forma já normalizada no banco. Quem lê as duas é
// `chaveDoPedido` (lib/steps.ts), a cada mensagem, e ele precisa chegar na
// MESMA string nos dois casos. Comendo o próprio underscore, o bloco velho
// (`qual_sua_cidade`) passaria a gravar o dado da pessoa sob `qualsuacidade`
// enquanto a variável `{{qual_sua_cidade}}` da mensagem ficaria vazia para
// sempre, sem nada acusar — e a mesma tela que mostra a forma normalizada ao
// dono mostraria uma string que o motor não usa. O caso que prende isto é "a
// saída dela sobrevive a ela mesma", em tests/campos.test.ts.
//
// A EXPORTAÇÃO AGORA EXISTE, E É ESTA FORMA QUE VIRA CABEÇALHO DE COLUNA.
// "Exportar todos os dados" (app/api/contatos/csv-completo/route.ts, sobre
// lib/exportacao-de-contatos.ts) descobre as chaves livres dentro de
// `contacts.campos` e faz uma coluna de cada uma, com a CHAVE como cabeçalho —
// `qual_sua_cidade`, e não "Qual sua cidade?", que é o que o dono digitou e o
// que esta função come. A perda está escrita lá, onde a coluna nasce.
//
// Este comentário dizia o contrário ("nenhuma tarefa da Parte 1 constrói a
// coluna do CSV"), e era verdade até esta tarefa. O botão ANTIGO ("Exportar
// CSV", app/api/contatos/csv/route.ts) continua sendo o que era: duas colunas
// fixas, `email is not null`, e sem ler esta coluna — são dois botões, e o
// velho não muda.
//
// Aceitar o underscore NÃO afrouxa a colisão: quem colide é a forma sem
// pontuação nenhuma ("E-mail" -> "email"), e o hífen continua sendo removido.
export function normalizarChaveLivre(texto: string): string | null {
  const chave = formaDaChave(texto);
  if (chave === null) return null;
  if (CHAVES_RESERVADAS.has(chave)) return null;
  return chave;
}

// A COLISÃO, PERGUNTADA À PARTE — e pelo MESMO dono da normalização.
//
// `normalizarChaveLivre` devolve `null` por dois motivos diferentes ("não vira
// variável" e "este nome já é do sistema"), e quem precisa distinguir os dois é
// `conferirBloco` (lib/steps.ts): só a colisão vira recusa de salvar, com uma
// frase que dá ao dono a saída. Escrever a segunda pergunta com uma
// normalização própria lá seria a cópia que diverge — por isso ela mora aqui,
// em cima da mesma `formaDaChave`.
//
// O NOME DIZ "RESERVADA", E NÃO "COLIDE COM O CATÁLOGO": desde que as três
// chaves do perfil entraram na recusa, o catálogo deixou de ser a única coisa
// com que ela colide, e um nome que dissesse "catálogo" mentiria sobre metade
// do que a função responde.
export function chaveReservada(texto: string): boolean {
  const chave = formaDaChave(texto);
  return chave !== null && CHAVES_RESERVADAS.has(chave);
}

// A FORMA da chave, sem a pergunta da colisão: minúscula, sem acento, espaço
// virado underscore. `null` quando não sobrou nome nenhum para chamar de chave.
//
// EXPORTADA PARA lib/variables.ts, e o motivo é a outra ponta do MESMO fio: o
// dono digita o token da mensagem À MÃO (o seletor de variáveis não oferece
// chave livre) e pode escrever `{{Cidadã}}` onde o banco guarda `cidada`. Quem
// reduz as duas escritas à mesma string tem de ser esta função — reescrever a
// redução lá seria a segunda verdade sobre o que é a forma de uma chave, e ela
// divergiria desta na primeira mudança, com o dado inalcançável e nada
// acusando.
export function formaDaChave(texto: string): string | null {
  const semAcento = texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove os acentos que o NFD separou
    .toLowerCase();
  // Tudo que não é letra, dígito, espaço ou underscore some (pontuação,
  // emoji); espaço sobrevive para virar underscore no passo seguinte, e o
  // underscore que já está lá sobrevive porque é a saída desta mesma função.
  const soLetraDigitoEspaco = semAcento.replace(/[^a-z0-9\s_]/g, "");
  const chave = soLetraDigitoEspaco.trim().replace(/\s+/g, "_");
  if (!chave) return null; // vazio, só espaço, ou só emoji/pontuação
  // EXIGE PELO MENOS UMA LETRA, e não só "não vazio": `"123"` sobreviveria ao
  // teste acima e viraria a variável `{{123}}` numa mensagem — nome que não diz
  // nada sobre o que foi perguntado, e que ninguém escreve de propósito. Dígito CONTINUA valendo junto da letra
  // (`cidade2`), porque aí ele faz parte de um nome.
  if (!/[a-z]/.test(chave)) return null;
  return chave;
}

// -----------------------------------------------------------------------------
// AS DUAS FRASES DA CHAVE RECUSADA, NUM DONO SÓ.
//
// Elas eram DUAS CÓPIAS, servindo dois caminhos diferentes do mesmo gesto: uma
// em `conferirBloco` (lib/steps.ts), que o dono lê no nó depois de fechar o
// painel, e outra em `ChaveDoCampoLivre` (app/automacoes/editor/painel.tsx),
// que ele lê enquanto digita. E elas JÁ TINHAM DIVERGIDO: uma mandava "use o
// bloco do próprio campo", a outra "use o pedido do próprio campo".
//
// PIOR QUE A DIVERGÊNCIA: as duas escreviam A LISTA DOS CAMPOS À MÃO —
// "(e-mail, telefone, nome ou data de nascimento)" — em vez de lê-la de
// `CAMPOS`, que é o dono dos rótulos. No dia em que entrar um quinto campo no
// catálogo, as duas frases passam a mentir, em dois arquivos, sem nada
// acusando. É a regra com dois donos aplicada ao TEXTO.
//
// MORAM NESTE ARQUIVO porque aqui está o catálogo que elas citam e a função que
// produz a recusa (`normalizarChaveLivre`, logo acima): quem mexe no catálogo
// mexe na frase sem precisar procurar por ela.

// A lista dos campos do sistema em prosa, lida de `CAMPOS`: "e-mail, telefone,
// nome informado ou data de nascimento". O último vem depois de "ou" — é frase
// para pessoa ler, não enumeração de código.
export function camposDoSistemaEmProsa(): string {
  // O RÓTULO CHEIO, E NÃO O `nomeCurto`: aqui não é tela apertada, é a frase em
  // que o dono descobre quais campos o sistema já tem — e "telefone / whatsapp"
  // é justamente o que faz ele reconhecer o campo que ele queria criar à mão.
  return listaEmProsa(CAMPOS.map((c) => c.rotulo.toLowerCase()));
}

// A CARREGADORA DA LISTA, SEPARADA DO CATÁLOGO — e a separação tem motivo, não
// é gosto: a guarda do UM ITEM ("não há 'ou' nenhum a escrever") não tem como
// ser exercida através de `camposDoSistemaEmProsa`, porque `CAMPOS` tem quatro
// campos e nenhum teste pode fazê-lo ter um. Uma revisão apagou essa guarda e a
// suíte inteira ficou verde — guarda sem ninguém que a prenda é guarda que a
// próxima limpeza leva embora sem perceber. Exportada por isso, e o caso que a
// prende está em tests/campos.test.ts.
export function listaEmProsa(itens: string[]): string {
  // Com um item só não há "ou" nenhum a escrever; sem esta linha a frase
  // nasceria como " ou e-mail", com a vírgula pendurada no vazio.
  if (itens.length === 1) return itens[0];
  return `${itens.slice(0, -1).join(", ")} ou ${itens[itens.length - 1]}`;
}

// A RECUSA QUE TEM SAÍDA ESCRITA. Uma recusa que só diz "não pode" deixa o dono
// sem saber o que fazer: o bloco do próprio campo existe, valida a resposta e
// grava no lugar certo — é essa a saída, e ela faz parte da frase.
//
// SÃO DUAS FRASES, PORQUE SÃO DOIS ESTRAGOS, e a saída de uma não serve para a
// outra. "Este nome já é um campo do sistema (e-mail, telefone, ...), use o
// bloco do próprio campo" é verdade para `email` e é ININTELIGÍVEL para
// `username`: não existe bloco de `username` para o dono usar, e `username` não
// está na prosa dos campos do sistema — ele leria uma frase que lista quatro
// nomes, nenhum deles o que ele digitou.
//
// ELA RECEBE O TEXTO, e não um sinalizador de qual caso é: quem chama não pode
// ser obrigado a saber em qual dos dois conjuntos a chave caiu — essa é
// exatamente a pergunta cuja resposta mora neste arquivo. Os três chamadores
// (`conferirBloco` e `conferirLista`, lib/steps.ts, e `ChaveDoCampoLivre`,
// app/automacoes/editor/painel.tsx) já têm o texto cru em mãos.
export function fraseDaChaveQueColide(texto: string): string {
  const chave = formaDaChave(texto);
  if (chave !== null && CHAVES_DO_PERFIL.has(chave)) {
    // A FRASE DIZ O QUE IA ACONTECER, e não só "não pode": o estrago aqui é
    // silencioso (a mensagem sai preenchida, com o dado errado), então o dono
    // precisa entender por que um nome que "funcionaria" está sendo recusado.
    return (
      `Este nome já é uma variável do perfil do Instagram. Numa mensagem, ` +
      `{{${chave}}} mostra o que o Instagram diz sobre a pessoa — e não a resposta que ` +
      "você coletou. Escolha outro nome para este campo."
    );
  }
  return (
    `Este nome já é um campo do sistema (${camposDoSistemaEmProsa()}). Escolha outro nome, ` +
    "ou use o bloco do próprio campo — ele valida a resposta e guarda no lugar certo."
  );
}

// A OUTRA RECUSA: a chave existe, não colide com nada, e mesmo assim não vira
// variável ("123", "🔥"). `formaDaChave` exige pelo menos uma letra, e o porquê
// está nela. A frase dá um exemplo do que serve, e não só o que não serve.
export function fraseDaChaveSemLetra(): string {
  return (
    "O nome deste campo precisa ter pelo menos uma letra — só números ou só emoji não viram " +
    "variável. Tente algo como “cidade”."
  );
}
