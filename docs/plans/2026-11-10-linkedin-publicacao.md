# O post do LinkedIn, só texto e imagem (parte 2a de 3) — Plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: `superpowers:subagent-driven-development`
> (recomendada) ou `superpowers:executing-plans`, fase por fase. Os passos usam caixa de
> seleção (`- [ ]`) para acompanhar.

**Objetivo:** publicar no perfil pessoal do LinkedIn, pela tela de publicar, um post só de texto ou com uma imagem, agora ou agendado, numa rede por post. O post entra na fila como mais um tipo (`publicacao_linkedin`) e sai pelo dreno, sem nunca sair duas vezes. As telas de Publicações mostram o post do LinkedIn, e o cancelar e o remarcar valem para ele.

**Arquitetura:**
- a 025 alarga o `queue_kind_check` com o `publicacao_linkedin`. A lista do dreno (`lib/fila-tipos.ts`) ganha o tipo, e a lista nova `TIPOS_DE_PUBLICACAO` responde "post, e não mensagem" em todo lugar que hoje diz `kind = 'publicacao'`: a cota de DM, a exceção do teto, os tiques do dia, o Início, o Desempenho, as telas de Publicações, o cancelar, o remarcar e o `caminhosNaFila` do gerador;
- `lib/linkedin-publicacao.ts` (puro) guarda as regras: as formas, o texto com a hashtag clicável e os escapes do "little text", o tamanho contado depois disso, as recusas do pedido, o payload, o corpo do post e os erros. `lib/linkedin.ts` ganha as chamadas versionadas (`Linkedin-Version 202610`): a reserva da imagem, o envio e o post;
- `lib/linkedin-fila.ts` enfileira e publica. O dreno passa a ele as três funções dele, sem ciclo. Os passos ficam marcados no payload: o `imagem_urn`; o `post_tentado_em`, ANTES do POST; e o `post_urn`. A marca sem o URN nunca publica de novo (achado 210);
- o "agora" publica só a própria linha (`drenarUmaPublicacaoDoLinkedin`, com uma reivindicação atômica; achado 211), na mesma ida da action. Isso também resolve o preview, que não tem QStash (nota 198);
- o ramo do LinkedIn só começa um passo que a função tem tempo de terminar: o prazo é o começo da função mais 55 s, e as rotas que drenam passam o começo delas;
- a tela de compor escolhe a rede. No LinkedIn, "Só texto" ou "Imagem", o campo "Texto" e o contador de 3 000 que conta como o LinkedIn conta (achado 212). A action confere de novo a conta, a conexão e o pedido.

**Stack:** a do projeto, no Next.js 16.4.3: Vitest (puros, tela e integração) e o Postgres no container para a integração.

**Spec:** `docs/specs/2026-11-06-linkedin-no-perfil.md`, na `main`, com a emenda de 09/11 (a entrega em três partes). Leia a emenda, o §4, o §5, o §6 e o §7 antes de começar: este plano não repete o porquê, só como construir. A parte 1 (a conexão) está em produção desde 09/11 (PR #32, `f15c3ad`).

**As decisões de 09/11/2026, pela caixa:**
- **"Começar a parte 2 (Recomendado)"** (18:31:57.042Z);
- **"Dividir em 2a e 2b (Recomendado)"** (18:40:22.823Z): a 2a é só texto e imagem, numa rede por post; a 2b junta as duas redes no mesmo post (a cópia da imagem, o desfazer, os achados 192 e 199, e o 209);
- **"Virar hashtag clicável (Recomendado)"** (18:45:38.028Z): o `#palavra` vira o modelo `{hashtag|\#|palavra}`, e o resto do texto tem os 15 caracteres reservados escapados.

**A auditoria (`metodochat-3e` em 09/11, `metodochat-55` em 10/11), sobre o desenho e o ensaio:**
- o achado 210: o POST do post não tem chave contra repetição. A marca vai antes dele, e a dúvida (a rede, o 5xx, o 2xx sem id) vira `failed`, "pode ter saído; confira no seu LinkedIn". Só o 4xx tira a marca;
- o achado 211: o "agora" drena só a própria linha, com a reivindicação pelo kind, pelo status e pelo `not_before`;
- o achado 212: o limite é contado depois da transformação, pela mesma função na tela e no servidor, e a tela diz por que o número passa do que se digitou;
- as notas do ensaio: o teto próprio do envio da imagem (15 s), com a soma do ramo em 45 s; o orçamento de tempo da função (FASE 3); o tique da linha que o "agora" devolve (FASE 3) e o da que ele não chega a pegar (FASE 6); a conta pela regra das contas, e os caminhos pela pasta dessa conta (FASE 5); as 37 mutações do Apêndice A, com a F2-15 conferida pela mensagem; e, na prova, a conexão pela produção, o tempo do ramo pelo banco e a base lida antes e depois de cada "agora" (FASE 8).

**Ensaio do plano (09 e 10/11):** o código deste plano foi escrito e testado fase a fase numa cópia isolada (`git worktree`, sem push, branch local `ensaio-linkedin-publicacao`, saída de `f15c3ad`, com `npm ci` próprio e `.env.local` vazio). Todo bloco de código abaixo foi tirado do git dessa cópia por um gerador, sem cópia à mão. Os commits do ensaio:
- FASE 1, `d6484e1` (patch-id `9e3ee0d6f25c`);
- FASE 2, `a64809b` (patch-id `d53010778a3f`);
- FASE 3, `6954773` (patch-id `f9ab4ba363bf`);
- FASE 4, `4c3f791` (patch-id `a9b6249974ac`);
- FASE 5, `801f2d1` (patch-id `320b6f126c51`);
- FASE 6, `862dd16` (patch-id `c173f6cd2186`).
As mensagens são as deste plano. Os números de RED e de GREEN de cada passo foram medidos numa segunda cópia limpa saída de `f15c3ad`, fazendo o caminho de quem executa: os testes primeiro, o código depois e o commit com a mesma mensagem. As seis fases deram o mesmo patch-id do ensaio. Os registros ficam na pasta de trabalho do DEV: `el2-*.log` (o ensaio), `ml2-*.log` (o RED e o GREEN de cada fase), `el2-mutar.log` (as mutações) e os da verificação final.

Os números do fim, no `6899b24` (entre parênteses, os da base `f15c3ad`):
- lint e `tsc` limpos;
- testes puros: 155 arquivos e 3 714 casos (150 e 3 653); testes de tela: 36 arquivos e 324 casos (35 e 315);
- a varredura sem vazamento e o build com o Next 16.4.3 ("MIGRAÇÃO PULADA", fora da produção);
- a integração no container: 75 arquivos, 897 passaram e 8 pularam (72, 835 e 8);
- as 37 mutações do Apêndice A derrubaram, cada uma, o caso esperado (a F2-15, pela mensagem): "37 mutações, 0 ruins; árvore no fim: limpa";
- a guarda do diff (FASE 7): 41 arquivos fora de `docs`, com 3 772 linhas a mais e 250 a menos;
- este plano, aplicado do zero numa cópia limpa do `f15c3ad` (cada "Crie" gravado, cada "Em ... aplique" passado ao `git apply`), deu os 41 arquivos iguais aos do ensaio: "12 criados, 48 diffs aplicados, 0 apagados, 0 gerados; 41 arquivos conferidos, 0 diferentes".

O `6899b24` é o último commit da cópia da medição, com a árvore igual à do `862dd16` do ensaio.

**O que o ensaio achou:**
- **o LinkedIn falso somava 7e18 + n**, que passa do inteiro exato do JavaScript e devolvia sempre o mesmo id. O id virou texto no próprio teste;
- **o envio da imagem não cabia no teto de 10 s** de toda chamada, e o teto maior poria o ramo inteiro acima dos 60 s da função. Por isso a FASE 3: os tetos somam 45 s, e cada passo só começa se o que resta do prazo cobre o pior caso dele. Morta no meio, a linha ficaria em `sending`; na prova, o dreno da `main` de hoje não conhece o tipo, e uma linha assim seria recuperada só depois do merge, publicando na hora do deploy;
- **o "agora" não tem o rodapé do dreno**, que é quem arma o próximo tique. A linha que ele devolve à fila, e a que ele não chega a pegar, ganham o tique dela (FASE 3 e FASE 6);
- **o `react-hooks/purity` recusa o `Date.now()` no desenho da página de compor**. Ele é silenciado com o motivo, como em `app/setup/page.tsx`: o Server Component roda uma vez por requisição;
- **três guardas de texto antigas** cobravam o JSX das prévias, o `await acao(dados)` do compositor e a lista exata do que não é entrega do motor. Elas foram atualizadas para as funções novas, sem perder o que prendiam;
- **um caso dizia "nem a que já saiu" sem semear a linha que já saiu**, e a mutação do `status` na reivindicação do "agora" passaria. A linha entrou no caso (FASE 6);
- **a mutação da definição do `queue_kind_check` era pega pelo `beforeAll`**, e não por um caso: o teste aplica a pasta pelo próprio script, e a conferência acusa antes. Ela ficou como a F2-15, conferida pela mensagem, e a F2-14 passou a ser a regressão de verdade, a de aceitar de novo a forma da 010 (Apêndice A).

## Restrições globais

- **Branch:** `linkedin-publicacao`, saída do `f15c3ad` (a `main` de hoje), sem upstream. O primeiro commit é este plano. Nunca commitar nem empurrar na `main`: ela não está protegida, e um push nela dispara o deploy na Vercel. Conferir `git branch --show-current` antes de cada commit.
- **`git add` com caminho explícito.** Nunca `-A` nem `.`.
- **Commit no estilo do Vinícius:** uma frase dizendo o efeito, sem prefixo, sem rodapé de IA. Autor: Eduardo Kobal <162614913+Eduardokobal@users.noreply.github.com>.
- **Antes de cada commit**, varrer os arquivos tocados atrás de caractere de controle e de fim de linha misturado, e gravar a saída num registro.
- **O commit é um comando à parte**, depois de ler a saída dos testes.
- **Fim de linha:** os diffs deste plano estão em LF. Aplique com `git apply --ignore-whitespace`, ou numa cópia feita com `git -c core.autocrlf=false worktree add`. Nunca `git config` numa worktree: ele grava no `.git/config` compartilhado.
- **As ferramentas são as da cópia:** `npm ci` na FASE 0, e todo `npx` é `npx --no-install` (achado 208).
- **Os arquivos desta parte são os 41 do mapa abaixo, e mais nenhum.**
- **A única escrita em produção é a 025, aplicada à mão na FASE 8**, com o OK do Eduardo pela caixa, a hora mandada à auditoria antes e o "pode" dela. Fora isso, só os posts da prova (públicos, apagados à mão no fim), o merge do Eduardo e o deploy que ele dispara.
- **Uma rodada de integração de cada vez**, sempre com `DATABASE_URL_TESTES` apontando para o container (`127.0.0.1:5434`). Toda rodada tem de imprimir `[rede-global] ALVO: banco de TESTE`. Nunca rode com a variável vazia: ela cai na `DATABASE_URL`, que é **produção**. Se o container estiver parado: `docker start metodochat-banco-de-teste`.
- **`next build` sem as variáveis de agente:** `env -u CLAUDECODE -u AI_AGENT ...`, e `git diff AGENTS.md` depois.
- **O token, o code e a client secret do LinkedIn** nunca passam pelo chat nem por registro. As chaves ficam só nas variáveis da Vercel. Os testes usam valores inventados, e todo teste que fala com o LinkedIn fala com um falso no loopback, com o `fetch` interceptado.

## Mapa dos arquivos

| Arquivo | O que faz | Fase |
|---|---|---|
| `lib/linkedin-publicacao.ts` | as formas, o texto e a hashtag, o tamanho, o payload, o corpo, o link e os erros (1); o "pode ter saído" (2); o nome do post na tela (4); as recusas, a disponibilidade, o aviso e o id do envio (5) | 1, 2, 4, 5 |
| `lib/linkedin.ts` | a versão 202610, a reserva, o envio da imagem e o post (1); o teto do envio (3) | 1, 3 |
| `lib/dedupe.ts` | a chave do post do LinkedIn | 1 |
| `tests/linkedin-post.test.ts` (novo) | as regras puras do post | 1, 2 |
| `tests/linkedin-rest.test.ts` (novo) | o que é puro nas chamadas; os tetos (3) | 1, 3 |
| `migrations/025-fila-linkedin.sql` (novo) | o `publicacao_linkedin` no `queue_kind_check` | 2 |
| `lib/fila-tipos.ts` | o tipo novo e a lista `TIPOS_DE_PUBLICACAO` | 2 |
| `lib/linkedin-fila.ts` (novo) | o enfileirar e o publicar (2); o orçamento de tempo (3); o id da linha e as recusas da tela (5) | 2, 3, 5 |
| `lib/queue-drain.ts` | o ramo, a cota, a seleção, os tiques e o "agora" (2); o prazo e o tique da linha (3); o tique exportado (6) | 2, 3, 6 |
| `scripts/migrar.mjs` | a conferência do `queue_kind_check` passa a ser a da 025 | 2 |
| `lib/esquema.ts` | a 025 em `naoObservaveis` | 2 |
| `app/labels.ts` | "Publicação no LinkedIn" | 2 |
| `testes-integracao/linkedin-publicacao.integracao.ts` (novo) | a fila e o dreno contra um LinkedIn falso | 2, 3, 5, 6 |
| `testes-integracao/conferencia-do-kind.integracao.ts` | a forma da 025 é a única | 2 |
| `tests/fila-tipos.test.ts` | a lista do dreno presa à 025 | 2 |
| `tests/linkedin-token-fora-do-cliente.test.ts` | quem lê a conexão: a fila (2); a action e a tela de compor, só o resumo (5) | 2, 5 |
| `app/api/queue/tick/route.ts`, `app/api/webhook/route.ts` e `app/api/cron/daily/route.ts` | passam o começo da função ao dreno | 3 |
| `testes-integracao/tique-do-rodape.integracao.ts` | o tique do "agora" (3); o do cron e o do "agora" que lança (6) | 3, 6 |
| `tests/dreno-com-prazo.test.ts` (novo) | as rotas e a action passam o começo da função | 3, 5 |
| `lib/post-da-fila.ts` (novo) | o post de qualquer rede nas telas e nas ações | 4 |
| `app/publicar/page.tsx` | o calendário e "Não saíram" | 4 |
| `app/publicar/post/[id]/page.tsx` | a página do post, com o "Ver no LinkedIn" | 4 |
| `app/publicar/post/actions.ts` | cancelar e remarcar nos dois tipos; o "agora" do remarcar | 4 |
| `app/page.tsx` | as contagens de falha do Início (4); um comentário (5) | 4, 5 |
| `lib/envio-filters.ts` | o que não é entrega do motor | 4 |
| `lib/bonus/publicar-repositorio.ts` | o `caminhosNaFila` nos dois tipos | 4 |
| `lib/engine.ts` | um comentário | 4 |
| `testes-integracao/linkedin-telas.integracao.ts` (novo) | as telas, o cancelar, o remarcar, o Início e o `caminhosNaFila` | 4 |
| `tests/post-da-fila.test.ts` (novo) | as decisões por rede | 4 |
| `tests/envio-filters.test.ts` e `tests/publicar-previas.test.ts` | as guardas antigas, atualizadas | 4 |
| `app/publicar/actions.ts` | a action `publicarNoLinkedin` (5); o tique do "agora" que lança (6) | 5, 6 |
| `app/publicar/enviador.tsx` | a rede, as formas do LinkedIn, o "Texto" e o contador | 5 |
| `app/publicar/novo/page.tsx` | a disponibilidade do LinkedIn e a action nova | 5 |
| `lib/pulso.ts` | um comentário | 5 |
| `testes-integracao/linkedin-compor.integracao.ts` (novo) | a action, as recusas e a regra das contas | 5, 6 |
| `testes-dom/publicar-compositor-linkedin.dom.tsx` (novo) | a tela de compor no LinkedIn | 5 |
| `tests/linkedin-compor.test.ts` (novo) | as recusas, a disponibilidade, o aviso e o id do envio | 5 |
| `tests/publicar-compositor-guarda.test.ts` | a guarda do clique, com a action da rede | 5 |

O que fica de fora, e por quê:
- **as duas redes no mesmo post** (a cópia da imagem no bucket, o desfazer de uma quando a outra falha, os achados 192, 199 e 209): são da parte 2b;
- **o carrossel em PDF, o vídeo em partes e a caixinha do LinkedIn no gerador**: são da parte 3;
- **a escolha da visibilidade**: o post é público, fixo nesta entrega (spec, §6);
- **o README**: a instalação do zero é outro trabalho.

---

### FASE 0 — Começar da branch certa

- [ ] **Passo 1: a branch**

A branch `linkedin-publicacao` já existe, com um commit só de `docs` sobre o `f15c3ad`: este plano. A execução continua nela.

```bash
git fetch origin
git rev-parse --short origin/main                 # tem de dar f15c3ad
git branch --show-current                          # linkedin-publicacao
git log --oneline f15c3ad..HEAD                    # o commit do plano
git diff --name-only f15c3ad HEAD                  # só este plano
git status --porcelain                             # vazio
npm ci
ls node_modules/.bin/vitest node_modules/.bin/eslint node_modules/.bin/tsc node_modules/.bin/next
```

Se `origin/main` não estiver em `f15c3ad`, pare: a base mudou, e o plano precisa ser conferido de novo. Se faltar um dos quatro em `node_modules/.bin`, pare: sem eles, o `npx --no-install` não roda nada.

---

### FASE 1 — As regras do post e as chamadas versionadas

**Arquivos:** `lib/linkedin-publicacao.ts`, `lib/linkedin.ts`, `lib/dedupe.ts`, `tests/linkedin-post.test.ts` (novo), `tests/linkedin-rest.test.ts` (novo).

- [ ] **Passo 1: os testes**

Crie `tests/linkedin-post.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  corpoDoPost,
  desfechoDoErroDoLinkedin,
  formaNoLinkedinDoCampo,
  LIMITE_DO_TEXTO_DO_LINKEDIN,
  lerPayloadDoLinkedin,
  linkParaVerNoLinkedin,
  motivoDaAutorizacaoRecusada,
  payloadDoLinkedin,
  problemaDoTextoDoLinkedin,
  rotuloDaFormaNoLinkedin,
  tamanhoDoTextoNoLinkedin,
  textoParaOLinkedin,
} from "@/lib/linkedin-publicacao";

// AS REGRAS PURAS DO POST NO LINKEDIN (docs/specs/2026-11-06-linkedin-no-perfil.md, §5; a parte 2a: só texto e
// imagem, uma rede por post). A tela de publicar e o servidor leem as mesmas funções.

describe("as formas do LinkedIn na 2a", () => {
  it("são só texto e imagem; o resto, inclusive o que é do Instagram, não vale", () => {
    expect(formaNoLinkedinDoCampo("texto")).toBe("texto");
    expect(formaNoLinkedinDoCampo("imagem")).toBe("imagem");
    for (const outra of ["carrossel", "reels", "story", "", null, undefined, ["texto"]]) {
      expect(formaNoLinkedinDoCampo(outra)).toBeNull();
    }
    expect(rotuloDaFormaNoLinkedin("texto")).toBe("Só texto");
    expect(rotuloDaFormaNoLinkedin("imagem")).toBe("Imagem");
  });
});

describe("o texto que vai ao LinkedIn", () => {
  it("escapa com a barra os 15 caracteres reservados do little text", () => {
    expect(textoParaOLinkedin("a|b{c}d@e[f]g(h)i<j>k\\l*m_n~o")).toBe(
      "a\\|b\\{c\\}d\\@e\\[f\\]g\\(h\\)i\\<j\\>k\\\\l\\*m\\_n\\~o"
    );
  });

  it("transforma o #palavra em hashtag clicável, inteira, com acento", () => {
    expect(textoParaOLinkedin("#educação e #ação")).toBe("{hashtag|\\#|educação} e {hashtag|\\#|ação}");
    expect(textoParaOLinkedin("#marketing_2026")).toBe("{hashtag|\\#|marketing\\_2026}");
  });

  it("o # sem palavra, ou no meio de uma palavra, continua texto", () => {
    expect(textoParaOLinkedin("eu uso C# no trabalho")).toBe("eu uso C\\# no trabalho");
    expect(textoParaOLinkedin("um # sozinho")).toBe("um \\# sozinho");
    expect(textoParaOLinkedin("abc#def")).toBe("abc\\#def");
  });

  it("a pontuação logo depois da hashtag fica de fora dela", () => {
    expect(textoParaOLinkedin("fim com #tag.")).toBe("fim com {hashtag|\\#|tag}.");
    expect(textoParaOLinkedin("#um, #dois!")).toBe("{hashtag|\\#|um}, {hashtag|\\#|dois}!");
  });

  it("o texto comum e as quebras de linha passam como vieram", () => {
    expect(textoParaOLinkedin("Olá, mundo.\nSegunda linha.")).toBe("Olá, mundo.\nSegunda linha.");
  });
});

describe("o tamanho e os problemas do texto", () => {
  it("o limite é 3.000, contado no texto que vai ao LinkedIn (depois das hashtags e dos escapes)", () => {
    expect(LIMITE_DO_TEXTO_DO_LINKEDIN).toBe(3000);
    expect(tamanhoDoTextoNoLinkedin("abc")).toBe(3);
    expect(tamanhoDoTextoNoLinkedin("#tag")).toBe("{hashtag|\\#|tag}".length);
    expect(tamanhoDoTextoNoLinkedin("a_b")).toBe(4);
    // Conta caractere, e não pedaço de UTF-16.
    expect(tamanhoDoTextoNoLinkedin("😀😀")).toBe(2);
  });

  it("recusa o texto vazio, nas duas formas, e o longo demais", () => {
    expect(problemaDoTextoDoLinkedin("", "texto")).toBe("vazio");
    expect(problemaDoTextoDoLinkedin("   \n ", "imagem")).toBe("vazio");
    expect(problemaDoTextoDoLinkedin("a".repeat(3000), "texto")).toBeNull();
    expect(problemaDoTextoDoLinkedin("a".repeat(3001), "texto")).toBe("longo");
    // 2.990 letras, um espaço e um # sozinho fazem 2.993 caracteres no LinkedIn (o # ganha a barra): ainda cabe.
    expect(problemaDoTextoDoLinkedin(`${"a".repeat(2990)} #`, "texto")).toBeNull();
    // 2.951 caracteres na tela, mas 3.071 no LinkedIn: as 10 hashtags viram o modelo clicável, e não cabe.
    expect(problemaDoTextoDoLinkedin(`${"a".repeat(2900)} ${"#tag ".repeat(10)}`, "texto")).toBe("longo");
  });
});

describe("o erro do LinkedIn", () => {
  it("o 401 é a autorização que não vale mais; o 403 e os outros 4xx são permanentes", () => {
    expect(desfechoDoErroDoLinkedin(401)).toBe("autorizacao");
    for (const s of [400, 403, 404, 413, 422]) expect(desfechoDoErroDoLinkedin(s)).toBe("permanente");
  });

  it("o 429, o 409, os 5xx e a rede (0) são passageiros", () => {
    for (const s of [0, 409, 429, 500, 502, 503, 504]) expect(desfechoDoErroDoLinkedin(s)).toBe("passageiro");
  });

  it("a frase da autorização recusada diz as duas causas e o que fazer", () => {
    expect(motivoDaAutorizacaoRecusada("Dra. Ana")).toBe(
      "o LinkedIn de Dra. Ana não aceita mais a autorização (venceu ou foi retirada); mande o convite de novo"
    );
  });
});

describe("o payload da linha do LinkedIn na fila", () => {
  it("grava a forma, os caminhos e o texto, e lê de volta com as marcas dos passos", () => {
    const p = payloadDoLinkedin({ forma: "imagem", caminhos: ["conta/a.jpg"], texto: "  Olá  " });
    expect(p).toEqual({ forma: "imagem", caminhos: ["conta/a.jpg"], texto: "Olá" });
    expect(
      lerPayloadDoLinkedin({ ...p, imagem_urn: "urn:li:image:X", post_tentado_em: "2026-11-09T19:00:00Z", post_urn: "urn:li:share:1" })
    ).toEqual({
      forma: "imagem",
      caminhos: ["conta/a.jpg"],
      texto: "Olá",
      imagemUrn: "urn:li:image:X",
      postTentadoEm: "2026-11-09T19:00:00Z",
      postUrn: "urn:li:share:1",
    });
  });

  it("recusa a forma desconhecida, o texto com arquivo e a imagem sem arquivo, ou com dois", () => {
    expect(lerPayloadDoLinkedin({ forma: "reels", caminhos: ["a/b.mp4"], texto: "x" })).toBeNull();
    expect(lerPayloadDoLinkedin({ forma: "texto", caminhos: ["a/b.jpg"], texto: "x" })).toBeNull();
    expect(lerPayloadDoLinkedin({ forma: "imagem", caminhos: [], texto: "x" })).toBeNull();
    expect(lerPayloadDoLinkedin({ forma: "imagem", caminhos: ["a/b.jpg", "a/c.jpg"], texto: "x" })).toBeNull();
    expect(lerPayloadDoLinkedin({ forma: "texto", caminhos: [], texto: 3 })).toBeNull();
    expect(lerPayloadDoLinkedin(null)).toBeNull();
    expect(lerPayloadDoLinkedin({ forma: "texto", caminhos: [], texto: "x" })).toMatchObject({
      imagemUrn: null,
      postTentadoEm: null,
      postUrn: null,
    });
  });
});

describe("o corpo do POST /rest/posts", () => {
  const BASE = {
    author: "urn:li:person:abc",
    visibility: "PUBLIC",
    distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };

  it("só texto: o autor é a pessoa, o texto já transformado, público, no feed, sem conteúdo", () => {
    expect(corpoDoPost({ pessoaId: "abc", texto: "Olá #mundo" })).toEqual({
      ...BASE,
      commentary: "Olá {hashtag|\\#|mundo}",
    });
  });

  it("com imagem: o conteúdo leva a imagem reservada", () => {
    expect(corpoDoPost({ pessoaId: "abc", texto: "x", imagemUrn: "urn:li:image:Y" })).toEqual({
      ...BASE,
      commentary: "x",
      content: { media: { id: "urn:li:image:Y" } },
    });
  });
});

describe("o link para ver o post no LinkedIn", () => {
  it("só para um URN de post, no endereço do feed", () => {
    expect(linkParaVerNoLinkedin("urn:li:share:6844785523593134080")).toBe(
      "https://www.linkedin.com/feed/update/urn:li:share:6844785523593134080/"
    );
    expect(linkParaVerNoLinkedin("urn:li:ugcPost:68447855235931240")).toBe(
      "https://www.linkedin.com/feed/update/urn:li:ugcPost:68447855235931240/"
    );
    for (const outro of [null, "", "urn:li:image:X", "javascript:alert(1)", "urn:li:share:1/../x"]) {
      expect(linkParaVerNoLinkedin(outro)).toBeNull();
    }
  });
});
```

Crie `tests/linkedin-rest.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { enderecoDeEnvioConfiavel, LINKEDIN_VERSION, nomeLimpo } from "@/lib/linkedin";
import { chaveDaPublicacaoNoLinkedin, publicacaoKey } from "@/lib/dedupe";

// O QUE É PURO NAS CHAMADAS DE PUBLICAR NO LINKEDIN (docs/specs/2026-11-06-linkedin-no-perfil.md, §4 e §6; a
// parte 2a). As chamadas de rede (a reserva, o envio da imagem e o post) são provadas contra um LinkedIn falso no
// loopback, em testes-integracao/linkedin-publicacao.integracao.ts.

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("a versão da API do LinkedIn", () => {
  it("é a 202610", () => {
    expect(LINKEDIN_VERSION).toBe("202610");
  });

  // DE PROPÓSITO, ESTE CASO FICA VERMELHO a partir de 01/09/2027, e com ele todo `npm test`, até a versão ser
  // trocada: a 202610 tem suporte por pelo menos um ano (a página de versões do LinkedIn), e a troca é lembrada
  // seis semanas antes de 15/10/2027, e não por um post que falha em produção (spec, §4).
  it("ainda não chegou a hora de trocar a versão (01/09/2027)", () => {
    expect(Date.now()).toBeLessThan(Date.parse("2027-09-01T00:00:00Z"));
  });
});

describe("o endereço de envio da imagem que o LinkedIn devolve", () => {
  it("só um endereço https do LinkedIn recebe a autorização", () => {
    expect(enderecoDeEnvioConfiavel("https://www.linkedin.com/dms-uploads/C4E10AQ/uploaded-image/0?ca=x")).toBe(true);
    expect(enderecoDeEnvioConfiavel("https://api.linkedin.com/mediaUpload/x")).toBe(true);
    for (const outro of [
      "http://www.linkedin.com/dms-uploads/x",
      "https://linkedin.com.exemplo.com/x",
      "https://www.exemplo.com/x",
      "https://xlinkedin.com/x",
      "nao é endereço",
    ]) {
      expect(enderecoDeEnvioConfiavel(outro)).toBe(false);
    }
  });

  it("o loopback só vale nos testes, sob a trava do vitest", () => {
    expect(enderecoDeEnvioConfiavel("http://127.0.0.1:4567/envio")).toBe(true);
    vi.stubEnv("VITEST", "");
    expect(enderecoDeEnvioConfiavel("http://127.0.0.1:4567/envio")).toBe(false);
  });
});

describe("o nome que o LinkedIn devolve", () => {
  it("tem os espaços juntados e as pontas aparadas (a prova de 09/11 trouxe dois espaços no meio)", () => {
    expect(nomeLimpo("  Thiago  Vannuchi ")).toBe("Thiago Vannuchi");
    expect(nomeLimpo("Ana\tSouza")).toBe("Ana Souza");
  });
});

describe("a chave da linha do LinkedIn na fila", () => {
  it("tem prefixo próprio e nunca é igual à do Instagram", () => {
    const chave = chaveDaPublicacaoNoLinkedin("17800000000000001", "imagem", ["17800000000000001/a.jpg"], "x");
    expect(chave).toBe("pub-linkedin:17800000000000001:imagem:17800000000000001/a.jpg");
    expect(chave).not.toBe(publicacaoKey("17800000000000001", "imagem", ["17800000000000001/a.jpg"]));
  });

  it("na forma só texto, que não tem arquivo, é a do envio da tela: o mesmo envio não entra duas vezes", () => {
    const envio = "9f1c2e3d-0000-4000-8000-000000000001";
    expect(chaveDaPublicacaoNoLinkedin("17800000000000001", "texto", [], envio)).toBe(
      `pub-linkedin:17800000000000001:texto:${envio}`
    );
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
env -u CLAUDECODE -u AI_AGENT npx --no-install vitest run tests/linkedin-post.test.ts tests/linkedin-rest.test.ts
```

Esperado: "Tests 22 failed | 1 passed (23)": as funções novas ainda não existem (`is not a function`). O único que passa é "ainda não chegou a hora de trocar a versão (01/09/2027)", que não depende do código.

- [ ] **Passo 3: o código**

Em `lib/linkedin-publicacao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/linkedin-publicacao.ts b/lib/linkedin-publicacao.ts
index 495de77..fd51a2f 100644
--- a/lib/linkedin-publicacao.ts
+++ b/lib/linkedin-publicacao.ts
@@ -1,6 +1,7 @@
 // AS DECISÕES PURAS DO LINKEDIN (docs/specs/2026-11-06-linkedin-no-perfil.md, §5), SEM IMPORT DE SERVIDOR: a
-// tela de cliente e o servidor leem as mesmas regras. Na parte 1 (a conexão), só o vencimento; as formas, o
-// texto e a classificação dos erros vêm na parte 2, que publica.
+// tela de cliente e o servidor leem as mesmas regras. Na parte 1 (a conexão), o vencimento; na parte 2a (só
+// texto e imagem, uma rede por post), as formas, o texto, o payload da fila, o corpo do post e os erros. O
+// carrossel em PDF e o vídeo vêm na parte 3.
 
 /** O aviso de que a autorização vai vencer começa a 7 dias. */
 export const AVISO_DO_VENCIMENTO_DIAS = 7;
@@ -24,3 +25,166 @@ export function vencimentoDoLinkedin(expiraEm: Date | string, agoraMs: number):
     frase: dias === 1 ? "vence em 1 dia" : `vence em ${dias} dias`,
   };
 }
+
+// ---------------------------------------------------------------------------------------------------------------
+// AS FORMAS DA PARTE 2a
+// ---------------------------------------------------------------------------------------------------------------
+
+export type FormaNoLinkedin = "texto" | "imagem";
+const FORMAS_NO_LINKEDIN: readonly FormaNoLinkedin[] = ["texto", "imagem"];
+
+/** A forma que veio do formulário, de uma lista fechada. */
+export function formaNoLinkedinDoCampo(bruto: unknown): FormaNoLinkedin | null {
+  return (FORMAS_NO_LINKEDIN as readonly unknown[]).includes(bruto) ? (bruto as FormaNoLinkedin) : null;
+}
+
+export function rotuloDaFormaNoLinkedin(forma: FormaNoLinkedin): string {
+  return forma === "texto" ? "Só texto" : "Imagem";
+}
+
+// ---------------------------------------------------------------------------------------------------------------
+// O TEXTO
+// ---------------------------------------------------------------------------------------------------------------
+
+/**
+ * O LIMITE DO TEXTO: "Posts can contain up to 3,000 characters." (Central de Ajuda do LinkedIn, a528176). A API
+ * não diz o número nem como conta, então o limite é contado no texto QUE VAI AO LINKEDIN, depois das hashtags e
+ * dos escapes (achado 212): um texto que cabe aqui cabe lá, e a tela e o servidor contam pela mesma função.
+ */
+export const LIMITE_DO_TEXTO_DO_LINKEDIN = 3000;
+
+// OS 15 CARACTERES RESERVADOS DO "little text" (a página Little Text Format do LinkedIn): "All reserved
+// characters need to be escaped with a backslash, even if those characters are not used in one of the supported
+// elements or templates."
+const RESERVADOS = /[|{}@[\]()<>#\\*_~]/g;
+const escapar = (texto: string) => texto.replace(RESERVADOS, (c) => `\\${c}`);
+
+// A HASHTAG CLICÁVEL (decisão do Eduardo, 09/11: "Virar hashtag clicável"): o # no começo de uma palavra,
+// seguido de letras, números ou "_", vira o modelo `{hashtag|\#|palavra}` (Little Text Format). Letra é \p{L},
+// e não \w, que no JavaScript só pega ASCII ("#educação" viraria "#educa"). O # no meio de uma palavra ("abc#d")
+// ou sem palavra depois ("C#") continua texto, escapado.
+const HASHTAG = /(?<![\p{L}\p{N}_])#([\p{L}\p{N}_]+)/gu;
+
+/** O texto como vai no `commentary` do post: as hashtags no modelo clicável e o resto escapado. */
+export function textoParaOLinkedin(texto: string): string {
+  let saida = "";
+  let desde = 0;
+  for (const achado of texto.matchAll(HASHTAG)) {
+    const onde = achado.index ?? 0;
+    saida += escapar(texto.slice(desde, onde)) + `{hashtag|\\#|${escapar(achado[1])}}`;
+    desde = onde + achado[0].length;
+  }
+  return saida + escapar(texto.slice(desde));
+}
+
+/** O tamanho que conta para o limite: caracteres (e não pedaços de UTF-16) do texto que vai ao LinkedIn. */
+export function tamanhoDoTextoNoLinkedin(texto: string): number {
+  return Array.from(textoParaOLinkedin(texto)).length;
+}
+
+export type ProblemaDoTextoDoLinkedin = "vazio" | "longo";
+
+/** O texto é obrigatório nas duas formas (o `commentary` é "required" no Post Schema), e cabe nos 3.000. */
+export function problemaDoTextoDoLinkedin(texto: string, _forma: FormaNoLinkedin): ProblemaDoTextoDoLinkedin | null {
+  if (!texto.trim()) return "vazio";
+  if (tamanhoDoTextoNoLinkedin(texto.trim()) > LIMITE_DO_TEXTO_DO_LINKEDIN) return "longo";
+  return null;
+}
+
+// ---------------------------------------------------------------------------------------------------------------
+// O PAYLOAD DA LINHA `publicacao_linkedin` NA FILA
+// ---------------------------------------------------------------------------------------------------------------
+
+/**
+ * As chaves do `jsonb`. Os passos são marcados ANTES do seguinte, para a passada repetida não refazer o que já
+ * foi feito (spec, §6): `imagem_urn` depois do envio da imagem; `post_tentado_em` ANTES do POST do post (achado
+ * 210: o POST não tem chave contra repetição, e uma resposta perdida não pode virar um segundo post); e
+ * `post_urn` com o id que o LinkedIn devolveu.
+ */
+export type PayloadDoLinkedin = {
+  forma: FormaNoLinkedin;
+  caminhos: string[];
+  texto: string;
+  imagem_urn?: string;
+  post_tentado_em?: string;
+  post_urn?: string;
+};
+
+export function payloadDoLinkedin(pedido: { forma: FormaNoLinkedin; caminhos: string[]; texto: string }): PayloadDoLinkedin {
+  return { forma: pedido.forma, caminhos: [...pedido.caminhos], texto: pedido.texto.trim() };
+}
+
+export type LeituraDoPayloadDoLinkedin = {
+  forma: FormaNoLinkedin;
+  caminhos: string[];
+  texto: string;
+  imagemUrn: string | null;
+  postTentadoEm: string | null;
+  postUrn: string | null;
+};
+
+/** Lê o payload, ou null: a forma tem de ser da lista, o texto tem de ser texto, e a quantidade de arquivos a da forma. */
+export function lerPayloadDoLinkedin(bruto: unknown): LeituraDoPayloadDoLinkedin | null {
+  if (!bruto || typeof bruto !== "object") return null;
+  const p = bruto as Record<string, unknown>;
+  const forma = formaNoLinkedinDoCampo(p.forma);
+  if (!forma || typeof p.texto !== "string") return null;
+  const caminhos = Array.isArray(p.caminhos) && p.caminhos.every((c) => typeof c === "string") ? (p.caminhos as string[]) : null;
+  if (!caminhos || caminhos.length !== (forma === "imagem" ? 1 : 0)) return null;
+  const texto = (v: unknown) => (typeof v === "string" && v ? v : null);
+  return {
+    forma,
+    caminhos,
+    texto: p.texto,
+    imagemUrn: texto(p.imagem_urn),
+    postTentadoEm: texto(p.post_tentado_em),
+    postUrn: texto(p.post_urn),
+  };
+}
+
+// ---------------------------------------------------------------------------------------------------------------
+// O CORPO DO POST E O LINK PARA VER
+// ---------------------------------------------------------------------------------------------------------------
+
+/**
+ * O corpo do `POST /rest/posts` (Posts API): o autor é a pessoa, o texto já transformado, PÚBLICO (fixo nesta
+ * entrega; não há escolha de visibilidade na tela), no feed, publicado, e a imagem quando há.
+ */
+export function corpoDoPost(p: { pessoaId: string; texto: string; imagemUrn?: string }): Record<string, unknown> {
+  return {
+    author: `urn:li:person:${p.pessoaId}`,
+    commentary: textoParaOLinkedin(p.texto),
+    visibility: "PUBLIC",
+    distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
+    lifecycleState: "PUBLISHED",
+    isReshareDisabledByAuthor: false,
+    ...(p.imagemUrn ? { content: { media: { id: p.imagemUrn } } } : {}),
+  };
+}
+
+const URN_DE_POST = /^urn:li:(?:share|ugcPost):\d+$/;
+
+/** "Ver no LinkedIn": o endereço do feed, só para um URN de post (Posts API: `/feed/update/<urn>/`). */
+export function linkParaVerNoLinkedin(postUrn: string | null | undefined): string | null {
+  return postUrn && URN_DE_POST.test(postUrn) ? `https://www.linkedin.com/feed/update/${postUrn}/` : null;
+}
+
+// ---------------------------------------------------------------------------------------------------------------
+// OS ERROS
+// ---------------------------------------------------------------------------------------------------------------
+
+export type DesfechoDoErroDoLinkedin = "autorizacao" | "permanente" | "passageiro";
+
+/**
+ * O 401 é a autorização que não vale mais (venceu ou foi retirada); o 429, o 409 ("Retry the request"), os 5xx
+ * e a rede (status 0) passam; o 403 e os outros 4xx não passam sozinhos (Posts API, "API Error Details").
+ */
+export function desfechoDoErroDoLinkedin(status: number): DesfechoDoErroDoLinkedin {
+  if (status === 401) return "autorizacao";
+  if (status === 0 || status === 409 || status === 429 || status >= 500) return "passageiro";
+  return "permanente";
+}
+
+export function motivoDaAutorizacaoRecusada(nome: string): string {
+  return `o LinkedIn de ${nome} não aceita mais a autorização (venceu ou foi retirada); mande o convite de novo`;
+}
```

Em `lib/linkedin.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/linkedin.ts b/lib/linkedin.ts
index 8b0c02f..862e736 100644
--- a/lib/linkedin.ts
+++ b/lib/linkedin.ts
@@ -1,8 +1,8 @@
 import "server-only";
 
-// O CLIENTE DO LINKEDIN (docs/specs/2026-11-06-linkedin-no-perfil.md, §3 e §4). NA PARTE 1 (a conexão), só o
-// que o convite usa: a autorização, a troca do código pela autorização e o `userinfo`. A versão
-// (`Linkedin-Version`) e as chamadas de `/rest` (a reserva, o envio e o post) vêm na parte 2, que publica.
+// O CLIENTE DO LINKEDIN (docs/specs/2026-11-06-linkedin-no-perfil.md, §3 e §4). NA PARTE 1 (a conexão), o que o
+// convite usa: a autorização, a troca do código pela autorização e o `userinfo`. NA PARTE 2a (só texto e imagem),
+// as chamadas versionadas de `/rest`: a reserva da imagem, o envio dela e o post.
 //
 // AS CHAVES DO APP (`LINKEDIN_CLIENT_ID` e `LINKEDIN_CLIENT_SECRET`) FICAM SÓ NAS VARIÁVEIS DA VERCEL, nunca no
 // código nem no banco, porque o repositório é público (§8). Sem as duas, o LinkedIn fica desligado no painel.
@@ -89,10 +89,13 @@ export class LinkedinError extends Error {
   }
 }
 
-async function chamar(url: string, init: RequestInit): Promise<{ status: number; texto: string }> {
+async function chamar(
+  url: string,
+  init: RequestInit
+): Promise<{ status: number; texto: string; restliId: string | null }> {
   try {
     const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TETO_DO_LINKEDIN_MS) });
-    return { status: res.status, texto: await res.text() };
+    return { status: res.status, texto: await res.text(), restliId: res.headers.get("x-restli-id") };
   } catch (err) {
     // O endereço vai sem a query: nenhuma destas chamadas leva segredo nela, e assim continua.
     const onde = url.split("?")[0];
@@ -154,7 +157,97 @@ export async function pessoaDoLinkedin(accessToken: string): Promise<{ sub: stri
   const corpo = json(r.texto);
   const sub = corpo?.sub;
   if (typeof sub !== "string" || !sub) throw new LinkedinError(r.status, "o userinfo veio sem o sub");
-  const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");
+  const texto = (v: unknown) => (typeof v === "string" ? nomeLimpo(v) : "");
   const nome = texto(corpo?.name) || [texto(corpo?.given_name), texto(corpo?.family_name)].filter(Boolean).join(" ");
   return { sub, nome: nome || "sem nome no LinkedIn" };
 }
+
+/** O nome com os espaços juntados e as pontas aparadas: a prova de 09/11 trouxe dois espaços no meio. */
+export function nomeLimpo(nome: string): string {
+  return nome.replace(/\s+/g, " ").trim();
+}
+
+// ---------------------------------------------------------------------------------------------------------------
+// A PARTE 2a: AS CHAMADAS VERSIONADAS DE PUBLICAR
+// ---------------------------------------------------------------------------------------------------------------
+
+/**
+ * A VERSÃO DA API (`Linkedin-Version`, formato AAAAMM). A 202610 é a mais nova na página de versões, e toda
+ * versão tem suporte por pelo menos um ano ("supported and stable for a minimum of one year before sunset"); a
+ * spec registrou o fim em 15/10/2027. tests/linkedin-rest.test.ts fica vermelho a partir de 01/09/2027, de
+ * propósito, para a troca ser lembrada antes.
+ */
+export const LINKEDIN_VERSION = "202610";
+
+function cabecalhosDoRest(token: string): Record<string, string> {
+  return {
+    authorization: `Bearer ${token}`,
+    "linkedin-version": LINKEDIN_VERSION,
+    "x-restli-protocol-version": "2.0.0",
+    "content-type": "application/json",
+  };
+}
+
+/**
+ * A RESERVA DA IMAGEM (`POST /rest/images?action=initializeUpload`, Images API), com a pessoa como dona.
+ * Devolve o endereço de envio e o URN da imagem.
+ */
+export async function reservarImagem(token: string, pessoaId: string): Promise<{ uploadUrl: string; imagemUrn: string }> {
+  const r = await chamar(`${basesDoLinkedin().api}/rest/images?action=initializeUpload`, {
+    method: "POST",
+    headers: cabecalhosDoRest(token),
+    body: JSON.stringify({ initializeUploadRequest: { owner: `urn:li:person:${pessoaId}` } }),
+  });
+  if (r.status !== 200) throw new LinkedinError(r.status, r.texto.slice(0, 300));
+  const valor = json(r.texto)?.value as Record<string, unknown> | undefined;
+  const uploadUrl = valor?.uploadUrl;
+  const imagemUrn = valor?.image;
+  if (typeof uploadUrl !== "string" || typeof imagemUrn !== "string" || !imagemUrn.startsWith("urn:li:image:")) {
+    throw new LinkedinError(r.status, "a reserva da imagem não devolveu o endereço e o URN");
+  }
+  return { uploadUrl, imagemUrn };
+}
+
+/**
+ * O ENDEREÇO DE ENVIO RECEBE A AUTORIZAÇÃO (o upload da imagem "requires a valid OAuth token in the
+ * 'Authorization' header", na página da Assets API), então ele só é usado se for https de um domínio do
+ * LinkedIn. Nos testes, o loopback, sob a trava do vitest.
+ */
+export function enderecoDeEnvioConfiavel(url: string): boolean {
+  let u: URL;
+  try {
+    u = new URL(url);
+  } catch {
+    return false;
+  }
+  if (process.env.VITEST === "true" && BASE_DE_TESTE.test(u.origin)) return true;
+  return u.protocol === "https:" && (u.hostname === "linkedin.com" || u.hostname.endsWith(".linkedin.com"));
+}
+
+/** O ENVIO DA IMAGEM: `PUT` dos bytes no endereço da reserva, com a autorização (a página da Assets API). */
+export async function enviarImagem(uploadUrl: string, token: string, bytes: ArrayBuffer, mime: string): Promise<void> {
+  if (!enderecoDeEnvioConfiavel(uploadUrl)) {
+    throw new LinkedinError(0, "o endereço de envio da imagem não é do LinkedIn");
+  }
+  const r = await chamar(uploadUrl, {
+    method: "PUT",
+    headers: { authorization: `Bearer ${token}`, "content-type": mime },
+    body: bytes,
+  });
+  if (r.status !== 200 && r.status !== 201) throw new LinkedinError(r.status, r.texto.slice(0, 300));
+}
+
+/**
+ * O POST (`POST /rest/posts`, Posts API): "You should get a 201 response and the response header x-restli-id
+ * contains the Post ID". Devolve o URN do post.
+ */
+export async function criarPost(token: string, corpo: Record<string, unknown>): Promise<string> {
+  const r = await chamar(`${basesDoLinkedin().api}/rest/posts`, {
+    method: "POST",
+    headers: cabecalhosDoRest(token),
+    body: JSON.stringify(corpo),
+  });
+  if (r.status !== 201) throw new LinkedinError(r.status, r.texto.slice(0, 300));
+  if (!r.restliId) throw new LinkedinError(r.status, "o post saiu sem o x-restli-id");
+  return r.restliId;
+}
```

Em `lib/dedupe.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/dedupe.ts b/lib/dedupe.ts
index 0c33fc6..7f90205 100644
--- a/lib/dedupe.ts
+++ b/lib/dedupe.ts
@@ -224,3 +224,13 @@ export const loteKey = (accountId: string, loteId: string, contactIgId: string)
 // código.
 export const publicacaoKey = (accountId: string, forma: string, caminhos: string[]) =>
   `pub:${accountId}:${forma}:${caminhos.join(",")}`;
+
+// A CHAVE DA LINHA `publicacao_linkedin` (docs/specs/2026-11-06-linkedin-no-perfil.md, §6; a parte 2a). O
+// PREFIXO É PRÓPRIO (`pub-linkedin:`), para nunca colidir com a do Instagram. Na imagem, é a lista de caminhos,
+// como a do Instagram (cada caminho é único por upload). No SÓ TEXTO, que não tem arquivo, é o identificador do
+// envio que a tela sorteia ao abrir: o mesmo clique repetido não entra duas vezes, e o mesmo texto pode ser
+// publicado de novo noutro envio.
+export const chaveDaPublicacaoNoLinkedin = (accountId: string, forma: string, caminhos: string[], idDoEnvio: string) =>
+  forma === "texto"
+    ? `pub-linkedin:${accountId}:texto:${idDoEnvio}`
+    : `pub-linkedin:${accountId}:${forma}:${caminhos.join(",")}`;
```

A hashtag usa `\p{L}` e `\p{N}`, e não `\w`, que no JavaScript só pega ASCII ("#educação" viraria "#educa"). O `_` dentro do nome da hashtag é escapado, como a gramática do "little text" pede ("All reserved characters need to be escaped with a backslash, even if those characters are not used in one of the supported elements or templates"); a prova mede como ele aparece (FASE 8).

- [ ] **Passo 4: rodar e ver passar**

```bash
env -u CLAUDECODE -u AI_AGENT npx --no-install vitest run tests/linkedin-post.test.ts tests/linkedin-rest.test.ts \
  tests/linkedin-publicacao.test.ts tests/linkedin.test.ts
npx --no-install tsc --noEmit
npx --no-install eslint lib/linkedin-publicacao.ts lib/linkedin.ts lib/dedupe.ts tests/linkedin-post.test.ts \
  tests/linkedin-rest.test.ts
```

Esperado: "Test Files 4 passed (4)" e "Tests 40 passed (40)", e o `tsc` e o lint sem saída.

- [ ] **Passo 5: o commit**

A mensagem do commit, gravada em `$SCRATCH/msg-li2-f1.txt`:

```text
As regras do post no LinkedIn ficam num lugar só: o texto com a hashtag clicável, o payload da fila, o corpo do post e os erros
```

```bash
git add -- lib/linkedin-publicacao.ts lib/linkedin.ts lib/dedupe.ts tests/linkedin-post.test.ts tests/linkedin-rest.test.ts
git commit -F "$SCRATCH/msg-li2-f1.txt"
```

---

### FASE 2 — A 025, a fila e o dreno

**Arquivos:** `migrations/025-fila-linkedin.sql` (novo), `lib/fila-tipos.ts`, `lib/linkedin-fila.ts` (novo), `lib/queue-drain.ts`, `lib/linkedin-publicacao.ts`, `scripts/migrar.mjs`, `lib/esquema.ts`, `app/labels.ts`, `testes-integracao/linkedin-publicacao.integracao.ts` (novo), `testes-integracao/conferencia-do-kind.integracao.ts`, `tests/fila-tipos.test.ts`, `tests/linkedin-post.test.ts`, `tests/linkedin-token-fora-do-cliente.test.ts`.

- [ ] **Passo 1: os testes**

Crie `testes-integracao/linkedin-publicacao.integracao.ts`:

```ts
// O POST DO LINKEDIN PELA FILA (docs/specs/2026-11-06-linkedin-no-perfil.md, §6; a parte 2a: só texto e imagem,
// uma rede por post), contra o banco descartável: o enfileirar, o ramo novo do dreno, o "agora" que drena só a
// própria linha (achado 211) e a regra de nunca publicar duas vezes (achado 210).
//
// O LINKEDIN FALSO E O BUCKET FALSO: dois servidores HTTP na própria máquina. As bases do LinkedIn
// (lib/linkedin.ts) e a SUPABASE_URL vão para eles, e as guardas conferem isso ANTES de qualquer requisição. O
// `fetch` é interceptado só neste arquivo e RECUSA qualquer endereço que não seja o loopback. **NADA AQUI CHAMA
// O LINKEDIN NEM O BUCKET DE VERDADE.** Valores inventados: nenhuma credencial de verdade entra em teste.
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { bancoDescartavel } from "./harness";

type ModuloDreno = typeof import("@/lib/queue-drain");
type ModuloFila = typeof import("@/lib/linkedin-fila");
type ModuloLinkedin = typeof import("@/lib/linkedin");

const banco = bancoDescartavel();
const q = (texto: string, params: unknown[] = []) =>
  banco.db().sql().query(texto, params) as Promise<Record<string, unknown>[]>;

const CONTA = "17800000000025001";
const PESSOA = "pessoaDoLinkedinA1";
const TOKEN_DO_LINKEDIN = "AQVautorizacaoDoLinkedinDaFilaQueNaoValeNada";
const BUCKET = "midia-de-teste";
const CHAVE_DO_BUCKET = "chave-do-bucket-falso-que-nao-vale-nada";
const BYTES_DA_IMAGEM = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8, 0xff, 0xd9]);

type Pedido = { metodo: string; caminho: string; cabecalhos: IncomingMessage["headers"]; corpo: string };

const linkedin = {
  pedidos: [] as Pedido[],
  posts: [] as Record<string, unknown>[],
  envios: [] as Buffer[],
  /** O status do próximo POST /rest/posts; 201 é o sucesso. */
  statusDoPost: 201,
  /** Cria o post e derruba a conexão antes de responder (achado 210). */
  derrubarDepoisDoPost: false,
  /** Segura o POST até liberar: é como dois drenos ao mesmo tempo entram. */
  segurarOPost: null as null | Promise<void>,
  statusDaReserva: 200,
  desconhecidos: [] as string[],
};
const bucket = { apagados: [] as string[] };

let servidorLinkedin: Server;
let servidorBucket: Server;
let dreno: ModuloDreno;
let fila: ModuloFila;
let li: ModuloLinkedin;

function responder(res: ServerResponse, status: number, corpo: unknown, cabecalhos: Record<string, string> = {}) {
  res.writeHead(status, { "content-type": "application/json", ...cabecalhos });
  res.end(typeof corpo === "string" ? corpo : JSON.stringify(corpo));
}

function lerCorpo(req: IncomingMessage): Promise<Buffer> {
  return new Promise((pronto) => {
    const partes: Buffer[] = [];
    req.on("data", (p) => partes.push(p));
    req.on("end", () => pronto(Buffer.concat(partes)));
  });
}

beforeAll(async () => {
  servidorLinkedin = createServer(async (req, res) => {
    const u = new URL(req.url ?? "/", "http://127.0.0.1");
    const corpo = await lerCorpo(req);
    linkedin.pedidos.push({ metodo: req.method ?? "", caminho: u.pathname + u.search, cabecalhos: req.headers, corpo: corpo.toString() });
    const porta = (servidorLinkedin.address() as AddressInfo).port;
    if (req.method === "POST" && u.pathname === "/rest/images" && u.searchParams.get("action") === "initializeUpload") {
      if (linkedin.statusDaReserva !== 200) return responder(res, linkedin.statusDaReserva, { message: "a reserva falhou de propósito" });
      return responder(res, 200, {
        value: {
          uploadUrl: `http://127.0.0.1:${porta}/envio/C4E10AQ`,
          uploadUrlExpiresAt: 1999999999999,
          image: "urn:li:image:C4E10AQFalsa",
        },
      });
    }
    if (req.method === "PUT" && u.pathname === "/envio/C4E10AQ") {
      linkedin.envios.push(corpo);
      return responder(res, 201, "");
    }
    if (req.method === "POST" && u.pathname === "/rest/posts") {
      if (linkedin.segurarOPost) await linkedin.segurarOPost;
      if (linkedin.statusDoPost !== 201) return responder(res, linkedin.statusDoPost, { message: "o post falhou de propósito" });
      linkedin.posts.push(JSON.parse(corpo.toString()) as Record<string, unknown>);
      if (linkedin.derrubarDepoisDoPost) return void req.socket.destroy();
      // O id em texto: 7000000000000000000 + n passa do inteiro exato do JavaScript, e daria sempre o mesmo número.
      const id = `70000000000000000${String(linkedin.posts.length).padStart(2, "0")}`;
      return responder(res, 201, "", { "x-restli-id": `urn:li:share:${id}` });
    }
    linkedin.desconhecidos.push(`${req.method} ${u.pathname}`);
    responder(res, 404, { message: "o LinkedIn falso não conhece esse caminho" });
  });

  servidorBucket = createServer((req, res) => {
    const u = new URL(req.url ?? "/", "http://127.0.0.1");
    const publico = `/storage/v1/object/public/${BUCKET}/`;
    const privado = `/storage/v1/object/${BUCKET}/`;
    if (req.method === "GET" && u.pathname.startsWith(publico)) {
      res.writeHead(200, { "content-type": "image/jpeg" });
      return res.end(BYTES_DA_IMAGEM);
    }
    if (req.method === "DELETE" && u.pathname.startsWith(privado)) {
      if (req.headers["apikey"] !== CHAVE_DO_BUCKET) return responder(res, 401, { message: "sem apikey" });
      bucket.apagados.push(decodeURIComponent(u.pathname.slice(privado.length)));
      return responder(res, 200, { message: "ok" });
    }
    responder(res, 404, { message: "o bucket falso não conhece esse caminho" });
  });

  await new Promise<void>((pronto) => servidorLinkedin.listen(0, "127.0.0.1", pronto));
  await new Promise<void>((pronto) => servidorBucket.listen(0, "127.0.0.1", pronto));
  process.env.LINKEDIN_API_BASE = `http://127.0.0.1:${(servidorLinkedin.address() as AddressInfo).port}`;
  process.env.SUPABASE_URL = `http://127.0.0.1:${(servidorBucket.address() as AddressInfo).port}`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = CHAVE_DO_BUCKET;
  process.env.SUPABASE_BUCKET = BUCKET;
  delete process.env.QSTASH_TOKEN;

  // O INTERCEPTADOR: só o loopback passa.
  const fetchDeVerdade = globalThis.fetch;
  vi.stubGlobal("fetch", async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof entrada === "string" ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
    if (url.hostname === "127.0.0.1") return fetchDeVerdade(entrada, init);
    throw new Error(`RECUSADO: este teste não chama ${url.origin}`);
  });

  li = await import("@/lib/linkedin");
  dreno = await import("@/lib/queue-drain");
  fila = await import("@/lib/linkedin-fila");

  // AS GUARDAS, ANTES DE QUALQUER REQUISIÇÃO.
  if (li.basesDoLinkedin().api !== process.env.LINKEDIN_API_BASE) {
    throw new Error("RECUSADO: a base do LinkedIn não é a desta rodada. Sem o desvio, este teste publicaria de verdade.");
  }
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(process.env.SUPABASE_URL ?? "")) {
    throw new Error("RECUSADO: a SUPABASE_URL desta rodada não é loopback.");
  }
  await banco.db().upsertAccount({
    ig_user_id: CONTA,
    username: "conta_da_ana",
    name: "Ana",
    profile_picture_url: null,
    access_token: "ig-token-de-teste",
    token_expires_at: null,
  });
});

afterAll(async () => {
  vi.unstubAllGlobals();
  for (const v of ["LINKEDIN_API_BASE", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_BUCKET"]) delete process.env[v];
  await new Promise<void>((pronto) => servidorLinkedin.close(() => pronto()));
  await new Promise<void>((pronto) => servidorBucket.close(() => pronto()));
});

beforeEach(async () => {
  Object.assign(linkedin, {
    pedidos: [],
    posts: [],
    envios: [],
    statusDoPost: 201,
    derrubarDepoisDoPost: false,
    segurarOPost: null,
    statusDaReserva: 200,
    desconhecidos: [],
  });
  bucket.apagados = [];
  await q(`delete from queue`);
  await q(`delete from linkedin_conexoes`);
  await conectar();
});

async function conectar(expiraEm = "now() + interval '60 days'") {
  await q(
    `insert into linkedin_conexoes (account_id, pessoa_id, nome, access_token, expira_em)
     values ($1, $2, 'Dra. Ana Souza', $3, ${expiraEm})
     on conflict (account_id) do update set expira_em = excluded.expira_em`,
    [CONTA, PESSOA, TOKEN_DO_LINKEDIN]
  );
}

const ENVIO = "9f1c2e3d-0000-4000-8000-000000000001";
const enfileirarTexto = (texto = "Olá #mundo", quando: Date | null = null, idDoEnvio = ENVIO) =>
  fila.enqueuePublicacaoNoLinkedin(CONTA, { forma: "texto", caminhos: [], texto, idDoEnvio }, quando);
const enfileirarImagem = (caminho = `${CONTA}/foto.jpg`) =>
  fila.enqueuePublicacaoNoLinkedin(CONTA, { forma: "imagem", caminhos: [caminho], texto: "Com foto", idDoEnvio: ENVIO }, null);

const linhaDoLinkedin = async () =>
  (await q(`select * from queue where kind = 'publicacao_linkedin' order by created_at desc, id desc limit 1`))[0];

// ---------------------------------------------------------------------------------------------------------------

describe("enfileirar um post do LinkedIn", () => {
  it("grava a linha publicacao_linkedin com o payload, a chave própria e a hora", async () => {
    const r = await enfileirarTexto();
    expect(r).toEqual({ entrou: true, jaVale: true, falta: 0 });
    const linha = await linhaDoLinkedin();
    expect(linha).toMatchObject({
      account_id: CONTA,
      status: "pending",
      dedupe_key: `pub-linkedin:${CONTA}:texto:${ENVIO}`,
      payload: { forma: "texto", caminhos: [], texto: "Olá #mundo" },
    });
  });

  it("o mesmo envio não entra duas vezes; outro envio do mesmo texto entra", async () => {
    await enfileirarTexto();
    expect(await enfileirarTexto()).toEqual({ entrou: false });
    expect((await enfileirarTexto("Olá #mundo", null, "9f1c2e3d-0000-4000-8000-000000000002")).entrou).toBe(true);
  });

  it("o agendado nasce no futuro, e não vale ainda", async () => {
    const r = await enfileirarTexto("depois", new Date(Date.now() + 2 * 3_600_000));
    expect(r.entrou && r.jaVale).toBe(false);
  });

  it("não entra o texto vazio, o longo demais, a imagem sem arquivo nem o envio sem id", async () => {
    expect(await enfileirarTexto("   ")).toEqual({ entrou: false });
    expect(await enfileirarTexto("a".repeat(3001))).toEqual({ entrou: false });
    expect(
      await fila.enqueuePublicacaoNoLinkedin(CONTA, { forma: "imagem", caminhos: [], texto: "sem foto", idDoEnvio: ENVIO }, null)
    ).toEqual({ entrou: false });
    expect(await enfileirarTexto("Olá", null, "não-é-um-id")).toEqual({ entrou: false });
    expect(await q(`select id from queue`)).toEqual([]);
  });
});

describe("o dreno publica no LinkedIn", () => {
  it("só texto: o post sai com o autor pessoa e o texto já transformado, e a linha fica sent com o URN", async () => {
    await enfileirarTexto();
    const resumo = await dreno.drainQueue();
    expect(resumo.sent).toBe(1);
    expect(linkedin.posts).toEqual([
      {
        author: `urn:li:person:${PESSOA}`,
        commentary: "Olá {hashtag|\\#|mundo}",
        visibility: "PUBLIC",
        distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false,
      },
    ]);
    const post = linkedin.pedidos.find((p) => p.caminho === "/rest/posts");
    expect(post?.cabecalhos["authorization"]).toBe(`Bearer ${TOKEN_DO_LINKEDIN}`);
    expect(post?.cabecalhos["linkedin-version"]).toBe("202610");
    expect(post?.cabecalhos["x-restli-protocol-version"]).toBe("2.0.0");
    const linha = await linhaDoLinkedin();
    expect(linha.status).toBe("sent");
    expect(linha.sent_at).toBeInstanceOf(Date);
    expect(linha.error).toBeNull();
    expect((linha.payload as Record<string, unknown>).post_urn).toBe("urn:li:share:7000000000000000001");
    expect(typeof (linha.payload as Record<string, unknown>).post_tentado_em).toBe("string");
  });

  it("imagem: reserva com a pessoa dona, envia os bytes do bucket, publica com a imagem e só então apaga o arquivo", async () => {
    await enfileirarImagem();
    await dreno.drainQueue();
    const reserva = linkedin.pedidos.find((p) => p.caminho.startsWith("/rest/images"));
    expect(JSON.parse(reserva?.corpo ?? "{}")).toEqual({ initializeUploadRequest: { owner: `urn:li:person:${PESSOA}` } });
    expect(linkedin.envios).toEqual([BYTES_DA_IMAGEM]);
    const envio = linkedin.pedidos.find((p) => p.metodo === "PUT");
    expect(envio?.cabecalhos["authorization"]).toBe(`Bearer ${TOKEN_DO_LINKEDIN}`);
    expect(linkedin.posts[0]).toMatchObject({ commentary: "Com foto", content: { media: { id: "urn:li:image:C4E10AQFalsa" } } });
    expect(bucket.apagados).toEqual([`${CONTA}/foto.jpg`]);
    const linha = await linhaDoLinkedin();
    expect(linha.status).toBe("sent");
    expect((linha.payload as Record<string, unknown>).imagem_urn).toBe("urn:li:image:C4E10AQFalsa");
  });

  it("o post sai mesmo com a conta no teto horário de DM", async () => {
    await q(
      `insert into queue (account_id, kind, payload, dedupe_key, status, sent_at, not_before)
       select $1, 'dm_lote', '{}'::jsonb, 'teto-' || g, 'sent', now() - interval '10 minutes', now() - interval '10 minutes'
         from generate_series(1, 190) g`,
      [CONTA]
    );
    await enfileirarTexto();
    await dreno.drainQueue();
    expect((await linhaDoLinkedin()).status).toBe("sent");
    expect(linkedin.posts).toHaveLength(1);
  });
});

describe("o post do LinkedIn nunca sai duas vezes (achado 210)", () => {
  it("com o post_urn marcado, a passada seguinte fecha a linha sem publicar de novo", async () => {
    await enfileirarTexto();
    await q(`update queue set payload = payload || '{"post_urn":"urn:li:share:1"}'::jsonb where kind = 'publicacao_linkedin'`);
    await dreno.drainQueue();
    expect(linkedin.posts).toHaveLength(0);
    expect((await linhaDoLinkedin()).status).toBe("sent");
  });

  it("com o post tentado e sem o URN, a linha vai a failed dizendo para conferir, e não publica", async () => {
    await enfileirarTexto();
    await q(
      `update queue set payload = payload || '{"post_tentado_em":"2026-11-09T19:00:00Z"}'::jsonb where kind = 'publicacao_linkedin'`
    );
    await dreno.drainQueue();
    expect(linkedin.pedidos.filter((p) => p.caminho === "/rest/posts")).toHaveLength(0);
    const linha = await linhaDoLinkedin();
    expect(linha.status).toBe("failed");
    expect(String(linha.error)).toContain("pode ter saído");
  });

  it("o LinkedIn cria o post e a conexão cai antes da resposta: failed, e um post só", async () => {
    linkedin.derrubarDepoisDoPost = true;
    await enfileirarTexto();
    await dreno.drainQueue();
    expect(linkedin.posts).toHaveLength(1);
    const linha = await linhaDoLinkedin();
    expect(linha.status).toBe("failed");
    expect(String(linha.error)).toContain("pode ter saído");
    // A passada seguinte não pega a linha de novo.
    await q(`update queue set not_before = now() - interval '1 minute'`);
    await dreno.drainQueue();
    expect(linkedin.posts).toHaveLength(1);
  });

  it("o 429 no post não criou nada: a marca sai, e a linha volta à fila para tentar de novo", async () => {
    linkedin.statusDoPost = 429;
    await enfileirarTexto();
    await dreno.drainQueue();
    const linha = await linhaDoLinkedin();
    expect(linha.status).toBe("pending");
    expect((linha.payload as Record<string, unknown>).post_tentado_em ?? null).toBeNull();
    linkedin.statusDoPost = 201;
    await q(`update queue set not_before = now() - interval '1 minute'`);
    await dreno.drainQueue();
    expect((await linhaDoLinkedin()).status).toBe("sent");
    expect(linkedin.posts).toHaveLength(1);
  });
});

describe("os erros do LinkedIn no dreno", () => {
  it("o 401 vai a failed dizendo que a autorização não vale mais", async () => {
    linkedin.statusDoPost = 401;
    await enfileirarTexto();
    await dreno.drainQueue();
    const linha = await linhaDoLinkedin();
    expect(linha.status).toBe("failed");
    expect(linha.error).toBe(
      "o LinkedIn de Dra. Ana Souza não aceita mais a autorização (venceu ou foi retirada); mande o convite de novo"
    );
  });

  it("o 403 no post é permanente, com o texto do LinkedIn e sem o token", async () => {
    linkedin.statusDoPost = 403;
    await enfileirarTexto();
    await dreno.drainQueue();
    const linha = await linhaDoLinkedin();
    expect(linha.status).toBe("failed");
    expect(String(linha.error)).toContain("403");
    expect(String(linha.error)).not.toContain(TOKEN_DO_LINKEDIN);
  });

  it("o 5xx na reserva da imagem volta à fila, e a passada seguinte publica", async () => {
    linkedin.statusDaReserva = 503;
    await enfileirarImagem();
    await dreno.drainQueue();
    expect((await linhaDoLinkedin()).status).toBe("pending");
    expect(linkedin.posts).toHaveLength(0);
    linkedin.statusDaReserva = 200;
    await q(`update queue set not_before = now() - interval '1 minute'`);
    await dreno.drainQueue();
    expect((await linhaDoLinkedin()).status).toBe("sent");
  });

  it("sem LinkedIn conectado, ou com ele vencido, vai a failed com o motivo, sem chamar o LinkedIn", async () => {
    await q(`delete from linkedin_conexoes`);
    await enfileirarTexto();
    await dreno.drainQueue();
    expect((await linhaDoLinkedin()).error).toBe("esta conta não tem LinkedIn conectado");

    await q(`delete from queue`);
    await conectar("now() - interval '1 minute'");
    await enfileirarTexto();
    await dreno.drainQueue();
    expect((await linhaDoLinkedin()).error).toBe(
      "o LinkedIn de Dra. Ana Souza não aceita mais a autorização (venceu ou foi retirada); mande o convite de novo"
    );
    expect(linkedin.pedidos).toHaveLength(0);
  });

  it("o payload que não é do LinkedIn vai a failed com o motivo escrito", async () => {
    await q(
      `insert into queue (account_id, kind, payload, dedupe_key) values ($1, 'publicacao_linkedin', '{"forma":"reels"}'::jsonb, 'pub-linkedin:torta')`,
      [CONTA]
    );
    await dreno.drainQueue();
    expect((await linhaDoLinkedin()).error).toBe("o payload deste item não é de um post do LinkedIn");
  });
});

describe("o \"agora\" drena só a própria linha (achado 211)", () => {
  it("publica a linha pedida e não toca nas outras vencidas, de mensagem e de post do Instagram", async () => {
    await q(
      `insert into queue (account_id, kind, payload, dedupe_key) values
         ($1, 'dm_lote', '{"lote_id":"L","text":"oi"}'::jsonb, 'outra-dm'),
         ($1, 'publicacao', '{"forma":"imagem","caminhos":["${CONTA}/ig.jpg"]}'::jsonb, 'outro-post')`,
      [CONTA]
    );
    await enfileirarTexto();
    const id = String((await linhaDoLinkedin()).id);
    const desfecho = await dreno.drenarUmaPublicacaoDoLinkedin(id);
    expect(desfecho).toBe("publicado");
    expect(linkedin.posts).toHaveLength(1);
    const outras = await q(`select status, attempts from queue where kind <> 'publicacao_linkedin' order by kind`);
    expect(outras).toEqual([
      { status: "pending", attempts: 0 },
      { status: "pending", attempts: 0 },
    ]);
  });

  it("não pega a linha de outro tipo, a agendada nem a que já saiu", async () => {
    await enfileirarTexto("depois", new Date(Date.now() + 3_600_000));
    expect(await dreno.drenarUmaPublicacaoDoLinkedin(String((await linhaDoLinkedin()).id))).toBeNull();
    await q(
      `insert into queue (account_id, kind, payload, dedupe_key) values ($1, 'publicacao', '{"forma":"imagem","caminhos":["${CONTA}/x.jpg"]}'::jsonb, 'post-ig')`,
      [CONTA]
    );
    const ig = String((await q(`select id from queue where kind = 'publicacao'`))[0].id);
    expect(await dreno.drenarUmaPublicacaoDoLinkedin(ig)).toBeNull();
    expect(await dreno.drenarUmaPublicacaoDoLinkedin("não é uuid")).toBeNull();
    expect(linkedin.pedidos).toHaveLength(0);
  });

  it("o dreno geral e o \"agora\" ao mesmo tempo publicam um post só", async () => {
    let liberar!: () => void;
    linkedin.segurarOPost = new Promise<void>((pronto) => (liberar = pronto));
    await enfileirarTexto();
    const id = String((await linhaDoLinkedin()).id);
    const ambos = Promise.all([dreno.drainQueue(), dreno.drenarUmaPublicacaoDoLinkedin(id)]);
    await new Promise((pronto) => setTimeout(pronto, 300));
    liberar();
    await ambos;
    expect(linkedin.posts).toHaveLength(1);
    expect((await linhaDoLinkedin()).status).toBe("sent");
  });
});
```

Em `testes-integracao/conferencia-do-kind.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/conferencia-do-kind.integracao.ts b/testes-integracao/conferencia-do-kind.integracao.ts
index 371f075..a7e3393 100644
--- a/testes-integracao/conferencia-do-kind.integracao.ts
+++ b/testes-integracao/conferencia-do-kind.integracao.ts
@@ -1,13 +1,13 @@
-// A CONFERÊNCIA DO `queue_kind_check` ACEITA DUAS FORMAS, E SÓ ELAS (docs/specs/2026-11-06-linkedin-no-perfil.md, §0).
+// A CONFERÊNCIA DO `queue_kind_check` ACEITA A FORMA DA 025, E SÓ ELA (docs/specs/2026-11-06-linkedin-no-perfil.md,
+// §0 e §1; a parte 2a).
 //
 // O `scripts/migrar.mjs` roda em todo deploy de produção e exige o texto EXATO de cada restrição conferida;
-// uma divergência derruba o build (saída 1). A entrega do LinkedIn alarga o `queue_kind_check` com o tipo
-// `publicacao_linkedin` (a migração 025, na parte 2 da entrega; a 024 da parte 1 não toca a fila), aplicada à
-// mão antes do merge, como a 022 e a 023. Sem esta preparação, todo deploy da `main` entre a 025 e o merge
-// morreria no build.
+// uma divergência derruba o build (saída 1). A 025 alargou o `queue_kind_check` com o `publicacao_linkedin`, e
+// foi aplicada à mão antes do merge da parte 2a; na janela, a `main` aceitava as duas formas (a da 010 e a da
+// 025, pela preparação). Com a parte 2a, a forma da 025 vira a única, e a da 010 passa a divergir: um banco que
+// voltasse a ela recusaria a linha do LinkedIn, e o build tem de acusar.
 //
-// As duas formas aceitas são a da 010 (a de hoje) e a da 025. Qualquer terceira continua sendo divergência:
-// é o que este arquivo prova, rodando o script de verdade, como o build roda, contra um schema descartável.
+// É o que este arquivo prova, rodando o script de verdade, como o build roda, contra um schema descartável.
 //
 // OS TEXTOS SÃO OS DO `pg_get_constraintdef`, medidos no banco de teste em 06/11/2026.
 import { afterAll, beforeAll, expect, it } from "vitest";
@@ -53,7 +53,7 @@ beforeAll(async () => {
   leitor = postgres(urlDoTeste, { prepare: false, ssl: sslDaUrl(urlDoTeste), max: 1 });
   // A trava de `banco-descartavel`: confere NO BANCO que o caminho é o schema temporário sozinho.
   await conferirCaminho((texto) => leitor!.unsafe(texto), schema);
-  // A pasta inteira, pelo próprio script: o `queue_kind_check` nasce na forma da 010.
+  // A pasta inteira, pelo próprio script: o `queue_kind_check` nasce na forma da 025.
   const r = await migrar("--aplicar", "--a-mao");
   if (r.codigo !== 0) throw new Error(`a pasta não aplicou no schema descartável:\n${r.saida}`);
 }, 240_000);
@@ -87,32 +87,35 @@ async function checkCom(tipos: string[]) {
 
 const CONFERE = "CONFERIDO no banco: queue.queue_kind_check existe e confere";
 
-it("a forma da 010 confere", async () => {
-  await checkCom(TIPOS_DA_010);
+const TIPOS_DA_025 = [...TIPOS_DA_010, "publicacao_linkedin"];
+
+it("a forma da 025, com o publicacao_linkedin, confere", async () => {
+  await checkCom(TIPOS_DA_025);
   const r = await migrar("--a-mao");
   expect(r.codigo, r.saida).toBe(0);
-  expect(r.saida).toContain(CONFERE);
+  expect(r.saida).toContain(`${CONFERE} (025-fila-linkedin.sql)`);
+  expect(r.saida).not.toContain("queue_kind_check existe, MAS DIVERGE");
 }, 120_000);
 
-it("a forma da 025, com o publicacao_linkedin, também confere", async () => {
-  await checkCom([...TIPOS_DA_010, "publicacao_linkedin"]);
+it("a forma da 010, de antes da 025, agora diverge, e derruba o script", async () => {
+  await checkCom(TIPOS_DA_010);
   const r = await migrar("--a-mao");
-  expect(r.codigo, r.saida).toBe(0);
-  expect(r.saida).toContain(CONFERE);
-  expect(r.saida).not.toContain("queue_kind_check existe, MAS DIVERGE");
+  expect(r.codigo, r.saida).toBe(1);
+  expect(r.saida).toContain("queue.queue_kind_check existe, MAS DIVERGE");
+  await checkCom(TIPOS_DA_025);
 }, 120_000);
 
 it("uma terceira forma continua divergindo, e derruba o script", async () => {
-  await checkCom([...TIPOS_DA_010, "publicacao_linkedin", "tipo_que_ninguem_escreveu"]);
+  await checkCom([...TIPOS_DA_025, "tipo_que_ninguem_escreveu"]);
   const r = await migrar("--a-mao");
   expect(r.codigo, r.saida).toBe(1);
   expect(r.saida).toContain("queue.queue_kind_check existe, MAS DIVERGE");
 }, 120_000);
 
-it("a forma da 010 sem um tipo também diverge", async () => {
-  await checkCom(TIPOS_DA_010.filter((t) => t !== "dm_lote"));
+it("a forma da 025 sem um tipo também diverge", async () => {
+  await checkCom(TIPOS_DA_025.filter((t) => t !== "dm_lote"));
   const r = await migrar("--a-mao");
   expect(r.codigo, r.saida).toBe(1);
   expect(r.saida).toContain("queue.queue_kind_check existe, MAS DIVERGE");
-  await checkCom(TIPOS_DA_010);
+  await checkCom(TIPOS_DA_025);
 }, 120_000);
```

Em `tests/fila-tipos.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/fila-tipos.test.ts b/tests/fila-tipos.test.ts
index c74c11a..e0926a7 100644
--- a/tests/fila-tipos.test.ts
+++ b/tests/fila-tipos.test.ts
@@ -1,7 +1,7 @@
 import { describe, expect, expectTypeOf, it } from "vitest";
 import { readdirSync, readFileSync } from "node:fs";
 import { join } from "node:path";
-import { TIPOS_QUE_O_DRENO_CONHECE, type TipoDaFila } from "@/lib/fila-tipos";
+import { TIPOS_DE_PUBLICACAO, TIPOS_QUE_O_DRENO_CONHECE, type TipoDaFila } from "@/lib/fila-tipos";
 import type { QueueItem } from "@/lib/db";
 
 // A LISTA DOS TIPOS QUE O DRENO CONHECE É A DO BANCO (docs/specs/2026-11-06-linkedin-no-perfil.md, §0).
@@ -30,7 +30,8 @@ function tiposDaUltimaMigracaoDoCheck(): { arquivo: string; tipos: string[] } {
 describe("os tipos que o dreno conhece", () => {
   it("são exatamente os do queue_kind_check da última migração que o escreve", () => {
     const { arquivo, tipos } = tiposDaUltimaMigracaoDoCheck();
-    expect(arquivo).toBe("010-fila-publicacao.sql");
+    // A 025 (a parte 2a do LinkedIn) alargou o check com o `publicacao_linkedin`, e o dreno ganhou o ramo dele.
+    expect(arquivo).toBe("025-fila-linkedin.sql");
     expect([...TIPOS_QUE_O_DRENO_CONHECE].sort()).toEqual([...tipos].sort());
   });
 
@@ -41,4 +42,12 @@ describe("os tipos que o dreno conhece", () => {
   it("são o tipo do kind da linha da fila (QueueItem), e não uma segunda lista", () => {
     expectTypeOf<QueueItem["kind"]>().toEqualTypeOf<TipoDaFila>();
   });
+
+  // OS TIPOS DE PUBLICAÇÃO (docs/specs/2026-11-06-linkedin-no-perfil.md, §6): os pontos que dizem "post, e não
+  // mensagem" (a cota de DM, a exceção da seleção, os tiques do dia, as contagens do Início, as telas) perguntam
+  // a esta lista, e não a um literal.
+  it("os de publicação são o post do Instagram e o do LinkedIn, e os dois o dreno conhece", () => {
+    expect([...TIPOS_DE_PUBLICACAO]).toEqual(["publicacao", "publicacao_linkedin"]);
+    for (const t of TIPOS_DE_PUBLICACAO) expect(TIPOS_QUE_O_DRENO_CONHECE).toContain(t);
+  });
 });
```

Em `tests/linkedin-post.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/linkedin-post.test.ts b/tests/linkedin-post.test.ts
index 0633045..607a329 100644
--- a/tests/linkedin-post.test.ts
+++ b/tests/linkedin-post.test.ts
@@ -7,6 +7,7 @@ import {
   lerPayloadDoLinkedin,
   linkParaVerNoLinkedin,
   motivoDaAutorizacaoRecusada,
+  oPostPodeTerSaido,
   payloadDoLinkedin,
   problemaDoTextoDoLinkedin,
   rotuloDaFormaNoLinkedin,
@@ -94,6 +95,13 @@ describe("o erro do LinkedIn", () => {
       "o LinkedIn de Dra. Ana não aceita mais a autorização (venceu ou foi retirada); mande o convite de novo"
     );
   });
+
+  // O ACHADO 210: o POST /rest/posts não tem chave contra repetição. Só uma resposta 4xx prova que o post não foi
+  // criado; a rede (0), o 5xx e o 2xx sem o id deixam a dúvida, e a linha não pode ser tentada de novo.
+  it("depois do POST, só o 4xx prova que o post não saiu; a rede, o 5xx e o 2xx sem id deixam a dúvida", () => {
+    for (const s of [0, 200, 201, 500, 502, 503, 504]) expect(oPostPodeTerSaido(s), String(s)).toBe(true);
+    for (const s of [400, 401, 403, 404, 409, 422, 429]) expect(oPostPodeTerSaido(s), String(s)).toBe(false);
+  });
 });
 
 describe("o payload da linha do LinkedIn na fila", () => {
```

Em `tests/linkedin-token-fora-do-cliente.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/linkedin-token-fora-do-cliente.test.ts b/tests/linkedin-token-fora-do-cliente.test.ts
index 7c1d72a..8140179 100644
--- a/tests/linkedin-token-fora-do-cliente.test.ts
+++ b/tests/linkedin-token-fora-do-cliente.test.ts
@@ -41,13 +41,19 @@ describe("a autorização do LinkedIn fica no servidor", () => {
 
   it("só estes arquivos importam o repositório da conexão", () => {
     const importam = CODIGO.filter((rel) => IMPORTA_O_REPOSITORIO.test(ler(rel)));
-    expect(importam).toEqual(["app/setup/actions.ts", "app/setup/page.tsx", "lib/convites-repositorio.ts"]);
+    expect(importam).toEqual([
+      "app/setup/actions.ts",
+      "app/setup/page.tsx",
+      "lib/convites-repositorio.ts",
+      "lib/linkedin-fila.ts",
+    ]);
   });
 
-  it("a linha inteira, com o token, só sai pela conexaoDaConta, e nesta parte ninguém a chama", () => {
-    // Na parte 2, o dreno da publicação entra nesta lista: é o único que precisa da autorização.
+  it("a linha inteira, com o token, só sai pela conexaoDaConta, e só o post da fila a chama", () => {
+    // A parte 2a: o post do LinkedIn pela fila (lib/linkedin-fila.ts, chamado pelo dreno) é o único que precisa da
+    // autorização.
     const chamam = CODIGO.filter((rel) => rel !== "lib/linkedin-conexoes.ts" && /\bconexaoDaConta\b/.test(ler(rel)));
-    expect(chamam).toEqual([]);
+    expect(chamam).toEqual(["lib/linkedin-fila.ts"]);
   });
 
   it("a Configuração lê só os resumos, e o componente de cliente dela não fala de token", () => {
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
env -u CLAUDECODE -u AI_AGENT npx --no-install vitest run tests/fila-tipos.test.ts tests/linkedin-post.test.ts \
  tests/linkedin-token-fora-do-cliente.test.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" \
  npx --no-install vitest run --config vitest.integracao.config.ts \
  testes-integracao/linkedin-publicacao.integracao.ts testes-integracao/conferencia-do-kind.integracao.ts
```

Esperado: 
- nos puros, "Tests 5 failed | 20 passed (25)". Caem "são exatamente os do queue_kind_check da última migração que o escreve" e "os de publicação são o post do Instagram e o do LinkedIn, e os dois o dreno conhece" (a 025 e a lista ainda não existem), "depois do POST, só o 4xx prova que o post não saiu; a rede, o 5xx e o 2xx sem id deixam a dúvida", e os dois da trava do token ("só estes arquivos importam o repositório da conexão" e "a linha inteira, com o token, só sai pela conexaoDaConta, e só o post da fila a chama");
- na integração, `ALVO: banco de TESTE` e "Tests 2 failed | 2 passed | 19 skipped (23)": o arquivo novo não acha `@/lib/linkedin-fila`, e os 19 casos dele pulam; caem "a forma da 025, com o publicacao_linkedin, confere" e "a forma da 010, de antes da 025, agora diverge, e derruba o script".

- [ ] **Passo 3: o código**

Crie `migrations/025-fila-linkedin.sql`:

```sql
-- O TIPO `publicacao_linkedin` ENTRA NA FILA (docs/specs/2026-11-06-linkedin-no-perfil.md, §0 e §6; a parte 2a
-- da entrega: o post só de texto ou com uma imagem, no perfil pessoal do LinkedIn).
--
-- A MECÂNICA É A DA `010`, que é o precedente exato: mesma tabela, mesma coluna, derruba a restrição e a recria
-- alargada. O `add constraint` VALIDA as linhas existentes, então um banco com `kind` fora da lista falha alto
-- em vez de passar calado. Esta alarga de onze tipos para doze.
--
-- ALARGAR É SEGURO EM UM DEPLOY SÓ, pelo motivo da `010`: o código antigo nunca escreve `publicacao_linkedin`,
-- e continua funcionando contra a restrição nova. E o código antigo NÃO DRENA o tipo novo: a seleção do dreno
-- filtra pelos tipos que ele conhece (lib/fila-tipos.ts), e uma linha do LinkedIn escrita por um preview fica
-- `pending`, intocada, até o código que a conhece chegar (testes-integracao/dreno-tipo-desconhecido.integracao.ts).
--
-- APLICADA À MÃO ANTES DO MERGE DA PARTE 2a, como a `022`, a `023` e a `024`. Na janela entre a aplicação e o
-- merge, o `scripts/migrar.mjs` da `main` aceita as duas formas do `queue_kind_check` (a da `010` e a desta);
-- com o merge, a forma desta vira a única (testes-integracao/conferencia-do-kind.integracao.ts).
--
-- OS TIPOS NA ORDEM DA `010`, com o novo no fim: o texto que o Postgres devolve (`pg_get_constraintdef`) segue
-- a ordem da lista, e a conferência compara o texto inteiro.
--
-- =============================================================================
-- POR QUE O NOME É `publicacao_linkedin`
--
-- O `publicacao` da `010` não leva sufixo porque, quando nasceu, todo tipo da fila era do Instagram. Este é o
-- primeiro que não é, e o sufixo é o que distingue. Renomear o `publicacao` para `publicacao_instagram` seria
-- migração de dado em produção, para nada.
--
-- E NÃO HÁ TABELA NOVA, pelo argumento da `010`: o post do LinkedIn cabe no `payload` (a forma, o caminho da
-- imagem quando há, o texto, e as marcas do que já foi feito: `imagem_urn`, `post_tentado_em`, `post_urn`).

alter table queue drop constraint if exists queue_kind_check;

alter table queue add constraint queue_kind_check check (kind in (
  'private_reply','comment_reply','dm_welcome','dm_link','dm_reminder',
  'dm_follow_gate','dm_email_ask','story_reaction','dm_manual','dm_lote',
  'publicacao','publicacao_linkedin'
));
```

Em `lib/fila-tipos.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/fila-tipos.ts b/lib/fila-tipos.ts
index 5804856..58b66f3 100644
--- a/lib/fila-tipos.ts
+++ b/lib/fila-tipos.ts
@@ -23,6 +23,15 @@ export const TIPOS_QUE_O_DRENO_CONHECE = [
   "dm_manual",
   "dm_lote",
   "publicacao",
+  // O POST NO PERFIL PESSOAL DO LINKEDIN (a 025; docs/specs/2026-11-06-linkedin-no-perfil.md, §6). Quem o
+  // publica é lib/linkedin-fila.ts, chamado pelo ramo dele no dreno.
+  "publicacao_linkedin",
 ] as const;
 
 export type TipoDaFila = (typeof TIPOS_QUE_O_DRENO_CONHECE)[number];
+
+// OS TIPOS QUE SÃO POST, E NÃO MENSAGEM (a spec, §6). Os pontos que dizem "post, e não mensagem" perguntam a
+// esta lista, e não a um literal: a cota horária de DM não conta post, a conta no teto de DM não segura post, e
+// os tiques do dia são armados só para post (lib/queue-drain.ts). Com um literal, o post do LinkedIn comeria a
+// cota de DM e ficaria parado atrás de um lote grande.
+export const TIPOS_DE_PUBLICACAO = ["publicacao", "publicacao_linkedin"] as const satisfies readonly TipoDaFila[];
```

Crie `lib/linkedin-fila.ts`:

```ts
import "server-only";
import { sql, getConfig, type QueueItem } from "./db";
import type { ResultadoDaPublicacao } from "./engine";
import { scheduleTick, HORIZONTE_DO_TIQUE_EM_SEGUNDOS } from "./qstash";
import { atrasoDoTiqueDaPublicacao } from "./publicacao";
import { chaveDaPublicacaoNoLinkedin } from "./dedupe";
import { urlPublicaDoObjeto } from "./bucket";
import { conexaoDaConta } from "./linkedin-conexoes";
import { criarPost, enviarImagem, LinkedinError, reservarImagem } from "./linkedin";
import {
  corpoDoPost,
  desfechoDoErroDoLinkedin,
  lerPayloadDoLinkedin,
  motivoDaAutorizacaoRecusada,
  oPostPodeTerSaido,
  payloadDoLinkedin,
  problemaDoTextoDoLinkedin,
  type FormaNoLinkedin,
} from "./linkedin-publicacao";

// O POST DO LINKEDIN PELA FILA (docs/specs/2026-11-06-linkedin-no-perfil.md, §6; a parte 2a: só texto e imagem,
// uma rede por post). Dois pedaços: o enfileirar, no molde do `enqueuePublicacao` (lib/engine.ts), e o publicar,
// chamado pelo ramo `publicacao_linkedin` do dreno (lib/queue-drain.ts).
//
// O DRENO PASSA AS TRÊS FUNÇÕES DELE (`finish`, `guardarNoPayload` e `limparOBucket`), e este arquivo não importa o
// dreno: o dreno importa daqui, e o contrário seria um ciclo.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * ENFILEIRA O POST DO LINKEDIN. `quando: null` é agora, pelo `now()` do banco, e data no passado também é agora
 * (o mesmo de `enqueuePublicacao`). O resultado é medido pelo banco, no mesmo statement que grava.
 *
 * NÃO ENTRA o pedido torto: a forma sem a quantidade certa de arquivos, o texto vazio ou longo demais e o envio
 * sem id. A tela confere antes e diz o motivo; esta recusa é a segunda barreira, para nenhuma linha nascer
 * condenada a falhar no dreno.
 *
 * A CHAVE (lib/dedupe.ts, `chaveDaPublicacaoNoLinkedin`): a imagem pela conta e pelo caminho, que é único por
 * upload; o só texto pela conta e pelo id do envio, que a tela gera uma vez por formulário. O mesmo clique
 * repetido não entra duas vezes; o mesmo texto num envio novo entra.
 */
export async function enqueuePublicacaoNoLinkedin(
  accountId: string,
  pedido: { forma: FormaNoLinkedin; caminhos: string[]; texto: string; idDoEnvio: string },
  quando: Date | null
): Promise<ResultadoDaPublicacao> {
  const payload = payloadDoLinkedin(pedido);
  if (!lerPayloadDoLinkedin(payload) || problemaDoTextoDoLinkedin(payload.texto, payload.forma) || !UUID.test(pedido.idDoEnvio)) {
    return { entrou: false };
  }
  const linhas = (await sql().query(
    `insert into queue (account_id, kind, payload, dedupe_key, not_before)
     values ($1, 'publicacao_linkedin', $2, $3, greatest(now(), coalesce($4::timestamptz, now())))
     on conflict (dedupe_key) do nothing
     returning id,
               (not_before <= now()) as ja_vale,
               greatest(0, ceil(extract(epoch from (not_before - now()))))::int as falta`,
    [accountId, payload, chaveDaPublicacaoNoLinkedin(accountId, pedido.forma, pedido.caminhos, pedido.idDoEnvio), quando]
  )) as { id: string; ja_vale: boolean; falta: number }[];
  if (!linhas.length) return { entrou: false };
  const { ja_vale: jaVale, falta } = linhas[0];

  // O TIQUE NÃO DERRUBA O QUE JÁ ENTROU (o achado 101, do `enqueuePublicacao`): sem tique, o post ainda sai pelo
  // rodapé do dreno, por um webhook ou pelo cron, só mais tarde.
  const atrasoDoTique = jaVale ? null : atrasoDoTiqueDaPublicacao(falta, HORIZONTE_DO_TIQUE_EM_SEGUNDOS);
  if (atrasoDoTique !== null) {
    try {
      const config = await getConfig();
      await scheduleTick(config.app_url ?? "", atrasoDoTique);
    } catch {
      // Calado de propósito: o post está na fila, e é isso que a tela diz.
    }
  }
  return { entrou: true, jaVale, falta };
}

// ---------------------------------------------------------------------------------------------------------------
// O PUBLICAR, CHAMADO PELO DRENO
// ---------------------------------------------------------------------------------------------------------------

export type DependenciasDoDreno = {
  finish: (id: string, campos: { status: string; sent_at?: Date; error?: string }) => Promise<void>;
  guardarNoPayload: (id: string, campos: Record<string, unknown>) => Promise<void>;
  limparOBucket: (item: { id: string }, caminhos: string[], igUserId: string) => Promise<void>;
};

export type DesfechoDoPostNoLinkedin = "publicado" | "falhou";

export const MOTIVO_DO_PAYLOAD_TORTO = "o payload deste item não é de um post do LinkedIn";
export const MOTIVO_SEM_CONEXAO = "esta conta não tem LinkedIn conectado";
export const MOTIVO_PODE_TER_SAIDO =
  "o post pode ter saído no LinkedIn sem a confirmação chegar; confira no seu LinkedIn antes de publicar de novo";

/** O teto do download da imagem do bucket. Sem ele, um bucket que não responde seguraria o dreno inteiro. */
const TETO_DO_BUCKET_MS = 20_000;

/**
 * Os bytes da imagem, pelo endereço público do bucket (o mesmo do `copiarParaAFila`, lib/bonus/publicar-bucket.ts).
 * Lança com o status, sem o endereço; o erro volta à fila pelo `catch` do dreno.
 */
async function bytesDaImagem(caminho: string): Promise<ArrayBuffer> {
  const r = await fetch(urlPublicaDoObjeto(caminho), { cache: "no-store", signal: AbortSignal.timeout(TETO_DO_BUCKET_MS) });
  if (!r.ok) throw new Error(`a imagem do post não foi encontrada no armazenamento (HTTP ${r.status})`);
  return r.arrayBuffer();
}

/**
 * A RECUSA DO LINKEDIN QUE ENCERRA A LINHA, ou null quando o erro é passageiro (ou não é do LinkedIn) e a linha
 * volta à fila pelo `catch` do dreno. O 401 diz quem refazer o convite; o resto leva o status e o texto do
 * LinkedIn, que não têm a autorização.
 */
function recusaDoLinkedin(err: unknown, nome: string): string | null {
  if (!(err instanceof LinkedinError)) return null;
  const desfecho = desfechoDoErroDoLinkedin(err.status);
  if (desfecho === "autorizacao") return motivoDaAutorizacaoRecusada(nome);
  if (desfecho === "permanente") return err.message.slice(0, 500);
  return null;
}

/** A marca do POST sai quando o LinkedIn respondeu que não criou o post (um 4xx). */
async function tirarAMarcaDoPost(id: string): Promise<void> {
  await sql().query(`update queue set payload = payload - 'post_tentado_em' where id = $1`, [id]);
}

/**
 * PUBLICA A LINHA NO LINKEDIN. Os passos ficam marcados no payload, e cada passada começa do que falta:
 *
 *   1. com o `post_urn`, o post já saiu: a linha fecha `sent` sem publicar de novo;
 *   2. com o `post_tentado_em` e sem o `post_urn`, um POST anterior ficou sem resposta (a função caiu, o banco
 *      falhou): a linha vai a `failed` dizendo para conferir no LinkedIn, e NÃO publica (achado 210);
 *   3. sem conexão, ou com ela vencida, a linha vai a `failed` com o motivo, sem chamar o LinkedIn;
 *   4. a imagem: baixa do bucket, reserva com a pessoa dona, envia, e grava o `imagem_urn`. Numa passada seguinte,
 *      ela não sobe de novo;
 *   5. o `post_tentado_em` é gravado ANTES do POST, e o `post_urn` logo depois;
 *   6. `sent`, e só então o arquivo sai do bucket (o cabeçalho de `limparOBucket`).
 *
 * O ERRO PASSAGEIRO (rede, 429, 409 e 5xx, antes do POST) sobe ao `catch` do dreno, que devolve a linha à fila ou
 * a encerra pelo número de tentativas. Depois do POST, só o 4xx prova que o post não saiu (`oPostPodeTerSaido`).
 */
export async function publicarNoLinkedinDaFila(item: QueueItem, deps: DependenciasDoDreno): Promise<DesfechoDoPostNoLinkedin> {
  const pub = lerPayloadDoLinkedin(item.payload);
  if (!pub) {
    await deps.finish(item.id, { status: "failed", error: MOTIVO_DO_PAYLOAD_TORTO });
    return "falhou";
  }
  const conta = item.account_id ?? "";

  if (pub.postUrn) {
    await deps.finish(item.id, { status: "sent", sent_at: new Date() });
    await deps.limparOBucket(item, pub.caminhos, conta);
    return "publicado";
  }
  if (pub.postTentadoEm) {
    await deps.finish(item.id, { status: "failed", error: MOTIVO_PODE_TER_SAIDO });
    return "falhou";
  }

  const conexao = conta ? await conexaoDaConta(conta) : null;
  if (!conexao) {
    await deps.finish(item.id, { status: "failed", error: MOTIVO_SEM_CONEXAO });
    return "falhou";
  }
  if (new Date(conexao.expira_em).getTime() <= Date.now()) {
    await deps.finish(item.id, { status: "failed", error: motivoDaAutorizacaoRecusada(conexao.nome) });
    return "falhou";
  }

  let imagemUrn = pub.imagemUrn ?? undefined;
  if (pub.forma === "imagem" && !imagemUrn) {
    try {
      const bytes = await bytesDaImagem(pub.caminhos[0]);
      const reserva = await reservarImagem(conexao.access_token, conexao.pessoa_id);
      // O mime é fixo: a tela de publicar só aceita JPEG para imagem (lib/publicacao.ts, `MIMES_DE_IMAGEM`).
      await enviarImagem(reserva.uploadUrl, conexao.access_token, bytes, "image/jpeg");
      imagemUrn = reserva.imagemUrn;
    } catch (err) {
      const recusa = recusaDoLinkedin(err, conexao.nome);
      if (recusa === null) throw err;
      await deps.finish(item.id, { status: "failed", error: recusa });
      return "falhou";
    }
    await deps.guardarNoPayload(item.id, { imagem_urn: imagemUrn });
  }

  // A MARCA ANTES DO POST (achado 210): uma resposta perdida daqui em diante não vira um segundo post.
  await deps.guardarNoPayload(item.id, { post_tentado_em: new Date().toISOString() });
  let postUrn: string;
  try {
    postUrn = await criarPost(
      conexao.access_token,
      corpoDoPost({ pessoaId: conexao.pessoa_id, texto: pub.texto, imagemUrn })
    );
  } catch (err) {
    if (!(err instanceof LinkedinError) || oPostPodeTerSaido(err.status)) {
      await deps.finish(item.id, { status: "failed", error: MOTIVO_PODE_TER_SAIDO });
      return "falhou";
    }
    // O LinkedIn respondeu 4xx: o post não foi criado, e a marca sai. O 429 e o 409 voltam à fila; o resto encerra.
    await tirarAMarcaDoPost(item.id);
    const recusa = recusaDoLinkedin(err, conexao.nome);
    if (recusa === null) throw err;
    await deps.finish(item.id, { status: "failed", error: recusa });
    return "falhou";
  }
  await deps.guardarNoPayload(item.id, { post_urn: postUrn });
  await deps.finish(item.id, { status: "sent", sent_at: new Date() });
  // DEPOIS DO `finish`, e nunca antes: ver o cabeçalho de `limparOBucket`.
  await deps.limparOBucket(item, pub.caminhos, conta);
  return "publicado";
}
```

Em `lib/queue-drain.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/queue-drain.ts b/lib/queue-drain.ts
index d73e708..153316e 100644
--- a/lib/queue-drain.ts
+++ b/lib/queue-drain.ts
@@ -22,7 +22,10 @@ import { renderVariables, type VariableContext } from "./variables";
 // coluna é `variableContext`, aqui embaixo; quem entende o `jsonb` é ele.
 import { lerCampos } from "./campos";
 import { lerPayloadDoLote, loteExpirou } from "./lote";
-import { TIPOS_QUE_O_DRENO_CONHECE } from "./fila-tipos";
+import { TIPOS_DE_PUBLICACAO, TIPOS_QUE_O_DRENO_CONHECE } from "./fila-tipos";
+// O POST DO LINKEDIN (a parte 2a). O arquivo dele não importa este: as três funções de que ele precisa vão como
+// parâmetro (`DEPENDENCIAS_DO_LINKEDIN`, lá embaixo).
+import { publicarNoLinkedinDaFila, type DependenciasDoDreno } from "./linkedin-fila";
 import {
   leituraDoContainer,
   lerPayloadDaPublicacao,
@@ -74,8 +77,8 @@ const GAP_MS = 600; // ~1,6 envios/segundo
 // escrita e não só implícita:
 //
 //   1. GASTANDO O TETO. A contagem do teto horário é `status = 'sent'` na
-//      última hora — ela conta LINHA DE FILA, não mensagem. Sem o `kind <>
-//      'publicacao'` da consulta lá embaixo, publicar trinta posts numa manhã
+//      última hora — ela conta LINHA DE FILA, não mensagem. Sem o filtro dos
+//      tipos de post da consulta lá embaixo, publicar trinta posts numa manhã
 //      comeria trinta das 190 DMs daquela hora, e as respostas automáticas do
 //      painel — que são o produto — passariam a engasgar por causa de um
 //      recurso que nada tem a ver com elas. O sintoma seria "o robô parou de
@@ -971,6 +974,54 @@ export async function cancelarLotesVencidos(): Promise<{ vencidos: number }> {
   return { vencidos: vencidos.length };
 }
 
+/**
+ * O ERRO QUE SUBIU DE UM ITEM: o 4xx da Meta encerra; o resto volta à fila em 2 minutos, até a terceira tentativa.
+ * É o `catch` do `drainQueue`, tirado para uma função quando o "agora" do LinkedIn
+ * (`drenarUmaPublicacaoDoLinkedin`, logo abaixo) passou a precisar do mesmo desfecho.
+ */
+async function devolverOuEncerrar(item: QueueItem, err: unknown): Promise<void> {
+  const permanent = err instanceof IgError && err.status >= 400 && err.status < 500;
+  const giveUp = permanent || item.attempts >= 3;
+  await finish(item.id, {
+    status: giveUp ? "failed" : "pending",
+    retryInSeconds: 120,
+    error: err instanceof Error ? err.message.slice(0, 500) : String(err),
+  });
+}
+
+/** O que o post do LinkedIn usa do dreno (lib/linkedin-fila.ts). */
+const DEPENDENCIAS_DO_LINKEDIN: DependenciasDoDreno = { finish, guardarNoPayload, limparOBucket };
+
+const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
+
+/**
+ * O "AGORA" DO POST NO LINKEDIN DRENA SÓ A PRÓPRIA LINHA (achado 211; a nota 198: no preview não há QStash, e quem
+ * publica o post de agora é a própria action, que chama esta função).
+ *
+ * O `drainQueue` inteiro, na action, mandaria também as mensagens vencidas e os posts do Instagram do banco, que é
+ * um só para a produção e os previews. Esta função reivindica UMA linha, numa instrução só: ela só a pega se for
+ * do LinkedIn, `pending` e já valer. Com o dreno geral rodando ao mesmo tempo, só um dos dois a pega: o `update`
+ * espera a trava do outro e confere o `where` de novo, e aí a linha já é `sending`.
+ *
+ * Devolve o desfecho, ou null quando não pegou nada (id torto, outro tipo, agendada, ou já pega).
+ */
+export async function drenarUmaPublicacaoDoLinkedin(id: string): Promise<"publicado" | "falhou" | null> {
+  if (!UUID.test(id)) return null;
+  const [item] = (await sql().query(
+    `update queue set status = 'sending', claimed_at = now(), attempts = attempts + 1
+      where id = $1 and kind = 'publicacao_linkedin' and status = 'pending' and not_before <= now()
+      returning *`,
+    [id]
+  )) as QueueItem[];
+  if (!item) return null;
+  try {
+    return await publicarNoLinkedinDaFila(item, DEPENDENCIAS_DO_LINKEDIN);
+  } catch (err) {
+    await devolverOuEncerrar(item, err);
+    return "falhou";
+  }
+}
+
 export async function drainQueue(): Promise<ResumoDaDrenagem> {
   const result = { sent: 0, skipped: 0, failed: 0, guardados: 0, aguardando: 0 };
   const accounts = await listAccounts();
@@ -980,17 +1031,18 @@ export async function drainQueue(): Promise<ResumoDaDrenagem> {
   // O limite horário da Meta é POR CONTA: contas no teto ficam de fora do
   // lote (em vez de serem reivindicadas e devolvidas, o que inflaria attempts).
   //
-  // O `kind <> 'publicacao'` É O QUE IMPEDE UM POST DE COMER A COTA DE DM.
+  // O FILTRO DOS TIPOS DE POST É O QUE IMPEDE UM POST DE COMER A COTA DE DM.
   // Esta contagem é sobre LINHA DE FILA `sent`, e não sobre mensagem: sem o
   // filtro, trinta posts publicados numa manhã tirariam trinta das 190
   // mensagens daquela hora, e as respostas automáticas do painel — que são o
   // produto — engasgariam por causa de um recurso que nada tem a ver com elas.
   // Publicação tem limite próprio na Meta, perguntado a ela em
-  // `publicarDaFila`. Ver o bloco `HOURLY_CAP`, no topo do arquivo.
+  // `publicarDaFila`. Ver o bloco `HOURLY_CAP`, no topo do arquivo. A lista
+  // (lib/fila-tipos.ts) tem também o post do LinkedIn, que nem passa pela Meta.
   const capRows = (await sql()`
     select account_id, count(*)::int as n from queue
     where status = 'sent' and sent_at > now() - interval '1 hour'
-      and kind <> 'publicacao'
+      and not (kind = any(${Array.from(TIPOS_DE_PUBLICACAO)}::text[]))
     group by account_id
   `) as { account_id: string | null; n: number }[];
   const blocked = capRows
@@ -1054,8 +1106,9 @@ export async function drainQueue(): Promise<ResumoDaDrenagem> {
            -- excecao um lote grande de mensagens -- que leva horas para sair --
            -- deixaria todo post agendado daquela conta parado atras dele,
            -- inclusive o marcado para uma hora exata. O limite de publicacao e
-           -- outro, e quem o pergunta a Meta e publicarDaFila.
-           and (kind = 'publicacao'
+           -- outro, e quem o pergunta a Meta e publicarDaFila. Vale para
+           -- todo tipo de post (lib/fila-tipos.ts, TIPOS_DE_PUBLICACAO).
+           and (kind = any($4::text[])
                 or account_id is null
                 or not (account_id = any($2::text[])))
          order by created_at
@@ -1065,7 +1118,7 @@ export async function drainQueue(): Promise<ResumoDaDrenagem> {
        returning q.*
      )
      select *, now() as agora_do_banco from lote order by created_at, id`,
-    [BATCH_SIZE, blocked, Array.from(TIPOS_QUE_O_DRENO_CONHECE)]
+    [BATCH_SIZE, blocked, Array.from(TIPOS_QUE_O_DRENO_CONHECE), Array.from(TIPOS_DE_PUBLICACAO)]
   )) as (QueueItem & { agora_do_banco: Date })[];
 
   // O RELOGIO QUE JULGA A VALIDADE É O DO BANCO, E NÃO O DA APLICAÇÃO.
@@ -1173,6 +1226,15 @@ export async function drainQueue(): Promise<ResumoDaDrenagem> {
         continue;
       }
 
+      // O POST DO LINKEDIN (a parte 2a), pelo mesmo caminho e no mesmo `try`: o erro passageiro dele cai no `catch`
+      // de baixo, como o da Meta. O que é recusa do LinkedIn, ou dúvida depois do POST, ele mesmo encerra.
+      if (item.kind === "publicacao_linkedin") {
+        const desfecho = await publicarNoLinkedinDaFila(item, DEPENDENCIAS_DO_LINKEDIN);
+        if (desfecho === "publicado") result.sent++;
+        else result.failed++;
+        continue;
+      }
+
       const { outcome, messageId, sentText } = await processItem(
         item,
         account.ig_user_id,
@@ -1256,13 +1318,7 @@ export async function drainQueue(): Promise<ResumoDaDrenagem> {
         result.skipped++;
       }
     } catch (err) {
-      const permanent = err instanceof IgError && err.status >= 400 && err.status < 500;
-      const giveUp = permanent || item.attempts >= 3;
-      await finish(item.id, {
-        status: giveUp ? "failed" : "pending",
-        retryInSeconds: 120,
-        error: err instanceof Error ? err.message.slice(0, 500) : String(err),
-      });
+      await devolverOuEncerrar(item, err);
       result.failed++;
     }
   }
@@ -1341,8 +1397,9 @@ export async function drainQueue(): Promise<ResumoDaDrenagem> {
  *
  * =============================================================================
  * A FORMA É A DA VARREDURA DE LOTES VENCIDOS, logo acima, e as duas dividem o
- * mesmo cuidado: ELA NÃO TOCA EM `pending` DE MENSAGEM. O filtro por
- * `kind = 'publicacao'` é o que garante isso — devolver mensagem à disputa da
+ * mesmo cuidado: ELA NÃO TOCA EM `pending` DE MENSAGEM. O filtro pelos tipos
+ * de post (`TIPOS_DE_PUBLICACAO`, lib/fila-tipos.ts: o do Instagram e o do
+ * LinkedIn) é o que garante isso — devolver mensagem à disputa da
  * fila é a fome que a migração 009 fechou, e nada aqui pode reabri-la.
  *
  * SÓ O QUE AINDA NÃO VENCEU (`not_before > now()`): o que já está na hora sai
@@ -1360,12 +1417,12 @@ export async function armarTiquesDoDia(): Promise<{ armados: number }> {
   const linhas = (await sql().query(
     `select distinct ceil(extract(epoch from (not_before - now())))::int as secs
        from queue
-      where kind = 'publicacao' and status = 'pending'
+      where kind = any($2::text[]) and status = 'pending'
         and not_before > now()
         and not_before <= now() + make_interval(secs => $1::int)
       order by secs
       limit 200`,
-    [HORIZONTE_DO_TIQUE_EM_SEGUNDOS]
+    [HORIZONTE_DO_TIQUE_EM_SEGUNDOS, Array.from(TIPOS_DE_PUBLICACAO)]
   )) as { secs: number }[];
   if (!linhas.length) return { armados: 0 };
 
```

Em `lib/linkedin-publicacao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/linkedin-publicacao.ts b/lib/linkedin-publicacao.ts
index fd51a2f..bbb6e9d 100644
--- a/lib/linkedin-publicacao.ts
+++ b/lib/linkedin-publicacao.ts
@@ -188,3 +188,12 @@ export function desfechoDoErroDoLinkedin(status: number): DesfechoDoErroDoLinked
 export function motivoDaAutorizacaoRecusada(nome: string): string {
   return `o LinkedIn de ${nome} não aceita mais a autorização (venceu ou foi retirada); mande o convite de novo`;
 }
+
+/**
+ * DEPOIS DO POST, O POST PODE TER SAÍDO? (achado 210). O `POST /rest/posts` não tem chave contra repetição, então
+ * só uma resposta 4xx prova que o LinkedIn não criou nada. A rede (0), o 5xx e o 2xx sem o `x-restli-id` deixam a
+ * dúvida, e a linha não pode ser tentada de novo: o dono confere no LinkedIn.
+ */
+export function oPostPodeTerSaido(status: number): boolean {
+  return !(status >= 400 && status < 500);
+}
```

Em `scripts/migrar.mjs`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/scripts/migrar.mjs b/scripts/migrar.mjs
index fc83e6f..5ef0a65 100644
--- a/scripts/migrar.mjs
+++ b/scripts/migrar.mjs
@@ -826,38 +826,27 @@ const ESPERADAS_RESTRICOES = [
     // duplicada: `queue_kind_check` é UMA restrição, e o banco só tem a versão
     // mais nova dela. Uma segunda entrada com o mesmo nome faria uma das duas
     // acusar divergência para sempre, e a acusação seria mentira. Foi assim que
-    // a `008` substituiu a `004` aqui, e é assim que a `010` substitui a `008`:
-    // o `de` aponta para quem escreveu o texto que está no banco AGORA.
+    // a `008` substituiu a `004` aqui, a `010` substituiu a `008`, e é assim que
+    // a `025` substitui a `010`: o `de` aponta para quem escreveu o texto que
+    // está no banco AGORA.
     //
-    // E ELA ACEITA UMA SEGUNDA FORMA, a da entrega do LinkedIn
-    // (docs/specs/2026-11-06-linkedin-no-perfil.md, §0). A `025` (a parte 2 da
-    // entrega, a publicação; a `024` da parte 1 não toca a fila) alarga a
-    // restrição com `publicacao_linkedin` e é aplicada à mão ANTES do merge
-    // daquela parte, como a `022` e a `023`; sem `tambemAceitas`, todo deploy da
-    // `main` nessa janela morreria aqui. No merge da parte 2, a forma da `025`
-    // vira a `definicao` desta linha, e a da `010` sai. Uma terceira forma
-    // continua sendo divergência (testes-integracao/conferencia-do-kind.integracao.ts).
-    // Os dois textos são os do `pg_get_constraintdef`, o segundo medido no banco
-    // de teste em 06/11/2026.
+    // A `025` É A PARTE 2a DA ENTREGA DO LINKEDIN
+    // (docs/specs/2026-11-06-linkedin-no-perfil.md, §0 e §6): alarga a restrição
+    // com `publicacao_linkedin`, e foi aplicada à mão ANTES do merge da parte 2a,
+    // como a `022`, a `023` e a `024`. Na janela entre a aplicação e o merge, a
+    // `main` aceitava também a forma da `010`, por um `tambemAceitas` que saiu com
+    // o merge: daqui em diante a forma da `010` é divergência, como qualquer outra
+    // (testes-integracao/conferencia-do-kind.integracao.ts). O texto é o do
+    // `pg_get_constraintdef`, medido no banco de teste em 06/11/2026.
     tabela: "queue",
     nome: "queue_kind_check",
-    de: "010-fila-publicacao.sql",
+    de: "025-fila-linkedin.sql",
     definicao:
       "CHECK ((kind = ANY (ARRAY['private_reply'::text, 'comment_reply'::text, " +
       "'dm_welcome'::text, 'dm_link'::text, 'dm_reminder'::text, " +
       "'dm_follow_gate'::text, 'dm_email_ask'::text, 'story_reaction'::text, " +
-      "'dm_manual'::text, 'dm_lote'::text, 'publicacao'::text])))",
-    tambemAceitas: [
-      {
-        de: "025 (a fila do LinkedIn, parte 2 da entrega, aplicada à mão antes do merge dela)",
-        definicao:
-          "CHECK ((kind = ANY (ARRAY['private_reply'::text, 'comment_reply'::text, " +
-          "'dm_welcome'::text, 'dm_link'::text, 'dm_reminder'::text, " +
-          "'dm_follow_gate'::text, 'dm_email_ask'::text, 'story_reaction'::text, " +
-          "'dm_manual'::text, 'dm_lote'::text, 'publicacao'::text, " +
-          "'publicacao_linkedin'::text])))",
-      },
-    ],
+      "'dm_manual'::text, 'dm_lote'::text, 'publicacao'::text, " +
+      "'publicacao_linkedin'::text])))",
   },
   {
     // A GÊMEA DA LINHA ACIMA, na coluna vizinha da mesma tabela. Ela está aqui
```

Em `lib/esquema.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/esquema.ts b/lib/esquema.ts
index 34259ce..8ce3448 100644
--- a/lib/esquema.ts
+++ b/lib/esquema.ts
@@ -307,6 +307,14 @@ const MARCA_DAGUA = {
       porque:
         "tabela e colunas de FEATURE (linkedin_conexoes; convites_de_conexao.rede e conta_alvo): a partida do painel não depende delas, de propósito",
     },
+    {
+      de: "025-fila-linkedin.sql",
+      // A QUARTA DA FAMÍLIA DA 004, DA 008 E DA 010: alarga o `queue_kind_check` com o `publicacao_linkedin`
+      // (docs/specs/2026-11-06-linkedin-no-perfil.md, §6). Do lado ALTO, como elas: um banco sem a 025 RECUSA a
+      // linha do LinkedIn, e quem confere o texto inteiro da restrição é o `scripts/migrar.mjs`
+      // (testes-integracao/conferencia-do-kind.integracao.ts).
+      porque: "reescreve a definição de um `check` que já existe (11 tipos -> 12)",
+    },
   ],
   // AS TABELAS QUE NASCEM DEPOIS DA BASE E QUE A PARTIDA EXIGE. A primeira é a dos logins (a 022,
   // docs/specs/2026-11-04-logins.md): ao contrário das tabelas de feature de `naoObservaveis`, sem
```

Em `app/labels.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/labels.ts b/app/labels.ts
index abffdc4..06373fe 100644
--- a/app/labels.ts
+++ b/app/labels.ts
@@ -292,6 +292,8 @@ const KIND: Record<QueueItem["kind"], string> = {
   // para um post ela erraria duas vezes: sugere destinatário onde não há um, e
   // esconde a única coisa da fila que fica pública para sempre.
   publicacao: "Publicação no Instagram",
+  // O POST NO PERFIL PESSOAL DO LINKEDIN (migrations/025-fila-linkedin.sql), pelo mesmo motivo da de cima.
+  publicacao_linkedin: "Publicação no LinkedIn",
 };
 
 // Kind sem rótulo devolve algo legível, e nunca o nome interno — como
```

O `tambemAceitas` sai da linha do `queue_kind_check` no `scripts/migrar.mjs`: a forma da 025 vira a única, e a da 010 passa a divergir. É por isso que a 025 é aplicada à mão ANTES do merge (FASE 8): o build da `main` nova confere a forma da 025.

- [ ] **Passo 4: rodar e ver passar**

```bash
env -u CLAUDECODE -u AI_AGENT npx --no-install vitest run
node --check scripts/migrar.mjs
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" \
  npx --no-install vitest run --config vitest.integracao.config.ts \
  testes-integracao/linkedin-publicacao.integracao.ts testes-integracao/conferencia-do-kind.integracao.ts \
  testes-integracao/dreno-tipo-desconhecido.integracao.ts testes-integracao/publicacao.integracao.ts \
  testes-integracao/tique-do-rodape.integracao.ts testes-integracao/esquema-de-partida.integracao.ts \
  testes-integracao/registro-de-migracoes.integracao.ts
npx --no-install tsc --noEmit
npx --no-install eslint lib/fila-tipos.ts lib/linkedin-fila.ts lib/queue-drain.ts lib/linkedin-publicacao.ts \
  scripts/migrar.mjs lib/esquema.ts app/labels.ts testes-integracao/linkedin-publicacao.integracao.ts \
  testes-integracao/conferencia-do-kind.integracao.ts tests/fila-tipos.test.ts tests/linkedin-post.test.ts \
  tests/linkedin-token-fora-do-cliente.test.ts
```

Esperado: nos puros, "Test Files 152 passed (152)" e "Tests 3678 passed (3678)"; na integração, `ALVO: banco de TESTE`, "Test Files 7 passed (7)" e "Tests 77 passed (77)", e o `tsc` e o lint sem saída.

- [ ] **Passo 5: o commit**

A mensagem do commit, gravada em `$SCRATCH/msg-li2-f2.txt`:

```text
O post do LinkedIn entra na fila e sai pelo dreno, sem nunca sair duas vezes, e o publicar agora drena só a própria linha
```

```bash
git add -- migrations/025-fila-linkedin.sql lib/fila-tipos.ts lib/linkedin-fila.ts lib/queue-drain.ts \
  lib/linkedin-publicacao.ts scripts/migrar.mjs lib/esquema.ts app/labels.ts \
  testes-integracao/linkedin-publicacao.integracao.ts testes-integracao/conferencia-do-kind.integracao.ts \
  tests/fila-tipos.test.ts tests/linkedin-post.test.ts tests/linkedin-token-fora-do-cliente.test.ts
git commit -F "$SCRATCH/msg-li2-f2.txt"
```

---

### FASE 3 — O orçamento de tempo e o tique do "agora"

**Arquivos:** `lib/linkedin-fila.ts`, `lib/linkedin.ts`, `lib/queue-drain.ts`, `app/api/queue/tick/route.ts`, `app/api/webhook/route.ts`, `app/api/cron/daily/route.ts`, `testes-integracao/linkedin-publicacao.integracao.ts`, `testes-integracao/tique-do-rodape.integracao.ts`, `tests/dreno-com-prazo.test.ts` (novo), `tests/linkedin-rest.test.ts`.

- [ ] **Passo 1: os testes**

Em `testes-integracao/linkedin-publicacao.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/linkedin-publicacao.integracao.ts b/testes-integracao/linkedin-publicacao.integracao.ts
index ddaba50..fc83445 100644
--- a/testes-integracao/linkedin-publicacao.integracao.ts
+++ b/testes-integracao/linkedin-publicacao.integracao.ts
@@ -40,8 +40,10 @@ const linkedin = {
   segurarOPost: null as null | Promise<void>,
   statusDaReserva: 200,
   desconhecidos: [] as string[],
+  /** Chamado quando o PUT da imagem chega: é como o caso faz o relógio andar durante o envio. */
+  aoEnviar: null as null | (() => void),
 };
-const bucket = { apagados: [] as string[] };
+const bucket = { apagados: [] as string[], baixados: [] as string[] };
 
 let servidorLinkedin: Server;
 let servidorBucket: Server;
@@ -80,6 +82,7 @@ beforeAll(async () => {
     }
     if (req.method === "PUT" && u.pathname === "/envio/C4E10AQ") {
       linkedin.envios.push(corpo);
+      linkedin.aoEnviar?.();
       return responder(res, 201, "");
     }
     if (req.method === "POST" && u.pathname === "/rest/posts") {
@@ -100,6 +103,7 @@ beforeAll(async () => {
     const publico = `/storage/v1/object/public/${BUCKET}/`;
     const privado = `/storage/v1/object/${BUCKET}/`;
     if (req.method === "GET" && u.pathname.startsWith(publico)) {
+      bucket.baixados.push(decodeURIComponent(u.pathname.slice(publico.length)));
       res.writeHead(200, { "content-type": "image/jpeg" });
       return res.end(BYTES_DA_IMAGEM);
     }
@@ -165,8 +169,10 @@ beforeEach(async () => {
     segurarOPost: null,
     statusDaReserva: 200,
     desconhecidos: [],
+    aoEnviar: null,
   });
   bucket.apagados = [];
+  bucket.baixados = [];
   await q(`delete from queue`);
   await q(`delete from linkedin_conexoes`);
   await conectar();
@@ -393,6 +399,89 @@ describe("os erros do LinkedIn no dreno", () => {
   });
 });
 
+// O ORÇAMENTO DE TEMPO DA FUNÇÃO (nota da auditoria sobre a F2): as funções que drenam têm 60 s, e um passo que não
+// cabe no que resta não começa. Morta no meio, a linha ficaria em 'sending'; depois da marca, viraria "pode ter
+// saído". O começo da função entra pelo `inicioDaFuncaoMs`, aqui posto no passado para sobrar pouco.
+describe("o post do LinkedIn não começa o que a função não tem tempo de terminar", () => {
+  const restando = (ms: number) => Date.now() - (dreno.ORCAMENTO_DA_FUNCAO_MS - ms);
+  const linhaCompleta = async () =>
+    (await q(`select status, attempts, error, payload, not_before > now() as adiado from queue where kind = 'publicacao_linkedin'`))[0];
+
+  it("só texto, com 5 s restando: não chama o LinkedIn, volta pending e não gasta a tentativa", async () => {
+    await enfileirarTexto();
+    const resumo = await dreno.drainQueue({ inicioDaFuncaoMs: restando(5_000) });
+    expect(resumo.aguardando).toBe(1);
+    expect(linkedin.pedidos).toEqual([]);
+    const linha = await linhaCompleta();
+    expect(linha).toMatchObject({ status: "pending", attempts: 0, adiado: true });
+    expect(String(linha.error)).toContain("não bastava");
+    expect((linha.payload as Record<string, unknown>).post_tentado_em ?? null).toBeNull();
+  });
+
+  it("imagem, com 25 s restando: não baixa, não reserva e volta pending", async () => {
+    await enfileirarImagem();
+    await dreno.drainQueue({ inicioDaFuncaoMs: restando(25_000) });
+    expect(bucket.baixados).toEqual([]);
+    expect(linkedin.pedidos).toEqual([]);
+    expect(await linhaCompleta()).toMatchObject({ status: "pending", attempts: 0 });
+  });
+
+  it("imagem já enviada, com 25 s restando: só o post falta, e ele sai", async () => {
+    await enfileirarImagem();
+    await q(`update queue set payload = payload || '{"imagem_urn":"urn:li:image:JaEnviada"}'::jsonb where kind = 'publicacao_linkedin'`);
+    await dreno.drainQueue({ inicioDaFuncaoMs: restando(25_000) });
+    expect(bucket.baixados).toEqual([]);
+    expect(linkedin.pedidos.map((p) => p.caminho)).toEqual(["/rest/posts"]);
+    expect(linkedin.posts[0]).toMatchObject({ content: { media: { id: "urn:li:image:JaEnviada" } } });
+    expect((await linhaCompleta()).status).toBe("sent");
+  });
+
+  it("a imagem que termina perto do fim para antes da marca; a passada seguinte só publica", async () => {
+    // O RELÓGIO ANDA 27 S DURANTE O ENVIO: começa com 41 s restando (passa a conferência da imagem, de 40 s) e
+    // termina com ~14 s (não passa a do post, de 15 s). Só o `Date.now` deste processo anda; o banco não.
+    const real = Date.now.bind(Date);
+    let deslocamento = 0;
+    const espiao = vi.spyOn(Date, "now").mockImplementation(() => real() + deslocamento);
+    linkedin.aoEnviar = () => {
+      deslocamento += 27_000;
+    };
+    try {
+      await enfileirarImagem();
+      await dreno.drainQueue({ inicioDaFuncaoMs: restando(41_000) });
+    } finally {
+      espiao.mockRestore();
+    }
+    expect(linkedin.envios).toHaveLength(1);
+    expect(linkedin.pedidos.some((p) => p.caminho === "/rest/posts")).toBe(false);
+    const linha = await linhaCompleta();
+    expect(linha).toMatchObject({ status: "pending", attempts: 0 });
+    expect((linha.payload as Record<string, unknown>).imagem_urn).toBe("urn:li:image:C4E10AQFalsa");
+    expect((linha.payload as Record<string, unknown>).post_tentado_em ?? null).toBeNull();
+
+    await q(`update queue set not_before = now() - interval '1 minute'`);
+    await dreno.drainQueue({ inicioDaFuncaoMs: restando(45_000) });
+    expect(linkedin.envios).toHaveLength(1);
+    expect(bucket.baixados).toHaveLength(1);
+    expect(linkedin.posts).toHaveLength(1);
+    expect((await linhaCompleta()).status).toBe("sent");
+  });
+
+  it("com tempo de sobra, a imagem sai inteira numa passada só", async () => {
+    await enfileirarImagem();
+    await dreno.drainQueue({ inicioDaFuncaoMs: restando(45_000) });
+    expect(bucket.baixados).toEqual([`${CONTA}/foto.jpg`]);
+    expect((await linhaCompleta()).status).toBe("sent");
+  });
+
+  it("o \"agora\" com 5 s restando devolve aguardando, sem chamar o LinkedIn", async () => {
+    await enfileirarTexto();
+    const id = String((await linhaDoLinkedin()).id);
+    expect(await dreno.drenarUmaPublicacaoDoLinkedin(id, restando(5_000))).toBe("aguardando");
+    expect(linkedin.pedidos).toEqual([]);
+    expect(await linhaCompleta()).toMatchObject({ status: "pending", attempts: 0 });
+  });
+});
+
 describe("o \"agora\" drena só a própria linha (achado 211)", () => {
   it("publica a linha pedida e não toca nas outras vencidas, de mensagem e de post do Instagram", async () => {
     await q(
```

Em `testes-integracao/tique-do-rodape.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/tique-do-rodape.integracao.ts b/testes-integracao/tique-do-rodape.integracao.ts
index 2bc7c14..971c9b9 100644
--- a/testes-integracao/tique-do-rodape.integracao.ts
+++ b/testes-integracao/tique-do-rodape.integracao.ts
@@ -707,3 +707,59 @@ describe("o tique das mensagens com espera", () => {
     expect(segundosDoTique(0)).toBe(UM_DIA_EM_SEGUNDOS);
   });
 });
+
+// O "AGORA" DO LINKEDIN NÃO TEM RODAPÉ (nota da auditoria sobre o F2-bis da parte 2a). `drenarUmaPublicacaoDoLinkedin`
+// drena uma linha só, e não passa pelo rodapé do `drainQueue`, que é quem arma o próximo tique. Quando ele devolve
+// a linha à fila (pela falta de tempo, em ~20 s, ou por um erro passageiro, em 120 s), ele mesmo pede o tique
+// dela. Sem isso, o post esperaria o próximo webhook ou o cron do dia seguinte.
+//
+// NADA AQUI FALA COM O LINKEDIN NEM COM O BUCKET DE VERDADE: a base do LinkedIn e a SUPABASE_URL vão para a Meta
+// falsa deste arquivo, que responde 500 a tudo.
+describe("o \"agora\" do LinkedIn que devolve a linha à fila pede o tique dela", () => {
+  beforeAll(() => {
+    process.env.LINKEDIN_API_BASE = process.env.IG_GRAPH_BASE;
+  });
+  afterAll(() => {
+    delete process.env.LINKEDIN_API_BASE;
+  });
+
+  async function linhaDoLinkedin(payload: Record<string, unknown>): Promise<string> {
+    const [linha] = (await banco
+      .db()
+      .sql()
+      .query(
+        `insert into queue (account_id, kind, payload, dedupe_key) values ($1, 'publicacao_linkedin', $2, $3) returning id`,
+        [CONTA, payload, `pub-linkedin:${CONTA}:tique:${Math.random()}`]
+      )) as { id: string }[];
+    return linha.id;
+  }
+
+  test("sem tempo para o post, a linha volta em ~20 s, e o tique é pedido para ela", async () => {
+    const id = await linhaDoLinkedin({ forma: "texto", caminhos: [], texto: "Olá" });
+    const desfecho = await dreno.drenarUmaPublicacaoDoLinkedin(id, Date.now() - (dreno.ORCAMENTO_DA_FUNCAO_MS - 5_000));
+    expect(desfecho).toBe("aguardando");
+    expect(publicados.length).toBe(1);
+    expect(segundosDoTique(0)).toBeGreaterThanOrEqual(20);
+    expect(segundosDoTique(0)).toBeLessThanOrEqual(30);
+  });
+
+  test("com um erro passageiro, a linha volta em 120 s, e o tique é pedido para ela", async () => {
+    await banco
+      .db()
+      .sql()
+      .query(
+        `insert into linkedin_conexoes (account_id, pessoa_id, nome, access_token, expira_em)
+         values ($1, 'pessoaDoTique', 'Pessoa do Tique', 'autorizacao-inventada-que-nao-vale-nada', now() + interval '30 days')
+         on conflict (account_id) do nothing`,
+        [CONTA]
+      );
+    const id = await linhaDoLinkedin({ forma: "imagem", caminhos: [`${CONTA}/foto-do-tique.jpg`], texto: "Com foto" });
+    const desfecho = await dreno.drenarUmaPublicacaoDoLinkedin(id);
+    expect(desfecho).toBe("aguardando");
+    const [linha] = (await banco.db().sql().query(`select status from queue where id = $1`, [id])) as { status: string }[];
+    expect(linha.status).toBe("pending");
+    expect(publicados.length).toBe(1);
+    expect(segundosDoTique(0)).toBeGreaterThanOrEqual(120);
+    expect(segundosDoTique(0)).toBeLessThanOrEqual(130);
+  });
+});
```

Crie `tests/dreno-com-prazo.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// AS ROTAS QUE DRENAM A FILA PASSAM O COMEÇO DA FUNÇÃO (nota da auditoria sobre a F2 da parte 2a do LinkedIn).
//
// O post do LinkedIn não pode começar um passo que a função não tem tempo de terminar: morta no meio, a linha fica
// em 'sending' e, depois da marca do POST, vira "pode ter saído". O ramo confere o tempo que resta
// (lib/linkedin-fila.ts) a partir do começo da FUNÇÃO, e não do começo do dreno. Nas três rotas abaixo, o dreno
// vem depois de outro trabalho (o cron arma os tiques do dia antes; o webhook trata a mensagem antes), então
// cada uma marca a hora na primeira linha do handler e a entrega ao `drainQueue`.

const RAIZ = process.cwd();
const ROTAS = ["app/api/queue/tick/route.ts", "app/api/webhook/route.ts", "app/api/cron/daily/route.ts"];

describe("as rotas que drenam passam o começo da função ao dreno", () => {
  for (const rota of ROTAS) {
    it(rota, () => {
      const fonte = readFileSync(join(RAIZ, rota), "utf8");
      // O handler que drena: o último `export async function` antes da chamada (o webhook tem também o GET da
      // verificação, que não drena).
      const chamada = fonte.indexOf("drainQueue(");
      expect(chamada).toBeGreaterThan(-1);
      const handler = fonte.lastIndexOf("export async function", chamada);
      expect(handler).toBeGreaterThan(-1);
      const corpo = fonte.slice(fonte.indexOf("{", fonte.indexOf(")", handler)) + 1);
      // A hora é a primeira coisa do handler: antes de qualquer `await`.
      expect(corpo.trimStart().startsWith("const inicioDaFuncaoMs = Date.now();")).toBe(true);
      expect(fonte).toMatch(/drainQueue\(\{\s*inicioDaFuncaoMs\s*\}\)/);
      expect(fonte).not.toMatch(/drainQueue\(\)/);
    });
  }
});
```

Em `tests/linkedin-rest.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/linkedin-rest.test.ts b/tests/linkedin-rest.test.ts
index 194eeb4..b8cb77b 100644
--- a/tests/linkedin-rest.test.ts
+++ b/tests/linkedin-rest.test.ts
@@ -1,5 +1,13 @@
 import { afterEach, describe, expect, it, vi } from "vitest";
-import { enderecoDeEnvioConfiavel, LINKEDIN_VERSION, nomeLimpo } from "@/lib/linkedin";
+import {
+  criarPost,
+  enderecoDeEnvioConfiavel,
+  enviarImagem,
+  LINKEDIN_VERSION,
+  nomeLimpo,
+  TETO_DO_ENVIO_DA_IMAGEM_MS,
+  TETO_DO_LINKEDIN_MS,
+} from "@/lib/linkedin";
 import { chaveDaPublicacaoNoLinkedin, publicacaoKey } from "@/lib/dedupe";
 
 // O QUE É PURO NAS CHAMADAS DE PUBLICAR NO LINKEDIN (docs/specs/2026-11-06-linkedin-no-perfil.md, §4 e §6; a
@@ -8,6 +16,40 @@ import { chaveDaPublicacaoNoLinkedin, publicacaoKey } from "@/lib/dedupe";
 
 afterEach(() => {
   vi.unstubAllEnvs();
+  vi.unstubAllGlobals();
+  vi.restoreAllMocks();
+});
+
+// O TETO DE TEMPO DE CADA CHAMADA (notas da auditoria sobre a F2): o envio da imagem leva até 8 MB e tem teto
+// próprio, de 15 s (~4,3 Mbit/s); as outras chamadas ficam nos 10 s. A soma do ramo da imagem (o bucket, a reserva,
+// o envio e o post) cabe nos 60 s da função com folga, e o ramo confere o tempo que resta antes de começar
+// (lib/linkedin-fila.ts). Os casos trocam o `fetch` por um que responde na hora e leem o teto que cada chamada
+// pediu ao `AbortSignal.timeout`.
+describe("o teto de tempo das chamadas de publicar", () => {
+  function medirOsTetos(resposta: () => Response) {
+    const tetos: number[] = [];
+    const original = AbortSignal.timeout.bind(AbortSignal);
+    vi.spyOn(AbortSignal, "timeout").mockImplementation((ms: number) => {
+      tetos.push(ms);
+      return original(ms);
+    });
+    vi.stubGlobal("fetch", async () => resposta());
+    return tetos;
+  }
+
+  it("o envio da imagem tem 15 s", async () => {
+    expect(TETO_DO_ENVIO_DA_IMAGEM_MS).toBe(15_000);
+    const tetos = medirOsTetos(() => new Response("", { status: 201 }));
+    await enviarImagem("https://www.linkedin.com/dms-uploads/C4E10AQ/x", "token-de-teste", new ArrayBuffer(4), "image/jpeg");
+    expect(tetos).toEqual([TETO_DO_ENVIO_DA_IMAGEM_MS]);
+  });
+
+  it("o post continua com os 10 s de toda chamada", async () => {
+    const tetos = medirOsTetos(() => new Response("", { status: 201, headers: { "x-restli-id": "urn:li:share:1" } }));
+    await criarPost("token-de-teste", { author: "urn:li:person:x" });
+    expect(tetos).toEqual([TETO_DO_LINKEDIN_MS]);
+    expect(TETO_DO_LINKEDIN_MS).toBe(10_000);
+  });
 });
 
 describe("a versão da API do LinkedIn", () => {
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
env -u CLAUDECODE -u AI_AGENT npx --no-install vitest run tests/linkedin-rest.test.ts tests/dreno-com-prazo.test.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" \
  npx --no-install vitest run --config vitest.integracao.config.ts \
  testes-integracao/linkedin-publicacao.integracao.ts testes-integracao/tique-do-rodape.integracao.ts
```

Esperado: 
- nos puros, "Tests 4 failed | 8 passed (12)": as três rotas de `tests/dreno-com-prazo.test.ts` e "o envio da imagem tem 15 s";
- na integração, `ALVO: banco de TESTE` e "Tests 6 failed | 37 passed (43)": "só texto, com 5 s restando: não chama o LinkedIn, volta pending e não gasta a tentativa", "imagem, com 25 s restando: não baixa, não reserva e volta pending", "a imagem que termina perto do fim para antes da marca; a passada seguinte só publica", "o "agora" com 5 s restando devolve aguardando, sem chamar o LinkedIn", e os dois do tique ("sem tempo para o post, a linha volta em ~20 s, e o tique é pedido para ela" e "com um erro passageiro, a linha volta em 120 s, e o tique é pedido para ela"). Os dois de controle do orçamento passam: a imagem já enviada e a imagem com tempo de sobra.

- [ ] **Passo 3: o código**

Em `lib/linkedin.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/linkedin.ts b/lib/linkedin.ts
index 862e736..55c683b 100644
--- a/lib/linkedin.ts
+++ b/lib/linkedin.ts
@@ -19,6 +19,13 @@ export const CAMINHO_DA_VOLTA_DO_LINKEDIN = "/api/oauth/linkedin/callback";
 /** O teto de tempo de cada chamada ao LinkedIn, como o da Graph (lib/ig.ts): para ela terminar algum dia. */
 export const TETO_DO_LINKEDIN_MS = 10_000;
 
+/**
+ * O teto do envio da imagem, que leva até 8 MB (~4,3 Mbit/s em 15 s). A soma do ramo da imagem (o bucket, a
+ * reserva, este envio e o post) cabe nos 60 s da função com folga, e o ramo confere o tempo que resta antes de
+ * começar (lib/linkedin-fila.ts). tests/linkedin-rest.test.ts mede o teto que cada chamada pede.
+ */
+export const TETO_DO_ENVIO_DA_IMAGEM_MS = 15_000;
+
 // AS BASES SÓ SE MOVEM NOS TESTES, sob as mesmas duas travas da `baseDoGraph` (lib/ig.ts): `VITEST=true`, que
 // `next build` e a Vercel não definem, e o loopback, e só ele (a autorização viaja nestas chamadas, e uma base
 // apontando para fora seria vazar a autorização por variável de ambiente). As duas bases vão juntas para o
@@ -91,16 +98,17 @@ export class LinkedinError extends Error {
 
 async function chamar(
   url: string,
-  init: RequestInit
+  init: RequestInit,
+  tetoMs: number = TETO_DO_LINKEDIN_MS
 ): Promise<{ status: number; texto: string; restliId: string | null }> {
   try {
-    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TETO_DO_LINKEDIN_MS) });
+    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(tetoMs) });
     return { status: res.status, texto: await res.text(), restliId: res.headers.get("x-restli-id") };
   } catch (err) {
     // O endereço vai sem a query: nenhuma destas chamadas leva segredo nela, e assim continua.
     const onde = url.split("?")[0];
     if (err instanceof Error && err.name === "TimeoutError") {
-      throw new LinkedinError(0, `${onde} não respondeu em ${TETO_DO_LINKEDIN_MS}ms`);
+      throw new LinkedinError(0, `${onde} não respondeu em ${tetoMs}ms`);
     }
     throw new LinkedinError(0, `${onde} falhou na rede`);
   }
@@ -229,11 +237,11 @@ export async function enviarImagem(uploadUrl: string, token: string, bytes: Arra
   if (!enderecoDeEnvioConfiavel(uploadUrl)) {
     throw new LinkedinError(0, "o endereço de envio da imagem não é do LinkedIn");
   }
-  const r = await chamar(uploadUrl, {
-    method: "PUT",
-    headers: { authorization: `Bearer ${token}`, "content-type": mime },
-    body: bytes,
-  });
+  const r = await chamar(
+    uploadUrl,
+    { method: "PUT", headers: { authorization: `Bearer ${token}`, "content-type": mime }, body: bytes },
+    TETO_DO_ENVIO_DA_IMAGEM_MS
+  );
   if (r.status !== 200 && r.status !== 201) throw new LinkedinError(r.status, r.texto.slice(0, 300));
 }
 
```

Em `lib/linkedin-fila.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/linkedin-fila.ts b/lib/linkedin-fila.ts
index 69735b3..9456b25 100644
--- a/lib/linkedin-fila.ts
+++ b/lib/linkedin-fila.ts
@@ -6,7 +6,14 @@ import { atrasoDoTiqueDaPublicacao } from "./publicacao";
 import { chaveDaPublicacaoNoLinkedin } from "./dedupe";
 import { urlPublicaDoObjeto } from "./bucket";
 import { conexaoDaConta } from "./linkedin-conexoes";
-import { criarPost, enviarImagem, LinkedinError, reservarImagem } from "./linkedin";
+import {
+  criarPost,
+  enviarImagem,
+  LinkedinError,
+  reservarImagem,
+  TETO_DO_ENVIO_DA_IMAGEM_MS,
+  TETO_DO_LINKEDIN_MS,
+} from "./linkedin";
 import {
   corpoDoPost,
   desfechoDoErroDoLinkedin,
@@ -82,17 +89,45 @@ export type DependenciasDoDreno = {
   finish: (id: string, campos: { status: string; sent_at?: Date; error?: string }) => Promise<void>;
   guardarNoPayload: (id: string, campos: Record<string, unknown>) => Promise<void>;
   limparOBucket: (item: { id: string }, caminhos: string[], igUserId: string) => Promise<void>;
+  /** A hora (epoch, ms) até a qual a função pode trabalhar; depois dela, a Vercel pode matá-la. */
+  prazoMs: number;
 };
 
-export type DesfechoDoPostNoLinkedin = "publicado" | "falhou";
+export type DesfechoDoPostNoLinkedin = "publicado" | "aguardando" | "falhou";
 
 export const MOTIVO_DO_PAYLOAD_TORTO = "o payload deste item não é de um post do LinkedIn";
 export const MOTIVO_SEM_CONEXAO = "esta conta não tem LinkedIn conectado";
 export const MOTIVO_PODE_TER_SAIDO =
   "o post pode ter saído no LinkedIn sem a confirmação chegar; confira no seu LinkedIn antes de publicar de novo";
+export const MOTIVO_SEM_TEMPO = "o tempo desta passada não bastava para o post sair inteiro; ele sai na próxima";
 
 /** O teto do download da imagem do bucket. Sem ele, um bucket que não responde seguraria o dreno inteiro. */
-const TETO_DO_BUCKET_MS = 20_000;
+const TETO_DO_BUCKET_MS = 10_000;
+
+// O ORÇAMENTO DE TEMPO DO RAMO (notas da auditoria sobre a F2). As funções que drenam têm 60 s, e a Vercel mata a
+// que passa disso. Morta no meio, a linha fica em 'sending' e, depois da marca do POST, vira "pode ter saído":
+// nenhum dos dois duplica, mas os dois fazem o post falhar sem precisar. Então cada passo só começa se o que resta
+// do prazo cobre o pior caso dele (a soma dos tetos), com folga. A soma do ramo inteiro é 45 s.
+const FOLGA_MS = 5_000;
+/** O bucket, a reserva e o envio, com a folga: 40 s. */
+const TEMPO_PARA_A_IMAGEM_MS = TETO_DO_BUCKET_MS + TETO_DO_LINKEDIN_MS + TETO_DO_ENVIO_DA_IMAGEM_MS + FOLGA_MS;
+/** O POST, com a folga: 15 s. */
+const TEMPO_PARA_O_POST_MS = TETO_DO_LINKEDIN_MS + FOLGA_MS;
+/** Quando falta tempo, a linha volta para daqui a pouco: a próxima passada é outra função, com o prazo inteiro. */
+const VOLTA_SEM_TEMPO_EM_SEGUNDOS = 20;
+
+/**
+ * A LINHA VOLTA À FILA SEM GASTAR A TENTATIVA: a reivindicação contou uma, e nada foi tentado. Sem o desconto,
+ * três passadas sem tempo levariam o primeiro erro passageiro a encerrar a linha.
+ */
+async function devolverSemGastarTentativa(id: string): Promise<void> {
+  await sql().query(
+    `update queue set status = 'pending', attempts = greatest(attempts - 1, 0),
+            not_before = now() + make_interval(secs => $2::int), error = $3
+      where id = $1`,
+    [id, VOLTA_SEM_TEMPO_EM_SEGUNDOS, MOTIVO_SEM_TEMPO]
+  );
+}
 
 /**
  * Os bytes da imagem, pelo endereço público do bucket (o mesmo do `copiarParaAFila`, lib/bonus/publicar-bucket.ts).
@@ -128,7 +163,9 @@ async function tirarAMarcaDoPost(id: string): Promise<void> {
  *   1. com o `post_urn`, o post já saiu: a linha fecha `sent` sem publicar de novo;
  *   2. com o `post_tentado_em` e sem o `post_urn`, um POST anterior ficou sem resposta (a função caiu, o banco
  *      falhou): a linha vai a `failed` dizendo para conferir no LinkedIn, e NÃO publica (achado 210);
- *   3. sem conexão, ou com ela vencida, a linha vai a `failed` com o motivo, sem chamar o LinkedIn;
+ *   3. sem tempo para o passo seguinte, a linha volta à fila sem gastar a tentativa (o orçamento, acima); a
+ *      conferência se repete antes da marca;
+ *   3a. sem conexão, ou com ela vencida, a linha vai a `failed` com o motivo, sem chamar o LinkedIn;
  *   4. a imagem: baixa do bucket, reserva com a pessoa dona, envia, e grava o `imagem_urn`. Numa passada seguinte,
  *      ela não sobe de novo;
  *   5. o `post_tentado_em` é gravado ANTES do POST, e o `post_urn` logo depois;
@@ -155,6 +192,14 @@ export async function publicarNoLinkedinDaFila(item: QueueItem, deps: Dependenci
     return "falhou";
   }
 
+  // O TEMPO, ANTES DE QUALQUER CHAMADA: a imagem que ainda não subiu precisa do bucket, da reserva e do envio; o
+  // resto, só do post.
+  const precisa = pub.forma === "imagem" && !pub.imagemUrn ? TEMPO_PARA_A_IMAGEM_MS : TEMPO_PARA_O_POST_MS;
+  if (deps.prazoMs - Date.now() < precisa) {
+    await devolverSemGastarTentativa(item.id);
+    return "aguardando";
+  }
+
   const conexao = conta ? await conexaoDaConta(conta) : null;
   if (!conexao) {
     await deps.finish(item.id, { status: "failed", error: MOTIVO_SEM_CONEXAO });
@@ -182,6 +227,13 @@ export async function publicarNoLinkedinDaFila(item: QueueItem, deps: Dependenci
     await deps.guardarNoPayload(item.id, { imagem_urn: imagemUrn });
   }
 
+  // O TEMPO DE NOVO, depois da imagem: o passo que pode duplicar nunca começa perto do fim da função. O
+  // `imagem_urn` já está gravado, e a passada seguinte só publica.
+  if (deps.prazoMs - Date.now() < TEMPO_PARA_O_POST_MS) {
+    await devolverSemGastarTentativa(item.id);
+    return "aguardando";
+  }
+
   // A MARCA ANTES DO POST (achado 210): uma resposta perdida daqui em diante não vira um segundo post.
   await deps.guardarNoPayload(item.id, { post_tentado_em: new Date().toISOString() });
   let postUrn: string;
```

Em `lib/queue-drain.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/queue-drain.ts b/lib/queue-drain.ts
index 153316e..e1a6066 100644
--- a/lib/queue-drain.ts
+++ b/lib/queue-drain.ts
@@ -979,18 +979,30 @@ export async function cancelarLotesVencidos(): Promise<{ vencidos: number }> {
  * É o `catch` do `drainQueue`, tirado para uma função quando o "agora" do LinkedIn
  * (`drenarUmaPublicacaoDoLinkedin`, logo abaixo) passou a precisar do mesmo desfecho.
  */
-async function devolverOuEncerrar(item: QueueItem, err: unknown): Promise<void> {
+async function devolverOuEncerrar(item: QueueItem, err: unknown): Promise<"pending" | "failed"> {
   const permanent = err instanceof IgError && err.status >= 400 && err.status < 500;
   const giveUp = permanent || item.attempts >= 3;
+  const status = giveUp ? "failed" : "pending";
   await finish(item.id, {
-    status: giveUp ? "failed" : "pending",
+    status,
     retryInSeconds: 120,
     error: err instanceof Error ? err.message.slice(0, 500) : String(err),
   });
+  return status;
 }
 
-/** O que o post do LinkedIn usa do dreno (lib/linkedin-fila.ts). */
-const DEPENDENCIAS_DO_LINKEDIN: DependenciasDoDreno = { finish, guardarNoPayload, limparOBucket };
+/**
+ * O ORÇAMENTO DE TEMPO DE UMA FUNÇÃO QUE DRENA: as rotas que drenam têm `maxDuration` 60 (o tique, o webhook e o
+ * cron), e os 5 s que faltam são a folga. É contado do COMEÇO DA FUNÇÃO (`inicioDaFuncaoMs`), que as três rotas
+ * passam (tests/dreno-com-prazo.test.ts); sem ele, conta da hora em que o dreno começou. Hoje só o post do
+ * LinkedIn o lê (lib/linkedin-fila.ts), para não começar um passo que a função não tem tempo de terminar.
+ */
+export const ORCAMENTO_DA_FUNCAO_MS = 55_000;
+
+/** O que o post do LinkedIn usa do dreno (lib/linkedin-fila.ts), com o prazo desta função. */
+function dependenciasDoLinkedin(inicioDaFuncaoMs: number): DependenciasDoDreno {
+  return { finish, guardarNoPayload, limparOBucket, prazoMs: inicioDaFuncaoMs + ORCAMENTO_DA_FUNCAO_MS };
+}
 
 const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 
@@ -1003,9 +1015,17 @@ const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  * do LinkedIn, `pending` e já valer. Com o dreno geral rodando ao mesmo tempo, só um dos dois a pega: o `update`
  * espera a trava do outro e confere o `where` de novo, e aí a linha já é `sending`.
  *
- * Devolve o desfecho, ou null quando não pegou nada (id torto, outro tipo, agendada, ou já pega).
+ * ELA NÃO TEM O RODAPÉ DO `drainQueue`, que é quem arma o próximo tique. Quando a linha volta à fila (sem tempo, ou
+ * por um erro passageiro), esta função mesma pede o tique dela; sem isso, o post esperaria o próximo webhook ou o
+ * cron do dia seguinte (testes-integracao/tique-do-rodape.integracao.ts).
+ *
+ * Devolve o desfecho ("aguardando" quando a linha voltou à fila), ou null quando não pegou nada (id torto, outro
+ * tipo, agendada, ou já pega).
  */
-export async function drenarUmaPublicacaoDoLinkedin(id: string): Promise<"publicado" | "falhou" | null> {
+export async function drenarUmaPublicacaoDoLinkedin(
+  id: string,
+  inicioDaFuncaoMs: number = Date.now()
+): Promise<"publicado" | "aguardando" | "falhou" | null> {
   if (!UUID.test(id)) return null;
   const [item] = (await sql().query(
     `update queue set status = 'sending', claimed_at = now(), attempts = attempts + 1
@@ -1014,15 +1034,36 @@ export async function drenarUmaPublicacaoDoLinkedin(id: string): Promise<"public
     [id]
   )) as QueueItem[];
   if (!item) return null;
+  let desfecho: "publicado" | "aguardando" | "falhou";
   try {
-    return await publicarNoLinkedinDaFila(item, DEPENDENCIAS_DO_LINKEDIN);
+    desfecho = await publicarNoLinkedinDaFila(item, dependenciasDoLinkedin(inicioDaFuncaoMs));
   } catch (err) {
-    await devolverOuEncerrar(item, err);
-    return "falhou";
+    desfecho = (await devolverOuEncerrar(item, err)) === "pending" ? "aguardando" : "falhou";
+  }
+  if (desfecho === "aguardando") await armarOTiqueDaLinha(item.id);
+  return desfecho;
+}
+
+/**
+ * O TIQUE DE UMA LINHA QUE VOLTOU À FILA, pela hora dela e com a mesma conta do rodapé do `drainQueue` (vinte
+ * segundos no mínimo, o horizonte no máximo). Calado como os outros: sem tique o post ainda sai, só mais tarde.
+ */
+async function armarOTiqueDaLinha(id: string): Promise<void> {
+  try {
+    const [linha] = (await sql().query(
+      `select extract(epoch from (not_before - now()))::float8 as secs from queue where id = $1 and status = 'pending'`,
+      [id]
+    )) as { secs: number }[];
+    if (!linha) return;
+    const config = await getConfig();
+    await scheduleTick(config.app_url ?? "", Math.min(Math.max(linha.secs + 5, 20), HORIZONTE_DO_TIQUE_EM_SEGUNDOS));
+  } catch {
+    // Calado de propósito: a linha está na fila.
   }
 }
 
-export async function drainQueue(): Promise<ResumoDaDrenagem> {
+export async function drainQueue(opcoes: { inicioDaFuncaoMs?: number } = {}): Promise<ResumoDaDrenagem> {
+  const depsDoLinkedin = dependenciasDoLinkedin(opcoes.inicioDaFuncaoMs ?? Date.now());
   const result = { sent: 0, skipped: 0, failed: 0, guardados: 0, aguardando: 0 };
   const accounts = await listAccounts();
   if (!accounts.length) return result;
@@ -1229,8 +1270,9 @@ export async function drainQueue(): Promise<ResumoDaDrenagem> {
       // O POST DO LINKEDIN (a parte 2a), pelo mesmo caminho e no mesmo `try`: o erro passageiro dele cai no `catch`
       // de baixo, como o da Meta. O que é recusa do LinkedIn, ou dúvida depois do POST, ele mesmo encerra.
       if (item.kind === "publicacao_linkedin") {
-        const desfecho = await publicarNoLinkedinDaFila(item, DEPENDENCIAS_DO_LINKEDIN);
+        const desfecho = await publicarNoLinkedinDaFila(item, depsDoLinkedin);
         if (desfecho === "publicado") result.sent++;
+        else if (desfecho === "aguardando") result.aguardando++;
         else result.failed++;
         continue;
       }
```

Em `app/api/queue/tick/route.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/api/queue/tick/route.ts b/app/api/queue/tick/route.ts
index 4a41ebb..8c84bbb 100644
--- a/app/api/queue/tick/route.ts
+++ b/app/api/queue/tick/route.ts
@@ -16,6 +16,7 @@ export const maxDuration = 60;
 // legítimo chama esta rota — o webhook e o cron diário drenam por conta
 // própria —, então só o CRON_SECRET abre.
 export async function POST(req: NextRequest) {
+  const inicioDaFuncaoMs = Date.now();
   const body = await req.text();
 
   if (qstashEnabled()) {
@@ -29,6 +30,8 @@ export async function POST(req: NextRequest) {
     }
   }
 
-  const result = await drainQueue();
+  // O COMEÇO DA FUNÇÃO VAI AO DRENO, que o usa como prazo do post do LinkedIn (lib/queue-drain.ts,
+  // `ORCAMENTO_DA_FUNCAO_MS`).
+  const result = await drainQueue({ inicioDaFuncaoMs });
   return NextResponse.json(result);
 }
```

Em `app/api/webhook/route.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/api/webhook/route.ts b/app/api/webhook/route.ts
index 2b23624..e97cded 100644
--- a/app/api/webhook/route.ts
+++ b/app/api/webhook/route.ts
@@ -97,6 +97,7 @@ export async function GET(req: NextRequest) {
 // porquê está em lib/webhook-signature.ts.
 // ============================================================
 export async function POST(req: NextRequest) {
+  const inicioDaFuncaoMs = Date.now();
   // corpo CRU antes de qualquer parse — a assinatura é do corpo exato
   const rawBody = await req.text();
   const assinatura = req.headers.get("x-hub-signature-256");
@@ -258,7 +259,8 @@ export async function POST(req: NextRequest) {
   // dispara a drenagem já, sem segurar a resposta (QStash e cron são o backup)
   after(async () => {
     try {
-      await drainQueue();
+      // O começo da função, e não o do `after()`: o webhook já gastou o tempo de tratar a mensagem.
+      await drainQueue({ inicioDaFuncaoMs });
     } catch {
       // a trava atômica garante que o próximo dreno recupera
     }
```

Em `app/api/cron/daily/route.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/api/cron/daily/route.ts b/app/api/cron/daily/route.ts
index c2fec65..fd2e6d6 100644
--- a/app/api/cron/daily/route.ts
+++ b/app/api/cron/daily/route.ts
@@ -20,6 +20,7 @@ export const maxDuration = 60;
 // 3) encerra os lotes guardados cujo prazo venceu
 // e no fim drena a fila como rede de segurança.
 export async function GET(req: NextRequest) {
+  const inicioDaFuncaoMs = Date.now();
   // Com CRON_SECRET, a Vercel manda "Authorization: Bearer <segredo>". SEM ela, a rotina RECUSA, como o
   // tique da fila (app/api/queue/tick/route.ts): até 27/10/2026 ela liberava, e a variável só existe em
   // produção, então os previews (que leem o banco de produção) rodavam a rotina para qualquer pedido
@@ -175,7 +176,9 @@ export async function GET(req: NextRequest) {
   // Medir quanto uma passagem do cron custa hoje, em produção, é o que decide.
   const { armados } = await armarTiquesDoDia();
 
-  const drained = await drainQueue();
+  // O COMEÇO DA FUNÇÃO VAI AO DRENO: depois de até ~40 s de tiques, o post do LinkedIn que não couber no que
+  // resta volta à fila e sai no tique seguinte (lib/linkedin-fila.ts).
+  const drained = await drainQueue({ inicioDaFuncaoMs });
   return NextResponse.json({
     accounts: accounts.length,
     refreshed,
```

Os tetos: o bucket 10 s, a reserva 10 s, o envio da imagem 15 s e o post 10 s, somando 45 s. O prazo é o começo da função mais 55 s (os 60 do `maxDuration` menos 5). A imagem que ainda não subiu só começa com 40 s restando; a marca e o post, com 15 s. Faltando tempo, a linha volta à fila em 20 s sem gastar a tentativa.

- [ ] **Passo 4: rodar e ver passar**

```bash
env -u CLAUDECODE -u AI_AGENT npx --no-install vitest run
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" \
  npx --no-install vitest run --config vitest.integracao.config.ts \
  testes-integracao/linkedin-publicacao.integracao.ts testes-integracao/tique-do-rodape.integracao.ts
npx --no-install tsc --noEmit
npx --no-install eslint lib/linkedin-fila.ts lib/linkedin.ts lib/queue-drain.ts app/api/queue/tick/route.ts \
  app/api/webhook/route.ts app/api/cron/daily/route.ts testes-integracao/linkedin-publicacao.integracao.ts \
  testes-integracao/tique-do-rodape.integracao.ts tests/dreno-com-prazo.test.ts tests/linkedin-rest.test.ts
```

Esperado: nos puros, "Test Files 153 passed (153)" e "Tests 3683 passed (3683)"; na integração, `ALVO: banco de TESTE`, "Test Files 2 passed (2)" e "Tests 43 passed (43)", e o `tsc` e o lint sem saída.

- [ ] **Passo 5: o commit**

A mensagem do commit, gravada em `$SCRATCH/msg-li2-f3.txt`:

```text
O post do LinkedIn só começa o passo que a função tem tempo de terminar, e o publicar agora arma o tique da linha que volta à fila
```

```bash
git add -- lib/linkedin-fila.ts lib/linkedin.ts lib/queue-drain.ts app/api/queue/tick/route.ts app/api/webhook/route.ts \
  app/api/cron/daily/route.ts testes-integracao/linkedin-publicacao.integracao.ts \
  testes-integracao/tique-do-rodape.integracao.ts tests/dreno-com-prazo.test.ts tests/linkedin-rest.test.ts
git commit -F "$SCRATCH/msg-li2-f3.txt"
```

---

### FASE 4 — As telas de Publicações, o cancelar e o remarcar

**Arquivos:** `lib/post-da-fila.ts` (novo), `lib/linkedin-publicacao.ts`, `app/publicar/page.tsx`, `app/publicar/post/[id]/page.tsx`, `app/publicar/post/actions.ts`, `app/page.tsx`, `lib/envio-filters.ts`, `lib/bonus/publicar-repositorio.ts`, `lib/engine.ts`, `testes-integracao/linkedin-telas.integracao.ts` (novo), `tests/post-da-fila.test.ts` (novo), `tests/envio-filters.test.ts`, `tests/publicar-previas.test.ts`.

- [ ] **Passo 1: os testes**

Crie `testes-integracao/linkedin-telas.integracao.ts`:

```ts
// AS TELAS DE PUBLICAÇÕES LEEM O POST DO LINKEDIN (docs/specs/2026-11-06-linkedin-no-perfil.md, §6 e §7; a parte
// 2a). Todos os pontos que diziam `kind = 'publicacao'` passam a ler os dois tipos de post: o calendário, "Não
// saíram", a contagem do que está fora do período, a página do post, o cancelar e o remarcar, o aviso do Início
// e o `caminhosNaFila` do gerador.
//
// A MAQUINARIA É A DE `agendados.integracao.ts` e de `nao-saiu.integracao.ts`: as páginas e as ações de verdade,
// chamadas num contexto de requisição com a sessão de teste, e a árvore lida por `textoDaArvore`. CONTA_A nasce
// primeiro e é a conta selecionada pelo tombo declarado de `getSelectedAccount`.
//
// O LINKEDIN, A META E O BUCKET SÃO FALSOS: servidores HTTP na própria máquina, e o `fetch` é interceptado para
// RECUSAR qualquer endereço que não seja o loopback. **NADA AQUI FALA COM O LINKEDIN, COM A META NEM COM O BUCKET
// DE VERDADE.** Valores inventados: nenhuma credencial de verdade entra em teste.
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { bancoDescartavel } from "./harness";
import { comoNumaRequisicaoComSessao } from "./semear-requisicao";
import { textoDaArvore } from "./texto-da-arvore";

type ModuloAcoes = typeof import("@/app/publicar/post/actions");
type ModuloTelaDosAgendados = typeof import("@/app/publicar/page");
type ModuloTelaDoDetalhe = typeof import("@/app/publicar/post/[id]/page");
type ModuloTelaDoPainel = typeof import("@/app/page");
type ModuloRepositorio = typeof import("@/lib/bonus/publicar-repositorio");
type ModuloPublicacao = typeof import("@/lib/publicacao");

const banco = bancoDescartavel();
const q = (texto: string, params: unknown[] = []) =>
  banco.db().sql().query(texto, params) as Promise<Record<string, unknown>[]>;

const CONTA_A = "17800000000025101";
const CONTA_B = "17800000000025102";
const BUCKET = "midia-das-telas";
const CHAVE_DO_BUCKET = "chave-do-bucket-das-telas-que-nao-vale-nada";
const TOKEN_DO_LINKEDIN = "AQVautorizacaoDasTelasQueNaoValeNada";

const pedidos = { linkedin: [] as string[], meta: [] as string[], apagados: [] as string[] };

let servidorFalso: Server;
let acoes: ModuloAcoes;
let telaDosAgendados: ModuloTelaDosAgendados;
let telaDoDetalhe: ModuloTelaDoDetalhe;
let telaDoPainel: ModuloTelaDoPainel;
let repositorio: ModuloRepositorio;
let publicacao: ModuloPublicacao;

function responder(res: ServerResponse, status: number, corpo: unknown, cabecalhos: Record<string, string> = {}) {
  res.writeHead(status, { "content-type": "application/json", ...cabecalhos });
  res.end(typeof corpo === "string" ? corpo : JSON.stringify(corpo));
}

beforeAll(async () => {
  // UM SERVIDOR SÓ PARA AS TRÊS PONTAS: o caminho diz quem é quem.
  servidorFalso = createServer((req: IncomingMessage, res: ServerResponse) => {
    req.resume();
    const u = new URL(req.url ?? "/", "http://127.0.0.1");
    const privado = `/storage/v1/object/${BUCKET}/`;
    if (req.method === "DELETE" && u.pathname.startsWith(privado)) {
      if (req.headers["apikey"] !== CHAVE_DO_BUCKET) return responder(res, 401, { message: "sem apikey" });
      pedidos.apagados.push(decodeURIComponent(u.pathname.slice(privado.length)));
      return responder(res, 200, { message: "ok" });
    }
    if (u.pathname.startsWith("/rest/") || u.pathname.startsWith("/v2/")) {
      pedidos.linkedin.push(`${req.method} ${u.pathname}`);
      if (req.method === "POST" && u.pathname === "/rest/posts") {
        return responder(res, 201, "", { "x-restli-id": "urn:li:share:7000000000000000101" });
      }
      return responder(res, 404, { message: "o LinkedIn falso não conhece esse caminho" });
    }
    pedidos.meta.push(`${req.method} ${u.pathname}`);
    responder(res, 500, { error: { message: "nenhum caso deste arquivo fala com a Meta" } });
  });
  await new Promise<void>((pronto) => servidorFalso.listen(0, "127.0.0.1", pronto));
  const base = `http://127.0.0.1:${(servidorFalso.address() as AddressInfo).port}`;
  process.env.LINKEDIN_API_BASE = base;
  process.env.IG_GRAPH_BASE = base;
  process.env.SUPABASE_URL = base;
  process.env.SUPABASE_SERVICE_ROLE_KEY = CHAVE_DO_BUCKET;
  process.env.SUPABASE_BUCKET = BUCKET;
  delete process.env.QSTASH_TOKEN;

  const fetchDeVerdade = globalThis.fetch;
  vi.stubGlobal("fetch", async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof entrada === "string" ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
    if (url.hostname === "127.0.0.1") return fetchDeVerdade(entrada, init);
    throw new Error(`RECUSADO: este teste não chama ${url.origin}`);
  });

  const li = await import("@/lib/linkedin");
  const ig = await import("@/lib/ig");
  if (li.basesDoLinkedin().api !== base || ig.baseDoGraph() !== base) {
    throw new Error("RECUSADO: as bases do LinkedIn e da Graph não são as desta rodada.");
  }

  acoes = await import("@/app/publicar/post/actions");
  telaDosAgendados = await import("@/app/publicar/page");
  telaDoDetalhe = await import("@/app/publicar/post/[id]/page");
  telaDoPainel = await import("@/app/page");
  repositorio = await import("@/lib/bonus/publicar-repositorio");
  publicacao = await import("@/lib/publicacao");

  // AS CONTAS NASCEM EM ORDEM: CONTA_A é a selecionada.
  for (const [id, nome] of [
    [CONTA_A, "conta_a_das_telas"],
    [CONTA_B, "conta_b_das_telas"],
  ] as const) {
    await banco.db().upsertAccount({
      ig_user_id: id,
      username: nome,
      name: nome,
      profile_picture_url: null,
      access_token: `token-de-${nome}-que-nao-vale-nada`,
      token_expires_at: null,
    });
  }
});

afterAll(async () => {
  vi.unstubAllGlobals();
  for (const v of ["LINKEDIN_API_BASE", "IG_GRAPH_BASE", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_BUCKET"]) {
    delete process.env[v];
  }
  await new Promise<void>((pronto) => servidorFalso.close(() => pronto()));
});

beforeEach(async () => {
  await q(`delete from queue`);
  await q(`delete from linkedin_conexoes`);
  pedidos.linkedin = [];
  pedidos.meta = [];
  pedidos.apagados = [];
});

// ---------------------------------------------------------------------------------------------------------------
// Semear e ler. Nada aqui decide nada.
// ---------------------------------------------------------------------------------------------------------------

let semente = 0;

/** Um post da fila, gravado direto, com as datas pelo relógio do banco. */
async function semear(item: {
  conta?: string;
  kind?: "publicacao" | "publicacao_linkedin" | "dm_manual";
  forma?: "texto" | "imagem";
  texto?: string;
  status?: string;
  emSegundos?: number;
  reivindicadoEm?: number | null;
  error?: string | null;
  postUrn?: string;
}): Promise<{ id: string; caminho: string }> {
  semente++;
  const conta = item.conta ?? CONTA_A;
  const kind = item.kind ?? "publicacao_linkedin";
  const caminho = `${conta}/tela-${semente}.jpg`;
  const forma = item.forma ?? "texto";
  const payload =
    kind === "publicacao_linkedin"
      ? {
          forma,
          caminhos: forma === "imagem" ? [caminho] : [],
          texto: item.texto ?? `O post ${semente} do LinkedIn`,
          ...(item.postUrn ? { post_urn: item.postUrn } : {}),
        }
      : kind === "publicacao"
        ? { forma: "imagem", caminhos: [caminho], legenda: `A legenda ${semente}` }
        : { text: "uma mensagem qualquer" };
  const status = item.status ?? "pending";
  const [linha] = (await q(
    `insert into queue (account_id, kind, contact_ig_id, payload, dedupe_key, status, not_before, claimed_at, sent_at, error)
     values ($1, $2, $3, $4, $5, $6, now() + make_interval(secs => $7::int),
             case when $8::int is null then null else now() + make_interval(secs => $8::int) end,
             case when $6 = 'sent' then now() + make_interval(secs => $7::int) end, $9)
     returning id`,
    [
      conta,
      kind,
      kind === "dm_manual" ? "99000000000025" : null,
      payload,
      `telas-${semente}`,
      status,
      item.emSegundos ?? 3600,
      item.reivindicadoEm === undefined ? null : item.reivindicadoEm,
      item.error ?? null,
    ]
  )) as { id: string }[];
  return { id: linha.id, caminho };
}

async function conectar() {
  await q(
    `insert into linkedin_conexoes (account_id, pessoa_id, nome, access_token, expira_em)
     values ($1, 'pessoaDasTelas', 'Dra. Ana Souza', $2, now() + interval '30 days')`,
    [CONTA_A, TOKEN_DO_LINKEDIN]
  );
}

const lerItem = async (id: string) =>
  (await q(`select status, error, attempts, not_before, payload from queue where id = $1`, [id]))[0];

async function arvoreDosAgendados(): Promise<string> {
  const { valor } = await comoNumaRequisicaoComSessao("/publicar", async () =>
    textoDaArvore(await telaDosAgendados.default({ searchParams: Promise.resolve({}) }))
  );
  return valor;
}

async function arvoreDoDetalhe(id: string): Promise<string> {
  const { valor } = await comoNumaRequisicaoComSessao(`/publicar/post/${id}`, async () =>
    textoDaArvore(await telaDoDetalhe.default({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) }))
  );
  return valor;
}

async function arvoreDoPainel(): Promise<string> {
  const { valor } = await comoNumaRequisicaoComSessao("/", async () =>
    textoDaArvore(await telaDoPainel.default({ searchParams: Promise.resolve({}) }))
  );
  return valor;
}

/** O desfecho de uma action: o `redirect()` lança, e o aviso viaja na URL. */
async function avisoDe(acao: (form: FormData) => Promise<void>, form: FormData): Promise<{ texto: string | null; tom: string | null }> {
  const { valor } = await comoNumaRequisicaoComSessao("/publicar", async () => {
    try {
      await acao(form);
      return null as string | null;
    } catch (e) {
      const digest = (e as { digest?: unknown }).digest;
      if (typeof digest === "string") return digest;
      throw e;
    }
  });
  if (valor === null || !valor.startsWith("NEXT_REDIRECT;")) return { texto: null, tom: null };
  const sp = new URL(valor.split(";").slice(2, -2).join(";"), "http://127.0.0.1").searchParams;
  return { texto: sp.get("aviso"), tom: sp.get("tom") };
}

function formulario(campos: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
}

/** Um instante em UTC, como o `<input type="datetime-local">` o manda com o fuso "0". */
const campoDeDataHora = (instante: number) => new Date(instante).toISOString().slice(0, 16);

// ---------------------------------------------------------------------------------------------------------------

describe("o calendário e \"Não saíram\" leem o post do LinkedIn", () => {
  it("o calendário mostra o post do LinkedIn com a rede no nome e o link para a página dele", async () => {
    const texto = await semear({ forma: "texto", emSegundos: 3600 });
    const imagem = await semear({ forma: "imagem", emSegundos: 7200 });
    await semear({ kind: "publicacao", emSegundos: 5400 });
    const arvore = await arvoreDosAgendados();
    expect(arvore).toContain("LinkedIn · Só texto");
    expect(arvore).toContain("LinkedIn · Imagem");
    expect(arvore).toContain("Imagem no feed");
    expect(arvore).toContain(`/publicar/post/${texto.id}?`);
    // A capa do post do LinkedIn com imagem é o arquivo dele no bucket, enquanto não saiu.
    expect(arvore).toContain(`/storage/v1/object/public/${BUCKET}/${imagem.caminho}`);
  });

  it("o post do LinkedIn agendado fora do período entra na contagem do que está fora", async () => {
    await semear({ forma: "texto", emSegundos: 90 * 24 * 3600 });
    const arvore = await arvoreDosAgendados();
    expect(arvore).toContain("post agendado");
    expect(arvore).toContain("fora deste período");
  });

  it("o post do LinkedIn que falhou aparece em \"Não saíram\", com a rede, o texto e o motivo", async () => {
    await semear({
      forma: "texto",
      texto: "O texto que não saiu",
      status: "failed",
      emSegundos: -3600,
      reivindicadoEm: -3600,
      error: "esta conta não tem LinkedIn conectado",
    });
    const arvore = await arvoreDosAgendados();
    expect(arvore).toContain("Não saíram");
    expect(arvore).toContain(publicacao.FRASE_DA_FALHA);
    expect(arvore).toContain("LinkedIn · Só texto");
    expect(arvore).toContain("O texto que não saiu");
    expect(arvore).toContain("esta conta não tem LinkedIn conectado");
  });

  it("o post do LinkedIn de outra conta não aparece", async () => {
    await semear({ conta: CONTA_B, forma: "texto", texto: "O post da outra conta" });
    expect(await arvoreDosAgendados()).not.toContain("O post da outra conta");
  });
});

describe("a página do post do LinkedIn", () => {
  it("agendado: o texto inteiro, os formulários e a nota de apagar pelo LinkedIn, sem falar com a Meta", async () => {
    const { id } = await semear({ forma: "texto", texto: "O texto inteiro do post\ncom duas linhas" });
    const arvore = await arvoreDoDetalhe(id);
    expect(arvore).toContain("LinkedIn · Só texto");
    expect(arvore).toContain("O texto inteiro do post\ncom duas linhas");
    expect(arvore).toContain("Remarcar");
    expect(arvore).toContain("Cancelar este post");
    expect(arvore).toContain("apague pelo próprio LinkedIn");
    expect(arvore).not.toContain("aplicativo do Instagram");
    expect(pedidos.meta).toEqual([]);
  });

  it("com imagem, agendado: a imagem do bucket aparece", async () => {
    const { id, caminho } = await semear({ forma: "imagem" });
    expect(await arvoreDoDetalhe(id)).toContain(`/storage/v1/object/public/${BUCKET}/${caminho}`);
  });

  it("publicado: o link \"Ver no LinkedIn\" leva ao post, sem falar com ninguém", async () => {
    const { id } = await semear({
      forma: "texto",
      status: "sent",
      emSegundos: -3600,
      postUrn: "urn:li:share:7000000000000000555",
    });
    const arvore = await arvoreDoDetalhe(id);
    expect(arvore).toContain("Ver no LinkedIn");
    expect(arvore).toContain("https://www.linkedin.com/feed/update/urn:li:share:7000000000000000555/");
    expect(arvore).not.toContain("Ver no Instagram");
    expect(pedidos.meta).toEqual([]);
    expect(pedidos.linkedin).toEqual([]);
  });
});

describe("cancelar e remarcar valem para o post do LinkedIn", () => {
  it("cancelar o agendado: a linha fica skipped com o motivo do dono, e a imagem sai do bucket", async () => {
    const { id, caminho } = await semear({ forma: "imagem" });
    const aviso = await avisoDe(acoes.cancelarPublicacao, formulario({ id, confirmo: "1" }));
    expect(aviso.tom).toBe("ok");
    const linha = await lerItem(id);
    expect(linha).toMatchObject({ status: "skipped", error: publicacao.MOTIVO_CANCELADO_PELO_DONO });
    expect(pedidos.apagados).toEqual([caminho]);
  });

  it("cancelar o que já está saindo: o aviso manda apagar pelo LinkedIn, e a linha não muda", async () => {
    const { id } = await semear({ forma: "texto", status: "sending", emSegundos: -60, reivindicadoEm: -5 });
    const aviso = await avisoDe(acoes.cancelarPublicacao, formulario({ id, confirmo: "1" }));
    expect(aviso.tom).toBe("erro");
    expect(aviso.texto).toContain("apague por lá");
    expect(aviso.texto).not.toContain("Instagram");
    expect((await lerItem(id)).status).toBe("sending");
  });

  it("cancelar uma MENSAGEM pelo id continua recusado", async () => {
    const { id } = await semear({ kind: "dm_manual" });
    const aviso = await avisoDe(acoes.cancelarPublicacao, formulario({ id, confirmo: "1" }));
    expect(aviso.tom).toBe("erro");
    expect((await lerItem(id)).status).toBe("pending");
  });

  it("remarcar o agendado para daqui a três horas grava a hora nova", async () => {
    const { id } = await semear({ forma: "texto", emSegundos: 3600 });
    const alvo = Math.floor((Date.now() + 3 * 3600 * 1000) / 60000) * 60000;
    const aviso = await avisoDe(acoes.remarcarPublicacao, formulario({ id, data_hora: campoDeDataHora(alvo), fuso: "0" }));
    expect(aviso.tom).toBe("ok");
    expect(new Date((await lerItem(id)).not_before as Date).getTime()).toBe(alvo);
  });

  it("remarcar para o minuto corrente publica só esta linha, e não drena o resto da fila", async () => {
    await conectar();
    const outra = await semear({ kind: "publicacao", emSegundos: -120 });
    const { id } = await semear({ forma: "texto", emSegundos: 3600 });
    const minuto = Math.floor(Date.now() / 60000) * 60000;
    const aviso = await avisoDe(acoes.remarcarPublicacao, formulario({ id, data_hora: campoDeDataHora(minuto), fuso: "0" }));
    expect(aviso.tom).toBe("ok");
    expect((await lerItem(id)).status).toBe("sent");
    expect(pedidos.linkedin).toEqual(["POST /rest/posts"]);
    // O post do Instagram vencido continua na fila: o "agora" do LinkedIn não é o dreno inteiro.
    expect(await lerItem(outra.id)).toMatchObject({ status: "pending", attempts: 0 });
    expect(pedidos.meta).toEqual([]);
  });
});

describe("o Início e o gerador conhecem o post do LinkedIn", () => {
  it("o post do LinkedIn que falhou é aviso de publicação, e não de mensagem", async () => {
    await semear({ forma: "texto", status: "failed", emSegundos: -3600, reivindicadoEm: -3600, error: "falhou" });
    const painel = await arvoreDoPainel();
    expect(painel).toContain("publicação não saiu");
    expect(painel).not.toContain("mensagem não saiu");
  });

  it("o caminhosNaFila acha o arquivo que está numa linha do LinkedIn", async () => {
    const { caminho } = await semear({ forma: "imagem" });
    expect(await repositorio.caminhosNaFila([caminho, `${CONTA_A}/nao-esta-na-fila.jpg`])).toEqual([caminho]);
  });
});
```

Crie `tests/post-da-fila.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  avisoDoDesfechoDoPost,
  caminhosDoPostDaFila,
  cartaoDoPost,
  linhaDaFalhaDoPost,
  paginaDoPost,
} from "@/lib/post-da-fila";
import { rotuloDoPostNoLinkedin } from "@/lib/linkedin-publicacao";
import { avisoDoDesfecho } from "@/lib/avisos";
import { KINDS_FORA_DA_ENTREGA_DO_MOTOR } from "@/lib/envio-filters";
import { MOTIVO_NAO_REGISTRADO, fraseSobreAMidia } from "@/lib/publicacao";

// O POST DA FILA, DE QUALQUER REDE (docs/specs/2026-11-06-linkedin-no-perfil.md, §7; a parte 2a). As telas de
// Publicações (o calendário, "Não saíram" e a página do post) e as ações de cancelar e remarcar leem o post do
// Instagram e o do LinkedIn pelas mesmas funções, e o que muda por rede é decidido aqui, fora do JSX.

const IG = { kind: "publicacao", payload: { forma: "imagem", caminhos: ["conta/ig.jpg"], legenda: "A legenda" } };
const LI_TEXTO = { kind: "publicacao_linkedin", payload: { forma: "texto", caminhos: [], texto: "O texto do post" } };
const LI_IMAGEM = { kind: "publicacao_linkedin", payload: { forma: "imagem", caminhos: ["conta/li.jpg"], texto: "Com foto" } };

describe("o nome do post do LinkedIn", () => {
  it("leva a rede na frente, como o convite do LinkedIn", () => {
    expect(rotuloDoPostNoLinkedin({ forma: "texto" })).toBe("LinkedIn · Só texto");
    expect(rotuloDoPostNoLinkedin({ forma: "imagem" })).toBe("LinkedIn · Imagem");
    expect(rotuloDoPostNoLinkedin(null)).toBe("LinkedIn · Forma não reconhecida");
  });
});

describe("o quadrado do calendário", () => {
  it("o do Instagram continua como era: o nome da forma e a capa enquanto não saiu", () => {
    expect(cartaoDoPost(IG, false)).toEqual({ rotulo: "Imagem no feed", capa: "conta/ig.jpg", soVideo: false });
    expect(cartaoDoPost(IG, true)).toEqual({ rotulo: "Imagem no feed", capa: null, soVideo: false });
  });

  it("o do Instagram com vídeo: a capa é a primeira imagem, e o só vídeo fica sem capa e com o ícone", () => {
    const carrossel = { kind: "publicacao", payload: { forma: "carrossel", caminhos: ["c/v.mp4", "c/f.jpg"] } };
    expect(cartaoDoPost(carrossel, false)).toEqual({ rotulo: "Carrossel", capa: "c/f.jpg", soVideo: false });
    const reels = { kind: "publicacao", payload: { forma: "reels", caminhos: ["c/r.mp4"] } };
    expect(cartaoDoPost(reels, false)).toEqual({ rotulo: "Reels", capa: null, soVideo: true });
    expect(cartaoDoPost(reels, true)).toEqual({ rotulo: "Reels", capa: null, soVideo: false });
  });

  it("o do LinkedIn leva a rede no nome, e a capa é a imagem, enquanto não saiu", () => {
    expect(cartaoDoPost(LI_IMAGEM, false)).toEqual({ rotulo: "LinkedIn · Imagem", capa: "conta/li.jpg", soVideo: false });
    expect(cartaoDoPost(LI_IMAGEM, true)).toEqual({ rotulo: "LinkedIn · Imagem", capa: null, soVideo: false });
    expect(cartaoDoPost(LI_TEXTO, false)).toEqual({ rotulo: "LinkedIn · Só texto", capa: null, soVideo: false });
  });

  it("o payload torto do LinkedIn não vira o do Instagram", () => {
    expect(cartaoDoPost({ kind: "publicacao_linkedin", payload: { forma: "reels" } }, false).rotulo).toBe(
      "LinkedIn · Forma não reconhecida"
    );
  });
});

describe("a linha de \"Não saíram\"", () => {
  const base = { not_before: new Date("2026-11-10T10:00:00Z"), claimed_at: new Date("2026-11-10T10:05:00Z") };

  it("a do LinkedIn tem a rede, o começo do texto e o motivo", () => {
    expect(linhaDaFalhaDoPost({ ...base, ...LI_TEXTO, error: " o motivo " })).toEqual({
      quando: base.claimed_at,
      motivo: "o motivo",
      forma: "LinkedIn · Só texto",
      legenda: "O texto do post",
    });
    expect(linhaDaFalhaDoPost({ ...base, ...LI_TEXTO, error: null }).motivo).toBe(MOTIVO_NAO_REGISTRADO);
  });

  it("a do Instagram continua como era", () => {
    expect(linhaDaFalhaDoPost({ ...base, ...IG, error: "x" })).toMatchObject({ forma: "Imagem no feed", legenda: "A legenda" });
  });
});

describe("os arquivos que o cancelar apaga", () => {
  it("saem do payload de cada rede, e o payload torto não apaga nada", () => {
    expect(caminhosDoPostDaFila(IG.kind, IG.payload)).toEqual(["conta/ig.jpg"]);
    expect(caminhosDoPostDaFila(LI_IMAGEM.kind, LI_IMAGEM.payload)).toEqual(["conta/li.jpg"]);
    expect(caminhosDoPostDaFila(LI_TEXTO.kind, LI_TEXTO.payload)).toEqual([]);
    expect(caminhosDoPostDaFila("publicacao_linkedin", { forma: "reels", caminhos: ["x"] })).toBeNull();
    expect(caminhosDoPostDaFila("publicacao", { forma: "nada" })).toBeNull();
  });
});

describe("a página de um post", () => {
  const agendado = { saiu: false, encerrado: false };
  const saiu = { saiu: true, encerrado: true };

  it("a do Instagram continua com a legenda, a mídia, o id para o \"Ver no Instagram\" e a nota do aplicativo", () => {
    const p = paginaDoPost({ ...IG, payload: { ...IG.payload, media_id: "17900000000000001" }, error: null }, saiu);
    expect(p).toMatchObject({
      titulo: "Imagem no feed",
      tituloDoTexto: "Legenda",
      texto: "A legenda",
      semTexto: "Sem legenda.",
      caminhos: ["conta/ig.jpg"],
      sobreAMidia: fraseSobreAMidia(saiu, null),
      mediaIdNoInstagram: "17900000000000001",
      linkNoLinkedin: null,
    });
    expect(p.notaDoCancelar).toContain("só o aplicativo do Instagram apaga");
  });

  it("a do LinkedIn tem o texto, o link para ver no LinkedIn depois de sair, e a nota de apagar por lá", () => {
    const publicado = { ...LI_TEXTO, payload: { ...LI_TEXTO.payload, post_urn: "urn:li:share:7001" }, error: null };
    const p = paginaDoPost(publicado, saiu);
    expect(p).toMatchObject({
      titulo: "LinkedIn · Só texto",
      tituloDoTexto: "Texto",
      texto: "O texto do post",
      semTexto: "Sem texto.",
      caminhos: [],
      // Só texto não tem mídia, e a frase sobre a mídia apagada mentiria.
      sobreAMidia: null,
      mediaIdNoInstagram: null,
      linkNoLinkedin: "https://www.linkedin.com/feed/update/urn:li:share:7001/",
    });
    expect(p.notaDoCancelar).toContain("apague pelo próprio LinkedIn");
    expect(p.notaDoCancelar).not.toContain("Instagram");
    // Antes de sair, não há link, mesmo com um URN no payload.
    expect(paginaDoPost(publicado, agendado).linkNoLinkedin).toBeNull();
  });

  it("a imagem do LinkedIn tem a mídia e a frase sobre ela, e nunca é vídeo", () => {
    const p = paginaDoPost({ ...LI_IMAGEM, error: null }, saiu);
    expect(p.caminhos).toEqual(["conta/li.jpg"]);
    expect(p.sobreAMidia).toBe(fraseSobreAMidia(saiu, null));
    expect(p.ehVideo("conta/li.mp4")).toBe(false);
  });
});

describe("o aviso do cancelar e do remarcar", () => {
  it("no LinkedIn, o \"já saiu\" do cancelar manda apagar por lá, e não pelo Instagram", () => {
    const aviso = avisoDoDesfechoDoPost("tarde_demais", "cancelar", "publicacao_linkedin");
    expect(aviso.tom).toBe("erro");
    expect(aviso.texto).toContain("apague por lá");
    expect(aviso.texto).not.toContain("Instagram");
  });

  it("o resto é o aviso de sempre, nas duas redes", () => {
    for (const kind of ["publicacao", "publicacao_linkedin", null]) {
      expect(avisoDoDesfechoDoPost("feito", "cancelar", kind)).toEqual(avisoDoDesfecho("feito", "cancelar"));
      expect(avisoDoDesfechoDoPost("tarde_demais", "remarcar", kind)).toEqual(avisoDoDesfecho("tarde_demais", "remarcar"));
    }
    expect(avisoDoDesfechoDoPost("tarde_demais", "cancelar", "publicacao")).toEqual(avisoDoDesfecho("tarde_demais", "cancelar"));
  });
});

describe("o que não conta como entrega do motor", () => {
  it("o post do LinkedIn também fica de fora, como o do Instagram", () => {
    expect(KINDS_FORA_DA_ENTREGA_DO_MOTOR).toContain("publicacao");
    expect(KINDS_FORA_DA_ENTREGA_DO_MOTOR).toContain("publicacao_linkedin");
  });
});
```

Em `tests/envio-filters.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/envio-filters.test.ts b/tests/envio-filters.test.ts
index 2235709..a8e2697 100644
--- a/tests/envio-filters.test.ts
+++ b/tests/envio-filters.test.ts
@@ -233,7 +233,9 @@ describe("o vocabulário que o SQL consome", () => {
   it("publicação está FORA da conta de entrega do motor, junto com os manuais", () => {
     // O defeito que este vocabulário fecha: /desempenho dizia "Mensagens
     // entregues: 5" com 3 entregues pelo motor — os outros dois eram POSTS.
-    expect([...KINDS_FORA_DA_ENTREGA_DO_MOTOR]).toEqual(["dm_manual", "publicacao"]);
+    // Desde a parte 2a do LinkedIn, o post do LinkedIn também (lib/fila-tipos.ts,
+    // TIPOS_DE_PUBLICACAO).
+    expect([...KINDS_FORA_DA_ENTREGA_DO_MOTOR]).toEqual(["dm_manual", "publicacao", "publicacao_linkedin"]);
   });
 
   it("a lista DERIVA de KINDS_MANUAIS, e não o repete", () => {
```

Em `tests/publicar-previas.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/publicar-previas.test.ts b/tests/publicar-previas.test.ts
index bd3ecf7..fc42bbd 100644
--- a/tests/publicar-previas.test.ts
+++ b/tests/publicar-previas.test.ts
@@ -16,13 +16,20 @@ import { describe, expect, it } from "vitest";
 const RAIZ = fileURLToPath(new URL("..", import.meta.url));
 const ler = (rel: string) => readFileSync(`${RAIZ}/${rel}`, "utf8").replace(/\r\n/g, "\n");
 
+// DESDE A PARTE 2a DO LINKEDIN, as duas decisões moram em lib/post-da-fila.ts (`paginaDoPost` e `cartaoDoPost`),
+// que lê o post do Instagram como as telas liam e o do LinkedIn com a rede no nome. A guarda cobra as duas
+// metades: a tela pergunta à função, e a função pergunta à regra pura, com as mesmas expressões de antes.
+// tests/post-da-fila.test.ts prende o resultado, inclusive o do vídeo.
+const postDaFila = ler("lib/post-da-fila.ts");
+
 describe("a página do post", () => {
   const pagina = ler("app/publicar/post/[id]/page.tsx");
 
   it("pergunta à regra pura se cada caminho é vídeo, e o ramo do sim desenha <video>; o do não, <img>", () => {
     expect(pagina).toMatch(
-      /p && ehVideoNoPost\(p\.forma, m\.caminho\) \? \(\s*<span[^>]*>\s*<video\s[\s\S]*?muted[\s\S]*?preload="metadata"[\s\S]*?\) : \([\s\S]*?<img\s/
+      /pagina\.ehVideo\(m\.caminho\) \? \(\s*<span[^>]*>\s*<video\s[\s\S]*?muted[\s\S]*?preload="metadata"[\s\S]*?\) : \([\s\S]*?<img\s/
     );
+    expect(postDaFila).toContain("ehVideo: (caminho) => !!p && ehVideoNoPost(p.forma, caminho),");
   });
 });
 
@@ -30,12 +37,15 @@ describe("o calendário", () => {
   const pagina = ler("app/publicar/page.tsx");
 
   it("pede a capa à regra pura, e não pega o primeiro caminho", () => {
-    expect(pagina).toContain("const primeira = !saiu && p ? capaDoPost(p.forma, p.caminhos) : null;");
+    expect(pagina).toContain("const cartao = cartaoDoPost(item, saiu);");
+    expect(pagina).toContain("const primeira = cartao.capa;");
+    expect(postDaFila).toContain("const capa = !saiu && p ? capaDoPost(p.forma, p.caminhos) : null;");
     expect(pagina).not.toContain("p?.caminhos?.[0]");
   });
 
   it("o post só de vídeo, que não saiu, mostra o ícone de vídeo no lugar da capa", () => {
-    expect(pagina).toContain("const soVideo = !saiu && !!p && p.caminhos.length > 0 && primeira === null;");
+    expect(pagina).toContain("const soVideo = cartao.soVideo;");
+    expect(postDaFila).toContain("soVideo: !saiu && !!p && p.caminhos.length > 0 && capa === null");
     expect(pagina).toContain('{saiu ? "✓" : soVideo ? "▶" : "•"}');
   });
 });
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
env -u CLAUDECODE -u AI_AGENT npx --no-install vitest run tests/post-da-fila.test.ts tests/envio-filters.test.ts \
  tests/publicar-previas.test.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" \
  npx --no-install vitest run --config vitest.integracao.config.ts testes-integracao/linkedin-telas.integracao.ts
```

Esperado: 
- nos puros, "Test Files 3 failed (3)" e "Tests 1 failed | 32 passed (33)": os dois arquivos que leem `lib/post-da-fila.ts` falham antes dos casos, e cai "publicação está FORA da conta de entrega do motor, junto com os manuais";
- na integração, `ALVO: banco de TESTE` e "Tests 12 failed | 2 passed (14)": passam só os dois de controle, "o post do LinkedIn de outra conta não aparece" e "cancelar uma MENSAGEM pelo id continua recusado".

- [ ] **Passo 3: o código**

Crie `lib/post-da-fila.ts`:

```ts
import { avisoDoDesfecho, type Aviso } from "./avisos";
import {
  capaDoPost,
  ehVideoNoPost,
  fraseSobreAMidia,
  lerPayloadDaPublicacao,
  linhaDaFalha,
  resumoDaLegenda,
  rotuloDaFormaDoItem,
  LEGENDA_NA_LISTA,
  MOTIVO_NAO_REGISTRADO,
  type DesfechoDaMudanca,
  type LinhaDaFalha,
} from "./publicacao";
import { lerPayloadDoLinkedin, linkParaVerNoLinkedin, rotuloDoPostNoLinkedin } from "./linkedin-publicacao";

// O POST DA FILA, DE QUALQUER REDE (docs/specs/2026-11-06-linkedin-no-perfil.md, §7; a parte 2a).
//
// As telas de Publicações (o calendário, "Não saíram" e a página do post) e as ações de cancelar e remarcar leem o
// post do Instagram (`publicacao`) e o do LinkedIn (`publicacao_linkedin`). O que muda por rede é decidido aqui,
// fora do JSX, e o post do Instagram continua saindo pelas mesmas funções de antes (lib/publicacao.ts), sem mudar
// uma letra do que a tela mostrava.
//
// SEM IMPORT DE SERVIDOR: o arquivo é puro, e tests/post-da-fila.test.ts o lê sem banco.

export function ehPostDoLinkedin(kind: string | null | undefined): boolean {
  return kind === "publicacao_linkedin";
}

/** O quadrado do calendário: o nome, a capa (o caminho no bucket, enquanto o post não saiu) e se ele é só vídeo. */
export function cartaoDoPost(
  item: { kind: string; payload: unknown },
  saiu: boolean
): { rotulo: string; capa: string | null; soVideo: boolean } {
  if (ehPostDoLinkedin(item.kind)) {
    const li = lerPayloadDoLinkedin(item.payload);
    return { rotulo: rotuloDoPostNoLinkedin(li), capa: !saiu && li?.forma === "imagem" ? li.caminhos[0] : null, soVideo: false };
  }
  // O INSTAGRAM, como a célula decidia antes (app/publicar/page.tsx): a capa é a primeira imagem, e o post só de
  // vídeo fica sem capa e desenha o ícone dele.
  const p = lerPayloadDaPublicacao(item.payload);
  const capa = !saiu && p ? capaDoPost(p.forma, p.caminhos) : null;
  return { rotulo: rotuloDaFormaDoItem(p), capa, soVideo: !saiu && !!p && p.caminhos.length > 0 && capa === null };
}

/** A linha de "Não saíram". A do LinkedIn tem as mesmas quatro coisas da do Instagram (`linhaDaFalha`). */
export function linhaDaFalhaDoPost(item: {
  kind: string;
  not_before: Date;
  claimed_at: Date | null;
  error: string | null;
  payload: Record<string, unknown>;
}): LinhaDaFalha {
  if (!ehPostDoLinkedin(item.kind)) return linhaDaFalha(item);
  const li = lerPayloadDoLinkedin(item.payload);
  const motivo = typeof item.error === "string" ? item.error.trim() : "";
  return {
    quando: item.claimed_at ?? item.not_before,
    motivo: motivo || MOTIVO_NAO_REGISTRADO,
    forma: rotuloDoPostNoLinkedin(li),
    legenda: resumoDaLegenda(li?.texto, LEGENDA_NA_LISTA),
  };
}

/**
 * Os arquivos que o cancelar apaga do bucket, lidos do payload da rede da linha. O payload que não se lê não apaga
 * nada (null): um caminho de um `jsonb` que ninguém entende é a última coisa que se entrega a um `DELETE`.
 */
export function caminhosDoPostDaFila(kind: string, payload: unknown): string[] | null {
  if (ehPostDoLinkedin(kind)) return lerPayloadDoLinkedin(payload)?.caminhos ?? null;
  return lerPayloadDaPublicacao(payload)?.caminhos ?? null;
}

/** O que a página de um post mostra, decidido fora do JSX. */
export type PaginaDoPost = {
  titulo: string;
  tituloDoTexto: string;
  /** O texto inteiro, ou null quando não há (e aí a tela diz `semTexto`). */
  texto: string | null;
  semTexto: string;
  /** Os arquivos do post; a tela só os mostra enquanto ele pode ser mexido. */
  caminhos: string[];
  ehVideo: (caminho: string) => boolean;
  sobreAMidia: string | null;
  /** O id do post no Instagram, para a tela buscar o "Ver no Instagram"; null no LinkedIn. */
  mediaIdNoInstagram: string | null;
  /** O endereço do post no LinkedIn, depois que ele saiu; null no Instagram. */
  linkNoLinkedin: string | null;
  notaDoCancelar: string;
};

const NOTA_DO_CANCELAR_NO_INSTAGRAM =
  "Cancelar tira o post da fila e ele não sai. Se ele já tiver saído, só o aplicativo do Instagram apaga — a API não apaga mídia.";
const NOTA_DO_CANCELAR_NO_LINKEDIN =
  "Cancelar tira o post da fila e ele não sai. Se ele já tiver saído, apague pelo próprio LinkedIn.";

export function paginaDoPost(
  item: { kind: string; payload: unknown; error: string | null },
  quando: { saiu: boolean; encerrado: boolean }
): PaginaDoPost {
  if (ehPostDoLinkedin(item.kind)) {
    const li = lerPayloadDoLinkedin(item.payload);
    return {
      titulo: rotuloDoPostNoLinkedin(li),
      tituloDoTexto: "Texto",
      texto: li?.texto.trim() ? li.texto : null,
      semTexto: "Sem texto.",
      caminhos: li?.caminhos ?? [],
      ehVideo: () => false,
      // O SÓ TEXTO NÃO TEM MÍDIA, e a frase sobre a mídia apagada mentiria.
      sobreAMidia: li?.forma === "imagem" ? fraseSobreAMidia(quando, item.error) : null,
      mediaIdNoInstagram: null,
      linkNoLinkedin: quando.saiu ? linkParaVerNoLinkedin(li?.postUrn) : null,
      notaDoCancelar: NOTA_DO_CANCELAR_NO_LINKEDIN,
    };
  }
  const p = lerPayloadDaPublicacao(item.payload);
  return {
    titulo: rotuloDaFormaDoItem(p),
    tituloDoTexto: "Legenda",
    texto: p?.legenda?.trim() ? p.legenda : null,
    semTexto: "Sem legenda.",
    caminhos: p?.caminhos ?? [],
    ehVideo: (caminho) => !!p && ehVideoNoPost(p.forma, caminho),
    sobreAMidia: fraseSobreAMidia(quando, item.error),
    mediaIdNoInstagram: p?.mediaId ?? null,
    linkNoLinkedin: null,
    notaDoCancelar: NOTA_DO_CANCELAR_NO_INSTAGRAM,
  };
}

/**
 * O AVISO DO CANCELAR E DO REMARCAR (`avisoDoDesfecho`, lib/avisos.ts), com uma frase a mais: no LinkedIn, o "já
 * saiu" do cancelar não pode mandar apagar pelo aplicativo do Instagram. O resto é o aviso de sempre, nas duas
 * redes; sem a rede (o item não foi achado), também.
 */
export function avisoDoDesfechoDoPost(
  d: DesfechoDaMudanca,
  acao: "cancelar" | "remarcar",
  kind: string | null
): Aviso {
  if (ehPostDoLinkedin(kind) && d === "tarde_demais" && acao === "cancelar") {
    return {
      tom: "erro",
      texto: "Este post já saiu ou está saindo agora, e não deu para cancelar. Se ele já estiver no LinkedIn, apague por lá.",
    };
  }
  return avisoDoDesfecho(d, acao);
}
```

Em `lib/linkedin-publicacao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/linkedin-publicacao.ts b/lib/linkedin-publicacao.ts
index bbb6e9d..732a2b3 100644
--- a/lib/linkedin-publicacao.ts
+++ b/lib/linkedin-publicacao.ts
@@ -42,6 +42,15 @@ export function rotuloDaFormaNoLinkedin(forma: FormaNoLinkedin): string {
   return forma === "texto" ? "Só texto" : "Imagem";
 }
 
+/**
+ * O NOME DO POST DO LINKEDIN NAS TELAS DE PUBLICAÇÕES, com a rede na frente ("LinkedIn · Só texto"), como a linha
+ * do convite do LinkedIn (lib/convites.ts). O post do Instagram continua só com o nome da forma. O payload que não
+ * se lê ainda tem nome, porque a linha dele continua existindo e é dela que sai o cancelar.
+ */
+export function rotuloDoPostNoLinkedin(p: { forma: FormaNoLinkedin } | null): string {
+  return `LinkedIn · ${p ? rotuloDaFormaNoLinkedin(p.forma) : "Forma não reconhecida"}`;
+}
+
 // ---------------------------------------------------------------------------------------------------------------
 // O TEXTO
 // ---------------------------------------------------------------------------------------------------------------
```

Em `app/publicar/page.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/publicar/page.tsx b/app/publicar/page.tsx
index 708893c..ea35e6f 100644
--- a/app/publicar/page.tsx
+++ b/app/publicar/page.tsx
@@ -5,15 +5,11 @@ import { textoSemConta } from "@/lib/logins-textos";
 import { sessaoAtual } from "@/lib/sessao";
 import { fmtDate } from "@/lib/format";
 import { avisoDaUrl } from "@/lib/avisos";
-import {
-  avisoDoAtrasoNaLista,
-  dataDaLinhaDeEnvio,
-  lerPayloadDaPublicacao,
-  linhaDaFalha,
-  rotuloDaFormaDoItem,
-  FRASE_DA_FALHA,
-  capaDoPost,
-} from "@/lib/publicacao";
+import { avisoDoAtrasoNaLista, dataDaLinhaDeEnvio, FRASE_DA_FALHA } from "@/lib/publicacao";
+// O POST DE QUALQUER REDE (a parte 2a do LinkedIn): o quadrado e a linha de "Não saíram" saem de funções puras que
+// leem o post do Instagram como antes e o do LinkedIn com a rede no nome. As consultas leem os dois tipos.
+import { cartaoDoPost, linhaDaFalhaDoPost } from "@/lib/post-da-fila";
+import { TIPOS_DE_PUBLICACAO } from "@/lib/fila-tipos";
 import {
   card,
   muted,
@@ -261,20 +257,20 @@ export default async function Agendados({
         // =====================================================================
         sql().query(
           `select * from queue
-            where account_id = $1 and kind = 'publicacao'
+            where account_id = $1 and kind = any($5::text[])
               and status in ('pending', 'sent')
               and coalesce(sent_at, not_before) >= $2::timestamptz
               and coalesce(sent_at, not_before) < $3::timestamptz
             order by coalesce(sent_at, not_before), id
             limit $4`,
-          [conta.ig_user_id, inicioDaJanela, fimDaJanela, AGENDADOS_NA_TELA]
+          [conta.ig_user_id, inicioDaJanela, fimDaJanela, AGENDADOS_NA_TELA, Array.from(TIPOS_DE_PUBLICACAO)]
         ),
         sql().query(
           `select * from queue
-            where account_id = $1 and kind = 'publicacao' and status = 'failed'
+            where account_id = $1 and kind = any($3::text[]) and status = 'failed'
             order by coalesce(claimed_at, not_before) desc, id
             limit $2`,
-          [conta.ig_user_id, FALHADAS_NA_TELA]
+          [conta.ig_user_id, FALHADAS_NA_TELA, Array.from(TIPOS_DE_PUBLICACAO)]
         ),
         // O QUE ESTA AGENDADO FORA DESTA GRADE — e esta consulta existe por um
         // defeito que a revisao achou em 11/09/2026.
@@ -294,9 +290,9 @@ export default async function Agendados({
         sql().query(
           `select count(*)::int as fora, min(not_before) as proximo
              from queue
-            where account_id = $1 and kind = 'publicacao' and status = 'pending'
+            where account_id = $1 and kind = any($4::text[]) and status = 'pending'
               and (not_before < $2::timestamptz or not_before >= $3::timestamptz)`,
-          [conta.ig_user_id, inicioDaJanela, fimDaJanela]
+          [conta.ig_user_id, inicioDaJanela, fimDaJanela, Array.from(TIPOS_DE_PUBLICACAO)]
         ),
       ])) as [QueueItem[], QueueItem[], { fora: number; proximo: Date | null }[]])
     : ([[], [], [{ fora: 0, proximo: null }]] as [
@@ -446,7 +442,6 @@ export default async function Agendados({
                       </p>
 
                       {mostrados.map((item) => {
-                        const p = lerPayloadDaPublicacao(item.payload);
                         const quando = dataDaLinhaDeEnvio(item);
                         const saiu = quando.saiu;
                         // A MINIATURA SÓ EXISTE ENQUANTO O POST NÃO SAIU: o
@@ -457,9 +452,11 @@ export default async function Agendados({
                         // E A CAPA É A PRIMEIRA IMAGEM, e não o primeiro
                         // caminho (spec 2026-10-19-enquadrar-imagens): o
                         // vídeo saía como imagem quebrada. O post só de vídeo
-                        // fica sem capa, e a célula desenha o ícone dele.
-                        const primeira = !saiu && p ? capaDoPost(p.forma, p.caminhos) : null;
-                        const soVideo = !saiu && !!p && p.caminhos.length > 0 && primeira === null;
+                        // fica sem capa, e a célula desenha o ícone dele. Quem
+                        // decide, nas duas redes, é `cartaoDoPost`.
+                        const cartao = cartaoDoPost(item, saiu);
+                        const primeira = cartao.capa;
+                        const soVideo = cartao.soVideo;
                         // `null` QUANDO O AMBIENTE NÃO DEIXA MONTAR A URL, e
                         // aí a célula desenha o símbolo em vez de uma imagem
                         // quebrada. Prévia não vale uma tela — ver
@@ -532,7 +529,7 @@ export default async function Agendados({
                                 {horaDoDia(quando.quando)}
                               </span>
                               <span className={`block truncate text-[11px] ${muted}`}>
-                                {rotuloDaFormaDoItem(p)}
+                                {cartao.rotulo}
                               </span>
                             </span>
                           </Link>
@@ -639,7 +636,7 @@ export default async function Agendados({
           </div>
           <ul className="space-y-4">
             {falhadas.map((item) => {
-              const falha = linhaDaFalha(item);
+              const falha = linhaDaFalhaDoPost(item);
               return (
                 <li
                   key={item.id}
```

Em `app/publicar/post/[id]/page.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/publicar/post/[id]/page.tsx b/app/publicar/post/[id]/page.tsx
index 2294afd..fa6e515 100644
--- a/app/publicar/post/[id]/page.tsx
+++ b/app/publicar/post/[id]/page.tsx
@@ -11,12 +11,13 @@ import {
   avisoDoAtrasoNaLista,
   dataDaLinhaDeEnvio,
   fraseDaDataDaLinha,
-  lerPayloadDaPublicacao,
-  rotuloDaFormaDoItem,
-  fraseSobreAMidia,
   mediaIdParaVerNoInstagram,
-  ehVideoNoPost,
 } from "@/lib/publicacao";
+// O POST DE QUALQUER REDE (a parte 2a do LinkedIn): o título, o texto, a mídia, a frase sobre ela, o link para ver
+// o post e a nota do cancelar saem de `paginaDoPost`, que lê o post do Instagram como antes e o do LinkedIn com o
+// "Ver no LinkedIn". A consulta lê os dois tipos.
+import { paginaDoPost } from "@/lib/post-da-fila";
+import { TIPOS_DE_PUBLICACAO } from "@/lib/fila-tipos";
 import { resolvePosts } from "@/lib/media-lookup";
 import {
   card,
@@ -87,27 +88,27 @@ export default async function DetalheDaPublicacao({
         `select q.*, a.username as conta_username
            from queue q
            left join accounts a on a.ig_user_id = q.account_id
-          where q.id = $1::uuid and q.account_id = $2 and q.kind = 'publicacao'`,
-        [id, conta.ig_user_id]
+          where q.id = $1::uuid and q.account_id = $2 and q.kind = any($3::text[])`,
+        [id, conta.ig_user_id, Array.from(TIPOS_DE_PUBLICACAO)]
       )) as Linha[])
     : [];
 
   const item = linhas[0];
   if (!item) notFound();
 
-  const p = lerPayloadDaPublicacao(item.payload);
   const quando = dataDaLinhaDeEnvio(item);
+  const pagina = paginaDoPost(item, quando);
   const atrasado = avisoDoAtrasoNaLista(quando);
   // `podeMexer` é sobre a AÇÃO (só `pending` se cancela ou se remarca), e a
   // frase sobre a MÍDIA é outra pergunta — ela depende de o post ter SAÍDO. As
   // duas moravam nesta mesma variável, e por isso um post falhado recebia
   // "este post já saiu". Ver `fraseSobreAMidia`.
   const podeMexer = item.status === "pending";
-  const sobreAMidia = fraseSobreAMidia(quando, item.error);
+  const sobreAMidia = pagina.sobreAMidia;
   // A MÍDIA SÓ EXISTE ENQUANTO O POST NÃO SAIU. Ver o cabeçalho.
   // AS URLS SÃO MONTADAS AQUI, e as que não derem saem da lista: `null` vira
   // imagem quebrada se chegar num `src`. Ver `urlPublicaSeDerParaMontar`.
-  const midia = (podeMexer ? (p?.caminhos ?? []) : [])
+  const midia = (podeMexer ? pagina.caminhos : [])
     .map((caminho) => ({ caminho, url: urlPublicaSeDerParaMontar(caminho) }))
     .filter((m): m is { caminho: string; url: string } => m.url !== null);
   // "VER NO INSTAGRAM" — O LINK É BUSCADO, E NÃO GUARDADO.
@@ -132,7 +133,7 @@ export default async function DetalheDaPublicacao({
   // `app/eventos/post-line.tsx`, que também só vira âncora quando há permalink.
   const idNoInstagram = mediaIdParaVerNoInstagram({
     saiu: quando.saiu,
-    mediaId: p?.mediaId ?? null,
+    mediaId: pagina.mediaIdNoInstagram,
   });
   const permalink =
     conta && idNoInstagram
@@ -155,7 +156,7 @@ export default async function DetalheDaPublicacao({
           ← Publicações
         </Link>
         <div className="mt-2 flex flex-wrap items-center gap-2">
-          <h1 className={pageTitle}>{rotuloDaFormaDoItem(p)}</h1>
+          <h1 className={pageTitle}>{pagina.titulo}</h1>
           {/* O SELO DIZ O ESTADO, e ele vem de `statusBadge` — a mesma função
               da tela de Atividade, que distingue o post que o DONO cancelou
               daquele que o SISTEMA pulou. Sem ele, esta tela não tinha como
@@ -181,11 +182,12 @@ export default async function DetalheDaPublicacao({
 
       <section className={`space-y-4 p-5 ${card}`}>
         <div>
-          <h2 className="titulo text-sm font-semibold">Legenda</h2>
+          <h2 className="titulo text-sm font-semibold">{pagina.tituloDoTexto}</h2>
           {/* A LEGENDA INTEIRA, e não o resumo da lista: esta tela é de um item
-              só, e quem chegou aqui veio justamente conferir o que vai sair. */}
+              só, e quem chegou aqui veio justamente conferir o que vai sair. No
+              LinkedIn, é o texto do post. */}
           <p className="mt-1 whitespace-pre-wrap text-sm">
-            {p?.legenda?.trim() ? p.legenda : <span className={muted}>Sem legenda.</span>}
+            {pagina.texto ?? <span className={muted}>{pagina.semTexto}</span>}
           </p>
         </div>
 
@@ -203,7 +205,7 @@ export default async function DetalheDaPublicacao({
                 // vem mudo e só com os metadados, que bastam para o primeiro
                 // quadro: baixar o vídeo inteiro para uma prévia de 96px seria
                 // pagar banda por nada.
-                p && ehVideoNoPost(p.forma, m.caminho) ? (
+                pagina.ehVideo(m.caminho) ? (
                   <span key={m.caminho} className="relative block h-24 w-24">
                     <video
                       src={m.url}
@@ -263,6 +265,19 @@ export default async function DetalheDaPublicacao({
             Ver no Instagram ↗
           </a>
         )}
+
+        {/* "VER NO LINKEDIN": o endereço sai do URN que o LinkedIn devolveu no post (`linkParaVerNoLinkedin`), sem
+            ida à rede. O mesmo par `target`/`rel` do link do Instagram, pelo mesmo motivo. */}
+        {pagina.linkNoLinkedin && (
+          <a
+            href={pagina.linkNoLinkedin}
+            target="_blank"
+            rel="noopener noreferrer"
+            className={`inline-block text-sm ${link}`}
+          >
+            Ver no LinkedIn ↗
+          </a>
+        )}
       </section>
 
       {podeMexer && (
@@ -312,10 +327,7 @@ export default async function DetalheDaPublicacao({
             <button className={btnDanger}>Cancelar este post</button>
           </form>
 
-          <p className={hint}>
-            Cancelar tira o post da fila e ele não sai. Se ele já tiver saído, só o
-            aplicativo do Instagram apaga — a API não apaga mídia.
-          </p>
+          <p className={hint}>{pagina.notaDoCancelar}</p>
         </section>
       )}
     </div>
```

Em `app/publicar/post/actions.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/publicar/post/actions.ts b/app/publicar/post/actions.ts
index e701d9f..7abbdc1 100644
--- a/app/publicar/post/actions.ts
+++ b/app/publicar/post/actions.ts
@@ -4,7 +4,7 @@ import { redirect } from "next/navigation";
 import { getSelectedAccount } from "@/lib/account";
 import { getConfig, sql } from "@/lib/db";
 import { HORIZONTE_DO_TIQUE_EM_SEGUNDOS, scheduleTick } from "@/lib/qstash";
-import { drainQueue, limparOBucket } from "@/lib/queue-drain";
+import { drainQueue, drenarUmaPublicacaoDoLinkedin, limparOBucket } from "@/lib/queue-drain";
 import {
   atrasoDoTiqueDaPublicacao,
   camposDaDataHora,
@@ -14,7 +14,6 @@ import {
   fusoDoCampo,
   identificadorDaFila,
   instanteDoAgendamento,
-  lerPayloadDaPublicacao,
   momentoDaPublicacao,
   textoDaRecusaDaPublicacao,
   MOTIVO_CANCELADO_PELO_DONO,
@@ -22,6 +21,10 @@ import {
 } from "@/lib/publicacao";
 import { avisoDoDesfecho, urlDeAgendadosComAviso } from "@/lib/avisos";
 import { exigirSessao } from "@/lib/exigir-sessao";
+// O POST DE QUALQUER REDE (a parte 2a do LinkedIn): as duas ações valem para os tipos de post da fila, os arquivos
+// a apagar e o aviso do "já saiu" saem do payload e da rede da linha.
+import { TIPOS_DE_PUBLICACAO } from "@/lib/fila-tipos";
+import { avisoDoDesfechoDoPost, caminhosDoPostDaFila, ehPostDoLinkedin } from "@/lib/post-da-fila";
 
 /**
  * CANCELAR E REMARCAR UM POST AGENDADO.
@@ -50,9 +53,10 @@ import { exigirSessao } from "@/lib/exigir-sessao";
  *
  *   `status = 'pending'` fecha a corrida com o dreno (acima);
  *   `account_id`         impede cancelar o post de OUTRA conta;
- *   `kind = 'publicacao'` impede que um identificador trocado atinja uma
- *                        MENSAGEM da fila — o `id` é `uuid` e a tabela é a
- *                        mesma para os onze tipos.
+ *   `kind` na lista dos tipos de post (`TIPOS_DE_PUBLICACAO`, lib/fila-tipos.ts:
+ *                        o do Instagram e o do LinkedIn) impede que um
+ *                        identificador trocado atinja uma MENSAGEM da fila — o
+ *                        `id` é `uuid` e a tabela é a mesma para os doze tipos.
  *
  * A CONTA VEM DO COOKIE DE SELEÇÃO, NUNCA DO FORMULÁRIO. É a mesma porta que
  * `alvoDoLote` (lib/lote.ts) fecha no envio em lote e que `caminhosDoCampo`
@@ -78,10 +82,10 @@ import { exigirSessao } from "@/lib/exigir-sessao";
  */
 
 /** O `where` das duas ações, escrito UMA vez. Ver as três defesas no cabeçalho.
- *  Ele é constante do código, e os valores entram como `$1`/`$2` — nenhum texto
- *  do navegador é concatenado aqui. */
+ *  Ele é constante do código, e os valores entram como `$1`/`$2`/`$4` (os tipos
+ *  de post) — nenhum texto do navegador é concatenado aqui. */
 const ALVO_DA_MUDANCA =
-  `where id = $1 and account_id = $2 and kind = 'publicacao' and status = 'pending'`;
+  `where id = $1 and account_id = $2 and kind = any($4::text[]) and status = 'pending'`;
 
 /**
  * O STATUS do item, ignorando o filtro de status — ou `null` se ele não existe.
@@ -102,12 +106,13 @@ const ALVO_DA_MUDANCA =
  * responderia um status e faria a tela dizer que o post de outra pessoa já saiu —
  * que é contar sobre a fila alheia.
  */
-async function statusNaConta(id: string, contaId: string): Promise<string | null> {
+async function statusNaConta(id: string, contaId: string): Promise<{ status: string; kind: string } | null> {
+  // O `kind` VOLTA JUNTO (a parte 2a do LinkedIn): é ele que escolhe o aviso do "já saiu" de cada rede.
   const linhas = (await sql().query(
-    `select status from queue where id = $1 and account_id = $2 and kind = 'publicacao'`,
-    [id, contaId]
-  )) as { status: string }[];
-  return linhas[0]?.status ?? null;
+    `select status, kind from queue where id = $1 and account_id = $2 and kind = any($3::text[])`,
+    [id, contaId, Array.from(TIPOS_DE_PUBLICACAO)]
+  )) as { status: string; kind: string }[];
+  return linhas[0] ?? null;
 }
 
 /** As duas telas que uma mudança desatualiza: a lista de agendados (um item a
@@ -161,17 +166,16 @@ export async function cancelarPublicacao(formData: FormData): Promise<void> {
   const afetadas = (await sql().query(
     `update queue set status = 'skipped', error = $3
      ${ALVO_DA_MUDANCA}
-     returning id, payload`,
-    [id, conta.ig_user_id, MOTIVO_CANCELADO_PELO_DONO]
-  )) as { id: string; payload: unknown }[];
+     returning id, kind, payload`,
+    [id, conta.ig_user_id, MOTIVO_CANCELADO_PELO_DONO, Array.from(TIPOS_DE_PUBLICACAO)]
+  )) as { id: string; kind: string; payload: unknown }[];
 
   // A SEGUNDA CONSULTA SÓ NO CAMINHO DE FALHA, e é o `?` que garante isso: com
   // linha afetada não há pergunta a fazer, e o `null` que entra é lido como
   // "não interessa" por `desfechoDaMudanca`, que já respondeu "feito" antes.
-  const desfecho = desfechoDaMudanca(
-    afetadas.length,
-    afetadas.length > 0 ? null : await statusNaConta(id, conta.ig_user_id)
-  );
+  const naConta = afetadas.length > 0 ? null : await statusNaConta(id, conta.ig_user_id);
+  const desfecho = desfechoDaMudanca(afetadas.length, naConta?.status ?? null);
+  const rede = afetadas[0]?.kind ?? naConta?.kind ?? null;
 
   // A MÍDIA DO POST CANCELADO SAI DO BUCKET, e o cancelamento é o outro caso em
   // que o arquivo é ÓRFÃO DE VERDADE.
@@ -189,7 +193,8 @@ export async function cancelarPublicacao(formData: FormData): Promise<void> {
   // um post que a Meta está BAIXANDO neste instante quebraria a publicação, do
   // jeito difícil de ler que o cabeçalho daquela função descreve.
   //
-  // PAYLOAD ILEGÍVEL NÃO APAGA NADA: `lerPayloadDaPublicacao` recusa em vez de
+  // PAYLOAD ILEGÍVEL NÃO APAGA NADA: o leitor do payload de cada rede
+  // (`caminhosDoPostDaFila`, lib/post-da-fila.ts) recusa em vez de
   // confiar num `jsonb` que pode ter sido editado por fora, e um caminho vindo
   // de um payload que ninguém entende é a última coisa que se quer entregar a um
   // `DELETE`.
@@ -199,12 +204,14 @@ export async function cancelarPublicacao(formData: FormData): Promise<void> {
   // segunda tentativa —, e o que ela faz na falha é registrar em Atividade. O
   // `redirect` de baixo continua sendo a única saída desta ação.
   if (afetadas.length > 0) {
-    const pub = lerPayloadDaPublicacao(afetadas[0].payload);
-    if (pub) await limparOBucket(afetadas[0], pub.caminhos, conta.ig_user_id);
+    // Os caminhos saem do payload da rede da linha (`caminhosDoPostDaFila`): o post do LinkedIn só de texto não
+    // tem arquivo, e o com imagem tem um.
+    const caminhos = caminhosDoPostDaFila(afetadas[0].kind, afetadas[0].payload);
+    if (caminhos) await limparOBucket(afetadas[0], caminhos, conta.ig_user_id);
   }
 
   revalidarAsDuasTelas();
-  redirect(urlDeAgendadosComAviso(avisoDoDesfecho(desfecho, "cancelar")));
+  redirect(urlDeAgendadosComAviso(avisoDoDesfechoDoPost(desfecho, "cancelar", rede)));
 }
 
 export async function remarcarPublicacao(formData: FormData): Promise<void> {
@@ -255,16 +262,14 @@ export async function remarcarPublicacao(formData: FormData): Promise<void> {
   const afetadas = (await sql().query(
     `update queue set not_before = greatest(now(), $3::timestamptz)
      ${ALVO_DA_MUDANCA}
-     returning id,
+     returning id, kind,
                (not_before <= now()) as ja_vale,
                greatest(0, ceil(extract(epoch from (not_before - now()))))::int as falta`,
-    [id, conta.ig_user_id, momento.quando]
-  )) as { id: string; ja_vale: boolean; falta: number }[];
+    [id, conta.ig_user_id, momento.quando, Array.from(TIPOS_DE_PUBLICACAO)]
+  )) as { id: string; kind: string; ja_vale: boolean; falta: number }[];
 
-  const desfecho = desfechoDaMudanca(
-    afetadas.length,
-    afetadas.length > 0 ? null : await statusNaConta(id, conta.ig_user_id)
-  );
+  const naConta = afetadas.length > 0 ? null : await statusNaConta(id, conta.ig_user_id);
+  const desfecho = desfechoDaMudanca(afetadas.length, naConta?.status ?? null);
 
   // O TIQUE DA HORA NOVA, e ele é o outro lado de "Ele sai na hora nova".
   //
@@ -292,10 +297,13 @@ export async function remarcarPublicacao(formData: FormData): Promise<void> {
   // tarde; com uma exceção subindo daqui, o `redirect` de baixo nunca
   // aconteceria e a ação voltaria muda.
   if (desfecho === "feito") {
-    const { ja_vale, falta } = afetadas[0];
+    const { ja_vale, falta, kind } = afetadas[0];
     if (ja_vale) {
       try {
-        await drainQueue();
+        // O POST DO LINKEDIN DRENA SÓ A PRÓPRIA LINHA (achado 211), como o "agora" do compor: o dreno inteiro
+        // mandaria também as mensagens vencidas do banco, que é um só para a produção e os previews.
+        if (ehPostDoLinkedin(kind)) await drenarUmaPublicacaoDoLinkedin(id);
+        else await drainQueue();
       } catch {
         // A trava atômica garante que o próximo dreno recupera, como no compor.
       }
```

Em `app/page.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/page.tsx b/app/page.tsx
index 2395db2..faa1644 100644
--- a/app/page.tsx
+++ b/app/page.tsx
@@ -25,6 +25,7 @@ import { fraseDoPulso, fraseDas24h } from "@/lib/pulso";
 // divergência. STATUS_DE_FILA_VIVA é a mesma ideia para "o que ainda vai
 // sair" (mora ao lado, no mesmo arquivo).
 import { KINDS_FORA_DA_ENTREGA_DO_MOTOR, STATUS_DE_FILA_VIVA } from "@/lib/envio-filters";
+import { TIPOS_DE_PUBLICACAO } from "@/lib/fila-tipos";
 // TIPOS_DE_MENSAGEM_RECEBIDA É A MESMA LISTA QUE app/contatos/page.tsx e
 // app/contatos/actions.ts usam: os quatro `type` de evento que significam
 // "alguém falou com a conta". Escrevê-la à mão aqui foi o defeito medido em
@@ -151,12 +152,15 @@ export default async function Home({
                  -- testes-integracao/nao-saiu.integracao.ts.
                  -- (sem crases neste comentario: ele mora DENTRO de um template
                  --  literal, e uma crase o fecharia no meio.)
+                 -- OS TIPOS DE POST SAO UMA LISTA ($7, TIPOS_DE_PUBLICACAO de
+                 -- lib/fila-tipos.ts): o post do LinkedIn que falha e aviso de
+                 -- publicacao, e nao de mensagem.
                  (select count(*)::int from queue where account_id = $1 and status = 'failed'
-                    and kind = 'publicacao'
+                    and kind = any($7::text[])
                     and coalesce(claimed_at, not_before)
                         > now() - make_interval(days => $2::int)) as falhas_publicacao,
                  (select count(*)::int from queue where account_id = $1 and status = 'failed'
-                    and kind <> 'publicacao'
+                    and not (kind = any($7::text[]))
                     and created_at > now() - make_interval(hours => $3::int))
                     as falhas_mensagem,
                  -- O PULSO. "hoje" e o dia de SAO PAULO, e nao de UTC: o
@@ -223,6 +227,7 @@ export default async function Home({
             Array.from(KINDS_FORA_DA_ENTREGA_DO_MOTOR),
             Array.from(STATUS_DE_FILA_VIVA),
             Array.from(TIPOS_DE_MENSAGEM_RECEBIDA),
+            Array.from(TIPOS_DE_PUBLICACAO),
           ]
         )) as Omit<Sinais, "medido">[];
         return linhas[0] ? { ...linhas[0], medido: true } : ZERO;
```

Em `lib/envio-filters.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/envio-filters.ts b/lib/envio-filters.ts
index 0dc3d7c..68b633c 100644
--- a/lib/envio-filters.ts
+++ b/lib/envio-filters.ts
@@ -7,6 +7,7 @@
 // de períodos discordariam no dia em que alguém mexesse numa delas.
 
 import { PERIODS, type PeriodKey } from "./event-filters";
+import { TIPOS_DE_PUBLICACAO } from "./fila-tipos";
 
 // Quantos envios a lista mostra por padrão. A seção precisa caber em uma tela
 // de 1366×623 sem rolar, e é o número de linhas que decide isso. O que fica de
@@ -30,17 +31,6 @@ export function origemDoKind(kind: string): OrigemKey {
   return (KINDS_MANUAIS as readonly string[]).includes(kind) ? "voce" : "robo";
 }
 
-/**
- * O `kind` da PUBLICAÇÃO, e ele merece nome porque é a exceção mais repetida
- * deste produto: publicação usa a mesma fila das mensagens e não é mensagem.
- *
- * O dreno já o separa, com o motivo escrito (`lib/queue-drain.ts`): um post não
- * pode comer a cota de DM. As telas precisam da mesma separação por outro
- * motivo — "mensagens entregues" com post dentro é um número que mente sobre a
- * saúde do motor.
- */
-export const KIND_PUBLICACAO = "publicacao";
-
 /**
  * OS KINDS QUE NÃO CONTAM COMO "O MOTOR ENTREGOU".
  *
@@ -52,15 +42,19 @@ export const KIND_PUBLICACAO = "publicacao";
  * do motor faz a tela dizer que está tudo rodando quando quem está rodando é
  * gente. Medido em 15/09: era exatamente esse o risco no pulso do Início.
  *
- * `publicacao` é post, não mensagem — ver `KIND_PUBLICACAO`. Medido no mesmo
- * dia: `/desempenho` dizia "Mensagens entregues: 5" com 3 entregues.
+ * os tipos de POST (`TIPOS_DE_PUBLICACAO`, lib/fila-tipos.ts: o do Instagram
+ * e, desde a parte 2a do LinkedIn, o do LinkedIn) não são mensagem: usam a
+ * mesma fila e não são entrega do motor. O dreno já os separa, com o motivo
+ * escrito (`lib/queue-drain.ts`): um post não pode comer a cota de DM. Medido
+ * no mesmo dia: `/desempenho` dizia "Mensagens entregues: 5" com 3 entregues.
+ * Até a parte 2a, este lugar tinha uma constante própria só com `publicacao`.
  *
- * DERIVADA DE `KINDS_MANUAIS`, e não reescrita: um kind manual novo entra aqui
- * sozinho no dia em que nascer.
+ * DERIVADA DE `KINDS_MANUAIS` e de `TIPOS_DE_PUBLICACAO`, e não reescrita: um
+ * kind novo de uma das duas entra aqui sozinho no dia em que nascer.
  */
 export const KINDS_FORA_DA_ENTREGA_DO_MOTOR = [
   ...KINDS_MANUAIS,
-  KIND_PUBLICACAO,
+  ...TIPOS_DE_PUBLICACAO,
 ] as const;
 
 /**
```

Em `lib/bonus/publicar-repositorio.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/bonus/publicar-repositorio.ts b/lib/bonus/publicar-repositorio.ts
index 0049b42..c6d4de3 100644
--- a/lib/bonus/publicar-repositorio.ts
+++ b/lib/bonus/publicar-repositorio.ts
@@ -1,6 +1,7 @@
 import "server-only";
 import { pastaDaConta } from "@/lib/bucket";
 import { sql } from "@/lib/db";
+import { TIPOS_DE_PUBLICACAO } from "@/lib/fila-tipos";
 import { comEspaco, ehCapa, escolhasDaArte } from "./arte-escolhas";
 import { slidesDoTexto } from "./arte-slides";
 import type { LinhaDoCarrossel } from "./carrossel-linha";
@@ -101,13 +102,16 @@ export async function gravarImagemDoSlide(
   });
 }
 
-/** Os caminhos desta lista que aparecem no payload de algum item de publicação da fila. */
+/**
+ * Os caminhos desta lista que aparecem no payload de algum item de publicação da fila, de qualquer rede
+ * (`TIPOS_DE_PUBLICACAO`, lib/fila-tipos.ts; a parte 2a do LinkedIn).
+ */
 export async function caminhosNaFila(caminhos: string[]): Promise<string[]> {
   const achados: string[] = [];
   for (const caminho of caminhos) {
     const [r] = (await sql().query(
-      `select exists (select 1 from queue where kind = 'publicacao' and payload->'caminhos' ? $1) as achou`,
-      [caminho]
+      `select exists (select 1 from queue where kind = any($2::text[]) and payload->'caminhos' ? $1) as achou`,
+      [caminho, Array.from(TIPOS_DE_PUBLICACAO)]
     )) as { achou: boolean }[];
     if (r?.achou) achados.push(caminho);
   }
```

Em `lib/engine.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/engine.ts b/lib/engine.ts
index fb6c3a1..eb29216 100644
--- a/lib/engine.ts
+++ b/lib/engine.ts
@@ -332,7 +332,7 @@ async function enqueue(item: {
   //
   // O TETO É O HORIZONTE, aplicado depois da folga (achado 102, escolha do
   // Eduardo em 15/10). O "Esperar" do editor não tem teto, e o cron diário só
-  // arma posts (`armarTiquesDoDia` filtra `kind = 'publicacao'`): uma espera de
+  // arma posts (`armarTiquesDoDia` filtra os tipos de post): uma espera de
   // dois dias pedia ao QStash 172805 s, um horizonte que ninguém conferiu, e a
   // recusa dele seria engolida por `scheduleTick`. Com o teto, o tique acorda o
   // dreno em um dia, e o rodapé do dreno arma o seguinte, já dentro do
```

O post do Instagram sai pelas mesmas funções de antes (`lib/publicacao.ts`), sem mudar uma letra do que a tela mostrava. O do LinkedIn leva "LinkedIn · " na frente do nome, no molde da linha do convite do LinkedIn.

- [ ] **Passo 4: rodar e ver passar**

```bash
env -u CLAUDECODE -u AI_AGENT npx --no-install vitest run
env -u CLAUDECODE -u AI_AGENT npx --no-install vitest run --config vitest.dom.config.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" \
  npx --no-install vitest run --config vitest.integracao.config.ts \
  testes-integracao/linkedin-telas.integracao.ts testes-integracao/agendados.integracao.ts \
  testes-integracao/nao-saiu.integracao.ts testes-integracao/pulso-do-inicio.integracao.ts \
  testes-integracao/desempenho.integracao.ts testes-integracao/bonus-publicar-repositorio.integracao.ts \
  testes-integracao/bonus-publicar-processo.integracao.ts
npx --no-install tsc --noEmit
npx --no-install eslint lib/post-da-fila.ts lib/linkedin-publicacao.ts app/publicar app/page.tsx lib/envio-filters.ts \
  lib/bonus/publicar-repositorio.ts lib/engine.ts testes-integracao/linkedin-telas.integracao.ts \
  tests/post-da-fila.test.ts tests/envio-filters.test.ts tests/publicar-previas.test.ts
git grep -n "kind = 'publicacao'\|kind <> 'publicacao'" -- app lib
```

Esperado: nos puros, "Test Files 154 passed (154)" e "Tests 3697 passed (3697)"; na tela, "Test Files 35 passed (35)" e "Tests 315 passed (315)"; na integração, `ALVO: banco de TESTE`, "Test Files 7 passed (7)" e "Tests 162 passed (162)", e o `tsc` e o lint sem saída. O `git grep` só acha comentários: todo ponto do código pergunta à lista `TIPOS_DE_PUBLICACAO`, fora o ramo do Instagram no dreno (`item.kind === "publicacao"`), que é dele.

- [ ] **Passo 5: o commit**

A mensagem do commit, gravada em `$SCRATCH/msg-li2-f4.txt`:

```text
As telas de Publicações, o cancelar e o remarcar valem para o post do LinkedIn, com a rede no nome e o Ver no LinkedIn
```

```bash
git add -- lib/post-da-fila.ts lib/linkedin-publicacao.ts app/publicar/page.tsx "app/publicar/post/[id]/page.tsx" \
  app/publicar/post/actions.ts app/page.tsx lib/envio-filters.ts lib/bonus/publicar-repositorio.ts lib/engine.ts \
  testes-integracao/linkedin-telas.integracao.ts tests/post-da-fila.test.ts tests/envio-filters.test.ts \
  tests/publicar-previas.test.ts
git commit -F "$SCRATCH/msg-li2-f4.txt"
```

---

### FASE 5 — A tela de compor e a action do LinkedIn

**Arquivos:** `app/publicar/actions.ts`, `app/publicar/enviador.tsx`, `app/publicar/novo/page.tsx`, `lib/linkedin-fila.ts`, `lib/linkedin-publicacao.ts`, `app/page.tsx`, `lib/pulso.ts`, `testes-dom/publicar-compositor-linkedin.dom.tsx` (novo), `testes-integracao/linkedin-compor.integracao.ts` (novo), `testes-integracao/linkedin-publicacao.integracao.ts`, `tests/dreno-com-prazo.test.ts`, `tests/linkedin-compor.test.ts` (novo), `tests/linkedin-token-fora-do-cliente.test.ts`, `tests/publicar-compositor-guarda.test.ts`.

- [ ] **Passo 1: os testes**

Crie `tests/linkedin-compor.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  avisoDoPostNoLinkedin,
  disponibilidadeDoLinkedin,
  LIMITE_DO_TEXTO_DO_LINKEDIN,
  novoIdDoEnvio,
  recusaDoPedidoNoLinkedin,
  tamanhoDoTextoNoLinkedin,
  textoDaRecusaNoLinkedin,
} from "@/lib/linkedin-publicacao";

// O COMPOR DO POST NO LINKEDIN (docs/specs/2026-11-06-linkedin-no-perfil.md, §7; a parte 2a). A tela confere o
// pedido antes de subir o arquivo, e a action confere de novo no servidor, pela MESMA função
// (`recusaDoPedidoNoLinkedin`), que conta o texto pela mesma `tamanhoDoTextoNoLinkedin` do contador.

const ENVIO = "9f1c2e3d-0000-4000-8000-000000000001";
const pedido = (p: Partial<Parameters<typeof recusaDoPedidoNoLinkedin>[0]> = {}) =>
  recusaDoPedidoNoLinkedin({ forma: "texto", caminhos: [], texto: "Olá #mundo", idDoEnvio: ENVIO, ...p });

describe("as recusas do pedido de publicar no LinkedIn", () => {
  it("o pedido certo passa, nas duas formas", () => {
    expect(pedido()).toBeNull();
    expect(pedido({ forma: "imagem", caminhos: ["conta/foto.jpg"] })).toBeNull();
  });

  it("a forma que não é do LinkedIn", () => {
    expect(pedido({ forma: null })).toBe("forma_desconhecida");
  });

  it("a quantidade de arquivos é a da forma: o só texto não leva arquivo, a imagem leva um", () => {
    expect(pedido({ caminhos: ["conta/foto.jpg"] })).toBe("quantidade");
    expect(pedido({ forma: "imagem", caminhos: [] })).toBe("quantidade");
    expect(pedido({ forma: "imagem", caminhos: ["conta/a.jpg", "conta/b.jpg"] })).toBe("quantidade");
  });

  it("o texto vazio, nas duas formas", () => {
    expect(pedido({ texto: "   " })).toBe("texto_vazio");
    expect(pedido({ forma: "imagem", caminhos: ["conta/foto.jpg"], texto: "" })).toBe("texto_vazio");
  });

  it("o texto longo é contado depois das hashtags e dos escapes, como o contador da tela", () => {
    // 2.990 letras e duas hashtags: 2.998 caracteres digitados, e bem mais de 3.000 no LinkedIn.
    const texto = `${"a".repeat(2990)} #ab #cd`;
    expect(Array.from(texto).length).toBeLessThanOrEqual(LIMITE_DO_TEXTO_DO_LINKEDIN);
    expect(tamanhoDoTextoNoLinkedin(texto)).toBeGreaterThan(LIMITE_DO_TEXTO_DO_LINKEDIN);
    expect(pedido({ texto })).toBe("texto_longo");
    expect(pedido({ texto: "a".repeat(LIMITE_DO_TEXTO_DO_LINKEDIN) })).toBeNull();
  });

  it("o envio sem o id que a tela gera", () => {
    expect(pedido({ idDoEnvio: "" })).toBe("envio_sem_id");
    expect(pedido({ idDoEnvio: "nao-e-um-id" })).toBe("envio_sem_id");
  });

  it("o id que a tela gera passa, e cada formulário tem o seu", () => {
    const ids = Array.from({ length: 50 }, novoIdDoEnvio);
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(pedido({ idDoEnvio: id })).toBeNull();
    }
    expect(new Set(ids).size).toBe(50);
  });

  it("cada recusa tem a sua frase, e a do texto longo diz por que conta mais", () => {
    const frases = (["forma_desconhecida", "quantidade", "texto_vazio", "texto_longo", "envio_sem_id"] as const).map(
      textoDaRecusaNoLinkedin
    );
    expect(new Set(frases).size).toBe(5);
    expect(textoDaRecusaNoLinkedin("texto_longo")).toContain("3.000");
    expect(textoDaRecusaNoLinkedin("texto_longo")).toContain("hashtags");
  });
});

describe("o LinkedIn da conta, na tela de compor", () => {
  const agora = Date.parse("2026-11-10T12:00:00Z");

  it("sem conexão, ele fica desligado, com o motivo", () => {
    const d = disponibilidadeDoLinkedin(null, agora);
    expect(d.disponivel).toBe(false);
    expect(!d.disponivel && d.motivo).toContain("não tem LinkedIn conectado");
  });

  it("vencido, ele fica desligado, com o nome e o que fazer", () => {
    const d = disponibilidadeDoLinkedin({ nome: "Dra. Ana", expira_em: new Date(agora - 1000) }, agora);
    expect(d.disponivel).toBe(false);
    expect(!d.disponivel && d.motivo).toContain("Dra. Ana");
    expect(!d.disponivel && d.motivo).toContain("venceu");
  });

  it("dentro da validade, ele fica ligado, com o nome", () => {
    expect(disponibilidadeDoLinkedin({ nome: "Dra. Ana", expira_em: "2026-12-10T12:00:00Z" }, agora)).toEqual({
      disponivel: true,
      nome: "Dra. Ana",
    });
  });
});

describe("o aviso depois de publicar no LinkedIn", () => {
  it("agora, publicado", () => {
    expect(avisoDoPostNoLinkedin({ desfecho: "publicado", agendadoPara: null })).toEqual({
      tom: "ok",
      texto: "Post publicado no LinkedIn.",
    });
  });

  it("agora, na fila: vai sair em instantes (também quando outro dreno o pegou antes)", () => {
    for (const desfecho of ["aguardando", null] as const) {
      const a = avisoDoPostNoLinkedin({ desfecho, agendadoPara: null });
      expect(a.tom).toBe("ok");
      expect(a.texto).toContain("vai sair em instantes");
    }
  });

  it("agora, falhou: o motivo vai junto", () => {
    const a = avisoDoPostNoLinkedin({ desfecho: "falhou", motivo: "LinkedIn 403: sem permissão", agendadoPara: null });
    expect(a.tom).toBe("erro");
    expect(a.texto).toContain("LinkedIn 403: sem permissão");
  });

  it("agendado: a hora escolhida, com dois dígitos", () => {
    expect(avisoDoPostNoLinkedin({ desfecho: null, agendadoPara: { dia: 5, mes: 12, hora: 9, minuto: 7 } })).toEqual({
      tom: "ok",
      texto: "Post do LinkedIn agendado para 05/12 às 09:07. Acompanhe em Publicações.",
    });
  });
});
```

Em `tests/dreno-com-prazo.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/dreno-com-prazo.test.ts b/tests/dreno-com-prazo.test.ts
index 6d9c249..2a01410 100644
--- a/tests/dreno-com-prazo.test.ts
+++ b/tests/dreno-com-prazo.test.ts
@@ -13,6 +13,21 @@ import { describe, expect, it } from "vitest";
 const RAIZ = process.cwd();
 const ROTAS = ["app/api/queue/tick/route.ts", "app/api/webhook/route.ts", "app/api/cron/daily/route.ts"];
 
+// O "AGORA" DA TELA DE COMPOR DO LINKEDIN (app/publicar/actions.ts, `publicarNoLinkedin`) também: a hora é marcada
+// logo depois da sessão (a primeira linha de toda action é `await exigirSessao();`, tests/sessao-nas-actions.test.ts)
+// e vai ao `drenarUmaPublicacaoDoLinkedin`, e não a hora de depois do enfileirar.
+describe("a action de publicar no LinkedIn passa o começo da função ao \"agora\"", () => {
+  it("app/publicar/actions.ts", () => {
+    const fonte = readFileSync(join(RAIZ, "app/publicar/actions.ts"), "utf8").replace(/\r\n/g, "\n");
+    const inicio = fonte.indexOf("export async function publicarNoLinkedin(");
+    expect(inicio).toBeGreaterThan(-1);
+    const fim = fonte.indexOf("\nexport ", inicio + 1);
+    const corpo = fonte.slice(inicio, fim === -1 ? undefined : fim);
+    expect(corpo).toMatch(/\{\n {2}await exigirSessao\(\);\n {2}const inicioDaFuncaoMs = Date\.now\(\);\n/);
+    expect(corpo).toMatch(/drenarUmaPublicacaoDoLinkedin\(\s*[\w.]+,\s*inicioDaFuncaoMs\s*\)/);
+  });
+});
+
 describe("as rotas que drenam passam o começo da função ao dreno", () => {
   for (const rota of ROTAS) {
     it(rota, () => {
```

Em `tests/linkedin-token-fora-do-cliente.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/linkedin-token-fora-do-cliente.test.ts b/tests/linkedin-token-fora-do-cliente.test.ts
index 8140179..22b2a4a 100644
--- a/tests/linkedin-token-fora-do-cliente.test.ts
+++ b/tests/linkedin-token-fora-do-cliente.test.ts
@@ -41,7 +41,10 @@ describe("a autorização do LinkedIn fica no servidor", () => {
 
   it("só estes arquivos importam o repositório da conexão", () => {
     const importam = CODIGO.filter((rel) => IMPORTA_O_REPOSITORIO.test(ler(rel)));
+    // A parte 2a: a tela de compor e a action de publicar leem só o resumo (a disponibilidade do LinkedIn).
     expect(importam).toEqual([
+      "app/publicar/actions.ts",
+      "app/publicar/novo/page.tsx",
       "app/setup/actions.ts",
       "app/setup/page.tsx",
       "lib/convites-repositorio.ts",
@@ -49,6 +52,14 @@ describe("a autorização do LinkedIn fica no servidor", () => {
     ]);
   });
 
+  it("a tela de compor e a action de publicar leem só o resumo", () => {
+    for (const rel of ["app/publicar/actions.ts", "app/publicar/novo/page.tsx"]) {
+      const fonte = ler(rel);
+      expect(fonte, rel).toMatch(/\bresumoDaConexao\(/);
+      expect(fonte, rel).not.toMatch(/conexaoDaConta|access_token|accessToken/);
+    }
+  });
+
   it("a linha inteira, com o token, só sai pela conexaoDaConta, e só o post da fila a chama", () => {
     // A parte 2a: o post do LinkedIn pela fila (lib/linkedin-fila.ts, chamado pelo dreno) é o único que precisa da
     // autorização.
```

Em `tests/publicar-compositor-guarda.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/publicar-compositor-guarda.test.ts b/tests/publicar-compositor-guarda.test.ts
index cdca0dd..26919ca 100644
--- a/tests/publicar-compositor-guarda.test.ts
+++ b/tests/publicar-compositor-guarda.test.ts
@@ -22,8 +22,12 @@ describe("o compositor do /publicar", () => {
   const montar = funcao(fonte, "async function montarOPedido\\(\\): Promise<FormData \\| null>");
   const liberar = funcao(fonte, "function liberar\\(\\)");
 
+  // DESDE A PARTE 2a DO LINKEDIN, a action é a da rede do clique (`destino`): a do Instagram ou a do LinkedIn,
+  // escolhida antes de qualquer espera, como o formulário.
   it("acha as funções do clique", () => {
-    expect(publicar).toContain("await acao(dados);");
+    expect(publicar).toContain("await destino(dados);");
+    expect(publicar).toContain("const destino = noLinkedin ? (acaoDoLinkedin ?? acao) : acao;");
+    expect(publicar.indexOf("const destino =")).toBeLessThan(publicar.indexOf("await"));
     expect(montar).toContain("await subirTodos(");
     expect(liberar).toContain("trava.current = false;");
   });
@@ -36,7 +40,7 @@ describe("o compositor do /publicar", () => {
   // O ACHADO 116: a subida dentro da transição prenderia a navegação do menu até ela acabar. Dentro do
   // `iniciar` fica só a espera da action, que é o que a sonda mediu.
   it("dentro da transição fica só a action, e a subida corre fora dela", () => {
-    expect(publicar).toMatch(/iniciar\(async \(\) => \{\s*try \{\s*await acao\(dados\);\s*\} finally \{\s*liberar\(\);\s*\}\s*\}\);/);
+    expect(publicar).toMatch(/iniciar\(async \(\) => \{\s*try \{\s*await destino\(dados\);\s*\} finally \{\s*liberar\(\);\s*\}\s*\}\);/);
     expect(publicar.indexOf("await montarOPedido()")).toBeGreaterThan(-1);
     expect(publicar.indexOf("await montarOPedido()")).toBeLessThan(publicar.indexOf("iniciar("));
   });
@@ -77,5 +81,8 @@ describe("a página de compor", () => {
   it("entrega a action ao compositor, e não monta o formulário dela", () => {
     expect(pagina).toContain("acao={publicar}");
     expect(pagina).not.toContain("<form action={publicar}");
+    // A do LinkedIn (a parte 2a) também.
+    expect(pagina).toContain("acaoDoLinkedin={publicarNoLinkedin}");
+    expect(pagina).not.toContain("<form action={publicarNoLinkedin}");
   });
 });
```

Crie `testes-dom/publicar-compositor-linkedin.dom.tsx`:

```tsx
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Enviador from "@/app/publicar/enviador";
import { limparEnvios } from "@/app/publicar/envios";
import type { Medidas, Navegador } from "@/app/publicar/navegador";
import {
  NOTA_DO_CONTADOR_DO_LINKEDIN,
  tamanhoDoTextoNoLinkedin,
  textoDaRecusaNoLinkedin,
  type DisponibilidadeDoLinkedin,
} from "@/lib/linkedin-publicacao";

// O COMPOR DO POST NO LINKEDIN (docs/specs/2026-11-06-linkedin-no-perfil.md, §7; a parte 2a: uma rede por post).
// A tela escolhe a rede; no LinkedIn, a forma é "Só texto" ou "Imagem", o campo é "Texto" com o contador que conta
// como o LinkedIn (achado 212), e o clique chama a action do LinkedIn, e só ela. O navegador e as actions são
// falsos, como no teste do compositor (testes-dom/publicar-compositor.dom.tsx).

const MIB = 1024 * 1024;
const PASTA = "17841400000000002";
const MEDIDAS: Record<string, Medidas> = { "arte.jpg": { largura: 1080, altura: 1350 } };

function navegadorFalso() {
  const f = { assinados: [] as { forma: string; nome: string }[] };
  const nav: Navegador = {
    criarEndereco: (a) => `blob:${a.name}`,
    soltarEndereco: () => {},
    medir: async (a) => MEDIDAS[a.name] ?? {},
    lerOrientacao: async () => 1,
    enquadrar: async (a) => new File(["jpeg"], a.name, { type: "image/jpeg" }),
    converter: async (a) => a,
    assinar: async (p) => {
      f.assinados.push({ forma: p.forma, nome: p.nome });
      return { ok: true, caminho: `${PASTA}/${p.nome.replace(/\.\w+$/, "")}.jpg`, url: `https://bucket.test/${p.nome}` };
    },
    subir: async (_url, arquivo, aoAndar) => {
      aoAndar(arquivo.size, arquivo.size);
    },
  };
  return { f, nav };
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

const LIGADO: DisponibilidadeDoLinkedin = { disponivel: true, nome: "Dra. Ana Souza" };

function renderizar(linkedin: DisponibilidadeDoLinkedin | null) {
  const { f, nav } = navegadorFalso();
  const acao = vi.fn(async (_dados: FormData) => {});
  const acaoDoLinkedin = vi.fn(async (_dados: FormData) => {});
  render(
    <Enviador
      teto={50 * MIB}
      pasta={PASTA}
      acao={acao}
      linkedin={linkedin}
      acaoDoLinkedin={acaoDoLinkedin}
      navegador={nav}
      quando={QUANDO}
      opcoesDoReels={<p>opções do reels</p>}
      rodape={<p>rodapé</p>}
    />
  );
  return { f, acao, acaoDoLinkedin };
}

const botao = () => screen.getByRole("button", { name: /^(Publicar|Enviando…)$/ }) as HTMLButtonElement;
const campoDoTexto = () => screen.getByLabelText("Texto") as HTMLTextAreaElement;

afterEach(() => {
  limparEnvios();
  vi.restoreAllMocks();
});

describe("a rede do post", () => {
  it("sem o LinkedIn na página, a tela é só do Instagram, como antes", () => {
    renderizar(null);
    expect(screen.queryByLabelText("LinkedIn")).toBeNull();
    expect(screen.getByLabelText("Legenda")).toBeTruthy();
  });

  it("o LinkedIn desligado aparece desligado, com o motivo", () => {
    renderizar({ disponivel: false, motivo: "Esta conta não tem LinkedIn conectado." });
    expect((screen.getByLabelText("LinkedIn") as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText("Esta conta não tem LinkedIn conectado.")).toBeTruthy();
  });

  it("no LinkedIn: as formas dele, o campo Texto, nada de arquivo no só texto e nada do reels", () => {
    renderizar(LIGADO);
    fireEvent.click(screen.getByLabelText("LinkedIn"));
    const forma = screen.getByLabelText("Forma") as HTMLSelectElement;
    expect(Array.from(forma.options).map((o) => o.textContent)).toEqual(["Só texto", "Imagem"]);
    expect(campoDoTexto()).toBeTruthy();
    expect(screen.queryByLabelText(/^Arquivos?$/)).toBeNull();
    expect(screen.queryByText("opções do reels")).toBeNull();
    expect(screen.getByText(/Dra\. Ana Souza/)).toBeTruthy();
  });
});

describe("o texto do LinkedIn", () => {
  it("o contador conta como o LinkedIn conta, e diz por quê", () => {
    renderizar(LIGADO);
    fireEvent.click(screen.getByLabelText("LinkedIn"));
    fireEvent.change(campoDoTexto(), { target: { value: "Olá #mundo" } });
    expect(screen.getByText(`${tamanhoDoTextoNoLinkedin("Olá #mundo")}/3000`)).toBeTruthy();
    expect(screen.getByText(NOTA_DO_CONTADOR_DO_LINKEDIN)).toBeTruthy();
  });

  it("o texto vazio é recusado na tela, sem chamar nada", async () => {
    const { acao, acaoDoLinkedin } = renderizar(LIGADO);
    fireEvent.click(screen.getByLabelText("LinkedIn"));
    await act(async () => {
      fireEvent.click(botao());
    });
    expect(screen.getByRole("alert").textContent).toBe(textoDaRecusaNoLinkedin("texto_vazio"));
    expect(acaoDoLinkedin).not.toHaveBeenCalled();
    expect(acao).not.toHaveBeenCalled();
  });
});

describe("publicar no LinkedIn", () => {
  it("só texto: a action do LinkedIn recebe a forma, o texto, o envio e o quando, uma vez só", async () => {
    const { f, acao, acaoDoLinkedin } = renderizar(LIGADO);
    fireEvent.click(screen.getByLabelText("LinkedIn"));
    fireEvent.change(campoDoTexto(), { target: { value: "  Olá #mundo  " } });
    await act(async () => {
      fireEvent.click(botao());
      fireEvent.click(botao());
    });
    await waitFor(() => expect(acaoDoLinkedin).toHaveBeenCalledTimes(1));
    const dados = acaoDoLinkedin.mock.calls[0][0];
    expect(dados.get("forma_linkedin")).toBe("texto");
    expect(String(dados.get("texto")).trim()).toBe("Olá #mundo");
    expect(dados.get("caminhos")).toBe("");
    expect(String(dados.get("id_do_envio"))).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(dados.get("quando")).toBe("agora");
    expect(dados.get("fuso")).not.toBeNull();
    expect(f.assinados).toEqual([]);
    expect(acao).not.toHaveBeenCalled();
  });

  it("imagem: sobe a imagem pelas regras da imagem do Instagram e manda o caminho", async () => {
    const { f, acao, acaoDoLinkedin } = renderizar(LIGADO);
    fireEvent.click(screen.getByLabelText("LinkedIn"));
    fireEvent.change(screen.getByLabelText("Forma"), { target: { value: "imagem" } });
    await act(async () => {
      fireEvent.change(screen.getByLabelText("Arquivo"), {
        target: { files: [new File([new Uint8Array(1000)], "arte.jpg", { type: "image/jpeg" })] },
      });
    });
    await waitFor(() => expect(screen.queryByText("Lendo o arquivo…")).toBeNull());
    fireEvent.change(campoDoTexto(), { target: { value: "Com foto" } });
    await act(async () => {
      fireEvent.click(botao());
    });
    await waitFor(() => expect(acaoDoLinkedin).toHaveBeenCalledTimes(1));
    const dados = acaoDoLinkedin.mock.calls[0][0];
    expect(dados.get("forma_linkedin")).toBe("imagem");
    expect(dados.get("caminhos")).toBe(`${PASTA}/arte.jpg`);
    expect(f.assinados).toEqual([{ forma: "imagem", nome: "arte.jpg" }]);
    expect(acao).not.toHaveBeenCalled();
  });

  it("imagem sem arquivo é recusada na tela", async () => {
    const { acaoDoLinkedin } = renderizar(LIGADO);
    fireEvent.click(screen.getByLabelText("LinkedIn"));
    fireEvent.change(screen.getByLabelText("Forma"), { target: { value: "imagem" } });
    fireEvent.change(campoDoTexto(), { target: { value: "Sem foto" } });
    await act(async () => {
      fireEvent.click(botao());
    });
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(acaoDoLinkedin).not.toHaveBeenCalled();
  });

  it("voltar ao Instagram volta a chamar a action do Instagram, com a legenda", async () => {
    const { acao, acaoDoLinkedin } = renderizar(LIGADO);
    fireEvent.click(screen.getByLabelText("LinkedIn"));
    fireEvent.click(screen.getByLabelText("Instagram"));
    expect(screen.getByLabelText("Legenda")).toBeTruthy();
    expect(screen.getByText("opções do reels")).toBeTruthy();
    await act(async () => {
      fireEvent.change(screen.getByLabelText("Arquivo"), {
        target: { files: [new File([new Uint8Array(1000)], "arte.jpg", { type: "image/jpeg" })] },
      });
    });
    await waitFor(() => expect(screen.queryByText("Lendo o arquivo…")).toBeNull());
    await act(async () => {
      fireEvent.click(botao());
    });
    await waitFor(() => expect(acao).toHaveBeenCalledTimes(1));
    expect(acaoDoLinkedin).not.toHaveBeenCalled();
  });
});
```

Crie `testes-integracao/linkedin-compor.integracao.ts`:

```ts
// A ACTION DE PUBLICAR NO LINKEDIN (`publicarNoLinkedin`, app/publicar/actions.ts; docs/specs/2026-11-06-linkedin-
// no-perfil.md, §2 e §7; a parte 2a). A conta vem da regra das contas (`getSelectedAccount`), nunca do formulário;
// a conexão é conferida de novo no servidor; o pedido passa pela mesma função de recusas da tela; e o "agora"
// publica só a própria linha (achado 211) e diz o desfecho.
//
// A MAQUINARIA É A DE `linkedin-telas.integracao.ts`: a action de verdade num contexto de requisição, com a sessão
// de teste (administrador) ou a do login COMUM de teste, ligado só às contas de cada caso. O LinkedIn e o bucket são
// falsos, no loopback, e o `fetch` recusa qualquer outro endereço. **NADA AQUI PUBLICA NO LINKEDIN DE VERDADE.**
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { bancoDescartavel } from "./harness";
import { comoNumaRequisicaoComoComum, comoNumaRequisicaoComSessao } from "./semear-requisicao";

type ModuloAcoes = typeof import("@/app/publicar/actions");
type ModuloLinkedin = typeof import("@/lib/linkedin-publicacao");

const banco = bancoDescartavel();
const q = (texto: string, params: unknown[] = []) =>
  banco.db().sql().query(texto, params) as Promise<Record<string, unknown>[]>;

const CONTA_A = "17800000000025201";
const CONTA_B = "17800000000025202";
const BUCKET = "midia-do-compor";
const CHAVE_DO_BUCKET = "chave-do-bucket-do-compor-que-nao-vale-nada";
const TOKEN_DO_LINKEDIN = "AQVautorizacaoDoComporQueNaoValeNada";
const ENVIO = "9f1c2e3d-0000-4000-8000-0000000002a1";

const linkedin = { pedidos: [] as string[], statusDoPost: 201 };

let servidorFalso: Server;
let acoes: ModuloAcoes;
let regras: ModuloLinkedin;

function responder(res: ServerResponse, status: number, corpo: unknown, cabecalhos: Record<string, string> = {}) {
  res.writeHead(status, { "content-type": "application/json", ...cabecalhos });
  res.end(typeof corpo === "string" ? corpo : JSON.stringify(corpo));
}

beforeAll(async () => {
  servidorFalso = createServer((req: IncomingMessage, res: ServerResponse) => {
    req.resume();
    const u = new URL(req.url ?? "/", "http://127.0.0.1");
    const porta = (servidorFalso.address() as AddressInfo).port;
    if (req.method === "GET" && u.pathname.startsWith(`/storage/v1/object/public/${BUCKET}/`)) {
      res.writeHead(200, { "content-type": "image/jpeg" });
      return res.end(Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
    }
    if (req.method === "DELETE" && u.pathname.startsWith(`/storage/v1/object/${BUCKET}/`)) {
      return responder(res, 200, { message: "ok" });
    }
    linkedin.pedidos.push(`${req.method} ${u.pathname}`);
    if (req.method === "POST" && u.pathname === "/rest/images") {
      return responder(res, 200, {
        value: { uploadUrl: `http://127.0.0.1:${porta}/envio/C4E10AQ`, image: "urn:li:image:DoCompor" },
      });
    }
    if (req.method === "PUT" && u.pathname === "/envio/C4E10AQ") return responder(res, 201, "");
    if (req.method === "POST" && u.pathname === "/rest/posts") {
      if (linkedin.statusDoPost !== 201) return responder(res, linkedin.statusDoPost, { message: "o post falhou de propósito" });
      return responder(res, 201, "", { "x-restli-id": "urn:li:share:7000000000000000201" });
    }
    responder(res, 404, { message: "o falso não conhece esse caminho" });
  });
  await new Promise<void>((pronto) => servidorFalso.listen(0, "127.0.0.1", pronto));
  const base = `http://127.0.0.1:${(servidorFalso.address() as AddressInfo).port}`;
  process.env.LINKEDIN_API_BASE = base;
  process.env.SUPABASE_URL = base;
  process.env.SUPABASE_SERVICE_ROLE_KEY = CHAVE_DO_BUCKET;
  process.env.SUPABASE_BUCKET = BUCKET;
  delete process.env.QSTASH_TOKEN;

  const fetchDeVerdade = globalThis.fetch;
  vi.stubGlobal("fetch", async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof entrada === "string" ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
    if (url.hostname === "127.0.0.1") return fetchDeVerdade(entrada, init);
    throw new Error(`RECUSADO: este teste não chama ${url.origin}`);
  });

  const li = await import("@/lib/linkedin");
  if (li.basesDoLinkedin().api !== base) throw new Error("RECUSADO: a base do LinkedIn não é a desta rodada.");
  acoes = await import("@/app/publicar/actions");
  regras = await import("@/lib/linkedin-publicacao");

  for (const [id, nome] of [
    [CONTA_A, "conta_a_do_compor"],
    [CONTA_B, "conta_b_do_compor"],
  ] as const) {
    await banco.db().upsertAccount({
      ig_user_id: id,
      username: nome,
      name: nome,
      profile_picture_url: null,
      access_token: `token-de-${nome}-que-nao-vale-nada`,
      token_expires_at: null,
    });
  }
});

afterAll(async () => {
  vi.unstubAllGlobals();
  for (const v of ["LINKEDIN_API_BASE", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_BUCKET"]) delete process.env[v];
  await new Promise<void>((pronto) => servidorFalso.close(() => pronto()));
});

beforeEach(async () => {
  await q(`delete from queue`);
  await q(`delete from linkedin_conexoes`);
  await conectar(CONTA_A);
  linkedin.pedidos = [];
  linkedin.statusDoPost = 201;
});

async function conectar(conta: string, expiraEm = "now() + interval '30 days'") {
  await q(
    `insert into linkedin_conexoes (account_id, pessoa_id, nome, access_token, expira_em)
     values ($1, 'pessoaDoCompor', 'Dra. Ana Souza', $2, ${expiraEm})
     on conflict (account_id) do update set expira_em = excluded.expira_em`,
    [conta, TOKEN_DO_LINKEDIN]
  );
}

const linhas = () => q(`select account_id, kind, status, error, payload from queue order by created_at`);

/** O formulário como a tela o manda (app/publicar/enviador.tsx, na rede LinkedIn). */
function formulario(campos: Partial<Record<string, string>> = {}): FormData {
  const f = new FormData();
  const tudo: Record<string, string> = {
    forma_linkedin: "texto",
    caminhos: "",
    texto: "Olá #mundo",
    id_do_envio: ENVIO,
    quando: "agora",
    data_hora: "",
    fuso: "0",
  };
  for (const [k, v] of Object.entries({ ...tudo, ...campos })) if (v !== undefined) f.set(k, v);
  return f;
}

/** O aviso que viajou na URL do `redirect()`. */
function avisoDoDigest(valor: string | null): { texto: string | null; tom: string | null } {
  if (valor === null || !valor.startsWith("NEXT_REDIRECT;")) return { texto: null, tom: null };
  const sp = new URL(valor.split(";").slice(2, -2).join(";"), "http://127.0.0.1").searchParams;
  return { texto: sp.get("aviso"), tom: sp.get("tom") };
}

async function capturar(acao: () => Promise<void>): Promise<string | null> {
  try {
    await acao();
    return null;
  } catch (e) {
    const digest = (e as { digest?: unknown }).digest;
    if (typeof digest === "string") return digest;
    throw e;
  }
}

async function publicarComoAdministrador(form: FormData) {
  const { valor } = await comoNumaRequisicaoComSessao("/publicar/novo", () => capturar(() => acoes.publicarNoLinkedin(form)));
  return avisoDoDigest(valor);
}

async function publicarComoComum(form: FormData, contas: string[], contaDoCookie?: string) {
  const { valor } = await comoNumaRequisicaoComoComum("/publicar/novo", () => capturar(() => acoes.publicarNoLinkedin(form)), {
    contas,
    contaDoCookie,
  });
  return avisoDoDigest(valor);
}

// ---------------------------------------------------------------------------------------------------------------

describe("publicar agora no LinkedIn", () => {
  it("só texto: a linha entra, o post sai na mesma ida, e o aviso diz publicado", async () => {
    const aviso = await publicarComoAdministrador(formulario());
    expect(aviso).toEqual({ tom: "ok", texto: "Post publicado no LinkedIn." });
    const [linha] = await linhas();
    expect(linha).toMatchObject({ account_id: CONTA_A, kind: "publicacao_linkedin", status: "sent" });
    expect(linkedin.pedidos).toEqual(["POST /rest/posts"]);
  });

  it("imagem: o caminho da pasta da conta vai à linha, e a imagem sobe antes do post", async () => {
    const aviso = await publicarComoAdministrador(formulario({ forma_linkedin: "imagem", caminhos: `${CONTA_A}/foto.jpg` }));
    expect(aviso.tom).toBe("ok");
    const [linha] = await linhas();
    expect((linha.payload as Record<string, unknown>).caminhos).toEqual([`${CONTA_A}/foto.jpg`]);
    expect(linkedin.pedidos).toEqual(["POST /rest/images", "PUT /envio/C4E10AQ", "POST /rest/posts"]);
  });

  it("o LinkedIn recusa o post: o aviso diz que não saiu, com o motivo", async () => {
    linkedin.statusDoPost = 403;
    const aviso = await publicarComoAdministrador(formulario());
    expect(aviso.tom).toBe("erro");
    expect(aviso.texto).toContain("403");
    expect((await linhas())[0].status).toBe("failed");
  });

  it("o mesmo envio mandado de novo não entra outra vez", async () => {
    await publicarComoAdministrador(formulario());
    const aviso = await publicarComoAdministrador(formulario());
    expect(aviso.tom).toBe("erro");
    expect(await linhas()).toHaveLength(1);
    expect(linkedin.pedidos).toEqual(["POST /rest/posts"]);
  });
});

describe("agendar no LinkedIn", () => {
  it("a linha entra pendente para a hora escolhida, e ninguém fala com o LinkedIn", async () => {
    const alvo = new Date(Date.now() + 2 * 3600 * 1000);
    alvo.setUTCSeconds(0, 0);
    const aviso = await publicarComoAdministrador(
      formulario({ quando: "depois", data_hora: alvo.toISOString().slice(0, 16), fuso: "0" })
    );
    expect(aviso.tom).toBe("ok");
    expect(aviso.texto).toContain("agendado para");
    const [linha] = await linhas();
    expect(linha.status).toBe("pending");
    expect(linkedin.pedidos).toEqual([]);
  });
});

describe("as recusas: nenhuma linha entra", () => {
  const casos: [string, Partial<Record<string, string>>, string][] = [
    ["a forma desconhecida", { forma_linkedin: "reels" }, "forma_desconhecida"],
    ["o só texto com arquivo", { caminhos: `${CONTA_A}/foto.jpg` }, "quantidade"],
    ["a imagem sem arquivo", { forma_linkedin: "imagem", caminhos: "" }, "quantidade"],
    ["a imagem com o caminho de outra conta (descartado)", { forma_linkedin: "imagem", caminhos: `${CONTA_B}/foto.jpg` }, "quantidade"],
    ["o texto vazio", { texto: "   " }, "texto_vazio"],
    // 2.998 caracteres digitados, e mais de 3.000 no LinkedIn: o servidor conta como o contador.
    ["o texto longo depois das hashtags", { texto: `${"a".repeat(2990)} #ab #cd` }, "texto_longo"],
    ["o envio sem id", { id_do_envio: "" }, "envio_sem_id"],
  ];
  for (const [nome, campos, recusa] of casos) {
    it(nome, async () => {
      const aviso = await publicarComoAdministrador(formulario(campos));
      expect(aviso).toEqual({
        tom: "erro",
        texto: regras.textoDaRecusaNoLinkedin(recusa as Parameters<typeof regras.textoDaRecusaNoLinkedin>[0]),
      });
      expect(await linhas()).toEqual([]);
      expect(linkedin.pedidos).toEqual([]);
    });
  }

  it("a hora no passado", async () => {
    const aviso = await publicarComoAdministrador(formulario({ quando: "depois", data_hora: "2020-01-01T10:00", fuso: "0" }));
    expect(aviso.tom).toBe("erro");
    expect(await linhas()).toEqual([]);
  });

  it("a conta sem LinkedIn conectado", async () => {
    await q(`delete from linkedin_conexoes`);
    const aviso = await publicarComoAdministrador(formulario());
    expect(aviso.tom).toBe("erro");
    expect(aviso.texto).toContain("não tem LinkedIn conectado");
    expect(await linhas()).toEqual([]);
  });

  it("o LinkedIn da conta vencido", async () => {
    await conectar(CONTA_A, "now() - interval '1 minute'");
    const aviso = await publicarComoAdministrador(formulario());
    expect(aviso.tom).toBe("erro");
    expect(aviso.texto).toContain("venceu");
    expect(await linhas()).toEqual([]);
  });
});

describe("a regra das contas: a conta vem da sessão, e nunca do formulário", () => {
  it("o login comum com a conta publica nela", async () => {
    const aviso = await publicarComoComum(formulario(), [CONTA_A]);
    expect(aviso.tom).toBe("ok");
    expect((await linhas())[0]).toMatchObject({ account_id: CONTA_A, status: "sent" });
  });

  it("o login comum sem conta nenhuma não publica, nem com o cookie de uma conta com LinkedIn", async () => {
    const aviso = await publicarComoComum(formulario(), [], CONTA_A);
    expect(aviso.tom).toBe("erro");
    expect(await linhas()).toEqual([]);
    expect(linkedin.pedidos).toEqual([]);
  });

  it("o login comum só com outra conta não publica no LinkedIn da conta que ele não vê", async () => {
    const aviso = await publicarComoComum(formulario(), [CONTA_B], CONTA_A);
    expect(aviso.tom).toBe("erro");
    expect(await linhas()).toEqual([]);
    expect(linkedin.pedidos).toEqual([]);
  });
});
```

Em `testes-integracao/linkedin-publicacao.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/linkedin-publicacao.integracao.ts b/testes-integracao/linkedin-publicacao.integracao.ts
index fc83445..2f95900 100644
--- a/testes-integracao/linkedin-publicacao.integracao.ts
+++ b/testes-integracao/linkedin-publicacao.integracao.ts
@@ -201,8 +201,9 @@ const linhaDoLinkedin = async () =>
 describe("enfileirar um post do LinkedIn", () => {
   it("grava a linha publicacao_linkedin com o payload, a chave própria e a hora", async () => {
     const r = await enfileirarTexto();
-    expect(r).toEqual({ entrou: true, jaVale: true, falta: 0 });
     const linha = await linhaDoLinkedin();
+    // O ID DA LINHA VOLTA JUNTO: é com ele que o "agora" da tela publica só esta linha (achado 211).
+    expect(r).toEqual({ entrou: true, jaVale: true, falta: 0, id: linha.id });
     expect(linha).toMatchObject({
       account_id: CONTA,
       status: "pending",
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
env -u CLAUDECODE -u AI_AGENT npx --no-install vitest run tests/linkedin-compor.test.ts tests/dreno-com-prazo.test.ts \
  tests/linkedin-token-fora-do-cliente.test.ts tests/publicar-compositor-guarda.test.ts
env -u CLAUDECODE -u AI_AGENT npx --no-install vitest run --config vitest.dom.config.ts \
  testes-dom/publicar-compositor-linkedin.dom.tsx
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" \
  npx --no-install vitest run --config vitest.integracao.config.ts \
  testes-integracao/linkedin-compor.integracao.ts testes-integracao/linkedin-publicacao.integracao.ts
```

Esperado: 
- nos puros, "Tests 21 failed | 11 passed (32)": os 15 de `tests/linkedin-compor.test.ts` (as funções novas ainda não existem), os 3 da guarda do clique, os 2 da trava do token e o da action em `tests/dreno-com-prazo.test.ts`;
- na tela, "Tests 8 failed | 1 passed (9)": só passa "sem o LinkedIn na página, a tela é só do Instagram, como antes";
- na integração, `ALVO: banco de TESTE` e "Tests 19 failed | 24 passed (43)": os 18 de `linkedin-compor` (`acoes.publicarNoLinkedin is not a function`) e "grava a linha publicacao_linkedin com o payload, a chave própria e a hora", que agora espera o id da linha.

- [ ] **Passo 3: o código**

Em `lib/linkedin-publicacao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/linkedin-publicacao.ts b/lib/linkedin-publicacao.ts
index 732a2b3..e72a30a 100644
--- a/lib/linkedin-publicacao.ts
+++ b/lib/linkedin-publicacao.ts
@@ -100,6 +100,113 @@ export function problemaDoTextoDoLinkedin(texto: string, _forma: FormaNoLinkedin
   return null;
 }
 
+// ---------------------------------------------------------------------------------------------------------------
+// O PEDIDO DE PUBLICAR, NA TELA E NA ACTION
+// ---------------------------------------------------------------------------------------------------------------
+
+export type RecusaDoPedidoNoLinkedin = "forma_desconhecida" | "quantidade" | "texto_vazio" | "texto_longo" | "envio_sem_id";
+
+const ID_DO_ENVIO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
+
+/**
+ * O QUE IMPEDE O PEDIDO DE VIRAR LINHA NA FILA, numa função só: a tela confere antes de subir o arquivo, a action
+ * confere de novo no servidor, e o enfileirar (lib/linkedin-fila.ts) é a terceira barreira. O texto é contado pela
+ * mesma `tamanhoDoTextoNoLinkedin` do contador da tela (achado 212). O id do envio é o que a tela gera uma vez por
+ * formulário, e é a chave do só texto contra o clique repetido (`chaveDaPublicacaoNoLinkedin`, lib/dedupe.ts).
+ */
+export function recusaDoPedidoNoLinkedin(p: {
+  forma: FormaNoLinkedin | null;
+  caminhos: string[];
+  texto: string;
+  idDoEnvio: string;
+}): RecusaDoPedidoNoLinkedin | null {
+  if (!p.forma) return "forma_desconhecida";
+  if (p.caminhos.length !== (p.forma === "imagem" ? 1 : 0)) return "quantidade";
+  const problema = problemaDoTextoDoLinkedin(p.texto, p.forma);
+  if (problema === "vazio") return "texto_vazio";
+  if (problema === "longo") return "texto_longo";
+  if (!ID_DO_ENVIO.test(p.idDoEnvio)) return "envio_sem_id";
+  return null;
+}
+
+export function textoDaRecusaNoLinkedin(r: RecusaDoPedidoNoLinkedin): string {
+  switch (r) {
+    case "forma_desconhecida":
+      return "Escolha a forma do post no LinkedIn: só texto ou imagem.";
+    case "quantidade":
+      return "O post do LinkedIn com imagem leva uma imagem, e o só texto não leva arquivo.";
+    case "texto_vazio":
+      return "Escreva o texto do post.";
+    case "texto_longo":
+      return "O texto passa de 3.000 caracteres no LinkedIn, onde as hashtags e alguns sinais contam mais. Encurte o texto.";
+    case "envio_sem_id":
+      return "O formulário chegou incompleto. Recarregue a página e tente de novo.";
+  }
+}
+
+/**
+ * O ID DO ENVIO, gerado pela tela uma vez por formulário: um UUID v4, pelo `crypto.getRandomValues` (que o
+ * navegador e o Node têm; o `randomUUID` falta em navegadores antigos e no jsdom de alguns testes).
+ */
+export function novoIdDoEnvio(): string {
+  const b = crypto.getRandomValues(new Uint8Array(16));
+  b[6] = (b[6] & 0x0f) | 0x40;
+  b[8] = (b[8] & 0x3f) | 0x80;
+  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
+  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
+}
+
+/** A frase curta do contador da tela (achado 212): por que o número pode passar do que se digitou. */
+export const NOTA_DO_CONTADOR_DO_LINKEDIN = "As hashtags e alguns sinais (como @, _ e *) contam mais de um caractere no LinkedIn.";
+
+export type DisponibilidadeDoLinkedin = { disponivel: true; nome: string } | { disponivel: false; motivo: string };
+
+/**
+ * O LINKEDIN DA CONTA NA TELA DE COMPOR: ligado com a conexão dentro da validade; desligado, com o motivo, sem
+ * conexão ou com ela vencida (spec, §7). A action confere de novo, pela mesma função.
+ */
+export function disponibilidadeDoLinkedin(
+  resumo: { nome: string; expira_em: Date | string } | null,
+  agoraMs: number
+): DisponibilidadeDoLinkedin {
+  if (!resumo) {
+    return {
+      disponivel: false,
+      motivo: "Esta conta não tem LinkedIn conectado. Quem administra o painel manda o convite pela Configuração.",
+    };
+  }
+  if (vencimentoDoLinkedin(resumo.expira_em, agoraMs).estado === "vencido") {
+    return {
+      disponivel: false,
+      motivo: `O LinkedIn de ${resumo.nome} venceu. Quem administra o painel manda o convite de novo pela Configuração.`,
+    };
+  }
+  return { disponivel: true, nome: resumo.nome };
+}
+
+/**
+ * O AVISO DEPOIS DE PUBLICAR NO LINKEDIN. O "agora" publica na mesma ida (`drenarUmaPublicacaoDoLinkedin`), então
+ * o aviso diz o desfecho: publicado; na fila ("aguardando", ou outro dreno já a pegou); ou não saiu, com o motivo.
+ * O agendado ecoa a hora dos campos escolhidos, como `avisoDaPublicacaoEnfileirada` (lib/avisos.ts): o servidor
+ * roda em UTC.
+ */
+export function avisoDoPostNoLinkedin(d: {
+  desfecho: "publicado" | "aguardando" | "falhou" | null;
+  motivo?: string | null;
+  agendadoPara: { dia: number; mes: number; hora: number; minuto: number } | null;
+}): { tom: "ok" | "erro"; texto: string } {
+  if (d.agendadoPara) {
+    const p = (n: number) => String(n).padStart(2, "0");
+    const { dia, mes, hora, minuto } = d.agendadoPara;
+    return { tom: "ok", texto: `Post do LinkedIn agendado para ${p(dia)}/${p(mes)} às ${p(hora)}:${p(minuto)}. Acompanhe em Publicações.` };
+  }
+  if (d.desfecho === "publicado") return { tom: "ok", texto: "Post publicado no LinkedIn." };
+  if (d.desfecho === "falhou") {
+    return { tom: "erro", texto: `O post não saiu no LinkedIn: ${d.motivo?.trim() || "o motivo não foi registrado"}.` };
+  }
+  return { tom: "ok", texto: "O post do LinkedIn está na fila e vai sair em instantes. Acompanhe em Publicações." };
+}
+
 // ---------------------------------------------------------------------------------------------------------------
 // O PAYLOAD DA LINHA `publicacao_linkedin` NA FILA
 // ---------------------------------------------------------------------------------------------------------------
```

Em `lib/linkedin-fila.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/linkedin-fila.ts b/lib/linkedin-fila.ts
index 9456b25..f8a7e64 100644
--- a/lib/linkedin-fila.ts
+++ b/lib/linkedin-fila.ts
@@ -1,6 +1,9 @@
 import "server-only";
 import { sql, getConfig, type QueueItem } from "./db";
 import type { ResultadoDaPublicacao } from "./engine";
+
+/** O resultado do enfileirar, como o do Instagram (`ResultadoDaPublicacao`), com o id da linha que entrou. */
+export type ResultadoDoLinkedin = { entrou: false } | (Extract<ResultadoDaPublicacao, { entrou: true }> & { id: string });
 import { scheduleTick, HORIZONTE_DO_TIQUE_EM_SEGUNDOS } from "./qstash";
 import { atrasoDoTiqueDaPublicacao } from "./publicacao";
 import { chaveDaPublicacaoNoLinkedin } from "./dedupe";
@@ -21,7 +24,7 @@ import {
   motivoDaAutorizacaoRecusada,
   oPostPodeTerSaido,
   payloadDoLinkedin,
-  problemaDoTextoDoLinkedin,
+  recusaDoPedidoNoLinkedin,
   type FormaNoLinkedin,
 } from "./linkedin-publicacao";
 
@@ -32,8 +35,6 @@ import {
 // O DRENO PASSA AS TRÊS FUNÇÕES DELE (`finish`, `guardarNoPayload` e `limparOBucket`), e este arquivo não importa o
 // dreno: o dreno importa daqui, e o contrário seria um ciclo.
 
-const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
-
 /**
  * ENFILEIRA O POST DO LINKEDIN. `quando: null` é agora, pelo `now()` do banco, e data no passado também é agora
  * (o mesmo de `enqueuePublicacao`). O resultado é medido pelo banco, no mesmo statement que grava.
@@ -50,9 +51,10 @@ export async function enqueuePublicacaoNoLinkedin(
   accountId: string,
   pedido: { forma: FormaNoLinkedin; caminhos: string[]; texto: string; idDoEnvio: string },
   quando: Date | null
-): Promise<ResultadoDaPublicacao> {
+): Promise<ResultadoDoLinkedin> {
   const payload = payloadDoLinkedin(pedido);
-  if (!lerPayloadDoLinkedin(payload) || problemaDoTextoDoLinkedin(payload.texto, payload.forma) || !UUID.test(pedido.idDoEnvio)) {
+  // AS MESMAS RECUSAS DA TELA E DA ACTION (`recusaDoPedidoNoLinkedin`), sobre o texto já aparado do payload.
+  if (recusaDoPedidoNoLinkedin({ ...pedido, texto: payload.texto }) || !lerPayloadDoLinkedin(payload)) {
     return { entrou: false };
   }
   const linhas = (await sql().query(
@@ -65,7 +67,7 @@ export async function enqueuePublicacaoNoLinkedin(
     [accountId, payload, chaveDaPublicacaoNoLinkedin(accountId, pedido.forma, pedido.caminhos, pedido.idDoEnvio), quando]
   )) as { id: string; ja_vale: boolean; falta: number }[];
   if (!linhas.length) return { entrou: false };
-  const { ja_vale: jaVale, falta } = linhas[0];
+  const { id, ja_vale: jaVale, falta } = linhas[0];
 
   // O TIQUE NÃO DERRUBA O QUE JÁ ENTROU (o achado 101, do `enqueuePublicacao`): sem tique, o post ainda sai pelo
   // rodapé do dreno, por um webhook ou pelo cron, só mais tarde.
@@ -78,7 +80,13 @@ export async function enqueuePublicacaoNoLinkedin(
       // Calado de propósito: o post está na fila, e é isso que a tela diz.
     }
   }
-  return { entrou: true, jaVale, falta };
+  return { entrou: true, jaVale, falta, id };
+}
+
+/** O motivo gravado numa linha da fila, para o aviso do "agora" que não saiu. */
+export async function erroDaLinha(id: string): Promise<string | null> {
+  const [linha] = (await sql().query(`select error from queue where id = $1`, [id])) as { error: string | null }[];
+  return linha?.error ?? null;
 }
 
 // ---------------------------------------------------------------------------------------------------------------
```

Em `app/publicar/actions.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/publicar/actions.ts b/app/publicar/actions.ts
index 7ee1c5f..a27579e 100644
--- a/app/publicar/actions.ts
+++ b/app/publicar/actions.ts
@@ -19,6 +19,18 @@ import {
 } from "@/lib/publicacao";
 import { urlDePublicarComAviso, avisoDaPublicacaoEnfileirada } from "@/lib/avisos";
 import { exigirSessao } from "@/lib/exigir-sessao";
+// O POST NO LINKEDIN (a parte 2a): a conexão só pelo resumo (o token fica no repositório, e só o dreno o lê), as
+// regras puras do pedido e o enfileirar e o "agora" da fila do LinkedIn.
+import { resumoDaConexao } from "@/lib/linkedin-conexoes";
+import {
+  avisoDoPostNoLinkedin,
+  disponibilidadeDoLinkedin,
+  formaNoLinkedinDoCampo,
+  recusaDoPedidoNoLinkedin,
+  textoDaRecusaNoLinkedin,
+} from "@/lib/linkedin-publicacao";
+import { enqueuePublicacaoNoLinkedin, erroDaLinha } from "@/lib/linkedin-fila";
+import { drenarUmaPublicacaoDoLinkedin } from "@/lib/queue-drain";
 
 /**
  * Enfileira uma publicação para a conta selecionada.
@@ -179,3 +191,80 @@ export async function publicar(formData: FormData): Promise<void> {
   // minuto corrente prometeria uma espera que não existe.
   redirect(urlDePublicarComAviso(avisoDaPublicacaoEnfileirada(r.jaVale ? null : campos)));
 }
+
+/**
+ * ENFILEIRA UM POST NO LINKEDIN para a conta selecionada (docs/specs/2026-11-06-linkedin-no-perfil.md, §7; a
+ * parte 2a: só texto ou imagem, uma rede por post).
+ *
+ * AS MESMAS REGRAS DA ACTION DE CIMA: nenhuma saída muda (toda saída é `redirect` com aviso de função pura); a
+ * conta vem da regra das contas (`getSelectedAccount`, lib/account.ts), e nunca do formulário; e os caminhos
+ * passam por `caminhosDoCampo` com a pasta dessa conta, que descarta o que for de outra pasta.
+ *
+ * E MAIS TRÊS:
+ *   - a conexão é conferida de novo aqui, pela mesma `disponibilidadeDoLinkedin` da tela: a tela pode ter sido
+ *     aberta antes de a autorização vencer;
+ *   - o pedido passa pela mesma `recusaDoPedidoNoLinkedin` da tela, que conta o texto pela mesma função do
+ *     contador (achado 212);
+ *   - o "agora" publica SÓ a própria linha (`drenarUmaPublicacaoDoLinkedin`, achado 211), com o prazo contado do
+ *     começo desta função (a segunda linha: a primeira de toda action é a sessão, tests/sessao-nas-actions.test.ts),
+ *     e o aviso diz o desfecho. Sem o drenar, o preview, que não tem QStash, nunca publicaria (nota 198).
+ */
+export async function publicarNoLinkedin(formData: FormData): Promise<void> {
+  await exigirSessao();
+  const inicioDaFuncaoMs = Date.now();
+  const conta = await getSelectedAccount();
+  if (!conta) {
+    redirect(urlDePublicarComAviso({ tom: "erro", texto: textoDaRecusaDaPublicacao("sem_conta") }));
+  }
+
+  const disponivel = disponibilidadeDoLinkedin(await resumoDaConexao(conta.ig_user_id), Date.now());
+  if (!disponivel.disponivel) {
+    redirect(urlDePublicarComAviso({ tom: "erro", texto: disponivel.motivo }));
+  }
+
+  const forma = formaNoLinkedinDoCampo(formData.get("forma_linkedin"));
+  const caminhos = caminhosDoCampo(formData.get("caminhos"), pastaDaConta(conta.ig_user_id));
+  const texto = String(formData.get("texto") ?? "").trim();
+  const idDoEnvio = String(formData.get("id_do_envio") ?? "");
+  const recusa = recusaDoPedidoNoLinkedin({ forma, caminhos, texto, idDoEnvio });
+  if (recusa || !forma) {
+    redirect(urlDePublicarComAviso({ tom: "erro", texto: textoDaRecusaNoLinkedin(recusa ?? "forma_desconhecida") }));
+  }
+
+  // A HORA, pelos mesmos três passos da action de cima.
+  const campos = camposDaDataHora(formData.get("data_hora"));
+  const fuso = fusoDoCampo(formData.get("fuso"));
+  const momento = momentoDaPublicacao(
+    formData.get("quando"),
+    campos ? instanteDoAgendamento(campos, fuso) : null,
+    Date.now()
+  );
+  if (!momento.ok) {
+    redirect(urlDePublicarComAviso({ tom: "erro", texto: textoDaRecusaDaPublicacao(momento.motivo) }));
+  }
+
+  const r = await enqueuePublicacaoNoLinkedin(conta.ig_user_id, { forma, caminhos, texto, idDoEnvio }, momento.quando);
+  if (!r.entrou) {
+    // O MESMO ENVIO DE NOVO (a chave já existe): o post já está na fila, ou já saiu. Dizer "deu erro" faria alguém
+    // mandar de novo, com outro envio, e publicar duas vezes.
+    redirect(urlDePublicarComAviso({ tom: "erro", texto: textoDaRecusaDaPublicacao("ja_enfileirado") }));
+  }
+
+  // O "AGORA": o que já vale publica na mesma ida, só esta linha. O erro daqui não derruba o que entrou: a linha
+  // está na fila, e o aviso diz "vai sair em instantes".
+  let desfecho: "publicado" | "aguardando" | "falhou" | null = null;
+  let motivo: string | null = null;
+  if (r.jaVale) {
+    try {
+      desfecho = await drenarUmaPublicacaoDoLinkedin(r.id, inicioDaFuncaoMs);
+      if (desfecho === "falhou") motivo = await erroDaLinha(r.id);
+    } catch {
+      desfecho = null;
+    }
+  }
+
+  revalidatePath("/publicar/novo");
+  revalidatePath("/publicar");
+  revalidatePath("/eventos");
+  redirect(urlDePublicarComAviso(avisoDoPostNoLinkedin({ desfecho, motivo, agendadoPara: r.jaVale ? null : campos })));
+}
```

Em `app/publicar/novo/page.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/publicar/novo/page.tsx b/app/publicar/novo/page.tsx
index e0bc4d3..15e7ef3 100644
--- a/app/publicar/novo/page.tsx
+++ b/app/publicar/novo/page.tsx
@@ -6,7 +6,10 @@ import { pastaDaConta, tetoDoBucket } from "@/lib/bucket";
 import { avisoDaUrl } from "@/lib/avisos";
 import { PUBLICACOES_POR_DIA } from "@/lib/publicacao";
 import Enviador from "../enviador";
-import { publicar } from "../actions";
+import { publicar, publicarNoLinkedin } from "../actions";
+// O LINKEDIN DA CONTA (a parte 2a): só o resumo, e a tela recebe só o nome ou o motivo de estar desligado.
+import { resumoDaConexao } from "@/lib/linkedin-conexoes";
+import { disponibilidadeDoLinkedin } from "@/lib/linkedin-publicacao";
 import {
   subtle,
   input,
@@ -68,6 +71,14 @@ export default async function Publicar({
     teto = null;
   }
 
+  // O LINKEDIN DA CONTA SELECIONADA: ligado com a conexão dentro da validade, ou desligado com o motivo. A action
+  // confere de novo, pela mesma função (`publicarNoLinkedin`). Server Component `async`: roda UMA vez por
+  // requisição, e ler o relógio aqui é o comportamento pedido; a regra de pureza trata todo arquivo como cliente,
+  // e é silenciada com o motivo, como em app/setup/page.tsx.
+  // eslint-disable-next-line react-hooks/purity
+  const agora = Date.now();
+  const linkedin = conta ? disponibilidadeDoLinkedin(await resumoDaConexao(conta.ig_user_id), agora) : null;
+
   return (
     <div className="space-y-6">
       <div>
@@ -125,6 +136,8 @@ export default async function Publicar({
             teto={teto}
             pasta={pastaDaConta(conta.ig_user_id)}
             acao={publicar}
+            linkedin={linkedin}
+            acaoDoLinkedin={publicarNoLinkedin}
             quando={
               <>
             {/* QUANDO — refeito em 11/09/2026 porque o dono disse que estava
```

Em `app/publicar/enviador.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/publicar/enviador.tsx b/app/publicar/enviador.tsx
index e6aa6c9..671c37e 100644
--- a/app/publicar/enviador.tsx
+++ b/app/publicar/enviador.tsx
@@ -39,6 +39,20 @@ import {
   type ProblemaDaSaida,
   type ProporcaoDoPost,
 } from "@/lib/publicacao";
+// O LINKEDIN (a parte 2a: uma rede por post). As regras puras dele, sem import de servidor: as formas, o texto
+// contado como o LinkedIn conta (achado 212), as recusas do pedido e o id do envio.
+import {
+  LIMITE_DO_TEXTO_DO_LINKEDIN,
+  NOTA_DO_CONTADOR_DO_LINKEDIN,
+  novoIdDoEnvio,
+  problemaDoTextoDoLinkedin,
+  recusaDoPedidoNoLinkedin,
+  rotuloDaFormaNoLinkedin,
+  tamanhoDoTextoNoLinkedin,
+  textoDaRecusaNoLinkedin,
+  type DisponibilidadeDoLinkedin,
+  type FormaNoLinkedin,
+} from "@/lib/linkedin-publicacao";
 import { assinarEnvios, atualizarEnvio, definirEnvios, lerEnvios, lerEnviosNoServidor, limparEnvios } from "./envios";
 import { navegadorDeVerdade, type Medidas, type Navegador } from "./navegador";
 import { btnPrimary, card, fieldError, hint, input, label, muted, numero } from "../ui";
@@ -133,6 +147,8 @@ export default function Enviador({
   quando,
   opcoesDoReels,
   rodape,
+  linkedin = null,
+  acaoDoLinkedin,
   navegador = navegadorDeVerdade,
 }: {
   teto: number | null;
@@ -143,8 +159,24 @@ export default function Enviador({
   quando: ReactNode;
   opcoesDoReels: ReactNode;
   rodape: ReactNode;
+  /**
+   * O LinkedIn da conta (a parte 2a), decidido no servidor (`disponibilidadeDoLinkedin`): o nome, ou o motivo de
+   * estar desligado. Sem ele, a tela é só do Instagram, como antes. Nunca o token: só o resumo chega aqui.
+   */
+  linkedin?: DisponibilidadeDoLinkedin | null;
+  acaoDoLinkedin?: (dados: FormData) => Promise<void>;
   navegador?: Navegador;
 }) {
+  // A REDE DO POST (a parte 2a: uma rede por post). No LinkedIn, a imagem sobe pelas regras da forma "imagem" do
+  // Instagram (JPEG, a proporção e o enquadramento), então a `forma` abaixo fica em "imagem" enquanto a rede é o
+  // LinkedIn, e todo o caminho da subida continua o mesmo.
+  const [rede, setRede] = useState<"instagram" | "linkedin">("instagram");
+  const [formaNoLinkedin, setFormaNoLinkedin] = useState<FormaNoLinkedin>("texto");
+  // O ID DO ENVIO, um por formulário: é a chave do só texto contra o clique repetido. A action termina em
+  // `redirect`, que recria o componente (ver o cabeçalho), e o formulário seguinte nasce com outro.
+  const [idDoEnvio] = useState(novoIdDoEnvio);
+  const mostraARede = linkedin !== null && !!acaoDoLinkedin;
+  const noLinkedin = mostraARede && rede === "linkedin" && linkedin?.disponivel === true;
   const [forma, setForma] = useState<FormaDePublicacao>("imagem");
   const [proporcao, setProporcao] = useState<ProporcaoDoPost>(PROPORCAO_PADRAO);
   const [legenda, setLegenda] = useState("");
@@ -231,7 +263,12 @@ export default function Enviador({
   const quantidadeNaTela = slides.length && !algumMedindo ? textoDaQuantidadeNaTela(forma, slides.length, validos.length) : null;
   const primeiroSlide = forma === "carrossel" ? problemaDoPrimeiroSlide(medidos, proporcao) : null;
   // A LEGENDA É CONFERIDA COMO A ACTION A CONFERE: sem os espaços das pontas.
-  const problemaDaLegendaAtual = problemaDaLegenda(legenda.trim());
+  const problemaDaLegendaAtual = noLinkedin ? null : problemaDaLegenda(legenda.trim());
+  // NO LINKEDIN, o texto é contado como o LinkedIn conta, pela mesma função da action. Enquanto se digita, só o
+  // longo é vermelho: o vazio é o estado de quem ainda não começou, e é recusado no clique.
+  const textoLongoNoLinkedin = noLinkedin && problemaDoTextoDoLinkedin(legenda.trim(), formaNoLinkedin) === "longo";
+  // O ARQUIVO SÓ EXISTE NO INSTAGRAM E NA IMAGEM DO LINKEDIN.
+  const temArquivo = !noLinkedin || formaNoLinkedin === "imagem";
   const caixa = caixaDaMiniatura(forma, medidos, proporcao);
 
   function soltar(lista: Slide[]) {
@@ -248,6 +285,10 @@ export default function Enviador({
     // Vinícius registrou em aberto). Agora nada subiu antes do clique, e nada
     // fica.
     setForma(nova);
+    descartarALista();
+  }
+
+  function descartarALista() {
     soltar(slides);
     setSlides([]);
     setForaDaLista(0);
@@ -256,6 +297,18 @@ export default function Enviador({
     if (campoDeArquivo.current) campoDeArquivo.current.value = "";
   }
 
+  /** Trocar a rede descarta a lista, como trocar a forma. No LinkedIn, a imagem segue a forma "imagem". O texto fica. */
+  function trocarRede(nova: "instagram" | "linkedin") {
+    setRede(nova);
+    setForma("imagem");
+    descartarALista();
+  }
+
+  function trocarFormaNoLinkedin(nova: FormaNoLinkedin) {
+    setFormaNoLinkedin(nova);
+    descartarALista();
+  }
+
   async function aoEscolherArquivo(ev: React.ChangeEvent<HTMLInputElement>) {
     const escolhidos = Array.from(ev.target.files ?? []);
     // O CAMPO VOLTA A VAZIO para escolher o mesmo arquivo de novo disparar a troca.
@@ -464,7 +517,7 @@ export default function Enviador({
       setRecusa(textoDaRecusaDaTela("lendo_arquivos"));
       return null;
     }
-    const quantidade = textoDaQuantidadeNaTela(forma, slides.length, validos.length);
+    const quantidade = temArquivo ? textoDaQuantidadeNaTela(forma, slides.length, validos.length) : null;
     if (quantidade) {
       setRecusa(quantidade);
       return null;
@@ -473,10 +526,19 @@ export default function Enviador({
       setRecusa(textoDoProblemaDoPrimeiroSlide(primeiroSlide));
       return null;
     }
-    const daLegenda = problemaDaLegenda(String(pedido.get("legenda") ?? "").trim());
-    if (daLegenda) {
-      setRecusa(textoDoProblemaDaLegenda(daLegenda));
-      return null;
+    if (noLinkedin) {
+      // O TEXTO DO LINKEDIN, pela mesma função da action, antes de subir qualquer arquivo.
+      const doTexto = problemaDoTextoDoLinkedin(String(pedido.get("texto") ?? "").trim(), formaNoLinkedin);
+      if (doTexto) {
+        setRecusa(textoDaRecusaNoLinkedin(doTexto === "vazio" ? "texto_vazio" : "texto_longo"));
+        return null;
+      }
+    } else {
+      const daLegenda = problemaDaLegenda(String(pedido.get("legenda") ?? "").trim());
+      if (daLegenda) {
+        setRecusa(textoDoProblemaDaLegenda(daLegenda));
+        return null;
+      }
     }
     const daHora = recusaDaHora(pedido);
     if (daHora) {
@@ -488,7 +550,8 @@ export default function Enviador({
     leva.current = controle;
     setEnviando(true);
     try {
-      const caminhos = await subirTodos(validos, controle.signal);
+      // O SÓ TEXTO DO LINKEDIN NÃO SOBE NADA.
+      const caminhos = temArquivo ? await subirTodos(validos, controle.signal) : [];
       if (!caminhos || controle.signal.aborted) return null;
       // TODOS NA PASTA DA CONTA DESTA TELA. A troca de conta no seletor no meio
       // da subida faria a action descartar calada o que é de outra pasta
@@ -507,8 +570,24 @@ export default function Enviador({
       // A JANELINHA SAI ANTES DA ACTION: "Envios concluídos." não é
       // "publicado", e o desfecho é o aviso que a action devolve na tela.
       limparEnvios();
-      pedido.set("forma", forma);
       pedido.set("caminhos", caminhos.join("\n"));
+      if (noLinkedin) {
+        // O PEDIDO INTEIRO DO LINKEDIN, pela mesma função de recusas da action, agora com os caminhos da subida.
+        const recusaNoLinkedin = recusaDoPedidoNoLinkedin({
+          forma: formaNoLinkedin,
+          caminhos,
+          texto: String(pedido.get("texto") ?? "").trim(),
+          idDoEnvio,
+        });
+        if (recusaNoLinkedin) {
+          setRecusa(textoDaRecusaNoLinkedin(recusaNoLinkedin));
+          return null;
+        }
+        pedido.set("forma_linkedin", formaNoLinkedin);
+        pedido.set("id_do_envio", idDoEnvio);
+      } else {
+        pedido.set("forma", forma);
+      }
       return pedido;
     } finally {
       leva.current = null;
@@ -526,6 +605,8 @@ export default function Enviador({
     if (trava.current) return;
     trava.current = true;
     setRecusa(null);
+    // A ACTION É A DA REDE DO CLIQUE, escolhida antes de qualquer espera, como o formulário.
+    const destino = noLinkedin ? (acaoDoLinkedin ?? acao) : acao;
     let pedido: FormData | null = null;
     try {
       pedido = await montarOPedido();
@@ -539,7 +620,7 @@ export default function Enviador({
     // A ACTION, E SÓ ELA, DENTRO DA TRANSIÇÃO: é o que a sonda mediu.
     iniciar(async () => {
       try {
-        await acao(dados);
+        await destino(dados);
       } finally {
         liberar();
       }
@@ -555,34 +636,91 @@ export default function Enviador({
         void publicar();
       }}
     >
-      <div>
-        <label className={label} htmlFor="forma">
-          Forma
-        </label>
-        <select
-          id="forma"
-          name="forma"
-          className={input}
-          value={forma}
-          disabled={ocupado}
-          onChange={(e) => trocarForma(e.target.value as FormaDePublicacao)}
-        >
-          {/* AS PALAVRAS VÊM DE `rotuloDaForma` (lib/publicacao.ts): a tela de
-              agendados usa as mesmas quatro. A ORDEM é desta tela. */}
-          <option value="imagem">{rotuloDaForma("imagem")}</option>
-          <option value="carrossel">{rotuloDaForma("carrossel")}</option>
-          <option value="reels">{rotuloDaForma("reels")}</option>
-          <option value="story">{rotuloDaForma("story")}</option>
-        </select>
-        <p className={hint}>
-          No carrossel valem duas regras da Meta: reels não entra (vídeo em carrossel é vídeo comum, sem áudio
-          nomeado e sem aparecer no feed como reels), e todos os itens são cortados pela proporção do PRIMEIRO
-          — por isso a ordem importa, e dá para mudá-la na lista abaixo. São de 2 a {CARROSSEL_ITENS_MAX} itens,
-          e o post inteiro conta como uma só publicação.
-        </p>
-      </div>
+      {/* A REDE DO POST (a parte 2a: uma rede por post). Só aparece quando a página manda o LinkedIn da conta; o
+          LinkedIn desligado (sem conexão, ou vencida) aparece desligado, com o motivo que veio do servidor. */}
+      {mostraARede && linkedin && (
+        <fieldset className="space-y-2">
+          <legend className={label}>Rede</legend>
+          <div className="flex flex-wrap gap-4 text-sm">
+            <label className="flex items-center gap-2">
+              <input
+                type="radio"
+                name="rede"
+                value="instagram"
+                checked={!noLinkedin}
+                disabled={ocupado}
+                onChange={() => trocarRede("instagram")}
+              />
+              Instagram
+            </label>
+            <label className="flex items-center gap-2">
+              <input
+                type="radio"
+                name="rede"
+                value="linkedin"
+                checked={noLinkedin}
+                disabled={ocupado || !linkedin.disponivel}
+                onChange={() => trocarRede("linkedin")}
+              />
+              LinkedIn
+            </label>
+          </div>
+          <p className={hint}>
+            {linkedin.disponivel
+              ? `Um post vai a uma rede só. No LinkedIn, ele sai no perfil de ${linkedin.nome}.`
+              : linkedin.motivo}
+          </p>
+        </fieldset>
+      )}
+
+      {noLinkedin ? (
+        <div>
+          <label className={label} htmlFor="forma">
+            Forma
+          </label>
+          <select
+            id="forma"
+            name="forma_linkedin"
+            className={input}
+            value={formaNoLinkedin}
+            disabled={ocupado}
+            onChange={(e) => trocarFormaNoLinkedin(e.target.value as FormaNoLinkedin)}
+          >
+            <option value="texto">{rotuloDaFormaNoLinkedin("texto")}</option>
+            <option value="imagem">{rotuloDaFormaNoLinkedin("imagem")}</option>
+          </select>
+          <p className={hint}>A imagem segue as regras da imagem do Instagram: JPEG, na proporção escolhida.</p>
+        </div>
+      ) : (
+        <div>
+          <label className={label} htmlFor="forma">
+            Forma
+          </label>
+          <select
+            id="forma"
+            name="forma"
+            className={input}
+            value={forma}
+            disabled={ocupado}
+            onChange={(e) => trocarForma(e.target.value as FormaDePublicacao)}
+          >
+            {/* AS PALAVRAS VÊM DE `rotuloDaForma` (lib/publicacao.ts): a tela de
+                agendados usa as mesmas quatro. A ORDEM é desta tela. */}
+            <option value="imagem">{rotuloDaForma("imagem")}</option>
+            <option value="carrossel">{rotuloDaForma("carrossel")}</option>
+            <option value="reels">{rotuloDaForma("reels")}</option>
+            <option value="story">{rotuloDaForma("story")}</option>
+          </select>
+          <p className={hint}>
+            No carrossel valem duas regras da Meta: reels não entra (vídeo em carrossel é vídeo comum, sem áudio
+            nomeado e sem aparecer no feed como reels), e todos os itens são cortados pela proporção do PRIMEIRO
+            — por isso a ordem importa, e dá para mudá-la na lista abaixo. São de 2 a {CARROSSEL_ITENS_MAX} itens,
+            e o post inteiro conta como uma só publicação.
+          </p>
+        </div>
+      )}
 
-      {enquadra && (
+      {enquadra && temArquivo && (
         <fieldset className="space-y-2">
           <legend className={label}>Proporção</legend>
           <div className="flex flex-wrap gap-4 text-sm">
@@ -606,6 +744,7 @@ export default function Enviador({
         </fieldset>
       )}
 
+      {temArquivo && (
       <div>
         <label className={label} htmlFor="arquivo">
           {forma === "carrossel" ? "Arquivos" : "Arquivo"}
@@ -636,6 +775,7 @@ export default function Enviador({
           </p>
         )}
       </div>
+      )}
 
       {slides.length > 0 && (
         <div className={`${card} space-y-3 p-4`}>
@@ -669,29 +809,57 @@ export default function Enviador({
         </div>
       )}
 
-      <div>
-        <label className={label} htmlFor="legenda">
-          Legenda
-        </label>
-        <textarea
-          id="legenda"
-          name="legenda"
-          rows={5}
-          value={legenda}
-          disabled={ocupado}
-          onChange={(e) => setLegenda(e.target.value)}
-          className={input}
-          placeholder="O texto que aparece embaixo do post."
-        />
-        <div className="mt-1.5 flex items-start justify-between gap-3">
-          <p className={problemaDaLegendaAtual ? fieldError : hint}>
-            {problemaDaLegendaAtual
-              ? textoDoProblemaDaLegenda(problemaDaLegendaAtual)
-              : "Hashtags e menções contam: 30 e 20 são os limites do Instagram."}
-          </p>
-          <p className={`shrink-0 text-xs ${numero} ${muted}`}>{legenda.length}/2200</p>
+      {noLinkedin ? (
+        // O TEXTO DO LINKEDIN: o mesmo estado da legenda (trocar de rede não apaga o que se escreveu), outro nome
+        // no formulário, e o contador que conta como o LinkedIn conta, com a frase que diz por quê (achado 212).
+        <div>
+          <label className={label} htmlFor="texto">
+            Texto
+          </label>
+          <textarea
+            id="texto"
+            name="texto"
+            rows={5}
+            value={legenda}
+            disabled={ocupado}
+            onChange={(e) => setLegenda(e.target.value)}
+            className={input}
+            placeholder="O texto do post no LinkedIn."
+          />
+          <div className="mt-1.5 flex items-start justify-between gap-3">
+            <p className={textoLongoNoLinkedin ? fieldError : hint}>
+              {textoLongoNoLinkedin ? textoDaRecusaNoLinkedin("texto_longo") : NOTA_DO_CONTADOR_DO_LINKEDIN}
+            </p>
+            <p className={`shrink-0 text-xs ${numero} ${muted}`}>
+              {tamanhoDoTextoNoLinkedin(legenda.trim())}/{LIMITE_DO_TEXTO_DO_LINKEDIN}
+            </p>
+          </div>
         </div>
-      </div>
+      ) : (
+        <div>
+          <label className={label} htmlFor="legenda">
+            Legenda
+          </label>
+          <textarea
+            id="legenda"
+            name="legenda"
+            rows={5}
+            value={legenda}
+            disabled={ocupado}
+            onChange={(e) => setLegenda(e.target.value)}
+            className={input}
+            placeholder="O texto que aparece embaixo do post."
+          />
+          <div className="mt-1.5 flex items-start justify-between gap-3">
+            <p className={problemaDaLegendaAtual ? fieldError : hint}>
+              {problemaDaLegendaAtual
+                ? textoDoProblemaDaLegenda(problemaDaLegendaAtual)
+                : "Hashtags e menções contam: 30 e 20 são os limites do Instagram."}
+            </p>
+            <p className={`shrink-0 text-xs ${numero} ${muted}`}>{legenda.length}/2200</p>
+          </div>
+        </div>
+      )}
 
       {/* A LISTA DOS ENVIOS DENTRO DA TELA, além da janelinha do canto: as duas
           leem o MESMO depósito e a MESMA função pura. */}
@@ -714,7 +882,8 @@ export default function Enviador({
           a tela travar, então travar não tira nada do pedido. */}
       <fieldset disabled={ocupado} className="m-0 min-w-0 space-y-6 border-0 p-0">
         {quando}
-        {opcoesDoReels}
+        {/* AS OPÇÕES DO REELS SÃO DO INSTAGRAM: no LinkedIn elas saem da tela e do formulário. */}
+        {!noLinkedin && opcoesDoReels}
       </fieldset>
 
       {recusa && (
```

Em `app/page.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/page.tsx b/app/page.tsx
index faa1644..31b28bb 100644
--- a/app/page.tsx
+++ b/app/page.tsx
@@ -19,9 +19,9 @@ import {
 import { oportunidadesDaConta } from "@/lib/oportunidades";
 import { fraseDoPulso, fraseDas24h } from "@/lib/pulso";
 // KINDS_FORA_DA_ENTREGA_DO_MOTOR É A LISTA DE VERDADE DE "ISSO NÃO É O MOTOR
-// ENTREGANDO": o pulso não pode escrever `'dm_manual'` nem `'publicacao'` de
-// próprio punho, porque as duas strings já moram em lib/envio-filters.ts
-// (espelhadas pelo SQL de Envios) — uma segunda definição aqui é a próxima
+// ENTREGANDO": o pulso não pode escrever `'dm_manual'` nem os tipos de post de
+// próprio punho, porque eles já moram em lib/envio-filters.ts (os posts, pela
+// lista de lib/fila-tipos.ts) — uma segunda definição aqui é a próxima
 // divergência. STATUS_DE_FILA_VIVA é a mesma ideia para "o que ainda vai
 // sair" (mora ao lado, no mesmo arquivo).
 import { KINDS_FORA_DA_ENTREGA_DO_MOTOR, STATUS_DE_FILA_VIVA } from "@/lib/envio-filters";
```

Em `lib/pulso.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/pulso.ts b/lib/pulso.ts
index 646b15a..150effb 100644
--- a/lib/pulso.ts
+++ b/lib/pulso.ts
@@ -42,7 +42,7 @@ export function fraseDoPulso(p: {
  *
  * ESTA FRASE E A DO PULSO FALAM DE COISAS DIFERENTES, e a spec escreve isso para
  * ninguém "consertar" a duplicação: o pulso conta só o que o MOTOR entregou
- * SOZINHO (a fila, menos os kinds manuais — `dm_manual` — e menos `publicacao`);
+ * SOZINHO (a fila, menos os kinds manuais — `dm_manual` — e menos os posts, do Instagram e do LinkedIn);
  * esta conta o MOVIMENTO DA CONTA inteiro, incluindo o que foi feito à mão.
  *
  * A RESPOSTA DIGITADA NA TELA NÃO "ESTÁ SÓ NOS EVENTOS" — ela passa pela MESMA
```

A conta da action vem de `getSelectedAccount` (a regra das contas), e nunca do formulário; os caminhos passam por `caminhosDoCampo` com a pasta dessa conta. O começo da função é a SEGUNDA linha da action, porque a primeira de toda action é `await exigirSessao();` (`tests/sessao-nas-actions.test.ts`).

- [ ] **Passo 4: rodar e ver passar**

```bash
env -u CLAUDECODE -u AI_AGENT npx --no-install vitest run
env -u CLAUDECODE -u AI_AGENT npx --no-install vitest run --config vitest.dom.config.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" \
  npx --no-install vitest run --config vitest.integracao.config.ts \
  testes-integracao/linkedin-compor.integracao.ts testes-integracao/linkedin-publicacao.integracao.ts \
  testes-integracao/publicar-fala.integracao.ts
npx --no-install tsc --noEmit
npx --no-install eslint app/publicar app/page.tsx lib/linkedin-fila.ts lib/linkedin-publicacao.ts lib/pulso.ts \
  testes-dom/publicar-compositor-linkedin.dom.tsx testes-integracao/linkedin-compor.integracao.ts \
  testes-integracao/linkedin-publicacao.integracao.ts tests/dreno-com-prazo.test.ts tests/linkedin-compor.test.ts \
  tests/linkedin-token-fora-do-cliente.test.ts tests/publicar-compositor-guarda.test.ts
```

Esperado: nos puros, "Test Files 155 passed (155)" e "Tests 3714 passed (3714)"; na tela, "Test Files 36 passed (36)" e "Tests 324 passed (324)"; na integração, `ALVO: banco de TESTE`, "Test Files 3 passed (3)" e "Tests 60 passed (60)", e o `tsc` e o lint sem saída.

- [ ] **Passo 5: o commit**

A mensagem do commit, gravada em `$SCRATCH/msg-li2-f5.txt`:

```text
A tela de compor escolhe a rede, e o post do LinkedIn sai só com texto ou com imagem, com o contador que conta como o LinkedIn
```

```bash
git add -- app/publicar/actions.ts app/publicar/enviador.tsx app/publicar/novo/page.tsx lib/linkedin-fila.ts \
  lib/linkedin-publicacao.ts app/page.tsx lib/pulso.ts testes-dom/publicar-compositor-linkedin.dom.tsx \
  testes-integracao/linkedin-compor.integracao.ts testes-integracao/linkedin-publicacao.integracao.ts \
  tests/dreno-com-prazo.test.ts tests/linkedin-compor.test.ts tests/linkedin-token-fora-do-cliente.test.ts \
  tests/publicar-compositor-guarda.test.ts
git commit -F "$SCRATCH/msg-li2-f5.txt"
```

---

### FASE 6 — O tique do "agora" que lança, e os reforços dos testes

**Arquivos:** `app/publicar/actions.ts`, `lib/queue-drain.ts`, `testes-integracao/linkedin-compor.integracao.ts`, `testes-integracao/linkedin-publicacao.integracao.ts`, `testes-integracao/tique-do-rodape.integracao.ts`.

- [ ] **Passo 1: os testes**

Em `testes-integracao/tique-do-rodape.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/tique-do-rodape.integracao.ts b/testes-integracao/tique-do-rodape.integracao.ts
index 971c9b9..5749edf 100644
--- a/testes-integracao/tique-do-rodape.integracao.ts
+++ b/testes-integracao/tique-do-rodape.integracao.ts
@@ -68,10 +68,26 @@ import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vit
 import { bancoDescartavel } from "./harness";
 import { comoNumaRequisicaoComSessao } from "./semear-requisicao";
 
+// O "AGORA" DO LINKEDIN QUE LANÇA (nota da auditoria sobre a F4): `drenarUmaPublicacaoDoLinkedin` pode lançar antes
+// de pegar a linha (o banco engasgou no `update`), e a action tem de armar o tique dela, ou o post espera o próximo
+// webhook. O módulo do dreno é o de verdade; só esta função ganha uma chave que a faz lançar, desligada por padrão.
+const controleDoAgora = vi.hoisted(() => ({ lancar: false }));
+vi.mock("@/lib/queue-drain", async (original) => {
+  const real = await original<typeof import("@/lib/queue-drain")>();
+  return {
+    ...real,
+    drenarUmaPublicacaoDoLinkedin: async (...args: Parameters<typeof real.drenarUmaPublicacaoDoLinkedin>) => {
+      if (controleDoAgora.lancar) throw new Error("o banco engasgou antes de pegar a linha");
+      return real.drenarUmaPublicacaoDoLinkedin(...args);
+    },
+  };
+});
+
 type ModuloEngine = typeof import("@/lib/engine");
 type ModuloDreno = typeof import("@/lib/queue-drain");
 type ModuloQstash = typeof import("@/lib/qstash");
 type ModuloAcoes = typeof import("@/app/publicar/post/actions");
+type ModuloPublicar = typeof import("@/app/publicar/actions");
 
 const banco = bancoDescartavel();
 
@@ -92,6 +108,7 @@ let engine: ModuloEngine;
 let dreno: ModuloDreno;
 let qstash: ModuloQstash;
 let acoes: ModuloAcoes;
+let publicarAcoes: ModuloPublicar;
 
 function responderJson(res: ServerResponse, corpo: unknown) {
   res.writeHead(200, { "content-type": "application/json" });
@@ -141,6 +158,7 @@ beforeAll(async () => {
   dreno = await import("@/lib/queue-drain");
   qstash = await import("@/lib/qstash");
   acoes = (await import("@/app/publicar/post/actions")) as ModuloAcoes;
+  publicarAcoes = (await import("@/app/publicar/actions")) as ModuloPublicar;
 
   // --- TRAVA 1: para onde o cliente do QStash resolveu, ANTES de enviar ------
   const { Client } = await import("@upstash/qstash");
@@ -762,4 +780,64 @@ describe("o \"agora\" do LinkedIn que devolve a linha à fila pede o tique dela"
     expect(segundosDoTique(0)).toBeGreaterThanOrEqual(120);
     expect(segundosDoTique(0)).toBeLessThanOrEqual(130);
   });
+
+  test("o \"agora\" da tela que lança antes de pegar a linha arma o tique dela, e o aviso diz que vai sair", async () => {
+    await banco
+      .db()
+      .sql()
+      .query(
+        `insert into linkedin_conexoes (account_id, pessoa_id, nome, access_token, expira_em)
+         values ($1, 'pessoaDoTique', 'Pessoa do Tique', 'autorizacao-inventada-que-nao-vale-nada', now() + interval '30 days')
+         on conflict (account_id) do nothing`,
+        [CONTA]
+      );
+    const form = new FormData();
+    for (const [k, v] of Object.entries({
+      forma_linkedin: "texto",
+      caminhos: "",
+      texto: "Olá",
+      id_do_envio: "9f1c2e3d-0000-4000-8000-0000000003a1",
+      quando: "agora",
+      data_hora: "",
+      fuso: "0",
+    })) {
+      form.set(k, v);
+    }
+    controleDoAgora.lancar = true;
+    let aviso: { texto: string | null; tom: string | null };
+    try {
+      aviso = await avisoDe(publicarAcoes.publicarNoLinkedin, form);
+    } finally {
+      controleDoAgora.lancar = false;
+    }
+    expect(aviso.tom).toBe("ok");
+    expect(aviso.texto).toContain("vai sair em instantes");
+    const [linha] = (await banco
+      .db()
+      .sql()
+      .query(`select status from queue where kind = 'publicacao_linkedin'`)) as { status: string }[];
+    expect(linha.status).toBe("pending");
+    expect(publicados.length).toBe(1);
+    expect(segundosDoTique(0)).toBeGreaterThanOrEqual(20);
+    expect(segundosDoTique(0)).toBeLessThanOrEqual(30);
+  });
+});
+
+// O CRON ARMA O TIQUE DO POST DO LINKEDIN AGENDADO, como o do Instagram: `armarTiquesDoDia` pergunta pelos tipos de
+// post (lib/fila-tipos.ts, TIPOS_DE_PUBLICACAO), e não só por `publicacao`.
+test("o cron do dia arma o tique do post do LinkedIn agendado para daqui a duas horas", async () => {
+  await banco
+    .db()
+    .sql()
+    .query(
+      `insert into queue (account_id, kind, payload, dedupe_key, not_before)
+       values ($1, 'publicacao_linkedin', '{"forma":"texto","caminhos":[],"texto":"depois"}'::jsonb,
+               'pub-linkedin:tique:cron', now() + interval '2 hours')`,
+      [CONTA]
+    );
+  publicados = [];
+  expect(await dreno.armarTiquesDoDia()).toEqual({ armados: 1 });
+  expect(publicados.length).toBe(1);
+  expect(segundosDoTique(0)).toBeGreaterThan(2 * 3600 - 60);
+  expect(segundosDoTique(0)).toBeLessThanOrEqual(2 * 3600 + 10);
 });
```

Em `testes-integracao/linkedin-publicacao.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/linkedin-publicacao.integracao.ts b/testes-integracao/linkedin-publicacao.integracao.ts
index 2f95900..9db893a 100644
--- a/testes-integracao/linkedin-publicacao.integracao.ts
+++ b/testes-integracao/linkedin-publicacao.integracao.ts
@@ -40,6 +40,8 @@ const linkedin = {
   segurarOPost: null as null | Promise<void>,
   statusDaReserva: 200,
   desconhecidos: [] as string[],
+  /** Para cada POST do post: a linha já tinha a marca `post_tentado_em` quando ele chegou? (achado 210) */
+  marcadaNoPost: [] as (boolean | null)[],
   /** Chamado quando o PUT da imagem chega: é como o caso faz o relógio andar durante o envio. */
   aoEnviar: null as null | (() => void),
 };
@@ -86,6 +88,11 @@ beforeAll(async () => {
       return responder(res, 201, "");
     }
     if (req.method === "POST" && u.pathname === "/rest/posts") {
+      // A MARCA ANTES DO POST, medida no banco no instante em que o POST chega.
+      const [l] = await q(
+        `select payload ? 'post_tentado_em' as marcada from queue where kind = 'publicacao_linkedin' and status = 'sending' limit 1`
+      );
+      linkedin.marcadaNoPost.push(l ? Boolean(l.marcada) : null);
       if (linkedin.segurarOPost) await linkedin.segurarOPost;
       if (linkedin.statusDoPost !== 201) return responder(res, linkedin.statusDoPost, { message: "o post falhou de propósito" });
       linkedin.posts.push(JSON.parse(corpo.toString()) as Record<string, unknown>);
@@ -169,6 +176,7 @@ beforeEach(async () => {
     segurarOPost: null,
     statusDaReserva: 200,
     desconhecidos: [],
+    marcadaNoPost: [],
     aoEnviar: null,
   });
   bucket.apagados = [];
@@ -259,6 +267,8 @@ describe("o dreno publica no LinkedIn", () => {
     expect(linha.error).toBeNull();
     expect((linha.payload as Record<string, unknown>).post_urn).toBe("urn:li:share:7000000000000000001");
     expect(typeof (linha.payload as Record<string, unknown>).post_tentado_em).toBe("string");
+    // A MARCA JÁ ESTAVA NO BANCO QUANDO O POST CHEGOU (achado 210), e não foi gravada depois dele.
+    expect(linkedin.marcadaNoPost).toEqual([true]);
   });
 
   it("imagem: reserva com a pessoa dona, envia os bytes do bucket, publica com a imagem e só então apaga o arquivo", async () => {
@@ -288,6 +298,33 @@ describe("o dreno publica no LinkedIn", () => {
     expect((await linhaDoLinkedin()).status).toBe("sent");
     expect(linkedin.posts).toHaveLength(1);
   });
+
+  it("o post do LinkedIn que saiu não conta na cota horária de DM", async () => {
+    // 189 DMs e 1 post do LinkedIn saíram na última hora: são 189 mensagens, abaixo do teto de 190, e a conta não
+    // é bloqueada. Contando o post, seriam 190, e a DM pendente nem seria pega.
+    await q(
+      `insert into queue (account_id, kind, payload, dedupe_key, status, sent_at, not_before)
+       select $1, 'dm_lote', '{}'::jsonb, 'cota-' || g, 'sent', now() - interval '10 minutes', now() - interval '10 minutes'
+         from generate_series(1, 189) g`,
+      [CONTA]
+    );
+    await q(
+      `insert into queue (account_id, kind, payload, dedupe_key, status, sent_at, not_before)
+       values ($1, 'publicacao_linkedin', '{"forma":"texto","caminhos":[],"texto":"x"}'::jsonb, 'cota-li', 'sent',
+               now() - interval '5 minutes', now() - interval '5 minutes')`,
+      [CONTA]
+    );
+    await q(
+      `insert into queue (account_id, kind, contact_ig_id, payload, dedupe_key)
+       values ($1, 'dm_manual', '99000000000000025', '{"text":"oi"}'::jsonb, 'cota-dm')`,
+      [CONTA]
+    );
+    await dreno.drainQueue();
+    // PEGA é o que importa: a reivindicação conta a tentativa. Sem Meta nesta rodada, o envio não sai, e não
+    // precisa: o que se mede é que a conta não ficou fora do lote.
+    const [dm] = await q(`select attempts from queue where dedupe_key = 'cota-dm'`);
+    expect(dm.attempts).toBe(1);
+  });
 });
 
 describe("o post do LinkedIn nunca sai duas vezes (achado 210)", () => {
@@ -512,6 +549,16 @@ describe("o \"agora\" drena só a própria linha (achado 211)", () => {
     );
     const ig = String((await q(`select id from queue where kind = 'publicacao'`))[0].id);
     expect(await dreno.drenarUmaPublicacaoDoLinkedin(ig)).toBeNull();
+    // A QUE JÁ SAIU: uma linha do LinkedIn `sent`, com a hora no passado e sem o URN, que um "agora" sem o
+    // `status = 'pending'` publicaria de novo.
+    const [saiu] = await q(
+      `insert into queue (account_id, kind, payload, dedupe_key, status, sent_at, not_before)
+       values ($1, 'publicacao_linkedin', '{"forma":"texto","caminhos":[],"texto":"já saiu"}'::jsonb, 'pub-linkedin:ja-saiu',
+               'sent', now() - interval '1 minute', now() - interval '2 minutes')
+       returning id`,
+      [CONTA]
+    );
+    expect(await dreno.drenarUmaPublicacaoDoLinkedin(String(saiu.id))).toBeNull();
     expect(await dreno.drenarUmaPublicacaoDoLinkedin("não é uuid")).toBeNull();
     expect(linkedin.pedidos).toHaveLength(0);
   });
```

Em `testes-integracao/linkedin-compor.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/linkedin-compor.integracao.ts b/testes-integracao/linkedin-compor.integracao.ts
index 5d88e0e..1ece954 100644
--- a/testes-integracao/linkedin-compor.integracao.ts
+++ b/testes-integracao/linkedin-compor.integracao.ts
@@ -273,15 +273,16 @@ describe("a regra das contas: a conta vem da sessão, e nunca do formulário", (
     expect((await linhas())[0]).toMatchObject({ account_id: CONTA_A, status: "sent" });
   });
 
-  it("o login comum sem conta nenhuma não publica, nem com o cookie de uma conta com LinkedIn", async () => {
-    const aviso = await publicarComoComum(formulario(), [], CONTA_A);
+  // O CAMPO "conta" NO FORMULÁRIO é o que mandaria quem tentasse escolher a conta por fora: a action não o lê.
+  it("o login comum sem conta nenhuma não publica, nem com o cookie nem com um campo de uma conta com LinkedIn", async () => {
+    const aviso = await publicarComoComum(formulario({ conta: CONTA_A }), [], CONTA_A);
     expect(aviso.tom).toBe("erro");
     expect(await linhas()).toEqual([]);
     expect(linkedin.pedidos).toEqual([]);
   });
 
   it("o login comum só com outra conta não publica no LinkedIn da conta que ele não vê", async () => {
-    const aviso = await publicarComoComum(formulario(), [CONTA_B], CONTA_A);
+    const aviso = await publicarComoComum(formulario({ conta: CONTA_A }), [CONTA_B], CONTA_A);
     expect(aviso.tom).toBe("erro");
     expect(await linhas()).toEqual([]);
     expect(linkedin.pedidos).toEqual([]);
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" \
  npx --no-install vitest run --config vitest.integracao.config.ts \
  testes-integracao/tique-do-rodape.integracao.ts testes-integracao/linkedin-publicacao.integracao.ts \
  testes-integracao/linkedin-compor.integracao.ts
```

Esperado: `ALVO: banco de TESTE` e "Tests 1 failed | 63 passed (64)": cai "o "agora" da tela que lança antes de pegar a linha arma o tique dela, e o aviso diz que vai sair" (o aviso e a linha já estão certos, e nenhum tique é pedido). Os reforços dos outros dois arquivos passam: eles prendem código que já existe, e as mutações do Apêndice A provam que eles mordem.

- [ ] **Passo 3: o código**

Em `lib/queue-drain.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/queue-drain.ts b/lib/queue-drain.ts
index e1a6066..47bf5d1 100644
--- a/lib/queue-drain.ts
+++ b/lib/queue-drain.ts
@@ -1047,8 +1047,9 @@ export async function drenarUmaPublicacaoDoLinkedin(
 /**
  * O TIQUE DE UMA LINHA QUE VOLTOU À FILA, pela hora dela e com a mesma conta do rodapé do `drainQueue` (vinte
  * segundos no mínimo, o horizonte no máximo). Calado como os outros: sem tique o post ainda sai, só mais tarde.
+ * A action de publicar no LinkedIn também o chama, quando o "agora" lança antes de pegar a linha.
  */
-async function armarOTiqueDaLinha(id: string): Promise<void> {
+export async function armarOTiqueDaLinha(id: string): Promise<void> {
   try {
     const [linha] = (await sql().query(
       `select extract(epoch from (not_before - now()))::float8 as secs from queue where id = $1 and status = 'pending'`,
```

Em `app/publicar/actions.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/publicar/actions.ts b/app/publicar/actions.ts
index a27579e..a916999 100644
--- a/app/publicar/actions.ts
+++ b/app/publicar/actions.ts
@@ -30,7 +30,7 @@ import {
   textoDaRecusaNoLinkedin,
 } from "@/lib/linkedin-publicacao";
 import { enqueuePublicacaoNoLinkedin, erroDaLinha } from "@/lib/linkedin-fila";
-import { drenarUmaPublicacaoDoLinkedin } from "@/lib/queue-drain";
+import { armarOTiqueDaLinha, drenarUmaPublicacaoDoLinkedin } from "@/lib/queue-drain";
 
 /**
  * Enfileira uma publicação para a conta selecionada.
@@ -259,7 +259,11 @@ export async function publicarNoLinkedin(formData: FormData): Promise<void> {
       desfecho = await drenarUmaPublicacaoDoLinkedin(r.id, inicioDaFuncaoMs);
       if (desfecho === "falhou") motivo = await erroDaLinha(r.id);
     } catch {
+      // O "AGORA" LANÇOU, talvez antes de pegar a linha (o banco engasgou no `update`), e aí ela ficou `pending`
+      // sem tique: o enfileirar não arma tique para o que já vale. Este tique é o que faz o "vai sair em instantes"
+      // ser verdade (nota da auditoria sobre a F4). Calado, como os outros.
       desfecho = null;
+      await armarOTiqueDaLinha(r.id);
     }
   }
 
```

- [ ] **Passo 4: rodar e ver passar**

```bash
env -u CLAUDECODE -u AI_AGENT npx --no-install vitest run
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" \
  npx --no-install vitest run --config vitest.integracao.config.ts \
  testes-integracao/tique-do-rodape.integracao.ts testes-integracao/linkedin-publicacao.integracao.ts \
  testes-integracao/linkedin-compor.integracao.ts
npx --no-install tsc --noEmit
npx --no-install eslint app/publicar/actions.ts lib/queue-drain.ts testes-integracao/tique-do-rodape.integracao.ts \
  testes-integracao/linkedin-publicacao.integracao.ts testes-integracao/linkedin-compor.integracao.ts
```

Esperado: nos puros, "Test Files 155 passed (155)" e "Tests 3714 passed (3714)"; na integração, `ALVO: banco de TESTE`, "Test Files 3 passed (3)" e "Tests 64 passed (64)", e o `tsc` e o lint sem saída.

- [ ] **Passo 5: o commit**

A mensagem do commit, gravada em `$SCRATCH/msg-li2-f6.txt`:

```text
O publicar agora do LinkedIn que lança arma o tique da linha, e os testes prendem a marca antes do POST, a cota de DM e os tiques do dia
```

```bash
git add -- app/publicar/actions.ts lib/queue-drain.ts testes-integracao/linkedin-compor.integracao.ts \
  testes-integracao/linkedin-publicacao.integracao.ts testes-integracao/tique-do-rodape.integracao.ts
git commit -F "$SCRATCH/msg-li2-f6.txt"
```

---

### FASE 7 — A verificação inteira, as mutações e a guarda do diff

- [ ] **Passo 1: o verify**

```bash
env -u CLAUDECODE -u AI_AGENT npm run verify
git diff --name-only AGENTS.md   # vazio
git status --porcelain            # vazio
```

Esperado: saída 0; 155 arquivos e 3 714 casos puros; 36 e 324 de tela; "SEM VAZAMENTO em A nem em C, nas duas varreduras."; "MIGRAÇÃO PULADA — este não é um deploy de produção."; o build do Next 16.4.3.

- [ ] **Passo 2: a integração inteira, uma rodada só**

```bash
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npm run test:integracao
```

Esperado: saída 0; `ALVO: banco de TESTE`; "nenhum schema teste_tmp_* no banco" antes e depois; 75 arquivos, 897 passaram e 8 pularam.

- [ ] **Passo 3: as mutações (Apêndice A)**

```bash
node <pasta>/mutar-li2.mjs --conferir   # 37 "ÚNICO"
node <pasta>/mutar-li2.mjs
```

Esperado: as 37 como "MORTA", e "37 mutações, 0 ruins; árvore no fim: limpa". Se a rodada parar antes dessa linha, rode `git status` e `git diff` antes de qualquer outra coisa: o arquivo da mutação em curso pode ter ficado mutado, e só ele se restaura.

- [ ] **Passo 4: a guarda do diff**

```bash
git diff --stat f15c3ad HEAD -- . ':!docs'
git diff --name-only f15c3ad HEAD -- docs
```

Esperado: no primeiro, os 41 arquivos do mapa, e mais nenhum: "41 files changed, 3772 insertions(+), 250 deletions(-)". No segundo, só este plano. O patch-id de cada fase (`git show <commit> | git patch-id --stable`) tem de bater com o do ensaio: `9e3ee0d6f25c`, `d53010778a3f`, `f9ab4ba363bf`, `a9b6249974ac`, `320b6f126c51` e `c173f6cd2186`.

---

### FASE 8 — A 025 na produção, o push, a prova no preview, o PR e o deploy

Cada passo que sai da máquina, ou que grava, tem o OK do Eduardo pela caixa, a hora mandada à auditoria antes e o "pode" dela.

- [ ] **Passo 1: a 025 na produção, à mão, com o OK do Eduardo**

Antes: a auditoria tira a base da fila pelo lado dela (as contagens por tipo e por status, e o texto do `queue_kind_check`). Depois do "pode":

```bash
node --env-file="<raiz do repositório principal>/.env.local" scripts/migrar.mjs --a-mao            # o ensaio a seco
node --env-file="<raiz do repositório principal>/.env.local" scripts/migrar.mjs --aplicar --a-mao  # grava
node --env-file="<raiz do repositório principal>/.env.local" scripts/migrar.mjs --a-mao            # a 025 já aplicada, nenhum ►
```

Esperado: o primeiro ensaio a seco mostra só `►    025-fila-linkedin.sql`, com os comandos dela; a aplicação grava a 025 no registro; e o segundo ensaio a seco mostra a 025 como "já aplicada, nada a fazer", sem nenhum `►`, e a conferência do `queue_kind_check` diz "existe e confere (025-fila-linkedin.sql)". (A frase "Nada a aplicar" só sai com `--aplicar`: `scripts/migrar.mjs:561-566` na `f15c3ad`.) A auditoria lê a base depois: as mesmas contagens, e o check com o `publicacao_linkedin`.

Por que a `main` aguenta a 025 antes do merge: ela alarga o check, e o código da `main` nunca escreve o tipo novo; o dreno da `main` só pega os tipos que conhece (a preparação, PR #31), então uma linha do LinkedIn escrita pelo preview fica `pending`, intocada; e o `scripts/migrar.mjs` da `main` aceita as duas formas do check (o `tambemAceitas`), então o build da `main` continua passando.

- [ ] **Passo 2: o push da branch, com o OK do Eduardo**

```bash
git ls-remote origin refs/heads/linkedin-publicacao   # vazio; se não estiver, pare
git push -u origin refs/heads/linkedin-publicacao:refs/heads/linkedin-publicacao
```

No log do build do preview, confira: o commit, nenhum aviso do Node 26, "Detected Next.js version: 16.4.3", "MIGRAÇÃO PULADA". No deployment, meça o endereço da branch (o `alias` do `get_deployment`). Ele deve ser `metodochat-git-linkedin-publicacao-moraesvannuchi-debugs-projects.vercel.app`, pelo padrão medido nas partes anteriores.

- [ ] **Passo 3: as decisões do Eduardo, pela caixa**
  - qual conta do painel publica;
  - os dois textos dos posts da prova. Eles levam três casos do texto, para ver no LinkedIn de verdade como ficaram: uma hashtag com `_` (por exemplo, `#marketing_2026`; nota 1 da auditoria), uma hashtag com acento (por exemplo, `#educação`; o `\p{L}`, achado 212) e um "C#" no meio de uma frase (que continua texto). A imagem do segundo é a MAIOR que for usar (nota 2). O Eduardo escolhe os textos dos 2 posts sabendo que apagar o post não desfaz o que já foi visto nem as notificações, e o intervalo até apagar fica o mais curto possível (achado 190);
  - se a conexão fica no fim, ou se é desconectada.

A CONEXÃO, SE A CONTA ESTIVER SEM LINKEDIN, É PELA PRODUÇÃO: a parte 1 está em produção, então o Eduardo gera o convite do LinkedIn na Configuração de `https://metodochat.vercel.app` e o abre. A volta é a da produção, que já está no app do LinkedIn, e o preview lê a mesma tabela. O app do LinkedIn não precisa do endereço da branch nesta parte. Um convite só, gerado na hora, e usado logo (achado 209).

- [ ] **Passo 4: a prova no preview, pelo Eduardo**

O roteiro vai à auditoria antes. A espera fica numa página só de texto, e nenhum formulário fica à vista durante uma espera (achados 176 e 186). O endereço da branch fica atrás do login da Vercel, então a prova é no navegador do Eduardo. A auditoria lê a base ANTES de cada "agora" e depois dele: é o "antes e depois" de cada passo que grava, e a rede de baixo do achado 211. Os passos:
1. em "Novo post", a "Rede" mostra o LinkedIn ligado, com o nome dele;
2. o post só de texto, agora: o aviso "Post publicado no LinkedIn."; no calendário, "LinkedIn · Só texto"; na página dele, o "Ver no LinkedIn ↗" abre o post, e as hashtags e o "C#" aparecem como ficaram;
3. o post com imagem, agora: o mesmo, com "LinkedIn · Imagem". O tempo do ramo inteiro (o bucket, a reserva, o envio e o post) é medido pelo banco, pelo `sent_at` menos o `claimed_at` da linha: os registros da Vercel não trazem a duração das chamadas de saída (medido no achado 209). A auditoria lê isso na base;
4. se o "agora" responder "vai sair em instantes" ou falhar por um erro passageiro, a linha fica `pending` no banco de produção, e o tique vai para a produção, que até o merge não conhece o tipo. Nesse caso: o Eduardo cancela esse post na página dele, no preview, e avisa a auditoria; a auditoria lê a base; e o post NÃO é refeito no mesmo passo;
5. os dois posts são apagados à mão, no LinkedIn, pelo Eduardo, logo depois.

No fim, a auditoria confere que não há nenhuma linha `publicacao_linkedin` em `pending` nem em `sending`.

- [ ] **Passo 5: o PR, com o OK do Eduardo.** O corpo leva o que muda, os números deste plano, o que o ensaio achou, a 025 já aplicada, e nenhuma arroba solta. A mensagem do merge vai à parte, e a auditoria lê os dois antes de o PR abrir. O merge é do Eduardo.

- [ ] **Passo 6: o deploy do merge.**
  - No log: "Nada a aplicar: as 26 migrações já constam no registro.", o `queue_kind_check` "existe e confere (025-fila-linkedin.sql)", as outras conferências "CONFERIDO", e sem o aviso do Node 26.
  - No site: o `/entrar` dá 200, e o cron sem senha dá 401.
  - Os registros da produção da primeira hora, sem erro novo.

Com a parte 2a em produção, a parte 2b (as duas redes no mesmo post) começa pelo plano dela.

---

## Apêndice A — As mutações

O roteiro roda da raiz da cópia, com a árvore commitada e limpa, e com o `node_modules` da cópia. Cada mutação troca um trecho que aparece uma vez só, roda o arquivo de teste que a cobre e confere que o caso nomeado cai, pelo nome inteiro. As de integração rodam contra o banco de TESTE, uma de cada vez. No fim, a árvore volta limpa.

UMA DELAS É CONFERIDA PELA MENSAGEM, e não por um caso: a F2-15 (a definição do `queue_kind_check` de volta à forma da 010). O `beforeAll` de `testes-integracao/conferencia-do-kind.integracao.ts` aplica a pasta inteira pelo próprio `scripts/migrar.mjs`, e com essa troca a conferência acusa a divergência antes de qualquer caso rodar. O campo `caiPorMensagem` exige, além da saída diferente de 0 e do ALVO de teste, as duas linhas medidas no diagnóstico: "a pasta não aplicou no schema descartável" e "queue.queue_kind_check existe, MAS DIVERGE de 025-fila-linkedin.sql". A F2-14 é a regressão de verdade desta parte, a conferência aceitar de novo a forma velha, e cai pelo caso "a forma da 010, de antes da 025, agora diverge, e derruba o script".

```js
// AS MUTAÇÕES DA PARTE 2a DO LINKEDIN (só texto e imagem, uma rede por post; docs/specs/2026-11-06-linkedin-no-perfil.md),
// no molde de mutar-li1.mjs. Cada uma desfaz UMA trava, trocando um trecho exato de um arquivo (que tem de aparecer
// uma vez só), roda só o arquivo de teste que a cobre e confere que o caso NOMEADO cai, pelo nome inteiro. As de
// integração rodam contra o banco de TESTE, uma de cada vez. A árvore tem de estar commitada e limpa antes, e volta
// limpa no fim. O vitest roda por `npx --no-install` (achado 208), e a cópia tem de ter o node_modules dela.
//
// Uso, da raiz da cópia: node ../mutar-li2.mjs [prefixo-do-nome]
//                        node ../mutar-li2.mjs --conferir   (só confere que cada trecho aparece uma vez)
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const TESTES_URL = "postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes";
if (process.env.DATABASE_URL) throw new Error("RECUSADO: DATABASE_URL no ambiente");
if (!existsSync("node_modules/.bin/vitest")) throw new Error("RECUSADO: sem node_modules/.bin/vitest nesta cópia");
const status = () => execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim();
if (status() !== "") throw new Error("RECUSADO: árvore suja antes das mutações");

const PURO = { config: null };
const TELA = { config: "vitest.dom.config.ts" };
const INTEG = { config: "vitest.integracao.config.ts" };

const T_FILA = { ...INTEG, arquivo: "testes-integracao/linkedin-publicacao.integracao.ts" };
const T_TIQUE = { ...INTEG, arquivo: "testes-integracao/tique-do-rodape.integracao.ts" };
const T_KIND = { ...INTEG, arquivo: "testes-integracao/conferencia-do-kind.integracao.ts" };
const T_TELAS = { ...INTEG, arquivo: "testes-integracao/linkedin-telas.integracao.ts" };
const T_COMPOR = { ...INTEG, arquivo: "testes-integracao/linkedin-compor.integracao.ts" };
const T_POST = { ...PURO, arquivo: "tests/linkedin-post.test.ts" };
const T_REST = { ...PURO, arquivo: "tests/linkedin-rest.test.ts" };
const T_PRAZO = { ...PURO, arquivo: "tests/dreno-com-prazo.test.ts" };
const T_TIPOS = { ...PURO, arquivo: "tests/fila-tipos.test.ts" };
const T_POST_DA_FILA = { ...PURO, arquivo: "tests/post-da-fila.test.ts" };
const T_TELA_COMPOR = { ...TELA, arquivo: "testes-dom/publicar-compositor-linkedin.dom.tsx" };

const FILA = "lib/linkedin-fila.ts";
const DRENO = "lib/queue-drain.ts";
const REGRAS = "lib/linkedin-publicacao.ts";
const ACAO = "app/publicar/actions.ts";

const MUTACOES = [
  // ---- F2: a fila e o dreno (achados 210 e 211, e o 212) ----
  {
    nome: "F2-1: a marca do POST tirada",
    arq: FILA,
    de: "  await deps.guardarNoPayload(item.id, { post_tentado_em: new Date().toISOString() });\n",
    para: "",
    teste: T_FILA,
    cai: "só texto: o post sai com o autor pessoa e o texto já transformado, e a linha fica sent com o URN",
  },
  {
    nome: "F2-2: a marca sem o URN publica de novo",
    arq: FILA,
    de: "  if (pub.postTentadoEm) {\n",
    para: "  if (false) {\n",
    teste: T_FILA,
    cai: "com o post tentado e sem o URN, a linha vai a failed dizendo para conferir, e não publica",
  },
  {
    nome: "F2-3: o 4xx não tira a marca",
    arq: FILA,
    de: "    await tirarAMarcaDoPost(item.id);\n",
    para: "",
    teste: T_FILA,
    cai: "o 429 no post não criou nada: a marca sai, e a linha volta à fila para tentar de novo",
  },
  {
    nome: "F2-4: o agora pega a linha sem o kind",
    arq: DRENO,
    de: "      where id = $1 and kind = 'publicacao_linkedin' and status = 'pending' and not_before <= now()\n",
    para: "      where id = $1 and status = 'pending' and not_before <= now()\n",
    teste: T_FILA,
    cai: "não pega a linha de outro tipo, a agendada nem a que já saiu",
  },
  {
    nome: "F2-5: o agora pega a linha sem o status",
    arq: DRENO,
    de: "      where id = $1 and kind = 'publicacao_linkedin' and status = 'pending' and not_before <= now()\n",
    para: "      where id = $1 and kind = 'publicacao_linkedin' and not_before <= now()\n",
    teste: T_FILA,
    cai: "não pega a linha de outro tipo, a agendada nem a que já saiu",
  },
  {
    nome: "F2-6: o agora pega a linha sem o not_before",
    arq: DRENO,
    de: "      where id = $1 and kind = 'publicacao_linkedin' and status = 'pending' and not_before <= now()\n",
    para: "      where id = $1 and kind = 'publicacao_linkedin' and status = 'pending'\n",
    teste: T_FILA,
    cai: "não pega a linha de outro tipo, a agendada nem a que já saiu",
  },
  {
    nome: "F2-7: a hashtag com \\w no lugar de \\p{L}",
    arq: REGRAS,
    de: "const HASHTAG = /(?<![\\p{L}\\p{N}_])#([\\p{L}\\p{N}_]+)/gu;\n",
    para: "const HASHTAG = /(?<![\\w])#([\\w]+)/gu;\n",
    teste: T_POST,
    cai: "transforma o #palavra em hashtag clicável, inteira, com acento",
  },
  {
    nome: "F2-8: o enfileirar sem as recusas do pedido",
    arq: FILA,
    de: "  if (recusaDoPedidoNoLinkedin({ ...pedido, texto: payload.texto }) || !lerPayloadDoLinkedin(payload)) {\n",
    para: "  if (!lerPayloadDoLinkedin(payload)) {\n",
    teste: T_FILA,
    cai: "não entra o texto vazio, o longo demais, a imagem sem arquivo nem o envio sem id",
  },
  {
    nome: "F2-9: o post pode ter saído só na falha de rede",
    arq: REGRAS,
    de: "  return !(status >= 400 && status < 500);\n",
    para: "  return status === 0;\n",
    teste: T_POST,
    cai: "depois do POST, só o 4xx prova que o post não saiu; a rede, o 5xx e o 2xx sem id deixam a dúvida",
  },
  {
    nome: "F2-10: a cota de DM conta o post do LinkedIn",
    arq: DRENO,
    de: "      and not (kind = any(${Array.from(TIPOS_DE_PUBLICACAO)}::text[]))\n",
    para: "      and kind <> 'publicacao'\n",
    teste: T_FILA,
    cai: "o post do LinkedIn que saiu não conta na cota horária de DM",
  },
  {
    nome: "F2-11: a exceção do teto de DM só para o Instagram",
    arq: DRENO,
    de: "           and (kind = any($4::text[])\n",
    para: "           and (kind = any($4::text[]) and kind = 'publicacao'\n",
    teste: T_FILA,
    cai: "o post sai mesmo com a conta no teto horário de DM",
  },
  {
    nome: "F2-12: os tiques do dia só para o Instagram",
    arq: DRENO,
    de: "      where kind = any($2::text[]) and status = 'pending'\n",
    para: "      where kind = any($2::text[]) and kind = 'publicacao' and status = 'pending'\n",
    teste: T_TIQUE,
    cai: "o cron do dia arma o tique do post do LinkedIn agendado para daqui a duas horas",
  },
  {
    nome: "F2-13: o dreno sem o tipo do LinkedIn",
    arq: "lib/fila-tipos.ts",
    de: '  "publicacao_linkedin",\n] as const;\n',
    para: "] as const;\n",
    teste: T_TIPOS,
    cai: "são exatamente os do queue_kind_check da última migração que o escreve",
  },
  {
    // A REGRESSÃO DE VERDADE DESTA PARTE: a conferência aceitar de novo a forma velha. O tambemAceitas volta com o
    // texto EXATO da definição da 010 (scripts/migrar.mjs na f15c3ad, a linha do queue_kind_check).
    nome: "F2-14: a conferência aceita de novo a forma da 010",
    arq: "scripts/migrar.mjs",
    de: "      \"'publicacao_linkedin'::text])))\",\n  },\n  {\n    // A GÊMEA DA LINHA ACIMA",
    para:
      "      \"'publicacao_linkedin'::text])))\",\n" +
      "    tambemAceitas: [\n" +
      "      {\n" +
      '        de: "010-fila-publicacao.sql",\n' +
      "        definicao:\n" +
      "          \"CHECK ((kind = ANY (ARRAY['private_reply'::text, 'comment_reply'::text, \" +\n" +
      "          \"'dm_welcome'::text, 'dm_link'::text, 'dm_reminder'::text, \" +\n" +
      "          \"'dm_follow_gate'::text, 'dm_email_ask'::text, 'story_reaction'::text, \" +\n" +
      "          \"'dm_manual'::text, 'dm_lote'::text, 'publicacao'::text])))\",\n" +
      "      },\n" +
      "    ],\n" +
      "  },\n  {\n    // A GÊMEA DA LINHA ACIMA",
    teste: T_KIND,
    cai: "a forma da 010, de antes da 025, agora diverge, e derruba o script",
  },
  {
    // A TRAVA ANTIGA (a definição de volta à forma da 010). Ela é pega pelo beforeAll do teste, que aplica a pasta
    // pelo próprio script, e não por um caso: a conferência é a saída, o ALVO e as duas linhas da mensagem, medidas
    // no diagnóstico (el2-mutar-f2-14.log).
    nome: "F2-15: a definição do kind de volta à forma da 010",
    arq: "scripts/migrar.mjs",
    de: "      \"'dm_manual'::text, 'dm_lote'::text, 'publicacao'::text, \" +\n      \"'publicacao_linkedin'::text])))\",\n",
    para: "      \"'dm_manual'::text, 'dm_lote'::text, 'publicacao'::text])))\",\n",
    teste: T_KIND,
    caiPorMensagem: [
      "a pasta não aplicou no schema descartável",
      "queue.queue_kind_check existe, MAS DIVERGE de 025-fila-linkedin.sql",
    ],
  },

  // ---- F2-bis: o orçamento de tempo e o tique do agora ----
  {
    nome: "B-1: sem a conferência de tempo antes da imagem",
    arq: FILA,
    de: "  if (deps.prazoMs - Date.now() < precisa) {\n",
    para: "  if (false) {\n",
    teste: T_FILA,
    cai: "imagem, com 25 s restando: não baixa, não reserva e volta pending",
  },
  {
    nome: "B-2: sem a conferência de tempo antes da marca",
    arq: FILA,
    de: "  if (deps.prazoMs - Date.now() < TEMPO_PARA_O_POST_MS) {\n",
    para: "  if (false) {\n",
    teste: T_FILA,
    cai: "a imagem que termina perto do fim para antes da marca; a passada seguinte só publica",
  },
  {
    nome: "B-3: a volta sem tempo gasta a tentativa",
    arq: FILA,
    de: "    `update queue set status = 'pending', attempts = greatest(attempts - 1, 0),\n",
    para: "    `update queue set status = 'pending', attempts = attempts,\n",
    teste: T_FILA,
    cai: "só texto, com 5 s restando: não chama o LinkedIn, volta pending e não gasta a tentativa",
  },
  {
    nome: "B-4: o agora que devolve a linha não arma o tique",
    arq: DRENO,
    de: '  if (desfecho === "aguardando") await armarOTiqueDaLinha(item.id);\n',
    para: "",
    teste: T_TIQUE,
    cai: "sem tempo para o post, a linha volta em ~20 s, e o tique é pedido para ela",
  },
  {
    nome: "B-5: o tique da fila sem o começo da função",
    arq: "app/api/queue/tick/route.ts",
    de: "  const result = await drainQueue({ inicioDaFuncaoMs });\n",
    para: "  const result = await drainQueue();\n",
    teste: T_PRAZO,
    cai: "app/api/queue/tick/route.ts",
  },
  {
    nome: "B-6: o envio da imagem com o teto de 10 s",
    arq: "lib/linkedin.ts",
    de: "    TETO_DO_ENVIO_DA_IMAGEM_MS\n  );\n",
    para: "    TETO_DO_LINKEDIN_MS\n  );\n",
    teste: T_REST,
    cai: "o envio da imagem tem 15 s",
  },

  // ---- F3: as telas ----
  {
    nome: "T-1: o calendário só com o Instagram",
    arq: "app/publicar/page.tsx",
    de: "            where account_id = $1 and kind = any($5::text[])\n",
    para: "            where account_id = $1 and kind = any($5::text[]) and kind = 'publicacao'\n",
    teste: T_TELAS,
    cai: "o calendário mostra o post do LinkedIn com a rede no nome e o link para a página dele",
  },
  {
    nome: "T-2: a página do post só com o Instagram",
    arq: "app/publicar/post/[id]/page.tsx",
    de: "          where q.id = $1::uuid and q.account_id = $2 and q.kind = any($3::text[])`,\n",
    para: "          where q.id = $1::uuid and q.account_id = $2 and q.kind = any($3::text[]) and q.kind = 'publicacao'`,\n",
    teste: T_TELAS,
    cai: "agendado: o texto inteiro, os formulários e a nota de apagar pelo LinkedIn, sem falar com a Meta",
  },
  {
    nome: "T-3: o cancelar e o remarcar só no Instagram",
    arq: "app/publicar/post/actions.ts",
    de: "  `where id = $1 and account_id = $2 and kind = any($4::text[]) and status = 'pending'`;\n",
    para: "  `where id = $1 and account_id = $2 and kind = any($4::text[]) and kind = 'publicacao' and status = 'pending'`;\n",
    teste: T_TELAS,
    cai: "cancelar o agendado: a linha fica skipped com o motivo do dono, e a imagem sai do bucket",
  },
  {
    nome: "T-4: o status na conta só no Instagram",
    arq: "app/publicar/post/actions.ts",
    de: "    `select status, kind from queue where id = $1 and account_id = $2 and kind = any($3::text[])`,\n",
    para: "    `select status, kind from queue where id = $1 and account_id = $2 and kind = any($3::text[]) and kind = 'publicacao'`,\n",
    teste: T_TELAS,
    cai: "cancelar o que já está saindo: o aviso manda apagar pelo LinkedIn, e a linha não muda",
  },
  {
    nome: "T-5: o remarcar para agora drena a fila inteira",
    arq: "app/publicar/post/actions.ts",
    de: "        if (ehPostDoLinkedin(kind)) await drenarUmaPublicacaoDoLinkedin(id);\n        else await drainQueue();\n",
    para: "        await drainQueue();\n",
    teste: T_TELAS,
    cai: "remarcar para o minuto corrente publica só esta linha, e não drena o resto da fila",
  },
  {
    nome: "T-6: o Início não avisa do post do LinkedIn que falhou",
    arq: "app/page.tsx",
    de: "                    and kind = any($7::text[])\n",
    para: "                    and kind = any($7::text[]) and kind = 'publicacao'\n",
    teste: T_TELAS,
    cai: "o post do LinkedIn que falhou é aviso de publicação, e não de mensagem",
  },
  {
    nome: "T-7: o caminhosNaFila só no Instagram",
    arq: "lib/bonus/publicar-repositorio.ts",
    de: "      `select exists (select 1 from queue where kind = any($2::text[]) and payload->'caminhos' ? $1) as achou`,\n",
    para: "      `select exists (select 1 from queue where kind = any($2::text[]) and kind = 'publicacao' and payload->'caminhos' ? $1) as achou`,\n",
    teste: T_TELAS,
    cai: "o caminhosNaFila acha o arquivo que está numa linha do LinkedIn",
  },
  {
    nome: "T-8: a entrega do motor conta o post do LinkedIn",
    arq: "lib/envio-filters.ts",
    de: "  ...TIPOS_DE_PUBLICACAO,\n",
    para: '  "publicacao",\n',
    teste: T_POST_DA_FILA,
    cai: "o post do LinkedIn também fica de fora, como o do Instagram",
  },

  // ---- F4: o compor ----
  {
    nome: "P-1: a action sem a conferência da conexão",
    arq: ACAO,
    de: "  if (!disponivel.disponivel) {\n",
    para: "  if (false) {\n",
    teste: T_COMPOR,
    cai: "a conta sem LinkedIn conectado",
  },
  {
    nome: "P-2: a conta tirada do formulário",
    arq: ACAO,
    de: "  const inicioDaFuncaoMs = Date.now();\n  const conta = await getSelectedAccount();\n",
    para:
      "  const inicioDaFuncaoMs = Date.now();\n" +
      '  const conta = (await (await import("@/lib/db")).listAccounts()).find((a) => a.ig_user_id === String(formData.get("conta"))) ?? null;\n',
    teste: T_COMPOR,
    cai: "o login comum sem conta nenhuma não publica, nem com o cookie nem com um campo de uma conta com LinkedIn",
  },
  {
    nome: "P-3: os caminhos sem a pasta da conta",
    arq: ACAO,
    de:
      '  const forma = formaNoLinkedinDoCampo(formData.get("forma_linkedin"));\n' +
      '  const caminhos = caminhosDoCampo(formData.get("caminhos"), pastaDaConta(conta.ig_user_id));\n',
    para:
      '  const forma = formaNoLinkedinDoCampo(formData.get("forma_linkedin"));\n' +
      '  const caminhos = caminhosDoCampo(formData.get("caminhos"), String(formData.get("caminhos") ?? "").split("/")[0]);\n',
    teste: T_COMPOR,
    cai: "a imagem com o caminho de outra conta (descartado)",
  },
  {
    nome: "P-4: o texto longo pelo tamanho cru",
    arq: REGRAS,
    de: '  if (tamanhoDoTextoNoLinkedin(texto.trim()) > LIMITE_DO_TEXTO_DO_LINKEDIN) return "longo";\n',
    para: '  if (Array.from(texto.trim()).length > LIMITE_DO_TEXTO_DO_LINKEDIN) return "longo";\n',
    teste: T_COMPOR,
    cai: "o texto longo depois das hashtags",
  },
  {
    nome: "P-5: o agora com a hora de depois do enfileirar",
    arq: ACAO,
    de: "      desfecho = await drenarUmaPublicacaoDoLinkedin(r.id, inicioDaFuncaoMs);\n",
    para: "      desfecho = await drenarUmaPublicacaoDoLinkedin(r.id, Date.now());\n",
    teste: T_PRAZO,
    cai: "app/publicar/actions.ts",
  },
  {
    nome: "P-6: o agora que lança não arma o tique",
    arq: ACAO,
    de: "      await armarOTiqueDaLinha(r.id);\n",
    para: "",
    teste: T_TIQUE,
    cai: 'o "agora" da tela que lança antes de pegar a linha arma o tique dela, e o aviso diz que vai sair',
  },
  {
    nome: "P-7: a tela chama sempre a action do Instagram",
    arq: "app/publicar/enviador.tsx",
    de: "    const destino = noLinkedin ? (acaoDoLinkedin ?? acao) : acao;\n",
    para: "    const destino = acao;\n",
    teste: T_TELA_COMPOR,
    cai: "só texto: a action do LinkedIn recebe a forma, o texto, o envio e o quando, uma vez só",
  },
  {
    nome: "P-8: o contador pelo tamanho cru",
    arq: "app/publicar/enviador.tsx",
    de: "              {tamanhoDoTextoNoLinkedin(legenda.trim())}/{LIMITE_DO_TEXTO_DO_LINKEDIN}\n",
    para: "              {legenda.trim().length}/{LIMITE_DO_TEXTO_DO_LINKEDIN}\n",
    teste: T_TELA_COMPOR,
    cai: "o contador conta como o LinkedIn conta, e diz por quê",
  },
];

const semCor = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");
/** Os nomes dos casos que caíram: as linhas do `×`, sem o sinal e sem a duração do fim. */
const casosQueCairam = (saida) =>
  saida
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("×"))
    .map((l) => l.replace(/^×\s*/, "").replace(/\s+\d+(\.\d+)?\s*m?s$/, "").trim());

const conferir = process.argv[2] === "--conferir";
const filtro = conferir ? undefined : process.argv[2];
const inicio = Date.now();
let ruins = 0;
let rodadas = 0;
for (const m of MUTACOES) {
  if (filtro && !m.nome.startsWith(filtro)) continue;
  rodadas++;
  const original = readFileSync(m.arq, "utf8");
  // A PASTA PODE ESTAR EM CRLF (autocrlf=true; o blob é LF). O trecho segue o fim de linha do arquivo.
  const crlf = original.includes("\r\n");
  const ajusta = (s) => (crlf ? s.replace(/\r?\n/g, "\r\n") : s);
  const de = ajusta(m.de);
  const vezes = original.split(de).length - 1;
  if (vezes !== 1) {
    console.log(`RUIM  ${m.nome}: o trecho aparece ${vezes} vez(es) em ${m.arq}`);
    ruins++;
    continue;
  }
  if (conferir) {
    console.log(`ÚNICO ${m.nome}`);
    continue;
  }
  const t0 = Date.now();
  let r;
  try {
    writeFileSync(m.arq, original.replace(de, () => ajusta(m.para)));
    const args = ["--no-install", "vitest", "run", ...(m.teste.config ? ["--config", m.teste.config] : []), m.teste.arquivo];
    const env = { ...process.env };
    delete env.CLAUDECODE;
    delete env.AI_AGENT;
    if (m.teste.config === INTEG.config) env.DATABASE_URL_TESTES = TESTES_URL;
    r = spawnSync("npx", args, { encoding: "utf8", shell: true, env, timeout: 10 * 60 * 1000, maxBuffer: 64 * 1024 * 1024 });
  } finally {
    writeFileSync(m.arq, original);
  }
  const saida = semCor(`${r.stdout}\n${r.stderr}`);
  const alvoOk = m.teste.config !== INTEG.config || saida.includes("ALVO: banco de TESTE");
  const cairam = casosQueCairam(saida);
  // A MUTAÇÃO PEGA POR MENSAGEM (só a F2-15): todas as linhas pedidas têm de estar na saída. As outras, pelo caso.
  const caiu = m.caiPorMensagem ? m.caiPorMensagem.every((t) => saida.includes(t)) : cairam.includes(m.cai);
  const outros = cairam.filter((c) => c !== m.cai).length;
  const ok = alvoOk && r.status !== 0 && caiu;
  if (!ok) ruins++;
  const s = Math.round((Date.now() - t0) / 1000);
  console.log(
    `${ok ? "MORTA" : "RUIM "} ${m.nome}  (saída ${r.status}, alvo ok: ${alvoOk}, ${m.caiPorMensagem ? "caiu pela mensagem" : "caiu o caso"}: ${caiu}, outros que caíram: ${outros}, ${s}s)`
  );
  if (!ok) console.log(`      casos que caíram: ${cairam.length ? cairam.join(" | ") : "nenhum"}`);
}
const total = Math.round((Date.now() - inicio) / 1000);
console.log(
  `${rodadas} mutações, ${ruins} ruins; árvore no fim: ${status() === "" ? "limpa" : "SUJA"}${conferir ? " (só a conferência dos trechos)" : `; ${Math.floor(total / 60)} min ${total % 60} s`}`
);
```
