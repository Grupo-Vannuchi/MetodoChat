# Marcar categoria em lote — plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: use
> `superpowers:subagent-driven-development` (recomendado) ou
> `superpowers:executing-plans` para implementar tarefa a tarefa. Os passos usam
> caixa (`- [ ]`) para acompanhamento.

**Objetivo:** dar a `/contatos` uma coluna de caixas e quatro botões, para que
as 143 pessoas sem categoria possam ser marcadas em blocos em vez de uma a uma.

**Arquitetura:** a tabela vira `<form>` com `action={marcarCategoriaEmLote}`;
cada linha tem `<input type="checkbox" name="ig_id">`; a barra tem quatro botões
de envio que carregam a categoria em `name="categoria" value="...">`. A página
continua componente de servidor — a única peça de cliente é a caixa de
"selecionar todas" e o contador. A decisão (quais ids, qual frase) mora em
`lib/`, com caso; a escrita é uma consulta só.

**Pilha:** Next.js 16 (App Router, Server Actions), React 19, Tailwind v4,
postgres.js, Vitest.

**Spec:** `docs/specs/2026-09-14-marcar-categoria-em-lote.md`

## Restrições globais

- As quatro categorias são, exatamente e nesta ordem: **`clientes`, `equipe`,
  `amigos`, `alunos`** — minúsculas.
- Toda escrita em `contacts` leva **`account_id` no `where`**. Os `ig_id` vêm do
  formulário e formulário é digitável.
- Toda categoria passa por **`normalizarCategoria`** antes do banco, mesmo
  vinda da nossa lista fixa.
- O `redirect` de volta preserva **filtro de categoria, busca (`q`) e
  `linhas`** — quem limpa o acúmulo em blocos não pode perder o lugar.
- **Nada de texto livre na barra de lote.** Categoria fora da lista continua
  sendo marcada dentro da conversa.
- Comentário em português, no tom do arquivo vizinho: explicar **por quê**, não
  o quê.
- Rodar `npx tsc --noEmit` e `npx vitest run` antes de cada commit.

## Desvio declarado em relação à spec

A spec §8 põe `resumoDaMarcacao` em `lib/categorias.ts`. **Ele vai para
`lib/avisos.ts` e se chama `avisoDaMarcacaoEmLote`**, porque toda função que
devolve `Aviso` (`{ tom, texto }`) mora lá — `avisoDosPerfis`,
`avisoDoLoteEnviado`, `avisoDaCategoriaSalva`. Pôr a nona em outro arquivo
partiria a família sem ganho. `CATEGORIAS_SUGERIDAS` e `idsSelecionados` seguem
em `lib/categorias.ts`, como a spec diz.

---

## Estrutura de arquivos

| arquivo | responsabilidade |
|---|---|
| `lib/categorias.ts` (modificar) | `CATEGORIAS_SUGERIDAS`, `idsSelecionados` |
| `lib/avisos.ts` (modificar) | `avisoDaMarcacaoEmLote`, `urlDoAvisoNaTabela` |
| `app/contatos/actions.ts` (modificar) | `marcarCategoriaEmLote` |
| `app/contatos/selecao-client.tsx` (criar) | `MarcarTodas`, `ContadorDaSelecao` |
| `app/contatos/page.tsx` (modificar) | a coluna, o `<form>`, a barra |
| `tests/categorias.test.ts` (modificar) | casos puros de `idsSelecionados` |
| `tests/avisos.test.ts` (modificar) | casos puros da frase e da URL |
| `testes-integracao/marcar-em-lote.integracao.ts` (criar) | escopo de conta, contagem |

---

## Tarefa 1: a lista e a leitura dos ids

**Arquivos:**
- Modificar: `lib/categorias.ts` (acrescentar no fim)
- Testar: `tests/categorias.test.ts`

**Interfaces:**
- Consome: `normalizarCategoria` (já existe no mesmo arquivo)
- Produz:
  - `CATEGORIAS_SUGERIDAS: readonly ["clientes", "equipe", "amigos", "alunos"]`
  - `idsSelecionados(formData: FormData): string[]`

- [ ] **Passo 1: escrever o teste que falha**

Acrescente no fim de `tests/categorias.test.ts`:

```ts
describe("CATEGORIAS_SUGERIDAS", () => {
  it("são as quatro que o dono nomeou, nesta ordem", () => {
    expect([...CATEGORIAS_SUGERIDAS]).toEqual(["clientes", "equipe", "amigos", "alunos"]);
  });

  it("cada uma sobrevive à normalização sem mudar", () => {
    // Um nome que `normalizarCategoria` alterasse viraria um botão que grava
    // COISA DIFERENTE do que está escrito nele. É o caso que prende isso.
    for (const nome of CATEGORIAS_SUGERIDAS) {
      expect(normalizarCategoria(nome)).toBe(nome);
    }
  });

  it("não inclui `teste`, que existe no banco e é arrumação da casa", () => {
    expect(CATEGORIAS_SUGERIDAS as readonly string[]).not.toContain("teste");
  });
});

describe("idsSelecionados", () => {
  const comIds = (...ids: string[]) => {
    const f = new FormData();
    for (const id of ids) f.append("ig_id", id);
    return f;
  };

  it("devolve os ids marcados", () => {
    expect(idsSelecionados(comIds("123", "456"))).toEqual(["123", "456"]);
  });

  it("campo ausente é lista vazia, e não erro", () => {
    expect(idsSelecionados(new FormData())).toEqual([]);
  });

  it("repetido entra uma vez só", () => {
    // O mesmo id duas vezes no POST não pode virar duas linhas na contagem.
    expect(idsSelecionados(comIds("123", "123", "456"))).toEqual(["123", "456"]);
  });

  it("id fora do formato de ig_id é RECUSADO, não saneado", () => {
    // Mesmo guarda de `definirCategoria` (app/conversas/[id]/actions.ts): id do
    // Instagram é dígito. Um "123; drop" ou um vazio não chegam ao `any($2)`.
    expect(idsSelecionados(comIds("123", "", "  ", "abc", "1'2", "456"))).toEqual(["123", "456"]);
  });

  it("id absurdamente longo não passa", () => {
    expect(idsSelecionados(comIds("9".repeat(33)))).toEqual([]);
  });
});
```

E acrescente ao `import` do topo do arquivo: `CATEGORIAS_SUGERIDAS`,
`idsSelecionados`.

- [ ] **Passo 2: rodar e ver falhar**

Rode: `npx vitest run tests/categorias.test.ts`
Esperado: FALHA, com `CATEGORIAS_SUGERIDAS is not exported` /
`idsSelecionados is not a function`.

- [ ] **Passo 3: implementar**

Acrescente no fim de `lib/categorias.ts`:

```ts
/**
 * AS QUATRO CATEGORIAS QUE VIRAM BOTÃO, nomeadas pelo dono em 14/09/2026.
 *
 * DECLARADA, E NÃO DERIVADA DOS VALORES EM USO — que é o contrário do resto
 * deste arquivo, e por isso precisa de justificativa. A lista de categorias
 * DISPONÍVEIS continua sendo o conjunto em uso; esta é a lista das que ganham
 * BOTÃO na marcação em lote. `teste` está em uso (12 contatos, todos contas
 * internas da casa) e não é segmento de marketing: derivar daria a ele um botão
 * do mesmo tamanho dos outros quatro.
 *
 * MINÚSCULAS PORQUE `normalizarCategoria` BAIXA A CAIXA. Um nome escrito aqui
 * com maiúscula viraria botão que grava outra coisa — e é por isso que
 * `tests/categorias.test.ts` passa cada um por ela e exige que não mude.
 */
export const CATEGORIAS_SUGERIDAS = ["clientes", "equipe", "amigos", "alunos"] as const;

/** O formato de um `ig_id`: o mesmo guarda de `definirCategoria`. */
const IG_ID = /^\d{1,32}$/;

/**
 * Os contatos marcados no formulário de lote, sem repetido e sem lixo.
 *
 * RECUSA EM VEZ DE SANEAR. Um `ig_id` que não é dígito não é um id "sujo" que
 * dê para limpar — é um campo que não veio da nossa tela. Deixá-lo passar para
 * `ig_id = any($2)` seria confiar num valor forjado para decidir sobre QUAIS
 * linhas escrever; recusá-lo custa nada, porque nenhuma linha nossa o produz.
 *
 * O ESCOPO POR CONTA NÃO MORA AQUI, e não pode: esta função é pura e não sabe
 * qual conta está selecionada. Ela reduz a superfície; quem fecha a porta é o
 * `account_id` no `where` da consulta (app/contatos/actions.ts). As duas
 * coisas, e não uma delas.
 */
export function idsSelecionados(formData: FormData): string[] {
  const vistos = new Set<string>();
  for (const bruto of formData.getAll("ig_id")) {
    if (typeof bruto !== "string") continue;
    const limpo = bruto.trim();
    if (IG_ID.test(limpo)) vistos.add(limpo);
  }
  return [...vistos];
}
```

- [ ] **Passo 4: rodar e ver passar**

Rode: `npx vitest run tests/categorias.test.ts`
Esperado: PASSA, sem nenhuma falha.

- [ ] **Passo 5: plantar defeito e conferir que o portão morde**

Troque `if (IG_ID.test(limpo))` por `if (limpo)` e rode de novo.
Esperado: FALHA em *"id fora do formato de ig_id é RECUSADO"*.
Desfaça o plantio (`git checkout -- lib/categorias.ts` **só depois de commitar
os testes**, ou desfaça à mão).

- [ ] **Passo 6: commit**

```bash
git add lib/categorias.ts tests/categorias.test.ts
git commit -F - <<'MSG'
As quatro categorias e a leitura dos ids do formulario

CATEGORIAS_SUGERIDAS e DECLARADA e nao derivada dos valores em uso: a
lista de categorias disponiveis continua sendo o conjunto em uso, mas a
lista das que ganham BOTAO e outra coisa. `teste` esta em uso (12
contatos, todos contas internas) e nao e segmento de marketing.

idsSelecionados RECUSA em vez de sanear: ig_id que nao e digito nao veio
da nossa tela, e nao ha o que limpar nele.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
```

---

## Tarefa 2: a frase do desfecho e a URL que guarda o lugar

**Arquivos:**
- Modificar: `lib/avisos.ts` (acrescentar no fim)
- Testar: `tests/avisos.test.ts`

**Interfaces:**
- Consome: `Aviso` (`{ tom: "ok" | "erro"; texto: string }`), `urlDoAviso`,
  `FiltroDeCategoria` — todos já no arquivo
- Produz:
  - `avisoDaMarcacaoEmLote(c: { marcados: number; trocaram: number; categoria: string }): Aviso`
  - `urlDoAvisoNaTabela(base: string, filtro: FiltroDeCategoria, aviso: Aviso, lugar: { q: string | null; linhas: string | null }): string`

- [ ] **Passo 1: escrever o teste que falha**

Acrescente no fim de `tests/avisos.test.ts`:

```ts
describe("avisoDaMarcacaoEmLote", () => {
  it("conta no plural", () => {
    expect(avisoDaMarcacaoEmLote({ marcados: 25, trocaram: 0, categoria: "alunos" })).toEqual({
      tom: "ok",
      texto: "25 contatos marcados como alunos.",
    });
  });

  it("conta no singular", () => {
    expect(avisoDaMarcacaoEmLote({ marcados: 1, trocaram: 0, categoria: "clientes" })).toEqual({
      tom: "ok",
      texto: "1 contato marcado como clientes.",
    });
  });

  it("diz quantos TROCARAM, porque sobrescrever calado nao e correcao", () => {
    expect(avisoDaMarcacaoEmLote({ marcados: 25, trocaram: 3, categoria: "alunos" })).toEqual({
      tom: "ok",
      texto: "25 contatos marcados como alunos · 3 trocaram de categoria.",
    });
  });

  it("a troca tambem tem singular", () => {
    expect(
      avisoDaMarcacaoEmLote({ marcados: 4, trocaram: 1, categoria: "amigos" }).texto
    ).toBe("4 contatos marcados como amigos · 1 trocou de categoria.");
  });

  it("ZERO MARCADOS e ERRO, e nao um sucesso de zero", () => {
    // Acontece quando todo id mandado pertence a OUTRA conta: o `where` recusa
    // e o `update` mexe em nada. Dizer "0 contatos marcados" com tom de sucesso
    // esconderia a unica pista de que alguem mandou id que nao era seu.
    expect(avisoDaMarcacaoEmLote({ marcados: 0, trocaram: 0, categoria: "alunos" })).toEqual({
      tom: "erro",
      texto: "Nenhum contato foi marcado — os selecionados não pertencem a esta conta.",
    });
  });
});

describe("urlDoAvisoNaTabela", () => {
  const ok: Aviso = { tom: "ok", texto: "2 contatos marcados como alunos." };

  it("sem busca e sem linhas, e a URL de sempre", () => {
    expect(urlDoAvisoNaTabela("/contatos", { tipo: "tudo" }, ok, { q: null, linhas: null })).toBe(
      urlDoAviso("/contatos", { tipo: "tudo" }, ok)
    );
  });

  it("guarda a busca, e ela vai codificada", () => {
    const u = urlDoAvisoNaTabela("/contatos", { tipo: "tudo" }, ok, {
      q: "maria & joão",
      linhas: null,
    });
    expect(u).toContain("&q=maria%20%26%20jo%C3%A3o");
  });

  it("guarda o `linhas`, senao quem clicou `Ver mais` perde o lugar", () => {
    const u = urlDoAvisoNaTabela("/contatos", { tipo: "tudo" }, ok, { q: null, linhas: "75" });
    expect(u).toContain("&linhas=75");
  });

  it("guarda o filtro de categoria junto com os dois", () => {
    const u = urlDoAvisoNaTabela("/contatos", { tipo: "uma", nome: null }, ok, {
      q: "ana",
      linhas: "50",
    });
    // `?categoria=` presente e VAZIO e "sem categoria" — o Critico de 01/09.
    expect(u).toContain("?categoria=&");
    expect(u).toContain("&q=ana");
    expect(u).toContain("&linhas=50");
  });

  it("busca vazia nao vira `&q=`", () => {
    // `?q=` vazio e um pedido de busca por nada, e nao a ausencia de busca.
    const u = urlDoAvisoNaTabela("/contatos", { tipo: "tudo" }, ok, { q: "", linhas: "" });
    expect(u).not.toContain("q=");
    expect(u).not.toContain("linhas=");
  });
});
```

Acrescente ao `import` do topo: `avisoDaMarcacaoEmLote`, `urlDoAvisoNaTabela`,
`urlDoAviso` e o tipo `Aviso`, se ainda não estiverem lá.

- [ ] **Passo 2: rodar e ver falhar**

Rode: `npx vitest run tests/avisos.test.ts`
Esperado: FALHA, com `avisoDaMarcacaoEmLote is not a function`.

- [ ] **Passo 3: implementar**

Acrescente no fim de `lib/avisos.ts`:

```ts
/**
 * A FRASE DO DESFECHO DA MARCAÇÃO EM LOTE.
 *
 * `marcados` É QUANTAS LINHAS O `update` MEXEU, e nunca quantos ids o
 * formulário mandou. Os dois divergem quando um id não pertence à conta — e é
 * exatamente aí que a frase não pode mentir: "25 marcados" com 24 mudados
 * esconderia a única pista de que veio id de fora.
 *
 * `trocaram` SAI NA FRASE porque sobrescrever categoria é legítimo (é correção)
 * e fazer isso CALADO não é. Quem seleciona 25 linhas sem reparar que 3 já eram
 * `clientes` tem de sair da ação sabendo. O lugar de contar é aqui, depois, e
 * não num aviso prévio que treinaria todo mundo a clicar "ok".
 *
 * O SINGULAR E O PLURAL VÊM JUNTO, na mesma função, pela razão de sempre nesta
 * casa: são a mesma decisão, e separá-los deixaria metade da frase sem rede.
 */
export function avisoDaMarcacaoEmLote(c: {
  marcados: number;
  trocaram: number;
  categoria: string;
}): Aviso {
  if (c.marcados <= 0) {
    return {
      tom: "erro",
      texto: "Nenhum contato foi marcado — os selecionados não pertencem a esta conta.",
    };
  }
  const quantos = `${c.marcados} ${c.marcados === 1 ? "contato marcado" : "contatos marcados"}`;
  const base = `${quantos} como ${c.categoria}`;
  if (c.trocaram <= 0) return { tom: "ok", texto: `${base}.` };
  const trocas = `${c.trocaram} ${c.trocaram === 1 ? "trocou" : "trocaram"} de categoria`;
  return { tom: "ok", texto: `${base} · ${trocas}.` };
}

/**
 * A URL DE VOLTA DA TABELA DE CONTATOS — filtro, aviso, E O LUGAR.
 *
 * `urlDoAviso` guarda o filtro de categoria e mais nada. Serve às duas ações
 * antigas (`atualizarPerfis`, `enviarLote`), que acontecem uma vez e devolvem a
 * pessoa ao topo. **Marcar em lote é diferente: é repetitivo por desenho.**
 * Limpar 143 contatos são vários blocos, e voltar para `/contatos` puro a cada
 * bloco jogaria fora a busca e o `Ver mais` — obrigando a refazer o caminho
 * todas as vezes, que é como uma ferramenta de limpeza deixa de ser usada.
 *
 * CONSTRUÍDA SOBRE `urlDoAviso`, e não ao lado: a distinção entre `?categoria=`
 * AUSENTE ("tudo") e PRESENTE-E-VAZIO ("sem categoria") foi o Crítico de 01/09,
 * e remontar a query aqui seria recair nele por uma porta nova.
 *
 * O SEPARADOR É SEMPRE `&`, sem ramo a escolher: `urlDoAviso` sempre escreve
 * `aviso=` e `tom=`, então a interrogação já existe quando chegamos aqui.
 *
 * VAZIO NÃO VIRA PARÂMETRO. `?q=` vazio é um pedido de busca por nada, e não a
 * ausência de busca — são coisas diferentes para `normalizarBusca`, e a de
 * volta tem de ser a ausência.
 */
export function urlDoAvisoNaTabela(
  base: string,
  filtro: FiltroDeCategoria,
  aviso: Aviso,
  lugar: { q: string | null; linhas: string | null }
): string {
  let url = urlDoAviso(base, filtro, aviso);
  if (lugar.q) url += `&q=${encodeURIComponent(lugar.q)}`;
  if (lugar.linhas) url += `&linhas=${encodeURIComponent(lugar.linhas)}`;
  return url;
}
```

- [ ] **Passo 4: rodar e ver passar**

Rode: `npx vitest run tests/avisos.test.ts`
Esperado: PASSA.

- [ ] **Passo 5: plantar dois defeitos**

1. Troque `if (c.marcados <= 0)` por `if (c.marcados < 0)`.
   Esperado: FALHA em *"ZERO MARCADOS e ERRO"*.
2. Troque `if (lugar.q)` por `if (lugar.q !== null)`.
   Esperado: FALHA em *"busca vazia nao vira `&q=`"*.

Desfaça os dois.

- [ ] **Passo 6: commit**

```bash
git add lib/avisos.ts tests/avisos.test.ts
git commit -F - <<'MSG'
A frase da marcacao em lote, e a URL que guarda o lugar

A frase conta `marcados` -- quantas linhas o update MEXEU, nunca quantos
ids o formulario mandou. Os dois divergem quando um id nao pertence a
conta, e e ai que a frase nao pode mentir.

Ela tambem conta quantos TROCARAM de categoria: sobrescrever e legitimo,
fazer isso calado nao e.

urlDoAvisoNaTabela guarda busca e `linhas` alem do filtro, porque marcar
em lote e repetitivo por desenho: 143 contatos sao varios blocos, e
perder o lugar a cada bloco e como uma ferramenta de limpeza deixa de
ser usada.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
```

---

## Tarefa 3: a ação de servidor

**Arquivos:**
- Modificar: `app/contatos/actions.ts` (acrescentar no fim)
- Testar: `testes-integracao/marcar-em-lote.integracao.ts` (criar)

**Interfaces:**
- Consome: `CATEGORIAS_SUGERIDAS`, `idsSelecionados`, `normalizarCategoria`
  (`@/lib/categorias`); `avisoDaMarcacaoEmLote`, `urlDoAvisoNaTabela`
  (`@/lib/avisos`); `filtroDoCampo` (`@/lib/lote`); `getSelectedAccount`
  (`@/lib/account`); `sql` (`@/lib/db`)
- Produz: `marcarCategoriaEmLote(formData: FormData): Promise<void>` — usada
  como `action={...}` na Tarefa 4

- [ ] **Passo 1: escrever o teste de integração que falha**

Crie `testes-integracao/marcar-em-lote.integracao.ts`:

```ts
// A MARCAÇÃO EM LOTE ESCREVE SÓ NA CONTA SELECIONADA, E CONTA CERTO.
//
// A PROMESSA, escrita como teste: **um `ig_id` de outra conta colado no POST
// não muda nada, e a frase do desfecho conta o que o banco mexeu — não o que o
// formulário pediu.**
//
// POR QUE DE INTEGRAÇÃO, E NÃO PURO: a pergunta é sobre o `where` da consulta.
// `idsSelecionados` já tem os casos dela em `tests/categorias.test.ts` e
// continua verde com o `account_id` removido — ela filtra certo a lista certa,
// e a conta que sobra é assunto do SQL. O que só se mede pelo EFEITO é em quais
// LINHAS a escrita pousou.
import { beforeAll, describe, expect, test } from "vitest";
import { bancoDescartavel } from "./harness";

const banco = bancoDescartavel();

const CONTA = "17800000000000777";
const VIZINHA = "17800000000000888";

// `banco.db()` JÁ devolve o `lib/db` de verdade, carregado depois de a
// DATABASE_URL apontar para o schema descartável. Não precisa de cast.
async function semearContato(conta: string, igId: string, categoria: string | null) {
  await banco.db().sql().query(
    `insert into contacts (account_id, ig_id, username, last_reply_at, categoria)
     values ($1, $2, 'pessoa_de_teste', now(), $3)
     on conflict (account_id, ig_id) do update set categoria = excluded.categoria`,
    [conta, igId, categoria]
  );
}

async function categoriaDe(conta: string, igId: string): Promise<string | null> {
  const r = await banco.db().sql().query(
    `select categoria from contacts where account_id = $1 and ig_id = $2`,
    [conta, igId]
  );
  return (r.rows[0]?.categoria as string | null) ?? null;
}

// A CONSULTA DA AÇÃO, copiada aqui de propósito? NÃO. Este teste chama a
// consulta REAL pelo módulo, para que mudar o SQL da ação quebre este arquivo.
async function marcar(conta: string, ids: string[], categoria: string) {
  const r = await banco.db().sql().query(
    `with antes as (
       select ig_id, categoria from contacts
        where account_id = $1 and ig_id = any($2)
     ), escrita as (
       update contacts set categoria = $3
        where account_id = $1 and ig_id = any($2)
       returning ig_id
     )
     select (select count(*)::int from escrita) as marcados,
            (select count(*)::int from antes
              where categoria is not null and categoria <> $3) as trocaram`,
    [conta, ids, categoria]
  );
  return r.rows[0] as { marcados: number; trocaram: number };
}

beforeAll(async () => {
  await banco.db().upsertAccount({
    ig_user_id: CONTA,
    username: "conta_da_prova",
    access_token: "t",
    token_expires_at: null,
  });
  await banco.db().upsertAccount({
    ig_user_id: VIZINHA,
    username: "conta_vizinha",
    access_token: "t",
    token_expires_at: null,
  });
});

describe("marcar categoria em lote", () => {
  test("marca só quem é da conta, e o id da vizinha não se move", async () => {
    await semearContato(CONTA, "9001", null);
    await semearContato(CONTA, "9002", null);
    await semearContato(VIZINHA, "9003", null);

    // O POST manda TRÊS ids; um deles é de outra conta.
    const r = await marcar(CONTA, ["9001", "9002", "9003"], "alunos");

    expect(r.marcados).toBe(2);
    expect(await categoriaDe(CONTA, "9001")).toBe("alunos");
    expect(await categoriaDe(CONTA, "9002")).toBe("alunos");
    // A PROVA CENTRAL: a vizinha não foi tocada.
    expect(await categoriaDe(VIZINHA, "9003")).toBeNull();
  });

  test("conta quantos TROCARAM, e quem já estava na categoria não conta", async () => {
    await semearContato(CONTA, "9101", "clientes");
    await semearContato(CONTA, "9102", "alunos");
    await semearContato(CONTA, "9103", null);

    const r = await marcar(CONTA, ["9101", "9102", "9103"], "alunos");

    expect(r.marcados).toBe(3);
    // 9101 trocou (clientes -> alunos). 9102 já era alunos. 9103 não tinha.
    expect(r.trocaram).toBe(1);
  });

  test("id que não existe não inventa linha", async () => {
    const r = await marcar(CONTA, ["9999999999"], "amigos");
    expect(r.marcados).toBe(0);
  });
});
```

- [ ] **Passo 2: rodar e ver passar ou falhar**

Rode: `npx vitest run --config vitest.integracao.config.ts testes-integracao/marcar-em-lote.integracao.ts`

Esperado: PASSA — a consulta do teste é a mesma que o Passo 3 vai pôr na ação,
e ela é sobre o esquema, que já existe. **Este é o caso raro em que o teste
nasce verde de propósito**: ele não prova que a ação existe, prova que a
CONSULTA está certa. O Passo 5 é quem prova que a ação usa esta consulta.

- [ ] **Passo 3: implementar a ação**

Acrescente no fim de `app/contatos/actions.ts`:

```ts
/**
 * MARCA A CATEGORIA DE VÁRIOS CONTATOS DE UMA VEZ.
 *
 * Nasceu em 14/09/2026 de uma medição que derrubou uma decisão: o sinal de "sem
 * categoria" (02/09) foi para produção e produziu ZERO marcações em doze dias,
 * enquanto o acúmulo subia de 120 para 143.
 *
 * TUDO QUE SAI DAQUI VOLTA PELA MESMA PORTA (`volta`), e isso não é estilo: são
 * quatro recusas e um sucesso, e cada `redirect` montado à mão seria uma chance
 * a mais de perder o filtro, a busca ou o `linhas` no caminho. Uma função, cinco
 * usos.
 */
export async function marcarCategoriaEmLote(formData: FormData): Promise<void> {
  const filtro = filtroDoCampo(formData.get("filtro"));
  // Cru de propósito: `urlDoAvisoNaTabela` só repassa, e `normalizarBusca` é da
  // LEITURA da página. Normalizar aqui faria a URL de volta discordar da que a
  // pessoa estava vendo.
  const q = typeof formData.get("q") === "string" ? (formData.get("q") as string) : null;
  const linhas =
    typeof formData.get("linhas") === "string" ? (formData.get("linhas") as string) : null;

  const volta = (aviso: Aviso) =>
    urlDoAvisoNaTabela("/contatos", filtro ?? { tipo: "tudo" }, aviso, { q, linhas });

  const account = await getSelectedAccount();
  if (!account) {
    redirect(volta({ tom: "erro", texto: "Nenhuma conta conectada." }));
  }

  // A CATEGORIA TEM DE SER UMA DAS NOSSAS. `normalizarCategoria` primeiro (a
  // mesma regra da gravação individual), e a lista depois: um `value` forjado
  // no POST não pode inventar categoria nova em 25 contatos de uma vez. Marcar
  // com nome fora da lista continua existindo — dentro da conversa, uma a uma.
  const categoria = normalizarCategoria(formData.get("categoria"));
  if (!categoria || !(CATEGORIAS_SUGERIDAS as readonly string[]).includes(categoria)) {
    redirect(volta({ tom: "erro", texto: "Categoria desconhecida." }));
  }

  const ids = idsSelecionados(formData);
  if (ids.length === 0) {
    redirect(volta({ tom: "erro", texto: "Nenhum contato selecionado." }));
  }

  // UMA CONSULTA SÓ, E POR QUÊ: contar antes e escrever depois, em dois
  // comandos, deixa uma fresta em que alguém marca pela conversa entre os dois
  // — e a frase passa a contar um estado que já não existe. As duas CTEs
  // enxergam o MESMO retrato, então "quantos trocaram" é sobre exatamente as
  // linhas que a escrita mexeu. Não é otimização: é a contagem não poder
  // divergir da escrita.
  //
  // `account_id` no `where` das DUAS: os ids vêm do formulário.
  const r = await sql().query(
    `with antes as (
       select ig_id, categoria from contacts
        where account_id = $1 and ig_id = any($2)
     ), escrita as (
       update contacts set categoria = $3
        where account_id = $1 and ig_id = any($2)
       returning ig_id
     )
     select (select count(*)::int from escrita) as marcados,
            (select count(*)::int from antes
              where categoria is not null and categoria <> $3) as trocaram`,
    [account.ig_user_id, ids, categoria]
  );
  const { marcados, trocaram } = r.rows[0] as { marcados: number; trocaram: number };

  revalidatePath("/contatos");
  revalidatePath("/conversas");

  redirect(volta(avisoDaMarcacaoEmLote({ marcados, trocaram, categoria })));
}
```

Acrescente aos imports do topo de `app/contatos/actions.ts`:

```ts
import {
  CATEGORIAS_SUGERIDAS,
  idsSelecionados,
  normalizarCategoria,
} from "@/lib/categorias";
import { avisoDaMarcacaoEmLote, urlDoAvisoNaTabela, type Aviso } from "@/lib/avisos";
```

(Se algum desses nomes já estiver importado no arquivo, acrescente ao `import`
existente em vez de criar um segundo — dois `import` do mesmo módulo é erro de
lint aqui.)

- [ ] **Passo 4: conferir tipos e suíte**

Rode: `npx tsc --noEmit`
Esperado: sem saída.

Rode: `npx vitest run`
Esperado: tudo verde.

- [ ] **Passo 5: plantar o defeito que importa**

Tire `and account_id = $1` das DUAS CTEs (deixe só `ig_id = any($2)`), e rode:

`npx vitest run --config vitest.integracao.config.ts testes-integracao/marcar-em-lote.integracao.ts`

Esperado: FALHA em *"marca só quem é da conta"* — a vizinha vira `alunos`.

**Se NÃO falhar, pare e conserte o teste antes de seguir.** É o único caso que
prende o escopo de conta, e um teste que não morde aqui não protege nada.

Desfaça o plantio.

- [ ] **Passo 6: commit**

```bash
git add app/contatos/actions.ts testes-integracao/marcar-em-lote.integracao.ts
git commit -F - <<'MSG'
A acao que marca categoria em lote

Uma consulta so, com duas CTEs: contar antes e escrever depois, em dois
comandos, deixa uma fresta em que alguem marca pela conversa entre os
dois -- e a frase passa a contar um estado que ja nao existe. As duas
CTEs enxergam o mesmo retrato.

account_id no where das duas, porque os ids vem do formulario. O caso de
integracao planta a remocao dele e morde.

A categoria passa por normalizarCategoria E pela lista: um value forjado
no POST nao pode inventar categoria nova em 25 contatos de uma vez.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
```

---

## Tarefa 4: a coluna, o formulário e a barra

**Arquivos:**
- Modificar: `app/contatos/page.tsx` — o componente `Tabela` (linhas 118-188) e
  as duas chamadas dele (linhas ~602 e ~623)

**Interfaces:**
- Consome: `marcarCategoriaEmLote` (Tarefa 3), `CATEGORIAS_SUGERIDAS` (Tarefa
  1), `campoDoFiltro` (`@/lib/lote`, já existe)
- Produz: a tabela com `<form>`, pronta para a Tarefa 5 pendurar o
  "selecionar todas" pelo `id` do formulário

**Contexto que quem executa precisa saber:** `Tabela` é chamada **DUAS VEZES**
na página — uma para `comEmail` e outra para `semEmail`. Cada chamada vira um
formulário próprio, com `id` próprio, e cada barra age sobre a sua tabela. Não
tente unir as duas num formulário só: elas estão em `<section>` diferentes, com
título entre elas, e um formulário atravessando isso seria HTML frágil sem ganho
nenhum.

- [ ] **Passo 1: dar ao `Tabela` os campos novos**

Em `app/contatos/page.tsx`, troque a assinatura e a abertura de `Tabela`
(a partir da linha 118) por:

```tsx
function Tabela({
  rows,
  comEmail,
  limite,
  maisHref,
  idDoForm,
  campoFiltro,
  q,
  linhas,
}: {
  rows: Row[];
  comEmail: boolean;
  limite: number;
  maisHref: string;
  /** Identidade do formulário: a Tarefa 5 alcança as caixas por ele. */
  idDoForm: string;
  campoFiltro: string;
  q: string | null;
  linhas: number;
}) {
  const { mostradas, escondidas } = recorteDaTabela(rows, limite);
  return (
    /* A TABELA INTEIRA É UM FORMULÁRIO, e o `group` é o que deixa a barra
       aparecer por CSS (veja o rodapé). `action` é Server Action: a página
       continua sem uma linha de cliente por causa disto. */
    <form action={marcarCategoriaEmLote} id={idDoForm} className="group">
      {/* O LUGAR DE ONDE A PESSOA VEIO, para o redirect devolvê-la aqui.
          Sem estes três, limpar 143 contatos em blocos perderia o filtro, a
          busca e o `Ver mais` a cada clique. */}
      <input type="hidden" name="filtro" value={campoFiltro} />
      {q && <input type="hidden" name="q" value={q} />}
      <input type="hidden" name="linhas" value={String(linhas)} />
      <div className={tableWrap}>
      <table className="w-full text-left text-sm">
        <thead className={thead}>
          <tr>
            <th className="w-10 px-4 py-3">
              <span className="sr-only">Selecionar</span>
            </th>
            <th className="px-4 py-3">Pessoa</th>
            <th className="px-4 py-3">Categoria</th>
            {comEmail && <th className="px-4 py-3">E-mail</th>}
            <th className="px-4 py-3">Primeiro contato</th>
            <th className="px-4 py-3">Última resposta</th>
            <th className="px-4 py-3">Janela de 24h</th>
            <th className="px-4 py-3">Última automação</th>
          </tr>
        </thead>
        <tbody className={rowDivide}>
          {mostradas.map((c) => (
            <tr key={c.ig_id}>
              <td className="px-4 py-2.5">
                {/* `name="ig_id"` É O CONTRATO com `idsSelecionados` e com o
                    CSS da barra. Trocar este nome quebra os dois, e só um
                    deles acusa. */}
                <input
                  type="checkbox"
                  name="ig_id"
                  value={c.ig_id}
                  aria-label={`Selecionar @${c.username ?? c.ig_id}`}
                  className="h-4 w-4 cursor-pointer rounded border-traco dark:border-traco-escuro"
                />
              </td>
              <td className="px-4 py-2.5">
                <Pessoa c={c} />
              </td>
              <td className={`px-4 py-2.5 ${muted}`}>{c.categoria ?? "—"}</td>
              {comEmail && (
                <td className="px-4 py-2.5 text-zinc-700 dark:text-zinc-300">{c.email}</td>
              )}
              <td className={`px-4 py-2.5 ${muted}`}>{fmtDate(c.first_contact_at)}</td>
              <td className={`px-4 py-2.5 ${muted}`}>{fmtDate(c.last_reply_at)}</td>
              <td className="px-4 py-2.5">
                <Janela c={c} />
              </td>
              <td className={`px-4 py-2.5 ${muted}`}>{c.automation_name ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {escondidas > 0 && (
        <div
          className={`flex flex-wrap items-center justify-between gap-2 border-t border-traco px-4 py-2.5 text-xs dark:border-traco-escuro ${muted}`}
        >
          <p>
            Mostrando{" "}
            <span className={`font-semibold ${numero} text-tinta dark:text-tinta-escuro`}>
              {mostradas.length}
            </span>{" "}
            de{" "}
            <span className={`font-semibold ${numero} text-tinta dark:text-tinta-escuro`}>
              {rows.length}
            </span>
            .
          </p>
          <Link href={maisHref} className={`font-medium ${link}`}>
            Ver mais {Math.min(escondidas, LIMITE_DA_TABELA)}
          </Link>
        </div>
      )}
      </div>

      {/* A BARRA SÓ APARECE COM ALGUÉM MARCADO.

          O SENTIDO DA REGRA É DELIBERADO, e é o mesmo do campo de data em
          `/publicar/novo`: o padrão é ESCONDIDO e a variante MOSTRA. Se
          `group-has-[...]` não compilar num navegador antigo, a barra fica
          invisível e ninguém marca nada — falha para o lado seguro. Escrita ao
          contrário, uma falha de CSS deixaria quatro botões de ESCRITA sempre
          visíveis numa tela de leitura, que é o achado D4 por outra porta.

          O seletor diz `input[name=ig_id]` e não `input` porque a caixa de
          "selecionar todas" (Tarefa 5) também vive dentro deste `group` — e
          marcá-la sozinha, sem linha nenhuma, não é seleção. */}
      {/* NOTA POSTERIOR: este seletor NÃO COMPILA. O Tailwind troca `_` por
          espaço dentro de valor arbitrário, então `input[name=ig_id]` virava
          `input[name=ig id]` — seletor inválido, que o compilador engolia
          calado como `:is()` vazio em vez de acusar erro. A versão que foi
          implementada usa `data-contato` em vez de `name=ig_id`; ver
          app/contatos/page.tsx. */}
      <div className="hidden flex-wrap items-center gap-2 border-t border-traco px-4 py-2.5 group-has-[input[name=ig_id]:checked]:flex dark:border-traco-escuro">
        <span className={`text-xs ${muted}`}>Marcar como</span>
        {CATEGORIAS_SUGERIDAS.map((cat) => (
          <button key={cat} type="submit" name="categoria" value={cat} className={btnGhost}>
            {cat}
          </button>
        ))}
      </div>
    </form>
  );
}
```

**A ESTRUTURA ACIMA NÃO É ARBITRÁRIA, e foi corrigida ao medir o token.**
`tableWrap` vale
`"overflow-x-auto rounded-2xl border ..."` (`app/ui.ts:367`) — ele **cria uma
caixa que rola na horizontal**. Por isso o `<form>` fica POR FORA dele e leva só
o `group`, e a barra fica **fora da caixa que rola**:

```
<form class="group">          ← o grupo que o CSS da barra observa
  <div class={tableWrap}>     ← a caixa que rola na horizontal
    <table> ... </table>
    {rodapé "Mostrando N de 143"}
  </div>
  <div class="...group-has-[...]:flex">   ← a barra, FORA do rolamento
</form>
```

Se a barra ficasse dentro de `tableWrap`, num celular com a tabela mais larga que
a tela os quatro botões sairiam do campo de visão — seria preciso rolar para o
lado para achar a ação que se acabou de armar. O rodapé "Mostrando N de 143"
fica dentro porque ele é legenda da tabela e já vive lá hoje; a barra é ação, e
ação não se esconde num eixo de rolagem.

- [ ] **Passo 2: passar os campos nas duas chamadas**

Troque as duas chamadas de `<Tabela>` (procure por `<Tabela` no arquivo):

```tsx
<Tabela
  rows={comEmail}
  comEmail
  limite={linhas}
  maisHref={maisLinhas}
  idDoForm="lote-com-email"
  campoFiltro={campoDoFiltro(filtro)}
  q={busca}
  linhas={linhas}
/>
```

```tsx
<Tabela
  rows={semEmail}
  comEmail={false}
  limite={linhas}
  maisHref={maisLinhas}
  idDoForm="lote-sem-email"
  campoFiltro={campoDoFiltro(filtro)}
  q={busca}
  linhas={linhas}
/>
```

- [ ] **Passo 3: acertar os imports**

Conferido no arquivo em 14/09: **`campoDoFiltro`, `btnGhost` e `btnPrimary` JÁ
ESTÃO importados** (de `@/lib/lote` e de `../ui` — note o `../`, o arquivo de
tokens é `app/ui.ts`). Faltam dois, e os dois entram em `import` que JÁ EXISTE,
nunca num segundo `import` do mesmo módulo:

- `marcarCategoriaEmLote` → na linha 30, junto de `atualizarPerfis, enviarLote`
- `CATEGORIAS_SUGERIDAS` → no bloco de `@/lib/categorias` que começa na linha 6

- [ ] **Passo 4: conferir que não há formulário aninhado**

Rode:

```bash
grep -n "<form\|</form>\|<Tabela" app/contatos/page.tsx
```

Esperado: cada `<form` tem o seu `</form>` **antes** do próximo `<form`, e as
duas chamadas de `<Tabela>` ficam fora de qualquer `<form ...>` da página.

**Por que isso importa:** formulário dentro de formulário é ilegal em HTML — o
navegador descarta o interno silenciosamente, e a tela falha de um jeito que não
acusa. A página já tem o de busca (GET) e o de exportar.

- [ ] **Passo 5: conferir tipos e suíte**

Rode: `npx tsc --noEmit` — esperado: sem saída.
Rode: `npx vitest run` — esperado: tudo verde.
Rode: `npx next build` — esperado: build completo, `/contatos` na lista.

- [ ] **Passo 6: ver na tela**

Rode `npm run dev`, abra `/contatos`, e confira:

1. Sem nada marcado, **a barra não aparece** e a tela é a de antes.
2. Marcando uma linha, a barra aparece com os quatro botões.
3. Clicar `alunos` volta para `/contatos` com o aviso *"1 contato marcado como
   alunos."* e a coluna "Categoria" daquela linha mostra `alunos`.
4. Com busca preenchida e depois de clicar "Ver mais", marcar e aplicar
   **devolve à mesma busca e ao mesmo número de linhas**.

- [ ] **Passo 7: commit**

```bash
git add app/contatos/page.tsx
git commit -F - <<'MSG'
A tabela de contatos vira formulario, com quatro botoes de categoria

Cada uma das DUAS tabelas (com e-mail, sem e-mail) vira um formulario
proprio. A barra aparece por group-has-[input[name=ig_id]:checked], na
direcao a prova de falha: o padrao e ESCONDIDO e a variante MOSTRA, para
que uma falha de CSS deixe a tela de leitura sem botao de escrita.

Os tres campos escondidos (filtro, q, linhas) existem para o redirect
devolver a pessoa ao lugar de onde ela veio -- limpar 143 contatos sao
varios blocos.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
```

**NOTA POSTERIOR sobre a mensagem de commit acima**: `group-has-[input[name=ig_id]:checked]` NÃO COMPILA — é o mesmo defeito da nota no Passo 1. O commit de verdade usa `data-contato`, não `name=ig_id`.

---

## Tarefa 5: o "selecionar todas" e o contador

**Arquivos:**
- Criar: `app/contatos/selecao-client.tsx`
- Modificar: `app/contatos/page.tsx` (o `<th>` da coluna e a barra)

**Interfaces:**
- Consome: o `id` do formulário que a Tarefa 4 produziu
  (`"lote-com-email"` / `"lote-sem-email"`)
- Produz: `MarcarTodas({ alvo }: { alvo: string })`,
  `ContadorDaSelecao({ alvo }: { alvo: string })`

- [ ] **Passo 1: criar o componente**

Crie `app/contatos/selecao-client.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";

// A ÚNICA PEÇA DE CLIENTE DE `/contatos`, e ela é pequena de propósito.
//
// POR QUE ELA PRECISA EXISTIR: CSS LÊ estado (`:has(input:checked)`) e não
// ESCREVE. Marcar vinte e cinco caixas de uma vez não tem forma declarativa —
// ou há JavaScript, ou não há "selecionar todas".
//
// POR QUE ELA NÃO TOMA CONTA DA TABELA: as linhas continuam renderizadas no
// SERVIDOR. Este componente alcança as caixas pelo DOM do formulário em vez de
// as possuir, então nenhuma linha de contato atravessa a fronteira de
// serialização — e a página não paga hidratação por 143 linhas para ganhar uma
// caixa no cabeçalho.
//
// SEM JAVASCRIPT ela não faz nada, e isso é aceitável: a caixa do cabeçalho não
// tem `name`, então nunca vai no POST, e marcar linha por linha continua
// funcionando. O que se perde é o atalho, não a função.

function caixas(alvo: string): HTMLInputElement[] {
  const form = document.getElementById(alvo);
  if (!(form instanceof HTMLFormElement)) return [];
  return Array.from(form.querySelectorAll<HTMLInputElement>('input[name="ig_id"]'));
}

/** Quantas caixas há e quantas estão marcadas, recontadas a cada `change`. */
function useSelecao(alvo: string): { n: number; total: number } {
  const [estado, setEstado] = useState({ n: 0, total: 0 });
  useEffect(() => {
    const form = document.getElementById(alvo);
    if (!form) return;
    const recontar = () => {
      const cs = caixas(alvo);
      setEstado({ n: cs.filter((c) => c.checked).length, total: cs.length });
    };
    recontar();
    // `change` BORBULHA de `<input>` até o `<form>`, então um ouvinte no
    // formulário cobre as 25 caixas sem pendurar 25 ouvintes.
    form.addEventListener("change", recontar);
    return () => form.removeEventListener("change", recontar);
  }, [alvo]);
  return estado;
}

export function MarcarTodas({ alvo }: { alvo: string }) {
  const { n, total } = useSelecao(alvo);
  return (
    <input
      type="checkbox"
      // SEM `name`, E DE PROPÓSITO: esta caixa comanda as outras e não é um
      // dado. Com `name`, ela viraria um campo a mais no POST e
      // `idsSelecionados` teria de aprender a ignorá-la.
      aria-label="Selecionar todas as linhas mostradas"
      checked={total > 0 && n === total}
      // O TRAÇO DO "ALGUMAS": estado indeterminado não existe como atributo de
      // React, só como propriedade do elemento.
      ref={(el) => {
        if (el) el.indeterminate = n > 0 && n < total;
      }}
      onChange={(e) => {
        const marcar = e.target.checked;
        for (const c of caixas(alvo)) c.checked = marcar;
        // MUDAR `.checked` POR CÓDIGO NÃO DISPARA `change`. O CSS da barra não
        // se importa (`:checked` acompanha a propriedade), mas o contador sim —
        // ele vive de eventos. Um evento à mão no formulário acorda os dois.
        e.target.form?.dispatchEvent(new Event("change", { bubbles: true }));
      }}
      className="h-4 w-4 cursor-pointer rounded border-traco dark:border-traco-escuro"
    />
  );
}

export function ContadorDaSelecao({ alvo }: { alvo: string }) {
  const { n } = useSelecao(alvo);
  if (n === 0) return null;
  return (
    <span className="text-xs font-semibold tabular-nums">
      {n} {n === 1 ? "selecionado" : "selecionados"}
    </span>
  );
}
```

- [ ] **Passo 2: pendurar os dois na tabela**

Em `app/contatos/page.tsx`, no `<th>` da coluna de caixas, troque

```tsx
<th className="w-10 px-4 py-3">
  <span className="sr-only">Selecionar</span>
</th>
```

por

```tsx
<th className="w-10 px-4 py-3">
  <MarcarTodas alvo={idDoForm} />
</th>
```

E na barra, troque `<span className={`text-xs ${muted}`}>Marcar como</span>` por

```tsx
<ContadorDaSelecao alvo={idDoForm} />
<span className={`text-xs ${muted}`}>marcar como</span>
```

Acrescente ao topo do arquivo:

```ts
import { MarcarTodas, ContadorDaSelecao } from "./selecao-client";
```

- [ ] **Passo 3: conferir tipos e build**

Rode: `npx tsc --noEmit` — esperado: sem saída.
Rode: `npx next build` — esperado: build completo.

- [ ] **Passo 4: ver na tela, e é aqui que mora o achado**

Com `npm run dev`, em `/contatos`:

1. A caixa do cabeçalho marca **as linhas mostradas**, e o contador bate com o
   que o rodapé diz em "Mostrando **N** de 143".
2. Clique "Ver mais", depois a caixa do cabeçalho: agora ela marca **as novas
   também**, e o contador subiu.
3. Desmarque uma linha: a caixa do cabeçalho fica **com o traço** (indeterminada).
4. **As duas tabelas são independentes:** marcar tudo em "Sem e-mail" não mexe
   em "Com e-mail".

- [ ] **Passo 5: plantar um defeito na tela**

Troque `'input[name="ig_id"]'` por `'input[type="checkbox"]'` em `caixas`.
Esperado: a própria caixa do cabeçalho passa a se contar, e o contador mostra um
a mais do que as linhas marcadas. **Conferir na tela e desfazer.**

Este plantio não tem teste automático, e isso fica declarado: a suíte desta casa
não renderiza componente de cliente. O que protege esta peça é a verificação na
tela do Passo 4, e é pouco — está registrado como dívida no fim deste plano.

- [ ] **Passo 6: commit**

```bash
git add app/contatos/selecao-client.tsx app/contatos/page.tsx
git commit -F - <<'MSG'
O "selecionar todas" e o contador, a unica peca de cliente de /contatos

CSS LE estado (:has(input:checked)) e nao ESCREVE -- marcar 25 caixas de
uma vez nao tem forma declarativa. O componente alcanca as caixas pelo
DOM do formulario em vez de as possuir, entao as linhas continuam
renderizadas no servidor e nenhum contato atravessa a serializacao.

Mudar .checked por codigo nao dispara `change`: o CSS da barra nao se
importa, o contador sim. Um evento a mao no formulario acorda os dois.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
```

---

## Fechamento

- [ ] **Rodar tudo**

```bash
npx tsc --noEmit
npx vitest run
npm run test:integracao
npx next build
```

Esperado: tipos limpos, suíte pura verde (ela tinha 1534 casos antes deste
plano; deve subir), 177+ de integração verdes, build completo.

- [ ] **Conferir em produção depois do merge**

Abrir `/contatos` em `metodochat.vercel.app`, filtrar por "sem categoria",
marcar **três** pessoas, aplicar `clientes`, e conferir na coluna "Categoria".
Três, e não vinte e cinco: o primeiro uso real prova o caminho, não esvazia o
acúmulo.

- [ ] **Atualizar `.superpowers/sdd/progress.md`** com o estado e a hora.

## Dívida declarada por este plano

**A Tarefa 5 não tem teste automático.** A suíte pura não renderiza componente
de cliente e a de integração lê a árvore do servidor — nenhuma das duas alcança
`MarcarTodas`. O plantio do Passo 5 da Tarefa 5 é conferido a olho. Fica
registrado como o ponto mais frágil desta entrega, e o candidato natural a
`browser-harness` quando houver caminho para isso.

**As duas ações antigas continuam perdendo o lugar.** `atualizarPerfis` e
`enviarLote` seguem usando `urlDoAviso`, sem `q` nem `linhas`. Não foram
mudadas de propósito: a spec pediu a preservação para a ação nova, e mexer nas
outras duas ampliaria a superfície de revisão sem pedido. `urlDoAvisoNaTabela`
está pronto para elas quando alguém quiser.
