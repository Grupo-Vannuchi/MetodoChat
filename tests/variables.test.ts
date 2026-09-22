import { describe, expect, it } from "vitest";
import { CAMPOS, CHAVES_DO_PERFIL, campoPorChave } from "@/lib/campos";
import { chaveDoPedido } from "@/lib/steps";
import {
  previewVariables,
  renderVariables,
  VARIABLES,
  type VariableContext,
} from "@/lib/variables";

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
    // ELE MEDE A FIAÇÃO INTEIRA, e não só a existência: a variável tem de LER a
    // chave em que o motor grava (`chaveDoPedido`, lib/steps.ts, devolve
    // `p.campo` para campo do catálogo). O contexto abaixo é montado pela chave
    // de GRAVAÇÃO, e o token da mensagem é a mesma chave — este caso já não
    // afirma prender um par `variavel` × `chave`, porque esse par saiu do tipo
    // (lib/campos.ts diz por quê) depois de a revisão medir que ele não era
    // prendido por nada.
    for (const c of CAMPOS) {
      expect(
        VARIABLES.some((v) => v.key === c.chave),
        `o campo "${c.chave}" não tem variável em VARIABLES`
      ).toBe(true);
      const ctx: VariableContext = {
        campos: new Map([[c.chave, { valor: "VALOR-GRAVADO", em: COLETADO_ONTEM }]]),
      };
      expect(renderVariables(`x {{${c.chave}}} y`, ctx)).toBe("x VALOR-GRAVADO y");
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

describe("as três redes que a revisão achou sem dono", () => {
  it("SÓ o {{email}} cai na coluna `contacts.email` — nenhuma outra variável", () => {
    // A REDE DO LADO DE QUEM *PODE* CAIR. O caso do `{{email}}` (acima) mede o
    // lado de quem cai; este mede quem NÃO pode. Sem ele, a restrição
    // `c.chave === "email"` (lib/variables.ts) some sem nada acusar, e TODO
    // campo do catálogo passa a cair na coluna do e-mail: um contato com a
    // coluna cheia e sem telefone coletado faria `Anotado: {{telefone}}.` sair
    // como `Anotado: ana@email.com.` — o e-mail dele no lugar do telefone, para
    // um lead de verdade.
    const ctx: VariableContext = { email: "ana@email.com" };
    expect(renderVariables("Anotado: {{telefone}}.", ctx)).toBe("Anotado: .");
    // E vale para os outros campos do catálogo, não só para o telefone: a queda
    // é escrita por chave, e é o catálogo inteiro menos o e-mail que ela exclui.
    for (const c of CAMPOS) {
      if (c.chave === "email") continue;
      expect(renderVariables(`x {{${c.chave}}} y`, ctx), c.chave).toBe("x  y");
    }
  });

  it("a lista fixa ganha do registro mesmo com a chave `first_name` GRAVADA nele", () => {
    // O EMPATE DE VERDADE, e ele não é o do caso do nome informado: lá o
    // registro tem `nome_informado` e `{{first_name}}` nunca encontra chave
    // nenhuma no mapa — com a precedência invertida o desfecho seria o mesmo.
    // Só com a chave `first_name` DENTRO do registro a ordem decide algo.
    //
    // COMO UM REGISTRO ASSIM EXISTE, agora que `normalizarChaveLivre`
    // (lib/campos.ts) recusa essas três chaves: automação salva ANTES dessa
    // recusa, ou `contacts.campos` escrito por fora. A recusa fecha a porta
    // nova; esta ordem é quem atende quem já entrou por ela.
    const ctx: VariableContext = {
      username: "ana.souza",
      name: "Ana Souza",
      campos: new Map([
        ["first_name", { valor: "Padaria do Zé", em: COLETADO_ONTEM }],
        ["full_name", { valor: "Padaria do Zé", em: COLETADO_ONTEM }],
        ["username", { valor: "Padaria do Zé", em: COLETADO_ONTEM }],
      ]),
    };
    expect(renderVariables("Oi {{first_name}}", ctx)).toBe("Oi Ana");
    expect(renderVariables("Sua empresa: {{full_name}}", ctx)).toBe("Sua empresa: Ana Souza");
    expect(renderVariables("@ {{username}}", ctx)).toBe("@ ana.souza");
  });

  it("o seletor do editor lê o catálogo: rótulo cheio, exemplo do catálogo, rótulo CITADO", () => {
    // OS TRÊS CAMPOS GERADOS que a revisão mediu sem dono: `label`,
    // `description` e `sample`. Eles são a única mudança de TELA desta fiação,
    // e cada asserção aqui mede uma decisão escrita em lib/variables.ts.
    for (const c of CAMPOS) {
      const v = VARIABLES.find((x) => x.key === c.chave)!;
      // O RÓTULO CHEIO ("Telefone / WhatsApp"), e não o `nomeCurto`: quem lê é
      // o botão do seletor, que tem largura — o `nomeCurto` existe para as três
      // telas apertadas do editor, e trocá-lo aqui devolve "Telefone" ao botão.
      expect(v.label, c.chave).toBe(c.rotulo);
      // O EXEMPLO É O DO CATÁLOGO: zerado, a prévia do editor volta a apagar a
      // variável, que é o defeito do Conserto da prévia, agora pela outra ponta.
      expect(v.sample, c.chave).toBe(c.exemplo);
      // O RÓTULO ENTRA COMO CITAÇÃO, E NÃO COMO SUJEITO — é isto que conserta a
      // concordância: como sujeito, o molde escreve "Data de nascimento
      // coletado", porque não tem como saber o gênero de um rótulo.
      expect(v.description, c.chave).toContain(`“${c.rotulo}”`);
      expect(v.description.startsWith(c.rotulo), c.chave).toBe(false);
    }
  });
});

describe("a chave do token, e o que ela aceita", () => {
  it("a caixa do token não importa: {{First_Name}} resolve igual", () => {
    // A LINHA QUE ISTO PRENDE normaliza a chave capturada antes de procurá-la.
    // Sem ela `{{First_Name}}` não acha a variável do perfil e `{{Qual_Sua_
    // Cidade}}` não acha o campo livre — os dois somem da mensagem do lead.
    const ctx: VariableContext = {
      name: "Ana Souza",
      campos: new Map([["qual_sua_cidade", { valor: "Osasco", em: COLETADO_ONTEM }]]),
    };
    expect(renderVariables("Oi {{First_Name}}", ctx)).toBe("Oi Ana");
    expect(renderVariables("de {{Qual_Sua_Cidade}}", ctx)).toBe("de Osasco");
  });

  it("token com ACENTO chega no mesmo campo, e nunca sai cru para o lead", () => {
    // SOMOS UMA OPERAÇÃO BRASILEIRA, e o campo livre faz o dono nomear o campo
    // em português: "Cidadã", "Profissão", "Endereço", "Irmão". A chave gravada
    // NUNCA tem acento (`formaDaChave`, lib/campos.ts, tira o acento antes de
    // qualquer coisa), mas o dono digita o token À MÃO — o seletor não oferece
    // chave livre — e pode copiar o acento do rótulo que ele mesmo escreveu.
    //
    // SEM ISTO O TOKEN NÃO CASA: ele não é resolvido NEM apagado, e
    // `{{cidadã}}` sai CRU no meio da mensagem que o lead recebe.
    const chave = chaveDoPedido({
      tipo: "pedir_dado",
      campo: "livre",
      texto: "De qual cidade você é?",
      chave: "Cidadã",
    })!;
    expect(chave).toBe("cidada");
    const ctx: VariableContext = {
      campos: new Map([[chave, { valor: "Osasco", em: COLETADO_ONTEM }]]),
    };
    expect(renderVariables("Você é de {{cidadã}}?", ctx)).toBe("Você é de Osasco?");
    // E sem o dado ele SOME, como todo token — o que não pode é sair cru.
    expect(renderVariables("Você é de {{cidadã}}?", { campos: new Map() })).toBe("Você é de ?");
  });
});

describe("a prévia do editor", () => {
  it("a chave livre prevê como as outras — a conferência do dono não pode ser torta", () => {
    // O QUE ESTE CASO FECHA: seis das sete variáveis previam e só a do campo
    // livre sumia. O dono confere a mensagem antes de publicar, lê "Você é de
    // ?", conclui que a chave DELE está quebrada e TIRA o token que funcionava
    // — e aí o lead recebe o buraco de verdade. O silêncio no envio só é seguro
    // porque a conferência existe.
    expect(previewVariables("Você é de {{qual_sua_cidade}}?")).toBe(
      "Você é de [resposta coletada]?"
    );
    // O SUBSTITUTO DO DONO GANHA DA MARCA GENÉRICA: é ele que a mensagem vai
    // mostrar de verdade quando o dado não tiver sido coletado.
    expect(previewVariables("Você é de {{qual_sua_cidade|algum lugar}}?")).toBe(
      "Você é de algum lugar?"
    );
    // E as do catálogo continuam mostrando o exemplo DO CATÁLOGO — lido dele, e
    // não copiado para cá.
    expect(previewVariables("Anotado: {{telefone}}.")).toBe(
      `Anotado: ${campoPorChave("telefone")!.exemplo}.`
    );
  });
});

describe("as chaves que o campo livre não pode usar", () => {
  it("as três chaves recusadas do perfil são as variáveis que NÃO nascem do catálogo", () => {
    // A LISTA MORA EM lib/campos.ts (`CHAVES_DO_PERFIL`) e as variáveis moram
    // em lib/variables.ts, porque `variables` importa `campos` e ler de volta
    // fecharia o ciclo de import. São duas listas que precisam concordar, e
    // ESTE caso é o dono da concordância: uma quarta variável de perfil escrita
    // à mão em VARIABLES, sem entrar na recusa, deixa este caso vermelho — em
    // vez de deixar um campo livre com aquele nome devolver o dado do perfil
    // para um lead de verdade.
    const doCatalogo = new Set(CAMPOS.map((c) => c.chave));
    const naoNascemDoCatalogo = VARIABLES.filter((v) => !doCatalogo.has(v.key)).map((v) => v.key);
    expect([...CHAVES_DO_PERFIL].sort()).toEqual([...naoNascemDoCatalogo].sort());
  });
});
