# O quadro — plano de implementação (Fase 1b)

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA — use
> `superpowers:subagent-driven-development` (recomendado) ou
> `superpowers:executing-plans`, tarefa a tarefa. Os passos usam caixinha
> (`- [ ]`) para acompanhamento.

**Objetivo:** trocar o formulário de 612 linhas por um quadro onde as
automações são montadas arrastando blocos ligados por setas.

**Arquitetura:** cada bloco ganha um `id` estável que passa a ser sua
identidade na chave de deduplicação e no cursor — hoje as duas usam a
**posição**, e é por isso que reordenar reenvia mensagem e editar pode pular o
portão de follow. A ordem de execução continua sendo o array `steps`: arrastar
pelo quadro muda só a posição visual. Toda decisão vai para `lib/steps.ts`
(puro, sem imports, testado); o quadro é montagem e gesto.

**Tecnologia:** Next.js 16.2.10, React 19.2.4, `@xyflow/react` 12.11.2 (React
Flow), Tailwind, Vitest.

**Spec:** `docs/specs/2026-08-06-editor-em-blocos.md`

## Restrições globais

- **`lib/steps.ts` não tem NENHUM import.** Nem de tipo, nem de biblioteca.
  Confira com `grep -c "^import\|require(" lib/steps.ts` ao terminar de mexer
  nele — tem que dar 0. É o que o mantém testável, e a Fase 1a mediu que é o
  único arquivo do fluxo que nunca deu defeito.
- **A suíte só testa função pura.** Sem banco, sem mock, sem teste de
  componente. Não introduza nenhum dos três.
- **Este Next.js não é o que você conhece.** Antes de escrever qualquer código
  específico de Next, leia o guia correspondente em `node_modules/next/dist/docs/`.
  Respeite os avisos de descontinuação.
- **Comentários e mensagens de commit em português**, sem acentos nas mensagens
  de commit (o repositório é consistente nisso). Sem menção a agente ou
  ferramenta.
- **Nada de `ADMIN_PASSWORD`**: não leia, não imprima, não use, e não gere
  cookie de sessão. `DATABASE_URL` pode usar, só leitura.
- **Formato de `passoKey`:** `passo:<automação>:<pessoa>:<identidade>:<dia>`.
  A `<identidade>` muda de índice para id, mas **o formato da string não
  muda** — chave antiga continua sendo produzida igual para bloco sem id.
- **Verificação:** `npm run verify` (lint + typecheck + test + build) tem que
  passar ao fim de cada tarefa. Reporte a saída real, nunca "deve passar".

---

## Estrutura de arquivos

**Modificados:**

| arquivo | responsabilidade nova |
|---|---|
| `lib/steps.ts` | `identidadeDoPasso`, `indiceDoId`, `lerPayload`, `conferirLista`; cursor por id nas três funções de retomada |
| `lib/dedupe.ts` | `passoKey` recebe identidade (string) em vez de índice |
| `lib/db.ts` | coluna `flow_step_id text` |
| `lib/engine.ts` | usa as funções acima; grava/lê cursor por id; emite payload com id do bloco |
| `app/automacoes/actions.ts` | `salvarPassos` (Server Action nova); `montarPassos` emite ids |
| `app/automacoes/nova/page.tsx`, `[id]/page.tsx` | montam o quadro no lugar do formulário |

**Criados:**

| arquivo | responsabilidade |
|---|---|
| `app/automacoes/editor/quadro.tsx` | React Flow, estado `Passo[]`, salvar |
| `app/automacoes/editor/no.tsx` | um nó: cabeçalho, resumo, alças |
| `app/automacoes/editor/paleta.tsx` | os oito itens arrastáveis |
| `app/automacoes/editor/painel.tsx` | campos do bloco selecionado + prévia |
| `app/automacoes/editor/gatilho.tsx` | o nó de gatilho |
| `app/automacoes/editor/modelos.ts` | bloco novo por item da paleta, geração de id, arranjo automático |
| `scripts/dar-ids-aos-passos.mjs` | migração única das listas existentes |

**Removido:** `app/automacoes/form.tsx` (na Tarefa 8, não antes).

**Reaproveitados sem mudança:** `phone-preview.tsx`, `variable-picker.tsx`,
`media-picker.tsx`, `types.ts`.

---

# Tarefa 1 · O bloco ganha identidade

**Arquivos:**
- Modificar: `lib/steps.ts` (tipo `Passo`, funções novas)
- Modificar: `lib/dedupe.ts:85` (`passoKey`)
- Modificar: `lib/engine.ts:619` (a chamada de `passoKey`)
- Modificar: `app/automacoes/actions.ts` (`montarPassos` emite ids)
- Criar: `scripts/dar-ids-aos-passos.mjs`
- Teste: `tests/steps.test.ts`, `tests/dedupe.test.ts`

**Interfaces produzidas** (as tarefas seguintes dependem destas assinaturas):

```ts
export function identidadeDoPasso(passo: unknown, indice: number): string
export function indiceDoId(passos: unknown, id: string): number | null
export function passoKey(
  automationId: string, contactIgId: string, identidade: string, bucket: string
): string
```

- [ ] **Passo 1: escreva os testes que falham**

Em `tests/steps.test.ts`, no fim do arquivo:

```ts
describe("identidade do passo", () => {
  // A identidade é o que entra na chave de deduplicação. Antes era o índice,
  // e por isso arrastar um bloco reenviava tudo que vinha depois dele.

  it("usa o id quando ele existe e tem a forma certa", () => {
    expect(identidadeDoPasso({ id: "b_7f3a91c2", tipo: "dm", texto: "oi" }, 5)).toBe("b_7f3a91c2");
  });

  it("cai no índice quando não há id — bloco gravado antes desta fase", () => {
    // Isto NÃO é tolerância a dado ruim: é o que faz a chave de um bloco
    // antigo continuar igual à que já está na fila, ou seja, é o que impede
    // o deploy de reenviar mensagem para quem já recebeu.
    expect(identidadeDoPasso({ tipo: "dm", texto: "oi" }, 5)).toBe("5");
  });

  it("recusa id com forma errada e cai no índice", () => {
    // Sem o prefixo `b_`, um id como "2" colidiria com a chave por índice de
    // OUTRO bloco. O formato é a defesa contra isso.
    expect(identidadeDoPasso({ id: "2", tipo: "dm", texto: "oi" }, 5)).toBe("5");
    expect(identidadeDoPasso({ id: "", tipo: "dm", texto: "oi" }, 5)).toBe("5");
    expect(identidadeDoPasso({ id: 7, tipo: "dm", texto: "oi" }, 5)).toBe("5");
  });

  it("passo que não é objeto cai no índice sem estourar", () => {
    expect(identidadeDoPasso(null, 3)).toBe("3");
    expect(identidadeDoPasso("x", 3)).toBe("3");
  });
});

describe("indiceDoId", () => {
  const lista = [
    { id: "b_aaa111", tipo: "dm", texto: "um" },
    { tipo: "dm", texto: "dois" },
    { id: "b_ccc333", tipo: "dm", texto: "três" },
  ];

  it("acha o bloco pelo id, esteja ele onde estiver", () => {
    expect(indiceDoId(lista, "b_ccc333")).toBe(2);
  });

  it("acha bloco antigo pela identidade por índice", () => {
    // O bloco do meio não tem id; a identidade dele é "1". Um cursor gravado
    // antes desta fase guarda exatamente isso.
    expect(indiceDoId(lista, "1")).toBe(1);
  });

  it("devolve null quando o bloco não existe mais — foi apagado", () => {
    expect(indiceDoId(lista, "b_zzz999")).toBe(null);
  });

  it("devolve null quando não é lista", () => {
    expect(indiceDoId(null, "b_aaa111")).toBe(null);
    expect(indiceDoId({}, "b_aaa111")).toBe(null);
  });
});
```

Em `tests/dedupe.test.ts`, dentro do `describe("passoKey", ...)`, **substitua**
os testes que passam número por estes:

```ts
  it("mantém o formato por automação, pessoa, IDENTIDADE e dia", () => {
    expect(passoKey("auto-1", "user-9", "b_7f3a91c2", "2026-07-28")).toBe(
      "passo:auto-1:user-9:b_7f3a91c2:2026-07-28"
    );
  });

  it("a chave de um bloco SEM id é byte a byte a mesma de antes", () => {
    // Este teste é o que garante que o deploy não reenvia: a fila já tem
    // linhas `passo:...:2:...` gravadas com o índice, e elas precisam
    // continuar casando.
    expect(passoKey("auto-1", "user-9", "2", "2026-07-28")).toBe(
      "passo:auto-1:user-9:2:2026-07-28"
    );
  });

  it("a identidade separa blocos da MESMA automação no mesmo dia", () => {
    expect(passoKey("auto-1", "user-9", "b_aaa111", "2026-07-28")).not.toBe(
      passoKey("auto-1", "user-9", "b_bbb222", "2026-07-28")
    );
  });

  it("o id sobrevive à reordenação — é o ponto desta fase", () => {
    // O mesmo bloco na posição 1 e depois na posição 4 produz a MESMA chave.
    // Com índice, produzia duas, e a mensagem saía de novo.
    const antes = passoKey("auto-1", "user-9", "b_7f3a91c2", "2026-07-28");
    const depois = passoKey("auto-1", "user-9", "b_7f3a91c2", "2026-07-28");
    expect(depois).toBe(antes);
  });
```

Acrescente `identidadeDoPasso` e `indiceDoId` aos imports de
`tests/steps.test.ts`.

- [ ] **Passo 2: rode e confirme que falha**

```
npx vitest run tests/steps.test.ts tests/dedupe.test.ts
```

Esperado: FAIL — `identidadeDoPasso is not a function`, e os de `passoKey` com
erro de tipo.

- [ ] **Passo 3: o tipo `Passo` aceita id**

Em `lib/steps.ts`, substitua a declaração do tipo:

```ts
// O `id` é a identidade do bloco, e ele é OPCIONAL de propósito.
//
// Obrigatório quebraria o que já está no banco: toda automação gravada antes
// da Fase 1b tem passos sem id, e `conferir` passaria a recusá-los — o que
// significa fluxo que não entrega nada, em silêncio. Opcional, o bloco antigo
// continua valendo e `identidadeDoPasso` lhe dá a identidade que ele sempre
// teve na prática: o índice.
type ComId = { id?: string };

export type Passo = ComId &
  (
    | { tipo: "resposta_publica"; textos: string[] }
    | { tipo: "dm"; texto: string; botao_label?: string; url?: string }
    | { tipo: "esperar"; minutos: number }
    | { tipo: "reagir_story"; emoji: string }
    | { tipo: "pedir_follow"; texto: string; botao_label: string }
    | { tipo: "pedir_email"; texto: string }
  );

// A posição no quadro é gravada junto, e NÃO participa de decisão nenhuma —
// nem de ordem, nem de validação, nem de execução. Quem define a ordem é o
// array. Isto está aqui só para o editor reabrir do jeito que foi deixado.
export type Posicao = { x: number; y: number };
```

- [ ] **Passo 4: as duas funções puras**

Em `lib/steps.ts`, logo depois de `conferir`:

```ts
// A forma do id, e por que ela é conferida em vez de aceita.
//
// A identidade entra na `dedupe_key`. Um id como "2" colidiria com a chave por
// índice de um OUTRO bloco — a chave é a mesma string —, e colisão em
// `dedupe_key` não dá erro: o `on conflict do nothing` engole o segundo item e
// a pessoa deixa de receber uma mensagem, sem nada aparecer em lugar nenhum.
// O prefixo `b_` torna isso impossível por construção.
const FORMA_DO_ID = /^b_[0-9a-z]{6,}$/;

// Quem este passo é, para efeito de deduplicação e de cursor.
//
// Com id, é o id: ele acompanha o bloco quando ele é arrastado, e é isso que
// faz reordenar deixar de reenviar mensagem.
//
// Sem id, é o índice — e isso não é remendo. Um bloco gravado antes da Fase 1b
// JÁ tem itens na fila com a chave por índice; devolver o índice é o que faz
// essas chaves continuarem casando. Se devolvesse outra coisa, o primeiro
// deploy reentregaria tudo que já saiu hoje.
export function identidadeDoPasso(passo: unknown, indice: number): string {
  const id = (passo as { id?: unknown } | null | undefined)?.id;
  return typeof id === "string" && FORMA_DO_ID.test(id) ? id : String(indice);
}

// Onde, na lista de hoje, está o bloco com esta identidade.
//
// Null quando ele não existe mais — o dono apagou aquele bloco. Repare que
// reordenar NÃO cai aqui: o bloco continua na lista, só mudou de lugar, e é
// justamente por isso que o cursor sobrevive à reordenação.
export function indiceDoId(passos: unknown, id: string): number | null {
  if (!Array.isArray(passos)) return null;
  for (let i = 0; i < passos.length; i++) {
    if (identidadeDoPasso(passos[i], i) === id) return i;
  }
  return null;
}
```

- [ ] **Passo 5: `passoKey` recebe identidade**

Em `lib/dedupe.ts`, substitua a função:

```ts
// Um passo por pessoa por dia. A IDENTIDADE do bloco entra na chave porque a
// mesma automação pode ter vários passos do mesmo tipo — dois lembretes, três
// DMs.
//
// Era o ÍNDICE, e a troca é o motivo da Fase 1b existir: arrastar um bloco
// mudava o índice de tudo que vinha depois dele, cada um virava chave nova, e
// a mensagem saía outra vez para quem já a tinha recebido. O id não muda de
// valor quando o bloco muda de lugar.
//
// O FORMATO da string não mudou, e isso é deliberado: para bloco sem id a
// identidade é o índice, então a chave sai idêntica à que já está gravada na
// fila. Sem isso, o deploy desta fase reentregaria o dia inteiro.
export function passoKey(
  automationId: string,
  contactIgId: string,
  identidade: string,
  bucket: string
): string {
  return `passo:${automationId}:${contactIgId}:${identidade}:${bucket}`;
}
```

- [ ] **Passo 6: o motor usa a identidade**

Em `lib/engine.ts`, acrescente `identidadeDoPasso` ao import de `./steps`
(bloco que começa na linha 20). Depois, na linha 619, troque:

```ts
        : passoKey(auto.id, contactIgId, acao.indice, dayBucket()),
```

por:

```ts
        : passoKey(
            auto.id,
            contactIgId,
            identidadeDoPasso(acao.passo, acao.indice),
            dayBucket()
          ),
```

- [ ] **Passo 7: rode e confirme que passa**

```
npx vitest run
```

Esperado: PASS, com os testes novos somando aos 202 existentes.

- [ ] **Passo 8: `montarPassos` passa a emitir ids**

Em `app/automacoes/actions.ts`, acrescente antes de `montarPassos`:

```ts
// Gera o id de um bloco novo.
//
// Curto de propósito: ele entra na `dedupe_key`, que é uma coluna UNIQUE
// consultada a cada envio. Aleatoriedade suficiente para não colidir dentro de
// UMA automação, que é o único escopo em que ele precisa ser único — tudo que
// o consome já é qualificado pelo id da automação.
//
// O prefixo `b_` é obrigatório: `identidadeDoPasso` (lib/steps.ts) recusa id
// sem ele, e o motivo está escrito lá.
export function novoIdDeBloco(): string {
  return "b_" + Math.random().toString(36).slice(2, 10);
}
```

E em `montarPassos`, ponha `id: novoIdDeBloco()` em **cada** objeto empurrado
para `passos`. Exemplo do primeiro:

```ts
  if (f.triggers.includes("story") && f.storyReaction) {
    passos.push({ id: novoIdDeBloco(), tipo: "reagir_story", emoji: f.storyReaction });
  }
```

Faça o mesmo nos outros seis pontos de `passos.push` da função.

> **Atenção, e isto é consequência real:** `montarPassos` roda a cada salvamento
> do formulário e gera ids **novos** toda vez. Ou seja, salvar pelo formulário
> antigo reescreve a identidade de todos os blocos. Enquanto o formulário
> existir (até a Tarefa 8), salvar uma automação pode reenviar as mensagens do
> dia para quem já as recebeu. É aceitável porque é a janela entre esta tarefa e
> a 8, e porque o quadro — que preserva os ids — a fecha. **Não tente resolver
> isso aqui:** casar bloco novo com bloco antigo por conteúdo é adivinhação, e a
> Tarefa 8 apaga o formulário de qualquer forma.

- [ ] **Passo 9: o script de migração**

Crie `scripts/dar-ids-aos-passos.mjs`:

```js
// Dá id a todo bloco de toda automação que ainda não tem.
//
// Roda UMA vez, antes do deploy da Fase 1b. Sem ele, as automações existentes
// continuam identificadas por índice: funcionam, mas reordenar no quadro novo
// reenviaria mensagem — exatamente o defeito que esta fase existe para matar.
//
// Preserva a ordem e todo o resto do objeto: só acrescenta o campo `id` onde
// falta. Idempotente — rodar duas vezes não muda nada na segunda.
import postgres from "postgres";
import { readFileSync } from "node:fs";

const env = readFileSync(".env.local", "utf8");
const url = env.match(/^DATABASE_URL=(.*)$/m)[1].trim().replace(/^["']|["']$/g, "");
const sql = postgres(url, { prepare: false, ssl: "require", onnotice: () => {} });

const novoId = () => "b_" + Math.random().toString(36).slice(2, 10);
const temId = (p) => p && typeof p === "object" && /^b_[0-9a-z]{6,}$/.test(p.id ?? "");

const linhas = await sql`select id, name, steps from automations`;
let mexidas = 0;

for (const a of linhas) {
  const passos = Array.isArray(a.steps) ? a.steps : [];
  const faltando = passos.filter((p) => !temId(p)).length;
  if (!faltando) {
    console.log(`  ok   ${a.name} — ${passos.length} blocos, todos com id`);
    continue;
  }
  const novos = passos.map((p) => (temId(p) ? p : { ...p, id: novoId() }));
  await sql`update automations set steps = ${sql.json(novos)} where id = ${a.id}`;
  console.log(`  ►    ${a.name} — ${faltando} de ${passos.length} blocos ganharam id`);
  mexidas++;
}

console.log(`\n${mexidas} automação(ões) alterada(s) de ${linhas.length}.`);
await sql.end();
```

- [ ] **Passo 10: rode a migração e confira o resultado**

```
node scripts/dar-ids-aos-passos.mjs
node scripts/dar-ids-aos-passos.mjs
```

Esperado: a primeira execução mostra `►` para a automação existente; a
**segunda** mostra `ok` para todas e `0 automação(ões) alterada(s)`. Se a
segunda ainda alterar alguma coisa, o script não é idempotente — pare e
investigue antes de seguir.

- [ ] **Passo 11: verify e commit**

```
npm run verify
git add lib/steps.ts lib/dedupe.ts lib/engine.ts app/automacoes/actions.ts scripts/dar-ids-aos-passos.mjs tests/
git commit -m "O bloco ganha identidade propria, e a chave deixa de usar a posicao"
```

---

# Tarefa 2 · O cursor guarda o bloco, não a posição

**Arquivos:**
- Modificar: `lib/db.ts:395` (DDL) e o tipo `Contact` (linha ~211)
- Modificar: `lib/steps.ts` (`cursorDesta`, `retomadaDoBotao`, `retomadaDoFollow`)
- Modificar: `lib/engine.ts:471-542` (`gravarCursor`, `limparCursor`, `lerCursor`) e as chamadas
- Teste: `tests/steps.test.ts`

**Interfaces consumidas:** `indiceDoId`, `identidadeDoPasso` (Tarefa 1).

**Interfaces produzidas:**

```ts
export type Cursor = { passoId: string | null; automationId: string | null };
export function cursorDesta(cursor: Cursor, automationId: string): string | null
export function retomadaDoBotao(cursor: Cursor, automationId: string, passos: unknown): number
export function retomadaDoFollow(cursor: Cursor, automationId: string, passos: unknown): number
```

- [ ] **Passo 1: escreva os testes que falham**

Em `tests/steps.test.ts`, **substitua** os `describe` de `cursorDesta`,
`retomadaDoBotao` e `retomadaDoFollow` por estes:

```ts
describe("cursorDesta", () => {
  it("devolve o id do bloco quando o cursor é desta automação", () => {
    expect(cursorDesta({ passoId: "b_aaa111", automationId: "A" }, "A")).toBe("b_aaa111");
  });

  it("devolve null quando o cursor é de OUTRA automação", () => {
    // Aplicar o cursor de B à lista de A já entregou o link a quem não segue.
    expect(cursorDesta({ passoId: "b_aaa111", automationId: "B" }, "A")).toBe(null);
  });

  it("devolve null quando não há cursor", () => {
    expect(cursorDesta({ passoId: null, automationId: "A" }, "A")).toBe(null);
    expect(cursorDesta({ passoId: null, automationId: null }, "A")).toBe(null);
  });
});

describe("retomadaDoBotao", () => {
  const lista = [
    { id: "b_bem001", tipo: "dm", texto: "Oi!", botao_label: "Quero" },
    { id: "b_por002", tipo: "pedir_follow", texto: "Me segue", botao_label: "Já sigo" },
    { id: "b_lnk003", tipo: "dm", texto: "Link", url: "https://x.com", botao_label: "Abrir" },
  ];

  it("cursor numa dm de resposta rápida retoma do SEGUINTE — o toque É a resposta", () => {
    expect(retomadaDoBotao({ passoId: "b_bem001", automationId: "A" }, "A", lista)).toBe(1);
  });

  it("cursor num PORTÃO retoma DELE — o toque não entrega o follow", () => {
    // Sem isto, tocar no botão antigo da boas-vindas pulava o portão e o link
    // saía para quem não segue.
    expect(retomadaDoBotao({ passoId: "b_por002", automationId: "A" }, "A", lista)).toBe(1);
  });

  it("o id sobrevive à REORDENAÇÃO — é o ponto desta fase", () => {
    // Mesma lista, ordem trocada: o cursor continua achando o portão, agora
    // no índice 2. Com índice, ele apontaria para o bloco errado.
    const trocada = [lista[0], lista[2], lista[1]];
    expect(retomadaDoBotao({ passoId: "b_por002", automationId: "A" }, "A", trocada)).toBe(2);
  });

  it("cursor de outra automação retoma do zero", () => {
    expect(retomadaDoBotao({ passoId: "b_bem001", automationId: "B" }, "A", lista)).toBe(0);
  });

  it("bloco APAGADO retoma do zero", () => {
    // Agora só acontece quando o dono apaga aquele bloco de verdade. Antes
    // acontecia a cada edição que mexesse no começo da lista.
    expect(retomadaDoBotao({ passoId: "b_sumiu9", automationId: "A" }, "A", lista)).toBe(0);
  });

  it("cursor por índice, gravado antes desta fase, continua funcionando", () => {
    // Lista sem ids e cursor "0": a identidade do primeiro bloco é "0".
    const antiga = [{ tipo: "dm", texto: "Oi!", botao_label: "Quero" }, { tipo: "dm", texto: "Link", url: "https://x.com" }];
    expect(retomadaDoBotao({ passoId: "0", automationId: "A" }, "A", antiga)).toBe(1);
  });
});

describe("retomadaDoFollow", () => {
  const lista = [
    { id: "b_bem001", tipo: "dm", texto: "Oi!", botao_label: "Quero" },
    { id: "b_por002", tipo: "pedir_follow", texto: "Me segue", botao_label: "Já sigo" },
    { id: "b_lnk003", tipo: "dm", texto: "Link", url: "https://x.com" },
  ];

  it("cursor desta automação retoma DELE, para o portão ser reavaliado", () => {
    expect(retomadaDoFollow({ passoId: "b_por002", automationId: "A" }, "A", lista)).toBe(1);
  });

  it("sem cursor desta, retoma do PORTÃO — o toque afirma onde a pessoa está", () => {
    expect(retomadaDoFollow({ passoId: null, automationId: null }, "A", lista)).toBe(1);
    expect(retomadaDoFollow({ passoId: "b_bem001", automationId: "B" }, "A", lista)).toBe(1);
  });

  it("lista sem portão nenhum retoma do zero", () => {
    const semPortao = [{ id: "b_bem001", tipo: "dm", texto: "Oi!", botao_label: "Quero" }];
    expect(retomadaDoFollow({ passoId: null, automationId: null }, "A", semPortao)).toBe(0);
  });
});
```

- [ ] **Passo 2: rode e confirme que falha**

```
npx vitest run tests/steps.test.ts
```

Esperado: FAIL por incompatibilidade de tipo — as funções ainda recebem
`{ indice }`.

- [ ] **Passo 3: as três funções puras passam a falar em id**

Em `lib/steps.ts`, acrescente o tipo e substitua as três funções. **Preserve os
blocos de comentário que já existem** — eles carregam o porquê de cada ramo, e
foram escritos depois de o ramo errar. Só ajuste onde o texto fala em "índice
do cursor" para falar em "bloco do cursor", e acrescente o parágrafo do cursor
obsoleto indicado abaixo.

```ts
// O cursor, como ele sai do banco: qual bloco e de qual automação.
//
// Recebe os dois porque um sem o outro não quer dizer nada — o id é único
// dentro de UMA automação, e o mesmo id pode existir em outra.
export type Cursor = { passoId: string | null; automationId: string | null };

export function cursorDesta(cursor: Cursor, automationId: string): string | null {
  return cursor.automationId === automationId ? cursor.passoId : null;
}

export function retomadaDoBotao(
  cursor: Cursor,
  automationId: string,
  passos: unknown
): number {
  const id = cursorDesta(cursor, automationId);
  if (id === null) return 0;
  const indice = indiceDoId(passos, id);
  // Bloco apagado. Antes desta fase o equivalente era "índice obsoleto", que
  // caía no `+1`; agora não há índice em que somar, e o zero é o único ponto
  // afirmável — o mesmo raciocínio do cursor nulo, logo acima.
  //
  // A diferença que importa: isto ficou RARO. Com índice, toda edição que
  // mexesse no começo da lista tornava o cursor obsoleto. Com id, só apagar
  // aquele bloco específico.
  if (indice === null) return 0;
  const tipo = passoEsperado(passos, indice)?.tipo;
  return tipo === "pedir_follow" || tipo === "pedir_email" ? indice : indice + 1;
}

export function retomadaDoFollow(
  cursor: Cursor,
  automationId: string,
  passos: unknown
): number {
  const id = cursorDesta(cursor, automationId);
  const indice = id === null ? null : indiceDoId(passos, id);
  return indice ?? indiceDoPortao(passos) ?? 0;
}
```

- [ ] **Passo 4: rode e confirme que passa**

```
npx vitest run tests/steps.test.ts
```

Esperado: PASS.

- [ ] **Passo 5: a coluna nova**

Em `lib/db.ts`, no fim do array de DDL (depois da linha 395), acrescente:

```ts
  // Em QUAL BLOCO desta pessoa o fluxo parou. Substitui `flow_step_index`, que
  // guardava a posição — e posição muda quando o dono reordena ou apaga um
  // bloco antes dele, fazendo o cursor apontar para outro passo. Já chegou a
  // apontar para DEPOIS do portão de follow, entregando o link a quem não
  // segue, em silêncio.
  //
  // `flow_step_index` NÃO é apagada aqui. Ela sai junto com as outras colunas
  // órfãs; apagar no mesmo deploy tira o caminho de volta. Enquanto existir,
  // `lerCursor` a usa como reserva para quem foi gravado antes desta fase.
  `alter table contacts add column if not exists flow_step_id text`,
```

E no tipo `Contact` (linha ~211), acrescente `flow_step_id: string | null;`.

- [ ] **Passo 6: o motor grava e lê por id**

Em `lib/engine.ts`, substitua as três funções (linhas 471-542). **Preserve o
bloco de comentário longo de `lerCursor`** — ele descreve os dois estragos do
cursor emprestado e o que continua de pé. Acrescente a ele o parágrafo da
reserva, abaixo.

```ts
async function gravarCursor(
  accountId: string,
  contactIgId: string,
  automationId: string,
  passoId: string
) {
  await sql().query(
    `update contacts set flow_step_id = $3, flow_step_index = null, last_automation_id = $4
     where account_id = $1 and ig_id = $2`,
    [accountId, contactIgId, passoId, automationId]
  );
}

async function limparCursor(accountId: string, contactIgId: string) {
  await sql().query(
    `update contacts set flow_step_id = null, flow_step_index = null
     where account_id = $1 and ig_id = $2`,
    [accountId, contactIgId]
  );
}

async function lerCursor(accountId: string, contactIgId: string): Promise<Cursor> {
  const rows = (await sql().query(
    `select flow_step_id, flow_step_index, last_automation_id from contacts
     where account_id = $1 and ig_id = $2`,
    [accountId, contactIgId]
  )) as {
    flow_step_id: string | null;
    flow_step_index: number | null;
    last_automation_id: string | null;
  }[];
  const r = rows[0];
  // A coluna velha é RESERVA, não alternativa: quem foi gravado antes desta
  // fase tem só `flow_step_index`, e a identidade de um bloco sem id é
  // justamente o índice em texto (`identidadeDoPasso`, lib/steps.ts). Então o
  // valor antigo já está na forma certa — não precisa de conversão, precisa de
  // `String()`. `gravarCursor` zera a coluna velha ao escrever a nova, para as
  // duas nunca discordarem.
  return {
    passoId: r?.flow_step_id ?? (r?.flow_step_index != null ? String(r.flow_step_index) : null),
    automationId: r?.last_automation_id ?? null,
  };
}
```

Acrescente `Cursor` e `identidadeDoPasso` ao import de `./steps` em
`lib/engine.ts`.

- [ ] **Passo 7: as chamadas de `gravarCursor` passam a mandar id**

São três, e todas hoje mandam um índice. Em cada uma, troque o índice pela
identidade do passo naquele índice:

Linha ~374 (portão de follow que não passou):
```ts
      await gravarCursor(
        account.ig_user_id, contactIgId, auto.id,
        identidadeDoPasso(p, acao.indice)
      );
```

Linha ~403 (pedido de e-mail enfileirado): idem, com `identidadeDoPasso(p, acao.indice)`.

Linha ~415 (`r.pararEm`): aqui só existe o índice, então busque o passo:
```ts
  if (r.pararEm !== null) {
    await gravarCursor(
      account.ig_user_id, contactIgId, auto.id,
      identidadeDoPasso((auto.steps as unknown[])[r.pararEm], r.pararEm)
    );
    return;
  }
```

- [ ] **Passo 8: o ramo de texto lê o cursor pela função**

Em `lib/engine.ts` na linha ~908 há uma consulta solta que lê
`flow_step_index, last_automation_id` direto. Ela duplica `lerCursor` e agora
divergiria dela. Substitua o bloco por:

```ts
  const cursor = await lerCursor(account.ig_user_id, senderId);
  const idParado = cursor.passoId;
  if (idParado !== null) {
    const autoParada = cursor.automationId
      ? await loadAutomation(account.ig_user_id, cursor.automationId)
      : undefined;
```

E adiante, onde o código usa `indiceParado`, obtenha o índice uma vez:

```ts
      const indiceParado = indiceDoId(autoParada.steps, idParado);
      // Bloco apagado depois de o cursor ser gravado: não há passo para
      // retomar, então o cursor sai da frente e o evento segue o fluxo normal.
      if (indiceParado === null) {
        await limparCursor(account.ig_user_id, senderId);
      } else {
        const passo = passoEsperado(autoParada.steps, indiceParado);
        // ... o resto do ramo continua igual, usando `indiceParado`
```

> Leia o ramo inteiro antes de mexer. Ele tem quatro saídas e cada uma tem
> comentário explicando por quê; **preserve todos**. Se alguma condição deixar
> de fazer sentido com id, pare e reporte em vez de adivinhar.

- [ ] **Passo 9: verify**

```
npm run verify
```

Esperado: exit 0, testes passando.

- [ ] **Passo 10: confira o banco de verdade**

```
node -e "
const fs=require('fs');const env=fs.readFileSync('.env.local','utf8');
const url=env.match(/^DATABASE_URL=(.*)\$/m)[1].trim().replace(/^[\"']|[\"']\$/g,'');
const sql=require('postgres')(url,{prepare:false,ssl:'require',onnotice:()=>{}});
(async()=>{
  const c=await sql\`select column_name from information_schema.columns where table_name='contacts' and column_name like 'flow_step%'\`;
  console.log('colunas:', c.map(x=>x.column_name).join(', '));
  const n=await sql\`select count(*) as n from contacts where flow_step_id is not null or flow_step_index is not null\`;
  console.log('contatos com cursor:', n[0].n);
  await sql.end();
})();
"
```

Esperado: as duas colunas presentes. Anote o número de contatos com cursor — a
Tarefa 8 precisa dele no deploy.

- [ ] **Passo 11: commit**

```
git add lib/db.ts lib/steps.ts lib/engine.ts tests/steps.test.ts
git commit -m "O cursor passa a guardar o bloco, e nao a posicao dele na lista"
```

---

# Tarefa 3 · O botão diz de qual bloco veio

**Arquivos:**
- Modificar: `lib/steps.ts` (`lerPayload`)
- Modificar: `lib/engine.ts:609, 750, 869-893`
- Teste: `tests/steps.test.ts`

**Interfaces produzidas:**

```ts
export type Payload = {
  prefixo: "AUTO" | "FOLLOW";
  automationId: string;
  passoId: string | null;
};
export function lerPayload(payload: unknown): Payload | null
```

- [ ] **Passo 1: escreva os testes que falham**

```ts
describe("lerPayload", () => {
  // Um botão já entregue vive na conversa da pessoa PARA SEMPRE — ela pode
  // tocar nele daqui a um mês. Por isso as duas formas convivem, e isto não é
  // dívida a limpar: é a forma final.

  it("lê a forma nova, com o bloco", () => {
    expect(lerPayload("AUTO:auto-1:b_7f3a91c2")).toEqual({
      prefixo: "AUTO", automationId: "auto-1", passoId: "b_7f3a91c2",
    });
  });

  it("lê a forma ANTIGA, sem o bloco — botão entregue antes da Fase 1b", () => {
    expect(lerPayload("AUTO:auto-1")).toEqual({
      prefixo: "AUTO", automationId: "auto-1", passoId: null,
    });
  });

  it("vale para o FOLLOW nas duas formas", () => {
    expect(lerPayload("FOLLOW:auto-1:b_por002")).toEqual({
      prefixo: "FOLLOW", automationId: "auto-1", passoId: "b_por002",
    });
    expect(lerPayload("FOLLOW:auto-1")).toEqual({
      prefixo: "FOLLOW", automationId: "auto-1", passoId: null,
    });
  });

  it("o id da automação é um uuid, que tem hífen mas não dois-pontos", () => {
    expect(lerPayload("AUTO:39ae24ec-c487-40ff-a387-c041cb3f0d23:b_aaa111")).toEqual({
      prefixo: "AUTO",
      automationId: "39ae24ec-c487-40ff-a387-c041cb3f0d23",
      passoId: "b_aaa111",
    });
  });

  it("devolve null para o que não é payload nosso", () => {
    // O webhook aceita o que a Meta mandar, e a Meta aceita o que o cliente
    // mandar. Nada aqui pode estourar.
    expect(lerPayload("OUTRACOISA:x")).toBe(null);
    expect(lerPayload("AUTO:")).toBe(null);
    expect(lerPayload("AUTO")).toBe(null);
    expect(lerPayload("")).toBe(null);
    expect(lerPayload(null)).toBe(null);
    expect(lerPayload(42)).toBe(null);
    expect(lerPayload("AUTO:a:b:c")).toBe(null);
  });
});
```

- [ ] **Passo 2: rode e confirme que falha**

```
npx vitest run tests/steps.test.ts
```

Esperado: FAIL — `lerPayload is not a function`.

- [ ] **Passo 3: implemente**

Em `lib/steps.ts`:

```ts
export type Payload = {
  prefixo: "AUTO" | "FOLLOW";
  automationId: string;
  passoId: string | null;
};

// Lê o payload de um botão de resposta rápida.
//
// DUAS FORMAS, e as duas são finais:
//
//   `AUTO:<automação>`            entregue antes da Fase 1b
//   `AUTO:<automação>:<bloco>`    entregue a partir dela
//
// A forma antiga NÃO é dívida a limpar. Um botão entregue vive na conversa da
// pessoa indefinidamente, e ela pode tocar nele meses depois — apagar este ramo
// quebraria todo botão já enviado, de uma vez, e o sintoma seria "o botão não
// faz mais nada" sem erro nenhum em lugar algum.
//
// Devolve null para qualquer outra coisa, e isso é obrigatório: o webhook
// recebe o que a Meta manda, e a Meta manda o que o cliente digitou.
export function lerPayload(payload: unknown): Payload | null {
  if (typeof payload !== "string") return null;
  const partes = payload.split(":");
  if (partes.length < 2 || partes.length > 3) return null;
  const [prefixo, automationId, passoId] = partes;
  if (prefixo !== "AUTO" && prefixo !== "FOLLOW") return null;
  if (!automationId) return null;
  if (partes.length === 3 && !passoId) return null;
  return { prefixo, automationId, passoId: passoId ?? null };
}
```

- [ ] **Passo 4: rode e confirme que passa**

```
npx vitest run tests/steps.test.ts
```

- [ ] **Passo 5: o motor emite a forma nova**

Em `lib/engine.ts` linha ~609:

```ts
          quick_reply_payload: `AUTO:${auto.id}:${identidadeDoPasso(p, acao.indice)}`,
```

Em `lib/engine.ts` linha ~750 (dentro de `resolverFollow`, que recebe `indice`):

```ts
        quick_reply_payload: `FOLLOW:${auto.id}:${identidadeDoPasso(passo, indice)}`,
```

- [ ] **Passo 6: o motor lê as duas formas**

Substitua o bloco das linhas 867-895:

```ts
  if (isQuickReply) {
    const p = lerPayload(msg.quick_reply!.payload);
    if (p) {
      const auto = await loadAutomation(account.ig_user_id, p.automationId);
      if (auto) {
        // O bloco vem do PAYLOAD quando ele o traz, e do cursor quando não.
        //
        // O do payload é melhor: ele diz de qual botão a pessoa tocou, e o
        // cursor diz só onde ela parou. Quando ela tem dois botões antigos na
        // conversa, os dois são tocáveis e só o payload distingue.
        const cursor = p.passoId
          ? { passoId: p.passoId, automationId: auto.id }
          : await lerCursor(account.ig_user_id, senderId);
        const de =
          p.prefixo === "AUTO"
            ? retomadaDoBotao(cursor, auto.id, auto.steps)
            : retomadaDoFollow(cursor, auto.id, auto.steps);
        await executarFluxo(account, auto, senderId, de);
      }
    }
    return;
  }
```

> **Confira você mesmo antes de dar por pronto:** com o payload trazendo o
> bloco, `retomadaDoBotao` recebe um cursor que é sempre "desta automação".
> Percorra os casos — botão de boas-vindas tocado por quem está no portão,
> botão de portão tocado por quem já terminou, botão de bloco apagado — e diga
> o que encontrou, mesmo que atrapalhe.

- [ ] **Passo 7: verify e commit**

```
npm run verify
git add lib/steps.ts lib/engine.ts tests/steps.test.ts
git commit -m "O botao passa a dizer de qual bloco veio, sem quebrar os ja entregues"
```

---

# Tarefa 4 · A validação da lista

**Arquivos:**
- Modificar: `lib/steps.ts`
- Teste: `tests/steps.test.ts`

**Interfaces produzidas:**

```ts
export type Problema = {
  nivel: "erro" | "aviso";
  indice: number | null;
  mensagem: string;
};
export function conferirLista(passos: unknown, gatilho: string): Problema[]
```

- [ ] **Passo 1: escreva os testes que falham**

```ts
describe("conferirLista", () => {
  const bem = { id: "b_bem001", tipo: "dm", texto: "Oi!", botao_label: "Quero" };
  const portao = { id: "b_por002", tipo: "pedir_follow", texto: "Me segue", botao_label: "Já sigo" };
  const link = { id: "b_lnk003", tipo: "dm", texto: "Link", url: "https://x.com", botao_label: "Abrir" };

  const erros = (ps, g = "dm") => conferirLista(ps, g).filter((p) => p.nivel === "erro");
  const avisos = (ps, g = "dm") => conferirLista(ps, g).filter((p) => p.nivel === "aviso");

  it("lista boa não tem problema nenhum", () => {
    expect(conferirLista([bem, portao, link], "dm")).toEqual([]);
  });

  it("ERRO: lista vazia entrega zero", () => {
    expect(erros([])).toHaveLength(1);
    expect(erros([])[0].indice).toBe(null);
  });

  it("ERRO: o que não é lista", () => {
    expect(erros(null)).toHaveLength(1);
  });

  it("ERRO: bloco com campo obrigatório vazio, apontando o bloco", () => {
    const r = erros([bem, { id: "b_vaz004", tipo: "dm", texto: "  " }]);
    expect(r).toHaveLength(1);
    expect(r[0].indice).toBe(1);
  });

  it("ERRO: bloco que não pode disparar naquele gatilho", () => {
    const coracao = { id: "b_cor005", tipo: "reagir_story", emoji: "❤️" };
    expect(erros([bem, coracao], "dm")).toHaveLength(1);
    expect(erros([bem, coracao], "story")).toHaveLength(0);

    const publica = { id: "b_pub006", tipo: "resposta_publica", textos: ["oi"] };
    expect(erros([publica, bem], "dm")).toHaveLength(1);
    expect(erros([publica, bem], "comment")).toHaveLength(0);
  });

  it("ERRO: dois portões de follow", () => {
    const outro = { id: "b_por007", tipo: "pedir_follow", texto: "De novo", botao_label: "Sigo" };
    const r = erros([bem, portao, outro]);
    expect(r).toHaveLength(1);
    expect(r[0].indice).toBe(2);
  });

  it("AVISO, não erro: link antes do portão", () => {
    // Pode ser engano, pode ser estratégia — entregar primeiro e pedir follow
    // depois. Quem decide é o dono.
    const r = conferirLista([bem, link, portao], "dm");
    expect(r.filter((p) => p.nivel === "erro")).toHaveLength(0);
    expect(r.filter((p) => p.nivel === "aviso")).toHaveLength(1);
  });

  it("AVISO: espera no fim da lista não atrasa nada", () => {
    const esperar = { id: "b_esp008", tipo: "esperar", minutos: 5 };
    expect(avisos([bem, portao, link, esperar])).toHaveLength(1);
    expect(avisos([bem, esperar, link])).toHaveLength(0);
  });

  it("acumula vários problemas em vez de parar no primeiro", () => {
    const quebrado = { id: "b_vaz009", tipo: "dm", texto: "" };
    const outroQuebrado = { id: "b_vaz010", tipo: "pedir_email", texto: "" };
    expect(erros([quebrado, outroQuebrado])).toHaveLength(2);
  });
});
```

- [ ] **Passo 2: rode e confirme que falha**

```
npx vitest run tests/steps.test.ts
```

- [ ] **Passo 3: implemente**

Em `lib/steps.ts`:

```ts
export type Problema = {
  nivel: "erro" | "aviso";
  // Qual bloco. Null quando o problema é da lista inteira.
  indice: number | null;
  mensagem: string;
};

// Confere a lista montada no quadro.
//
// Roda em DOIS lugares: no navegador, para desabilitar o salvar e dizer por
// quê; e no Server Action, porque nada vindo do navegador é confiável. É por
// isso que ela mora aqui e é pura — escrever a regra duas vezes é como as duas
// versões passam a discordar.
//
// ERRO trava o salvar; AVISO explica e deixa passar. A linha entre os dois foi
// decidida com o dono do produto: trava o que o motor não consegue executar
// como montado, e avisa o que é incomum mas coerente.
export function conferirLista(passos: unknown, gatilho: string): Problema[] {
  const r: Problema[] = [];

  if (!Array.isArray(passos)) {
    return [{ nivel: "erro", indice: null, mensagem: "A automação não tem lista de blocos." }];
  }
  if (!passos.length) {
    return [{ nivel: "erro", indice: null, mensagem: "Sem nenhum bloco, a automação não envia nada." }];
  }

  let portoes = 0;
  let linkAntesDoPortao = false;
  let jaTevePortao = false;

  for (let i = 0; i < passos.length; i++) {
    const { passo, motivo } = conferir(passos[i]);

    // Bloco inválido é ignorado pelo interpretador — quem montou acha que
    // mandou e não mandou. É a falha mais silenciosa que existe aqui.
    if (!passo) {
      r.push({ nivel: "erro", indice: i, mensagem: `Bloco incompleto: ${motivo}.` });
      continue;
    }

    // Bloco que não pode disparar naquele gatilho nunca roda. A paleta não o
    // oferece, mas lista vinda de fora do editor pode trazê-lo.
    if (passo.tipo === "reagir_story" && gatilho !== "story") {
      r.push({ nivel: "erro", indice: i, mensagem: "O coraçãozinho só funciona no gatilho de story." });
    }
    if (passo.tipo === "resposta_publica" && gatilho !== "comment") {
      r.push({ nivel: "erro", indice: i, mensagem: "A resposta pública só funciona no gatilho de comentário." });
    }

    if (passo.tipo === "pedir_follow") {
      portoes++;
      if (portoes > 1) {
        r.push({
          nivel: "erro",
          indice: i,
          mensagem:
            "Só pode haver um pedido de follow. Com dois, o botão “Já sigo!” não sabe a qual voltar.",
        });
      }
      jaTevePortao = true;
    }

    if (passo.tipo === "dm" && passo.url && !jaTevePortao) linkAntesDoPortao = true;
  }

  if (linkAntesDoPortao && portoes > 0) {
    r.push({
      nivel: "aviso",
      indice: null,
      mensagem:
        "O link sai antes do pedido de follow, então quem não segue recebe o link mesmo assim. O portão só segura o que vier depois dele.",
    });
  }

  const ultimo = conferir(passos[passos.length - 1]).passo;
  if (ultimo?.tipo === "esperar") {
    r.push({
      nivel: "aviso",
      indice: passos.length - 1,
      mensagem: "Não há nenhum bloco depois desta espera, então ela não atrasa nada.",
    });
  }

  return r;
}
```

- [ ] **Passo 4: rode, confirme que passa, e confirme que `lib/steps.ts` continua sem import**

```
npx vitest run
grep -c "^import\|require(" lib/steps.ts
```

Esperado: PASS, e o grep devolvendo `0`.

- [ ] **Passo 5: verify e commit**

```
npm run verify
git add lib/steps.ts tests/steps.test.ts
git commit -m "A conferencia da lista de blocos, pura e compartilhada pelas duas pontas"
```

---

# Tarefa 5 · O quadro: React Flow desenhando a corrente

**Arquivos:**
- Criar: `app/automacoes/editor/modelos.ts`, `no.tsx`, `quadro.tsx`
- Modificar: `package.json` (dependência)
- Teste: nenhum automatizado — ver *Verificação* no fim da tarefa

**Interfaces consumidas:** `Passo`, `Posicao`, `identidadeDoPasso` (Tarefas 1-2).

**Interfaces produzidas:**

```ts
// modelos.ts
export type ItemDaPaleta = { chave: string; rotulo: string; descricao: string; gatilhos: string[] | null };
export const PALETA: ItemDaPaleta[];
export function novoIdDeBloco(): string;
export function blocoNovo(chave: string): Passo;
export function resumoDoBloco(p: Passo): { titulo: string; corpo: string };
export function arranjoAutomatico(passos: Passo[]): Passo[];
```

- [ ] **Passo 0: `Passo` aceita posição**

Em `lib/steps.ts`, troque a linha do `ComId` (escrita na Tarefa 1) por:

```ts
type ComId = { id?: string; pos?: Posicao };
```

O comentário que já está lá acima dele explica o `id`; acrescente ao fim dele:

```ts
// `pos` é a posição no quadro, e ela é OPCIONAL pelo mesmo motivo: bloco
// gravado antes da Fase 1b não tem, e `arranjoAutomatico` (editor/modelos.ts)
// lhe dá uma na primeira abertura.
```

Rode `npx vitest run` — tem que continuar passando, porque nada além do tipo
mudou.

- [ ] **Passo 1: instale o React Flow**

```
npm install @xyflow/react@12.11.2
```

Esperado: instala sem aviso de peer dependency (React 19 satisfaz `>=17`).
Confirme com `node -e "console.log(require('./package.json').dependencies['@xyflow/react'])"`.

- [ ] **Passo 2: os modelos**

Crie `app/automacoes/editor/modelos.ts`:

```ts
import type { Passo, Posicao } from "@/lib/steps";

// A paleta tem OITO itens sobre SEIS tipos, e a diferença não é maquiagem.
//
// "Mensagem", "Mensagem com botão" e "Mensagem com link" salvam todas
// `tipo: "dm"`. O que separa uma DM que PARA o fluxo de uma que segue é ter
// rótulo de botão SEM url — uma diferença invisível no dado, que já causou
// defeito: um lembrete salvo sem link virou parada dura e o fluxo travou ali,
// sem ninguém ter pedido isso. Nomear os três casos faz a distinção aparecer
// na hora de criar, não depois.
//
// `gatilhos: null` = serve em qualquer um.
export type ItemDaPaleta = {
  chave: string;
  rotulo: string;
  descricao: string;
  gatilhos: string[] | null;
};

export const PALETA: ItemDaPaleta[] = [
  { chave: "dm", rotulo: "Mensagem", descricao: "texto simples", gatilhos: null },
  { chave: "dm_botao", rotulo: "Mensagem com botão", descricao: "o fluxo espera o toque", gatilhos: null },
  { chave: "dm_link", rotulo: "Mensagem com link", descricao: "botão que abre um endereço", gatilhos: null },
  { chave: "esperar", rotulo: "Esperar", descricao: "atrasa o que vier depois", gatilhos: null },
  { chave: "pedir_follow", rotulo: "Pedir follow", descricao: "portão: só passa quem segue", gatilhos: null },
  { chave: "pedir_email", rotulo: "Pedir e-mail", descricao: "portão: guarda o endereço", gatilhos: null },
  { chave: "resposta_publica", rotulo: "Resposta pública", descricao: "só no gatilho de comentário", gatilhos: ["comment"] },
  { chave: "reagir_story", rotulo: "Coraçãozinho", descricao: "só no gatilho de story", gatilhos: ["story"] },
];

// Mesma geração de `app/automacoes/actions.ts`. O prefixo `b_` é exigido por
// `identidadeDoPasso` (lib/steps.ts), e o motivo está escrito lá.
export function novoIdDeBloco(): string {
  return "b_" + Math.random().toString(36).slice(2, 10);
}

// Um bloco novo, já válido. Os textos-padrão existem para o bloco recém-criado
// não nascer inválido e travar o salvar antes de a pessoa digitar qualquer
// coisa.
export function blocoNovo(chave: string): Passo {
  const id = novoIdDeBloco();
  switch (chave) {
    case "dm":
      return { id, tipo: "dm", texto: "Escreva a mensagem aqui" };
    case "dm_botao":
      return { id, tipo: "dm", texto: "Escreva a mensagem aqui", botao_label: "Quero!" };
    case "dm_link":
      return { id, tipo: "dm", texto: "Aqui está o seu link!", botao_label: "Abrir link", url: "" };
    case "esperar":
      return { id, tipo: "esperar", minutos: 60 };
    case "pedir_follow":
      return { id, tipo: "pedir_follow", texto: "Antes de te mandar o link, me segue lá no perfil 🙏", botao_label: "Já sigo! ✅" };
    case "pedir_email":
      return { id, tipo: "pedir_email", texto: "Me manda seu melhor e-mail que eu te envio o link 👇" };
    case "resposta_publica":
      return { id, tipo: "resposta_publica", textos: ["Te mandei no direct! 📩"] };
    case "reagir_story":
      return { id, tipo: "reagir_story", emoji: "❤️" };
    default:
      return { id, tipo: "dm", texto: "Escreva a mensagem aqui" };
  }
}

// O que o nó mostra fechado. O corpo é cortado por CSS, não aqui — cortar no
// dado esconderia da prévia o texto que a pessoa acabou de digitar.
export function resumoDoBloco(p: Passo): { titulo: string; corpo: string } {
  switch (p.tipo) {
    case "dm":
      if (p.url) return { titulo: "MENSAGEM COM LINK", corpo: p.texto };
      if (p.botao_label) return { titulo: "MENSAGEM COM BOTÃO", corpo: p.texto };
      return { titulo: "MENSAGEM", corpo: p.texto };
    case "esperar":
      return { titulo: "ESPERAR", corpo: `${p.minutos} minutos` };
    case "pedir_follow":
      return { titulo: "PORTÃO · PEDIR FOLLOW", corpo: p.texto };
    case "pedir_email":
      return { titulo: "PORTÃO · PEDIR E-MAIL", corpo: p.texto };
    case "resposta_publica":
      return { titulo: "RESPOSTA PÚBLICA", corpo: p.textos.join(" · ") };
    case "reagir_story":
      return { titulo: "CORAÇÃOZINHO", corpo: p.emoji };
  }
}

// Onde pôr os blocos que não têm posição gravada — toda automação criada antes
// da Fase 1b, e todo bloco recém-inserido pela seta.
//
// Escada diagonal em vez de coluna reta: com as setas curvas do React Flow,
// blocos alinhados na vertical fazem a seta passar POR DENTRO do bloco de
// baixo. O deslocamento horizontal deixa a curva visível.
const LARGURA = 250;
const ALTURA = 96;

export function arranjoAutomatico(passos: Passo[]): Passo[] {
  return passos.map((p, i) =>
    p.pos ? p : { ...p, pos: { x: 60 + i * LARGURA, y: 60 + i * ALTURA } }
  );
}
```

> **Nota de tipo:** `Passo` não declara `pos`. Acrescente-o a `ComId` em
> `lib/steps.ts` na Tarefa 5, junto com o comentário que já está escrito lá:
> `type ComId = { id?: string; pos?: Posicao };`

- [ ] **Passo 3: o nó**

Crie `app/automacoes/editor/no.tsx`:

```tsx
"use client";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { Passo } from "@/lib/steps";
import { resumoDoBloco } from "./modelos";

// Um bloco no quadro.
//
// UMA alça de saída, e isso é a decisão central desta fase, não uma limitação
// que ficou faltando: o motor não sabe ramificar. Quem vê duas alças desenha
// duas setas, e a segunda não roda — a tela teria ensinado a fazer errado.
// Quando a ramificação chegar, a segunda alça aparece AQUI e nada mais muda.
export type DadosDoNo = {
  passo: Passo;
  temErro: boolean;
  selecionado: boolean;
};

export default function No({ data }: NodeProps & { data: DadosDoNo }) {
  const { titulo, corpo } = resumoDoBloco(data.passo);
  const portao = data.passo.tipo === "pedir_follow" || data.passo.tipo === "pedir_email";

  const borda = data.temErro
    ? "border-red-500 dark:border-red-400"
    : data.selecionado
      ? "border-indigo-500 dark:border-indigo-400"
      : portao
        ? "border-amber-500/70 dark:border-amber-400/70"
        : "border-zinc-300 dark:border-zinc-700";

  return (
    <div
      className={`w-[190px] rounded-lg border-2 bg-white px-3 py-2 shadow-sm dark:bg-zinc-900 ${borda}`}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !bg-zinc-400" />
      <div className="text-[10px] font-semibold tracking-wide text-zinc-500 dark:text-zinc-400">
        {titulo}
      </div>
      <div className="mt-1 line-clamp-2 text-xs text-zinc-700 dark:text-zinc-200">{corpo}</div>
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !bg-zinc-400" />
    </div>
  );
}
```

- [ ] **Passo 4: o quadro**

Crie `app/automacoes/editor/quadro.tsx`. Esta é a peça que segura o estado:

```tsx
"use client";
import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Passo } from "@/lib/steps";
import No, { type DadosDoNo } from "./no";
import { arranjoAutomatico } from "./modelos";

const TIPOS_DE_NO = { bloco: No };

// O quadro.
//
// A REGRA QUE ORGANIZA ESTE ARQUIVO: a ordem de execução é a ordem do array
// `passos`. Arrastar um nó muda `pos` e NADA MAIS. As setas são derivadas do
// array, não o contrário.
//
// Isso não é preferência de implementação — é a defesa contra o pior defeito
// possível aqui. Se a posição definisse a ordem, empurrar um bloco três pixels
// sem querer reordenaria o fluxo, e a próxima pessoa a acionar a automação
// receberia as mensagens fora de ordem. Sem erro, sem aviso. Descobre-se pelo
// cliente reclamando.
// O ESTADO MORA AQUI, e não num pai. `quadro.tsx` é o container do editor: ele
// segura `Passo[]`, e paleta, nós e painel só recebem callbacks. Um pai
// controlando a lista faria duas fontes de verdade para a mesma coisa.
export default function Quadro({
  automationId,
  passosIniciais,
  gatilho,
}: {
  automationId: string;
  passosIniciais: Passo[];
  gatilho: string;
}) {
  const [passos, setPassos] = useState<Passo[]>(() => arranjoAutomatico(passosIniciais));
  const [selecionado, setSelecionado] = useState<string | null>(null);

  // Só a posição volta do React Flow para o estado. Nada aqui reordena.
  const moverBloco = useCallback((id: string, x: number, y: number) => {
    setPassos((atual) => atual.map((p) => (p.id === id ? { ...p, pos: { x, y } } : p)));
  }, []);

  const nos: Node[] = useMemo(
    () =>
      passos.map((p) => ({
        id: p.id!,
        type: "bloco",
        position: p.pos ?? { x: 0, y: 0 },
        data: { passo: p, temErro: false, selecionado: p.id === selecionado } as DadosDoNo,
      })),
    [passos, selecionado]
  );

  // As setas SEMPRE ligam o bloco i ao i+1 do array. Não há edge que o usuário
  // possa criar ou apagar: `nodesConnectable` fica desligado, e o React Flow
  // deixa de oferecer o gesto de ligar.
  const setas: Edge[] = useMemo(
    () =>
      passos.slice(0, -1).map((p, i) => ({
        id: `${p.id}->${passos[i + 1].id}`,
        source: p.id!,
        target: passos[i + 1].id!,
        type: "smoothstep",
        animated: false,
      })),
    [passos]
  );

  const aoMudarNos = useCallback(
    (mudancas: NodeChange[]) => {
      for (const m of mudancas) {
        // `!m.dragging` grava só quando o arraste TERMINA. Sem isso, cada
        // quadro de animação viraria um `setPassos` e a lista inteira seria
        // recriada dezenas de vezes por segundo.
        if (m.type === "position" && m.position && !m.dragging) {
          moverBloco(m.id, Math.round(m.position.x), Math.round(m.position.y));
        }
      }
    },
    [moverBloco]
  );

  return (
    <div className="h-[calc(100vh-13rem)] w-full rounded-xl border border-zinc-200 dark:border-zinc-800">
      <ReactFlow
        nodes={nos}
        edges={setas}
        nodeTypes={TIPOS_DE_NO}
        onNodesChange={aoMudarNos}
        onNodeClick={(_, no) => setSelecionado(no.id)}
        onPaneClick={() => setSelecionado(null)}
        nodesConnectable={false}
        edgesFocusable={false}
        deleteKeyCode={null}
        fitView
        proOptions={{ hideAttribution: false }}
      >
        <Background gap={17} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
```

> **Nós derivados, não guardados.** `nos` e `setas` são `useMemo` sobre
> `passos` — não há `useNodesState` nem cópia da lista dentro do React Flow.
> Guardar os nós criaria uma segunda cópia da mesma informação, e as duas
> divergiriam na primeira inserção. É a mesma razão de as setas serem derivadas
> do array: uma fonte de verdade só.

- [ ] **Passo 5: monte numa página de teste e olhe**

Não há teste automatizado para esta tarefa. Verifique assim:

1. `npm run dev`
2. Abra `/automacoes/<id-da-automação-existente>` — ainda mostra o formulário
   antigo, o que é esperado; o quadro só entra na Tarefa 8.
3. Para ver o quadro agora, troque temporariamente
   `app/automacoes/nova/page.tsx` para renderizar `<Quadro …/>` com uma lista
   fixa de três blocos, olhe, e **reverta a troca antes de commitar**.

Confira, e reporte o que viu:
- os três blocos aparecem, ligados por setas curvas
- arrastar um bloco move e a seta acompanha
- **arrastar NÃO muda a ordem** — os títulos continuam na mesma sequência
- zoom e pan funcionam; a roda do mouse dá zoom
- não existe alça que permita puxar uma seta nova

- [ ] **Passo 6: verify e commit**

```
npm run verify
git add package.json package-lock.json app/automacoes/editor/ lib/steps.ts
git commit -m "O quadro desenha a corrente de blocos, e arrastar so muda a posicao"
```

---

# Tarefa 6 · Inserir, apagar e reordenar

**Arquivos:**
- Criar: `app/automacoes/editor/paleta.tsx`
- Modificar: `app/automacoes/editor/quadro.tsx`, `no.tsx`

**Interfaces consumidas:** `PALETA`, `blocoNovo` (Tarefa 5).

- [ ] **Passo 1: a paleta**

Crie `app/automacoes/editor/paleta.tsx`:

```tsx
"use client";
import { PALETA } from "./modelos";

// Os itens que dá para pôr no quadro.
//
// Os dependentes de gatilho aparecem DESABILITADOS em vez de sumirem: sumir
// esconderia que a opção existe, e o dono ficaria procurando por que o
// coraçãozinho não está na lista. Desabilitado com o motivo escrito responde a
// pergunta antes de ela ser feita.
export default function Paleta({ gatilho }: { gatilho: string }) {
  return (
    <div className="absolute left-3 top-3 z-10 w-44 rounded-lg border border-zinc-200 bg-white/90 p-1.5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90">
      <div className="px-1.5 pb-1 text-[9px] font-semibold tracking-wider text-zinc-400">
        ARRASTE PARA O QUADRO
      </div>
      {PALETA.map((item) => {
        const serve = !item.gatilhos || item.gatilhos.includes(gatilho);
        return (
          <div
            key={item.chave}
            draggable={serve}
            onDragStart={(e) => {
              e.dataTransfer.setData("application/metodochat-bloco", item.chave);
              e.dataTransfer.effectAllowed = "move";
            }}
            className={`rounded px-1.5 py-1 text-xs ${
              serve
                ? "cursor-grab text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                : "cursor-not-allowed text-zinc-400 dark:text-zinc-600"
            }`}
            title={serve ? "" : item.descricao}
          >
            <div>{item.rotulo}</div>
            <div className="text-[10px] text-zinc-400 dark:text-zinc-500">{item.descricao}</div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Passo 2: soltar no quadro anexa no fim**

> **Ordem dentro desta tarefa:** o `onDrop` abaixo usa `setaSobEle`, que é
> criado no Passo 3. Escreva os dois passos antes de rodar o `typecheck`; ele
> falha entre um e outro, e isso é esperado.

Em `quadro.tsx`, acrescente ao `<ReactFlow>`:

```tsx
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
        onDrop={(e) => {
          e.preventDefault();
          const chave = e.dataTransfer.getData("application/metodochat-bloco");
          if (!chave) return;
          const caixa = e.currentTarget.getBoundingClientRect();
          aoInserir(chave, e.clientX - caixa.left, e.clientY - caixa.top, setaSobEle);
        }}
```

E em `quadro.tsx`, a regra de inserção:

```ts
// Soltar num ponto vazio ANEXA NO FIM. Soltar sobre uma seta INSERE ali.
//
// Não existe bloco solto: como a ordem é o array, todo bloco está sempre na
// corrente. Isso contraria quem conhece o draw.io, onde caixa solta é normal, e
// é deliberado — bloco solto seria um bloco que nunca roda, e nada na tela
// explicaria por quê.
function inserir(chave: string, x: number, y: number, sobreSeta: number | null) {
  const bloco = { ...blocoNovo(chave), pos: { x, y } };
  setPassos((atual) => {
    if (sobreSeta === null) return [...atual, bloco];
    return [...atual.slice(0, sobreSeta + 1), bloco, ...atual.slice(sobreSeta + 1)];
  });
}
```

- [ ] **Passo 3: soltar sobre uma seta reordena**

Em `quadro.tsx`, guarde qual seta está sob o ponteiro durante o arraste, usando
os eventos de aresta do React Flow:

```tsx
  const [setaSobEle, setSetaSobEle] = useState<number | null>(null);
```

e nas setas, acrescente o índice ao `data` e ligue os manipuladores:

```tsx
        onEdgeMouseEnter={(_, aresta) => setSetaSobEle(Number(aresta.data?.indice))}
        onEdgeMouseLeave={() => setSetaSobEle(null)}
```

A seta sob o ponteiro fica destacada trocando o `style` dela quando
`setaSobEle === i`:

```tsx
        style: setaSobEle === i
          ? { stroke: "rgb(99 102 241)", strokeWidth: 3 }
          : undefined,
```

E ao soltar um **nó existente** sobre uma seta, mova-o na lista:

```ts
// Reordenar é soltar o bloco SOBRE UMA SETA, nunca arrastar pelo quadro.
//
// O gesto é explícito de propósito. Se posição definisse ordem, um empurrão
// acidental trocaria a ordem das mensagens que o cliente recebe.
function moverPara(id: string, depoisDe: number) {
  setPassos((atual) => {
    const de = atual.findIndex((p) => p.id === id);
    if (de === -1) return atual;
    const sem = atual.filter((p) => p.id !== id);
    const alvo = de <= depoisDe ? depoisDe : depoisDe + 1;
    return [...sem.slice(0, alvo), atual[de], ...sem.slice(alvo)];
  });
}
```

- [ ] **Passo 4: apagar**

Em `no.tsx`, acrescente `aoApagar` ao tipo dos dados e o botão ao nó:

```tsx
export type DadosDoNo = {
  passo: Passo;
  temErro: boolean;
  selecionado: boolean;
  aoApagar: (id: string) => void;
};
```

Dentro do `<div>` do nó, como primeiro filho depois do `<Handle type="target">`:

```tsx
      <button
        type="button"
        onClick={(e) => {
          // Sem isto o clique também seleciona o nó, e o painel abre para um
          // bloco que acabou de deixar de existir.
          e.stopPropagation();
          data.aoApagar(data.passo.id!);
        }}
        className="absolute -right-2 -top-2 hidden h-5 w-5 rounded-full border border-zinc-300 bg-white text-xs leading-none text-zinc-500 group-hover:block hover:text-red-600 dark:border-zinc-700 dark:bg-zinc-900"
        aria-label="Apagar bloco"
      >
        ✕
      </button>
```

E acrescente `group relative` às classes do `<div>` externo, para o
`group-hover` funcionar.

Em `quadro.tsx`, a função e a ligação:

```ts
  const apagarBloco = useCallback((id: string) => {
    setPassos((atual) => atual.filter((p) => p.id !== id));
    setSelecionado((s) => (s === id ? null : s));
  }, []);
```

e no `data` de cada nó: `aoApagar: apagarBloco`.

O nó de gatilho **não** recebe este botão — ele não é apagável, e o
`gatilho.tsx` da Tarefa 7 é um componente próprio justamente por isso.

- [ ] **Passo 5: verifique à mão e reporte**

`npm run dev`, e confirme cada um:
- arrastar "Mensagem" da paleta para um ponto vazio → bloco novo **no fim** da
  corrente
- arrastar sobre uma seta → a seta acende, e ao soltar o bloco entra **ali**
- arrastar um bloco existente sobre uma seta → ele **muda de lugar** na ordem
- arrastar um bloco para um ponto vazio → só a posição muda, **a ordem não**
- apagar um bloco do meio → a corrente se refaz sem buraco
- no gatilho de DM, "Resposta pública" e "Coraçãozinho" estão apagados e não
  arrastam

- [ ] **Passo 6: verify e commit**

```
npm run verify
git add app/automacoes/editor/
git commit -m "Inserir, apagar e reordenar soltando o bloco sobre a seta"
```

---

# Tarefa 7 · O painel: campos do bloco e a prévia

**Arquivos:**
- Criar: `app/automacoes/editor/painel.tsx`, `gatilho.tsx`
- Modificar: `app/automacoes/editor/quadro.tsx`

**Interfaces consumidas:** `Passo` (Tarefa 1), `phone-preview.tsx`,
`variable-picker.tsx`, `media-picker.tsx` (já existem, não modifique).

- [ ] **Passo 1: leia a interface das três peças reaproveitadas**

Antes de escrever o painel, leia e anote as props de:
- `app/automacoes/phone-preview.tsx`
- `app/automacoes/variable-picker.tsx`
- `app/automacoes/media-picker.tsx`

Elas foram escritas para o formulário antigo. **Não as modifique nesta
tarefa.** Se alguma exigir uma prop que o quadro não tem, reporte em vez de
adaptar a peça — adaptar as três é trabalho próprio e pode virar tarefa nova.

- [ ] **Passo 2: o painel**

Crie `app/automacoes/editor/painel.tsx`, com um formulário por tipo de bloco:

```tsx
"use client";
import type { Passo, Problema } from "@/lib/steps";

// Os campos do bloco selecionado, e a prévia da conversa.
//
// Abre SOBRE o quadro, à direita, em vez de dividir a tela: fechado, o quadro é
// inteiro. Num editor espacial a área de trabalho é o produto.
export default function Painel({
  passo,
  problemas,
  aoMudar,
  aoFechar,
}: {
  passo: Passo | null;
  problemas: Problema[];
  aoMudar: (p: Passo) => void;
  aoFechar: () => void;
}) {
  if (!passo) return null;

  return (
    <aside className="absolute right-0 top-0 z-20 h-full w-80 overflow-y-auto border-l border-zinc-200 bg-white p-4 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
      <button onClick={aoFechar} className="float-right text-zinc-400 hover:text-zinc-600">
        ✕
      </button>

      {passo.tipo === "dm" && (
        <>
          <label className="text-xs font-semibold text-zinc-500">Mensagem</label>
          <textarea
            value={passo.texto}
            onChange={(e) => aoMudar({ ...passo, texto: e.target.value })}
            rows={4}
            className="mt-1 w-full rounded border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
          {passo.botao_label !== undefined && (
            <>
              <label className="mt-3 block text-xs font-semibold text-zinc-500">
                Texto do botão
              </label>
              <input
                value={passo.botao_label}
                onChange={(e) => aoMudar({ ...passo, botao_label: e.target.value })}
                className="mt-1 w-full rounded border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
            </>
          )}
          {passo.url !== undefined && (
            <>
              <label className="mt-3 block text-xs font-semibold text-zinc-500">Endereço</label>
              <input
                value={passo.url}
                onChange={(e) => aoMudar({ ...passo, url: e.target.value })}
                placeholder="https://"
                className="mt-1 w-full rounded border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
            </>
          )}
          {passo.botao_label && !passo.url && (
            <p className="mt-3 rounded border-l-4 border-amber-400 bg-amber-50 p-2 text-xs dark:bg-amber-950/40">
              <strong>O fluxo para aqui</strong> esperando o toque. O que vier depois só sai
              quando a pessoa tocar no botão.
            </p>
          )}
        </>
      )}

      {passo.tipo === "esperar" && (
        <>
          <label className="text-xs font-semibold text-zinc-500">Esperar (minutos)</label>
          <input
            type="number"
            min={1}
            value={passo.minutos}
            onChange={(e) => aoMudar({ ...passo, minutos: Number(e.target.value) })}
            className="mt-1 w-full rounded border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
        </>
      )}

      {(passo.tipo === "pedir_follow" || passo.tipo === "pedir_email") && (
        <>
          <label className="text-xs font-semibold text-zinc-500">Mensagem do pedido</label>
          <textarea
            value={passo.texto}
            onChange={(e) => aoMudar({ ...passo, texto: e.target.value })}
            rows={3}
            className="mt-1 w-full rounded border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
          {passo.tipo === "pedir_follow" && (
            <>
              <label className="mt-3 block text-xs font-semibold text-zinc-500">
                Texto do botão
              </label>
              <input
                value={passo.botao_label}
                onChange={(e) => aoMudar({ ...passo, botao_label: e.target.value })}
                className="mt-1 w-full rounded border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
            </>
          )}
        </>
      )}

      {passo.tipo === "reagir_story" && (
        <>
          <label className="text-xs font-semibold text-zinc-500">Emoji</label>
          <input
            value={passo.emoji}
            onChange={(e) => aoMudar({ ...passo, emoji: e.target.value })}
            className="mt-1 w-full rounded border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
        </>
      )}

      {passo.tipo === "resposta_publica" && (
        <>
          <label className="text-xs font-semibold text-zinc-500">
            Variações (uma por linha — sorteia uma)
          </label>
          <textarea
            value={passo.textos.join("\n")}
            onChange={(e) =>
              aoMudar({ ...passo, textos: e.target.value.split("\n").filter((s) => s.trim()) })
            }
            rows={4}
            className="mt-1 w-full rounded border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
        </>
      )}

      {problemas.map((p, i) => (
        <p
          key={i}
          className={`mt-3 rounded border-l-4 p-2 text-xs ${
            p.nivel === "erro"
              ? "border-red-500 bg-red-50 dark:bg-red-950/40"
              : "border-amber-400 bg-amber-50 dark:bg-amber-950/40"
          }`}
        >
          {p.mensagem}
        </p>
      ))}
    </aside>
  );
}
```

- [ ] **Passo 3: o nó de gatilho**

Crie `app/automacoes/editor/gatilho.tsx`:

```tsx
"use client";
import { Handle, Position } from "@xyflow/react";

// O gatilho é o primeiro nó, e ele é diferente dos outros em três coisas: não
// tem alça de ENTRADA (nada vem antes dele), não tem botão de apagar (sem
// gatilho não há automação), e não é arrastável para dentro da corrente.
//
// Ele ser um nó, e não um formulário acima do quadro, é o que faz a tela ser
// uma coisa só — a configuração da automação mora onde ela é lida.
export type DadosDoGatilho = {
  tipo: string;
  palavras: string[];
  selecionado: boolean;
};

const NOME = { dm: "DM", comment: "COMENTÁRIO", story: "STORY" } as const;

export default function Gatilho({ data }: { data: DadosDoGatilho }) {
  return (
    <div
      className={`w-[190px] rounded-lg border-2 bg-white px-3 py-2 shadow-sm dark:bg-zinc-900 ${
        data.selecionado
          ? "border-indigo-500 dark:border-indigo-400"
          : "border-sky-500/70 dark:border-sky-400/70"
      }`}
    >
      <div className="text-[10px] font-semibold tracking-wide text-sky-600 dark:text-sky-400">
        GATILHO · {NOME[data.tipo as keyof typeof NOME] ?? data.tipo.toUpperCase()}
      </div>
      <div className="mt-1 line-clamp-2 text-xs text-zinc-700 dark:text-zinc-200">
        {data.palavras.length ? `contém ${data.palavras.join(", ")}` : "qualquer mensagem"}
      </div>
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !bg-zinc-400" />
    </div>
  );
}
```

Registre-o em `quadro.tsx`:

```tsx
const TIPOS_DE_NO = { bloco: No, gatilho: Gatilho };
```

e insira-o como primeiro nó da lista de `nos`, com id fixo `"gatilho"`:

```tsx
  const nos: Node[] = useMemo(() => {
    const doGatilho: Node = {
      id: "gatilho",
      type: "gatilho",
      position: { x: 60, y: 60 },
      data: { tipo: gatilho, palavras, selecionado: selecionado === "gatilho" },
      deletable: false,
    };
    return [doGatilho, ...passos.map(/* … como na Tarefa 5 … */)];
  }, [passos, selecionado, gatilho, palavras]);
```

> O id `"gatilho"` é fixo e **não pode colidir com id de bloco** — não colide,
> porque `identidadeDoPasso` exige o prefixo `b_`. A primeira seta sai dele
> para o bloco de índice 0.

Quando o gatilho está selecionado, o painel mostra os campos da automação —
nome, ativo, gatilho, palavras-chave, tipo de correspondência, e o
`media-picker` nos gatilhos de comentário e story. Esses campos são salvos por
`saveAutomation`, que já existe; **não os junte ao `salvarPassos`** — são
escritas diferentes, em colunas diferentes, e misturá-las faz um salvar
parcial gravar metade de cada coisa.

- [ ] **Passo 4: ligue a prévia**

No painel, abaixo dos campos, renderize `phone-preview.tsx` alimentado pela
lista de passos atual. Se a interface dela não aceitar `Passo[]`, **reporte** —
é a adaptação que o Passo 1 mandou não fazer por conta própria.

- [ ] **Passo 5: verifique à mão e reporte**

- clicar num bloco abre o painel com os campos daquele tipo
- digitar altera o resumo no nó, ao vivo
- a prévia acompanha
- fechar o painel devolve o quadro inteiro
- clicar no gatilho abre a configuração dele

- [ ] **Passo 6: verify e commit**

```
npm run verify
git add app/automacoes/editor/
git commit -m "O painel do bloco: campos por tipo, avisos e a previa da conversa"
```

---

# Tarefa 8 · Salvar, trocar as páginas, e apagar o formulário

**Arquivos:**
- Modificar: `app/automacoes/actions.ts` (`salvarPassos`)
- Modificar: `app/automacoes/nova/page.tsx`, `app/automacoes/[id]/page.tsx`
- Modificar: `app/automacoes/editor/quadro.tsx` (salvar + aviso no celular)
- Remover: `app/automacoes/form.tsx`

**Interfaces consumidas:** `conferirLista` (Tarefa 4).

- [ ] **Passo 1: o Server Action**

Em `app/automacoes/actions.ts`:

```ts
// Grava a lista montada no quadro.
//
// A CONFERÊNCIA RODA AQUI DE NOVO, e não é redundância: o cliente já conferiu
// para desabilitar o botão, mas o cliente é o navegador da pessoa e nada que
// vem de lá é confiável. É a MESMA função (`conferirLista`, lib/steps.ts) nos
// dois lados — escrever a regra duas vezes é como as duas versões passam a
// discordar.
export async function salvarPassos(
  automationId: string,
  passos: unknown
): Promise<{ ok: true } | { ok: false; erro: string }> {
  await ensureSchema();
  const accountId = await getSelectedAccountId();
  if (!accountId) return { ok: false, erro: "Nenhuma conta conectada." };

  const linhas = (await sql().query(
    `select triggers from automations where id = $1 and account_id = $2`,
    [automationId, accountId]
  )) as { triggers: string[] }[];
  if (!linhas[0]) return { ok: false, erro: "Automação não encontrada." };

  const problemas = conferirLista(passos, linhas[0].triggers[0] ?? "dm");
  const erros = problemas.filter((p) => p.nivel === "erro");
  if (erros.length) return { ok: false, erro: erros[0].mensagem };

  // o account_id no where impede gravar em automação de outra conta
  await sql().query(
    `update automations set steps = $1, updated_at = now()
     where id = $2 and account_id = $3`,
    [passos, automationId, accountId]
  );
  revalidatePath("/automacoes");
  return { ok: true };
}
```

- [ ] **Passo 2: o botão de salvar**

Em `quadro.tsx`, um rodapé com o botão. Desabilitado quando há erro, com o
motivo ao lado:

```tsx
  const problemas = useMemo(() => conferirLista(passos, gatilho), [passos, gatilho]);
  const erros = problemas.filter((p) => p.nivel === "erro");
```

- [ ] **Passo 3: o aviso no celular**

No topo do quadro, uma faixa que só aparece em tela estreita, com a lista de
blocos em modo leitura embaixo:

```tsx
      <div className="sm:hidden rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700 dark:bg-amber-950/40">
        A edição das automações é pelo computador — o quadro precisa de arrastar
        e soltar. Abaixo, o fluxo desta automação em modo leitura.
      </div>
      <div className="hidden sm:block">{/* o quadro */}</div>
```

- [ ] **Passo 4: troque as duas páginas**

Em `app/automacoes/nova/page.tsx` e `app/automacoes/[id]/page.tsx`, substitua
`<AutomationForm …/>` por `<Quadro …/>`, passando `passosIniciais` e o gatilho.

> **Automação NOVA não tem id ainda**, e `salvarPassos` precisa de um. Resolva
> criando a automação com nome e gatilho antes de abrir o quadro — a página
> `/automacoes/nova` vira um passo curto (nome + gatilho + palavras-chave) que
> grava e redireciona para `/automacoes/<id>`, onde o quadro abre. Isso é uma
> decisão de fluxo de tela; se preferir outra, **pergunte antes de implementar**.

- [ ] **Passo 5: apague o formulário**

```
git rm app/automacoes/form.tsx
```

Confira que nada mais o importa:

```
grep -rn "from \"../form\"\|from \"./form\"\|automacoes/form" --include=*.tsx --include=*.ts app lib
```

Esperado: nenhuma linha.

- [ ] **Passo 6: verify**

```
npm run verify
```

- [ ] **Passo 7: confira o estado do banco ANTES de considerar pronto**

```
node -e "
const fs=require('fs');const env=fs.readFileSync('.env.local','utf8');
const url=env.match(/^DATABASE_URL=(.*)\$/m)[1].trim().replace(/^[\"']|[\"']\$/g,'');
const sql=require('postgres')(url,{prepare:false,ssl:'require',onnotice:()=>{}});
(async()=>{
  const a=await sql\`select name, jsonb_array_length(steps) as n from automations\`;
  console.log('automacoes:', a.map(x=>x.name+'='+x.n).join(', '));
  const semId=await sql\`select count(*) as n from automations, jsonb_array_elements(steps) e where e->>'id' is null\`;
  console.log('blocos SEM id:', semId[0].n, '(tem que ser 0)');
  const c=await sql\`select count(*) as n from contacts where flow_step_id is not null or flow_step_index is not null\`;
  console.log('contatos em fluxo:', c[0].n);
  const f=await sql\`select count(*) as n from queue where status='pending'\`;
  console.log('fila pendente:', f[0].n);
  await sql.end();
})();
"
```

**Blocos sem id tem que ser 0.** Se não for, a migração da Tarefa 1 não rodou
ou não pegou tudo — pare e rode de novo.

Anote "contatos em fluxo" e "fila pendente": são eles que dizem se o deploy
pode reenviar mensagem. Com os dois em zero, o risco é zero.

- [ ] **Passo 8: commit**

```
git add -A
git commit -m "O quadro substitui o formulario, e o salvar confere a lista nas duas pontas"
```

---

## Depois do plano

**Não mergeie sem revisão da branch inteira.** Use
`superpowers:requesting-code-review` com o modelo mais capaz disponível. A Fase
1a produziu treze defeitos e três correções que criaram defeito pior que o
original; a diferença aqui é que quase toda a lógica está em função pura
testada — o que o revisor mais precisa olhar é a Tarefa 2 (cursor) e a
Tarefa 3 (payload), que são as únicas que mexem em `lib/engine.ts`.

**No deploy, confira o banco de novo.** O número de "contatos em fluxo" e "fila
pendente" muda entre agora e o deploy. Com qualquer um deles diferente de zero,
a troca da identidade pode reenviar mensagem do dia. Não presuma — meça.

**Os três itens herdados que continuam abertos** (`esperar` descartado antes de
um portão; `gravarCursor`/`limparCursor` sem dono; cursor obsoleto sem linha em
Atividade) não são tocados aqui e seguem registrados.
