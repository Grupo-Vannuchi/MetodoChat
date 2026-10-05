# Gerador de bônus — Plano de implementação da Etapa 5: publicar o carrossel

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: `superpowers:subagent-driven-development`
> (recomendada) ou `superpowers:executing-plans`, fase por fase. Os passos usam caixa de
> seleção (`- [ ]`) para acompanhar.

**Objetivo:** na página do carrossel, cada slide com espaço de imagem recebe a imagem pronta do
Canva, e o carrossel é publicado ou agendado dali, pela fila do `/publicar`, sempre na conta do
carrossel, sem mexer em arquivo nenhum do `/publicar`.

**Arquitetura:** as regras são puras: os caminhos no bucket, o 4:5, a versão do texto do slide e a
leitura da coluna `arte` (`publicar-regras.ts`); o estado lido da fila e a trava, escrita pelo que
libera (`publicar-estado.ts`); as frases (`publicar-textos.ts`). O repositório
(`publicar-repositorio.ts`) grava a imagem e a reserva com a linha travada e lê a fila pela chave
exata; as gravações da Etapa 4 passam a respeitar a trava. O bucket (`publicar-bucket.ts`) assina na
pasta da conta do carrossel e copia a imagem guardada para a fila só com as chamadas que
`lib/bucket.ts` já mediu. O processo (`publicar-processo.ts`) costura: confere, copia fora da trava,
reserva, enfileira e marca. As actions (`publicar-actions.ts`) só conferem a sessão e leem o
pedido. No navegador, `imagem-no-navegador.ts` converte para JPEG (cópia do enviador do `/publicar`),
confere o 4:5 e sobe direto ao bucket. A página ganha o upload em cada card e o card "Publicar".

**Stack:** a das etapas anteriores, no Next.js 16.3.8: App Router, Server Actions com
`useActionState`, React 19, Postgres (postgres.js via `lib/db.ts`), Vitest (três suítes), Tailwind
v4 com os tokens de `app/ui.ts`. E, do `/publicar`, sem mudar nada nele: o Storage do Supabase por
REST (`lib/bucket.ts`), a fila (`enqueuePublicacao`, `lib/engine.ts`; `drainQueue`,
`lib/queue-drain.ts`) e as regras puras de `lib/publicacao.ts`.

**Spec:** `docs/specs/2026-10-05-publicar-do-carrossel.md` (commits `e2d4f79`, `45a1fcf` e
`f493e4c`). Leia antes de começar: este plano não repete o porquê das regras, só como construí-las.

**Ensaio do plano (05/10):** o código deste plano foi escrito e testado fase a fase numa cópia
isolada do repositório (`git worktree`, branch local `ensaio-publicar`, sem push, saída de
`45a1fcf`), e todo bloco de código abaixo foi tirado do git dessa cópia por um gerador, sem cópia à
mão. Os números do ensaio, na ordem deste plano:
- lint e `tsc` limpos em cada fase; no fim, 99 arquivos e 2 854 casos puros (95 e 2 779 na base), 21
  arquivos e 147 casos de tela (18 e 117 na base), e a varredura do dono "SEM VAZAMENTO em A nem em
  C";
- `next build --webpack` limpo, com `ƒ /bonus/[id]/carrossel/[cid]` e
  `ƒ /bonus/[id]/carrossel/[cid]/arte` na lista (o Turbopack, ver o item 7 abaixo);
- integração no container: 39 arquivos; 356 passaram, 8 pularam, e caíram só os 7 de `registro-de-migracoes`, pelo item 6 abaixo. Na árvore do projeto, a conta esperada é 363 passaram e 8 pularam (FASE 5.10);
- cada fase foi vista falhar antes do código e passar depois, na ordem deste plano, com os números
  de cada uma no passo dela;
- as 45 provas de mutação do Apêndice A derrubaram, cada uma, o caso esperado. Uma não derrubava na
  primeira rodada: sem o `for update` da reserva, os dois cliques do `Promise.all` às vezes não se
  cruzavam. O caso que força o cruzamento (uma transação do teste segura a linha) entrou na FASE 5.3;
- o plano, aplicado do zero sobre `45a1fcf` numa cópia limpa, dá os 26 arquivos iguais ao fim do
  ensaio, byte a byte (19 criados e 20 diffs).

O ensaio achou estas coisas, já resolvidas neste plano:
1. **Os nomes da spec.** A spec chama as actions de `guardarImagemDoSlide` e `publicarCarrossel`, e
   esses nomes tinham ido primeiro para o repositório e para o processo. As actions ficaram com os
   nomes da spec; por dentro, `gravarImagemDoSlide` (repositório) e `publicarNaFila` (processo).
2. **A publicação de forma estranha trava.** A primeira redação da spec mandava toda leitura fora de
   forma voltar ao padrão, e uma `publicacao` estranha lida como "sem publicação" liberaria o botão.
   Ela vira o estado "desconhecido", que trava (spec corrigida em `f493e4c`).
3. **A arte "Só texto" que não vira JPEG não sobe.** No teste de tela, uma resposta da rota da arte
   sem o tipo PNG passava crua pelo `canvas` e subia declarada como JPEG; o servidor não vê os bytes.
   O navegador confere o tipo antes de assinar (FASE 5.7).
4. **O lint do React recusa ler o relógio dentro do componente** (`react-hooks/purity`), mesmo num
   tratador de clique. O clique do "Publicar" virou uma função de módulo (`publicarDaTela`), e o
   upload deixou de ter um ramo que lia `Date.now()`.
5. **`salvarSoTextoDaArte` passou a responder um objeto** (`{ ok: true }`, ou a recusa com o motivo,
   inclusive `travado`), e cinco conferências do teste de integração da Etapa 4 mudaram com ele (FASE
   5.3).
6. **A cópia de ensaio derruba `registro-de-migracoes`** (7 casos): o script que ele roda imprime um
   aviso do Node sobre o `package.json` da cópia, e o caso exige a saída limpa. Na árvore do projeto
   os 7 passam (medido em 05/10, 12:02). A integração inteira da FASE 5.10 roda na árvore do projeto.
7. **O `next build` do `verify` (Turbopack) não roda na cópia de ensaio**, como na Etapa 4: ele recusa
   o `node_modules` ligado por junção. O ensaio rodou `next build --webpack`; na árvore do projeto o
   `verify` roda o Turbopack.
8. **Dois cliques ao mesmo tempo nem sempre se cruzam no teste.** Tirar o `for update` da reserva
   passava pelo caso dos dois `reservarPublicacao` num `Promise.all`: a primeira transação às vezes
   terminava antes de a segunda ler. O caso novo força o cruzamento com o molde do teste dos dois
   salvamentos da Etapa 4 (uma transação do teste segura a linha e grava uma reserva), e a mutação
   passou a derrubá-lo.

A revisão do plano pelo auditor (05/10) o liberou sem achado novo e trouxe um detalhe, resolvido aqui: a limpeza da reserva velha (FASE 5.5) não excluía os caminhos da tentativa atual. Um pedido montado à mão que repetisse a arte "Só texto" da reserva velha apagaria um arquivo do post que está entrando, e o item sairia `failed`. O filtro ganhou `!caminhos.includes(x)`, a FASE 5.5 ganhou o caso que prova, e o Apêndice A a mutação que o derruba (45).

## Restrições globais

Valem para todas as fases, sem precisar repetir em cada uma.

- **Branch:** `publicar-do-carrossel`, saída da `main` em `a4411a5` (o PR #7 mergeado). Nunca
  commitar nem empurrar na `main`: ela não tem proteção e um push dispara deploy de produção.
  Conferir `git branch --show-current` antes de cada commit, e `git ls-remote origin
  refs/heads/main` no começo de cada fase.
- **`git add` com caminho explícito.** Nunca `-A` nem `.`: mais de uma sessão usa esta árvore.
- **Conventional Commits, em português.** Sem `Co-Authored-By` e sem rodapé de IA. Autor:
  Eduardo Kobal <162614913+Eduardokobal@users.noreply.github.com>.
- **Antes de cada commit**, varrer os arquivos de TEXTO tocados com
  `node "$SCRATCH/varrer-texto.mjs" <arquivos>`, em que `$SCRATCH` é o scratchpad da sessão. Se o
  scratchpad não existir mais, recrie o script a partir do apêndice A do plano da Etapa 1
  (`docs/plans/2026-09-29-gerador-de-bonus.md`).
- **Escape de barra-u:** a ferramenta de escrita grava o caractere no lugar do escape. Os blocos
  deste plano não têm escape de barra-u; se algum aparecer, a varredura acusa.
- **Fim de linha:** com `core.autocrlf=true`, a cópia de trabalho dos arquivos que já existem está
  em CRLF. Os diffs deste plano estão em LF: aplique com `git apply --ignore-whitespace` ou à mão,
  e varra depois. Se a varredura acusar fim de linha misturado, converta a cópia inteira para LF.
- **Pasta própria:** `app/bonus/` e `lib/bonus/`. Fora delas, só testes novos e `docs/`. **Nenhum
  arquivo do `/publicar` muda:** `app/publicar/`, `app/api/midia/`, `lib/bucket.ts`,
  `lib/queue-drain.ts`, `lib/engine.ts`, `lib/publicacao.ts` e `lib/dedupe.ts` ficam iguais aos da
  `main` (a FASE 5.10 confere).
- **Sufixo de teste é o que decide se ele roda:** `tests/**/*.test.ts` (puro, entra no `verify`),
  `testes-integracao/**/*.integracao.ts` (banco, fora do `verify`), `testes-dom/**/*.dom.tsx`
  (tela, entra no `verify`).
- **A suíte de integração só roda com `DATABASE_URL_TESTES`** apontando para o container
  (`127.0.0.1:5434`, `npm run banco:teste`). Toda rodada tem de imprimir
  `[rede-global] ALVO: banco de TESTE`. Se imprimir outra coisa, pare. Nunca rode com a variável
  vazia: ela cai na `DATABASE_URL`, que é **produção**. Os testes novos de integração também apontam
  o bucket para um servidor falso nesta máquina e recusam rodar se a `SUPABASE_URL` não for
  loopback.
- **`next dev` sem as variáveis de agente.** Rode com `env -u CLAUDECODE -u AI_AGENT ...` e confira
  `git diff AGENTS.md` depois: ele não muda.
- **Telas:** só os tokens de `app/ui.ts` e os degraus de `app/escala.ts`; nada de `indigo`,
  `violet` nem `purple`.
- **Segredo** nunca vai para código, log, mensagem, commit ou saída de terminal.
- **Escrita em produção só com o OK do Eduardo.** A etapa não tem migração. O preview usa o banco e o
  bucket de produção: lá, subir e guardar uma imagem, publicar e agendar gravam em produção, e
  publicar "Agora" sai no Instagram de verdade. Avisar o auditor com a hora antes de cada gravação.
- **Ao fechar cada fase**, avisar o auditor (sessão `metodochat-96` em 05/10; conferir o nome no
  `ListAgents`, porque ele muda a cada reinício) com o hash e o que conferir. Não esperar a
  resposta para seguir.

## Mapa dos arquivos

| arquivo | responsabilidade | fase |
|---|---|---|
| `lib/bonus/publicar-regras.ts` | os caminhos no bucket, o 4:5, a versão do texto, a forma, a leitura da coluna `arte` | 5.1 |
| `lib/bonus/publicar-estado.ts`, `lib/bonus/publicar-textos.ts` | o estado lido da fila, a trava, o que falta para publicar, as frases | 5.2 |
| `lib/bonus/publicar-repositorio.ts`; `lib/bonus/carrossel-repositorio.ts` e `app/bonus/carrossel-actions.ts` (Etapa 4) | guardar a imagem, a reserva, a marca de enfileirada; a trava nas gravações da Etapa 4 | 5.3 |
| `lib/bonus/publicar-bucket.ts` | assinar na pasta da conta do carrossel, copiar para a fila, apagar sem derrubar | 5.4 |
| `lib/bonus/publicar-processo.ts` | assinar, guardar e publicar, com a reserva antes da fila | 5.5 |
| `app/bonus/publicar-actions.ts` | as três actions, com a sessão conferida | 5.6 |
| `.../imagem-no-navegador.ts` | o JPEG, o 4:5 e o PUT no navegador; as artes "Só texto" | 5.7 |
| `.../publicacao-na-tela.ts`, `.../card-da-parte.tsx`, `.../editor-do-carrossel.tsx`; `lib/bonus/carrossel-textos.ts` e `app/bonus/carrossel-actions.ts` | a imagem do Canva no card, o aviso do texto que mudou, a página travada | 5.8 |
| `.../card-publicar.tsx`, `.../page.tsx` | o card "Publicar" e a página com a publicação | 5.9 |

`...` é `app/bonus/[id]/carrossel/[cid]`.

---

## ETAPA 5 — publicar o carrossel

### FASE 5.0 — Começar da main certa

- [ ] **Passo 1: conferir a main e a branch**

```bash
git ls-remote origin refs/heads/main
git switch publicar-do-carrossel
git log --oneline -5
node -e 'console.log(require("./node_modules/next/package.json").version)'
```

Esperado: a `main` em `a4411a5` (ou depois dele); a branch com os commits da spec e este plano sobre
`a4411a5`; o `node_modules` na 16.3.8. Se a `main` andou, rebaseie a branch nela antes de seguir
(`git fetch origin main && git rebase origin/main`), e rode `npm ci` se o lock mudou.

- [ ] **Passo 2: a linha de base**

```bash
npm test
npm run test:dom
npm run banco:teste
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npm run test:integracao
```

Esperado: 95 arquivos / 2 779 casos puros; 18 / 117 de tela; `[rede-global] ALVO: banco de TESTE`,
37 arquivos, 315 passaram e 8 pularam.

---

### FASE 5.1 — As regras puras da publicação

**Arquivos:**
- Criar: `lib/bonus/publicar-regras.ts`
- Testar: `tests/bonus-publicar-regras.test.ts`

**Interfaces:**
- Produz: `type DestinoDaImagem = "slide" | "fila"`; `caminhoDaImagem(pasta, destino, uuid): string`
  (`<pasta>/bonus/<uuid>.jpg` ou `<pasta>/bonus-fila/<uuid>.jpg`); `ehCaminhoDoDestino(caminho:
  unknown, pasta, destino): caminho is string`; `PROPORCAO_MIN = 0.792`, `PROPORCAO_MAX = 0.808`,
  `type ProblemaDaProporcao = "sem_medida" | "proporcao"`, `problemaDaProporcaoDoSlide(largura,
  altura)`; `versaoDoTextoDoSlide(slide: SlideParaArte): string`; `formaDoCarrossel(total):
  FormaDePublicacao`; `type ImagemGuardada = { caminho; versao }`, `imagensDaArte(arte, total):
  Record<number, ImagemGuardada>`; `type PublicacaoGuardada = { chave; caminhos; reservadaEm: Date;
  enfileiradaEm: Date | null }`, `publicacaoDaArte(arte): PublicacaoGuardada | null | "estranha"`.

- [ ] **Passo 1: o teste**

Crie `tests/bonus-publicar-regras.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { SlideParaArte } from "@/lib/bonus/arte-slides";
import { versoesDosSlides } from "@/lib/bonus/arte-tela";
import {
  PROPORCAO_MAX,
  PROPORCAO_MIN,
  caminhoDaImagem,
  ehCaminhoDoDestino,
  formaDoCarrossel,
  imagensDaArte,
  problemaDaProporcaoDoSlide,
  publicacaoDaArte,
  versaoDoTextoDoSlide,
} from "@/lib/bonus/publicar-regras";

// AS REGRAS PURAS DA PUBLICAÇÃO DO CARROSSEL (spec da Etapa 5, "Por dentro").

const PASTA = "17841400000000001";
const UUID = "0f8e2a4b-1c3d-4e5f-8a9b-0c1d2e3f4a5b";

describe("os caminhos das imagens no bucket", () => {
  it("a guardada no slide vai para <pasta>/bonus, e a da fila para <pasta>/bonus-fila", () => {
    expect(caminhoDaImagem(PASTA, "slide", UUID)).toBe(`${PASTA}/bonus/${UUID}.jpg`);
    expect(caminhoDaImagem(PASTA, "fila", UUID)).toBe(`${PASTA}/bonus-fila/${UUID}.jpg`);
  });

  it("cada destino aceita só o próprio prefixo, na pasta da conta do carrossel", () => {
    expect(ehCaminhoDoDestino(`${PASTA}/bonus/${UUID}.jpg`, PASTA, "slide")).toBe(true);
    expect(ehCaminhoDoDestino(`${PASTA}/bonus-fila/${UUID}.jpg`, PASTA, "fila")).toBe(true);
    // O prefixo de um não serve ao outro: a guardada nunca vai para a fila, e o dreno nunca a apaga.
    expect(ehCaminhoDoDestino(`${PASTA}/bonus/${UUID}.jpg`, PASTA, "fila")).toBe(false);
    expect(ehCaminhoDoDestino(`${PASTA}/bonus-fila/${UUID}.jpg`, PASTA, "slide")).toBe(false);
  });

  it.each([
    ["outra pasta", `17841400000000002/bonus/${UUID}.jpg`],
    ["o formato do /publicar, com uma barra só", `${PASTA}/${UUID}.jpg`],
    ["subir de pasta", `${PASTA}/bonus/../${UUID}.jpg`],
    ["barra a mais", `${PASTA}/bonus/x/${UUID}.jpg`],
    ["outra extensão", `${PASTA}/bonus/${UUID}.png`],
    ["uuid em maiúsculas", `${PASTA}/bonus/${UUID.toUpperCase()}.jpg`],
    ["nome que não é uuid", `${PASTA}/bonus/foto.jpg`],
    ["espaço no fim", `${PASTA}/bonus/${UUID}.jpg `],
    ["a pasta como prefixo de outra", `${PASTA}9/bonus/${UUID}.jpg`],
  ])("recusa %s", (_nome, caminho) => {
    expect(ehCaminhoDoDestino(caminho, PASTA, "slide")).toBe(false);
  });

  it("recusa o que não é texto, e a pasta vazia ou com caractere fora da higienização", () => {
    expect(ehCaminhoDoDestino(null, PASTA, "slide")).toBe(false);
    expect(ehCaminhoDoDestino(42, PASTA, "slide")).toBe(false);
    expect(ehCaminhoDoDestino(`/bonus/${UUID}.jpg`, "", "slide")).toBe(false);
    expect(ehCaminhoDoDestino(`a.b/bonus/${UUID}.jpg`, "a.b", "slide")).toBe(false);
  });
});

// A IMAGEM DO SLIDE TEM DE SER 4:5, COMO A ARTE (achado 76, decisão do Eduardo em 05/10): o Instagram
// corta todos os itens do carrossel pela proporção do PRIMEIRO (lib/dedupe.ts:211-212).
describe("a proporção da imagem do slide", () => {
  it("a arte, 1080×1350, passa", () => {
    expect(problemaDaProporcaoDoSlide(1080, 1350)).toBeNull();
    expect(problemaDaProporcaoDoSlide(1440, 1800)).toBeNull();
  });

  it("as bordas de 1% passam, e o que passa delas é recusado", () => {
    expect(PROPORCAO_MIN).toBe(0.792);
    expect(PROPORCAO_MAX).toBe(0.808);
    expect(problemaDaProporcaoDoSlide(792, 1000)).toBeNull();
    expect(problemaDaProporcaoDoSlide(808, 1000)).toBeNull();
    expect(problemaDaProporcaoDoSlide(791, 1000)).toBe("proporcao");
    expect(problemaDaProporcaoDoSlide(809, 1000)).toBe("proporcao");
  });

  it("quadrada e paisagem são recusadas, mesmo que o /publicar as aceite", () => {
    expect(problemaDaProporcaoDoSlide(1080, 1080)).toBe("proporcao");
    expect(problemaDaProporcaoDoSlide(1910, 1000)).toBe("proporcao");
  });

  it("sem medida, ou com medida zero, é recusada: não dá para saber a proporção", () => {
    expect(problemaDaProporcaoDoSlide(undefined, 1350)).toBe("sem_medida");
    expect(problemaDaProporcaoDoSlide(1080, undefined)).toBe("sem_medida");
    expect(problemaDaProporcaoDoSlide(0, 1350)).toBe("sem_medida");
    expect(problemaDaProporcaoDoSlide(1080, 0)).toBe("sem_medida");
    expect(problemaDaProporcaoDoSlide(Number.NaN, 1350)).toBe("sem_medida");
  });
});

describe("a versão do texto do slide", () => {
  const slide: SlideParaArte = {
    numero: 2,
    total: 5,
    tipo: "conteudo",
    titulo: "Os três sinais",
    texto: "Responda o cliente no mesmo dia.",
    assinaturaNoPe: false,
  };

  it("muda com a manchete e com o texto daquele slide", () => {
    const v = versaoDoTextoDoSlide(slide);
    expect(v).toMatch(/^[0-9a-f]{8}$/);
    expect(versaoDoTextoDoSlide({ ...slide, titulo: "Os quatro sinais" })).not.toBe(v);
    expect(versaoDoTextoDoSlide({ ...slide, texto: "Responda no mesmo dia." })).not.toBe(v);
    expect(versaoDoTextoDoSlide({ ...slide })).toBe(v);
  });

  // A versão da miniatura leva a URL da foto da conta, que a Meta troca sozinha: usá-la aqui faria o
  // aviso "o texto mudou" aparecer sem o texto ter mudado.
  it("não muda com a foto da conta, ao contrário da versão da miniatura", () => {
    const comFoto = (foto: string | null) =>
      versoesDosSlides([slide], [], { nome: "Thiago", arroba: "thiago", foto, iniciais: "TH" })[0];
    expect(comFoto("https://cdn/a.jpg")).not.toBe(comFoto("https://cdn/b.jpg"));
    expect(versaoDoTextoDoSlide(slide)).toBe(versaoDoTextoDoSlide(slide));
  });
});

describe("a forma pela quantidade", () => {
  it("1 slide é imagem única; de 2 a 10 é carrossel", () => {
    expect(formaDoCarrossel(1)).toBe("imagem");
    expect(formaDoCarrossel(2)).toBe("carrossel");
    expect(formaDoCarrossel(10)).toBe("carrossel");
  });
});

describe("as imagens guardadas, lidas da coluna arte", () => {
  const img = (n: number) => ({ caminho: `${PASTA}/bonus/${UUID.slice(0, -1)}${n}.jpg`, versao: "0a1b2c3d" });

  it("lê as imagens de cada slide", () => {
    expect(imagensDaArte({ conta: PASTA, imagens: { "2": img(2), "4": img(4) } }, 5)).toEqual({ 2: img(2), 4: img(4) });
  });

  it("o que não tem a forma certa fica de fora, e não quebra a página", () => {
    expect(imagensDaArte(null, 5)).toEqual({});
    expect(imagensDaArte({}, 5)).toEqual({});
    expect(imagensDaArte({ imagens: [] }, 5)).toEqual({});
    expect(
      imagensDaArte(
        {
          imagens: {
            "0": img(0),
            "6": img(6),
            "02": img(2),
            "3": { caminho: "", versao: "0a1b2c3d" },
            "4": { caminho: img(4).caminho },
            "5": "texto",
            "1": img(1),
          },
        },
        5
      )
    ).toEqual({ 1: img(1) });
  });
});

describe("a publicação, lida da coluna arte", () => {
  const publicacao = {
    chave: `pub:${PASTA}:carrossel:a,b`,
    caminhos: ["a", "b"],
    reservada_em: "2026-10-05T15:00:00.000+00:00",
  };

  it("sem a chave publicacao, não há publicação", () => {
    expect(publicacaoDaArte({ conta: PASTA })).toBeNull();
    expect(publicacaoDaArte(null)).toBeNull();
  });

  it("lê a reserva, e a marca de enfileirada quando existe", () => {
    expect(publicacaoDaArte({ publicacao })).toEqual({
      chave: publicacao.chave,
      caminhos: ["a", "b"],
      reservadaEm: new Date("2026-10-05T15:00:00.000Z"),
      enfileiradaEm: null,
    });
    expect(publicacaoDaArte({ publicacao: { ...publicacao, enfileirada_em: "2026-10-05T15:00:01+00:00" } })).toEqual({
      chave: publicacao.chave,
      caminhos: ["a", "b"],
      reservadaEm: new Date("2026-10-05T15:00:00.000Z"),
      enfileiradaEm: new Date("2026-10-05T15:00:01Z"),
    });
  });

  // A PUBLICAÇÃO COM FORMA ESTRANHA TRAVA, e não vira "sem publicação": a regra da trava é escrita
  // pelo que libera, e o que não se reconhece não libera (spec, "A trava no servidor").
  it.each([
    ["chave vazia", { ...publicacao, chave: "" }],
    ["sem caminhos", { ...publicacao, caminhos: [] }],
    ["caminho que não é texto", { ...publicacao, caminhos: ["a", 2] }],
    ["reserva sem data", { ...publicacao, reservada_em: "ontem" }],
    ["marca de enfileirada sem data", { ...publicacao, enfileirada_em: "agora" }],
    ["um texto no lugar do objeto", "publicado"],
  ])("a forma estranha (%s) é 'estranha', e não nula", (_nome, valor) => {
    expect(publicacaoDaArte({ publicacao: valor })).toBe("estranha");
  });
});
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-publicar-regras.test.ts
```

Esperado: o arquivo cai sem casos: o módulo `lib/bonus/publicar-regras.ts` não existe.

- [ ] **Passo 3: o código**

Crie `lib/bonus/publicar-regras.ts`:

```ts
// AS REGRAS PURAS DA PUBLICAÇÃO DO CARROSSEL (spec da Etapa 5, "Por dentro"). PURO: a tela, as
// actions e o repositório leem daqui, e nenhuma regra mora no JSX nem no SQL.
import type { FormaDePublicacao } from "@/lib/publicacao";
import type { SlideParaArte } from "./arte-slides";
import { versaoDaArte } from "./arte-tela";

/**
 * OS DOIS DESTINOS DE UMA IMAGEM NO BUCKET, sempre na pasta da conta do carrossel (`pastaDaConta`,
 * lib/bucket.ts), nunca na do cookie:
 * - `slide`: a imagem do Canva guardada no slide, em `<pasta>/bonus/<uuid>.jpg`;
 * - `fila`: o que vai para a fila do /publicar (as cópias das guardadas e a arte "Só texto"
 *   convertida), em `<pasta>/bonus-fila/<uuid>.jpg`. O dreno apaga estas depois de publicar.
 * O /publicar só aceita `pasta/arquivo.ext`, com uma barra (`FORMA_DO_CAMINHO`,
 * lib/publicacao.ts), e nenhum dos dois entra por ele. O dreno não confere a forma, e os dois saem
 * por ele. A guardada nunca vai para a fila: o que vai é sempre uma cópia.
 */
export type DestinoDaImagem = "slide" | "fila";

const PREFIXO: Record<DestinoDaImagem, string> = { slide: "bonus", fila: "bonus-fila" };
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
/** A pasta já sai higienizada de `pastaDaConta`; conferir de novo impede um padrão montado errado. */
const PASTA = /^[A-Za-z0-9_-]+$/;

export function caminhoDaImagem(pasta: string, destino: DestinoDaImagem, uuid: string): string {
  return `${pasta}/${PREFIXO[destino]}/${uuid}.jpg`;
}

/** O caminho que voltou do navegador, conferido na forma exata do destino e da pasta. */
export function ehCaminhoDoDestino(caminho: unknown, pasta: string, destino: DestinoDaImagem): caminho is string {
  if (typeof caminho !== "string" || !PASTA.test(pasta)) return false;
  return new RegExp(`^${pasta}/${PREFIXO[destino]}/${UUID}\\.jpg$`).test(caminho);
}

/**
 * A IMAGEM DO SLIDE TEM DE SER 4:5, COMO A ARTE (1080×1350), com 1% de tolerância (achado 76,
 * decisão do Eduardo em 05/10). O Instagram corta todos os itens do carrossel pela proporção do
 * PRIMEIRO (lib/dedupe.ts:211-212), e uma imagem quadrada no slide 1 cortaria o texto das artes "Só
 * texto". O /publicar aceita de 0,8 a 1,91; esta regra é só da página do carrossel.
 */
export const PROPORCAO_MIN = 0.792;
export const PROPORCAO_MAX = 0.808;

export type ProblemaDaProporcao = "sem_medida" | "proporcao";

export function problemaDaProporcaoDoSlide(largura: number | undefined, altura: number | undefined): ProblemaDaProporcao | null {
  if (!largura || !altura || !(largura > 0) || !(altura > 0)) return "sem_medida";
  const p = largura / altura;
  return p >= PROPORCAO_MIN && p <= PROPORCAO_MAX ? null : "proporcao";
}

/**
 * A VERSÃO DO TEXTO DO SLIDE: o resumo só do slide (número, total, tipo, manchete e texto). Não é a
 * versão da miniatura (`versoesDosSlides`), que leva a URL da foto da conta: a Meta a troca sozinha,
 * e o aviso "o texto mudou depois desta imagem" apareceria sem o texto ter mudado.
 */
export function versaoDoTextoDoSlide(s: SlideParaArte): string {
  return versaoDaArte([JSON.stringify(s)]);
}

/** O post de 1 slide sai como imagem única; de 2 a 10, como carrossel. */
export function formaDoCarrossel(total: number): FormaDePublicacao {
  return total === 1 ? "imagem" : "carrossel";
}

export type ImagemGuardada = { caminho: string; versao: string };

const objeto = (v: unknown): Record<string, unknown> | null =>
  v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
const textoCheio = (v: unknown): v is string => typeof v === "string" && v !== "";

/**
 * As imagens guardadas nos slides (`arte.imagens`). O que não tiver a forma certa fica de fora, e
 * não quebra a página, como em `escolhasDaArte`: o slide volta a pedir a imagem.
 */
export function imagensDaArte(v: unknown, total: number): Record<number, ImagemGuardada> {
  const imagens = objeto(objeto(v)?.imagens);
  const lidas: Record<number, ImagemGuardada> = {};
  for (const [chave, valor] of Object.entries(imagens ?? {})) {
    const n = /^[1-9]\d*$/.test(chave) ? Number(chave) : 0;
    const img = objeto(valor);
    if (n < 1 || n > total || !img || !textoCheio(img.caminho) || !textoCheio(img.versao)) continue;
    lidas[n] = { caminho: img.caminho, versao: img.versao };
  }
  return lidas;
}

export type PublicacaoGuardada = {
  /** A `dedupe_key` EXATA que foi para a fila, e não os caminhos para recalcular. */
  chave: string;
  caminhos: string[];
  /** Gravada com o `now()` do banco. */
  reservadaEm: Date;
  /** Só existe depois de a fila aceitar o item (achado 75). */
  enfileiradaEm: Date | null;
};

const data = (v: unknown): Date | null => {
  if (typeof v !== "string") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * A publicação do carrossel (`arte.publicacao`). `null` quando não há. A FORMA ESTRANHA É
 * "estranha", e não `null`: a trava se escreve pelo que libera (spec, "A trava no servidor"), e o que
 * não se reconhece não libera.
 */
export function publicacaoDaArte(v: unknown): PublicacaoGuardada | null | "estranha" {
  const o = objeto(v);
  if (!o || !("publicacao" in o)) return null;
  const p = objeto(o.publicacao);
  if (!p || !textoCheio(p.chave)) return "estranha";
  const caminhos = Array.isArray(p.caminhos) ? p.caminhos : [];
  if (!caminhos.length || !caminhos.every(textoCheio)) return "estranha";
  const reservadaEm = data(p.reservada_em);
  if (!reservadaEm) return "estranha";
  const enfileiradaEm = "enfileirada_em" in p ? data(p.enfileirada_em) : null;
  if ("enfileirada_em" in p && !enfileiradaEm) return "estranha";
  return { chave: p.chave, caminhos: caminhos as string[], reservadaEm, enfileiradaEm };
}
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx vitest run tests/bonus-publicar-regras.test.ts
```

Esperado: `tsc` limpo e 29 casos passam.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/publicar-regras.ts tests/bonus-publicar-regras.test.ts
test "$(git branch --show-current)" = "publicar-do-carrossel"
git add lib/bonus/publicar-regras.ts tests/bonus-publicar-regras.test.ts
git commit -m "feat(bonus): as regras puras da publicação do carrossel"
```

---

### FASE 5.2 — O estado da publicação, a trava e as frases

**Arquivos:**
- Criar: `lib/bonus/publicar-estado.ts`, `lib/bonus/publicar-textos.ts`
- Testar: `tests/bonus-publicar-estado.test.ts`

**Interfaces:**
- Consome: `PublicacaoGuardada`, `ImagemGuardada`, `ProblemaDaProporcao` (FASE 5.1).
- Produz, de `publicar-estado.ts`: `type LinhaDaFila = { id; status; not_before: Date; sent_at: Date
  | null; error: string | null }`; `ESPERA_DA_RESERVA_MS = 10 * 60_000`; `type EstadoDaPublicacao`
  (`livre`, `agendado`, `publicando`, `publicado`, `falhou`, `cancelado`, `nao_entrou`,
  `saiu_da_fila`, `desconhecido`); `estadoDaPublicacao(publicacao, linha, agora)`;
  `publicacaoLivre(estado): boolean`; `type FaltaParaPublicar`, `faltasParaPublicar({ total, soTexto,
  imagens, origem, slidesNaoSalvos, legendaNaoSalva })`.
- Produz, de `publicar-textos.ts`: `listaDeSlides`, `textoDoEstadoDaPublicacao`, `textoDaTrava`,
  `textoDoCalendario`, `textoDaFalta`, `textoDaProporcao`, `TEXTO_TEXTO_MUDOU`,
  `TEXTO_IMAGEM_GUARDADA`, `type RecusaDaPublicacaoDoCarrossel`,
  `textoDaRecusaDaPublicacaoDoCarrossel`, `type AvisoDaImagem`, `type AvisoDaPublicacao`.

- [ ] **Passo 1: o teste**

Crie `tests/bonus-publicar-estado.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { fmtDate } from "@/lib/format";
import {
  ESPERA_DA_RESERVA_MS,
  estadoDaPublicacao,
  faltasParaPublicar,
  publicacaoLivre,
  type EstadoDaPublicacao,
  type LinhaDaFila,
} from "@/lib/bonus/publicar-estado";
import type { PublicacaoGuardada } from "@/lib/bonus/publicar-regras";
import {
  listaDeSlides,
  textoDaFalta,
  textoDaRecusaDaPublicacaoDoCarrossel,
  textoDaTrava,
  textoDoCalendario,
  textoDoEstadoDaPublicacao,
  type RecusaDaPublicacaoDoCarrossel,
} from "@/lib/bonus/publicar-textos";

// O ESTADO DA PUBLICAÇÃO E A TRAVA (spec da Etapa 5, "O estado da publicação" e "A trava no
// servidor"). A trava se escreve pelo que LIBERA, e todo o resto trava: um estado novo da fila trava
// sozinho.

const AGORA = new Date("2026-10-05T15:00:00Z");
const antes = (ms: number) => new Date(AGORA.getTime() - ms);
const depois = (ms: number) => new Date(AGORA.getTime() + ms);

const reserva = (p: Partial<PublicacaoGuardada> = {}): PublicacaoGuardada => ({
  chave: "pub:178:carrossel:a,b",
  caminhos: ["a", "b"],
  reservadaEm: antes(1_000),
  enfileiradaEm: antes(900),
  ...p,
});
const linha = (p: Partial<LinhaDaFila> = {}): LinhaDaFila => ({
  id: "fila-1",
  status: "pending",
  not_before: depois(3_600_000),
  sent_at: null,
  error: null,
  ...p,
});

describe("o estado da publicação, lido da fila", () => {
  it("sem publicação, o carrossel está livre", () => {
    expect(estadoDaPublicacao(null, null, AGORA)).toEqual({ tipo: "livre" });
  });

  it("pendente com hora no futuro é agendado", () => {
    expect(estadoDaPublicacao(reserva(), linha(), AGORA)).toEqual({ tipo: "agendado", quando: depois(3_600_000), filaId: "fila-1" });
  });

  it("pendente com a hora vencida, ou enviando, é publicando", () => {
    expect(estadoDaPublicacao(reserva(), linha({ not_before: AGORA }), AGORA)).toEqual({ tipo: "publicando", filaId: "fila-1" });
    expect(estadoDaPublicacao(reserva(), linha({ status: "sending", not_before: antes(5) }), AGORA)).toEqual({
      tipo: "publicando",
      filaId: "fila-1",
    });
  });

  it("enviado é publicado, com a hora do envio", () => {
    expect(estadoDaPublicacao(reserva(), linha({ status: "sent", sent_at: antes(60_000) }), AGORA)).toEqual({
      tipo: "publicado",
      em: antes(60_000),
      filaId: "fila-1",
    });
  });

  it("falhou leva o motivo da fila, e cancelado é cancelado", () => {
    expect(estadoDaPublicacao(reserva(), linha({ status: "failed", error: "a Meta recusou" }), AGORA)).toEqual({
      tipo: "falhou",
      motivo: "a Meta recusou",
      filaId: "fila-1",
    });
    expect(estadoDaPublicacao(reserva(), linha({ status: "skipped" }), AGORA)).toEqual({ tipo: "cancelado", filaId: "fila-1" });
  });

  it("um estado que a fila venha a ter, e que o Chat não conhece, é desconhecido", () => {
    expect(estadoDaPublicacao(reserva(), linha({ status: "guardado" }), AGORA)).toEqual({ tipo: "desconhecido", status: "guardado" });
  });

  it("a publicação de forma estranha é desconhecida, com ou sem linha", () => {
    expect(estadoDaPublicacao("estranha", null, AGORA)).toEqual({ tipo: "desconhecido" });
  });

  it("a reserva nunca enfileirada, sem linha, é publicando por 10 minutos, e depois não entrou", () => {
    const nunca = (ms: number) => reserva({ reservadaEm: antes(ms), enfileiradaEm: null });
    expect(ESPERA_DA_RESERVA_MS).toBe(10 * 60_000);
    expect(estadoDaPublicacao(nunca(ESPERA_DA_RESERVA_MS - 1), null, AGORA)).toEqual({ tipo: "publicando", filaId: null });
    expect(estadoDaPublicacao(nunca(ESPERA_DA_RESERVA_MS), null, AGORA)).toEqual({ tipo: "nao_entrou" });
  });

  // ACHADO 75: desconectar a conta apaga as linhas da fila dela (lib/db.ts:469-474). O carrossel
  // publicado não pode cair em "não entrou" e ficar livre: um clique publicaria de novo.
  it("a enfileirada sem linha saiu da fila, mesmo depois dos 10 minutos", () => {
    expect(estadoDaPublicacao(reserva({ reservadaEm: antes(86_400_000), enfileiradaEm: antes(86_399_000) }), null, AGORA)).toEqual({
      tipo: "saiu_da_fila",
    });
  });
});

describe("a trava: o que libera", () => {
  const estados: [EstadoDaPublicacao, boolean][] = [
    [{ tipo: "livre" }, true],
    [{ tipo: "falhou", motivo: null, filaId: "f" }, true],
    [{ tipo: "cancelado", filaId: "f" }, true],
    [{ tipo: "nao_entrou" }, true],
    [{ tipo: "agendado", quando: AGORA, filaId: "f" }, false],
    [{ tipo: "publicando", filaId: null }, false],
    [{ tipo: "publicado", em: AGORA, filaId: "f" }, false],
    [{ tipo: "saiu_da_fila" }, false],
    [{ tipo: "desconhecido" }, false],
  ];
  it.each(estados)("%o: livre = %s", (estado, livre) => {
    expect(publicacaoLivre(estado)).toBe(livre);
  });
});

describe("as frases do estado", () => {
  it("livre não tem frase; os outros têm", () => {
    expect(textoDoEstadoDaPublicacao({ tipo: "livre" })).toBeNull();
    expect(textoDoEstadoDaPublicacao({ tipo: "agendado", quando: depois(3_600_000), filaId: "f" })).toBe(
      `Agendado para ${fmtDate(depois(3_600_000))} (horário de Brasília).`
    );
    expect(textoDoEstadoDaPublicacao({ tipo: "publicado", em: antes(60_000), filaId: "f" })).toBe(`Publicado em ${fmtDate(antes(60_000))}.`);
    expect(textoDoEstadoDaPublicacao({ tipo: "publicado", em: null, filaId: "f" })).toBe("Publicado.");
    expect(textoDoEstadoDaPublicacao({ tipo: "falhou", motivo: "a Meta recusou", filaId: "f" })).toBe(
      "Não publicou: a Meta recusou. Dá para publicar de novo."
    );
    expect(textoDoEstadoDaPublicacao({ tipo: "falhou", motivo: null, filaId: "f" })).toBe(
      "Não publicou, e a fila não disse o motivo. Dá para publicar de novo."
    );
    expect(textoDoEstadoDaPublicacao({ tipo: "nao_entrou" })).toBe("A última tentativa não entrou na fila. Dá para publicar de novo.");
    expect(textoDoEstadoDaPublicacao({ tipo: "saiu_da_fila" })).toContain("A conta foi desconectada?");
    for (const e of [
      { tipo: "publicando", filaId: null },
      { tipo: "cancelado", filaId: "f" },
      { tipo: "desconhecido" },
    ] as EstadoDaPublicacao[]) {
      expect(textoDoEstadoDaPublicacao(e)).toMatch(/\.$/);
    }
  });

  it("a trava das edições diz por que o carrossel não muda", () => {
    expect(textoDaTrava({ tipo: "agendado", quando: AGORA, filaId: "f" })).toBe("Agendado: para mudar, cancele no calendário.");
    expect(textoDaTrava({ tipo: "publicando", filaId: null })).toBe("Publicando: o carrossel não muda até o post sair.");
    expect(textoDaTrava({ tipo: "publicado", em: AGORA, filaId: "f" })).toBe("Este carrossel já foi publicado, e fica só para leitura.");
    expect(textoDaTrava({ tipo: "saiu_da_fila" })).toBe(textoDoEstadoDaPublicacao({ tipo: "saiu_da_fila" }));
    expect(textoDaTrava({ tipo: "desconhecido" })).toBe(textoDoEstadoDaPublicacao({ tipo: "desconhecido" }));
  });

  it("o calendário é da conta selecionada no menu", () => {
    expect(textoDoCalendario("Thiago Vannuchi")).toBe("Para ver no calendário, selecione Thiago Vannuchi no menu.");
  });
});

describe("o que falta para publicar", () => {
  const base = {
    total: 5,
    soTexto: [1, 5],
    imagens: { 2: { caminho: "c2", versao: "v" }, 3: { caminho: "c3", versao: "v" } },
    origem: "gravada" as const,
    slidesNaoSalvos: [],
    legendaNaoSalva: false,
  };

  it("nada falta quando todo slide com espaço tem imagem e nada está sem salvar", () => {
    expect(faltasParaPublicar({ ...base, imagens: { ...base.imagens, 4: { caminho: "c4", versao: "v" } } })).toEqual([]);
  });

  it("os slides com espaço sem imagem; os só texto não pedem", () => {
    expect(faltasParaPublicar(base)).toEqual([{ tipo: "imagens", slides: [4] }]);
    expect(faltasParaPublicar({ ...base, imagens: {} })).toEqual([{ tipo: "imagens", slides: [2, 3, 4] }]);
  });

  it("o não salvo, porque o que sai é o texto salvo", () => {
    const tudo = { ...base, imagens: { ...base.imagens, 4: { caminho: "c4", versao: "v" } } };
    expect(faltasParaPublicar({ ...tudo, slidesNaoSalvos: [3], legendaNaoSalva: true })).toEqual([
      { tipo: "nao_salvo", slides: [3], legenda: true },
    ]);
  });

  it("a conta vem antes de tudo: sem conta gravada, ou desconectada", () => {
    expect(faltasParaPublicar({ ...base, origem: "selecionada" })[0]).toEqual({ tipo: "sem_conta" });
    expect(faltasParaPublicar({ ...base, origem: "guardada" })[0]).toEqual({ tipo: "conta_desconectada" });
    expect(faltasParaPublicar({ ...base, origem: "gravada_saiu" })[0]).toEqual({ tipo: "conta_desconectada" });
  });

  it("as frases", () => {
    expect(listaDeSlides([2])).toBe("o slide 2");
    expect(listaDeSlides([2, 5])).toBe("os slides 2 e 5");
    expect(listaDeSlides([2, 3, 5])).toBe("os slides 2, 3 e 5");
    expect(textoDaFalta({ tipo: "imagens", slides: [2] })).toBe("Falta a imagem do slide 2.");
    expect(textoDaFalta({ tipo: "imagens", slides: [2, 5] })).toBe("Falta a imagem dos slides 2 e 5.");
    expect(textoDaFalta({ tipo: "nao_salvo", slides: [3], legenda: false })).toBe("Salve o slide 3 antes de publicar.");
    expect(textoDaFalta({ tipo: "nao_salvo", slides: [], legenda: true })).toBe("Salve a legenda antes de publicar.");
    expect(textoDaFalta({ tipo: "nao_salvo", slides: [2, 3], legenda: true })).toBe("Salve os slides 2 e 3 e a legenda antes de publicar.");
    expect(textoDaFalta({ tipo: "sem_conta" })).toContain("Fixar nesta conta");
    expect(textoDaFalta({ tipo: "conta_desconectada" })).toContain("desconectada");
  });
});

describe("as recusas da publicação têm frase, cada uma", () => {
  const recusas: RecusaDaPublicacaoDoCarrossel[] = [
    { motivo: "nao_pronto" },
    { motivo: "sem_conta" },
    { motivo: "conta_desconectada" },
    { motivo: "travado", estado: { tipo: "agendado", quando: AGORA, filaId: "f" } },
    { motivo: "slide" },
    { motivo: "sem_espaco", numero: 2 },
    { motivo: "nao_e_so_texto", numero: 3 },
    { motivo: "tipo" },
    { motivo: "proporcao", problema: "proporcao" },
    { motivo: "proporcao", problema: "sem_medida" },
    { motivo: "arquivo", texto: "A imagem é estreita demais: a largura mínima é 320 pixels." },
    { motivo: "caminho" },
    { motivo: "faltam_imagens", slides: [2, 4] },
    { motivo: "arte_so_texto", numero: 5 },
    { motivo: "arte_velha", numero: 5 },
    { motivo: "caminho_na_fila" },
    { motivo: "legenda", texto: "A legenda passa de 2.200 caracteres." },
    { motivo: "copia", numero: 2 },
    { motivo: "mudou" },
    { motivo: "fila" },
    { motivo: "armazenamento", texto: "Nao foi possivel assinar o upload no bucket: HTTP 500" },
  ];

  it("toda recusa tem frase própria, terminada em ponto", () => {
    const frases = recusas.map(textoDaRecusaDaPublicacaoDoCarrossel);
    for (const f of frases) expect(f).toMatch(/\.$/);
    expect(new Set(frases).size).toBe(frases.length);
  });

  it("a proporção diz o 4:5 e o tamanho da arte", () => {
    expect(textoDaRecusaDaPublicacaoDoCarrossel({ motivo: "proporcao", problema: "proporcao" })).toBe(
      "A imagem do slide tem de ser 4:5, como a arte (1080×1350)."
    );
  });

  it("a travada usa a frase da trava, e a de imagens usa a lista de slides", () => {
    const estado: EstadoDaPublicacao = { tipo: "publicado", em: AGORA, filaId: "f" };
    expect(textoDaRecusaDaPublicacaoDoCarrossel({ motivo: "travado", estado })).toBe(textoDaTrava(estado));
    expect(textoDaRecusaDaPublicacaoDoCarrossel({ motivo: "faltam_imagens", slides: [2, 4] })).toBe("Falta a imagem dos slides 2 e 4.");
  });
});
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-publicar-estado.test.ts
```

Esperado: o arquivo cai sem casos: `lib/bonus/publicar-estado.ts` e `lib/bonus/publicar-textos.ts` não existem.

- [ ] **Passo 3: o código**

Crie `lib/bonus/publicar-estado.ts`:

```ts
// O ESTADO DA PUBLICAÇÃO DO CARROSSEL E O QUE FALTA PARA PUBLICAR (spec da Etapa 5). PURO: o
// repositório lê a linha da fila e o relógio do banco, e esta função decide.
import type { OrigemDaConta } from "./arte-conta";
import type { ImagemGuardada, PublicacaoGuardada } from "./publicar-regras";

/** A linha da fila do /publicar, lida pela `dedupe_key` exata que o carrossel guardou. */
export type LinhaDaFila = { id: string; status: string; not_before: Date; sent_at: Date | null; error: string | null };

/**
 * QUANTO A RESERVA SEM LINHA NA FILA ESPERA ATÉ CONTAR COMO "NÃO ENTROU". A reserva vem antes da fila
 * (spec, "Por que a reserva vem antes da fila"), e a fila é gravada logo depois, na mesma requisição:
 * em 10 minutos sem linha, ela não vai mais aparecer. Contados no relógio do banco.
 */
export const ESPERA_DA_RESERVA_MS = 10 * 60_000;

export type EstadoDaPublicacao =
  | { tipo: "livre" }
  | { tipo: "agendado"; quando: Date; filaId: string }
  | { tipo: "publicando"; filaId: string | null }
  | { tipo: "publicado"; em: Date | null; filaId: string }
  | { tipo: "falhou"; motivo: string | null; filaId: string }
  | { tipo: "cancelado"; filaId: string }
  | { tipo: "nao_entrou" }
  | { tipo: "saiu_da_fila" }
  | { tipo: "desconhecido"; status?: string };

export function estadoDaPublicacao(
  publicacao: PublicacaoGuardada | null | "estranha",
  linha: LinhaDaFila | null,
  agora: Date
): EstadoDaPublicacao {
  if (publicacao === null) return { tipo: "livre" };
  if (publicacao === "estranha") return { tipo: "desconhecido" };
  if (linha) {
    switch (linha.status) {
      case "pending":
        return linha.not_before.getTime() > agora.getTime()
          ? { tipo: "agendado", quando: linha.not_before, filaId: linha.id }
          : { tipo: "publicando", filaId: linha.id };
      case "sending":
        return { tipo: "publicando", filaId: linha.id };
      case "sent":
        return { tipo: "publicado", em: linha.sent_at, filaId: linha.id };
      case "failed":
        return { tipo: "falhou", motivo: linha.error, filaId: linha.id };
      case "skipped":
        return { tipo: "cancelado", filaId: linha.id };
      default:
        return { tipo: "desconhecido", status: linha.status };
    }
  }
  // SEM LINHA. Enfileirada e sem linha é a linha apagada pelo `deleteAccount` (lib/db.ts:469-474,
  // achado 75): trava para sempre, para um clique não publicar o mesmo post de novo.
  if (publicacao.enfileiradaEm) return { tipo: "saiu_da_fila" };
  return agora.getTime() - publicacao.reservadaEm.getTime() >= ESPERA_DA_RESERVA_MS ? { tipo: "nao_entrou" } : { tipo: "publicando", filaId: null };
}

/**
 * A TRAVA SE ESCREVE PELO QUE LIBERA, e todo o resto trava: agendado, publicando, publicado, a que
 * saiu da fila, e qualquer estado que a fila venha a ter (spec, "A trava no servidor").
 */
export function publicacaoLivre(e: EstadoDaPublicacao): boolean {
  return e.tipo === "livre" || e.tipo === "falhou" || e.tipo === "cancelado" || e.tipo === "nao_entrou";
}

export type FaltaParaPublicar =
  | { tipo: "sem_conta" }
  | { tipo: "conta_desconectada" }
  | { tipo: "imagens"; slides: number[] }
  | { tipo: "nao_salvo"; slides: number[]; legenda: boolean };

/**
 * O QUE TRAVA O BOTÃO "PUBLICAR" NA TELA, na ordem em que se resolve: a conta, as imagens dos slides
 * com espaço, e o que está "não salvo" (o que sai é o texto salvo, e não o que está nos campos).
 */
export function faltasParaPublicar(p: {
  total: number;
  soTexto: number[];
  imagens: Record<number, ImagemGuardada>;
  origem: OrigemDaConta;
  slidesNaoSalvos: number[];
  legendaNaoSalva: boolean;
}): FaltaParaPublicar[] {
  const faltas: FaltaParaPublicar[] = [];
  if (p.origem === "selecionada") faltas.push({ tipo: "sem_conta" });
  if (p.origem === "guardada" || p.origem === "gravada_saiu") faltas.push({ tipo: "conta_desconectada" });
  const semImagem: number[] = [];
  for (let n = 1; n <= p.total; n++) if (!p.soTexto.includes(n) && !p.imagens[n]) semImagem.push(n);
  if (semImagem.length) faltas.push({ tipo: "imagens", slides: semImagem });
  if (p.slidesNaoSalvos.length || p.legendaNaoSalva) {
    faltas.push({ tipo: "nao_salvo", slides: [...p.slidesNaoSalvos].sort((a, b) => a - b), legenda: p.legendaNaoSalva });
  }
  return faltas;
}
```

Crie `lib/bonus/publicar-textos.ts`:

```ts
import type { Aviso } from "@/lib/avisos";
import { fmtDate } from "@/lib/format";
import type { EstadoDaPublicacao, FaltaParaPublicar } from "./publicar-estado";
import type { ProblemaDaProporcao } from "./publicar-regras";

// AS FRASES DA PUBLICAÇÃO DO CARROSSEL, fora do JSX e das actions (o princípio de
// lib/bonus/textos.ts): uma saída muda é indistinguível de sucesso, e cada saída tem frase, testada.

/** "o slide 2", "os slides 2 e 5", "os slides 2, 3 e 5". */
export function listaDeSlides(numeros: number[]): string {
  if (numeros.length === 1) return `o slide ${numeros[0]}`;
  return `os slides ${numeros.slice(0, -1).join(", ")} e ${numeros[numeros.length - 1]}`;
}

const doSlides = (numeros: number[]) => listaDeSlides(numeros).replace(/^os /, "dos ").replace(/^o /, "do ");

/** O estado no lugar do botão "Publicar". `null` quando o carrossel nunca foi mandado. */
export function textoDoEstadoDaPublicacao(e: EstadoDaPublicacao): string | null {
  switch (e.tipo) {
    case "livre":
      return null;
    case "agendado":
      return `Agendado para ${fmtDate(e.quando)} (horário de Brasília).`;
    case "publicando":
      return "Publicando. O Instagram leva até um minuto: recarregue a página para ver.";
    case "publicado":
      return e.em ? `Publicado em ${fmtDate(e.em)}.` : "Publicado.";
    case "falhou":
      return e.motivo
        ? `Não publicou: ${e.motivo.replace(/\.$/, "")}. Dá para publicar de novo.`
        : "Não publicou, e a fila não disse o motivo. Dá para publicar de novo.";
    case "cancelado":
      return "Cancelado no calendário. Dá para publicar de novo.";
    case "nao_entrou":
      return "A última tentativa não entrou na fila. Dá para publicar de novo.";
    case "saiu_da_fila":
      return "O registro deste post saiu da fila. A conta foi desconectada? O carrossel segue travado, para não publicar duas vezes.";
    case "desconhecido":
      return "O post deste carrossel está num estado que o Chat não reconhece. O carrossel segue travado: avise quem cuida do Chat.";
  }
}

/** Por que uma edição foi recusada: o carrossel está na fila, ou já saiu. */
export function textoDaTrava(e: EstadoDaPublicacao): string {
  switch (e.tipo) {
    case "agendado":
      return "Agendado: para mudar, cancele no calendário.";
    case "publicando":
      return "Publicando: o carrossel não muda até o post sair.";
    case "publicado":
      return "Este carrossel já foi publicado, e fica só para leitura.";
    default:
      return textoDoEstadoDaPublicacao(e) ?? "";
  }
}

/** O calendário do /publicar mostra só a conta selecionada no menu. */
export function textoDoCalendario(rotuloDaConta: string): string {
  return `Para ver no calendário, selecione ${rotuloDaConta} no menu.`;
}

export const TEXTO_SEM_CONTA_PARA_PUBLICAR =
  'Este carrossel é de antes de a conta ser gravada. Use "Fixar nesta conta" antes de publicar.';
export const TEXTO_CONTA_DESCONECTADA_PARA_PUBLICAR = "A conta deste carrossel foi desconectada do Chat. Conecte de novo para publicar.";
export const TEXTO_TEXTO_MUDOU = "O texto mudou depois desta imagem.";
export const TEXTO_IMAGEM_GUARDADA = "Imagem guardada.";

export function textoDaFalta(f: FaltaParaPublicar): string {
  switch (f.tipo) {
    case "sem_conta":
      return TEXTO_SEM_CONTA_PARA_PUBLICAR;
    case "conta_desconectada":
      return TEXTO_CONTA_DESCONECTADA_PARA_PUBLICAR;
    case "imagens":
      return `Falta a imagem ${doSlides(f.slides)}.`;
    case "nao_salvo": {
      const partes = [...(f.slides.length ? [listaDeSlides(f.slides)] : []), ...(f.legenda ? ["a legenda"] : [])];
      return `Salve ${partes.join(" e ")} antes de publicar.`;
    }
  }
}

export function textoDaProporcao(p: ProblemaDaProporcao): string {
  return p === "proporcao"
    ? "A imagem do slide tem de ser 4:5, como a arte (1080×1350)."
    : "Não consegui ler o tamanho da imagem. Exporte de novo do Canva e tente outra vez.";
}

/** As recusas de assinar, guardar e publicar (publicar-processo.ts). */
export type RecusaDaPublicacaoDoCarrossel =
  | { motivo: "nao_pronto" }
  | { motivo: "sem_conta" }
  | { motivo: "conta_desconectada" }
  | { motivo: "travado"; estado: EstadoDaPublicacao }
  | { motivo: "slide" }
  | { motivo: "sem_espaco"; numero: number }
  | { motivo: "nao_e_so_texto"; numero: number }
  | { motivo: "tipo" }
  | { motivo: "proporcao"; problema: ProblemaDaProporcao }
  | { motivo: "arquivo"; texto: string }
  | { motivo: "caminho" }
  | { motivo: "faltam_imagens"; slides: number[] }
  | { motivo: "arte_so_texto"; numero: number }
  | { motivo: "arte_velha"; numero: number }
  | { motivo: "caminho_na_fila" }
  | { motivo: "legenda"; texto: string }
  | { motivo: "copia"; numero: number }
  | { motivo: "mudou" }
  | { motivo: "fila" }
  | { motivo: "armazenamento"; texto: string };

export function textoDaRecusaDaPublicacaoDoCarrossel(r: RecusaDaPublicacaoDoCarrossel): string {
  switch (r.motivo) {
    case "nao_pronto":
      return "A publicação só existe para carrossel pronto, com o texto conferido.";
    case "sem_conta":
      return TEXTO_SEM_CONTA_PARA_PUBLICAR;
    case "conta_desconectada":
      return TEXTO_CONTA_DESCONECTADA_PARA_PUBLICAR;
    case "travado":
      return textoDaTrava(r.estado);
    case "slide":
      return "Esse slide não existe neste carrossel. Recarregue a página.";
    case "sem_espaco":
      return `O slide ${r.numero} está marcado como "só texto": ele sai com a arte do Chat, sem imagem do Canva.`;
    case "nao_e_so_texto":
      return `O slide ${r.numero} tem espaço de imagem: ele sai com a imagem do Canva, e não com a arte do Chat.`;
    case "tipo":
      return "A imagem tem de chegar em JPEG. Recarregue a página e tente de novo.";
    case "proporcao":
      return textoDaProporcao(r.problema);
    case "arquivo":
      return r.texto;
    case "caminho":
      return "O endereço da imagem não é deste carrossel. Recarregue a página e suba de novo.";
    case "faltam_imagens":
      return `Falta a imagem ${doSlides(r.slides)}.`;
    case "arte_so_texto":
      return `A arte do slide ${r.numero} não chegou. Recarregue a página e publique de novo.`;
    case "arte_velha":
      return `O texto do slide ${r.numero} mudou enquanto a arte era preparada. Publique de novo.`;
    case "caminho_na_fila":
      return "Uma das imagens já está na fila de outro post. Recarregue a página e publique de novo.";
    case "legenda":
      return r.texto;
    case "copia":
      return `Não consegui preparar a imagem do slide ${r.numero} para a fila. Nada foi publicado; tente de novo em instantes.`;
    case "mudou":
      return "O carrossel mudou enquanto a publicação era preparada. Confira e publique de novo.";
    case "fila":
      return "Não consegui pôr o post na fila. Nada foi publicado; tente de novo.";
    case "armazenamento":
      return `Não consegui falar com o armazenamento das imagens: ${r.texto.replace(/\.$/, "")}.`;
  }
}

/** A resposta de assinar e de guardar a imagem de um slide, como ESTADO (achado 52). */
export type AvisoDaImagem = Aviso & { em: number };

/** A resposta do "Publicar", como ESTADO. */
export type AvisoDaPublicacao = Aviso & { em: number };
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx vitest run tests/bonus-publicar-estado.test.ts
```

Esperado: `tsc` limpo e 29 casos passam.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/publicar-estado.ts lib/bonus/publicar-textos.ts tests/bonus-publicar-estado.test.ts
test "$(git branch --show-current)" = "publicar-do-carrossel"
git add lib/bonus/publicar-estado.ts lib/bonus/publicar-textos.ts tests/bonus-publicar-estado.test.ts
git commit -m "feat(bonus): o estado da publicação do carrossel, a trava e as frases"
```

---

### FASE 5.3 — Guardar a imagem, a reserva, e a trava nas gravações da Etapa 4

**Arquivos:**
- Criar: `lib/bonus/publicar-repositorio.ts`
- Modificar: `lib/bonus/carrossel-repositorio.ts`, `app/bonus/carrossel-actions.ts`
- Testar: `testes-integracao/bonus-publicar-repositorio.integracao.ts`,
  `testes-integracao/bonus-carrossel-processo.integracao.ts`

**Interfaces:**
- Consome: as regras da FASE 5.1 e o estado da FASE 5.2; `pastaDaConta` (`lib/bucket.ts`).
- Produz, de `publicar-repositorio.ts`: `estadoDaPublicacaoNa(consulta, arte)` (`sql()` ou a
  transação); `estadoDoCarrossel(arte)`; `gravarImagemDoSlide(id, numero, caminho)`, que devolve `{
  ok: true; anterior: string | null; versao }` ou `{ ok: false; recusa }`; `caminhosNaFila(caminhos):
  Promise<string[]>`; `type ConferidoParaPublicar = { texto; soTexto; imagens: Record<number, string>
  }`; `reservarPublicacao(id, conferido, chave, caminhos)`, que devolve `{ ok: true; legenda; velha:
  PublicacaoGuardada | null }` ou a recusa; `marcarEnfileirada(id, chave): Promise<boolean>`;
  `desfazerReserva(id, chave)`.
- Muda, em `carrossel-repositorio.ts`: `salvarParteDoCarrossel` ganha o motivo `{ ok: false; motivo:
  "travado"; estado }`; `salvarSoTextoDaArte` passa a ser uma transação com a linha travada e a
  responder `{ ok: true }`, `{ ok: false; motivo: "nao_pronto" }` ou `{ ok: false; motivo: "travado";
  estado }`. As duas actions da Etapa 4 respondem a trava com `textoDaTrava`.

- [ ] **Passo 1: os testes**

Crie `testes-integracao/bonus-publicar-repositorio.integracao.ts`:

```ts
// A PUBLICAÇÃO DO CARROSSEL CONTRA O BANCO DE VERDADE (o container), spec da Etapa 5.
//
// As proteções desta fase são a linha travada (`for update`), os `update`s condicionais pela chave
// da reserva e a leitura da fila, e nenhuma delas é visível para tsc, lint ou a suíte pura. Nada aqui
// fala com o bucket nem com a Meta: o repositório só grava caminhos.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { TextoDeCarrossel } from "@/lib/bonus/carrossel-texto";
import { bancoDescartavel } from "./harness";

type ModuloRepo = typeof import("@/lib/bonus/carrossel-repositorio");
type ModuloPublicar = typeof import("@/lib/bonus/publicar-repositorio");
type ModuloRegras = typeof import("@/lib/bonus/publicar-regras");
type ModuloSlides = typeof import("@/lib/bonus/arte-slides");

const banco = bancoDescartavel();

const CONTA = "17841400000000001";
const OUTRA = "17841400000000002";
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const guardada = (n: number, pasta = CONTA) => `${pasta}/bonus/${uuid(n)}.jpg`;
const daFila = (n: number, pasta = CONTA) => `${pasta}/bonus-fila/${uuid(n)}.jpg`;

const slide = (i: number) => ({
  titulo: `Título do slide ${i}`,
  texto: `Texto do slide ${i}, com mais de trinta caracteres.`,
});
const TEXTO: TextoDeCarrossel = {
  tipo: "carrossel",
  titulo: "Mensagens para reativar clientes",
  gancho: "Seu cliente sumiu? Não é culpa dele.",
  slides: [slide(1), slide(2), slide(3)],
  chamada: "Comente SUMIDO e receba as mensagens prontas.",
  legenda:
    "Quem sumiu ainda pode voltar. Comente SUMIDO que eu te mando as mensagens prontas para usar hoje mesmo.",
};
// 5 slides: o 1 (gancho) e o 5 (chamada) são "só texto"; o 2, o 3 e o 4 têm espaço de imagem.
const ARTE = { conta: CONTA, nome: "Thiago Vannuchi", arroba: "thiagovannuchi", soTexto: [1, 5] };

let repo: ModuloRepo;
let publicar: ModuloPublicar;
let regras: ModuloRegras;
let slides: ModuloSlides;
let bonusId: string;

beforeAll(async () => {
  repo = await import("@/lib/bonus/carrossel-repositorio");
  publicar = await import("@/lib/bonus/publicar-repositorio");
  regras = await import("@/lib/bonus/publicar-regras");
  slides = await import("@/lib/bonus/arte-slides");
});

beforeEach(async () => {
  await banco.db().sql().query(`delete from queue`);
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

async function carrossel(arte: Record<string, unknown> = ARTE, estado = "pronto"): Promise<string> {
  const [c] = (await banco
    .db()
    .sql()
    .query(
      `insert into carrosseis_gerados (bonus_id, total_slides, palavra, contexto, estado, gerado, arte)
       values ($1, 5, 'SUMIDO', '{}'::jsonb, $2, $3::jsonb, $4::jsonb) returning id`,
      [bonusId, estado, TEXTO, arte]
    )) as { id: string }[];
  return c.id;
}

async function arteDe(id: string): Promise<Record<string, unknown>> {
  const [l] = (await banco.db().sql().query(`select arte from carrosseis_gerados where id = $1`, [id])) as { arte: Record<string, unknown> }[];
  return l.arte;
}

/** Uma linha da fila com a chave dada, no estado dado. */
async function naFila(chave: string, status: string, caminhos: string[] = [daFila(90)], adiante = "1 hour"): Promise<void> {
  await banco
    .db()
    .sql()
    .query(
      `insert into queue (account_id, kind, payload, dedupe_key, status, not_before)
       values ($1, 'publicacao', $2::jsonb, $3, $4, now() + $5::interval)`,
      [CONTA, { forma: "carrossel", caminhos }, chave, status, adiante]
    );
}

/** O carrossel com uma publicação reservada (e enfileirada, por padrão) com a chave dada. */
async function publicado(chave: string, extra: Record<string, unknown> = {}, enfileirada = true): Promise<string> {
  const id = await carrossel();
  await banco
    .db()
    .sql()
    .query(
      `update carrosseis_gerados set arte = arte || jsonb_build_object('publicacao',
         $2::jsonb || jsonb_build_object('reservada_em', now()) || case when $3 then jsonb_build_object('enfileirada_em', now()) else '{}'::jsonb end)
       where id = $1`,
      [id, { chave, caminhos: [daFila(90)], ...extra }, enfileirada]
    );
  return id;
}

const versaoDo = (n: number) => regras.versaoDoTextoDoSlide(slides.slidesDoTexto(TEXTO)[n - 1]);

describe("guardar a imagem de um slide", () => {
  it("grava só aquele slide, com a versão do texto salvo, e mantém a conta e o só texto", async () => {
    const id = await carrossel();
    const r = await publicar.gravarImagemDoSlide(id, 3, guardada(3));
    expect(r).toEqual({ ok: true, anterior: null, versao: versaoDo(3) });
    const arte = await arteDe(id);
    expect(arte.imagens).toEqual({ "3": { caminho: guardada(3), versao: versaoDo(3) } });
    expect(arte.conta).toBe(CONTA);
    expect(arte.soTexto).toEqual([1, 5]);
  });

  it("a troca devolve a anterior, para ela sair do bucket, e não mexe nos outros slides", async () => {
    const id = await carrossel();
    await publicar.gravarImagemDoSlide(id, 2, guardada(2));
    await publicar.gravarImagemDoSlide(id, 3, guardada(3));
    expect(await publicar.gravarImagemDoSlide(id, 3, guardada(33))).toEqual({ ok: true, anterior: guardada(3), versao: versaoDo(3) });
    expect(regras.imagensDaArte(await arteDe(id), 5)).toEqual({
      2: { caminho: guardada(2), versao: versaoDo(2) },
      3: { caminho: guardada(33), versao: versaoDo(3) },
    });
  });

  it.each([
    ["outra pasta", 3, guardada(3, OUTRA), "caminho"],
    ["o prefixo da fila", 3, daFila(3), "caminho"],
    ["o slide só texto", 1, guardada(1), "sem_espaco"],
    ["o slide que não existe", 6, guardada(6), "slide"],
  ])("recusa %s", async (_nome, numero, caminho, motivo) => {
    const id = await carrossel();
    const r = await publicar.gravarImagemDoSlide(id, numero, caminho);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.recusa.motivo).toBe(motivo);
    expect((await arteDe(id)).imagens).toBeUndefined();
  });

  it("recusa o carrossel sem conta e o que não está pronto", async () => {
    const semConta = await carrossel({ soTexto: [] });
    const r1 = await publicar.gravarImagemDoSlide(semConta, 3, guardada(3));
    expect(r1.ok ? null : r1.recusa.motivo).toBe("sem_conta");
    const gerando = await carrossel(ARTE, "gerando");
    const r2 = await publicar.gravarImagemDoSlide(gerando, 3, guardada(3));
    expect(r2.ok ? null : r2.recusa.motivo).toBe("nao_pronto");
  });
});

// A TRAVA VALE NO SERVIDOR (spec, "A trava no servidor"): livre só sem publicação, com a linha em
// failed ou skipped, ou com a reserva nunca enfileirada e velha. Todo o resto trava.
describe("a trava nas gravações do carrossel", () => {
  const CHAVE = `pub:${CONTA}:carrossel:${daFila(90)}`;
  const tentar = async (id: string) => ({
    slide: await repo.salvarParteDoCarrossel(id, { tipo: "slide", numero: 2 }, { slide_1_titulo: "Outro título do slide 1", slide_1_texto: TEXTO.slides[0].texto }, null),
    soTexto: await repo.salvarSoTextoDaArte(id, [1], null),
    imagem: await publicar.gravarImagemDoSlide(id, 3, guardada(3)),
  });
  const motivos = (r: Awaited<ReturnType<typeof tentar>>) => [
    r.slide.ok ? "ok" : r.slide.motivo,
    r.soTexto.ok ? "ok" : r.soTexto.motivo,
    r.imagem.ok ? "ok" : r.imagem.recusa.motivo,
  ];

  it.each(["pending", "sending", "sent"])("com a linha da fila em %s, salvar, só texto e guardar são recusados", async (status) => {
    const id = await publicado(CHAVE);
    await naFila(CHAVE, status);
    const r = await tentar(id);
    expect(motivos(r)).toEqual(["travado", "travado", "travado"]);
    const arte = await arteDe(id);
    expect(arte.soTexto).toEqual([1, 5]);
    expect(arte.imagens).toBeUndefined();
  });

  it.each(["failed", "skipped"])("com a linha da fila em %s, as gravações voltam", async (status) => {
    const id = await publicado(CHAVE);
    await naFila(CHAVE, status);
    expect(motivos(await tentar(id))).toEqual(["ok", "ok", "ok"]);
  });

  // ACHADO 75: desconectar a conta apaga as linhas da fila dela (lib/db.ts:469-474).
  it("a linha da fila apagada depois de enfileirar: segue travado, mesmo passados os 10 minutos", async () => {
    const id = await publicado(CHAVE);
    await banco
      .db()
      .sql()
      .query(
        `update carrosseis_gerados set arte = jsonb_set(jsonb_set(arte, '{publicacao,reservada_em}', to_jsonb(now() - interval '1 day')),
           '{publicacao,enfileirada_em}', to_jsonb(now() - interval '1 day')) where id = $1`,
        [id]
      );
    expect(motivos(await tentar(id))).toEqual(["travado", "travado", "travado"]);
  });

  it("a reserva nunca enfileirada e sem linha trava nos 10 minutos, e libera depois", async () => {
    const id = await publicado(CHAVE, {}, false);
    expect(motivos(await tentar(id))).toEqual(["travado", "travado", "travado"]);
    await banco
      .db()
      .sql()
      .query(`update carrosseis_gerados set arte = jsonb_set(arte, '{publicacao,reservada_em}', to_jsonb(now() - interval '11 minutes')) where id = $1`, [id]);
    expect(motivos(await tentar(id))).toEqual(["ok", "ok", "ok"]);
  });

  it("a publicação de forma estranha trava", async () => {
    const id = await carrossel({ ...ARTE, publicacao: "publicado" });
    expect(motivos(await tentar(id))).toEqual(["travado", "travado", "travado"]);
  });

  it("o estado do carrossel, para a página, vem da fila pela chave exata", async () => {
    const id = await publicado(CHAVE);
    await naFila(CHAVE, "sent");
    await naFila(`${CHAVE}-outra`, "failed");
    const [linha] = (await banco.db().sql().query(`select * from carrosseis_gerados where id = $1`, [id])) as { arte: unknown }[];
    expect((await publicar.estadoDoCarrossel(linha.arte)).tipo).toBe("publicado");
  });
});

describe("a reserva da publicação", () => {
  const imagensDe = (id: string) => publicar.gravarImagemDoSlide(id, 2, guardada(2)).then(() =>
    publicar.gravarImagemDoSlide(id, 3, guardada(3))).then(() => publicar.gravarImagemDoSlide(id, 4, guardada(4)));
  const esperado = { texto: JSON.stringify(TEXTO), soTexto: [1, 5], imagens: { 2: guardada(2), 3: guardada(3), 4: guardada(4) } };
  const caminhos = [daFila(1), daFila(2), daFila(3), daFila(4), daFila(5)];

  it("grava a chave e os caminhos, com a hora do banco, e devolve a legenda salva", async () => {
    const id = await carrossel();
    await imagensDe(id);
    const r = await publicar.reservarPublicacao(id, esperado, "pub:chave-1", caminhos);
    expect(r).toEqual({ ok: true, legenda: TEXTO.legenda, velha: null });
    const p = regras.publicacaoDaArte(await arteDe(id));
    expect(p).toMatchObject({ chave: "pub:chave-1", caminhos, enfileiradaEm: null });
    expect(Math.abs((p as { reservadaEm: Date }).reservadaEm.getTime() - Date.now())).toBeLessThan(120_000);
  });

  it.each([
    ["o texto", { texto: JSON.stringify({ ...TEXTO, legenda: "outra" }) }],
    ["o só texto", { soTexto: [1] }],
    ["uma imagem", { imagens: { ...esperado.imagens, 3: guardada(33) } }],
  ])("recusa quando %s mudou desde as cópias", async (_nome, mudanca) => {
    const id = await carrossel();
    await imagensDe(id);
    const r = await publicar.reservarPublicacao(id, { ...esperado, ...mudanca }, "pub:chave-1", caminhos);
    expect(r.ok ? null : r.recusa.motivo).toBe("mudou");
    expect(regras.publicacaoDaArte(await arteDe(id))).toBeNull();
  });

  it("dois reservando ao mesmo tempo: um só reserva, e o outro é recusado pela trava", async () => {
    const id = await carrossel();
    await imagensDe(id);
    const [a, b] = await Promise.all([
      publicar.reservarPublicacao(id, esperado, "pub:chave-a", caminhos),
      publicar.reservarPublicacao(id, esperado, "pub:chave-b", caminhos),
    ]);
    expect([a.ok, b.ok].sort()).toEqual([false, true]);
    const recusada = a.ok ? b : a;
    expect(recusada.ok ? null : recusada.recusa.motivo).toBe("travado");
  });

  // A RESERVA TRAVA A LINHA (`for update`). Os dois cliques de cima podem não se cruzar de verdade: a
  // primeira transação às vezes termina antes de a segunda ler. Aqui o cruzamento é forçado: uma
  // transação do próprio teste segura a linha e grava uma reserva, como o outro clique no meio do
  // caminho. Quem trava a linha espera, vê a reserva dele e é recusado; quem lesse sem travar veria a
  // linha velha, sem reserva, e gravaria a sua por cima (medido no ensaio: a mutação sem o `for
  // update` passava pelo caso de cima).
  it("o segundo clique espera a linha, vê a reserva do primeiro e é recusado", async () => {
    const id = await carrossel();
    await imagensDe(id);
    let soltar!: () => void;
    const segurando = new Promise<void>((f) => (soltar = f));
    let travou!: () => void;
    const travado = new Promise<void>((f) => (travou = f));
    const transacao = banco
      .db()
      .sql()
      .begin(async (tx) => {
        await tx.query(`select id from carrosseis_gerados where id = $1 for update`, [id]);
        await tx.query(
          `update carrosseis_gerados set arte = arte || jsonb_build_object('publicacao',
             $2::jsonb || jsonb_build_object('reservada_em', now())) where id = $1`,
          [id, { chave: "pub:chave-a", caminhos }]
        );
        travou();
        await segurando;
      });
    await travado;
    // A chamada fica DENTRO do `try` (achado 74): se ela lançar, o `finally` solta a linha assim mesmo.
    const reservas: Promise<Awaited<ReturnType<typeof publicar.reservarPublicacao>>>[] = [];
    try {
      reservas.push(publicar.reservarPublicacao(id, esperado, "pub:chave-b", caminhos));
      await new Promise((f) => setTimeout(f, 300));
    } finally {
      soltar();
      await transacao;
    }
    const [r] = await Promise.all(reservas);
    expect(r.ok ? null : r.recusa.motivo).toBe("travado");
    expect((regras.publicacaoDaArte(await arteDe(id)) as { chave: string }).chave).toBe("pub:chave-a");
  });

  it("a reserva velha, nunca enfileirada, volta para os caminhos dela saírem do bucket", async () => {
    const id = await carrossel();
    await imagensDe(id);
    await publicar.reservarPublicacao(id, esperado, "pub:velha", [daFila(70)]);
    await banco
      .db()
      .sql()
      .query(`update carrosseis_gerados set arte = jsonb_set(arte, '{publicacao,reservada_em}', to_jsonb(now() - interval '11 minutes')) where id = $1`, [id]);
    const r = await publicar.reservarPublicacao(id, esperado, "pub:nova", caminhos);
    expect(r.ok && r.velha?.caminhos).toEqual([daFila(70)]);
  });

  it("marcar enfileirada e desfazer a reserva só valem com a chave da tentativa", async () => {
    const id = await carrossel();
    await imagensDe(id);
    await publicar.reservarPublicacao(id, esperado, "pub:minha", caminhos);
    expect(await publicar.marcarEnfileirada(id, "pub:outra")).toBe(false);
    expect(await publicar.marcarEnfileirada(id, "pub:minha")).toBe(true);
    expect((regras.publicacaoDaArte(await arteDe(id)) as { enfileiradaEm: Date | null }).enfileiradaEm).toBeInstanceOf(Date);
    await publicar.desfazerReserva(id, "pub:outra");
    expect(regras.publicacaoDaArte(await arteDe(id))).not.toBeNull();
    await publicar.desfazerReserva(id, "pub:minha");
    expect(regras.publicacaoDaArte(await arteDe(id))).toBeNull();
  });

  it("acha o caminho que está no payload de algum item da fila", async () => {
    await naFila("pub:x", "pending", [daFila(1), daFila(2)]);
    expect(await publicar.caminhosNaFila([daFila(2), daFila(3)])).toEqual([daFila(2)]);
    expect(await publicar.caminhosNaFila([daFila(3)])).toEqual([]);
  });
});
```

Em `testes-integracao/bonus-carrossel-processo.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/bonus-carrossel-processo.integracao.ts b/testes-integracao/bonus-carrossel-processo.integracao.ts
index 35bc26f..47733af 100644
--- a/testes-integracao/bonus-carrossel-processo.integracao.ts
+++ b/testes-integracao/bonus-carrossel-processo.integracao.ts
@@ -325,26 +325,26 @@ describe("a arte", () => {
 
   it("gravar o só texto mantém a conta, e só vale em carrossel pronto", async () => {
     const id = await pronto(THIAGO);
-    expect(await repo.salvarSoTextoDaArte(id, [2, 4], null)).toBe(true);
+    expect(await repo.salvarSoTextoDaArte(id, [2, 4], null)).toEqual({ ok: true });
     expect(await arte(id)).toEqual({ ...THIAGO, soTexto: [2, 4] });
-    expect(await repo.salvarSoTextoDaArte(id, [], null)).toBe(true);
+    expect(await repo.salvarSoTextoDaArte(id, [], null)).toEqual({ ok: true });
     expect(await arte(id)).toEqual({ ...THIAGO, soTexto: [] });
 
     const pendente = await criado(5);
-    expect(await repo.salvarSoTextoDaArte(pendente, [2], null)).toBe(false);
+    expect(await repo.salvarSoTextoDaArte(pendente, [2], null)).toEqual({ ok: false, motivo: "nao_pronto" });
     expect(await arte(pendente)).toEqual({});
   });
 
   it("gravar o só texto completa o nome que falta da conta gravada na Etapa 3", async () => {
     const id = await pronto();
     await banco.db().sql().query(`update carrosseis_gerados set arte = '{"conta":"1001"}'::jsonb where id = $1`, [id]);
-    expect(await repo.salvarSoTextoDaArte(id, [3], { nome: "Thiago Vannuchi", arroba: "thiagovannuchi" })).toBe(true);
+    expect(await repo.salvarSoTextoDaArte(id, [3], { nome: "Thiago Vannuchi", arroba: "thiagovannuchi" })).toEqual({ ok: true });
     expect(await arte(id)).toEqual({ conta: "1001", nome: "Thiago Vannuchi", arroba: "thiagovannuchi", soTexto: [3] });
   });
 
   it("Fixar nesta conta grava uma vez, mantém o só texto, e recusa o carrossel que já tem conta", async () => {
     const id = await pronto();
-    expect(await repo.salvarSoTextoDaArte(id, [2], null)).toBe(true);
+    expect(await repo.salvarSoTextoDaArte(id, [2], null)).toEqual({ ok: true });
     expect(await repo.fixarContaDoCarrossel(id, THIAGO)).toBe(true);
     expect(await arte(id)).toEqual({ ...THIAGO, soTexto: [2] });
     expect(await repo.fixarContaDoCarrossel(id, { conta: "1002", nome: "N8X", arroba: "n8x" })).toBe(false);
```

- [ ] **Passo 2: ver falhar**

```bash
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-publicar-repositorio.integracao.ts testes-integracao/bonus-carrossel-processo.integracao.ts
```

Esperado: `[rede-global] ALVO: banco de TESTE`; 3 caem, 19 passam e 25 pulam (47). No arquivo novo, os 25 pulam porque o `beforeAll` não acha o módulo; no da Etapa 4, caem os 3 que ainda esperam `true` de `salvarSoTextoDaArte`.

- [ ] **Passo 3: o código**

Crie `lib/bonus/publicar-repositorio.ts`:

```ts
import "server-only";
import { pastaDaConta } from "@/lib/bucket";
import { sql } from "@/lib/db";
import { comEspaco, escolhasDaArte } from "./arte-escolhas";
import { slidesDoTexto } from "./arte-slides";
import type { LinhaDoCarrossel } from "./carrossel-linha";
import { textoDaLinhaDoCarrossel } from "./carrossel-tela";
import { ehIdDeBonus } from "./pedido";
import { estadoDaPublicacao, publicacaoLivre, type EstadoDaPublicacao, type LinhaDaFila } from "./publicar-estado";
import {
  ehCaminhoDoDestino,
  imagensDaArte,
  publicacaoDaArte,
  versaoDoTextoDoSlide,
  type PublicacaoGuardada,
} from "./publicar-regras";
import type { RecusaDaPublicacaoDoCarrossel } from "./publicar-textos";

// O SQL DA PUBLICAÇÃO DO CARROSSEL (spec da Etapa 5). Toda escrita no carrossel é feita com a linha
// travada (`for update`) ou por um `update` condicional à chave da reserva, e a fila do /publicar só
// é LIDA aqui: quem grava nela é `enqueuePublicacao` (lib/engine.ts), chamada pelo processo.
// testes-integracao/bonus-publicar-repositorio.integracao.ts é quem acusa se alguém tirar a trava.
// Objeto vai CRU para coluna `jsonb`, nunca `JSON.stringify` (a lição da FASE 1.7).

/** `sql()` ou a transação: os dois têm `query`, e a leitura da fila serve aos dois. */
type Consulta = { query: (texto: string, params?: unknown[]) => Promise<unknown[]> };

/**
 * O ESTADO DA PUBLICAÇÃO de um carrossel, pela `arte` dele: a linha da fila é lida pela chave EXATA
 * que o carrossel guardou, e o relógio é o do banco (o `now()` lido junto), porque `reservada_em`
 * também é gravado por ele.
 */
export async function estadoDaPublicacaoNa(consulta: Consulta, arte: unknown): Promise<EstadoDaPublicacao> {
  const publicacao = publicacaoDaArte(arte);
  if (publicacao === null) return { tipo: "livre" };
  const [r] = (await consulta.query(
    `select now() as agora, q.id, q.status, q.not_before, q.sent_at, q.error
       from (select 1) as um left join queue q on q.dedupe_key = $1`,
    [publicacao === "estranha" ? null : publicacao.chave]
  )) as ({ agora: Date } & Partial<LinhaDaFila>)[];
  const linha: LinhaDaFila | null = r?.id
    ? { id: r.id, status: r.status ?? "", not_before: r.not_before as Date, sent_at: r.sent_at ?? null, error: r.error ?? null }
    : null;
  return estadoDaPublicacao(publicacao, linha, r.agora);
}

/** O estado para a página, fora de transação. */
export async function estadoDoCarrossel(arte: unknown): Promise<EstadoDaPublicacao> {
  return estadoDaPublicacaoNa(sql(), arte);
}

type Recusa = { ok: false; recusa: RecusaDaPublicacaoDoCarrossel };
const recusa = (r: RecusaDaPublicacaoDoCarrossel): Recusa => ({ ok: false, recusa: r });

/**
 * GUARDAR A IMAGEM DE UM SLIDE, com a linha travada: o carrossel pronto e com conta, a trava livre, o
 * slide com espaço de imagem, e o caminho na forma exata `<pasta da conta do carrossel>/bonus/<uuid>.jpg`.
 * A versão gravada é a do texto SALVO agora. Devolve a imagem anterior daquele slide, para quem chama
 * apagá-la do bucket depois do `commit`.
 */
export async function gravarImagemDoSlide(
  id: string,
  numero: number,
  caminho: string
): Promise<{ ok: true; anterior: string | null; versao: string } | Recusa> {
  if (!ehIdDeBonus(id)) return recusa({ motivo: "nao_pronto" });
  return sql().begin(async (tx) => {
    const [linha] = (await tx.query(`select * from carrosseis_gerados where id = $1 for update`, [id])) as LinhaDoCarrossel[];
    const texto = linha?.estado === "pronto" ? textoDaLinhaDoCarrossel(linha) : null;
    if (!linha || !texto) return recusa({ motivo: "nao_pronto" });
    const escolhas = escolhasDaArte(linha.arte, linha.total_slides);
    if (!escolhas.conta) return recusa({ motivo: "sem_conta" });
    const estado = await estadoDaPublicacaoNa(tx, linha.arte);
    if (!publicacaoLivre(estado)) return recusa({ motivo: "travado", estado });
    const slide = slidesDoTexto(texto)[numero - 1];
    if (!Number.isInteger(numero) || !slide) return recusa({ motivo: "slide" });
    if (!comEspaco(escolhas, numero)) return recusa({ motivo: "sem_espaco", numero });
    if (!ehCaminhoDoDestino(caminho, pastaDaConta(escolhas.conta), "slide")) return recusa({ motivo: "caminho" });
    const anterior = imagensDaArte(linha.arte, linha.total_slides)[numero]?.caminho ?? null;
    const versao = versaoDoTextoDoSlide(slide);
    await tx.query(
      `update carrosseis_gerados
          set arte = arte || jsonb_build_object('imagens',
            case when jsonb_typeof(arte->'imagens') = 'object' then arte->'imagens' else '{}'::jsonb end || $2::jsonb)
        where id = $1`,
      [id, { [String(numero)]: { caminho, versao } }]
    );
    return { ok: true as const, anterior: anterior === caminho ? null : anterior, versao };
  });
}

/** Os caminhos desta lista que aparecem no payload de algum item de publicação da fila. */
export async function caminhosNaFila(caminhos: string[]): Promise<string[]> {
  const achados: string[] = [];
  for (const caminho of caminhos) {
    const [r] = (await sql().query(
      `select exists (select 1 from queue where kind = 'publicacao' and payload->'caminhos' ? $1) as achou`,
      [caminho]
    )) as { achou: boolean }[];
    if (r?.achou) achados.push(caminho);
  }
  return achados;
}

/** O que a publicação conferiu e copiou, para a reserva conferir de novo com a linha travada. */
export type ConferidoParaPublicar = {
  /** O texto salvo, como `JSON.stringify` o escreve. */
  texto: string;
  soTexto: number[];
  /** O caminho da imagem guardada de cada slide com espaço, que foi copiada. */
  imagens: Record<number, string>;
};

/**
 * A RESERVA DA PUBLICAÇÃO, numa transação curta e com a linha travada (spec, "Publicar", passo 4):
 * confere de novo a trava livre e que o texto, o "só texto" e as imagens são os que foram conferidos
 * e copiados; grava `arte.publicacao` com a chave e os caminhos, e `reservada_em` pelo relógio do
 * banco. Devolve a legenda salva, que é a que vai para a fila, e a reserva velha que nunca entrou na
 * fila, para os caminhos dela saírem do bucket.
 */
export async function reservarPublicacao(
  id: string,
  conferido: ConferidoParaPublicar,
  chave: string,
  caminhos: string[]
): Promise<{ ok: true; legenda: string; velha: PublicacaoGuardada | null } | Recusa> {
  if (!ehIdDeBonus(id)) return recusa({ motivo: "nao_pronto" });
  return sql().begin(async (tx) => {
    const [linha] = (await tx.query(`select * from carrosseis_gerados where id = $1 for update`, [id])) as LinhaDoCarrossel[];
    const texto = linha?.estado === "pronto" ? textoDaLinhaDoCarrossel(linha) : null;
    if (!linha || !texto) return recusa({ motivo: "nao_pronto" });
    const estado = await estadoDaPublicacaoNa(tx, linha.arte);
    if (!publicacaoLivre(estado)) return recusa({ motivo: "travado", estado });
    const escolhas = escolhasDaArte(linha.arte, linha.total_slides);
    const imagens = imagensDaArte(linha.arte, linha.total_slides);
    const atuais: Record<number, string> = {};
    for (let n = 1; n <= linha.total_slides; n++) if (comEspaco(escolhas, n) && imagens[n]) atuais[n] = imagens[n].caminho;
    const mudou =
      JSON.stringify(texto) !== conferido.texto ||
      JSON.stringify(escolhas.soTexto) !== JSON.stringify([...conferido.soTexto].sort((a, b) => a - b)) ||
      JSON.stringify(atuais) !== JSON.stringify(conferido.imagens);
    if (mudou) return recusa({ motivo: "mudou" });
    const anterior = publicacaoDaArte(linha.arte);
    await tx.query(
      `update carrosseis_gerados
          set arte = arte || jsonb_build_object('publicacao', $2::jsonb || jsonb_build_object('reservada_em', now()))
        where id = $1`,
      [id, { chave, caminhos }]
    );
    const velha = anterior && anterior !== "estranha" && !anterior.enfileiradaEm ? anterior : null;
    return { ok: true as const, legenda: texto.legenda, velha };
  });
}

/** A marca de enfileirada (achado 75), só se a reserva ainda for a desta tentativa. */
export async function marcarEnfileirada(id: string, chave: string): Promise<boolean> {
  const linhas = (await sql().query(
    `update carrosseis_gerados set arte = jsonb_set(arte, '{publicacao,enfileirada_em}', to_jsonb(now()))
      where id = $1 and arte->'publicacao'->>'chave' = $2 returning id`,
    [id, chave]
  )) as { id: string }[];
  return linhas.length > 0;
}

/** Desfaz a reserva que não entrou na fila, só se ela ainda for a desta tentativa. */
export async function desfazerReserva(id: string, chave: string): Promise<void> {
  await sql().query(`update carrosseis_gerados set arte = arte - 'publicacao' where id = $1 and arte->'publicacao'->>'chave' = $2`, [
    id,
    chave,
  ]);
}
```

Em `lib/bonus/carrossel-repositorio.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/carrossel-repositorio.ts b/lib/bonus/carrossel-repositorio.ts
index a40d317..aeb507e 100644
--- a/lib/bonus/carrossel-repositorio.ts
+++ b/lib/bonus/carrossel-repositorio.ts
@@ -8,6 +8,8 @@ import { textoDaLinhaDoCarrossel } from "./carrossel-tela";
 import { juntarParte, type ParteDoCarrossel, type ProblemaDoCampo, type TextoDoCarrossel } from "./carrossel-texto";
 import type { Medicao } from "./ia-parametros";
 import { ehIdDeBonus } from "./pedido";
+import { publicacaoLivre, type EstadoDaPublicacao } from "./publicar-estado";
+import { estadoDaPublicacaoNa } from "./publicar-repositorio";
 
 // O SQL DO CARROSSEL. Toda escrita é um `update` CONDICIONAL: o `where` é a proteção, e
 // testes-integracao/bonus-carrossel-processo.integracao.ts é quem acusa se alguém a tirar.
@@ -109,6 +111,8 @@ export async function listarCarrosseisDoBonus(bonusId: string): Promise<LinhaDoC
  * (`juntarParte`, puro) e grava. Dois salvamentos ao mesmo tempo, de partes diferentes, não apagam um
  * ao outro: o segundo espera o primeiro e junta sobre o texto dele. Só carrossel pronto.
  * `nomeQueFalta` completa o nome e o @ da conta gravada na Etapa 3 sem eles, na mesma gravação.
+ * Com o carrossel na fila de publicação, ou publicado, recusa (spec da Etapa 5, "A trava no
+ * servidor"): o que está na tela é sempre o que vai sair.
  */
 export async function salvarParteDoCarrossel(
   id: string,
@@ -118,6 +122,7 @@ export async function salvarParteDoCarrossel(
 ): Promise<
   | { ok: true; texto: TextoDoCarrossel; avisos: ProblemaDoCampo[] }
   | { ok: false; motivo: "nao_pronto" }
+  | { ok: false; motivo: "travado"; estado: EstadoDaPublicacao }
   | { ok: false; motivo: "problemas"; problemas: ProblemaDoCampo[] }
 > {
   if (!ehIdDeBonus(id)) return { ok: false, motivo: "nao_pronto" };
@@ -125,6 +130,8 @@ export async function salvarParteDoCarrossel(
     const [linha] = (await tx.query(`select * from carrosseis_gerados where id = $1 for update`, [id])) as LinhaDoCarrossel[];
     const atual = linha?.estado === "pronto" ? textoDaLinhaDoCarrossel(linha) : null;
     if (!linha || !atual) return { ok: false as const, motivo: "nao_pronto" as const };
+    const estado = await estadoDaPublicacaoNa(tx, linha.arte);
+    if (!publicacaoLivre(estado)) return { ok: false as const, motivo: "travado" as const, estado };
     const r = juntarParte(linha.total_slides, linha.palavra, atual, parte, bruto);
     if (!r.ok) return { ok: false as const, motivo: "problemas" as const, problemas: r.problemas };
     await tx.query(
@@ -139,18 +146,25 @@ export async function salvarParteDoCarrossel(
  * O "SÓ TEXTO" DA ARTE, só em carrossel pronto. Grava SÓ a chave `soTexto` (`arte || …` junta as
  * chaves), e nunca o objeto inteiro: até a Etapa 3 a escrita trocava a coluna toda, e gravar o "só
  * texto" sem a conta a apagaria (spec da Etapa 4). `nomeQueFalta` completa o nome e o @ da conta
- * gravada na Etapa 3 sem eles (arte-conta.ts). Devolve falso quando a linha não estava pronta.
+ * gravada na Etapa 3 sem eles (arte-conta.ts).
+ *
+ * NUMA TRANSAÇÃO COM A LINHA TRAVADA (spec da Etapa 5): com o carrossel na fila de publicação, ou
+ * publicado, recusa, pela mesma função pura da trava que o salvar do slide usa.
  */
 export async function salvarSoTextoDaArte(
   id: string,
   soTexto: number[],
   nomeQueFalta: { nome: string | null; arroba: string | null } | null
-): Promise<boolean> {
-  const linhas = (await sql().query(
-    `update carrosseis_gerados set arte = arte || $2::jsonb where id = $1 and estado = 'pronto' returning id`,
-    [id, { ...chavesDaConta(nomeQueFalta), soTexto }]
-  )) as { id: string }[];
-  return linhas.length > 0;
+): Promise<{ ok: true } | { ok: false; motivo: "nao_pronto" } | { ok: false; motivo: "travado"; estado: EstadoDaPublicacao }> {
+  if (!ehIdDeBonus(id)) return { ok: false, motivo: "nao_pronto" };
+  return sql().begin(async (tx) => {
+    const [linha] = (await tx.query(`select * from carrosseis_gerados where id = $1 for update`, [id])) as LinhaDoCarrossel[];
+    if (!linha || linha.estado !== "pronto") return { ok: false as const, motivo: "nao_pronto" as const };
+    const estado = await estadoDaPublicacaoNa(tx, linha.arte);
+    if (!publicacaoLivre(estado)) return { ok: false as const, motivo: "travado" as const, estado };
+    await tx.query(`update carrosseis_gerados set arte = arte || $2::jsonb where id = $1`, [id, { ...chavesDaConta(nomeQueFalta), soTexto }]);
+    return { ok: true as const };
+  });
 }
 
 /**
```

Em `app/bonus/carrossel-actions.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/carrossel-actions.ts b/app/bonus/carrossel-actions.ts
index 154eec7..cbc5ebf 100644
--- a/app/bonus/carrossel-actions.ts
+++ b/app/bonus/carrossel-actions.ts
@@ -53,6 +53,7 @@ import {
 import { temChaveDaIA } from "@/lib/bonus/config";
 import { ehIdDeBonus } from "@/lib/bonus/pedido";
 import { situacaoNoLabs } from "@/lib/bonus/publicado";
+import { textoDaTrava } from "@/lib/bonus/publicar-textos";
 import { lerLinha } from "@/lib/bonus/repositorio";
 import { geracaoNaTela } from "@/lib/bonus/tempos";
 import { TEXTO_BONUS_NAO_ENCONTRADO, textoDaConfig, urlDoBonusComAviso } from "@/lib/bonus/textos";
@@ -203,6 +204,7 @@ export async function salvarSlideDoCarrossel(_anterior: AvisoDoSlide | null, for
   const escolhas = escolhasDaArte(linha.arte, total);
   const r = await salvarParteDoCarrossel(id, parte, bruto, nomeQueFalta(contas, escolhas));
   if (!r.ok && r.motivo === "nao_pronto") return resposta("erro", TEXTO_CARROSSEL_NAO_REVISAVEL);
+  if (!r.ok && r.motivo === "travado") return resposta("erro", textoDaTrava(r.estado));
   if (!r.ok) return resposta("erro", `Corrija antes de salvar. ${textoDosProblemasDoCarrossel(total, r.problemas)}`);
   const texto = textoDaParteSalva(parte, total, r.avisos);
   if (parte.tipo === "legenda") return resposta("ok", texto);
@@ -236,7 +238,7 @@ export async function salvarArteDoCarrossel(_anterior: AvisoDaArte | null, form:
   const contas = await contasParaArte();
   const escolhas = escolhasDaArte(linha.arte, linha.total_slides);
   const salvou = await salvarSoTextoDaArte(id, lido.soTexto, nomeQueFalta(contas, escolhas));
-  if (!salvou) return resposta("erro", TEXTO_ARTE_NAO_PRONTA);
+  if (!salvou.ok) return resposta("erro", salvou.motivo === "travado" ? textoDaTrava(salvou.estado) : TEXTO_ARTE_NAO_PRONTA);
   const { conta } = resolverConta(contas, escolhas, await contaDoCookie());
   return resposta("ok", TEXTO_ARTE_SALVA, versoesDosSlides(slidesDoTexto(texto), lido.soTexto, cabecalhoParaVersao(conta)));
 }
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-publicar-repositorio.integracao.ts testes-integracao/bonus-carrossel-processo.integracao.ts
```

Esperado: `tsc` limpo; `[rede-global] ALVO: banco de TESTE`, e os 47 passam.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/publicar-repositorio.ts lib/bonus/carrossel-repositorio.ts app/bonus/carrossel-actions.ts testes-integracao/bonus-publicar-repositorio.integracao.ts testes-integracao/bonus-carrossel-processo.integracao.ts
test "$(git branch --show-current)" = "publicar-do-carrossel"
git add lib/bonus/publicar-repositorio.ts lib/bonus/carrossel-repositorio.ts app/bonus/carrossel-actions.ts testes-integracao/bonus-publicar-repositorio.integracao.ts testes-integracao/bonus-carrossel-processo.integracao.ts
git commit -m "feat(bonus): guardar a imagem do slide, a reserva da publicação e a trava nas gravações do carrossel"
```

---

### FASE 5.4 — O bucket: assinar na conta do carrossel e copiar para a fila

**Arquivos:**
- Criar: `lib/bonus/publicar-bucket.ts`
- Testar: `tests/bonus-publicar-bucket.test.ts`

**Interfaces:**
- Consome: `caminhoDaImagem`, `DestinoDaImagem` (FASE 5.1); de `lib/bucket.ts`, sem mudar nada nele:
  `pastaDaConta`, `urlAssinadaDeUpload`, `urlPublicaDoObjeto`, `apagarObjeto`.
- Produz: `assinarCaminho(conta, destino, uuid?)`, que devolve `{ caminho; url }`; `COPIA_MAX_BYTES =
  8 * 1024 * 1024`; `copiarParaAFila(origem, conta, uuid?)`, que devolve o caminho da cópia em
  `bonus-fila`; `copiarTodasParaAFila(origens, conta)`, que devolve `{ ok: true; copias: Record<number,
  string> }` ou `{ ok: false; numero }`; `apagarSemDerrubar(caminhos)`.

- [ ] **Passo 1: o teste**

Crie `tests/bonus-publicar-bucket.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// O BUCKET DA PUBLICAÇÃO DO CARROSSEL (spec da Etapa 5, "Publicar", passo 3). A cópia usa só o que
// lib/bucket.ts já exporta e já mediu: o GET público e o PUT na URL assinada. Nenhum endpoint novo do
// Supabase. O `fetch` é falso: nada sai desta máquina, e cada chamada fica anotada.

process.env.SUPABASE_URL = "https://exemplo.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "chave-de-teste-que-nao-vale-nada";
process.env.SUPABASE_BUCKET = "MetodoChat";

const { apagarSemDerrubar, assinarCaminho, copiarParaAFila, copiarTodasParaAFila, COPIA_MAX_BYTES } = await import(
  "@/lib/bonus/publicar-bucket"
);

const CONTA = "17841400000000001";
const BASE = "https://exemplo.supabase.co/storage/v1";
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

type Chamada = { metodo: string; url: string; cabecalhos: Record<string, string>; corpo: unknown };
let chamadas: Chamada[];
let responder: (c: Chamada) => Response;

beforeEach(() => {
  chamadas = [];
  responder = (c) => {
    if (c.metodo === "POST" && c.url.includes("/object/upload/sign/")) {
      const caminho = c.url.split("/object/upload/sign/MetodoChat/")[1];
      return Response.json({ url: `/object/upload/sign/MetodoChat/${caminho}?token=t`, token: "t" });
    }
    if (c.metodo === "GET") return new Response(JPEG, { status: 200, headers: { "content-type": "image/jpeg" } });
    return new Response("{}", { status: 200 });
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const c: Chamada = {
        metodo: init.method ?? "GET",
        url: String(url),
        cabecalhos: Object.fromEntries(new Headers(init.headers).entries()),
        corpo: init.body,
      };
      chamadas.push(c);
      return responder(c);
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("assinar o caminho", () => {
  it("assina na pasta da conta do carrossel, no prefixo do destino, e devolve a URL inteira", async () => {
    const r = await assinarCaminho(CONTA, "slide", uuid(1));
    expect(r.caminho).toBe(`${CONTA}/bonus/${uuid(1)}.jpg`);
    expect(r.url).toBe(`${BASE}/object/upload/sign/MetodoChat/${CONTA}/bonus/${uuid(1)}.jpg?token=t`);
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].metodo).toBe("POST");
    expect(chamadas[0].cabecalhos.apikey).toBe("chave-de-teste-que-nao-vale-nada");
    expect((await assinarCaminho(CONTA, "fila", uuid(2))).caminho).toBe(`${CONTA}/bonus-fila/${uuid(2)}.jpg`);
  });
});

describe("copiar uma imagem guardada para a fila", () => {
  const ORIGEM = `${CONTA}/bonus/${uuid(1)}.jpg`;

  it("baixa pelo endereço público, assina um caminho novo em bonus-fila e sobe os mesmos bytes", async () => {
    const copia = await copiarParaAFila(ORIGEM, CONTA, uuid(9));
    expect(copia).toBe(`${CONTA}/bonus-fila/${uuid(9)}.jpg`);
    expect(chamadas.map((c) => c.metodo)).toEqual(["GET", "POST", "PUT"]);
    expect(chamadas[0].url).toBe(`${BASE}/object/public/MetodoChat/${ORIGEM}`);
    // O GET público não leva a chave: é o mesmo endereço que a Meta busca sem token.
    expect(chamadas[0].cabecalhos.apikey).toBeUndefined();
    expect(chamadas[2].url).toBe(`${BASE}/object/upload/sign/MetodoChat/${copia}?token=t`);
    expect(chamadas[2].cabecalhos["content-type"]).toBe("image/jpeg");
    expect(chamadas[2].cabecalhos.authorization).toBeUndefined();
    expect(Array.from(chamadas[2].corpo as Uint8Array)).toEqual(Array.from(JPEG));
  });

  it("a guardada que não existe mais é recusada, sem assinar nada", async () => {
    responder = () => new Response("not found", { status: 400 });
    await expect(copiarParaAFila(ORIGEM, CONTA, uuid(9))).rejects.toThrow(/HTTP 400/);
    expect(chamadas.map((c) => c.metodo)).toEqual(["GET"]);
  });

  it("vazia, ou maior que o teto da Meta para imagem, é recusada", async () => {
    responder = () => new Response(new Uint8Array(0), { status: 200 });
    await expect(copiarParaAFila(ORIGEM, CONTA, uuid(9))).rejects.toThrow(/tamanho/);
    expect(COPIA_MAX_BYTES).toBe(8 * 1024 * 1024);
    responder = () => new Response(new Uint8Array(COPIA_MAX_BYTES + 1), { status: 200 });
    await expect(copiarParaAFila(ORIGEM, CONTA, uuid(9))).rejects.toThrow(/tamanho/);
  });

  it("o PUT recusado é recusa da cópia", async () => {
    const original = responder;
    responder = (c) => (c.metodo === "PUT" ? new Response("{}", { status: 403 }) : original(c));
    await expect(copiarParaAFila(ORIGEM, CONTA, uuid(9))).rejects.toThrow(/HTTP 403/);
  });
});

describe("copiar todas", () => {
  const origens = [2, 3, 4].map((n) => ({ numero: n, caminho: `${CONTA}/bonus/${uuid(n)}.jpg` }));

  it("devolve a cópia de cada slide", async () => {
    const r = await copiarTodasParaAFila(origens, CONTA);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(Object.keys(r.copias)).toEqual(["2", "3", "4"]);
      for (const c of Object.values(r.copias)) expect(c).toMatch(new RegExp(`^${CONTA}/bonus-fila/[0-9a-f-]{36}\\.jpg$`));
      expect(new Set(Object.values(r.copias)).size).toBe(3);
    }
  });

  it("se uma falha, as que já foram feitas saem do bucket, e a resposta diz qual slide falhou", async () => {
    const original = responder;
    responder = (c) => (c.metodo === "GET" && c.url.endsWith(`${uuid(3)}.jpg`) ? new Response("x", { status: 400 }) : original(c));
    const r = await copiarTodasParaAFila(origens, CONTA);
    expect(r).toEqual({ ok: false, numero: 3 });
    const feitas = chamadas.filter((c) => c.metodo === "PUT").map((c) => c.url.split("MetodoChat/")[1].split("?")[0]);
    const apagadas = chamadas.filter((c) => c.metodo === "DELETE").map((c) => c.url.split("MetodoChat/")[1]);
    expect(feitas).toHaveLength(2);
    expect(apagadas.sort()).toEqual(feitas.sort());
  });
});

describe("apagar sem derrubar", () => {
  it("tenta todos, e a falha de um não lança nem impede os outros", async () => {
    responder = (c) => (c.url.endsWith(`${uuid(1)}.jpg`) ? new Response("{}", { status: 500 }) : new Response("{}", { status: 200 }));
    await expect(apagarSemDerrubar([`${CONTA}/bonus/${uuid(1)}.jpg`, `${CONTA}/bonus/${uuid(2)}.jpg`])).resolves.toBeUndefined();
    expect(chamadas.map((c) => `${c.metodo} ${c.url.split("MetodoChat/")[1]}`)).toEqual([
      `DELETE ${CONTA}/bonus/${uuid(1)}.jpg`,
      `DELETE ${CONTA}/bonus/${uuid(2)}.jpg`,
    ]);
  });
});
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-publicar-bucket.test.ts
```

Esperado: o arquivo cai sem casos: o módulo `lib/bonus/publicar-bucket.ts` não existe.

- [ ] **Passo 3: o código**

Crie `lib/bonus/publicar-bucket.ts`:

```ts
import "server-only";
import { apagarObjeto, pastaDaConta, urlAssinadaDeUpload, urlPublicaDoObjeto } from "@/lib/bucket";
import { caminhoDaImagem, type DestinoDaImagem } from "./publicar-regras";

// O BUCKET DA PUBLICAÇÃO DO CARROSSEL (spec da Etapa 5). Só as chamadas que lib/bucket.ts já exporta
// e já mediu contra o projeto real (03/09/2026): assinar o upload, o GET público, o PUT na URL
// assinada e o DELETE. Nenhum endpoint novo do Supabase, e lib/bucket.ts não muda. A chave de
// serviço fica lá dentro: nada daqui a vê.
//
// A PASTA É SEMPRE A DA CONTA DO CARROSSEL, nunca a do cookie: quem chama passa a conta gravada no
// carrossel (arte-escolhas.ts), e a rota de assinar do /publicar, que usa o cookie, não é usada.

/** Um caminho novo no destino, na pasta da conta, e a URL assinada que vale só para ele. */
export async function assinarCaminho(
  conta: string,
  destino: DestinoDaImagem,
  uuid: string = crypto.randomUUID()
): Promise<{ caminho: string; url: string }> {
  const caminho = caminhoDaImagem(pastaDaConta(conta), destino, uuid);
  const { url } = await urlAssinadaDeUpload(caminho);
  return { caminho, url };
}

/** O teto da Meta para imagem (lib/publicacao.ts, `IMAGEM_BYTES_MAX`). Uma cópia maior não serviria. */
export const COPIA_MAX_BYTES = 8 * 1024 * 1024;

/**
 * COPIA UMA IMAGEM GUARDADA PARA A FILA, no servidor: baixa pelo endereço público (o mesmo que a Meta
 * busca, sem token), assina um caminho novo em `bonus-fila` e sobe os mesmos bytes. A fila leva a
 * cópia, e o dreno apaga só ela depois de publicar (lib/queue-drain.ts, `limparOBucket`): a guardada
 * fica no carrossel. Lança com a frase do que falhou; a URL assinada nunca entra na frase, porque o
 * token vai nela.
 */
export async function copiarParaAFila(origem: string, conta: string, uuid: string = crypto.randomUUID()): Promise<string> {
  const baixada = await fetch(urlPublicaDoObjeto(origem), { cache: "no-store" });
  if (!baixada.ok) throw new Error(`a imagem guardada não foi encontrada no armazenamento (HTTP ${baixada.status})`);
  const bytes = new Uint8Array(await baixada.arrayBuffer());
  if (bytes.length === 0 || bytes.length > COPIA_MAX_BYTES) {
    throw new Error(`a imagem guardada tem um tamanho que o Instagram não aceita (${bytes.length} bytes)`);
  }
  const { caminho, url } = await assinarCaminho(conta, "fila", uuid);
  const subida = await fetch(url, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: bytes });
  if (!subida.ok) throw new Error(`o armazenamento recusou a cópia (HTTP ${subida.status})`);
  return caminho;
}

/**
 * COPIA AS IMAGENS DE TODOS OS SLIDES COM ESPAÇO, ao mesmo tempo. Se uma falha, as que já foram
 * feitas saem do bucket, e a resposta diz qual slide falhou.
 */
export async function copiarTodasParaAFila(
  origens: { numero: number; caminho: string }[],
  conta: string
): Promise<{ ok: true; copias: Record<number, string> } | { ok: false; numero: number }> {
  const resultados = await Promise.allSettled(origens.map((o) => copiarParaAFila(o.caminho, conta)));
  const feitas = resultados.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  const falhou = resultados.findIndex((r) => r.status === "rejected");
  if (falhou >= 0) {
    await apagarSemDerrubar(feitas);
    return { ok: false, numero: origens[falhou].numero };
  }
  return { ok: true, copias: Object.fromEntries(origens.map((o, i) => [o.numero, feitas[i]])) };
}

/**
 * APAGA SEM DERRUBAR quem chama: o que falhar ao apagar fica no bucket sem dono (spec, "O que fica no
 * bucket sem dono"), e a operação que importa já terminou ou já foi recusada. É o molde de
 * `limparOBucket` (lib/queue-drain.ts).
 */
export async function apagarSemDerrubar(caminhos: string[]): Promise<void> {
  for (const caminho of caminhos) {
    try {
      await apagarObjeto(caminho);
    } catch {
      // Um arquivo que fica no bucket não quebra nada hoje; a recusa ou o sucesso já foram decididos.
    }
  }
}
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx vitest run tests/bonus-publicar-bucket.test.ts
```

Esperado: `tsc` limpo e 8 casos passam.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/publicar-bucket.ts tests/bonus-publicar-bucket.test.ts
test "$(git branch --show-current)" = "publicar-do-carrossel"
git add lib/bonus/publicar-bucket.ts tests/bonus-publicar-bucket.test.ts
git commit -m "feat(bonus): assinar na pasta da conta do carrossel e copiar a imagem guardada para a fila"
```

---

### FASE 5.5 — O processo: assinar, guardar e publicar, com a reserva antes da fila

**Arquivos:**
- Criar: `lib/bonus/publicar-processo.ts`
- Modificar: `lib/bonus/publicar-textos.ts` (a recusa da quantidade)
- Testar: `testes-integracao/bonus-publicar-processo.integracao.ts`, `tests/bonus-publicar-estado.test.ts`

**Interfaces:**
- Consome: as FASES 5.1 a 5.4; `resolverConta` (Etapa 4); `lerCarrossel`; de `lib/publicacao.ts`,
  `decisaoDeAssinatura`, `problemaDaLegenda`, `recusaDaQuantidade`, `textoDaRecusaDaPublicacao`,
  `textoDoProblemaDaLegenda`; `publicacaoKey` (`lib/dedupe.ts`); `enqueuePublicacao`
  (`lib/engine.ts`); `drainQueue` (`lib/queue-drain.ts`); `tetoDoBucket` e `pastaDaConta`
  (`lib/bucket.ts`).
- Produz: `assinarImagem({ id, numero, destino, arquivo, contas })`, que devolve `{ ok: true;
  caminho; url }` ou a recusa; `guardarImagem({ id, numero, caminho, contas })`, que devolve `{ ok:
  true; versao }` ou a recusa; `type ArteSubida = { numero; caminho: unknown; versao: unknown }`;
  `publicarNaFila({ id, quando: Date | null, artes, contas, enfileirar?, drenar? })`, que devolve `{
  ok: true; quando }` ou a recusa. A recusa é sempre `{ ok: false; recusa:
  RecusaDaPublicacaoDoCarrossel }`, e o novo motivo é `{ motivo: "quantidade"; texto }`.

- [ ] **Passo 1: os testes**

Crie `testes-integracao/bonus-publicar-processo.integracao.ts`:

```ts
// O PROCESSO DA PUBLICAÇÃO DO CARROSSEL CONTRA O BANCO E UM BUCKET FALSO (spec da Etapa 5).
//
// A FORMA É A DE `publicacao.integracao.ts`: o bucket é um servidor HTTP nesta máquina, as três
// variáveis do Supabase apontam para ele, e o `beforeAll` recusa rodar se a `SUPABASE_URL` não for
// loopback. **Nada sobe para o Supabase de verdade, e nada é publicado no Instagram**: a fila é a do
// banco de teste, e o dreno é um falso que só conta as chamadas.
//
// O que este arquivo prende é a COSTURA, que não é função pura: a ordem entre copiar, reservar,
// enfileirar e marcar; o que sai do bucket em cada recusa; e a conta do carrossel no lugar do cookie.
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { TextoDeCarrossel, TextoDePost } from "@/lib/bonus/carrossel-texto";
import { bancoDescartavel } from "./harness";

type ModuloProcesso = typeof import("@/lib/bonus/publicar-processo");
type ModuloRepo = typeof import("@/lib/bonus/carrossel-repositorio");
type ModuloRegras = typeof import("@/lib/bonus/publicar-regras");
type ModuloSlides = typeof import("@/lib/bonus/arte-slides");
type ContaDoCabecalho = import("@/lib/bonus/arte-conta").ContaDoCabecalho;

const banco = bancoDescartavel();

const CONTA = "17841400000000001";
const OUTRA = "17841400000000002";
const CHAVE_DO_BUCKET_FALSO = "chave-de-servico-inventada-para-o-teste";
const BUCKET = "MetodoChatDeTeste";
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 9, 9, 9]);
const DECLARADO = { nome: "slide.jpg", mime: "image/jpeg", bytes: 1000, largura: 1080, altura: 1350 };

const slide = (i: number) => ({
  titulo: `Título do slide ${i}`,
  texto: `Texto do slide ${i}, com mais de trinta caracteres.`,
});
const TEXTO: TextoDeCarrossel = {
  tipo: "carrossel",
  titulo: "Mensagens para reativar clientes",
  gancho: "Seu cliente sumiu? Não é culpa dele.",
  slides: [slide(1), slide(2), slide(3)],
  chamada: "Comente SUMIDO e receba as mensagens prontas.",
  legenda:
    "Quem sumiu ainda pode voltar. Comente SUMIDO que eu te mando as mensagens prontas para usar hoje mesmo.",
};
const POST: TextoDePost = {
  tipo: "post",
  titulo: "Mensagens para reativar clientes",
  texto: "Seu cliente sumiu, e não é culpa dele. Três mensagens trazem de volta quem parou de responder.",
  chamada: "Comente SUMIDO e receba as mensagens prontas.",
  legenda: TEXTO.legenda,
};
// 5 slides: o 1 (gancho) e o 5 (chamada) são "só texto"; o 2, o 3 e o 4 têm espaço de imagem.
const ARTE = { conta: CONTA, nome: "Thiago Vannuchi", arroba: "thiagovannuchi", soTexto: [1, 5] };

// O BUCKET FALSO: os objetos ficam num Map, e cada chamada fica anotada.
const bucket = {
  objetos: new Map<string, Uint8Array>(),
  chamadas: [] as string[],
  recusarLeitura: new Set<string>(),
};
let servidor: Server;
let processo: ModuloProcesso;
let repo: ModuloRepo;
let regras: ModuloRegras;
let slides: ModuloSlides;
let contas: ContaDoCabecalho[];
let bonusId: string;
let drenagens: number;
const drenar = async () => {
  drenagens++;
};

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
      const caminho = depois(publico);
      bucket.chamadas.push(`baixou ${caminho}`);
      const objeto = bucket.objetos.get(caminho);
      if (!objeto || bucket.recusarLeitura.has(caminho)) return responder(400, { message: "Object not found" });
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
  // Sem token, `scheduleTick` não sai da máquina: o agendado fica na fila do banco de teste.
  delete process.env.QSTASH_TOKEN;
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(process.env.SUPABASE_URL ?? "")) {
    throw new Error("RECUSADO: a SUPABASE_URL desta rodada nao e loopback. Sem isso, este teste escreveria no bucket de verdade.");
  }

  processo = await import("@/lib/bonus/publicar-processo");
  repo = await import("@/lib/bonus/carrossel-repositorio");
  regras = await import("@/lib/bonus/publicar-regras");
  slides = await import("@/lib/bonus/arte-slides");
  for (const [conta, nome] of [
    [CONTA, "thiagovannuchi"],
    [OUTRA, "n8x"],
  ] as const) {
    await banco.db().upsertAccount({
      ig_user_id: conta,
      username: nome,
      name: nome,
      profile_picture_url: null,
      access_token: "token-que-nao-vale-nada",
      token_expires_at: null,
    });
  }
  contas = await repo.contasParaArte();
});

afterAll(async () => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_BUCKET;
  await new Promise<void>((pronto) => servidor.close(() => pronto()));
});

beforeEach(async () => {
  await banco.db().sql().query(`delete from queue`);
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
  bucket.objetos.clear();
  bucket.chamadas = [];
  bucket.recusarLeitura.clear();
  drenagens = 0;
});

async function carrossel(arte: Record<string, unknown> = ARTE, texto: TextoDeCarrossel | TextoDePost = TEXTO): Promise<string> {
  const total = texto.tipo === "post" ? 1 : texto.slides.length + 2;
  const [c] = (await banco
    .db()
    .sql()
    .query(
      `insert into carrosseis_gerados (bonus_id, total_slides, palavra, contexto, estado, gerado, arte)
       values ($1, $2, 'SUMIDO', '{}'::jsonb, 'pronto', $3::jsonb, $4::jsonb) returning id`,
      [bonusId, total, texto, arte]
    )) as { id: string }[];
  return c.id;
}

const versaoDo = (n: number, texto: TextoDeCarrossel | TextoDePost = TEXTO) =>
  regras.versaoDoTextoDoSlide(slides.slidesDoTexto(texto)[n - 1]);

/** Assina, sobe pelo PUT de verdade (no bucket falso) e devolve o caminho. */
async function subir(id: string, numero: number, destino: "slide" | "fila"): Promise<string> {
  const a = await processo.assinarImagem({ id, numero, destino, arquivo: DECLARADO, contas });
  if (!a.ok) throw new Error(`assinar recusou: ${a.recusa.motivo}`);
  const r = await fetch(a.url, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: JPEG });
  if (!r.ok) throw new Error(`o PUT falhou: ${r.status}`);
  return a.caminho;
}

/** O carrossel com as imagens do Canva guardadas nos slides com espaço (2, 3 e 4). */
async function comImagens(): Promise<{ id: string; guardadas: Record<number, string> }> {
  const id = await carrossel();
  const guardadas: Record<number, string> = {};
  for (const n of [2, 3, 4]) {
    guardadas[n] = await subir(id, n, "slide");
    const g = await processo.guardarImagem({ id, numero: n, caminho: guardadas[n], contas });
    if (!g.ok) throw new Error(`guardar recusou: ${g.recusa.motivo}`);
  }
  return { id, guardadas };
}

/** As artes "Só texto" (1 e 5), subidas como o navegador sobe na hora de publicar. */
async function artesDe(id: string) {
  return Promise.all([1, 5].map(async (n) => ({ numero: n, caminho: await subir(id, n, "fila"), versao: versaoDo(n) })));
}

async function fila() {
  return (await banco.db().sql().query(`select account_id, payload, dedupe_key, status, not_before from queue order by created_at`)) as {
    account_id: string;
    payload: { forma: string; caminhos: string[]; legenda?: string };
    dedupe_key: string;
    status: string;
    not_before: Date;
  }[];
}

async function arteDe(id: string): Promise<Record<string, unknown>> {
  const [l] = (await banco.db().sql().query(`select arte from carrosseis_gerados where id = $1`, [id])) as { arte: Record<string, unknown> }[];
  return l.arte;
}

const daFila = () => [...bucket.objetos.keys()].filter((k) => k.startsWith(`${CONTA}/bonus-fila/`));

describe("assinar a imagem", () => {
  it("assina na pasta da conta do carrossel, no prefixo do destino", async () => {
    const id = await carrossel();
    const slide2 = await processo.assinarImagem({ id, numero: 2, destino: "slide", arquivo: DECLARADO, contas });
    const arte1 = await processo.assinarImagem({ id, numero: 1, destino: "fila", arquivo: DECLARADO, contas });
    expect(slide2.ok && slide2.caminho).toMatch(new RegExp(`^${CONTA}/bonus/[0-9a-f-]{36}\\.jpg$`));
    expect(arte1.ok && arte1.caminho).toMatch(new RegExp(`^${CONTA}/bonus-fila/[0-9a-f-]{36}\\.jpg$`));
  });

  it.each([
    ["o PNG", 2, "slide", { ...DECLARADO, mime: "image/png" }, "tipo"],
    ["a imagem quadrada", 2, "slide", { ...DECLARADO, largura: 1080, altura: 1080 }, "proporcao"],
    ["a imagem sem medida", 2, "slide", { ...DECLARADO, largura: undefined }, "proporcao"],
    ["a estreita demais, pela decisão do /publicar", 2, "slide", { ...DECLARADO, largura: 240, altura: 300 }, "arquivo"],
    ["o slide só texto no destino do slide", 1, "slide", DECLARADO, "sem_espaco"],
    ["o slide com espaço no destino da fila", 2, "fila", DECLARADO, "nao_e_so_texto"],
    ["o slide que não existe", 6, "slide", DECLARADO, "slide"],
  ] as const)("recusa %s", async (_nome, numero, destino, arquivo, motivo) => {
    const id = await carrossel();
    const r = await processo.assinarImagem({ id, numero, destino, arquivo, contas });
    expect(r.ok ? null : r.recusa.motivo).toBe(motivo);
    expect(bucket.chamadas.filter((c) => c.startsWith("assinou"))).toEqual([]);
  });

  it("recusa o carrossel sem conta, e o de conta desconectada", async () => {
    const semConta = await carrossel({ soTexto: [1, 5] });
    const r1 = await processo.assinarImagem({ id: semConta, numero: 2, destino: "slide", arquivo: DECLARADO, contas });
    expect(r1.ok ? null : r1.recusa.motivo).toBe("sem_conta");
    const desconectada = await carrossel({ ...ARTE, conta: "17841400000000099" });
    const r2 = await processo.assinarImagem({ id: desconectada, numero: 2, destino: "slide", arquivo: DECLARADO, contas });
    expect(r2.ok ? null : r2.recusa.motivo).toBe("conta_desconectada");
  });
});

describe("guardar a imagem", () => {
  it("guarda com a versão do texto, e a troca apaga a anterior do bucket", async () => {
    const id = await carrossel();
    const primeira = await subir(id, 3, "slide");
    expect(await processo.guardarImagem({ id, numero: 3, caminho: primeira, contas })).toEqual({ ok: true, versao: versaoDo(3) });
    const segunda = await subir(id, 3, "slide");
    await processo.guardarImagem({ id, numero: 3, caminho: segunda, contas });
    expect(bucket.objetos.has(primeira)).toBe(false);
    expect(bucket.objetos.has(segunda)).toBe(true);
    expect(regras.imagensDaArte(await arteDe(id), 5)[3]).toEqual({ caminho: segunda, versao: versaoDo(3) });
  });
});

describe("publicar", () => {
  it("agora: enfileira na conta do carrossel, com cópias em bonus-fila na ordem dos slides, e drena", async () => {
    const { id, guardadas } = await comImagens();
    const artes = await artesDe(id);
    const r = await processo.publicarNaFila({ id, quando: null, artes, contas, drenar });
    expect(r).toEqual({ ok: true, quando: null });

    const [item, ...resto] = await fila();
    expect(resto).toEqual([]);
    expect(item.account_id).toBe(CONTA);
    expect(item.payload.forma).toBe("carrossel");
    expect(item.payload.legenda).toBe(TEXTO.legenda);
    const caminhos = item.payload.caminhos;
    expect(caminhos).toHaveLength(5);
    expect(caminhos[0]).toBe(artes[0].caminho);
    expect(caminhos[4]).toBe(artes[1].caminho);
    for (const c of caminhos) expect(c).toMatch(new RegExp(`^${CONTA}/bonus-fila/[0-9a-f-]{36}\\.jpg$`));
    // As do meio são CÓPIAS das guardadas: nunca a guardada, que o dreno apagaria depois de publicar.
    for (const n of [2, 3, 4]) {
      expect(caminhos[n - 1]).not.toBe(guardadas[n]);
      expect(bucket.objetos.get(caminhos[n - 1])).toEqual(bucket.objetos.get(guardadas[n]));
      expect(bucket.objetos.has(guardadas[n])).toBe(true);
    }

    const publicacao = regras.publicacaoDaArte(await arteDe(id));
    expect(publicacao).toMatchObject({ chave: item.dedupe_key, caminhos });
    expect((publicacao as { enfileiradaEm: Date | null }).enfileiradaEm).toBeInstanceOf(Date);
    expect(drenagens).toBe(1);
  });

  it("agendado: entra com a hora pedida, e não drena", async () => {
    const { id } = await comImagens();
    const quando = new Date(Date.now() + 86_400_000);
    expect((await processo.publicarNaFila({ id, quando, artes: await artesDe(id), contas, drenar })).ok).toBe(true);
    const [item] = await fila();
    expect(Math.abs(item.not_before.getTime() - quando.getTime())).toBeLessThan(120_000);
    expect(drenagens).toBe(0);
  });

  it("o post de um slide sai como imagem única", async () => {
    const id = await carrossel({ ...ARTE, soTexto: [] }, POST);
    const caminho = await subir(id, 1, "slide");
    await processo.guardarImagem({ id, numero: 1, caminho, contas });
    expect((await processo.publicarNaFila({ id, quando: null, artes: [], contas, drenar })).ok).toBe(true);
    const [item] = await fila();
    expect(item.payload.forma).toBe("imagem");
    expect(item.payload.caminhos).toHaveLength(1);
  });

  it("dois publicar ao mesmo tempo: um post só, e as cópias e artes do outro saem do bucket", async () => {
    const { id } = await comImagens();
    const [artesA, artesB] = [await artesDe(id), await artesDe(id)];
    const [a, b] = await Promise.all([
      processo.publicarNaFila({ id, quando: null, artes: artesA, contas, drenar }),
      processo.publicarNaFila({ id, quando: null, artes: artesB, contas, drenar }),
    ]);
    expect([a.ok, b.ok].sort()).toEqual([false, true]);
    const perdeu = a.ok ? b : a;
    expect(perdeu.ok ? null : perdeu.recusa.motivo).toBe("travado");
    const itens = await fila();
    expect(itens).toHaveLength(1);
    expect(daFila().sort()).toEqual([...itens[0].payload.caminhos].sort());
  });

  it("falta imagem: recusa antes de tocar o bucket", async () => {
    const id = await carrossel();
    const r = await processo.publicarNaFila({ id, quando: null, artes: [], contas, drenar });
    expect(r.ok ? null : r.recusa).toEqual({ motivo: "faltam_imagens", slides: [2, 3, 4] });
    expect(bucket.chamadas).toEqual([]);
  });

  it("a arte velha é recusada, e as artes subidas saem do bucket", async () => {
    const { id } = await comImagens();
    const artes = await artesDe(id);
    const r = await processo.publicarNaFila({ id, quando: null, artes: [artes[0], { ...artes[1], versao: "00000000" }], contas, drenar });
    expect(r.ok ? null : r.recusa).toEqual({ motivo: "arte_velha", numero: 5 });
    expect(daFila()).toEqual([]);
    expect(await fila()).toEqual([]);
  });

  it("o caminho de uma arte que já está na fila de outro post é recusado, e não é apagado", async () => {
    const { id } = await comImagens();
    const artes = await artesDe(id);
    await banco
      .db()
      .sql()
      .query(
        `insert into queue (account_id, kind, payload, dedupe_key) values ($1, 'publicacao', $2::jsonb, 'pub:outro-post')`,
        [CONTA, { forma: "carrossel", caminhos: [artes[0].caminho, "x"] }]
      );
    const r = await processo.publicarNaFila({ id, quando: null, artes, contas, drenar });
    expect(r.ok ? null : r.recusa.motivo).toBe("caminho_na_fila");
    expect(bucket.objetos.has(artes[0].caminho)).toBe(true);
    expect(bucket.objetos.has(artes[1].caminho)).toBe(false);
  });

  it("a cópia que falha no meio: nada fica em bonus-fila, e nada é reservado", async () => {
    const { id, guardadas } = await comImagens();
    bucket.recusarLeitura.add(guardadas[3]);
    const r = await processo.publicarNaFila({ id, quando: null, artes: await artesDe(id), contas, drenar });
    expect(r.ok ? null : r.recusa).toEqual({ motivo: "copia", numero: 3 });
    expect(daFila()).toEqual([]);
    expect(regras.publicacaoDaArte(await arteDe(id))).toBeNull();
  });

  it("a fila que recusa desfaz a reserva e apaga as cópias e as artes", async () => {
    const { id } = await comImagens();
    const r = await processo.publicarNaFila({ id, quando: null, artes: await artesDe(id), contas, drenar, enfileirar: async () => false });
    expect(r.ok ? null : r.recusa.motivo).toBe("fila");
    expect(regras.publicacaoDaArte(await arteDe(id))).toBeNull();
    expect(daFila()).toEqual([]);
    expect(drenagens).toBe(0);
  });

  it("publicado e agendado, o carrossel trava: publicar, assinar e guardar são recusados", async () => {
    const { id } = await comImagens();
    await processo.publicarNaFila({ id, quando: new Date(Date.now() + 86_400_000), artes: await artesDe(id), contas, drenar });
    const r1 = await processo.publicarNaFila({ id, quando: null, artes: await artesDe(id).catch(() => []), contas, drenar });
    expect(r1.ok ? null : r1.recusa.motivo).toBe("travado");
    const r2 = await processo.assinarImagem({ id, numero: 2, destino: "slide", arquivo: DECLARADO, contas });
    expect(r2.ok ? null : r2.recusa.motivo).toBe("travado");
  });

  // ACHADO 75: desconectar a conta apaga as linhas da fila dela (lib/db.ts:469-474).
  it("a linha da fila apagada depois de enfileirar: publicar de novo segue recusado", async () => {
    const { id } = await comImagens();
    await processo.publicarNaFila({ id, quando: null, artes: await artesDe(id), contas, drenar });
    await banco.db().sql().query(`delete from queue where account_id = $1`, [CONTA]);
    const r = await processo.publicarNaFila({ id, quando: null, artes: [], contas, drenar });
    expect(r.ok ? null : r.recusa).toEqual({ motivo: "travado", estado: { tipo: "saiu_da_fila" } });
  });

  it("a reserva velha que nunca entrou na fila sai do bucket quando a nova a substitui", async () => {
    const { id } = await comImagens();
    const velhas = [await subir(id, 1, "fila"), await subir(id, 5, "fila")];
    await banco
      .db()
      .sql()
      .query(
        `update carrosseis_gerados set arte = arte || jsonb_build_object('publicacao',
           $2::jsonb || jsonb_build_object('reservada_em', now() - interval '11 minutes')) where id = $1`,
        [id, { chave: "pub:velha", caminhos: velhas }]
      );
    expect((await processo.publicarNaFila({ id, quando: null, artes: await artesDe(id), contas, drenar })).ok).toBe(true);
    for (const v of velhas) expect(bucket.objetos.has(v)).toBe(false);
  });

  // Revisão do plano (05/10): o navegador sempre assina um uuid novo, mas um pedido montado à mão pode
  // repetir na tentativa nova a arte da reserva velha. A limpeza da velha não pode apagar o que está
  // entrando na fila: o item sairia failed, com a mídia faltando.
  it("a reserva velha que repete um caminho desta tentativa não apaga o arquivo do post que entra", async () => {
    const { id } = await comImagens();
    const artes = await artesDe(id);
    await banco
      .db()
      .sql()
      .query(
        `update carrosseis_gerados set arte = arte || jsonb_build_object('publicacao',
           $2::jsonb || jsonb_build_object('reservada_em', now() - interval '11 minutes')) where id = $1`,
        [id, { chave: "pub:velha", caminhos: [artes[0].caminho] }]
      );
    expect((await processo.publicarNaFila({ id, quando: null, artes, contas, drenar })).ok).toBe(true);
    const [item] = await fila();
    expect(item.payload.caminhos[0]).toBe(artes[0].caminho);
    expect(bucket.objetos.has(artes[0].caminho)).toBe(true);
  });
});
```

Em `tests/bonus-publicar-estado.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-publicar-estado.test.ts b/tests/bonus-publicar-estado.test.ts
index cdea48b..bac1dae 100644
--- a/tests/bonus-publicar-estado.test.ts
+++ b/tests/bonus-publicar-estado.test.ts
@@ -221,6 +221,7 @@ describe("as recusas da publicação têm frase, cada uma", () => {
     { motivo: "arte_velha", numero: 5 },
     { motivo: "caminho_na_fila" },
     { motivo: "legenda", texto: "A legenda passa de 2.200 caracteres." },
+    { motivo: "quantidade", texto: "Um carrossel precisa de pelo menos duas mídias." },
     { motivo: "copia", numero: 2 },
     { motivo: "mudou" },
     { motivo: "fila" },
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-publicar-estado.test.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-publicar-processo.integracao.ts
```

Esperado: o puro: 1 cai (a frase da quantidade) e 28 passam (29). A integração: `[rede-global] ALVO: banco de TESTE`, e os 23 pulam, porque o processo não existe.

- [ ] **Passo 3: o código**

Crie `lib/bonus/publicar-processo.ts`:

```ts
import "server-only";
import { pastaDaConta, tetoDoBucket } from "@/lib/bucket";
import { publicacaoKey } from "@/lib/dedupe";
import { enqueuePublicacao } from "@/lib/engine";
import {
  decisaoDeAssinatura,
  problemaDaLegenda,
  recusaDaQuantidade,
  textoDaRecusaDaPublicacao,
  textoDoProblemaDaLegenda,
} from "@/lib/publicacao";
import { drainQueue } from "@/lib/queue-drain";
import { resolverConta, type ContaDoCabecalho } from "./arte-conta";
import { comEspaco, escolhasDaArte, type EscolhasDaArte } from "./arte-escolhas";
import { slidesDoTexto, type SlideParaArte } from "./arte-slides";
import type { LinhaDoCarrossel } from "./carrossel-linha";
import { lerCarrossel } from "./carrossel-repositorio";
import { textoDaLinhaDoCarrossel } from "./carrossel-tela";
import type { TextoDoCarrossel } from "./carrossel-texto";
import { apagarSemDerrubar, assinarCaminho, copiarTodasParaAFila } from "./publicar-bucket";
import { publicacaoLivre } from "./publicar-estado";
import {
  caminhosNaFila,
  desfazerReserva,
  estadoDoCarrossel,
  gravarImagemDoSlide,
  marcarEnfileirada,
  reservarPublicacao,
} from "./publicar-repositorio";
import {
  ehCaminhoDoDestino,
  formaDoCarrossel,
  imagensDaArte,
  problemaDaProporcaoDoSlide,
  versaoDoTextoDoSlide,
  type DestinoDaImagem,
} from "./publicar-regras";
import type { RecusaDaPublicacaoDoCarrossel } from "./publicar-textos";

// O PROCESSO DA PUBLICAÇÃO DO CARROSSEL (spec da Etapa 5, "Por dentro"): assinar, guardar e publicar.
// As actions (app/bonus/publicar-actions.ts) conferem a sessão, leem o formulário e chamam daqui; tudo
// o que decide e grava mora aqui, onde a integração alcança (o harness não forja sessão, de propósito).
//
// A CONTA É SEMPRE A DO CARROSSEL, gravada e conectada (origem `gravada` de `resolverConta`). O cookie
// não entra: nem para a pasta do bucket, nem para a fila.

type Recusa = { ok: false; recusa: RecusaDaPublicacaoDoCarrossel };
const recusa = (r: RecusaDaPublicacaoDoCarrossel): Recusa => ({ ok: false, recusa: r });

type CarrosselConferido = {
  ok: true;
  linha: LinhaDoCarrossel;
  texto: TextoDoCarrossel;
  escolhas: EscolhasDaArte;
  slides: SlideParaArte[];
  conta: string;
};

/** O que as três operações conferem antes de tudo: pronto, com conta gravada e conectada, e a trava livre. */
async function conferirCarrossel(id: string, contas: ContaDoCabecalho[]): Promise<CarrosselConferido | Recusa> {
  const linha = await lerCarrossel(id);
  const texto = linha?.estado === "pronto" ? textoDaLinhaDoCarrossel(linha) : null;
  if (!linha || !texto) return recusa({ motivo: "nao_pronto" });
  const escolhas = escolhasDaArte(linha.arte, linha.total_slides);
  const { origem } = resolverConta(contas, escolhas, undefined);
  if (origem === "selecionada") return recusa({ motivo: "sem_conta" });
  if (origem !== "gravada" || !escolhas.conta) return recusa({ motivo: "conta_desconectada" });
  const estado = await estadoDoCarrossel(linha.arte);
  if (!publicacaoLivre(estado)) return recusa({ motivo: "travado", estado });
  return { ok: true, linha, texto, escolhas, slides: slidesDoTexto(texto), conta: escolhas.conta };
}

const numero = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const mensagem = (e: unknown) => (e instanceof Error && e.message ? e.message : "erro sem mensagem");

/**
 * ASSINAR O UPLOAD DE UMA IMAGEM: no destino `slide`, a imagem do Canva de um slide com espaço; no
 * destino `fila`, a arte de um slide "Só texto", convertida no navegador na hora de publicar. Só
 * JPEG, em 4:5, pela `decisaoDeAssinatura` do /publicar com a forma do carrossel. As medidas são
 * declaradas pelo navegador, como no /publicar.
 */
export async function assinarImagem(p: {
  id: string;
  numero: number;
  destino: DestinoDaImagem;
  arquivo: unknown;
  contas: ContaDoCabecalho[];
}): Promise<{ ok: true; caminho: string; url: string } | Recusa> {
  const c = await conferirCarrossel(p.id, p.contas);
  if (!c.ok) return c;
  if (!Number.isInteger(p.numero) || !c.slides[p.numero - 1]) return recusa({ motivo: "slide" });
  const espaco = comEspaco(c.escolhas, p.numero);
  if (p.destino === "slide" && !espaco) return recusa({ motivo: "sem_espaco", numero: p.numero });
  if (p.destino === "fila" && espaco) return recusa({ motivo: "nao_e_so_texto", numero: p.numero });
  const arquivo = (p.arquivo !== null && typeof p.arquivo === "object" ? p.arquivo : {}) as Record<string, unknown>;
  if (arquivo.mime !== "image/jpeg") return recusa({ motivo: "tipo" });
  const proporcao = problemaDaProporcaoDoSlide(numero(arquivo.largura), numero(arquivo.altura));
  if (proporcao) return recusa({ motivo: "proporcao", problema: proporcao });
  try {
    const decisao = decisaoDeAssinatura({ ...arquivo, forma: formaDoCarrossel(c.linha.total_slides) }, await tetoDoBucket());
    if (!decisao.ok) return recusa({ motivo: "arquivo", texto: decisao.erro });
    return { ok: true, ...(await assinarCaminho(c.conta, p.destino)) };
  } catch (e) {
    return recusa({ motivo: "armazenamento", texto: mensagem(e) });
  }
}

/** GUARDAR A IMAGEM SUBIDA NO SLIDE. A anterior sai do bucket depois do `commit`, sem derrubar a troca. */
export async function guardarImagem(p: {
  id: string;
  numero: number;
  caminho: unknown;
  contas: ContaDoCabecalho[];
}): Promise<{ ok: true; versao: string } | Recusa> {
  const c = await conferirCarrossel(p.id, p.contas);
  if (!c.ok) return c;
  if (typeof p.caminho !== "string") return recusa({ motivo: "caminho" });
  const r = await gravarImagemDoSlide(p.id, p.numero, p.caminho);
  if (!r.ok) return r;
  if (r.anterior) await apagarSemDerrubar([r.anterior]);
  return { ok: true, versao: r.versao };
}

/** A arte de um slide "Só texto", subida pelo navegador na hora de publicar. */
export type ArteSubida = { numero: number; caminho: unknown; versao: unknown };

/**
 * PUBLICAR OU AGENDAR (spec, "Publicar"): confere tudo antes de tocar o bucket; copia as imagens
 * guardadas para a fila, fora de qualquer transação; reserva com a linha travada, conferindo de novo;
 * enfileira na conta do carrossel; marca a reserva como enfileirada (achado 75); e, com "agora", drena
 * a fila como o /publicar. Em qualquer recusa depois do navegador ter subido as artes, as artes e as
 * cópias desta tentativa saem do bucket.
 *
 * `enfileirar` e `drenar` entram por parâmetro só para o teste: em produção são as do /publicar.
 */
export async function publicarNaFila(p: {
  id: string;
  quando: Date | null;
  artes: ArteSubida[];
  contas: ContaDoCabecalho[];
  enfileirar?: typeof enqueuePublicacao;
  drenar?: () => Promise<unknown>;
}): Promise<{ ok: true; quando: Date | null } | Recusa> {
  const enfileirar = p.enfileirar ?? enqueuePublicacao;
  const drenar = p.drenar ?? drainQueue;
  const c = await conferirCarrossel(p.id, p.contas);
  if (!c.ok) return c;
  const total = c.linha.total_slides;
  const forma = formaDoCarrossel(total);
  const quantidade = recusaDaQuantidade(forma, total);
  if (quantidade) return recusa({ motivo: "quantidade", texto: textoDaRecusaDaPublicacao(quantidade) });

  const imagens = imagensDaArte(c.linha.arte, total);
  const comImagem = c.slides.filter((s) => comEspaco(c.escolhas, s.numero));
  const faltam = comImagem.filter((s) => !imagens[s.numero]).map((s) => s.numero);
  if (faltam.length) return recusa({ motivo: "faltam_imagens", slides: faltam });

  // AS ARTES "SÓ TEXTO", conferidas antes de tudo. Os caminhos que o navegador subiu só servem para
  // apagar numa recusa quando passam na forma exata de `bonus-fila` da pasta do carrossel e não
  // estão em payload nenhum da fila: sem isso, um pedido montado à mão faria esta tentativa apagar o
  // arquivo de outro post.
  const pasta = pastaDaConta(c.conta);
  const subidas = p.artes.filter((a) => ehCaminhoDoDestino(a.caminho, pasta, "fila")).map((a) => a.caminho as string);
  const descartaveis = subidas.filter((x, i) => subidas.indexOf(x) === i);
  const naFila = await caminhosNaFila(descartaveis);
  const descartar = (outros: string[] = []) => apagarSemDerrubar([...outros, ...descartaveis.filter((x) => !naFila.includes(x))]);
  if (naFila.length) {
    await descartar();
    return recusa({ motivo: "caminho_na_fila" });
  }
  const artes = new Map<number, string>();
  for (const a of p.artes) {
    if (!c.escolhas.soTexto.includes(a.numero)) {
      await descartar();
      return recusa({ motivo: "nao_e_so_texto", numero: a.numero });
    }
  }
  for (const n of c.escolhas.soTexto) {
    const a = p.artes.find((x) => x.numero === n);
    const caminho = a?.caminho;
    if (!a || !ehCaminhoDoDestino(caminho, pasta, "fila") || [...artes.values()].includes(caminho)) {
      await descartar();
      return recusa({ motivo: "arte_so_texto", numero: n });
    }
    if (a.versao !== versaoDoTextoDoSlide(c.slides[n - 1])) {
      await descartar();
      return recusa({ motivo: "arte_velha", numero: n });
    }
    artes.set(n, caminho);
  }

  const legenda = c.texto.legenda.trim();
  const problema = problemaDaLegenda(legenda);
  if (problema) {
    await descartar();
    return recusa({ motivo: "legenda", texto: textoDoProblemaDaLegenda(problema) });
  }

  // AS CÓPIAS, fora de qualquer transação: segurar a linha enquanto se baixa e sobe até 10 imagens
  // prenderia uma conexão por segundos e travaria os outros salvamentos do carrossel.
  const origens = comImagem.map((s) => ({ numero: s.numero, caminho: imagens[s.numero].caminho }));
  const copiadas = await copiarTodasParaAFila(origens, c.conta);
  if (!copiadas.ok) {
    await descartar();
    return recusa({ motivo: "copia", numero: copiadas.numero });
  }
  const caminhos = c.slides.map((s) => (comEspaco(c.escolhas, s.numero) ? copiadas.copias[s.numero] : (artes.get(s.numero) as string)));
  const chave = publicacaoKey(c.conta, forma, caminhos);

  const reserva = await reservarPublicacao(
    p.id,
    {
      texto: JSON.stringify(c.texto),
      soTexto: c.escolhas.soTexto,
      imagens: Object.fromEntries(origens.map((o) => [o.numero, o.caminho])),
    },
    chave,
    caminhos
  );
  if (!reserva.ok) {
    await descartar(Object.values(copiadas.copias));
    return reserva;
  }
  if (reserva.velha) {
    // A RESERVA VELHA, QUE NUNCA ENTROU NA FILA, sai do bucket: o que está em payload da fila fica,
    // e o que esta tentativa vai publicar também (revisão do plano: um pedido montado à mão que
    // repetisse a arte da reserva velha apagaria um arquivo do post que está entrando).
    const daVelhaNaFila = await caminhosNaFila(reserva.velha.caminhos);
    await apagarSemDerrubar(reserva.velha.caminhos.filter((x) => !daVelhaNaFila.includes(x) && !caminhos.includes(x)));
  }

  let entrou = false;
  try {
    entrou = await enfileirar(c.conta, { forma, caminhos, legenda: reserva.legenda }, p.quando);
  } catch {
    entrou = false;
  }
  if (!entrou) {
    await desfazerReserva(p.id, chave);
    await descartar(Object.values(copiadas.copias));
    return recusa({ motivo: "fila" });
  }

  // A MARCA DE ENFILEIRADA (achado 75). Se ela falhar, o post já está na fila e a resposta é de
  // sucesso: a linha da fila existe, e o estado vem dela.
  try {
    await marcarEnfileirada(p.id, chave);
  } catch {
    // O resíduo está escrito na spec: a marca falhar E a conta ser desconectada depois.
  }

  // ENFILEIRAR NÃO ENVIA (app/publicar/actions.ts:136-159): "agora" nasce com atraso zero, e sem a
  // drenagem o post sairia no próximo tique. O agendado não drena.
  if (p.quando === null) {
    try {
      await drenar();
    } catch {
      // A trava atômica do dreno garante que o próximo recupera; o estado na página diz "publicando".
    }
  }
  return { ok: true, quando: p.quando };
}
```

Em `lib/bonus/publicar-textos.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/publicar-textos.ts b/lib/bonus/publicar-textos.ts
index 535dc80..ee178a3 100644
--- a/lib/bonus/publicar-textos.ts
+++ b/lib/bonus/publicar-textos.ts
@@ -104,6 +104,7 @@ export type RecusaDaPublicacaoDoCarrossel =
   | { motivo: "arte_velha"; numero: number }
   | { motivo: "caminho_na_fila" }
   | { motivo: "legenda"; texto: string }
+  | { motivo: "quantidade"; texto: string }
   | { motivo: "copia"; numero: number }
   | { motivo: "mudou" }
   | { motivo: "fila" }
@@ -142,6 +143,7 @@ export function textoDaRecusaDaPublicacaoDoCarrossel(r: RecusaDaPublicacaoDoCarr
     case "caminho_na_fila":
       return "Uma das imagens já está na fila de outro post. Recarregue a página e publique de novo.";
     case "legenda":
+    case "quantidade":
       return r.texto;
     case "copia":
       return `Não consegui preparar a imagem do slide ${r.numero} para a fila. Nada foi publicado; tente de novo em instantes.`;
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx vitest run tests/bonus-publicar-estado.test.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-publicar-processo.integracao.ts
```

Esperado: `tsc` limpo; 29 casos puros passam; a integração, `[rede-global] ALVO: banco de TESTE` e 23 passam.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/publicar-processo.ts lib/bonus/publicar-textos.ts tests/bonus-publicar-estado.test.ts testes-integracao/bonus-publicar-processo.integracao.ts
test "$(git branch --show-current)" = "publicar-do-carrossel"
git add lib/bonus/publicar-processo.ts lib/bonus/publicar-textos.ts tests/bonus-publicar-estado.test.ts testes-integracao/bonus-publicar-processo.integracao.ts
git commit -m "feat(bonus): assinar, guardar e publicar o carrossel, com a reserva antes da fila"
```

---

### FASE 5.6 — As actions, com a sessão conferida

**Arquivos:**
- Criar: `app/bonus/publicar-actions.ts`
- Modificar: `lib/bonus/publicar-textos.ts`
- Testar: `tests/bonus-publicar-paginas.test.ts`

**Interfaces:**
- Consome: `assinarImagem`, `guardarImagem`, `publicarNaFila` (FASE 5.5); de `lib/publicacao.ts`,
  `camposDaDataHora`, `fusoDoCampo`, `instanteDoAgendamento`, `momentoDaPublicacao`,
  `textoDaRecusaDaPublicacao`; `urlPublicaSeDerParaMontar` (`lib/bucket.ts`).
- Produz, de `publicar-actions.ts` (`"use server"`, cada uma começa por `await exigirSessao();`):
  `assinarImagemDoCarrossel(pedido: unknown): Promise<RespostaDaAssinatura>`;
  `guardarImagemDoSlide(pedido: unknown): Promise<AvisoDaImagem>`; `publicarCarrossel(pedido:
  unknown): Promise<AvisoDaPublicacao>`. O pedido do publicar é `{ id, quando: "agora" | "depois",
  dataHora, fuso, artes }`.
- Produz, de `publicar-textos.ts`: `TEXTO_PEDIDO_INVALIDO`, `textoDaPublicacaoMandada(agendada)`,
  `type RespostaDaAssinatura`, e `AvisoDaImagem` com `versao?` e `imagem?`.

- [ ] **Passo 1: o teste**

Crie `tests/bonus-publicar-paginas.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TEXTO_PEDIDO_INVALIDO, textoDaPublicacaoMandada } from "@/lib/bonus/publicar-textos";

// AS GUARDAS DA PUBLICAÇÃO DO CARROSSEL (spec da Etapa 5, "Segurança"). O harness da integração não
// forja sessão (de propósito): as actions se provam pelo processo, que a integração alcança, e por
// estas leituras do código.

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const ler = (rel: string) => readFileSync(`${RAIZ}/${rel}`, "utf8").replace(/\r\n/g, "\n");
const ACTIONS = "app/bonus/publicar-actions.ts";
const PROCESSO = "lib/bonus/publicar-processo.ts";

/** As funções exportadas de um arquivo e a primeira instrução de cada uma. */
function primeirasInstrucoes(fonte: string): { nome: string; primeira: string }[] {
  const achados: { nome: string; primeira: string }[] = [];
  const re = /export async function (\w+)\([^)]*\)[^{]*\{\s*([^\n;]+;)/g;
  for (const m of fonte.matchAll(re)) achados.push({ nome: m[1], primeira: m[2].trim() });
  return achados;
}

describe("toda action da publicação confere a sessão antes de qualquer coisa", () => {
  it("as três actions começam por `await exigirSessao();`", () => {
    const achados = primeirasInstrucoes(ler(ACTIONS));
    expect(achados.map((a) => a.nome).sort()).toEqual(["assinarImagemDoCarrossel", "guardarImagemDoSlide", "publicarCarrossel"]);
    for (const a of achados) expect(a.primeira, a.nome).toBe("await exigirSessao();");
  });

  it("nenhum export escapa do leitor: num arquivo 'use server', todo export é action", () => {
    const fonte = ler(ACTIONS);
    expect(fonte.startsWith('"use server";')).toBe(true);
    expect((fonte.match(/^export /gm) ?? []).length).toBe(primeirasInstrucoes(fonte).length);
  });
});

describe("a conta é sempre a do carrossel", () => {
  it("as actions não leem conta do que o navegador manda", () => {
    expect(ler(ACTIONS)).not.toMatch(/\.conta\b|\["conta"\]|get\(\s*["']conta["']/);
  });

  // A rota de assinar do /publicar e a publicação dele usam a conta do COOKIE, de propósito. Aqui a
  // conta é a gravada no carrossel: o cookie não entra nem na pasta do bucket, nem na fila.
  it("nem as actions nem o processo leem o cookie da conta selecionada", () => {
    for (const arquivo of [ACTIONS, PROCESSO, "lib/bonus/publicar-bucket.ts", "lib/bonus/publicar-repositorio.ts"]) {
      const fonte = ler(arquivo);
      expect(fonte, arquivo).not.toContain("getSelectedAccount");
      expect(fonte, arquivo).not.toContain("ACCOUNT_COOKIE");
      expect(fonte, arquivo).not.toContain("/api/midia/assinar");
    }
  });

  it("o processo enfileira e copia com a conta conferida do carrossel", () => {
    const fonte = ler(PROCESSO);
    expect(fonte).toContain("enfileirar(c.conta, { forma, caminhos, legenda: reserva.legenda }, p.quando)");
    expect(fonte).toContain("copiarTodasParaAFila(origens, c.conta)");
    expect(fonte).toContain('if (origem !== "gravada" || !escolhas.conta) return recusa({ motivo: "conta_desconectada" });');
  });
});

// A RESPOSTA VOLTA COMO ESTADO, e nunca por redirect para a própria página (achado 52): o redirect
// recria a página, e o que estava digitado nos outros cards se perderia.
describe("as actions da publicação respondem sem recriar a página", () => {
  it("o único redirect é o da sessão, para /entrar", () => {
    const redirects = ler(ACTIONS).match(/redirect\([^)]*\)/g) ?? [];
    expect(redirects).toEqual(['redirect("/entrar")']);
  });
});

describe("as frases das actions", () => {
  it("o pedido inválido e o sucesso, que não diz publicado: enfileirar não é publicar", () => {
    expect(TEXTO_PEDIDO_INVALIDO).toMatch(/Recarregue a página/);
    expect(textoDaPublicacaoMandada(false)).not.toMatch(/^Publicado/);
    expect(textoDaPublicacaoMandada(true)).toMatch(/^Agendado/);
  });
});
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-publicar-paginas.test.ts
```

Esperado: 6 caem e 1 passa (7): o arquivo das actions e as frases dele não existem; passa só a guarda do processo, que já existe.

- [ ] **Passo 3: o código**

Crie `app/bonus/publicar-actions.ts`:

```ts
"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isValidSession, SESSION_COOKIE } from "@/lib/auth";
import { urlPublicaSeDerParaMontar } from "@/lib/bucket";
import { contasParaArte } from "@/lib/bonus/carrossel-repositorio";
import { ehIdDeBonus } from "@/lib/bonus/pedido";
import { assinarImagem, guardarImagem, publicarNaFila, type ArteSubida } from "@/lib/bonus/publicar-processo";
import {
  TEXTO_IMAGEM_GUARDADA,
  TEXTO_PEDIDO_INVALIDO,
  textoDaPublicacaoMandada,
  textoDaRecusaDaPublicacaoDoCarrossel,
  type AvisoDaImagem,
  type AvisoDaPublicacao,
  type RespostaDaAssinatura,
} from "@/lib/bonus/publicar-textos";
import { camposDaDataHora, fusoDoCampo, instanteDoAgendamento, momentoDaPublicacao, textoDaRecusaDaPublicacao } from "@/lib/publicacao";

// AS ACTIONS DA PUBLICAÇÃO DO CARROSSEL (spec da Etapa 5).
//
// TODA ACTION COMEÇA CONFERINDO A SESSÃO, e não confia só no proxy.ts: Server Action tem endereço
// próprio. tests/bonus-publicar-paginas.test.ts confere que a primeira instrução de cada uma é
// `await exigirSessao();`.
//
// Elas só leem o que o navegador mandou, sem confiar no tipo, e chamam o processo
// (lib/bonus/publicar-processo.ts), onde mora tudo o que decide e grava. A CONTA NUNCA VEM DO
// NAVEGADOR: é a gravada no carrossel. A resposta volta como estado, e nunca por redirect (achado 52):
// recriar a página apagaria o que está digitado nos outros cards.

async function exigirSessao(): Promise<void> {
  const jarra = await cookies();
  if (!isValidSession(jarra.get(SESSION_COOKIE)?.value)) redirect("/entrar");
}

const registro = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const inteiro = (v: unknown): number => (typeof v === "number" && Number.isInteger(v) ? v : 0);

/**
 * A PERMISSÃO PARA SUBIR UMA IMAGEM: no destino `slide`, a do Canva de um slide com espaço; no
 * destino `fila`, a arte "Só texto" convertida na hora de publicar. O navegador sobe direto ao
 * bucket, pela URL assinada, porque a Vercel recusa corpo acima de 4,5 MB (lib/bucket.ts).
 */
export async function assinarImagemDoCarrossel(pedido: unknown): Promise<RespostaDaAssinatura> {
  await exigirSessao();
  const p = registro(pedido);
  const destino = p.destino === "slide" || p.destino === "fila" ? p.destino : null;
  if (!ehIdDeBonus(p.id) || !destino) return { ok: false, texto: TEXTO_PEDIDO_INVALIDO };
  const r = await assinarImagem({ id: p.id, numero: inteiro(p.numero), destino, arquivo: p.arquivo, contas: await contasParaArte() });
  return r.ok ? { ok: true, caminho: r.caminho, url: r.url } : { ok: false, texto: textoDaRecusaDaPublicacaoDoCarrossel(r.recusa) };
}

/** GUARDAR A IMAGEM SUBIDA NO SLIDE. A resposta leva a versão do texto e o endereço da imagem. */
export async function guardarImagemDoSlide(pedido: unknown): Promise<AvisoDaImagem> {
  await exigirSessao();
  const p = registro(pedido);
  const em = Date.now();
  if (!ehIdDeBonus(p.id) || typeof p.caminho !== "string") return { tom: "erro", texto: TEXTO_PEDIDO_INVALIDO, em };
  const r = await guardarImagem({ id: p.id, numero: inteiro(p.numero), caminho: p.caminho, contas: await contasParaArte() });
  if (!r.ok) return { tom: "erro", texto: textoDaRecusaDaPublicacaoDoCarrossel(r.recusa), em };
  return { tom: "ok", texto: TEXTO_IMAGEM_GUARDADA, em, versao: r.versao, imagem: urlPublicaSeDerParaMontar(p.caminho) };
}

/**
 * PUBLICAR OU AGENDAR. A hora é lida pelas mesmas funções puras do /publicar (o "agora" ou a data e
 * hora com o fuso do navegador), e o resto é o processo.
 */
export async function publicarCarrossel(pedido: unknown): Promise<AvisoDaPublicacao> {
  await exigirSessao();
  const p = registro(pedido);
  const em = Date.now();
  if (!ehIdDeBonus(p.id)) return { tom: "erro", texto: TEXTO_PEDIDO_INVALIDO, em };
  const campos = camposDaDataHora(p.dataHora);
  const momento = momentoDaPublicacao(p.quando, campos ? instanteDoAgendamento(campos, fusoDoCampo(p.fuso)) : null, Date.now());
  if (!momento.ok) return { tom: "erro", texto: textoDaRecusaDaPublicacao(momento.motivo), em };
  const artes: ArteSubida[] = (Array.isArray(p.artes) ? p.artes : []).map((a) => {
    const r = registro(a);
    return { numero: inteiro(r.numero), caminho: r.caminho, versao: r.versao };
  });
  const r = await publicarNaFila({ id: p.id, quando: momento.quando, artes, contas: await contasParaArte() });
  return r.ok
    ? { tom: "ok", texto: textoDaPublicacaoMandada(r.quando !== null), em }
    : { tom: "erro", texto: textoDaRecusaDaPublicacaoDoCarrossel(r.recusa), em };
}
```

Em `lib/bonus/publicar-textos.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/publicar-textos.ts b/lib/bonus/publicar-textos.ts
index ee178a3..836268d 100644
--- a/lib/bonus/publicar-textos.ts
+++ b/lib/bonus/publicar-textos.ts
@@ -156,8 +156,24 @@ export function textoDaRecusaDaPublicacaoDoCarrossel(r: RecusaDaPublicacaoDoCarr
   }
 }
 
-/** A resposta de assinar e de guardar a imagem de um slide, como ESTADO (achado 52). */
-export type AvisoDaImagem = Aviso & { em: number };
+/** O pedido que chegou à action sem a forma que a tela manda: página velha, ou montado à mão. */
+export const TEXTO_PEDIDO_INVALIDO = "O pedido chegou incompleto. Recarregue a página e tente de novo.";
+
+/** O "Publicar" deu certo: o post está na fila, e não publicado ainda. */
+export function textoDaPublicacaoMandada(agendada: boolean): string {
+  return agendada
+    ? "Agendado. O post está no calendário do /publicar."
+    : "Na fila do /publicar. O Instagram leva até um minuto para mostrar o post.";
+}
+
+/** A resposta de assinar: o caminho e a URL assinada, ou a frase da recusa. */
+export type RespostaDaAssinatura = { ok: true; caminho: string; url: string } | { ok: false; texto: string };
+
+/**
+ * A resposta de guardar a imagem de um slide, como ESTADO (achado 52): com a versão do texto, para o
+ * aviso "o texto mudou", e o endereço público da imagem, para a miniatura do card.
+ */
+export type AvisoDaImagem = Aviso & { em: number; versao?: string; imagem?: string | null };
 
 /** A resposta do "Publicar", como ESTADO. */
 export type AvisoDaPublicacao = Aviso & { em: number };
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx vitest run tests/bonus-publicar-paginas.test.ts
```

Esperado: `tsc` limpo e 7 casos passam.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" app/bonus/publicar-actions.ts lib/bonus/publicar-textos.ts tests/bonus-publicar-paginas.test.ts
test "$(git branch --show-current)" = "publicar-do-carrossel"
git add app/bonus/publicar-actions.ts lib/bonus/publicar-textos.ts tests/bonus-publicar-paginas.test.ts
git commit -m "feat(bonus): as actions de assinar, guardar e publicar o carrossel, com a sessão conferida"
```

---

### FASE 5.7 — A imagem no navegador: o JPEG, o 4:5 e as artes "Só texto"

**Arquivos:**
- Criar: `app/bonus/[id]/carrossel/[cid]/imagem-no-navegador.ts`
- Modificar: `lib/bonus/publicar-textos.ts`
- Testar: `testes-dom/bonus-publicar-imagem.dom.tsx`

**Interfaces:**
- Consome: `problemaDaProporcaoDoSlide` (FASE 5.1); as frases (FASE 5.2); `urlDaArte` (Etapa 3);
  `planoDaConversao` e `medidasDaConversao` (`lib/publicacao.ts`, sem mudar nada nele).
- Produz: `type ImagemPronta = { jpeg: Blob; largura; altura }`; `converterParaJpeg(imagem, plano)`
  (cópia de `app/publicar/enviador.tsx:549-583`, com `Blob` no lugar de `File`);
  `prepararImagem(arquivo): Promise<ImagemPronta>`; `subirParaOBucket(url, jpeg)`;
  `enviarImagemDoSlide({ carrosselId, numero, arquivo, assinar, guardar }): Promise<AvisoDaImagem>`;
  `prepararArtesSoTexto({ bonusId, carrosselId, soTexto, versoesDaMiniatura, versoesDoTexto, assinar
  })`. E as frases `TEXTO_IMAGEM_ILEGIVEL`, `TEXTO_FORMATO_DA_IMAGEM`, `textoDaArteQueNaoVeio(n)`.

- [ ] **Passo 1: o teste**

Crie `testes-dom/bonus-publicar-imagem.dom.tsx`:

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  converterParaJpeg,
  enviarImagemDoSlide,
  prepararArtesSoTexto,
  prepararImagem,
} from "@/app/bonus/[id]/carrossel/[cid]/imagem-no-navegador";
import { urlDaArte } from "@/lib/bonus/arte-tela";
import type { AvisoDaImagem, RespostaDaAssinatura } from "@/lib/bonus/publicar-textos";

// A IMAGEM NO NAVEGADOR (spec da Etapa 5): a conversão para JPEG, a conferência do 4:5 antes de
// subir, o PUT direto ao bucket e as artes "Só texto" na hora de publicar. O jsdom não tem `canvas`
// nem `createImageBitmap`: os dois são falsos aqui, e cada pincelada fica anotada. O que se prova é a
// ORDEM e os NÚMEROS (o branco antes do desenho, as medidas do plano, o JPEG a 0,9), e não o pixel.

const BONUS = "0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f";
const CARROSSEL = "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d";

let medidas: { width: number; height: number };
let pinceladas: string[];
let toBlob: { tipo: string; qualidade: number; largura: number; altura: number }[];
let puts: { url: string; tipo: string | null; corpo: unknown }[];
let artesPedidas: string[];

beforeEach(() => {
  medidas = { width: 1080, height: 1350 };
  pinceladas = [];
  toBlob = [];
  puts = [];
  artesPedidas = [];
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({ width: medidas.width, height: medidas.height, close: () => pinceladas.push("fechou") }))
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function () {
    const ctx = {
      set fillStyle(v: string) {
        pinceladas.push(`cor ${v}`);
      },
      fillRect: (_x: number, _y: number, l: number, a: number) => pinceladas.push(`pintou ${l}x${a}`),
      drawImage: (_b: unknown, _x: number, _y: number, l: number, a: number) => pinceladas.push(`desenhou ${l}x${a}`),
    };
    return ctx as unknown as CanvasRenderingContext2D;
  } as never);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (this: HTMLCanvasElement, fn, tipo, qualidade) {
    toBlob.push({ tipo: tipo ?? "", qualidade: qualidade as number, largura: this.width, altura: this.height });
    fn(new Blob(["jpeg"], { type: "image/jpeg" }));
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      if (init.method === "PUT") {
        puts.push({ url, tipo: new Headers(init.headers).get("content-type"), corpo: init.body });
        return new Response("{}", { status: 200 });
      }
      artesPedidas.push(url);
      return new Response("png", { status: 200, headers: { "content-type": "image/png" } });
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const arquivo = (tipo: string) => new File(["x"], "slide.png", { type: tipo });

describe("a conversão para JPEG, copiada do enviador do /publicar", () => {
  // A ARMADILHA Nº 1 (app/publicar/enviador.tsx:537-544): o canvas nasce transparente, e o PNG com
  // fundo transparente viraria JPEG de fundo preto.
  it("pinta de branco antes de desenhar, nas medidas do plano, e grava JPEG a 0,9", async () => {
    const jpeg = await converterParaJpeg(arquivo("image/png"), { largura: 1080, altura: 1350, qualidade: 0.9 });
    expect(pinceladas).toEqual(["cor #ffffff", "pintou 1080x1350", "desenhou 1080x1350", "fechou"]);
    expect(toBlob).toEqual([{ tipo: "image/jpeg", qualidade: 0.9, largura: 1080, altura: 1350 }]);
    expect(jpeg.type).toBe("image/jpeg");
  });

  it("o plano sem medida usa a da imagem", async () => {
    await converterParaJpeg(arquivo("image/png"), { largura: 0, altura: 0, qualidade: 0.9 });
    expect(toBlob[0]).toMatchObject({ largura: 1080, altura: 1350 });
  });
});

describe("preparar a imagem", () => {
  it("o JPEG que já serve vai cru, sem passar pelo canvas", async () => {
    const original = arquivo("image/jpeg");
    const pronta = await prepararImagem(original);
    expect(pronta).toEqual({ jpeg: original, largura: 1080, altura: 1350 });
    expect(toBlob).toEqual([]);
  });

  it("o PNG vira JPEG nas mesmas medidas", async () => {
    const pronta = await prepararImagem(arquivo("image/png"));
    expect(pronta.jpeg.type).toBe("image/jpeg");
    expect(pronta).toMatchObject({ largura: 1080, altura: 1350 });
  });

  it("acima de 1440 de largura, encolhe até 1440, mantendo a proporção", async () => {
    medidas = { width: 2160, height: 2700 };
    const pronta = await prepararImagem(arquivo("image/jpeg"));
    expect(pronta).toMatchObject({ largura: 1440, altura: 1800 });
    expect(toBlob[0]).toMatchObject({ largura: 1440, altura: 1800 });
  });
});

describe("enviar a imagem do Canva de um slide", () => {
  const assinarOk = vi.fn(
    async (): Promise<RespostaDaAssinatura> => ({ ok: true, caminho: "178/bonus/u.jpg", url: "https://bucket/sign/178/bonus/u.jpg?token=t" })
  );
  const guardado: AvisoDaImagem = { tom: "ok", texto: "Imagem guardada.", em: 1, versao: "0a1b2c3d", imagem: "https://bucket/public/u.jpg" };

  it("assina com as medidas do JPEG, sobe pelo PUT e guarda", async () => {
    const guardar = vi.fn(async () => guardado);
    const r = await enviarImagemDoSlide({ carrosselId: CARROSSEL, numero: 3, arquivo: arquivo("image/png"), assinar: assinarOk, guardar });
    expect(r).toBe(guardado);
    expect(assinarOk).toHaveBeenCalledWith({
      id: CARROSSEL,
      numero: 3,
      destino: "slide",
      arquivo: { nome: "slide-3.jpg", mime: "image/jpeg", bytes: 4, largura: 1080, altura: 1350 },
    });
    expect(puts).toEqual([{ url: "https://bucket/sign/178/bonus/u.jpg?token=t", tipo: "image/jpeg", corpo: expect.any(Blob) }]);
    expect(guardar).toHaveBeenCalledWith({ id: CARROSSEL, numero: 3, caminho: "178/bonus/u.jpg" });
  });

  it("a imagem que não é 4:5 é recusada antes de pedir a assinatura", async () => {
    medidas = { width: 1080, height: 1080 };
    const assinar = vi.fn();
    const r = await enviarImagemDoSlide({ carrosselId: CARROSSEL, numero: 3, arquivo: arquivo("image/jpeg"), assinar, guardar: vi.fn() });
    expect(r).toMatchObject({ tom: "erro", texto: "A imagem do slide tem de ser 4:5, como a arte (1080×1350)." });
    expect(assinar).not.toHaveBeenCalled();
    expect(puts).toEqual([]);
  });

  it("o formato que o canvas não converte é recusado antes de pedir a assinatura", async () => {
    const assinar = vi.fn();
    const r = await enviarImagemDoSlide({ carrosselId: CARROSSEL, numero: 3, arquivo: arquivo("image/gif"), assinar, guardar: vi.fn() });
    expect(r).toMatchObject({ tom: "erro", texto: "Envie a imagem do Canva em JPEG, PNG ou WEBP." });
    expect(assinar).not.toHaveBeenCalled();
  });

  it("a recusa da assinatura volta como aviso, sem subir nem guardar", async () => {
    const guardar = vi.fn();
    const r = await enviarImagemDoSlide({
      carrosselId: CARROSSEL,
      numero: 3,
      arquivo: arquivo("image/jpeg"),
      assinar: async () => ({ ok: false, texto: "Agendado: para mudar, cancele no calendário." }),
      guardar,
    });
    expect(r).toMatchObject({ tom: "erro", texto: "Agendado: para mudar, cancele no calendário." });
    expect(puts).toEqual([]);
    expect(guardar).not.toHaveBeenCalled();
  });

  it("o PUT recusado volta como aviso, sem guardar", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 403 })));
    const guardar = vi.fn();
    const r = await enviarImagemDoSlide({ carrosselId: CARROSSEL, numero: 3, arquivo: arquivo("image/jpeg"), assinar: assinarOk, guardar });
    expect(r).toMatchObject({ tom: "erro", texto: "O armazenamento recusou a imagem (HTTP 403)." });
    expect(guardar).not.toHaveBeenCalled();
  });
});

describe("as artes Só texto, na hora de publicar", () => {
  it("baixa a arte de cada slide só texto, converte, assina no destino da fila e sobe", async () => {
    const assinar = vi.fn(async (p: unknown): Promise<RespostaDaAssinatura> => {
      const n = (p as { numero: number }).numero;
      return { ok: true, caminho: `178/bonus-fila/${n}.jpg`, url: `https://bucket/sign/${n}?token=t` };
    });
    const r = await prepararArtesSoTexto({
      bonusId: BONUS,
      carrosselId: CARROSSEL,
      soTexto: [1, 5],
      versoesDaMiniatura: ["m1", "m2", "m3", "m4", "m5"],
      versoesDoTexto: ["t1", "t2", "t3", "t4", "t5"],
      assinar,
    });
    expect(r).toEqual({
      ok: true,
      artes: [
        { numero: 1, caminho: "178/bonus-fila/1.jpg", versao: "t1" },
        { numero: 5, caminho: "178/bonus-fila/5.jpg", versao: "t5" },
      ],
    });
    expect(artesPedidas).toEqual([urlDaArte(BONUS, CARROSSEL, 1, "m1"), urlDaArte(BONUS, CARROSSEL, 5, "m5")]);
    expect(assinar.mock.calls.map((c) => (c[0] as { destino: string }).destino)).toEqual(["fila", "fila"]);
    expect(puts.map((p) => p.tipo)).toEqual(["image/jpeg", "image/jpeg"]);
    expect(toBlob).toHaveLength(2);
  });

  // Medido no ensaio: sem esta conferência, uma resposta que não fosse PNG (nem JPEG) subia crua,
  // declarada como JPEG, e o servidor não vê os bytes para conferir.
  it("a arte que não vira JPEG não sobe", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("texto", { status: 200, headers: { "content-type": "text/plain" } })));
    const assinar = vi.fn();
    const r = await prepararArtesSoTexto({
      bonusId: BONUS,
      carrosselId: CARROSSEL,
      soTexto: [1],
      versoesDaMiniatura: ["m1"],
      versoesDoTexto: ["t1"],
      assinar,
    });
    expect(r).toEqual({ ok: false, texto: "Não consegui preparar a arte do slide 1. Recarregue a página e publique de novo." });
    expect(assinar).not.toHaveBeenCalled();
  });

  it("a arte que não vem para tudo, dizendo qual slide", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("erro", { status: 500 })));
    const assinar = vi.fn();
    const r = await prepararArtesSoTexto({
      bonusId: BONUS,
      carrosselId: CARROSSEL,
      soTexto: [1],
      versoesDaMiniatura: ["m1"],
      versoesDoTexto: ["t1"],
      assinar,
    });
    expect(r).toEqual({ ok: false, texto: "Não consegui preparar a arte do slide 1. Recarregue a página e publique de novo." });
    expect(assinar).not.toHaveBeenCalled();
  });
});
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run --config vitest.dom.config.ts testes-dom/bonus-publicar-imagem.dom.tsx
```

Esperado: o arquivo cai sem casos: o módulo `imagem-no-navegador.ts` não existe.

- [ ] **Passo 3: o código**

Crie `app/bonus/[id]/carrossel/[cid]/imagem-no-navegador.ts`:

```ts
import { urlDaArte } from "@/lib/bonus/arte-tela";
import { problemaDaProporcaoDoSlide } from "@/lib/bonus/publicar-regras";
import {
  TEXTO_FORMATO_DA_IMAGEM,
  TEXTO_IMAGEM_ILEGIVEL,
  textoDaArteQueNaoVeio,
  textoDaProporcao,
  type AvisoDaImagem,
  type RespostaDaAssinatura,
} from "@/lib/bonus/publicar-textos";
import { medidasDaConversao, planoDaConversao } from "@/lib/publicacao";

// A IMAGEM NO NAVEGADOR (spec da Etapa 5). O arquivo NÃO passa pelo servidor: a Vercel recusa corpo
// acima de 4,5 MB (lib/bucket.ts), e o navegador sobe direto ao bucket, pela URL assinada que a
// action devolve. Aqui moram a conversão para JPEG, a conferência do 4:5 antes de subir, o PUT, e as
// artes "Só texto" preparadas na hora de publicar. As actions entram por parâmetro, para o teste de
// tela (testes-dom/bonus-publicar-imagem.dom.tsx) usar falsas.

export type ImagemPronta = { jpeg: Blob; largura: number; altura: number };

/**
 * Redesenha a imagem como JPEG, no tamanho do plano.
 *
 * COPIADA de `converterParaJpeg` (app/publicar/enviador.tsx:549-583, do Vinícius), que não é
 * exportada: exportá-la seria mexer no arquivo dele. A diferença é o `Blob` no lugar do `File`, porque
 * a arte "Só texto" chega de um `fetch`, sem nome. As decisões continuam nas funções puras que o
 * /publicar exporta (`planoDaConversao`, `medidasDaConversao`, lib/publicacao.ts).
 *
 * O `fillRect` BRANCO NÃO É ENFEITE (a armadilha nº 1, app/publicar/enviador.tsx:537-544): o canvas
 * nasce transparente, e o JPEG não tem canal alfa. Sem ele, o PNG de fundo transparente sairia com
 * fundo PRETO, no perfil público.
 */
export async function converterParaJpeg(imagem: Blob, plano: { largura: number; altura: number; qualidade: number }): Promise<Blob> {
  const bitmap = await createImageBitmap(imagem);
  try {
    const { largura, altura } = medidasDaConversao(plano, bitmap);
    const tela = document.createElement("canvas");
    tela.width = largura;
    tela.height = altura;
    const pincel = tela.getContext("2d");
    if (!pincel) throw new Error("Este navegador não permitiu preparar a imagem.");
    pincel.fillStyle = "#ffffff";
    pincel.fillRect(0, 0, largura, altura);
    pincel.drawImage(bitmap, 0, 0, largura, altura);
    const blob = await new Promise<Blob | null>((resolver) => tela.toBlob(resolver, "image/jpeg", plano.qualidade));
    if (!blob) throw new Error("Não foi possível preparar a imagem para envio.");
    return blob;
  } finally {
    bitmap.close();
  }
}

/** A imagem em JPEG e as medidas FINAIS dela: JPEG que já serve vai cru; o resto passa pelo canvas. */
export async function prepararImagem(arquivo: Blob): Promise<ImagemPronta> {
  const bitmap = await createImageBitmap(arquivo);
  const medida = { largura: bitmap.width, altura: bitmap.height };
  bitmap.close();
  const plano = planoDaConversao({ mime: arquivo.type, ...medida });
  if (!plano.converter) return { jpeg: arquivo, ...medida };
  const final = medidasDaConversao(plano, { width: medida.largura, height: medida.altura });
  return { jpeg: await converterParaJpeg(arquivo, plano), ...final };
}

/** O PUT na URL assinada. Sem cabeçalho de autenticação: o token da URL é a credencial inteira. */
export async function subirParaOBucket(url: string, jpeg: Blob): Promise<void> {
  const r = await fetch(url, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: jpeg });
  if (!r.ok) throw new Error(`O armazenamento recusou a imagem (HTTP ${r.status}).`);
}

type Assinar = (pedido: unknown) => Promise<RespostaDaAssinatura>;
type Guardar = (pedido: unknown) => Promise<AvisoDaImagem>;

const erro = (texto: string): AvisoDaImagem => ({ tom: "erro", texto, em: Date.now() });
const mensagem = (e: unknown) => (e instanceof Error && e.message ? e.message : TEXTO_IMAGEM_ILEGIVEL);

/**
 * A IMAGEM DO CANVA DE UM SLIDE: prepara o JPEG, confere o 4:5 (achado 76) e o formato antes de pedir
 * a assinatura, sobe direto ao bucket, e guarda. Cada saída é um aviso, e nenhuma é muda.
 */
export async function enviarImagemDoSlide(p: {
  carrosselId: string;
  numero: number;
  arquivo: Blob;
  assinar: Assinar;
  guardar: Guardar;
}): Promise<AvisoDaImagem> {
  let pronta: ImagemPronta;
  try {
    pronta = await prepararImagem(p.arquivo);
  } catch {
    return erro(TEXTO_IMAGEM_ILEGIVEL);
  }
  if (pronta.jpeg.type !== "image/jpeg") return erro(TEXTO_FORMATO_DA_IMAGEM);
  const proporcao = problemaDaProporcaoDoSlide(pronta.largura, pronta.altura);
  if (proporcao) return erro(textoDaProporcao(proporcao));
  const assinatura = await p.assinar({
    id: p.carrosselId,
    numero: p.numero,
    destino: "slide",
    arquivo: { nome: `slide-${p.numero}.jpg`, mime: "image/jpeg", bytes: pronta.jpeg.size, largura: pronta.largura, altura: pronta.altura },
  });
  if (!assinatura.ok) return erro(assinatura.texto);
  try {
    await subirParaOBucket(assinatura.url, pronta.jpeg);
  } catch (e) {
    return erro(mensagem(e));
  }
  return p.guardar({ id: p.carrosselId, numero: p.numero, caminho: assinatura.caminho });
}

/**
 * AS ARTES "SÓ TEXTO", NA HORA DE PUBLICAR: baixa a arte de cada uma pela rota da Etapa 3 (mesma
 * origem, com a sessão), converte o PNG em JPEG, assina no destino da fila e sobe. A versão que vai
 * junto é a do texto que a página mostrou: se o texto mudou depois, o servidor recusa.
 */
export async function prepararArtesSoTexto(p: {
  bonusId: string;
  carrosselId: string;
  soTexto: number[];
  versoesDaMiniatura: string[];
  versoesDoTexto: string[];
  assinar: Assinar;
}): Promise<{ ok: true; artes: { numero: number; caminho: string; versao: string }[] } | { ok: false; texto: string }> {
  const artes: { numero: number; caminho: string; versao: string }[] = [];
  for (const numero of p.soTexto) {
    let pronta: ImagemPronta;
    try {
      const r = await fetch(urlDaArte(p.bonusId, p.carrosselId, numero, p.versoesDaMiniatura[numero - 1] ?? ""), { cache: "no-store" });
      if (!r.ok) return { ok: false, texto: textoDaArteQueNaoVeio(numero) };
      pronta = await prepararImagem(await r.blob());
    } catch {
      return { ok: false, texto: textoDaArteQueNaoVeio(numero) };
    }
    // O que não virou JPEG não sobe: a assinatura declara JPEG, e o servidor não vê os bytes.
    if (pronta.jpeg.type !== "image/jpeg") return { ok: false, texto: textoDaArteQueNaoVeio(numero) };
    const assinatura = await p.assinar({
      id: p.carrosselId,
      numero,
      destino: "fila",
      arquivo: { nome: `slide-${numero}.jpg`, mime: "image/jpeg", bytes: pronta.jpeg.size, largura: pronta.largura, altura: pronta.altura },
    });
    if (!assinatura.ok) return { ok: false, texto: assinatura.texto };
    try {
      await subirParaOBucket(assinatura.url, pronta.jpeg);
    } catch (e) {
      return { ok: false, texto: mensagem(e) };
    }
    artes.push({ numero, caminho: assinatura.caminho, versao: p.versoesDoTexto[numero - 1] ?? "" });
  }
  return { ok: true, artes };
}
```

Em `lib/bonus/publicar-textos.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/publicar-textos.ts b/lib/bonus/publicar-textos.ts
index 836268d..6e0305c 100644
--- a/lib/bonus/publicar-textos.ts
+++ b/lib/bonus/publicar-textos.ts
@@ -65,6 +65,14 @@ export const TEXTO_CONTA_DESCONECTADA_PARA_PUBLICAR = "A conta deste carrossel f
 export const TEXTO_TEXTO_MUDOU = "O texto mudou depois desta imagem.";
 export const TEXTO_IMAGEM_GUARDADA = "Imagem guardada.";
 
+// O que o navegador recusa antes de subir (app/bonus/[id]/carrossel/[cid]/imagem-no-navegador.ts).
+export const TEXTO_IMAGEM_ILEGIVEL = "Não consegui abrir esta imagem. Exporte de novo do Canva, em JPEG ou PNG.";
+export const TEXTO_FORMATO_DA_IMAGEM = "Envie a imagem do Canva em JPEG, PNG ou WEBP.";
+
+export function textoDaArteQueNaoVeio(numero: number): string {
+  return `Não consegui preparar a arte do slide ${numero}. Recarregue a página e publique de novo.`;
+}
+
 export function textoDaFalta(f: FaltaParaPublicar): string {
   switch (f.tipo) {
     case "sem_conta":
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx vitest run --config vitest.dom.config.ts testes-dom/bonus-publicar-imagem.dom.tsx
```

Esperado: `tsc` limpo e 13 casos passam.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" "app/bonus/[id]/carrossel/[cid]/imagem-no-navegador.ts" lib/bonus/publicar-textos.ts testes-dom/bonus-publicar-imagem.dom.tsx
test "$(git branch --show-current)" = "publicar-do-carrossel"
git add "app/bonus/[id]/carrossel/[cid]/imagem-no-navegador.ts" lib/bonus/publicar-textos.ts testes-dom/bonus-publicar-imagem.dom.tsx
git commit -m "feat(bonus): a imagem no navegador, com o JPEG, o 4:5 e as artes só texto"
```

---

### FASE 5.8 — A imagem do Canva no card de cada slide, e a página travada

**Arquivos:**
- Criar: `app/bonus/[id]/carrossel/[cid]/publicacao-na-tela.ts`
- Modificar: `.../card-da-parte.tsx`, `.../editor-do-carrossel.tsx`, `lib/bonus/carrossel-textos.ts`,
  `app/bonus/carrossel-actions.ts`
- Testar: `testes-dom/bonus-imagem-no-card.dom.tsx`

**Interfaces:**
- Consome: `enviarImagemDoSlide` (FASE 5.7); `versaoDoTextoDoSlide` (FASE 5.1); `TEXTO_TEXTO_MUDOU`.
- Produz, de `publicacao-na-tela.ts`: `type ImagemNaTela = { url: string | null; versao }` e `type
  PublicacaoNaTela` (as três actions, `imagens`, `versoesDoTexto`, `travado`, `origem`, `arroba`,
  `estado: { texto; tom; filaId; livre }`, `avisoDoCalendario`).
- Muda: `EditorDoCarrossel` ganha a propriedade opcional `publicacao?: PublicacaoNaTela` (sem ela, a
  página é a da Etapa 4); `CardDaParte` ganha `imagem`, `versaoDoTexto`, `enviarImagem` e `travado`,
  todas opcionais; `AvisoDoSlide` ganha `versaoDoTexto?`, e `salvarSlideDoCarrossel` a devolve.

- [ ] **Passo 1: o teste**

Crie `testes-dom/bonus-imagem-no-card.dom.tsx`:

```tsx
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EditorDoCarrossel from "@/app/bonus/[id]/carrossel/[cid]/editor-do-carrossel";
import type { PublicacaoNaTela } from "@/app/bonus/[id]/carrossel/[cid]/publicacao-na-tela";
import { urlDaArte } from "@/lib/bonus/arte-tela";
import { camposDoFormulario } from "@/lib/bonus/carrossel-texto";
import type { AvisoDoSlide } from "@/lib/bonus/carrossel-textos";
import type { AvisoDaImagem, RespostaDaAssinatura } from "@/lib/bonus/publicar-textos";

// A IMAGEM DO CANVA NO CARD DE CADA SLIDE (spec da Etapa 5, "A página"): subir, trocar, a miniatura
// passando a ser a imagem guardada, o aviso do texto que mudou, e a página travada quando o carrossel
// está na fila. As actions são falsas; o `createImageBitmap` e o `fetch` também (o jsdom não tem o
// primeiro, e o segundo sairia para a rede).

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const BONUS = "0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f";
const CARROSSEL = "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d";
const VALORES = {
  gancho: "Seu cliente sumiu? Não é culpa dele.",
  slide_1_titulo: "O que fazer primeiro",
  slide_1_texto: "Mande uma mensagem curta, lembrando do que ele comprou.",
  chamada: "Comente SUMIDO e receba as mensagens prontas.",
  legenda: "Quem sumiu ainda pode voltar. Comente SUMIDO que eu te mando as mensagens prontas.",
};
const IMAGEM = "https://bucket/public/178/bonus/guardada.jpg";

let medidas: { width: number; height: number };
let puts: string[];

beforeEach(() => {
  medidas = { width: 1080, height: 1350 };
  puts = [];
  vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: medidas.width, height: medidas.height, close: () => {} })));
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
  publicacao = {} as Partial<PublicacaoNaTela>,
  slide = [] as AvisoDoSlide[],
  guardar = [] as AvisoDaImagem[],
  soTexto = [1] as number[],
} = {}) {
  const recebidos = { assinar: [] as unknown[], guardar: [] as unknown[] };
  const completa: PublicacaoNaTela = {
    acaoDaAssinatura: async (p: unknown): Promise<RespostaDaAssinatura> => {
      recebidos.assinar.push(p);
      return { ok: true, caminho: "178/bonus/nova.jpg", url: "https://bucket/sign/178/bonus/nova.jpg?token=t" };
    },
    acaoDaImagem: async (p: unknown) => {
      recebidos.guardar.push(p);
      return guardar.shift() ?? { tom: "ok", texto: "Imagem guardada.", em: 1, versao: "t2", imagem: "https://bucket/public/178/bonus/nova.jpg" };
    },
    acaoDaPublicacao: async () => ({ tom: "ok", texto: "Na fila.", em: 1 }),
    imagens: {},
    versoesDoTexto: ["t1", "t2", "t3"],
    travado: null,
    origem: "gravada",
    arroba: "thiagovannuchi",
    estado: { texto: null, tom: null, filaId: null, livre: true },
    avisoDoCalendario: null,
    ...publicacao,
  };
  render(
    <EditorDoCarrossel
      acaoDoSlide={async () => slide.shift() ?? null}
      acaoDaArte={async () => null}
      acaoDaConta={async () => null}
      bonusId={BONUS}
      carrosselId={CARROSSEL}
      palavra="SUMIDO"
      total={3}
      campos={camposDoFormulario(3)}
      valores={VALORES}
      rotuloDaConta="Thiago Vannuchi (@thiagovannuchi)"
      avisoDaConta={null}
      podeFixar={false}
      soTextoInicial={soTexto}
      versoes={["a1", "b1", "c1"]}
      pausaMs={0}
      publicacao={completa}
    />
  );
  return recebidos;
}

const card = (n: number) => screen.getAllByRole("listitem")[n - 1];
const miniatura = (n: number) => screen.getByAltText(`Slide ${n} de 3`) as HTMLImageElement;
const subir = (n: number) => screen.getByLabelText(`Slide ${n}: imagem do Canva`) as HTMLInputElement;
const arquivo = () => new File(["x"], "slide.jpg", { type: "image/jpeg" });

describe("a imagem do Canva no card", () => {
  it("o slide com espaço pede a imagem; o com imagem a mostra; o só texto não tem upload", () => {
    renderizar({ publicacao: { imagens: { 3: { url: IMAGEM, versao: "t3" } } } });
    expect(within(card(2)).getByText("Subir imagem do Canva")).toBeTruthy();
    expect(within(card(3)).getByText("Trocar imagem")).toBeTruthy();
    expect(miniatura(3).getAttribute("src")).toBe(IMAGEM);
    expect(miniatura(2).getAttribute("src")).toBe(urlDaArte(BONUS, CARROSSEL, 2, "b1"));
    expect(screen.queryByLabelText("Slide 1: imagem do Canva")).toBeNull();
    expect(miniatura(1).getAttribute("src")).toBe(urlDaArte(BONUS, CARROSSEL, 1, "a1"));
  });

  it("subir: assina com as medidas, sobe pelo PUT, guarda, e a miniatura passa a ser a imagem guardada", async () => {
    const recebidos = renderizar();
    await act(async () => {
      fireEvent.change(subir(2), { target: { files: [arquivo()] } });
    });
    expect(recebidos.assinar).toEqual([
      { id: CARROSSEL, numero: 2, destino: "slide", arquivo: { nome: "slide-2.jpg", mime: "image/jpeg", bytes: 1, largura: 1080, altura: 1350 } },
    ]);
    expect(puts).toEqual(["https://bucket/sign/178/bonus/nova.jpg?token=t"]);
    expect(recebidos.guardar).toEqual([{ id: CARROSSEL, numero: 2, caminho: "178/bonus/nova.jpg" }]);
    expect(miniatura(2).getAttribute("src")).toBe("https://bucket/public/178/bonus/nova.jpg");
    expect(within(card(2)).getByText("Imagem guardada.")).toBeTruthy();
    expect(within(card(2)).getByText("Trocar imagem")).toBeTruthy();
  });

  it("a imagem que não é 4:5 é recusada no card, sem pedir assinatura", async () => {
    medidas = { width: 1080, height: 1080 };
    const recebidos = renderizar();
    await act(async () => {
      fireEvent.change(subir(2), { target: { files: [arquivo()] } });
    });
    expect(recebidos.assinar).toEqual([]);
    expect(within(card(2)).getByText("A imagem do slide tem de ser 4:5, como a arte (1080×1350).")).toBeTruthy();
    expect(miniatura(2).getAttribute("src")).toBe(urlDaArte(BONUS, CARROSSEL, 2, "b1"));
  });

  it("o texto que mudou depois da imagem tem aviso, e ele some com a imagem nova", async () => {
    renderizar({ publicacao: { imagens: { 2: { url: IMAGEM, versao: "velha" } } } });
    expect(within(card(2)).getByText("O texto mudou depois desta imagem.")).toBeTruthy();
    await act(async () => {
      fireEvent.change(subir(2), { target: { files: [arquivo()] } });
    });
    expect(within(card(2)).queryByText("O texto mudou depois desta imagem.")).toBeNull();
  });

  it("salvar o texto de um slide com imagem traz a versão nova do texto, e o aviso aparece", async () => {
    renderizar({
      publicacao: { imagens: { 2: { url: IMAGEM, versao: "t2" } } },
      slide: [{ tom: "ok", texto: "Slide 2 salvo.", em: 2, versao: "b2", versaoDoTexto: "t2-novo" }],
    });
    expect(within(card(2)).queryByText("O texto mudou depois desta imagem.")).toBeNull();
    fireEvent.click(within(card(2)).getByRole("button", { name: "Editar" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Salvar slide 2" }));
    });
    expect(within(card(2)).getByText("O texto mudou depois desta imagem.")).toBeTruthy();
  });

  it("marcado só texto, o slide sai com a arte do Chat: sem upload e sem a imagem guardada", () => {
    renderizar({ publicacao: { imagens: { 2: { url: IMAGEM, versao: "t2" } } }, soTexto: [2] });
    expect(screen.queryByLabelText("Slide 2: imagem do Canva")).toBeNull();
    expect(miniatura(2).getAttribute("src")).toBe(urlDaArte(BONUS, CARROSSEL, 2, "b1"));
  });
});

describe("a página travada", () => {
  it("com o carrossel na fila: o aviso no topo, sem Editar, sem upload, e o só texto desligado", () => {
    renderizar({ publicacao: { travado: "Agendado: para mudar, cancele no calendário." } });
    expect(screen.getByText("Agendado: para mudar, cancele no calendário.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Editar" })).toBeNull();
    expect(screen.queryByLabelText("Slide 2: imagem do Canva")).toBeNull();
    expect((screen.getByLabelText("Slide 2: só texto, sem o espaço da imagem") as HTMLInputElement).disabled).toBe(true);
  });
});
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run --config vitest.dom.config.ts testes-dom/bonus-imagem-no-card.dom.tsx
```

Esperado: 6 caem e 1 passa (7): o editor ainda não tem a propriedade `publicacao`.

- [ ] **Passo 3: o código**

Crie `app/bonus/[id]/carrossel/[cid]/publicacao-na-tela.ts`:

```ts
import type { OrigemDaConta } from "@/lib/bonus/arte-conta";
import type { AvisoDaImagem, AvisoDaPublicacao, RespostaDaAssinatura } from "@/lib/bonus/publicar-textos";
import type { TomDoQuadro } from "@/lib/bonus/textos";

// O QUE A PÁGINA ENTREGA AO EDITOR PARA PUBLICAR (spec da Etapa 5). Tudo decidido no servidor
// (page.tsx): a tela só desenha. As actions entram por aqui para o teste de tela usar falsas.

/** A imagem do Canva guardada num slide: o endereço público, para a miniatura, e a versão do texto. */
export type ImagemNaTela = { url: string | null; versao: string };

export type PublicacaoNaTela = {
  acaoDaAssinatura: (pedido: unknown) => Promise<RespostaDaAssinatura>;
  acaoDaImagem: (pedido: unknown) => Promise<AvisoDaImagem>;
  acaoDaPublicacao: (pedido: unknown) => Promise<AvisoDaPublicacao>;
  imagens: Record<number, ImagemNaTela>;
  /** A versão do texto salvo de cada slide (`versaoDoTextoDoSlide`), na ordem. */
  versoesDoTexto: string[];
  /** A frase da trava, quando o carrossel está na fila ou publicado; `null` quando está livre. */
  travado: string | null;
  origem: OrigemDaConta;
  arroba: string | null;
  estado: { texto: string | null; tom: TomDoQuadro | null; filaId: string | null; livre: boolean };
  /** "Para ver no calendário, selecione … no menu", quando a conta do menu é outra. */
  avisoDoCalendario: string | null;
};
```

Em `app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx b/app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx
index 9db048e..4a301b8 100644
--- a/app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx
+++ b/app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx
@@ -1,12 +1,14 @@
 "use client";
-import { useActionState, useMemo, useState } from "react";
+import { useActionState, useMemo, useState, useTransition, type ChangeEvent } from "react";
 import { badgeWarn, btnPrimary, btnSecondary, card, hint } from "@/app/ui";
 import AvisoDoFormulario from "@/app/bonus/aviso-do-formulario";
 import { avisosDeCabimento, campoDoAviso } from "@/lib/bonus/arte-cabimento";
 import { urlDaArte } from "@/lib/bonus/arte-tela";
 import type { CampoDoCarrossel, ParteDoCarrossel } from "@/lib/bonus/carrossel-texto";
 import type { AvisoDoSlide } from "@/lib/bonus/carrossel-textos";
+import { TEXTO_TEXTO_MUDOU, type AvisoDaImagem } from "@/lib/bonus/publicar-textos";
 import Campo from "./campo";
+import type { ImagemNaTela } from "./publicacao-na-tela";
 
 // O CARD DE UMA PARTE DO CARROSSEL (spec da Etapa 4, "Um card por slide"): a miniatura do slide, o
 // "Só texto" e o "Baixar" à esquerda, e ao lado o editor daquele slide, que abre no "Editar" e grava
@@ -23,6 +25,12 @@ import Campo from "./campo";
 //
 // A versão da miniatura e o "só texto" moram no pai (editor-do-carrossel.tsx): o "só texto" se grava
 // por outra action, que devolve as versões, e o "Baixar todos" precisa das versões de todos.
+//
+// A IMAGEM DO CANVA (spec da Etapa 5): no slide com espaço, o "Subir imagem do Canva" (ou "Trocar
+// imagem"), e a miniatura passa a ser a imagem guardada. O "Baixar" continua baixando a arte do Chat,
+// para levar ao Canva. Com o texto salvo depois da imagem, o card avisa. Com o carrossel na fila ou
+// publicado (`travado`), o card fica só para leitura: sem "Editar", sem upload, e o "Só texto"
+// desligado. A trava vale no servidor; aqui ela só se mostra.
 export default function CardDaParte({
   acao,
   bonusId,
@@ -37,6 +45,10 @@ export default function CardDaParte({
   soTexto,
   aoMudarSoTexto,
   soTextoPendente,
+  imagem = null,
+  versaoDoTexto = null,
+  enviarImagem = null,
+  travado = null,
 }: {
   acao: (anterior: AvisoDoSlide | null, form: FormData) => Promise<AvisoDoSlide | null>;
   bonusId: string;
@@ -52,19 +64,31 @@ export default function CardDaParte({
   soTexto: boolean;
   aoMudarSoTexto: (marcado: boolean) => void;
   soTextoPendente: boolean;
+  /** A imagem do Canva guardada neste slide (Etapa 5). */
+  imagem?: ImagemNaTela | null;
+  /** A versão do texto salvo deste slide, para o aviso "o texto mudou depois desta imagem". */
+  versaoDoTexto?: string | null;
+  /** Sobe a imagem do Canva deste slide. Sem ela, o card não tem upload. */
+  enviarImagem?: ((arquivo: File) => Promise<AvisoDaImagem>) | null;
+  /** A frase da trava, com o carrossel na fila ou publicado. */
+  travado?: string | null;
 }) {
   const doCard = (v: Record<string, string>) => Object.fromEntries(campos.map((c) => [c.nome, v[c.nome] ?? ""]));
   const [atuais, setAtuais] = useState(() => doCard(valores));
   const [salvos, setSalvos] = useState(() => doCard(valores));
   const [aberto, setAberto] = useState(false);
+  const [versaoDoTextoSalvo, setVersaoDoTextoSalvo] = useState(versaoDoTexto);
   const [resposta, enviar, pendente] = useActionState(async (anterior: AvisoDoSlide | null, form: FormData) => {
     const r = await acao(anterior, form);
     if (r?.tom === "ok") {
       setSalvos(Object.fromEntries(campos.map((c) => [c.nome, String(form.get(c.nome) ?? "")])));
       if (r.versao) aoNovaVersao(r.versao);
+      if (r.versaoDoTexto) setVersaoDoTextoSalvo(r.versaoDoTexto);
     }
     return r;
   }, null);
+  const [avisoDaImagem, setAvisoDaImagem] = useState<AvisoDaImagem | null>(null);
+  const [enviando, iniciarEnvio] = useTransition();
 
   const numero = parte.tipo === "slide" ? parte.numero : null;
   const naoSalvo = campos.some((c) => atuais[c.nome] !== salvos[c.nome]);
@@ -73,6 +97,18 @@ export default function CardDaParte({
     () => (numero && campoDoNaoCabe ? avisosDeCabimento(total, atuais, soTexto ? [numero] : [])[campoDoNaoCabe] : undefined),
     [numero, campoDoNaoCabe, total, atuais, soTexto]
   );
+  // Marcado "Só texto", o slide sai com a arte do Chat: a imagem guardada fica, mas não se usa.
+  const comImagem = numero !== null && !soTexto ? imagem : null;
+  const desatualizada = comImagem !== null && versaoDoTextoSalvo !== null && comImagem.versao !== versaoDoTextoSalvo;
+
+  function aoEscolherImagem(e: ChangeEvent<HTMLInputElement>) {
+    const arquivo = e.target.files?.[0];
+    e.target.value = "";
+    if (!arquivo || !enviarImagem) return;
+    iniciarEnvio(async () => {
+      setAvisoDaImagem(await enviarImagem(arquivo));
+    });
+  }
 
   return (
     <li className={`${card} p-4`}>
@@ -82,7 +118,7 @@ export default function CardDaParte({
             {/* eslint-disable-next-line @next/next/no-img-element -- a arte está atrás de sessão, e o
                 otimizador de imagem do Next buscaria a URL sem o cookie: a miniatura voltaria 401. */}
             <img
-              src={urlDaArte(bonusId, carrosselId, numero, versao)}
+              src={comImagem?.url ?? urlDaArte(bonusId, carrosselId, numero, versao)}
               alt={`Slide ${numero} de ${total}`}
               width={216}
               height={270}
@@ -93,12 +129,36 @@ export default function CardDaParte({
                 type="checkbox"
                 aria-label={`Slide ${numero}: só texto, sem o espaço da imagem`}
                 checked={soTexto}
-                disabled={soTextoPendente}
+                disabled={soTextoPendente || travado !== null}
                 onChange={(e) => aoMudarSoTexto(e.target.checked)}
               />
               Só texto
             </label>
             {naoCabe && <p className="text-xs font-medium text-fecha dark:text-fecha-escuro">{naoCabe}</p>}
+            {enviarImagem && !soTexto && travado === null && (
+              <label className={`${btnSecondary} cursor-pointer`}>
+                {enviando ? "Subindo…" : imagem ? "Trocar imagem" : "Subir imagem do Canva"}
+                <input
+                  type="file"
+                  accept="image/jpeg,image/png,image/webp"
+                  aria-label={`Slide ${numero}: imagem do Canva`}
+                  className="sr-only"
+                  disabled={enviando}
+                  onChange={aoEscolherImagem}
+                />
+              </label>
+            )}
+            {desatualizada && <p className="text-xs font-medium text-fecha dark:text-fecha-escuro">{TEXTO_TEXTO_MUDOU}</p>}
+            {avisoDaImagem && (
+              <p
+                role="status"
+                className={`text-xs font-medium ${
+                  avisoDaImagem.tom === "ok" ? "text-aberto dark:text-aberto-escuro" : "text-parou dark:text-parou-escuro"
+                }`}
+              >
+                {avisoDaImagem.texto}
+              </p>
+            )}
             <a href={urlDaArte(bonusId, carrosselId, numero, versao, true)} download className={btnSecondary}>
               Baixar o slide {numero}
             </a>
@@ -118,9 +178,11 @@ export default function CardDaParte({
             <h3 className="text-sm font-semibold">{numero !== null ? `Slide ${numero}` : "Legenda"}</h3>
             <div className="flex items-center gap-2">
               {naoSalvo && <span className={badgeWarn}>não salvo</span>}
-              <button type="button" aria-expanded={aberto} onClick={() => setAberto(!aberto)} className={btnSecondary}>
-                {aberto ? "Fechar" : "Editar"}
-              </button>
+              {travado === null && (
+                <button type="button" aria-expanded={aberto} onClick={() => setAberto(!aberto)} className={btnSecondary}>
+                  {aberto ? "Fechar" : "Editar"}
+                </button>
+              )}
             </div>
           </div>
           {!aberto && <p className={`${hint} whitespace-pre-line`}>{campos.map((c) => atuais[c.nome]).join("\n")}</p>}
```

Em `app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx b/app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx
index 2546bee..ffd2f23 100644
--- a/app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx
+++ b/app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx
@@ -1,11 +1,14 @@
 "use client";
 import { useActionState, useRef, useState, useTransition } from "react";
-import { alertError, alertOk, btnPrimary, btnSecondary, card, hint } from "@/app/ui";
+import { alertError, alertOk, alertWarn, btnPrimary, btnSecondary, card, hint } from "@/app/ui";
 import { urlDaArte } from "@/lib/bonus/arte-tela";
 import { textoDoBaixarTodos, type AvisoDaArte } from "@/lib/bonus/arte-textos";
 import { camposDaParte, type CampoDoCarrossel, type ParteDoCarrossel } from "@/lib/bonus/carrossel-texto";
 import type { AvisoDoSlide } from "@/lib/bonus/carrossel-textos";
+import type { AvisoDaImagem } from "@/lib/bonus/publicar-textos";
 import CardDaParte from "./card-da-parte";
+import { enviarImagemDoSlide } from "./imagem-no-navegador";
+import type { ImagemNaTela, PublicacaoNaTela } from "./publicacao-na-tela";
 
 // O EDITOR DO CARROSSEL, SLIDE A SLIDE (spec da Etapa 4, "A página"): a conta do carrossel, um card
 // por slide (a miniatura e, ao lado, o editor dele: card-da-parte.tsx), o card da legenda, e o
@@ -21,6 +24,10 @@ import CardDaParte from "./card-da-parte";
 // última aceita (achado 67), porque a miniatura e o "Baixar" seguem o que está gravado. O formulário é
 // montado aqui e despachado numa transição, sem `<form action>` (medido no PR #5).
 //
+// A PUBLICAÇÃO (spec da Etapa 5) entra por `publicacao`, e sem ela a página é a da Etapa 4. As imagens
+// do Canva guardadas moram aqui, e cada card sobe a do seu slide (imagem-no-navegador.ts). Com o
+// carrossel na fila ou publicado, a trava aparece no topo e cada card fica só para leitura.
+//
 // As actions entram por propriedade, para o teste de tela usar falsas.
 export default function EditorDoCarrossel({
   acaoDoSlide,
@@ -38,6 +45,7 @@ export default function EditorDoCarrossel({
   soTextoInicial,
   versoes: versoesIniciais,
   pausaMs = 400,
+  publicacao,
 }: {
   acaoDoSlide: (anterior: AvisoDoSlide | null, form: FormData) => Promise<AvisoDoSlide | null>;
   acaoDaArte: (anterior: AvisoDaArte | null, form: FormData) => Promise<AvisoDaArte | null>;
@@ -54,8 +62,11 @@ export default function EditorDoCarrossel({
   soTextoInicial: number[];
   versoes: string[];
   pausaMs?: number;
+  publicacao?: PublicacaoNaTela;
 }) {
   const [versoes, setVersoes] = useState(versoesIniciais);
+  const [imagens, setImagens] = useState<Record<number, ImagemNaTela>>(publicacao?.imagens ?? {});
+  const travado = publicacao?.travado ?? null;
   const [soTexto, setSoTexto] = useState(soTextoInicial);
   const aceito = useRef(soTextoInicial);
   const [respostaDaArte, despacharArte, artePendente] = useActionState(
@@ -91,6 +102,14 @@ export default function EditorDoCarrossel({
     iniciar(() => despacharArte(form));
   }
 
+  /** Sobe a imagem do Canva de um slide; guardada, ela passa a ser a miniatura dele. */
+  async function enviarImagem(p: PublicacaoNaTela, numero: number, arquivo: File): Promise<AvisoDaImagem> {
+    const r = await enviarImagemDoSlide({ carrosselId, numero, arquivo, assinar: p.acaoDaAssinatura, guardar: p.acaoDaImagem });
+    const versao = r.versao;
+    if (r.tom === "ok" && versao) setImagens((atuais) => ({ ...atuais, [numero]: { url: r.imagem ?? null, versao } }));
+    return r;
+  }
+
   async function baixarTodos() {
     setBaixando(true);
     for (const n of slides) {
@@ -108,6 +127,11 @@ export default function EditorDoCarrossel({
   return (
     <section className={`${card} space-y-4 p-6`}>
       <h2 className="text-base font-semibold">Arte e texto dos slides</h2>
+      {travado && (
+        <p role="status" className={alertWarn}>
+          {travado}
+        </p>
+      )}
       <div>
         <p className="text-sm">
           Conta do carrossel: <strong>{rotuloDaConta ?? "nenhuma conta conectada"}</strong>
@@ -154,6 +178,10 @@ export default function EditorDoCarrossel({
             soTexto={soTexto.includes(n)}
             aoMudarSoTexto={(marcado) => mudarSoTexto(n, marcado)}
             soTextoPendente={artePendente}
+            imagem={imagens[n] ?? null}
+            versaoDoTexto={publicacao?.versoesDoTexto[n - 1] ?? null}
+            enviarImagem={publicacao ? (arquivo) => enviarImagem(publicacao, n, arquivo) : null}
+            travado={travado}
           />
         ))}
         <CardDaParte
@@ -170,6 +198,7 @@ export default function EditorDoCarrossel({
           soTexto={false}
           aoMudarSoTexto={() => {}}
           soTextoPendente={false}
+          travado={travado}
         />
       </ul>
 
```

Em `lib/bonus/carrossel-textos.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/carrossel-textos.ts b/lib/bonus/carrossel-textos.ts
index 92b900c..e7f3f30 100644
--- a/lib/bonus/carrossel-textos.ts
+++ b/lib/bonus/carrossel-textos.ts
@@ -14,8 +14,10 @@ export type AvisoDoPedidoDeCarrossel = Aviso & { em: number };
  * A resposta do "Salvar slide N" e do "Salvar legenda" (spec da Etapa 4), como estado do card do
  * slide, e nunca por redirect (achado 52). `versao` é a versão nova da miniatura do slide salvo, e só
  * ela é pedida de novo; é null para a legenda e na recusa, quando a miniatura não muda.
+ * `versaoDoTexto` (Etapa 5) é a versão do texto salvo do slide, para o aviso "o texto mudou depois
+ * desta imagem" (publicar-regras.ts, `versaoDoTextoDoSlide`).
  */
-export type AvisoDoSlide = Aviso & { em: number; versao: string | null };
+export type AvisoDoSlide = Aviso & { em: number; versao: string | null; versaoDoTexto?: string | null };
 
 export const TEXTO_PARTE_INVALIDA = "Essa parte não existe neste carrossel. Recarregue a página.";
 
```

Em `app/bonus/carrossel-actions.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/carrossel-actions.ts b/app/bonus/carrossel-actions.ts
index cbc5ebf..c82c686 100644
--- a/app/bonus/carrossel-actions.ts
+++ b/app/bonus/carrossel-actions.ts
@@ -53,6 +53,7 @@ import {
 import { temChaveDaIA } from "@/lib/bonus/config";
 import { ehIdDeBonus } from "@/lib/bonus/pedido";
 import { situacaoNoLabs } from "@/lib/bonus/publicado";
+import { versaoDoTextoDoSlide } from "@/lib/bonus/publicar-regras";
 import { textoDaTrava } from "@/lib/bonus/publicar-textos";
 import { lerLinha } from "@/lib/bonus/repositorio";
 import { geracaoNaTela } from "@/lib/bonus/tempos";
@@ -209,8 +210,11 @@ export async function salvarSlideDoCarrossel(_anterior: AvisoDoSlide | null, for
   const texto = textoDaParteSalva(parte, total, r.avisos);
   if (parte.tipo === "legenda") return resposta("ok", texto);
   const { conta } = resolverConta(contas, escolhas, await contaDoCookie());
-  const versoes = versoesDosSlides(slidesDoTexto(r.texto), escolhas.soTexto, cabecalhoParaVersao(conta));
-  return resposta("ok", texto, versoes[parte.numero - 1] ?? null);
+  const slides = slidesDoTexto(r.texto);
+  const versoes = versoesDosSlides(slides, escolhas.soTexto, cabecalhoParaVersao(conta));
+  // A versão do texto salvo vai junto (Etapa 5): o card compara com a da imagem do Canva guardada.
+  const doSlide = slides[parte.numero - 1];
+  return { ...resposta("ok", texto, versoes[parte.numero - 1] ?? null), versaoDoTexto: doSlide ? versaoDoTextoDoSlide(doSlide) : null };
 }
 
 /**
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx vitest run --config vitest.dom.config.ts testes-dom/bonus-imagem-no-card.dom.tsx testes-dom/bonus-editor-do-carrossel.dom.tsx testes-dom/bonus-card-da-parte.dom.tsx
```

Esperado: `tsc` limpo e 25 casos passam (os 7 novos e os 18 da Etapa 4, nos dois arquivos dela).

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" "app/bonus/[id]/carrossel/[cid]/publicacao-na-tela.ts" "app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx" "app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx" lib/bonus/carrossel-textos.ts app/bonus/carrossel-actions.ts testes-dom/bonus-imagem-no-card.dom.tsx
test "$(git branch --show-current)" = "publicar-do-carrossel"
git add "app/bonus/[id]/carrossel/[cid]/publicacao-na-tela.ts" "app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx" "app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx" lib/bonus/carrossel-textos.ts app/bonus/carrossel-actions.ts testes-dom/bonus-imagem-no-card.dom.tsx
git commit -m "feat(bonus): a imagem do Canva no card de cada slide, com o aviso do texto que mudou e a página travada"
```

---

### FASE 5.9 — O card "Publicar" e a página com a publicação

**Arquivos:**
- Criar: `app/bonus/[id]/carrossel/[cid]/card-publicar.tsx`
- Modificar: `.../card-da-parte.tsx`, `.../editor-do-carrossel.tsx`, `.../imagem-no-navegador.ts`,
  `.../page.tsx`, `lib/bonus/publicar-textos.ts`, `lib/bonus/publicar-estado.ts`
- Testar: `testes-dom/bonus-card-publicar.dom.tsx`, `testes-dom/bonus-publicar-imagem.dom.tsx`,
  `tests/bonus-publicar-estado.test.ts`, `tests/bonus-publicar-paginas.test.ts`

**Interfaces:**
- Consome: as actions (FASE 5.6); `PublicacaoNaTela` (FASE 5.8); `faltasParaPublicar`,
  `estadoDoCarrossel`, `publicacaoLivre`, as frases.
- Produz: `CardPublicar` (`card-publicar.tsx`); `publicarDaTela({ ..., quando, dataHora, assinar,
  publicar }): Promise<AvisoDaPublicacao>` (`imagem-no-navegador.ts`);
  `tomDoEstadoDaPublicacao(estado): TomDoQuadro | null` (`publicar-textos.ts`). `faltasParaPublicar`
  passa a aceitar `imagens: Record<number, unknown>`. `CardDaParte` ganha `aoMudarNaoSalvo?`, e o
  editor guarda as partes "não salvas" e desenha o `CardPublicar` no fim.

- [ ] **Passo 1: os testes**

Crie `testes-dom/bonus-card-publicar.dom.tsx`:

```tsx
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CardPublicar from "@/app/bonus/[id]/carrossel/[cid]/card-publicar";
import EditorDoCarrossel from "@/app/bonus/[id]/carrossel/[cid]/editor-do-carrossel";
import type { PublicacaoNaTela } from "@/app/bonus/[id]/carrossel/[cid]/publicacao-na-tela";
import { camposDoFormulario } from "@/lib/bonus/carrossel-texto";
import type { AvisoDaPublicacao } from "@/lib/bonus/publicar-textos";

// O CARD "PUBLICAR" (spec da Etapa 5, "A página"): a conta, o "Agora" ou o "Agendar", o botão travado
// com a frase de cada falta, o estado depois de mandar, e a página recarregada no sucesso. As actions e
// o roteador são falsos.

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const BONUS = "0f8e2a8c-6c1d-4f4e-9a55-1f2b3c4d5e6f";
const CARROSSEL = "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d";
const TODAS = { 1: { url: "u1", versao: "t1" }, 2: { url: "u2", versao: "t2" }, 3: { url: "u3", versao: "t3" } };

beforeEach(() => {
  refresh.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function publicacao(p: Partial<PublicacaoNaTela> = {}, respostas: AvisoDaPublicacao[] = []) {
  const pedidos: unknown[] = [];
  const completa: PublicacaoNaTela = {
    acaoDaAssinatura: async () => ({ ok: false, texto: "não devia assinar" }),
    acaoDaImagem: async () => ({ tom: "erro", texto: "não devia guardar", em: 1 }),
    acaoDaPublicacao: async (pedido: unknown) => {
      pedidos.push(pedido);
      return respostas.shift() ?? { tom: "ok", texto: "Na fila do /publicar.", em: 1 };
    },
    imagens: TODAS,
    versoesDoTexto: ["t1", "t2", "t3"],
    travado: null,
    origem: "gravada",
    arroba: "thiagovannuchi",
    estado: { texto: null, tom: null, filaId: null, livre: true },
    avisoDoCalendario: null,
    ...p,
  };
  return { completa, pedidos };
}

function renderizar(p: Partial<PublicacaoNaTela> = {}, extra: { naoSalvos?: number[]; legenda?: boolean; respostas?: AvisoDaPublicacao[] } = {}) {
  const { completa, pedidos } = publicacao(p, extra.respostas);
  render(
    <CardPublicar
      publicacao={completa}
      bonusId={BONUS}
      carrosselId={CARROSSEL}
      total={3}
      soTexto={[]}
      imagens={completa.imagens}
      versoesDaMiniatura={["a1", "b1", "c1"]}
      slidesNaoSalvos={extra.naoSalvos ?? []}
      legendaNaoSalva={extra.legenda ?? false}
    />
  );
  return pedidos;
}

const botao = () => screen.getByRole("button", { name: "Publicar" }) as HTMLButtonElement;

describe("o card Publicar, com o carrossel livre", () => {
  it("diz a conta, e Agora publica: manda o pedido e recarrega a página", async () => {
    const pedidos = renderizar();
    expect(screen.getByText("@thiagovannuchi")).toBeTruthy();
    expect(botao().disabled).toBe(false);
    await act(async () => {
      fireEvent.click(botao());
    });
    expect(pedidos).toEqual([{ id: CARROSSEL, quando: "agora", dataHora: "", fuso: String(new Date().getTimezoneOffset()), artes: [] }]);
    expect(screen.getByText("Na fila do /publicar.")).toBeTruthy();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("Agendar pede a data e a hora, e manda o depois", async () => {
    const pedidos = renderizar();
    fireEvent.click(screen.getByLabelText("Agendar"));
    expect(botao().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Data e hora"), { target: { value: "2026-10-06T18:00" } });
    await act(async () => {
      fireEvent.click(botao());
    });
    expect(pedidos).toEqual([
      { id: CARROSSEL, quando: "depois", dataHora: "2026-10-06T18:00", fuso: String(new Date().getTimezoneOffset()), artes: [] },
    ]);
  });

  it("a recusa aparece junto do botão, e a página não recarrega", async () => {
    renderizar({}, { respostas: [{ tom: "erro", texto: "O carrossel mudou enquanto a publicação era preparada. Confira e publique de novo.", em: 2 }] });
    await act(async () => {
      fireEvent.click(botao());
    });
    expect(screen.getByText("O carrossel mudou enquanto a publicação era preparada. Confira e publique de novo.")).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("as faltas travam o botão, com a frase de cada uma", () => {
    renderizar({ imagens: { 1: TODAS[1] } }, { naoSalvos: [2], legenda: true });
    expect(botao().disabled).toBe(true);
    expect(screen.getByText("Falta a imagem dos slides 2 e 3.")).toBeTruthy();
    expect(screen.getByText("Salve o slide 2 e a legenda antes de publicar.")).toBeTruthy();
  });

  it("sem conta gravada, ou com ela desconectada, o botão trava com a frase da conta", () => {
    renderizar({ origem: "selecionada" });
    expect(botao().disabled).toBe(true);
    expect(screen.getByText('Este carrossel é de antes de a conta ser gravada. Use "Fixar nesta conta" antes de publicar.')).toBeTruthy();
  });

  it("depois de falhar, mostra o estado e o botão volta", () => {
    renderizar({ estado: { texto: "Não publicou: a Meta recusou. Dá para publicar de novo.", tom: "erro", filaId: "f1", livre: true } });
    expect(screen.getByText("Não publicou: a Meta recusou. Dá para publicar de novo.")).toBeTruthy();
    expect(botao().disabled).toBe(false);
  });
});

describe("o card Publicar, com o carrossel na fila", () => {
  it("agendado: o estado, o post no /publicar e o aviso do calendário, sem o botão", () => {
    renderizar({
      estado: { texto: "Agendado para 06/10/2026, 18:00 (horário de Brasília).", tom: "ok", filaId: "f1", livre: false },
      avisoDoCalendario: "Para ver no calendário, selecione thiagovannuchi no menu.",
    });
    expect(screen.getByText("Agendado para 06/10/2026, 18:00 (horário de Brasília).")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ver no /publicar" }).getAttribute("href")).toBe("/publicar/post/f1");
    expect(screen.getByText("Para ver no calendário, selecione thiagovannuchi no menu.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Publicar" })).toBeNull();
  });
});

describe("o não salvo, pelo editor", () => {
  it("editar um slide sem salvar trava o Publicar, e salvar destrava", async () => {
    const { completa } = publicacao();
    render(
      <EditorDoCarrossel
        acaoDoSlide={async () => ({ tom: "ok", texto: "Slide 2 salvo.", em: 1, versao: "b2", versaoDoTexto: "t2" })}
        acaoDaArte={async () => null}
        acaoDaConta={async () => null}
        bonusId={BONUS}
        carrosselId={CARROSSEL}
        palavra="SUMIDO"
        total={3}
        campos={camposDoFormulario(3)}
        valores={{
          gancho: "Seu cliente sumiu? Não é culpa dele.",
          slide_1_titulo: "O que fazer primeiro",
          slide_1_texto: "Mande uma mensagem curta, lembrando do que ele comprou.",
          chamada: "Comente SUMIDO e receba as mensagens prontas.",
          legenda: "Quem sumiu ainda pode voltar. Comente SUMIDO que eu te mando as mensagens prontas.",
        }}
        rotuloDaConta="Thiago Vannuchi (@thiagovannuchi)"
        avisoDaConta={null}
        podeFixar={false}
        soTextoInicial={[]}
        versoes={["a1", "b1", "c1"]}
        pausaMs={0}
        publicacao={completa}
      />
    );
    expect(botao().disabled).toBe(false);
    const card2 = screen.getAllByRole("listitem")[1];
    fireEvent.click(within(card2).getByRole("button", { name: "Editar" }));
    fireEvent.input(screen.getByLabelText("Slide 2: texto"), { target: { value: "Um texto revisado do slide dois, mais curto." } });
    expect(screen.getByText("Salve o slide 2 antes de publicar.")).toBeTruthy();
    expect(botao().disabled).toBe(true);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Salvar slide 2" }));
    });
    expect(screen.queryByText("Salve o slide 2 antes de publicar.")).toBeNull();
    expect(botao().disabled).toBe(false);
  });
});
```

Em `testes-dom/bonus-publicar-imagem.dom.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-dom/bonus-publicar-imagem.dom.tsx b/testes-dom/bonus-publicar-imagem.dom.tsx
index 056c31d..d4228e3 100644
--- a/testes-dom/bonus-publicar-imagem.dom.tsx
+++ b/testes-dom/bonus-publicar-imagem.dom.tsx
@@ -4,6 +4,7 @@ import {
   enviarImagemDoSlide,
   prepararArtesSoTexto,
   prepararImagem,
+  publicarDaTela,
 } from "@/app/bonus/[id]/carrossel/[cid]/imagem-no-navegador";
 import { urlDaArte } from "@/lib/bonus/arte-tela";
 import type { AvisoDaImagem, RespostaDaAssinatura } from "@/lib/bonus/publicar-textos";
@@ -222,3 +223,39 @@ describe("as artes Só texto, na hora de publicar", () => {
     expect(assinar).not.toHaveBeenCalled();
   });
 });
+
+describe("publicar da tela", () => {
+  const assinar = vi.fn(async (p: unknown): Promise<RespostaDaAssinatura> => {
+    const n = (p as { numero: number }).numero;
+    return { ok: true, caminho: `178/bonus-fila/${n}.jpg`, url: `https://bucket/sign/${n}?token=t` };
+  });
+  const base = {
+    bonusId: BONUS,
+    carrosselId: CARROSSEL,
+    soTexto: [1],
+    versoesDaMiniatura: ["m1", "m2"],
+    versoesDoTexto: ["t1", "t2"],
+    assinar,
+  };
+
+  it("prepara as artes só texto e manda junto, com a hora e o fuso do navegador", async () => {
+    const publicar = vi.fn(async () => ({ tom: "ok" as const, texto: "Na fila do /publicar.", em: 1 }));
+    const r = await publicarDaTela({ ...base, quando: "depois", dataHora: "2026-10-06T18:00", publicar });
+    expect(r).toMatchObject({ tom: "ok" });
+    expect(publicar).toHaveBeenCalledWith({
+      id: CARROSSEL,
+      quando: "depois",
+      dataHora: "2026-10-06T18:00",
+      fuso: String(new Date().getTimezoneOffset()),
+      artes: [{ numero: 1, caminho: "178/bonus-fila/1.jpg", versao: "t1" }],
+    });
+  });
+
+  it("a arte que não vem vira o aviso de erro, e o pedido não sai", async () => {
+    vi.stubGlobal("fetch", vi.fn(async () => new Response("erro", { status: 500 })));
+    const publicar = vi.fn();
+    const r = await publicarDaTela({ ...base, quando: "agora", dataHora: "", publicar });
+    expect(r).toMatchObject({ tom: "erro", texto: "Não consegui preparar a arte do slide 1. Recarregue a página e publique de novo." });
+    expect(publicar).not.toHaveBeenCalled();
+  });
+});
```

Em `tests/bonus-publicar-estado.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-publicar-estado.test.ts b/tests/bonus-publicar-estado.test.ts
index bac1dae..3174cc4 100644
--- a/tests/bonus-publicar-estado.test.ts
+++ b/tests/bonus-publicar-estado.test.ts
@@ -16,6 +16,7 @@ import {
   textoDaTrava,
   textoDoCalendario,
   textoDoEstadoDaPublicacao,
+  tomDoEstadoDaPublicacao,
   type RecusaDaPublicacaoDoCarrossel,
 } from "@/lib/bonus/publicar-textos";
 
@@ -246,3 +247,17 @@ describe("as recusas da publicação têm frase, cada uma", () => {
     expect(textoDaRecusaDaPublicacaoDoCarrossel({ motivo: "faltam_imagens", slides: [2, 4] })).toBe("Falta a imagem dos slides 2 e 4.");
   });
 });
+
+describe("a cor do estado na página", () => {
+  it("verde no agendado e no publicado; amarelo no publicando, cancelado e não entrou; vermelho no resto", () => {
+    expect(tomDoEstadoDaPublicacao({ tipo: "livre" })).toBeNull();
+    expect(tomDoEstadoDaPublicacao({ tipo: "agendado", quando: AGORA, filaId: "f" })).toBe("ok");
+    expect(tomDoEstadoDaPublicacao({ tipo: "publicado", em: AGORA, filaId: "f" })).toBe("ok");
+    expect(tomDoEstadoDaPublicacao({ tipo: "publicando", filaId: null })).toBe("atencao");
+    expect(tomDoEstadoDaPublicacao({ tipo: "cancelado", filaId: "f" })).toBe("atencao");
+    expect(tomDoEstadoDaPublicacao({ tipo: "nao_entrou" })).toBe("atencao");
+    expect(tomDoEstadoDaPublicacao({ tipo: "falhou", motivo: null, filaId: "f" })).toBe("erro");
+    expect(tomDoEstadoDaPublicacao({ tipo: "saiu_da_fila" })).toBe("erro");
+    expect(tomDoEstadoDaPublicacao({ tipo: "desconhecido" })).toBe("erro");
+  });
+});
```

Em `tests/bonus-publicar-paginas.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-publicar-paginas.test.ts b/tests/bonus-publicar-paginas.test.ts
index b8dff82..f0525f0 100644
--- a/tests/bonus-publicar-paginas.test.ts
+++ b/tests/bonus-publicar-paginas.test.ts
@@ -74,3 +74,14 @@ describe("as frases das actions", () => {
     expect(textoDaPublicacaoMandada(true)).toMatch(/^Agendado/);
   });
 });
+
+describe("a página do carrossel entrega a publicação ao editor", () => {
+  it("as três actions da publicação, e o estado lido da fila", () => {
+    const pagina = ler("app/bonus/[id]/carrossel/[cid]/page.tsx");
+    expect(pagina).toContain("acaoDaAssinatura: assinarImagemDoCarrossel");
+    expect(pagina).toContain("acaoDaImagem: guardarImagemDoSlide");
+    expect(pagina).toContain("acaoDaPublicacao: publicarCarrossel");
+    expect(pagina).toContain("await estadoDoCarrossel(carrossel.arte)");
+    expect(pagina).toContain("publicacao={publicacao}");
+  });
+});
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-publicar-estado.test.ts tests/bonus-publicar-paginas.test.ts
npx vitest run --config vitest.dom.config.ts testes-dom/bonus-card-publicar.dom.tsx testes-dom/bonus-publicar-imagem.dom.tsx
```

Esperado: os puros: 2 caem e 36 passam (38). A tela: os dois arquivos caem; o do card Publicar nem carrega (o componente não existe), e no da imagem caem os 2 de `publicarDaTela` e passam 13.

- [ ] **Passo 3: o código**

Crie `app/bonus/[id]/carrossel/[cid]/card-publicar.tsx`:

```tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { alertError, alertOk, alertWarn, btnPrimary, card, hint, input, link } from "@/app/ui";
import { faltasParaPublicar } from "@/lib/bonus/publicar-estado";
import { textoDaFalta, type AvisoDaPublicacao } from "@/lib/bonus/publicar-textos";
import type { TomDoQuadro } from "@/lib/bonus/textos";
import { publicarDaTela } from "./imagem-no-navegador";
import type { ImagemNaTela, PublicacaoNaTela } from "./publicacao-na-tela";

// O CARD "PUBLICAR" (spec da Etapa 5, "A página"), no fim da página do carrossel: a conta em que o
// post vai sair, o "Agora" ou o "Agendar", e o botão, travado com a frase de cada falta (a conta, a
// imagem dos slides com espaço, o "não salvo"). Depois de mandar, o estado lido da fila toma o lugar do
// botão, com o post no /publicar, onde se cancela ou remarca.
//
// NO SUCESSO A PÁGINA RECARREGA (`router.refresh`), ao contrário do salvar da Etapa 4 (achados 52 e
// 54): aqui é seguro, porque o botão só destrava com nenhum card "não salvo", e a página recarregada
// é a que mostra o estado e a trava.
const QUADRO: Record<TomDoQuadro, string> = { ok: alertOk, atencao: alertWarn, erro: alertError };

export default function CardPublicar({
  publicacao,
  bonusId,
  carrosselId,
  total,
  soTexto,
  imagens,
  versoesDaMiniatura,
  slidesNaoSalvos,
  legendaNaoSalva,
}: {
  publicacao: PublicacaoNaTela;
  bonusId: string;
  carrosselId: string;
  total: number;
  soTexto: number[];
  imagens: Record<number, ImagemNaTela>;
  versoesDaMiniatura: string[];
  slidesNaoSalvos: number[];
  legendaNaoSalva: boolean;
}) {
  const router = useRouter();
  const [quando, setQuando] = useState<"agora" | "depois">("agora");
  const [dataHora, setDataHora] = useState("");
  const [aviso, setAviso] = useState<AvisoDaPublicacao | null>(null);
  const [pendente, iniciar] = useTransition();
  const { estado } = publicacao;
  const faltas = faltasParaPublicar({ total, soTexto, imagens, origem: publicacao.origem, slidesNaoSalvos, legendaNaoSalva });
  const travado = pendente || faltas.length > 0 || (quando === "depois" && !dataHora);

  function publicar() {
    iniciar(async () => {
      const r = await publicarDaTela({
        bonusId,
        carrosselId,
        soTexto,
        versoesDaMiniatura,
        versoesDoTexto: publicacao.versoesDoTexto,
        quando,
        dataHora: quando === "depois" ? dataHora : "",
        assinar: publicacao.acaoDaAssinatura,
        publicar: publicacao.acaoDaPublicacao,
      });
      setAviso(r);
      if (r.tom === "ok") router.refresh();
    });
  }

  return (
    <section className={`${card} space-y-3 p-6`}>
      <h2 className="text-base font-semibold">Publicar</h2>
      {estado.texto && <p className={QUADRO[estado.tom ?? "atencao"]}>{estado.texto}</p>}
      {estado.filaId && (
        <a href={`/publicar/post/${estado.filaId}`} className={link}>
          Ver no /publicar
        </a>
      )}
      {publicacao.avisoDoCalendario && <p className={hint}>{publicacao.avisoDoCalendario}</p>}
      {estado.livre && (
        <div className="space-y-3">
          {publicacao.arroba && (
            <p className="text-sm">
              Vai sair em <strong>@{publicacao.arroba}</strong>.
            </p>
          )}
          <fieldset className="flex flex-wrap items-center gap-4 text-sm">
            <legend className="sr-only">Quando publicar</legend>
            <label className="flex items-center gap-2">
              <input type="radio" name="quando" checked={quando === "agora"} onChange={() => setQuando("agora")} />
              Agora
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="quando" checked={quando === "depois"} onChange={() => setQuando("depois")} />
              Agendar
            </label>
          </fieldset>
          {quando === "depois" && (
            <input
              type="datetime-local"
              aria-label="Data e hora"
              value={dataHora}
              onChange={(e) => setDataHora(e.target.value)}
              className={input}
            />
          )}
          {faltas.map((f) => (
            <p key={f.tipo} className={hint}>
              {textoDaFalta(f)}
            </p>
          ))}
          <button type="button" onClick={publicar} disabled={travado} className={btnPrimary}>
            {pendente ? "Publicando…" : "Publicar"}
          </button>
        </div>
      )}
      {aviso && (
        <p role="status" className={aviso.tom === "ok" ? alertOk : alertError}>
          {aviso.texto}
        </p>
      )}
    </section>
  );
}
```

Em `app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx b/app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx
index 4a301b8..96b96cc 100644
--- a/app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx
+++ b/app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx
@@ -1,5 +1,5 @@
 "use client";
-import { useActionState, useMemo, useState, useTransition, type ChangeEvent } from "react";
+import { useActionState, useEffect, useMemo, useState, useTransition, type ChangeEvent } from "react";
 import { badgeWarn, btnPrimary, btnSecondary, card, hint } from "@/app/ui";
 import AvisoDoFormulario from "@/app/bonus/aviso-do-formulario";
 import { avisosDeCabimento, campoDoAviso } from "@/lib/bonus/arte-cabimento";
@@ -49,6 +49,7 @@ export default function CardDaParte({
   versaoDoTexto = null,
   enviarImagem = null,
   travado = null,
+  aoMudarNaoSalvo,
 }: {
   acao: (anterior: AvisoDoSlide | null, form: FormData) => Promise<AvisoDoSlide | null>;
   bonusId: string;
@@ -72,6 +73,8 @@ export default function CardDaParte({
   enviarImagem?: ((arquivo: File) => Promise<AvisoDaImagem>) | null;
   /** A frase da trava, com o carrossel na fila ou publicado. */
   travado?: string | null;
+  /** Avisa o editor quando o card fica, ou deixa de ficar, "não salvo": o "Publicar" trava com ele. */
+  aoMudarNaoSalvo?: (naoSalvo: boolean) => void;
 }) {
   const doCard = (v: Record<string, string>) => Object.fromEntries(campos.map((c) => [c.nome, v[c.nome] ?? ""]));
   const [atuais, setAtuais] = useState(() => doCard(valores));
@@ -92,6 +95,9 @@ export default function CardDaParte({
 
   const numero = parte.tipo === "slide" ? parte.numero : null;
   const naoSalvo = campos.some((c) => atuais[c.nome] !== salvos[c.nome]);
+  useEffect(() => {
+    aoMudarNaoSalvo?.(naoSalvo);
+  }, [naoSalvo, aoMudarNaoSalvo]);
   const campoDoNaoCabe = numero ? campoDoAviso(numero, total) : null;
   const naoCabe = useMemo(
     () => (numero && campoDoNaoCabe ? avisosDeCabimento(total, atuais, soTexto ? [numero] : [])[campoDoNaoCabe] : undefined),
```

Em `app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx b/app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx
index ffd2f23..1640d49 100644
--- a/app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx
+++ b/app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx
@@ -1,5 +1,5 @@
 "use client";
-import { useActionState, useRef, useState, useTransition } from "react";
+import { useActionState, useCallback, useRef, useState, useTransition } from "react";
 import { alertError, alertOk, alertWarn, btnPrimary, btnSecondary, card, hint } from "@/app/ui";
 import { urlDaArte } from "@/lib/bonus/arte-tela";
 import { textoDoBaixarTodos, type AvisoDaArte } from "@/lib/bonus/arte-textos";
@@ -7,6 +7,7 @@ import { camposDaParte, type CampoDoCarrossel, type ParteDoCarrossel } from "@/l
 import type { AvisoDoSlide } from "@/lib/bonus/carrossel-textos";
 import type { AvisoDaImagem } from "@/lib/bonus/publicar-textos";
 import CardDaParte from "./card-da-parte";
+import CardPublicar from "./card-publicar";
 import { enviarImagemDoSlide } from "./imagem-no-navegador";
 import type { ImagemNaTela, PublicacaoNaTela } from "./publicacao-na-tela";
 
@@ -67,6 +68,12 @@ export default function EditorDoCarrossel({
   const [versoes, setVersoes] = useState(versoesIniciais);
   const [imagens, setImagens] = useState<Record<number, ImagemNaTela>>(publicacao?.imagens ?? {});
   const travado = publicacao?.travado ?? null;
+  // As partes "não salvas" ("slide_N" e "legenda"): o "Publicar" trava com elas, porque o que sai é o
+  // texto salvo. Cada card avisa quando muda.
+  const [naoSalvos, setNaoSalvos] = useState<string[]>([]);
+  const marcarNaoSalvo = useCallback((chave: string, sim: boolean) => {
+    setNaoSalvos((atuais) => (atuais.includes(chave) === sim ? atuais : sim ? [...atuais, chave] : atuais.filter((k) => k !== chave)));
+  }, []);
   const [soTexto, setSoTexto] = useState(soTextoInicial);
   const aceito = useRef(soTextoInicial);
   const [respostaDaArte, despacharArte, artePendente] = useActionState(
@@ -125,95 +132,112 @@ export default function EditorDoCarrossel({
   }
 
   return (
-    <section className={`${card} space-y-4 p-6`}>
-      <h2 className="text-base font-semibold">Arte e texto dos slides</h2>
-      {travado && (
-        <p role="status" className={alertWarn}>
-          {travado}
-        </p>
-      )}
-      <div>
-        <p className="text-sm">
-          Conta do carrossel: <strong>{rotuloDaConta ?? "nenhuma conta conectada"}</strong>
-        </p>
-        {avisoDaConta && !fixada && <p className={hint}>{avisoDaConta}</p>}
-        {podeFixar && !fixada && (
-          <button
-            type="button"
-            disabled={contaPendente}
-            onClick={() => {
-              const form = new FormData();
-              form.set("id", carrosselId);
-              iniciar(() => fixar(form));
-            }}
-            className={`${btnSecondary} mt-2`}
-          >
-            Fixar nesta conta
-          </button>
-        )}
-        {respostaDaConta && (
-          <p role="status" className={`${respostaDaConta.tom === "ok" ? alertOk : alertError} mt-2`}>
-            {respostaDaConta.texto}
+    <div className="space-y-6">
+      <section className={`${card} space-y-4 p-6`}>
+        <h2 className="text-base font-semibold">Arte e texto dos slides</h2>
+        {travado && (
+          <p role="status" className={alertWarn}>
+            {travado}
           </p>
         )}
-      </div>
-      <p className={hint}>
-        A chamada pede a palavra <strong>{palavra}</strong>. Ela vem do bônus e não se edita aqui.
-      </p>
+        <div>
+          <p className="text-sm">
+            Conta do carrossel: <strong>{rotuloDaConta ?? "nenhuma conta conectada"}</strong>
+          </p>
+          {avisoDaConta && !fixada && <p className={hint}>{avisoDaConta}</p>}
+          {podeFixar && !fixada && (
+            <button
+              type="button"
+              disabled={contaPendente}
+              onClick={() => {
+                const form = new FormData();
+                form.set("id", carrosselId);
+                iniciar(() => fixar(form));
+              }}
+              className={`${btnSecondary} mt-2`}
+            >
+              Fixar nesta conta
+            </button>
+          )}
+          {respostaDaConta && (
+            <p role="status" className={`${respostaDaConta.tom === "ok" ? alertOk : alertError} mt-2`}>
+              {respostaDaConta.texto}
+            </p>
+          )}
+        </div>
+        <p className={hint}>
+          A chamada pede a palavra <strong>{palavra}</strong>. Ela vem do bônus e não se edita aqui.
+        </p>
 
-      <ul className="space-y-4">
-        {slides.map((n) => (
+        <ul className="space-y-4">
+          {slides.map((n) => (
+            <CardDaParte
+              key={n}
+              acao={acaoDoSlide}
+              bonusId={bonusId}
+              carrosselId={carrosselId}
+              palavra={palavra}
+              total={total}
+              parte={{ tipo: "slide", numero: n }}
+              campos={camposDe({ tipo: "slide", numero: n })}
+              valores={valores}
+              versao={versoes[n - 1]}
+              aoNovaVersao={(v) => setVersoes((vs) => vs.map((x, i) => (i === n - 1 ? v : x)))}
+              soTexto={soTexto.includes(n)}
+              aoMudarSoTexto={(marcado) => mudarSoTexto(n, marcado)}
+              soTextoPendente={artePendente}
+              imagem={imagens[n] ?? null}
+              versaoDoTexto={publicacao?.versoesDoTexto[n - 1] ?? null}
+              enviarImagem={publicacao ? (arquivo) => enviarImagem(publicacao, n, arquivo) : null}
+              travado={travado}
+              aoMudarNaoSalvo={(sim) => marcarNaoSalvo(`slide_${n}`, sim)}
+            />
+          ))}
           <CardDaParte
-            key={n}
             acao={acaoDoSlide}
             bonusId={bonusId}
             carrosselId={carrosselId}
             palavra={palavra}
             total={total}
-            parte={{ tipo: "slide", numero: n }}
-            campos={camposDe({ tipo: "slide", numero: n })}
+            parte={{ tipo: "legenda" }}
+            campos={camposDe({ tipo: "legenda" })}
             valores={valores}
-            versao={versoes[n - 1]}
-            aoNovaVersao={(v) => setVersoes((vs) => vs.map((x, i) => (i === n - 1 ? v : x)))}
-            soTexto={soTexto.includes(n)}
-            aoMudarSoTexto={(marcado) => mudarSoTexto(n, marcado)}
-            soTextoPendente={artePendente}
-            imagem={imagens[n] ?? null}
-            versaoDoTexto={publicacao?.versoesDoTexto[n - 1] ?? null}
-            enviarImagem={publicacao ? (arquivo) => enviarImagem(publicacao, n, arquivo) : null}
+            versao={null}
+            aoNovaVersao={() => {}}
+            soTexto={false}
+            aoMudarSoTexto={() => {}}
+            soTextoPendente={false}
             travado={travado}
+            aoMudarNaoSalvo={(sim) => marcarNaoSalvo("legenda", sim)}
           />
-        ))}
-        <CardDaParte
-          acao={acaoDoSlide}
+        </ul>
+
+        {respostaDaArte?.tom === "erro" && (
+          <p role="status" className={alertError}>
+            {respostaDaArte.texto}
+          </p>
+        )}
+
+        <div className="space-y-2">
+          <p className={hint}>{textoDoBaixarTodos(total)}</p>
+          <button type="button" onClick={baixarTodos} disabled={baixando} className={btnPrimary}>
+            Baixar todos
+          </button>
+        </div>
+      </section>
+      {publicacao && (
+        <CardPublicar
+          publicacao={publicacao}
           bonusId={bonusId}
           carrosselId={carrosselId}
-          palavra={palavra}
           total={total}
-          parte={{ tipo: "legenda" }}
-          campos={camposDe({ tipo: "legenda" })}
-          valores={valores}
-          versao={null}
-          aoNovaVersao={() => {}}
-          soTexto={false}
-          aoMudarSoTexto={() => {}}
-          soTextoPendente={false}
-          travado={travado}
+          soTexto={soTexto}
+          imagens={imagens}
+          versoesDaMiniatura={versoes}
+          slidesNaoSalvos={naoSalvos.filter((k) => k.startsWith("slide_")).map((k) => Number(k.slice("slide_".length)))}
+          legendaNaoSalva={naoSalvos.includes("legenda")}
         />
-      </ul>
-
-      {respostaDaArte?.tom === "erro" && (
-        <p role="status" className={alertError}>
-          {respostaDaArte.texto}
-        </p>
       )}
-
-      <div className="space-y-2">
-        <p className={hint}>{textoDoBaixarTodos(total)}</p>
-        <button type="button" onClick={baixarTodos} disabled={baixando} className={btnPrimary}>
-          Baixar todos
-        </button>
-      </div>
-    </section>
+    </div>
   );
 }
```

Em `app/bonus/[id]/carrossel/[cid]/imagem-no-navegador.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/[id]/carrossel/[cid]/imagem-no-navegador.ts b/app/bonus/[id]/carrossel/[cid]/imagem-no-navegador.ts
index 71f95cb..6e009fb 100644
--- a/app/bonus/[id]/carrossel/[cid]/imagem-no-navegador.ts
+++ b/app/bonus/[id]/carrossel/[cid]/imagem-no-navegador.ts
@@ -6,6 +6,7 @@ import {
   textoDaArteQueNaoVeio,
   textoDaProporcao,
   type AvisoDaImagem,
+  type AvisoDaPublicacao,
   type RespostaDaAssinatura,
 } from "@/lib/bonus/publicar-textos";
 import { medidasDaConversao, planoDaConversao } from "@/lib/publicacao";
@@ -149,3 +150,30 @@ export async function prepararArtesSoTexto(p: {
   }
   return { ok: true, artes };
 }
+
+/**
+ * O CLIQUE NO "PUBLICAR": prepara as artes "Só texto" e manda o pedido, com a hora e o fuso do
+ * navegador (o `datetime-local` não tem fuso; a action lê os dois com as funções do /publicar). Fora
+ * do componente, para o relógio não ser lido durante o desenho da tela.
+ */
+export async function publicarDaTela(p: {
+  bonusId: string;
+  carrosselId: string;
+  soTexto: number[];
+  versoesDaMiniatura: string[];
+  versoesDoTexto: string[];
+  quando: "agora" | "depois";
+  dataHora: string;
+  assinar: Assinar;
+  publicar: (pedido: unknown) => Promise<AvisoDaPublicacao>;
+}): Promise<AvisoDaPublicacao> {
+  const artes = await prepararArtesSoTexto(p);
+  if (!artes.ok) return { tom: "erro", texto: artes.texto, em: Date.now() };
+  return p.publicar({
+    id: p.carrosselId,
+    quando: p.quando,
+    dataHora: p.dataHora,
+    fuso: String(new Date().getTimezoneOffset()),
+    artes: artes.artes,
+  });
+}
```

Em `app/bonus/[id]/carrossel/[cid]/page.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/[id]/carrossel/[cid]/page.tsx b/app/bonus/[id]/carrossel/[cid]/page.tsx
index aab8d89..d525b65 100644
--- a/app/bonus/[id]/carrossel/[cid]/page.tsx
+++ b/app/bonus/[id]/carrossel/[cid]/page.tsx
@@ -8,12 +8,18 @@ import {
   salvarArteDoCarrossel,
   salvarSlideDoCarrossel,
 } from "@/app/bonus/carrossel-actions";
+import { assinarImagemDoCarrossel, guardarImagemDoSlide, publicarCarrossel } from "@/app/bonus/publicar-actions";
 import { ACCOUNT_COOKIE } from "@/lib/account";
 import { avisoDaUrl } from "@/lib/avisos";
-import { resolverConta } from "@/lib/bonus/arte-conta";
+import { urlPublicaSeDerParaMontar } from "@/lib/bucket";
+import { contaSelecionada, resolverConta } from "@/lib/bonus/arte-conta";
 import { escolhasDaArte } from "@/lib/bonus/arte-escolhas";
 import { slidesDoTexto } from "@/lib/bonus/arte-slides";
 import { cabecalhoParaVersao, versoesDosSlides } from "@/lib/bonus/arte-tela";
+import { publicacaoLivre } from "@/lib/bonus/publicar-estado";
+import { imagensDaArte, versaoDoTextoDoSlide } from "@/lib/bonus/publicar-regras";
+import { estadoDoCarrossel } from "@/lib/bonus/publicar-repositorio";
+import { textoDaTrava, textoDoCalendario, textoDoEstadoDaPublicacao, tomDoEstadoDaPublicacao } from "@/lib/bonus/publicar-textos";
 import { TEXTO_ARTE_SEM_CONTA, rotuloDaConta, textoDaOrigemDaConta } from "@/lib/bonus/arte-textos";
 import type { LinhaDoCarrossel } from "@/lib/bonus/carrossel-linha";
 import { contasParaArte, lerCarrossel } from "@/lib/bonus/carrossel-repositorio";
@@ -32,6 +38,7 @@ import { geracaoNaTela } from "@/lib/bonus/tempos";
 import { TEXTO_TRAVOU, type TomDoQuadro } from "@/lib/bonus/textos";
 import Acompanhar from "../../acompanhar";
 import EditorDoCarrossel from "./editor-do-carrossel";
+import type { PublicacaoNaTela } from "./publicacao-na-tela";
 
 // O teto de lib/bonus/tempos.ts (MAX_DURATION_S). O Next exige literal aqui, e
 // tests/bonus-carrossel-paginas.test.ts confere que é o mesmo número. O "Gerar de novo" desta
@@ -135,6 +142,10 @@ async function situacaoDoBonus(bonusId: string): Promise<SituacaoNoLabs> {
  * carrossel (arte-conta.ts): a página mostra qual é, avisa quando ela saiu do Chat, e oferece "Fixar
  * nesta conta" ao carrossel de antes de a conta ser gravada. Cada miniatura tem a sua versão, o resumo
  * de tudo o que a rota desenha naquele slide (arte-tela.ts, `versoesDosSlides`).
+ *
+ * A PUBLICAÇÃO (spec da Etapa 5) é decidida aqui, no servidor: as imagens do Canva guardadas, com o
+ * endereço público delas; a versão do texto de cada slide; o estado lido da fila pela chave exata; a
+ * trava; e o aviso do calendário, que só mostra a conta selecionada no menu.
  */
 async function Revisao({ carrossel }: { carrossel: LinhaDoCarrossel }) {
   const texto = textoDaLinhaDoCarrossel(carrossel);
@@ -142,7 +153,30 @@ async function Revisao({ carrossel }: { carrossel: LinhaDoCarrossel }) {
 
   const contas = await contasParaArte();
   const escolhas = escolhasDaArte(carrossel.arte, carrossel.total_slides);
-  const { conta, origem } = resolverConta(contas, escolhas, (await cookies()).get(ACCOUNT_COOKIE)?.value);
+  const doCookie = (await cookies()).get(ACCOUNT_COOKIE)?.value;
+  const { conta, origem } = resolverConta(contas, escolhas, doCookie);
+
+  const estado = await estadoDoCarrossel(carrossel.arte);
+  const filaId = "filaId" in estado ? estado.filaId : null;
+  const noMenu = contaSelecionada(contas, doCookie);
+  const publicacao: PublicacaoNaTela = {
+    acaoDaAssinatura: assinarImagemDoCarrossel,
+    acaoDaImagem: guardarImagemDoSlide,
+    acaoDaPublicacao: publicarCarrossel,
+    imagens: Object.fromEntries(
+      Object.entries(imagensDaArte(carrossel.arte, carrossel.total_slides)).map(([n, i]) => [
+        n,
+        { url: urlPublicaSeDerParaMontar(i.caminho), versao: i.versao },
+      ])
+    ),
+    versoesDoTexto: slidesDoTexto(texto).map(versaoDoTextoDoSlide),
+    travado: publicacaoLivre(estado) ? null : textoDaTrava(estado),
+    origem,
+    arroba: origem === "gravada" ? (conta?.username ?? null) : null,
+    estado: { texto: textoDoEstadoDaPublicacao(estado), tom: tomDoEstadoDaPublicacao(estado), filaId, livre: publicacaoLivre(estado) },
+    avisoDoCalendario:
+      filaId && conta && escolhas.conta && noMenu?.ig_user_id !== escolhas.conta ? textoDoCalendario(rotuloDaConta(conta)) : null,
+  };
 
   return (
     <EditorDoCarrossel
@@ -160,6 +194,7 @@ async function Revisao({ carrossel }: { carrossel: LinhaDoCarrossel }) {
       podeFixar={origem === "selecionada" && conta !== null}
       soTextoInicial={escolhas.soTexto}
       versoes={versoesDosSlides(slidesDoTexto(texto), escolhas.soTexto, cabecalhoParaVersao(conta))}
+      publicacao={publicacao}
     />
   );
 }
```

Em `lib/bonus/publicar-textos.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/publicar-textos.ts b/lib/bonus/publicar-textos.ts
index 6e0305c..8cc6652 100644
--- a/lib/bonus/publicar-textos.ts
+++ b/lib/bonus/publicar-textos.ts
@@ -2,6 +2,7 @@ import type { Aviso } from "@/lib/avisos";
 import { fmtDate } from "@/lib/format";
 import type { EstadoDaPublicacao, FaltaParaPublicar } from "./publicar-estado";
 import type { ProblemaDaProporcao } from "./publicar-regras";
+import type { TomDoQuadro } from "./textos";
 
 // AS FRASES DA PUBLICAÇÃO DO CARROSSEL, fora do JSX e das actions (o princípio de
 // lib/bonus/textos.ts): uma saída muda é indistinguível de sucesso, e cada saída tem frase, testada.
@@ -40,6 +41,23 @@ export function textoDoEstadoDaPublicacao(e: EstadoDaPublicacao): string | null
   }
 }
 
+/** A cor do estado na página: verde quando deu certo, amarelo quando espera, vermelho quando falhou. */
+export function tomDoEstadoDaPublicacao(e: EstadoDaPublicacao): TomDoQuadro | null {
+  switch (e.tipo) {
+    case "livre":
+      return null;
+    case "agendado":
+    case "publicado":
+      return "ok";
+    case "publicando":
+    case "cancelado":
+    case "nao_entrou":
+      return "atencao";
+    default:
+      return "erro";
+  }
+}
+
 /** Por que uma edição foi recusada: o carrossel está na fila, ou já saiu. */
 export function textoDaTrava(e: EstadoDaPublicacao): string {
   switch (e.tipo) {
```

Em `lib/bonus/publicar-estado.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/publicar-estado.ts b/lib/bonus/publicar-estado.ts
index de521d8..560a5c7 100644
--- a/lib/bonus/publicar-estado.ts
+++ b/lib/bonus/publicar-estado.ts
@@ -1,7 +1,7 @@
 // O ESTADO DA PUBLICAÇÃO DO CARROSSEL E O QUE FALTA PARA PUBLICAR (spec da Etapa 5). PURO: o
 // repositório lê a linha da fila e o relógio do banco, e esta função decide.
 import type { OrigemDaConta } from "./arte-conta";
-import type { ImagemGuardada, PublicacaoGuardada } from "./publicar-regras";
+import type { PublicacaoGuardada } from "./publicar-regras";
 
 /** A linha da fila do /publicar, lida pela `dedupe_key` exata que o carrossel guardou. */
 export type LinhaDaFila = { id: string; status: string; not_before: Date; sent_at: Date | null; error: string | null };
@@ -76,7 +76,8 @@ export type FaltaParaPublicar =
 export function faltasParaPublicar(p: {
   total: number;
   soTexto: number[];
-  imagens: Record<number, ImagemGuardada>;
+  /** A imagem de cada slide, como o banco a guarda ou como a tela a mostra: aqui só importa se há. */
+  imagens: Record<number, unknown>;
   origem: OrigemDaConta;
   slidesNaoSalvos: number[];
   legendaNaoSalva: boolean;
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx vitest run tests/bonus-publicar-estado.test.ts tests/bonus-publicar-paginas.test.ts tests/bonus-carrossel-paginas.test.ts
npx vitest run --config vitest.dom.config.ts testes-dom/bonus-card-publicar.dom.tsx testes-dom/bonus-publicar-imagem.dom.tsx testes-dom/bonus-imagem-no-card.dom.tsx testes-dom/bonus-editor-do-carrossel.dom.tsx testes-dom/bonus-card-da-parte.dom.tsx
```

Esperado: `tsc` limpo; 50 casos puros e 48 de tela passam.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" "app/bonus/[id]/carrossel/[cid]/card-publicar.tsx" "app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx" "app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx" "app/bonus/[id]/carrossel/[cid]/imagem-no-navegador.ts" "app/bonus/[id]/carrossel/[cid]/page.tsx" lib/bonus/publicar-textos.ts lib/bonus/publicar-estado.ts tests/bonus-publicar-estado.test.ts tests/bonus-publicar-paginas.test.ts testes-dom/bonus-card-publicar.dom.tsx testes-dom/bonus-publicar-imagem.dom.tsx
test "$(git branch --show-current)" = "publicar-do-carrossel"
git add "app/bonus/[id]/carrossel/[cid]/card-publicar.tsx" "app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx" "app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx" "app/bonus/[id]/carrossel/[cid]/imagem-no-navegador.ts" "app/bonus/[id]/carrossel/[cid]/page.tsx" lib/bonus/publicar-textos.ts lib/bonus/publicar-estado.ts tests/bonus-publicar-estado.test.ts tests/bonus-publicar-paginas.test.ts testes-dom/bonus-card-publicar.dom.tsx testes-dom/bonus-publicar-imagem.dom.tsx
git commit -m "feat(bonus): o card Publicar e a página do carrossel com a publicação"
```

---

### FASE 5.10 — O verify, a integração inteira, as mutações e o que não pode mudar

- [ ] **Passo 1: o verify, na árvore do projeto**

```bash
npm run verify
```

Esperado: lint e `tsc` limpos; 99 arquivos / 2 854 casos puros e 21 / 147 de tela; a varredura "SEM VAZAMENTO em A nem em C"; o build
(Turbopack) com "MIGRAÇÃO PULADA" e as rotas `ƒ /bonus/[id]/carrossel/[cid]` e
`ƒ /bonus/[id]/carrossel/[cid]/arte`.

- [ ] **Passo 2: a integração inteira, no container**

```bash
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npm run test:integracao
```

Esperado: `[rede-global] ALVO: banco de TESTE`; 39 arquivos, 363 passaram e 8 pularam (na base, 37, 315 e 8).

- [ ] **Passo 3: as provas de mutação**

Copie o script do Apêndice A para `$SCRATCH/mutar-publicar.mjs` e rode, da raiz:

```bash
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" node "$SCRATCH/mutar-publicar.mjs"
git status --short
```

Esperado: as 45 com ✓, "45 mutações, 0 ruins", e a árvore limpa depois (cada arquivo volta byte a
byte).

- [ ] **Passo 4: nenhum arquivo do `/publicar` mudou**

```bash
git diff --stat a4411a5 -- app/publicar app/api/midia lib/bucket.ts lib/queue-drain.ts lib/engine.ts lib/publicacao.ts lib/dedupe.ts migrations package.json package-lock.json next.config.ts
git diff --stat a4411a5 -- . ':!app/bonus' ':!lib/bonus' ':!tests' ':!testes-dom' ':!testes-integracao' ':!docs'
```

Esperado: as duas saídas vazias.

- [ ] **Passo 5: avisar o auditor**, com o hash, os números e o pedido de conferir a branch antes do
  push. O push da branch e o PR só com o OK do Eduardo.

---

### FASE 5.11 — A prova real, no preview, com o Eduardo

No preview, com o Eduardo na tela e guiado passo a passo só com o link do site. **Cada gravação tem o
OK dele**, e o auditor lê o banco antes e depois (avisado com a hora). O preview usa o banco e o
bucket de produção, e o post real sai no Instagram de verdade.

1. Subir a imagem do Canva em slides com espaço: a miniatura troca, e o "Publicar" diz quais faltam.
   Uma imagem quadrada é recusada antes de subir, com a frase do 4:5 (sem gravar nada).
2. Trocar uma imagem: a anterior sai do bucket.
3. Editar o texto de um slide com imagem e salvar: aparece "O texto mudou depois desta imagem."
4. Agendar para o dia seguinte: a página mostra "Agendado", e texto, "Só texto" e imagens ficam
   travados. O post aparece no calendário, com a conta do carrossel selecionada no menu.
5. Cancelar no calendário: o botão volta, e as imagens continuam no carrossel.
6. Um post real numa conta de teste, escolhida pelo Eduardo na hora, com um carrossel daquela conta
   (gerado ou fixado nela, com o OK dele): "Agora", "Publicando" e "Publicado". Conferir no Instagram
   a ordem dos slides, as artes "Só texto" sem recorte (o texto inteiro, de margem a margem), as
   imagens do Canva e a legenda. Depois, o Eduardo apaga o post no Instagram.

Depois da prova: o corpo do PR (o porquê, o que mudou, a prova, o que ficou anotado), conferido pelo
auditor, e o PR com o OK do Eduardo. O merge é do Vinícius.

---

## Apêndice A — as provas de mutação

Cada mutação tira uma proteção e roda o teste que a cobre; o caso nomeado tem de cair. O arquivo
volta byte a byte depois de cada uma. Sem `DATABASE_URL_TESTES`, o script recusa antes de mutar.

```js
// Provas de mutação da Etapa 5 (publicar o carrossel). Cada arquivo volta byte a byte.
// Uso, da raiz do repositório: DATABASE_URL_TESTES=<container> node mutar-publicar.mjs [filtro]
// As mutações INTEG rodam a suíte de integração, que sem DATABASE_URL_TESTES cai na DATABASE_URL, a
// da PRODUÇÃO (achado 68): sem a variável, o script recusa antes de mutar, e uma rodada INTEG que
// não imprime "ALVO: banco de TESTE" conta como ✗.
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const PURA = (f) => `npx vitest run ${f}`;
const TELA = (f) => `npx vitest run --config vitest.dom.config.ts ${f}`;
const INTEG = (f) => `npx vitest run --config vitest.integracao.config.ts ${f}`;
const REGRAS = "lib/bonus/publicar-regras.ts";
const ESTADO = "lib/bonus/publicar-estado.ts";
const REPO = "lib/bonus/publicar-repositorio.ts";
const REPO_CARROSSEL = "lib/bonus/carrossel-repositorio.ts";
const BUCKET = "lib/bonus/publicar-bucket.ts";
const PROCESSO = "lib/bonus/publicar-processo.ts";
const ACTIONS = "app/bonus/publicar-actions.ts";
const NAVEGADOR = "app/bonus/[id]/carrossel/[cid]/imagem-no-navegador.ts";
const CARD = "app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx";
const PUBLICAR = "app/bonus/[id]/carrossel/[cid]/card-publicar.tsx";
const PAGINA = "app/bonus/[id]/carrossel/[cid]/page.tsx";
const T_REGRAS = PURA("tests/bonus-publicar-regras.test.ts");
const T_ESTADO = PURA("tests/bonus-publicar-estado.test.ts");
const T_BUCKET = PURA("tests/bonus-publicar-bucket.test.ts");
const T_PAGINAS = PURA("tests/bonus-publicar-paginas.test.ts");
const T_REPO = INTEG("testes-integracao/bonus-publicar-repositorio.integracao.ts");
const T_PROCESSO = INTEG("testes-integracao/bonus-publicar-processo.integracao.ts");
const T_NAVEGADOR = TELA("testes-dom/bonus-publicar-imagem.dom.tsx");
const T_CARD = TELA("testes-dom/bonus-imagem-no-card.dom.tsx");
const T_PUBLICAR = TELA("testes-dom/bonus-card-publicar.dom.tsx");
const TRAVA_NO_SALVAR = "salvar, só texto e guardar são recusados";

const MUTACOES = [
  // 5.1 as regras puras
  { nome: "5.1: o destino da fila aceita o prefixo da guardada", arq: REGRAS,
    de: '{ slide: "bonus", fila: "bonus-fila" }', para: '{ slide: "bonus", fila: "bonus" }',
    cmd: T_REGRAS, caso: "cada destino aceita só o próprio prefixo" },
  { nome: "5.1: o caminho aceita outra pasta", arq: REGRAS,
    de: "return new RegExp(`^${pasta}/", para: "return new RegExp(`^[A-Za-z0-9_-]+/",
    cmd: T_REGRAS, caso: "recusa outra pasta" },
  { nome: "5.1: a proporção sem a borda de cima", arq: REGRAS,
    de: 'return p >= PROPORCAO_MIN && p <= PROPORCAO_MAX ? null : "proporcao";', para: 'return p >= PROPORCAO_MIN ? null : "proporcao";',
    cmd: T_REGRAS, caso: "quadrada e paisagem são recusadas" },
  { nome: "5.1: a versão do texto não olha o texto", arq: REGRAS,
    de: "return versaoDaArte([JSON.stringify(s)]);", para: "return versaoDaArte([s.numero]);",
    cmd: T_REGRAS, caso: "muda com a manchete e com o texto daquele slide" },
  { nome: "5.1: a publicação estranha vira nenhuma", arq: REGRAS,
    de: 'if (!p || !textoCheio(p.chave)) return "estranha";', para: "if (!p || !textoCheio(p.chave)) return null;",
    cmd: T_REGRAS, caso: "a forma estranha (chave vazia)" },
  // 5.2 o estado e a trava
  { nome: "5.2: a trava libera o agendado", arq: ESTADO,
    de: 'return e.tipo === "livre" || e.tipo === "falhou"', para: 'return e.tipo === "livre" || e.tipo === "agendado" || e.tipo === "falhou"',
    cmd: T_ESTADO, caso: "livre = false" },
  { nome: "5.2: a enfileirada sem linha cai na regra dos 10 minutos (achado 75)", arq: ESTADO,
    de: '  if (publicacao.enfileiradaEm) return { tipo: "saiu_da_fila" };\n', para: "",
    cmd: T_ESTADO, caso: "a enfileirada sem linha saiu da fila" },
  { nome: "5.2: o estado novo da fila libera", arq: ESTADO,
    de: '        return { tipo: "desconhecido", status: linha.status };', para: '        return { tipo: "livre" };',
    cmd: T_ESTADO, caso: "um estado que a fila venha a ter" },
  { nome: "5.2: a espera da reserva vira 1 minuto", arq: ESTADO,
    de: "export const ESPERA_DA_RESERVA_MS = 10 * 60_000;", para: "export const ESPERA_DA_RESERVA_MS = 60_000;",
    cmd: T_ESTADO, caso: "a reserva nunca enfileirada, sem linha, é publicando por 10 minutos" },
  { nome: "5.2: o não salvo não falta", arq: ESTADO,
    de: "  if (p.slidesNaoSalvos.length || p.legendaNaoSalva) {", para: "  if (false) {",
    cmd: T_ESTADO, caso: "o não salvo, porque o que sai é o texto salvo" },
  // 5.3 o repositório e a trava nas gravações
  { nome: "5.3: guardar sem a trava da publicação", arq: REPO,
    de: '    if (!escolhas.conta) return recusa({ motivo: "sem_conta" });\n    const estado = await estadoDaPublicacaoNa(tx, linha.arte);\n    if (!publicacaoLivre(estado)) return recusa({ motivo: "travado", estado });\n',
    para: '    if (!escolhas.conta) return recusa({ motivo: "sem_conta" });\n',
    cmd: T_REPO, caso: TRAVA_NO_SALVAR },
  { nome: "5.3: salvar o slide sem a trava da publicação", arq: REPO_CARROSSEL,
    de: '    if (!linha || !atual) return { ok: false as const, motivo: "nao_pronto" as const };\n    const estado = await estadoDaPublicacaoNa(tx, linha.arte);\n    if (!publicacaoLivre(estado)) return { ok: false as const, motivo: "travado" as const, estado };\n',
    para: '    if (!linha || !atual) return { ok: false as const, motivo: "nao_pronto" as const };\n',
    cmd: T_REPO, caso: TRAVA_NO_SALVAR },
  { nome: "5.3: o só texto sem a trava da publicação", arq: REPO_CARROSSEL,
    de: '    if (!linha || linha.estado !== "pronto") return { ok: false as const, motivo: "nao_pronto" as const };\n    const estado = await estadoDaPublicacaoNa(tx, linha.arte);\n    if (!publicacaoLivre(estado)) return { ok: false as const, motivo: "travado" as const, estado };\n',
    para: '    if (!linha || linha.estado !== "pronto") return { ok: false as const, motivo: "nao_pronto" as const };\n',
    cmd: T_REPO, caso: TRAVA_NO_SALVAR },
  { nome: "5.3: guardar aceita o prefixo da fila", arq: REPO,
    de: 'pastaDaConta(escolhas.conta), "slide")) return recusa({ motivo: "caminho" });', para: 'pastaDaConta(escolhas.conta), "fila") && !caminho.includes("/bonus/")) return recusa({ motivo: "caminho" });',
    cmd: T_REPO, caso: "recusa o prefixo da fila" },
  { nome: "5.3: reservar sem a linha travada", arq: REPO,
    de: 'for update`, [id])) as LinhaDoCarrossel[];\n    const texto = linha?.estado === "pronto" ? textoDaLinhaDoCarrossel(linha) : null;\n    if (!linha || !texto) return recusa({ motivo: "nao_pronto" });\n    const estado',
    para: '`, [id])) as LinhaDoCarrossel[];\n    const texto = linha?.estado === "pronto" ? textoDaLinhaDoCarrossel(linha) : null;\n    if (!linha || !texto) return recusa({ motivo: "nao_pronto" });\n    const estado',
    cmd: T_REPO, caso: "o segundo clique espera a linha" },
  { nome: "5.3: reservar não confere o que mudou", arq: REPO,
    de: '    if (mudou) return recusa({ motivo: "mudou" });\n', para: "",
    cmd: T_REPO, caso: "recusa quando o texto mudou desde as cópias" },
  { nome: "5.3: marcar enfileirada com qualquer chave", arq: REPO,
    de: "where id = $1 and arte->'publicacao'->>'chave' = $2 returning id", para: "where id = $1 and $2::text is not null returning id",
    cmd: T_REPO, caso: "marcar enfileirada e desfazer a reserva só valem com a chave da tentativa" },
  // 5.4 o bucket
  { nome: "5.4: a cópia sobe sem o tipo", arq: BUCKET,
    de: 'headers: { "Content-Type": "image/jpeg" }, body: bytes', para: "body: bytes",
    cmd: T_BUCKET, caso: "baixa pelo endereço público" },
  { nome: "5.4: a cópia que falha deixa as feitas", arq: BUCKET,
    de: "    await apagarSemDerrubar(feitas);\n", para: "",
    cmd: T_BUCKET, caso: "se uma falha, as que já foram feitas saem do bucket" },
  { nome: "5.4: apagar derruba na primeira falha", arq: BUCKET,
    de: "      await apagarObjeto(caminho);\n    } catch {", para: "      await apagarObjeto(caminho);\n    } finally {",
    cmd: T_BUCKET, caso: "tenta todos, e a falha de um não lança" },
  // 5.5 o processo
  { nome: "5.5: a fila leva a guardada, e não a cópia", arq: PROCESSO,
    de: "? copiadas.copias[s.numero] :", para: "? imagens[s.numero].caminho :",
    cmd: T_PROCESSO, caso: "agora: enfileira na conta do carrossel" },
  { nome: "5.5: enfileira em outra conta", arq: PROCESSO,
    de: "entrou = await enfileirar(c.conta,", para: "entrou = await enfileirar(p.contas[1]?.ig_user_id ?? c.conta,",
    cmd: T_PROCESSO, caso: "agora: enfileira na conta do carrossel" },
  { nome: "5.5: sem a marca de enfileirada (achado 75)", arq: PROCESSO,
    de: "    await marcarEnfileirada(p.id, chave);\n", para: "",
    cmd: T_PROCESSO, caso: "a linha da fila apagada depois de enfileirar" },
  { nome: "5.5: a arte velha não sai do bucket", arq: PROCESSO,
    de: '      await descartar();\n      return recusa({ motivo: "arte_velha", numero: n });', para: '      return recusa({ motivo: "arte_velha", numero: n });',
    cmd: T_PROCESSO, caso: "a arte velha é recusada, e as artes subidas saem do bucket" },
  { nome: "5.5: o caminho da arte não é conferido na fila", arq: PROCESSO,
    de: "  if (naFila.length) {", para: "  if (false) {",
    cmd: T_PROCESSO, caso: "o caminho de uma arte que já está na fila de outro post é recusado" },
  { nome: "5.5: a fila que recusa não desfaz a reserva", arq: PROCESSO,
    de: "    await desfazerReserva(p.id, chave);\n", para: "",
    cmd: T_PROCESSO, caso: "a fila que recusa desfaz a reserva" },
  { nome: "5.5: a reserva velha fica no bucket", arq: PROCESSO,
    de: "    await apagarSemDerrubar(reserva.velha.caminhos.filter((x) => !daVelhaNaFila.includes(x) && !caminhos.includes(x)));\n", para: "",
    cmd: T_PROCESSO, caso: "a reserva velha que nunca entrou na fila sai do bucket" },
  { nome: "5.5: a limpeza da reserva velha apaga o que esta tentativa publica", arq: PROCESSO,
    de: " && !caminhos.includes(x)));", para: "));",
    cmd: T_PROCESSO, caso: "a reserva velha que repete um caminho desta tentativa" },
  { nome: "5.5: o agendado drena", arq: PROCESSO,
    de: "  if (p.quando === null) {", para: "  if (true) {",
    cmd: T_PROCESSO, caso: "agendado: entra com a hora pedida, e não drena" },
  { nome: "5.5: a assinatura aceita qualquer proporção", arq: PROCESSO,
    de: '  if (proporcao) return recusa({ motivo: "proporcao", problema: proporcao });\n', para: "",
    cmd: T_PROCESSO, caso: "recusa a imagem quadrada" },
  // 5.6 as actions
  { nome: "5.6: publicar sem conferir a sessão", arq: ACTIONS,
    de: "export async function publicarCarrossel(pedido: unknown): Promise<AvisoDaPublicacao> {\n  await exigirSessao();\n",
    para: "export async function publicarCarrossel(pedido: unknown): Promise<AvisoDaPublicacao> {\n",
    cmd: T_PAGINAS, caso: "as três actions começam por" },
  { nome: "5.6: a action lê a conta do pedido", arq: ACTIONS,
    de: "const r = await publicarNaFila({ id: p.id,", para: "const r = await publicarNaFila({ id: String(p.conta ?? p.id),",
    cmd: T_PAGINAS, caso: "as actions não leem conta do que o navegador manda" },
  // 5.7 a imagem no navegador
  { nome: "5.7: sem o branco antes de desenhar", arq: NAVEGADOR,
    de: "    pincel.fillRect(0, 0, largura, altura);\n", para: "",
    cmd: T_NAVEGADOR, caso: "pinta de branco antes de desenhar" },
  { nome: "5.7: o 4:5 não é conferido no navegador", arq: NAVEGADOR,
    de: "  if (proporcao) return erro(textoDaProporcao(proporcao));\n", para: "",
    cmd: T_NAVEGADOR, caso: "a imagem que não é 4:5 é recusada antes de pedir a assinatura" },
  { nome: "5.7: a arte que não virou JPEG sobe", arq: NAVEGADOR,
    de: '    if (pronta.jpeg.type !== "image/jpeg") return { ok: false, texto: textoDaArteQueNaoVeio(numero) };\n', para: "",
    cmd: T_NAVEGADOR, caso: "a arte que não vira JPEG não sobe" },
  // 5.8 a imagem no card
  { nome: "5.8: o aviso do texto que mudou nunca aparece", arq: CARD,
    de: "const desatualizada = comImagem !== null && versaoDoTextoSalvo !== null && comImagem.versao !== versaoDoTextoSalvo;",
    para: "const desatualizada = false;",
    cmd: T_CARD, caso: "o texto que mudou depois da imagem tem aviso" },
  { nome: "5.8: salvar não traz a versão do texto", arq: CARD,
    de: "      if (r.versaoDoTexto) setVersaoDoTextoSalvo(r.versaoDoTexto);\n", para: "",
    cmd: T_CARD, caso: "salvar o texto de um slide com imagem traz a versão nova do texto" },
  { nome: "5.8: travado, o Editar continua", arq: CARD,
    de: "              {travado === null && (\n                <button", para: "              {true && (\n                <button",
    cmd: T_CARD, caso: "com o carrossel na fila" },
  { nome: "5.8: o só texto mostra a imagem guardada", arq: CARD,
    de: "const comImagem = numero !== null && !soTexto ? imagem : null;", para: "const comImagem = numero !== null ? imagem : null;",
    cmd: T_CARD, caso: "marcado só texto, o slide sai com a arte do Chat" },
  // 5.9 o card Publicar e a página
  { nome: "5.9: as faltas não travam o botão", arq: PUBLICAR,
    de: "const travado = pendente || faltas.length > 0 || (quando", para: "const travado = pendente || (quando",
    cmd: T_PUBLICAR, caso: "as faltas travam o botão" },
  { nome: "5.9: o não salvo não chega ao Publicar", arq: CARD,
    de: "    aoMudarNaoSalvo?.(naoSalvo);\n", para: "",
    cmd: T_PUBLICAR, caso: "editar um slide sem salvar trava o Publicar" },
  { nome: "5.9: no sucesso a página não recarrega", arq: PUBLICAR,
    de: '      if (r.tom === "ok") router.refresh();\n', para: "",
    cmd: T_PUBLICAR, caso: "diz a conta, e Agora publica" },
  { nome: "5.9: a recusa também recarrega a página", arq: PUBLICAR,
    de: '      if (r.tom === "ok") router.refresh();\n', para: "      router.refresh();\n",
    cmd: T_PUBLICAR, caso: "a recusa aparece junto do botão, e a página não recarrega" },
  { nome: "5.9: na fila, o botão continua", arq: PUBLICAR,
    de: "      {estado.livre && (", para: "      {true && (",
    cmd: T_PUBLICAR, caso: "agendado: o estado, o post no /publicar" },
  { nome: "5.9: a página não entrega a publicação", arq: PAGINA,
    de: "      publicacao={publicacao}\n", para: "",
    cmd: T_PAGINAS, caso: "as três actions da publicação, e o estado lido da fila" },
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
