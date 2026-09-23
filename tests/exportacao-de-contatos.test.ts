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
  csvDaListaDeEmail,
  chavesLivres,
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
