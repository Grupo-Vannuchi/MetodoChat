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
import { CAMPOS, type Registro } from "./campos";

// Dados da pessoa que interagiu. Campos opcionais porque o Instagram nem
// sempre entrega tudo (perfis sem nome público, por exemplo).
//
// `campos` É O REGISTRO DE `contacts.campos` já lido (`lerCampos`,
// lib/campos.ts), e não o `jsonb` cru: quem o lê é `variableContext`
// (lib/queue-drain.ts), num lugar só, e este arquivo não precisa saber que
// existe banco — é o que o mantém na suíte pura junto do catálogo.
export type VariableContext = {
  username?: string | null;
  name?: string | null;
  email?: string | null;
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
// SÃO DUAS CHAVES DO CATÁLOGO, e elas fazem coisas diferentes: `c.variavel` é o
// TOKEN que o dono escreve na mensagem, e `c.chave` é onde o motor GRAVA o dado
// (`chaveDoPedido`, lib/steps.ts, devolve `p.campo` para campo do catálogo).
// Hoje as duas coincidem; separá-las é o que permitiria renomear a variável sem
// migrar o que já está no banco. Quem prende a fiação entre elas é o caso "todo
// campo do catálogo tem variável, e ela lê a chave em que o motor grava"
// (tests/variables.test.ts) — sem ele, uma divergência deixaria a variável vazia
// para sempre sem nada acusar.
const VARIAVEIS_DE_CAMPO: VariableDef[] = CAMPOS.map((c) => ({
  key: c.variavel,
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
  resolve: (ctx) =>
    valorColetado(ctx, c.chave) ||
    // A SEGUNDA FONTE É SÓ DO E-MAIL, e ela é transitória: `contacts.email`
    // continua sendo escrita e lida nesta Parte 1 (a remoção é da Parte 2), e
    // todo contato coletado ANTES desta fase tem a COLUNA cheia e o registro
    // vazio. Sem esta queda, o `{{email}}` que hoje funciona em produção
    // passaria a sair em branco para essas pessoas — um recurso novo quebrando
    // o que já estava no ar.
    //
    // O REGISTRO TEM PRECEDÊNCIA porque é ele que guarda o QUANDO; a coluna não
    // tem data nem origem de coleta. Quem escreve os dois lugares é UMA função
    // (`gravarCampo`, lib/engine.ts), então eles não divergem por si.
    (c.chave === "email" ? (ctx.email ?? "").trim() : ""),
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

// {{ chave | fallback }} — a chave aceita letras, números e _
const TOKEN = /\{\{\s*([a-z0-9_]+)\s*(?:\|([^}]*))?\}\}/gi;

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
// vem do Instagram mesmo que exista um campo coletado com esse nome. Um campo
// livre chamado "First Name" normaliza para `first_name` e não colide com o
// catálogo (`normalizarChaveLivre`, lib/campos.ts, só barra os quatro campos do
// sistema), então esse empate é montável na tela — e quem o vence é a lista.
//
// A CHAVE DO TOKEN SÓ É MINUSCULIZADA, e não renormalizada por `formaDaChave`:
// o alfabeto que `TOKEN` aceita (`[a-z0-9_]`) JÁ É o alfabeto que a
// normalização produz — sem acento, sem espaço, sem pontuação além do
// underscore. Chamar a normalização aqui seria pedir a mesma resposta duas
// vezes, e a segunda chamada é onde uma divergência futura se esconderia.
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
    const chave = rawKey.toLowerCase();
    const def = BY_KEY.get(chave);
    const valor = def ? def.resolve(ctx).trim() : valorColetado(ctx, chave);
    return valor || (fallback ?? "").trim();
  });
}

// Pré-visualização no editor: mostra os exemplos, para o usuário ver como a
// mensagem fica sem precisar disparar a automação.
export function previewVariables(text: string): string {
  if (!text || !text.includes("{{")) return text;
  return text.replace(TOKEN, (_full, rawKey: string, fallback?: string) => {
    const def = BY_KEY.get(rawKey.toLowerCase());
    return def ? def.sample : (fallback ?? "").trim();
  });
}

// Regex própria: TOKEN é global e .test() guarda lastIndex entre chamadas,
// o que faria esta função alternar entre true e false para o mesmo texto.
export function hasVariables(text: string): boolean {
  return Boolean(text) && /\{\{\s*[a-z0-9_]+\s*(\|[^}]*)?\}\}/i.test(text);
}
