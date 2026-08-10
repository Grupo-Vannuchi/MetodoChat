# Deploy da Fase 1b — o editor em blocos

Roteiro de operação da branch `editor-em-blocos`. **São dois scripts, nesta
ordem, e os dois DEPOIS do push.** Este arquivo é versionado de propósito: o
roteiro morava só num ledger que o `.gitignore` não deixa entrar no repositório,
e roteiro de deploy que não vem junto do código é roteiro que a próxima pessoa
não encontra.

O plano da fase é `docs/plans/2026-08-06-editor-em-blocos.md`. Aqui está só o que
se faz no dia.

---

## O que muda no dado, e por que isso exige os dois scripts

A Fase 1b trocou **a identidade de um bloco** e **o cursor de quem está no meio
de um fluxo**:

| | antes (o que a `main` roda) | depois (o que esta branch roda) |
|---|---|---|
| identidade do bloco | o **índice** na lista (`0`, `1`, `2`) | o **id** do bloco (`b_f3br5j3n`) |
| cursor do contato | `contacts.flow_step_index` (inteiro) | `contacts.flow_step_id` (texto) |

A identidade entra na `dedupe_key` da fila (`passo:<automação>:<pessoa>:<identidade>:<dia>`),
e é ela que impede a mesma mensagem de sair duas vezes no mesmo dia.

- **`scripts/dar-ids-aos-passos.mjs`** dá id a todo bloco que ainda não tem **e
  reescreve as chaves do balde de hoje** do índice para o id. Sem essa reescrita,
  toda chave enviada no dia do deploy deixa de casar com a chave que o código
  novo produz, o `on conflict do nothing` para de segurar, e **quem reacionar a
  automação recebe de novo o que já recebeu** — reacionar é corriqueiro: basta a
  pessoa repetir a palavra-chave, que é o que ela acabou de ler na boas-vindas.
- **`scripts/converter-cursores.mjs`** traduz `flow_step_index` para
  `flow_step_id`. Sem ele, quem está parado no meio de um fluxo recomeça do zero
  — falha na direção segura (cursor que não resolve nunca pula o portão de
  follow), mas é perda real.

---

## A ordem, e ela importa

```
1. push                                            produção passa a rodar o código novo
2. node scripts/dar-ids-aos-passos.mjs             reescreve as chaves do dia
3. node scripts/converter-cursores.mjs --aplicar   converte os cursores
```

**Nada antes do push.** Rodar qualquer um dos dois com produção ainda na `main`
não adianta e chega a atrapalhar: a `main` volta a escrever índice logo em
seguida — chave nova reescrita e chave velha sendo gravada de novo, e o cursor
convertido divergindo do `flow_step_index` que a `main` continua atualizando.

**`dar-ids` antes de `converter-cursores`, sempre.** A conversão traduz o índice
consultando a lista de hoje: `identidadeDoPasso(steps[indice], indice)`. Com os
blocos ainda sem id, `identidadeDoPasso` devolve o próprio índice em texto, e o
`flow_step_id` gravado seria `"0"` — que, depois de os blocos ganharem id, não
resolve para bloco nenhum. A ordem inversa produz cursores mortos, em silêncio.

---

## Antes do push: meça a janela

Esta conferência não estava no roteiro antigo e é ela que diz se o passo 2 é
obrigatório ou inócuo. **Conte as chaves `passo:` do balde de hoje**:

```
node -e "
const fs=require('fs');const env=fs.readFileSync('.env.local','utf8');
const url=env.match(/^DATABASE_URL=(.*)\$/m)[1].trim().replace(/^[\"']|[\"']\$/g,'');
const sql=require('postgres')(url,{prepare:false,ssl:'require',onnotice:()=>{}});
(async()=>{
  const hoje=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const t=await sql\`select count(*) as n from queue
    where dedupe_key like 'passo:%' and split_part(dedupe_key,':',5) = \${hoje}\`;
  const porIndice=await sql\`select count(*) as n from queue
    where dedupe_key like 'passo:%' and split_part(dedupe_key,':',5) = \${hoje}
      and split_part(dedupe_key,':',4) ~ '^[0-9]+\$'\`;
  console.log('balde de hoje (Brasilia):', hoje);
  console.log('chaves passo: do dia:', t[0].n);
  console.log('  delas, gravadas com INDICE:', porIndice[0].n);
  const c=await sql\`select count(*) as n from contacts where flow_step_index is not null\`;
  console.log('contatos com cursor por indice:', c[0].n);
  await sql.end();
})();
"
```

Como ler:

- **`chaves passo: do dia` = 0** — a janela está vazia. Ninguém recebeu nada por
  automação hoje, e o passo 2 é inócuo. Rode assim mesmo (ele é idempotente e
  também é quem dá id a bloco que ainda não tenha), mas não há reentrega a temer.
- **`gravadas com ÍNDICE` > 0** — o passo 2 é **obrigatório**, e é esse o número
  de chaves que ele tem que reescrever. Confira contra o total que o script
  imprime no fim (`N chave(s) de hoje reescrita(s) do índice para o id`).
- **`contatos com cursor por índice` = 0** — o passo 3 não tem o que converter.
  Rode mesmo assim para confirmar; se for > 0, esse é o número de contatos que
  perdem o lugar caso ele não rode.

O balde do dia é em **Brasília** (`America/Sao_Paulo`), igual a `diaDaChave`
(`lib/dedupe.ts`). Em UTC a conta erra todo dia entre 21h e meia-noite — que é o
horário de pico.

---

## O dia do deploy, passo a passo

1. **Meça a janela** (o bloco acima). Anote os três números.

2. **Push.** Produção passa a rodar o código novo. A partir daqui, toda chave
   nova sai com o id do bloco.

3. **`node scripts/dar-ids-aos-passos.mjs`**

   Não tem ensaio a seco: ele é idempotente por construção (só reescreve chave
   cuja identidade é numérica, e id não é número), e roda automação por automação
   dentro de uma transação por automação. Confira na saída:

   - `N chave(s) de hoje reescrita(s)` bate com o `gravadas com ÍNDICE` medido;
   - `0 colisão(ões)`. Colisão significa que as duas formas da mesma mensagem já
     estavam na fila; a linha fica como está e não há o que consertar, mas o
     número precisa ser olhado, não ignorado.

4. **`node scripts/converter-cursores.mjs`** — **ensaio a seco primeiro**, sem
   `--aplicar`. Ele imprime, para cada contato, o bloco que a conversão escolheu
   (tipo e texto). **Olhe.** A conversão é fiel só se a ordem da lista não mudou
   desde que aquele cursor foi gravado; com bloco inserido ou apagado antes
   daquela posição no meio-tempo, o índice já aponta para outro bloco, e o script
   não tem como saber. O estrago possível é o de sempre — retomar adiante do
   portão de follow.

5. **`node scripts/converter-cursores.mjs --aplicar`**

6. **Confira o banco depois.** O bloco do "Passo 7" de
   `docs/plans/2026-08-06-editor-em-blocos.md` imprime blocos sem id (tem que ser
   0), contatos em fluxo e fila pendente.

---

## O que este roteiro não cobre

- **Rollback.** Voltar para a `main` depois do passo 2 deixa o banco com as
  chaves do dia no formato novo e o código gravando índice de novo: a janela de
  reentrega reabre, ao contrário. Se for preciso voltar, a saída barata é esperar
  a virada do dia (o balde expira sozinho), não desfazer a reescrita.
- **A segunda janela, a do formulário**, que este script nunca alcançou: enquanto
  o formulário foi o editor, salvar uma automação sorteava ids NOVOS para todos
  os blocos dela e órfanava as chaves do dia. Ela está **fechada** — o formulário
  saiu, e `salvarAutomacao` (`app/automacoes/actions.ts`) grava a lista como ela
  veio do quadro, com os ids preservados.
