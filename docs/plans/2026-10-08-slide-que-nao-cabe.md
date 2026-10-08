# Gerador de bônus — Plano de implementação da Etapa 9: o slide que não cabe não sai

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: `superpowers:subagent-driven-development`
> (recomendada) ou `superpowers:executing-plans`, fase por fase. Os passos usam caixa de
> seleção (`- [ ]`) para acompanhar.

**Objetivo:** o publicar e o agendar do carrossel recusam o slide que sairia cortado na imagem
publicada, e o botão "Publicar" trava antes, com a frase dizendo qual slide corrigir e como (achado 87).

**Arquitetura:** um módulo puro novo (`lib/bonus/publicar-cabimento.ts`) faz a conta do "não cabe"
(`tamanhoDoSlide`, a de hoje) no modo em que cada slide sai: o "Só texto" sem o espaço da imagem, o com
foto com o espaço, e o slide pronto do Canva nunca. Ele diz também se marcar "Só texto" resolve. O
servidor (`publicarNaFila`) confere com o texto salvo, depois do `descartar` e antes das artes, da
reserva e da fila, e recusa com `nao_cabe`. Na tela, cada card de slide conta com o texto dos campos
dele e avisa o editor, como no "não salvo"; o editor passa a lista ao card "Publicar", e
`faltasParaPublicar` ganha a falta `nao_cabe`. A falta e a recusa têm a mesma frase. Sem banco.

**Stack:** a das etapas anteriores, no Next.js 16.3.8: App Router, Server Actions com
`useActionState`, React 19, Postgres (postgres.js via `lib/db.ts`), Vitest (três suítes), Tailwind
v4 com os tokens de `app/ui.ts`.

**Spec:** `docs/specs/2026-10-08-slide-que-nao-cabe.md` (commits `f56a67d` e `24bd215`, liberada pela
auditoria e lida pelo Eduardo; `a441c7b` registra o que o ensaio refinou, item 1 abaixo). Leia antes de
começar: este plano não repete o porquê das regras, só como construí-las.

**Ensaio do plano (08/10):** o código deste plano foi escrito e testado fase a fase numa cópia isolada
do repositório (`git worktree`, branch local `ensaio-que-nao-cabe`, sem push, saída de `24bd215`), e
todo bloco de código abaixo foi tirado do git dessa cópia por um gerador, sem cópia à mão. Os números
do ensaio:
- lint e `tsc` limpos em cada fase; no fim, 108 arquivos e 3 119 casos puros (107 e 3 099 na base), 22
  e 189 de tela (22 e 184 na base);
- `next build --webpack` limpo, com `ƒ /bonus/[id]/carrossel/[cid]` na lista, e o `AGENTS.md` intacto
  (o Turbopack, ver o item 5 abaixo);
- integração no container: 42 arquivos; 439 passaram, 8 pularam e 7 caíram, só os de
  `registro-de-migracoes`, pelo item 5 abaixo. Na árvore do projeto, a conta esperada é 42 arquivos,
  446 passaram e 8 pularam (FASE 9.4);
- cada fase foi vista falhar antes do código e passar depois, na ordem deste plano, com os números de
  cada uma no passo dela;
- as 23 provas de mutação do Apêndice A derrubaram, cada uma, o caso esperado;
- o plano, aplicado do zero numa cópia limpa, dá os 11 arquivos iguais ao fim do ensaio, byte a byte;
- a guarda do diff (FASE 9.4, passo 4) saiu vazia: nada do `/publicar`, da fila, das automações, do
  `scripts/migrar.mjs`, das migrações nem do `arte-slides.ts`, e nada fora das pastas da etapa.

O ensaio achou estas coisas, já resolvidas neste plano:
1. **O "Só texto" só entra na frase quando resolve.** A spec dizia que o slide com foto ganha "ou
   marque "Só texto"". Mas o slide cujo texto não cabe nem sem o espaço continua cortado com a caixa
   marcada, e a palavra comprida da prova é desse caso. A frase oferece o "Só texto" só ao slide com
   foto cujo texto cabe sem o espaço, como o aviso do card já faz; por isso a falta e a recusa levam
   também `soTextoResolve`. A spec registra isso em `a441c7b`.
2. **Um caso de integração a mais:** o slide marcado "Só texto" cujo texto cabe sem o espaço publica
   (FASE 9.2). Sem ele, nenhum caso pegava o servidor medindo o "Só texto" com o espaço (a mutação
   "9.2: o servidor conta o só texto com o espaço", Apêndice A).
3. **Casos que passam antes do código, de propósito**, porque provam o que não pode travar: na FASE 9.2,
   os dois que publicam (o slide pronto e o "Só texto" que cabe); na FASE 9.3, "marcar Só texto...
   destrava" e "com o slide pronto do Canva, o mesmo texto não trava". Cada um tem uma mutação que o
   derruba (Apêndice A). O caso "a recusa nao_cabe do servidor aparece junto do botão" também passa
   antes, porque a recusa veio na FASE 9.2 e o card a mostra como as outras; ele não tem mutação, porque
   esta etapa não muda esse caminho.
4. **As medidas dos textos dos testes**, feitas no ensaio com `tamanhoDoSlide`: oito linhas de 20 "x"
   no slide de conteúdo cabem sem o espaço (degrau 74) e não cabem com ele (piso 34); trinta linhas de
   17 "x" e a palavra de 71 letras não cabem em nenhum modo, no gancho, no conteúdo e no post.
5. **A cópia de ensaio derruba `registro-de-migracoes`** (7 casos: o script recusa `--a-mao` sem o
   `.env.local`, que a cópia não tem), e o **`next build` do `verify` (Turbopack) não roda na cópia**,
   que tem o `node_modules` por junção. Na árvore do projeto os dois rodam (FASE 9.4).
6. **Uma integração de cada vez.** Duas rodadas ao mesmo tempo no mesmo container derrubam o schema
   uma da outra (o item 11 do plano da Etapa 7).

## Restrições globais

Valem para todas as fases, sem precisar repetir em cada uma.

- **Branch:** `carrossel-que-nao-cabe`, saída da `main` em `c0c635c` (o PR #10 mergeado), sem upstream.
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
  e varra depois. Se a varredura acusar fim de linha misturado, converta a cópia inteira para LF.
- **Pastas da etapa:** `app/bonus/` e `lib/bonus/`; fora delas, só testes e `docs/`. **Nenhum arquivo
  do `/publicar`, da fila, das automações, do `scripts/migrar.mjs`, das migrações nem do
  `lib/bonus/arte-slides.ts` muda** (a conta é a combinada com o Labs; a FASE 9.4 confere).
- **Sem migração.** O build do merge tem de dizer "Nada a aplicar: as 18 migrações".
- **Sufixo de teste é o que decide se ele roda:** `tests/**/*.test.ts` (puro, entra no `verify`),
  `testes-integracao/**/*.integracao.ts` (banco, fora do `verify`), `testes-dom/**/*.dom.tsx`
  (tela, entra no `verify`).
- **Uma rodada de integração de cada vez** (item 6 do ensaio).
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
  77). O preview usa o banco e o bucket de produção: lá, criar um carrossel, salvar, subir imagem,
  agendar e cancelar gravam em produção. Avisar o auditor com a hora antes de cada gravação.
- **Ao fechar cada fase**, avisar o auditor (sessão `metodochat-ba` em 08/10; conferir o nome no
  `ListAgents`, porque ele muda a cada reinício) com o hash e o que conferir. Não esperar a
  resposta para seguir.

## Mapa dos arquivos

| arquivo | responsabilidade | fase |
|---|---|---|
| `lib/bonus/publicar-cabimento.ts` | a regra: o corte de cada slide no modo em que ele sai, se o "Só texto" resolve, a lista do servidor e o corte do card | 9.1 |
| `lib/bonus/publicar-textos.ts`, `lib/bonus/publicar-processo.ts` | a frase, a recusa `nao_cabe`, e a conferência no `publicarNaFila` | 9.2 |
| `lib/bonus/publicar-estado.ts`, `lib/bonus/publicar-textos.ts`, `app/bonus/[id]/carrossel/[cid]/card-publicar.tsx`, `card-da-parte.tsx`, `editor-do-carrossel.tsx` | a falta `nao_cabe`, o card que avisa, o editor que junta, e o botão travado | 9.3 |

---

## ETAPA 9 — o slide que não cabe não sai

### FASE 9.0 — Começar da main certa

- [ ] **Passo 1: conferir a main e a branch**

```bash
git ls-remote origin refs/heads/main
git switch carrossel-que-nao-cabe
git log --oneline -5
node -e 'console.log(require("./node_modules/next/package.json").version)'
```

Esperado: a `main` em `c0c635c` (ou depois dele); a branch com os commits da spec e este plano sobre
`c0c635c`; o `node_modules` na 16.3.8. Se a `main` andou, rebaseie a branch nela antes de seguir
(`git fetch origin main && git rebase origin/main`), e rode `npm ci` se o lock mudou.

- [ ] **Passo 2: a linha de base**

```bash
npm test
npm run test:dom
npm run banco:teste
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npm run test:integracao
```

Esperado: 107 arquivos e 3 099 casos puros; 22 e 184 de tela; `[rede-global] ALVO: banco de TESTE`,
42 arquivos, 441 passaram e 8 pularam.

---

### FASE 9.1 — A regra do slide que sai cortado

**Arquivos:**
- Criar: `lib/bonus/publicar-cabimento.ts`
- Testar: `tests/bonus-publicar-cabimento.test.ts` (novo)

**Interfaces:**
- Consome: `tamanhoDoSlide(s, comIlustracao)` e `slidesDoTexto(texto)` (`lib/bonus/arte-slides.ts`);
  `textoDosCampos(total, valores)` (`lib/bonus/arte-cabimento.ts`); `artesParaPublicar({ total,
  soTexto, imagens })` (`lib/bonus/publicar-estado.ts`); o tipo `JeitoDaImagem`.
- Produz: `type Corte = "encurtar" | "so_texto_resolve"`; `type ArteQueSai = { numero: number;
  comFoto: boolean }`; `type SlidesCortados = { slides: number[]; soTextoResolve: number[] }`;
  `corteDoSlide(s: SlideParaArte, arte: { comFoto: boolean } | null): Corte | null`;
  `juntarCortes(cortes: Record<number, Corte | null>): SlidesCortados`;
  `slidesQueSaemCortados(slides: SlideParaArte[], artes: ArteQueSai[]): SlidesCortados` (o servidor);
  `corteDoCard(p: { total; numero; valores; soTexto: boolean; jeito: JeitoDaImagem | null }): Corte | null`
  (a tela).

- [ ] **Passo 1: o teste**

Crie `tests/bonus-publicar-cabimento.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { textoDosCampos } from "@/lib/bonus/arte-cabimento";
import { slidesDoTexto } from "@/lib/bonus/arte-slides";
import { corteDoCard, corteDoSlide, juntarCortes, slidesQueSaemCortados } from "@/lib/bonus/publicar-cabimento";

// O SLIDE QUE SAI CORTADO NÃO SAI (spec da Etapa 9, achado 87): a conta da arte (`tamanhoDoSlide`), no
// modo em que cada slide sai na imagem publicada. O "Só texto" sai sem o espaço da imagem, o com foto
// sai com ele, e o slide pronto do Canva sai com a imagem dele: nunca conta.

const VALORES = {
  gancho: "Seu cliente sumiu? Não é culpa dele.",
  slide_1_titulo: "O que fazer primeiro",
  slide_1_texto: "Mande uma mensagem curta, lembrando do que ele comprou.",
  chamada: "Comente SUMIDO e receba as mensagens prontas.",
  legenda: "x".repeat(100),
};
/** Um corpo que cabe sem o espaço da imagem e não cabe com ele (o de tests/bonus-arte-cabimento.test.ts). */
const OITO_LINHAS = Array(8).fill("x".repeat(20)).join("\n");
/** Um corpo que não cabe nem sem o espaço da imagem. */
const TRINTA_LINHAS = Array(30).fill("x".repeat(17)).join("\n");
/** Uma palavra de 71 letras, sem espaço, como a da prova da Etapa 8: mais larga que a linha em todo degrau. */
const PALAVRA_DA_PROVA = "x".repeat(71);

/** O slide 2 (o primeiro de conteúdo) de um carrossel de 3, com o corpo dado. */
const slide2 = (texto: string) => slidesDoTexto(textoDosCampos(3, { ...VALORES, slide_1_texto: texto }))[1];
const SO_TEXTO = { comFoto: false };
const COM_FOTO = { comFoto: true };

describe("o corte de um slide, no modo em que ele sai", () => {
  it("o só texto que não cabe sem o espaço sai cortado, e só encurtar resolve", () => {
    expect(corteDoSlide(slide2(TRINTA_LINHAS), SO_TEXTO)).toBe("encurtar");
  });

  it("o só texto que cabe sem o espaço não sai cortado, mesmo sem caber com ele", () => {
    expect(corteDoSlide(slide2(OITO_LINHAS), SO_TEXTO)).toBeNull();
  });

  it("o com foto que não cabe com o espaço sai cortado, e marcar Só texto resolve", () => {
    expect(corteDoSlide(slide2(OITO_LINHAS), COM_FOTO)).toBe("so_texto_resolve");
  });

  it("o com foto que não cabe nem sem o espaço sai cortado, e só encurtar resolve", () => {
    expect(corteDoSlide(slide2(TRINTA_LINHAS), COM_FOTO)).toBe("encurtar");
  });

  it("o com foto que cabe com o espaço passa", () => {
    expect(corteDoSlide(slide2(VALORES.slide_1_texto), COM_FOTO)).toBeNull();
  });

  it("o slide pronto do Canva nunca sai cortado, mesmo com o texto que não cabe", () => {
    expect(corteDoSlide(slide2(TRINTA_LINHAS), null)).toBeNull();
    expect(corteDoSlide(slide2(PALAVRA_DA_PROVA), null)).toBeNull();
  });

  it("a palavra de 71 letras da prova sai cortada nos dois modos, no gancho, no conteúdo e no post", () => {
    const gancho = slidesDoTexto(textoDosCampos(3, { ...VALORES, gancho: PALAVRA_DA_PROVA }))[0];
    const post = slidesDoTexto(textoDosCampos(1, { texto: PALAVRA_DA_PROVA, chamada: "Salve este post.", legenda: "x" }))[0];
    for (const s of [gancho, slide2(PALAVRA_DA_PROVA), post]) {
      expect(corteDoSlide(s, SO_TEXTO)).toBe("encurtar");
      expect(corteDoSlide(s, COM_FOTO)).toBe("encurtar");
    }
  });
});

describe("os slides que sairiam cortados num carrossel", () => {
  const CINCO = {
    gancho: PALAVRA_DA_PROVA,
    slide_1_titulo: "Primeiro",
    slide_1_texto: OITO_LINHAS,
    slide_2_titulo: "Segundo",
    slide_2_texto: OITO_LINHAS,
    slide_3_titulo: "Terceiro",
    slide_3_texto: TRINTA_LINHAS,
    chamada: VALORES.chamada,
    legenda: VALORES.legenda,
  };

  // O 1 é só texto (a palavra), o 2 tem foto (oito linhas), o 3 é slide pronto (oito linhas, não conta),
  // o 4 tem foto (trinta linhas) e o 5 é só texto (cabe).
  it("só os que saem com a arte do Chat contam, em ordem, com os que Só texto resolve", () => {
    const artes = [
      { numero: 1, comFoto: false },
      { numero: 2, comFoto: true },
      { numero: 4, comFoto: true },
      { numero: 5, comFoto: false },
    ];
    expect(slidesQueSaemCortados(slidesDoTexto(textoDosCampos(5, CINCO)), artes)).toEqual({ slides: [1, 2, 4], soTextoResolve: [2] });
  });

  it("nada cortado: as duas listas vazias", () => {
    const artes = [
      { numero: 1, comFoto: false },
      { numero: 2, comFoto: true },
    ];
    expect(slidesQueSaemCortados(slidesDoTexto(textoDosCampos(3, VALORES)), artes)).toEqual({ slides: [], soTextoResolve: [] });
  });
});

describe("o corte do slide de um card, com o texto dos campos dele", () => {
  const card2 = (texto: string) => ({ slide_1_titulo: VALORES.slide_1_titulo, slide_1_texto: texto });

  it("com a foto no espaço, conta com o espaço", () => {
    expect(corteDoCard({ total: 3, numero: 2, valores: card2(OITO_LINHAS), soTexto: false, jeito: "foto" })).toBe("so_texto_resolve");
  });

  it("marcado Só texto, conta sem o espaço, e a foto guardada não conta", () => {
    expect(corteDoCard({ total: 3, numero: 2, valores: card2(OITO_LINHAS), soTexto: true, jeito: "foto" })).toBeNull();
    expect(corteDoCard({ total: 3, numero: 2, valores: card2(TRINTA_LINHAS), soTexto: true, jeito: null })).toBe("encurtar");
  });

  it("com o slide pronto do Canva, ou ainda sem imagem, não conta", () => {
    expect(corteDoCard({ total: 3, numero: 2, valores: card2(TRINTA_LINHAS), soTexto: false, jeito: "slide" })).toBeNull();
    expect(corteDoCard({ total: 3, numero: 2, valores: card2(TRINTA_LINHAS), soTexto: false, jeito: null })).toBeNull();
  });

  it("no post, o texto e a chamada são do mesmo card", () => {
    const valores = { texto: PALAVRA_DA_PROVA, chamada: "Salve este post." };
    expect(corteDoCard({ total: 1, numero: 1, valores, soTexto: false, jeito: "foto" })).toBe("encurtar");
  });
});

describe("o que os cards avisaram, na forma da falta", () => {
  it("em ordem, sem os que deixaram de cortar, e com os que Só texto resolve", () => {
    expect(juntarCortes({ 4: "encurtar", 2: "so_texto_resolve", 3: null })).toEqual({ slides: [2, 4], soTextoResolve: [2] });
    expect(juntarCortes({})).toEqual({ slides: [], soTextoResolve: [] });
  });
});
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-publicar-cabimento.test.ts
```

Esperado: o arquivo cai sem rodar caso nenhum, porque `lib/bonus/publicar-cabimento.ts` não existe.

- [ ] **Passo 3: o código**

Crie `lib/bonus/publicar-cabimento.ts`:

```ts
// O SLIDE QUE SAI CORTADO NÃO SAI (spec da Etapa 9, achado 87). PURO: o card de cada slide, o card
// "Publicar" e o servidor contam aqui, pela mesma regra.
//
// A REGRA QUE VEIO DO LABS, "AVISA, NUNCA IMPEDE" (`slidesQueNaoCabem`, arte-slides.ts), continua
// valendo no editor: o card avisa, e salvar um slide que não cabe continua permitido. No publicar e no
// agendar ela deixa de valer (decisão do Eduardo em 08/10): ali o aviso vira uma imagem cortada na rede
// social, e um post não se desfaz. O arte-slides.ts não muda: a conta é a combinada com o Labs.
//
// A CONTA É A MESMA DO AVISO (`tamanhoDoSlide`), feita no modo em que o slide sai: o "Só texto" sem o
// espaço da imagem, e o com foto com o espaço. O slide pronto do Canva sai com a imagem dele, e não com
// a arte: nunca conta. O slide com espaço e sem imagem também não, porque o publicar já o recusa pela
// imagem que falta. Por isso o slide que o botão barra é sempre um slide que o card avisa.
import { textoDosCampos } from "./arte-cabimento";
import { slidesDoTexto, tamanhoDoSlide, type SlideParaArte } from "./arte-slides";
import { artesParaPublicar } from "./publicar-estado";
import type { JeitoDaImagem } from "./publicar-regras";

/**
 * COMO UM SLIDE SAI CORTADO: só encurtar resolve, ou marcar "Só texto" também resolve (o slide com foto
 * cujo texto cabe sem o espaço). A frase muda com isso: no "Só texto" a caixa já está marcada, e no
 * slide que não cabe nem sem o espaço ela não resolve.
 */
export type Corte = "encurtar" | "so_texto_resolve";

/** Um slide que sai com a arte do Chat (`artesParaPublicar`): o "Só texto" e o com foto no espaço. */
export type ArteQueSai = { numero: number; comFoto: boolean };

/** O corte de um slide no modo em que ele sai. Sem arte (o slide pronto, ou ainda sem imagem): nunca. */
export function corteDoSlide(s: SlideParaArte, arte: { comFoto: boolean } | null): Corte | null {
  if (arte === null || tamanhoDoSlide(s, arte.comFoto).cabe) return null;
  return arte.comFoto && tamanhoDoSlide(s, false).cabe ? "so_texto_resolve" : "encurtar";
}

/** Os slides que sairiam cortados, em ordem, e os que "Só texto" resolve: a forma da falta e da recusa. */
export type SlidesCortados = { slides: number[]; soTextoResolve: number[] };

/** Os cortes por número do slide, juntados na forma da falta. O `null` é o slide que não corta. */
export function juntarCortes(cortes: Record<number, Corte | null>): SlidesCortados {
  const slides = Object.keys(cortes)
    .map(Number)
    .filter((n) => cortes[n])
    .sort((a, b) => a - b);
  return { slides, soTextoResolve: slides.filter((n) => cortes[n] === "so_texto_resolve") };
}

/** NO SERVIDOR: os slides do texto salvo, e as artes que saem, como o publicar as conta. */
export function slidesQueSaemCortados(slides: SlideParaArte[], artes: ArteQueSai[]): SlidesCortados {
  const cortes: Record<number, Corte | null> = {};
  for (const a of artes) {
    const s = slides[a.numero - 1];
    cortes[a.numero] = s ? corteDoSlide(s, a) : null;
  }
  return juntarCortes(cortes);
}

/**
 * NA TELA: o corte do slide de um card, com o texto que está nos campos dele agora, o "Só texto" e o
 * jeito da imagem guardada. O botão "Publicar" já trava com qualquer card "não salvo": quando ele está
 * livre, o texto dos campos é o salvo, e a tela conta sobre o mesmo texto que o servidor.
 */
export function corteDoCard(p: {
  total: number;
  numero: number;
  valores: Record<string, string>;
  soTexto: boolean;
  jeito: JeitoDaImagem | null;
}): Corte | null {
  const s = slidesDoTexto(textoDosCampos(p.total, p.valores))[p.numero - 1];
  const arte = artesParaPublicar({
    total: p.total,
    soTexto: p.soTexto ? [p.numero] : [],
    imagens: p.jeito ? { [p.numero]: { jeito: p.jeito } } : {},
  }).find((a) => a.numero === p.numero);
  return s ? corteDoSlide(s, arte ?? null) : null;
}
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx eslint lib/bonus/publicar-cabimento.ts tests/bonus-publicar-cabimento.test.ts
npx vitest run tests/bonus-publicar-cabimento.test.ts
```

Esperado: `tsc` e lint limpos; os 14 passam.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/publicar-cabimento.ts tests/bonus-publicar-cabimento.test.ts
test "$(git branch --show-current)" = "carrossel-que-nao-cabe"
git add lib/bonus/publicar-cabimento.ts tests/bonus-publicar-cabimento.test.ts
git commit -m "feat(bonus): a regra do slide que sai cortado na imagem publicada"
```

---

### FASE 9.2 — A frase, a recusa e a conferência no servidor

**Arquivos:**
- Modificar: `lib/bonus/publicar-textos.ts` (a frase e a recusa), `lib/bonus/publicar-processo.ts` (a
  conferência)
- Testar: `tests/bonus-publicar-estado.test.ts`, `testes-integracao/bonus-publicar-processo.integracao.ts`

**Interfaces:**
- Consome: `slidesQueSaemCortados` (FASE 9.1); em `publicarNaFila`, `desenhados`, `fotoDe` e
  `descartar`, que já existem.
- Produz: `textoDoSlideQueNaoCabe(slides: number[], soTextoResolve: number[]): string`; a recusa
  `{ motivo: "nao_cabe"; slides: number[]; soTextoResolve: number[] }` em
  `RecusaDaPublicacaoDoCarrossel`, com a frase de `textoDoSlideQueNaoCabe`. A conferência entra logo
  depois da recusa `caminho_na_fila` e antes da conferência das artes.

- [ ] **Passo 1: os testes**

Em `tests/bonus-publicar-estado.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-publicar-estado.test.ts b/tests/bonus-publicar-estado.test.ts
index 6192ab6..9b0f0ab 100644
--- a/tests/bonus-publicar-estado.test.ts
+++ b/tests/bonus-publicar-estado.test.ts
@@ -20,6 +20,7 @@ import {
   textoDoEstadoDaPublicacao,
   textoDoFunil,
   textoDoProblemaDaFoto,
+  textoDoSlideQueNaoCabe,
   tomDoEstadoDaPublicacao,
   type RecusaDaPublicacaoDoCarrossel,
 } from "@/lib/bonus/publicar-textos";
@@ -263,6 +264,7 @@ describe("as recusas da publicação têm frase, cada uma", () => {
     { motivo: "arte_so_texto", numero: 5 },
     { motivo: "arte_velha", numero: 5 },
     { motivo: "caminho_na_fila" },
+    { motivo: "nao_cabe", slides: [2], soTextoResolve: [] },
     { motivo: "legenda", texto: "A legenda passa de 2.200 caracteres." },
     { motivo: "quantidade", texto: "Um carrossel precisa de pelo menos duas mídias." },
     { motivo: "copia", numero: 2 },
@@ -290,6 +292,38 @@ describe("as recusas da publicação têm frase, cada uma", () => {
   });
 });
 
+// O SLIDE QUE SAIRIA CORTADO (spec da Etapa 9): a mesma frase no card "Publicar" e na recusa do
+// servidor. O "Só texto" entra só para o slide com foto cujo texto cabe sem o espaço: no "Só texto" a
+// caixa já está marcada, e no que não cabe nem sem o espaço ela não resolve.
+describe("a frase do slide que sairia cortado", () => {
+  it("diz o slide e manda encurtar", () => {
+    expect(textoDoSlideQueNaoCabe([2], [])).toBe("O texto do slide 2 não cabe na arte e sairia cortado. Encurte o texto.");
+    expect(textoDoSlideQueNaoCabe([2, 5], [])).toBe("O texto dos slides 2 e 5 não cabe na arte e sairia cortado. Encurte o texto.");
+  });
+
+  it("no slide com foto que cabe sem o espaço, oferece o Só texto", () => {
+    expect(textoDoSlideQueNaoCabe([2], [2])).toBe('O texto do slide 2 não cabe na arte e sairia cortado. Encurte o texto ou marque "Só texto".');
+    expect(textoDoSlideQueNaoCabe([2, 4], [2, 4])).toBe(
+      'O texto dos slides 2 e 4 não cabe na arte e sairia cortado. Encurte o texto ou marque "Só texto".'
+    );
+  });
+
+  it("com os dois casos juntos, diz em qual o Só texto resolve", () => {
+    expect(textoDoSlideQueNaoCabe([1, 2, 4], [2])).toBe(
+      'O texto dos slides 1, 2 e 4 não cabe na arte e sairia cortado. Encurte o texto ou, no slide 2, marque "Só texto".'
+    );
+    expect(textoDoSlideQueNaoCabe([1, 2, 4], [2, 4])).toBe(
+      'O texto dos slides 1, 2 e 4 não cabe na arte e sairia cortado. Encurte o texto ou, nos slides 2 e 4, marque "Só texto".'
+    );
+  });
+
+  it("a recusa do servidor tem a mesma frase", () => {
+    expect(textoDaRecusaDaPublicacaoDoCarrossel({ motivo: "nao_cabe", slides: [1, 2], soTextoResolve: [2] })).toBe(
+      textoDoSlideQueNaoCabe([1, 2], [2])
+    );
+  });
+});
+
 describe("a cor do estado na página", () => {
   it("verde no agendado e no publicado; amarelo no publicando, cancelado e não entrou; vermelho no resto", () => {
     expect(tomDoEstadoDaPublicacao({ tipo: "livre" })).toBeNull();
```

Em `testes-integracao/bonus-publicar-processo.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/bonus-publicar-processo.integracao.ts b/testes-integracao/bonus-publicar-processo.integracao.ts
index f21145d..9547758 100644
--- a/testes-integracao/bonus-publicar-processo.integracao.ts
+++ b/testes-integracao/bonus-publicar-processo.integracao.ts
@@ -677,3 +677,76 @@ describe("publicar o carrossel sem palavra-chave", () => {
     expect(travado.ok ? null : travado.recusa.motivo).toBe("travado");
   });
 });
+
+// O SLIDE QUE SAI CORTADO NÃO SAI (spec da Etapa 9, achado 87): o publicar e o agendar contam a arte no
+// modo em que cada slide sai, depois de as artes subirem. Na recusa elas saem do bucket, nada é
+// reservado e nada entra na fila. O slide pronto do Canva sai com a imagem dele, e não conta.
+describe("publicar com um slide que sai cortado", () => {
+  /** Cabe sem o espaço da imagem e não cabe com ele (o de tests/bonus-arte-cabimento.test.ts). */
+  const OITO_LINHAS = Array(8).fill("x".repeat(20)).join("\n");
+  const CORTADO: TextoDeCarrossel = { ...TEXTO, slides: [{ titulo: "Título do slide 1", texto: OITO_LINHAS }, slide(2), slide(3)] };
+  const desenho = (texto: TextoDeCarrossel, n: number, foto: string | null) =>
+    regras.versaoDoDesenho(slides.slidesDoTexto(texto)[n - 1], foto);
+
+  /** O slide 2 com a foto no espaço e o texto de oito linhas; o 3 e o 4 com o slide pronto; o 1 e o 5 só texto. */
+  async function comFotoNoSlide2() {
+    const id = await carrossel(ARTE, CORTADO);
+    const foto = await subir(id, 2, "foto");
+    await processo.guardarImagem({ id, numero: 2, caminho: foto, contas });
+    for (const n of [3, 4]) await processo.guardarImagem({ id, numero: n, caminho: await subir(id, n, "slide"), contas });
+    const artes = [
+      { numero: 1, caminho: await subir(id, 1, "fila"), versao: desenho(CORTADO, 1, null) },
+      { numero: 2, caminho: await subir(id, 2, "fila"), versao: desenho(CORTADO, 2, foto) },
+      { numero: 5, caminho: await subir(id, 5, "fila"), versao: desenho(CORTADO, 5, null) },
+    ];
+    return { id, artes };
+  }
+
+  it.each([
+    ["agora", null],
+    ["agendado", new Date(Date.now() + 7 * 86_400_000)],
+  ])("%s: recusa com o slide, as artes subidas saem do bucket, e nada é reservado nem entra na fila", async (_nome, quando) => {
+    const { id, artes } = await comFotoNoSlide2();
+    const r = await processo.publicarNaFila({ id, quando, artes, contas, drenar });
+    expect(r.ok ? null : r.recusa).toEqual({ motivo: "nao_cabe", slides: [2], soTextoResolve: [2] });
+    for (const a of artes) expect(bucket.objetos.has(a.caminho)).toBe(false);
+    expect(daFila()).toEqual([]);
+    expect(await fila()).toEqual([]);
+    expect(regras.publicacaoDaArte(await arteDe(id))).toBeNull();
+    expect(drenagens).toBe(0);
+  });
+
+  it("o mesmo carrossel, com o slide pronto do Canva no slide 2, publica", async () => {
+    const id = await carrossel(ARTE, CORTADO);
+    for (const n of [2, 3, 4]) await processo.guardarImagem({ id, numero: n, caminho: await subir(id, n, "slide"), contas });
+    const artes = await Promise.all(
+      [1, 5].map(async (n) => ({ numero: n, caminho: await subir(id, n, "fila"), versao: desenho(CORTADO, n, null) }))
+    );
+    expect(await processo.publicarNaFila({ id, quando: null, artes, contas, drenar })).toEqual({ ok: true, quando: null });
+    expect(await fila()).toHaveLength(1);
+  });
+
+  it("o mesmo carrossel, com o slide 2 marcado só texto, publica: sem o espaço, o texto cabe", async () => {
+    const id = await carrossel({ ...ARTE, soTexto: [1, 2, 5] }, CORTADO);
+    for (const n of [3, 4]) await processo.guardarImagem({ id, numero: n, caminho: await subir(id, n, "slide"), contas });
+    const artes = await Promise.all(
+      [1, 2, 5].map(async (n) => ({ numero: n, caminho: await subir(id, n, "fila"), versao: desenho(CORTADO, n, null) }))
+    );
+    expect(await processo.publicarNaFila({ id, quando: null, artes, contas, drenar })).toEqual({ ok: true, quando: null });
+    expect(await fila()).toHaveLength(1);
+  });
+
+  it("o só texto que não cabe nem sem o espaço é recusado, e só encurtar resolve", async () => {
+    // A palavra de 71 letras, sem espaço, como a da prova da Etapa 8, no gancho (o slide 1, só texto).
+    const texto: TextoDeCarrossel = { ...TEXTO, gancho: "x".repeat(71) };
+    const id = await carrossel(ARTE, texto);
+    for (const n of [2, 3, 4]) await processo.guardarImagem({ id, numero: n, caminho: await subir(id, n, "slide"), contas });
+    const artes = await Promise.all(
+      [1, 5].map(async (n) => ({ numero: n, caminho: await subir(id, n, "fila"), versao: desenho(texto, n, null) }))
+    );
+    const r = await processo.publicarNaFila({ id, quando: null, artes, contas, drenar });
+    expect(r.ok ? null : r.recusa).toEqual({ motivo: "nao_cabe", slides: [1], soTextoResolve: [] });
+    expect(daFila()).toEqual([]);
+    expect(await fila()).toEqual([]);
+  });
+});
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-publicar-estado.test.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-publicar-processo.integracao.ts
```

Esperado: nos puros, 5 caem e 43 passam (48): a frase não existe, e a recusa nova não tem frase. Na
integração, `[rede-global] ALVO: banco de TESTE`; 3 caem e 43 passam (46): as duas recusas (agora e
agendado) e a do "Só texto" que não cabe nem sem o espaço. Os dois casos que publicam passam antes do
código, de propósito (item 3 do ensaio).

- [ ] **Passo 3: o código**

Em `lib/bonus/publicar-textos.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/publicar-textos.ts b/lib/bonus/publicar-textos.ts
index c5f4ef3..78cb6ef 100644
--- a/lib/bonus/publicar-textos.ts
+++ b/lib/bonus/publicar-textos.ts
@@ -15,6 +15,7 @@ export function listaDeSlides(numeros: number[]): string {
 }
 
 const doSlides = (numeros: number[]) => listaDeSlides(numeros).replace(/^os /, "dos ").replace(/^o /, "do ");
+const noSlides = (numeros: number[]) => listaDeSlides(numeros).replace(/^os /, "nos ").replace(/^o /, "no ");
 
 /** O estado no lugar do botão "Publicar". `null` quando o carrossel nunca foi mandado. */
 export function textoDoEstadoDaPublicacao(e: EstadoDaPublicacao): string | null {
@@ -138,6 +139,19 @@ export function textoDaArteQueNaoVeio(numero: number): string {
   return `Não consegui preparar a arte do slide ${numero}. Recarregue a página e publique de novo.`;
 }
 
+/**
+ * O SLIDE QUE SAIRIA CORTADO (spec da Etapa 9): a mesma frase no card "Publicar" e na recusa do
+ * servidor. O "Só texto" entra só para o slide com foto cujo texto cabe sem o espaço
+ * (publicar-cabimento.ts): no "Só texto" a caixa já está marcada, e no que não cabe nem sem o espaço
+ * ela não resolve.
+ */
+export function textoDoSlideQueNaoCabe(slides: number[], soTextoResolve: number[]): string {
+  const frase = `O texto ${doSlides(slides)} não cabe na arte e sairia cortado. Encurte o texto`;
+  if (!soTextoResolve.length) return `${frase}.`;
+  if (soTextoResolve.length === slides.length) return `${frase} ou marque "Só texto".`;
+  return `${frase} ou, ${noSlides(soTextoResolve)}, marque "Só texto".`;
+}
+
 export function textoDaFalta(f: FaltaParaPublicar): string {
   switch (f.tipo) {
     case "sem_conta":
@@ -196,6 +210,7 @@ export type RecusaDaPublicacaoDoCarrossel =
   | { motivo: "arte_so_texto"; numero: number }
   | { motivo: "arte_velha"; numero: number }
   | { motivo: "caminho_na_fila" }
+  | { motivo: "nao_cabe"; slides: number[]; soTextoResolve: number[] }
   | { motivo: "legenda"; texto: string }
   | { motivo: "quantidade"; texto: string }
   | { motivo: "copia"; numero: number }
@@ -237,6 +252,8 @@ export function textoDaRecusaDaPublicacaoDoCarrossel(r: RecusaDaPublicacaoDoCarr
       return `O slide ${r.numero} mudou enquanto a arte era preparada. Publique de novo.`;
     case "caminho_na_fila":
       return "Uma das imagens já está na fila de outro post. Recarregue a página e publique de novo.";
+    case "nao_cabe":
+      return textoDoSlideQueNaoCabe(r.slides, r.soTextoResolve);
     case "legenda":
     case "quantidade":
       return r.texto;
```

Em `lib/bonus/publicar-processo.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/publicar-processo.ts b/lib/bonus/publicar-processo.ts
index b272180..1cac718 100644
--- a/lib/bonus/publicar-processo.ts
+++ b/lib/bonus/publicar-processo.ts
@@ -19,6 +19,7 @@ import { lerCarrossel } from "./carrossel-repositorio";
 import { textoDaLinhaDoCarrossel } from "./carrossel-tela";
 import type { TextoDoCarrossel } from "./carrossel-texto";
 import { apagarSemDerrubar, assinarCaminho, copiarTodasParaAFila } from "./publicar-bucket";
+import { slidesQueSaemCortados } from "./publicar-cabimento";
 import { publicacaoLivre } from "./publicar-estado";
 import {
   caminhosNaFila,
@@ -198,6 +199,14 @@ export async function publicarNaFila(p: {
     await descartar();
     return recusa({ motivo: "caminho_na_fila" });
   }
+  // O SLIDE QUE SAI CORTADO NÃO SAI (spec da Etapa 9, achado 87): a conta da arte no modo em que cada
+  // slide sai, sobre o texto salvo. Vem depois do `descartar`, para as artes que o navegador subiu
+  // saírem do bucket na recusa, e antes de conferir as artes, reservar e enfileirar.
+  const cortados = slidesQueSaemCortados(c.slides, desenhados.map((n) => ({ numero: n, comFoto: fotoDe(n) !== null })));
+  if (cortados.slides.length) {
+    await descartar();
+    return recusa({ motivo: "nao_cabe", ...cortados });
+  }
   const artes = new Map<number, string>();
   for (const a of p.artes) {
     if (!desenhados.includes(a.numero)) {
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx eslint lib/bonus/publicar-textos.ts lib/bonus/publicar-processo.ts tests/bonus-publicar-estado.test.ts testes-integracao/bonus-publicar-processo.integracao.ts
npx vitest run tests/bonus-publicar-estado.test.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/bonus-publicar-processo.integracao.ts
```

Esperado: `tsc` e lint limpos; os 48 puros passam; `[rede-global] ALVO: banco de TESTE`, e os 46
passam.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/publicar-textos.ts lib/bonus/publicar-processo.ts tests/bonus-publicar-estado.test.ts testes-integracao/bonus-publicar-processo.integracao.ts
test "$(git branch --show-current)" = "carrossel-que-nao-cabe"
git add lib/bonus/publicar-textos.ts lib/bonus/publicar-processo.ts tests/bonus-publicar-estado.test.ts testes-integracao/bonus-publicar-processo.integracao.ts
git commit -m "feat(bonus): o publicar e o agendar recusam o slide que sai cortado"
```

---

### FASE 9.3 — O botão "Publicar" trava com o slide que sairia cortado

**Arquivos:**
- Modificar: `lib/bonus/publicar-estado.ts` (a falta), `lib/bonus/publicar-textos.ts` (a frase da
  falta), `app/bonus/[id]/carrossel/[cid]/card-publicar.tsx` (a prop `cortados`),
  `app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx` (o corte do card e o aviso ao editor),
  `app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx` (os cortes juntados)
- Testar: `tests/bonus-publicar-estado.test.ts`, `testes-dom/bonus-card-publicar.dom.tsx`

**Interfaces:**
- Consome: `corteDoCard`, `juntarCortes`, `Corte` e `SlidesCortados` (FASE 9.1);
  `textoDoSlideQueNaoCabe` (FASE 9.2).
- Produz: a falta `{ tipo: "nao_cabe"; slides: number[]; soTextoResolve: number[] }` em
  `FaltaParaPublicar`, depois das imagens e antes do "não salvo"; o parâmetro obrigatório
  `cortados: SlidesCortados` em `faltasParaPublicar` e na prop do `CardPublicar`; a prop opcional
  `aoMudarCorte?: (corte: Corte | null) => void` no `CardDaParte`.

- [ ] **Passo 1: os testes**

Em `tests/bonus-publicar-estado.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/bonus-publicar-estado.test.ts b/tests/bonus-publicar-estado.test.ts
index 9b0f0ab..67bf302 100644
--- a/tests/bonus-publicar-estado.test.ts
+++ b/tests/bonus-publicar-estado.test.ts
@@ -170,6 +170,7 @@ describe("o que falta para publicar", () => {
     origem: "gravada" as const,
     slidesNaoSalvos: [],
     legendaNaoSalva: false,
+    cortados: { slides: [], soTextoResolve: [] },
   };
 
   it("nada falta quando todo slide com espaço tem imagem e nada está sem salvar", () => {
@@ -194,6 +195,16 @@ describe("o que falta para publicar", () => {
     ]);
   });
 
+  // O SLIDE QUE SAIRIA CORTADO (spec da Etapa 9): depois das imagens, porque a imagem do slide decide o
+  // modo da conta, e antes do não salvo, porque encurtar o texto deixa o card sem salvar.
+  it("o slide que sairia cortado, depois das imagens e antes do não salvo", () => {
+    expect(faltasParaPublicar({ ...base, cortados: { slides: [2], soTextoResolve: [2] }, slidesNaoSalvos: [3] })).toEqual([
+      { tipo: "imagens", slides: [4] },
+      { tipo: "nao_cabe", slides: [2], soTextoResolve: [2] },
+      { tipo: "nao_salvo", slides: [3], legenda: false },
+    ]);
+  });
+
   it("a conta vem antes de tudo: sem conta gravada, ou desconectada", () => {
     expect(faltasParaPublicar({ ...base, origem: "selecionada" })[0]).toEqual({ tipo: "sem_conta" });
     expect(faltasParaPublicar({ ...base, origem: "guardada" })[0]).toEqual({ tipo: "conta_desconectada" });
@@ -322,6 +333,12 @@ describe("a frase do slide que sairia cortado", () => {
       textoDoSlideQueNaoCabe([1, 2], [2])
     );
   });
+
+  it("a falta da tela tem a mesma frase da recusa", () => {
+    expect(textoDaFalta({ tipo: "nao_cabe", slides: [1, 2], soTextoResolve: [2] })).toBe(
+      textoDaRecusaDaPublicacaoDoCarrossel({ motivo: "nao_cabe", slides: [1, 2], soTextoResolve: [2] })
+    );
+  });
 });
 
 describe("a cor do estado na página", () => {
```

Em `testes-dom/bonus-card-publicar.dom.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-dom/bonus-card-publicar.dom.tsx b/testes-dom/bonus-card-publicar.dom.tsx
index 598bc56..48f924d 100644
--- a/testes-dom/bonus-card-publicar.dom.tsx
+++ b/testes-dom/bonus-card-publicar.dom.tsx
@@ -3,8 +3,10 @@ import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
 import CardPublicar from "@/app/bonus/[id]/carrossel/[cid]/card-publicar";
 import EditorDoCarrossel from "@/app/bonus/[id]/carrossel/[cid]/editor-do-carrossel";
 import type { PublicacaoNaTela } from "@/app/bonus/[id]/carrossel/[cid]/publicacao-na-tela";
+import type { AvisoDaArte } from "@/lib/bonus/arte-textos";
 import { camposDoFormulario } from "@/lib/bonus/carrossel-texto";
-import type { AvisoDaPublicacao } from "@/lib/bonus/publicar-textos";
+import type { SlidesCortados } from "@/lib/bonus/publicar-cabimento";
+import { textoDaRecusaDaPublicacaoDoCarrossel, type AvisoDaPublicacao } from "@/lib/bonus/publicar-textos";
 
 // O CARD "PUBLICAR" (spec da Etapa 5, "A página"): a conta, o "Agora" ou o "Agendar", o botão travado
 // com a frase de cada falta, o estado depois de mandar, e a página recarregada no sucesso. As actions e
@@ -21,6 +23,7 @@ const TODAS = {
   2: { url: "u2", versao: "t2", jeito: "slide" as const },
   3: { url: "u3", versao: "t3", jeito: "slide" as const },
 };
+const NADA_CORTADO: SlidesCortados = { slides: [], soTextoResolve: [] };
 
 beforeEach(() => {
   refresh.mockReset();
@@ -52,7 +55,10 @@ function publicacao(p: Partial<PublicacaoNaTela> = {}, respostas: AvisoDaPublica
   return { completa, pedidos };
 }
 
-function renderizar(p: Partial<PublicacaoNaTela> = {}, extra: { naoSalvos?: number[]; legenda?: boolean; respostas?: AvisoDaPublicacao[] } = {}) {
+function renderizar(
+  p: Partial<PublicacaoNaTela> = {},
+  extra: { naoSalvos?: number[]; legenda?: boolean; respostas?: AvisoDaPublicacao[]; cortados?: SlidesCortados } = {}
+) {
   const { completa, pedidos } = publicacao(p, extra.respostas);
   render(
     <CardPublicar
@@ -65,6 +71,7 @@ function renderizar(p: Partial<PublicacaoNaTela> = {}, extra: { naoSalvos?: numb
       versoesDaMiniatura={["a1", "b1", "c1"]}
       slidesNaoSalvos={extra.naoSalvos ?? []}
       legendaNaoSalva={extra.legenda ?? false}
+      cortados={extra.cortados ?? NADA_CORTADO}
     />
   );
   return pedidos;
@@ -114,6 +121,25 @@ describe("o card Publicar, com o carrossel livre", () => {
     expect(screen.getByText("Salve o slide 2 e a legenda antes de publicar.")).toBeTruthy();
   });
 
+  // O SLIDE QUE SAIRIA CORTADO (spec da Etapa 9): o editor passa ao card os slides que os cards avisaram.
+  it("o slide que sairia cortado trava o botão, com a frase", () => {
+    renderizar({}, { cortados: { slides: [2], soTextoResolve: [2] } });
+    expect(botao().disabled).toBe(true);
+    expect(screen.getByText('O texto do slide 2 não cabe na arte e sairia cortado. Encurte o texto ou marque "Só texto".')).toBeTruthy();
+  });
+
+  // QUEM MANDA É O SERVIDOR (spec da Etapa 9, "Na tela"): a recusa "nao_cabe" aparece junto do botão,
+  // como as outras recusas.
+  it("a recusa nao_cabe do servidor aparece junto do botão, com a frase dela", async () => {
+    const texto = textoDaRecusaDaPublicacaoDoCarrossel({ motivo: "nao_cabe", slides: [2], soTextoResolve: [] });
+    renderizar({}, { respostas: [{ tom: "erro", texto, em: 2 }] });
+    await act(async () => {
+      fireEvent.click(botao());
+    });
+    expect(screen.getByText("O texto do slide 2 não cabe na arte e sairia cortado. Encurte o texto.")).toBeTruthy();
+    expect(refresh).not.toHaveBeenCalled();
+  });
+
   it("sem conta gravada, ou com ela desconectada, o botão trava com a frase da conta", () => {
     renderizar({ origem: "selecionada" });
     expect(botao().disabled).toBe(true);
@@ -247,6 +273,7 @@ describe("as artes que vão com o pedido", () => {
         versoesDaMiniatura={["a1", "b1", "c1"]}
         slidesNaoSalvos={[]}
         legendaNaoSalva={false}
+        cortados={NADA_CORTADO}
       />
     );
     return { puts, pedidos };
@@ -325,3 +352,72 @@ describe("as artes que vão com o pedido", () => {
     expect((pedidos[0] as { artes: unknown[] }).artes).toEqual([{ numero: 1, caminho: "178/bonus-fila/1.jpg", versao: "desenho-1" }]);
   });
 });
+
+// O SLIDE QUE SAI CORTADO, PELO EDITOR (spec da Etapa 9): cada card conta o slide dele no modo em que ele
+// sai, com o texto dos campos, e avisa o editor; o editor passa a lista ao card "Publicar".
+describe("o slide que sai cortado, pelo editor", () => {
+  /** Cabe sem o espaço da imagem e não cabe com ele (o de tests/bonus-arte-cabimento.test.ts). */
+  const OITO_LINHAS = Array(8).fill("x".repeat(20)).join("\n");
+  const FRASE = 'O texto do slide 2 não cabe na arte e sairia cortado. Encurte o texto ou marque "Só texto".';
+
+  /** O slide 2 com o texto de oito linhas e a imagem do jeito dado; o 1 e o 3 com o slide pronto. */
+  function editor(jeito2: "foto" | "slide", arte: AvisoDaArte | null = null) {
+    const { completa } = publicacao({ imagens: { ...TODAS, 2: { url: "u2", versao: "t2", jeito: jeito2 } } });
+    render(
+      <EditorDoCarrossel
+        acaoDoSlide={async () => ({ tom: "ok", texto: "Slide 2 salvo.", em: 1, versao: "b2", versaoDoTexto: "t2" })}
+        acaoDaArte={async () => arte}
+        acaoDaConta={async () => null}
+        caminho={CAMINHO}
+        carrosselId={CARROSSEL}
+        palavra="SUMIDO"
+        total={3}
+        campos={camposDoFormulario(3)}
+        valores={{
+          gancho: "Seu cliente sumiu? Não é culpa dele.",
+          slide_1_titulo: "O que fazer primeiro",
+          slide_1_texto: OITO_LINHAS,
+          chamada: "Comente SUMIDO e receba as mensagens prontas.",
+          legenda: "Quem sumiu ainda pode voltar. Comente SUMIDO que eu te mando as mensagens prontas.",
+        }}
+        rotuloDaConta="Thiago Vannuchi (@thiagovannuchi)"
+        avisoDaConta={null}
+        podeFixar={false}
+        soTextoInicial={[]}
+        versoes={["a1", "b1", "c1"]}
+        pausaMs={0}
+        publicacao={completa}
+      />
+    );
+  }
+
+  it("com a foto no slide, o card que avisa trava o Publicar, e encurtar e salvar destrava", async () => {
+    editor("foto");
+    expect(screen.getByText(FRASE)).toBeTruthy();
+    expect(botao().disabled).toBe(true);
+    const card2 = screen.getAllByRole("listitem")[1];
+    fireEvent.click(within(card2).getByRole("button", { name: "Editar" }));
+    fireEvent.input(screen.getByLabelText("Slide 2: texto"), { target: { value: "Um texto curto, que cabe com a foto." } });
+    expect(screen.queryByText(FRASE)).toBeNull();
+    expect(screen.getByText("Salve o slide 2 antes de publicar.")).toBeTruthy();
+    await act(async () => {
+      fireEvent.click(screen.getByRole("button", { name: "Salvar slide 2" }));
+    });
+    expect(botao().disabled).toBe(false);
+  });
+
+  it("marcar Só texto no slide com foto que cabe sem o espaço destrava", async () => {
+    editor("foto", { tom: "ok", texto: "Arte salva.", em: 7, versoes: ["a1", "b3", "c1"] });
+    await act(async () => {
+      fireEvent.click(screen.getByLabelText("Slide 2: só texto, sem o espaço da imagem"));
+    });
+    expect(screen.queryByText(FRASE)).toBeNull();
+    expect(botao().disabled).toBe(false);
+  });
+
+  it("com o slide pronto do Canva, o mesmo texto não trava: sai a imagem dele", () => {
+    editor("slide");
+    expect(screen.queryByText(FRASE)).toBeNull();
+    expect(botao().disabled).toBe(false);
+  });
+});
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/bonus-publicar-estado.test.ts
npx vitest run --config vitest.dom.config.ts testes-dom/bonus-card-publicar.dom.tsx
```

Esperado: nos puros, 2 caem e 48 passam (50): a falta nova não existe. Na tela, 2 caem e 16 passam
(18): o card "Publicar" ignora a prop `cortados`, e nenhum card avisa o editor. Os outros três casos
novos de tela passam antes do código, de propósito (item 3 do ensaio). O `tsc` acusa a prop e o
parâmetro que ainda não existem.

- [ ] **Passo 3: o código**

Em `lib/bonus/publicar-estado.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/publicar-estado.ts b/lib/bonus/publicar-estado.ts
index a07a4ec..5403fb6 100644
--- a/lib/bonus/publicar-estado.ts
+++ b/lib/bonus/publicar-estado.ts
@@ -1,6 +1,7 @@
 // O ESTADO DA PUBLICAÇÃO DO CARROSSEL E O QUE FALTA PARA PUBLICAR (spec da Etapa 5). PURO: o
 // repositório lê a linha da fila e o relógio do banco, e esta função decide.
 import type { OrigemDaConta } from "./arte-conta";
+import type { SlidesCortados } from "./publicar-cabimento";
 import type { JeitoDaImagem, PublicacaoGuardada } from "./publicar-regras";
 
 /** A linha da fila do /publicar, lida pela `dedupe_key` exata que o carrossel guardou. */
@@ -67,11 +68,14 @@ export type FaltaParaPublicar =
   | { tipo: "sem_conta" }
   | { tipo: "conta_desconectada" }
   | { tipo: "imagens"; slides: number[] }
+  | { tipo: "nao_cabe"; slides: number[]; soTextoResolve: number[] }
   | { tipo: "nao_salvo"; slides: number[]; legenda: boolean };
 
 /**
  * O QUE TRAVA O BOTÃO "PUBLICAR" NA TELA, na ordem em que se resolve: a conta, as imagens dos slides
- * com espaço, e o que está "não salvo" (o que sai é o texto salvo, e não o que está nos campos).
+ * com espaço, o texto que sairia cortado (Etapa 9: a imagem do slide decide o modo da conta, e encurtar
+ * deixa o card sem salvar), e o que está "não salvo" (o que sai é o texto salvo, e não o que está nos
+ * campos).
  */
 export function faltasParaPublicar(p: {
   total: number;
@@ -81,6 +85,8 @@ export function faltasParaPublicar(p: {
   origem: OrigemDaConta;
   slidesNaoSalvos: number[];
   legendaNaoSalva: boolean;
+  /** Os slides que sairiam cortados, como os cards avisaram (publicar-cabimento.ts). */
+  cortados: SlidesCortados;
 }): FaltaParaPublicar[] {
   const faltas: FaltaParaPublicar[] = [];
   if (p.origem === "selecionada") faltas.push({ tipo: "sem_conta" });
@@ -88,6 +94,7 @@ export function faltasParaPublicar(p: {
   const semImagem: number[] = [];
   for (let n = 1; n <= p.total; n++) if (!p.soTexto.includes(n) && !p.imagens[n]) semImagem.push(n);
   if (semImagem.length) faltas.push({ tipo: "imagens", slides: semImagem });
+  if (p.cortados.slides.length) faltas.push({ tipo: "nao_cabe", ...p.cortados });
   if (p.slidesNaoSalvos.length || p.legendaNaoSalva) {
     faltas.push({ tipo: "nao_salvo", slides: [...p.slidesNaoSalvos].sort((a, b) => a - b), legenda: p.legendaNaoSalva });
   }
```

Em `lib/bonus/publicar-textos.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/publicar-textos.ts b/lib/bonus/publicar-textos.ts
index 78cb6ef..892474a 100644
--- a/lib/bonus/publicar-textos.ts
+++ b/lib/bonus/publicar-textos.ts
@@ -160,6 +160,8 @@ export function textoDaFalta(f: FaltaParaPublicar): string {
       return TEXTO_CONTA_DESCONECTADA_PARA_PUBLICAR;
     case "imagens":
       return `Falta a imagem ${doSlides(f.slides)}.`;
+    case "nao_cabe":
+      return textoDoSlideQueNaoCabe(f.slides, f.soTextoResolve);
     case "nao_salvo": {
       const partes = [...(f.slides.length ? [listaDeSlides(f.slides)] : []), ...(f.legenda ? ["a legenda"] : [])];
       return `Salve ${partes.join(" e ")} antes de publicar.`;
```

Em `app/bonus/[id]/carrossel/[cid]/card-publicar.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/[id]/carrossel/[cid]/card-publicar.tsx b/app/bonus/[id]/carrossel/[cid]/card-publicar.tsx
index ab5964b..3d241ba 100644
--- a/app/bonus/[id]/carrossel/[cid]/card-publicar.tsx
+++ b/app/bonus/[id]/carrossel/[cid]/card-publicar.tsx
@@ -3,6 +3,7 @@ import { useState, useTransition } from "react";
 import Link from "next/link";
 import { useRouter } from "next/navigation";
 import { alertError, alertOk, alertWarn, btnPrimary, card, hint, input, link } from "@/app/ui";
+import type { SlidesCortados } from "@/lib/bonus/publicar-cabimento";
 import { artesParaPublicar, faltasParaPublicar } from "@/lib/bonus/publicar-estado";
 import { textoDaFalta, type AvisoDaPublicacao } from "@/lib/bonus/publicar-textos";
 import type { TomDoQuadro } from "@/lib/bonus/textos";
@@ -11,8 +12,8 @@ import type { ImagemNaTela, PublicacaoNaTela } from "./publicacao-na-tela";
 
 // O CARD "PUBLICAR" (spec da Etapa 5, "A página"), no fim da página do carrossel: a conta em que o
 // post vai sair, o "Agora" ou o "Agendar", e o botão, travado com a frase de cada falta (a conta, a
-// imagem dos slides com espaço, o "não salvo"). Depois de mandar, o estado lido da fila toma o lugar do
-// botão, com o post no /publicar, onde se cancela ou remarca.
+// imagem dos slides com espaço, o texto que sairia cortado, o "não salvo"). Depois de mandar, o estado
+// lido da fila toma o lugar do botão, com o post no /publicar, onde se cancela ou remarca.
 //
 // NO SUCESSO A PÁGINA RECARREGA (`router.refresh`), ao contrário do salvar da Etapa 4 (achados 52 e
 // 54): aqui é seguro, porque o botão só destrava com nenhum card "não salvo", e a página recarregada
@@ -35,6 +36,7 @@ export default function CardPublicar({
   versoesDaMiniatura,
   slidesNaoSalvos,
   legendaNaoSalva,
+  cortados,
 }: {
   publicacao: PublicacaoNaTela;
   caminho: string;
@@ -45,6 +47,8 @@ export default function CardPublicar({
   versoesDaMiniatura: string[];
   slidesNaoSalvos: number[];
   legendaNaoSalva: boolean;
+  /** Os slides que sairiam cortados na imagem publicada, como os cards avisaram (Etapa 9). */
+  cortados: SlidesCortados;
 }) {
   const router = useRouter();
   const [quando, setQuando] = useState<"agora" | "depois">("agora");
@@ -52,7 +56,7 @@ export default function CardPublicar({
   const [aviso, setAviso] = useState<AvisoDaPublicacao | null>(null);
   const [pendente, iniciar] = useTransition();
   const { estado } = publicacao;
-  const faltas = faltasParaPublicar({ total, soTexto, imagens, origem: publicacao.origem, slidesNaoSalvos, legendaNaoSalva });
+  const faltas = faltasParaPublicar({ total, soTexto, imagens, origem: publicacao.origem, slidesNaoSalvos, legendaNaoSalva, cortados });
   const travado = pendente || faltas.length > 0 || (quando === "depois" && !dataHora);
 
   function publicar() {
```

Em `app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx b/app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx
index c8c376d..3ce52f3 100644
--- a/app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx
+++ b/app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx
@@ -6,6 +6,7 @@ import { avisosDeCabimento, campoDoAviso } from "@/lib/bonus/arte-cabimento";
 import { urlDaArte } from "@/lib/bonus/arte-tela";
 import type { CampoDoCarrossel, ParteDoCarrossel } from "@/lib/bonus/carrossel-texto";
 import type { AvisoDoSlide } from "@/lib/bonus/carrossel-textos";
+import { corteDoCard, type Corte } from "@/lib/bonus/publicar-cabimento";
 import type { JeitoDaImagem } from "@/lib/bonus/publicar-regras";
 import { TEXTO_TEXTO_MUDOU, type AvisoDaImagem } from "@/lib/bonus/publicar-textos";
 import Campo from "./campo";
@@ -24,6 +25,10 @@ import type { ImagemNaTela } from "./publicacao-na-tela";
 // página perde o que não foi salvo. O "não cabe" é a conta da arte sobre o que está nos campos agora
 // (arte-cabimento.ts), junto do campo e embaixo da miniatura.
 //
+// O SLIDE QUE SAIRIA CORTADO NA IMAGEM PUBLICADA (spec da Etapa 9) é a mesma conta, no modo em que o
+// slide sai (publicar-cabimento.ts): o card avisa o editor quando ele passa a sair cortado ou deixa de
+// sair, como no "não salvo", e o "Publicar" trava. Aqui o card só avisa: salvar continua permitido.
+//
 // A versão da miniatura e o "só texto" moram no pai (editor-do-carrossel.tsx): o "só texto" se grava
 // por outra action, que devolve as versões, e o "Baixar todos" precisa das versões de todos.
 //
@@ -55,6 +60,7 @@ export default function CardDaParte({
   enviarImagem = null,
   travado = null,
   aoMudarNaoSalvo,
+  aoMudarCorte,
 }: {
   acao: (anterior: AvisoDoSlide | null, form: FormData) => Promise<AvisoDoSlide | null>;
   caminho: string;
@@ -81,6 +87,8 @@ export default function CardDaParte({
   travado?: string | null;
   /** Avisa o editor quando o card fica, ou deixa de ficar, "não salvo": o "Publicar" trava com ele. */
   aoMudarNaoSalvo?: (naoSalvo: boolean) => void;
+  /** Avisa o editor quando o slide passa a sair cortado, ou deixa de sair: o "Publicar" trava com ele. */
+  aoMudarCorte?: (corte: Corte | null) => void;
 }) {
   const doCard = (v: Record<string, string>) => Object.fromEntries(campos.map((c) => [c.nome, v[c.nome] ?? ""]));
   const [atuais, setAtuais] = useState(() => doCard(valores));
@@ -110,6 +118,14 @@ export default function CardDaParte({
     () => (numero && campoDoNaoCabe ? avisosDeCabimento(total, atuais, soTexto ? [numero] : [])[campoDoNaoCabe] : undefined),
     [numero, campoDoNaoCabe, total, atuais, soTexto]
   );
+  const jeito = imagem?.jeito ?? null;
+  const corte = useMemo(
+    () => (numero !== null ? corteDoCard({ total, numero, valores: atuais, soTexto, jeito }) : null),
+    [numero, total, atuais, soTexto, jeito]
+  );
+  useEffect(() => {
+    aoMudarCorte?.(corte);
+  }, [corte, aoMudarCorte]);
   // Marcado "Só texto", o slide sai com a arte do Chat: a imagem guardada fica, mas não se usa.
   const comImagem = numero !== null && !soTexto ? imagem : null;
   // O aviso é só do slide pronto: com a foto no espaço, a arte se redesenha com o texto novo.
```

Em `app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx b/app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx
index 7121cf2..35e766f 100644
--- a/app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx
+++ b/app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx
@@ -6,6 +6,7 @@ import { urlDaArte } from "@/lib/bonus/arte-tela";
 import { textoDoBaixarTodos, type AvisoDaArte } from "@/lib/bonus/arte-textos";
 import { camposDaParte, type CampoDoCarrossel, type ParteDoCarrossel } from "@/lib/bonus/carrossel-texto";
 import type { AvisoDoSlide } from "@/lib/bonus/carrossel-textos";
+import { juntarCortes, type Corte } from "@/lib/bonus/publicar-cabimento";
 import type { JeitoDaImagem } from "@/lib/bonus/publicar-regras";
 import type { AvisoDaImagem } from "@/lib/bonus/publicar-textos";
 import CardDaParte from "./card-da-parte";
@@ -81,6 +82,12 @@ export default function EditorDoCarrossel({
   const marcarNaoSalvo = useCallback((chave: string, sim: boolean) => {
     setNaoSalvos((atuais) => (atuais.includes(chave) === sim ? atuais : sim ? [...atuais, chave] : atuais.filter((k) => k !== chave)));
   }, []);
+  // Os slides que sairiam cortados na imagem publicada (spec da Etapa 9): o "Publicar" trava com eles.
+  // Cada card avisa quando o corte do slide dele muda, como no "não salvo".
+  const [cortes, setCortes] = useState<Record<number, Corte | null>>({});
+  const marcarCorte = useCallback((numero: number, corte: Corte | null) => {
+    setCortes((atuais) => ((atuais[numero] ?? null) === corte ? atuais : { ...atuais, [numero]: corte }));
+  }, []);
   const [soTexto, setSoTexto] = useState(soTextoInicial);
   const aceito = useRef(soTextoInicial);
   const [respostaDaArte, despacharArte, artePendente] = useActionState(
@@ -212,6 +219,7 @@ export default function EditorDoCarrossel({
               enviarImagem={publicacao ? (arquivo, jeito) => enviarImagem(publicacao, n, arquivo, jeito) : null}
               travado={travado}
               aoMudarNaoSalvo={(sim) => marcarNaoSalvo(`slide_${n}`, sim)}
+              aoMudarCorte={(corte) => marcarCorte(n, corte)}
             />
           ))}
           <CardDaParte
@@ -257,6 +265,7 @@ export default function EditorDoCarrossel({
           versoesDaMiniatura={versoes}
           slidesNaoSalvos={naoSalvos.filter((k) => k.startsWith("slide_")).map((k) => Number(k.slice("slide_".length)))}
           legendaNaoSalva={naoSalvos.includes("legenda")}
+          cortados={juntarCortes(cortes)}
         />
       )}
     </div>
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npm run lint
npx vitest run tests/bonus-publicar-estado.test.ts
npx vitest run --config vitest.dom.config.ts testes-dom/bonus-card-publicar.dom.tsx
npm test
npm run test:dom
```

Esperado: `tsc` e lint limpos; os 50 puros e os 18 de tela passam; as suítes inteiras com 108 arquivos
e 3 119 casos puros, e 22 e 189 de tela.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/bonus/publicar-estado.ts lib/bonus/publicar-textos.ts "app/bonus/[id]/carrossel/[cid]/card-publicar.tsx" "app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx" "app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx" tests/bonus-publicar-estado.test.ts testes-dom/bonus-card-publicar.dom.tsx
test "$(git branch --show-current)" = "carrossel-que-nao-cabe"
git add lib/bonus/publicar-estado.ts lib/bonus/publicar-textos.ts "app/bonus/[id]/carrossel/[cid]/card-publicar.tsx" "app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx" "app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx" tests/bonus-publicar-estado.test.ts testes-dom/bonus-card-publicar.dom.tsx
git commit -m "feat(bonus): o botão Publicar trava com o slide que sairia cortado"
```

---

### FASE 9.4 — O verify, a integração inteira, as mutações e a guarda do diff

- [ ] **Passo 1: o verify, na árvore do projeto**

```bash
env -u CLAUDECODE -u AI_AGENT npm run verify
git diff --stat AGENTS.md
```

Esperado: lint e `tsc` limpos; 108 arquivos e 3 119 casos puros e 22 e 189 de tela; a varredura "SEM
VAZAMENTO em A nem em C"; o build (Turbopack) com "MIGRAÇÃO PULADA" e a rota
`ƒ /bonus/[id]/carrossel/[cid]`; o `AGENTS.md` sem diferença.

- [ ] **Passo 2: a integração inteira, no container**

```bash
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npm run test:integracao
```

Esperado: `[rede-global] ALVO: banco de TESTE`; 42 arquivos, 446 passaram e 8 pularam (na base, 42,
441 e 8).

- [ ] **Passo 3: as provas de mutação**

Copie o script do Apêndice A para `$SCRATCH/mutar-que-nao-cabe.mjs` e rode, da raiz:

```bash
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" node "$SCRATCH/mutar-que-nao-cabe.mjs"
git status --short
```

Esperado: as 23 com ✓, "23 mutações, 0 ruins", e a árvore limpa depois (cada arquivo volta byte a
byte).

- [ ] **Passo 4: a guarda do diff (pedido da auditoria)**

```bash
git diff --stat c0c635c -- app/publicar app/api app/automacoes lib/bucket.ts lib/queue-drain.ts lib/engine.ts lib/publicacao.ts lib/dedupe.ts scripts migrations lib/esquema.ts lib/bonus/arte-slides.ts package.json package-lock.json next.config.ts proxy.ts
git diff --stat c0c635c -- . ':!app/bonus' ':!lib/bonus' ':!tests' ':!testes-dom' ':!testes-integracao' ':!docs'
```

Esperado: as duas saídas vazias.

- [ ] **Passo 5: avisar o auditor**, com o hash, os números e o pedido de conferir a branch antes do
  push. O push da branch e o PR só com o OK do Eduardo.

---

### FASE 9.5 — A prova real, no preview, com o Eduardo

Cada escrita em produção tem o OK do Eduardo, pela caixa, e a auditoria lê o banco antes e depois
(avisada com a hora). O preview usa o banco e o bucket de produção. **Sem post real. Sem migração.**

- [ ] **Passo 1: a linha de base da auditoria**, só de leitura (os carrosséis que existem, a fila e o
  registro das migrações, com 18).

- [ ] **Passo 2: o push da branch e o preview, com o OK do Eduardo**

Empurre só a branch (`git push origin refs/heads/carrossel-que-nao-cabe:refs/heads/carrossel-que-nao-cabe`).
No log do build do preview, confira o commit e "MIGRAÇÃO PULADA".

- [ ] **Passo 3: a prova, com o Eduardo na tela** (os passos da spec, "A prova real")

1. "Novo carrossel" → texto livre → "Escrever à mão", com 1 slide e uma palavra comprida, sem espaço,
   no texto da imagem; criar (grava em produção: só com o OK).
2. Na página dele: subir uma foto no slide (grava), e ver o botão "Publicar" travado com "O texto do
   slide 1 não cabe na arte e sairia cortado. Encurte o texto." (sem o "Só texto": a palavra não cabe
   nem sem o espaço, item 1 do ensaio).
3. Encurtar o texto e salvar o slide (grava): o botão destrava.
4. Agendar para daqui a 7 dias e cancelar no calendário (gravam).

No fim, o que a prova criou sai do banco e do bucket, com o OK do Eduardo e o script lido pela
auditoria antes de rodar (achado 77). Depois: o corpo do PR, conferido pelo auditor, e o PR com o OK
do Eduardo. O merge é do Vinícius, e o build do merge diz "Nada a aplicar: as 18 migrações".

---

## Apêndice A — as provas de mutação

Cada mutação tira uma proteção e roda o teste que a cobre; o caso nomeado tem de cair. O arquivo
volta byte a byte depois de cada uma. Sem `DATABASE_URL_TESTES`, o script recusa antes de mutar.

```js
// Provas de mutação da Etapa 9 (o slide que não cabe não sai). Cada mutação tira uma proteção e roda o
// teste que a cobre; o caso nomeado tem de cair. Cada arquivo volta byte a byte.
// Uso, da raiz do repositório: DATABASE_URL_TESTES=<container> node mutar-que-nao-cabe.mjs [filtro]
// As mutações INTEG rodam a suíte de integração, que sem DATABASE_URL_TESTES cai na DATABASE_URL, a
// da PRODUÇÃO (achado 68): sem a variável, o script recusa antes de mutar, e uma rodada INTEG que
// não imprime "ALVO: banco de TESTE" conta como ✗.
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const PURA = (f) => `npx vitest run ${f}`;
const TELA = (f) => `npx vitest run --config vitest.dom.config.ts ${f}`;
const INTEG = (f) => `npx vitest run --config vitest.integracao.config.ts ${f}`;

const CABIMENTO = "lib/bonus/publicar-cabimento.ts";
const TEXTOS = "lib/bonus/publicar-textos.ts";
const PROCESSO = "lib/bonus/publicar-processo.ts";
const ESTADO = "lib/bonus/publicar-estado.ts";
const CARD_PUBLICAR = "app/bonus/[id]/carrossel/[cid]/card-publicar.tsx";
const CARD = "app/bonus/[id]/carrossel/[cid]/card-da-parte.tsx";
const EDITOR = "app/bonus/[id]/carrossel/[cid]/editor-do-carrossel.tsx";

const T_CABIMENTO = PURA("tests/bonus-publicar-cabimento.test.ts");
const T_ESTADO = PURA("tests/bonus-publicar-estado.test.ts");
const T_PUBLICAR = INTEG("testes-integracao/bonus-publicar-processo.integracao.ts");
const T_TELA = TELA("testes-dom/bonus-card-publicar.dom.tsx");

const RECUSA_AGORA = "agora: recusa com o slide, as artes subidas saem do bucket, e nada é reservado nem entra na fila";
const TELA_ENCURTAR = "com a foto no slide, o card que avisa trava o Publicar, e encurtar e salvar destrava";

const MUTACOES = [
  // 9.1 a regra
  { nome: "9.1: o modo não importa, tudo com o espaço", arq: CABIMENTO,
    de: "  if (arte === null || tamanhoDoSlide(s, arte.comFoto).cabe) return null;",
    para: "  if (arte === null || tamanhoDoSlide(s, true).cabe) return null;",
    cmd: T_CABIMENTO, caso: "o só texto que cabe sem o espaço não sai cortado, mesmo sem caber com ele" },
  { nome: "9.1: o slide pronto conta, como se tivesse foto", arq: CABIMENTO,
    de: "  if (arte === null || tamanhoDoSlide(s, arte.comFoto).cabe) return null;",
    para: "  if (arte === null) arte = { comFoto: true };\n  if (tamanhoDoSlide(s, arte.comFoto).cabe) return null;",
    cmd: T_CABIMENTO, caso: "o slide pronto do Canva nunca sai cortado, mesmo com o texto que não cabe" },
  { nome: "9.1: o Só texto resolve todo slide com foto", arq: CABIMENTO,
    de: '  return arte.comFoto && tamanhoDoSlide(s, false).cabe ? "so_texto_resolve" : "encurtar";',
    para: '  return arte.comFoto ? "so_texto_resolve" : "encurtar";',
    cmd: T_CABIMENTO, caso: "o com foto que não cabe nem sem o espaço sai cortado, e só encurtar resolve" },
  { nome: "9.1: o corte que sumiu continua na lista", arq: CABIMENTO,
    de: "    .filter((n) => cortes[n])\n", para: "",
    cmd: T_CABIMENTO, caso: "em ordem, sem os que deixaram de cortar, e com os que Só texto resolve" },
  { nome: "9.1: o card ignora o Só texto", arq: CABIMENTO,
    de: "    soTexto: p.soTexto ? [p.numero] : [],", para: "    soTexto: [],",
    cmd: T_CABIMENTO, caso: "marcado Só texto, conta sem o espaço, e a foto guardada não conta" },
  // 9.2 a frase, a recusa e o servidor
  { nome: "9.2: a frase oferece o Só texto sempre", arq: TEXTOS,
    de: "  if (!soTextoResolve.length) return `${frase}.`;\n", para: "",
    cmd: T_ESTADO, caso: "diz o slide e manda encurtar" },
  { nome: "9.2: a frase mista não diz onde o Só texto resolve", arq: TEXTOS,
    de: '  return `${frase} ou, ${noSlides(soTextoResolve)}, marque "Só texto".`;',
    para: '  return `${frase} ou marque "Só texto".`;',
    cmd: T_ESTADO, caso: "com os dois casos juntos, diz em qual o Só texto resolve" },
  { nome: "9.2: a recusa com outra frase", arq: TEXTOS,
    de: '    case "nao_cabe":\n      return textoDoSlideQueNaoCabe(r.slides, r.soTextoResolve);',
    para: '    case "nao_cabe":\n      return "O slide não cabe.";',
    cmd: T_ESTADO, caso: "a recusa do servidor tem a mesma frase" },
  { nome: "9.2: o servidor não recusa", arq: PROCESSO,
    de: "  if (cortados.slides.length) {", para: "  if (false) {",
    cmd: T_PUBLICAR, caso: RECUSA_AGORA },
  { nome: "9.2: o servidor recusa sem apagar as artes subidas", arq: PROCESSO,
    de: '  if (cortados.slides.length) {\n    await descartar();\n    return recusa({ motivo: "nao_cabe", ...cortados });',
    para: '  if (cortados.slides.length) {\n    return recusa({ motivo: "nao_cabe", ...cortados });',
    cmd: T_PUBLICAR, caso: RECUSA_AGORA },
  { nome: "9.2: o servidor recusa o slide pronto", arq: PROCESSO,
    de: "desenhados.map((n) => ({ numero: n, comFoto: fotoDe(n) !== null }))",
    para: "c.slides.map((s) => ({ numero: s.numero, comFoto: comEspaco(c.escolhas, s.numero) }))",
    cmd: T_PUBLICAR, caso: "o mesmo carrossel, com o slide pronto do Canva no slide 2, publica" },
  { nome: "9.2: o servidor conta o só texto com o espaço", arq: PROCESSO,
    de: "comFoto: fotoDe(n) !== null }))", para: "comFoto: true }))",
    cmd: T_PUBLICAR, caso: "o mesmo carrossel, com o slide 2 marcado só texto, publica: sem o espaço, o texto cabe" },
  // 9.3 a tela
  { nome: "9.3: a falta some", arq: ESTADO,
    de: '  if (p.cortados.slides.length) faltas.push({ tipo: "nao_cabe", ...p.cortados });\n', para: "",
    cmd: T_ESTADO, caso: "o slide que sairia cortado, depois das imagens e antes do não salvo" },
  { nome: "9.3: a falta depois do não salvo", arq: ESTADO,
    de: '  if (p.cortados.slides.length) faltas.push({ tipo: "nao_cabe", ...p.cortados });\n  if (p.slidesNaoSalvos.length || p.legendaNaoSalva) {\n    faltas.push({ tipo: "nao_salvo", slides: [...p.slidesNaoSalvos].sort((a, b) => a - b), legenda: p.legendaNaoSalva });\n  }\n',
    para: '  if (p.slidesNaoSalvos.length || p.legendaNaoSalva) {\n    faltas.push({ tipo: "nao_salvo", slides: [...p.slidesNaoSalvos].sort((a, b) => a - b), legenda: p.legendaNaoSalva });\n  }\n  if (p.cortados.slides.length) faltas.push({ tipo: "nao_cabe", ...p.cortados });\n',
    cmd: T_ESTADO, caso: "o slide que sairia cortado, depois das imagens e antes do não salvo" },
  { nome: "9.3: a falta com outra frase", arq: TEXTOS,
    de: '    case "nao_cabe":\n      return textoDoSlideQueNaoCabe(f.slides, f.soTextoResolve);',
    para: '    case "nao_cabe":\n      return "Não cabe.";',
    cmd: T_ESTADO, caso: "a falta da tela tem a mesma frase da recusa" },
  { nome: "9.3: o card Publicar ignora os cortados", arq: CARD_PUBLICAR,
    de: "legendaNaoSalva, cortados });", para: "legendaNaoSalva, cortados: { slides: [], soTextoResolve: [] } });",
    cmd: T_TELA, caso: "o slide que sairia cortado trava o botão, com a frase" },
  { nome: "9.3: o card do slide não avisa", arq: CARD,
    de: "    aoMudarCorte?.(corte);\n", para: "",
    cmd: T_TELA, caso: TELA_ENCURTAR },
  { nome: "9.3: o card conta sobre o texto salvo", arq: CARD,
    de: "corteDoCard({ total, numero, valores: atuais, soTexto, jeito })",
    para: "corteDoCard({ total, numero, valores: salvos, soTexto, jeito })",
    cmd: T_TELA, caso: TELA_ENCURTAR },
  { nome: "9.3: o card ignora o jeito da imagem", arq: CARD,
    de: "  const jeito = imagem?.jeito ?? null;", para: "  const jeito = null;",
    cmd: T_TELA, caso: TELA_ENCURTAR },
  { nome: "9.3: o card trata toda imagem como foto", arq: CARD,
    de: "  const jeito = imagem?.jeito ?? null;", para: '  const jeito = imagem ? "foto" : null;',
    cmd: T_TELA, caso: "com o slide pronto do Canva, o mesmo texto não trava: sai a imagem dele" },
  { nome: "9.3: o card ignora o Só texto", arq: CARD,
    de: "corteDoCard({ total, numero, valores: atuais, soTexto, jeito })",
    para: "corteDoCard({ total, numero, valores: atuais, soTexto: false, jeito })",
    cmd: T_TELA, caso: "marcar Só texto no slide com foto que cabe sem o espaço destrava" },
  { nome: "9.3: o editor não passa a lista", arq: EDITOR,
    de: "          cortados={juntarCortes(cortes)}", para: "          cortados={juntarCortes({})}",
    cmd: T_TELA, caso: TELA_ENCURTAR },
  { nome: "9.3: o editor não esquece o corte que sumiu", arq: EDITOR,
    de: "    setCortes((atuais) => ((atuais[numero] ?? null) === corte ? atuais : { ...atuais, [numero]: corte }));",
    para: "    setCortes((atuais) => ((atuais[numero] ?? null) === corte || corte === null ? atuais : { ...atuais, [numero]: corte }));",
    cmd: T_TELA, caso: TELA_ENCURTAR },
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
