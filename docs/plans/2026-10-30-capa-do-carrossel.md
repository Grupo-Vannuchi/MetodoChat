# O gerador de bônus — Etapa 11: a capa do carrossel — Plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: `superpowers:subagent-driven-development`
> (recomendada) ou `superpowers:executing-plans`, fase por fase. Os passos usam caixa de
> seleção (`- [ ]`) para acompanhar.

**Objetivo:** o slide 1 de um carrossel de 2 slides ou mais ganha um quarto jeito, "Capa com imagem": uma
imagem no slide inteiro, subida ou gerada por IA em pé, com a sombra subindo do pé, o gancho grande em
maiúscula por cima e a conta pequena no topo. A capa vale para o carrossel do bônus e para o avulso, vai à
fila como os slides com foto, trava o Publicar sem imagem ou com o gancho que não cabe, e sai do bucket
com o apagar.

**Arquitetura:** a capa mora numa chave nova da coluna `arte`, `capa: true`, gravada pelo mesmo caminho do
"Só texto". As regras são puras: o jeito do slide 1 (`lib/bonus/arte-escolhas.ts`), o destino `capa` no
bucket, em `bonus-capa/`, a imagem que vale em cada jeito (`valeNoSlide`), a régua e o recorte da foto da
capa (`lib/bonus/publicar-regras.ts`). O desenho é próprio, em três arquivos novos: os números
(`capa-geometria.ts`), a medida do gancho, com a conta exata de hoje (`capa-medida.ts`), e o desenho do
Satori (`capa-desenho.tsx`). A rota da arte ganha o ramo da capa, a versão da miniatura passa a levar a
capa nas seis chamadas, o publicar e o pedido de imagem por IA aceitam o slide 1 em capa, e o card do slide
1 ganha a caixa e os botões. `arte-geometria.ts` e os vetores divididos com o Labs não mudam.

**Stack:** a do projeto, no Next.js 16.4.3: Vitest (as três suítes), Testing Library no jsdom, o Satori do
`next/og` com o `sharp` nos testes de pixel, e o Postgres no container para a integração.

**Spec:** `docs/specs/2026-10-13-capa-do-carrossel.md` (commits `0b754b3` e `e6aadbb`, revisada pela
auditoria com o achado 98 absorvido, liberada em `e6aadbb` e lida pelo Eduardo; remedida em 30/10 sobre a
`main` em `9b0c3e6` nos commits `1c1445b` e `d104576`, com o achado 147, liberada de novo em `d104576`).
Leia antes de começar: este plano não repete o porquê, só como construir.

**A `main` recebida (30/10).** De `af714d3` a `9b0c3e6`, a `main` recebeu a Etapa 10 (a lista em abas e o
apagar), a hora marcada, o achado 100, o RLS e as migrações 019 e 020, a sessão conferida nas actions, a
chave da Meta fora da página, o Next 16.4.3, o cron e o OAuth, e o enquadramento do `/publicar`. A branch
recebeu a `main` por merge em `1fe61b8`, sem conflito, e a spec foi remedida sobre ela.

**Ensaio do plano (30/10):** o código deste plano foi escrito e testado fase a fase numa cópia isolada do
repositório (`git worktree`, sem push, branch local `ensaio-capa-3`, saída de `d104576`), e todo bloco de
código abaixo foi tirado do git dessa cópia por um gerador, sem cópia à mão. Os commits do ensaio são a
FASE 0 `8ae26b6`, a 1 `fc1eab4`, a 2 `0401c5a`, a 3 `94feb66`, a 4 `51501e1`, a 5 `5678c98`, a 5-bis
`523d0fa`, a 6 `4aab634`, a 7 `d91c900`, a 8 `86f2678` e a 9 `55ba1fb`, com as mensagens deste plano. O
ensaio foi refeito duas vezes:
- a primeira tentativa (`ensaio-capa`) foi refeita do zero depois do achado 148 (abaixo), como
  `ensaio-capa-2`: a FASE 0 entrou antes, e as fases 1 a 3 foram reaplicadas por `cherry-pick`, com o mesmo
  `patch-id` (conferido pela auditoria);
- na primeira rodada das provas de mutação sobre a `ensaio-capa-2` (até `e3d8115`), 7 de 71 passaram sem
  derrubar caso. Três rodavam o arquivo de teste errado: a action da arte tem guarda em
  `tests/bonus-capa-paginas.test.ts`, e a reserva tem o caso em
  `testes-integracao/bonus-publicar-repositorio.integracao.ts`, e o apêndice passou a rodá-los. As outras
  quatro eram buracos nos testes, e ganharam um caso cada, na fase delas: a medida exata da imagem da IA
  (FASE 1), a miniatura da lista com o slide 1 em capa (FASE 3), a imagem gerada na capa entrando como a da
  capa e o jeito de cada imagem lido pelo caminho na página (FASE 8). A `ensaio-capa-3` é a
  `ensaio-capa-2` reaplicada por `cherry-pick`, com esses casos: as fases 0, 2, 4, 5, 5-bis, 6, 7 e 9 têm
  o mesmo `patch-id` de antes, e a árvore do fim difere da `e3d8115` só nos quatro arquivos de teste.

Os números são os dessa cópia:
- lint e `tsc` limpos em cada fase; no fim, 136 arquivos e 3 524 casos puros (127 arquivos e 3 409 na base) e
  28 arquivos e 279 de tela (27 arquivos e 262 na base);
- `next build` (Turbopack) limpo, com o `node_modules` próprio na cópia, "MIGRAÇÃO PULADA", e o `AGENTS.md`
  intacto;
- a varredura "SEM VAZAMENTO em A nem em C, nas duas varreduras";
- integração no container, com o `.env.local` vazio na cópia (achado 140): 52 arquivos, 600 passaram e 8 pularam (51 arquivos, 575 passaram e 8 pularam na
  base);
- cada fase foi vista falhar antes do código e passar depois, com os números no passo dela;
- as 71 provas de mutação do Apêndice A derrubaram, cada uma, o caso esperado;
- o plano, aplicado do zero numa cópia limpa, dá os 58 arquivos iguais ao fim do ensaio, byte a byte;
- a guarda do diff (FASE 10, passo 4) mostrou só os arquivos do mapa abaixo, com 0 diferença em
  `lib/bonus/arte-geometria.ts` e em `tests/vetores-da-arte.json`.

**Os achados da remedição e do ensaio (30/10), absorvidos neste plano:**
- **147 (CORRIGIR, resolvido na spec em `d104576`):** a versão da miniatura é chamada em seis lugares, e não
  em quatro. As seis levam a capa (FASE 3).
- **148 (ANOTAR, resolvido no ensaio):** o caso da varredura do arredondamento, em
  `tests/publicacao-enquadramento.test.ts`, levava de 3,4 a 5,4 s nesta máquina, contra o limite de 5 s do
  Vitest, e caiu uma vez por tempo numa rodada inteira. Ele ganha um prazo próprio de 60 s (FASE 0). É o
  único arquivo de fora do gerador de bônus que este plano muda.
- **149 (ANOTAR, resolvido no ensaio):** a foto da capa declarada com 0 byte passava (FASE 5-bis, abaixo).
- **140 (de 29/10):** a integração exige um `.env.local` na cópia, e ele tem de estar VAZIO (FASE 0).

**A decisão da FASE 5, aceita pela auditoria em 30/10:** a assinatura da foto da capa não passa pela
`decisaoDeAssinatura`. A faixa dela (a proporção de 0,8 a 1,91 e o teto de bytes) é a regra da cópia que vai à
fila, e ela recusaria a imagem em pé da IA, de 1024×1536 (0,667). A régua da capa
(`problemaDaFotoDaCapa`) decide sozinha: 4:5 com 1% de tolerância, de 1080×1350 até o dobro, ou exatamente
1024×1536, e de 1 byte a 2 MB. A imagem da capa nunca vai à fila: vai a arte desenhada por cima dela, que
passa pela faixa de sempre. Por isso a régua da capa recusa o zero por conta própria (achado 149).

O ensaio achou estas coisas, já resolvidas neste plano:
1. **Uma imagem de outro jeito conta como a que falta também no publicar** (a nota da revisão da spec, levada
   ao servidor). Sem isso, a imagem da capa guardada no slide 1, com a capa desligada, seria copiada para a
   fila como um slide pronto. `valeNoSlide` decide nos três lugares: a tela, as faltas e o servidor.
2. **O formato da imagem por IA é decidido no pedido** (`pedirImagem` devolve o `formato`) e levado à
   geração (`gerarImagem({ formato })`, obrigatório): a geração roda depois da resposta, num `after`, e não
   relê a capa. Os pedidos medidos da Etapa 6 continuam iguais, byte a byte (o teste do dono que lê o
   apêndice da spec da 6 passa sem mudança).
3. **A guarda da rota da arte** (`tests/bonus-arte-paginas.test.ts`) procura a chamada literal
   `fotoDoEspaco(`: a rota chama `fotoDaCapa(` e `fotoDoEspaco(` em ramos explícitos, e não por uma função
   escolhida antes.
4. **As medidas da capa, no ensaio:** o gancho mais longo do schema (120 caracteres, em maiúscula) cabe no
   degrau de 80, com a tinta de y 681 a 1225; o das letras largas cabe no de 64, com a tinta até x 964; a
   cedilha desce até y 1239, dentro da margem do pé (1240); e a palavra de 30 letras não cabe em degrau
   nenhum, e o card avisa.
5. **O carrossel avulso dos testes de integração tem a origem `livre`** (`OrigemDoCarrossel` não tem
   "avulso").
6. **O teste puro tem de terminar em `.test.ts`:** a suíte pura só inclui `tests/**/*.test.ts`, e o desenho
   da capa é testado por `tests/bonus-capa-desenho.test.ts`, que monta o JSX com `createElement`.

## Restrições globais

- **Branch:** `capa-do-carrossel`, com a `main` em `9b0c3e6` recebida no merge `1fe61b8`. Nunca commitar nem
  empurrar na `main`: ela não está protegida, e um push nela dispara o deploy na Vercel. Conferir
  `git branch --show-current` antes de cada commit.
- **`git add` com caminho explícito.** Nunca `-A` nem `.`.
- **Commit no estilo do Vinícius:** uma frase dizendo o efeito, sem prefixo, o porquê no corpo, sem
  rodapé de IA. Autor: Eduardo Kobal <162614913+Eduardokobal@users.noreply.github.com>.
- **Antes de cada commit**, varrer os arquivos tocados com `node "$SCRATCH/varrer-texto.mjs" <arquivos>`.
- **O commit é um comando à parte**, depois de ler a saída dos testes.
- **Fim de linha:** converta antes os arquivos que a fase toca (`node "$SCRATCH/para-lf.mjs" <arquivo>`) e
  aplique os diffs com `git apply`, ou à mão.
- **Os arquivos desta etapa são os do mapa abaixo, e mais nenhum.** Nada do `/publicar` (`app/publicar/`,
  `lib/publicacao.ts`), da rota de assinar (`app/api/`), da fila e do dreno (`lib/queue-drain.ts`,
  `lib/engine.ts`), do bucket (`lib/bucket.ts`), das automações, das migrações, dos `scripts` nem do
  `package`. `lib/bonus/arte-geometria.ts` e `tests/vetores-da-arte.json` ficam com 0 diferença.
- **Sem migração.** O build do merge tem de dizer "Nada a aplicar: as 21 migrações".
- **Uma rodada de integração de cada vez**, sempre com `DATABASE_URL_TESTES` apontando para o container
  (`127.0.0.1:5434`). Toda rodada tem de imprimir `[rede-global] ALVO: banco de TESTE`. Nunca rode com a
  variável vazia: ela cai na `DATABASE_URL`, que é **produção**.
- **`next build` sem as variáveis de agente:** `env -u CLAUDECODE -u AI_AGENT ...`, e `git diff AGENTS.md`
  depois.
- **Escrita em produção só com o OK do Eduardo**, a hora mandada à auditoria antes, e o "pode" dela.
- **Ao fechar cada fase**, avisar o auditor (`metodochat-7f` em 30/10; o nome muda por sessão, então conferir
  no `ListAgents`) com o hash.
- **Toda linha citada (`arquivo:linha`) diz o SHA em que foi medida.**
- **Nenhuma arroba solta** em commit, PR ou mensagem do merge (achado 145): o @ de uma conta vai entre
  crases.

## Mapa dos arquivos

| arquivo | responsabilidade | fase |
|---|---|---|
| `tests/publicacao-enquadramento.test.ts` | o prazo próprio da varredura do arredondamento (achado 148) | 0 |
| `lib/bonus/arte-escolhas.ts` | `capa` nas escolhas, `ehCapa`, o espaço que a capa não tem, `lerCapaDoFormulario` e as recusas dele | 1 e 4 |
| `lib/bonus/publicar-regras.ts` | o destino `capa` (`bonus-capa/`), o jeito pelo prefixo, `valeNoSlide`, a régua e o recorte da foto da capa, `capaDaArte` e `SEM_CAPA` | 1, 3 e 5-bis |
| `tests/bonus-capa-regras.test.ts` (novo) | as regras puras da capa, com o zero da régua (achado 149) | 1 e 5-bis |
| `tests/bonus-arte-escolhas.test.ts` | as escolhas vazias ganham `capa: false` | 1 |
| `lib/bonus/capa-geometria.ts` (novo) | os números da capa: os degraus, o bloco, a entrelinha, a conta, as sombras e o fundo | 2 |
| `lib/bonus/capa-medida.ts` (novo) | a maiúscula antes de medir, a composição em negrito e o degrau que cabe | 2 |
| `lib/bonus/capa-desenho.tsx` (novo) | o desenho da capa no Satori | 2 |
| `lib/bonus/arte-resposta.tsx` | a resposta da arte com o desenho da capa | 2 |
| `lib/bonus/arte-foto.ts` | `fotoDaCapa`, a busca da imagem da capa na pasta da conta | 2 |
| `lib/bonus/arte-rota.ts` | o ramo da capa na rota da arte, e a versão só do que foi desenhado | 2 |
| `tests/bonus-capa-medida.test.ts`, `tests/bonus-capa-desenho.test.ts`, `tests/bonus-capa-rota.test.ts`, `tests/bonus-capa-foto.test.ts` (novos) | a medida, o desenho por pixel, a rota e a busca da imagem | 2 |
| `lib/bonus/arte-tela.ts` | a capa, obrigatória, na versão da miniatura | 3 |
| `app/bonus/carrossel-actions.ts` | a capa nas duas chamadas da versão; o campo da capa no salvar da arte | 3 e 4 |
| `app/bonus/[id]/carrossel/[cid]/revisao.tsx` | a capa na versão; a capa inicial do editor; o jeito pelo caminho | 3, 7 e 8 |
| `lib/bonus/imagem-consulta.ts` | a capa na versão da consulta da imagem | 3 |
| `lib/bonus/carrosseis-tela.ts` | a capa na miniatura da lista de carrosséis | 3 |
| `lib/bonus/publicar-processo.ts` | a capa na versão do guardar; a assinatura da foto da capa; o publicar com a capa | 3, 5 e 7 |
| `tests/bonus-capa-versoes.test.ts` (novo) | a versão com a capa, e a de hoje, byte a byte, sem ela | 3 |
| `tests/bonus-arte-tela.test.ts`, `tests/bonus-carrosseis-tela.test.ts`, `tests/bonus-publicar-regras.test.ts`, `testes-integracao/bonus-imagem-processo.integracao.ts` | as chamadas de hoje passam `SEM_CAPA` | 3 e 6 |
| `lib/bonus/carrossel-repositorio.ts` | a capa gravada com o "Só texto", na mesma linha travada | 4 |
| `lib/bonus/arte-textos.ts` | as frases das recusas da capa; a do gancho que não cabe nela | 4 e 8 |
| `testes-integracao/bonus-capa-escolhas.integracao.ts` (novo) | ligar e desligar a capa, com a trava do publicar e as recusas | 4 |
| `tests/bonus-capa-paginas.test.ts` (novo) | as guardas da capa nas páginas, nas actions e nas rotas da imagem | 4, 6, 7 e 8 |
| `testes-integracao/bonus-carrossel-processo.integracao.ts`, `testes-integracao/bonus-publicar-repositorio.integracao.ts` | as chamadas de hoje passam a capa desligada | 4 e 7 |
| `app/bonus/[id]/carrossel/[cid]/imagem-no-navegador.ts` | o recorte da foto da capa em 4:5 (`prepararCapa`) | 5 |
| `app/bonus/publicar-actions.ts` | a action aceita o destino `capa` | 5 |
| `lib/bonus/publicar-repositorio.ts` | a reserva da imagem pelo jeito; o conferido com a capa | 5 e 7 |
| `lib/bonus/publicar-textos.ts` | as recusas da capa no publicar | 5 |
| `testes-dom/bonus-publicar-imagem.dom.tsx` | a foto da capa recortada no navegador | 5 |
| `testes-integracao/bonus-publicar-processo.integracao.ts` | a foto da capa, a reserva e o publicar com a capa | 3, 4, 5 e 7 |
| `app/bonus/imagem-actions.ts` | o formato do pedido levado à geração | 6 |
| `lib/bonus/imagem-openai.ts` | `CORPO_DA_CAPA` (1024×1536) e `gerarCapaNaOpenAI` | 6 |
| `lib/bonus/imagem-processo.ts` | o pedido e a geração da capa, no mesmo teto | 6 |
| `lib/bonus/imagem-regras.ts` | `FormatoDaImagem` e `problemaDaCapaGerada` | 6 |
| `lib/bonus/imagem-textos.ts` | a frase da capa gerada que não serve | 6 |
| `lib/bonus/prompt-ilustracao.ts` | `montarPromptDaCapa`, com a frase do espaço do gancho | 6 |
| `tests/bonus-capa-imagem.test.ts` (novo) | o pedido e o corpo da capa, e os da Etapa 6 iguais | 6 |
| `lib/bonus/publicar-estado.ts` | as faltas e as artes com a capa | 7 |
| `lib/bonus/publicar-cabimento.ts` | o corte da capa pela medida dela | 7 |
| `app/bonus/[id]/carrossel/[cid]/card-publicar.tsx` | a capa nas faltas e no corte do Publicar | 7 |
| `app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx` | o estado da capa, gravado com o "Só texto" e devolvido na recusa; o jeito da imagem gerada | 7 e 8 |
| `app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx` | a caixa "Capa com imagem", os botões, a miniatura e o aviso da capa | 7 e 8 |
| `tests/bonus-capa-publicar.test.ts` (novo) | as faltas, as artes e o corte com a capa | 7 |
| `tests/bonus-publicar-cabimento.test.ts`, `tests/bonus-publicar-estado.test.ts`, `testes-integracao/bonus-apagar-carrossel.integracao.ts` | as chamadas de hoje passam a capa desligada; o apagar leva a imagem da capa | 7 e 9 |
| `app/bonus/[id]/carrossel/[cid]/gerar-imagem.tsx` | o rótulo do botão, "Gerar com IA" na capa | 8 |
| `lib/bonus/arte-cabimento.ts` | `avisoDaCapa` | 8 |
| `testes-dom/bonus-capa-card.dom.tsx` (novo) | o card do slide 1 com a capa | 8 |
| `tests/bonus-apagar-regras.test.ts` | o apagar leva a imagem da capa | 9 |

---

## A CAPA

### FASE 0 — Começar da branch certa

- [ ] **Passo 1: conferir a main e a branch**

```bash
git ls-remote origin refs/heads/main
git switch capa-do-carrossel
git log --oneline --first-parent -6
```

Esperado: a `main` em `9b0c3e6` (ou depois dele); a branch, pelo primeiro pai, com o commit deste plano sobre
`d104576`, `1c1445b` e o merge da `main` (`1fe61b8`).

- [ ] **Passo 2: o `node_modules` próprio** (o Turbopack do `verify` recusa uma junção que aponte para fora
  da cópia)

```bash
npm ci
```

- [ ] **Passo 3: o `.env.local` VAZIO** (achado 140): a integração exige o arquivo na cópia como prova, e
  ele não pode ter nada. Se já existir com conteúdo, pare e avise.

```bash
test ! -s .env.local && : > .env.local && wc -c .env.local
```

Esperado: `0 .env.local`.

- [ ] **Passo 4: a linha de base**

```bash
npm test
npm run test:dom
npm run banco:teste
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npm run test:integracao
```

Esperado: 127 arquivos e 3 409 casos puros; 27 arquivos e 262 de tela; `[rede-global] ALVO: banco de TESTE`,
51 arquivos, 575 passaram e 8 pularam. Se o caso "toda saída, de 320 a 1440 de largura" cair com "Test timed out in 5000ms", é o
achado 148, que o passo 5 resolve: rode só ele de novo, uma vez. Na medição deste plano, a primeira rodada da
base, numa cópia nova, derrubou também "o leitor acha os arquivos de ação, inclusive os vinte da varredura de
26/10" (`tests/sessao-nas-actions.test.ts:115`, medido em `d104576`), sem o motivo registrado. Ele passou em
todas as rodadas seguintes: sozinho, duas vezes na base, e na suíte inteira da base, duas vezes, uma delas numa
outra cópia nova. Se ele cair, rode só o arquivo dele de novo, uma vez, e mande a saída ao auditor.

- [ ] **Passo 5: o prazo da varredura do enquadramento (achado 148)**

Em `tests/publicacao-enquadramento.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/publicacao-enquadramento.test.ts b/tests/publicacao-enquadramento.test.ts
index 4196e65..bc8ac8a 100644
--- a/tests/publicacao-enquadramento.test.ts
+++ b/tests/publicacao-enquadramento.test.ts
@@ -175,6 +175,9 @@ describe("geometriaDoEnquadramento", () => {
   // rota de assinar, depois de a pessoa montar o post inteiro. A auditoria contou, de 320 a 1440: a altura
   // do 4:5 arredondada ao mais próximo dá 560 saídas fora da faixa; para baixo, 0. A varredura passa cada
   // saída pela MESMA função que a rota usa, e confere o invariante pela razão.
+  // O PRAZO É PRÓPRIO (achado 148): são cerca de 20 mil geometrias e 250 mil `expect`, que levaram de 3,4 a
+  // 5,4 s nesta máquina em 30/10, contra os 5 s do padrão do vitest. O prazo padrão derrubava o caso por
+  // tempo, e não por defeito; os casos pesados do repositório já têm prazo próprio (bonus-arte-desenho).
   it("toda saída, de 320 a 1440 de largura, nas três proporções e nos dois modos, passa na regra da Meta", () => {
     const formas: [number, number][] = [];
     for (let l = 320; l <= 1440; l++) {
@@ -212,7 +215,7 @@ describe("geometriaDoEnquadramento", () => {
       }
     }
     expect(conferidas).toBeGreaterThan(18_000);
-  });
+  }, 60_000);
 });
 
 // UM SEGMENTO DO JPEG: o marcador, o tamanho (que conta os próprios 2 bytes) e o corpo.
```

```bash
npx vitest run tests/publicacao-enquadramento.test.ts
```

Esperado: os 62 casos passam.

```bash
node "$SCRATCH/varrer-texto.mjs" tests/publicacao-enquadramento.test.ts
test "$(git branch --show-current)" = "capa-do-carrossel"
git add tests/publicacao-enquadramento.test.ts
```

```bash
git commit -F - <<'MSG'
A varredura do enquadramento ganha prazo próprio, como os outros casos pesados

O caso que passa cada largura de 320 a 1440 pelas três proporções levava de
3,4 a 5,4 segundos nesta máquina, contra o limite de 5 do Vitest, e caiu uma
vez por tempo numa rodada inteira (achado 148). Ele ganha 60 segundos, e a
conta que ele confere não muda.
MSG
```

---

### FASE 1 — As regras puras da capa

**Arquivos:**
- Modificar: `lib/bonus/arte-escolhas.ts`, `lib/bonus/publicar-regras.ts`
- Criar: `tests/bonus-capa-regras.test.ts`
- Testar: `tests/bonus-arte-escolhas.test.ts`

**Interfaces:**
- Produz, em `lib/bonus/arte-escolhas.ts`: `EscolhasDaArte` com `capa: boolean` (só `true` com a chave
  `capa: true`, 2 slides ou mais e sem o "Só texto" no slide 1); `ehCapa(e, numero)`; `comEspaco` falso na
  capa; `RecusaDaCapa = "capa" | "capa_no_post" | "capa_e_so_texto"`, dentro de `RecusaDaArte`; e
  `lerCapaDoFormulario(bruto, soTexto, total)`, que devolve `{ ok: true; capa: boolean }` ou
  `{ ok: false; motivo: RecusaDaCapa }`.
- Produz, em `lib/bonus/publicar-regras.ts`: `DestinoDaImagem` com `"capa"` (prefixo `bonus-capa`);
  `jeitoDoCaminho` devolve `"capa"`; `valeNoSlide(e, numero, jeito)`; `problemaDaFotoDaCapa(largura, altura,
  bytes)`; `recorteDaCapa(largura, altura)`; `CAPA_MAX_LARGURA`, `CAPA_MAX_ALTURA`,
  `LARGURA_DA_CAPA_GERADA` (1024) e `ALTURA_DA_CAPA_GERADA` (1536); `CapaDaArte = { ligada: boolean;
  caminho: string | null }` e `capaDaArte(arte, total)`.

- [ ] **Passo 1: os testes**

Crie `tests/bonus-capa-regras.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { comEspaco, ehCapa, escolhasDaArte, lerCapaDoFormulario } from "@/lib/bonus/arte-escolhas";
import {
  ALTURA_DA_CAPA_GERADA,
  CAPA_MAX_ALTURA,
  CAPA_MAX_LARGURA,
  LARGURA_DA_CAPA_GERADA,
  capaDaArte,
  caminhoDaImagem,
  ehCaminhoDoDestino,
  fotosDaArte,
  imagensDaArte,
  jeitoDoCaminho,
  problemaDaFotoDaCapa,
  recorteDaCapa,
  valeNoSlide,
} from "@/lib/bonus/publicar-regras";

// AS REGRAS PURAS DA CAPA DO CARROSSEL (spec da Etapa 11, docs/specs/2026-10-13-capa-do-carrossel.md): o
// jeito do slide 1 guardado na coluna `arte`, o destino `capa` no bucket, a imagem que vale em cada jeito
// e a regra da foto da capa. Tudo o que a tela, as actions e a rota decidem sobre a capa sai daqui.

const PASTA = "17841400000000001";
const UUID = "0b2f4c1e-7a9d-4e3b-9c5f-1d2e3f4a5b6c";
const CAPA = `${PASTA}/bonus-capa/${UUID}.jpg`;
const FOTO = `${PASTA}/bonus-foto/${UUID}.jpg`;
const PRONTO = `${PASTA}/bonus/${UUID}.jpg`;

describe("o jeito do slide 1, lido da coluna arte", () => {
  it("a linha sem a chave capa tem a capa desligada, como os carrosséis de hoje", () => {
    expect(escolhasDaArte({}, 5).capa).toBe(false);
    expect(escolhasDaArte({ soTexto: [2] }, 5).capa).toBe(false);
  });

  it("capa: true liga a capa no carrossel de 2 slides ou mais", () => {
    expect(escolhasDaArte({ capa: true }, 2).capa).toBe(true);
    expect(escolhasDaArte({ capa: true }, 10).capa).toBe(true);
  });

  it("o post de 1 slide nunca tem capa, mesmo com a chave gravada (achado 98)", () => {
    expect(escolhasDaArte({ capa: true }, 1).capa).toBe(false);
  });

  it("só o booleano true liga: o texto, o número e o objeto ficam desligados", () => {
    for (const v of ["true", 1, {}, [], null]) expect(escolhasDaArte({ capa: v }, 5).capa).toBe(false);
  });

  it("com o slide 1 em Só texto, a capa fica desligada: os dois não convivem, e o Só texto de hoje vale", () => {
    const e = escolhasDaArte({ capa: true, soTexto: [1] }, 5);
    expect(e.capa).toBe(false);
    expect(e.soTexto).toEqual([1]);
  });

  it("a capa só vale no slide 1, e ele deixa de ter o espaço da imagem", () => {
    const e = escolhasDaArte({ capa: true, soTexto: [3] }, 4);
    expect([1, 2, 3, 4].map((n) => ehCapa(e, n))).toEqual([true, false, false, false]);
    expect([1, 2, 3, 4].map((n) => comEspaco(e, n))).toEqual([false, true, false, true]);
  });

  it("sem a capa, o slide 1 continua com o espaço", () => {
    const e = escolhasDaArte({}, 4);
    expect(ehCapa(e, 1)).toBe(false);
    expect(comEspaco(e, 1)).toBe(true);
  });
});

// A CAPA MANDADA PELO FORMULÁRIO DA ARTE não é confiável: o navegador manda o que quiser. "1" liga, a
// ausência desliga, e o resto é recusado. Ligar a capa no post de 1 slide, ou junto do Só texto no slide
// 1, também é recusado: a tela nunca manda os dois, e o servidor não escolhe por ela.
describe("a capa mandada pelo formulário da arte", () => {
  it('"1" liga, e a ausência desliga', () => {
    expect(lerCapaDoFormulario("1", [], 3)).toEqual({ ok: true, capa: true });
    expect(lerCapaDoFormulario(null, [], 3)).toEqual({ ok: true, capa: false });
  });

  it.each(["", "0", "true", "on", "01"])("outro valor é recusado: %j", (v) => {
    expect(lerCapaDoFormulario(v, [], 3)).toEqual({ ok: false, motivo: "capa" });
  });

  it("o post de 1 slide recusa a capa (achado 98)", () => {
    expect(lerCapaDoFormulario("1", [], 1)).toEqual({ ok: false, motivo: "capa_no_post" });
  });

  it("a capa junto do Só texto no slide 1 é recusada; com o Só texto em outro slide, passa", () => {
    expect(lerCapaDoFormulario("1", [1, 3], 3)).toEqual({ ok: false, motivo: "capa_e_so_texto" });
    expect(lerCapaDoFormulario("1", [3], 3)).toEqual({ ok: true, capa: true });
  });
});

describe("o destino da capa no bucket", () => {
  it("a capa vai para <pasta>/bonus-capa, ao lado dos três destinos de hoje", () => {
    expect(caminhoDaImagem(PASTA, "capa", UUID)).toBe(CAPA);
  });

  it("o destino capa aceita só o próprio prefixo, na pasta da conta do carrossel", () => {
    expect(ehCaminhoDoDestino(CAPA, PASTA, "capa")).toBe(true);
    expect(ehCaminhoDoDestino(FOTO, PASTA, "capa")).toBe(false);
    expect(ehCaminhoDoDestino(CAPA, PASTA, "foto")).toBe(false);
    expect(ehCaminhoDoDestino(CAPA, "17841400000000002", "capa")).toBe(false);
  });

  it("bonus-capa é o jeito capa, e os jeitos de hoje continuam", () => {
    expect(jeitoDoCaminho(CAPA)).toBe("capa");
    expect(jeitoDoCaminho(FOTO)).toBe("foto");
    expect(jeitoDoCaminho(PRONTO)).toBe("slide");
  });

  it("a imagem da capa é lida com as outras, e não entra nas fotos do espaço", () => {
    const arte = { imagens: { "1": { caminho: CAPA, versao: "v1" }, "2": { caminho: FOTO, versao: "v2" } } };
    expect(imagensDaArte(arte, 3)).toEqual({ 1: { caminho: CAPA, versao: "v1" }, 2: { caminho: FOTO, versao: "v2" } });
    expect(fotosDaArte(arte, 3)).toEqual({ 2: FOTO });
  });
});

// A IMAGEM DE OUTRO JEITO CONTA COMO SEM IMAGEM (nota da revisão da spec): uma bonus-capa com a capa
// desligada, ou uma bonus-foto com a capa ligada, não é desenhada, e a tela, as faltas e o servidor a
// tratam como a imagem que falta.
describe("a imagem que vale em cada jeito do slide", () => {
  const comCapa = escolhasDaArte({ capa: true }, 3);
  const semCapa = escolhasDaArte({}, 3);
  const soTexto = escolhasDaArte({ soTexto: [1] }, 3);

  it("na capa, só a imagem da capa vale", () => {
    expect(valeNoSlide(comCapa, 1, "capa")).toBe(true);
    expect(valeNoSlide(comCapa, 1, "foto")).toBe(false);
    expect(valeNoSlide(comCapa, 1, "slide")).toBe(false);
  });

  it("no slide com espaço, valem a foto e o slide pronto, e a capa não", () => {
    expect(valeNoSlide(semCapa, 1, "foto")).toBe(true);
    expect(valeNoSlide(semCapa, 1, "slide")).toBe(true);
    expect(valeNoSlide(semCapa, 1, "capa")).toBe(false);
    expect(valeNoSlide(comCapa, 2, "capa")).toBe(false);
  });

  it("no Só texto nenhuma vale, e sem imagem nunca vale", () => {
    for (const j of ["capa", "foto", "slide"] as const) expect(valeNoSlide(soTexto, 1, j)).toBe(false);
    expect(valeNoSlide(comCapa, 1, null)).toBe(false);
  });

  it("a capa da arte: ligada, com o caminho só quando a imagem do slide 1 é da capa", () => {
    expect(capaDaArte({ capa: true, imagens: { "1": { caminho: CAPA, versao: "v" } } }, 3)).toEqual({ ligada: true, caminho: CAPA });
    expect(capaDaArte({ capa: true, imagens: { "1": { caminho: FOTO, versao: "v" } } }, 3)).toEqual({ ligada: true, caminho: null });
    expect(capaDaArte({ capa: true }, 3)).toEqual({ ligada: true, caminho: null });
    expect(capaDaArte({ imagens: { "1": { caminho: CAPA, versao: "v" } } }, 3)).toEqual({ ligada: false, caminho: null });
    expect(capaDaArte({ capa: true, imagens: { "1": { caminho: CAPA, versao: "v" } } }, 1)).toEqual({ ligada: false, caminho: null });
  });
});

// A FOTO DA CAPA (spec, "A imagem da capa"): 4:5 com 1% de tolerância, de 1080×1350 a 2160×2700, e até 2
// MB, o teto da foto do espaço (achado 79). A gerada por IA sai em 1024×1536, e só ela passa fora do 4:5:
// o desenho recorta em cima e embaixo.
describe("a foto declarada para a capa", () => {
  it("1080×1350 e 2160×2700 passam", () => {
    expect(problemaDaFotoDaCapa(1080, 1350, 500_000)).toBeNull();
    expect(problemaDaFotoDaCapa(CAPA_MAX_LARGURA, CAPA_MAX_ALTURA, 500_000)).toBeNull();
  });

  it("as bordas de 1% da proporção passam, e o que passa delas é recusado", () => {
    // 1080/1363 = 0,7924 e 1090/1350 = 0,8074 ficam dentro; 1080/1364 = 0,7918 e 1091/1350 = 0,8081, fora.
    expect(problemaDaFotoDaCapa(1080, 1363, 1)).toBeNull();
    expect(problemaDaFotoDaCapa(1090, 1350, 1)).toBeNull();
    expect(problemaDaFotoDaCapa(1080, 1364, 1)).toBe("proporcao");
    expect(problemaDaFotoDaCapa(1091, 1350, 1)).toBe("proporcao");
    expect(problemaDaFotoDaCapa(1350, 1080, 1)).toBe("proporcao");
  });

  it("menor que 1080×1350 é pequena; maior que 2160×2700 é grande", () => {
    expect(problemaDaFotoDaCapa(1076, 1345, 1)).toBe("pequena");
    expect(problemaDaFotoDaCapa(2164, 2705, 1)).toBe("grande");
  });

  it("2 MB passa, e 2 MB e 1 byte é pesada", () => {
    expect(problemaDaFotoDaCapa(1080, 1350, 2 * 1024 * 1024)).toBeNull();
    expect(problemaDaFotoDaCapa(1080, 1350, 2 * 1024 * 1024 + 1)).toBe("pesada");
  });

  it("a gerada por IA, 1024×1536, passa, e pesa como as outras", () => {
    expect([LARGURA_DA_CAPA_GERADA, ALTURA_DA_CAPA_GERADA]).toEqual([1024, 1536]);
    expect(problemaDaFotoDaCapa(1024, 1536, 2 * 1024 * 1024)).toBeNull();
    expect(problemaDaFotoDaCapa(1024, 1536, 2 * 1024 * 1024 + 1)).toBe("pesada");
    expect(problemaDaFotoDaCapa(1023, 1536, 1)).toBe("proporcao");
  });

  it("a medida da IA vale inteira: a largura dela com outra altura segue a regra do 4:5", () => {
    expect(problemaDaFotoDaCapa(1024, 1280, 1)).toBe("pequena");
    expect(problemaDaFotoDaCapa(1024, 1535, 1)).toBe("proporcao");
  });

  it("a foto deitada do espaço é recusada como capa", () => {
    expect(problemaDaFotoDaCapa(1536, 1024, 1)).toBe("proporcao");
  });

  it("sem medida, ou sem o tamanho em bytes, é recusada", () => {
    expect(problemaDaFotoDaCapa(undefined, 1350, 1)).toBe("sem_medida");
    expect(problemaDaFotoDaCapa(1080, 0, 1)).toBe("sem_medida");
    expect(problemaDaFotoDaCapa(1080, 1350, undefined)).toBe("sem_medida");
  });
});

describe("o recorte da foto da capa", () => {
  it("a foto de celular 3:4 perde o alto e o baixo, ao centro, e é reduzida a 2160×2700", () => {
    expect(recorteDaCapa(3024, 4032)).toEqual({
      ok: true,
      recorte: { x: 0, y: 126, largura: 3024, altura: 3780, saida: { largura: 2160, altura: 2700 } },
    });
  });

  it("a foto deitada perde as laterais, ao centro", () => {
    expect(recorteDaCapa(1920, 1440)).toEqual({
      ok: true,
      recorte: { x: 384, y: 0, largura: 1152, altura: 1440, saida: { largura: 1152, altura: 1440 } },
    });
  });

  it("a foto já em 4:5, entre o mínimo e o máximo, não muda de tamanho", () => {
    expect(recorteDaCapa(1080, 1350)).toEqual({
      ok: true,
      recorte: { x: 0, y: 0, largura: 1080, altura: 1350, saida: { largura: 1080, altura: 1350 } },
    });
  });

  it("a foto cujo recorte fica menor que 1080×1350 é pequena, e não é ampliada", () => {
    expect(recorteDaCapa(1000, 1600)).toEqual({ ok: false, problema: "pequena" });
  });

  it("sem medida não recorta", () => {
    expect(recorteDaCapa(0, 1350)).toEqual({ ok: false, problema: "sem_medida" });
  });

  it("toda saída passa na regra da foto da capa", () => {
    for (const [l, a] of [
      [3024, 4032],
      [4032, 3024],
      [1080, 1350],
      [2161, 2701],
      [1200, 1500],
    ]) {
      const r = recorteDaCapa(l, a);
      if (!r.ok) throw new Error(`${l}×${a} não recortou`);
      expect(problemaDaFotoDaCapa(r.recorte.saida.largura, r.recorte.saida.altura, 1)).toBeNull();
    }
  });
});
```

Em `tests/bonus-arte-escolhas.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-arte-escolhas.test.ts b/tests/bonus-arte-escolhas.test.ts
index 5c50c8f..5d8902b 100644
--- a/tests/bonus-arte-escolhas.test.ts
+++ b/tests/bonus-arte-escolhas.test.ts
@@ -5,8 +5,9 @@ import { comEspaco, escolhasDaArte, lerSoTextoDoFormulario } from "@/lib/bonus/a
 // banco não é confiável por forma: uma linha antiga tem `{}`, e uma escrita errada não pode quebrar
 // a página. O que não tiver a forma certa volta ao padrão, que é "com espaço" e sem conta gravada.
 // Desde a Etapa 4, a coluna guarda também o nome e o @ da conta, gravados quando o carrossel nasce.
+// Desde a Etapa 11, a capa do slide 1, desligada no padrão (tests/bonus-capa-regras.test.ts).
 describe("as escolhas da arte de um carrossel", () => {
-  const VAZIA = { conta: null, nome: null, arroba: null, soTexto: [] };
+  const VAZIA = { conta: null, nome: null, arroba: null, soTexto: [], capa: false };
 
   it("a linha antiga, sem nada, não tem conta e tem todo slide com espaço", () => {
     expect(escolhasDaArte({}, 5)).toEqual(VAZIA);
@@ -15,7 +16,7 @@ describe("as escolhas da arte de um carrossel", () => {
   it("lê a conta, o nome e o @ guardados, e os slides só de texto, em ordem e sem repetir", () => {
     expect(
       escolhasDaArte({ conta: "17841400000000001", nome: "Thiago Vannuchi", arroba: "thiagovannuchi", soTexto: [4, 2, 2] }, 5)
-    ).toEqual({ conta: "17841400000000001", nome: "Thiago Vannuchi", arroba: "thiagovannuchi", soTexto: [2, 4] });
+    ).toEqual({ conta: "17841400000000001", nome: "Thiago Vannuchi", arroba: "thiagovannuchi", soTexto: [2, 4], capa: false });
   });
 
   it("a conta da Etapa 3, gravada sem o nome, volta sem o nome", () => {
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-capa-regras.test.ts tests/bonus-arte-escolhas.test.ts
```

Esperado: 45 caem e 9 passam (54): as escolhas ainda não têm a capa, e as funções novas ainda não existem.

- [ ] **Passo 3: o código**

Em `lib/bonus/arte-escolhas.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/arte-escolhas.ts b/lib/bonus/arte-escolhas.ts
index 08b2af6..0357df4 100644
--- a/lib/bonus/arte-escolhas.ts
+++ b/lib/bonus/arte-escolhas.ts
@@ -8,8 +8,13 @@
 // ⚠️ GRAVAR O "SÓ TEXTO" É DIFERENTE DO LABS, de propósito (spec da Etapa 3): lá a escolha não é
 // gravada, porque a presença da ilustração já a responde (ROADMAP do Labs, 22.6). No Chat não há
 // ilustração guardada, e o PNG baixado amanhã tem de sair igual à prévia de hoje.
+//
+// A CAPA (spec da Etapa 11) é o quarto jeito do slide 1: a imagem no slide inteiro e o gancho grande por
+// cima. Ela mora numa chave própria, `capa: true`, porque só o slide 1 a tem. O carrossel sem a chave
+// continua como hoje. Ela não convive com o "Só texto" no slide 1, e o post de 1 slide nunca a tem
+// (achado 98): o slide dele não tem gancho.
 
-export type EscolhasDaArte = { conta: string | null; nome: string | null; arroba: string | null; soTexto: number[] };
+export type EscolhasDaArte = { conta: string | null; nome: string | null; arroba: string | null; soTexto: number[]; capa: boolean };
 
 const textoOuNulo = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
 
@@ -23,12 +28,21 @@ export function escolhasDaArte(v: unknown, total: number): EscolhasDaArte {
   const soTexto = [...new Set(lista.filter((n): n is number => Number.isInteger(n) && n >= 1 && n <= total))].sort(
     (a, b) => a - b
   );
-  return { conta: textoOuNulo(o.conta), nome: textoOuNulo(o.nome), arroba: textoOuNulo(o.arroba), soTexto };
+  // A CAPA SÓ VALE COM O BOOLEANO `true`, no carrossel de 2 slides ou mais, e sem o "Só texto" no slide 1.
+  // A tela nunca grava os dois juntos (`lerCapaDoFormulario`); se uma escrita errada gravar, vale o "Só
+  // texto", que é o jeito de antes da capa.
+  const capa = o.capa === true && total >= 2 && !soTexto.includes(1);
+  return { conta: textoOuNulo(o.conta), nome: textoOuNulo(o.nome), arroba: textoOuNulo(o.arroba), soTexto, capa };
+}
+
+/** O slide 1 em "Capa com imagem" (Etapa 11). */
+export function ehCapa(e: EscolhasDaArte, numero: number): boolean {
+  return e.capa && numero === 1;
 }
 
-/** "Com espaço" é o padrão; "só texto" é o que o operador marcou. */
+/** "Com espaço" é o padrão; "só texto" é o que o operador marcou. A capa não tem o espaço: a imagem é o slide inteiro. */
 export function comEspaco(e: EscolhasDaArte, numero: number): boolean {
-  return !e.soTexto.includes(numero);
+  return !e.soTexto.includes(numero) && !ehCapa(e, numero);
 }
 
 export type RecusaDaArte = "slide" | "ja_tem_conta" | "sem_conta";
@@ -50,3 +64,22 @@ export function lerSoTextoDoFormulario(
   }
   return { ok: true, soTexto: soTexto.sort((a, b) => a - b) };
 }
+
+export type RecusaDaCapa = "capa" | "capa_no_post" | "capa_e_so_texto";
+
+/**
+ * A CAPA QUE O FORMULÁRIO DA ARTE MANDOU (Etapa 11): "1" liga, a ausência desliga, e o resto é recusado. O
+ * post de 1 slide não tem capa (achado 98), e a capa não vai junto do "Só texto" no slide 1: a tela desliga
+ * um ao ligar o outro, e o servidor não escolhe por ela.
+ */
+export function lerCapaDoFormulario(
+  bruto: unknown,
+  soTexto: number[],
+  total: number
+): { ok: true; capa: boolean } | { ok: false; motivo: RecusaDaCapa } {
+  if (bruto === null || bruto === undefined) return { ok: true, capa: false };
+  if (bruto !== "1") return { ok: false, motivo: "capa" };
+  if (total < 2) return { ok: false, motivo: "capa_no_post" };
+  if (soTexto.includes(1)) return { ok: false, motivo: "capa_e_so_texto" };
+  return { ok: true, capa: true };
+}
```

Em `lib/bonus/publicar-regras.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/publicar-regras.ts b/lib/bonus/publicar-regras.ts
index 4f98402..5571a58 100644
--- a/lib/bonus/publicar-regras.ts
+++ b/lib/bonus/publicar-regras.ts
@@ -1,7 +1,8 @@
 // AS REGRAS PURAS DA PUBLICAÇÃO DO CARROSSEL (spec da Etapa 5, "Por dentro"). PURO: a tela, as
 // actions e o repositório leem daqui, e nenhuma regra mora no JSX nem no SQL.
 import type { FormaDePublicacao } from "@/lib/publicacao";
-import { ALTURA_ILUSTRACAO, LARGURA_UTIL } from "./arte-geometria";
+import { comEspaco, ehCapa, escolhasDaArte, type EscolhasDaArte } from "./arte-escolhas";
+import { ALTURA, ALTURA_ILUSTRACAO, LARGURA, LARGURA_UTIL } from "./arte-geometria";
 import type { SlideParaArte } from "./arte-slides";
 import { versaoDaArte } from "./arte-tela";
 
@@ -16,20 +17,24 @@ import { versaoDaArte } from "./arte-tela";
  * O /publicar só aceita `pasta/arquivo.ext`, com uma barra (`FORMA_DO_CAMINHO`,
  * lib/publicacao.ts), e nenhum dos três entra por ele. O dreno não confere a forma, e os três saem
  * por ele. A guardada nunca vai para a fila: o que vai é sempre uma cópia ou uma arte.
+ *
+ * O QUARTO, `capa` (spec da Etapa 11): a imagem da capa do slide 1, subida ou gerada por IA, em
+ * `<pasta>/bonus-capa/<uuid>.jpg`. Como a foto, ela nunca vai para a fila: vai a arte da capa desenhada.
  */
-export type DestinoDaImagem = "slide" | "foto" | "fila";
+export type DestinoDaImagem = "slide" | "foto" | "fila" | "capa";
 
 /**
- * O JEITO DE UMA IMAGEM GUARDADA NO SLIDE: o slide pronto, que é o slide inteiro, ou a foto, que entra
- * no espaço da arte. É o destino em que ela foi assinada, e o prefixo do caminho o diz.
+ * O JEITO DE UMA IMAGEM GUARDADA NO SLIDE: o slide pronto, que é o slide inteiro, a foto, que entra
+ * no espaço da arte, ou a imagem da capa (Etapa 11), que a arte da capa cobre com o gancho. É o destino
+ * em que ela foi assinada, e o prefixo do caminho o diz.
  */
 export type JeitoDaImagem = Exclude<DestinoDaImagem, "fila">;
 
-const PREFIXO: Record<DestinoDaImagem, string> = { slide: "bonus", foto: "bonus-foto", fila: "bonus-fila" };
+const PREFIXO: Record<DestinoDaImagem, string> = { slide: "bonus", foto: "bonus-foto", fila: "bonus-fila", capa: "bonus-capa" };
 const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
 /** A pasta já sai higienizada de `pastaDaConta`; conferir de novo impede um padrão montado errado. */
 const PASTA = /^[A-Za-z0-9_-]+$/;
-const GUARDADA = new RegExp(`^[A-Za-z0-9_-]+/(${PREFIXO.slide}|${PREFIXO.foto})/${UUID}\\.jpg$`);
+const GUARDADA = new RegExp(`^[A-Za-z0-9_-]+/(${PREFIXO.slide}|${PREFIXO.foto}|${PREFIXO.capa})/${UUID}\\.jpg$`);
 
 export function caminhoDaImagem(pasta: string, destino: DestinoDaImagem, uuid: string): string {
   return `${pasta}/${PREFIXO[destino]}/${uuid}.jpg`;
@@ -43,13 +48,26 @@ export function ehCaminhoDoDestino(caminho: unknown, pasta: string, destino: Des
 
 /**
  * O JEITO É O PREFIXO DO CAMINHO (revisão do adendo pela auditoria): `bonus-foto/` é a foto,
- * `bonus/` é o slide pronto, inclusive o guardado antes do adendo. Não há campo de jeito na coluna: o
- * caminho, que o servidor assinou, é a fonte única. Outro caminho não tem jeito, e não conta.
+ * `bonus/` é o slide pronto, inclusive o guardado antes do adendo, e `bonus-capa/` é a capa (Etapa 11).
+ * Não há campo de jeito na coluna: o caminho, que o servidor assinou, é a fonte única. Outro caminho
+ * não tem jeito, e não conta.
  */
 export function jeitoDoCaminho(caminho: string): JeitoDaImagem | null {
   const m = GUARDADA.exec(caminho);
   if (!m) return null;
-  return m[1] === PREFIXO.foto ? "foto" : "slide";
+  return m[1] === PREFIXO.foto ? "foto" : m[1] === PREFIXO.capa ? "capa" : "slide";
+}
+
+/**
+ * A IMAGEM QUE VALE NO JEITO DO SLIDE (nota da revisão da spec da Etapa 11): na capa, só a da capa; no
+ * slide com espaço, a foto e o slide pronto; no "Só texto", nenhuma. A de outro jeito conta como sem
+ * imagem: a tela, as faltas do publicar e o servidor a tratam como a imagem que falta, e ela nunca é
+ * desenhada nem publicada. É o que acontece quando a capa é ligada ou desligada com uma imagem guardada.
+ */
+export function valeNoSlide(e: EscolhasDaArte, numero: number, jeito: JeitoDaImagem | null): boolean {
+  if (jeito === null) return false;
+  if (ehCapa(e, numero)) return jeito === "capa";
+  return comEspaco(e, numero) && jeito !== "capa";
 }
 
 /**
@@ -128,6 +146,57 @@ export function recorteDaFoto(
   return { ok: true, recorte: { x: Math.floor((largura - l) / 2), y: Math.floor((altura - a) / 2), largura: l, altura: a, saida } };
 }
 
+/**
+ * A FOTO DA CAPA (spec da Etapa 11, "A imagem da capa"): o slide inteiro, em 4:5 com 1% de tolerância
+ * (a mesma faixa do slide pronto), de 1080×1350 até o dobro, e até 2 MB, o teto da foto do espaço (achado
+ * 79): a rota da arte lê a imagem da capa pela mesma busca. Menor sairia borrada no post, e o navegador
+ * nunca amplia.
+ *
+ * A GERADA POR IA SAI EM 1024×1536, o tamanho em pé da OpenAI (imagem-openai.ts), e só ela passa fora do
+ * 4:5: o desenho a corta em cima e embaixo (`objectFit: cover`), e ela sai ampliada uns 5% (1024 para
+ * 1080 de largura). Aceitar a medida exata, e não uma faixa, mantém a regra do 4:5 para tudo o mais.
+ */
+export const CAPA_MAX_LARGURA = LARGURA * 2;
+export const CAPA_MAX_ALTURA = ALTURA * 2;
+export const LARGURA_DA_CAPA_GERADA = 1024;
+export const ALTURA_DA_CAPA_GERADA = 1536;
+const PROPORCAO_DA_CAPA = LARGURA / ALTURA;
+
+export function problemaDaFotoDaCapa(
+  largura: number | undefined,
+  altura: number | undefined,
+  bytes: number | undefined
+): ProblemaDaFoto | null {
+  if (!largura || !altura || !(largura > 0) || !(altura > 0) || !(typeof bytes === "number" && bytes >= 0)) return "sem_medida";
+  const gerada = largura === LARGURA_DA_CAPA_GERADA && altura === ALTURA_DA_CAPA_GERADA;
+  if (!gerada) {
+    if (problemaDaProporcaoDoSlide(largura, altura)) return "proporcao";
+    if (largura < LARGURA || altura < ALTURA) return "pequena";
+    if (largura > CAPA_MAX_LARGURA || altura > CAPA_MAX_ALTURA) return "grande";
+  }
+  return bytes > FOTO_DO_ESPACO_MAX_BYTES ? "pesada" : null;
+}
+
+/**
+ * O RECORTE DA FOTO DA CAPA, NO NAVEGADOR: ao centro, em 4:5, e reduzido até 2160×2700, nunca ampliado,
+ * no molde de `recorteDaFoto`. A foto cujo recorte fica menor que 1080×1350 é pequena. A saída grande é
+ * fixada em 2160×2700 exatos.
+ */
+export function recorteDaCapa(
+  largura: number,
+  altura: number
+): { ok: true; recorte: RecorteDaFoto } | { ok: false; problema: "sem_medida" | "pequena" } {
+  if (!(largura > 0) || !(altura > 0)) return { ok: false, problema: "sem_medida" };
+  const [l, a] =
+    largura / altura > PROPORCAO_DA_CAPA
+      ? [Math.round(altura * PROPORCAO_DA_CAPA), altura]
+      : [largura, Math.round(largura / PROPORCAO_DA_CAPA)];
+  if (l < LARGURA || a < ALTURA) return { ok: false, problema: "pequena" };
+  const reduz = l > CAPA_MAX_LARGURA || a > CAPA_MAX_ALTURA;
+  const saida = reduz ? { largura: CAPA_MAX_LARGURA, altura: CAPA_MAX_ALTURA } : { largura: l, altura: a };
+  return { ok: true, recorte: { x: Math.floor((largura - l) / 2), y: Math.floor((altura - a) / 2), largura: l, altura: a, saida } };
+}
+
 /**
  * A VERSÃO DO TEXTO DO SLIDE: o resumo só do slide (número, total, tipo, manchete e texto). Não é a
  * versão da miniatura (`versoesDosSlides`), que leva a URL da foto da conta: a Meta a troca sozinha,
@@ -185,6 +254,20 @@ export function fotosDaArte(v: unknown, total: number): Record<number, string> {
   return fotos;
 }
 
+/**
+ * A CAPA DO CARROSSEL (Etapa 11): se o slide 1 está em capa, e o caminho da imagem dela, só quando a
+ * imagem guardada no slide 1 é do jeito capa (`valeNoSlide`). A capa ligada sem imagem desenha o fundo
+ * escuro liso, e o publicar a recusa.
+ */
+export type CapaDaArte = { ligada: boolean; caminho: string | null };
+
+export function capaDaArte(v: unknown, total: number): CapaDaArte {
+  const escolhas = escolhasDaArte(v, total);
+  if (!escolhas.capa) return { ligada: false, caminho: null };
+  const imagem = imagensDaArte(v, total)[1];
+  return { ligada: true, caminho: imagem && valeNoSlide(escolhas, 1, jeitoDoCaminho(imagem.caminho)) ? imagem.caminho : null };
+}
+
 export type PublicacaoGuardada = {
   /** A `dedupe_key` EXATA que foi para a fila, e não os caminhos para recalcular. */
   chave: string;
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx eslint lib/bonus/arte-escolhas.ts lib/bonus/publicar-regras.ts tests/bonus-capa-regras.test.ts tests/bonus-arte-escolhas.test.ts
npx vitest run tests/bonus-capa-regras.test.ts tests/bonus-arte-escolhas.test.ts
```

Esperado: `tsc` e lint limpos; os 2 arquivos passam, com 54 casos.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/arte-escolhas.ts lib/bonus/publicar-regras.ts tests/bonus-capa-regras.test.ts tests/bonus-arte-escolhas.test.ts
test "$(git branch --show-current)" = "capa-do-carrossel"
git add lib/bonus/arte-escolhas.ts lib/bonus/publicar-regras.ts tests/bonus-capa-regras.test.ts tests/bonus-arte-escolhas.test.ts
```

```bash
git commit -F - <<'MSG'
A capa ganha as regras puras: o jeito do slide 1, o destino no bucket e a foto em 4:5

A capa mora na chave capa: true da arte, e só vale no slide 1 de um carrossel
de 2 slides ou mais, sem o Só texto nele (achado 98). Ela ganha um destino
próprio no bucket, bonus-capa/, e o jeito da imagem continua sendo o prefixo do
caminho. Uma imagem de outro jeito conta como a que falta. A foto da capa vale
em 4:5, de 1080x1350 até o dobro e até 2 MB, e a gerada por IA vale só em
1024x1536.
MSG
```

---

### FASE 2 — O desenho da capa

**Arquivos:**
- Criar: `lib/bonus/capa-geometria.ts`, `lib/bonus/capa-medida.ts`, `lib/bonus/capa-desenho.tsx`,
  `tests/bonus-capa-medida.test.ts`, `tests/bonus-capa-desenho.test.ts`, `tests/bonus-capa-rota.test.ts`,
  `tests/bonus-capa-foto.test.ts`
- Modificar: `lib/bonus/arte-resposta.tsx`, `lib/bonus/arte-foto.ts`, `lib/bonus/arte-rota.ts`

**Interfaces:**
- Consome: `ehCapa`, `comEspaco`, `capaDaArte` e o destino `capa` (FASE 1).
- Produz, em `lib/bonus/capa-geometria.ts`: `DEGRAUS_DA_CAPA` ([112, 96, 80, 64, 56]),
  `ALTURA_DO_BLOCO_DA_CAPA` (640), `ENTRELINHA_DA_CAPA` (1.02), `alturaDaLinhaDaCapa(fonte)`,
  `LADO_DA_CONTA_NA_CAPA` (72), `FONTE_DO_NOME_NA_CAPA` (30), `FONTE_DO_ARROBA_NA_CAPA` (24), `PE_DO_GANCHO`,
  `SOMBRA_DO_PE` ({ opacidade: 0.88, ate: 0.62 }), `SOMBRA_DO_TOPO` ({ opacidade: 0.45, ate: 0.2 }),
  `FUNDO_DA_CAPA_SEM_IMAGEM` ("#161616") e `TEXTO_DA_CAPA`.
- Produz, em `lib/bonus/capa-medida.ts`: `textoDaCapa(texto)` (a maiúscula pt-BR), `composicaoDaCapa(texto)`,
  `medidaDaCapa(linhas, fonte)` e `tamanhoDaCapa(slide)`, que devolve `{ fonte; cabe }`.
- Produz: `desenhoDaCapa({ slide, fonte, cabecalho, familia, imagem })`; `fotoDaCapa(caminho, conta,
  memoria?)`; e a resposta da arte com `capa?: boolean`.

- [ ] **Passo 1: os testes**

Crie `tests/bonus-capa-medida.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { slidesDoTexto, type SlideParaArte } from "@/lib/bonus/arte-slides";
import { ALTURA_DO_BLOCO_DA_CAPA, DEGRAUS_DA_CAPA, ENTRELINHA_DA_CAPA, alturaDaLinhaDaCapa } from "@/lib/bonus/capa-geometria";
import { composicaoDaCapa, medidaDaCapa, tamanhoDaCapa, textoDaCapa } from "@/lib/bonus/capa-medida";
import type { TextoDeCarrossel } from "@/lib/bonus/carrossel-texto";

// A MEDIDA DO GANCHO NA CAPA (spec da Etapa 11, "O desenho da capa" e "Por dentro"): a Carlito negrito,
// toda em maiúscula, com a entrelinha de 1,02, nos degraus próprios da capa (112, 96, 80, 64 e 56), num
// bloco de até 640 px. A conta é a exata de hoje (arte-medida.ts: a largura real de cada letra e a quebra
// do Satori), e a mesma função decide a tela, o desenho e o servidor (o achado 70 nasceu de a conta e o
// desenho divergirem). tests/bonus-capa-desenho.test.ts confere a conta contra o desenho, no pixel.

const carrossel = (gancho: string): TextoDeCarrossel => ({
  tipo: "carrossel",
  titulo: "",
  gancho,
  slides: [{ titulo: "Um", texto: "Texto do slide." }],
  chamada: "Comente SUMIDO e receba as mensagens.",
  legenda: "x".repeat(100),
});
const capa = (gancho: string): SlideParaArte => slidesDoTexto(carrossel(gancho))[0];

/** O gancho mais longo que o schema aceita (120 caracteres), com palavras comuns de um gancho. */
const GANCHO_DE_120 = "Seu cliente sumiu depois da primeira compra e você acha que ele não volta? Veja as três mensagens que trazem ele de vez!";

describe("o texto da capa", () => {
  it("sai todo em maiúscula, com os acentos do português", () => {
    expect(textoDaCapa("ação é já, coração")).toBe("AÇÃO É JÁ, CORAÇÃO");
  });

  it("a maiúscula vem antes de medir: a composição tem o texto que o desenho desenha", () => {
    const linhas = composicaoDaCapa("seu cliente sumiu?");
    expect(linhas.map((l) => l.texto)).toEqual(["SEU CLIENTE SUMIU?"]);
  });

  it("toda linha é negrito, com o espaçamento do negrito, mesmo com mais de um bloco", () => {
    const linhas = composicaoDaCapa("primeira linha\nsegunda\n\nterceira");
    expect(linhas.map((l) => [l.texto, l.negrito, l.espacamento, l.antes])).toEqual([
      ["PRIMEIRA LINHA", true, -0.4, "nada"],
      ["SEGUNDA", true, -0.4, "nada"],
      ["TERCEIRA", true, -0.4, "paragrafo"],
    ]);
  });
});

describe("os números da capa", () => {
  it("os degraus descem de 112 a 56, e o bloco tem 640 px", () => {
    expect(DEGRAUS_DA_CAPA).toEqual([112, 96, 80, 64, 56]);
    expect(ALTURA_DO_BLOCO_DA_CAPA).toBe(640);
    expect(ENTRELINHA_DA_CAPA).toBe(1.02);
  });

  it("a linha da capa é a fonte vezes 1,02, arredondada como o Satori arredonda", () => {
    expect(DEGRAUS_DA_CAPA.map(alturaDaLinhaDaCapa)).toEqual([114, 98, 82, 65, 57]);
  });
});

describe("o tamanho do gancho na capa", () => {
  it("o gancho curto fica no maior degrau", () => {
    expect(tamanhoDaCapa(capa("Ele sumiu?"))).toEqual({ fonte: 112, cabe: true });
  });

  it("o gancho mais longo do schema cabe, e desce até o degrau em que cabe", () => {
    expect(GANCHO_DE_120).toHaveLength(120);
    const t = tamanhoDaCapa(capa(GANCHO_DE_120));
    expect(t.cabe).toBe(true);
    expect(medidaDaCapa(composicaoDaCapa(GANCHO_DE_120), t.fonte).altura).toBeLessThanOrEqual(ALTURA_DO_BLOCO_DA_CAPA);
    // O degrau acima do escolhido não cabe: é o maior que cabe, e nada mais decide.
    const acima = DEGRAUS_DA_CAPA[DEGRAUS_DA_CAPA.indexOf(t.fonte) - 1];
    if (acima !== undefined) expect(medidaDaCapa(composicaoDaCapa(GANCHO_DE_120), acima).altura).toBeGreaterThan(ALTURA_DO_BLOCO_DA_CAPA);
  });

  it("o gancho de 120 caracteres em maiúscula cabe também no pior caso de letras largas", () => {
    // 15 palavras de 7 letras largas e espaços: 120 caracteres que nenhum gancho real passa em largura.
    const largo = Array.from({ length: 15 }, () => "MÁQUINA").join(" ");
    expect(largo).toHaveLength(119);
    expect(tamanhoDaCapa(capa(largo)).cabe).toBe(true);
  });

  it("a palavra mais larga que a linha no menor degrau não cabe: o card avisa e o publicar trava", () => {
    const t = tamanhoDaCapa(capa("Desinconstitucionalissimamente proibido"));
    expect(t).toEqual({ fonte: 56, cabe: false });
  });

  it("cada degrau que a escolha devolve tem o bloco dentro dos 640 px", () => {
    for (const g of ["Ele sumiu?", "Seu cliente sumiu? Não é culpa dele.", GANCHO_DE_120]) {
      const t = tamanhoDaCapa(capa(g));
      expect(medidaDaCapa(composicaoDaCapa(g), t.fonte).altura).toBeLessThanOrEqual(ALTURA_DO_BLOCO_DA_CAPA);
    }
  });
});
```

Crie `tests/bonus-capa-desenho.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { LARGURA_UTIL, MARGEM } from "@/lib/bonus/arte-geometria";
import { respostaDaArte } from "@/lib/bonus/arte-resposta";
import { slidesDoTexto, type SlideParaArte } from "@/lib/bonus/arte-slides";
import type { CabecalhoDaArte } from "@/lib/bonus/arte-tela";
import { ALTURA_DO_BLOCO_DA_CAPA, LADO_DA_CONTA_NA_CAPA, PE_DO_GANCHO } from "@/lib/bonus/capa-geometria";
import { tamanhoDaCapa } from "@/lib/bonus/capa-medida";
import type { TextoDeCarrossel } from "@/lib/bonus/carrossel-texto";
import { lerPng } from "./arte-desenhada";

// O DESENHO DA CAPA, NO PIXEL (spec da Etapa 11, "O desenho da capa"): o PNG sai do Satori de verdade, com
// a Carlito do disco, pela mesma resposta da arte de hoje (arte-resposta.tsx). O que se confere é o que o
// achado 70 ensinou: o gancho que a conta diz que cabe (capa-medida.ts), desenhado, fica dentro do bloco
// de 640 px, acima da margem do pé, e não passa da margem da direita. Sem imagem, o fundo é escuro e liso;
// com a imagem, ela cobre o slide inteiro, e a sombra do pé a escurece embaixo do gancho.

const CABECALHO: CabecalhoDaArte = { nome: "Thiago Vannuchi", arroba: "thiagovannuchi", foto: null, iniciais: "TV" };

/** Uma imagem de uma cor só, em SVG: o desenho a recebe como `data:`, como a rota entrega a da capa. */
const VERMELHA = `data:image/svg+xml;base64,${Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350"><rect width="1080" height="1350" fill="#FF0000"/></svg>'
).toString("base64")}`;

const GANCHO_DE_120 = "Seu cliente sumiu depois da primeira compra e você acha que ele não volta? Veja as três mensagens que trazem ele de vez!";

const capa = (gancho: string): SlideParaArte => {
  const t: TextoDeCarrossel = {
    tipo: "carrossel",
    titulo: "",
    gancho,
    slides: [{ titulo: "Um", texto: "Texto do slide." }],
    chamada: "Comente SUMIDO e receba as mensagens.",
    legenda: "x".repeat(100),
  };
  return slidesDoTexto(t)[0];
};

async function desenhar(slide: SlideParaArte, extra: Partial<Parameters<typeof respostaDaArte>[0]> = {}) {
  const arte = await respostaDaArte({ slide, comEspaco: false, capa: true, cabecalho: CABECALHO, baixar: false, nomeDoArquivo: "capa.png", ...extra });
  if (!arte.ok) throw new Error(`o desenho falhou: ${arte.falha}`);
  const png = Buffer.from(await arte.resposta.arrayBuffer());
  return { r: arte.resposta, img: lerPng(png) };
}

type Imagem = ReturnType<typeof lerPng>;
const cor = (img: Imagem, x: number, y: number): [number, number, number] => {
  const o = (y * img.largura + x) * 4;
  return [img.rgba[o], img.rgba[o + 1], img.rgba[o + 2]];
};
const luz = (img: Imagem, x: number, y: number) => {
  const [r, g, b] = cor(img, x, y);
  return 0.299 * r + 0.587 * g + 0.114 * b;
};

/** A tinta clara do gancho, abaixo da conta: a primeira e a última linha, e a coluna mais à direita. */
function tintaDoGancho(img: Imagem): { topo: number; fim: number; direita: number } {
  let topo = -1;
  let fim = -1;
  let direita = -1;
  for (let y = MARGEM + LADO_DA_CONTA_NA_CAPA + 20; y < img.altura; y++) {
    for (let x = 0; x < img.largura; x++) {
      if (luz(img, x, y) <= 128) continue;
      if (topo < 0) topo = y;
      fim = y;
      direita = Math.max(direita, x);
    }
  }
  return { topo, fim, direita };
}

describe("o PNG da capa", () => {
  it("sai 1080×1350, e sem imagem não manda o X-Arte-Foto", async () => {
    const { r, img } = await desenhar(capa("Ele sumiu?"));
    expect([img.largura, img.altura]).toEqual([1080, 1350]);
    expect(r.headers.get("x-arte-foto")).toBeNull();
  }, 60_000);

  it("sem imagem, o fundo é escuro e liso; a conta vai no topo, com as iniciais no azul", async () => {
    const { img } = await desenhar(capa("Ele sumiu?"));
    expect(luz(img, 1000, 400)).toBeLessThan(40);
    const meio = MARGEM + LADO_DA_CONTA_NA_CAPA / 2;
    expect(cor(img, MARGEM + 6, meio)).toEqual([0x37, 0x97, 0xf0]);
  }, 60_000);

  it("com a imagem, ela cobre o slide inteiro, e a sombra do pé a escurece embaixo", async () => {
    const { r, img } = await desenhar(capa("Ele sumiu?"), { fotoDoEspaco: { foto: VERMELHA }, versao: "abc" });
    expect(cor(img, 1000, 400)).toEqual([255, 0, 0]);
    expect(cor(img, 1000, 1300)[0]).toBeLessThan(80);
    expect(r.headers.get("x-arte-foto")).toBe("sim");
    expect(r.headers.get("x-arte-versao")).toBe("abc");
  }, 60_000);

  it("a imagem que não veio sai como fundo escuro, e a resposta diz que faltou", async () => {
    const { r, img } = await desenhar(capa("Ele sumiu?"), { fotoDoEspaco: { foto: null } });
    expect(luz(img, 1000, 400)).toBeLessThan(40);
    expect(r.headers.get("x-arte-foto")).toBe("faltou");
  }, 60_000);
});

// A CONTA CONTRA O DESENHO (o achado 70): cada gancho no degrau que a conta escolheu, desenhado, com a
// tinta dentro do bloco, acima da margem do pé e antes da margem da direita. Medido no ensaio: o de 120
// caracteres sai em 80, com a tinta de 681 a 1225; o de letras largas, em 64, até a coluna 964; a cedilha
// de "CORAÇÃO", em 112, desce até 1239.
describe("o gancho que a conta diz que cabe, desenhado", () => {
  const LARGO = Array.from({ length: 15 }, () => "MÁQUINA").join(" ");
  it.each([
    ["curto", "Ele sumiu?"],
    ["médio", "Seu cliente sumiu? Não é culpa dele."],
    ["com acentos e cedilha", "Ação já: É hora de agir, coração!"],
    ["de 120 caracteres", GANCHO_DE_120],
    ["de letras largas", LARGO],
  ])("o %s fica dentro do bloco e das margens", async (_, gancho) => {
    const slide = capa(gancho);
    expect(tamanhoDaCapa(slide).cabe).toBe(true);
    const { img } = await desenhar(slide);
    const t = tintaDoGancho(img);
    expect(t.topo).toBeGreaterThanOrEqual(PE_DO_GANCHO - ALTURA_DO_BLOCO_DA_CAPA);
    expect(t.fim).toBeLessThan(PE_DO_GANCHO);
    expect(t.direita).toBeLessThan(MARGEM + LARGURA_UTIL);
  }, 60_000);
});
```

Crie `tests/bonus-capa-rota.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { slidesDoTexto } from "@/lib/bonus/arte-slides";
import type { LinhaDoCarrossel } from "@/lib/bonus/carrossel-linha";
import type { TextoDeCarrossel } from "@/lib/bonus/carrossel-texto";
import { versaoDoDesenho } from "@/lib/bonus/publicar-regras";

// A ROTA DA ARTE ESCOLHE A CAPA (spec da Etapa 11, "Onde ela fica" e "Por dentro"): no slide 1 em capa, ela
// busca só a imagem do jeito capa (`fotoDaCapa`), desenha a capa e manda a versão do desenho com o
// caminho dela; a imagem de outro jeito não conta, e nada é buscado. O desenho é o comum às duas rotas da
// arte (lib/bonus/arte-rota.ts, a do bônus e a do avulso). As contas e as buscas são falsas aqui: a rota
// lê o banco e o bucket, e o que se confere é a escolha. O desenho de verdade está em
// tests/bonus-capa-desenho.test.ts.

const CONTA = "17841400000000001";
const UUID = "0b2f4c1e-7a9d-4e3b-9c5f-1d2e3f4a5b6c";
const CAPA = `${CONTA}/bonus-capa/${UUID}.jpg`;
const FOTO = `${CONTA}/bonus-foto/${UUID}.jpg`;
const IMAGEM = `data:image/svg+xml;base64,${Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350"><rect width="1080" height="1350" fill="#FF0000"/></svg>'
).toString("base64")}`;

const buscas = vi.hoisted(() => ({ capa: [] as string[], espaco: [] as string[] }));
vi.mock("@/lib/bonus/carrossel-repositorio", () => ({
  contasParaArte: async () => [{ ig_user_id: "17841400000000001", username: "thiagovannuchi", name: "Thiago Vannuchi", profile_picture_url: null }],
}));
vi.mock("@/lib/bonus/arte-foto", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/bonus/arte-foto")>();
  return {
    ...real,
    fotoDaCapa: async (caminho: string) => {
      buscas.capa.push(caminho);
      return IMAGEM;
    },
    fotoDoEspaco: async (caminho: string) => {
      buscas.espaco.push(caminho);
      return IMAGEM;
    },
  };
});

const { desenharSlide } = await import("@/lib/bonus/arte-rota");

const TEXTO: TextoDeCarrossel = {
  tipo: "carrossel",
  titulo: "",
  gancho: "Seu cliente sumiu? Não é culpa dele.",
  slides: [{ titulo: "Um", texto: "Texto do slide." }],
  chamada: "Comente SUMIDO e receba as mensagens.",
  legenda: "x".repeat(100),
};
const SLIDES = slidesDoTexto(TEXTO);

const linha = (arte: Record<string, unknown>): LinhaDoCarrossel => ({
  id: "c0000000-0000-4000-8000-000000000001",
  bonus_id: null,
  criado_em: new Date(),
  total_slides: SLIDES.length,
  palavra: "SUMIDO",
  contexto: {},
  estado: "pronto",
  gerado: TEXTO,
  revisado: null,
  erro: null,
  medicao: null,
  gerado_em: new Date(),
  revisado_em: null,
  arte: { conta: CONTA, nome: "Thiago Vannuchi", arroba: "thiagovannuchi", ...arte },
  origem: "livre",
  labs_codigo: null,
  texto_a_mao: true,
  acao_da_chamada: null,
});

const desenhar = (arte: Record<string, unknown>, numero = 1) =>
  desenharSlide({ linha: linha(arte), slides: SLIDES, numero, doCookie: undefined, baixar: false, slug: async () => null });

beforeEach(() => {
  buscas.capa.length = 0;
  buscas.espaco.length = 0;
});

describe("a rota da arte com a capa", () => {
  it("a capa com a imagem dela: busca só a da capa, e manda a versão do desenho com o caminho", async () => {
    const r = await desenhar({ capa: true, imagens: { "1": { caminho: CAPA, versao: "v" } } });
    expect(r.status).toBe(200);
    expect(buscas).toEqual({ capa: [CAPA], espaco: [] });
    expect(r.headers.get("x-arte-foto")).toBe("sim");
    expect(r.headers.get("x-arte-versao")).toBe(versaoDoDesenho(SLIDES[0], CAPA));
  }, 60_000);

  it("a capa sem imagem desenha o fundo escuro, sem busca e sem versão: ela não se publica", async () => {
    const r = await desenhar({ capa: true });
    expect(r.status).toBe(200);
    expect(buscas).toEqual({ capa: [], espaco: [] });
    expect(r.headers.get("x-arte-foto")).toBeNull();
    expect(r.headers.get("x-arte-versao")).toBeNull();
  }, 60_000);

  it("a foto do espaço guardada no slide 1 não conta com a capa ligada", async () => {
    const r = await desenhar({ capa: true, imagens: { "1": { caminho: FOTO, versao: "v" } } });
    expect(buscas).toEqual({ capa: [], espaco: [] });
    expect(r.headers.get("x-arte-versao")).toBeNull();
  }, 60_000);

  it("a imagem da capa guardada no slide 1 não conta com a capa desligada: o espaço sai em branco", async () => {
    const r = await desenhar({ imagens: { "1": { caminho: CAPA, versao: "v" } } });
    expect(buscas).toEqual({ capa: [], espaco: [] });
    expect(r.headers.get("x-arte-foto")).toBeNull();
    expect(r.headers.get("x-arte-versao")).toBeNull();
  }, 60_000);

  it("os outros slides não mudam com a capa: a foto do slide 2 é a foto do espaço", async () => {
    const r = await desenhar({ capa: true, imagens: { "2": { caminho: FOTO, versao: "v" } } }, 2);
    expect(buscas).toEqual({ capa: [], espaco: [FOTO] });
    expect(r.headers.get("x-arte-versao")).toBe(versaoDoDesenho(SLIDES[1], FOTO));
  }, 60_000);
});

// AS GUARDAS DA CAPA, no molde das de tests/bonus-arte-paginas.test.ts: a imagem da capa vem de
// `capaDaArte` e de `fotoDaCapa` (a conferência do caminho e a memória), e nenhuma das duas rotas da
// arte a busca por conta própria.
describe("de onde a rota tira a imagem da capa", () => {
  const ler = (f: string) => readFileSync(f, "utf8");
  it("o desenho comum a tira de capaDaArte e de fotoDaCapa", () => {
    const desenho = ler("lib/bonus/arte-rota.ts");
    expect(desenho).toContain("capaDaArte(");
    expect(desenho).toContain("fotoDaCapa(");
  });

  it("nenhuma rota da arte busca a capa por conta própria", () => {
    for (const rota of ["app/bonus/[id]/carrossel/[cid]/arte/route.tsx", "app/carrosseis/[cid]/arte/route.tsx"]) {
      expect(ler(rota), rota).not.toMatch(/\b(fotoDaCapa|capaDaArte)\b/);
    }
  });
});
```

Crie `tests/bonus-capa-foto.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { fotoDaCapa, memoriaDasFotos } from "@/lib/bonus/arte-foto";

// A IMAGEM DA CAPA, BUSCADA PELA ROTA DA ARTE (spec da Etapa 11): a mesma busca, as mesmas travas e a mesma
// memória da foto do espaço (tests/bonus-arte-foto.test.ts), só no caminho exato
// `<pasta da conta do carrossel>/bonus-capa/<uuid>.jpg`. O caminho vem da coluna `arte`, gravado pelo
// servidor que o assinou; mesmo assim, nenhum outro caminho é buscado.

const CONTA = "17841400000000001";
const UUID = "0f8e2a4b-1c3d-4e5f-8a9b-0c1d2e3f4a5b";
const CAMINHO = `${CONTA}/bonus-capa/${UUID}.jpg`;

describe("a imagem da capa", () => {
  it("o caminho exato da capa, na pasta da conta do carrossel, passa pela memória", async () => {
    const buscar = vi.fn(async () => "data:image/jpeg;base64,/9j/");
    expect(await fotoDaCapa(CAMINHO, CONTA, memoriaDasFotos(buscar))).toBe("data:image/jpeg;base64,/9j/");
    expect(buscar).toHaveBeenCalledWith(CAMINHO);
  });

  it.each([
    ["a foto do espaço, de bonus-foto/", `${CONTA}/bonus-foto/${UUID}.jpg`, CONTA],
    ["o slide pronto, de bonus/", `${CONTA}/bonus/${UUID}.jpg`, CONTA],
    ["a arte da fila", `${CONTA}/bonus-fila/${UUID}.jpg`, CONTA],
    ["a capa de outra conta", `17841400000000002/bonus-capa/${UUID}.jpg`, CONTA],
    ["subir de pasta", `${CONTA}/bonus-capa/../../outra/${UUID}.jpg`, CONTA],
    ["outro host, no lugar do caminho", "https://exemplo.com/capa.jpg", CONTA],
    ["o carrossel sem conta", CAMINHO, null],
  ])("recusa como capa %s, sem buscar", async (_nome, caminho, conta) => {
    const buscar = vi.fn(async () => "data:image/jpeg;base64,/9j/");
    expect(await fotoDaCapa(caminho, conta, memoriaDasFotos(buscar))).toBeNull();
    expect(buscar).not.toHaveBeenCalled();
  });
});
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-capa-medida.test.ts tests/bonus-capa-desenho.test.ts tests/bonus-capa-rota.test.ts tests/bonus-capa-foto.test.ts
```

Esperado: os testes da medida e do desenho nem carregam (os arquivos `lib/bonus/capa-*` ainda não existem), e nos da
rota e da busca 12 caem e 3 passam (15).

- [ ] **Passo 3: o código**

Crie `lib/bonus/capa-geometria.ts`:

```ts
// A GEOMETRIA DA CAPA (spec da Etapa 11, "O desenho da capa", o modelo A aprovado pelo Eduardo em 13/10):
// todo número que ocupa lugar na capa, do qual o desenho (capa-desenho.tsx) e a conta do "não cabe"
// (capa-medida.ts) leem.
//
// ⚠️ É UM ARQUIVO PRÓPRIO, e não uma linha a mais em arte-geometria.ts: aquele tem DOIS DONOS, o Chat e o
// Labs, conferidos pelos vetores (tests/vetores-da-arte.json), e a capa é só do Chat (spec, "Onde": o Labs
// não muda). A peça (1080×1350) e a margem de 110 vêm de lá, e a largura útil também: a capa usa a mesma
// margem dos quatro lados, então a quebra de linha medida de hoje (arte-medida.ts) serve ao gancho dela.
import { ALTURA, MARGEM } from "./arte-geometria";

/**
 * Os tamanhos do gancho, do maior ao menor. A escolha é o MAIOR QUE COUBER, como nos slides de hoje
 * (`tamanhoDoSlide`), e em degraus largos, nunca de 1 em 1. São próprios da capa: o gancho dela ocupa
 * a parte de baixo da peça inteira, e não a coluna acima do espaço da imagem.
 */
export const DEGRAUS_DA_CAPA: readonly number[] = [112, 96, 80, 64, 56];

/** A altura máxima do bloco do gancho, de cima da margem do pé para cima. */
export const ALTURA_DO_BLOCO_DA_CAPA = 640;

/** O gancho grande vai apertado: a entrelinha das capas dos exemplos, e não o 1,32 do texto corrido. */
export const ENTRELINHA_DA_CAPA = 1.02;

/** A linha da capa: o Satori arredonda fonte × entrelinha, linha a linha, como em `alturaDaLinha`. */
export function alturaDaLinhaDaCapa(fonte: number): number {
  return Math.round(fonte * ENTRELINHA_DA_CAPA);
}

/** A foto (ou as iniciais) da conta no topo da capa, pequena: o gancho é a peça. */
export const LADO_DA_CONTA_NA_CAPA = 72;
export const FONTE_DO_NOME_NA_CAPA = 30;
export const FONTE_DO_ARROBA_NA_CAPA = 24;

/** Onde o bloco do gancho termina: em cima da margem do pé. */
export const PE_DO_GANCHO = ALTURA - MARGEM;

/**
 * AS SOMBRAS, para o texto branco ser legível em qualquer imagem: uma preta que sobe do pé, de 88% no pé
 * a 0 em 62% da altura, e uma leve que desce do topo, de 45% a 0 em 20%, atrás da conta.
 */
export const SOMBRA_DO_PE = { opacidade: 0.88, ate: 0.62 } as const;
export const SOMBRA_DO_TOPO = { opacidade: 0.45, ate: 0.2 } as const;

/** O fundo da capa ligada que ainda não tem imagem: escuro e liso, para o desenho e o "não cabe" aparecerem antes. */
export const FUNDO_DA_CAPA_SEM_IMAGEM = "#161616";

/** O texto da capa: branco, por cima da sombra. */
export const TEXTO_DA_CAPA = "#FFFFFF";
```

Crie `lib/bonus/capa-medida.ts`:

```ts
// A CONTA DO "NÃO CABE" DA CAPA (spec da Etapa 11, "Por dentro"): o gancho em maiúscula, quebrado como o
// Satori quebra, na entrelinha e nos degraus da capa. PURA, e roda no navegador (o aviso do card), na rota
// (o tamanho do desenho) e no servidor (a recusa do publicar): uma função só para os três, porque o achado
// 70 nasceu de a conta e o desenho divergirem.
//
// A QUEBRA É A DE HOJE (arte-medida.ts, `quebraDaLinha`): a largura real de cada letra da Carlito e os
// pontos de quebra do Satori, medidos contra os vetores do Labs. A largura útil da capa é a mesma da arte
// (as mesmas margens), e só a altura da linha muda. Onde o Satori também quebra dentro da palavra, a conta
// só erra para o lado seguro, como lá.
//
// A MAIÚSCULA VEM ANTES DE MEDIR (`toLocaleUpperCase("pt-BR")`): a medida e o desenho veem o mesmo texto.
// Um `textTransform` no desenho mediria a minúscula e desenharia a maiúscula, que é mais larga.
import { composicaoDoSlide, type LinhaDaArte } from "./arte-composicao";
import { espacoAntes, ESPACAMENTO_DO_NEGRITO } from "./arte-geometria";
import { quebraDaLinha } from "./arte-medida";
import type { SlideParaArte } from "./arte-slides";
import { ALTURA_DO_BLOCO_DA_CAPA, alturaDaLinhaDaCapa, DEGRAUS_DA_CAPA } from "./capa-geometria";

/** O gancho como a capa o escreve: todo em maiúscula, pelas regras do português. */
export function textoDaCapa(texto: string): string {
  return texto.toLocaleUpperCase("pt-BR");
}

/**
 * As linhas da capa: a composição de hoje (a normalização, as quebras e os parágrafos), sobre o texto em
 * maiúscula, e toda linha em negrito. No slide de hoje só o último bloco é negrito; na capa, o gancho
 * inteiro é a peça.
 */
export function composicaoDaCapa(texto: string): LinhaDaArte[] {
  return composicaoDoSlide(null, textoDaCapa(texto)).map((l) => ({ ...l, negrito: true, espacamento: ESPACAMENTO_DO_NEGRITO }));
}

/** A altura que o desenho dá às linhas da capa nesta fonte, e se alguma palavra vaza pela direita. */
export function medidaDaCapa(linhas: LinhaDaArte[], fonte: number): { altura: number; vaza: boolean } {
  let altura = 0;
  let vaza = false;
  for (const linha of linhas) {
    const q = quebraDaLinha(linha, fonte);
    altura += espacoAntes(linha.antes, fonte) + q.linhas * alturaDaLinhaDaCapa(fonte);
    vaza ||= q.vaza;
  }
  return { altura, vaza };
}

/**
 * A FONTE DO GANCHO NA CAPA: o maior degrau em que ele cabe no bloco, sem palavra vazando. Se nem no menor
 * couber, o menor, com `cabe: false`: o card avisa, e o publicar trava (como a Etapa 9 faz com o slide que
 * sairia cortado).
 */
export function tamanhoDaCapa(s: SlideParaArte): { fonte: number; cabe: boolean } {
  const linhas = composicaoDaCapa(s.texto);
  const coube = DEGRAUS_DA_CAPA.find((fonte) => {
    const m = medidaDaCapa(linhas, fonte);
    return !m.vaza && m.altura <= ALTURA_DO_BLOCO_DA_CAPA;
  });
  return coube !== undefined ? { fonte: coube, cabe: true } : { fonte: DEGRAUS_DA_CAPA[DEGRAUS_DA_CAPA.length - 1], cabe: false };
}
```

Crie `lib/bonus/capa-desenho.tsx`:

```tsx
// O DESENHO DA CAPA (spec da Etapa 11, "O desenho da capa", o modelo A), em JSX para o Satori, no molde
// de arte-desenho.tsx. PURO: recebe tudo pronto, e quem busca a imagem e lê a fonte é a rota.
//
// A imagem ocupa o slide inteiro, recortada ao centro (`cover`); uma sombra sobe do pé e outra, leve,
// desce do topo; a conta vai pequena no topo, e o gancho, grande, embaixo, alinhado à esquerda, acima da
// margem do pé. Sem imagem, o fundo é escuro e liso, para o desenho e o "não cabe" aparecerem antes.
//
// ⚠️ DESENHA A COMPOSIÇÃO DA CAPA (capa-medida.ts), linha a linha, e não o texto cru: é a mesma lista que
// a conta do "não cabe" mede, já em maiúscula. Uma caixa por LINHA, e nunca `whiteSpace: "pre-wrap"`
// (arte-desenho.tsx, o que não se mexe), e `flexShrink: 0` no bloco do gancho.
//
// ⚠️ O Satori entende um subconjunto de flexbox com estilo em linha: todo `div` com mais de um filho
// precisa de `display: "flex"`. As camadas são `position: "absolute"`, uma sobre a outra.
import type { ReactElement } from "react";
import { ALTURA, espacoAntes, LARGURA, MARGEM } from "./arte-geometria";
import type { SlideParaArte } from "./arte-slides";
import type { CabecalhoDaArte } from "./arte-tela";
import {
  ENTRELINHA_DA_CAPA,
  FONTE_DO_ARROBA_NA_CAPA,
  FONTE_DO_NOME_NA_CAPA,
  FUNDO_DA_CAPA_SEM_IMAGEM,
  LADO_DA_CONTA_NA_CAPA,
  SOMBRA_DO_PE,
  SOMBRA_DO_TOPO,
  TEXTO_DA_CAPA,
} from "./capa-geometria";
import { composicaoDaCapa } from "./capa-medida";

/** O fundo das iniciais quando a foto da conta não vem: o azul do Instagram, como na arte de hoje. */
const AZUL_DAS_INICIAIS = "#3797F0";

const CAMADA = { position: "absolute", top: 0, left: 0, width: LARGURA, height: ALTURA, display: "flex" } as const;

const sombra = (direcao: "to top" | "to bottom", opacidade: number, ate: number) =>
  `linear-gradient(${direcao}, rgba(0, 0, 0, ${opacidade}) 0%, rgba(0, 0, 0, 0) ${Math.round(ate * 100)}%)`;

export function desenhoDaCapa({
  slide,
  fonte,
  cabecalho,
  familia,
  imagem = null,
}: {
  slide: SlideParaArte;
  fonte: number;
  cabecalho: CabecalhoDaArte;
  familia: string;
  /** A imagem da capa, como `data:` (a rota busca; arte-foto.ts). Sem ela, o fundo escuro liso. */
  imagem?: string | null;
}): ReactElement {
  const linhas = composicaoDaCapa(slide.texto);

  const conta = (
    <div style={{ display: "flex", alignItems: "center" }}>
      {cabecalho.foto ? (
        /* eslint-disable-next-line @next/next/no-img-element -- JSX do Satori, e não HTML de
           página: `next/image` renderiza um componente que ele não sabe ler. */
        <img
          src={cabecalho.foto}
          width={LADO_DA_CONTA_NA_CAPA}
          height={LADO_DA_CONTA_NA_CAPA}
          style={{ borderRadius: 999, objectFit: "cover" }}
          alt=""
        />
      ) : (
        <div
          style={{
            display: "flex",
            width: LADO_DA_CONTA_NA_CAPA,
            height: LADO_DA_CONTA_NA_CAPA,
            borderRadius: 999,
            background: AZUL_DAS_INICIAIS,
            fontSize: 28,
            fontWeight: 700,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {cabecalho.iniciais}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", marginLeft: 18 }}>
        <div style={{ display: "flex", fontSize: FONTE_DO_NOME_NA_CAPA, fontWeight: 700 }}>{cabecalho.nome}</div>
        {cabecalho.arroba && <div style={{ display: "flex", fontSize: FONTE_DO_ARROBA_NA_CAPA }}>@{cabecalho.arroba}</div>}
      </div>
    </div>
  );

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        background: FUNDO_DA_CAPA_SEM_IMAGEM,
        color: TEXTO_DA_CAPA,
        fontFamily: familia,
      }}
    >
      {imagem ? (
        /* eslint-disable-next-line @next/next/no-img-element -- JSX do Satori, e não HTML de
           página: `next/image` renderiza um componente que ele não sabe ler. */
        <img src={imagem} width={LARGURA} height={ALTURA} style={{ ...CAMADA, objectFit: "cover" }} alt="" />
      ) : null}
      <div style={{ ...CAMADA, backgroundImage: sombra("to top", SOMBRA_DO_PE.opacidade, SOMBRA_DO_PE.ate) }} />
      <div style={{ ...CAMADA, backgroundImage: sombra("to bottom", SOMBRA_DO_TOPO.opacidade, SOMBRA_DO_TOPO.ate) }} />
      <div style={{ ...CAMADA, flexDirection: "column", padding: MARGEM }}>
        {conta}
        {/* O ESPAÇADOR: empurra o gancho para baixo, até a margem do pé. */}
        <div style={{ display: "flex", flex: 1 }} />
        <div style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
          {linhas.map((linha, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                fontSize: fonte,
                fontWeight: 700,
                lineHeight: ENTRELINHA_DA_CAPA,
                letterSpacing: linha.espacamento,
                marginTop: espacoAntes(linha.antes, fonte),
              }}
            >
              {linha.texto}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

Em `lib/bonus/arte-resposta.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/arte-resposta.tsx b/lib/bonus/arte-resposta.tsx
index 0fd5762..657b103 100644
--- a/lib/bonus/arte-resposta.tsx
+++ b/lib/bonus/arte-resposta.tsx
@@ -5,6 +5,8 @@ import { fontesDaArte, FAMILIA_DA_ARTE, type FonteDaArte } from "./arte-fonte";
 import { ALTURA, LARGURA } from "./arte-geometria";
 import { tamanhoDoSlide, type SlideParaArte } from "./arte-slides";
 import { CABECALHO_DA_FOTO, CABECALHO_DA_VERSAO, cabecalhosDaArte, type CabecalhoDaArte } from "./arte-tela";
+import { desenhoDaCapa } from "./capa-desenho";
+import { tamanhoDaCapa } from "./capa-medida";
 
 // O PNG DE UM SLIDE: o desenho, a fonte e os cabeçalhos da resposta, juntos. A rota decide o que
 // desenhar; isto desenha. Separado da rota para o teste desenhar de verdade sem sessão nem banco
@@ -25,6 +27,10 @@ import { CABECALHO_DA_FOTO, CABECALHO_DA_VERSAO, cabecalhosDaArte, type Cabecalh
 // fica em branco. Ela é a última a sair: a foto da conta quebrada não a leva junto. E A RESPOSTA DIZ SE
 // ELA VEIO (achado 78): no slide com foto, `X-Arte-Foto` é "sim" ou "faltou". O publicar recusa a arte
 // com "faltou", porque o post sairia sem a foto, em público e sem volta; a miniatura só se refaz.
+//
+// A CAPA (spec da Etapa 11) é o mesmo caminho com outro desenho: `capa` troca a escolha da fonte pela da
+// capa (capa-medida.ts) e o desenho pelo dela (capa-desenho.tsx), e `fotoDoEspaco` leva a imagem da capa,
+// com as mesmas tentativas e o mesmo `X-Arte-Foto`: a capa sem a imagem também não é publicada.
 
 /** Por que o slide não saiu: a rota troca cada motivo por uma frase (arte-textos.ts). */
 export type FalhaDaArte = "fonte" | "desenho";
@@ -39,6 +45,7 @@ export async function respostaDaArte({
   nomeDoArquivo,
   fotoDoEspaco = null,
   versao = null,
+  capa = false,
 }: {
   slide: SlideParaArte;
   comEspaco: boolean;
@@ -46,12 +53,15 @@ export async function respostaDaArte({
   baixar: boolean;
   nomeDoArquivo: string;
   /**
-   * A foto do espaço do slide: `null` quando o slide não tem foto guardada (e o cabeçalho da foto não
-   * vai); `{ foto: null }` quando tem, e a busca falhou; `{ foto }` com o `data:` da foto.
+   * A foto do espaço do slide (na capa, a imagem da capa): `null` quando o slide não tem foto guardada (e
+   * o cabeçalho da foto não vai); `{ foto: null }` quando tem, e a busca falhou; `{ foto }` com o `data:`
+   * da foto.
    */
   fotoDoEspaco?: { foto: string | null } | null;
   /** A versão do desenho (`versaoDoDesenho`), que vai no cabeçalho para o publicar a devolver. */
   versao?: string | null;
+  /** O slide 1 em "Capa com imagem" (Etapa 11): o desenho e a fonte são os da capa. */
+  capa?: boolean;
 }): Promise<ArteDoSlide> {
   let fontes: FonteDaArte[];
   try {
@@ -59,10 +69,12 @@ export async function respostaDaArte({
   } catch {
     return { ok: false, falha: "fonte" };
   }
-  const { fonte } = tamanhoDoSlide(slide, comEspaco);
+  const { fonte } = capa ? tamanhoDaCapa(slide) : tamanhoDoSlide(slide, comEspaco);
 
   const desenhar = async (cab: CabecalhoDaArte, foto: string | null): Promise<Response | null> => {
-    const desenho = desenhoDoSlide({ slide, fonte, comEspaco, cabecalho: cab, familia: FAMILIA_DA_ARTE, fotoDoEspaco: foto });
+    const desenho = capa
+      ? desenhoDaCapa({ slide, fonte, cabecalho: cab, familia: FAMILIA_DA_ARTE, imagem: foto })
+      : desenhoDoSlide({ slide, fonte, comEspaco, cabecalho: cab, familia: FAMILIA_DA_ARTE, fotoDoEspaco: foto });
     const imagem = new ImageResponse(desenho, {
       width: LARGURA,
       height: ALTURA,
```

Em `lib/bonus/arte-foto.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/arte-foto.ts b/lib/bonus/arte-foto.ts
index b2935d4..3b09219 100644
--- a/lib/bonus/arte-foto.ts
+++ b/lib/bonus/arte-foto.ts
@@ -187,3 +187,17 @@ export function fotoDoEspaco(
   if (!conta || !ehCaminhoDoDestino(caminho, pastaDaConta(conta), "foto")) return Promise.resolve(null);
   return memoria.foto(caminho);
 }
+
+/**
+ * A IMAGEM DA CAPA (spec da Etapa 11): a mesma busca, as mesmas travas e a mesma memória da foto do
+ * espaço, só no caminho exato `<pasta da conta do carrossel>/bonus-capa/<uuid>.jpg`. O teto é o mesmo
+ * (2 MB): a imagem da capa sobe pela mesma regra de bytes.
+ */
+export function fotoDaCapa(
+  caminho: string,
+  conta: string | null,
+  memoria: MemoriaDasFotos = fotosDoEspacoDaInstancia
+): Promise<string | null> {
+  if (!conta || !ehCaminhoDoDestino(caminho, pastaDaConta(conta), "capa")) return Promise.resolve(null);
+  return memoria.foto(caminho);
+}
```

Em `lib/bonus/arte-rota.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/arte-rota.ts b/lib/bonus/arte-rota.ts
index ca24f4c..7ec4017 100644
--- a/lib/bonus/arte-rota.ts
+++ b/lib/bonus/arte-rota.ts
@@ -1,15 +1,15 @@
 import "server-only";
 import { NextResponse } from "next/server";
 import { resolverConta } from "./arte-conta";
-import { comEspaco, escolhasDaArte } from "./arte-escolhas";
-import { fotoDoEspaco, fotosDaInstancia } from "./arte-foto";
+import { comEspaco, ehCapa, escolhasDaArte } from "./arte-escolhas";
+import { fotoDaCapa, fotoDoEspaco, fotosDaInstancia } from "./arte-foto";
 import { respostaDaArte } from "./arte-resposta";
 import type { SlideParaArte } from "./arte-slides";
 import { cabecalhoDaConta, nomeDoArquivo } from "./arte-tela";
 import { TEXTO_ARTE_SEM_CONTA, TEXTO_ARTE_SEM_DESENHO, TEXTO_ARTE_SEM_FONTE } from "./arte-textos";
 import type { LinhaDoCarrossel } from "./carrossel-linha";
 import { contasParaArte } from "./carrossel-repositorio";
-import { fotosDaArte, versaoDoDesenho } from "./publicar-regras";
+import { capaDaArte, fotosDaArte, versaoDoDesenho } from "./publicar-regras";
 
 // O DESENHO DE UM SLIDE, COMUM ÀS DUAS ROTAS DA ARTE (spec da Etapa 7): a do carrossel de bônus
 // (app/bonus/[id]/carrossel/[cid]/arte/route.tsx) e a do avulso (app/carrosseis/[cid]/arte/route.tsx).
@@ -40,29 +40,43 @@ export async function desenharSlide(p: {
   // A FOTO DO ESPAÇO (adendo da Etapa 5): só no slide com espaço, e só a do jeito "foto", que o
   // prefixo do caminho guardado diz (publicar-regras.ts). `fotoDoEspaco` confere o caminho na pasta da
   // conta do carrossel antes de buscar.
+  // A CAPA (Etapa 11): no slide 1 em capa, a imagem é a da capa (`capaDaArte`, só a do jeito capa), e
+  // `fotoDaCapa` confere o caminho em `bonus-capa` da pasta da conta antes de buscar.
   const slide = slides[numero - 1];
+  const capa = ehCapa(escolhas, numero);
   const espaco = comEspaco(escolhas, numero);
-  const caminhoDaFoto = espaco ? (fotosDaArte(linha.arte, slides.length)[numero] ?? null) : null;
+  const caminhoDaFoto = capa
+    ? capaDaArte(linha.arte, slides.length).caminho
+    : espaco
+      ? (fotosDaArte(linha.arte, slides.length)[numero] ?? null)
+      : null;
   // As fotos vêm da memória desta instância (arte-foto.ts): as miniaturas chegam juntas, e uma busca
   // só atende todas.
   const [foto, slug, daFoto] = await Promise.all([
     fotosDaInstancia.foto(conta.profile_picture_url),
     p.slug(),
-    caminhoDaFoto ? fotoDoEspaco(caminhoDaFoto, escolhas.conta) : Promise.resolve(null),
+    caminhoDaFoto === null
+      ? Promise.resolve(null)
+      : capa
+        ? fotoDaCapa(caminhoDaFoto, escolhas.conta)
+        : fotoDoEspaco(caminhoDaFoto, escolhas.conta),
   ]);
 
   // O PNG já sai lido inteiro (arte-resposta.tsx, achado 65): uma falha do desenho vira 500 com
   // frase, e não um 200 com o corpo quebrado. Emoji no texto faz o desenho buscar o emoji em
   // cdn.jsdelivr.net (achado 66); sem essa rede, o slide com emoji cai nesta frase.
-  // A versão do desenho vai só no slide que sai com a arte do Chat: o "Só texto" e o com foto.
+  // A versão do desenho vai só no slide que sai com a arte do Chat: o "Só texto", o com foto e a capa
+  // com a imagem dela. A capa sem imagem não tem versão: ela não se publica.
+  const desenhado = capa ? caminhoDaFoto !== null : !espaco || caminhoDaFoto !== null;
   const arte = await respostaDaArte({
     slide,
     comEspaco: espaco,
+    capa,
     cabecalho: cabecalhoDaConta(conta, foto),
     baixar: p.baixar,
     nomeDoArquivo: nomeDoArquivo(slug, numero),
     fotoDoEspaco: caminhoDaFoto ? { foto: daFoto } : null,
-    versao: !espaco || caminhoDaFoto ? versaoDoDesenho(slide, caminhoDaFoto) : null,
+    versao: desenhado ? versaoDoDesenho(slide, caminhoDaFoto) : null,
   });
   if (!arte.ok) return erroDaArte(500, arte.falha === "fonte" ? TEXTO_ARTE_SEM_FONTE : TEXTO_ARTE_SEM_DESENHO);
   return arte.resposta;
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx eslint lib/bonus/capa-geometria.ts lib/bonus/capa-medida.ts lib/bonus/capa-desenho.tsx lib/bonus/arte-resposta.tsx lib/bonus/arte-foto.ts lib/bonus/arte-rota.ts tests/bonus-capa-medida.test.ts tests/bonus-capa-desenho.test.ts tests/bonus-capa-rota.test.ts tests/bonus-capa-foto.test.ts
npx vitest run tests/bonus-capa-medida.test.ts tests/bonus-capa-desenho.test.ts tests/bonus-capa-rota.test.ts tests/bonus-capa-foto.test.ts tests/bonus-arte-paginas.test.ts
git diff --stat HEAD -- lib/bonus/arte-geometria.ts tests/vetores-da-arte.json
```

Esperado: `tsc` e lint limpos; os 5 arquivos passam, com 55 casos (a guarda da rota da arte, `tests/bonus-arte-paginas.test.ts`, inclusive). A última linha não mostra nada.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/capa-geometria.ts lib/bonus/capa-medida.ts lib/bonus/capa-desenho.tsx lib/bonus/arte-resposta.tsx lib/bonus/arte-foto.ts lib/bonus/arte-rota.ts tests/bonus-capa-medida.test.ts tests/bonus-capa-desenho.test.ts tests/bonus-capa-rota.test.ts tests/bonus-capa-foto.test.ts
test "$(git branch --show-current)" = "capa-do-carrossel"
git add lib/bonus/capa-geometria.ts lib/bonus/capa-medida.ts lib/bonus/capa-desenho.tsx lib/bonus/arte-resposta.tsx lib/bonus/arte-foto.ts lib/bonus/arte-rota.ts tests/bonus-capa-medida.test.ts tests/bonus-capa-desenho.test.ts tests/bonus-capa-rota.test.ts tests/bonus-capa-foto.test.ts
```

```bash
git commit -F - <<'MSG'
A capa ganha o desenho: a imagem inteira, a sombra e o gancho em maiúscula medido como o Satori quebra

O gancho passa para maiúscula antes de medir, para a medida e o desenho verem o
mesmo texto, e desce nos degraus da capa até caber no bloco de 640. A rota da
arte desenha a capa com a imagem guardada em bonus-capa/, buscada na pasta da
conta, e a capa sem imagem sai com o fundo escuro liso. A arte-geometria e os
vetores divididos com o Labs não mudam.
MSG
```

---

### FASE 3 — A versão da miniatura leva a capa

**Arquivos:**
- Modificar: `lib/bonus/arte-tela.ts`, `lib/bonus/publicar-regras.ts` (`SEM_CAPA`), e as seis chamadas:
  `app/bonus/carrossel-actions.ts` (duas), `app/bonus/[id]/carrossel/[cid]/revisao.tsx`,
  `lib/bonus/imagem-consulta.ts`, `lib/bonus/publicar-processo.ts` e `lib/bonus/carrosseis-tela.ts`
- Criar: `tests/bonus-capa-versoes.test.ts`
- Testar: `tests/bonus-arte-tela.test.ts`, `tests/bonus-carrosseis-tela.test.ts`,
  `tests/bonus-publicar-regras.test.ts`, `testes-integracao/bonus-imagem-processo.integracao.ts`,
  `testes-integracao/bonus-publicar-processo.integracao.ts`

**Interfaces:**
- Consome: `CapaDaArte` e `capaDaArte` (FASE 1).
- Produz: `versoesDosSlides(slides, soTexto, cabecalho, fotos, capa: CapaDaArte)`, com o quinto parâmetro
  obrigatório; `SEM_CAPA`. Num slide sem a capa, a versão é a de hoje, byte a byte (as versões medidas na
  `main` ficam escritas no teste).

- [ ] **Passo 1: os testes**

Crie `tests/bonus-capa-versoes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { ContaDoCabecalho } from "@/lib/bonus/arte-conta";
import { slidesDoTexto } from "@/lib/bonus/arte-slides";
import { cabecalhoParaVersao, urlDaArte, versoesDosSlides, type CabecalhoDaArte } from "@/lib/bonus/arte-tela";
import { capaDoCarrossel } from "@/lib/bonus/carrosseis-tela";
import type { LinhaDoCarrossel } from "@/lib/bonus/carrossel-linha";
import type { TextoDeCarrossel } from "@/lib/bonus/carrossel-texto";
import { SEM_CAPA, capaDaArte } from "@/lib/bonus/publicar-regras";

// A VERSÃO DA MINIATURA COM A CAPA (spec da Etapa 11, "Por dentro"): ligar ou desligar a capa, e trocar a
// imagem dela, trocam a miniatura do slide 1, e só ela. No slide sem a capa, a versão é a de antes da
// Etapa 11, BYTE A BYTE: os valores abaixo foram medidos na `main` em 9b0c3e6, antes da capa, e uma
// mudança neles pediria de novo todas as miniaturas que já existem. A capa é parâmetro OBRIGATÓRIO de
// `versoesDosSlides` (seis chamadas): o `tsc` recusa a chamada que a esquecer.

const TEXTO: TextoDeCarrossel = {
  tipo: "carrossel",
  titulo: "",
  gancho: "Seu cliente sumiu? Não é culpa dele.",
  slides: [{ titulo: "Um", texto: "Texto do slide." }],
  chamada: "Comente SUMIDO e receba as mensagens.",
  legenda: "x".repeat(100),
};
const SLIDES = slidesDoTexto(TEXTO);
const CAB: CabecalhoDaArte = { nome: "Thiago Vannuchi", arroba: "thiagovannuchi", foto: "https://foto", iniciais: "TV" };
const CONTA = "17841400000000001";
const UUID = "0b2f4c1e-7a9d-4e3b-9c5f-1d2e3f4a5b6c";
const FOTO = `${CONTA}/bonus-foto/${UUID}.jpg`;
const CAPA = `${CONTA}/bonus-capa/${UUID}.jpg`;
const OUTRA_CAPA = `${CONTA}/bonus-capa/0b2f4c1e-7a9d-4e3b-9c5f-1d2e3f4a5b6d.jpg`;
const PRONTO = `${CONTA}/bonus/${UUID}.jpg`;

describe("a versão sem a capa é a de antes da Etapa 11", () => {
  it("medida na main 9b0c3e6: sem nada, com o Só texto no slide 1 e com a foto no slide 1", () => {
    expect(versoesDosSlides(SLIDES, [], CAB, {}, SEM_CAPA)).toEqual(["56507cb5", "24b49f51", "17a20ad3"]);
    expect(versoesDosSlides(SLIDES, [1], CAB, {}, SEM_CAPA)).toEqual(["ad202883", "24b49f51", "17a20ad3"]);
    expect(versoesDosSlides(SLIDES, [], CAB, { 1: FOTO }, SEM_CAPA)).toEqual(["9b58f1bc", "24b49f51", "17a20ad3"]);
  });
});

describe("a versão com a capa", () => {
  const base = versoesDosSlides(SLIDES, [], CAB, {}, SEM_CAPA);
  const comCapa = versoesDosSlides(SLIDES, [], CAB, {}, { ligada: true, caminho: CAPA });

  it("ligar a capa muda só a versão do slide 1", () => {
    expect([comCapa[0] === base[0], comCapa[1] === base[1], comCapa[2] === base[2]]).toEqual([false, true, true]);
  });

  it("trocar a imagem da capa, ou ficar sem ela, muda a versão do slide 1", () => {
    const outra = versoesDosSlides(SLIDES, [], CAB, {}, { ligada: true, caminho: OUTRA_CAPA });
    const semImagem = versoesDosSlides(SLIDES, [], CAB, {}, { ligada: true, caminho: null });
    expect(new Set([comCapa[0], outra[0], semImagem[0]]).size).toBe(3);
  });

  it("a foto do espaço guardada no slide 1 não entra na versão da capa", () => {
    expect(versoesDosSlides(SLIDES, [], CAB, { 1: FOTO }, { ligada: true, caminho: CAPA })).toEqual(comCapa);
  });

  it("a capa sem imagem não é o slide de hoje com o espaço em branco", () => {
    expect(versoesDosSlides(SLIDES, [], CAB, {}, { ligada: true, caminho: null })[0]).not.toBe(base[0]);
  });

  it("o cabeçalho continua mudando a versão da capa", () => {
    const outroCab = versoesDosSlides(SLIDES, [], { ...CAB, foto: null }, {}, { ligada: true, caminho: CAPA });
    expect(outroCab[0]).not.toBe(comCapa[0]);
  });
});

// A MINIATURA DA LISTA DE CARROSSÉIS (Etapa 10): a "capa" da lista é a miniatura do slide 1, e com a capa
// da Etapa 11 ligada ela é a arte da capa, com a versão da capa. O slide pronto guardado no slide 1 não
// vale com a capa ligada (a imagem de outro jeito conta como sem imagem).
describe("a miniatura da lista com a capa", () => {
  const T0 = Date.parse("2026-10-30T12:00:00Z");
  const CONTAS: ContaDoCabecalho[] = [
    { ig_user_id: CONTA, username: "thiagovannuchi", name: "Thiago Vannuchi", profile_picture_url: "https://cdn.exemplo/foto.jpg" },
  ];
  const linha = (arte: Record<string, unknown>): LinhaDoCarrossel => ({
    id: "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d",
    bonus_id: null,
    criado_em: new Date(T0),
    total_slides: SLIDES.length,
    palavra: "SUMIDO",
    contexto: {},
    estado: "pronto",
    gerado: TEXTO,
    revisado: null,
    erro: null,
    medicao: null,
    gerado_em: new Date(T0),
    revisado_em: null,
    arte: { conta: CONTA, ...arte },
    origem: "livre",
    labs_codigo: null,
    texto_a_mao: true,
    acao_da_chamada: null,
  });
  const urlPublica = (caminho: string) => `https://bucket.exemplo/${caminho}`;
  const naLista = (arte: Record<string, unknown>) => capaDoCarrossel(linha(arte), T0, { contas: CONTAS, doCookie: undefined, urlPublica });
  const arteDaCapa = (arte: Record<string, unknown>) => {
    const l = linha(arte);
    const conta = cabecalhoParaVersao(CONTAS[0]);
    const [v] = versoesDosSlides(SLIDES, [], conta, {}, capaDaArte(l.arte, l.total_slides));
    return urlDaArte(`/carrosseis/${l.id}`, 1, v);
  };

  it("a capa com imagem é a arte da capa, com a versão da capa", () => {
    const arte = { capa: true, imagens: { "1": { caminho: CAPA, versao: "v" } } };
    expect(naLista(arte)).toBe(arteDaCapa(arte));
    expect(naLista(arte)).not.toBe(naLista({}));
  });

  it("com a capa ligada, o slide pronto guardado no slide 1 não vira a miniatura", () => {
    const arte = { capa: true, imagens: { "1": { caminho: PRONTO, versao: "v" } } };
    expect(naLista(arte)).toBe(arteDaCapa(arte));
    expect(naLista({ imagens: { "1": { caminho: PRONTO, versao: "v" } } })).toBe(urlPublica(PRONTO));
  });
});
```

Em `tests/bonus-arte-tela.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-arte-tela.test.ts b/tests/bonus-arte-tela.test.ts
index 7d433e5..b54dd49 100644
--- a/tests/bonus-arte-tela.test.ts
+++ b/tests/bonus-arte-tela.test.ts
@@ -15,6 +15,7 @@ import { slidesDoTexto } from "@/lib/bonus/arte-slides";
 import { TEXTO_ARTE_NAO_ENCONTRADA, TEXTO_ARTE_NAO_PRONTA, TEXTO_ARTE_SLIDE_INVALIDO } from "@/lib/bonus/arte-textos";
 import type { LinhaDoCarrossel } from "@/lib/bonus/carrossel-linha";
 import type { TextoDeCarrossel } from "@/lib/bonus/carrossel-texto";
+import { SEM_CAPA } from "@/lib/bonus/publicar-regras";
 
 // O QUE A ROTA DA ARTE E A TELA DECIDEM, fora do JSX e da rota: o número do slide pedido, o nome do
 // arquivo baixado, os cabeçalhos da resposta, o cabeçalho da peça e a versão da prévia.
@@ -126,18 +127,18 @@ describe("a versão de cada miniatura", () => {
     legenda: "x".repeat(100),
   };
   const CAB: CabecalhoDaArte = { nome: "Thiago Vannuchi", arroba: "thiagovannuchi", foto: "https://foto", iniciais: "TV" };
-  const base = versoesDosSlides(slidesDoTexto(texto), [], CAB, {});
+  const base = versoesDosSlides(slidesDoTexto(texto), [], CAB, {}, SEM_CAPA);
 
   it("uma versão por slide, e a mesma para as mesmas entradas", () => {
     expect(base).toHaveLength(3);
-    expect(versoesDosSlides(slidesDoTexto(texto), [], CAB, {})).toEqual(base);
+    expect(versoesDosSlides(slidesDoTexto(texto), [], CAB, {}, SEM_CAPA)).toEqual(base);
     expect(new Set(base).size).toBe(3);
   });
 
   it.each([
-    ["o texto do slide 2", () => versoesDosSlides(slidesDoTexto({ ...texto, slides: [{ ...texto.slides[0], texto: "Outro texto do slide, com mais de trinta." }] }), [], CAB, {})],
-    ["a manchete do slide 2", () => versoesDosSlides(slidesDoTexto({ ...texto, slides: [{ ...texto.slides[0], titulo: "Outra manchete" }] }), [], CAB, {})],
-    ["o só texto do slide 2", () => versoesDosSlides(slidesDoTexto(texto), [2], CAB, {})],
+    ["o texto do slide 2", () => versoesDosSlides(slidesDoTexto({ ...texto, slides: [{ ...texto.slides[0], texto: "Outro texto do slide, com mais de trinta." }] }), [], CAB, {}, SEM_CAPA)],
+    ["a manchete do slide 2", () => versoesDosSlides(slidesDoTexto({ ...texto, slides: [{ ...texto.slides[0], titulo: "Outra manchete" }] }), [], CAB, {}, SEM_CAPA)],
+    ["o só texto do slide 2", () => versoesDosSlides(slidesDoTexto(texto), [2], CAB, {}, SEM_CAPA)],
   ])("%s muda só a versão do slide 2", (_nome, outra) => {
     const v = outra();
     expect([v[0] === base[0], v[1] === base[1], v[2] === base[2]]).toEqual([true, false, true]);
@@ -150,7 +151,7 @@ describe("a versão de cada miniatura", () => {
     ["sem foto", { ...CAB, foto: null }],
     ["as iniciais", { ...CAB, iniciais: "OU" }],
   ])("%s do cabeçalho muda a versão de todos", (_nome, cab) => {
-    const v = versoesDosSlides(slidesDoTexto(texto), [], cab, {});
+    const v = versoesDosSlides(slidesDoTexto(texto), [], cab, {}, SEM_CAPA);
     expect(v.map((x, i) => x === base[i])).toEqual([false, false, false]);
   });
 
@@ -159,14 +160,14 @@ describe("a versão de cada miniatura", () => {
   it("a foto do espaço muda só a versão do slide dela; a do slide só texto não muda nada", () => {
     const FOTO = "17841400000000001/bonus-foto/0f8e2a4b-1c3d-4e5f-8a9b-0c1d2e3f4a5b.jpg";
     const OUTRA = "17841400000000001/bonus-foto/0f8e2a4b-1c3d-4e5f-8a9b-0c1d2e3f4a5c.jpg";
-    const v = versoesDosSlides(slidesDoTexto(texto), [], CAB, { 2: FOTO });
+    const v = versoesDosSlides(slidesDoTexto(texto), [], CAB, { 2: FOTO }, SEM_CAPA);
     expect([v[0] === base[0], v[1] === base[1], v[2] === base[2]]).toEqual([true, false, true]);
-    expect(versoesDosSlides(slidesDoTexto(texto), [], CAB, { 2: OUTRA })[1]).not.toBe(v[1]);
-    expect(versoesDosSlides(slidesDoTexto(texto), [2], CAB, { 2: FOTO })).toEqual(versoesDosSlides(slidesDoTexto(texto), [2], CAB, {}));
+    expect(versoesDosSlides(slidesDoTexto(texto), [], CAB, { 2: OUTRA }, SEM_CAPA)[1]).not.toBe(v[1]);
+    expect(versoesDosSlides(slidesDoTexto(texto), [2], CAB, { 2: FOTO }, SEM_CAPA)).toEqual(versoesDosSlides(slidesDoTexto(texto), [2], CAB, {}, SEM_CAPA));
   });
 
   it("o número e o total de cada slide entram: o mesmo texto noutra posição tem outra versão", () => {
-    const com4 = versoesDosSlides(slidesDoTexto({ ...texto, slides: [texto.slides[0], texto.slides[0]] }), [], CAB, {});
+    const com4 = versoesDosSlides(slidesDoTexto({ ...texto, slides: [texto.slides[0], texto.slides[0]] }), [], CAB, {}, SEM_CAPA);
     expect(com4[0]).not.toBe(base[0]);
   });
 
```

Em `tests/bonus-carrosseis-tela.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-carrosseis-tela.test.ts b/tests/bonus-carrosseis-tela.test.ts
index f357070..64d5b63 100644
--- a/tests/bonus-carrosseis-tela.test.ts
+++ b/tests/bonus-carrosseis-tela.test.ts
@@ -18,7 +18,7 @@ import {
 import type { LinhaDoCarrossel } from "@/lib/bonus/carrossel-linha";
 import type { TextoDoCarrossel } from "@/lib/bonus/carrossel-texto";
 import type { EstadoDaPublicacao } from "@/lib/bonus/publicar-estado";
-import { fotosDaArte } from "@/lib/bonus/publicar-regras";
+import { SEM_CAPA, capaDaArte, fotosDaArte } from "@/lib/bonus/publicar-regras";
 import { TRAVADA_MS } from "@/lib/bonus/tempos";
 
 // O QUE A LISTA "CARROSSÉIS" MOSTRA DE CADA CARROSSEL (spec da Etapa 7, "O menu Carrosséis"; spec da
@@ -276,7 +276,7 @@ describe("a capa: a miniatura do slide 1, como a página do carrossel a mostra",
   const versaoDaPagina = (l: LinhaDoCarrossel) => {
     const escolhas = escolhasDaArte(l.arte, l.total_slides);
     const { conta } = resolverConta(CONTAS, escolhas, undefined);
-    return versoesDosSlides(slidesDoTexto(TEXTO), escolhas.soTexto, cabecalhoParaVersao(conta), fotosDaArte(l.arte, l.total_slides))[0];
+    return versoesDosSlides(slidesDoTexto(TEXTO), escolhas.soTexto, cabecalhoParaVersao(conta), fotosDaArte(l.arte, l.total_slides), SEM_CAPA)[0];
   };
 
   it("sem imagem no slide 1: a arte do slide 1, com a versão que a página calcula", () => {
@@ -314,6 +314,23 @@ describe("a capa: a miniatura do slide 1, como a página do carrossel a mostra",
     expect(capa({ arte: { conta: CONTA, imagens: { "2": { caminho: PRONTO, versao: "v1" } } } })).toBe(capa({ arte: { conta: CONTA } }));
   });
 
+  // A "CAPA COM IMAGEM" (Etapa 11) no slide 1: a miniatura é a arte da capa, com a versão que leva a capa,
+  // e o slide pronto guardado nele não vale ali.
+  it("o slide 1 em capa: a arte da capa, mesmo com um slide pronto guardado nele", () => {
+    const l = linha({ arte: { conta: CONTA, capa: true, imagens: { "1": { caminho: PRONTO, versao: "v1" } } } });
+    const escolhas = escolhasDaArte(l.arte, l.total_slides);
+    const { conta } = resolverConta(CONTAS, escolhas, undefined);
+    const [versao] = versoesDosSlides(
+      slidesDoTexto(TEXTO),
+      escolhas.soTexto,
+      cabecalhoParaVersao(conta),
+      fotosDaArte(l.arte, l.total_slides),
+      capaDaArte(l.arte, l.total_slides)
+    );
+    expect(capa({ arte: l.arte })).toBe(urlDaArte(`/carrosseis/${CARROSSEL}`, 1, versao));
+    expect(versao).not.toBe(versaoDaPagina(l));
+  });
+
   it("ainda gerando, travado ou falhado: o quadro vazio (null)", () => {
     expect(capa({ estado: "gerando", gerado: null })).toBeNull();
     expect(capa({ estado: "gerando", gerado: null, criado_em: new Date(T0 - TRAVADA_MS - 1) })).toBeNull();
```

Em `tests/bonus-publicar-regras.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-publicar-regras.test.ts b/tests/bonus-publicar-regras.test.ts
index 3ba1580..e229020 100644
--- a/tests/bonus-publicar-regras.test.ts
+++ b/tests/bonus-publicar-regras.test.ts
@@ -7,6 +7,7 @@ import {
   PROPORCAO_DA_FOTO_MIN,
   PROPORCAO_MAX,
   PROPORCAO_MIN,
+  SEM_CAPA,
   caminhoDaImagem,
   ehCaminhoDoDestino,
   formaDoCarrossel,
@@ -121,7 +122,7 @@ describe("a versão do texto do slide", () => {
   // aviso "o texto mudou" aparecer sem o texto ter mudado.
   it("não muda com a foto da conta, ao contrário da versão da miniatura", () => {
     const comFoto = (foto: string | null) =>
-      versoesDosSlides([slide], [], { nome: "Thiago", arroba: "thiago", foto, iniciais: "TH" }, {})[0];
+      versoesDosSlides([slide], [], { nome: "Thiago", arroba: "thiago", foto, iniciais: "TH" }, {}, SEM_CAPA)[0];
     expect(comFoto("https://cdn/a.jpg")).not.toBe(comFoto("https://cdn/b.jpg"));
     expect(versaoDoTextoDoSlide(slide)).toBe(versaoDoTextoDoSlide(slide));
   });
```

Em `testes-integracao/bonus-imagem-processo.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/bonus-imagem-processo.integracao.ts b/testes-integracao/bonus-imagem-processo.integracao.ts
index 2d526f6..bb21306 100644
--- a/testes-integracao/bonus-imagem-processo.integracao.ts
+++ b/testes-integracao/bonus-imagem-processo.integracao.ts
@@ -428,8 +428,8 @@ describe("a consulta de um slide", () => {
     const r = await imagem.gerarImagem({ reservaId: await reservado(id), id, numero: 2, descricao: CENA, contas, gerar: openaiQueGera });
     if (!r.ok) throw new Error(`a geração devia passar: ${r.motivo}`);
     const conta = contas.find((c) => c.ig_user_id === CONTA) ?? null;
-    const comFoto = tela.versoesDosSlides(slides.slidesDoTexto(TEXTO), [1, 5], tela.cabecalhoParaVersao(conta), { 2: r.caminho })[1];
-    const semFoto = tela.versoesDosSlides(slides.slidesDoTexto(TEXTO), [1, 5], tela.cabecalhoParaVersao(conta), {})[1];
+    const comFoto = tela.versoesDosSlides(slides.slidesDoTexto(TEXTO), [1, 5], tela.cabecalhoParaVersao(conta), { 2: r.caminho }, regras.SEM_CAPA)[1];
+    const semFoto = tela.versoesDosSlides(slides.slidesDoTexto(TEXTO), [1, 5], tela.cabecalhoParaVersao(conta), {}, regras.SEM_CAPA)[1];
     expect(comFoto).not.toBe(semFoto);
     expect(await consultar(id)).toEqual({ estado: "pronta", hoje: 1, versao: expect.any(String), versaoDaMiniatura: comFoto });
   });
```

Em `testes-integracao/bonus-publicar-processo.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/bonus-publicar-processo.integracao.ts b/testes-integracao/bonus-publicar-processo.integracao.ts
index 4974397..c9f6881 100644
--- a/testes-integracao/bonus-publicar-processo.integracao.ts
+++ b/testes-integracao/bonus-publicar-processo.integracao.ts
@@ -343,7 +343,7 @@ describe("guardar a imagem", () => {
     const foto = await subir(id, 2, "foto");
     const r = await processo.guardarImagem({ id, numero: 2, caminho: foto, contas });
     const cabecalho = tela.cabecalhoParaVersao(contas.find((c) => c.ig_user_id === CONTA) ?? null);
-    const miniatura = tela.versoesDosSlides(slides.slidesDoTexto(TEXTO), [1, 5], cabecalho, { 2: foto })[1];
+    const miniatura = tela.versoesDosSlides(slides.slidesDoTexto(TEXTO), [1, 5], cabecalho, { 2: foto }, regras.SEM_CAPA)[1];
     expect(r).toEqual({ ok: true, versao: versaoDo(2), jeito: "foto", versaoDaMiniatura: miniatura });
     expect(regras.fotosDaArte(await arteDe(id), 5)).toEqual({ 2: foto });
   });
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-capa-versoes.test.ts tests/bonus-arte-tela.test.ts tests/bonus-carrosseis-tela.test.ts tests/bonus-publicar-regras.test.ts
```

Esperado: 7 caem e 153 passam (160): a versão ainda ignora a capa, e a lista ainda mostra o slide pronto guardado no
slide 1 em capa. Os casos sem a capa já passam, inclusive o das versões medidas na `main`: sem a capa, a versão
é a mesma.

- [ ] **Passo 3: o código**

Em `lib/bonus/arte-tela.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/arte-tela.ts b/lib/bonus/arte-tela.ts
index 53f3b4c..1d64837 100644
--- a/lib/bonus/arte-tela.ts
+++ b/lib/bonus/arte-tela.ts
@@ -5,6 +5,7 @@ import { TEXTO_ARTE_NAO_ENCONTRADA, TEXTO_ARTE_NAO_PRONTA, TEXTO_ARTE_SLIDE_INVA
 import { ehDaRota, type RotaDoCarrossel } from "./carrossel-caminho";
 import type { LinhaDoCarrossel } from "./carrossel-linha";
 import { textoDaLinhaDoCarrossel } from "./carrossel-tela";
+import type { CapaDaArte } from "./publicar-regras";
 
 /** O cabeçalho da peça: a "tag" do manual de arte (foto redonda, nome e @). */
 export type CabecalhoDaArte = { nome: string; arroba: string; foto: string | null; iniciais: string };
@@ -111,23 +112,32 @@ export function versaoDaArte(partes: (string | number | null)[]): string {
  * `fotos` é o caminho da foto do espaço de cada slide que tem uma (`fotosDaArte`, publicar-regras.ts;
  * adendo da Etapa 5): trocar a foto troca a miniatura e o "Baixar". No "Só texto" o espaço não existe,
  * e a foto guardada não entra. É obrigatório, para o chamador que esquecer a foto não compilar.
+ *
+ * `capa` é a capa do slide 1 (`capaDaArte`, publicar-regras.ts; spec da Etapa 11): ligar ou desligar a
+ * capa, e trocar a imagem dela, trocam a miniatura do slide 1. Ela também é OBRIGATÓRIA, pelo mesmo
+ * motivo da foto: são seis chamadas, e a sétima não pode esquecê-la. No slide sem a capa, a versão é a de
+ * antes da Etapa 11, byte a byte, para nenhuma miniatura existente ser pedida de novo à toa
+ * (tests/bonus-capa-versoes.test.ts guarda os valores medidos na `main`).
  */
 export function versoesDosSlides(
   slides: SlideParaArte[],
   soTexto: number[],
   cabecalho: CabecalhoDaArte,
-  fotos: Record<number, string>
+  fotos: Record<number, string>,
+  capa: CapaDaArte
 ): string[] {
   return slides.map((s) =>
-    versaoDaArte([
-      JSON.stringify(s),
-      soTexto.includes(s.numero) ? "so_texto" : "com_espaco",
-      cabecalho.nome,
-      cabecalho.arroba,
-      cabecalho.foto,
-      cabecalho.iniciais,
-      soTexto.includes(s.numero) ? null : (fotos[s.numero] ?? null),
-    ])
+    capa.ligada && s.numero === 1
+      ? versaoDaArte([JSON.stringify(s), "capa", cabecalho.nome, cabecalho.arroba, cabecalho.foto, cabecalho.iniciais, capa.caminho])
+      : versaoDaArte([
+          JSON.stringify(s),
+          soTexto.includes(s.numero) ? "so_texto" : "com_espaco",
+          cabecalho.nome,
+          cabecalho.arroba,
+          cabecalho.foto,
+          cabecalho.iniciais,
+          soTexto.includes(s.numero) ? null : (fotos[s.numero] ?? null),
+        ])
   );
 }
 
```

Em `lib/bonus/publicar-regras.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/publicar-regras.ts b/lib/bonus/publicar-regras.ts
index 5571a58..95b2e6b 100644
--- a/lib/bonus/publicar-regras.ts
+++ b/lib/bonus/publicar-regras.ts
@@ -261,6 +261,9 @@ export function fotosDaArte(v: unknown, total: number): Record<number, string> {
  */
 export type CapaDaArte = { ligada: boolean; caminho: string | null };
 
+/** A capa desligada: a dos carrosséis de antes da Etapa 11, e a de quem não a ligou. */
+export const SEM_CAPA: CapaDaArte = { ligada: false, caminho: null };
+
 export function capaDaArte(v: unknown, total: number): CapaDaArte {
   const escolhas = escolhasDaArte(v, total);
   if (!escolhas.capa) return { ligada: false, caminho: null };
```

Em `app/bonus/carrossel-actions.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/carrossel-actions.ts b/app/bonus/carrossel-actions.ts
index 2ae71d0..56c0c8d 100644
--- a/app/bonus/carrossel-actions.ts
+++ b/app/bonus/carrossel-actions.ts
@@ -54,7 +54,7 @@ import {
 import { temChaveDaIA } from "@/lib/bonus/config";
 import { ehIdDeBonus } from "@/lib/bonus/pedido";
 import { situacaoNoLabs } from "@/lib/bonus/publicado";
-import { fotosDaArte, versaoDoTextoDoSlide } from "@/lib/bonus/publicar-regras";
+import { capaDaArte, fotosDaArte, versaoDoTextoDoSlide } from "@/lib/bonus/publicar-regras";
 import { textoDaTrava } from "@/lib/bonus/publicar-textos";
 import { lerLinha } from "@/lib/bonus/repositorio";
 import { geracaoNaTela } from "@/lib/bonus/tempos";
@@ -216,7 +216,7 @@ export async function salvarSlideDoCarrossel(_anterior: AvisoDoSlide | null, for
   if (parte.tipo === "legenda") return resposta("ok", texto);
   const { conta } = resolverConta(contas, escolhas, await contaDoCookie());
   const slides = slidesDoTexto(r.texto);
-  const versoes = versoesDosSlides(slides, escolhas.soTexto, cabecalhoParaVersao(conta), fotosDaArte(linha.arte, total));
+  const versoes = versoesDosSlides(slides, escolhas.soTexto, cabecalhoParaVersao(conta), fotosDaArte(linha.arte, total), capaDaArte(linha.arte, total));
   // A versão do texto salvo vai junto (Etapa 5): o card compara com a da imagem do Canva guardada.
   const doSlide = slides[parte.numero - 1];
   return { ...resposta("ok", texto, versoes[parte.numero - 1] ?? null), versaoDoTexto: doSlide ? versaoDoTextoDoSlide(doSlide) : null };
@@ -252,7 +252,13 @@ export async function salvarArteDoCarrossel(_anterior: AvisoDaArte | null, form:
   return resposta(
     "ok",
     TEXTO_ARTE_SALVA,
-    versoesDosSlides(slidesDoTexto(texto), lido.soTexto, cabecalhoParaVersao(conta), fotosDaArte(linha.arte, linha.total_slides))
+    versoesDosSlides(
+      slidesDoTexto(texto),
+      lido.soTexto,
+      cabecalhoParaVersao(conta),
+      fotosDaArte(linha.arte, linha.total_slides),
+      capaDaArte(linha.arte, linha.total_slides)
+    )
   );
 }
 
```

Em `app/bonus/[id]/carrossel/[cid]/revisao.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/[id]/carrossel/[cid]/revisao.tsx b/app/bonus/[id]/carrossel/[cid]/revisao.tsx
index 1139279..dd4dc53 100644
--- a/app/bonus/[id]/carrossel/[cid]/revisao.tsx
+++ b/app/bonus/[id]/carrossel/[cid]/revisao.tsx
@@ -19,7 +19,7 @@ import { TEXTO_CARROSSEL_SEM_TEXTO } from "@/lib/bonus/carrossel-textos";
 import { imagensNasUltimas24h, ultimasDoCarrossel } from "@/lib/bonus/imagem-repositorio";
 import { estadoDaImagem } from "@/lib/bonus/imagem-regras";
 import { publicacaoLivre } from "@/lib/bonus/publicar-estado";
-import { fotosDaArte, imagensDaArte, versaoDoTextoDoSlide } from "@/lib/bonus/publicar-regras";
+import { capaDaArte, fotosDaArte, imagensDaArte, versaoDoTextoDoSlide } from "@/lib/bonus/publicar-regras";
 import { estadoDoCarrossel } from "@/lib/bonus/publicar-repositorio";
 import {
   textoDaTrava,
@@ -110,7 +110,13 @@ export default async function Revisao({ carrossel }: { carrossel: LinhaDoCarross
       avisoDaConta={conta ? textoDaOrigemDaConta(origem, conta.username ?? "") : TEXTO_ARTE_SEM_CONTA}
       podeFixar={origem === "selecionada" && conta !== null}
       soTextoInicial={escolhas.soTexto}
-      versoes={versoesDosSlides(slidesDoTexto(texto), escolhas.soTexto, cabecalhoParaVersao(conta), fotos)}
+      versoes={versoesDosSlides(
+        slidesDoTexto(texto),
+        escolhas.soTexto,
+        cabecalhoParaVersao(conta),
+        fotos,
+        capaDaArte(carrossel.arte, carrossel.total_slides)
+      )}
       publicacao={publicacao}
     />
   );
```

Em `lib/bonus/imagem-consulta.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/imagem-consulta.ts b/lib/bonus/imagem-consulta.ts
index 35b30c6..2cad780 100644
--- a/lib/bonus/imagem-consulta.ts
+++ b/lib/bonus/imagem-consulta.ts
@@ -9,7 +9,7 @@ import { textoDaLinhaDoCarrossel } from "./carrossel-tela";
 import { imagensNasUltimas24h, ultimasDoCarrossel } from "./imagem-repositorio";
 import { estadoDaImagem } from "./imagem-regras";
 import { TEXTO_IMAGEM_TRAVADA } from "./imagem-textos";
-import { fotosDaArte, imagensDaArte } from "./publicar-regras";
+import { capaDaArte, fotosDaArte, imagensDaArte } from "./publicar-regras";
 
 // A CONSULTA DE UM SLIDE (spec da Etapa 6, "O acompanhar"), comum às duas rotas GET
 // (app/bonus/[id]/carrossel/[cid]/imagem e app/carrosseis/[cid]/imagem), que só conferem a sessão e o
@@ -34,7 +34,13 @@ export async function consultarImagem(p: { linha: LinhaDoCarrossel; numero: numb
   const total = p.linha.total_slides;
   const escolhas = escolhasDaArte(p.linha.arte, total);
   const { conta } = resolverConta(await contasParaArte(), escolhas, p.doCookie);
-  const versoes = versoesDosSlides(slidesDoTexto(texto), escolhas.soTexto, cabecalhoParaVersao(conta), fotosDaArte(p.linha.arte, total));
+  const versoes = versoesDosSlides(
+    slidesDoTexto(texto),
+    escolhas.soTexto,
+    cabecalhoParaVersao(conta),
+    fotosDaArte(p.linha.arte, total),
+    capaDaArte(p.linha.arte, total)
+  );
   return {
     estado: "pronta",
     hoje,
```

Em `lib/bonus/publicar-processo.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/publicar-processo.ts b/lib/bonus/publicar-processo.ts
index c3e76d2..5339728 100644
--- a/lib/bonus/publicar-processo.ts
+++ b/lib/bonus/publicar-processo.ts
@@ -30,6 +30,7 @@ import {
   reservarPublicacao,
 } from "./publicar-repositorio";
 import {
+  capaDaArte,
   ehCaminhoDoDestino,
   formaDoCarrossel,
   fotosDaArte,
@@ -141,8 +142,14 @@ export async function guardarImagem(p: {
   const fotos = { ...fotosDaArte(c.linha.arte, c.linha.total_slides) };
   if (r.jeito === "foto") fotos[p.numero] = p.caminho;
   else delete fotos[p.numero];
+  // A CAPA COM A IMAGEM NOVA (Etapa 11): guardada no slide 1, ela é a imagem da capa se for do jeito capa;
+  // de outro jeito, a capa fica sem imagem. Em outro slide, a capa não muda.
+  const capa =
+    p.numero === 1
+      ? { ligada: c.escolhas.capa, caminho: c.escolhas.capa && r.jeito === "capa" ? p.caminho : null }
+      : capaDaArte(c.linha.arte, c.linha.total_slides);
   const { conta } = resolverConta(p.contas, c.escolhas, undefined);
-  const versaoDaMiniatura = versoesDosSlides(c.slides, c.escolhas.soTexto, cabecalhoParaVersao(conta), fotos)[p.numero - 1];
+  const versaoDaMiniatura = versoesDosSlides(c.slides, c.escolhas.soTexto, cabecalhoParaVersao(conta), fotos, capa)[p.numero - 1];
   return { ok: true, versao: r.versao, jeito: r.jeito, versaoDaMiniatura };
 }
 
```

Em `lib/bonus/carrosseis-tela.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/carrosseis-tela.ts b/lib/bonus/carrosseis-tela.ts
index 5010448..e757dcd 100644
--- a/lib/bonus/carrosseis-tela.ts
+++ b/lib/bonus/carrosseis-tela.ts
@@ -3,7 +3,7 @@
 // as contas, e estas funções decidem a aba, a ordem, o selo e a capa.
 import { fmtDate } from "@/lib/format";
 import { resolverConta, type ContaDoCabecalho } from "./arte-conta";
-import { escolhasDaArte } from "./arte-escolhas";
+import { comEspaco, escolhasDaArte } from "./arte-escolhas";
 import { slidesDoTexto } from "./arte-slides";
 import { cabecalhoParaVersao, urlDaArte, versoesDosSlides } from "./arte-tela";
 import { TEXTO_CARROSSEL_APAGADO } from "./apagar-textos";
@@ -12,7 +12,7 @@ import { caminhoDoCarrossel } from "./carrossel-caminho";
 import type { LinhaDoCarrossel } from "./carrossel-linha";
 import { descricaoDoCarrossel, rotuloDoCarrossel, textoDaLinhaDoCarrossel } from "./carrossel-tela";
 import type { EstadoDaPublicacao } from "./publicar-estado";
-import { fotosDaArte, imagensDaArte, jeitoDoCaminho } from "./publicar-regras";
+import { capaDaArte, fotosDaArte, imagensDaArte, jeitoDoCaminho } from "./publicar-regras";
 import { rotuloDaPublicacao } from "./publicar-textos";
 import type { TipoDoRotulo } from "./tela";
 import { geracaoNaTela } from "./tempos";
@@ -148,19 +148,26 @@ export type ContextoDaCapa = {
 
 /**
  * A CAPA: a miniatura do slide 1, a mesma que a página do carrossel mostra (revisao.tsx e
- * card-da-parte.tsx): a imagem do "Slide pronto do Canva", se o slide 1 tiver uma e não for "Só texto";
- * senão a arte do slide 1, pela rota da arte, com a versão que a página calcula. `null` é o quadro vazio:
- * o carrossel ainda gerando, travado, falhado, ou sem texto.
+ * card-da-parte.tsx): a imagem do "Slide pronto do Canva", se o slide 1 tiver uma e estiver com o espaço
+ * (nem "Só texto", nem em "Capa com imagem", da Etapa 11); senão a arte do slide 1, pela rota da arte, com
+ * a versão que a página calcula, a da capa inclusive. `null` é o quadro vazio: o carrossel ainda gerando,
+ * travado, falhado, ou sem texto.
  */
 export function capaDoCarrossel(l: LinhaDoCarrossel, agoraMs: number, c: ContextoDaCapa): string | null {
   if (geracaoNaTela(l.estado, l.criado_em, agoraMs) !== "pronto") return null;
   const texto = textoDaLinhaDoCarrossel(l);
   if (!texto) return null;
   const escolhas = escolhasDaArte(l.arte, l.total_slides);
-  const imagem = escolhas.soTexto.includes(1) ? undefined : imagensDaArte(l.arte, l.total_slides)[1];
+  const imagem = comEspaco(escolhas, 1) ? imagensDaArte(l.arte, l.total_slides)[1] : undefined;
   const pronto = imagem && jeitoDoCaminho(imagem.caminho) === "slide" ? c.urlPublica(imagem.caminho) : null;
   if (pronto) return pronto;
   const { conta } = resolverConta(c.contas, escolhas, c.doCookie);
-  const [versao] = versoesDosSlides(slidesDoTexto(texto), escolhas.soTexto, cabecalhoParaVersao(conta), fotosDaArte(l.arte, l.total_slides));
+  const [versao] = versoesDosSlides(
+    slidesDoTexto(texto),
+    escolhas.soTexto,
+    cabecalhoParaVersao(conta),
+    fotosDaArte(l.arte, l.total_slides),
+    capaDaArte(l.arte, l.total_slides)
+  );
   return urlDaArte(caminhoDoCarrossel(l), 1, versao);
 }
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx eslint lib/bonus/arte-tela.ts lib/bonus/publicar-regras.ts app/bonus/carrossel-actions.ts "app/bonus/[id]/carrossel/[cid]/revisao.tsx" lib/bonus/imagem-consulta.ts lib/bonus/publicar-processo.ts lib/bonus/carrosseis-tela.ts tests/bonus-capa-versoes.test.ts tests/bonus-arte-tela.test.ts tests/bonus-carrosseis-tela.test.ts tests/bonus-publicar-regras.test.ts testes-integracao/bonus-imagem-processo.integracao.ts testes-integracao/bonus-publicar-processo.integracao.ts
npx vitest run tests/bonus-capa-versoes.test.ts tests/bonus-arte-tela.test.ts tests/bonus-carrosseis-tela.test.ts tests/bonus-publicar-regras.test.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-imagem-processo.integracao.ts testes-integracao/bonus-publicar-processo.integracao.ts
```

Esperado: `tsc` e lint limpos; os 160 puros passam; na integração, `[rede-global] ALVO: banco de TESTE`, os 2 arquivos passam, com 71
casos.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/arte-tela.ts lib/bonus/publicar-regras.ts app/bonus/carrossel-actions.ts "app/bonus/[id]/carrossel/[cid]/revisao.tsx" lib/bonus/imagem-consulta.ts lib/bonus/publicar-processo.ts lib/bonus/carrosseis-tela.ts tests/bonus-capa-versoes.test.ts tests/bonus-arte-tela.test.ts tests/bonus-carrosseis-tela.test.ts tests/bonus-publicar-regras.test.ts testes-integracao/bonus-imagem-processo.integracao.ts testes-integracao/bonus-publicar-processo.integracao.ts
test "$(git branch --show-current)" = "capa-do-carrossel"
git add lib/bonus/arte-tela.ts lib/bonus/publicar-regras.ts app/bonus/carrossel-actions.ts "app/bonus/[id]/carrossel/[cid]/revisao.tsx" lib/bonus/imagem-consulta.ts lib/bonus/publicar-processo.ts lib/bonus/carrosseis-tela.ts tests/bonus-capa-versoes.test.ts tests/bonus-arte-tela.test.ts tests/bonus-carrosseis-tela.test.ts tests/bonus-publicar-regras.test.ts testes-integracao/bonus-imagem-processo.integracao.ts testes-integracao/bonus-publicar-processo.integracao.ts
```

```bash
git commit -F - <<'MSG'
A miniatura leva a capa nas seis chamadas, e o slide sem capa mantém a versão de hoje

A versão da miniatura passa a resumir o jeito da capa e a imagem dela, para a
miniatura trocar quando um dos dois mudar. O parâmetro é obrigatório, e as seis
chamadas o passam (achado 147). Num slide sem a capa, a versão é a de hoje,
byte a byte: o teste a compara com as versões medidas na main, para nenhuma
miniatura que já existe ser pedida de novo à toa.
MSG
```

---

### FASE 4 — Ligar e desligar a capa

**Arquivos:**
- Modificar: `lib/bonus/carrossel-repositorio.ts`, `app/bonus/carrossel-actions.ts`,
  `lib/bonus/arte-escolhas.ts` (o comentário das recusas), `lib/bonus/arte-textos.ts`
- Criar: `testes-integracao/bonus-capa-escolhas.integracao.ts`, `tests/bonus-capa-paginas.test.ts`
- Testar: `testes-integracao/bonus-carrossel-processo.integracao.ts`,
  `testes-integracao/bonus-publicar-processo.integracao.ts`,
  `testes-integracao/bonus-publicar-repositorio.integracao.ts`

**Interfaces:**
- Consome: `lerCapaDoFormulario` (FASE 1), `capaDaArte` e `versoesDosSlides` com a capa (FASE 3).
- Produz: `salvarSoTextoDaArte(id, soTexto, nomeQueFalta, capa: boolean)`, que grava
  `arte = (arte - 'capa') || $2` com `capa: true` só quando ligada; e o campo `capa` ("1") no formulário da
  arte, lido por `salvarArteDoCarrossel`.

- [ ] **Passo 1: os testes**

Crie `testes-integracao/bonus-capa-escolhas.integracao.ts`:

```ts
// LIGAR E DESLIGAR A CAPA, CONTRA O BANCO DE VERDADE (o container; spec da Etapa 11, "O jeito guardado").
//
// A capa se grava pela mesma escrita do "só texto" (`salvarSoTextoDaArte`), com a linha travada e a trava
// do publicar. As proteções são o `where` e a trava, invisíveis ao tsc e à suíte pura: só um caminho que
// fale com o Postgres acusa. A IA é sempre um gerador falso: nada sai para a Anthropic.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { ContaGuardada } from "@/lib/bonus/arte-conta";
import type { TextoDeCarrossel } from "@/lib/bonus/carrossel-texto";
import { bancoDescartavel } from "./harness";

type ModuloRepo = typeof import("@/lib/bonus/carrossel-repositorio");
type ModuloProcesso = typeof import("@/lib/bonus/carrossel-processo");
type ModuloEscolhas = typeof import("@/lib/bonus/arte-escolhas");

const banco = bancoDescartavel();

const THIAGO: ContaGuardada = { conta: "17841400000000001", nome: "Thiago Vannuchi", arroba: "thiagovannuchi" };
const FOTO = "17841400000000001/bonus-foto/0b2f4c1e-7a9d-4e3b-9c5f-1d2e3f4a5b6c.jpg";
const CONTEXTO = {
  tema: "Vendas",
  titulo: "Mensagens para Reativar Clientes Sumidos no WhatsApp",
  descricao: "Mensagens prontas para trazer de volta quem sumiu.",
  oQueResolve: "Reativar clientes que pararam de comprar pelo WhatsApp.",
};
const MEDICAO = { modelo: "claude-opus-5-5", tokensEntrada: 1, tokensSaida: 1, cacheCriado: 0, cacheLido: 0 };
const TEXTO: TextoDeCarrossel = {
  tipo: "carrossel",
  titulo: "Mensagens para reativar clientes",
  gancho: "Seu cliente sumiu? Não é culpa dele.",
  slides: [1, 2, 3].map((i) => ({ titulo: `Título do slide ${i}`, texto: `Texto do slide ${i}, com mais de trinta caracteres.` })),
  chamada: "Comente SUMIDO e receba as mensagens prontas.",
  legenda: "Quem sumiu ainda pode voltar. Comente SUMIDO que eu te mando as mensagens prontas para usar hoje mesmo.",
};

let repo: ModuloRepo;
let processo: ModuloProcesso;
let escolhas: ModuloEscolhas;
let bonusId: string;

beforeAll(async () => {
  repo = await import("@/lib/bonus/carrossel-repositorio");
  processo = await import("@/lib/bonus/carrossel-processo");
  escolhas = await import("@/lib/bonus/arte-escolhas");
});

beforeEach(async () => {
  await banco.db().sql().query(`delete from carrosseis_gerados`);
  await banco.db().sql().query(`delete from bonus_gerados`);
  const [b] = (await banco
    .db()
    .sql()
    .query(
      `insert into bonus_gerados (tema, o_que_resolve, estado, slug, envio_estado)
       values ('Vendas', 'Reativar clientes que pararam de comprar pelo WhatsApp.', 'pronto', 'reativar-clientes-whatsapp', 'criado')
       returning id`
    )) as { id: string }[];
  bonusId = b.id;
});

async function pronto(): Promise<string> {
  const r = await repo.criarPedidoDeCarrossel({ bonusId, total: 5, palavra: "SUMIDO", contexto: CONTEXTO, conta: THIAGO });
  if (!r.ok) throw new Error("teto no meio do teste");
  await processo.processarCarrossel(r.id, async () => ({ ok: true as const, texto: TEXTO, medicao: MEDICAO }));
  return r.id;
}

const arte = async (id: string) => (await repo.lerCarrossel(id))?.arte;
const definirArte = (id: string, valor: unknown) =>
  banco.db().sql().query(`update carrosseis_gerados set arte = $2::jsonb where id = $1`, [id, valor]);

describe("ligar e desligar a capa", () => {
  it("ligar grava capa: true junto do só texto, sem apagar a conta", async () => {
    const id = await pronto();
    expect(await repo.salvarSoTextoDaArte(id, [3], null, true)).toEqual({ ok: true });
    expect(await arte(id)).toEqual({ ...THIAGO, soTexto: [3], capa: true });
    expect(escolhas.escolhasDaArte(await arte(id), 5)).toMatchObject({ capa: true, soTexto: [3] });
  });

  it("desligar tira a chave: a arte volta a ser a de antes da capa", async () => {
    const id = await pronto();
    await repo.salvarSoTextoDaArte(id, [3], null, true);
    expect(await repo.salvarSoTextoDaArte(id, [3], null, false)).toEqual({ ok: true });
    expect(await arte(id)).toEqual({ ...THIAGO, soTexto: [3] });
  });

  it("a imagem guardada no slide 1 fica ao ligar a capa: ela só deixa de valer", async () => {
    const id = await pronto();
    const imagens = { "1": { caminho: FOTO, versao: "v1" } };
    await definirArte(id, { ...THIAGO, imagens });
    await repo.salvarSoTextoDaArte(id, [], null, true);
    expect(await arte(id)).toEqual({ ...THIAGO, imagens, soTexto: [], capa: true });
  });

  it("com o carrossel na fila de publicação, recusa e não grava a capa", async () => {
    const id = await pronto();
    const publicacao = { chave: "pub:capa-1", caminhos: ["17841400000000001/bonus-fila/0b2f4c1e-7a9d-4e3b-9c5f-1d2e3f4a5b6c.jpg"] };
    await banco
      .db()
      .sql()
      .query(`update carrosseis_gerados set arte = arte || jsonb_build_object('publicacao', $2::jsonb || jsonb_build_object('reservada_em', now())) where id = $1`, [
        id,
        publicacao,
      ]);
    const r = await repo.salvarSoTextoDaArte(id, [], null, true);
    expect(r).toMatchObject({ ok: false, motivo: "travado" });
    expect(await arte(id)).not.toHaveProperty("capa");
  });

  it("o carrossel que não está pronto recusa", async () => {
    const r = await repo.criarPedidoDeCarrossel({ bonusId, total: 5, palavra: "SUMIDO", contexto: CONTEXTO, conta: THIAGO });
    if (!r.ok) throw new Error("teto no meio do teste");
    expect(await repo.salvarSoTextoDaArte(r.id, [], null, true)).toEqual({ ok: false, motivo: "nao_pronto" });
    expect(await arte(r.id)).toEqual(THIAGO);
  });
});
```

Crie `tests/bonus-capa-paginas.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { textoDaRecusaDaArte } from "@/lib/bonus/arte-textos";

// O QUE AS ACTIONS DA CAPA LEEM DO NAVEGADOR (spec da Etapa 11), conferido no arquivo, no molde de
// tests/bonus-arte-paginas.test.ts: a action da arte lê a capa pelo `lerCapaDoFormulario`, e a grava na
// mesma escrita do "só texto". O harness da integração não forja sessão, de propósito, e por isso a action
// se confere aqui; o repositório é conferido no container (testes-integracao/bonus-capa-escolhas).

const ACTIONS = "app/bonus/carrossel-actions.ts";
const ler = (f: string) => readFileSync(f, "utf8");

/** O corpo da função exportada, do nome até a próxima `export`. */
function corpo(fonte: string, nome: string): string {
  const inicio = fonte.indexOf(`export async function ${nome}(`);
  if (inicio < 0) throw new Error(`${nome} não está em ${ACTIONS}`);
  const fim = fonte.indexOf("\nexport ", inicio + 1);
  return fonte.slice(inicio, fim < 0 ? undefined : fim);
}

describe("a action da arte com a capa", () => {
  const salvar = corpo(ler(ACTIONS), "salvarArteDoCarrossel");

  it("lê a capa do formulário pela regra pura, com o só texto já lido e o total do carrossel", () => {
    expect(salvar).toContain('lerCapaDoFormulario(form.get("capa"), lido.soTexto, linha.total_slides)');
  });

  it("grava a capa lida, e não a do banco, na mesma escrita do só texto", () => {
    expect(salvar).toMatch(/salvarSoTextoDaArte\(id, lido\.soTexto, [^)]*\), capa\.capa\)/);
  });

  it("devolve as versões com a capa nova", () => {
    expect(salvar).toContain("capaDaArte(arteNova, linha.total_slides)");
  });
});

describe("as frases das recusas da capa", () => {
  it("cada recusa tem a sua frase, e nenhuma é vazia", () => {
    const frases = (["capa", "capa_no_post", "capa_e_so_texto"] as const).map(textoDaRecusaDaArte);
    expect(new Set(frases).size).toBe(3);
    for (const f of frases) expect(f.length).toBeGreaterThan(20);
  });

  it("a capa junto do Só texto diz o que fazer", () => {
    expect(textoDaRecusaDaArte("capa_e_so_texto")).toBe('O slide 1 não pode ser capa e "Só texto" ao mesmo tempo. Desmarque um dos dois.');
  });
});
```

Em `testes-integracao/bonus-carrossel-processo.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/bonus-carrossel-processo.integracao.ts b/testes-integracao/bonus-carrossel-processo.integracao.ts
index 47733af..44b55ac 100644
--- a/testes-integracao/bonus-carrossel-processo.integracao.ts
+++ b/testes-integracao/bonus-carrossel-processo.integracao.ts
@@ -325,26 +325,26 @@ describe("a arte", () => {
 
   it("gravar o só texto mantém a conta, e só vale em carrossel pronto", async () => {
     const id = await pronto(THIAGO);
-    expect(await repo.salvarSoTextoDaArte(id, [2, 4], null)).toEqual({ ok: true });
+    expect(await repo.salvarSoTextoDaArte(id, [2, 4], null, false)).toEqual({ ok: true });
     expect(await arte(id)).toEqual({ ...THIAGO, soTexto: [2, 4] });
-    expect(await repo.salvarSoTextoDaArte(id, [], null)).toEqual({ ok: true });
+    expect(await repo.salvarSoTextoDaArte(id, [], null, false)).toEqual({ ok: true });
     expect(await arte(id)).toEqual({ ...THIAGO, soTexto: [] });
 
     const pendente = await criado(5);
-    expect(await repo.salvarSoTextoDaArte(pendente, [2], null)).toEqual({ ok: false, motivo: "nao_pronto" });
+    expect(await repo.salvarSoTextoDaArte(pendente, [2], null, false)).toEqual({ ok: false, motivo: "nao_pronto" });
     expect(await arte(pendente)).toEqual({});
   });
 
   it("gravar o só texto completa o nome que falta da conta gravada na Etapa 3", async () => {
     const id = await pronto();
     await banco.db().sql().query(`update carrosseis_gerados set arte = '{"conta":"1001"}'::jsonb where id = $1`, [id]);
-    expect(await repo.salvarSoTextoDaArte(id, [3], { nome: "Thiago Vannuchi", arroba: "thiagovannuchi" })).toEqual({ ok: true });
+    expect(await repo.salvarSoTextoDaArte(id, [3], { nome: "Thiago Vannuchi", arroba: "thiagovannuchi" }, false)).toEqual({ ok: true });
     expect(await arte(id)).toEqual({ conta: "1001", nome: "Thiago Vannuchi", arroba: "thiagovannuchi", soTexto: [3] });
   });
 
   it("Fixar nesta conta grava uma vez, mantém o só texto, e recusa o carrossel que já tem conta", async () => {
     const id = await pronto();
-    expect(await repo.salvarSoTextoDaArte(id, [2], null)).toEqual({ ok: true });
+    expect(await repo.salvarSoTextoDaArte(id, [2], null, false)).toEqual({ ok: true });
     expect(await repo.fixarContaDoCarrossel(id, THIAGO)).toBe(true);
     expect(await arte(id)).toEqual({ ...THIAGO, soTexto: [2] });
     expect(await repo.fixarContaDoCarrossel(id, { conta: "1002", nome: "N8X", arroba: "n8x" })).toBe(false);
```

Em `testes-integracao/bonus-publicar-processo.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/bonus-publicar-processo.integracao.ts b/testes-integracao/bonus-publicar-processo.integracao.ts
index c9f6881..d12d2b5 100644
--- a/testes-integracao/bonus-publicar-processo.integracao.ts
+++ b/testes-integracao/bonus-publicar-processo.integracao.ts
@@ -427,7 +427,7 @@ describe("publicar com foto no espaço", () => {
   // "Só texto" tira o espaço: a foto fica guardada, e não é usada (volta se o espaço voltar).
   it("a foto guardada num slide marcado só texto não entra: ele vai com a arte só texto", async () => {
     const { id } = await comFoto();
-    await repo.salvarSoTextoDaArte(id, [1, 2, 5], null);
+    await repo.salvarSoTextoDaArte(id, [1, 2, 5], null, false);
     const artes = await Promise.all(
       [1, 2, 5].map(async (n) => ({ numero: n, caminho: await subir(id, n, "fila"), versao: desenho(n, null) }))
     );
```

Em `testes-integracao/bonus-publicar-repositorio.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/bonus-publicar-repositorio.integracao.ts b/testes-integracao/bonus-publicar-repositorio.integracao.ts
index 17dc235..366b918 100644
--- a/testes-integracao/bonus-publicar-repositorio.integracao.ts
+++ b/testes-integracao/bonus-publicar-repositorio.integracao.ts
@@ -185,7 +185,7 @@ describe("a trava nas gravações do carrossel", () => {
   const CHAVE = `pub:${CONTA}:carrossel:${daFila(90)}`;
   const tentar = async (id: string) => ({
     slide: await repo.salvarParteDoCarrossel(id, { tipo: "slide", numero: 2 }, { slide_1_titulo: "Outro título do slide 1", slide_1_texto: TEXTO.slides[0].texto }, null),
-    soTexto: await repo.salvarSoTextoDaArte(id, [1], null),
+    soTexto: await repo.salvarSoTextoDaArte(id, [1], null, false),
     imagem: await publicar.gravarImagemDoSlide(id, 3, guardada(3)),
   });
   const motivos = (r: Awaited<ReturnType<typeof tentar>>) => [
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-capa-paginas.test.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-capa-escolhas.integracao.ts
```

Esperado: a guarda derruba os 5 casos (5): a action ainda não lê a capa, e as frases das recusas não existem. Na
integração, `[rede-global] ALVO: banco de TESTE`, 2 caem e 3 passam (5): o repositório ainda não grava a capa.

- [ ] **Passo 3: o código**

Em `lib/bonus/carrossel-repositorio.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/carrossel-repositorio.ts b/lib/bonus/carrossel-repositorio.ts
index fb28a16..45db5f2 100644
--- a/lib/bonus/carrossel-repositorio.ts
+++ b/lib/bonus/carrossel-repositorio.ts
@@ -212,11 +212,18 @@ export async function salvarParteDoCarrossel(
  *
  * NUMA TRANSAÇÃO COM A LINHA TRAVADA (spec da Etapa 5): com o carrossel na fila de publicação, ou
  * publicado, recusa, pela mesma função pura da trava que o salvar do slide usa.
+ *
+ * A CAPA (spec da Etapa 11) vai na mesma escrita, porque ligar a capa e o "Só texto" no slide 1 se
+ * desligam um ao outro: os dois mudam juntos, ou nenhum. Ela é OBRIGATÓRIA aqui, para quem gravar o "só
+ * texto" dizer também a capa. A chave `capa: true` só existe com a capa ligada; desligar a tira da
+ * coluna, e o carrossel sem capa guarda a mesma `arte` de antes da Etapa 11. A imagem guardada no slide
+ * 1 fica: com o jeito trocado, ela conta como sem imagem, e sai do bucket quando a nova entra.
  */
 export async function salvarSoTextoDaArte(
   id: string,
   soTexto: number[],
-  nomeQueFalta: { nome: string | null; arroba: string | null } | null
+  nomeQueFalta: { nome: string | null; arroba: string | null } | null,
+  capa: boolean
 ): Promise<{ ok: true } | { ok: false; motivo: "nao_pronto" } | { ok: false; motivo: "travado"; estado: EstadoDaPublicacao }> {
   if (!ehIdDeBonus(id)) return { ok: false, motivo: "nao_pronto" };
   return sql().begin(async (tx) => {
@@ -224,7 +231,10 @@ export async function salvarSoTextoDaArte(
     if (!linha || linha.estado !== "pronto") return { ok: false as const, motivo: "nao_pronto" as const };
     const estado = await estadoDaPublicacaoNa(tx, linha.arte);
     if (!publicacaoLivre(estado)) return { ok: false as const, motivo: "travado" as const, estado };
-    await tx.query(`update carrosseis_gerados set arte = arte || $2::jsonb where id = $1`, [id, { ...chavesDaConta(nomeQueFalta), soTexto }]);
+    await tx.query(`update carrosseis_gerados set arte = (arte - 'capa') || $2::jsonb where id = $1`, [
+      id,
+      { ...chavesDaConta(nomeQueFalta), soTexto, ...(capa ? { capa: true } : {}) },
+    ]);
     return { ok: true as const };
   });
 }
```

Em `app/bonus/carrossel-actions.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/carrossel-actions.ts b/app/bonus/carrossel-actions.ts
index 56c0c8d..2558d2e 100644
--- a/app/bonus/carrossel-actions.ts
+++ b/app/bonus/carrossel-actions.ts
@@ -12,7 +12,7 @@ import {
   resolverConta,
   type ContaGuardada,
 } from "@/lib/bonus/arte-conta";
-import { escolhasDaArte, lerSoTextoDoFormulario } from "@/lib/bonus/arte-escolhas";
+import { escolhasDaArte, lerCapaDoFormulario, lerSoTextoDoFormulario } from "@/lib/bonus/arte-escolhas";
 import { slidesDoTexto } from "@/lib/bonus/arte-slides";
 import { cabecalhoParaVersao, versoesDosSlides } from "@/lib/bonus/arte-tela";
 import {
@@ -227,6 +227,9 @@ export async function salvarSlideDoCarrossel(_anterior: AvisoDoSlide | null, for
  * mesmo motivo do salvar do slide (achado 52), com as versões novas das miniaturas. Só carrossel
  * pronto guarda escolha. A conta não vem do formulário (spec da Etapa 4): o carrossel é da conta em
  * que nasceu. Gravar aqui completa o nome e o @ da conta gravada na Etapa 3 sem eles.
+ *
+ * A CAPA (spec da Etapa 11) vem no mesmo formulário (`capa`: "1" ou ausente), e se grava junto do "só
+ * texto": a tela manda sempre os dois. As versões devolvidas já são as da capa nova.
  */
 export async function salvarArteDoCarrossel(_anterior: AvisoDaArte | null, form: FormData): Promise<AvisoDaArte | null> {
   await exigirSessao();
@@ -244,11 +247,15 @@ export async function salvarArteDoCarrossel(_anterior: AvisoDaArte | null, form:
   if (!texto) return resposta("erro", TEXTO_ARTE_NAO_PRONTA);
   const lido = lerSoTextoDoFormulario(form.getAll("so_texto"), linha.total_slides);
   if (!lido.ok) return resposta("erro", textoDaRecusaDaArte(lido.motivo));
+  const capa = lerCapaDoFormulario(form.get("capa"), lido.soTexto, linha.total_slides);
+  if (!capa.ok) return resposta("erro", textoDaRecusaDaArte(capa.motivo));
   const contas = await contasParaArte();
   const escolhas = escolhasDaArte(linha.arte, linha.total_slides);
-  const salvou = await salvarSoTextoDaArte(id, lido.soTexto, nomeQueFalta(contas, escolhas));
+  const salvou = await salvarSoTextoDaArte(id, lido.soTexto, nomeQueFalta(contas, escolhas), capa.capa);
   if (!salvou.ok) return resposta("erro", salvou.motivo === "travado" ? textoDaTrava(salvou.estado) : TEXTO_ARTE_NAO_PRONTA);
   const { conta } = resolverConta(contas, escolhas, await contaDoCookie());
+  // A capa como ficou gravada: as imagens são as de antes, com o jeito novo do slide 1.
+  const arteNova = { ...(linha.arte as Record<string, unknown>), soTexto: lido.soTexto, capa: capa.capa };
   return resposta(
     "ok",
     TEXTO_ARTE_SALVA,
@@ -257,7 +264,7 @@ export async function salvarArteDoCarrossel(_anterior: AvisoDaArte | null, form:
       lido.soTexto,
       cabecalhoParaVersao(conta),
       fotosDaArte(linha.arte, linha.total_slides),
-      capaDaArte(linha.arte, linha.total_slides)
+      capaDaArte(arteNova, linha.total_slides)
     )
   );
 }
```

Em `lib/bonus/arte-escolhas.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/arte-escolhas.ts b/lib/bonus/arte-escolhas.ts
index 0357df4..584553f 100644
--- a/lib/bonus/arte-escolhas.ts
+++ b/lib/bonus/arte-escolhas.ts
@@ -45,7 +45,7 @@ export function comEspaco(e: EscolhasDaArte, numero: number): boolean {
   return !e.soTexto.includes(numero) && !ehCapa(e, numero);
 }
 
-export type RecusaDaArte = "slide" | "ja_tem_conta" | "sem_conta";
+export type RecusaDaArte = "slide" | "ja_tem_conta" | "sem_conta" | RecusaDaCapa;
 
 /**
  * O "só texto" que o formulário da arte mandou. O navegador manda o que quiser: cada slide tem de
```

Em `lib/bonus/arte-textos.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/arte-textos.ts b/lib/bonus/arte-textos.ts
index 5785a8e..d15911a 100644
--- a/lib/bonus/arte-textos.ts
+++ b/lib/bonus/arte-textos.ts
@@ -35,6 +35,13 @@ export function textoDaRecusaDaArte(motivo: RecusaDaArte): string {
       return "Este carrossel já tem conta, e a conta de um carrossel não muda.";
     case "sem_conta":
       return TEXTO_ARTE_SEM_CONTA;
+    // A CAPA (Etapa 11): a tela nunca manda estes; a frase existe para a escrita errada não sair muda.
+    case "capa":
+      return "A escolha da capa veio num formato que o Chat não entende. Recarregue a página.";
+    case "capa_no_post":
+      return "O post de uma imagem só não tem capa: ele não tem gancho.";
+    case "capa_e_so_texto":
+      return 'O slide 1 não pode ser capa e "Só texto" ao mesmo tempo. Desmarque um dos dois.';
   }
 }
 
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx eslint lib/bonus/carrossel-repositorio.ts app/bonus/carrossel-actions.ts lib/bonus/arte-escolhas.ts lib/bonus/arte-textos.ts testes-integracao/bonus-capa-escolhas.integracao.ts tests/bonus-capa-paginas.test.ts testes-integracao/bonus-carrossel-processo.integracao.ts testes-integracao/bonus-publicar-processo.integracao.ts testes-integracao/bonus-publicar-repositorio.integracao.ts
npx vitest run tests/bonus-capa-paginas.test.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-capa-escolhas.integracao.ts testes-integracao/bonus-carrossel-processo.integracao.ts testes-integracao/bonus-publicar-processo.integracao.ts testes-integracao/bonus-publicar-repositorio.integracao.ts
```

Esperado: `tsc` e lint limpos; os 5 da guarda passam; na integração, os 4 arquivos passam, com 105 casos.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/carrossel-repositorio.ts app/bonus/carrossel-actions.ts lib/bonus/arte-escolhas.ts lib/bonus/arte-textos.ts testes-integracao/bonus-capa-escolhas.integracao.ts tests/bonus-capa-paginas.test.ts testes-integracao/bonus-carrossel-processo.integracao.ts testes-integracao/bonus-publicar-processo.integracao.ts testes-integracao/bonus-publicar-repositorio.integracao.ts
test "$(git branch --show-current)" = "capa-do-carrossel"
git add lib/bonus/carrossel-repositorio.ts app/bonus/carrossel-actions.ts lib/bonus/arte-escolhas.ts lib/bonus/arte-textos.ts testes-integracao/bonus-capa-escolhas.integracao.ts tests/bonus-capa-paginas.test.ts testes-integracao/bonus-carrossel-processo.integracao.ts testes-integracao/bonus-publicar-processo.integracao.ts testes-integracao/bonus-publicar-repositorio.integracao.ts
```

```bash
git commit -F - <<'MSG'
A capa se liga e se desliga junto do só texto, com a linha travada

A capa vai pelo mesmo formulário do Só texto, na mesma linha travada e com a
trava do publicar. O servidor recusa a capa no post de 1 slide (achado 98) e
junto do Só texto no slide 1, e desligar a capa tira a chave da arte.
MSG
```

---

### FASE 5 — A foto da capa sobe para bonus-capa

**Arquivos:**
- Modificar: `lib/bonus/publicar-processo.ts` (`assinarImagem` e `guardarImagem`),
  `lib/bonus/publicar-repositorio.ts` (`gravarImagemDoSlide`), `lib/bonus/publicar-textos.ts`,
  `app/bonus/publicar-actions.ts`, `app/bonus/[id]/carrossel/[cid]/imagem-no-navegador.ts`
- Testar: `testes-dom/bonus-publicar-imagem.dom.tsx`, `testes-integracao/bonus-publicar-processo.integracao.ts`

**Interfaces:**
- Consome: `problemaDaFotoDaCapa`, `recorteDaCapa`, `ehCapa` e o destino `capa` (FASE 1).
- Produz: o destino `capa` na assinatura (recusas `sem_capa`, `na_capa` e `capa_foto`, com
  `textoDoProblemaDaCapa`); a reserva que confere o jeito do caminho contra o do slide; `prepararCapa(arquivo)`
  e `prepararFoto(arquivo)`, sobre o mesmo `recortarParaJpeg`; e o nome do arquivo `${jeito}-${numero}.jpg`.
- **A assinatura da capa não passa pela `decisaoDeAssinatura`** (a decisão do topo deste plano, aceita pela
  auditoria): a régua da capa decide sozinha, e a imagem dela nunca vai à fila.

- [ ] **Passo 1: os testes**

Em `testes-dom/bonus-publicar-imagem.dom.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-dom/bonus-publicar-imagem.dom.tsx b/testes-dom/bonus-publicar-imagem.dom.tsx
index 1a33c32..fd54db4 100644
--- a/testes-dom/bonus-publicar-imagem.dom.tsx
+++ b/testes-dom/bonus-publicar-imagem.dom.tsx
@@ -242,6 +242,56 @@ describe("enviar a foto do espaço de um slide", () => {
   });
 });
 
+// A FOTO DA CAPA (spec da Etapa 11): o mesmo caminho da foto do espaço, com o corte em 4:5, a redução
+// até 2160×2700, o destino `capa` e as frases da capa.
+describe("enviar a foto da capa do slide 1", () => {
+  const assinarOk = vi.fn(
+    async (): Promise<RespostaDaAssinatura> => ({ ok: true, caminho: "178/bonus-capa/u.jpg", url: "https://bucket/sign/178/bonus-capa/u.jpg?token=t" })
+  );
+  const guardado: AvisoDaImagem = { tom: "ok", texto: "Imagem guardada.", em: 1, versao: "0a1b2c3d", jeito: "capa", versaoDaMiniatura: "m1-capa" };
+
+  it("a foto de celular em 3:4 perde o alto e o baixo, é reduzida a 2160×2700, assina no destino da capa, sobe e guarda", async () => {
+    medidas = { width: 3024, height: 4032 };
+    const guardar = vi.fn(async () => guardado);
+    const r = await enviarImagemDoSlide({ carrosselId: CARROSSEL, numero: 1, jeito: "capa", arquivo: arquivo("image/jpeg"), assinar: assinarOk, guardar });
+    expect(r).toBe(guardado);
+    expect(pinceladas).toEqual(["cor #ffffff", "pintou 2160x2700", "recortou 0,126 3024x3780 em 2160x2700", "fechou"]);
+    expect(toBlob).toEqual([{ tipo: "image/jpeg", qualidade: 0.9, largura: 2160, altura: 2700 }]);
+    expect(assinarOk).toHaveBeenCalledWith({
+      id: CARROSSEL,
+      numero: 1,
+      destino: "capa",
+      arquivo: { nome: "capa-1.jpg", mime: "image/jpeg", bytes: 4, largura: 2160, altura: 2700 },
+    });
+    expect(puts).toEqual([{ url: "https://bucket/sign/178/bonus-capa/u.jpg?token=t", tipo: "image/jpeg", corpo: expect.any(Blob) }]);
+    expect(guardar).toHaveBeenCalledWith({ id: CARROSSEL, numero: 1, caminho: "178/bonus-capa/u.jpg" });
+  });
+
+  it("a foto deitada perde as laterais, e não é ampliada", async () => {
+    medidas = { width: 1920, height: 1440 };
+    await enviarImagemDoSlide({ carrosselId: CARROSSEL, numero: 1, jeito: "capa", arquivo: arquivo("image/jpeg"), assinar: assinarOk, guardar: vi.fn() });
+    expect(pinceladas).toContain("recortou 384,0 1152x1440 em 1152x1440");
+  });
+
+  it("a foto cujo corte fica menor que 1080×1350 é recusada antes de assinar, com a frase da capa", async () => {
+    medidas = { width: 1000, height: 1600 };
+    const assinar = vi.fn();
+    const r = await enviarImagemDoSlide({ carrosselId: CARROSSEL, numero: 1, jeito: "capa", arquivo: arquivo("image/jpeg"), assinar, guardar: vi.fn() });
+    expect(r).toMatchObject({ tom: "erro", texto: "A foto é pequena para a capa: o mínimo é 1080×1350, depois do corte em 4:5." });
+    expect(assinar).not.toHaveBeenCalled();
+    expect(toBlob).toEqual([]);
+  });
+
+  it("a foto da capa que passa de 2 MB depois de reduzida é recusada antes de assinar", async () => {
+    medidas = { width: 2160, height: 2700 };
+    bytesDoJpeg = FOTO_DO_ESPACO_MAX_BYTES + 1;
+    const assinar = vi.fn();
+    const r = await enviarImagemDoSlide({ carrosselId: CARROSSEL, numero: 1, jeito: "capa", arquivo: arquivo("image/jpeg"), assinar, guardar: vi.fn() });
+    expect(r).toMatchObject({ tom: "erro", texto: "A foto da capa passou de 2 MB mesmo reduzida. Tente outra foto, ou exporte esta com menos qualidade." });
+    expect(assinar).not.toHaveBeenCalled();
+  });
+});
+
 describe("as artes do Chat, na hora de publicar", () => {
   const assinar = vi.fn(async (p: unknown): Promise<RespostaDaAssinatura> => {
     const n = (p as { numero: number }).numero;
```

Em `testes-integracao/bonus-publicar-processo.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/bonus-publicar-processo.integracao.ts b/testes-integracao/bonus-publicar-processo.integracao.ts
index d12d2b5..0742fb4 100644
--- a/testes-integracao/bonus-publicar-processo.integracao.ts
+++ b/testes-integracao/bonus-publicar-processo.integracao.ts
@@ -783,3 +783,83 @@ describe("publicar com um slide que sai cortado", () => {
     expect(await fila()).toEqual([]);
   });
 });
+
+// A FOTO DA CAPA (spec da Etapa 11, "A imagem da capa"): o slide 1 em capa recebe só a imagem da capa, em
+// `bonus-capa`, pela regra da capa (o 4:5 de 1080×1350 a 2160×2700, ou a gerada 1024×1536, até 2 MB). A
+// imagem da capa só entra no slide em capa, e a troca de jeito apaga a imagem anterior do bucket, como a
+// troca de foto. A capa desligada no meio de uma subida é recusada no guardar, com a linha travada.
+describe("a foto da capa", () => {
+  /** O slide 1 em capa; o 5 só texto; o 2, o 3 e o 4 com espaço. */
+  const ARTE_CAPA = { conta: CONTA, nome: "Thiago Vannuchi", arroba: "thiagovannuchi", soTexto: [5], capa: true };
+  const CAPA_DECLARADA = { nome: "capa.jpg", mime: "image/jpeg", bytes: 1000, largura: 1080, altura: 1350 };
+  const GERADA_DECLARADA = { nome: "imagem-gerada.jpg", mime: "image/jpeg", bytes: 1000, largura: 1024, altura: 1536 };
+  const CAMINHO_DA_CAPA = new RegExp(`^${CONTA}/bonus-capa/[0-9a-f-]{36}\.jpg$`);
+
+  async function subirCapa(id: string, arquivo: Record<string, unknown> = CAPA_DECLARADA): Promise<string> {
+    const a = await processo.assinarImagem({ id, numero: 1, destino: "capa", arquivo, contas });
+    if (!a.ok) throw new Error(`assinar recusou: ${a.recusa.motivo}`);
+    const r = await fetch(a.url, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: JPEG });
+    if (!r.ok) throw new Error(`o PUT falhou: ${r.status}`);
+    return a.caminho;
+  }
+
+  it("assina em bonus-capa, na pasta da conta do carrossel; a gerada em pé (1024×1536) também passa", async () => {
+    const id = await carrossel(ARTE_CAPA);
+    expect(await subirCapa(id)).toMatch(CAMINHO_DA_CAPA);
+    expect(await subirCapa(id, GERADA_DECLARADA)).toMatch(CAMINHO_DA_CAPA);
+  });
+
+  it("sem a capa ligada, a imagem da capa é recusada; no slide em capa, a foto do espaço e o slide pronto também", async () => {
+    const semCapa = await carrossel({ ...ARTE_CAPA, capa: false });
+    const r = await processo.assinarImagem({ id: semCapa, numero: 1, destino: "capa", arquivo: CAPA_DECLARADA, contas });
+    expect(r.ok ? null : r.recusa).toEqual({ motivo: "sem_capa", numero: 1 });
+    const id = await carrossel(ARTE_CAPA);
+    for (const [destino, arquivo] of [
+      ["foto", FOTO_DECLARADA],
+      ["slide", DECLARADO],
+    ] as const) {
+      const recusa = await processo.assinarImagem({ id, numero: 1, destino, arquivo, contas });
+      expect(recusa.ok ? null : recusa.recusa).toEqual({ motivo: "na_capa", numero: 1 });
+    }
+    expect(bucket.chamadas).toEqual([]);
+  });
+
+  it("a foto fora do 4:5, ou acima de 2 MB, é recusada como capa", async () => {
+    const id = await carrossel(ARTE_CAPA);
+    const deitada = await processo.assinarImagem({ id, numero: 1, destino: "capa", arquivo: FOTO_DECLARADA, contas });
+    expect(deitada.ok ? null : deitada.recusa).toEqual({ motivo: "capa_foto", problema: "proporcao" });
+    const pesada = await processo.assinarImagem({ id, numero: 1, destino: "capa", arquivo: { ...CAPA_DECLARADA, bytes: 2 * 1024 * 1024 + 1 }, contas });
+    expect(pesada.ok ? null : pesada.recusa).toEqual({ motivo: "capa_foto", problema: "pesada" });
+  });
+
+  it("guardar a capa devolve o jeito capa e a miniatura com a capa; a foto anterior do slide 1 sai do bucket", async () => {
+    const id = await carrossel({ ...ARTE_CAPA, capa: false });
+    const foto = await subir(id, 1, "foto");
+    await processo.guardarImagem({ id, numero: 1, caminho: foto, contas });
+    await repo.salvarSoTextoDaArte(id, [5], null, true);
+    const capa = await subirCapa(id);
+    const r = await processo.guardarImagem({ id, numero: 1, caminho: capa, contas });
+    const cabecalho = tela.cabecalhoParaVersao(contas.find((c) => c.ig_user_id === CONTA) ?? null);
+    const miniatura = tela.versoesDosSlides(slides.slidesDoTexto(TEXTO), [5], cabecalho, {}, { ligada: true, caminho: capa })[0];
+    expect(r).toEqual({ ok: true, versao: versaoDo(1), jeito: "capa", versaoDaMiniatura: miniatura });
+    expect(bucket.objetos.has(foto)).toBe(false);
+    expect(regras.capaDaArte(await arteDe(id), 5)).toEqual({ ligada: true, caminho: capa });
+  });
+
+  it("a capa desligada no meio da subida: guardar a imagem da capa é recusado, e nada muda na arte", async () => {
+    const id = await carrossel(ARTE_CAPA);
+    const capa = await subirCapa(id);
+    await repo.salvarSoTextoDaArte(id, [5], null, false);
+    const r = await processo.guardarImagem({ id, numero: 1, caminho: capa, contas });
+    expect(r.ok ? null : r.recusa).toEqual({ motivo: "sem_capa", numero: 1 });
+    expect(regras.imagensDaArte(await arteDe(id), 5)).toEqual({});
+  });
+
+  it("a capa ligada no meio da subida da foto do espaço: guardar a foto no slide 1 é recusado", async () => {
+    const id = await carrossel({ ...ARTE_CAPA, capa: false });
+    const foto = await subir(id, 1, "foto");
+    await repo.salvarSoTextoDaArte(id, [5], null, true);
+    const r = await processo.guardarImagem({ id, numero: 1, caminho: foto, contas });
+    expect(r.ok ? null : r.recusa).toEqual({ motivo: "na_capa", numero: 1 });
+  });
+});
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run --config vitest.dom.config.ts testes-dom/bonus-publicar-imagem.dom.tsx
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-publicar-processo.integracao.ts
```

Esperado: na tela, 4 caem e 25 passam (29): o navegador ainda não recorta a foto da capa. Na integração,
`[rede-global] ALVO: banco de TESTE`, 6 caem e 48 passam (54): o servidor ainda não assina nem guarda no
destino da capa.

- [ ] **Passo 3: o código**

Em `lib/bonus/publicar-processo.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/publicar-processo.ts b/lib/bonus/publicar-processo.ts
index 5339728..312a888 100644
--- a/lib/bonus/publicar-processo.ts
+++ b/lib/bonus/publicar-processo.ts
@@ -11,7 +11,7 @@ import {
 } from "@/lib/publicacao";
 import { drainQueue } from "@/lib/queue-drain";
 import { resolverConta, type ContaDoCabecalho } from "./arte-conta";
-import { comEspaco, escolhasDaArte, type EscolhasDaArte } from "./arte-escolhas";
+import { comEspaco, ehCapa, escolhasDaArte, type EscolhasDaArte } from "./arte-escolhas";
 import { slidesDoTexto, type SlideParaArte } from "./arte-slides";
 import { cabecalhoParaVersao, versoesDosSlides } from "./arte-tela";
 import type { LinhaDoCarrossel } from "./carrossel-linha";
@@ -35,6 +35,7 @@ import {
   formaDoCarrossel,
   fotosDaArte,
   imagensDaArte,
+  problemaDaFotoDaCapa,
   problemaDaFotoDoEspaco,
   problemaDaProporcaoDoSlide,
   versaoDoDesenho,
@@ -89,6 +90,13 @@ const mensagem = (e: unknown) => (e instanceof Error && e.message ? e.message :
  * publicar. Só JPEG: a foto na proporção do espaço e até 2 MB (achado 79), o resto em 4:5; e tudo
  * pela `decisaoDeAssinatura` do /publicar com a forma do carrossel. As medidas são declaradas pelo
  * navegador, como no /publicar.
+ *
+ * NO DESTINO `capa` (spec da Etapa 11), a imagem da capa do slide 1 em capa, pela regra da foto da capa
+ * (`problemaDaFotoDaCapa`: JPEG, 4:5 ou a gerada 1024×1536, e até 2 MB). Ela NÃO passa pela
+ * `decisaoDeAssinatura`, de propósito: aquela é a régua da fila do /publicar, e recusa abaixo de 0,8 a
+ * imagem gerada em pé (1024×1536, 0,667). A imagem da capa nunca vai à fila: vai a arte da capa, em
+ * 1080×1350, que passa pela régua no destino `fila`. O teto de bytes da capa (2 MB) fica bem abaixo do
+ * da Meta e do bucket.
  */
 export async function assinarImagem(p: {
   id: string;
@@ -100,12 +108,30 @@ export async function assinarImagem(p: {
   const c = await conferirCarrossel(p.id, p.contas);
   if (!c.ok) return c;
   if (!Number.isInteger(p.numero) || !c.slides[p.numero - 1]) return recusa({ motivo: "slide" });
+  const capa = ehCapa(c.escolhas, p.numero);
   const espaco = comEspaco(c.escolhas, p.numero);
-  const desenhado = !espaco || fotosDaArte(c.linha.arte, c.linha.total_slides)[p.numero] !== undefined;
-  if (p.destino !== "fila" && !espaco) return recusa({ motivo: "sem_espaco", numero: p.numero });
-  if (p.destino === "fila" && !desenhado) return recusa({ motivo: "nao_e_so_texto", numero: p.numero });
+  if (p.destino === "capa") {
+    if (!capa) return recusa({ motivo: "sem_capa", numero: p.numero });
+  } else if (p.destino !== "fila" && !espaco) {
+    return recusa(capa ? { motivo: "na_capa", numero: p.numero } : { motivo: "sem_espaco", numero: p.numero });
+  }
+  if (p.destino === "fila") {
+    // A arte da capa só sobe com a imagem da capa: sem ela, o slide 1 não está pronto para publicar.
+    if (capa && capaDaArte(c.linha.arte, c.linha.total_slides).caminho === null) return recusa({ motivo: "faltam_imagens", slides: [p.numero] });
+    const desenhado = capa || !espaco || fotosDaArte(c.linha.arte, c.linha.total_slides)[p.numero] !== undefined;
+    if (!desenhado) return recusa({ motivo: "nao_e_so_texto", numero: p.numero });
+  }
   const arquivo = (p.arquivo !== null && typeof p.arquivo === "object" ? p.arquivo : {}) as Record<string, unknown>;
   if (arquivo.mime !== "image/jpeg") return recusa({ motivo: "tipo" });
+  if (p.destino === "capa") {
+    const problema = problemaDaFotoDaCapa(numero(arquivo.largura), numero(arquivo.altura), numero(arquivo.bytes));
+    if (problema) return recusa({ motivo: "capa_foto", problema });
+    try {
+      return { ok: true, ...(await assinarCaminho(c.conta, "capa")) };
+    } catch (e) {
+      return recusa({ motivo: "armazenamento", texto: mensagem(e) });
+    }
+  }
   if (p.destino === "foto") {
     const foto = problemaDaFotoDoEspaco(numero(arquivo.largura), numero(arquivo.altura), numero(arquivo.bytes));
     if (foto) return recusa({ motivo: "foto", problema: foto });
```

Em `lib/bonus/publicar-repositorio.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/publicar-repositorio.ts b/lib/bonus/publicar-repositorio.ts
index 8203225..22159f1 100644
--- a/lib/bonus/publicar-repositorio.ts
+++ b/lib/bonus/publicar-repositorio.ts
@@ -1,7 +1,7 @@
 import "server-only";
 import { pastaDaConta } from "@/lib/bucket";
 import { sql } from "@/lib/db";
-import { comEspaco, escolhasDaArte } from "./arte-escolhas";
+import { comEspaco, ehCapa, escolhasDaArte } from "./arte-escolhas";
 import { slidesDoTexto } from "./arte-slides";
 import type { LinhaDoCarrossel } from "./carrossel-linha";
 import { textoDaLinhaDoCarrossel } from "./carrossel-tela";
@@ -60,6 +60,10 @@ const recusa = (r: RecusaDaPublicacaoDoCarrossel): Recusa => ({ ok: false, recus
  * da Etapa 5). O jeito é o prefixo do caminho que o servidor assinou, e não se grava à parte. A versão
  * gravada é a do texto SALVO agora. Devolve a imagem anterior daquele slide, de qualquer jeito, para
  * quem chama apagá-la do bucket depois do `commit`.
+ *
+ * NO SLIDE 1 EM CAPA (spec da Etapa 11), só a imagem da capa, em `<pasta>/bonus-capa/<uuid>.jpg`; e a da
+ * capa só entra no slide em capa. A capa desligada no meio de uma subida (ou de uma geração por IA) cai
+ * aqui, com a linha travada, e a imagem que subiu sai do bucket por quem chama.
  */
 export async function gravarImagemDoSlide(
   id: string,
@@ -77,10 +81,12 @@ export async function gravarImagemDoSlide(
     if (!publicacaoLivre(estado)) return recusa({ motivo: "travado", estado });
     const slide = slidesDoTexto(texto)[numero - 1];
     if (!Number.isInteger(numero) || !slide) return recusa({ motivo: "slide" });
-    if (!comEspaco(escolhas, numero)) return recusa({ motivo: "sem_espaco", numero });
+    const capa = ehCapa(escolhas, numero);
+    if (!capa && !comEspaco(escolhas, numero)) return recusa({ motivo: "sem_espaco", numero });
     const pasta = pastaDaConta(escolhas.conta);
-    const jeito = ehCaminhoDoDestino(caminho, pasta, "foto") ? "foto" : ehCaminhoDoDestino(caminho, pasta, "slide") ? "slide" : null;
+    const jeito = (["foto", "slide", "capa"] as const).find((j) => ehCaminhoDoDestino(caminho, pasta, j)) ?? null;
     if (!jeito) return recusa({ motivo: "caminho" });
+    if (capa !== (jeito === "capa")) return recusa(capa ? { motivo: "na_capa", numero } : { motivo: "sem_capa", numero });
     const anterior = imagensDaArte(linha.arte, linha.total_slides)[numero]?.caminho ?? null;
     const versao = versaoDoTextoDoSlide(slide);
     await tx.query(
```

Em `lib/bonus/publicar-textos.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/publicar-textos.ts b/lib/bonus/publicar-textos.ts
index 69fb0f8..a680ed1 100644
--- a/lib/bonus/publicar-textos.ts
+++ b/lib/bonus/publicar-textos.ts
@@ -203,6 +203,25 @@ export function textoDoProblemaDaFoto(p: ProblemaDaFoto): string {
   }
 }
 
+/**
+ * A FOTO DA CAPA que não serve (spec da Etapa 11). Como na foto do espaço, o navegador recorta e reduz
+ * antes de subir: a proporção e o "grande" só aparecem num pedido montado à mão ou numa página velha.
+ */
+export function textoDoProblemaDaCapa(p: ProblemaDaFoto): string {
+  switch (p) {
+    case "sem_medida":
+      return "Não consegui ler o tamanho da foto da capa. Tente outra foto.";
+    case "proporcao":
+      return "A foto da capa tem de chegar cortada em 4:5, em pé. Recarregue a página e tente de novo.";
+    case "pequena":
+      return "A foto é pequena para a capa: o mínimo é 1080×1350, depois do corte em 4:5.";
+    case "grande":
+      return "A foto da capa tem de chegar reduzida a no máximo 2160×2700. Recarregue a página e tente de novo.";
+    case "pesada":
+      return "A foto da capa passou de 2 MB mesmo reduzida. Tente outra foto, ou exporte esta com menos qualidade.";
+  }
+}
+
 /** As recusas de assinar, guardar e publicar (publicar-processo.ts). */
 export type RecusaDaPublicacaoDoCarrossel =
   | { motivo: "nao_pronto" }
@@ -215,6 +234,9 @@ export type RecusaDaPublicacaoDoCarrossel =
   | { motivo: "tipo" }
   | { motivo: "proporcao"; problema: ProblemaDaProporcao }
   | { motivo: "foto"; problema: ProblemaDaFoto }
+  | { motivo: "capa_foto"; problema: ProblemaDaFoto }
+  | { motivo: "sem_capa"; numero: number }
+  | { motivo: "na_capa"; numero: number }
   | { motivo: "arquivo"; texto: string }
   | { motivo: "caminho" }
   | { motivo: "faltam_imagens"; slides: number[] }
@@ -251,6 +273,12 @@ export function textoDaRecusaDaPublicacaoDoCarrossel(r: RecusaDaPublicacaoDoCarr
       return textoDaProporcao(r.problema);
     case "foto":
       return textoDoProblemaDaFoto(r.problema);
+    case "capa_foto":
+      return textoDoProblemaDaCapa(r.problema);
+    case "sem_capa":
+      return `O slide ${r.numero} não está como capa: a imagem da capa só entra com a "Capa com imagem" ligada. Recarregue a página.`;
+    case "na_capa":
+      return `O slide ${r.numero} está como capa: ele recebe só a foto da capa, e não a foto do espaço nem o slide pronto. Recarregue a página.`;
     case "arquivo":
       return r.texto;
     case "caminho":
```

Em `app/bonus/publicar-actions.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/publicar-actions.ts b/app/bonus/publicar-actions.ts
index e33bc29..ef718a0 100644
--- a/app/bonus/publicar-actions.ts
+++ b/app/bonus/publicar-actions.ts
@@ -40,13 +40,15 @@ const inteiro = (v: unknown): number => (typeof v === "number" && Number.isInteg
 /**
  * A PERMISSÃO PARA SUBIR UMA IMAGEM: no destino `slide`, o slide pronto do Canva de um slide com
  * espaço; no destino `foto`, a foto do espaço da arte (adendo da Etapa 5); no destino `fila`, a arte
- * desenhada, convertida na hora de publicar. O navegador sobe direto ao bucket, pela URL assinada,
- * porque a Vercel recusa corpo acima de 4,5 MB (lib/bucket.ts).
+ * desenhada, convertida na hora de publicar; no destino `capa`, a foto da capa do slide 1 (Etapa 11). O
+ * navegador sobe direto ao bucket, pela URL assinada, porque a Vercel recusa corpo acima de 4,5 MB
+ * (lib/bucket.ts).
  */
 export async function assinarImagemDoCarrossel(pedido: unknown): Promise<RespostaDaAssinatura> {
   await exigirSessao();
   const p = registro(pedido);
-  const destino = p.destino === "slide" || p.destino === "foto" || p.destino === "fila" ? p.destino : null;
+  const destino =
+    p.destino === "slide" || p.destino === "foto" || p.destino === "fila" || p.destino === "capa" ? p.destino : null;
   if (!ehIdDeBonus(p.id) || !destino) return { ok: false, texto: TEXTO_PEDIDO_INVALIDO };
   const r = await assinarImagem({ id: p.id, numero: inteiro(p.numero), destino, arquivo: p.arquivo, contas: await contasParaArte() });
   return r.ok ? { ok: true, caminho: r.caminho, url: r.url } : { ok: false, texto: textoDaRecusaDaPublicacaoDoCarrossel(r.recusa) };
```

Em `app/bonus/[id]/carrossel/[cid]/imagem-no-navegador.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/[id]/carrossel/[cid]/imagem-no-navegador.ts b/app/bonus/[id]/carrossel/[cid]/imagem-no-navegador.ts
index 6e31aba..bcdf2ef 100644
--- a/app/bonus/[id]/carrossel/[cid]/imagem-no-navegador.ts
+++ b/app/bonus/[id]/carrossel/[cid]/imagem-no-navegador.ts
@@ -1,9 +1,12 @@
 import { CABECALHO_DA_FOTO, CABECALHO_DA_VERSAO, urlDaArte } from "@/lib/bonus/arte-tela";
 import {
+  problemaDaFotoDaCapa,
   problemaDaFotoDoEspaco,
   problemaDaProporcaoDoSlide,
+  recorteDaCapa,
   recorteDaFoto,
   type JeitoDaImagem,
+  type RecorteDaFoto,
 } from "@/lib/bonus/publicar-regras";
 import {
   TEXTO_FORMATO_DA_IMAGEM,
@@ -12,6 +15,7 @@ import {
   textoDaArteQueNaoVeio,
   textoDaFotoQueFaltou,
   textoDaProporcao,
+  textoDoProblemaDaCapa,
   textoDoProblemaDaFoto,
   type AvisoDaImagem,
   type AvisoDaPublicacao,
@@ -80,7 +84,36 @@ const QUALIDADE_DA_FOTO = 0.9;
  * O que sobe já tem a forma do espaço, e a rota não corta nada. A pequena é recusada antes de assinar,
  * e a que passa de 2 MB também (achado 79), com a regra que a assinatura vai conferir.
  */
-export async function prepararFoto(arquivo: Blob): Promise<{ ok: true; pronta: ImagemPronta } | { ok: false; texto: string }> {
+export function prepararFoto(arquivo: Blob): Promise<{ ok: true; pronta: ImagemPronta } | { ok: false; texto: string }> {
+  return recortarParaJpeg(arquivo, {
+    recortar: recorteDaFoto,
+    problema: problemaDaFotoDoEspaco,
+    frase: textoDoProblemaDaFoto,
+  });
+}
+
+/**
+ * A FOTO DA CAPA (spec da Etapa 11): cortada ao centro em 4:5 e reduzida até 2160×2700, em JPEG, pelo
+ * mesmo caminho da foto do espaço, com a regra e as frases da capa. A pequena (menos de 1080×1350
+ * depois do corte) é recusada antes de assinar, e a que passa de 2 MB também.
+ */
+export function prepararCapa(arquivo: Blob): Promise<{ ok: true; pronta: ImagemPronta } | { ok: false; texto: string }> {
+  return recortarParaJpeg(arquivo, {
+    recortar: recorteDaCapa,
+    problema: problemaDaFotoDaCapa,
+    frase: textoDoProblemaDaCapa,
+  });
+}
+
+/** O recorte no canvas, comum à foto do espaço e à da capa: cada uma com a sua regra e as suas frases. */
+async function recortarParaJpeg(
+  arquivo: Blob,
+  regra: {
+    recortar: (l: number, a: number) => { ok: true; recorte: RecorteDaFoto } | { ok: false; problema: "sem_medida" | "pequena" };
+    problema: typeof problemaDaFotoDoEspaco;
+    frase: typeof textoDoProblemaDaFoto;
+  }
+): Promise<{ ok: true; pronta: ImagemPronta } | { ok: false; texto: string }> {
   let bitmap: ImageBitmap;
   try {
     bitmap = await createImageBitmap(arquivo);
@@ -88,8 +121,8 @@ export async function prepararFoto(arquivo: Blob): Promise<{ ok: true; pronta: I
     return { ok: false, texto: TEXTO_FOTO_ILEGIVEL };
   }
   try {
-    const r = recorteDaFoto(bitmap.width, bitmap.height);
-    if (!r.ok) return { ok: false, texto: textoDoProblemaDaFoto(r.problema) };
+    const r = regra.recortar(bitmap.width, bitmap.height);
+    if (!r.ok) return { ok: false, texto: regra.frase(r.problema) };
     const { x, y, largura, altura, saida } = r.recorte;
     const tela = document.createElement("canvas");
     tela.width = saida.largura;
@@ -101,8 +134,8 @@ export async function prepararFoto(arquivo: Blob): Promise<{ ok: true; pronta: I
     pincel.drawImage(bitmap, x, y, largura, altura, 0, 0, saida.largura, saida.altura);
     const jpeg = await new Promise<Blob | null>((resolver) => tela.toBlob(resolver, "image/jpeg", QUALIDADE_DA_FOTO));
     if (!jpeg || jpeg.type !== "image/jpeg") return { ok: false, texto: TEXTO_FOTO_ILEGIVEL };
-    const problema = problemaDaFotoDoEspaco(saida.largura, saida.altura, jpeg.size);
-    if (problema) return { ok: false, texto: textoDoProblemaDaFoto(problema) };
+    const problema = regra.problema(saida.largura, saida.altura, jpeg.size);
+    if (problema) return { ok: false, texto: regra.frase(problema) };
     return { ok: true, pronta: { jpeg, largura: saida.largura, altura: saida.altura } };
   } finally {
     bitmap.close();
@@ -136,10 +169,10 @@ async function prepararSlidePronto(arquivo: Blob): Promise<{ ok: true; pronta: I
 }
 
 /**
- * A IMAGEM DE UM SLIDE, de um dos dois jeitos: a foto do espaço (recortada) ou o slide pronto do Canva
- * (no 4:5). Confere antes de pedir a assinatura, assina no destino do jeito, sobe direto ao bucket, e
- * guarda. O jeito vai só na assinatura: no guardar, o servidor o lê do caminho que ele assinou. Cada
- * saída é um aviso, e nenhuma é muda.
+ * A IMAGEM DE UM SLIDE, de um dos três jeitos: a foto do espaço (recortada), o slide pronto do Canva
+ * (no 4:5) ou a foto da capa (recortada em 4:5, Etapa 11). Confere antes de pedir a assinatura, assina
+ * no destino do jeito, sobe direto ao bucket, e guarda. O jeito vai só na assinatura: no guardar, o
+ * servidor o lê do caminho que ele assinou. Cada saída é um aviso, e nenhuma é muda.
  */
 export async function enviarImagemDoSlide(p: {
   carrosselId: string;
@@ -149,7 +182,12 @@ export async function enviarImagemDoSlide(p: {
   assinar: Assinar;
   guardar: Guardar;
 }): Promise<AvisoDaImagem> {
-  const preparada = p.jeito === "foto" ? await prepararFoto(p.arquivo) : await prepararSlidePronto(p.arquivo);
+  const preparada =
+    p.jeito === "foto"
+      ? await prepararFoto(p.arquivo)
+      : p.jeito === "capa"
+        ? await prepararCapa(p.arquivo)
+        : await prepararSlidePronto(p.arquivo);
   if (!preparada.ok) return erro(preparada.texto);
   const { pronta } = preparada;
   const assinatura = await p.assinar({
@@ -157,7 +195,7 @@ export async function enviarImagemDoSlide(p: {
     numero: p.numero,
     destino: p.jeito,
     arquivo: {
-      nome: `${p.jeito === "foto" ? "foto" : "slide"}-${p.numero}.jpg`,
+      nome: `${p.jeito}-${p.numero}.jpg`,
       mime: "image/jpeg",
       bytes: pronta.jpeg.size,
       largura: pronta.largura,
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx eslint lib/bonus/publicar-processo.ts lib/bonus/publicar-repositorio.ts lib/bonus/publicar-textos.ts app/bonus/publicar-actions.ts "app/bonus/[id]/carrossel/[cid]/imagem-no-navegador.ts" testes-dom/bonus-publicar-imagem.dom.tsx testes-integracao/bonus-publicar-processo.integracao.ts
npx vitest run --config vitest.dom.config.ts testes-dom/bonus-publicar-imagem.dom.tsx
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-publicar-processo.integracao.ts
```

Esperado: `tsc` e lint limpos; os 29 de tela passam; na integração, os 54.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/publicar-processo.ts lib/bonus/publicar-repositorio.ts lib/bonus/publicar-textos.ts app/bonus/publicar-actions.ts "app/bonus/[id]/carrossel/[cid]/imagem-no-navegador.ts" testes-dom/bonus-publicar-imagem.dom.tsx testes-integracao/bonus-publicar-processo.integracao.ts
test "$(git branch --show-current)" = "capa-do-carrossel"
git add lib/bonus/publicar-processo.ts lib/bonus/publicar-repositorio.ts lib/bonus/publicar-textos.ts app/bonus/publicar-actions.ts "app/bonus/[id]/carrossel/[cid]/imagem-no-navegador.ts" testes-dom/bonus-publicar-imagem.dom.tsx testes-integracao/bonus-publicar-processo.integracao.ts
```

```bash
git commit -F - <<'MSG'
A foto da capa sobe em 4:5 para bonus-capa, e só entra no slide 1 em capa

O navegador recorta a foto da capa ao centro em 4:5 e a converte para JPEG. O
servidor só assina o destino capa no slide 1 em capa, e recusa ali a foto do
espaço e o slide pronto. A assinatura da capa não passa pela decisão da cópia
da fila, cuja faixa recusaria a imagem em pé da IA: a régua da capa decide
sozinha, e a imagem dela nunca vai à fila. A reserva confere de novo o jeito
do caminho contra o do slide.
MSG
```

---

### FASE 5-bis — A régua da capa recusa o zero byte (achado 149)

**Arquivos:**
- Modificar: `lib/bonus/publicar-regras.ts` (`problemaDaFotoDaCapa`)
- Testar: `tests/bonus-capa-regras.test.ts`

- [ ] **Passo 1: o teste**

Em `tests/bonus-capa-regras.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-capa-regras.test.ts b/tests/bonus-capa-regras.test.ts
index 7ec20ba..3054081 100644
--- a/tests/bonus-capa-regras.test.ts
+++ b/tests/bonus-capa-regras.test.ts
@@ -196,6 +196,13 @@ describe("a foto declarada para a capa", () => {
     expect(problemaDaFotoDaCapa(1080, 0, 1)).toBe("sem_medida");
     expect(problemaDaFotoDaCapa(1080, 1350, undefined)).toBe("sem_medida");
   });
+
+  // O achado 149: a assinatura da capa não passa pela `decisaoDeAssinatura`, que recusa o zero em todo
+  // outro destino (lib/publicacao.ts:504-506). A régua da capa o recusa por conta própria.
+  it("a capa declarada com 0 byte é recusada, como em todo outro destino", () => {
+    expect(problemaDaFotoDaCapa(1080, 1350, 0)).toBe("sem_medida");
+    expect(problemaDaFotoDaCapa(1024, 1536, 0)).toBe("sem_medida");
+  });
 });
 
 describe("o recorte da foto da capa", () => {
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-capa-regras.test.ts
```

Esperado: 1 cai e 37 passam (38): a capa declarada com 0 byte ainda passa.

- [ ] **Passo 3: o código**

Em `lib/bonus/publicar-regras.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/publicar-regras.ts b/lib/bonus/publicar-regras.ts
index 95b2e6b..ef947cc 100644
--- a/lib/bonus/publicar-regras.ts
+++ b/lib/bonus/publicar-regras.ts
@@ -155,6 +155,9 @@ export function recorteDaFoto(
  * A GERADA POR IA SAI EM 1024×1536, o tamanho em pé da OpenAI (imagem-openai.ts), e só ela passa fora do
  * 4:5: o desenho a corta em cima e embaixo (`objectFit: cover`), e ela sai ampliada uns 5% (1024 para
  * 1080 de largura). Aceitar a medida exata, e não uma faixa, mantém a regra do 4:5 para tudo o mais.
+ *
+ * O ZERO É SEM MEDIDA (achado 149): a assinatura da capa não passa pela `decisaoDeAssinatura`, que recusa
+ * o arquivo declarado com 0 byte em todo outro destino. A régua da capa recusa o zero por conta própria.
  */
 export const CAPA_MAX_LARGURA = LARGURA * 2;
 export const CAPA_MAX_ALTURA = ALTURA * 2;
@@ -167,7 +170,7 @@ export function problemaDaFotoDaCapa(
   altura: number | undefined,
   bytes: number | undefined
 ): ProblemaDaFoto | null {
-  if (!largura || !altura || !(largura > 0) || !(altura > 0) || !(typeof bytes === "number" && bytes >= 0)) return "sem_medida";
+  if (!largura || !altura || !(largura > 0) || !(altura > 0) || !(typeof bytes === "number" && bytes > 0)) return "sem_medida";
   const gerada = largura === LARGURA_DA_CAPA_GERADA && altura === ALTURA_DA_CAPA_GERADA;
   if (!gerada) {
     if (problemaDaProporcaoDoSlide(largura, altura)) return "proporcao";
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx eslint lib/bonus/publicar-regras.ts tests/bonus-capa-regras.test.ts
npx vitest run tests/bonus-capa-regras.test.ts
```

Esperado: `tsc` e lint limpos; os 38 passam.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/publicar-regras.ts tests/bonus-capa-regras.test.ts
test "$(git branch --show-current)" = "capa-do-carrossel"
git add lib/bonus/publicar-regras.ts tests/bonus-capa-regras.test.ts
```

```bash
git commit -F - <<'MSG'
A régua da capa recusa o arquivo declarado com zero byte, como os outros destinos

Sem a decisão da cópia da fila, que recusa o zero em todo outro destino, a
assinatura da capa aceitava um arquivo declarado com 0 byte (achado 149). A
régua da capa passa a exigir de 1 byte a 2 MB.
MSG
```

---

### FASE 6 — A capa gerada por IA, em pé

**Arquivos:**
- Modificar: `lib/bonus/prompt-ilustracao.ts`, `lib/bonus/imagem-openai.ts`, `lib/bonus/imagem-regras.ts`,
  `lib/bonus/imagem-textos.ts`, `lib/bonus/imagem-processo.ts`, `app/bonus/imagem-actions.ts`
- Criar: `tests/bonus-capa-imagem.test.ts`
- Testar: `tests/bonus-capa-paginas.test.ts`, `testes-integracao/bonus-imagem-processo.integracao.ts`

**Interfaces:**
- Consome: `ehCapa` (FASE 1), `problemaDaFotoDaCapa` e o destino `capa` (FASES 1 e 5).
- Produz: `ESPACO_DO_GANCHO` e `montarPromptDaCapa(descricao)`; `CORPO_DA_CAPA` (o `CORPO_FIXO` com
  `size: "1024x1536"`), `gerarNaOpenAI(descricao, ambiente?, buscar?)` e `gerarCapaNaOpenAI(descricao,
  ambiente?, buscar?)`; `FormatoDaImagem = "espaco" | "capa"` e `problemaDaCapaGerada(bytes)`;
  `textoDoProblemaDaCapaGerada`; `pedirImagem` devolve `formato`, e `gerarImagem` o exige.

- [ ] **Passo 1: os testes**

Crie `tests/bonus-capa-imagem.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { CORPO_DA_CAPA, CORPO_FIXO, ENDERECO_DA_OPENAI, gerarCapaNaOpenAI, gerarNaOpenAI } from "@/lib/bonus/imagem-openai";
import { problemaDaCapaGerada } from "@/lib/bonus/imagem-regras";
import { ESPACO_DO_GANCHO, FUNDO, PROIBICAO_DE_TEXTO, montarPrompt, montarPromptDaCapa, textoExato } from "@/lib/bonus/prompt-ilustracao";
import { FOTO_DO_ESPACO_MAX_BYTES } from "@/lib/bonus/publicar-regras";

// A IMAGEM DA CAPA POR IA (spec da Etapa 11, "Gerada por IA"): o mesmo criador da Etapa 6 (o modelo fixo, a
// qualidade, as regras de estilo), só que em pé, 1024×1536, e com uma frase a mais no pedido: o terço de
// baixo livre, porque o gancho vai por cima. Os pedidos e o corpo da Etapa 6 continuam iguais, byte a byte
// (tests/bonus-prompt-ilustracao.test.ts e tests/bonus-imagem-openai.test.ts, sem mudança).

const CENA = "/cinema uma pessoa olhando o celular numa loja de roupas";
const AMBIENTE = { OPENAI_API_KEY: "sk-inventada-para-o-teste" };

/** Um segmento JPEG: FF, a marca, o tamanho em dois bytes (que conta a si mesmo) e o conteúdo. */
const segmento = (marca: number, conteudo: number[]) => [0xff, marca, (conteudo.length + 2) >> 8, (conteudo.length + 2) & 0xff, ...conteudo];
/** O começo de um JPEG com as medidas no SOF, e o fim. */
function jpeg(largura: number, altura: number, extra = 0): Uint8Array {
  const sof = segmento(0xc0, [8, altura >> 8, altura & 0xff, largura >> 8, largura & 0xff, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
  return new Uint8Array([0xff, 0xd8, ...segmento(0xe0, [0x4a, 0x46, 0x49, 0x46, 0]), ...sof, ...segmento(0xda, [0]), ...Array(extra).fill(0x55), 0xff, 0xd9]);
}

describe("o pedido da capa", () => {
  it("é o pedido de hoje, com a frase da capa logo depois do fundo", () => {
    expect(montarPromptDaCapa(CENA)).toBe(montarPrompt(CENA).replace(FUNDO, `${FUNDO} ${ESPACO_DO_GANCHO}`));
  });

  it("a regra do texto continua a última coisa do pedido, com e sem aspas", () => {
    expect(montarPromptDaCapa(CENA).endsWith(PROIBICAO_DE_TEXTO)).toBe(true);
    expect(montarPromptDaCapa('/cinema uma vitrine com a placa "ABERTO"').endsWith(textoExato(["ABERTO"]))).toBe(true);
  });

  it("a frase da capa não fala em título nem em texto, para o modelo não escrever no terço de baixo", () => {
    expect(ESPACO_DO_GANCHO).not.toMatch(/t[íi]tulo|texto|escrev|letra|palavra/i);
    expect(ESPACO_DO_GANCHO).toContain("terço de baixo");
  });

  it("o pedido de hoje não leva a frase da capa", () => {
    expect(montarPrompt(CENA)).not.toContain(ESPACO_DO_GANCHO);
  });
});

describe("a chamada da capa à OpenAI", () => {
  const respostaOk = () =>
    new Response(JSON.stringify({ data: [{ b64_json: Buffer.from(jpeg(1024, 1536)).toString("base64") }] }), { status: 200 });

  it("o corpo da capa é o de hoje, em pé: 1024×1536", () => {
    expect(CORPO_DA_CAPA).toEqual({ ...CORPO_FIXO, size: "1024x1536" });
    expect(CORPO_FIXO.size).toBe("1536x1024");
  });

  it("manda o corpo em pé e o pedido da capa, no mesmo endereço e com a chave só no cabeçalho", async () => {
    const buscar = vi.fn(async () => respostaOk());
    const r = await gerarCapaNaOpenAI(CENA, AMBIENTE, buscar as unknown as typeof fetch);
    expect(r).toMatchObject({ ok: true });
    const [url, init] = buscar.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(ENDERECO_DA_OPENAI);
    expect(JSON.parse(String(init.body))).toEqual({ ...CORPO_DA_CAPA, prompt: montarPromptDaCapa(CENA) });
    expect(new Headers(init.headers).get("authorization")).toBe(`Bearer ${AMBIENTE.OPENAI_API_KEY}`);
    expect(String(init.body)).not.toContain(AMBIENTE.OPENAI_API_KEY);
  });

  it("a chamada de hoje continua deitada, com o pedido de hoje", async () => {
    const buscar = vi.fn(async () => respostaOk());
    await gerarNaOpenAI(CENA, AMBIENTE, buscar as unknown as typeof fetch);
    const [, init] = buscar.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ ...CORPO_FIXO, prompt: montarPrompt(CENA) });
  });
});

describe("a imagem da capa que voltou", () => {
  it("o JPEG em pé de 1024×1536 passa", () => {
    expect(problemaDaCapaGerada(jpeg(1024, 1536))).toBeNull();
  });

  it("a deitada, que serve ao espaço, não serve à capa", () => {
    expect(problemaDaCapaGerada(jpeg(1536, 1024))).toBe("proporcao");
  });

  it("o que não é JPEG não tem medida, e acima de 2 MB é pesada", () => {
    expect(problemaDaCapaGerada(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("formato");
    expect(problemaDaCapaGerada(jpeg(1024, 1536, FOTO_DO_ESPACO_MAX_BYTES))).toBe("pesada");
  });
});
```

Em `tests/bonus-capa-paginas.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-capa-paginas.test.ts b/tests/bonus-capa-paginas.test.ts
index 68fca4c..5dc69d6 100644
--- a/tests/bonus-capa-paginas.test.ts
+++ b/tests/bonus-capa-paginas.test.ts
@@ -45,3 +45,24 @@ describe("as frases das recusas da capa", () => {
     expect(textoDaRecusaDaArte("capa_e_so_texto")).toBe('O slide 1 não pode ser capa e "Só texto" ao mesmo tempo. Desmarque um dos dois.');
   });
 });
+
+// AS DUAS ROTAS DA CONSULTA DA IMAGEM (a do bônus e a do avulso) aceitam a capa porque não decidem jeito:
+// elas conferem a sessão e o slide, e chamam a consulta comum (lib/bonus/imagem-consulta.ts), que a
+// integração confere com a capa (testes-integracao/bonus-imagem-processo, "a imagem da capa"). E a action
+// do pedido manda à geração o formato que o pedido decidiu, e nunca o deduz de novo.
+describe("as rotas da consulta e a action do pedido, com a capa", () => {
+  const ROTAS = ["app/bonus/[id]/carrossel/[cid]/imagem/route.ts", "app/carrosseis/[cid]/imagem/route.ts"];
+
+  it.each(ROTAS)("%s confere o slide e chama a consulta comum, sem decidir o jeito", (rota) => {
+    const fonte = ler(rota);
+    expect(fonte).toContain("conferirPedidoDaArte(");
+    expect(fonte).toContain("consultarImagem(");
+    expect(fonte).not.toMatch(/\b(comEspaco|ehCapa|escolhasDaArte|soTexto|capaDaArte)\b/);
+  });
+
+  it("a action do pedido passa à geração o formato que o pedido decidiu", () => {
+    const fonte = ler("app/bonus/imagem-actions.ts");
+    expect(fonte).toContain("const { reservaId, formato } = r;");
+    expect(fonte).toContain("gerarImagem({ reservaId, id, numero, descricao, contas, formato })");
+  });
+});
```

Em `testes-integracao/bonus-imagem-processo.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/bonus-imagem-processo.integracao.ts b/testes-integracao/bonus-imagem-processo.integracao.ts
index bb21306..ab628bc 100644
--- a/testes-integracao/bonus-imagem-processo.integracao.ts
+++ b/testes-integracao/bonus-imagem-processo.integracao.ts
@@ -264,7 +264,7 @@ describe("gerar a imagem", () => {
     const id = await carrossel();
     const anterior = await slidePronto(id, 2);
     const reservaId = await reservado(id);
-    const r = await imagem.gerarImagem({ reservaId, id, numero: 2, descricao: CENA, contas, gerar: openaiQueGera });
+    const r = await imagem.gerarImagem({ formato: "espaco", reservaId, id, numero: 2, descricao: CENA, contas, gerar: openaiQueGera });
     if (!r.ok) throw new Error(`a geração devia passar: ${r.motivo}`);
     expect(r.caminho).toMatch(new RegExp(`^${CONTA}/bonus-foto/[0-9a-f-]{36}\\.jpg$`));
     expect(bucket.objetos.get(r.caminho)).toEqual(GERADA);
@@ -276,7 +276,7 @@ describe("gerar a imagem", () => {
   it("o publicar desse slide sai pela arte, como foto: a imagem gerada não vai para a fila", async () => {
     const id = await carrossel();
     for (const n of [3, 4]) await slidePronto(id, n);
-    const r = await imagem.gerarImagem({ reservaId: await reservado(id), id, numero: 2, descricao: CENA, contas, gerar: openaiQueGera });
+    const r = await imagem.gerarImagem({ formato: "espaco", reservaId: await reservado(id), id, numero: 2, descricao: CENA, contas, gerar: openaiQueGera });
     if (!r.ok) throw new Error(`a geração devia passar: ${r.motivo}`);
     const desenho = (n: number, foto: string | null) => regras.versaoDoDesenho(slides.slidesDoTexto(TEXTO)[n - 1], foto);
     const subir = async (n: number) => {
@@ -304,7 +304,7 @@ describe("gerar a imagem", () => {
   it("a recusa da OpenAI fica falhou, com a frase, e nada sobe", async () => {
     const id = await carrossel();
     const erro = "A OpenAI recusou o pedido. (OpenAI: Your request was rejected by the safety system.)";
-    const r = await imagem.gerarImagem({ reservaId: await reservado(id), id, numero: 2, descricao: CENA, contas, gerar: async () => ({ ok: false, erro }) });
+    const r = await imagem.gerarImagem({ formato: "espaco", reservaId: await reservado(id), id, numero: 2, descricao: CENA, contas, gerar: async () => ({ ok: false, erro }) });
     expect(r).toEqual({ ok: false, motivo: erro });
     expect(await linhas()).toEqual([{ numero: 2, estado: "falhou", motivo: erro, caminho: null }]);
     expect(bucket.chamadas).toEqual([]);
@@ -314,6 +314,7 @@ describe("gerar a imagem", () => {
     const id = await carrossel();
     const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
     const r = await imagem.gerarImagem({
+      formato: "espaco",
       reservaId: await reservado(id),
       id,
       numero: 2,
@@ -338,7 +339,7 @@ describe("gerar a imagem", () => {
         ]);
       return { ok: true as const, bytes: GERADA };
     };
-    const r = await imagem.gerarImagem({ reservaId, id, numero: 2, descricao: CENA, contas, gerar: agendaNoMeio });
+    const r = await imagem.gerarImagem({ formato: "espaco", reservaId, id, numero: 2, descricao: CENA, contas, gerar: agendaNoMeio });
     expect(r.ok).toBe(false);
     expect(fotosNoBucket()).toEqual([]);
     expect(regras.fotosDaArte(await arteDe(id), 5)).toEqual({});
@@ -349,6 +350,7 @@ describe("gerar a imagem", () => {
   it("a falha ao guardar apaga do bucket o que subiu", async () => {
     const id = await carrossel();
     const r = await imagem.gerarImagem({
+      formato: "espaco",
       reservaId: await reservado(id),
       id,
       numero: 2,
@@ -368,6 +370,7 @@ describe("gerar a imagem", () => {
   it("a falha ao marcar a linha, depois de guardar, deixa a foto no bucket e no slide", async () => {
     const id = await carrossel();
     const r = await imagem.gerarImagem({
+      formato: "espaco",
       reservaId: await reservado(id),
       id,
       numero: 2,
@@ -388,6 +391,7 @@ describe("gerar a imagem", () => {
   it("a OpenAI que lança fica falhou, com a frase sem motivo", async () => {
     const id = await carrossel();
     const r = await imagem.gerarImagem({
+      formato: "espaco",
       reservaId: await reservado(id),
       id,
       numero: 2,
@@ -425,7 +429,7 @@ describe("a consulta de um slide", () => {
 
   it("pronta, com a versão nova da miniatura, a mesma que a página desenharia", async () => {
     const id = await carrossel();
-    const r = await imagem.gerarImagem({ reservaId: await reservado(id), id, numero: 2, descricao: CENA, contas, gerar: openaiQueGera });
+    const r = await imagem.gerarImagem({ formato: "espaco", reservaId: await reservado(id), id, numero: 2, descricao: CENA, contas, gerar: openaiQueGera });
     if (!r.ok) throw new Error(`a geração devia passar: ${r.motivo}`);
     const conta = contas.find((c) => c.ig_user_id === CONTA) ?? null;
     const comFoto = tela.versoesDosSlides(slides.slidesDoTexto(TEXTO), [1, 5], tela.cabecalhoParaVersao(conta), { 2: r.caminho }, regras.SEM_CAPA)[1];
@@ -437,7 +441,7 @@ describe("a consulta de um slide", () => {
   it("falhou, com o motivo da linha", async () => {
     const id = await carrossel();
     const erro = "A OpenAI recusou o pedido.";
-    await imagem.gerarImagem({ reservaId: await reservado(id), id, numero: 2, descricao: CENA, contas, gerar: async () => ({ ok: false, erro }) });
+    await imagem.gerarImagem({ formato: "espaco", reservaId: await reservado(id), id, numero: 2, descricao: CENA, contas, gerar: async () => ({ ok: false, erro }) });
     expect(await consultar(id)).toEqual({ estado: "falhou", hoje: 1, texto: erro });
   });
 
@@ -448,3 +452,57 @@ describe("a consulta de um slide", () => {
     expect(await consultar(id)).toEqual({ estado: "falhou", hoje: 1, texto: textos.TEXTO_IMAGEM_TRAVADA });
   });
 });
+
+// A IMAGEM DA CAPA POR IA (spec da Etapa 11): o pedido no slide 1 em capa sai no formato da capa e conta no
+// mesmo teto de 10; a geração sobe em `bonus-capa`, pela regra da capa, e o slide 1 a guarda como capa. A
+// consulta, a mesma das duas rotas (a do bônus e a do avulso), devolve a miniatura com a capa. Se a capa for
+// desligada antes de a imagem voltar, o guardar recusa com a linha travada, e a imagem sai do bucket.
+describe("a imagem da capa", () => {
+  /** O slide 1 em capa; o 5 só texto. */
+  const ARTE_CAPA = { ...ARTE, soTexto: [5], capa: true };
+  const CAPA_GERADA = jpeg(1024, 1536);
+  const openaiQueGeraACapa = async () => ({ ok: true as const, bytes: CAPA_GERADA });
+  const capasNoBucket = () => [...bucket.objetos.keys()].filter((k) => k.startsWith(`${CONTA}/bonus-capa/`));
+
+  it("o pedido no slide 1 em capa sai no formato da capa, e o do slide 2 no do espaço, no mesmo teto", async () => {
+    const id = await carrossel(ARTE_CAPA);
+    expect(await pedir(id, 1)).toMatchObject({ ok: true, hoje: 1, formato: "capa" });
+    expect(await pedir(id, 2)).toMatchObject({ ok: true, hoje: 2, formato: "espaco" });
+  });
+
+  it("gera em bonus-capa, o slide 1 guarda como capa, e a consulta devolve a miniatura com a capa", async () => {
+    const id = await carrossel(ARTE_CAPA);
+    const reservaId = await reservado(id, 1);
+    const r = await imagem.gerarImagem({ formato: "capa", reservaId, id, numero: 1, descricao: CENA, contas, gerar: openaiQueGeraACapa });
+    if (!r.ok) throw new Error(`a geração devia passar: ${r.motivo}`);
+    expect(r.caminho).toMatch(new RegExp(`^${CONTA}/bonus-capa/[0-9a-f-]{36}\.jpg$`));
+    expect(capasNoBucket()).toEqual([r.caminho]);
+    expect(regras.capaDaArte(await arteDe(id), 5)).toEqual({ ligada: true, caminho: r.caminho });
+    expect(await linhas()).toEqual([{ numero: 1, estado: "pronta", motivo: null, caminho: r.caminho }]);
+
+    const linha = await carrosselRepo.lerCarrossel(id);
+    if (!linha) throw new Error("o carrossel sumiu");
+    const cabecalho = tela.cabecalhoParaVersao(contas.find((c) => c.ig_user_id === CONTA) ?? null);
+    const miniatura = tela.versoesDosSlides(slides.slidesDoTexto(TEXTO), [5], cabecalho, {}, { ligada: true, caminho: r.caminho })[0];
+    expect(await consulta.consultarImagem({ linha, numero: 1 })).toMatchObject({ estado: "pronta", versaoDaMiniatura: miniatura });
+  });
+
+  it("a imagem deitada que volta para a capa falha com a frase da capa, e nada sobe", async () => {
+    const id = await carrossel(ARTE_CAPA);
+    const r = await imagem.gerarImagem({ formato: "capa", reservaId: await reservado(id, 1), id, numero: 1, descricao: CENA, contas, gerar: openaiQueGera });
+    expect(r).toEqual({ ok: false, motivo: textos.textoDoProblemaDaCapaGerada("proporcao") });
+    expect(bucket.chamadas).toEqual([]);
+    expect(await linhas()).toMatchObject([{ numero: 1, estado: "falhou" }]);
+  });
+
+  it("a capa desligada antes de a imagem voltar: o guardar recusa, e a imagem sai do bucket", async () => {
+    const id = await carrossel(ARTE_CAPA);
+    const reservaId = await reservado(id, 1);
+    await carrosselRepo.salvarSoTextoDaArte(id, [5], null, false);
+    const r = await imagem.gerarImagem({ formato: "capa", reservaId, id, numero: 1, descricao: CENA, contas, gerar: openaiQueGeraACapa });
+    expect(r.ok).toBe(false);
+    expect(capasNoBucket()).toEqual([]);
+    expect(regras.imagensDaArte(await arteDe(id), 5)).toEqual({});
+    expect(await linhas()).toMatchObject([{ numero: 1, estado: "falhou" }]);
+  });
+});
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-capa-imagem.test.ts tests/bonus-capa-paginas.test.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-imagem-processo.integracao.ts
```

Esperado: 9 caem e 9 passam (18): o pedido e o corpo da capa ainda não existem, e a action ainda não passa o
formato. Na integração, `[rede-global] ALVO: banco de TESTE`, 4 caem e 23 passam (27): o pedido no slide 1 em
capa ainda é recusado como sem espaço.

- [ ] **Passo 3: o código**

Em `lib/bonus/prompt-ilustracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/prompt-ilustracao.ts b/lib/bonus/prompt-ilustracao.ts
index ed24089..d9acf39 100644
--- a/lib/bonus/prompt-ilustracao.ts
+++ b/lib/bonus/prompt-ilustracao.ts
@@ -479,6 +479,28 @@ export function textoExato(trechos: string[]): string {
  * medido é o que vai ao ar.
  */
 export function montarPrompt(descricao: string): string {
+  return montar(descricao, null);
+}
+
+/**
+ * A FRASE DA CAPA (spec da Etapa 11, "Gerada por IA"): a imagem em pé, com o terço de baixo livre, porque
+ * o gancho vai por cima dele. Ela não fala em título nem em texto, para o modelo não escrever nada ali: a
+ * regra do texto continua a de sempre, e vem por último.
+ */
+export const ESPACO_DO_GANCHO =
+  "A imagem é vertical. Deixe o terço de baixo do quadro com fundo simples, sem rosto e sem nenhum objeto " +
+  "importante: essa parte vai ficar coberta.";
+
+/**
+ * O PEDIDO DA CAPA: o mesmo pedido, com a frase da capa depois do fundo e antes das proibições. Só o
+ * pedido da capa a leva: `montarPrompt` continua saindo igual, byte a byte, aos pedidos medidos da Etapa
+ * 6 (nota da revisão da spec da Etapa 11).
+ */
+export function montarPromptDaCapa(descricao: string): string {
+  return montar(descricao, ESPACO_DO_GANCHO);
+}
+
+function montar(descricao: string, depoisDoFundo: string | null): string {
   const lida = lerDescricao(descricao);
   const cena = lida.cena.replace(/\s+/g, " ").trim();
   const comPonto = /[.!?]$/.test(cena) ? cena : `${cena}.`;
@@ -488,6 +510,7 @@ export function montarPrompt(descricao: string): string {
     ...(lida.atalho ? [lida.atalho.texto] : []),
     comPonto,
     FUNDO,
+    ...(depoisDoFundo ? [depoisDoFundo] : []),
     PROIBICAO_DE_PESSOA_REAL,
     trechos.length > 0 ? textoExato(trechos) : PROIBICAO_DE_TEXTO,
   ].join(" ");
```

Em `lib/bonus/imagem-openai.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/imagem-openai.ts b/lib/bonus/imagem-openai.ts
index b8455c2..2e92fb0 100644
--- a/lib/bonus/imagem-openai.ts
+++ b/lib/bonus/imagem-openai.ts
@@ -8,7 +8,7 @@ import {
   TEXTO_SEM_REDE_DA_OPENAI,
   tirarChave,
 } from "./imagem-textos";
-import { montarPrompt } from "./prompt-ilustracao";
+import { montarPrompt, montarPromptDaCapa } from "./prompt-ilustracao";
 
 // A CHAMADA À API DE IMAGEM DA OPENAI (spec da Etapa 6, "A chamada à OpenAI"). Molde:
 // site-ia/src/lib/ia/ilustracao.ts, na main 672ee71, onde o caminho inteiro foi provado contra a API de
@@ -41,6 +41,13 @@ export const CORPO_FIXO = {
   output_compression: COMPRESSAO_DA_IMAGEM,
 } as const;
 
+/**
+ * O CORPO DA CAPA (spec da Etapa 11, "Gerada por IA"): o mesmo modelo, a mesma qualidade e o mesmo JPEG, só
+ * que em pé, 1024×1536, outro dos tamanhos recomendados. O corpo de todo o resto continua o `CORPO_FIXO`,
+ * deitado. O custo da imagem em pé é medido na prova (a expectativa é a mesma, US$ 0,0432 em high).
+ */
+export const CORPO_DA_CAPA = { ...CORPO_FIXO, size: "1024x1536" } as const;
+
 export type RespostaDaOpenAI = { ok: true; bytes: Uint8Array } | { ok: false; erro: string };
 
 /** A assinatura que o processo recebe por parâmetro: a de verdade em produção, uma falsa no teste. */
@@ -50,10 +57,27 @@ export type GerarNaOpenAI = (descricao: string) => Promise<RespostaDaOpenAI>;
  * Gera a imagem da descrição que o operador digitou. O embrulho nas regras (estilo, fundo, proibições) é
  * o `montarPrompt` do Chat. `ambiente` e `buscar` entram por parâmetro só para o teste.
  */
-export async function gerarNaOpenAI(
+export function gerarNaOpenAI(
+  descricao: string,
+  ambiente: Readonly<Record<string, string | undefined>> = process.env,
+  buscar: typeof fetch = fetch
+): Promise<RespostaDaOpenAI> {
+  return chamarAOpenAI({ ...CORPO_FIXO, prompt: montarPrompt(descricao) }, ambiente, buscar);
+}
+
+/** A imagem da capa (Etapa 11): em pé, com o pedido da capa (`montarPromptDaCapa`). */
+export function gerarCapaNaOpenAI(
   descricao: string,
   ambiente: Readonly<Record<string, string | undefined>> = process.env,
   buscar: typeof fetch = fetch
+): Promise<RespostaDaOpenAI> {
+  return chamarAOpenAI({ ...CORPO_DA_CAPA, prompt: montarPromptDaCapa(descricao) }, ambiente, buscar);
+}
+
+async function chamarAOpenAI(
+  corpoDoPedido: Record<string, unknown>,
+  ambiente: Readonly<Record<string, string | undefined>>,
+  buscar: typeof fetch
 ): Promise<RespostaDaOpenAI> {
   const chave = ambiente.OPENAI_API_KEY?.trim();
   if (!chave) return { ok: false, erro: TEXTO_SEM_CHAVE_DA_IMAGEM };
@@ -63,7 +87,7 @@ export async function gerarNaOpenAI(
     resposta = await buscar(ENDERECO_DA_OPENAI, {
       method: "POST",
       headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
-      body: JSON.stringify({ ...CORPO_FIXO, prompt: montarPrompt(descricao) }),
+      body: JSON.stringify(corpoDoPedido),
       signal: AbortSignal.timeout(TIMEOUT_IMAGEM_MS),
     });
   } catch (e) {
```

Em `lib/bonus/imagem-regras.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/imagem-regras.ts b/lib/bonus/imagem-regras.ts
index 1f5252c..b11e352 100644
--- a/lib/bonus/imagem-regras.ts
+++ b/lib/bonus/imagem-regras.ts
@@ -1,7 +1,14 @@
 // AS REGRAS DO CRIADOR DE IMAGEM (spec da Etapa 6). PURO: o processo, o repositório, a consulta e a
 // tela leem daqui.
 import { medidasDoJpeg } from "./imagem-jpeg";
-import { problemaDaFotoDoEspaco, type ProblemaDaFoto } from "./publicar-regras";
+import { problemaDaFotoDaCapa, problemaDaFotoDoEspaco, type ProblemaDaFoto } from "./publicar-regras";
+
+/**
+ * O FORMATO DA IMAGEM PEDIDA (spec da Etapa 11): a do espaço, deitada, ou a da capa, em pé. Ele é decidido
+ * no pedido, pelo jeito do slide naquela hora, e segue com a reserva até o guardar, que confere de novo o
+ * jeito com a linha travada.
+ */
+export type FormatoDaImagem = "espaco" | "capa";
 
 /**
  * O TETO: 10 imagens nas últimas 24 horas, somando todos os carrosséis (decisão do Eduardo em 09/10, o
@@ -88,3 +95,13 @@ export function problemaDaImagemGerada(bytes: Uint8Array): ProblemaDaImagem | nu
   if (!medidas) return "formato";
   return problemaDaFotoDoEspaco(medidas.largura, medidas.altura, bytes.length);
 }
+
+/**
+ * A IMAGEM DA CAPA QUE VOLTOU (spec da Etapa 11), conferida pela regra da foto da capa: o JPEG em pé de
+ * 1024×1536 da OpenAI passa, até 2 MB; a deitada, não.
+ */
+export function problemaDaCapaGerada(bytes: Uint8Array): ProblemaDaImagem | null {
+  const medidas = medidasDoJpeg(bytes);
+  if (!medidas) return "formato";
+  return problemaDaFotoDaCapa(medidas.largura, medidas.altura, bytes.length);
+}
```

Em `lib/bonus/imagem-textos.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/imagem-textos.ts b/lib/bonus/imagem-textos.ts
index b500dbc..6da7197 100644
--- a/lib/bonus/imagem-textos.ts
+++ b/lib/bonus/imagem-textos.ts
@@ -57,6 +57,13 @@ export function textoDoProblemaDaImagem(p: ProblemaDaImagem): string {
     : "A OpenAI devolveu uma imagem que não serve para o espaço da arte. Tente de novo.";
 }
 
+/** A imagem da capa que voltou e não serve (Etapa 11), com a mesma regra da frase acima. */
+export function textoDoProblemaDaCapaGerada(p: ProblemaDaImagem): string {
+  return p === "pesada"
+    ? "A imagem veio com mais de 2 MB, e o Chat não a guarda. Tente de novo."
+    : "A OpenAI devolveu uma imagem que não serve para a capa. Tente de novo.";
+}
+
 export const TEXTO_SEM_CHAVE_DA_IMAGEM =
   "A geração de imagem não está configurada: falta a chave da OpenAI no servidor. Avise quem cuida do Chat.";
 export const TEXTO_OPENAI_DEMOROU = "A OpenAI demorou demais para responder. Tente de novo.";
```

Em `lib/bonus/imagem-processo.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/imagem-processo.ts b/lib/bonus/imagem-processo.ts
index 0e16a48..09733e6 100644
--- a/lib/bonus/imagem-processo.ts
+++ b/lib/bonus/imagem-processo.ts
@@ -1,11 +1,17 @@
 import "server-only";
 import type { ContaDoCabecalho } from "./arte-conta";
-import { comEspaco } from "./arte-escolhas";
+import { comEspaco, ehCapa } from "./arte-escolhas";
 import { medidasDoJpeg } from "./imagem-jpeg";
-import { gerarNaOpenAI, type GerarNaOpenAI } from "./imagem-openai";
-import { problemaDaImagemGerada } from "./imagem-regras";
+import { gerarCapaNaOpenAI, gerarNaOpenAI, type GerarNaOpenAI } from "./imagem-openai";
+import { problemaDaCapaGerada, problemaDaImagemGerada, type FormatoDaImagem } from "./imagem-regras";
 import { marcarFalhou, marcarPronta as marcarProntaNoBanco, reservarImagem } from "./imagem-repositorio";
-import { TEXTO_IMAGEM_FALHOU_SEM_MOTIVO, TEXTO_IMAGEM_NAO_SUBIU, textoDoProblemaDaImagem, type RecusaDaImagem } from "./imagem-textos";
+import {
+  TEXTO_IMAGEM_FALHOU_SEM_MOTIVO,
+  TEXTO_IMAGEM_NAO_SUBIU,
+  textoDoProblemaDaCapaGerada,
+  textoDoProblemaDaImagem,
+  type RecusaDaImagem,
+} from "./imagem-textos";
 import { validarDescricao } from "./prompt-ilustracao";
 import { apagarSemDerrubar } from "./publicar-bucket";
 import { assinarImagem, conferirCarrossel, guardarImagem } from "./publicar-processo";
@@ -25,8 +31,15 @@ import { textoDaRecusaDaPublicacaoDoCarrossel } from "./publicar-textos";
 // O QUE SAI DO BUCKET NUMA FALHA (achado 89): enquanto o `guardarImagem` não confirmou, a falha apaga o
 // arquivo que subiu. Depois dele, o arquivo é a foto do slide, e a anterior já saiu do bucket: uma falha
 // ao marcar a linha deixa o arquivo, e a linha `gerando` vence pelo prazo e conta no teto.
+//
+// A CAPA (spec da Etapa 11): o pedido no slide 1 em capa sai no formato da capa, em pé, com o pedido e o
+// corpo dela (imagem-openai.ts), a regra dela e o destino `bonus-capa`. O teto é o mesmo (10 por dia): a
+// capa conta junto com as outras. O formato é decidido no pedido; se o jeito mudar antes de a imagem
+// voltar, o guardar recusa com a linha travada, e a imagem que subiu sai do bucket.
 
-export type PedidoDaImagem = { ok: true; reservaId: string; hoje: number } | { ok: false; recusa: RecusaDaImagem; hoje?: number };
+export type PedidoDaImagem =
+  | { ok: true; reservaId: string; hoje: number; formato: FormatoDaImagem }
+  | { ok: false; recusa: RecusaDaImagem; hoje?: number };
 
 /** PEDIR UMA IMAGEM: as conferências que não custam nada, e a reserva no teto. */
 export async function pedirImagem(p: {
@@ -41,12 +54,13 @@ export async function pedirImagem(p: {
   const c = await conferirCarrossel(p.id, p.contas);
   if (!c.ok) return c;
   if (!Number.isInteger(p.numero) || !c.slides[p.numero - 1]) return { ok: false, recusa: { motivo: "slide" } };
-  if (!comEspaco(c.escolhas, p.numero)) return { ok: false, recusa: { motivo: "sem_espaco", numero: p.numero } };
+  const capa = ehCapa(c.escolhas, p.numero);
+  if (!capa && !comEspaco(c.escolhas, p.numero)) return { ok: false, recusa: { motivo: "sem_espaco", numero: p.numero } };
   const descricao = validarDescricao(p.descricao);
   if (!descricao.ok) return { ok: false, recusa: { motivo: "descricao", texto: descricao.mensagem } };
   if (!ambiente.OPENAI_API_KEY?.trim()) return { ok: false, recusa: { motivo: "sem_chave" } };
   const r = await reservarImagem({ carrosselId: c.linha.id, numero: p.numero, descricao: p.descricao.trim() });
-  if (r.ok) return { ok: true, reservaId: r.id, hoje: r.hoje };
+  if (r.ok) return { ok: true, reservaId: r.id, hoje: r.hoje, formato: capa ? "capa" : "espaco" };
   // O carrossel apagado no meio (achado 96) não tem a conta do dia: a transação da reserva abortou.
   return r.motivo === "nao_pronto" ? { ok: false, recusa: { motivo: "nao_pronto" } } : { ok: false, recusa: { motivo: r.motivo }, hoje: r.hoje };
 }
@@ -61,11 +75,14 @@ export async function gerarImagem(p: {
   numero: number;
   descricao: string;
   contas: ContaDoCabecalho[];
+  /** O formato que o pedido decidiu (`pedirImagem`): o da capa, em pé, ou o do espaço. */
+  formato: FormatoDaImagem;
   gerar?: GerarNaOpenAI;
   guardar?: typeof guardarImagem;
   marcarPronta?: typeof marcarProntaNoBanco;
 }): Promise<{ ok: true; caminho: string } | { ok: false; motivo: string }> {
-  const gerar = p.gerar ?? ((descricao: string) => gerarNaOpenAI(descricao));
+  const capa = p.formato === "capa";
+  const gerar = p.gerar ?? ((descricao: string) => (capa ? gerarCapaNaOpenAI(descricao) : gerarNaOpenAI(descricao)));
   const guardar = p.guardar ?? guardarImagem;
   const marcarPronta = p.marcarPronta ?? marcarProntaNoBanco;
   let subido: string | null = null;
@@ -83,11 +100,11 @@ export async function gerarImagem(p: {
   try {
     const r = await gerar(p.descricao);
     if (!r.ok) return falhar(r.erro);
-    const problema = problemaDaImagemGerada(r.bytes);
+    const problema = capa ? problemaDaCapaGerada(r.bytes) : problemaDaImagemGerada(r.bytes);
     const medidas = medidasDoJpeg(r.bytes);
-    if (problema || !medidas) return falhar(textoDoProblemaDaImagem(problema ?? "formato"));
+    if (problema || !medidas) return falhar((capa ? textoDoProblemaDaCapaGerada : textoDoProblemaDaImagem)(problema ?? "formato"));
     const arquivo = { nome: "imagem-gerada.jpg", mime: "image/jpeg", bytes: r.bytes.length, largura: medidas.largura, altura: medidas.altura };
-    const assinado = await assinarImagem({ id: p.id, numero: p.numero, destino: "foto", arquivo, contas: p.contas });
+    const assinado = await assinarImagem({ id: p.id, numero: p.numero, destino: capa ? "capa" : "foto", arquivo, contas: p.contas });
     if (!assinado.ok) return falhar(textoDaRecusaDaPublicacaoDoCarrossel(assinado.recusa));
     // A cópia dos bytes dá ao `fetch` o tipo que ele aceita como corpo (`Uint8Array<ArrayBuffer>`).
     const subida = await fetch(assinado.url, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: new Uint8Array(r.bytes) });
```

Em `app/bonus/imagem-actions.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/imagem-actions.ts b/app/bonus/imagem-actions.ts
index 1084dfc..1f600ba 100644
--- a/app/bonus/imagem-actions.ts
+++ b/app/bonus/imagem-actions.ts
@@ -40,7 +40,7 @@ export async function pedirImagemDoSlide(pedido: unknown): Promise<AvisoDoPedido
   const contas = await contasParaArte();
   const r = await pedirImagem({ id, numero, descricao, contas });
   if (!r.ok) return { tom: "erro", texto: textoDaRecusaDaImagem(r.recusa), em, ...(r.hoje === undefined ? {} : { hoje: r.hoje }) };
-  const { reservaId } = r;
-  after(() => gerarImagem({ reservaId, id, numero, descricao, contas }));
+  const { reservaId, formato } = r;
+  after(() => gerarImagem({ reservaId, id, numero, descricao, contas, formato }));
   return { tom: "ok", texto: TEXTO_GERANDO_A_IMAGEM, em, hoje: r.hoje };
 }
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx eslint lib/bonus/prompt-ilustracao.ts lib/bonus/imagem-openai.ts lib/bonus/imagem-regras.ts lib/bonus/imagem-textos.ts lib/bonus/imagem-processo.ts app/bonus/imagem-actions.ts tests/bonus-capa-imagem.test.ts tests/bonus-capa-paginas.test.ts testes-integracao/bonus-imagem-processo.integracao.ts
npx vitest run tests/bonus-capa-imagem.test.ts tests/bonus-capa-paginas.test.ts tests/bonus-imagem-openai.test.ts tests/bonus-prompt-ilustracao.test.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-imagem-processo.integracao.ts
```

Esperado: `tsc` e lint limpos; os 4 arquivos puros passam, com 63 casos (os pedidos medidos da Etapa 6, em
`tests/bonus-prompt-ilustracao.test.ts`, e o corpo de hoje, em `tests/bonus-imagem-openai.test.ts`, sem mudança);
na integração, os 27.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/prompt-ilustracao.ts lib/bonus/imagem-openai.ts lib/bonus/imagem-regras.ts lib/bonus/imagem-textos.ts lib/bonus/imagem-processo.ts app/bonus/imagem-actions.ts tests/bonus-capa-imagem.test.ts tests/bonus-capa-paginas.test.ts testes-integracao/bonus-imagem-processo.integracao.ts
test "$(git branch --show-current)" = "capa-do-carrossel"
git add lib/bonus/prompt-ilustracao.ts lib/bonus/imagem-openai.ts lib/bonus/imagem-regras.ts lib/bonus/imagem-textos.ts lib/bonus/imagem-processo.ts app/bonus/imagem-actions.ts tests/bonus-capa-imagem.test.ts tests/bonus-capa-paginas.test.ts testes-integracao/bonus-imagem-processo.integracao.ts
```

```bash
git commit -F - <<'MSG'
A capa pode ser gerada por IA em pé, no mesmo teto, e os pedidos da Etapa 6 não mudam

O pedido da capa sai em 1024x1536, com uma frase a mais nas regras do Chat para
o terço de baixo ficar livre, e conta no mesmo teto de 10 imagens por dia. O
formato é decidido no pedido e levado à geração, que roda depois da resposta.
Os pedidos medidos da Etapa 6 continuam iguais, byte a byte.
MSG
```

---

### FASE 7 — O publicar com a capa

**Arquivos:**
- Modificar: `lib/bonus/publicar-estado.ts`, `lib/bonus/publicar-cabimento.ts`,
  `lib/bonus/publicar-processo.ts` (`publicarNaFila`), `lib/bonus/publicar-repositorio.ts` (o conferido),
  `app/bonus/[id]/carrossel/[cid]/card-publicar.tsx`, `app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx`,
  `app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx`, `app/bonus/[id]/carrossel/[cid]/revisao.tsx`
- Criar: `tests/bonus-capa-publicar.test.ts`
- Testar: `tests/bonus-capa-paginas.test.ts`, `tests/bonus-publicar-cabimento.test.ts`,
  `tests/bonus-publicar-estado.test.ts`, `testes-integracao/bonus-publicar-processo.integracao.ts`,
  `testes-integracao/bonus-publicar-repositorio.integracao.ts`,
  `testes-integracao/bonus-apagar-carrossel.integracao.ts`

**Interfaces:**
- Consome: `valeNoSlide`, `capaDaArte` (FASE 1), `tamanhoDaCapa` (FASE 2).
- Produz: `faltasParaPublicar({ ..., capa })` (a capa precisa da imagem do jeito dela, e uma imagem de outro
  jeito conta como a que falta); `artesParaPublicar({ total, soTexto, imagens, capa })`, que devolve
  `{ numero, comFoto, capa?: true }[]`; `ArteQueSai` com `capa?`; `corteDoSlide(slide, arte)` pela medida da
  capa; `corteDoCard({ ..., capa })`; `ConferidoParaPublicar.capa`; e as props `capa` do card do Publicar e
  `capaInicial` do editor.

- [ ] **Passo 1: os testes**

Crie `tests/bonus-capa-publicar.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { slidesDoTexto } from "@/lib/bonus/arte-slides";
import type { TextoDeCarrossel } from "@/lib/bonus/carrossel-texto";
import { corteDoCard, corteDoSlide, slidesQueSaemCortados } from "@/lib/bonus/publicar-cabimento";
import { artesParaPublicar, faltasParaPublicar } from "@/lib/bonus/publicar-estado";

// O PUBLICAR COM A CAPA, NA TELA (spec da Etapa 11, "O publicar"): o slide 1 em capa pede a imagem da capa,
// e só ela conta; ele sai com a arte do Chat, com a imagem desenhada (o "sim" da rota) e com a conta do
// corte da capa. A imagem de outro jeito conta como a que falta. O servidor confere o mesmo
// (testes-integracao/bonus-publicar-processo, "publicar com a capa").

const BASE = {
  total: 5,
  soTexto: [5],
  origem: "gravada" as const,
  slidesNaoSalvos: [],
  legendaNaoSalva: false,
  cortados: { slides: [], soTextoResolve: [] },
};
const PRONTOS = { 2: { jeito: "slide" as const }, 3: { jeito: "slide" as const }, 4: { jeito: "foto" as const } };

describe("o que falta para publicar com a capa", () => {
  it("a capa com a imagem dela não falta", () => {
    expect(faltasParaPublicar({ ...BASE, capa: true, imagens: { ...PRONTOS, 1: { jeito: "capa" } } })).toEqual([]);
  });

  it("a capa sem imagem falta", () => {
    expect(faltasParaPublicar({ ...BASE, capa: true, imagens: PRONTOS })).toEqual([{ tipo: "imagens", slides: [1] }]);
  });

  it("na capa, a foto do espaço ou o slide pronto guardados contam como a imagem que falta", () => {
    for (const jeito of ["foto", "slide"] as const) {
      expect(faltasParaPublicar({ ...BASE, capa: true, imagens: { ...PRONTOS, 1: { jeito } } })).toEqual([{ tipo: "imagens", slides: [1] }]);
    }
  });

  it("com a capa desligada, a imagem da capa no slide 1 conta como a que falta", () => {
    expect(faltasParaPublicar({ ...BASE, capa: false, imagens: { ...PRONTOS, 1: { jeito: "capa" } } })).toEqual([{ tipo: "imagens", slides: [1] }]);
  });

  it("a imagem sem o jeito dito continua contando no slide com espaço, como antes", () => {
    expect(faltasParaPublicar({ ...BASE, capa: false, imagens: { ...PRONTOS, 1: { caminho: "c1", versao: "v" } } })).toEqual([]);
  });
});

describe("as artes que a tela prepara com a capa", () => {
  it("a capa com a imagem dela sai com a arte, a imagem desenhada e a marca da capa", () => {
    expect(artesParaPublicar({ total: 5, soTexto: [5], imagens: { ...PRONTOS, 1: { jeito: "capa" } }, capa: true })).toEqual([
      { numero: 1, comFoto: true, capa: true },
      { numero: 4, comFoto: true },
      { numero: 5, comFoto: false },
    ]);
  });

  it("a capa sem a imagem dela não sai: falta a imagem", () => {
    expect(artesParaPublicar({ total: 5, soTexto: [5], imagens: { ...PRONTOS, 1: { jeito: "foto" } }, capa: true })).toEqual([
      { numero: 4, comFoto: true },
      { numero: 5, comFoto: false },
    ]);
  });
});

describe("o corte da capa", () => {
  const texto = (gancho: string): TextoDeCarrossel => ({
    tipo: "carrossel",
    titulo: "",
    gancho,
    slides: [{ titulo: "Um", texto: "Texto do slide." }],
    chamada: "Comente SUMIDO e receba as mensagens.",
    legenda: "x".repeat(100),
  });
  const CABE = "Seu cliente sumiu? Não é culpa dele.";
  const NAO_CABE = "Desinconstitucionalissimamente proibido";

  it("a capa usa a conta da capa: o gancho que cabe não corta, e o que não cabe só se resolve encurtando", () => {
    expect(corteDoSlide(slidesDoTexto(texto(CABE))[0], { comFoto: true, capa: true })).toBeNull();
    expect(corteDoSlide(slidesDoTexto(texto(NAO_CABE))[0], { comFoto: true, capa: true })).toBe("encurtar");
  });

  it("no servidor, a arte da capa conta pela capa", () => {
    expect(slidesQueSaemCortados(slidesDoTexto(texto(NAO_CABE)), [{ numero: 1, comFoto: true, capa: true }])).toEqual({
      slides: [1],
      soTextoResolve: [],
    });
  });

  it("o card da capa avisa antes da imagem: o fundo escuro existe para o não cabe aparecer antes", () => {
    const valores = { gancho: NAO_CABE, slide_1_titulo: "Um", slide_1_texto: "Texto do slide.", chamada: "Comente SUMIDO." };
    expect(corteDoCard({ total: 3, numero: 1, valores, soTexto: false, jeito: null, capa: true })).toBe("encurtar");
    expect(corteDoCard({ total: 3, numero: 1, valores: { ...valores, gancho: CABE }, soTexto: false, jeito: null, capa: true })).toBeNull();
  });

  it("sem a capa, o mesmo gancho segue a conta de hoje", () => {
    const valores = { gancho: CABE, slide_1_titulo: "Um", slide_1_texto: "Texto do slide.", chamada: "Comente SUMIDO." };
    expect(corteDoCard({ total: 3, numero: 1, valores, soTexto: false, jeito: null, capa: false })).toBeNull();
  });
});
```

Em `tests/bonus-capa-paginas.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-capa-paginas.test.ts b/tests/bonus-capa-paginas.test.ts
index 5dc69d6..7fde946 100644
--- a/tests/bonus-capa-paginas.test.ts
+++ b/tests/bonus-capa-paginas.test.ts
@@ -66,3 +66,26 @@ describe("as rotas da consulta e a action do pedido, com a capa", () => {
     expect(fonte).toContain("gerarImagem({ reservaId, id, numero, descricao, contas, formato })");
   });
 });
+
+// A CAPA CHEGA AO "PUBLICAR" DA TELA (Etapa 11): a página passa a capa gravada ao editor, e o editor a
+// passa ao card do "Publicar" e aos cards dos slides. Os componentes têm a capa desligada como padrão, para
+// os testes de tela de antes da capa seguirem iguais; por isso a guarda confere que quem os monta a passa.
+describe("a capa passa da página ao card do Publicar", () => {
+  const PASTA = "app/bonus/[id]/carrossel/[cid]";
+
+  it("a página passa a capa gravada ao editor", () => {
+    expect(ler(`${PASTA}/revisao.tsx`)).toContain("capaInicial={escolhas.capa}");
+  });
+
+  it("o editor passa a capa ao card do Publicar e ao card do slide 1", () => {
+    const editor = ler(`${PASTA}/editor-do-carrossel.tsx`);
+    expect(editor).toContain("capa={capa}");
+    expect(editor).toContain("capa={capa && n === 1}");
+  });
+
+  it("o card do Publicar leva a capa às faltas e às artes", () => {
+    const card = ler(`${PASTA}/card-publicar.tsx`);
+    expect(card).toMatch(/faltasParaPublicar\(\{[^}]*\bcapa\b/);
+    expect(card).toMatch(/artesParaPublicar\(\{[^}]*\bcapa\b/);
+  });
+});
```

Em `tests/bonus-publicar-cabimento.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-publicar-cabimento.test.ts b/tests/bonus-publicar-cabimento.test.ts
index c913817..ef624b7 100644
--- a/tests/bonus-publicar-cabimento.test.ts
+++ b/tests/bonus-publicar-cabimento.test.ts
@@ -100,22 +100,22 @@ describe("o corte do slide de um card, com o texto dos campos dele", () => {
   const card2 = (texto: string) => ({ slide_1_titulo: VALORES.slide_1_titulo, slide_1_texto: texto });
 
   it("com a foto no espaço, conta com o espaço", () => {
-    expect(corteDoCard({ total: 3, numero: 2, valores: card2(OITO_LINHAS), soTexto: false, jeito: "foto" })).toBe("so_texto_resolve");
+    expect(corteDoCard({ capa: false, total: 3, numero: 2, valores: card2(OITO_LINHAS), soTexto: false, jeito: "foto" })).toBe("so_texto_resolve");
   });
 
   it("marcado Só texto, conta sem o espaço, e a foto guardada não conta", () => {
-    expect(corteDoCard({ total: 3, numero: 2, valores: card2(OITO_LINHAS), soTexto: true, jeito: "foto" })).toBeNull();
-    expect(corteDoCard({ total: 3, numero: 2, valores: card2(TRINTA_LINHAS), soTexto: true, jeito: null })).toBe("encurtar");
+    expect(corteDoCard({ capa: false, total: 3, numero: 2, valores: card2(OITO_LINHAS), soTexto: true, jeito: "foto" })).toBeNull();
+    expect(corteDoCard({ capa: false, total: 3, numero: 2, valores: card2(TRINTA_LINHAS), soTexto: true, jeito: null })).toBe("encurtar");
   });
 
   it("com o slide pronto do Canva, ou ainda sem imagem, não conta", () => {
-    expect(corteDoCard({ total: 3, numero: 2, valores: card2(TRINTA_LINHAS), soTexto: false, jeito: "slide" })).toBeNull();
-    expect(corteDoCard({ total: 3, numero: 2, valores: card2(TRINTA_LINHAS), soTexto: false, jeito: null })).toBeNull();
+    expect(corteDoCard({ capa: false, total: 3, numero: 2, valores: card2(TRINTA_LINHAS), soTexto: false, jeito: "slide" })).toBeNull();
+    expect(corteDoCard({ capa: false, total: 3, numero: 2, valores: card2(TRINTA_LINHAS), soTexto: false, jeito: null })).toBeNull();
   });
 
   it("no post, o texto e a chamada são do mesmo card", () => {
     const valores = { texto: PALAVRA_DA_PROVA, chamada: "Salve este post." };
-    expect(corteDoCard({ total: 1, numero: 1, valores, soTexto: false, jeito: "foto" })).toBe("encurtar");
+    expect(corteDoCard({ capa: false, total: 1, numero: 1, valores, soTexto: false, jeito: "foto" })).toBe("encurtar");
   });
 });
 
```

Em `tests/bonus-publicar-estado.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-publicar-estado.test.ts b/tests/bonus-publicar-estado.test.ts
index 96680cb..9d76b22 100644
--- a/tests/bonus-publicar-estado.test.ts
+++ b/tests/bonus-publicar-estado.test.ts
@@ -228,6 +228,7 @@ describe("o que falta para publicar", () => {
   const base = {
     total: 5,
     soTexto: [1, 5],
+    capa: false,
     imagens: { 2: { caminho: "c2", versao: "v" }, 3: { caminho: "c3", versao: "v" } },
     origem: "gravada" as const,
     slidesNaoSalvos: [],
@@ -292,7 +293,7 @@ describe("o que falta para publicar", () => {
 describe("as artes que a tela prepara ao publicar", () => {
   it("o só texto e o com foto, em ordem; o slide pronto e o sem imagem, não", () => {
     const imagens = { 2: { jeito: "foto" as const }, 3: { jeito: "slide" as const } };
-    expect(artesParaPublicar({ total: 5, soTexto: [1, 5], imagens })).toEqual([
+    expect(artesParaPublicar({ total: 5, soTexto: [1, 5], imagens, capa: false })).toEqual([
       { numero: 1, comFoto: false },
       { numero: 2, comFoto: true },
       { numero: 5, comFoto: false },
@@ -300,7 +301,7 @@ describe("as artes que a tela prepara ao publicar", () => {
   });
 
   it("a foto guardada num slide só texto não conta: o espaço não existe", () => {
-    expect(artesParaPublicar({ total: 3, soTexto: [2], imagens: { 2: { jeito: "foto" } } })).toEqual([{ numero: 2, comFoto: false }]);
+    expect(artesParaPublicar({ total: 3, soTexto: [2], imagens: { 2: { jeito: "foto" } }, capa: false })).toEqual([{ numero: 2, comFoto: false }]);
   });
 });
 
```

Em `testes-integracao/bonus-publicar-processo.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/bonus-publicar-processo.integracao.ts b/testes-integracao/bonus-publicar-processo.integracao.ts
index 0742fb4..05edf1c 100644
--- a/testes-integracao/bonus-publicar-processo.integracao.ts
+++ b/testes-integracao/bonus-publicar-processo.integracao.ts
@@ -863,3 +863,92 @@ describe("a foto da capa", () => {
     expect(r.ok ? null : r.recusa).toEqual({ motivo: "na_capa", numero: 1 });
   });
 });
+
+// PUBLICAR COM A CAPA (spec da Etapa 11, "O publicar"): a capa sai com a arte do Chat, desenhada com a
+// imagem da capa, pela mesma subida das artes "Só texto" e com foto. A imagem da capa nunca é copiada nem
+// vai à fila. O publicar recusa a capa sem imagem, a arte desenhada com outra imagem e o gancho que não cabe
+// na capa; e a imagem da capa guardada num slide com espaço (a capa desligada) conta como a que falta.
+describe("publicar com a capa", () => {
+  const ARTE_CAPA = { conta: CONTA, nome: "Thiago Vannuchi", arroba: "thiagovannuchi", soTexto: [5], capa: true };
+  const CAPA_DECLARADA = { nome: "capa.jpg", mime: "image/jpeg", bytes: 1000, largura: 1080, altura: 1350 };
+  const desenho = (texto: TextoDeCarrossel, n: number, imagem: string | null) => regras.versaoDoDesenho(slides.slidesDoTexto(texto)[n - 1], imagem);
+
+  async function subirCapa(id: string): Promise<string> {
+    const a = await processo.assinarImagem({ id, numero: 1, destino: "capa", arquivo: CAPA_DECLARADA, contas });
+    if (!a.ok) throw new Error(`assinar recusou: ${a.recusa.motivo}`);
+    await fetch(a.url, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: JPEG });
+    return a.caminho;
+  }
+
+  /** O slide 1 em capa (com a imagem dela, se pedida); o 2, o 3 e o 4 com o slide pronto; o 5 só texto. */
+  async function comCapa(texto: TextoDeCarrossel = TEXTO, comImagem = true) {
+    const id = await carrossel(ARTE_CAPA, texto);
+    let capa: string | null = null;
+    if (comImagem) {
+      capa = await subirCapa(id);
+      const g = await processo.guardarImagem({ id, numero: 1, caminho: capa, contas });
+      if (!g.ok) throw new Error(`guardar recusou: ${g.recusa.motivo}`);
+    }
+    for (const n of [2, 3, 4]) await processo.guardarImagem({ id, numero: n, caminho: await subir(id, n, "slide"), contas });
+    return { id, capa };
+  }
+
+  it("a capa vai com a arte subida, desenhada com a imagem dela; a imagem da capa não é copiada nem vai à fila", async () => {
+    const { id, capa } = await comCapa();
+    const artes = [
+      { numero: 1, caminho: await subir(id, 1, "fila"), versao: desenho(TEXTO, 1, capa) },
+      { numero: 5, caminho: await subir(id, 5, "fila"), versao: desenho(TEXTO, 5, null) },
+    ];
+    bucket.chamadas = [];
+    expect(await processo.publicarNaFila({ id, quando: null, artes, contas, drenar })).toEqual({ ok: true, quando: null, jaVale: true });
+    const [item] = await fila();
+    expect(item.payload.caminhos[0]).toBe(artes[0].caminho);
+    expect(item.payload.caminhos).not.toContain(capa);
+    expect(bucket.chamadas).not.toContain(`baixou ${capa}`);
+    expect(bucket.objetos.has(capa as string)).toBe(true);
+  });
+
+  it("a capa sem imagem é recusada antes de tocar o bucket, e a arte dela nem se assina", async () => {
+    const { id } = await comCapa(TEXTO, false);
+    const daCapa = await processo.assinarImagem({ id, numero: 1, destino: "fila", arquivo: DECLARADO, contas });
+    expect(daCapa.ok ? null : daCapa.recusa).toEqual({ motivo: "faltam_imagens", slides: [1] });
+    const artes = [{ numero: 5, caminho: await subir(id, 5, "fila"), versao: desenho(TEXTO, 5, null) }];
+    const r = await processo.publicarNaFila({ id, quando: null, artes, contas, drenar });
+    expect(r.ok ? null : r.recusa).toEqual({ motivo: "faltam_imagens", slides: [1] });
+    expect(await fila()).toEqual([]);
+  });
+
+  it("a arte da capa desenhada com outra imagem é velha, e as artes subidas saem do bucket", async () => {
+    const { id } = await comCapa();
+    const OUTRA = `${CONTA}/bonus-capa/0b2f4c1e-7a9d-4e3b-9c5f-1d2e3f4a5b6d.jpg`;
+    const artes = [
+      { numero: 1, caminho: await subir(id, 1, "fila"), versao: desenho(TEXTO, 1, OUTRA) },
+      { numero: 5, caminho: await subir(id, 5, "fila"), versao: desenho(TEXTO, 5, null) },
+    ];
+    const r = await processo.publicarNaFila({ id, quando: null, artes, contas, drenar });
+    expect(r.ok ? null : r.recusa).toEqual({ motivo: "arte_velha", numero: 1 });
+    for (const a of artes) expect(bucket.objetos.has(a.caminho)).toBe(false);
+  });
+
+  it("o gancho que não cabe na capa é recusado, e só encurtar resolve", async () => {
+    const texto: TextoDeCarrossel = { ...TEXTO, gancho: "Desinconstitucionalissimamente proibido" };
+    const { id, capa } = await comCapa(texto);
+    const artes = [
+      { numero: 1, caminho: await subir(id, 1, "fila"), versao: desenho(texto, 1, capa) },
+      { numero: 5, caminho: await subir(id, 5, "fila"), versao: desenho(texto, 5, null) },
+    ];
+    const r = await processo.publicarNaFila({ id, quando: null, artes, contas, drenar });
+    expect(r.ok ? null : r.recusa).toEqual({ motivo: "nao_cabe", slides: [1], soTextoResolve: [] });
+    expect(await fila()).toEqual([]);
+  });
+
+  it("com a capa desligada, a imagem da capa guardada no slide 1 conta como a que falta, e não é copiada", async () => {
+    const { id } = await comCapa();
+    await repo.salvarSoTextoDaArte(id, [5], null, false);
+    bucket.chamadas = [];
+    const artes = [{ numero: 5, caminho: await subir(id, 5, "fila"), versao: desenho(TEXTO, 5, null) }];
+    const r = await processo.publicarNaFila({ id, quando: null, artes, contas, drenar });
+    expect(r.ok ? null : r.recusa).toEqual({ motivo: "faltam_imagens", slides: [1] });
+    expect(bucket.chamadas.filter((c) => c.startsWith("baixou"))).toEqual([]);
+  });
+});
```

Em `testes-integracao/bonus-publicar-repositorio.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/bonus-publicar-repositorio.integracao.ts b/testes-integracao/bonus-publicar-repositorio.integracao.ts
index 366b918..5872ed9 100644
--- a/testes-integracao/bonus-publicar-repositorio.integracao.ts
+++ b/testes-integracao/bonus-publicar-repositorio.integracao.ts
@@ -278,7 +278,7 @@ describe("a trava nas gravações do carrossel", () => {
 describe("a reserva da publicação", () => {
   const imagensDe = (id: string) => publicar.gravarImagemDoSlide(id, 2, guardada(2)).then(() =>
     publicar.gravarImagemDoSlide(id, 3, guardada(3))).then(() => publicar.gravarImagemDoSlide(id, 4, guardada(4)));
-  const esperado = { texto: JSON.stringify(TEXTO), soTexto: [1, 5], imagens: { 2: guardada(2), 3: guardada(3), 4: guardada(4) } };
+  const esperado = { texto: JSON.stringify(TEXTO), soTexto: [1, 5], capa: false, imagens: { 2: guardada(2), 3: guardada(3), 4: guardada(4) } };
   const caminhos = [daFila(1), daFila(2), daFila(3), daFila(4), daFila(5)];
 
   it("grava a chave e os caminhos, com a hora do banco, e devolve a legenda salva", async () => {
@@ -400,3 +400,53 @@ describe("a reserva da publicação", () => {
     expect(await publicar.caminhosNaFila([daFila(3)])).toEqual([]);
   });
 });
+
+// A RESERVA COM A CAPA (spec da Etapa 11): a reserva confere de novo, com a linha travada, se a capa
+// continua ligada e com a mesma imagem com que a arte dela foi desenhada. A imagem da capa entra como a do
+// slide 1.
+describe("a reserva com a capa", () => {
+  const CAPA = `${CONTA}/bonus-capa/${uuid(1)}.jpg`;
+  const OUTRA = `${CONTA}/bonus-capa/${uuid(11)}.jpg`;
+  const caminhos = [daFila(1), daFila(2), daFila(3), daFila(4), daFila(5)];
+  const esperado = {
+    texto: JSON.stringify(TEXTO),
+    soTexto: [5],
+    capa: true,
+    imagens: { 1: CAPA, 2: guardada(2), 3: guardada(3), 4: guardada(4) },
+  };
+  async function comCapa(): Promise<string> {
+    const id = await carrossel({ ...ARTE, soTexto: [5], capa: true });
+    for (const [n, c] of [
+      [1, CAPA],
+      [2, guardada(2)],
+      [3, guardada(3)],
+      [4, guardada(4)],
+    ] as const) {
+      const g = await publicar.gravarImagemDoSlide(id, n, c);
+      if (!g.ok) throw new Error(`gravar recusou: ${g.recusa.motivo}`);
+    }
+    return id;
+  }
+
+  it("a capa ligada, com a imagem conferida, reserva", async () => {
+    const id = await comCapa();
+    expect(await publicar.reservarPublicacao(id, esperado, "pub:capa-1", caminhos)).toMatchObject({ ok: true });
+  });
+
+  it.each([
+    ["a capa que a tela achava desligada", { capa: false, imagens: { 2: guardada(2), 3: guardada(3), 4: guardada(4) } }],
+    ["outra imagem da capa", { imagens: { ...esperado.imagens, 1: OUTRA } }],
+  ])("recusa quando mudou %s", async (_nome, mudanca) => {
+    const id = await comCapa();
+    const r = await publicar.reservarPublicacao(id, { ...esperado, ...mudanca }, "pub:capa-2", caminhos);
+    expect(r.ok ? null : r.recusa.motivo).toBe("mudou");
+    expect(regras.publicacaoDaArte(await arteDe(id))).toBeNull();
+  });
+
+  it("a capa desligada no banco depois de conferir: a reserva vê que mudou", async () => {
+    const id = await comCapa();
+    await repo.salvarSoTextoDaArte(id, [5], null, false);
+    const r = await publicar.reservarPublicacao(id, esperado, "pub:capa-3", caminhos);
+    expect(r.ok ? null : r.recusa.motivo).toBe("mudou");
+  });
+});
```

Em `testes-integracao/bonus-apagar-carrossel.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/bonus-apagar-carrossel.integracao.ts b/testes-integracao/bonus-apagar-carrossel.integracao.ts
index 39b1caf..cc3d747 100644
--- a/testes-integracao/bonus-apagar-carrossel.integracao.ts
+++ b/testes-integracao/bonus-apagar-carrossel.integracao.ts
@@ -350,7 +350,7 @@ describe("o apagar e o agendar ao mesmo tempo: um espera o outro", () => {
         await tx.query(`select id from carrosseis_gerados where id = $1 for update`, [id]);
         await tx.query(`delete from carrosseis_gerados where id = $1`, [id]);
       },
-      () => publicar.reservarPublicacao(id, { texto: JSON.stringify(TEXTO), soTexto: [], imagens: {} }, "pub:tarde", [FILA])
+      () => publicar.reservarPublicacao(id, { texto: JSON.stringify(TEXTO), soTexto: [], capa: false, imagens: {} }, "pub:tarde", [FILA])
     );
     expect(r).toEqual({ ok: false, recusa: { motivo: "nao_pronto" } });
   });
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-capa-publicar.test.ts tests/bonus-capa-paginas.test.ts tests/bonus-publicar-cabimento.test.ts tests/bonus-publicar-estado.test.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-publicar-processo.integracao.ts testes-integracao/bonus-publicar-repositorio.integracao.ts
```

Esperado: 10 caem e 82 passam (92): as faltas, as artes e o corte ainda não conhecem a capa, e a página ainda não
a passa ao editor. Na integração, `[rede-global] ALVO: banco de TESTE`, 7 caem e 86 passam (93): o publicar e a
reserva ainda não levam a capa.

- [ ] **Passo 3: o código**

Em `lib/bonus/publicar-estado.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/publicar-estado.ts b/lib/bonus/publicar-estado.ts
index 4436ca8..806921c 100644
--- a/lib/bonus/publicar-estado.ts
+++ b/lib/bonus/publicar-estado.ts
@@ -95,12 +95,18 @@ export type FaltaParaPublicar =
  * com espaço, o texto que sairia cortado (Etapa 9: a imagem do slide decide o modo da conta, e encurtar
  * deixa o card sem salvar), e o que está "não salvo" (o que sai é o texto salvo, e não o que está nos
  * campos).
+ *
+ * A CAPA (spec da Etapa 11): o slide 1 em capa pede a imagem da capa, e só ela conta; a imagem da capa num
+ * slide com espaço também não conta (a imagem de outro jeito conta como sem imagem). A imagem sem o jeito
+ * dito conta no slide com espaço, como antes. `capa` é obrigatória, para o chamador não esquecê-la.
  */
 export function faltasParaPublicar(p: {
   total: number;
   soTexto: number[];
-  /** A imagem de cada slide, como o banco a guarda ou como a tela a mostra: aqui só importa se há. */
+  /** A imagem de cada slide, como o banco a guarda ou como a tela a mostra: importa se há, e o jeito dela. */
   imagens: Record<number, unknown>;
+  /** O slide 1 em "Capa com imagem" (Etapa 11). */
+  capa: boolean;
   origem: OrigemDaConta;
   slidesNaoSalvos: number[];
   legendaNaoSalva: boolean;
@@ -110,8 +116,13 @@ export function faltasParaPublicar(p: {
   const faltas: FaltaParaPublicar[] = [];
   if (p.origem === "selecionada") faltas.push({ tipo: "sem_conta" });
   if (p.origem === "guardada" || p.origem === "gravada_saiu") faltas.push({ tipo: "conta_desconectada" });
+  const jeitoDe = (n: number): unknown => {
+    const i = p.imagens[n];
+    return i !== null && typeof i === "object" ? (i as { jeito?: unknown }).jeito : undefined;
+  };
+  const temImagem = (n: number) => (p.capa && n === 1 ? jeitoDe(n) === "capa" : Boolean(p.imagens[n]) && jeitoDe(n) !== "capa");
   const semImagem: number[] = [];
-  for (let n = 1; n <= p.total; n++) if (!p.soTexto.includes(n) && !p.imagens[n]) semImagem.push(n);
+  for (let n = 1; n <= p.total; n++) if (!p.soTexto.includes(n) && !temImagem(n)) semImagem.push(n);
   if (semImagem.length) faltas.push({ tipo: "imagens", slides: semImagem });
   if (p.cortados.slides.length) faltas.push({ tipo: "nao_cabe", ...p.cortados });
   if (p.slidesNaoSalvos.length || p.legendaNaoSalva) {
@@ -124,15 +135,22 @@ export function faltasParaPublicar(p: {
  * OS SLIDES QUE A TELA PREPARA AO PUBLICAR, com a arte do Chat (adendo da Etapa 5): o "Só texto" e o
  * slide com foto. O com foto exige a foto desenhada (achado 78). O slide pronto sai com a cópia, que o
  * servidor faz; e a foto guardada num slide "Só texto" não conta, porque o espaço não existe.
+ *
+ * A CAPA (spec da Etapa 11) também sai com a arte do Chat: o slide 1 em capa, com a imagem da capa, vai
+ * com `comFoto` (a rota tem de ter desenhado a imagem, achado 78) e `capa` (a conta do corte é a da capa).
+ * A capa sem imagem não sai: falta a imagem dela.
  */
 export function artesParaPublicar(p: {
   total: number;
   soTexto: number[];
   imagens: Record<number, { jeito: JeitoDaImagem } | undefined>;
-}): { numero: number; comFoto: boolean }[] {
-  const artes: { numero: number; comFoto: boolean }[] = [];
+  capa: boolean;
+}): { numero: number; comFoto: boolean; capa?: true }[] {
+  const artes: { numero: number; comFoto: boolean; capa?: true }[] = [];
   for (let n = 1; n <= p.total; n++) {
-    if (p.soTexto.includes(n)) artes.push({ numero: n, comFoto: false });
+    if (p.capa && n === 1) {
+      if (p.imagens[n]?.jeito === "capa") artes.push({ numero: n, comFoto: true, capa: true });
+    } else if (p.soTexto.includes(n)) artes.push({ numero: n, comFoto: false });
     else if (p.imagens[n]?.jeito === "foto") artes.push({ numero: n, comFoto: true });
   }
   return artes;
```

Em `lib/bonus/publicar-cabimento.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/publicar-cabimento.ts b/lib/bonus/publicar-cabimento.ts
index c0ffc98..ecd4d26 100644
--- a/lib/bonus/publicar-cabimento.ts
+++ b/lib/bonus/publicar-cabimento.ts
@@ -12,6 +12,7 @@
 // imagem que falta. Por isso o slide que o botão barra é sempre um slide que o card avisa.
 import { textoDosCampos } from "./arte-cabimento";
 import { slidesDoTexto, tamanhoDoSlide, type SlideParaArte } from "./arte-slides";
+import { tamanhoDaCapa } from "./capa-medida";
 import { artesParaPublicar } from "./publicar-estado";
 import type { JeitoDaImagem } from "./publicar-regras";
 
@@ -22,11 +23,19 @@ import type { JeitoDaImagem } from "./publicar-regras";
  */
 export type Corte = "encurtar" | "so_texto_resolve";
 
-/** Um slide que sai com a arte do Chat (`artesParaPublicar`): o "Só texto" e o com foto no espaço. */
-export type ArteQueSai = { numero: number; comFoto: boolean };
+/**
+ * Um slide que sai com a arte do Chat (`artesParaPublicar`): o "Só texto", o com foto no espaço e a capa
+ * (Etapa 11), que vai com `capa`.
+ */
+export type ArteQueSai = { numero: number; comFoto: boolean; capa?: true };
 
-/** O corte de um slide no modo em que ele sai. Sem arte (o slide pronto, ou ainda sem imagem): nunca. */
-export function corteDoSlide(s: SlideParaArte, arte: { comFoto: boolean } | null): Corte | null {
+/**
+ * O corte de um slide no modo em que ele sai. Sem arte (o slide pronto, ou ainda sem imagem): nunca. Na
+ * capa (Etapa 11), a conta é a da capa (`tamanhoDaCapa`), e só encurtar resolve: o "Só texto" não tem a
+ * imagem da capa.
+ */
+export function corteDoSlide(s: SlideParaArte, arte: { comFoto: boolean; capa?: true } | null): Corte | null {
+  if (arte?.capa) return tamanhoDaCapa(s).cabe ? null : "encurtar";
   if (arte === null || tamanhoDoSlide(s, arte.comFoto).cabe) return null;
   return arte.comFoto && tamanhoDoSlide(s, false).cabe ? "so_texto_resolve" : "encurtar";
 }
@@ -57,6 +66,9 @@ export function slidesQueSaemCortados(slides: SlideParaArte[], artes: ArteQueSai
  * NA TELA: o corte do slide de um card, com o texto que está nos campos dele agora, o "Só texto" e o
  * jeito da imagem guardada. O botão "Publicar" já trava com qualquer card "não salvo": quando ele está
  * livre, o texto dos campos é o salvo, e a tela conta sobre o mesmo texto que o servidor.
+ *
+ * NA CAPA (Etapa 11), o card avisa e o "Publicar" trava antes da imagem: a capa sem imagem mostra o fundo
+ * escuro, justamente para o "não cabe" aparecer antes (spec, "O card do slide 1"). `capa` é obrigatória.
  */
 export function corteDoCard(p: {
   total: number;
@@ -64,12 +76,15 @@ export function corteDoCard(p: {
   valores: Record<string, string>;
   soTexto: boolean;
   jeito: JeitoDaImagem | null;
+  capa: boolean;
 }): Corte | null {
   const s = slidesDoTexto(textoDosCampos(p.total, p.valores))[p.numero - 1];
+  if (s && p.capa && p.numero === 1) return corteDoSlide(s, { comFoto: true, capa: true });
   const arte = artesParaPublicar({
     total: p.total,
     soTexto: p.soTexto ? [p.numero] : [],
     imagens: p.jeito ? { [p.numero]: { jeito: p.jeito } } : {},
+    capa: false,
   }).find((a) => a.numero === p.numero);
   return s ? corteDoSlide(s, arte ?? null) : null;
 }
```

Em `lib/bonus/publicar-processo.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/publicar-processo.ts b/lib/bonus/publicar-processo.ts
index 312a888..9970575 100644
--- a/lib/bonus/publicar-processo.ts
+++ b/lib/bonus/publicar-processo.ts
@@ -35,9 +35,11 @@ import {
   formaDoCarrossel,
   fotosDaArte,
   imagensDaArte,
+  jeitoDoCaminho,
   problemaDaFotoDaCapa,
   problemaDaFotoDoEspaco,
   problemaDaProporcaoDoSlide,
+  valeNoSlide,
   versaoDoDesenho,
   type DestinoDaImagem,
   type JeitoDaImagem,
@@ -214,12 +216,21 @@ export async function publicarNaFila(p: {
 
   const imagens = imagensDaArte(c.linha.arte, total);
   const comImagem = c.slides.filter((s) => comEspaco(c.escolhas, s.numero));
-  const faltam = comImagem.filter((s) => !imagens[s.numero]).map((s) => s.numero);
+  // A IMAGEM QUE VALE NO JEITO DO SLIDE (spec da Etapa 11): a capa pede a imagem dela, e a imagem de
+  // outro jeito conta como a que falta. Sem isso, a imagem da capa guardada num slide com espaço (a capa
+  // desligada depois de subir) iria para a fila como cópia de slide pronto.
+  const capa = capaDaArte(c.linha.arte, total);
+  const vale = (n: number) => imagens[n] !== undefined && valeNoSlide(c.escolhas, n, jeitoDoCaminho(imagens[n].caminho));
+  const faltam = c.slides
+    .filter((s) => (comEspaco(c.escolhas, s.numero) || ehCapa(c.escolhas, s.numero)) && !vale(s.numero))
+    .map((s) => s.numero);
   if (faltam.length) return recusa({ motivo: "faltam_imagens", slides: faltam });
-  // OS SLIDES QUE SAEM COM A ARTE DO CHAT: o "Só texto" e o com foto. O resto sai com a cópia do slide
-  // pronto. A foto de cada um é a do slide com espaço; no "Só texto" a foto guardada não conta.
+  // OS SLIDES QUE SAEM COM A ARTE DO CHAT: o "Só texto", o com foto e a capa. O resto sai com a cópia do
+  // slide pronto. A foto de cada um é a do slide com espaço; no "Só texto" a foto guardada não conta. O
+  // desenho da capa leva a imagem da capa.
   const fotos = fotosDaArte(c.linha.arte, total);
   const fotoDe = (n: number) => (comEspaco(c.escolhas, n) ? (fotos[n] ?? null) : null);
+  const desenhoDe = (n: number) => (ehCapa(c.escolhas, n) ? capa.caminho : fotoDe(n));
   const desenhados = c.slides.filter((s) => !comEspaco(c.escolhas, s.numero) || fotoDe(s.numero) !== null).map((s) => s.numero);
 
   // AS ARTES, conferidas antes de tudo. Os caminhos que o navegador subiu só servem para apagar numa
@@ -238,7 +249,10 @@ export async function publicarNaFila(p: {
   // O SLIDE QUE SAI CORTADO NÃO SAI (spec da Etapa 9, achado 87): a conta da arte no modo em que cada
   // slide sai, sobre o texto salvo. Vem depois do `descartar`, para as artes que o navegador subiu
   // saírem do bucket na recusa, e antes de conferir as artes, reservar e enfileirar.
-  const cortados = slidesQueSaemCortados(c.slides, desenhados.map((n) => ({ numero: n, comFoto: fotoDe(n) !== null })));
+  const cortados = slidesQueSaemCortados(
+    c.slides,
+    desenhados.map((n) => ({ numero: n, comFoto: desenhoDe(n) !== null, ...(ehCapa(c.escolhas, n) ? { capa: true as const } : {}) }))
+  );
   if (cortados.slides.length) {
     await descartar();
     return recusa({ motivo: "nao_cabe", ...cortados });
@@ -257,7 +271,7 @@ export async function publicarNaFila(p: {
       await descartar();
       return recusa({ motivo: "arte_so_texto", numero: n });
     }
-    if (a.versao !== versaoDoDesenho(c.slides[n - 1], fotoDe(n))) {
+    if (a.versao !== versaoDoDesenho(c.slides[n - 1], desenhoDe(n))) {
       await descartar();
       return recusa({ motivo: "arte_velha", numero: n });
     }
@@ -285,13 +299,18 @@ export async function publicarNaFila(p: {
   const chave = publicacaoKey(c.conta, forma, caminhos);
 
   // A reserva confere de novo TODAS as imagens dos slides com espaço, as fotos inclusive: a arte com
-  // foto foi desenhada com a foto que estava guardada na hora.
+  // foto foi desenhada com a foto que estava guardada na hora. E a capa (Etapa 11): se ela continua
+  // ligada, e com a mesma imagem com que a arte dela foi desenhada.
   const reserva = await reservarPublicacao(
     p.id,
     {
       texto: JSON.stringify(c.texto),
       soTexto: c.escolhas.soTexto,
-      imagens: Object.fromEntries(comImagem.map((s) => [s.numero, imagens[s.numero].caminho])),
+      capa: c.escolhas.capa,
+      imagens: Object.fromEntries([
+        ...comImagem.map((s) => [s.numero, imagens[s.numero].caminho] as const),
+        ...(capa.ligada && capa.caminho ? [[1, capa.caminho] as const] : []),
+      ]),
     },
     chave,
     caminhos
```

Em `lib/bonus/publicar-repositorio.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/publicar-repositorio.ts b/lib/bonus/publicar-repositorio.ts
index 22159f1..0049b42 100644
--- a/lib/bonus/publicar-repositorio.ts
+++ b/lib/bonus/publicar-repositorio.ts
@@ -8,6 +8,7 @@ import { textoDaLinhaDoCarrossel } from "./carrossel-tela";
 import { ehIdDeBonus } from "./pedido";
 import { estadoDaPublicacao, publicacaoLivre, type EstadoDaPublicacao, type LinhaDaFila } from "./publicar-estado";
 import {
+  capaDaArte,
   ehCaminhoDoDestino,
   imagensDaArte,
   publicacaoDaArte,
@@ -118,7 +119,9 @@ export type ConferidoParaPublicar = {
   /** O texto salvo, como `JSON.stringify` o escreve. */
   texto: string;
   soTexto: number[];
-  /** O caminho da imagem guardada de cada slide com espaço, que foi copiada. */
+  /** A capa do slide 1 (Etapa 11), ligada ou não: ligar ou desligar no meio muda o que sai. */
+  capa: boolean;
+  /** O caminho da imagem guardada de cada slide com espaço, que foi copiada, e o da imagem da capa. */
   imagens: Record<number, string>;
 };
 
@@ -146,9 +149,13 @@ export async function reservarPublicacao(
     const imagens = imagensDaArte(linha.arte, linha.total_slides);
     const atuais: Record<number, string> = {};
     for (let n = 1; n <= linha.total_slides; n++) if (comEspaco(escolhas, n) && imagens[n]) atuais[n] = imagens[n].caminho;
+    // A CAPA (Etapa 11): a imagem da capa entra como a do slide 1, só no jeito capa.
+    const capa = capaDaArte(linha.arte, linha.total_slides);
+    if (capa.caminho) atuais[1] = capa.caminho;
     const mudou =
       JSON.stringify(texto) !== conferido.texto ||
       JSON.stringify(escolhas.soTexto) !== JSON.stringify([...conferido.soTexto].sort((a, b) => a - b)) ||
+      escolhas.capa !== conferido.capa ||
       JSON.stringify(atuais) !== JSON.stringify(conferido.imagens);
     if (mudou) return recusa({ motivo: "mudou" });
     const anterior = publicacaoDaArte(linha.arte);
```

Em `app/bonus/[id]/carrossel/[cid]/card-publicar.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/[id]/carrossel/[cid]/card-publicar.tsx b/app/bonus/[id]/carrossel/[cid]/card-publicar.tsx
index 3d241ba..ff075d7 100644
--- a/app/bonus/[id]/carrossel/[cid]/card-publicar.tsx
+++ b/app/bonus/[id]/carrossel/[cid]/card-publicar.tsx
@@ -32,6 +32,7 @@ export default function CardPublicar({
   carrosselId,
   total,
   soTexto,
+  capa = false,
   imagens,
   versoesDaMiniatura,
   slidesNaoSalvos,
@@ -43,6 +44,8 @@ export default function CardPublicar({
   carrosselId: string;
   total: number;
   soTexto: number[];
+  /** O slide 1 em "Capa com imagem" (Etapa 11): ele pede a imagem da capa e sai com a arte da capa. */
+  capa?: boolean;
   imagens: Record<number, ImagemNaTela>;
   versoesDaMiniatura: string[];
   slidesNaoSalvos: number[];
@@ -56,7 +59,7 @@ export default function CardPublicar({
   const [aviso, setAviso] = useState<AvisoDaPublicacao | null>(null);
   const [pendente, iniciar] = useTransition();
   const { estado } = publicacao;
-  const faltas = faltasParaPublicar({ total, soTexto, imagens, origem: publicacao.origem, slidesNaoSalvos, legendaNaoSalva, cortados });
+  const faltas = faltasParaPublicar({ total, soTexto, imagens, capa, origem: publicacao.origem, slidesNaoSalvos, legendaNaoSalva, cortados });
   const travado = pendente || faltas.length > 0 || (quando === "depois" && !dataHora);
 
   function publicar() {
@@ -64,7 +67,7 @@ export default function CardPublicar({
       const r = await publicarDaTela({
         caminho,
         carrosselId,
-        desenhados: artesParaPublicar({ total, soTexto, imagens }),
+        desenhados: artesParaPublicar({ total, soTexto, imagens, capa }),
         versoesDaMiniatura,
         quando,
         dataHora: quando === "depois" ? dataHora : "",
```

Em `app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx b/app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx
index 411356a..39f548d 100644
--- a/app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx
+++ b/app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx
@@ -56,6 +56,7 @@ export default function CardDaParte({
   versao,
   aoNovaVersao,
   soTexto,
+  capa = false,
   aoMudarSoTexto,
   soTextoPendente,
   imagem = null,
@@ -95,6 +96,8 @@ export default function CardDaParte({
   aoMudarCorte?: (corte: Corte | null) => void;
   /** Gera a imagem do espaço deste slide (Etapa 6). Sem ele, o card não tem o "Gerar imagem". */
   gerarImagem?: GeradorDoSlide | null;
+  /** O slide 1 em "Capa com imagem" (Etapa 11). O editor o passa em cada card de slide. */
+  capa?: boolean;
 }) {
   const doCard = (v: Record<string, string>) => Object.fromEntries(campos.map((c) => [c.nome, v[c.nome] ?? ""]));
   const [atuais, setAtuais] = useState(() => doCard(valores));
@@ -127,8 +130,8 @@ export default function CardDaParte({
   );
   const jeito = imagem?.jeito ?? null;
   const corte = useMemo(
-    () => (numero !== null ? corteDoCard({ total, numero, valores: atuais, soTexto, jeito }) : null),
-    [numero, total, atuais, soTexto, jeito]
+    () => (numero !== null ? corteDoCard({ total, numero, valores: atuais, soTexto, jeito, capa }) : null),
+    [numero, total, atuais, soTexto, jeito, capa]
   );
   useEffect(() => {
     aoMudarCorte?.(corte);
```

Em `app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx b/app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx
index 79f4086..57d014a 100644
--- a/app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx
+++ b/app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx
@@ -56,6 +56,7 @@ export default function EditorDoCarrossel({
   avisoDaConta,
   podeFixar,
   soTextoInicial,
+  capaInicial = false,
   versoes: versoesIniciais,
   pausaMs = 400,
   intervaloDaConsultaMs = INTERVALO_CONSULTA_MS,
@@ -76,6 +77,8 @@ export default function EditorDoCarrossel({
   avisoDaConta: string | null;
   podeFixar: boolean;
   soTextoInicial: number[];
+  /** O slide 1 em "Capa com imagem" (Etapa 11), como está gravado. A página o passa sempre. */
+  capaInicial?: boolean;
   versoes: string[];
   pausaMs?: number;
   /** O intervalo entre as perguntas da consulta da imagem; o teste de tela usa um menor. */
@@ -100,6 +103,7 @@ export default function EditorDoCarrossel({
   }, []);
   const [soTexto, setSoTexto] = useState(soTextoInicial);
   const aceito = useRef(soTextoInicial);
+  const [capa] = useState(capaInicial);
   const [respostaDaArte, despacharArte, artePendente] = useActionState(
     async (anterior: AvisoDaArte | null, form: FormData) => {
       const r = await acaoDaArte(anterior, form);
@@ -241,6 +245,7 @@ export default function EditorDoCarrossel({
               versao={versoes[n - 1]}
               aoNovaVersao={(v) => setVersoes((vs) => vs.map((x, i) => (i === n - 1 ? v : x)))}
               soTexto={soTexto.includes(n)}
+              capa={capa && n === 1}
               aoMudarSoTexto={(marcado) => mudarSoTexto(n, marcado)}
               soTextoPendente={artePendente}
               imagem={imagens[n] ?? null}
@@ -291,6 +296,7 @@ export default function EditorDoCarrossel({
           carrosselId={carrosselId}
           total={total}
           soTexto={soTexto}
+          capa={capa}
           imagens={imagens}
           versoesDaMiniatura={versoes}
           slidesNaoSalvos={naoSalvos.filter((k) => k.startsWith("slide_")).map((k) => Number(k.slice("slide_".length)))}
```

Em `app/bonus/[id]/carrossel/[cid]/revisao.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/[id]/carrossel/[cid]/revisao.tsx b/app/bonus/[id]/carrossel/[cid]/revisao.tsx
index dd4dc53..63df056 100644
--- a/app/bonus/[id]/carrossel/[cid]/revisao.tsx
+++ b/app/bonus/[id]/carrossel/[cid]/revisao.tsx
@@ -110,6 +110,7 @@ export default async function Revisao({ carrossel }: { carrossel: LinhaDoCarross
       avisoDaConta={conta ? textoDaOrigemDaConta(origem, conta.username ?? "") : TEXTO_ARTE_SEM_CONTA}
       podeFixar={origem === "selecionada" && conta !== null}
       soTextoInicial={escolhas.soTexto}
+      capaInicial={escolhas.capa}
       versoes={versoesDosSlides(
         slidesDoTexto(texto),
         escolhas.soTexto,
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx eslint lib/bonus/publicar-estado.ts lib/bonus/publicar-cabimento.ts lib/bonus/publicar-processo.ts lib/bonus/publicar-repositorio.ts "app/bonus/[id]/carrossel/[cid]/card-publicar.tsx" "app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx" "app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx" "app/bonus/[id]/carrossel/[cid]/revisao.tsx" tests/bonus-capa-publicar.test.ts tests/bonus-capa-paginas.test.ts tests/bonus-publicar-cabimento.test.ts tests/bonus-publicar-estado.test.ts testes-integracao/bonus-publicar-processo.integracao.ts testes-integracao/bonus-publicar-repositorio.integracao.ts testes-integracao/bonus-apagar-carrossel.integracao.ts
npx vitest run tests/bonus-capa-publicar.test.ts tests/bonus-capa-paginas.test.ts tests/bonus-publicar-cabimento.test.ts tests/bonus-publicar-estado.test.ts
npm run test:dom
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-publicar-processo.integracao.ts testes-integracao/bonus-publicar-repositorio.integracao.ts testes-integracao/bonus-apagar-carrossel.integracao.ts
```

Esperado: `tsc` e lint limpos; os 92 puros passam; 27 arquivos e 266 casos de tela; e na integração, os 3 arquivos, com 116 casos.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/publicar-estado.ts lib/bonus/publicar-cabimento.ts lib/bonus/publicar-processo.ts lib/bonus/publicar-repositorio.ts "app/bonus/[id]/carrossel/[cid]/card-publicar.tsx" "app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx" "app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx" "app/bonus/[id]/carrossel/[cid]/revisao.tsx" tests/bonus-capa-publicar.test.ts tests/bonus-capa-paginas.test.ts tests/bonus-publicar-cabimento.test.ts tests/bonus-publicar-estado.test.ts testes-integracao/bonus-publicar-processo.integracao.ts testes-integracao/bonus-publicar-repositorio.integracao.ts testes-integracao/bonus-apagar-carrossel.integracao.ts
test "$(git branch --show-current)" = "capa-do-carrossel"
git add lib/bonus/publicar-estado.ts lib/bonus/publicar-cabimento.ts lib/bonus/publicar-processo.ts lib/bonus/publicar-repositorio.ts "app/bonus/[id]/carrossel/[cid]/card-publicar.tsx" "app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx" "app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx" "app/bonus/[id]/carrossel/[cid]/revisao.tsx" tests/bonus-capa-publicar.test.ts tests/bonus-capa-paginas.test.ts tests/bonus-publicar-cabimento.test.ts tests/bonus-publicar-estado.test.ts testes-integracao/bonus-publicar-processo.integracao.ts testes-integracao/bonus-publicar-repositorio.integracao.ts testes-integracao/bonus-apagar-carrossel.integracao.ts
```

```bash
git commit -F - <<'MSG'
A capa sai com a arte do Chat, e o publicar recusa a capa sem imagem e o gancho que não cabe nela

A capa vai à fila como os slides com foto: o navegador baixa a arte montada e
sobe a cópia em bonus-fila/. O Publicar trava enquanto a capa não tem a imagem
dela ou o gancho não cabe, e o servidor confere de novo antes da fila. Uma
imagem de outro jeito conta como a que falta, para a imagem da capa nunca sair
como slide pronto, e ligar ou trocar a capa no meio muda o conferido.
MSG
```

---

### FASE 8 — O card do slide 1 ganha a capa

**Arquivos:**
- Modificar: `app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx`,
  `app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx`, `app/bonus/[id]/carrossel/[cid]/gerar-imagem.tsx`,
  `app/bonus/[id]/carrossel/[cid]/revisao.tsx`, `lib/bonus/arte-cabimento.ts`, `lib/bonus/arte-textos.ts`
- Criar: `testes-dom/bonus-capa-card.dom.tsx`
- Testar: `tests/bonus-capa-paginas.test.ts`

**Interfaces:**
- Consome: as props `capa` e `capaInicial` (FASE 7), `tamanhoDaCapa` (FASE 2), o destino `capa` (FASE 5) e o
  formato da imagem (FASE 6).
- Produz: `avisoDaCapa(total, valores)` e `TEXTO_GANCHO_NAO_CABE_NA_CAPA` ("O gancho não cabe na capa. Encurte
  o texto."); as props do card `podeTerCapa` e `aoMudarCapa`; a caixa "Capa com imagem", com o nome
  acessível "Slide N: capa com imagem, a imagem no slide inteiro e o gancho grande por cima"; os botões
  "Subir foto da capa" / "Trocar foto da capa" e "Gerar com IA"; e o `rotulo` do `GerarImagem`.

- [ ] **Passo 1: os testes**

Crie `testes-dom/bonus-capa-card.dom.tsx`:

```tsx
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EditorDoCarrossel from "@/app/bonus/[id]/carrossel/[cid]/editor-do-carrossel";
import type { PublicacaoNaTela } from "@/app/bonus/[id]/carrossel/[cid]/publicacao-na-tela";
import { urlDaArte } from "@/lib/bonus/arte-tela";
import type { AvisoDaArte } from "@/lib/bonus/arte-textos";
import { camposDoFormulario } from "@/lib/bonus/carrossel-texto";
import type { AvisoDaImagem, RespostaDaAssinatura } from "@/lib/bonus/publicar-textos";

// A CAPA NA TELA (spec da Etapa 11, "A tela"): a caixa "Capa com imagem" só no slide 1 do carrossel de 2
// slides ou mais; ligar a capa tira o "Só texto" do slide 1, e o "Só texto" nele desliga a capa, gravados
// juntos e devolvidos juntos na recusa; com a capa, os botões da imagem são os da capa, a miniatura é a arte
// da capa, o aviso é o do gancho que não cabe nela, e o "Publicar" trava sem a imagem da capa. As actions
// são falsas; o `createImageBitmap`, o canvas e o `fetch` também.

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
const CAPA = "https://bucket/public/178/bonus-capa/guardada.jpg";
const PRONTO = "https://bucket/public/178/bonus/guardada.jpg";

let puts: string[];

beforeEach(() => {
  puts = [];
  vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 1080, height: 1350, close: () => {} })));
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () => ({ fillStyle: "", fillRect: () => {}, drawImage: () => {} }) as unknown as CanvasRenderingContext2D
  );
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((fn) => fn(new Blob(["jpeg"], { type: "image/jpeg" })));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      puts.push(url);
      return new Response("{}", { status: 200 });
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderizar({
  total = 3,
  valores = VALORES as Record<string, string>,
  soTexto = [] as number[],
  capa = false,
  imagens = {} as PublicacaoNaTela["imagens"],
  arte = [] as AvisoDaArte[],
  gerando = [] as number[],
} = {}) {
  const recebidos = { arte: [] as FormData[], assinar: [] as unknown[] };
  const publicacao: PublicacaoNaTela = {
    acaoDaAssinatura: async (p: unknown): Promise<RespostaDaAssinatura> => {
      recebidos.assinar.push(p);
      return { ok: true, caminho: "178/bonus-capa/nova.jpg", url: "https://bucket/sign/178/bonus-capa/nova.jpg?token=t" };
    },
    acaoDaImagem: async (): Promise<AvisoDaImagem> => ({
      tom: "ok",
      texto: "Imagem guardada.",
      em: 1,
      versao: "t1",
      imagem: "https://bucket/public/178/bonus-capa/nova.jpg",
      jeito: "capa",
      versaoDaMiniatura: "a2-capa",
    }),
    acaoDaPublicacao: async () => ({ tom: "ok", texto: "Na fila.", em: 1 }),
    imagens,
    versoesDoTexto: ["t1", "t2", "t3"],
    travado: null,
    origem: "gravada",
    arroba: "thiagovannuchi",
    estado: { texto: null, tom: null, filaId: null, livre: true },
    avisoDoCalendario: null,
    imagemGerada: { acaoDoPedido: async () => ({ tom: "ok", texto: "Gerando.", em: 1, hoje: 1 }), hoje: 0, descricoes: {}, gerando },
  };
  render(
    <EditorDoCarrossel
      acaoDoSlide={async () => null}
      acaoDaArte={async (_a, f) => {
        recebidos.arte.push(f);
        return arte.shift() ?? null;
      }}
      acaoDaConta={async () => null}
      caminho={CAMINHO}
      carrosselId={CARROSSEL}
      palavra="SUMIDO"
      total={total}
      campos={camposDoFormulario(total)}
      valores={valores}
      rotuloDaConta="Thiago Vannuchi (@thiagovannuchi)"
      avisoDaConta={null}
      podeFixar={false}
      soTextoInicial={soTexto}
      capaInicial={capa}
      versoes={Array.from({ length: total }, (_, i) => `v${i + 1}`)}
      pausaMs={0}
      intervaloDaConsultaMs={1}
      publicacao={publicacao}
    />
  );
  return recebidos;
}

const NOME_DA_CAPA = (n: number) => `Slide ${n}: capa com imagem, a imagem no slide inteiro e o gancho grande por cima`;
const caixaDaCapa = () => screen.getByLabelText(NOME_DA_CAPA(1)) as HTMLInputElement;
const soTexto1 = () => screen.getByLabelText("Slide 1: só texto, sem o espaço da imagem") as HTMLInputElement;
const card = (n: number) => screen.getAllByRole("listitem")[n - 1];
const ok = (versoes: string[]): AvisoDaArte => ({ tom: "ok", texto: "Arte salva.", em: 1, versoes });

describe("a caixa da capa", () => {
  it("só no slide 1 do carrossel", () => {
    renderizar();
    expect(caixaDaCapa().checked).toBe(false);
    expect(screen.queryByLabelText(NOME_DA_CAPA(2))).toBeNull();
    expect(screen.queryByLabelText(NOME_DA_CAPA(3))).toBeNull();
  });

  it("o post de uma imagem só não tem a capa (achado 98)", () => {
    renderizar({
      total: 1,
      valores: { texto: "Quem sumiu ainda pode voltar, se a mensagem certa chegar na hora certa.", chamada: "Comente SUMIDO.", legenda: VALORES.legenda },
    });
    expect(screen.queryByLabelText(NOME_DA_CAPA(1))).toBeNull();
  });

  it("ligar a capa grava a capa junto do só texto, e tira o Só texto do slide 1", async () => {
    const recebidos = renderizar({ soTexto: [1, 3], arte: [ok(["capa1", "v2", "v3"])] });
    await act(async () => {
      fireEvent.click(caixaDaCapa());
    });
    expect(recebidos.arte.map((f) => [f.getAll("so_texto"), f.get("capa")])).toEqual([[["3"], "1"]]);
    expect(caixaDaCapa().checked).toBe(true);
    expect(soTexto1().checked).toBe(false);
    expect((screen.getByAltText("Slide 1 de 3") as HTMLImageElement).getAttribute("src")).toBe(urlDaArte(CAMINHO, 1, "capa1"));
  });

  it("marcar o Só texto no slide 1 desliga a capa", async () => {
    const recebidos = renderizar({ capa: true, arte: [ok(["s1", "v2", "v3"])] });
    await act(async () => {
      fireEvent.click(soTexto1());
    });
    expect(recebidos.arte.map((f) => [f.getAll("so_texto"), f.get("capa")])).toEqual([[["1"], null]]);
    expect(caixaDaCapa().checked).toBe(false);
  });

  it("na recusa, a capa e o só texto voltam juntos para a última escolha aceita", async () => {
    renderizar({ soTexto: [1], arte: [{ tom: "erro", texto: "O post de uma imagem só não tem capa: ele não tem gancho.", em: 2 }] });
    await act(async () => {
      fireEvent.click(caixaDaCapa());
    });
    expect(caixaDaCapa().checked).toBe(false);
    expect(soTexto1().checked).toBe(true);
    expect(screen.getByText("O post de uma imagem só não tem capa: ele não tem gancho.")).toBeTruthy();
  });
});

describe("o card do slide 1 em capa", () => {
  it("os botões são os da capa; os do espaço ficam nos outros slides", () => {
    renderizar({ capa: true });
    expect(within(card(1)).getByText("Subir foto da capa")).toBeTruthy();
    expect(within(card(1)).getByText("Gerar com IA")).toBeTruthy();
    expect(within(card(1)).queryByText("Subir foto")).toBeNull();
    expect(within(card(1)).queryByText("Slide pronto do Canva")).toBeNull();
    expect(within(card(2)).getByText("Subir foto")).toBeTruthy();
    expect(within(card(2)).getByText("Gerar imagem")).toBeTruthy();
  });

  it("subir a foto da capa assina no destino da capa, e a miniatura troca pela versão devolvida", async () => {
    const recebidos = renderizar({ capa: true });
    const entrada = screen.getByLabelText("Slide 1: foto da capa") as HTMLInputElement;
    await act(async () => {
      fireEvent.change(entrada, { target: { files: [new File(["x"], "capa.jpg", { type: "image/jpeg" })] } });
    });
    expect(recebidos.assinar).toMatchObject([{ id: CARROSSEL, numero: 1, destino: "capa" }]);
    expect(puts).toEqual(["https://bucket/sign/178/bonus-capa/nova.jpg?token=t"]);
    expect((screen.getByAltText("Slide 1 de 3") as HTMLImageElement).getAttribute("src")).toBe(urlDaArte(CAMINHO, 1, "a2-capa"));
    expect(within(card(1)).getByText("Trocar foto da capa")).toBeTruthy();
  });

  it("a imagem gerada por IA na capa entra como a da capa: o card passa a trocar a foto da capa", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ estado: "pronta", hoje: 2, versao: "t1", versaoDaMiniatura: "a3-capa" }), { status: 200 }))
    );
    renderizar({ capa: true, gerando: [1] });
    await waitFor(() =>
      expect((screen.getByAltText("Slide 1 de 3") as HTMLImageElement).getAttribute("src")).toBe(urlDaArte(CAMINHO, 1, "a3-capa"))
    );
    expect(within(card(1)).getByText("Trocar foto da capa")).toBeTruthy();
  });

  it("a miniatura da capa é a arte, mesmo com um slide pronto guardado no slide 1", () => {
    renderizar({ capa: true, imagens: { 1: { url: PRONTO, versao: "t1", jeito: "slide" } } });
    expect((screen.getByAltText("Slide 1 de 3") as HTMLImageElement).getAttribute("src")).toBe(urlDaArte(CAMINHO, 1, "v1"));
  });

  it("sem a capa, a imagem da capa guardada não vira a miniatura nem a imagem do slide", () => {
    renderizar({ imagens: { 1: { url: CAPA, versao: "t1", jeito: "capa" } } });
    expect((screen.getByAltText("Slide 1 de 3") as HTMLImageElement).getAttribute("src")).toBe(urlDaArte(CAMINHO, 1, "v1"));
    expect(within(card(1)).getByText("Subir foto")).toBeTruthy();
  });

  it("o gancho que não cabe na capa avisa no card, e o Publicar trava", () => {
    renderizar({ capa: true, valores: { ...VALORES, gancho: "Desinconstitucionalissimamente proibido" } });
    expect(within(card(1)).getAllByText("O gancho não cabe na capa. Encurte o texto.").length).toBeGreaterThan(0);
    expect((screen.getByRole("button", { name: "Publicar" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("a capa sem imagem trava o Publicar com a falta da imagem do slide 1", () => {
    renderizar({
      capa: true,
      imagens: { 2: { url: PRONTO, versao: "t2", jeito: "slide" }, 3: { url: PRONTO, versao: "t3", jeito: "slide" } },
    });
    expect(screen.getByText("Falta a imagem do slide 1.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Publicar" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("com a imagem da capa, nada falta", () => {
    renderizar({
      capa: true,
      imagens: {
        1: { url: CAPA, versao: "t1", jeito: "capa" },
        2: { url: PRONTO, versao: "t2", jeito: "slide" },
        3: { url: PRONTO, versao: "t3", jeito: "slide" },
      },
    });
    expect(screen.queryByText(/Falta a imagem/)).toBeNull();
    expect((screen.getByRole("button", { name: "Publicar" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
```

Em `tests/bonus-capa-paginas.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-capa-paginas.test.ts b/tests/bonus-capa-paginas.test.ts
index 7fde946..7c54132 100644
--- a/tests/bonus-capa-paginas.test.ts
+++ b/tests/bonus-capa-paginas.test.ts
@@ -77,6 +77,12 @@ describe("a capa passa da página ao card do Publicar", () => {
     expect(ler(`${PASTA}/revisao.tsx`)).toContain("capaInicial={escolhas.capa}");
   });
 
+  // O jeito de cada imagem é o prefixo do caminho: pelas fotos, a imagem da capa sairia como slide pronto,
+  // e o card do slide 1 em capa a daria como a que falta.
+  it("a página lê o jeito de cada imagem pelo caminho, para a imagem da capa ser a da capa", () => {
+    expect(ler(`${PASTA}/revisao.tsx`)).toContain('jeito: jeitoDoCaminho(i.caminho) ?? "slide"');
+  });
+
   it("o editor passa a capa ao card do Publicar e ao card do slide 1", () => {
     const editor = ler(`${PASTA}/editor-do-carrossel.tsx`);
     expect(editor).toContain("capa={capa}");
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run --config vitest.dom.config.ts testes-dom/bonus-capa-card.dom.tsx
npx vitest run tests/bonus-capa-paginas.test.ts
```

Esperado: na tela, 9 caem e 4 passam (13): o card ainda não tem a caixa nem os botões da capa. Na guarda, 1 cai e
11 passam (12): a página ainda lê o jeito pelas fotos.

- [ ] **Passo 3: o código**

Em `lib/bonus/arte-textos.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/arte-textos.ts b/lib/bonus/arte-textos.ts
index d15911a..c5984e5 100644
--- a/lib/bonus/arte-textos.ts
+++ b/lib/bonus/arte-textos.ts
@@ -54,6 +54,9 @@ export function textoNaoCabeNunca(numero: number): string {
   return `O slide ${numero} não cabe nem sem o espaço da imagem. Encurte o texto.`;
 }
 
+/** O gancho que não cabe na capa nem no menor degrau (spec da Etapa 11): só encurtar resolve. */
+export const TEXTO_GANCHO_NAO_CABE_NA_CAPA = "O gancho não cabe na capa. Encurte o texto.";
+
 /** De onde veio a conta do cabeçalho (arte-conta.ts). A do carrossel, conectada, não precisa de aviso. */
 export function textoDaOrigemDaConta(origem: OrigemDaConta, arroba: string): string | null {
   switch (origem) {
```

Em `lib/bonus/arte-cabimento.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/arte-cabimento.ts b/lib/bonus/arte-cabimento.ts
index 94d3c0c..c40fc62 100644
--- a/lib/bonus/arte-cabimento.ts
+++ b/lib/bonus/arte-cabimento.ts
@@ -6,7 +6,8 @@
 // (tests/vetores-da-arte.json); onde o Satori também quebra dentro da palavra, ela só erra para o lado
 // seguro.
 import { slidesDoTexto, slidesQueNaoCabem } from "./arte-slides";
-import { textoNaoCabeComEspaco, textoNaoCabeNunca } from "./arte-textos";
+import { TEXTO_GANCHO_NAO_CABE_NA_CAPA, textoNaoCabeComEspaco, textoNaoCabeNunca } from "./arte-textos";
+import { tamanhoDaCapa } from "./capa-medida";
 import { slidesDeConteudo } from "./carrossel-pedido";
 import { camposDaParte, type TextoDoCarrossel } from "./carrossel-texto";
 
@@ -61,3 +62,13 @@ export function avisosDeCabimento(total: number, valores: Record<string, string>
   }
   return avisos;
 }
+
+/**
+ * O AVISO DA CAPA (spec da Etapa 11): o gancho que está no campo agora, em maiúscula e pela conta da capa
+ * (`tamanhoDaCapa`), que não cabe nem no menor degrau. Na capa, o "Só texto" não resolve: só encurtar.
+ * `undefined` quando cabe.
+ */
+export function avisoDaCapa(total: number, valores: Record<string, string>): string | undefined {
+  const [gancho] = slidesDoTexto(textoDosCampos(total, valores));
+  return gancho && !tamanhoDaCapa(gancho).cabe ? TEXTO_GANCHO_NAO_CABE_NA_CAPA : undefined;
+}
```

Em `app/bonus/[id]/carrossel/[cid]/gerar-imagem.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/[id]/carrossel/[cid]/gerar-imagem.tsx b/app/bonus/[id]/carrossel/[cid]/gerar-imagem.tsx
index a9035dd..177188a 100644
--- a/app/bonus/[id]/carrossel/[cid]/gerar-imagem.tsx
+++ b/app/bonus/[id]/carrossel/[cid]/gerar-imagem.tsx
@@ -55,6 +55,7 @@ export default function GerarImagem({
   numero,
   gerador,
   aoMudarGerando,
+  rotulo = "Gerar imagem",
 }: {
   caminho: string;
   carrosselId: string;
@@ -62,6 +63,8 @@ export default function GerarImagem({
   gerador: GeradorDoSlide;
   /** Avisa o card quando a geração começa ou termina: os outros botões da imagem ficam desligados. */
   aoMudarGerando: (gerando: boolean) => void;
+  /** O rótulo antes do primeiro pedido: "Gerar imagem", ou "Gerar com IA" na capa (Etapa 11). */
+  rotulo?: string;
 }) {
   const [aberto, setAberto] = useState(false);
   const [inicial] = useState(() => separarEstiloDaDescricao(gerador.descricaoInicial ?? ""));
@@ -145,7 +148,7 @@ export default function GerarImagem({
   return (
     <>
       <button type="button" aria-expanded={aberto} onClick={() => setAberto(!aberto)} className={`${btnSecondary} whitespace-nowrap`}>
-        {jaPediu ? "Gerar de novo" : "Gerar imagem"}
+        {jaPediu ? "Gerar de novo" : rotulo}
       </button>
       {(aberto || aviso) && (
         <div className="order-last basis-full space-y-2">
```

Em `app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx b/app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx
index 39f548d..d838f7c 100644
--- a/app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx
+++ b/app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx
@@ -2,7 +2,7 @@
 import { useActionState, useEffect, useMemo, useState, useTransition, type ChangeEvent } from "react";
 import { badgeWarn, btnPrimary, btnSecondary, card, hint } from "@/app/ui";
 import AvisoDoFormulario from "@/app/bonus/aviso-do-formulario";
-import { avisosDeCabimento, campoDoAviso } from "@/lib/bonus/arte-cabimento";
+import { avisoDaCapa, avisosDeCabimento, campoDoAviso } from "@/lib/bonus/arte-cabimento";
 import { urlDaArte } from "@/lib/bonus/arte-tela";
 import type { CampoDoCarrossel, ParteDoCarrossel } from "@/lib/bonus/carrossel-texto";
 import type { AvisoDoSlide } from "@/lib/bonus/carrossel-textos";
@@ -44,6 +44,11 @@ import type { ImagemNaTela } from "./publicacao-na-tela";
 // como uma foto, e enquanto ela gera os outros botões da imagem deste slide ficam desligados.
 // Com o carrossel na fila ou publicado (`travado`), o card fica só para leitura: sem "Editar", sem
 // upload, e o "Só texto" desligado. A trava vale no servidor; aqui ela só se mostra.
+//
+// A CAPA (spec da Etapa 11), só no slide 1 de um carrossel de 2 slides ou mais: a caixa "Capa com imagem"
+// ao lado do "Só texto" (marcar um desmarca o outro, no editor). Com ela ligada, os botões da imagem são
+// "Subir foto da capa" e "Gerar com IA" (o mesmo gerador, em pé), a miniatura é a arte da capa (o fundo
+// escuro antes da imagem) e o aviso é o do gancho que não cabe na capa.
 export default function CardDaParte({
   acao,
   caminho,
@@ -57,6 +62,8 @@ export default function CardDaParte({
   aoNovaVersao,
   soTexto,
   capa = false,
+  podeTerCapa = false,
+  aoMudarCapa,
   aoMudarSoTexto,
   soTextoPendente,
   imagem = null,
@@ -98,6 +105,10 @@ export default function CardDaParte({
   gerarImagem?: GeradorDoSlide | null;
   /** O slide 1 em "Capa com imagem" (Etapa 11). O editor o passa em cada card de slide. */
   capa?: boolean;
+  /** Este card oferece a capa: o slide 1 de um carrossel de 2 slides ou mais (achado 98). */
+  podeTerCapa?: boolean;
+  /** Liga ou desliga a capa; o editor grava junto do "só texto". */
+  aoMudarCapa?: (marcada: boolean) => void;
 }) {
   const doCard = (v: Record<string, string>) => Object.fromEntries(campos.map((c) => [c.nome, v[c.nome] ?? ""]));
   const [atuais, setAtuais] = useState(() => doCard(valores));
@@ -124,9 +135,15 @@ export default function CardDaParte({
     aoMudarNaoSalvo?.(naoSalvo);
   }, [naoSalvo, aoMudarNaoSalvo]);
   const campoDoNaoCabe = numero ? campoDoAviso(numero, total) : null;
+  // Na capa, o aviso é o do gancho pela conta da capa (Etapa 11); no resto, o de hoje.
   const naoCabe = useMemo(
-    () => (numero && campoDoNaoCabe ? avisosDeCabimento(total, atuais, soTexto ? [numero] : [])[campoDoNaoCabe] : undefined),
-    [numero, campoDoNaoCabe, total, atuais, soTexto]
+    () =>
+      numero && campoDoNaoCabe
+        ? capa
+          ? avisoDaCapa(total, atuais)
+          : avisosDeCabimento(total, atuais, soTexto ? [numero] : [])[campoDoNaoCabe]
+        : undefined,
+    [numero, campoDoNaoCabe, total, atuais, soTexto, capa]
   );
   const jeito = imagem?.jeito ?? null;
   const corte = useMemo(
@@ -136,8 +153,10 @@ export default function CardDaParte({
   useEffect(() => {
     aoMudarCorte?.(corte);
   }, [corte, aoMudarCorte]);
-  // Marcado "Só texto", o slide sai com a arte do Chat: a imagem guardada fica, mas não se usa.
-  const comImagem = numero !== null && !soTexto ? imagem : null;
+  // Marcado "Só texto", o slide sai com a arte do Chat: a imagem guardada fica, mas não se usa. E a imagem
+  // de outro jeito também não (Etapa 11): na capa, só a da capa; fora dela, a da capa não conta.
+  const valeAqui = imagem !== null && (capa ? imagem.jeito === "capa" : imagem.jeito !== "capa");
+  const comImagem = numero !== null && !soTexto && valeAqui ? imagem : null;
   // O aviso é só do slide pronto: com a foto no espaço, a arte se redesenha com o texto novo.
   const desatualizada = comImagem?.jeito === "slide" && versaoDoTextoSalvo !== null && comImagem.versao !== versaoDoTextoSalvo;
   const podeSubir = enviarImagem !== null && !soTexto && travado === null;
@@ -155,14 +174,23 @@ export default function CardDaParte({
   /** O botão de um jeito: o rótulo diz se o slide já tem uma imagem daquele jeito. */
   const botaoDeImagem = (jeito: JeitoDaImagem) => {
     const tem = imagem?.jeito === jeito;
-    const rotulo = jeito === "foto" ? (tem ? "Trocar foto" : "Subir foto") : tem ? "Trocar slide pronto" : "Slide pronto do Canva";
+    const rotulo = {
+      foto: tem ? "Trocar foto" : "Subir foto",
+      slide: tem ? "Trocar slide pronto" : "Slide pronto do Canva",
+      capa: tem ? "Trocar foto da capa" : "Subir foto da capa",
+    }[jeito];
+    const nome = {
+      foto: `Slide ${numero}: foto para o espaço da arte`,
+      slide: `Slide ${numero}: slide pronto do Canva`,
+      capa: `Slide ${numero}: foto da capa`,
+    }[jeito];
     return (
       <label className={`${btnSecondary} cursor-pointer whitespace-nowrap`}>
         {enviando && jeitoEnviado === jeito ? "Subindo…" : rotulo}
         <input
           type="file"
           accept="image/jpeg,image/png,image/webp"
-          aria-label={jeito === "foto" ? `Slide ${numero}: foto para o espaço da arte` : `Slide ${numero}: slide pronto do Canva`}
+          aria-label={nome}
           className="sr-only"
           disabled={enviando || gerandoImagem}
           onChange={(e) => aoEscolherImagem(e, jeito)}
@@ -195,6 +223,18 @@ export default function CardDaParte({
               />
               Só texto
             </label>
+            {podeTerCapa && (
+              <label className="flex items-center gap-2 text-sm">
+                <input
+                  type="checkbox"
+                  aria-label={`Slide ${numero}: capa com imagem, a imagem no slide inteiro e o gancho grande por cima`}
+                  checked={capa}
+                  disabled={soTextoPendente || travado !== null}
+                  onChange={(e) => aoMudarCapa?.(e.target.checked)}
+                />
+                Capa com imagem
+              </label>
+            )}
             {naoCabe && <p className="text-xs font-medium text-fecha dark:text-fecha-escuro">{naoCabe}</p>}
             {desatualizada && <p className="text-xs font-medium text-fecha dark:text-fecha-escuro">{TEXTO_TEXTO_MUDOU}</p>}
           </div>
@@ -248,8 +288,9 @@ export default function CardDaParte({
           quebra. O nome acessível do "Baixar" continua dizendo o slide. */}
       {numero !== null && versao !== null && (
         <div className="mt-3 flex flex-wrap items-center gap-2">
-          {podeSubir && botaoDeImagem("foto")}
-          {podeSubir && botaoDeImagem("slide")}
+          {podeSubir && !capa && botaoDeImagem("foto")}
+          {podeSubir && !capa && botaoDeImagem("slide")}
+          {podeSubir && capa && botaoDeImagem("capa")}
           {podeSubir && gerarImagem && (
             <GerarImagem
               caminho={caminho}
@@ -257,6 +298,7 @@ export default function CardDaParte({
               numero={numero}
               gerador={gerarImagem}
               aoMudarGerando={setGerandoImagem}
+              rotulo={capa ? "Gerar com IA" : "Gerar imagem"}
             />
           )}
           <a
```

Em `app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx b/app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx
index 57d014a..c1d77ee 100644
--- a/app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx
+++ b/app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx
@@ -28,7 +28,9 @@ import type { ImagemGeradaNaTela, ImagemNaTela, PublicacaoNaTela } from "./publi
 // O "SÓ TEXTO" se grava na hora, pela action da arte, e a resposta traz as versões das miniaturas. A
 // escolha muda na tela antes da resposta, para a caixa responder ao clique; numa recusa, volta para a
 // última aceita (achado 67), porque a miniatura e o "Baixar" seguem o que está gravado. O formulário é
-// montado aqui e despachado numa transição, sem `<form action>` (medido no PR #5).
+// montado aqui e despachado numa transição, sem `<form action>` (medido no PR #5). A CAPA do slide 1
+// (spec da Etapa 11) vai no mesmo formulário: ligar a capa tira o "Só texto" do slide 1, e marcar o "Só
+// texto" nele desliga a capa; na recusa, os dois voltam juntos.
 //
 // A PUBLICAÇÃO (spec da Etapa 5) entra por `publicacao`, e sem ela a página é a da Etapa 4. As imagens
 // guardadas moram aqui, de um dos dois jeitos (a foto do espaço ou o slide pronto), e cada card sobe a
@@ -103,15 +105,19 @@ export default function EditorDoCarrossel({
   }, []);
   const [soTexto, setSoTexto] = useState(soTextoInicial);
   const aceito = useRef(soTextoInicial);
-  const [capa] = useState(capaInicial);
+  // A CAPA (spec da Etapa 11) se grava pela mesma action do "só texto", e volta junto com ele na recusa.
+  const [capa, setCapa] = useState(capaInicial);
+  const capaAceita = useRef(capaInicial);
   const [respostaDaArte, despacharArte, artePendente] = useActionState(
     async (anterior: AvisoDaArte | null, form: FormData) => {
       const r = await acaoDaArte(anterior, form);
       if (r?.tom === "ok") {
         aceito.current = form.getAll("so_texto").map(Number);
+        capaAceita.current = form.get("capa") === "1";
         if (r.versoes) setVersoes(r.versoes);
       } else if (r?.tom === "erro") {
         setSoTexto(aceito.current);
+        setCapa(capaAceita.current);
       }
       return r;
     },
@@ -128,15 +134,28 @@ export default function EditorDoCarrossel({
     return campos.filter((c) => nomes.includes(c.nome));
   };
 
-  function mudarSoTexto(numero: number, marcado: boolean) {
-    const novo = marcado ? [...soTexto, numero].sort((a, b) => a - b) : soTexto.filter((n) => n !== numero);
-    setSoTexto(novo);
+  /** Grava o "só texto" e a capa juntos: a action recebe sempre os dois, e nunca os dois no slide 1. */
+  function gravarArte(novoSoTexto: number[], novaCapa: boolean) {
+    setSoTexto(novoSoTexto);
+    setCapa(novaCapa);
     const form = new FormData();
     form.set("id", carrosselId);
-    for (const n of novo) form.append("so_texto", String(n));
+    for (const n of novoSoTexto) form.append("so_texto", String(n));
+    if (novaCapa) form.set("capa", "1");
     iniciar(() => despacharArte(form));
   }
 
+  function mudarSoTexto(numero: number, marcado: boolean) {
+    const novo = marcado ? [...soTexto, numero].sort((a, b) => a - b) : soTexto.filter((n) => n !== numero);
+    // Marcar "Só texto" no slide 1 desliga a capa: um jeito exclui o outro (spec da Etapa 11).
+    gravarArte(novo, marcado && numero === 1 ? false : capa);
+  }
+
+  /** Ligar a capa tira o "Só texto" do slide 1; desligar não mexe no resto. */
+  function mudarCapa(marcada: boolean) {
+    gravarArte(marcada ? soTexto.filter((n) => n !== 1) : soTexto, marcada);
+  }
+
   /**
    * Sobe a imagem de um slide, no jeito escolhido. Guardada, ela entra no card com o jeito que o
    * servidor leu do caminho, e a miniatura daquele slide ganha a versão nova.
@@ -163,7 +182,9 @@ export default function EditorDoCarrossel({
       descricaoInicial: g.descricoes[numero] ?? null,
       gerandoInicial: g.gerando.includes(numero),
       aoPronta: ({ versao, versaoDaMiniatura }) => {
-        setImagens((atuais) => ({ ...atuais, [numero]: { url: null, versao: versao ?? "", jeito: "foto" } }));
+        // Na capa (Etapa 11), a imagem gerada é a da capa; no resto, uma foto do espaço.
+        const jeito: JeitoDaImagem = capa && numero === 1 ? "capa" : "foto";
+        setImagens((atuais) => ({ ...atuais, [numero]: { url: null, versao: versao ?? "", jeito } }));
         setVersoes((vs) => vs.map((x, i) => (i === numero - 1 ? versaoDaMiniatura : x)));
       },
       intervaloMs: intervaloDaConsultaMs,
@@ -246,6 +267,8 @@ export default function EditorDoCarrossel({
               aoNovaVersao={(v) => setVersoes((vs) => vs.map((x, i) => (i === n - 1 ? v : x)))}
               soTexto={soTexto.includes(n)}
               capa={capa && n === 1}
+              podeTerCapa={n === 1 && total >= 2}
+              aoMudarCapa={mudarCapa}
               aoMudarSoTexto={(marcado) => mudarSoTexto(n, marcado)}
               soTextoPendente={artePendente}
               imagem={imagens[n] ?? null}
```

Em `app/bonus/[id]/carrossel/[cid]/revisao.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/[id]/carrossel/[cid]/revisao.tsx b/app/bonus/[id]/carrossel/[cid]/revisao.tsx
index 63df056..3d0961a 100644
--- a/app/bonus/[id]/carrossel/[cid]/revisao.tsx
+++ b/app/bonus/[id]/carrossel/[cid]/revisao.tsx
@@ -19,7 +19,7 @@ import { TEXTO_CARROSSEL_SEM_TEXTO } from "@/lib/bonus/carrossel-textos";
 import { imagensNasUltimas24h, ultimasDoCarrossel } from "@/lib/bonus/imagem-repositorio";
 import { estadoDaImagem } from "@/lib/bonus/imagem-regras";
 import { publicacaoLivre } from "@/lib/bonus/publicar-estado";
-import { capaDaArte, fotosDaArte, imagensDaArte, versaoDoTextoDoSlide } from "@/lib/bonus/publicar-regras";
+import { capaDaArte, fotosDaArte, imagensDaArte, jeitoDoCaminho, versaoDoTextoDoSlide } from "@/lib/bonus/publicar-regras";
 import { estadoDoCarrossel } from "@/lib/bonus/publicar-repositorio";
 import {
   textoDaTrava,
@@ -63,7 +63,8 @@ export default async function Revisao({ carrossel }: { carrossel: LinhaDoCarross
   const estado = await estadoDoCarrossel(carrossel.arte);
   const filaId = "filaId" in estado ? estado.filaId : null;
   const noMenu = contaSelecionada(contas, doCookie);
-  // O jeito de cada imagem é o prefixo do caminho (adendo da Etapa 5): as fotos são as de `bonus-foto`.
+  // O jeito de cada imagem é o prefixo do caminho (adendo da Etapa 5): as fotos são as de `bonus-foto`, e
+  // a capa, a de `bonus-capa` (Etapa 11). `imagensDaArte` só lê caminho com jeito.
   const fotos = fotosDaArte(carrossel.arte, carrossel.total_slides);
   const [{ agora, linhas: geradas }, hojeDeImagens] = await Promise.all([ultimasDoCarrossel(carrossel.id), imagensNasUltimas24h()]);
   const publicacao: PublicacaoNaTela = {
@@ -73,7 +74,7 @@ export default async function Revisao({ carrossel }: { carrossel: LinhaDoCarross
     imagens: Object.fromEntries(
       Object.entries(imagensDaArte(carrossel.arte, carrossel.total_slides)).map(([n, i]) => [
         n,
-        { url: urlPublicaSeDerParaMontar(i.caminho), versao: i.versao, jeito: Number(n) in fotos ? "foto" : "slide" },
+        { url: urlPublicaSeDerParaMontar(i.caminho), versao: i.versao, jeito: jeitoDoCaminho(i.caminho) ?? "slide" },
       ])
     ),
     versoesDoTexto: slidesDoTexto(texto).map(versaoDoTextoDoSlide),
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx eslint lib/bonus/arte-textos.ts lib/bonus/arte-cabimento.ts "app/bonus/[id]/carrossel/[cid]/gerar-imagem.tsx" "app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx" "app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx" "app/bonus/[id]/carrossel/[cid]/revisao.tsx" testes-dom/bonus-capa-card.dom.tsx tests/bonus-capa-paginas.test.ts
npm run test:dom
npm test
```

Esperado: `tsc` e lint limpos; 28 arquivos e 279 casos de tela, e 136 arquivos e 3 523 casos puros.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/arte-textos.ts lib/bonus/arte-cabimento.ts "app/bonus/[id]/carrossel/[cid]/gerar-imagem.tsx" "app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx" "app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx" "app/bonus/[id]/carrossel/[cid]/revisao.tsx" testes-dom/bonus-capa-card.dom.tsx tests/bonus-capa-paginas.test.ts
test "$(git branch --show-current)" = "capa-do-carrossel"
git add lib/bonus/arte-textos.ts lib/bonus/arte-cabimento.ts "app/bonus/[id]/carrossel/[cid]/gerar-imagem.tsx" "app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx" "app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx" "app/bonus/[id]/carrossel/[cid]/revisao.tsx" testes-dom/bonus-capa-card.dom.tsx tests/bonus-capa-paginas.test.ts
```

```bash
git commit -F - <<'MSG'
O card do slide 1 ganha a Capa com imagem, com os botões, a miniatura e o aviso dela

O card do slide 1 de um carrossel de 2 slides ou mais oferece a capa. Ligada,
ela troca os botões da imagem por Subir foto da capa e Gerar com IA, mostra a
miniatura da capa e avisa quando o gancho não cabe nela. Ligar a capa desliga
o Só texto do slide 1, e o contrário também, e a recusa do servidor devolve os
dois ao que estava gravado.
MSG
```

---

### FASE 9 — O apagar leva a imagem da capa

**Arquivos:**
- Testar: `tests/bonus-apagar-regras.test.ts`, `testes-integracao/bonus-apagar-carrossel.integracao.ts`

O código já veio na FASE 1: o apagar lê o jeito pelo prefixo do caminho (`caminhosDoCarrossel`, com
`jeitoDoCaminho` e `ehCaminhoDoDestino`), e `bonus-capa/` entrou nele ali. Esta fase só prende isso com
casos, e a prova de que eles caem sem o código é a mutação da FASE 9 do Apêndice A.

- [ ] **Passo 1: os testes**

Em `tests/bonus-apagar-regras.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-apagar-regras.test.ts b/tests/bonus-apagar-regras.test.ts
index 10afac0..a24d441 100644
--- a/tests/bonus-apagar-regras.test.ts
+++ b/tests/bonus-apagar-regras.test.ts
@@ -150,4 +150,13 @@ describe("os arquivos que saem do bucket depois do commit", () => {
   it("a publicação estranha não apaga nada da fila", () => {
     expect(caminhosDoCarrossel({ conta: CONTA, publicacao: { chave: "k" } }, 5, CONTA)).toEqual([]);
   });
+
+  // A CAPA (Etapa 11): a imagem dela mora em `bonus-capa/` e sai com o carrossel, como a foto e o slide
+  // pronto. A que ficou guardada depois de a capa ser desligada também sai: o arquivo é do carrossel.
+  it("a imagem da capa sai também, ligada ou não; a capa de outra conta fica", () => {
+    const CAPA = `${CONTA}/bonus-capa/${u(8)}.jpg`;
+    const imagens = { "1": { caminho: CAPA, versao: "v" }, "2": { caminho: `99999/bonus-capa/${u(9)}.jpg`, versao: "v" } };
+    expect(caminhosDoCarrossel({ conta: CONTA, capa: true, imagens }, 5, CONTA)).toEqual([CAPA]);
+    expect(caminhosDoCarrossel({ conta: CONTA, imagens }, 5, CONTA)).toEqual([CAPA]);
+  });
 });
```

Em `testes-integracao/bonus-apagar-carrossel.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/bonus-apagar-carrossel.integracao.ts b/testes-integracao/bonus-apagar-carrossel.integracao.ts
index cc3d747..0289d63 100644
--- a/testes-integracao/bonus-apagar-carrossel.integracao.ts
+++ b/testes-integracao/bonus-apagar-carrossel.integracao.ts
@@ -244,6 +244,17 @@ describe("apagar um rascunho", () => {
     await imagemGerada(id, "gerando", 211_000);
     expect(await apagar.apagarCarrossel(id)).toEqual({ ok: true });
   });
+
+  // A CAPA (Etapa 11): a imagem dela, em `bonus-capa/`, sai do bucket com o carrossel.
+  it("a imagem da capa sai do bucket com o carrossel", async () => {
+    const CAPA = `${CONTA}/bonus-capa/${u(4)}.jpg`;
+    const id = await carrossel({ arte: { ...ARTE, capa: true, imagens: { "1": { caminho: CAPA, versao: "v" } } } });
+    noBucket(CAPA, ALHEIO);
+    expect(await apagar.apagarCarrossel(id)).toEqual({ ok: true });
+    expect(await existe(id)).toBe(false);
+    expect([...bucket.objetos.keys()]).toEqual([ALHEIO]);
+    expect(bucket.chamadas).toEqual([`apagou ${CAPA}`]);
+  });
 });
 
 describe("as recusas, sem apagar nada nem tocar no bucket", () => {
```

- [ ] **Passo 2: ver passar, e ver cair sem o jeito da capa**

```bash
npx vitest run tests/bonus-apagar-regras.test.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-apagar-carrossel.integracao.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" node "$SCRATCH/mutar-capa.mjs" "9:"
git status --short
```

Esperado: os 33 puros passam; na integração, `[rede-global] ALVO: banco de TESTE`, os 24. As duas mutações da FASE 9 com ✓ ("2 mutações, 0 ruins"), e só os dois arquivos de
teste no `git status`.

- [ ] **Passo 3: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" tests/bonus-apagar-regras.test.ts testes-integracao/bonus-apagar-carrossel.integracao.ts
test "$(git branch --show-current)" = "capa-do-carrossel"
git add tests/bonus-apagar-regras.test.ts testes-integracao/bonus-apagar-carrossel.integracao.ts
```

```bash
git commit -F - <<'MSG'
O apagar leva também a imagem da capa, ligada ou não, e só a da conta do carrossel

O apagar já lia o jeito pelo prefixo do caminho, e bonus-capa/ entrou nele na
primeira fase. Os casos novos prendem isso: a imagem da capa sai do bucket com
o carrossel, também a que ficou depois de a capa ser desligada, e a de outra
conta fica.
MSG
```

---

### FASE 10 — A verificação inteira

- [ ] **Passo 1: o verify**

```bash
env -u CLAUDECODE -u AI_AGENT npm run verify
git diff --stat AGENTS.md
```

Esperado: lint e `tsc` limpos; 136 arquivos e 3 524 casos puros e 28 arquivos e 279 de tela; a varredura "SEM VAZAMENTO em A
nem em C, nas duas varreduras"; o build (Turbopack) com "MIGRAÇÃO PULADA" e as rotas `ƒ /bonus/[id]/carrossel/[cid]`,
`ƒ /bonus/[id]/carrossel/[cid]/arte`, `ƒ /bonus/[id]/carrossel/[cid]/imagem`, `ƒ /carrosseis/[cid]`,
`ƒ /carrosseis/[cid]/arte` e `ƒ /carrosseis/[cid]/imagem`; o `AGENTS.md` sem diferença.

- [ ] **Passo 2: a integração inteira, no container**

```bash
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npm run test:integracao
```

Esperado: `[rede-global] ALVO: banco de TESTE`; 52 arquivos, 600 passaram e 8 pularam.

- [ ] **Passo 3: as provas de mutação**

Copie o script do Apêndice A para `$SCRATCH/mutar-capa.mjs` e rode, da raiz:

```bash
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" node "$SCRATCH/mutar-capa.mjs"
git status --short
```

Esperado: as 71 com ✓, "71 mutações, 0 ruins", e a árvore limpa depois.

- [ ] **Passo 4: a guarda do diff**

```bash
git diff --name-only 1fe61b8 -- . ':!docs'
git diff --stat 1fe61b8 -- app/publicar app/api lib/publicacao.ts lib/queue-drain.ts lib/engine.ts lib/bucket.ts lib/db.ts lib/esquema.ts app/automacoes lib/bonus/arte-geometria.ts tests/vetores-da-arte.json migrations scripts package.json package-lock.json next.config.ts proxy.ts AGENTS.md CLAUDE.md
```

Esperado: na primeira, só os 58 arquivos do mapa:

```text
app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx
app/bonus/[id]/carrossel/[cid]/card-publicar.tsx
app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx
app/bonus/[id]/carrossel/[cid]/gerar-imagem.tsx
app/bonus/[id]/carrossel/[cid]/imagem-no-navegador.ts
app/bonus/[id]/carrossel/[cid]/revisao.tsx
app/bonus/carrossel-actions.ts
app/bonus/imagem-actions.ts
app/bonus/publicar-actions.ts
lib/bonus/arte-cabimento.ts
lib/bonus/arte-escolhas.ts
lib/bonus/arte-foto.ts
lib/bonus/arte-resposta.tsx
lib/bonus/arte-rota.ts
lib/bonus/arte-tela.ts
lib/bonus/arte-textos.ts
lib/bonus/capa-desenho.tsx
lib/bonus/capa-geometria.ts
lib/bonus/capa-medida.ts
lib/bonus/carrosseis-tela.ts
lib/bonus/carrossel-repositorio.ts
lib/bonus/imagem-consulta.ts
lib/bonus/imagem-openai.ts
lib/bonus/imagem-processo.ts
lib/bonus/imagem-regras.ts
lib/bonus/imagem-textos.ts
lib/bonus/prompt-ilustracao.ts
lib/bonus/publicar-cabimento.ts
lib/bonus/publicar-estado.ts
lib/bonus/publicar-processo.ts
lib/bonus/publicar-regras.ts
lib/bonus/publicar-repositorio.ts
lib/bonus/publicar-textos.ts
testes-dom/bonus-capa-card.dom.tsx
testes-dom/bonus-publicar-imagem.dom.tsx
testes-integracao/bonus-apagar-carrossel.integracao.ts
testes-integracao/bonus-capa-escolhas.integracao.ts
testes-integracao/bonus-carrossel-processo.integracao.ts
testes-integracao/bonus-imagem-processo.integracao.ts
testes-integracao/bonus-publicar-processo.integracao.ts
testes-integracao/bonus-publicar-repositorio.integracao.ts
tests/bonus-apagar-regras.test.ts
tests/bonus-arte-escolhas.test.ts
tests/bonus-arte-tela.test.ts
tests/bonus-capa-desenho.test.ts
tests/bonus-capa-foto.test.ts
tests/bonus-capa-imagem.test.ts
tests/bonus-capa-medida.test.ts
tests/bonus-capa-paginas.test.ts
tests/bonus-capa-publicar.test.ts
tests/bonus-capa-regras.test.ts
tests/bonus-capa-rota.test.ts
tests/bonus-capa-versoes.test.ts
tests/bonus-carrosseis-tela.test.ts
tests/bonus-publicar-cabimento.test.ts
tests/bonus-publicar-estado.test.ts
tests/bonus-publicar-regras.test.ts
tests/publicacao-enquadramento.test.ts
```

e a segunda vazia.

- [ ] **Passo 5: avisar o auditor**, com o hash e os números. O push e o PR só com o OK do Eduardo.

---

### FASE 11 — A prova real, no preview, com o Eduardo

Cada escrita em produção tem o OK do Eduardo, pela caixa, e a auditoria lê o banco e o bucket antes e depois
(avisada com a hora). O preview usa o banco e o bucket de produção. **Sem post real. Sem migração.** A
imagem por IA (cerca de US$ 0,04) só com o OK do Eduardo, pela caixa, antes do clique.

- [ ] **Passo 1: a linha de base da auditoria**, só de leitura: as linhas de `carrosseis_gerados`, da fila
  (`queue`, `kind = 'publicacao'`), de `imagens_geradas` e a conta de objetos do bucket, com a hora.

- [ ] **Passo 2: o push da branch e o preview, com o OK do Eduardo**

Empurre só a branch (`git push origin refs/heads/capa-do-carrossel:refs/heads/capa-do-carrossel`). No log do
build do preview, confira o commit e "MIGRAÇÃO PULADA". O endereço do preview vem do `get_deployment` (o nome
da branch pode sair encurtado).

- [ ] **Passo 3: a prova, com o Eduardo na tela** (os passos da spec, "A prova real")

1. "Novo carrossel" → texto livre → "Escrever à mão", com 3 slides (grava). Ligar a "Capa com imagem" no
   slide 1 (grava): a miniatura mostra a capa com o fundo escuro liso, e o "Publicar" trava pedindo a
   imagem. A auditoria confere `arte.capa = true` na linha, e nenhum outro campo da arte mudado.
2. Um gancho que não cabe: "Desinconstitucionalissimamente proibido" (39 caracteres, dentro dos 15 a 120 do
   schema; a palavra de 30 letras não cabe na largura em degrau nenhum, como no caso de tela): o aviso "O
   gancho não cabe na capa. Encurte o texto." e o "Publicar" travado; encurtar e salvar (grava).
3. "Subir foto da capa" (grava), com uma foto em pé de celular: a miniatura com a foto, a sombra, o gancho em
   maiúscula e a conta. A auditoria confere o objeto em `<conta>/bonus-capa/<uuid>.jpg`, em 4:5, entre
   1080×1350 e 2160×2700, com até 2 MB.
4. "Gerar com IA" na capa (grava, com o custo; só com o OK do Eduardo): a imagem em pé entra no lugar da
   foto, e a foto antiga sai do bucket. A auditoria confere a linha de `imagens_geradas`, o objeto novo em
   1024×1536 e o antigo apagado, e o custo da chamada é medido no painel da OpenAI (a expectativa é a de
   hoje, US$ 0,0432; se der outro número, ele fica escrito no PR).
5. Agendar para daqui a 7 dias, às 10:00, e cancelar no calendário (gravam): a cópia da capa vai à fila, em
   `bonus-fila/`, em 1080×1350, e sai no cancelamento. Nenhum clique em "Publicar agora".
6. "Apagar carrossel" (grava): a auditoria confere que a linha saiu e que a imagem da capa saiu do bucket.

A linha da fila cancelada fica ou sai conforme o Eduardo decidir pela caixa; se sair, é por um script lido
pela auditoria antes de rodar. Depois: o corpo do PR e a mensagem do merge, conferidos pela auditoria, e o PR
com o OK do Eduardo. **O merge é do Eduardo**, com a mensagem colada nos dois campos (o título e a
descrição), e o build do merge diz "Nada a aplicar: as 21 migrações".

---

## Apêndice A — as provas de mutação

O script roda da raiz do repositório, com a `DATABASE_URL_TESTES` do container (ele recusa sem ela). Cada
mutação tira uma proteção, roda o teste que a cobre e confere que o caso nomeado caiu; cada arquivo volta
byte a byte.

```js
// Provas de mutação da capa do carrossel (spec 2026-10-13-capa-do-carrossel). Cada mutação tira uma
// proteção e roda o teste que a cobre; o caso nomeado tem de cair. Cada arquivo volta byte a byte.
// Uso, da raiz do repositório: DATABASE_URL_TESTES=<container> node mutar-capa.mjs [filtro]
// As mutações INTEG rodam a suíte de integração, que sem DATABASE_URL_TESTES cai na DATABASE_URL, a da
// PRODUÇÃO (achado 68): sem a variável, o script recusa antes de mutar, e uma rodada INTEG que não imprime
// "ALVO: banco de TESTE" conta como ✗.
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const PURA = (f) => `npx vitest run ${f}`;
const DOM = (f) => `npx vitest run --config vitest.dom.config.ts ${f}`;
const INTEG = (f) => `npx vitest run --config vitest.integracao.config.ts ${f}`;

const ESCOLHAS = "lib/bonus/arte-escolhas.ts";
const REGRAS = "lib/bonus/publicar-regras.ts";
const GEOMETRIA = "lib/bonus/capa-geometria.ts";
const MEDIDA = "lib/bonus/capa-medida.ts";
const ROTA = "lib/bonus/arte-rota.ts";
const FOTO = "lib/bonus/arte-foto.ts";
const TELA = "lib/bonus/arte-tela.ts";
const CARROSSEIS = "lib/bonus/carrosseis-tela.ts";
const REPO = "lib/bonus/carrossel-repositorio.ts";
const ACOES = "app/bonus/carrossel-actions.ts";
const PROCESSO = "lib/bonus/publicar-processo.ts";
const PUB_REPO = "lib/bonus/publicar-repositorio.ts";
const NO_NAVEGADOR = "app/bonus/[id]/carrossel/[cid]/imagem-no-navegador.ts";
const IMG_PROCESSO = "lib/bonus/imagem-processo.ts";
const IMG_ACOES = "app/bonus/imagem-actions.ts";
const OPENAI = "lib/bonus/imagem-openai.ts";
const PROMPT = "lib/bonus/prompt-ilustracao.ts";
const ESTADO = "lib/bonus/publicar-estado.ts";
const CABIMENTO = "lib/bonus/publicar-cabimento.ts";
const EDITOR = "app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx";
const CARD = "app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx";
const REVISAO = "app/bonus/[id]/carrossel/[cid]/revisao.tsx";

const T_REGRAS = PURA("tests/bonus-capa-regras.test.ts");
const T_MEDIDA = PURA("tests/bonus-capa-medida.test.ts");
const T_DESENHO = PURA("tests/bonus-capa-desenho.test.ts");
const T_ROTA = PURA("tests/bonus-capa-rota.test.ts");
const T_FOTO = PURA("tests/bonus-capa-foto.test.ts");
const T_VERSOES = PURA("tests/bonus-capa-versoes.test.ts");
const T_CARROSSEIS = PURA("tests/bonus-carrosseis-tela.test.ts");
const T_PAGINAS = PURA("tests/bonus-capa-paginas.test.ts");
const T_PUBLICAR = PURA("tests/bonus-capa-publicar.test.ts");
const T_IMAGEM = PURA("tests/bonus-capa-imagem.test.ts");
const T_APAGAR = PURA("tests/bonus-apagar-regras.test.ts");
const D_CARD = DOM("testes-dom/bonus-capa-card.dom.tsx");
const D_IMAGEM = DOM("testes-dom/bonus-publicar-imagem.dom.tsx");
const I_ESCOLHAS = INTEG("testes-integracao/bonus-capa-escolhas.integracao.ts");
const I_PUBLICAR = INTEG("testes-integracao/bonus-publicar-processo.integracao.ts");
const I_IMAGEM = INTEG("testes-integracao/bonus-imagem-processo.integracao.ts");
const I_APAGAR = INTEG("testes-integracao/bonus-apagar-carrossel.integracao.ts");
const I_REPO = INTEG("testes-integracao/bonus-publicar-repositorio.integracao.ts");

const MUTACOES = [
  // FASE 1: as regras puras
  { nome: "1: a capa vale no post de 1 slide (achado 98)", arq: ESCOLHAS,
    de: "  const capa = o.capa === true && total >= 2 && !soTexto.includes(1);", para: "  const capa = o.capa === true && !soTexto.includes(1);",
    cmd: T_REGRAS, caso: "o post de 1 slide nunca tem capa, mesmo com a chave gravada" },
  { nome: "1: a capa e o Só texto no slide 1 valem juntos", arq: ESCOLHAS,
    de: "  const capa = o.capa === true && total >= 2 && !soTexto.includes(1);", para: "  const capa = o.capa === true && total >= 2;",
    cmd: T_REGRAS, caso: "com o slide 1 em Só texto, a capa fica desligada" },
  { nome: "1: a capa vale com qualquer valor verdadeiro, e não só com o true", arq: ESCOLHAS,
    de: "  const capa = o.capa === true && total >= 2 && !soTexto.includes(1);", para: "  const capa = Boolean(o.capa) && total >= 2 && !soTexto.includes(1);",
    cmd: T_REGRAS, caso: "só o booleano true liga" },
  { nome: "1: a capa ganha o espaço da arte", arq: ESCOLHAS,
    de: "  return !e.soTexto.includes(numero) && !ehCapa(e, numero);", para: "  return !e.soTexto.includes(numero);",
    cmd: T_REGRAS, caso: "a capa só vale no slide 1, e ele deixa de ter o espaço da imagem" },
  { nome: "1: a capa vale em todo slide, e não só no 1", arq: ESCOLHAS,
    de: "  return e.capa && numero === 1;", para: "  return e.capa;",
    cmd: T_REGRAS, caso: "a capa só vale no slide 1, e ele deixa de ter o espaço da imagem" },
  { nome: "1: o formulário liga a capa no post de 1 slide", arq: ESCOLHAS,
    de: '  if (total < 2) return { ok: false, motivo: "capa_no_post" };\n', para: "",
    cmd: T_REGRAS, caso: "o post de 1 slide recusa a capa (achado 98)" },
  { nome: "1: o formulário liga a capa junto do Só texto no slide 1", arq: ESCOLHAS,
    de: '  if (soTexto.includes(1)) return { ok: false, motivo: "capa_e_so_texto" };\n', para: "",
    cmd: T_REGRAS, caso: "a capa junto do Só texto no slide 1 é recusada" },
  { nome: "1: o valor estranho da capa vira desligada, e não recusa", arq: ESCOLHAS,
    de: '  if (bruto !== "1") return { ok: false, motivo: "capa" };', para: '  if (bruto !== "1") return { ok: true, capa: false };',
    cmd: T_REGRAS, caso: "outro valor é recusado: \"true\"" },
  { nome: "1: a imagem da capa vale no slide com espaço", arq: REGRAS,
    de: '  return comEspaco(e, numero) && jeito !== "capa";', para: "  return comEspaco(e, numero);",
    cmd: T_REGRAS, caso: "no slide com espaço, valem a foto e o slide pronto, e a capa não" },
  { nome: "1: a foto e o slide pronto valem na capa", arq: REGRAS,
    de: '  if (ehCapa(e, numero)) return jeito === "capa";', para: "  if (ehCapa(e, numero)) return true;",
    cmd: T_REGRAS, caso: "na capa, só a imagem da capa vale" },
  { nome: "1: a foto da capa com 0 byte passa (achado 149)", arq: REGRAS,
    de: '!(typeof bytes === "number" && bytes > 0)) return "sem_medida";', para: '!(typeof bytes === "number" && bytes >= 0)) return "sem_medida";',
    cmd: T_REGRAS, caso: "a capa declarada com 0 byte é recusada" },
  { nome: "1: a medida da IA vale só pela largura", arq: REGRAS,
    de: "  const gerada = largura === LARGURA_DA_CAPA_GERADA && altura === ALTURA_DA_CAPA_GERADA;", para: "  const gerada = largura === LARGURA_DA_CAPA_GERADA;",
    cmd: T_REGRAS, caso: "a medida da IA vale inteira" },
  { nome: "1: a foto da capa maior que o dobro passa", arq: REGRAS,
    de: '    if (largura > CAPA_MAX_LARGURA || altura > CAPA_MAX_ALTURA) return "grande";\n', para: "",
    cmd: T_REGRAS, caso: "maior que 2160×2700 é grande" },
  { nome: "1: o recorte da capa deixa de reduzir a foto grande", arq: REGRAS,
    de: "  const reduz = l > CAPA_MAX_LARGURA || a > CAPA_MAX_ALTURA;", para: "  const reduz = false;",
    cmd: T_REGRAS, caso: "é reduzida a 2160×2700" },
  { nome: "1: a capa desenha a imagem de outro jeito guardada no slide 1", arq: REGRAS,
    de: "  return { ligada: true, caminho: imagem && valeNoSlide(escolhas, 1, jeitoDoCaminho(imagem.caminho)) ? imagem.caminho : null };",
    para: "  return { ligada: true, caminho: imagem ? imagem.caminho : null };",
    cmd: T_REGRAS, caso: "a capa da arte: ligada, com o caminho só quando a imagem do slide 1 é da capa" },
  // FASE 2: a medida, o desenho e a rota da arte
  { nome: "2: o gancho é medido sem as maiúsculas", arq: MEDIDA,
    de: '  return texto.toLocaleUpperCase("pt-BR");', para: "  return texto;",
    cmd: T_MEDIDA, caso: "a maiúscula vem antes de medir" },
  { nome: "2: a entrelinha da capa vira a do slide", arq: GEOMETRIA,
    de: "export const ENTRELINHA_DA_CAPA = 1.02;", para: "export const ENTRELINHA_DA_CAPA = 1.2;",
    cmd: T_MEDIDA, caso: "a linha da capa é a fonte vezes 1,02" },
  { nome: "2: o bloco do gancho cresce", arq: GEOMETRIA,
    de: "export const ALTURA_DO_BLOCO_DA_CAPA = 640;", para: "export const ALTURA_DO_BLOCO_DA_CAPA = 760;",
    cmd: T_MEDIDA, caso: "os degraus descem de 112 a 56, e o bloco tem 640 px" },
  { nome: "2: a palavra que vaza a largura cabe", arq: MEDIDA,
    de: "    return !m.vaza && m.altura <= ALTURA_DO_BLOCO_DA_CAPA;", para: "    return m.altura <= ALTURA_DO_BLOCO_DA_CAPA;",
    cmd: T_MEDIDA, caso: "a palavra mais larga que a linha no menor degrau não cabe" },
  { nome: "2: a sombra do pé fica fraca", arq: GEOMETRIA,
    de: "export const SOMBRA_DO_PE = { opacidade: 0.88, ate: 0.62 } as const;", para: "export const SOMBRA_DO_PE = { opacidade: 0.3, ate: 0.62 } as const;",
    cmd: T_DESENHO, caso: "a sombra do pé a escurece embaixo" },
  { nome: "2: o fundo da capa sem imagem fica branco", arq: GEOMETRIA,
    de: 'export const FUNDO_DA_CAPA_SEM_IMAGEM = "#161616";', para: 'export const FUNDO_DA_CAPA_SEM_IMAGEM = "#FFFFFF";',
    cmd: T_DESENHO, caso: "sem imagem, o fundo é escuro e liso" },
  { nome: "2: a rota desenha a capa como o slide de antes", arq: ROTA,
    de: "  const capa = ehCapa(escolhas, numero);", para: "  const capa = false;",
    cmd: T_ROTA, caso: "a capa com a imagem dela: busca só a da capa" },
  { nome: "2: a rota busca a imagem da capa como foto do espaço", arq: ROTA,
    de: "        ? fotoDaCapa(caminhoDaFoto, escolhas.conta)", para: "        ? fotoDoEspaco(caminhoDaFoto, escolhas.conta)",
    cmd: T_ROTA, caso: "a capa com a imagem dela: busca só a da capa" },
  { nome: "2: a capa sem imagem ganha versão", arq: ROTA,
    de: "  const desenhado = capa ? caminhoDaFoto !== null : !espaco || caminhoDaFoto !== null;", para: "  const desenhado = capa ? true : !espaco || caminhoDaFoto !== null;",
    cmd: T_ROTA, caso: "a capa sem imagem desenha o fundo escuro, sem busca e sem versão" },
  { nome: "2: a busca da capa aceita o caminho da foto do espaço", arq: FOTO,
    de: '  if (!conta || !ehCaminhoDoDestino(caminho, pastaDaConta(conta), "capa")) return Promise.resolve(null);',
    para: '  if (!conta || !ehCaminhoDoDestino(caminho, pastaDaConta(conta), "foto")) return Promise.resolve(null);',
    cmd: T_FOTO, caso: "recusa como capa a foto do espaço, de bonus-foto/" },
  // FASE 3: as versões
  { nome: "3: o slide sem capa muda de versão (o pedido da auditoria)", arq: TELA,
    de: "          soTexto.includes(s.numero) ? null : (fotos[s.numero] ?? null),\n        ])",
    para: "          soTexto.includes(s.numero) ? null : (fotos[s.numero] ?? null),\n          capa.ligada,\n        ])",
    cmd: T_VERSOES, caso: "medida na main 9b0c3e6" },
  { nome: "3: a versão da capa não muda com a imagem", arq: TELA,
    de: "cabecalho.iniciais, capa.caminho])", para: "cabecalho.iniciais])",
    cmd: T_VERSOES, caso: "trocar a imagem da capa, ou ficar sem ela, muda a versão do slide 1" },
  { nome: "3: a versão da capa vale em todo slide", arq: TELA,
    de: "    capa.ligada && s.numero === 1", para: "    capa.ligada",
    cmd: T_VERSOES, caso: "ligar a capa muda só a versão do slide 1" },
  { nome: "3: a lista mostra o slide pronto guardado no slide 1 em capa", arq: CARROSSEIS,
    de: "  const imagem = comEspaco(escolhas, 1) ? imagensDaArte(l.arte, l.total_slides)[1] : undefined;",
    para: "  const imagem = escolhas.soTexto.includes(1) ? undefined : imagensDaArte(l.arte, l.total_slides)[1];",
    cmd: T_CARROSSEIS, caso: "o slide 1 em capa: a arte da capa, mesmo com um slide pronto guardado nele" },
  // FASE 4: a capa gravada
  { nome: "4: desligar a capa deixa a chave antiga (o arte - 'capa')", arq: REPO,
    de: "set arte = (arte - 'capa') || $2::jsonb where id = $1", para: "set arte = arte || $2::jsonb where id = $1",
    cmd: I_ESCOLHAS, caso: "desligar tira a chave" },
  { nome: "4: a capa desligada grava capa: false", arq: REPO,
    de: "...(capa ? { capa: true } : {})", para: "...(capa ? { capa: true } : { capa: false })",
    cmd: I_ESCOLHAS, caso: "desligar tira a chave" },
  { nome: "4: a action ignora o campo da capa", arq: ACOES,
    de: '  const capa = lerCapaDoFormulario(form.get("capa"), lido.soTexto, linha.total_slides);',
    para: "  const capa = lerCapaDoFormulario(null, lido.soTexto, linha.total_slides);",
    cmd: T_PAGINAS, caso: "lê a capa do formulário pela regra pura" },
  { nome: "4: as versões da resposta saem da arte de antes", arq: ACOES,
    de: "      capaDaArte(arteNova, linha.total_slides)", para: "      capaDaArte(linha.arte, linha.total_slides)",
    cmd: T_PAGINAS, caso: "devolve as versões com a capa nova" },
  // FASE 5: a foto da capa no publicar
  { nome: "5: a capa se assina no slide sem capa", arq: PROCESSO,
    de: '    if (!capa) return recusa({ motivo: "sem_capa", numero: p.numero });\n', para: "",
    cmd: I_PUBLICAR, caso: "sem a capa ligada, a imagem da capa é recusada" },
  { nome: "5: a foto no slide em capa recusa como sem espaço", arq: PROCESSO,
    de: '    return recusa(capa ? { motivo: "na_capa", numero: p.numero } : { motivo: "sem_espaco", numero: p.numero });',
    para: '    return recusa({ motivo: "sem_espaco", numero: p.numero });',
    cmd: I_PUBLICAR, caso: "no slide em capa, a foto do espaço e o slide pronto também" },
  { nome: "5: a cópia da fila da capa sem imagem se assina", arq: PROCESSO,
    de: '    if (capa && capaDaArte(c.linha.arte, c.linha.total_slides).caminho === null) return recusa({ motivo: "faltam_imagens", slides: [p.numero] });\n',
    para: "",
    cmd: I_PUBLICAR, caso: "a capa sem imagem é recusada antes de tocar o bucket, e a arte dela nem se assina" },
  { nome: "5: a régua da capa deixa de ser conferida", arq: PROCESSO,
    de: '    if (problema) return recusa({ motivo: "capa_foto", problema });\n', para: "",
    cmd: I_PUBLICAR, caso: "a foto fora do 4:5, ou acima de 2 MB, é recusada como capa" },
  { nome: "5: a reserva aceita o jeito errado no slide", arq: PUB_REPO,
    de: '    if (capa !== (jeito === "capa")) return recusa(', para: "    if (false) return recusa(",
    cmd: I_PUBLICAR, caso: "a capa desligada no meio da subida: guardar a imagem da capa é recusado" },
  { nome: "5: a reserva deixa de reconhecer o caminho da capa", arq: PUB_REPO,
    de: '(["foto", "slide", "capa"] as const)', para: '(["foto", "slide"] as const)',
    cmd: I_PUBLICAR, caso: "guardar a capa devolve o jeito capa e a miniatura com a capa" },
  { nome: "5: a foto da capa sai pelo recorte da foto do espaço", arq: NO_NAVEGADOR,
    de: "        ? await prepararCapa(p.arquivo)", para: "        ? await prepararFoto(p.arquivo)",
    cmd: D_IMAGEM, caso: "assina no destino da capa, sobe e guarda" },
  // FASE 6: a imagem da capa por IA
  { nome: "6: a action manda o formato fixo", arq: IMG_ACOES,
    de: "  after(() => gerarImagem({ reservaId, id, numero, descricao, contas, formato }));",
    para: '  after(() => gerarImagem({ reservaId, id, numero, descricao, contas, formato: "espaco" }));',
    cmd: T_PAGINAS, caso: "a action do pedido passa à geração o formato que o pedido decidiu" },
  { nome: "6: o pedido da capa sai no formato do espaço", arq: IMG_PROCESSO,
    de: 'formato: capa ? "capa" : "espaco" }', para: 'formato: "espaco" }',
    cmd: I_IMAGEM, caso: "o pedido no slide 1 em capa sai no formato da capa" },
  { nome: "6: o pedido de imagem na capa recusa como sem espaço", arq: IMG_PROCESSO,
    de: "  if (!capa && !comEspaco(c.escolhas, p.numero))", para: "  if (!comEspaco(c.escolhas, p.numero))",
    cmd: I_IMAGEM, caso: "gera em bonus-capa, o slide 1 guarda como capa" },
  { nome: "6: a capa gerada é conferida pela régua da foto do espaço", arq: IMG_PROCESSO,
    de: "    const problema = capa ? problemaDaCapaGerada(r.bytes) : problemaDaImagemGerada(r.bytes);", para: "    const problema = problemaDaImagemGerada(r.bytes);",
    cmd: I_IMAGEM, caso: "a imagem deitada que volta para a capa falha com a frase da capa" },
  { nome: "6: a capa gerada se assina como foto", arq: IMG_PROCESSO,
    de: 'destino: capa ? "capa" : "foto"', para: 'destino: "foto"',
    cmd: I_IMAGEM, caso: "gera em bonus-capa, o slide 1 guarda como capa" },
  { nome: "6: a capa é pedida à OpenAI no quadrado", arq: OPENAI,
    de: 'size: "1024x1536"', para: 'size: "1024x1024"',
    cmd: T_IMAGEM, caso: "o corpo da capa é o de hoje, em pé: 1024×1536" },
  { nome: "6: o prompt da capa perde a frase do espaço do gancho", arq: PROMPT,
    de: "    ...(depoisDoFundo ? [depoisDoFundo] : []),\n", para: "",
    cmd: T_IMAGEM, caso: "é o pedido de hoje, com a frase da capa logo depois do fundo" },
  // FASE 7: o publicar com a capa
  { nome: "7: as faltas aceitam qualquer imagem no slide 1 em capa", arq: ESTADO,
    de: '  const temImagem = (n: number) => (p.capa && n === 1 ? jeitoDe(n) === "capa" : Boolean(p.imagens[n]) && jeitoDe(n) !== "capa");',
    para: "  const temImagem = (n: number) => Boolean(p.imagens[n]);",
    cmd: T_PUBLICAR, caso: "na capa, a foto do espaço ou o slide pronto guardados contam como a imagem que falta" },
  { nome: "7: a capa sem a imagem dela sai como arte", arq: ESTADO,
    de: '      if (p.imagens[n]?.jeito === "capa") artes.push({ numero: n, comFoto: true, capa: true });',
    para: "      artes.push({ numero: n, comFoto: true, capa: true });",
    cmd: T_PUBLICAR, caso: "a capa sem a imagem dela não sai: falta a imagem" },
  { nome: "7: o corte da capa usa a medida do slide", arq: CABIMENTO,
    de: '  if (arte?.capa) return tamanhoDaCapa(s).cabe ? null : "encurtar";\n', para: "",
    cmd: T_PUBLICAR, caso: "a capa usa a conta da capa" },
  { nome: "7: o card da capa usa o corte do slide", arq: CABIMENTO,
    de: "  if (s && p.capa && p.numero === 1) return corteDoSlide(s, { comFoto: true, capa: true });\n", para: "",
    cmd: T_PUBLICAR, caso: "o card da capa avisa antes da imagem" },
  { nome: "7: o publicar aceita a imagem de outro jeito", arq: PROCESSO,
    de: "  const vale = (n: number) => imagens[n] !== undefined && valeNoSlide(c.escolhas, n, jeitoDoCaminho(imagens[n].caminho));",
    para: "  const vale = (n: number) => imagens[n] !== undefined;",
    cmd: I_PUBLICAR, caso: "com a capa desligada, a imagem da capa guardada no slide 1 conta como a que falta, e não é copiada" },
  { nome: "7: a capa deixa de contar nas faltas do publicar", arq: PROCESSO,
    de: "    .filter((s) => (comEspaco(c.escolhas, s.numero) || ehCapa(c.escolhas, s.numero)) && !vale(s.numero))",
    para: "    .filter((s) => comEspaco(c.escolhas, s.numero) && !vale(s.numero))",
    cmd: I_PUBLICAR, caso: "a capa sem imagem é recusada antes de tocar o bucket" },
  { nome: "7: o publicar desenha a capa sem a imagem dela", arq: PROCESSO,
    de: "  const desenhoDe = (n: number) => (ehCapa(c.escolhas, n) ? capa.caminho : fotoDe(n));", para: "  const desenhoDe = (n: number) => fotoDe(n);",
    cmd: I_PUBLICAR, caso: "a capa vai com a arte subida, desenhada com a imagem dela" },
  { nome: "7: o corte do publicar mede a capa como slide", arq: PROCESSO,
    de: ", ...(ehCapa(c.escolhas, n) ? { capa: true as const } : {}) }", para: " }",
    cmd: I_PUBLICAR, caso: "o gancho que não cabe na capa é recusado, e só encurtar resolve" },
  { nome: "7: o conferido ignora a capa ligada ou desligada no meio", arq: PUB_REPO,
    de: "      escolhas.capa !== conferido.capa ||\n", para: "",
    cmd: I_REPO, caso: "a capa desligada no banco depois de conferir: a reserva vê que mudou" },
  { nome: "7: o conferido ignora a imagem da capa trocada no meio", arq: PUB_REPO,
    de: "    if (capa.caminho) atuais[1] = capa.caminho;\n", para: "",
    cmd: I_PUBLICAR, caso: "a capa vai com a arte subida, desenhada com a imagem dela" },
  // FASE 8: a tela
  { nome: "8: marcar o Só texto no slide 1 deixa a capa ligada", arq: EDITOR,
    de: "    gravarArte(novo, marcado && numero === 1 ? false : capa);", para: "    gravarArte(novo, capa);",
    cmd: D_CARD, caso: "marcar o Só texto no slide 1 desliga a capa" },
  { nome: "8: ligar a capa deixa o Só texto no slide 1", arq: EDITOR,
    de: "    gravarArte(marcada ? soTexto.filter((n) => n !== 1) : soTexto, marcada);", para: "    gravarArte(soTexto, marcada);",
    cmd: D_CARD, caso: "ligar a capa grava a capa junto do só texto, e tira o Só texto do slide 1" },
  { nome: "8: o formulário da arte sai sem a capa", arq: EDITOR,
    de: '    if (novaCapa) form.set("capa", "1");\n', para: "",
    cmd: D_CARD, caso: "ligar a capa grava a capa junto do só texto" },
  { nome: "8: a recusa deixa a capa como foi clicada", arq: EDITOR,
    de: "        setCapa(capaAceita.current);\n", para: "",
    cmd: D_CARD, caso: "na recusa, a capa e o só texto voltam juntos" },
  { nome: "8: a imagem gerada na capa fica como foto", arq: EDITOR,
    de: '        const jeito: JeitoDaImagem = capa && numero === 1 ? "capa" : "foto";', para: '        const jeito: JeitoDaImagem = "foto";',
    cmd: D_CARD, caso: "a imagem gerada por IA na capa entra como a da capa" },
  { nome: "8: o post de 1 slide mostra a caixa da capa", arq: EDITOR,
    de: "              podeTerCapa={n === 1 && total >= 2}", para: "              podeTerCapa={n === 1}",
    cmd: D_CARD, caso: "o post de uma imagem só não tem a capa" },
  { nome: "8: a capa mostra o Subir foto do espaço", arq: CARD,
    de: '          {podeSubir && !capa && botaoDeImagem("foto")}', para: '          {podeSubir && botaoDeImagem("foto")}',
    cmd: D_CARD, caso: "os botões são os da capa; os do espaço ficam nos outros slides" },
  { nome: "8: o card da capa perde o aviso do gancho", arq: CARD,
    de: "          ? avisoDaCapa(total, atuais)", para: "          ? undefined",
    cmd: D_CARD, caso: "o gancho que não cabe na capa avisa no card" },
  { nome: "8: o card mostra a imagem de outro jeito", arq: CARD,
    de: '  const valeAqui = imagem !== null && (capa ? imagem.jeito === "capa" : imagem.jeito !== "capa");', para: "  const valeAqui = imagem !== null;",
    cmd: D_CARD, caso: "a miniatura da capa é a arte, mesmo com um slide pronto guardado no slide 1" },
  { nome: "8: a capa perde o Gerar com IA", arq: CARD,
    de: '              rotulo={capa ? "Gerar com IA" : "Gerar imagem"}', para: '              rotulo="Gerar imagem"',
    cmd: D_CARD, caso: "os botões são os da capa; os do espaço ficam nos outros slides" },
  { nome: "8: a página volta a ler o jeito pelas fotos", arq: REVISAO,
    de: 'jeito: jeitoDoCaminho(i.caminho) ?? "slide" }', para: 'jeito: Number(n) in fotos ? "foto" : "slide" }',
    cmd: T_PAGINAS, caso: "a página lê o jeito de cada imagem pelo caminho" },
  { nome: "8: a página abre com a capa desligada", arq: REVISAO,
    de: "      capaInicial={escolhas.capa}\n", para: "",
    cmd: T_PAGINAS, caso: "a página passa a capa gravada ao editor" },
  // FASE 9: o apagar
  { nome: "9: o caminho da capa perde o jeito (pura)", arq: REGRAS,
    de: 'm[1] === PREFIXO.capa ? "capa" : "slide"', para: '"slide"',
    cmd: T_APAGAR, caso: "a imagem da capa sai também, ligada ou não" },
  { nome: "9: o caminho da capa perde o jeito (integração)", arq: REGRAS,
    de: 'm[1] === PREFIXO.capa ? "capa" : "slide"', para: '"slide"',
    cmd: I_APAGAR, caso: "a imagem da capa sai do bucket com o carrossel" },
];

const filtro = process.argv[2];
const descobrir = process.env.DESCOBRIR === "1";
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
  const fim = (t) => (crlf ? t.replace(/\n/g, "\r\n") : t);
  const n = texto.split(fim(m.de)).length - 1;
  if (n !== 1) {
    console.log(`✗ ${m.nome}: o trecho aparece ${n} vez(es)`);
    ruins++;
    continue;
  }
  writeFileSync(m.arq, texto.replace(fim(m.de), () => fim(m.para)), "utf8");
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
  // As cores do vitest pintam o " > " das linhas FAIL num terminal com cor (nota da auditoria em 13/10): a
  // saída perde os códigos de cor antes de procurar o caso.
  saida = saida.replace(/\x1b\[[0-9;]*m/g, "");
  if (ehInteg(m) && !saida.includes("ALVO: banco de TESTE")) {
    console.log(`✗ ${m.nome}: a integração não imprimiu "ALVO: banco de TESTE". Pare e confira o banco.`);
    ruins++;
    continue;
  }
  const casoCaiu = m.caso !== "" && saida.split("\n").some((l) => /FAIL|×/.test(l) && l.includes(m.caso));
  if (!(caiu && casoCaiu)) ruins++;
  console.log(`${caiu && casoCaiu ? "✓" : "✗"} ${m.nome}: o caso "${m.caso}" ${casoCaiu ? "caiu" : "NÃO caiu"}`);
  if (descobrir) {
    const caidos = [...new Set(saida.split("\n").filter((l) => /^\s*×/.test(l)).map((l) => l.trim()))];
    const erro = caiu && !caidos.length ? saida.split("\n").filter((l) => /Error|error TS|FAIL/.test(l)).slice(0, 3) : [];
    for (const l of [...caidos.slice(0, 8), ...erro]) console.log(`    ${l}`);
  }
}
console.log(`${escolhidas.length} mutações, ${ruins} ruins`);
process.exit(ruins ? 1 : 0);
```
