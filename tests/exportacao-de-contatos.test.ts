import { describe, it, expect } from "vitest";
import { CAMPOS, type Campo } from "@/lib/campos";
import { type FiltroDeCategoria } from "@/lib/categorias";
import {
  cell,
  neutralizarFormula,
  montarCsv,
  apelidoDoRecorte,
  nomeDoArquivo,
  recorteDaUrl,
  urlDaExportacao,
  peneirar,
  recortarTela,
  emailDoContato,
  temEmail,
  listaDeEmailDaTela,
  linhaDaListaDeEmail,
  csvDaListaDeEmail,
  chavesLivres,
  contatoExportavelDaLinha,
  colunasDoCsvCompleto,
  csvCompletoDeContatos,
  type ContatoExportavel,
  type Recorte,
} from "@/lib/exportacao-de-contatos";

// ============================================================
// A EXPORTAÇÃO EM CSV, PRESA FORA DA ROTA.
//
// As duas rotas de exportação (`app/api/contatos/csv/route.ts` e
// `app/api/contatos/csv-completo/route.ts`) começam em `isValidSession`, e
// sessão não se forja: teste de integração nenhum alcança o que elas fazem
// depois disso. Por isso TUDO o que decide o arquivo mora em
// `lib/exportacao-de-contatos.ts`, e é aqui que ele tem rede.
//
// O ARQUIVO DO BOTÃO ANTIGO É PRESO BYTE A BYTE (o primeiro bloco abaixo): o
// dono decidiu que ele não muda, e "não muda" só é verificável se alguém
// estiver conferindo os bytes.
// ============================================================

const EM = "2026-09-01T12:00:00.000Z";
const coletado = (valor: string) => ({ valor, em: EM });

function contato(p: Partial<ContatoExportavel> = {}): ContatoExportavel {
  return {
    username: "ana",
    name: "Ana Souza",
    email: null,
    categoria: null,
    campos: {},
    ...p,
  };
}

const campo = (chave: string): Campo => {
  const achado = CAMPOS.find((c) => c.chave === chave);
  if (!achado) throw new Error(`o catálogo não tem o campo ${chave}`);
  return achado;
};

// ------------------------------------------------------------
// A CÉLULA E O ARQUIVO — o que faz o Excel em português abrir com acento certo.
// ------------------------------------------------------------
describe("cell — o escape que o ponto e vírgula obriga", () => {
  it("texto sem pontuação perigosa sai cru", () => {
    expect(cell("Ana")).toBe("Ana");
    expect(cell("ana@email.com")).toBe("ana@email.com");
  });

  // O separador é `;`, então um `;` DENTRO do dado parte a linha em duas
  // colunas se não for protegido.
  it("ponto e vírgula, aspas e quebra de linha viram célula entre aspas", () => {
    expect(cell("Silva; Jr")).toBe('"Silva; Jr"');
    expect(cell('diz "oi"')).toBe('"diz ""oi"""');
    expect(cell("duas\nlinhas")).toBe('"duas\nlinhas"');
    expect(cell("volta\rcarro")).toBe('"volta\rcarro"');
  });

  it("nulo e indefinido viram célula vazia, e não “null”", () => {
    expect(cell(null)).toBe("");
    expect(cell(undefined)).toBe("");
  });
});

// ------------------------------------------------------------
// A INJEÇÃO DE FÓRMULA — o dado desta planilha vem de DM do Instagram.
//
// O nome do perfil, o @ e a resposta do campo livre são digitados por quem
// mandou a mensagem, e o arquivo é aberto com dois cliques na máquina do
// marketing. Uma célula que COMEÇA com `=`, `+`, `-`, `@`, TAB ou CR é
// executada pelo Excel e pelo Google Sheets ao ABRIR, sem ninguém clicar em
// nada. Os DOIS botões neutralizam, pela MESMA função.
// ------------------------------------------------------------
describe("neutralizarFormula — o primeiro caractere que a planilha executa", () => {
  it("os seis começos perigosos ganham a apóstrofe", () => {
    expect(neutralizarFormula("=1+1")).toBe("'=1+1");
    expect(neutralizarFormula("+55 11 99999-9999")).toBe("'+55 11 99999-9999");
    expect(neutralizarFormula("-2+3")).toBe("'-2+3");
    expect(neutralizarFormula("@SUM(1:1)")).toBe("'@SUM(1:1)");
    expect(neutralizarFormula("\tx")).toBe("'\tx");
    expect(neutralizarFormula("\rz")).toBe("'\rz");
  });

  // É O COMEÇO DA CÉLULA, E SÓ ELE. Marcar o `=` do meio de um nome estragaria
  // dado de gente de verdade sem fechar caminho nenhum.
  it("o mesmo caractere NO MEIO não é fórmula, e o dado sai inteiro", () => {
    expect(neutralizarFormula("Ana=Bia")).toBe("Ana=Bia");
    expect(neutralizarFormula("ana@email.com")).toBe("ana@email.com");
    expect(neutralizarFormula("Silva - Jr")).toBe("Silva - Jr");
    expect(neutralizarFormula("")).toBe("");
  });

  // ASPAS NÃO RESOLVEM: o escape de CSV cita a célula por causa do `;` e da
  // aspa, e o leitor tira as aspas ANTES de decidir o que a célula é. Quem
  // decide é o primeiro caractere do conteúdo — e é ele que a apóstrofe muda.
  it("a apóstrofe fica DENTRO das aspas quando o escape também age", () => {
    expect(cell('=HYPERLINK("http://mau";"clique")')).toBe(
      '"\'=HYPERLINK(""http://mau"";""clique"")"'
    );
    expect(cell("\rz")).toBe("\"'\rz\"");
  });

  it("a célula crua também é neutralizada — é a MESMA `cell` dos dois arquivos", () => {
    expect(cell("=1+1")).toBe("'=1+1");
    expect(cell("@sum")).toBe("'@sum");
  });
});

describe("montarCsv — BOM, separador e fim de linha", () => {
  it("o arquivo começa com o BOM de UTF-8 e separa com ponto e vírgula", () => {
    expect(montarCsv([["a", "b"], ["1", "2"]])).toBe("﻿a;b\r\n1;2");
  });
});

// ------------------------------------------------------------
// O BOTÃO ANTIGO — O ARQUIVO DELE NÃO MUDA, COM UMA EXCEÇÃO NOMEADA.
//
// Decisão do dono: "Exportar CSV" é a lista de e-mail, e o CONTEÚDO dele —
// quais contatos, quais colunas — não muda nem um byte. A exceção, decidida
// pelo dono depois: a neutralização de fórmula (`neutralizarFormula`), que vale
// para os DOIS arquivos pela mesma função, porque tratar o mesmo dado de dois
// jeitos seria pior do que mudar estes bytes. Ela só toca a linha cujo nome
// COMEÇA com `=`, `+`, `-`, `@`, TAB ou CR; todo o resto continua idêntico, e
// as cinco primeiras linhas do caso abaixo são a prova disso.
//
// Este bloco é a única coisa nesta base capaz de acusar uma mudança ali — a
// rota não tem, e não pode ter, teste de integração.
// ------------------------------------------------------------
describe("csvDaListaDeEmail — o arquivo do botão antigo, byte a byte", () => {
  // AS LINHAS SÃO ESCOLHIDAS PARA ATRAVESSAR `cell`, e não só o cabeçalho: a
  // `cell` agora é COMPARTILHADA com o botão novo, e o risco da extração é
  // justamente um ajuste feito para o arquivo novo vazar para este. Por isso
  // tem nome com espaço nas pontas (um `trim` mudaria estes bytes), nome com
  // ponto e vírgula e aspas (o escape), nome nulo (a célula vazia) e, desde a
  // neutralização, um nome de cada começo perigoso.
  it("duas colunas, nesta ordem, com estes cabeçalhos", () => {
    const csv = csvDaListaDeEmail([
      { nome: "Ana", email: "ana@email.com" },
      { nome: null, email: "sem-nome@email.com" },
      { nome: 'Silva; "Jr"', email: "jr@email.com" },
      { nome: "  Bia  ", email: "bia@email.com" },
      { nome: "Duas\nlinhas", email: "duas@email.com" },
      { nome: "=1+1", email: "igual@email.com" },
      { nome: '=HYPERLINK("http://mau";"clique")', email: "link@email.com" },
      { nome: "+55 Ana", email: "mais@email.com" },
      { nome: "-Bia", email: "menos@email.com" },
      { nome: "@sum", email: "arroba@email.com" },
      { nome: "\tTab", email: "tab@email.com" },
      { nome: "\rCarro", email: "carro@email.com" },
    ]);
    expect(csv).toBe(
      "﻿Nome;E-mail\r\n" +
        // AS CINCO PRIMEIRAS SÃO OS BYTES DE SEMPRE — é o que diz que a exceção
        // de segurança não virou licença para mexer no resto do arquivo.
        "Ana;ana@email.com\r\n" +
        ";sem-nome@email.com\r\n" +
        '"Silva; ""Jr""";jr@email.com\r\n' +
        "  Bia  ;bia@email.com\r\n" +
        '"Duas\nlinhas";duas@email.com\r\n' +
        // E ESTAS SÃO A EXCEÇÃO, uma por começo perigoso.
        "'=1+1;igual@email.com\r\n" +
        '"\'=HYPERLINK(""http://mau"";""clique"")";link@email.com\r\n' +
        "'+55 Ana;mais@email.com\r\n" +
        "'-Bia;menos@email.com\r\n" +
        "'@sum;arroba@email.com\r\n" +
        "'\tTab;tab@email.com\r\n" +
        "\"'\rCarro\";carro@email.com"
    );
  });

  it("sem ninguém, sobra só o cabeçalho — e ele continua o mesmo", () => {
    expect(csvDaListaDeEmail([])).toBe("﻿Nome;E-mail");
  });
});

// ------------------------------------------------------------
// O NOME DO ARQUIVO — o apelido do recorte, que também não muda.
// ------------------------------------------------------------
describe("apelidoDoRecorte e nomeDoArquivo", () => {
  it("o acento e o espaço da categoria viram ASCII no nome do arquivo", () => {
    expect(apelidoDoRecorte("turma de setembro")).toBe("turma-de-setembro");
    expect(apelidoDoRecorte("não respondeu")).toBe("nao-respondeu");
  });

  it("a ficha do nulo tem nome próprio, e não um buraco", () => {
    expect(apelidoDoRecorte(null)).toBe("sem-categoria");
    expect(apelidoDoRecorte("")).toBe("sem-categoria");
    expect(apelidoDoRecorte("🔥")).toBe("sem-categoria");
  });

  it("o nome do arquivo da lista de e-mail é o mesmo de sempre", () => {
    expect(nomeDoArquivo("emails", "metodochat", { tipo: "tudo" }, "2026-09-23")).toBe(
      "emails-metodochat-2026-09-23.csv"
    );
    expect(
      nomeDoArquivo("emails", "metodochat", { tipo: "uma", nome: "aluno" }, "2026-09-23")
    ).toBe("emails-metodochat-aluno-2026-09-23.csv");
    expect(
      nomeDoArquivo("emails", "metodochat", { tipo: "uma", nome: null }, "2026-09-23")
    ).toBe("emails-metodochat-sem-categoria-2026-09-23.csv");
  });

  it("os dois botões se distinguem na pasta de downloads pelo prefixo", () => {
    const filtro: FiltroDeCategoria = { tipo: "uma", nome: "aluno" };
    expect(nomeDoArquivo("contatos", "metodochat", filtro, "2026-09-23")).toBe(
      "contatos-metodochat-aluno-2026-09-23.csv"
    );
  });
});

// ------------------------------------------------------------
// O RECORTE — o que o botão carrega da tela para a rota.
//
// É AQUI QUE MORA O DEFEITO DE 11/09/2026: o link do botão levava a categoria
// e NÃO levava a busca, e a tela dizia "1 pessoa — pronta para sua lista"
// enquanto o arquivo trazia os 40 da categoria.
// ------------------------------------------------------------
describe("recorteDaUrl e urlDaExportacao — o link do botão e a leitura da rota", () => {
  const recorteDe = (url: string) => recorteDaUrl(new URL(url, "http://x").searchParams);

  it("sem parâmetro nenhum é a conta inteira, sem busca", () => {
    expect(recorteDe("/api/contatos/csv")).toEqual({ filtro: { tipo: "tudo" }, busca: null });
  });

  // A distinção que `filtroDaUrl` (lib/categorias.ts) guarda: `?categoria=`
  // AUSENTE é "tudo", `?categoria=` PRESENTE E VAZIO é a ficha "sem categoria".
  it("`categoria=` vazio é a ficha do nulo, e não a conta inteira", () => {
    expect(recorteDe("/api/contatos/csv?categoria=")).toEqual({
      filtro: { tipo: "uma", nome: null },
      busca: null,
    });
  });

  it("a busca chega normalizada — sem acento e sem espaço nas pontas", () => {
    expect(recorteDe("/api/contatos/csv?q=%20Nat%C3%A1lia%20")?.busca).toBe("natalia");
    expect(recorteDe("/api/contatos/csv?q=%20%20")?.busca).toBe(null);
  });

  // A IDA E VOLTA É O QUE AMARRA O BOTÃO À ROTA: o link que a tela gera tem de
  // ser lido do outro lado como o MESMO recorte. Um `q` esquecido no link
  // aparece aqui, e é o único lugar desta base em que ele aparece.
  it("o que o botão leva, a rota lê de volta igual — inclusive a busca", () => {
    const casos: Recorte[] = [
      { filtro: { tipo: "tudo" }, busca: null },
      { filtro: { tipo: "tudo" }, busca: "maria" },
      { filtro: { tipo: "uma", nome: "aluno" }, busca: null },
      { filtro: { tipo: "uma", nome: "aluno" }, busca: "maria" },
      { filtro: { tipo: "uma", nome: null }, busca: "maria" },
      { filtro: { tipo: "uma", nome: "turma de setembro" }, busca: "a&b=c" },
    ];
    for (const recorte of casos) {
      const url = urlDaExportacao("/api/contatos/csv-completo", recorte);
      expect(recorteDe(url), JSON.stringify(recorte)).toEqual(recorte);
    }
  });

  it("os dois botões montam o mesmo recorte sobre bases diferentes", () => {
    const recorte: Recorte = { filtro: { tipo: "uma", nome: "aluno" }, busca: "maria" };
    expect(urlDaExportacao("/api/contatos/csv", recorte)).toBe(
      "/api/contatos/csv?categoria=aluno&q=maria"
    );
    expect(urlDaExportacao("/api/contatos/csv-completo", recorte)).toBe(
      "/api/contatos/csv-completo?categoria=aluno&q=maria"
    );
  });

  it("sem busca, o link não ganha `q` vazio pendurado", () => {
    expect(urlDaExportacao("/api/contatos/csv", { filtro: { tipo: "tudo" }, busca: null })).toBe(
      "/api/contatos/csv"
    );
  });
});

// ------------------------------------------------------------
// AS DUAS PENEIRAS — categoria e depois busca, com as MESMAS funções da tela.
// ------------------------------------------------------------
describe("peneirar — as duas peneiras, e nenhuma delas esquecida", () => {
  const lista = [
    contato({ username: "maria.aluna", name: "Maria", categoria: "aluno" }),
    contato({ username: "joao.aluno", name: "João", categoria: "aluno" }),
    contato({ username: "maria.lead", name: "Maria", categoria: "interessado" }),
    contato({ username: "sem.ficha", name: "Zé", categoria: null }),
  ];
  const usuarios = (l: ContatoExportavel[]) => l.map((c) => c.username);

  it("sem recorte nenhum, sai a conta inteira", () => {
    expect(usuarios(peneirar(lista, { filtro: { tipo: "tudo" }, busca: null }))).toEqual([
      "maria.aluna",
      "joao.aluno",
      "maria.lead",
      "sem.ficha",
    ]);
  });

  it("a categoria peneira", () => {
    expect(
      usuarios(peneirar(lista, { filtro: { tipo: "uma", nome: "aluno" }, busca: null }))
    ).toEqual(["maria.aluna", "joao.aluno"]);
  });

  // A PENEIRA QUE JÁ FOI ESQUECIDA UMA VEZ. Sem ela, este caso devolve os dois
  // de "aluno" enquanto a tela mostra um — que é o defeito de 11/09/2026.
  it("a busca peneira DEPOIS da categoria, e as duas valem juntas", () => {
    expect(
      usuarios(peneirar(lista, { filtro: { tipo: "uma", nome: "aluno" }, busca: "maria" }))
    ).toEqual(["maria.aluna"]);
  });

  it("quem casa com a busca mas não com a categoria fica de fora", () => {
    expect(
      usuarios(peneirar(lista, { filtro: { tipo: "uma", nome: "interessado" }, busca: "maria" }))
    ).toEqual(["maria.lead"]);
  });

  // `categoria = null` em SQL não casa NINGUÉM: a ficha do nulo só existe
  // porque quem peneira é `contatosDoFiltro`, em JS.
  it("a ficha “sem categoria” é um balde de verdade", () => {
    expect(usuarios(peneirar(lista, { filtro: { tipo: "uma", nome: null }, busca: null }))).toEqual(
      ["sem.ficha"]
    );
  });

  it("a busca acha pelo e-mail também — os mesmos três campos da tela", () => {
    const comEmail = [contato({ username: "x", name: "X", email: "natalia@email.com" })];
    expect(
      peneirar(comEmail, { filtro: { tipo: "tudo" }, busca: "natalia" })
    ).toHaveLength(1);
  });
});

// ------------------------------------------------------------
// O RECORTE DA TELA INTEIRO, NUMA FUNÇÃO SÓ.
//
// O DEFEITO QUE ISTO FECHA NÃO É UM NÚMERO ERRADO: É A ESCOLHA DE QUAL
// CONJUNTO ENTREGAR. Até 24/09/2026 `app/contatos/page.tsx` derivava quatro
// conjuntos DO MESMO TIPO (`rows`, `achados`, `comEmail`, `semEmail`) e
// escolhia à mão qual deles ia para a faixa de exportar. Medido nesta tarefa:
// trocar `contatos={rows}` por `contatos={comEmail}` — que está DUAS LINHAS
// acima e alimenta a tabela logo abaixo da faixa — atravessou `tsc`, `eslint`,
// 1808 casos puros e 47 de DOM. A frase passava a contar só quem tem e-mail e
// o botão continuava baixando todo mundo: o defeito de 11/09/2026 na forma
// exata, e calado.
//
// COM UM PRODUTOR SÓ NÃO HÁ O QUE ESCOLHER: esta função devolve o recorte, os
// três conjuntos e o caso da seção DE UMA VEZ, e a página consome o objeto.
// `contatos={comEmail}` deixa de existir como expressão possível, e um SEGUNDO
// recorte montado no JSX também.
//
// E É AQUI QUE ESSES RAMOS GANHAM CASO. A página é `async` e consulta o
// Postgres; teste nenhum desta base a monta. Enquanto a derivação morava lá
// dentro, cada uma destas linhas era uma guarda sem rede.
// ------------------------------------------------------------
describe("recortarTela — o recorte, os conjuntos e o caso, de uma vez", () => {
  const ALUNO: FiltroDeCategoria = { tipo: "uma", nome: "aluno" };
  const TUDO: FiltroDeCategoria = { tipo: "tudo" };

  // AS TRÊS PESSOAS MORDEM AS PENEIRAS SEPARADO, que é o arranjo do 11/09: a
  // categoria sozinha deixa duas, a busca sozinha deixa duas, e as duas juntas
  // deixam uma. E o e-mail atravessa o recorte: quem tem e-mail está dentro E
  // fora de "aluno", para que `comEmail` tirado da conta inteira dê um
  // resultado DIFERENTE de `comEmail` tirado dos achados.
  const lista = [
    contato({ username: "maria.aluna", name: "Maria", email: "maria@email.com", categoria: "aluno" }),
    contato({ username: "joao.aluno", name: "João", email: null, categoria: "aluno" }),
    contato({ username: "maria.lead", name: "Maria", email: "maria@lead.com", categoria: "interessado" }),
  ];
  const usuarios = (l: ContatoExportavel[]) => l.map((c) => c.username);

  it("o recorte leva as DUAS peneiras da tela, e é o que o link carrega", () => {
    const tela = recortarTela(lista, ALUNO, "maria");
    expect(tela.recorte).toEqual({ filtro: ALUNO, busca: "maria" });
    expect(urlDaExportacao("/api/contatos/csv-completo", tela.recorte)).toBe(
      "/api/contatos/csv-completo?categoria=aluno&q=maria"
    );
  });

  it("`achados` é o que as duas peneiras deixam, pela mesma `peneirar` das rotas", () => {
    expect(usuarios(recortarTela(lista, ALUNO, "maria").achados)).toEqual(["maria.aluna"]);
    expect(usuarios(recortarTela(lista, ALUNO, null).achados)).toEqual([
      "maria.aluna",
      "joao.aluno",
    ]);
  });

  // O CASO QUE DISTINGUE "TIRADO DOS ACHADOS" DE "TIRADO DA CONTA INTEIRA".
  // `maria.lead` tem e-mail e está FORA de "aluno": um `comEmail` que saísse de
  // `contatos` a traria junto, e a seção "Com e-mail" contaria gente que a
  // tabela dela não mostra.
  it("`comEmail` e `semEmail` saem de `achados`, e não da conta inteira", () => {
    const tela = recortarTela(lista, ALUNO, null);
    expect(
      usuarios(tela.comEmail),
      "`comEmail` tem de ser o pedaço de `achados` com e-mail: `maria.lead` tem " +
        "e-mail e não está no recorte 'aluno'."
    ).toEqual(["maria.aluna"]);
    expect(usuarios(tela.semEmail)).toEqual(["joao.aluno"]);
  });

  // A SOMA TEM DE FECHAR, e é ela que deixa a faixa de exportar ficar em cima
  // das duas tabelas dizendo um número só: `comEmail` + `semEmail` são as duas
  // seções seguintes, e `achados` é o que o botão baixa.
  it("os dois conjuntos particionam `achados`: ninguém sobra e ninguém repete", () => {
    for (const busca of [null, "maria"]) {
      for (const filtro of [TUDO, ALUNO]) {
        const tela = recortarTela(lista, filtro, busca);
        const rotulo = `filtro ${JSON.stringify(filtro)} e busca ${JSON.stringify(busca)}`;
        expect(
          [...usuarios(tela.comEmail), ...usuarios(tela.semEmail)].sort(),
          `com ${rotulo}, as duas seções têm de somar exatamente os achados`
        ).toEqual(usuarios(tela.achados).sort());
      }
    }
  });

  // -----------------------------------------------------------------
  // O `caso` DA SEÇÃO "COM E-MAIL" — e a fiação que ele esconde.
  //
  // `casoDaListaDeEmail` recebe um campo chamado `visiveis`, e na tela existe
  // uma variável com esse nome que é OUTRO conjunto (a categoria sem a busca,
  // o conjunto do ENVIO). Enquanto a chamada morava na página, escrever
  // `visiveis: visiveis.length` no lugar de `visiveis: achados.length`
  // atravessava `tsc` e as três suítes — e reabria em silêncio o defeito que o
  // ramo `busca_vazia` existe para impedir: busca sem resultado voltava a
  // mostrar a categoria inteira, com "0 pessoas neste recorte" e um botão que
  // baixa arquivo vazio. Aqui não há um segundo conjunto para passar.
  // -----------------------------------------------------------------
  it("busca sem resultado é `busca_vazia`, e não a categoria inteira", () => {
    expect(
      recortarTela(lista, ALUNO, "zzz").caso,
      "o campo `visiveis` de `casoDaListaDeEmail` conta os ACHADOS. Alimentado " +
        "com a categoria SEM a busca, 'aluno' teria duas pessoas, o vazio sumiria " +
        "e a tela mostraria a categoria inteira para quem buscou e não achou " +
        "ninguém — com um botão que baixa arquivo vazio."
    ).toBe("busca_vazia");
  });

  it("categoria sem ninguém, e sem busca, é `filtro_vazio`", () => {
    expect(
      recortarTela(lista, { tipo: "uma", nome: "cliente" }, null).caso,
      "sem busca ativa o vazio é da categoria, e a frase tem de mandar fazer " +
        "outra coisa — confundir os dois foi o defeito de 11/09/2026."
    ).toBe("filtro_vazio");
  });

  it("com alguém de e-mail no recorte, é `tem_email`", () => {
    expect(recortarTela(lista, ALUNO, "maria").caso).toBe("tem_email");
    expect(recortarTela(lista, TUDO, null).caso).toBe("tem_email");
  });

  // ESTE PRENDE O `filtrado`: a MESMA lista sem e-mail nenhum dá dois casos
  // diferentes, e o que muda é só o tipo do filtro. As duas frases da tela são
  // diferentes — uma manda ligar a pergunta do e-mail numa automação, a outra
  // diz que é esta categoria que não tem.
  it("sem e-mail nenhum, o filtro decide qual das duas frases a tela mostra", () => {
    const ninguemTemEmail = [
      contato({ username: "a.aluno", email: null, categoria: "aluno" }),
      contato({ username: "b.lead", email: null, categoria: "interessado" }),
    ];
    expect(recortarTela(ninguemTemEmail, ALUNO, null).caso).toBe("sem_email_no_filtro");
    expect(recortarTela(ninguemTemEmail, TUDO, null).caso).toBe("sem_email_geral");
  });
});

// ------------------------------------------------------------
// A LINHA DO BANCO — e a coluna que sumiu do `select`.
//
// A rota da exportação completa afirmava `as ContatoExportavel[]` sobre o que a
// consulta devolveu. Asserção não é checagem: tirar `c.campos` do `select`
// passava por `tsc` sem um pio, e a planilha saía com TODAS as colunas de campo
// livre sumidas e três das quatro do catálogo em branco. É a lista de colunas
// de um `select` — justamente a parte que as pessoas editam.
// ------------------------------------------------------------
describe("contatoExportavelDaLinha — a coluna que falta não sai calada", () => {
  const linhaDoBanco = () => ({
    username: "ana",
    name: "Ana Souza",
    email: "ana@email.com",
    categoria: "aluno",
    campos: { qual_sua_cidade: coletado("Osasco") },
  });

  it("a linha completa vira contato exportável, com o `jsonb` cru", () => {
    const linha = linhaDoBanco();
    expect(contatoExportavelDaLinha(linha)).toEqual({
      username: "ana",
      name: "Ana Souza",
      email: "ana@email.com",
      categoria: "aluno",
      campos: linha.campos,
    });
  });

  // COLUNA PRESENTE E NULA É NORMAL, e não pode ser confundida com coluna
  // ausente: quase todo contato tem `categoria` nula, e a maioria não tem
  // e-mail — é por isso que a checagem é `in`, e não "tem valor".
  it("coluna nula é dado, e passa", () => {
    expect(
      contatoExportavelDaLinha({
        username: null,
        name: null,
        email: null,
        categoria: null,
        campos: null,
      }).campos
    ).toBeNull();
  });

  it("cada uma das cinco colunas, quando falta, acusa pelo nome", () => {
    for (const coluna of ["username", "name", "email", "categoria", "campos"]) {
      const linha: Record<string, unknown> = linhaDoBanco();
      delete linha[coluna];
      expect(
        () => contatoExportavelDaLinha(linha),
        `sem \`${coluna}\` no \`select\`, a exportação tem de parar e dizer qual ` +
          "coluna falta — a planilha calada com a coluna em branco é o defeito"
      ).toThrow(new RegExp(coluna));
    }
  });
});

// ------------------------------------------------------------
// AS COLUNAS LIVRES — descobertas do dado exportado, em ordem DETERMINÍSTICA.
// ------------------------------------------------------------
describe("chavesLivres — a ordem não pode depender de quem veio primeiro", () => {
  const ana = contato({
    username: "ana",
    campos: { qual_sua_cidade: coletado("Osasco"), profissao: coletado("dentista") },
  });
  const bia = contato({
    username: "bia",
    campos: { instagram_favorito: coletado("@x"), qual_sua_cidade: coletado("Santos") },
  });

  it("junta as chaves de todo mundo, sem repetir", () => {
    expect(chavesLivres([ana, bia])).toEqual([
      "instagram_favorito",
      "profissao",
      "qual_sua_cidade",
    ]);
  });

  // O PONTO INTEIRO DESTE BLOCO: duas exportações do MESMO dado têm de dar as
  // mesmas colunas na mesma ordem, senão o marketing não consegue empilhar
  // planilhas. A ordem das LINHAS muda sozinha (`first_contact_at desc`, e
  // qualquer contato novo entra na frente); a ordem das COLUNAS não pode.
  it("inverter a ordem dos contatos não muda a ordem das colunas", () => {
    expect(chavesLivres([bia, ana])).toEqual(chavesLivres([ana, bia]));
  });

  // O `jsonb` do Postgres não devolve as chaves na ordem em que foram
  // gravadas, então nem a ordem DENTRO de um contato serve de âncora.
  it("a ordem das chaves dentro do registro também não decide nada", () => {
    const a = contato({ campos: { zzz: coletado("1"), aaa: coletado("2") } });
    const b = contato({ campos: { aaa: coletado("2"), zzz: coletado("1") } });
    expect(chavesLivres([a])).toEqual(["aaa", "zzz"]);
    expect(chavesLivres([b])).toEqual(["aaa", "zzz"]);
  });

  it("campo do catálogo não vira coluna livre — ele já tem coluna própria", () => {
    const c = contato({
      campos: { email: coletado("a@b.com"), telefone: coletado("11999998888"), cidade: coletado("Santos") },
    });
    expect(chavesLivres([c])).toEqual(["cidade"]);
  });

  it("registro vazio ou ilegível não inventa coluna", () => {
    expect(chavesLivres([contato({ campos: {} }), contato({ campos: null })])).toEqual([]);
    // `lerCampos` descarta o que não tem forma; a exportação herda isso em vez
    // de ganhar uma segunda regra sobre o que é um campo gravado.
    expect(chavesLivres([contato({ campos: { lixo: "só texto", vazio: { em: EM } } })])).toEqual([]);
  });

  // A EXCLUSÃO LÊ O CATÁLOGO QUE RECEBEU, e não uma lista própria.
  it("com outro catálogo, o que era coluna do catálogo vira coluna livre", () => {
    const c = contato({ campos: { email: coletado("a@b.com"), cidade: coletado("Santos") } });
    expect(chavesLivres([c], [campo("telefone")])).toEqual(["cidade", "email"]);
  });
});

// ------------------------------------------------------------
// OS CABEÇALHOS — e o dono de cada um deles.
// ------------------------------------------------------------
describe("colunasDoCsvCompleto — de onde vem cada cabeçalho", () => {
  const cabecalhos = (...args: Parameters<typeof colunasDoCsvCompleto>) =>
    colunasDoCsvCompleto(...args).map((c) => c.cabecalho);

  it("a ordem é: quem é a pessoa, a categoria, o catálogo, e então os campos livres", () => {
    const c = contato({ campos: { cidade: coletado("Santos") } });
    expect(cabecalhos([c])).toEqual([
      "Nome completo",
      "Username (@)",
      "Categoria",
      ...CAMPOS.map((campo) => campo.rotulo),
      "cidade",
    ]);
  });

  // O RÓTULO CHEIO, E NÃO O `nomeCurto`: a planilha é lida fora do painel, e
  // "Telefone / WhatsApp" é o que diz para que aquele campo serve. Trocar por
  // `nomeCurto` deixa este caso vermelho.
  it("todo campo do catálogo vira coluna, com o `rotulo` dele", () => {
    for (const campoDoCatalogo of CAMPOS) {
      expect(cabecalhos([])).toContain(campoDoCatalogo.rotulo);
    }
  });

  // O CASO QUE ACUSA COLUNA ESCRITA À MÃO. Com os rótulos digitados no código
  // em vez de lidos do catálogo, esta chamada devolveria os QUATRO campos de
  // `CAMPOS` — e não os dois que ela pediu, nesta ordem.
  it("as colunas do catálogo são LIDAS do catálogo que chegou, na ordem dele", () => {
    expect(cabecalhos([], [campo("nascimento"), campo("telefone")])).toEqual([
      "Nome completo",
      "Username (@)",
      "Categoria",
      campo("nascimento").rotulo,
      campo("telefone").rotulo,
    ]);
  });

  // O CASO QUE ACUSA O RÓTULO DIGITADO NO CÓDIGO — e ele nasceu de um plantio
  // que SOBREVIVEU. O caso acima prova que o CONJUNTO e a ORDEM das colunas
  // saem do catálogo, e é só isso: com os quatro rótulos de hoje copiados para
  // uma tabela no código, indexada pela `chave`, ele continuava verde — porque
  // as strings coincidem hoje. É a forma sorrateira do mesmo defeito, e é
  // exatamente a que apodrece no dia em que um `rotulo` mudar em lib/campos.ts.
  //
  // Um campo com a MESMA `chave` (e portanto a mesma variável, o mesmo valor) e
  // outro `rotulo` é o que separa "leu o catálogo" de "escreveu o de hoje".
  it("o cabeçalho é o `rotulo` DO CAMPO que chegou, e não um texto digitado aqui", () => {
    const renomeado: Campo = { ...campo("telefone"), rotulo: "Zapzap do lead" };
    expect(cabecalhos([], [renomeado])).toEqual([
      "Nome completo",
      "Username (@)",
      "Categoria",
      "Zapzap do lead",
    ]);
  });

  // As duas famílias não podem colidir por construção: chave livre é
  // `[a-z0-9_]` (`formaDaChave`, lib/campos.ts) e todo cabeçalho fixo tem
  // maiúscula ou espaço. Este caso é o que acusaria se alguma das duas mudasse.
  it("nenhum cabeçalho aparece duas vezes", () => {
    const c = contato({ campos: { cidade: coletado("Santos"), profissao: coletado("dentista") } });
    const lista = cabecalhos([c]);
    expect(new Set(lista).size).toBe(lista.length);
  });
});

// ------------------------------------------------------------
// AS CÉLULAS — e a regra dona de cada valor.
// ------------------------------------------------------------
describe("csvCompletoDeContatos — o que cai em cada célula", () => {
  const colunaDe = (csv: string, cabecalho: string) => {
    const [linhaCab, ...linhas] = csv.replace(/^﻿/, "").split("\r\n");
    const i = linhaCab.split(";").indexOf(cabecalho);
    if (i < 0) throw new Error(`não há coluna ${cabecalho} em ${linhaCab}`);
    return linhas.map((l) => l.split(";")[i]);
  };

  // O BOTÃO NOVO LEVA TODO CONTATO DO RECORTE, tenha e-mail ou não — é a razão
  // de ele existir. O botão antigo filtra `email is not null`; este não.
  it("contato sem e-mail entra no arquivo", () => {
    const csv = csvCompletoDeContatos([
      contato({ username: "sem.email", name: "Zé", email: null }),
    ]);
    expect(colunaDe(csv, "Username (@)")).toEqual(["sem.email"]);
  });

  // A REGRA DA CÉLULA DO E-MAIL É DE `lib/variables.ts`, e não desta camada: o
  // valor COLETADO vale, e na falta dele a coluna `contacts.email` (a queda
  // transitória até a Parte 2). Estes dois casos medem a regra de lá.
  it("sem e-mail coletado, vale a coluna `contacts.email`", () => {
    const csv = csvCompletoDeContatos([contato({ email: "antigo@email.com", campos: {} })]);
    expect(colunaDe(csv, "E-mail")).toEqual(["antigo@email.com"]);
  });

  it("com e-mail coletado, o registro ganha da coluna", () => {
    const csv = csvCompletoDeContatos([
      contato({ email: "antigo@email.com", campos: { email: coletado("novo@email.com") } }),
    ]);
    expect(colunaDe(csv, "E-mail")).toEqual(["novo@email.com"]);
  });

  it("o campo livre cai na coluna do próprio nome", () => {
    const csv = csvCompletoDeContatos([
      contato({ username: "ana", campos: { qual_sua_cidade: coletado("Osasco") } }),
      contato({ username: "bia", campos: {} }),
    ]);
    expect(colunaDe(csv, "qual_sua_cidade")).toEqual(["Osasco", ""]);
  });

  // O `trim` DA CÉLULA DO CAMPO LIVRE — o mesmo de `valorColetado`
  // (lib/variables.ts), e pela mesma razão. Valor só de espaço é ausência:
  // gravado por fora (por uma automação antiga, por um `update` à mão), ele
  // vira numa planilha uma célula que PARECE cheia e não tem nada — o
  // marketing filtra por "não vazio" e leva junto quem não respondeu.
  //
  // O CASO NASCEU DE UM PLANTIO QUE SOBREVIVEU: tirar o `.trim()` daquela linha
  // passava por todos os casos deste arquivo, porque nenhum deles mandava
  // espaço.
  it("campo livre só de espaço é ausência, e sai como célula vazia", () => {
    const csv = csvCompletoDeContatos([
      contato({ username: "ana", campos: { qual_sua_cidade: coletado("   ") } }),
      contato({ username: "bia", campos: { qual_sua_cidade: coletado(" Santos ") } }),
    ]);
    expect(colunaDe(csv, "qual_sua_cidade")).toEqual(["", "Santos"]);
  });

  it("quem não tem nome público cai no @, como na tela", () => {
    const csv = csvCompletoDeContatos([contato({ username: "ana", name: null })]);
    expect(colunaDe(csv, "Nome completo")).toEqual(["ana"]);
  });

  it("a categoria vai junto, e a ficha do nulo sai vazia", () => {
    const csv = csvCompletoDeContatos([
      contato({ categoria: "aluno" }),
      contato({ categoria: null }),
    ]);
    expect(colunaDe(csv, "Categoria")).toEqual(["aluno", ""]);
  });

  it("o arquivo inteiro, de ponta a ponta", () => {
    const csv = csvCompletoDeContatos([
      contato({
        username: "ana",
        name: "Ana Souza",
        email: "ana@email.com",
        categoria: "aluno",
        campos: { telefone: coletado("11999998888"), qual_sua_cidade: coletado("Osasco") },
      }),
    ]);
    expect(csv).toBe(
      "﻿Nome completo;Username (@);Categoria;E-mail;Telefone / WhatsApp;" +
        "Nome informado;Data de nascimento;qual_sua_cidade\r\n" +
        "Ana Souza;ana;aluno;ana@email.com;11999998888;;;Osasco"
    );
  });

  // A INJEÇÃO PELO BOTÃO NOVO, NAS QUATRO COLUNAS QUE O LEAD ESCREVE. As duas
  // de perfil vêm do Instagram, a categoria o dono digita, e o campo livre é a
  // resposta que o próprio lead mandou por DM — que é a coluna que esta tarefa
  // acabou de criar, e a mais fácil de plantar de fora.
  it("nome, @, categoria e campo livre não viram fórmula na planilha", () => {
    const csv = csvCompletoDeContatos([
      contato({
        username: "=cmd|' /C calc'!A0",
        name: '=HYPERLINK("http://mau","clique")',
        categoria: "+aluno",
        campos: { qual_sua_cidade: coletado("@SUM(1:1)"), obs: coletado("-2+3") },
      }),
    ]);
    expect(colunaDe(csv, "Username (@)")).toEqual(["'=cmd|' /C calc'!A0"]);
    expect(colunaDe(csv, "Categoria")).toEqual(["'+aluno"]);
    expect(colunaDe(csv, "qual_sua_cidade")).toEqual(["'@SUM(1:1)"]);
    expect(colunaDe(csv, "obs")).toEqual(["'-2+3"]);
    // O nome atravessa o escape E a neutralização ao mesmo tempo: a apóstrofe
    // tem de ficar DENTRO das aspas, senão a fórmula volta a ser a primeira
    // coisa do conteúdo da célula.
    expect(csv).toContain('"\'=HYPERLINK(""http://mau"",""clique"")"');
  });

  it("sem ninguém, sobra o cabeçalho — sem coluna livre nenhuma para descobrir", () => {
    expect(csvCompletoDeContatos([])).toBe(
      "﻿Nome completo;Username (@);Categoria;E-mail;Telefone / WhatsApp;" +
        "Nome informado;Data de nascimento"
    );
  });
});

// ------------------------------------------------------------
// A PARTE 2, PASSO 1: A TELA PARA DE LER `contacts.email` E PASSA A LER O
// REGISTRO — pela regra que já tem dona.
//
// A JANELA DE DIVERGÊNCIA, em uma frase: o e-mail — e só ele — é gravado nos
// DOIS lugares (`gravarCampo`, lib/engine.ts, é o único escritor), para a Parte
// 1 entregar valor sem mexer em nenhuma tela. A Parte 2 fecha essa janela em
// dois passos, e a ORDEM é o que impede a tela de quebrar: PRIMEIRO todo mundo
// passa a ler pela regra (que lê o registro e, na falta dele, a coluna), DEPOIS
// a coluna sai. Invertido, a tela fica sem fonte nenhuma para quem foi coletado
// antes da migração `012` — que é aplicada À MÃO, fora do build.
//
// QUEM RESPONDE "QUAL VALOR VALE" É `lib/variables.ts`, e é a MESMA resposta
// que a DM enviada, a ficha da conversa e a planilha completa já usam. O que
// esta tarefa decide não é o VALOR: é ONDE a pergunta é feita — o corte
// (`comEmail`/`semEmail`), a busca e o arquivo congelado.
//
// OS TRÊS ESTADOS DE DIVERGÊNCIA QUE OS CASOS ABAIXO FIXAM:
//
//   COLUNA CHEIA, REGISTRO VAZIO  → vale a coluna. É o estado de todo contato
//     coletado antes da `012`, e é por ele que o Passo 1 vem antes do Passo 2.
//   REGISTRO CHEIO, COLUNA VAZIA  → vale o registro. É o estado que o Passo 2
//     cria para TODO MUNDO, então ele tem de funcionar antes de a coluna sair.
//   OS DOIS CHEIOS E DIFERENTES   → vale o REGISTRO, porque é ele que guarda o
//     QUANDO (lib/variables.ts diz por quê). Antes disto, o arquivo podia levar
//     o valor VELHO da coluna enquanto a DM saía com o valor NOVO.
// ------------------------------------------------------------
describe("Parte 2 / Passo 1 — o corte e a busca leem o REGISTRO", () => {
  const TUDO: FiltroDeCategoria = { tipo: "tudo" };

  // As quatro combinações de coluna x registro, numa lista só.
  const soColuna = contato({
    username: "antigo",
    name: "Antes da 012",
    email: "antigo@email.com",
    campos: {},
  });
  const soRegistro = contato({
    username: "novo",
    name: "Coletado agora",
    email: null,
    campos: { email: coletado("novo@email.com") },
  });
  const divergente = contato({
    username: "mudou",
    name: "Trocou de e-mail",
    email: "velho@email.com",
    campos: { email: coletado("atual@email.com") },
  });
  const nenhum = contato({ username: "sem.email", name: "Sem e-mail", email: null, campos: {} });

  const lista = [soColuna, soRegistro, divergente, nenhum];
  const usuarios = (l: ContatoExportavel[]) => l.map((c) => c.username);

  // -----------------------------------------------------------------
  // O CORTE — quem entra na seção "Com e-mail" e no arquivo do botão antigo.
  // -----------------------------------------------------------------
  it("quem só tem o e-mail no REGISTRO entra em `comEmail`", () => {
    // ESTE É O ESTADO QUE O PASSO 2 CRIA PARA TODO MUNDO. Enquanto o corte
    // olhava `c.email` (a coluna), esta pessoa caía em `semEmail` com um e-mail
    // coletado em mãos — e sumia do arquivo que o marketing baixa.
    const tela = recortarTela(lista, TUDO, null);
    expect(
      usuarios(tela.comEmail),
      "`comEmail` tem de sair da regra de lib/variables.ts (registro, e na falta " +
        "dele a coluna), e não de `c.email`: `novo` só tem o e-mail no registro."
    ).toEqual(["antigo", "novo", "mudou"]);
    expect(usuarios(tela.semEmail)).toEqual(["sem.email"]);
  });

  it("quem só tem a COLUNA continua entrando — a janela ainda está aberta", () => {
    // O PASSO 1 NÃO PODE QUEBRAR QUEM VEIO ANTES DA `012`. A queda para a
    // coluna mora em lib/variables.ts e é transitória; ela só some no Passo 2.
    expect(usuarios(recortarTela([soColuna], TUDO, null).comEmail)).toEqual(["antigo"]);
  });

  it("coluna em branco não é e-mail — é a mesma régua do `btrim` da migração 012", () => {
    // `email is not null` deixava passar a string VAZIA, e a `012` já tinha
    // decidido que isso não é e-mail (`btrim(email) <> ''`, com o motivo
    // escrito lá). A tela também já decidia assim (`filter(c => c.email)`).
    // Quem discordava das duas era só o `where` da rota congelada.
    const brancos = [
      contato({ username: "vazio", email: "", campos: {} }),
      contato({ username: "espacos", email: "   ", campos: {} }),
    ];
    const tela = recortarTela(brancos, TUDO, null);
    expect(usuarios(tela.comEmail)).toEqual([]);
    expect(usuarios(tela.semEmail)).toEqual(["vazio", "espacos"]);
  });

  // -----------------------------------------------------------------
  // A BUSCA — o terceiro jeito de alguém ser lembrado.
  // -----------------------------------------------------------------
  it("a busca acha pelo e-mail COLETADO, que não está na coluna", () => {
    expect(
      usuarios(peneirar(lista, { filtro: TUDO, busca: "novo@email.com" })),
      "a busca tem de casar pelo e-mail que VALE. Lendo `c.email`, quem coletou " +
        "o e-mail depois da Parte 1 deixa de ser achado pelo próprio e-mail."
    ).toEqual(["novo"]);
  });

  it("a busca continua achando pelo e-mail da COLUNA antiga", () => {
    expect(usuarios(peneirar(lista, { filtro: TUDO, busca: "antigo@email" }))).toEqual(["antigo"]);
  });

  it("com os dois cheios e diferentes, a busca casa pelo do REGISTRO", () => {
    // O CASO QUE SEPARA "LÊ O REGISTRO" DE "LÊ OS DOIS": procurando o valor
    // VELHO da coluna, `mudou` NÃO pode aparecer — senão a busca acha por um
    // e-mail que a tela não mostra e que a DM não envia.
    expect(usuarios(peneirar(lista, { filtro: TUDO, busca: "atual@email.com" }))).toEqual(["mudou"]);
    expect(
      usuarios(peneirar(lista, { filtro: TUDO, busca: "velho@email.com" })),
      "o valor VELHO da coluna não é o e-mail desta pessoa: o registro ganha, e " +
        "a busca tem de falar do mesmo e-mail que o resto da tela."
    ).toEqual([]);
  });
});

// ------------------------------------------------------------
// `emailDoContato` — A PERGUNTA, NUM LUGAR SÓ.
//
// ELA NÃO DECIDE NADA: quem decide qual valor vale é `lib/variables.ts`, e os
// casos dela vivem em tests/variables.test.ts. O que ESTES casos prendem é que a
// pergunta continua sendo feita àquela regra — e qual é o desfecho de cada
// estado de divergência, que é o que as telas e o arquivo vão mostrar.
//
// POR QUE OS TRÊS ESTADOS PRECISAM DE CASO, e não só o feliz: hoje a coluna e o
// registro estão em SINCRONIA (a `012` copiou o que havia, e `gravarCampo` é o
// único escritor, e escreve nos dois lugares), então quase tudo daria o mesmo
// resultado lendo qualquer um dos dois. É justamente por isso que um caso só do
// estado sincronizado não distinguiria "lê o registro" de "lê a coluna" — que é
// a única coisa que esta tarefa mudou.
// ------------------------------------------------------------
describe("emailDoContato — o registro primeiro, a coluna na falta dele", () => {
  it("COLUNA CHEIA, REGISTRO VAZIO: vale a coluna", () => {
    // É O ESTADO DE TODO CONTATO ANTERIOR À MIGRAÇÃO `012`, que é aplicada À
    // MÃO, fora do build. Sem esta queda, o Passo 1 apagaria da tela e do
    // arquivo o e-mail de quem já estava no ar — um passo de limpeza quebrando
    // o que funcionava.
    expect(emailDoContato({ email: "antigo@email.com", campos: {} })).toBe("antigo@email.com");
  });

  it("REGISTRO CHEIO, COLUNA VAZIA: vale o registro", () => {
    // É O ESTADO QUE O PASSO 2 CRIA PARA TODO MUNDO quando a coluna sair. Ele
    // tem de funcionar ANTES, senão a ordem dos dois passos não salva ninguém.
    expect(emailDoContato({ email: null, campos: { email: coletado("novo@email.com") } })).toBe(
      "novo@email.com"
    );
  });

  it("OS DOIS CHEIOS E DIFERENTES: vale o REGISTRO", () => {
    // O REGISTRO GUARDA O QUANDO; a coluna não tem data nem origem de coleta —
    // o porquê está escrito em lib/variables.ts. Na prática: quem corrigiu o
    // e-mail respondendo à automação de novo aparece com o e-mail NOVO na tela,
    // na busca e no arquivo, e não com o que ficou na coluna.
    expect(
      emailDoContato({ email: "velho@email.com", campos: { email: coletado("atual@email.com") } })
    ).toBe("atual@email.com");
  });

  it("registro em BRANCO não é resposta: cai na coluna", () => {
    // `valorColetado` (lib/variables.ts) apara antes de decidir, de propósito:
    // um valor só de espaço gravado por fora tem de contar como AUSENTE, senão
    // a queda para a coluna não acontece e o e-mail some com cara de vazio.
    expect(emailDoContato({ email: "vale@email.com", campos: { email: coletado("   ") } })).toBe(
      "vale@email.com"
    );
  });

  it("coluna em branco, ou nula, ou nada: texto vazio, e nunca `null`", () => {
    // VAZIO É A FORMA DA AUSÊNCIA, e é o que `temEmail` pergunta. `null` aqui
    // obrigaria cada chamador a lembrar de um segundo desfecho.
    expect(emailDoContato({ email: null, campos: {} })).toBe("");
    expect(emailDoContato({ email: "", campos: {} })).toBe("");
    expect(emailDoContato({ email: "   ", campos: {} })).toBe("");
    expect(emailDoContato({ email: null, campos: null })).toBe("");
  });

  it("a coluna sai APARADA, como a regra a entrega", () => {
    expect(emailDoContato({ email: "  ana@email.com  ", campos: {} })).toBe("ana@email.com");
  });

  it("`temEmail` é `emailDoContato` não vazio, e nada além disso", () => {
    // A EQUIVALÊNCIA É O PONTO: enquanto o corte, a busca e o arquivo
    // perguntarem pela mesma função, eles não têm como discordar sobre quem tem
    // e-mail — que é a discordância que o `where` da rota mantinha de pé.
    for (const c of [
      { email: "a@b.com", campos: {} },
      { email: null, campos: { email: coletado("a@b.com") } },
      { email: "", campos: {} },
      { email: "   ", campos: {} },
      { email: null, campos: {} },
      { email: "x@y.com", campos: { email: coletado("  ") } },
    ]) {
      expect(temEmail(c), `com ${JSON.stringify(c)}`).toBe(emailDoContato(c) !== "");
    }
  });
});

// ------------------------------------------------------------
// `listaDeEmailDaTela` — O CONTEÚDO DO ARQUIVO CONGELADO.
//
// A DIVISÃO DE TRABALHO, porque é ela que mantém a promessa verificável:
// `csvDaListaDeEmail` decide a MONTAGEM (cabeçalhos, separador, BOM, escape,
// neutralização) e tem o caso byte a byte lá em cima, intocado por esta tarefa.
// ESTA função decide o CONTEÚDO — quais pessoas, e com que e-mail —, que é
// exatamente o que o `where c.email is not null` decidia no banco e ninguém
// conseguia prender: a rota começa em `isValidSession`, e sessão não se forja.
// ------------------------------------------------------------
describe("listaDeEmailDaTela — quem entra no arquivo, e com que e-mail", () => {
  const TUDO: FiltroDeCategoria = { tipo: "tudo" };
  const linha = (p: Partial<ContatoExportavel> & { nome: string | null }) => ({
    ...contato(p),
    nome: p.nome,
  });

  const lista = [
    linha({ nome: "Antes da 012", username: "antigo", email: "antigo@email.com", campos: {} }),
    linha({
      nome: "Coletado agora",
      username: "novo",
      email: null,
      campos: { email: coletado("novo@email.com") },
    }),
    linha({
      nome: "Trocou de e-mail",
      username: "mudou",
      email: "velho@email.com",
      campos: { email: coletado("atual@email.com") },
    }),
    linha({ nome: "Sem e-mail", username: "sem.email", email: null, campos: {} }),
  ];

  it("entra quem o CORTE da tela deixou, e com o e-mail que VALE", () => {
    expect(listaDeEmailDaTela(recortarTela(lista, TUDO, null))).toEqual([
      { nome: "Antes da 012", email: "antigo@email.com" },
      { nome: "Coletado agora", email: "novo@email.com" },
      // O CASO QUE SEPARA REGISTRO DE COLUNA: lendo `c.email`, esta linha sairia
      // com `velho@email.com` — o arquivo do marketing levando um e-mail que a
      // tela não mostra e que a DM não envia.
      { nome: "Trocou de e-mail", email: "atual@email.com" },
    ]);
  });

  it("o arquivo é `tela.comEmail`, e não `tela.achados`", () => {
    // SEM ISTO, "Sem e-mail" entraria com a célula de e-mail VAZIA numa lista
    // que existe para ser importada numa ferramenta de e-mail — e o arquivo
    // deixaria de ser o do botão "Com e-mail" para virar o do outro botão.
    expect(listaDeEmailDaTela(recortarTela(lista, TUDO, null))).toHaveLength(3);
    expect(recortarTela(lista, TUDO, null).achados).toHaveLength(4);
  });

  it("as duas peneiras da tela valem, e o arquivo as respeita", () => {
    expect(listaDeEmailDaTela(recortarTela(lista, TUDO, "atual@email.com"))).toEqual([
      { nome: "Trocou de e-mail", email: "atual@email.com" },
    ]);
  });

  // ESTE É O CASO QUE MEDE O ARQUIVO INTEIRO: o recorte, o corte, a resolução do
  // e-mail e a montagem, no caminho de verdade. O caso byte a byte de
  // `csvDaListaDeEmail` prende a MONTAGEM e continua valendo sozinho; este
  // prende o que o marketing de fato abre.
  it("byte a byte: o arquivo que a rota devolve, do recorte ao CSV", () => {
    expect(csvDaListaDeEmail(listaDeEmailDaTela(recortarTela(lista, TUDO, null)))).toBe(
      "﻿Nome;E-mail\r\n" +
        "Antes da 012;antigo@email.com\r\n" +
        "Coletado agora;novo@email.com\r\n" +
        "Trocou de e-mail;atual@email.com"
    );
  });

  it("coluna em branco não vira linha de arquivo", () => {
    // O QUE O `where c.email is not null` DEIXAVA PASSAR, medido em 25/09/2026
    // contra o Postgres de teste: coluna `''` e coluna só de espaço passavam no
    // `where` e entravam no arquivo com a célula de e-mail em BRANCO — enquanto
    // a seção "Com e-mail" da tela contava zero. Regra com dois donos, e o lado
    // frouxo era o arquivo que já está em produção.
    const brancos = [
      linha({ nome: "Vazio", username: "vazio", email: "", campos: {} }),
      linha({ nome: "Espacos", username: "espacos", email: "   ", campos: {} }),
    ];
    expect(listaDeEmailDaTela(recortarTela(brancos, TUDO, null))).toEqual([]);
    expect(csvDaListaDeEmail(listaDeEmailDaTela(recortarTela(brancos, TUDO, null)))).toBe(
      "﻿Nome;E-mail"
    );
  });
});

// ------------------------------------------------------------
// `linhaDaListaDeEmail` — A COLUNA QUE SOME DO `select` DA ROTA CONGELADA.
//
// O BURACO FOI MEDIDO NESTA TAREFA, em 25/09/2026, e é o mesmo de
// `contatoExportavelDaLinha` numa rota que ainda não o tinha: tirando `c.campos`
// do `select` de app/api/contatos/csv/route.ts, `npx tsc --noEmit` passou VERDE
// e os 1884 casos puros passaram VERDE. A asserção `as` é promessa do autor ao
// compilador, e não checagem — as linhas chegariam com `campos: undefined`,
// `lerCampos` devolveria registro vazio para todo mundo, e o arquivo inteiro
// voltaria a sair da COLUNA: o Passo 1 desfeito em silêncio, com quem só tem o
// e-mail coletado sumindo da lista que o marketing importa.
//
// E A ROTA NÃO TEM COMO TER TESTE: ela começa em `isValidSession`, e sessão não
// se forja. Por isso a conferência tem de morar aqui, no módulo puro, onde ela
// é exercível — que é a mesma razão pela qual todo o resto deste arquivo existe.
// ------------------------------------------------------------
describe("linhaDaListaDeEmail — a coluna que falta não sai calada", () => {
  const linhaDoBanco = () => ({
    nome: "Ana Souza",
    username: "ana",
    name: "Ana Souza",
    email: "ana@email.com",
    campos: { email: coletado("coletado@email.com") },
    categoria: "aluno",
  });

  it("a linha completa vira linha da lista, com o `jsonb` cru", () => {
    expect(linhaDaListaDeEmail(linhaDoBanco())).toEqual({
      nome: "Ana Souza",
      username: "ana",
      name: "Ana Souza",
      email: "ana@email.com",
      campos: { email: coletado("coletado@email.com") },
      categoria: "aluno",
    });
  });

  it("e o que sai dela é o que o arquivo usa: o e-mail COLETADO", () => {
    // A LIGAÇÃO DAS DUAS PONTAS: a linha atravessa a leitura e chega ao arquivo
    // com o e-mail do registro, e não com o da coluna. Sem o `campos` vindo
    // inteiro daqui, esta expectativa diria `ana@email.com`.
    expect(emailDoContato(linhaDaListaDeEmail(linhaDoBanco()))).toBe("coletado@email.com");
  });

  it("CADA uma das seis colunas, faltando, estoura dizendo o nome dela", () => {
    // UMA POR UMA, e não só `campos`: as seis são usadas (o nome é a primeira
    // coluna do arquivo, três são os campos da busca, `campos` é de onde o
    // e-mail sai e `categoria` é a peneira do recorte), então cada uma que
    // sumir estraga o arquivo de um jeito diferente e calado.
    for (const coluna of ["nome", "username", "name", "email", "campos", "categoria"]) {
      const linha: Record<string, unknown> = linhaDoBanco();
      delete linha[coluna];
      expect(
        () => linhaDaListaDeEmail(linha),
        `sem a coluna \`${coluna}\` a leitura tem de estourar, e não seguir calada`
      ).toThrow(coluna);
    }
  });

  it("coluna PRESENTE e nula atravessa: é o normal desta tabela", () => {
    // `in`, E NÃO "TEM VALOR". A maioria dos contatos não tem categoria e muitos
    // não têm e-mail — se a conferência perguntasse pelo valor, ela derrubaria o
    // botão para gente de verdade, em produção, no primeiro clique.
    const linha = { ...linhaDoBanco(), email: null, categoria: null, nome: null, campos: null };
    expect(() => linhaDaListaDeEmail(linha)).not.toThrow();
    expect(linhaDaListaDeEmail(linha).email).toBeNull();
  });

  it("a mensagem diz as DUAS que faltaram, e não só a primeira", () => {
    const linha: Record<string, unknown> = linhaDoBanco();
    delete linha.campos;
    delete linha.categoria;
    expect(() => linhaDaListaDeEmail(linha)).toThrow(/campos, categoria/);
  });
});
