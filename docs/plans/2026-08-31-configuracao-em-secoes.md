# Configuração em seções — plano de implementação

> **Para quem executa:** use `superpowers:subagent-driven-development` ou
> `superpowers:executing-plans`. Os passos usam caixas (`- [ ]`).

**Objetivo:** a tela `/setup` deixa de mostrar a instalação concluída por
inteiro e passa a mostrar primeiro o que o dono usa toda semana.

**Arquitetura:** `<details>`/`<summary>` nativos, sem componente de cliente e
sem estado. O atributo `open` é calculado no servidor por funções puras em
`app/setup/portas.ts`, que já é o arquivo das decisões desta tela e já tem
teste. O JSX só desenha.

**Ferramentas:** Next.js 16.2.10 (App Router, Server Components), Tailwind,
Vitest.

**Especificação:** `docs/specs/2026-08-31-configuracao-em-secoes.md`

## Restrições globais

- **A suíte NÃO testa componente.** Toda decisão tem de sair do JSX e virar
  função pura em `app/setup/portas.ts`, com caso em `tests/setup-portas.test.ts`.
- **Nenhum `"use client"` novo.** Nenhum estado, nenhum JavaScript de cliente.
- **`aberto` é DERIVADO, nunca escrito à mão.** Escrever o booleano ao lado da
  contagem é o defeito que a Tarefa 4 da fase anterior já encontrou uma vez.
- **Nada some.** Os avisos "só no celular" e "só em conversa nova" estão na
  especificação das portas de entrada e continuam na tela; o que muda é o peso.
- **Este Next.js não é o que você conhece.** Ler `node_modules/next/dist/docs/`
  antes de escrever código específico de Next.
- **Não escrever na Meta.** Nada neste plano grava; a tela já sabe ler e gravar.
- **A `DATABASE_URL` pode ser usada, nunca impressa.**
- Comentários em português. Commits em português **sem acentos**, sem trailer.

## Estrutura de arquivos

| arquivo | responsabilidade | tarefa |
|---|---|---|
| `app/setup/portas.ts` | decisões puras (já existe, 15 exports) | 1 e 2 |
| `tests/setup-portas.test.ts` | os casos das decisões (já existe) | 1 e 2 |
| `app/setup/page.tsx` | ordem dos blocos e recolhimento da instalação | 1 |
| `app/setup/portas-de-entrada.tsx` | uma conta aberta por vez, avisos compactos | 2 |

---

### Tarefa 1: A instalação recolhe, e a ordem inverte

**Arquivos:**
- Modificar: `app/setup/portas.ts` (acrescentar ao fim)
- Modificar: `tests/setup-portas.test.ts` (acrescentar ao fim + import)
- Modificar: `app/setup/page.tsx`

**Interfaces:**
- Produz: `resumoDaInstalacao(etapas: boolean[]) => { concluidas: number; total: number; aberto: boolean; texto: string }` e o tipo `ResumoDaInstalacao`.

- [ ] **Passo 1: Escrever o teste que falha**

Acrescentar ao fim de `tests/setup-portas.test.ts`:

```ts
describe("resumoDaInstalacao", () => {
  it("com tudo concluído, nasce FECHADO", () => {
    const r = resumoDaInstalacao([true, true, true, true, true, true, true, true]);
    expect(r.concluidas).toBe(8);
    expect(r.total).toBe(8);
    expect(r.aberto).toBe(false);
    expect(r.texto).toBe("8 de 8 concluídas");
  });

  // Quem está instalando pela primeira vez vê a tela de hoje, aberta.
  it("faltando uma etapa, nasce ABERTO", () => {
    const r = resumoDaInstalacao([true, true, true, false, true, true, true, false]);
    expect(r.concluidas).toBe(6);
    expect(r.aberto).toBe(true);
    expect(r.texto).toBe("6 de 8 concluídas — falta terminar");
  });

  it("instalação zerada nasce aberta", () => {
    const r = resumoDaInstalacao([false, false, false]);
    expect(r.concluidas).toBe(0);
    expect(r.aberto).toBe(true);
    expect(r.texto).toBe("0 de 3 concluídas — falta terminar");
  });

  // Lista vazia é "nada a instalar", e nada a instalar não pede atenção.
  it("lista vazia não abre nada e não estoura", () => {
    expect(resumoDaInstalacao([])).toEqual({
      concluidas: 0,
      total: 0,
      aberto: false,
      texto: "Nenhuma etapa de instalação.",
    });
  });

  // O CASO QUE PRENDE A REGRA, e ele existe porque escrever `aberto` ao lado da
  // contagem já produziu defeito nesta base: um booleano escrito à mão continua
  // dizendo "fechado" depois que alguém acrescenta uma etapa que falta.
  // `aberto` tem de ser SEMPRE `concluidas < total`, para toda combinação.
  it("`aberto` é derivado da contagem, e não escrito à parte", () => {
    for (let total = 0; total <= 6; total++) {
      for (let feitas = 0; feitas <= total; feitas++) {
        const etapas = Array.from({ length: total }, (_, i) => i < feitas);
        const r = resumoDaInstalacao(etapas);
        expect(r.aberto, `${feitas} de ${total}`).toBe(r.concluidas < r.total);
      }
    }
  });
});
```

E acrescentar `resumoDaInstalacao,` à lista de imports no topo do arquivo
(a lista está em ordem alfabética; entra depois de `perguntasDoFormulario,`).

- [ ] **Passo 2: Rodar e ver falhar**

Rodar: `npx vitest run tests/setup-portas.test.ts`
Esperado: FALHA na importação — `resumoDaInstalacao` não existe.

- [ ] **Passo 3: Escrever a função**

Acrescentar ao fim de `app/setup/portas.ts`:

```ts
// ============================================================
// A INSTALAÇÃO NASCE FECHADA QUANDO TERMINOU — e a medição que obrigou isso.
//
// Medido em 31/08/2026 na tela de produção, com os dados do dono: a página tem
// 6341 px para uma janela de 623 (10,2 telas). As oito etapas de instalação
// ocupam 3181 px — 5,1 telas — e as OITO estão concluídas. No topo, a barra diz
// "Configuração concluída, 100%"; logo abaixo, a tela ensina em quatro passos
// numerados como criar o app na Meta do zero.
//
// O bloco que o dono usa toda semana ("Perguntas de abertura") só começa no
// pixel 3721 — a sexta tela.
//
// `aberto` É DERIVADO, e isto não é preferência: `LIGAR_FUNCIONA`, neste mesmo
// arquivo, nasceu escrito à mão e mentiu até virar cálculo. Um booleano escrito
// ao lado da contagem continua dizendo "fechado" no dia em que alguém
// acrescenta uma nona etapa que falta.
// ============================================================

export type ResumoDaInstalacao = {
  concluidas: number;
  total: number;
  /** DERIVADO: `concluidas < total`. Nunca escrever este valor à mão. */
  aberto: boolean;
  texto: string;
};

export function resumoDaInstalacao(etapas: boolean[]): ResumoDaInstalacao {
  const total = etapas.length;
  const concluidas = etapas.filter(Boolean).length;
  const aberto = concluidas < total;
  const texto =
    total === 0
      ? "Nenhuma etapa de instalação."
      : aberto
        ? `${concluidas} de ${total} concluídas — falta terminar`
        : `${total} de ${total} concluídas`;
  return { concluidas, total, aberto, texto };
}
```

- [ ] **Passo 4: Rodar e ver passar**

Rodar: `npx vitest run tests/setup-portas.test.ts`
Esperado: PASSA, com 5 casos novos.

- [ ] **Passo 5: Commitar**

```bash
git add app/setup/portas.ts tests/setup-portas.test.ts
git commit -m "A instalacao ganha um resumo, com o aberto derivado da contagem"
```

- [ ] **Passo 6: Nomear as oito etapas em `page.tsx`**

Em `app/setup/page.tsx`, logo depois da linha `const pct = Math.round(...)`
(por volta da linha 102), acrescentar:

```tsx
  // AS OITO ETAPAS, NOMEADAS. A lista existe para que a contagem do resumo e o
  // `done` de cada etapa venham da MESMA fonte. Com índices numéricos, um
  // off-by-one deixaria o resumo dizendo "7 de 8" sobre a etapa errada e nada
  // acusaria — os nomes tiram esse caso da mesa.
  const ETAPAS = {
    criarApp: metaOk,
    credenciais: metaOk,
    oauth: connected,
    webhook: hasEvents,
    publicar: hasEvents,
    conectar: connected,
    testar: hasEvents,
    revisar: metaOk && connected && hasEvents,
  };
  const instalacao = resumoDaInstalacao(Object.values(ETAPAS));
```

**`app/setup/page.tsx` NÃO importa de `./portas` hoje — conferido.** Criar a
linha, depois do import de `./actions` (linha 4):

```tsx
import { resumoDaInstalacao } from "./portas";
```

`card` e `muted`, usados nos trechos abaixo, já vêm do import de `../ui` na
linha 15 — não mexer nele.

Trocar o `done={...}` de cada `<Step>` pelo nome correspondente, **nesta ordem
exata**, que é a ordem em que eles aparecem hoje no arquivo:

| linha de hoje | `number` | `done` de hoje | passa a ser |
|---|---|---|---|
| 153 | 1 | `metaOk` | `ETAPAS.criarApp` |
| 190 | 2 | `metaOk` | `ETAPAS.credenciais` |
| 230 | 3 | `connected` | `ETAPAS.oauth` |
| 249 | 4 | `hasEvents` | `ETAPAS.webhook` |
| 294 | 5 | `hasEvents` | `ETAPAS.publicar` |
| 354 | 6 | `connected` | `ETAPAS.conectar` |
| 424 | 7 | `hasEvents` | `ETAPAS.testar` |
| 456 | 8 | `metaOk && connected && hasEvents` | `ETAPAS.revisar` |

- [ ] **Passo 7: Recolher as oito etapas**

Envolver os oito `<Step>` (do `<Step number={1}` até o `</Step>` do número 8)
com:

```tsx
      <details open={instalacao.aberto}>
        <summary className={`flex cursor-pointer list-none items-center gap-2 p-5 ${card}`}>
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
              instalacao.aberto
                ? "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"
                : "bg-emerald-500 text-white"
            }`}
          >
            {instalacao.aberto ? "!" : "✓"}
          </span>
          <span className="text-base font-semibold">Instalação</span>
          <span className={`ml-auto text-xs font-normal ${muted}`}>{instalacao.texto}</span>
        </summary>
        <div className="mt-5 space-y-5">
          {/* os oito <Step> entram aqui, sem nenhuma outra alteração */}
        </div>
      </details>
```

O `<details>` externo **não leva** a classe `card`: quem a leva é o `<summary>`.
Os oito `<Step>` continuam com o cartão próprio de cada um, então aberto fica
igual a hoje, com uma linha de cabeçalho a mais.

- [ ] **Passo 8: Inverter a ordem e recolher o status técnico**

Mover os dois blocos de uso corrente para **antes** do `<details>` da
instalação, mantendo cada um exatamente como está:

1. `{connected && (<section …>Diagnóstico das contas…</section>)}`
2. `{connected && (<section …>Perguntas de abertura…</section>)}`

A ordem final dentro do `<div className="mx-auto max-w-3xl space-y-5">` passa a ser:
cabeçalho e barra → alertas (`sp.erro`, `sp.salvo`, `urlInstavel`) →
**Perguntas de abertura** → **Diagnóstico das contas** → `<details>` da
instalação → Status técnico.

E o bloco "Status técnico" do fim vira:

```tsx
      <details>
        <summary className={`flex cursor-pointer list-none items-center gap-2 p-5 ${card}`}>
          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            Status técnico
          </span>
        </summary>
        <div className={`mt-2 p-5 text-xs ${card} ${muted}`}>
          {/* a <ul> de hoje entra aqui, sem alteração */}
        </div>
      </details>
```

- [ ] **Passo 9: Conferir os portões**

```bash
npm run lint && npm run typecheck && npx vitest run
```
Esperado: os três limpos, e a contagem de testes puros sobe em 5.

- [ ] **Passo 10: Commitar**

```bash
git add app/setup/page.tsx
git commit -m "A instalacao concluida recolhe, e o uso corrente sobe para o topo"
```

---

### Tarefa 2: Uma conta aberta por vez, e os dois avisos viram um

**Arquivos:**
- Modificar: `app/setup/portas.ts` (acrescentar ao fim)
- Modificar: `tests/setup-portas.test.ts` (acrescentar ao fim + import)
- Modificar: `app/setup/portas-de-entrada.tsx`

**Interfaces:**
- Consome: nada da Tarefa 1.
- Produz: `contagemDaConta(usadas: number) => string`.

- [ ] **Passo 1: Escrever o teste que falha**

Acrescentar ao fim de `tests/setup-portas.test.ts`:

```ts
describe("contagemDaConta", () => {
  // A LINHA FECHADA TEM DE DENUNCIAR O QUE ESTÁ LÁ. Em 31/08/2026 três contas
  // exibiam perguntas do experimento de 26/08 sem ninguém perceber; se a conta
  // fechada não disser quantas tem, ela deixa de ser vista.
  it("diz quantas perguntas a conta tem", () => {
    expect(contagemDaConta(4)).toBe("4 perguntas");
    expect(contagemDaConta(2)).toBe("2 perguntas");
  });

  it("o singular é singular", () => {
    expect(contagemDaConta(1)).toBe("1 pergunta");
  });

  it("conta sem pergunta diz isso, e não fica em branco", () => {
    expect(contagemDaConta(0)).toBe("nenhuma pergunta");
  });

  it("número inválido cai no caso vazio em vez de imprimir lixo", () => {
    expect(contagemDaConta(-1)).toBe("nenhuma pergunta");
  });
});
```

E acrescentar `contagemDaConta,` à lista de imports no topo (ordem alfabética:
entra depois de `contaDoFormulario,`).

- [ ] **Passo 2: Rodar e ver falhar**

Rodar: `npx vitest run tests/setup-portas.test.ts`
Esperado: FALHA na importação — `contagemDaConta` não existe.

- [ ] **Passo 3: Escrever a função**

Acrescentar ao fim de `app/setup/portas.ts`:

```ts
/**
 * A contagem que aparece na linha de uma conta FECHADA.
 *
 * Ela existe para que fechar não vire esconder: medido em 31/08/2026, três
 * contas exibiam perguntas escritas durante um experimento e ninguém tinha
 * motivo para abri-las. A linha fechada é o único lugar onde isso aparece.
 *
 * O texto é curto de propósito — `resumoDoLimite` já dá a frase completa para
 * a conta ABERTA, e repeti-la aqui encheria a linha sem dizer mais nada.
 */
export function contagemDaConta(usadas: number): string {
  if (!Number.isFinite(usadas) || usadas <= 0) return "nenhuma pergunta";
  return usadas === 1 ? "1 pergunta" : `${usadas} perguntas`;
}
```

- [ ] **Passo 4: Rodar e ver passar**

Rodar: `npx vitest run tests/setup-portas.test.ts`
Esperado: PASSA, com 4 casos novos.

- [ ] **Passo 5: Commitar**

```bash
git add app/setup/portas.ts tests/setup-portas.test.ts
git commit -m "A conta fechada continua dizendo quantas perguntas tem"
```

- [ ] **Passo 6: Saber qual conta está selecionada**

**`app/setup/portas-de-entrada.tsx` NÃO importa de `@/lib/account` hoje —
conferido.** Criar a linha, depois do import de `@/lib/db` (linha 1):

```tsx
import { getSelectedAccountId } from "@/lib/account";
```

`getSelectedAccountId` existe em `lib/account.ts:16`, devolve `string | null`, e
cai na primeira conta quando não há cookie.

Dentro de `PortasDeEntrada`, logo depois de `if (!accounts.length) return null;`:

```tsx
  // QUAL CONTA ABRE. O menu lateral já é o único lugar que troca de conta no
  // painel inteiro (`lib/account.ts`), e ele cai na primeira conta quando não
  // há cookie — então esta linha nunca fica sem resposta.
  const selecionada = await getSelectedAccountId();
```

- [ ] **Passo 7: Uma conta aberta, as outras em uma linha**

Trocar o `<div key={c.igUserId} className={`p-4 ${subtle}`}>` de hoje por um
`<details>`, mantendo TODO o conteúdo interno como está:

```tsx
          <details key={c.igUserId} open={c.igUserId === selecionada} className={`p-4 ${subtle}`}>
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2">
              <span className="font-medium">@{c.username}</span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {contagemDaConta(c.leitura.perguntas.length)}
              </span>
            </summary>
            <div className="mt-3">
              {/* todo o conteúdo que hoje está dentro do <div>, sem alteração —
                  inclusive o cabeçalho com o `resumo.texto` e o formulário */}
            </div>
          </details>
```

Acrescentar `contagemDaConta` ao import de `./portas` que já existe no arquivo.

- [ ] **Passo 8: Os dois avisos viram um**

Trocar os dois blocos (`alertWarn` e `alertInfo`, hoje nas linhas 78–85) por:

```tsx
      {/* OS DOIS AVISOS, NUMA NOTA SÓ. Eles continuam visíveis e continuam
          dizendo as duas coisas: os dois explicam por que a pergunta que o dono
          acabou de salvar "não apareceu", e é a dúvida que ele teria em
          seguida. O que saiu foi o peso de duas caixas de bloco inteiro, medido
          em 31/08 como um terço de tela antes de qualquer coisa acionável. */}
      <div className={alertWarn}>
        <b>Só aparecem no aplicativo do celular, e só em conversa nova.</b> No Instagram do
        computador elas não são exibidas, e quem já trocou mensagem com a conta nunca mais as
        vê — para testar, use um perfil que nunca falou com esta conta.
      </div>
```

Se `alertInfo` deixar de ser usado no arquivo, remover o import dele.

- [ ] **Passo 9: Conferir os portões**

```bash
npm run lint && npm run typecheck && npx vitest run
```
Esperado: os três limpos, e a contagem de testes puros sobe em mais 4.

- [ ] **Passo 10: Commitar**

```bash
git add app/setup/portas-de-entrada.tsx
git commit -m "As perguntas abrem uma conta por vez, e os avisos viram uma nota"
```

---

## Como isto é provado na tela

A suíte não testa componente, então estes itens são de roteiro, feitos com a
depuração remota do Chrome contra o `npm run dev` local ou a produção. **Ler é
permitido; não salvar nada.**

- [ ] Com tudo concluído, a página abre com a instalação **fechada**, e o
      cabeçalho diz `8 de 8 concluídas`.
- [ ] `document.body.scrollHeight` cai de **6341 px** para perto de **1500 px**.
      Medido assim: `browser-harness` → `js("document.body.scrollHeight")`.
- [ ] Clicar em `Instalação` mostra as oito etapas na mesma ordem e com o mesmo
      texto de hoje.
- [ ] `Perguntas de abertura` é o primeiro bloco depois do cabeçalho.
- [ ] A conta selecionada no menu lateral é a que está aberta; trocar de conta
      pelo menu troca qual abre.
- [ ] Uma conta fechada mostra a contagem certa — hoje, `@vannuchi.eng` tem de
      dizer `4 perguntas`, `@n8xmarketing` e `@saas.metodoia` `3 perguntas`, e
      `@thiagovannuchi` `nenhuma pergunta`.
- [ ] O aviso do celular e da conversa nova continua visível, em uma nota só.
