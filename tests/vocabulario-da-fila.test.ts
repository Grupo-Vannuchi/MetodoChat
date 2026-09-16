import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";

// O QUE ESTE ARQUIVO FECHA: o defeito medido em produção em 15/09/2026 —
// "/desempenho" dizia "Mensagens entregues: 5" com o motor tendo entregue 3 —
// teve a MESMA forma em quatro ocorrências nas últimas 48h: uma tela
// reescrevendo, em SQL, uma regra que já morava em `lib/`, e escrevendo
// errado (`media_id` exato, `dm_manual` como entrega do motor, fila viva só
// `pending`, mensagem recebida só `type='message'`). As Tarefas 1 e 2 deram
// dono às quatro definições (`lib/envio-filters.ts`, `lib/event-filters.ts`)
// e converteram as telas para lê-las por parâmetro. Este arquivo é o portão:
// se alguém voltar a escrever um destes valores à mão dentro de SQL, o
// `vitest run` fica vermelho.
//
// O MODELO É `tests/escala.test.ts`: mesma ideia (varrer árvore, tirar
// comentário antes de olhar, declarar exceção com motivo, provar que a
// varredura enxerga E que ela acusa). `semComentarios` abaixo é a função
// daquele arquivo, copiada com crédito — o porquê de copiar em vez de
// importar está no comentário dela.

const RAIZ = fileURLToPath(new URL("..", import.meta.url));

// ---------------------------------------------------------------------------
// OS LITERAIS VIGIADOS
// ---------------------------------------------------------------------------
//
// Os quatro valores que já tinham dono e foram reescritos à mão, mais o
// quinto que a mesma reescrita ameaçava (`story_reply`/`quick_reply` são as
// duas outras metades de `TIPOS_DE_MENSAGEM_RECEBIDA`, medidas junto:
// "14 story_reply numa semana" contadas como silêncio).
//
//   'dm_manual'    — KINDS_MANUAIS         (lib/envio-filters.ts)
//   'guardado'     — STATUS_DE_FILA_VIVA   (lib/envio-filters.ts)
//   'story_reply'  — TIPOS_DE_MENSAGEM_RECEBIDA / EVENT_TYPES (lib/event-filters.ts)
//   'quick_reply'  — idem
//   'abertura'     — idem
//
// 'publicacao' NÃO ENTRA NESTA LISTA, de propósito. Nas telas de
// `app/publicar/**` e em `app/labels.ts` ele é o ASSUNTO da tela (é o que a
// publicação É), não uma regra de exclusão — vigiá-lo faria o portão reprovar
// código correto, e um portão que reprova código certo é um portão que
// alguém desliga. Quem protege `sent7` (a subconsulta que excluía
// `publicacao` e devia excluir `KINDS_FORA_DA_ENTREGA_DO_MOTOR` inteiro) é o
// caso de integração da Tarefa 2, não este arquivo.
const LITERAIS_VIGIADOS = [
  "dm_manual",
  "guardado",
  "story_reply",
  "quick_reply",
  "abertura",
] as const;

// ---------------------------------------------------------------------------
// O QUE "PARECE SQL" QUER DIZER AQUI (revisão final, Tarefa 3-conserto)
// ---------------------------------------------------------------------------
//
// ATÉ AQUI, "parece SQL" era "está dentro de um template literal (crase)".
// Medido contra quatro entradas plantadas, esse critério tinha três pontos
// CEGOS e um FALSO POSITIVO:
//
//   entrada                                                        | achava?
//   sql().query("... kind = 'dm_manual'")  (aspa dupla)             | NÃO
//   sql().query('... kind = \'dm_manual\'')  (aspa simples escapada)| NÃO
//   SQL montado por concatenação de strings                        | NÃO
//   const msg = `removi o gatilho 'abertura'`;  (texto de UI)       | ACUSAVA
//
// Os três primeiros escapavam porque nenhum deles é "aspa simples dentro de
// crase" — a forma que o comentário original chamava de "a forma real de SQL
// reescrito à mão". Eram, mas o critério só sabia reconhecer UMA das formas
// possíveis de escrever a mesma coisa. O quarto acusava porque "dentro de
// crase" não distingue uma consulta de uma frase de interface que por acaso
// usa crase (template string) e cita o literal entre aspas simples para
// EXPLICAR uma decisão — o mesmo gênero de frase que este produto escreve aos
// montes fora de SQL.
//
// O CRITÉRIO NOVO: "parece SQL" = "está dentro do ARGUMENTO de uma chamada
// que manda texto para o banco" — `sql().query(`, `tx.query(` ou
// `<algo>.unsafe(` — OU dentro do template literal que segue `sql()` como
// TAGGED TEMPLATE (`` sql()`...` ``, a forma que `lib/queue-drain.ts` e
// `app/setup/page.tsx` usam quando a consulta não tem parâmetro nenhum).
//
// A pergunta deixa de ser "que tipo de aspa delimita o literal" — ela nunca
// devia ter sido essa — e passa a ser "este texto é argumento de uma chamada
// que fala com o banco". Isso fecha os três pontos cegos de uma vez: a aspa
// que delimita o literal, DENTRO do argumento, continua sendo achada não
// importa se é simples ou dupla, escapada ou não — e "SQL montado por
// concatenação" continua tendo o literal como o SEU PRÓPRIO token entre
// aspas, só que somado a outros por `+` em vez de escrito inteiro numa crase
// só. E fecha o falso positivo, porque um texto de UI nunca está dentro do
// argumento de nenhuma dessas três chamadas — não importa que ele use crase.
function textoDaChamada(conteudo: string): string[] {
  const blocos: string[] = [];

  // Três formas de "argumento entre parênteses": `sql().query(`, `tx.query(`
  // e `<identificador>.unsafe(` — este último sem exigir um receptor
  // específico, porque o produto chama `.unsafe` em conexões com nomes
  // diferentes (`cliente`, `tx`, `admin()`, `escritor`…) e o que importa é o
  // MÉTODO, não quem o chama.
  const gatilhosDeParenteses = [
    /sql\(\)\s*\.\s*query\s*\(/g,
    /tx\s*\.\s*query\s*\(/g,
    /[A-Za-z_$][\w$]*\s*\.\s*unsafe\s*\(/g,
  ];
  for (const re of gatilhosDeParenteses) {
    re.lastIndex = 0;
    // O RESULTADO DO `exec` NÃO É USADO — o que importa é o efeito colateral,
    // que é `lastIndex` avançar até logo depois do `(` que o gatilho consumiu.
    // A versão anterior guardava o resultado numa variável só para o `while`
    // ter o que testar, e ela ficava sem leitor nenhum.
    while (re.exec(conteudo) !== null) {
      const inicio = re.lastIndex; // logo depois do "(" que o gatilho consumiu
      const fim = fecharParenteses(conteudo, inicio);
      if (fim !== -1) blocos.push(conteudo.slice(inicio, fim));
    }
  }

  // A quarta forma: `sql()` chamado como TAGGED TEMPLATE, sem `.query`
  // nenhum — o `` ` `` abre o argumento, e não um `(`.
  const gatilhoDeCrase = /sql\(\)\s*`/g;
  gatilhoDeCrase.lastIndex = 0;
  // Idem: o que se quer do `exec` é `lastIndex`, e não o casamento.
  while (gatilhoDeCrase.exec(conteudo) !== null) {
    const inicio = gatilhoDeCrase.lastIndex; // logo depois da crase de abertura
    const fim = fecharCrase(conteudo, inicio);
    blocos.push(conteudo.slice(inicio, fim));
  }

  return blocos;
}

// Acha o índice do `)` que fecha o `(` já consumido pelo gatilho — contando
// aninhamento, e pulando o que estiver dentro de string ('...', "...", `...`)
// para um `)` de dentro de uma string não encerrar a chamada cedo demais.
// Comentários JÁ FORAM removidos por `semComentarios` antes de qualquer texto
// chegar aqui (ver `achadosNoConteudo`), então esta função não precisa saber
// o que é comentário.
function fecharParenteses(texto: string, aposAbre: number): number {
  let profundidade = 1;
  let i = aposAbre;
  while (i < texto.length) {
    const c = texto[i];
    if (c === "(") {
      profundidade++;
      i++;
    } else if (c === ")") {
      profundidade--;
      i++;
      if (profundidade === 0) return i - 1;
    } else if (c === "'" || c === '"' || c === "`") {
      i = fecharString(texto, i, c);
    } else {
      i++;
    }
  }
  return -1; // parênteses não fecham — chamada malformada ou truncada; ignora
}

// Acha o índice LOGO DEPOIS da aspa que fecha a string cuja aspa de abertura
// está em `texto[abre]`, tratando `\` como escape — é o que faz `\'` não
// encerrar uma string aberta com `'`.
function fecharString(texto: string, abre: number, aspa: string): number {
  let i = abre + 1;
  while (i < texto.length) {
    if (texto[i] === "\\") {
      i += 2;
      continue;
    }
    if (texto[i] === aspa) return i + 1;
    i++;
  }
  return texto.length;
}

// A mesma ideia de `fecharString`, para o `` ` `` que fecha um template
// literal chamado como tagged template.
function fecharCrase(texto: string, aposAbre: number): number {
  let i = aposAbre;
  while (i < texto.length) {
    if (texto[i] === "\\") {
      i += 2;
      continue;
    }
    if (texto[i] === "`") return i;
    i++;
  }
  return texto.length;
}

function achadosSql(conteudo: string): string[] {
  const achados: string[] = [];
  for (const bloco of textoDaChamada(conteudo)) {
    for (const literal of LITERAIS_VIGIADOS) {
      // A aspa que delimita o literal pode ser simples ou dupla, e pode vir
      // com um `\` de escape na frente — os dois primeiros pontos cegos
      // medidos. O literal não precisa estar colado a nada além da SUA
      // PRÓPRIA aspa: é assim que a concatenação (o terceiro ponto cego)
      // continua sendo achada sem virar um caso especial.
      const re = new RegExp("\\\\?['\"]" + literal + "\\\\?['\"]");
      if (re.test(bloco)) achados.push(literal);
    }
  }
  return achados;
}

// COMENTÁRIO NÃO É CÓDIGO — a mesma lição de tests/escala.test.ts, com uma
// segunda porta que aquele arquivo não precisava fechar.
//
// `app/page.tsx` e `app/desempenho/page.tsx` citam os literais vigiados em
// PROSA, para explicar por que a consulta os trata assim ("QUATRO TIPOS SAO
// 'mensagem recebida' ... o motor grava 'message', 'story_reply',
// 'quick_reply' e 'abertura'"). Reprovar essa explicação faria alguém apagar
// o comentário para o teste passar — exatamente o resultado que este
// conserto existe para evitar.
//
// A DIFERENÇA PARA O MODELO: aqui o comentário mora DENTRO do argumento da
// chamada SQL (o próprio arquivo registra isso: "sem crases neste comentario:
// ele mora DENTRO de um template literal, e uma crase o fecharia no meio"), e
// é comentário SQL (`--`), não comentário JS (`//`). `semComentarios` de
// tests/escala.test.ts só tira `/* */` e `//` — tirar `--` também é o que
// este arquivo acrescenta, e é por isso que ele copia a função em vez de
// importá-la: importar teria escondido esse acréscimo dentro de um arquivo
// que não é sobre isto.
//
// `--` só cai quando abre a linha (só espaço antes): é assim que toda
// consulta deste produto escreve comentário SQL (indentado, uma linha só), e
// medido contra `app/**` e `lib/**` inteiros nenhum código começa linha com
// `--` fora desse uso — não há `--variável` de CSS nem decremento solto no
// início de linha.
//
// A ORDEM IMPORTA: os comentários são tirados do arquivo INTEIRO ANTES de
// procurar as chamadas SQL — não depois. Tirar comentário DEPOIS de recortar
// o argumento arriscaria um `)` ou um `` ` `` dentro de um comentário
// confundir `fecharParenteses`/`fecharCrase`; tirando antes, esse caractere
// nunca chega a existir no texto que elas percorrem.
function semComentarios(fonte: string): string {
  let s = fonte.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
  s = s.replace(/^[ \t]*--.*$/gm, "");
  return s;
}

function achadosNoConteudo(fonte: string): string[] {
  return achadosSql(semComentarios(fonte));
}

// ---------------------------------------------------------------------------
// ESCOPO E EXCEÇÕES, DECLARADAS
// ---------------------------------------------------------------------------
//
// ATÉ AQUI a varredura andava só por `app/**`, e `lib/` ficava FORA inteiro —
// a justificativa era "é lá que as quatro definições moram". Essa
// justificativa vale para DOIS arquivos (`lib/envio-filters.ts`,
// `lib/event-filters.ts`), não para os dezoito que `lib/` tem. `lib/engine.ts`
// (a quinta cópia da definição de fila viva, achada e consertada nesta
// revisão), `lib/queue-drain.ts` e `lib/conversations.ts` são CONSUMIDORES,
// exatamente como as telas — e um consumidor que reescreve a definição à mão
// é o mesmo defeito, esteja ele num Server Component ou num arquivo
// `server-only`.
//
// A VARREDURA AGORA ANDA POR `app/**` E POR `lib/**`, e a exclusão encolheu
// de "o diretório inteiro" para "os dois arquivos que SÃO a fonte":
const FORA_DA_VARREDURA: string[] = [
  // A DEFINIÇÃO, não um consumidor dela — vigiá-lo reprovaria a própria fonte
  // da verdade que este portão protege.
  "lib/envio-filters.ts",
  // Idem, para `TIPOS_DE_MENSAGEM_RECEBIDA`/`EVENT_TYPES`.
  "lib/event-filters.ts",
];
//
// NENHUMA OUTRA EXCEÇÃO DE CAMINHO foi necessária. `app/labels.ts` é o caso
// que o brief original pedia para OLHAR ANTES DE EXCETUAR, exatamente porque
// é o arquivo que mapeia `kind`, `status` e `type` para rótulo de tela —
// escrever os valores ali É o trabalho dele. Conferido: o mapeamento é feito
// por CHAVE DE OBJETO (`dm_manual: "Resposta sua"`, `guardado: {...}`,
// `story_reply: {...}`, `quick_reply: {...}`, `abertura: {...}`) e por
// comparação de aspa dupla (`type === "quick_reply"`) contra um valor já lido
// do banco — nunca argumento de `sql().query`/`tx.query`/`.unsafe` (zero
// chamadas destas em `app/labels.ts`). A varredura não o acusa porque não há
// "argumento de chamada SQL" ali para acusar.

// EXCEÇÕES DE LITERAL — não de arquivo inteiro, porque excluir o arquivo
// inteiro cegaria o portão para qualquer OUTRA reescrita que apareça ali
// depois. Cada uma foi olhada linha a linha antes de ser declarada.
//
// `vezes` É QUANTAS OCORRÊNCIAS deste literal, NESTE arquivo, já são
// conhecidas e legítimas — não um booleano de "tem exceção ou não". SEM essa
// conta, uma exceção de (arquivo, literal) perdoaria QUALQUER número de
// ocorrências futuras do mesmo literal no mesmo arquivo: bastaria a PRIMEIRA
// ser legítima para todas as seguintes, inclusive uma reescrita nova, ficarem
// caladas atrás da mesma desculpa. Medido plantando `status in
// ('pending','guardado')` em `lib/engine.ts` (que já tinha uma ocorrência
// legítima de 'guardado' em `upsertContact`): sem `vezes`, o portão continuava
// mudo — a exceção existente perdoava as duas ocorrências, a antiga e a
// plantada, porque o `.find` só perguntava "existe uma exceção para este
// par?", nunca "quantas eu já concedi?". Com `vezes`, a SEGUNDA ocorrência
// (além da declarada) vira furo.
const EXCECOES_DE_LITERAL: { caminho: string; literal: string; vezes: number; motivo: string }[] = [
  {
    // `app/contatos/actions.ts:283` — `count(*) filter (where status =
    // 'guardado')::int as guardadas` está DENTRO da consulta que `enviarLote`
    // manda pro banco (`sql().query`), com aspa simples: bate com "argumento
    // de chamada SQL" em cheio, e é achado real, não falso positivo. Olhado
    // linha a linha (contexto em `app/contatos/actions.ts:255-279`): a
    // consulta quebra o lote em CINCO baldes nomeados — `agora` (sent),
    // `guardadas` (guardado), `pendentes` (pending+sending), `paradas`
    // (failed+skipped) e `total` — para `avisoDoLoteEnviado` (lib/avisos.ts)
    // escrever "24 entregues, 3 guardadas, 1 não saiu" sobre UM envio em lote
    // específico. Isso NÃO é a definição de "fila viva":
    // `STATUS_DE_FILA_VIVA` junta `guardado` com `pending` como "ainda vai
    // sair" e soma os dois; esta consulta faz o oposto — separa os cinco
    // status, um a um, porque a frase que ela alimenta precisa dizer QUANTO
    // de cada, não quantos "ainda não saíram" juntos. O próprio comentário do
    // arquivo (linhas 268-274) registra que a versão ANTIGA desta consulta
    // contava só três status e a soma não fechava — o conserto de 02/09/2026
    // foi abrir os cinco. Ler `STATUS_DE_FILA_VIVA` por parâmetro aqui
    // comeria a distinção que a consulta existe para fazer.
    caminho: "app/contatos/actions.ts",
    literal: "guardado",
    vezes: 1,
    motivo:
      "conta o balde 'guardadas' de UM lote específico, separado dos outros quatro " +
      "baldes (agora/pendentes/paradas/total) para avisoDoLoteEnviado (lib/avisos.ts) " +
      "— não é STATUS_DE_FILA_VIVA (que SOMA guardado+pending); é o oposto, separar.",
  },
  {
    // `lib/engine.ts:394` (dentro de `upsertContact`) — `and kind = 'dm_lote'
    // and status = 'guardado'` acorda um item de LOTE guardado quando a
    // pessoa volta a falar. É STATUS ÚNICO, e de propósito o contrário de
    // `STATUS_DE_FILA_VIVA`: o comentário da própria linha explica que pedir
    // `pending` ali (os dois estados) era o DEFEITO — casava com todo
    // `dm_lote` pendente da pessoa, inclusive um que o dreno tinha acabado de
    // marcar `pending` com backoff de erro, e zerava esse backoff. Usar
    // `STATUS_DE_FILA_VIVA` aqui REINTRODUZIRIA o defeito que esta linha
    // conserta — não é a mesma pergunta que a linha 2228 (`enqueueLote`)
    // fazia antes do conserto desta revisão, é a pergunta oposta.
    caminho: "lib/engine.ts",
    literal: "guardado",
    vezes: 1,
    motivo:
      "acorda especificamente o item GUARDADO quando a pessoa volta a falar " +
      "(upsertContact); pedir STATUS_DE_FILA_VIVA (os dois estados) reintroduziria o " +
      "defeito que esta linha existe para consertar — zerar o backoff de um item que " +
      "acabou de falhar e está pending de novo, não guardado.",
  },
  {
    // `lib/queue-drain.ts:874` e `:896` (dentro de `cancelarLotesVencidos`) —
    // as duas leem/escrevem só `status = 'guardado'`. O cabeçalho da função
    // diz por quê: ela varre POR DIA os itens guardados vencidos e os encerra
    // (`skipped`) sem NUNCA tocar em `pending` — misturar os dois reabriria a
    // fome de fila que `migrations/009-fila-estado-guardado.sql` fechou,
    // porque devolver um item guardado à disputa (mesmo para matá-lo) o
    // colocaria à frente de itens que já esperam há menos tempo. Um status só
    // é o contrato da função, não uma cópia truncada de STATUS_DE_FILA_VIVA.
    caminho: "lib/queue-drain.ts",
    literal: "guardado",
    // DUAS ocorrências: `:874` (a leitura) e `:896` (a escrita), as duas
    // dentro de `cancelarLotesVencidos` — ver o motivo abaixo.
    vezes: 2,
    motivo:
      "cancelarLotesVencidos varre só o status GUARDADO (nunca pending) para não " +
      "reabrir a fome de fila que a migração 009 fechou — um status só é o contrato " +
      "da função, o oposto de STATUS_DE_FILA_VIVA (que soma os dois).",
  },
  {
    // `lib/conversations.ts:300` — `when 'guardado' then 'guardado'`, dentro
    // do `case` que traduz os SEIS status da fila para os QUATRO valores de
    // `MessageDelivery` (linha 28: "sent" | "sending" | "failed" |
    // "guardado") que o balão da conversa entende. Isto não é "fila viva": é
    // exatamente O QUE ESTE ARQUIVO EXISTE PARA FAZER, o trabalho de tradução
    // para rótulo — a mesma classe de exceção que `app/labels.ts` recebeu por
    // objeto/aspa-dupla, só que aqui a tradução acontece dentro do `case` de
    // uma consulta SQL, em vez de fora dela. Comer este literal por parâmetro
    // apagaria a diferença entre o VALOR de status ('guardado', que entra
    // pela coluna do banco) e o RÓTULO que a tela usa (o mesmo texto, aqui,
    // mas por coincidência de nome — não porque sejam o mesmo conceito).
    caminho: "lib/conversations.ts",
    literal: "guardado",
    vezes: 1,
    motivo:
      "traduz o status da fila para o rótulo MessageDelivery que o balão da conversa " +
      "entende (case status ... as delivery) — é o trabalho deste arquivo, não uma " +
      "cópia de STATUS_DE_FILA_VIVA.",
  },
  {
    // `lib/conversations.ts:338` — `and q.kind in (...,'dm_manual','dm_lote')`
    // é a lista POSITIVA de kinds que contam como "DM de verdade" nesta
    // conversa (o comentário do arquivo, linhas 315-334, explica por que ela é
    // positiva e por que cada kind que falta nela some da conversa em
    // silêncio). `dm_manual` está aqui porque é uma DM como qualquer outra do
    // ponto de vista de "isto aparece na conversa" — a pergunta que esta
    // lista responde. Não é `KINDS_MANUAIS`: aquela lista responde "isto foi
    // o motor ou uma pessoa", uma pergunta diferente, que este arquivo nem
    // faz. Comer este literal por `KINDS_MANUAIS` estaria emprestando uma
    // lista que significa outra coisa.
    caminho: "lib/conversations.ts",
    literal: "dm_manual",
    vezes: 1,
    motivo:
      "faz parte da lista POSITIVA de kinds que contam como DM nesta conversa — " +
      "responde 'isto aparece no balão?', não 'isto foi manual ou automático?' " +
      "(a pergunta de KINDS_MANUAIS); dm_manual entra pela mesma porta que dm_link.",
  },
];

function arquivosDeTela(dir: string, achados: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    const rel = relative(RAIZ, caminho).replace(/\\/g, "/");
    if (FORA_DA_VARREDURA.some((f) => rel === f || rel.startsWith(`${f}/`))) continue;
    if (statSync(caminho).isDirectory()) {
      arquivosDeTela(caminho, achados);
    } else if (/\.tsx?$/.test(nome)) {
      achados.push(caminho);
    }
  }
  return achados;
}

// `app/**` E `lib/**` — a exclusão, ver acima, encolheu de "lib/ inteiro"
// para os dois arquivos que SÃO a fonte.
const ARQUIVOS = [...arquivosDeTela(join(RAIZ, "app")), ...arquivosDeTela(join(RAIZ, "lib"))];

describe("a varredura", () => {
  it("enxerga a árvore que diz enxergar", () => {
    // Uma varredura vazia passa por vacuidade. Este caso é o que impede isso.
    expect(ARQUIVOS.length).toBeGreaterThan(50);
    const rel = ARQUIVOS.map((a) => relative(RAIZ, a).replace(/\\/g, "/"));
    expect(rel).toContain("app/page.tsx");
    expect(rel).toContain("app/desempenho/page.tsx");
    expect(rel).toContain("app/contatos/actions.ts");
    expect(rel).toContain("app/labels.ts");
    // `lib/` ENTRA AGORA — só os dois arquivos-fonte ficam de fora.
    expect(rel).toContain("lib/engine.ts");
    expect(rel).toContain("lib/queue-drain.ts");
    expect(rel).toContain("lib/conversations.ts");
    expect(rel).not.toContain("lib/envio-filters.ts");
    expect(rel).not.toContain("lib/event-filters.ts");
  });

  it("acusa quando há o que acusar — se não acusa nada, não mede nada", () => {
    // A CONTRAPROVA CENTRAL: os cinco literais vigiados, dentro do argumento
    // de `sql().query(`, na forma mais comum do produto (crase, aspa
    // simples), têm de ser achados.
    expect(
      achadosNoConteudo("await sql().query(`select * from queue where kind = 'dm_manual'`)")
    ).toEqual(["dm_manual"]);
    expect(
      achadosNoConteudo(
        "await sql().query(`select * from events where type in ('story_reply','quick_reply','abertura')`)"
      )
    ).toEqual(["story_reply", "quick_reply", "abertura"]);
    // `tx.query(` e `.unsafe(` são as outras duas formas nomeadas pela
    // revisão, e as duas têm de acusar também.
    expect(
      achadosNoConteudo("await tx.query(`select * from queue where status = 'guardado'`)")
    ).toEqual(["guardado"]);
    expect(
      achadosNoConteudo("await escritor.unsafe(`select * from queue where kind = 'dm_manual'`)")
    ).toEqual(["dm_manual"]);
    // E A FORMA SEM `.query`: `sql()` como tagged template.
    expect(
      achadosNoConteudo("await sql()`select * from queue where status = 'guardado'`")
    ).toEqual(["guardado"]);

    // OS TRÊS PONTOS CEGOS MEDIDOS, agora fechados — os três só existem
    // DENTRO do argumento de uma chamada: fora dela, não são o assunto deste
    // portão.
    //
    // 1. ASPA DUPLA no lugar da crase.
    expect(
      achadosNoConteudo('await sql().query("select * from queue where kind = \'dm_manual\'")')
    ).toEqual(["dm_manual"]);
    // 2. ASPA SIMPLES ESCAPADA dentro de uma string de aspa simples.
    expect(
      achadosNoConteudo(
        "await sql().query('select * from queue where kind = \\'dm_manual\\'')"
      )
    ).toEqual(["dm_manual"]);
    // 3. SQL MONTADO POR CONCATENAÇÃO — o literal continua sendo o SEU
    // PRÓPRIO token entre aspas, só que somado a outros por `+`.
    expect(
      achadosNoConteudo(
        'await sql().query("select * from queue where kind = \'" + "dm_manual" + "\'")'
      )
    ).toEqual(["dm_manual"]);

    // O FALSO POSITIVO MEDIDO, agora fechado: texto de UI, entre crases,
    // citando o literal entre aspas simples — mas FORA de qualquer chamada
    // que fale com o banco.
    expect(achadosNoConteudo("const msg = `removi o gatilho 'abertura'`;")).toEqual([]);

    // Fora de qualquer chamada E fora de crase — nunca foi o que este portão
    // vigia.
    expect(achadosNoConteudo("const x = 'dm_manual';")).toEqual([]);
  });

  it("NÃO acusa o mesmo valor dentro de comentário — a armadilha que já mordeu este repositório", () => {
    // Comentário JS, de linha e de bloco, citando o literal proibido para
    // EXPLICAR a exclusão — exatamente o que app/page.tsx faz fora da
    // consulta.
    expect(
      achadosNoConteudo(
        "// KINDS_MANUAIS já cobre 'dm_manual', não escreva de novo aqui\nconst y = 1;"
      )
    ).toEqual([]);
    expect(
      achadosNoConteudo("/* a lista já existe: 'guardado' vem de STATUS_DE_FILA_VIVA */")
    ).toEqual([]);
    // Comentário SQL (`--`), DENTRO do argumento da chamada — a forma real de
    // app/page.tsx:195 ("-- grava 'message', 'story_reply', 'quick_reply' e
    // 'abertura'"). Sem tirar `--`, este caso reprovaria a própria explicação
    // do conserto.
    expect(
      achadosNoConteudo(
        [
          "await sql().query(`select",
          "  -- grava 'message', 'story_reply', 'quick_reply' e 'abertura' (lib/engine.ts)",
          "  count(*) from events where type = any($1::text[])`)",
        ].join("\n")
      )
    ).toEqual([]);
  });

  it("varre a árvore de verdade e só acha o que já foi conferido e excetuado", () => {
    const furos: string[] = [];
    const excecoesUsadas = new Set<string>();
    for (const caminho of ARQUIVOS) {
      const rel = relative(RAIZ, caminho).replace(/\\/g, "/");
      const conteudo = readFileSync(caminho, "utf8");

      // CONTADO POR (literal), E NÃO SÓ "existe achado" — ver o comentário de
      // `vezes` acima de `EXCECOES_DE_LITERAL`. Uma exceção perdoa uma
      // QUANTIDADE de ocorrências, não uma presença booleana.
      const contagem = new Map<string, number>();
      for (const literal of achadosNoConteudo(conteudo)) {
        contagem.set(literal, (contagem.get(literal) ?? 0) + 1);
      }

      for (const [literal, vezes] of contagem) {
        const excecao = EXCECOES_DE_LITERAL.find(
          (e) => e.caminho === rel && e.literal === literal
        );
        const permitidas = excecao?.vezes ?? 0;
        if (excecao) excecoesUsadas.add(`${excecao.caminho}:${excecao.literal}`);
        if (vezes > permitidas) {
          furos.push(
            `${rel}: '${literal}' (${vezes}x achado, ${permitidas}x excetuado — ` +
              `${vezes - permitidas} a mais que o combinado)`
          );
        }
      }
    }
    // O QUE SOBRA depois de tirar as exceções declaradas (até a QUANTIDADE
    // combinada) tem de ser zero — se a Tarefa 2 deixou passar algo, ou se
    // algo novo foi escrito à mão (inclusive uma SEGUNDA ocorrência do mesmo
    // literal que já tinha uma exceção), é aqui que aparece.
    expect(furos).toEqual([]);
    // TODA EXCEÇÃO DECLARADA TEM DE CORRESPONDER A UM ACHADO REAL: uma
    // exceção que não bate com nada é dívida que já foi paga e ninguém tirou
    // da lista — o mesmo risco de uma exceção nunca ter sido verdadeira.
    for (const e of EXCECOES_DE_LITERAL) {
      expect(
        excecoesUsadas.has(`${e.caminho}:${e.literal}`),
        `exceção sem uso: ${e.caminho} '${e.literal}' — o código mudou, a exceção não`
      ).toBe(true);
    }
  });
});
