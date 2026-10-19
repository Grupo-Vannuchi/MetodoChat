# O /publicar enquadra as imagens do carrossel e do post de imagem — Plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: `superpowers:subagent-driven-development`
> (recomendada) ou `superpowers:executing-plans`, fase por fase. Os passos usam caixa de
> seleção (`- [ ]`) para acompanhar.

**Objetivo:** no `/publicar`, a pessoa escolhe a proporção do post (4:5, 1:1 ou 1,91:1), cada imagem sai
cortada ao centro ou inteira com bordas brancas, a lista de montagem mostra a miniatura já enquadrada, com
remover, e tudo sobe só no clique de Publicar, com a trava contra o clique duplo. As prévias do post e do
calendário passam a mostrar o vídeo como vídeo, e a página do post cancelado diz que o arquivo foi apagado.

**Arquitetura:** as regras são puras e moram em `lib/publicacao.ts`, numa seção nova, "O ENQUADRAMENTO":
a geometria do corte e do encaixe, o arquivo que vai sem redesenho, o vermelho da lista sobre a saída
prevista, a trava do primeiro slide, a lista e a capa. O compositor (`app/publicar/enviador.tsx`) passa a
montar o formulário inteiro: o botão é `type="button"`, trava numa referência antes de qualquer espera, sobe
os arquivos e só então chama a action, uma vez, com um `FormData` montado por ele. A fiação do navegador
(medir, desenhar no `canvas`, assinar e subir) vai para `app/publicar/navegador.ts`, que o teste de tela
troca por uma falsa. A action, a rota de assinar, a fila e o dreno não mudam.

**Stack:** a do projeto, no Next.js 16.3.8: Vitest (as três suítes), Testing Library no jsdom, Postgres no
container para a integração.

**Spec:** `docs/specs/2026-10-19-enquadrar-imagens.md` (commits `268daf3`, `9f68b1e`, `057a18c` e
`c0d47e0`; auditoria do perigo e revisão pela auditoria, com os achados 107 a 114 absorvidos; liberada em
`c0d47e0`; lida pelo Eduardo em 19/10). Leia antes de começar: este plano não repete o porquê, só como
construir.

**Ensaio do plano (19/10):** o código deste plano foi escrito e testado fase a fase numa cópia isolada do
repositório (`git worktree`, branch local `ensaio-enquadrar`, sem push, saída de `c0d47e0` pelo mesmo
conteúdo), e todo bloco de código abaixo foi tirado do git dessa cópia por um gerador, sem cópia à mão. Os
números do ensaio:
- lint e `tsc` limpos em cada fase; no fim, 123 arquivos e 3 368 casos puros (120 arquivos e 3 310 na base) e
  26 arquivos e 241 de tela (25 arquivos e 220 na base);
- `next build --webpack` limpo (no ensaio, o `node_modules` é uma junção, que o Turbopack recusa), e o
  `AGENTS.md` intacto;
- a varredura "SEM VAZAMENTO em A nem em C";
- integração no container: 46 arquivos, 529 passaram e 8 pularam (igual à base: o que muda nela é só a frase do `sem_arquivo`),
  com o `.env.local` vazio na cópia;
- cada fase foi vista falhar antes do código e passar depois, com os números no passo dela;
- as 27 provas de mutação do Apêndice A derrubaram, cada uma, o caso esperado;
- o plano, aplicado do zero numa cópia limpa, dá os 12 arquivos iguais ao fim do ensaio, byte a byte;
- a guarda do diff (FASE 6, passo 4) mostrou só os arquivos do mapa abaixo.

**A medição antes do código (19/10).** A spec mandava medir o que o `redirect` da action faz com o
componente que a chama. Uma sonda de laboratório, numa cópia descartável sem banco, chamou uma action
`"use server"` com `redirect` para a mesma rota dentro de `startTransition`, e dirigiu um Edge sem janela
pelo DevTools. No `next dev` e no `next build` + `next start` (16.3.8): o componente é recriado (um contador
em 3 voltou a 0), a espera rejeita com `NEXT_REDIRECT`, o `finally` roda e o `isPending` volta a falso. Com
isso, a spec tirou o identificador do pedido (`c0d47e0`), e a chamada da action ficou sem `catch` (Apêndice
B traz a sonda).

O ensaio achou estas coisas, já resolvidas neste plano:
1. **A miniatura é desenhada pelo próprio navegador, sem `canvas`.** A caixa da linha tem a proporção
   escolhida e o fundo branco, e a imagem vai com `object-cover` (o corte ao centro) ou `object-contain` (a
   imagem inteira com bordas): é o mesmo enquadramento que `geometriaDoEnquadramento` manda o `canvas`
   desenhar na subida. A spec previa refazer as miniaturas no `canvas`, uma de cada vez, com um bitmap vivo
   por vez: sem `canvas` na tela, não há bitmap a segurar. Pelo mesmo motivo, o vídeo aparece com
   `object-cover` na caixa, que já é o corte do Instagram, e `recorteDoInstagramNoVideo` sai: ninguém o
   chamaria.
2. **A fiação do navegador mora num arquivo novo, `app/publicar/navegador.ts`**, entregue ao compositor por
   propriedade (`navegador`), com `navegadorDeVerdade` como padrão. O jsdom não tem `canvas`,
   `createImageBitmap` nem `URL.createObjectURL`, e o teste de tela entrega uma falsa, no molde das actions
   falsas do gerador. O `subirComProgresso` de verdade ganhou o sinal de interromper e é testado com um
   `XMLHttpRequest` falso.
3. **O formulário passou para o compositor.** A página de servidor entrega o "Quando", as opções de reels e
   o rodapé prontos, por propriedade (`quando`, `opcoesDoReels`, `rodape`), além da action e da pasta da
   conta (`pastaDaConta`, de `lib/bucket.ts`, que é de servidor).
4. **`problemaDaSaida` ganhou `imagem_ilegivel`**: a imagem que o navegador não conseguiu abrir (sem medida)
   não tem como ser enquadrada, e a frase pede exportar em JPEG ou PNG.
5. **Duas frases novas no clique**, sem regra nova por trás: "Espere a tela terminar de ler os arquivos."
   (o clique antes de a medida chegar) e "A conta mudou durante o envio. Recarregue a página e monte o post
   de novo." (a pasta conferida antes da action).
6. **`fraseSobreAMidia` recebe o motivo como parâmetro obrigatório**, para quem chamar não esquecer a
   pergunta.
7. **A guarda da escala (`tests/escala.test.ts`) recusou `text-[10px]` e `rounded-md`** no selo de vídeo da
   página do post: ele usa `text-[11px]` (o mesmo do calendário) e `rounded-lg`.
8. **A guarda do compositor normaliza o fim de linha antes de procurar**: na cópia do Windows, com
   `core.autocrlf`, o arquivo chega em CRLF.
9. **No ensaio, refazer um commit com `reset`, `cherry-pick` e `stash` reescreveu a cópia em CRLF.** Os
   commits saíram certos (o git normaliza), mas a cópia teve de voltar a LF com `para-lf.mjs`. Na execução,
   não reescreva o histórico: cada fase é um commit novo.

## Restrições globais

- **Branch:** `enquadrar-imagens`, saída da `main` em `260b9dd`, **sem upstream** (o `git worktree add -b`
  sobre `origin/main` liga a branch à `main`: desligue com `git branch --unset-upstream enquadrar-imagens`).
  Nunca commitar nem empurrar na `main`. Conferir `git branch --show-current` antes de cada commit.
- **`git add` com caminho explícito.** Nunca `-A` nem `.`.
- **Commit no estilo do Vinícius:** uma frase dizendo o efeito, sem prefixo, o porquê no corpo, sem
  rodapé de IA. Autor: Eduardo Kobal <162614913+Eduardokobal@users.noreply.github.com>.
- **Antes de cada commit**, varrer os arquivos tocados com `node "$SCRATCH/varrer-texto.mjs" <arquivos>`.
- **O commit é um comando à parte**, depois de ler a saída dos testes.
- **Fim de linha:** converta antes os arquivos que a fase toca (`node "$SCRATCH/para-lf.mjs" <arquivo>`) e
  aplique os diffs com `git apply`, ou à mão.
- **Os arquivos desta etapa são os do mapa abaixo, e mais nenhum.** Nada da action (`app/publicar/actions.ts`),
  da rota de assinar (`app/api/`), da fila e do dreno (`lib/queue-drain.ts`, `lib/engine.ts`), do bucket
  (`lib/bucket.ts`), das migrações, dos `scripts` nem do `package`.
- **A chamada da action no compositor não tem `catch`** (a medição acima): só `try`/`finally`.
- **Sem migração.** O build do merge tem de dizer "Nada a aplicar: as 19 migrações".
- **Uma rodada de integração de cada vez**, sempre com `DATABASE_URL_TESTES` apontando para o container
  (`127.0.0.1:5434`). Toda rodada tem de imprimir `[rede-global] ALVO: banco de TESTE`. Nunca rode com a
  variável vazia: ela cai na `DATABASE_URL`, que é **produção**.
- **`next build` sem as variáveis de agente:** `env -u CLAUDECODE -u AI_AGENT ...`, e `git diff AGENTS.md`
  depois.
- **Escrita em produção só com o OK do Eduardo**, a hora mandada à auditoria antes, e o "pode" dela.
- **Ao fechar cada fase**, avisar o auditor (`metodochat-0d` em 19/10; conferir o nome no `ListAgents`) com
  o hash.

## Mapa dos arquivos

| arquivo | responsabilidade | fase |
|---|---|---|
| `lib/publicacao.ts` | a seção "O ENQUADRAMENTO" e `pareceVideo` exportada; `fraseSobreAMidia` pelo motivo; a frase do `sem_arquivo` | 1, 2 e 4 |
| `tests/publicacao-enquadramento.test.ts` (novo) | as regras puras do enquadramento, com a varredura do arredondamento | 1 |
| `tests/publicacao.test.ts` | a frase do post encerrado pelo motivo; a frase do `sem_arquivo` | 2 e 4 |
| `app/publicar/post/[id]/page.tsx` | o motivo na frase da mídia; o vídeo como vídeo na prévia | 2 e 3 |
| `app/publicar/page.tsx` | a capa do calendário pela regra pura, e o ícone do post só de vídeo | 3 |
| `tests/publicar-previas.test.ts` (novo) | a guarda das duas prévias | 3 |
| `testes-integracao/publicar-fala.integracao.ts` | a frase nova do `sem_arquivo` | 4 |
| `app/publicar/navegador.ts` (novo) | a fiação do navegador: medir, desenhar, assinar e subir, interrompível | 5 |
| `app/publicar/enviador.tsx` | o compositor: o formulário inteiro, a lista e o envio no clique | 5 |
| `app/publicar/novo/page.tsx` | entrega ao compositor a action, a pasta e as partes de servidor | 5 |
| `testes-dom/publicar-compositor.dom.tsx` (novo) | o compositor com um navegador falso, e o `subirComProgresso` com um `XMLHttpRequest` falso | 5 |
| `tests/publicar-compositor-guarda.test.ts` (novo) | a guarda do clique: sem `catch`, a trava antes da espera, o formulário sem `action` | 5 |

---

## O ENQUADRAMENTO

### FASE 0 — Começar da branch certa

- [ ] **Passo 1: conferir a main e a branch**

```bash
git ls-remote origin refs/heads/main
git switch enquadrar-imagens
git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null || echo "sem upstream"
git log --oneline -6
```

Esperado: a `main` em `260b9dd` (ou depois dele); "sem upstream"; a branch com os quatro commits da spec e
este plano sobre `260b9dd`.

- [ ] **Passo 2: o `node_modules` próprio** (o Turbopack do `verify` recusa uma junção que aponte para fora
  da cópia)

```bash
npm ci
```

- [ ] **Passo 3: a linha de base**

```bash
npm test
npm run test:dom
npm run banco:teste
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npm run test:integracao
```

Esperado: 120 arquivos e 3 310 casos puros; 25 arquivos e 220 de tela; `[rede-global] ALVO: banco de TESTE`,
46 arquivos, 529 passaram e 8 pularam.

---

### FASE 1 — As regras puras do enquadramento

**Arquivos:**
- Modificar: `lib/publicacao.ts` (a seção nova no fim, e `pareceVideo` exportada)
- Criar: `tests/publicacao-enquadramento.test.ts`

**Interfaces:**
- Produz, em `lib/publicacao.ts`: `ProporcaoDoPost = "4:5" | "1:1" | "1,91:1"`; `PROPORCOES_DO_POST`
  (`{ id, rotulo, largura, altura }`, a razão como fração inteira); `PROPORCAO_PADRAO = "4:5"`;
  `ModoDoEnquadramento = "cortar" | "inteira"`; `Retangulo`; `geometriaDoEnquadramento({ largura, altura,
  proporcao, modo })`; `orientacaoDoJpeg(bytes)`; `vaiSemRedesenho({ mime, largura, altura, bytes,
  proporcao, orientacao })`; `ProblemaDaSaida`, `problemaDaSaida(forma, arq, proporcao, modo, teto)` e
  `textoDoProblemaDaSaida`; `ProblemaDoPrimeiroSlide`, `problemaDoPrimeiroSlide(itens, proporcao)` e
  `textoDoProblemaDoPrimeiroSlide`; `acrescentarNaLista(lista, novos, forma)`; `textoDaContagem(validos)`;
  `ehVideoNoPost(forma, caminho)`; `capaDoPost(forma, caminhos)`; e `pareceVideo` exportada.

- [ ] **Passo 1: os testes**

Crie `tests/publicacao-enquadramento.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  PROPORCOES_DO_POST,
  PROPORCAO_PADRAO,
  acrescentarNaLista,
  capaDoPost,
  ehVideoNoPost,
  geometriaDoEnquadramento,
  orientacaoDoJpeg,
  pareceVideo,
  problemaDaSaida,
  problemaDoArquivo,
  problemaDoPrimeiroSlide,
  textoDaContagem,
  textoDoProblema,
  textoDoProblemaDaSaida,
  textoDoProblemaDoPrimeiroSlide,
  vaiSemRedesenho,
  type ModoDoEnquadramento,
  type ProporcaoDoPost,
} from "@/lib/publicacao";

// O ENQUADRAMENTO DO /publicar (spec 2026-10-19-enquadrar-imagens): a proporção escolhida, o corte ao
// centro ou a imagem inteira com bordas, o arquivo que vai como veio, e as travas da lista. Tudo puro,
// porque o `canvas` e o `XMLHttpRequest` não rodam aqui: o que a tela desenha sai daqui.

const MIB = 1024 * 1024;
const PROPORCOES: ProporcaoDoPost[] = ["4:5", "1:1", "1,91:1"];
const MODOS: ModoDoEnquadramento[] = ["cortar", "inteira"];

describe("as proporções do post", () => {
  it("são as três, com 4:5 como padrão", () => {
    expect(PROPORCOES_DO_POST.map((p) => p.id)).toEqual(["4:5", "1:1", "1,91:1"]);
    expect(PROPORCOES_DO_POST.map((p) => p.rotulo)).toEqual(["4:5 (em pé)", "1:1 (quadrado)", "1,91:1 (deitado)"]);
    expect(PROPORCAO_PADRAO).toBe("4:5");
  });
});

describe("geometriaDoEnquadramento", () => {
  it("a foto de celular em pé, cortada em 4:5: o miolo da foto, sem mudar a escala", () => {
    expect(geometriaDoEnquadramento({ largura: 1080, altura: 1920, proporcao: "4:5", modo: "cortar" })).toEqual({
      ok: true,
      largura: 1080,
      altura: 1350,
      origem: { x: 0, y: 285, largura: 1080, altura: 1350 },
      destino: { x: 0, y: 0, largura: 1080, altura: 1350 },
    });
  });

  it("a mesma foto inteira em 4:5: a altura toda, com borda dos dois lados, e a largura no teto de 1440", () => {
    expect(geometriaDoEnquadramento({ largura: 1080, altura: 1920, proporcao: "4:5", modo: "inteira" })).toEqual({
      ok: true,
      largura: 1440,
      altura: 1800,
      origem: { x: 0, y: 0, largura: 1080, altura: 1920 },
      destino: { x: 213, y: 0, largura: 1013, altura: 1800 },
    });
  });

  it("o print deitado cortado em 4:5: a faixa do meio, na altura toda", () => {
    expect(geometriaDoEnquadramento({ largura: 1920, altura: 1080, proporcao: "4:5", modo: "cortar" })).toEqual({
      ok: true,
      largura: 864,
      altura: 1080,
      origem: { x: 528, y: 0, largura: 864, altura: 1080 },
      destino: { x: 0, y: 0, largura: 864, altura: 1080 },
    });
  });

  it("o print deitado inteiro em 4:5: a largura toda, com borda em cima e embaixo", () => {
    expect(geometriaDoEnquadramento({ largura: 1920, altura: 1080, proporcao: "4:5", modo: "inteira" })).toEqual({
      ok: true,
      largura: 1440,
      altura: 1800,
      origem: { x: 0, y: 0, largura: 1920, altura: 1080 },
      destino: { x: 0, y: 495, largura: 1440, altura: 810 },
    });
  });

  it("a arte já em 4:5 não perde nada, nos dois modos", () => {
    for (const modo of MODOS) {
      expect(geometriaDoEnquadramento({ largura: 1080, altura: 1350, proporcao: "4:5", modo })).toEqual({
        ok: true,
        largura: 1080,
        altura: 1350,
        origem: { x: 0, y: 0, largura: 1080, altura: 1350 },
        destino: { x: 0, y: 0, largura: 1080, altura: 1350 },
      });
    }
  });

  it("acima de 1440 reduz até 1440, mantendo o recorte inteiro", () => {
    expect(geometriaDoEnquadramento({ largura: 2000, altura: 2500, proporcao: "4:5", modo: "cortar" })).toEqual({
      ok: true,
      largura: 1440,
      altura: 1800,
      origem: { x: 0, y: 0, largura: 2000, altura: 2500 },
      destino: { x: 0, y: 0, largura: 1440, altura: 1800 },
    });
  });

  it("o quadrado corta o meio de uma arte em pé", () => {
    expect(geometriaDoEnquadramento({ largura: 1080, altura: 1350, proporcao: "1:1", modo: "cortar" })).toEqual({
      ok: true,
      largura: 1080,
      altura: 1080,
      origem: { x: 0, y: 135, largura: 1080, altura: 1080 },
      destino: { x: 0, y: 0, largura: 1080, altura: 1080 },
    });
  });

  it("o 1,91:1 arredonda a altura para cima, para nunca passar de 1,91", () => {
    const g = geometriaDoEnquadramento({ largura: 1080, altura: 1350, proporcao: "1,91:1", modo: "cortar" });
    expect(g).toEqual({
      ok: true,
      largura: 1080,
      altura: 566,
      origem: { x: 0, y: 392, largura: 1080, altura: 566 },
      destino: { x: 0, y: 0, largura: 1080, altura: 566 },
    });
  });

  it("o corte que deixa a imagem estreita demais sugere as bordas", () => {
    expect(geometriaDoEnquadramento({ largura: 640, altura: 360, proporcao: "4:5", modo: "cortar" })).toEqual({
      ok: false,
      problema: "estreito_demais",
      sugereBordas: true,
    });
    expect(geometriaDoEnquadramento({ largura: 640, altura: 360, proporcao: "4:5", modo: "inteira" }).ok).toBe(true);
  });

  it("a imagem pequena demais nos dois modos não sugere nada: não se amplia imagem", () => {
    for (const modo of MODOS) {
      expect(geometriaDoEnquadramento({ largura: 300, altura: 300, proporcao: "1:1", modo })).toEqual({
        ok: false,
        problema: "estreito_demais",
        sugereBordas: false,
      });
    }
  });

  it("medida que não é número positivo não tem geometria", () => {
    for (const [largura, altura] of [
      [0, 100],
      [100, 0],
      [Number.NaN, 100],
      [-5, 100],
    ]) {
      expect(geometriaDoEnquadramento({ largura, altura, proporcao: "4:5", modo: "cortar" }).ok).toBe(false);
    }
  });

  // A VARREDURA DO ARREDONDAMENTO (achado 112). 4:5 fica EXATAMENTE no limite de 0,8 da Meta
  // (`problemaDoArquivo` recusa `proporcao < 0.8`), e um meio pixel para o lado errado vira recusa na
  // rota de assinar, depois de a pessoa montar o post inteiro. A auditoria contou, de 320 a 1440: a altura
  // do 4:5 arredondada ao mais próximo dá 560 saídas fora da faixa; para baixo, 0. A varredura passa cada
  // saída pela MESMA função que a rota usa, e confere o invariante pela razão.
  it("toda saída, de 320 a 1440 de largura, nas três proporções e nos dois modos, passa na regra da Meta", () => {
    const formas: [number, number][] = [];
    for (let l = 320; l <= 1440; l++) {
      formas.push([l, l * 3]); // em pé: a largura de saída é a da origem
      formas.push([l, Math.round(l * 1.3)]); // pouco mais alta que 4:5
      formas.push([l * 2, l]); // deitada
    }
    let conferidas = 0;
    for (const [largura, altura] of formas) {
      for (const proporcao of PROPORCOES) {
        for (const modo of MODOS) {
          const g = geometriaDoEnquadramento({ largura, altura, proporcao, modo });
          if (!g.ok) continue;
          conferidas++;
          const campos = [g.largura, g.altura, ...Object.values(g.origem), ...Object.values(g.destino)];
          expect(campos.every(Number.isInteger), `${largura}x${altura} ${proporcao} ${modo}`).toBe(true);
          expect(g.largura).toBeGreaterThanOrEqual(320);
          expect(g.largura).toBeLessThanOrEqual(1440);
          // O recorte dentro da imagem, e o desenho dentro do canvas.
          expect(g.origem.x >= 0 && g.origem.y >= 0).toBe(true);
          expect(g.origem.x + g.origem.largura).toBeLessThanOrEqual(largura);
          expect(g.origem.y + g.origem.altura).toBeLessThanOrEqual(altura);
          expect(g.destino.x >= 0 && g.destino.y >= 0).toBe(true);
          expect(g.destino.x + g.destino.largura).toBeLessThanOrEqual(g.largura);
          expect(g.destino.y + g.destino.altura).toBeLessThanOrEqual(g.altura);
          // O invariante pela razão.
          const razao = g.largura / g.altura;
          if (proporcao === "4:5") expect(razao, `${largura}x${altura} ${modo}`).toBeGreaterThanOrEqual(0.8);
          if (proporcao === "1,91:1") expect(razao, `${largura}x${altura} ${modo}`).toBeLessThanOrEqual(1.91);
          if (proporcao === "1:1") expect(g.largura).toBe(g.altura);
          // E a mesma régua da rota de assinar.
          expect(problemaDoArquivo("carrossel", { mime: "image/jpeg", bytes: 1, largura: g.largura, altura: g.altura }, Infinity)).toBe(null);
        }
      }
    }
    expect(conferidas).toBeGreaterThan(18_000);
  });
});

// O EXIF DE UM JPEG MÍNIMO: SOI, um APP1 com a orientação na IFD0, e EOI. A ordem dos bytes do TIFF vem
// nas duas formas que existem, "II" (Intel) e "MM" (Motorola).
function jpegComOrientacao(valor: number, ordem: "II" | "MM", antes: number[] = []): Uint8Array {
  const u16 = (n: number) => (ordem === "II" ? [n & 0xff, n >> 8] : [n >> 8, n & 0xff]);
  const u32 = (n: number) =>
    ordem === "II" ? [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, n >>> 24] : [n >>> 24, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
  const tiff = [
    ...(ordem === "II" ? [0x49, 0x49] : [0x4d, 0x4d]),
    ...u16(42),
    ...u32(8),
    ...u16(1),
    ...u16(0x0112),
    ...u16(3),
    ...u32(1),
    ...u16(valor),
    0,
    0,
    ...u32(0),
  ];
  const corpo = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const tamanho = corpo.length + 2;
  return new Uint8Array([0xff, 0xd8, ...antes, 0xff, 0xe1, tamanho >> 8, tamanho & 0xff, ...corpo, 0xff, 0xd9]);
}

describe("orientacaoDoJpeg", () => {
  it.each([1, 3, 6, 8])("lê a orientação %i, nas duas ordens de bytes", (valor) => {
    expect(orientacaoDoJpeg(jpegComOrientacao(valor, "II"))).toBe(valor);
    expect(orientacaoDoJpeg(jpegComOrientacao(valor, "MM"))).toBe(valor);
  });

  it("acha o APP1 depois de um APP0 (JFIF)", () => {
    const app0 = [0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00];
    expect(orientacaoDoJpeg(jpegComOrientacao(6, "MM", app0))).toBe(6);
  });

  it("JPEG sem EXIF, arquivo que não é JPEG e bytes cortados valem 1", () => {
    expect(orientacaoDoJpeg(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]))).toBe(1);
    expect(orientacaoDoJpeg(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(1);
    expect(orientacaoDoJpeg(jpegComOrientacao(6, "II").slice(0, 20))).toBe(1);
    expect(orientacaoDoJpeg(new Uint8Array([]))).toBe(1);
  });
});

describe("vaiSemRedesenho: o JPEG que o enquadramento não mudaria vai como veio", () => {
  const base = { mime: "image/jpeg", largura: 1080, altura: 1350, bytes: 500_000, proporcao: "4:5" as ProporcaoDoPost, orientacao: 1 };

  it("o JPEG exatamente em 4:5, de até 1440 px, com a orientação 1", () => {
    expect(vaiSemRedesenho(base)).toBe(true);
    expect(vaiSemRedesenho({ ...base, largura: 1080, altura: 1080, proporcao: "1:1" })).toBe(true);
    expect(vaiSemRedesenho({ ...base, largura: 1146, altura: 600, proporcao: "1,91:1" })).toBe(true);
  });

  it.each([3, 6, 8])("a foto girada pelo EXIF (%i) passa pelo canvas", (orientacao) => {
    expect(vaiSemRedesenho({ ...base, orientacao })).toBe(false);
  });

  it("PNG e WebP passam pelo canvas", () => {
    expect(vaiSemRedesenho({ ...base, mime: "image/png" })).toBe(false);
    expect(vaiSemRedesenho({ ...base, mime: "image/webp" })).toBe(false);
  });

  it("o que não é exato passa pelo canvas, mesmo a 1% da proporção", () => {
    expect(vaiSemRedesenho({ ...base, altura: 1351 })).toBe(false);
    expect(vaiSemRedesenho({ ...base, largura: 1081 })).toBe(false);
    expect(vaiSemRedesenho({ ...base, largura: 1000, altura: 1258 })).toBe(false); // 0,795
    expect(vaiSemRedesenho({ ...base, largura: 1152, altura: 600, proporcao: "1,91:1" })).toBe(false); // 1,92
    expect(vaiSemRedesenho({ ...base, proporcao: "1:1" })).toBe(false);
  });

  it("acima de 1440 px, acima de 8 MiB e sem medida passam pelo canvas", () => {
    expect(vaiSemRedesenho({ ...base, largura: 2000, altura: 2500 })).toBe(false);
    expect(vaiSemRedesenho({ ...base, bytes: 8 * MIB + 1 })).toBe(false);
    expect(vaiSemRedesenho({ ...base, bytes: 8 * MIB })).toBe(true);
    expect(vaiSemRedesenho({ ...base, largura: undefined })).toBe(false);
    expect(vaiSemRedesenho({ ...base, altura: undefined })).toBe(false);
  });
});

describe("problemaDaSaida: o vermelho da lista é o da saída prevista, e não o do original", () => {
  const imagem = (p: Partial<{ mime: string; largura: number; altura: number; bytes: number }> = {}) => ({
    mime: "image/jpeg",
    largura: 3024,
    altura: 4032,
    bytes: 3 * MIB,
    orientacao: 1,
    ...p,
  });

  it("a foto de celular 3:4 e o PNG em pé não ficam vermelhos: o canvas os enquadra", () => {
    expect(problemaDaSaida("carrossel", imagem(), "4:5", "cortar", Infinity)).toBe(null);
    expect(problemaDaSaida("carrossel", imagem({ mime: "image/png", largura: 2000, altura: 3000 }), "4:5", "cortar", Infinity)).toBe(null);
    expect(problemaDaSaida("imagem", imagem({ mime: "image/webp" }), "1:1", "inteira", Infinity)).toBe(null);
  });

  it("o original acima de 8 MiB não fica vermelho quando vai pelo canvas", () => {
    expect(problemaDaSaida("carrossel", imagem({ bytes: 12 * MIB }), "4:5", "cortar", Infinity)).toBe(null);
  });

  it("o formato que nem o canvas nem a Meta aceitam fica vermelho", () => {
    expect(problemaDaSaida("carrossel", imagem({ mime: "image/gif" }), "4:5", "cortar", Infinity)).toBe("tipo_nao_suportado");
    expect(problemaDaSaida("imagem", imagem({ mime: "image/heic" }), "4:5", "cortar", Infinity)).toBe("tipo_nao_suportado");
  });

  it("a imagem que o navegador não abriu fica vermelha, com frase própria", () => {
    expect(problemaDaSaida("carrossel", imagem({ largura: undefined as unknown as number }), "4:5", "cortar", Infinity)).toBe("imagem_ilegivel");
  });

  it("o corte estreito sugere as bordas; a imagem pequena nos dois modos, não", () => {
    expect(problemaDaSaida("carrossel", imagem({ largura: 640, altura: 360 }), "4:5", "cortar", Infinity)).toBe("estreito_no_corte");
    expect(problemaDaSaida("carrossel", imagem({ largura: 640, altura: 360 }), "4:5", "inteira", Infinity)).toBe(null);
    expect(problemaDaSaida("carrossel", imagem({ largura: 300, altura: 300 }), "1:1", "cortar", Infinity)).toBe("estreito_demais");
  });

  it("o cru é conferido como vai: o teto do armazenamento vale para ele", () => {
    const cru = imagem({ largura: 1080, altura: 1350, bytes: 600_000 });
    expect(problemaDaSaida("carrossel", cru, "4:5", "cortar", 100_000)).toBe("grande_para_o_bucket");
    expect(problemaDaSaida("carrossel", cru, "4:5", "cortar", Infinity)).toBe(null);
  });

  it("o vídeo do carrossel segue as regras de hoje", () => {
    const video = { mime: "video/mp4", largura: 1080, altura: 1920, bytes: 20 * MIB, segundos: 10, orientacao: 1 };
    expect(problemaDaSaida("carrossel", video, "4:5", "cortar", Infinity)).toBe(null);
    expect(problemaDaSaida("carrossel", { ...video, segundos: 2 }, "4:5", "cortar", Infinity)).toBe("curto_demais");
    expect(problemaDaSaida("imagem", video, "4:5", "cortar", Infinity)).toBe("tipo_nao_suportado");
  });

  it("o reels e o story continuam com as regras de hoje", () => {
    const video = { mime: "video/mp4", largura: 1080, altura: 1920, bytes: 20 * MIB, segundos: 30, orientacao: 1 };
    expect(problemaDaSaida("reels", video, "4:5", "cortar", Infinity)).toBe(null);
    expect(problemaDaSaida("reels", imagem(), "4:5", "cortar", Infinity)).toBe("tipo_nao_suportado");
    expect(problemaDaSaida("story", imagem({ mime: "image/png" }), "4:5", "cortar", Infinity)).toBe(null);
    expect(problemaDaSaida("story", imagem({ mime: "image/gif" }), "4:5", "cortar", Infinity)).toBe("tipo_nao_suportado");
    expect(problemaDaSaida("story", imagem({ largura: 200, altura: 400, bytes: 30_000 }), "4:5", "cortar", Infinity)).toBe("estreito_demais");
  });

  it("cada problema tem a sua frase, e os de hoje usam a frase de hoje", () => {
    expect(textoDoProblemaDaSaida("estreito_no_corte")).toBe(
      'Cortada nesta proporção, a imagem fica estreita demais (menos de 320 pixels). Use "Inteira, com bordas".'
    );
    expect(textoDoProblemaDaSaida("imagem_ilegivel")).toBe(
      "Não consegui abrir esta imagem neste navegador. Exporte em JPEG ou PNG e tente de novo."
    );
    expect(textoDoProblemaDaSaida("tipo_nao_suportado")).toBe(textoDoProblema("tipo_nao_suportado"));
  });
});

describe("problemaDoPrimeiroSlide: a Meta corta todos pela proporção do primeiro que sai", () => {
  const img = (valido = true) => ({ video: false, largura: 1080, altura: 1350, valido });
  const video = (largura?: number, altura?: number, valido = true) => ({ video: true, largura, altura, valido });

  it("a imagem em primeiro nunca trava", () => {
    expect(problemaDoPrimeiroSlide([img(), video(1080, 1920)], "4:5")).toBe(null);
  });

  it("o vídeo em primeiro na proporção escolhida, a 1%, não trava", () => {
    expect(problemaDoPrimeiroSlide([video(1080, 1350), img()], "4:5")).toBe(null);
    expect(problemaDoPrimeiroSlide([video(1086, 1350), img()], "4:5")).toBe(null);
  });

  it("o primeiro VÁLIDO decide: a imagem recusada na frente não conta", () => {
    expect(problemaDoPrimeiroSlide([img(false), video(1080, 1920), img()], "4:5")).toEqual({ motivo: "video_fora", proporcaoProxima: null });
  });

  it("o vídeo fora da proporção trava, e sugere a proporção só quando ele está a 1% de uma delas", () => {
    expect(problemaDoPrimeiroSlide([video(1080, 1080), img()], "4:5")).toEqual({ motivo: "video_fora", proporcaoProxima: "1:1" });
    expect(problemaDoPrimeiroSlide([video(1920, 1080), img()], "1,91:1")).toEqual({ motivo: "video_fora", proporcaoProxima: null });
  });

  it("o vídeo sem medida em primeiro trava, com frase própria", () => {
    expect(problemaDoPrimeiroSlide([video(), img()], "4:5")).toEqual({ motivo: "video_sem_medida" });
  });

  it("o carrossel só de vídeos não trava: não há imagem a proteger", () => {
    expect(problemaDoPrimeiroSlide([video(1080, 1920), video(1080, 1920)], "4:5")).toBe(null);
    expect(problemaDoPrimeiroSlide([video(1080, 1920), img(false)], "4:5")).toBe(null);
    expect(problemaDoPrimeiroSlide([], "4:5")).toBe(null);
  });

  it("as frases", () => {
    expect(textoDoProblemaDoPrimeiroSlide({ motivo: "video_fora", proporcaoProxima: null })).toBe(
      "O primeiro slide decide o corte de todos: ponha uma imagem em primeiro."
    );
    expect(textoDoProblemaDoPrimeiroSlide({ motivo: "video_fora", proporcaoProxima: "1:1" })).toBe(
      "O primeiro slide decide o corte de todos: ponha uma imagem em primeiro, ou escolha a proporção 1:1 (quadrado)."
    );
    expect(textoDoProblemaDoPrimeiroSlide({ motivo: "video_sem_medida" })).toBe(
      "Não consegui medir o vídeo do primeiro slide: ponha uma imagem em primeiro."
    );
  });
});

describe("a lista de montagem", () => {
  it("o carrossel acrescenta ao fim, até 10, e conta o que ficou de fora", () => {
    expect(acrescentarNaLista([1, 2], [3, 4], "carrossel")).toEqual({ lista: [1, 2, 3, 4], deFora: 0 });
    expect(acrescentarNaLista([1, 2, 3, 4, 5, 6, 7, 8], [9, 10, 11, 12], "carrossel")).toEqual({
      lista: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      deFora: 2,
    });
  });

  it("nas outras formas, escolher de novo troca o arquivo", () => {
    expect(acrescentarNaLista([1], [2], "imagem")).toEqual({ lista: [2], deFora: 0 });
    expect(acrescentarNaLista([1], [2, 3], "reels")).toEqual({ lista: [2], deFora: 1 });
    expect(acrescentarNaLista([1], [], "story")).toEqual({ lista: [1], deFora: 0 });
  });

  it("a contagem do post", () => {
    expect(textoDaContagem(1)).toBe("O post vai sair com 1 slide.");
    expect(textoDaContagem(4)).toBe("O post vai sair com 4 slides.");
  });
});

describe("o vídeo nas prévias", () => {
  it("pareceVideo lê a extensão, sem a query e sem o fragmento", () => {
    for (const c of ["a/b.mp4", "a/b.MOV", "a/b.m4v", "a/b.webm", "a/b.mp4?token=1", "a/b.mov#t=1"]) expect(pareceVideo(c), c).toBe(true);
    for (const c of ["a/b.jpg", "a/b.bin", "a/mp4", "a/b.mp4.jpg"]) expect(pareceVideo(c), c).toBe(false);
  });

  it("o reels é sempre vídeo; as outras formas, pela extensão, como o dreno faz", () => {
    expect(ehVideoNoPost("reels", "a/b.bin")).toBe(true);
    expect(ehVideoNoPost("story", "a/b.mp4")).toBe(true);
    expect(ehVideoNoPost("carrossel", "a/b.jpg")).toBe(false);
  });

  it("a capa é a primeira imagem do post, e o post só de vídeo não tem capa", () => {
    expect(capaDoPost("carrossel", ["a/1.mp4", "a/2.jpg", "a/3.jpg"])).toBe("a/2.jpg");
    expect(capaDoPost("carrossel", ["a/1.mp4", "a/2.mov"])).toBe(null);
    expect(capaDoPost("reels", ["a/1.bin"])).toBe(null);
    expect(capaDoPost("imagem", ["a/1.jpg"])).toBe("a/1.jpg");
    expect(capaDoPost("imagem", [])).toBe(null);
  });
});
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/publicacao-enquadramento.test.ts
```

Esperado: os 48 casos caem (48): as funções ainda não existem em `lib/publicacao.ts`.

- [ ] **Passo 3: o código**

Em `lib/publicacao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/publicacao.ts b/lib/publicacao.ts
index ef4fc78..4591485 100644
--- a/lib/publicacao.ts
+++ b/lib/publicacao.ts
@@ -545,7 +545,7 @@ export function decisaoDeAssinatura(corpo: unknown, teto: number): DecisaoDeAssi
  * ficou `.bin` porque o nome do arquivo não tinha extensão conhecida. Esse
  * continua sendo lido como imagem, e a Meta continua recusando alto.
  */
-function pareceVideo(url: string): boolean {
+export function pareceVideo(url: string): boolean {
   const semQuery = url.split(/[?#]/)[0].toLowerCase();
   return [".mp4", ".mov", ".m4v", ".webm"].some((ext) => semQuery.endsWith(ext));
 }
@@ -2505,3 +2505,381 @@ export function mediaIdParaVerNoInstagram(d: {
   if (!d.saiu) return null;
   return d.mediaId ?? null;
 }
+
+// =============================================================================
+// O ENQUADRAMENTO (spec 2026-10-19-enquadrar-imagens, o ponto 3 dos feedbacks
+// do Vinícius)
+//
+// O COMPOSITOR SÓ ACEITAVA OU RECUSAVA. Cada arquivo era conferido contra a
+// faixa da Meta, de 0,8 a 1,91 (`problemaDoArquivo`), e a foto de celular em
+// pé, 3:4 ou 9:16, caía fora sem oferta nenhuma de cortar. E o Instagram corta
+// todos os slides de um carrossel pela proporção do primeiro (citado da spec de
+// 03/09, não medido), sem o painel mostrar como fica.
+//
+// AGORA A PESSOA ESCOLHE A PROPORÇÃO, e cada imagem cabe nela de um de dois
+// jeitos: cortada ao centro, ou inteira com bordas brancas. Tudo o que decide
+// isso mora aqui, puro e com caso, pela regra do cabeçalho "AS DECISÕES DA TELA
+// DE COMPOR": o `canvas` só desenha o retângulo que sai daqui.
+// =============================================================================
+
+export type ProporcaoDoPost = "4:5" | "1:1" | "1,91:1";
+
+/**
+ * AS TRÊS PROPORÇÕES DO FEED, com a razão escrita como FRAÇÃO INTEIRA (largura
+ * sobre altura). A conta da altura é feita em inteiros por um motivo medido: 4:5
+ * fica EXATAMENTE no limite de 0,8 da Meta, e meio pixel para o lado errado vira
+ * recusa na rota de assinar depois de a pessoa montar o post inteiro (achado 112).
+ */
+export const PROPORCOES_DO_POST: readonly {
+  id: ProporcaoDoPost;
+  rotulo: string;
+  largura: number;
+  altura: number;
+}[] = [
+  { id: "4:5", rotulo: "4:5 (em pé)", largura: 4, altura: 5 },
+  { id: "1:1", rotulo: "1:1 (quadrado)", largura: 1, altura: 1 },
+  { id: "1,91:1", rotulo: "1,91:1 (deitado)", largura: 191, altura: 100 },
+];
+
+/** O 4:5 é o padrão (decisão do Eduardo): é o que ocupa mais espaço no feed, e é o que o gerador usa. */
+export const PROPORCAO_PADRAO: ProporcaoDoPost = "4:5";
+
+export type ModoDoEnquadramento = "cortar" | "inteira";
+
+/** Um retângulo em pixels inteiros: a origem do `drawImage` na imagem, ou o destino no `canvas`. */
+export type Retangulo = { x: number; y: number; largura: number; altura: number };
+
+export type GeometriaDoEnquadramento =
+  | { ok: true; largura: number; altura: number; origem: Retangulo; destino: Retangulo }
+  | { ok: false; problema: "estreito_demais"; sugereBordas: boolean };
+
+/** A tolerância do vídeo em primeiro: ele não é recortado, então "na proporção" admite 1%. */
+const TOLERANCIA_DA_PROPORCAO_DO_VIDEO = 0.01;
+
+function fracaoDa(p: ProporcaoDoPost): { largura: number; altura: number } {
+  return PROPORCOES_DO_POST.find((x) => x.id === p) ?? PROPORCOES_DO_POST[0];
+}
+
+/**
+ * A ALTURA DO CANVAS PELA LARGURA, sem nunca sair da faixa da Meta.
+ *
+ * O SENTIDO DO ARREDONDAMENTO É A REGRA INTEIRA. No 4:5 a razão tem de ficar
+ * em 0,8 ou ACIMA (a Meta recusa `largura / altura < 0.8`), então a altura
+ * arredonda para BAIXO; no 1,91:1 ela tem de ficar em 1,91 ou ABAIXO, então a
+ * altura arredonda para CIMA. Medido pela auditoria em 19/10, de 320 a 1440 de
+ * largura: o 4:5 arredondado ao mais próximo dá 560 saídas fora da faixa, e
+ * para baixo, 0. A largura sai sempre primeiro, e a altura sempre dela, para o
+ * sentido nunca inverter.
+ */
+function alturaPelaLargura(largura: number, f: { largura: number; altura: number }): number {
+  const exata = (largura * f.altura) / f.largura;
+  if (f.largura < f.altura) return Math.floor(exata);
+  if (f.largura > f.altura) return Math.ceil(exata);
+  return largura;
+}
+
+function medidaPositiva(n: number | undefined): n is number {
+  return typeof n === "number" && Number.isFinite(n) && n > 0;
+}
+
+function geometriaSemRecusa(
+  l: number,
+  a: number,
+  f: { largura: number; altura: number },
+  modo: ModoDoEnquadramento
+): { largura: number; altura: number; origem: Retangulo; destino: Retangulo } | null {
+  // A ORIGEM É MAIS LARGA QUE A PROPORÇÃO? A comparação é em inteiros, pela
+  // mesma razão da altura: `l / a > 0.8` em ponto flutuante erra no limite.
+  const maisLarga = l * f.altura > a * f.largura;
+  // Cortar guarda a dimensão que cabe; inteira guarda a que sobra. Sem passar de
+  // 1440, que é o teto de hoje (`CONVERSAO_LARGURA_MAX`): acima dele a Meta reduz
+  // sozinha, e os pixels a mais são bytes que sobem para nada.
+  const larguraNatural =
+    modo === "cortar"
+      ? maisLarga
+        ? Math.floor((a * f.largura) / f.altura)
+        : l
+      : maisLarga
+        ? l
+        : Math.floor((a * f.largura) / f.altura);
+  const largura = Math.min(larguraNatural, CONVERSAO_LARGURA_MAX);
+  if (largura < IMAGEM_LARGURA_MIN) return null;
+  const altura = alturaPelaLargura(largura, f);
+
+  if (modo === "cortar") {
+    // O RECORTE TEM A RAZÃO DA SAÍDA, e não a da fração: a saída já foi
+    // arredondada, e um recorte com outra razão seria esticado no desenho.
+    const sobraLargura = l * altura >= a * largura;
+    const sw = sobraLargura ? Math.min(l, Math.round((a * largura) / altura)) : l;
+    const sh = sobraLargura ? a : Math.min(a, Math.round((l * altura) / largura));
+    return {
+      largura,
+      altura,
+      origem: { x: Math.floor((l - sw) / 2), y: Math.floor((a - sh) / 2), largura: sw, altura: sh },
+      destino: { x: 0, y: 0, largura, altura },
+    };
+  }
+
+  // INTEIRA: a imagem toda, encostada nos dois lados que encostam, e centrada
+  // nos outros dois. O que sobra é o branco que o `canvas` pinta antes.
+  const encostaNaLargura = l * altura >= a * largura;
+  const dw = encostaNaLargura ? largura : Math.min(largura, Math.round((altura * l) / a));
+  const dh = encostaNaLargura ? Math.min(altura, Math.round((largura * a) / l)) : altura;
+  return {
+    largura,
+    altura,
+    origem: { x: 0, y: 0, largura: l, altura: a },
+    destino: { x: Math.floor((largura - dw) / 2), y: Math.floor((altura - dh) / 2), largura: dw, altura: dh },
+  };
+}
+
+/**
+ * O QUE O `canvas` DESENHA: a medida dele, e os dois retângulos do
+ * `drawImage(bitmap, origem…, destino…)`, todos em pixels inteiros.
+ *
+ * NÃO SE AMPLIA IMAGEM. A saída mais estreita que 320 px (`IMAGEM_LARGURA_MIN`)
+ * é recusa, e quando é o CORTE que a deixa estreita (um print 640×360 cortado em
+ * 4:5 dá 288 px) e a imagem inteira caberia, a recusa sugere as bordas.
+ */
+export function geometriaDoEnquadramento(p: {
+  largura: number;
+  altura: number;
+  proporcao: ProporcaoDoPost;
+  modo: ModoDoEnquadramento;
+}): GeometriaDoEnquadramento {
+  if (!medidaPositiva(p.largura) || !medidaPositiva(p.altura)) {
+    return { ok: false, problema: "estreito_demais", sugereBordas: false };
+  }
+  const f = fracaoDa(p.proporcao);
+  const g = geometriaSemRecusa(p.largura, p.altura, f, p.modo);
+  if (g) return { ok: true, ...g };
+  const sugereBordas = p.modo === "cortar" && geometriaSemRecusa(p.largura, p.altura, f, "inteira") !== null;
+  return { ok: false, problema: "estreito_demais", sugereBordas };
+}
+
+/**
+ * A ORIENTAÇÃO EXIF DE UM JPEG, lida dos bytes do começo do arquivo, ou 1.
+ *
+ * ELA EXISTE PORQUE O JPEG QUE VAI SEM REDESENHO leva a orientação gravada nele,
+ * e o código não mede se a Meta a respeita. A foto de celular em pé é o caso
+ * principal desta etapa, e o celular costuma gravá-la deitada com a orientação
+ * 6. Quem passa pelo `canvas` sai com a orientação aplicada
+ * (`createImageBitmap` com `imageOrientation: "from-image"`); quem iria cru com
+ * orientação diferente de 1 vai pelo `canvas` também (`vaiSemRedesenho`).
+ *
+ * É SÓ O SEGMENTO APP1 ("Exif\0\0"), a IFD0 e a etiqueta 0x0112, nas duas ordens
+ * de bytes do TIFF. Qualquer coisa fora disso (outro formato, bytes cortados,
+ * etiqueta ausente ou fora de 1 a 8) devolve 1, que é "nada a girar".
+ */
+export function orientacaoDoJpeg(b: Uint8Array): number {
+  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return 1;
+  let i = 2;
+  while (i + 4 <= b.length) {
+    if (b[i] !== 0xff) return 1;
+    const marcador = b[i + 1];
+    // EOI ou o começo da imagem (SOS): os cabeçalhos acabaram sem EXIF.
+    if (marcador === 0xd9 || marcador === 0xda) return 1;
+    const tamanho = (b[i + 2] << 8) | b[i + 3];
+    if (tamanho < 2) return 1;
+    const inicio = i + 4;
+    const fim = i + 2 + tamanho;
+    if (fim > b.length) return 1;
+    const ehExif =
+      marcador === 0xe1 &&
+      tamanho >= 8 &&
+      b[inicio] === 0x45 &&
+      b[inicio + 1] === 0x78 &&
+      b[inicio + 2] === 0x69 &&
+      b[inicio + 3] === 0x66 &&
+      b[inicio + 4] === 0 &&
+      b[inicio + 5] === 0;
+    if (ehExif) return orientacaoDoTiff(b, inicio + 6, fim);
+    i = fim;
+  }
+  return 1;
+}
+
+function orientacaoDoTiff(b: Uint8Array, t: number, fim: number): number {
+  if (t + 8 > fim) return 1;
+  const intel = b[t] === 0x49 && b[t + 1] === 0x49;
+  const motorola = b[t] === 0x4d && b[t + 1] === 0x4d;
+  if (!intel && !motorola) return 1;
+  const u16 = (p: number) => (intel ? b[p] | (b[p + 1] << 8) : (b[p] << 8) | b[p + 1]);
+  const u32 = (p: number) =>
+    (intel
+      ? b[p] | (b[p + 1] << 8) | (b[p + 2] << 16) | (b[p + 3] << 24)
+      : (b[p] << 24) | (b[p + 1] << 16) | (b[p + 2] << 8) | b[p + 3]) >>> 0;
+  if (u16(t + 2) !== 42) return 1;
+  const ifd = t + u32(t + 4);
+  if (ifd + 2 > fim) return 1;
+  const entradas = u16(ifd);
+  for (let k = 0; k < entradas; k++) {
+    const e = ifd + 2 + k * 12;
+    if (e + 12 > fim) return 1;
+    if (u16(e) === 0x0112) {
+      const v = u16(e + 8);
+      return v >= 1 && v <= 8 ? v : 1;
+    }
+  }
+  return 1;
+}
+
+/**
+ * O ARQUIVO VAI COMO VEIO, sem `canvas`, só quando o enquadramento não mudaria
+ * nenhum pixel. É a regra que o Vinícius deixou em `planoDaConversao` ("JPEG que
+ * já serve não passa pelo canvas", porque o `canvas` re-comprime e a perda vai
+ * ao perfil público), estendida à proporção.
+ *
+ * "NÃO MUDARIA NENHUM PIXEL" É EXATO, e não a 1%. O gerador aceita 0,792 a
+ * 0,808 (`lib/bonus/publicar-regras.ts`) porque lá a assinatura recusa abaixo de
+ * 0,8 depois; aqui um cru a 0,807 em primeiro faria a Meta cortar os outros em
+ * cerca de 12 px. E também: até 8 MiB (o teto da Meta para imagem), com medida,
+ * e com a orientação EXIF 1 (`orientacaoDoJpeg`).
+ */
+export function vaiSemRedesenho(p: {
+  mime: string;
+  largura?: number;
+  altura?: number;
+  bytes: number;
+  proporcao: ProporcaoDoPost;
+  orientacao: number;
+}): boolean {
+  if (p.mime !== "image/jpeg" || p.orientacao !== 1) return false;
+  if (!medidaPositiva(p.largura) || !medidaPositiva(p.altura)) return false;
+  if (p.bytes > IMAGEM_BYTES_MAX || p.largura > CONVERSAO_LARGURA_MAX) return false;
+  const g = geometriaDoEnquadramento({ largura: p.largura, altura: p.altura, proporcao: p.proporcao, modo: "cortar" });
+  return (
+    g.ok &&
+    g.largura === p.largura &&
+    g.altura === p.altura &&
+    g.origem.largura === p.largura &&
+    g.origem.altura === p.altura
+  );
+}
+
+/** O que impede um arquivo de entrar na lista: os de `problemaDoArquivo`, e mais dois do enquadramento. */
+export type ProblemaDaSaida = ProblemaDoArquivo | "estreito_no_corte" | "imagem_ilegivel";
+
+/**
+ * O VERMELHO DA LISTA, sobre a SAÍDA PREVISTA, e não sobre o original (achado
+ * 110). `problemaDoArquivo` sobre o original marcaria todo PNG e WebP (a Meta só
+ * aceita JPEG), a foto em pé (fora da faixa) e o original acima de 8 MiB, e esses
+ * três o `canvas` resolve. O `problemaDoArquivo` de sempre continua valendo,
+ * sobre o arquivo que de fato sobe, no clique.
+ *
+ * O REELS E O STORY seguem as regras de hoje: o reels só aceita vídeo, e o story
+ * converte imagem sem regra de proporção (`planoDaConversao`).
+ */
+export function problemaDaSaida(
+  forma: FormaDePublicacao,
+  arq: { mime: string; largura?: number; altura?: number; bytes: number; segundos?: number; orientacao: number },
+  proporcao: ProporcaoDoPost,
+  modo: ModoDoEnquadramento,
+  tetoDoBucketEmBytes: number
+): ProblemaDaSaida | null {
+  if (!arq.mime.startsWith("image/")) return problemaDoArquivo(forma, arq, tetoDoBucketEmBytes);
+  if (forma === "reels" || !MIMES_QUE_O_CANVAS_CONVERTE.includes(arq.mime)) return "tipo_nao_suportado";
+  if (!medidaPositiva(arq.largura) || !medidaPositiva(arq.altura)) return "imagem_ilegivel";
+
+  if (forma === "story") {
+    const plano = planoDaConversao(arq);
+    if (!plano.converter) return problemaDoArquivo(forma, arq, tetoDoBucketEmBytes);
+    const largura = plano.largura > 0 ? plano.largura : arq.largura;
+    return largura < IMAGEM_LARGURA_MIN ? "estreito_demais" : null;
+  }
+
+  const g = geometriaDoEnquadramento({ largura: arq.largura, altura: arq.altura, proporcao, modo });
+  if (!g.ok) return g.sugereBordas ? "estreito_no_corte" : "estreito_demais";
+  if (vaiSemRedesenho({ ...arq, proporcao })) return problemaDoArquivo(forma, arq, tetoDoBucketEmBytes);
+  return null;
+}
+
+export function textoDoProblemaDaSaida(p: ProblemaDaSaida): string {
+  switch (p) {
+    case "estreito_no_corte":
+      return 'Cortada nesta proporção, a imagem fica estreita demais (menos de 320 pixels). Use "Inteira, com bordas".';
+    case "imagem_ilegivel":
+      return "Não consegui abrir esta imagem neste navegador. Exporte em JPEG ou PNG e tente de novo.";
+    default:
+      return textoDoProblema(p);
+  }
+}
+
+export type ProblemaDoPrimeiroSlide =
+  | { motivo: "video_fora"; proporcaoProxima: ProporcaoDoPost | null }
+  | { motivo: "video_sem_medida" };
+
+/**
+ * A TRAVA DO PRIMEIRO SLIDE (achado 111). A Meta corta todos os slides pela
+ * proporção do PRIMEIRO QUE SAI, e o vídeo não é recortado: um vídeo deitado em
+ * primeiro mandaria no corte de todas as imagens que acabaram de ser enquadradas.
+ *
+ * O PRIMEIRO É O PRIMEIRO VÁLIDO: a linha vermelha da lista não sai, então não
+ * manda em nada. O vídeo sem medida (o navegador não o abriu) trava também,
+ * porque não dá para saber o corte. E o carrossel SÓ DE VÍDEOS, aceito hoje,
+ * continua aceito: não há imagem enquadrada a proteger.
+ */
+export function problemaDoPrimeiroSlide(
+  itens: { video: boolean; largura?: number; altura?: number; valido: boolean }[],
+  proporcao: ProporcaoDoPost
+): ProblemaDoPrimeiroSlide | null {
+  const validos = itens.filter((i) => i.valido);
+  if (!validos.some((i) => !i.video)) return null;
+  const primeiro = validos[0];
+  if (!primeiro.video) return null;
+  if (!medidaPositiva(primeiro.largura) || !medidaPositiva(primeiro.altura)) return { motivo: "video_sem_medida" };
+  const razao = primeiro.largura / primeiro.altura;
+  const perto = (p: ProporcaoDoPost) => {
+    const f = fracaoDa(p);
+    const alvo = f.largura / f.altura;
+    return Math.abs(razao - alvo) / alvo <= TOLERANCIA_DA_PROPORCAO_DO_VIDEO;
+  };
+  if (perto(proporcao)) return null;
+  return { motivo: "video_fora", proporcaoProxima: PROPORCOES_DO_POST.map((p) => p.id).find(perto) ?? null };
+}
+
+export function textoDoProblemaDoPrimeiroSlide(p: ProblemaDoPrimeiroSlide): string {
+  if (p.motivo === "video_sem_medida") {
+    return "Não consegui medir o vídeo do primeiro slide: ponha uma imagem em primeiro.";
+  }
+  const base = "O primeiro slide decide o corte de todos: ponha uma imagem em primeiro";
+  return p.proporcaoProxima ? `${base}, ou escolha a proporção ${fracaoRotulo(p.proporcaoProxima)}.` : `${base}.`;
+}
+
+function fracaoRotulo(p: ProporcaoDoPost): string {
+  return PROPORCOES_DO_POST.find((x) => x.id === p)?.rotulo ?? p;
+}
+
+/**
+ * ESCOLHER DE NOVO, na lista de montagem. No carrossel, acrescenta ao fim até
+ * `CARROSSEL_ITENS_MAX`, e diz quantos ficaram de fora, para a tela avisar. Nas
+ * outras formas, que publicam um arquivo só, troca o arquivo.
+ */
+export function acrescentarNaLista<T>(lista: T[], novos: T[], forma: FormaDePublicacao): { lista: T[]; deFora: number } {
+  if (forma === "carrossel") {
+    const juntos = [...lista, ...novos];
+    return { lista: juntos.slice(0, CARROSSEL_ITENS_MAX), deFora: Math.max(0, juntos.length - CARROSSEL_ITENS_MAX) };
+  }
+  if (!novos.length) return { lista, deFora: 0 };
+  return { lista: novos.slice(0, 1), deFora: novos.length - 1 };
+}
+
+/** A frase acima da lista do carrossel: quantos slides vão sair, contando só os válidos. */
+export function textoDaContagem(validos: number): string {
+  return validos === 1 ? "O post vai sair com 1 slide." : `O post vai sair com ${validos} slides.`;
+}
+
+/**
+ * É VÍDEO NA PRÉVIA? O reels sempre é; as outras formas, pela extensão do
+ * caminho, como o dreno decide `video_url` contra `image_url`
+ * (`parametrosDoContainer`). As prévias da página do post e do calendário
+ * desenhavam `<img>` para todo caminho, e o vídeo saía como imagem quebrada.
+ */
+export function ehVideoNoPost(forma: FormaDePublicacao, caminho: string): boolean {
+  return forma === "reels" || pareceVideo(caminho);
+}
+
+/** A capa do calendário: o primeiro caminho de imagem do post, ou nada quando ele só tem vídeo. */
+export function capaDoPost(forma: FormaDePublicacao, caminhos: string[]): string | null {
+  return caminhos.find((c) => !ehVideoNoPost(forma, c)) ?? null;
+}
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx eslint lib/publicacao.ts tests/publicacao-enquadramento.test.ts
npx vitest run tests/publicacao-enquadramento.test.ts tests/publicacao.test.ts
```

Esperado: `tsc` e lint limpos; os 2 arquivos passam, com 317 casos (os 48 novos e os 269 de `tests/publicacao.test.ts`).

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/publicacao.ts tests/publicacao-enquadramento.test.ts
test "$(git branch --show-current)" = "enquadrar-imagens"
git add lib/publicacao.ts tests/publicacao-enquadramento.test.ts
```

```bash
git commit -F - <<'MSG'
As regras do enquadramento do /publicar ficam puras, com a varredura do arredondamento

O compositor só aceitava ou recusava cada imagem pela faixa da Meta. As regras
novas dão o retângulo do corte ao centro ou da imagem inteira com bordas na
proporção escolhida, quando o JPEG vai como veio, o vermelho da lista sobre a
saída prevista, a trava do vídeo em primeiro e a capa das prévias. O 4:5 fica no
limite exato da Meta, e uma varredura de 320 a 1440 de largura pega o meio pixel
arredondado para o lado errado.
MSG
```

---

### FASE 2 — A frase do post encerrado decide pelo motivo (achado 113)

**Arquivos:**
- Modificar: `lib/publicacao.ts` (`fraseSobreAMidia`), `app/publicar/post/[id]/page.tsx` (a chamada)
- Testar: `tests/publicacao.test.ts`

**Interfaces:**
- Produz: `fraseSobreAMidia(d: { saiu: boolean; encerrado: boolean }, motivo: string | null)`.

- [ ] **Passo 1: os testes**

Em `tests/publicacao.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/publicacao.test.ts b/tests/publicacao.test.ts
index c05cac5..15d20e9 100644
--- a/tests/publicacao.test.ts
+++ b/tests/publicacao.test.ts
@@ -2653,32 +2653,41 @@ describe("fraseSobreAMidia — a tela irma nao pode dizer o contrario", () => {
     });
 
   it("publicado: a midia foi apagada, e a frase diz por que", () => {
-    const t = fraseSobreAMidia(daFila("sent", new Date()))!;
+    const t = fraseSobreAMidia(daFila("sent", new Date()), null)!;
     expect(t).toContain("já saiu");
     expect(t).toContain("apagada");
   });
 
   it("falhado: NAO saiu, e o arquivo CONTINUA la", () => {
-    const t = fraseSobreAMidia(daFila("failed", null))!;
+    const t = fraseSobreAMidia(daFila("failed", null), "a Meta respondeu 500")!;
     expect(t).not.toContain("já saiu");
     expect(t).toContain("continua no armazenamento");
   });
 
-  it("cancelado: a mesma frase do falhado — os dois nao vao sair", () => {
-    const t = fraseSobreAMidia(daFila("skipped", null))!;
-    expect(t).not.toContain("já saiu");
-    expect(t).toContain("continua no armazenamento");
+  // O ACHADO 113 (19/10/2026): esta frase dizia que o arquivo do CANCELADO continuava no
+  // armazenamento, e o cancelar o apaga (`app/publicar/post/actions.ts`, `limparOBucket`). As provas
+  // de 15, 16 e 19/10 mediram 400 no bucket depois de cancelar. A frase decide pelo MOTIVO, e nao pelo
+  // status, como o `statusBadge` (app/labels.ts) ja faz: o dreno tambem grava `skipped`, e la o
+  // arquivo fica.
+  it("cancelado pelo painel: o arquivo foi APAGADO", () => {
+    const t = fraseSobreAMidia(daFila("skipped", null), MOTIVO_CANCELADO_PELO_DONO)!;
+    expect(t).toBe("Este post foi cancelado e não vai sair. O arquivo foi apagado do armazenamento.");
+  });
+
+  it("pulado pelo dreno, com a conta desconectada: o arquivo CONTINUA la", () => {
+    const t = fraseSobreAMidia(daFila("skipped", null), "conta não conectada")!;
+    expect(t).toBe("Este post não saiu e não vai sair. O arquivo continua no armazenamento.");
   });
 
   it("agendado: nao ha nada a explicar, e a midia esta ali do lado", () => {
-    expect(fraseSobreAMidia(daFila("pending", null))).toBe(null);
+    expect(fraseSobreAMidia(daFila("pending", null), null)).toBe(null);
   });
 
   it("A PERGUNTA E `saiu`, e nunca 'nao e pending'", () => {
     // A invariante que impede o defeito de voltar: dos quatro estados, so UM
     // recebe a frase de "ja saiu".
     const dizemQueSaiu = ["sent", "failed", "skipped", "pending"].filter((st) => {
-      const t = fraseSobreAMidia(daFila(st, st === "sent" ? new Date() : null));
+      const t = fraseSobreAMidia(daFila(st, st === "sent" ? new Date() : null), null);
       return t !== null && t.includes("já saiu");
     });
     expect(dizemQueSaiu).toEqual(["sent"]);
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/publicacao.test.ts
```

Esperado: 1 cai e 269 passam (270): o cancelado pelo painel ainda diz que o arquivo ficou.

- [ ] **Passo 3: o código**

Em `lib/publicacao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/publicacao.ts b/lib/publicacao.ts
index 4591485..403537d 100644
--- a/lib/publicacao.ts
+++ b/lib/publicacao.ts
@@ -2397,13 +2397,25 @@ export const MOTIVO_NAO_REGISTRADO =
  * contrário: *"O arquivo continua no armazenamento"*. Duas telas do mesmo
  * produto dizendo coisas opostas sobre o mesmo arquivo.
  *
- * A MÍDIA SÓ É APAGADA DEPOIS DE PUBLICAR (`limparOBucket`, lib/queue-drain.ts),
+ * A MÍDIA É APAGADA DEPOIS DE PUBLICAR (`limparOBucket`, lib/queue-drain.ts),
  * e por isso a pergunta certa é `saiu`, e nunca "não é pending".
- */
-export function fraseSobreAMidia(d: {
-  saiu: boolean;
-  encerrado: boolean;
-}): string | null {
+ *
+ * E TAMBÉM NO CANCELAR (achado 113, 19/10/2026). O cancelar do painel apaga a
+ * mídia (`app/publicar/post/actions.ts`, `limparOBucket`), e esta frase dizia o
+ * contrário: as provas de 15, 16 e 19/10 mediram 400 no bucket depois de
+ * cancelar. Quem decide é o MOTIVO, e não o status, como o `statusBadge`
+ * (app/labels.ts) já faz com `MOTIVO_CANCELADO_PELO_DONO`: o dreno também grava
+ * `skipped` ("conta não conectada", lib/queue-drain.ts) sem tocar no bucket, e o
+ * `failed` mantém o arquivo ("Objeto de item falhado não é órfão"). O motivo é
+ * obrigatório, para quem chamar não esquecer a pergunta.
+ */
+export function fraseSobreAMidia(
+  d: {
+    saiu: boolean;
+    encerrado: boolean;
+  },
+  motivo: string | null
+): string | null {
   if (d.saiu) {
     return (
       "Este post já saiu. A mídia foi apagada do armazenamento depois da " +
@@ -2411,9 +2423,12 @@ export function fraseSobreAMidia(d: {
     );
   }
   if (d.encerrado) {
-    // NÃO SAIU E NÃO VAI SAIR: cancelado ou recusado. O arquivo CONTINUA lá, e
-    // dizer isso é o que permite ao dono agendar de novo sem subir tudo outra
-    // vez. É a mesma frase da seção "Não saíram".
+    if (motivo?.trim() === MOTIVO_CANCELADO_PELO_DONO) {
+      return "Este post foi cancelado e não vai sair. O arquivo foi apagado do armazenamento.";
+    }
+    // NÃO SAIU E NÃO VAI SAIR, e o arquivo CONTINUA lá: o que falhou e o que o
+    // dreno pulou. Dizer isso é o que permite ao dono agendar de novo sem subir
+    // tudo outra vez. É a mesma frase da seção "Não saíram".
     return "Este post não saiu e não vai sair. O arquivo continua no armazenamento.";
   }
   // Ainda vai sair: não há nada a explicar sobre a mídia, e ela está ali do lado.
```

Em `app/publicar/post/[id]/page.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/publicar/post/[id]/page.tsx b/app/publicar/post/[id]/page.tsx
index 1eca5ed..25a436b 100644
--- a/app/publicar/post/[id]/page.tsx
+++ b/app/publicar/post/[id]/page.tsx
@@ -102,7 +102,7 @@ export default async function DetalheDaPublicacao({
   // duas moravam nesta mesma variável, e por isso um post falhado recebia
   // "este post já saiu". Ver `fraseSobreAMidia`.
   const podeMexer = item.status === "pending";
-  const sobreAMidia = fraseSobreAMidia(quando);
+  const sobreAMidia = fraseSobreAMidia(quando, item.error);
   // A MÍDIA SÓ EXISTE ENQUANTO O POST NÃO SAIU. Ver o cabeçalho.
   // AS URLS SÃO MONTADAS AQUI, e as que não derem saem da lista: `null` vira
   // imagem quebrada se chegar num `src`. Ver `urlPublicaSeDerParaMontar`.
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx eslint lib/publicacao.ts "app/publicar/post/[id]/page.tsx" tests/publicacao.test.ts
npx vitest run tests/publicacao.test.ts
```

Esperado: `tsc` e lint limpos; os 270 passam.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/publicacao.ts "app/publicar/post/[id]/page.tsx" tests/publicacao.test.ts
test "$(git branch --show-current)" = "enquadrar-imagens"
git add lib/publicacao.ts "app/publicar/post/[id]/page.tsx" tests/publicacao.test.ts
```

```bash
git commit -F - <<'MSG'
A página do post cancelado diz que o arquivo foi apagado

O cancelar do painel apaga a mídia do armazenamento, e a página dizia que o
arquivo continuava lá. As provas de 15, 16 e 19/10 mediram o arquivo apagado. A
frase passa a decidir pelo motivo, como o selo do status já faz: o que falhou e
o que o dreno pulou mantêm o arquivo, e o cancelado pelo dono, não.
MSG
```

---

### FASE 3 — O vídeo aparece como vídeo nas prévias

**Arquivos:**
- Modificar: `app/publicar/post/[id]/page.tsx`, `app/publicar/page.tsx`
- Criar: `tests/publicar-previas.test.ts`

**Interfaces:**
- Consome: `ehVideoNoPost` e `capaDoPost` (FASE 1).

- [ ] **Passo 1: a guarda**

Crie `tests/publicar-previas.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// AS PRÉVIAS COM VÍDEO DO /publicar (spec 2026-10-19-enquadrar-imagens, "As prévias com vídeo"). A
// página do post desenhava `<img>` para todo caminho, e o calendário usava o primeiro caminho como capa:
// o vídeo saía como imagem quebrada, nas quatro formas. A decisão (é vídeo? qual é a capa?) é pura e tem
// caso em tests/publicacao-enquadramento.test.ts; aqui se cobra que as duas telas a perguntem, e não a
// refaçam no JSX. As duas são de servidor e leem o banco, e a integração de `nao-saiu` não liga o
// bucket (a capa ali é nula), então a guarda lê o arquivo, no jeito das outras guardas de página.

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const ler = (rel: string) => readFileSync(`${RAIZ}/${rel}`, "utf8");

describe("a página do post", () => {
  const pagina = ler("app/publicar/post/[id]/page.tsx");

  it("pergunta à regra pura se cada caminho é vídeo, e desenha <video> para ele", () => {
    expect(pagina).toContain("ehVideoNoPost(p.forma, m.caminho)");
    expect(pagina).toMatch(/<video[\s\S]*?muted[\s\S]*?preload="metadata"/);
  });
});

describe("o calendário", () => {
  const pagina = ler("app/publicar/page.tsx");

  it("pede a capa à regra pura, e não pega o primeiro caminho", () => {
    expect(pagina).toContain("capaDoPost(p.forma, p.caminhos)");
    expect(pagina).not.toContain("p?.caminhos?.[0]");
  });
});
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/publicar-previas.test.ts
```

Esperado: os 2 casos caem (2): as duas telas ainda não perguntam à regra pura.

- [ ] **Passo 3: o código**

Em `app/publicar/post/[id]/page.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/publicar/post/[id]/page.tsx b/app/publicar/post/[id]/page.tsx
index 25a436b..3a7ed44 100644
--- a/app/publicar/post/[id]/page.tsx
+++ b/app/publicar/post/[id]/page.tsx
@@ -16,6 +16,7 @@ import {
   rotuloDaFormaDoItem,
   fraseSobreAMidia,
   mediaIdParaVerNoInstagram,
+  ehVideoNoPost,
 } from "@/lib/publicacao";
 import { resolvePosts } from "@/lib/media-lookup";
 import {
@@ -194,24 +195,49 @@ export default async function DetalheDaPublicacao({
               {midia.length === 1 ? "Mídia" : `${midia.length} mídias`}
             </h2>
             <div className="mt-2 flex flex-wrap gap-2">
-              {midia.map((m) => (
-                // O BUCKET É PÚBLICO POR EXIGÊNCIA DA META, que baixa a mídia do
-                // nosso endereço com um cliente sem token (lib/bucket.ts). Então
-                // a prévia não custa assinatura nenhuma.
-                //
-                // `<img>` E NÃO `next/image`: o endereço é do Supabase e mudaria
-                // a cada post, e configurar domínio remoto para uma prévia de
-                // 96px é pagar caro por nada. `alt` vazio de propósito — a
-                // legenda ao lado já diz o que é, e um alt inventado sobre uma
-                // imagem que ninguém descreveu seria pior que silêncio.
-                // eslint-disable-next-line @next/next/no-img-element
-                <img
-                  key={m.caminho}
-                  src={m.url}
-                  alt=""
-                  className="h-24 w-24 rounded-xl border border-traco object-cover dark:border-traco-escuro"
-                />
-              ))}
+              {midia.map((m) =>
+                // O VÍDEO É VÍDEO NA PRÉVIA (spec 2026-10-19-enquadrar-imagens).
+                // Esta lista desenhava `<img>` para todo caminho, e o `.mp4` do
+                // carrossel, do reels ou do story saía como imagem quebrada. Quem
+                // decide é `ehVideoNoPost`, a mesma regra do dreno. O `<video>`
+                // vem mudo e só com os metadados, que bastam para o primeiro
+                // quadro: baixar o vídeo inteiro para uma prévia de 96px seria
+                // pagar banda por nada.
+                p && ehVideoNoPost(p.forma, m.caminho) ? (
+                  <span key={m.caminho} className="relative block h-24 w-24">
+                    <video
+                      src={m.url}
+                      muted
+                      playsInline
+                      preload="metadata"
+                      className="h-24 w-24 rounded-xl border border-traco object-cover dark:border-traco-escuro"
+                    />
+                    <span
+                      aria-hidden
+                      className="absolute bottom-1 right-1 rounded-lg bg-black/60 px-1 text-[11px] text-white"
+                    >
+                      ▶ vídeo
+                    </span>
+                  </span>
+                ) : (
+                  // O BUCKET É PÚBLICO POR EXIGÊNCIA DA META, que baixa a mídia do
+                  // nosso endereço com um cliente sem token (lib/bucket.ts). Então
+                  // a prévia não custa assinatura nenhuma.
+                  //
+                  // `<img>` E NÃO `next/image`: o endereço é do Supabase e mudaria
+                  // a cada post, e configurar domínio remoto para uma prévia de
+                  // 96px é pagar caro por nada. `alt` vazio de propósito — a
+                  // legenda ao lado já diz o que é, e um alt inventado sobre uma
+                  // imagem que ninguém descreveu seria pior que silêncio.
+                  // eslint-disable-next-line @next/next/no-img-element
+                  <img
+                    key={m.caminho}
+                    src={m.url}
+                    alt=""
+                    className="h-24 w-24 rounded-xl border border-traco object-cover dark:border-traco-escuro"
+                  />
+                )
+              )}
             </div>
           </div>
         )}
```

Em `app/publicar/page.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/publicar/page.tsx b/app/publicar/page.tsx
index cc287b5..b07ae12 100644
--- a/app/publicar/page.tsx
+++ b/app/publicar/page.tsx
@@ -10,6 +10,7 @@ import {
   linhaDaFalha,
   rotuloDaFormaDoItem,
   FRASE_DA_FALHA,
+  capaDoPost,
 } from "@/lib/publicacao";
 import {
   card,
@@ -445,7 +446,13 @@ export default async function Agendados({
                         // dreno apaga a mídia do bucket depois de publicar
                         // (`limparOBucket`). Num post publicado a prévia seria
                         // uma imagem quebrada, então nem se tenta.
-                        const primeira = !saiu ? p?.caminhos?.[0] : undefined;
+                        //
+                        // E A CAPA É A PRIMEIRA IMAGEM, e não o primeiro
+                        // caminho (spec 2026-10-19-enquadrar-imagens): o
+                        // vídeo saía como imagem quebrada. O post só de vídeo
+                        // fica sem capa, e a célula desenha o ícone dele.
+                        const primeira = !saiu && p ? capaDoPost(p.forma, p.caminhos) : null;
+                        const soVideo = !saiu && !!p && p.caminhos.length > 0 && primeira === null;
                         // `null` QUANDO O AMBIENTE NÃO DEIXA MONTAR A URL, e
                         // aí a célula desenha o símbolo em vez de uma imagem
                         // quebrada. Prévia não vale uma tela — ver
@@ -494,7 +501,7 @@ export default async function Agendados({
                                 aria-hidden
                                 className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-traco text-[11px] dark:bg-traco-escuro"
                               >
-                                {saiu ? "✓" : "•"}
+                                {saiu ? "✓" : soVideo ? "▶" : "•"}
                               </span>
                             )}
                             {/* O PONTO DE ESTADO — do tamanho de um sinal, que é
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx eslint app/publicar/page.tsx "app/publicar/post/[id]/page.tsx" tests/publicar-previas.test.ts
npx vitest run tests/publicar-previas.test.ts tests/escala.test.ts
```

Esperado: `tsc` e lint limpos; os 2 arquivos passam, com 16 casos (a guarda da escala aceita o selo de vídeo).

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" app/publicar/page.tsx "app/publicar/post/[id]/page.tsx" tests/publicar-previas.test.ts
test "$(git branch --show-current)" = "enquadrar-imagens"
git add app/publicar/page.tsx "app/publicar/post/[id]/page.tsx" tests/publicar-previas.test.ts
```

```bash
git commit -F - <<'MSG'
O vídeo aparece como vídeo nas prévias do /publicar

A página do post desenhava imagem para todo caminho, e o calendário usava o
primeiro caminho como capa: o vídeo do carrossel, do reels e do story saía como
imagem quebrada. A página passa a desenhar o vídeo mudo, só com o primeiro
quadro, e o calendário usa a primeira imagem do post como capa, com o ícone de
vídeo no post que só tem vídeo. As duas perguntam à mesma regra do dreno.
MSG
```

---

### FASE 4 — A recusa sem arquivo deixa de mandar esperar o envio

**Arquivos:**
- Modificar: `lib/publicacao.ts` (`textoDaRecusaDaPublicacao`)
- Testar: `tests/publicacao.test.ts`, `testes-integracao/publicar-fala.integracao.ts`

- [ ] **Passo 1: os testes**

Em `tests/publicacao.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/publicacao.test.ts b/tests/publicacao.test.ts
index 15d20e9..00b76f4 100644
--- a/tests/publicacao.test.ts
+++ b/tests/publicacao.test.ts
@@ -1401,6 +1401,13 @@ describe("textoDaRecusaDaPublicacao", () => {
     }
   });
 
+  // O ENVIO SAIU DE ANTES DO BOTÃO (spec 2026-10-19-enquadrar-imagens): o arquivo sobe no clique, e
+  // "espere o envio terminar" mandaria esperar algo que a tela já não faz antes. A action continua
+  // recusando sem arquivo, como defesa: o campo é do navegador.
+  it("sem arquivo: a frase não manda esperar envio nenhum", () => {
+    expect(textoDaRecusaDaPublicacao("sem_arquivo")).toBe("Escolha um arquivo antes de publicar.");
+  });
+
   // AS TRÊS RECUSAS DE HORA SÃO TRÊS CONSELHOS DIFERENTES, e é por isso que
   // `momentoDaPublicacao` devolve três motivos em vez de um "não deu". Se as
   // frases fossem iguais, a distinção que aquela função faz não chegaria a
```

Em `testes-integracao/publicar-fala.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/publicar-fala.integracao.ts b/testes-integracao/publicar-fala.integracao.ts
index 9deefad..02f7f80 100644
--- a/testes-integracao/publicar-fala.integracao.ts
+++ b/testes-integracao/publicar-fala.integracao.ts
@@ -501,7 +501,7 @@ describe("com a conta selecionada pelo tombo declarado (a primeira do schema)",
     expect(d.digest ?? "").toMatch(/^NEXT_REDIRECT/);
     const aviso = avisoDaUrlDeVolta(d.url);
     expect(aviso.tom).toBe("erro");
-    expect(aviso.texto).toBe("Escolha um arquivo e espere o envio terminar antes de publicar.");
+    expect(aviso.texto).toBe("Escolha um arquivo antes de publicar.");
   });
 
   test("legenda longa demais recusa com a MESMA frase que a tela já mostrava", async () => {
@@ -605,7 +605,7 @@ describe("com a conta selecionada pelo tombo declarado (a primeira do schema)",
     // A MESMA RECUSA DE CAMPO VAZIO: depois do filtro pela pasta do cookie,
     // não sobrou caminho nenhum — e é essa a verdade que a frase conta.
     expect(aviso.tom).toBe("erro");
-    expect(aviso.texto).toBe("Escolha um arquivo e espere o envio terminar antes de publicar.");
+    expect(aviso.texto).toBe("Escolha um arquivo antes de publicar.");
 
     // NADA ENTROU NA FILA DE CONTA_A apontando para o arquivo de CONTA_B —
     // nem um item a mais em CONTA_A, nem qualquer item para CONTA_B (nenhuma
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run tests/publicacao.test.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/publicar-fala.integracao.ts
```

Esperado: nos puros, 1 cai e 270 passam (271): a frase ainda manda esperar o envio. Na integração,
`[rede-global] ALVO: banco de TESTE`, 2 caem e 15 passam (17): o campo vazio e o caminho de outra conta,
que recebem a mesma frase.

- [ ] **Passo 3: o código**

Em `lib/publicacao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/publicacao.ts b/lib/publicacao.ts
index 403537d..cdce267 100644
--- a/lib/publicacao.ts
+++ b/lib/publicacao.ts
@@ -1473,11 +1473,13 @@ export function textoDaRecusaDaPublicacao(motivo: RecusaDaPublicacao): string {
   switch (motivo) {
     case "sem_conta":
       return "Nenhuma conta do Instagram está selecionada. Conecte ou escolha uma conta antes de publicar.";
-    // O ARQUIVO É O QUE FALTA COM MAIS FREQUÊNCIA, e o motivo é a forma da
-    // tela: o envio ao bucket acontece ANTES do botão, e quem clica cedo
-    // demais chega aqui sem caminho nenhum.
+    // O ENVIO AO BUCKET ERA ANTES DO BOTÃO, e esta frase mandava esperar ele
+    // terminar. Desde a spec 2026-10-19-enquadrar-imagens o arquivo sobe NO
+    // clique, e a tela confere a quantidade antes de subir: aqui só chega o
+    // campo vazio de quem chamou a ação sem a tela, ou o caminho de outra
+    // pasta, que `caminhosDoCampo` descarta.
     case "sem_arquivo":
-      return "Escolha um arquivo e espere o envio terminar antes de publicar.";
+      return "Escolha um arquivo antes de publicar.";
     case "forma_desconhecida":
       return "Escolha entre imagem, carrossel, reels e story.";
     // AS TRÊS FRASES DA QUANTIDADE DIZEM O QUE FAZER, e cada uma diz outra
```

- [ ] **Passo 4: ver passar**

```bash
npx tsc --noEmit
npx eslint lib/publicacao.ts tests/publicacao.test.ts testes-integracao/publicar-fala.integracao.ts
npx vitest run tests/publicacao.test.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npx vitest run --config vitest.integracao.config.ts testes-integracao/publicar-fala.integracao.ts
```

Esperado: `tsc` e lint limpos; os 271 puros passam; na integração, os 17 passam.

- [ ] **Passo 5: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" lib/publicacao.ts tests/publicacao.test.ts testes-integracao/publicar-fala.integracao.ts
test "$(git branch --show-current)" = "enquadrar-imagens"
git add lib/publicacao.ts tests/publicacao.test.ts testes-integracao/publicar-fala.integracao.ts
```

```bash
git commit -F - <<'MSG'
A recusa sem arquivo deixa de mandar esperar o envio

O arquivo passa a subir no clique de publicar, e a tela confere a quantidade
antes de subir. A frase da recusa sem arquivo mandava esperar um envio que a
tela já não faz antes do botão. A action continua recusando sem arquivo, como
defesa, com a frase nova.
MSG
```

---

### FASE 5 — O compositor: a lista enquadrada e o envio no clique

**Arquivos:**
- Criar: `app/publicar/navegador.ts`, `testes-dom/publicar-compositor.dom.tsx`,
  `tests/publicar-compositor-guarda.test.ts`
- Substituir: `app/publicar/enviador.tsx` (o arquivo inteiro)
- Modificar: `app/publicar/novo/page.tsx`

**Interfaces:**
- Consome: as regras da FASE 1; `recusaDaQuantidade`, `problemaDaLegenda`, `camposDaDataHora`,
  `instanteDoAgendamento`, `momentoDaPublicacao`, `fusoDoCampo`, `textoDaRecusaDaPublicacao` (as mesmas da
  action); o depósito de envios (`app/publicar/envios.ts`, sem mudança).
- Produz: `Navegador` e `navegadorDeVerdade` (`app/publicar/navegador.ts`), com `subirComProgresso(url,
  arquivo, aoAndar, sinal)` exportada; o `Enviador` com as propriedades `teto`, `pasta`, `acao`, `quando`,
  `opcoesDoReels`, `rodape` e `navegador?`.

- [ ] **Passo 1: os testes de tela e a guarda**

Crie `testes-dom/publicar-compositor.dom.tsx`:

```tsx
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Enviador from "@/app/publicar/enviador";
import { lerEnvios, limparEnvios } from "@/app/publicar/envios";
import { subirComProgresso, type Medidas, type Navegador } from "@/app/publicar/navegador";
import {
  geometriaDoEnquadramento,
  textoDaRecusaDaPublicacao,
  textoDoProblemaDaLegenda,
  textoDoProblemaDaSaida,
  textoDoProblemaDoPrimeiroSlide,
} from "@/lib/publicacao";

// O COMPOSITOR DO /publicar (spec 2026-10-19-enquadrar-imagens): a proporção, a lista com a miniatura,
// o vermelho, as travas antes de subir, e o envio NO CLIQUE, com a trava contra o clique duplo (achado
// 107) e a action chamada uma vez com os caminhos da subida (achado 108). O jsdom não tem `canvas`,
// `createImageBitmap` nem `URL.createObjectURL`, então o navegador é falso, como as actions falsas do
// gerador. A action também é falsa: a de verdade termina em `redirect`, e o que isso faz foi medido numa
// sonda (ver o cabeçalho do compositor).

const MIB = 1024 * 1024;
const PASTA = "17841400000000001";

type Falso = {
  nav: Navegador;
  assinados: string[];
  enquadrados: { nome: string; desenho: unknown }[];
  sinais: AbortSignal[];
  soltos: string[];
};

function navegadorFalso(
  medidas: Record<string, Medidas>,
  opcoes: { falharUmaVez?: string[]; pasta?: string; pendurar?: boolean } = {}
): Falso {
  const assinados: string[] = [];
  const enquadrados: { nome: string; desenho: unknown }[] = [];
  const sinais: AbortSignal[] = [];
  const soltos: string[] = [];
  const falhar = new Set(opcoes.falharUmaVez ?? []);
  const jpg = (nome: string) => nome.replace(/\.\w+$/, ".jpg");
  const nav: Navegador = {
    criarEndereco: (a) => `blob:${a.name}`,
    soltarEndereco: (e) => {
      soltos.push(e);
    },
    medir: async (a) => medidas[a.name] ?? {},
    lerOrientacao: async () => 1,
    enquadrar: async (a, desenho) => {
      enquadrados.push({ nome: a.name, desenho });
      return new File(["jpeg"], jpg(a.name), { type: "image/jpeg" });
    },
    converter: async (a) => new File(["jpeg"], jpg(a.name), { type: "image/jpeg" }),
    assinar: async (p) => {
      assinados.push(p.nome);
      return { ok: true, caminho: `${opcoes.pasta ?? PASTA}/${p.nome}`, url: `https://bucket.test/${p.nome}` };
    },
    subir: async (_url, arquivo, aoAndar, sinal) => {
      sinais.push(sinal);
      if (opcoes.pendurar) {
        return new Promise<void>((_ok, nao) => sinal.addEventListener("abort", () => nao(new Error("O envio foi interrompido."))));
      }
      if (falhar.delete(arquivo.name)) throw new Error("A conexão caiu durante o envio.");
      aoAndar(arquivo.size, arquivo.size);
    },
  };
  return { nav, assinados, enquadrados, sinais, soltos };
}

const QUANDO = (
  <fieldset>
    <label>
      <input type="radio" name="quando" value="agora" defaultChecked /> Publicar agora
    </label>
    <label>
      <input type="radio" name="quando" value="depois" /> Publicar em outra hora
    </label>
    <label htmlFor="data_hora">Data e hora</label>
    <input id="data_hora" name="data_hora" type="datetime-local" />
  </fieldset>
);

function renderizar(f: Falso) {
  const acao = vi.fn(async (_dados: FormData) => {});
  const r = render(
    <Enviador teto={50 * MIB} pasta={PASTA} acao={acao} navegador={f.nav} quando={QUANDO} opcoesDoReels={null} rodape={<p>rodapé</p>} />
  );
  return { acao, ...r };
}

const arquivo = (nome: string, tipo: string, bytes = 1000) => new File([new Uint8Array(bytes)], nome, { type: tipo });
const botao = () => screen.getByRole("button", { name: /^(Publicar|Enviando…)$/ }) as HTMLButtonElement;
const formulario = () => botao().closest("form") as HTMLFormElement;

function escolherForma(forma: string) {
  fireEvent.change(screen.getByLabelText("Forma"), { target: { value: forma } });
}

async function escolher(arquivos: File[]) {
  const campo = screen.getByLabelText(/^Arquivos?$/) as HTMLInputElement;
  await act(async () => {
    fireEvent.change(campo, { target: { files: arquivos } });
  });
  await waitFor(() => expect(screen.queryByText("Lendo o arquivo…")).toBeNull());
}

const MEDIDAS: Record<string, Medidas> = {
  "celular.jpg": { largura: 1080, altura: 1920 },
  "arte.jpg": { largura: 1080, altura: 1350 },
  "print.png": { largura: 1920, altura: 1080 },
  "outra.jpg": { largura: 1080, altura: 1350 },
  "terceira.jpg": { largura: 1080, altura: 1350 },
  "deitado.mp4": { largura: 1920, altura: 1080, segundos: 10 },
  "animado.gif": { largura: 500, altura: 500 },
};

afterEach(() => {
  limparEnvios();
  vi.unstubAllGlobals();
});

describe("a montagem, antes do clique", () => {
  it("a proporção nasce em 4:5, e escolher não sobe nada", async () => {
    const f = navegadorFalso(MEDIDAS);
    renderizar(f);
    escolherForma("carrossel");
    expect((screen.getByLabelText("4:5 (em pé)") as HTMLInputElement).checked).toBe(true);
    await escolher([arquivo("celular.jpg", "image/jpeg"), arquivo("arte.jpg", "image/jpeg")]);
    expect(f.assinados).toEqual([]);
    expect(screen.getByText("O post vai sair com 2 slides. O primeiro decide o enquadramento de todos.")).toBeTruthy();
  });

  it("cada linha tem a miniatura, os dois modos, a ordem e o remover; remover solta a miniatura", async () => {
    const f = navegadorFalso(MEDIDAS);
    renderizar(f);
    escolherForma("carrossel");
    await escolher([arquivo("celular.jpg", "image/jpeg"), arquivo("arte.jpg", "image/jpeg")]);
    const linha = screen.getByRole("listitem", { name: "celular.jpg" });
    expect(linha.querySelector("img")?.getAttribute("src")).toBe("blob:celular.jpg");
    expect(within(linha).getByRole("button", { name: "Cortar" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(within(linha).getByRole("button", { name: "Inteira, com bordas" }));
    expect(within(linha).getByRole("button", { name: "Inteira, com bordas" }).getAttribute("aria-pressed")).toBe("true");
    expect(within(linha).getByRole("button", { name: "Descer celular.jpg" })).toBeTruthy();
    fireEvent.click(within(linha).getByRole("button", { name: "Remover" }));
    expect(screen.queryByRole("listitem", { name: "celular.jpg" })).toBeNull();
    expect(f.soltos).toContain("blob:celular.jpg");
  });

  it("o arquivo que não serve fica vermelho, com a frase, e não conta", async () => {
    renderizar(navegadorFalso(MEDIDAS));
    escolherForma("carrossel");
    await escolher([arquivo("animado.gif", "image/gif"), arquivo("arte.jpg", "image/jpeg"), arquivo("outra.jpg", "image/jpeg")]);
    const linha = screen.getByRole("listitem", { name: "animado.gif" });
    expect(within(linha).getByText(textoDoProblemaDaSaida("tipo_nao_suportado"))).toBeTruthy();
    expect(screen.getByText(/O post vai sair com 2 slides\./)).toBeTruthy();
  });

  it("no carrossel, escolher de novo acrescenta ao fim; na imagem única, troca o arquivo", async () => {
    renderizar(navegadorFalso(MEDIDAS));
    escolherForma("carrossel");
    await escolher([arquivo("arte.jpg", "image/jpeg")]);
    await escolher([arquivo("outra.jpg", "image/jpeg")]);
    expect(screen.getAllByRole("listitem").map((l) => l.getAttribute("aria-label"))).toEqual(["arte.jpg", "outra.jpg"]);
    escolherForma("imagem");
    await escolher([arquivo("arte.jpg", "image/jpeg")]);
    await escolher([arquivo("outra.jpg", "image/jpeg")]);
    expect(screen.getAllByRole("listitem").map((l) => l.getAttribute("aria-label"))).toEqual(["outra.jpg"]);
  });

  it("trocar a forma esvazia a lista, sem subir nada", async () => {
    const f = navegadorFalso(MEDIDAS);
    renderizar(f);
    escolherForma("carrossel");
    await escolher([arquivo("arte.jpg", "image/jpeg"), arquivo("outra.jpg", "image/jpeg")]);
    escolherForma("reels");
    expect(screen.queryAllByRole("listitem")).toEqual([]);
    expect(f.assinados).toEqual([]);
  });
});

describe("as travas antes de subir (achado 109)", () => {
  it("um slide só no carrossel trava, com a frase da action, e nada sobe", async () => {
    const f = navegadorFalso(MEDIDAS);
    const { acao } = renderizar(f);
    escolherForma("carrossel");
    await escolher([arquivo("arte.jpg", "image/jpeg")]);
    fireEvent.click(botao());
    expect((await screen.findByRole("alert")).textContent).toContain(textoDaRecusaDaPublicacao("carrossel_curto_demais"));
    expect(f.assinados).toEqual([]);
    expect(acao).not.toHaveBeenCalled();
  });

  it("o vídeo deitado em primeiro trava, e nada sobe", async () => {
    const f = navegadorFalso(MEDIDAS);
    renderizar(f);
    escolherForma("carrossel");
    await escolher([arquivo("deitado.mp4", "video/mp4"), arquivo("arte.jpg", "image/jpeg")]);
    fireEvent.click(botao());
    const frase = textoDoProblemaDoPrimeiroSlide({ motivo: "video_fora", proporcaoProxima: null });
    expect((await screen.findByRole("alert")).textContent).toContain(frase);
    expect(f.assinados).toEqual([]);
  });

  it("a legenda que passa do limite trava antes de subir", async () => {
    const f = navegadorFalso(MEDIDAS);
    renderizar(f);
    await escolher([arquivo("arte.jpg", "image/jpeg")]);
    fireEvent.change(screen.getByLabelText("Legenda"), { target: { value: "x".repeat(2201) } });
    fireEvent.click(botao());
    expect((await screen.findByRole("alert")).textContent).toContain(textoDoProblemaDaLegenda("longa"));
    expect(f.assinados).toEqual([]);
  });

  it("'outra hora' sem a data trava antes de subir", async () => {
    const f = navegadorFalso(MEDIDAS);
    renderizar(f);
    await escolher([arquivo("arte.jpg", "image/jpeg")]);
    fireEvent.click(screen.getByLabelText(/Publicar em outra hora/));
    fireEvent.click(botao());
    expect((await screen.findByRole("alert")).textContent).toContain(textoDaRecusaDaPublicacao("data_invalida"));
    expect(f.assinados).toEqual([]);
  });
});

describe("o envio no clique", () => {
  it("dois cliques e o Enter dão UMA leva de assinaturas e UMA chamada da action (achado 107)", async () => {
    const f = navegadorFalso(MEDIDAS);
    const { acao } = renderizar(f);
    escolherForma("carrossel");
    await escolher([arquivo("arte.jpg", "image/jpeg"), arquivo("outra.jpg", "image/jpeg")]);
    fireEvent.click(botao());
    fireEvent.click(botao());
    fireEvent.submit(formulario());
    await waitFor(() => expect(acao).toHaveBeenCalledTimes(1));
    expect(f.assinados).toEqual(["arte.jpg", "outra.jpg"]);
  });

  it("o Enter cai no mesmo caminho: o formulário não tem action, e a recusa aparece", async () => {
    const f = navegadorFalso(MEDIDAS);
    const { acao } = renderizar(f);
    expect(formulario().getAttribute("action")).toBe(null);
    fireEvent.submit(formulario());
    expect((await screen.findByRole("alert")).textContent).toContain(textoDaRecusaDaPublicacao("sem_arquivo"));
    expect(acao).not.toHaveBeenCalled();
  });

  it("a subida segue a ordem da lista, e a action recebe os caminhos nessa ordem (achado 108)", async () => {
    const f = navegadorFalso(MEDIDAS);
    const { acao } = renderizar(f);
    escolherForma("carrossel");
    await escolher([arquivo("arte.jpg", "image/jpeg"), arquivo("outra.jpg", "image/jpeg"), arquivo("terceira.jpg", "image/jpeg")]);
    fireEvent.click(screen.getByRole("button", { name: "Descer arte.jpg" }));
    fireEvent.click(botao());
    await waitFor(() => expect(acao).toHaveBeenCalledTimes(1));
    expect(f.assinados).toEqual(["outra.jpg", "arte.jpg", "terceira.jpg"]);
    const dados = acao.mock.calls[0][0];
    expect(dados.get("forma")).toBe("carrossel");
    expect(dados.get("caminhos")).toBe(`${PASTA}/outra.jpg\n${PASTA}/arte.jpg\n${PASTA}/terceira.jpg`);
  });

  it("a foto em pé passa pelo canvas com a geometria; o JPEG já em 4:5 vai como veio", async () => {
    const f = navegadorFalso(MEDIDAS);
    const { acao } = renderizar(f);
    escolherForma("carrossel");
    await escolher([arquivo("celular.jpg", "image/jpeg"), arquivo("arte.jpg", "image/jpeg")]);
    fireEvent.click(botao());
    await waitFor(() => expect(acao).toHaveBeenCalledTimes(1));
    const geometria = geometriaDoEnquadramento({ largura: 1080, altura: 1920, proporcao: "4:5", modo: "cortar" });
    expect(f.enquadrados).toEqual([{ nome: "celular.jpg", desenho: geometria }]);
  });

  it("o caminho só fica guardado depois do 2xx: a falha para tudo, e o novo clique só sobe o que faltou", async () => {
    const f = navegadorFalso(MEDIDAS, { falharUmaVez: ["outra.jpg"] });
    const { acao } = renderizar(f);
    escolherForma("carrossel");
    await escolher([arquivo("arte.jpg", "image/jpeg"), arquivo("outra.jpg", "image/jpeg"), arquivo("terceira.jpg", "image/jpeg")]);
    fireEvent.click(botao());
    expect((await screen.findByRole("alert")).textContent).toContain("O envio de 2/3 outra.jpg não foi.");
    expect(acao).not.toHaveBeenCalled();
    await waitFor(() => expect(botao().disabled).toBe(false));
    fireEvent.click(botao());
    await waitFor(() => expect(acao).toHaveBeenCalledTimes(1));
    expect(f.assinados).toEqual(["arte.jpg", "outra.jpg", "outra.jpg", "terceira.jpg"]);
    expect(acao.mock.calls[0][0].get("caminhos")).toBe(`${PASTA}/arte.jpg\n${PASTA}/outra.jpg\n${PASTA}/terceira.jpg`);
  });

  it("um caminho fora da pasta da conta recusa, sem chamar a action", async () => {
    const f = navegadorFalso(MEDIDAS, { pasta: "outra-conta" });
    const { acao } = renderizar(f);
    await escolher([arquivo("arte.jpg", "image/jpeg")]);
    fireEvent.click(botao());
    expect((await screen.findByRole("alert")).textContent).toContain("A conta mudou durante o envio.");
    expect(acao).not.toHaveBeenCalled();
  });

  it("a trava solta depois da action, e a janelinha sai antes dela", async () => {
    const f = navegadorFalso(MEDIDAS);
    const { acao } = renderizar(f);
    await escolher([arquivo("arte.jpg", "image/jpeg")]);
    fireEvent.click(botao());
    await waitFor(() => expect(acao).toHaveBeenCalledTimes(1));
    expect(lerEnvios()).toEqual([]);
    await waitFor(() => expect(botao().disabled).toBe(false));
    expect(botao().textContent).toBe("Publicar");
  });

  it("sair da tela no meio da subida interrompe, e a action não é chamada", async () => {
    const f = navegadorFalso(MEDIDAS, { pendurar: true });
    const { acao, unmount } = renderizar(f);
    await escolher([arquivo("arte.jpg", "image/jpeg")]);
    fireEvent.click(botao());
    await waitFor(() => expect(f.sinais).toHaveLength(1));
    unmount();
    expect(f.sinais[0].aborted).toBe(true);
    await waitFor(() => expect(lerEnvios()[0]?.detalhe).toBe("A publicação não foi pedida."));
    expect(acao).not.toHaveBeenCalled();
  });
});

describe("subirComProgresso: o PUT interrompível", () => {
  class XhrFalso {
    static ultimo: XhrFalso | null = null;
    upload: { onprogress: ((ev: { lengthComputable: boolean; loaded: number; total: number }) => void) | null } = { onprogress: null };
    status = 0;
    abortado = false;
    enviado = false;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onabort: (() => void) | null = null;
    open() {}
    setRequestHeader() {}
    send() {
      this.enviado = true;
      XhrFalso.ultimo = this;
    }
    abort() {
      this.abortado = true;
      this.onabort?.();
    }
  }

  const sobe = (sinal: AbortSignal, aoAndar: (enviados: number, total: number) => void = () => {}) =>
    subirComProgresso("https://bucket.test/x", new File(["x"], "x.jpg", { type: "image/jpeg" }), aoAndar, sinal);

  it("o 2xx resolve, e o progresso chega", async () => {
    vi.stubGlobal("XMLHttpRequest", XhrFalso);
    const andou: number[] = [];
    const p = sobe(new AbortController().signal, (e: number) => andou.push(e));
    XhrFalso.ultimo!.upload.onprogress!({ lengthComputable: true, loaded: 5, total: 10 });
    XhrFalso.ultimo!.status = 200;
    XhrFalso.ultimo!.onload!();
    await expect(p).resolves.toBeUndefined();
    expect(andou).toEqual([5]);
  });

  it("o 4xx rejeita com o código", async () => {
    vi.stubGlobal("XMLHttpRequest", XhrFalso);
    const p = sobe(new AbortController().signal);
    XhrFalso.ultimo!.status = 403;
    XhrFalso.ultimo!.onload!();
    await expect(p).rejects.toThrow("HTTP 403");
  });

  it("o sinal aborta o pedido, e a subida rejeita", async () => {
    vi.stubGlobal("XMLHttpRequest", XhrFalso);
    const controle = new AbortController();
    const p = sobe(controle.signal);
    controle.abort();
    await expect(p).rejects.toThrow("O envio foi interrompido.");
    expect(XhrFalso.ultimo!.abortado).toBe(true);
  });

  it("o sinal já abortado nem envia", async () => {
    vi.stubGlobal("XMLHttpRequest", XhrFalso);
    XhrFalso.ultimo = null;
    const controle = new AbortController();
    controle.abort();
    await expect(sobe(controle.signal)).rejects.toThrow("O envio foi interrompido.");
    expect(XhrFalso.ultimo).toBe(null);
  });
});
```

Crie `tests/publicar-compositor-guarda.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// A GUARDA DO CLIQUE DE PUBLICAR (spec 2026-10-19-enquadrar-imagens, achados 107 a 109). O teste de tela
// (testes-dom/publicar-compositor.dom.tsx) cobra o comportamento com uma action falsa; o que ele NÃO
// alcança é o `redirect` da action de verdade. Uma sonda mediu em 19/10/2026, no Next 16.3.8, que a
// espera da action REJEITA com `NEXT_REDIRECT` quando ela redireciona, inclusive no sucesso. Um `catch`
// em volta da chamada trataria o sucesso como falha, e o jsdom não reproduz o `NEXT_REDIRECT`. Então a
// guarda lê o arquivo, no jeito das guardas do Vinícius.

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
// O FIM DE LINHA SAI ANTES DE PROCURAR: na cópia do Windows, com `core.autocrlf`, o arquivo chega em
// CRLF, e uma expressão que espera `\n` logo depois da chave de fechamento não acharia a função.
const ler = (rel: string) => readFileSync(`${RAIZ}/${rel}`, "utf8").replace(/\r\n/g, "\n");

describe("o compositor do /publicar", () => {
  const fonte = ler("app/publicar/enviador.tsx");
  const publicar = /\n {2}function publicar\(\) \{[\s\S]*?\n {2}\}\n/.exec(fonte)?.[0] ?? "";

  it("acha a função do clique", () => {
    expect(publicar).toContain("await acao(pedido);");
  });

  it("a chamada da action não tem catch em volta: só try/finally, e o finally solta a trava", () => {
    expect(publicar).not.toMatch(/\bcatch\b/);
    expect(publicar).toMatch(/\} finally \{\s*trava\.current = false;/);
  });

  it("a trava é ligada antes de qualquer espera (achado 107)", () => {
    const trava = publicar.indexOf("trava.current = true;");
    const sai = publicar.indexOf("if (trava.current) return;");
    expect(trava).toBeGreaterThan(-1);
    // A SAÍDA TEM DE EXISTIR, e não só vir antes: sem ela, `indexOf` dá -1, que também é "antes".
    expect(sai).toBeGreaterThan(-1);
    expect(sai).toBeLessThan(trava);
    expect(trava).toBeLessThan(publicar.indexOf("iniciar("));
    expect(trava).toBeLessThan(publicar.indexOf("await"));
  });

  it("o formulário não tem action, e o envio nativo cai no mesmo caminho", () => {
    expect(fonte).not.toMatch(/<form[^>]*\baction=/);
    expect(fonte).toMatch(/onSubmit=\{\(ev\) => \{\s*ev\.preventDefault\(\);\s*publicar\(\);/);
  });

  it("o botão de publicar é type=button, e chama o mesmo caminho", () => {
    expect(fonte).toMatch(/<button type="button" className=\{btnPrimary\} disabled=\{pendente\} onClick=\{publicar\}>/);
  });
});

describe("a página de compor", () => {
  const pagina = ler("app/publicar/novo/page.tsx");

  it("entrega a action ao compositor, e não monta o formulário dela", () => {
    expect(pagina).toContain("acao={publicar}");
    expect(pagina).not.toContain("<form action={publicar}");
  });
});
```

- [ ] **Passo 2: ver falhar**

```bash
npx vitest run --config vitest.dom.config.ts testes-dom/publicar-compositor.dom.tsx
npx vitest run tests/publicar-compositor-guarda.test.ts
```

Esperado: o teste de tela nem carrega (`Failed to resolve import "@/app/publicar/navegador"`), e a guarda derruba
os 6 casos (6): o compositor antigo não tem a função do clique, e a página ainda monta o formulário com a
action.

- [ ] **Passo 3: a fiação do navegador**

Crie `app/publicar/navegador.ts`:

```ts
import {
  QUALIDADE_DO_JPEG,
  medidasDaConversao,
  nomeDepoisDaConversao,
  orientacaoDoJpeg,
  type FormaDePublicacao,
  type Retangulo,
} from "@/lib/publicacao";

// A FIAÇÃO DO NAVEGADOR DO /publicar — medir, ler a orientação, desenhar no
// `canvas`, pedir a URL assinada e subir com progresso. Nenhuma decisão de
// negócio mora aqui: o retângulo do desenho vem de `geometriaDoEnquadramento`,
// e se o arquivo vai cru vem de `vaiSemRedesenho` (lib/publicacao.ts).
//
// ELA É UM OBJETO QUE O COMPOSITOR RECEBE, e não funções soltas, porque o jsdom
// não tem `canvas`, `createImageBitmap` nem `URL.createObjectURL`: o teste de
// tela entrega uma falsa, no molde das actions que entram por propriedade no
// gerador. A de verdade é `navegadorDeVerdade`, no fim.

export type Medidas = { largura?: number; altura?: number; segundos?: number };

export type PedidoDeAssinatura = {
  forma: FormaDePublicacao;
  nome: string;
  mime: string;
  bytes: number;
  segundos?: number;
  largura?: number;
  altura?: number;
};

export type Navegador = {
  /** O endereço local do arquivo, para a miniatura. Liberado por `soltarEndereco`. */
  criarEndereco(arquivo: File): string;
  soltarEndereco(endereco: string): void;
  /** As medidas que o `canvas` vai usar: a imagem pelo mesmo bitmap que desenha, o vídeo pelos metadados. */
  medir(arquivo: File): Promise<Medidas>;
  /** A orientação EXIF do JPEG (1 em qualquer outro caso). */
  lerOrientacao(arquivo: File): Promise<number>;
  /** O desenho do enquadramento, num JPEG do tamanho do canvas. */
  enquadrar(arquivo: File, desenho: { largura: number; altura: number; origem: Retangulo; destino: Retangulo }): Promise<File>;
  /** A conversão de sempre (o story): PNG ou WebP em JPEG, no tamanho que `planoDaConversao` mandou. */
  converter(arquivo: File, plano: { largura: number; altura: number; qualidade: number }): Promise<File>;
  assinar(pedido: PedidoDeAssinatura): Promise<{ ok: true; caminho: string; url: string } | { ok: false; erro: string }>;
  /** O PUT na URL assinada, com progresso. O sinal interrompe. */
  subir(url: string, arquivo: File, aoAndar: (enviados: number, total: number) => void, sinal: AbortSignal): Promise<void>;
};

/**
 * O BITMAP COM A ORIENTAÇÃO APLICADA, e é o MESMO para medir e para desenhar
 * (achado 110). A tela media com `new Image().naturalWidth` e desenhava com
 * `createImageBitmap(arquivo)`, e o desenho era esticado nas medidas da
 * primeira API. A opção é explícita, como o gerador já faz
 * (`app/bonus/[id]/carrossel/[cid]/imagem-no-navegador.ts`).
 */
function bitmapDe(arquivo: Blob): Promise<ImageBitmap> {
  return createImageBitmap(arquivo, { imageOrientation: "from-image" });
}

/** ZERO VIRA AUSENTE: `videoWidth` é 0 enquanto os metadados não carregaram. */
function numeroOuNada(n: number): number | undefined {
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function medirVideo(arquivo: File): Promise<Medidas> {
  const endereco = URL.createObjectURL(arquivo);
  return new Promise<Medidas>((ok) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () =>
      ok({
        largura: numeroOuNada(video.videoWidth),
        altura: numeroOuNada(video.videoHeight),
        segundos: numeroOuNada(video.duration),
      });
    // MEDIR PODE FALHAR, E FALHAR NÃO É RECUSAR: um codec que este navegador não
    // abre (o `.mov` HEVC no Chrome) ainda pode ser um vídeo que a Meta aceita.
    video.onerror = () => ok({});
    video.src = endereco;
  }).finally(() => URL.revokeObjectURL(endereco));
}

/**
 * O DESENHO, com o branco pintado ANTES. O `canvas` nasce transparente e o JPEG
 * não tem canal alfa: sem o branco, o PNG transparente vira fundo preto no
 * perfil público, onde não há `DELETE`. É a armadilha nº 1 que o Vinícius deixou
 * escrita, e agora o mesmo branco é a cor das bordas do "Inteira, com bordas".
 *
 * O TIPO É CONFERIDO DEPOIS DO `toBlob`: um navegador que não gera JPEG devolve
 * PNG calado, e um ".jpg" que é PNG seria recusado pela Meta depois de tudo
 * pronto.
 */
async function desenharJpeg(
  bitmap: ImageBitmap,
  largura: number,
  altura: number,
  origem: Retangulo,
  destino: Retangulo,
  nome: string,
  qualidade: number
): Promise<File> {
  const tela = document.createElement("canvas");
  tela.width = largura;
  tela.height = altura;
  const pincel = tela.getContext("2d");
  if (!pincel) throw new Error("Este navegador não permitiu preparar a imagem.");
  pincel.fillStyle = "#ffffff";
  pincel.fillRect(0, 0, largura, altura);
  pincel.drawImage(
    bitmap,
    origem.x,
    origem.y,
    origem.largura,
    origem.altura,
    destino.x,
    destino.y,
    destino.largura,
    destino.altura
  );
  const blob = await new Promise<Blob | null>((resolver) => tela.toBlob(resolver, "image/jpeg", qualidade));
  if (!blob || blob.type !== "image/jpeg") throw new Error("Este navegador não conseguiu gerar o JPEG da imagem.");
  return new File([blob], nomeDepoisDaConversao(nome), { type: "image/jpeg" });
}

export const navegadorDeVerdade: Navegador = {
  criarEndereco: (arquivo) => URL.createObjectURL(arquivo),
  soltarEndereco: (endereco) => URL.revokeObjectURL(endereco),

  async medir(arquivo) {
    if (arquivo.type.startsWith("video/")) return medirVideo(arquivo);
    if (!arquivo.type.startsWith("image/")) return {};
    try {
      const bitmap = await bitmapDe(arquivo);
      try {
        return { largura: numeroOuNada(bitmap.width), altura: numeroOuNada(bitmap.height) };
      } finally {
        bitmap.close();
      }
    } catch {
      return {};
    }
  },

  async lerOrientacao(arquivo) {
    if (arquivo.type !== "image/jpeg") return 1;
    // OS CABEÇALHOS DO JPEG ficam no começo: 64 KiB bastam, e ler o arquivo
    // inteiro de uma foto de 8 MB para achar dois bytes seria desperdício.
    const bytes = new Uint8Array(await arquivo.slice(0, 64 * 1024).arrayBuffer());
    return orientacaoDoJpeg(bytes);
  },

  async enquadrar(arquivo, d) {
    const bitmap = await bitmapDe(arquivo);
    try {
      return await desenharJpeg(bitmap, d.largura, d.altura, d.origem, d.destino, arquivo.name, QUALIDADE_DO_JPEG);
    } finally {
      bitmap.close();
    }
  },

  async converter(arquivo, plano) {
    const bitmap = await bitmapDe(arquivo);
    try {
      // PLANO SEM MEDIDA USA A DA IMAGEM: `planoDaConversao` devolve 0/0 quando
      // não sabia o tamanho, e cravar zero gravaria um arquivo de zero pixel.
      const { largura, altura } = medidasDaConversao(plano, bitmap);
      const inteira = { x: 0, y: 0, largura: bitmap.width, altura: bitmap.height };
      return await desenharJpeg(bitmap, largura, altura, inteira, { x: 0, y: 0, largura, altura }, arquivo.name, plano.qualidade);
    } finally {
      bitmap.close();
    }
  },

  async assinar(pedido) {
    const resposta = await fetch("/api/midia/assinar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pedido),
    });
    const dados = (await resposta.json().catch(() => null)) as { caminho?: string; url?: string; error?: string } | null;
    // A FRASE DO SERVIDOR PASSA INTEIRA: ela veio de `textoDoProblema` do outro
    // lado, e reescrevê-la aqui criaria a segunda redação do mesmo "não".
    if (!resposta.ok || !dados?.url || !dados?.caminho) {
      return { ok: false, erro: dados?.error ?? "O servidor não liberou o envio." };
    }
    return { ok: true, caminho: dados.caminho, url: dados.url };
  },

  subir: subirComProgresso,
};

/**
 * O `PUT` na URL assinada, com progresso, e INTERROMPÍVEL.
 *
 * É `XMLHttpRequest` PORQUE `fetch` NÃO DÁ PROGRESSO DE UPLOAD: a API expõe o
 * corpo que desce, não o que sobe. SEM CABEÇALHO DE AUTENTICAÇÃO (medido em
 * 03/09): o `?token=` da URL é a credencial inteira, de um caminho só, para
 * subir, por 2 horas. A `SUPABASE_SERVICE_ROLE_KEY` nunca sai do servidor.
 *
 * O SINAL É NOVO (spec 2026-10-19-enquadrar-imagens): o envio agora acontece no
 * clique de publicar, e sair da tela no meio NÃO pode deixar a subida andando e
 * a action ser chamada depois, de uma tela que ninguém está vendo. Sair aborta.
 */
export function subirComProgresso(
  endereco: string,
  arquivo: File,
  aoAndar: (enviados: number, total: number) => void,
  sinal: AbortSignal
): Promise<void> {
  return new Promise((ok, nao) => {
    if (sinal.aborted) {
      nao(new Error("O envio foi interrompido."));
      return;
    }
    const pedido = new XMLHttpRequest();
    const abortar = () => pedido.abort();
    sinal.addEventListener("abort", abortar, { once: true });
    const fim = () => sinal.removeEventListener("abort", abortar);
    pedido.open("PUT", endereco, true);
    pedido.setRequestHeader("Content-Type", arquivo.type || "application/octet-stream");
    pedido.upload.onprogress = (ev) => {
      // `lengthComputable` FALSO É NÃO SABER O TOTAL; não vale inventar um.
      if (ev.lengthComputable) aoAndar(ev.loaded, ev.total);
    };
    pedido.onload = () => {
      fim();
      if (pedido.status >= 200 && pedido.status < 300) ok();
      else nao(new Error(`O armazenamento recusou o arquivo (HTTP ${pedido.status}).`));
    };
    pedido.onerror = () => {
      fim();
      nao(new Error("A conexão caiu durante o envio."));
    };
    pedido.onabort = () => {
      fim();
      nao(new Error("O envio foi interrompido."));
    };
    pedido.send(arquivo);
  });
}
```

- [ ] **Passo 4: o compositor.** Ele é reescrito: substitua o arquivo inteiro pelo bloco abaixo (o "Crie"
  sobrescreve).

Crie `app/publicar/enviador.tsx`:

```tsx
"use client";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition, type ReactNode } from "react";
import {
  PROPORCOES_DO_POST,
  PROPORCAO_PADRAO,
  acrescentarNaLista,
  camposDaDataHora,
  campoAceitaVariosArquivos,
  fusoDoCampo,
  geometriaDoEnquadramento,
  instanteDoAgendamento,
  momentoDaPublicacao,
  moverNaOrdem,
  planoDaConversao,
  problemaDaLegenda,
  problemaDaSaida,
  problemaDoArquivo,
  problemaDoPrimeiroSlide,
  recusaDaQuantidade,
  resumoDoProgresso,
  rotuloDaForma,
  rotuloDoEnvio,
  tetoParaAConferenciaDaTela,
  textoDaContagem,
  textoDaRecusaDaPublicacao,
  textoDoProblema,
  textoDoProblemaDaLegenda,
  textoDoProblemaDaSaida,
  textoDoProblemaDoPrimeiroSlide,
  tiposQueOCampoAceita,
  vaiSemRedesenho,
  CARROSSEL_ITENS_MAX,
  type EnvioEmAndamento,
  type FormaDePublicacao,
  type ModoDoEnquadramento,
  type ProblemaDaSaida,
  type ProporcaoDoPost,
} from "@/lib/publicacao";
import { assinarEnvios, atualizarEnvio, definirEnvios, lerEnvios, lerEnviosNoServidor, limparEnvios } from "./envios";
import { navegadorDeVerdade, type Medidas, type Navegador } from "./navegador";
import { btnPrimary, card, fieldError, hint, input, label, muted, numero } from "../ui";

// O COMPOSITOR DO /publicar — o formulário inteiro, e a exceção declarada na
// especificação (§3): o navegador é quem envia o arquivo, porque a Vercel recusa
// corpo acima de 4,5 MB (medido) e um reels vai a 300 MB.
//
// =============================================================================
// O ARQUIVO SOBE NO CLIQUE DE PUBLICAR (spec 2026-10-19-enquadrar-imagens)
//
// Antes ele subia ao ser escolhido, e o caminho já pronto antes do botão era a
// defesa contra o clique duplo: dois cliques mandavam os mesmos caminhos, e a
// dedupe os fazia um item só (lib/dedupe.ts). Agora a pessoa escolhe a
// proporção, o modo de cada imagem, remove e reordena DEPOIS de escolher, e só
// o clique sobe. O caminho nasce dentro do clique, e um segundo clique subiria
// tudo de novo, com outros caminhos e outra chave: dois posts no perfil, sem
// `DELETE` (achado 107). Por isso:
//
//   - O BOTÃO É `type="button"` E TRAVA NUMA REFERÊNCIA ligada antes de
//     qualquer espera, no molde do gerador (card-publicar.tsx). O `isPending`
//     não serve de trava: ele só muda no próximo render, e dois cliques no mesmo
//     quadro passariam os dois.
//   - O FORMULÁRIO NÃO TEM `action`. O Enter num campo de texto vira `submit`,
//     que leva `preventDefault` aqui mesmo e cai no mesmo caminho, sob a mesma
//     trava. A action só é chamada por `publicar`.
//   - A ACTION RECEBE UM `FormData` MONTADO AQUI, com os caminhos de uma
//     variável, e não de um campo controlado pelo estado: o React lê o
//     formulário no instante do envio, e um estado atualizado depois de uma
//     espera ainda não chegou ao campo (achado 108).
//
// =============================================================================
// A ACTION TERMINA EM `redirect`, E ISSO FOI MEDIDO
//
// Uma sonda de laboratório mediu em 19/10/2026, no Next 16.3.8 (`next dev` e
// `next build` + `next start`), uma action chamada assim dentro de
// `startTransition`, com redirect para a própria rota: o componente é RECRIADO,
// a espera REJEITA com `NEXT_REDIRECT`, o `finally` roda e o `isPending` volta a
// falso. Então a chamada da action NÃO TEM `catch`: um `catch` trataria o
// `NEXT_REDIRECT` de um sucesso como falha. Só `try`/`finally`, e o `finally`
// solta a trava. tests/publicar-compositor-guarda.test.ts cobra isso.
//
// =============================================================================
// NENHUMA DECISÃO MORA AQUI
//
// O retângulo do corte, se o arquivo vai cru, o vermelho da lista, a trava do
// primeiro slide, a quantidade, a legenda e a hora vêm de `lib/publicacao.ts`,
// puros e com caso. O que sobra aqui é fiação e desenho, e a fiação do
// navegador está em `./navegador.ts`.

/** Um arquivo escolhido, e o que a tela sabe dele. */
type Slide = {
  id: string;
  arquivo: File;
  /** O endereço local para a miniatura (`navegador.criarEndereco`). */
  endereco: string;
  video: boolean;
  /** `null` enquanto o navegador ainda mede. */
  medidas: Medidas | null;
  orientacao: number;
  modo: ModoDoEnquadramento;
  /** O caminho no bucket, SÓ depois do 2xx da subida, e para qual forma, proporção e modo ele foi feito. */
  enviado: { caminho: string; chave: string } | null;
};

export default function Enviador({
  teto,
  pasta,
  acao,
  quando,
  opcoesDoReels,
  rodape,
  navegador = navegadorDeVerdade,
}: {
  teto: number | null;
  /** A pasta da conta no bucket (`pastaDaConta`): os caminhos têm de estar nela antes de chamar a action. */
  pasta: string;
  acao: (dados: FormData) => Promise<void>;
  /** As partes do formulário que são de servidor, e vêm prontas da página. */
  quando: ReactNode;
  opcoesDoReels: ReactNode;
  rodape: ReactNode;
  navegador?: Navegador;
}) {
  const [forma, setForma] = useState<FormaDePublicacao>("imagem");
  const [proporcao, setProporcao] = useState<ProporcaoDoPost>(PROPORCAO_PADRAO);
  const [legenda, setLegenda] = useState("");
  const [slides, setSlides] = useState<Slide[]>([]);
  const [foraDaLista, setForaDaLista] = useState(0);
  const [recusa, setRecusa] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const formulario = useRef<HTMLFormElement>(null);
  const campoDeArquivo = useRef<HTMLInputElement>(null);
  const campoDeFuso = useRef<HTMLInputElement>(null);
  const trava = useRef(false);
  const montado = useRef(true);
  const controles = useRef(new Set<AbortController>());
  const proximoId = useRef(0);
  const enderecos = useRef(new Set<string>());
  const envios = useSyncExternalStore(assinarEnvios, lerEnvios, lerEnviosNoServidor);

  // O FUSO É ESCRITO NO DOM DEPOIS DA HIDRATAÇÃO, e não durante o render: o
  // servidor roda em UTC e o navegador não, e um `value` calculado no render
  // seria diferente dos dois lados. Ele existe porque o `datetime-local` manda
  // "14:30" e cala sobre onde são 14:30 (`instanteDoAgendamento`).
  useEffect(() => {
    if (campoDeFuso.current) campoDeFuso.current.value = String(new Date().getTimezoneOffset());
  }, []);

  // A JANELINHA NÃO ATRAVESSA UM PEDIDO NOVO: o depósito é um módulo e sobrevive
  // ao `redirect`, e o envio ENCERRADO do pedido anterior ficaria no canto.
  useEffect(() => {
    if (resumoDoProgresso(lerEnvios())?.encerrado) limparEnvios();
  }, []);

  // SAIR DA TELA NO MEIO DA SUBIDA INTERROMPE. Antes o laço e o `XMLHttpRequest`
  // sobreviviam à desmontagem, e agora a action vem DEPOIS deles: ela seria
  // chamada de uma tela que ninguém está vendo. A janelinha diz que a
  // publicação não foi pedida, e os endereços das miniaturas são soltos.
  useEffect(() => {
    montado.current = true;
    const ativos = controles.current;
    const locais = enderecos.current;
    return () => {
      montado.current = false;
      for (const c of ativos) c.abort();
      if (trava.current) {
        definirEnvios(
          lerEnvios().map((e) =>
            e.estado === "pronto" || e.estado === "recusado" || e.estado === "falhou"
              ? e
              : { ...e, estado: "falhou", detalhe: "A publicação não foi pedida." }
          )
        );
      }
      for (const endereco of locais) navegador.soltarEndereco(endereco);
      locais.clear();
    };
  }, [navegador]);

  // FECHAR OU RECARREGAR A ABA NO MEIO DA SUBIDA pede confirmação: o que já subiu
  // ficaria órfão no bucket, e o post não seria pedido.
  useEffect(() => {
    if (!pendente) return;
    const segurar = (ev: BeforeUnloadEvent) => {
      ev.preventDefault();
      ev.returnValue = "";
    };
    window.addEventListener("beforeunload", segurar);
    return () => window.removeEventListener("beforeunload", segurar);
  }, [pendente]);

  const enquadra = forma === "imagem" || forma === "carrossel";
  const tetoDaTela = tetoParaAConferenciaDaTela(teto);
  const linhas = slides.map((s) => ({
    s,
    medindo: s.medidas === null,
    problema:
      s.medidas === null
        ? null
        : problemaDaSaida(
            forma,
            { mime: s.arquivo.type, bytes: s.arquivo.size, ...s.medidas, orientacao: s.orientacao },
            proporcao,
            s.modo,
            tetoDaTela
          ),
  }));
  const validos = linhas.filter((l) => !l.medindo && !l.problema).map((l) => l.s);
  const problemaDaQuantidade = slides.length ? recusaDaQuantidade(forma, validos.length) : null;
  const primeiroSlide =
    forma === "carrossel"
      ? problemaDoPrimeiroSlide(
          linhas
            .filter((l) => !l.medindo)
            .map((l) => ({ video: l.s.video, largura: l.s.medidas?.largura, altura: l.s.medidas?.altura, valido: !l.problema })),
          proporcao
        )
      : null;
  const problemaDaLegendaAtual = problemaDaLegenda(legenda);
  const fracao = PROPORCOES_DO_POST.find((p) => p.id === proporcao) ?? PROPORCOES_DO_POST[0];

  function soltar(lista: Slide[]) {
    for (const s of lista) {
      navegador.soltarEndereco(s.endereco);
      enderecos.current.delete(s.endereco);
    }
  }

  function trocarForma(nova: FormaDePublicacao) {
    // TROCAR A FORMA DESCARTA A LISTA, porque as regras são outras (um vídeo de
    // 90 s serve para reels e não para story). Antes, isso deixava no bucket
    // tudo o que já tinha subido, e era o caminho mais barato do órfão (o
    // Vinícius registrou em aberto). Agora nada subiu antes do clique, e nada
    // fica.
    setForma(nova);
    soltar(slides);
    setSlides([]);
    setForaDaLista(0);
    setRecusa(null);
    limparEnvios();
    if (campoDeArquivo.current) campoDeArquivo.current.value = "";
  }

  async function aoEscolherArquivo(ev: React.ChangeEvent<HTMLInputElement>) {
    const escolhidos = Array.from(ev.target.files ?? []);
    // O CAMPO VOLTA A VAZIO para escolher o mesmo arquivo de novo disparar a troca.
    ev.target.value = "";
    if (!escolhidos.length) return;
    setRecusa(null);
    const novos: Slide[] = escolhidos.map((arquivo) => {
      const endereco = navegador.criarEndereco(arquivo);
      enderecos.current.add(endereco);
      return {
        id: `s${proximoId.current++}`,
        arquivo,
        endereco,
        video: arquivo.type.startsWith("video/"),
        medidas: null,
        orientacao: 1,
        modo: "cortar",
        enviado: null,
      };
    });
    const { lista, deFora } = acrescentarNaLista(slides, novos, forma);
    const ficam = new Set(lista.map((s) => s.id));
    soltar([...slides, ...novos].filter((s) => !ficam.has(s.id)));
    setSlides(lista);
    setForaDaLista(deFora);
    // A MEDIDA DE CADA UM, sem segurar a tela: a linha diz "Lendo o arquivo…"
    // até ela chegar.
    for (const s of novos.filter((n) => ficam.has(n.id))) {
      const [medidas, orientacao] = await Promise.all([navegador.medir(s.arquivo), navegador.lerOrientacao(s.arquivo)]);
      setSlides((atuais) => atuais.map((x) => (x.id === s.id ? { ...x, medidas, orientacao } : x)));
    }
  }

  function remover(id: string) {
    soltar(slides.filter((s) => s.id === id));
    setSlides((atuais) => atuais.filter((s) => s.id !== id));
  }

  function mudarModo(id: string, modo: ModoDoEnquadramento) {
    setSlides((atuais) => atuais.map((s) => (s.id === id ? { ...s, modo } : s)));
  }

  /** Para que forma, proporção e modo o caminho guardado vale: mudar qualquer um sobe de novo. */
  function chaveDe(s: Slide): string {
    return `${forma}|${proporcao}|${s.modo}`;
  }

  /** A recusa da hora, pelas mesmas funções da action. `null` quando ela serve. */
  function recusaDaHora(form: HTMLFormElement): string | null {
    const dados = new FormData(form);
    const campos = camposDaDataHora(dados.get("data_hora"));
    const momento = momentoDaPublicacao(
      dados.get("quando"),
      campos ? instanteDoAgendamento(campos, fusoDoCampo(dados.get("fuso"))) : null,
      Date.now()
    );
    return momento.ok ? null : textoDaRecusaDaPublicacao(momento.motivo);
  }

  /** Prepara e sobe um slide. Devolve o caminho, ou `null` com o motivo já escrito na janelinha. */
  async function prepararESubir(s: Slide, nome: string): Promise<string | null> {
    try {
      let arquivo = s.arquivo;
      let medidas: Medidas = s.medidas ?? {};
      const ehImagem = arquivo.type.startsWith("image/");
      if (ehImagem && enquadra && medidas.largura && medidas.altura) {
        const cru = vaiSemRedesenho({
          mime: arquivo.type,
          largura: medidas.largura,
          altura: medidas.altura,
          bytes: arquivo.size,
          proporcao,
          orientacao: s.orientacao,
        });
        if (!cru) {
          const g = geometriaDoEnquadramento({ largura: medidas.largura, altura: medidas.altura, proporcao, modo: s.modo });
          if (!g.ok) {
            atualizarEnvio(nome, { estado: "recusado", detalhe: textoDoProblema("estreito_demais") });
            return null;
          }
          atualizarEnvio(nome, { estado: "convertendo" });
          arquivo = await navegador.enquadrar(s.arquivo, g);
          medidas = { largura: g.largura, altura: g.altura };
        }
      } else if (ehImagem && forma === "story") {
        const plano = planoDaConversao({ mime: arquivo.type, largura: medidas.largura, altura: medidas.altura });
        if (plano.converter) {
          atualizarEnvio(nome, { estado: "convertendo" });
          arquivo = await navegador.converter(s.arquivo, plano);
          if (plano.largura > 0) medidas = { largura: plano.largura, altura: plano.altura };
        }
      }

      const declarado = {
        mime: arquivo.type,
        bytes: arquivo.size,
        segundos: medidas.segundos,
        largura: medidas.largura,
        altura: medidas.altura,
      };
      // A ÚLTIMA CONFERÊNCIA DA TELA, sobre o arquivo que DE FATO sobe, com a
      // mesma função da rota que assina.
      const problema = problemaDoArquivo(forma, declarado, tetoDaTela);
      if (problema) {
        atualizarEnvio(nome, { estado: "recusado", detalhe: textoDoProblema(problema) });
        return null;
      }

      atualizarEnvio(nome, { estado: "assinando", enviados: 0, total: arquivo.size });
      const assinatura = await navegador.assinar({ forma, nome: arquivo.name, ...declarado });
      if (!assinatura.ok) {
        atualizarEnvio(nome, { estado: "recusado", detalhe: assinatura.erro });
        return null;
      }

      atualizarEnvio(nome, { estado: "enviando", enviados: 0, total: arquivo.size });
      const controle = new AbortController();
      controles.current.add(controle);
      try {
        await navegador.subir(assinatura.url, arquivo, (enviados, total) => atualizarEnvio(nome, { enviados, total }), controle.signal);
      } finally {
        controles.current.delete(controle);
      }
      atualizarEnvio(nome, { estado: "pronto", enviados: arquivo.size, total: arquivo.size });
      return assinatura.caminho;
    } catch (erro) {
      // O ENVIO QUE NÃO FOI NÃO PODE SUMIR CALADO. Este `catch` é da SUBIDA, e não
      // da action: a action é chamada fora daqui, sem `catch` (ver o cabeçalho).
      atualizarEnvio(nome, { estado: "falhou", detalhe: mensagemDoErro(erro) });
      return null;
    }
  }

  /** Sobe os válidos na ordem da lista. Os que já subiram para a mesma chave não sobem de novo. */
  async function subirTodos(lista: Slide[]): Promise<string[] | null> {
    const nomes = lista.map((s, i) => rotuloDoEnvio(s.arquivo.name, i, lista.length));
    const jaEnviado = (s: Slide) => (s.enviado && s.enviado.chave === chaveDe(s) ? s.enviado.caminho : null);
    definirEnvios(
      lista.map(
        (s, i): EnvioEmAndamento =>
          jaEnviado(s)
            ? { nome: nomes[i], estado: "pronto", enviados: s.arquivo.size, total: s.arquivo.size }
            : { nome: nomes[i], estado: "escolhido", enviados: 0, total: s.arquivo.size }
      )
    );
    const caminhos: string[] = [];
    for (let i = 0; i < lista.length; i++) {
      const guardado = jaEnviado(lista[i]);
      if (guardado) {
        caminhos.push(guardado);
        continue;
      }
      if (!montado.current) return null;
      const caminho = await prepararESubir(lista[i], nomes[i]);
      if (!caminho) {
        if (montado.current) {
          setRecusa(
            `O envio de ${nomes[i]} não foi. Confira o motivo na lista de envios e clique em Publicar de novo: o que já subiu não sobe outra vez.`
          );
        }
        return null;
      }
      // O CAMINHO SÓ É GUARDADO DEPOIS DO 2xx: `prepararESubir` só o devolve
      // depois de `subir` resolver.
      const chave = chaveDe(lista[i]);
      const id = lista[i].id;
      setSlides((atuais) => atuais.map((x) => (x.id === id ? { ...x, enviado: { caminho, chave } } : x)));
      caminhos.push(caminho);
    }
    return caminhos;
  }

  function publicar() {
    // A TRAVA, ligada antes de qualquer espera (achado 107).
    if (trava.current) return;
    trava.current = true;
    setRecusa(null);
    iniciar(async () => {
      try {
        const form = formulario.current;
        if (!form) return;
        // AS CONFERÊNCIAS ANTES DE SUBIR, com as MESMAS funções da action
        // (achado 109): antes, todas chegavam depois da subida, porque o
        // formulário não tem `required`.
        if (slides.some((s) => s.medidas === null)) {
          setRecusa("Espere a tela terminar de ler os arquivos.");
          return;
        }
        const quantidade = recusaDaQuantidade(forma, validos.length);
        if (quantidade) {
          setRecusa(textoDaRecusaDaPublicacao(quantidade));
          return;
        }
        if (primeiroSlide) {
          setRecusa(textoDoProblemaDoPrimeiroSlide(primeiroSlide));
          return;
        }
        const daLegenda = problemaDaLegenda(legenda);
        if (daLegenda) {
          setRecusa(textoDoProblemaDaLegenda(daLegenda));
          return;
        }
        const daHora = recusaDaHora(form);
        if (daHora) {
          setRecusa(daHora);
          return;
        }

        const caminhos = await subirTodos(validos);
        if (!caminhos || !montado.current) return;
        // TODOS NA PASTA DA CONTA DESTA TELA. A troca de conta no seletor no meio
        // da subida faria a action descartar calada o que é de outra pasta
        // (`caminhosDoCampo`) e publicar o resto.
        if (caminhos.some((c) => !c.startsWith(`${pasta}/`))) {
          setRecusa("A conta mudou durante o envio. Recarregue a página e monte o post de novo.");
          return;
        }
        // A HORA DE NOVO: a subida pode levar minutos, e a tolerância do "agora"
        // é de 60 s.
        const daHoraDepois = recusaDaHora(form);
        if (daHoraDepois) {
          setRecusa(daHoraDepois);
          return;
        }

        // A JANELINHA SAI ANTES DA ACTION: "Envios concluídos." não é
        // "publicado", e o desfecho é o aviso que a action devolve na tela.
        limparEnvios();
        const pedido = new FormData(form);
        pedido.set("forma", forma);
        pedido.set("caminhos", caminhos.join("\n"));
        await acao(pedido);
      } finally {
        trava.current = false;
      }
    });
  }

  return (
    <form
      ref={formulario}
      className={`${card} space-y-6 p-5`}
      onSubmit={(ev) => {
        ev.preventDefault();
        publicar();
      }}
    >
      <div>
        <label className={label} htmlFor="forma">
          Forma
        </label>
        <select
          id="forma"
          name="forma"
          className={input}
          value={forma}
          disabled={pendente}
          onChange={(e) => trocarForma(e.target.value as FormaDePublicacao)}
        >
          {/* AS PALAVRAS VÊM DE `rotuloDaForma` (lib/publicacao.ts): a tela de
              agendados usa as mesmas quatro. A ORDEM é desta tela. */}
          <option value="imagem">{rotuloDaForma("imagem")}</option>
          <option value="carrossel">{rotuloDaForma("carrossel")}</option>
          <option value="reels">{rotuloDaForma("reels")}</option>
          <option value="story">{rotuloDaForma("story")}</option>
        </select>
        <p className={hint}>
          No carrossel valem duas regras da Meta: reels não entra (vídeo em carrossel é vídeo comum, sem áudio
          nomeado e sem aparecer no feed como reels), e todos os itens são cortados pela proporção do PRIMEIRO
          — por isso a ordem importa, e dá para mudá-la na lista abaixo. São de 2 a {CARROSSEL_ITENS_MAX} itens,
          e o post inteiro conta como uma só publicação.
        </p>
      </div>

      {enquadra && (
        <fieldset className="space-y-2">
          <legend className={label}>Proporção</legend>
          <div className="flex flex-wrap gap-4 text-sm">
            {PROPORCOES_DO_POST.map((p) => (
              <label key={p.id} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="proporcao"
                  value={p.id}
                  checked={proporcao === p.id}
                  disabled={pendente}
                  onChange={() => setProporcao(p.id)}
                />
                {p.rotulo}
              </label>
            ))}
          </div>
          <p className={hint}>
            Cada imagem sai nesta proporção: cortada ao centro, ou inteira, com bordas brancas.
          </p>
        </fieldset>
      )}

      <div>
        <label className={label} htmlFor="arquivo">
          {forma === "carrossel" ? "Arquivos" : "Arquivo"}
        </label>
        <input
          id="arquivo"
          ref={campoDeArquivo}
          type="file"
          // O CAMPO NÃO TEM `name`: o arquivo não vai no formulário. Ele sobe no
          // clique, direto ao bucket, e a action recebe o caminho.
          accept={tiposQueOCampoAceita(forma)}
          multiple={campoAceitaVariosArquivos(forma)}
          disabled={pendente}
          onChange={aoEscolherArquivo}
          className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-200 dark:text-zinc-400 dark:file:bg-zinc-800 dark:file:text-zinc-200"
        />
        <p className={hint}>
          {/* O TETO DO BUCKET VEM DA ROTA, E NUNCA CRAVADO (`tetoDoBucket`). */}
          {teto === null
            ? "O limite de tamanho do nosso armazenamento não pôde ser lido agora — o servidor confere no envio."
            : `Até ${Math.floor(teto / (1024 * 1024))} MB por arquivo no nosso armazenamento, além dos limites do próprio Instagram.`}
          {forma === "carrossel" ? " Escolher de novo acrescenta ao fim da lista." : ""}
        </p>
        {foraDaLista > 0 && (
          <p className={fieldError}>
            {foraDaLista === 1 ? "1 arquivo ficou de fora" : `${foraDaLista} arquivos ficaram de fora`}: o carrossel
            vai até {CARROSSEL_ITENS_MAX}.
          </p>
        )}
      </div>

      {slides.length > 0 && (
        <div className={`${card} space-y-3 p-4`}>
          {forma === "carrossel" && (
            <p className={`text-xs font-medium ${muted}`}>
              {textoDaContagem(validos.length)} O primeiro decide o enquadramento de todos.
            </p>
          )}
          <ol className="space-y-3">
            {linhas.map(({ s, medindo, problema }, i) => (
              <LinhaDoSlide
                key={s.id}
                s={s}
                i={i}
                total={slides.length}
                medindo={medindo}
                problema={problema}
                forma={forma}
                enquadra={enquadra}
                fracao={fracao}
                pendente={pendente}
                aoMudarModo={(modo) => mudarModo(s.id, modo)}
                aoMover={(para) => setSlides(moverNaOrdem(slides, i, para))}
                aoRemover={() => remover(s.id)}
              />
            ))}
          </ol>
          {/* A MESMA FRASE QUE A ACTION USARIA AO RECUSAR: aqui ela avisa. */}
          {problemaDaQuantidade && <p className={fieldError}>{textoDaRecusaDaPublicacao(problemaDaQuantidade)}</p>}
          {primeiroSlide && <p className={fieldError}>{textoDoProblemaDoPrimeiroSlide(primeiroSlide)}</p>}
        </div>
      )}

      <div>
        <label className={label} htmlFor="legenda">
          Legenda
        </label>
        <textarea
          id="legenda"
          name="legenda"
          rows={5}
          value={legenda}
          disabled={pendente}
          onChange={(e) => setLegenda(e.target.value)}
          className={input}
          placeholder="O texto que aparece embaixo do post."
        />
        <div className="mt-1.5 flex items-start justify-between gap-3">
          <p className={problemaDaLegendaAtual ? fieldError : hint}>
            {problemaDaLegendaAtual
              ? textoDoProblemaDaLegenda(problemaDaLegendaAtual)
              : "Hashtags e menções contam: 30 e 20 são os limites do Instagram."}
          </p>
          <p className={`shrink-0 text-xs ${numero} ${muted}`}>{legenda.length}/2200</p>
        </div>
      </div>

      <input ref={campoDeFuso} type="hidden" name="fuso" defaultValue="" />

      {/* A LISTA DOS ENVIOS DENTRO DA TELA, além da janelinha do canto: as duas
          leem o MESMO depósito e a MESMA função pura. */}
      {envios.length > 0 && (
        <div className={`${card} p-4`}>
          <ul className="space-y-1">
            {resumoDoProgresso(envios)?.linhas.map((linha, i) => (
              <li key={i} className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                {linha}
              </li>
            ))}
          </ul>
        </div>
      )}

      {quando}
      {opcoesDoReels}

      {recusa && (
        <p role="alert" className={fieldError}>
          {recusa}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {rodape}
        <button type="button" className={btnPrimary} disabled={pendente} onClick={publicar}>
          {pendente ? "Enviando…" : "Publicar"}
        </button>
      </div>
    </form>
  );
}

/** Uma linha da lista de montagem: a miniatura já enquadrada, o nome, o modo, a ordem e o remover. */
function LinhaDoSlide({
  s,
  i,
  total,
  medindo,
  problema,
  forma,
  enquadra,
  fracao,
  pendente,
  aoMudarModo,
  aoMover,
  aoRemover,
}: {
  s: Slide;
  i: number;
  total: number;
  medindo: boolean;
  problema: ProblemaDaSaida | null;
  forma: FormaDePublicacao;
  enquadra: boolean;
  fracao: { largura: number; altura: number };
  pendente: boolean;
  aoMudarModo: (modo: ModoDoEnquadramento) => void;
  aoMover: (para: number) => void;
  aoRemover: () => void;
}) {
  const nome = s.arquivo.name;
  // A MINIATURA É O RESULTADO, desenhado pelo próprio navegador: a caixa tem a
  // proporção escolhida, e `object-cover` é o corte ao centro, `object-contain`
  // sobre o branco é a imagem inteira com bordas. É o mesmo enquadramento que
  // `geometriaDoEnquadramento` manda o `canvas` desenhar, sem `canvas` nenhum na
  // tela. O vídeo, que não é recortado, aparece com `object-cover` na caixa: é
  // o corte que o Instagram faz.
  const ajuste = s.video || !enquadra || s.modo === "cortar" ? "object-cover" : "object-contain";
  return (
    <li className="flex items-start gap-3 text-xs" aria-label={nome}>
      <span className={`${numero} ${muted} pt-1`}>{i + 1}.</span>
      <span
        className="relative block w-16 shrink-0 overflow-hidden rounded-lg border border-traco bg-white dark:border-traco-escuro"
        style={enquadra ? { aspectRatio: `${fracao.largura} / ${fracao.altura}` } : { height: "4rem" }}
      >
        {s.video ? (
          <video src={s.endereco} muted playsInline preload="metadata" className={`h-full w-full ${ajuste}`} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.endereco} alt="" className={`h-full w-full ${enquadra ? ajuste : "object-contain"}`} />
        )}
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate text-zinc-700 dark:text-zinc-300">{nome}</p>
        {medindo ? (
          <p className={muted}>Lendo o arquivo…</p>
        ) : problema ? (
          <p className={fieldError}>{textoDoProblemaDaSaida(problema)}</p>
        ) : s.video && forma === "carrossel" ? (
          <p className={hint}>O Instagram corta este vídeo assim.</p>
        ) : null}
        {enquadra && !s.video && (
          <div className="flex flex-wrap gap-1">
            {(
              [
                ["cortar", "Cortar"],
                ["inteira", "Inteira, com bordas"],
              ] as const
            ).map(([modo, rotulo]) => (
              <button
                key={modo}
                type="button"
                aria-pressed={s.modo === modo}
                disabled={pendente}
                onClick={() => aoMudarModo(modo)}
                className={`rounded-lg border px-2 py-0.5 ${
                  s.modo === modo
                    ? "border-acao bg-acao/10 dark:border-acao-escuro dark:bg-acao-escuro/15"
                    : "border-traco dark:border-traco-escuro"
                }`}
              >
                {rotulo}
              </button>
            ))}
          </div>
        )}
      </div>
      {forma === "carrossel" && (
        <>
          {/* `type="button"` NÃO É DETALHE: sem ele, o padrão do HTML é
              `submit`, e reordenar o carrossel publicaria o post. */}
          <button
            type="button"
            aria-label={`Subir ${nome}`}
            disabled={pendente || i === 0}
            onClick={() => aoMover(i - 1)}
            className="rounded-lg px-2 py-0.5 text-zinc-600 enabled:hover:bg-zinc-100 disabled:opacity-30 dark:text-zinc-300 dark:enabled:hover:bg-zinc-800"
          >
            ↑
          </button>
          <button
            type="button"
            aria-label={`Descer ${nome}`}
            disabled={pendente || i === total - 1}
            onClick={() => aoMover(i + 1)}
            className="rounded-lg px-2 py-0.5 text-zinc-600 enabled:hover:bg-zinc-100 disabled:opacity-30 dark:text-zinc-300 dark:enabled:hover:bg-zinc-800"
          >
            ↓
          </button>
        </>
      )}
      <button
        type="button"
        disabled={pendente}
        onClick={aoRemover}
        className="rounded-lg px-2 py-0.5 text-zinc-600 enabled:hover:bg-zinc-100 disabled:opacity-30 dark:text-zinc-300 dark:enabled:hover:bg-zinc-800"
      >
        Remover
      </button>
    </li>
  );
}

/** A mensagem de um erro que veio de qualquer lugar, sem despejar o objeto (que pode carregar a URL assinada). */
function mensagemDoErro(erro: unknown): string {
  return erro instanceof Error && erro.message ? erro.message : "O envio não foi.";
}
```

- [ ] **Passo 5: a página entrega a action e as partes de servidor**

Em `app/publicar/novo/page.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/publicar/novo/page.tsx b/app/publicar/novo/page.tsx
index 6586210..7a1ba4d 100644
--- a/app/publicar/novo/page.tsx
+++ b/app/publicar/novo/page.tsx
@@ -1,18 +1,16 @@
 import Link from "next/link";
 import { getSelectedAccount } from "@/lib/account";
-import { tetoDoBucket } from "@/lib/bucket";
+import { pastaDaConta, tetoDoBucket } from "@/lib/bucket";
 import { avisoDaUrl } from "@/lib/avisos";
 import { PUBLICACOES_POR_DIA } from "@/lib/publicacao";
 import Enviador from "../enviador";
 import { publicar } from "../actions";
 import {
-  card,
   subtle,
   input,
   label,
   hint,
   muted,
-  btnPrimary,
   pageTitle,
   pageSubtitle,
   alertOk,
@@ -29,6 +27,12 @@ import {
 // navegador é quem envia o arquivo porque a Vercel recusa corpo acima de 4,5 MB.
 // Tudo o mais aqui é HTML de servidor, como no resto da base.
 //
+// O FORMULÁRIO MORA NELE desde a spec 2026-10-19-enquadrar-imagens: o arquivo
+// sobe no clique de publicar, e o botão precisa travar no primeiro clique e
+// chamar a action uma vez só (achados 107 e 108). Os pedaços de servidor do
+// formulário — o "Quando", as opções de reels e o rodapé — continuam escritos
+// aqui, e entram nele prontos, por propriedade.
+//
 // NENHUMA DECISÃO NO JSX: o aviso vem de `avisoDaUrl`, os limites de legenda e
 // de formato vêm de `lib/publicacao.ts`, e o teto do armazenamento vem do
 // bucket — nunca cravado.
@@ -110,9 +114,12 @@ export default async function Publicar({
             </p>
           </div>
 
-          <form action={publicar} className={`${card} space-y-6 p-5`}>
-            <Enviador teto={teto} />
-
+          <Enviador
+            teto={teto}
+            pasta={pastaDaConta(conta.ig_user_id)}
+            acao={publicar}
+            quando={
+              <>
             {/* QUANDO — refeito em 11/09/2026 porque o dono disse que estava
                 feio, e ele estava. Três coisas erradas, e a primeira não era
                 estética:
@@ -213,7 +220,9 @@ export default async function Publicar({
                 <p className={hint}>Uma hora que já passou é recusada.</p>
               </div>
             </fieldset>
-
+              </>
+            }
+            opcoesDoReels={
             <fieldset className={`${subtle} space-y-3 p-4`}>
               {/* MESMO TRATAMENTO DO "Quando", e por isso: `<legend>` fica em
                   cima da borda por padrão do navegador, e era o único
@@ -247,15 +256,14 @@ export default async function Publicar({
                 </p>
               </div>
             </fieldset>
-
-            <div className="flex flex-wrap items-center justify-between gap-3">
+            }
+            rodape={
               <p className={`text-xs ${muted}`}>
                 O Instagram aceita até {PUBLICACOES_POR_DIA} publicações por conta a cada 24
                 horas.
               </p>
-              <button className={btnPrimary}>Publicar</button>
-            </div>
-          </form>
+            }
+          />
         </>
       )}
     </div>
```

- [ ] **Passo 6: ver passar**

```bash
npx tsc --noEmit
npx eslint app/publicar/enviador.tsx app/publicar/navegador.ts app/publicar/novo/page.tsx testes-dom/publicar-compositor.dom.tsx tests/publicar-compositor-guarda.test.ts
npx vitest run --config vitest.dom.config.ts testes-dom/publicar-compositor.dom.tsx
npx vitest run tests/publicar-compositor-guarda.test.ts
```

Esperado: `tsc` e lint limpos; os 21 casos de tela passam, e os 6 da guarda.

- [ ] **Passo 7: varrer e commitar**

```bash
node "$SCRATCH/varrer-texto.mjs" app/publicar/enviador.tsx app/publicar/navegador.ts app/publicar/novo/page.tsx testes-dom/publicar-compositor.dom.tsx tests/publicar-compositor-guarda.test.ts
test "$(git branch --show-current)" = "enquadrar-imagens"
git add app/publicar/enviador.tsx app/publicar/navegador.ts app/publicar/novo/page.tsx testes-dom/publicar-compositor.dom.tsx tests/publicar-compositor-guarda.test.ts
```

```bash
git commit -F - <<'MSG'
O /publicar enquadra as imagens na lista e sobe tudo só no clique de publicar

A pessoa escolhe a proporção, vê a miniatura de cada slide já enquadrada,
troca o corte pela imagem inteira com bordas, reordena e remove antes de
subir qualquer coisa. Com o envio no clique, o caminho deixa de existir antes
do botão e a dedupe deixa de segurar o clique duplo: o botão trava antes de
qualquer espera e chama a action uma vez, com os caminhos da subida, no molde
do gerador. As recusas da legenda, da hora, da quantidade e do vídeo em
primeiro aparecem antes de subir. A action termina em redirect, que rejeita
a espera com NEXT_REDIRECT: a chamada fica sem catch, e uma guarda lê isso.
MSG
```

---

### FASE 6 — A verificação inteira

- [ ] **Passo 1: o verify**

```bash
env -u CLAUDECODE -u AI_AGENT npm run verify
git diff --stat AGENTS.md
```

Esperado: lint e `tsc` limpos; 123 arquivos e 3 368 casos puros e 26 arquivos e 241 de tela; a varredura "SEM VAZAMENTO
em A nem em C"; o build (Turbopack) com "MIGRAÇÃO PULADA" e as rotas `ƒ /publicar`, `ƒ /publicar/novo` e
`ƒ /publicar/post/[id]`; o `AGENTS.md` sem diferença.

- [ ] **Passo 2: a integração inteira, no container**

```bash
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npm run test:integracao
```

Esperado: `[rede-global] ALVO: banco de TESTE`; 46 arquivos, 529 passaram e 8 pularam.

- [ ] **Passo 3: as provas de mutação**

Copie o script do Apêndice A para `$SCRATCH/mutar-enquadrar.mjs` e rode, da raiz:

```bash
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" node "$SCRATCH/mutar-enquadrar.mjs"
git status --short
```

Esperado: as 27 com ✓, "27 mutações, 0 ruins", e a árvore limpa depois.

- [ ] **Passo 4: a guarda do diff**

```bash
git diff --name-only 260b9dd -- . ':!docs'
git diff --stat 260b9dd -- app/publicar/actions.ts app/api lib/queue-drain.ts lib/engine.ts lib/bucket.ts lib/dedupe.ts lib/db.ts lib/esquema.ts lib/bonus migrations scripts package.json package-lock.json next.config.ts proxy.ts
```

Esperado: na primeira, só os 12 arquivos do mapa:

```text
app/publicar/enviador.tsx
app/publicar/navegador.ts
app/publicar/novo/page.tsx
app/publicar/page.tsx
app/publicar/post/[id]/page.tsx
lib/publicacao.ts
testes-dom/publicar-compositor.dom.tsx
testes-integracao/publicar-fala.integracao.ts
tests/publicacao-enquadramento.test.ts
tests/publicacao.test.ts
tests/publicar-compositor-guarda.test.ts
tests/publicar-previas.test.ts
```

e a segunda vazia.

- [ ] **Passo 5: avisar o auditor**, com o hash e os números. O push e o PR só com o OK do Eduardo.

---

### FASE 7 — A prova real, no preview, com o Eduardo

Cada escrita em produção tem o OK do Eduardo, pela caixa, e a auditoria lê o banco antes e depois (avisada
com a hora). O preview usa o banco e o bucket de produção. **Sem post real. Sem migração. Nenhum clique em
Publicar com "Publicar agora" marcado** (achado 114): é o padrão do formulário
(`app/publicar/novo/page.tsx`, "sai em instantes, e não dá para desfazer").

- [ ] **Passo 1: a linha de base da auditoria**, só de leitura.

- [ ] **Passo 2: o push da branch e o preview, com o OK do Eduardo**

Empurre só a branch (`git push origin refs/heads/enquadrar-imagens:refs/heads/enquadrar-imagens`). No log
do build do preview, confira o commit e "MIGRAÇÃO PULADA". O endereço do preview vem do `get_deployment`
(o nome da branch pode sair encurtado).

- [ ] **Passo 3: a prova, com o Eduardo na tela** (os passos da spec, "A prova real")

1. No `/publicar/novo`, no navegador de uso do Eduardo, um carrossel com quatro arquivos: uma foto de
   celular em pé, tirada no celular, em "Cortar"; um print ou arte deitada, em "Inteira, com bordas"; um
   JPEG já em 4:5 exato, com até 1440 px de largura, que vai sem redesenho; um vídeo curto de iPhone
   (`.mov`), em quarto, aberto no Chrome do computador e no Safari. A lista mostra as miniaturas, e se
   confere remover um slide e escolher de novo.
2. Marcar **"Publicar em outra hora"**, com a data de daqui a 7 dias, e só então dar **dois cliques
   rápidos** no Publicar (grava). A auditoria confere logo depois que há **um item só na fila**, as medidas
   de cada imagem no bucket (4:5 nas três) e que o JPEG subiu igual ao original, byte a byte. A página do
   post mostra o vídeo como vídeo, e o calendário mostra a capa.
3. Cancelar na página do post (grava). O cancelamento tira os arquivos do bucket, e a página passa a dizer
   que o arquivo foi apagado.

A linha da fila cancelada sai ou fica conforme o Eduardo decidir pela caixa; se sair, é por um script lido
pela auditoria antes de rodar. Depois: o corpo do PR e a mensagem do merge, conferidos pela auditoria, e o PR
com o OK do Eduardo. **O merge é do Eduardo**, com a mensagem colada nos dois campos (o título e a
descrição), e o build do merge diz "Nada a aplicar: as 19 migrações".

---

## Apêndice A — as provas de mutação

O script roda da raiz do repositório, com a `DATABASE_URL_TESTES` do container (ele recusa sem ela). Cada
mutação tira uma proteção, roda o teste que a cobre e confere que o caso nomeado caiu; cada arquivo volta
byte a byte.

```js
// Provas de mutação do enquadramento do /publicar (spec 2026-10-19-enquadrar-imagens). Cada mutação tira
// uma proteção e roda o teste que a cobre; o caso nomeado tem de cair. Cada arquivo volta byte a byte.
// Uso, da raiz do repositório: DATABASE_URL_TESTES=<container> node mutar-enquadrar.mjs [filtro]
// As mutações INTEG rodam a suíte de integração, que sem DATABASE_URL_TESTES cai na DATABASE_URL, a da
// PRODUÇÃO (achado 68): sem a variável, o script recusa antes de mutar, e uma rodada INTEG que não imprime
// "ALVO: banco de TESTE" conta como ✗.
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const PURA = (f) => `npx vitest run ${f}`;
const DOM = (f) => `npx vitest run --config vitest.dom.config.ts ${f}`;
const INTEG = (f) => `npx vitest run --config vitest.integracao.config.ts ${f}`;

const REGRAS = "lib/publicacao.ts";
const COMPOSITOR = "app/publicar/enviador.tsx";
const NAVEGADOR = "app/publicar/navegador.ts";
const POST = "app/publicar/post/[id]/page.tsx";
const CALENDARIO = "app/publicar/page.tsx";

const T_ENQ = PURA("tests/publicacao-enquadramento.test.ts");
const T_PUB = PURA("tests/publicacao.test.ts");
const T_PREVIAS = PURA("tests/publicar-previas.test.ts");
const T_GUARDA = PURA("tests/publicar-compositor-guarda.test.ts");
const T_TELA = DOM("testes-dom/publicar-compositor.dom.tsx");
const T_FALA = INTEG("testes-integracao/publicar-fala.integracao.ts");

const MUTACOES = [
  // FASE 1: as regras puras
  { nome: "1: o 4:5 arredonda ao mais próximo (achado 112)", arq: REGRAS,
    de: "  if (f.largura < f.altura) return Math.floor(exata);", para: "  if (f.largura < f.altura) return Math.round(exata);",
    cmd: T_ENQ, caso: "toda saída, de 320 a 1440 de largura" },
  { nome: "1: o 1,91:1 arredonda ao mais próximo", arq: REGRAS,
    de: "  if (f.largura > f.altura) return Math.ceil(exata);", para: "  if (f.largura > f.altura) return Math.round(exata);",
    cmd: T_ENQ, caso: "toda saída, de 320 a 1440 de largura" },
  { nome: "1: o corte estreito deixa de sugerir as bordas", arq: REGRAS,
    de: '  const sugereBordas = p.modo === "cortar" && geometriaSemRecusa(p.largura, p.altura, f, "inteira") !== null;',
    para: "  const sugereBordas = false;",
    cmd: T_ENQ, caso: "o corte que deixa a imagem estreita demais sugere as bordas" },
  { nome: "1: o EXIF lido só na ordem Intel", arq: REGRAS,
    de: "  if (!intel && !motorola) return 1;", para: "  if (!intel) return 1;",
    cmd: T_ENQ, caso: "nas duas ordens de bytes" },
  { nome: "1: o cru ignora a orientação EXIF", arq: REGRAS,
    de: '  if (p.mime !== "image/jpeg" || p.orientacao !== 1) return false;', para: '  if (p.mime !== "image/jpeg") return false;',
    cmd: T_ENQ, caso: "a foto girada pelo EXIF" },
  { nome: "1: o cru copia a tolerância de 1% do gerador, em vez do exato", arq: REGRAS,
    de: "    g.largura === p.largura &&\n    g.altura === p.altura &&\n    g.origem.largura === p.largura &&\n    g.origem.altura === p.altura\n",
    para: "    Math.abs(p.largura / p.altura - g.largura / g.altura) <= 0.01 * (g.largura / g.altura)\n",
    cmd: T_ENQ, caso: "o que não é exato passa pelo canvas" },
  { nome: "1: o vermelho volta a ser sobre o original (achado 110)", arq: REGRAS,
    de: '  if (!arq.mime.startsWith("image/")) return problemaDoArquivo(forma, arq, tetoDoBucketEmBytes);',
    para: "  return problemaDoArquivo(forma, arq, tetoDoBucketEmBytes);",
    cmd: T_ENQ, caso: "a foto de celular 3:4 e o PNG em pé não ficam vermelhos" },
  { nome: "1: a trava olha o primeiro da lista, e não o primeiro válido (achado 111)", arq: REGRAS,
    de: "  const primeiro = validos[0];", para: "  const primeiro = itens[0];",
    cmd: T_ENQ, caso: "o primeiro VÁLIDO decide" },
  { nome: "1: o carrossel só de vídeos passa a travar", arq: REGRAS,
    de: "  if (!validos.some((i) => !i.video)) return null;\n", para: "  if (!validos.length) return null;\n",
    cmd: T_ENQ, caso: "o carrossel só de vídeos não trava" },
  { nome: "1: o reels deixa de ser sempre vídeo na prévia", arq: REGRAS,
    de: '  return forma === "reels" || pareceVideo(caminho);', para: "  return pareceVideo(caminho);",
    cmd: T_ENQ, caso: "o reels é sempre vídeo" },
  { nome: "1: a capa volta a ser o primeiro caminho", arq: REGRAS,
    de: "  return caminhos.find((c) => !ehVideoNoPost(forma, c)) ?? null;", para: "  return caminhos[0] ?? null;",
    cmd: T_ENQ, caso: "a capa é a primeira imagem do post" },
  // FASE 2: a frase do post encerrado (achado 113)
  { nome: "2: o cancelado volta a dizer que o arquivo ficou", arq: REGRAS,
    de: "    if (motivo?.trim() === MOTIVO_CANCELADO_PELO_DONO) {", para: "    if (false) {",
    cmd: T_PUB, caso: "cancelado pelo painel: o arquivo foi APAGADO" },
  { nome: "2: a frase decide pelo status, e não pelo motivo", arq: REGRAS,
    de: "    if (motivo?.trim() === MOTIVO_CANCELADO_PELO_DONO) {", para: "    if (true) {",
    cmd: T_PUB, caso: "pulado pelo dreno, com a conta desconectada" },
  // FASE 3: as prévias com vídeo
  { nome: "3: a página do post volta a desenhar <img> para o vídeo", arq: POST,
    de: "                p && ehVideoNoPost(p.forma, m.caminho) ? (", para: "                false ? (",
    cmd: T_PREVIAS, caso: "pergunta à regra pura se cada caminho é vídeo" },
  { nome: "3: o calendário volta a pegar o primeiro caminho", arq: CALENDARIO,
    de: "const primeira = !saiu && p ? capaDoPost(p.forma, p.caminhos) : null;", para: "const primeira = !saiu ? p?.caminhos?.[0] ?? null : null;",
    cmd: T_PREVIAS, caso: "pede a capa à regra pura" },
  // FASE 4: a frase do sem arquivo
  { nome: "4: a frase do sem arquivo volta a mandar esperar o envio (pura)", arq: REGRAS,
    de: '      return "Escolha um arquivo antes de publicar.";', para: '      return "Escolha um arquivo e espere o envio terminar antes de publicar.";',
    cmd: T_PUB, caso: "sem arquivo: a frase não manda esperar envio nenhum" },
  { nome: "4: a frase do sem arquivo volta a mandar esperar o envio (integração)", arq: REGRAS,
    de: '      return "Escolha um arquivo antes de publicar.";', para: '      return "Escolha um arquivo e espere o envio terminar antes de publicar.";',
    cmd: T_FALA, caso: "sem arquivo (campo vazio) recusa com o que fazer" },
  // FASE 5: o compositor
  { nome: "5: sem a trava, dois cliques sobem duas vezes (achado 107)", arq: COMPOSITOR,
    de: "    if (trava.current) return;\n    trava.current = true;", para: "    trava.current = true;",
    cmd: T_TELA, caso: "dois cliques e o Enter dão UMA leva de assinaturas" },
  { nome: "5: sem a trava, a guarda cai também", arq: COMPOSITOR,
    de: "    if (trava.current) return;\n    trava.current = true;", para: "    trava.current = true;",
    cmd: T_GUARDA, caso: "a trava é ligada antes de qualquer espera" },
  { nome: "5: um catch engole o erro da action (o NEXT_REDIRECT)", arq: COMPOSITOR,
    de: "        await acao(pedido);\n      } finally {", para: "        await acao(pedido);\n      } catch {\n        setRecusa(\"O envio falhou.\");\n      } finally {",
    cmd: T_GUARDA, caso: "a chamada da action não tem catch em volta" },
  { nome: "5: o envio nativo deixa de ser segurado", arq: COMPOSITOR,
    de: "        ev.preventDefault();\n        publicar();", para: "        publicar();",
    cmd: T_GUARDA, caso: "o formulário não tem action" },
  { nome: "5: a hora deixa de ser conferida antes de subir (achado 109)", arq: COMPOSITOR,
    de: "        const daHora = recusaDaHora(form);\n        if (daHora) {", para: "        const daHora = null as string | null;\n        if (daHora) {",
    cmd: T_TELA, caso: "'outra hora' sem a data trava antes de subir" },
  { nome: "5: a falha da subida devolve o caminho mesmo assim", arq: COMPOSITOR,
    de: "        await navegador.subir(assinatura.url, arquivo, (enviados, total) => atualizarEnvio(nome, { enviados, total }), controle.signal);",
    para: "        await navegador.subir(assinatura.url, arquivo, (enviados, total) => atualizarEnvio(nome, { enviados, total }), controle.signal).catch(() => {});",
    cmd: T_TELA, caso: "o caminho só fica guardado depois do 2xx" },
  { nome: "5: a pasta da conta deixa de ser conferida", arq: COMPOSITOR,
    de: "        if (caminhos.some((c) => !c.startsWith(`${pasta}/`))) {", para: "        if (false) {",
    cmd: T_TELA, caso: "um caminho fora da pasta da conta recusa" },
  { nome: "5: a janelinha fica até a action", arq: COMPOSITOR,
    de: "        limparEnvios();\n        const pedido = new FormData(form);", para: "        const pedido = new FormData(form);",
    cmd: T_TELA, caso: "a trava solta depois da action, e a janelinha sai antes dela" },
  { nome: "5: sair da tela deixa a subida andando", arq: COMPOSITOR,
    de: "      for (const c of ativos) c.abort();\n", para: "",
    cmd: T_TELA, caso: "sair da tela no meio da subida interrompe" },
  { nome: "5: o sinal deixa de abortar o PUT", arq: NAVEGADOR,
    de: '    sinal.addEventListener("abort", abortar, { once: true });\n', para: "",
    cmd: T_TELA, caso: "o sinal aborta o pedido, e a subida rejeita" },
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
  const casoCaiu = saida.split("\n").some((l) => /FAIL|×/.test(l) && l.includes(m.caso));
  if (!(caiu && casoCaiu)) ruins++;
  console.log(`${caiu && casoCaiu ? "✓" : "✗"} ${m.nome}: o caso "${m.caso}" ${casoCaiu ? "caiu" : "NÃO caiu"}`);
}
console.log(`${escolhidas.length} mutações, ${ruins} ruins`);
process.exit(ruins ? 1 : 0);
```

## Apêndice B — a sonda do redirect

A sonda que mediu o desfecho da action com `redirect` (19/10, Next 16.3.8). Ela roda numa cópia descartável
com `node_modules` próprio, o `instrumentation.ts` tirado (ele exige banco na partida), o `.env.local` vazio
e nenhuma variável de banco no shell, na rota pública `/entrar/sonda`. Depois, a cópia volta como estava.

`app/entrar/sonda/acoes.ts`:

```js
"use server";
import { redirect } from "next/navigation";

// SONDA DE LABORATÓRIO (não vai para commit): o que acontece no cliente quando uma action chamada
// direto, dentro de startTransition, termina em redirect para a MESMA rota com outro search param.
export async function acaoQueRedireciona(form: FormData): Promise<void> {
  const tipo = String(form.get("tipo") ?? "ok");
  await new Promise((r) => setTimeout(r, 300));
  redirect(`/entrar/sonda?aviso=${tipo}-${Date.now()}`);
}
```

`app/entrar/sonda/sonda.tsx`:

```js
"use client";
import { useEffect, useRef, useState, useTransition } from "react";

type Registro = { montagens: number; pendentes: boolean[]; resolvida: number; rejeitada: string[]; depoisDoAwait: number };

declare global {
  interface Window {
    __sonda?: Registro;
  }
}

function registro(): Registro {
  if (!window.__sonda) window.__sonda = { montagens: 0, pendentes: [], resolvida: 0, rejeitada: [], depoisDoAwait: 0 };
  return window.__sonda;
}

export default function Sonda({ aviso, acao }: { aviso: string | null; acao: (f: FormData) => Promise<void> }) {
  const [contador, setContador] = useState(0);
  const [pendente, iniciar] = useTransition();
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    registro().montagens++;
  }, []);
  useEffect(() => {
    registro().pendentes.push(pendente);
  }, [pendente]);

  function chamar() {
    iniciar(async () => {
      try {
        await acao(new FormData(form.current!));
        registro().resolvida++;
      } catch (e) {
        registro().rejeitada.push(String(e).slice(0, 80));
        throw e;
      } finally {
        registro().depoisDoAwait++;
      }
    });
  }

  return (
    <form ref={form} onSubmit={(e) => e.preventDefault()}>
      <p id="aviso">{aviso ?? "sem aviso"}</p>
      <p id="contador">{contador}</p>
      <p id="pendente">{pendente ? "pendente" : "parado"}</p>
      <input name="tipo" defaultValue="ok" />
      <button type="button" id="mais" onClick={() => setContador((c) => c + 1)}>
        mais
      </button>
      <button type="button" id="chamar" onClick={chamar}>
        chamar
      </button>
    </form>
  );
}
```

`app/entrar/sonda/page.tsx`:

```js
import Sonda from "./sonda";
import { acaoQueRedireciona } from "./acoes";

export const dynamic = "force-dynamic";

export default async function Pagina({ searchParams }: { searchParams: Promise<{ aviso?: string }> }) {
  const { aviso } = await searchParams;
  return <Sonda aviso={aviso ?? null} acao={acaoQueRedireciona} />;
}
```

O motorista, um Edge sem janela pelo DevTools (`node sonda-cdp.mjs <pasta-de-perfil-temporária>`, com o
`next dev` ou o `next start` na porta 3999):

```js
// Dirige um Edge sem janela, pelo protocolo do DevTools, contra a sonda do laboratório
// (http://localhost:3999/entrar/sonda): mede se, depois de uma action que termina em redirect para a
// mesma rota, o componente de cliente é mantido ou recriado, se o await resolve, rejeita ou fica
// pendurado, e se o isPending do useTransition volta a false. Não grava nada em lugar nenhum.
// Uso: node sonda-cdp.mjs <pasta-de-perfil-temporaria>
import { spawn } from "node:child_process";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PORTA = 9333;
const perfil = process.argv[2];
const dorme = (ms) => new Promise((r) => setTimeout(r, ms));

const edge = spawn(EDGE, ["--headless=new", `--remote-debugging-port=${PORTA}`, `--user-data-dir=${perfil}`, "--no-first-run", "about:blank"], {
  stdio: "ignore",
});
try {
  let alvos = null;
  for (let i = 0; i < 40 && !alvos; i++) {
    await dorme(250);
    try {
      alvos = await (await fetch(`http://127.0.0.1:${PORTA}/json/list`)).json();
    } catch {}
  }
  const pagina = alvos.find((a) => a.type === "page");
  const ws = new WebSocket(pagina.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 0;
  const pendentes = new Map();
  ws.addEventListener("message", (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pendentes.has(m.id)) {
      pendentes.get(m.id)(m);
      pendentes.delete(m.id);
    }
  });
  const cdp = (method, params = {}) =>
    new Promise((r) => {
      const meu = ++id;
      pendentes.set(meu, r);
      ws.send(JSON.stringify({ id: meu, method, params }));
    });
  const avalia = async (expr) => (await cdp("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
  const leitura = () =>
    avalia(`JSON.stringify({
      href: location.pathname + location.search,
      aviso: document.querySelector('#aviso')?.textContent,
      contador: document.querySelector('#contador')?.textContent,
      pendente: document.querySelector('#pendente')?.textContent,
      sonda: window.__sonda,
    })`);

  await cdp("Page.enable");
  await cdp("Runtime.enable");
  await cdp("Page.navigate", { url: "http://localhost:3999/entrar/sonda" });
  for (let i = 0; i < 120; i++) {
    await dorme(500);
    if ((await avalia("document.querySelector('#chamar') ? 1 : 0")) === 1 && (await avalia("window.__sonda ? 1 : 0")) === 1) break;
  }
  await dorme(1500);
  console.log("INICIO        ", await leitura());
  for (let i = 0; i < 3; i++) await avalia("document.querySelector('#mais').click()");
  await dorme(300);
  console.log("DEPOIS +3     ", await leitura());
  await avalia("document.querySelector('#chamar').click()");
  await dorme(150);
  console.log("LOGO DEPOIS   ", await leitura());
  await dorme(6000);
  console.log("6 s DEPOIS    ", await leitura());
  await avalia("document.querySelector('#chamar').click()");
  await dorme(6000);
  console.log("2a CHAMADA +6s", await leitura());
  ws.close();
} finally {
  edge.kill();
}
```
