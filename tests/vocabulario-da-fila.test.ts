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
// O QUE "PARECE SQL" QUER DIZER AQUI, e por que é mais estreito que "a
// palavra aparece no arquivo"
// ---------------------------------------------------------------------------
//
// Este produto escreve SQL de um jeito único, sempre: `sql().query(\`...\`,
// [params])` — a consulta inteira é um template literal (crase), e dentro
// dela um literal de string SQL é sempre com ASPA SIMPLES (`status =
// 'sent'`, `kind = 'dm_lote'`). Todo o resto do código — comparação de JS já
// carregado (`m.delivery === "guardado"`), constante de domínio
// (`GATILHO_DE_ABERTURA = "abertura"`, em app/setup/portas.ts, que é o
// GATILHO de uma automação, vocabulário diferente de "tipo de evento" e
// nunca vai para dentro de uma consulta), rótulo de tela (`app/labels.ts`) —
// usa ASPA DUPLA. A convenção não tem uma exceção medida na árvore inteira
// (conferido).
//
// Por isso "parece SQL" = "está dentro de um template literal (crase) E
// escrito com aspa simples". As duas condições juntas são o que distingue
// `app/contatos/actions.ts:283` (`status = 'guardado'` dentro da consulta
// que `sql().query` manda pro banco — precisa de decisão, ver a exceção
// abaixo) de `app/setup/portas.ts:36` (`"abertura"`, aspa dupla, fora de
// qualquer crase — nunca vira SQL) e de `app/automacoes/actions.ts:54`
// (`["comment", "story", "dm", "abertura"]`, mesma coisa).
function textosDeConsulta(conteudo: string): string[] {
  const achados: string[] = [];
  const re = /`(?:\\.|[^`\\])*`/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(conteudo))) achados.push(m[0]);
  return achados;
}

function achadosSql(conteudo: string): string[] {
  const achados: string[] = [];
  for (const bloco of textosDeConsulta(conteudo)) {
    for (const literal of LITERAIS_VIGIADOS) {
      if (bloco.includes(`'${literal}'`)) achados.push(literal);
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
// A DIFERENÇA PARA O MODELO: aqui o comentário mora DENTRO do template
// literal da consulta SQL (o próprio arquivo registra isso: "sem crases
// neste comentario: ele mora DENTRO de um template literal, e uma crase o
// fecharia no meio"), e é comentário SQL (`--`), não comentário JS (`//`).
// `semComentarios` de tests/escala.test.ts só tira `/* */` e `//` — tirar
// `--` também é o que este arquivo acrescenta, e é por isso que ele copia a
// função em vez de importá-la: importar teria escondido esse acréscimo
// dentro de um arquivo que não é sobre isto.
//
// `--` só cai quando abre a linha (só espaço antes): é assim que toda
// consulta deste produto escreve comentário SQL (indentado, uma linha só), e
// medido contra a árvore inteira nenhum código de `app/` começa linha com
// `--` fora desse uso — não há `--variável` de CSS nem decremento solto no
// início de linha em `app/**/*.ts(x)`.
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
// A varredura anda só por `app/**` (nunca a árvore inteira): `lib/` fica
// FORA de propósito, porque é lá que as quatro definições moram — é o
// trabalho daqueles dois arquivos escrever `"dm_manual"`, `"guardado"`,
// `"story_reply"`, `"quick_reply"` e `"abertura"`. Vigiar `lib/` reprovaria a
// própria fonte da verdade que este portão protege.
//
// NENHUMA EXCEÇÃO DE CAMINHO foi necessária dentro de `app/` — nenhum
// arquivo inteiro precisa ficar de fora. `app/labels.ts` é o caso que o
// brief pedia para OLHAR ANTES DE EXCETUAR, exatamente porque é o arquivo
// que mapeia `kind`, `status` e `type` para rótulo de tela — escrever os
// valores ali É o trabalho dele. Conferido: o mapeamento é feito por CHAVE
// DE OBJETO (`dm_manual: "Resposta sua"`, `guardado: {...}`, `story_reply:
// {...}`, `quick_reply: {...}`, `abertura: {...}`) e por comparação de aspa
// dupla (`type === "quick_reply"`) contra um valor já lido do banco — nunca
// aspa simples dentro de crase, e `app/labels.ts` não escreve nenhuma
// consulta SQL (zero `sql().query`). A varredura não o acusa porque não há
// "texto que parece SQL" ali para acusar — não precisou de exceção nenhuma,
// de caminho ou de literal.
const FORA_DA_VARREDURA: string[] = [];

// EXCEÇÃO DE LITERAL — não de arquivo inteiro, porque excluir o arquivo
// inteiro cegaria o portão para qualquer OUTRA reescrita que apareça ali
// depois.
//
// `app/contatos/actions.ts:283` — `count(*) filter (where status =
// 'guardado')::int as guardadas` está DENTRO da consulta que `enviarLote`
// manda pro banco (`sql().query`), com aspa simples dentro de crase: bate
// com "parece SQL" em cheio, e é achado real, não falso positivo. Olhado
// linha a linha (contexto em `app/contatos/actions.ts:255-279`): a consulta
// quebra o lote em CINCO baldes nomeados — `agora` (sent), `guardadas`
// (guardado), `pendentes` (pending+sending), `paradas` (failed+skipped) e
// `total` — para `avisoDoLoteEnviado` (lib/avisos.ts) escrever "24
// entregues, 3 guardadas, 1 não saiu" sobre UM envio em lote específico.
// Isso NÃO é a definição de "fila viva": `STATUS_DE_FILA_VIVA` junta
// `guardado` com `pending` como "ainda vai sair" e soma os dois; esta
// consulta faz o oposto — separa os cinco status, um a um, porque a frase
// que ela alimenta precisa dizer QUANTO de cada, não quantos "ainda não
// saíram" juntos. O próprio comentário do arquivo (linhas 268-274) registra
// que a versão ANTIGA desta consulta contava só três status e a soma não
// fechava — o conserto de 02/09/2026 foi abrir os cinco. Ler
// `STATUS_DE_FILA_VIVA` por parâmetro aqui comeria a distinção que a
// consulta existe para fazer.
const EXCECOES_DE_LITERAL: { caminho: string; literal: string; motivo: string }[] = [
  {
    caminho: "app/contatos/actions.ts",
    literal: "guardado",
    motivo:
      "conta o balde 'guardadas' de UM lote específico, separado dos outros quatro " +
      "baldes (agora/pendentes/paradas/total) para avisoDoLoteEnviado (lib/avisos.ts) " +
      "— não é STATUS_DE_FILA_VIVA (que SOMA guardado+pending); é o oposto, separar.",
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

const ARQUIVOS = arquivosDeTela(join(RAIZ, "app"));

describe("a varredura", () => {
  it("enxerga a árvore que diz enxergar", () => {
    // Uma varredura vazia passa por vacuidade. Este caso é o que impede isso.
    expect(ARQUIVOS.length).toBeGreaterThan(50);
    const rel = ARQUIVOS.map((a) => relative(RAIZ, a).replace(/\\/g, "/"));
    expect(rel).toContain("app/page.tsx");
    expect(rel).toContain("app/desempenho/page.tsx");
    expect(rel).toContain("app/contatos/actions.ts");
    expect(rel).toContain("app/labels.ts");
    // `lib/` nunca entra: é onde as definições moram.
    expect(rel.some((r) => r.startsWith("lib/"))).toBe(false);
  });

  it("acusa quando há o que acusar — se não acusa nada, não mede nada", () => {
    // A CONTRAPROVA: os cinco literais vigiados, dentro de um texto que
    // parece exatamente a forma real da consulta ("kind = 'dm_manual'",
    // dentro de crase), têm de ser achados.
    expect(
      achadosNoConteudo("await sql().query(`select * from queue where kind = 'dm_manual'`)")
    ).toEqual(["dm_manual"]);
    expect(
      achadosNoConteudo("`select count(*) from queue where status = 'guardado'`")
    ).toEqual(["guardado"]);
    expect(
      achadosNoConteudo(
        "`select * from events where type in ('story_reply','quick_reply','abertura')`"
      )
    ).toEqual(["story_reply", "quick_reply", "abertura"]);
    // Fora de crase (não "parece SQL" pela convenção deste projeto), mesmo
    // com aspa simples, não é o que este portão vigia — ele vigia SQL
    // reescrito, não qualquer aspa simples perdida no arquivo.
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
    // Comentário SQL (`--`), DENTRO do template literal da consulta — a
    // forma real de app/page.tsx:195 ("-- grava 'message', 'story_reply',
    // 'quick_reply' e 'abertura'"). Sem tirar `--`, este caso reprovaria a
    // própria explicação do conserto.
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
      for (const literal of achadosNoConteudo(conteudo)) {
        const excecao = EXCECOES_DE_LITERAL.find(
          (e) => e.caminho === rel && e.literal === literal
        );
        if (excecao) {
          excecoesUsadas.add(`${excecao.caminho}:${excecao.literal}`);
          continue;
        }
        furos.push(`${rel}: '${literal}'`);
      }
    }
    // O QUE SOBRA depois de tirar as exceções declaradas tem de ser zero —
    // se a Tarefa 2 deixou passar algo, ou se algo novo foi escrito à mão, é
    // aqui que aparece.
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
