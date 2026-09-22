import { describe, expect, it } from "vitest";
import {
  CAMPOS,
  camposDoSistemaEmProsa,
  campoEstaFresco,
  campoPorChave,
  fraseDaChaveQueColide,
  fraseDaChaveSemLetra,
  lerCampos,
  listaEmProsa,
  normalizarChaveLivre,
  RECENCIA_EM_DIAS,
  REPERGUNTAR_LIVRE,
  regraDoCampo,
} from "@/lib/campos";
import { extractEmail } from "@/lib/match";

const telefone = (t: string) => campoPorChave("telefone")!.extrair(t);

describe("extrair telefone", () => {
  it("acha o número dentro da frase, que é como as pessoas respondem", () => {
    expect(telefone("meu zap é (11) 99999-9999")).toBe("11999999999");
    expect(telefone("11999999999")).toBe("11999999999");
    expect(telefone("+55 11 99999 9999")).toBe("11999999999");
    expect(telefone("fixo: 1133334444")).toBe("1133334444");
  });

  it("recusa o que não tem 10 ou 11 dígitos — e isso descarta ano", () => {
    // A REGRA É POR QUANTIDADE DE DÍGITOS, e não por lista de exceções: "1990"
    // não é telefone porque tem 4 dígitos, não porque "parece ano". O CPF NÃO
    // está nesta lista: ele também tem 11 dígitos, então contagem sozinha não
    // o distingue de celular — isso é o caso seguinte.
    expect(telefone("nasci em 1990")).toBe(null);
    expect(telefone("123")).toBe(null);
    expect(telefone("não tenho")).toBe(null);
  });

  it("recusa CPF de 11 dígitos pela forma, não pela quantidade", () => {
    // CPF tem 11 dígitos — o mesmo tanto que celular — e por isso CONTAR
    // dígitos não separa um do outro; o caso anterior só descarta o que tem
    // dígito de menos (ano, índice). O que separa é o plano de numeração:
    // todo celular brasileiro de 11 dígitos tem "9" como TERCEIRO dígito
    // (DDD + 9 + oito dígitos, regra vigente desde 2016), e CPF não segue essa
    // forma — não é lista de exceções, é a forma que todo celular tem. Cobre
    // o CPF pontuado (que agora é um bloco só, já que "." virou separador de
    // telefone — ver "aceita o ponto...") e o CPF sem pontuação nenhuma, que
    // sem esta regra passaria pela contagem de dígitos como se fosse celular.
    expect(telefone("111.222.333-44")).toBe(null);
    expect(telefone("meu cpf e 11122233344")).toBe(null);
  });

  it("aceita o ponto como separador — é escrita comum de celular no Brasil", () => {
    expect(telefone("11.99999-9999")).toBe("11999999999");
    expect(telefone("11.99999.9999")).toBe("11999999999");
  });

  it("tira o zero de discagem antigo grudado no DDD", () => {
    // "(011)" é o formato "0 + DDD" do prefixo de interurbano antigo — o zero
    // é prefixo de discagem, não dado. Nenhum DDD brasileiro começa com zero;
    // sem tirar esse zero o valor gravado teria 11 dígitos com um DDD de três
    // dígitos, que não disca nem exporta igual aos telefones dos outros
    // contatos.
    expect(telefone("tel (011) 3333-4444")).toBe("1133334444");
  });

  it("guarda só os dígitos, sem DDI — é o que dá para exportar e discar", () => {
    expect(telefone("+5511999999999")).toBe("11999999999");
  });

  it("não confunde DDD 55 (Rio Grande do Sul) com o DDI do Brasil", () => {
    // A guarda do DDI só corta quando SOBRA dígito demais para ser DDD+número
    // (`digitosBrutos.length > 11`). Sem essa condição, "55 3334-4444" — DDD
    // do Rio Grande do Sul, não DDI — perderia os dois primeiros dígitos à
    // toa, e todo contato gaúcho viraria `null` em silêncio. Este caso é o
    // que prende essa guarda: um refactor que apague a condição precisa
    // ficar vermelho aqui, não só sobreviver por acaso.
    expect(telefone("55 3334-4444")).toBe("5533344444");
    expect(telefone("55 99999-9999")).toBe("55999999999");
  });
});

describe("extrair e-mail", () => {
  it("é extractEmail de lib/match por IDENTIDADE, não uma regex nova", () => {
    // Prender por identidade, e não por comportamento: comparar resultado
    // contra alguns e-mails de exemplo deixaria passar uma regex nova que
    // imita os casos testados e diverge numa borda que ninguém pensou. Só
    // existe UMA função que decide o que é e-mail válido nesta base, e é
    // esta comparação — `toBe`, não `toEqual` — que garante que o catálogo
    // continua apontando para ELA, não para uma cópia parecida.
    expect(campoPorChave("email")!.extrair).toBe(extractEmail);
  });
});

// -----------------------------------------------------------------------------
// OS DOIS NOMES DE CADA CAMPO, E POR QUE SÃO DOIS.
//
// `rotulo` é o nome CHEIO do campo — o que ele guarda, dito para quem monta a
// automação: "Telefone / WhatsApp" existe para o marketing saber que aquele
// campo serve para o zap. Ele é valor LITERAL do brief da Tarefa 1, que está
// completa, e este caso é o que impede a próxima tela apertada de encurtá-lo de
// novo: já aconteceu uma vez, e a suíte inteira ficou verde.
//
// `nomeCurto` é o nome do BLOCO nas três telas estreitas do editor (a faixa da
// paleta, o título do nó e a frase do campo repetido), e os valores dele saem
// do brief da Tarefa 5. Encurtar o DADO para caber na TELA é estragar o modelo
// para resolver apresentação — o que a tela precisa é de um campo de
// apresentação, e é este.
// -----------------------------------------------------------------------------

describe("os nomes do catálogo", () => {
  it("o rótulo cheio é o do brief da Tarefa 1, campo a campo", () => {
    const cheio = Object.fromEntries(CAMPOS.map((c) => [c.chave, c.rotulo]));
    expect(cheio).toEqual({
      email: "E-mail",
      telefone: "Telefone / WhatsApp",
      nome_informado: "Nome informado",
      nascimento: "Data de nascimento",
    });
  });

  it("o nome curto é o do brief da Tarefa 5 — e é ele, não o rótulo, que a tela lê", () => {
    const curto = Object.fromEntries(CAMPOS.map((c) => [c.chave, c.nomeCurto]));
    expect(curto).toEqual({
      email: "E-mail",
      telefone: "Telefone",
      nome_informado: "Nome",
      nascimento: "Nascimento",
    });
  });
});

const nome = (t: string) => campoPorChave("nome_informado")!.extrair(t);

describe("extrair nome informado", () => {
  it("tira o prefixo comum e devolve o nome", () => {
    expect(nome("Ana")).toBe("Ana");
    expect(nome("meu nome é Ana Souza")).toBe("Ana Souza");
    expect(nome("  Ana  ")).toBe("Ana");
  });

  it("tira o prefixo mesmo quando a pessoa escreve sem capricho", () => {
    expect(nome("sou a ana")).toBe("ana");
    expect(nome("me chamo Ana")).toBe("Ana");
  });

  it("aceita 'sou' sem artigo, e 'eu sou', sem comer nome parecido", () => {
    // "sou Ana", sem artigo, é forma tão comum quanto "sou a Ana" — e o
    // motivo do prefixo (não deixar `{{nome_informado}}` mandar "Oi sou a
    // ana") vale igual aqui: sem estender, "sou Ana" escapava e devolvia a
    // frase inteira.
    expect(nome("sou Ana")).toBe("Ana");
    expect(nome("eu sou a Ana")).toBe("Ana");
    expect(nome("eu sou Ana Souza")).toBe("Ana Souza");
    // "Sousa" começa com as mesmas quatro letras de "sou" + vogal, mas sem
    // espaço depois de "sou" — o prefixo só pode comer "sou"/"eu sou"
    // SEGUIDOS DE ESPAÇO, senão um sobrenome de verdade vira "sa".
    expect(nome("Sousa")).toBe("Sousa");
  });

  it("aceita o desleixado que NÃO tem prefixo, em vez de recusar", () => {
    // A RECUSA É FRACA DE PROPÓSITO: uma lista de palavras proibidas sempre
    // erra alguém. O custo de aceitar "ana 😊" é menor que o de recusar um nome
    // de verdade porque veio com emoji junto.
    expect(nome("ana 😊")).toBe("ana 😊");
    expect(nome("Ana!")).toBe("Ana!");
  });

  it("recusa o que claramente não é nome", () => {
    expect(nome("")).toBe(null);
    expect(nome("   ")).toBe(null);
    expect(nome("🔥🔥🔥")).toBe(null);
    expect(nome("a".repeat(61))).toBe(null);
  });
});

const nasc = (t: string) => campoPorChave("nascimento")!.extrair(t);

describe("extrair nascimento", () => {
  it("aceita os formatos que as pessoas escrevem", () => {
    expect(nasc("01/02/1990")).toBe("1990-02-01");
    expect(nasc("1990-02-01")).toBe("1990-02-01");
    expect(nasc("nasci em 01/02/1990")).toBe("1990-02-01");
  });

  it("recusa data impossível e data no futuro", () => {
    // `new Date("2026-02-30")` NÃO lança: ele rola para 2 de março. Sem a
    // conferência de volta, "30/02" viraria uma data válida e errada.
    expect(nasc("30/02/1990")).toBe(null);
    expect(nasc("01/02/2099")).toBe(null);
  });
});

describe("campoEstaFresco", () => {
  // O INSTANTE É PARÂMETRO, e isto não é preferência: em 21/09/2026 dois casos
  // desta base ficaram vermelhos sozinhos por cravarem uma data que passou, num
  // bloco cujo comentário JÁ PREVIA que isso ia acontecer. Prever não é
  // consertar.
  const AGORA = Date.parse("2026-09-21T12:00:00Z");
  const diasAtras = (n: number) => new Date(AGORA - n * 86400_000).toISOString();

  it("29 dias é fresco; 31 não é", () => {
    expect(campoEstaFresco(diasAtras(29), AGORA)).toBe(true);
    expect(campoEstaFresco(diasAtras(31), AGORA)).toBe(false);
  });

  it("a borda de 30 dias é fresca — o prazo é 'menos de 30 dias' contado a favor", () => {
    expect(campoEstaFresco(diasAtras(30), AGORA)).toBe(true);
  });

  it("sem data, não é fresco — é o que faz o passo perguntar", () => {
    expect(campoEstaFresco(null, AGORA)).toBe(false);
  });

  it("o prazo é o declarado na spec", () => {
    expect(RECENCIA_EM_DIAS).toBe(30);
  });

  it("data no FUTURO não é fresca — reperguntar é o desfecho seguro quando o dado é suspeito", () => {
    // `agora - quando` fica NEGATIVO quando `quando` está no futuro, e um
    // negativo é sempre `<= RECENCIA_EM_MS` — a aritmética sozinha trataria
    // qualquer data futura como "acabou de ser coletada". Um `em` corrompido
    // no futuro (relógio errado no servidor, defeito em quem grava a data)
    // faria a automação PULAR a pergunta para sempre, em vez de repetir — que
    // é exatamente a direção errada: o desfecho seguro do "não sei" é
    // perguntar de novo, nunca pular.
    const amanha = new Date(AGORA + 86400_000).toISOString();
    const umAnoAFrente = new Date(AGORA + 365 * 86400_000).toISOString();
    expect(campoEstaFresco(amanha, AGORA)).toBe(false);
    expect(campoEstaFresco(umAnoAFrente, AGORA)).toBe(false);
  });
});

describe("normalizarChaveLivre", () => {
  it("vira chave de variável: minúscula, sem acento, com underscore", () => {
    expect(normalizarChaveLivre("Qual sua Cidade")).toBe("qual_sua_cidade");
    expect(normalizarChaveLivre("  Profissão  ")).toBe("profissao");
  });

  it("recusa o que colide com campo conhecido", () => {
    // Um campo livre chamado `email` gravaria por cima do e-mail de verdade sem
    // extração nenhuma, e `{{email}}` passaria a devolver o que a pessoa
    // digitou em qualquer formato.
    expect(normalizarChaveLivre("E-mail")).toBe(null);
    expect(normalizarChaveLivre("telefone")).toBe(null);
  });

  it("recusa também as três variáveis do PERFIL — elas GANHAM na mensagem", () => {
    // MEDIDO PONTA A PONTA NA REVISÃO: um campo livre chamado "Full Name"
    // normaliza para `full_name`, o painel promete ao dono que a resposta "vai
    // virar {{full_name}}", e `renderVariables` (lib/variables.ts) devolve o
    // NOME DO INSTAGRAM — porque a lista fixa ganha do registro. A mensagem sai
    // preenchida, com o valor errado, e o dono nunca descobre. É a mesma classe
    // da colisão com `email`, e é pior que buraco: buraco se vê.
    expect(normalizarChaveLivre("First Name")).toBe(null);
    expect(normalizarChaveLivre("Full Name")).toBe(null);
    expect(normalizarChaveLivre("Username")).toBe(null);
    // E pela forma já normalizada também — é ela que chega do banco.
    expect(normalizarChaveLivre("first_name")).toBe(null);
    expect(normalizarChaveLivre("full_name")).toBe(null);
    expect(normalizarChaveLivre("username")).toBe(null);
  });

  it("a saída dela sobrevive a ela mesma — o underscore não some na segunda passada", () => {
    // ISTO É PRÉ-REQUISITO DE `chaveDoPedido` (lib/steps.ts), e não capricho:
    // o banco tem DUAS formas da chave e o motor tem de chegar na mesma string
    // a partir das duas. O editor grava o texto CRU que o dono digitou
    // (app/automacoes/editor/painel.tsx), mas as automações salvas ANTES desse
    // conserto guardam a forma já normalizada — e é essa que passa pela função
    // uma SEGUNDA vez, a cada mensagem. Se ela comesse o próprio underscore, o
    // bloco velho (`qual_sua_cidade`) passaria a gravar o dado da pessoa sob
    // `qualsuacidade` e a variável `{{qual_sua_cidade}}` das mensagens ficaria
    // eternamente vazia, sem nada acusar. (Coluna de CSV NÃO entra na conta: o
    // CSV de contatos, app/api/contatos/csv/route.ts, tem duas colunas fixas e
    // não lê `contacts.campos`.)
    const uma = normalizarChaveLivre("Qual sua Cidade");
    expect(uma).toBe("qual_sua_cidade");
    expect(normalizarChaveLivre(uma!)).toBe(uma);
  });

  it("recusa o vazio e o que não tem letra", () => {
    expect(normalizarChaveLivre("   ")).toBe(null);
    expect(normalizarChaveLivre("🔥")).toBe(null);
    // Chave só-dígito também não tem letra nenhuma — e `{{123}}` não serve
    // como nome de variável de template para ninguém ler depois. Aceitar
    // "123" hoje só adiaria esse problema para quando alguém tentasse usar a
    // variável.
    expect(normalizarChaveLivre("123")).toBe(null);
  });
});

describe("lerCampos", () => {
  it("lê o registro do jsonb, ignorando o que não tem forma", () => {
    const r = lerCampos({
      telefone: { valor: "11999999999", em: "2026-09-01T00:00:00Z" },
      lixo: "não é objeto",
      vazio: { em: "2026-09-01T00:00:00Z" },
    });
    expect(r.get("telefone")).toEqual({ valor: "11999999999", em: "2026-09-01T00:00:00Z" });
    expect(r.has("lixo")).toBe(false);
    expect(r.has("vazio")).toBe(false);
  });

  it("jsonb nulo ou vazio vira registro vazio, e não estoura", () => {
    expect(lerCampos(null).size).toBe(0);
    expect(lerCampos({}).size).toBe(0);
  });

  it("recusa `em` que não é string, mesmo com `valor` certo", () => {
    // `em` alimenta `campoEstaFresco`, que faz `Date.parse` nele. Um `em`
    // numérico ou objeto passaria pela checagem de `valor` sozinha e só
    // quebraria (ou mentiria) lá na frente, longe de onde a leitura aconteceu.
    const r = lerCampos({
      numerico: { valor: "x", em: 123 },
      objeto: { valor: "x", em: {} },
    });
    expect(r.has("numerico")).toBe(false);
    expect(r.has("objeto")).toBe(false);
  });

  it("entrada NULA é descartada, e não derruba a leitura inteira", () => {
    // `typeof null === "object"` em JS, então sem a guarda `valor !== null` o
    // ramo entra e `valor.valor` LANÇA — e quem chama `lerCampos` é o motor, no
    // meio de atender uma mensagem de verdade. Um `null` aqui derrubaria a
    // leitura dos OUTROS campos junto, que é o oposto do que esta função
    // promete ("ignora o que não tem forma").
    //
    // Este caso nasceu de um plantio que SOBREVIVEU na re-revisão de 22/09/2026:
    // a guarda existia, funcionava, e nada a prendia — a terceira vez que isso
    // aconteceu neste arquivo.
    const r = lerCampos({
      nulo: null,
      telefone: { valor: "11999999999", em: "2026-09-01T00:00:00Z" },
    });
    expect(r.has("nulo")).toBe(false);
    expect(r.get("telefone")?.valor).toBe("11999999999");
  });
});

describe("regraDoCampo", () => {
  it("entrega o campo do catálogo quando a chave é de campo do catálogo", () => {
    expect(regraDoCampo("telefone")?.extrair("meu zap é (11) 99999-9999")).toBe("11999999999");
    expect(regraDoCampo("email")?.extrair("sou a ana@exemplo.invalid")).toBe("ana@exemplo.invalid");
  });

  it("`livre` NÃO está no catálogo e mesmo assim tem regra", () => {
    // É o ponto inteiro desta função: `conferirBloco` (lib/steps.ts) aceita
    // `campo: "livre"` de propósito, e sem esta entrada o motor chamaria
    // `.extrair` sobre `undefined` no meio de atender uma mensagem de verdade.
    expect(campoPorChave("livre")).toBeUndefined();
    expect(regraDoCampo("livre")?.extrair("  Sorocaba  ")).toBe("Sorocaba");
    expect(regraDoCampo("livre")?.reperguntar).toBe(REPERGUNTAR_LIVRE);
  });

  it("o livre recusa SÓ o vazio — validar mais seria inventar regra", () => {
    // Quem montou a automação acabou de inventar a pergunta; esta camada não
    // sabe o que é resposta válida para ela. O que dá para afirmar é que texto
    // em branco não é resposta.
    expect(regraDoCampo("livre")?.extrair("")).toBe(null);
    expect(regraDoCampo("livre")?.extrair(" \t \r\n ")).toBe(null);
    // E aceita o que o catálogo recusaria: isto não é telefone nem e-mail.
    expect(regraDoCampo("livre")?.extrair("moro em Sorocaba desde 1990")).toBe(
      "moro em Sorocaba desde 1990"
    );
  });

  it("campo que o catálogo não conhece não tem regra", () => {
    // `conferirBloco` barra o bloco antes de salvar, mas automação gravada
    // ANTES desta fase pode carregar um campo que não existe — e quem chama
    // precisa poder distinguir isso de "extraiu nada".
    expect(regraDoCampo("cor_favorita")).toBeUndefined();
    expect(regraDoCampo("")).toBeUndefined();
  });
});

// -----------------------------------------------------------------------------
// AS FRASES DA CHAVE RECUSADA — e o que este describe planta.
//
// Elas eram duas cópias à mão, em dois arquivos (o nó e o painel do editor), e
// as duas escreviam a lista dos campos do sistema digitada: "(e-mail, telefone,
// nome ou data de nascimento)". Nesse formato, um quinto campo no catálogo faz
// as duas mentirem sem nada acusar — e as duas JÁ tinham divergido no verbo.
//
// O QUE ESTES CASOS PRENDEM: a frase CITA `CAMPOS`. Acrescentar um campo ao
// catálogo sem que a frase o mencione derruba a suíte, que é o único jeito de a
// divergência aparecer antes de o dono ler o texto errado.
// -----------------------------------------------------------------------------

describe("as frases da chave de campo livre recusada", () => {
  // A CARREGADORA DA LISTA, MEDIDA POR FORA DO CATÁLOGO — e é por isso que ela
  // é exportada. `camposDoSistemaEmProsa` só sabe falar dos quatro campos que
  // existem hoje, então a borda de UM elemento ("não há 'ou' nenhum a
  // escrever") não tem como ser exercida por ela: uma revisão apagou essa
  // guarda e as 1725 linhas da suíte ficaram verdes. Separar a formatação da
  // lista dá um dono à guarda sem inventar um catálogo falso.
  it("a lista em prosa cobre um, dois e três itens — e é no um que a guarda mora", () => {
    // COM UM ITEM NÃO HÁ "OU": sem a guarda a frase nasce " ou e-mail", com a
    // vírgula pendurada no vazio e um espaço na frente.
    expect(listaEmProsa(["e-mail"])).toBe("e-mail");
    expect(listaEmProsa(["e-mail", "telefone"])).toBe("e-mail ou telefone");
    expect(listaEmProsa(["e-mail", "telefone", "nome"])).toBe("e-mail, telefone ou nome");
  });

  it("a lista dos campos do sistema é LIDA do catálogo, campo a campo", () => {
    const prosa = camposDoSistemaEmProsa();
    for (const campo of CAMPOS) {
      expect(prosa, campo.chave).toContain(campo.rotulo.toLowerCase());
    }
    // É frase para pessoa ler: o último vem depois de "ou", e não de vírgula.
    expect(prosa).toContain(` ou ${CAMPOS[CAMPOS.length - 1].rotulo.toLowerCase()}`);
    // E nada de rótulo com caixa alta no meio da oração.
    expect(prosa).toBe(prosa.toLowerCase());
  });

  it("a recusa da colisão cita os campos e dá a saída", () => {
    const frase = fraseDaChaveQueColide("E-mail");
    for (const campo of CAMPOS) {
      expect(frase, campo.chave).toContain(campo.rotulo.toLowerCase());
    }
    // A SAÍDA FAZ PARTE DA FRASE: uma recusa que só diz "não pode" deixa o dono
    // sem saber o que fazer, e o bloco do próprio campo é o que ele quer.
    expect(frase).toMatch(/bloco do próprio campo/i);
  });

  it("a chave do PERFIL tem frase própria — a dos campos do sistema não serve para ela", () => {
    // A FRASE DOS CAMPOS DO SISTEMA manda "usar o bloco do próprio campo", e
    // não existe bloco de `username`: o dono leria uma saída que não existe, e
    // uma lista de quatro nomes em que o que ele digitou não está.
    const frase = fraseDaChaveQueColide("Username");
    expect(frase).toMatch(/perfil do Instagram/i);
    // ELA NOMEIA O TOKEN, porque é o token que ia ganhar em silêncio: a
    // mensagem sairia preenchida, com o dado do Instagram no lugar da resposta.
    expect(frase).toContain("{{username}}");
    // E NÃO MANDA USAR BLOCO NENHUM — a saída daqui é escolher outro nome.
    expect(frase).not.toMatch(/bloco do próprio campo/i);
    expect(frase).not.toContain(camposDoSistemaEmProsa());
    // A do catálogo continua sendo a do catálogo: as duas não trocam de lugar.
    expect(fraseDaChaveQueColide("E-mail")).toMatch(/campo do sistema/i);
  });

  it("a outra recusa dá um exemplo do que serve, e não só do que não serve", () => {
    const frase = fraseDaChaveSemLetra();
    expect(frase).toMatch(/pelo menos uma letra/i);
    expect(frase).toMatch(/cidade/);
    // E ela não fala de colisão nenhuma: são dois motivos diferentes, com duas
    // saídas diferentes, e juntá-los manda o dono fazer a coisa errada.
    expect(frase).not.toMatch(/campo do sistema/i);
  });

  it("as duas recusas separam os dois motivos de `normalizarChaveLivre` devolver null", () => {
    // A função devolve `null` por DOIS motivos, e quem os distingue é
    // `chaveReservada`. Este caso é o que impede as duas frases de
    // trocarem de lugar numa edição futura.
    expect(normalizarChaveLivre("E-mail")).toBeNull();
    expect(normalizarChaveLivre("123")).toBeNull();
    expect(normalizarChaveLivre("cidade")).toBe("cidade");
  });
});

