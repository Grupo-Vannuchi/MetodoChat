# Publicar no Instagram pelo painel — plano de implementação

> **Para trabalhadores agênticos:** SUB-SKILL OBRIGATÓRIA: use
> superpowers:subagent-driven-development para implementar tarefa a tarefa.

**Objetivo:** publicar imagem, reels, stories e carrossel no Instagram pelo
painel, na hora ou agendado.

**Arquitetura:** o arquivo vai do navegador direto ao bucket do Supabase (a
Vercel não aceita 300 MB de corpo). A publicação é item de fila, com o contêiner
da Meta nascendo só na hora de publicar (contêiner vence em 24h). Toda decisão
— validação de formato, parâmetros por forma, leitura de `status_code` — é
função pura com teste.

**Tecnologias:** Next.js 16 App Router, React 19, Vitest, Supabase Storage,
Instagram API com Login do Instagram (`graph.instagram.com`, v25.0).

## Restrições globais

- **A suíte não testa componente.** Toda decisão sai do JSX e vira função pura.
- **`lib/steps.ts` não tem NENHUM import.** Não tocar.
- **A `DATABASE_URL` e a `SUPABASE_SERVICE_ROLE_KEY` podem ser USADAS, nunca
  IMPRESSAS.** Não ler a `ADMIN_PASSWORD`, não forjar cookie.
- **Migração é imutável depois de aplicada.** Mudança é arquivo NOVO. A próxima
  é a `010`.
- **Nunca rodar `next build` nem `npm run dev`.**
- **Nenhuma publicação de teste vai ao perfil sem `trial_params`** (reels) ou
  sem ser apagada depois (imagem/story).
- **Em produção, não mexer em automação existente.**
- Comentários em português; commits em português SEM acentos, terminando com
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

## O que o levantamento achou, e que o plano tem de respeitar

1. **`enqueue` (lib/engine.ts:269) NÃO é exportada.** É interna; os
   `enqueueLote`/`enqueueManualReply` são os invólucros. Precisa de um novo.
2. **`HOURLY_CAP = 190` e `GAP_MS = 600`** (lib/queue-drain.ts:34-36) são freios
   de MENSAGEM, por conta. Um post não é mensagem: ele não pode gastar essa cota
   nem esperar `GAP_MS`. O limite da Meta para publicação é outro (400
   contêineres e 50–100 publicações por 24h) e mora em outro lugar.
3. **`queue.status`** hoje aceita `pending, sending, sent, failed, skipped`
   (000) mais `guardado` (009). Publicação precisa de um estado de espera de
   processamento — decidir na Tarefa 2 se reusa `sending` ou pede um novo.
4. **`finish(id, {status, sent_at, retryInSeconds, error, message_id})`** é como
   o dreno encerra um item.
5. **`scheduleTick(appUrl, delaySeconds)`** (lib/qstash.ts:13) publica um tique
   com atraso em segundos. **O horizonte máximo do QStash não foi verificado** —
   e o plano NÃO deve depender dele: ver Tarefa 4, passo 5.

---

### Tarefa 1: O PORTÃO — a prova de que a Meta publica

**Nada mais se constrói antes desta tarefa passar.** Ela responde duas coisas
que não se resolvem lendo: PPA e o limite real.

**Arquivos:** apenas `lib/ig.ts` (o escopo) e um script descartável no
scratchpad. **Nenhuma tela, nenhuma migração, nenhuma fila.**

**Antes de começar, o dono já fez** (03/09): bucket `midia-publicacao` público
no Supabase com teto de 300 MB, as quatro contas como papel no aplicativo da
Meta, e `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` no `.env.local` e na
Vercel. **Confira que as duas variáveis existem antes de qualquer coisa** — se
faltarem, PARE e diga.

- [ ] **Passo 1: acrescentar o escopo**

Em `lib/ig.ts`, na função `authorizeUrl` (linha ~95), acrescentar
`"instagram_business_content_publish"` ao array `scope`. É a única mudança de
código desta tarefa.

- [ ] **Passo 2: conferir que compila**

`npm run lint && npm run typecheck && npx vitest run` — os três limpos, e a
contagem de testes igual à de antes (1025).

- [ ] **Passo 3: PARAR e pedir a reconexão**

Reconectar a conta é ação do dono, no `/setup`. **Escreva no relatório que a
tarefa está bloqueada nisto** e devolva o controle. Não tente forjar token, não
tente reconectar por script.

- [ ] **Passo 4: perguntar o limite real à Meta**

Depois da reconexão, com um script no scratchpad:

```js
// GET /{ig-user-id}/content_publishing_limit?fields=config,quota_usage
// Devolve a cota REAL e o uso. Resolve a contradicao 50-vs-100 da documentacao.
```

Registre o número que voltou. Ele vira constante nomeada na Tarefa 2.

- [ ] **Passo 5: publicar uma imagem de teste, e apagá-la**

Suba um JPEG pequeno ao bucket (pelo painel do Supabase, à mão, ou por script
com a service key). Depois:

1. `POST /{ig-user-id}/media` com `image_url` e `caption` de teste
2. `GET /{container-id}?fields=status_code` até `FINISHED`
3. `POST /{ig-user-id}/media_publish` com `creation_id`
4. **Apague o post** com `DELETE /{media-id}` ou pelo aplicativo

Se a Meta recusar, **registre código e subcódigo** — não tente contornar.
Subcódigo de PPA significa que o projeto precisa de decisão do dono antes de
seguir.

- [ ] **Passo 6: publicar um reels de TESTE, que ninguém vê**

Mesmo caminho, com `media_type=REELS`, `video_url` e
`trial_params={"graduation_strategy":"MANUAL"}`. Reels de teste **não vai para
os seguidores** até ser promovido à mão — é o que permite provar numa conta com
2.933 posts sem ninguém ver.

Confirme no aplicativo que ele aparece como teste, e não no perfil.

- [ ] **Passo 7: commitar o escopo e escrever o achado**

Commite só a linha do escopo. No relatório, responda por extenso: PPA apareceu?
Qual o limite real? O reels de teste funcionou? Quanto tempo o `status_code`
levou para virar `FINISHED`?

---

### Tarefa 2: as decisões puras e a migração

**Consome:** os números que a Tarefa 1 mediu.

**Arquivos:** Criar `lib/publicacao.ts`, `tests/publicacao.test.ts`,
`migrations/010-fila-publicacao.sql`.

**Produz** (as tarefas seguintes dependem destes nomes exatos):

```ts
export type FormaDePublicacao = "imagem" | "reels" | "story" | "carrossel";

export type ProblemaDoArquivo =
  | "tipo_nao_suportado" | "grande_demais" | "curto_demais" | "longo_demais"
  | "proporcao_fora" | "estreito_demais";

/** `null` quando o arquivo serve. */
export function problemaDoArquivo(
  forma: FormaDePublicacao,
  arq: { mime: string; bytes: number; segundos?: number; largura?: number; altura?: number }
): ProblemaDoArquivo | null;

export function textoDoProblema(p: ProblemaDoArquivo): string;

/** Os parametros do POST /media para esta forma. */
export function parametrosDoContainer(pedido: {
  forma: FormaDePublicacao;
  url: string;
  legenda?: string;
  compartilharNoFeed?: boolean;
  nomeDoAudio?: string;
  filho?: boolean;
}): Record<string, string>;

export type EstadoDoContainer = "esperando" | "pronto" | "erro" | "vencido" | "publicado";
export function estadoDoContainer(bruto: unknown): EstadoDoContainer;

export function problemaDaLegenda(
  texto: string
): "longa" | "hashtags_demais" | "mencoes_demais" | null;
```

- [ ] **Passo 1: escrever os testes primeiro**

Em `tests/publicacao.test.ts`. Os casos que TÊM de existir, com os números da
especificação (que foram lidos na referência da Meta, não estimados):

```ts
import { describe, it, expect } from "vitest";
import {
  problemaDoArquivo, textoDoProblema, parametrosDoContainer,
  estadoDoContainer, problemaDaLegenda,
} from "../lib/publicacao";

const MB = 1024 * 1024;

describe("problemaDoArquivo — imagem", () => {
  it("JPEG dentro das regras serve", () => {
    expect(problemaDoArquivo("imagem", { mime: "image/jpeg", bytes: 2 * MB, largura: 1080, altura: 1080 })).toBeNull();
  });
  // A META SO ACEITA JPEG, e PNG e o formato mais comum de quem monta arte.
  // Recusar aqui, ANTES do upload, e a diferenca entre um aviso na hora e 8 MB
  // enviados para a Meta recusar depois.
  it("PNG nao serve", () => {
    expect(problemaDoArquivo("imagem", { mime: "image/png", bytes: 1 * MB, largura: 1080, altura: 1080 }))
      .toBe("tipo_nao_suportado");
  });
  it("acima de 8 MB nao serve", () => {
    expect(problemaDoArquivo("imagem", { mime: "image/jpeg", bytes: 9 * MB, largura: 1080, altura: 1080 }))
      .toBe("grande_demais");
  });
  // Faixa 4:5 (0,8) a 1.91:1. As duas BORDAS entram, e o teste as prende: um
  // `<` no lugar de `<=` recusaria arte quadrada-vertical legitima.
  it("as bordas da proporcao entram", () => {
    expect(problemaDoArquivo("imagem", { mime: "image/jpeg", bytes: MB, largura: 800, altura: 1000 })).toBeNull();
    expect(problemaDoArquivo("imagem", { mime: "image/jpeg", bytes: MB, largura: 1910, altura: 1000 })).toBeNull();
  });
  it("mais vertical que 4:5 nao serve", () => {
    expect(problemaDoArquivo("imagem", { mime: "image/jpeg", bytes: MB, largura: 700, altura: 1000 }))
      .toBe("proporcao_fora");
  });
  it("abaixo de 320px de largura nao serve", () => {
    expect(problemaDoArquivo("imagem", { mime: "image/jpeg", bytes: MB, largura: 300, altura: 300 }))
      .toBe("estreito_demais");
  });
});

describe("problemaDoArquivo — reels e story", () => {
  it("reels de 10 minutos e 200 MB serve", () => {
    expect(problemaDoArquivo("reels", { mime: "video/mp4", bytes: 200 * MB, segundos: 600 })).toBeNull();
  });
  it("reels acima de 15 minutos nao serve", () => {
    expect(problemaDoArquivo("reels", { mime: "video/mp4", bytes: 10 * MB, segundos: 16 * 60 }))
      .toBe("longo_demais");
  });
  it("menos de 3 segundos nao serve, nas duas formas", () => {
    expect(problemaDoArquivo("reels", { mime: "video/mp4", bytes: MB, segundos: 2 })).toBe("curto_demais");
    expect(problemaDoArquivo("story", { mime: "video/mp4", bytes: MB, segundos: 2 })).toBe("curto_demais");
  });
  // OS LIMITES DE STORY SAO OUTROS, e este par e o que impede alguem de
  // reaproveitar a regra do reels: 60s contra 15min, 100 MB contra 300 MB.
  it("story de 90 segundos nao serve, mas reels serve", () => {
    expect(problemaDoArquivo("story", { mime: "video/mp4", bytes: MB, segundos: 90 })).toBe("longo_demais");
    expect(problemaDoArquivo("reels", { mime: "video/mp4", bytes: MB, segundos: 90 })).toBeNull();
  });
  it("story de video acima de 100 MB nao serve, mas reels serve", () => {
    expect(problemaDoArquivo("story", { mime: "video/mp4", bytes: 150 * MB, segundos: 30 })).toBe("grande_demais");
    expect(problemaDoArquivo("reels", { mime: "video/mp4", bytes: 150 * MB, segundos: 30 })).toBeNull();
  });
  it("MOV serve, AVI nao", () => {
    expect(problemaDoArquivo("reels", { mime: "video/quicktime", bytes: MB, segundos: 10 })).toBeNull();
    expect(problemaDoArquivo("reels", { mime: "video/x-msvideo", bytes: MB, segundos: 10 }))
      .toBe("tipo_nao_suportado");
  });
});

describe("parametrosDoContainer", () => {
  it("imagem manda image_url e NAO manda media_type", () => {
    const p = parametrosDoContainer({ forma: "imagem", url: "https://x/a.jpg", legenda: "oi" });
    expect(p.image_url).toBe("https://x/a.jpg");
    expect(p.caption).toBe("oi");
    expect(p.media_type).toBeUndefined();
  });
  it("reels manda media_type REELS e video_url", () => {
    const p = parametrosDoContainer({ forma: "reels", url: "https://x/a.mp4", compartilharNoFeed: true });
    expect(p.media_type).toBe("REELS");
    expect(p.video_url).toBe("https://x/a.mp4");
    expect(p.share_to_feed).toBe("true");
  });
  it("story manda media_type STORIES", () => {
    expect(parametrosDoContainer({ forma: "story", url: "https://x/a.mp4" }).media_type).toBe("STORIES");
  });
  // FILHO DE CARROSSEL NAO LEVA LEGENDA NEM media_type, e leva
  // is_carousel_item. A legenda mora no PAI — repeti-la no filho e o erro
  // natural de quem reaproveita a funcao.
  it("filho de carrossel leva is_carousel_item e nao leva legenda", () => {
    const p = parametrosDoContainer({ forma: "imagem", url: "https://x/a.jpg", legenda: "oi", filho: true });
    expect(p.is_carousel_item).toBe("true");
    expect(p.caption).toBeUndefined();
  });
  // REELS NAO ENTRA EM CARROSSEL — regra da Meta, e a funcao tem de recusar em
  // vez de montar um pedido que a Meta rejeita depois de dois uploads.
  it("reels como filho de carrossel e recusado", () => {
    expect(() => parametrosDoContainer({ forma: "reels", url: "https://x/a.mp4", filho: true })).toThrow();
  });
  // share_to_feed E audio_name SO valem em reels. Mandados em imagem, a Meta
  // ignora calada — e calado e o que esta base nao aceita.
  it("compartilharNoFeed em imagem nao vira parametro", () => {
    const p = parametrosDoContainer({ forma: "imagem", url: "https://x/a.jpg", compartilharNoFeed: true });
    expect(p.share_to_feed).toBeUndefined();
  });
});

describe("estadoDoContainer", () => {
  it("os cinco estados da Meta viram os nossos", () => {
    expect(estadoDoContainer("FINISHED")).toBe("pronto");
    expect(estadoDoContainer("IN_PROGRESS")).toBe("esperando");
    expect(estadoDoContainer("ERROR")).toBe("erro");
    expect(estadoDoContainer("EXPIRED")).toBe("vencido");
    expect(estadoDoContainer("PUBLISHED")).toBe("publicado");
  });
  // ESTADO DESCONHECIDO E "erro", E NAO "esperando". Tratar o que nao se
  // conhece como "ainda processando" faria o item girar na fila para sempre,
  // gastando tentativa e nunca terminando — a fome de fila que o lote de 01/09
  // fechou, por outra porta.
  it("estado desconhecido e erro, nunca espera", () => {
    expect(estadoDoContainer("VAI_SABER")).toBe("erro");
    expect(estadoDoContainer(null)).toBe("erro");
    expect(estadoDoContainer(undefined)).toBe("erro");
  });
});

describe("problemaDaLegenda", () => {
  it("legenda comum passa", () => {
    expect(problemaDaLegenda("Lancamento hoje #promo @vannuchi.eng")).toBeNull();
  });
  it("acima de 2200 caracteres nao passa", () => {
    expect(problemaDaLegenda("a".repeat(2201))).toBe("longa");
  });
  it("31 hashtags nao passa, 30 passa", () => {
    expect(problemaDaLegenda(Array.from({ length: 30 }, (_, i) => `#t${i}`).join(" "))).toBeNull();
    expect(problemaDaLegenda(Array.from({ length: 31 }, (_, i) => `#t${i}`).join(" "))).toBe("hashtags_demais");
  });
  it("21 mencoes nao passa", () => {
    expect(problemaDaLegenda(Array.from({ length: 21 }, (_, i) => `@u${i}`).join(" "))).toBe("mencoes_demais");
  });
});
```

- [ ] **Passo 2: rodar e ver vermelho**

`npx vitest run tests/publicacao.test.ts` — FALHA, módulo não existe.

- [ ] **Passo 3: escrever `lib/publicacao.ts`**

Sem import de nada que puxe `server-only`. Os limites da META viram constantes
nomeadas, uma por forma, com o número da referência no comentário.

**MAS O TETO DO BUCKET NÃO É CONSTANTE, e isto é decisão medida em 03/09.**

O projeto do Supabase está hoje em 50 MB — não por escolha, mas porque o
pagamento do plano atrasou. Medido por busca binária contra a API: 50 MB passa,
51 é recusado. O plano pago vai a 500 GB, e o teto vai subir sozinho quando o
pagamento entrar.

Cravar 50 MB aqui criaria uma dívida que ninguém lembra de pagar: no dia em que
o plano voltasse, vídeo continuaria recusado por uma constante esquecida, e o
sintoma seria "não sei por que não sobe".

Então `problemaDoArquivo` recebe o teto **como parâmetro**:

```ts
export function problemaDoArquivo(
  forma: FormaDePublicacao,
  arq: { mime: string; bytes: number; segundos?: number; largura?: number; altura?: number },
  tetoDoBucketEmBytes: number
): ProblemaDoArquivo | null;
```

O menor entre o teto da Meta e o do bucket é que vale, e o problema devolvido
distingue os dois: `grande_demais` quando a Meta recusaria de qualquer jeito, e
`grande_para_o_bucket` quando **nós** é que somos o gargalo — porque a frase que
ajuda é diferente ("exporte menor" contra "a Meta aceitaria, nosso plano não").

Acrescente `"grande_para_o_bucket"` a `ProblemaDoArquivo` e um caso para cada
lado: um vídeo de 80 MB é `grande_para_o_bucket` com teto de 50 MB, e o MESMO
vídeo passa com teto de 500 GB. É esse par que prende a distinção.

Quem lê o teto de verdade é a Tarefa 3, contra o bucket, e ele chega à tela.

- [ ] **Passo 4: escrever `migrations/010-fila-publicacao.sql`**

Reescreve `queue_kind_check` acrescentando o `kind` da publicação — no molde de
`008-fila-tipo-lote.sql`, que é o precedente. **Leia a 008 antes.**

**A DECISÃO QUE ESTA TAREFA TEM DE TOMAR COM NÚMERO, não com gosto:** a mídia
precisa de tabela própria, ou o `payload` da fila basta? O envio em lote
respondeu "nenhuma tabela nova" e estava certo. Aqui há ciclo de vida de
arquivo: o objeto existe no bucket antes do post e sobrevive ao agendamento.

Responda olhando o que as consultas precisam saber:
- para publicar, basta a URL — cabe no `payload`;
- para **limpar o bucket** depois, é preciso listar objetos órfãos, e isso é uma
  consulta por conta e por data que o `payload` da fila não serve bem.

Se decidir por tabela, ela entra na mesma migração. **Escreva o porquê no
arquivo `.sql`**, com a consulta que a justifica.

- [ ] **Passo 5: acrescentar a conferência simétrica em `scripts/migrar.mjs`**

O `REMOVIDAS_ESPERADAS`/conferência do arquivo confere no banco o que cada
migração promete. Acrescente a da 010, no molde das outras dez.

- [ ] **Passo 6: rodar o ensaio a seco da migração**

`node scripts/migrar.mjs` — sem `--aplicar`. Esperado: a 010 aparece como
pendente e a conferência acusa a divergência esperada. **NÃO aplicar.**

- [ ] **Passo 7: plantar e medir**

Plantio A: em `problemaDoArquivo`, usar o limite de reels para story.
Esperado: VERMELHO nos dois casos de story.
Plantio B: em `estadoDoContainer`, fazer desconhecido virar `"esperando"`.
Esperado: VERMELHO no caso do estado desconhecido.
Plantio C: em `parametrosDoContainer`, deixar o filho de carrossel levar legenda.
Esperado: VERMELHO no caso do filho.

Reverter cada um com `git checkout --` e conferir `git status --porcelain`
vazio depois de cada um.

- [ ] **Passo 8: commitar**

---

### Tarefa 3: o upload direto para o bucket

**Consome:** `problemaDoArquivo` e `textoDoProblema` da Tarefa 2.

**Arquivos:** Criar `lib/bucket.ts` e `app/api/midia/assinar/route.ts`.
Modificar: nada.

**Produz:**

```ts
// lib/bucket.ts — server-only
export async function urlAssinadaDeUpload(caminho: string): Promise<{ url: string; token: string }>;
export function urlPublicaDoObjeto(caminho: string): string;
export function caminhoDoObjeto(contaIgId: string, nomeOriginal: string): string;
export async function apagarObjeto(caminho: string): Promise<void>;
/** O teto REAL do bucket, perguntado ao Supabase — nunca cravado. Ver Tarefa 2. */
export async function tetoDoBucket(): Promise<number>;
```

`tetoDoBucket` lê `GET /storage/v1/bucket/{nome}` e devolve `file_size_limit`.
Quando ele vier `null`, o bucket não tem teto próprio e vale o global do
projeto — nesse caso devolva um número conservador e **diga no comentário** que
ele é o piso de segurança, não uma medição. Hoje o bucket TEM teto próprio
(50 MB, ajustado em 03/09), então esse ramo não deve ser exercitado em produção.

O bucket se chama **`MetodoChat`** — com maiúsculas, escolha do dono, e o nome
não pode ser alterado depois de criado. Ele vem de `SUPABASE_BUCKET` no
ambiente, nunca escrito no código.

- [ ] **Passo 1: escrever o teste do que é puro**

`caminhoDoObjeto` e `urlPublicaDoObjeto` são puras e têm teste em
`tests/bucket.test.ts`. Os casos: o caminho leva a conta (dois donos não colidem),
não leva o nome cru do arquivo (nome de arquivo é texto de gente — acento,
espaço, barra), e a URL pública é montada uma vez só.

**`urlAssinadaDeUpload` NÃO tem teste puro** — ela fala com o Supabase. Diga
isso no relatório em vez de fingir cobertura.

- [ ] **Passo 2: `lib/bucket.ts`**

`server-only` no topo, como `lib/db.ts`. Lê `SUPABASE_URL` e
`SUPABASE_SERVICE_ROLE_KEY` do ambiente. **Nunca imprime a chave** — nem em
erro. Se faltar variável, lança com mensagem que nomeia qual falta e NÃO mostra
valor nenhum.

Sem SDK novo: a API de Storage do Supabase é REST, e `fetch` basta. Instalar
`@supabase/supabase-js` só para isso puxaria dependência grande para duas
chamadas.

- [ ] **Passo 3: a rota que assina**

`app/api/midia/assinar/route.ts`, `POST`. Confere sessão (molde de
`app/api/media/route.ts`), confere a conta selecionada, valida o arquivo
declarado com `problemaDoArquivo` **antes** de assinar, e devolve a URL
assinada mais o caminho.

**A validação aqui é a segunda barreira, não a primeira.** O navegador valida
para dar mensagem boa; o servidor valida porque o navegador é do usuário.

- [ ] **Passo 4: conferir**

`npm run lint && npm run typecheck && npx vitest run`

- [ ] **Passo 5: plantar e medir**

Plantio: apagar a chamada a `problemaDoArquivo` da rota.
Esperado: nada vermelho (a rota não tem teste que a alcance) — **diga isso**, e
diga que a barreira que resta é a do navegador, que é do usuário. Se o relatório
disser que está protegido, está errado.

- [ ] **Passo 6: commitar**

---

### Tarefa 4: o motor publica

**Consome:** Tarefas 2 e 3.

**Arquivos:** `lib/ig.ts`, `lib/engine.ts`, `lib/queue-drain.ts`,
`lib/dedupe.ts`, `app/api/cron/daily/route.ts`.

**Produz:**

```ts
// lib/ig.ts
export async function criarContainer(igUserId: string, token: string, params: Record<string, string>): Promise<string>;
export async function estadoDoContainerNaMeta(containerId: string, token: string): Promise<unknown>;
export async function publicarContainer(igUserId: string, token: string, containerId: string): Promise<Json>;
export async function limiteDePublicacao(igUserId: string, token: string): Promise<Json>;

// lib/engine.ts
export async function enqueuePublicacao(
  accountId: string,
  pedido: { forma: FormaDePublicacao; caminhos: string[]; legenda?: string; compartilharNoFeed?: boolean; nomeDoAudio?: string },
  quando: Date | null
): Promise<boolean>;
```

- [ ] **Passo 1: as quatro chamadas em `lib/ig.ts`**

No molde de `sendMessage`/`replyToComment`, com `graphFetch`. Erro da Meta passa
por `resumoDoErroDaMeta` (`lib/steps.ts`), que já existe desde 28/08 — **não
escreva tradução de erro nova.**

- [ ] **Passo 2: `enqueuePublicacao`**

Invólucro sobre a `enqueue` interna. `contact_ig_id` fica **nulo** — publicação
não tem contato, e a coluna já é opcional. A chave de dedupe vai em
`lib/dedupe.ts`, no molde de `loteKey`, **com a conta dentro** pelo mesmo motivo
que ela está lá: `dedupe_key` é `unique` na tabela inteira.

`quando: null` significa agora; `Date` no futuro vira `delaySeconds`.

- [ ] **Passo 3: o ramo do dreno**

Em `processItem` (`lib/queue-drain.ts:139`), o `kind` novo:

1. cria o contêiner (ou os filhos e o pai, para carrossel)
2. consulta `status_code` **uma vez**
3. `pronto` → publica, `finish` com `sent`
4. `esperando` → `finish` com `retryInSeconds: 60` e o contêiner guardado no
   `payload`, para a próxima passada não recriá-lo
5. `erro`/`vencido` → `finish` com `failed` e o motivo escrito

**O TETO DE CINCO PASSADAS é obrigatório** — recomendação da Meta é uma consulta
por minuto por no máximo cinco. Passado isso, `failed` com motivo. Sem teto, o
item gira para sempre.

**E O POST NÃO GASTA A COTA DE MENSAGEM.** `HOURLY_CAP = 190` e `GAP_MS = 600`
(linhas 34-36) são freios de DM, por conta. Publicação tem limite próprio na
Meta (400 contêineres, 50–100 publicações por 24h). Deixe explícito no código
que este ramo não consome aquele orçamento, e escreva por quê.

- [ ] **Passo 4: conferir contra a Meta antes de publicar**

Antes do `media_publish`, consultar `limiteDePublicacao`. Se a cota estourou,
`finish` com `pending` e `retryInSeconds` para depois da virada — **não**
`failed`: a publicação não deu errado, ela ainda não pode acontecer.

Use o número que a Tarefa 1 mediu como referência, mas **a decisão vem da
resposta da Meta**, não da constante.

- [ ] **Passo 5: o cron diário arma os tiques do dia**

`app/api/cron/daily/route.ts`. Um post agendado para o mês que vem não pode
depender de o QStash aceitar 30 dias de atraso — horizonte que **não foi
verificado**, e o plano não depende dele.

O cron varre os posts com `not_before` nas próximas 24h e chama `scheduleTick`
para cada. Horizonte infinito, e o QStash só recebe atrasos de até um dia.

Isso é a mesma forma da varredura de lotes vencidos que a 009 acrescentou —
**leia-a antes**, e não toque em `pending` de mensagem.

- [ ] **Passo 6: limpar o bucket depois de publicar**

**Achado na auto-revisão deste plano:** `apagarObjeto` (Tarefa 3) não era usada
por tarefa nenhuma, e sem isso todo arquivo publicado ficaria no bucket para
sempre. Um reels de 200 MB por post, e ninguém percebe até a conta do Supabase.

O arquivo **só pode sair depois de a Meta ter publicado** — ela baixa a mídia
no momento do `media_publish`, e apagar antes quebraria a publicação. Então a
limpeza acontece no ramo de sucesso, DEPOIS do `finish` com `sent`.

E ela **não pode derrubar o item**: se o Supabase recusar o apagamento, o post
já saiu e está certo. Envolva em `try/catch` que registra e segue — o mesmo
molde do `catch` do `drainQueue` em `enviarLote`, que tem o porquê escrito.

Item `failed` **mantém** o arquivo: quem vai tentar de novo precisa dele.
Órfão de item falhado é o caso que justifica a decisão de tabela do Passo 4 da
Tarefa 2 — se houver tabela, a varredura de órfãos entra no cron diário; se não
houver, escreva no relatório que órfão de falha fica e por que isso é aceitável.

- [ ] **Passo 7: o caminho de integração**

`testes-integracao/publicacao.integracao.ts`, no molde do sexto caminho
(`acoes-que-falam.integracao.ts`, sobre `comoNumaRequisicao`) e do
`lote.integracao.ts`. Contra a Meta falsa, conferir:

- os dois `POST` na ordem certa, e que `media_publish` só acontece depois de
  `FINISHED`
- `IN_PROGRESS` devolve o item à fila **sem** recriar o contêiner
- o teto de cinco passadas termina em `failed`
- estado desconhecido termina em `failed`, e não em espera
- o post da conta A não sai pela conta B

- [ ] **Passo 8: plantar e medir**

- criar o contêiner no `enqueuePublicacao` em vez de no dreno (o `EXPIRED`
  calado) — **este é o mais importante do projeto**
- publicar sem esperar `FINISHED`
- tirar o teto de cinco passadas
- deixar o post gastar `HOURLY_CAP`
- apagar o objeto do bucket ANTES do `media_publish`

Cada um: VERMELHO esperado na integração. O que ficar verde, **diga**.

- [ ] **Passo 9: commitar**

---

### Tarefa 5: a tela de compor, e o modal de progresso

**Consome:** Tarefas 2, 3 e 4.

**Arquivos:** Criar `app/publicar/page.tsx` (servidor),
`app/publicar/actions.ts`, `app/publicar/enviador.tsx` (cliente),
`app/publicar/progresso.tsx` (cliente). Modificar `app/app-shell.tsx`.

- [ ] **Passo 1: a ação de servidor**

`app/publicar/actions.ts`, no molde de `app/contatos/actions.ts` **depois do
conserto de 02/09**: nenhuma saída muda, `redirect` com aviso, e o aviso vem de
função pura. **Leia aquele arquivo antes** — ele tem cinco comentários que
explicam armadilhas que valem aqui igual.

- [ ] **Passo 2: a tela**

`app/publicar/page.tsx`, componente de **servidor**. Mostra as formas, o campo
de legenda com contagem, a escolha entre "agora" e data/hora, e a faixa de
aviso. Nenhuma decisão no JSX: `problemaDaLegenda` e `textoDoProblema` decidem.

Para carrossel, a tela diz **antes** de escolher arquivos que todos serão
cortados pela proporção do primeiro, e que reels não entra.

- [ ] **Passo 3: o enviador**

`app/publicar/enviador.tsx`, `"use client"` — **a exceção declarada na
especificação §3.** Escolhe arquivo, mede duração e dimensões, valida com
`problemaDoArquivo`, converte imagem para JPEG por `canvas` (redimensionando
para 320–1440px), pede a URL assinada e envia por `XMLHttpRequest` para ter
`upload.onprogress`.

**`fetch` não dá progresso de upload** — é `XMLHttpRequest` ou nada.

- [ ] **Passo 4: o modal de progresso**

`app/publicar/progresso.tsx`, no `app-shell` para sobreviver à navegação. Canto
inferior, no molde do Drive. **A frase de cada estado vem de função pura da
Tarefa 2**, não de string no componente.

- [ ] **Passo 5: conferir**

Os quatro portões. E confirme com `git diff` que **nenhum `"use client"` novo
entrou fora de `app/publicar/`**.

- [ ] **Passo 6: plantar e medir**

Plantio: fazer o `canvas` gravar PNG em vez de JPEG.
Esperado: nada vermelho — a suíte não testa componente. **Diga isso**, e diga
que a rede que resta é a validação do servidor da Tarefa 3, que recusaria o
arquivo. Isso é rede de verdade; escreva por quê.

- [ ] **Passo 7: commitar**

---

### Tarefa 6: carrossel

**Consome:** todas as anteriores.

**Arquivos:** `lib/publicacao.ts`, `lib/queue-drain.ts`, `app/publicar/*`.

- [ ] **Passo 1: o teste do pai**

Em `tests/publicacao.test.ts`: o contêiner pai leva `media_type=CAROUSEL`, a
lista `children` com até 10, e a legenda — e **os filhos não levam legenda**.
Onze itens é recusado. Reels entre os filhos é recusado (o caso já existe da
Tarefa 2; confirme que continua verde).

- [ ] **Passo 2: o ramo do dreno para carrossel**

N filhos, depois o pai. **Se um filho falhar, o pai não nasce** — e os filhos
que já nasceram vencem sozinhos em 24h, o que é aceitável e vai escrito.

- [ ] **Passo 3: a tela**

Vários arquivos, cada um com seu progresso, e a ordem editável — porque a
proporção do primeiro decide o corte de todos.

- [ ] **Passo 4: integração**

Carrossel de 3 itens: três filhos, um pai, um `media_publish`. E o caso do
filho que falha: nenhum `media_publish` acontece.

- [ ] **Passo 5: conferir, plantar, commitar**

Plantio: publicar o pai mesmo com um filho falhado.
Esperado: VERMELHO na integração.
