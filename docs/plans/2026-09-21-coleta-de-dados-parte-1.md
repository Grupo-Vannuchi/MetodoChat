# Coleta de dados nas automações, Parte 1 — plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: `superpowers:subagent-driven-development`.

**Objetivo:** a automação passa a pedir e guardar qualquer campo — e-mail,
telefone, nome informado, nascimento e campos livres criados pelo marketing — em
vez de só e-mail.

**Arquitetura:** um catálogo puro (`lib/campos.ts`) é o dono de tudo que decide
sobre campo: como extrair o valor da frase, como repergunta, qual variável
gera. O passo `pedir_email` vira `pedir_dado` com uma propriedade `campo`. O dado
coletado mora num `jsonb` em `contacts`, no mesmo formato para campo fixo e
livre, com o instante da coleta junto.

**Spec:** `docs/specs/2026-09-21-coleta-de-dados-nas-automacoes.md` — leia as
seções "Decisões tomadas" e "Declarado" antes de começar.

**Tech:** TypeScript, Next.js 16 (App Router), Postgres via postgres.js, vitest
em três configurações (pura, integração, DOM).

## Restrições globais

- **Comentário em português explicando POR QUÊ**, não o quê, com `arquivo:linha`
  quando a decisão depender de outro arquivo.
- **TDD de verdade**: escreva o caso, rode e VEJA FALHAR, implemente, veja passar.
- **PLANTE DEFEITO** em todo portão. Um caso que não sabe ficar vermelho não
  conta. Esta base perdeu 19 miniaturas exatamente assim.
- **Toda consulta leva `account_id`.**
- **O teto de tentativas é 3**, constante do catálogo, e NÃO vira campo do editor.
- **A recência é 30 dias**, e `campoEstaFresco` recebe `agora` como parâmetro com
  `Date.now()` por omissão — em 21/09/2026 dois testes desta base ficaram
  vermelhos sozinhos por cravarem data.
- **`contacts.email` CONTINUA sendo escrita e lida nesta Parte 1.** A remoção é
  da Parte 2. Quem escreve os dois lugares é UMA função.
- **`contacts.name` e `{{first_name}}` não são tocados.**
- Antes de cada commit: `npx tsc --noEmit` e `npm run verify`.

## Estrutura de arquivos

| arquivo | responsabilidade |
|---|---|
| `lib/campos.ts` (criar) | O catálogo e as funções puras. Único dono da regra de campo. |
| `tests/campos.test.ts` (criar) | Os extratores, a normalização de chave, a recência. |
| `migrations/0NN-campos-do-contato.sql` (criar) | `contacts.campos` e `contacts.campo_tentativas`. |
| `lib/steps.ts` (modificar) | O tipo `pedir_dado` no lugar de `pedir_email`; `conferirLista`; o agrupamento de portão. |
| `lib/engine.ts` (modificar) | O ramo único: fresco → pula; senão pergunta; resposta → extrai, repergunta, ou grava. |
| `lib/variables.ts` (modificar) | As variáveis novas, a partir do registro de campos. |
| `lib/queue-drain.ts` (modificar) | Passa o registro de campos para o `VariableContext`. |
| `app/automacoes/editor/modelos.ts` (modificar) | Os cinco itens da paleta sobre um mecanismo. |
| `app/automacoes/editor/painel.tsx` (modificar) | O cartão do passo, com a chave livre normalizada à vista. |
| `testes-integracao/coleta-de-dados.integracao.ts` (criar) | A conversa inteira contra o banco. |
| `testes-dom/campo-livre.dom.tsx` (criar) | A normalização da chave aparecendo ao digitar. |

---

## Tarefa 1: o catálogo e os extratores

**Arquivos:** criar `lib/campos.ts` e `tests/campos.test.ts`.

**Produz:** `CAMPOS: Campo[]`, `campoPorChave(chave)`, `TETO_DE_TENTATIVAS = 3`,
`extrairTelefone`, `extrairNome`, `extrairNascimento` (exportados para teste).

Esta tarefa não toca em nada que já existe. Ela é pura, e o resto do plano
depende dela.

- [ ] **Passo 1: os casos que falham**

Crie `tests/campos.test.ts`. Comece pelo telefone, que é o que tem borda de
verdade:

```ts
import { describe, expect, it } from "vitest";
import { campoPorChave } from "@/lib/campos";

const telefone = (t: string) => campoPorChave("telefone")!.extrair(t);

describe("extrair telefone", () => {
  it("acha o número dentro da frase, que é como as pessoas respondem", () => {
    expect(telefone("meu zap é (11) 99999-9999")).toBe("11999999999");
    expect(telefone("11999999999")).toBe("11999999999");
    expect(telefone("+55 11 99999 9999")).toBe("11999999999");
    expect(telefone("fixo: 1133334444")).toBe("1133334444");
    expect(telefone("11.99999-9999")).toBe("11999999999");
    expect(telefone("tel (011) 3333-4444")).toBe("1133334444");
  });

  it("recusa o que não tem 10 ou 11 dígitos — e isso descarta ano e CPF", () => {
    // A REGRA É POR QUANTIDADE DE DÍGITOS, e não por lista de exceções: "1990"
    // não é telefone porque tem 4 dígitos, e um CPF não é porque tem 11 mas
    // vem sem DDD válido. Lista de exceções sempre esquece um caso.
    expect(telefone("nasci em 1990")).toBe(null);
    expect(telefone("123")).toBe(null);
    expect(telefone("111.222.333-44")).toBe(null);
    expect(telefone("meu cpf e 11122233344")).toBe(null);  // 11 dígitos, 3º não é 9
    expect(telefone("não tenho")).toBe(null);
  });

  it("guarda só os dígitos, sem DDI — é o que dá para exportar e discar", () => {
    expect(telefone("+5511999999999")).toBe("11999999999");
  });
});
```

Agora o nome, com a recusa FRACA de propósito:

```ts
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
```

E o nascimento:

```ts
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
```

- [ ] **Passo 2: rodar e ver falhar**

`npx vitest run tests/campos.test.ts` — FALHA: `lib/campos.ts` não existe.

- [ ] **Passo 3: implementar o catálogo**

Crie `lib/campos.ts`. O cabeçalho explica por que o arquivo existe e por que é
puro — siga a forma de `lib/conexao.ts` e `lib/imagem-quebrada.ts`.

```ts
export const TETO_DE_TENTATIVAS = 3;

export type Campo = {
  chave: string;
  rotulo: string;
  perguntaPadrao: string;
  reperguntar: string;
  extrair(texto: string): string | null;
  variavel: string;
  exemplo: string;
};
```

O telefone, com a regra por quantidade de dígitos:

**ESTE CÓDIGO JÁ ESTEVE ERRADO NESTE PLANO, e a correção vale ser lida.** A
primeira versão contava os dígitos do TEXTO INTEIRO e devolvia o número quando
somavam 10 ou 11 — então `111.222.333-44` (um CPF) somava 11 e passava, apesar
de o comentário afirmar que seria recusado "por vir sem DDD válido", coisa que o
código nem olhava. Comentário e código mentiam juntos.

Contar dígitos NÃO distingue CPF de celular: os dois têm 11. O que distingue é o
plano de numeração — **todo celular brasileiro de 11 dígitos tem `9` como
TERCEIRO dígito** (DDD + 9XXXXXXXX), desde 2016. Isso é regra, e não lista de
valores proibidos.

Para 10 dígitos (fixo) **não invente regra parecida**: a faixa de fixo varia por
região, e uma regra aqui recusaria número de verdade.

```ts
function extrairTelefone(texto: string): string | null {
  const digitos = (texto.match(/\d/g) ?? []).join("");
  // O DDI 55 só sai quando sobra dígito demais para ser DDD+número: sem essa
  // condição, um fixo de 10 dígitos começando com "55" perderia dois à toa.
  let n = digitos.startsWith("55") && digitos.length > 11 ? digitos.slice(2) : digitos;
  // O zero do DDD é prefixo de discagem antigo, não é dado: "(011)" guardado
  // como `011…` não disca nem exporta igual aos outros.
  if (n.length === 12 && n.startsWith("0")) n = n.slice(1);
  if (n.length === 11) return n[2] === "9" ? n : null;   // celular, ou CPF
  if (n.length === 10) return n;                          // fixo
  return null;
}
```

**Confira você mesmo os quatro casos abaixo antes de dar por pronto** — eles são
os que já quebraram:

```
"11.99999-9999"         -> "11999999999"   (ponto é separador comum aqui)
"tel (011) 3333-4444"   -> "1133334444"    (o zero do DDD sai)
"meu cpf e 11122233344" -> null            (terceiro dígito não é 9)
"nasci em 1990"         -> null            (4 dígitos)
```

O nome, com a recusa fraca:

```ts
const PREFIXO_DE_NOME = /^\s*(?:meu\s+nome\s+(?:é|eh|e)\s+|me\s+chamo\s+|sou\s+o\s+|sou\s+a\s+)/i;
const TEM_LETRA_OU_DIGITO = /[\p{L}\p{N}]/u;

function extrairNome(texto: string): string | null {
  const limpo = texto.replace(PREFIXO_DE_NOME, "").trim();
  if (!limpo) return null;
  if (!TEM_LETRA_OU_DIGITO.test(limpo)) return null;  // só emoji/pontuação
  if (limpo.length > 60) return null;                  // isto é frase, não nome
  return limpo;
}
```

**O prefixo é removido SEMPRE**, inclusive em "sou a ana" → `ana`. Quem
responde "sou a ana" está dizendo que o nome é Ana, e guardar a frase inteira
faria `{{nome_informado}}` mandar "Oi sou a ana". A recusa fraca da spec é sobre
o que se ACEITA (emoji junto, sem maiúscula), não sobre deixar o prefixo.

O nascimento, com a conferência de volta:

```ts
function extrairNascimento(texto: string): string | null {
  const br = texto.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  const iso = texto.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  let a: number, m: number, d: number;
  if (iso) { [, a, m, d] = iso.map(Number) as [unknown, number, number, number]; }
  else if (br) { [, d, m, a] = br.map(Number) as [unknown, number, number, number]; }
  else return null;

  // `new Date("2026-02-30")` NÃO lança — ele rola para 2 de março. A volta é o
  // que separa data impossível de data válida.
  const data = new Date(Date.UTC(a, m - 1, d));
  if (data.getUTCFullYear() !== a || data.getUTCMonth() !== m - 1 || data.getUTCDate() !== d) {
    return null;
  }
  if (data.getTime() > Date.now()) return null;  // nascer no futuro, não
  return `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
```

E o catálogo, com o e-mail reusando `extractEmail` de `lib/match.ts` — **não
reescreva a regex**, importe:

```ts
import { extractEmail } from "./match";

export const CAMPOS: Campo[] = [
  {
    chave: "email",
    rotulo: "E-mail",
    perguntaPadrao: "Me manda seu melhor e-mail que eu te envio o link 👇",
    reperguntar: "Acho que esse e-mail saiu errado 🤔 Me manda de novo, só o e-mail.",
    extrair: extractEmail,
    variavel: "email",
    exemplo: "ana@email.com",
  },
  {
    chave: "telefone",
    rotulo: "Telefone / WhatsApp",
    perguntaPadrao: "Me manda seu WhatsApp com DDD 👇",
    reperguntar: "Não consegui ler esse número 🤔 Me manda com DDD, só os números.",
    extrair: extrairTelefone,
    variavel: "telefone",
    exemplo: "(11) 99999-9999",
  },
  {
    chave: "nome_informado",
    rotulo: "Nome informado",
    perguntaPadrao: "Como você prefere que eu te chame?",
    reperguntar: "Não entendi 🤔 Me manda só o nome.",
    extrair: extrairNome,
    variavel: "nome_informado",
    exemplo: "Ana",
  },
  {
    chave: "nascimento",
    rotulo: "Data de nascimento",
    perguntaPadrao: "Qual sua data de nascimento? (dia/mês/ano)",
    reperguntar: "Essa data não deu certo 🤔 Me manda como 01/02/1990.",
    extrair: extrairNascimento,
    variavel: "nascimento",
    exemplo: "01/02/1990",
  },
];

const POR_CHAVE = new Map(CAMPOS.map((c) => [c.chave, c]));
export function campoPorChave(chave: string): Campo | undefined {
  return POR_CHAVE.get(chave);
}
```

- [ ] **Passo 4: rodar, plantar, commitar**

Rode: PASSA.
**Plante:** troque `semDdi.length === 10 || semDdi.length === 11` por
`semDdi.length >= 4` → o caso do ano fica vermelho.
**Plante:** tire a conferência de volta do nascimento → `30/02` fica vermelho.
`npx tsc --noEmit`, `npm run verify`, commite.

---

## Tarefa 2: a coluna, e as três funções que a leem

**Arquivos:** criar `migrations/0NN-campos-do-contato.sql`; modificar
`lib/campos.ts`; acrescentar casos em `tests/campos.test.ts`.

**Consome:** o catálogo da Tarefa 1.
**Produz:** `lerCampos(jsonb): Registro`, `normalizarChaveLivre(texto): string`,
`campoEstaFresco(em: string | null, agora?: number): boolean`,
`RECENCIA_EM_DIAS = 30`, e

```ts
export type CampoColetado = { valor: string; em: string; automacao?: string | null };
export type Registro = Map<string, CampoColetado>;
```

`automacao` é opcional porque os 9 e-mails migrados da Tarefa 7 não têm essa
informação — não há data nem origem de coleta guardada hoje. Quem lê precisa
aguentar a ausência.

- [ ] **Passo 1: os casos que falham**

```ts
import { campoEstaFresco, lerCampos, normalizarChaveLivre, RECENCIA_EM_DIAS } from "@/lib/campos";

describe("campoEstaFresco", () => {
  // O INSTANTE É PARÂMETRO, e isto não é preferência: em 21/09/2026 dois casos
  // desta base ficaram vermelhos sozinhos por cravarem uma data que passou, num
  // bloco cujo comentário JÁ PREVIA que isso aconteceria. Prever não é
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

  it("recusa o vazio e o que não tem letra", () => {
    expect(normalizarChaveLivre("   ")).toBe(null);
    expect(normalizarChaveLivre("🔥")).toBe(null);
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
});
```

- [ ] **Passo 2: rodar e ver falhar**

- [ ] **Passo 3: a migração e as funções**

A migração — veja `migrations/009-fila-estado-guardado.sql` para a forma que
esta base usa, e numere na sequência:

```sql
alter table contacts add column if not exists campos jsonb not null default '{}'::jsonb;
alter table contacts add column if not exists campo_tentativas int not null default 0;
```

O cabeçalho do arquivo diz POR QUE é `jsonb` e não coluna por campo: a decisão
foi revista durante o desenho, e a spec tem o motivo — a recência exige guardar
o *quando*, e isso faria cada campo custar duas colunas.

As três funções vão em `lib/campos.ts`, cada uma com o comentário do porquê.
`campoEstaFresco` compara em milissegundos e trata `null`/data ilegível como
"não fresco" — o desfecho seguro é perguntar de novo, não pular.

- [ ] **Passo 4: rodar, plantar, commitar**

**Plante:** `RECENCIA_EM_DIAS = 3650` → o caso dos 31 dias fica vermelho.
**Plante:** tire a recusa de colisão de `normalizarChaveLivre` → o caso do
`E-mail` fica vermelho.

---

## Tarefa 3: `pedir_email` vira `pedir_dado` — e NADA muda de comportamento

**Arquivos:** `lib/steps.ts`, `lib/engine.ts`, `app/automacoes/editor/*`,
`app/icons.tsx`, e os testes que citam o tipo.

Esta tarefa é **renomeação com propriedade nova**, e o critério de sucesso é: a
suíte inteira verde **sem mudar nenhum caso de comportamento**. Se um caso
precisou mudar de expectativa, algo saiu do lugar — pare e relate.

**MEDIDO EM 21/09/2026: `pedir_email` aparece 97 vezes em 14 arquivos**, sendo 28
em `lib/steps.ts` e ~40 em testes.

- [ ] **Passo 1: o tipo**

`lib/steps.ts:51` — trocar:

```ts
| { tipo: "pedir_email"; texto: string }
```

por:

```ts
// `campo` é a chave do catálogo (lib/campos.ts). `chave` só existe quando
// `campo === "livre"`, e é ela que vira `{{<chave>}}` e coluna do CSV.
| { tipo: "pedir_dado"; campo: string; texto: string; chave?: string }
```

- [ ] **Passo 2: os dois agrupamentos de portão**

`lib/steps.ts:241` e `:2676` agrupam `pedir_follow` com `pedir_email`. Os dois
passam a citar `pedir_dado`. **O comportamento é o mesmo**: o passo estaciona o
cursor e retoma de si mesmo.

- [ ] **Passo 3: a validação em `conferirLista`**

`lib/steps.ts:1028` recusa `pedir_email` sem texto. Passa a recusar `pedir_dado`
sem texto, E a recusar `campo: "livre"` sem `chave` válida — a mensagem para o
dono precisa dizer o que fazer, na forma que o arquivo já usa
(`paraODono: "Este pedido de dado está sem texto."`).

- [ ] **Passo 4: OS COMENTÁRIOS, UM A UM — e este passo é o trabalho todo**

**NÃO USE `sed`.** Dos 97 lugares, uns falam da CATEGORIA de passo (o que
estaciona o cursor, o que é portão, o que retoma de si mesmo) e outros falam do
CASO E-MAIL ESPECIFICAMENTE (o ramo que consulta `contacts.email`, o exemplo de
"o último bloco era `pedir_email`"). Trocar os dois pelo mesmo nome faz metade
virar mentira.

Para cada ocorrência, decida:

- fala da categoria → vira `pedir_dado`;
- fala do e-mail como exemplo → ou fica como exemplo (`pedir_dado` com campo
  `email`), ou some se o exemplo deixou de fazer sentido;
- **se você não conseguir decidir, PARE e pergunte.** Um comentário errado nesta
  base custa mais que um defeito: ele é lido como verdade por quem vier depois.

- [ ] **Passo 5: rodar tudo, e conferir que NENHUM caso mudou de expectativa**

`npm run verify`. Se um caso precisou de expectativa nova, relate antes de
commitar.

---

## Tarefa 4: o motor — fresco, pergunta, repergunta, grava

**Arquivos:** `lib/engine.ts`; criar
`testes-integracao/coleta-de-dados.integracao.ts`.

**Consome:** `campoPorChave`, `campoEstaFresco`, `lerCampos`,
`TETO_DE_TENTATIVAS`.

O padrão de teste está em `testes-integracao/gatilho-entrega.integracao.ts` —
leia o cabeçalho: servidor HTTP local com `IG_GRAPH_BASE`, `semear`, `mensagem`,
`drainQueue`. **Não invente maquinaria nova.**

- [ ] **Passo 1: os casos que falham**

```ts
test("pergunta, recusa o que não serve, e grava quando serve", async () => {
  await semearComPedido("telefone", "Me manda seu WhatsApp 👇");
  const EU = "9300000000000101";
  await mensagem(EU, "quero", "m-1");
  await dreno.drainQueue();
  expect(textosNoFio(EU)).toEqual(["Me manda seu WhatsApp 👇"]);

  // Resposta que não serve: repergunta com o texto DO CAMPO.
  await mensagem(EU, "não tenho", "m-2");
  await dreno.drainQueue();
  expect(textosNoFio(EU)[1]).toContain("WhatsApp");
  expect(await campoDoContato(EU, "telefone")).toBeNull();

  // Resposta boa: grava só os dígitos e SEGUE.
  await mensagem(EU, "meu zap é (11) 99999-9999", "m-3");
  await dreno.drainQueue();
  expect(await campoDoContato(EU, "telefone")).toBe("11999999999");
});

test("esgotado o teto, o fluxo SEGUE sem o dado", async () => {
  // O DEFEITO QUE ISTO CONSERTA: hoje o pedido de e-mail repete PARA SEMPRE,
  // a cada mensagem recebida, e quem nunca mandar e-mail fica preso no passo.
  // O `pedir_follow`, ao lado, tem teto de cinco desde sempre.
  await semearComPedido("telefone", "Me manda seu WhatsApp 👇", "depois do pedido");
  const EU = "9300000000000102";
  await mensagem(EU, "quero", "m-1");
  await dreno.drainQueue();
  for (let i = 0; i < TETO_DE_TENTATIVAS; i++) {
    await mensagem(EU, "não tenho", `m-r${i}`);
    await dreno.drainQueue();
  }
  expect(textosNoFio(EU)).toContain("depois do pedido");
  expect(await campoDoContato(EU, "telefone")).toBeNull();
});

test("campo fresco PULA o passo; campo vencido pergunta de novo", async () => {
  const EU = "9300000000000103";
  await semearCampo(EU, "telefone", "11999999999", diasAtras(5));
  await semearComPedido("telefone", "Me manda seu WhatsApp 👇", "depois do pedido");
  await mensagem(EU, "quero", "m-1");
  await dreno.drainQueue();
  // Pulou: o pedido NÃO saiu, e o que vem depois saiu.
  expect(textosNoFio(EU)).toEqual(["depois do pedido"]);

  const OUTRO = "9300000000000104";
  await semearCampo(OUTRO, "telefone", "11999999999", diasAtras(31));
  await mensagem(OUTRO, "quero", "m-2");
  await dreno.drainQueue();
  expect(textosNoFio(OUTRO)).toEqual(["Me manda seu WhatsApp 👇"]);
});
```

- [ ] **Passo 2: rodar e ver falhar**

`npx vitest run --config vitest.integracao.config.ts testes-integracao/coleta-de-dados.integracao.ts`
(o container precisa estar de pé: `npm run banco:teste`).

- [ ] **Passo 3: implementar**

Dois lugares em `lib/engine.ts`:

**No envio do passo** (hoje o ramo `if (p.tipo === "pedir_email")`, perto da
linha 872): a consulta deixa de ser `select email` e passa a ler `campos`; a
decisão de pular passa a ser `campoEstaFresco(registro.get(p.campo)?.em ?? null)`.
A função pura que devolve para onde o fluxo retoma **é a mesma**
(`retomadaDoEmailConhecido`), e ela ganha nome novo (`retomadaDoCampoConhecido`)
no mesmo commit.

**Na captura da resposta** (hoje perto da linha 2062): troca `extractEmail` por
`campoPorChave(passo.campo)!.extrair`, e o `update contacts set email = $3` por
uma função nova — **e é ela que escreve os DOIS lugares**:

```ts
// ESCREVE NOS DOIS LUGARES DE PROPÓSITO, e é a única função que faz isso.
// A coluna `contacts.email` só sai na Parte 2 (ver a spec), e até lá os SEIS
// leitores de hoje continuam lendo dela. Ter um escritor só é o que impede as
// duas fontes de divergirem enquanto a janela está aberta.
async function gravarCampo(
  accountId: string,
  igId: string,
  chave: string,
  valor: string,
  automacaoId: string | null
): Promise<void> {
  await sql().query(
    `update contacts
        set campos = campos || jsonb_build_object($3::text, jsonb_build_object(
              'valor', $4::text,
              'em', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
              'automacao', $5::text)),
            campo_tentativas = 0,
            -- A COLUNA CONTINUA ESCRITA ENQUANTO A JANELA ESTIVER ABERTA. Ela
            -- só sai na Parte 2, e até lá os SEIS leitores de hoje leem dela.
            email = case when $3 = 'email' then $4 else email end
      where account_id = $1 and ig_id = $2`,
    [accountId, igId, chave, valor, automacaoId]
  );
}
```

O `campos || jsonb_build_object(...)` **mescla**, e não substitui: gravar o
telefone não pode apagar o e-mail que já estava lá. Trocar por `set campos =
jsonb_build_object(...)` é o plantio óbvio desta função, e ele precisa de caso.

E `now()` vem do BANCO, não do Node: misturar dois relógios na mesma conta é o
defeito que `enqueue` (lib/engine.ts) registra ter custado 53,9 segundos de
atraso nesta máquina.

Na captura também: incrementar `campo_tentativas` quando `extrair` devolver
`null`, zerar quando gravar ou quando o teto estourar, e no estouro seguir o
fluxo pela mesma retomada do campo conhecido.

- [ ] **Passo 4: rodar, plantar, commitar**

**Plante:** `TETO_DE_TENTATIVAS = 999` → o caso do teto fica vermelho.
**Plante:** faça `campoEstaFresco` devolver sempre `true` → o caso do vencido
fica vermelho.
**Plante:** tire a escrita na coluna `email` de `gravarCampo` → escreva um caso
que leia a coluna e prenda isso, porque a Parte 2 depende dela estar certa.
**Plante:** troque `campos || jsonb_build_object(...)` por `campos =
jsonb_build_object(...)` → escreva o caso que coleta DOIS campos seguidos e
confere que o primeiro sobreviveu. Sem ele, gravar o telefone apagaria o e-mail
e nada acusaria.

---

## Tarefa 5: o editor

**Arquivos:** `app/automacoes/editor/modelos.ts`,
`app/automacoes/editor/painel.tsx`; criar `testes-dom/campo-livre.dom.tsx`.

- [ ] **Passo 0: a regra do "só um por lista" muda de chave — ANTES da paleta**

`SO_UM_POR_LISTA` (lib/steps.ts, perto da :3245) é indexada por TIPO. Enquanto
só existia `pedir_email`, "um por tipo" e "um por campo" eram a mesma regra. Com
os cinco itens, deixam de ser: "Pedir e-mail" + "Pedir telefone" na mesma
automação viram `nivel: "erro"`, `quando: "salvar"`, com a frase "Só pode haver
um pedido de e-mail" — o dono não consegue salvar algo legítimo, e a mensagem
nem descreve o que ele fez.

São DOIS lugares, e o segundo fica 415 linhas abaixo: a tabela, e o `jaVistos`
em `lib/steps.ts:3660-3664`, que guarda `passo.tipo` e passa a guardar o campo.

O motivo original tem de sobreviver na mensagem nova: o segundo pedido do MESMO
campo nunca é entregue — quando o dado já foi respondido o motor pula o bloco, e
quando não foi ele sai com a mesma chave de envio do primeiro.

Caso: dois campos DIFERENTES na mesma lista passam; dois do MESMO são recusados.

- [ ] **Passo 1: a paleta**

`modelos.ts` — o item `pedir_email` vira **cinco**, todos criando o mesmo
`pedir_dado`:

```ts
{ chave: "pedir_email",  rotulo: "Pedir e-mail",     descricao: "espera o endereço (não é portão)", gatilhos: null },
{ chave: "pedir_telefone", rotulo: "Pedir telefone", descricao: "espera o WhatsApp com DDD",        gatilhos: null },
{ chave: "pedir_nome",   rotulo: "Pedir nome",       descricao: "espera o nome que a pessoa usa",   gatilhos: null },
{ chave: "pedir_nascimento", rotulo: "Pedir nascimento", descricao: "espera a data de nascimento",  gatilhos: null },
{ chave: "pedir_outro",  rotulo: "Pedir outro dado", descricao: "você escolhe a pergunta",          gatilhos: null },
```

E `novoPasso` devolve, para cada uma, um `pedir_dado` com o `campo` e o
`perguntaPadrao` vindos do catálogo — **não copie os textos para cá**, leia de
`lib/campos.ts`. Cinco atalhos, um mecanismo.

**Por que cinco itens e não um genérico:** "Pedir telefone" se acha na paleta;
"Pedir um dado, agora escolha qual" não se acha.

- [ ] **Passo 2: o caso de DOM que falha**

**Primeiro descubra o componente.** O cartão do passo vive em
`app/automacoes/editor/painel.tsx`; abra o arquivo e veja qual componente
desenha o corpo de um passo e quais props ele recebe — o plano não inventa um
nome que talvez não exista. Se ele não for exportado, exporte-o (só isso) no
mesmo commit, com o comentário dizendo que a exportação existe para o teste de
DOM alcançar o cartão sem montar o editor inteiro.

```ts
it("a chave livre aparece normalizada enquanto se digita", async () => {
  render(<CartaoDoPasso passo={{ id: "b_1", tipo: "pedir_dado", campo: "livre", texto: "?", chave: "" }} />);
  await userEvent.type(screen.getByLabelText(/nome do campo/i), "Qual sua Cidade");
  expect(screen.getByText(/vai virar/)).toHaveTextContent("{{qual_sua_cidade}}");
});

it("chave que colide com campo conhecido é recusada, com o caminho", async () => {
  render(<CartaoDoPasso passo={{ id: "b_1", tipo: "pedir_dado", campo: "livre", texto: "?", chave: "" }} />);
  await userEvent.type(screen.getByLabelText(/nome do campo/i), "e-mail");
  expect(screen.getByText(/já é um campo do sistema/i)).toBeTruthy();
});
```

- [ ] **Passo 3: implementar o cartão**

No `painel.tsx`, o cartão do `pedir_dado` mostra a pergunta (sempre) e, **só
quando `campo === "livre"`**, o nome do campo com o resultado normalizado
embaixo. A normalização vem de `normalizarChaveLivre` — **não reescreva**.

- [ ] **Passo 4: rodar, plantar, commitar**

**Plante:** faça o cartão mostrar a chave crua em vez da normalizada → o caso
fica vermelho.

---

## Tarefa 6: as variáveis

**Arquivos:** `lib/variables.ts`, `lib/queue-drain.ts`; casos em
`tests/` (o arquivo de variáveis que já existir).

- [ ] **Passo 1: os casos que falham**

```ts
it("as variáveis novas resolvem do registro de campos", () => {
  const ctx = { username: "ana", name: "Ana", campos: new Map([
    ["telefone", { valor: "11999999999", em: "2026-09-21T00:00:00Z" }],
    ["cidade",   { valor: "Osasco",      em: "2026-09-21T00:00:00Z" }],
  ])};
  expect(renderVariables("zap {{telefone}} de {{cidade}}", ctx)).toBe("zap 11999999999 de Osasco");
});

it("{{first_name}} continua vindo do Instagram, e NÃO do nome informado", () => {
  // Decisão do dono, na spec: quem quiser o nome digitado escreve
  // {{nome_informado}}. Trocar isto faz uma resposta "kkkk" virar o nome em
  // toda mensagem futura.
  const ctx = { username: "ana", name: "Ana Souza", campos: new Map([
    ["nome_informado", { valor: "Aninha", em: "2026-09-21T00:00:00Z" }],
  ])};
  expect(renderVariables("Oi {{first_name}}", ctx)).toBe("Oi Ana");
  expect(renderVariables("Oi {{nome_informado}}", ctx)).toBe("Oi Aninha");
});
```

- [ ] **Passo 2: rodar e ver falhar**

- [ ] **Passo 3: implementar**

`VariableContext` ganha `campos?: Registro`. As variáveis dos campos fixos
entram em `VARIABLES` **a partir do catálogo** — não escreva quatro itens à mão,
gere-os de `CAMPOS`, senão o catálogo deixa de ser o dono. A variável de campo
livre é resolvida por chave, fora da lista fixa.

`queue-drain.ts:603` passa a trazer `campos` junto de `username, name, email`.

- [ ] **Passo 4: rodar, plantar, commitar**

**Plante:** faça `{{first_name}}` preferir `nome_informado` → o segundo caso
fica vermelho. É a decisão do dono, e ela precisa de portão.

---

## Tarefa 7: a migração do que já existe

**Arquivos:** `migrations/0NN+1-migrar-email-para-campos.sql`.

**MEDIDO EM PRODUÇÃO em 21/09/2026:** 4 automações usam `pedir_email` (4 passos,
todas ativas) e 9 de 163 contatos têm e-mail.

- [ ] **Passo 1: os dados**

```sql
-- O `em` vira `first_contact_at` porque é o que se sabe: não há data de coleta
-- guardada hoje. `automacao` fica nulo pelo mesmo motivo. Chutar uma data
-- recente faria a regra de recência PULAR o pedido para quem talvez precise
-- atualizar.
update contacts
   set campos = jsonb_build_object('email', jsonb_build_object(
         'valor', email, 'em', to_char(first_contact_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')))
 where email is not null and not (campos ? 'email');
```

- [ ] **Passo 2: os passos das automações**

```sql
update automations
   set steps = (
     select jsonb_agg(
       case when p->>'tipo' = 'pedir_email'
            then (p - 'tipo') || jsonb_build_object('tipo','pedir_dado','campo','email')
            else p end
       order by ord)
     from jsonb_array_elements(steps) with ordinality as t(p, ord))
 where steps::text like '%pedir_email%';
```

**O `order by ord` não é enfeite:** sem ele, `jsonb_agg` pode devolver os passos
fora de ordem, e a ordem do array É o fluxo da automação.

- [ ] **Passo 3: conferir contra o banco de teste, depois medir em produção**

`npm run banco:teste` e a suíte de integração. Depois do deploy, contar em
produção: 0 passos `pedir_email` restantes, 9 contatos com `campos->'email'`.

---

## Fechamento

- [ ] `npm run verify` (inclui lint, tipos, puros, DOM, varredura e build)
- [ ] Integração no container **e** a rodada sem `DATABASE_URL_TESTES`
- [ ] `npm run conferir:navegador -- --porta=9333` — nada deve mudar; é a rede
      contra regressão nas telas que esta entrega encosta
- [ ] Medir em produção depois do deploy: os 4 passos migrados e os 9 e-mails
- [ ] Atualizar `.superpowers/sdd/progress.md`

## Declarado

**A coluna `contacts.email` continua viva e escrita.** A Parte 1 escreve nos dois
lugares por uma função só; a remoção é da Parte 2. Enquanto a janela está
aberta, `gravarCampo` é o único escritor — e é isso que um portão de texto deve
prender.

**Campo livre não tem validação**, e quem criar "qual sua cidade?" vai receber
"kkkk" de alguém. Está na spec, é escolha, e não é defeito a abrir depois.

**Esta parte não mexe no CSV nem na tela de contatos.** Elas continuam lendo
`contacts.email` e continuam certas. Campo livre coletado nesta parte só aparece
em mensagem (`{{cidade}}`) até a Parte 2 chegar.
