# Executar a auditoria de design — plano

> Fonte: `docs/auditoria-de-design-2026-09-10.md`. Os achados estão lá com
> medição e localização; este plano só os sequencia.

**Ordem, e o porquê dela:** D1 mente sobre uma ação do dono; D2 é risco de
apagar trabalho; D3+M1+M2 são o mesmo trabalho de disciplinar o sistema e fazer
separado significa mexer nos mesmos arquivos três vezes. O resto vem depois.

## Restrições globais
- **A suíte não testa componente.** Toda decisão sai do JSX e vira função pura.
- **Nenhum `"use client"` novo.** Nenhuma ação de servidor pode ter saída muda.
- **`lib/steps.ts` não tem NENHUM import.** Não tocar.
- A `DATABASE_URL` e a `SUPABASE_SERVICE_ROLE_KEY` podem ser USADAS, nunca
  IMPRESSAS. Não ler a `ADMIN_PASSWORD`, não forjar cookie.
- Nunca rodar `next build` nem `npm run dev`. Nunca publicar de verdade.
- Comentários em português; commits em português SEM acentos.

---

## ONDA 1 — D1: a tela para de mentir sobre o post cancelado

**O defeito, medido:** post com `status='skipped'` e
`error='cancelado por voce'` aparece em `/eventos` como
*"Não enviada · O sistema tenta de novo automaticamente · Sai em 12/09, 16:10"*.
Três afirmações falsas.

**A decisão de produto, e ela é a parte difícil:** `skipped` serve hoje para
duas coisas — o sistema pulou (janela fechada, lote vencido) e o dono cancelou.
São fatos diferentes e merecem palavras diferentes.

**O caminho barato e honesto, sem migração:** a ação de cancelar já grava
`'cancelado por voce'` em `error`. Esse texto é **escrito pelo nosso código**,
não pelo usuário — então vira constante compartilhada
(`MOTIVO_CANCELADO_PELO_DONO`), escrita pela ação e lida pelo rótulo.

**RECUSAR estado novo no banco** a menos que a medição mostre que a constante
não basta: `queue_status_check` já foi reescrito duas vezes, e um estado novo
custa migração, deploy em dois passos e a lista de `app/labels.ts`.

**Três consertos:**
1. O rótulo distingue cancelado de pulado ("Cancelada por você" contra "Não
   enviada"), e a frase explicativa para de prometer nova tentativa.
2. `dataDaLinhaDeEnvio` **não diz "Sai em" sobre estado terminal**
   (`skipped`, `failed`) — hoje ela só olha `sent_at`.
3. O motivo gravado em `error` chega à tela. Ele já existe e não é mostrado.

**Casos obrigatórios:** cancelado mostra o motivo e NÃO diz "sai em"; pulado
pelo sistema continua dizendo o que dizia; falhado com `not_before` futuro não
diz "sai em".

---

## ONDA 2 — D2: a ação destrutiva para de ser a mais discreta

**Medido:** "Excluir" é `zinc-500`; "Pausar", "Editar", "Duplicar" são
`zinc-400`. O token `btnDanger` (`app/ui.ts:85`) existe e não é usado ali.

Aplicar o tratamento de ação destrutiva a "Excluir" em
`app/automacoes/list-client.tsx`. **Sem inventar token novo** — usar o que
existe, e se ele não servir para uma ação de texto, dizer por quê antes de
criar outro.

**Cuidado:** o vermelho não pode virar o elemento mais chamativo da linha. A
distinção precisa existir sem que a lista inteira grite.

---

## ONDA 3 — D3 + M1 + M2: disciplinar o sistema

São o mesmo trabalho, e mexem nos mesmos arquivos.

**D3 — contraste.** Três tokens abaixo de 4,5:1, com raiz única em `zinc-500`:

| token | claro | escuro |
|---|---|---|
| rótulo de seção 10px | 2,49:1 | 2,58:1 |
| `hint` 12px | passa | 3,67:1 |
| `thead` 11px | passa | 4,1:1 |

`muted` (`zinc-600`/`zinc-400`) passa porque **troca de tom por tema**;
`hint` e `thead` usam `zinc-500` nos dois. **Medir o valor que passa em ambos
antes de escolher** — não chutar o próximo tom da escala.

**M1 — escala tipográfica.** 26 combinações, 13 tamanhos. Fechar os pares que
o olho não distingue (12/13, 14/15, 16/17) e subir o piso: `9px` e `10px` não
se leem confortavelmente, e `10px` aparece **277 vezes**.

**M2 — raios.** `8/12/16` é ritmo; `9px` e `10px` são avulsos.

**Como fazer sem quebrar a tela:** a mudança é em `app/ui.ts` e nos lugares que
o contornam. **Medir antes e depois com o mesmo auditor** (o script está em
`scratchpad/auditor.js`), e comparar os números — é o único jeito de saber se
a disciplina aumentou em vez de só mudar de forma.

---

## DEPOIS (não nesta rodada, e o porquê)

- **D4** (envio em massa como estado padrão de Contatos) e **D5** (os três
  números somando 181 de 125) são de arquitetura de informação, não de estilo.
  Merecem desenho próprio, com o dono decidindo.
- **D6** (`select` nativo), **D7** (cor da queda), **D8** (foco), **D9**
  (`<main>`), **D10** (trilha) — baixos, e cabem numa rodada de acabamento.
- **M3** (espaçamentos), **M4** (gráfico sem eixo), **M5** (feed repetido),
  **M6** (páginas de 11 e 14 telas).
