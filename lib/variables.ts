// ============================================================
// Variáveis personalizadas nas mensagens ({{first_name}} etc.)
//
// Ponto único de definição. Nada nos fluxos existentes precisa mudar quando uma
// variável nova entra, porque a substituição acontece no momento do envio
// (`processItem`, lib/queue-drain.ts — a citação daqui dizia lib/engine.ts, e
// aquele arquivo não renderiza variável nenhuma), que é por onde TODA mensagem
// passa: DM de boas-vindas, link, lembrete, resposta pública, pedido de follow,
// pedido de dado e o que vier depois.
//
// SÃO DUAS FAMÍLIAS DE VARIÁVEL, e elas entram por portas diferentes:
//
//   AS DO PERFIL (`{{first_name}}`, `{{full_name}}`, `{{username}}`) são itens
//     escritos em VARIABLES, porque saem do que o Instagram entrega.
//   AS DOS DADOS COLETADOS saem de `contacts.campos`: as dos campos do sistema
//     NASCEM DO CATÁLOGO (`CAMPOS`, lib/campos.ts) e a do campo livre é
//     resolvida pela chave, fora de qualquer lista — o dono inventa o nome dela
//     no editor, e nenhuma lista deste arquivo poderia conhecê-lo de antemão.
//
// Sintaxe aceita:
//   {{first_name}}            → valor da variável
//   {{first_name|amigo}}      → valor, ou "amigo" se estiver vazio
// O espaçamento interno é tolerado: {{ first_name }} funciona igual.
// ============================================================

// Sem a extensão, como lib/engine.ts e lib/queue-drain.ts importam o catálogo.
// A forma com `.ts` (lib/steps.ts) existe por outro motivo: aquele arquivo é
// carregado DIRETO pelo node em `scripts/varredura-portao.mjs`, e ali o
// especificador precisa da extensão. Este não é.
import { CAMPOS, formaDaChave, type Registro } from "./campos";

// Dados da pessoa que interagiu. Campos opcionais porque o Instagram nem
// sempre entrega tudo (perfis sem nome público, por exemplo).
//
// `campos` É O REGISTRO DE `contacts.campos` já lido (`lerCampos`,
// lib/campos.ts), e não o `jsonb` cru: quem o lê é `variableContext`
// (lib/queue-drain.ts), num lugar só, e este arquivo não precisa saber que
// existe banco — é o que o mantém na suíte pura junto do catálogo.
//
// O `email` SAIU DAQUI NO PASSO 2a DA PARTE 2, e a saída não é arrumação: ele
// era a coluna `contacts.email`, carregada até aqui só para a queda do e-mail
// (logo abaixo) ter o que ler. Sem a queda, um campo que ninguém lê é um campo
// que a próxima consulta volta a trazer "porque o tipo pede".
//
// E TIRÁ-LO DO TIPO É O QUE FEZ O `tsc` APONTAR AS CONSULTAS. Os quatro lugares
// que montavam este contexto (`variableContext` em lib/queue-drain.ts,
// `contextoDoContato` em lib/exportacao-de-contatos.ts, `fichaDoColetado` em
// lib/ficha-do-coletado.ts e a página da conversa) selecionavam a coluna para
// preencher este campo; com o campo fora, cada um deles parou de compilar até a
// coluna sair do `select`. Deixá-lo opcional teria deixado os quatro `select`
// passarem calados, que é o defeito desta funcionalidade inteira.
export type VariableContext = {
  username?: string | null;
  name?: string | null;
  campos?: Registro;
};

export type VariableDef = {
  key: string;
  label: string;
  description: string;
  // Exemplo mostrado no seletor do editor.
  sample: string;
  resolve: (ctx: VariableContext) => string;
};

function firstName(ctx: VariableContext): string {
  const full = (ctx.name ?? "").trim();
  if (full) return full.split(/\s+/)[0] ?? "";
  // Sem nome público, o @ é o melhor substituto — melhor que texto vazio.
  return (ctx.username ?? "").trim();
}

// O VALOR COLETADO, LIDO DO REGISTRO — a única porta para `contacts.campos`
// neste arquivo. `trim` aqui e não em quem chama: um valor em branco gravado
// por fora (`lerCampos` aceita qualquer string) tem de contar como AUSENTE,
// senão a mensagem sai com um espaço no lugar do dado e o substituto que o dono
// escreveu (`{{cidade|algum lugar}}`) não vale — parece que funcionou.
function valorColetado(ctx: VariableContext, chave: string): string {
  return (ctx.campos?.get(chave)?.valor ?? "").trim();
}

// AS VARIÁVEIS DOS CAMPOS COLETADOS SÃO GERADAS DO CATÁLOGO, e não escritas à
// mão aqui — é a regra com dois donos que esta base persegue em toda parte.
//
// Escritas à mão, seriam quatro itens repetindo rótulo, exemplo e chave que já
// moram em `CAMPOS` (lib/campos.ts), e o quinto campo do catálogo nasceria sem
// variável nenhuma, calado: a automação coletaria o dado e a mensagem sairia com
// um buraco. Foi exatamente esse buraco que a Tarefa 5 prometeu na tela antes
// desta fiação existir.
//
// É UMA CHAVE SÓ, E O TOKEN É DERIVADO DELA. `c.chave` é onde o motor GRAVA o
// dado (`chaveDoPedido`, lib/steps.ts, devolve `p.campo` para campo do
// catálogo), e é também o nome que o dono escreve entre chaves na mensagem.
//
// HAVIA UM `c.variavel` AQUI, para o token, com a razão escrita de permitir
// renomear a variável sem migrar o banco — e este comentário afirmava que o
// caso "todo campo do catálogo tem variável, e ela lê a chave em que o motor
// grava" (tests/variables.test.ts) prendia a fiação entre os dois. A afirmação
// era FALSA como medida, e a revisão de 22/09/2026 a mediu: com os dois campos
// iguais nos quatro campos do catálogo, o caso não consegue distinguir qual dos
// dois está sendo lido — trocar um pelo outro deixava a suíte inteira verde.
// Comentário que mente sobre a própria rede é pior que comentário nenhum.
//
// O CAMPO SAIU DO TIPO (lib/campos.ts diz o porquê, onde ele morava): dois
// campos que precisam ser sempre iguais são uma regra com dois donos. O caso
// continua existindo e continua prendendo o que ele de fato prende — que TODO
// campo do catálogo ganha variável, e que ela lê a chave da gravação.
const VARIAVEIS_DE_CAMPO: VariableDef[] = CAMPOS.map((c) => ({
  key: c.chave,
  // O RÓTULO CHEIO ("Telefone / WhatsApp"), e não o `nomeCurto`: quem lê isto é
  // o seletor de variáveis do editor (app/automacoes/variable-picker.tsx), que
  // tem largura de botão e não as três telas apertadas para as quais o
  // `nomeCurto` existe.
  label: c.rotulo,
  // A DESCRIÇÃO É GERADA DA MESMA FONTE pelo mesmo motivo do resto: uma frase
  // por campo escrita à mão aqui voltaria a ser a segunda verdade sobre o que o
  // campo é, e ficaria para trás no dia do quinto campo.
  //
  // A FRASE É IMPESSOAL ("valor coletado ... no campo X") porque o rótulo entra
  // nela como CITAÇÃO, e não como sujeito: o e-mail escrevia "E-mail coletado
  // pela automação", que com os campos novos sairia "Data de nascimento
  // coletado" — concordância errada, na tela, gerada por um molde que não tem
  // como saber o gênero de um rótulo. Citar o rótulo entre aspas faz o molde
  // valer para qualquer campo que entre no catálogo depois.
  description: `Valor coletado pela automação no campo “${c.rotulo}”, quando houver.`,
  sample: c.exemplo,
  // O REGISTRO É A ÚNICA FONTE, E O E-MAIL DEIXOU DE SER EXCEÇÃO. Havia aqui
  // uma segunda fonte, escrita para uma chave só:
  //
  //     valorColetado(ctx, c.chave) ||
  //       (c.chave === "email" ? (ctx.email ?? "").trim() : "")
  //
  // Ela existia porque todo contato coletado antes da migração `012` tinha a
  // COLUNA `contacts.email` cheia e o registro vazio, e a `012` é aplicada À
  // MÃO, fora do build. Enquanto ela não tivesse rodado, tirar a queda apagaria
  // da tela e da DM o e-mail de gente que já estava no ar.
  //
  // A `012` RODOU, E A MEDIÇÃO É O QUE AUTORIZA ESTA LINHA — feita pelo dono em
  // produção, 25/09/2026: 9 contatos com e-mail, 9 com `campos->'email'`, 0 com
  // a coluna vazia, 0 com coluna e registro DIFERENTES. Não existe mais ninguém
  // cujo e-mail viva só na coluna, que era o único caso que a queda atendia.
  //
  // E O RISCO DE TIRÁ-LA ESTÁ ESCRITO, porque ele é real e é silencioso: um
  // contato que tivesse o e-mail só na coluna SOME do painel sem avisar — nada
  // acusa, porque o desfecho de "não tem e-mail" é legítimo. O que fecha esse
  // risco não é esta linha, é a outra metade do Passo 2a: `gravarCampo`
  // (lib/engine.ts) parou de escrever a coluna ANTES daqui, e a varredura dos
  // `insert`/`update` em `contacts` confirmou que nenhum outro caminho do
  // produto escreve nela — `upsertContact` (lib/engine.ts), o cron diário e o
  // botão de buscar perfis tocam `username`, `name` e `profile_pic`, e mais
  // nada. Sem escritor, a coluna não tem como voltar a ter um valor que o
  // registro não tenha.
  resolve: (ctx) => valorColetado(ctx, c.chave),
}));

export const VARIABLES: VariableDef[] = [
  {
    key: "first_name",
    label: "Primeiro nome",
    description: "Primeiro nome de quem interagiu. Se não houver, usa o @.",
    sample: "Ana",
    resolve: firstName,
  },
  {
    key: "full_name",
    label: "Nome completo",
    description: "Nome completo do perfil. Se não houver, usa o @.",
    sample: "Ana Souza",
    resolve: (ctx) => (ctx.name ?? "").trim() || (ctx.username ?? "").trim(),
  },
  {
    key: "username",
    label: "Username (@)",
    description: "O @ do perfil, sem a arroba.",
    sample: "ana.souza",
    resolve: (ctx) => (ctx.username ?? "").trim(),
  },
  // O E-MAIL SAIU DAQUI e entrou no grupo gerado: ele era o quarto item escrito
  // à mão, idêntico ao que `CAMPOS` já declara. Deixá-lo à mão faria o catálogo
  // deixar de ser o dono logo no campo mais antigo — e o rótulo, o exemplo e a
  // frase da descrição do e-mail passariam a viver em dois arquivos.
  //
  // O QUE FICA À MÃO ACIMA são as três variáveis que NÃO vêm de coleta: elas
  // saem do perfil do Instagram, não de `contacts.campos`, e não têm campo no
  // catálogo para nascer.
  ...VARIAVEIS_DE_CAMPO,
];

const BY_KEY = new Map(VARIABLES.map((v) => [v.key, v]));

/**
 * O VALOR DE UMA CHAVE, para quem NÃO está renderizando uma mensagem.
 *
 * ELA É O CORPO DO `replace` DE `renderVariables`, EXTRAÍDO — e não uma segunda
 * regra escrita ao lado. `renderVariables` a chama logo abaixo, então não há
 * como as duas divergirem: é a MESMA linha, com um nome.
 *
 * POR QUE ELA PRECISOU DE NOME, e a razão é do Passo 1 da Parte 2: as telas
 * pararam de ler `contacts.email` e passaram a perguntar "qual é o e-mail desta
 * pessoa?" — uma pergunta que NÃO tem token, nem substituto, nem texto em volta.
 * (O Passo 2a mudou a RESPOSTA, e não a pergunta: a queda para a coluna saiu do
 * `resolve` do e-mail, e hoje quem responde é só `contacts.campos`. Esta função
 * não sabia da coluna nem antes, e continua não sabendo — é o ponto dela.)
 * As duas formas de fazê-la sem isto eram piores:
 *
 *   `VARIABLES.find((v) => v.key === "email")?.resolve(ctx) ?? ""` abre um ramo
 *     de `undefined` que caso nenhum consegue alcançar — `VARIABLES` nasce de
 *     `CAMPOS` e o e-mail está lá. Guarda que ninguém prende é guarda que a
 *     próxima limpeza leva embora, e esta base já achou mais de dez assim.
 *   `renderVariables("{{email}}", ctx)` funciona, e põe a chave `email` escrita
 *     entre chaves num arquivo que não fala de mensagem nenhuma — uma segunda
 *     grafia da chave, longe de quem a declara.
 *
 * A CHAVE FORA DA LISTA FIXA CAI NO REGISTRO, igual ao envio: é o que paga a
 * dívida do campo livre, e quem perguntar por um campo que o dono inventou
 * recebe o que a pessoa respondeu. Não há ramo de "não existe".
 *
 * O `trim` FICA AQUI porque é aqui que o valor vira resposta: `resolve` de campo
 * do catálogo já apara, mas `first_name` e as outras do perfil não passam por
 * `valorColetado`, e um valor só de espaço tem de contar como AUSENTE para o
 * `||` de quem chama funcionar.
 */
export function valorDaVariavel(chave: string, ctx: VariableContext): string {
  const def = BY_KEY.get(chave);
  return def ? def.resolve(ctx).trim() : valorColetado(ctx, chave);
}

// {{ chave | fallback }} — a chave aceita letras (COM ACENTO), números e _
//
// O ACENTO ENTRA NO ALFABETO, e a mudança fecha um caminho de texto CRU para o
// lead. Medido em 22/09/2026: `renderVariables("de {{cidadã}}", ctx)` devolvia
// `"de {{cidadã}}"` — o token não casava com `[a-z0-9_]`, então não era
// resolvido NEM apagado, e as duas chaves saíam na mensagem de uma pessoa de
// verdade. Somos uma operação brasileira e quem nomeia o campo é o marketing:
// "Cidadã", "Profissão", "Endereço", "Irmão" são nomes prováveis, não exóticos.
//
// O CAMINHO SE FECHA NOS DOIS LADOS, e o outro lado já estava fechado: a chave
// GRAVADA nunca tem acento, porque `formaDaChave` (lib/campos.ts) tira o acento
// antes de qualquer outra coisa — "Cidadã" vira `cidada` no banco. O que
// faltava era o token digitado à mão chegar na mesma string, e é por isso que a
// resolução abaixo passa a chave capturada pela MESMA função, em vez de só
// minusculizá-la.
//
// O QUE CONTINUA DE FORA, dito para ninguém prometer demais: um token com
// ESPAÇO dentro (`{{Qual sua Cidade}}`) e um token só de emoji (`{{🔥}}`)
// continuam não casando, e continuam saindo crus. O primeiro a tela já
// desencoraja — o painel mostra ao dono a forma com underscore enquanto ele
// digita —, e o segundo `formaDaChave` recusa na origem: não existe campo
// gravado sob uma chave dessas para um token assim alcançar.
const TOKEN = /\{\{\s*([\p{L}\p{N}_]+)\s*(?:\|([^}]*))?\}\}/gu;

// Substitui as variáveis pelo valor real.
//
// A CHAVE QUE NÃO ESTÁ NA LISTA FIXA É PROCURADA NO REGISTRO, e é isto que paga
// a dívida da Tarefa 5: o editor mostra ao dono, enquanto ele digita o nome de
// um campo livre, que a resposta "vai virar `{{qual_sua_cidade}}`"
// (app/automacoes/editor/painel.tsx). Até esta fiação existir a frase era FALSA
// — a chave caía fora de `BY_KEY`, o token era apagado, e o lead recebia a
// mensagem com um buraco no lugar do dado que ele mesmo tinha respondido.
//
// A LISTA FIXA GANHA DO REGISTRO, e a ordem é a decisão do dono: `{{first_name}}`
// vem do Instagram mesmo que exista um campo coletado com esse nome.
//
// A PORTA DA FRENTE DESSE EMPATE FOI FECHADA, e não foi por esta ordem:
// `normalizarChaveLivre` (lib/campos.ts) passou a recusar `first_name`,
// `full_name` e `username` junto com os campos do catálogo, porque o empate
// levava o dono a ver na tela a promessa de `{{full_name}}` e o lead a receber
// o nome do Instagram no lugar da resposta coletada.
//
// E ELA FECHA NOS DOIS TEMPOS — medido em 23/09/2026, porque este comentário
// dizia que a ordem daqui atendia "automação salva antes da recusa", e isso
// é falso: `conferirBloco` (lib/steps.ts) TRAVA O SALVAR de um bloco com
// essas chaves, e `chaveDoPedido` (lib/steps.ts) devolve `null` para elas —
// a normalização acontece na LEITURA do passo, a cada mensagem, então nem uma
// automação gravada antes da recusa volta a escrever sob `first_name`.
//
// O QUE SOBROU, E É POR QUEM ESTA ORDEM RESPONDE: o dado que JÁ ESTÁ em
// `contacts.campos`, gravado enquanto a recusa não existia, e o que for
// escrito ali por fora do produto. `lerCampos` (lib/campos.ts) NÃO filtra
// chave reservada (medido), então um registro desses chega aqui inteiro — e
// sem esta ordem o lead receberia a resposta antiga no lugar do nome do
// perfil. É o caso "a lista fixa ganha do registro mesmo com a chave
// `first_name` GRAVADA nele" (tests/variables.test.ts) que a prende, e ele
// monta o registro direto porque é exatamente essa a forma que `lerCampos`
// devolve.
//
// A CHAVE DO TOKEN PASSA POR `formaDaChave` (lib/campos.ts), a MESMA função que
// produziu a chave gravada. Antes ela era só minusculizada, e o argumento
// escrito era que o alfabeto de `TOKEN` já era o alfabeto da normalização —
// deixou de ser: `TOKEN` agora aceita acento de propósito (o porquê está em
// cima dele), e é aqui que `{{Cidadã}}` e `cidada` viram a mesma string. Não é
// pedir a mesma resposta duas vezes: é reduzir DUAS escritas diferentes (a do
// banco, normalizada na gravação; a do dono, digitada à mão na mensagem) pela
// mesma régua, que é a única forma de elas se encontrarem.
//
// SEM VALOR, O TOKEN SOME — e some em silêncio, de propósito. Quem lê a mensagem
// é o LEAD, e um aviso no lugar do token ("[cidade não coletada]") seria lido
// por ele como defeito do produto, sobre algo que ele não pode resolver. O
// recurso do DONO para esse caso é o substituto (`{{cidade|algum lugar}}`), que
// o seletor de variáveis (app/automacoes/variable-picker.tsx) já promete ao
// lado do botão. Os casos que prendem os dois desfechos estão em
// tests/variables.test.ts.
//
// A RECÊNCIA NÃO ENTRA AQUI. `campoEstaFresco` (lib/campos.ts) responde "vale
// perguntar de novo?", e quem a consulta é o motor antes de mandar a pergunta —
// ela não responde "este dado é falso". Um telefone coletado há 31 dias
// continua sendo o telefone que a pessoa digitou, e apagá-lo devolveria o mesmo
// buraco desta dívida, agora com o dado em mãos. Medir tempo aqui também
// custaria um `Date.now()` no caminho do envio, sem `agora` por onde cravá-lo:
// todo caso que o prendesse apodreceria sozinho, como dois desta base
// apodreceram em 21/09/2026.
export function renderVariables(text: string, ctx: VariableContext): string {
  if (!text || !text.includes("{{")) return text;
  return text.replace(TOKEN, (_full, rawKey: string, fallback?: string) => {
    // `formaDaChave` devolve `null` para o que não vira nome de variável
    // ("123"): a string vazia no lugar dele não acha nada em `BY_KEY` nem no
    // registro, e o token some com o mesmo desfecho de sempre, em vez de
    // precisar de um ramo só para ele.
    const chave = formaDaChave(rawKey) ?? "";
    // PELA MESMA `valorDaVariavel` QUE AS TELAS USAM (acima), e não por uma
    // cópia desta expressão: é o que garante que a célula da tabela, a linha da
    // ficha e o arquivo do marketing falem do mesmo e-mail que a DM envia.
    const valor = valorDaVariavel(chave, ctx);
    return valor || (fallback ?? "").trim();
  });
}

// O QUE A PRÉVIA MOSTRA NO LUGAR DE UM CAMPO LIVRE, e por que não sai do
// catálogo: `CAMPOS.exemplo` (lib/campos.ts) é o dono dos exemplos, e campo
// livre não tem campo no catálogo para ter um — o dono acabou de inventar a
// pergunta, e nem esta base nem a tela sabem que resposta ela recebe.
//
// É UMA MARCA, E NÃO UM VALOR PLAUSÍVEL: os exemplos do catálogo são valores de
// verdade ("Ana", "(11) 99999-9999") porque dá para saber a forma deles; aqui
// não dá, e inventar um ("Osasco") faria a prévia afirmar algo sobre o campo do
// dono que ninguém sabe. Os colchetes são o que diz "isto é um lugar que vai
// ser preenchido" sem poder ser confundido com a resposta.
//
// O LIMITE, ESCRITO: a prévia não tem como saber se a chave é de um campo livre
// que existe na automação ou um nome digitado torto — ela recebe só o texto da
// mensagem. Os dois aparecem assim. E isso é honesto sobre o que o envio faz:
// `renderVariables` procura QUALQUER chave fora da lista fixa no registro do
// contato, então a marca quer dizer exatamente "se houver um campo coletado com
// este nome, a resposta dele entra aqui".
//
// E O LIMITE PARA ONDE A DÚVIDA ACABA: a chave que `formaDaChave` recusa
// (`{{123}}`, `{{🔥}}`) NÃO ganha esta marca, porque ali não há "se houver" —
// nenhum campo pode existir sob ela. O ramo que trata disso está dentro de
// `previewVariables`, com o porquê.
const EXEMPLO_DO_CAMPO_LIVRE = "[resposta coletada]";

// Pré-visualização no editor: mostra os exemplos, para o usuário ver como a
// mensagem fica sem precisar disparar a automação.
//
// A CHAVE LIVRE PREVÊ COMO AS OUTRAS, e o conserto é de uma assimetria que esta
// fiação criou: antes dela nenhum campo coletado previa nada (todos sumiam) e o
// dono lia isso como "a prévia não sabe de campo coletado"; depois dela seis
// das sete variáveis passaram a prever e só a do campo livre sumia — o que
// empurra o dono para a conclusão errada de que a CHAVE DELE está quebrada.
//
// E A CONFERÊNCIA É O QUE SUSTENTA O SILÊNCIO DO ENVIO. `renderVariables` apaga
// o token do campo não coletado de propósito, porque quem lê a mensagem é o
// lead — e isso só é seguro porque o dono tem como conferir ANTES de publicar.
// Com a conferência torta o risco é concreto: ele tira da mensagem o token que
// funciona, achando que está quebrado, e aí o lead recebe o buraco de verdade.
export function previewVariables(text: string): string {
  if (!text || !text.includes("{{")) return text;
  return text.replace(TOKEN, (_full, rawKey: string, fallback?: string) => {
    // A CHAVE PASSA PELA MESMA RÉGUA DO ENVIO, e é isto que mantém a prévia
    // e a mensagem falando da mesma variável: sem a normalização,
    // `{{Telefone}}` — a maiúscula do rótulo do botão, digitada à mão — cairia
    // na marca do campo livre AQUI e resolveria o telefone LÁ. Quem prende
    // isso é o caso "a caixa do token não importa" (tests/variables.test.ts).
    //
    // MEDIDO, para não prometer demais: como nenhuma chave do catálogo tem
    // acento, o caso prende a MINÚSCULA, não a escolha desta função sobre um
    // `toLowerCase()` — na prévia as duas dão o mesmo desfecho hoje. Ser a
    // MESMA função do envio é o que impede as duas de divergirem depois.
    const chave = formaDaChave(rawKey);
    // A CHAVE QUE NÃO VIRA NOME DE VARIÁVEL (`{{123}}`, `{{🔥}}`) PREVÊ O QUE O
    // ENVIO ENTREGA, e isto é o oposto do limite declarado logo acima.
    //
    // Lá a prévia não SABE se `{{cidade_x}}` é um campo que existe ou um nome
    // digitado torto — ela recebe só o texto da mensagem, e os dois são
    // possíveis. Aqui não há dúvida a ter: `formaDaChave` acabou de devolver
    // `null`, e `normalizarChaveLivre` (lib/campos.ts) recusa essa chave NA
    // ORIGEM — nenhum campo pode estar gravado sob ela, em nenhuma automação,
    // nem escrito por fora. A marca genérica diria "se houver um campo
    // coletado com este nome, a resposta dele entra aqui" sobre um nome em que
    // nunca vai haver campo nenhum.
    //
    // É A MESMA CLASSE DA DÍVIDA DESTA TAREFA, uma casa mais embaixo: a prévia
    // prometendo ao dono uma coisa que o envio não entrega. `renderVariables`
    // apaga este token (chave vazia, nada em `BY_KEY` nem no registro), e o que
    // o dono confere tem de ser isso — com o substituto dele ganhando nos dois
    // lados, que é o que o `fallback` abaixo faz.
    if (chave === null) return (fallback ?? "").trim();
    const def = BY_KEY.get(chave);
    if (def) return def.sample;
    // O SUBSTITUTO DO DONO GANHA DA MARCA quando ele escreveu um: é ele que a
    // mensagem vai mostrar de verdade se o dado não tiver sido coletado, então
    // é ele que a prévia tem de mostrar.
    return (fallback ?? "").trim() || EXEMPLO_DO_CAMPO_LIVRE;
  });
}
