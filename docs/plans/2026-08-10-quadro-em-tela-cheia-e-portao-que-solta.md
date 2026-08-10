# O quadro em tela cheia, e o portão que solta — plano

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA — use
> `superpowers:subagent-driven-development`, tarefa a tarefa. Os passos usam
> caixinha (`- [ ]`).

**Objetivo:** dar ao editor a janela inteira, e fazer o portão de follow soltar
quem ele parou de cobrar em vez de segurá-lo calado.

**Arquitetura:** as duas decisões novas do portão viram função pura em
`lib/steps.ts`, testadas; `lib/engine.ts` fica só com o efeito. A tela cheia é
uma terceira ramificação em `app/app-shell.tsx`, que já ramifica por caminho.

**Tecnologia:** Next.js 16.2.10, React 19.2.4, `@xyflow/react` 12.11.2, Tailwind,
Vitest.

**Base:** branch `editor-em-blocos`, commit `f57668f`.

## Restrições globais

- **`lib/steps.ts` não tem NENHUM import.** Confira com
  `grep -c "^import\|require(" lib/steps.ts` — tem que dar 0.
- **A suíte só testa função pura.** Sem banco, sem mock, sem teste de componente.
- **Este Next.js não é o que você conhece.** Leia o guia em
  `node_modules/next/dist/docs/` antes de escrever código específico de Next.
- **A marca do React Flow FICA.** `proOptions={{ hideAttribution: false }}` não
  muda — decisão do dono do produto, e os autores da biblioteca pedem assinatura
  de quem a remove.
- Comentários em português; mensagem de commit em português sem acentos, sem
  menção a agente ou ferramenta.
- Nada de `ADMIN_PASSWORD`, nada de cookie de sessão, nada escrito no banco.
- `npm run verify` tem que passar. Reporte a saída real.

---

# Tarefa 1 · O portão solta em vez de segurar

**Files:**
- Modify: `lib/steps.ts` (duas funções puras novas)
- Modify: `lib/db.ts` (coluna `follow_attempts_dia`, tipo `Contact`)
- Modify: `lib/engine.ts` (`resolverFollow` e os dois chamadores)
- Modify: `app/labels.ts` (rótulo do evento novo)
- Test: `tests/steps.test.ts`

**Interfaces produzidas:**

```ts
export function tentativasDeHoje(gravadas: unknown, diaGravado: unknown, hoje: string): number
export function oQuePortaoFaz(tentativasDeHoje: number, maximo: number): "pedir" | "soltar"
```

## O problema, escrito por inteiro

Hoje o portão conta as tentativas numa coluna `contacts.follow_attempts`, que é
**por contato** e nunca zera — nem por dia, nem por automação. Passado
`MAX_FOLLOW_REQUESTS`, `resolverFollow` deixa de enfileirar o pedido **e o fluxo
continua gravando o cursor no portão**.

O resultado, medido pela revisão final: **4.078 estados alcançáveis sem saída,
todos desta forma exata.** A pessoa fica capturada — o ramo de texto lê toda
mensagem dela como resposta ao portão, e `interrompeOFluxo` só deixa outra
automação interromper quando o passo parado é `dm`. Ela para de ser cobrada,
para de receber explicação, e nenhuma automação a alcança.

**A raiz:** `follow_attempts` faz dois trabalhos que se descolam. Ele conta
quantas vezes já pedimos (anti-spam) e, junto com o cursor, define que a pessoa
está presa. Um portão que não pergunta mais e não solta é o pior dos dois mundos.

**As duas mudanças, e cada uma tem um motivo próprio:**

1. **O contador passa a ser por dia.** Sem isso, a mudança 2 protege do
   travamento mas condena a pessoa a nunca mais receber aquele link, mesmo que
   ela siga amanhã.
2. **Esgotadas as tentativas do dia, o portão solta o cursor** em vez de gravá-lo.
   A pessoa deixa de ser capturada e volta a ser alcançável por qualquer
   automação.

Juntas: no máximo `MAX_FOLLOW_REQUESTS` pedidos por dia, nunca presa, e quem
seguir passa na hora — porque `checkFollowsAccount` roda **antes** de o contador
ser olhado, e isso não muda.

- [ ] **Passo 1: escreva os testes que falham**

Em `tests/steps.test.ts`, no fim:

```ts
describe("tentativas do portão, por dia", () => {
  // O contador era por contato e nunca zerava. Quem estourasse o limite ficava
  // sem receber o pedido para sempre — em toda automação, todo dia.

  it("conta as de hoje quando o dia gravado é hoje", () => {
    expect(tentativasDeHoje(3, "2026-08-10", "2026-08-10")).toBe(3);
  });

  it("ZERA quando o dia gravado é outro — é o ponto da mudança", () => {
    expect(tentativasDeHoje(5, "2026-08-09", "2026-08-10")).toBe(0);
  });

  it("zera quando nunca houve dia gravado", () => {
    // Todo contato anterior a esta mudança cai aqui: tem contador e não tem dia.
    // Zerar é o certo — o contador acumulado não é de hoje.
    expect(tentativasDeHoje(5, null, "2026-08-10")).toBe(0);
    expect(tentativasDeHoje(5, undefined, "2026-08-10")).toBe(0);
  });

  it("não estoura com lixo vindo do banco", () => {
    expect(tentativasDeHoje("3", "2026-08-10", "2026-08-10")).toBe(0);
    expect(tentativasDeHoje(null, "2026-08-10", "2026-08-10")).toBe(0);
    expect(tentativasDeHoje(-2, "2026-08-10", "2026-08-10")).toBe(0);
    expect(tentativasDeHoje(2.7, "2026-08-10", "2026-08-10")).toBe(2);
  });
});

describe("o que o portão faz", () => {
  it("pede enquanto não chegou ao limite", () => {
    expect(oQuePortaoFaz(0, 5)).toBe("pedir");
    expect(oQuePortaoFaz(4, 5)).toBe("pedir");
  });

  it("SOLTA a partir do limite, em vez de segurar calado", () => {
    // Era aqui que a pessoa ficava presa: o portão parava de pedir e continuava
    // gravando o cursor. 4.078 estados sem saida, todos desta forma.
    expect(oQuePortaoFaz(5, 5)).toBe("soltar");
    expect(oQuePortaoFaz(9, 5)).toBe("soltar");
  });

  it("com limite zero, solta sempre", () => {
    expect(oQuePortaoFaz(0, 0)).toBe("soltar");
  });
});
```

Acrescente `tentativasDeHoje` e `oQuePortaoFaz` aos imports do arquivo.

- [ ] **Passo 2: rode e confirme que falha**

```
npx vitest run tests/steps.test.ts
```

Esperado: FAIL — `tentativasDeHoje is not a function`.

- [ ] **Passo 3: as duas funções puras**

Em `lib/steps.ts`, perto de `identidadeDoPasso`:

```ts
// Quantas vezes já pedimos follow a esta pessoa HOJE.
//
// O contador vive numa coluna que nunca zerava, e o dia gravado é o que lhe dá
// validade. Dia diferente — ou nenhum dia, que é o caso de todo contato anterior
// a esta mudança — significa que o acumulado não é de hoje, e hoje começa do
// zero.
//
// O balde de dia é o de Brasília, o mesmo das chaves de deduplicação
// (`diaDaChave`, lib/dedupe.ts). Quem chama passa o valor pronto; esta função é
// pura e não lê relógio.
//
// Lixo vindo do banco vira zero em vez de estourar: a coluna é `int not null`
// hoje, mas esta função é a única barreira entre o banco e uma decisão de envio.
export function tentativasDeHoje(gravadas: unknown, diaGravado: unknown, hoje: string): number {
  if (diaGravado !== hoje) return 0;
  if (typeof gravadas !== "number" || !Number.isFinite(gravadas) || gravadas < 0) return 0;
  return Math.floor(gravadas);
}

// O que o portão faz com quem NÃO segue.
//
// `pedir` enquanto ainda cabe pedido no dia. `soltar` a partir do limite — e
// soltar é a mudança: antes o portão parava de pedir e CONTINUAVA segurando o
// cursor, o que capturava a pessoa sem lhe dar explicação nenhuma. O ramo de
// texto lê toda mensagem de quem está parado num portão como resposta a ele, e
// `interrompeOFluxo` só cede a vez a outra automação quando o passo parado é
// `dm` — então nem a palavra-chave de outra automação a alcançava.
//
// Soltar não entrega o link: quem não segue continua sem receber. O que ela
// devolve é a liberdade de ser alcançada por qualquer outra automação, e a de
// tentar de novo amanhã.
export function oQuePortaoFaz(tentativasDeHoje: number, maximo: number): "pedir" | "soltar" {
  return tentativasDeHoje < maximo ? "pedir" : "soltar";
}
```

- [ ] **Passo 4: rode e confirme que passa**

```
npx vitest run tests/steps.test.ts
grep -c "^import\|require(" lib/steps.ts
```

Esperado: PASS, e o grep devolvendo `0`.

- [ ] **Passo 5: a coluna do dia**

Em `lib/db.ts`, no fim do array de DDL:

```ts
  // Em que DIA as tentativas de follow contadas em `follow_attempts` foram
  // feitas. Sem isto o contador nunca zerava, e quem estourasse o limite ficava
  // sem receber o pedido para sempre — em toda automação, todo dia.
  //
  // Texto e não data: guarda o balde de dia de Brasília no mesmo formato das
  // chaves de deduplicação (`diaDaChave`, lib/dedupe.ts), e os dois precisam
  // continuar concordando.
  //
  // Nulo em todo contato anterior a esta mudança, e `tentativasDeHoje`
  // (lib/steps.ts) trata nulo como zero de propósito: o acumulado antigo não é
  // de hoje.
  `alter table contacts add column if not exists follow_attempts_dia text`,
```

E no tipo `Contact`: `follow_attempts_dia: string | null;`

- [ ] **Passo 6: `resolverFollow` passa a ter três respostas**

Em `lib/engine.ts`. Leia a função inteira antes de mexer — ela tem três saídas
hoje e cada uma tem comentário; **preserve todos**.

O tipo de retorno vira `"passou" | "barrar" | "soltar"`. As duas saídas que
liberam (`segue === null` e `segue === true`) devolvem `"passou"`. O resto:

```ts
  // Quantos pedidos já saíram HOJE. A leitura e a decisão são de
  // `tentativasDeHoje`/`oQuePortaoFaz` (lib/steps.ts), que são puras e testadas
  // — aqui fica só a ida ao banco.
  const hoje = dayBucket();
  const linhas = (await sql().query(
    `select follow_attempts, follow_attempts_dia from contacts
     where account_id = $1 and ig_id = $2`,
    [account.ig_user_id, contactIgId]
  )) as { follow_attempts: number; follow_attempts_dia: string | null }[];

  const jaFeitas = tentativasDeHoje(
    linhas[0]?.follow_attempts,
    linhas[0]?.follow_attempts_dia,
    hoje
  );

  if (oQuePortaoFaz(jaFeitas, MAX_FOLLOW_REQUESTS) === "soltar") {
    // Parou de pedir, então para de segurar. Quem chama solta o cursor.
    //
    // Registrado em Atividade porque, sem isso, o dono do painel vê a pessoa
    // simplesmente sumir do fluxo — que é exatamente o sintoma que esta mudança
    // existe para acabar.
    await logEvent(account.ig_user_id, "portao_soltou", {
      contact_ig_id: contactIgId,
      automation_id: auto.id,
      tentativas_hoje: jaFeitas,
    });
    return "soltar";
  }

  const tentativa = jaFeitas + 1;
  await sql().query(
    `update contacts set follow_attempts = $3, follow_attempts_dia = $4
     where account_id = $1 and ig_id = $2`,
    [account.ig_user_id, contactIgId, tentativa, hoje]
  );
```

O `enqueue` do pedido continua igual, e o `if (tentativa <= MAX_FOLLOW_REQUESTS)`
que o envolvia **sai** — quem decide agora é o `oQuePortaoFaz` acima. A função
termina com `return "barrar"`.

Acrescente `tentativasDeHoje` e `oQuePortaoFaz` ao import de `./steps`.

- [ ] **Passo 7: os dois chamadores**

`resolverFollow` tem dois chamadores. **Ache os dois** (`grep -n "resolverFollow" lib/engine.ts`)
e trate a resposta nova nos dois:

```ts
    const r = await resolverFollow(account, auto, contactIgId, p, acao.indice, contexto);
    if (r === "passou") return executarFluxo(account, auto, contactIgId, acao.indice + 1, contexto);
    if (r === "soltar") {
      // Solta em vez de gravar o cursor: a pessoa deixa de ser capturada por
      // este portão e volta a ser alcançável por qualquer automação. Ela não
      // recebe o link — o portão fez o trabalho dele —, e se reacionar a
      // automação depois, o portão roda de novo e solta de novo. Nunca prende.
      await limparCursor(account.ig_user_id, contactIgId);
      return;
    }
    await gravarCursor(account.ig_user_id, contactIgId, auto.id, identidadeDoPasso(p, acao.indice));
    return;
```

O outro chamador é o ramo do portão de passagem. Lá, `"soltar"` também limpa o
cursor e retorna — **não** segue para o destino.

**Confira você mesmo** o que acontece com a passagem: quem está adiante do portão,
deixou de seguir e já esgotou o dia agora é solto em vez de barrado no portão. É
o comportamento certo? Percorra e diga o que encontrou, mesmo que atrapalhe.

- [ ] **Passo 8: o rótulo do evento**

Em `app/labels.ts`, acrescente `portao_soltou` com um rótulo em português que
diga o que aconteceu — a pessoa não segue, o limite de pedidos do dia acabou, e
o fluxo a soltou.

- [ ] **Passo 9: `zerarTentativasFollow` e o comentário que ficou velho**

`zerarTentativasFollow` zera só `follow_attempts`. Com a coluna nova isso
continua correto (`tentativasDeHoje` devolve zero quando o contador é zero,
qualquer que seja o dia) — **confirme lendo, e escreva no comentário por que não
precisa zerar o dia junto.**

E o comentário longo dessa função descreve a armadilha que esta tarefa acabou de
fechar. Reescreva-o: o que era, o que passou a ser, e o que sobrou (o contador
continua sendo por contato, então quem gastou o dia numa automação gastou em
todas — isso **não** muda aqui).

- [ ] **Passo 10: mute e prove**

Troque `oQuePortaoFaz` para devolver sempre `"pedir"`, rode, confirme que os
testes do limite ficam vermelhos. Depois troque `tentativasDeHoje` para ignorar o
dia, rode, confirme que o teste do dia diferente fica vermelho. Desfaça as duas e
**reporte o que viu**.

- [ ] **Passo 11: verify e commit**

```
npm run verify
git add lib/steps.ts lib/db.ts lib/engine.ts app/labels.ts tests/steps.test.ts
git commit -m "O portao solta quem ele parou de cobrar, e o contador passa a ser por dia"
```

---

# Tarefa 2 · O editor em tela cheia

**Files:**
- Modify: `app/app-shell.tsx` (terceira ramificação)
- Modify: `app/automacoes/[id]/page.tsx` (o cabeçalho sai)
- Modify: `app/automacoes/editor/quadro.tsx` (barra própria, altura)

**Interfaces consumidas:** nenhuma da Tarefa 1.

## O que muda, e por quê

O quadro hoje é limitado por duas coisas: `app/app-shell.tsx:232` envolve toda
página em `mx-auto max-w-5xl px-4 py-8` — 1024px, metade de uma tela comum — e o
cabeçalho da página (migalha, título, subtítulo) come 256px de altura, que é o
`h-[calc(100vh-16rem)]` do quadro.

**Decisão do dono do produto: tela cheia, sem o menu.** Enquanto se edita, o
quadro é o aplicativo — é o que n8n e draw.io fazem. O quadro ganha uma barra
própria e fina com o caminho de volta, o nome da automação e o salvar.

- [ ] **Passo 1: a casca deixa a rota do editor passar**

`app/app-shell.tsx` é componente de cliente e já ramifica por caminho — há um
ramo para os caminhos públicos, que devolve `{children}` numa casca estreita.
Acrescente um terceiro, **antes** do retorno com o menu:

```tsx
// A rota do editor recebe a janela inteira: nada de menu, nada de `max-w`, nada
// de padding. O quadro é o aplicativo enquanto se edita, e ele traz a própria
// barra com o caminho de volta.
//
// O casamento é pela FORMA do id, e não por `startsWith("/automacoes/")`, para
// `/automacoes/nova` — que é o passo curto de criação, não o quadro — continuar
// dentro da casca normal.
const EDITOR = /^\/automacoes\/[0-9a-f-]{36}$/i;
if (EDITOR.test(pathname)) return <>{children}</>;
```

Ponha a constante junto das outras do topo do arquivo.

- [ ] **Passo 2: rode e olhe**

```
npm run dev
```

Abra `/automacoes/<id de uma automação>`. Esperado: o menu some, e a página
aparece colada nas bordas — feia, porque a barra ainda não existe. `/automacoes`
e `/automacoes/nova` continuam com o menu. **Confirme os três.**

- [ ] **Passo 3: o cabeçalho sai da página**

Em `app/automacoes/[id]/page.tsx`, tire a migalha, o `<h1>` e o subtítulo, e o
`<div className="space-y-6">` que os envolvia. A página passa a renderizar só o
`<Quadro/>`, e ele recebe o nome da automação para pôr na própria barra.

- [ ] **Passo 4: a barra do quadro**

Em `app/automacoes/editor/quadro.tsx`, o componente passa a ocupar a janela toda:
um contêiner `flex h-screen flex-col`, a barra em cima com altura própria, e o
quadro em `flex-1`.

O esqueleto, com o que vai em cada lugar:

```tsx
  return (
    <div className="flex h-screen flex-col">
      {/* A barra é fina de propósito: cada pixel dela sai do quadro, que é o
          produto desta tela. Ela leva só o que se precisa enquanto se edita. */}
      <header className="flex shrink-0 items-center gap-3 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
        <Link href="/automacoes" className="text-sm text-zinc-500 hover:text-indigo-600">
          ← Automações
        </Link>
        <span className="truncate text-sm font-medium">{nome}</span>
        <div className="ml-auto flex items-center gap-3">
          {/* recado de estado e o botão de salvar, que hoje moram no rodapé */}
        </div>
      </header>

      <div className="relative flex-1 overflow-hidden">
        {/* o quadro, a paleta e o painel — o que hoje está no `sm:flex` */}
      </div>
    </div>
  );
```

**O rodapé sai**; ter salvar em dois lugares é ter dois lugares para discordarem.

`nome` é prop nova, vinda da página. `Link` é `next/link`.

O botão continua `disabled={salvando || erros.length > 0}`, e a lista de erros
continua aparecendo — decida onde, e escreva por quê.

O véu de `inert` durante o salvamento continua cobrindo o quadro e o painel.

- [ ] **Passo 5: o celular**

O aviso de "edite pelo computador" e a lista em leitura continuam. Com a casca
fora, eles perderam o menu — **confirme que dá para voltar** a partir dessa tela,
e conserte se não der.

- [ ] **Passo 6: confira à mão e reporte item por item**

Com `npm run dev`, na tela real:

- o quadro ocupa a janela inteira, sem menu e sem margem
- o link de voltar leva para `/automacoes`
- o nome da automação aparece na barra
- salvar funciona da barra, e fica desabilitado com erro na lista
- durante o salvamento, quadro e painel ficam inertes
- `/automacoes` e `/automacoes/nova` continuam com o menu
- no celular, o aviso aparece e dá para voltar
- o painel lateral abre e fecha sem cortar o quadro

**Meça durante o gesto.** Nesta base, comparar "antes e depois" já aprovou item
quebrado três vezes, porque o defeito preservava o estado final.

- [ ] **Passo 7: verify e commit**

```
npm run verify
git add app/app-shell.tsx "app/automacoes/[id]/page.tsx" app/automacoes/editor/quadro.tsx
git commit -m "O quadro passa a ocupar a janela inteira, com barra propria"
```

---

## Depois das duas tarefas

**Revisão das duas juntas**, no modelo mais capaz. A Tarefa 1 mexe em
`lib/engine.ts`, que é `server-only` e onde nenhum teste chega — foi ele que
produziu treze defeitos na fase anterior, e três correções nele criaram defeito
pior que o original. É onde o revisor deve gastar o tempo.

**Depois disso, o teste do dono do produto**, que é o que nunca aconteceu: nada
que exige sessão foi exercitado em nenhuma tarefa desta fase.
