# Ver, cancelar e remarcar o agendado — plano de implementação

> **Para trabalhadores agênticos:** SUB-SKILL OBRIGATÓRIA: use
> superpowers:subagent-driven-development.

**Objetivo:** uma tela que lista os posts agendados, com cancelar e remarcar.

**Arquitetura:** tela de servidor em `/publicar/agendados`; duas ações de
servidor com `update` CONDICIONAL em `status = 'pending'` e `account_id` do
cookie; as frases e a leitura da linha em funções puras com teste. Nenhuma regra
de data nova — `camposDaDataHora` e `momentoDaPublicacao` já existem.

## Restrições globais

- **A suíte não testa componente.** Decisão em JSX ou em rota é defeito.
- **Nenhum `"use client"` novo.**
- **Nenhuma ação de servidor pode ter saída muda.** `redirect()` funciona
  LANÇANDO — nunca dentro de `try/catch` que engole.
- **A conta vem do cookie de seleção, nunca do formulário.**
- **`lib/steps.ts` não tem NENHUM import.** Não tocar. Nenhuma migração nova.
- A `DATABASE_URL` e a `SUPABASE_SERVICE_ROLE_KEY` podem ser USADAS, nunca
  IMPRESSAS. Não ler a `ADMIN_PASSWORD`, não forjar cookie.
- Nunca rodar `next build` nem `npm run dev`. Nunca publicar de verdade.
- Comentários em português; commits em português SEM acentos, terminando com
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

---

### Tarefa 1: as decisões puras

**Arquivos:** `lib/publicacao.ts` (acrescentar), `tests/publicacao.test.ts`.

**Produz:**

```ts
export type DesfechoDaMudanca = "feito" | "tarde_demais" | "nao_encontrado" | "data_invalida" | "data_no_passado";
export function desfechoDaMudanca(linhasAfetadas: number, existe: boolean): DesfechoDaMudanca;
export function textoDoDesfecho(d: DesfechoDaMudanca, acao: "cancelar" | "remarcar"): string;
/** A data que a linha deve mostrar: quando SAIU, ou quando VAI sair. */
export function dataDaLinhaDeEnvio(item: { status: string; sent_at: Date | null; not_before: Date; created_at: Date }): { quando: Date; futuro: boolean };
```

- [ ] **Passo 1: escrever os testes primeiro, e ver o vermelho**

Os casos que TÊM de existir:

```ts
describe("desfechoDaMudanca", () => {
  it("uma linha afetada e feito", () => {
    expect(desfechoDaMudanca(1, true)).toBe("feito");
  });
  // ZERO LINHAS COM O ITEM EXISTINDO E A CORRIDA COM O DRENO, e este e o caso
  // central desta entrega: o dreno roda DENTRO do webhook e pode ter
  // reivindicado o item entre a tela ser desenhada e o clique. Responder
  // "cancelado" aqui seria a pior mentira que este painel pode contar — o dono
  // fecharia a tela achando que impediu um post que ja esta no ar.
  it("zero linhas com o item existindo e tarde demais", () => {
    expect(desfechoDaMudanca(0, true)).toBe("tarde_demais");
  });
  it("zero linhas sem o item e nao encontrado", () => {
    expect(desfechoDaMudanca(0, false)).toBe("nao_encontrado");
  });
});

describe("textoDoDesfecho", () => {
  // A FRASE DE "tarde demais" TEM DE DIZER QUE O POST SAIU, e nao so que o
  // cancelamento falhou: sao fatos diferentes, e o segundo sozinho deixa o dono
  // achando que pode tentar de novo.
  it("tarde demais diz que o post ja saiu", () => {
    const t = textoDoDesfecho("tarde_demais", "cancelar").toLowerCase();
    expect(t).toMatch(/saiu|saindo|publicad/);
  });
  it("cancelar e remarcar tem frases diferentes no mesmo desfecho", () => {
    expect(textoDoDesfecho("feito", "cancelar")).not.toBe(textoDoDesfecho("feito", "remarcar"));
  });
});

describe("dataDaLinhaDeEnvio", () => {
  const criado = new Date("2026-09-04T10:00:00Z");
  const saida = new Date("2026-09-20T14:00:00Z");
  // O DEFEITO QUE ESTA ENTREGA CONSERTA: a linha mostrava `sent_at ?? created_at`,
  // entao um post marcado para o dia 20 aparecia com a data de hoje.
  it("item que ainda nao saiu mostra QUANDO VAI SAIR", () => {
    const r = dataDaLinhaDeEnvio({ status: "pending", sent_at: null, not_before: saida, created_at: criado });
    expect(r.quando).toEqual(saida);
    expect(r.futuro).toBe(true);
  });
  it("item que saiu mostra quando saiu", () => {
    const enviado = new Date("2026-09-04T10:05:00Z");
    const r = dataDaLinhaDeEnvio({ status: "sent", sent_at: enviado, not_before: criado, created_at: criado });
    expect(r.quando).toEqual(enviado);
    expect(r.futuro).toBe(false);
  });
  // O LOTE GUARDADO TEM O MESMO PROBLEMA, e por isso a funcao nao olha o `kind`:
  // ele espera a pessoa voltar a falar, entao `not_before` nao e promessa de
  // hora — mas ainda e mais honesto que a data em que foi criado.
  it("guardado nao e passado", () => {
    expect(dataDaLinhaDeEnvio({ status: "guardado", sent_at: null, not_before: saida, created_at: criado }).futuro).toBe(true);
  });
  // `not_before` no passado com status pending: o item esta ATRASADO, nao no
  // futuro. A tela nao pode prometer uma saida que ja devia ter acontecido.
  it("pendente com hora ja vencida nao e futuro", () => {
    const passado = new Date("2026-09-01T10:00:00Z");
    expect(dataDaLinhaDeEnvio({ status: "pending", sent_at: null, not_before: passado, created_at: criado }).futuro).toBe(false);
  });
});
```

- [ ] **Passo 2: implementar** em `lib/publicacao.ts`, sem import que puxe
      `server-only`.
- [ ] **Passo 3: verde**, e a suíte inteira também.
- [ ] **Passo 4: plantar** — `desfechoDaMudanca(0, true)` devolvendo `"feito"`.
      Esperado: VERMELHO em dois casos. Reverter e conferir a árvore.
- [ ] **Passo 5: commitar.**

---

### Tarefa 2: as duas ações e a tela

**Arquivos:** criar `app/publicar/agendados/page.tsx` e
`app/publicar/agendados/actions.ts`; modificar `app/eventos/page.tsx`.

- [ ] **Passo 1: as duas ações**

Molde: `app/publicar/actions.ts`, que já é o molde corrigido de 02/09 — nenhuma
saída muda, `redirect` com aviso, frase de função pura.

**O `update` do cancelamento:**

```sql
update queue set status = 'skipped', error = 'cancelado por voce'
 where id = $1 and account_id = $2 and kind = 'publicacao' and status = 'pending'
 returning id
```

**As três condições do `where` são três defesas diferentes, e cada uma tem
plantio:** `status = 'pending'` fecha a corrida com o dreno; `account_id` impede
cancelar post de outra conta; `kind` impede que um identificador trocado atinja
uma mensagem.

Quando voltar zero linhas, **consulte se o item existe** (sem o filtro de
status) para distinguir "tarde demais" de "não é seu", e passe isso a
`desfechoDaMudanca`. Duas idas ao banco só no caminho de falha, que é raro.

**O `update` do remarcar** é o mesmo, trocando `status` por
`not_before = $3`. A data passa por `momentoDaPublicacao` ANTES — data no
passado é recusa, com a frase que já existe.

- [ ] **Passo 2: a tela**

`app/publicar/agendados/page.tsx`, componente de **servidor**. Lista
`kind = 'publicacao' and status = 'pending'` da conta selecionada, **ordenado
por `not_before`**. Cada linha: quando sai, a forma, o começo da legenda, e dois
formulários — cancelar (com confirmação) e remarcar (campo de data e hora).

Estado vazio: dizer que não há nada agendado, e apontar para `/publicar`.

**Um link para esta tela** entra em `app/publicar/page.tsx`. Sem link, ela não
existe para quem usa.

- [ ] **Passo 3: a linha de Envios para de mostrar a data errada**

`app/eventos/page.tsx:236` usa `fmtDate(q.sent_at ?? q.created_at)`. Passa a usar
`dataDaLinhaDeEnvio`, e quando `futuro` for verdadeiro a linha diz que é uma
previsão — "sai em", e não só a data solta.

- [ ] **Passo 4: o caminho de integração** — é onde o defeito vai morar

`testes-integracao/agendados.integracao.ts`, no molde de
`publicar-fala.integracao.ts` (que alcança ação de servidor sobre
`comoNumaRequisicao`, **sem forjar cookie**). Os casos:

- cancelar item `pending` funciona, e ele **não sai** no dreno seguinte
- cancelar item já `sending` **não** o cancela, e o desfecho é `tarde_demais`
- cancelar item de OUTRA conta não faz nada
- cancelar um `dm_manual` pelo identificador não faz nada
- remarcar muda o `not_before`, e o item sai na hora nova
- remarcar para o passado é recusado

- [ ] **Passo 5: plantar e medir**

1. tirar `status = 'pending'` do `where` → cancela item em voo. VERMELHO.
2. tirar `account_id` do `where` → cancela post de outra conta. VERMELHO.
3. tirar `kind = 'publicacao'` do `where` → atinge mensagem. VERMELHO.
4. zero linhas respondendo `"feito"` → a mentira. VERMELHO.
5. mover o `redirect` de sucesso para dentro de um `try/catch`. **Diga o que
   deu** — a rede de `publicar-fala.integracao.ts` existe para isto.

- [ ] **Passo 6: conferir os cinco portões e commitar.**
