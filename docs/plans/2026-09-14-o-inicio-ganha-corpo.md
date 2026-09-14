# O Início ganha corpo — plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: use
> `superpowers:subagent-driven-development` (recomendado) ou
> `superpowers:executing-plans`, tarefa a tarefa. Os passos usam caixa (`- [ ]`).

**Objetivo:** o Início passa a contar três formas de "precisa de mim" em vez de
duas — a nova é **comentário chegando em post sem automação**, que hoje são 331
de 332 comentários por semana e nenhuma tela do produto conta.

**Arquitetura:** a decisão continua fora do JSX (`lib/precisa-de-voce.ts` ganha
um quarto fato de entrada); as frases novas nascem puras em `lib/pulso.ts`; a
página ganha três consultas e um layout de duas colunas abaixo da lista.

**Pilha:** Next.js 16 (App Router, Server Components), React 19, Tailwind v4,
postgres.js, Vitest.

**Spec:** `docs/specs/2026-09-14-o-inicio-ganha-corpo.md`

## Restrições globais

- **A chamada à Meta (`resolvePosts`) nunca fica no caminho crítico.** A linha da
  oportunidade tem de renderizar inteira sem o nome do post. Ver o "Desvio
  declarado" abaixo.
- **Cada bloco falha sozinho e some.** Uma consulta que estoura não pode derrubar
  a tela — o padrão é `urlPublicaSeDerParaMontar` (`lib/bucket.ts`).
- **"Hoje" é o dia em `America/Sao_Paulo`**, nunca em UTC. O servidor roda em UTC.
- Toda consulta leva **`account_id`** no `where`.
- O corte das oportunidades: no máximo **3**, e só posts com **5 ou mais**
  comentários nos últimos **7 dias**.
- `lib/precisa-de-voce.ts` e `lib/pulso.ts` são **puros** — nenhum import de
  servidor, nada que toque banco.
- Comentário em português explicando **por quê**, no tom do arquivo vizinho.
- Antes de cada commit: `npx tsc --noEmit` e `npx vitest run`.

## Desvio declarado em relação à spec (e a spec já foi corrigida)

A primeira versão da spec **recusava** nomear o post, alegando que exigiria
chamar a API do Instagram no render. Ao abrir o repositório para escrever este
plano, achei `lib/media-lookup.ts`: `resolvePosts` já faz isso, já roda em
`/eventos`, tem teto (40 recentes + 8 avulsos) e degrada sozinho com `try/catch`
interno. A recusa estava errada no motivo, e a spec foi reescrita.

**O que fica:** a chamada entra, e a linha renderiza inteira sem ela.

Um segundo desvio, este por medição: a spec §4 diz que "Adiante" lista até três
publicações agendadas. **A fila não tem nenhum item pendente**, de nenhum tipo —
então a Tarefa 5 entrega só o convite, e a lista fica como dívida declarada.
Escrevê-la agora seria escrever código que nunca renderizou uma linha.

---

## Estrutura de arquivos

| arquivo | responsabilidade |
|---|---|
| `lib/precisa-de-voce.ts` (modificar) | a oportunidade entra na lista e na ordem |
| `lib/pulso.ts` (criar) | as frases do pulso, do adiante e das 24h |
| `app/page.tsx` (modificar) | as consultas e o layout novo |
| `app/automacoes/nova/page.tsx` (modificar) | lê `?post=` e passa ao formulário |
| `app/automacoes/nova/form-nova.tsx` (modificar) | campo escondido `post` |
| `app/automacoes/actions.ts` (modificar) | grava `media_id` na automação nova |
| `tests/precisa-de-voce.test.ts` (modificar) | casos da oportunidade |
| `tests/pulso.test.ts` (criar) | casos das frases |
| `testes-integracao/inicio-oportunidades.integracao.ts` (criar) | as consultas |

---

## Tarefa 1: a oportunidade entra na decisão

**Arquivos:**
- Modificar: `lib/precisa-de-voce.ts`
- Testar: `tests/precisa-de-voce.test.ts`

**Interfaces:**
- Consome: `Urgencia`, `ItemDoInicio`, `FatosDoInicio` (já no arquivo);
  `fmtRelative` de `./format`
- Produz:
  - `type Oportunidade = { mediaId: string; comentarios: number; ultimo: Date | string | null; nome?: string | null }`
  - `MAX_OPORTUNIDADES = 3`, `MIN_COMENTARIOS_DA_OPORTUNIDADE = 5`
  - `FatosDoInicio` ganha `oportunidades: Oportunidade[]`
  - `recorteDasOportunidades(lista: Oportunidade[]): Oportunidade[]`

- [ ] **Passo 1: escrever os testes que falham**

Acrescente no fim de `tests/precisa-de-voce.test.ts`:

```ts
describe("recorteDasOportunidades", () => {
  const post = (mediaId: string, comentarios: number): Oportunidade => ({
    mediaId,
    comentarios,
    ultimo: new Date("2026-09-14T12:00:00Z"),
  });

  it("corta quem tem menos de 5 comentários", () => {
    // O PISO E O TETO SÃO CORTES DIFERENTES, e este caso prova só o piso:
    // quatro posts, todos abaixo do teto de 3? Não — são 4, então o teto
    // também morderia. Por isso aqui só DOIS passam do piso, e o resultado
    // sendo 2 (e não 3) mostra que quem decidiu foi o piso.
    expect(recorteDasOportunidades([post("a", 9), post("b", 4), post("c", 5)]).map((o) => o.mediaId))
      .toEqual(["a", "c"]);
  });

  it("corta em 3, e mantém os MAIORES", () => {
    // Cinco posts, todos acima do piso: agora quem decide é o teto. E a ordem
    // importa — cortar sem ordenar deixaria de fora justamente o post com mais
    // gente esperando.
    const r = recorteDasOportunidades([
      post("a", 20), post("b", 100), post("c", 45), post("d", 7), post("e", 43),
    ]);
    expect(r.map((o) => o.mediaId)).toEqual(["b", "c", "e"]);
  });

  it("lista vazia devolve vazia, e não quebra", () => {
    expect(recorteDasOportunidades([])).toEqual([]);
  });

  it("empate desempata pelo id, para a ordem não variar entre renders", () => {
    expect(recorteDasOportunidades([post("z", 10), post("a", 10)]).map((o) => o.mediaId))
      .toEqual(["a", "z"]);
  });
});

describe("a oportunidade dentro de oQuePrecisaDeVoce", () => {
  const MS_H = 3_600_000;
  const base = {
    esperando: [],
    falhasPublicacao: 0,
    falhasMensagem: 0,
    automacoesAtivas: 3,
    oportunidades: [],
  };

  it("vira linha com o número de comentários e o caminho da automação nova", () => {
    const itens = oQuePrecisaDeVoce({
      ...base,
      oportunidades: [{ mediaId: "18056760980769921", comentarios: 100, ultimo: null }],
    });
    expect(itens).toHaveLength(1);
    expect(itens[0].chave).toBe("oportunidade:18056760980769921");
    expect(itens[0].titulo).toBe("100 comentários sem automação");
    expect(itens[0].href).toBe("/automacoes/nova?post=18056760980769921");
    expect(itens[0].tipo).toBe("aviso");
  });

  it("um comentário só fala no singular", () => {
    const itens = oQuePrecisaDeVoce({
      ...base,
      oportunidades: [{ mediaId: "9", comentarios: 1, ultimo: null }],
    });
    expect(itens[0].titulo).toBe("1 comentário sem automação");
  });

  it("ENTRA ABAIXO da conversa apertada e ACIMA da falha de publicação", () => {
    // A ordem é a regra do arquivo: primeiro o que desaparece se ninguém agir.
    // A conversa de 1h expira por relógio; a oportunidade cresce mas não vira
    // zero de uma vez; a publicação que falhou continuará falhada.
    const itens = oQuePrecisaDeVoce({
      ...base,
      esperando: [
        { igId: "urgente", quem: "apertada", msLeft: 1 * MS_H },
        { igId: "calma", quem: "folgada", msLeft: 20 * MS_H },
      ],
      falhasPublicacao: 2,
      oportunidades: [{ mediaId: "77", comentarios: 50, ultimo: null }],
    });
    expect(itens.map((i) => i.chave)).toEqual([
      "conversa:urgente",
      "oportunidade:77",
      "falha-publicacao",
      "conversa:calma",
    ]);
  });

  it("usa o nome do post quando ele veio, e sobrevive quando não veio", () => {
    // O nome vem da Meta (`resolvePosts`), que pode falhar ou demorar. A linha
    // tem de renderizar inteira nos dois casos -- e este par prende isso.
    const com = oQuePrecisaDeVoce({
      ...base,
      oportunidades: [
        { mediaId: "1", comentarios: 9, ultimo: null, nome: "Carrossel ChatGPT" },
      ],
    });
    expect(com[0].detalhe).toBe("Carrossel ChatGPT");

    const sem = oQuePrecisaDeVoce({
      ...base,
      oportunidades: [{ mediaId: "1", comentarios: 9, ultimo: null }],
    });
    expect(sem[0].detalhe).toBe("nenhuma automação escuta este post");
  });

  it("o id do post é codificado no caminho, porque vira URL", () => {
    const itens = oQuePrecisaDeVoce({
      ...base,
      oportunidades: [{ mediaId: "a/b?c", comentarios: 9, ultimo: null }],
    });
    expect(itens[0].href).toBe("/automacoes/nova?post=a%2Fb%3Fc");
  });
});
```

Acrescente ao `import` do topo do arquivo: `recorteDasOportunidades` e o tipo
`Oportunidade`.

- [ ] **Passo 2: rodar e ver falhar**

Rode: `npx vitest run tests/precisa-de-voce.test.ts`
Esperado: FALHA com `recorteDasOportunidades is not a function`.

- [ ] **Passo 3: implementar**

Em `lib/precisa-de-voce.ts`, acrescente o import no topo:

```ts
import { fmtRelative } from "./format";
```

Acrescente os tipos e constantes junto dos que já existem:

```ts
/**
 * UM POST QUE ESTÁ RECEBENDO COMENTÁRIO E NÃO TEM AUTOMAÇÃO ESCUTANDO.
 *
 * A terceira forma de "precisa de mim", e a de maior volume: medido em
 * 14/09/2026, 331 dos 332 comentários da semana caíram em post sem automação
 * ativa, e o maior deles juntou CEM pessoas sem resposta.
 *
 * NÃO É DEFEITO DO MOTOR, e por isso não é `parou`: ele não responde porque não
 * há nada configurado para aquele post. É trabalho de configuração — do
 * marketing, não nosso —, e o que cabe ao painel é DIZER.
 */
export type Oportunidade = {
  /** o id do post no Instagram, que vira parâmetro de URL */
  mediaId: string;
  comentarios: number;
  /** quando chegou o último comentário; `null` quando não se sabe */
  ultimo: Date | string | null;
  /**
   * A legenda do post, quando a página conseguiu buscar na Meta.
   *
   * OPCIONAL DE PROPÓSITO, e é a fronteira de camada: esta função é pura e não
   * sabe que existe uma API do outro lado. Quem preenche é `app/page.tsx`, e
   * quando a chamada falha ou demora o campo simplesmente não vem — a linha
   * renderiza inteira sem ele.
   */
  nome?: string | null;
};

/** Quantas oportunidades cabem na tela antes de ela virar uma lista de posts. */
export const MAX_OPORTUNIDADES = 3;

/**
 * Quantos comentários um post precisa juntar para virar linha.
 *
 * SEM PISO A TELA DE CHAMADOS VIRA RUÍDO: medido na conta em 14/09, com piso 1
 * seriam DOZE linhas — a cauda é feita de posts antigos com 4, 5 e 6
 * comentários perdidos. Com piso 5, três linhas, e as três valem o clique.
 */
export const MIN_COMENTARIOS_DA_OPORTUNIDADE = 5;
```

Acrescente a função, antes de `oQuePrecisaDeVoce`:

```ts
/**
 * As oportunidades que merecem linha, das maiores para as menores.
 *
 * ORDENA ANTES DE CORTAR, pelo mesmo motivo que `oQuePrecisaDeVoce` ordena as
 * conversas antes: cortar cru deixaria de fora justamente o post com mais gente
 * esperando, que é o único que esta tela não pode perder.
 *
 * O DESEMPATE PELO ID não é capricho — sem ele, dois posts com a mesma contagem
 * trocariam de lugar entre um render e outro, e a tela mudaria de ordem sozinha
 * a cada F5.
 */
export function recorteDasOportunidades(lista: Oportunidade[]): Oportunidade[] {
  return lista
    .filter((o) => o.comentarios >= MIN_COMENTARIOS_DA_OPORTUNIDADE)
    .sort((a, b) => b.comentarios - a.comentarios || a.mediaId.localeCompare(b.mediaId))
    .slice(0, MAX_OPORTUNIDADES);
}
```

Em `FatosDoInicio`, acrescente o campo:

```ts
export type FatosDoInicio = {
  esperando: ConversaEsperando[];
  falhasPublicacao: number;
  falhasMensagem: number;
  automacoesAtivas: number;
  /** posts recebendo comentário sem automação — ver `Oportunidade` */
  oportunidades: Oportunidade[];
};
```

Dentro de `oQuePrecisaDeVoce`, **depois** da linha `const itens: ItemDoInicio[] =
[...urgentes];` e **antes** do `if (f.falhasPublicacao > 0)`:

```ts
  // A OPORTUNIDADE ENTRA AQUI, E O LUGAR É A DECISÃO.
  //
  // Abaixo da conversa apertada: aquela expira por relógio, em minutos, e some.
  // Acima das falhas: a publicação que falhou às 3h continuará falhada às 9h —
  // é mais grave e é menos urgente —, enquanto o post sem automação junta mais
  // gente a cada hora que passa.
  for (const o of recorteDasOportunidades(f.oportunidades)) {
    itens.push({
      chave: "oportunidade:" + o.mediaId,
      tipo: "aviso",
      titulo:
        o.comentarios === 1
          ? "1 comentário sem automação"
          : o.comentarios + " comentários sem automação",
      // O NOME DO POST QUANDO ELE VEIO, e a frase inteira quando não veio. Quem
      // lê "100 comentários em 'Carrossel ChatGPT'" sabe o que vai fazer; quem
      // lê um número sozinho, não.
      detalhe: [o.nome, o.ultimo ? "último " + fmtRelative(o.ultimo) : null]
        .filter(Boolean)
        .join(" · ") || "nenhuma automação escuta este post",
      // O id vem do banco e vira parâmetro de URL — o mesmo cuidado que
      // `linhaDaConversa` toma com o `igId`.
      href: "/automacoes/nova?post=" + encodeURIComponent(o.mediaId),
      // `fecha` e não `parou`: nada quebrou, e nada está vermelho. Mas também
      // não é `aberto` — o volume cresce enquanto ninguém age.
      urgencia: "fecha",
    });
  }
```

- [ ] **Passo 4: rodar e ver passar**

Rode: `npx vitest run tests/precisa-de-voce.test.ts`
Esperado: PASSA.

**Se outros casos do arquivo quebrarem por falta de `oportunidades`**, acrescente
`oportunidades: []` aos objetos de fato que cada um monta. É esperado: o campo é
obrigatório.

- [ ] **Passo 5: plantar três defeitos**

Um por vez, rodando e desfazendo:
1. Troque `>=` por `>` no filtro do piso → o caso do piso fica vermelho.
2. Tire o `.sort(...)` → o caso do teto fica vermelho (a ordem muda).
3. Mova o laço das oportunidades para DEPOIS do `if (f.falhasPublicacao > 0)` →
   o caso da ordem fica vermelho.

- [ ] **Passo 6: rodar a suíte inteira e commitar**

Rode: `npx tsc --noEmit` (vazio) e `npx vitest run` (tudo verde).

```bash
git add lib/precisa-de-voce.ts tests/precisa-de-voce.test.ts
git commit -F - <<'MSG'
A oportunidade vira a terceira forma de "precisa de mim"

Medido em 14/09: 331 dos 332 comentarios da semana cairam em post SEM
automacao ativa, e o maior juntou CEM pessoas sem resposta. Nao e defeito
do motor -- nao ha nada escutando aqueles posts -- e nenhuma tela do
produto contava isso.

Ela entra ABAIXO da conversa apertada e ACIMA das falhas: a conversa
expira por relogio em minutos; a publicacao que falhou as 3h continuara
falhada as 9h; o post sem automacao junta mais gente a cada hora.

Piso de 5 comentarios porque sem ele a tela de chamados vira ruido --
medido, com piso 1 seriam DOZE linhas. Ordena antes de cortar, senao o
corte perde justamente o post com mais gente esperando.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
```

---

## Tarefa 2: as frases do pulso, do adiante e das 24h

**Arquivos:**
- Criar: `lib/pulso.ts`
- Testar: `tests/pulso.test.ts` (criar)

**Interfaces:**
- Consome: `fmtRelative` de `./format`
- Produz:
  - `fraseDoPulso(p: { entreguesHoje: number; ultimaEntrega: Date | string | null; naFila: number }): string`
  - `fraseDas24h(p: { comentarios: number; mensagens: number; enviadas: number }): string`

- [ ] **Passo 1: escrever os testes que falham**

Crie `tests/pulso.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { fraseDoPulso, fraseDas24h } from "../lib/pulso";

// O QUE ESTE ARQUIVO FIXA: o pulso conta FATO COM CARIMBO DE HORA, e nunca
// contagem parada. "21 automações ativas" continuaria 21 com tudo quebrado —
// foi exatamente o que aconteceu entre 08/09 e 14/09/2026, seis dias sem um
// disparo, com o painel anunciando 21 ativas e fila zero.

describe("fraseDoPulso", () => {
  const TRES_DIAS = new Date(Date.now() - 3 * 24 * 3_600_000);

  it("sem entrega hoje, DIZ que não houve — e não escreve zero", () => {
    // "0 entregues hoje" faz o olho ler um número e seguir. "nada entregue
    // hoje" faz ler uma frase. É a mesma informação e não é a mesma leitura.
    expect(fraseDoPulso({ entreguesHoje: 0, ultimaEntrega: TRES_DIAS, naFila: 0 })).toBe(
      "nada entregue hoje · última há 3 dias · fila vazia"
    );
  });

  it("com entrega, conta e diz quando foi a última", () => {
    const agoraMesmo = new Date(Date.now() - 12 * 60_000);
    expect(fraseDoPulso({ entreguesHoje: 4, ultimaEntrega: agoraMesmo, naFila: 0 })).toBe(
      "4 entregues hoje · última há 12 min · fila vazia"
    );
  });

  it("uma entrega só fala no singular", () => {
    const agoraMesmo = new Date(Date.now() - 12 * 60_000);
    expect(fraseDoPulso({ entreguesHoje: 1, ultimaEntrega: agoraMesmo, naFila: 0 })).toBe(
      "1 entregue hoje · última há 12 min · fila vazia"
    );
  });

  it("conta a fila quando há fila, no singular e no plural", () => {
    const d = new Date(Date.now() - 12 * 60_000);
    expect(fraseDoPulso({ entreguesHoje: 2, ultimaEntrega: d, naFila: 1 })).toContain(
      "1 na fila"
    );
    expect(fraseDoPulso({ entreguesHoje: 2, ultimaEntrega: d, naFila: 7 })).toContain(
      "7 na fila"
    );
  });

  it("conta nova, sem entrega nenhuma: não inventa uma última que não houve", () => {
    expect(fraseDoPulso({ entreguesHoje: 0, ultimaEntrega: null, naFila: 0 })).toBe(
      "nada entregue hoje · nenhuma entrega ainda · fila vazia"
    );
  });
});

describe("fraseDas24h", () => {
  it("junta os três números", () => {
    expect(fraseDas24h({ comentarios: 22, mensagens: 13, enviadas: 3 })).toBe(
      "22 comentários · 13 mensagens · 3 respostas enviadas"
    );
  });

  it("cada número tem singular", () => {
    expect(fraseDas24h({ comentarios: 1, mensagens: 1, enviadas: 1 })).toBe(
      "1 comentário · 1 mensagem · 1 resposta enviada"
    );
  });

  it("dia parado diz que ninguém apareceu, em vez de três zeros", () => {
    expect(fraseDas24h({ comentarios: 0, mensagens: 0, enviadas: 0 })).toBe(
      "nada aconteceu nas últimas 24h"
    );
  });

  it("zero em UM dos três não apaga os outros", () => {
    // O caso que separa "dia parado" de "parte parada": com 22 comentários e
    // nenhuma resposta, a frase TEM de dizer as duas coisas — é o retrato da
    // semana de 08/09 a 14/09, e some se o zero for tratado como ausência.
    expect(fraseDas24h({ comentarios: 22, mensagens: 0, enviadas: 0 })).toBe(
      "22 comentários · nenhuma mensagem · nenhuma resposta enviada"
    );
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Rode: `npx vitest run tests/pulso.test.ts`
Esperado: FALHA — o módulo `../lib/pulso` não existe.

- [ ] **Passo 3: implementar**

Crie `lib/pulso.ts`:

```ts
import { fmtRelative } from "./format";

// O PULSO — a prova de que o relógio anda.
//
// POR QUE ELE EXISTE, e o defeito que ele fecha: entre 08/09 e 14/09/2026 o
// motor passou SEIS DIAS sem disparar nada, enquanto ~40 comentários chegavam
// por dia. O painel, no mesmo período, anunciava "Automações ativas: 21" e "Na
// fila: 0" — dois números verdadeiros que, lidos juntos, pareciam saúde.
//
// A DIFERENÇA ESTÁ NO TIPO DO NÚMERO. "21 ativas" é contagem parada: continuaria
// 21 com tudo quebrado. "última entrega há 3 dias" é FATO COM CARIMBO DE HORA, e
// denuncia sozinha, sem ninguém precisar comparar com nada.
//
// ELE APARECE SEMPRE, inclusive quando está tudo bem. Silêncio não responde
// "está rodando?", porque silêncio é também o que aparece quando a medição
// quebrou — a linha positiva é o que distingue as duas coisas.
//
// MÓDULO PURO: nenhum import de servidor. Quem busca os números é a página.

/** "nada entregue hoje · última há 3 dias · fila vazia" */
export function fraseDoPulso(p: {
  entreguesHoje: number;
  ultimaEntrega: Date | string | null;
  naFila: number;
}): string {
  const hoje =
    p.entreguesHoje === 0
      ? "nada entregue hoje"
      : `${p.entreguesHoje} ${p.entreguesHoje === 1 ? "entregue" : "entregues"} hoje`;

  // CONTA NOVA NÃO TEM "ÚLTIMA": dizer "última há —" seria inventar um passado
  // que não houve, e `fmtRelative` devolve "—" para nulo.
  const ultima = p.ultimaEntrega ? `última ${fmtRelative(p.ultimaEntrega)}` : "nenhuma entrega ainda";

  const fila = p.naFila === 0 ? "fila vazia" : `${p.naFila} na fila`;

  return `${hoje} · ${ultima} · ${fila}`;
}

/**
 * "22 comentários · 13 mensagens · 3 respostas enviadas"
 *
 * ESTA FRASE E A DO PULSO FALAM DE COISAS DIFERENTES, e a spec escreve isso para
 * ninguém "consertar" a duplicação: o pulso conta a FILA (a máquina), esta conta
 * os EVENTOS (o movimento da conta, incluindo a resposta que alguém do marketing
 * digitou na tela de conversa). Em 14/09 a fila entregou zero e houve três
 * respostas — os dois números divergem de propósito, e juntos dizem a verdade:
 * ninguém foi respondido pela automação, e três pessoas foram respondidas à mão.
 */
export function fraseDas24h(p: {
  comentarios: number;
  mensagens: number;
  enviadas: number;
}): string {
  // DIA PARADO É UMA FRASE, E NÃO TRÊS ZEROS. Três zeros em fila fazem o olho
  // procurar o que deu errado; a frase diz que nada deu errado, não aconteceu
  // nada mesmo.
  if (p.comentarios === 0 && p.mensagens === 0 && p.enviadas === 0) {
    return "nada aconteceu nas últimas 24h";
  }
  const c =
    p.comentarios === 0
      ? "nenhum comentário"
      : `${p.comentarios} ${p.comentarios === 1 ? "comentário" : "comentários"}`;
  const m =
    p.mensagens === 0
      ? "nenhuma mensagem"
      : `${p.mensagens} ${p.mensagens === 1 ? "mensagem" : "mensagens"}`;
  const e =
    p.enviadas === 0
      ? "nenhuma resposta enviada"
      : `${p.enviadas} ${p.enviadas === 1 ? "resposta enviada" : "respostas enviadas"}`;
  return `${c} · ${m} · ${e}`;
}
```

- [ ] **Passo 4: rodar e ver passar**

Rode: `npx vitest run tests/pulso.test.ts`
Esperado: PASSA, 9 casos.

- [ ] **Passo 5: plantar dois defeitos**

1. Troque `p.entreguesHoje === 0 ? "nada entregue hoje" : ...` por sempre o ramo
   do número → o caso "não escreve zero" fica vermelho.
2. Troque a checagem do dia parado por `p.comentarios === 0` só → o caso "zero em
   UM dos três não apaga os outros" fica vermelho.

- [ ] **Passo 6: commitar**

```bash
npx tsc --noEmit && npx vitest run
git add lib/pulso.ts tests/pulso.test.ts
git commit -F - <<'MSG'
O pulso: fato com carimbo de hora, nunca contagem parada

Entre 08/09 e 14/09 o motor passou SEIS DIAS sem disparar nada enquanto
~40 comentarios chegavam por dia -- e o painel anunciava "Automacoes
ativas: 21" e "Na fila: 0", dois numeros verdadeiros que lidos juntos
pareciam saude. "21 ativas" continuaria 21 com tudo quebrado; "ultima
entrega ha 3 dias" denuncia sozinha.

A frase das 24h fala de EVENTOS e o pulso fala da FILA -- por isso os
dois numeros divergem de proposito. Em 14/09 a fila entregou zero e
houve tres respostas a mao: juntos, dizem a verdade da semana.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
```

---

## Tarefa 3: as consultas do Início

**Arquivos:**
- Modificar: `app/page.tsx` (só a busca de dados; o layout é a Tarefa 5)
- Criar: `testes-integracao/inicio-oportunidades.integracao.ts`

**Interfaces:**
- Consome: `Oportunidade`, `FatosDoInicio` (Tarefa 1); `fraseDoPulso`,
  `fraseDas24h` (Tarefa 2)
- Produz: a página passa `oportunidades` em `fatos`, e calcula `pulso`,
  `vinte4h` e `adiante` para a Tarefa 5 usar

- [ ] **Passo 1: escrever o teste de integração**

Crie `testes-integracao/inicio-oportunidades.integracao.ts`:

```ts
// AS OPORTUNIDADES SÃO DA CONTA, E SÓ DE POST SEM AUTOMAÇÃO ATIVA.
//
// A PROMESSA: **um post com automação ativa não vira oportunidade, e comentário
// da conta vizinha não entra na conta de ninguém.**
//
// POR QUE DE INTEGRAÇÃO: a pergunta é sobre o `left join` e o `account_id` da
// consulta. `recorteDasOportunidades` já tem os casos dela em
// `tests/precisa-de-voce.test.ts` e continua verde com o join errado — ela corta
// certo a lista errada. O que só se mede pelo EFEITO é QUAIS posts chegam nela.
import { beforeAll, describe, expect, test } from "vitest";
import { bancoDescartavel } from "./harness";

const banco = bancoDescartavel();

const CONTA = "17800000000000901";
const VIZINHA = "17800000000000902";

// A consulta REAL do Início, copiada aqui? NÃO — ela é importada da página no
// Passo 3. Este arquivo a exercita, para que mudá-la lá quebre aqui.
type ModuloInicio = typeof import("@/lib/oportunidades");
let mod: ModuloInicio;

async function comentario(conta: string, mediaId: string, quandoHorasAtras: number) {
  await banco.db().sql().query(
    `insert into events (account_id, type, payload, created_at)
     values ($1, 'comment', jsonb_build_object('media', jsonb_build_object('id', $2::text)),
             now() - make_interval(hours => $3::int))`,
    [conta, mediaId, quandoHorasAtras]
  );
}

async function automacao(conta: string, mediaId: string, ativa: boolean) {
  await banco.db().sql().query(
    `insert into automations (account_id, name, active, triggers, keywords, match_type, steps, media_id)
     values ($1, 'de teste', $2, array['comment'], array[]::text[], 'contains', '[]'::jsonb, $3)`,
    [conta, ativa, mediaId]
  );
}

beforeAll(async () => {
  mod = (await import("@/lib/oportunidades")) as ModuloInicio;
  for (const c of [CONTA, VIZINHA]) {
    await banco.db().upsertAccount({
      ig_user_id: c,
      username: "conta_" + c.slice(-3),
      name: null,
      profile_picture_url: null,
      access_token: "t",
      token_expires_at: null,
    });
  }
});

describe("oportunidades do Início", () => {
  test("post SEM automação entra; post COM automação ativa não", async () => {
    for (let i = 0; i < 8; i++) await comentario(CONTA, "POST_ORFAO", 2);
    for (let i = 0; i < 9; i++) await comentario(CONTA, "POST_COBERTO", 2);
    await automacao(CONTA, "POST_COBERTO", true);

    const r = await mod.oportunidadesDaConta(CONTA);
    const ids = r.map((o) => o.mediaId);
    expect(ids).toContain("POST_ORFAO");
    expect(ids).not.toContain("POST_COBERTO");
  });

  test("automação PAUSADA não protege o post", async () => {
    // Automação existe mas está desligada: ninguém está respondendo, então o
    // post continua sendo oportunidade. É o caso que separa "tem automação" de
    // "tem automação ATIVA".
    for (let i = 0; i < 6; i++) await comentario(CONTA, "POST_PAUSADO", 2);
    await automacao(CONTA, "POST_PAUSADO", false);

    expect((await mod.oportunidadesDaConta(CONTA)).map((o) => o.mediaId)).toContain(
      "POST_PAUSADO"
    );
  });

  test("comentário da conta vizinha não entra", async () => {
    for (let i = 0; i < 20; i++) await comentario(VIZINHA, "POST_DA_VIZINHA", 2);
    expect((await mod.oportunidadesDaConta(CONTA)).map((o) => o.mediaId)).not.toContain(
      "POST_DA_VIZINHA"
    );
  });

  test("comentário velho não conta: a janela é de 7 dias", async () => {
    for (let i = 0; i < 30; i++) await comentario(CONTA, "POST_VELHO", 24 * 9);
    expect((await mod.oportunidadesDaConta(CONTA)).map((o) => o.mediaId)).not.toContain(
      "POST_VELHO"
    );
  });

  test("devolve a contagem e o último comentário", async () => {
    const achado = (await mod.oportunidadesDaConta(CONTA)).find(
      (o) => o.mediaId === "POST_ORFAO"
    );
    expect(achado?.comentarios).toBe(8);
    expect(achado?.ultimo).toBeInstanceOf(Date);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Rode: `npx vitest run --config vitest.integracao.config.ts testes-integracao/inicio-oportunidades.integracao.ts`
Esperado: FALHA — `@/lib/oportunidades` não existe.

- [ ] **Passo 3: criar `lib/oportunidades.ts`**

Este módulo TOCA BANCO — diferente de `lib/precisa-de-voce.ts` e `lib/pulso.ts`.
Ele existe separado da página para que o teste de integração possa chamá-lo.

```ts
import "server-only";
import { sql } from "./db";
import type { Oportunidade } from "./precisa-de-voce";

/** A janela que define "está recebendo comentário agora". */
export const DIAS_DA_OPORTUNIDADE = 7;

/**
 * OS POSTS QUE ESTÃO RECEBENDO COMENTÁRIO E NÃO TÊM AUTOMAÇÃO ATIVA.
 *
 * O `media_id` VEM ANINHADO no payload do webhook (`payload->'media'->>'id'`), e
 * não como `payload->>'media_id'` — descoberto medindo em 14/09/2026, depois de
 * uma primeira consulta devolver 332 comentários todos com post nulo.
 *
 * O `not exists` OLHA `active`, E NÃO SÓ A EXISTÊNCIA: automação pausada não
 * responde ninguém, então o post continua órfão. Uma automação desligada que
 * "protegesse" o post esconderia exatamente o caso que esta tela existe para
 * mostrar.
 *
 * SEM PISO E SEM TETO AQUI, de propósito: os dois são decisão de PRODUTO e moram
 * em `recorteDasOportunidades` (lib/precisa-de-voce.ts), com casos puros. A
 * consulta traz o material; quem corta é a regra testável.
 */
export async function oportunidadesDaConta(accountId: string): Promise<Oportunidade[]> {
  const linhas = (await sql().query(
    `select e.payload->'media'->>'id' as "mediaId",
            count(*)::int as comentarios,
            max(e.created_at) as ultimo
       from events e
      where e.account_id = $1
        and e.type = 'comment'
        and e.created_at > now() - make_interval(days => $2::int)
        and e.payload->'media'->>'id' is not null
        and not exists (
          select 1 from automations a
           where a.account_id = e.account_id
             and a.media_id = e.payload->'media'->>'id'
             and a.active
        )
      group by 1
      order by comentarios desc
      limit 20`,
    [accountId, DIAS_DA_OPORTUNIDADE]
  )) as Oportunidade[];
  return linhas;
}
```

- [ ] **Passo 4: rodar o teste de integração**

Rode: `npx vitest run --config vitest.integracao.config.ts testes-integracao/inicio-oportunidades.integracao.ts`
Esperado: PASSA, 5 casos.

- [ ] **Passo 5: plantar três defeitos**

Um por vez, desfazendo com `git checkout -- lib/oportunidades.ts` **depois de
commitar**:
1. Tire `and a.active` do `not exists` → "automação PAUSADA não protege" vermelho.
2. Tire `and e.account_id = $1` → "conta vizinha" vermelho.
3. Troque `$2` por `365` na janela → "comentário velho" vermelho.

**Se algum não ficar vermelho, pare e conserte o caso antes de seguir.**

- [ ] **Passo 6: ligar na página**

Em `app/page.tsx`, acrescente aos imports:

```ts
import { oportunidadesDaConta } from "@/lib/oportunidades";
import { fraseDoPulso, fraseDas24h } from "@/lib/pulso";
```

Acrescente os campos ao tipo `Sinais` e ao `ZERO`:

```ts
type Sinais = {
  autos: number;
  sent7: number;
  falhas_publicacao: number;
  falhas_mensagem: number;
  last_event: Date | null;
  entregues_hoje: number;
  ultima_entrega: Date | null;
  na_fila: number;
  com24: number;
  msg24: number;
  env24: number;
};

const ZERO: Sinais = {
  autos: 0,
  sent7: 0,
  falhas_publicacao: 0,
  falhas_mensagem: 0,
  last_event: null,
  entregues_hoje: 0,
  ultima_entrega: null,
  na_fila: 0,
  com24: 0,
  msg24: 0,
  env24: 0,
};
```

Acrescente as seis subconsultas ao `select` que já existe, logo antes da linha
`(select max(created_at) from events where account_id = $1) as last_event`:

```sql
                 -- O PULSO. "hoje" e o dia de SAO PAULO, e nao de UTC: o
                 -- servidor roda em UTC, e as 21h de Brasilia ja sao o dia
                 -- seguinte la. Sem o `at time zone`, toda entrega do fim da
                 -- tarde apareceria como "de amanha" e o painel diria "nada
                 -- entregue hoje" com tres envios no relogio do dono.
                 (select count(*)::int from queue
                   where account_id = $1 and status = 'sent'
                     and (sent_at at time zone 'America/Sao_Paulo')::date
                         = (now() at time zone 'America/Sao_Paulo')::date) as entregues_hoje,
                 (select max(sent_at) from queue
                   where account_id = $1 and status = 'sent') as ultima_entrega,
                 (select count(*)::int from queue
                   where account_id = $1 and status = 'pending') as na_fila,
                 -- AS 24H CONTAM EVENTOS, e o pulso conta a FILA. Ver o
                 -- comentario de `fraseDas24h` (lib/pulso.ts): os dois numeros
                 -- divergem de proposito, porque `message_sent` inclui a
                 -- resposta que alguem digitou na tela de conversa.
                 (select count(*)::int from events
                   where account_id = $1 and type = 'comment'
                     and created_at > now() - interval '24 hours') as com24,
                 (select count(*)::int from events
                   where account_id = $1 and type = 'message'
                     and created_at > now() - interval '24 hours') as msg24,
                 (select count(*)::int from events
                   where account_id = $1 and type = 'message_sent'
                     and created_at > now() - interval '24 hours') as env24,
```

Acrescente a busca das oportunidades ao `Promise.all`, como terceiro membro:

```ts
    // CADA BLOCO FALHA SOZINHO. Uma consulta que estoura nao pode levar a tela
    // junto: o Inicio e a pagina de maior frequencia do painel, e uma falha
    // aqui e a doenca de 09/09 (500 com corpo vazio) por outra porta. Sem as
    // oportunidades a tela serve; sem a tela, nada serve.
    (async () => {
      if (!account) return [] as Oportunidade[];
      try {
        return await oportunidadesDaConta(account.ig_user_id);
      } catch (e) {
        console.error("inicio: oportunidades falharam", e);
        return [] as Oportunidade[];
      }
    })(),
```

Ajuste a desestruturação para `const [sinais, conversas, oportunidadesCruas] =
await Promise.all([...])`.

**Depois do `Promise.all`, busque os nomes dos posts** — e repare que ele vem
DEPOIS de propósito: a lista de ids só existe quando a consulta volta, e só as
três que sobram do corte são procuradas.

```ts
  // O NOME DO POST, E ELE É OPCIONAL POR CONSTRUÇÃO.
  //
  // `resolvePosts` (lib/media-lookup.ts) fala com a Meta: uma listagem dos 40
  // recentes mais até 8 buscas avulsas, com `try/catch` interno que devolve
  // mapa parcial ou vazio. Já está em produção em `/eventos`.
  //
  // SÓ AS QUE VÃO APARECER SÃO PROCURADAS: `recorteDasOportunidades` corta em
  // três ANTES, então o pior caso desta tela são três ids — que cabem na
  // listagem dos recentes, porque post que está recebendo comentário agora é
  // post recente. Uma chamada, e nenhuma busca avulsa no caso comum.
  //
  // E ELA NÃO ESTÁ NO CAMINHO CRÍTICO: sem o nome, a linha renderiza inteira
  // ("100 comentários sem automação · último há 2 h"). O `catch` aqui é a
  // segunda rede, para o caso de `resolvePosts` lançar por algo que o
  // `try/catch` de dentro dele não cobre.
  const escolhidas = recorteDasOportunidades(oportunidadesCruas);
  let nomes = new Map<string, PostRef>();
  if (account && escolhidas.length) {
    try {
      nomes = await resolvePosts(
        account.ig_user_id,
        account.access_token,
        escolhidas.map((o) => o.mediaId)
      );
    } catch (e) {
      console.error("inicio: nomes dos posts falharam", e);
    }
  }
  const oportunidades = escolhidas.map((o) => ({
    ...o,
    nome: nomes.get(o.mediaId)?.caption ?? null,
  }));
```

Acrescente aos imports:

```ts
import { resolvePosts, type PostRef } from "@/lib/media-lookup";
import { recorteDasOportunidades } from "@/lib/precisa-de-voce";
```

**`recorteDasOportunidades` roda DUAS vezes** — aqui e dentro de
`oQuePrecisaDeVoce`. É função pura sobre no máximo 20 itens, e o custo é nada.
Chamar aqui é o que evita procurar na Meta o nome de posts que não vão aparecer.

Acrescente `oportunidades` a `fatos`, e calcule as frases:

```ts
  const fatos: FatosDoInicio = {
    // …os campos que já existem…
    oportunidades,
  };

  const pulso = fraseDoPulso({
    entreguesHoje: sinais.entregues_hoje,
    ultimaEntrega: sinais.ultima_entrega,
    naFila: sinais.na_fila,
  });
  const vinte4h = fraseDas24h({
    comentarios: sinais.com24,
    mensagens: sinais.msg24,
    enviadas: sinais.env24,
  });
```

Acrescente o import do tipo: `type Oportunidade` no bloco de
`@/lib/precisa-de-voce`.

**`pulso` e `vinte4h` ainda não aparecem na tela** — a Tarefa 5 os usa. Para o
`tsc` não reclamar de variável não usada nesta tarefa, renderize as duas num
lugar provisório: logo abaixo do `<h1>`, `<p className={pageSubtitle}>{pulso}</p>`.
A Tarefa 5 dá a elas o lugar definitivo.

- [ ] **Passo 7: conferir e commitar**

Rode: `npx tsc --noEmit` (vazio), `npx vitest run` (verde), `npx next build`
(completo).

```bash
git add app/page.tsx lib/oportunidades.ts testes-integracao/inicio-oportunidades.integracao.ts
git commit -F - <<'MSG'
As consultas do Inicio: oportunidades, pulso e as 24h

O media_id vem ANINHADO no payload do webhook (payload->'media'->>'id'),
e nao como payload->>'media_id' -- descoberto medindo, depois de uma
primeira consulta devolver 332 comentarios todos com post nulo.

O `not exists` olha `active` e nao so a existencia: automacao pausada nao
responde ninguem, entao o post continua orfao. Uma automacao desligada
que "protegesse" o post esconderia o caso que a tela existe para mostrar.

"hoje" e o dia de Sao Paulo e nao de UTC. Sem o `at time zone`, toda
entrega do fim da tarde apareceria como "de amanha" e o painel diria
"nada entregue hoje" com tres envios no relogio do dono.

As oportunidades falham sozinhas: sem elas a tela serve, sem a tela nada
serve.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
```

---

## Tarefa 4: o post atravessa para a automação nova

**Arquivos:**
- Modificar: `app/automacoes/nova/page.tsx`, `app/automacoes/nova/form-nova.tsx`,
  `app/automacoes/actions.ts`
- Testar: `testes-integracao/inicio-oportunidades.integracao.ts` (acrescentar)

**Interfaces:**
- Consome: o link `/automacoes/nova?post=<media_id>` que a Tarefa 1 produz
- Produz: `criarAutomacao` grava `automations.media_id`

- [ ] **Passo 1: escrever o caso que falha**

Acrescente ao fim de `testes-integracao/inicio-oportunidades.integracao.ts`:

```ts
describe("o post atravessa para a automação nova", () => {
  test("`post` válido vira `media_id` na automação criada", async () => {
    const acoes = await import("@/app/automacoes/actions");
    const form = new FormData();
    form.set("name", "nascida do Início");
    form.set("trigger", "comment");
    form.set("match_type", "any");
    form.set("post", "18056760980769921");

    // `criarAutomacao` termina em `redirect`, que LANÇA. O digest é o desfecho.
    await comoNumaRequisicao("/automacoes/nova", async () => {
      try {
        await acoes.criarAutomacao(null, form);
      } catch {
        /* o redirect do Next */
      }
      return null;
    });

    const linhas = (await banco.db().sql().query(
      `select media_id from automations where account_id = $1 and name = 'nascida do Início'`,
      [CONTA]
    )) as { media_id: string | null }[];
    expect(linhas[0]?.media_id).toBe("18056760980769921");
  });

  test("`post` fora do formato é IGNORADO, e a automação nasce sem post", async () => {
    // O valor vem da URL, e URL é digitável. Recusar o campo é diferente de
    // recusar a automação: quem clicou quer criar automação, e o post é um
    // atalho — perdê-lo não pode custar a criação.
    const acoes = await import("@/app/automacoes/actions");
    const form = new FormData();
    form.set("name", "com post torto");
    form.set("trigger", "comment");
    form.set("match_type", "any");
    form.set("post", "nao-e-um-id");

    await comoNumaRequisicao("/automacoes/nova", async () => {
      try {
        await acoes.criarAutomacao(null, form);
      } catch {
        /* o redirect do Next */
      }
      return null;
    });

    const linhas = (await banco.db().sql().query(
      `select media_id from automations where account_id = $1 and name = 'com post torto'`,
      [CONTA]
    )) as { media_id: string | null }[];
    expect(linhas).toHaveLength(1);
    expect(linhas[0].media_id).toBeNull();
  });
});
```

Acrescente ao topo do arquivo: `import { comoNumaRequisicao } from "./semear-requisicao";`

**A conta selecionada:** `criarAutomacao` usa `getSelectedAccountId()`, que
escolhe a primeira conta por `created_at asc`. `CONTA` nasce antes de `VIZINHA`
no `beforeAll`, então é ela — a mesma disciplina de
`testes-integracao/marcar-em-lote.integracao.ts`.

- [ ] **Passo 2: rodar e ver falhar**

Rode: `npx vitest run --config vitest.integracao.config.ts testes-integracao/inicio-oportunidades.integracao.ts`
Esperado: FALHA no primeiro caso — `media_id` vem `null`.

- [ ] **Passo 3: gravar o `media_id`**

Em `app/automacoes/actions.ts`, dentro de `criarAutomacao`, depois da linha
`const palavras = splitList(...)`:

```ts
  // O POST VEM DO INÍCIO, e é um atalho — não um requisito.
  //
  // Quem clica em "100 comentários sem automação" quer criar a automação DAQUELE
  // post; sem isto ela cairia num formulário que não sabe de qual post se trata,
  // e a linha do Início perderia a ação e viraria aviso.
  //
  // FORA DO FORMATO É IGNORADO, e não recusado: o valor vem da URL, que é
  // digitável, mas perder o atalho não pode custar a criação da automação. Quem
  // veio pelo caminho normal (`/automacoes/nova`, sem `?post=`) cai neste mesmo
  // ramo, e é o comportamento de sempre.
  const postBruto = String(formData.get("post") ?? "");
  const mediaId = /^\d{1,32}$/.test(postBruto) ? postBruto : null;
```

E troque o `insert` por:

```ts
  const linhas = (await sql().query(
    `insert into automations (account_id, name, active, triggers, keywords, match_type, steps, media_id)
     values ($1, $2, false, $3, $4, $5, '[]'::jsonb, $6)
     returning id`,
    [accountId, nome, [gatilho], palavras, correspondencia, mediaId]
  )) as { id: string }[];
```

- [ ] **Passo 4: passar o `post` pelo formulário**

Em `app/automacoes/nova/page.tsx`, leia o parâmetro e passe ao formulário:

```tsx
export default async function NovaAutomacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ post?: string }>;
}) {
  const sp = await searchParams;
  // …o resto como está…
      <FormNovaAutomacao post={sp.post ?? null} />
```

(Se o componente hoje é chamado sem props, acrescente só a prop.)

Em `app/automacoes/nova/form-nova.tsx`, receba e renderize:

```tsx
export default function FormNovaAutomacao({ post }: { post: string | null }) {
```

e dentro do `<form>`, junto dos outros campos:

```tsx
      {/* O POST VEIO DO INÍCIO. Campo escondido porque não é uma pergunta: quem
          clicou na linha "100 comentários sem automação" já escolheu o post, e
          repetir a escolha aqui seria desfazer o atalho. `criarAutomacao`
          recusa o que não for id, então um valor torto na URL não vira nada. */}
      {post && <input type="hidden" name="post" value={post} />}
```

- [ ] **Passo 5: rodar e ver passar**

Rode: `npx vitest run --config vitest.integracao.config.ts testes-integracao/inicio-oportunidades.integracao.ts`
Esperado: PASSA, 7 casos.

- [ ] **Passo 6: plantar um defeito**

Troque o teste do formato por `const mediaId = postBruto || null;` → o caso
"`post` fora do formato é IGNORADO" fica vermelho.

- [ ] **Passo 7: commitar**

```bash
npx tsc --noEmit && npx vitest run && npx next build
git add app/automacoes/actions.ts app/automacoes/nova/page.tsx app/automacoes/nova/form-nova.tsx testes-integracao/inicio-oportunidades.integracao.ts
git commit -F - <<'MSG'
O post do Inicio atravessa para a automacao nova

Sem isto, quem clica em "100 comentarios sem automacao" cai num
formulario que nao sabe de qual post se trata -- a linha perderia a acao
e viraria aviso. A coluna automations.media_id ja existia e criarAutomacao
simplesmente nao a preenchia.

Fora do formato e IGNORADO e nao recusado: o valor vem da URL, que e
digitavel, mas perder o atalho nao pode custar a criacao da automacao.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
```

---

## Tarefa 5: a tela

**Arquivos:**
- Modificar: `app/page.tsx` (só o JSX)

**Interfaces:**
- Consome: `itens` (com as linhas de oportunidade), `pulso`, `vinte4h`,
  `oportunidades` — todos já calculados pela Tarefa 3

**ANTES DE COMEÇAR:** invoque a skill `frontend-design`. Esta é a única tarefa do
plano com decisão estética, e o dono pediu a skill por nome.

- [ ] **Passo 1: o cabeçalho e os atalhos**

O título ganha dois botões à direita, e o "Reconectar" perde o lugar de honra.

**O QUE SAI:** o `<a href="/api/oauth/login" className={btnGhost}>Reconectar</a>`
que hoje fica ao lado do `<h1>` (`app/page.tsx:158`). Conferido: ele é
renderizado SEMPRE que existe conta — não é condicional a problema nenhum — e é
o único botão da tela, anunciando avaria numa conta saudável.

**PARA ONDE VAI:** para junto do `@usuário`, como link de texto discreto
(`text-xs` e a classe `link`), na mesma linha do subtítulo.

**O QUE ENTRA no lugar:** `<Link href="/publicar/novo" className={btnPrimary}>Criar
post</Link>` e `<Link href="/automacoes/nova" className={btnGhost}>Nova
automação</Link>`.

- [ ] **Passo 2: o pulso**

Troque o `<p className={pageSubtitle}>{pulso}</p>` provisório da Tarefa 3 por uma
linha própria, entre o cabeçalho e a lista:

```tsx
{/* O PULSO. Uma linha, sempre visível, inclusive quando está tudo bem:
    silêncio não responde "está rodando?", porque silêncio é também o que
    aparece quando a medição quebrou. Ela é discreta de propósito — não compete
    com quem está esperando, que é o assunto principal da tela. */}
<p className={`text-xs ${muted}`}>{pulso}</p>
```

- [ ] **Passo 3: as duas colunas**

Abaixo da lista de "Precisa de você", uma grade de duas colunas que vira uma no
celular:

```tsx
<div className="grid gap-4 sm:grid-cols-2">
  <section className={`p-4 ${card}`}>
    <h2 className="titulo text-sm font-semibold">Adiante</h2>
    {/* … */}
  </section>
  <section className={`p-4 ${card}`}>
    <h2 className="titulo text-sm font-semibold">Nas últimas 24h</h2>
    <p className={`mt-2 text-sm ${muted}`}>{vinte4h}</p>
    <p className="mt-3 text-sm">
      <Link href="/eventos" className={link}>Ver a atividade →</Link>
    </p>
  </section>
</div>
```

**O "Adiante" mostra as próximas publicações agendadas.** A Tarefa 3 não buscou
isso, e é de propósito: **medido em 14/09, a fila não tem NENHUM item pendente**,
de nenhum tipo. Então o estado vazio não é exceção, é o estado comum — e por
enquanto o bloco é só o convite:

```tsx
    <p className={`mt-2 text-sm ${muted}`}>Nada agendado.</p>
    <p className="mt-3 text-sm">
      <Link href="/publicar/novo" className={link}>Criar post →</Link>
    </p>
```

**Isto é dívida declarada, e vai no comentário do código:** quando houver
agendamento de verdade, esta seção passa a listar até três, e a consulta entra na
Tarefa 3. Construí-la agora seria escrever uma lista que nunca renderizou uma
linha — e código que nunca rodou não é código provado.

- [ ] **Passo 4: a linha da oportunidade se distingue da conversa**

Na lista de `itens`, a linha de `tipo: "aviso"` com chave começando em
`oportunidade:` ganha o botão de ação à direita:

```tsx
{item.chave.startsWith("oportunidade:") && (
  <span className={`${badgeAcao} shrink-0`}>Criar automação</span>
)}
```

O `href` do item já aponta para `/automacoes/nova?post=…` (Tarefa 1) — a linha
inteira é o link, e o selo é a affordance.

- [ ] **Passo 5: conferir na tela, e é o passo que não pode faltar**

Rode `npm run dev` e abra `/`. **Se a senha local não for a sua**, diga no
relatório e deixe para o controlador conferir na prévia — não invente que viu.

Confira, nos DOIS temas:
1. o pulso aparece e diz a frase certa
2. as linhas de oportunidade aparecem acima das conversas calmas, com o selo
3. as duas colunas ficam lado a lado no desktop e empilham no celular (390px)
4. **o espaço morto abaixo do conteúdo diminuiu** — meça com
   `document.documentElement.scrollHeight` e compare com `innerHeight`
5. nenhuma rolagem horizontal em 390px

- [ ] **Passo 6: commitar**

```bash
npx tsc --noEmit && npx vitest run && npx next build
git add app/page.tsx
git commit -F - <<'MSG'
O Inicio ganha corpo: pulso, oportunidades e duas colunas

A queixa era "a pagina de painel ficou muito vazia". Medida: 388px de
conteudo numa janela de 648, com TRES pessoas esperando -- ou seja, nao
era o estado vazio, era a tela parecendo desocupada COM conteudo.

O "Reconectar" perde o lugar de honra: renderizado SEMPRE que ha conta,
era o unico botao da tela e anunciava avaria numa conta saudavel. Em
lugar dele, as duas acoes que a tela realmente convida.

O "Adiante" nasce so como convite, e e divida declarada: medido, a fila
nao tem NENHUM item pendente. Escrever a lista agora seria escrever
codigo que nunca renderizou uma linha.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
```

---

## Fechamento

- [ ] `npx tsc --noEmit`, `npx vitest run`, `npm run test:integracao`, `npx next build`
- [ ] Prévia da Vercel: conferir nos dois temas e em 390px
- [ ] Clicar numa linha de oportunidade e confirmar que a automação nasce com o
      post preso a ela
- [ ] Atualizar `.superpowers/sdd/progress.md` com o estado e a hora

## Dívida declarada por este plano

**O "Adiante" não lista nada** — só o convite. A consulta entra quando houver
agendamento para ela mostrar. Escrita agora, seria código nunca exercitado.

**O layout não tem teste automático**, como toda tela deste projeto. O que o
protege é o Passo 5 da Tarefa 5, a olho, nos dois temas.
