# Portas de entrada — plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA — use
> `superpowers:subagent-driven-development`, tarefa a tarefa. Os passos usam
> caixinha (`- [ ]`).

**Objetivo:** quem abre a conversa da conta pela primeira vez vê até quatro
perguntas, toca numa, e vira contato com uma automação rodando — sem digitar
nada e sem palavra-chave.

**Arquitetura:** um gatilho novo (`abertura`) ao lado dos três que existem, um
ramo no webhook para o evento de botão, e uma tela em Configuração que gerencia
as quatro perguntas da conta e as sincroniza com a Meta. A decisão de qual
automação uma pergunta dispara é **função pura** em `lib/steps.ts`; a tela e o
motor só carregam o efeito.

**Tecnologia:** Next.js 16.2.10, React 19.2.4, Tailwind, Vitest, postgres.js.

**Spec:** `docs/specs/2026-08-26-portas-de-entrada.md`
**Experimento que a embasa:** `docs/experimentos/2026-08-26-primeiro-contato.md`
**Base:** branch `main`, commit `a371e55`.

## Restrições globais

- **`lib/steps.ts` não tem NENHUM import.** Confira com
  `grep -c "^import\|require(" lib/steps.ts` — tem que dar 0.
- **`npm test` só roda função pura.** Sem banco, sem mock, sem teste de
  componente. Integração tem comando próprio (`npm run test:integracao`), e o
  `verify` **não** o chama.
- **NADA DE MOCK.** Nem `vi.mock`, nem `vi.stubGlobal`, nem banco de mentira.
  Servidor HTTP na própria máquina não é mock.
- **Este Next.js não é o que você conhece.** Leia `node_modules/next/dist/docs/`
  antes de escrever código específico de Next.
- **Três formatos de payload convivem PARA SEMPRE:** `AUTO:<automação>`,
  `AUTO:<automação>:<bloco>` e `AUTO:<automação>:<bloco>:<botão>`. Um botão
  entregue vive na conversa da pessoa indefinidamente. **Não é dívida a limpar.**
- **A entrada do fluxo é `steps[0]`.** Limite de botões numa mensagem: **13**.
- **A `DATABASE_URL` pode ser USADA, nunca IMPRESSA.**
- **Em produção, não mexer em automação existente** — criar nova ou duplicar, e
  apagar a cópia no fim.
- **Perfis de teste: @imzetti e @alicistica.** @jvsiqueira_ saiu.
- **NÃO** rode `next build`. Se houver `npm run dev` na 3000, **não o encerre**.
- Comentários em português; commits em português **sem acentos**, sem menção a
  agente ou ferramenta.
- `npm run lint`, `npm run typecheck`, `npx vitest run` e
  `npm run test:integracao` têm que passar.

## Fatos medidos que o plano usa

- as quatro perguntas pertencem à **conta**, não à automação — máximo 4, e não
  aparecem no computador
- **só aparecem em conversa nova**: quem já falou com a conta nunca as vê
- `POST …/messenger_profile` **exige `locale`** — sem ele, `400` subcode 2534058
- o evento de botão já **chega e é registrado** como `webhook_messaging_nao_tratado`
- `scripts/perguntas-de-abertura.mjs` já lê, escreve e apaga, exercitado contra a Meta
- **as perguntas de teste em produção usam `payload` começando com `abertura-`**,
  escolhido para que `lerPayload` devolva `null` e nada dispare. **A Tarefa 6
  existe por causa disso.**

---

## Estrutura de arquivos

| arquivo | responsabilidade |
|---|---|
| `lib/steps.ts` | ler o identificador da pergunta; validar o gatilho `abertura` nas conferências |
| `lib/engine.ts` | o ramo do evento de botão: acha a automação, cria o contato, começa o fluxo |
| `app/api/webhook/route.ts` | deixar o evento de botão cair no ramo em vez do registro |
| `migrations/006-gatilho-abertura.sql` | o gatilho novo aceito pelo banco |
| `lib/perguntas-de-abertura.ts` | falar com a Meta: ler, escrever, apagar (extraído do script) |
| `app/configuracao/perguntas/` | a tela das quatro portas |
| `app/automacoes/editor/gatilho.tsx` | o gatilho `abertura` no painel |
| `testes-integracao/porta-de-entrada.integracao.ts` | o caminho de ponta a ponta |

---

## Tarefa 1 · O identificador da pergunta

**Files:**
- Modify: `lib/steps.ts` (perto de `lerPayload`, `:1874`)
- Test: `tests/steps.test.ts`

**Interfaces:**
- Produz: `payloadDaPergunta(automationId: string): string` e o reconhecimento
  desse formato dentro de `lerPayload`.

- [ ] **Passo 1 · Meça antes de escolher o formato**

Leia `lerPayload` (`lib/steps.ts:1874`) inteiro e responda **por escrito no
relatório**: o formato de duas partes `AUTO:<automação>` já existe e já significa
"comece esta automação do início". **Uma pergunta de abertura precisa de formato
novo, ou o de duas partes já serve?**

Se já servir, **não invente formato** — a Tarefa 1 vira "confirmar que serve, com
teste" e o resto do plano continua igual. Diga o que mediu.

- [ ] **Passo 2 · O teste que falha**

```ts
describe("o identificador de uma pergunta de abertura", () => {
  it("aponta para a automação, e nada mais", () => {
    const p = payloadDaPergunta("39ae24ec-c487-40ff-a387-c041cb3f0d23");
    expect(lerPayload(p)).toEqual({
      automationId: "39ae24ec-c487-40ff-a387-c041cb3f0d23",
      blocoId: undefined,
      botaoId: undefined,
    });
  });

  it("o formato de teste do experimento NÃO dispara nada", () => {
    // As perguntas configuradas em 26/08 usam este formato de propósito.
    // Enquanto elas existirem em produção, isto tem de continuar valendo.
    expect(lerPayload("abertura-saber-mais")).toBe(null);
  });
});
```

- [ ] **Passo 3 · Rode e veja falhar**

`npx vitest run tests/steps.test.ts` — esperado: `payloadDaPergunta is not defined`.

- [ ] **Passo 4 · Implemente o mínimo**, conforme o que o Passo 1 mediu.

- [ ] **Passo 5 · Rode e veja passar.** `grep -c "^import\|require(" lib/steps.ts` = 0.

- [ ] **Passo 6 · Commit.**

---

## Tarefa 2 · O gatilho `abertura`

**Files:**
- Create: `migrations/006-gatilho-abertura.sql`
- Modify: `lib/steps.ts` (as conferências de publicar), `lib/db.ts` (se houver tipo a ampliar)
- Test: `tests/steps.test.ts`

**Interfaces:**
- Consome: nada da Tarefa 1.
- Produz: `"abertura"` aceito como valor de `triggers`.

- [ ] **Passo 1 · Meça a restrição do banco**

`migrations/000-esquema-base.sql:150` traz
`triggers text[] not null default '{comment}'`. **Há `check` restringindo os
valores?** Rode contra um schema descartável e diga. Se não houver, a migração
`006` pode ser desnecessária — **diga isso em vez de criar arquivo por hábito**.

- [ ] **Passo 2 · O teste que falha**

`conferirLista(passos, gatilho, ligacoes, entregaSemPortao)` recebe o gatilho
como string (`lib/steps.ts:3191`). Há regras que dependem dele — por exemplo
`resposta_publica` só vale em `comment` (`:3309`), e `reagir_story` tem duas
regras (`:3291` e `:3300`).

```ts
describe("o gatilho abertura", () => {
  it("recusa resposta pública, que só existe em comentário", () => {
    // `resposta_publica` carrega `textos` (LISTA), e não `texto` — conferido em
    // `lib/steps.ts:48`. A primeira versão deste plano escreveu `texto` e o
    // teste falhava por FORMA, não por lógica.
    const passos = [{ id: "b_1", tipo: "resposta_publica", textos: ["oi"] }];
    const erros = conferirLista(passos, "abertura", []);
    expect(erros.filter((p) => p.nivel === "erro").length).toBeGreaterThan(0);
  });

  it("recusa reagir à story, que precisa do id da mensagem", () => {
    const passos = [{ id: "b_1", tipo: "reagir_story", emoji: "❤️" }];
    const erros = conferirLista(passos, "abertura", []);
    expect(erros.filter((p) => p.nivel === "erro").length).toBeGreaterThan(0);
  });

  it("aceita uma DM comum", () => {
    const passos = [{ id: "b_1", tipo: "dm", texto: "Que bom te ver por aqui!" }];
    expect(conferirLista(passos, "abertura", [])).toEqual([]);
  });
});
```

- [ ] **Passo 3 · Rode e veja o que falha de verdade.** Pode ser que as regras
existentes já cubram — nesse caso os dois primeiros passam sem mudança. **Diga
qual passou e qual falhou**, e mude só o que falhou.

- [ ] **Passo 4 · Implemente o que faltou.**

- [ ] **Passo 5 · Rode a suíte inteira.** Nenhum teste existente pode ficar
vermelho: `abertura` é valor novo, e valor novo não pode mudar decisão de
gatilho antigo. **Se mudar, é achado — relate.**

- [ ] **Passo 6 · Commit.**

---

## Tarefa 3 · O ramo do evento de botão, e a prova de ponta a ponta

**Files:**
- Modify: `lib/engine.ts` (em `handleMessagingEvent`), `app/api/webhook/route.ts:207-213`
- Create: `testes-integracao/porta-de-entrada.integracao.ts`

**Interfaces:**
- Consome: `payloadDaPergunta` / `lerPayload` (Tarefa 1); o gatilho `abertura` (Tarefa 2).

- [ ] **Passo 1 · Leia como o toque em botão já é tratado**

O produto já trata `quick_reply`, que é o toque num botão de mensagem. O evento
de **postback** é primo dele. Leia os dois caminhos e diga **o que dá para
reaproveitar e o que não dá** — reaproveitar o que serve é o certo; forçar o que
não serve é como um defeito desta base nasceu.

- [ ] **Passo 2 · O caminho de integração que falha**

Em `testes-integracao/`, no padrão dos cinco que já existem (leia
`banco-descartavel.ts` e `portas-de-publicar.integracao.ts`):

**ATENÇÃO — ESTE BLOCO É INTENÇÃO, NÃO CÓDIGO PARA COLAR.** A primeira versão
deste plano citou três ajudantes (`criarAutomacaoDeTeste`, `lerFila`,
`lerContato`) que **não existem**. Conferido: `testes-integracao/` exporta
`bancoDescartavel`, `comoNumaRequisicao`, `consultarPor` e outros — **leia
`portas-de-publicar.integracao.ts` e siga o padrão de lá**, escrevendo os
ajudantes que faltarem no estilo dos que existem.

O que o caso precisa fazer, e a forma das asserções:

```ts
it("tocar numa pergunta de abertura cria o contato e começa a automação", async () => {
  // 1. grave a automação no schema descartável COMO A PRODUÇÃO GRAVA:
  //    triggers ["abertura"], um passo `dm`, active true
  // 2. chame handleMessagingEvent com o evento de botão:
  //    { sender, recipient, postback: { mid, title, payload: payloadDaPergunta(id) } }
  // 3. confira PELO QUE SAIU, não perguntando à função que decidiu:
  //      - a fila ganhou uma entrada, e o `kind` dela é o esperado
  //      - o contato existe, com `last_automation_id` apontando para a automação
  //      - e o contato nasceu COM A CONTA CERTA (o plantio 3 do Passo 6 é esse)
});
```

- [ ] **Passo 3 · Rode e veja falhar.** `npm run test:integracao`

- [ ] **Passo 4 · Implemente o ramo.**

- [ ] **Passo 5 · Rode e veja passar.**

- [ ] **Passo 6 · PLANTE OS DEFEITOS, e sem isto a tarefa não vale**

Três, um de cada vez, revertendo na mesma chamada de shell e conferindo
`git status --porcelain` vazio:

1. ler o identificador do campo `title` em vez de `payload` — o `title` é o texto
   da pergunta, e "funcionaria" enquanto o texto não mudasse
2. achar a automação pela **posição** na lista em vez do identificador
3. criar o contato **sem a conta** — este atravessaria contas, e é o mais grave

Para cada um: `tsc`, `eslint`, os testes puros, `npm run varredura` e **o
caminho novo**. **Um plantio que passe pelo caminho novo é o achado mais valioso
que você pode trazer.**

- [ ] **Passo 7 · Commit.**

---

## Tarefa 4 · O gatilho no editor

**Files:**
- Modify: `app/automacoes/editor/gatilho.tsx`
- Test: prova na tela (a suíte não testa componente)

- [ ] **Passo 1 · Leia como os três gatilhos aparecem hoje** e siga o padrão.
Não invente arranjo novo.

- [ ] **Passo 2 · Implemente**: `abertura` **não pede palavra-chave**. Mostra
qual pergunta o dispara — ou, se nenhuma, um caminho para a tela de Configuração.

- [ ] **Passo 3 · Os avisos que a spec exige, na tela e não em ajuda escondida:**
não aparecem no computador; só aparecem em conversa nova.

- [ ] **Passo 4 · Prove na tela.** Chrome em depuração remota, e:
- **todo `mousePressed` precisa do `mouseReleased` num `finally`** — uma sessão
  desta base travou a tela do dono por minutos
- **meça DURANTE o gesto**, não antes e depois: nesta base a comparação
  antes/depois já aprovou item quebrado quatro vezes
- **não mexa em automação existente** — duplique, prove na cópia, apague a cópia

- [ ] **Passo 5 · Commit.**

---

## Tarefa 5 · A tela das quatro portas

**Files:**
- Create: `lib/perguntas-de-abertura.ts` (falar com a Meta) e a tela, **dentro de
  `app/setup/`** — conferido em 27/08: **NÃO existe `app/configuracao/`**, e o item
  "Configuração" do menu aponta para `/setup` (`app/app-shell.tsx:43`). A primeira
  versão deste plano mandou a tela para um diretório que não existe.
- Modify: `scripts/perguntas-de-abertura.mjs` (passa a usar o módulo, sem duplicar a regra)

**Interfaces:**
- Consome: `payloadDaPergunta` (Tarefa 1).
- Produz: leitura e escrita das quatro perguntas de uma conta.

- [ ] **Passo 1 · Extraia do script o que já foi exercitado.** Ele já acerta os
três caminhos contra a Meta, **inclusive o `locale` que a documentação omite**.
Extraia para `lib/perguntas-de-abertura.ts` e faça o script usar o módulo —
**duas cópias da mesma regra é a doença que esta base passou semanas curando.**

- [ ] **Passo 2 · A tela lê da META, não do banco.** A Meta é a verdade: o dono
pode ter mexido pelo painel dela. Mostre o que está lá.

- [ ] **Passo 3 · O que a tela mostra**, conforme a spec:
as quatro posições na ordem em que o Instagram exibe; o texto editável; para cada
uma **qual automação dispara — ou nenhuma**; por conta; e os dois avisos
(computador, conversa nova).

- [ ] **Passo 4 · O limite de quatro é da CONTA**, e a tela tem de deixar isso
óbvio — não descobrir no erro da Meta.

- [ ] **Passo 5 · Prove na tela**, com as mesmas travas da Tarefa 4. Use uma
conta de teste (`@vannuchi.eng`, `@n8xmarketing` ou `@saas.metodoia`) — **nunca
a `@thiagovannuchi`**, que tem automações reais no ar.

- [ ] **Passo 6 · Commit.**

---

## Tarefa 6 · Desarmar as perguntas de teste

**Files:** nenhum de código — é operação, e ela **fecha uma armadilha que este
projeto mesmo criou**.

Em 26/08 foram configuradas perguntas em `@vannuchi.eng`, `@n8xmarketing` e
`@saas.metodoia`, com `payload` começando por `abertura-` **para que nada
disparasse**. Quando o formato virar o identificador da automação, essas
perguntas **passam a existir num mundo onde o formato mudou** — e uma delas pode
casar com algo por acidente.

- [ ] **Passo 1 · Leia as três contas** com
`node scripts/perguntas-de-abertura.mjs --ler <conta>` e mostre o que está lá.

- [ ] **Passo 2 · Confirme pelo teste da Tarefa 1** que o formato antigo continua
devolvendo `null`. Se continuar, elas são inofensivas e podem ficar — **diga
isso** em vez de apagar por hábito.

- [ ] **Passo 3 · Se não forem inofensivas, apague-as** e registre o que foi
apagado, de qual conta.

- [ ] **Passo 4 · Confirme que a `@thiagovannuchi` continua sem nenhuma.**

- [ ] **Passo 5 · Commit** (do registro no documento do experimento).

---

## O que este plano NÃO faz

- **Não implanta.** Subir é decisão do dono, e a Tarefa 5 mexe na conta do
  Instagram dele.
- **Não mexe no Projeto B** (categoria e envio em lote), que tem desenho próprio.
- **Não persegue a atribuição por link** — medida e descartada.
