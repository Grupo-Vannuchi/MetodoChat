# O post nas duas redes, Instagram e LinkedIn (parte 2b de 3) — Plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: `superpowers:subagent-driven-development`
> (recomendada) ou `superpowers:executing-plans`, fase por fase. Os passos usam caixa de
> seleção (`- [ ]`) para acompanhar.

**Objetivo:** publicar o mesmo post de imagem no Instagram e no perfil pessoal do LinkedIn, pela tela de publicar, agora ou agendado, com as caixinhas "Instagram" e "LinkedIn". Cada rede tem a sua linha na fila, a sua chave e o seu andamento: se uma falha ao publicar, a outra segue. A linha do LinkedIn leva uma cópia própria da imagem. Quando uma parte não entra na fila, a outra é desfeita, mas só se ainda estiver esperando. O convite numa conta que já tem LinkedIn pede confirmação, na tela e no servidor.

**Arquitetura:**
- `lib/redes-do-post.ts` (novo, puro) guarda as regras das duas redes: o que cada forma aceita, as caixinhas de partida, o estado de cada caixinha, o texto que vai ao LinkedIn e o aviso das duas. A tela e a action leem as mesmas;
- `lib/linkedin-copia.ts` (novo) copia a imagem para a linha do LinkedIn, no molde da cópia do gerador, com as mesmas chamadas que `lib/bucket.ts` já tem, o teto de 8 MB e o de 10 s em cada chamada;
- a action nova `publicarNasDuasRedes` (`app/publicar/actions.ts`) segue a ordem do achado 192: as conferências; a chave do LinkedIn; a cópia; a linha do LinkedIn, com a chave pelo caminho ORIGINAL; e a linha do Instagram, pelo enfileirar de hoje. Se o Instagram não entra, a linha do LinkedIn é desfeita só se ainda estiver pendente (achado 199). As duas actions de hoje (só Instagram e só LinkedIn) não mudam;
- o "agora" das duas: primeiro o LinkedIn, só a própria linha (achado 211); depois o dreno de hoje, para o Instagram, com o mesmo começo da função. **O dreno (`lib/queue-drain.ts`) não muda nesta parte**: no preview, ele roda sobre a fila de verdade, e o código que roda ali é o mesmo da produção;
- a tela de compor troca o rádio "Rede" pelas caixinhas, numa "Forma" só (as quatro do Instagram e o "Só texto"). Nas duas redes, a "Legenda" e o "Texto para o LinkedIn", opcional;
- o convite do LinkedIn numa conta que já tem a conexão válida pede confirmação na tela, e o servidor recusa sem ela.

**Stack:** a do projeto, no Next.js 16.4.3: Vitest (puros, tela e integração) e o Postgres no container para a integração.

**Spec:** `docs/specs/2026-11-06-linkedin-no-perfil.md`, na `main`, com a emenda de 09/11. Leia o §6 ("Uma linha por rede", "A mídia de cada rede", "A ordem, quando uma parte falha no meio") e o §7 antes de começar. A parte 1 (a conexão) está em produção desde 09/11 (PR #32), e a 2a (só texto e imagem, uma rede por post) desde 10/11 (PR #33, `58cc3db`).

**As decisões do Eduardo, pela caixa:**
- **"Dividir em 2a e 2b (Recomendado)"** (09/11, 18:40:22.823Z): a 2b junta as duas redes no mesmo post (a cópia da imagem, o desfazer, os achados 192 e 199, e o 209);
- **"poe começar"** (10/11, 17:11:20Z): o começo da 2b;
- **"Só o Instagram marcado (Recomendado)"** (10/11, 17:16:36.801Z): com o LinkedIn conectado, as caixinhas começam só com o Instagram;
- **"Pede confirmação antes (Recomendado)"** (10/11, 17:16:36.801Z): o convite numa conta que já tem LinkedIn pede confirmação.

**A auditoria (`metodochat-55`, 10/11), sobre o desenho e o ensaio:**
- o desenho foi aceito com quatro pontos: a cópia só sai na compensação se o desfazer devolveu a linha; a cópia que não vai ser usada sai em toda saída; a tela diz que a menção vira texto no LinkedIn; e, na prova, o post é público também no Instagram, e o Instagram que falha não é provocado na produção;
- o "agora" é o (a): o LinkedIn primeiro, e o dreno do Instagram com o `{ inicioDaFuncaoMs }`. Medido na produção pela auditoria: a imagem do Instagram leva ~7 s numa passada;
- a ordem ganhou um passo: a chave do LinkedIn é conferida ANTES da cópia, porque depois do "agora" o dreno do Instagram já apagou o original;
- a assinatura do upload ganhou o teto de 10 s no chamador, sem mudar `lib/bucket.ts`;
- `lib/queue-drain.ts`, `lib/bucket.ts` e `lib/engine.ts` não mudam;
- a confirmação do convite vale no servidor, e não só na tela (o duplo clique do 209);
- as mutações pedidas (Apêndice A) e uma deixada de fora de propósito.

**Ensaio do plano (10/11):** o código deste plano foi escrito e testado fase a fase numa cópia isolada (`git worktree`, sem push, branch local `ensaio-linkedin-duas-redes`, saída de `58cc3db`, com `npm ci` próprio e `.env.local` vazio). Todo bloco de código abaixo foi tirado do git dessa cópia por um gerador, sem cópia à mão. Os commits do ensaio:
- FASE 1, `948c1ea` (patch-id `121050c830a7`);
- FASE 2, `e417ea9` (patch-id `da76aa4fb0c3`);
- FASE 3, `a5836d0` (patch-id `fd0fe4464c5a`);
- FASE 4, `bc6e6ae` (patch-id `2d4d74b49b7e`);
- FASE 5, `7c3089f` (patch-id `f7ac57af2c0a`).
As mensagens são as deste plano. Os números de RED e de GREEN de cada passo foram medidos numa segunda cópia limpa saída de `58cc3db`, fazendo o caminho de quem executa: os testes primeiro, o código depois e o commit com a mesma mensagem. As cinco fases deram o mesmo patch-id do ensaio. Os registros ficam na pasta de trabalho do DEV: `el2b-*.log` (o ensaio), `ml2b-*.log` (o RED e o GREEN de cada fase), `el2b-mutar.log` (as mutações) e os da verificação final.

Os números do fim, no `8b22061` (entre parênteses, os da base `58cc3db`):
- lint e `tsc` limpos;
- testes puros: 158 arquivos e 3 757 casos (155 e 3 714); testes de tela: 36 arquivos e 336 casos (36 e 324);
- a varredura sem vazamento e o build com o Next 16.4.3 ("MIGRAÇÃO PULADA", fora da produção);
- a integração no container: 76 arquivos, 927 passaram e 8 pularam (75, 897 e 8);
- as 29 mutações do Apêndice A (8 delas de integração) derrubaram, cada uma, o caso esperado: "29 mutações, 0 ruins; árvore no fim: limpa";
- a guarda do diff (FASE 6): 18 arquivos fora de `docs`, com 2 040 linhas a mais e 163 a menos, e nada em `lib/queue-drain.ts`, `lib/bucket.ts` nem `lib/engine.ts`;
- este plano, aplicado do zero numa cópia limpa do `58cc3db` (cada "Crie" gravado, cada "Em ... aplique" passado ao `git apply`), deu os 18 arquivos iguais aos do ensaio: "6 criados, 16 diffs aplicados, 0 apagados, 0 gerados; 18 arquivos conferidos, 0 diferentes".

O `8b22061` é o último commit da cópia da medição, com a árvore igual à do `7c3089f` do ensaio.

**O que o ensaio achou:**
- **a cópia do gerador não serve**: o `copiarParaAFila` grava em `<pasta>/bonus-fila/<uuid>.jpg`, com uma pasta a mais, e o /publicar lê só `<pasta>/<id>.<ext>`. Daí a irmã `lib/linkedin-copia.ts`, fora de `lib/bonus`;
- **a chave do LinkedIn pela cópia faria o clique repetido virar um segundo post**: cada envio faz uma cópia nova, com outro caminho. A chave sai do caminho ORIGINAL, e o payload leva a cópia;
- **depois do "agora", o mesmo envio repetido falharia na cópia**, porque o dreno do Instagram apaga o original. A chave do LinkedIn passou a ser conferida antes da cópia, e o repetido diz "já existia" nas duas;
- **a assinatura do upload não tinha teto de tempo**: ela é de `lib/bucket.ts`. O teto ficou no chamador;
- **o teste de prazo da 2a só olhava a action do LinkedIn sozinho**: a FASE 5 prende o começo da função nas duas chamadas da action das duas redes, e a ordem entre elas;
- **uma guarda antiga** (`tests/publicar-compositor-guarda.test.ts:29`) prendia a linha da action da 2a, e **um caso de tela antigo** ("mostra o erro da ação") usava a conta conectada, que agora pede confirmação. Os dois foram atualizados sem perder o que prendiam;
- **trocar a forma desmarca a rede que a forma nova não aceita, e voltar não a remarca**: o post do LinkedIn sai público no perfil pessoal, e só vai quem marcar de novo. Um caso de tela prende isso.

**Os limites conhecidos (sem código nesta parte, escritos a pedido da auditoria):**
- se o mesmo arquivo foi postado antes só no LinkedIn (a 2a), o dreno do LinkedIn já apagou o original. Reenviar o mesmo formulário nas duas redes daria "já existia" no LinkedIn e uma linha nova no Instagram apontando para um arquivo que não existe mais, e o Instagram falharia depois, com o erro da Meta. Isso só acontece reenviando o mesmo formulário com outras caixinhas, porque toda tela nova sobe um arquivo novo;
- se o insert da linha do LinkedIn for gravado, mas a resposta se perder (a conexão cai depois do commit), a action trata como "não entrou", apaga a cópia e diz "nada foi agendado". A linha que existe tenta, não acha a imagem e termina `failed` depois das tentativas, em "Não saíram". Nenhum post errado sai, mas a tela teria dito "nada". É raro como o achado 210.

## Restrições globais

- **Branch:** `linkedin-duas-redes`, saída do `58cc3db` (a `main` de hoje), sem upstream. O primeiro commit é este plano. Nunca commitar nem empurrar na `main`: ela não está protegida, e um push nela dispara o deploy na Vercel. Conferir `git branch --show-current` antes de cada commit.
- **`git add` com caminho explícito.** Nunca `-A` nem `.`.
- **Commit no estilo do Vinícius:** uma frase dizendo o efeito, sem prefixo, sem rodapé de IA. Autor: Eduardo Kobal <162614913+Eduardokobal@users.noreply.github.com>.
- **Antes de cada commit**, varrer os arquivos tocados atrás de caractere de controle e de fim de linha misturado, e gravar a saída num registro.
- **O commit é um comando à parte**, depois de ler a saída dos testes.
- **Fim de linha:** os diffs deste plano estão em LF. Aplique com `git apply --ignore-whitespace`, ou numa cópia feita com `git -c core.autocrlf=false worktree add`. Nunca `git config` numa worktree: ele grava no `.git/config` compartilhado.
- **As ferramentas são as da cópia:** `npm ci` na FASE 0, e todo `npx` é `npx --no-install` (achado 208).
- **Os arquivos desta parte são os 18 do mapa abaixo, e mais nenhum.** Em especial, `lib/queue-drain.ts`, `lib/bucket.ts` e `lib/engine.ts` não mudam.
- **Esta parte não tem migração.** O tipo `publicacao_linkedin` (a 025) e o estado `skipped` (a 009) já estão na produção.
- **As escritas em produção** são só as da prova (os posts nas duas redes, públicos e apagados à mão no fim, e a conexão pelo convite, se a conta estiver sem LinkedIn), o merge do Eduardo e o deploy que ele dispara. Cada uma com o OK do Eduardo pela caixa, a hora mandada à auditoria antes e o "pode" dela.
- **Uma rodada de integração de cada vez**, sempre com `DATABASE_URL_TESTES` apontando para o container (`127.0.0.1:5434`). Toda rodada tem de imprimir `[rede-global] ALVO: banco de TESTE`. Nunca rode com a variável vazia: ela cai na `DATABASE_URL`, que é **produção**. Se o container estiver parado: `docker start metodochat-banco-de-teste`.
- **`next build` sem as variáveis de agente:** `env -u CLAUDECODE -u AI_AGENT ...`, e `git diff AGENTS.md` depois.
- **O token, o code e a client secret do LinkedIn** nunca passam pelo chat nem por registro. Os testes usam valores inventados, e todo teste que fala com o LinkedIn, com a Meta ou com o bucket fala com um falso no loopback, com o `fetch` interceptado.

## Mapa dos arquivos

| Arquivo | O que faz | Fase |
|---|---|---|
| `lib/redes-do-post.ts` (novo) | o que cada forma aceita, as caixinhas, o texto do LinkedIn e o aviso das duas (1); o aviso do LinkedIn que não entrou (2); a recusa sem rede (3) | 1, 2, 3 |
| `tests/redes-do-post.test.ts` (novo) | as regras puras das duas redes | 1, 2, 3 |
| `lib/linkedin-copia.ts` (novo) | a cópia da imagem para a linha do LinkedIn, e o apagar da cópia | 2 |
| `tests/linkedin-copia.test.ts` (novo) | a cópia, com o `fetch` falso e os tetos | 2 |
| `lib/linkedin-fila.ts` | a chave pelos caminhos de origem, a conferência da chave e o desfazer | 2 |
| `app/publicar/actions.ts` | a action `publicarNasDuasRedes` | 2 |
| `testes-integracao/linkedin-duas-redes.integracao.ts` (novo) | a action nas duas redes, contra a Meta, o LinkedIn e o bucket falsos | 2 |
| `app/publicar/enviador.tsx` | as caixinhas, a forma única, os campos e a action das redes marcadas | 3 |
| `app/publicar/novo/page.tsx` | a action das duas redes para a tela | 3 |
| `testes-dom/publicar-compositor-linkedin.dom.tsx` | a tela de compor com as caixinhas | 3 |
| `tests/publicar-compositor-guarda.test.ts` | a guarda do clique, com a action das redes | 3 |
| `lib/linkedin-publicacao.ts` | quando o convite pede confirmação, e as frases | 4 |
| `app/setup/actions.ts` | o convite recusa sem a confirmação | 4 |
| `app/setup/linkedin-das-contas.tsx` | a confirmação do convite na tela | 4 |
| `tests/linkedin-convite-confirmacao.test.ts` (novo) | a regra da confirmação | 4 |
| `testes-dom/linkedin-no-setup.dom.tsx` | a confirmação na tela da Configuração | 4 |
| `testes-integracao/linkedin-acoes.integracao.ts` | a confirmação no servidor | 4 |
| `tests/dreno-com-prazo.test.ts` | o começo da função nas duas chamadas da action das duas redes | 5 |

O que fica de fora, e por quê:
- **o carrossel em PDF, o vídeo em partes e a caixinha do LinkedIn no gerador**: são da parte 3. Na 2b, as duas redes juntas só valem para a forma Imagem;
- **a escolha da visibilidade**: o post é público, fixo nesta entrega (spec, §6);
- **o README**: a instalação do zero é outro trabalho.

---

### FASE 0 — Começar da branch certa

- [ ] **Passo 1: a branch**

A branch `linkedin-duas-redes` já existe, com um commit só de `docs` sobre o `58cc3db`: este plano. A execução continua nela.

```bash
git fetch origin
git rev-parse --short origin/main                 # tem de dar 58cc3db
git branch --show-current                          # linkedin-duas-redes
git log --oneline 58cc3db..HEAD                    # o commit do plano
git diff --name-only 58cc3db HEAD                  # só este plano
git status --porcelain                             # vazio
npm ci
ls node_modules/.bin/vitest node_modules/.bin/eslint node_modules/.bin/tsc node_modules/.bin/next
```

Se `origin/main` não estiver em `58cc3db`, pare: a base mudou, e o plano precisa ser conferido de novo. Se faltar um dos quatro em `node_modules/.bin`, pare: sem eles, o `npx --no-install` não roda nada.

---

### FASE 1 — As regras das duas redes

**Arquivos:** `lib/redes-do-post.ts` (novo), `tests/redes-do-post.test.ts` (novo).

- [ ] **Passo 1: o teste**

Crie `tests/redes-do-post.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  CAIXINHAS_DE_PARTIDA,
  NOTA_DA_LEGENDA_NO_LINKEDIN,
  avisoDasDuasRedes,
  estadoDasCaixinhas,
  formasDaTela,
  redeAceitaAForma,
  redesDoPedido,
  textoQueVaiAoLinkedin,
} from "@/lib/redes-do-post";
import { avisoDaPublicacaoEnfileirada } from "@/lib/avisos";
import { avisoDoPostNoLinkedin } from "@/lib/linkedin-publicacao";
import { textoDaRecusaDaPublicacao } from "@/lib/publicacao";

// AS DUAS REDES NO MESMO POST (docs/specs/2026-11-06-linkedin-no-perfil.md, §6 e §7; a parte 2b). As regras puras
// que a tela e a action leem: o que cada rede aceita, as caixinhas, o texto que vai ao LinkedIn e o aviso.

const ligado = { disponivel: true as const, nome: "Ana Souza" };
const desligado = {
  disponivel: false as const,
  motivo: "Esta conta não tem LinkedIn conectado. Quem administra o painel manda o convite pela Configuração.",
};
const as2 = { instagram: true, linkedin: true };

describe("o que cada rede aceita", () => {
  it("o Instagram aceita as quatro formas dele, e não o só texto", () => {
    for (const forma of ["imagem", "carrossel", "reels", "story"] as const) {
      expect(redeAceitaAForma("instagram", forma)).toBeNull();
    }
    expect(redeAceitaAForma("instagram", "texto")).toContain("só de texto");
  });

  it("o LinkedIn aceita o só texto e a imagem; o carrossel e o reels chegam na próxima entrega, e o story nunca", () => {
    expect(redeAceitaAForma("linkedin", "texto")).toBeNull();
    expect(redeAceitaAForma("linkedin", "imagem")).toBeNull();
    expect(redeAceitaAForma("linkedin", "carrossel")).toContain("próxima entrega");
    expect(redeAceitaAForma("linkedin", "reels")).toContain("próxima entrega");
    expect(redeAceitaAForma("linkedin", "story")).toContain("não tem story");
  });
});

describe("as formas da tela", () => {
  it("sem o LinkedIn disponível, são as quatro do Instagram, sem o só texto", () => {
    expect(formasDaTela(null)).toEqual(["imagem", "carrossel", "reels", "story"]);
    expect(formasDaTela(desligado)).toEqual(["imagem", "carrossel", "reels", "story"]);
  });

  it("com o LinkedIn disponível, o só texto entra no fim", () => {
    expect(formasDaTela(ligado)).toEqual(["imagem", "carrossel", "reels", "story", "texto"]);
  });
});

describe("as caixinhas", () => {
  it("começam só com o Instagram marcado (a decisão do Eduardo, 10/11)", () => {
    expect(CAIXINHAS_DE_PARTIDA).toEqual({ instagram: true, linkedin: false });
  });

  it("sem o LinkedIn na página, não há caixinha do LinkedIn, e o Instagram é como antes", () => {
    const e = estadoDasCaixinhas({ forma: "imagem", marcadas: as2, linkedin: null });
    expect(e.linkedin).toBeNull();
    expect(e.instagram).toEqual({ ligada: true, marcada: true, motivo: null });
  });

  it("na imagem, com o LinkedIn ligado, as duas podem ser marcadas", () => {
    const e = estadoDasCaixinhas({ forma: "imagem", marcadas: as2, linkedin: ligado });
    expect(e.instagram).toEqual({ ligada: true, marcada: true, motivo: null });
    expect(e.linkedin).toEqual({ ligada: true, marcada: true, motivo: null });
  });

  it("o que não foi marcado fica desmarcado", () => {
    const e = estadoDasCaixinhas({ forma: "imagem", marcadas: CAIXINHAS_DE_PARTIDA, linkedin: ligado });
    expect(e.linkedin).toEqual({ ligada: true, marcada: false, motivo: null });
  });

  it("o LinkedIn desligado (sem conexão ou vencido) fica desmarcado, com o motivo da conexão, mesmo se veio marcado", () => {
    const e = estadoDasCaixinhas({ forma: "imagem", marcadas: as2, linkedin: desligado });
    expect(e.linkedin).toEqual({ ligada: false, marcada: false, motivo: desligado.motivo });
  });

  it("o story, o carrossel e o reels desligam o LinkedIn, com o motivo da forma", () => {
    for (const forma of ["story", "carrossel", "reels"] as const) {
      const e = estadoDasCaixinhas({ forma, marcadas: as2, linkedin: ligado });
      expect(e.linkedin).toEqual({ ligada: false, marcada: false, motivo: redeAceitaAForma("linkedin", forma) });
      expect(e.instagram.marcada).toBe(true);
    }
  });

  it("o só texto desliga o Instagram, com o motivo", () => {
    const e = estadoDasCaixinhas({ forma: "texto", marcadas: as2, linkedin: ligado });
    expect(e.instagram).toEqual({ ligada: false, marcada: false, motivo: redeAceitaAForma("instagram", "texto") });
    expect(e.linkedin).toEqual({ ligada: true, marcada: true, motivo: null });
  });
});

describe("as redes do pedido", () => {
  it("só o valor '1' marca a rede", () => {
    expect(redesDoPedido({ instagram: "1", linkedin: null })).toEqual({ instagram: true, linkedin: false });
    expect(redesDoPedido({ instagram: "1", linkedin: "1" })).toEqual(as2);
    expect(redesDoPedido({ instagram: "on", linkedin: "true" })).toEqual({ instagram: false, linkedin: false });
    expect(redesDoPedido({ instagram: undefined, linkedin: "1" })).toEqual({ instagram: false, linkedin: true });
  });
});

describe("o texto que vai ao LinkedIn", () => {
  it("o texto próprio, quando há, sem os espaços das pontas", () => {
    expect(textoQueVaiAoLinkedin({ legenda: "A legenda #ig", textoProprio: "  O texto do LinkedIn  " })).toBe(
      "O texto do LinkedIn"
    );
  });

  it("sem o texto próprio (vazio ou só espaços), vai a legenda", () => {
    expect(textoQueVaiAoLinkedin({ legenda: " A legenda #ig ", textoProprio: "" })).toBe("A legenda #ig");
    expect(textoQueVaiAoLinkedin({ legenda: "A legenda", textoProprio: "   " })).toBe("A legenda");
  });

  it("sem os dois, vai o vazio, que a recusa do LinkedIn pega (texto_vazio)", () => {
    expect(textoQueVaiAoLinkedin({ legenda: "  ", textoProprio: "" })).toBe("");
  });

  it("a nota da tela diz que a menção vira texto e que a hashtag vira clicável", () => {
    expect(NOTA_DA_LEGENDA_NO_LINKEDIN).toContain("@");
    expect(NOTA_DA_LEGENDA_NO_LINKEDIN).toContain("hashtags");
  });
});

describe("o aviso das duas redes", () => {
  const campos = { dia: 12, mes: 11, hora: 9, minuto: 5 };
  const ig = (texto: string) => `Instagram: ${texto}`;
  const li = (texto: string) => `LinkedIn: ${texto}`;

  it("agora nas duas: uma frase por rede, tirada da função de cada rede", () => {
    const a = avisoDasDuasRedes({
      tipo: "entrou",
      campos,
      instagram: { entrou: true, jaVale: true },
      linkedin: { entrou: true, jaVale: true, desfecho: "publicado" },
    });
    expect(a.tom).toBe("ok");
    expect(a.texto).toBe(
      `${ig(avisoDaPublicacaoEnfileirada(null).texto)} ${li(avisoDoPostNoLinkedin({ desfecho: "publicado", agendadoPara: null }).texto)}`
    );
  });

  it("agendado nas duas: a hora escolhida nas duas frases", () => {
    const a = avisoDasDuasRedes({
      tipo: "entrou",
      campos,
      instagram: { entrou: true, jaVale: false },
      linkedin: { entrou: true, jaVale: false, desfecho: null },
    });
    expect(a.tom).toBe("ok");
    expect(a.texto).toBe(
      `${ig(avisoDaPublicacaoEnfileirada(campos).texto)} ${li(avisoDoPostNoLinkedin({ desfecho: null, agendadoPara: campos }).texto)}`
    );
    expect(a.texto.match(/12\/11 às 09:05/g)).toHaveLength(2);
  });

  it("o LinkedIn que não saiu deixa o aviso em erro, com o motivo, e o Instagram é dito igual", () => {
    const a = avisoDasDuasRedes({
      tipo: "entrou",
      campos,
      instagram: { entrou: true, jaVale: true },
      linkedin: { entrou: true, jaVale: true, desfecho: "falhou", motivo: "o LinkedIn recusou a imagem" },
    });
    expect(a.tom).toBe("erro");
    expect(a.texto).toContain(ig(avisoDaPublicacaoEnfileirada(null).texto));
    expect(a.texto).toContain("o LinkedIn recusou a imagem");
  });

  it("uma rede que já existia é dita como tal, e a nova segue com o aviso de sempre", () => {
    const soONovoNoLinkedin = avisoDasDuasRedes({
      tipo: "entrou",
      campos,
      instagram: { entrou: false },
      linkedin: { entrou: true, jaVale: true, desfecho: "publicado" },
    });
    expect(soONovoNoLinkedin.tom).toBe("ok");
    expect(soONovoNoLinkedin.texto).toContain(ig(textoDaRecusaDaPublicacao("ja_enfileirado")));
    expect(soONovoNoLinkedin.texto).toContain(li("Post publicado no LinkedIn."));

    const soONovoNoInstagram = avisoDasDuasRedes({
      tipo: "entrou",
      campos,
      instagram: { entrou: true, jaVale: true },
      linkedin: { entrou: false },
    });
    expect(soONovoNoInstagram.tom).toBe("ok");
    expect(soONovoNoInstagram.texto).toContain(li("O post do LinkedIn já estava na fila. Nada foi duplicado."));
  });

  it("as duas que já existiam: o aviso é de erro, e diz que nada foi duplicado", () => {
    const a = avisoDasDuasRedes({ tipo: "entrou", campos, instagram: { entrou: false }, linkedin: { entrou: false } });
    expect(a.tom).toBe("erro");
    expect(a.texto.match(/Nada foi duplicado/g)).toHaveLength(2);
  });

  it("o Instagram não entrou e o LinkedIn foi desfeito: nada foi agendado", () => {
    const a = avisoDasDuasRedes({ tipo: "instagram_nao_entrou", linkedin: "desfeito" });
    expect(a.tom).toBe("erro");
    expect(a.texto).toContain("Nada foi agendado");
  });

  it("o Instagram não entrou e o LinkedIn já tinha começado a sair: a tela diz que ele segue", () => {
    const a = avisoDasDuasRedes({ tipo: "instagram_nao_entrou", linkedin: "seguiu" });
    expect(a.tom).toBe("erro");
    expect(a.texto).toContain("não entrou na fila do Instagram");
    expect(a.texto).toContain("LinkedIn já tinha começado a sair");
    expect(a.texto).not.toContain("Nada foi agendado");
  });

  it("o Instagram não entrou e o LinkedIn já estava na fila antes: ele segue, e não foi mexido", () => {
    const a = avisoDasDuasRedes({ tipo: "instagram_nao_entrou", linkedin: "ja_existia" });
    expect(a.tom).toBe("erro");
    expect(a.texto).toContain("LinkedIn já estava na fila");
  });

  it("cada saída tem a sua frase", () => {
    const frases = [
      avisoDasDuasRedes({ tipo: "instagram_nao_entrou", linkedin: "desfeito" }).texto,
      avisoDasDuasRedes({ tipo: "instagram_nao_entrou", linkedin: "seguiu" }).texto,
      avisoDasDuasRedes({ tipo: "instagram_nao_entrou", linkedin: "ja_existia" }).texto,
    ];
    expect(new Set(frases).size).toBe(3);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
env -u CLAUDECODE -u AI_AGENT npx --no-install vitest run tests/redes-do-post.test.ts
```

Esperado: "Test Files 1 failed (1)" e "Tests no tests": o módulo ainda não existe ("Cannot find package '@/lib/redes-do-post'").

- [ ] **Passo 3: o código**

Crie `lib/redes-do-post.ts`:

```ts
// AS DUAS REDES NO MESMO POST (docs/specs/2026-11-06-linkedin-no-perfil.md, §6 e §7; a parte 2b), SEM IMPORT DE
// SERVIDOR: a tela de compor e a action leem as mesmas regras. O que cada rede aceita, as caixinhas, o texto que vai
// ao LinkedIn quando o post é das duas, e o aviso das duas. As regras de cada rede continuam onde estavam: as do
// Instagram em lib/publicacao.ts, e as do LinkedIn em lib/linkedin-publicacao.ts.
import { avisoDaPublicacaoEnfileirada, type Aviso } from "@/lib/avisos";
import { avisoDoPostNoLinkedin, type DisponibilidadeDoLinkedin } from "@/lib/linkedin-publicacao";
import { textoDaRecusaDaPublicacao, type FormaDePublicacao } from "@/lib/publicacao";

export type Rede = "instagram" | "linkedin";

/** As formas da tela de compor: as quatro do Instagram e o só texto, que é só do LinkedIn. */
export type FormaDaTela = FormaDePublicacao | "texto";

const FORMAS_DO_INSTAGRAM: readonly FormaDePublicacao[] = ["imagem", "carrossel", "reels", "story"];

/**
 * POR QUE UMA REDE NÃO ACEITA A FORMA, ou null quando aceita. Nesta entrega o LinkedIn recebe só texto e imagem: o
 * carrossel (em PDF) e o vídeo chegam na próxima (a parte 3), e o story não existe lá.
 */
export function redeAceitaAForma(rede: Rede, forma: FormaDaTela): string | null {
  if (rede === "instagram") return forma === "texto" ? "O Instagram não publica post só de texto." : null;
  switch (forma) {
    case "texto":
    case "imagem":
      return null;
    case "carrossel":
      return "O LinkedIn recebe carrossel na próxima entrega.";
    case "reels":
      return "O LinkedIn recebe vídeo na próxima entrega.";
    case "story":
      return "O LinkedIn não tem story.";
  }
}

/**
 * AS FORMAS DA TELA, na ordem da tela: o só texto só aparece com o LinkedIn disponível, porque nenhuma outra rede o
 * aceita. Sem o LinkedIn na página (`null`), a tela é a do Instagram de antes.
 */
export function formasDaTela(linkedin: DisponibilidadeDoLinkedin | null): FormaDaTela[] {
  return linkedin?.disponivel ? [...FORMAS_DO_INSTAGRAM, "texto"] : [...FORMAS_DO_INSTAGRAM];
}

/**
 * AS CAIXINHAS DE PARTIDA (a decisão do Eduardo pela caixa, em 10/11, 17:16:36Z: "Só o Instagram marcado"). O
 * LinkedIn é o perfil PESSOAL do dono da conta, e o post sai PÚBLICO: ele só vai quando alguém marca.
 */
export const CAIXINHAS_DE_PARTIDA: Readonly<Record<Rede, boolean>> = { instagram: true, linkedin: false };

export type EstadoDaCaixinha = { ligada: boolean; marcada: boolean; motivo: string | null };

/**
 * O ESTADO DE CADA CAIXINHA: ligada quando a rede aceita a forma (e, no LinkedIn, quando a conexão vale); marcada só
 * se ligada E marcada por quem compõe; e o motivo quando desligada. A caixinha desligada nunca conta como marcada,
 * mesmo que o formulário a mande. Sem o LinkedIn na página, não há caixinha do LinkedIn (`null`).
 */
export function estadoDasCaixinhas(p: {
  forma: FormaDaTela;
  marcadas: Readonly<Record<Rede, boolean>>;
  linkedin: DisponibilidadeDoLinkedin | null;
}): { instagram: EstadoDaCaixinha; linkedin: EstadoDaCaixinha | null } {
  const motivoDoInstagram = redeAceitaAForma("instagram", p.forma);
  const instagram = { ligada: !motivoDoInstagram, marcada: !motivoDoInstagram && p.marcadas.instagram, motivo: motivoDoInstagram };
  if (!p.linkedin) return { instagram, linkedin: null };
  const motivoDoLinkedin = p.linkedin.disponivel ? redeAceitaAForma("linkedin", p.forma) : p.linkedin.motivo;
  return {
    instagram,
    linkedin: { ligada: !motivoDoLinkedin, marcada: !motivoDoLinkedin && p.marcadas.linkedin, motivo: motivoDoLinkedin },
  };
}

/** As redes que o formulário marcou: só o valor "1" marca, como os outros campos de marcar desta tela. */
export function redesDoPedido(campos: { instagram: unknown; linkedin: unknown }): Record<Rede, boolean> {
  return { instagram: campos.instagram === "1", linkedin: campos.linkedin === "1" };
}

/**
 * O TEXTO QUE VAI AO LINKEDIN NO POST DAS DUAS REDES (spec, §7): o "Texto para o LinkedIn", quando há; sem ele, a
 * legenda. O vazio que sobra é recusado pela `recusaDoPedidoNoLinkedin` (texto_vazio), que conta pela mesma função
 * do contador (achado 212).
 */
export function textoQueVaiAoLinkedin(p: { legenda: string; textoProprio: string }): string {
  return p.textoProprio.trim() || p.legenda.trim();
}

/**
 * A NOTA DA LEGENDA QUE VAI AO LINKEDIN (a nota 3 da auditoria sobre o desenho da 2b): lá, a menção do Instagram não
 * é menção (o "@" vai escapado, como texto), e as hashtags viram o modelo clicável (lib/linkedin-publicacao.ts).
 */
export const NOTA_DA_LEGENDA_NO_LINKEDIN =
  "Sem texto próprio, o LinkedIn leva a legenda: lá, a menção com @ vira texto comum, e as hashtags viram clicáveis.";

// ---------------------------------------------------------------------------------------------------------------
// O AVISO DAS DUAS REDES
// ---------------------------------------------------------------------------------------------------------------

type Campos = { dia: number; mes: number; hora: number; minuto: number };

/** O lado do Instagram: entrou (já valendo ou agendado), ou a chave já existia. */
export type LadoDoInstagram = { entrou: true; jaVale: boolean } | { entrou: false };

/** O lado do LinkedIn: entrou, com o desfecho do "agora" quando já valia, ou a chave já existia. */
export type LadoDoLinkedin =
  | { entrou: true; jaVale: boolean; desfecho: "publicado" | "aguardando" | "falhou" | null; motivo?: string | null }
  | { entrou: false };

/**
 * O QUE ACONTECEU NO ENFILEIRAR DAS DUAS REDES (spec, §6; achados 192 e 199):
 *   - "entrou": as duas linhas foram tentadas, e cada lado diz o seu;
 *   - "instagram_nao_entrou": o enfileirar do Instagram lançou, e o LinkedIn foi desfeito (estava pendente), ou
 *     seguiu (um dreno já o tinha pego), ou já estava na fila antes deste envio (e não foi mexido).
 */
export type DesfechoDasDuasRedes =
  | { tipo: "entrou"; campos: Campos | null; instagram: LadoDoInstagram; linkedin: LadoDoLinkedin }
  | { tipo: "instagram_nao_entrou"; linkedin: "desfeito" | "seguiu" | "ja_existia" };

const JA_EXISTIA_NO_LINKEDIN = "O post do LinkedIn já estava na fila. Nada foi duplicado.";

/**
 * O AVISO DEPOIS DE PUBLICAR NAS DUAS REDES: uma frase por rede, tirada da função de cada uma (a do Instagram, a do
 * LinkedIn e a da chave que já existia), para a mesma situação ter a mesma frase com uma rede ou com duas. O tom é
 * de erro quando o LinkedIn não saiu, quando nada de novo entrou, e em toda saída em que o Instagram não entrou.
 */
export function avisoDasDuasRedes(d: DesfechoDasDuasRedes): Aviso {
  if (d.tipo === "instagram_nao_entrou") {
    switch (d.linkedin) {
      case "desfeito":
        return {
          tom: "erro",
          texto: "Nada foi agendado: o post não entrou na fila do Instagram, e o do LinkedIn foi desfeito. Tente de novo.",
        };
      case "seguiu":
        return {
          tom: "erro",
          texto:
            "O post não entrou na fila do Instagram. O do LinkedIn já tinha começado a sair e segue: acompanhe em Publicações. Para o Instagram, tente de novo.",
        };
      case "ja_existia":
        return {
          tom: "erro",
          texto:
            "O post não entrou na fila do Instagram. O do LinkedIn já estava na fila antes e segue: acompanhe em Publicações.",
        };
    }
  }

  const doInstagram = d.instagram.entrou
    ? avisoDaPublicacaoEnfileirada(d.instagram.jaVale ? null : d.campos).texto
    : textoDaRecusaDaPublicacao("ja_enfileirado");
  const doLinkedin = d.linkedin.entrou
    ? avisoDoPostNoLinkedin({
        desfecho: d.linkedin.desfecho,
        motivo: d.linkedin.motivo,
        agendadoPara: d.linkedin.jaVale ? null : d.campos,
      })
    : { tom: "ok" as const, texto: JA_EXISTIA_NO_LINKEDIN };
  const nadaNovo = !d.instagram.entrou && !d.linkedin.entrou;
  return {
    tom: nadaNovo || doLinkedin.tom === "erro" ? "erro" : "ok",
    texto: `Instagram: ${doInstagram} LinkedIn: ${doLinkedin.texto}`,
  };
}
```

O módulo importa só `lib/avisos.ts`, `lib/linkedin-publicacao.ts` e `lib/publicacao.ts`, que não importam servidor: ele vai ao componente de cliente da FASE 3 sem levar nada de servidor junto.

- [ ] **Passo 4: rodar e ver passar**

```bash
env -u CLAUDECODE -u AI_AGENT npx --no-install vitest run tests/redes-do-post.test.ts
npx --no-install tsc --noEmit
npx --no-install eslint lib/redes-do-post.ts tests/redes-do-post.test.ts
```

Esperado: "Test Files 1 passed (1)" e "Tests 25 passed (25)", e o `tsc` e o lint sem saída.

- [ ] **Passo 5: o commit**

A mensagem do commit, gravada em `$SCRATCH/msg-li2b-f1.txt`:

```text
As regras das duas redes ficam num lugar só: o que cada forma aceita, as caixinhas de partida, o texto que vai ao LinkedIn e o aviso das duas
```

```bash
git add -- lib/redes-do-post.ts tests/redes-do-post.test.ts
git commit -F "$SCRATCH/msg-li2b-f1.txt"
```

---

### FASE 2 — O post de imagem nas duas redes: a cópia, a ordem e o desfazer

**Arquivos:** `lib/linkedin-copia.ts` (novo), `lib/linkedin-fila.ts`, `lib/redes-do-post.ts`, `app/publicar/actions.ts`, `tests/linkedin-copia.test.ts` (novo), `tests/redes-do-post.test.ts`, `testes-integracao/linkedin-duas-redes.integracao.ts` (novo).

- [ ] **Passo 1: os testes**

Crie `tests/linkedin-copia.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A CÓPIA DA IMAGEM PARA O POST DO LINKEDIN NAS DUAS REDES (docs/specs/2026-11-06-linkedin-no-perfil.md, §6; a
// parte 2b). A linha do LinkedIn leva uma cópia própria, porque o dreno do Instagram apaga o original depois de
// publicar. Ela usa só o que lib/bucket.ts já exporta (o GET público, a URL assinada e o PUT), como a cópia do
// gerador, e grava no caminho do /publicar (`<pasta>/<id>.jpg`), e não no do gerador. O `fetch` é falso: nada sai
// desta máquina, e cada chamada fica anotada.

process.env.SUPABASE_URL = "https://exemplo.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "chave-de-teste-que-nao-vale-nada";
process.env.SUPABASE_BUCKET = "MetodoChat";

const { copiarImagemParaOLinkedin, TETO_DA_COPIA_BYTES, TETO_DA_COPIA_MS } = await import("@/lib/linkedin-copia");

const CONTA = "17841400000000001";
const OUTRA = "17841400000000002";
const BASE = "https://exemplo.supabase.co/storage/v1";
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const ORIGEM = `${CONTA}/foto-do-post.jpg`;

type Chamada = { metodo: string; url: string; cabecalhos: Record<string, string>; corpo: unknown; signal?: AbortSignal };
let chamadas: Chamada[];
let responder: (c: Chamada) => Response | Promise<Response>;

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
        signal: init.signal ?? undefined,
      };
      chamadas.push(c);
      return responder(c);
    })
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("copiar a imagem do post para a linha do LinkedIn", () => {
  it("baixa pelo endereço público, sobe os mesmos bytes em JPEG num caminho novo da mesma pasta, e devolve o caminho", async () => {
    const copia = await copiarImagemParaOLinkedin(ORIGEM, CONTA, uuid(9));
    expect(copia).toBe(`${CONTA}/${uuid(9)}.jpg`);
    expect(chamadas.map((c) => c.metodo)).toEqual(["GET", "POST", "PUT"]);
    expect(chamadas[0].url).toBe(`${BASE}/object/public/MetodoChat/${ORIGEM}`);
    // O GET público não leva a chave: é o mesmo endereço que a Meta e o dreno do LinkedIn buscam.
    expect(chamadas[0].cabecalhos.apikey).toBeUndefined();
    expect(chamadas[1].url).toBe(`${BASE}/object/upload/sign/MetodoChat/${copia}`);
    expect(chamadas[2].url).toBe(`${BASE}/object/upload/sign/MetodoChat/${copia}?token=t`);
    expect(chamadas[2].cabecalhos["content-type"]).toBe("image/jpeg");
    expect(Array.from(chamadas[2].corpo as Uint8Array)).toEqual(Array.from(JPEG));
  });

  it("o caminho da cópia tem a forma dos caminhos do /publicar, e nunca a do gerador", async () => {
    const copia = await copiarImagemParaOLinkedin(ORIGEM, CONTA);
    expect(copia).toMatch(new RegExp(`^${CONTA}/[0-9a-f-]{36}\\.jpg$`));
    expect(copia).not.toContain("bonus");
  });

  it("a imagem de outra conta é recusada antes de qualquer chamada", async () => {
    await expect(copiarImagemParaOLinkedin(`${OUTRA}/foto-do-post.jpg`, CONTA, uuid(9))).rejects.toThrow(/não é desta conta/);
    expect(chamadas).toEqual([]);
  });

  it("o caminho torto (subpasta, volta de pasta, duas linhas) é recusado antes de qualquer chamada", async () => {
    for (const torto of [`${CONTA}/bonus-fila/${uuid(1)}.jpg`, `${CONTA}/../${OUTRA}/x.jpg`, `${ORIGEM}\n${CONTA}/outra.jpg`, ""]) {
      await expect(copiarImagemParaOLinkedin(torto, CONTA, uuid(9))).rejects.toThrow(/não é desta conta/);
    }
    expect(chamadas).toEqual([]);
  });

  it("a imagem que não existe mais é recusada, sem assinar nada", async () => {
    responder = () => new Response("not found", { status: 400 });
    await expect(copiarImagemParaOLinkedin(ORIGEM, CONTA, uuid(9))).rejects.toThrow(/HTTP 400/);
    expect(chamadas.map((c) => c.metodo)).toEqual(["GET"]);
  });

  it("vazia, ou maior que 8 MB, é recusada sem assinar nada", async () => {
    expect(TETO_DA_COPIA_BYTES).toBe(8 * 1024 * 1024);
    responder = () => new Response(new Uint8Array(0), { status: 200 });
    await expect(copiarImagemParaOLinkedin(ORIGEM, CONTA, uuid(9))).rejects.toThrow(/tamanho/);
    responder = () => new Response(new Uint8Array(TETO_DA_COPIA_BYTES + 1), { status: 200 });
    await expect(copiarImagemParaOLinkedin(ORIGEM, CONTA, uuid(9))).rejects.toThrow(/tamanho/);
    expect(chamadas.map((c) => c.metodo)).toEqual(["GET", "GET"]);
  });

  it("no teto de 8 MB, a cópia passa", async () => {
    responder = (c) =>
      c.metodo === "POST"
        ? Response.json({ url: `/object/upload/sign/MetodoChat/x?token=t`, token: "t" })
        : c.metodo === "GET"
          ? new Response(new Uint8Array(TETO_DA_COPIA_BYTES), { status: 200 })
          : new Response("{}", { status: 200 });
    await expect(copiarImagemParaOLinkedin(ORIGEM, CONTA, uuid(9))).resolves.toBe(`${CONTA}/${uuid(9)}.jpg`);
  });

  it("o armazenamento que recusa a subida faz a cópia lançar, sem o endereço assinado na frase", async () => {
    responder = (c) =>
      c.metodo === "POST"
        ? Response.json({ url: `/object/upload/sign/MetodoChat/x?token=segredo`, token: "segredo" })
        : c.metodo === "GET"
          ? new Response(JPEG, { status: 200 })
          : new Response("{}", { status: 403 });
    const erro = await copiarImagemParaOLinkedin(ORIGEM, CONTA, uuid(9)).catch((e: Error) => e);
    expect(erro).toBeInstanceOf(Error);
    expect((erro as Error).message).toMatch(/recusou a cópia \(HTTP 403\)/);
    expect((erro as Error).message).not.toContain("segredo");
  });

  it("o armazenamento que não responde: o download desiste no teto de 10 s, e a cópia lança", async () => {
    expect(TETO_DA_COPIA_MS).toBe(10_000);
    vi.useFakeTimers();
    responder = (c) =>
      new Promise<Response>((_, falhar) => {
        c.signal?.addEventListener("abort", () => falhar(new DOMException("abortado", "AbortError")));
      });
    const copia = copiarImagemParaOLinkedin(ORIGEM, CONTA, uuid(9)).catch((e: Error) => e);
    await vi.advanceTimersByTimeAsync(TETO_DA_COPIA_MS - 1);
    expect(chamadas[0].signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const erro = await copia;
    expect((erro as Error).message).toMatch(/não respondeu em 10 s/);
    expect(chamadas.map((c) => c.metodo)).toEqual(["GET"]);
  });

  it("a assinatura que não responde também desiste no teto de 10 s, sem subir nada (o teto é de quem chama)", async () => {
    vi.useFakeTimers();
    responder = (c) => (c.metodo === "GET" ? new Response(JPEG, { status: 200 }) : new Promise<Response>(() => {}));
    const copia = copiarImagemParaOLinkedin(ORIGEM, CONTA, uuid(9)).catch((e: Error) => e);
    await vi.advanceTimersByTimeAsync(TETO_DA_COPIA_MS - 1);
    expect(chamadas.map((c) => c.metodo)).toEqual(["GET", "POST"]);
    await vi.advanceTimersByTimeAsync(1);
    const erro = await copia;
    expect((erro as Error).message).toMatch(/não respondeu em 10 s/);
    expect(chamadas.map((c) => c.metodo)).toEqual(["GET", "POST"]);
  });

  it("a subida que não responde também desiste no teto de 10 s", async () => {
    vi.useFakeTimers();
    responder = (c) => {
      if (c.metodo === "POST") return Response.json({ url: `/object/upload/sign/MetodoChat/x?token=t`, token: "t" });
      if (c.metodo === "GET") return new Response(JPEG, { status: 200 });
      return new Promise<Response>((_, falhar) => {
        c.signal?.addEventListener("abort", () => falhar(new DOMException("abortado", "AbortError")));
      });
    };
    const copia = copiarImagemParaOLinkedin(ORIGEM, CONTA, uuid(9)).catch((e: Error) => e);
    await vi.advanceTimersByTimeAsync(TETO_DA_COPIA_MS);
    const erro = await copia;
    expect((erro as Error).message).toMatch(/não respondeu em 10 s/);
    expect(chamadas.map((c) => c.metodo)).toEqual(["GET", "POST", "PUT"]);
  });
});
```

Em `tests/redes-do-post.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/redes-do-post.test.ts b/tests/redes-do-post.test.ts
index 1d142a7..cece365 100644
--- a/tests/redes-do-post.test.ts
+++ b/tests/redes-do-post.test.ts
@@ -215,12 +215,20 @@ describe("o aviso das duas redes", () => {
     expect(a.texto).toContain("LinkedIn já estava na fila");
   });
 
+  it("o LinkedIn não entrou (a cópia da imagem ou a fila dele falhou): nada foi agendado, com o motivo", () => {
+    const a = avisoDasDuasRedes({ tipo: "linkedin_nao_entrou", motivo: "o armazenamento não respondeu em 10 s ao baixar a imagem" });
+    expect(a.tom).toBe("erro");
+    expect(a.texto).toContain("Nada foi agendado");
+    expect(a.texto).toContain("o armazenamento não respondeu em 10 s ao baixar a imagem");
+  });
+
   it("cada saída tem a sua frase", () => {
     const frases = [
       avisoDasDuasRedes({ tipo: "instagram_nao_entrou", linkedin: "desfeito" }).texto,
       avisoDasDuasRedes({ tipo: "instagram_nao_entrou", linkedin: "seguiu" }).texto,
       avisoDasDuasRedes({ tipo: "instagram_nao_entrou", linkedin: "ja_existia" }).texto,
+      avisoDasDuasRedes({ tipo: "linkedin_nao_entrou", motivo: "x" }).texto,
     ];
-    expect(new Set(frases).size).toBe(3);
+    expect(new Set(frases).size).toBe(4);
   });
 });
```

Crie `testes-integracao/linkedin-duas-redes.integracao.ts`:

```ts
// O POST NAS DUAS REDES (`publicarNasDuasRedes`, app/publicar/actions.ts; docs/specs/2026-11-06-linkedin-no-perfil.md,
// §6 e §7; a parte 2b). Uma linha por rede, cada uma com a sua chave; a linha do LinkedIn leva uma CÓPIA da imagem,
// porque o dreno do Instagram apaga o original depois de publicar; e, quando uma parte falha no meio, a ordem do
// achado 192 com a compensação do 199: a linha do LinkedIn só é desfeita se ainda estiver pendente.
//
// A MAQUINARIA É A DE `linkedin-compor.integracao.ts` e a de `publicar-fala.integracao.ts`: a action de verdade num
// contexto de requisição, com a sessão de teste (administrador) ou a do login COMUM de teste. Um servidor falso no
// loopback faz as três pontas: a Meta (`IG_GRAPH_BASE`), o LinkedIn (`LINKEDIN_API_BASE`) e o bucket
// (`SUPABASE_URL`), com os objetos guardados num mapa; o `fetch` recusa qualquer outro endereço. **NADA AQUI PUBLICA
// NO INSTAGRAM NEM NO LINKEDIN DE VERDADE, E NADA É ESCRITO NO BUCKET DE VERDADE.**
//
// OS GATILHOS DE TESTE (as falhas no meio): cada um nasce e morre DENTRO do caso, num try/finally, e o nome começa
// com "teste_"; o `afterAll` confere que nenhum sobrou no schema.
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { bancoDescartavel } from "./harness";
import { comoNumaRequisicaoComoComum, comoNumaRequisicaoComSessao } from "./semear-requisicao";

type ModuloAcoes = typeof import("@/app/publicar/actions");
type ModuloRedes = typeof import("@/lib/redes-do-post");
type ModuloLinkedin = typeof import("@/lib/linkedin-publicacao");
type ModuloPublicacao = typeof import("@/lib/publicacao");

const banco = bancoDescartavel();
const q = (texto: string, params: unknown[] = []) =>
  banco.db().sql().query(texto, params) as Promise<Record<string, unknown>[]>;

const CONTA_A = "17800000000026201";
const CONTA_B = "17800000000026202";
const BUCKET = "midia-das-duas-redes";
const CHAVE_DO_BUCKET = "chave-do-bucket-das-duas-redes-que-nao-vale-nada";
const TOKEN_DO_LINKEDIN = "AQVautorizacaoDasDuasRedesQueNaoValeNada";
const ENVIO = "9f1c2e3d-0000-4000-8000-0000000002b1";
const ORIGINAL = `${CONTA_A}/foto-do-post.jpg`;
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]);
const COPIA = new RegExp(`^${CONTA_A}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.jpg$`);

const meta = { containers: 0, publicacoes: 0, desconhecidos: [] as string[] };
const linkedin = { pedidos: [] as string[], atrasoMs: 0 };
const bucket = {
  objetos: new Map<string, Uint8Array>(),
  chamadas: [] as string[],
  recusarSubida: false,
};

let servidorFalso: Server;
let acoes: ModuloAcoes;
let redes: ModuloRedes;
let regrasDoLinkedin: ModuloLinkedin;
let publicacao: ModuloPublicacao;

function responder(res: ServerResponse, status: number, corpo: unknown, cabecalhos: Record<string, string> = {}) {
  res.writeHead(status, { "content-type": "application/json", ...cabecalhos });
  res.end(typeof corpo === "string" ? corpo : JSON.stringify(corpo));
}

const esperar = (ms: number) => new Promise((pronto) => setTimeout(pronto, ms));

beforeAll(async () => {
  servidorFalso = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const u = new URL(req.url ?? "/", "http://127.0.0.1");
    const pedacos: Buffer[] = [];
    for await (const parte of req) pedacos.push(parte as Buffer);
    const corpo = Buffer.concat(pedacos);
    const porta = (servidorFalso.address() as AddressInfo).port;
    const depois = (prefixo: string) => decodeURIComponent(u.pathname.slice(prefixo.length));

    // O BUCKET: assinar, subir, baixar pelo endereço público e apagar.
    const assinar = `/storage/v1/object/upload/sign/${BUCKET}/`;
    if (req.method === "POST" && u.pathname.startsWith(assinar)) {
      if (req.headers["apikey"] !== CHAVE_DO_BUCKET) return responder(res, 401, { message: "sem apikey" });
      bucket.chamadas.push(`assinou ${depois(assinar)}`);
      return responder(res, 200, { url: `/object/upload/sign/${BUCKET}/${depois(assinar)}?token=tk`, token: "tk" });
    }
    if (req.method === "PUT" && u.pathname.startsWith(assinar)) {
      bucket.chamadas.push(`subiu ${depois(assinar)}`);
      if (bucket.recusarSubida) return responder(res, 400, { message: "o bucket falso recusou de propósito" });
      bucket.objetos.set(depois(assinar), new Uint8Array(corpo));
      return responder(res, 200, { Key: depois(assinar) });
    }
    const publico = `/storage/v1/object/public/${BUCKET}/`;
    if (req.method === "GET" && u.pathname.startsWith(publico)) {
      bucket.chamadas.push(`baixou ${depois(publico)}`);
      const objeto = bucket.objetos.get(depois(publico));
      if (!objeto) return responder(res, 400, { message: "Object not found" });
      res.writeHead(200, { "content-type": "image/jpeg" });
      return res.end(Buffer.from(objeto));
    }
    const objeto = `/storage/v1/object/${BUCKET}/`;
    if (req.method === "DELETE" && u.pathname.startsWith(objeto)) {
      if (req.headers["apikey"] !== CHAVE_DO_BUCKET) return responder(res, 401, { message: "sem apikey" });
      bucket.chamadas.push(`apagou ${depois(objeto)}`);
      bucket.objetos.delete(depois(objeto));
      return responder(res, 200, { message: "ok" });
    }

    // O LINKEDIN: reservar a imagem, enviá-la e publicar.
    if (u.pathname.startsWith("/rest/") || u.pathname.startsWith("/envio/")) {
      linkedin.pedidos.push(`${req.method} ${u.pathname}`);
      if (linkedin.atrasoMs) await esperar(linkedin.atrasoMs);
      if (req.method === "POST" && u.pathname === "/rest/images") {
        return responder(res, 200, {
          value: { uploadUrl: `http://127.0.0.1:${porta}/envio/C4E10AQduas`, image: "urn:li:image:DasDuasRedes" },
        });
      }
      if (req.method === "PUT" && u.pathname === "/envio/C4E10AQduas") return responder(res, 201, "");
      if (req.method === "POST" && u.pathname === "/rest/posts") {
        return responder(res, 201, "", { "x-restli-id": "urn:li:share:7000000000000000262" });
      }
      return responder(res, 404, { message: "o LinkedIn falso não conhece esse caminho" });
    }

    // A META: o contêiner, a publicação, a cota e o estado do contêiner (sempre pronto).
    const partes = u.pathname.split("/").filter(Boolean);
    const ultimo = partes[partes.length - 1] ?? "";
    if (req.method === "POST" && ultimo === "media") {
      meta.containers++;
      return responder(res, 200, { id: `container-duas-${meta.containers}` });
    }
    if (req.method === "POST" && ultimo === "media_publish") {
      meta.publicacoes++;
      return responder(res, 200, { id: `media-duas-${meta.publicacoes}` });
    }
    if (req.method === "GET" && ultimo === "content_publishing_limit") {
      return responder(res, 200, { config: { quota_total: 100, quota_duration: 86400 }, quota_usage: 0 });
    }
    if (req.method === "GET" && (u.searchParams.get("fields") ?? "").includes("status_code")) {
      return responder(res, 200, { id: ultimo, status_code: "FINISHED" });
    }
    meta.desconhecidos.push(`${req.method} ${u.pathname}`);
    responder(res, 404, { error: { message: `o falso não conhece ${u.pathname}` } });
  });
  await new Promise<void>((pronto) => servidorFalso.listen(0, "127.0.0.1", pronto));
  const base = `http://127.0.0.1:${(servidorFalso.address() as AddressInfo).port}`;
  process.env.LINKEDIN_API_BASE = base;
  process.env.IG_GRAPH_BASE = base;
  process.env.SUPABASE_URL = base;
  process.env.SUPABASE_SERVICE_ROLE_KEY = CHAVE_DO_BUCKET;
  process.env.SUPABASE_BUCKET = BUCKET;
  // Sem token, `scheduleTick` não sai da máquina: o agendado fica na fila do banco de teste.
  delete process.env.QSTASH_TOKEN;

  const fetchDeVerdade = globalThis.fetch;
  vi.stubGlobal("fetch", async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof entrada === "string" ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
    if (url.hostname === "127.0.0.1") return fetchDeVerdade(entrada, init);
    throw new Error(`RECUSADO: este teste não chama ${url.origin}`);
  });

  // AS TRÊS GUARDAS, ANTES DE QUALQUER REQUISIÇÃO: sem os desvios, este teste falaria com as redes de verdade.
  const li = await import("@/lib/linkedin");
  if (li.basesDoLinkedin().api !== base) throw new Error("RECUSADO: a base do LinkedIn não é a desta rodada.");
  const ig = await import("@/lib/ig");
  if (ig.baseDoGraph() !== base) throw new Error("RECUSADO: a base do Graph não é a desta rodada.");
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(process.env.SUPABASE_URL ?? "")) throw new Error("RECUSADO: o bucket não é loopback.");

  acoes = await import("@/app/publicar/actions");
  redes = await import("@/lib/redes-do-post");
  regrasDoLinkedin = await import("@/lib/linkedin-publicacao");
  publicacao = await import("@/lib/publicacao");

  for (const [id, nome] of [
    [CONTA_A, "conta_a_das_duas_redes"],
    [CONTA_B, "conta_b_das_duas_redes"],
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
  // NENHUM GATILHO DE TESTE SOBROU: cada um morre no `finally` do próprio caso.
  const gatilhos = await q(`select tgname from pg_trigger where tgname like 'teste\\_%'`);
  const funcoes = await q(
    `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where p.proname like 'teste\\_%' and n.nspname = current_schema()`
  );
  vi.unstubAllGlobals();
  for (const v of ["LINKEDIN_API_BASE", "IG_GRAPH_BASE", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_BUCKET"]) {
    delete process.env[v];
  }
  await new Promise<void>((pronto) => servidorFalso.close(() => pronto()));
  expect(gatilhos).toEqual([]);
  expect(funcoes).toEqual([]);
});

beforeEach(async () => {
  await q(`delete from queue`);
  await q(`delete from linkedin_conexoes`);
  await conectar(CONTA_A);
  meta.containers = 0;
  meta.publicacoes = 0;
  meta.desconhecidos = [];
  linkedin.pedidos = [];
  linkedin.atrasoMs = 0;
  bucket.objetos = new Map([[ORIGINAL, JPEG]]);
  bucket.chamadas = [];
  bucket.recusarSubida = false;
});

async function conectar(conta: string) {
  await q(
    `insert into linkedin_conexoes (account_id, pessoa_id, nome, access_token, expira_em)
     values ($1, 'pessoaDasDuasRedes', 'Dra. Ana Souza', $2, now() + interval '30 days')
     on conflict (account_id) do update set expira_em = excluded.expira_em`,
    [conta, TOKEN_DO_LINKEDIN]
  );
}

type Linha = { id: string; account_id: string; kind: string; status: string; error: string | null; dedupe_key: string; not_before: Date; payload: Record<string, unknown> };
const linhas = () =>
  q(`select id, account_id, kind, status, error, dedupe_key, not_before, payload from queue order by created_at, kind`) as Promise<Linha[]>;
const daRede = async (kind: string) => (await linhas()).filter((l) => l.kind === kind);

/** Daqui a 2 horas, no minuto cheio, no fuso 0: o agendado que ninguém drena. */
function daquiA2Horas(): Record<string, string> {
  const alvo = new Date(Date.now() + 2 * 3600 * 1000);
  alvo.setUTCSeconds(0, 0);
  return { quando: "depois", data_hora: alvo.toISOString().slice(0, 16), fuso: "0" };
}

/** O formulário como a tela o manda com as duas caixinhas marcadas (app/publicar/enviador.tsx). */
function formulario(campos: Partial<Record<string, string>> = {}): FormData {
  const f = new FormData();
  const tudo: Record<string, string> = {
    forma: "imagem",
    caminhos: ORIGINAL,
    legenda: "A legenda do post #fotografia",
    texto_linkedin: "",
    id_do_envio: ENVIO,
    rede_instagram: "1",
    rede_linkedin: "1",
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

async function nasDuasComoAdministrador(form: FormData) {
  const { valor } = await comoNumaRequisicaoComSessao("/publicar/novo", () => capturar(() => acoes.publicarNasDuasRedes(form)));
  return avisoDoDigest(valor);
}

async function nasDuasComoComum(form: FormData, contas: string[], contaDoCookie?: string) {
  const { valor } = await comoNumaRequisicaoComoComum("/publicar/novo", () => capturar(() => acoes.publicarNasDuasRedes(form)), {
    contas,
    contaDoCookie,
  });
  return avisoDoDigest(valor);
}

/** O GATILHO DE TESTE do caso: nasce, o caso roda, e ele morre no `finally`, mesmo que o caso falhe. */
async function comGatilho(nome: string, momento: "before" | "after", corpoDaFuncao: string, caso: () => Promise<void>) {
  if (!/^teste_[a-z_]+$/.test(nome)) throw new Error(`o gatilho de teste tem de começar com teste_: ${nome}`);
  await q(`create function ${nome}() returns trigger language plpgsql as $$ begin ${corpoDaFuncao} end $$`);
  await q(`create trigger ${nome} ${momento} insert on queue for each row execute function ${nome}()`);
  try {
    await caso();
  } finally {
    await q(`drop trigger if exists ${nome} on queue`);
    await q(`drop function if exists ${nome}()`);
  }
}

const RECUSA_DO_INSTAGRAM = `if new.kind = 'publicacao' then raise exception 'o banco de teste recusou a linha do Instagram'; end if; return new;`;

// ---------------------------------------------------------------------------------------------------------------

describe("publicar agora nas duas redes", () => {
  it("as duas linhas entram e saem: o LinkedIn com a cópia, o Instagram com o original, e o aviso diz as duas", async () => {
    const aviso = await nasDuasComoAdministrador(formulario());
    expect(aviso).toEqual(
      redes.avisoDasDuasRedes({
        tipo: "entrou",
        campos: null,
        instagram: { entrou: true, jaVale: true },
        linkedin: { entrou: true, jaVale: true, desfecho: "publicado" },
      })
    );
    const [ig] = await daRede("publicacao");
    const [li] = await daRede("publicacao_linkedin");
    expect(ig).toMatchObject({ account_id: CONTA_A, status: "sent" });
    expect(li).toMatchObject({ account_id: CONTA_A, status: "sent" });
    expect(ig.payload.caminhos).toEqual([ORIGINAL]);
    expect(ig.payload.legenda).toBe("A legenda do post #fotografia");
    // A CÓPIA: outro caminho, na mesma pasta, no formato do /publicar; e a chave é a do caminho ORIGINAL.
    const [copia] = li.payload.caminhos as string[];
    expect(copia).toMatch(COPIA);
    expect(li.dedupe_key).toBe(`pub-linkedin:${CONTA_A}:imagem:${ORIGINAL}`);
    // Sem o texto próprio, o LinkedIn leva a legenda.
    expect(li.payload.texto).toBe("A legenda do post #fotografia");
    expect(linkedin.pedidos).toEqual(["POST /rest/images", "PUT /envio/C4E10AQduas", "POST /rest/posts"]);
    expect(meta).toMatchObject({ containers: 1, publicacoes: 1, desconhecidos: [] });
    // Cada dreno apagou só o arquivo da própria linha, e nada sobrou no bucket.
    expect(bucket.chamadas).toContain(`apagou ${copia}`);
    expect(bucket.chamadas).toContain(`apagou ${ORIGINAL}`);
    expect([...bucket.objetos.keys()]).toEqual([]);
  });

  it("o LinkedIn sai primeiro, só a própria linha (211), e o Instagram sai depois, no dreno de hoje", async () => {
    await nasDuasComoAdministrador(formulario());
    const [li] = await daRede("publicacao_linkedin");
    const [copia] = li.payload.caminhos as string[];
    // Cada dreno apaga o arquivo da própria linha logo depois do `sent`: a ordem dos apagados é a ordem das saídas.
    expect(bucket.chamadas.filter((c) => c.startsWith("apagou"))).toEqual([`apagou ${copia}`, `apagou ${ORIGINAL}`]);
  });

  it("o mesmo envio de novo, depois do agora: as duas redes dizem que já existia, sem cópia nova e sem baixar nada", async () => {
    await nasDuasComoAdministrador(formulario());
    bucket.chamadas = [];
    linkedin.pedidos = [];
    const aviso = await nasDuasComoAdministrador(formulario());
    expect(aviso).toEqual(redes.avisoDasDuasRedes({ tipo: "entrou", campos: null, instagram: { entrou: false }, linkedin: { entrou: false } }));
    expect(aviso.tom).toBe("erro");
    expect(await linhas()).toHaveLength(2);
    expect(bucket.chamadas).toEqual([]);
    expect(linkedin.pedidos).toEqual([]);
  });

  it("o tempo do agora das duas, com o LinkedIn falso lento (2 s por chamada): as duas saem, e a action termina longe do prazo", async () => {
    linkedin.atrasoMs = 2_000;
    const inicio = Date.now();
    const aviso = await nasDuasComoAdministrador(formulario());
    const levou = Date.now() - inicio;
    console.log(`O AGORA DAS DUAS REDES, com o LinkedIn falso a 2 s por chamada: ${levou} ms`);
    expect(aviso.tom).toBe("ok");
    expect((await linhas()).map((l) => l.status)).toEqual(["sent", "sent"]);
    expect(levou).toBeLessThan(20_000);
  }, 60_000);
});

describe("agendar nas duas redes", () => {
  it("as duas linhas entram pendentes para a mesma hora, ninguém fala com as redes, e a cópia fica para o LinkedIn", async () => {
    const hora = daquiA2Horas();
    const aviso = await nasDuasComoAdministrador(formulario(hora));
    expect(aviso.tom).toBe("ok");
    expect(aviso.texto).toContain("Instagram: Publicação agendada para");
    expect(aviso.texto).toContain("LinkedIn: Post do LinkedIn agendado para");
    const [a, b] = await linhas();
    expect([a.status, b.status]).toEqual(["pending", "pending"]);
    expect(a.not_before.getTime()).toBe(b.not_before.getTime());
    const [li] = await daRede("publicacao_linkedin");
    const [copia] = li.payload.caminhos as string[];
    expect(copia).toMatch(COPIA);
    expect([...bucket.objetos.keys()].sort()).toEqual([ORIGINAL, copia].sort());
    expect(linkedin.pedidos).toEqual([]);
    expect(meta.containers).toBe(0);
  });

  it("o texto próprio vai ao LinkedIn, e a legenda ao Instagram", async () => {
    await nasDuasComoAdministrador(formulario({ ...daquiA2Horas(), texto_linkedin: "  O texto do LinkedIn #carreira  " }));
    expect((await daRede("publicacao_linkedin"))[0].payload.texto).toBe("O texto do LinkedIn #carreira");
    expect((await daRede("publicacao"))[0].payload.legenda).toBe("A legenda do post #fotografia");
  });

  it("o mesmo envio agendado de novo: já existia nas duas, e nenhuma cópia nova sobra", async () => {
    const hora = daquiA2Horas();
    await nasDuasComoAdministrador(formulario(hora));
    const antes = [...bucket.objetos.keys()].sort();
    bucket.chamadas = [];
    const aviso = await nasDuasComoAdministrador(formulario(hora));
    expect(aviso.tom).toBe("erro");
    expect(aviso.texto?.match(/Nada foi duplicado/g)).toHaveLength(2);
    expect(await linhas()).toHaveLength(2);
    expect([...bucket.objetos.keys()].sort()).toEqual(antes);
    expect(bucket.chamadas).toEqual([]);
  });

  it("a chave repetida só no Instagram: o LinkedIn entra, e a tela diz que o Instagram já existia", async () => {
    const hora = daquiA2Horas();
    const soInstagram = new FormData();
    for (const [k, v] of Object.entries({ forma: "imagem", caminhos: ORIGINAL, legenda: "A legenda do post #fotografia", ...hora })) {
      soInstagram.set(k, v);
    }
    await comoNumaRequisicaoComSessao("/publicar/novo", () => capturar(() => acoes.publicar(soInstagram)));
    const aviso = await nasDuasComoAdministrador(formulario(hora));
    expect(aviso.tom).toBe("ok");
    expect(aviso.texto).toContain(`Instagram: ${publicacao.textoDaRecusaDaPublicacao("ja_enfileirado")}`);
    expect(aviso.texto).toContain("LinkedIn: Post do LinkedIn agendado para");
    expect(await daRede("publicacao")).toHaveLength(1);
    expect(await daRede("publicacao_linkedin")).toHaveLength(1);
  });
});

describe("a ordem quando uma parte falha (192 e 199)", () => {
  it("a cópia que falha: nada é gravado, e a tela diz o motivo", async () => {
    bucket.recusarSubida = true;
    const aviso = await nasDuasComoAdministrador(formulario(daquiA2Horas()));
    expect(aviso.tom).toBe("erro");
    expect(aviso.texto).toContain("Nada foi agendado");
    expect(aviso.texto).toContain("HTTP 400");
    expect(await linhas()).toEqual([]);
    expect([...bucket.objetos.keys()]).toEqual([ORIGINAL]);
  });

  it("a linha do LinkedIn que o banco recusa: a cópia sai do bucket, e nada foi agendado", async () => {
    await comGatilho(
      "teste_recusa_o_linkedin",
      "before",
      `if new.kind = 'publicacao_linkedin' then raise exception 'o banco de teste recusou a linha do LinkedIn'; end if; return new;`,
      async () => {
        const aviso = await nasDuasComoAdministrador(formulario(daquiA2Horas()));
        expect(aviso.tom).toBe("erro");
        expect(aviso.texto).toContain("Nada foi agendado");
        expect(await linhas()).toEqual([]);
        expect([...bucket.objetos.keys()]).toEqual([ORIGINAL]);
      }
    );
  });

  it("o conflito na chave do LinkedIn depois da conferência (dois cliques juntos): a cópia sai, e o Instagram segue", async () => {
    await comGatilho(
      "teste_conflito_no_linkedin",
      "before",
      `if new.kind = 'publicacao_linkedin' and pg_trigger_depth() = 1 then
         insert into queue (account_id, kind, payload, dedupe_key, status)
         values (new.account_id, 'publicacao_linkedin', new.payload, new.dedupe_key, 'pending');
       end if;
       return new;`,
      async () => {
        const aviso = await nasDuasComoAdministrador(formulario(daquiA2Horas()));
        expect(aviso.texto).toContain("LinkedIn: O post do LinkedIn já estava na fila. Nada foi duplicado.");
        expect(aviso.texto).toContain("Instagram: Publicação agendada para");
        expect(await daRede("publicacao")).toHaveLength(1);
        expect(await daRede("publicacao_linkedin")).toHaveLength(1);
        expect([...bucket.objetos.keys()]).toEqual([ORIGINAL]);
      }
    );
  });

  it("o Instagram que o banco recusa, com o LinkedIn pendente: o LinkedIn é desfeito, a cópia sai, e nada foi agendado", async () => {
    await comGatilho("teste_recusa_o_instagram", "before", RECUSA_DO_INSTAGRAM, async () => {
      const aviso = await nasDuasComoAdministrador(formulario(daquiA2Horas()));
      expect(aviso).toEqual(redes.avisoDasDuasRedes({ tipo: "instagram_nao_entrou", linkedin: "desfeito" }));
      const [li] = await daRede("publicacao_linkedin");
      expect(li.status).toBe("skipped");
      expect(li.error).toContain("Instagram");
      expect(await daRede("publicacao")).toEqual([]);
      expect([...bucket.objetos.keys()]).toEqual([ORIGINAL]);
    });
  });

  it("o Instagram recusado com o LinkedIn já pego por um dreno: a linha segue, a cópia fica, e a tela diz que ele segue", async () => {
    await comGatilho(
      "teste_dreno_pegou_o_linkedin",
      "after",
      `if new.kind = 'publicacao_linkedin' then update queue set status = 'sending', claimed_at = now() where id = new.id; end if; return null;`,
      () =>
        comGatilho("teste_recusa_o_instagram", "before", RECUSA_DO_INSTAGRAM, async () => {
          const aviso = await nasDuasComoAdministrador(formulario(daquiA2Horas()));
          expect(aviso).toEqual(redes.avisoDasDuasRedes({ tipo: "instagram_nao_entrou", linkedin: "seguiu" }));
          const [li] = await daRede("publicacao_linkedin");
          expect(li.status).toBe("sending");
          const [copia] = li.payload.caminhos as string[];
          expect([...bucket.objetos.keys()].sort()).toEqual([ORIGINAL, copia].sort());
        })
    );
  });

  it("o Instagram recusado com o LinkedIn que já estava na fila antes: ele não é mexido, e nenhuma cópia é feita", async () => {
    const hora = daquiA2Horas();
    const soLinkedin = new FormData();
    for (const [k, v] of Object.entries({ forma_linkedin: "imagem", caminhos: ORIGINAL, texto: "O post do LinkedIn", id_do_envio: ENVIO, ...hora })) {
      soLinkedin.set(k, v);
    }
    await comoNumaRequisicaoComSessao("/publicar/novo", () => capturar(() => acoes.publicarNoLinkedin(soLinkedin)));
    bucket.chamadas = [];
    await comGatilho("teste_recusa_o_instagram", "before", RECUSA_DO_INSTAGRAM, async () => {
      const aviso = await nasDuasComoAdministrador(formulario(hora));
      expect(aviso).toEqual(redes.avisoDasDuasRedes({ tipo: "instagram_nao_entrou", linkedin: "ja_existia" }));
      const [li] = await daRede("publicacao_linkedin");
      expect(li.status).toBe("pending");
      expect(li.payload.caminhos).toEqual([ORIGINAL]);
      expect(bucket.chamadas).toEqual([]);
    });
  });
});

describe("as recusas: nenhuma linha entra, e o bucket e as redes não são chamados", () => {
  const casos: [string, Partial<Record<string, string>>, (t: string | null) => void][] = [
    ["a imagem de outra conta (descartada antes de copiar)", { caminhos: `${CONTA_B}/foto-do-post.jpg` }, (t) => expect(t).toBeTruthy()],
    ["sem a imagem", { caminhos: "" }, (t) => expect(t).toBeTruthy()],
    ["a forma que o LinkedIn ainda não recebe", { forma: "carrossel" }, (t) => expect(t).toContain("próxima entrega")],
    ["o story", { forma: "story" }, (t) => expect(t).toContain("não tem story")],
    ["o texto vazio nas duas (a legenda e o texto próprio)", { legenda: "", texto_linkedin: "  " }, (t) =>
      expect(t).toBe(regrasDoLinkedin.textoDaRecusaNoLinkedin("texto_vazio"))],
    ["o texto próprio longo depois das hashtags", { texto_linkedin: `${"a".repeat(2990)} #ab #cd` }, (t) =>
      expect(t).toBe(regrasDoLinkedin.textoDaRecusaNoLinkedin("texto_longo"))],
    ["o envio sem id", { id_do_envio: "" }, (t) => expect(t).toBe(regrasDoLinkedin.textoDaRecusaNoLinkedin("envio_sem_id"))],
    ["a hora no passado", { quando: "depois", data_hora: "2020-01-01T10:00", fuso: "0" }, (t) => expect(t).toBeTruthy()],
  ];
  for (const [nome, campos, conferir] of casos) {
    it(nome, async () => {
      const aviso = await nasDuasComoAdministrador(formulario(campos));
      expect(aviso.tom).toBe("erro");
      conferir(aviso.texto);
      expect(await linhas()).toEqual([]);
      expect(bucket.chamadas).toEqual([]);
      expect(linkedin.pedidos).toEqual([]);
    });
  }

  it("a conta sem LinkedIn conectado", async () => {
    await q(`delete from linkedin_conexoes`);
    const aviso = await nasDuasComoAdministrador(formulario());
    expect(aviso.tom).toBe("erro");
    expect(aviso.texto).toContain("não tem LinkedIn conectado");
    expect(await linhas()).toEqual([]);
    expect(bucket.chamadas).toEqual([]);
  });
});

describe("a regra das contas: a conta vem da sessão, e nunca do formulário", () => {
  it("o login comum com a conta publica nas duas, nela", async () => {
    const aviso = await nasDuasComoComum(formulario(daquiA2Horas()), [CONTA_A]);
    expect(aviso.tom).toBe("ok");
    expect((await linhas()).map((l) => l.account_id)).toEqual([CONTA_A, CONTA_A]);
  });

  it("o login comum só com outra conta não publica na conta que ele não vê, nem copia a imagem dela", async () => {
    const aviso = await nasDuasComoComum(formulario({ ...daquiA2Horas(), conta: CONTA_A }), [CONTA_B], CONTA_A);
    expect(aviso.tom).toBe("erro");
    expect(await linhas()).toEqual([]);
    expect(bucket.chamadas).toEqual([]);
  });
});
```

As falhas no meio (a linha do LinkedIn que o banco recusa, o conflito na chave depois da conferência, o Instagram que o banco recusa e o dreno que pega a linha no meio) são provocadas por gatilhos de teste no schema descartável. Cada um nasce e morre dentro do caso, num `try/finally`, e o nome começa com `teste_`; o `afterAll` confere que nenhum sobrou.

- [ ] **Passo 2: rodar e ver falhar**

```bash
env -u CLAUDECODE -u AI_AGENT npx --no-install vitest run tests/linkedin-copia.test.ts tests/redes-do-post.test.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" \
  npx --no-install vitest run --config vitest.integracao.config.ts testes-integracao/linkedin-duas-redes.integracao.ts
```

Esperado: 
- nos puros, "Test Files 2 failed (2)" e "Tests 2 failed | 24 passed (26)": `tests/linkedin-copia.test.ts` não acha `@/lib/linkedin-copia`, e caem os dois casos novos do aviso ("o LinkedIn não entrou (a cópia da imagem ou a fila dele falhou): nada foi agendado, com o motivo" e "cada saída tem a sua frase");
- na integração, `ALVO: banco de TESTE` e "Tests 25 failed (25)": a action `publicarNasDuasRedes` ainda não existe.

- [ ] **Passo 3: o código**

Crie `lib/linkedin-copia.ts`:

```ts
import "server-only";
import { apagarObjeto, caminhoDoObjeto, pastaDaConta, urlAssinadaDeUpload, urlPublicaDoObjeto } from "./bucket";
import { caminhosDoCampo } from "./publicacao";

// A CÓPIA DA IMAGEM PARA A LINHA DO LINKEDIN, NO POST DAS DUAS REDES (docs/specs/2026-11-06-linkedin-no-perfil.md, §6;
// a parte 2b). O dreno do Instagram apaga o arquivo da linha dele depois de publicar (`limparOBucket`,
// lib/queue-drain.ts), e o do LinkedIn também: com o mesmo arquivo nas duas linhas, quem saísse primeiro apagaria o
// do outro. Então a linha do LinkedIn leva uma cópia própria.
//
// É A IRMÃ DO `copiarParaAFila` DO GERADOR (lib/bonus/publicar-bucket.ts): as mesmas chamadas que lib/bucket.ts já
// exporta e já mediu (o GET público, a URL assinada e o PUT), sem endpoint novo do Supabase. Ela é outra função
// porque o caminho é outro: a do gerador grava em `<pasta>/bonus-fila/<uuid>.jpg`, e o /publicar lê só
// `<pasta>/<id>.<ext>` (`caminhosDoCampo`, lib/publicacao.ts).

/** O teto da imagem do Instagram (lib/publicacao.ts, `IMAGEM_BYTES_MAX`), o mesmo da cópia do gerador. */
export const TETO_DA_COPIA_BYTES = 8 * 1024 * 1024;

/**
 * O TETO DE TEMPO DE CADA CHAMADA DA CÓPIA, o mesmo do download do bucket no ramo do LinkedIn
 * (`TETO_DO_BUCKET_MS`, lib/linkedin-fila.ts): a cópia roda dentro da action de publicar, e um bucket que não
 * responde não pode prender a tela. Ele vale também para a assinatura, que é do lib/bucket.ts e não tem teto
 * próprio: o teto é de quem chama (nota da auditoria sobre a F2).
 */
export const TETO_DA_COPIA_MS = 10_000;

/**
 * UMA CHAMADA COM TETO, pelo relógio da função (e não pelo `AbortSignal.timeout`, que o teste não consegue
 * adiantar). Estourado o teto, a cópia lança na hora, e o sinal desiste da chamada que ainda estiver pendurada.
 */
function comTeto<T>(fazer: (sinal: AbortSignal) => Promise<T>, oQue: string): Promise<T> {
  const controle = new AbortController();
  let relogio: ReturnType<typeof setTimeout> | undefined;
  const estouro = new Promise<never>((_, falhar) => {
    relogio = setTimeout(() => {
      falhar(new Error(`o armazenamento não respondeu em ${TETO_DA_COPIA_MS / 1000} s ${oQue}`));
      controle.abort();
    }, TETO_DA_COPIA_MS);
  });
  return Promise.race([fazer(controle.signal), estouro]).finally(() => clearTimeout(relogio));
}

/**
 * COPIA A IMAGEM DO POST PARA UM CAMINHO NOVO NA MESMA PASTA, e devolve o caminho da cópia.
 *
 * A ORIGEM TEM DE SER DA CONTA QUE PUBLICA, na forma dos caminhos do /publicar, e isso é conferido ANTES de
 * qualquer chamada: a action já filtrou o caminho pela pasta da conta do cookie, e esta é a segunda barreira, para
 * a cópia nunca ler o arquivo de outra conta. Lança com a frase do que falhou; a URL assinada nunca entra na
 * frase, porque o token vai nela.
 */
export async function copiarImagemParaOLinkedin(origem: string, conta: string, uuid: string = crypto.randomUUID()): Promise<string> {
  const pasta = pastaDaConta(conta);
  const conferidos = caminhosDoCampo(origem, pasta);
  if (conferidos.length !== 1 || conferidos[0] !== origem) throw new Error("a imagem não é desta conta");

  const bytes = await comTeto(async (sinal) => {
    const baixada = await fetch(urlPublicaDoObjeto(origem), { cache: "no-store", signal: sinal });
    if (!baixada.ok) throw new Error(`a imagem não foi encontrada no armazenamento (HTTP ${baixada.status})`);
    return new Uint8Array(await baixada.arrayBuffer());
  }, "ao baixar a imagem");
  if (bytes.length === 0 || bytes.length > TETO_DA_COPIA_BYTES) {
    throw new Error(`a imagem tem um tamanho que não dá para copiar (${bytes.length} bytes)`);
  }

  const destino = caminhoDoObjeto(conta, "copia.jpg", uuid, "image/jpeg");
  const { url } = await comTeto(() => urlAssinadaDeUpload(destino), "ao assinar a cópia");
  await comTeto(async (sinal) => {
    const subida = await fetch(url, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: bytes, signal: sinal });
    if (!subida.ok) throw new Error(`o armazenamento recusou a cópia (HTTP ${subida.status})`);
  }, "ao subir a cópia");
  return destino;
}

/**
 * APAGA A CÓPIA QUE NÃO VAI SER USADA (a nota 2 da auditoria sobre a F2): a linha do LinkedIn não entrou, ou foi
 * desfeita. Sem derrubar quem chama, como o `apagarSemDerrubar` do gerador: a recusa ou o desfecho já foram
 * decididos, e uma cópia que fica no bucket não quebra nada.
 */
export async function apagarACopiaSemDerrubar(caminho: string): Promise<void> {
  try {
    await apagarObjeto(caminho);
  } catch {
    // Fica no bucket sem dono; o aviso da tela já diz o que aconteceu com o post.
  }
}
```

Em `lib/linkedin-fila.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/linkedin-fila.ts b/lib/linkedin-fila.ts
index f8a7e64..50084ff 100644
--- a/lib/linkedin-fila.ts
+++ b/lib/linkedin-fila.ts
@@ -46,11 +46,16 @@ import {
  * A CHAVE (lib/dedupe.ts, `chaveDaPublicacaoNoLinkedin`): a imagem pela conta e pelo caminho, que é único por
  * upload; o só texto pela conta e pelo id do envio, que a tela gera uma vez por formulário. O mesmo clique
  * repetido não entra duas vezes; o mesmo texto num envio novo entra.
+ *
+ * NO POST DAS DUAS REDES (a parte 2b), a linha leva a CÓPIA da imagem (lib/linkedin-copia.ts), e a chave sai do
+ * caminho ORIGINAL (`caminhosDaChave`): cada envio faz uma cópia nova, e a chave pela cópia deixaria o mesmo clique
+ * repetido entrar de novo, num segundo post.
  */
 export async function enqueuePublicacaoNoLinkedin(
   accountId: string,
   pedido: { forma: FormaNoLinkedin; caminhos: string[]; texto: string; idDoEnvio: string },
-  quando: Date | null
+  quando: Date | null,
+  opcoes: { caminhosDaChave?: string[] } = {}
 ): Promise<ResultadoDoLinkedin> {
   const payload = payloadDoLinkedin(pedido);
   // AS MESMAS RECUSAS DA TELA E DA ACTION (`recusaDoPedidoNoLinkedin`), sobre o texto já aparado do payload.
@@ -64,7 +69,7 @@ export async function enqueuePublicacaoNoLinkedin(
      returning id,
                (not_before <= now()) as ja_vale,
                greatest(0, ceil(extract(epoch from (not_before - now()))))::int as falta`,
-    [accountId, payload, chaveDaPublicacaoNoLinkedin(accountId, pedido.forma, pedido.caminhos, pedido.idDoEnvio), quando]
+    [accountId, payload, chaveDaPublicacaoNoLinkedin(accountId, pedido.forma, opcoes.caminhosDaChave ?? pedido.caminhos, pedido.idDoEnvio), quando]
   )) as { id: string; ja_vale: boolean; falta: number }[];
   if (!linhas.length) return { entrou: false };
   const { id, ja_vale: jaVale, falta } = linhas[0];
@@ -83,6 +88,40 @@ export async function enqueuePublicacaoNoLinkedin(
   return { entrou: true, jaVale, falta, id };
 }
 
+/**
+ * A CHAVE DO LINKEDIN JÁ ESTÁ NA FILA? (o post das duas redes, a parte 2b). É conferida ANTES da cópia: depois de um
+ * "agora", o dreno do Instagram apaga o original, e o mesmo envio repetido tem de dar "já existia", e não uma cópia
+ * de um arquivo que não existe mais. Dois cliques juntos podem passar os dois por aqui; o `on conflict` do
+ * enfileirar segura o segundo, e quem chama apaga a cópia que sobrou.
+ */
+export async function aChaveDoLinkedinJaExiste(
+  accountId: string,
+  pedido: { forma: FormaNoLinkedin; caminhos: string[]; idDoEnvio: string }
+): Promise<boolean> {
+  const linhas = (await sql().query(`select 1 from queue where dedupe_key = $1 limit 1`, [
+    chaveDaPublicacaoNoLinkedin(accountId, pedido.forma, pedido.caminhos, pedido.idDoEnvio),
+  ])) as unknown[];
+  return linhas.length > 0;
+}
+
+export const MOTIVO_DESFEITO_PELO_INSTAGRAM =
+  "o post das duas redes não entrou na fila do Instagram, e este foi desfeito antes de sair";
+
+/**
+ * DESFAZ A LINHA DO LINKEDIN DO POST DAS DUAS REDES, quando a do Instagram não entrou (achado 192). SÓ A LINHA
+ * AINDA PENDENTE (achado 199): se um dreno já a pegou, ela segue, e quem chama não apaga a cópia, que ela usa.
+ * Devolve se desfez.
+ */
+export async function desfazerLinhaDoLinkedin(id: string): Promise<boolean> {
+  const linhas = (await sql().query(
+    `update queue set status = 'skipped', error = $2
+      where id = $1 and kind = 'publicacao_linkedin' and status = 'pending'
+      returning id`,
+    [id, MOTIVO_DESFEITO_PELO_INSTAGRAM]
+  )) as unknown[];
+  return linhas.length > 0;
+}
+
 /** O motivo gravado numa linha da fila, para o aviso do "agora" que não saiu. */
 export async function erroDaLinha(id: string): Promise<string | null> {
   const [linha] = (await sql().query(`select error from queue where id = $1`, [id])) as { error: string | null }[];
```

Em `lib/redes-do-post.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/redes-do-post.ts b/lib/redes-do-post.ts
index b2cc35c..38f71ff 100644
--- a/lib/redes-do-post.ts
+++ b/lib/redes-do-post.ts
@@ -107,11 +107,14 @@ export type LadoDoLinkedin =
  * O QUE ACONTECEU NO ENFILEIRAR DAS DUAS REDES (spec, §6; achados 192 e 199):
  *   - "entrou": as duas linhas foram tentadas, e cada lado diz o seu;
  *   - "instagram_nao_entrou": o enfileirar do Instagram lançou, e o LinkedIn foi desfeito (estava pendente), ou
- *     seguiu (um dreno já o tinha pego), ou já estava na fila antes deste envio (e não foi mexido).
+ *     seguiu (um dreno já o tinha pego), ou já estava na fila antes deste envio (e não foi mexido);
+ *   - "linkedin_nao_entrou": a cópia da imagem ou o enfileirar do LinkedIn falhou, antes de a linha do Instagram
+ *     ser tentada. Nada foi gravado, e a cópia que chegou a existir saiu do bucket.
  */
 export type DesfechoDasDuasRedes =
   | { tipo: "entrou"; campos: Campos | null; instagram: LadoDoInstagram; linkedin: LadoDoLinkedin }
-  | { tipo: "instagram_nao_entrou"; linkedin: "desfeito" | "seguiu" | "ja_existia" };
+  | { tipo: "instagram_nao_entrou"; linkedin: "desfeito" | "seguiu" | "ja_existia" }
+  | { tipo: "linkedin_nao_entrou"; motivo: string };
 
 const JA_EXISTIA_NO_LINKEDIN = "O post do LinkedIn já estava na fila. Nada foi duplicado.";
 
@@ -121,6 +124,9 @@ const JA_EXISTIA_NO_LINKEDIN = "O post do LinkedIn já estava na fila. Nada foi
  * de erro quando o LinkedIn não saiu, quando nada de novo entrou, e em toda saída em que o Instagram não entrou.
  */
 export function avisoDasDuasRedes(d: DesfechoDasDuasRedes): Aviso {
+  if (d.tipo === "linkedin_nao_entrou") {
+    return { tom: "erro", texto: `Nada foi agendado: o post não pôde ser preparado para o LinkedIn (${d.motivo}). Tente de novo.` };
+  }
   if (d.tipo === "instagram_nao_entrou") {
     switch (d.linkedin) {
       case "desfeito":
```

Em `app/publicar/actions.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/publicar/actions.ts b/app/publicar/actions.ts
index a916999..dbbbb2d 100644
--- a/app/publicar/actions.ts
+++ b/app/publicar/actions.ts
@@ -29,8 +29,18 @@ import {
   recusaDoPedidoNoLinkedin,
   textoDaRecusaNoLinkedin,
 } from "@/lib/linkedin-publicacao";
-import { enqueuePublicacaoNoLinkedin, erroDaLinha } from "@/lib/linkedin-fila";
+import {
+  aChaveDoLinkedinJaExiste,
+  desfazerLinhaDoLinkedin,
+  enqueuePublicacaoNoLinkedin,
+  erroDaLinha,
+  type ResultadoDoLinkedin,
+} from "@/lib/linkedin-fila";
 import { armarOTiqueDaLinha, drenarUmaPublicacaoDoLinkedin } from "@/lib/queue-drain";
+// O POST DAS DUAS REDES (a parte 2b): as regras puras das duas, e a cópia da imagem para a linha do LinkedIn.
+import { avisoDasDuasRedes, redeAceitaAForma, textoQueVaiAoLinkedin } from "@/lib/redes-do-post";
+import { apagarACopiaSemDerrubar, copiarImagemParaOLinkedin } from "@/lib/linkedin-copia";
+import type { ResultadoDaPublicacao } from "@/lib/engine";
 
 /**
  * Enfileira uma publicação para a conta selecionada.
@@ -272,3 +282,178 @@ export async function publicarNoLinkedin(formData: FormData): Promise<void> {
   revalidatePath("/eventos");
   redirect(urlDePublicarComAviso(avisoDoPostNoLinkedin({ desfecho, motivo, agendadoPara: r.jaVale ? null : campos })));
 }
+
+/**
+ * O POST DE IMAGEM NAS DUAS REDES, Instagram e LinkedIn, para a conta selecionada (docs/specs/2026-11-06-linkedin-
+ * no-perfil.md, §6 e §7; a parte 2b). Uma linha por rede, cada uma com a sua chave, o seu andamento e as suas
+ * tentativas: se uma rede falhar ao publicar, a outra segue.
+ *
+ * AS MESMAS REGRAS DAS DUAS ACTIONS DE CIMA: a sessão primeiro; nenhuma saída muda; a conta da regra das contas, e
+ * nunca do formulário; os caminhos pela pasta dessa conta; a conexão e o pedido do LinkedIn conferidos de novo
+ * aqui, pelas mesmas funções da tela.
+ *
+ * A ORDEM, QUANDO UMA PARTE FALHA NO MEIO (achado 192, com o ajuste da auditoria de 10/11):
+ *   1. todas as conferências, sem gravar nada;
+ *   2. a chave do LinkedIn já está na fila? Então ele "já existia", e não há cópia (depois de um "agora", o dreno do
+ *      Instagram já apagou o original, e copiar falharia);
+ *   3. a cópia da imagem para a linha do LinkedIn (lib/linkedin-copia.ts). Se falha, nada é gravado;
+ *   4. a linha do LinkedIn, com a cópia, e a chave pelo caminho ORIGINAL. Se ela não entra (o banco recusou, ou a
+ *      chave apareceu entre a conferência e o insert), a cópia sai, e nada é gravado;
+ *   5. a linha do Instagram, pelo `enqueuePublicacao` de hoje, sem mudança. Se ele LANÇA, a do LinkedIn é desfeita
+ *      só se ainda estiver pendente (achado 199), e só então a cópia sai; um dreno que já a pegou segue com ela.
+ *      A chave do Instagram que já existia não é falha: a tela diz que ele já estava na fila.
+ *
+ * O "AGORA" (a escolha (a) da auditoria): primeiro o LinkedIn, só a própria linha (`drenarUmaPublicacaoDoLinkedin`,
+ * achado 211), que só começa o passo que tem tempo de terminar; depois o dreno de hoje para o Instagram, com o
+ * mesmo começo da função, para outra linha do LinkedIn que ele pegue respeitar o prazo. O dreno não muda nesta
+ * entrega.
+ */
+export async function publicarNasDuasRedes(formData: FormData): Promise<void> {
+  await exigirSessao();
+  const inicioDaFuncaoMs = Date.now();
+  const conta = await getSelectedAccount();
+  if (!conta) {
+    redirect(urlDePublicarComAviso({ tom: "erro", texto: textoDaRecusaDaPublicacao("sem_conta") }));
+  }
+
+  // 1. AS CONFERÊNCIAS, sem gravar nada.
+  const disponivel = disponibilidadeDoLinkedin(await resumoDaConexao(conta.ig_user_id), Date.now());
+  if (!disponivel.disponivel) {
+    redirect(urlDePublicarComAviso({ tom: "erro", texto: disponivel.motivo }));
+  }
+
+  // NESTA ENTREGA, AS DUAS REDES JUNTAS SÓ NA IMAGEM: o carrossel e o vídeo chegam ao LinkedIn na parte 3, e o story
+  // não existe lá. O motivo é o mesmo que a tela mostra na caixinha desligada.
+  const forma = formaQueATelaPublica(formData.get("forma"));
+  if (forma !== "imagem") {
+    redirect(
+      urlDePublicarComAviso({
+        tom: "erro",
+        texto: (forma && redeAceitaAForma("linkedin", forma)) || textoDaRecusaDaPublicacao("forma_desconhecida"),
+      })
+    );
+  }
+
+  const caminhos = caminhosDoCampo(formData.get("caminhos"), pastaDaConta(conta.ig_user_id));
+  const quantidade = recusaDaQuantidade(forma, caminhos.length);
+  if (quantidade) {
+    redirect(urlDePublicarComAviso({ tom: "erro", texto: textoDaRecusaDaPublicacao(quantidade) }));
+  }
+
+  const legenda = String(formData.get("legenda") ?? "").trim();
+  const problema = problemaDaLegenda(legenda);
+  if (problema) {
+    redirect(urlDePublicarComAviso({ tom: "erro", texto: textoDoProblemaDaLegenda(problema) }));
+  }
+
+  // O TEXTO DO LINKEDIN: o próprio, quando há; sem ele, a legenda. Contado pela mesma função do contador (212).
+  const texto = textoQueVaiAoLinkedin({ legenda, textoProprio: String(formData.get("texto_linkedin") ?? "") });
+  const idDoEnvio = String(formData.get("id_do_envio") ?? "");
+  const recusa = recusaDoPedidoNoLinkedin({ forma, caminhos, texto, idDoEnvio });
+  if (recusa) {
+    redirect(urlDePublicarComAviso({ tom: "erro", texto: textoDaRecusaNoLinkedin(recusa) }));
+  }
+
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
+  // 2 A 4. O LINKEDIN: a chave, a cópia e a linha.
+  const pedidoDoLinkedin = { forma, caminhos, texto, idDoEnvio };
+  let linkedin: ResultadoDoLinkedin = { entrou: false };
+  let copia: string | null = null;
+  if (!(await aChaveDoLinkedinJaExiste(conta.ig_user_id, pedidoDoLinkedin))) {
+    let falhaDoLinkedin: string | null = null;
+    try {
+      copia = await copiarImagemParaOLinkedin(caminhos[0], conta.ig_user_id);
+    } catch (e) {
+      falhaDoLinkedin = e instanceof Error ? e.message : "a cópia da imagem falhou";
+    }
+    if (copia) {
+      try {
+        linkedin = await enqueuePublicacaoNoLinkedin(
+          conta.ig_user_id,
+          { ...pedidoDoLinkedin, caminhos: [copia] },
+          momento.quando,
+          { caminhosDaChave: caminhos }
+        );
+      } catch {
+        falhaDoLinkedin = "a fila do LinkedIn não respondeu";
+      }
+      // A CÓPIA QUE NÃO VAI SER USADA SAI: o banco recusou a linha, ou a chave apareceu entre a conferência e o
+      // insert (dois cliques juntos). No segundo caso, o LinkedIn "já existia", e o Instagram segue.
+      if (!linkedin.entrou) {
+        await apagarACopiaSemDerrubar(copia);
+        copia = null;
+      }
+    }
+    if (falhaDoLinkedin) {
+      redirect(urlDePublicarComAviso(avisoDasDuasRedes({ tipo: "linkedin_nao_entrou", motivo: falhaDoLinkedin })));
+    }
+  }
+
+  // 5. O INSTAGRAM, pelo enfileirar de hoje. Se ele lança, a compensação do 192 e do 199.
+  let instagram: ResultadoDaPublicacao | null = null;
+  try {
+    instagram = await enqueuePublicacao(conta.ig_user_id, { forma, caminhos, legenda: legenda || undefined }, momento.quando);
+  } catch {
+    instagram = null;
+  }
+  if (!instagram) {
+    let lado: "desfeito" | "seguiu" | "ja_existia" = "ja_existia";
+    if (linkedin.entrou) {
+      let desfeita = false;
+      try {
+        desfeita = await desfazerLinhaDoLinkedin(linkedin.id);
+      } catch {
+        // Sem a resposta do banco, a linha continua como estava: pendente, ela sai sozinha. A cópia fica.
+      }
+      lado = desfeita ? "desfeito" : "seguiu";
+      if (desfeita && copia) await apagarACopiaSemDerrubar(copia);
+    }
+    redirect(urlDePublicarComAviso(avisoDasDuasRedes({ tipo: "instagram_nao_entrou", linkedin: lado })));
+  }
+
+  // 6. O "AGORA": o LinkedIn primeiro, só a própria linha; depois o dreno de hoje, para o Instagram.
+  let desfecho: "publicado" | "aguardando" | "falhou" | null = null;
+  let motivo: string | null = null;
+  if (linkedin.entrou && linkedin.jaVale) {
+    try {
+      desfecho = await drenarUmaPublicacaoDoLinkedin(linkedin.id, inicioDaFuncaoMs);
+      if (desfecho === "falhou") motivo = await erroDaLinha(linkedin.id);
+    } catch {
+      // O mesmo `catch` do `publicarNoLinkedin`: a linha pode ter ficado pendente sem tique, e este tique é o que
+      // faz o "vai sair em instantes" ser verdade.
+      desfecho = null;
+      await armarOTiqueDaLinha(linkedin.id);
+    }
+  }
+  if (instagram.entrou && instagram.jaVale) {
+    try {
+      await drainQueue({ inicioDaFuncaoMs });
+    } catch {
+      // O mesmo `catch` do `publicar`: a trava atômica garante que o próximo dreno recupera.
+    }
+  }
+
+  revalidatePath("/publicar/novo");
+  revalidatePath("/publicar");
+  revalidatePath("/eventos");
+  redirect(
+    urlDePublicarComAviso(
+      avisoDasDuasRedes({
+        tipo: "entrou",
+        campos,
+        instagram: instagram.entrou ? { entrou: true, jaVale: instagram.jaVale } : { entrou: false },
+        linkedin: linkedin.entrou ? { entrou: true, jaVale: linkedin.jaVale, desfecho, motivo } : { entrou: false },
+      })
+    )
+  );
+}
```

- [ ] **Passo 4: rodar e ver passar**

```bash
env -u CLAUDECODE -u AI_AGENT npx --no-install vitest run
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" \
  npx --no-install vitest run --config vitest.integracao.config.ts testes-integracao/linkedin-duas-redes.integracao.ts \
  testes-integracao/linkedin-publicacao.integracao.ts testes-integracao/linkedin-compor.integracao.ts \
  testes-integracao/publicar-fala.integracao.ts testes-integracao/tique-do-rodape.integracao.ts
npx --no-install tsc --noEmit
npx --no-install eslint app/publicar/actions.ts lib/linkedin-copia.ts lib/linkedin-fila.ts lib/redes-do-post.ts \
  tests/linkedin-copia.test.ts tests/redes-do-post.test.ts testes-integracao/linkedin-duas-redes.integracao.ts
git diff --stat 58cc3db -- lib/queue-drain.ts lib/bucket.ts lib/engine.ts   # vazio
```

Esperado: nos puros, "Test Files 157 passed (157)" e "Tests 3751 passed (3751)"; na integração, `ALVO: banco de TESTE`, "Test Files 5 passed (5)" e "Tests 106 passed (106)", o `tsc` e o lint sem saída, e o último comando vazio.

O tempo do "agora" das duas, medido com os falsos: no ensaio, com o reporter detalhado, o caso normal ("as duas linhas entram e saem…") levou 884 ms, e o caso com o LinkedIn falso a 2 s por chamada (três chamadas) levou 6 216 ms, com as duas linhas `sent` (o caso "o tempo do agora das duas…" imprime o número). O pior caso teórico é o do ramo do LinkedIn inteiro (os tetos somam 45 s) mais a imagem do Instagram (~7 s numa passada, medido na produção pela auditoria), dentro dos 55 s do orçamento da função.

- [ ] **Passo 5: o commit**

A mensagem do commit, gravada em `$SCRATCH/msg-li2b-f2.txt`:

```text
O post de imagem sai nas duas redes, com a cópia para o LinkedIn, e a rede que não entra desfaz a outra só enquanto ela espera
```

```bash
git add -- app/publicar/actions.ts lib/linkedin-copia.ts lib/linkedin-fila.ts lib/redes-do-post.ts \
  tests/linkedin-copia.test.ts tests/redes-do-post.test.ts testes-integracao/linkedin-duas-redes.integracao.ts
git commit -F "$SCRATCH/msg-li2b-f2.txt"
```

---

### FASE 3 — A tela de publicar com as caixinhas

**Arquivos:** `app/publicar/enviador.tsx`, `app/publicar/novo/page.tsx`, `lib/redes-do-post.ts`, `testes-dom/publicar-compositor-linkedin.dom.tsx`, `tests/publicar-compositor-guarda.test.ts`, `tests/redes-do-post.test.ts`.

- [ ] **Passo 1: os testes**

Em `tests/redes-do-post.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/redes-do-post.test.ts b/tests/redes-do-post.test.ts
index cece365..0020202 100644
--- a/tests/redes-do-post.test.ts
+++ b/tests/redes-do-post.test.ts
@@ -2,6 +2,7 @@ import { describe, expect, it } from "vitest";
 import {
   CAIXINHAS_DE_PARTIDA,
   NOTA_DA_LEGENDA_NO_LINKEDIN,
+  TEXTO_SEM_REDE,
   avisoDasDuasRedes,
   estadoDasCaixinhas,
   formasDaTela,
@@ -94,6 +95,12 @@ describe("as caixinhas", () => {
 });
 
 describe("as redes do pedido", () => {
+  it("sem nenhuma rede marcada, a tela diz para marcar uma", () => {
+    expect(TEXTO_SEM_REDE).toContain("Marque");
+    expect(TEXTO_SEM_REDE).toContain("Instagram");
+    expect(TEXTO_SEM_REDE).toContain("LinkedIn");
+  });
+
   it("só o valor '1' marca a rede", () => {
     expect(redesDoPedido({ instagram: "1", linkedin: null })).toEqual({ instagram: true, linkedin: false });
     expect(redesDoPedido({ instagram: "1", linkedin: "1" })).toEqual(as2);
```

Em `testes-dom/publicar-compositor-linkedin.dom.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-dom/publicar-compositor-linkedin.dom.tsx b/testes-dom/publicar-compositor-linkedin.dom.tsx
index 4ce3aed..40d8e4a 100644
--- a/testes-dom/publicar-compositor-linkedin.dom.tsx
+++ b/testes-dom/publicar-compositor-linkedin.dom.tsx
@@ -9,11 +9,15 @@ import {
   textoDaRecusaNoLinkedin,
   type DisponibilidadeDoLinkedin,
 } from "@/lib/linkedin-publicacao";
+import { rotuloDaForma } from "@/lib/publicacao";
+import { NOTA_DA_LEGENDA_NO_LINKEDIN, redeAceitaAForma, TEXTO_SEM_REDE } from "@/lib/redes-do-post";
 
-// O COMPOR DO POST NO LINKEDIN (docs/specs/2026-11-06-linkedin-no-perfil.md, §7; a parte 2a: uma rede por post).
-// A tela escolhe a rede; no LinkedIn, a forma é "Só texto" ou "Imagem", o campo é "Texto" com o contador que conta
-// como o LinkedIn (achado 212), e o clique chama a action do LinkedIn, e só ela. O navegador e as actions são
-// falsos, como no teste do compositor (testes-dom/publicar-compositor.dom.tsx).
+// O COMPOR COM AS DUAS REDES (docs/specs/2026-11-06-linkedin-no-perfil.md, §7; a parte 2b). A tela tem as caixinhas
+// "Instagram" e "LinkedIn", que começam só com o Instagram marcado (a decisão do Eduardo, 10/11). Cada forma liga e
+// desliga as redes, com o motivo: o só texto é só do LinkedIn, e o carrossel, o reels e o story não vão ao LinkedIn
+// nesta entrega. Só no LinkedIn, o campo é o "Texto" da parte 2a; nas duas, a "Legenda" e o "Texto para o LinkedIn",
+// opcional. O clique chama a action das redes marcadas, e só ela. O navegador e as actions são falsos, como no
+// teste do compositor (testes-dom/publicar-compositor.dom.tsx).
 
 const MIB = 1024 * 1024;
 const PASTA = "17841400000000002";
@@ -58,6 +62,7 @@ function renderizar(linkedin: DisponibilidadeDoLinkedin | null) {
   const { f, nav } = navegadorFalso();
   const acao = vi.fn(async (_dados: FormData) => {});
   const acaoDoLinkedin = vi.fn(async (_dados: FormData) => {});
+  const acaoDasDuasRedes = vi.fn(async (_dados: FormData) => {});
   render(
     <Enviador
       teto={50 * MIB}
@@ -65,52 +70,142 @@ function renderizar(linkedin: DisponibilidadeDoLinkedin | null) {
       acao={acao}
       linkedin={linkedin}
       acaoDoLinkedin={acaoDoLinkedin}
+      acaoDasDuasRedes={acaoDasDuasRedes}
       navegador={nav}
       quando={QUANDO}
       opcoesDoReels={<p>opções do reels</p>}
       rodape={<p>rodapé</p>}
     />
   );
-  return { f, acao, acaoDoLinkedin };
+  return { f, acao, acaoDoLinkedin, acaoDasDuasRedes };
 }
 
 const botao = () => screen.getByRole("button", { name: /^(Publicar|Enviando…)$/ }) as HTMLButtonElement;
+const caixinha = (rede: "Instagram" | "LinkedIn") => screen.getByLabelText(rede) as HTMLInputElement;
 const campoDoTexto = () => screen.getByLabelText("Texto") as HTMLTextAreaElement;
+const campoDaLegenda = () => screen.getByLabelText("Legenda") as HTMLTextAreaElement;
+const campoDoTextoProprio = () => screen.getByLabelText("Texto para o LinkedIn (opcional)") as HTMLTextAreaElement;
+const escolherForma = (valor: string) => fireEvent.change(screen.getByLabelText("Forma"), { target: { value: valor } });
+
+async function escolherAImagem() {
+  await act(async () => {
+    fireEvent.change(screen.getByLabelText("Arquivo"), {
+      target: { files: [new File([new Uint8Array(1000)], "arte.jpg", { type: "image/jpeg" })] },
+    });
+  });
+  await waitFor(() => expect(screen.queryByText("Lendo o arquivo…")).toBeNull());
+}
+
+async function clicarEmPublicar() {
+  await act(async () => {
+    fireEvent.click(botao());
+  });
+}
 
 afterEach(() => {
   limparEnvios();
   vi.restoreAllMocks();
 });
 
-describe("a rede do post", () => {
-  it("sem o LinkedIn na página, a tela é só do Instagram, como antes", () => {
+describe("as caixinhas das redes", () => {
+  it("sem o LinkedIn na página, a tela é só do Instagram, como antes: sem caixinhas e sem o só texto", () => {
     renderizar(null);
     expect(screen.queryByLabelText("LinkedIn")).toBeNull();
-    expect(screen.getByLabelText("Legenda")).toBeTruthy();
+    expect(screen.queryByLabelText("Instagram")).toBeNull();
+    expect(campoDaLegenda()).toBeTruthy();
+    const forma = screen.getByLabelText("Forma") as HTMLSelectElement;
+    expect(Array.from(forma.options).map((o) => o.value)).toEqual(["imagem", "carrossel", "reels", "story"]);
   });
 
-  it("o LinkedIn desligado aparece desligado, com o motivo", () => {
+  it("com o LinkedIn ligado, começam só com o Instagram marcado, e a tela diz em qual perfil o LinkedIn sai", () => {
+    renderizar(LIGADO);
+    expect(caixinha("Instagram").checked).toBe(true);
+    expect(caixinha("LinkedIn").checked).toBe(false);
+    expect(caixinha("LinkedIn").disabled).toBe(false);
+    expect(screen.getByText(/No LinkedIn, o post sai no perfil de Dra\. Ana Souza\./)).toBeTruthy();
+    expect(campoDaLegenda()).toBeTruthy();
+  });
+
+  it("o LinkedIn desligado (sem conexão) aparece desligado, com o motivo, e não há o só texto", () => {
     renderizar({ disponivel: false, motivo: "Esta conta não tem LinkedIn conectado." });
-    expect((screen.getByLabelText("LinkedIn") as HTMLInputElement).disabled).toBe(true);
+    expect(caixinha("LinkedIn").disabled).toBe(true);
+    expect(caixinha("LinkedIn").checked).toBe(false);
     expect(screen.getByText("Esta conta não tem LinkedIn conectado.")).toBeTruthy();
+    const forma = screen.getByLabelText("Forma") as HTMLSelectElement;
+    expect(Array.from(forma.options).map((o) => o.value)).not.toContain("texto");
+  });
+
+  it("o carrossel, o reels e o story desligam e desmarcam o LinkedIn, com o motivo da forma", () => {
+    renderizar(LIGADO);
+    fireEvent.click(caixinha("LinkedIn"));
+    expect(caixinha("LinkedIn").checked).toBe(true);
+    for (const forma of ["carrossel", "reels", "story"] as const) {
+      escolherForma(forma);
+      expect(caixinha("LinkedIn").disabled).toBe(true);
+      expect(caixinha("LinkedIn").checked).toBe(false);
+      expect(screen.getByText(redeAceitaAForma("linkedin", forma) as string)).toBeTruthy();
+      expect(caixinha("Instagram").checked).toBe(true);
+    }
+    // VOLTAR À IMAGEM NÃO REMARCA O LINKEDIN SOZINHO: o post sai público no perfil pessoal, e só vai quem marcar.
+    escolherForma("imagem");
+    expect(caixinha("LinkedIn").disabled).toBe(false);
+    expect(caixinha("LinkedIn").checked).toBe(false);
   });
 
-  it("no LinkedIn: as formas dele, o campo Texto, nada de arquivo no só texto e nada do reels", () => {
+  it("o só texto desliga o Instagram, com o motivo, e não tem arquivo", () => {
     renderizar(LIGADO);
-    fireEvent.click(screen.getByLabelText("LinkedIn"));
     const forma = screen.getByLabelText("Forma") as HTMLSelectElement;
-    expect(Array.from(forma.options).map((o) => o.textContent)).toEqual(["Só texto", "Imagem"]);
-    expect(campoDoTexto()).toBeTruthy();
+    expect(Array.from(forma.options).map((o) => o.textContent)).toEqual([
+      rotuloDaForma("imagem"),
+      rotuloDaForma("carrossel"),
+      rotuloDaForma("reels"),
+      rotuloDaForma("story"),
+      "Só texto",
+    ]);
+    escolherForma("texto");
+    expect(caixinha("Instagram").disabled).toBe(true);
+    expect(caixinha("Instagram").checked).toBe(false);
+    expect(screen.getByText(redeAceitaAForma("instagram", "texto") as string)).toBeTruthy();
     expect(screen.queryByLabelText(/^Arquivos?$/)).toBeNull();
-    expect(screen.queryByText("opções do reels")).toBeNull();
-    expect(screen.getByText(/Dra\. Ana Souza/)).toBeTruthy();
+  });
+
+  it("sem nenhuma rede marcada, o clique é recusado na tela, sem chamar nada", async () => {
+    const { acao, acaoDoLinkedin, acaoDasDuasRedes } = renderizar(LIGADO);
+    fireEvent.click(caixinha("Instagram"));
+    await clicarEmPublicar();
+    expect(screen.getByRole("alert").textContent).toBe(TEXTO_SEM_REDE);
+    expect(acao).not.toHaveBeenCalled();
+    expect(acaoDoLinkedin).not.toHaveBeenCalled();
+    expect(acaoDasDuasRedes).not.toHaveBeenCalled();
+  });
+});
+
+describe("só no Instagram (o padrão)", () => {
+  it("o clique chama a action do Instagram, com a legenda, e as opções do reels aparecem", async () => {
+    const { acao, acaoDoLinkedin, acaoDasDuasRedes } = renderizar(LIGADO);
+    expect(screen.getByText("opções do reels")).toBeTruthy();
+    await escolherAImagem();
+    fireEvent.change(campoDaLegenda(), { target: { value: "Só no Instagram" } });
+    await clicarEmPublicar();
+    await waitFor(() => expect(acao).toHaveBeenCalledTimes(1));
+    expect(acao.mock.calls[0][0].get("forma")).toBe("imagem");
+    expect(String(acao.mock.calls[0][0].get("legenda"))).toBe("Só no Instagram");
+    expect(acaoDoLinkedin).not.toHaveBeenCalled();
+    expect(acaoDasDuasRedes).not.toHaveBeenCalled();
   });
 });
 
-describe("o texto do LinkedIn", () => {
-  it("o contador conta como o LinkedIn conta, e diz por quê", () => {
+describe("só no LinkedIn", () => {
+  function soNoLinkedin() {
+    fireEvent.click(caixinha("LinkedIn"));
+    fireEvent.click(caixinha("Instagram"));
+  }
+
+  it("o campo é o Texto, com o contador que conta como o LinkedIn, e as opções do reels somem", () => {
     renderizar(LIGADO);
-    fireEvent.click(screen.getByLabelText("LinkedIn"));
+    soNoLinkedin();
+    expect(screen.queryByLabelText("Legenda")).toBeNull();
+    expect(screen.queryByText("opções do reels")).toBeNull();
     fireEvent.change(campoDoTexto(), { target: { value: "Olá #mundo" } });
     expect(screen.getByText(`${tamanhoDoTextoNoLinkedin("Olá #mundo")}/3000`)).toBeTruthy();
     expect(screen.getByText(NOTA_DO_CONTADOR_DO_LINKEDIN)).toBeTruthy();
@@ -118,20 +213,18 @@ describe("o texto do LinkedIn", () => {
 
   it("o texto vazio é recusado na tela, sem chamar nada", async () => {
     const { acao, acaoDoLinkedin } = renderizar(LIGADO);
-    fireEvent.click(screen.getByLabelText("LinkedIn"));
-    await act(async () => {
-      fireEvent.click(botao());
-    });
+    soNoLinkedin();
+    escolherForma("texto");
+    await clicarEmPublicar();
     expect(screen.getByRole("alert").textContent).toBe(textoDaRecusaNoLinkedin("texto_vazio"));
     expect(acaoDoLinkedin).not.toHaveBeenCalled();
     expect(acao).not.toHaveBeenCalled();
   });
-});
 
-describe("publicar no LinkedIn", () => {
   it("só texto: a action do LinkedIn recebe a forma, o texto, o envio e o quando, uma vez só", async () => {
-    const { f, acao, acaoDoLinkedin } = renderizar(LIGADO);
-    fireEvent.click(screen.getByLabelText("LinkedIn"));
+    const { f, acao, acaoDoLinkedin, acaoDasDuasRedes } = renderizar(LIGADO);
+    escolherForma("texto");
+    fireEvent.click(caixinha("LinkedIn"));
     fireEvent.change(campoDoTexto(), { target: { value: "  Olá #mundo  " } });
     await act(async () => {
       fireEvent.click(botao());
@@ -147,22 +240,15 @@ describe("publicar no LinkedIn", () => {
     expect(dados.get("fuso")).not.toBeNull();
     expect(f.assinados).toEqual([]);
     expect(acao).not.toHaveBeenCalled();
+    expect(acaoDasDuasRedes).not.toHaveBeenCalled();
   });
 
   it("imagem: sobe a imagem pelas regras da imagem do Instagram e manda o caminho", async () => {
     const { f, acao, acaoDoLinkedin } = renderizar(LIGADO);
-    fireEvent.click(screen.getByLabelText("LinkedIn"));
-    fireEvent.change(screen.getByLabelText("Forma"), { target: { value: "imagem" } });
-    await act(async () => {
-      fireEvent.change(screen.getByLabelText("Arquivo"), {
-        target: { files: [new File([new Uint8Array(1000)], "arte.jpg", { type: "image/jpeg" })] },
-      });
-    });
-    await waitFor(() => expect(screen.queryByText("Lendo o arquivo…")).toBeNull());
+    soNoLinkedin();
+    await escolherAImagem();
     fireEvent.change(campoDoTexto(), { target: { value: "Com foto" } });
-    await act(async () => {
-      fireEvent.click(botao());
-    });
+    await clicarEmPublicar();
     await waitFor(() => expect(acaoDoLinkedin).toHaveBeenCalledTimes(1));
     const dados = acaoDoLinkedin.mock.calls[0][0];
     expect(dados.get("forma_linkedin")).toBe("imagem");
@@ -173,32 +259,82 @@ describe("publicar no LinkedIn", () => {
 
   it("imagem sem arquivo é recusada na tela", async () => {
     const { acaoDoLinkedin } = renderizar(LIGADO);
-    fireEvent.click(screen.getByLabelText("LinkedIn"));
-    fireEvent.change(screen.getByLabelText("Forma"), { target: { value: "imagem" } });
+    soNoLinkedin();
     fireEvent.change(campoDoTexto(), { target: { value: "Sem foto" } });
+    await clicarEmPublicar();
+    expect(screen.getByRole("alert")).toBeTruthy();
+    expect(acaoDoLinkedin).not.toHaveBeenCalled();
+  });
+});
+
+describe("nas duas redes", () => {
+  it("a imagem com as duas: a Legenda, o Texto para o LinkedIn opcional, a nota da legenda e o contador do texto que vai", () => {
+    renderizar(LIGADO);
+    fireEvent.click(caixinha("LinkedIn"));
+    expect(caixinha("Instagram").checked).toBe(true);
+    expect(caixinha("LinkedIn").checked).toBe(true);
+    fireEvent.change(campoDaLegenda(), { target: { value: "A legenda #ig" } });
+    expect(screen.getByText(NOTA_DA_LEGENDA_NO_LINKEDIN)).toBeTruthy();
+    // SEM O TEXTO PRÓPRIO, o contador do LinkedIn conta a legenda, que é o que vai.
+    expect(screen.getByText(`${tamanhoDoTextoNoLinkedin("A legenda #ig")}/3000`)).toBeTruthy();
+    fireEvent.change(campoDoTextoProprio(), { target: { value: "Outro texto #carreira" } });
+    expect(screen.getByText(`${tamanhoDoTextoNoLinkedin("Outro texto #carreira")}/3000`)).toBeTruthy();
+    expect(screen.getByText("opções do reels")).toBeTruthy();
+  });
+
+  it("o clique chama a action das duas redes, e só ela, uma vez, com a imagem, a legenda, o texto próprio e o envio", async () => {
+    const { f, acao, acaoDoLinkedin, acaoDasDuasRedes } = renderizar(LIGADO);
+    fireEvent.click(caixinha("LinkedIn"));
+    await escolherAImagem();
+    fireEvent.change(campoDaLegenda(), { target: { value: "A legenda #ig" } });
+    fireEvent.change(campoDoTextoProprio(), { target: { value: "Outro texto #carreira" } });
     await act(async () => {
       fireEvent.click(botao());
+      fireEvent.click(botao());
     });
-    expect(screen.getByRole("alert")).toBeTruthy();
+    await waitFor(() => expect(acaoDasDuasRedes).toHaveBeenCalledTimes(1));
+    const dados = acaoDasDuasRedes.mock.calls[0][0];
+    expect(dados.get("forma")).toBe("imagem");
+    expect(dados.get("caminhos")).toBe(`${PASTA}/arte.jpg`);
+    expect(dados.get("legenda")).toBe("A legenda #ig");
+    expect(dados.get("texto_linkedin")).toBe("Outro texto #carreira");
+    expect(dados.get("rede_instagram")).toBe("1");
+    expect(dados.get("rede_linkedin")).toBe("1");
+    expect(String(dados.get("id_do_envio"))).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
+    expect(f.assinados).toEqual([{ forma: "imagem", nome: "arte.jpg" }]);
+    expect(acao).not.toHaveBeenCalled();
     expect(acaoDoLinkedin).not.toHaveBeenCalled();
   });
 
-  it("voltar ao Instagram volta a chamar a action do Instagram, com a legenda", async () => {
-    const { acao, acaoDoLinkedin } = renderizar(LIGADO);
-    fireEvent.click(screen.getByLabelText("LinkedIn"));
-    fireEvent.click(screen.getByLabelText("Instagram"));
-    expect(screen.getByLabelText("Legenda")).toBeTruthy();
-    expect(screen.getByText("opções do reels")).toBeTruthy();
+  it("a legenda e o texto próprio vazios: o LinkedIn não teria texto, e a tela recusa antes de subir", async () => {
+    const { f, acaoDasDuasRedes } = renderizar(LIGADO);
+    fireEvent.click(caixinha("LinkedIn"));
+    await escolherAImagem();
+    await clicarEmPublicar();
+    expect(screen.getByRole("alert").textContent).toBe(textoDaRecusaNoLinkedin("texto_vazio"));
+    expect(f.assinados).toEqual([]);
+    expect(acaoDasDuasRedes).not.toHaveBeenCalled();
+  });
+
+  it("trocar para o carrossel com as duas marcadas deixa só o Instagram, e o clique vai à action dele", async () => {
+    const { acao, acaoDasDuasRedes } = renderizar(LIGADO);
+    fireEvent.click(caixinha("LinkedIn"));
+    escolherForma("carrossel");
+    expect(caixinha("LinkedIn").checked).toBe(false);
+    expect(screen.queryByLabelText("Texto para o LinkedIn (opcional)")).toBeNull();
     await act(async () => {
-      fireEvent.change(screen.getByLabelText("Arquivo"), {
-        target: { files: [new File([new Uint8Array(1000)], "arte.jpg", { type: "image/jpeg" })] },
+      fireEvent.change(screen.getByLabelText("Arquivos"), {
+        target: {
+          files: [
+            new File([new Uint8Array(1000)], "arte.jpg", { type: "image/jpeg" }),
+            new File([new Uint8Array(1000)], "arte.jpg", { type: "image/jpeg" }),
+          ],
+        },
       });
     });
     await waitFor(() => expect(screen.queryByText("Lendo o arquivo…")).toBeNull());
-    await act(async () => {
-      fireEvent.click(botao());
-    });
+    await clicarEmPublicar();
     await waitFor(() => expect(acao).toHaveBeenCalledTimes(1));
-    expect(acaoDoLinkedin).not.toHaveBeenCalled();
+    expect(acaoDasDuasRedes).not.toHaveBeenCalled();
   });
 });
```

O teste de tela do compor do LinkedIn foi escrito para o rádio "Rede" da 2a, e é reescrito para as caixinhas: os casos de antes continuam, no modo "só no LinkedIn", e entram os das caixinhas e os das duas redes.

A guarda do clique (`tests/publicar-compositor-guarda.test.ts`) prendia o texto exato da linha que escolhe a action, na forma da 2a. Ela passa a prender a forma nova, e o resto do caso (a action escolhida antes de qualquer espera, e o `try/finally` sem `catch`) fica como estava:

Em `tests/publicar-compositor-guarda.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/publicar-compositor-guarda.test.ts b/tests/publicar-compositor-guarda.test.ts
index 26919ca..bcfd022 100644
--- a/tests/publicar-compositor-guarda.test.ts
+++ b/tests/publicar-compositor-guarda.test.ts
@@ -22,11 +22,13 @@ describe("o compositor do /publicar", () => {
   const montar = funcao(fonte, "async function montarOPedido\\(\\): Promise<FormData \\| null>");
   const liberar = funcao(fonte, "function liberar\\(\\)");
 
-  // DESDE A PARTE 2a DO LINKEDIN, a action é a da rede do clique (`destino`): a do Instagram ou a do LinkedIn,
-  // escolhida antes de qualquer espera, como o formulário.
+  // DESDE A PARTE 2a DO LINKEDIN, a action é a das redes do clique (`destino`); desde a 2b, a das duas, a só do
+  // LinkedIn ou a só do Instagram, escolhida antes de qualquer espera, como o formulário.
   it("acha as funções do clique", () => {
     expect(publicar).toContain("await destino(dados);");
-    expect(publicar).toContain("const destino = noLinkedin ? (acaoDoLinkedin ?? acao) : acao;");
+    expect(publicar).toContain(
+      "const destino = nasDuas ? (acaoDasDuasRedes ?? acao) : soNoLinkedin ? (acaoDoLinkedin ?? acao) : acao;"
+    );
     expect(publicar.indexOf("const destino =")).toBeLessThan(publicar.indexOf("await"));
     expect(montar).toContain("await subirTodos(");
     expect(liberar).toContain("trava.current = false;");
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
env -u CLAUDECODE -u AI_AGENT npx --no-install vitest run tests/redes-do-post.test.ts tests/publicar-compositor-guarda.test.ts
env -u CLAUDECODE -u AI_AGENT npx --no-install vitest run --config vitest.dom.config.ts testes-dom/publicar-compositor-linkedin.dom.tsx
```

Esperado: 
- nos puros, "Test Files 2 failed (2)" e "Tests 2 failed | 33 passed (35)": caem "sem nenhuma rede marcada, a tela diz para marcar uma" (o `TEXTO_SEM_REDE` ainda não existe) e a guarda "acha as funções do clique" (a linha nova do destino ainda não existe);
- na tela, "Tests 12 failed | 4 passed (16)". Passam os quatro que a 2a já tinha e que ficam: a tela sem o LinkedIn, o LinkedIn desligado com o motivo, o padrão do Instagram e o só texto que vai à action do LinkedIn.

- [ ] **Passo 3: o código**

Em `lib/redes-do-post.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/redes-do-post.ts b/lib/redes-do-post.ts
index 38f71ff..54a1b67 100644
--- a/lib/redes-do-post.ts
+++ b/lib/redes-do-post.ts
@@ -68,6 +68,9 @@ export function estadoDasCaixinhas(p: {
   };
 }
 
+/** A recusa da tela quando nenhuma caixinha está marcada: não há para onde publicar. */
+export const TEXTO_SEM_REDE = "Marque ao menos uma rede: Instagram ou LinkedIn.";
+
 /** As redes que o formulário marcou: só o valor "1" marca, como os outros campos de marcar desta tela. */
 export function redesDoPedido(campos: { instagram: unknown; linkedin: unknown }): Record<Rede, boolean> {
   return { instagram: campos.instagram === "1", linkedin: campos.linkedin === "1" };
```

Em `app/publicar/enviador.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/publicar/enviador.tsx b/app/publicar/enviador.tsx
index 671c37e..9e1c9b9 100644
--- a/app/publicar/enviador.tsx
+++ b/app/publicar/enviador.tsx
@@ -51,8 +51,20 @@ import {
   tamanhoDoTextoNoLinkedin,
   textoDaRecusaNoLinkedin,
   type DisponibilidadeDoLinkedin,
-  type FormaNoLinkedin,
 } from "@/lib/linkedin-publicacao";
+// AS DUAS REDES NO MESMO POST (a parte 2b): o que cada forma aceita, as caixinhas, o texto que vai ao LinkedIn e a
+// recusa sem rede, das mesmas regras puras que a action lê.
+import {
+  CAIXINHAS_DE_PARTIDA,
+  NOTA_DA_LEGENDA_NO_LINKEDIN,
+  TEXTO_SEM_REDE,
+  estadoDasCaixinhas,
+  formasDaTela,
+  redeAceitaAForma,
+  textoQueVaiAoLinkedin,
+  type FormaDaTela,
+  type Rede,
+} from "@/lib/redes-do-post";
 import { assinarEnvios, atualizarEnvio, definirEnvios, lerEnvios, lerEnviosNoServidor, limparEnvios } from "./envios";
 import { navegadorDeVerdade, type Medidas, type Navegador } from "./navegador";
 import { btnPrimary, card, fieldError, hint, input, label, muted, numero } from "../ui";
@@ -149,6 +161,7 @@ export default function Enviador({
   rodape,
   linkedin = null,
   acaoDoLinkedin,
+  acaoDasDuasRedes,
   navegador = navegadorDeVerdade,
 }: {
   teto: number | null;
@@ -164,20 +177,34 @@ export default function Enviador({
    * estar desligado. Sem ele, a tela é só do Instagram, como antes. Nunca o token: só o resumo chega aqui.
    */
   linkedin?: DisponibilidadeDoLinkedin | null;
+  /** A action do post só no LinkedIn (a parte 2a). */
   acaoDoLinkedin?: (dados: FormData) => Promise<void>;
+  /** A action do post de imagem nas duas redes (a parte 2b). */
+  acaoDasDuasRedes?: (dados: FormData) => Promise<void>;
   navegador?: Navegador;
 }) {
-  // A REDE DO POST (a parte 2a: uma rede por post). No LinkedIn, a imagem sobe pelas regras da forma "imagem" do
-  // Instagram (JPEG, a proporção e o enquadramento), então a `forma` abaixo fica em "imagem" enquanto a rede é o
-  // LinkedIn, e todo o caminho da subida continua o mesmo.
-  const [rede, setRede] = useState<"instagram" | "linkedin">("instagram");
-  const [formaNoLinkedin, setFormaNoLinkedin] = useState<FormaNoLinkedin>("texto");
+  // AS REDES DO POST (a parte 2b): as caixinhas "Instagram" e "LinkedIn", que começam só com o Instagram marcado
+  // (`CAIXINHAS_DE_PARTIDA`, a decisão do Eduardo de 10/11). Cada forma liga e desliga as redes
+  // (`estadoDasCaixinhas`), e a caixinha desligada nunca conta como marcada.
+  const [marcadas, setMarcadas] = useState<Record<Rede, boolean>>({ ...CAIXINHAS_DE_PARTIDA });
+  // A FORMA DA TELA inclui o só texto, que é só do LinkedIn. Para a subida, vale a forma do Instagram: no só texto
+  // nada sobe, e a imagem do LinkedIn sobe pelas regras da imagem do Instagram (JPEG, a proporção e o enquadramento),
+  // então todo o caminho da subida continua o mesmo.
+  const [formaDaTela, setFormaDaTela] = useState<FormaDaTela>("imagem");
+  const forma: FormaDePublicacao = formaDaTela === "texto" ? "imagem" : formaDaTela;
   // O ID DO ENVIO, um por formulário: é a chave do só texto contra o clique repetido. A action termina em
   // `redirect`, que recria o componente (ver o cabeçalho), e o formulário seguinte nasce com outro.
   const [idDoEnvio] = useState(novoIdDoEnvio);
-  const mostraARede = linkedin !== null && !!acaoDoLinkedin;
-  const noLinkedin = mostraARede && rede === "linkedin" && linkedin?.disponivel === true;
-  const [forma, setForma] = useState<FormaDePublicacao>("imagem");
+  const mostraARede = linkedin !== null && !!acaoDoLinkedin && !!acaoDasDuasRedes;
+  const redes = estadoDasCaixinhas({ forma: formaDaTela, marcadas, linkedin: mostraARede ? linkedin : null });
+  const paraOInstagram = redes.instagram.marcada;
+  const paraOLinkedin = redes.linkedin?.marcada === true;
+  /** Só no LinkedIn: o campo "Texto" e a action da parte 2a. */
+  const soNoLinkedin = paraOLinkedin && !paraOInstagram;
+  /** Nas duas: a "Legenda", o "Texto para o LinkedIn" (opcional) e a action das duas. */
+  const nasDuas = paraOLinkedin && paraOInstagram;
+  /** O texto próprio do LinkedIn, no post das duas redes. Vazio, vai a legenda. */
+  const [textoProprio, setTextoProprio] = useState("");
   const [proporcao, setProporcao] = useState<ProporcaoDoPost>(PROPORCAO_PADRAO);
   const [legenda, setLegenda] = useState("");
   const [slides, setSlides] = useState<Slide[]>([]);
@@ -263,12 +290,16 @@ export default function Enviador({
   const quantidadeNaTela = slides.length && !algumMedindo ? textoDaQuantidadeNaTela(forma, slides.length, validos.length) : null;
   const primeiroSlide = forma === "carrossel" ? problemaDoPrimeiroSlide(medidos, proporcao) : null;
   // A LEGENDA É CONFERIDA COMO A ACTION A CONFERE: sem os espaços das pontas.
-  const problemaDaLegendaAtual = noLinkedin ? null : problemaDaLegenda(legenda.trim());
+  const problemaDaLegendaAtual = paraOInstagram ? problemaDaLegenda(legenda.trim()) : null;
+  // O TEXTO QUE VAI AO LINKEDIN: só nele, o campo "Texto" (o mesmo estado da legenda); nas duas, o texto próprio
+  // ou, sem ele, a legenda (`textoQueVaiAoLinkedin`, a mesma função da action).
+  const textoDoLinkedin = soNoLinkedin ? legenda.trim() : textoQueVaiAoLinkedin({ legenda, textoProprio });
   // NO LINKEDIN, o texto é contado como o LinkedIn conta, pela mesma função da action. Enquanto se digita, só o
   // longo é vermelho: o vazio é o estado de quem ainda não começou, e é recusado no clique.
-  const textoLongoNoLinkedin = noLinkedin && problemaDoTextoDoLinkedin(legenda.trim(), formaNoLinkedin) === "longo";
-  // O ARQUIVO SÓ EXISTE NO INSTAGRAM E NA IMAGEM DO LINKEDIN.
-  const temArquivo = !noLinkedin || formaNoLinkedin === "imagem";
+  const textoLongoNoLinkedin =
+    paraOLinkedin && problemaDoTextoDoLinkedin(textoDoLinkedin, formaDaTela === "texto" ? "texto" : "imagem") === "longo";
+  // O ARQUIVO SÓ NÃO EXISTE NO SÓ TEXTO.
+  const temArquivo = formaDaTela !== "texto";
   const caixa = caixaDaMiniatura(forma, medidos, proporcao);
 
   function soltar(lista: Slide[]) {
@@ -278,13 +309,19 @@ export default function Enviador({
     }
   }
 
-  function trocarForma(nova: FormaDePublicacao) {
+  function trocarForma(nova: FormaDaTela) {
     // TROCAR A FORMA DESCARTA A LISTA, porque as regras são outras (um vídeo de
     // 90 s serve para reels e não para story). Antes, isso deixava no bucket
     // tudo o que já tinha subido, e era o caminho mais barato do órfão (o
     // Vinícius registrou em aberto). Agora nada subiu antes do clique, e nada
     // fica.
-    setForma(nova);
+    setFormaDaTela(nova);
+    // A REDE QUE A FORMA NOVA NÃO ACEITA SAI DESMARCADA, e voltar à forma de antes não a remarca: o post do
+    // LinkedIn sai público no perfil pessoal, e só vai quem marcar de novo.
+    setMarcadas((atuais) => ({
+      instagram: atuais.instagram && !redeAceitaAForma("instagram", nova),
+      linkedin: atuais.linkedin && !redeAceitaAForma("linkedin", nova),
+    }));
     descartarALista();
   }
 
@@ -297,16 +334,9 @@ export default function Enviador({
     if (campoDeArquivo.current) campoDeArquivo.current.value = "";
   }
 
-  /** Trocar a rede descarta a lista, como trocar a forma. No LinkedIn, a imagem segue a forma "imagem". O texto fica. */
-  function trocarRede(nova: "instagram" | "linkedin") {
-    setRede(nova);
-    setForma("imagem");
-    descartarALista();
-  }
-
-  function trocarFormaNoLinkedin(nova: FormaNoLinkedin) {
-    setFormaNoLinkedin(nova);
-    descartarALista();
+  /** Marcar ou desmarcar uma rede não descarta a lista: a forma, e com ela as regras da subida, é a mesma. */
+  function marcar(rede: Rede, marcada: boolean) {
+    setMarcadas((atuais) => ({ ...atuais, [rede]: marcada }));
   }
 
   async function aoEscolherArquivo(ev: React.ChangeEvent<HTMLInputElement>) {
@@ -513,6 +543,11 @@ export default function Enviador({
     // AS CONFERÊNCIAS ANTES DE SUBIR, com as MESMAS funções da action (achado
     // 109): antes, todas chegavam depois da subida, porque o formulário não tem
     // `required`.
+    // SEM NENHUMA REDE MARCADA, não há para onde publicar.
+    if (!paraOInstagram && !paraOLinkedin) {
+      setRecusa(TEXTO_SEM_REDE);
+      return null;
+    }
     if (algumMedindo) {
       setRecusa(textoDaRecusaDaTela("lendo_arquivos"));
       return null;
@@ -526,14 +561,23 @@ export default function Enviador({
       setRecusa(textoDoProblemaDoPrimeiroSlide(primeiroSlide));
       return null;
     }
-    if (noLinkedin) {
+    // O TEXTO QUE VAI AO LINKEDIN, lido do formulário do clique: só nele, o "Texto"; nas duas, o próprio ou a legenda.
+    const textoDoLinkedinNoPedido = soNoLinkedin
+      ? String(pedido.get("texto") ?? "").trim()
+      : textoQueVaiAoLinkedin({
+          legenda: String(pedido.get("legenda") ?? ""),
+          textoProprio: String(pedido.get("texto_linkedin") ?? ""),
+        });
+    const formaNoLinkedin = formaDaTela === "texto" ? "texto" : "imagem";
+    if (paraOLinkedin) {
       // O TEXTO DO LINKEDIN, pela mesma função da action, antes de subir qualquer arquivo.
-      const doTexto = problemaDoTextoDoLinkedin(String(pedido.get("texto") ?? "").trim(), formaNoLinkedin);
+      const doTexto = problemaDoTextoDoLinkedin(textoDoLinkedinNoPedido, formaNoLinkedin);
       if (doTexto) {
         setRecusa(textoDaRecusaNoLinkedin(doTexto === "vazio" ? "texto_vazio" : "texto_longo"));
         return null;
       }
-    } else {
+    }
+    if (paraOInstagram) {
       const daLegenda = problemaDaLegenda(String(pedido.get("legenda") ?? "").trim());
       if (daLegenda) {
         setRecusa(textoDoProblemaDaLegenda(daLegenda));
@@ -571,23 +615,30 @@ export default function Enviador({
       // "publicado", e o desfecho é o aviso que a action devolve na tela.
       limparEnvios();
       pedido.set("caminhos", caminhos.join("\n"));
-      if (noLinkedin) {
+      if (paraOLinkedin) {
         // O PEDIDO INTEIRO DO LINKEDIN, pela mesma função de recusas da action, agora com os caminhos da subida.
         const recusaNoLinkedin = recusaDoPedidoNoLinkedin({
           forma: formaNoLinkedin,
           caminhos,
-          texto: String(pedido.get("texto") ?? "").trim(),
+          texto: textoDoLinkedinNoPedido,
           idDoEnvio,
         });
         if (recusaNoLinkedin) {
           setRecusa(textoDaRecusaNoLinkedin(recusaNoLinkedin));
           return null;
         }
-        pedido.set("forma_linkedin", formaNoLinkedin);
         pedido.set("id_do_envio", idDoEnvio);
+      }
+      if (soNoLinkedin) {
+        pedido.set("forma_linkedin", formaNoLinkedin);
       } else {
         pedido.set("forma", forma);
       }
+      if (nasDuas) {
+        // AS DUAS CAIXINHAS VÃO DITAS, além de marcadas: a action das duas é só delas.
+        pedido.set("rede_instagram", "1");
+        pedido.set("rede_linkedin", "1");
+      }
       return pedido;
     } finally {
       leva.current = null;
@@ -605,8 +656,9 @@ export default function Enviador({
     if (trava.current) return;
     trava.current = true;
     setRecusa(null);
-    // A ACTION É A DA REDE DO CLIQUE, escolhida antes de qualquer espera, como o formulário.
-    const destino = noLinkedin ? (acaoDoLinkedin ?? acao) : acao;
+    // A ACTION É A DAS REDES DO CLIQUE, escolhida antes de qualquer espera, como o formulário: as duas, só o
+    // LinkedIn, ou só o Instagram.
+    const destino = nasDuas ? (acaoDasDuasRedes ?? acao) : soNoLinkedin ? (acaoDoLinkedin ?? acao) : acao;
     let pedido: FormData | null = null;
     try {
       pedido = await montarOPedido();
@@ -636,89 +688,77 @@ export default function Enviador({
         void publicar();
       }}
     >
-      {/* A REDE DO POST (a parte 2a: uma rede por post). Só aparece quando a página manda o LinkedIn da conta; o
-          LinkedIn desligado (sem conexão, ou vencida) aparece desligado, com o motivo que veio do servidor. */}
-      {mostraARede && linkedin && (
+      {/* AS REDES DO POST (a parte 2b: uma ou as duas). Só aparecem quando a página manda o LinkedIn da conta. Cada
+          caixinha desligada diz o motivo: a conexão (sem LinkedIn, ou vencido), que veio do servidor, ou a forma. */}
+      {mostraARede && linkedin && redes.linkedin && (
         <fieldset className="space-y-2">
-          <legend className={label}>Rede</legend>
+          <legend className={label}>Redes</legend>
           <div className="flex flex-wrap gap-4 text-sm">
             <label className="flex items-center gap-2">
               <input
-                type="radio"
-                name="rede"
-                value="instagram"
-                checked={!noLinkedin}
-                disabled={ocupado}
-                onChange={() => trocarRede("instagram")}
+                type="checkbox"
+                name="rede_instagram"
+                value="1"
+                checked={redes.instagram.marcada}
+                disabled={ocupado || !redes.instagram.ligada}
+                onChange={(e) => marcar("instagram", e.target.checked)}
               />
               Instagram
             </label>
             <label className="flex items-center gap-2">
               <input
-                type="radio"
-                name="rede"
-                value="linkedin"
-                checked={noLinkedin}
-                disabled={ocupado || !linkedin.disponivel}
-                onChange={() => trocarRede("linkedin")}
+                type="checkbox"
+                name="rede_linkedin"
+                value="1"
+                checked={redes.linkedin.marcada}
+                disabled={ocupado || !redes.linkedin.ligada}
+                onChange={(e) => marcar("linkedin", e.target.checked)}
               />
               LinkedIn
             </label>
           </div>
+          {redes.instagram.motivo && <p className={hint}>{redes.instagram.motivo}</p>}
           <p className={hint}>
-            {linkedin.disponivel
-              ? `Um post vai a uma rede só. No LinkedIn, ele sai no perfil de ${linkedin.nome}.`
-              : linkedin.motivo}
+            {redes.linkedin.motivo ?? (linkedin.disponivel ? `No LinkedIn, o post sai no perfil de ${linkedin.nome}.` : "")}
           </p>
         </fieldset>
       )}
 
-      {noLinkedin ? (
-        <div>
-          <label className={label} htmlFor="forma">
-            Forma
-          </label>
-          <select
-            id="forma"
-            name="forma_linkedin"
-            className={input}
-            value={formaNoLinkedin}
-            disabled={ocupado}
-            onChange={(e) => trocarFormaNoLinkedin(e.target.value as FormaNoLinkedin)}
-          >
+      <div>
+        <label className={label} htmlFor="forma">
+          Forma
+        </label>
+        <select
+          id="forma"
+          name="forma"
+          className={input}
+          value={formaDaTela}
+          disabled={ocupado}
+          onChange={(e) => trocarForma(e.target.value as FormaDaTela)}
+        >
+          {/* AS PALAVRAS VÊM DE `rotuloDaForma` (lib/publicacao.ts): a tela de
+              agendados usa as mesmas quatro. A ORDEM é desta tela. O só texto
+              só aparece com o LinkedIn disponível (`formasDaTela`). */}
+          <option value="imagem">{rotuloDaForma("imagem")}</option>
+          <option value="carrossel">{rotuloDaForma("carrossel")}</option>
+          <option value="reels">{rotuloDaForma("reels")}</option>
+          <option value="story">{rotuloDaForma("story")}</option>
+          {formasDaTela(mostraARede ? linkedin : null).includes("texto") && (
             <option value="texto">{rotuloDaFormaNoLinkedin("texto")}</option>
-            <option value="imagem">{rotuloDaFormaNoLinkedin("imagem")}</option>
-          </select>
-          <p className={hint}>A imagem segue as regras da imagem do Instagram: JPEG, na proporção escolhida.</p>
-        </div>
-      ) : (
-        <div>
-          <label className={label} htmlFor="forma">
-            Forma
-          </label>
-          <select
-            id="forma"
-            name="forma"
-            className={input}
-            value={forma}
-            disabled={ocupado}
-            onChange={(e) => trocarForma(e.target.value as FormaDePublicacao)}
-          >
-            {/* AS PALAVRAS VÊM DE `rotuloDaForma` (lib/publicacao.ts): a tela de
-                agendados usa as mesmas quatro. A ORDEM é desta tela. */}
-            <option value="imagem">{rotuloDaForma("imagem")}</option>
-            <option value="carrossel">{rotuloDaForma("carrossel")}</option>
-            <option value="reels">{rotuloDaForma("reels")}</option>
-            <option value="story">{rotuloDaForma("story")}</option>
-          </select>
+          )}
+        </select>
+        {formaDaTela !== "texto" && (
           <p className={hint}>
             No carrossel valem duas regras da Meta: reels não entra (vídeo em carrossel é vídeo comum, sem áudio
             nomeado e sem aparecer no feed como reels), e todos os itens são cortados pela proporção do PRIMEIRO
             — por isso a ordem importa, e dá para mudá-la na lista abaixo. São de 2 a {CARROSSEL_ITENS_MAX} itens,
             e o post inteiro conta como uma só publicação.
           </p>
-        </div>
-      )}
+        )}
+        {paraOLinkedin && formaDaTela === "imagem" && (
+          <p className={hint}>No LinkedIn, a imagem segue as regras da imagem do Instagram: JPEG, na proporção escolhida.</p>
+        )}
+      </div>
 
       {enquadra && temArquivo && (
         <fieldset className="space-y-2">
@@ -809,7 +849,7 @@ export default function Enviador({
         </div>
       )}
 
-      {noLinkedin ? (
+      {soNoLinkedin ? (
         // O TEXTO DO LINKEDIN: o mesmo estado da legenda (trocar de rede não apaga o que se escreveu), outro nome
         // no formulário, e o contador que conta como o LinkedIn conta, com a frase que diz por quê (achado 212).
         <div>
@@ -858,6 +898,34 @@ export default function Enviador({
             </p>
             <p className={`shrink-0 text-xs ${numero} ${muted}`}>{legenda.length}/2200</p>
           </div>
+          {nasDuas && (
+            // O TEXTO PRÓPRIO DO LINKEDIN, NO POST DAS DUAS REDES (spec, §7): opcional. Vazio, o LinkedIn leva a
+            // legenda, e o contador conta o que vai de fato, pela mesma função da action (achado 212).
+            <div className="mt-4">
+              <label className={label} htmlFor="texto_linkedin">
+                Texto para o LinkedIn (opcional)
+              </label>
+              <p className={hint}>{NOTA_DA_LEGENDA_NO_LINKEDIN}</p>
+              <textarea
+                id="texto_linkedin"
+                name="texto_linkedin"
+                rows={4}
+                value={textoProprio}
+                disabled={ocupado}
+                onChange={(e) => setTextoProprio(e.target.value)}
+                className={input}
+                placeholder="Vazio, vai a legenda."
+              />
+              <div className="mt-1.5 flex items-start justify-between gap-3">
+                <p className={textoLongoNoLinkedin ? fieldError : hint}>
+                  {textoLongoNoLinkedin ? textoDaRecusaNoLinkedin("texto_longo") : NOTA_DO_CONTADOR_DO_LINKEDIN}
+                </p>
+                <p className={`shrink-0 text-xs ${numero} ${muted}`}>
+                  {tamanhoDoTextoNoLinkedin(textoDoLinkedin)}/{LIMITE_DO_TEXTO_DO_LINKEDIN}
+                </p>
+              </div>
+            </div>
+          )}
         </div>
       )}
 
@@ -882,8 +950,8 @@ export default function Enviador({
           a tela travar, então travar não tira nada do pedido. */}
       <fieldset disabled={ocupado} className="m-0 min-w-0 space-y-6 border-0 p-0">
         {quando}
-        {/* AS OPÇÕES DO REELS SÃO DO INSTAGRAM: no LinkedIn elas saem da tela e do formulário. */}
-        {!noLinkedin && opcoesDoReels}
+        {/* AS OPÇÕES DO REELS SÃO DO INSTAGRAM: só no LinkedIn, elas saem da tela e do formulário. */}
+        {!soNoLinkedin && opcoesDoReels}
       </fieldset>
 
       {recusa && (
```

Em `app/publicar/novo/page.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/publicar/novo/page.tsx b/app/publicar/novo/page.tsx
index 15e7ef3..e8b65a8 100644
--- a/app/publicar/novo/page.tsx
+++ b/app/publicar/novo/page.tsx
@@ -6,7 +6,7 @@ import { pastaDaConta, tetoDoBucket } from "@/lib/bucket";
 import { avisoDaUrl } from "@/lib/avisos";
 import { PUBLICACOES_POR_DIA } from "@/lib/publicacao";
 import Enviador from "../enviador";
-import { publicar, publicarNoLinkedin } from "../actions";
+import { publicar, publicarNasDuasRedes, publicarNoLinkedin } from "../actions";
 // O LINKEDIN DA CONTA (a parte 2a): só o resumo, e a tela recebe só o nome ou o motivo de estar desligado.
 import { resumoDaConexao } from "@/lib/linkedin-conexoes";
 import { disponibilidadeDoLinkedin } from "@/lib/linkedin-publicacao";
@@ -138,6 +138,7 @@ export default async function Publicar({
             acao={publicar}
             linkedin={linkedin}
             acaoDoLinkedin={publicarNoLinkedin}
+            acaoDasDuasRedes={publicarNasDuasRedes}
             quando={
               <>
             {/* QUANDO — refeito em 11/09/2026 porque o dono disse que estava
```

- [ ] **Passo 4: rodar e ver passar**

```bash
env -u CLAUDECODE -u AI_AGENT npx --no-install vitest run
env -u CLAUDECODE -u AI_AGENT npx --no-install vitest run --config vitest.dom.config.ts
npx --no-install tsc --noEmit
npx --no-install eslint app/publicar/enviador.tsx app/publicar/novo/page.tsx lib/redes-do-post.ts \
  tests/redes-do-post.test.ts testes-dom/publicar-compositor-linkedin.dom.tsx tests/publicar-compositor-guarda.test.ts
```

Esperado: nos puros, "Test Files 157 passed (157)" e "Tests 3752 passed (3752)"; na tela, "Test Files 36 passed (36)" e "Tests 331 passed (331)", e o `tsc` e o lint sem saída.

- [ ] **Passo 5: o commit**

A mensagem do commit, gravada em `$SCRATCH/msg-li2b-f3.txt`:

```text
A tela de publicar troca a rede por caixinhas, começa só com o Instagram e mostra o texto próprio do LinkedIn
```

```bash
git add -- app/publicar/enviador.tsx app/publicar/novo/page.tsx lib/redes-do-post.ts \
  testes-dom/publicar-compositor-linkedin.dom.tsx tests/publicar-compositor-guarda.test.ts tests/redes-do-post.test.ts
git commit -F "$SCRATCH/msg-li2b-f3.txt"
```

---

### FASE 4 — O convite numa conta que já tem LinkedIn pede confirmação (achado 209)

**Arquivos:** `lib/linkedin-publicacao.ts`, `app/setup/actions.ts`, `app/setup/linkedin-das-contas.tsx`, `tests/linkedin-convite-confirmacao.test.ts` (novo), `testes-dom/linkedin-no-setup.dom.tsx`, `testes-integracao/linkedin-acoes.integracao.ts`.

- [ ] **Passo 1: os testes**

Crie `tests/linkedin-convite-confirmacao.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  TEXTO_DO_CONVITE_SEM_CONFIRMACAO,
  oConvitePedeConfirmacao,
  textoDaConfirmacaoDoConvite,
} from "@/lib/linkedin-publicacao";

// O CONVITE NUMA CONTA QUE JÁ TEM O LINKEDIN (a decisão do Eduardo pela caixa, 10/11, 17:16:36Z: "Pede confirmação
// antes"; o achado 209: dois convites a mais apareceram numa conta já conectada). A tela pede a confirmação, e o
// servidor recusa o convite sem ela, pela mesma regra: o duplo clique sem confirmar não gera nada.

describe("quando o convite do LinkedIn pede confirmação", () => {
  it("a conta com o LinkedIn válido, ou perto de vencer, pede: um convite usado troca a conexão que existe", () => {
    expect(oConvitePedeConfirmacao("valido")).toBe(true);
    expect(oConvitePedeConfirmacao("perto")).toBe(true);
  });

  it("a conta sem LinkedIn, ou com ele vencido, não pede: não há conexão para trocar", () => {
    expect(oConvitePedeConfirmacao(null)).toBe(false);
    expect(oConvitePedeConfirmacao("vencido")).toBe(false);
  });

  it("a confirmação diz de quem é o LinkedIn conectado e o que o convite novo faz", () => {
    const texto = textoDaConfirmacaoDoConvite("Dra. Ana Souza");
    expect(texto).toContain("Dra. Ana Souza");
    expect(texto).toContain("troca");
  });

  it("a recusa do servidor sem a confirmação diz o que fazer", () => {
    expect(TEXTO_DO_CONVITE_SEM_CONFIRMACAO).toContain("confirme");
  });
});
```

Em `testes-dom/linkedin-no-setup.dom.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-dom/linkedin-no-setup.dom.tsx b/testes-dom/linkedin-no-setup.dom.tsx
index b0df770..9a4e625 100644
--- a/testes-dom/linkedin-no-setup.dom.tsx
+++ b/testes-dom/linkedin-no-setup.dom.tsx
@@ -10,6 +10,7 @@ const { gerarConviteDoLinkedin, desconectarLinkedin } = vi.hoisted(() => ({
 vi.mock("@/app/setup/actions", () => ({ gerarConviteDoLinkedin, desconectarLinkedin }));
 
 import LinkedinDasContas, { type LinhaDoLinkedin } from "@/app/setup/linkedin-das-contas";
+import { textoDaConfirmacaoDoConvite } from "@/lib/linkedin-publicacao";
 
 // O LINKEDIN DAS CONTAS NA CONFIGURAÇÃO (docs/specs/2026-11-06-linkedin-no-perfil.md, §7; a parte 1, a
 // conexão): cada conta com o LinkedIn conectado, perto de vencer, vencido ou ausente; o convite, cujo link
@@ -68,9 +69,9 @@ describe("o LinkedIn de cada conta", () => {
     gerarConviteDoLinkedin.mockResolvedValue({ erro: "Esta conta não está conectada neste painel." });
     render(<LinkedinDasContas linhas={LINHAS} chavesOk />);
     await act(async () => {
-      fireEvent.click(within(linhaDa("@conta_valida")).getByRole("button", { name: "Convidar a conectar o LinkedIn" }));
+      fireEvent.click(within(linhaDa("@conta_sem")).getByRole("button", { name: "Convidar a conectar o LinkedIn" }));
     });
-    expect(within(linhaDa("@conta_valida")).getByRole("alert").textContent).toBe("Esta conta não está conectada neste painel.");
+    expect(within(linhaDa("@conta_sem")).getByRole("alert").textContent).toBe("Esta conta não está conectada neste painel.");
   });
 
   it("sem as chaves do app, diz o motivo e desliga o convite, e o Desconectar continua", () => {
@@ -85,6 +86,73 @@ describe("o LinkedIn de cada conta", () => {
   });
 });
 
+// O CONVITE NUMA CONTA QUE JÁ TEM O LINKEDIN (a decisão do Eduardo, 10/11: "Pede confirmação antes"; o achado
+// 209). O botão abre a confirmação, com o nome de quem está conectado, e só o "Sim, gerar o convite" chama a ação,
+// com o "confirmado". O servidor recusa sem ele (testes-integracao/linkedin-acoes.integracao.ts).
+describe("o convite numa conta que já tem LinkedIn (achado 209)", () => {
+  const botaoDoConvite = (arroba: string) => within(linhaDa(arroba)).getByRole("button", { name: "Convidar a conectar o LinkedIn" });
+
+  it("na conta conectada, o botão abre a confirmação com o nome, e não chama a ação", async () => {
+    render(<LinkedinDasContas linhas={LINHAS} chavesOk />);
+    await act(async () => {
+      fireEvent.click(botaoDoConvite("@conta_valida"));
+    });
+    expect(gerarConviteDoLinkedin).not.toHaveBeenCalled();
+    expect(linhaDa("@conta_valida").textContent).toContain(textoDaConfirmacaoDoConvite("Dra. Ana Souza"));
+    expect(within(linhaDa("@conta_valida")).getByRole("button", { name: "Sim, gerar o convite" })).toBeTruthy();
+  });
+
+  it("o \"Sim, gerar o convite\" chama a ação uma vez, com a conta da linha e o confirmado", async () => {
+    gerarConviteDoLinkedin.mockResolvedValue({ link: "https://painel.exemplo.com.br/convite/abc", paraQuem: "@conta_valida" });
+    render(<LinkedinDasContas linhas={LINHAS} chavesOk />);
+    await act(async () => {
+      fireEvent.click(botaoDoConvite("@conta_valida"));
+    });
+    await act(async () => {
+      fireEvent.click(within(linhaDa("@conta_valida")).getByRole("button", { name: "Sim, gerar o convite" }));
+    });
+    expect(gerarConviteDoLinkedin).toHaveBeenCalledTimes(1);
+    const dados = gerarConviteDoLinkedin.mock.calls[0][1] as FormData;
+    expect(dados.get("conta")).toBe("1");
+    expect(dados.get("confirmado")).toBe("1");
+    expect(within(linhaDa("@conta_valida")).getByText("https://painel.exemplo.com.br/convite/abc")).toBeTruthy();
+  });
+
+  it("perto de vencer também pede a confirmação", async () => {
+    render(<LinkedinDasContas linhas={LINHAS} chavesOk />);
+    await act(async () => {
+      fireEvent.click(botaoDoConvite("@conta_perto"));
+    });
+    expect(gerarConviteDoLinkedin).not.toHaveBeenCalled();
+    expect(linhaDa("@conta_perto").textContent).toContain(textoDaConfirmacaoDoConvite("Dr. Bruno Lima"));
+  });
+
+  it("o Cancelar fecha a confirmação sem chamar nada", async () => {
+    render(<LinkedinDasContas linhas={LINHAS} chavesOk />);
+    await act(async () => {
+      fireEvent.click(botaoDoConvite("@conta_valida"));
+    });
+    await act(async () => {
+      fireEvent.click(within(linhaDa("@conta_valida")).getByRole("button", { name: "Cancelar" }));
+    });
+    expect(within(linhaDa("@conta_valida")).queryByRole("button", { name: "Sim, gerar o convite" })).toBeNull();
+    expect(gerarConviteDoLinkedin).not.toHaveBeenCalled();
+  });
+
+  it("sem LinkedIn, ou com ele vencido, o convite sai direto, sem confirmação", async () => {
+    gerarConviteDoLinkedin.mockResolvedValue({ link: "https://painel.exemplo.com.br/convite/xyz", paraQuem: "@x" });
+    render(<LinkedinDasContas linhas={LINHAS} chavesOk />);
+    for (const arroba of ["@conta_sem", "@conta_vencida"]) {
+      await act(async () => {
+        fireEvent.click(botaoDoConvite(arroba));
+      });
+    }
+    expect(gerarConviteDoLinkedin).toHaveBeenCalledTimes(2);
+    expect((gerarConviteDoLinkedin.mock.calls[0][1] as FormData).get("confirmado")).toBeNull();
+    expect((gerarConviteDoLinkedin.mock.calls[1][1] as FormData).get("confirmado")).toBeNull();
+  });
+});
+
 describe("o Desconectar (achado 206)", () => {
   it("pede confirmação, dizendo que o painel apaga a autorização e que, no LinkedIn, ela vence sozinha", () => {
     render(<LinkedinDasContas linhas={LINHAS} chavesOk />);
```

Em `testes-integracao/linkedin-acoes.integracao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/testes-integracao/linkedin-acoes.integracao.ts b/testes-integracao/linkedin-acoes.integracao.ts
index 53c4679..475bdcd 100644
--- a/testes-integracao/linkedin-acoes.integracao.ts
+++ b/testes-integracao/linkedin-acoes.integracao.ts
@@ -98,6 +98,55 @@ describe("gerar o convite do LinkedIn de uma conta", () => {
   });
 });
 
+// O CONVITE NUMA CONTA QUE JÁ TEM O LINKEDIN (a decisão do Eduardo, 10/11: "Pede confirmação antes"; o achado 209).
+// A confirmação vale no SERVIDOR, e não só na tela: o duplo clique sem confirmar não grava convite nenhum.
+describe("o convite numa conta que já tem LinkedIn (achado 209)", () => {
+  const conectar = (expira: string) =>
+    q(
+      `insert into linkedin_conexoes (account_id, pessoa_id, nome, access_token, expira_em)
+       values ($1, 'p', 'Dra. Ana Souza', 't', ${expira})`,
+      [CONTA]
+    );
+  const gerarConfirmado = (conta: string) =>
+    comoNumaRequisicaoComSessao("/setup", () => acoes.gerarConviteDoLinkedin(null, form({ conta, confirmado: "1" })));
+
+  it("com o LinkedIn válido, sem a confirmação, não gera, e diz por quê", async () => {
+    await conectar("now() + interval '45 days'");
+    const regras = await import("@/lib/linkedin-publicacao");
+    const { valor } = await gerar(CONTA);
+    expect(valor).toEqual({ erro: regras.TEXTO_DO_CONVITE_SEM_CONFIRMACAO });
+    expect(await q(`select 1 from convites_de_conexao`)).toHaveLength(0);
+  });
+
+  it("dois pedidos sem a confirmação, um logo depois do outro (o 209), não gravam nada", async () => {
+    await conectar("now() + interval '45 days'");
+    await Promise.all([gerar(CONTA), gerar(CONTA)]);
+    expect(await q(`select 1 from convites_de_conexao`)).toHaveLength(0);
+  });
+
+  it("perto de vencer também pede a confirmação", async () => {
+    await conectar("now() + interval '3 days'");
+    const { valor } = await gerar(CONTA);
+    expect(valor && "erro" in valor).toBe(true);
+    expect(await q(`select 1 from convites_de_conexao`)).toHaveLength(0);
+  });
+
+  it("com a confirmação, gera o convite, e a conexão que existe fica como está", async () => {
+    await conectar("now() + interval '45 days'");
+    const { valor } = await gerarConfirmado(CONTA);
+    expect(valor && "link" in valor).toBe(true);
+    expect(await q(`select 1 from convites_de_conexao where rede = 'linkedin' and conta_alvo = $1`, [CONTA])).toHaveLength(1);
+    expect(await q(`select 1 from linkedin_conexoes where account_id = $1`, [CONTA])).toHaveLength(1);
+  });
+
+  it("com o LinkedIn vencido, o convite sai sem a confirmação", async () => {
+    await conectar("now() - interval '1 minute'");
+    const { valor } = await gerar(CONTA);
+    expect(valor && "link" in valor).toBe(true);
+    expect(await q(`select 1 from convites_de_conexao`)).toHaveLength(1);
+  });
+});
+
 describe("desconectar o LinkedIn de uma conta", () => {
   it("apaga a conexão da conta, e a conta fica", async () => {
     await q(
```

O caso de tela "mostra o erro da ação" usava a conta conectada, que agora abre a confirmação. Ele passa a usar a conta sem LinkedIn, e continua prendendo o mesmo: o erro da ação aparece, sem link.

- [ ] **Passo 2: rodar e ver falhar**

```bash
env -u CLAUDECODE -u AI_AGENT npx --no-install vitest run tests/linkedin-convite-confirmacao.test.ts
env -u CLAUDECODE -u AI_AGENT npx --no-install vitest run --config vitest.dom.config.ts testes-dom/linkedin-no-setup.dom.tsx
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" \
  npx --no-install vitest run --config vitest.integracao.config.ts testes-integracao/linkedin-acoes.integracao.ts
```

Esperado: 
- nos puros, "Tests 4 failed (4)": as funções novas ainda não existem;
- na tela, "Tests 4 failed | 8 passed (12)": caem os quatro da confirmação; passa "sem LinkedIn, ou com ele vencido, o convite sai direto, sem confirmação", que é o de hoje;
- na integração, `ALVO: banco de TESTE` e "Tests 3 failed | 8 passed (11)": caem "com o LinkedIn válido, sem a confirmação, não gera, e diz por quê", "dois pedidos sem a confirmação, um logo depois do outro (o 209), não gravam nada" e "perto de vencer também pede a confirmação". O confirmado e o vencido já passam hoje.

- [ ] **Passo 3: o código**

Em `lib/linkedin-publicacao.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/lib/linkedin-publicacao.ts b/lib/linkedin-publicacao.ts
index e72a30a..28ec869 100644
--- a/lib/linkedin-publicacao.ts
+++ b/lib/linkedin-publicacao.ts
@@ -26,6 +26,22 @@ export function vencimentoDoLinkedin(expiraEm: Date | string, agoraMs: number):
   };
 }
 
+/**
+ * O CONVITE NUMA CONTA QUE JÁ TEM O LINKEDIN PEDE CONFIRMAÇÃO (a decisão do Eduardo pela caixa, 10/11, 17:16:36Z:
+ * "Pede confirmação antes"; o achado 209). Um convite novo, quando usado, troca a conexão que existe. Sem LinkedIn,
+ * ou com ele vencido, não há o que trocar. A tela pede, e o servidor recusa sem a confirmação, pela mesma regra.
+ */
+export function oConvitePedeConfirmacao(estado: Vencimento["estado"] | null): boolean {
+  return estado === "valido" || estado === "perto";
+}
+
+export function textoDaConfirmacaoDoConvite(nome: string): string {
+  return `Esta conta já tem o LinkedIn de ${nome} conectado. Um convite novo, quando usado, troca essa conexão pela nova. Gerar o convite mesmo assim?`;
+}
+
+export const TEXTO_DO_CONVITE_SEM_CONFIRMACAO =
+  "Esta conta já tem o LinkedIn conectado: confirme antes de gerar um convite novo.";
+
 // ---------------------------------------------------------------------------------------------------------------
 // AS FORMAS DA PARTE 2a
 // ---------------------------------------------------------------------------------------------------------------
```

Em `app/setup/actions.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/setup/actions.ts b/app/setup/actions.ts
index cfcb010..922bb25 100644
--- a/app/setup/actions.ts
+++ b/app/setup/actions.ts
@@ -22,8 +22,9 @@ import {
 } from "@/lib/convites";
 import { cancelarConvite as cancelarNoBanco, criarConvite } from "@/lib/convites-repositorio";
 import { podeVerConta } from "@/lib/acesso";
-import { apagarConexao } from "@/lib/linkedin-conexoes";
+import { apagarConexao, resumoDaConexao } from "@/lib/linkedin-conexoes";
 import { ambienteDaVercel, baseDoPainelParaOLinkedin, credenciaisDoLinkedin } from "@/lib/linkedin";
+import { oConvitePedeConfirmacao, TEXTO_DO_CONVITE_SEM_CONFIRMACAO, vencimentoDoLinkedin } from "@/lib/linkedin-publicacao";
 
 // TODA ACTION DESTE ARQUIVO É DO ADMINISTRADOR (docs/specs/2026-11-05-contas-por-login.md, seção 3: o login
 // comum faz tudo nas contas dele, menos a Configuração e os logins). Cada uma chama `exigirAdministrador`
@@ -392,6 +393,14 @@ export async function gerarConviteDoLinkedin(_anterior: EstadoDoGerar, formData:
   const contaId = String(formData.get("conta") ?? "");
   const conta = (await podeVerConta(login, contaId)) ? await getAccount(contaId) : null;
   if (!conta) return { erro: "Esta conta não está conectada neste painel." };
+  // A CONTA QUE JÁ TEM O LINKEDIN VÁLIDO só ganha convite confirmado (a decisão do Eduardo de 10/11; o achado 209):
+  // um convite usado troca a conexão que existe. A tela pede a confirmação, e esta recusa é a segunda barreira, para
+  // um duplo clique (ou um envio de fora da tela) não gravar convite nenhum.
+  const resumo = await resumoDaConexao(conta.ig_user_id);
+  const estado = resumo ? vencimentoDoLinkedin(resumo.expira_em, Date.now()).estado : null;
+  if (oConvitePedeConfirmacao(estado) && formData.get("confirmado") !== "1") {
+    return { erro: TEXTO_DO_CONVITE_SEM_CONFIRMACAO };
+  }
   // O "para quem" é o @ da conta, cortado como o `char_length` da 021 conta: caractere, e não pedaço de UTF-16.
   const paraQuem = Array.from(`@${conta.username ?? conta.ig_user_id}`).slice(0, LIMITE_DO_PARA_QUEM).join("");
   const config = await getConfig();
```

Em `app/setup/linkedin-das-contas.tsx`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/app/setup/linkedin-das-contas.tsx b/app/setup/linkedin-das-contas.tsx
index 3c4f396..ccf9a68 100644
--- a/app/setup/linkedin-das-contas.tsx
+++ b/app/setup/linkedin-das-contas.tsx
@@ -3,6 +3,7 @@ import { useActionState, useState } from "react";
 import CopyField from "./copy-field";
 import { desconectarLinkedin, gerarConviteDoLinkedin } from "./actions";
 import type { EstadoDoGerar } from "@/lib/convites";
+import { oConvitePedeConfirmacao, textoDaConfirmacaoDoConvite } from "@/lib/linkedin-publicacao";
 import { alertError, btnPrimary, btnSecondary, muted } from "../ui";
 
 // O LINKEDIN DAS CONTAS NA CONFIGURAÇÃO (docs/specs/2026-11-06-linkedin-no-perfil.md, §7; a parte 1, a
@@ -19,7 +20,12 @@ export type LinhaDoLinkedin = {
 function LinhaDaConta({ linha, chavesOk }: { linha: LinhaDoLinkedin; chavesOk: boolean }) {
   const [estado, gerar, gerando] = useActionState<EstadoDoGerar, FormData>(gerarConviteDoLinkedin, null);
   const [confirmando, setConfirmando] = useState(false);
+  // O CONVITE NUMA CONTA QUE JÁ TEM O LINKEDIN VÁLIDO pede confirmação (a decisão do Eduardo de 10/11; o achado
+  // 209): o botão abre a pergunta, e só o "Sim, gerar o convite" chama a ação, com o "confirmado". O servidor
+  // recusa sem ele, pela mesma regra (`oConvitePedeConfirmacao`).
+  const [confirmandoConvite, setConfirmandoConvite] = useState(false);
   const c = linha.conexao;
+  const pedeConfirmacao = oConvitePedeConfirmacao(c?.estado ?? null);
 
   return (
     <li className="space-y-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
@@ -41,18 +47,48 @@ function LinhaDaConta({ linha, chavesOk }: { linha: LinhaDoLinkedin; chavesOk: b
         </>
       )}
       <div className="flex flex-wrap gap-2">
-        <form action={gerar}>
-          <input type="hidden" name="conta" value={linha.contaId} />
-          <button type="submit" disabled={!chavesOk || gerando} className={btnPrimary}>
-            Convidar a conectar o LinkedIn
-          </button>
-        </form>
+        {pedeConfirmacao ? (
+          !confirmandoConvite && (
+            <button
+              type="button"
+              disabled={!chavesOk || gerando}
+              onClick={() => setConfirmandoConvite(true)}
+              className={btnPrimary}
+            >
+              Convidar a conectar o LinkedIn
+            </button>
+          )
+        ) : (
+          <form action={gerar}>
+            <input type="hidden" name="conta" value={linha.contaId} />
+            <button type="submit" disabled={!chavesOk || gerando} className={btnPrimary}>
+              Convidar a conectar o LinkedIn
+            </button>
+          </form>
+        )}
         {c && !confirmando && (
           <button type="button" onClick={() => setConfirmando(true)} className={btnSecondary}>
             Desconectar
           </button>
         )}
       </div>
+      {c && pedeConfirmacao && confirmandoConvite && (
+        <div className="space-y-2 rounded-lg border border-zinc-200 p-2 dark:border-zinc-800">
+          <p className="text-xs">{textoDaConfirmacaoDoConvite(c.nome)}</p>
+          <div className="flex gap-2">
+            <form action={gerar} onSubmit={() => setConfirmandoConvite(false)}>
+              <input type="hidden" name="conta" value={linha.contaId} />
+              <input type="hidden" name="confirmado" value="1" />
+              <button type="submit" disabled={!chavesOk || gerando} className={btnPrimary}>
+                Sim, gerar o convite
+              </button>
+            </form>
+            <button type="button" onClick={() => setConfirmandoConvite(false)} className={btnSecondary}>
+              Cancelar
+            </button>
+          </div>
+        </div>
+      )}
       {c && confirmando && (
         // O QUE O DESCONECTAR FAZ, E O QUE ELE NÃO FAZ (achado 206): o LinkedIn não tem como revogar a autorização
         // de fora, então ela vence sozinha lá. A frase vem antes do botão que apaga.
```

- [ ] **Passo 4: rodar e ver passar**

```bash
env -u CLAUDECODE -u AI_AGENT npx --no-install vitest run
env -u CLAUDECODE -u AI_AGENT npx --no-install vitest run --config vitest.dom.config.ts
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" \
  npx --no-install vitest run --config vitest.integracao.config.ts testes-integracao/linkedin-acoes.integracao.ts
npx --no-install tsc --noEmit
npx --no-install eslint lib/linkedin-publicacao.ts app/setup/actions.ts app/setup/linkedin-das-contas.tsx \
  tests/linkedin-convite-confirmacao.test.ts testes-dom/linkedin-no-setup.dom.tsx testes-integracao/linkedin-acoes.integracao.ts
```

Esperado: nos puros, "Test Files 158 passed (158)" e "Tests 3756 passed (3756)"; na tela, "Test Files 36 passed (36)" e "Tests 336 passed (336)"; na integração, `ALVO: banco de TESTE`, "Test Files 1 passed (1)" e "Tests 11 passed (11)", e o `tsc` e o lint sem saída.

- [ ] **Passo 5: o commit**

A mensagem do commit, gravada em `$SCRATCH/msg-li2b-f4.txt`:

```text
O convite numa conta que já tem LinkedIn pede confirmação, na tela e no servidor
```

```bash
git add -- lib/linkedin-publicacao.ts app/setup/actions.ts app/setup/linkedin-das-contas.tsx \
  tests/linkedin-convite-confirmacao.test.ts testes-dom/linkedin-no-setup.dom.tsx testes-integracao/linkedin-acoes.integracao.ts
git commit -F "$SCRATCH/msg-li2b-f4.txt"
```

---

### FASE 5 — O começo da função nas duas chamadas do "agora" das duas redes

**Arquivos:** `tests/dreno-com-prazo.test.ts`.

O código desta prova já entrou na FASE 2 (a action passa o `inicioDaFuncaoMs` ao `drenarUmaPublicacaoDoLinkedin` e ao `drainQueue`, nessa ordem). O teste de prazo da 2a só olhava o `publicarNoLinkedin`, e esta fase prende também o `publicarNasDuasRedes`. Por isso ela não tem RED: o caso passa de cara, e a prova de que ele pega são as mutações F2-12 e F2-13 (Apêndice A).

- [ ] **Passo 1: o teste**

Em `tests/dreno-com-prazo.test.ts`, aplique (com `git apply`, a partir da raiz, ou à mão):

```diff
diff --git a/tests/dreno-com-prazo.test.ts b/tests/dreno-com-prazo.test.ts
index 2a01410..dc61549 100644
--- a/tests/dreno-com-prazo.test.ts
+++ b/tests/dreno-com-prazo.test.ts
@@ -28,6 +28,24 @@ describe("a action de publicar no LinkedIn passa o começo da função ao \"agor
   });
 });
 
+// O "AGORA" DAS DUAS REDES (`publicarNasDuasRedes`, a parte 2b): o mesmo começo vai ao LinkedIn e ao dreno de hoje,
+// que publica o Instagram, para outra linha do LinkedIn que esse dreno pegue respeitar o prazo (nota da auditoria
+// sobre o desenho da 2b). E o LinkedIn vem antes (a escolha (a)): só a própria linha, com o tempo inteiro.
+describe("a action das duas redes passa o começo da função ao LinkedIn e ao dreno do Instagram", () => {
+  it("app/publicar/actions.ts, publicarNasDuasRedes", () => {
+    const fonte = readFileSync(join(RAIZ, "app/publicar/actions.ts"), "utf8").replace(/\r\n/g, "\n");
+    const inicio = fonte.indexOf("export async function publicarNasDuasRedes(");
+    expect(inicio).toBeGreaterThan(-1);
+    const fim = fonte.indexOf("\nexport ", inicio + 1);
+    const corpo = fonte.slice(inicio, fim === -1 ? undefined : fim);
+    expect(corpo).toMatch(/\{\n {2}await exigirSessao\(\);\n {2}const inicioDaFuncaoMs = Date\.now\(\);\n/);
+    expect(corpo).toMatch(/drenarUmaPublicacaoDoLinkedin\(\s*[\w.]+,\s*inicioDaFuncaoMs\s*\)/);
+    expect(corpo).toMatch(/drainQueue\(\{\s*inicioDaFuncaoMs\s*\}\)/);
+    expect(corpo).not.toMatch(/drainQueue\(\)/);
+    expect(corpo.indexOf("drenarUmaPublicacaoDoLinkedin(")).toBeLessThan(corpo.indexOf("drainQueue("));
+  });
+});
+
 describe("as rotas que drenam passam o começo da função ao dreno", () => {
   for (const rota of ROTAS) {
     it(rota, () => {
```

- [ ] **Passo 2: rodar e ver passar**

```bash
env -u CLAUDECODE -u AI_AGENT npx --no-install vitest run tests/dreno-com-prazo.test.ts
npx --no-install eslint tests/dreno-com-prazo.test.ts
```

Esperado: "Test Files 1 passed (1)" e "Tests 5 passed (5)", e o lint sem saída.

- [ ] **Passo 3: o commit**

A mensagem do commit, gravada em `$SCRATCH/msg-li2b-f5.txt`:

```text
O agora das duas redes passa o começo da função ao LinkedIn e ao dreno do Instagram, e um teste prende isso
```

```bash
git add -- tests/dreno-com-prazo.test.ts
git commit -F "$SCRATCH/msg-li2b-f5.txt"
```

---

### FASE 6 — A verificação inteira, as mutações e a guarda do diff

- [ ] **Passo 1: o verify**

```bash
env -u CLAUDECODE -u AI_AGENT npm run verify
git diff --name-only AGENTS.md   # vazio
git status --porcelain            # vazio
```

Esperado: saída 0; 158 arquivos e 3 757 casos puros; 36 e 336 de tela; "SEM VAZAMENTO em A nem em C, nas duas varreduras."; "MIGRAÇÃO PULADA — este não é um deploy de produção."; o build do Next 16.4.3.

- [ ] **Passo 2: a integração inteira, uma rodada só**

```bash
DATABASE_URL_TESTES="postgresql://postgres:postgres@127.0.0.1:5434/metodochat_testes" npm run test:integracao
```

Esperado: saída 0; `ALVO: banco de TESTE`; "nenhum schema teste_tmp_* no banco" antes e depois; 76 arquivos, 927 passaram e 8 pularam.

- [ ] **Passo 3: as mutações (Apêndice A)**

```bash
node <pasta>/mutar-li2b.mjs --conferir   # 29 "ÚNICO"
node <pasta>/mutar-li2b.mjs
```

Esperado: as 29 como "MORTA", e "29 mutações, 0 ruins; árvore no fim: limpa". Se a rodada parar antes dessa linha, rode `git status` e `git diff` antes de qualquer outra coisa: o arquivo da mutação em curso pode ter ficado mutado, e só ele se restaura.

- [ ] **Passo 4: a guarda do diff**

```bash
git diff --stat 58cc3db HEAD -- . ':!docs'
git diff --name-only 58cc3db HEAD -- docs
git diff --stat 58cc3db HEAD -- lib/queue-drain.ts lib/bucket.ts lib/engine.ts   # vazio
```

Esperado: no primeiro, os 18 arquivos do mapa, e mais nenhum: "18 files changed, 2040 insertions(+), 163 deletions(-)". No segundo, só este plano. O terceiro, vazio. O patch-id de cada fase (`git show <commit> | git patch-id --stable`) tem de bater com o do ensaio: `121050c830a7`, `da76aa4fb0c3`, `fd0fe4464c5a`, `2d4d74b49b7e` e `f7ac57af2c0a`.

---

### FASE 7 — O push, a prova no preview, o PR e o deploy

Esta parte não tem migração. Cada passo que sai da máquina, ou que grava, tem o OK do Eduardo pela caixa, a hora mandada à auditoria antes e o "pode" dela.

- [ ] **Passo 1: o push da branch, com o OK do Eduardo**

```bash
git ls-remote origin refs/heads/linkedin-duas-redes   # vazio; se não estiver, pare
git push -u origin refs/heads/linkedin-duas-redes:refs/heads/linkedin-duas-redes
```

No log do build do preview, confira: o commit, nenhum aviso do Node 26, "Detected Next.js version: 16.4.3", "MIGRAÇÃO PULADA". No deployment, meça o endereço da branch (o `alias` do `get_deployment`). O rótulo `metodochat-git-linkedin-duas-redes-moraesvannuchi-debugs-projects` tem 65 caracteres, acima dos 63 de um rótulo de DNS, então a Vercel o encurta com um hash, como na 2a: o endereço é o que o `alias` disser. O medido em 11/11 é `metodochat-git-linkedin-d-78e8ee-moraesvannuchi-debugs-projects.vercel.app`, com 63 caracteres no rótulo.

- [ ] **Passo 2: as decisões do Eduardo, pela caixa**
  - qual conta do painel publica. O post sai PÚBLICO no Instagram dessa conta e no LinkedIn pessoal ligado a ela;
  - o texto da legenda e, se ele quiser, o texto próprio do LinkedIn, sabendo que apagar os posts não desfaz o que já foi visto nem as notificações (achado 190);
  - a imagem;
  - se a conexão do LinkedIn fica no fim, ou se é desconectada.

A CONEXÃO, SE A CONTA ESTIVER SEM LINKEDIN, É PELA PRODUÇÃO, como na 2a: o Eduardo gera o convite na Configuração de `https://metodochat.vercel.app` e o abre. Um convite só, gerado na hora, e usado logo (achado 209).

- [ ] **Passo 3: a prova no preview, pelo Eduardo**

O roteiro vai à auditoria antes. A espera fica numa página só de texto, e nenhum formulário fica à vista durante uma espera (achados 176 e 186). A auditoria lê a base ANTES do "agora" e depois dele, com os vencidos da fila: no preview, o dreno de hoje roda sobre a fila de verdade. Os passos:
1. em "Novo post", as caixinhas: o Instagram marcado, o LinkedIn desmarcado e ligado, com o nome do perfil; ao escolher "Carrossel", o LinkedIn se desliga com o motivo, e ao voltar para "Imagem" ele continua desmarcado;
2. marcar o LinkedIn, escolher a imagem, escrever a legenda (e o texto próprio, se decidido) e "Publicar agora". O aviso traz as duas frases: "Instagram: Publicação na fila. …" e "LinkedIn: Post publicado no LinkedIn.";
3. a auditoria lê a base: duas linhas, `publicacao` e `publicacao_linkedin`, `sent`; a cópia e o original fora do bucket; e o tempo de cada uma pelo `sent_at` menos o `claimed_at`;
4. os dois posts conferidos, no Instagram e no LinkedIn (o "Ver no LinkedIn ↗"), e apagados à mão, logo depois;
5. na Configuração do preview, o "Convidar a conectar o LinkedIn" da conta conectada abre a confirmação com o nome; o Eduardo clica em "Cancelar", e nenhum convite é gravado (a auditoria confere);
6. se o "agora" do LinkedIn responder "vai sair em instantes" ou falhar por um erro passageiro, o Eduardo cancela esse post na página dele, no preview, e avisa a auditoria; a auditoria lê a base; e o post NÃO é refeito no mesmo passo.

O que a prova NÃO provoca, e por quê: o Instagram que não entra na fila (seria mexer no banco ou na rede da produção) e o mesmo envio repetido (a tela trava o segundo clique, e cada formulário novo sobe um arquivo novo, com outro caminho). Os dois estão na integração (FASE 2) e nas mutações.

No fim, a auditoria confere que não há nenhuma linha `publicacao` nem `publicacao_linkedin` da prova em `pending` nem em `sending`.

Medido na prova de 11/11 (o Eduardo, com a mesma conta e o mesmo LinkedIn pessoal da prova da 2a; a base lida pela auditoria antes e depois de cada passo que grava):
- A conexão foi pela produção, com 1 convite só, gerado às 12:14:52Z e usado às 12:15:14Z. Ficou com 60 dias, e o nome do perfil veio com um espaço só.
- As caixinhas de partida e o carrossel que desliga o LinkedIn foram mandados junto com o passo 11, e não tiveram print. A tela com as duas caixinhas está na resposta do Eduardo pela caixa. O desligar, e o LinkedIn que continua desmarcado na volta, ficam provados pelos testes de tela e pelas mutações F3-2 e F3-3.
- O primeiro "Publicar" (12:28:13Z) saiu só no LinkedIn. O Instagram estava desmarcado, e a legenda foi no campo "Texto" do modo só LinkedIn: isso é o achado 215, uma nota para a parte 3, porque nada na tela chama a atenção para o Instagram desmarcado. A linha `publicacao_linkedin` teve 1 tentativa e terminou `sent` em 2.168 ms, com o arquivo original (sem cópia, como deve ser numa rede só) e o texto de 97 caracteres. O post foi apagado. O passo 11 foi refeito com as duas caixinhas e os dois campos conferidos na instrução, e o Eduardo confirmou por escrito, sem o print.
- O post nas duas redes foi às 12:35:46Z:
  - a linha `publicacao_linkedin` teve 1 tentativa e terminou `sent`, com o ramo (o `sent_at` menos o `claimed_at`) em 2.300 ms. O `caminhos` era a CÓPIA, e a chave, o caminho ORIGINAL. O texto tinha 117 caracteres: era o texto próprio, e não a legenda de 97;
  - a linha `publicacao` nasceu junto, com o original e a legenda de 97 caracteres. A 1ª tentativa, no "agora", parou no erro gravado "a Meta ainda esta processando a midia" (sem acento, como está no código da fila), com o contêiner já criado. A 2ª foi às 12:39:43Z, num dreno da produção, e saiu em 3.452 ms, com o `media_id`. No preview não há QStash (as variáveis `QSTASH_*` só existem na produção), então nenhum tique foi armado ali para a linha que espera o contêiner. Isso é o achado 216, e a linha esperou o dreno seguinte da produção;
  - depois dos `sent`, a cópia e os dois originais (o do primeiro post e o deste) davam 400 NoSuchKey no bucket.
- O post do LinkedIn trouxe o texto próprio, com o "#marketing_2026" como hashtag. O do Instagram trouxe a legenda, com o "#teste_2026". Os dois foram apagados à mão logo depois. O print do LinkedIn não ficou em arquivo; o texto próprio está provado pelo banco, com os 117 caracteres.
- Na Configuração do preview, o "Convidar a conectar o LinkedIn" da conta conectada abriu a pergunta com o nome do perfil, e o "Cancelar" a fechou sem link. Os convites ficaram iguais antes e depois: 5 do LinkedIn, nenhum pendente.
- A conexão foi desfeita no fim, pela produção. Ficaram 0 conexões, as linhas da prova em `sent` e nenhuma linha em `pending` nem em `sending`.
- O `get_runtime_errors` não trouxe nenhum erro no período. O `get_runtime_logs` por nível veio vazio, no preview e na produção: o Hobby guarda 1 hora, e o caminho da prova não escreve no console.

- [ ] **Passo 4: o PR, com o OK do Eduardo.** O corpo leva o que muda, os números deste plano, o que o ensaio achou, os limites conhecidos, e nenhuma arroba solta nem nome de pessoa ou de conta. A mensagem do merge vai à parte, e a auditoria lê os dois antes de o PR abrir. O merge é do Eduardo.

- [ ] **Passo 5: o deploy do merge.**
  - No log: "Nada a aplicar: as 26 migrações já constam no registro.", o `queue_kind_check` "existe e confere (025-fila-linkedin.sql)", as outras conferências "CONFERIDO", e sem o aviso do Node 26.
  - No site: o `/entrar` dá 200, e o cron sem senha dá 401.
  - Os registros da produção da primeira hora, sem erro novo.

Com a parte 2b em produção, a parte 3 (o carrossel em PDF e o vídeo) começa pelo plano dela.

---

## Apêndice A — As mutações

O roteiro roda da raiz da cópia, com a árvore commitada e limpa, e com o `node_modules` da cópia. Cada mutação troca um trecho que aparece uma vez só, roda o arquivo de teste que a cobre e confere que o caso nomeado cai, pelo nome inteiro. As de integração rodam contra o banco de TESTE, uma de cada vez. No fim, a árvore volta limpa.

UMA FICOU DE FORA DE PROPÓSITO: o desfazer sem o `kind = 'publicacao_linkedin'`. O id que ele recebe vem sempre do insert do LinkedIn da mesma action, então o `kind` no `where` é uma defesa a mais, e não uma trava que algum caminho de hoje usa; nenhum caso a distinguiria, e uma mutação que sobrevive de propósito não prova nada.

```js
// AS MUTAÇÕES DA PARTE 2b DO LINKEDIN (as duas redes no mesmo post; docs/specs/2026-11-06-linkedin-no-perfil.md, §6 e
// §7), no molde de mutar-li2.mjs. Cada uma desfaz UMA trava, trocando um trecho exato de um arquivo (que tem de
// aparecer uma vez só), roda só o arquivo de teste que a cobre e confere que o caso NOMEADO cai, pelo nome inteiro. As
// de integração rodam contra o banco de TESTE, uma de cada vez. A árvore tem de estar commitada e limpa antes, e volta
// limpa no fim. O vitest roda por `npx --no-install` (achado 208), e a cópia tem de ter o node_modules dela.
//
// Uso, da raiz da cópia: node ../mutar-li2b.mjs [prefixo-do-nome]
//                        node ../mutar-li2b.mjs --conferir   (só confere que cada trecho aparece uma vez)
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

const T_REDES = { ...PURO, arquivo: "tests/redes-do-post.test.ts" };
const T_COPIA = { ...PURO, arquivo: "tests/linkedin-copia.test.ts" };
const T_PRAZO = { ...PURO, arquivo: "tests/dreno-com-prazo.test.ts" };
const T_CONFIRMACAO = { ...PURO, arquivo: "tests/linkedin-convite-confirmacao.test.ts" };
const T_DUAS = { ...INTEG, arquivo: "testes-integracao/linkedin-duas-redes.integracao.ts" };
const T_ACOES = { ...INTEG, arquivo: "testes-integracao/linkedin-acoes.integracao.ts" };
const T_TELA_COMPOR = { ...TELA, arquivo: "testes-dom/publicar-compositor-linkedin.dom.tsx" };
const T_TELA_SETUP = { ...TELA, arquivo: "testes-dom/linkedin-no-setup.dom.tsx" };

const REDES = "lib/redes-do-post.ts";
const COPIA = "lib/linkedin-copia.ts";
const FILA = "lib/linkedin-fila.ts";
const ACAO = "app/publicar/actions.ts";
const ENVIADOR = "app/publicar/enviador.tsx";

const MUTACOES = [
  // ---- F1: as regras das duas redes ----
  {
    nome: "F1-1: as caixinhas começam com o LinkedIn marcado",
    arq: REDES,
    de: "export const CAIXINHAS_DE_PARTIDA: Readonly<Record<Rede, boolean>> = { instagram: true, linkedin: false };\n",
    para: "export const CAIXINHAS_DE_PARTIDA: Readonly<Record<Rede, boolean>> = { instagram: true, linkedin: true };\n",
    teste: T_REDES,
    cai: "começam só com o Instagram marcado (a decisão do Eduardo, 10/11)",
  },
  {
    nome: "F1-2: a caixinha desligada do LinkedIn conta como marcada",
    arq: REDES,
    de: "    linkedin: { ligada: !motivoDoLinkedin, marcada: !motivoDoLinkedin && p.marcadas.linkedin, motivo: motivoDoLinkedin },\n",
    para: "    linkedin: { ligada: !motivoDoLinkedin, marcada: p.marcadas.linkedin, motivo: motivoDoLinkedin },\n",
    teste: T_REDES,
    cai: "o story, o carrossel e o reels desligam o LinkedIn, com o motivo da forma",
  },
  {
    nome: "F1-3: o LinkedIn aceita o story",
    arq: REDES,
    de: '      return "O LinkedIn não tem story.";\n',
    para: "      return null;\n",
    teste: T_REDES,
    cai: "o LinkedIn aceita o só texto e a imagem; o carrossel e o reels chegam na próxima entrega, e o story nunca",
  },
  {
    nome: "F1-4: o texto próprio só com espaços vence a legenda",
    arq: REDES,
    de: "  return p.textoProprio.trim() || p.legenda.trim();\n",
    para: "  return p.textoProprio || p.legenda.trim();\n",
    teste: T_REDES,
    cai: "sem o texto próprio (vazio ou só espaços), vai a legenda",
  },
  {
    nome: "F1-5: o LinkedIn que não saiu deixa o aviso em ok",
    arq: REDES,
    de: '    tom: nadaNovo || doLinkedin.tom === "erro" ? "erro" : "ok",\n',
    para: '    tom: nadaNovo ? "erro" : "ok",\n',
    teste: T_REDES,
    cai: "o LinkedIn que não saiu deixa o aviso em erro, com o motivo, e o Instagram é dito igual",
  },
  {
    nome: "F1-6: o só texto aparece sem o LinkedIn disponível",
    arq: REDES,
    de: '  return linkedin?.disponivel ? [...FORMAS_DO_INSTAGRAM, "texto"] : [...FORMAS_DO_INSTAGRAM];\n',
    para: '  return [...FORMAS_DO_INSTAGRAM, "texto"];\n',
    teste: T_REDES,
    cai: "sem o LinkedIn disponível, são as quatro do Instagram, sem o só texto",
  },

  // ---- F2: a cópia ----
  {
    nome: "F2-1: a origem de outra conta não é conferida",
    arq: COPIA,
    de: '  if (conferidos.length !== 1 || conferidos[0] !== origem) throw new Error("a imagem não é desta conta");\n',
    para: "",
    teste: T_COPIA,
    cai: "a imagem de outra conta é recusada antes de qualquer chamada",
  },
  {
    nome: "F2-2: o teto de 8 MB tirado",
    arq: COPIA,
    de: "  if (bytes.length === 0 || bytes.length > TETO_DA_COPIA_BYTES) {\n",
    para: "  if (bytes.length === 0) {\n",
    teste: T_COPIA,
    cai: "vazia, ou maior que 8 MB, é recusada sem assinar nada",
  },
  {
    nome: "F2-3: o teto de 10 s da assinatura tirado",
    arq: COPIA,
    de: '  const { url } = await comTeto(() => urlAssinadaDeUpload(destino), "ao assinar a cópia");\n',
    para: "  const { url } = await urlAssinadaDeUpload(destino);\n",
    teste: T_COPIA,
    cai: "a assinatura que não responde também desiste no teto de 10 s, sem subir nada (o teto é de quem chama)",
  },
  {
    nome: "F2-4: a URL assinada na frase do erro",
    arq: COPIA,
    de: "    if (!subida.ok) throw new Error(`o armazenamento recusou a cópia (HTTP ${subida.status})`);\n",
    para: "    if (!subida.ok) throw new Error(`o armazenamento recusou a cópia (HTTP ${subida.status}) em ${url}`);\n",
    teste: T_COPIA,
    cai: "o armazenamento que recusa a subida faz a cópia lançar, sem o endereço assinado na frase",
  },

  // ---- F2: a action das duas redes e a fila (achados 192 e 199) ----
  {
    nome: "F2-5: a chave do LinkedIn pelo caminho da cópia",
    arq: ACAO,
    de: "          { caminhosDaChave: caminhos }\n",
    para: "          {}\n",
    teste: T_DUAS,
    cai: "o mesmo envio agendado de novo: já existia nas duas, e nenhuma cópia nova sobra",
  },
  {
    nome: "F2-6: o desfazer sem o status pending",
    arq: FILA,
    de: "      where id = $1 and kind = 'publicacao_linkedin' and status = 'pending'\n",
    para: "      where id = $1 and kind = 'publicacao_linkedin'\n",
    teste: T_DUAS,
    cai: "o Instagram recusado com o LinkedIn já pego por um dreno: a linha segue, a cópia fica, e a tela diz que ele segue",
  },
  {
    nome: "F2-7: a cópia apagada mesmo quando o desfazer não devolveu a linha",
    arq: ACAO,
    de: "      if (desfeita && copia) await apagarACopiaSemDerrubar(copia);\n",
    para: "      if (copia) await apagarACopiaSemDerrubar(copia);\n",
    teste: T_DUAS,
    cai: "o Instagram recusado com o LinkedIn já pego por um dreno: a linha segue, a cópia fica, e a tela diz que ele segue",
  },
  {
    nome: "F2-8: a cópia não apagada quando o LinkedIn não entrou",
    arq: ACAO,
    de: "      if (!linkedin.entrou) {\n        await apagarACopiaSemDerrubar(copia);\n        copia = null;\n      }\n",
    para: "      if (!linkedin.entrou) {\n        copia = null;\n      }\n",
    teste: T_DUAS,
    cai: "a linha do LinkedIn que o banco recusa: a cópia sai do bucket, e nada foi agendado",
  },
  {
    nome: "F2-9: a conferência da chave do LinkedIn tirada de antes da cópia",
    arq: ACAO,
    de: "  if (!(await aChaveDoLinkedinJaExiste(conta.ig_user_id, pedidoDoLinkedin))) {\n",
    para: "  if (true) {\n",
    teste: T_DUAS,
    cai: "o mesmo envio de novo, depois do agora: as duas redes dizem que já existia, sem cópia nova e sem baixar nada",
  },
  {
    nome: "F2-10: a falha do LinkedIn não para antes do Instagram",
    arq: ACAO,
    de: "    if (falhaDoLinkedin) {\n",
    para: "    if (false) {\n",
    teste: T_DUAS,
    cai: "a cópia que falha: nada é gravado, e a tela diz o motivo",
  },
  {
    nome: "F2-11: o Instagram que lança não desfaz o LinkedIn",
    arq: ACAO,
    de: "        desfeita = await desfazerLinhaDoLinkedin(linkedin.id);\n",
    para: "        desfeita = false;\n",
    teste: T_DUAS,
    cai: "o Instagram que o banco recusa, com o LinkedIn pendente: o LinkedIn é desfeito, a cópia sai, e nada foi agendado",
  },
  {
    nome: "F2-12: o dreno do Instagram sem o começo da função",
    arq: ACAO,
    de: "      await drainQueue({ inicioDaFuncaoMs });\n",
    para: "      await drainQueue();\n",
    teste: T_PRAZO,
    cai: "app/publicar/actions.ts, publicarNasDuasRedes",
  },
  {
    nome: "F2-13: o agora do LinkedIn com a hora de depois do enfileirar",
    arq: ACAO,
    de: "      desfecho = await drenarUmaPublicacaoDoLinkedin(linkedin.id, inicioDaFuncaoMs);\n",
    para: "      desfecho = await drenarUmaPublicacaoDoLinkedin(linkedin.id, Date.now());\n",
    teste: T_PRAZO,
    cai: "app/publicar/actions.ts, publicarNasDuasRedes",
  },

  // ---- F3: a tela ----
  {
    nome: "F3-1: o destino das duas trocado pelo do Instagram",
    arq: ENVIADOR,
    de: "    const destino = nasDuas ? (acaoDasDuasRedes ?? acao) : soNoLinkedin ? (acaoDoLinkedin ?? acao) : acao;\n",
    para: "    const destino = nasDuas ? acao : soNoLinkedin ? (acaoDoLinkedin ?? acao) : acao;\n",
    teste: T_TELA_COMPOR,
    cai: "o clique chama a action das duas redes, e só ela, uma vez, com a imagem, a legenda, o texto próprio e o envio",
  },
  {
    nome: "F3-2: a troca de forma não desmarca, e a volta remarca o LinkedIn",
    arq: ENVIADOR,
    de:
      "    setMarcadas((atuais) => ({\n" +
      '      instagram: atuais.instagram && !redeAceitaAForma("instagram", nova),\n' +
      '      linkedin: atuais.linkedin && !redeAceitaAForma("linkedin", nova),\n' +
      "    }));\n",
    para: "",
    teste: T_TELA_COMPOR,
    cai: "o carrossel, o reels e o story desligam e desmarcam o LinkedIn, com o motivo da forma",
  },
  {
    nome: "F3-3: a tela começa com as duas marcadas",
    arq: ENVIADOR,
    de: "  const [marcadas, setMarcadas] = useState<Record<Rede, boolean>>({ ...CAIXINHAS_DE_PARTIDA });\n",
    para: "  const [marcadas, setMarcadas] = useState<Record<Rede, boolean>>({ instagram: true, linkedin: true });\n",
    teste: T_TELA_COMPOR,
    cai: "com o LinkedIn ligado, começam só com o Instagram marcado, e a tela diz em qual perfil o LinkedIn sai",
  },
  {
    nome: "F3-4: sem nenhuma rede, o clique não é recusado",
    arq: ENVIADOR,
    de: "    if (!paraOInstagram && !paraOLinkedin) {\n",
    para: "    if (false) {\n",
    teste: T_TELA_COMPOR,
    cai: "sem nenhuma rede marcada, o clique é recusado na tela, sem chamar nada",
  },
  {
    nome: "F3-5: o contador das duas conta só o texto próprio",
    arq: ENVIADOR,
    de: "                  {tamanhoDoTextoNoLinkedin(textoDoLinkedin)}/{LIMITE_DO_TEXTO_DO_LINKEDIN}\n",
    para: "                  {tamanhoDoTextoNoLinkedin(textoProprio.trim())}/{LIMITE_DO_TEXTO_DO_LINKEDIN}\n",
    teste: T_TELA_COMPOR,
    cai: "a imagem com as duas: a Legenda, o Texto para o LinkedIn opcional, a nota da legenda e o contador do texto que vai",
  },
  {
    nome: "F3-6: o texto do LinkedIn não é conferido antes de subir",
    arq: ENVIADOR,
    de: "    if (paraOLinkedin) {\n      // O TEXTO DO LINKEDIN, pela mesma função da action, antes de subir qualquer arquivo.\n",
    para: "    if (false) {\n      // O TEXTO DO LINKEDIN, pela mesma função da action, antes de subir qualquer arquivo.\n",
    teste: T_TELA_COMPOR,
    cai: "a legenda e o texto próprio vazios: o LinkedIn não teria texto, e a tela recusa antes de subir",
  },

  // ---- F4: o convite numa conta que já tem LinkedIn (achado 209) ----
  {
    nome: "F4-1: o confirmado do servidor tirado",
    arq: "app/setup/actions.ts",
    de: '  if (oConvitePedeConfirmacao(estado) && formData.get("confirmado") !== "1") {\n',
    para: "  if (false) {\n",
    teste: T_ACOES,
    cai: "dois pedidos sem a confirmação, um logo depois do outro (o 209), não gravam nada",
  },
  {
    nome: "F4-2: o perto de vencer não pede confirmação",
    arq: "lib/linkedin-publicacao.ts",
    de: '  return estado === "valido" || estado === "perto";\n',
    para: '  return estado === "valido";\n',
    teste: T_CONFIRMACAO,
    cai: "a conta com o LinkedIn válido, ou perto de vencer, pede: um convite usado troca a conexão que existe",
  },
  {
    nome: "F4-3: a tela manda o convite direto na conta conectada",
    arq: "app/setup/linkedin-das-contas.tsx",
    de: "  const pedeConfirmacao = oConvitePedeConfirmacao(c?.estado ?? null);\n",
    para: "  const pedeConfirmacao = false;\n",
    teste: T_TELA_SETUP,
    cai: "na conta conectada, o botão abre a confirmação com o nome, e não chama a ação",
  },
  {
    nome: "F4-4: o Sim sem o confirmado",
    arq: "app/setup/linkedin-das-contas.tsx",
    de: '              <input type="hidden" name="confirmado" value="1" />\n',
    para: "",
    teste: T_TELA_SETUP,
    cai: 'o "Sim, gerar o convite" chama a ação uma vez, com a conta da linha e o confirmado',
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
  const caiu = cairam.includes(m.cai);
  const outros = cairam.filter((c) => c !== m.cai).length;
  const ok = alvoOk && r.status !== 0 && caiu;
  if (!ok) ruins++;
  const s = Math.round((Date.now() - t0) / 1000);
  console.log(
    `${ok ? "MORTA" : "RUIM "} ${m.nome}  (saída ${r.status}, alvo ok: ${alvoOk}, caiu o caso: ${caiu}, outros que caíram: ${outros}, ${s}s)`
  );
  if (!ok) console.log(`      casos que caíram: ${cairam.length ? cairam.join(" | ") : "nenhum"}`);
}
const total = Math.round((Date.now() - inicio) / 1000);
console.log(
  `${rodadas} mutações, ${ruins} ruins; árvore no fim: ${status() === "" ? "limpa" : "SUJA"}${conferir ? " (só a conferência dos trechos)" : `; ${Math.floor(total / 60)} min ${total % 60} s`}`
);
```
