import { describe, expect, it } from "vitest";
import { CAMPOS } from "@/lib/campos";
import { chaveDoPedido } from "@/lib/steps";
import { renderVariables, VARIABLES, type VariableContext } from "@/lib/variables";

// A DATA DOS CASOS É FIXA, e não `new Date()`: em 21/09/2026 dois casos desta
// base ficaram vermelhos sozinhos, meses depois de escritos, por cravarem uma
// data que já tinha passado. Aqui ela pode ser fixa sem apodrecer porque
// `renderVariables` NÃO mede recência — o porquê está em lib/variables.ts.
const COLETADO_ONTEM = "2026-09-21T00:00:00Z";
// Bem mais de 30 dias (`RECENCIA_EM_DIAS`, lib/campos.ts) antes de qualquer
// relógio que rode esta suíte — é o "vencido" que nunca deixa de ser vencido.
const COLETADO_EM_2020 = "2020-01-01T00:00:00Z";

describe("as variáveis dos campos coletados", () => {
  it("as variáveis novas resolvem do registro de campos", () => {
    const ctx = { username: "ana", name: "Ana", campos: new Map([
      ["telefone", { valor: "11999999999", em: COLETADO_ONTEM }],
      ["cidade",   { valor: "Osasco",      em: COLETADO_ONTEM }],
    ])};
    expect(renderVariables("zap {{telefone}} de {{cidade}}", ctx)).toBe("zap 11999999999 de Osasco");
  });

  it("{{first_name}} continua vindo do Instagram, e NÃO do nome informado", () => {
    // Decisão do dono, na spec: quem quiser o nome digitado escreve
    // {{nome_informado}}. Trocar isto faz uma resposta "kkkk" virar o nome em
    // toda mensagem futura.
    const ctx = { username: "ana", name: "Ana Souza", campos: new Map([
      ["nome_informado", { valor: "Aninha", em: COLETADO_ONTEM }],
    ])};
    expect(renderVariables("Oi {{first_name}}", ctx)).toBe("Oi Ana");
    expect(renderVariables("Oi {{nome_informado}}", ctx)).toBe("Oi Aninha");
  });

  it("todo campo do catálogo tem variável, e ela lê a chave em que o motor grava", () => {
    // O PORTÃO DA GERAÇÃO A PARTIR DO CATÁLOGO. Ele não nomeia os quatro campos
    // de propósito: o dia em que entrar um quinto em `CAMPOS` (lib/campos.ts),
    // a variável dele precisa nascer junto — e é este caso que fica vermelho se
    // alguém voltar a escrever a lista à mão aqui.
    //
    // ELE MEDE A FIAÇÃO INTEIRA, e não só a existência: a chave de GRAVAÇÃO é
    // `c.chave` (é o que `chaveDoPedido`, lib/steps.ts, devolve para campo do
    // catálogo) e o token da mensagem é `c.variavel`. São dois campos do
    // catálogo, e se eles divergirem o dado cai num lugar que a variável não lê.
    for (const c of CAMPOS) {
      expect(
        VARIABLES.some((v) => v.key === c.variavel),
        `o campo "${c.chave}" não tem variável em VARIABLES`
      ).toBe(true);
      const ctx: VariableContext = {
        campos: new Map([[c.chave, { valor: "VALOR-GRAVADO", em: COLETADO_ONTEM }]]),
      };
      expect(renderVariables(`x {{${c.variavel}}} y`, ctx)).toBe("x VALOR-GRAVADO y");
    }
  });

  it("{{email}} ainda cai na coluna `contacts.email` quando o registro não tem", () => {
    // `contacts.email` CONTINUA sendo escrita e lida nesta Parte 1 — a remoção
    // é da Parte 2. Sem esta queda, todo contato coletado ANTES desta fase
    // (que tem a coluna cheia e o registro vazio) perderia o `{{email}}` que
    // hoje funciona em produção.
    expect(renderVariables("oi {{email}}", { email: "ana@email.com" })).toBe("oi ana@email.com");
    // E o registro tem precedência, porque é ele que guarda o QUANDO.
    const ctx: VariableContext = {
      email: "velho@email.com",
      campos: new Map([["email", { valor: "novo@email.com", em: COLETADO_ONTEM }]]),
    };
    expect(renderVariables("oi {{email}}", ctx)).toBe("oi novo@email.com");
  });
});

describe("a promessa que o editor faz na tela", () => {
  it("a chave como o editor a grava chega na mensagem renderizada", () => {
    // A DÍVIDA DA TAREFA 5, PAGA AQUI. O painel mostra ao dono, enquanto ele
    // digita "Qual sua Cidade", que a resposta "vai virar {{qual_sua_cidade}}"
    // (app/automacoes/editor/painel.tsx). Este caso parte do bloco COMO O
    // EDITOR O GRAVA — texto cru — e mede o par exato que a tela promete.
    const passo = {
      tipo: "pedir_dado" as const,
      campo: "livre",
      texto: "De qual cidade você é?",
      chave: "Qual sua Cidade",
    };
    // A chave de gravação é a que o motor usa (`chaveDoPedido`, lib/steps.ts),
    // e não uma string normalizada à mão neste arquivo: uma cópia da regra aqui
    // mediria a cópia, e não a fiação.
    const chave = chaveDoPedido(passo)!;
    expect(chave).toBe("qual_sua_cidade");
    const ctx: VariableContext = {
      campos: new Map([[chave, { valor: "Osasco", em: COLETADO_ONTEM }]]),
    };
    expect(renderVariables("Você é de {{qual_sua_cidade}}?", ctx)).toBe("Você é de Osasco?");
  });

  it("a forma já normalizada no banco chega na MESMA variável", () => {
    // SÃO DUAS FORMAS GRAVADAS: o editor passou a gravar o texto CRU, e as
    // automações salvas antes disso têm a forma já normalizada. As duas
    // precisam chegar na mesma variável — é o motivo escrito da idempotência de
    // `normalizarChaveLivre` (lib/campos.ts), medido daqui até a mensagem.
    const antiga = chaveDoPedido({
      tipo: "pedir_dado",
      campo: "livre",
      texto: "De qual cidade você é?",
      chave: "qual_sua_cidade",
    })!;
    const nova = chaveDoPedido({
      tipo: "pedir_dado",
      campo: "livre",
      texto: "De qual cidade você é?",
      chave: "Qual sua Cidade",
    })!;
    expect(antiga).toBe(nova);
    const ctx: VariableContext = {
      campos: new Map([[antiga, { valor: "Osasco", em: COLETADO_ONTEM }]]),
    };
    expect(renderVariables("Você é de {{qual_sua_cidade}}?", ctx)).toBe("Você é de Osasco?");
  });
});

describe("o buraco: campo não coletado, e campo vencido", () => {
  it("campo nunca coletado SOME da mensagem, e o substituto do dono vale", () => {
    // O SILÊNCIO É ESCOLHA, e o motivo é quem lê a mensagem: ela vai para o
    // LEAD, não para o dono. Um aviso no lugar do token ("[cidade não
    // coletada]") seria lido pela pessoa do outro lado como defeito do produto,
    // e é ela quem menos pode fazer algo a respeito.
    //
    // E A PROMESSA JÁ ESTÁ NA TELA: o seletor de variáveis
    // (app/automacoes/variable-picker.tsx) diz ao dono, ao lado do botão, que
    // "se o perfil não tiver o dado, a variável some — use {{first_name|amigo}}
    // para definir um substituto". O substituto é a ferramenta DELE para o
    // buraco; trocar o silêncio por um aviso faria aquela frase mentir, que é
    // exatamente o defeito que esta tarefa está pagando.
    const vazio: VariableContext = { username: "ana", campos: new Map() };
    expect(renderVariables("Você é de {{qual_sua_cidade}}?", vazio)).toBe("Você é de ?");
    expect(renderVariables("Você é de {{qual_sua_cidade|onde}}?", vazio)).toBe("Você é de onde?");
    // Sem registro nenhum no contexto é o mesmo desfecho: contato que nunca
    // passou por uma automação de coleta não tem a coluna preenchida.
    expect(renderVariables("Você é de {{qual_sua_cidade}}?", { username: "ana" })).toBe(
      "Você é de ?"
    );
  });

  it("campo VENCIDO continua aparecendo — a recência decide perguntar, não mostrar", () => {
    // `campoEstaFresco` (lib/campos.ts) responde "vale perguntar de novo?", e
    // quem a consulta é o motor, ANTES de mandar a pergunta. Ela NÃO responde
    // "este dado é falso": um telefone coletado há 31 dias continua sendo o
    // telefone que a pessoa digitou, e apagá-lo da mensagem devolveria o buraco
    // que esta tarefa existe para fechar — agora com o dado em mãos.
    //
    // E MEDIR TEMPO AQUI CUSTARIA UM RELÓGIO NO ENVIO: `renderVariables` não
    // recebe `agora`, então a conta cairia em `Date.now()` no caminho do envio,
    // e todo caso que a prendesse apodreceria — foi o que aconteceu com dois
    // casos desta base em 21/09/2026.
    const ctx: VariableContext = {
      campos: new Map([["telefone", { valor: "11999999999", em: COLETADO_EM_2020 }]]),
    };
    expect(renderVariables("zap {{telefone}}", ctx)).toBe("zap 11999999999");
  });

  it("valor em branco no registro conta como não coletado", () => {
    // `lerCampos` (lib/campos.ts) aceita qualquer string como valor, e nada no
    // banco impede um `" "` gravado por fora. Sem o `trim`, a mensagem sairia
    // com um espaço no lugar do dado e o substituto do dono NÃO valeria — que é
    // o pior dos dois: parece que funcionou.
    const ctx: VariableContext = {
      campos: new Map([["cidade", { valor: "   ", em: COLETADO_ONTEM }]]),
    };
    expect(renderVariables("de {{cidade|algum lugar}}", ctx)).toBe("de algum lugar");
  });
});
