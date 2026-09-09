# Ver, cancelar e remarcar o que está agendado

**Nascido em:** 04/09/2026, de pergunta do dono logo depois de a publicação
entrar no ar: *"depois que eu agendar um post, vou conseguir ver uma lista dos
posts agendados? para caso eu queira cancelar ou mudar a data"*.
**Estado:** desenho aprovado, pronto para virar plano.

---

## O que foi medido, e por que isto é buraco meu

O agendamento subiu em 03/09 e **não subiu com nenhuma forma de olhar para ele**.
Medido no código em 04/09:

| pergunta | resposta hoje |
|---|---|
| o post agendado aparece em algum lugar? | **sim** — em Atividade → Envios, como "Publicação no Instagram" / "Na fila" |
| a tela mostra QUANDO ele vai sair? | **não** — a linha mostra `sent_at ?? created_at` (`app/eventos/page.tsx:236`), ou seja a data em que foi AGENDADO |
| dá para cancelar? | **não existe ação nenhuma** — a única que cancela é `cancelarLotesVencidos`, automática, no cron |
| dá para remarcar? | **não existe** |

Um post marcado para o dia 20, criado hoje, aparece na lista com a data de hoje.
**A informação que mais importa num item agendado é justamente a que não está na
tela.**

**A raiz é um erro meu de desenho, e vale escrever:** a especificação de 03/09
disse que a tela de Envios "já existe e já mostra motivo de item pulado" — o que
é verdade, mas ela foi feita para responder *"o que aconteceu?"*, e agendamento
faz a pergunta oposta: *"o que vai acontecer, e posso mudar?"*. São duas telas,
e eu tratei como uma.

**Por que isso não pode esperar:** publicação é o primeiro recurso que escreve no
perfil público, e a API do Instagram **não apaga mídia** (medido em 03/09:
`DELETE /{ig-media-id}` só existe no caminho do Login do Facebook). Um post
agendado por engano só se corrige antes de sair. Depois, é manual no aplicativo.

---

## O desenho

### 1 · Uma tela própria, e não mais uma seção em Envios

`/publicar/agendados`. Lista os itens `publicacao` com `status = 'pending'` da
conta selecionada, **ordenados pela data de saída**, mostrando: quando sai, a
forma, o começo da legenda, e a miniatura quando houver.

**RECUSADO pendurar isto em `/eventos`.** Envios é histórico — passado,
ordenado por quando aconteceu, e a coluna de data dele significa "quando saiu".
Enfiar futuro ali obrigaria a mesma coluna a significar duas coisas, e é
exatamente o tipo de ambiguidade que esta base vem apagando.

### 2 · A corrida com o dreno é a peça central, e ela é real

O dreno reivindica assim (`lib/queue-drain.ts`):

```
update queue set status = 'sending', claimed_at = now(), attempts = attempts + 1
 where status = 'pending' and not_before <= now()  ...  for update skip locked
```

Ele roda **dentro do webhook**, a qualquer instante. Então entre você ver a lista
e clicar em cancelar, o item pode ter sido reivindicado.

**Cancelar e remarcar são `update` CONDICIONAIS**, e a condição é
`status = 'pending'`. Quando afetam **zero linhas**, a resposta honesta não é
"cancelado" nem um erro genérico: é *"este post já saiu ou está saindo agora"*.

**Fingir sucesso aqui seria a pior mentira que este painel pode contar** — o dono
fecharia a tela achando que impediu um post que já está no ar.

### 3 · A conta vem do cookie, nunca do formulário

Mesma porta que `alvoDoLote` fecha no envio em lote e que `caminhosDoCampo`
fecha na publicação: o `update` leva `account_id` do cookie de seleção no
`where`. Sem isso, um identificador trocado cancela o post de outra conta.

### 4 · Remarcar reusa a validação que já existe

`camposDaDataHora` e `momentoDaPublicacao` (`lib/publicacao.ts`, Tarefa 5) já
decidem o que é data válida, o que é passado e o fuso do produto. **Nenhuma
regra de data nova.** Data no passado é recusa, com a mesma frase.

### 5 · A linha de Envios para de mostrar a data errada

Conserto separado e pequeno, na mesma entrega: item que ainda não saiu mostra
`not_before` — quando vai sair —, e não `created_at`. Vale para qualquer tipo,
não só publicação: um lote guardado tem o mesmo problema.

### 6 · O que este projeto NÃO faz

- **Não edita o conteúdo do post.** Mudar legenda ou trocar arquivo é outro
  desenho: o arquivo já está no bucket e o caminho está no `payload`. Cancelar e
  agendar de novo resolve, e custa um clique a mais.
- **Não cancela item que já saiu** — não há como (ver §2 e a ausência de
  `DELETE` na API).
- **Não mexe em nenhuma automação existente.**

---

## Como isto fica provado

**As decisões viram funções puras, com teste:** o que a tela mostra para um item
agendado, a frase de cada desfecho do cancelamento (cancelado, tarde demais, não
é seu), e qual data a linha de Envios deve mostrar.

**O caminho de integração é obrigatório, e é onde o defeito vai morar.** No
molde de `publicar-fala.integracao.ts`, que alcança ação de servidor de verdade
sobre `comoNumaRequisicao`, sem forjar cookie:

- cancelar item `pending` funciona e ele não sai no dreno seguinte
- cancelar item já `sending` **não** o cancela, e a tela diz isso
- cancelar item de OUTRA conta não faz nada
- remarcar muda o `not_before` e o item sai na hora nova
- remarcar para o passado é recusado

**O plantio de sempre:** tirar `status = 'pending'` do `where` do cancelamento
(que passaria a cancelar item em voo), tirar `account_id` do `where`, e fazer o
resultado de zero linhas responder "cancelado".

---

## Restrições herdadas, que valem aqui

- **A suíte não testa componente.** Toda decisão sai do JSX e vira função pura.
- **Nenhuma ação de servidor pode ter saída muda** — `redirect` com aviso, frase
  de função pura. `redirect()` funciona LANÇANDO: nunca dentro de `try/catch`
  que engole.
- **`lib/steps.ts` não tem NENHUM import.**
- **Nenhum `"use client"` novo** — esta tela não precisa de nenhum.
- **A conta vem do cookie, nunca do corpo.**
- **A `DATABASE_URL` e a `SUPABASE_SERVICE_ROLE_KEY` podem ser usadas, nunca
  impressas.**
- **Este Next.js não é o que você conhece.** Ler `node_modules/next/dist/docs/`
  antes de escrever código específico de Next.
