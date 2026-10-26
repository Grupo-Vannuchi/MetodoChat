# O RLS ligado em toda tabela do banco

**Nascido em:** 26/10/2026, sobre a `main` em `260b9dd`, da varredura de segurança que o Eduardo pediu
nesse dia. **Decisão do Eduardo pela caixa:** o RLS vem primeiro, num PR próprio, e o furo do login do
proxy num segundo PR, logo depois.

---

## O que foi medido

Na produção, numa transação `read only`, em 26/10/2026:

- **As 12 tabelas do `public` estavam com o RLS desligado:** `accounts`, `automations`,
  `bonus_gerados`, `carrosseis_gerados`, `config`, `contacts`, `events`, `followups`,
  `imagens_geradas`, `login_attempts`, `queue` e `schema_migrations`.
- **Os papéis `anon` e `authenticated` do Supabase tinham SELECT, INSERT, UPDATE, DELETE e TRUNCATE
  em todas.** É o padrão do Supabase para tabela criada no `public`, e nenhuma migração o mudava.
- **Por isso, quem tivesse a chave pública (anon) do projeto lia e mudava tudo** pela API REST do
  Supabase, sem passar pelo painel. Isso inclui os tokens do Instagram (`accounts.access_token`), as
  chaves do app (`config`) e os dados dos contatos.
- **A chave anon NÃO está nas variáveis do Chat**, e nem o Chat nem o Labs usam a API REST das
  tabelas. Não se sabe se ela circulou em outro lugar, e é por isso que o RLS fecha a porta de
  qualquer jeito: o Supabase trata essa chave como pública.
- **O app entra como `postgres`**, que é o dono de todas as tabelas e tem `bypassrls = true`. O dono
  passa por cima do RLS.

## O que muda

- **`migrations/019-rls-nas-tabelas.sql`:** um laço liga o RLS em toda tabela do schema em que
  roda, SEM NENHUMA REGRA (`policy`). Na produção, o schema é o `public`; nos testes, o descartável.
  - RLS ligado e nenhuma regra quer dizer que quem não é dono não lê e não grava nenhuma linha.
  - Não há leitor legítimo fora do dono.
  - A migração é idempotente.
- **`lib/esquema.ts`:** declara a 019 entre as não observáveis. Ela muda um atributo da tabela, que
  presença de coluna não vê, e um banco sem ela serve o painel normalmente.
- **`testes-integracao/rls-nas-tabelas.integracao.ts`:**
  - toda tabela tem o RLS;
  - um papel comum, com SELECT e INSERT, como o `anon`, não lê nenhuma linha e não grava;
  - o dono lê e grava;
  - a 019 roda duas vezes.

  O primeiro caso é a guarda do futuro: uma tabela criada por uma migração depois da 019 nasce aberta,
  e o caso cai nesse dia.

## O que não muda

O painel, o motor, a fila, o webhook, o gerador e o Labs. Nenhuma linha de dado muda.

## Medido no ensaio

- A suíte de integração no container ficou em 47 arquivos, com 534 casos passando e 8 pulando (a
  `main` tem 46 e 529).
- Os puros (3 310) e os de tela (220) não mudaram, e o `tsc` e o lint estão limpos.
- Sem a 019, o papel comum leu a `config` e gravou em `accounts`, que é a exposição da produção
  reproduzida.
- A mutação "a 019 pula a tabela `accounts`" derruba três casos.
- Sem a declaração em `lib/esquema.ts`, cai o caso "a MARCA D'ÁGUA cobre a pasta inteira".

## Como chega à produção

Pelo build do merge, como as outras migrações: o `scripts/migrar.mjs --aplicar` aplica a 019 antes do
`next build`. O preview não aplica migração, de propósito. É uma gravação no banco de produção: o OK do
Eduardo pela caixa, a hora mandada à auditoria antes, e o "pode" dela.

**A conferência depois do deploy** (a auditoria, só leitura):

- as 12 tabelas com `relrowsecurity = true`;
- o painel abre;
- um evento novo chega;
- um envio da fila sai.

## O que fica de fora, e por quê

- **Revogar os privilégios de `anon` e `authenticated`:** com o RLS e nenhuma regra, eles já não leem
  nem gravam linha. O TRUNCATE não passa pelo RLS, mas a API REST do Supabase não o oferece. Fica
  como camada extra, se a auditoria pedir. Os papéis só existem no Supabase, e não no container de
  teste.
- **Descobrir se a chave anon circulou:** não há como medir daqui. Se o Eduardo quiser, dá para
  trocá-la no painel do Supabase. Com o RLS ligado, ela deixa de abrir as tabelas.
- **O furo do login (o matcher do proxy):** é o PR seguinte, como decidido.
