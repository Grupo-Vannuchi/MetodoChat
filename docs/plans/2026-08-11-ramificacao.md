# Ramificação por botões — plano de implementação (Fase 2a)

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA — use
> `superpowers:subagent-driven-development`, tarefa a tarefa. Os passos usam
> caixinha (`- [ ]`).

**Objetivo:** o fluxo de uma automação deixa de ser uma fila e vira um mapa de
caminhos, e uma mensagem passa a poder ter vários botões, cada um levando a um
lugar diferente.

**Arquitetura:** `steps` continua sendo a lista de blocos; nasce a coluna
`ligacoes`, e a ordem do array deixa de significar qualquer coisa. Toda decisão
— a caminhada pelo grafo, a escolha da ligação, a detecção de ciclo, as duas
conferências — vai para `lib/steps.ts`, que é puro e testado; `lib/engine.ts`
fica só com o efeito.

**Tecnologia:** Next.js 16.2.10, React 19.2.4, `@xyflow/react` 12.11.2, Tailwind,
Vitest, postgres.js.

**Spec:** `docs/specs/2026-08-11-ramificacao.md`
**Base:** branch `ramificacao`, commit `63eea5a`.

## Restrições globais

- **`lib/steps.ts` não tem NENHUM import.** Confira com
  `grep -c "^import\|require(" lib/steps.ts` — tem que dar 0.
- **A suíte só testa função pura.** Sem banco, sem mock, sem teste de componente.
- **Este Next.js não é o que você conhece.** Leia o guia em
  `node_modules/next/dist/docs/` antes de escrever código específico de Next.
- **Três formatos de payload convivem PARA SEMPRE:** `AUTO:<automação>`,
  `AUTO:<automação>:<bloco>` e `AUTO:<automação>:<bloco>:<botão>`. Um botão
  entregue vive na conversa da pessoa indefinidamente. **Não é dívida a limpar.**
- **A marca do React Flow fica.** Não mexa em `proOptions`.
- Comentários em português; commit em português sem acentos, sem menção a agente
  ou ferramenta.
- Nada de `ADMIN_PASSWORD`, nada de cookie de sessão.
- **A ENTRADA DO FLUXO É `steps[0]`.** Com as ligações, a ordem do array deixa de
  significar o próximo — mas guarda **exatamente um** significado: o primeiro
  elemento é onde a caminhada começa quando o gatilho dispara. É o que já vale
  hoje, então nenhuma automação migrada muda de entrada, e não exige dado novo.
  A alternativa — "o bloco que ninguém aponta" — **não serve**: um menu que volta
  para si mesmo tem seta chegando na entrada, e o fluxo ficaria sem começo.
- **Se houver um `npm run dev` na porta 3000, use-o e NÃO o encerre** — matá-lo à
  força já deixou conexão órfã segurando trava em `contacts` e travou o painel
  inteiro. Pelo mesmo motivo, **pergunte antes de rodar `next build`**.
- `npm run lint`, `npm run typecheck` e `npx vitest run` têm que passar. Reporte
  a saída real.

---

## Estrutura de arquivos

| arquivo | responsabilidade nova |
|---|---|
| `lib/steps.ts` | tipos `Ligacao`/`Quando`/`Botao`; `interpretar` caminha o grafo; `ligacaoEscolhida`; `temCicloDeSempre`; as duas conferências |
| `lib/db.ts` | coluna `ligacoes`; campo no tipo `Automation` |
| `lib/engine.ts` | passa as ligações ao interpretador; lê o botão do payload |
| `lib/queue-drain.ts` | envia vários botões numa mensagem |
| `lib/ig.ts` | (já aceita `quick_replies` como lista — confira antes de mexer) |
| `app/automacoes/actions.ts` | grava `ligacoes`; a conferência de ativar |
| `app/automacoes/editor/quadro.tsx` | setas vindas do dado; ligar; soltar sobre a seta parte a ligação |
| `app/automacoes/editor/no.tsx` | uma alça por botão, mais a do "senão" |
| `app/automacoes/editor/painel.tsx` | editar os botões de um bloco |
| `app/automacoes/editor/previa.tsx` | o caminho até o bloco selecionado |
| `scripts/ligar-passos-existentes.mjs` | migração: cada automação vira uma corrente |

---

# Tarefa 1 · A coluna, os tipos e a migração

**Files:**
- Modify: `lib/steps.ts`, `lib/db.ts`
- Create: `scripts/ligar-passos-existentes.mjs`
- Test: `tests/steps.test.ts`

**Interfaces produzidas:**

```ts
export type Botao = { id: string; rotulo: string };
export type Quando =
  | { tipo: "sempre" }
  | { tipo: "botao"; botao: string }
  | { tipo: "senao" };
export type Ligacao = { de: string; quando: Quando; para: string };

export function conferirLigacao(l: unknown): { ligacao?: Ligacao; motivo?: string };
export function ligacoesDe(ligacoes: unknown, bloco: string): Ligacao[];
export function novoIdDeBotao(): string;
```

**Nada muda de comportamento nesta tarefa.** `interpretar` continua andando pelo
array; as ligações entram no dado e ficam paradas. A Tarefa 2 as liga.

- [ ] **Passo 1: escreva os testes que falham**

Em `tests/steps.test.ts`:

```ts
describe("conferirLigacao", () => {
  it("aceita a forma completa dos três tipos", () => {
    expect(conferirLigacao({ de: "b_aaa111", quando: { tipo: "sempre" }, para: "b_bbb222" }).ligacao)
      .toEqual({ de: "b_aaa111", quando: { tipo: "sempre" }, para: "b_bbb222" });
    expect(conferirLigacao({ de: "b_aaa111", quando: { tipo: "botao", botao: "op_a" }, para: "b_bbb222" }).motivo)
      .toBeUndefined();
    expect(conferirLigacao({ de: "b_aaa111", quando: { tipo: "senao" }, para: "b_bbb222" }).motivo)
      .toBeUndefined();
  });

  it("recusa ligação sem de, sem para, ou com tipo desconhecido", () => {
    // Ligação quebrada é caminho que não existe. Ignorar em silêncio faria a
    // pessoa parar no meio do fluxo sem nada em Atividade.
    expect(conferirLigacao({ quando: { tipo: "sempre" }, para: "b_bbb222" }).ligacao).toBeUndefined();
    expect(conferirLigacao({ de: "b_aaa111", quando: { tipo: "sempre" } }).ligacao).toBeUndefined();
    expect(conferirLigacao({ de: "b_aaa111", quando: { tipo: "voar" }, para: "b_bbb222" }).ligacao).toBeUndefined();
    expect(conferirLigacao({ de: "b_aaa111", quando: { tipo: "botao" }, para: "b_bbb222" }).ligacao).toBeUndefined();
  });

  it("não estoura com lixo", () => {
    expect(conferirLigacao(null).ligacao).toBeUndefined();
    expect(conferirLigacao("x").ligacao).toBeUndefined();
    expect(conferirLigacao(42).ligacao).toBeUndefined();
  });
});

describe("ligacoesDe", () => {
  const ls = [
    { de: "b_aaa111", quando: { tipo: "botao", botao: "op_a" }, para: "b_bbb222" },
    { de: "b_aaa111", quando: { tipo: "senao" }, para: "b_ccc333" },
    { de: "b_bbb222", quando: { tipo: "sempre" }, para: "b_ccc333" },
    { de: "b_aaa111", quando: { tipo: "voar" }, para: "b_ddd444" },
  ];

  it("devolve as ligações VÁLIDAS que saem daquele bloco, na ordem", () => {
    const r = ligacoesDe(ls, "b_aaa111");
    expect(r).toHaveLength(2);
    expect(r[0].para).toBe("b_bbb222");
    expect(r[1].quando.tipo).toBe("senao");
  });

  it("bloco sem saída devolve lista vazia", () => {
    expect(ligacoesDe(ls, "b_zzz999")).toEqual([]);
  });

  it("não estoura quando não é lista", () => {
    expect(ligacoesDe(null, "b_aaa111")).toEqual([]);
    expect(ligacoesDe({}, "b_aaa111")).toEqual([]);
  });
});

describe("novoIdDeBotao", () => {
  it("sai sempre no formato aceito e com comprimento fixo", () => {
    for (let i = 0; i < 500; i++) expect(novoIdDeBotao()).toMatch(/^op_[0-9a-z]{6}$/);
  });
});
```

- [ ] **Passo 2: rode e confirme que falha**

```
npx vitest run tests/steps.test.ts
```

Esperado: FAIL — `conferirLigacao is not a function`.

- [ ] **Passo 3: os tipos e as três funções**

Em `lib/steps.ts`, perto de `conferir`:

```ts
// Um botão de escolha. O `id` é o que viaja no payload, e é ele que
// `ligacaoEscolhida` (mais abaixo) casa com a ligação — NÃO o rótulo, que o dono
// pode reescrever a qualquer momento sem querer trocar de caminho.
export type Botao = { id: string; rotulo: string };

// A pergunta feita na bifurcação.
//
// `sempre` é o caso comum: um bloco que não bifurca tem uma saída só, e ela vale
// sem condição. `botao` casa com o toque. `senao` recebe quem respondeu
// DIGITANDO em vez de tocar — é opcional, e sem ela o fluxo simplesmente para.
//
// As outras duas ramificações do produto entram AQUI, sem tocar em mais nada:
// `{tipo:"texto", palavras:[…]}` e `{tipo:"segue"}`. É por isso que `quando` é
// um objeto com discriminante em vez de uma string.
export type Quando =
  | { tipo: "sempre" }
  | { tipo: "botao"; botao: string }
  | { tipo: "senao" };

export type Ligacao = { de: string; quando: Quando; para: string };

const ALFABETO_DO_ID = "0123456789abcdefghijklmnopqrstuvwxyz";

// Comprimento FIXO, pelo mesmo motivo de `novoIdDeBloco`: um id curto demais
// seria recusado pela forma e o botão deixaria de casar com a ligação, em
// silêncio.
export function novoIdDeBotao(): string {
  let id = "op_";
  for (let i = 0; i < 6; i++) id += ALFABETO_DO_ID[Math.floor(Math.random() * 36)];
  return id;
}

// Valida e normaliza uma ligação. Devolve o motivo quando não dá para usar.
//
// Ligação quebrada é caminho que não existe. Ignorar em silêncio faria a pessoa
// parar no meio do fluxo sem nada em Atividade — a mesma falha muda que o
// `step_ignorado` existe para evitar do lado dos blocos.
export function conferirLigacao(l: unknown): { ligacao?: Ligacao; motivo?: string } {
  if (!l || typeof l !== "object") return { motivo: "ligação não é um objeto" };
  const o = l as Record<string, unknown>;
  if (typeof o.de !== "string" || !o.de) return { motivo: "ligação sem bloco de origem" };
  if (typeof o.para !== "string" || !o.para) return { motivo: "ligação sem bloco de destino" };
  const q = o.quando as Record<string, unknown> | undefined;
  if (!q || typeof q !== "object") return { motivo: "ligação sem condição" };
  if (q.tipo === "sempre" || q.tipo === "senao") return { ligacao: l as Ligacao };
  if (q.tipo === "botao") {
    if (typeof q.botao !== "string" || !q.botao) return { motivo: "ligação de botão sem o botão" };
    return { ligacao: l as Ligacao };
  }
  return { motivo: `condição desconhecida: ${String(q.tipo)}` };
}

// As saídas VÁLIDAS de um bloco, na ordem em que foram gravadas.
//
// A ordem importa em um caso só, e ele está em `ligacaoEscolhida`: havendo mais
// de uma que sirva, ganha a primeira. Fora disso, ordem de ligação não quer
// dizer nada — quem manda é a condição.
export function ligacoesDe(ligacoes: unknown, bloco: string): Ligacao[] {
  if (!Array.isArray(ligacoes)) return [];
  const saidas: Ligacao[] = [];
  for (const bruta of ligacoes) {
    const { ligacao } = conferirLigacao(bruta);
    if (ligacao && ligacao.de === bloco) saidas.push(ligacao);
  }
  return saidas;
}
```

E acrescente `botoes?: Botao[]` ao ramo `dm` do tipo `Passo`.

- [ ] **Passo 4: rode e confirme que passa**

```
npx vitest run tests/steps.test.ts
grep -c "^import\|require(" lib/steps.ts
```

Esperado: PASS, e o grep devolvendo `0`.

- [ ] **Passo 5: a coluna**

Em `lib/db.ts`, no fim do array de DDL:

```ts
  // As ligações entre os blocos: de qual bloco, sob qual condição, para qual
  // bloco. Com elas, a ORDEM DO ARRAY `steps` deixa de significar o próximo — é
  // a seta que manda.
  //
  // Coluna nova em vez de mudança em `steps`, de propósito: `steps` continua com
  // a mesma forma, então uma automação que ninguém abriu continua sendo lida
  // exatamente como antes. Quem a converte em corrente é o script de migração.
  `alter table automations add column if not exists ligacoes jsonb not null default '[]'::jsonb`,
```

E no tipo `Automation`, acrescente `ligacoes: unknown[];`.

- [ ] **Passo 6: o script de migração**

Crie `scripts/ligar-passos-existentes.mjs`. Ele lê `steps` de cada automação e
grava em `ligacoes` uma corrente `sempre` reproduzindo a ordem do array.

Leia `scripts/dar-ids-aos-passos.mjs` antes de escrever: ele é o modelo desta
série — como lê a credencial, como usa transação por automação, como imprime, e
como é idempotente. **Siga o mesmo formato.**

Regras que este precisa ter:

- **idempotente**: automação que já tem ligações não é tocada. Imprima `ok`.
- **só a corrente**: bloco `i` → bloco `i+1`, sempre `{tipo:"sempre"}`, usando a
  identidade de `identidadeDoPasso` (bloco sem id usa o índice em texto).
- **o último bloco não ganha saída** — é o fim do fluxo.
- **automação com menos de dois blocos** não gera ligação nenhuma; imprima `ok`.

- [ ] **Passo 7: ensaio a seco e conferência**

O script **não** aplica por padrão: sem `--aplicar`, imprime o que faria e sai.
Rode o ensaio e confira que o número de ligações previstas por automação é
`blocos - 1`.

**PARE E REPORTE antes de aplicar.** Escrita em produção é autorizada por quem
conduz, não por você.

- [ ] **Passo 8: verify e commit**

```
npm run lint && npm run typecheck && npx vitest run
git add lib/steps.ts lib/db.ts scripts/ligar-passos-existentes.mjs tests/steps.test.ts
git commit -m "As ligacoes entram no dado, e a ordem do array para de mandar"
```

---

# Tarefa 2 · `interpretar` caminha o grafo

**Files:**
- Modify: `lib/steps.ts` (`interpretar`), `lib/engine.ts` (as chamadas)
- Test: `tests/steps.test.ts`

**Interfaces consumidas:** `Ligacao`, `ligacoesDe` (Tarefa 1).

**Interfaces produzidas:**

```ts
export const TETO_DE_PASSOS = 100;
export function interpretar(passos: unknown, ligacoes: unknown, deBloco: string): Resultado;
export function temCicloDeSempre(passos: unknown, ligacoes: unknown): boolean;
```

`Resultado` ganha `pararEm: string | null` (a identidade do bloco, não o índice).

## O que muda na caminhada

Hoje `interpretar(passos, deIndice)` anda `i++` até achar um bloco que espera.
Passa a andar seguindo a ligação `sempre` que sai do bloco atual.

**O ponto de partida deixa de ser um índice e vira a identidade de um bloco.** O
cursor já guarda identidade desde a Fase 1b — é a mesma coisa que
`indiceDoId` resolve hoje.

**Um bloco com `botoes` ESPERA**, exatamente como a `dm` de resposta rápida
espera. `esperaResposta` precisa saber disso.

- [ ] **Passo 1: escreva os testes que falham**

```ts
describe("interpretar caminhando o grafo", () => {
  const bem = { id: "b_bem001", tipo: "dm", texto: "Oi!" };
  const meio = { id: "b_mei002", tipo: "dm", texto: "Meio" };
  const fim = { id: "b_fim003", tipo: "dm", texto: "Fim" };
  const corrente = [
    { de: "b_bem001", quando: { tipo: "sempre" }, para: "b_mei002" },
    { de: "b_mei002", quando: { tipo: "sempre" }, para: "b_fim003" },
  ];

  it("segue a corrente até o fim e não para em lugar nenhum", () => {
    const r = interpretar([bem, meio, fim], corrente, "b_bem001");
    expect(r.enfileirar.map((a) => a.passo.id)).toEqual(["b_bem001", "b_mei002", "b_fim003"]);
    expect(r.pararEm).toBe(null);
  });

  it("A ORDEM DO ARRAY NÃO MANDA MAIS — a seta manda", () => {
    // Mesmos blocos, array embaralhado, mesmas ligações: o resultado é idêntico.
    // É este teste que prova que a ordem deixou de significar o próximo.
    const r = interpretar([fim, bem, meio], corrente, "b_bem001");
    expect(r.enfileirar.map((a) => a.passo.id)).toEqual(["b_bem001", "b_mei002", "b_fim003"]);
  });

  it("bloco com BOTÕES é parada dura", () => {
    const menu = { id: "b_men001", tipo: "dm", texto: "Qual?",
                   botoes: [{ id: "op_aaaaaa", rotulo: "A" }, { id: "op_bbbbbb", rotulo: "B" }] };
    const r = interpretar([menu, fim], [{ de: "b_men001", quando: { tipo: "botao", botao: "op_aaaaaa" }, para: "b_fim003" }], "b_men001");
    expect(r.enfileirar.map((a) => a.passo.id)).toEqual(["b_men001"]);
    expect(r.pararEm).toBe("b_men001");
  });

  it("bloco sem saída encerra o fluxo", () => {
    const r = interpretar([bem], [], "b_bem001");
    expect(r.enfileirar.map((a) => a.passo.id)).toEqual(["b_bem001"]);
    expect(r.pararEm).toBe(null);
  });

  it("A JUNÇÃO FUNCIONA: dois braços chegam no mesmo fim, e ele não é repetido", () => {
    // A fila não conseguia representar isto — o fim teria que ser copiado em cada
    // braço. Aqui é UM bloco, e cada caminhada passa nele uma vez só.
    const a = { id: "b_ramA01", tipo: "dm", texto: "A" };
    const b = { id: "b_ramB02", tipo: "dm", texto: "B" };
    const ligs = [
      { de: "b_ramA01", quando: { tipo: "sempre" }, para: "b_fim003" },
      { de: "b_ramB02", quando: { tipo: "sempre" }, para: "b_fim003" },
    ];
    const porA = interpretar([a, b, fim], ligs, "b_ramA01");
    const porB = interpretar([a, b, fim], ligs, "b_ramB02");
    expect(porA.enfileirar.map((x) => x.passo.id)).toEqual(["b_ramA01", "b_fim003"]);
    expect(porB.enfileirar.map((x) => x.passo.id)).toEqual(["b_ramB02", "b_fim003"]);
  });

  it("O TETO SEGURA O CICLO em vez de andar para sempre", () => {
    // Sem o teto, isto nunca retorna e a fila cresce até a memória acabar.
    const x = { id: "b_xxx001", tipo: "dm", texto: "X" };
    const y = { id: "b_yyy002", tipo: "dm", texto: "Y" };
    const anel = [
      { de: "b_xxx001", quando: { tipo: "sempre" }, para: "b_yyy002" },
      { de: "b_yyy002", quando: { tipo: "sempre" }, para: "b_xxx001" },
    ];
    const r = interpretar([x, y], anel, "b_xxx001");
    expect(r.enfileirar.length).toBeLessThanOrEqual(TETO_DE_PASSOS);
    expect(r.ignorados.some((i) => /teto|ciclo|volta/i.test(i.motivo))).toBe(true);
  });

  it("o esperar continua somando ao longo do caminho percorrido", () => {
    const esperar = { id: "b_esp001", tipo: "esperar", minutos: 5 };
    const ligs = [
      { de: "b_bem001", quando: { tipo: "sempre" }, para: "b_esp001" },
      { de: "b_esp001", quando: { tipo: "sempre" }, para: "b_fim003" },
    ];
    const r = interpretar([bem, esperar, fim], ligs, "b_bem001");
    const ultimo = r.enfileirar[r.enfileirar.length - 1];
    expect(ultimo.passo.id).toBe("b_fim003");
    expect(ultimo.atrasoSegundos).toBe(300);
  });
});

describe("temCicloDeSempre", () => {
  it("acha o anel de sempre", () => {
    expect(temCicloDeSempre(
      [{ id: "b_xxx001", tipo: "dm", texto: "X" }, { id: "b_yyy002", tipo: "dm", texto: "Y" }],
      [{ de: "b_xxx001", quando: { tipo: "sempre" }, para: "b_yyy002" },
       { de: "b_yyy002", quando: { tipo: "sempre" }, para: "b_xxx001" }]
    )).toBe(true);
  });

  it("CICLO QUE PASSA POR UMA PARADA NÃO CONTA — é padrão legítimo", () => {
    // "menu → opção → volta ao menu" é um fluxo bom, e a caminhada para no menu.
    const menu = { id: "b_men001", tipo: "dm", texto: "Qual?",
                   botoes: [{ id: "op_aaaaaa", rotulo: "A" }] };
    const op = { id: "b_opa002", tipo: "dm", texto: "Opção A" };
    expect(temCicloDeSempre([menu, op], [
      { de: "b_men001", quando: { tipo: "botao", botao: "op_aaaaaa" }, para: "b_opa002" },
      { de: "b_opa002", quando: { tipo: "sempre" }, para: "b_men001" },
    ])).toBe(false);
  });

  it("corrente reta não tem ciclo", () => {
    expect(temCicloDeSempre(
      [{ id: "b_aaa111", tipo: "dm", texto: "A" }, { id: "b_bbb222", tipo: "dm", texto: "B" }],
      [{ de: "b_aaa111", quando: { tipo: "sempre" }, para: "b_bbb222" }]
    )).toBe(false);
  });
});
```

- [ ] **Passo 2: rode e confirme que falha**

```
npx vitest run tests/steps.test.ts
```

- [ ] **Passo 3: `esperaResposta` aprende os botões**

Um bloco com dois ou mais botões espera o toque. Ajuste `esperaResposta` para o
ramo `dm` considerar `botoes`, e **escreva no comentário** por que ele espera:
não há como o fluxo escolher sozinho qual braço seguir.

Um bloco com `botoes` de **um item só** também espera — é uma mensagem com botão
com outra roupa. A conferência avisa sobre isso na Tarefa 5; aqui ele só espera.

- [ ] **Passo 4: a caminhada**

Reescreva o laço de `interpretar`. O que muda: em vez de `i++`, siga a ligação
`sempre` que sai do bloco atual (`ligacoesDe`), e pare quando não houver nenhuma.

**Três coisas que o laço precisa ter, e cada uma tem um motivo:**

1. **O teto.** `TETO_DE_PASSOS = 100`. Batendo nele, para e registra em
   `ignorados` com motivo próprio. Escreva no comentário que ele existe contra
   dado que entrou por fora do editor — a conferência protege quem monta, mas o
   `jsonb` é editável por fora, e a Fase 1b já registrou isso como premissa.
2. **Bloco que não existe.** Uma ligação pode apontar para um id que sumiu.
   Registre em `ignorados` e pare — não estoure.
3. **`pararEm` vira identidade**, não índice. Os chamadores em `lib/engine.ts`
   já trabalham com identidade desde a Fase 1b.

- [ ] **Passo 5: `temCicloDeSempre`**

Percorra o grafo seguindo **só** as ligações `sempre`, a partir de cada bloco,
com um conjunto de visitados. Achou um bloco duas vezes no mesmo caminho, é
ciclo.

Escreva no comentário a distinção que decide a regra: ciclo que passa por uma
parada é legítimo e útil; ciclo só de `sempre` é infinito. **Esta função olha só
as `sempre`, e é por isso que ela não acusa o padrão bom.**

- [ ] **Passo 6: as chamadas no motor**

`grep -n "interpretar(" lib/engine.ts` e ajuste cada uma para passar
`auto.ligacoes` e a identidade do bloco de partida.

Onde hoje o motor converte identidade em índice para chamar `interpretar`, essa
conversão **some** — a caminhada já fala em identidade.

**Leia cada chamada antes de mexer.** Se alguma deixar de fazer sentido com o
grafo, **pare e reporte** em vez de adivinhar.

- [ ] **Passo 7: mute e prove**

Tire o teto e rode o teste do ciclo: ele tem que travar (mate o processo). Depois
faça `temCicloDeSempre` olhar todas as ligações em vez de só as `sempre`, e
confirme que o teste do padrão legítimo fica vermelho. Desfaça as duas e
**reporte o que viu**.

- [ ] **Passo 8: verify e commit**

```
npm run lint && npm run typecheck && npx vitest run
git add lib/steps.ts lib/engine.ts tests/steps.test.ts
git commit -m "O interpretador passa a caminhar o grafo, com teto contra ciclo"
```

---

# Tarefa 3 · A escolha da ligação e o payload de quatro partes

**Files:**
- Modify: `lib/steps.ts` (`ligacaoEscolhida`, `lerPayload`), `lib/engine.ts`
- Test: `tests/steps.test.ts`

**Interfaces produzidas:**

```ts
export function ligacaoEscolhida(
  ligacoes: unknown,
  deBloco: string,
  oQueAconteceu: { tipo: "botao"; botao: string } | { tipo: "texto" }
): string | null;
```

`Payload` ganha `botaoId: string | null`.

- [ ] **Passo 1: escreva os testes que falham**

```ts
describe("ligacaoEscolhida", () => {
  const ls = [
    { de: "b_men001", quando: { tipo: "botao", botao: "op_aaaaaa" }, para: "b_opa002" },
    { de: "b_men001", quando: { tipo: "botao", botao: "op_bbbbbb" }, para: "b_opb003" },
    { de: "b_men001", quando: { tipo: "senao" }, para: "b_sen004" },
  ];

  it("o botão tocado leva ao destino DAQUELE botão", () => {
    expect(ligacaoEscolhida(ls, "b_men001", { tipo: "botao", botao: "op_bbbbbb" })).toBe("b_opb003");
  });

  it("texto cai no senão", () => {
    expect(ligacaoEscolhida(ls, "b_men001", { tipo: "texto" })).toBe("b_sen004");
  });

  it("sem senão, texto não leva a lugar nenhum", () => {
    const semSenao = ls.slice(0, 2);
    expect(ligacaoEscolhida(semSenao, "b_men001", { tipo: "texto" })).toBe(null);
  });

  it("botão que não tem ligação devolve null, e NÃO cai no senão", () => {
    // O senão é para quem DIGITOU. Um botão sem destino é defeito de montagem,
    // e mandá-lo para o senão esconderia isso.
    expect(ligacaoEscolhida(ls, "b_men001", { tipo: "botao", botao: "op_zzzzzz" })).toBe(null);
  });

  it("não estoura com lixo", () => {
    expect(ligacaoEscolhida(null, "b_men001", { tipo: "texto" })).toBe(null);
    expect(ligacaoEscolhida(ls, "", { tipo: "texto" })).toBe(null);
  });
});

describe("lerPayload com o botão", () => {
  it("lê a forma de quatro partes", () => {
    expect(lerPayload("AUTO:auto-1:b_men001:op_aaaaaa")).toEqual({
      prefixo: "AUTO", automationId: "auto-1", passoId: "b_men001", botaoId: "op_aaaaaa",
    });
  });

  it("AS TRÊS FORMAS ANTIGAS CONTINUAM VÁLIDAS", () => {
    // Um botão entregue vive na conversa da pessoa indefinidamente. Apagar
    // qualquer um destes ramos quebraria todo botão já enviado, de uma vez.
    expect(lerPayload("AUTO:auto-1")).toEqual({
      prefixo: "AUTO", automationId: "auto-1", passoId: null, botaoId: null });
    expect(lerPayload("AUTO:auto-1:b_men001")).toEqual({
      prefixo: "AUTO", automationId: "auto-1", passoId: "b_men001", botaoId: null });
    expect(lerPayload("FOLLOW:auto-1:b_por002")).toEqual({
      prefixo: "FOLLOW", automationId: "auto-1", passoId: "b_por002", botaoId: null });
  });

  it("cinco partes continuam sendo recusadas", () => {
    expect(lerPayload("AUTO:a:b:c:d")).toBe(null);
  });

  it("quarta parte em branco é recusada", () => {
    expect(lerPayload("AUTO:auto-1:b_men001:")).toBe(null);
  });
});
```

- [ ] **Passo 2: rode e confirme que falha**

- [ ] **Passo 3: `ligacaoEscolhida`**

Em `lib/steps.ts`. A regra, e cada linha dela tem motivo:

- toque num botão casa com a ligação **daquele botão**, por id
- texto cai na `senao`, se houver
- **botão sem ligação devolve null e NÃO cai no senão** — o `senao` é para quem
  digitou; mandar um botão órfão para lá esconderia um defeito de montagem
- havendo mais de uma que sirva, ganha a **primeira** (a conferência da Tarefa 5
  recusa salvar duas para o mesmo botão, mas dado de fora pode chegar assim)

Escreva no comentário **por que o id do botão e não o rótulo**: o dono reescreve
rótulo o tempo todo, e trocar o texto de um botão não pode trocar o caminho.

- [ ] **Passo 4: `lerPayload` aceita quatro partes**

Hoje ela faz `if (partes.length > 3) return null`. Passa a aceitar quatro.

**Escreva no comentário que agora são TRÊS formas convivendo, e que isso não é
dívida a limpar.** Sem essa frase, alguém "arruma" os ramos antigos e quebra
todo botão já entregue.

- [ ] **Passo 5: o motor usa o botão**

No ramo de resposta rápida de `lib/engine.ts`: quando o payload traz `botaoId`,
o próximo bloco vem de `ligacaoEscolhida`. Sem `botaoId`, o comportamento é o de
hoje.

**Confira e reporte:** o que acontece quando a pessoa toca num botão de um bloco
que não é mais o do cursor dela? A Fase 1b decidiu que **o cursor manda e o
payload é reserva** — confirme que essa regra continua fazendo sentido com
bifurcação, e diga o que encontrou mesmo que atrapalhe.

- [ ] **Passo 6: verify e commit**

```
npm run lint && npm run typecheck && npx vitest run
git add lib/steps.ts lib/engine.ts tests/steps.test.ts
git commit -m "O botao tocado escolhe o caminho, e o payload ganha uma quarta parte"
```

---

# Tarefa 3b · "O seguinte" e o portão deixam de ser aritmética de posição

**Files:**
- Modify: `lib/steps.ts` (`retomadaDoBotao`, `retomadaDoTexto`, `retomadaDoFallback`, `atravessandoOPortao`)
- Test: `tests/steps.test.ts`

**Esta tarefa não estava no plano original. Ela existe porque a Tarefa 2 mediu
e reportou o que faltava** — seis pontos de partida continuavam calculando o
próximo bloco com `indice + 1`, e o grafo não reproduz isso. Eles concordam hoje
só porque a migração produz corrente reta.

## Por que é UMA tarefa e não duas

As retomadas e o portão estão entrelaçados: `retomadaDoTexto` chama
`atravessandoOPortao(passos, indice + 1)`. Converter só as retomadas deixaria
metade em seta e metade em índice — que é exatamente a "mesma regra em dois
lugares" que este projeto foi punido por três vezes.

## O que muda

**"O seguinte" vira "a seta `sempre` que sai daqui".** Nas três retomadas, onde
hoje está `indice + 1`. Onde está `indice` (retomar do próprio bloco) **não
muda** — o motivo de `pedir_follow` retomar dele mesmo continua valendo: a
mensagem de texto não é o follow, e avançar entregaria o link a quem não segue.

**O portão deixa de ser "está antes no array" e vira "está no caminho".**
Hoje `atravessandoOPortao` faz `portao < destino`, comparando posições. Num
grafo isso erra **dos dois lados**:

- o portão pode estar noutro braço, e a pessoa é mandada para um portão que não
  está no caminho dela
- o portão pode estar no caminho dela e ter índice maior, e ela **recebe o link
  sem seguir** — que é a única falha do produto que não tem conserto depois

## Esta é a garantia central do produto

A revisão final da Fase 1b provou, em **43.476 casos** simulados sobre as funções
puras, que nenhum caminho entrega o link a quem não segue. Essa prova é sobre o
código de índice. **Com o grafo, ela precisa ser refeita** — e é o entregável
mais importante desta tarefa, mais do que o código.

- [ ] **Passo 1: escreva os testes que falham**

Cubra, com nomes que digam a consequência e não a mecânica:

- retomada de um bloco `dm` segue a seta, e **não** o vizinho de array
- com o array embaralhado e as mesmas ligações, a retomada é a mesma
- `pedir_follow` continua retomando **dele mesmo**
- **portão noutro braço não é atravessado** — quem não passa por ele não é
  desviado para ele
- **portão no caminho é atravessado mesmo com índice MAIOR que o destino** —
  este é o teste que a versão de índice não passa, e é o que prova a correção
- portão já atravessado não desvia de novo

- [ ] **Passo 2: rode e confirme que falha**

Pelo menos o teste do "índice maior" **tem que** ficar vermelho antes. Se ele
passar de primeira, **pare e reporte**: ou o teste não discrimina, ou eu entendi
o defeito errado. As duas hipóteses são úteis e nenhuma se resolve seguindo.

- [ ] **Passo 3: implemente**

`atravessandoOPortao` passa a receber as ligações e a perguntar **se há portão no
caminho** entre onde a pessoa está e o destino. Use a caminhada que a Tarefa 2 já
construiu — **não escreva uma segunda travessia do grafo.** Se precisar de uma
peça nova, ela é pura e vai para `lib/steps.ts` com teste próprio.

Cuidado com ciclo: a busca de caminho precisa de visitados, pelo mesmo motivo do
teto da Tarefa 2.

- [ ] **Passo 4: rode e confirme que passa**

- [ ] **Passo 5: A VARREDURA — o entregável principal**

Escreva um script de varredura (fora da suíte, em `scripts/` ou no scratchpad) que
gere fluxos com bifurcação, junção, portão em posições e braços variados, e
simule **todos** os caminhos possíveis sobre as funções puras.

**O que precisa ficar provado:** não existe caminho, em nenhum fluxo gerado, que
entregue um passo com `url` a quem não passou pelo portão.

**Reporte o número de casos e o número de vazamentos.** Se der zero vazamentos,
rode a contraprova: reverta para a comparação de índice e mostre que a varredura
ACUSA. Uma varredura que dá zero nos dois casos não provou nada — foi o que
aconteceu quatro vezes nesta base com comparações "antes e depois".

- [ ] **Passo 6: verify e commit**

```
npm run lint && npm run typecheck && npx vitest run
git add lib/steps.ts tests/steps.test.ts
git commit -m "O portao deixa de comparar posicao e passa a perguntar pelo caminho"
```

---

# Tarefa 4 · Vários botões numa mensagem

**Files:**
- Modify: `lib/queue-drain.ts`, `lib/engine.ts`
- Test: nenhum automatizado — ver a conferência no fim

**Interfaces consumidas:** `Botao` (Tarefa 1).

`lib/ig.ts` **já aceita** `quick_replies` como lista (confira antes de mexer:
`OutgoingMessage` tem `quick_replies?: {...}[]`). O que está estreitado é o
aplicativo, que só monta um.

- [ ] **Passo 1: o item da fila carrega os botões**

Hoje o payload da fila tem `quick_reply_label` e `quick_reply_payload`, no
singular. Acrescente a forma plural.

**Não apague a singular.** Itens já enfileirados a usam, e a fila pode ter linhas
esperando quando o código novo subir. As duas convivem: plural quando existe,
singular como está hoje.

- [ ] **Passo 2: o motor enfileira os botões**

Em `enfileirarPasso`, um bloco `dm` com `botoes` enfileira todos, cada um com o
payload `AUTO:<automação>:<bloco>:<botão>`.

- [ ] **Passo 3: o dreno envia**

Monte `quick_replies` a partir da lista. **Confira o limite no guia da API antes
de escrever** — a Meta limita a quantidade de respostas rápidas por mensagem.

**A defesa fica nos dois lados, e não é redundância à toa.** A conferência da
Tarefa 5 impede ATIVAR uma automação com mais botões do que cabe — é lá que o
dono vê o problema enquanto monta. O dreno **corta e registra em Atividade** —
porque o `jsonb` é editável por fora, e sem o corte a mensagem inteira é recusada
pela Meta e ninguém recebe nada. Um avisa; o outro impede o silêncio.

Se o limite que você encontrar no guia não for 13, **use o do guia e diga qual
é** — o número aqui veio de memória, não de leitura.

- [ ] **Passo 4: confira à mão e reporte**

O envio de verdade exige a Meta, e as fases anteriores exercitaram isso com
webhook forjado e assinado contra um build local. **Se conseguir fazer o mesmo,
faça; se não, diga o que ficou de fora** — não presuma que saiu.

O que precisa ficar provado: uma mensagem com três botões chega com os três, e
cada um carrega o payload do SEU botão.

- [ ] **Passo 5: verify e commit**

```
npm run lint && npm run typecheck && npx vitest run
git add lib/engine.ts lib/queue-drain.ts
git commit -m "Uma mensagem passa a poder levar varios botoes"
```

---

# Tarefa 5 · A conferência, em dois níveis

**Files:**
- Modify: `lib/steps.ts` (`conferirLista`), `app/automacoes/actions.ts`
- Test: `tests/steps.test.ts`

**Interfaces produzidas:**

`Problema` ganha `quando: "salvar" | "ativar"`.

## A regra, e por que dois níveis

**Impede SALVAR** — dado que o motor não consegue ler:
ciclo de `sempre`; dois destinos para o mesmo botão; bloco incompleto (já existe).

**Impede ATIVAR** — fluxo que entregaria errado, mas que é montagem normal:
botão sem destino; bloco inalcançável.

**Avisa:** bifurcação com um botão só.

Montar um menu de três opções, ligar duas e voltar amanhã é trabalho normal;
travar o salvar nisso seria hostil. Publicar um botão que não faz nada é a falha
silenciosa que este projeto combate desde a Fase 1a.

- [ ] **Passo 1: escreva os testes que falham**

Cubra, com asserção sobre o `quando` de cada um:

- ciclo de `sempre` → erro de **salvar**
- dois destinos para o mesmo botão → erro de **salvar**
- botão sem destino → erro de **ativar**
- bloco que nada aponta → erro de **ativar**
- bifurcação com um botão só → **aviso**
- **o bloco de partida não é "inalcançável"** — nada aponta para ele por
  definição, e acusá-lo travaria toda automação
- lista válida com bifurcação e junção → **nenhum problema**

O penúltimo é o que mais importa: sem ele, a regra de alcançabilidade acusa a
própria entrada do fluxo e nada mais pode ser ativado.

- [ ] **Passo 2: rode e confirme que falha**

- [ ] **Passo 3: as regras novas**

Em `conferirLista`. **Alcançável é "alcançável a partir de `steps[0]`"**, seguindo
qualquer tipo de ligação — a regra da entrada está nas restrições globais, com o
motivo.

Acrescente aqui a conferência do teto de botões da Meta (Tarefa 4): bloco com
mais botões do que cabe numa mensagem impede **ativar**.

- [ ] **Passo 4: o salvar e o ativar usam níveis diferentes**

`salvarAutomacao` recusa só os de `quando: "salvar"`. `toggleAutomation`, **ao
ativar**, recusa os dois níveis. Desativar não confere nada — desligar uma
automação quebrada tem que continuar sempre possível.

- [ ] **Passo 5: mute e prove**

Faça o salvar recusar os dois níveis e confirme que o teste do menu pela metade
fica vermelho. Depois faça o ativar recusar só um nível e confirme o mesmo do
outro lado. Reporte.

- [ ] **Passo 6: verify e commit**

```
npm run lint && npm run typecheck && npx vitest run
git add lib/steps.ts app/automacoes/actions.ts tests/steps.test.ts
git commit -m "A conferencia passa a separar o que impede salvar do que impede ativar"
```

---

# Tarefa 6 · O quadro: setas de verdade

**Files:**
- Modify: `app/automacoes/editor/quadro.tsx`, `no.tsx`, `geometria.ts`

- [ ] **Passo 1: as setas vêm do dado**

Hoje `quadro.tsx` deriva as setas da ordem do array. Passa a montá-las a partir
de `ligacoes`. **Sai lógica, não entra.**

Cada aresta do React Flow precisa carregar de qual ligação ela é, para o resto
dos passos poder mexer nela.

- [ ] **Passo 2: uma alça por botão**

Em `no.tsx`: um bloco com `botoes` ganha uma alça de saída **por botão**, cada
uma com o rótulo do botão à vista, mais uma para o "senão". Bloco sem botões
continua com uma alça só.

A alça precisa dizer **qual** botão ela é — é isso que o React Flow devolve ao
criar a ligação.

- [ ] **Passo 3: ligar deixa de ser proibido**

`nodesConnectable` passa a ser verdadeiro, e `onConnect` grava a ligação nova.

**Confira o que a Fase 1b descobriu medindo:** `nodesConnectable` sozinho não
alcança as alças — `no.tsx` precisa repassar `isConnectable`, e o gesto tem duas
pontas (`isConnectableStart` e `isConnectableEnd`). Está escrito no comentário
de `no.tsx`.

- [ ] **Passo 4: soltar sobre a seta parte a ligação**

O gesto continua; o significado muda. Era reordenar o array; passa a ser
**partir a ligação em duas** com o bloco novo no meio.

A geometria já existe em `editor/geometria.ts`, pura e testada — inclusive a
regra das setas já ao alcance no início do gesto, que existe porque um empurrão
de 4 pixels reordenava o fluxo. **Reaproveite; não reescreva.**

- [ ] **Passo 5: bloco solto passa a ser possível**

A invariante "todo bloco está sempre na corrente" **cai**, por decisão registrada
na spec. Soltar num ponto vazio cria um bloco sem ligação, e a conferência diz
que ele não é alcançável.

**Tire o código que anexava no fim**, e o comentário que promete a invariante
antiga — ele passa a mentir.

- [ ] **Passo 6: confira à mão e reporte item por item**

Com o servidor de desenvolvimento, na tela real:

- as setas desenhadas batem com as ligações gravadas
- um bloco com dois botões mostra duas alças, cada uma nomeada
- arrastar de uma alça até outro bloco cria a ligação, e ela sobrevive ao salvar
- soltar um bloco sobre uma seta o põe no meio, e as duas ligações resultantes
  estão certas
- soltar num ponto vazio cria bloco solto, e a conferência acusa
- apagar um bloco apaga as ligações que entram e saem dele

**Meça durante o gesto.** Nesta base, comparar "antes e depois" já aprovou item
quebrado quatro vezes, porque o defeito preservava o estado final.

- [ ] **Passo 7: verify e commit**

```
npm run lint && npm run typecheck && npx vitest run
git add app/automacoes/editor/
git commit -m "O quadro desenha as ligacoes gravadas, e passa a deixar ligar"
```

---

# Tarefa 7 · O painel: editar os botões

**Files:**
- Modify: `app/automacoes/editor/painel.tsx`, `modelos.ts`

- [ ] **Passo 1: a paleta ganha o bloco de menu**

Um item novo — "Mensagem com opções" — que cria um `dm` com `botoes` já com dois
itens. Ícone novo, no estilo dos seis que já existem.

**A convenção da chave `url` continua valendo**, e agora tem uma vizinha: um
bloco com `botoes` **não tem** `botao_label` nem `url`. Escreva isso junto da
convenção existente, nos três lugares que ela já cita.

- [ ] **Passo 2: os campos dos botões**

No painel, um bloco com `botoes` mostra a lista: rótulo de cada um, acrescentar,
remover, reordenar.

**Apagar um botão apaga a ligação dele.** Deixar a ligação órfã faria a
conferência acusar um botão que não existe mais.

- [ ] **Passo 3: confira à mão e reporte**

- criar um menu pela paleta traz dois botões
- renomear um botão **não** troca o caminho (é o id que manda, não o rótulo)
- acrescentar um botão cria a alça no nó, ao vivo
- apagar um botão apaga a ligação junto
- a conferência acusa botão sem destino, e o salvar continua permitido

- [ ] **Passo 4: verify e commit**

```
npm run lint && npm run typecheck && npx vitest run
git add app/automacoes/editor/
git commit -m "O painel edita os botoes de escolha de um bloco"
```

---

# Tarefa 8 · A prévia pelo caminho selecionado

**Files:**
- Modify: `app/automacoes/editor/roteiro.ts`, `previa.tsx`
- Test: `tests/editor-roteiro.test.ts`

`roteiro.ts` é puro e tem teste. **Toda a decisão desta tarefa vai para lá.**

- [ ] **Passo 1: escreva os testes que falham**

`roteiro` passa a receber as ligações e o bloco selecionado, e devolve as cenas
do **caminho que leva até ele**, seguindo dali.

Cubra quatro casos:

- caminho até um bloco de um braço
- **bloco de junção**: o caminho mostrado é o do **primeiro braço** que chega
  até ele, em ordem de ligação. Escolha arbitrária, e é por isso que precisa
  estar fixada em teste: sem a regra escrita, a prévia trocaria de braço sozinha
  conforme o dado fosse reordenado, e o dono veria a conversa mudar sem ter
  mexido em nada
- nenhum bloco selecionado: o caminho a partir de `steps[0]`
- bloco solto: só ele, sem tronco

- [ ] **Passo 2: rode e confirme que falha**

- [ ] **Passo 3: implemente a busca do caminho**

Achar o caminho até um bloco num grafo com ciclos precisa de visitados — o mesmo
cuidado da Tarefa 2. **Sem ele, um menu que volta para si mesmo trava a tela.**

- [ ] **Passo 4: a prévia mostra o botão escolhido**

Num bloco de menu, a prévia desenha os botões, e o do braço que está sendo
mostrado aparece marcado — é o que liga o que a pessoa está editando ao que ela
vê.

- [ ] **Passo 5: confira à mão e reporte**

- clicar num bloco de um braço mostra o caminho até ele
- clicar noutro braço troca a conversa mostrada
- um menu que volta para si mesmo **não** trava a tela
- bloco solto mostra só ele

- [ ] **Passo 6: verify e commit**

```
npm run lint && npm run typecheck && npx vitest run
git add app/automacoes/editor/ tests/editor-roteiro.test.ts
git commit -m "A previa mostra o caminho que leva ate o bloco selecionado"
```

---

## Depois do plano

**Revisão da branch inteira**, no modelo mais capaz, com uma exigência que não é
opcional: **refazer a varredura exaustiva** que a revisão final da Fase 1b fez.
Ela simulou o motor sobre as funções puras e provou, em 43.476 casos, que nenhum
caminho entrega o link a quem não segue.

Com o grafo, o espaço cresce muito — e essa varredura passa a ser o único jeito
de manter a mesma prova. Sem ela, a garantia central do produto fica sem rede.

**No deploy**, o roteiro é o mesmo formato de
`docs/deploy/2026-08-06-editor-em-blocos.md`: push primeiro, script depois. Meça
o estado do banco antes, e não presuma.
