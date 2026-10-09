# Gerador de bônus — Plano de implementação da Etapa 6: o criador de imagem

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: `superpowers:subagent-driven-development`
> (recomendada) ou `superpowers:executing-plans`, fase por fase. Os passos usam caixa de
> seleção (`- [ ]`) para acompanhar.

> **Adendo de 09/10:** a prova da FASE 6.9 parou no passo 6, e a spec ganhou o adendo do estilo do
> Chat e do modelo novo. As FASES 6.10 a 6.14 estão na seção "ADENDO DE 09/10", no fim deste plano, com
> o Apêndice B.

**Objetivo:** em cada slide com espaço, o operador descreve a cena, o Chat pede a imagem à OpenAI e ela
entra no espaço da arte exatamente como uma foto subida; o pedido volta na hora, a imagem é gerada em
segundo plano e o card acompanha, com teto de 10 imagens em 24 horas.

**Arquitetura:** as regras de estilo são cópias, byte a byte, dos dois módulos puros da ilustração do
Labs (`prompt-ilustracao.ts` e `erro-ilustracao.ts`), travadas pela soma do git. Um módulo `server-only`
chama a OpenAI com `fetch` (o corpo do Labs, em JPEG), e a imagem que volta é conferida pela regra da
foto do espaço. A migração 018 cria `imagens_geradas`, uma linha por pedido, que serve ao teto (trava
própria, um slide de cada vez) e ao acompanhar. A action `pedirImagemDoSlide` confere e reserva e volta
na hora; a geração roda no `after()` dela e guarda a imagem pelo caminho do "Subir foto"
(`assinarImagem` e `guardarImagem`), e por isso a rota da arte, o publicar e a fila não mudam. O card
pergunta o estado por uma rota GET ao lado da rota da arte, fora da fila das actions (achado 88).

**Stack:** a das etapas anteriores, no Next.js 16.3.8: App Router, Server Actions e `after()`, React
19, Postgres (postgres.js via `lib/db.ts`), Vitest (três suítes), Tailwind v4 com os tokens de
`app/ui.ts`. A OpenAI entra por `fetch`, sem SDK: nada muda no `package.json`.

**Spec:** `docs/specs/2026-10-09-criador-de-imagem.md` (commits `f7cb5fa` e `ad8ecd6`, liberada pela
auditoria com o 88 resolvido e o 89 anotado, e lida pelo Eduardo; `58feaf0` registra o que o ensaio
acertou nas cópias do Labs, itens 1 e 2 abaixo). Leia antes de começar: este plano não repete o porquê
das regras, só como construí-las.

**Ensaio do plano (09/10):** o código deste plano foi escrito e testado fase a fase numa cópia isolada
do repositório (`git worktree`, branch local `ensaio-imagem`, sem push, saída de `ad8ecd6`), e todo
bloco de código abaixo foi tirado do git dessa cópia por um gerador, sem cópia à mão. Os números do
ensaio:
- lint e `tsc` limpos em cada fase; no fim, 116 arquivos e 3 209 casos puros (108 e 3 119 na base), 23
  e 201 de tela (22 e 189 na base);
- `next build --webpack` limpo, com `ƒ /bonus/[id]/carrossel/[cid]/imagem` e `ƒ /carrosseis/[cid]/imagem`
  na lista, e o `AGENTS.md` intacto (o Turbopack, ver o item 8 abaixo);
- integração no container: 45 arquivos; 486 passaram, 8 pularam e 7 caíram, só os de
  `registro-de-migracoes`, pelo item 8 abaixo. Na árvore do projeto, a conta esperada é 45 arquivos,
  493 passaram e 8 pularam (FASE 6.8);
- cada fase foi vista falhar antes do código e passar depois, na ordem deste plano, com os números de
  cada uma no passo dela;
- as 34 provas de mutação do Apêndice A derrubaram, cada uma, o caso esperado;
- o plano, aplicado do zero sobre `ad8ecd6` numa cópia limpa, dá os 32 arquivos iguais ao fim do
  ensaio, byte a byte;
- a guarda do diff (FASE 6.8, passo 4) saiu como esperada: nada do `/publicar`, do bucket, da fila, das
  automações, do `scripts/migrar.mjs`, das rotas da arte nem das dependências; nas migrações, só a 018;
- a varredura da chave (FASE 6.8, passo 5): nenhuma chave com cara de verdadeira no diff nem nas
  mensagens dos commits; `OPENAI_API_KEY` só nos dois módulos do servidor e em três testes, que usam
  uma chave inventada; nenhum `console` nos arquivos novos;
- a OpenAI nunca foi chamada: os testes e as mutações usam um `fetch` falso e uma OpenAI falsa.

O ensaio achou estas coisas, já resolvidas neste plano:
1. **As cópias levam os nomes do Labs** (`lib/bonus/prompt-ilustracao.ts` e
   `lib/bonus/erro-ilustracao.ts`), e a trava é a soma do git de cada arquivo (a mesma de
   `git hash-object` e do GitHub), conferida em `tests/bonus-ilustracao-copia.test.ts`. Por isso a cópia
   não ganha nem um cabeçalho; a origem fica escrita no teste. Os testes do Labs para os dois arquivos
   vêm junto, com o caminho do import trocado e um cabeçalho que diz a origem (FASE 6.2).
2. **O 401 da OpenAI traz um pedaço da chave na mensagem** ("Incorrect API key provided: sk-proj-…"), e
   a frase do Labs a repassava. O Eduardo decidiu no Labs filtrar; a cópia de `erro-ilustracao.ts` é a da
   dev do Labs em `69c079d` (blob `6a5e8f55`), que chega à main de lá no próximo deploy deles; a de
   `prompt-ilustracao.ts` é a da main em `672ee71` (blob `d993e809`). Além disso, o Chat passa toda frase
   da OpenAI por `tirarChave` (FASE 6.3) antes de mostrar ou gravar: o pedaço `sk-…` e a chave inteira
   viram "…". Cada guarda tem a sua mutação (Apêndice A).
3. **`conferirCarrossel` passa a ser exportada** de `lib/bonus/publicar-processo.ts` (só o `export` e o
   comentário, FASE 6.5): o pedido confere o carrossel exatamente como o publicar (pronto, com a conta
   gravada e conectada, e a trava livre), sem copiar a regra. É a única mudança num arquivo do publicar
   do carrossel, e os 46 casos de `bonus-publicar-processo` passam antes e depois.
4. **O editor ganha a prop `intervaloDaConsultaMs`** (o padrão é `INTERVALO_CONSULTA_MS`, 2 s), para o
   teste de tela acompanhar sem esperar 2 s a cada pergunta (FASE 6.7).
5. **Os cinco atalhos ficam em linhas (`<p>`), e não numa lista:** os testes de tela do card contam os
   itens da lista da página (`getAllByRole("listitem")`), e uma lista dentro do card os deslocava.
6. **Um caso de tela passa antes do código, de propósito:** "não aparece com o carrossel na fila" (FASE
   6.7), porque sem o código não há botão nenhum. A mutação "6.7: o Gerar imagem com o carrossel na
   fila" o derruba (Apêndice A).
7. **A página do carrossel lê `imagens_geradas`** (a conta do dia, a última descrição e o que está
   gerando, FASE 6.7). Por isso a 018 entra na produção antes do push (FASE 6.9): o preview usa o banco
   de produção, e sem a tabela a página do carrossel cairia lá.
8. **A cópia de ensaio derruba `registro-de-migracoes`** (7 casos: o script recusa `--a-mao` sem o
   `.env.local`, que a cópia não tem), e o **`next build` do `verify` (Turbopack) não roda na cópia**,
   que tem o `node_modules` por junção. Na árvore do projeto os dois rodam (FASE 6.8).
9. **Uma integração de cada vez.** Duas rodadas ao mesmo tempo no mesmo container derrubam o schema
   uma da outra (o item 11 do plano da Etapa 7). E o container precisa do Docker Desktop ligado: sem
   ele, a integração cai com `ECONNREFUSED` na porta 5434 antes de rodar caso nenhum.

## Restrições globais

Valem para todas as fases, sem precisar repetir em cada uma.

- **Branch:** `criador-de-imagem`, saída da `main` em `aef1eeb` (o PR #11 mergeado), sem upstream.
  Nunca commitar nem empurrar na `main`: ela não tem proteção e um push dispara deploy de produção.
  Conferir `git branch --show-current` antes de cada commit, e `git ls-remote origin refs/heads/main`
  no começo de cada fase.
- **`git add` com caminho explícito.** Nunca `-A` nem `.`: mais de uma sessão usa esta árvore.
- **Conventional Commits, em português.** Sem `Co-Authored-By` e sem rodapé de IA. Autor:
  Eduardo Kobal <162614913+Eduardokobal@users.noreply.github.com>.
- **Antes de cada commit**, varrer os arquivos de TEXTO tocados com
  `node "$SCRATCH/varrer-texto.mjs" <arquivos>`, em que `$SCRATCH` é o scratchpad da sessão. Se o
  scratchpad não existir mais, recrie o script a partir do apêndice A do plano da Etapa 1
  (`docs/plans/2026-09-29-gerador-de-bonus.md`).
- **O commit é um comando à parte**, depois de ler a saída dos testes: nunca encadeado com `&&` atrás
  deles.
- **Escape de barra-u:** a ferramenta de escrita grava o caractere no lugar do escape. Os blocos
  deste plano não têm escape de barra-u; se algum aparecer, a varredura acusa.
- **Fim de linha:** com `core.autocrlf=true`, a cópia de trabalho dos arquivos que já existem está
  em CRLF. Os diffs deste plano estão em LF: aplique com `git apply --ignore-whitespace` ou à mão,
  e varra depois. Se a varredura acusar fim de linha misturado, converta a cópia inteira para LF. O
  teste da cópia do Labs lê o arquivo trocando CRLF por LF, como o git faz ao gravar.
- **Pastas da etapa:** `app/bonus/`, `app/carrosseis/[cid]/imagem/` (a rota da consulta do avulso) e
  `lib/bonus/`; fora delas, só `migrations/018-imagens-geradas.sql`, a declaração da 018 em
  `lib/esquema.ts`, testes e `docs/`. **Nenhum arquivo do `/publicar`, do bucket (`lib/bucket.ts`), do
  dreno, da fila, das automações, do `scripts/migrar.mjs`, do proxy, das rotas da arte nem das
  dependências muda**, nem a arte (`arte-slides.ts`, `arte-foto.ts`) e as regras do publicar
  (`publicar-regras.ts`, `publicar-bucket.ts`). Em `lib/bonus/publicar-processo.ts`, só o `export` de
  `conferirCarrossel` (item 3 do ensaio). A FASE 6.8 confere.
- **Os comandos da 018 não mudam depois de aplicada** (FASE 6.9): a soma registrada é a dos comandos,
  e um comando mudado para o build do merge.
- **A OpenAI nunca é chamada** no ensaio, nos testes nem nas mutações: a chamada entra por parâmetro (o
  `fetch` falso nos puros, a OpenAI falsa na integração). A única chamada de verdade é a da prova (FASE
  6.9): duas imagens, ~US$ 0,13, cada uma com o OK do Eduardo.
- **A chave** (`OPENAI_API_KEY`) só é lida em `lib/bonus/imagem-openai.ts` e
  `lib/bonus/imagem-processo.ts`, e nunca vai para log, frase, banco, teste, commit nem saída de
  terminal. Nos testes, a chave inventada não começa por "sk-": onde um teste precisa de um "sk-", ele é
  montado em partes. Quem cria a chave na Vercel é o Eduardo ou o Vinícius; a sessão de desenvolvimento
  nunca vê o valor.
- **Sufixo de teste é o que decide se ele roda:** `tests/**/*.test.ts` (puro, entra no `verify`),
  `testes-integracao/**/*.integracao.ts` (banco, fora do `verify`), `testes-dom/**/*.dom.tsx`
  (tela, entra no `verify`).
- **Uma rodada de integração de cada vez** (item 9 do ensaio).
- **A suíte de integração só roda com `DATABASE_URL_TESTES`** apontando para o container
  (`127.0.0.1:5434`, `npm run banco:teste`). Toda rodada tem de imprimir
  `[rede-global] ALVO: banco de TESTE`. Se imprimir outra coisa, pare. Nunca rode com a variável
  vazia: ela cai na `DATABASE_URL`, que é **produção**.
- **`next dev` e `next build` sem as variáveis de agente.** Rode com `env -u CLAUDECODE -u AI_AGENT ...`
  e confira `git diff AGENTS.md` depois: ele não muda. Se o build local cair com erros de
  `next/font/google` ("queries have exactly one entry"), apague o `.next` (cache local) e rode de novo.
- **Telas:** só os tokens de `app/ui.ts` e os degraus de `app/escala.ts`; nada de `indigo`,
  `violet` nem `purple`.
- **Segredo** nunca vai para código, log, mensagem, commit ou saída de terminal.
- **Escrita em produção só com o OK do Eduardo**, e o script que grava vai antes à auditoria (achado
  77). A 018 é aplicada à mão antes do push (FASE 6.9). O preview usa o banco e o bucket de produção:
  lá, criar um carrossel, salvar, gerar ou subir imagem, agendar e cancelar gravam em produção, e gerar
  imagem também custa. Avisar o auditor com a hora antes de cada gravação.
- **Ao fechar cada fase**, avisar o auditor (sessão `metodochat-8e` em 09/10; conferir o nome no
  `ListAgents`, porque ele muda a cada reinício) com o hash e o que conferir. Não esperar a
  resposta para seguir.

## Mapa dos arquivos

| arquivo | responsabilidade | fase |
|---|---|---|
| `migrations/018-imagens-geradas.sql`, `lib/esquema.ts` | a tabela `imagens_geradas`, os `check`, os índices e a declaração em `naoObservaveis` | 6.1 |
| `lib/bonus/prompt-ilustracao.ts`, `lib/bonus/erro-ilustracao.ts` | as regras de estilo e a tradução das recusas da OpenAI, copiadas do Labs | 6.2 |
| `lib/bonus/imagem-jpeg.ts`, `imagem-regras.ts`, `imagem-textos.ts`, `imagem-openai.ts` | as medidas do JPEG, a conferência da imagem, os prazos, as frases da chamada, `tirarChave` e a chamada | 6.3 |
| `lib/bonus/imagem-regras.ts`, `imagem-repositorio.ts` | o estado de um slide; o teto com trava, um slide por vez, a marca da linha e as últimas de um carrossel | 6.4 |
| `lib/bonus/imagem-processo.ts`, `imagem-textos.ts`, `publicar-processo.ts` | pedir (as conferências e a reserva) e gerar (a OpenAI, o bucket, o guardar e a marca), e o bucket na falha (achado 89) | 6.5 |
| `lib/bonus/imagem-consulta.ts`, `imagem-regras.ts`, `imagem-textos.ts`, `app/bonus/imagem-actions.ts`, as duas rotas `imagem/route.ts` | a action do pedido com o `after()`, e a consulta GET (achado 88) | 6.6 |
| `app/bonus/[id]/carrossel/[cid]/gerar-imagem.tsx`, `card-da-parte.tsx`, `editor-do-carrossel.tsx`, `publicacao-na-tela.ts`, `revisao.tsx`; `lib/bonus/imagem-textos.ts` | o botão, o campo com os atalhos, o acompanhar e a página que abre gerando | 6.7 |

---

## ETAPA 6 — o criador de imagem

### FASE 6.0 — Começar da main certa

- [ ] **Passo 1: conferir a main e a branch**

```bash
git ls-remote origin refs/heads/main
git switch criador-de-imagem
git log --oneline -6
node -e 'console.log(require("./node_modules/next/package.json").version)'
```

Esperado: a `main` em `aef1eeb` (ou depois dele); a branch com os commits da spec e este plano sobre
`aef1eeb`; o `node_modules` na 16.3.8. Se a `main` andou, rebaseie a branch nela antes de seguir
(`git fetch origin main && git rebase origin/main`), e rode `npm ci` se o lock mudou.

- [ ] **Passo 2: a linha de base**

Com o Docker Desktop ligado (item 9 do ensaio):

```bash
npm test
npm run test:dom
npm run banco:teste
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npm run test:integracao
```

Esperado: 108 arquivos e 3 119 casos puros; 22 e 189 de tela; `[rede-global] ALVO: banco de TESTE`,
42 arquivos, 446 passaram e 8 pularam.

---

### FASE 6.1 — A migração 018, a tabela das imagens geradas

**Arquivos:**
- Criar: `migrations/018-imagens-geradas.sql`
- Modificar: `lib/esquema.ts` (só a declaração da 018 em `naoObservaveis`)
- Testar: `testes-integracao/bonus-imagens-tabela.integracao.ts` (novo);
  `testes-integracao/esquema-de-partida.integracao.ts` e
  `testes-integracao/bonus-carrossel-tabela.integracao.ts` (sem mudar: o caso da 016 reaplica as
  migrações seguintes, agora com a 018)

**Interfaces:**
- Produz, no banco: a tabela `imagens_geradas` (`id uuid` com `gen_random_uuid()`; `carrossel_id`
  com `references carrosseis_gerados (id) on delete set null`; `numero integer`, de 1 a 10;
  `descricao text`, não vazia; `estado text`, `gerando` (o padrão), `pronta` ou `falhou`; `motivo`;
  `caminho`; `criado_em timestamptz default now()`; `terminado_em`), com os `check`
  `imagens_geradas_caminho_check` (pronta se e só se tem caminho), `imagens_geradas_motivo_check`
  (falhou se e só se tem motivo) e `imagens_geradas_fim_check` (gerando se e só se não terminou), e os
  índices `imagens_geradas_criado_em_idx` (o teto) e `imagens_geradas_carrossel_idx` (a última de cada
  slide). A migração é idempotente (`if not exists`).

- [ ] **Passo 1: o teste**

Crie `testes-integracao/bonus-imagens-tabela.integracao.ts`:

```ts
// A TABELA DAS IMAGENS GERADAS (a 018, spec da Etapa 6), conferida no banco de verdade (o container).
//
// Como a 013 e a 014, a 018 está em `naoObservaveis` de lib/esquema.ts (a partida do painel não depende
// dela), e nada mais a confere: sem este arquivo, uma coluna apagada da migração só apareceria quando o
// teto do criador de imagem parasse de contar.
import { beforeEach, describe, expect, it } from "vitest";
import { bancoDescartavel } from "./harness";
import { migracoesEmOrdem } from "./migracoes";

const banco = bancoDescartavel();

/** A ordem das colunas é a da migração; o código lê por nome, e a lista inteira é o contrato. */
const COLUNAS = ["id", "carrossel_id", "numero", "descricao", "estado", "motivo", "caminho", "criado_em", "terminado_em"];

let carrosselId: string;

beforeEach(async () => {
  await banco.db().sql().query(`delete from imagens_geradas`);
  await banco.db().sql().query(`delete from carrosseis_gerados`);
  const [c] = (await banco
    .db()
    .sql()
    .query(
      `insert into carrosseis_gerados (origem, total_slides, palavra, acao_da_chamada, contexto)
       values ('livre', 3, null, 'salvar', '{}'::jsonb) returning id`
    )) as { id: string }[];
  carrosselId = c.id;
});

const inserir = (colunas: string, valores: string, params: unknown[] = []) =>
  banco.db().sql().query(`insert into imagens_geradas (${colunas}) values (${valores}) returning *`, params);

describe("a tabela imagens_geradas", () => {
  it("nasce da 018 com as colunas que o código lê", async () => {
    const linhas = (await banco
      .db()
      .sql()
      .query(
        `select column_name from information_schema.columns
          where table_schema = current_schema() and table_name = 'imagens_geradas'
          order by ordinal_position`
      )) as { column_name: string }[];
    expect(linhas.map((l) => l.column_name)).toEqual(COLUNAS);
  });

  it("um pedido novo nasce gerando, sem motivo, sem caminho e sem fim", async () => {
    const [linha] = (await inserir("carrossel_id, numero, descricao", "$1, 2, 'uma pessoa usando o celular numa loja'", [
      carrosselId,
    ])) as Record<string, unknown>[];
    expect(linha).toMatchObject({ estado: "gerando", motivo: null, caminho: null, terminado_em: null, numero: 2 });
    expect(linha.criado_em).toBeInstanceOf(Date);
  });

  it("pronta tem caminho e fim; falhou tem motivo e fim", async () => {
    await inserir("carrossel_id, numero, descricao, estado, caminho, terminado_em", "$1, 1, 'uma cena', 'pronta', 'p/bonus-foto/x.jpg', now()", [
      carrosselId,
    ]);
    await inserir("carrossel_id, numero, descricao, estado, motivo, terminado_em", "$1, 1, 'uma cena', 'falhou', 'a OpenAI recusou', now()", [
      carrosselId,
    ]);
    const [{ n }] = (await banco.db().sql().query(`select count(*)::int as n from imagens_geradas`)) as { n: number }[];
    expect(n).toBe(2);
  });

  it.each([
    ["o estado fora dos três", "carrossel_id, numero, descricao, estado", "$1, 1, 'uma cena', 'pendente'", /imagens_geradas_estado_check/],
    ["o slide fora de 1 a 10", "carrossel_id, numero, descricao", "$1, 11, 'uma cena'", /imagens_geradas_numero_check/],
    ["a descrição vazia", "carrossel_id, numero, descricao", "$1, 1, ''", /imagens_geradas_descricao_check/],
    ["pronta sem caminho", "carrossel_id, numero, descricao, estado, terminado_em", "$1, 1, 'uma cena', 'pronta', now()", /imagens_geradas_caminho_check/],
    ["gerando com caminho", "carrossel_id, numero, descricao, caminho", "$1, 1, 'uma cena', 'p/bonus-foto/x.jpg'", /imagens_geradas_caminho_check/],
    ["falhou sem motivo", "carrossel_id, numero, descricao, estado, terminado_em", "$1, 1, 'uma cena', 'falhou', now()", /imagens_geradas_motivo_check/],
    ["gerando com fim", "carrossel_id, numero, descricao, terminado_em", "$1, 1, 'uma cena', now()", /imagens_geradas_fim_check/],
  ])("o banco recusa %s", async (_nome, colunas, valores, check) => {
    await expect(inserir(colunas, valores, [carrosselId])).rejects.toThrow(check);
  });

  // O TETO CONTA AS LINHAS, e apagar o carrossel não pode zerar a conta do dia: a linha fica, com o
  // carrossel nulo (spec, "O teto e a migração 018").
  it("o carrossel apagado deixa a linha, com o carrossel nulo", async () => {
    await inserir("carrossel_id, numero, descricao", "$1, 1, 'uma cena'", [carrosselId]);
    await banco.db().sql().query(`delete from carrosseis_gerados where id = $1`, [carrosselId]);
    const linhas = (await banco.db().sql().query(`select carrossel_id from imagens_geradas`)) as { carrossel_id: string | null }[];
    expect(linhas).toEqual([{ carrossel_id: null }]);
  });

  it("a 018 roda duas vezes sem mudar nada", async () => {
    const m018 = migracoesEmOrdem().find((m) => m.nome === "018-imagens-geradas.sql");
    expect(m018).toBeDefined();
    await inserir("carrossel_id, numero, descricao", "$1, 1, 'uma cena'", [carrosselId]);
    await banco.db().sql().query(m018!.comandos);
    await banco.db().sql().query(m018!.comandos);
    const [{ n }] = (await banco.db().sql().query(`select count(*)::int as n from imagens_geradas`)) as { n: number }[];
    expect(n).toBe(1);
  });
});
```

- [ ] **Passo 2: ver falhar**

```bash
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-imagens-tabela.integracao.ts testes-integracao/esquema-de-partida.integracao.ts testes-integracao/bonus-carrossel-tabela.integracao.ts
```

Esperado: `[rede-global] ALVO: banco de TESTE`; 12 caem e 30 passam (42): a tabela não existe. Os
outros dois arquivos passam inteiros.

- [ ] **Passo 3: o código**

Crie `migrations/018-imagens-geradas.sql`:

```sql
-- AS IMAGENS GERADAS PELO CRIADOR DE IMAGEM (Etapa 6 do gerador de bônus).
--
-- Uma linha é um pedido de imagem à OpenAI, para o espaço da arte de um slide: o carrossel, o número
-- do slide, a descrição digitada, o estado (gerando, pronta ou falhou), o motivo da falha, o caminho
-- guardado no bucket e as horas de começo e de fim. O desenho inteiro está em
-- docs/specs/2026-10-09-criador-de-imagem.md.
--
-- O TETO CONTA ESTAS LINHAS: as das últimas 24 horas, de qualquer estado, porque o pedido que falhou
-- pode ter sido cobrado. Por isso o carrossel apagado deixa a linha, com o carrossel nulo (`on delete
-- set null`): apagar um carrossel não zera a conta do dia. A linha também guarda a última descrição de
-- cada slide, para o "Gerar de novo".
--
-- TABELA DE FEATURE, como a 013 e a 014: entra em `naoObservaveis` de lib/esquema.ts, e quem confere
-- as colunas é testes-integracao/bonus-imagens-tabela.integracao.ts. O scripts/migrar.mjs não muda
-- (achado 82 da auditoria).
--
-- Os quatro `check` amarram o estado ao resto: a pronta tem o caminho, a que falhou tem o motivo, e só a
-- que ainda gera fica sem a hora do fim.
--
-- IDEMPOTENTE, como toda migração desta pasta: `if not exists` na tabela e nos índices.
create table if not exists imagens_geradas (
  id uuid primary key default gen_random_uuid(),
  carrossel_id uuid references carrosseis_gerados (id) on delete set null,
  numero integer not null
    constraint imagens_geradas_numero_check
      check (numero between 1 and 10),
  descricao text not null
    constraint imagens_geradas_descricao_check
      check (descricao <> ''),
  estado text not null default 'gerando'
    constraint imagens_geradas_estado_check
      check (estado in ('gerando', 'pronta', 'falhou')),
  motivo text,
  caminho text,
  criado_em timestamptz not null default now(),
  terminado_em timestamptz,
  constraint imagens_geradas_caminho_check
    check ((estado = 'pronta') = (caminho is not null)),
  constraint imagens_geradas_motivo_check
    check ((estado = 'falhou') = (motivo is not null)),
  constraint imagens_geradas_fim_check
    check ((estado = 'gerando') = (terminado_em is null))
);

-- O teto lê por `criado_em`, do mais novo para trás.
create index if not exists imagens_geradas_criado_em_idx
  on imagens_geradas (criado_em desc);

-- A página lê a última linha de cada slide do carrossel.
create index if not exists imagens_geradas_carrossel_idx
  on imagens_geradas (carrossel_id, numero, criado_em desc);
```

Em `lib/esquema.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/esquema.ts b/lib/esquema.ts
index 249d6f1..29ba42a 100644
--- a/lib/esquema.ts
+++ b/lib/esquema.ts
@@ -253,6 +253,16 @@ const MARCA_DAGUA = {
       porque:
         "coluna de FEATURE (carrosseis_gerados.acao_da_chamada, e a palavra que pode faltar): a partida do painel não depende dela, de propósito",
     },
+    {
+      de: "018-imagens-geradas.sql",
+      // A TERCEIRA TABELA DE FEATURE, pelo mesmo motivo da 013 e da 014: `imagens_geradas` é do criador
+      // de imagem (app/bonus/), que conta nela o teto do dia e guarda a última descrição de cada slide,
+      // e uma tabela que só ele lê não pode impedir o painel inteiro de subir. Quem confere as colunas é
+      // testes-integracao/bonus-imagens-tabela.integracao.ts. Decidido pelo Eduardo em 09/10/2026
+      // (docs/specs/2026-10-09-criador-de-imagem.md).
+      porque:
+        "tabela de FEATURE (imagens_geradas): a partida do painel não depende dela, de propósito",
+    },
   ],
   // A migração que cria as oito tabelas de `tabelas`, acima.
   base: "000-esquema-base.sql",
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-imagens-tabela.integracao.ts testes-integracao/esquema-de-partida.integracao.ts testes-integracao/bonus-carrossel-tabela.integracao.ts
```

Esperado: `tsc` limpo; `[rede-global] ALVO: banco de TESTE`, e os 42 passam. Sem a declaração em
`lib/esquema.ts`, cai o caso "a MARCA D'ÁGUA cobre a pasta inteira" de `esquema-de-partida`.

- [ ] **Passo 5: a soma da 018**, para conferir depois com o registro da produção (FASE 6.9)

```bash
node --input-type=module -e 'import { readFileSync } from "node:fs"; const m = await import("./scripts/migracoes.mjs"); console.log(m.somaDoTexto(m.comandosDoArquivo(readFileSync("migrations/018-imagens-geradas.sql", "utf8"))).slice(0, 12));'
```

Esperado: `a2b6208bbbcd`.

- [ ] **Passo 6: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" migrations/018-imagens-geradas.sql lib/esquema.ts testes-integracao/bonus-imagens-tabela.integracao.ts
test "$(git branch --show-current)" = "criador-de-imagem"
git add migrations/018-imagens-geradas.sql lib/esquema.ts testes-integracao/bonus-imagens-tabela.integracao.ts
git commit -m "feat(bonus): a migração 018, a tabela das imagens geradas"
```

---

### FASE 6.2 — As regras da imagem, copiadas do Labs

**Arquivos:**
- Criar: `lib/bonus/prompt-ilustracao.ts` (o `src/lib/ia/prompt-ilustracao.ts` da main do Labs em
  `672ee71`), `lib/bonus/erro-ilustracao.ts` (o `src/lib/ia/erro-ilustracao.ts` da dev do Labs em
  `69c079d`)
- Testar: `tests/bonus-ilustracao-copia.test.ts`, `tests/bonus-prompt-ilustracao.test.ts`,
  `tests/bonus-erro-ilustracao.test.ts` (novos; os dois últimos são os testes do Labs)

**Interfaces:**
- Produz, sem mudar uma letra do Labs: `PROIBICAO_DE_TEXTO`, `PROIBICAO_DE_PESSOA_REAL`, `ESTILO`,
  `FUNDO`, `type Estilo`, `ESTILOS: Estilo[]` (os cinco atalhos, com `chave`, `rotulo` e `resumo`),
  `type LeituraDoAtalho`, `separarEstilo(descricao: string): LeituraDoAtalho`,
  `pedeTextoNaImagem(descricao: string): string | null`, `MIN_DESCRICAO = 10`, `MAX_DESCRICAO = 600`,
  `type ErroDeDescricao`, `validarDescricao(descricao: string): ErroDeDescricao` (`{ ok: true }` ou
  `{ ok: false; mensagem }`), `montarPrompt(descricao: string): string`;
  `mensagemDaOpenAI(status: number, corpo: unknown): string`.

Os dois arquivos de código têm de sair iguais aos do Labs, byte a byte (item 1 do ensaio). Com o
repositório do Labs (site-ia) à mão, dá para tirá-los de lá
(`git show 672ee71:src/lib/ia/prompt-ilustracao.ts` e `git show 69c079d:src/lib/ia/erro-ilustracao.ts`);
os blocos abaixo são os mesmos bytes. O teste da cópia confere de qualquer jeito.

- [ ] **Passo 1: os testes**

Crie `tests/bonus-ilustracao-copia.test.ts`:

```ts
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// AS REGRAS DA IMAGEM SÃO AS DO LABS, BYTE A BYTE (spec da Etapa 6, "As regras, copiadas do Labs").
//
// O Chat copia os dois módulos puros da ilustração do Labs (site-ia, `src/lib/ia/`) sem mudar uma letra:
// o estilo, as proibições, os atalhos e a tradução das recusas da OpenAI foram decididos pelo Eduardo lá,
// entre 02/09 e 22/09. A conferência é a soma do git do arquivo (a mesma de `git hash-object` e do
// GitHub), e por isso a cópia não ganha nem um cabeçalho: a origem está aqui.
//
// - `prompt-ilustracao.ts` é o da main do Labs em `672ee71` (igual na dev);
// - `erro-ilustracao.ts` é o da dev do Labs em `69c079d`, de 09/10: o filtro do pedaço da chave que a
//   OpenAI devolve no 401, achado neste ensaio e decidido pelo Eduardo no Labs. Ele chega à main de lá no
//   próximo deploy deles.
//
// MUDAR UMA REGRA NUM LADO SÓ DERRUBA ESTE TESTE, e é para derrubar. A mudança se combina com o Labs
// (acordo de 08/10) e se faz nos dois; quando o Labs mudar o dele, ele avisa, e a cópia nova troca a
// soma daqui.
const RAIZ = fileURLToPath(new URL("..", import.meta.url));

/** A soma do git de um arquivo: sha1 de "blob <tamanho>\0" seguido do conteúdo, com o fim de linha LF. */
function somaDoGit(relativo: string): string {
  const texto = readFileSync(`${RAIZ}/${relativo}`, "utf8").replace(/\r\n/g, "\n");
  const bytes = Buffer.from(texto, "utf8");
  return createHash("sha1")
    .update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`, "utf8"), bytes]))
    .digest("hex");
}

describe("as regras da imagem, copiadas do Labs", () => {
  it.each([
    ["lib/bonus/prompt-ilustracao.ts", "d993e8099f1b630ccd7e3ad5034f5552334b4f10"],
    ["lib/bonus/erro-ilustracao.ts", "6a5e8f55c82a871563498c9e4622a8b3f27b3566"],
  ])("%s é o arquivo do Labs, byte a byte", (arquivo, soma) => {
    expect(somaDoGit(arquivo)).toBe(soma);
  });
});
```

Crie `tests/bonus-prompt-ilustracao.test.ts`:

```ts
// CÓPIA DO TESTE DO LABS (site-ia, src/lib/ia/prompt-ilustracao.test.ts, main 672ee71, blob 75993a0c), com só o
// caminho do import trocado para o do Chat (spec da Etapa 6, "As regras, copiadas do Labs"). Os casos
// são os mesmos de lá, de propósito: as regras são as mesmas, e a cópia delas é conferida em
// tests/bonus-ilustracao-copia.test.ts.
import { describe, expect, it } from "vitest";
import {
  ESTILO,
  ESTILOS,
  FUNDO,
  MAX_DESCRICAO,
  MIN_DESCRICAO,
  PROIBICAO_DE_PESSOA_REAL,
  PROIBICAO_DE_TEXTO,
  pedeTextoNaImagem,
  montarPrompt,
  separarEstilo,
  validarDescricao,
} from "@/lib/bonus/prompt-ilustracao";

describe("validarDescricao", () => {
  it("recusa descrição vazia", () => {
    expect(validarDescricao("").ok).toBe(false);
    expect(validarDescricao("   ").ok).toBe(false);
  });

  it("recusa descrição curta demais, porque a chamada é paga", () => {
    const r = validarDescricao("uma lousa");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.mensagem).toContain(String(MIN_DESCRICAO));
  });

  it("aceita exatamente no mínimo", () => {
    expect(validarDescricao("a".repeat(MIN_DESCRICAO)).ok).toBe(true);
  });

  it("recusa acima do máximo e aceita exatamente nele", () => {
    expect(validarDescricao("a".repeat(MAX_DESCRICAO)).ok).toBe(true);
    expect(validarDescricao("a".repeat(MAX_DESCRICAO + 1)).ok).toBe(false);
  });

  it("mede DEPOIS de aparar os espaços — senão espaço em branco vira descrição válida", () => {
    expect(validarDescricao(`  ${"a".repeat(MIN_DESCRICAO - 1)}   `).ok).toBe(false);
  });
});

describe("montarPrompt", () => {
  const cena = "uma lousa de sala de aula com um professor apontando para ela";

  it("mantém a cena que a pessoa descreveu", () => {
    expect(montarPrompt(cena)).toContain(cena);
  });

  it("SEMPRE proíbe texto — é a regra que não pode depender de quem digita", () => {
    expect(montarPrompt(cena)).toContain(PROIBICAO_DE_TEXTO);
    expect(montarPrompt("qualquer coisa curta assim")).toContain(PROIBICAO_DE_TEXTO);
  });

  it("põe a proibição no FIM, que é a última coisa que o modelo lê", () => {
    expect(montarPrompt(cena).endsWith(PROIBICAO_DE_TEXTO)).toBe(true);
  });

  it("sempre pede o estilo e o enquadramento", () => {
    const p = montarPrompt(cena);
    expect(p).toContain(ESTILO);
    expect(p).toContain(FUNDO);
  });

  it("fecha a cena com ponto, para ela não se fundir na frase de estilo", () => {
    expect(montarPrompt("uma planilha flutuando")).toContain("uma planilha flutuando. ");
  });

  it("não duplica o ponto quando a pessoa já pontuou", () => {
    expect(montarPrompt("uma planilha flutuando.")).not.toContain("flutuando.. ");
    expect(montarPrompt("e agora?")).toContain("e agora? ");
  });

  it("normaliza espaços e quebras de linha coladas pelo teclado", () => {
    expect(montarPrompt("uma   lousa\n\ncom giz")).toContain("uma lousa com giz.");
  });

  it("a ordem é cena → estilo → fundo → proibição", () => {
    const p = montarPrompt(cena);
    expect(p.indexOf(cena)).toBeLessThan(p.indexOf(ESTILO));
    expect(p.indexOf(ESTILO)).toBeLessThan(p.indexOf(FUNDO));
    expect(p.indexOf(FUNDO)).toBeLessThan(p.indexOf(PROIBICAO_DE_TEXTO));
  });
});

describe("atalhos de estilo", () => {
  it("reconhece o atalho e tira ele da cena", () => {
    const r = separarEstilo("/showcase uma caixa de papelao aberta sobre a mesa");
    expect(r.estilo?.chave).toBe("showcase");
    expect(r.cena).toBe("uma caixa de papelao aberta sobre a mesa");
    expect(r.desconhecido).toBeNull();
  });

  it("aceita o atalho em maiuscula", () => {
    expect(separarEstilo("/SHOWCASE uma caixa sobre a mesa").estilo?.chave).toBe("showcase");
  });

  it("descricao sem barra continua sendo cena inteira", () => {
    const r = separarEstilo("uma lousa de sala de aula com um professor apontando");
    expect(r.estilo).toBeNull();
    expect(r.cena).toBe("uma lousa de sala de aula com um professor apontando");
  });

  // ⚠️ AS ÂNCORAS SAEM DAS CONSTANTES, e não de um pedaço do texto delas. Até 21/09 esta
  // asserção procurava o literal "Ilustração editorial", e a troca do estilo para fotografia
  // a derrubou — sem que a ORDEM, que é o que ela existe para provar, tivesse mudado. Teste
  // que reprova quando a redação muda ensina a mexer no teste em vez de olhar o defeito.
  it("o texto do estilo entra no prompt, depois da cena e antes do estilo fixo", () => {
    const enquadramento = ESTILOS.find((e) => e.chave === "grafico")!;
    const p = montarPrompt("/grafico tres barras subindo lado a lado");
    const posCena = p.indexOf("tres barras");
    const posEnquadramento = p.indexOf(enquadramento.texto);
    const posEstiloFixo = p.indexOf(ESTILO);
    expect(posCena).toBeGreaterThanOrEqual(0);
    expect(posEnquadramento).toBeGreaterThanOrEqual(0);
    expect(posEstiloFixo).toBeGreaterThanOrEqual(0);
    expect(posCena).toBeLessThan(posEnquadramento);
    expect(posEnquadramento).toBeLessThan(posEstiloFixo);
  });

  it("o estilo fixo e a proibicao continuam valendo com atalho", () => {
    const p = montarPrompt("/passo tres caixas ligadas por setas");
    expect(p).toContain(ESTILO);
    expect(p).toContain(PROIBICAO_DE_TEXTO);
    expect(p).toContain(FUNDO);
  });

  // ⚠️ AS DUAS SAIDAS SILENCIOSAS, e por que nenhuma serve. Ignorar o atalho faz a pessoa
  // achar que aplicou um estilo que nao existe; trata-lo como cena manda o modelo desenhar
  // a palavra "/showkase" no meio da arte — e a chamada e paga nos dois casos.
  it("atalho que nao existe e RECUSADO, com a lista do que existe", () => {
    const r = validarDescricao("/showkase uma caixa de papelao sobre a mesa");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.mensagem).toContain("/showkase");
      expect(r.mensagem).toContain("/showcase");
    }
  });

  it("atalho que nao existe nao vira texto da cena", () => {
    expect(montarPrompt("/showkase uma caixa")).not.toContain("showkase");
  });

  // O minimo mede a CENA, nao o que foi digitado: senao "/showcase uma" passaria de raspao
  // e geraria a imagem vaga que este limite existe para impedir.
  it("o atalho nao conta para o minimo de caracteres", () => {
    expect(validarDescricao("/showcase uma").ok).toBe(false);
    expect(validarDescricao("/showcase uma caixa de papelao").ok).toBe(true);
  });

  it("barra sozinha, sem cena, e recusada", () => {
    expect(validarDescricao("/showcase").ok).toBe(false);
  });

  it("todo atalho da lista funciona de ponta a ponta", () => {
    for (const e of ESTILOS) {
      const r = validarDescricao(`/${e.chave} uma cena qualquer com objetos`);
      expect(r.ok, `atalho /${e.chave} recusado`).toBe(true);
      expect(montarPrompt(`/${e.chave} uma cena qualquer com objetos`)).toContain(e.texto);
    }
  });

  // A PROIBICAO DE TEXTO vem depois de todo atalho e venceria de qualquer jeito. Mas um
  // atalho que PEDE o que o prompt proibe logo abaixo produz imagem confusa, nao recusa.
  it("nenhum atalho pede texto, numero ou rotulo", () => {
    for (const e of ESTILOS) {
      expect(e.texto, `/${e.chave} pede algo escrito`).not.toMatch(/\b(texto|palavra|letra|título|legenda)\b/i);
    }
  });
});

describe("o informativo de cada atalho", () => {
  // ⚠️ ESTE TESTE EXISTE PARA UM ATALHO FUTURO NAO NASCER MUDO. A explicacao vivia num
  // `title` de hover — invisivel no celular, e o projeto ja rejeitou tooltip por escrito
  // duas vezes. Agora ela e texto na tela, e um atalho sem `resumo` seria um botao que nao
  // diz nada: `/passo` e `/grafico` nao se adivinham.
  it("todo atalho tem resumo, e ele cabe numa linha", () => {
    for (const e of ESTILOS) {
      expect(e.resumo, `/${e.chave} sem resumo`).toBeTruthy();
      expect(e.resumo.length, `/${e.chave} tem resumo longo demais para a linha`).toBeLessThanOrEqual(90);
    }
  });

  // O resumo e para a PESSOA; o texto e para o modelo de imagem. Se alguem colar um no
  // outro, a tela mostra jargao de composicao e o prompt perde a instrucao.
  it("o resumo nao e o texto do prompt", () => {
    for (const e of ESTILOS) {
      expect(e.resumo, `/${e.chave} usa o texto do prompt como resumo`).not.toBe(e.texto);
    }
  });

  it("todo atalho tem rotulo curto", () => {
    for (const e of ESTILOS) {
      expect(e.rotulo, `/${e.chave} sem rotulo`).toBeTruthy();
      expect(e.rotulo.length).toBeLessThanOrEqual(30);
    }
  });
});

describe("ninguem reconhecivel na ilustracao", () => {
  // Regra do manual do perfil (02/09): foto de figura publica nao pode ser usada, e
  // ilustracao de icone entra no lugar. E direito de imagem, nao estetica — um post no ar
  // com o rosto de alguem identificavel e problema que ajuste de arte nao desfaz depois.
  it("a proibicao entra em toda ilustracao, com atalho ou sem", () => {
    expect(montarPrompt("uma caixa de papelao sobre a mesa")).toContain(PROIBICAO_DE_PESSOA_REAL);
    for (const e of ESTILOS) {
      expect(
        montarPrompt(`/${e.chave} uma cena qualquer com objetos`),
        `/${e.chave} sai sem a proibicao de pessoa real`,
      ).toContain(PROIBICAO_DE_PESSOA_REAL);
    }
  });

  // ⚠️ O CONTRAPESO QUE IMPEDE A REGRA DE SER LARGA DEMAIS — o mesmo erro que eu cometi no
  // aviso do `"use server"`, onde o enunciado passou da causa.
  //
  // O atalho `/marketing` PEDE "uma pessoa estilizada em acao". Escrita como "sem pessoas",
  // a proibicao contradiria o atalho que aparece logo acima dela no mesmo prompt — e o
  // modelo entrega imagem confusa em vez de recusar.
  it("proibe pessoa RECONHECIVEL, nao pessoa", () => {
    expect(PROIBICAO_DE_PESSOA_REAL).toMatch(/identific|reconhec/i);
    expect(PROIBICAO_DE_PESSOA_REAL).toMatch(/figura pública|celebridade|pessoa real/i);
    // Nao pode virar uma proibicao categorica de figura humana.
    expect(PROIBICAO_DE_PESSOA_REAL).not.toMatch(/sem pessoas|sem figuras humanas|nenhuma pessoa/i);
  });

  it("o atalho que pede pessoa continua pedindo pessoa", () => {
    const marketing = ESTILOS.find((e) => e.chave === "marketing");
    expect(marketing?.texto).toMatch(/pessoa/i);
  });

  // A ORDEM importa: as duas proibicoes ficam no fim, que e a ultima coisa que o modelo le.
  it("as proibicoes vem depois da cena e do estilo", () => {
    const p = montarPrompt("/marketing uma pessoa apontando para um grafico na parede");
    expect(p.indexOf("pessoa apontando")).toBeLessThan(p.indexOf(PROIBICAO_DE_PESSOA_REAL));
    expect(p.indexOf(ESTILO)).toBeLessThan(p.indexOf(PROIBICAO_DE_PESSOA_REAL));
    expect(p.indexOf(PROIBICAO_DE_PESSOA_REAL)).toBeLessThan(p.indexOf(PROIBICAO_DE_TEXTO));
  });
});

// ⚠️ ESTE BLOCO NASCEU DE UM CASO REAL, em 21/09 — a descricao do Eduardo, copiada do banco.
// Ele pediu texto na lousa, o prompt proibia texto no fim, e a imagem saiu com "ORGANICA"
// acentuado errado. O aviso existe para que o proximo pedido desses custe zero em vez de uma
// ilustracao paga.
describe("pedeTextoNaImagem", () => {
  it("reconhece a descricao REAL que produziu a imagem torta", () => {
    const real =
      "Uma reunião de marketing discutindo sobre a queda da vendas organicas, uma pessoa triste por isso \n" +
      "na lousa/ projetor (uma dessas opções, estar escrito, Analise queda ORGANICA)";
    expect(pedeTextoNaImagem(real)).toBe("escrito");
  });

  // ⚠️ O FALSO POSITIVO MAIS PROVAVEL, e o motivo de a fronteira nao poder ser `\b`.
  // "escritorio" comeca com "escrito", e escritorio e a palavra mais esperada numa descricao
  // de cena corporativa — a lista inteira ficaria inutil se ela disparasse.
  it("NAO dispara em escritorio, que contem 'escrito'", () => {
    expect(pedeTextoNaImagem("uma reuniao num escritorio com quatro pessoas")).toBeNull();
    expect(pedeTextoNaImagem("uma reunião num escritório com quatro pessoas")).toBeNull();
  });

  it("acha o termo com e sem acento, e no meio da frase", () => {
    expect(pedeTextoNaImagem("uma lousa com o título do projeto")).toBe("título");
    expect(pedeTextoNaImagem("uma lousa com o titulo do projeto")).toBe("titulo");
    expect(pedeTextoNaImagem("um grafico com numeros grandes")).toBe("numeros");
  });

  it("cala quando a cena nao pede texto nenhum", () => {
    expect(pedeTextoNaImagem("uma reuniao de equipe olhando um grafico de vendas em queda")).toBeNull();
  });

  // O atalho nao conta: quem escreve os atalhos somos nos, e nenhum deles pede texto — a
  // mesma razao pela qual `validarDescricao` mede a CENA e nao o texto digitado.
  it("mede a cena, e nao o atalho", () => {
    expect(pedeTextoNaImagem("/grafico tres barras subindo lado a lado")).toBeNull();
  });

  // ⚠️ O CONTRAPESO: sem isto, uma funcao que sempre devolve null passaria em tudo que
  // importa acima, porque a maioria dos casos e "nao dispara".
  it("dispara em todos os termos da lista, um a um", () => {
    for (const t of ["escrito", "escreva", "texto", "letras", "palavra", "frase", "placa", "legenda"]) {
      expect(pedeTextoNaImagem(`uma cena com ${t} no meio`), `${t} deveria disparar`).not.toBeNull();
    }
  });
});
```

Crie `tests/bonus-erro-ilustracao.test.ts`:

```ts
// CÓPIA DO TESTE DO LABS (site-ia, src/lib/ia/erro-ilustracao.test.ts, commit 69c079d da dev, blob 9218a8ff),
// com só o caminho do import trocado para o do Chat (spec da Etapa 6, "As regras, copiadas do Labs"). Os
// casos são os mesmos de lá, de propósito: as regras são as mesmas, e a cópia delas é conferida em
// tests/bonus-ilustracao-copia.test.ts. As chaves deste arquivo são falsas, mascaradas ou curtas.
import { describe, expect, it } from "vitest";
import { mensagemDaOpenAI } from "@/lib/bonus/erro-ilustracao";

const corpo = (code: string | undefined, message?: string) => ({ error: { code, message } });

describe("mensagemDaOpenAI", () => {
  // ⚠️ **A ASSERÇÃO QUE MOTIVOU O ARQUIVO.** Em 18/09 a geração falhou em produção e a tela
  // mostrou só o texto genérico nosso; a OpenAI tinha dito qual era a causa em `message`, e o
  // código descartava esse campo no 401 e no 403. Um dia de diagnóstico às cegas.
  it("NUNCA descarta a mensagem da OpenAI, em nenhum status", () => {
    const detalhe = "Your organization must be verified to use the model `gpt-image-1`";
    for (const status of [400, 401, 403, 429, 500, 503]) {
      expect(mensagemDaOpenAI(status, corpo("x", detalhe))).toContain(detalhe);
    }
  });

  it("separa 401 (chave não reconhecida) de 403 (acesso ao modelo negado)", () => {
    const a = mensagemDaOpenAI(401, corpo(undefined));
    const b = mensagemDaOpenAI(403, corpo(undefined));
    expect(a).not.toBe(b);
    expect(a).toContain("não reconheceu a chave");
    expect(b).toContain("verificada");
  });

  // ⚠️ O 401 acontece com a chave PRESENTE no servidor. Sem esta frase, quem lê vai conferir a
  // variável de ambiente — que é o único lugar onde o problema comprovadamente não está.
  it("no 401, diz que a chave chegou ao servidor", () => {
    expect(mensagemDaOpenAI(401, corpo(undefined))).toContain("CHEGOU ao servidor");
  });

  it("trata falta de crédito pelo código, não pelo status", () => {
    for (const code of ["credit_balance_exhausted", "insufficient_quota", "billing_hard_limit_reached"]) {
      expect(mensagemDaOpenAI(400, corpo(code))).toContain("sem crédito");
    }
  });

  // ⚠️ REGRESSÃO: a versão anterior mandava "adicione fundos" para todo 429, e 429 sem código
  // de cobrança é limite de REQUISIÇÕES — quem só precisava esperar ia comprar crédito.
  it("429 sem código de cobrança é limite de requisições, não falta de crédito", () => {
    const m = mensagemDaOpenAI(429, corpo(undefined, "Rate limit reached"));
    expect(m).toContain("limite de requisições");
    expect(m).not.toContain("sem crédito");
  });

  it("não inventa parênteses vazios quando a OpenAI não manda detalhe", () => {
    expect(mensagemDaOpenAI(403, null)).not.toContain("OpenAI:");
    expect(mensagemDaOpenAI(500, {})).not.toContain("()");
  });

  it("inclui o status quando não há tradução específica", () => {
    expect(mensagemDaOpenAI(503, null)).toContain("503");
  });

  // ⚠️ **O 401 DA OPENAI TRAZ UM PEDAÇO DA CHAVE, mascarado no meio.** A frase vai para a tela
  // de quem opera e para `IlustracaoIA.erro`. Achado pelo DEV do Método Chat em 09/10.
  it("tira o pedaço da chave que a OpenAI põe na mensagem do 401", () => {
    const detalhe =
      "Incorrect API key provided: sk-proj-AbC1********************************************xY9z. You can find your API key at https://platform.openai.com/account/api-keys.";
    const m = mensagemDaOpenAI(401, corpo("invalid_api_key", detalhe));
    expect(m, "sobrou o começo da chave").not.toContain("AbC1");
    expect(m, "sobrou o fim da chave").not.toContain("xY9z");
    expect(m, "o marcador sumiu").toContain("sk-…");
    expect(m, "o resto da mensagem da OpenAI tem de continuar").toContain("You can find your API key");
  });

  it("tira toda chave da mensagem, e não só a primeira", () => {
    const m = mensagemDaOpenAI(400, corpo(undefined, "chaves sk-aaaa1111 e sk-proj-bbbb2222 recusadas"));
    expect(m).not.toMatch(/1111|2222/);
    expect(m.match(/sk-…/g)?.length).toBe(2);
  });
});
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-ilustracao-copia.test.ts tests/bonus-prompt-ilustracao.test.ts tests/bonus-erro-ilustracao.test.ts
```

Esperado: os 3 arquivos caem; os 2 casos da cópia caem (os arquivos não existem), e os dois testes do
Labs não rodam caso nenhum, porque o import falha.

- [ ] **Passo 3: o código**

Crie `lib/bonus/prompt-ilustracao.ts`:

```ts
// O PROMPT da ilustração do slide. PURO, para ser testável fora do módulo que chama a API —
// mesmo padrão de `payment-logic` × `payments` e de `schemas` × `gerar`.
//
// A pessoa digita só a CENA ("uma lousa de sala de aula com um professor apontando"). Tudo
// o que faz a peça funcionar dentro do carrossel — estilo, fundo, e a proibição de texto —
// é acrescentado aqui, igual em toda ilustração. Se isso ficasse a cargo de quem digita,
// cada slide sairia de um mundo diferente e a sequência não leria como uma coisa só.
//
// ⚠️ NÃO há chamada ao Claude para "melhorar" a descrição. Seria uma segunda API paga no
// caminho de uma feature que já espera crédito em duas contas, para resolver algo que uma
// frase de estilo fixa resolve.

/**
 * A regra que não é opcional: PROIBIR TEXTO.
 *
 * ⚠️ **ELA COMEÇA AFIRMANDO, E ISSO NÃO É ESTILO DE REDAÇÃO — É O QUE FAZ A REGRA PEGAR.**
 *
 * Até 22/09 ela era só negação: *"Sem nenhum texto, sem letras, sem palavras…"*. Em 21/09 o
 * Eduardo gerou uma cena de reunião **sem pedir texto nenhum**, e a lousa saiu escrita
 * `VENDAS ORGANICAS` — sem o circunflexo. A proibição estava no prompt, no fim, e perdeu.
 *
 * **Modelo de imagem obedece mal a negação.** "Sem texto" compete com "lousa" e "gráfico", que
 * são superfícies que pedem escrita, e a superfície ganha: o modelo desenha a cena plausível e
 * a proibição vira um detalhe contra a física do quadro. A forma que funciona é dizer o que a
 * superfície DEVE ser — em branco, ou com linha e seta sem rótulo —, porque isso ele consegue
 * desenhar. A negação fica junto, como segunda linha, e não como única.
 *
 * ⚠️ E a lista de superfícies é NOMEADA de propósito. "Sem texto" genérico não diz ao modelo
 * ONDE ele está prestes a escrever; "a lousa aparece em branco" diz.
 *
 * Modelo de imagem escreve ilegível — troca letra, inventa acento, e é pior em português.
 * O carrossel inteiro foi desenhado para o texto ser composto por código justamente por
 * isso; deixar o modelo escrever aqui desfaria essa decisão dentro da própria peça, e do
 * jeito mais visível possível, porque a palavra torta fica no meio da arte.
 *
 * Vai no FIM do prompt de propósito: é a última coisa que o modelo lê.
 */
export const PROIBICAO_DE_TEXTO =
  "Toda superfície que poderia conter escrita — lousa, quadro branco, flip chart, projetor, " +
  "tela, cartaz, placa, papel — aparece EM BRANCO, ou apenas com linhas, barras e setas " +
  "desenhadas à mão, sem rótulo. Sem nenhum texto, sem letras, sem palavras, sem números e " +
  "sem logotipos em nenhuma parte da imagem.";

/**
 * A outra regra que não é opcional: NINGUÉM RECONHECÍVEL.
 *
 * Vem do manual do perfil, trazido pelo Eduardo em 02/09: foto de figura pública não pode
 * ser usada, e ilustração de ícone entra no lugar. É restrição de direito de imagem, não de
 * estética — e um post publicado com o rosto de alguém identificável é problema jurídico
 * que nenhum ajuste de arte desfaz depois.
 *
 * ⚠️ **PROÍBE PESSOA RECONHECÍVEL, NÃO PESSOA.** A distinção é obrigatória: o atalho
 * `/marketing` PEDE "uma pessoa em ação". Uma proibição escrita como "sem pessoas"
 * contradiria o próprio atalho logo acima dela no prompt, e o modelo entrega imagem confusa
 * em vez de recusar — o mesmo modo de falha de um atalho que pede o que a proibição de texto
 * veta.
 *
 * ⚠️ **A REDAÇÃO MUDOU EM 21/09, E A MUDANÇA AFROUXA UM POUCO — DE PROPÓSITO E COM CUSTO.**
 * Ela dizia "genéricas e estilizadas, **sem traços faciais identificáveis**", que fazia
 * sentido no estilo vetorial plano. Em fotografia, pedir rosto não identificável produz
 * gente borrada ou de costas, que é pior que o problema.
 *
 * O que a regra protege — **direito de imagem** — continua inteiro e ficou mais explícito:
 * pessoa fictícia e anônima, nenhuma semelhança com quem existe, e agora também **sem marca,
 * logotipo ou uniforme identificável**, que a redação antiga não cobria. O que se perdeu é a
 * proteção de segunda linha que o rosto sem traço dava de graça: hoje a peça sai com rostos
 * nítidos de pessoas inventadas, e quem confere se alguma saiu parecida com alguém é quem
 * revisa antes de publicar.
 *
 * Fica ao lado da proibição de texto, no fim: é o que não fazer, e é a última coisa lida.
 */
export const PROIBICAO_DE_PESSOA_REAL =
  "As pessoas retratadas devem ser fictícias e anônimas, sem semelhança com ninguém " +
  "existente. Nunca retrate pessoa real, figura pública, celebridade, político ou sósia de " +
  "alguém existente, e não reproduza marca, logotipo ou uniforme identificável.";

/**
 * O estilo, igual em toda ilustração.
 *
 * Fixo porque a sequência precisa parecer uma coisa só — dez slides com dez estéticas
 * diferentes leem como colagem.
 *
 * ⚠️ **ERA VETORIAL PLANO E AZUL ATÉ 21/09, e a troca foi decidida pelo Eduardo com as peças
 * publicadas na mão.** A frase antiga — *"vetorial plano e minimalista… azul vivo… sem
 * fotografia"* — foi escrita em **31/08, antes de as referências existirem**. Quando elas
 * apareceram, em 21/09, eram **três fotografias e uma capa desenhada**: o gerador produzia
 * exatamente o oposto do que a conta publica, e obedecendo a uma ordem nossa.
 *
 * ⚠️ **A PEÇA QUE ELE APROVOU NAQUELE DIA NÃO SAIU DAQUI** — era fotográfica e tinha texto
 * dentro do quadro, duas coisas que este prompt proíbe. Ela foi ENVIADA pela tela (38.1). O
 * caminho de envio continua sendo o de controle total; este é o de um clique.
 *
 * ⚠️ **O VOCABULÁRIO DE CÂMERA ENTROU EM 22/09** — distância focal, abertura, direção da luz,
 * e a recusa explícita de HDR, nitidez exagerada e vinheta. O Eduardo olhou uma peça em
 * produção e disse "a imagem está muito ruim ainda".
 *
 * **O motivo de descrever a ÓPTICA e não a qualidade:** pedir "foto realista de alta
 * qualidade" é adjetivo, e adjetivo o modelo já acha que está cumprindo. Dizer "35 mm a
 * f/2.8, luz de janela lateral" descreve uma CENA FÍSICA possível, e é isso que ele sabe
 * reproduzir — a mesma razão pela qual a proibição de texto só passou a funcionar quando
 * virou "a lousa aparece em branco".
 *
 * ⚠️ **E ISSO NÃO CONSERTA OBJETO QUE O MODELO NÃO SABE DESENHAR.** A peça que gerou a queixa
 * pedia "Manhattan inteira em 3D sobre a mesa" — uma maquete que não existe para ele copiar,
 * e que sai como aglomerado genérico de torres. As cenas de reunião saem bem porque são
 * comuns. Nenhuma frase de estilo alcança essa diferença; o caminho para cena difícil é o
 * envio.
 *
 * ⚠️ **A `PROIBICAO_DE_TEXTO` CONTINUA VALENDO, e isso é escolha separada, não descuido.**
 * A peça que ele gostou tem um gráfico rotulado, então a proibição custa alguma coisa — mas
 * modelo de imagem erra letra e acento em português, e aqui a imagem sai pronta para
 * publicar. Trocar isso é uma decisão dele, não uma consequência desta.
 *
 * ⚠️ **AS DUAS ÚLTIMAS FRASES SÃO CONTRA ARTEFATO, e entraram em 21/09 junto com a subida de
 * qualidade** — foram pedidas pelo mesmo feedback ("cara das pessoas muito plástica, 6 dedos,
 * mão branca e mão escura").
 *
 * *"Pele com textura natural, poros e pequenas imperfeições, sem retoque"* ataca a pele
 * plástica pedindo o oposto do que o modelo faz sozinho — ele tende ao rosto de catálogo.
 *
 * *"Enquadramento de meio corpo ou mais aberto, com as mãos repousadas e fora do primeiro
 * plano"* é a única coisa que se pode fazer pelos DEDOS por prompt, e é indireta: **não pede
 * mão correta — pede menos mão em destaque.** Modelo de imagem não obedece negativa
 * ("sem seis dedos" costuma piorar); obedece enquadramento. O lever forte contra artefato é a
 * qualidade, este é o fraco, e nenhum dos dois garante.
 */
export const ESTILO =
  "Fotografia editorial realista, em ambiente corporativo brasileiro contemporâneo. " +
  // ⚠️ VOCABULARIO DE CAMERA, acrescentado em 22/09. Ver o bloco acima: descrever a OPTICA
  // move o modelo para o territorio de fotografia de verdade; adjetivo de qualidade, nao.
  "Registrada com lente de 35 mm a f/2.8: foco nítido no rosto principal e fundo levemente " +
  "desfocado. Luz natural de janela vindo de lado, sombras suaves e contraste moderado. " +
  "Cores sóbrias e fiéis, sem filtro chamativo, sem HDR, sem nitidez exagerada, sem vinheta " +
  "e sem aparência de render 3D ou de desenho. Pele com textura natural, poros e pequenas " +
  "imperfeições, sem retoque e sem aparência de banco de imagens. Enquadramento de meio " +
  "corpo ou mais aberto, com as mãos repousadas e fora do primeiro plano.";

/**
 * O cenário, e ele OCUPA O RETÂNGULO INTEIRO.
 *
 * ⚠️ **CHAMAVA-SE `FUNDO_TRANSPARENTE` ATÉ 21/09, e a razão de então era boa:** o slide tem dois
 * fundos possíveis (claro e escuro) e a escolha acontece na hora de baixar, DEPOIS de a
 * ilustração existir. Com fundo opaco, gerar no claro e baixar no escuro deixaria um
 * retângulo branco colado no meio da arte.
 *
 * **A razão caiu junto com o estilo vetorial.** Fotografia preenche os 3:2 de ponta a ponta,
 * então não há fundo aparecendo atrás dela para brigar com o tema — é assim que as peças
 * publicadas da conta são. O que a transparência protegia deixou de existir.
 *
 * ⚠️ E ela cobrava um preço que só apareceu na tela: com fundo transparente o desenho flutua
 * na caixa, e quando o texto transborda os dois se sobrepõem. Foi o "mal posicionada" que o
 * Eduardo apontou em 21/09.
 */
export const FUNDO =
  "A cena deve preencher todo o quadro, de borda a borda, sem moldura, sem borda branca e " +
  "sem fundo liso sobrando.";

/**
 * ATALHOS DE ESTILO, escritos com barra no começo da descrição: `/showcase uma caixa…`.
 *
 * Pedido pelo Eduardo em 02/09, com a pergunta certa junto: "não sei se tem como aplicar na
 * API". **Tem, e é mais simples do que parece.** No ChatGPT a barra não é recurso do
 * modelo: é um texto guardado que ele cola antes do seu. Pela API é a mesma coisa — o
 * atalho vira um trecho de prompt, e este arquivo já fazia isso com o estilo fixo.
 *
 * ⚠️ **O QUE O ATALHO MUDA É O ENQUADRAMENTO, NÃO A ESTÉTICA.** O `ESTILO` acima continua
 * valendo em todos: a mesma fotografia editorial, a mesma luz. Isso é deliberado e contraria o impulso
 * de deixar cada atalho com a cara dele — dez slides com dez estéticas leem como colagem, e
 * a sequência precisa parecer uma coisa só. O atalho decide O QUE aparece e COMO está
 * composto; a linguagem visual não se mexe.
 *
 * Nenhum deles pode pedir texto, número ou rótulo: a `PROIBICAO_DE_TEXTO` vem depois e
 * venceria de qualquer forma, mas um atalho que pede o que o prompt proíbe logo abaixo
 * produz imagem confusa em vez de recusa.
 */
export type Estilo = {
  chave: string;
  /** Nome curto, para a lista. */
  rotulo: string;
  /**
   * O que o atalho faz, em uma frase, **para aparecer na tela**.
   *
   * ⚠️ Não é o `texto`: aquele é escrito para o modelo de imagem e tem 200 caracteres de
   * jargão de composição. Este é para a pessoa, e precisa caber numa linha.
   *
   * Existe porque a explicação estava só num `title` de hover — que não existe no celular, e
   * que este projeto já rejeitou por escrito duas vezes ("o motivo VISÍVEL, não num
   * tooltip"). `/showcase` até se adivinha; `/passo` e `/grafico` não dizem nada a quem
   * chega, e a instrução do projeto assume que quem opera esta tela não acompanha as
   * conversas onde os atalhos foram decididos.
   */
  resumo: string;
  /** O trecho que entra no prompt da imagem. Escrito para o modelo, não para a pessoa. */
  texto: string;
};

export const ESTILOS: Estilo[] = [
  {
    chave: "showcase",
    resumo: "O objeto centralizado e em destaque, com ar em volta e nada competindo.",
    rotulo: "Vitrine do produto",
    texto:
      "Composição de vitrine: o objeto principal centralizado e em destaque, visto de leve " +
      "perspectiva, com bastante ar em volta e nenhum elemento competindo com ele.",
  },
  {
    chave: "marketing",
    resumo: "Uma pessoa em ação junto do objeto, sugerindo uso e movimento.",
    rotulo: "Cena de divulgação",
    texto:
      "Composição de campanha: uma pessoa em ação junto do objeto principal, gestos claros e " +
      "legíveis em miniatura, sugerindo uso e movimento.",
  },
  {
    chave: "grafico",
    resumo: "Barras ou blocos comparando tamanhos — sem número e sem rótulo.",
    rotulo: "Dados e comparação",
    texto:
      "Composição de dado: barras, setas ou blocos de tamanhos diferentes representando " +
      "comparação ou crescimento, sem eixos, sem escala e sem rótulo de nenhum tipo.",
  },
  {
    chave: "passo",
    resumo: "Três ou quatro elementos ligados por setas, lidos da esquerda para a direita.",
    rotulo: "Sequência de etapas",
    texto:
      "Composição de fluxo: três ou quatro elementos na horizontal, ligados por setas " +
      "simples, lidos da esquerda para a direita como etapas de um processo.",
  },
  {
    chave: "antes-depois",
    resumo: "Duas metades: à esquerda o desorganizado, à direita o mesmo resolvido.",
    rotulo: "Antes e depois",
    texto:
      "Composição em duas metades separadas por uma linha vertical: à esquerda o estado " +
      "desorganizado, à direita o mesmo assunto resolvido e em ordem.",
  },
];

const POR_CHAVE = new Map(ESTILOS.map((e) => [e.chave, e]));

export type LeituraDoAtalho = {
  /** O atalho reconhecido, ou `null` quando a descrição não começa com barra. */
  estilo: Estilo | null;
  /** A cena, já sem o atalho. É ela que passa pela validação de tamanho. */
  cena: string;
  /** O que veio depois da barra e não existe. `null` quando não há problema. */
  desconhecido: string | null;
};

/**
 * Separa o atalho da cena.
 *
 * ⚠️ ATALHO DESCONHECIDO NÃO É IGNORADO nem tratado como parte da cena. As duas saídas
 * silenciosas são piores que a recusa: ignorar faz a pessoa achar que o estilo foi aplicado
 * quando não foi, e tratar como cena manda o modelo desenhar a palavra "/showkase". Quem
 * digita barra está pedindo um atalho — se ele não existe, isso precisa ser dito.
 */
export function separarEstilo(descricao: string): LeituraDoAtalho {
  const limpa = descricao.trim();
  const m = /^\/([a-z-]+)\s*([\s\S]*)$/i.exec(limpa);
  if (!m) return { estilo: null, cena: limpa, desconhecido: null };

  const chave = m[1].toLowerCase();
  const estilo = POR_CHAVE.get(chave);
  if (!estilo) return { estilo: null, cena: m[2].trim(), desconhecido: chave };

  return { estilo, cena: m[2].trim(), desconhecido: null };
}

/**
 * Termos que denunciam um pedido de TEXTO DENTRO da imagem.
 *
 * ⚠️ **ESTA LISTA NASCEU DE UM CASO REAL, em 21/09.** O Eduardo descreveu *"na lousa/projetor
 * (uma dessas opções, estar escrito, Analise queda ORGANICA)"*, e o prompt que saiu daqui
 * terminava com *"Sem nenhum texto, sem letras, sem palavras"*. **O prompt se contradiz**, o
 * modelo obedeceu a descrição, e a imagem saiu com `ORGÁNICA` — acento errado, que é
 * exatamente o que a proibição existe para evitar.
 *
 * ⚠️ **O CÓDIGO JÁ TINHA PREVISTO ESSA ARMADILHA, para o lado errado.** O comentário dos
 * `ESTILOS` diz: *"um atalho que pede o que o prompt proíbe logo abaixo produz imagem confusa
 * em vez de recusa"*. A regra valia para os atalhos que nós escrevemos e **nunca foi aplicada
 * à descrição que a pessoa digita** — que é a única das duas que muda todo dia.
 *
 * ⚠️ **E A TELA JÁ "AVISAVA", sem servir para nada.** Ela dizia *"a proibição de texto na
 * imagem já é acrescentada — não precisa pedir"*. Isso lê como **"nós cuidamos disso"**, não
 * como **"não funciona se você pedir"**. Aviso que descreve o mecanismo em vez da consequência
 * não muda comportamento nenhum.
 */
const PEDIDOS_DE_TEXTO = [
  "escrito",
  "escrita",
  "escritos",
  "escritas",
  "escreva",
  "escrever",
  "escrevendo",
  "texto",
  "letras",
  "palavra",
  "palavras",
  "números",
  "numeros",
  "título",
  "titulo",
  "legenda",
  "rótulo",
  "rotulo",
  "frase",
  "dizeres",
  "placa",
] as const;

/**
 * O termo que faz a descrição pedir texto na imagem, ou `null`.
 *
 * ⚠️ **NÃO É VALIDAÇÃO, é aviso — e a separação é deliberada.** `validarDescricao` decide se o
 * botão pode ser clicado; isto só explica um risco. Detecção por palavra erra, e travar quem
 * escreveu "a placa da porta" seria pior que a imagem torta que ela evita. Decidido pelo
 * Eduardo em 21/09, que pediu explicitamente um aviso e não um bloqueio.
 *
 * ⚠️ **A FRONTEIRA NÃO PODE SER `\b`.** O `\b` do JavaScript é ASCII: "órgão" e "título"
 * quebram nos acentos e o casamento sai onde não devia. Este projeto já perdeu 317 skills de
 * cobertura por isso. A forma que funciona é `[^\wÀ-ÿ]` dos dois lados — e é ela que faz
 * **"escritório" não casar com "escrito"**, que seria o falso positivo mais provável aqui.
 */
export function pedeTextoNaImagem(descricao: string): string | null {
  const cena = separarEstilo(descricao).cena;
  for (const termo of PEDIDOS_DE_TEXTO) {
    const re = new RegExp(`(^|[^\\wÀ-ÿ])${termo}(?=[^\\wÀ-ÿ]|$)`, "i");
    if (re.test(cena)) return termo;
  }
  return null;
}

export const MIN_DESCRICAO = 10;
export const MAX_DESCRICAO = 600;

export type ErroDeDescricao =
  | { ok: true }
  | { ok: false; mensagem: string };

/**
 * Confere a descrição ANTES de gastar uma chamada.
 *
 * O mínimo não é burocracia: "uma lousa" gera qualquer coisa, e a chamada é paga. Uma
 * recusa aqui custa zero; uma imagem inútil custa dinheiro e uma unidade da cota do dia.
 */
export function validarDescricao(descricao: string): ErroDeDescricao {
  const atalho = separarEstilo(descricao);

  if (atalho.desconhecido) {
    return {
      ok: false,
      mensagem: `Não existe o atalho /${atalho.desconhecido}. Os que existem: ${ESTILOS.map((e) => `/${e.chave}`).join(", ")}.`,
    };
  }

  // A CENA é o que se mede, não o texto digitado: com o atalho contando para o mínimo,
  // "/showcase uma" passaria de raspão e geraria uma imagem vaga — que é justamente o que
  // este limite existe para evitar, e a chamada é paga.
  const limpa = atalho.cena;

  if (limpa.length === 0) {
    return { ok: false, mensagem: "Descreva o que a ilustração deve mostrar." };
  }
  if (limpa.length < MIN_DESCRICAO) {
    return {
      ok: false,
      mensagem: `Descreva com um pouco mais de detalhe — pelo menos ${MIN_DESCRICAO} caracteres. Descrição vaga gera imagem vaga, e a chamada é paga.`,
    };
  }
  if (limpa.length > MAX_DESCRICAO) {
    return {
      ok: false,
      mensagem: `A descrição passou de ${MAX_DESCRICAO} caracteres. Descreva uma cena só — quanto mais coisa, menos o modelo acerta cada uma.`,
    };
  }
  return { ok: true };
}

/**
 * Monta o prompt final: a cena que a pessoa descreveu, embrulhada nas regras fixas.
 *
 * A ORDEM importa e não é decorativa — cena primeiro (é o assunto), estilo e fundo depois
 * (são como desenhar), proibição por último (é o que não fazer, e fica mais perto do fim
 * do que o modelo lê).
 */
export function montarPrompt(descricao: string): string {
  const atalho = separarEstilo(descricao);
  const cena = atalho.cena.replace(/\s+/g, " ");
  // O ponto final evita que a cena e o estilo virem uma frase só, o que costuma fazer o
  // modelo ler "minimalista" como parte do que foi pedido em vez de como instrução.
  const comPonto = /[.!?]$/.test(cena) ? cena : `${cena}.`;

  // O ENQUADRAMENTO vem logo depois da cena e ANTES do estilo: ele fala do assunto (o que
  // aparece, como está posto), e o estilo fala do traço. Invertido, o modelo tende a ler a
  // composição como mais uma característica visual e a diluí-la.
  return [
    comPonto,
    ...(atalho.estilo ? [atalho.estilo.texto] : []),
    ESTILO,
    FUNDO,
    PROIBICAO_DE_PESSOA_REAL,
    PROIBICAO_DE_TEXTO,
  ].join(" ");
}
```

Crie `lib/bonus/erro-ilustracao.ts`:

```ts
// Tradução das recusas da API de imagem da OpenAI para algo que quem opera o painel consegue
// agir a respeito.
//
// ⚠️ **MÓDULO PURO, separado de `ilustracao.ts` de propósito.** Aquele tem `server-only` e não
// pode ser importado por teste; este é o mesmo par que o projeto já usa em `payment-logic` ×
// `payments` e `schemas` × `gerar`. Sem a separação, esta tradução ficaria sem teste — e ela é
// exatamente o tipo de código que só roda quando algo já deu errado.
//
// ⚠️ **A VERSÃO ANTERIOR DESCARTAVA `error.message` NO 401 E NO 403, e isso custou um dia.**
// Em 18/09 a geração passou a falhar em produção com "A chave da OpenAI foi recusada. Confira
// se ela existe no servidor e se tem permissão de escrita em imagens." — texto nosso, genérico,
// que serve para quatro causas diferentes. A OpenAI dizia qual era no campo `message`, e nós
// jogávamos fora justamente ele. Agora o detalhe dela vai junto SEMPRE.
//
// ⚠️ **E 401 NÃO É 403.** Estavam na mesma condição:
//   401 = a chave não foi reconhecida (errada, revogada, colada com espaço, de outra conta);
//   403 = a chave é válida e o acesso ao MODELO foi negado — no caso do `gpt-image-1`, quase
//         sempre organização não verificada ou o modelo não liberado naquele projeto.
// São consertos em telas diferentes da OpenAI; juntá-los manda procurar no lugar errado.

/** O que a API devolve no corpo quando recusa. Só os campos que usamos. */
type CorpoDeErro = { error?: { code?: string; message?: string } } | null;

/** Códigos que significam saldo/cota, e não excesso de requisições. */
const SEM_CREDITO = ["credit_balance_exhausted", "insufficient_quota", "billing_hard_limit_reached"];

/**
 * ⚠️ **A MENSAGEM DO 401 DA OPENAI TRAZ UM PEDAÇO DA CHAVE** — o começo e o fim, mascarados no
 * meio ("Incorrect API key provided: sk-proj-AbC1****xY9z"). Ela vai para a tela de quem opera,
 * que pode ser um EDITOR sem acesso ao resto do painel, e fica gravada em `IlustracaoIA.erro`.
 * Mascarada não é utilizável, mas não tem por que sair do servidor. Achado pelo DEV do Método
 * Chat em 09/10, que copia este arquivo byte a byte: mudança aqui vai a ele antes do commit.
 */
const PEDACO_DA_CHAVE = /\bsk-[A-Za-z0-9_*-]+/g;

export function mensagemDaOpenAI(status: number, corpo: unknown): string {
  const erro = (corpo as CorpoDeErro)?.error ?? {};
  const detalhe = erro.message?.trim().replace(PEDACO_DA_CHAVE, "sk-…");
  // A mensagem da OpenAI entra entre parênteses depois da nossa — a nossa diz o que fazer, a
  // dela diz o que aconteceu. Nunca uma sem a outra.
  const com = (nossa: string) => (detalhe ? `${nossa} (OpenAI: ${detalhe})` : nossa);

  if (erro.code && SEM_CREDITO.includes(erro.code)) {
    return com("A conta da OpenAI está sem crédito. Adicione fundos em platform.openai.com → Billing.");
  }

  if (status === 429) {
    // ⚠️ 429 SOZINHO NÃO É FALTA DE CRÉDITO — é limite de requisições. A versão anterior
    // mandava "adicione fundos" para quem só precisava esperar um minuto.
    return com("A OpenAI recusou por limite de requisições. Espere alguns minutos e tente de novo.");
  }

  if (status === 401) {
    return com(
      "A OpenAI não reconheceu a chave. Ela CHEGOU ao servidor, então não é variável faltando: confira se foi copiada inteira (sem espaço no fim), se não foi revogada e se é da mesma conta que tem o crédito."
    );
  }

  if (status === 403) {
    return com(
      "A chave é válida, mas o acesso ao modelo de imagem foi negado. Confira, nesta ordem: 1) a organização está verificada em platform.openai.com → Settings → Organization (o gpt-image-1 exige verificação, e ela é separada de ter crédito); 2) o modelo está liberado no projeto dessa chave; 3) a chave tem permissão de escrita em imagens."
    );
  }

  if (status === 400) {
    return com("A OpenAI recusou o pedido.");
  }

  return com(`A OpenAI respondeu ${status}.`);
}
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx eslint lib/bonus/prompt-ilustracao.ts lib/bonus/erro-ilustracao.ts tests/bonus-ilustracao-copia.test.ts tests/bonus-prompt-ilustracao.test.ts tests/bonus-erro-ilustracao.test.ts
npx vitest run tests/bonus-ilustracao-copia.test.ts tests/bonus-prompt-ilustracao.test.ts tests/bonus-erro-ilustracao.test.ts
```

Esperado: `tsc` e lint limpos; os 48 passam.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/prompt-ilustracao.ts lib/bonus/erro-ilustracao.ts tests/bonus-ilustracao-copia.test.ts tests/bonus-prompt-ilustracao.test.ts tests/bonus-erro-ilustracao.test.ts
test "$(git branch --show-current)" = "criador-de-imagem"
git add lib/bonus/prompt-ilustracao.ts lib/bonus/erro-ilustracao.ts tests/bonus-ilustracao-copia.test.ts tests/bonus-prompt-ilustracao.test.ts tests/bonus-erro-ilustracao.test.ts
git commit -m "feat(bonus): as regras da imagem copiadas do Labs, byte a byte"
```

---

### FASE 6.3 — A chamada à OpenAI e a conferência do JPEG gerado

**Arquivos:**
- Criar: `lib/bonus/imagem-jpeg.ts`, `lib/bonus/imagem-regras.ts`, `lib/bonus/imagem-textos.ts`,
  `lib/bonus/imagem-openai.ts` (`server-only`)
- Testar: `tests/bonus-imagem-jpeg.test.ts`, `tests/bonus-imagem-openai.test.ts` (novos)

**Interfaces:**
- Consome: `montarPrompt` e `mensagemDaOpenAI` (FASE 6.2); `problemaDaFotoDoEspaco` e o tipo
  `ProblemaDaFoto` (`lib/bonus/publicar-regras.ts`).
- Produz: `type MedidasDoJpeg = { largura: number; altura: number }`,
  `medidasDoJpeg(b: Uint8Array): MedidasDoJpeg | null` (o cabeçalho SOF, sem confundir as tabelas
  C4, C8 e CC); `TETO_IMAGEM_DIARIO = 10`, `TIMEOUT_IMAGEM_MS = 180_000`, `TRAVADA_IMAGEM_MS = 210_000`,
  `COMPRESSAO_DA_IMAGEM = 90`, `type ProblemaDaImagem = "formato" | ProblemaDaFoto`,
  `problemaDaImagemGerada(bytes: Uint8Array): ProblemaDaImagem | null`; `TEXTO_SEM_CHAVE_DA_IMAGEM`,
  `TEXTO_OPENAI_DEMOROU`, `TEXTO_SEM_REDE_DA_OPENAI`, `TEXTO_OPENAI_SEM_IMAGEM`,
  `tirarChave(texto: string, chave?: string): string`; `ENDERECO_DA_OPENAI`, `CORPO_FIXO`,
  `type RespostaDaOpenAI = { ok: true; bytes: Uint8Array } | { ok: false; erro: string }`,
  `type GerarNaOpenAI = (descricao: string) => Promise<RespostaDaOpenAI>`,
  `gerarNaOpenAI(descricao, ambiente = process.env, buscar = fetch): Promise<RespostaDaOpenAI>`.

- [ ] **Passo 1: os testes**

Crie `tests/bonus-imagem-jpeg.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { medidasDoJpeg } from "@/lib/bonus/imagem-jpeg";
import { problemaDaImagemGerada } from "@/lib/bonus/imagem-regras";
import { FOTO_DO_ESPACO_MAX_BYTES } from "@/lib/bonus/publicar-regras";

// A IMAGEM QUE VOLTA DA OPENAI, CONFERIDA PELO SERVIDOR (spec da Etapa 6, "Guardar como foto"). Ela não
// passa pelo navegador, que mede a foto subida: as medidas saem do cabeçalho do próprio JPEG, e a regra é
// a mesma da foto do espaço (`problemaDaFotoDoEspaco`).

/** Um segmento JPEG: FF, a marca, o tamanho em dois bytes (que conta a si mesmo) e o conteúdo. */
const segmento = (marca: number, conteudo: number[]) => [0xff, marca, (conteudo.length + 2) >> 8, (conteudo.length + 2) & 0xff, ...conteudo];

/** O começo de um JPEG de verdade: SOI, APP0 (JFIF), uma tabela, o SOF com as medidas e o SOS. */
function jpeg(largura: number, altura: number, sof = 0xc0, extra = 0): Uint8Array {
  const app0 = segmento(0xe0, [0x4a, 0x46, 0x49, 0x46, 0x00, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
  const dht = segmento(0xc4, [0x00, ...Array(16).fill(0)]);
  const sofN = segmento(sof, [8, altura >> 8, altura & 0xff, largura >> 8, largura & 0xff, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
  const sos = segmento(0xda, [3, 1, 0, 2, 0x11, 3, 0x11, 0, 0x3f, 0]);
  return new Uint8Array([0xff, 0xd8, ...app0, ...dht, ...sofN, ...sos, ...Array(extra).fill(0x55), 0xff, 0xd9]);
}

describe("as medidas do JPEG, lidas do cabeçalho", () => {
  it("o 1536×1024 que a OpenAI devolve", () => {
    expect(medidasDoJpeg(jpeg(1536, 1024))).toEqual({ largura: 1536, altura: 1024 });
  });

  it("o progressivo (SOF2) também", () => {
    expect(medidasDoJpeg(jpeg(1536, 1024, 0xc2))).toEqual({ largura: 1536, altura: 1024 });
  });

  it("a tabela de Huffman (C4) não é confundida com as medidas", () => {
    expect(medidasDoJpeg(jpeg(860, 573))).toEqual({ largura: 860, altura: 573 });
  });

  it("o que não é JPEG, ou o JPEG cortado antes das medidas, não tem medida", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    expect(medidasDoJpeg(png)).toBeNull();
    expect(medidasDoJpeg(new Uint8Array([0xff, 0xd8]))).toBeNull();
    expect(medidasDoJpeg(jpeg(1536, 1024).slice(0, 30))).toBeNull();
    expect(medidasDoJpeg(new Uint8Array())).toBeNull();
  });
});

describe("a imagem gerada, pela regra da foto do espaço", () => {
  it("o JPEG de 1536×1024 e poucos bytes passa", () => {
    expect(problemaDaImagemGerada(jpeg(1536, 1024))).toBeNull();
  });

  it("o que não é JPEG é formato", () => {
    expect(problemaDaImagemGerada(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("formato");
  });

  it("outra proporção, pequena demais ou acima de 2 MB não passa", () => {
    expect(problemaDaImagemGerada(jpeg(1024, 1024))).toBe("proporcao");
    expect(problemaDaImagemGerada(jpeg(768, 512))).toBe("pequena");
    expect(problemaDaImagemGerada(jpeg(1536, 1024, 0xc0, FOTO_DO_ESPACO_MAX_BYTES))).toBe("pesada");
  });
});
```

Crie `tests/bonus-imagem-openai.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { CORPO_FIXO, ENDERECO_DA_OPENAI, gerarNaOpenAI } from "@/lib/bonus/imagem-openai";
import { MAX_DURATION_S } from "@/lib/bonus/tempos";
import { TETO_IMAGEM_DIARIO, TIMEOUT_IMAGEM_MS, TRAVADA_IMAGEM_MS } from "@/lib/bonus/imagem-regras";
import {
  TEXTO_OPENAI_DEMOROU,
  TEXTO_OPENAI_SEM_IMAGEM,
  TEXTO_SEM_CHAVE_DA_IMAGEM,
  TEXTO_SEM_REDE_DA_OPENAI,
  tirarChave,
} from "@/lib/bonus/imagem-textos";
import { montarPrompt } from "@/lib/bonus/prompt-ilustracao";

// A CHAMADA À OPENAI (spec da Etapa 6, "A chamada à OpenAI"), com um `fetch` falso: nada sai desta
// máquina. O corpo é o do Labs (lib/bonus/prompt-ilustracao.ts embrulha a cena), com uma diferença: o
// JPEG, porque a foto do espaço do Chat é JPEG de até 2 MB.
//
// A CHAVE DESTES TESTES É INVENTADA, e não começa por "sk-" de propósito: a varredura da etapa procura
// esse começo em todo arquivo novo. Onde o teste precisa de um "sk-", ele é montado em partes.

const AMBIENTE = { OPENAI_API_KEY: "chave-inventada-para-o-teste" };
const CENA = "/marketing uma pessoa usando o celular numa loja de roupas";
const resposta = (status: number, corpo: unknown) => new Response(JSON.stringify(corpo), { status });

describe("os prazos e o teto", () => {
  it("a chamada termina antes de a linha contar como travada, e as duas cabem nos 300 s da página", () => {
    expect(TIMEOUT_IMAGEM_MS).toBe(180_000);
    expect(TIMEOUT_IMAGEM_MS).toBeLessThan(TRAVADA_IMAGEM_MS);
    expect(TRAVADA_IMAGEM_MS).toBeLessThan(MAX_DURATION_S * 1000);
  });

  it("o teto é de 10 por dia, como o Labs", () => {
    expect(TETO_IMAGEM_DIARIO).toBe(10);
  });
});

describe("a chamada à OpenAI", () => {
  it("sem a chave, recusa sem chamar", async () => {
    const buscar = vi.fn();
    expect(await gerarNaOpenAI(CENA, {}, buscar)).toEqual({ ok: false, erro: TEXTO_SEM_CHAVE_DA_IMAGEM });
    expect(await gerarNaOpenAI(CENA, { OPENAI_API_KEY: "   " }, buscar)).toEqual({ ok: false, erro: TEXTO_SEM_CHAVE_DA_IMAGEM });
    expect(buscar).not.toHaveBeenCalled();
  });

  it("o corpo é o do Labs em JPEG, com a cena embrulhada nas regras, e com prazo", async () => {
    const buscar = vi.fn(async (_url: string, _init: RequestInit) => resposta(200, { data: [{ b64_json: "AQID" }] }));
    await gerarNaOpenAI(CENA, AMBIENTE, buscar as unknown as typeof fetch);
    const [url, init] = buscar.mock.calls[0];
    expect(url).toBe(ENDERECO_DA_OPENAI);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer chave-inventada-para-o-teste");
    expect(JSON.parse(String(init.body))).toEqual({ ...CORPO_FIXO, prompt: montarPrompt(CENA) });
    expect(CORPO_FIXO).toMatchObject({
      model: "gpt-image-1",
      size: "1536x1024",
      quality: "medium",
      n: 1,
      background: "opaque",
      output_format: "jpeg",
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("a imagem volta em bytes, lida de data[0].b64_json", async () => {
    const buscar = async () => resposta(200, { data: [{ b64_json: Buffer.from([0xff, 0xd8, 0xff, 1]).toString("base64") }] });
    expect(await gerarNaOpenAI(CENA, AMBIENTE, buscar as unknown as typeof fetch)).toEqual({
      ok: true,
      bytes: new Uint8Array([0xff, 0xd8, 0xff, 1]),
    });
  });

  it("sem a imagem no corpo, a frase própria", async () => {
    const buscar = async () => resposta(200, { data: [{}] });
    expect(await gerarNaOpenAI(CENA, AMBIENTE, buscar as unknown as typeof fetch)).toEqual({ ok: false, erro: TEXTO_OPENAI_SEM_IMAGEM });
  });

  it("a recusa da OpenAI vira a frase do Labs", async () => {
    const buscar = async () => resposta(429, { error: { message: "Rate limit reached" } });
    const r = await gerarNaOpenAI(CENA, AMBIENTE, buscar as unknown as typeof fetch);
    expect(r.ok ? null : r.erro).toMatch(/^A OpenAI recusou por limite de requisições/);
  });

  // O 401 DA OPENAI TRAZ UM PEDAÇO DA CHAVE ("Incorrect API key provided: sk-proj-…wxyz"), e a frase do
  // Labs repassa a mensagem dela. Aqui nada disso chega à tela nem ao banco.
  it("a chave nunca vai para a frase: nem o pedaço que a OpenAI devolve, nem a chave inteira", async () => {
    const pedaco = ["sk", "proj", "********************wxyz"].join("-");
    const buscar = async () =>
      resposta(401, { error: { message: `Incorrect API key provided: ${pedaco}. Key chave-inventada-para-o-teste.` } });
    const r = await gerarNaOpenAI(CENA, AMBIENTE, buscar as unknown as typeof fetch);
    const erro = r.ok ? "" : r.erro;
    expect(erro).toMatch(/^A OpenAI não reconheceu a chave/);
    expect(erro).not.toContain(["sk", "proj"].join("-"));
    expect(erro).not.toContain("wxyz");
    expect(erro).not.toContain("chave-inventada-para-o-teste");
  });

  it("a demora e a rede que cai têm frase própria", async () => {
    const demora = async () => {
      throw Object.assign(new Error("tempo"), { name: "TimeoutError" });
    };
    const rede = async () => {
      throw new TypeError("fetch failed");
    };
    expect(await gerarNaOpenAI(CENA, AMBIENTE, demora as unknown as typeof fetch)).toEqual({ ok: false, erro: TEXTO_OPENAI_DEMOROU });
    expect(await gerarNaOpenAI(CENA, AMBIENTE, rede as unknown as typeof fetch)).toEqual({ ok: false, erro: TEXTO_SEM_REDE_DA_OPENAI });
  });
});

describe("tirar a chave de uma frase", () => {
  it("troca todo pedaço que começa por sk- e a chave inteira", () => {
    const pedaco = ["sk", "abc123", "XYZ"].join("-");
    expect(tirarChave(`a chave ${pedaco} e a chave-inventada.`, "chave-inventada")).toBe("a chave sk-… e a ….");
  });

  it("deixa a frase sem chave como está", () => {
    expect(tirarChave("A OpenAI respondeu 500.", "chave-inventada")).toBe("A OpenAI respondeu 500.");
  });
});
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-imagem-jpeg.test.ts tests/bonus-imagem-openai.test.ts
```

Esperado: os 2 arquivos caem sem rodar caso nenhum, porque os módulos não existem.

- [ ] **Passo 3: o código**

Crie `lib/bonus/imagem-jpeg.ts`:

```ts
// AS MEDIDAS DO JPEG QUE VOLTA DA OPENAI (spec da Etapa 6, "Guardar como foto"). PURO.
//
// A foto subida pelo navegador chega com as medidas que ele mediu (imagem-no-navegador.ts). A imagem
// gerada não passa pelo navegador: o servidor a recebe da OpenAI e lê as medidas do cabeçalho do próprio
// arquivo, antes de qualquer gravação. Sem biblioteca: o cabeçalho do JPEG é uma sequência de segmentos
// (FF, a marca, o tamanho em dois bytes), e a largura e a altura estão no segmento SOF.

export type MedidasDoJpeg = { largura: number; altura: number };

/**
 * As marcas SOF (C0 a CF) trazem as medidas, menos três que usam a mesma faixa para outra coisa: a C4
 * (tabela de Huffman), a C8 (reservada) e a CC (tabela aritmética).
 */
const ehSof = (marca: number) => marca >= 0xc0 && marca <= 0xcf && marca !== 0xc4 && marca !== 0xc8 && marca !== 0xcc;

/**
 * A largura e a altura do JPEG, ou `null` quando os bytes não são JPEG ou acabam antes das medidas. O
 * JPEG começa por FF D8; depois do SOS (DA) vêm os dados da imagem, e as medidas já teriam aparecido.
 */
export function medidasDoJpeg(b: Uint8Array): MedidasDoJpeg | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) return null;
    const marca = b[i + 1];
    if (marca === 0xff) {
      i += 1;
      continue;
    }
    if (marca === 0xd9 || marca === 0xda) return null;
    const tamanho = (b[i + 2] << 8) | b[i + 3];
    if (tamanho < 2) return null;
    if (ehSof(marca)) {
      if (i + 9 > b.length) return null;
      const altura = (b[i + 5] << 8) | b[i + 6];
      const largura = (b[i + 7] << 8) | b[i + 8];
      return largura > 0 && altura > 0 ? { largura, altura } : null;
    }
    i += 2 + tamanho;
  }
  return null;
}
```

Crie `lib/bonus/imagem-regras.ts`:

```ts
// AS REGRAS DO CRIADOR DE IMAGEM (spec da Etapa 6). PURO: o processo, o repositório, a consulta e a
// tela leem daqui.
import { medidasDoJpeg } from "./imagem-jpeg";
import { problemaDaFotoDoEspaco, type ProblemaDaFoto } from "./publicar-regras";

/**
 * O TETO: 10 imagens nas últimas 24 horas, somando todos os carrosséis (decisão do Eduardo em 09/10, o
 * mesmo número do Labs). Cada uma custa ~US$ 0,063 na qualidade usada (medido pelo Labs em 21/09).
 */
export const TETO_IMAGEM_DIARIO = 10;

/**
 * O PRAZO DA CHAMADA À OPENAI: o `TIMEOUT_API_MS` do Labs. A qualidade usada leva ~34 s; o `high`, que
 * não foi adotado, levou 92 s e ainda caberia.
 */
export const TIMEOUT_IMAGEM_MS = 180_000;

/**
 * A LINHA `gerando` MAIS VELHA QUE ISTO NÃO TERMINA MAIS: a geração morreu sem marcar a linha (a função
 * da Vercel parou, por exemplo). Ela aparece como falha, libera o slide para outro pedido e continua
 * contando no teto. É o "travada" do Labs: o prazo da chamada com uma folga para subir e guardar.
 */
export const TRAVADA_IMAGEM_MS = 210_000;

/**
 * O NÍVEL DO JPEG PEDIDO À OPENAI (`output_compression`, de 0 a 100; o padrão dela é 100). A foto do
 * espaço é lida até 2 MB (`FOTO_DO_ESPACO_MAX_BYTES`), e um JPEG de 1536×1024 neste nível fica bem
 * abaixo disso. A prova mede os bytes da primeira imagem; a conferência abaixo recusa a que passar.
 */
export const COMPRESSAO_DA_IMAGEM = 90;

/** O que impede guardar a imagem gerada: não é JPEG, ou não passa na regra da foto do espaço. */
export type ProblemaDaImagem = "formato" | ProblemaDaFoto;

/**
 * A IMAGEM QUE VOLTOU, CONFERIDA ANTES DE QUALQUER GRAVAÇÃO: os bytes de um JPEG, as medidas do
 * cabeçalho dele e o tamanho, pela mesma regra da foto subida (a proporção do espaço, de 860×573 a
 * 1720×1146, e até 2 MB). O 1536×1024 da OpenAI passa.
 */
export function problemaDaImagemGerada(bytes: Uint8Array): ProblemaDaImagem | null {
  const medidas = medidasDoJpeg(bytes);
  if (!medidas) return "formato";
  return problemaDaFotoDoEspaco(medidas.largura, medidas.altura, bytes.length);
}
```

Crie `lib/bonus/imagem-textos.ts`:

```ts
// AS FRASES DO CRIADOR DE IMAGEM, fora do JSX e das actions (o princípio de lib/bonus/textos.ts): uma
// saída muda é indistinguível de sucesso, e cada saída tem frase, testada. As frases das recusas da
// OpenAI são as do Labs (erro-ilustracao.ts, copiado byte a byte).

export const TEXTO_SEM_CHAVE_DA_IMAGEM =
  "A geração de imagem não está configurada: falta a chave da OpenAI no servidor. Avise quem cuida do Chat.";
export const TEXTO_OPENAI_DEMOROU = "A OpenAI demorou demais para responder. Tente de novo.";
export const TEXTO_SEM_REDE_DA_OPENAI = "Não consegui falar com a OpenAI. Tente de novo em instantes.";
export const TEXTO_OPENAI_SEM_IMAGEM = "A OpenAI respondeu sem a imagem. Tente de novo; se repetir, avise quem cuida do Chat.";

/**
 * A CHAVE NUNCA VAI PARA UMA FRASE. A mensagem que a OpenAI devolve num 401 traz um pedaço mascarado da
 * chave ("Incorrect API key provided: " seguido do começo e do fim dela), e a frase do Labs repassa a
 * mensagem inteira entre parênteses. Antes de a frase ir para a tela ou para o banco, todo trecho que
 * começa como uma chave da OpenAI vira "sk-…", e a chave inteira, se aparecer, vira "…".
 */
export function tirarChave(texto: string, chave?: string): string {
  const semInteira = chave ? texto.split(chave).join("…") : texto;
  return semInteira.replace(/sk-[A-Za-z0-9_*.-]+/g, "sk-…");
}
```

Crie `lib/bonus/imagem-openai.ts`:

```ts
import "server-only";
import { mensagemDaOpenAI } from "./erro-ilustracao";
import { COMPRESSAO_DA_IMAGEM, TIMEOUT_IMAGEM_MS } from "./imagem-regras";
import {
  TEXTO_OPENAI_DEMOROU,
  TEXTO_OPENAI_SEM_IMAGEM,
  TEXTO_SEM_CHAVE_DA_IMAGEM,
  TEXTO_SEM_REDE_DA_OPENAI,
  tirarChave,
} from "./imagem-textos";
import { montarPrompt } from "./prompt-ilustracao";

// A CHAMADA À API DE IMAGEM DA OPENAI (spec da Etapa 6, "A chamada à OpenAI"). Molde:
// site-ia/src/lib/ia/ilustracao.ts, na main 672ee71, onde o caminho inteiro foi provado contra a API de
// verdade em 18/09.
//
// SEM SDK, com `fetch` direto, como o Labs: o endpoint é um POST com JSON, e a resposta tem um campo que
// interessa. Nada muda no package.json.
//
// O CORPO É O DO LABS, com uma diferença: `output_format: "jpeg"`, e não "png". O Chat guarda a imagem
// como a foto do espaço, e a rota da arte só a lê como JPEG e até 2 MB (lib/bonus/arte-foto.ts); o PNG do
// Labs passava de 2 MB. O resto (modelo, tamanho, qualidade, fundo) foi decidido e medido lá, e não muda
// aqui sem combinar.
//
// A CHAVE sai do ambiente, vai só no cabeçalho, e nunca para uma frase, um log ou o banco (`tirarChave`).

export const ENDERECO_DA_OPENAI = "https://api.openai.com/v1/images/generations";

/** O corpo, menos o prompt. 1536×1024 é o 3:2 deitado do espaço (860×573): a API só aceita três tamanhos. */
export const CORPO_FIXO = {
  model: "gpt-image-1",
  size: "1536x1024",
  quality: "medium",
  n: 1,
  background: "opaque",
  output_format: "jpeg",
  output_compression: COMPRESSAO_DA_IMAGEM,
} as const;

export type RespostaDaOpenAI = { ok: true; bytes: Uint8Array } | { ok: false; erro: string };

/** A assinatura que o processo recebe por parâmetro: a de verdade em produção, uma falsa no teste. */
export type GerarNaOpenAI = (descricao: string) => Promise<RespostaDaOpenAI>;

/**
 * Gera a imagem da descrição que o operador digitou. O embrulho nas regras (estilo, fundo, proibições) é
 * o `montarPrompt` do Labs. `ambiente` e `buscar` entram por parâmetro só para o teste.
 */
export async function gerarNaOpenAI(
  descricao: string,
  ambiente: Readonly<Record<string, string | undefined>> = process.env,
  buscar: typeof fetch = fetch
): Promise<RespostaDaOpenAI> {
  const chave = ambiente.OPENAI_API_KEY?.trim();
  if (!chave) return { ok: false, erro: TEXTO_SEM_CHAVE_DA_IMAGEM };

  let resposta: Response;
  try {
    resposta = await buscar(ENDERECO_DA_OPENAI, {
      method: "POST",
      headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...CORPO_FIXO, prompt: montarPrompt(descricao) }),
      signal: AbortSignal.timeout(TIMEOUT_IMAGEM_MS),
    });
  } catch (e) {
    const nome = e instanceof Error ? e.name : "";
    return { ok: false, erro: nome === "TimeoutError" || nome === "AbortError" ? TEXTO_OPENAI_DEMOROU : TEXTO_SEM_REDE_DA_OPENAI };
  }

  const corpo = await resposta.json().catch(() => null);
  if (!resposta.ok) return { ok: false, erro: tirarChave(mensagemDaOpenAI(resposta.status, corpo), chave) };

  const b64 = (corpo as { data?: { b64_json?: unknown }[] } | null)?.data?.[0]?.b64_json;
  if (typeof b64 !== "string" || !b64) return { ok: false, erro: TEXTO_OPENAI_SEM_IMAGEM };
  return { ok: true, bytes: new Uint8Array(Buffer.from(b64, "base64")) };
}
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx eslint lib/bonus/imagem-jpeg.ts lib/bonus/imagem-regras.ts lib/bonus/imagem-textos.ts lib/bonus/imagem-openai.ts tests/bonus-imagem-jpeg.test.ts tests/bonus-imagem-openai.test.ts
npx vitest run tests/bonus-imagem-jpeg.test.ts tests/bonus-imagem-openai.test.ts
```

Esperado: `tsc` e lint limpos; os 18 passam.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/imagem-jpeg.ts lib/bonus/imagem-regras.ts lib/bonus/imagem-textos.ts lib/bonus/imagem-openai.ts tests/bonus-imagem-jpeg.test.ts tests/bonus-imagem-openai.test.ts
test "$(git branch --show-current)" = "criador-de-imagem"
git add lib/bonus/imagem-jpeg.ts lib/bonus/imagem-regras.ts lib/bonus/imagem-textos.ts lib/bonus/imagem-openai.ts tests/bonus-imagem-jpeg.test.ts tests/bonus-imagem-openai.test.ts
git commit -m "feat(bonus): a chamada à OpenAI e a conferência do JPEG gerado"
```

---

### FASE 6.4 — O teto das imagens, com trava e um slide por vez

**Arquivos:**
- Modificar: `lib/bonus/imagem-regras.ts` (a linha e o estado de um slide)
- Criar: `lib/bonus/imagem-repositorio.ts`
- Testar: `tests/bonus-imagem-estado.test.ts`, `testes-integracao/bonus-imagem-repositorio.integracao.ts`
  (novos)

**Interfaces:**
- Consome: a tabela da FASE 6.1; `TETO_IMAGEM_DIARIO` e `TRAVADA_IMAGEM_MS` (FASE 6.3); `lib/db.ts`.
- Produz: `type EstadoDaLinhaDaImagem = "gerando" | "pronta" | "falhou"`, `type LinhaDaImagem` (as
  colunas que o repositório lê), `type EstadoDaImagem` (`nenhuma`, `gerando`, `pronta` com o caminho,
  `falhou` com o motivo, `travada`), `estadoDaImagem(linha, agora: Date): EstadoDaImagem`;
  `TRAVA_DO_TETO_DA_IMAGEM = 2026100901` (outra trava que a dos tetos do bônus e do carrossel),
  `imagensNasUltimas24h(): Promise<number>`, `type ReservaDaImagem = { ok: true; id; hoje } | { ok: false;
  motivo: "teto" | "gerando"; hoje }`, `reservarImagem(p: { carrosselId; numero; descricao }):
  Promise<ReservaDaImagem>`, `marcarPronta(id, caminho): Promise<boolean>` e
  `marcarFalhou(id, motivo): Promise<boolean>` (só saem de `gerando`, uma vez),
  `ultimasDoCarrossel(carrosselId): Promise<{ agora: Date; linhas: Record<number, LinhaDaImagem> }>`
  (a última de cada slide, e o relógio do banco).

- [ ] **Passo 1: os testes**

Crie `tests/bonus-imagem-estado.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { estadoDaImagem, TRAVADA_IMAGEM_MS } from "@/lib/bonus/imagem-regras";

// O ESTADO DA IMAGEM DE UM SLIDE, lido da última linha dele em `imagens_geradas` (spec da Etapa 6, "O
// acompanhar"). A linha `gerando` que passou do prazo não termina mais: aparece como travada, libera o
// slide e continua contando no teto. O relógio é o do banco, que a consulta lê junto.

const AGORA = new Date("2026-10-09T15:00:00Z");
const antes = (ms: number) => new Date(AGORA.getTime() - ms);
const linha = (p: Partial<{ estado: "gerando" | "pronta" | "falhou"; motivo: string | null; caminho: string | null; criado_em: Date }>) => ({
  estado: "gerando" as const,
  motivo: null,
  caminho: null,
  criado_em: antes(5_000),
  ...p,
});

describe("o estado da imagem de um slide", () => {
  it("sem linha, nenhuma", () => {
    expect(estadoDaImagem(null, AGORA)).toEqual({ tipo: "nenhuma" });
  });

  it("gerando dentro do prazo", () => {
    expect(estadoDaImagem(linha({ criado_em: antes(TRAVADA_IMAGEM_MS - 1) }), AGORA)).toEqual({ tipo: "gerando" });
  });

  it("gerando depois do prazo é travada", () => {
    expect(estadoDaImagem(linha({ criado_em: antes(TRAVADA_IMAGEM_MS) }), AGORA)).toEqual({ tipo: "travada" });
  });

  it("pronta leva o caminho, e falhou leva o motivo", () => {
    expect(estadoDaImagem(linha({ estado: "pronta", caminho: "p/bonus-foto/x.jpg" }), AGORA)).toEqual({
      tipo: "pronta",
      caminho: "p/bonus-foto/x.jpg",
    });
    expect(estadoDaImagem(linha({ estado: "falhou", motivo: "A OpenAI recusou o pedido." }), AGORA)).toEqual({
      tipo: "falhou",
      motivo: "A OpenAI recusou o pedido.",
    });
  });
});
```

Crie `testes-integracao/bonus-imagem-repositorio.integracao.ts`:

```ts
// O TETO E AS LINHAS DO CRIADOR DE IMAGEM CONTRA O BANCO DE VERDADE (o container), spec da Etapa 6, "O
// teto e a migração 018".
//
// As proteções desta fase são uma trava de transação e `update`s condicionais, que nem o tsc nem a
// suíte pura enxergam: apagar qualquer uma passa por todos. Só um caminho que fale com o Postgres acusa.
// Nada aqui chama a OpenAI.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bancoDescartavel } from "./harness";

type ModuloRepo = typeof import("@/lib/bonus/imagem-repositorio");

const banco = bancoDescartavel();

let repo: ModuloRepo;
let carrosselId: string;

beforeAll(async () => {
  repo = await import("@/lib/bonus/imagem-repositorio");
});

beforeEach(async () => {
  await banco.db().sql().query(`delete from imagens_geradas`);
  await banco.db().sql().query(`delete from carrosseis_gerados`);
  const [c] = (await banco
    .db()
    .sql()
    .query(
      `insert into carrosseis_gerados (origem, total_slides, palavra, acao_da_chamada, contexto)
       values ('livre', 3, null, 'salvar', '{}'::jsonb) returning id`
    )) as { id: string }[];
  carrosselId = c.id;
});

const pedido = (numero = 1) => ({ carrosselId, numero, descricao: "/marketing uma pessoa usando o celular numa loja" });

/** Linhas gravadas direto, de qualquer estado, para encher o teto. */
async function linhasNoDia(n: number, estado: "gerando" | "pronta" | "falhou" = "falhou") {
  for (let i = 0; i < n; i++) {
    await banco
      .db()
      .sql()
      .query(
        `insert into imagens_geradas (carrossel_id, numero, descricao, estado, motivo, caminho, terminado_em)
         values ($1, 2, 'uma cena antiga', $2, $3, $4, case when $2 = 'gerando' then null else now() end)`,
        [carrosselId, estado, estado === "falhou" ? "falhou no teste" : null, estado === "pronta" ? "p/bonus-foto/x.jpg" : null]
      );
  }
}

async function contar(): Promise<number> {
  const [{ n }] = (await banco.db().sql().query(`select count(*)::int as n from imagens_geradas`)) as { n: number }[];
  return n;
}

describe("a reserva de uma imagem", () => {
  it("nasce gerando, com a descrição, e a conta do dia sobe", async () => {
    const r = await repo.reservarImagem(pedido());
    expect(r).toMatchObject({ ok: true, hoje: 1 });
    const [l] = (await banco.db().sql().query(`select numero, descricao, estado from imagens_geradas`)) as Record<string, unknown>[];
    expect(l).toEqual({ numero: 1, descricao: pedido().descricao, estado: "gerando" });
    expect(await repo.imagensNasUltimas24h()).toBe(1);
  });
});

describe("o teto de imagens", () => {
  it("com 10 em 24 h, de qualquer estado, o décimo primeiro é recusado, sem linha nova", async () => {
    await linhasNoDia(4, "falhou");
    await linhasNoDia(5, "pronta");
    await linhasNoDia(1, "falhou");
    expect(await repo.reservarImagem(pedido())).toEqual({ ok: false, motivo: "teto", hoje: 10 });
    expect(await contar()).toBe(10);
  });

  it("a linha do carrossel apagado continua contando", async () => {
    await linhasNoDia(10, "pronta");
    await banco.db().sql().query(`delete from carrosseis_gerados`);
    expect(await repo.imagensNasUltimas24h()).toBe(10);
  });

  it("pedido de mais de 24 h, pelo relógio do banco, não conta", async () => {
    await linhasNoDia(10, "pronta");
    await banco.db().sql().query(`update imagens_geradas set criado_em = now() - interval '25 hours'`);
    expect(await repo.imagensNasUltimas24h()).toBe(0);
    expect((await repo.reservarImagem(pedido())).ok).toBe(true);
  });

  // A trava é segurada por uma transação do próprio teste, com DEZ linhas invisíveis até o commit: quem
  // conta depois de pegar a trava vê 10 e recusa; quem conta antes vê 0 e insere. Assim o caso pega a trava
  // ausente e a trava no lugar errado (o molde do teto do carrossel).
  it("a reserva espera a trava do teto: contar e inserir não correm em paralelo", async () => {
    let soltar!: () => void;
    const segurando = new Promise<void>((f) => (soltar = f));
    let travou!: () => void;
    const travado = new Promise<void>((f) => (travou = f));
    const transacao = banco
      .db()
      .sql()
      .begin(async (tx) => {
        await tx.query(`select pg_advisory_xact_lock($1::bigint)`, [repo.TRAVA_DO_TETO_DA_IMAGEM]);
        for (let i = 0; i < 10; i++) {
          await tx.query(`insert into imagens_geradas (carrossel_id, numero, descricao) values ($1, 3, 'uma cena')`, [carrosselId]);
        }
        travou();
        await segurando;
      });
    await travado;

    const tentativa = repo.reservarImagem(pedido());
    let venceu: unknown;
    try {
      venceu = await Promise.race([tentativa.then(() => "pedido"), new Promise((f) => setTimeout(() => f("relogio"), 300))]);
    } finally {
      // Solta a trava antes de qualquer `expect`: com o caso caindo e a trava presa, o `delete` dos
      // casos seguintes esperaria por ela (medido no ensaio da Etapa 2).
      soltar();
      await transacao;
    }
    expect(venceu).toBe("relogio");
    expect(await tentativa).toMatchObject({ ok: false, motivo: "teto" });
  });

  it("a trava da imagem não é a do carrossel nem a do bônus", async () => {
    const carrossel = await import("@/lib/bonus/carrossel-repositorio");
    const bonus = await import("@/lib/bonus/repositorio");
    expect(repo.TRAVA_DO_TETO_DA_IMAGEM).not.toBe(carrossel.TRAVA_DO_TETO_DO_CARROSSEL);
    expect(repo.TRAVA_DO_TETO_DA_IMAGEM).not.toBe(bonus.TRAVA_DO_TETO);
  });
});

describe("um slide gera uma imagem de cada vez", () => {
  it("o segundo pedido do mesmo slide é recusado; outro slide passa", async () => {
    expect((await repo.reservarImagem(pedido(1))).ok).toBe(true);
    expect(await repo.reservarImagem(pedido(1))).toEqual({ ok: false, motivo: "gerando", hoje: 1 });
    expect((await repo.reservarImagem(pedido(2))).ok).toBe(true);
  });

  it("a linha travada pelo prazo não segura o slide", async () => {
    expect((await repo.reservarImagem(pedido(1))).ok).toBe(true);
    await banco.db().sql().query(`update imagens_geradas set criado_em = now() - interval '4 minutes'`);
    expect((await repo.reservarImagem(pedido(1))).ok).toBe(true);
  });

  it("depois de pronta ou de falhar, o slide pede de novo", async () => {
    const r = await repo.reservarImagem(pedido(1));
    if (!r.ok) throw new Error("a reserva devia passar");
    expect(await repo.marcarFalhou(r.id, "falhou no teste")).toBe(true);
    expect((await repo.reservarImagem(pedido(1))).ok).toBe(true);
  });
});

describe("o fim de uma geração", () => {
  it("pronta e falhou só saem de gerando, e uma vez", async () => {
    const a = await repo.reservarImagem(pedido(1));
    const b = await repo.reservarImagem(pedido(2));
    if (!a.ok || !b.ok) throw new Error("as reservas deviam passar");
    expect(await repo.marcarPronta(a.id, "p/bonus-foto/a.jpg")).toBe(true);
    expect(await repo.marcarPronta(a.id, "p/bonus-foto/outra.jpg")).toBe(false);
    expect(await repo.marcarFalhou(a.id, "tarde demais")).toBe(false);
    expect(await repo.marcarFalhou(b.id, "a OpenAI recusou")).toBe(true);
    const linhas = (await banco
      .db()
      .sql()
      .query(`select numero, estado, caminho, motivo, terminado_em is not null as fim from imagens_geradas order by numero`)) as Record<
      string,
      unknown
    >[];
    expect(linhas).toEqual([
      { numero: 1, estado: "pronta", caminho: "p/bonus-foto/a.jpg", motivo: null, fim: true },
      { numero: 2, estado: "falhou", caminho: null, motivo: "a OpenAI recusou", fim: true },
    ]);
  });
});

describe("a leitura para a página e para a consulta", () => {
  it("a última linha de cada slide do carrossel, com a hora do banco", async () => {
    const velha = await repo.reservarImagem({ ...pedido(1), descricao: "a primeira descrição" });
    if (!velha.ok) throw new Error("a reserva devia passar");
    await repo.marcarFalhou(velha.id, "falhou no teste");
    await banco.db().sql().query(`update imagens_geradas set criado_em = now() - interval '1 minute'`);
    await repo.reservarImagem({ ...pedido(1), descricao: "a segunda descrição" });
    await repo.reservarImagem({ ...pedido(3), descricao: "a do slide três" });

    const lidas = await repo.ultimasDoCarrossel(carrosselId);
    expect(lidas.agora).toBeInstanceOf(Date);
    expect(Object.keys(lidas.linhas).map(Number)).toEqual([1, 3]);
    expect(lidas.linhas[1]).toMatchObject({ numero: 1, descricao: "a segunda descrição", estado: "gerando" });
    expect(lidas.linhas[3]).toMatchObject({ numero: 3, descricao: "a do slide três" });
  });

  it("o carrossel sem pedido não tem linha", async () => {
    expect((await repo.ultimasDoCarrossel(carrosselId)).linhas).toEqual({});
  });
});
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-imagem-estado.test.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-imagem-repositorio.integracao.ts
```

Esperado: nos puros, os 4 caem: `estadoDaImagem` não existe. Na integração,
`[rede-global] ALVO: banco de TESTE`, e o arquivo cai com os 12 pulados: o repositório não existe.

- [ ] **Passo 3: o código**

Em `lib/bonus/imagem-regras.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/imagem-regras.ts b/lib/bonus/imagem-regras.ts
index f8b8d96..3a6d587 100644
--- a/lib/bonus/imagem-regras.ts
+++ b/lib/bonus/imagem-regras.ts
@@ -29,6 +29,43 @@ export const TRAVADA_IMAGEM_MS = 210_000;
  */
 export const COMPRESSAO_DA_IMAGEM = 90;
 
+/** O estado de uma linha de `imagens_geradas` (a 018). */
+export type EstadoDaLinhaDaImagem = "gerando" | "pronta" | "falhou";
+
+/** Uma linha de `imagens_geradas`, como o repositório a lê. */
+export type LinhaDaImagem = {
+  id: string;
+  numero: number;
+  descricao: string;
+  estado: EstadoDaLinhaDaImagem;
+  motivo: string | null;
+  caminho: string | null;
+  criado_em: Date;
+  terminado_em: Date | null;
+};
+
+/** O que a tela mostra de um slide: nada pedido, gerando, pronta, falhou, ou travada pelo prazo. */
+export type EstadoDaImagem =
+  | { tipo: "nenhuma" }
+  | { tipo: "gerando" }
+  | { tipo: "pronta"; caminho: string }
+  | { tipo: "falhou"; motivo: string }
+  | { tipo: "travada" };
+
+/**
+ * O ESTADO DA IMAGEM DE UM SLIDE, pela última linha dele e pelo relógio do banco (spec da Etapa 6, "O
+ * acompanhar"). A linha `gerando` que passou de `TRAVADA_IMAGEM_MS` não termina mais: é travada.
+ */
+export function estadoDaImagem(
+  linha: Pick<LinhaDaImagem, "estado" | "motivo" | "caminho" | "criado_em"> | null,
+  agora: Date
+): EstadoDaImagem {
+  if (!linha) return { tipo: "nenhuma" };
+  if (linha.estado === "pronta" && linha.caminho) return { tipo: "pronta", caminho: linha.caminho };
+  if (linha.estado === "falhou" && linha.motivo) return { tipo: "falhou", motivo: linha.motivo };
+  return agora.getTime() - linha.criado_em.getTime() >= TRAVADA_IMAGEM_MS ? { tipo: "travada" } : { tipo: "gerando" };
+}
+
 /** O que impede guardar a imagem gerada: não é JPEG, ou não passa na regra da foto do espaço. */
 export type ProblemaDaImagem = "formato" | ProblemaDaFoto;
 
```

Crie `lib/bonus/imagem-repositorio.ts`:

```ts
import "server-only";
import { sql } from "@/lib/db";
import { TETO_IMAGEM_DIARIO, TRAVADA_IMAGEM_MS, type LinhaDaImagem } from "./imagem-regras";

// O SQL DO CRIADOR DE IMAGEM, na tabela `imagens_geradas` (a 018, spec da Etapa 6). Toda escrita depois
// da reserva é um `update` CONDICIONAL: o `where` é a proteção, e
// testes-integracao/bonus-imagem-repositorio.integracao.ts é quem acusa se alguém a tirar.

/**
 * A chave da trava do teto da imagem. Número fixo, PRÓPRIO e diferente da do bônus e da do carrossel: os
 * tetos são independentes. Exportada para o teste segurar a trava e provar que a reserva espera por ela.
 */
export const TRAVA_DO_TETO_DA_IMAGEM = 2026100901;

/**
 * O QUE O TETO CONTA: todo pedido à OpenAI das últimas 24 horas, de qualquer estado, pelo relógio do
 * banco. O que falhou conta, porque a OpenAI pode ter cobrado; o do carrossel apagado também, porque a
 * linha fica com o carrossel nulo.
 */
const CONTAGEM_DO_TETO = `select count(*)::int as n from imagens_geradas where criado_em > now() - interval '24 hours'`;

export async function imagensNasUltimas24h(): Promise<number> {
  const [linha] = (await sql().query(CONTAGEM_DO_TETO)) as { n: number }[];
  return linha?.n ?? 0;
}

export type ReservaDaImagem = { ok: true; id: string; hoje: number } | { ok: false; motivo: "teto" | "gerando"; hoje: number };

/**
 * RESERVAR UM PEDIDO, NA MESMA TRANSAÇÃO E COM TRAVA: contar, conferir o slide e inserir não correm em
 * paralelo, e dois cliques com 9 no dia não fazem 11. O slide que já tem uma linha `gerando` dentro do
 * prazo recusa o segundo pedido: cada slide gera uma imagem de cada vez. `hoje` é a conta do dia, com
 * este pedido quando ele entra.
 */
export async function reservarImagem(p: { carrosselId: string; numero: number; descricao: string }): Promise<ReservaDaImagem> {
  return sql().begin(async (tx) => {
    await tx.query(`select pg_advisory_xact_lock($1::bigint)`, [TRAVA_DO_TETO_DA_IMAGEM]);
    const [contagem] = (await tx.query(CONTAGEM_DO_TETO)) as { n: number }[];
    const hoje = contagem?.n ?? 0;
    if (hoje >= TETO_IMAGEM_DIARIO) return { ok: false as const, motivo: "teto" as const, hoje };
    const gerando = await tx.query(
      `select 1 from imagens_geradas
        where carrossel_id = $1 and numero = $2 and estado = 'gerando'
          and criado_em > now() - $3::int * interval '1 millisecond'
        limit 1`,
      [p.carrosselId, p.numero, TRAVADA_IMAGEM_MS]
    );
    if (gerando.length) return { ok: false as const, motivo: "gerando" as const, hoje };
    const [linha] = (await tx.query(
      `insert into imagens_geradas (carrossel_id, numero, descricao) values ($1, $2, $3) returning id`,
      [p.carrosselId, p.numero, p.descricao]
    )) as { id: string }[];
    return { ok: true as const, id: linha.id, hoje: hoje + 1 };
  });
}

/** A GERAÇÃO TERMINOU COM A IMAGEM GUARDADA. Só sai de `gerando`, e uma vez. */
export async function marcarPronta(id: string, caminho: string): Promise<boolean> {
  const r = await sql().query(
    `update imagens_geradas set estado = 'pronta', caminho = $2, terminado_em = now()
      where id = $1 and estado = 'gerando' returning id`,
    [id, caminho]
  );
  return r.length === 1;
}

/** A GERAÇÃO TERMINOU SEM IMAGEM, com a frase do motivo (sem chave nenhuma: `tirarChave`). Só sai de `gerando`, e uma vez. */
export async function marcarFalhou(id: string, motivo: string): Promise<boolean> {
  const r = await sql().query(
    `update imagens_geradas set estado = 'falhou', motivo = $2, terminado_em = now()
      where id = $1 and estado = 'gerando' returning id`,
    [id, motivo]
  );
  return r.length === 1;
}

/**
 * A ÚLTIMA LINHA DE CADA SLIDE DO CARROSSEL, com a hora do banco, que decide o "travada". A página lê
 * daqui a descrição do "Gerar de novo" e o estado de cada card; a consulta, o estado de um slide.
 */
export async function ultimasDoCarrossel(carrosselId: string): Promise<{ agora: Date; linhas: Record<number, LinhaDaImagem> }> {
  const [relogio] = (await sql().query(`select now() as agora`)) as { agora: Date }[];
  const lidas = (await sql().query(
    `select distinct on (numero) id, numero, descricao, estado, motivo, caminho, criado_em, terminado_em
       from imagens_geradas
      where carrossel_id = $1
      order by numero, criado_em desc`,
    [carrosselId]
  )) as LinhaDaImagem[];
  return { agora: relogio.agora, linhas: Object.fromEntries(lidas.map((l) => [l.numero, l])) };
}
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx eslint lib/bonus/imagem-regras.ts lib/bonus/imagem-repositorio.ts tests/bonus-imagem-estado.test.ts testes-integracao/bonus-imagem-repositorio.integracao.ts
npx vitest run tests/bonus-imagem-estado.test.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-imagem-repositorio.integracao.ts
```

Esperado: `tsc` e lint limpos; os 4 puros passam; `[rede-global] ALVO: banco de TESTE`, e os 12
passam.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/imagem-regras.ts lib/bonus/imagem-repositorio.ts tests/bonus-imagem-estado.test.ts testes-integracao/bonus-imagem-repositorio.integracao.ts
test "$(git branch --show-current)" = "criador-de-imagem"
git add lib/bonus/imagem-regras.ts lib/bonus/imagem-repositorio.ts tests/bonus-imagem-estado.test.ts testes-integracao/bonus-imagem-repositorio.integracao.ts
git commit -m "feat(bonus): o teto das imagens, com trava e um slide por vez"
```

---

### FASE 6.5 — Pedir e gerar a imagem, guardada como a foto do slide

**Arquivos:**
- Criar: `lib/bonus/imagem-processo.ts` (`server-only`)
- Modificar: `lib/bonus/imagem-textos.ts` (as frases do pedido e da geração),
  `lib/bonus/publicar-processo.ts` (só o `export` de `conferirCarrossel`, item 3 do ensaio)
- Testar: `tests/bonus-imagem-textos.test.ts`, `testes-integracao/bonus-imagem-processo.integracao.ts`
  (novos); `testes-integracao/bonus-publicar-processo.integracao.ts` (sem mudar)

**Interfaces:**
- Consome: `conferirCarrossel`, `assinarImagem` e `guardarImagem` (`lib/bonus/publicar-processo.ts`);
  `apagarSemDerrubar` (`lib/bonus/publicar-bucket.ts`); `comEspaco` (`lib/bonus/arte-escolhas.ts`);
  `validarDescricao` (FASE 6.2); `gerarNaOpenAI`, `GerarNaOpenAI` e `problemaDaImagemGerada` (FASE
  6.3); `reservarImagem`, `marcarPronta` e `marcarFalhou` (FASE 6.4); a recusa e a frase do publicar
  (`RecusaDaPublicacaoDoCarrossel`, `textoDaRecusaDaPublicacaoDoCarrossel`).
- Produz: `TEXTO_GERANDO_A_IMAGEM`, `TEXTO_IMAGEM_GERADA`, `TEXTO_IMAGEM_TRAVADA`,
  `TEXTO_IMAGEM_NAO_SUBIU`, `TEXTO_IMAGEM_FALHOU_SEM_MOTIVO`, `type RecusaDaImagem` (as do publicar,
  mais `descricao`, `sem_chave`, `teto` e `gerando`), `textoDaRecusaDaImagem(r): string`,
  `textoDoContador(hoje: number): string` ("Hoje: N de 10 imagens"), `textoDoProblemaDaImagem(p): string`;
  `type PedidoDaImagem`, `pedirImagem(p: { id; numero; descricao; contas; ambiente? }):
  Promise<PedidoDaImagem>` (confere o carrossel, o slide, o espaço, a descrição e a chave, e reserva:
  nada disso chama a OpenAI), `gerarImagem(p: { reservaId; id; numero; descricao; contas; gerar?;
  guardar?; marcarPronta? }): Promise<{ ok: true; caminho: string } | { ok: false; motivo: string }>`
  (a OpenAI, a conferência, o `PUT` em `bonus-foto/`, o `guardarImagem` e a marca; antes do guardar
  confirmar, a falha apaga o que subiu; depois, não: achado 89).

- [ ] **Passo 1: os testes**

Crie `tests/bonus-imagem-textos.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { TETO_IMAGEM_DIARIO } from "@/lib/bonus/imagem-regras";
import {
  TEXTO_GERANDO_A_IMAGEM,
  TEXTO_IMAGEM_FALHOU_SEM_MOTIVO,
  TEXTO_IMAGEM_GERADA,
  TEXTO_IMAGEM_NAO_SUBIU,
  TEXTO_IMAGEM_TRAVADA,
  TEXTO_SEM_CHAVE_DA_IMAGEM,
  textoDaRecusaDaImagem,
  textoDoContador,
  textoDoProblemaDaImagem,
  type RecusaDaImagem,
} from "@/lib/bonus/imagem-textos";
import { textoDaRecusaDaPublicacaoDoCarrossel } from "@/lib/bonus/publicar-textos";

// AS FRASES DO CRIADOR DE IMAGEM (spec da Etapa 6, "A tela"): toda recusa tem frase própria, e a do
// carrossel (na fila, sem conta, só texto…) é a mesma do publicar.

describe("as recusas de pedir uma imagem", () => {
  const proprias: RecusaDaImagem[] = [
    { motivo: "descricao", texto: "Descreva o que a ilustração deve mostrar." },
    { motivo: "sem_chave" },
    { motivo: "teto" },
    { motivo: "gerando" },
  ];

  it("cada uma tem frase própria, terminada em ponto", () => {
    const frases = proprias.map(textoDaRecusaDaImagem);
    for (const f of frases) expect(f).toMatch(/\.$/);
    expect(new Set(frases).size).toBe(frases.length);
  });

  it("a descrição usa a frase do Labs; a chave, a do servidor; o teto diz o número", () => {
    expect(textoDaRecusaDaImagem({ motivo: "descricao", texto: "Descreva o que a ilustração deve mostrar." })).toBe(
      "Descreva o que a ilustração deve mostrar."
    );
    expect(textoDaRecusaDaImagem({ motivo: "sem_chave" })).toBe(TEXTO_SEM_CHAVE_DA_IMAGEM);
    expect(textoDaRecusaDaImagem({ motivo: "teto" })).toContain(`${TETO_IMAGEM_DIARIO} imagens`);
  });

  it("as do carrossel são as do publicar", () => {
    const deCarrossel: RecusaDaImagem[] = [{ motivo: "sem_conta" }, { motivo: "sem_espaco", numero: 2 }, { motivo: "slide" }];
    for (const r of deCarrossel) {
      expect(textoDaRecusaDaImagem(r)).toBe(textoDaRecusaDaPublicacaoDoCarrossel(r as Parameters<typeof textoDaRecusaDaPublicacaoDoCarrossel>[0]));
    }
  });
});

describe("as outras frases da imagem", () => {
  it("o contador do dia, que não passa do teto", () => {
    expect(textoDoContador(3)).toBe("Hoje: 3 de 10 imagens.");
    expect(textoDoContador(12)).toBe("Hoje: 10 de 10 imagens.");
  });

  it("a imagem que não serve, e a pesada à parte", () => {
    expect(textoDoProblemaDaImagem("formato")).toMatch(/não serve para o espaço da arte/);
    expect(textoDoProblemaDaImagem("proporcao")).toBe(textoDoProblemaDaImagem("formato"));
    expect(textoDoProblemaDaImagem("pesada")).toContain("2 MB");
  });

  it("gerando, pronta, travada e as falhas têm frase, cada uma diferente", () => {
    const frases = [TEXTO_GERANDO_A_IMAGEM, TEXTO_IMAGEM_GERADA, TEXTO_IMAGEM_TRAVADA, TEXTO_IMAGEM_NAO_SUBIU, TEXTO_IMAGEM_FALHOU_SEM_MOTIVO];
    for (const f of frases) expect(f).toMatch(/[.…]$/);
    expect(new Set(frases).size).toBe(frases.length);
    expect(TEXTO_GERANDO_A_IMAGEM).toBe("Gerando a imagem… leva uns 30 segundos.");
  });
});
```

Crie `testes-integracao/bonus-imagem-processo.integracao.ts`:

```ts
// O CRIADOR DE IMAGEM CONTRA O BANCO E UM BUCKET FALSO (spec da Etapa 6, "Pedir e acompanhar").
//
// A FORMA É A DE `bonus-publicar-processo.integracao.ts`: o bucket é um servidor HTTP nesta máquina, as
// três variáveis do Supabase apontam para ele, e o `beforeAll` recusa rodar se a `SUPABASE_URL` não for
// loopback. **A OpenAI é sempre uma função falsa, passada por parâmetro: nada sai desta máquina.**
//
// O que este arquivo prende é a COSTURA: o pedir que recusa sem custo e sem linha; o gerar que confere,
// sobe, guarda como foto e marca a linha; e o que fica no bucket em cada falha (achado 89).
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { TextoDeCarrossel } from "@/lib/bonus/carrossel-texto";
import { bancoDescartavel } from "./harness";

type ModuloImagem = typeof import("@/lib/bonus/imagem-processo");
type ModuloPublicar = typeof import("@/lib/bonus/publicar-processo");
type ModuloRegras = typeof import("@/lib/bonus/publicar-regras");
type ModuloSlides = typeof import("@/lib/bonus/arte-slides");
type ModuloTextos = typeof import("@/lib/bonus/imagem-textos");
type ContaDoCabecalho = import("@/lib/bonus/arte-conta").ContaDoCabecalho;

const banco = bancoDescartavel();

const CONTA = "17841400000000001";
const CHAVE_DO_BUCKET_FALSO = "chave-de-servico-inventada-para-o-teste";
const BUCKET = "MetodoChatDeTeste";
const AMBIENTE = { OPENAI_API_KEY: "chave-inventada-para-o-teste" };
const JPEG_DO_CANVA = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 9, 9, 9]);
const DECLARADO = { nome: "slide.jpg", mime: "image/jpeg", bytes: 1000, largura: 1080, altura: 1350 };
const CENA = "/marketing uma pessoa usando o celular numa loja de roupas";

const slide = (i: number) => ({ titulo: `Título do slide ${i}`, texto: `Texto do slide ${i}, com mais de trinta caracteres.` });
const TEXTO: TextoDeCarrossel = {
  tipo: "carrossel",
  titulo: "Mensagens para reativar clientes",
  gancho: "Seu cliente sumiu? Não é culpa dele.",
  slides: [slide(1), slide(2), slide(3)],
  chamada: "Comente SUMIDO e receba as mensagens prontas.",
  legenda: "Quem sumiu ainda pode voltar. Comente SUMIDO que eu te mando as mensagens prontas para usar hoje mesmo.",
};
// 5 slides: o 1 (gancho) e o 5 (chamada) são "só texto"; o 2, o 3 e o 4 têm espaço de imagem.
const ARTE = { conta: CONTA, nome: "Thiago Vannuchi", arroba: "thiagovannuchi", soTexto: [1, 5] };

/** Um segmento JPEG: FF, a marca, o tamanho em dois bytes (que conta a si mesmo) e o conteúdo. */
const segmento = (marca: number, conteudo: number[]) => [0xff, marca, (conteudo.length + 2) >> 8, (conteudo.length + 2) & 0xff, ...conteudo];
/** O começo de um JPEG com as medidas no SOF, como o que a OpenAI devolve, e o fim. */
function jpeg(largura: number, altura: number): Uint8Array {
  const sof = segmento(0xc0, [8, altura >> 8, altura & 0xff, largura >> 8, largura & 0xff, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
  return new Uint8Array([0xff, 0xd8, ...segmento(0xe0, [0x4a, 0x46, 0x49, 0x46, 0]), ...sof, ...segmento(0xda, [0]), 0x55, 0xff, 0xd9]);
}
const GERADA = jpeg(1536, 1024);
const openaiQueGera = async () => ({ ok: true as const, bytes: GERADA });

// O BUCKET FALSO: os objetos ficam num Map, e cada chamada fica anotada.
const bucket = { objetos: new Map<string, Uint8Array>(), chamadas: [] as string[] };
let servidor: Server;
let imagem: ModuloImagem;
let publicar: ModuloPublicar;
let regras: ModuloRegras;
let slides: ModuloSlides;
let textos: ModuloTextos;
let contas: ContaDoCabecalho[];

beforeAll(async () => {
  servidor = createServer(async (req, res) => {
    const u = new URL(req.url ?? "/", "http://127.0.0.1");
    const corpo: Buffer[] = [];
    for await (const parte of req) corpo.push(parte as Buffer);
    const responder = (status: number, json: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(json));
    };
    const depois = (prefixo: string) => decodeURIComponent(u.pathname.slice(prefixo.length));
    const comChave = () => req.headers["apikey"] === CHAVE_DO_BUCKET_FALSO;
    if (req.method === "GET" && u.pathname === `/storage/v1/bucket/${BUCKET}`) {
      if (!comChave()) return responder(401, { message: "sem apikey" });
      return responder(200, { file_size_limit: 52428800 });
    }
    const assinar = `/storage/v1/object/upload/sign/${BUCKET}/`;
    if (req.method === "POST" && u.pathname.startsWith(assinar)) {
      if (!comChave()) return responder(401, { message: "sem apikey" });
      const caminho = depois(assinar);
      bucket.chamadas.push(`assinou ${caminho}`);
      return responder(200, { url: `/object/upload/sign/${BUCKET}/${caminho}?token=tk`, token: "tk" });
    }
    if (req.method === "PUT" && u.pathname.startsWith(assinar)) {
      if (u.searchParams.get("token") !== "tk") return responder(400, { message: "sem token" });
      const caminho = depois(assinar);
      bucket.chamadas.push(`subiu ${caminho}`);
      bucket.objetos.set(caminho, new Uint8Array(Buffer.concat(corpo)));
      return responder(200, { Key: caminho });
    }
    const publico = `/storage/v1/object/public/${BUCKET}/`;
    if (req.method === "GET" && u.pathname.startsWith(publico)) {
      const objeto = bucket.objetos.get(depois(publico));
      if (!objeto) return responder(400, { message: "Object not found" });
      res.writeHead(200, { "content-type": "image/jpeg" });
      return res.end(Buffer.from(objeto));
    }
    const objeto = `/storage/v1/object/${BUCKET}/`;
    if (req.method === "DELETE" && u.pathname.startsWith(objeto)) {
      if (!comChave()) return responder(401, { message: "sem apikey" });
      const caminho = depois(objeto);
      bucket.chamadas.push(`apagou ${caminho}`);
      return bucket.objetos.delete(caminho) ? responder(200, {}) : responder(400, { message: "Object not found" });
    }
    responder(404, { message: `o bucket falso nao conhece ${req.method} ${u.pathname}` });
  });
  await new Promise<void>((pronto) => servidor.listen(0, "127.0.0.1", pronto));
  process.env.SUPABASE_URL = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = CHAVE_DO_BUCKET_FALSO;
  process.env.SUPABASE_BUCKET = BUCKET;
  delete process.env.QSTASH_TOKEN;
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(process.env.SUPABASE_URL ?? "")) {
    throw new Error("RECUSADO: a SUPABASE_URL desta rodada nao e loopback. Sem isso, este teste escreveria no bucket de verdade.");
  }
  imagem = await import("@/lib/bonus/imagem-processo");
  publicar = await import("@/lib/bonus/publicar-processo");
  regras = await import("@/lib/bonus/publicar-regras");
  slides = await import("@/lib/bonus/arte-slides");
  textos = await import("@/lib/bonus/imagem-textos");
  await banco.db().upsertAccount({
    ig_user_id: CONTA,
    username: "thiagovannuchi",
    name: "thiagovannuchi",
    profile_picture_url: null,
    access_token: "token-que-nao-vale-nada",
    token_expires_at: null,
  });
  contas = await (await import("@/lib/bonus/carrossel-repositorio")).contasParaArte();
});

afterAll(async () => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_BUCKET;
  await new Promise<void>((pronto) => servidor.close(() => pronto()));
});

beforeEach(async () => {
  await banco.db().sql().query(`delete from queue`);
  await banco.db().sql().query(`delete from imagens_geradas`);
  await banco.db().sql().query(`delete from carrosseis_gerados`);
  bucket.objetos.clear();
  bucket.chamadas = [];
});

/** O carrossel avulso do texto livre, pronto, com a arte dada. */
async function carrossel(arte: Record<string, unknown> = ARTE): Promise<string> {
  const [c] = (await banco
    .db()
    .sql()
    .query(
      `insert into carrosseis_gerados (origem, total_slides, palavra, contexto, estado, gerado, arte)
       values ('livre', 5, 'SUMIDO', $1::jsonb, 'pronto', $2::jsonb, $3::jsonb) returning id`,
      [{ tipo: "livre", tema: "Vendas", conteudo: "Mensagens para trazer de volta quem sumiu." }, TEXTO, arte]
    )) as { id: string }[];
  return c.id;
}

const pedir = (id: string, numero = 2, descricao = CENA, ambiente: Record<string, string | undefined> = AMBIENTE) =>
  imagem.pedirImagem({ id, numero, descricao, contas, ambiente });

/** Pede e devolve a reserva; o caso que chama quer que o pedido passe. */
async function reservado(id: string, numero = 2): Promise<string> {
  const r = await pedir(id, numero);
  if (!r.ok) throw new Error(`o pedido devia passar: ${r.recusa.motivo}`);
  return r.reservaId;
}

async function linhas() {
  return (await banco.db().sql().query(`select numero, estado, motivo, caminho from imagens_geradas order by criado_em`)) as {
    numero: number;
    estado: string;
    motivo: string | null;
    caminho: string | null;
  }[];
}

async function arteDe(id: string): Promise<Record<string, unknown>> {
  const [l] = (await banco.db().sql().query(`select arte from carrosseis_gerados where id = $1`, [id])) as { arte: Record<string, unknown> }[];
  return l.arte;
}

const fotosNoBucket = () => [...bucket.objetos.keys()].filter((k) => k.startsWith(`${CONTA}/bonus-foto/`));

/** Assina, sobe pelo PUT de verdade (no bucket falso) e guarda o slide pronto do Canva no slide. */
async function slidePronto(id: string, numero: number): Promise<string> {
  const a = await publicar.assinarImagem({ id, numero, destino: "slide", arquivo: DECLARADO, contas });
  if (!a.ok) throw new Error(`assinar recusou: ${a.recusa.motivo}`);
  await fetch(a.url, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: JPEG_DO_CANVA });
  const g = await publicar.guardarImagem({ id, numero, caminho: a.caminho, contas });
  if (!g.ok) throw new Error(`guardar recusou: ${g.recusa.motivo}`);
  return a.caminho;
}

describe("pedir uma imagem", () => {
  it("reserva a linha gerando, com a conta do dia, sem chamar a OpenAI", async () => {
    const id = await carrossel();
    const r = await pedir(id);
    expect(r).toMatchObject({ ok: true, hoje: 1 });
    expect(await linhas()).toEqual([{ numero: 2, estado: "gerando", motivo: null, caminho: null }]);
    expect(bucket.chamadas).toEqual([]);
  });

  it.each([
    ["o slide que não existe", { numero: 9 }, "slide"],
    ["o slide só texto", { numero: 1 }, "sem_espaco"],
    ["a descrição curta", { descricao: "uma" }, "descricao"],
    ["o atalho que não existe", { descricao: "/vitrine uma caixa de presente bonita" }, "descricao"],
    ["sem a chave", { ambiente: {} }, "sem_chave"],
  ])("recusa %s, sem linha nova", async (_nome, mudanca, motivo) => {
    const id = await carrossel();
    const m = mudanca as { numero?: number; descricao?: string; ambiente?: Record<string, string | undefined> };
    const r = await pedir(id, m.numero ?? 2, m.descricao ?? CENA, m.ambiente ?? AMBIENTE);
    expect(r.ok ? null : r.recusa.motivo).toBe(motivo);
    expect(await linhas()).toEqual([]);
  });

  it.each([
    ["o carrossel sem conta", {}, "sem_conta"],
    ["o carrossel de conta desconectada", { ...ARTE, conta: "17841499999999999" }, "conta_desconectada"],
  ])("recusa %s, sem linha nova", async (_nome, arte, motivo) => {
    const id = await carrossel(arte);
    const r = await pedir(id);
    expect(r.ok ? null : r.recusa.motivo).toBe(motivo);
    expect(await linhas()).toEqual([]);
  });

  it("recusa o carrossel na fila, sem linha nova", async () => {
    const id = await carrossel({
      ...ARTE,
      publicacao: { chave: "pub:outro", caminhos: [`${CONTA}/bonus-fila/x.jpg`], reservada_em: new Date().toISOString() },
    });
    const r = await pedir(id);
    expect(r.ok ? null : r.recusa.motivo).toBe("travado");
    expect(await linhas()).toEqual([]);
  });

  it("recusa pelo teto, com 10 no dia", async () => {
    const id = await carrossel();
    for (let i = 0; i < 10; i++) {
      await banco
        .db()
        .sql()
        .query(`insert into imagens_geradas (carrossel_id, numero, descricao, estado, motivo, terminado_em) values ($1, 3, 'uma cena', 'falhou', 'x', now())`, [id]);
    }
    const r = await pedir(id);
    expect(r).toEqual({ ok: false, recusa: { motivo: "teto" }, hoje: 10 });
  });
});

describe("gerar a imagem", () => {
  it("vai para bonus-foto na pasta da conta, o slide guarda como foto, a anterior sai, e a linha fica pronta", async () => {
    const id = await carrossel();
    const anterior = await slidePronto(id, 2);
    const reservaId = await reservado(id);
    const r = await imagem.gerarImagem({ reservaId, id, numero: 2, descricao: CENA, contas, gerar: openaiQueGera });
    if (!r.ok) throw new Error(`a geração devia passar: ${r.motivo}`);
    expect(r.caminho).toMatch(new RegExp(`^${CONTA}/bonus-foto/[0-9a-f-]{36}\\.jpg$`));
    expect(bucket.objetos.get(r.caminho)).toEqual(GERADA);
    expect(bucket.objetos.has(anterior)).toBe(false);
    expect(regras.fotosDaArte(await arteDe(id), 5)).toEqual({ 2: r.caminho });
    expect(await linhas()).toEqual([{ numero: 2, estado: "pronta", motivo: null, caminho: r.caminho }]);
  });

  it("o publicar desse slide sai pela arte, como foto: a imagem gerada não vai para a fila", async () => {
    const id = await carrossel();
    for (const n of [3, 4]) await slidePronto(id, n);
    const r = await imagem.gerarImagem({ reservaId: await reservado(id), id, numero: 2, descricao: CENA, contas, gerar: openaiQueGera });
    if (!r.ok) throw new Error(`a geração devia passar: ${r.motivo}`);
    const desenho = (n: number, foto: string | null) => regras.versaoDoDesenho(slides.slidesDoTexto(TEXTO)[n - 1], foto);
    const subir = async (n: number) => {
      const a = await publicar.assinarImagem({ id, numero: n, destino: "fila", arquivo: DECLARADO, contas });
      if (!a.ok) throw new Error(`assinar recusou: ${a.recusa.motivo}`);
      await fetch(a.url, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: JPEG_DO_CANVA });
      return a.caminho;
    };
    const artes = [
      { numero: 1, caminho: await subir(1), versao: desenho(1, null) },
      { numero: 2, caminho: await subir(2), versao: desenho(2, r.caminho) },
      { numero: 5, caminho: await subir(5), versao: desenho(5, null) },
    ];
    expect(await publicar.publicarNaFila({ id, quando: new Date(Date.now() + 86_400_000), artes, contas, drenar: async () => {} })).toEqual({
      ok: true,
      quando: expect.any(Date),
    });
    const [item] = (await banco.db().sql().query(`select payload from queue`)) as { payload: { caminhos: string[] } }[];
    expect(item.payload.caminhos[1]).toBe(artes[1].caminho);
    expect(item.payload.caminhos).not.toContain(r.caminho);
  });

  it("a recusa da OpenAI fica falhou, com a frase, e nada sobe", async () => {
    const id = await carrossel();
    const erro = "A OpenAI recusou o pedido. (OpenAI: Your request was rejected by the safety system.)";
    const r = await imagem.gerarImagem({ reservaId: await reservado(id), id, numero: 2, descricao: CENA, contas, gerar: async () => ({ ok: false, erro }) });
    expect(r).toEqual({ ok: false, motivo: erro });
    expect(await linhas()).toEqual([{ numero: 2, estado: "falhou", motivo: erro, caminho: null }]);
    expect(bucket.chamadas).toEqual([]);
  });

  it("a imagem fora do formato não sobe, e a linha fica falhou com a frase", async () => {
    const id = await carrossel();
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const r = await imagem.gerarImagem({
      reservaId: await reservado(id),
      id,
      numero: 2,
      descricao: CENA,
      contas,
      gerar: async () => ({ ok: true, bytes: png }),
    });
    expect(r).toEqual({ ok: false, motivo: textos.textoDoProblemaDaImagem("formato") });
    expect(bucket.chamadas.filter((c) => c.startsWith("subiu"))).toEqual([]);
  });

  it("o carrossel agendado no meio da geração não recebe a imagem, e nada sobe", async () => {
    const id = await carrossel();
    const reservaId = await reservado(id);
    const agendaNoMeio = async () => {
      await banco
        .db()
        .sql()
        .query(`update carrosseis_gerados set arte = arte || $2::jsonb where id = $1`, [
          id,
          { publicacao: { chave: "pub:no-meio", caminhos: [`${CONTA}/bonus-fila/x.jpg`], reservada_em: new Date().toISOString() } },
        ]);
      return { ok: true as const, bytes: GERADA };
    };
    const r = await imagem.gerarImagem({ reservaId, id, numero: 2, descricao: CENA, contas, gerar: agendaNoMeio });
    expect(r.ok).toBe(false);
    expect(fotosNoBucket()).toEqual([]);
    expect(regras.fotosDaArte(await arteDe(id), 5)).toEqual({});
    expect((await linhas())[0].estado).toBe("falhou");
  });

  // ACHADO 89: enquanto o guardar não confirmou, a falha apaga o que subiu.
  it("a falha ao guardar apaga do bucket o que subiu", async () => {
    const id = await carrossel();
    const r = await imagem.gerarImagem({
      reservaId: await reservado(id),
      id,
      numero: 2,
      descricao: CENA,
      contas,
      gerar: openaiQueGera,
      guardar: async () => ({ ok: false, recusa: { motivo: "mudou" } }),
    });
    expect(r.ok).toBe(false);
    expect(bucket.chamadas.some((c) => c.startsWith(`subiu ${CONTA}/bonus-foto/`))).toBe(true);
    expect(fotosNoBucket()).toEqual([]);
    expect((await linhas())[0].estado).toBe("falhou");
  });

  // ACHADO 89: depois do guardar, o arquivo já é a foto do slide. A falha ao marcar a linha deixa o
  // arquivo, e a linha `gerando` vence pelo prazo e conta no teto.
  it("a falha ao marcar a linha, depois de guardar, deixa a foto no bucket e no slide", async () => {
    const id = await carrossel();
    const r = await imagem.gerarImagem({
      reservaId: await reservado(id),
      id,
      numero: 2,
      descricao: CENA,
      contas,
      gerar: openaiQueGera,
      marcarPronta: async () => {
        throw new Error("o banco caiu bem nesta hora");
      },
    });
    expect(r.ok).toBe(true);
    const [foto] = fotosNoBucket();
    expect(foto).toBeDefined();
    expect(regras.fotosDaArte(await arteDe(id), 5)).toEqual({ 2: foto });
    expect((await linhas())[0].estado).toBe("gerando");
  });

  it("a OpenAI que lança fica falhou, com a frase sem motivo", async () => {
    const id = await carrossel();
    const r = await imagem.gerarImagem({
      reservaId: await reservado(id),
      id,
      numero: 2,
      descricao: CENA,
      contas,
      gerar: async () => {
        throw new Error("explodiu");
      },
    });
    expect(r).toEqual({ ok: false, motivo: textos.TEXTO_IMAGEM_FALHOU_SEM_MOTIVO });
    expect((await linhas())[0]).toMatchObject({ estado: "falhou", motivo: textos.TEXTO_IMAGEM_FALHOU_SEM_MOTIVO });
  });
});
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-imagem-textos.test.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-imagem-processo.integracao.ts testes-integracao/bonus-publicar-processo.integracao.ts
```

Esperado: nos puros, os 6 caem: as frases não existem. Na integração, `[rede-global] ALVO: banco de
TESTE`; o arquivo do processo cai com os 18 pulados (o processo não existe), e os 46 de
`bonus-publicar-processo` passam: o `export` não muda o publicar.

- [ ] **Passo 3: o código**

Em `lib/bonus/imagem-textos.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/imagem-textos.ts b/lib/bonus/imagem-textos.ts
index d84851a..1c86f5a 100644
--- a/lib/bonus/imagem-textos.ts
+++ b/lib/bonus/imagem-textos.ts
@@ -1,7 +1,54 @@
+import { TETO_IMAGEM_DIARIO, type ProblemaDaImagem } from "./imagem-regras";
+import { textoDaRecusaDaPublicacaoDoCarrossel, type RecusaDaPublicacaoDoCarrossel } from "./publicar-textos";
+
 // AS FRASES DO CRIADOR DE IMAGEM, fora do JSX e das actions (o princípio de lib/bonus/textos.ts): uma
 // saída muda é indistinguível de sucesso, e cada saída tem frase, testada. As frases das recusas da
 // OpenAI são as do Labs (erro-ilustracao.ts, copiado byte a byte).
 
+export const TEXTO_GERANDO_A_IMAGEM = "Gerando a imagem… leva uns 30 segundos.";
+export const TEXTO_IMAGEM_GERADA = "Imagem gerada.";
+export const TEXTO_IMAGEM_TRAVADA = "A geração não terminou. Tente de novo.";
+export const TEXTO_IMAGEM_NAO_SUBIU = "Não consegui guardar a imagem no armazenamento. Tente de novo.";
+export const TEXTO_IMAGEM_FALHOU_SEM_MOTIVO = "A geração falhou sem dizer o motivo. Tente de novo.";
+
+/**
+ * As recusas de pedir uma imagem: as do carrossel (na fila, sem conta, slide só texto…), que são as do
+ * publicar, e as próprias.
+ */
+export type RecusaDaImagem =
+  | RecusaDaPublicacaoDoCarrossel
+  | { motivo: "descricao"; texto: string }
+  | { motivo: "sem_chave" }
+  | { motivo: "teto" }
+  | { motivo: "gerando" };
+
+export function textoDaRecusaDaImagem(r: RecusaDaImagem): string {
+  switch (r.motivo) {
+    case "descricao":
+      return r.texto;
+    case "sem_chave":
+      return TEXTO_SEM_CHAVE_DA_IMAGEM;
+    case "teto":
+      return `As ${TETO_IMAGEM_DIARIO} imagens das últimas 24 horas já foram geradas. A próxima libera quando a mais antiga completar um dia.`;
+    case "gerando":
+      return "Este slide já está gerando uma imagem. Espere ela terminar.";
+    default:
+      return textoDaRecusaDaPublicacaoDoCarrossel(r);
+  }
+}
+
+/** "Hoje: 3 de 10 imagens." A conta das últimas 24 horas, que a tela mostra junto do campo. */
+export function textoDoContador(hoje: number): string {
+  return `Hoje: ${Math.min(hoje, TETO_IMAGEM_DIARIO)} de ${TETO_IMAGEM_DIARIO} imagens.`;
+}
+
+/** A imagem que voltou e não serve para o espaço: a frase não fala em subir, porque ninguém subiu nada. */
+export function textoDoProblemaDaImagem(p: ProblemaDaImagem): string {
+  return p === "pesada"
+    ? "A imagem veio com mais de 2 MB, e o Chat não a guarda. Tente de novo."
+    : "A OpenAI devolveu uma imagem que não serve para o espaço da arte. Tente de novo.";
+}
+
 export const TEXTO_SEM_CHAVE_DA_IMAGEM =
   "A geração de imagem não está configurada: falta a chave da OpenAI no servidor. Avise quem cuida do Chat.";
 export const TEXTO_OPENAI_DEMOROU = "A OpenAI demorou demais para responder. Tente de novo.";
```

Em `lib/bonus/publicar-processo.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/publicar-processo.ts b/lib/bonus/publicar-processo.ts
index 1cac718..ed908c7 100644
--- a/lib/bonus/publicar-processo.ts
+++ b/lib/bonus/publicar-processo.ts
@@ -61,8 +61,11 @@ type CarrosselConferido = {
   conta: string;
 };
 
-/** O que as três operações conferem antes de tudo: pronto, com conta gravada e conectada, e a trava livre. */
-async function conferirCarrossel(id: string, contas: ContaDoCabecalho[]): Promise<CarrosselConferido | Recusa> {
+/**
+ * O que as três operações conferem antes de tudo: pronto, com conta gravada e conectada, e a trava livre.
+ * Exportada para o pedido de imagem (lib/bonus/imagem-processo.ts, Etapa 6), que confere igual.
+ */
+export async function conferirCarrossel(id: string, contas: ContaDoCabecalho[]): Promise<CarrosselConferido | Recusa> {
   const linha = await lerCarrossel(id);
   const texto = linha?.estado === "pronto" ? textoDaLinhaDoCarrossel(linha) : null;
   if (!linha || !texto) return recusa({ motivo: "nao_pronto" });
```

Crie `lib/bonus/imagem-processo.ts`:

```ts
import "server-only";
import type { ContaDoCabecalho } from "./arte-conta";
import { comEspaco } from "./arte-escolhas";
import { medidasDoJpeg } from "./imagem-jpeg";
import { gerarNaOpenAI, type GerarNaOpenAI } from "./imagem-openai";
import { problemaDaImagemGerada } from "./imagem-regras";
import { marcarFalhou, marcarPronta as marcarProntaNoBanco, reservarImagem } from "./imagem-repositorio";
import { TEXTO_IMAGEM_FALHOU_SEM_MOTIVO, TEXTO_IMAGEM_NAO_SUBIU, textoDoProblemaDaImagem, type RecusaDaImagem } from "./imagem-textos";
import { validarDescricao } from "./prompt-ilustracao";
import { apagarSemDerrubar } from "./publicar-bucket";
import { assinarImagem, conferirCarrossel, guardarImagem } from "./publicar-processo";
import { textoDaRecusaDaPublicacaoDoCarrossel } from "./publicar-textos";

// O PROCESSO DO CRIADOR DE IMAGEM (spec da Etapa 6, "Pedir e acompanhar"), em duas partes.
//
// O PEDIDO (`pedirImagem`) roda dentro da action e responde na hora: confere o carrossel como o publicar
// confere, o slide, a descrição e a chave, e reserva no teto. Tudo isso recusa sem chamar a OpenAI, ou
// seja, sem custo. A action não espera a imagem, porque o Next manda as actions de um cliente uma de
// cada vez (achado 88): esperar 30 s prenderia o resto da página.
//
// A GERAÇÃO (`gerarImagem`) roda no `after()` da mesma action: chama a OpenAI, confere a imagem, sobe ao
// bucket e guarda no slide pelo mesmo caminho do "Subir foto" (`assinarImagem` e `guardarImagem`), que
// conferem de novo o carrossel. Para a rota da arte e para o publicar, a imagem gerada é uma foto.
//
// O QUE SAI DO BUCKET NUMA FALHA (achado 89): enquanto o `guardarImagem` não confirmou, a falha apaga o
// arquivo que subiu. Depois dele, o arquivo é a foto do slide, e a anterior já saiu do bucket: uma falha
// ao marcar a linha deixa o arquivo, e a linha `gerando` vence pelo prazo e conta no teto.

export type PedidoDaImagem = { ok: true; reservaId: string; hoje: number } | { ok: false; recusa: RecusaDaImagem; hoje?: number };

/** PEDIR UMA IMAGEM: as conferências que não custam nada, e a reserva no teto. */
export async function pedirImagem(p: {
  id: string;
  numero: number;
  descricao: string;
  contas: ContaDoCabecalho[];
  /** Só para o teste: em produção, o ambiente do servidor. */
  ambiente?: Readonly<Record<string, string | undefined>>;
}): Promise<PedidoDaImagem> {
  const ambiente = p.ambiente ?? process.env;
  const c = await conferirCarrossel(p.id, p.contas);
  if (!c.ok) return c;
  if (!Number.isInteger(p.numero) || !c.slides[p.numero - 1]) return { ok: false, recusa: { motivo: "slide" } };
  if (!comEspaco(c.escolhas, p.numero)) return { ok: false, recusa: { motivo: "sem_espaco", numero: p.numero } };
  const descricao = validarDescricao(p.descricao);
  if (!descricao.ok) return { ok: false, recusa: { motivo: "descricao", texto: descricao.mensagem } };
  if (!ambiente.OPENAI_API_KEY?.trim()) return { ok: false, recusa: { motivo: "sem_chave" } };
  const r = await reservarImagem({ carrosselId: c.linha.id, numero: p.numero, descricao: p.descricao.trim() });
  return r.ok ? { ok: true, reservaId: r.id, hoje: r.hoje } : { ok: false, recusa: { motivo: r.motivo }, hoje: r.hoje };
}

/**
 * GERAR A IMAGEM DE UMA RESERVA, no `after()`. A OpenAI, o guardar e a marca da linha entram por
 * parâmetro só para o teste: em produção são os de verdade.
 */
export async function gerarImagem(p: {
  reservaId: string;
  id: string;
  numero: number;
  descricao: string;
  contas: ContaDoCabecalho[];
  gerar?: GerarNaOpenAI;
  guardar?: typeof guardarImagem;
  marcarPronta?: typeof marcarProntaNoBanco;
}): Promise<{ ok: true; caminho: string } | { ok: false; motivo: string }> {
  const gerar = p.gerar ?? ((descricao: string) => gerarNaOpenAI(descricao));
  const guardar = p.guardar ?? guardarImagem;
  const marcarPronta = p.marcarPronta ?? marcarProntaNoBanco;
  let subido: string | null = null;
  const falhar = async (motivo: string) => {
    if (subido) await apagarSemDerrubar([subido]);
    try {
      await marcarFalhou(p.reservaId, motivo);
    } catch {
      // Sem a marca, a linha `gerando` vence pelo prazo, aparece como falha e conta no teto.
    }
    return { ok: false as const, motivo };
  };

  let caminho: string;
  try {
    const r = await gerar(p.descricao);
    if (!r.ok) return falhar(r.erro);
    const problema = problemaDaImagemGerada(r.bytes);
    const medidas = medidasDoJpeg(r.bytes);
    if (problema || !medidas) return falhar(textoDoProblemaDaImagem(problema ?? "formato"));
    const arquivo = { nome: "imagem-gerada.jpg", mime: "image/jpeg", bytes: r.bytes.length, largura: medidas.largura, altura: medidas.altura };
    const assinado = await assinarImagem({ id: p.id, numero: p.numero, destino: "foto", arquivo, contas: p.contas });
    if (!assinado.ok) return falhar(textoDaRecusaDaPublicacaoDoCarrossel(assinado.recusa));
    // A cópia dos bytes dá ao `fetch` o tipo que ele aceita como corpo (`Uint8Array<ArrayBuffer>`).
    const subida = await fetch(assinado.url, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: new Uint8Array(r.bytes) });
    if (!subida.ok) return falhar(TEXTO_IMAGEM_NAO_SUBIU);
    subido = assinado.caminho;
    const guardado = await guardar({ id: p.id, numero: p.numero, caminho: assinado.caminho, contas: p.contas });
    if (!guardado.ok) return falhar(textoDaRecusaDaPublicacaoDoCarrossel(guardado.recusa));
    caminho = assinado.caminho;
  } catch {
    return falhar(TEXTO_IMAGEM_FALHOU_SEM_MOTIVO);
  }

  // DEPOIS DO GUARDAR, O ARQUIVO É A FOTO DO SLIDE (achado 89): a falha ao marcar a linha não o apaga.
  try {
    await marcarPronta(p.reservaId, caminho);
  } catch {
    // A linha `gerando` vence pelo prazo, aparece como falha e conta no teto; a foto fica no slide.
  }
  return { ok: true, caminho };
}
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx eslint lib/bonus/imagem-textos.ts lib/bonus/publicar-processo.ts lib/bonus/imagem-processo.ts tests/bonus-imagem-textos.test.ts testes-integracao/bonus-imagem-processo.integracao.ts
npx vitest run tests/bonus-imagem-textos.test.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-imagem-processo.integracao.ts testes-integracao/bonus-publicar-processo.integracao.ts
```

Esperado: `tsc` e lint limpos; os 6 puros passam; `[rede-global] ALVO: banco de TESTE`, e os 64
passam (18 e 46).

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/imagem-textos.ts lib/bonus/publicar-processo.ts lib/bonus/imagem-processo.ts tests/bonus-imagem-textos.test.ts testes-integracao/bonus-imagem-processo.integracao.ts
test "$(git branch --show-current)" = "criador-de-imagem"
git add lib/bonus/imagem-textos.ts lib/bonus/publicar-processo.ts lib/bonus/imagem-processo.ts tests/bonus-imagem-textos.test.ts testes-integracao/bonus-imagem-processo.integracao.ts
git commit -m "feat(bonus): pedir e gerar a imagem, guardada como a foto do slide"
```

---

### FASE 6.6 — A action que pede a imagem e a consulta que acompanha

**Arquivos:**
- Criar: `lib/bonus/imagem-consulta.ts` (`server-only`), `app/bonus/imagem-actions.ts`
  (`"use server"`), `app/bonus/[id]/carrossel/[cid]/imagem/route.ts`,
  `app/carrosseis/[cid]/imagem/route.ts`
- Modificar: `lib/bonus/imagem-regras.ts` (o endereço da consulta), `lib/bonus/imagem-textos.ts` (o
  tipo da resposta do pedido)
- Testar: `tests/bonus-imagem-paginas.test.ts` (novo), `testes-integracao/bonus-imagem-processo.integracao.ts`
  (os casos da consulta)

**Interfaces:**
- Consome: `pedirImagem` e `gerarImagem` (FASE 6.5); `ultimasDoCarrossel`, `imagensNasUltimas24h` e
  `estadoDaImagem` (FASE 6.4); `conferirPedidoDaArte` e `versoesDosSlides` (`lib/bonus/arte-tela.ts`,
  os mesmos da rota da arte); `after` de `next/server`.
- Produz: `urlDaConsultaDaImagem(caminho: string, numero: number): string`
  (`${caminho}/imagem?slide=${numero}`); `type AvisoDoPedidoDeImagem = Aviso & { em: number; hoje?:
  number }`; `type ConsultaDaImagem` (`nenhuma` ou `gerando` com `hoje`; `pronta` com `hoje`, `versao`
  e `versaoDaMiniatura`; `falhou` com `hoje` e `texto`), `consultarImagem(p: { linha; numero; doCookie? }):
  Promise<ConsultaDaImagem>`, `respostaDaConsulta(corpo: unknown, status = 200): Response` (com
  `Cache-Control: private, no-store`); `pedirImagemDoSlide(pedido: unknown):
  Promise<AvisoDoPedidoDeImagem>`, cuja primeira instrução é `await exigirSessao();` e que chama
  `after(() => gerarImagem(...))` sem esperar a imagem; o `GET` das duas rotas, que confere a sessão
  antes de tudo e só lê.

- [ ] **Passo 1: os testes**

Crie `tests/bonus-imagem-paginas.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { urlDaConsultaDaImagem } from "@/lib/bonus/imagem-regras";

// AS GUARDAS DO CRIADOR DE IMAGEM que nenhum tipo pega (spec da Etapa 6, "Pedir e acompanhar"). O harness
// da integração não forja sessão (de propósito): a action e a consulta se provam pelo processo, que a
// integração alcança, e por estas leituras do código.

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const ler = (rel: string) => readFileSync(`${RAIZ}/${rel}`, "utf8").replace(/\r\n/g, "\n");
const ACTIONS = "app/bonus/imagem-actions.ts";
const ROTAS = ["app/bonus/[id]/carrossel/[cid]/imagem/route.ts", "app/carrosseis/[cid]/imagem/route.ts"];
const CONSULTA = "lib/bonus/imagem-consulta.ts";

/** As funções exportadas de um arquivo e a primeira instrução de cada uma. */
function primeirasInstrucoes(fonte: string): { nome: string; primeira: string }[] {
  const achados: { nome: string; primeira: string }[] = [];
  const re = /export async function (\w+)\([^)]*\)[^{]*\{\s*([^\n;]+;)/g;
  for (const m of fonte.matchAll(re)) achados.push({ nome: m[1], primeira: m[2].trim() });
  return achados;
}

describe("a action do pedido de imagem", () => {
  it("é uma só, e começa por `await exigirSessao();`", () => {
    const achados = primeirasInstrucoes(ler(ACTIONS));
    expect(achados.map((a) => a.nome)).toEqual(["pedirImagemDoSlide"]);
    for (const a of achados) expect(a.primeira, a.nome).toBe("await exigirSessao();");
  });

  it("nenhum export escapa do leitor: num arquivo 'use server', todo export é action", () => {
    const fonte = ler(ACTIONS);
    expect(fonte.startsWith('"use server";')).toBe(true);
    expect((fonte.match(/^export /gm) ?? []).length).toBe(primeirasInstrucoes(fonte).length);
  });

  // ACHADO 88: o Next manda as actions de um cliente uma de cada vez. A action que esperasse a imagem
  // prenderia o salvar, o "Só texto" e o publicar da página inteira.
  it("não espera a imagem: a geração vai para o after()", () => {
    const fonte = ler(ACTIONS);
    expect(fonte).toContain("after(() => gerarImagem(");
    expect(fonte).not.toMatch(/await gerarImagem\(/);
  });

  it("responde como estado: o único redirect é o da sessão", () => {
    expect(ler(ACTIONS).match(/redirect\([^)]*\)/g) ?? []).toEqual(['redirect("/entrar")']);
  });

  it("não lê a conta do navegador, nem a chave da OpenAI", () => {
    const fonte = ler(ACTIONS);
    expect(fonte).not.toMatch(/\.conta\b|\["conta"\]|get\(\s*["']conta["']/);
    expect(fonte).not.toContain("OPENAI_API_KEY");
  });
});

describe.each(ROTAS)("a consulta %s", (rota) => {
  // A CONSULTA É UMA ROTA GET, E NÃO UMA ACTION (achado 88): o card pergunta a cada 2 s, e uma action
  // entraria na mesma fila do salvar e do publicar.
  it("é uma rota GET, fora da fila das actions", () => {
    const fonte = ler(rota);
    expect(fonte).not.toContain('"use server"');
    expect([...fonte.matchAll(/^export async function (\w+)/gm)].map((m) => m[1])).toEqual(["GET"]);
  });

  it("o GET confere a sessão antes de qualquer outra coisa", () => {
    const fonte = ler(rota);
    const inicio = fonte.indexOf("export async function GET(");
    const linhas = fonte
      .slice(inicio)
      .split("\n")
      .slice(1)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("//"));
    expect(inicio).toBeGreaterThan(-1);
    expect(linhas.slice(0, 2)).toEqual([
      "const jarra = await cookies();",
      "if (!isValidSession(jarra.get(SESSION_COOKIE)?.value)) return respostaDaConsulta({ erro: TEXTO_ARTE_SEM_SESSAO }, 401);",
    ]);
  });

  it("confere o pedido pela origem da rota, e responde pela consulta comum", () => {
    const fonte = ler(rota);
    expect(fonte).toContain("conferirPedidoDaArte(");
    expect(fonte).toContain("consultarImagem(");
  });
});

describe("a consulta comum", () => {
  it("nunca fica em cache: o estado muda a cada geração", () => {
    expect(ler(CONSULTA)).toContain('"Cache-Control": "private, no-store"');
  });

  it("a URL fica ao lado da arte, no caminho do carrossel", () => {
    expect(urlDaConsultaDaImagem("/carrosseis/c1", 2)).toBe("/carrosseis/c1/imagem?slide=2");
    expect(urlDaConsultaDaImagem("/bonus/b1/carrossel/c1", 3)).toBe("/bonus/b1/carrossel/c1/imagem?slide=3");
  });
});
```

Em `testes-integracao/bonus-imagem-processo.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/bonus-imagem-processo.integracao.ts b/testes-integracao/bonus-imagem-processo.integracao.ts
index ee9d801..d65faca 100644
--- a/testes-integracao/bonus-imagem-processo.integracao.ts
+++ b/testes-integracao/bonus-imagem-processo.integracao.ts
@@ -17,6 +17,9 @@ type ModuloPublicar = typeof import("@/lib/bonus/publicar-processo");
 type ModuloRegras = typeof import("@/lib/bonus/publicar-regras");
 type ModuloSlides = typeof import("@/lib/bonus/arte-slides");
 type ModuloTextos = typeof import("@/lib/bonus/imagem-textos");
+type ModuloConsulta = typeof import("@/lib/bonus/imagem-consulta");
+type ModuloCarrossel = typeof import("@/lib/bonus/carrossel-repositorio");
+type ModuloTela = typeof import("@/lib/bonus/arte-tela");
 type ContaDoCabecalho = import("@/lib/bonus/arte-conta").ContaDoCabecalho;
 
 const banco = bancoDescartavel();
@@ -59,6 +62,9 @@ let publicar: ModuloPublicar;
 let regras: ModuloRegras;
 let slides: ModuloSlides;
 let textos: ModuloTextos;
+let consulta: ModuloConsulta;
+let carrosselRepo: ModuloCarrossel;
+let tela: ModuloTela;
 let contas: ContaDoCabecalho[];
 
 beforeAll(async () => {
@@ -119,6 +125,9 @@ beforeAll(async () => {
   regras = await import("@/lib/bonus/publicar-regras");
   slides = await import("@/lib/bonus/arte-slides");
   textos = await import("@/lib/bonus/imagem-textos");
+  consulta = await import("@/lib/bonus/imagem-consulta");
+  carrosselRepo = await import("@/lib/bonus/carrossel-repositorio");
+  tela = await import("@/lib/bonus/arte-tela");
   await banco.db().upsertAccount({
     ig_user_id: CONTA,
     username: "thiagovannuchi",
@@ -390,3 +399,50 @@ describe("gerar a imagem", () => {
     expect((await linhas())[0]).toMatchObject({ estado: "falhou", motivo: textos.TEXTO_IMAGEM_FALHOU_SEM_MOTIVO });
   });
 });
+
+// A CONSULTA DE UM SLIDE (spec da Etapa 6, "O acompanhar"): o que a rota GET devolve ao card, que pergunta
+// a cada 2 s enquanto a imagem gera. A rota só confere a sessão e o carrossel e chama esta consulta.
+describe("a consulta de um slide", () => {
+  const consultar = async (id: string, numero = 2) => {
+    const linha = await carrosselRepo.lerCarrossel(id);
+    if (!linha) throw new Error("o carrossel devia existir");
+    return consulta.consultarImagem({ linha, numero });
+  };
+
+  it("sem pedido, nenhuma, com a conta do dia", async () => {
+    const id = await carrossel();
+    expect(await consultar(id)).toEqual({ estado: "nenhuma", hoje: 0 });
+  });
+
+  it("gerando, enquanto a geração não termina; o outro slide segue sem pedido", async () => {
+    const id = await carrossel();
+    await reservado(id);
+    expect(await consultar(id)).toEqual({ estado: "gerando", hoje: 1 });
+    expect(await consultar(id, 3)).toEqual({ estado: "nenhuma", hoje: 1 });
+  });
+
+  it("pronta, com a versão nova da miniatura, a mesma que a página desenharia", async () => {
+    const id = await carrossel();
+    const r = await imagem.gerarImagem({ reservaId: await reservado(id), id, numero: 2, descricao: CENA, contas, gerar: openaiQueGera });
+    if (!r.ok) throw new Error(`a geração devia passar: ${r.motivo}`);
+    const conta = contas.find((c) => c.ig_user_id === CONTA) ?? null;
+    const comFoto = tela.versoesDosSlides(slides.slidesDoTexto(TEXTO), [1, 5], tela.cabecalhoParaVersao(conta), { 2: r.caminho })[1];
+    const semFoto = tela.versoesDosSlides(slides.slidesDoTexto(TEXTO), [1, 5], tela.cabecalhoParaVersao(conta), {})[1];
+    expect(comFoto).not.toBe(semFoto);
+    expect(await consultar(id)).toEqual({ estado: "pronta", hoje: 1, versao: expect.any(String), versaoDaMiniatura: comFoto });
+  });
+
+  it("falhou, com o motivo da linha", async () => {
+    const id = await carrossel();
+    const erro = "A OpenAI recusou o pedido.";
+    await imagem.gerarImagem({ reservaId: await reservado(id), id, numero: 2, descricao: CENA, contas, gerar: async () => ({ ok: false, erro }) });
+    expect(await consultar(id)).toEqual({ estado: "falhou", hoje: 1, texto: erro });
+  });
+
+  it("a linha travada pelo prazo vira falha, com a frase da travada", async () => {
+    const id = await carrossel();
+    await reservado(id);
+    await banco.db().sql().query(`update imagens_geradas set criado_em = now() - interval '4 minutes'`);
+    expect(await consultar(id)).toEqual({ estado: "falhou", hoje: 1, texto: textos.TEXTO_IMAGEM_TRAVADA });
+  });
+});
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-imagem-paginas.test.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-imagem-processo.integracao.ts
```

Esperado: nos puros, os 13 caem: a action e as rotas não existem. Na integração, `[rede-global] ALVO:
banco de TESTE`, e o arquivo cai com os 23 pulados: a consulta não existe.

- [ ] **Passo 3: o código**

Em `lib/bonus/imagem-regras.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/imagem-regras.ts b/lib/bonus/imagem-regras.ts
index 3a6d587..1f5252c 100644
--- a/lib/bonus/imagem-regras.ts
+++ b/lib/bonus/imagem-regras.ts
@@ -66,6 +66,15 @@ export function estadoDaImagem(
   return agora.getTime() - linha.criado_em.getTime() >= TRAVADA_IMAGEM_MS ? { tipo: "travada" } : { tipo: "gerando" };
 }
 
+/**
+ * O ENDEREÇO DA CONSULTA de um slide: ao lado da rota da arte, no caminho do carrossel
+ * (`caminhoDoCarrossel`), uma rota GET que só lê. O card pergunta por ela, e não por uma action, porque
+ * uma action entraria na fila das outras da página (achado 88).
+ */
+export function urlDaConsultaDaImagem(caminho: string, numero: number): string {
+  return `${caminho}/imagem?slide=${numero}`;
+}
+
 /** O que impede guardar a imagem gerada: não é JPEG, ou não passa na regra da foto do espaço. */
 export type ProblemaDaImagem = "formato" | ProblemaDaFoto;
 
```

Em `lib/bonus/imagem-textos.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/imagem-textos.ts b/lib/bonus/imagem-textos.ts
index 1c86f5a..9286f98 100644
--- a/lib/bonus/imagem-textos.ts
+++ b/lib/bonus/imagem-textos.ts
@@ -1,3 +1,4 @@
+import type { Aviso } from "@/lib/avisos";
 import { TETO_IMAGEM_DIARIO, type ProblemaDaImagem } from "./imagem-regras";
 import { textoDaRecusaDaPublicacaoDoCarrossel, type RecusaDaPublicacaoDoCarrossel } from "./publicar-textos";
 
@@ -37,6 +38,12 @@ export function textoDaRecusaDaImagem(r: RecusaDaImagem): string {
   }
 }
 
+/**
+ * A resposta do pedido de imagem, como ESTADO (achado 52): a frase (o "Gerando…" ou a recusa) e a conta
+ * do dia, quando o pedido chegou ao teto.
+ */
+export type AvisoDoPedidoDeImagem = Aviso & { em: number; hoje?: number };
+
 /** "Hoje: 3 de 10 imagens." A conta das últimas 24 horas, que a tela mostra junto do campo. */
 export function textoDoContador(hoje: number): string {
   return `Hoje: ${Math.min(hoje, TETO_IMAGEM_DIARIO)} de ${TETO_IMAGEM_DIARIO} imagens.`;
```

Crie `lib/bonus/imagem-consulta.ts`:

```ts
import "server-only";
import { resolverConta } from "./arte-conta";
import { escolhasDaArte } from "./arte-escolhas";
import { slidesDoTexto } from "./arte-slides";
import { cabecalhoParaVersao, versoesDosSlides } from "./arte-tela";
import type { LinhaDoCarrossel } from "./carrossel-linha";
import { contasParaArte } from "./carrossel-repositorio";
import { textoDaLinhaDoCarrossel } from "./carrossel-tela";
import { imagensNasUltimas24h, ultimasDoCarrossel } from "./imagem-repositorio";
import { estadoDaImagem } from "./imagem-regras";
import { TEXTO_IMAGEM_TRAVADA } from "./imagem-textos";
import { fotosDaArte, imagensDaArte } from "./publicar-regras";

// A CONSULTA DE UM SLIDE (spec da Etapa 6, "O acompanhar"), comum às duas rotas GET
// (app/bonus/[id]/carrossel/[cid]/imagem e app/carrosseis/[cid]/imagem), que só conferem a sessão e o
// carrossel e chamam daqui. O card pergunta a cada 2 s enquanto a imagem gera. SÓ LÊ.
//
// Pronta, a resposta traz a versão nova da miniatura, a mesma que a página desenharia ao recarregar
// (`versoesDosSlides`, com a foto do slide), e a versão do texto guardada com a imagem. A travada pelo
// prazo vira falha, com a frase dela.

export type ConsultaDaImagem =
  | { estado: "nenhuma" | "gerando"; hoje: number }
  | { estado: "pronta"; hoje: number; versao: string | null; versaoDaMiniatura: string }
  | { estado: "falhou"; hoje: number; texto: string };

export async function consultarImagem(p: { linha: LinhaDoCarrossel; numero: number; doCookie?: string }): Promise<ConsultaDaImagem> {
  const [{ agora, linhas }, hoje] = await Promise.all([ultimasDoCarrossel(p.linha.id), imagensNasUltimas24h()]);
  const estado = estadoDaImagem(linhas[p.numero] ?? null, agora);
  if (estado.tipo === "falhou") return { estado: "falhou", hoje, texto: estado.motivo };
  if (estado.tipo === "travada") return { estado: "falhou", hoje, texto: TEXTO_IMAGEM_TRAVADA };
  const texto = textoDaLinhaDoCarrossel(p.linha);
  if (estado.tipo !== "pronta" || !texto) return { estado: estado.tipo === "gerando" ? "gerando" : "nenhuma", hoje };
  const total = p.linha.total_slides;
  const escolhas = escolhasDaArte(p.linha.arte, total);
  const { conta } = resolverConta(await contasParaArte(), escolhas, p.doCookie);
  const versoes = versoesDosSlides(slidesDoTexto(texto), escolhas.soTexto, cabecalhoParaVersao(conta), fotosDaArte(p.linha.arte, total));
  return {
    estado: "pronta",
    hoje,
    versao: imagensDaArte(p.linha.arte, total)[p.numero]?.versao ?? null,
    versaoDaMiniatura: versoes[p.numero - 1],
  };
}

/** A resposta da rota, em JSON e nunca em cache: o estado muda a cada geração. */
export function respostaDaConsulta(corpo: unknown, status = 200): Response {
  return Response.json(corpo, { status, headers: { "Cache-Control": "private, no-store" } });
}
```

Crie `app/bonus/imagem-actions.ts`:

```ts
"use server";
import { after } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isValidSession, SESSION_COOKIE } from "@/lib/auth";
import { contasParaArte } from "@/lib/bonus/carrossel-repositorio";
import { gerarImagem, pedirImagem } from "@/lib/bonus/imagem-processo";
import { TEXTO_GERANDO_A_IMAGEM, textoDaRecusaDaImagem, type AvisoDoPedidoDeImagem } from "@/lib/bonus/imagem-textos";
import { ehIdDeBonus } from "@/lib/bonus/pedido";
import { TEXTO_PEDIDO_INVALIDO } from "@/lib/bonus/publicar-textos";

// A ACTION DO CRIADOR DE IMAGEM (spec da Etapa 6, "Pedir e acompanhar").
//
// TODA ACTION COMEÇA CONFERINDO A SESSÃO, e não confia só no proxy.ts: Server Action tem endereço
// próprio. tests/bonus-imagem-paginas.test.ts confere que a primeira instrução é `await exigirSessao();`.
//
// ELA NÃO ESPERA A IMAGEM (achado 88): o Next manda as actions de um cliente uma de cada vez, e esperar
// ~30 s prenderia o salvar, o "Só texto" e o publicar da página inteira. O pedido confere, reserva e
// responde na hora; a geração roda no `after()`, dentro do `maxDuration` da página, e o card acompanha
// pela rota GET da consulta. A resposta volta como estado, e nunca por redirect (achado 52).

async function exigirSessao(): Promise<void> {
  const jarra = await cookies();
  if (!isValidSession(jarra.get(SESSION_COOKIE)?.value)) redirect("/entrar");
}

const registro = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const inteiro = (v: unknown): number => (typeof v === "number" && Number.isInteger(v) ? v : 0);

/** PEDIR A IMAGEM DO ESPAÇO DE UM SLIDE, com a descrição da cena. A CONTA NUNCA VEM DO NAVEGADOR. */
export async function pedirImagemDoSlide(pedido: unknown): Promise<AvisoDoPedidoDeImagem> {
  await exigirSessao();
  const p = registro(pedido);
  const em = Date.now();
  if (!ehIdDeBonus(p.id) || typeof p.descricao !== "string") return { tom: "erro", texto: TEXTO_PEDIDO_INVALIDO, em };
  const id = p.id;
  const numero = inteiro(p.numero);
  const descricao = p.descricao;
  const contas = await contasParaArte();
  const r = await pedirImagem({ id, numero, descricao, contas });
  if (!r.ok) return { tom: "erro", texto: textoDaRecusaDaImagem(r.recusa), em, ...(r.hoje === undefined ? {} : { hoje: r.hoje }) };
  const { reservaId } = r;
  after(() => gerarImagem({ reservaId, id, numero, descricao, contas }));
  return { tom: "ok", texto: TEXTO_GERANDO_A_IMAGEM, em, hoje: r.hoje };
}
```

Crie `app/bonus/[id]/carrossel/[cid]/imagem/route.ts`:

```ts
import { cookies } from "next/headers";
import { ACCOUNT_COOKIE } from "@/lib/account";
import { isValidSession, SESSION_COOKIE } from "@/lib/auth";
import { conferirPedidoDaArte } from "@/lib/bonus/arte-tela";
import { TEXTO_ARTE_NAO_ENCONTRADA, TEXTO_ARTE_SEM_SESSAO } from "@/lib/bonus/arte-textos";
import { lerCarrossel } from "@/lib/bonus/carrossel-repositorio";
import { consultarImagem, respostaDaConsulta } from "@/lib/bonus/imagem-consulta";
import { ehIdDeBonus } from "@/lib/bonus/pedido";

// A CONSULTA DA IMAGEM DE UM SLIDE DO CARROSSEL DE BÔNUS (spec da Etapa 6, "O acompanhar"), em JSON: o
// card pergunta a cada 2 s enquanto a imagem gera. É uma rota GET, e não uma action, para nunca entrar na
// fila das actions da página (achado 88). SÓ LÊ.
//
// A SESSÃO É CONFERIDA AQUI, como na rota da arte ao lado, e não só no proxy.ts. Sem sessão, 401.
// tests/bonus-imagem-paginas.test.ts confere que isto é a primeira coisa do GET.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; cid: string }> }) {
  const jarra = await cookies();
  if (!isValidSession(jarra.get(SESSION_COOKIE)?.value)) return respostaDaConsulta({ erro: TEXTO_ARTE_SEM_SESSAO }, 401);
  const { id, cid } = await params;
  if (!ehIdDeBonus(id) || !ehIdDeBonus(cid)) return respostaDaConsulta({ erro: TEXTO_ARTE_NAO_ENCONTRADA }, 404);
  // O dono, o "pronto" e o slide, pela mesma conferência da rota da arte.
  const conferido = conferirPedidoDaArte(await lerCarrossel(cid), { tipo: "bonus", bonusId: id }, new URL(request.url).searchParams.get("slide"));
  if (!conferido.ok) return respostaDaConsulta({ erro: conferido.texto }, conferido.status);
  return respostaDaConsulta(await consultarImagem({ linha: conferido.linha, numero: conferido.numero, doCookie: jarra.get(ACCOUNT_COOKIE)?.value }));
}
```

Crie `app/carrosseis/[cid]/imagem/route.ts`:

```ts
import { cookies } from "next/headers";
import { ACCOUNT_COOKIE } from "@/lib/account";
import { isValidSession, SESSION_COOKIE } from "@/lib/auth";
import { conferirPedidoDaArte } from "@/lib/bonus/arte-tela";
import { TEXTO_ARTE_NAO_ENCONTRADA, TEXTO_ARTE_SEM_SESSAO } from "@/lib/bonus/arte-textos";
import { lerCarrossel } from "@/lib/bonus/carrossel-repositorio";
import { consultarImagem, respostaDaConsulta } from "@/lib/bonus/imagem-consulta";
import { ehIdDeBonus } from "@/lib/bonus/pedido";

// A CONSULTA DA IMAGEM DE UM SLIDE DO CARROSSEL AVULSO (spec da Etapa 6, "O acompanhar"): a mesma da rota
// do carrossel de bônus (lib/bonus/imagem-consulta.ts), com a mesma sessão conferida antes de tudo. Esta
// rota só serve o avulso: o carrossel de bônus dá 404 aqui (carrossel-caminho.ts, `ehDaRota`). SÓ LÊ.
//
// É uma rota GET, e não uma action, para nunca entrar na fila das actions da página (achado 88).
// tests/bonus-imagem-paginas.test.ts confere que a sessão é a primeira coisa do GET.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ cid: string }> }) {
  const jarra = await cookies();
  if (!isValidSession(jarra.get(SESSION_COOKIE)?.value)) return respostaDaConsulta({ erro: TEXTO_ARTE_SEM_SESSAO }, 401);
  const { cid } = await params;
  if (!ehIdDeBonus(cid)) return respostaDaConsulta({ erro: TEXTO_ARTE_NAO_ENCONTRADA }, 404);
  const conferido = conferirPedidoDaArte(await lerCarrossel(cid), { tipo: "avulso" }, new URL(request.url).searchParams.get("slide"));
  if (!conferido.ok) return respostaDaConsulta({ erro: conferido.texto }, conferido.status);
  return respostaDaConsulta(await consultarImagem({ linha: conferido.linha, numero: conferido.numero, doCookie: jarra.get(ACCOUNT_COOKIE)?.value }));
}
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx eslint lib/bonus/imagem-regras.ts lib/bonus/imagem-textos.ts lib/bonus/imagem-consulta.ts app/bonus/imagem-actions.ts "app/bonus/[id]/carrossel/[cid]/imagem/route.ts" "app/carrosseis/[cid]/imagem/route.ts" tests/bonus-imagem-paginas.test.ts testes-integracao/bonus-imagem-processo.integracao.ts
npx vitest run tests/bonus-imagem-paginas.test.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-imagem-processo.integracao.ts
```

Esperado: `tsc` e lint limpos; os 13 puros passam; `[rede-global] ALVO: banco de TESTE`, e os 23
passam.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/imagem-regras.ts lib/bonus/imagem-textos.ts lib/bonus/imagem-consulta.ts app/bonus/imagem-actions.ts "app/bonus/[id]/carrossel/[cid]/imagem/route.ts" "app/carrosseis/[cid]/imagem/route.ts" tests/bonus-imagem-paginas.test.ts testes-integracao/bonus-imagem-processo.integracao.ts
test "$(git branch --show-current)" = "criador-de-imagem"
git add lib/bonus/imagem-regras.ts lib/bonus/imagem-textos.ts lib/bonus/imagem-consulta.ts app/bonus/imagem-actions.ts "app/bonus/[id]/carrossel/[cid]/imagem/route.ts" "app/carrosseis/[cid]/imagem/route.ts" tests/bonus-imagem-paginas.test.ts testes-integracao/bonus-imagem-processo.integracao.ts
git commit -m "feat(bonus): a action que pede a imagem e a consulta que acompanha"
```

---

### FASE 6.7 — O "Gerar imagem" no card de cada slide, com o acompanhar

**Arquivos:**
- Criar: `app/bonus/[id]/carrossel/[cid]/gerar-imagem.tsx` (`"use client"`)
- Modificar: `app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx` (o botão na linha da imagem, e os
  outros desligados enquanto gera), `editor-do-carrossel.tsx` (a conta do dia comum aos cards, e a prop
  `intervaloDaConsultaMs`), `publicacao-na-tela.ts` (o tipo `ImagemGeradaNaTela`), `revisao.tsx` (o que
  a página lê de `imagens_geradas`); `lib/bonus/imagem-textos.ts` (o aviso da descrição que pede texto)
- Testar: `testes-dom/bonus-gerar-imagem.dom.tsx` (novo), `tests/bonus-imagem-paginas.test.ts` (o caso
  da revisão)

**Interfaces:**
- Consome: `urlDaConsultaDaImagem` e `ConsultaDaImagem` (FASE 6.6), `pedirImagemDoSlide` (FASE 6.6),
  `ESTILOS` e `pedeTextoNaImagem` (FASE 6.2), `textoDoContador` e `textoDaRecusaDaImagem` (FASE 6.5),
  `ultimasDoCarrossel`, `imagensNasUltimas24h` e `estadoDaImagem` (FASE 6.4).
- Produz: `textoDoPedidoDeTexto(termo: string): string`; `type ImagemGeradaNaTela = { acaoDoPedido;
  hoje: number; descricoes: Record<number, string>; gerando: number[] }` e o campo opcional
  `imagemGerada?` em `PublicacaoNaTela`; `type GeradorDoSlide` e o componente
  `GerarImagem({ caminho, carrosselId, numero, gerador, aoMudarGerando })`; a prop opcional
  `gerarImagem?: GeradorDoSlide | null` no `CardDaParte`; a prop opcional `intervaloDaConsultaMs?: number` no
  editor (item 4 do ensaio).

- [ ] **Passo 1: os testes**

Crie `testes-dom/bonus-gerar-imagem.dom.tsx`:

```tsx
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EditorDoCarrossel from "@/app/bonus/[id]/carrossel/[cid]/editor-do-carrossel";
import type { ImagemGeradaNaTela, PublicacaoNaTela } from "@/app/bonus/[id]/carrossel/[cid]/publicacao-na-tela";
import { urlDaArte } from "@/lib/bonus/arte-tela";
import { camposDoFormulario } from "@/lib/bonus/carrossel-texto";
import type { ConsultaDaImagem } from "@/lib/bonus/imagem-consulta";
import { urlDaConsultaDaImagem } from "@/lib/bonus/imagem-regras";
import {
  TEXTO_GERANDO_A_IMAGEM,
  TEXTO_IMAGEM_GERADA,
  textoDaRecusaDaImagem,
  textoDoContador,
  type AvisoDoPedidoDeImagem,
} from "@/lib/bonus/imagem-textos";
import { ESTILOS } from "@/lib/bonus/prompt-ilustracao";

// O CRIADOR DE IMAGEM NA TELA (spec da Etapa 6, "A tela" e "Pedir e acompanhar"): o botão em cada slide com
// espaço, o campo com os atalhos do Labs, o aviso de texto, o contador do dia, o pedido que volta na hora,
// e a consulta que acompanha até a imagem entrar no espaço. A action e a consulta são falsas: nada sai para
// a rede, e nada chama a OpenAI.

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const BONUS = "0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f";
const CARROSSEL = "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d";
const CAMINHO = `/bonus/${BONUS}/carrossel/${CARROSSEL}`;
const VALORES = {
  gancho: "Seu cliente sumiu? Não é culpa dele.",
  slide_1_titulo: "O que fazer primeiro",
  slide_1_texto: "Mande uma mensagem curta, lembrando do que ele comprou.",
  chamada: "Comente SUMIDO e receba as mensagens prontas.",
  legenda: "Quem sumiu ainda pode voltar. Comente SUMIDO que eu te mando as mensagens prontas.",
};
const CENA = "/marketing uma pessoa usando o celular numa loja de roupas";

/** As respostas da consulta, em ordem; a última se repete. */
let consultas: ConsultaDaImagem[];
let urls: string[];

beforeEach(() => {
  consultas = [];
  urls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      urls.push(String(url));
      const c = consultas.length > 1 ? consultas.shift() : (consultas[0] ?? { estado: "gerando", hoje: 4 });
      return new Response(JSON.stringify(c), { status: 200 });
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderizar(p: { gerada?: Partial<ImagemGeradaNaTela>; respostas?: AvisoDoPedidoDeImagem[]; soTexto?: number[]; travado?: string | null } = {}) {
  const pedidos: unknown[] = [];
  const salvos: string[] = [];
  const respostas = p.respostas ?? [];
  const imagemGerada: ImagemGeradaNaTela = {
    acaoDoPedido: async (pedido: unknown) => {
      pedidos.push(pedido);
      return respostas.shift() ?? { tom: "ok", texto: TEXTO_GERANDO_A_IMAGEM, em: 1, hoje: 4 };
    },
    hoje: 3,
    descricoes: {},
    gerando: [],
    ...p.gerada,
  };
  const publicacao: PublicacaoNaTela = {
    acaoDaAssinatura: async () => ({ ok: false, texto: "não devia assinar" }),
    acaoDaImagem: async () => ({ tom: "erro", texto: "não devia guardar", em: 1 }),
    acaoDaPublicacao: async () => ({ tom: "ok", texto: "Na fila.", em: 1 }),
    imagens: {},
    versoesDoTexto: ["t1", "t2", "t3"],
    travado: p.travado ?? null,
    origem: "gravada",
    arroba: "thiagovannuchi",
    estado: { texto: null, tom: null, filaId: null, livre: true },
    avisoDoCalendario: null,
    imagemGerada,
  };
  render(
    <EditorDoCarrossel
      acaoDoSlide={async (_anterior, form) => {
        salvos.push(String(form.get("parte")));
        return { tom: "ok", texto: "Slide salvo.", em: Date.now(), versao: "c2", versaoDoTexto: "t3-novo" };
      }}
      acaoDaArte={async () => null}
      acaoDaConta={async () => null}
      caminho={CAMINHO}
      carrosselId={CARROSSEL}
      palavra="SUMIDO"
      total={3}
      campos={camposDoFormulario(3)}
      valores={VALORES}
      rotuloDaConta="Thiago Vannuchi (@thiagovannuchi)"
      avisoDaConta={null}
      podeFixar={false}
      soTextoInicial={p.soTexto ?? [1]}
      versoes={["a1", "b1", "c1"]}
      pausaMs={0}
      intervaloDaConsultaMs={5}
      publicacao={publicacao}
    />
  );
  return { pedidos, salvos };
}

const card = (n: number) => screen.getAllByRole("listitem")[n - 1];
const campo = (n: number) => screen.getByLabelText(`Slide ${n}: descreva a cena`) as HTMLTextAreaElement;
const miniatura = (n: number) => screen.getByAltText(`Slide ${n} de 3`) as HTMLImageElement;
const gerar = (n: number) => within(card(n)).getByRole("button", { name: "Gerar" }) as HTMLButtonElement;

function abrir(n: number, rotulo = "Gerar imagem") {
  fireEvent.click(within(card(n)).getByRole("button", { name: rotulo }));
}

async function pedir(n: number, descricao = CENA) {
  abrir(n);
  fireEvent.change(campo(n), { target: { value: descricao } });
  await act(async () => {
    fireEvent.click(gerar(n));
  });
}

describe("o botão Gerar imagem", () => {
  it("aparece no slide com espaço, e não no só texto", () => {
    renderizar();
    expect(within(card(1)).queryByRole("button", { name: "Gerar imagem" })).toBeNull();
    expect(within(card(2)).getByRole("button", { name: "Gerar imagem" })).toBeTruthy();
    expect(within(card(3)).getByRole("button", { name: "Gerar imagem" })).toBeTruthy();
  });

  it("não aparece com o carrossel na fila", () => {
    renderizar({ travado: "Agendado: para mudar, cancele no calendário." });
    expect(screen.queryByRole("button", { name: "Gerar imagem" })).toBeNull();
  });
});

describe("o campo da cena", () => {
  it("traz os atalhos do Labs e o contador do dia", () => {
    renderizar();
    abrir(2);
    expect(campo(2)).toBeTruthy();
    for (const e of ESTILOS) expect(within(card(2)).getByText(`/${e.chave}`)).toBeTruthy();
    expect(within(card(2)).getByText(textoDoContador(3))).toBeTruthy();
  });

  // O aviso, e não o bloqueio, decidido pelo Eduardo no Labs em 21/09: a IA de imagem escreve errado.
  it("avisa quando a descrição pede texto na imagem, sem travar o botão", () => {
    renderizar();
    abrir(2);
    fireEvent.change(campo(2), { target: { value: "uma placa com o nome da loja na entrada" } });
    expect(within(card(2)).getByText(/pede texto na imagem/)).toBeTruthy();
    expect(gerar(2).disabled).toBe(false);
    fireEvent.change(campo(2), { target: { value: "uma loja de roupas cheia de gente" } });
    expect(within(card(2)).queryByText(/pede texto na imagem/)).toBeNull();
  });

  it("no teto do dia, o Gerar trava com a frase do teto", () => {
    renderizar({ gerada: { hoje: 10 } });
    abrir(2);
    expect(gerar(2).disabled).toBe(true);
    expect(within(card(2)).getByText(textoDaRecusaDaImagem({ motivo: "teto" }))).toBeTruthy();
  });

  it("o Gerar de novo volta com a última descrição do slide", () => {
    renderizar({ gerada: { descricoes: { 2: "a primeira descrição da cena" } } });
    abrir(2, "Gerar de novo");
    expect(campo(2).value).toBe("a primeira descrição da cena");
  });
});

describe("pedir e acompanhar", () => {
  it("o pedido volta na hora, e a consulta põe a imagem no espaço com a miniatura nova", async () => {
    consultas = [
      { estado: "gerando", hoje: 4 },
      { estado: "pronta", hoje: 4, versao: "t2", versaoDaMiniatura: "b9" },
    ];
    const { pedidos } = renderizar();
    await pedir(2);
    expect(pedidos).toEqual([{ id: CARROSSEL, numero: 2, descricao: CENA }]);
    expect(within(card(2)).getByText(TEXTO_GERANDO_A_IMAGEM)).toBeTruthy();
    await waitFor(() => expect(miniatura(2).getAttribute("src")).toBe(urlDaArte(CAMINHO, 2, "b9")));
    expect(urls[0]).toBe(urlDaConsultaDaImagem(CAMINHO, 2));
    expect(within(card(2)).getByText(TEXTO_IMAGEM_GERADA)).toBeTruthy();
    expect(within(card(2)).getByText("Trocar foto")).toBeTruthy();
    expect(within(card(2)).getByText(textoDoContador(4))).toBeTruthy();
  });

  // ACHADO 88: enquanto a imagem gera, o resto da página funciona. O pedido já voltou, e a consulta é uma
  // rota GET; nada prende o salvar de outro slide.
  it("outra action sai enquanto a imagem gera", async () => {
    const { salvos } = renderizar();
    await pedir(3);
    fireEvent.click(within(card(2)).getByRole("button", { name: "Editar" }));
    fireEvent.input(screen.getByLabelText("Slide 2: texto"), { target: { value: "Um texto novo para o slide dois, enquanto o três gera." } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Salvar slide 2" }));
    });
    expect(salvos).toEqual(["slide_2"]);
    expect(within(card(3)).getByText(TEXTO_GERANDO_A_IMAGEM)).toBeTruthy();
  });

  it("enquanto gera, os outros botões da imagem daquele slide ficam desligados", async () => {
    renderizar();
    await pedir(2);
    expect((screen.getByLabelText("Slide 2: foto para o espaço da arte") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText("Slide 2: slide pronto do Canva") as HTMLInputElement).disabled).toBe(true);
    expect(gerar(2).disabled).toBe(true);
  });

  it("a página que abre com a geração em andamento começa o card em Gerando…, e acompanha", async () => {
    consultas = [{ estado: "pronta", hoje: 3, versao: "t2", versaoDaMiniatura: "b7" }];
    renderizar({ gerada: { gerando: [2], descricoes: { 2: CENA } } });
    expect(within(card(2)).getByText(TEXTO_GERANDO_A_IMAGEM)).toBeTruthy();
    await waitFor(() => expect(miniatura(2).getAttribute("src")).toBe(urlDaArte(CAMINHO, 2, "b7")));
  });

  it("a recusa do pedido aparece com a frase, e nada é consultado", async () => {
    renderizar({ respostas: [{ tom: "erro", texto: "Descreva com um pouco mais de detalhe.", em: 2 }] });
    await pedir(2, "uma loja de roupas cheia de gente");
    expect(within(card(2)).getByText("Descreva com um pouco mais de detalhe.")).toBeTruthy();
    expect(urls).toEqual([]);
  });

  it("a falha da geração aparece com a frase, e o Gerar volta", async () => {
    consultas = [{ estado: "falhou", hoje: 4, texto: "A OpenAI recusou o pedido." }];
    renderizar();
    await pedir(2);
    await waitFor(() => expect(within(card(2)).getByText("A OpenAI recusou o pedido.")).toBeTruthy());
    expect(gerar(2).disabled).toBe(false);
  });
});
```

Em `tests/bonus-imagem-paginas.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-imagem-paginas.test.ts b/tests/bonus-imagem-paginas.test.ts
index 500d112..2b8db14 100644
--- a/tests/bonus-imagem-paginas.test.ts
+++ b/tests/bonus-imagem-paginas.test.ts
@@ -95,3 +95,14 @@ describe("a consulta comum", () => {
     expect(urlDaConsultaDaImagem("/bonus/b1/carrossel/c1", 3)).toBe("/bonus/b1/carrossel/c1/imagem?slide=3");
   });
 });
+
+// A PÁGINA ENTREGA O CRIADOR DE IMAGEM AO EDITOR (desde a Etapa 7, a parte de dentro da página é a revisão,
+// comum às duas rotas do carrossel): a action do pedido e o que a tabela 018 diz de cada slide.
+describe("a página do carrossel entrega o criador de imagem ao editor", () => {
+  it("a action do pedido, a conta do dia e o que está gerando, pelo relógio do banco", () => {
+    const fonte = ler("app/bonus/[id]/carrossel/[cid]/revisao.tsx");
+    expect(fonte).toContain("acaoDoPedido: pedirImagemDoSlide,");
+    expect(fonte).toContain("ultimasDoCarrossel(carrossel.id)");
+    expect(fonte).toContain('estadoDaImagem(l, agora).tipo === "gerando"');
+  });
+});
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run --config vitest.dom.config.ts testes-dom/bonus-gerar-imagem.dom.tsx
npx vitest run tests/bonus-imagem-paginas.test.ts
```

Esperado: na tela, 11 caem e 1 passa (12): não há botão nenhum. O que passa é "não aparece com o
carrossel na fila", de propósito (item 6 do ensaio). Nos puros, 1 cai e 13 passam (14): a revisão não
lê `imagens_geradas`. O `tsc` acusa as props que ainda não existem.

- [ ] **Passo 3: o código**

Em `lib/bonus/imagem-textos.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/imagem-textos.ts b/lib/bonus/imagem-textos.ts
index 9286f98..fd2d323 100644
--- a/lib/bonus/imagem-textos.ts
+++ b/lib/bonus/imagem-textos.ts
@@ -62,6 +62,15 @@ export const TEXTO_OPENAI_DEMOROU = "A OpenAI demorou demais para responder. Ten
 export const TEXTO_SEM_REDE_DA_OPENAI = "Não consegui falar com a OpenAI. Tente de novo em instantes.";
 export const TEXTO_OPENAI_SEM_IMAGEM = "A OpenAI respondeu sem a imagem. Tente de novo; se repetir, avise quem cuida do Chat.";
 
+/**
+ * O AVISO DA DESCRIÇÃO QUE PEDE TEXTO NA IMAGEM (`pedeTextoNaImagem`, do Labs): é aviso, e não bloqueio,
+ * como o Eduardo decidiu lá em 21/09. Ele diz a consequência, e não o mecanismo: a IA de imagem escreve
+ * errado, e o texto do slide já vem da arte.
+ */
+export function textoDoPedidoDeTexto(termo: string): string {
+  return `A descrição pede texto na imagem ("${termo}"). A IA de imagem escreve errado, e o texto do slide já vem da arte: descreva a cena sem ele.`;
+}
+
 /**
  * A CHAVE NUNCA VAI PARA UMA FRASE. A mensagem que a OpenAI devolve num 401 traz um pedaço mascarado da
  * chave ("Incorrect API key provided: " seguido do começo e do fim dela), e a frase do Labs repassa a
```

Crie `app/bonus/[id]/carrossel/[cid]/gerar-imagem.tsx`:

```tsx
"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { btnPrimary, btnSecondary, hint, input } from "@/app/ui";
import type { ConsultaDaImagem } from "@/lib/bonus/imagem-consulta";
import { TETO_IMAGEM_DIARIO, urlDaConsultaDaImagem } from "@/lib/bonus/imagem-regras";
import {
  TEXTO_GERANDO_A_IMAGEM,
  TEXTO_IMAGEM_FALHOU_SEM_MOTIVO,
  TEXTO_IMAGEM_GERADA,
  textoDaRecusaDaImagem,
  textoDoContador,
  textoDoPedidoDeTexto,
  type AvisoDoPedidoDeImagem,
} from "@/lib/bonus/imagem-textos";
import { ESTILOS, pedeTextoNaImagem } from "@/lib/bonus/prompt-ilustracao";

// O "GERAR IMAGEM" DE UM SLIDE (spec da Etapa 6, "A tela" e "Pedir e acompanhar"), na linha dos botões da
// imagem do card, ao lado do "Subir foto" e do "Slide pronto do Canva".
//
// O botão abre o campo da cena, com os cinco atalhos do Labs, o aviso da descrição que pede texto e o
// contador do dia. O "Gerar" chama a action do pedido, que confere, reserva e VOLTA NA HORA (achado 88):
// a imagem é gerada no servidor, e este componente pergunta pela rota GET da consulta, uma pergunta de cada
// vez, até ela ficar pronta ou falhar. Enquanto isso, o resto da página funciona. A página que abre com uma
// geração em andamento começa aqui em "Gerando…" e acompanha.

/** O que o editor entrega a cada card para gerar a imagem do slide dele. */
export type GeradorDoSlide = {
  acao: (pedido: unknown) => Promise<AvisoDoPedidoDeImagem>;
  /** A conta das últimas 24 horas, comum a todos os cards. */
  hoje: number;
  aoMudarHoje: (hoje: number) => void;
  /** A última descrição deste slide, para o "Gerar de novo". */
  descricaoInicial: string | null;
  /** Uma geração deste slide estava em andamento quando a página abriu. */
  gerandoInicial: boolean;
  /** A imagem ficou pronta: o editor guarda a foto e troca a versão da miniatura. */
  aoPronta: (r: { versao: string | null; versaoDaMiniatura: string }) => void;
  /** O intervalo entre as perguntas (`INTERVALO_CONSULTA_MS`; o teste usa um menor). */
  intervaloMs: number;
};

type AvisoNaTela = { tom: "ok" | "atencao" | "erro"; texto: string };

const COR: Record<AvisoNaTela["tom"], string> = {
  ok: "text-aberto dark:text-aberto-escuro",
  atencao: "text-fecha dark:text-fecha-escuro",
  erro: "text-parou dark:text-parou-escuro",
};

export default function GerarImagem({
  caminho,
  carrosselId,
  numero,
  gerador,
  aoMudarGerando,
}: {
  caminho: string;
  carrosselId: string;
  numero: number;
  gerador: GeradorDoSlide;
  /** Avisa o card quando a geração começa ou termina: os outros botões da imagem ficam desligados. */
  aoMudarGerando: (gerando: boolean) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [descricao, setDescricao] = useState(gerador.descricaoInicial ?? "");
  const [jaPediu, setJaPediu] = useState(gerador.descricaoInicial !== null);
  const [gerando, setGerando] = useState(gerador.gerandoInicial);
  const [aviso, setAviso] = useState<AvisoNaTela | null>(gerador.gerandoInicial ? { tom: "atencao", texto: TEXTO_GERANDO_A_IMAGEM } : null);
  const [rodada, setRodada] = useState(0);
  const [pendente, iniciar] = useTransition();
  // As funções do editor mudam a cada desenho; a consulta usa sempre as de agora.
  const doEditor = useRef(gerador);
  useEffect(() => {
    doEditor.current = gerador;
  });

  const ocupado = gerando || pendente;
  useEffect(() => {
    aoMudarGerando(ocupado);
  }, [ocupado, aoMudarGerando]);

  // A CONSULTA, uma pergunta de cada vez: a próxima só é marcada depois de a anterior responder.
  useEffect(() => {
    if (!gerando) return;
    let vivo = true;
    const relogio = setTimeout(async () => {
      try {
        const resposta = await fetch(urlDaConsultaDaImagem(caminho, numero), { cache: "no-store" });
        const corpo = (await resposta.json()) as ConsultaDaImagem | { erro?: string };
        if (!vivo) return;
        if (!resposta.ok || !("estado" in corpo)) {
          setGerando(false);
          setAviso({ tom: "erro", texto: ("erro" in corpo && corpo.erro) || TEXTO_IMAGEM_FALHOU_SEM_MOTIVO });
          return;
        }
        doEditor.current.aoMudarHoje(corpo.hoje);
        if (corpo.estado === "pronta") {
          doEditor.current.aoPronta({ versao: corpo.versao, versaoDaMiniatura: corpo.versaoDaMiniatura });
          setGerando(false);
          setAviso({ tom: "ok", texto: TEXTO_IMAGEM_GERADA });
          return;
        }
        if (corpo.estado === "falhou") {
          setGerando(false);
          setAviso({ tom: "erro", texto: corpo.texto });
          return;
        }
        if (corpo.estado === "nenhuma") {
          setGerando(false);
          setAviso(null);
          return;
        }
      } catch {
        // A rede caiu nesta pergunta: a próxima tenta de novo.
      }
      if (vivo) setRodada((r) => r + 1);
    }, gerador.intervaloMs);
    return () => {
      vivo = false;
      clearTimeout(relogio);
    };
  }, [gerando, rodada, caminho, numero, gerador.intervaloMs]);

  const termo = pedeTextoNaImagem(descricao);
  const noTeto = gerador.hoje >= TETO_IMAGEM_DIARIO;

  function pedir() {
    iniciar(async () => {
      const r = await gerador.acao({ id: carrosselId, numero, descricao });
      if (r.hoje !== undefined) gerador.aoMudarHoje(r.hoje);
      if (r.tom !== "ok") {
        setAviso({ tom: "erro", texto: r.texto });
        return;
      }
      setJaPediu(true);
      setAviso({ tom: "atencao", texto: r.texto });
      setGerando(true);
    });
  }

  return (
    <>
      <button type="button" aria-expanded={aberto} onClick={() => setAberto(!aberto)} className={`${btnSecondary} whitespace-nowrap`}>
        {jaPediu ? "Gerar de novo" : "Gerar imagem"}
      </button>
      {(aberto || aviso) && (
        <div className="order-last basis-full space-y-2">
          {aberto && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Descreva a cena</p>
              <textarea
                aria-label={`Slide ${numero}: descreva a cena`}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={3}
                className={input}
              />
              {/* Os atalhos em linhas, e não numa lista: os cards já são os itens da lista da página. */}
              <div className={`${hint} space-y-0.5`}>
                {ESTILOS.map((e) => (
                  <p key={e.chave}>
                    <code>{`/${e.chave}`}</code> {e.rotulo}: {e.resumo}
                  </p>
                ))}
              </div>
              {termo && <p className="text-xs font-medium text-fecha dark:text-fecha-escuro">{textoDoPedidoDeTexto(termo)}</p>}
              <p className={hint}>{textoDoContador(gerador.hoje)}</p>
              {noTeto && <p className="text-xs font-medium text-parou dark:text-parou-escuro">{textoDaRecusaDaImagem({ motivo: "teto" })}</p>}
              <button type="button" onClick={pedir} disabled={ocupado || noTeto} className={btnPrimary}>
                Gerar
              </button>
            </div>
          )}
          {aviso && (
            <p role="status" className={`text-xs font-medium ${COR[aviso.tom]}`}>
              {aviso.texto}
            </p>
          )}
        </div>
      )}
    </>
  );
}
```

Em `app/bonus/[id]/carrossel/[cid]/publicacao-na-tela.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/[id]/carrossel/[cid]/publicacao-na-tela.ts b/app/bonus/[id]/carrossel/[cid]/publicacao-na-tela.ts
index 6f7dc9d..ac338d7 100644
--- a/app/bonus/[id]/carrossel/[cid]/publicacao-na-tela.ts
+++ b/app/bonus/[id]/carrossel/[cid]/publicacao-na-tela.ts
@@ -1,4 +1,5 @@
 import type { OrigemDaConta } from "@/lib/bonus/arte-conta";
+import type { AvisoDoPedidoDeImagem } from "@/lib/bonus/imagem-textos";
 import type { JeitoDaImagem } from "@/lib/bonus/publicar-regras";
 import type { AvisoDaImagem, AvisoDaPublicacao, RespostaDaAssinatura } from "@/lib/bonus/publicar-textos";
 import type { TomDoQuadro } from "@/lib/bonus/textos";
@@ -12,6 +13,18 @@ import type { TomDoQuadro } from "@/lib/bonus/textos";
  */
 export type ImagemNaTela = { url: string | null; versao: string; jeito: JeitoDaImagem };
 
+/**
+ * O CRIADOR DE IMAGEM (spec da Etapa 6): a action do pedido, a conta do dia, a última descrição de cada
+ * slide (para o "Gerar de novo") e os slides com uma geração em andamento quando a página abriu (o card
+ * começa em "Gerando…" e acompanha). Sem ele, os cards não têm o "Gerar imagem".
+ */
+export type ImagemGeradaNaTela = {
+  acaoDoPedido: (pedido: unknown) => Promise<AvisoDoPedidoDeImagem>;
+  hoje: number;
+  descricoes: Record<number, string>;
+  gerando: number[];
+};
+
 export type PublicacaoNaTela = {
   acaoDaAssinatura: (pedido: unknown) => Promise<RespostaDaAssinatura>;
   acaoDaImagem: (pedido: unknown) => Promise<AvisoDaImagem>;
@@ -31,4 +44,6 @@ export type PublicacaoNaTela = {
   avisoDoCalendario: string | null;
   /** O aviso do funil (Etapa 7, `textoDoFunil`), depois de agendar ou publicar. */
   avisoDoFunil?: string | null;
+  /** O criador de imagem (Etapa 6). */
+  imagemGerada?: ImagemGeradaNaTela;
 };
```

Em `app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx b/app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx
index 3ce52f3..411356a 100644
--- a/app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx
+++ b/app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx
@@ -10,6 +10,7 @@ import { corteDoCard, type Corte } from "@/lib/bonus/publicar-cabimento";
 import type { JeitoDaImagem } from "@/lib/bonus/publicar-regras";
 import { TEXTO_TEXTO_MUDOU, type AvisoDaImagem } from "@/lib/bonus/publicar-textos";
 import Campo from "./campo";
+import GerarImagem, { type GeradorDoSlide } from "./gerar-imagem";
 import type { ImagemNaTela } from "./publicacao-na-tela";
 
 // O CARD DE UMA PARTE DO CARROSSEL (spec da Etapa 4, "Um card por slide"): a miniatura do slide, o
@@ -39,6 +40,8 @@ import type { ImagemNaTela } from "./publicacao-na-tela";
 //   inteiro, e a miniatura passa a ser ele. Com o texto salvo depois dele, o card avisa.
 // Os dois botões e o "Baixar" ficam numa linha embaixo do card, na largura dele (prova de 07/10).
 // Subir um jeito troca o outro. O "Baixar" continua baixando a arte do Chat, para levar ao Canva.
+// Na mesma linha, o "Gerar imagem" (spec da Etapa 6, gerar-imagem.tsx): a imagem gerada entra no espaço
+// como uma foto, e enquanto ela gera os outros botões da imagem deste slide ficam desligados.
 // Com o carrossel na fila ou publicado (`travado`), o card fica só para leitura: sem "Editar", sem
 // upload, e o "Só texto" desligado. A trava vale no servidor; aqui ela só se mostra.
 export default function CardDaParte({
@@ -61,6 +64,7 @@ export default function CardDaParte({
   travado = null,
   aoMudarNaoSalvo,
   aoMudarCorte,
+  gerarImagem = null,
 }: {
   acao: (anterior: AvisoDoSlide | null, form: FormData) => Promise<AvisoDoSlide | null>;
   caminho: string;
@@ -89,6 +93,8 @@ export default function CardDaParte({
   aoMudarNaoSalvo?: (naoSalvo: boolean) => void;
   /** Avisa o editor quando o slide passa a sair cortado, ou deixa de sair: o "Publicar" trava com ele. */
   aoMudarCorte?: (corte: Corte | null) => void;
+  /** Gera a imagem do espaço deste slide (Etapa 6). Sem ele, o card não tem o "Gerar imagem". */
+  gerarImagem?: GeradorDoSlide | null;
 }) {
   const doCard = (v: Record<string, string>) => Object.fromEntries(campos.map((c) => [c.nome, v[c.nome] ?? ""]));
   const [atuais, setAtuais] = useState(() => doCard(valores));
@@ -107,6 +113,7 @@ export default function CardDaParte({
   const [avisoDaImagem, setAvisoDaImagem] = useState<AvisoDaImagem | null>(null);
   const [enviando, iniciarEnvio] = useTransition();
   const [jeitoEnviado, setJeitoEnviado] = useState<JeitoDaImagem | null>(null);
+  const [gerandoImagem, setGerandoImagem] = useState(false);
 
   const numero = parte.tipo === "slide" ? parte.numero : null;
   const naoSalvo = campos.some((c) => atuais[c.nome] !== salvos[c.nome]);
@@ -154,7 +161,7 @@ export default function CardDaParte({
           accept="image/jpeg,image/png,image/webp"
           aria-label={jeito === "foto" ? `Slide ${numero}: foto para o espaço da arte` : `Slide ${numero}: slide pronto do Canva`}
           className="sr-only"
-          disabled={enviando}
+          disabled={enviando || gerandoImagem}
           onChange={(e) => aoEscolherImagem(e, jeito)}
         />
       </label>
@@ -240,6 +247,15 @@ export default function CardDaParte({
         <div className="mt-3 flex flex-wrap items-center gap-2">
           {podeSubir && botaoDeImagem("foto")}
           {podeSubir && botaoDeImagem("slide")}
+          {podeSubir && gerarImagem && (
+            <GerarImagem
+              caminho={caminho}
+              carrosselId={carrosselId}
+              numero={numero}
+              gerador={gerarImagem}
+              aoMudarGerando={setGerandoImagem}
+            />
+          )}
           <a
             href={urlDaArte(caminho, numero, versao, true)}
             download
```

Em `app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx b/app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx
index 35e766f..79f4086 100644
--- a/app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx
+++ b/app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx
@@ -9,10 +9,12 @@ import type { AvisoDoSlide } from "@/lib/bonus/carrossel-textos";
 import { juntarCortes, type Corte } from "@/lib/bonus/publicar-cabimento";
 import type { JeitoDaImagem } from "@/lib/bonus/publicar-regras";
 import type { AvisoDaImagem } from "@/lib/bonus/publicar-textos";
+import { INTERVALO_CONSULTA_MS } from "@/lib/bonus/tempos";
 import CardDaParte from "./card-da-parte";
 import CardPublicar from "./card-publicar";
+import type { GeradorDoSlide } from "./gerar-imagem";
 import { enviarImagemDoSlide } from "./imagem-no-navegador";
-import type { ImagemNaTela, PublicacaoNaTela } from "./publicacao-na-tela";
+import type { ImagemGeradaNaTela, ImagemNaTela, PublicacaoNaTela } from "./publicacao-na-tela";
 
 // O EDITOR DO CARROSSEL, SLIDE A SLIDE (spec da Etapa 4, "A página"): a conta do carrossel, um card
 // por slide (a miniatura e, ao lado, o editor dele: card-da-parte.tsx), o card da legenda, e o
@@ -34,6 +36,10 @@ import type { ImagemNaTela, PublicacaoNaTela } from "./publicacao-na-tela";
 // na resposta: a foto muda a arte. Com o carrossel na fila ou publicado, a trava aparece no topo e cada
 // card fica só para leitura.
 //
+// O CRIADOR DE IMAGEM (spec da Etapa 6) entra por `publicacao.imagemGerada`: cada card com espaço ganha o
+// "Gerar imagem" (gerar-imagem.tsx). A conta do dia mora aqui, comum a todos os cards; pronta a imagem,
+// ela entra como foto, e a miniatura daquele slide ganha a versão que a consulta trouxe.
+//
 // As actions entram por propriedade, para o teste de tela usar falsas.
 export default function EditorDoCarrossel({
   acaoDoSlide,
@@ -52,6 +58,7 @@ export default function EditorDoCarrossel({
   soTextoInicial,
   versoes: versoesIniciais,
   pausaMs = 400,
+  intervaloDaConsultaMs = INTERVALO_CONSULTA_MS,
   publicacao,
 }: {
   acaoDoSlide: (anterior: AvisoDoSlide | null, form: FormData) => Promise<AvisoDoSlide | null>;
@@ -71,10 +78,13 @@ export default function EditorDoCarrossel({
   soTextoInicial: number[];
   versoes: string[];
   pausaMs?: number;
+  /** O intervalo entre as perguntas da consulta da imagem; o teste de tela usa um menor. */
+  intervaloDaConsultaMs?: number;
   publicacao?: PublicacaoNaTela;
 }) {
   const [versoes, setVersoes] = useState(versoesIniciais);
   const [imagens, setImagens] = useState<Record<number, ImagemNaTela>>(publicacao?.imagens ?? {});
+  const [hojeDeImagens, setHojeDeImagens] = useState(publicacao?.imagemGerada?.hoje ?? 0);
   const travado = publicacao?.travado ?? null;
   // As partes "não salvas" ("slide_N" e "legenda"): o "Publicar" trava com elas, porque o que sai é o
   // texto salvo. Cada card avisa quando muda.
@@ -137,6 +147,25 @@ export default function EditorDoCarrossel({
     return r;
   }
 
+  /**
+   * O gerador de imagem de um slide (Etapa 6): a action do pedido, a conta do dia, a última descrição e
+   * a geração em andamento. Pronta a imagem, ela entra como foto, e a miniatura ganha a versão nova.
+   */
+  function geradorDoSlide(g: ImagemGeradaNaTela, numero: number): GeradorDoSlide {
+    return {
+      acao: g.acaoDoPedido,
+      hoje: hojeDeImagens,
+      aoMudarHoje: setHojeDeImagens,
+      descricaoInicial: g.descricoes[numero] ?? null,
+      gerandoInicial: g.gerando.includes(numero),
+      aoPronta: ({ versao, versaoDaMiniatura }) => {
+        setImagens((atuais) => ({ ...atuais, [numero]: { url: null, versao: versao ?? "", jeito: "foto" } }));
+        setVersoes((vs) => vs.map((x, i) => (i === numero - 1 ? versaoDaMiniatura : x)));
+      },
+      intervaloMs: intervaloDaConsultaMs,
+    };
+  }
+
   async function baixarTodos() {
     setBaixando(true);
     for (const n of slides) {
@@ -220,6 +249,7 @@ export default function EditorDoCarrossel({
               travado={travado}
               aoMudarNaoSalvo={(sim) => marcarNaoSalvo(`slide_${n}`, sim)}
               aoMudarCorte={(corte) => marcarCorte(n, corte)}
+              gerarImagem={publicacao?.imagemGerada ? geradorDoSlide(publicacao.imagemGerada, n) : null}
             />
           ))}
           <CardDaParte
```

Em `app/bonus/[id]/carrossel/[cid]/revisao.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/[id]/carrossel/[cid]/revisao.tsx b/app/bonus/[id]/carrossel/[cid]/revisao.tsx
index 046529f..1139279 100644
--- a/app/bonus/[id]/carrossel/[cid]/revisao.tsx
+++ b/app/bonus/[id]/carrossel/[cid]/revisao.tsx
@@ -1,6 +1,7 @@
 import { cookies } from "next/headers";
 import { alertError } from "@/app/ui";
 import { fixarContaDoCarrossel, salvarArteDoCarrossel, salvarSlideDoCarrossel } from "@/app/bonus/carrossel-actions";
+import { pedirImagemDoSlide } from "@/app/bonus/imagem-actions";
 import { assinarImagemDoCarrossel, guardarImagemDoSlide, publicarCarrossel } from "@/app/bonus/publicar-actions";
 import { ACCOUNT_COOKIE } from "@/lib/account";
 import { urlPublicaSeDerParaMontar } from "@/lib/bucket";
@@ -15,6 +16,8 @@ import { contasParaArte } from "@/lib/bonus/carrossel-repositorio";
 import { textoDaLinhaDoCarrossel } from "@/lib/bonus/carrossel-tela";
 import { camposDoFormulario, valoresPorCampo } from "@/lib/bonus/carrossel-texto";
 import { TEXTO_CARROSSEL_SEM_TEXTO } from "@/lib/bonus/carrossel-textos";
+import { imagensNasUltimas24h, ultimasDoCarrossel } from "@/lib/bonus/imagem-repositorio";
+import { estadoDaImagem } from "@/lib/bonus/imagem-regras";
 import { publicacaoLivre } from "@/lib/bonus/publicar-estado";
 import { fotosDaArte, imagensDaArte, versaoDoTextoDoSlide } from "@/lib/bonus/publicar-regras";
 import { estadoDoCarrossel } from "@/lib/bonus/publicar-repositorio";
@@ -44,6 +47,9 @@ import type { PublicacaoNaTela } from "./publicacao-na-tela";
  *
  * O AVISO DO FUNIL (spec da Etapa 7) também: depois de agendar ou publicar, a página lembra de ligar a
  * automação da palavra no post novo, no /automacoes. Vale para o carrossel de bônus e para o avulso.
+ *
+ * O CRIADOR DE IMAGEM (spec da Etapa 6) também: a conta do dia, a última descrição de cada slide e os
+ * slides com uma geração em andamento, lidos de `imagens_geradas` pelo relógio do banco.
  */
 export default async function Revisao({ carrossel }: { carrossel: LinhaDoCarrossel }) {
   const texto = textoDaLinhaDoCarrossel(carrossel);
@@ -59,6 +65,7 @@ export default async function Revisao({ carrossel }: { carrossel: LinhaDoCarross
   const noMenu = contaSelecionada(contas, doCookie);
   // O jeito de cada imagem é o prefixo do caminho (adendo da Etapa 5): as fotos são as de `bonus-foto`.
   const fotos = fotosDaArte(carrossel.arte, carrossel.total_slides);
+  const [{ agora, linhas: geradas }, hojeDeImagens] = await Promise.all([ultimasDoCarrossel(carrossel.id), imagensNasUltimas24h()]);
   const publicacao: PublicacaoNaTela = {
     acaoDaAssinatura: assinarImagemDoCarrossel,
     acaoDaImagem: guardarImagemDoSlide,
@@ -77,6 +84,14 @@ export default async function Revisao({ carrossel }: { carrossel: LinhaDoCarross
     avisoDoCalendario:
       filaId && conta && escolhas.conta && noMenu?.ig_user_id !== escolhas.conta ? textoDoCalendario(rotuloDaConta(conta)) : null,
     avisoDoFunil: textoDoFunil(estado, carrossel.palavra),
+    imagemGerada: {
+      acaoDoPedido: pedirImagemDoSlide,
+      hoje: hojeDeImagens,
+      descricoes: Object.fromEntries(Object.values(geradas).map((l) => [l.numero, l.descricao])),
+      gerando: Object.values(geradas)
+        .filter((l) => estadoDaImagem(l, agora).tipo === "gerando")
+        .map((l) => l.numero),
+    },
   };
 
   return (
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npm run lint
npx vitest run --config vitest.dom.config.ts testes-dom/bonus-gerar-imagem.dom.tsx
npx vitest run tests/bonus-imagem-paginas.test.ts
npm test
npm run test:dom
```

Esperado: `tsc` e lint limpos; os 12 de tela e os 14 puros passam; as suítes inteiras com 116 arquivos
e 3 209 casos puros, e 23 e 201 de tela.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/imagem-textos.ts "app/bonus/[id]/carrossel/[cid]/gerar-imagem.tsx" "app/bonus/[id]/carrossel/[cid]/publicacao-na-tela.ts" "app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx" "app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx" "app/bonus/[id]/carrossel/[cid]/revisao.tsx" testes-dom/bonus-gerar-imagem.dom.tsx tests/bonus-imagem-paginas.test.ts
test "$(git branch --show-current)" = "criador-de-imagem"
git add lib/bonus/imagem-textos.ts "app/bonus/[id]/carrossel/[cid]/gerar-imagem.tsx" "app/bonus/[id]/carrossel/[cid]/publicacao-na-tela.ts" "app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx" "app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx" "app/bonus/[id]/carrossel/[cid]/revisao.tsx" testes-dom/bonus-gerar-imagem.dom.tsx tests/bonus-imagem-paginas.test.ts
git commit -m "feat(bonus): o Gerar imagem no card de cada slide, com o acompanhar"
```

---

### FASE 6.8 — O verify, a integração inteira, as mutações, a guarda do diff e a varredura da chave

- [ ] **Passo 1: o verify, na árvore do projeto**

```bash
env -u CLAUDECODE -u AI_AGENT npm run verify
git diff --stat AGENTS.md
```

Esperado: lint e `tsc` limpos; 116 arquivos e 3 209 casos puros e 23 e 201 de tela; a varredura "SEM
VAZAMENTO em A nem em C"; o build (Turbopack) com "MIGRAÇÃO PULADA" e as rotas
`ƒ /bonus/[id]/carrossel/[cid]/imagem` e `ƒ /carrosseis/[cid]/imagem`; o `AGENTS.md` sem diferença.

- [ ] **Passo 2: a integração inteira, no container**

```bash
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npm run test:integracao
```

Esperado: `[rede-global] ALVO: banco de TESTE`; 45 arquivos, 493 passaram e 8 pularam (na base, 42,
446 e 8).

- [ ] **Passo 3: as provas de mutação**

Copie o script do Apêndice A para `$SCRATCH/mutar-imagem.mjs` e rode, da raiz:

```bash
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" node "$SCRATCH/mutar-imagem.mjs"
git status --short
```

Esperado: as 34 com ✓, "34 mutações, 0 ruins", e a árvore limpa depois (cada arquivo volta byte a
byte).

- [ ] **Passo 4: a guarda do diff (pedido da auditoria)**

```bash
git diff --stat aef1eeb -- app/publicar app/api app/automacoes lib/bucket.ts lib/queue-drain.ts lib/engine.ts lib/publicacao.ts lib/dedupe.ts scripts package.json package-lock.json next.config.ts proxy.ts "app/bonus/[id]/carrossel/[cid]/arte" "app/carrosseis/[cid]/arte" lib/bonus/arte-slides.ts lib/bonus/arte-foto.ts lib/bonus/publicar-bucket.ts lib/bonus/publicar-regras.ts
git diff --stat aef1eeb -- migrations
git diff --stat aef1eeb -- . ':!app/bonus' ':!app/carrosseis' ':!lib/bonus' ':!tests' ':!testes-dom' ':!testes-integracao' ':!docs' ':!migrations/018-imagens-geradas.sql' ':!lib/esquema.ts'
git diff --stat aef1eeb -- app/carrosseis ':!app/carrosseis/[cid]/imagem'
git diff --stat=200 aef1eeb --diff-filter=M -- app lib
```

Esperado: a primeira, a terceira e a quarta saídas vazias; a segunda, só
`migrations/018-imagens-geradas.sql`; a quinta, exatamente estes 6 arquivos que já existiam:
`card-da-parte.tsx`, `editor-do-carrossel.tsx`, `publicacao-na-tela.ts` e `revisao.tsx` (em
`app/bonus/[id]/carrossel/[cid]/`), `lib/bonus/publicar-processo.ts` (só o `export`) e
`lib/esquema.ts`. Os caminhos com colchetes casam ao pé da letra no git (no ensaio, uma linha
acrescentada de propósito em `app/carrosseis/[cid]/arte/route.tsx` apareceu na primeira saída, e foi
desfeita).

- [ ] **Passo 5: a varredura da chave (pedido da auditoria)**

```bash
git grep -nE "sk-[A-Za-z0-9_-]{20,}" HEAD -- . ':!package-lock.json'
git log -p --format=%B aef1eeb..HEAD | grep -cE "sk-[A-Za-z0-9_-]{20,}"
git grep -n "OPENAI_API_KEY" HEAD -- . ':!docs'
git grep -n "console\." HEAD -- lib/bonus/imagem-jpeg.ts lib/bonus/imagem-regras.ts lib/bonus/imagem-textos.ts lib/bonus/imagem-openai.ts lib/bonus/imagem-repositorio.ts lib/bonus/imagem-processo.ts lib/bonus/imagem-consulta.ts lib/bonus/prompt-ilustracao.ts lib/bonus/erro-ilustracao.ts app/bonus/imagem-actions.ts "app/bonus/[id]/carrossel/[cid]/imagem/route.ts" "app/carrosseis/[cid]/imagem/route.ts" "app/bonus/[id]/carrossel/[cid]/gerar-imagem.tsx"
```

Esperado: a primeira vazia, e a segunda `0` (nenhuma chave com cara de verdadeira na árvore, no diff
nem nas mensagens dos commits); a terceira com 6 linhas: a leitura em `lib/bonus/imagem-openai.ts` e em
`lib/bonus/imagem-processo.ts`, a chave inventada em `tests/bonus-imagem-openai.test.ts` (duas linhas) e
em `testes-integracao/bonus-imagem-processo.integracao.ts`, e o caso de
`tests/bonus-imagem-paginas.test.ts` que cobra a ausência dela na action; a quarta vazia.

- [ ] **Passo 6: avisar o auditor**, com o hash, os números e o pedido de conferir a branch antes do
  push. A 018, o push da branch e o PR só com o OK do Eduardo.

---

### FASE 6.9 — As pré-condições, a 018 na produção e a prova real, no preview, com o Eduardo

Cada escrita em produção tem o OK do Eduardo, pela caixa, e a auditoria lê o banco antes e depois
(avisada com a hora). O preview usa o banco e o bucket de produção, e a chave em Preview. **Sem post
real.**

- [ ] **Passo 1: as pré-condições, com o Eduardo** (spec, "Pré-condições")

1. A `OPENAI_API_KEY` na Vercel do Chat, em Production e Preview, criada pelo Eduardo ou pelo
   Vinícius, numa conta da OpenAI com crédito e com a organização verificada (o 403 do `gpt-image-1`).
   A sessão confere só que o nome existe nos dois ambientes, sem ler o valor.
2. O Fluid Compute ligado no projeto da Vercel (Settings → Functions), conferido de novo pelo Eduardo
   ou pelo Vinícius: sem ele, a função para em 60 s e a geração no `after()` pode ser cortada.
3. Recomendado: um limite de gasto no projeto da OpenAI dessa chave.

- [ ] **Passo 2: a linha de base da auditoria**, só de leitura, antes da 018 (o registro das
  migrações, com 18, e a ausência de `imagens_geradas`).

- [ ] **Passo 3: o ensaio a seco da 018**

```bash
node scripts/migrar.mjs
```

Esperado: lista só `018-imagens-geradas.sql` como pendente, sem aplicar nada.

- [ ] **Passo 4: aplicar à mão, com o OK do Eduardo**

Pergunte pela caixa. Com o OK, e com o "pode rodar" da auditoria depois de ela ter a hora:

```bash
node scripts/migrar.mjs --aplicar --a-mao
node scripts/migrar.mjs
```

Esperado: a primeira aplica e anota a `018`; a segunda diz "já aplicada". A soma registrada é a do
passo 5 da FASE 6.1 (`a2b6208bbbcd`). A auditoria lê de novo: a tabela, as colunas, os `check`, os
índices e nenhuma linha. A 018 vem antes do push (item 7 do ensaio); o código da `main` não lê a tabela,
e por isso aplicá-la antes não muda nada na produção.

- [ ] **Passo 5: o push da branch e o preview, com o OK do Eduardo**

Empurre só a branch (`git push origin refs/heads/criador-de-imagem:refs/heads/criador-de-imagem`).
No log do build do preview, confira o commit, "MIGRAÇÃO PULADA" e as duas rotas `imagem`.

- [ ] **Passo 6: a prova, com o Eduardo na tela** (os passos da spec, "A prova real")

Os textos sugeridos para digitar passam antes pelo schema de cada campo (o mínimo e o máximo); a
descrição da cena tem de 10 a 600 caracteres, sem contar o atalho.

1. "Novo carrossel" → texto livre → "Escrever à mão", com 1 slide; criar (grava em produção: só com o
   OK).
2. No slide, "Gerar imagem" com uma descrição de cena (grava; **~US$ 0,063**): a imagem aparece no
   espaço, e o contador mostra "Hoje: 1 de 10". A auditoria mede o JPEG guardado (medidas e bytes).
3. "Gerar de novo" com a descrição ajustada (grava; **~US$ 0,063**), e, durante o "Gerando…",
   recarregar a página: o card volta em "Gerando…" e a imagem aparece sem novo clique. A imagem troca, a
   anterior sai do bucket, e o contador vai a 2.
4. Uma descrição com menos de 10 caracteres: recusada antes de chamar a OpenAI, sem custo e sem linha
   nova.
5. Agendar para daqui a 7 dias e cancelar no calendário (gravam): a arte da fila leva a imagem gerada.

No fim, o carrossel e as imagens saem do banco e do bucket, com o OK do Eduardo e o script lido pela
auditoria antes de rodar (achado 77). As linhas de `imagens_geradas` ficam, com o carrossel nulo: são o
histórico do teto, e as 2 da prova contam no teto da produção por 24 horas. Depois: o corpo do PR,
conferido pelo auditor, e o PR com o OK do Eduardo. O merge é do Vinícius, e o build do merge diz "Nada
a aplicar: as 19 migrações".

---

## Apêndice A — as provas de mutação

Cada mutação tira uma proteção e roda o teste que a cobre; o caso nomeado tem de cair. O arquivo
volta byte a byte depois de cada uma. Sem `DATABASE_URL_TESTES`, o script recusa antes de mutar, e
nenhuma mutação chama a OpenAI.

```js
// Provas de mutação da Etapa 6 (o criador de imagem). Cada mutação tira uma proteção e roda o teste que a
// cobre; o caso nomeado tem de cair. Cada arquivo volta byte a byte.
// Uso, da raiz do repositório: DATABASE_URL_TESTES=<container> node mutar-imagem.mjs [filtro]
// As mutações INTEG rodam a suíte de integração, que sem DATABASE_URL_TESTES cai na DATABASE_URL, a da
// PRODUÇÃO (achado 68): sem a variável, o script recusa antes de mutar, e uma rodada INTEG que não imprime
// "ALVO: banco de TESTE" conta como ✗. Nenhuma mutação chama a OpenAI: os testes usam uma falsa.
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const PURA = (f) => `npx vitest run ${f}`;
const TELA = (f) => `npx vitest run --config vitest.dom.config.ts ${f}`;
const INTEG = (f) => `npx vitest run --config vitest.integracao.config.ts ${f}`;

const MIGRACAO = "migrations/018-imagens-geradas.sql";
const ESQUEMA = "lib/esquema.ts";
const PROMPT = "lib/bonus/prompt-ilustracao.ts";
const ERRO = "lib/bonus/erro-ilustracao.ts";
const OPENAI = "lib/bonus/imagem-openai.ts";
const REGRAS = "lib/bonus/imagem-regras.ts";
const JPEG = "lib/bonus/imagem-jpeg.ts";
const REPO = "lib/bonus/imagem-repositorio.ts";
const PROCESSO = "lib/bonus/imagem-processo.ts";
const ACOES = "app/bonus/imagem-actions.ts";
const ROTA = "app/bonus/[id]/carrossel/[cid]/imagem/route.ts";
const CONSULTA = "lib/bonus/imagem-consulta.ts";
const CARD = "app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx";
const GERAR = "app/bonus/[id]/carrossel/[cid]/gerar-imagem.tsx";
const EDITOR = "app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx";
const REVISAO = "app/bonus/[id]/carrossel/[cid]/revisao.tsx";

const T_TABELA = INTEG("testes-integracao/bonus-imagens-tabela.integracao.ts");
const T_PARTIDA = INTEG("testes-integracao/esquema-de-partida.integracao.ts");
const T_COPIA = PURA("tests/bonus-ilustracao-copia.test.ts");
const T_ERRO = PURA("tests/bonus-erro-ilustracao.test.ts");
const T_OPENAI = PURA("tests/bonus-imagem-openai.test.ts");
const T_JPEG = PURA("tests/bonus-imagem-jpeg.test.ts");
const T_ESTADO = PURA("tests/bonus-imagem-estado.test.ts");
const T_REPO = INTEG("testes-integracao/bonus-imagem-repositorio.integracao.ts");
const T_PROCESSO = INTEG("testes-integracao/bonus-imagem-processo.integracao.ts");
const T_PAGINAS = PURA("tests/bonus-imagem-paginas.test.ts");
const T_TELA = TELA("testes-dom/bonus-gerar-imagem.dom.tsx");

const MUTACOES = [
  // 6.1 a migração 018
  { nome: "6.1: sem o check do caminho", arq: MIGRACAO,
    de: "    check ((estado = 'pronta') = (caminho is not null)),", para: "    check (true),",
    cmd: T_TABELA, caso: "o banco recusa pronta sem caminho" },
  { nome: "6.1: o carrossel apagado leva a linha junto", arq: MIGRACAO,
    de: "  carrossel_id uuid references carrosseis_gerados (id) on delete set null,",
    para: "  carrossel_id uuid references carrosseis_gerados (id) on delete cascade,",
    cmd: T_TABELA, caso: "o carrossel apagado deixa a linha, com o carrossel nulo" },
  { nome: "6.1: a 018 fora da marca d'água", arq: ESQUEMA,
    de: '      de: "018-imagens-geradas.sql",', para: '      de: "018-outra.sql",',
    cmd: T_PARTIDA, caso: "a MARCA D'ÁGUA cobre a pasta inteira" },
  // 6.2 as regras copiadas do Labs
  { nome: "6.2: uma regra mudada só no Chat", arq: PROMPT,
    de: '"Fotografia editorial realista, em ambiente corporativo brasileiro contemporâneo. " +',
    para: '"Fotografia editorial, em ambiente corporativo brasileiro contemporâneo. " +',
    cmd: T_COPIA, caso: "lib/bonus/prompt-ilustracao.ts é o arquivo do Labs, byte a byte" },
  { nome: "6.2: o filtro do pedaço da chave tirado do arquivo do Labs", arq: ERRO,
    de: '  const detalhe = erro.message?.trim().replace(PEDACO_DA_CHAVE, "sk-…");', para: "  const detalhe = erro.message?.trim();",
    cmd: T_ERRO, caso: "tira o pedaço da chave que a OpenAI põe na mensagem do 401" },
  // 6.3 a chamada à OpenAI e o JPEG
  { nome: "6.3: a chave que vaza para a frase", arq: OPENAI,
    de: "  if (!resposta.ok) return { ok: false, erro: tirarChave(mensagemDaOpenAI(resposta.status, corpo), chave) };",
    para: "  if (!resposta.ok) return { ok: false, erro: mensagemDaOpenAI(resposta.status, corpo) };",
    cmd: T_OPENAI, caso: "a chave nunca vai para a frase: nem o pedaço que a OpenAI devolve, nem a chave inteira" },
  { nome: "6.3: o PNG do Labs no lugar do JPEG", arq: OPENAI,
    de: '  output_format: "jpeg",', para: '  output_format: "png",',
    cmd: T_OPENAI, caso: "o corpo é o do Labs em JPEG, com a cena embrulhada nas regras, e com prazo" },
  { nome: "6.3: sem a chave, chama assim mesmo", arq: OPENAI,
    de: "  if (!chave) return { ok: false, erro: TEXTO_SEM_CHAVE_DA_IMAGEM };\n", para: "",
    cmd: T_OPENAI, caso: "sem a chave, recusa sem chamar" },
  { nome: "6.3: o que não é JPEG passa", arq: REGRAS,
    de: '  if (!medidas) return "formato";', para: "  if (!medidas) return null;",
    cmd: T_JPEG, caso: "o que não é JPEG é formato" },
  { nome: "6.3: a tabela de Huffman lida como as medidas", arq: JPEG,
    de: "marca <= 0xcf && marca !== 0xc4 && marca !== 0xc8", para: "marca <= 0xcf && marca !== 0xc8",
    cmd: T_JPEG, caso: "a tabela de Huffman (C4) não é confundida com as medidas" },
  // 6.4 o teto
  { nome: "6.4: o teto sem a trava", arq: REPO,
    de: "    await tx.query(`select pg_advisory_xact_lock($1::bigint)`, [TRAVA_DO_TETO_DA_IMAGEM]);\n", para: "",
    cmd: T_REPO, caso: "a reserva espera a trava do teto: contar e inserir não correm em paralelo" },
  { nome: "6.4: o teto só conta as prontas", arq: REPO,
    de: "where criado_em > now() - interval '24 hours'`;", para: "where criado_em > now() - interval '24 hours' and estado = 'pronta'`;",
    cmd: T_REPO, caso: "com 10 em 24 h, de qualquer estado, o décimo primeiro é recusado, sem linha nova" },
  { nome: "6.4: dois pedidos no mesmo slide", arq: REPO,
    de: '    if (gerando.length) return { ok: false as const, motivo: "gerando" as const, hoje };\n', para: "",
    cmd: T_REPO, caso: "o segundo pedido do mesmo slide é recusado; outro slide passa" },
  { nome: "6.4: a pronta marcada fora de gerando", arq: REPO,
    de: "set estado = 'pronta', caminho = $2, terminado_em = now()\n      where id = $1 and estado = 'gerando'",
    para: "set estado = 'pronta', caminho = $2, terminado_em = now()\n      where id = $1",
    cmd: T_REPO, caso: "pronta e falhou só saem de gerando, e uma vez" },
  { nome: "6.4: a travada não vira travada", arq: REGRAS,
    de: ">= TRAVADA_IMAGEM_MS ? { tipo: \"travada\" }", para: ">= TRAVADA_IMAGEM_MS * 10 ? { tipo: \"travada\" }",
    cmd: T_ESTADO, caso: "gerando depois do prazo é travada" },
  // 6.5 o processo
  { nome: "6.5: o pedir sem conferir a descrição", arq: PROCESSO,
    de: '  if (!descricao.ok) return { ok: false, recusa: { motivo: "descricao", texto: descricao.mensagem } };\n', para: "",
    cmd: T_PROCESSO, caso: "recusa a descrição curta, sem linha nova" },
  { nome: "6.5: o pedir sem conferir o espaço", arq: PROCESSO,
    de: '  if (!comEspaco(c.escolhas, p.numero)) return { ok: false, recusa: { motivo: "sem_espaco", numero: p.numero } };\n', para: "",
    cmd: T_PROCESSO, caso: "recusa o slide só texto, sem linha nova" },
  { nome: "6.5: o apagar depois do guardarImagem (achado 89)", arq: PROCESSO,
    de: "    // A linha `gerando` vence pelo prazo, aparece como falha e conta no teto; a foto fica no slide.",
    para: "    // A linha `gerando` vence pelo prazo, aparece como falha e conta no teto; a foto fica no slide.\n    await apagarSemDerrubar([caminho]);",
    cmd: T_PROCESSO, caso: "a falha ao marcar a linha, depois de guardar, deixa a foto no bucket e no slide" },
  { nome: "6.5: a falha ao guardar não apaga o que subiu (achado 89)", arq: PROCESSO,
    de: "    subido = assinado.caminho;\n", para: "",
    cmd: T_PROCESSO, caso: "a falha ao guardar apaga do bucket o que subiu" },
  { nome: "6.5: a imagem gerada assinada como slide pronto", arq: PROCESSO,
    de: 'destino: "foto", arquivo,', para: 'destino: "slide", arquivo,',
    cmd: T_PROCESSO, caso: "vai para bonus-foto na pasta da conta, o slide guarda como foto, a anterior sai, e a linha fica pronta" },
  // 6.6 a action e a consulta
  { nome: "6.6: a geração dentro da action, sem after (achado 88)", arq: ACOES,
    de: "  after(() => gerarImagem({ reservaId, id, numero, descricao, contas }));",
    para: "  await gerarImagem({ reservaId, id, numero, descricao, contas });",
    cmd: T_PAGINAS, caso: "não espera a imagem: a geração vai para o after()" },
  { nome: "6.6: a consulta como action (achado 88)", arq: ROTA,
    de: 'export const runtime = "nodejs";', para: '"use server";\nexport const runtime = "nodejs";',
    cmd: T_PAGINAS, caso: "é uma rota GET, fora da fila das actions" },
  { nome: "6.6: a consulta sem a sessão", arq: ROTA,
    de: "  if (!isValidSession(jarra.get(SESSION_COOKIE)?.value)) return respostaDaConsulta({ erro: TEXTO_ARTE_SEM_SESSAO }, 401);\n", para: "",
    cmd: T_PAGINAS, caso: "o GET confere a sessão antes de qualquer outra coisa" },
  { nome: "6.6: a consulta em cache", arq: CONSULTA,
    de: '"Cache-Control": "private, no-store"', para: '"Cache-Control": "public, max-age=60"',
    cmd: T_PAGINAS, caso: "nunca fica em cache: o estado muda a cada geração" },
  { nome: "6.6: a travada some da consulta", arq: CONSULTA,
    de: '  if (estado.tipo === "travada") return { estado: "falhou", hoje, texto: TEXTO_IMAGEM_TRAVADA };\n', para: "",
    cmd: T_PROCESSO, caso: "a linha travada pelo prazo vira falha, com a frase da travada" },
  // 6.7 a tela
  { nome: "6.7: o card sem o Gerar imagem", arq: CARD,
    de: "{podeSubir && gerarImagem && (", para: "{false && gerarImagem && (",
    cmd: T_TELA, caso: "aparece no slide com espaço, e não no só texto" },
  { nome: "6.7: o Gerar imagem com o carrossel na fila", arq: CARD,
    de: "{podeSubir && gerarImagem && (", para: "{gerarImagem && (",
    cmd: T_TELA, caso: "não aparece com o carrossel na fila" },
  { nome: "6.7: os outros botões não se desligam", arq: CARD,
    de: "disabled={enviando || gerandoImagem}", para: "disabled={enviando}",
    cmd: T_TELA, caso: "enquanto gera, os outros botões da imagem daquele slide ficam desligados" },
  { nome: "6.7: o aviso de texto some", arq: GERAR,
    de: "{termo && <p", para: "{false && <p",
    cmd: T_TELA, caso: "avisa quando a descrição pede texto na imagem, sem travar o botão" },
  { nome: "6.7: o teto não trava o Gerar", arq: GERAR,
    de: "disabled={ocupado || noTeto}", para: "disabled={ocupado}",
    cmd: T_TELA, caso: "no teto do dia, o Gerar trava com a frase do teto" },
  { nome: "6.7: a pronta não troca a miniatura", arq: EDITOR,
    de: "        setVersoes((vs) => vs.map((x, i) => (i === numero - 1 ? versaoDaMiniatura : x)));\n", para: "",
    cmd: T_TELA, caso: "o pedido volta na hora, e a consulta põe a imagem no espaço com a miniatura nova" },
  { nome: "6.7: a página não começa em Gerando", arq: EDITOR,
    de: "      gerandoInicial: g.gerando.includes(numero),", para: "      gerandoInicial: false,",
    cmd: T_TELA, caso: "a página que abre com a geração em andamento começa o card em Gerando…, e acompanha" },
  { nome: "6.7: o Gerar de novo sem a descrição", arq: EDITOR,
    de: "      descricaoInicial: g.descricoes[numero] ?? null,", para: "      descricaoInicial: null,",
    cmd: T_TELA, caso: "o Gerar de novo volta com a última descrição do slide" },
  { nome: "6.7: a página não diz o que está gerando", arq: REVISAO,
    de: '        .filter((l) => estadoDaImagem(l, agora).tipo === "gerando")', para: "        .filter(() => false)",
    cmd: T_PAGINAS, caso: "a action do pedido, a conta do dia e o que está gerando, pelo relógio do banco" },
];

const filtro = process.argv[2];
const escolhidas = MUTACOES.filter((x) => !filtro || x.nome.includes(filtro));
const ehInteg = (m) => m.cmd.includes("vitest.integracao.config.ts");
if (escolhidas.some(ehInteg) && !process.env.DATABASE_URL_TESTES?.trim()) {
  console.log("✗ há mutação INTEG e DATABASE_URL_TESTES está vazia: a integração iria para a produção. Nada foi mutado.");
  process.exit(1);
}
let ruins = 0;
for (const m of escolhidas) {
  const original = readFileSync(m.arq);
  const texto = original.toString("utf8");
  const crlf = texto.includes("\r\n");
  const de = crlf ? m.de.replace(/\n/g, "\r\n") : m.de;
  const para = crlf ? m.para.replace(/\n/g, "\r\n") : m.para;
  const n = texto.split(de).length - 1;
  if (n !== 1) {
    console.log(`✗ ${m.nome}: o trecho aparece ${n} vez(es)`);
    ruins++;
    continue;
  }
  writeFileSync(m.arq, texto.replace(de, () => para), "utf8");
  let saida = "";
  let caiu = false;
  try {
    saida = execSync(`${m.cmd} 2>&1`, { encoding: "utf8", stdio: "pipe", env: { ...process.env }, maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    caiu = true;
    saida = `${e.stdout ?? ""}${e.stderr ?? ""}`;
  } finally {
    writeFileSync(m.arq, original);
  }
  if (ehInteg(m) && !saida.includes("ALVO: banco de TESTE")) {
    console.log(`✗ ${m.nome}: a integração não imprimiu "ALVO: banco de TESTE". Pare e confira o banco.`);
    ruins++;
    continue;
  }
  const casoCaiu = saida.split("\n").some((l) => /FAIL|×/.test(l) && l.includes(m.caso));
  if (!(caiu && casoCaiu)) ruins++;
  console.log(`${caiu && casoCaiu ? "✓" : "✗"} ${m.nome}: o caso "${m.caso}" ${casoCaiu ? "caiu" : "NÃO caiu"}`);
}
console.log(`${escolhidas.length} mutações, ${ruins} ruins`);
process.exit(ruins ? 1 : 0);
```

---

## ADENDO DE 09/10 — as regras do Chat, o modelo novo e a tela do estilo

**Por que existe.** A FASE 6.9 parou no passo 6: a primeira imagem real (carrossel `4e3664ea`, linha
`b6292a0b`) saiu com "cara de IA", e a OpenAI desliga o `gpt-image-1` em 23/10/2026 (achado 90). O
Eduardo pausou a prova e decidiu o adendo da spec (`7601731`, `9d60490`, `f401b7e` e `7fecd1f`, revisados
pela auditoria): regras de estilo próprias do Chat, o `gpt-image-2.5-flare-2026-09-08` em `high` (medido
pelo Labs e escolhido olhando as imagens), e a tela com o estilo. Estas fases continuam a branch
`criador-de-imagem` depois de `7fecd1f`; a 018 não muda, e não há migração nova.

**Ensaio do adendo (09/10):** o código foi escrito e testado fase a fase numa cópia isolada (`git
worktree`, branch local `ensaio-imagem-2-novo`, sem push, saída de `7fecd1f`), e todo bloco abaixo foi tirado
do git dela pelo gerador, sem cópia à mão. Os números:
- lint e `tsc` limpos em cada fase; no fim, 116 arquivos e 3 209 casos puros (116 e 3 209 na base: o
  teste das regras do Labs saiu e o do Chat entrou), 23 e 203 de tela (23 e 201 na base);
- `next build --webpack` limpo, com as duas rotas `imagem`; o `AGENTS.md` intacto;
- integração no container: 45 arquivos; 486 passaram, 8 pularam e 7 caíram, só os de `registro-de-migracoes` (item 6 abaixo); na árvore do projeto, a conta esperada é 45 arquivos, 493 passaram e 8 pularam (FASE 6.13);
- cada fase foi vista falhar antes do código e passar depois, com os números no passo dela;
- as 50 provas de mutação do Apêndice B derrubaram, cada uma, o caso esperado;
- o adendo, aplicado do zero sobre `7fecd1f` numa cópia limpa, dá os 9 arquivos iguais ao fim
  do ensaio, byte a byte;
- os pedidos A e B do apêndice da spec saem do `montarPrompt` byte a byte (o teste lê a spec).

O ensaio do adendo achou estas coisas, já resolvidas abaixo:
1. **O que foi medido é o que vai ao ar.** O teste das regras lê os pedidos A e B do apêndice da spec e
   cobra o `montarPrompt` byte a byte. Uma letra mudada no estilo derruba o teste (mutação "6.10: o
   pedido medido muda uma letra").
2. **A frase do 403 da tradução copiada cita o `gpt-image-1`** (`erro-ilustracao.ts:17` e `:61`). O
   arquivo continua cópia do Labs (blob `6a5e8f55`), e o Chat não o muda sozinho; o Labs tira o nome do
   modelo na fase 49.2 dele e manda o blob novo antes do commit (combinado em 09/10). Até lá, a varredura
   do `gpt-image-1` (FASE 6.13) acha essas duas linhas e o comentário de histórico de `imagem-openai.ts`,
   e nenhuma vez o modelo no corpo da chamada.
3. **O estilo vai no começo da descrição** (`comEstilo`, `separarEstiloDaDescricao`): a tela guarda
   `/cinema …`, o "Gerar de novo" lê de volta, e a tabela 018 não ganha coluna.
4. **Casos que passam antes do código, de propósito** (FASE 6.10): os que protegem o que fica igual ao
   Labs (a `PROIBICAO_DE_TEXTO` letra por letra, o fundo e a pessoa real, o ponto final, e os quatro do
   aviso de texto, que é a lista de termos do Labs).
5. **Os atalhos do Labs mudam de nome no Chat** (`ESTILOS` → `ATALHOS`), porque `ESTILOS` passa a ser os
   três estilos; a tela e o teste de tela trocam o nome na FASE 6.10.
6. **A cópia de ensaio derruba `registro-de-migracoes`** e não roda o Turbopack, como antes; na árvore do
   projeto os dois rodam (FASE 6.13).

As restrições globais do começo deste plano valem para o adendo, com duas a mais:
- **A chave e o modelo.** Nenhum teste chama a OpenAI; a única chamada é a da prova retomada (FASE 6.14),
  duas imagens de US$ 0,0432, com o OK do Eduardo.
- **A tradução das recusas (`erro-ilustracao.ts`) não muda no Chat sem o blob novo do Labs.**

### Mapa dos arquivos do adendo

| arquivo | responsabilidade | fase |
|---|---|---|
| `lib/bonus/prompt-ilustracao.ts`, `tests/bonus-prompt-ilustracao.test.ts`, `tests/bonus-ilustracao-copia.test.ts`; `gerar-imagem.tsx` e o teste de tela (o nome `ATALHOS`) | as regras de estilo do Chat, os pedidos medidos, a cópia só da tradução | 6.10 |
| `lib/bonus/imagem-openai.ts`, `tests/bonus-imagem-openai.test.ts` | o modelo e a qualidade escolhidos, na versão medida | 6.11 |
| `lib/bonus/prompt-ilustracao.ts`, `lib/bonus/imagem-textos.ts`, `gerar-imagem.tsx` e os testes | o estilo na tela e na descrição, a regra do manual do perfil, o aviso de texto nos dois casos | 6.12 |

---

### FASE 6.10 — As regras de estilo do Chat

**Arquivos:**
- Reescrever: `lib/bonus/prompt-ilustracao.ts` (deixa de ser cópia do Labs)
- Modificar: `app/bonus/[id]/carrossel/[cid]/gerar-imagem.tsx` (só o nome `ATALHOS`)
- Testar: `tests/bonus-prompt-ilustracao.test.ts` (reescrito: os casos do Chat), `tests/bonus-ilustracao-copia.test.ts` (só a tradução), `testes-dom/bonus-gerar-imagem.dom.tsx` (só o nome `ATALHOS`), `tests/bonus-erro-ilustracao.test.ts` (sem mudar)

**Interfaces:**
- Consome: o apêndice "Os pedidos da medição" da spec (o teste o lê).
- Produz: `PROIBICAO_DE_TEXTO`, `PROIBICAO_DE_PESSOA_REAL` e `FUNDO` (do Labs, sem mudar uma letra);
  `type ChaveDoEstilo = "cinema" | "ilustracao" | "comercial"`, `type EstiloDaImagem`, `ESTILOS` (os três),
  `ESTILO_PADRAO = "cinema"`; `type Atalho`, `ATALHOS` (os cinco, com o `/grafico` novo);
  `type LeituraDaDescricao`, `lerDescricao(descricao)`, `trechosEntreAspas(cena): { trechos; semPar }`;
  `pedeTextoNaImagem` (a lista do Labs); `MIN_DESCRICAO = 10`, `MAX_DESCRICAO = 600`,
  `MAX_TEXTO_ENTRE_ASPAS = 120`, `validarDescricao(descricao): ErroDeDescricao`; `textoExato(trechos)`;
  `montarPrompt(descricao)`, na ordem estilo, atalho, cena, fundo, pessoa real e texto.

- [ ] **Passo 1: os testes**

O teste das regras é reescrito inteiro (os casos do Labs saem; os do aviso de texto ficam):

Crie `tests/bonus-prompt-ilustracao.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ATALHOS,
  ESTILOS,
  ESTILO_PADRAO,
  FUNDO,
  MAX_DESCRICAO,
  MAX_TEXTO_ENTRE_ASPAS,
  MIN_DESCRICAO,
  PROIBICAO_DE_PESSOA_REAL,
  PROIBICAO_DE_TEXTO,
  lerDescricao,
  montarPrompt,
  pedeTextoNaImagem,
  textoExato,
  trechosEntreAspas,
  validarDescricao,
} from "@/lib/bonus/prompt-ilustracao";

// AS REGRAS DA IMAGEM DO CHAT (spec da Etapa 6, adendo de 09/10). Até o adendo, este arquivo era a cópia
// do teste do Labs; com as regras próprias, os casos são do Chat. Os do aviso de texto (`pedeTextoNaImagem`)
// vêm do Labs, porque a lista de termos é a de lá.

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const SPEC = readFileSync(`${RAIZ}/docs/specs/2026-10-09-criador-de-imagem.md`, "utf8").replace(/\r\n/g, "\n");

/** A cerca dos blocos de código, escrita assim para este arquivo caber num bloco do plano. */
const CERCA = "`".repeat(3);

/** O bloco de código logo depois de um rótulo do apêndice "Os pedidos da medição". */
function doApendice(rotulo: string): string {
  const i = SPEC.indexOf(rotulo, SPEC.indexOf("## Apêndice: os pedidos da medição"));
  if (i < 0) throw new Error(`${rotulo} não está no apêndice da spec`);
  const abre = `${CERCA}text\n`;
  const a = SPEC.indexOf(abre, i) + abre.length;
  return SPEC.slice(a, SPEC.indexOf(`\n${CERCA}`, a));
}

const estilo = (chave: string) => ESTILOS.find((e) => e.chave === chave)!;
const atalho = (chave: string) => ATALHOS.find((a) => a.chave === chave)!;

describe("o que foi medido é o que vai ao ar", () => {
  // ⚠️ O PEDIDO DA MEDIÇÃO DOS MODELOS (09/10) SAIU DESTAS REGRAS, e o Eduardo escolheu o modelo olhando
  // as imagens dele. Se o montarPrompt mudar uma letra, o que vai à OpenAI deixa de ser o medido.
  it.each([
    ["A", "**A descrição A**", "**O pedido A**"],
    ["B", "**A descrição B**", "**O pedido B**"],
  ])("o pedido %s do apêndice da spec sai byte a byte", (_, descricao, pedido) => {
    expect(montarPrompt(doApendice(descricao))).toBe(doApendice(pedido));
  });
});

describe("montarPrompt", () => {
  it("a ordem: estilo, atalho, cena, fundo, pessoa real e, por último, o texto", () => {
    const p = montarPrompt('/ilustracao /passo três etapas de um atendimento, com o post-it "FIM"');
    const posicoes = [
      p.indexOf(estilo("ilustracao").texto),
      p.indexOf(atalho("passo").texto),
      p.indexOf("três etapas de um atendimento"),
      p.indexOf(FUNDO),
      p.indexOf(PROIBICAO_DE_PESSOA_REAL),
      p.indexOf("Escreva na imagem exatamente"),
    ];
    expect(posicoes.every((x) => x >= 0)).toBe(true);
    expect([...posicoes].sort((a, b) => a - b)).toEqual(posicoes);
  });

  it("sem estilo na descrição, vale o /cinema", () => {
    expect(ESTILO_PADRAO).toBe("cinema");
    expect(montarPrompt("uma reunião de equipe ao fim da tarde").startsWith(estilo("cinema").texto)).toBe(true);
  });

  it.each(["cinema", "ilustracao", "comercial"])("o estilo /%s entra com o seu trecho, no começo", (chave) => {
    const p = montarPrompt(`/${chave} uma reunião de equipe ao fim da tarde`);
    expect(p.startsWith(estilo(chave).texto)).toBe(true);
    for (const outro of ESTILOS.filter((e) => e.chave !== chave)) expect(p).not.toContain(outro.texto);
  });

  it("sem aspas, a proibição de texto do Labs é a última coisa", () => {
    const p = montarPrompt("/cinema uma lousa numa sala de reunião vazia");
    expect(p.endsWith(PROIBICAO_DE_TEXTO)).toBe(true);
    expect(p).not.toContain("Escreva na imagem");
  });

  it("com aspas retas ou curvas, pede exatamente aqueles trechos, por último, com aspas retas", () => {
    const p = montarPrompt("/cinema um quadro com “AÇÕES” e um post-it \"META\" na parede");
    expect(p.endsWith(textoExato(["AÇÕES", "META"]))).toBe(true);
    expect(p).toContain('entre aspas: "AÇÕES"; "META". Cada um aparece uma vez');
    expect(p).not.toContain(PROIBICAO_DE_TEXTO);
  });

  it("o nome de marca entre aspas sai em letra simples, sem logo", () => {
    expect(textoExato(["ChatGPT"])).toContain(
      "Se um deles for o nome de uma marca ou de um produto, escreva-o em letras simples e comuns, sem o logotipo"
    );
    expect(textoExato(["ChatGPT"]).endsWith("Nenhum outro texto, letra, número ou logotipo em nenhuma parte da imagem.")).toBe(true);
  });

  it("a pessoa real e o fundo entram sempre, com aspas e sem aspas", () => {
    for (const d of ["/comercial uma vitrine à noite", '/comercial uma vitrine à noite com a placa "ABERTO"']) {
      expect(montarPrompt(d)).toContain(PROIBICAO_DE_PESSOA_REAL);
      expect(montarPrompt(d)).toContain(FUNDO);
    }
  });

  it("fecha a cena com ponto, sem duplicar, e junta os espaços", () => {
    expect(montarPrompt("uma mesa   de\n trabalho")).toContain(" uma mesa de trabalho. ");
    expect(montarPrompt("uma mesa de trabalho!")).toContain(" uma mesa de trabalho! ");
  });
});

describe("as regras que ficaram do Labs, sem mudar uma letra", () => {
  it("a proibição de texto", () => {
    expect(PROIBICAO_DE_TEXTO).toBe(
      "Toda superfície que poderia conter escrita — lousa, quadro branco, flip chart, projetor, " +
        "tela, cartaz, placa, papel — aparece EM BRANCO, ou apenas com linhas, barras e setas " +
        "desenhadas à mão, sem rótulo. Sem nenhum texto, sem letras, sem palavras, sem números e " +
        "sem logotipos em nenhuma parte da imagem."
    );
  });

  it("os atalhos do Labs, menos o /grafico", () => {
    expect(ATALHOS.map((a) => a.chave)).toEqual(["showcase", "marketing", "grafico", "passo", "antes-depois"]);
    expect(atalho("showcase").texto).toBe(
      "Composição de vitrine: o objeto principal centralizado e em destaque, visto de leve " +
        "perspectiva, com bastante ar em volta e nenhum elemento competindo com ele."
    );
    expect(atalho("marketing").texto).toBe(
      "Composição de campanha: uma pessoa em ação junto do objeto principal, gestos claros e " +
        "legíveis em miniatura, sugerindo uso e movimento."
    );
    expect(atalho("passo").texto).toBe(
      "Composição de fluxo: três ou quatro elementos na horizontal, ligados por setas " +
        "simples, lidos da esquerda para a direita como etapas de um processo."
    );
  });

  it("o /grafico aceita só os números e rótulos que estiverem entre aspas", () => {
    expect(atalho("grafico").texto).toBe(
      "Composição de dado: barras, setas ou blocos de tamanhos diferentes representando " +
        "comparação ou crescimento, sem eixos nem escala; números e rótulos, só os que estiverem " +
        "entre aspas na descrição."
    );
  });
});

describe("lerDescricao", () => {
  it("lê um estilo e um atalho no começo, em qualquer ordem e em maiúscula", () => {
    for (const d of ["/cinema /grafico três barras", "/GRAFICO /Cinema três barras"]) {
      const l = lerDescricao(d);
      expect([l.estilo.chave, l.atalho?.chave, l.cena, l.desconhecido, l.repetido]).toEqual(["cinema", "grafico", "três barras", null, null]);
    }
  });

  it("sem barra, a descrição inteira é a cena, com o estilo padrão", () => {
    const l = lerDescricao("  uma loja /cinema no meio  ");
    expect([l.estilo.chave, l.atalho, l.cena]).toEqual(["cinema", null, "uma loja /cinema no meio"]);
  });

  it("o que não existe e o que se repete ficam marcados", () => {
    expect(lerDescricao("/showkase uma caixa").desconhecido).toBe("showkase");
    expect(lerDescricao("/cinema /comercial uma loja").repetido).toBe("estilo");
    expect(lerDescricao("/passo /grafico uma tabela").repetido).toBe("atalho");
  });
});

describe("trechosEntreAspas", () => {
  it("lê aspas retas e curvas, na ordem, e ignora o vazio", () => {
    expect(trechosEntreAspas('um "A", um “B” e um ""')).toEqual({ trechos: ["A", "B"], semPar: false });
  });

  it("acusa a aspa sem par", () => {
    expect(trechosEntreAspas('um "A').semPar).toBe(true);
    expect(trechosEntreAspas("um A” solto").semPar).toBe(true);
    expect(trechosEntreAspas("um “A “B”").semPar).toBe(true);
  });
});

describe("validarDescricao", () => {
  const ok = { ok: true };

  it("recusa a cena vazia e a curta, contadas sem os atalhos e sem o texto entre aspas", () => {
    expect(validarDescricao("/cinema /grafico")).toEqual({ ok: false, mensagem: "Descreva o que a imagem deve mostrar." });
    expect(validarDescricao('/cinema "UM TEXTO BEM LONGO AQUI" ok').ok).toBe(false);
    expect(validarDescricao(`/cinema ${"x".repeat(MIN_DESCRICAO - 1)}`).ok).toBe(false);
    expect(validarDescricao(`/cinema ${"x".repeat(MIN_DESCRICAO)}`)).toEqual(ok);
  });

  it("recusa a descrição inteira acima do máximo e aceita exatamente nele", () => {
    expect(validarDescricao("x".repeat(MAX_DESCRICAO + 1)).ok).toBe(false);
    expect(validarDescricao("x".repeat(MAX_DESCRICAO))).toEqual(ok);
  });

  it("recusa o texto entre aspas acima de 120 e aceita exatamente nele", () => {
    const cena = "uma parede de escritório com um quadro";
    expect(validarDescricao(`${cena} "${"A".repeat(MAX_TEXTO_ENTRE_ASPAS + 1)}"`).ok).toBe(false);
    expect(validarDescricao(`${cena} "${"A".repeat(60)}" e "${"B".repeat(60)}"`)).toEqual(ok);
    expect(validarDescricao(`${cena} "${"A".repeat(61)}" e "${"B".repeat(60)}"`).ok).toBe(false);
  });

  it("recusa a aspa sem par, com a frase dela", () => {
    expect(validarDescricao('uma parede de escritório com "VENDAS')).toEqual({
      ok: false,
      mensagem: "Feche as aspas do texto que deve aparecer na imagem.",
    });
  });

  it("recusa o atalho que não existe, com os estilos e os atalhos que existem", () => {
    const r = validarDescricao("/showkase uma caixa em destaque na mesa");
    expect(r.ok).toBe(false);
    expect(r.ok ? "" : r.mensagem).toBe(
      "Não existe o atalho /showkase. Os estilos: /cinema, /ilustracao, /comercial. " +
        "Os atalhos: /showcase, /marketing, /grafico, /passo, /antes-depois."
    );
  });

  it("recusa dois estilos e dois atalhos", () => {
    expect(validarDescricao("/cinema /comercial uma loja iluminada à noite")).toEqual({ ok: false, mensagem: "Escolha um estilo só para a imagem." });
    expect(validarDescricao("/passo /grafico uma tabela de vendas")).toEqual({ ok: false, mensagem: "Use um atalho de composição só." });
  });
});

describe("pedeTextoNaImagem (a lista de termos do Labs)", () => {
  it("reconhece a descrição REAL que produziu a imagem torta no Labs", () => {
    const real =
      "Uma reunião de marketing discutindo sobre a queda da vendas organicas, uma pessoa triste por isso \n" +
      "na lousa/ projetor (uma dessas opções, estar escrito, Analise queda ORGANICA)";
    expect(pedeTextoNaImagem(real)).toBe("escrito");
  });

  it("NÃO dispara em escritório, que contém 'escrito'", () => {
    expect(pedeTextoNaImagem("uma reuniao num escritorio com quatro pessoas")).toBeNull();
    expect(pedeTextoNaImagem("uma reunião num escritório com quatro pessoas")).toBeNull();
  });

  it("mede a cena, e não os atalhos", () => {
    expect(pedeTextoNaImagem("/cinema /grafico tres barras subindo lado a lado")).toBeNull();
  });

  it("dispara em todos os termos da lista, um a um", () => {
    for (const t of ["escrito", "escreva", "texto", "letras", "palavra", "frase", "placa", "legenda"]) {
      expect(pedeTextoNaImagem(`uma cena com ${t} no meio`), `${t} deveria disparar`).not.toBeNull();
    }
  });
});
```

Em `tests/bonus-ilustracao-copia.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-ilustracao-copia.test.ts b/tests/bonus-ilustracao-copia.test.ts
index d1e2f98..c030a71 100644
--- a/tests/bonus-ilustracao-copia.test.ts
+++ b/tests/bonus-ilustracao-copia.test.ts
@@ -3,19 +3,19 @@ import { readFileSync } from "node:fs";
 import { fileURLToPath } from "node:url";
 import { describe, expect, it } from "vitest";
 
-// AS REGRAS DA IMAGEM SÃO AS DO LABS, BYTE A BYTE (spec da Etapa 6, "As regras, copiadas do Labs").
+// A TRADUÇÃO DAS RECUSAS DA OPENAI É A DO LABS, BYTE A BYTE (spec da Etapa 6, "As regras de estilo do
+// Chat", adendo de 09/10).
 //
-// O Chat copia os dois módulos puros da ilustração do Labs (site-ia, `src/lib/ia/`) sem mudar uma letra:
-// o estilo, as proibições, os atalhos e a tradução das recusas da OpenAI foram decididos pelo Eduardo lá,
-// entre 02/09 e 22/09. A conferência é a soma do git do arquivo (a mesma de `git hash-object` e do
+// `erro-ilustracao.ts` é o da dev do Labs em `69c079d`, de 09/10, com o filtro do pedaço da chave que a
+// OpenAI devolve no 401. A conferência é a soma do git do arquivo (a mesma de `git hash-object` e do
 // GitHub), e por isso a cópia não ganha nem um cabeçalho: a origem está aqui.
 //
-// - `prompt-ilustracao.ts` é o da main do Labs em `672ee71` (igual na dev);
-// - `erro-ilustracao.ts` é o da dev do Labs em `69c079d`, de 09/10: o filtro do pedaço da chave que a
-//   OpenAI devolve no 401, achado neste ensaio e decidido pelo Eduardo no Labs. Ele chega à main de lá no
-//   próximo deploy deles.
+// ⚠️ ATÉ O ADENDO, `prompt-ilustracao.ts` TAMBÉM ESTAVA AQUI (o da main do Labs em `672ee71`, blob
+// `d993e809`). Em 09/10 o Eduardo decidiu que o Chat tem regras de estilo próprias, e ele saiu desta
+// trava; as regras dele são conferidas em tests/bonus-prompt-ilustracao.test.ts. A recusa da OpenAI não é
+// estilo, e continua igual nos dois lados.
 //
-// MUDAR UMA REGRA NUM LADO SÓ DERRUBA ESTE TESTE, e é para derrubar. A mudança se combina com o Labs
+// MUDAR A TRADUÇÃO NUM LADO SÓ DERRUBA ESTE TESTE, e é para derrubar. A mudança se combina com o Labs
 // (acordo de 08/10) e se faz nos dois; quando o Labs mudar o dele, ele avisa, e a cópia nova troca a
 // soma daqui.
 const RAIZ = fileURLToPath(new URL("..", import.meta.url));
@@ -29,11 +29,8 @@ function somaDoGit(relativo: string): string {
     .digest("hex");
 }
 
-describe("as regras da imagem, copiadas do Labs", () => {
-  it.each([
-    ["lib/bonus/prompt-ilustracao.ts", "d993e8099f1b630ccd7e3ad5034f5552334b4f10"],
-    ["lib/bonus/erro-ilustracao.ts", "6a5e8f55c82a871563498c9e4622a8b3f27b3566"],
-  ])("%s é o arquivo do Labs, byte a byte", (arquivo, soma) => {
+describe("a tradução das recusas, copiada do Labs", () => {
+  it.each([["lib/bonus/erro-ilustracao.ts", "6a5e8f55c82a871563498c9e4622a8b3f27b3566"]])("%s é o arquivo do Labs, byte a byte", (arquivo, soma) => {
     expect(somaDoGit(arquivo)).toBe(soma);
   });
 });
```

Em `testes-dom/bonus-gerar-imagem.dom.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-dom/bonus-gerar-imagem.dom.tsx b/testes-dom/bonus-gerar-imagem.dom.tsx
index 287fa86..284e31b 100644
--- a/testes-dom/bonus-gerar-imagem.dom.tsx
+++ b/testes-dom/bonus-gerar-imagem.dom.tsx
@@ -13,7 +13,7 @@ import {
   textoDoContador,
   type AvisoDoPedidoDeImagem,
 } from "@/lib/bonus/imagem-textos";
-import { ESTILOS } from "@/lib/bonus/prompt-ilustracao";
+import { ATALHOS } from "@/lib/bonus/prompt-ilustracao";
 
 // O CRIADOR DE IMAGEM NA TELA (spec da Etapa 6, "A tela" e "Pedir e acompanhar"): o botão em cada slide com
 // espaço, o campo com os atalhos do Labs, o aviso de texto, o contador do dia, o pedido que volta na hora,
@@ -146,7 +146,7 @@ describe("o campo da cena", () => {
     renderizar();
     abrir(2);
     expect(campo(2)).toBeTruthy();
-    for (const e of ESTILOS) expect(within(card(2)).getByText(`/${e.chave}`)).toBeTruthy();
+    for (const a of ATALHOS) expect(within(card(2)).getByText(`/${a.chave}`)).toBeTruthy();
     expect(within(card(2)).getByText(textoDoContador(3))).toBeTruthy();
   });
 
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-prompt-ilustracao.test.ts tests/bonus-ilustracao-copia.test.ts tests/bonus-erro-ilustracao.test.ts
npx vitest run --config vitest.dom.config.ts testes-dom/bonus-gerar-imagem.dom.tsx
```

Esperado: nos puros, 22 caem e 18 passam (40), só no arquivo das regras: o que não existe ainda (os
estilos, os atalhos, `lerDescricao`, `trechosEntreAspas`, `textoExato`) e os pedidos medidos. Passam antes,
de propósito, os que protegem o que fica igual ao Labs (item 4 do ensaio do adendo), a cópia da tradução e
o teste do Labs dela. Na tela, 1 cai e 11 passam (12): a lista dos atalhos.

- [ ] **Passo 3: o código**

O arquivo das regras é reescrito inteiro (as três regras do Labs, os atalhos e a lista de termos ficam,
com o comentário deles):

Crie `lib/bonus/prompt-ilustracao.ts`:

```ts
// AS REGRAS DA IMAGEM DO CHAT (spec da Etapa 6, adendo de 09/10, "As regras de estilo do Chat"). PURO,
// para ser testável fora do módulo que chama a API.
//
// ⚠️ ESTE ARQUIVO NASCEU DA CÓPIA DO LABS, E SE SEPAROU DELE EM 09/10. Até ali ele era, byte a byte, o
// `src/lib/ia/prompt-ilustracao.ts` do Labs (main 672ee71, blob d993e809), feito para as ilustrações do
// site. A primeira imagem real do Chat saiu com "cara de IA", e as seis referências que o Eduardo mandou
// dos carrosséis pediam o contrário daquelas regras: texto em português dentro da imagem, luz de cinema,
// a cena como metáfora do post. Ele decidiu, pela caixa, que o Chat tem regras próprias. Ficaram do Labs,
// sem mudar uma letra, a proibição de texto (quando não há aspas), a de pessoa real e de marca (o manual
// do perfil) e a cena de borda a borda; os atalhos de composição ficaram, com o `/grafico` ajustado.
// A tradução das recusas da OpenAI (`erro-ilustracao.ts`) continua cópia do Labs.
//
// A pessoa digita a CENA, e pode começar por um estilo e um atalho (`/cinema /antes-depois …`). O
// estilo, a composição, o fundo e as proibições são acrescentados aqui. O texto que deve aparecer na
// imagem vai ENTRE ASPAS, e só ele aparece.
//
// ⚠️ NÃO há chamada ao Claude para "melhorar" a descrição, como no Labs.

// A REGRA DO TEXTO, QUANDO A DESCRIÇÃO NÃO TEM ASPAS. O bloco abaixo é o do Labs, sem mudar uma letra
// (inclusive o comentário). No Chat, com trechos entre aspas, o lugar dela é de `textoExato`, que pede
// exatamente aqueles trechos e mais nenhum texto; as duas vão por último, pelo mesmo motivo.
/**
 * A regra que não é opcional: PROIBIR TEXTO.
 *
 * ⚠️ **ELA COMEÇA AFIRMANDO, E ISSO NÃO É ESTILO DE REDAÇÃO — É O QUE FAZ A REGRA PEGAR.**
 *
 * Até 22/09 ela era só negação: *"Sem nenhum texto, sem letras, sem palavras…"*. Em 21/09 o
 * Eduardo gerou uma cena de reunião **sem pedir texto nenhum**, e a lousa saiu escrita
 * `VENDAS ORGANICAS` — sem o circunflexo. A proibição estava no prompt, no fim, e perdeu.
 *
 * **Modelo de imagem obedece mal a negação.** "Sem texto" compete com "lousa" e "gráfico", que
 * são superfícies que pedem escrita, e a superfície ganha: o modelo desenha a cena plausível e
 * a proibição vira um detalhe contra a física do quadro. A forma que funciona é dizer o que a
 * superfície DEVE ser — em branco, ou com linha e seta sem rótulo —, porque isso ele consegue
 * desenhar. A negação fica junto, como segunda linha, e não como única.
 *
 * ⚠️ E a lista de superfícies é NOMEADA de propósito. "Sem texto" genérico não diz ao modelo
 * ONDE ele está prestes a escrever; "a lousa aparece em branco" diz.
 *
 * Modelo de imagem escreve ilegível — troca letra, inventa acento, e é pior em português.
 * O carrossel inteiro foi desenhado para o texto ser composto por código justamente por
 * isso; deixar o modelo escrever aqui desfaria essa decisão dentro da própria peça, e do
 * jeito mais visível possível, porque a palavra torta fica no meio da arte.
 *
 * Vai no FIM do prompt de propósito: é a última coisa que o modelo lê.
 */
export const PROIBICAO_DE_TEXTO =
  "Toda superfície que poderia conter escrita — lousa, quadro branco, flip chart, projetor, " +
  "tela, cartaz, placa, papel — aparece EM BRANCO, ou apenas com linhas, barras e setas " +
  "desenhadas à mão, sem rótulo. Sem nenhum texto, sem letras, sem palavras, sem números e " +
  "sem logotipos em nenhuma parte da imagem.";

// A REGRA DO MANUAL DO PERFIL, DO LABS, SEM MUDAR UMA LETRA. O Eduardo a manteve no Chat em 09/10:
// pessoa real, figura pública e marca continuam proibidas, e a tela a mostra junto do campo.
/**
 * A outra regra que não é opcional: NINGUÉM RECONHECÍVEL.
 *
 * Vem do manual do perfil, trazido pelo Eduardo em 02/09: foto de figura pública não pode
 * ser usada, e ilustração de ícone entra no lugar. É restrição de direito de imagem, não de
 * estética — e um post publicado com o rosto de alguém identificável é problema jurídico
 * que nenhum ajuste de arte desfaz depois.
 *
 * ⚠️ **PROÍBE PESSOA RECONHECÍVEL, NÃO PESSOA.** A distinção é obrigatória: o atalho
 * `/marketing` PEDE "uma pessoa em ação". Uma proibição escrita como "sem pessoas"
 * contradiria o próprio atalho logo acima dela no prompt, e o modelo entrega imagem confusa
 * em vez de recusar — o mesmo modo de falha de um atalho que pede o que a proibição de texto
 * veta.
 *
 * ⚠️ **A REDAÇÃO MUDOU EM 21/09, E A MUDANÇA AFROUXA UM POUCO — DE PROPÓSITO E COM CUSTO.**
 * Ela dizia "genéricas e estilizadas, **sem traços faciais identificáveis**", que fazia
 * sentido no estilo vetorial plano. Em fotografia, pedir rosto não identificável produz
 * gente borrada ou de costas, que é pior que o problema.
 *
 * O que a regra protege — **direito de imagem** — continua inteiro e ficou mais explícito:
 * pessoa fictícia e anônima, nenhuma semelhança com quem existe, e agora também **sem marca,
 * logotipo ou uniforme identificável**, que a redação antiga não cobria. O que se perdeu é a
 * proteção de segunda linha que o rosto sem traço dava de graça: hoje a peça sai com rostos
 * nítidos de pessoas inventadas, e quem confere se alguma saiu parecida com alguém é quem
 * revisa antes de publicar.
 *
 * Fica ao lado da proibição de texto, no fim: é o que não fazer, e é a última coisa lida.
 */
export const PROIBICAO_DE_PESSOA_REAL =
  "As pessoas retratadas devem ser fictícias e anônimas, sem semelhança com ninguém " +
  "existente. Nunca retrate pessoa real, figura pública, celebridade, político ou sósia de " +
  "alguém existente, e não reproduza marca, logotipo ou uniforme identificável.";

/** As chaves dos três estilos do Chat. */
export type ChaveDoEstilo = "cinema" | "ilustracao" | "comercial";

/** Um estilo da imagem: o que a tela mostra (`rotulo`, `resumo`) e o trecho que vai à OpenAI (`texto`). */
export type EstiloDaImagem = { chave: ChaveDoEstilo; rotulo: string; resumo: string; texto: string };

/**
 * OS TRÊS ESTILOS, escolhidos por slide (decisão do Eduardo em 09/10, depois das referências). O
 * "objeto 3D em fundo claro" ficou de fora.
 *
 * ⚠️ **O LABS TINHA UM ESTILO SÓ, E O MOTIVO VALE COMO HISTÓRICO:** "dez slides com dez estéticas leem
 * como colagem". As referências dos carrosséis do Chat mostram o contrário, um jeito por post, e o
 * Eduardo escolheu três. O que o Labs aprendeu continua dentro de cada um: descrever a luz e a ÓPTICA,
 * e não adjetivo de qualidade ("foto realista de alta qualidade" o modelo já acha que cumpre); pedir
 * pele com poros contra a pele de plástico; e pedir as mãos repousadas ou fora do primeiro plano, que é
 * a única coisa que o prompt faz pelos dedos ("modelo não obedece negativa; obedece enquadramento"). A
 * alavanca forte contra artefato é o modelo e a qualidade, escolhidos pela medição do adendo.
 *
 * Os textos são os da tabela da spec, e os pedidos medidos do apêndice saem deles: um teste confere.
 */
export const ESTILOS: EstiloDaImagem[] = [
  {
    chave: "cinema",
    rotulo: "Cena de cinema",
    resumo: "foto realista, luz dramática e contraste forte",
    texto:
      "Fotografia realista com cara de cena de cinema, num ambiente de trabalho brasileiro contemporâneo. " +
      "Luz dramática e quente, de abajur, de janela no fim da tarde ou de tela, com sombras profundas e " +
      "contraste forte; fundo levemente desfocado. Cores ricas e naturais. Pele com textura real, poros e " +
      "pequenas imperfeições, sem brilho oleoso e sem retoque. Expressões claras e postura natural, com as " +
      "mãos repousadas ou fora do primeiro plano. Sem aparência de render 3D, de desenho ou de banco de " +
      "imagens.",
  },
  {
    chave: "ilustracao",
    rotulo: "Ilustração conceitual",
    resumo: "uma metáfora desenhada, com textura",
    texto:
      "Ilustração conceitual digital, com acabamento de peça editorial: uma metáfora visual clara do " +
      "assunto, feita de objetos simbólicos, ícones simples, post-its, fios e setas, sobre fundo com " +
      "textura de papel. Cores vivas e harmônicas, sombras suaves, traço limpo e volume leve. Não é foto " +
      "nem render 3D realista.",
  },
  {
    chave: "comercial",
    rotulo: "Ambiente comercial brilhante",
    resumo: "loja, vitrine ou fachada iluminada",
    texto:
      "Fotografia realista de ambiente comercial bem iluminado: loja, vitrine, balcão ou fachada, com luz " +
      "quente de spots, reflexos no chão e no vidro, produtos organizados e brilho convidativo de vitrine. " +
      "Cores quentes e saturadas na medida, nitidez de foto profissional. Fachadas, caixas e produtos sem " +
      "nome, sem marca e sem logotipo visível.",
  },
];

/** Sem estilo na descrição, vale este; a tela sempre manda um. */
export const ESTILO_PADRAO: ChaveDoEstilo = "cinema";

// A CENA DE BORDA A BORDA, DO LABS, SEM MUDAR UMA LETRA.
/**
 * O cenário, e ele OCUPA O RETÂNGULO INTEIRO.
 *
 * ⚠️ **CHAMAVA-SE `FUNDO_TRANSPARENTE` ATÉ 21/09, e a razão de então era boa:** o slide tem dois
 * fundos possíveis (claro e escuro) e a escolha acontece na hora de baixar, DEPOIS de a
 * ilustração existir. Com fundo opaco, gerar no claro e baixar no escuro deixaria um
 * retângulo branco colado no meio da arte.
 *
 * **A razão caiu junto com o estilo vetorial.** Fotografia preenche os 3:2 de ponta a ponta,
 * então não há fundo aparecendo atrás dela para brigar com o tema — é assim que as peças
 * publicadas da conta são. O que a transparência protegia deixou de existir.
 *
 * ⚠️ E ela cobrava um preço que só apareceu na tela: com fundo transparente o desenho flutua
 * na caixa, e quando o texto transborda os dois se sobrepõem. Foi o "mal posicionada" que o
 * Eduardo apontou em 21/09.
 */
export const FUNDO =
  "A cena deve preencher todo o quadro, de borda a borda, sem moldura, sem borda branca e " +
  "sem fundo liso sobrando.";

// OS ATALHOS DE COMPOSIÇÃO, DO LABS. No Labs chamavam-se `ESTILOS` (era a única escolha); no Chat, o
// estilo é a estética e o atalho é a composição. Os textos são os do Labs, menos o do `/grafico`, que
// passa a aceitar os números e rótulos que o operador escreve entre aspas (adendo de 09/10).
/**
 * ATALHOS DE COMPOSIÇÃO, escritos com barra no começo da descrição: `/showcase uma caixa…`.
 *
 * Pedido pelo Eduardo em 02/09, com a pergunta certa junto: "não sei se tem como aplicar na
 * API". **Tem, e é mais simples do que parece.** No ChatGPT a barra não é recurso do
 * modelo: é um texto guardado que ele cola antes do seu. Pela API é a mesma coisa — o
 * atalho vira um trecho de prompt, e este arquivo já fazia isso com o estilo fixo.
 *
 * ⚠️ **O QUE O ATALHO MUDA É O ENQUADRAMENTO, NÃO A ESTÉTICA.** O estilo escolhido (`ESTILOS`, acima)
 * vale com qualquer atalho: a mesma luz, o mesmo acabamento. Isso é deliberado e contraria o impulso
 * de deixar cada atalho com a cara dele — dez slides com dez estéticas leem como colagem, e
 * a sequência precisa parecer uma coisa só. O atalho decide O QUE aparece e COMO está
 * composto; a linguagem visual não se mexe.
 *
 * Nenhum deles pede texto por conta própria: um atalho que pede o que a regra do texto proíbe
 * logo abaixo produz imagem confusa em vez de recusa. No Chat, o `/grafico` aceita os números e
 * rótulos que o operador escreve entre aspas, e só esses (adendo de 09/10).
 */
export type Atalho = {
  chave: string;
  /** Nome curto, para a lista. */
  rotulo: string;
  /**
   * O que o atalho faz, em uma frase, **para aparecer na tela**.
   *
   * ⚠️ Não é o `texto`: aquele é escrito para o modelo de imagem e tem 200 caracteres de
   * jargão de composição. Este é para a pessoa, e precisa caber numa linha.
   *
   * Existe porque a explicação estava só num `title` de hover — que não existe no celular, e
   * que este projeto já rejeitou por escrito duas vezes ("o motivo VISÍVEL, não num
   * tooltip"). `/showcase` até se adivinha; `/passo` e `/grafico` não dizem nada a quem
   * chega, e a instrução do projeto assume que quem opera esta tela não acompanha as
   * conversas onde os atalhos foram decididos.
   */
  resumo: string;
  /** O trecho que entra no prompt da imagem. Escrito para o modelo, não para a pessoa. */
  texto: string;
};

export const ATALHOS: Atalho[] = [
  {
    chave: "showcase",
    resumo: "O objeto centralizado e em destaque, com ar em volta e nada competindo.",
    rotulo: "Vitrine do produto",
    texto:
      "Composição de vitrine: o objeto principal centralizado e em destaque, visto de leve " +
      "perspectiva, com bastante ar em volta e nenhum elemento competindo com ele.",
  },
  {
    chave: "marketing",
    resumo: "Uma pessoa em ação junto do objeto, sugerindo uso e movimento.",
    rotulo: "Cena de divulgação",
    texto:
      "Composição de campanha: uma pessoa em ação junto do objeto principal, gestos claros e " +
      "legíveis em miniatura, sugerindo uso e movimento.",
  },
  {
    chave: "grafico",
    resumo: "Barras ou blocos comparando tamanhos; números e rótulos, só os que você puser entre aspas.",
    rotulo: "Dados e comparação",
    texto:
      "Composição de dado: barras, setas ou blocos de tamanhos diferentes representando " +
      "comparação ou crescimento, sem eixos nem escala; números e rótulos, só os que estiverem " +
      "entre aspas na descrição.",
  },
  {
    chave: "passo",
    resumo: "Três ou quatro elementos ligados por setas, lidos da esquerda para a direita.",
    rotulo: "Sequência de etapas",
    texto:
      "Composição de fluxo: três ou quatro elementos na horizontal, ligados por setas " +
      "simples, lidos da esquerda para a direita como etapas de um processo.",
  },
  {
    chave: "antes-depois",
    resumo: "Duas metades: à esquerda o desorganizado, à direita o mesmo resolvido.",
    rotulo: "Antes e depois",
    texto:
      "Composição em duas metades separadas por uma linha vertical: à esquerda o estado " +
      "desorganizado, à direita o mesmo assunto resolvido e em ordem.",
  },
];

const ESTILO_POR_CHAVE = new Map(ESTILOS.map((e) => [e.chave as string, e]));
const ATALHO_POR_CHAVE = new Map(ATALHOS.map((a) => [a.chave, a]));

/** A descrição lida: o estilo (o padrão, se não veio), o atalho, a cena e o que deu errado no começo. */
export type LeituraDaDescricao = {
  estilo: EstiloDaImagem;
  atalho: Atalho | null;
  /** A cena, já sem os atalhos do começo. É ela que passa pelas regras de tamanho. */
  cena: string;
  /** O que veio depois de uma barra e não é estilo nem atalho. */
  desconhecido: string | null;
  /** Dois estilos, ou dois atalhos, no começo. */
  repetido: "estilo" | "atalho" | null;
};

/**
 * Separa o estilo e o atalho da cena: no começo da descrição, até um de cada, em qualquer ordem.
 *
 * ⚠️ ATALHO DESCONHECIDO NÃO É IGNORADO nem vira cena (a lição do Labs): ignorar faz a pessoa achar que
 * o estilo foi aplicado, e virar cena manda o modelo desenhar a palavra.
 */
export function lerDescricao(descricao: string): LeituraDaDescricao {
  let resto = descricao.trim();
  let estilo: EstiloDaImagem | null = null;
  let atalho: Atalho | null = null;
  let desconhecido: string | null = null;
  let repetido: LeituraDaDescricao["repetido"] = null;
  for (;;) {
    const m = /^\/([a-z-]+)\s*([\s\S]*)$/i.exec(resto);
    if (!m) break;
    const chave = m[1].toLowerCase();
    const comoEstilo = ESTILO_POR_CHAVE.get(chave);
    const comoAtalho = ATALHO_POR_CHAVE.get(chave);
    if (comoEstilo) {
      if (estilo) repetido ??= "estilo";
      estilo = comoEstilo;
    } else if (comoAtalho) {
      if (atalho) repetido ??= "atalho";
      atalho = comoAtalho;
    } else {
      desconhecido ??= chave;
    }
    resto = m[2];
  }
  return { estilo: estilo ?? ESTILO_POR_CHAVE.get(ESTILO_PADRAO)!, atalho, cena: resto.trim(), desconhecido, repetido };
}

/**
 * Os trechos entre aspas da cena, retas (`"…"`) ou curvas (`“…”`), na ordem em que aparecem; e se
 * alguma aspa ficou sem par. Trecho vazio (`""`) não conta.
 */
export function trechosEntreAspas(cena: string): { trechos: string[]; semPar: boolean } {
  const trechos: string[] = [];
  let aberto: string | null = null;
  for (const c of cena) {
    if (aberto === null) {
      if (c === '"' || c === "“") aberto = "";
      else if (c === "”") return { trechos, semPar: true };
    } else if (c === '"' || c === "”") {
      if (aberto.length > 0) trechos.push(aberto);
      aberto = null;
    } else if (c === "“") {
      return { trechos, semPar: true };
    } else {
      aberto += c;
    }
  }
  return { trechos, semPar: aberto !== null };
}

/**
 * Termos que denunciam um pedido de TEXTO DENTRO da imagem.
 *
 * ⚠️ **ESTA LISTA NASCEU DE UM CASO REAL, em 21/09.** O Eduardo descreveu *"na lousa/projetor
 * (uma dessas opções, estar escrito, Analise queda ORGANICA)"*, e o prompt que saiu daqui
 * terminava com *"Sem nenhum texto, sem letras, sem palavras"*. **O prompt se contradiz**, o
 * modelo obedeceu a descrição, e a imagem saiu com `ORGÁNICA` — acento errado, que é
 * exatamente o que a proibição existe para evitar.
 *
 * ⚠️ **O CÓDIGO JÁ TINHA PREVISTO ESSA ARMADILHA, para o lado errado.** O comentário dos
 * `ESTILOS` diz: *"um atalho que pede o que o prompt proíbe logo abaixo produz imagem confusa
 * em vez de recusa"*. A regra valia para os atalhos que nós escrevemos e **nunca foi aplicada
 * à descrição que a pessoa digita** — que é a única das duas que muda todo dia.
 *
 * ⚠️ **E A TELA JÁ "AVISAVA", sem servir para nada.** Ela dizia *"a proibição de texto na
 * imagem já é acrescentada — não precisa pedir"*. Isso lê como **"nós cuidamos disso"**, não
 * como **"não funciona se você pedir"**. Aviso que descreve o mecanismo em vez da consequência
 * não muda comportamento nenhum.
 */
const PEDIDOS_DE_TEXTO = [
  "escrito",
  "escrita",
  "escritos",
  "escritas",
  "escreva",
  "escrever",
  "escrevendo",
  "texto",
  "letras",
  "palavra",
  "palavras",
  "números",
  "numeros",
  "título",
  "titulo",
  "legenda",
  "rótulo",
  "rotulo",
  "frase",
  "dizeres",
  "placa",
] as const;

/**
 * O termo que faz a descrição pedir texto na imagem, ou `null`.
 *
 * ⚠️ **NÃO É VALIDAÇÃO, é aviso — e a separação é deliberada.** `validarDescricao` decide se o
 * botão pode ser clicado; isto só explica um risco. Detecção por palavra erra, e travar quem
 * escreveu "a placa da porta" seria pior que a imagem torta que ela evita. Decidido pelo
 * Eduardo em 21/09, que pediu explicitamente um aviso e não um bloqueio.
 *
 * ⚠️ **A FRONTEIRA NÃO PODE SER `\b`.** O `\b` do JavaScript é ASCII: "órgão" e "título"
 * quebram nos acentos e o casamento sai onde não devia. Este projeto já perdeu 317 skills de
 * cobertura por isso. A forma que funciona é `[^\wÀ-ÿ]` dos dois lados — e é ela que faz
 * **"escritório" não casar com "escrito"**, que seria o falso positivo mais provável aqui.
 */
export function pedeTextoNaImagem(descricao: string): string | null {
  const cena = lerDescricao(descricao).cena;
  for (const termo of PEDIDOS_DE_TEXTO) {
    const re = new RegExp(`(^|[^\\wÀ-ÿ])${termo}(?=[^\\wÀ-ÿ]|$)`, "i");
    if (re.test(cena)) return termo;
  }
  return null;
}

export const MIN_DESCRICAO = 10;
export const MAX_DESCRICAO = 600;
/** O texto entre aspas, somado: mais do que isso, o modelo erra letras e a imagem vira cartaz. */
export const MAX_TEXTO_ENTRE_ASPAS = 120;

export type ErroDeDescricao = { ok: true } | { ok: false; mensagem: string };

/**
 * Confere a descrição ANTES de gastar uma chamada (spec, "A conferência da descrição"). Uma recusa aqui
 * custa zero; uma imagem inútil custa dinheiro e uma unidade do teto do dia.
 *
 * A CENA que se mede, para o mínimo, é a de sem os atalhos e sem o texto entre aspas: "/cinema "VENDAS""
 * passaria de raspão e geraria uma imagem vaga.
 */
export function validarDescricao(descricao: string): ErroDeDescricao {
  const lida = lerDescricao(descricao);
  if (lida.desconhecido) {
    return {
      ok: false,
      mensagem:
        `Não existe o atalho /${lida.desconhecido}. ` +
        `Os estilos: ${ESTILOS.map((e) => `/${e.chave}`).join(", ")}. ` +
        `Os atalhos: ${ATALHOS.map((a) => `/${a.chave}`).join(", ")}.`,
    };
  }
  if (lida.repetido === "estilo") return { ok: false, mensagem: "Escolha um estilo só para a imagem." };
  if (lida.repetido === "atalho") return { ok: false, mensagem: "Use um atalho de composição só." };
  if (descricao.trim().length > MAX_DESCRICAO) {
    return {
      ok: false,
      mensagem: `A descrição passou de ${MAX_DESCRICAO} caracteres. Descreva uma cena só — quanto mais coisa, menos o modelo acerta cada uma.`,
    };
  }
  const aspas = trechosEntreAspas(lida.cena);
  if (aspas.semPar) return { ok: false, mensagem: "Feche as aspas do texto que deve aparecer na imagem." };
  if (aspas.trechos.join("").length > MAX_TEXTO_ENTRE_ASPAS) {
    return {
      ok: false,
      mensagem: `O texto entre aspas passou de ${MAX_TEXTO_ENTRE_ASPAS} caracteres. Encurte: texto longo sai com erro e vira cartaz.`,
    };
  }
  const semAspas = lida.cena.replace(/["“][^"”]*["”]/g, " ").replace(/\s+/g, " ").trim();
  if (semAspas.length === 0) return { ok: false, mensagem: "Descreva o que a imagem deve mostrar." };
  if (semAspas.length < MIN_DESCRICAO) {
    return {
      ok: false,
      mensagem: `Descreva com um pouco mais de detalhe — pelo menos ${MIN_DESCRICAO} caracteres. Descrição vaga gera imagem vaga, e a chamada é paga.`,
    };
  }
  return { ok: true };
}

/**
 * A REGRA DO TEXTO, QUANDO HÁ ASPAS: escrever exatamente aqueles trechos, com os acentos, e mais nenhum
 * texto. O nome de marca entre aspas sai em letra simples, sem logo (decisão do Eduardo na revisão do
 * adendo): o Chat não reconhece toda marca, então não recusa; diz ao modelo como escrever.
 */
export function textoExato(trechos: string[]): string {
  return (
    "Escreva na imagem exatamente estes textos, em português do Brasil, com a grafia, as maiúsculas e os " +
    `acentos exatamente como estão entre aspas: ${trechos.map((t) => `"${t}"`).join("; ")}. Cada um aparece ` +
    "uma vez, legível, numa superfície que faça sentido na cena (placa, tela, papel, quadro, post-it ou " +
    "rótulo). Se um deles for o nome de uma marca ou de um produto, escreva-o em letras simples e comuns, " +
    "sem o logotipo, o ícone, as cores ou a fonte da marca. Nenhum outro texto, letra, número ou logotipo " +
    "em nenhuma parte da imagem."
  );
}

/**
 * MONTA O PEDIDO: estilo, atalho, cena, fundo, pessoa real e, por último, o texto (a ordem decidida pelo
 * Eduardo na revisão do adendo). O texto e as proibições ficam no fim porque "é a última coisa que o
 * modelo lê" (o Labs). Juntados por um espaço, a cena com ponto final, como no Labs.
 *
 * ⚠️ OS PEDIDOS DA MEDIÇÃO (o apêndice da spec) SAEM DAQUI BYTE A BYTE, e um teste confere: o que foi
 * medido é o que vai ao ar.
 */
export function montarPrompt(descricao: string): string {
  const lida = lerDescricao(descricao);
  const cena = lida.cena.replace(/\s+/g, " ").trim();
  const comPonto = /[.!?]$/.test(cena) ? cena : `${cena}.`;
  const { trechos } = trechosEntreAspas(cena);
  return [
    lida.estilo.texto,
    ...(lida.atalho ? [lida.atalho.texto] : []),
    comPonto,
    FUNDO,
    PROIBICAO_DE_PESSOA_REAL,
    trechos.length > 0 ? textoExato(trechos) : PROIBICAO_DE_TEXTO,
  ].join(" ");
}
```

Em `app/bonus/[id]/carrossel/[cid]/gerar-imagem.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/[id]/carrossel/[cid]/gerar-imagem.tsx b/app/bonus/[id]/carrossel/[cid]/gerar-imagem.tsx
index bf47717..630dba4 100644
--- a/app/bonus/[id]/carrossel/[cid]/gerar-imagem.tsx
+++ b/app/bonus/[id]/carrossel/[cid]/gerar-imagem.tsx
@@ -12,7 +12,7 @@ import {
   textoDoPedidoDeTexto,
   type AvisoDoPedidoDeImagem,
 } from "@/lib/bonus/imagem-textos";
-import { ESTILOS, pedeTextoNaImagem } from "@/lib/bonus/prompt-ilustracao";
+import { ATALHOS, pedeTextoNaImagem } from "@/lib/bonus/prompt-ilustracao";
 
 // O "GERAR IMAGEM" DE UM SLIDE (spec da Etapa 6, "A tela" e "Pedir e acompanhar"), na linha dos botões da
 // imagem do card, ao lado do "Subir foto" e do "Slide pronto do Canva".
@@ -157,7 +157,7 @@ export default function GerarImagem({
               />
               {/* Os atalhos em linhas, e não numa lista: os cards já são os itens da lista da página. */}
               <div className={`${hint} space-y-0.5`}>
-                {ESTILOS.map((e) => (
+                {ATALHOS.map((e) => (
                   <p key={e.chave}>
                     <code>{`/${e.chave}`}</code> {e.rotulo}: {e.resumo}
                   </p>
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx eslint lib/bonus/prompt-ilustracao.ts "app/bonus/[id]/carrossel/[cid]/gerar-imagem.tsx" tests/bonus-prompt-ilustracao.test.ts tests/bonus-ilustracao-copia.test.ts testes-dom/bonus-gerar-imagem.dom.tsx
npx vitest run tests/bonus-prompt-ilustracao.test.ts tests/bonus-ilustracao-copia.test.ts tests/bonus-erro-ilustracao.test.ts
npx vitest run --config vitest.dom.config.ts testes-dom/bonus-gerar-imagem.dom.tsx
npm test
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-imagem-processo.integracao.ts
```

Esperado: `tsc` e lint limpos; os 40 puros e os 12 de tela passam; a suíte pura com 116 arquivos e 3 201
casos; `[rede-global] ALVO: banco de TESTE`, e os 23 do processo passam (as descrições dele passam pela
regra nova).

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/prompt-ilustracao.ts "app/bonus/[id]/carrossel/[cid]/gerar-imagem.tsx" tests/bonus-prompt-ilustracao.test.ts tests/bonus-ilustracao-copia.test.ts testes-dom/bonus-gerar-imagem.dom.tsx
test "$(git branch --show-current)" = "criador-de-imagem"
git add lib/bonus/prompt-ilustracao.ts "app/bonus/[id]/carrossel/[cid]/gerar-imagem.tsx" tests/bonus-prompt-ilustracao.test.ts tests/bonus-ilustracao-copia.test.ts testes-dom/bonus-gerar-imagem.dom.tsx
git commit -m "feat(bonus): as regras de estilo do Chat, com os pedidos medidos byte a byte"
```

---

### FASE 6.11 — O modelo novo, na versão medida

**Arquivos:**
- Modificar: `lib/bonus/imagem-openai.ts` (o `CORPO_FIXO` e os comentários)
- Testar: `tests/bonus-imagem-openai.test.ts`

**Interfaces:**
- Produz: `CORPO_FIXO` com `model: "gpt-image-2.5-flare-2026-09-08"` e `quality: "high"`; o resto igual
  (`1536x1024`, `n: 1`, `background: "opaque"`, `output_format: "jpeg"`, `output_compression: 90`).

- [ ] **Passo 1: o teste**

Em `tests/bonus-imagem-openai.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-imagem-openai.test.ts b/tests/bonus-imagem-openai.test.ts
index 949355e..02d9415 100644
--- a/tests/bonus-imagem-openai.test.ts
+++ b/tests/bonus-imagem-openai.test.ts
@@ -12,8 +12,9 @@ import {
 import { montarPrompt } from "@/lib/bonus/prompt-ilustracao";
 
 // A CHAMADA À OPENAI (spec da Etapa 6, "A chamada à OpenAI"), com um `fetch` falso: nada sai desta
-// máquina. O corpo é o do Labs (lib/bonus/prompt-ilustracao.ts embrulha a cena), com uma diferença: o
-// JPEG, porque a foto do espaço do Chat é JPEG de até 2 MB.
+// máquina. O corpo leva o JPEG, porque a foto do espaço do Chat é JPEG de até 2 MB, e o modelo e a
+// qualidade do adendo de 09/10: o gpt-image-1 sai do ar em 23/10/2026 (achado 90), e o Eduardo escolheu,
+// pela medição, o gpt-image-2.5-flare em high, com a versão medida fixa.
 //
 // A CHAVE DESTES TESTES É INVENTADA, e não começa por "sk-" de propósito: a varredura da etapa procura
 // esse começo em todo arquivo novo. Onde o teste precisa de um "sk-", ele é montado em partes.
@@ -42,7 +43,7 @@ describe("a chamada à OpenAI", () => {
     expect(buscar).not.toHaveBeenCalled();
   });
 
-  it("o corpo é o do Labs em JPEG, com a cena embrulhada nas regras, e com prazo", async () => {
+  it("o corpo leva o modelo medido e escolhido, em JPEG, com a cena embrulhada nas regras, e com prazo", async () => {
     const buscar = vi.fn(async (_url: string, _init: RequestInit) => resposta(200, { data: [{ b64_json: "AQID" }] }));
     await gerarNaOpenAI(CENA, AMBIENTE, buscar as unknown as typeof fetch);
     const [url, init] = buscar.mock.calls[0];
@@ -50,17 +51,22 @@ describe("a chamada à OpenAI", () => {
     expect(init.method).toBe("POST");
     expect((init.headers as Record<string, string>).Authorization).toBe("Bearer chave-inventada-para-o-teste");
     expect(JSON.parse(String(init.body))).toEqual({ ...CORPO_FIXO, prompt: montarPrompt(CENA) });
-    expect(CORPO_FIXO).toMatchObject({
-      model: "gpt-image-1",
+    expect(CORPO_FIXO).toEqual({
+      model: "gpt-image-2.5-flare-2026-09-08",
       size: "1536x1024",
-      quality: "medium",
+      quality: "high",
       n: 1,
       background: "opaque",
       output_format: "jpeg",
+      output_compression: 90,
     });
     expect(init.signal).toBeInstanceOf(AbortSignal);
   });
 
+  it("o modelo que a OpenAI desliga em 23/10/2026 não está no corpo", () => {
+    expect(JSON.stringify(CORPO_FIXO)).not.toContain('"gpt-image-1"');
+  });
+
   it("a imagem volta em bytes, lida de data[0].b64_json", async () => {
     const buscar = async () => resposta(200, { data: [{ b64_json: Buffer.from([0xff, 0xd8, 0xff, 1]).toString("base64") }] });
     expect(await gerarNaOpenAI(CENA, AMBIENTE, buscar as unknown as typeof fetch)).toEqual({
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-imagem-openai.test.ts
```

Esperado: 2 caem e 10 passam (12): o corpo ainda tem o `gpt-image-1` em `medium`.

- [ ] **Passo 3: o código**

Em `lib/bonus/imagem-openai.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/imagem-openai.ts b/lib/bonus/imagem-openai.ts
index b798295..b8455c2 100644
--- a/lib/bonus/imagem-openai.ts
+++ b/lib/bonus/imagem-openai.ts
@@ -17,20 +17,24 @@ import { montarPrompt } from "./prompt-ilustracao";
 // SEM SDK, com `fetch` direto, como o Labs: o endpoint é um POST com JSON, e a resposta tem um campo que
 // interessa. Nada muda no package.json.
 //
-// O CORPO É O DO LABS, com uma diferença: `output_format: "jpeg"`, e não "png". O Chat guarda a imagem
-// como a foto do espaço, e a rota da arte só a lê como JPEG e até 2 MB (lib/bonus/arte-foto.ts); o PNG do
-// Labs passava de 2 MB. O resto (modelo, tamanho, qualidade, fundo) foi decidido e medido lá, e não muda
-// aqui sem combinar.
+// O CORPO: `output_format: "jpeg"`, e não o "png" do Labs. O Chat guarda a imagem como a foto do espaço,
+// e a rota da arte só a lê como JPEG e até 2 MB (lib/bonus/arte-foto.ts); o PNG do Labs passava de 2 MB.
+//
+// ⚠️ O MODELO E A QUALIDADE SÃO OS DO ADENDO DE 09/10 (achado 90). O `gpt-image-1` em `medium`, do Labs, sai
+// do ar em 23/10/2026 (developers.openai.com/api/docs/deprecations). O Eduardo escolheu, olhando a
+// medição dos dois substitutos, o `gpt-image-2.5-flare` em `high` (US$ 0,0432 e uns 16 s por imagem), e
+// pediu a VERSÃO FIXA: o nome sem data é um apelido, que pode passar a outra versão sem aviso, mudando o
+// estilo e o custo. Trocar o modelo é uma medição nova, e não uma linha mudada aqui.
 //
 // A CHAVE sai do ambiente, vai só no cabeçalho, e nunca para uma frase, um log ou o banco (`tirarChave`).
 
 export const ENDERECO_DA_OPENAI = "https://api.openai.com/v1/images/generations";
 
-/** O corpo, menos o prompt. 1536×1024 é o 3:2 deitado do espaço (860×573): a API só aceita três tamanhos. */
+/** O corpo, menos o prompt. 1536×1024 é o 3:2 deitado do espaço (860×573), um dos tamanhos recomendados. */
 export const CORPO_FIXO = {
-  model: "gpt-image-1",
+  model: "gpt-image-2.5-flare-2026-09-08",
   size: "1536x1024",
-  quality: "medium",
+  quality: "high",
   n: 1,
   background: "opaque",
   output_format: "jpeg",
@@ -44,7 +48,7 @@ export type GerarNaOpenAI = (descricao: string) => Promise<RespostaDaOpenAI>;
 
 /**
  * Gera a imagem da descrição que o operador digitou. O embrulho nas regras (estilo, fundo, proibições) é
- * o `montarPrompt` do Labs. `ambiente` e `buscar` entram por parâmetro só para o teste.
+ * o `montarPrompt` do Chat. `ambiente` e `buscar` entram por parâmetro só para o teste.
  */
 export async function gerarNaOpenAI(
   descricao: string,
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx eslint lib/bonus/imagem-openai.ts tests/bonus-imagem-openai.test.ts
npx vitest run tests/bonus-imagem-openai.test.ts
```

Esperado: `tsc` e lint limpos; os 12 passam.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/imagem-openai.ts tests/bonus-imagem-openai.test.ts
test "$(git branch --show-current)" = "criador-de-imagem"
git add lib/bonus/imagem-openai.ts tests/bonus-imagem-openai.test.ts
git commit -m "feat(bonus): a imagem sai do gpt-image-2.5-flare em high, na versão medida"
```

---

### FASE 6.12 — O estilo, a regra do manual do perfil e o aviso de texto no campo da cena

**Arquivos:**
- Modificar: `lib/bonus/prompt-ilustracao.ts` (`comEstilo`, `separarEstiloDaDescricao`),
  `lib/bonus/imagem-textos.ts` (a regra na tela e o aviso de texto; sai `textoDoPedidoDeTexto`),
  `app/bonus/[id]/carrossel/[cid]/gerar-imagem.tsx` (a escolha do estilo, a regra, o aviso)
- Testar: `tests/bonus-prompt-ilustracao.test.ts`, `tests/bonus-imagem-textos.test.ts`, `testes-dom/bonus-gerar-imagem.dom.tsx`

**Interfaces:**
- Consome: `ESTILOS`, `ChaveDoEstilo`, `ESTILO_PADRAO`, `trechosEntreAspas` e `pedeTextoNaImagem` (FASE 6.10).
- Produz: `comEstilo(estilo: ChaveDoEstilo, resto: string): string`;
  `separarEstiloDaDescricao(descricao): { estilo: ChaveDoEstilo; resto: string }`;
  `TEXTO_REGRAS_DA_IMAGEM`, `TEXTO_ESCREVA_ENTRE_ASPAS`, `TEXTO_CONFIRA_A_GRAFIA`,
  `textoDoAvisoDeTexto(descricao): string | null`; na tela, o grupo de rádio "Estilo" (um por estilo,
  com o rótulo e o resumo), o pedido com `descricao: comEstilo(estilo, descricao)`.

- [ ] **Passo 1: os testes**

Em `tests/bonus-prompt-ilustracao.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-prompt-ilustracao.test.ts b/tests/bonus-prompt-ilustracao.test.ts
index dee799f..d446491 100644
--- a/tests/bonus-prompt-ilustracao.test.ts
+++ b/tests/bonus-prompt-ilustracao.test.ts
@@ -11,9 +11,11 @@ import {
   MIN_DESCRICAO,
   PROIBICAO_DE_PESSOA_REAL,
   PROIBICAO_DE_TEXTO,
+  comEstilo,
   lerDescricao,
   montarPrompt,
   pedeTextoNaImagem,
+  separarEstiloDaDescricao,
   textoExato,
   trechosEntreAspas,
   validarDescricao,
@@ -166,6 +168,24 @@ describe("lerDescricao", () => {
   });
 });
 
+describe("o estilo no começo da descrição, para a tela", () => {
+  // A tela guarda o estilo como o primeiro atalho da descrição: o "Gerar de novo" o lê de volta, e a
+  // tabela 018 não precisa de coluna nova.
+  it("comEstilo põe o estilo na frente da descrição", () => {
+    expect(comEstilo("ilustracao", "  /antes-depois dois cérebros  ")).toBe("/ilustracao /antes-depois dois cérebros");
+  });
+
+  it("separarEstiloDaDescricao devolve o estilo e o resto, com o atalho ainda nele", () => {
+    expect(separarEstiloDaDescricao("/comercial /showcase uma vitrine")).toEqual({ estilo: "comercial", resto: "/showcase uma vitrine" });
+    expect(separarEstiloDaDescricao("/CINEMA")).toEqual({ estilo: "cinema", resto: "" });
+  });
+
+  it("sem estilo no começo, o padrão e a descrição inteira", () => {
+    expect(separarEstiloDaDescricao("/marketing uma pessoa na loja")).toEqual({ estilo: "cinema", resto: "/marketing uma pessoa na loja" });
+    expect(separarEstiloDaDescricao("uma pessoa na loja")).toEqual({ estilo: "cinema", resto: "uma pessoa na loja" });
+  });
+});
+
 describe("trechosEntreAspas", () => {
   it("lê aspas retas e curvas, na ordem, e ignora o vazio", () => {
     expect(trechosEntreAspas('um "A", um “B” e um ""')).toEqual({ trechos: ["A", "B"], semPar: false });
```

Em `tests/bonus-imagem-textos.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-imagem-textos.test.ts b/tests/bonus-imagem-textos.test.ts
index 22ad6e2..74bf146 100644
--- a/tests/bonus-imagem-textos.test.ts
+++ b/tests/bonus-imagem-textos.test.ts
@@ -1,13 +1,17 @@
 import { describe, expect, it } from "vitest";
 import { TETO_IMAGEM_DIARIO } from "@/lib/bonus/imagem-regras";
 import {
+  TEXTO_CONFIRA_A_GRAFIA,
+  TEXTO_ESCREVA_ENTRE_ASPAS,
   TEXTO_GERANDO_A_IMAGEM,
   TEXTO_IMAGEM_FALHOU_SEM_MOTIVO,
   TEXTO_IMAGEM_GERADA,
   TEXTO_IMAGEM_NAO_SUBIU,
   TEXTO_IMAGEM_TRAVADA,
+  TEXTO_REGRAS_DA_IMAGEM,
   TEXTO_SEM_CHAVE_DA_IMAGEM,
   textoDaRecusaDaImagem,
+  textoDoAvisoDeTexto,
   textoDoContador,
   textoDoProblemaDaImagem,
   type RecusaDaImagem,
@@ -66,3 +70,27 @@ describe("as outras frases da imagem", () => {
     expect(TEXTO_GERANDO_A_IMAGEM).toBe("Gerando a imagem… leva uns 30 segundos.");
   });
 });
+
+describe("as regras e o aviso de texto na hora de gerar (adendo de 09/10)", () => {
+  it("a regra do manual do perfil, e a do texto entre aspas, numa frase só", () => {
+    expect(TEXTO_REGRAS_DA_IMAGEM).toBe(
+      "Sem marca e sem pessoa real (manual do perfil). Texto só entre aspas, exatamente como escrito; nome de marca sai em letra simples, sem logo."
+    );
+  });
+
+  // O aviso, e não o bloqueio (decisão do Eduardo no Labs em 21/09), agora em dois casos.
+  it("sem aspas, a descrição que pede texto ouve que o texto vai entre aspas", () => {
+    expect(textoDoAvisoDeTexto("uma placa com o nome da loja na entrada")).toBe(TEXTO_ESCREVA_ENTRE_ASPAS);
+    expect(TEXTO_ESCREVA_ENTRE_ASPAS).toBe("Para o texto aparecer na imagem, escreva-o entre aspas.");
+  });
+
+  it("com aspas, ela ouve que a grafia se confere antes de publicar", () => {
+    expect(textoDoAvisoDeTexto('uma placa escrita "ABERTO" na porta')).toBe(TEXTO_CONFIRA_A_GRAFIA);
+    expect(textoDoAvisoDeTexto("uma porta com “ABERTO”")).toBe(TEXTO_CONFIRA_A_GRAFIA);
+    expect(TEXTO_CONFIRA_A_GRAFIA).toBe("Confira a grafia na imagem antes de publicar.");
+  });
+
+  it("sem texto pedido e sem aspas, nada", () => {
+    expect(textoDoAvisoDeTexto("uma loja de roupas cheia de gente")).toBeNull();
+  });
+});
```

Em `testes-dom/bonus-gerar-imagem.dom.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-dom/bonus-gerar-imagem.dom.tsx b/testes-dom/bonus-gerar-imagem.dom.tsx
index 284e31b..e10e993 100644
--- a/testes-dom/bonus-gerar-imagem.dom.tsx
+++ b/testes-dom/bonus-gerar-imagem.dom.tsx
@@ -7,8 +7,11 @@ import { camposDoFormulario } from "@/lib/bonus/carrossel-texto";
 import type { ConsultaDaImagem } from "@/lib/bonus/imagem-consulta";
 import { urlDaConsultaDaImagem } from "@/lib/bonus/imagem-regras";
 import {
+  TEXTO_CONFIRA_A_GRAFIA,
+  TEXTO_ESCREVA_ENTRE_ASPAS,
   TEXTO_GERANDO_A_IMAGEM,
   TEXTO_IMAGEM_GERADA,
+  TEXTO_REGRAS_DA_IMAGEM,
   textoDaRecusaDaImagem,
   textoDoContador,
   type AvisoDoPedidoDeImagem,
@@ -16,9 +19,9 @@ import {
 import { ATALHOS } from "@/lib/bonus/prompt-ilustracao";
 
 // O CRIADOR DE IMAGEM NA TELA (spec da Etapa 6, "A tela" e "Pedir e acompanhar"): o botão em cada slide com
-// espaço, o campo com os atalhos do Labs, o aviso de texto, o contador do dia, o pedido que volta na hora,
-// e a consulta que acompanha até a imagem entrar no espaço. A action e a consulta são falsas: nada sai para
-// a rede, e nada chama a OpenAI.
+// espaço, o campo com o estilo (adendo de 09/10), os atalhos, as regras do manual do perfil, o aviso de
+// texto, o contador do dia, o pedido que volta na hora, e a consulta que acompanha até a imagem entrar no
+// espaço. A action e a consulta são falsas: nada sai para a rede, e nada chama a OpenAI.
 
 vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
 
@@ -150,15 +153,36 @@ describe("o campo da cena", () => {
     expect(within(card(2)).getByText(textoDoContador(3))).toBeTruthy();
   });
 
-  // O aviso, e não o bloqueio, decidido pelo Eduardo no Labs em 21/09: a IA de imagem escreve errado.
-  it("avisa quando a descrição pede texto na imagem, sem travar o botão", () => {
+  // O aviso, e não o bloqueio (decisão do Eduardo no Labs em 21/09), em dois casos pelo adendo de 09/10.
+  it("avisa para pôr o texto entre aspas, e depois para conferir a grafia, sem travar o botão", () => {
     renderizar();
     abrir(2);
     fireEvent.change(campo(2), { target: { value: "uma placa com o nome da loja na entrada" } });
-    expect(within(card(2)).getByText(/pede texto na imagem/)).toBeTruthy();
+    expect(within(card(2)).getByText(TEXTO_ESCREVA_ENTRE_ASPAS)).toBeTruthy();
     expect(gerar(2).disabled).toBe(false);
+    fireEvent.change(campo(2), { target: { value: 'uma placa com "LOJA ABERTA" na entrada' } });
+    expect(within(card(2)).getByText(TEXTO_CONFIRA_A_GRAFIA)).toBeTruthy();
+    expect(within(card(2)).queryByText(TEXTO_ESCREVA_ENTRE_ASPAS)).toBeNull();
     fireEvent.change(campo(2), { target: { value: "uma loja de roupas cheia de gente" } });
-    expect(within(card(2)).queryByText(/pede texto na imagem/)).toBeNull();
+    expect(within(card(2)).queryByText(TEXTO_CONFIRA_A_GRAFIA)).toBeNull();
+  });
+
+  it("mostra a regra do manual do perfil junto do campo", () => {
+    renderizar();
+    abrir(2);
+    expect(within(card(2)).getByText(TEXTO_REGRAS_DA_IMAGEM)).toBeTruthy();
+  });
+
+  it("o estilo começa em Cena de cinema e vai para o começo da descrição", async () => {
+    const { pedidos } = renderizar();
+    abrir(2);
+    expect((within(card(2)).getByRole("radio", { name: /^Cena de cinema/ }) as HTMLInputElement).checked).toBe(true);
+    fireEvent.click(within(card(2)).getByRole("radio", { name: /^Ilustração conceitual/ }));
+    fireEvent.change(campo(2), { target: { value: CENA } });
+    await act(async () => {
+      fireEvent.click(gerar(2));
+    });
+    expect(pedidos).toEqual([{ id: CARROSSEL, numero: 2, descricao: `/ilustracao ${CENA}` }]);
   });
 
   it("no teto do dia, o Gerar trava com a frase do teto", () => {
@@ -168,10 +192,11 @@ describe("o campo da cena", () => {
     expect(within(card(2)).getByText(textoDaRecusaDaImagem({ motivo: "teto" }))).toBeTruthy();
   });
 
-  it("o Gerar de novo volta com a última descrição do slide", () => {
-    renderizar({ gerada: { descricoes: { 2: "a primeira descrição da cena" } } });
+  it("o Gerar de novo volta com o estilo e a última descrição do slide", () => {
+    renderizar({ gerada: { descricoes: { 2: "/comercial /showcase a primeira descrição da cena" } } });
     abrir(2, "Gerar de novo");
-    expect(campo(2).value).toBe("a primeira descrição da cena");
+    expect(campo(2).value).toBe("/showcase a primeira descrição da cena");
+    expect((within(card(2)).getByRole("radio", { name: /^Ambiente comercial brilhante/ }) as HTMLInputElement).checked).toBe(true);
   });
 });
 
@@ -183,7 +208,7 @@ describe("pedir e acompanhar", () => {
     ];
     const { pedidos } = renderizar();
     await pedir(2);
-    expect(pedidos).toEqual([{ id: CARROSSEL, numero: 2, descricao: CENA }]);
+    expect(pedidos).toEqual([{ id: CARROSSEL, numero: 2, descricao: `/cinema ${CENA}` }]);
     expect(within(card(2)).getByText(TEXTO_GERANDO_A_IMAGEM)).toBeTruthy();
     await waitFor(() => expect(miniatura(2).getAttribute("src")).toBe(urlDaArte(CAMINHO, 2, "b9")));
     expect(urls[0]).toBe(urlDaConsultaDaImagem(CAMINHO, 2));
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-imagem-textos.test.ts tests/bonus-prompt-ilustracao.test.ts
npx vitest run --config vitest.dom.config.ts testes-dom/bonus-gerar-imagem.dom.tsx
```

Esperado: nos puros, 7 caem e 36 passam (43): as frases e as duas funções novas. Na tela, 5 caem e 9
passam (14): o aviso nos dois casos, a regra na tela, o estilo no pedido, o "Gerar de novo" com o estilo, e
o pedido que agora leva `/cinema` na frente.

- [ ] **Passo 3: o código**

Em `lib/bonus/prompt-ilustracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/prompt-ilustracao.ts b/lib/bonus/prompt-ilustracao.ts
index c8dbab7..ed24089 100644
--- a/lib/bonus/prompt-ilustracao.ts
+++ b/lib/bonus/prompt-ilustracao.ts
@@ -297,6 +297,23 @@ export function lerDescricao(descricao: string): LeituraDaDescricao {
   return { estilo: estilo ?? ESTILO_POR_CHAVE.get(ESTILO_PADRAO)!, atalho, cena: resto.trim(), desconhecido, repetido };
 }
 
+/**
+ * O ESTILO NO COMEÇO DA DESCRIÇÃO, PARA A TELA. A tela tem a escolha do estilo à parte do campo da cena, e
+ * guarda o estilo como o primeiro atalho da descrição (`/cinema …`): assim o "Gerar de novo" o lê de volta,
+ * e a tabela 018, já na produção, não precisa de coluna nova (spec, adendo de 09/10).
+ */
+export function comEstilo(estilo: ChaveDoEstilo, resto: string): string {
+  return `/${estilo} ${resto.trim()}`;
+}
+
+/** O inverso de `comEstilo`: o estilo do começo (ou o padrão) e o resto, com o atalho ainda nele. */
+export function separarEstiloDaDescricao(descricao: string): { estilo: ChaveDoEstilo; resto: string } {
+  const m = /^\/([a-z-]+)(?:\s+([\s\S]*))?$/i.exec(descricao.trim());
+  const chave = m?.[1].toLowerCase();
+  if (m && chave && ESTILO_POR_CHAVE.has(chave)) return { estilo: chave as ChaveDoEstilo, resto: (m[2] ?? "").trim() };
+  return { estilo: ESTILO_PADRAO, resto: descricao.trim() };
+}
+
 /**
  * Os trechos entre aspas da cena, retas (`"…"`) ou curvas (`“…”`), na ordem em que aparecem; e se
  * alguma aspa ficou sem par. Trecho vazio (`""`) não conta.
```

Em `lib/bonus/imagem-textos.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/imagem-textos.ts b/lib/bonus/imagem-textos.ts
index fd2d323..b500dbc 100644
--- a/lib/bonus/imagem-textos.ts
+++ b/lib/bonus/imagem-textos.ts
@@ -1,5 +1,6 @@
 import type { Aviso } from "@/lib/avisos";
 import { TETO_IMAGEM_DIARIO, type ProblemaDaImagem } from "./imagem-regras";
+import { pedeTextoNaImagem, trechosEntreAspas } from "./prompt-ilustracao";
 import { textoDaRecusaDaPublicacaoDoCarrossel, type RecusaDaPublicacaoDoCarrossel } from "./publicar-textos";
 
 // AS FRASES DO CRIADOR DE IMAGEM, fora do JSX e das actions (o princípio de lib/bonus/textos.ts): uma
@@ -63,12 +64,23 @@ export const TEXTO_SEM_REDE_DA_OPENAI = "Não consegui falar com a OpenAI. Tente
 export const TEXTO_OPENAI_SEM_IMAGEM = "A OpenAI respondeu sem a imagem. Tente de novo; se repetir, avise quem cuida do Chat.";
 
 /**
- * O AVISO DA DESCRIÇÃO QUE PEDE TEXTO NA IMAGEM (`pedeTextoNaImagem`, do Labs): é aviso, e não bloqueio,
- * como o Eduardo decidiu lá em 21/09. Ele diz a consequência, e não o mecanismo: a IA de imagem escreve
- * errado, e o texto do slide já vem da arte.
+ * AS REGRAS NA HORA DE GERAR (spec da Etapa 6, adendo de 09/10, "As regras na tela"): a do manual do
+ * perfil, que o Eduardo manteve e pediu escrita junto do campo, e a do texto entre aspas.
  */
-export function textoDoPedidoDeTexto(termo: string): string {
-  return `A descrição pede texto na imagem ("${termo}"). A IA de imagem escreve errado, e o texto do slide já vem da arte: descreva a cena sem ele.`;
+export const TEXTO_REGRAS_DA_IMAGEM =
+  "Sem marca e sem pessoa real (manual do perfil). Texto só entre aspas, exatamente como escrito; nome de marca sai em letra simples, sem logo.";
+export const TEXTO_ESCREVA_ENTRE_ASPAS = "Para o texto aparecer na imagem, escreva-o entre aspas.";
+export const TEXTO_CONFIRA_A_GRAFIA = "Confira a grafia na imagem antes de publicar.";
+
+/**
+ * O AVISO DE TEXTO (mudou no adendo de 09/10): é aviso, e não bloqueio, como o Eduardo decidiu no Labs em
+ * 21/09. Sem aspas, a descrição que pede texto (`pedeTextoNaImagem`, a lista do Labs) ouve que o texto vai
+ * entre aspas, porque sem elas a imagem sai sem texto nenhum; com aspas, que a grafia se confere antes de
+ * publicar, porque o modelo ainda pode errar uma letra.
+ */
+export function textoDoAvisoDeTexto(descricao: string): string | null {
+  if (trechosEntreAspas(descricao).trechos.length > 0) return TEXTO_CONFIRA_A_GRAFIA;
+  return pedeTextoNaImagem(descricao) ? TEXTO_ESCREVA_ENTRE_ASPAS : null;
 }
 
 /**
```

Em `app/bonus/[id]/carrossel/[cid]/gerar-imagem.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/[id]/carrossel/[cid]/gerar-imagem.tsx b/app/bonus/[id]/carrossel/[cid]/gerar-imagem.tsx
index 630dba4..a9035dd 100644
--- a/app/bonus/[id]/carrossel/[cid]/gerar-imagem.tsx
+++ b/app/bonus/[id]/carrossel/[cid]/gerar-imagem.tsx
@@ -7,18 +7,20 @@ import {
   TEXTO_GERANDO_A_IMAGEM,
   TEXTO_IMAGEM_FALHOU_SEM_MOTIVO,
   TEXTO_IMAGEM_GERADA,
+  TEXTO_REGRAS_DA_IMAGEM,
   textoDaRecusaDaImagem,
+  textoDoAvisoDeTexto,
   textoDoContador,
-  textoDoPedidoDeTexto,
   type AvisoDoPedidoDeImagem,
 } from "@/lib/bonus/imagem-textos";
-import { ATALHOS, pedeTextoNaImagem } from "@/lib/bonus/prompt-ilustracao";
+import { ATALHOS, ESTILOS, comEstilo, separarEstiloDaDescricao, type ChaveDoEstilo } from "@/lib/bonus/prompt-ilustracao";
 
 // O "GERAR IMAGEM" DE UM SLIDE (spec da Etapa 6, "A tela" e "Pedir e acompanhar"), na linha dos botões da
 // imagem do card, ao lado do "Subir foto" e do "Slide pronto do Canva".
 //
-// O botão abre o campo da cena, com os cinco atalhos do Labs, o aviso da descrição que pede texto e o
-// contador do dia. O "Gerar" chama a action do pedido, que confere, reserva e VOLTA NA HORA (achado 88):
+// O botão abre o campo da cena, com a escolha do estilo (adendo de 09/10), os cinco atalhos, a regra do
+// manual do perfil, o aviso de texto e o contador do dia. O estilo vai para o começo da descrição
+// (`comEstilo`), e o "Gerar de novo" o lê de volta (`separarEstiloDaDescricao`). O "Gerar" chama a action do pedido, que confere, reserva e VOLTA NA HORA (achado 88):
 // a imagem é gerada no servidor, e este componente pergunta pela rota GET da consulta, uma pergunta de cada
 // vez, até ela ficar pronta ou falhar. Enquanto isso, o resto da página funciona. A página que abre com uma
 // geração em andamento começa aqui em "Gerando…" e acompanha.
@@ -29,7 +31,7 @@ export type GeradorDoSlide = {
   /** A conta das últimas 24 horas, comum a todos os cards. */
   hoje: number;
   aoMudarHoje: (hoje: number) => void;
-  /** A última descrição deste slide, para o "Gerar de novo". */
+  /** A última descrição deste slide, com o estilo no começo, para o "Gerar de novo". */
   descricaoInicial: string | null;
   /** Uma geração deste slide estava em andamento quando a página abriu. */
   gerandoInicial: boolean;
@@ -62,7 +64,9 @@ export default function GerarImagem({
   aoMudarGerando: (gerando: boolean) => void;
 }) {
   const [aberto, setAberto] = useState(false);
-  const [descricao, setDescricao] = useState(gerador.descricaoInicial ?? "");
+  const [inicial] = useState(() => separarEstiloDaDescricao(gerador.descricaoInicial ?? ""));
+  const [estilo, setEstilo] = useState<ChaveDoEstilo>(inicial.estilo);
+  const [descricao, setDescricao] = useState(inicial.resto);
   const [jaPediu, setJaPediu] = useState(gerador.descricaoInicial !== null);
   const [gerando, setGerando] = useState(gerador.gerandoInicial);
   const [aviso, setAviso] = useState<AvisoNaTela | null>(gerador.gerandoInicial ? { tom: "atencao", texto: TEXTO_GERANDO_A_IMAGEM } : null);
@@ -121,12 +125,12 @@ export default function GerarImagem({
     };
   }, [gerando, rodada, caminho, numero, gerador.intervaloMs]);
 
-  const termo = pedeTextoNaImagem(descricao);
+  const avisoDeTexto = textoDoAvisoDeTexto(descricao);
   const noTeto = gerador.hoje >= TETO_IMAGEM_DIARIO;
 
   function pedir() {
     iniciar(async () => {
-      const r = await gerador.acao({ id: carrosselId, numero, descricao });
+      const r = await gerador.acao({ id: carrosselId, numero, descricao: comEstilo(estilo, descricao) });
       if (r.hoje !== undefined) gerador.aoMudarHoje(r.hoje);
       if (r.tom !== "ok") {
         setAviso({ tom: "erro", texto: r.texto });
@@ -147,6 +151,23 @@ export default function GerarImagem({
         <div className="order-last basis-full space-y-2">
           {aberto && (
             <div className="space-y-2">
+              <fieldset className="space-y-1">
+                <legend className="text-sm font-medium">Estilo</legend>
+                {ESTILOS.map((e) => (
+                  <label key={e.chave} className="flex items-center gap-2 text-sm">
+                    <input
+                      type="radio"
+                      name={`estilo-do-slide-${numero}`}
+                      value={e.chave}
+                      checked={estilo === e.chave}
+                      onChange={() => setEstilo(e.chave)}
+                    />
+                    <span>
+                      {e.rotulo}: {e.resumo}
+                    </span>
+                  </label>
+                ))}
+              </fieldset>
               <p className="text-sm font-medium">Descreva a cena</p>
               <textarea
                 aria-label={`Slide ${numero}: descreva a cena`}
@@ -163,7 +184,8 @@ export default function GerarImagem({
                   </p>
                 ))}
               </div>
-              {termo && <p className="text-xs font-medium text-fecha dark:text-fecha-escuro">{textoDoPedidoDeTexto(termo)}</p>}
+              <p className={hint}>{TEXTO_REGRAS_DA_IMAGEM}</p>
+              {avisoDeTexto && <p className="text-xs font-medium text-fecha dark:text-fecha-escuro">{avisoDeTexto}</p>}
               <p className={hint}>{textoDoContador(gerador.hoje)}</p>
               {noTeto && <p className="text-xs font-medium text-parou dark:text-parou-escuro">{textoDaRecusaDaImagem({ motivo: "teto" })}</p>}
               <button type="button" onClick={pedir} disabled={ocupado || noTeto} className={btnPrimary}>
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx eslint lib/bonus/prompt-ilustracao.ts lib/bonus/imagem-textos.ts "app/bonus/[id]/carrossel/[cid]/gerar-imagem.tsx" tests/bonus-imagem-textos.test.ts tests/bonus-prompt-ilustracao.test.ts testes-dom/bonus-gerar-imagem.dom.tsx
npx vitest run tests/bonus-imagem-textos.test.ts tests/bonus-prompt-ilustracao.test.ts
npx vitest run --config vitest.dom.config.ts testes-dom/bonus-gerar-imagem.dom.tsx
npm test
npm run test:dom
```

Esperado: `tsc` e lint limpos; os 43 puros e os 14 de tela passam; as suítes inteiras com 116 arquivos e
3 209 casos puros, e 23 e 203 de tela.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/prompt-ilustracao.ts lib/bonus/imagem-textos.ts "app/bonus/[id]/carrossel/[cid]/gerar-imagem.tsx" tests/bonus-imagem-textos.test.ts tests/bonus-prompt-ilustracao.test.ts testes-dom/bonus-gerar-imagem.dom.tsx
test "$(git branch --show-current)" = "criador-de-imagem"
git add lib/bonus/prompt-ilustracao.ts lib/bonus/imagem-textos.ts "app/bonus/[id]/carrossel/[cid]/gerar-imagem.tsx" tests/bonus-imagem-textos.test.ts tests/bonus-prompt-ilustracao.test.ts testes-dom/bonus-gerar-imagem.dom.tsx
git commit -m "feat(bonus): o estilo, a regra do manual do perfil e o aviso de texto no campo da cena"
```

---

### FASE 6.13 — O verify, a integração, as mutações, a guarda e as varreduras, de novo

- [ ] **Passo 1: o verify, na árvore do projeto**

```bash
env -u CLAUDECODE -u AI_AGENT npm run verify
git diff --stat AGENTS.md
```

Esperado: lint e `tsc` limpos; 116 arquivos e 3 209 casos puros e 23 e 203 de tela; "SEM VAZAMENTO em A
nem em C"; o build (Turbopack) com "MIGRAÇÃO PULADA" e as duas rotas `imagem`; o `AGENTS.md` sem diferença.

- [ ] **Passo 2: a integração inteira, no container**

```bash
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npm run test:integracao
```

Esperado: `[rede-global] ALVO: banco de TESTE`; 45 arquivos, 493 passaram e 8 pularam (como na FASE 6.8).

- [ ] **Passo 3: as provas de mutação**

Copie o script do Apêndice B para `$SCRATCH/mutar-imagem-2.mjs` e rode, da raiz:

```bash
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" node "$SCRATCH/mutar-imagem-2.mjs"
git status --short
```

Esperado: as 50 com ✓, "50 mutações, 0 ruins", e a árvore limpa depois.

- [ ] **Passo 4: a guarda do diff**

Os cinco comandos da FASE 6.8, passo 4, contra `aef1eeb`, com o mesmo esperado; e o adendo sozinho:

```bash
git diff --stat 7fecd1f -- . ':!docs'
```

Esperado: só os 9 arquivos do mapa do adendo.

- [ ] **Passo 5: a varredura da chave e a do modelo que sai do ar**

Os quatro comandos da FASE 6.8, passo 5, com o mesmo esperado; e:

```bash
git grep -n 'model: "gpt-image-1"' HEAD -- app lib
git grep -n "gpt-image-1" HEAD -- app lib
```

Esperado: a primeira vazia (o modelo velho não está no corpo); a segunda só com
`lib/bonus/erro-ilustracao.ts:17` e `:61` (a cópia do Labs, item 2 do ensaio do adendo) e o comentário de
histórico em `lib/bonus/imagem-openai.ts`.

- [ ] **Passo 6: avisar o auditor**, com o hash, os números e o pedido de conferir antes do push. O push
  das fases do adendo e o PR só com o OK do Eduardo.

---

### FASE 6.14 — A prova retomada, no preview, com o Eduardo

Cada escrita em produção tem o OK do Eduardo, pela caixa, e a auditoria lê o banco antes e depois, com a
hora mandada antes de cada gravação. O preview usa o banco, o bucket e a chave de produção (a chave em
Preview). **Sem post real.**

- [ ] **Passo 1: o push das fases do adendo, com o OK do Eduardo.** Empurre só a branch
  (`git push origin refs/heads/criador-de-imagem:refs/heads/criador-de-imagem`). No log do build do
  preview, confira o commit, "MIGRAÇÃO PULADA" e as duas rotas `imagem`.

- [ ] **Passo 2: a prova** (os passos da spec, "A prova retomada"), com textos conferidos pelas regras de
  cada campo antes de mandar ao Eduardo:
  1. o carrossel `4e3664ea` (ou um novo, à mão, com 1 slide);
  2. "Gerar imagem" em "Cena de cinema", com uma cena e um texto acentuado entre aspas (~US$ 0,043): a
     imagem no espaço, o contador sobe, e a auditoria mede o JPEG e a grafia;
  3. "Gerar de novo" em "Ilustração conceitual", recarregando durante o "Gerando…" (~US$ 0,043): o card
     volta em "Gerando…", a imagem troca sozinha, a anterior sai do bucket, e o campo volta com o estilo;
  4. a cena com menos de 10 caracteres e a aspa sem par: recusadas, sem custo e sem linha nova;
  5. agendar para daqui a 7 dias e cancelar no calendário: a arte da fila leva a imagem gerada.

- [ ] **Passo 3: a devolução.** O carrossel e as imagens da prova saem do banco e do bucket, com o OK do
  Eduardo e o script lido pela auditoria antes de rodar (achado 77). As linhas de `imagens_geradas` ficam,
  com o carrossel nulo.

- [ ] **Passo 4: o PR.** O corpo, conferido pela auditoria, e o PR com o OK do Eduardo. O merge é do
  Vinícius, e o build do merge diz "Nada a aplicar: as 19 migrações".

---

## Apêndice B — as provas de mutação do adendo

O script do Apêndice A, com as mutações que miravam a cópia das regras ajustadas ao adendo e as novas das
FASES 6.10 a 6.12. Sem `DATABASE_URL_TESTES`, ele recusa antes de mutar, e nenhuma mutação chama a OpenAI.

```js
// Provas de mutação da Etapa 6 (o criador de imagem), com o adendo de 09/10 (as regras de estilo do Chat, o
// modelo novo e a tela do estilo). Cada mutação tira uma proteção e roda o teste que a
// cobre; o caso nomeado tem de cair. Cada arquivo volta byte a byte.
// Uso, da raiz do repositório: DATABASE_URL_TESTES=<container> node mutar-imagem.mjs [filtro]
// As mutações INTEG rodam a suíte de integração, que sem DATABASE_URL_TESTES cai na DATABASE_URL, a da
// PRODUÇÃO (achado 68): sem a variável, o script recusa antes de mutar, e uma rodada INTEG que não imprime
// "ALVO: banco de TESTE" conta como ✗. Nenhuma mutação chama a OpenAI: os testes usam uma falsa.
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const PURA = (f) => `npx vitest run ${f}`;
const TELA = (f) => `npx vitest run --config vitest.dom.config.ts ${f}`;
const INTEG = (f) => `npx vitest run --config vitest.integracao.config.ts ${f}`;

const MIGRACAO = "migrations/018-imagens-geradas.sql";
const ESQUEMA = "lib/esquema.ts";
const PROMPT = "lib/bonus/prompt-ilustracao.ts";
const ERRO = "lib/bonus/erro-ilustracao.ts";
const OPENAI = "lib/bonus/imagem-openai.ts";
const REGRAS = "lib/bonus/imagem-regras.ts";
const JPEG = "lib/bonus/imagem-jpeg.ts";
const REPO = "lib/bonus/imagem-repositorio.ts";
const PROCESSO = "lib/bonus/imagem-processo.ts";
const ACOES = "app/bonus/imagem-actions.ts";
const TEXTOS = "lib/bonus/imagem-textos.ts";
const ROTA = "app/bonus/[id]/carrossel/[cid]/imagem/route.ts";
const CONSULTA = "lib/bonus/imagem-consulta.ts";
const CARD = "app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx";
const GERAR = "app/bonus/[id]/carrossel/[cid]/gerar-imagem.tsx";
const EDITOR = "app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx";
const REVISAO = "app/bonus/[id]/carrossel/[cid]/revisao.tsx";

const T_TABELA = INTEG("testes-integracao/bonus-imagens-tabela.integracao.ts");
const T_PARTIDA = INTEG("testes-integracao/esquema-de-partida.integracao.ts");
const T_COPIA = PURA("tests/bonus-ilustracao-copia.test.ts");
const T_ERRO = PURA("tests/bonus-erro-ilustracao.test.ts");
const T_PROMPT = PURA("tests/bonus-prompt-ilustracao.test.ts");
const T_TEXTOS = PURA("tests/bonus-imagem-textos.test.ts");
const T_OPENAI = PURA("tests/bonus-imagem-openai.test.ts");
const T_JPEG = PURA("tests/bonus-imagem-jpeg.test.ts");
const T_ESTADO = PURA("tests/bonus-imagem-estado.test.ts");
const T_REPO = INTEG("testes-integracao/bonus-imagem-repositorio.integracao.ts");
const T_PROCESSO = INTEG("testes-integracao/bonus-imagem-processo.integracao.ts");
const T_PAGINAS = PURA("tests/bonus-imagem-paginas.test.ts");
const T_TELA = TELA("testes-dom/bonus-gerar-imagem.dom.tsx");

const MUTACOES = [
  // 6.1 a migração 018
  { nome: "6.1: sem o check do caminho", arq: MIGRACAO,
    de: "    check ((estado = 'pronta') = (caminho is not null)),", para: "    check (true),",
    cmd: T_TABELA, caso: "o banco recusa pronta sem caminho" },
  { nome: "6.1: o carrossel apagado leva a linha junto", arq: MIGRACAO,
    de: "  carrossel_id uuid references carrosseis_gerados (id) on delete set null,",
    para: "  carrossel_id uuid references carrosseis_gerados (id) on delete cascade,",
    cmd: T_TABELA, caso: "o carrossel apagado deixa a linha, com o carrossel nulo" },
  { nome: "6.1: a 018 fora da marca d'água", arq: ESQUEMA,
    de: '      de: "018-imagens-geradas.sql",', para: '      de: "018-outra.sql",',
    cmd: T_PARTIDA, caso: "a MARCA D'ÁGUA cobre a pasta inteira" },
  // 6.2 as regras copiadas do Labs
  { nome: "6.2: a tradução das recusas mudada só no Chat", arq: ERRO,
    de: "3) a chave tem permissão de escrita em imagens.", para: "3) a chave tem permissão.",
    cmd: T_COPIA, caso: "lib/bonus/erro-ilustracao.ts é o arquivo do Labs, byte a byte" },
  { nome: "6.2: o filtro do pedaço da chave tirado do arquivo do Labs", arq: ERRO,
    de: '  const detalhe = erro.message?.trim().replace(PEDACO_DA_CHAVE, "sk-…");', para: "  const detalhe = erro.message?.trim();",
    cmd: T_ERRO, caso: "tira o pedaço da chave que a OpenAI põe na mensagem do 401" },
  // 6.3 a chamada à OpenAI e o JPEG
  { nome: "6.3: a chave que vaza para a frase", arq: OPENAI,
    de: "  if (!resposta.ok) return { ok: false, erro: tirarChave(mensagemDaOpenAI(resposta.status, corpo), chave) };",
    para: "  if (!resposta.ok) return { ok: false, erro: mensagemDaOpenAI(resposta.status, corpo) };",
    cmd: T_OPENAI, caso: "a chave nunca vai para a frase: nem o pedaço que a OpenAI devolve, nem a chave inteira" },
  { nome: "6.3: o PNG do Labs no lugar do JPEG", arq: OPENAI,
    de: '  output_format: "jpeg",', para: '  output_format: "png",',
    cmd: T_OPENAI, caso: "o corpo leva o modelo medido e escolhido, em JPEG, com a cena embrulhada nas regras, e com prazo" },
  { nome: "6.3: sem a chave, chama assim mesmo", arq: OPENAI,
    de: "  if (!chave) return { ok: false, erro: TEXTO_SEM_CHAVE_DA_IMAGEM };\n", para: "",
    cmd: T_OPENAI, caso: "sem a chave, recusa sem chamar" },
  { nome: "6.3: o que não é JPEG passa", arq: REGRAS,
    de: '  if (!medidas) return "formato";', para: "  if (!medidas) return null;",
    cmd: T_JPEG, caso: "o que não é JPEG é formato" },
  { nome: "6.3: a tabela de Huffman lida como as medidas", arq: JPEG,
    de: "marca <= 0xcf && marca !== 0xc4 && marca !== 0xc8", para: "marca <= 0xcf && marca !== 0xc8",
    cmd: T_JPEG, caso: "a tabela de Huffman (C4) não é confundida com as medidas" },
  // 6.4 o teto
  { nome: "6.4: o teto sem a trava", arq: REPO,
    de: "    await tx.query(`select pg_advisory_xact_lock($1::bigint)`, [TRAVA_DO_TETO_DA_IMAGEM]);\n", para: "",
    cmd: T_REPO, caso: "a reserva espera a trava do teto: contar e inserir não correm em paralelo" },
  { nome: "6.4: o teto só conta as prontas", arq: REPO,
    de: "where criado_em > now() - interval '24 hours'`;", para: "where criado_em > now() - interval '24 hours' and estado = 'pronta'`;",
    cmd: T_REPO, caso: "com 10 em 24 h, de qualquer estado, o décimo primeiro é recusado, sem linha nova" },
  { nome: "6.4: dois pedidos no mesmo slide", arq: REPO,
    de: '    if (gerando.length) return { ok: false as const, motivo: "gerando" as const, hoje };\n', para: "",
    cmd: T_REPO, caso: "o segundo pedido do mesmo slide é recusado; outro slide passa" },
  { nome: "6.4: a pronta marcada fora de gerando", arq: REPO,
    de: "set estado = 'pronta', caminho = $2, terminado_em = now()\n      where id = $1 and estado = 'gerando'",
    para: "set estado = 'pronta', caminho = $2, terminado_em = now()\n      where id = $1",
    cmd: T_REPO, caso: "pronta e falhou só saem de gerando, e uma vez" },
  { nome: "6.4: a travada não vira travada", arq: REGRAS,
    de: ">= TRAVADA_IMAGEM_MS ? { tipo: \"travada\" }", para: ">= TRAVADA_IMAGEM_MS * 10 ? { tipo: \"travada\" }",
    cmd: T_ESTADO, caso: "gerando depois do prazo é travada" },
  // 6.5 o processo
  { nome: "6.5: o pedir sem conferir a descrição", arq: PROCESSO,
    de: '  if (!descricao.ok) return { ok: false, recusa: { motivo: "descricao", texto: descricao.mensagem } };\n', para: "",
    cmd: T_PROCESSO, caso: "recusa a descrição curta, sem linha nova" },
  { nome: "6.5: o pedir sem conferir o espaço", arq: PROCESSO,
    de: '  if (!comEspaco(c.escolhas, p.numero)) return { ok: false, recusa: { motivo: "sem_espaco", numero: p.numero } };\n', para: "",
    cmd: T_PROCESSO, caso: "recusa o slide só texto, sem linha nova" },
  { nome: "6.5: o apagar depois do guardarImagem (achado 89)", arq: PROCESSO,
    de: "    // A linha `gerando` vence pelo prazo, aparece como falha e conta no teto; a foto fica no slide.",
    para: "    // A linha `gerando` vence pelo prazo, aparece como falha e conta no teto; a foto fica no slide.\n    await apagarSemDerrubar([caminho]);",
    cmd: T_PROCESSO, caso: "a falha ao marcar a linha, depois de guardar, deixa a foto no bucket e no slide" },
  { nome: "6.5: a falha ao guardar não apaga o que subiu (achado 89)", arq: PROCESSO,
    de: "    subido = assinado.caminho;\n", para: "",
    cmd: T_PROCESSO, caso: "a falha ao guardar apaga do bucket o que subiu" },
  { nome: "6.5: a imagem gerada assinada como slide pronto", arq: PROCESSO,
    de: 'destino: "foto", arquivo,', para: 'destino: "slide", arquivo,',
    cmd: T_PROCESSO, caso: "vai para bonus-foto na pasta da conta, o slide guarda como foto, a anterior sai, e a linha fica pronta" },
  // 6.6 a action e a consulta
  { nome: "6.6: a geração dentro da action, sem after (achado 88)", arq: ACOES,
    de: "  after(() => gerarImagem({ reservaId, id, numero, descricao, contas }));",
    para: "  await gerarImagem({ reservaId, id, numero, descricao, contas });",
    cmd: T_PAGINAS, caso: "não espera a imagem: a geração vai para o after()" },
  { nome: "6.6: a consulta como action (achado 88)", arq: ROTA,
    de: 'export const runtime = "nodejs";', para: '"use server";\nexport const runtime = "nodejs";',
    cmd: T_PAGINAS, caso: "é uma rota GET, fora da fila das actions" },
  { nome: "6.6: a consulta sem a sessão", arq: ROTA,
    de: "  if (!isValidSession(jarra.get(SESSION_COOKIE)?.value)) return respostaDaConsulta({ erro: TEXTO_ARTE_SEM_SESSAO }, 401);\n", para: "",
    cmd: T_PAGINAS, caso: "o GET confere a sessão antes de qualquer outra coisa" },
  { nome: "6.6: a consulta em cache", arq: CONSULTA,
    de: '"Cache-Control": "private, no-store"', para: '"Cache-Control": "public, max-age=60"',
    cmd: T_PAGINAS, caso: "nunca fica em cache: o estado muda a cada geração" },
  { nome: "6.6: a travada some da consulta", arq: CONSULTA,
    de: '  if (estado.tipo === "travada") return { estado: "falhou", hoje, texto: TEXTO_IMAGEM_TRAVADA };\n', para: "",
    cmd: T_PROCESSO, caso: "a linha travada pelo prazo vira falha, com a frase da travada" },
  // 6.7 a tela
  { nome: "6.7: o card sem o Gerar imagem", arq: CARD,
    de: "{podeSubir && gerarImagem && (", para: "{false && gerarImagem && (",
    cmd: T_TELA, caso: "aparece no slide com espaço, e não no só texto" },
  { nome: "6.7: o Gerar imagem com o carrossel na fila", arq: CARD,
    de: "{podeSubir && gerarImagem && (", para: "{gerarImagem && (",
    cmd: T_TELA, caso: "não aparece com o carrossel na fila" },
  { nome: "6.7: os outros botões não se desligam", arq: CARD,
    de: "disabled={enviando || gerandoImagem}", para: "disabled={enviando}",
    cmd: T_TELA, caso: "enquanto gera, os outros botões da imagem daquele slide ficam desligados" },
  { nome: "6.7: o aviso de texto some", arq: GERAR,
    de: "{avisoDeTexto && <p", para: "{false && <p",
    cmd: T_TELA, caso: "avisa para pôr o texto entre aspas, e depois para conferir a grafia, sem travar o botão" },
  { nome: "6.7: o teto não trava o Gerar", arq: GERAR,
    de: "disabled={ocupado || noTeto}", para: "disabled={ocupado}",
    cmd: T_TELA, caso: "no teto do dia, o Gerar trava com a frase do teto" },
  { nome: "6.7: a pronta não troca a miniatura", arq: EDITOR,
    de: "        setVersoes((vs) => vs.map((x, i) => (i === numero - 1 ? versaoDaMiniatura : x)));\n", para: "",
    cmd: T_TELA, caso: "o pedido volta na hora, e a consulta põe a imagem no espaço com a miniatura nova" },
  { nome: "6.7: a página não começa em Gerando", arq: EDITOR,
    de: "      gerandoInicial: g.gerando.includes(numero),", para: "      gerandoInicial: false,",
    cmd: T_TELA, caso: "a página que abre com a geração em andamento começa o card em Gerando…, e acompanha" },
  { nome: "6.7: o Gerar de novo sem a descrição", arq: EDITOR,
    de: "      descricaoInicial: g.descricoes[numero] ?? null,", para: "      descricaoInicial: null,",
    cmd: T_TELA, caso: "o Gerar de novo volta com o estilo e a última descrição do slide" },
  { nome: "6.7: a página não diz o que está gerando", arq: REVISAO,
    de: '        .filter((l) => estadoDaImagem(l, agora).tipo === "gerando")', para: "        .filter(() => false)",
    cmd: T_PAGINAS, caso: "a action do pedido, a conta do dia e o que está gerando, pelo relógio do banco" },
  // 6.10 as regras do Chat (adendo de 09/10)
  { nome: "6.10: o pedido medido muda uma letra", arq: PROMPT,
    de: '"Luz dramática e quente, de abajur', para: '"Luz dramática e fria, de abajur',
    cmd: T_PROMPT, caso: "o pedido A do apêndice da spec sai byte a byte" },
  { nome: "6.10: a regra do texto sai do fim", arq: PROMPT,
    de: "    FUNDO,\n    PROIBICAO_DE_PESSOA_REAL,\n    trechos.length > 0 ? textoExato(trechos) : PROIBICAO_DE_TEXTO,\n",
    para: "    trechos.length > 0 ? textoExato(trechos) : PROIBICAO_DE_TEXTO,\n    FUNDO,\n    PROIBICAO_DE_PESSOA_REAL,\n",
    cmd: T_PROMPT, caso: "a ordem: estilo, atalho, cena, fundo, pessoa real e, por último, o texto" },
  { nome: "6.10: o texto entre aspas ignorado", arq: PROMPT,
    de: "    trechos.length > 0 ? textoExato(trechos) : PROIBICAO_DE_TEXTO,\n", para: "    PROIBICAO_DE_TEXTO,\n",
    cmd: T_PROMPT, caso: "com aspas retas ou curvas, pede exatamente aqueles trechos, por último, com aspas retas" },
  { nome: "6.10: a pessoa real sai do pedido", arq: PROMPT,
    de: "    PROIBICAO_DE_PESSOA_REAL,\n    trechos.length", para: "    trechos.length",
    cmd: T_PROMPT, caso: "a pessoa real e o fundo entram sempre, com aspas e sem aspas" },
  { nome: "6.10: o nome de marca sem a letra simples", arq: PROMPT,
    de: "Se um deles for o nome de uma marca ou de um produto, escreva-o em letras simples e comuns, ", para: "",
    cmd: T_PROMPT, caso: "o nome de marca entre aspas sai em letra simples, sem logo" },
  { nome: "6.10: o limite das aspas não confere", arq: PROMPT,
    de: '  if (aspas.trechos.join("").length > MAX_TEXTO_ENTRE_ASPAS) {', para: "  if (false) {",
    cmd: T_PROMPT, caso: "recusa o texto entre aspas acima de 120 e aceita exatamente nele" },
  { nome: "6.10: a aspa sem par passa", arq: PROMPT,
    de: '  if (aspas.semPar) return { ok: false, mensagem: "Feche as aspas do texto que deve aparecer na imagem." };\n', para: "",
    cmd: T_PROMPT, caso: "recusa a aspa sem par, com a frase dela" },
  { nome: "6.10: a cena conta o texto entre aspas no mínimo", arq: PROMPT,
    de: '  const semAspas = lida.cena.replace(/["“][^"”]*["”]/g, " ").replace(/\\s+/g, " ").trim();',
    para: '  const semAspas = lida.cena.replace(/\\s+/g, " ").trim();',
    cmd: T_PROMPT, caso: "recusa a cena vazia e a curta, contadas sem os atalhos e sem o texto entre aspas" },
  { nome: "6.10: dois estilos passam", arq: PROMPT,
    de: '  if (lida.repetido === "estilo") return { ok: false, mensagem: "Escolha um estilo só para a imagem." };\n', para: "",
    cmd: T_PROMPT, caso: "recusa dois estilos e dois atalhos" },
  // 6.11 o modelo novo
  { nome: "6.11: o apelido no lugar da versão medida", arq: OPENAI,
    de: '  model: "gpt-image-2.5-flare-2026-09-08",', para: '  model: "gpt-image-2.5-flare",',
    cmd: T_OPENAI, caso: "o corpo leva o modelo medido e escolhido, em JPEG, com a cena embrulhada nas regras, e com prazo" },
  { nome: "6.11: a qualidade trocada", arq: OPENAI,
    de: '  quality: "high",', para: '  quality: "medium",',
    cmd: T_OPENAI, caso: "o corpo leva o modelo medido e escolhido, em JPEG, com a cena embrulhada nas regras, e com prazo" },
  { nome: "6.11: o modelo que sai do ar volta", arq: OPENAI,
    de: '  model: "gpt-image-2.5-flare-2026-09-08",', para: '  model: "gpt-image-1",',
    cmd: T_OPENAI, caso: "o modelo que a OpenAI desliga em 23/10/2026 não está no corpo" },
  // 6.12 a tela
  { nome: "6.12: o estilo não vai para a descrição", arq: GERAR,
    de: "descricao: comEstilo(estilo, descricao) });", para: "descricao });",
    cmd: T_TELA, caso: "o estilo começa em Cena de cinema e vai para o começo da descrição" },
  { nome: "6.12: a regra do manual do perfil some da tela", arq: GERAR,
    de: "              <p className={hint}>{TEXTO_REGRAS_DA_IMAGEM}</p>\n", para: "",
    cmd: T_TELA, caso: "mostra a regra do manual do perfil junto do campo" },
  { nome: "6.12: o Gerar de novo perde o estilo", arq: GERAR,
    de: "useState<ChaveDoEstilo>(inicial.estilo);", para: 'useState<ChaveDoEstilo>("cinema");',
    cmd: T_TELA, caso: "o Gerar de novo volta com o estilo e a última descrição do slide" },
  { nome: "6.12: com aspas, o aviso não manda conferir a grafia", arq: TEXTOS,
    de: "  if (trechosEntreAspas(descricao).trechos.length > 0) return TEXTO_CONFIRA_A_GRAFIA;\n", para: "",
    cmd: T_TEXTOS, caso: "com aspas, ela ouve que a grafia se confere antes de publicar" },
];

const filtro = process.argv[2];
const escolhidas = MUTACOES.filter((x) => !filtro || x.nome.includes(filtro));
const ehInteg = (m) => m.cmd.includes("vitest.integracao.config.ts");
if (escolhidas.some(ehInteg) && !process.env.DATABASE_URL_TESTES?.trim()) {
  console.log("✗ há mutação INTEG e DATABASE_URL_TESTES está vazia: a integração iria para a produção. Nada foi mutado.");
  process.exit(1);
}
let ruins = 0;
for (const m of escolhidas) {
  const original = readFileSync(m.arq);
  const texto = original.toString("utf8");
  const crlf = texto.includes("\r\n");
  const de = crlf ? m.de.replace(/\n/g, "\r\n") : m.de;
  const para = crlf ? m.para.replace(/\n/g, "\r\n") : m.para;
  const n = texto.split(de).length - 1;
  if (n !== 1) {
    console.log(`✗ ${m.nome}: o trecho aparece ${n} vez(es)`);
    ruins++;
    continue;
  }
  writeFileSync(m.arq, texto.replace(de, () => para), "utf8");
  let saida = "";
  let caiu = false;
  try {
    saida = execSync(`${m.cmd} 2>&1`, { encoding: "utf8", stdio: "pipe", env: { ...process.env }, maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    caiu = true;
    saida = `${e.stdout ?? ""}${e.stderr ?? ""}`;
  } finally {
    writeFileSync(m.arq, original);
  }
  if (ehInteg(m) && !saida.includes("ALVO: banco de TESTE")) {
    console.log(`✗ ${m.nome}: a integração não imprimiu "ALVO: banco de TESTE". Pare e confira o banco.`);
    ruins++;
    continue;
  }
  const casoCaiu = saida.split("\n").some((l) => /FAIL|×/.test(l) && l.includes(m.caso));
  if (!(caiu && casoCaiu)) ruins++;
  console.log(`${caiu && casoCaiu ? "✓" : "✗"} ${m.nome}: o caso "${m.caso}" ${casoCaiu ? "caiu" : "NÃO caiu"}`);
}
console.log(`${escolhidas.length} mutações, ${ruins} ruins`);
process.exit(ruins ? 1 : 0);
```
